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
 */
async function hasCompleted(playerId, questId) {
  const key = `player:${playerId}:quests:completed`;
  return await redis.sismember(key, questId.toString());
}

/**
 * Check if a player has unlocked an ending.
 */
async function hasEnding(playerId, endingId) {
  const key = `player:${playerId}:quests:endings`;
  return await redis.sismember(key, endingId.toString());
}

module.exports = {
  completeQuest,
  unlockEnding,
  hasCompleted,
  hasEnding
};
