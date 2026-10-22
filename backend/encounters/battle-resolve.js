// backend/encounters/battle-resolve.js
// /battle/resolve flow with atomic one-shot claim and serialized profile credit.
// Takes the redis wrapper as a dependency so tests can drive it with a fake store.
"use strict";

const R = require("./battle-rewards");

const LOCK_TTL_SEC = 5;
const LOCK_RETRIES = 40;
const LOCK_WAIT_MS = 25;
const MAX_CAPS_BALANCE = 999999999;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// SET NX lock around the profile JSON read-modify-write. The profile lives in a
// single JSON hash field, so HINCRBY can't touch xp/caps inside it; the lock
// makes concurrent battle credits serialize instead of overwriting each other.
async function withProfileLock(redis, wallet, fn) {
  const lockKey = `lock:profile:${wallet}`;
  const token = `${process.pid}:${Date.now()}:${Math.random()}`;
  for (let i = 0; i < LOCK_RETRIES; i++) {
    const got = await redis.set(lockKey, token, { NX: true, EX: LOCK_TTL_SEC });
    if (got) {
      try {
        return await fn();
      } finally {
        if ((await redis.get(lockKey)) === token) await redis.del(lockKey);
      }
    }
    await sleep(LOCK_WAIT_MS);
  }
  throw new Error("profile busy");
}

// Returns { status, body } for the route to send.
async function resolveBattle({ redis, key, getJSON, setJSON }, { wallet, battleId, result, turns, now }) {
  if (!/^[a-f0-9]{24}$/.test(battleId)) return { status: 400, body: { ok: false, error: "bad battleId" } };
  const battle = await getJSON(`battle:${battleId}`);
  const verdict = R.checkResolve(battle, { wallet, result, turns, now });
  if (!verdict.ok) return { status: verdict.error === "unknown battle" ? 404 : 409, body: { ok: false, error: verdict.error } };

  // One-shot atomic claim: only the first request to SET NX wins; any concurrent
  // or replayed resolve sees null and is refused before anything is credited.
  const claimed = await redis.set(`battle:${battleId}:claim`, wallet, { NX: true, EX: R.LIMITS.TTL_SEC });
  if (!claimed) return { status: 409, body: { ok: false, error: "already resolved" } };
  battle.resolved = true;
  await setJSON(`battle:${battleId}`, battle, { EX: R.LIMITS.TTL_SEC });

  const day = new Date(now).toISOString().slice(0, 10);
  const dailyKey = key(`battle:wins:${wallet}:${day}`);
  const wins = await redis.incr(dailyKey);
  if (wins === 1) await redis.expire(dailyKey, 26 * 3600);
  const rewards = wins > R.LIMITS.DAILY_WINS ? { xp: 0, caps: 0, items: [], capped: true } : battle.approved;

  const playerKey = key(`player:${wallet}`);
  if (rewards.xp || rewards.caps) {
    await withProfileLock(redis, wallet, async () => {
      const raw = await redis.hget(playerKey, "profile");
      if (!raw) return;
      const profile = JSON.parse(raw);
      profile.xp = (profile.xp || 0) + rewards.xp;
      profile.caps = Math.min(MAX_CAPS_BALANCE, (profile.caps || 0) + rewards.caps);
      await redis.hset(playerKey, "profile", JSON.stringify(profile));
    });
  }
  await redis.hincrby(playerKey, "battleWins", 1);
  return { status: 200, body: { ok: true, rewards } };
}

module.exports = { resolveBattle, withProfileLock };
