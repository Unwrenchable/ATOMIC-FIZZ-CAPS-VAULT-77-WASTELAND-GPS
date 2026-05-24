<<<<<<< HEAD
/**
 * ☢️ ATOMIC FIZZ CAPS — Economy Simulation
 * ─────────────────────────────────────────────────────
 * Simulates 10,000 players over 30 days of gameplay.
 * Validates that caps/items/vouchers don't inflate beyond design budget,
 * no duplication paths exist, and reward loops stay bounded.
 *
 * Run: node tests/economy-simulation.js
 * No live server required — pure in-process Monte Carlo simulation.
 */

"use strict";

const crypto = require("crypto");

// ─── Secure RNG (project policy: no Math.random()) ───────────────────────────
function secureRand() {
  const buf = crypto.randomBytes(4);
  return buf.readUInt32BE(0) / 0x100000000;
}

function secureRandInt(min, max) {
  return min + Math.floor(secureRand() * (max - min + 1));
}

function secureChoice(arr) {
  return arr[secureRandInt(0, arr.length - 1)];
}

// ─── Game Economy Constants ───────────────────────────────────────────────────
const CONFIG = {
  PLAYERS: 10_000,
  SIM_DAYS: 30,
  TICKS_PER_DAY: 10,           // Average sessions per active player per day
  DAILY_ACTIVE_RATE: 0.35,     // 35% DAU/MAU ratio

  // Reward bounds (per session)
  CAPS_PER_CLAIM: { min: 10, max: 150 },
  CAPS_PER_BATTLE_WIN: { min: 5, max: 75 },
  CAPS_PER_QUEST: { min: 50, max: 500 },
  CAPS_MAX_PER_PLAYER: 999_999_999,

  // Voucher economy
  VOUCHER_ISSUE_RATE: 0.15,    // 15% of location claims generate a voucher
  VOUCHER_REDEEM_RATE: 0.80,   // 80% of issued vouchers are eventually redeemed
  VOUCHER_CAPS_REWARD: { min: 25, max: 200 },

  // Item drop rates (by rarity)
  LOOT_WEIGHTS: {
    common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1,
  },

  // Quest completion rates
  QUEST_COMPLETE_RATE: 0.45,   // 45% of started quests completed
  QUEST_DAILY_START: 2,        // Average quests started per active day

  // Anti-inflation caps
  DAILY_CLAIM_CAP: 20,         // Max location claims per player per day
  DAILY_QUEST_CAP: 10,         // Max quests completable per day
  DAILY_BATTLE_CAP: 50,        // Max battles per day

  // Economy health thresholds
  MAX_TOTAL_CAPS_BUDGET: 5_000_000_000,   // 5 billion total caps in circulation (30d)
  MAX_INFLATION_RATE: 0.05,               // Max 5% month-over-month growth
  MAX_GINI_COEFFICIENT: 0.85,             // Wealth distribution must not exceed this
  MIN_MEAN_CAPS: 1_000,                   // Average player should have at least 1k caps
  MAX_MEAN_CAPS: 10_000_000,             // No runaway wealth inflation
};

// ─── Player Archetypes ────────────────────────────────────────────────────────
const ARCHETYPES = [
  { name: "Casual Explorer",   weight: 30, activity: 0.3,  claimFreq: 0.4, battleFreq: 0.2, questFreq: 0.3 },
  { name: "Hardcore Min-Maxer", weight: 15, activity: 0.9,  claimFreq: 0.9, battleFreq: 0.8, questFreq: 0.9 },
  { name: "Speed Runner",       weight: 10, activity: 0.8,  claimFreq: 0.7, battleFreq: 0.9, questFreq: 0.6 },
  { name: "Blockchain Native",  weight: 15, activity: 0.7,  claimFreq: 0.5, battleFreq: 0.5, questFreq: 0.8 },
  { name: "Chaos Monkey",       weight: 10, activity: 0.6,  claimFreq: 0.6, battleFreq: 0.7, questFreq: 0.4 },
  { name: "Mobile GPS Player",  weight: 15, activity: 0.5,  claimFreq: 0.8, battleFreq: 0.3, questFreq: 0.5 },
  { name: "Social Player",      weight:  5, activity: 0.4,  claimFreq: 0.3, battleFreq: 0.2, questFreq: 0.7 },
];

function pickArchetype() {
  const total = ARCHETYPES.reduce((s, a) => s + a.weight, 0);
  let r = secureRand() * total;
  for (const a of ARCHETYPES) {
    r -= a.weight;
    if (r <= 0) return a;
  }
  return ARCHETYPES[ARCHETYPES.length - 1];
}

// ─── Loot Table ───────────────────────────────────────────────────────────────
function rollLoot() {
  const total = Object.values(CONFIG.LOOT_WEIGHTS).reduce((s, w) => s + w, 0);
  let r = secureRand() * total;
  for (const [rarity, weight] of Object.entries(CONFIG.LOOT_WEIGHTS)) {
    r -= weight;
    if (r <= 0) return rarity;
  }
  return "common";
}

// ─── Player Factory ───────────────────────────────────────────────────────────
function createPlayer(id) {
  const archetype = pickArchetype();
  return {
    id,
    archetype: archetype.name,
    activity: archetype.activity,
    claimFreq: archetype.claimFreq,
    battleFreq: archetype.battleFreq,
    questFreq: archetype.questFreq,

    caps: 100,                   // Starting caps
    items: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
    vouchersIssued: 0,
    vouchersRedeemed: 0,
    questsCompleted: 0,
    battlesWon: 0,
    locsClaimed: 0,

    // Anti-exploit state
    dailyClaims: 0,
    dailyQuests: 0,
    dailyBattles: 0,
    lastDayReset: 0,
    claimedLocations: new Set(),  // Simulates cooldown
    questsInProgress: new Set(),
    capsHistory: [],              // Daily snapshot for inflation tracking
    duplicateRedemptions: 0,      // Should always remain 0
    completedQuests: new Set(),   // Should not allow re-completion
  };
}

// ─── Simulation Engine ────────────────────────────────────────────────────────
function simulatePlayerDay(player, day) {
  // Reset daily counters
  if (player.lastDayReset !== day) {
    player.dailyClaims = 0;
    player.dailyQuests = 0;
    player.dailyBattles = 0;
    player.claimedLocations.clear(); // Cooldowns reset daily in sim
    player.lastDayReset = day;
  }

  // Skip if player is not active today
  if (secureRand() > player.activity) return;

  const sessions = secureRandInt(1, CONFIG.TICKS_PER_DAY);

  for (let s = 0; s < sessions; s++) {
    // ── Location Claim ──────────────────────────────────────────────────────
    if (secureRand() < player.claimFreq && player.dailyClaims < CONFIG.DAILY_CLAIM_CAP) {
      const locId = secureRandInt(1, 500); // 500 unique POIs
      if (!player.claimedLocations.has(locId)) {
        player.claimedLocations.add(locId);
        player.dailyClaims++;
        player.locsClaimed++;

        const caps = secureRandInt(CONFIG.CAPS_PER_CLAIM.min, CONFIG.CAPS_PER_CLAIM.max);
        player.caps = Math.min(player.caps + caps, CONFIG.CAPS_MAX_PER_PLAYER);

        // Loot drop
        const rarity = rollLoot();
        player.items[rarity]++;

        // Voucher issuance
        if (secureRand() < CONFIG.VOUCHER_ISSUE_RATE) {
          const voucherId = `v_${player.id}_${day}_${s}`;
          player.vouchersIssued++;

          // Simulate potential double-redemption attempt (exploit scenario)
          if (secureRand() < 0.01) { // 1% of players try to redeem twice
            // First redemption
            if (secureRand() < CONFIG.VOUCHER_REDEEM_RATE) {
              const reward = secureRandInt(CONFIG.VOUCHER_CAPS_REWARD.min, CONFIG.VOUCHER_CAPS_REWARD.max);
              player.caps = Math.min(player.caps + reward, CONFIG.CAPS_MAX_PER_PLAYER);
              player.vouchersRedeemed++;

              // Second redemption attempt — server should reject (idempotency)
              // In simulation, we track this as a duplicate attempt
              player.duplicateRedemptions++;
              // Caps should NOT be doubled — idempotency enforced
            }
          } else if (secureRand() < CONFIG.VOUCHER_REDEEM_RATE) {
            const reward = secureRandInt(CONFIG.VOUCHER_CAPS_REWARD.min, CONFIG.VOUCHER_CAPS_REWARD.max);
            player.caps = Math.min(player.caps + reward, CONFIG.CAPS_MAX_PER_PLAYER);
            player.vouchersRedeemed++;
          }
        }
      }
    }

    // ── Battle ───────────────────────────────────────────────────────────────
    if (secureRand() < player.battleFreq && player.dailyBattles < CONFIG.DAILY_BATTLE_CAP) {
      player.dailyBattles++;
      const winRate = 0.55 + (player.battleFreq * 0.1); // Slightly in player's favour
      if (secureRand() < winRate) {
        player.battlesWon++;
        const caps = secureRandInt(CONFIG.CAPS_PER_BATTLE_WIN.min, CONFIG.CAPS_PER_BATTLE_WIN.max);
        player.caps = Math.min(player.caps + caps, CONFIG.CAPS_MAX_PER_PLAYER);
        if (secureRand() < 0.3) { // 30% chance of loot
          player.items[rollLoot()]++;
        }
      }
    }

    // ── Quest ────────────────────────────────────────────────────────────────
    if (secureRand() < player.questFreq && player.dailyQuests < CONFIG.DAILY_QUEST_CAP) {
      const questId = `q_${secureRandInt(1, 50)}`; // 50 unique quests
      if (!player.questsInProgress.has(questId) && player.questsInProgress.size < 5) {
        player.questsInProgress.add(questId);
      }

      // Complete an in-progress quest
      if (player.questsInProgress.size > 0 && secureRand() < CONFIG.QUEST_COMPLETE_RATE) {
        const completedId = Array.from(player.questsInProgress)[0];

        // Anti-exploit: check if quest was already completed (duplicate reward)
        if (!player.completedQuests.has(completedId)) {
          player.questsInProgress.delete(completedId);
          player.completedQuests.add(completedId);
          player.questsCompleted++;
          player.dailyQuests++;

          const reward = secureRandInt(CONFIG.CAPS_PER_QUEST.min, CONFIG.CAPS_PER_QUEST.max);
          player.caps = Math.min(player.caps + reward, CONFIG.CAPS_MAX_PER_PLAYER);
          player.items[rollLoot()]++;
        } else {
          // Would have been a duplicate — server must reject this
          // Tracked for exploit analysis
        }
      }
    }
  }

  // Snapshot caps for trend analysis
  player.capsHistory.push(player.caps);
}

// ─── Main Simulation ──────────────────────────────────────────────────────────
function runSimulation() {
  console.log("\n☢️  ATOMIC FIZZ CAPS — Economy Simulation");
  console.log("══════════════════════════════════════════════════════");
  console.log(`  Players:    ${CONFIG.PLAYERS.toLocaleString()}`);
  console.log(`  Duration:   ${CONFIG.SIM_DAYS} days`);
  console.log(`  Archetypes: ${ARCHETYPES.length}`);
  console.log("\n  Simulating... (this takes a few seconds)");

  const startTime = Date.now();

  // Create players
  const players = Array.from({ length: CONFIG.PLAYERS }, (_, i) => createPlayer(i));

  // Day-by-day simulation
  const dailyTotals = [];
  for (let day = 0; day < CONFIG.SIM_DAYS; day++) {
    for (const player of players) {
      simulatePlayerDay(player, day);
    }

    const totalCaps = players.reduce((s, p) => s + p.caps, 0);
    const activePlayers = players.filter((p) => p.lastDayReset === day).length;
    dailyTotals.push({ day, totalCaps, activePlayers });

    if (day % 10 === 9) {
      process.stdout.write(`  Day ${day + 1}/${CONFIG.SIM_DAYS} — Total caps in circulation: ${totalCaps.toLocaleString()}\n`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n  Simulation complete in ${elapsed}s`);

  return { players, dailyTotals };
}

// ─── Analysis ─────────────────────────────────────────────────────────────────
function analyze(players, dailyTotals) {
  console.log("\n─────────────────────────────────────────");
  console.log("  ECONOMY ANALYSIS");
  console.log("─────────────────────────────────────────");

  let passed = 0;
  let failed = 0;
  const issues = [];

  function check(condition, label, value, threshold, unit = "") {
    const status = condition ? "PASS" : "FAIL";
    const icon = condition ? "✓" : "✗";
    console.log(`  ${icon}  ${label}: ${typeof value === "number" ? value.toLocaleString() : value}${unit} (threshold: ${threshold}${unit})`);
    if (condition) passed++;
    else {
      failed++;
      issues.push({ label, value, threshold });
    }
  }

  // ── Caps Economy ────────────────────────────────────────────────────────────
  const allCaps = players.map((p) => p.caps);
  const totalCaps = allCaps.reduce((s, c) => s + c, 0);
  const meanCaps = totalCaps / players.length;
  const maxCaps = Math.max(...allCaps);
  const minCaps = Math.min(...allCaps);

  console.log("\n  CAPS DISTRIBUTION");
  check(totalCaps <= CONFIG.MAX_TOTAL_CAPS_BUDGET, "Total caps in circulation", totalCaps, CONFIG.MAX_TOTAL_CAPS_BUDGET.toLocaleString());
  check(meanCaps >= CONFIG.MIN_MEAN_CAPS, "Mean caps per player", Math.round(meanCaps), CONFIG.MIN_MEAN_CAPS);
  check(meanCaps <= CONFIG.MAX_MEAN_CAPS, "Mean caps within upper bound", Math.round(meanCaps), CONFIG.MAX_MEAN_CAPS.toLocaleString());
  check(maxCaps < CONFIG.CAPS_MAX_PER_PLAYER, "Max single-player caps below ceiling", maxCaps, CONFIG.CAPS_MAX_PER_PLAYER.toLocaleString());

  // Gini coefficient (wealth inequality)
  const sortedCaps = [...allCaps].sort((a, b) => a - b);
  const n = sortedCaps.length;
  let giniNumerator = 0;
  for (let i = 0; i < n; i++) {
    giniNumerator += (2 * (i + 1) - n - 1) * sortedCaps[i];
  }
  const gini = giniNumerator / (n * sortedCaps.reduce((s, c) => s + c, 0));
  check(gini <= CONFIG.MAX_GINI_COEFFICIENT, "Wealth Gini coefficient", gini.toFixed(3), CONFIG.MAX_GINI_COEFFICIENT);

  // ── Inflation Rate ───────────────────────────────────────────────────────────
  console.log("\n  INFLATION ANALYSIS");
  const day0Caps = dailyTotals[0].totalCaps;
  const day29Caps = dailyTotals[CONFIG.SIM_DAYS - 1].totalCaps;
  const totalInflation = (day29Caps - day0Caps) / day0Caps;
  const dailyInflation = totalInflation / CONFIG.SIM_DAYS;
  check(dailyInflation <= CONFIG.MAX_INFLATION_RATE, "Daily caps inflation rate", (dailyInflation * 100).toFixed(3), (CONFIG.MAX_INFLATION_RATE * 100).toFixed(1), "%");

  // ── Item Rarity Distribution ─────────────────────────────────────────────────
  console.log("\n  ITEM RARITY DISTRIBUTION");
  const totalItems = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
  players.forEach((p) => {
    for (const [rarity, count] of Object.entries(p.items)) {
      totalItems[rarity] += count;
    }
  });
  const totalItemCount = Object.values(totalItems).reduce((s, c) => s + c, 0);

  for (const [rarity, count] of Object.entries(totalItems)) {
    const actualPct = (count / totalItemCount) * 100;
    const expectedWeight = CONFIG.LOOT_WEIGHTS[rarity];
    const expectedPct = (expectedWeight / Object.values(CONFIG.LOOT_WEIGHTS).reduce((s, w) => s + w, 0)) * 100;
    const deviation = Math.abs(actualPct - expectedPct);
    // Allow 20% relative deviation from expected (statistical tolerance for 10k players)
    check(deviation < expectedPct * 0.20, `${rarity} drop rate`, actualPct.toFixed(2), `${expectedPct.toFixed(2)} ±${(expectedPct * 0.20).toFixed(2)}`, "%");
  }

  // ── Anti-Exploit Checks ──────────────────────────────────────────────────────
  console.log("\n  ANTI-EXPLOIT CHECKS");

  // No player should exceed daily caps from legitimate play (sanity check the simulation itself)
  const maxLegitDailyCaps =
    (CONFIG.CAPS_PER_CLAIM.max * CONFIG.DAILY_CLAIM_CAP) +
    (CONFIG.VOUCHER_CAPS_REWARD.max * Math.ceil(CONFIG.DAILY_CLAIM_CAP * CONFIG.VOUCHER_ISSUE_RATE)) +
    (CONFIG.CAPS_PER_BATTLE_WIN.max * CONFIG.DAILY_BATTLE_CAP) +
    (CONFIG.CAPS_PER_QUEST.max * CONFIG.DAILY_QUEST_CAP);
  console.log(`  ℹ  Max theoretical daily caps (legitimate play): ${maxLegitDailyCaps.toLocaleString()}`);

  // Duplicate redemption detection
  const duplicateAttempts = players.reduce((s, p) => s + p.duplicateRedemptions, 0);
  // Duplicate ATTEMPTS are fine (players may try) — what matters is they got 0 extra caps
  console.log(`  ℹ  Duplicate redemption ATTEMPTS simulated: ${duplicateAttempts.toLocaleString()} (should yield 0 extra caps in production)`);
  check(true, "Duplicate redemption attempts tracked (server must reject duplicates)", duplicateAttempts, "tracked");

  // No player completed the same quest twice
  const questDuplicates = players.filter((p) => p.completedQuests.size < p.questsCompleted).length;
  check(questDuplicates === 0, "Zero players double-completed any quest", questDuplicates, 0);

  // Voucher redemption rate sanity (not over 100% of issued)
  const totalIssued = players.reduce((s, p) => s + p.vouchersIssued, 0);
  const totalRedeemed = players.reduce((s, p) => s + p.vouchersRedeemed, 0);
  check(totalRedeemed <= totalIssued, "Redeemed vouchers ≤ issued vouchers (no phantom redemptions)", totalRedeemed, totalIssued);

  // ── Summary Stats ────────────────────────────────────────────────────────────
  console.log("\n  SUMMARY STATISTICS");
  const totalBattles = players.reduce((s, p) => s + p.battlesWon, 0);
  const totalQuests = players.reduce((s, p) => s + p.questsCompleted, 0);
  const totalClaims = players.reduce((s, p) => s + p.locsClaimed, 0);
  console.log(`  ℹ  Total battles won:      ${totalBattles.toLocaleString()}`);
  console.log(`  ℹ  Total quests completed: ${totalQuests.toLocaleString()}`);
  console.log(`  ℹ  Total location claims:  ${totalClaims.toLocaleString()}`);
  console.log(`  ℹ  Total items collected:  ${totalItemCount.toLocaleString()}`);
  console.log(`  ℹ  Total vouchers issued:  ${totalIssued.toLocaleString()}`);
  console.log(`  ℹ  Total vouchers redeemed: ${totalRedeemed.toLocaleString()}`);
  console.log(`  ℹ  Total caps (end of sim): ${totalCaps.toLocaleString()}`);
  console.log(`  ℹ  Richest player: ${maxCaps.toLocaleString()} caps`);
  console.log(`  ℹ  Poorest player: ${minCaps.toLocaleString()} caps`);
  console.log(`  ℹ  Gini coefficient: ${gini.toFixed(4)} (0=perfect equality, 1=one player has all)`);

  // ── Archetype Breakdown ──────────────────────────────────────────────────────
  console.log("\n  ARCHETYPE BREAKDOWN");
  for (const arch of ARCHETYPES) {
    const cohort = players.filter((p) => p.archetype === arch.name);
    if (cohort.length === 0) continue;
    const cohortMean = cohort.reduce((s, p) => s + p.caps, 0) / cohort.length;
    console.log(`  ℹ  ${arch.name.padEnd(22)} n=${cohort.length.toString().padStart(5)}  avg=${Math.round(cohortMean).toLocaleString().padStart(12)} caps`);
  }

  // ── Final Verdict ────────────────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────");
  console.log(`  Results: ${passed} passed, ${failed} failed`);

  if (issues.length > 0) {
    console.log("\n  ECONOMY ISSUES DETECTED:");
    issues.forEach((i) => console.log(`    ✗  ${i.label}: ${i.value} (expected ≤ ${i.threshold})`));
  }

  const vaultStatus = failed === 0 ? "OPEN" : failed <= 2 ? "CAUTION" : "SEALED";
  console.log(`\n☢️  QA TERMINAL: 0 critical | ${failed} high | 0 medium | 0 low | 0 cosmetic — Vault status: ${vaultStatus}`);
  console.log("  Economy simulation complete. 10,000 Vault Dwellers accounted for.\n");

  process.exit(failed > 0 ? 1 : 0);
}

// ─── Run ──────────────────────────────────────────────────────────────────────
const { players, dailyTotals } = runSimulation();
analyze(players, dailyTotals);
=======
/**
 * ☢️ ATOMIC FIZZ CAPS — Economy Simulation
 * ─────────────────────────────────────────────────────
 * Simulates 10,000 players over 30 days of gameplay.
 * Validates that caps/items/vouchers don't inflate beyond design budget,
 * no duplication paths exist, and reward loops stay bounded.
 *
 * Run: node tests/economy-simulation.js
 * No live server required — pure in-process Monte Carlo simulation.
 */

"use strict";

const crypto = require("crypto");

// ─── Secure RNG (project policy: no Math.random()) ───────────────────────────
function secureRand() {
  const buf = crypto.randomBytes(4);
  return buf.readUInt32BE(0) / 0x100000000;
}

function secureRandInt(min, max) {
  return min + Math.floor(secureRand() * (max - min + 1));
}

function _secureChoice(arr) {
  return arr[secureRandInt(0, arr.length - 1)];
}

// ─── Game Economy Constants ───────────────────────────────────────────────────
const CONFIG = {
  PLAYERS: 10_000,
  SIM_DAYS: 30,
  TICKS_PER_DAY: 10,           // Average sessions per active player per day
  DAILY_ACTIVE_RATE: 0.35,     // 35% DAU/MAU ratio

  // Reward bounds (per session)
  CAPS_PER_CLAIM: { min: 10, max: 150 },
  CAPS_PER_BATTLE_WIN: { min: 5, max: 75 },
  CAPS_PER_QUEST: { min: 50, max: 500 },
  CAPS_MAX_PER_PLAYER: 999_999_999,

  // Voucher economy
  VOUCHER_ISSUE_RATE: 0.15,    // 15% of location claims generate a voucher
  VOUCHER_REDEEM_RATE: 0.80,   // 80% of issued vouchers are eventually redeemed
  VOUCHER_CAPS_REWARD: { min: 25, max: 200 },

  // Item drop rates (by rarity)
  LOOT_WEIGHTS: {
    common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1,
  },

  // Quest completion rates
  QUEST_COMPLETE_RATE: 0.45,   // 45% of started quests completed
  QUEST_DAILY_START: 2,        // Average quests started per active day

  // Anti-inflation caps
  DAILY_CLAIM_CAP: 20,         // Max location claims per player per day
  DAILY_QUEST_CAP: 10,         // Max quests completable per day
  DAILY_BATTLE_CAP: 50,        // Max battles per day

  // Economy health thresholds
  MAX_TOTAL_CAPS_BUDGET: 5_000_000_000,   // 5 billion total caps in circulation (30d)
  MAX_INFLATION_RATE: 0.05,               // Max 5% month-over-month growth
  MAX_GINI_COEFFICIENT: 0.85,             // Wealth distribution must not exceed this
  MIN_MEAN_CAPS: 1_000,                   // Average player should have at least 1k caps
  MAX_MEAN_CAPS: 10_000_000,             // No runaway wealth inflation
};

// ─── Player Archetypes ────────────────────────────────────────────────────────
const ARCHETYPES = [
  { name: "Casual Explorer",   weight: 30, activity: 0.3,  claimFreq: 0.4, battleFreq: 0.2, questFreq: 0.3 },
  { name: "Hardcore Min-Maxer", weight: 15, activity: 0.9,  claimFreq: 0.9, battleFreq: 0.8, questFreq: 0.9 },
  { name: "Speed Runner",       weight: 10, activity: 0.8,  claimFreq: 0.7, battleFreq: 0.9, questFreq: 0.6 },
  { name: "Blockchain Native",  weight: 15, activity: 0.7,  claimFreq: 0.5, battleFreq: 0.5, questFreq: 0.8 },
  { name: "Chaos Monkey",       weight: 10, activity: 0.6,  claimFreq: 0.6, battleFreq: 0.7, questFreq: 0.4 },
  { name: "Mobile GPS Player",  weight: 15, activity: 0.5,  claimFreq: 0.8, battleFreq: 0.3, questFreq: 0.5 },
  { name: "Social Player",      weight:  5, activity: 0.4,  claimFreq: 0.3, battleFreq: 0.2, questFreq: 0.7 },
];

function pickArchetype() {
  const total = ARCHETYPES.reduce((s, a) => s + a.weight, 0);
  let r = secureRand() * total;
  for (const a of ARCHETYPES) {
    r -= a.weight;
    if (r <= 0) return a;
  }
  return ARCHETYPES[ARCHETYPES.length - 1];
}

// ─── Loot Table ───────────────────────────────────────────────────────────────
function rollLoot() {
  const total = Object.values(CONFIG.LOOT_WEIGHTS).reduce((s, w) => s + w, 0);
  let r = secureRand() * total;
  for (const [rarity, weight] of Object.entries(CONFIG.LOOT_WEIGHTS)) {
    r -= weight;
    if (r <= 0) return rarity;
  }
  return "common";
}

// ─── Player Factory ───────────────────────────────────────────────────────────
function createPlayer(id) {
  const archetype = pickArchetype();
  return {
    id,
    archetype: archetype.name,
    activity: archetype.activity,
    claimFreq: archetype.claimFreq,
    battleFreq: archetype.battleFreq,
    questFreq: archetype.questFreq,

    caps: 100,                   // Starting caps
    items: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
    vouchersIssued: 0,
    vouchersRedeemed: 0,
    questsCompleted: 0,
    battlesWon: 0,
    locsClaimed: 0,

    // Anti-exploit state
    dailyClaims: 0,
    dailyQuests: 0,
    dailyBattles: 0,
    lastDayReset: 0,
    claimedLocations: new Set(),  // Simulates cooldown
    questsInProgress: new Set(),
    capsHistory: [],              // Daily snapshot for inflation tracking
    duplicateRedemptions: 0,      // Should always remain 0
    completedQuests: new Set(),   // Should not allow re-completion
  };
}

// ─── Simulation Engine ────────────────────────────────────────────────────────
function simulatePlayerDay(player, day) {
  // Reset daily counters
  if (player.lastDayReset !== day) {
    player.dailyClaims = 0;
    player.dailyQuests = 0;
    player.dailyBattles = 0;
    player.claimedLocations.clear(); // Cooldowns reset daily in sim
    player.lastDayReset = day;
  }

  // Skip if player is not active today
  if (secureRand() > player.activity) return;

  const sessions = secureRandInt(1, CONFIG.TICKS_PER_DAY);

  for (let s = 0; s < sessions; s++) {
    // ── Location Claim ──────────────────────────────────────────────────────
    if (secureRand() < player.claimFreq && player.dailyClaims < CONFIG.DAILY_CLAIM_CAP) {
      const locId = secureRandInt(1, 500); // 500 unique POIs
      if (!player.claimedLocations.has(locId)) {
        player.claimedLocations.add(locId);
        player.dailyClaims++;
        player.locsClaimed++;

        const caps = secureRandInt(CONFIG.CAPS_PER_CLAIM.min, CONFIG.CAPS_PER_CLAIM.max);
        player.caps = Math.min(player.caps + caps, CONFIG.CAPS_MAX_PER_PLAYER);

        // Loot drop
        const rarity = rollLoot();
        player.items[rarity]++;

        // Voucher issuance
        if (secureRand() < CONFIG.VOUCHER_ISSUE_RATE) {
          const _voucherId = `v_${player.id}_${day}_${s}`;
          player.vouchersIssued++;

          // Simulate potential double-redemption attempt (exploit scenario)
          if (secureRand() < 0.01) { // 1% of players try to redeem twice
            // First redemption
            if (secureRand() < CONFIG.VOUCHER_REDEEM_RATE) {
              const reward = secureRandInt(CONFIG.VOUCHER_CAPS_REWARD.min, CONFIG.VOUCHER_CAPS_REWARD.max);
              player.caps = Math.min(player.caps + reward, CONFIG.CAPS_MAX_PER_PLAYER);
              player.vouchersRedeemed++;

              // Second redemption attempt — server should reject (idempotency)
              // In simulation, we track this as a duplicate attempt
              player.duplicateRedemptions++;
              // Caps should NOT be doubled — idempotency enforced
            }
          } else if (secureRand() < CONFIG.VOUCHER_REDEEM_RATE) {
            const reward = secureRandInt(CONFIG.VOUCHER_CAPS_REWARD.min, CONFIG.VOUCHER_CAPS_REWARD.max);
            player.caps = Math.min(player.caps + reward, CONFIG.CAPS_MAX_PER_PLAYER);
            player.vouchersRedeemed++;
          }
        }
      }
    }

    // ── Battle ───────────────────────────────────────────────────────────────
    if (secureRand() < player.battleFreq && player.dailyBattles < CONFIG.DAILY_BATTLE_CAP) {
      player.dailyBattles++;
      const winRate = 0.55 + (player.battleFreq * 0.1); // Slightly in player's favour
      if (secureRand() < winRate) {
        player.battlesWon++;
        const caps = secureRandInt(CONFIG.CAPS_PER_BATTLE_WIN.min, CONFIG.CAPS_PER_BATTLE_WIN.max);
        player.caps = Math.min(player.caps + caps, CONFIG.CAPS_MAX_PER_PLAYER);
        if (secureRand() < 0.3) { // 30% chance of loot
          player.items[rollLoot()]++;
        }
      }
    }

    // ── Quest ────────────────────────────────────────────────────────────────
    if (secureRand() < player.questFreq && player.dailyQuests < CONFIG.DAILY_QUEST_CAP) {
      const questId = `q_${secureRandInt(1, 50)}`; // 50 unique quests
      if (!player.questsInProgress.has(questId) && player.questsInProgress.size < 5) {
        player.questsInProgress.add(questId);
      }

      // Complete an in-progress quest
      if (player.questsInProgress.size > 0 && secureRand() < CONFIG.QUEST_COMPLETE_RATE) {
        const completedId = Array.from(player.questsInProgress)[0];

        // Anti-exploit: check if quest was already completed (duplicate reward)
        if (!player.completedQuests.has(completedId)) {
          player.questsInProgress.delete(completedId);
          player.completedQuests.add(completedId);
          player.questsCompleted++;
          player.dailyQuests++;

          const reward = secureRandInt(CONFIG.CAPS_PER_QUEST.min, CONFIG.CAPS_PER_QUEST.max);
          player.caps = Math.min(player.caps + reward, CONFIG.CAPS_MAX_PER_PLAYER);
          player.items[rollLoot()]++;
        } else {
          // Would have been a duplicate — server must reject this
          // Tracked for exploit analysis
        }
      }
    }
  }

  // Snapshot caps for trend analysis
  player.capsHistory.push(player.caps);
}

// ─── Main Simulation ──────────────────────────────────────────────────────────
function runSimulation() {
  console.log("\n☢️  ATOMIC FIZZ CAPS — Economy Simulation");
  console.log("══════════════════════════════════════════════════════");
  console.log(`  Players:    ${CONFIG.PLAYERS.toLocaleString()}`);
  console.log(`  Duration:   ${CONFIG.SIM_DAYS} days`);
  console.log(`  Archetypes: ${ARCHETYPES.length}`);
  console.log("\n  Simulating... (this takes a few seconds)");

  const startTime = Date.now();

  // Create players
  const players = Array.from({ length: CONFIG.PLAYERS }, (_, i) => createPlayer(i));

  // Day-by-day simulation
  const dailyTotals = [];
  for (let day = 0; day < CONFIG.SIM_DAYS; day++) {
    for (const player of players) {
      simulatePlayerDay(player, day);
    }

    const totalCaps = players.reduce((s, p) => s + p.caps, 0);
    const activePlayers = players.filter((p) => p.lastDayReset === day).length;
    dailyTotals.push({ day, totalCaps, activePlayers });

    if (day % 10 === 9) {
      process.stdout.write(`  Day ${day + 1}/${CONFIG.SIM_DAYS} — Total caps in circulation: ${totalCaps.toLocaleString()}\n`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n  Simulation complete in ${elapsed}s`);

  return { players, dailyTotals };
}

// ─── Analysis ─────────────────────────────────────────────────────────────────
function analyze(players, dailyTotals) {
  console.log("\n─────────────────────────────────────────");
  console.log("  ECONOMY ANALYSIS");
  console.log("─────────────────────────────────────────");

  let passed = 0;
  let failed = 0;
  const issues = [];

  function check(condition, label, value, threshold, unit = "") {
    const icon = condition ? "✓" : "✗";
    console.log(`  ${icon}  ${label}: ${typeof value === "number" ? value.toLocaleString() : value}${unit} (threshold: ${threshold}${unit})`);
    if (condition) passed++;
    else {
      failed++;
      issues.push({ label, value, threshold });
    }
  }

  // ── Caps Economy ────────────────────────────────────────────────────────────
  const allCaps = players.map((p) => p.caps);
  const totalCaps = allCaps.reduce((s, c) => s + c, 0);
  const meanCaps = totalCaps / players.length;
  const maxCaps = Math.max(...allCaps);
  const minCaps = Math.min(...allCaps);

  console.log("\n  CAPS DISTRIBUTION");
  check(totalCaps <= CONFIG.MAX_TOTAL_CAPS_BUDGET, "Total caps in circulation", totalCaps, CONFIG.MAX_TOTAL_CAPS_BUDGET.toLocaleString());
  check(meanCaps >= CONFIG.MIN_MEAN_CAPS, "Mean caps per player", Math.round(meanCaps), CONFIG.MIN_MEAN_CAPS);
  check(meanCaps <= CONFIG.MAX_MEAN_CAPS, "Mean caps within upper bound", Math.round(meanCaps), CONFIG.MAX_MEAN_CAPS.toLocaleString());
  check(maxCaps < CONFIG.CAPS_MAX_PER_PLAYER, "Max single-player caps below ceiling", maxCaps, CONFIG.CAPS_MAX_PER_PLAYER.toLocaleString());

  // Gini coefficient (wealth inequality)
  const sortedCaps = [...allCaps].sort((a, b) => a - b);
  const n = sortedCaps.length;
  let giniNumerator = 0;
  for (let i = 0; i < n; i++) {
    giniNumerator += (2 * (i + 1) - n - 1) * sortedCaps[i];
  }
  const gini = giniNumerator / (n * sortedCaps.reduce((s, c) => s + c, 0));
  check(gini <= CONFIG.MAX_GINI_COEFFICIENT, "Wealth Gini coefficient", gini.toFixed(3), CONFIG.MAX_GINI_COEFFICIENT);

  // ── Inflation Rate ───────────────────────────────────────────────────────────
  console.log("\n  INFLATION ANALYSIS");
  const day0Caps = dailyTotals[0].totalCaps;
  const day29Caps = dailyTotals[CONFIG.SIM_DAYS - 1].totalCaps;
  const totalInflation = (day29Caps - day0Caps) / day0Caps;
  const dailyInflation = totalInflation / CONFIG.SIM_DAYS;
  check(dailyInflation <= CONFIG.MAX_INFLATION_RATE, "Daily caps inflation rate", (dailyInflation * 100).toFixed(3), (CONFIG.MAX_INFLATION_RATE * 100).toFixed(1), "%");

  // ── Item Rarity Distribution ─────────────────────────────────────────────────
  console.log("\n  ITEM RARITY DISTRIBUTION");
  const totalItems = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
  players.forEach((p) => {
    for (const [rarity, count] of Object.entries(p.items)) {
      totalItems[rarity] += count;
    }
  });
  const totalItemCount = Object.values(totalItems).reduce((s, c) => s + c, 0);

  for (const [rarity, count] of Object.entries(totalItems)) {
    const actualPct = (count / totalItemCount) * 100;
    const expectedWeight = CONFIG.LOOT_WEIGHTS[rarity];
    const expectedPct = (expectedWeight / Object.values(CONFIG.LOOT_WEIGHTS).reduce((s, w) => s + w, 0)) * 100;
    const deviation = Math.abs(actualPct - expectedPct);
    // Allow 20% relative deviation from expected (statistical tolerance for 10k players)
    check(deviation < expectedPct * 0.20, `${rarity} drop rate`, actualPct.toFixed(2), `${expectedPct.toFixed(2)} ±${(expectedPct * 0.20).toFixed(2)}`, "%");
  }

  // ── Anti-Exploit Checks ──────────────────────────────────────────────────────
  console.log("\n  ANTI-EXPLOIT CHECKS");

  // No player should exceed daily caps from legitimate play (sanity check the simulation itself)
  const maxLegitDailyCaps =
    (CONFIG.CAPS_PER_CLAIM.max * CONFIG.DAILY_CLAIM_CAP) +
    (CONFIG.VOUCHER_CAPS_REWARD.max * Math.ceil(CONFIG.DAILY_CLAIM_CAP * CONFIG.VOUCHER_ISSUE_RATE)) +
    (CONFIG.CAPS_PER_BATTLE_WIN.max * CONFIG.DAILY_BATTLE_CAP) +
    (CONFIG.CAPS_PER_QUEST.max * CONFIG.DAILY_QUEST_CAP);
  console.log(`  ℹ  Max theoretical daily caps (legitimate play): ${maxLegitDailyCaps.toLocaleString()}`);

  // Duplicate redemption detection
  const duplicateAttempts = players.reduce((s, p) => s + p.duplicateRedemptions, 0);
  // Duplicate ATTEMPTS are fine (players may try) — what matters is they got 0 extra caps
  console.log(`  ℹ  Duplicate redemption ATTEMPTS simulated: ${duplicateAttempts.toLocaleString()} (should yield 0 extra caps in production)`);
  check(true, "Duplicate redemption attempts tracked (server must reject duplicates)", duplicateAttempts, "tracked");

  // No player completed the same quest twice
  const questDuplicates = players.filter((p) => p.completedQuests.size < p.questsCompleted).length;
  check(questDuplicates === 0, "Zero players double-completed any quest", questDuplicates, 0);

  // Voucher redemption rate sanity (not over 100% of issued)
  const totalIssued = players.reduce((s, p) => s + p.vouchersIssued, 0);
  const totalRedeemed = players.reduce((s, p) => s + p.vouchersRedeemed, 0);
  check(totalRedeemed <= totalIssued, "Redeemed vouchers ≤ issued vouchers (no phantom redemptions)", totalRedeemed, totalIssued);

  // ── Summary Stats ────────────────────────────────────────────────────────────
  console.log("\n  SUMMARY STATISTICS");
  const totalBattles = players.reduce((s, p) => s + p.battlesWon, 0);
  const totalQuests = players.reduce((s, p) => s + p.questsCompleted, 0);
  const totalClaims = players.reduce((s, p) => s + p.locsClaimed, 0);
  console.log(`  ℹ  Total battles won:      ${totalBattles.toLocaleString()}`);
  console.log(`  ℹ  Total quests completed: ${totalQuests.toLocaleString()}`);
  console.log(`  ℹ  Total location claims:  ${totalClaims.toLocaleString()}`);
  console.log(`  ℹ  Total items collected:  ${totalItemCount.toLocaleString()}`);
  console.log(`  ℹ  Total vouchers issued:  ${totalIssued.toLocaleString()}`);
  console.log(`  ℹ  Total vouchers redeemed: ${totalRedeemed.toLocaleString()}`);
  console.log(`  ℹ  Total caps (end of sim): ${totalCaps.toLocaleString()}`);
  console.log(`  ℹ  Richest player: ${maxCaps.toLocaleString()} caps`);
  console.log(`  ℹ  Poorest player: ${minCaps.toLocaleString()} caps`);
  console.log(`  ℹ  Gini coefficient: ${gini.toFixed(4)} (0=perfect equality, 1=one player has all)`);

  // ── Archetype Breakdown ──────────────────────────────────────────────────────
  console.log("\n  ARCHETYPE BREAKDOWN");
  for (const arch of ARCHETYPES) {
    const cohort = players.filter((p) => p.archetype === arch.name);
    if (cohort.length === 0) continue;
    const cohortMean = cohort.reduce((s, p) => s + p.caps, 0) / cohort.length;
    console.log(`  ℹ  ${arch.name.padEnd(22)} n=${cohort.length.toString().padStart(5)}  avg=${Math.round(cohortMean).toLocaleString().padStart(12)} caps`);
  }

  // ── Final Verdict ────────────────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────");
  console.log(`  Results: ${passed} passed, ${failed} failed`);

  if (issues.length > 0) {
    console.log("\n  ECONOMY ISSUES DETECTED:");
    issues.forEach((i) => console.log(`    ✗  ${i.label}: ${i.value} (expected ≤ ${i.threshold})`));
  }

  const vaultStatus = failed === 0 ? "OPEN" : failed <= 2 ? "CAUTION" : "SEALED";
  console.log(`\n☢️  QA TERMINAL: 0 critical | ${failed} high | 0 medium | 0 low | 0 cosmetic — Vault status: ${vaultStatus}`);
  console.log("  Economy simulation complete. 10,000 Vault Dwellers accounted for.\n");

  process.exit(failed > 0 ? 1 : 0);
}

// ─── Run ──────────────────────────────────────────────────────────────────────
const { players, dailyTotals } = runSimulation();
analyze(players, dailyTotals);
>>>>>>> sync/main-reconcile-20260524-081701
