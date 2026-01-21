// backend/server.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Backend Server
// Express + Static Frontend + Modular API Routes
// ------------------------------------------------------------

require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

const app = express();
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || "development";

// ------------------------------------------------------------
// STATIC FRONTEND ROOT
// ------------------------------------------------------------
const FRONTEND_DIR = path.join(__dirname, "..", "public");
console.log("[server] FRONTEND_DIR:", FRONTEND_DIR);

// ------------------------------------------------------------
// CORE MIDDLEWARE
// ------------------------------------------------------------

// --- CORS setup (safe, env-driven) ---
// Parse FRONTEND_ORIGIN env var into an array of allowed origins.
// Accepts comma-separated values. Example:
// FRONTEND_ORIGIN="https://www.atomicfizzcaps.xyz, https://atomicfizzcaps.xyz, http://localhost:3000"
const rawOrigins = (process.env.FRONTEND_ORIGIN || 'https://www.atomicfizzcaps.xyz, https://atomicfizzcaps.xyz, http://localhost:3000, https://*.vercel.app').split(/\s*,\s*/);

function wildcardToRegex(pattern) {
  // turn https://*.vercel.app into ^https?:\/\/[^\/]+\.vercel\.app(:\d+)?$
  const escaped = pattern.replace(/^https?:\/\//, '').replace(/\./g, '\\.').replace(/\*/g, '[^\\/]+');
  return new RegExp('^https?:\\/\\/' + escaped + '(\\:\\d+)?$');
}

const allowedOrigins = rawOrigins.map(s => s.trim()).filter(Boolean);

const corsOptions = {
  origin: function(origin, callback) {
    // allow server-to-server or curl requests with no origin
    if (!origin) return callback(null, true);
    const ok = allowedOrigins.some(pattern => {
      if (pattern.includes('*')) {
        return wildcardToRegex(pattern).test(origin);
      }
      return origin === pattern;
    });
    if (ok) return callback(null, true);
    console.warn('[server] CORS blocked origin:', origin);
    return callback(new Error('CORS not allowed'), false);
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With','Accept'],
  credentials: true,
  maxAge: 86400
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

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
    const mod = require(requirePath);
    const router = (mod && (mod.router || mod.default)) || mod;
    if (!router) {
      console.warn(
        `[server] skipping ${requirePath} — module exported undefined`
      );
      return;
    }
    app.use(mountPath, router);
    console.log(`[server] mounted ${requirePath} at ${mountPath}`);
  } catch (err) {
    console.warn(
      `[server] skipping ${requirePath} — failed to load: ${err && err.message}`
    );
  }
}

// ------------------------------------------------------------
// AUTH ROUTES
// ------------------------------------------------------------
try {
  const authMod = require("./lib/auth");
  const authRouter = (authMod && (authMod.router || authMod.default)) || authMod;
  if (authRouter) {
    app.use("/api/auth", authRouter);
    console.log("[server] mounted ./lib/auth at /api/auth");
  } else {
    console.warn("[server] ./lib/auth did not export a router");
  }
} catch (err) {
  console.warn("[server] failed to load ./lib/auth:", err && err.message);
}

// ------------------------------------------------------------
// API ROUTES
// ------------------------------------------------------------
const api = (file) => path.join(__dirname, "api", file);

// Core API endpoints
safeMount("/api/loot-voucher", api("loot-voucher"));
safeMount("/api/mintables", api("mintables"));
safeMount("/api/caps", api("caps"));
safeMount("/api/xp", api("xp"));
safeMount("/api/gps", api("gps"));
safeMount("/api/cooldowns", api("cooldowns"));
safeMount("/api/rotation", api("rotation"));
safeMount("/api/quests", api("quests"));
safeMount("/api/quest-endings", api("quest-endings"));
safeMount("/api/player", api("player"));
safeMount("/api/location-claim", api("location-claim"));

// Add locations endpoint (frontend expects /api/locations)
safeMount("/api/locations", api("locations"));

// WALLET API
safeMount("/api/wallet", path.join(__dirname, "routes", "wallet"));

// ------------------------------------------------------------
// GENERIC STATIC JSON PROXY (fallback for /api/<name>)
// Serves public/data/<name>.json for simple API endpoints.
// This is mounted AFTER explicit routers so explicit handlers take precedence.
// ------------------------------------------------------------
app.use("/api", (req, res, next) => {
  // Only handle GET requests for top-level names like /api/settings or /api/locations
  if (req.method !== "GET") return next();
  const parts = req.path.split("/").filter(Boolean);
  if (parts.length !== 1) return next(); // only handle /api/<name>
  const name = parts[0];
  if (!/^[a-z0-9_\-]+$/.test(name)) return next();
  const file = path.join(FRONTEND_DIR, "data", `${name}.json`);
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) return next();
    res.type("application/json");
    res.sendFile(file, (sendErr) => {
      if (sendErr) {
        console.error(`[api/proxy] sendFile error for ${name}:`, sendErr);
        if (!res.headersSent) res.status(500).json({ error: "failed to send file" });
      } else {
        console.log(`[api/proxy] served ${file} for /api/${name}`);
      }
    });
  });
});

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
// Add health endpoint for smoke checks
app.get('/api/health', async (req, res) => {
  try {
    // Try to load redis module to check its status
    let redisOk = false;
    try {
      const redisModule = require('./lib/redis');
      if (redisModule && redisModule.client) {
        const client = redisModule.client;
        // Check if client is connected (node-redis v4 has isReady property)
        redisOk = client.isReady || client.status === 'ready' || client.status === 'connected';
      }
    } catch (e) {
      // redis module not available or error loading it
      redisOk = false;
    }

    const ok = {
      status: 'ok',
      env: process.env.NODE_ENV || 'unknown',
      time: new Date().toISOString(),
      redis: redisOk,
      solana_rpc: !!process.env.SOLANA_RPC
    };
    res.json(ok);
  } catch (err) {
    console.error('[health] error:', err);
    res.status(500).json({
      status: 'error',
      error: err.message
    });
  }
});

// ------------------------------------------------------------
// SPA FALLBACK (React/Leaflet Frontend)
// ------------------------------------------------------------
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  if (path.extname(req.path)) return next();
  const indexFile = path.join(FRONTEND_DIR, "index.html");
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(404).send("Not Found");
  }
});

// ------------------------------------------------------------
// GLOBAL ERROR HANDLER
// ------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error("[server] GLOBAL ERROR:", err && err.stack ? err.stack : err);
  if (res.headersSent) return next(err);
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
