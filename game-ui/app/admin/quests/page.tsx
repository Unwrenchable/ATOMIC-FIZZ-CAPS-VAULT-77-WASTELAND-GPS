"use client";

import { useEffect, useState } from "react";

export default function QuestEditor() {
  const [quests, setQuests] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/data/quests.json");
        const json = await res.json();
        setQuests(json || []);
      } catch (e) {
        console.error("Failed to load quests:", e);
      }
    }
    load();
  }, []);

  return (
    <div>
      <h1>Quest Editor</h1>
      <p style={{ opacity: 0.8 }}>
        View quest definitions from <code>quests.json</code>.
      </p>

      <div style={{ marginTop: "20px" }}>
        {quests.map((q) => (
          <div
            key={q.id}
            style={{
              border: "1px solid #333",
              padding: "10px",
              marginBottom: "10px",
              borderRadius: "6px"
            }}
          >
            <strong>{q.name}</strong>
            <div>ID: {q.id}</div>
            <div>Trigger: {JSON.stringify(q.trigger)}</div>
            <div>Rewards: {JSON.stringify(q.rewards)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
