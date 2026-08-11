import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import type {
  Address,
  CalldataEncodable,
  TransactionHash,
} from "genlayer-js/types";

export const MARKET_CONTRACT_ADDRESS =
  "0x689C08fa3643C0c8C563417Ea9AE4Af11F031961" as Address;

const GENLAYER_RPC_PROXY = "/api/genlayer-rpc";
const STUDIONET_RPC_URL = "https://studio.genlayer.com/api";
const READ_CACHE_TTL_MS = 30_000;

type ReadCacheEntry = {
  expiresAt: number;
  promise?: Promise<unknown>;
  value?: unknown;
};

const readCache = new Map<string, ReadCacheEntry>();
let rpcWindowStartedAt = Date.now();
let rpcCallCount = 0;

export const genlayerClient = createClient({
  chain: studionet,
  endpoint: GENLAYER_RPC_PROXY,
});

function readCacheKey(functionName: string, args: CalldataEncodable[]) {
  return JSON.stringify([functionName, args], (_, value: unknown) =>
    typeof value === "bigint" ? value.toString() : value,
  );
}

function logRpcRead(functionName: string) {
  const now = Date.now();
  if (now - rpcWindowStartedAt >= 60_000) {
    rpcWindowStartedAt = now;
    rpcCallCount = 0;
  }
  rpcCallCount += 1;
  console.info(
    "[PM-RPC] METHOD:",
    "gen_call",
    "[PM-RPC] COUNT_THIS_MINUTE:",
    rpcCallCount,
    "[PM-RPC] CALLER:",
    functionName,
  );
}

export function clearMarketReadCache() {
  readCache.clear();
}

type ClientConfig = NonNullable<Parameters<typeof createClient>[0]>;
type WalletProvider = NonNullable<ClientConfig["provider"]>;
type WalletWindow = Window & {
  ethereum?: WalletProvider;
  okxwallet?: { ethereum?: WalletProvider };
};

function getWalletProvider(): WalletProvider {
  if (typeof window === "undefined") {
    throw new Error("A browser wallet is required for this operation.");
  }

  const walletWindow = window as WalletWindow;
  const provider =
    walletWindow.ethereum ?? walletWindow.okxwallet?.ethereum;
  if (!provider) {
    throw new Error("No compatible browser wallet was found.");
  }

  // genlayer-js 1.1.8 reads window.ethereum inside client.connect().
  // OKX exposes the same EIP-1193 provider as window.okxwallet.ethereum.
  if (!walletWindow.ethereum && walletWindow.okxwallet?.ethereum) {
    walletWindow.ethereum = walletWindow.okxwallet.ethereum;
  }

  return provider;
}

function isUnsupportedSnapMethod(error: unknown): boolean {
  const code =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  const message = error instanceof Error ? error.message : String(error);
  return (
    code === 4200 ||
    code === -32601 ||
    /wallet_getSnaps|wallet_requestSnaps|unsupported|not supported|method not found/i.test(
      message,
    )
  );
}

function isUnknownChainError(error: unknown): boolean {
  const code =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
  const message = error instanceof Error ? error.message : String(error);
  return code === 4902 || /unrecognized chain|unknown chain/i.test(message);
}

async function ensureWalletOnStudionet(provider: WalletProvider) {
  const expectedChainId = `0x${studionet.id.toString(16)}`;
  const currentChainId = await provider.request({ method: "eth_chainId" });

  if (currentChainId !== expectedChainId) {
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: expectedChainId }],
      });
    } catch (error: unknown) {
      if (!isUnknownChainError(error)) throw error;

      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: expectedChainId,
            chainName: studionet.name,
            nativeCurrency: studionet.nativeCurrency,
            rpcUrls: [STUDIONET_RPC_URL],
            blockExplorerUrls: [
              studionet.blockExplorers?.default.url,
            ],
          },
        ],
      });
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: expectedChainId }],
      });
    }
  }

  const verifiedChainId = await provider.request({ method: "eth_chainId" });
  if (verifiedChainId !== expectedChainId) {
    throw new Error(
      `Wallet is on chain ${verifiedChainId}, but PitchMarket requires GenLayer Studionet (${studionet.id}).`,
    );
  }

  console.info("[PM-WALLET] CLIENT_CHAIN_ID:", studionet.id);
  console.info("[PM-WALLET] WALLET_CHAIN_ID:", studionet.id);
}

async function createWalletClient() {
  const provider = getWalletProvider();
  await ensureWalletOnStudionet(provider);
  const accounts = await provider.request({ method: "eth_accounts" });
  const account = Array.isArray(accounts) ? accounts[0] : undefined;

  if (typeof account !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(account)) {
    throw new Error("Connect your wallet before signing a transaction.");
  }

  const client = createClient({
    chain: studionet,
    account: account as Address,
    provider,
  });

  try {
    await client.connect("studionet");
  } catch (error: unknown) {
    // OKX implements EIP-1193 network methods but not MetaMask Snap methods.
    if (!isUnsupportedSnapMethod(error)) throw error;
    console.info("[PM-WALLET] OKX_SNAP_METHOD_UNSUPPORTED");
  }

  await ensureWalletOnStudionet(provider);

  return client;
}

export async function readMarketContract<T>(
  functionName: string,
  args: CalldataEncodable[] = [],
  callerRequired = false,
): Promise<T> {
  const client = callerRequired ? await createWalletClient() : genlayerClient;
  if (callerRequired) {
    return (await client.readContract({
      address: MARKET_CONTRACT_ADDRESS,
      functionName,
      args,
      jsonSafeReturn: true,
    })) as T;
  }

  const key = readCacheKey(functionName, args);
  const bypassCache = functionName === "get_market";
  const now = Date.now();
  const cached = readCache.get(key);
  if (!bypassCache && cached && cached.expiresAt > now) {
    console.info("[PM-READ] CACHE_HIT:", functionName, key);
    if (cached.promise) return (await cached.promise) as T;
    return cached.value as T;
  }

  console.info("[PM-READ] CACHE_MISS:", functionName, key);

  logRpcRead(functionName);
  const promise = client.readContract({
    address: MARKET_CONTRACT_ADDRESS,
    functionName,
    args,
    jsonSafeReturn: true,
  });
  if (!bypassCache) {
    readCache.set(key, { expiresAt: now + READ_CACHE_TTL_MS, promise });
  }

  const result = await promise;
  if (functionName === "get_market") {
    console.info("[PM-READ] RAW_GET_MARKET:", result);
  }
  if (!bypassCache) {
    readCache.set(key, {
      expiresAt: now + READ_CACHE_TTL_MS,
      value: result,
    });
  }
  return result as T;
}

export async function writeMarketContract(
  functionName: string,
  args: CalldataEncodable[] = [],
  value: bigint = BigInt(0),
): Promise<TransactionHash> {
  const client = await createWalletClient();

  return client.writeContract({
    address: MARKET_CONTRACT_ADDRESS,
    functionName,
    args,
    value,
  });
}
