"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function WalletBar() {
  const { publicKey } = useWallet();

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "10px 20px",
        borderBottom: "1px solid #0f0",
        fontFamily: "monospace",
      }}
    >
      <div>Atomic Fizz Caps</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {publicKey && (
          <span style={{ fontSize: 12 }}>
            {publicKey.toBase58().slice(0, 4)}...
            {publicKey.toBase58().slice(-4)}
          </span>
        )}
        <WalletMultiButton />
      </div>
    </div>
  );
}
