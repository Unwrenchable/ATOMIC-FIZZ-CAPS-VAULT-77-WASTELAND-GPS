// game-ui/lib/apiClient.ts
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL!;

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  backendHealth() {
    return request<{ ok: boolean; status: string }>("/api/health");
  },
  currentLoot() {
    return request("/api/loot/current");
  },
  mintCaps(player: string, amount: number) {
    return request("/api/caps/mint", {
      method: "POST",
      body: JSON.stringify({ player, amount }),
    });
  },
  awardXp(player: string, amount: number) {
    return request("/api/xp/award", {
      method: "POST",
      body: JSON.stringify({ player, amount }),
    });
  },
};
