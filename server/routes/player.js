const express = require("express");
const router = express.Router();

/**
 * Expects a Redis client passed in from server.js:
 *   const playerRoutes = require('./routes/player')(redisClient);
 */
module.exports = function (redisClient) {
  // Helpers
  const DEFAULT_SPECIAL = { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 };

  function makeNewProfile(wallet, name) {
    return {
      name: name || "Vault Dweller",
      special: { ...DEFAULT_SPECIAL },
      level: 1,
      xp: 0,
      caps: 0,
      claimed: [],
      quests: {},
      unlockedTerminal: false,
    };
  }

  async function getProfile(wallet) {
    const raw = await redisClient.hGet(`player:${wallet}`, "profile");
    if (!raw) return null;
    return JSON.parse(raw);
  }

  async function saveProfile(wallet, profile) {
    await redisClient.hSet(`player:${wallet}`, "profile", JSON.stringify(profile));
  }

  // POST /player/create
  router.post("/create", async (req, res) => {
    try {
      const { wallet, name } = req.body;
      if (!wallet) return res.status(400).json({ error: "wallet required" });

      const existing = await getProfile(wallet);
      if (existing) return res.json({ ok: true, profile: existing });

      const profile = makeNewProfile(wallet, name);
      await saveProfile(wallet, profile);

      res.json({ ok: true, profile });
    } catch (err) {
      console.error("create player error", err);
      res.status(500).json({ error: "server error" });
    }
  });

  // GET /player/:wallet
  router.get("/:wallet", async (req, res) => {
    try {
      const { wallet } = req.params;
      const profile = await getProfile(wallet);
      if (!profile) return res.status(404).json({ error: "not found" });
      res.json({ ok: true, profile });
    } catch (err) {
      console.error("get player error", err);
      res.status(500).json({ error: "server error" });
    }
  });

  // POST /player/special/update
  router.post("/special/update", async (req, res) => {
    try {
      const { wallet, special } = req.body;
      if (!wallet || !special) {
        return res.status(400).json({ error: "wallet and special required" });
      }

      const profile = await getProfile(wallet);
      if (!profile) return res.status(404).json({ error: "not found" });

      // Basic validation: all 7 stats present & integers
      const keys = ["S","P","E","C","I","A","L"];
      for (const k of keys) {
        if (typeof special[k] !== "number") {
          return res.status(400).json({ error: `invalid SPECIAL.${k}` });
        }
      }

      profile.special = special;
      await saveProfile(wallet, profile);
      res.json({ ok: true, profile });
    } catch (err) {
      console.error("special update error", err);
      res.status(500).json({ error: "server error" });
    }
  });

  // POST /player/respec — burns token + resets SPECIAL
  router.post("/respec", async (req, res) => {
    try {
      const { wallet } = req.body;
      if (!wallet) return res.status(400).json({ error: "wallet required" });

      const profile = await getProfile(wallet);
      if (!profile) return res.status(404).json({ error: "not found" });

      // 1) Check they own a Recalibration Token NFT
      const hasToken = await ownsRecalibrationToken(wallet);
      if (!hasToken) {
        return res.status(403).json({ error: "no recalibration token" });
      }

      // 2) Burn the token (on-chain)
      const burned = await burnRecalibrationToken(wallet);
      if (!burned) {
        return res.status(500).json({ error: "burn failed" });
      }

      // 3) Reset SPECIAL
      profile.special = { ...DEFAULT_SPECIAL };
      await saveProfile(wallet, profile);

      res.json({ ok: true, profile });
    } catch (err) {
      console.error("respec error", err);
      res.status(500).json({ error: "server error" });
    }
  });

  // STUBS: wire these to your on-chain code
  async function ownsRecalibrationToken(wallet) {
    // TODO: check chain for Vault‑Tec Recalibration Token NFT
    return false;
  }

  async function burnRecalibrationToken(wallet) {
    // TODO: burn 1 token and confirm
    return false;
  }

  return router;
};
