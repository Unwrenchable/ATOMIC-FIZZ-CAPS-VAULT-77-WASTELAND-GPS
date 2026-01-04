"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

type HealthStatus = {
  backend?: { ok: boolean; status: string } | null;
  error?: string | null;
};

export default function DiagnosticsPage() {
  const [status, setStatus] = useState<HealthStatus>({ backend: null });

  useEffect(() => {
    (async () => {
      try {
        const backend = await api.backendHealth();
        setStatus({ backend, error: null });
      } catch (err: any) {
        setStatus({ backend: null, error: err.message ?? "Failed to reach backend" });
      }
    })();
  }, []);

  return (
    <div
      style={{
        padding: 20,
        fontFamily: "monospace",
        color: "#0f0",
        background: "#020",
        minHeight: "100vh",
      }}
    >
      <h1>SYSTEM DIAGNOSTICS</h1>
      <pre>Vault 77 Overseer Terminal</pre>
      <hr style={{ borderColor: "#0f0", margin: "16px 0" }} />

      <h2>Backend</h2>
      {status.backend ? (
        <pre>{JSON.stringify(status.backend, null, 2)}</pre>
      ) : status.error ? (
        <pre>ERROR: {status.error}</pre>
      ) : (
        <pre>Querying backend...</pre>
      )}
    </div>
  );
}
