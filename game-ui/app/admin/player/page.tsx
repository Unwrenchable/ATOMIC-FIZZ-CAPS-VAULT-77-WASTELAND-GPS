"use client";

import { useState } from "react";
import NFTGrid from "@/components/NFTGrid";
import { usePlayerNFTs } from "@/hooks/usePlayerNFTs";

export default function PlayerInspector() {
  const [wallet, setWallet] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);

  const { nfts, loading } = usePlayerNFTs(submitted || undefined);

  return (
    <div>
      <h1>Player Inspector</h1>
      <p style={{ opacity: 0.8 }}>
        Inspect player stats, inventory, and NFTs.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(wallet.trim());
        }}
        style={{ marginTop: "20px" }}
      >
        <input
          type="text"
          placeholder="Wallet address"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "10px",
            borderRadius: "6px",
            border: "1px solid #333"
          }}
        />
        <button
          type="submit"
          style={{
            padding: "10px 16px",
            background: "#00ff99",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer"
          }}
        >
          Inspect Player
        </button>
      </form>

      {submitted && (
        <>
          <h2 style={{ marginTop: "30px" }}>
            NFTs for {submitted.slice(0, 4)}…{submitted.slice(-4)}
          </h2>
          {loading ? <p>Loading NFTs…</p> : <NFTGrid nfts={nfts} />}
        </>
      )}
    </div>
  );
}
