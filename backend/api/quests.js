// backend/api/quests.js
const router = require("express").Router();

router.get("/api/quests/health", (req, res) => {
  res.json({ ok: true, msg: "quests placeholder" });
});

module.exports = router;
