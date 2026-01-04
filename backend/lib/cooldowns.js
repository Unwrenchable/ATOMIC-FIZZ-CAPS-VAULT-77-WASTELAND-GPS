// backend/lib/cooldowns.js
const cooldowns = new Map();

exports.checkCooldown = function (player) {
  const now = Date.now();
  const cd = cooldowns.get(player);
  if (!cd) return true;

  const diffSec = (now - cd) / 1000;
  return diffSec >= Number(process.env.LOOT_COOLDOWN_SECONDS || 300);
};

exports.setCooldown = function (player) {
  cooldowns.set(player, Date.now());
};
