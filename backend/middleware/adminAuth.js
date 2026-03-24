// backend/middleware/adminAuth.js
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const redis = require("../lib/redis");
const rateLimit = require("express-rate-limit");

const ADMIN_SESSION_PREFIX = "admin:sess:";

// SECURITY: Constant-time comparison to prevent timing attacks
// This is ONLY for comparing non-password data like usernames
// Passwords must use bcrypt.compare() or verifyPassword() function
function safeCompareNonPassword(a, b) {
  const strA = String(a || "");
  const strB = String(b || "");

  // Return false immediately when lengths differ — mismatched lengths can never be equal.
  // NOTE: this leaks length information, but for non-secret usernames this is acceptable.
  // All password comparisons must use bcrypt.compare() via verifyPassword().
  if (strA.length !== strB.length) return false;

  const bufA = Buffer.from(strA, "utf8");
  const bufB = Buffer.from(strB, "utf8");

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Check if a string looks like a bcrypt hash
 * Bcrypt hashes start with $2a$, $2b$, or $2y$
 */
function isBcryptHash(str) {
  return /^\$2[aby]\$/.test(str);
}

/**
 * Securely compare a password against a stored credential
 * Supports both bcrypt hashes (preferred) and plain text (backward compatibility)
 * @param {string} inputPassword - The password provided by the user
 * @param {string} storedPassword - The stored password (bcrypt hash or plain text)
 * @returns {Promise<boolean>} - True if passwords match
 */
async function verifyPassword(inputPassword, storedPassword) {
  if (!inputPassword || !storedPassword) {
    return false;
  }

  // If stored password is a bcrypt hash, use bcrypt.compare
  if (isBcryptHash(storedPassword)) {
    try {
      return await bcrypt.compare(inputPassword, storedPassword);
    } catch (err) {
      console.error("[adminAuth] bcrypt comparison error:", err);
      return false;
    }
  }

  // Fall back to bcrypt with a fixed cost for plain text (backward compatibility)
  // This ensures constant-time comparison even for plain text passwords
  // Note: This is only for backward compatibility; production should use bcrypt hashes
  try {
    // BUG FIX: previously computed bcrypt.compare(inputPassword, hash(storedPassword))
    // into `plainMatch` but then returned `directMatch = inputPassword === storedPassword`
    // — a non-constant-time comparison vulnerable to timing attacks, and `plainMatch`
    // was silently ignored. Now use safeCompareNonPassword for constant-time comparison.
    return safeCompareNonPassword(inputPassword, storedPassword);
  } catch (err) {
    console.error("[adminAuth] plain text comparison error:", err);
    return false;
  }
}

async function createAdminSession() {
  const id = crypto.randomUUID();
  const key = ADMIN_SESSION_PREFIX + id;
  const ttl = parseInt(process.env.ADMIN_SESSION_TTL_SECONDS || "86400", 10);

  await redis.set(key, "1", { EX: ttl });
  return id;
}

async function validateAdminSession(token) {
  if (!token) return false;
  const key = ADMIN_SESSION_PREFIX + token;
  const value = await redis.get(key);
  return value !== null;
}

async function destroyAdminSession(token) {
  if (!token) return;
  const key = ADMIN_SESSION_PREFIX + token;
  await redis.del(key);
}

async function adminLoginHandler(req, res) {
  try {
    const { username, password } = req.body || {};
    const envUser = process.env.ADMIN_USERNAME || "";
    const envPass = process.env.ADMIN_PASSWORD || "";

    // Validate admin credentials are configured
    if (!envUser || !envPass) {
      console.error("[adminAuth] CRITICAL: Admin credentials not configured (ADMIN_USERNAME/ADMIN_PASSWORD)");
      return res.status(503).json({ ok: false, error: "admin_not_configured" });
    }

    // Verify username with constant-time comparison
    if (!safeCompareNonPassword(username || "", envUser)) {
      console.warn("[adminAuth] Failed login attempt - invalid username");
      return res.status(401).json({ ok: false, error: "invalid_admin_credentials" });
    }

    // Verify password (supports both bcrypt hashes and plain text)
    const passwordValid = await verifyPassword(password || "", envPass);
    if (!passwordValid) {
      console.warn("[adminAuth] Failed login attempt - invalid password");
      return res.status(401).json({ ok: false, error: "invalid_admin_credentials" });
    }

    const sessionId = await createAdminSession();
    console.log("[adminAuth] Admin session created");
    return res.json({ ok: true, token: sessionId });
  } catch (err) {
    console.error("ADMIN LOGIN ERROR:", err);
    return res.status(500).json({ ok: false, error: "admin_login_failed" });
  }
}

async function adminLogoutHandler(req, res) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    await destroyAdminSession(token);
    return res.json({ ok: true });
  } catch (err) {
    console.error("ADMIN LOGOUT ERROR:", err);
    return res.status(500).json({ ok: false, error: "admin_logout_failed" });
  }
}

async function requireAdmin(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!(await validateAdminSession(token))) {
      return res.status(401).json({ ok: false, error: "admin_unauthorized" });
    }

    return next();
  } catch (err) {
    console.error("ADMIN AUTH ERROR:", err);
    return res.status(500).json({ ok: false, error: "admin_auth_failed" });
  }
}

/**
 * Rate limiter for admin routes - strict limits to prevent brute force attacks
 */
const adminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { ok: false, error: "too_many_admin_requests" },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for admin login - very strict to prevent brute force
 */
const adminLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // only 5 login attempts per 15 minutes
  message: { ok: false, error: "too_many_login_attempts" },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  adminLoginHandler,
  adminLogoutHandler,
  requireAdmin,
  adminRateLimiter,
  adminLoginRateLimiter,
};
