# ☢️ Atomic Fizz Caps — Agent Network Protocol

> **Classification: INTERNAL — VAULT 77 EYES ONLY**
> This document governs how AI agents coordinate work inside this repository.
> Read `.github/agents/memory.md` first for project identity and toolchain
> decisions, then consult this file for inter-agent coordination rules.

---

## 1. How Agents Coordinate

All agents share a common context through two documents:

| Document | Purpose |
|---|---|
| `.github/agents/memory.md` | Persistent facts about the codebase, conventions, and toolchain decisions. **Read this first.** |
| `.github/agents/agent-network.md` | This file — coordination protocol, security rules, ownership, and communication format. |

### Workflow

1. **Before starting any task**, an agent MUST read `.github/agents/memory.md`
   to absorb prior decisions and avoid repeating known mistakes.
2. **After completing a task**, if the agent learns a new architectural fact,
   convention, or command that worked, it SHOULD append a dated entry to
   `.github/agents/memory.md` via a pull request.
3. **Agents do NOT communicate in real time.** Coordination happens through:
   - Git commits and pull requests
   - GitHub issue comments (JSON event schema — see §5)
   - `.github/agents/memory.md` updates

---

## 2. Security Rules — All Agents Must Follow

These rules are NON-NEGOTIABLE and apply to every agent in every task:

### 2.1 No Secrets in Code
- **Never** commit API keys, wallet private keys, mnemonics, RPC endpoints
  with embedded credentials, JWT secrets, or any other sensitive value.
- All secrets go in `.env` files, which are git-ignored.
- If you discover a secret in the repository, raise a GitHub issue immediately
  with the label `security` and do NOT include the secret value in the issue.

### 2.2 Cryptographically Secure RNG Only
- **Backend**: use `crypto.randomBytes()` (Node.js built-in). Never `Math.random()`.
- **Frontend**: use `crypto.getRandomValues()`. Never `Math.random()`.
- The canonical frontend helper is:
  ```js
  function _secureRand() {
    var buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 0x100000000;
  }
  ```

### 2.3 Wallet Source
- Player-mutating API routes MUST source `wallet` from `req.player.wallet`
  (set by `authMiddleware` from the verified session).
- **Never** trust `req.body.wallet` for player identity in non-admin routes.
- Admin-only routes that accept a wallet from `req.body` MUST be guarded by
  `adminAuth` middleware.

### 2.4 Input Validation
- All API routes that accept user input MUST validate it with `express-validator`
  before processing.
- All user-supplied text rendered in the browser DOM MUST pass through
  `escapeHtml()` before assignment to `innerHTML`.

### 2.5 CORS
- The CORS allowlist MUST always include `https://www.atomicfizzcaps.xyz`
  and `https://atomicfizzcaps.xyz`.
- Never set `origin: '*'` as a blanket wildcard.

### 2.6 Timing-Safe Comparisons
- Admin passwords and session tokens MUST be compared with
  `crypto.timingSafeEqual()`. Plain string `===` is forbidden for secrets.

### 2.7 Redis Keys
- All Redis keys MUST use the `afw:` prefix (enforced via `backend/lib/redis.js`
  `key()` helper).

---

## 3. Shared Memory Protocol

```
┌──────────────────────────────────────────────────────────┐
│  Agent starts task                                        │
│     ↓                                                     │
│  Read .github/agents/memory.md                           │
│     ↓                                                     │
│  Perform task (consult memory to avoid regressions)       │
│     ↓                                                     │
│  Discover new architectural fact / working command?       │
│     YES → append to memory.md in the same PR             │
│     NO  → no memory update needed                        │
└──────────────────────────────────────────────────────────┘
```

### Memory Entry Format

Entries in `memory.md` should follow this pattern:

```markdown
- **[YYYY-MM-DD] <Category>** — <One-sentence fact>.
  _Added by: <agent-name>_
```

Examples:
```markdown
- **[2025-07-01] RNG** — All frontend game-critical RNG now uses `_secureRand()`
  backed by `crypto.getRandomValues()`. `Math.random()` is forbidden.
  _Added by: fullstack-dev_

- **[2025-07-01] Testing** — `node tests/security.test.js` runs 32 static-analysis
  security checks with zero external dependencies.
  _Added by: fullstack-dev_
```

---

## 4. Task Ownership Matrix

| Area | Primary Agent | Secondary / Review |
|---|---|---|
| Backend (Node.js/Express) | `fullstack-dev` | `my-agent` |
| Frontend (Vanilla JS, Pip-Boy UI) | `fullstack-dev` | `game-tester` |
| Solana / Web3 / FIZZ token | `my-agent` | `fullstack-dev` |
| Overseer AI terminal | `fullstack-dev` | `wasteland-assistant` |
| Game mechanics (battles, loot, quests) | `wasteland-assistant` | `game-tester` |
| Map / GPS / POI systems | `fullstack-dev` | `wasteland-assistant` |
| QA / Playtesting | `game-tester` | any |
| Security audits | `fullstack-dev` | `my-agent` |
| Lore / NPC dialogue / Fallout authenticity | `wasteland-assistant` | `game-tester` |
| Wormhole bridge / cross-chain | `my-agent` | `fullstack-dev` |
| DevOps (Vercel, Render, GitHub Actions) | `fullstack-dev` | `my-agent` |

> **Conflict resolution**: If two agents disagree on an approach, the primary
> owner wins unless the secondary agent raises a GitHub issue with the
> `architecture` label and links supporting evidence.

---

## 5. Communication Format — GitHub Issue Comment Events

Agents signal state changes and discoveries via GitHub issue comments using
the following JSON event schema. Comments MUST be posted to the relevant issue
or, if no issue exists, to the repository's main tracking issue.

### 5.1 Schema

```json
{
  "agent": "<agent-name>",
  "event": "<event-type>",
  "timestamp": "<ISO-8601>",
  "task": "<short description of what the agent was doing>",
  "area": "<backend|frontend|blockchain|ai|devops|security|game>",
  "status": "<started|completed|blocked|failed>",
  "summary": "<one or two sentence human-readable summary>",
  "details": {
    "files_changed": ["<relative/path/to/file>"],
    "tests_run": "<command>",
    "tests_passed": true,
    "memory_updated": false,
    "pr_number": null,
    "blockers": []
  }
}
```

### 5.2 Event Types

| Event Type | When to Use |
|---|---|
| `task.started` | Agent begins a new task |
| `task.completed` | Agent successfully completes all sub-tasks |
| `task.blocked` | Agent cannot proceed — dependency missing or clarification needed |
| `task.failed` | Agent encountered an unrecoverable error |
| `security.finding` | Agent discovered a potential security vulnerability |
| `memory.updated` | Agent added an entry to `.github/agents/memory.md` |
| `pr.ready` | Agent has raised a pull request for review |

### 5.3 Example Event

```json
{
  "agent": "fullstack-dev",
  "event": "task.completed",
  "timestamp": "2025-07-01T12:00:00Z",
  "task": "Replace Math.random() with crypto.getRandomValues() in game modules",
  "area": "frontend",
  "status": "completed",
  "summary": "Fixed 5 remaining Math.random() calls across dragonbones-npc.js, npc-portraits.js, and struggle-quips.js. All 32 security tests now pass.",
  "details": {
    "files_changed": [
      "public/js/modules/dragonbones-npc.js",
      "public/js/modules/npc-portraits.js",
      "public/js/modules/struggle-quips.js",
      "tests/security.test.js"
    ],
    "tests_run": "node tests/security.test.js",
    "tests_passed": true,
    "memory_updated": true,
    "pr_number": null,
    "blockers": []
  }
}
```

---

## 6. Agent Profiles (Quick Reference)

| Agent | Strengths | Avoid Asking |
|---|---|---|
| `fullstack-dev` | Node.js backend, Vanilla JS frontend, Redis, DevOps, security | Rust/Anchor program internals |
| `my-agent` | Solana/Web3, FIZZ token, Wormhole, Anchor programs | General Express routing |
| `wasteland-assistant` | Game mechanics, Fallout lore, quest design, NPC dialogue | Blockchain details |
| `game-tester` | QA, bug reproduction, edge cases, balance | Code implementation |

---

## 7. Prohibited Actions (All Agents)

1. Do NOT commit secrets, credentials, or private keys.
2. Do NOT use `Math.random()` for any game-critical or security-relevant decision.
3. Do NOT introduce `import`/`export` ES module syntax in backend files (CommonJS only).
4. Do NOT add a frontend build step without updating `vercel.json`.
5. Do NOT trust `req.body.wallet` for player identity in non-admin routes.
6. Do NOT set CORS origin to `'*'` wildcard.
7. Do NOT disclose the contents of `.env` files or environment variable values.
8. Do NOT make changes outside your ownership area without consulting the primary
   owner (raise a GitHub issue with the `coordination` label first).

---

*Last updated: 2025-07-01 — Vault 77 Overseer Network Protocol v1.0*
