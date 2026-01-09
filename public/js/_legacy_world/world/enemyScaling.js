// enemyScaling.js
// ------------------------------------------------------------
// Enemy Level Scaling + Elite Variants + Mutations
// ------------------------------------------------------------

function scaleEnemyLevels(baseEnemies, locationLevel, weather, repStatus) {
  const scaled = [];

  for (const enemy of baseEnemies.list) {
    let lvl = randomInRange(baseEnemies.minLevel, baseEnemies.maxLevel);

    // Weather buffs
    if (weather?.type === "storm") lvl += 1;
    if (weather?.type === "rad_storm") lvl += 3;

    // Nemesis factions hit harder
    if (repStatus === "nemesis") lvl += 2;

    // Elite chance
    const elite = Math.random() < 0.1;
    if (elite) lvl += 4;

    // Mutation chance (rad storm only)
    const mutated = weather?.type === "rad_storm" && Math.random() < 0.25;

    scaled.push({
      id: enemy,
      lvl,
      elite,
      mutated
    });
  }

  return scaled;
}

function randomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  scaleEnemyLevels
};
