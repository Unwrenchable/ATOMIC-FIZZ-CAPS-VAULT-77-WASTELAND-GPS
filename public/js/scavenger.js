// public/js/scavenger.js
// Scavenger's Exchange data & helpers (global version)

window.ScavengerTrades = [
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
  }
];

window.getActiveTrades = function () {
  return (window.ScavengerTrades || []).filter(
    (t) => t.status === "active"
  );
};

window.addTrade = function (newTrade) {
  const id = `trade-${Date.now()}`;
  window.ScavengerTrades.push({
    id,
    ...newTrade,
    status: "active",
    posted: new Date()
  });
  console.log("New trade added:", id);
  return id;
};
