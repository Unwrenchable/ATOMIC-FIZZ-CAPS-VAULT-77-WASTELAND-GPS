const router = require("express").Router();
const { getCurrentLoot } = require("../lib/lootTable");

router.get("/api/loot/current", (req, res) => {
  res.json(getCurrentLoot());
});

module.exports = router;
