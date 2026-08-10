"use client";

import {
  CircleDot,
  LoaderCircle,
  LogOut,
  Menu,
  Wallet,
} from "lucide-react";
import {
  useBalance,
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
} from "wagmi";
import { formatEther } from "viem";
import { studionet } from "genlayer-js/chains";

const navigation = [
  { label: "Matches", href: "#matches" },
  { label: "Markets", href: "#markets" },
];

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function WalletControl() {
  const connection = useConnection();
  const connectors = useConnectors();
  const { mutate: connect, error: connectError, isPending } = useConnect();
  const { mutate: disconnect } = useDisconnect();
  const { data: balance, isLoading: isBalanceLoading } = useBalance({
    address: connection.address,
    query: { enabled: connection.isConnected },
  });

  const connector = connectors[0];

  if (!connection.isConnected || !connection.address) {
    return (
      <div className="relative">
        <button
          className="flex h-9 items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 text-sm font-semibold transition-colors hover:border-lime/50 hover:text-lime disabled:cursor-not-allowed disabled:opacity-60 sm:h-10 sm:px-4"
          disabled={!connector || isPending}
          onClick={() => connector && connect({ connector })}
          type="button"
        >
          {isPending ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Wallet className="size-4" />
          )}
          <span className="hidden lg:inline">
            {isPending ? "Connecting..." : "Connect Wallet"}
          </span>
        </button>
        {connectError && (
          <p
            className="absolute right-0 top-full mt-2 w-64 rounded-md border border-red-400/30 bg-ink px-3 py-2 text-xs leading-5 text-red-300 shadow-xl"
            role="alert"
          >
            {connectError.message}
          </p>
        )}
      </div>
    );
  }

  const networkName =
    connection.chainId === studionet.id
      ? "Studionet"
      : connection.chain?.name ?? "GenLayer testnet";
  const balanceLabel = isBalanceLoading
    ? "Loading balance"
    : balance
      ? `${Number(formatEther(balance.value)).toFixed(4)} GEN`
      : "Balance unavailable";

  const walletDetails = (
    <>
      <p className="font-semibold text-white">
        {shortenAddress(connection.address)}
      </p>
      <p className="mt-0.5 text-[11px] text-white/45">
        {balanceLabel} · {networkName}
      </p>
    </>
  );

  return (
    <div className="relative">
      <div className="flex h-10 items-center gap-2 rounded-md border border-white/15 bg-white/5 px-2.5">
        <Wallet className="size-4 shrink-0 text-lime" />
        <div className="hidden min-w-32 lg:block">{walletDetails}</div>
        <button
          aria-label="Disconnect wallet"
          className="flex size-7 items-center justify-center rounded-md text-white/45 transition hover:bg-white/5 hover:text-white"
          onClick={() => disconnect()}
          title="Disconnect wallet"
          type="button"
        >
          <LogOut className="size-3.5" />
        </button>
      </div>

      <div className="absolute right-0 top-full mt-2 w-64 rounded-md border border-white/10 bg-ink px-4 py-3 text-sm shadow-xl lg:hidden">
        {walletDetails}
      </div>
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20 border-b border-white/10 bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:h-20 sm:px-8 lg:px-10">
        <a
          className="flex items-center gap-2.5"
          href="#top"
          aria-label="PitchMarket home"
        >
          <span className="flex size-9 items-center justify-center rounded-md bg-lime text-ink">
            <CircleDot className="size-5" strokeWidth={2.4} />
          </span>
          <span className="text-lg font-bold">PitchMarket</span>
        </a>

        <nav
          className="hidden items-center gap-8 text-sm text-white/65 sm:flex"
          aria-label="Primary navigation"
        >
          {navigation.map((item) => (
            <a
              className="transition-colors hover:text-white"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            className="hidden items-center rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold transition-colors hover:border-lime/50 hover:text-lime xl:flex"
            href="#markets"
          >
            Explore markets
          </a>
          <WalletControl />
          <a
            className="flex size-9 items-center justify-center rounded-md border border-white/15 text-white sm:hidden"
            href="#markets"
            aria-label="Explore markets"
          >
            <Menu className="size-5" />
          </a>
        </div>
      </div>
    </header>
  );
}
