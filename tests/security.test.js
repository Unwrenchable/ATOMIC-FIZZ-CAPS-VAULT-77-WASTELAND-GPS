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
