const express = require("express");
const path = require("path");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || "development";

// Static frontend root
const FRONTEND_DIR = path.join(__dirname, "..", "public");
console.log("[server] FRONTEND_DIR:", FRONTEND_DIR);

// Core middleware
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "*",
  })
);
app.use(express.json({ limit: "2mb" }));

// Rate limiting
app.use(
  rateLimit({
    windowMs: 10 * 1000,
    max: 20,
  })
);

// ------------------------------------------------------------
// STATIC FRONTEND
// ------------------------------------------------------------
app.use(express.static(FRONTEND_DIR));
app.use("/js", express.static(path.join(FRONTEND_DIR, "js")));
app.use("/css", express.static(path.join(FRONTEND_DIR, "css")));
app.use("/images", express.static(path.join(FRONTEND_DIR, "images")));

// ------------------------------------------------------------
// SAFE MOUNT HELPER
// ------------------------------------------------------------
function safeMount(mountPath, requirePath) {
  try {
    const router = require(requirePath);
    if (!router) {
      console.warn(`[server] skipping ${requirePath} — module exported undefined`);
      return;
    }
    app.use(mountPath, router);
    console.log(`[server] mounted ${requirePath} at ${mountPath}`);
  } catch (err) {
    console.warn(`[server] skipping ${requirePath} — failed to load: ${err.message}`);
  }
}

// ------------------------------------------------------------
// GAME API ROUTES (existing)
// ------------------------------------------------------------
// ------------------------------------------------------------
// GAME API ROUTES (FIXED PATHS)
// ------------------------------------------------------------
const api = (file) => path.join(__dirname, "api", file);

safeMount("/api/loot-voucher", api("loot-voucher"));
safeMount("/api/caps", api("caps"));
safeMount("/api/xp", api("xp"));
safeMount("/api/gps", api("gps"));
safeMount("/api/cooldowns", api("cooldowns"));
safeMount("/api/rotation", api("rotation"));
safeMount("/api/quests", api("quests"));
safeMount("/api/quest-endings", api("quest-endings"));
safeMount("/api/player", api("player"));
safeMount("/api/location-claim", api("location-claim"));

// WALLET API
safeMount("/api/wallet", path.join(__dirname, "routes", "wallet"));


// ------------------------------------------------------------
// NEW: WALLET UI
// ------------------------------------------------------------
app.use("/wallet", express.static(path.join(FRONTEND_DIR, "wallet")));

// ------------------------------------------------------------
// FUTURE FEATURE ENDPOINTS
// ------------------------------------------------------------
app.post("/api/nuke-gear", (req, res) => {
  return res.json({
    success: false,
    error: "NUKE GEAR system offline (future update)",
  });
});

app.post("/api/bridge/solana-to-evm", (req, res) => {
  return res.json({
    success: false,
    error: "BRIDGE system offline (future update)",
  });
});

app.post("/api/bridge/evm-to-solana", (req, res) => {
  return res.json({
    success: false,
    error: "BRIDGE system offline (future update)",
  });
});

// ------------------------------------------------------------
// HEALTH CHECK
// ------------------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({ ok: true, status: "Backend running", env: NODE_ENV });
});

// ------------------------------------------------------------
// SPA FALLBACK
// ------------------------------------------------------------
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  const ext = path.extname(req.path);
  if (ext) return next();
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

// ------------------------------------------------------------
// START SERVER
// ------------------------------------------------------------
const server = app.listen(PORT, () => {
  console.log(`Atomic Fizz Caps backend running on port ${PORT} (env=${NODE_ENV})`);
});

module.exports = app;
