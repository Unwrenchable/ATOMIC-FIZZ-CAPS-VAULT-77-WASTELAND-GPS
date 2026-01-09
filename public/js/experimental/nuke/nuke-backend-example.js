// experimental/nuke/nuke-backend-example.js
// Example Express route for future NUKE system

/*
const router = require("express").Router();
const { authMiddleware } = require("../lib/auth");
const caps = require("../lib/caps");

router.post("/nuke-gear", authMiddleware, async (req, res) => {
  try {
    const { gearId } = req.body;
    const player = req.player;

    if (!gearId) {
      return res.status(400).json({ success: false, error: "Missing gearId" });
    }

    // TODO: remove gear from DB
    const capsReward = 50;
    await caps.mintCapsToPlayer(player, capsReward);

    res.json({ success: true, gearId, capsReward });
  } catch (err) {
    console.error("[nuke-gear] error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

module.exports = router;
*/
