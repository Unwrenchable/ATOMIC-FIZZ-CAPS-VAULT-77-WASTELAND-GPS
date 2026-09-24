// backend/lib/data-paths.js
// Resolve game data files across frontend/data (canonical) and legacy public/data.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");

function dataCandidates(relPath) {
  const clean = String(relPath || "").replace(/^[/\\]+/, "");
  return [
    path.join(ROOT, "frontend", "data", clean),
    path.join(ROOT, "public", "data", clean),
    path.join(ROOT, "backend", "public", "data", clean),
  ];
}

function resolveDataFile(relPath) {
  for (const file of dataCandidates(relPath)) {
    if (fs.existsSync(file)) return file;
  }
  return dataCandidates(relPath)[0];
}

function readJsonData(relPath, fallback = null) {
  const file = resolveDataFile(relPath);
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return { ok: true, file, data: parsed };
  } catch (err) {
    return { ok: false, file, data: fallback, error: err };
  }
}

/**
 * Normalize Solana RPC URLs from env / deploy panels.
 * Fixes typos like `https//:api.devnet.solana.com`.
 */
function normalizeSolanaRpc(raw, fallback = "https://api.devnet.solana.com") {
  let s = String(raw == null ? "" : raw).trim();
  if (!s) return fallback;
  s = s.replace(/^(https?)\/\/:/i, "$1://");
  s = s.replace(/^(https?):\/(?!\/)/i, "$1://");
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return fallback;
    return u.href.replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

function sanitizeSolanaEnv() {
  for (const key of ["SOLANA_RPC", "SOLANA_RPC_URL"]) {
    if (process.env[key]) {
      process.env[key] = normalizeSolanaRpc(process.env[key]);
    }
  }
}

module.exports = {
  ROOT,
  dataCandidates,
  resolveDataFile,
  readJsonData,
  normalizeSolanaRpc,
  sanitizeSolanaEnv,
};
