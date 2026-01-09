"use client";

import { WalletBar } from "@/components/WalletBar";
import ClaimLootButton from "@/components/ClaimLootButton";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col">
      <WalletBar />

      <main className="flex flex-col items-center justify-center flex-1 p-10 gap-10">
        <h1 className="text-4xl font-bold tracking-tight text-center">
          Atomic Fizz Caps — Wasteland UI
        </h1>

        <p className="text-zinc-400 max-w-xl text-center">
          Connect your wallet and claim your first piece of loot from Vault 77.
        </p>

        <ClaimLootButton />
      </main>
    </div>
  );
}
