"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { buildClaimLootTransaction } from "@/solana/fizzcaps/client";
import type { LootVoucher } from "@/solana/fizzcaps/types";

export default function ClaimLootButton() {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleClaim() {
    try {
      if (!publicKey) {
        setStatus("Connect wallet first.");
        return;
      }

      setLoading(true);
      setStatus("Requesting voucher from server...");

      const res = await fetch("/api/loot-voucher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Your backend should return a REAL Borsh voucher
          lootId: 1,
        }),
      });

      if (!res.ok) {
        throw new Error(`Voucher request failed: ${await res.text()}`);
      }

      // Backend must return:
      // {
      //   lootId: number | string,
      //   latitude: number,
      //   longitude: number,
      //   timestamp: number | string,
      //   locationHint: string,
      //   serverSignature: number[64],
      //   serverKey: string
      // }
      const raw = await res.json();

      const voucher: LootVoucher = {
        lootId: BigInt(raw.lootId),
        latitude: raw.latitude,
        longitude: raw.longitude,
        timestamp: BigInt(raw.timestamp),
        locationHint: raw.locationHint,
        serverSignature: new Uint8Array(raw.serverSignature),
      };

      const serverKey = new PublicKey(raw.serverKey);

      setStatus("Building transaction...");

      const tx = await buildClaimLootTransaction({
        connection,
        player: publicKey,
        serverKey,
        voucher,
      });

      setStatus("Sending transaction to wallet...");

      const sig = await sendTransaction(tx, connection);

      setStatus(`Sent. Waiting for confirmation... (${sig})`);

      await connection.confirmTransaction(sig, "confirmed");

      setStatus(`Loot claimed! Tx: ${sig}`);
    } catch (err: any) {
      console.error(err);
      setStatus(`Error: ${err.message ?? "Failed to claim loot."}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 20 }}>
      <button
        onClick={handleClaim}
        disabled={loading || !publicKey}
        style={{
          padding: "12px 20px",
          background: loading ? "#040" : "#0f0",
          color: "#000",
          border: "2px solid #0f0",
          cursor: loading || !publicKey ? "not-allowed" : "pointer",
          fontFamily: "monospace",
          opacity: loading || !publicKey ? 0.6 : 1,
        }}
      >
        {publicKey ? (loading ? "Claiming..." : "Claim Loot") : "Connect Wallet"}
      </button>

      {status && (
        <p style={{ marginTop: 10, fontFamily: "monospace" }}>{status}</p>
      )}
    </div>
  );
}
