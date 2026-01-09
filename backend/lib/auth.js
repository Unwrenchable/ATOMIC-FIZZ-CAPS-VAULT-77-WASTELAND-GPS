// backend/lib/auth.js
// Minimal auth stub so APIs that require ../lib/auth don't crash on import.
// Replace with your real auth logic later.

module.exports = {
  requireAuth: (req, res, next) => {
    // In production, replace with real auth checks.
    // For now allow through and attach a placeholder user.
    req.user = { id: "dev-user", role: "dev" };
    return next();
  },
  isAdmin: (req) => {
    return req && req.user && req.user.role === "admin";
  },
};
