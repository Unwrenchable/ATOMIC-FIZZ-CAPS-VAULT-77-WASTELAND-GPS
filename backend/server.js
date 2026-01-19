// backend/server.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Backend Server
// Express + Static Frontend + Modular API Routes
// ------------------------------------------------------------

require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

const app = express();
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || "development";

// ------------------------------------------------------------
// STATIC FRONTEND ROOT
// ------------------------------------------------------------
const FRONTEND_DIR = path.join(__dirname, "..", "public");
console.log("[server] FRONTEND_DIR:", FRONTEND_DIR);

// ------------------------------------------------------------
// CORE MIDDLEWARE
// ------------------------------------------------------------

// Strict CORS (frontend only)
const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN || "https://www.atomicfizzcaps.xyz";

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);

// JSON body limit
app.use(express.json({ limit: "2mb" }));

// Global rate limiting (coarse)
app.use(
  rateLimit({
    windowMs: 10 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false, // static SPA handles its own CSP if needed
    crossOriginEmbedderPolicy: false,
  })
);

// Basic body sanitization
app.use((req, res, next) => {
  if (req.body && typeof req.body === "object") {
    for (const key in req.body) {
      if (typeof req.body[key] === "string") {
        req.body[key] = req.body[key].trim();
      }
    }
  }
  next();
});

// ------------------------------------------------------------
// STATIC FRONTEND
// ------------------------------------------------------------
app.use(
  express.static(FRONTEND_DIR, {
    maxAge: NODE_ENV === "production" ? "1h" : 0,
    etag: true,
  })
);

app.use(
  "/js",
  express.static(path.join(FRONTEND_DIR, "js"), {
    maxAge: NODE_ENV === "production" ? "1h" : 0,
  })
);
app.use(
  "/css",
  express.static(path.join(FRONTEND_DIR, "css"), {
    maxAge: NODE_ENV === "production" ? "1h" : 0,
  })
);
app.use(
  "/images",
  express.static(path.join(FRONTEND_DIR, "images"), {
    maxAge: NODE_ENV === "production" ? "1h" : 0,
  })
);
app.use(
  "/wallet",
  express.static(path.join(FRONTEND_DIR, "wallet"), {
    maxAge: NODE_ENV === "production" ? "1h" : 0,
  })
);

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
    console.warn(
      `[server] skipping ${requirePath} — failed to load: ${err.message}`
    );
  }
}

// ------------------------------------------------------------
// API ROUTES
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
// FUTURE FEATURE ENDPOINTS
// ------------------------------------------------------------
app.post("/api/nuke-gear", (req, res) => {
  res.json({
    success: false,
    error: "NUKE GEAR system offline (future update)",
  });
});

app.post("/api/bridge/solana-to-evm", (req, res) => {
  res.json({
    success: false,
    error: "BRIDGE system offline (future update)",
  });
});

app.post("/api/bridge/evm-to-solana", (req, res) => {
  res.json({
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
// SPA FALLBACK (React/Leaflet Frontend)
// ------------------------------------------------------------
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  if (path.extname(req.path)) return next();
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

// ------------------------------------------------------------
// GLOBAL ERROR HANDLER
// ------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error("[server] GLOBAL ERROR:", err);
  res.status(500).json({ ok: false, error: "Internal server error" });
});

// ------------------------------------------------------------
// START SERVER
// ------------------------------------------------------------
app.listen(PORT, () => {
  console.log(
    `Atomic Fizz Caps backend running on port ${PORT} (env=${NODE_ENV})`
  );
});

module.exports = app;
