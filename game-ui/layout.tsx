import type { Metadata } from "next";
import "./globals.css";
import { WalletContextProvider } from "@/solana/WalletContextProvider";

export const metadata: Metadata = {
  title: "Atomic Fizz Caps",
  description: "Vault 77 Wasteland GPS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WalletContextProvider>{children}</WalletContextProvider>
      </body>
    </html>
  );
}
