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
const compression = require("compression");
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
// Critical production domains are ALWAYS allowed to prevent accidental lockout
const criticalOrigins = [
  "https://www.atomicfizzcaps.xyz",
  "https://atomicfizzcaps.xyz"
];

// Always included regardless of FRONTEND_ORIGIN env var (required for Vercel preview and Render deployments)
const permanentPatterns = [
  "https://*.vercel.app",
  "https://*.onrender.com"
];

const defaultOrigins = [
  "http://localhost:3000",
  ...permanentPatterns
];

// Merge critical origins with env-configured or default origins
const envOrigins = process.env.FRONTEND_ORIGIN 
  ? process.env.FRONTEND_ORIGIN.split(/\s*,\s*/).map(s => s.trim()).filter(Boolean)
  : defaultOrigins;

// Combine critical origins, permanent patterns, and environment origins, removing duplicates
const allowedOrigins = [...new Set([...criticalOrigins, ...permanentPatterns, ...envOrigins])];

function wildcardToRegex(pattern) {
  const escaped = pattern
    .replace(/^https?:\/\//, '')
    .replace(/\\/g, '\\\\')
    .replace(/\./g, '\\.')
    // SECURITY FIX: wildcard labels only allow valid hostname chars and can span nested labels for preview URLs.
    .replace(/\*/g, '[a-zA-Z0-9-]+(?:\\.[a-zA-Z0-9-]+)*');
  return new RegExp('^https?:\\/\\/' + escaped + '(\\:\\d+)?$');
}

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

const repoSnapshot = require("./api/repo-snapshot");
app.set("repoSnapshot", repoSnapshot);

// Log configured CORS origins on startup for debugging
console.log('[server] CORS configured with origins:', allowedOrigins.join(', '));

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Compress all responses (gzip/deflate) — reduces large JSON payloads
// (locations.json, world_locations.json, poi.json, etc.) by ~80%.
app.use(compression());

// JSON body limit
app.use(express.json({ limit: "64kb" }));

// ------------------------------------------------------------
// STRUCTURED REQUEST LOGGING
// Emits one JSON log line per request: requestId, wallet hash,
// method, path, status, latency. No PII — wallets are SHA-256
// hashed before logging.
// ------------------------------------------------------------
const { createHash, randomBytes } = require("crypto");
app.use((req, res, next) => {
  const requestId = createHash("sha256")
    .update(randomBytes(8))
    .digest("hex")
    .slice(0, 12);
  const start = Date.now();
  req._requestId = requestId;

  res.on("finish", () => {
    const wallet = req.headers["x-wallet"] || req.body?.wallet || "";
    const walletHash = wallet
      ? createHash("sha256").update(String(wallet)).digest("hex").slice(0, 8)
      : "anonymous";
    const logEntry = {
      requestId,
      ts: new Date().toISOString(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      latencyMs: Date.now() - start,
      walletHash,
      ip: req.ip,
      ua: (req.headers["user-agent"] || "").slice(0, 80),
    };
    // Emit to stdout — consumed by Render log drains or local dev
    console.log(JSON.stringify(logEntry));
  });
  next();
});

// Global rate limiting (coarse)
app.use(
  rateLimit({
    windowMs: 10 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    // Keep liveness and bootstrap config endpoints available during traffic spikes.
    skip: (req) => {
      const p = req.path || "";
      return p === "/api/health" || p === "/api/config/frontend" || !p.startsWith('/api/');
    },
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
          "'unsafe-eval'", // Required for Solana web3.js dynamic code
          "https://unpkg.com",
          "https://cdn.jsdelivr.net",
          "https://vercel.live",
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
          "https://cdn.jsdelivr.net",
          "https://huggingface.co",
          "https://*.huggingface.co",
          "https://hf.co",
          "https://*.hf.co",
          "https://raw.githubusercontent.com",
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
          "https://api-inference.huggingface.co",
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
// STATIC FRONTEND (local dev only)
// ------------------------------------------------------------
// In production, the frontend is served by Vercel at atomicfizzcaps.xyz.
// Serving static files here too would create a second "instance" of the
// game running off the API subdomain (api.atomicfizzcaps.xyz), which breaks
// the split architecture and confuses users. Local dev still needs it.
if (NODE_ENV !== "production") {
  app.use(
    express.static(FRONTEND_DIR, {
      maxAge: 0,
      etag: true,
    })
  );

  // Subdirectories
  ["js","css","images","wallet"].forEach(dir =>
    app.use(
      `/${dir}`,
      express.static(path.join(FRONTEND_DIR, dir), {
        maxAge: 0,
      })
    )
  );
}

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

// Utility / monitoring endpoints (no auth — checked by smoke tests and uptime monitors)
safeMount("/api/ping",    api("ping"));
safeMount("/api/version", api("version"));
safeMount("/api/repo-snapshot", api("repo-snapshot"));

// Narrative API — serves story acts, NPC dialog, terminals, encounters, collectibles
safeMount("/api/narrative", api("narrative"));
safeMount("/api/worldstate", api("worldstate"));

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
safeMount("/api/exchange", api("exchange"));    // Scavenger Exchange: trade listings (GET/POST/buy/cancel)
safeMount("/api/locations", api("locations"));  // routes/api/locations.js: serves locations.json

// Additional game APIs
safeMount("/api/player", api("player"));
safeMount("/api/player-nfts", api("player-nfts"));
safeMount("/api/quests", api("quests"));
safeMount("/api/battles", api("battles"));
safeMount("/api/redeem-voucher", api("redeem-voucher"));
safeMount("/api/xp", api("xp"));
safeMount("/api/caps", api("caps"));
safeMount("/api/transfer-fizz", api("transfer-fizz"));
safeMount("/api/settings", api("settings"));
safeMount("/api/crafting", api("crafting"));
safeMount("/api/repair", api("repair"));

// NFT Scrap and Fusion features
safeMount("/api/scrap-nft", api("scrap-nft"));
safeMount("/api/fuse", api("fuse"));

// GPS and Location features
safeMount("/api/gps", api("gps"));
safeMount("/api/encounter", api("encounter"));
safeMount("/api/camp", api("camp"));
safeMount("/api/geofence", api("geofence"));
safeMount("/api/location-claim", api("location-claim"));
safeMount("/api/dungeon", api("dungeon"));

// Companions, Mutations, Nukes
safeMount("/api/companions", api("companions"));
safeMount("/api/mutations", api("mutations"));
safeMount("/api/nukes", api("nukes"));
safeMount("/api/cooldowns", api("cooldowns"));
safeMount("/api/rotation", api("rotation"));

// Quest endings
safeMount("/api/quest-endings", api("quest-endings"));

// Survival reward claims
safeMount("/api/claim-survival", api("claim-survival"));
safeMount("/api/event/player-survived", api("player-survived"));

// Buy Stimpak with CAPS burn
safeMount("/api/buy-stimpak", api("buy-stimpak"));

// Overseer AI proxy (Hugging Face / OpenAI compatible)
safeMount("/api/overseer", api("overseer-proxy"));

// AI Character Generation (Grok AI)
safeMount("/api/ai-character", api("ai-character"));

// Grok avatar generation
safeMount("/api/grok", api("grok/generate-avatar"));

// NPC video generation via xAI Grok
safeMount("/api/npc/video", api("npc-video"));

// NPC xAI context endpoint (profile + dynamic encounter generation)
safeMount("/api/npc-context", api("npc-context"));

// Fizz Fun token launcher
safeMount("/api/fizz-fun", api("fizz-fun"));

// Admin/advanced panel routes
// SECURITY FIX: mount the admin login/logout handlers as explicit HTTP routes.
// Previously adminLoginHandler and adminLogoutHandler were exported from
// adminAuth.js but never attached to any route, making the admin panel
// completely inaccessible (broken) and leaving the login endpoint as a 404.
try {
  const {
    adminLoginHandler,
    adminLogoutHandler,
    adminRateLimiter,
    adminLoginRateLimiter,
  } = require("./middleware/adminAuth");

  // POST /api/admin/login  — rate-limited (5 attempts / 15 min)
  app.post("/api/admin/login",  adminLoginRateLimiter, adminLoginHandler);
  // POST /api/admin/logout — standard rate limit
  app.post("/api/admin/logout", adminRateLimiter,      adminLogoutHandler);
  console.log("[server] mounted admin login/logout at /api/admin/login, /api/admin/logout");
} catch (err) {
  console.warn("[server] failed to mount admin login/logout:", err && err.message);
}

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
  if (!/^[a-z0-9_-]+$/.test(name)) return next();
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

    const health = {
      ok: true,
      status: 'ok',
      env: process.env.NODE_ENV || 'unknown',
      time: new Date().toISOString(),
      redis: redisOk,
      solana_rpc: !!process.env.SOLANA_RPC
    };
    res.json(health);
  } catch (err) {
    console.error('[health] error:', err);
    res.status(500).json({
      ok: false,
      status: 'error',
      error: err.message
    });
  }
});

// ------------------------------------------------------------
// DETAILED HEALTH CHECK (admin-gated)
// Returns Redis connection status, Solana RPC reachability,
// Node.js uptime, memory usage, and environment metadata.
// Protected: requires X-Admin-Key header matching ADMIN_SECRET.
// ------------------------------------------------------------
app.get("/api/admin/health-detailed", async (req, res) => {
  const adminSecret = process.env.ADMIN_SECRET || "";
  const provided = req.headers["x-admin-key"] || "";
  if (!adminSecret || !provided) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  const secretBuf = Buffer.from(adminSecret);
  const providedBuf = Buffer.from(provided);
  if (secretBuf.length !== providedBuf.length) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  try {
    const { timingSafeEqual } = require("crypto");
    if (!timingSafeEqual(secretBuf, providedBuf)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
  } catch {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  // Redis status
  let redisStatus = "unknown";
  let redisPingMs = null;
  try {
    const redisLib = require("./lib/redis");
    const redisClient = redisLib.redis || redisLib.client || redisLib;
    const pingStart = Date.now();
    const pong = typeof redisClient.ping === "function"
      ? await redisClient.ping().catch(() => null)
      : null;
    redisPingMs = Date.now() - pingStart;
    redisStatus = pong === "PONG" ? "ok" : "degraded";
  } catch {
    redisStatus = "unavailable";
  }

  // Solana RPC reachability (non-blocking, 3s timeout)
  let solanaStatus = "not-configured";
  const rpcUrl = process.env.SOLANA_RPC;
  if (rpcUrl) {
    solanaStatus = await new Promise((resolve) => {
      const lib = rpcUrl.startsWith("https") ? require("https") : require("http");
      const r2 = lib.request(
        rpcUrl,
        { method: "POST", headers: { "Content-Type": "application/json" }, timeout: 3000 },
        (resp) => { resp.resume(); resolve(resp.statusCode < 500 ? "ok" : "degraded"); }
      );
      r2.on("error", () => resolve("unreachable"));
      r2.on("timeout", () => { r2.destroy(); resolve("timeout"); });
      r2.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }));
      r2.end();
    });
  }

  const mem = process.memoryUsage();
  return res.json({
    ok: true,
    ts: new Date().toISOString(),
    env: NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
    redis: { status: redisStatus, pingMs: redisPingMs },
    solana: { status: solanaStatus, rpc: rpcUrl ? rpcUrl.replace(/[?#].*$/, "***") : null },
    memory: {
      heapUsedMB: (mem.heapUsed / 1024 / 1024).toFixed(1),
      heapTotalMB: (mem.heapTotal / 1024 / 1024).toFixed(1),
      rssMB: (mem.rss / 1024 / 1024).toFixed(1),
    },
    node: process.version,
  });
});

// ------------------------------------------------------------
// ADMIN PANEL STATIC SERVING (all environments)
// ------------------------------------------------------------
// The admin panel lives in public/admin/ and is served directly from
// the backend at /admin (i.e. api.atomicfizzcaps.xyz/admin).
// Serving it here (not via Vercel) means:
//   1. All relative API calls in admin.js/dashboard.js (e.g. /api/admin/login)
//      resolve to this same origin — no CORS round-trip needed.
//   2. Admin files are kept off the public Vercel CDN domain.
// The extensions:["html"] option lets express.static serve
// dashboard.html for /admin/dashboard (clean URL with no .html).
const ADMIN_DIR = path.join(FRONTEND_DIR, "admin");
if (fs.existsSync(ADMIN_DIR)) {
  app.use(
    "/admin",
    express.static(ADMIN_DIR, {
      extensions: ["html"],
      setHeaders(res, filePath) {
        if (filePath.endsWith(".css")) res.type("text/css");
        if (filePath.endsWith(".js"))  res.type("application/javascript");
      },
    })
  );
  console.log("[server] admin panel served from", ADMIN_DIR);
}

// ------------------------------------------------------------
// SPA FALLBACK
// ------------------------------------------------------------
// In production, the frontend lives on Vercel. Redirect any non-API,
// non-file request to the Vercel frontend rather than serving a
// second copy of the game from the API subdomain.
const FRONTEND_URL = process.env.FRONTEND_URL || "https://atomicfizzcaps.xyz";

if (NODE_ENV === "production" && !process.env.FRONTEND_URL) {
  console.warn("[server] FRONTEND_URL env var not set — using default:", FRONTEND_URL);
}

// Safely redirect to the Vercel frontend. Validates the path to prevent
// open-redirect attacks (path is already parsed by Express but we guard anyway).
function redirectToFrontend(req, res) {
  // req.path is always a root-relative path from Express, but strip any
  // leading double-slashes that could be interpreted as protocol-relative URLs.
  const safePath = "/" + req.path.replace(/^\/+/, "").replace(/:\/\//, "");
  return res.redirect(301, `${FRONTEND_URL}${safePath}`);
}

app.get("/overseer", (req, res) => {
  if (NODE_ENV === "production") {
    return redirectToFrontend(req, res);
  }
  const overseerFile = path.join(FRONTEND_DIR, "overseer.html");
  if (fs.existsSync(overseerFile)) {
    res.sendFile(overseerFile);
  } else {
    res.status(404).send("Overseer terminal not found");
  }
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  if (path.extname(req.path)) return next();
  if (NODE_ENV === "production") {
    // Redirect to Vercel frontend — prevents a second game instance on the API subdomain
    return redirectToFrontend(req, res);
  }
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
// Only start the server if not running as a Vercel serverless function
if (process.env.VERCEL !== '1' && require.main === module) {
  app.listen(PORT, () => {
    console.log(
      `Atomic Fizz Caps backend running on port ${PORT} (env=${NODE_ENV})`
    );
  });
}

module.exports = app;
