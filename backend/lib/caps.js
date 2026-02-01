// backend/lib/caps.js
// ------------------------------------------------------------
// Atomic Fizz Caps – IN-GAME Caps Management Library
// ------------------------------------------------------------
// 
// ⚠️ IMPORTANT DISTINCTION:
// 
// This module manages IN-GAME CAPS (virtual game currency for tracking
// gameplay progress, rewards, and achievements). This is SERVER-SIDE
// bookkeeping, NOT actual cryptocurrency operations.
// 
// ═══════════════════════════════════════════════════════════════
// ACTUAL AFC TOKEN ON SOLANA MAINNET:
// ═══════════════════════════════════════════════════════════════
// - FIXED SUPPLY: All tokens pre-minted at launch
// - NO MINTING: No additional tokens will EVER be created
// - TREASURY WALLET: Holds the entire supply and distributes
// - DISTRIBUTION: Treasury SENDS tokens to players (not minting)
// 
// See: backend/api/fizz-fun.js for actual token operations
// Env vars: TREASURY_WALLET, CAPS_MINT, TOKEN_MINT
// ═══════════════════════════════════════════════════════════════
//
// IN-GAME CAPS (this module) are used for:
// - Quest rewards (complete quest → earn in-game caps)
// - Battle victories (defeat enemy → earn in-game caps)
// - Location discoveries (find POI → earn in-game caps)
// - NPC trading (buy/sell with NPCs)
// 
// Players can later claim REAL tokens from treasury based on their
// in-game caps balance through proper distribution mechanics
// (airdrops, claims, redemptions, etc.)
// ------------------------------------------------------------

const { redis, key } = require("./redis");

// Maximum in-game caps a player can hold (overflow protection)
const MAX_CAPS = 999_999_999;

// Default caps for new players
const DEFAULT_CAPS = 0;

/**
 * Get player's current in-game caps balance
 * @param {string} wallet - Player wallet address
 * @returns {Promise<number>} Current in-game caps balance
 */
async function getCapsBalance(wallet) {
  if (!wallet || typeof wallet !== "string") {
    throw new Error("Invalid wallet address");
  }

  try {
    const profileRaw = await redis.hget(key(`player:${wallet}`), "profile");
    if (!profileRaw) {
      return DEFAULT_CAPS;
    }
    const profile = JSON.parse(profileRaw);
    return typeof profile.caps === "number" ? profile.caps : DEFAULT_CAPS;
  } catch (err) {
    console.error("[caps] getCapsBalance error:", err);
    throw new Error("Failed to get caps balance");
  }
}

/**
 * Award in-game caps to a player (add to their balance)
 * 
 * NOTE: This is NOT token minting. This awards virtual in-game currency
 * for gameplay rewards. The actual AFC token has a fixed supply.
 * 
 * @param {string} wallet - Player wallet address  
 * @param {number} amount - Amount of in-game caps to award
 * @returns {Promise<{ok: boolean, newBalance: number, txId: string}>}
 */
async function awardCapsToPlayer(wallet, amount) {
  if (!wallet || typeof wallet !== "string" || wallet.length > 128) {
    throw new Error("Invalid wallet address");
  }

  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid caps amount");
  }

  // Cap the amount to prevent overflow
  const safeAmount = Math.min(amount, MAX_CAPS);

  try {
    const profileKey = key(`player:${wallet}`);
    const profileRaw = await redis.hget(profileKey, "profile");
    
    let profile;
    if (!profileRaw) {
      // Create new player profile if doesn't exist
      profile = {
        name: "WANDERER",
        special: { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 },
        level: 1,
        xp: 0,
        caps: 0,
        claimed: [],
        quests: {},
        inventory: []
      };
    } else {
      profile = JSON.parse(profileRaw);
    }

    // Add in-game caps (with overflow protection)
    const currentCaps = typeof profile.caps === "number" ? profile.caps : 0;
    profile.caps = Math.min(currentCaps + safeAmount, MAX_CAPS);

    // Save updated profile
    await redis.hset(profileKey, "profile", JSON.stringify(profile));

    // Generate a transaction ID for audit tracking
    // This is an internal reference for server-side auditing, not a blockchain signature
    const crypto = require("crypto");
    const txId = crypto.randomBytes(16).toString("hex");

    // Log the transaction for audit purposes
    const txKey = key(`caps:tx:${txId}`);
    await redis.set(txKey, JSON.stringify({
      wallet,
      amount: safeAmount,
      type: "award", // Changed from "mint" to "award" - these are in-game rewards
      timestamp: Date.now(),
      newBalance: profile.caps
    }), { EX: 30 * 24 * 60 * 60 }); // 30 day expiry

    console.log(`[caps] Awarded ${safeAmount} in-game caps to ${wallet}. New balance: ${profile.caps}`);

    return {
      ok: true,
      newBalance: profile.caps,
      txId
    };
  } catch (err) {
    console.error("[caps] awardCapsToPlayer error:", err);
    throw new Error("Failed to award caps");
  }
}

/**
 * Transfer in-game caps between players
 * @param {string} fromWallet - Sender wallet address
 * @param {string} toWallet - Recipient wallet address
 * @param {number} amount - Amount to transfer
 * @returns {Promise<{ok: boolean, fromBalance: number, toBalance: number}>}
 */
async function transferCaps(fromWallet, toWallet, amount) {
  if (!fromWallet || !toWallet || typeof fromWallet !== "string" || typeof toWallet !== "string") {
    throw new Error("Invalid wallet addresses");
  }

  if (fromWallet === toWallet) {
    throw new Error("Cannot transfer to self");
  }

  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid transfer amount");
  }

  try {
    // Get sender balance
    const fromBalance = await getCapsBalance(fromWallet);
    if (fromBalance < amount) {
      throw new Error("Insufficient caps");
    }

    // Deduct from sender
    const fromProfileKey = key(`player:${fromWallet}`);
    const fromProfileRaw = await redis.hget(fromProfileKey, "profile");
    const fromProfile = fromProfileRaw ? JSON.parse(fromProfileRaw) : { caps: 0 };
    fromProfile.caps = Math.max(0, (fromProfile.caps || 0) - amount);
    await redis.hset(fromProfileKey, "profile", JSON.stringify(fromProfile));

    // Add to recipient
    const toProfileKey = key(`player:${toWallet}`);
    const toProfileRaw = await redis.hget(toProfileKey, "profile");
    let toProfile;
    if (!toProfileRaw) {
      toProfile = {
        name: "WANDERER",
        special: { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 },
        level: 1,
        xp: 0,
        caps: 0,
        claimed: [],
        quests: {},
        inventory: []
      };
    } else {
      toProfile = JSON.parse(toProfileRaw);
    }
    toProfile.caps = Math.min((toProfile.caps || 0) + amount, MAX_CAPS);
    await redis.hset(toProfileKey, "profile", JSON.stringify(toProfile));

    console.log(`[caps] Transferred ${amount} in-game caps from ${fromWallet} to ${toWallet}`);

    return {
      ok: true,
      fromBalance: fromProfile.caps,
      toBalance: toProfile.caps
    };
  } catch (err) {
    console.error("[caps] transferCaps error:", err);
    throw err;
  }
}

// Legacy alias for backward compatibility
// TODO: Update all callers to use awardCapsToPlayer instead
const mintCapsToPlayer = awardCapsToPlayer;

module.exports = {
  getCapsBalance,
  awardCapsToPlayer,
  mintCapsToPlayer, // Legacy alias - use awardCapsToPlayer for new code
  transferCaps,
  MAX_CAPS,
  DEFAULT_CAPS
};
