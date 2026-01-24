// backend/index.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

// --- API ROUTES --- //
const walletRoutes = require("./routes/wallet");

// --- ADMIN AUTH ---
const {
  adminLoginHandler,
  adminLogoutHandler,
  requireAdmin,
} = require("./middleware/adminAuth");

// --- ADMIN MODULES ---
const adminPlayerRoutes = require("./api/adminPlayer");
const adminMonitorRoutes = require("./api/adminMonitor"); // Jax read-only monitor
const adminMintablesRoutes = require("./api/adminMintables"); // World Tools: Mintables

// --- GAME DATA ROUTES (add each of these as you implement the file) ---
const mintablesRoutes = require("./routes/mintables");
// const scavengerRoutes = require("./routes/scavenger");
// const locationsRoutes = require("./routes/locations");
// const settingsRoutes = require("./routes/settings");

// Strict CORS whitelist
const CLIENT_ORIGIN =
  process.env.CLIENT_ORIGIN || "https://www.atomicfizzcaps.xyz";

// Required if behind Cloudflare / Render / Vercel
app.set("trust proxy", 1);

// JSON body limit
app.use(express.json({ limit: "1mb" }));

// Strict CORS
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);

// Hardened Helmet config
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// Basic request sanitization
app.use((req, res, next) => {
  if (typeof req.body === "object" && req.body !== null) {
    for (const key in req.body) {
      if (typeof req.body[key] === "string") {
        req.body[key] = req.body[key].trim();
      }
    }
  }
  next();
});

// ------------------------------------------------------------
// Serve Wallet UI
app.use(
  "/wallet",
  express.static(path.join(__dirname, "..", "public", "wallet"), {
    maxAge: "1h",
    etag: true,
  })
);

// ------------------------------------------------------------
// Serve Admin Panel UI
app.use(
  "/admin",
  express.static(path.join(__dirname, "..", "public", "admin"), {
    maxAge: "1h",
    etag: true,
  })
);

// ------------------------------------------------------------
// Wallet API
app.use("/api", walletRoutes);

// ------------------------------------------------------------
// Admin Auth Routes
app.post("/api/admin/login", adminLoginHandler);
app.post("/api/admin/logout", requireAdmin, adminLogoutHandler);

// ------------------------------------------------------------
// Admin Tools
app.use("/api/admin/player", requireAdmin, adminPlayerRoutes);
app.use("/api/admin/monitor", requireAdmin, adminMonitorRoutes);
app.use("/api/admin/mintables", requireAdmin, adminMintablesRoutes);

// ------------------------------------------------------------
// Game Data APIs - READ ONLY
app.use("/api/mintables", mintablesRoutes);
// Uncomment/add as you create the files:
/// app.use("/api/scavenger", scavengerRoutes);
/// app.use("/api/locations", locationsRoutes);
/// app.use("/api/settings", settingsRoutes);

// ------------------------------------------------------------
// Health Check
app.get("/health", (req, res) => {
  res.json({ ok: true, status: "healthy" });
});

// ------------------------------------------------------------
// Global Error Handler
app.use((err, req, res, next) => {
  console.error("GLOBAL ERROR:", err);
  res.status(500).json({ ok: false, error: "Internal server error" });
});

// ------------------------------------------------------------
// Start Server
app.listen(PORT, () => {
  console.log(`Atomic Fizz Wallet backend running on port ${PORT}`);
});
