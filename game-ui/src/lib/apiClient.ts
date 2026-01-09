export const api = {
  mint: async () => {
    const res = await fetch("/api/mint", { method: "POST" });
    if (!res.ok) throw new Error("Mint failed");
    return res.json();
  },

  health: async () => {
    const res = await fetch("/api/health");
    if (!res.ok) throw new Error("Health check failed");
    return res.json();
  },

  backendHealth: async () => {
    const res = await fetch("/api/health");
    if (!res.ok) throw new Error("Backend health check failed");
    return res.json();
  },

  locations: async () => {
    const res = await fetch("/api/locations");
    if (!res.ok) throw new Error("Locations failed");
    return res.json();
  },

  quests: async () => {
    const res = await fetch("/api/quests");
    if (!res.ok) throw new Error("Quests failed");
    return res.json();
  },
};

