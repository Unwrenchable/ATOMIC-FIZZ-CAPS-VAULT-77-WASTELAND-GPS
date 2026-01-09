// reputation.js
// ------------------------------------------------------------
// Faction Reputation System
// ------------------------------------------------------------

const ALL_FACTIONS = [
  "fizzco_remnants",
  "iron_wastes_militia",
  "radborne_tribes",
  "crater_syndicate",
  "hollow_choir",
  "the_circuit",
  "dustwalkers",
  "deepwatch",
  "free_scavs",
  "feral_broods"
];

function ensureReputation(worldState) {
  if (!worldState.reputation) worldState.reputation = {};
  for (const f of ALL_FACTIONS) {
    if (typeof worldState.reputation[f] !== "number") {
      worldState.reputation[f] = 0;
    }
  }
  return worldState.reputation;
}

function adjustReputation(worldState, faction, delta) {
  ensureReputation(worldState);
  worldState.reputation[faction] =
    (worldState.reputation[faction] ?? 0) + delta;

  worldState.reputation[faction] = Math.max(
    -200,
    Math.min(200, worldState.reputation[faction])
  );

  return worldState.reputation[faction];
}

function getReputation(worldState, faction) {
  ensureReputation(worldState);
  return worldState.reputation[faction] ?? 0;
}

function reputationStatus(worldState, faction) {
  const value = getReputation(worldState, faction);
  if (value <= -100) return "nemesis";
  if (value <= -50) return "hostile";
  if (value < 0) return "unfriendly";
  if (value < 50) return "neutral";
  if (value < 100) return "friendly";
  return "allied";
}

module.exports = {
  ensureReputation,
  adjustReputation,
  getReputation,
  reputationStatus
};
