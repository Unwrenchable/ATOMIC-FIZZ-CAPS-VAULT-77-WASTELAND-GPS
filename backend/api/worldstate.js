module.exports = function (req, res) {
  try {
    const worldstate = req.app.get("worldstate") || {};
    res.json({ ok: true, worldstate });
  } catch (err) {
    console.error("[worldstate]", err);
    res.status(500).json({ ok: false });
  }
};
