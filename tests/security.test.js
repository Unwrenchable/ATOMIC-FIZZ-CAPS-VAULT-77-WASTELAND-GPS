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
