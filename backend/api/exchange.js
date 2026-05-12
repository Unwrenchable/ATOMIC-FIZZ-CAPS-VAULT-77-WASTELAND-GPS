// backend/api/exchange.js
// ------------------------------------------------------------
// Atomic Fizz Caps — Scavenger Exchange API
// Mounted at /api/exchange
//
// Routes:
//   GET    /api/exchange/trades         — List active trades (public)
//   POST   /api/exchange/post-trade     — Post an item trade (auth required)
//   POST   /api/exchange/post-nft       — Post an NFT listing (auth required)
//   POST   /api/exchange/buy-trade      — Reserve a trade (auth required)
//   DELETE /api/exchange/cancel/:id     — Cancel own trade (auth required)
//
// Trades are stored per-item in Redis at exchange:trade:<id> with TTL,
// and the active set is tracked via exchange:active-ids (Redis set).
// Falls back to scavenger.json seed data when no live trades exist.
// ------------------------------------------------------------

const express = require("express");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const { authMiddleware } = require("../lib/auth");
const { getJSON, setJSON, sadd, srem, smembers, del, multi, key } = require("../lib/redis");

// ------------------------------------------------------------
// Constants
// ------------------------------------------------------------
const TRADE_TTL_DEFAULT = 7 * 24 * 60 * 60; // 7 days (seconds)
const MAX_DURATION_DAYS = 30;
const MIN_PRICE = 0.000001;
const MAX_PRICE = 1_000_000;
const MAX_DESCRIPTION_LEN = 500;
const MAX_OFFER_LEN = 200;
const ACTIVE_SET_KEY = "exchange:active-ids"; // Redis Set of active trade IDs

// ------------------------------------------------------------
// Rate limiters
// ------------------------------------------------------------
const postLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { ok: false, error: "Too many trade posts — slow down, wastelander." },
  standardHeaders: true,
  legacyHeaders: false,
});

const buyLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: 10,
  message: { ok: false, error: "Too many buy requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

/** HTML-encode special characters to prevent stored XSS while preserving the original text. */
function sanitizeText(str, maxLen) {
  if (!str || typeof str !== "string") return "";
  return str
    .slice(0, maxLen)
    .trim()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Load seed listings from scavenger.json (shown when Redis has no live trades). */
function loadSeedTrades() {
  try {
    const seedPath = path.join(__dirname, "..", "..", "public", "data", "scavenger.json");
    const raw = fs.readFileSync(seedPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Convert a scavenger.json entry to the exchange trade shape. */
function seedToTrade(s) {
  return {
    id: s.id,
    type: s.tokenUri ? "nft" : "item",
    offer: s.title || "Unknown item",
    nftMint: s.tokenUri || null,
    priceFizz: s.priceCAPS || 0,
    description: s.description || "",
    seller: s.owner || "Wasteland",
    posted: s.timestamp ? new Date(s.timestamp).getTime() : Date.now(),
    durationDays: 7,
    status: "active",
    seed: true,
  };
}

// ------------------------------------------------------------
// GET /trades  (public — no auth needed)
// ------------------------------------------------------------
router.get("/trades", async (req, res) => {
  try {
    const ids = await smembers(ACTIVE_SET_KEY) || [];
    const trades = [];
    const stale = [];

    for (const id of ids) {
      const trade = await getJSON(`exchange:trade:${id}`);
      if (!trade) {
        // Expired / missing — clean from set
        stale.push(id);
        continue;
      }
      if (trade.status === "active") {
        trades.push(trade);
      }
    }

    // Clean stale IDs (best-effort, non-blocking)
    for (const id of stale) {
      srem(ACTIVE_SET_KEY, id).catch(() => {});
    }

    // Sort newest-first
    trades.sort((a, b) => b.posted - a.posted);

    // Fall back to seed data when Redis has no live trades
    if (trades.length === 0) {
      const seed = loadSeedTrades()
        .filter((t) => t.status === "listed" || t.status === "active")
        .map(seedToTrade);
      return res.json(seed);
    }

    return res.json(trades);
  } catch (err) {
    console.error("[exchange] GET /trades error:", err);
    return res.status(500).json({ error: "Failed to load trades from the exchange." });
  }
});

// ------------------------------------------------------------
// POST /post-trade  (auth required)
// ------------------------------------------------------------
router.post("/post-trade", authMiddleware, postLimiter, async (req, res) => {
  const wallet = req.player.wallet;
  const { offer, priceFizz, description, durationDays } = req.body || {};

  const cleanOffer = sanitizeText(offer, MAX_OFFER_LEN);
  if (!cleanOffer) {
    return res.status(400).json({ ok: false, error: "Offer item required." });
  }

  const price = parseFloat(priceFizz);
  if (!isFinite(price) || price < MIN_PRICE || price > MAX_PRICE) {
    return res.status(400).json({ ok: false, error: "Invalid FIZZ price." });
  }

  const duration = Math.min(Math.max(parseInt(durationDays) || 3, 1), MAX_DURATION_DAYS);
  const cleanDesc = sanitizeText(description, MAX_DESCRIPTION_LEN);

  const tradeId = crypto.randomBytes(8).toString("hex");
  const trade = {
    id: tradeId,
    type: "item",
    offer: cleanOffer,
    nftMint: null,
    priceFizz: price,
    description: cleanDesc,
    seller: wallet,
    posted: Date.now(),
    durationDays: duration,
    status: "active",
  };

  const ttl = duration * 24 * 60 * 60;
  await setJSON(`exchange:trade:${tradeId}`, trade, { EX: ttl });
  await sadd(ACTIVE_SET_KEY, tradeId);

  console.log(`[exchange] New item trade ${tradeId} by ${wallet.slice(0, 8)}...`);
  return res.json({ ok: true, tradeId });
});

// ------------------------------------------------------------
// POST /post-nft  (auth required)
// ------------------------------------------------------------
router.post("/post-nft", authMiddleware, postLimiter, async (req, res) => {
  const wallet = req.player.wallet;
  const { nftMint, priceFizz, description, signature } = req.body || {};

  // Validate NFT mint address (Solana base58, 32–44 chars)
  if (!nftMint || typeof nftMint !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(nftMint)) {
    return res.status(400).json({ ok: false, error: "Invalid NFT mint address." });
  }

  const price = parseFloat(priceFizz);
  if (!isFinite(price) || price < MIN_PRICE || price > MAX_PRICE) {
    return res.status(400).json({ ok: false, error: "Invalid FIZZ price." });
  }

  if (!signature || typeof signature !== "string") {
    return res.status(400).json({ ok: false, error: "Signature required to list NFT." });
  }

  const cleanDesc = sanitizeText(description, MAX_DESCRIPTION_LEN);

  const tradeId = crypto.randomBytes(8).toString("hex");
  const trade = {
    id: tradeId,
    type: "nft",
    offer: `NFT: ${nftMint.slice(0, 8)}...`,
    nftMint,
    priceFizz: price,
    description: cleanDesc,
    seller: wallet,
    posted: Date.now(),
    durationDays: 7,
    status: "active",
  };

  await setJSON(`exchange:trade:${tradeId}`, trade, { EX: TRADE_TTL_DEFAULT });
  await sadd(ACTIVE_SET_KEY, tradeId);

  console.log(`[exchange] New NFT trade ${tradeId} (mint: ${nftMint.slice(0, 8)}) by ${wallet.slice(0, 8)}...`);
  return res.json({ ok: true, tradeId });
});

// ------------------------------------------------------------
// POST /buy-trade  (auth required)
// ------------------------------------------------------------
router.post("/buy-trade", authMiddleware, buyLimiter, async (req, res) => {
  const buyerWallet = req.player.wallet;
  const { tradeId } = req.body || {};

  if (!tradeId || typeof tradeId !== "string" || !/^[0-9a-f]{16}$/.test(tradeId)) {
    return res.status(400).json({ ok: false, error: "Invalid tradeId." });
  }

  const trade = await getJSON(`exchange:trade:${tradeId}`);
  if (!trade) {
    return res.status(404).json({ ok: false, error: "Trade not found or expired." });
  }

  if (trade.status !== "active") {
    return res.status(400).json({ ok: false, error: "This trade is no longer active." });
  }

  if (trade.seller === buyerWallet) {
    return res.status(400).json({ ok: false, error: "You cannot buy your own trade." });
  }

  // For item trades, deduct caps atomically
  if (trade.type === "item") {
    // Get buyer profile
    const buyerKey = key(`player:${buyerWallet}`);
    const buyerData = await getJSON(buyerKey);
    if (!buyerData) {
      return res.status(404).json({ ok: false, error: "Buyer profile not found." });
    }
    const buyerCaps = buyerData.caps || 0;
    if (buyerCaps < trade.priceFizz) {
      return res.status(400).json({ ok: false, error: "Insufficient caps." });
    }

    // CRITICAL-002 FIX: Use Redis transaction to deduct caps AND set reserved_by atomically
    const tx = await multi();
    tx.hset(buyerKey, "profile", JSON.stringify({ ...buyerData, caps: buyerCaps - trade.priceFizz }));
    tx.set(key(`exchange:trade:${tradeId}`), JSON.stringify({ ...trade, reserved_by: buyerWallet, status: "reserved" }));
    tx.expire(key(`exchange:trade:${tradeId}`), 30 * 24 * 60 * 60);
    const results = await tx.exec();

    if (!results || results.some(r => r === null || r instanceof Error)) {
      return res.status(500).json({ ok: false, error: "Failed to reserve trade atomically." });
    }

    await srem(ACTIVE_SET_KEY, tradeId);

    console.log(`[exchange] Trade ${tradeId} reserved by ${buyerWallet.slice(0, 8)}...`);

    return res.json({
      ok: true,
      trade: { ...trade, reserved_by: buyerWallet, status: "reserved" },
      message: "Trade reserved. Caps deducted.",
      sellerWallet: trade.seller,
      priceFizz: trade.priceFizz,
    });
  } else {
    // For NFT trades, just reserve (payment handled client-side)
    trade.reserved_by = buyerWallet;
    trade.status = "reserved";
    await setJSON(`exchange:trade:${tradeId}`, trade, { EX: 30 * 24 * 60 * 60 });
    await srem(ACTIVE_SET_KEY, tradeId);

    console.log(`[exchange] NFT Trade ${tradeId} reserved by ${buyerWallet.slice(0, 8)}...`);

    return res.json({
      ok: true,
      trade,
      message: "NFT trade reserved. Send FIZZ payment to the seller via Phantom wallet.",
      sellerWallet: trade.seller,
      priceFizz: trade.priceFizz,
    });
  }
});

// ------------------------------------------------------------
// DELETE /cancel/:id  (auth required — seller only)
// ------------------------------------------------------------
router.delete("/cancel/:id", authMiddleware, async (req, res) => {
  const wallet = req.player.wallet;
  const tradeId = req.params.id;

  if (!/^[0-9a-f]{16}$/.test(tradeId)) {
    return res.status(400).json({ ok: false, error: "Invalid tradeId." });
  }

  const trade = await getJSON(`exchange:trade:${tradeId}`);
  if (!trade) {
    return res.status(404).json({ ok: false, error: "Trade not found." });
  }

  if (trade.seller !== wallet) {
    return res.status(403).json({ ok: false, error: "You can only cancel your own trades." });
  }

  if (trade.status !== "active") {
    return res.status(400).json({ ok: false, error: "Trade is not active." });
  }

  trade.status = "cancelled";
  await setJSON(`exchange:trade:${tradeId}`, trade, { EX: 3600 }); // keep 1 hr then expire
  await srem(ACTIVE_SET_KEY, tradeId);

  return res.json({ ok: true });
});

module.exports = router;
