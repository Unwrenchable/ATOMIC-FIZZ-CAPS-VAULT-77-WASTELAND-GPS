"use client";

import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { buildAndPrepareClaimLootTx } from "@/solana/fizzcaps/client";
import { LootVoucher } from "@/solana/fizzcaps/types";

export default function ClaimLootButton() {
  const { connection } = useConnection();
  const wallet = useWallet();

  async function handleClaimLoot() {
    if (!wallet.publicKey) {
      console.error("Wallet not connected");
      return;
    }

    // Fetch signed voucher + serverKey from your backend
    const { voucher, serverKey } = await fetch("/api/loot-voucher").then(r =>
      r.json()
    );

    const tx = await buildAndPrepareClaimLootTx({
      connection,
      player: wallet.publicKey,
      serverKey: new PublicKey(serverKey),
      voucher: voucher as LootVoucher,
    });

    const sig = await wallet.sendTransaction(tx, connection);
    console.log("Loot claimed:", sig);
  }

  return (
    <button
      onClick={handleClaimLoot}
      className="px-4 py-2 bg-green-600 text-white rounded"
    >
      Claim Loot
    </button>
  );
}
