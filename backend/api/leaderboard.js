// backend/api/leaderboard.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Global Leaderboard API
// Mounted at /api/leaderboard
// ------------------------------------------------------------

const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const { redis, key } = require("../lib/redis");

// How long to keep the leaderboard snapshot in Redis (seconds).
// The expensive SCAN + N×hget rebuild only runs at most once per this interval.
const LEADERBOARD_TTL = 60;

// Cache key (bare, no manual prefix — the redis wrapper adds the prefix)
const SNAPSHOT_KEY = "leaderboard:snapshot";

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
// Returns top 10 players for each category.
// Result is cached in Redis for LEADERBOARD_TTL seconds so the
// O(N-players) SCAN only runs on a cache miss (~once per minute).
// ------------------------------------------------------------
router.get("/", leaderboardLimiter, async (req, res) => {
  try {
    // ---- Fast path: return cached snapshot ----
    const cached = await redis.get(SNAPSHOT_KEY);
    if (cached) {
      let parsed;
      try { parsed = JSON.parse(cached); } catch (_) { /* fall through to rebuild */ }
      if (parsed) return res.json({ ok: true, leaderboard: parsed });
    }

    // ---- Slow path: rebuild from Redis SCAN ----
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
            // battleWins may live in a dedicated hash field (written by battles.js
            // via HINCRBY) — prefer that over the value embedded in the profile JSON
            // so the two sources stay in sync.
            const battleWinsField = await redis.hget(playerKey, "battleWins");
            let battleWins;
            if (battleWinsField !== null) {
              const parsed = parseInt(battleWinsField, 10);
              battleWins = isNaN(parsed) ? (profile.battleWins || 0) : parsed;
            } else {
              battleWins = profile.battleWins || 0;
            }
            players.push({
              wallet: truncateWallet(wallet),
              name: profile.name || "WANDERER",
              caps: profile.caps || 0,
              questsCompleted: (profile.quests && Array.isArray(profile.quests.completed)) ? profile.quests.completed.length : 0,
              poisClaimed: (profile.claimed && Array.isArray(profile.claimed)) ? profile.claimed.length : 0,
              battleWins,
            });
          }
        } catch (err) {
          console.error("[leaderboard] Error processing player:", playerKey, err);
        }
      }
    } while (cursor !== "0");

    // Sort and get top 10 for each category (slice() clones the array so each
    // sort operates on a fresh copy and doesn't corrupt subsequent ones)
    const leaderboard = {
      caps: players.slice().sort((a, b) => b.caps - a.caps).slice(0, 10),
      questsCompleted: players.slice().sort((a, b) => b.questsCompleted - a.questsCompleted).slice(0, 10),
      poisClaimed: players.slice().sort((a, b) => b.poisClaimed - a.poisClaimed).slice(0, 10),
      battleWins: players.slice().sort((a, b) => b.battleWins - a.battleWins).slice(0, 10),
    };

    // Cache the result so subsequent requests skip the SCAN
    try {
      await redis.set(SNAPSHOT_KEY, JSON.stringify(leaderboard), { EX: LEADERBOARD_TTL });
    } catch (cacheErr) {
      console.warn("[leaderboard] Failed to cache snapshot:", cacheErr && cacheErr.message);
    }

    return res.json({ ok: true, leaderboard });
  } catch (err) {
    console.error("[leaderboard] error:", err);
    return res.status(500).json({ ok: false, error: "Failed to fetch leaderboard" });
  }
});

module.exports = router;