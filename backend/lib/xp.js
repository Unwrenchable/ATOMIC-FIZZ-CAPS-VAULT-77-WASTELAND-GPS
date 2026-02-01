// backend/lib/xp.js
// ------------------------------------------------------------
// Atomic Fizz Caps – XP Management Library
// ------------------------------------------------------------

const { redis, key } = require('./redis');

/**
 * Award XP to a player
 * @param {Object} player - Player object with wallet property
 * @param {number} amount - XP amount to award
 */
async function awardXp(player, amount) {
  if (!player || !player.wallet) {
    throw new Error("missing player");
  }
  if (typeof amount !== "number" || amount <= 0) {
    throw new Error("invalid XP amount");
  }

  const profileKey = key(`player:${player.wallet}`);
  const raw = await redis.hget(profileKey, "profile");
  
  if (!raw) {
    // Create profile if doesn't exist
    const newProfile = {
      name: "WANDERER",
      special: { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 },
      level: 1,
      xp: amount,
      caps: 0,
      claimed: [],
      quests: {},
      inventory: []
    };
    await redis.hset(profileKey, "profile", JSON.stringify(newProfile));
    console.log(`[xp] Created profile for ${player.wallet} with ${amount} XP`);
    return { ok: true, xp: newProfile.xp, level: newProfile.level };
  }

  const profile = JSON.parse(raw);
  profile.xp = (profile.xp || 0) + amount;
  
  // Check for level up (100 XP per level)
  const xpPerLevel = 100;
  let leveledUp = false;
  while (profile.xp >= profile.level * xpPerLevel) {
    profile.xp -= profile.level * xpPerLevel;
    profile.level++;
    leveledUp = true;
  }

  await redis.hset(profileKey, "profile", JSON.stringify(profile));
  
  console.log(`[xp] Awarded ${amount} XP to ${player.wallet}. Total: ${profile.xp}, Level: ${profile.level}`);

  return { ok: true, xp: profile.xp, level: profile.level, leveledUp };
}

/**
 * Get player's current XP and level
 * @param {string} wallet - Player wallet address
 */
async function getXp(wallet) {
  if (!wallet) {
    throw new Error("missing wallet");
  }

  const profileKey = key(`player:${wallet}`);
  const raw = await redis.hget(profileKey, "profile");
  
  if (!raw) {
    return { xp: 0, level: 1 };
  }

  const profile = JSON.parse(raw);
  return { xp: profile.xp || 0, level: profile.level || 1 };
}

module.exports = {
  awardXp,
  getXp
};
