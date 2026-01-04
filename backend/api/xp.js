const router = require("express").Router();
const { awardXp } = require("../lib/xp");

router.post("/api/xp/award", (req, res) => {
  try {
    const { player, amount } = req.body;
    const result = awardXp(player, amount);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
