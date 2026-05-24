// backend/api/exchange.js
// ------------------------------------------------------------
// Atomic Fizz Caps — Scavenger Exchange API
// Mounted at /api/exchange
//
// Routes:
//   GET    /api/exchange/trades         — List active trades (public)
//   POST   /api/exchange/post-trade     — Post an item trade (auth required)
//   POST   /api/exchange/post-nft/prepare — Build seller NFT escrow tx (auth required)
//   POST   /api/exchange/post-nft/confirm — Confirm seller escrow deposit (auth required)
//   POST   /api/exchange/buy-trade      — Prepare purchase / reserve a trade (auth required)
//   POST   /api/exchange/buy-trade/confirm — Confirm buyer payment + settle NFT (auth required)
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
const { getJSON, setJSON, sadd, srem, smembers, del, multi, key, set, redis } = require("../lib/redis");
const {
  getMarketplaceConfig,
  parseUiAmountToAtomic,
  formatAtomicAmount,
  buildListingEscrowTransaction,
  buildBuyerPaymentTransaction,
  verifyTransferToEscrowSignature,
  settleEscrowedTrade,
  returnEscrowedNftToSeller,
  escrowAccountStillHoldsNft,
} = require("../lib/nft-marketplace");

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
const NFT_DRAFT_TTL = 30 * 60;
const SOLD_TTL = 30 * 24 * 60 * 60;
const PAYMENT_WINDOW_MS = 5 * 60 * 1000;

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

function tradeKey(tradeId) {
  return `exchange:trade:${tradeId}`;
}

function listingSignatureKey(signature) {
  return `exchange:nft-listing-signature:${signature}`;
}

function paymentSignatureKey(signature) {
  return `exchange:nft-payment-signature:${signature}`;
}

function settlementLockKey(tradeId) {
  return `exchange:nft-settlement-lock:${tradeId}`;
}

function normalizeTradeTtlSeconds(trade) {
  const posted = Number(trade.posted || Date.now());
  const durationDays = Math.min(Math.max(Number(trade.durationDays) || 7, 1), MAX_DURATION_DAYS);
  const expiresAt = posted + durationDays * 24 * 60 * 60 * 1000;
  return Math.max(60, Math.ceil((expiresAt - Date.now()) / 1000));
}

async function saveTrade(trade, ttlSeconds) {
  const ttl = Math.max(60, Number(ttlSeconds) || TRADE_TTL_DEFAULT);
  await setJSON(tradeKey(trade.id), trade, { EX: ttl });
  if (trade.status === "active" || trade.status === "payment_pending") {
    await sadd(ACTIVE_SET_KEY, trade.id);
  } else {
    await srem(ACTIVE_SET_KEY, trade.id);
  }
}

async function unlockExpiredPaymentPendingTrade(trade) {
  if (
    trade &&
    trade.type === "nft" &&
    trade.status === "payment_pending" &&
    Number(trade.paymentDeadline || 0) > 0 &&
    Number(trade.paymentDeadline) <= Date.now()
  ) {
    delete trade.paymentDeadline;
    delete trade.reserved_by;
    trade.status = "active";
    await saveTrade(trade, normalizeTradeTtlSeconds(trade));
  }
  return trade;
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
      let trade = await getJSON(tradeKey(id));
      if (!trade) {
        // Expired / missing — clean from set
        stale.push(id);
        continue;
      }
      trade = await unlockExpiredPaymentPendingTrade(trade);
      if (trade.status === "active") {
        trades.push(trade);
      } else if (trade.status !== "payment_pending") {
        stale.push(id);
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
  await saveTrade(trade, ttl);

  console.log(`[exchange] New item trade ${tradeId} by ${wallet.slice(0, 8)}...`);
  return res.json({ ok: true, tradeId });
});

// ------------------------------------------------------------
// POST /post-nft/prepare  (auth required)
// ------------------------------------------------------------
router.post("/post-nft/prepare", authMiddleware, postLimiter, async (req, res) => {
  const wallet = req.player.wallet;
  const { nftMint, priceFizz, description, durationDays } = req.body || {};

  // Validate NFT mint address (Solana base58, 32–44 chars)
  if (!nftMint || typeof nftMint !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(nftMint)) {
    return res.status(400).json({ ok: false, error: "Invalid NFT mint address." });
  }

  const price = parseFloat(priceFizz);
  if (!isFinite(price) || price < MIN_PRICE || price > MAX_PRICE) {
    return res.status(400).json({ ok: false, error: "Invalid FIZZ price." });
  }

  const cleanDesc = sanitizeText(description, MAX_DESCRIPTION_LEN);
  const duration = Math.min(Math.max(parseInt(durationDays, 10) || 7, 1), MAX_DURATION_DAYS);

  try {
    const marketplace = await getMarketplaceConfig();
    const listingTx = await buildListingEscrowTransaction(wallet, nftMint);
    const tradeId = crypto.randomBytes(8).toString("hex");
    const priceAtomic = parseUiAmountToAtomic(priceFizz, marketplace.settlementDecimals);
    const trade = {
      id: tradeId,
      type: "nft",
      offer: `NFT: ${nftMint.slice(0, 8)}...`,
      nftMint,
      priceFizz: formatAtomicAmount(priceAtomic, marketplace.settlementDecimals),
      priceAtomic,
      description: cleanDesc,
      seller: wallet,
      posted: Date.now(),
      durationDays: duration,
      status: "escrow_pending",
      escrowWallet: marketplace.escrowWallet,
      escrowAta: listingTx.escrowAta,
      sellerAta: listingTx.sellerAta,
      escrowPaymentAta: marketplace.escrowPaymentAta,
      settlementMint: marketplace.settlementMint,
      settlementDecimals: marketplace.settlementDecimals,
    };

    await saveTrade(trade, NFT_DRAFT_TTL);

    return res.json({
      ok: true,
      tradeId,
      trade,
      serializedTx: listingTx.serializedTx,
      escrowAta: listingTx.escrowAta,
      escrowWallet: marketplace.escrowWallet,
      settlementMint: marketplace.settlementMint,
    });
  } catch (err) {
    console.error("[exchange] POST /post-nft/prepare error:", err);
    const message =
      err && err.message === "marketplace_settlement_mint_unconfigured"
        ? "Marketplace FIZZ mint is not configured on this server."
        : err && err.message === "mint_signer_unconfigured"
          ? "Marketplace escrow signer is not configured on this server."
        : err && err.message === "token_account_missing"
          ? "Your wallet does not hold that NFT in a ready token account."
          : err && err.message === "insufficient_token_balance"
            ? "That relic is not in your pack anymore."
            : "Could not prepare NFT escrow. The workbench is jammed.";
    return res.status(400).json({ ok: false, error: message });
  }
});

// ------------------------------------------------------------
// POST /post-nft/confirm  (auth required)
// ------------------------------------------------------------
router.post("/post-nft/confirm", authMiddleware, postLimiter, async (req, res) => {
  const wallet = req.player.wallet;
  const { tradeId, escrowSignature } = req.body || {};

  if (!tradeId || typeof tradeId !== "string" || !/^[0-9a-f]{16}$/.test(tradeId)) {
    return res.status(400).json({ ok: false, error: "Invalid tradeId." });
  }
  if (!escrowSignature || typeof escrowSignature !== "string") {
    return res.status(400).json({ ok: false, error: "Escrow transaction signature required." });
  }

  const trade = await getJSON(tradeKey(tradeId));
  if (!trade) {
    return res.status(404).json({ ok: false, error: "Listing draft not found or expired." });
  }
  if (trade.seller !== wallet) {
    return res.status(403).json({ ok: false, error: "You can only confirm your own listing." });
  }
  if (trade.status !== "escrow_pending") {
    return res.status(400).json({ ok: false, error: "This listing is no longer waiting for escrow." });
  }

  try {
    const escrowTransfer = await verifyTransferToEscrowSignature({
      signature: escrowSignature,
      ownerWallet: wallet,
      mintAddress: trade.nftMint,
      destinationAta: trade.escrowAta,
      amountAtomic: "1",
    });
    if (!escrowTransfer.ok) {
      return res.status(400).json({
        ok: false,
        error: "Escrow transfer was not found on-chain. Send the NFT to escrow first.",
        reason: escrowTransfer.reason,
      });
    }

    const claimed = await set(listingSignatureKey(escrowSignature), tradeId, { NX: true, EX: SOLD_TTL });
    if (claimed !== "OK") {
      return res.status(409).json({ ok: false, error: "That escrow signature has already been used." });
    }

    trade.status = "active";
    trade.escrowSignature = escrowSignature;
    trade.posted = Date.now();
    await saveTrade(trade, normalizeTradeTtlSeconds(trade));

    console.log(
      `[exchange] New NFT trade ${tradeId} (mint: ${trade.nftMint.slice(0, 8)}) by ${wallet.slice(0, 8)}...`
    );
    return res.json({ ok: true, tradeId, trade });
  } catch (err) {
    await del(listingSignatureKey(escrowSignature));
    console.error("[exchange] POST /post-nft/confirm error:", err);
    return res.status(500).json({
      ok: false,
      error: "Could not activate that listing. The escrow terminal sparked out.",
    });
  }
});

// ------------------------------------------------------------
// POST /post-nft  (legacy alias)
// ------------------------------------------------------------
router.post("/post-nft", authMiddleware, postLimiter, async (_req, res) => {
  return res.status(410).json({
    ok: false,
    error: "NFT listings now use /api/exchange/post-nft/prepare then /confirm.",
  });
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

  let trade = await getJSON(tradeKey(tradeId));
  if (!trade) {
    return res.status(404).json({ ok: false, error: "Trade not found or expired." });
  }

  trade = await unlockExpiredPaymentPendingTrade(trade);

  if (trade.type === "nft" && trade.status === "payment_pending" && trade.reserved_by && trade.reserved_by !== buyerWallet) {
    return res.status(409).json({ ok: false, error: "Another wastelander is already closing that deal." });
  }

  if (trade.status !== "active" && !(trade.type === "nft" && trade.status === "payment_pending" && trade.reserved_by === buyerWallet)) {
    return res.status(400).json({ ok: false, error: "This trade is no longer active." });
  }

  if (trade.seller === buyerWallet) {
    return res.status(400).json({ ok: false, error: "You cannot buy your own trade." });
  }

  // For item trades, deduct caps atomically
  if (trade.type === "item") {
    // Get buyer profile
    const buyerKey = key(`player:${buyerWallet}`);
    const buyerRaw = await redis.hget(buyerKey, "profile");
    if (!buyerRaw) {
      return res.status(404).json({ ok: false, error: "Buyer profile not found." });
    }
    let buyerData;
    try {
      buyerData = JSON.parse(buyerRaw);
    } catch (err) {
      console.error("[exchange] invalid buyer profile JSON:", err);
      return res.status(500).json({ ok: false, error: "Buyer profile data is corrupted." });
    }
    const buyerCaps = buyerData.caps || 0;
    if (buyerCaps < trade.priceFizz) {
      return res.status(400).json({ ok: false, error: "Insufficient caps." });
    }

    // CRITICAL-002 FIX: Use Redis transaction to deduct caps AND set reserved_by atomically
    const tx = await multi();
    tx.hset(buyerKey, "profile", JSON.stringify({ ...buyerData, caps: buyerCaps - trade.priceFizz }));
    tx.set(key(tradeKey(tradeId)), JSON.stringify({ ...trade, reserved_by: buyerWallet, status: "reserved" }));
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
    try {
      if (!(await escrowAccountStillHoldsNft(trade.escrowAta))) {
        trade.status = "cancelled";
        await saveTrade(trade, 3600);
        return res.status(410).json({
          ok: false,
          error: "That listing no longer has its NFT in escrow.",
        });
      }

      const paymentTx = await buildBuyerPaymentTransaction(buyerWallet, trade.priceAtomic);
      trade.reserved_by = buyerWallet;
      trade.status = "payment_pending";
      trade.paymentDeadline = Date.now() + PAYMENT_WINDOW_MS;
      await saveTrade(trade, normalizeTradeTtlSeconds(trade));

      console.log(`[exchange] NFT Trade ${tradeId} payment prepared for ${buyerWallet.slice(0, 8)}...`);

      return res.json({
        ok: true,
        trade,
        sellerWallet: trade.seller,
        priceFizz: trade.priceFizz,
        priceAtomic: trade.priceAtomic,
        settlementMint: trade.settlementMint,
        settlementDecimals: trade.settlementDecimals,
        escrowPaymentAta: trade.escrowPaymentAta,
        paymentDeadline: trade.paymentDeadline,
        serializedTx: paymentTx.serializedTx,
      });
    } catch (err) {
      console.error("[exchange] POST /buy-trade nft error:", err);
      const message =
        err && err.message === "mint_signer_unconfigured"
          ? "Marketplace escrow signer is not configured on this server."
          : err && err.message === "marketplace_settlement_mint_unconfigured"
            ? "Marketplace FIZZ mint is not configured on this server."
          : err && err.message === "token_account_missing"
          ? "Your wallet does not have a FIZZ token account ready."
          : err && err.message === "insufficient_token_balance"
            ? "You do not have enough FIZZ for that deal."
            : "Could not prepare the Phantom payment. The barter terminal hissed smoke.";
      return res.status(400).json({ ok: false, error: message });
    }
  }
});

// ------------------------------------------------------------
// POST /buy-trade/confirm  (auth required)
// ------------------------------------------------------------
router.post("/buy-trade/confirm", authMiddleware, buyLimiter, async (req, res) => {
  const buyerWallet = req.player.wallet;
  const { tradeId, paymentSignature } = req.body || {};

  if (!tradeId || typeof tradeId !== "string" || !/^[0-9a-f]{16}$/.test(tradeId)) {
    return res.status(400).json({ ok: false, error: "Invalid tradeId." });
  }
  if (!paymentSignature || typeof paymentSignature !== "string") {
    return res.status(400).json({ ok: false, error: "Payment signature required." });
  }

  let trade = await getJSON(tradeKey(tradeId));
  if (!trade) {
    return res.status(404).json({ ok: false, error: "Trade not found or expired." });
  }

  if (trade.type !== "nft") {
    return res.status(400).json({ ok: false, error: "Only NFT trades use on-chain settlement." });
  }

  trade = await unlockExpiredPaymentPendingTrade(trade);
  if (trade.status !== "payment_pending") {
    return res.status(400).json({ ok: false, error: "That listing is not waiting for payment." });
  }
  if (trade.reserved_by !== buyerWallet) {
    return res.status(403).json({ ok: false, error: "This purchase window belongs to another wastelander." });
  }
  if (Number(trade.paymentDeadline || 0) <= Date.now()) {
    await unlockExpiredPaymentPendingTrade(trade);
    return res.status(408).json({ ok: false, error: "That purchase window expired. Start the trade again." });
  }

  const paymentTransfer = await verifyTransferToEscrowSignature({
    signature: paymentSignature,
    ownerWallet: buyerWallet,
    mintAddress: trade.settlementMint,
    destinationAta: trade.escrowPaymentAta,
    amountAtomic: trade.priceAtomic,
  });
  if (!paymentTransfer.ok) {
    return res.status(400).json({
      ok: false,
      error: "On-chain FIZZ payment not found in escrow.",
      reason: paymentTransfer.reason,
    });
  }

  const claimedSignature = await set(paymentSignatureKey(paymentSignature), tradeId, {
    NX: true,
    EX: SOLD_TTL,
  });
  if (claimedSignature !== "OK") {
    return res.status(409).json({ ok: false, error: "That payment signature has already been consumed." });
  }

  const lock = await set(settlementLockKey(tradeId), buyerWallet, { NX: true, EX: 120 });
  if (lock !== "OK") {
    return res.status(409).json({ ok: false, error: "Settlement already in progress for this listing." });
  }

  try {
    const settlement = await settleEscrowedTrade(trade, buyerWallet);
    trade.status = "sold";
    trade.reserved_by = buyerWallet;
    trade.paymentSignature = paymentSignature;
    trade.settlementSignature = settlement.signature;
    trade.soldAt = Date.now();
    delete trade.paymentDeadline;
    await saveTrade(trade, SOLD_TTL);
    await del(settlementLockKey(tradeId));

    return res.json({
      ok: true,
      trade,
      settlementSignature: settlement.signature,
      buyerNftAta: settlement.buyerNftAta,
      sellerPaymentAta: settlement.sellerPaymentAta,
    });
  } catch (err) {
    await del(paymentSignatureKey(paymentSignature));
    await del(settlementLockKey(tradeId));
    console.error("[exchange] POST /buy-trade/confirm error:", err);
    return res.status(500).json({
      ok: false,
      error: "Payment landed, but settlement jammed. Do not re-pay; inspect the trade before trying again.",
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

  let trade = await getJSON(tradeKey(tradeId));
  if (!trade) {
    return res.status(404).json({ ok: false, error: "Trade not found." });
  }

  if (trade.seller !== wallet) {
    return res.status(403).json({ ok: false, error: "You can only cancel your own trades." });
  }

  trade = await unlockExpiredPaymentPendingTrade(trade);

  if (trade.type === "nft" && trade.status === "payment_pending") {
    return res.status(409).json({
      ok: false,
      error: "A buyer is mid-payment on that listing. Wait for the timer to lapse before cancelling.",
    });
  }

  if (trade.status !== "active" && trade.status !== "escrow_pending") {
    return res.status(400).json({ ok: false, error: "Trade is not active." });
  }

  try {
    if (trade.type === "nft") {
      if (await escrowAccountStillHoldsNft(trade.escrowAta)) {
        const cancelTx = await returnEscrowedNftToSeller(trade);
        trade.cancelSignature = cancelTx.signature;
      }
    }

    trade.status = "cancelled";
    trade.cancelledAt = Date.now();
    delete trade.paymentDeadline;
    await saveTrade(trade, 3600);

    return res.json({ ok: true, trade });
  } catch (err) {
    console.error("[exchange] DELETE /cancel/:id error:", err);
    return res.status(500).json({
      ok: false,
      error: "Could not pull that listing out of escrow.",
    });
  }
});

module.exports = router;
