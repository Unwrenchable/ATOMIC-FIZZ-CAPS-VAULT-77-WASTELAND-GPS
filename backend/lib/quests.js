// backend/lib/quests.js
const redis = require('./redis');

/**
 * Mark a quest as completed for a player.
 */
async function completeQuest(playerId, questId) {
  if (!playerId) throw new Error("Missing playerId");
  if (!questId) throw new Error("Missing questId");

  const key = `player:${playerId}:quests:completed`;
  await redis.sadd(key, questId.toString());

  return { ok: true, questId };
}

/**
 * Mark a quest ending as viewed/unlocked.
 */
async function unlockEnding(playerId, endingId) {
  if (!playerId) throw new Error("Missing playerId");
  if (!endingId) throw new Error("Missing endingId");

  const key = `player:${playerId}:quests:endings`;
  await redis.sadd(key, endingId.toString());

  return { ok: true, endingId };
}

/**
 * Check if a player has completed a quest.
 * BUG FIX: redis.sismember() does not exist in the wrapper; use smembers instead.
 */
async function hasCompleted(playerId, questId) {
  const key = `player:${playerId}:quests:completed`;
  const members = await redis.smembers(key);
  return members.includes(questId.toString()) ? 1 : 0;
}

/**
 * Check if a player has unlocked an ending.
 * BUG FIX: redis.sismember() does not exist in the wrapper; use smembers instead.
 */
async function hasEnding(playerId, endingId) {
  const key = `player:${playerId}:quests:endings`;
  const members = await redis.smembers(key);
  return members.includes(endingId.toString()) ? 1 : 0;
}

/**
 * Choose a quest ending for a player.
 * BUG FIX: This function was imported by backend/api/quest-endings.js but was
 * never defined here, causing the quest-endings endpoint to crash at startup.
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

  // Mark the quest as completed
  await completeQuest(playerId, questId);
  // Record the chosen ending
  await unlockEnding(playerId, endingId);

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
