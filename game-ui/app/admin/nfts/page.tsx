"use client";

import { useState } from "react";
import NFTGrid from "@/components/NFTGrid";
import { usePlayerNFTs } from "@/hooks/usePlayerNFTs";

export default function AdminNFTPage() {
  const [wallet, setWallet] = useState("");
  const [submittedWallet, setSubmittedWallet] = useState<string | null>(null);

  const { nfts, loading, error } = usePlayerNFTs(submittedWallet || undefined);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!wallet.trim()) return;
    setSubmittedWallet(wallet.trim());
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1 style={{ marginBottom: "10px" }}>Admin NFT Viewer</h1>
      <p style={{ opacity: 0.8, marginBottom: "20px" }}>
        Enter any Solana wallet to view its NFTs (via your backend).
      </p>

      <form onSubmit={handleSubmit} style={{ marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Enter wallet address"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            fontSize: "14px",
            border: "1px solid #ccc",
            borderRadius: "6px",
            marginBottom: "10px"
          }}
        />
        <button
          type="submit"
          style={{
            padding: "10px 16px",
            fontSize: "14px",
            background: "#0a0",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer"
          }}
        >
          Load NFTs
        </button>
      </form>

      {loading && <p>Loading NFTs…</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {submittedWallet && !loading && !error && (
        <>
          <h2 style={{ marginTop: "20px" }}>
            NFTs for {submittedWallet.slice(0, 4)}…{submittedWallet.slice(-4)}
          </h2>
          <NFTGrid nfts={nfts} />
        </>
      )}
    </div>
  );
}
