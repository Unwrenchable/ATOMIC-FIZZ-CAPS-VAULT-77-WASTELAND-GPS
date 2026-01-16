// backend/index.js
require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");

const walletRoutes = require("./routes/wallet");

const app = express();

// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------
const PORT = process.env.PORT || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

// ------------------------------------------------------------
// MIDDLEWARE
// ------------------------------------------------------------
app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
  })
);
app.use(
  helmet({
    contentSecurityPolicy: false, // you can tighten this later
  })
);

// Static wallet (if you serve it from backend)
app.use(
  "/wallet",
  express.static(path.join(__dirname, "..", "public", "wallet"))
);

// ------------------------------------------------------------
// ROUTES
// ------------------------------------------------------------
app.use("/api", walletRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true, status: "healthy" });
});

// ------------------------------------------------------------
// START
// ------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
