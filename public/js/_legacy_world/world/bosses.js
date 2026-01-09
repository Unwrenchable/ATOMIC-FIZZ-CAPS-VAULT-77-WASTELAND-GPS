// bosses.js
// ------------------------------------------------------------
// Boss Respawn Logic
// ------------------------------------------------------------

function ensureBossState(worldState) {
  if (!worldState.bosses) worldState.bosses = {};
  return worldState.bosses;
}

function bossStatus(worldState, location) {
  const bosses = ensureBossState(worldState);
  const entry = bosses[location.id];

  if (!entry) return { alive: true, respawnAt: null };

  const now = Date.now();
  return {
    alive: now >= entry.respawnAt,
    respawnAt: entry.respawnAt
  };
}

function defeatBoss(worldState, location) {
  const bosses = ensureBossState(worldState);

  const baseRespawn = 1000 * 60 * 30;
  const variance = Math.random() * 1000 * 60 * 15;

  bosses[location.id] = {
    defeatedAt: Date.now(),
    respawnAt: Date.now() + baseRespawn + variance,
    kills: (bosses[location.id]?.kills || 0) + 1
  };

  return bosses[location.id];
}

function rollBossEncounter(worldState, location, weather) {
  if (location.type !== "boss") return null;

  const status = bossStatus(worldState, location);
  if (!status.alive) {
    return {
      type: "boss_absent",
      description: "The boss has been slain recently."
    };
  }

  let levelBoost = 0;
  if (weather?.type === "storm") levelBoost += 2;
  if (weather?.type === "rad_storm") levelBoost += 5;

  return {
    type: "boss",
    boss: {
      id: location.id,
      name: location.name,
      lvl: location.lvl + levelBoost,
      faction: location.faction
    }
  };
}

module.exports = {
  ensureBossState,
  bossStatus,
  defeatBoss,
  rollBossEncounter
};
