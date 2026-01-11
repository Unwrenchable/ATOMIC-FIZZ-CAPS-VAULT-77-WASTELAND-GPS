"use client";

import { useEffect, useState } from "react";

export function usePlayerNFTs(wallet: string | null | undefined) {
  const [nfts, setNfts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet) return;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/player-nfts?wallet=${wallet}`;
        const res = await fetch(url);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();

        if (!json.ok) {
          throw new Error(json.error || "Failed to load NFTs");
        }

        setNfts(json.nfts || []);
      } catch (err: any) {
        console.error("usePlayerNFTs error:", err);
        setError(err.message || "Unknown error");
      }

      setLoading(false);
    }

    load();
  }, [wallet]);

  return { nfts, loading, error };
}
 
