"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";

export default function AdminPage() {
  const { publicKey, connected, signMessage } = useWallet();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function verifyAdmin() {
      if (!connected || !publicKey) return;

      setLoading(true);

      try {
        // 1. Request nonce from backend
        const nonceRes = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin/nonce?wallet=${publicKey.toString()}`
        );
        const { nonce } = await nonceRes.json();

        // 2. Sign nonce
        const encoded = new TextEncoder().encode(nonce);
        const signature = await signMessage(encoded);

        // 3. Verify signature with backend
        const verifyRes = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/admin/verify`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              wallet: publicKey.toString(),
              signature: Array.from(signature),
            }),
          }
        );

        const data = await verifyRes.json();
        setIsAdmin(data.ok === true);
      } catch (err) {
        console.error("Admin verify failed:", err);
        setIsAdmin(false);
      }

      setLoading(false);
    }

    verifyAdmin();
  }, [connected, publicKey, signMessage]);

  if (!connected) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Admin Panel</h1>
        <p>Please connect your wallet to continue.</p>
      </div>
    );
  }

  if (loading || isAdmin === null) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Admin Panel</h1>
        <p>Verifying admin access…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ padding: 40 }}>
        <h1>Access Denied</h1>
        <p>Your wallet is not authorized as an admin.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>Overseer Console</h1>
      <p>Welcome, Overseer. Choose a subsystem to manage.</p>

      <ul style={{ marginTop: 20, fontSize: "1.2rem" }}>
        <li>
          <Link href="/admin/players">Players</Link>
        </li>
        <li>
          <Link href="/admin/economy">Economy</Link>
        </li>
        <li>
          <Link href="/admin/quests">Quests</Link>
        </li>
        <li>
          <Link href="/admin/world">World State</Link>
        </li>
        <li>
          <Link href="/admin/events">Events</Link>
        </li>
      </ul>
    </div>
  );
}
