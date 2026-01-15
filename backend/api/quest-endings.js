const router = require("express").Router();
const { chooseEnding } = require("../lib/quests");

// Mounted at /api/quest-endings
router.post("/", async (req, res) => {
  try {
    const { player, questId, endingId } = req.body;

    const result = await chooseEnding(player, questId, endingId);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[api/quest-endings] error:", err.message);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
 
