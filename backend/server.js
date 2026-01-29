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
// Includes all deployment environments: main domains, Vercel previews, and Render hosting
const rawOrigins = (process.env.FRONTEND_ORIGIN ||
  "https://www.atomicfizzcaps.xyz, https://atomicfizzcaps.xyz, http://localhost:3000, https://*.vercel.app, https://*.onrender.com"
).split(/\s*,\s*/);

function wildcardToRegex(pattern) {
  const escaped = pattern
    .replace(/^https?:\/\//, '')
    .replace(/\\/g, '\\\\')
    .replace(/\./g, '\\.')
    .replace(/\*/g, '[^\\/]+');
  return new RegExp('^https?:\\/\\/' + escaped + '(\\:\\d+)?$');
}

const allowedOrigins = rawOrigins.map(s => s.trim()).filter(Boolean);

const corsOptions = {
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // server-side/curl requests
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

// Security headers with proper CSP configuration
// CSP allows the necessary external resources while maintaining security
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Required for inline scripts in index.html
          "https://unpkg.com",
          "https://cdn.jsdelivr.net",
          "https://www.gstatic.com",
          "https://api.phantom.app",
          "https://*.phantom.app",
          "https://wallet.phantom.app",
          "https://*.walletconnect.com",
          "https://*.walletconnect.org"
        ],
        connectSrc: [
          "'self'",
          "https://unpkg.com",
          "https://server.arcgisonline.com",
          "https://*.arcgisonline.com",
          "https://*.tile.openstreetmap.org",
          "https://*.basemaps.cartocdn.com",
          "https://atomicfizzcaps.xyz",
          "https://www.atomicfizzcaps.xyz",
          "https://api.atomicfizzcaps.xyz",
          "https://*.onrender.com",
          "https://*.vercel.app",
          "https://api.mainnet-beta.solana.com",
          "https://api.devnet.solana.com",
          "https://api.phantom.app",
          "https://*.phantom.app",
          "https://wallet.phantom.app",
          "https://*.walletconnect.com",
          "https://*.walletconnect.org",
          "https://*.infura.io",
          "https://polygon-rpc.com",
          "https://mainnet.infura.io",
          "wss://api.mainnet-beta.solana.com",
          "wss://api.devnet.solana.com",
          "wss://*.walletconnect.com",
          "wss://*.walletconnect.org"
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'", // Required for dynamic styles
          "https://fonts.googleapis.com",
          "https://unpkg.com"
        ],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "data:"
        ],
        mediaSrc: ["'self'", "data:", "https:"],
        objectSrc: ["'none'"],
        frameSrc: ["'self'"],
        baseUri: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false, // Keep disabled for external resource compatibility
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

// Subdirectories
["js","css","images","wallet"].forEach(dir =>
  app.use(
    `/${dir}`,
    express.static(path.join(FRONTEND_DIR, dir), {
      maxAge: NODE_ENV === "production" ? "1h" : 0,
    })
  )
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
// API ROUTES (Game loop, admin, wallet, etc)
// Any that aren't in /api/<name> or have custom logic should have a real router here.
// ------------------------------------------------------------
const api = (file) => path.join(__dirname, "api", file);

// Core API endpoints
safeMount("/api/loot-voucher", api("loot-voucher"));
safeMount("/api/mintables", api("mintables"));  // Your mintables router - serves mintables.json
// Minimal dev-only mint endpoint (mounted here so frontend claim flow works)
safeMount("/api/mint-item", api("mint-item"));
// Expose frontend config for client-side personality (overseer)
safeMount("/api/config/frontend", api("frontend-config"));
// Mount quest secrets API (server-side secret validation + lore reveals)
safeMount('/api/quest-secrets', api('quest-secrets'));
// Server-side quest store (placeholders + reveal endpoint)
safeMount('/api/quests-store', api('quests-store'));
safeMount("/api/scavenger", api("scavenger"));  // Add a scavenger router if needed, otherwise use JSON proxy below!
safeMount("/api/locations", api("locations"));  // routes/api/locations.js: serves locations.json

// Additional game APIs
safeMount("/api/player", api("player"));
safeMount("/api/player-nfts", api("player-nfts"));
safeMount("/api/quests", api("quests"));
safeMount("/api/redeem-voucher", api("redeem-voucher"));
safeMount("/api/xp", api("xp"));
safeMount("/api/caps", api("caps"));
safeMount("/api/settings", api("settings"));

// GPS and Location features
safeMount("/api/gps", api("gps"));
safeMount("/api/location-claim", api("location-claim"));
safeMount("/api/cooldowns", api("cooldowns"));
safeMount("/api/rotation", api("rotation"));

// Quest endings
safeMount("/api/quest-endings", api("quest-endings"));

// Fizz Fun token launcher
safeMount("/api/fizz-fun", api("fizz-fun"));

// Admin/advanced panel routes
safeMount("/api/admin/player", api("adminPlayer"));
safeMount("/api/admin/mintables", api("adminMintables"));
safeMount("/api/admin/keys", api("keys-admin"));

// WALLET API
safeMount("/api/wallet", path.join(__dirname, "routes", "wallet"));

// ------------------------------------------------------------
// GENERIC STATIC JSON PROXY (fallback for /api/<name>)
// If you have `public/data/settings.json`, `public/data/scavenger.json`, etc.
// This will handle them automatically if no route is more specific.
// ------------------------------------------------------------
app.use("/api", (req, res, next) => {
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
// HEALTH CHECK
// ------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  try {
    let redisOk = false;
    try {
      const redisModule = require('./lib/redis');
      if (redisModule && redisModule.client) {
        const client = redisModule.client;
        redisOk = client.isReady || client.status === 'ready' || client.status === 'connected';
      }
    } catch (e) {
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
// SPA FALLBACK
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
