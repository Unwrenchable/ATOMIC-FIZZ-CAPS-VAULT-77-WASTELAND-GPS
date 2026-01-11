"use client";

import { useEffect, useState } from "react";

export default function MintablesManager() {
  const [mintables, setMintables] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/data/mintables.json");
        const json = await res.json();
        setMintables(json || []);
      } catch (e) {
        console.error("Failed to load mintables:", e);
      }
    }
    load();
  }, []);

  return (
    <div>
      <h1>Mintables Manager</h1>
      <p style={{ opacity: 0.8 }}>
        View all mintable items defined in <code>mintables.json</code>.
      </p>

      <div style={{ marginTop: "20px" }}>
        {mintables.map((m) => (
          <div
            key={m.id}
            style={{
              border: "1px solid #333",
              padding: "10px",
              marginBottom: "10px",
              borderRadius: "6px"
            }}
          >
            <strong>{m.name}</strong>
            <div>ID: {m.id}</div>
            <div>Rarity: {m.rarity}</div>
            <div>Description: {m.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
