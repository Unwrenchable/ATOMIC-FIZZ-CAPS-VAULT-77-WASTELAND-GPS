// backend/api/leaderboard.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Global Leaderboard API
// Mounted at /api/leaderboard
// ------------------------------------------------------------

const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const { redis, key } = require("../lib/redis");

// ------------------------------------------------------------
// Per-route limiter (leaderboard is read-heavy but cached)
// ------------------------------------------------------------
const leaderboardLimiter = rateLimit({
  windowMs: 30 * 1000,
  max: 10,
  message: { ok: false, error: "Too many leaderboard requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper: Truncate wallet for privacy (first 4 + last 4 chars)
function truncateWallet(wallet) {
  if (!wallet || wallet.length <= 8) return wallet;
  return wallet.slice(0, 4) + "..." + wallet.slice(-4);
}

// ------------------------------------------------------------
// GET /api/leaderboard
// Returns top 10 players for each category
// ------------------------------------------------------------
router.get("/", leaderboardLimiter, async (req, res) => {
  try {
    const players = [];

    // Scan all player keys (pattern: afw:player:*)
    let cursor = 0;
    do {
      const scanResult = await redis.scan(cursor, "MATCH", key("player:*"), "COUNT", 100);
      cursor = scanResult[0];
      const keys = scanResult[1];

      // Fetch profiles for this batch
      for (const playerKey of keys) {
        try {
          const profileRaw = await redis.hget(playerKey, "profile");
          if (profileRaw) {
            const profile = JSON.parse(profileRaw);
            // Extract wallet from key: afw:player:<wallet>
            const wallet = playerKey.replace(key("player:"), "");
            players.push({
              wallet: truncateWallet(wallet),
              name: profile.name || "WANDERER",
              caps: profile.caps || 0,
              questsCompleted: (profile.quests && Array.isArray(profile.quests.completed)) ? profile.quests.completed.length : 0,
              poisClaimed: (profile.claimed && Array.isArray(profile.claimed)) ? profile.claimed.length : 0,
              battleWins: profile.battleWins || 0,
            });
          }
        } catch (err) {
          console.error("[leaderboard] Error processing player:", playerKey, err);
        }
      }
    } while (cursor !== "0");

    // Sort and get top 10 for each category
    const leaderboard = {
      caps: players.sort((a, b) => b.caps - a.caps).slice(0, 10),
      questsCompleted: players.sort((a, b) => b.questsCompleted - a.questsCompleted).slice(0, 10),
      poisClaimed: players.sort((a, b) => b.poisClaimed - a.poisClaimed).slice(0, 10),
      battleWins: players.sort((a, b) => b.battleWins - a.battleWins).slice(0, 10),
    };

    return res.json({ ok: true, leaderboard });
  } catch (err) {
    console.error("[leaderboard] error:", err);
    return res.status(500).json({ ok: false, error: "Failed to fetch leaderboard" });
  }
});

module.exports = router;