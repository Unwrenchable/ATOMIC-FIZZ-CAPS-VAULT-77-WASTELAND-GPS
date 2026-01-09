"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

export function BackendStatus() {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const health = await api.backendHealth();
        if (!cancelled) setOk(health.ok);
      } catch {
        if (!cancelled) setOk(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const text =
    ok === null ? "CHECKING BACKEND..." : ok ? "BACKEND: ONLINE" : "BACKEND: OFFLINE";

  const color = ok === null ? "#aa0" : ok ? "#0f0" : "#f00";

  return (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        right: 8,
        padding: "6px 10px",
        border: `1px solid ${color}`,
        color,
        background: "rgba(0,0,0,0.8)",
        fontFamily: "monospace",
        fontSize: 12,
        zIndex: 9999,
      }}
    >
      {text}
    </div>
  );
}
