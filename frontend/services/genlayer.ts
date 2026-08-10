import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import type {
  Address,
  CalldataEncodable,
  TransactionHash,
} from "genlayer-js/types";

export const MARKET_CONTRACT_ADDRESS =
  "0x0B7CB2FEbf680dC2b5d1b60a374b5D9d5aE269f3" as Address;

const GENLAYER_RPC_PROXY = "/api/genlayer-rpc";
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
type WalletWindow = Window & { ethereum?: WalletProvider };

function getWalletProvider(): WalletProvider {
  if (typeof window === "undefined") {
    throw new Error("A browser wallet is required for this operation.");
  }

  const provider = (window as WalletWindow).ethereum;
  if (!provider) {
    throw new Error("No compatible browser wallet was found.");
  }

  return provider;
}

async function createWalletClient() {
  const provider = getWalletProvider();
  const accounts = await provider.request({ method: "eth_accounts" });
  const account = Array.isArray(accounts) ? accounts[0] : undefined;

  if (typeof account !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(account)) {
    throw new Error("Connect your wallet before signing a transaction.");
  }

  const client = createClient({
    chain: studionet,
    account: account as Address,
    provider,
    endpoint: GENLAYER_RPC_PROXY,
  });

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
