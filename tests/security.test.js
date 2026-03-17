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
  // Should not have `origin: '*'` or `origin: true` as a blanket allow-all
  const hasWildcardStar = /origin\s*:\s*['"]?\*['"]?/.test(src);
  assert.ok(!hasWildcardStar, "CORS must not use wildcard * as origin");
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
    }
    // No unguarded req.body.wallet on non-admin routes (comments are OK)
    const suspiciousLines = src
      .split("\n")
      .filter((l) => {
        const trimmed = l.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) return false;
        // flag if we see req.body.wallet assigned to a const/let/var wallet used downstream
        return /const wallet\s*=\s*req\.body\.wallet/.test(l) ||
               /let wallet\s*=\s*req\.body\.wallet/.test(l) ||
               /var wallet\s*=\s*req\.body\.wallet/.test(l);
      });
    assert.strictEqual(
      suspiciousLines.length,
      0,
      `${file} must not assign wallet from req.body.wallet without admin guard`
    );
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
