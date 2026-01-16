// backend/index.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");

const walletRoutes = require("./routes/wallet");

const app = express();

const PORT = process.env.PORT || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin: CLIENT_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"],
  })
);
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

// serve static wallet if you want: /wallet -> public/wallet
app.use(
  "/wallet",
  express.static(path.join(__dirname, "..", "public", "wallet"))
);

app.use("/api", walletRoutes);

app.get("/health", (req, res) => {
  res.json({ ok: true, status: "healthy" });
});

app.listen(PORT, () => {
  console.log(`Atomic Fizz Wallet backend running on port ${PORT}`);
});
