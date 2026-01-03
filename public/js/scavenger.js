// scavenger.js - Scavenger's Exchange data & helpers
export const trades = [
  {
    id: "trade-001",
    seller: "WastelanderX42",
    wallet: "5fX...aB9",
    offer: "50 Stimpaks + 20 Scrap Metal",
    want: "0.75 FIZZ tokens",
    status: "active",
    posted: new Date("2026-01-01T12:00:00Z"),
    description: "Fresh stimpaks, no rads. Quick trade."
  },
  {
    id: "trade-002",
    seller: "VaultTechSurvivor",
    wallet: "9kP...zQ1",
    offer: "1 Turret Part",
    want: "1.25 FIZZ tokens or 10 Rare Alloy",
    status: "active",
    posted: new Date("2026-01-02T08:15:00Z"),
    description: "Lightly used, open to barter."
  },
  // Add more trades here...
];

// Optional helper function (can be imported)
export function getActiveTrades() {
  return trades.filter(t => t.status === "active");
}

export function addTrade(newTrade) {
  // In real app, this would POST to /api/trades
  const id = `trade-${Date.now()}`;
  trades.push({ id, ...newTrade, status: "active", posted: new Date() });
  console.log("New trade added:", id);
  return id;
}
