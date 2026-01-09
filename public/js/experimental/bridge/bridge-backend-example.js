// experimental/bridge/bridge-backend-example.js
// Example Express route for future BRIDGE system

/*
const router = require("express").Router();
const { authMiddleware } = require("../lib/auth");

router.post("/bridge/send", authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    const player = req.player;

    // TODO: integrate with EVM bridge service
    res.json({ success: true, amount, status: "queued" });
  } catch (err) {
    console.error("[bridge/send] error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

module.exports = router;
*/
