const router = require("express").Router();
const { getCurrentLoot } = require("../lib/lootTable");

// BUG FIX: route was "/api/loot/current" inside a router mounted at /api/rotation,
// making it only reachable at /api/rotation/api/loot/current. Changed to "/" so
// it is correctly served at the mount point /api/rotation.
router.get("/", (req, res) => {
  res.json(getCurrentLoot());
});

module.exports = router;
