"use client";

import { useEffect, useState } from "react";

export default function SystemDebug() {
  const [backendStatus, setBackendStatus] = useState("Checking…");
  const [backendVersion, setBackendVersion] = useState("Unknown");
  const [rpcStatus, setRpcStatus] = useState("Checking…");
  const [nftStatus, setNftStatus] = useState("Checking…");
  const [walletStatus, setWalletStatus] = useState("Checking…");
  const [pipboyStatus, setPipboyStatus] = useState("Checking…");
  const [overseerStatus, setOverseerStatus] = useState("Checking…");

  const backend = process.env.NEXT_PUBLIC_BACKEND_URL;

  useEffect(() => {
    async function runDiagnostics() {
      // Backend health
      try {
        const res = await fetch(`${backend}/api/health`);
        setBackendStatus(res.ok ? "Online" : "Offline");
      } catch {
        setBackendStatus("Offline");
      }

      // Backend version
      try {
        const res = await fetch(`${backend}/api/version`);
        const json = await res.json();
        setBackendVersion(json.version || "Unknown");
      } catch {
        setBackendVersion("Unavailable");
      }

      // Solana RPC
      try {
        const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC;
        const res = await fetch(rpc, { method: "POST", body: "{}" });
        setRpcStatus(res.ok ? "Reachable" : "Unreachable");
      } catch {
        setRpcStatus("Unreachable");
      }

      // NFT endpoint
      try {
        const res = await fetch(`${backend}/api/player-nfts?wallet=test`);
        setNftStatus(res.ok ? "OK" : "Error");
      } catch {
        setNftStatus("Error");
      }

      // Wallet adapter
      if (typeof window !== "undefined") {
        if (window.solana && window.solana.isPhantom) {
          setWalletStatus("Phantom Detected");
        } else {
          setWalletStatus("No Wallet Detected");
        }
      }

      // Pip‑Boy runtime
      if (typeof window !== "undefined") {
        if (window.__pipboy) {
          setPipboyStatus("Loaded");
        } else {
          setPipboyStatus("Not Loaded");
        }
      }

      // Overseer runtime
      if (typeof window !== "undefined") {
        if (window.Overseer) {
          setOverseerStatus("Loaded");
        } else {
          setOverseerStatus("Not Loaded");
        }
      }
    }

    runDiagnostics();
  }, [backend]);

  return (
    <div>
      <h1>System Debug</h1>

      <h2>Backend</h2>
      <ul>
        <li>Status: {backendStatus}</li>
        <li>Version: {backendVersion}</li>
        <li>URL: {backend}</li>
      </ul>

      <h2>Solana</h2>
      <ul>
        <li>RPC: {rpcStatus}</li>
        <li>Wallet Adapter: {walletStatus}</li>
      </ul>

      <h2>Game Runtime</h2>
      <ul>
        <li>Pip‑Boy Runtime: {pipboyStatus}</li>
        <li>Overseer Runtime: {overseerStatus}</li>
      </ul>

      <h2>Endpoints</h2>
      <ul>
        <li>NFT Endpoint: {nftStatus}</li>
      </ul>

      <h2>Environment</h2>
      <pre style={{ background: "#111", padding: "10px" }}>
        {JSON.stringify(
          {
            NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
            NEXT_PUBLIC_SOLANA_RPC: process.env.NEXT_PUBLIC_SOLANA_RPC,
            NEXT_PUBLIC_TOKEN_MINT: process.env.NEXT_PUBLIC_TOKEN_MINT
          },
          null,
          2
        )}
      </pre>
    </div>
  );
}
