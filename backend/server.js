/* backend/server.js */
const express = require("express");
const path = require("path");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || "development";

// IMPORTANT: your real static site lives in /public at repo root
const FRONTEND_DIR = path.join(__dirname, "..", "public");
console.log("[server] FRONTEND_DIR:", FRONTEND_DIR);

// Core middleware
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "*",
  })
);
app.use(express.json({ limit: "2mb" }));

// Simple rate limiting (per IP)
app.use(
  rateLimit({
    windowMs: 10 * 1000,
    max: 20,
  })
);

// ------------------------------------------------------------
// STATIC FRONTEND
// ------------------------------------------------------------

// Serve everything under /public as static assets
app.use(express.static(FRONTEND_DIR));

// (Optional, but explicit) – if you ever move things, these still work
app.use("/js", express.static(path.join(FRONTEND_DIR, "js")));
app.use("/css", express.static(path.join(FRONTEND_DIR, "css")));
app.use("/images", express.static(path.join(FRONTEND_DIR, "images")));

// Helper to safely mount routers so missing files don't crash the process
function safeMount(mountPath, requirePath) {
  try {
    const router = require(requirePath);
    if (!router) {
      console.warn(
        `[server] skipping ${requirePath} — module exported undefined`
      );
      return;
    }
    if (typeof router === "function") {
      app.use(mountPath, router);
      console.log(`[server] mounted ${requirePath} at ${mountPath}`);
    } else {
      app.use(router);
      console.log(`[server] mounted ${requirePath} (no path)`);
    }
  } catch (err) {
    console.warn(
      `[server] skipping ${requirePath} — module not found or failed to load: ${err.message}`
    );
  }
}

// ------------------------------------------------------------
// API MOUNTS
// ------------------------------------------------------------
safeMount("/api/loot-voucher", "./api/loot-voucher");
safeMount("/api/caps", "./api/caps");
safeMount("/api/xp", "./api/xp");
safeMount("/api/gps", "./api/gps");
safeMount("/api/cooldowns", "./api/cooldowns");
safeMount("/api/rotation", "./api/rotation");
safeMount("/api/quests", "./api/quests");
safeMount("/api/quest-endings", "./api/quest-endings");
safeMount("/api/player", "./api/player");
safeMount("/api/location-claim", "./api/location-claim");

// ------------------------------------------------------------
// FUTURE FEATURE ENDPOINTS (NUKE + BRIDGE)
// ------------------------------------------------------------

// NUKE GEAR (NFT burn → CAPS reward)
app.post("/api/nuke-gear", (req, res) => {
  const { wallet, index, message, signature } = req.body;

  if (!wallet || !message || !signature) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields (wallet, message, signature)",
    });
  }

  return res.json({
    success: false,
    error: "NUKE GEAR system offline (future update)",
    received: { wallet, index, message },
  });
});

// BRIDGE: Solana → EVM
app.post("/api/bridge/solana-to-evm", (req, res) => {
  const { wallet, amount, signature } = req.body;

  if (!wallet || !amount || !signature) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields (wallet, amount, signature)",
    });
  }

  return res.json({
    success: false,
    error: "BRIDGE system offline (future update)",
    received: { wallet, amount },
  });
});

// BRIDGE: EVM → Solana
app.post("/api/bridge/evm-to-solana", (req, res) => {
  const { wallet, amount, signature } = req.body;

  if (!wallet || !amount || !signature) {
    return res.status(400).json({
      success: false,
      error: "Missing required fields (wallet, amount, signature)",
    });
  }

  return res.json({
    success: false,
    error: "BRIDGE system offline (future update)",
    received: { wallet, amount },
  });
});

// ------------------------------------------------------------
// HEALTH CHECK
// ------------------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({ ok: true, status: "Backend running", env: NODE_ENV });
});

// ------------------------------------------------------------
// SPA FALLBACK (ONLY for non-asset, non-API routes)
// ------------------------------------------------------------
app.get("*", (req, res, next) => {
  // Let API and real files pass through
  if (req.path.startsWith("/api/")) return next();

  // If the path looks like a file (/js/..., /css/..., /img.png, etc),
  // do NOT send index.html — let static/404 handle it.
  const ext = path.extname(req.path);
  if (ext) return next();

  res.sendFile(path.join(FRONTEND_DIR, "index.html"), (err) => {
    if (err) next(err);
  });
});

// ------------------------------------------------------------
// GLOBAL ERROR HANDLER
// ------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error("[server] unhandled error:", err && err.stack ? err.stack : err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "Internal server error" });
});

// ------------------------------------------------------------
// START SERVER
// ------------------------------------------------------------
const server = app.listen(PORT, () => {
  console.log(
    `Atomic Fizz Caps backend running on port ${PORT} (env=${NODE_ENV})`
  );
});

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.error(
      `[server] port ${PORT} in use. Kill the process using it or set PORT to another value.`
    );
    process.exit(1);
  }
  console.error("[server] unexpected error:", err);
  process.exit(1);
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`[server] received ${signal}, shutting down...`);
  server.close(() => {
    console.log("[server] closed HTTP server");
    process.exit(0);
  });
  setTimeout(() => {
    console.error("[server] force exit");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

module.exports = app;
