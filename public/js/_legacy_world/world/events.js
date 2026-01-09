// events.js
// ------------------------------------------------------------
// Simple Event Hook (Expandable)
// ------------------------------------------------------------

const EVENTS = [
  {
    id: "strange_broadcast",
    conditions: (worldState, location) =>
      location.faction === "fizzco_remnants" && Math.random() < 0.1,
    effect: (worldState, location) => ({
      id: "strange_broadcast",
      description:
        "A garbled pre-war FizzCo broadcast cuts through the static.",
      faction: location.faction
    })
  },
  {
    id: "silent_sky",
    conditions: () => Math.random() < 0.05,
    effect: (worldState, location) => ({
      id: "silent_sky",
      description: "The sky feels heavier here.",
      faction: location.faction
    })
  }
];

function pickEventFor(location, worldState) {
  const candidates = EVENTS.filter(e => e.conditions(worldState, location));
  if (!candidates.length) {
    return {
      id: "ambient_mystery",
      description: "Something about this place lingers in your mind.",
      faction: location.faction
    };
  }
  return candidates[Math.floor(Math.random() * candidates.length)].effect(
    worldState,
    location
  );
}

module.exports = { pickEventFor };
