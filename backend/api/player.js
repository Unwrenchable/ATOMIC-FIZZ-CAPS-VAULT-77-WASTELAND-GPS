// backend/api/player.js
const express = require("express");
const router = express.Router();
const redis = require("../redis");

const DEFAULT_SPECIAL = { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 };

async function loadProfile(wallet) {
  const raw = await redis.hget(`player:${wallet}`, "profile");
  return raw ? JSON.parse(raw) : null;
}

async function saveProfile(wallet, profile) {
  await redis.hset(`player:${wallet}`, "profile", JSON.stringify(profile));
}

router.post("/create", async (req, res) => {
  const { wallet, name } = req.body;
  if (!wallet) return res.status(400).json({ ok: false, error: "wallet required" });

  let profile = await loadProfile(wallet);
  if (profile) return res.json({ ok: true, profile });

  profile = {
    name: name || "WANDERER",
    special: { ...DEFAULT_SPECIAL },
    level: 1,
    xp: 0,
    caps: 0,
    claimed: [],
    quests: {},
    unlockedTerminal: false,
  };

  await saveProfile(wallet, profile);
  res.json({ ok: true, profile });
});

router.get("/:wallet", async (req, res) => {
  const profile = await loadProfile(req.params.wallet);
  if (!profile) return res.status(404).json({ ok: false, error: "not found" });
  res.json({ ok: true, profile });
});

router.post("/special/update", async (req, res) => {
  const { wallet, special } = req.body;
  if (!wallet || !special)
    return res.status(400).json({ ok: false, error: "wallet + special required" });

  const profile = await loadProfile(wallet);
  if (!profile) return res.status(404).json({ ok: false, error: "not found" });

  profile.special = special;
  await saveProfile(wallet, profile);

  res.json({ ok: true, profile });
});

router.post("/terminal/unlock", async (req, res) => {
  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ ok: false, error: "wallet required" });

  const profile = await loadProfile(wallet);
  if (!profile) return res.status(404).json({ ok: false, error: "not found" });

  profile.unlockedTerminal = true;
  await saveProfile(wallet, profile);

  res.json({ ok: true, profile });
});

router.post("/respec", async (req, res) => {
  const { wallet } = req.body;
  if (!wallet) return res.status(400).json({ ok: false, error: "wallet required" });

  const profile = await loadProfile(wallet);
  if (!profile) return res.status(404).json({ ok: false, error: "not found" });

  // TODO: real NFT check
  const ownsToken = false;

  if (!ownsToken) {
    return res.status(403).json({ ok: false, error: "no recalibration token" });
  }

  // TODO: burn NFT here

  profile.special = { ...DEFAULT_SPECIAL };
  await saveProfile(wallet, profile);

  res.json({ ok: true, profile });
});

module.exports = router;
