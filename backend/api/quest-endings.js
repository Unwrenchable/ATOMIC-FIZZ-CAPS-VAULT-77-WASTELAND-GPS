const router = require("express").Router();
const { chooseEnding } = require("../lib/quests");

router.post("/api/quests/ending", (req, res) => {
  try {
    const { player, questId, endingId } = req.body;
    const result = chooseEnding(player, questId, endingId);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
