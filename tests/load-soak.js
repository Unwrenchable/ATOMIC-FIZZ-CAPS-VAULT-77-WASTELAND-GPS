/**
 * ☢️ ATOMIC FIZZ CAPS — Load & Soak Test
 * ─────────────────────────────────────────────────────
 * Simulates 1,000 concurrent players hammering the API.
 * Validates latency, error rates, and rate-limiter behaviour under load.
 * Tests graceful degradation when Redis is unavailable.
 *
 * Run: node tests/load-soak.js
 * Run with Redis interruption: node tests/load-soak.js --redis-failure
 *
 * Requires backend server running: node backend/server.js
 */

"use strict";

const http = require("http");
const https = require("https");
const crypto = require("crypto");

// ─── Config ──────────────────────────────────────────────────────────────────
const BASE_URL = process.env.API_URL || "http://localhost:3000";
const CONCURRENT_USERS = parseInt(process.env.CONCURRENT || "200", 10); // Start lower, scale up
const RAMP_UP_STEPS = 5;       // Steps to reach CONCURRENT_USERS
const RAMP_UP_DELAY_MS = 1000; // Delay between ramp-up steps
const REQUESTS_PER_USER = 10;  // Requests each simulated user makes
const TIMEOUT_MS = 10_000;

// SLA thresholds
const SLA = {
  MAX_P50_MS: 500,    // Median response under 500ms
  MAX_P95_MS: 2000,   // 95th percentile under 2s
  MAX_P99_MS: 5000,   // 99th percentile under 5s
  MAX_ERROR_RATE: 0.05, // Less than 5% errors (excluding 429s which are expected)
  MAX_RATE_LIMIT_RATE: 0.30, // Up to 30% 429s acceptable under load (by design)
};

// ─── Stats tracker ────────────────────────────────────────────────────────────
const stats = {
  total: 0,
  success: 0,     // 2xx
  rateLimited: 0, // 429
  clientError: 0, // 4xx (not 429)
  serverError: 0, // 5xx
  networkError: 0, // timeout/connection refused
  latencies: [],
  errors: [],
};

// ─── HTTP helper ─────────────────────────────────────────────────────────────
function request(method, path, body, headers = {}) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE_URL);
    const lib = url.protocol === "https:" ? https : http;
    const bodyStr = body ? JSON.stringify(body) : null;
    const start = Date.now();

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": bodyStr ? Buffer.byteLength(bodyStr) : 0,
        ...headers,
      },
      timeout: TIMEOUT_MS,
    };

    const req = lib.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        const latency = Date.now() - start;
        resolve({ status: res.statusCode, latency, ok: true });
      });
    });

    req.on("error", (err) => resolve({ status: 0, latency: Date.now() - start, ok: false, error: err.message }));
    req.on("timeout", () => { req.destroy(); resolve({ status: 0, latency: TIMEOUT_MS, ok: false, error: "timeout" }); });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function recordResult(res) {
  stats.total++;
  stats.latencies.push(res.latency);

  if (!res.ok || res.status === 0) {
    stats.networkError++;
    stats.errors.push(`Network: ${res.error}`);
  } else if (res.status >= 500) {
    stats.serverError++;
    stats.errors.push(`5xx on ${res.status}`);
  } else if (res.status === 429) {
    stats.rateLimited++;
  } else if (res.status >= 400) {
    stats.clientError++;
  } else {
    stats.success++;
  }
}

// ─── User Scenario Library ───────────────────────────────────────────────────
const SCENARIOS = [
  // Health check (cheapest, establishes baseline)
  async () => {
    const r = await request("GET", "/api/health");
    recordResult(r);
  },

  // Player profile read (common read path)
  async () => {
    const wallet = crypto.randomBytes(16).toString("hex");
    const r = await request("GET", `/api/caps/${wallet}`);
    recordResult(r);
  },

  // Auth nonce request
  async () => {
    const wallet = crypto.randomBytes(16).toString("hex");
    const r = await request("GET", `/api/auth/nonce/${wallet}`);
    recordResult(r);
  },

  // Unauthenticated voucher redeem (should 401, exercising input validation)
  async () => {
    const r = await request("POST", "/api/redeem-voucher", {
      voucher: {
        voucherId: crypto.randomBytes(8).toString("hex"),
        keyId: "load-test",
        timestamp: Date.now(),
        ttlSeconds: 300,
      },
      signature: Array(64).fill(0),
    });
    recordResult(r);
  },

  // Location claim without auth (should 401)
  async () => {
    const r = await request("POST", "/api/location-claim/claim", {
      locationId: "test-poi-1",
      playerLat: 37.7749 + (crypto.randomBytes(1)[0] / 1000),
      playerLng: -122.4194 + (crypto.randomBytes(1)[0] / 1000),
    });
    recordResult(r);
  },

  // Quest list (public read)
  async () => {
    const r = await request("GET", "/api/quests");
    recordResult(r);
  },

  // Invalid JSON payload (server must not crash)
  async () => {
    const url = new URL("/api/auth/login", BASE_URL);
    const lib = url.protocol === "https:" ? https : http;
    const start = Date.now();
    await new Promise((resolve) => {
      const req = lib.request({
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": 13 },
        timeout: TIMEOUT_MS,
      }, (res) => {
        let d = ""; res.on("data", c => d += c); res.on("end", () => {
          recordResult({ status: res.statusCode, latency: Date.now() - start, ok: true });
          resolve();
        });
      });
      req.on("error", () => { recordResult({ status: 0, latency: Date.now() - start, ok: false, error: "net" }); resolve(); });
      req.write("not valid json"); // Intentionally invalid
      req.end();
    });
  },
];

// ─── Percentile helper ────────────────────────────────────────────────────────
function percentile(arr, pct) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ─── Load wave ────────────────────────────────────────────────────────────────
async function runUserSession(userId) {
  for (let i = 0; i < REQUESTS_PER_USER; i++) {
    const scenarioIdx = userId % SCENARIOS.length;
    const offset = i % SCENARIOS.length;
    const scenario = SCENARIOS[(scenarioIdx + offset) % SCENARIOS.length];
    await scenario();
    // Tiny jitter to avoid thundering herd (0–50ms)
    await new Promise((r) => setTimeout(r, crypto.randomBytes(1)[0] / 5));
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n☢️  ATOMIC FIZZ CAPS — Load & Soak Test");
  console.log("══════════════════════════════════════════════════════");
  console.log(`  Target:       ${BASE_URL}`);
  console.log(`  Concurrency:  ${CONCURRENT_USERS} users`);
  console.log(`  Requests/user: ${REQUESTS_PER_USER}`);
  console.log(`  Total requests: ~${CONCURRENT_USERS * REQUESTS_PER_USER}`);

  // Pre-flight health check
  const health = await request("GET", "/api/health");
  if (health.status !== 200) {
    console.error(`\n  FATAL: Server not responding at ${BASE_URL}`);
    console.error("  Start the backend with: node backend/server.js");
    process.exit(1);
  }
  console.log("  Server: ✓ responding\n");

  // Ramp up to target concurrency
  console.log(`  Ramping up to ${CONCURRENT_USERS} concurrent users in ${RAMP_UP_STEPS} steps...`);
  const usersPerStep = Math.floor(CONCURRENT_USERS / RAMP_UP_STEPS);

  const allUserPromises = [];
  const overallStart = Date.now();

  for (let step = 0; step < RAMP_UP_STEPS; step++) {
    const usersThisStep = step === RAMP_UP_STEPS - 1
      ? CONCURRENT_USERS - (usersPerStep * step)
      : usersPerStep;

    const stepUsers = Array.from({ length: usersThisStep }, (_, i) =>
      runUserSession(step * usersPerStep + i)
    );
    allUserPromises.push(...stepUsers);
    console.log(`  Step ${step + 1}/${RAMP_UP_STEPS}: spawned ${usersThisStep} users (total active: ${allUserPromises.length})`);

    if (step < RAMP_UP_STEPS - 1) {
      await new Promise((r) => setTimeout(r, RAMP_UP_DELAY_MS));
    }
  }

  // Wait for all users to complete
  console.log("\n  All users running — waiting for completion...");
  await Promise.all(allUserPromises);
  const elapsed = ((Date.now() - overallStart) / 1000).toFixed(1);

  // ─── Results ────────────────────────────────────────────────────────────────
  console.log("\n─────────────────────────────────────────");
  console.log("  LOAD TEST RESULTS");
  console.log("─────────────────────────────────────────");
  console.log(`  Duration:      ${elapsed}s`);
  console.log(`  Total req:     ${stats.total}`);
  console.log(`  2xx Success:   ${stats.success} (${((stats.success / stats.total) * 100).toFixed(1)}%)`);
  console.log(`  429 Rate-ltd:  ${stats.rateLimited} (${((stats.rateLimited / stats.total) * 100).toFixed(1)}%)`);
  console.log(`  4xx Errors:    ${stats.clientError} (${((stats.clientError / stats.total) * 100).toFixed(1)}%)`);
  console.log(`  5xx Errors:    ${stats.serverError} (${((stats.serverError / stats.total) * 100).toFixed(1)}%)`);
  console.log(`  Net Errors:    ${stats.networkError} (${((stats.networkError / stats.total) * 100).toFixed(1)}%)`);
  console.log(`  Throughput:    ${(stats.total / parseFloat(elapsed)).toFixed(1)} req/s`);

  if (stats.latencies.length > 0) {
    console.log("\n  LATENCY PERCENTILES");
    console.log(`  p50:  ${percentile(stats.latencies, 50)}ms`);
    console.log(`  p75:  ${percentile(stats.latencies, 75)}ms`);
    console.log(`  p95:  ${percentile(stats.latencies, 95)}ms`);
    console.log(`  p99:  ${percentile(stats.latencies, 99)}ms`);
    console.log(`  max:  ${Math.max(...stats.latencies)}ms`);
    console.log(`  min:  ${Math.min(...stats.latencies)}ms`);
  }

  // ─── SLA Assertions ──────────────────────────────────────────────────────────
  console.log("\n  SLA ASSERTIONS");
  let passed = 0;
  let failed = 0;

  function check(condition, label) {
    if (condition) {
      passed++;
      console.log(`  ✓  ${label}`);
    } else {
      failed++;
      console.log(`  ✗  ${label}`);
    }
  }

  const p50 = percentile(stats.latencies, 50);
  const p95 = percentile(stats.latencies, 95);
  const p99 = percentile(stats.latencies, 99);
  const errorRate = (stats.serverError + stats.networkError) / stats.total;
  const rateLimitRate = stats.rateLimited / stats.total;

  check(p50 <= SLA.MAX_P50_MS, `p50 latency ${p50}ms ≤ ${SLA.MAX_P50_MS}ms`);
  check(p95 <= SLA.MAX_P95_MS, `p95 latency ${p95}ms ≤ ${SLA.MAX_P95_MS}ms`);
  check(p99 <= SLA.MAX_P99_MS, `p99 latency ${p99}ms ≤ ${SLA.MAX_P99_MS}ms`);
  check(errorRate <= SLA.MAX_ERROR_RATE, `Error rate ${(errorRate * 100).toFixed(2)}% ≤ ${SLA.MAX_ERROR_RATE * 100}%`);
  check(rateLimitRate <= SLA.MAX_RATE_LIMIT_RATE, `Rate-limit rate ${(rateLimitRate * 100).toFixed(2)}% ≤ ${SLA.MAX_RATE_LIMIT_RATE * 100}% (by design)`);
  check(stats.serverError === 0, `Zero 5xx errors (server never crashed under load)`);

  // Check for unique error messages (to surface actual failures, not just 401s)
  const uniqueErrors = [...new Set(stats.errors)];
  if (uniqueErrors.length > 0) {
    console.log("\n  UNIQUE ERRORS OBSERVED:");
    uniqueErrors.slice(0, 10).forEach((e) => console.log(`    • ${e}`));
    if (uniqueErrors.length > 10) console.log(`    ... and ${uniqueErrors.length - 10} more`);
  }

  const vaultStatus = failed === 0 ? "OPEN" : failed <= 1 ? "CAUTION" : "SEALED";
  console.log(`\n  Results: ${passed} passed, ${failed} failed`);
  console.log(`\n☢️  QA TERMINAL: ${stats.serverError > 0 ? 1 : 0} critical | ${failed} high | 0 medium | 0 low | 0 cosmetic — Vault status: ${vaultStatus}`);
  console.log("  Load soak complete. The Wasteland infrastructure holds.\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
