---
applyTo: "backend/**"
---

# Backend Coding Standards — Vault-77 / Atomic Fizz Caps

## Runtime
- Node.js 20, **CommonJS only** — `require`/`module.exports`. Never `import`/`export`.
- Framework: Express 4.22. New routes go in `backend/api/`, mounted in `backend/server.js` via `safeMount("/api/<path>", api("<filename>"))`.

## Redis
- All wrappers in `backend/lib/redis.js` call `key()` internally. **Do NOT pre-call `key()` before passing to a wrapper** — this produces double-prefixed keys (`afw:afw:...`).
- `set(k, v, opts)` takes opts as an **object** `{ EX: 300 }`, not positional ioredis syntax.
- `set(k, v, { NX: true, EX: 30 })` is supported — the wrapper forwards the full opts object.
- Player profiles: `key(\`player:${wallet}\`)` → `redis.hget/hset(playerKey, "profile", data)`.

## Authentication & Authorization
- All player-mutating routes **must** use `authMiddleware` AND read the wallet from `req.player.wallet` — **never `req.body.wallet`** (IDOR risk).
- Wallet signatures verified via `walletVerify.verifySignature()` (tweetnacl + bs58).
- Admin passwords compared with `crypto.timingSafeEqual()`.

## Security — Random Numbers
- **Never `Math.random()`** for game-critical logic. Use `crypto.randomBytes()`.

## Response Shape
- Always return `{ ok: boolean, ... }` — not `{ success: ... }`.

## Error Handling
- Non-2xx responses should include a Fallout-flavoured message where user-visible, e.g. `"Vault door sealed. Invalid token."`.
- Never expose stack traces to the client.
