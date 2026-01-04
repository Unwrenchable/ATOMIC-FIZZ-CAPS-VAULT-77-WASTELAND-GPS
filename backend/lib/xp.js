// backend/lib/xp.js
// Simple XP curve placeholder
exports.awardXp = function (player, amount) {
  const newLevel = Math.floor(amount / 100);
  return {
    player,
    amount,
    newLevel,
  };
};
