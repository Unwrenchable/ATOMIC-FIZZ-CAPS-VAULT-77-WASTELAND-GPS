"use client";

export default function AdminDashboard() {
  return (
    <div>
      <h1>Overseer Dashboard</h1>
      <p style={{ opacity: 0.8 }}>
        Welcome to the Vault‑Tec Overseer Console.  
        Select a tool from the sidebar to begin.
      </p>

      <div style={{ marginTop: "20px" }}>
        <h2>System Status</h2>
        <ul>
          <li>Frontend: Online</li>
          <li>Backend: Connected via NEXT_PUBLIC_BACKEND_URL</li>
          <li>Map Engine: Active</li>
          <li>Pip‑Boy Runtime: Synced</li>
        </ul>
      </div>
    </div>
  );
}
