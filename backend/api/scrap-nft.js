// backend/api/scrap-nft.js
// ------------------------------------------------------------
// NFT Scrap API - Convert NFTs to resources/materials
// Deflationary mechanic: removes NFTs from circulation
// ------------------------------------------------------------

const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { redis, key } = require("../lib/redis");
const { authMiddleware } = require("../lib/auth");

const SCRAP_LOG_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

// Rate limiting for scrap operations
const scrapLimiter = require("express-rate-limit")({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 scrap operations per minute
  message: { error: "Too many scrap operations. Please wait." }
});

// Scrap an NFT for resources
router.post("/", authMiddleware, scrapLimiter, async (req, res) => {
  try {
    const { nftMint } = req.body;
    // SECURITY FIX: use wallet from verified session, not from req.body.walletAddress.
    // Previously an authenticated player could specify any wallet and scrap (destroy)
    // another player's NFTs — a classic IDOR exploit.
    const walletAddress = req.player.wallet;

    if (!nftMint || typeof nftMint !== "string" || nftMint.length > 128) {
      return res.status(400).json({
        error: "Missing or invalid nftMint"
      });
    }

    // BUG-048 FIX: use a per-NFT lock key (wallet + mint address) instead of a
    // per-wallet lock.  The original per-wallet lock prevented ALL scrap operations
    // for 15 seconds — even for unrelated NFTs — while only one was in flight.
    // Using wallet+mint as the lock key prevents double-scrap of the same NFT while
    // allowing concurrent scraps of *different* NFTs, eliminating the unnecessary
    // serialization that was causing support tickets.
    const scrapLockKey = key(`scrap:lock:${walletAddress}:${nftMint}`);
    const lock = await redis.set(scrapLockKey, "1", { NX: true, EX: 15 });
    if (!lock) {
      return res.status(409).json({ error: "Scrap already in progress — try again shortly" });
    }

    let scrapValue, nft;
    try {
    // Verify NFT ownership (simplified - in production would check Solana)
    const playerKey = key(`player:${walletAddress}`);
    const playerData = await redis.hget(playerKey, "profile");

    if (!playerData) {
      return res.status(404).json({ error: "Player not found" });
    }

    const player = JSON.parse(playerData);

    // Check if NFT is in player's inventory
    const nftIndex = player.inventory?.findIndex(item =>
      item.mint === nftMint || item.id === nftMint
    );

    if (nftIndex === undefined || nftIndex === -1) {
      return res.status(404).json({ error: "NFT not found in inventory" });
    }

    nft = player.inventory[nftIndex];

    // Calculate scrap value based on NFT rarity and type
    scrapValue = calculateScrapValue(nft);

    // Remove NFT from inventory
    player.inventory.splice(nftIndex, 1);

    // Add scrap resources to player
    // SECURITY FIX: initialise with explicit allowed keys and only write into
    // known rarity slots. Previously `player.scrapResources[rarity]` was
    // written directly using a rarity string taken from stored NFT data —
    // if that string was "__proto__" or "constructor", it would pollute the
    // object prototype (prototype pollution).
    const ALLOWED_RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
    if (!player.scrapResources) {
      player.scrapResources = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, fusionCores: 0 };
    }

    const rarity = (nft.rarity || "common").toLowerCase();
    if (ALLOWED_RARITIES.includes(rarity)) {
      player.scrapResources[rarity] = (player.scrapResources[rarity] || 0) + scrapValue.resources;
    } else {
      // Unknown rarity: treat as common
      player.scrapResources.common = (player.scrapResources.common || 0) + scrapValue.resources;
    }
    player.scrapResources.fusionCores = (player.scrapResources.fusionCores || 0) + scrapValue.fusionCores;

    // Update player caps reward
    player.caps = (player.caps || 0) + scrapValue.caps;

    // Save updated player data
    await redis.hset(playerKey, "profile", JSON.stringify(player));

    // Log the scrap operation.
    // BUG-018 FIX: wrap with key() to match the double-prefix convention used
    // by fuse.js's fusion_log, so both log families live in the same key namespace
    // and admin tooling can scan them consistently.
    const scrapLogKey = key(`scrap_log:${Date.now()}:${crypto.randomBytes(8).toString("hex")}`);
    await redis.set(scrapLogKey, JSON.stringify({
      walletAddress,
      nftMint,
      nftName: nft.name,
      scrapValue,
      timestamp: new Date().toISOString()
    }), { EX: SCRAP_LOG_TTL_SECONDS }); // set with TTL atomically

    res.json({
      ok: true,
      message: `Successfully scrapped ${nft.name || 'NFT'}`,
      scrapValue,
      newResources: player.scrapResources,
      newCaps: player.caps
    });

    } finally {
      await redis.del(scrapLockKey).catch(() => {});
    }

  } catch (error) {
    console.error("[scrap-nft] Error:", error);
    res.status(500).json({ error: "Internal server error during scrap operation" });
  }
});

// Calculate scrap value based on NFT properties
function calculateScrapValue(nft) {
  const rarity = (nft.rarity || 'common').toLowerCase();
  const type = (nft.type || 'weapon').toLowerCase();

  // Base values by rarity
  const baseValues = {
    common: { resources: 10, fusionCores: 1, caps: 5 },
    uncommon: { resources: 25, fusionCores: 2, caps: 15 },
    rare: { resources: 50, fusionCores: 5, caps: 50 },
    epic: { resources: 100, fusionCores: 10, caps: 150 },
    legendary: { resources: 250, fusionCores: 25, caps: 500 }
  };

  const base = baseValues[rarity] || baseValues.common;

  // Modifiers by type
  const typeModifiers = {
    weapon: 1.0,
    armor: 1.2,
    accessory: 0.8,
    consumable: 0.5
  };

  const modifier = typeModifiers[type] || 1.0;

  return {
    resources: Math.floor(base.resources * modifier),
    fusionCores: Math.floor(base.fusionCores * modifier),
    caps: Math.floor(base.caps * modifier),
    rarity,
    type
  };
}

// Get player's scrap resources — own wallet only
router.get("/resources/:walletAddress", authMiddleware, async (req, res) => {
  try {
    const { walletAddress } = req.params;

    // SECURITY FIX: prevent one player from reading another player's resource data.
    if (walletAddress !== req.player.wallet) {
      return res.status(403).json({ error: "Forbidden: can only view your own resources" });
    }

    const playerKey = key(`player:${walletAddress}`);
    const playerData = await redis.hget(playerKey, "profile");

    if (!playerData) {
      return res.status(404).json({ error: "Player not found" });
    }

    const player = JSON.parse(playerData);
    const resources = player.scrapResources || {
      common: 0,
      uncommon: 0,
      rare: 0,
      epic: 0,
      legendary: 0,
      fusionCores: 0
    };

    res.json({ resources });

  } catch (error) {
    console.error("[scrap-nft] Error getting resources:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;