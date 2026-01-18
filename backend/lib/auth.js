// backend/lib/auth.js
// Minimal auth stub so APIs that require ../lib/auth don't crash on import.

function authMiddleware(req, res, next) {
  // In production, replace with real auth checks.
  // For now, attach a placeholder player object.
  const wallet = req.headers["x-wallet"] || "dev-wallet";
  req.player = { wallet };
  next();
}

function isAdmin(req) {
  return req && req.player && req.player.role === "admin";
}

module.exports = {
  authMiddleware,
  isAdmin,
};
