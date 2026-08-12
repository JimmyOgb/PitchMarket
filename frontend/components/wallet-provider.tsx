"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createConfig, http, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors/injected";
import { studionet } from "genlayer-js/chains";
import { useReconnect } from "wagmi";

const wagmiConfig = createConfig({
  chains: [studionet],
  connectors: [injected()],
  ssr: true,
  transports: {
    [studionet.id]: http("/api/genlayer-rpc"),
  },
});

type WalletProviderProps = {
  children: React.ReactNode;
};

export function WalletProvider({ children }: WalletProviderProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <WalletReconnect />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function WalletReconnect() {
  const { reconnect } = useReconnect();

  useEffect(() => {
    void reconnect();
  }, [reconnect]);

  return null;
}
