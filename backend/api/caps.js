const router = require("express").Router();
const { mintCapsToPlayer } = require("../lib/caps");

router.post("/api/caps/mint", async (req, res) => {
  try {
    const { player, amount } = req.body;
    const sig = await mintCapsToPlayer(player, amount);
    res.json({ ok: true, signature: sig });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
