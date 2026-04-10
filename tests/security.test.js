// tests/security.test.js
// ──────────────────────────────────────────────────────────────────────────
// Atomic Fizz Caps — Security Test Suite
// Run with: node tests/security.test.js
// Uses only Node.js built-in modules (no extra deps required).
// ──────────────────────────────────────────────────────────────────────────

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

// ─── helpers ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${name}`);
    console.error(`     ${err.message}`);
    failed++;
    failures.push({ name, message: err.message });
  }
}

function readFile(relPath) {
  const abs = path.resolve(__dirname, "..", relPath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, "utf8");
}

// ─── 1. Auth middleware rejects requests without session ──────────────────

console.log("\n[1] Auth middleware — rejects requests without session");

test("authMiddleware returns 401 when Authorization header is missing", () => {
  // We verify this by reading the source and confirming the guard exists.
  const src = readFile("backend/lib/auth.js");
  assert.ok(src, "backend/lib/auth.js must exist");

  // The middleware must check for a missing header and return 401.
  assert.ok(
    src.includes('status(401)') && src.includes('"Missing session"'),
    "authMiddleware must return HTTP 401 with 'Missing session' when header is absent"
  );
});

test("authMiddleware returns 401 when session is expired or invalid", () => {
  const src = readFile("backend/lib/auth.js");
  assert.ok(src, "backend/lib/auth.js must exist");
  assert.ok(
    src.includes('"Session expired or invalid"'),
    "authMiddleware must reject invalid/expired sessions"
  );
});

test("authMiddleware attaches req.player.wallet from verified session (not body)", () => {
  const src = readFile("backend/lib/auth.js");
  assert.ok(src, "backend/lib/auth.js must exist");
  // wallet must come from the session object, not req.body
  assert.ok(
    src.includes("session.wallet"),
    "wallet must be sourced from session, not req.body"
  );
});

// ─── 2. Location claim — GPS distance validation ──────────────────────────

console.log("\n[2] Location claim — GPS distance validation");

test("location-claim.js exists", () => {
  const src = readFile("backend/api/location-claim.js");
  assert.ok(src, "backend/api/location-claim.js must exist");
});

test("location-claim.js reads wallet from req.player.wallet (not req.body)", () => {
  const src = readFile("backend/api/location-claim.js");
  assert.ok(src, "backend/api/location-claim.js must exist");
  // Must NOT use req.body.wallet for the authoritative wallet address
  assert.ok(
    src.includes("req.player.wallet"),
    "location-claim must use req.player.wallet"
  );
  // Any req.body.wallet reference should only appear in comments
  const bodyWalletLines = src
    .split("\n")
    .filter((l) => l.match(/req\.body\.wallet/) && !l.trim().startsWith("//"));
  assert.strictEqual(
    bodyWalletLines.length,
    0,
    "location-claim must not use req.body.wallet outside of comments"
  );
});

test("location-claim.js validates GPS distance", () => {
  const src = readFile("backend/api/location-claim.js");
  assert.ok(src, "backend/api/location-claim.js must exist");
  // Must perform a distance check — look for common distance keywords
  const hasDistanceCheck =
    src.includes("distance") || src.includes("GPS_DISTANCE") || src.includes("distanceTo");
  assert.ok(hasDistanceCheck, "location-claim must validate GPS distance before allowing a claim");
});

// ─── 3. Rate limiting is configured ──────────────────────────────────────

console.log("\n[3] Rate limiting");

test("express-rate-limit is listed as a dependency", () => {
  const pkg = readFile("package.json");
  assert.ok(pkg, "package.json must exist");
  const parsed = JSON.parse(pkg);
  const deps = Object.assign({}, parsed.dependencies, parsed.devDependencies);
  assert.ok(
    "express-rate-limit" in deps,
    "express-rate-limit must be listed in package.json dependencies"
  );
});

test("server.js applies global rate limiting middleware", () => {
  const src = readFile("backend/server.js");
  assert.ok(src, "backend/server.js must exist");
  assert.ok(
    src.includes("rateLimit") || src.includes("rate-limit"),
    "server.js must configure express-rate-limit"
  );
});

test("xp.js applies per-route rate limiting", () => {
  const src = readFile("backend/api/xp.js");
  assert.ok(src, "backend/api/xp.js must exist");
  assert.ok(
    src.includes("rateLimit") || src.includes("xpLimiter"),
    "xp.js must apply a rate limiter"
  );
});

test("location-claim.js applies rate limiting", () => {
  const src = readFile("backend/api/location-claim.js");
  assert.ok(src, "backend/api/location-claim.js must exist");
  assert.ok(
    src.includes("rateLimit") || src.includes("Limiter"),
    "location-claim.js must apply a rate limiter"
  );
});

// ─── 4. No Math.random() in backend critical paths ───────────────────────

console.log("\n[4] No Math.random() in backend critical paths");

const BACKEND_CRITICAL_FILES = [
  "backend/lib/lootTable.js",
  "backend/api/location-claim.js",
  "backend/api/quests.js",
  "backend/api/caps.js",
  "backend/api/xp.js",
  "backend/api/player.js",
];

for (const relPath of BACKEND_CRITICAL_FILES) {
  test(`No Math.random() in ${relPath}`, () => {
    const src = readFile(relPath);
    if (!src) return; // file may not exist in all environments — skip gracefully
    const nonCommentLines = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
    assert.ok(
      !nonCommentLines.includes("Math.random()"),
      `${relPath} must not use Math.random() in non-comment code`
    );
  });
}

// ─── 5. Frontend game modules — no Math.random() in critical paths ────────

console.log("\n[5] Frontend game modules — no Math.random() in critical code");

const FRONTEND_CRITICAL_FILES = [
  "public/js/modules/dragonbones-npc.js",
  "public/js/modules/npc-portraits.js",
  "public/js/modules/struggle-quips.js",
  "public/js/world/loot.js",
  "public/js/world/encounters.js",
  "public/js/modules/npcEncounter.js",
  "public/js/modules/enemyScaling.js",
];

for (const relPath of FRONTEND_CRITICAL_FILES) {
  test(`No Math.random() in ${relPath}`, () => {
    const src = readFile(relPath);
    if (!src) return; // file missing — skip
    const nonCommentLines = src
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
    assert.ok(
      !nonCommentLines.includes("Math.random()"),
      `${relPath} must not use Math.random() in non-comment code`
    );
  });
}

// ─── 6. CORS allows atomicfizzcaps.xyz ───────────────────────────────────

console.log("\n[6] CORS configuration");

test("server.js includes atomicfizzcaps.xyz in CORS allowlist", () => {
  const src = readFile("backend/server.js");
  assert.ok(src, "backend/server.js must exist");
  assert.ok(
    src.includes("atomicfizzcaps.xyz"),
    "CORS config must include atomicfizzcaps.xyz"
  );
});

test("server.js uses explicit origin allowlist (not wildcard *)", () => {
  const src = readFile("backend/server.js");
  assert.ok(src, "backend/server.js must exist");
  // Must not use `origin: '*'` or `origin: true` (blanket allow-all patterns)
  const hasWildcardStar = /origin\s*:\s*['"]?\*['"]?/.test(src);
  assert.ok(!hasWildcardStar, "CORS must not use wildcard * as origin");
  const hasOriginTrue = /origin\s*:\s*true\b/.test(src);
  assert.ok(!hasOriginTrue, "CORS must not use origin: true (blanket allow-all)");
});

test("Helmet middleware is applied", () => {
  const src = readFile("backend/server.js");
  assert.ok(src, "backend/server.js must exist");
  assert.ok(src.includes("helmet"), "server.js must use Helmet for security headers");
});

// ─── 7. IDOR — wallet from session, not body ─────────────────────────────

console.log("\n[7] IDOR prevention — wallet from session");

const IDOR_FILES = [
  { file: "backend/api/caps.js", adminOnly: true },
  { file: "backend/api/xp.js", adminOnly: false },
  { file: "backend/api/player.js", adminOnly: false },
  { file: "backend/api/quests.js", adminOnly: false },
];

for (const { file, adminOnly } of IDOR_FILES) {
  test(`${file} uses req.player.wallet for player-mutating routes`, () => {
    const src = readFile(file);
    if (!src) return;
    if (!adminOnly) {
      // Accept both direct req.player.wallet and const player = req.player; ... player.wallet
      const hasSessionWallet =
        src.includes("req.player.wallet") ||
        (src.includes("req.player") && src.includes("player.wallet"));
      assert.ok(
        hasSessionWallet,
        `${file} must use req.player.wallet for player-mutating operations`
      );

      // No unguarded wallet-from-body patterns in non-admin routes (comments are OK)
      const suspiciousLines = src
        .split("\n")
        .filter((l) => {
          const trimmed = l.trim();
          if (trimmed.startsWith("//") || trimmed.startsWith("*")) return false;
          // Direct assignment: const wallet = req.body.wallet / req.body?.wallet
          if (/(?:const|let|var)\s+wallet\s*=\s*req\.body(?:\?)?\.wallet/.test(l)) return true;
          // Destructuring: const { wallet } = req.body
          if (/(?:const|let|var)\s*\{[^}]*\bwallet\b[^}]*\}\s*=\s*req\.body/.test(l)) return true;
          return false;
        });
      assert.strictEqual(
        suspiciousLines.length,
        0,
        `${file} must not assign wallet from req.body without admin guard`
      );
    }
    // Admin-only files are allowed to accept wallet from req.body — their routes
    // are protected by requireAdminSecret / adminAuth middleware, not authMiddleware.
  });
}

// ─── 8. Overseer XSS — player input is escaped before display ─────────────

console.log("\n[8] Overseer XSS prevention");

test("overseer.full.js escapes player input before inserting into DOM", () => {
  const src = readFile("public/js/overseer/overseer.full.js");
  assert.ok(src, "public/js/overseer/overseer.full.js must exist");
  // escapeHtml must be defined
  assert.ok(src.includes("function escapeHtml"), "escapeHtml must be defined");
  // Player message must be escaped before addMessage
  assert.ok(
    src.includes("escapeHtml(text)"),
    "Player input must be passed through escapeHtml before addMessage"
  );
});

test("overseer.full.js defines a secure RNG helper", () => {
  const src = readFile("public/js/overseer/overseer.full.js");
  assert.ok(src, "public/js/overseer/overseer.full.js must exist");
  assert.ok(
    src.includes("getRandomValues") || src.includes("_secureRandom"),
    "overseer.full.js must use CSPRNG for game randomness"
  );
});

// ─── Summary ──────────────────────────────────────────────────────────────

// ─── 9. Playtest Bug Fixes ────────────────────────────────────────────────

console.log("\n[9] Playtest bug fixes (BUG-001 through BUG-020)");

test("BUG-001: redeem-voucher route is mounted at '/' not '/redeem-voucher'", () => {
  const src = readFile("backend/api/redeem-voucher.js");
  assert.ok(src, "backend/api/redeem-voucher.js must exist");
  // Must NOT use doubled route path
  assert.ok(
    !src.includes('router.post("/redeem-voucher"'),
    "redeem-voucher.js must not re-declare /redeem-voucher path (causes 404 double-path)"
  );
  // Must use root route
  assert.ok(
    src.includes('router.post("/",') || src.includes("router.post('/',"),
    "redeem-voucher.js must register POST at '/'"
  );
});

test("BUG-002: XP award endpoint requires admin role", () => {
  const src = readFile("backend/api/xp.js");
  assert.ok(src, "backend/api/xp.js must exist");
  assert.ok(
    src.includes('player.role !== "admin"') || src.includes("player.role !== 'admin'"),
    "xp.js /award endpoint must require admin role to prevent self-award exploit"
  );
});

test("BUG-003: quest rewards loaded from server data not client body", () => {
  const src = readFile("backend/api/quests.js");
  assert.ok(src, "backend/api/quests.js must exist");
  // Must load quest definitions at startup
  assert.ok(
    src.includes("QUEST_MAP") && src.includes("QUEST_DATA_DIR"),
    "quests.js must build QUEST_MAP from server-side quest data directory"
  );
  // Must use server rewards, not req.body rewards
  assert.ok(
    src.includes("serverRewards"),
    "quests.js must use serverRewards from QUEST_MAP, not client-provided reward values"
  );
});

test("BUG-004: chooseEnding() syncs player profile with quest state", () => {
  const src = readFile("backend/lib/quests.js");
  assert.ok(src, "backend/lib/quests.js must exist");
  assert.ok(
    src.includes("hget") && src.includes("hset"),
    "lib/quests.js chooseEnding() must read/write player profile hash to sync completed quests"
  );
});

test("BUG-005: leaderboard scans double-prefixed player keys", () => {
  const src = readFile("backend/api/caps.js");
  assert.ok(src, "backend/api/caps.js must exist");
  // Must use key(key("")) or key() before keys() call
  assert.ok(
    src.includes('redis.keys(key("player:*"))') || src.includes("redis.keys(key('player:*'))"),
    "caps.js leaderboard must scan with key(key()) double-prefix to find actual player profiles"
  );
});

test("BUG-006: cooldowns status uses correct key prefix (matches location-claim write)", () => {
  const src = readFile("backend/api/cooldowns.js");
  assert.ok(src, "backend/api/cooldowns.js must exist");
  // Must pre-call key() before redis.get() to match double-prefix written by location-claim
  assert.ok(
    src.includes('redis.get(key('),
    "cooldowns.js must pre-call key() to match the double-prefixed cooldown key written by location-claim.js"
  );
});

test("BUG-007: location-claim uses per-wallet profile lock for concurrent writes", () => {
  const src = readFile("backend/api/location-claim.js");
  assert.ok(src, "backend/api/location-claim.js must exist");
  assert.ok(
    src.includes("profileLockKey") || src.includes("profile:lock:"),
    "location-claim.js must use a per-wallet profile lock to prevent race-condition reward loss"
  );
});

test("BUG-008: inventory size limit enforced in location-claim and quests", () => {
  const locSrc = readFile("backend/api/location-claim.js");
  const questsSrc = readFile("backend/api/quests.js");
  assert.ok(locSrc, "backend/api/location-claim.js must exist");
  assert.ok(questsSrc, "backend/api/quests.js must exist");
  assert.ok(
    locSrc.includes("MAX_INVENTORY_SIZE"),
    "location-claim.js must enforce MAX_INVENTORY_SIZE"
  );
  assert.ok(
    questsSrc.includes("MAX_INVENTORY_SIZE"),
    "quests.js must enforce MAX_INVENTORY_SIZE"
  );
});

test("BUG-009: quests-store QUESTS_KEY uses bare string (no double-prefix)", () => {
  const src = readFile("backend/api/quests-store.js");
  assert.ok(src, "backend/api/quests-store.js must exist");
  assert.ok(
    !src.includes("const QUESTS_KEY = key("),
    "quests-store.js QUESTS_KEY must be a bare string, not pre-prefixed with key()"
  );
});

test("BUG-010: no Math.random() in overseer handlers", () => {
  const src = readFile("public/js/overseer/handlers.js");
  assert.ok(src, "public/js/overseer/handlers.js must exist");
  // Strip single-line comments before searching for Math.random() usage
  const codeOnly = src.split('\n').filter(line => !line.trim().startsWith('//') && !line.trim().startsWith('*')).join('\n');
  assert.ok(
    !codeOnly.includes("Math.random()"),
    "handlers.js must not use Math.random() in code — use crypto.getRandomValues() instead"
  );
});

test("BUG-014: max player level cap enforced in lib/xp.js", () => {
  const src = readFile("backend/lib/xp.js");
  assert.ok(src, "backend/lib/xp.js must exist");
  assert.ok(
    src.includes("MAX_LEVEL"),
    "lib/xp.js must enforce a MAX_LEVEL cap on level-up loop"
  );
});

test("BUG-015: quest accept validates questId against known quest data", () => {
  const src = readFile("backend/api/quests.js");
  assert.ok(src, "backend/api/quests.js must exist");
  assert.ok(
    src.includes("QUEST_MAP.has(questId)") || src.includes("QUEST_MAP.get(questId)"),
    "quests.js must validate questId against QUEST_MAP (server-side quest definitions)"
  );
});

test("BUG-017: no Math.random() in mini-game files", () => {
  const files = [
    "public/js/overseer/game.tictactoe.js",
    "public/js/overseer/game.redmenace.js",
  ];
  for (const f of files) {
    const src = readFile(f);
    assert.ok(src, `${f} must exist`);
    assert.ok(
      !src.includes("Math.random()"),
      `${f} must not use Math.random() — use crypto.getRandomValues() instead`
    );
  }
});

test("BUG-018: battle WIN disables buttons before clearing state", () => {
  const src = readFile("public/js/modules/battles.js");
  assert.ok(src, "public/js/modules/battles.js must exist");
  // The attackBtn.disabled = true line must appear BEFORE this.state = null in the WIN branch
  const winIdx = src.indexOf('end === "WIN"');
  assert.ok(winIdx !== -1, "battles.js must have a WIN check");
  const disableIdx = src.indexOf("attackBtn.disabled = true", winIdx);
  const stateNullIdx = src.indexOf("this.state = null", winIdx);
  assert.ok(
    disableIdx !== -1 && stateNullIdx !== -1 && disableIdx < stateNullIdx,
    "battles.js must disable attackBtn BEFORE clearing this.state on WIN to prevent flee-after-victory crash"
  );
});

test("BUG-019: VATS exits when all targets eliminated during shot execution", () => {
  const src = readFile("public/js/modules/vats.js");
  assert.ok(src, "public/js/modules/vats.js must exist");
  assert.ok(
    src.includes("VATS.targets.length === 0") && src.includes("exitVATS()"),
    "vats.js must call exitVATS() when all targets are eliminated to prevent blank VATS overlay"
  );
});

test("BUG-020: crafting.js _craft() is internal; craft() no longer public", () => {
  const src = readFile("public/js/modules/crafting.js");
  assert.ok(src, "public/js/modules/crafting.js must exist");
  assert.ok(
    src.includes("_craft(recipeId)"),
    "crafting.js must rename craft() to _craft() to prevent direct console bypass of server validation"
  );
  assert.ok(
    !/^\s*craft\(recipeId\)/m.test(src),
    "crafting.js must not expose public craft() method"
  );
});

// ─── New regression tests from pre-launch audit ─────────────────────────────

test("NEW-001: crafting.js uses key() wrapper for profile hget (BUG-001 fix)", () => {
  const src = readFile("backend/api/crafting.js");
  assert.ok(src, "backend/api/crafting.js must exist");
  // The hget call must include key() wrapping to match the double-prefix convention
  assert.ok(
    src.includes("redis.hget(key(`player:${wallet}`),") ||
    src.includes('redis.hget(key(`player:${wallet}`),'),
    "crafting.js must use key() wrapper in hget for player profile to prevent level-gate bypass"
  );
  // Must NOT use bare template literal without key()
  assert.ok(
    !src.includes("redis.hget(`player:${wallet}`"),
    "crafting.js must not call hget with bare key (missing key() wrapper)"
  );
});

test("NEW-002: scrap-nft.js uses a distributed NX lock (BUG-002 fix)", () => {
  const src = readFile("backend/api/scrap-nft.js");
  assert.ok(src, "backend/api/scrap-nft.js must exist");
  assert.ok(
    src.includes("scrap:lock:") && src.includes("NX: true"),
    "scrap-nft.js must use an NX Redis lock to prevent double-scrap race condition"
  );
});

test("NEW-003: player-nfts.js requires authMiddleware (BUG-003 fix)", () => {
  const src = readFile("backend/api/player-nfts.js");
  assert.ok(src, "backend/api/player-nfts.js must exist");
  assert.ok(
    src.includes("authMiddleware"),
    "player-nfts.js must use authMiddleware to prevent unauthenticated wallet enumeration"
  );
  assert.ok(
    src.includes("req.player.wallet"),
    "player-nfts.js must source wallet from req.player.wallet (not req.query)"
  );
});

test("NEW-004: quest-secrets.js requires authMiddleware (BUG-004 fix)", () => {
  const src = readFile("backend/api/quest-secrets.js");
  assert.ok(src, "backend/api/quest-secrets.js must exist");
  assert.ok(
    src.includes("authMiddleware"),
    "quest-secrets.js must use authMiddleware to prevent unauthenticated secret probing"
  );
  assert.ok(
    src.includes("req.player.wallet"),
    "quest-secrets.js must source wallet from req.player.wallet (not req.body)"
  );
});

test("NEW-005: fo4-dialogue.js escapes npcName in affinity popup (BUG-005 fix)", () => {
  const src = readFile("public/js/modules/fo4-dialogue.js");
  assert.ok(src, "public/js/modules/fo4-dialogue.js must exist");
  // escapeHtml must be called on npcName before inserting into the affinity popup
  assert.ok(
    src.includes("escapeHtml(npcName") || src.includes("safeName = escapeHtml("),
    "fo4-dialogue.js must escape npcName in _showAffinityChange() to prevent XSS"
  );
});

test("NEW-006: enemyScaling.js elite tier uses else-if (BUG-006 fix)", () => {
  const src = readFile("public/js/modules/enemyScaling.js");
  assert.ok(src, "public/js/modules/enemyScaling.js must exist");
  // Tier-2 check (< 0.03) must be the first branch, Tier-1 (< 0.10) the else-if
  // so they don't double-stack (+11 vs intended +7)
  const tier2Idx = src.indexOf("eliteRoll < 0.03");
  const tier1Idx = src.indexOf("eliteRoll < 0.10");
  assert.ok(
    tier2Idx !== -1 && tier1Idx !== -1 && tier2Idx < tier1Idx,
    "enemyScaling.js must check tier-2 (< 0.03) before tier-1 (< 0.10) to avoid double-stacking level bonus"
  );
  assert.ok(
    src.includes("} else if (eliteRoll < 0.10)"),
    "enemyScaling.js must use else-if for tier-1 to prevent double-stacking with tier-2"
  );
});

test("NEW-007: vats.js refunds AP for queued shots on cancel (BUG-011 fix)", () => {
  const src = readFile("public/js/modules/vats.js");
  assert.ok(src, "public/js/modules/vats.js must exist");
  // exitVATS must refund AP before clearing queuedShots
  assert.ok(
    src.includes("VATS.actionPoints + shot.apCost") ||
    src.includes("actionPoints + shot.apCost"),
    "vats.js exitVATS() must refund AP for queued (unexecuted) shots on cancel"
  );
});

test("NEW-008: quests.js enforces max active quest limit (BUG-013 fix)", () => {
  const src = readFile("backend/api/quests.js");
  assert.ok(src, "backend/api/quests.js must exist");
  assert.ok(
    src.includes("MAX_ACTIVE_QUESTS"),
    "quests.js must enforce a maximum number of simultaneous active quests"
  );
});

test("NEW-009: lootTable.js caps level-scaled tier probabilities (BUG-014 fix)", () => {
  const src = readFile("backend/lib/lootTable.js");
  assert.ok(src, "backend/lib/lootTable.js must exist");
  assert.ok(
    src.includes("Math.min(0.15,") && src.includes("Math.min(0.25,") && src.includes("Math.min(0.35,"),
    "lootTable.js must cap nft/legendary/epic probabilities to prevent common loot from disappearing at high levels"
  );
});

test("NEW-010: crafting.js uses NX lock for cooldown atomicity (BUG-016 fix)", () => {
  const src = readFile("backend/api/crafting.js");
  assert.ok(src, "backend/api/crafting.js must exist");
  assert.ok(
    src.includes("craft:lock:") && src.includes("NX: true"),
    "crafting.js must use an NX lock around the cooldown check/write to prevent double-craft race condition"
  );
});

test("NEW-011: loot-voucher.js requires authMiddleware (BUG-008 fix)", () => {
  const src = readFile("backend/api/loot-voucher.js");
  assert.ok(src, "backend/api/loot-voucher.js must exist");
  assert.ok(
    src.includes("authMiddleware"),
    "loot-voucher.js must require auth to prevent unauthenticated voucher generation"
  );
});

test("NEW-012: auth.js session lookup requires authMiddleware (SEC-011 fix)", () => {
  const src = readFile("backend/lib/auth.js");
  assert.ok(src, "backend/lib/auth.js must exist");
  // The session/:sessionId route must now use authMiddleware
  const sessionRouteIdx = src.indexOf('router.get("/session/:sessionId"');
  assert.ok(sessionRouteIdx !== -1, "auth.js must define GET /session/:sessionId route");
  const routeSnippet = src.slice(sessionRouteIdx, sessionRouteIdx + 100);
  assert.ok(
    routeSnippet.includes("authMiddleware"),
    "GET /session/:sessionId must require authMiddleware to prevent wallet deanonymization"
  );
});

test("NEW-013: wallet.js sessions use auth:session namespace (SEC-002 fix)", () => {
  const src = readFile("backend/routes/wallet.js");
  assert.ok(src, "backend/routes/wallet.js must exist");
  // wallet.js must no longer store sessions in the incompatible wallet:session:* namespace
  assert.ok(
    !src.includes('"wallet:session:'),
    "wallet.js must not store sessions in wallet:session: namespace — use storeSession() from lib/auth.js"
  );
  assert.ok(
    src.includes("storeSession"),
    "wallet.js must use storeSession() from lib/auth.js for session creation"
  );
});

test("NEW-014: gps.js does not leak raw error messages (SEC-009 fix)", () => {
  const src = readFile("backend/api/gps.js");
  assert.ok(src, "backend/api/gps.js must exist");
  assert.ok(
    !src.includes("err.message") || !src.match(/json\([^)]*err\.message/),
    "gps.js must not return raw err.message to clients (information disclosure)"
  );
});

test("NEW-015: npc-context.js does not leak raw error details (SEC-009 fix)", () => {
  const src = readFile("backend/api/npc-context.js");
  assert.ok(src, "backend/api/npc-context.js must exist");
  assert.ok(
    !src.includes("detail: err.message"),
    "npc-context.js must not return raw err.message as 'detail' field to clients"
  );
});

test("BUG-021: dungeon.js _connectRooms call site uses declared variable names (not _roomW/_roomH/_gap)", () => {
  const src = readFile("public/js/modules/dungeon.js");
  assert.ok(src, "public/js/modules/dungeon.js must exist");
  // The _connectRooms function signature uses _roomW/_roomH/_gap as intentionally-unused
  // parameter names (convention). The bug was at the CALL site which passed undeclared
  // _roomW/_roomH/_gap instead of the declared constants roomW/roomH/gap.
  assert.ok(
    src.includes("_connectRooms(positions, roomW, roomH, gap)"),
    "dungeon.js must pass declared roomW/roomH/gap (not undeclared _roomW/_roomH/_gap) at the _connectRooms call site"
  );
});

test("BUG-022: dungeon.js hub template has no disconnected island room", () => {
  const src = readFile("public/js/modules/dungeon.js");
  assert.ok(src, "public/js/modules/dungeon.js must exist");
  // The old bug placed a room at (2,2) in the hub template which had no adjacent neighbours
  // and was permanently unreachable. It should be replaced with (1,2) which connects to
  // (0,2) and (1,1).
  const hubMatch = src.match(/name:\s*["']hub["'][\s\S]*?positions:\s*\[([\s\S]*?)\]/);
  assert.ok(hubMatch, "dungeon.js must contain a 'hub' template with positions array");
  assert.ok(
    !hubMatch[1].includes("row: 2, col: 2"),
    "hub template must not contain isolated room at (2,2) — it had zero door connections"
  );
});

test("BUG-023: crafting.js consumeIngredient handles flat-array inventory (PlayerState format)", () => {
  const src = readFile("public/js/modules/crafting.js");
  assert.ok(src, "public/js/modules/crafting.js must exist");
  assert.ok(
    // Match Array.isArray(inv) specifically within the consumeIngredient method body
    // to avoid false positives from other Array.isArray calls elsewhere in the file
    // (e.g. hasIngredient also uses Array.isArray).
    /consumeIngredient\s*\([^)]*\)\s*\{[\s\S]*?Array\.isArray\s*\(\s*inv\s*\)/.test(src),
    "crafting.js consumeIngredient must handle flat-array inventory to prevent free infinite crafting"
  );
});

test("BUG-024: quests.js item rewards awarded locally (client authoritative for items)", () => {
  const src = readFile("public/js/modules/quests.js");
  assert.ok(src, "public/js/modules/quests.js must exist");
  assert.ok(
    !src.includes("!backendAppliedRewards && r.items"),
    "quests.js must not gate item rewards on backendAppliedRewards — client is authoritative for items"
  );
  assert.ok(
    src.includes("r.items && Array.isArray(r.items)"),
    "quests.js must always apply item rewards locally regardless of backend response"
  );
});

test("BUG-025: player-state.js awardCaps guards against NaN (isFinite check)", () => {
  const src = readFile("public/js/game/player-state.js");
  assert.ok(src, "public/js/game/player-state.js must exist");
  assert.ok(
    src.includes("Number.isFinite(amount)"),
    "player-state.js awardCaps must use Number.isFinite to reject NaN — typeof NaN === 'number' passes naive guard"
  );
});

test("BUG-026: player-state.js awardXP enforces MAX_LEVEL cap in frontend", () => {
  const src = readFile("public/js/game/player-state.js");
  assert.ok(src, "public/js/game/player-state.js must exist");
  assert.ok(
    src.includes("_state.level < MAX_LEVEL"),
    "player-state.js awardXP must enforce MAX_LEVEL cap to prevent level > 100 in frontend"
  );
});

test("BUG-027: player-state.js addItem enforces MAX_INVENTORY_SIZE (200) cap", () => {
  const src = readFile("public/js/game/player-state.js");
  assert.ok(src, "public/js/game/player-state.js must exist");
  assert.ok(
    src.includes("MAX_INVENTORY_SIZE"),
    "player-state.js addItem must enforce inventory size cap to prevent unbounded localStorage growth"
  );
  assert.ok(
    src.includes("_state.inventory.length >= MAX_INVENTORY_SIZE"),
    "player-state.js addItem must check inventory length against MAX_INVENTORY_SIZE before adding new slot"
  );
});

test("BUG-028: location-claim.js claimRadius 0 uses typeof check (not falsy ||)", () => {
  const src = readFile("backend/api/location-claim.js");
  assert.ok(src, "backend/api/location-claim.js must exist");
  assert.ok(
    src.includes("typeof location.claimRadius === \"number\""),
    "location-claim.js must use typeof check for claimRadius so 0 is not treated as falsy (100m default)"
  );
});

test("BUG-029: npcEncounter.js ambient comments use two independent random values", () => {
  const src = readFile("public/js/modules/npcEncounter.js");
  assert.ok(src, "public/js/modules/npcEncounter.js must exist");
  assert.ok(
    src.includes("Uint32Array(2)"),
    "npcEncounter.js ambient comment must generate 2 independent random values — using same value for gate+index biases toward last 2 comments"
  );
});

test("BUG-030: crafting backend daily limit uses atomic INCR-before-check (no TOCTOU) in craft handler", () => {
  const src = readFile("backend/api/crafting.js");
  assert.ok(src, "backend/api/crafting.js must exist");
  // Extract just the POST /craft handler body (between the route handler and the cooldowns handler)
  // The atomic pattern requires: INCR the count, check if over limit, DECR+reject if so.
  // The old TOCTOU pattern was: GET count → check → later INCR (allows race condition).
  assert.ok(
    src.includes("await redis.incr(countKey)") && src.includes("await redis.decr(countKey)"),
    "crafting.js daily limit must use atomic INCR-before-check with DECR rollback to prevent TOCTOU race"
  );
  // The non-atomic pattern (GET → check → later INCR) must not exist in the craft limit block.
  // Note: redis.get(countKey) legitimately appears in the read-only cooldowns status endpoint — that is fine.
  // Ensure the craft limit enforcement block uses the atomic pattern (newCount > maxPerDay check).
  assert.ok(
    src.includes("newCount > maxPerDay"),
    "crafting.js daily limit enforcement must check newCount from INCR (not a pre-read todayCount)"
  );
});

// ─── Playtest Security Hardening (wallet.js + nuke.js) ───────────────────

console.log("\n[10] Wallet route security hardening (playtest fixes)");

test("SEC-WALLET-001: wallet.js verify handler is wrapped in outer try/catch", () => {
  const src = readFile("backend/routes/wallet.js");
  assert.ok(src, "backend/routes/wallet.js must exist");
  // Outer try/catch prevents nacl exceptions from crashing the server
  assert.ok(
    src.includes('[wallet] verify error') &&
    src.includes("Verification failed"),
    "wallet.js verify handler must have outer try/catch with error logging"
  );
});

test("SEC-WALLET-002: wallet.js verify validates pubKey and signature byte lengths before nacl call", () => {
  const src = readFile("backend/routes/wallet.js");
  assert.ok(src, "backend/routes/wallet.js must exist");
  assert.ok(
    src.includes("pubKeyBytes.length !== 32") && src.includes("sigBytes.length !== 64"),
    "wallet.js must validate pubKeyBytes.length === 32 and sigBytes.length === 64 before nacl call"
  );
});

test("SEC-WALLET-003: wallet.js verify validates input length bounds", () => {
  const src = readFile("backend/routes/wallet.js");
  assert.ok(src, "backend/routes/wallet.js must exist");
  assert.ok(
    src.includes("signature.length > 512"),
    "wallet.js verify must enforce max signature length of 512 chars to prevent DoS"
  );
});

test("SEC-WALLET-004: wallet.js session endpoint requires authMiddleware (no unauthenticated wallet lookup)", () => {
  const src = readFile("backend/routes/wallet.js");
  assert.ok(src, "backend/routes/wallet.js must exist");
  assert.ok(
    src.includes("authMiddleware"),
    "wallet.js session route must include authMiddleware"
  );
  // Self-only enforcement: sessionId !== req.player.sessionId must be present
  assert.ok(
    src.includes("sessionId !== req.player.sessionId"),
    "wallet.js session route must enforce self-only lookup: sessionId !== req.player.sessionId"
  );
  assert.ok(
    src.includes("Forbidden"),
    "wallet.js session route must return 403 Forbidden for cross-session lookup attempts"
  );
});

test("SEC-WALLET-005: wallet.js nonce is deleted BEFORE session is created (reduces TOCTOU window)", () => {
  const src = readFile("backend/routes/wallet.js");
  assert.ok(src, "backend/routes/wallet.js must exist");
  // deleteNonce must appear before storeSession in the verify handler
  const deleteIdx = src.indexOf("deleteNonce(publicKey)");
  const storeIdx  = src.indexOf("storeSession(sessionId");
  assert.ok(
    deleteIdx !== -1 && storeIdx !== -1 && deleteIdx < storeIdx,
    "wallet.js must deleteNonce() before storeSession() to reduce TOCTOU race window"
  );
});

test("SEC-WALLET-006: nuke.js reads wallet from 'wallet' key (matches authClient.js storage)", () => {
  const src = readFile("public/js/nuke.js");
  assert.ok(src, "public/js/nuke.js must exist");
  assert.ok(
    !src.includes("fizz_wallet_address"),
    "nuke.js must not read stale 'fizz_wallet_address' localStorage key — use 'wallet' key written by authClient.js"
  );
  assert.ok(
    src.includes('localStorage.getItem("wallet")'),
    "nuke.js must read wallet address from localStorage key 'wallet' (set by authClient.saveSession)"
  );
});

// ─── 11. Playtest & Audit Bug Fixes (BUG-031 through BUG-039 + SEC-AUDIT) ────

console.log("\n[11] Playtest & audit fixes (BUG-031 through BUG-039 + SEC-AUDIT)");

test("BUG-031: cooldowns.js TTL lookup uses key() wrapper (matches double-prefixed writer)", () => {
  const src = readFile("backend/api/cooldowns.js");
  assert.ok(src, "backend/api/cooldowns.js must exist");
  // Must call key() around the ttl argument — not raw bare string
  assert.ok(
    src.includes("redis.ttl(key(") || src.match(/ttl\s*\(\s*key\s*\(/),
    "cooldowns.js redis.ttl() must wrap key path with key() to match double-prefixed writer"
  );
});

test("BUG-032: fizz-fun.js bonding curve uses BigInt for constant product calculations", () => {
  const src = readFile("backend/api/fizz-fun.js");
  assert.ok(src, "backend/api/fizz-fun.js must exist");
  // calculateBuyReturn must use BigInt() to avoid Number.MAX_SAFE_INTEGER overflow
  assert.ok(
    src.includes("BigInt(") && src.includes("calculateBuyReturn"),
    "fizz-fun.js calculateBuyReturn must use BigInt to prevent float precision loss on large trades"
  );
});

test("BUG-033: dungeon.js /clear uses atomic NX set (no TOCTOU double-clear)", () => {
  const src = readFile("backend/api/dungeon.js");
  assert.ok(src, "backend/api/dungeon.js must exist");
  // The old GET-then-SET pattern allowed concurrent double-award.
  // The fix uses a single NX set, same as the /loot endpoint.
  assert.ok(
    src.includes("NX: true") || src.includes("NX:true"),
    "dungeon.js /clear must use atomic NX set to prevent concurrent double-clear exploitation"
  );
  // Old vulnerable GET-then-SET must be gone
  assert.ok(
    !src.match(/redis\.get\(key\(clearKey\)[^)]*\)[^{]*\n[^A-Za-z]*if.*alreadyCleared/),
    "dungeon.js /clear must not use vulnerable GET-then-SET idempotency pattern"
  );
});

test("BUG-034: battles.js enemyAttack() returns early if active enemy is already dead", () => {
  const src = readFile("public/js/modules/battles.js");
  assert.ok(src, "public/js/modules/battles.js must exist");
  // Must guard against dead enemy attacking — prevents LOSE-on-WIN state flip
  assert.ok(
    src.includes("ENEMY_DEAD") || src.match(/enemyHp\[idx\]\s*<=\s*0/),
    "battles.js enemyAttack() must guard against dead enemies dealing damage after all enemies are defeated"
  );
});

test("BUG-035: loot-voucher.js does not hardcode lootId to 1n", () => {
  const src = readFile("backend/api/loot-voucher.js");
  assert.ok(src, "backend/api/loot-voucher.js must exist");
  assert.ok(
    !src.includes("const lootId = 1n") && !src.match(/lootId\s*=\s*1n\s*;/),
    "loot-voucher.js must not hardcode lootId to 1n — every voucher had identical loot, bypassing the tier system"
  );
});

test("BUG-036: loot-voucher.js returns { voucher, signature } structure (not flat payload)", () => {
  const src = readFile("backend/api/loot-voucher.js");
  assert.ok(src, "backend/api/loot-voucher.js must exist");
  // Must include voucherId and keyId so redeem-voucher.js can verify
  assert.ok(
    src.includes("voucherId") && src.includes("keyId"),
    "loot-voucher.js must include voucherId and keyId in the voucher (required by redeem-voucher.js)"
  );
  // Must return nested { voucher: {...}, signature: [...] } structure
  assert.ok(
    src.includes("voucher,") || src.includes("voucher:"),
    "loot-voucher.js must return { voucher, signature } structure matching redeem-voucher.js expectations"
  );
});

test("BUG-036: loot-voucher.js does NOT return legacy flat serverSignature field", () => {
  const src = readFile("backend/api/loot-voucher.js");
  assert.ok(src, "backend/api/loot-voucher.js must exist");
  assert.ok(
    !src.includes("serverSignature:"),
    "loot-voucher.js must not use old flat 'serverSignature' field — use { voucher, signature } structure"
  );
});

test("BUG-037: game loop ENCOUNTER_CHANCE is at most 0.15 (production-appropriate, not 0.55)", () => {
  const src = readFile("public/js/game/loop.js");
  assert.ok(src, "public/js/game/loop.js must exist");
  // Extract the constant value and ensure it's not the 0.55 test value
  const match = src.match(/const\s+ENCOUNTER_CHANCE\s*=\s*([\d.]+)/);
  assert.ok(match, "public/js/game/loop.js must define ENCOUNTER_CHANCE constant");
  const rate = parseFloat(match[1]);
  assert.ok(
    rate <= 0.15,
    `ENCOUNTER_CHANCE=${rate} is too high for production; max allowed is 0.15 (was 0.55, causing battle every ~9s)`
  );
});

test("SEC-AUDIT-001: Solana program lib.rs uses u128 for bonding curve arithmetic (not raw u64 multiply)", () => {
  const src = readFile("programs/fizzcaps-onchain/src/lib.rs");
  assert.ok(src, "programs/fizzcaps-onchain/src/lib.rs must exist");
  // u128 cast must be present for the constant-product k = virtualSol * tokenReserve
  // Virtual SOL (30e9) * token_reserve (800e15) = 2.4e28 > u64::MAX → panic without u128
  assert.ok(
    src.includes("as u128"),
    "lib.rs bonding curve must cast to u128 before multiplying to avoid u64 overflow"
  );
  // Old unchecked unwrap pattern that caused the panic must be gone
  assert.ok(
    !src.match(/checked_mul\(curve\.token_reserve\)\.unwrap\(\)/),
    "lib.rs must not use checked_mul(token_reserve).unwrap() — overflows u64 and panics on every trade"
  );
});

test("SEC-AUDIT-002: Solana program ClaimLoot server_key is constrained to config.server_key", () => {
  const src = readFile("programs/fizzcaps-onchain/src/lib.rs");
  assert.ok(src, "programs/fizzcaps-onchain/src/lib.rs must exist");
  // server_key must be address-constrained so attackers can't supply their own keypair
  assert.ok(
    src.includes("config.server_key"),
    "lib.rs ClaimLoot.server_key must be constrained to config.server_key to prevent forged loot vouchers"
  );
});

test("SEC-AUDIT-003: Solana program FizzBondingCurve struct includes graduated_at field", () => {
  const src = readFile("programs/fizzcaps-onchain/src/lib.rs");
  assert.ok(src, "programs/fizzcaps-onchain/src/lib.rs must exist");
  // graduated_at must exist in the struct definition (was missing, causing compile error)
  assert.ok(
    src.includes("graduated_at"),
    "lib.rs FizzBondingCurve must include graduated_at field (was missing — fizz_graduate set it causing compile error)"
  );
  // curve.symbol reference in non-comment code must be removed (field doesn't exist)
  // Filter out comment lines before checking
  const nonCommentLines = src.split("\n").filter(l => !l.trim().startsWith("//"));
  const nonCommentSrc = nonCommentLines.join("\n");
  assert.ok(
    !nonCommentSrc.includes("curve.symbol"),
    "lib.rs must not reference curve.symbol in code (field does not exist on FizzBondingCurve)"
  );
  // The fizz_graduate msg! should use curve.token_mint instead
  assert.ok(
    src.includes("curve.token_mint") && src.includes("graduated!"),
    "lib.rs fizz_graduate msg! must use curve.token_mint (not curve.symbol) in graduation log"
  );
});

test("SEC-AUDIT-004: Solana program FizzBuyTokens curve_token_vault has associated_token constraint", () => {
  const src = readFile("programs/fizzcaps-onchain/src/lib.rs");
  assert.ok(src, "programs/fizzcaps-onchain/src/lib.rs must exist");
  // curve_token_vault in FizzBuyTokens must be constrained to bonding_curve's ATA
  assert.ok(
    src.includes("associated_token::authority = bonding_curve"),
    "lib.rs curve_token_vault must be constrained to bonding_curve authority to prevent wrong-vault substitution"
  );
});

test("SEC-AUDIT-005: Solana program FizzSellTokens treasury is constrained to config.treasury", () => {
  const src = readFile("programs/fizzcaps-onchain/src/lib.rs");
  assert.ok(src, "programs/fizzcaps-onchain/src/lib.rs must exist");
  // FizzSellTokens must include config and constrain treasury address
  // Previously config was missing and treasury had no address constraint
  assert.ok(
    src.includes("InvalidTreasury"),
    "lib.rs FizzSellTokens treasury must be constrained with InvalidTreasury error to prevent fee redirection"
  );
});

test("SEC-AUDIT-006: loot-voucher.js validates GPS proximity before signing voucher", () => {
  const src = readFile("backend/api/loot-voucher.js");
  assert.ok(src, "backend/api/loot-voucher.js must exist");
  assert.ok(
    src.includes("not_near_poi") || src.includes("nearbyPOI") || src.includes("findNearbyPOI"),
    "loot-voucher.js must check GPS proximity before signing voucher (prevents couch-farming)"
  );
});

test("SEC-AUDIT-008: Solana program claim_loot validates voucher timestamp freshness", () => {
  const src = readFile("programs/fizzcaps-onchain/src/lib.rs");
  assert.ok(src, "programs/fizzcaps-onchain/src/lib.rs must exist");
  // VoucherExpired error must be defined and used
  assert.ok(
    src.includes("VoucherExpired"),
    "lib.rs claim_loot must validate voucher timestamp freshness with VoucherExpired error"
  );
});

// ─── BUG-041–048: Crypto-side playtest regression tests ────────────────────

console.log("\n[12] BUG-041–048: Crypto-side playtest fixes");

test("BUG-041: mint-item.js uses atomic redis.incr for daily limit (no TOCTOU)", () => {
  const src = readFile("backend/api/mint-item.js");
  assert.ok(src, "backend/api/mint-item.js must exist");
  assert.ok(
    src.includes("redis.incr(") || src.includes(".incr("),
    "mint-item.js must use atomic redis.incr() for daily limit counter (prevents TOCTOU race)"
  );
  assert.ok(
    !src.includes("redis.get(walletKey") && !src.includes("const cur = parseInt(await redis.get"),
    "mint-item.js must NOT use non-atomic GET+SET pattern for daily limit"
  );
});

test("BUG-041: mint-item.js rolls back incr when limit exceeded", () => {
  const src = readFile("backend/api/mint-item.js");
  assert.ok(src, "backend/api/mint-item.js must exist");
  assert.ok(
    src.includes("redis.decr("),
    "mint-item.js must roll back (decr) the counter when the daily limit is exceeded"
  );
});

test("BUG-042: loot-voucher.js includes caps in signed voucher (tiered rewards)", () => {
  const src = readFile("backend/api/loot-voucher.js");
  assert.ok(src, "backend/api/loot-voucher.js must exist");
  assert.ok(
    src.includes("capsReward") && src.includes("caps: capsReward"),
    "loot-voucher.js must calculate tiered CAPS reward and include it in the signed voucher"
  );
  assert.ok(
    src.includes("RARITY_CAPS") || src.includes("poiRarity"),
    "loot-voucher.js must derive CAPS reward from POI rarity"
  );
});

test("BUG-042: redeem-voucher.js uses voucher.caps (not LOOT_ID_TO_CAPS string parse)", () => {
  const src = readFile("backend/api/redeem-voucher.js");
  assert.ok(src, "backend/api/redeem-voucher.js must exist");
  assert.ok(
    src.includes("voucher.caps"),
    "redeem-voucher.js must use voucher.caps (signed by server) for the CAPS amount"
  );
  assert.ok(
    !src.includes("LOOT_ID_TO_CAPS"),
    "redeem-voucher.js must not use LOOT_ID_TO_CAPS comma-delimited string lookup (broken format)"
  );
});

test("BUG-042: gps.js serializeVoucherMessage includes caps field when present", () => {
  const src = readFile("backend/lib/gps.js");
  assert.ok(src, "backend/lib/gps.js must exist");
  assert.ok(
    src.includes("voucher.caps"),
    "gps.js serializeVoucherMessage must include caps in the signed message when present"
  );
});

test("BUG-043: loot-voucher.js uses expanded lootId range (>= 2^40) to reduce PDA collisions", () => {
  const src = readFile("backend/api/loot-voucher.js");
  assert.ok(src, "backend/api/loot-voucher.js must exist");
  // Old range was 1_000_000; new range must be at least 2^40 to reduce birthday paradox risk
  assert.ok(
    !src.includes("randomInt(1, 1000000)"),
    "loot-voucher.js must not use 1,000,000 lootId range (birthday paradox collision risk)"
  );
  assert.ok(
    src.includes("2 ** 48") || src.includes("2**48") || src.includes("281474976710656"),
    "loot-voucher.js must use a large lootId range (>= 2^48) to minimize PDA seed collisions"
  );
});

test("BUG-044: redeem-voucher.js VOUCHER_USED_KEY uses redis.key() for namespace consistency", () => {
  const src = readFile("backend/api/redeem-voucher.js");
  assert.ok(src, "backend/api/redeem-voucher.js must exist");
  assert.ok(
    src.includes("redis.key(") && src.includes("voucher:used:"),
    "redeem-voucher.js VOUCHER_USED_KEY must call redis.key() so voucher-used keys " +
    "follow the same double-prefix namespace as all other app keys (prevents orphaned replay-protection keys)"
  );
});

test("BUG-046: caps.js GET /:wallet has rate limiter (prevents bulk enumeration)", () => {
  const src = readFile("backend/api/caps.js");
  assert.ok(src, "backend/api/caps.js must exist");
  assert.ok(
    src.includes("capsBalanceLimiter") || src.includes("balanceLimiter"),
    "caps.js GET /:wallet must have a rate limiter to prevent bulk wallet enumeration"
  );
});

test("BUG-047: player-state.js awardCaps enforces MAX_CAPS ceiling (999_999_999)", () => {
  const src = readFile("public/js/game/player-state.js");
  assert.ok(src, "public/js/game/player-state.js must exist");
  assert.ok(
    src.includes("MAX_CAPS") && src.includes("999_999_999"),
    "player-state.js awardCaps must enforce MAX_CAPS = 999_999_999 ceiling to match backend"
  );
  assert.ok(
    src.includes("Math.min(") && src.includes("MAX_CAPS"),
    "player-state.js awardCaps must use Math.min(..., MAX_CAPS) to cap the balance"
  );
});

test("BUG-047: dungeon.js client-side caps assignment enforces MAX_CAPS ceiling", () => {
  const src = readFile("public/js/modules/dungeon.js");
  assert.ok(src, "public/js/modules/dungeon.js must exist");
  assert.ok(
    src.includes("MAX_CAPS") && src.includes("Math.min("),
    "dungeon.js must apply Math.min(..., MAX_CAPS) when updating player.caps from API response"
  );
});

test("BUG-048: scrap-nft.js uses per-NFT lock key (wallet+mint, not wallet-only)", () => {
  const src = readFile("backend/api/scrap-nft.js");
  assert.ok(src, "backend/api/scrap-nft.js must exist");
  assert.ok(
    src.includes("`scrap:lock:${walletAddress}:${nftMint}`"),
    "scrap-nft.js lock must be per-NFT (wallet + nftMint) so concurrent scraps of different NFTs are not blocked"
  );
  assert.ok(
    !src.includes("`scrap:lock:${walletAddress}`"),
    "scrap-nft.js must not use wallet-only scrap lock (over-broad: blocks all scrap ops for 15s)"
  );
});

// ─── Summary ──────────────────────────────────────────────────────────────

console.log("\n─────────────────────────────────────────");
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log("\nFailed tests:");
  failures.forEach((f) => console.error(`  ✗ ${f.name}: ${f.message}`));
  process.exit(1);
} else {
  console.log("All security tests passed. The Wasteland is (somewhat) safe.\n");
  process.exit(0);
}
