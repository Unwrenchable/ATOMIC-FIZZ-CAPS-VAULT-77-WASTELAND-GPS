// backend/lib/xp.js
// ------------------------------------------------------------
// Atomic Fizz Caps – XP Management Library
// ------------------------------------------------------------

const { redis, key } = require('./redis');

// BUG-014 FIX: maximum player level.  Exported so callers in other modules
// (quests.js, location-claim.js) can import instead of hard-coding the value.
const MAX_LEVEL = 100;
const XP_PER_LEVEL = 100;

/**
 * Apply XP gain to a player profile object (in-place mutation).
 * Shared utility used by awardXp(), quests.js, and location-claim.js to ensure
 * consistent level-up behaviour across all code paths (review feedback fix).
 *
 * @param {Object} profile - Player profile object with .xp and .level fields
 * @param {number} amount  - XP to award (must be > 0)
 * @returns {{ leveledUp: boolean }}
 */
function applyXpToProfile(profile, amount) {
  profile.xp = (profile.xp || 0) + amount;
  let leveledUp = false;
  while (profile.xp >= profile.level * XP_PER_LEVEL && profile.level < MAX_LEVEL) {
    profile.xp -= profile.level * XP_PER_LEVEL;
    profile.level++;
    leveledUp = true;
  }
  // Once at max level, stop accumulating banked XP
  if (profile.level >= MAX_LEVEL) profile.xp = 0;
  return { leveledUp };
}

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
      xp: 0,
      caps: 0,
      claimed: [],
      quests: {},
      inventory: []
    };
    applyXpToProfile(newProfile, amount);
    await redis.hset(profileKey, "profile", JSON.stringify(newProfile));
    console.log(`[xp] Created profile for ${player.wallet} with ${amount} XP`);
    return { ok: true, xp: newProfile.xp, level: newProfile.level };
  }

  const profile = JSON.parse(raw);
  const { leveledUp } = applyXpToProfile(profile, amount);

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
  getXp,
  applyXpToProfile,
  MAX_LEVEL,
  XP_PER_LEVEL,
};
