// index.js
// ------------------------------------------------------------
// Unified World Logic Export
// ------------------------------------------------------------

module.exports = {
  ...require("./reputation"),
  ...require("./enemies"),
  ...require("./merchants"),
  ...require("./events"),
  ...require("./bosses"),
  ...require("./weather"),
  ...require("./merchantInventory"),
  ...require("./enemyScaling"),
  ...require("./encounters")
};

