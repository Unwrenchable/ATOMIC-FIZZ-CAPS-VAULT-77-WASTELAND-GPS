// tests/cors_config.test.js
// Explicit origins only. Wildcard preview hosts are not an allowlist.

const assert = require("assert");

function explicitOrigin(raw, nodeEnv) {
  if (!raw || raw.includes("*")) return null;
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol === "https:" || (nodeEnv !== "production" && url.protocol === "http:" && local)) {
    return url.origin;
  }
  return null;
}

function allow(origin, nodeEnv, allowedOrigins) {
  if (!origin) return nodeEnv !== "production";
  return allowedOrigins.includes(origin);
}

const critical = ["https://www.atomicfizzcaps.xyz", "https://atomicfizzcaps.xyz"];

{
  const env = ["https://*.vercel.app", "https://*.onrender.com", "https://preview.example.com", "http://evil.example"]
    .map((s) => explicitOrigin(s, "production"))
    .filter(Boolean);
  const allowed = [...new Set([...critical, ...env])];
  assert.deepStrictEqual(env, ["https://preview.example.com"]);
  assert.strictEqual(allow("https://www.atomicfizzcaps.xyz", "production", allowed), true);
  assert.strictEqual(allow("https://my-app.vercel.app", "production", allowed), false);
  assert.strictEqual(allow("https://svc.onrender.com", "production", allowed), false);
  assert.strictEqual(allow(undefined, "production", allowed), false);
  assert.strictEqual(allow(undefined, "development", allowed), true);
  assert.strictEqual(allow("http://localhost:3000", "development", ["http://localhost:3000"]), true);
  assert.strictEqual(explicitOrigin("http://localhost:3000", "production"), null);
  console.log("cors explicit-origin checks passed");
}
