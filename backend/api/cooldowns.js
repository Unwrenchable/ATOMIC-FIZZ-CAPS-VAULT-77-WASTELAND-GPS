const router = require("express").Router();
const { checkCooldown, setCooldown } = require("../lib/cooldowns");

router.post("/api/cooldowns/check", (req, res) => {
  const { player } = req.body;
  const ok = checkCooldown(player);
  res.json({ ok });
});

router.post("/api/cooldowns/set", (req, res) => {
  const { player } = req.body;
  setCooldown(player);
  res.json({ ok: true });
});

module.exports = router;
