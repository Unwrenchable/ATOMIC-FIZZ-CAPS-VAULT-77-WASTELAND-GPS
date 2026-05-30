"use strict";

const crypto = require("crypto");
const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");

const { authMiddleware } = require("../lib/auth");
const { redis, key } = require("../lib/redis");
const { awardXp } = require("../lib/xp");
const {
  hasMintSigner,
  normalizeLocationHint,
  selectMintable,
} = require("../lib/nft-minting");
const {
  isCapsRewardsConfigured,
  transferCapsTokens,
} = require("../lib/solana-rewards");
const { planSurvivalReward } = require("../realai/survival-reward");

const VALID_ENCOUNTER_TYPES = [
  "radiation_storm",
  "nuke_zone",
  "combat",
  "dungeon_escape",
  "hazard_zone",
];
const EVENT_TTL_SECONDS = 30 * 24 * 3600;

const eventLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8,
  message: { ok: false, error: "Too many survival events. Let the dust settle." },
  standardHeaders: true,
  legacyHeaders: false,
});

const validators = [
  body("eventId")
    .isString()
    .trim()
    .isLength({ min: 4, max: 128 })
    .matches(/^[a-zA-Z0-9_-]+$/),
  body("encounterType").isString().trim().isIn(VALID_ENCOUNTER_TYPES),
  body("dryRun").optional().isBoolean().toBoolean(),
  body("requestNft").optional().isBoolean().toBoolean(),
  body("requestedMintableId").optional().isString().trim().isLength({ min: 1, max: 80 }),
  body("context").optional().isObject(),
  body("context.location").optional().isString().trim().isLength({ min: 1, max: 120 }),
  body("context.notes").optional().isString().trim().isLength({ min: 1, max: 240 }),
  body("context.sessionId")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 128 })
    .matches(/^[a-zA-Z0-9_-]+$/),
];

async function enqueueMintJob(job) {
  const queueListKey = "mint:queue:list";
  const queueListRedisKey = key(queueListKey);
  const streamKey = key("mint:queue:stream");
  const encoded = JSON.stringify(job);

  try {
    if (redis && redis.client && typeof redis.client.sendCommand === "function") {
      await redis.client.sendCommand(["XADD", streamKey, "*", "data", encoded]);
      return;
    }
  } catch (error) {
    console.warn("[player-survived] XADD failed, falling back to list queue:", error.message);
  }

  try {
    if (redis && redis.client && typeof redis.client.lPush === "function") {
      await redis.client.lPush(queueListRedisKey, encoded);
      return;
    }
  } catch (error) {
    console.warn("[player-survived] LPUSH failed, falling back to JSON list:", error.message);
  }

  const existing = (await redis.get(queueListKey)) || "[]";
  const list = JSON.parse(existing);
  list.unshift(job);
  await redis.set(queueListKey, JSON.stringify(list));
}

async function queueRewardNft(wallet, item, locationHint, eventId, encounterType, loreSeed) {
  const jobId = crypto.randomBytes(12).toString("hex");
  const auditKey = `mint:audit:${jobId}`;
  const audit = {
    jobId,
    wallet,
    item,
    itemId: item.id,
    locationHint,
    status: "queued",
    createdAt: Date.now(),
    requestedBy: wallet,
    survivalEventId: eventId,
    encounterType,
    loreSeed,
  };
  const job = {
    type: "mint",
    jobId,
    wallet,
    item,
    itemId: item.id,
    mintableId: item.id,
    locationHint,
    auditKey,
  };

  await redis.set(auditKey, JSON.stringify(audit), { EX: 7 * 24 * 3600 });
  await enqueueMintJob(job);

  return {
    ok: true,
    queued: true,
    jobId,
    item,
    statusUrl: `/api/mint-item/status/${jobId}`,
  };
}

function buildNarration(wallet, encounterType, plan, capsTransfer, nftReward, nftError) {
  const shortWallet = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
  const encounterLabel = encounterType.replace(/_/g, " ");
  const lines = [
    `VAULT-77 LOG // ${new Date().toISOString()}`,
    `SUBJECT: ${shortWallet}`,
    `EVENT: ${encounterLabel}`,
    `ASSESSMENT: ${plan.loreSeed}`,
    `DISPENSING: ${plan.capsAmount} CAPS${capsTransfer && capsTransfer.signature ? ` // TX ${capsTransfer.signature}` : ""}`,
  ];

  if (plan.issueNft && nftReward && nftReward.queued) {
    lines.push(`ARTIFACT: ${nftReward.item.name} queued // ${nftReward.jobId}`);
  } else if (plan.issueNft && nftError) {
    lines.push(`ARTIFACT: queue jammed // ${nftError}`);
  } else {
    lines.push("ARTIFACT: none issued");
  }

  lines.push("STATUS: The wastes remember. FIZZ ON.");
  return lines.join("\n");
}

router.post("/", authMiddleware, eventLimiter, validators, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ ok: false, error: "Invalid survival event payload.", details: errors.array() });
  }

  const wallet = req.player.wallet;
  const bodyData = req.body || {};
  const eventId = bodyData.eventId;
  const encounterType = bodyData.encounterType;
  const dryRun = Boolean(bodyData.dryRun);
  const requestNft = bodyData.requestNft !== false;
  const requestedMintableId = bodyData.requestedMintableId || null;
  const context = bodyData.context && typeof bodyData.context === "object" ? bodyData.context : {};
  const claimKey = `realai:survival:${wallet}:${eventId}`;

  if (requestedMintableId) {
    try {
      selectMintable(requestedMintableId);
    } catch {
      return res.status(400).json({ ok: false, error: "Requested reward artifact is invalid." });
    }
  }

  try {
    const claimed = await redis.set(claimKey, JSON.stringify({ status: "processing", createdAt: Date.now() }), {
      NX: true,
      EX: EVENT_TTL_SECONDS,
    });

    if (claimed === null) {
      return res.status(409).json({
        ok: false,
        error: "That survival event was already processed.",
        alreadyClaimed: true,
      });
    }

    const locationHint = normalizeLocationHint(context.location);
    const plan = await planSurvivalReward({
      wallet,
      encounterType,
      context,
      requestNft,
      requestedMintableId,
    });

    if (dryRun) {
      const narration = buildNarration(wallet, encounterType, plan, null, null, null);
      await redis.set(
        claimKey,
        JSON.stringify({ status: "dry_run", plan, processedAt: Date.now() }),
        { EX: EVENT_TTL_SECONDS }
      );
      return res.json({ ok: true, dryRun: true, eventId, plan, narration });
    }

    if (!isCapsRewardsConfigured()) {
      await redis.del(claimKey).catch(() => {});
      return res.status(503).json({
        ok: false,
        error: "CAPS treasury offline. The dispenser is jammed.",
      });
    }

    const capsTransfer = await transferCapsTokens(wallet, plan.capsAmount);

    let xpResult = null;
    try {
      xpResult = await awardXp(req.player, plan.xpAmount);
    } catch (error) {
      console.error("[player-survived] xp award error:", error);
    }

    let nftReward = null;
    let nftError = null;
    if (plan.issueNft) {
      if (!hasMintSigner()) {
        nftError = "mint_signer_unavailable";
      } else {
        try {
          const item = selectMintable(plan.mintableId || requestedMintableId || null);
          nftReward = await queueRewardNft(
            wallet,
            item,
            locationHint,
            eventId,
            encounterType,
            plan.loreSeed
          );
        } catch (error) {
          nftError = error && error.message ? error.message : "nft_queue_failed";
          console.error("[player-survived] nft queue error:", error);
        }
      }
    }

    const narration = buildNarration(wallet, encounterType, plan, capsTransfer, nftReward, nftError);
    await redis.set(
      claimKey,
      JSON.stringify({
        status: "completed",
        processedAt: Date.now(),
        plan,
        capsTransfer,
        xpResult,
        nftReward,
        nftError,
      }),
      { EX: EVENT_TTL_SECONDS }
    );

    return res.json({
      ok: true,
      eventId,
      plan,
      capsTransfer,
      xpAwarded: plan.xpAmount,
      leveledUp: xpResult && xpResult.leveledUp === true,
      nft: nftReward || (plan.issueNft ? { ok: false, queued: false, error: nftError } : null),
      narration,
    });
  } catch (error) {
    console.error("[player-survived] error:", error);
    await redis.del(claimKey).catch(() => {});
    return res.status(500).json({
      ok: false,
      error: "Survival event processing failed. The vault printer coughed up sparks.",
    });
  }
});

module.exports = router;