// backend/middleware/adminAuth.js
const crypto = require("crypto");
const { redis } = require("../lib/redis");

const ADMIN_SESSION_PREFIX = "admin:sess:";

function safeCompare(a, b) {
  const bufA = Buffer.from(a || "");
  const bufB = Buffer.from(b || "");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
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
  const exists = await redis.exists(key);
  return exists === 1;
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

    if (!safeCompare(username || "", envUser) || !safeCompare(password || "", envPass)) {
      return res.status(401).json({ ok: false, error: "invalid_admin_credentials" });
    }

    const sessionId = await createAdminSession();
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

module.exports = {
  adminLoginHandler,
  adminLogoutHandler,
  requireAdmin,
};
