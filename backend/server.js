// backend/server.js
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3001;

// Core middleware
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// Simple rate limiting (per IP)
app.use(
  rateLimit({
    windowMs: 10 * 1000,
    max: 20,
  })
);

// backend/server.js

app.use(require("./api/loot-voucher"));
app.use(require("./api/caps"));
app.use(require("./api/xp"));
app.use(require("./api/gps"));
app.use(require("./api/cooldowns"));
app.use(require("./api/rotation"));
app.use(require("./api/quests"));         // ← existing quest routes
app.use(require("./api/quest-endings"));  // ← ADD THIS RIGHT BELOW


// Health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, status: "Backend running" });
});

app.listen(PORT, () => {
  console.log(`Atomic Fizz Caps backend running on port ${PORT}`);
});
