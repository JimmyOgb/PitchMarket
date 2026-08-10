import type { Metadata } from "next";

import { WalletProvider } from "@/components/wallet-provider";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "PitchMarket — Football Predictions",
  description: "Follow football fixtures and explore open prediction markets.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
