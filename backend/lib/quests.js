// backend/lib/quests.js
const { redis, key } = require('./redis');

/**
 * Mark a quest as completed for a player.
 * Writes to the Redis Set used by quest-endings tracking.
 */
async function completeQuest(playerId, questId) {
  if (!playerId) throw new Error("Missing playerId");
  if (!questId) throw new Error("Missing questId");

  const setKey = `player:${playerId}:quests:completed`;
  await redis.sadd(setKey, questId.toString());

  return { ok: true, questId };
}

/**
 * Mark a quest ending as viewed/unlocked.
 */
async function unlockEnding(playerId, endingId) {
  if (!playerId) throw new Error("Missing playerId");
  if (!endingId) throw new Error("Missing endingId");

  const k = `player:${playerId}:quests:endings`;
  await redis.sadd(k, endingId.toString());

  return { ok: true, endingId };
}

/**
 * Check if a player has completed a quest.
 * BUG FIX: redis.sismember() does not exist in the wrapper; use smembers instead.
 */
async function hasCompleted(playerId, questId) {
  const k = `player:${playerId}:quests:completed`;
  const members = await redis.smembers(k);
  return members.includes(questId.toString()) ? 1 : 0;
}

/**
 * Check if a player has unlocked an ending.
 * BUG FIX: redis.sismember() does not exist in the wrapper; use smembers instead.
 */
async function hasEnding(playerId, endingId) {
  const k = `player:${playerId}:quests:endings`;
  const members = await redis.smembers(k);
  return members.includes(endingId.toString()) ? 1 : 0;
}

/**
 * Choose a quest ending for a player.
 * BUG-004 FIX: Previously this function only wrote to Redis Sets, leaving
 * the player profile hash's quests.active array un-updated. This allowed
 * double-completion: a player could choose an ending (marking quest done in
 * the set) and then call /api/quests/complete again (quest still "active" in
 * the profile) to collect full rewards a second time.
 *
 * Fix: also update the player profile hash to move the quest from active
 * to completed, keeping both state stores in sync.
 *
 * @param {string} playerId
 * @param {string} questId
 * @param {string} endingId
 * @returns {Promise<{ok: boolean, questId: string, endingId: string}>}
 */
async function chooseEnding(playerId, questId, endingId) {
  if (!playerId) throw new Error("Missing playerId");
  if (!questId) throw new Error("Missing questId");
  if (!endingId) throw new Error("Missing endingId");

  // Mark the quest as completed in the Redis Set
  await completeQuest(playerId, questId);
  // Record the chosen ending
  await unlockEnding(playerId, endingId);

  // BUG-004 FIX: also sync the player profile hash so the quest is removed
  // from quests.active and added to quests.completed in the profile.
  try {
    const profileKey = key(`player:${playerId}`);
    const raw = await redis.hget(profileKey, "profile");
    if (raw) {
      const profile = JSON.parse(raw);
      if (!profile.quests || typeof profile.quests !== "object") profile.quests = {};
      if (!Array.isArray(profile.quests.active)) profile.quests.active = [];
      if (!Array.isArray(profile.quests.completed)) profile.quests.completed = [];

      if (profile.quests.active.includes(questId)) {
        profile.quests.active = profile.quests.active.filter(q => q !== questId);
        profile.quests.completed.push(questId);
        profile.quests.completedAt = profile.quests.completedAt || {};
        profile.quests.completedAt[questId] = Date.now();
        await redis.hset(profileKey, "profile", JSON.stringify(profile));
      }
    }
  } catch (profileErr) {
    // Log but don't fail — the Redis Set was already updated above
    console.error(`[quests] chooseEnding: failed to sync player profile for ${playerId}:`, profileErr.message);
  }

  console.log(`[quests] ${playerId.slice(0, 8)} chose ending ${endingId} for quest ${questId}`);

  return { ok: true, questId, endingId };
}

module.exports = {
  completeQuest,
  unlockEnding,
  hasCompleted,
  hasEnding,
  chooseEnding,
};
