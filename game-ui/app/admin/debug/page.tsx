"use client";

import { useEffect, useState } from "react";

export default function SystemDebug() {
  const [backendStatus, setBackendStatus] = useState("Checking…");

  useEffect(() => {
    async function ping() {
      try {
        const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/health`;
        const res = await fetch(url);
        setBackendStatus(res.ok ? "Online" : "Offline");
      } catch {
        setBackendStatus("Offline");
      }
    }
    ping();
  }, []);

  return (
    <div>
      <h1>System Debug</h1>

      <h2>Backend Status</h2>
      <p>{backendStatus}</p>

      <h2>Environment</h2>
      <pre style={{ background: "#111", padding: "10px" }}>
        {JSON.stringify(
          {
            NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL
          },
          null,
          2
        )}
      </pre>
    </div>
  );
}
