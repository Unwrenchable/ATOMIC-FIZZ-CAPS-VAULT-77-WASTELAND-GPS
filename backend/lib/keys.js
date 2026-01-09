// backend/lib/keys.js
const assert = require("assert");
const Redis = require("ioredis");
const bs58 = require("bs58");

const REDIS_URL = process.env.REDIS_URL;
const redis = REDIS_URL ? new Redis(REDIS_URL) : null;
const KEY_HASH_PREFIX = "keys:meta:";        // keys:meta:<keyId> -> JSON
const KEY_LIST_SET = "keys:list";            // set of keyIds
const AUDIT_STREAM = process.env.KEYS_AUDIT_STREAM || "stream:keys:audit";
const CACHE_TTL_MS = Number(process.env.KEYS_CACHE_TTL_MS || 60_000);

let inMemoryCache = { keys: {}, expires: 0 };

function audit(event) {
  const base = { ts: new Date().toISOString(), service: "keys", ...event };
  if (redis) {
    const fields = [];
    for (const k of Object.keys(base)) fields.push(k, typeof base[k] === "string" ? base[k] : JSON.stringify(base[k]));
    redis.xadd(AUDIT_STREAM, "*", ...fields).catch(() => {});
  } else {
    console.info(JSON.stringify(base));
  }
}

/**
 * getKeyMeta(keyId) -> { keyId, publicKey, status, createdAt, expiresAt }
 */
async function getKeyMeta(keyId) {
  if (!keyId) return null;
  // fast in-memory cache
  if (Date.now() < inMemoryCache.expires && inMemoryCache.keys[keyId]) return inMemoryCache.keys[keyId];

  if (!redis) return null;
  const raw = await redis.get(KEY_HASH_PREFIX + keyId);
  if (!raw) return null;
  const meta = JSON.parse(raw);
  // refresh cache
  inMemoryCache.keys[keyId] = meta;
  inMemoryCache.expires = Date.now() + CACHE_TTL_MS;
  return meta;
}

/**
 * listKeys() -> array of metas
 */
async function listKeys() {
  if (!redis) return Object.values(inMemoryCache.keys);
  const ids = await redis.smembers(KEY_LIST_SET);
  const metas = [];
  for (const id of ids) {
    const raw = await redis.get(KEY_HASH_PREFIX + id);
    if (raw) metas.push(JSON.parse(raw));
  }
  return metas;
}

/**
 * addPublicKey(keyId, publicKeyBase58, opts)
 * - status: active|retired|revoked
 * - expiresAt: ISO string or null
 */
async function addPublicKey(keyId, publicKeyBase58, opts = {}) {
  assert(keyId && typeof keyId === "string", "keyId required");
  assert(publicKeyBase58 && typeof publicKeyBase58 === "string", "publicKey required");
  // validate base58 length roughly
  bs58.decode(publicKeyBase58);

  const meta = {
    keyId,
    publicKeyBase58,
    status: opts.status || "active",
    createdAt: new Date().toISOString(),
    expiresAt: opts.expiresAt || null,
    notes: opts.notes || null,
  };

  if (!redis) {
    inMemoryCache.keys[keyId] = meta;
    audit({ event: "key_add_inmemory", keyId });
    return meta;
  }

  await redis.set(KEY_HASH_PREFIX + keyId, JSON.stringify(meta));
  await redis.sadd(KEY_LIST_SET, keyId);
  audit({ event: "key_add", keyId, status: meta.status });
  // invalidate cache
  inMemoryCache.expires = 0;
  return meta;
}

/**
 * updateKeyStatus(keyId, status)
 */
async function updateKeyStatus(keyId, status) {
  const meta = await getKeyMeta(keyId);
  if (!meta) throw new Error("Unknown key");
  meta.status = status;
  meta.updatedAt = new Date().toISOString();
  if (redis) {
    await redis.set(KEY_HASH_PREFIX + keyId, JSON.stringify(meta));
  } else {
    inMemoryCache.keys[keyId] = meta;
  }
  audit({ event: "key_status_update", keyId, status });
  inMemoryCache.expires = 0;
  return meta;
}

/**
 * getActivePublicKeys() -> { keyId: publicKeyBase58 }
 * used by verification code
 */
async function getActivePublicKeys() {
  // try cache
  if (Date.now() < inMemoryCache.expires && Object.keys(inMemoryCache.keys).length) {
    const out = {};
    for (const k of Object.keys(inMemoryCache.keys)) {
      const m = inMemoryCache.keys[k];
      if (m.status === "active") out[k] = m.publicKeyBase58;
    }
    return out;
  }
  const metas = await listKeys();
  const out = {};
  for (const m of metas) if (m.status === "active") out[m.keyId] = m.publicKeyBase58;
  // refresh cache
  inMemoryCache.keys = {};
  for (const m of metas) inMemoryCache.keys[m.keyId] = m;
  inMemoryCache.expires = Date.now() + CACHE_TTL_MS;
  return out;
}

module.exports = { getKeyMeta, addPublicKey, updateKeyStatus, getActivePublicKeys, listKeys };
