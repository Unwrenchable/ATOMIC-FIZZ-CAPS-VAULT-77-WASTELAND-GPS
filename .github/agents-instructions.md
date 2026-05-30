# ☢️ Vault-77 Agent Network: Networked Group Mind

> **Vault-Tec Classification: UNCLASSIFIED / ALL AGENTS**  
> Central coordination document for all AI coding agents operating on the
> **Atomic Fizz Caps** Wasteland GPS game repository.  
> Read this file first, then `.github/agents/README.md` and `.github/agents/agent.md` before making any changes.

---

## 1. Repository Initialization Checklist

Before making any changes, verify the following:

- [ ] **Source code organized**: `backend/` (API), `public/` (frontend), `programs/` (Solana), `workers/`, `scripts/`, `docs/`
- [ ] **Dependencies declared**: `package.json` at repo root lists all Node.js dependencies
- [ ] **Environment template present**: `.env.example` lists all required env vars (no secrets)
- [ ] **Linter configured**: `eslint.config.mjs` + `.github/workflows/` for CI
- [ ] **CI workflows active**: `.github/workflows/smoke-test.yml` (API health on push to `main`), `.github/workflows/manual-vercel-deploy.yml`
- [ ] **Backend entry point**: `backend/server.js` starts Express and mounts all routes via `safeMount()`
- [ ] **Redis operational**: `backend/lib/redis.js` — falls back to in-memory store if Redis unreachable
- [ ] **Frontend static**: `public/` — vanilla HTML/CSS/JS, no build step, served as-is by Vercel

---

## 2. Agent Peer Discovery

Agents operating on this repository discover each other through the following:

### Registry (`.github/agents/` directory)

| Agent File | Role |
|------------|------|
| `README.md` | Top-level orientation — read first |
| `agent.md` | Repo structure, toolchain, conventions |
| `bootstrap.md` | Local setup guide |
| `fullstack-dev.md` | Full-stack master agent (Node/Express + vanilla JS + Solana) |
| `web3-specialist.md` | Solana / Phantom wallet / FIZZ token expert |
| `wasteland-assistant.md` | Game mechanics, battle system, crafting, economy |
| `my-agent.agent.md` | Vault 77 Overseer personality agent |
| `game-creative-director.agent.md` | Creative vision, MDA conflicts, scope arbitration |
| `game-designer.agent.md` | GDD authoring, balancing, sink/faucet economy design |
| `game-technical-director.agent.md` | Architecture, ADRs, performance budgets, tech decisions |
| `gameplay-programmer.agent.md` | Feature implementation, data-driven design, state machines |
| `cybersecurity-expert.agent.md` | OWASP audits, CVE triage, security remediations |
| `memory.md` | Persistent decisions, verified commands, gotchas |
| `tasks.md` | **Active task queue and event log — check before starting work** |

### Peer Discovery Protocol

1. **Read `README.md` first** — confirms project identity (Atomic Fizz Caps GPS game, NOT a DEX).
2. **Check `tasks.md`** — see what tasks are currently in progress to avoid conflicts.
3. **Check `memory.md`** — contains verified facts, tested commands, and architecture decisions from prior agent runs.
4. **Check `agent.md`** — confirms toolchain and conventions before writing code.
5. **Task routing** — route specialized tasks to the appropriate agent file (e.g., Solana changes → `web3-specialist.md`, AI/Overseer → `my-agent.agent.md`, game mechanics → `wasteland-assistant.md`).

---

## 3. Communication Formats

### Message Format: JSON

All inter-agent communication (task handoffs, state updates, bug reports) uses structured JSON:

```json
{
  "event_id": "<unique-uuid-v4>",
  "timestamp": "<ISO-8601>",
  "source_agent": "<agent-file-name>",
  "target_agent": "<agent-file-name | 'broadcast'>",
  "event_type": "<task_update | bug_report | state_sync | broadcast>",
  "payload": {
    "description": "<human-readable summary>",
    "affected_files": ["<path/to/file>"],
    "status": "<pending | in_progress | complete | failed>",
    "error": "<error message if status=failed | null>"
  }
}
```

### Event Types

| Type | When to Use |
|------|-------------|
| `task_update` | Progress on a specific implementation task |
| `bug_report` | Discovered defect with reproduction steps |
| `state_sync` | Sharing shared memory / `memory.md` updates |
| `broadcast` | System-wide notification (e.g., "Level overhaul ready") |

---

## 4. Agent Synchronization Protocols

### 4.1 Event-Driven Model

Agents communicate via an event queue. Every event **must** carry a unique identifier.

**Emit pattern (broadcast example):**
```json
{
  "event_id": "evt-a7f3c2e1-9b44-4d2a-ae12-00deadbeef77",
  "event_type": "broadcast",
  "payload": {
    "description": "Map system overhaul complete — POI rendering refactored.",
    "affected_files": ["public/js/map/poi-renderer.js"],
    "status": "complete"
  }
}
```

**Listener callback pattern:**
- `onTaskComplete(eventId)` — triggered when a task event with `status: "complete"` is received
- `onBugReport(eventId)` — triggered when a `bug_report` event arrives; routes to the fix queue
- `onStateSync(eventId)` — merges incoming `memory.md` updates into shared context

### 4.2 Unique Event Identifiers

Every event **must** include a `event_id` using UUID v4 format: `evt-<uuid>`.

- In Node.js backend: use `crypto.randomUUID()` (Node 15.6+)
- In browser frontend: use `crypto.randomUUID()` or `crypto.getRandomValues()` — never `Math.random()`

### 4.3 Shared Memory (Group Mind)

Agents maintain a shared context via `memory.md`:

1. **Read**: Before starting a task, read `memory.md` for prior decisions.
2. **Write**: After completing a task, append new facts using this format:

```markdown
### [YYYY-MM-DD] <Short fact title>
- **What**: <one-line description>
- **Why**: <rationale>
- **Verified**: <tested command or evidence>
```

3. **Merge conflicts**: If two agents update `memory.md` simultaneously, prefer the more recent entry with verified test evidence.

### 4.4 Convergence Rules

- Agents must NOT make isolated decisions on shared systems (Redis keys, auth flow, CORS config).
- Any change to `backend/lib/redis.js`, `backend/lib/walletVerify.js`, or `backend/server.js` requires a note in `memory.md`.
- If an agent reaches a conflicting state, it emits a `state_sync` event and waits for the group mind to reconcile.

---

## 5. Failure Mitigation Strategies

### 5.1 Redis Unavailability

- `backend/lib/redis.js` auto-falls back to an in-memory store.
- Agents should not assume Redis is always available.
- On Redis failure: log the error, continue with in-memory fallback, emit a `bug_report` event.

### 5.2 Hugging Face AI Timeout

- `backend/api/overseer-proxy.js` proxies HF requests.
- On timeout or 5xx from HF: return fallback personality response from `core.personality.js`.
- Agents modifying the Overseer must preserve the fallback path.

### 5.3 Solana RPC Failure

- Frontend wallet operations degrade gracefully — show error banner, preserve local state.
- Never mutate player state on the backend without a verified Solana signature (`backend/lib/walletVerify.js`).
- On RPC failure: surface a clear user error in the Pip-Boy UI (no silent failures).

### 5.4 GPS Claim Failures

- Claims require HMAC-signed GPS tokens (`GPS_SECRET`).
- On invalid GPS token: return `403` with a Fallout-flavoured message, do not write to Redis.
- Agents modifying GPS claim logic must test with both valid and invalid token cases.

### 5.5 CI / Smoke Test Failure

- If `GET https://api.atomicfizzcaps.xyz/api/health` returns non-2xx:
  1. Check Render deploy logs for backend startup errors.
  2. Verify `REDIS_URL` uses `redis://` or `rediss://` protocol (not `http://`).
  3. Check for missing env vars (compare against `.env.example`).
  4. Roll back the last deploy if the issue cannot be diagnosed in < 15 minutes.

---

## 6. GitHub Copilot Integration Workflow

### 6.1 Task Prompt Embedding

Agents and Copilot tasks should embed intent in comment blocks so context is preserved:

```javascript
// TASK: [bug] Fix double-prefix in Redis key for quest-secrets
// AFFECTED: backend/api/quest-secrets.js
// STEPS:
//   1. Remove key() call at callsite — redis wrapper calls key() internally
//   2. Pass bare string: `player:${wallet}:quest:${questId}`
//   3. Verify with: node -e "require('./backend/lib/redis').get('test')"
// STATUS: pending
```

### 6.2 Copilot Coding Agent Rules

When GitHub Copilot coding agent is invoked on this repository:

1. **Read this file first**, then `.github/agents/README.md` and `.github/agents/agent.md`.
2. **Check `tasks.md`** — confirm no other agent is mid-edit on the same files.
3. **Make minimal changes** — surgical edits only; do not refactor unrelated code.
4. **Match the stack**: CommonJS in backend, vanilla JS in frontend, no TypeScript.
5. **Security invariants** (never violate):
   - All RNG via `crypto.getRandomValues()` (browser) or `crypto.randomBytes()` (Node) — never `Math.random()`
   - All player-mutating routes MUST call `walletVerify.verifySignature()`
   - Admin passwords MUST use `crypto.timingSafeEqual()`
   - No secrets committed to any file — use `.env` (git-ignored)
6. **Before committing**: run `npm run lint` and verify the smoke-test path (`GET /api/health`) is unbroken.
7. **After committing**: update `memory.md` if a new convention was established or a gotcha was discovered. Update `tasks.md` to mark your task complete.

### 6.3 Routing Logic for Efficiency

| Task Category | Agent / File to Use |
|---------------|---------------------|
| Backend API route bug | `agent.md` + `backend/api/<route>.js` |
| Redis key / data bug | `memory.md` (check double-prefix gotcha) + `backend/lib/redis.js` |
| Wallet / auth security | `web3-specialist.md` + `backend/lib/walletVerify.js` |
| Frontend UI / Pip-Boy | `agent.md` + `public/js/` |
| Overseer AI dialogue | `my-agent.agent.md` + `public/js/overseer/` |
| Game mechanics | `wasteland-assistant.md` + `public/js/modules/` |
| Game design / balancing | `game-designer.agent.md` + `docs/` |
| Creative vision / MDA | `game-creative-director.agent.md` |
| Architecture / ADRs | `game-technical-director.agent.md` |
| Gameplay feature implementation | `gameplay-programmer.agent.md` + `public/js/modules/` |
| Security audit / CVE triage | `cybersecurity-expert.agent.md` |
| Solana program | `web3-specialist.md` + `programs/` |
| NFT minting | `web3-specialist.md` + `workers/` |
| Deployment / infra | `bootstrap.md` + `render.yaml` / `vercel.json` |

### 6.4 Agent Authority and Conflict Resolution

When two agents produce conflicting changes, resolve using this priority:

1. **Security invariant** — any agent enforcing a security rule (no Math.random,
   wallet verification, timingSafeEqual) wins unconditionally.
2. **`memory.md` entry with verified evidence** — wins over undocumented assumptions.
3. **More recent `tasks.md` claim** — the agent that claimed the task first takes
   priority while status is `in_progress`. Others must wait or coordinate.
4. **`copilot-instructions.md` / `agents-instructions.md`** — canonical for
   stack-level decisions (CommonJS vs ESM, route directory location, etc.).
5. **Human review** — when two verified memory entries conflict, open a PR and
   request human resolution before merging either change.

---

## 7. Key Workflows

### 7.1 New Feature Workflow

```
1. Read memory.md → check for prior decisions on the feature area
2. Read agent.md  → confirm conventions
3. Branch from main
4. Implement minimal change (surgical edit)
5. npm run lint → fix any issues
6. Manual smoke test → verify /api/health + affected endpoint
7. Update memory.md → record any new gotcha or verified command
8. Open PR → CI smoke test validates on merge
```

### 7.2 Bug Fix Workflow

```
1. Reproduce the bug → document repro steps
2. Emit bug_report event (see §3) → update task queue
3. Trace to root cause (grep, glob, view tools)
4. Fix smallest possible code surface
5. Verify fix does not break adjacent functionality
6. npm run lint
7. Update memory.md if it was a recurring class of bug
8. PR → CI green → merge
```

### 7.3 Memory Sync Workflow

```
After any non-trivial change:
  agent proposes memory.md addition
    → human reviews (no secrets, content accurate)
      → merge into memory.md
        → all future agents pick it up
```

---

## 8. API Endpoint Quick Reference

> Cross-checked against `backend/server.js` mounts. Routes live in `backend/api/`.

| Method | Path | Auth Required |
|--------|------|---------------|
| GET | `/api/health` | No |
| POST | `/api/location-claim` | Wallet sig |
| GET | `/api/locations` | No |
| GET | `/api/player` | No |
| POST | `/api/player` | Wallet sig |
| GET | `/api/player-nfts` | No |
| GET | `/api/caps` | No |
| GET | `/api/xp` | No |
| POST | `/api/gps` | HMAC |
| POST | `/api/overseer/ask` | No |
| GET | `/api/mintables` | No |
| POST | `/api/mint-item` | Wallet sig |
| POST | `/api/loot-voucher` | Wallet sig |
| POST | `/api/redeem-voucher` | Wallet sig |
| POST | `/api/fuse` | Wallet sig |
| POST | `/api/scrap-nft` | Wallet sig |
| GET | `/api/config/frontend` | No |
| GET | `/api/quests` | No |
| POST | `/api/quests-store` | Wallet sig |
| GET/POST | `/api/quest-secrets` | Mixed |
| POST | `/api/quest-endings` | Wallet sig |
| GET | `/api/settings` | No |
| GET | `/api/cooldowns` | No |
| GET | `/api/rotation` | No |
| GET | `/api/scavenger` | No |
| GET/POST | `/api/fizz-fun` | Mixed |
| GET/POST | `/api/wallet` | Mixed |
| GET/POST | `/api/admin/player` | Admin |
| GET/POST | `/api/admin/mintables` | Admin |
| GET/POST | `/api/admin/keys` | Admin |

---

---

## 9. Studio Pipeline (Concept → Ship)

This is how work flows across the agent roster. Every agent knows their position in the assembly line. No freelancing, no skipping stages.

```
┌─────────────────────────────────────────────────────────────┐
│  GAME STUDIO PIPELINE — ATOMIC FIZZ CAPS / VAULT-77         │
├──────────────┬──────────────────────────────────────────────┤
│  Stage       │  Owner Agent(s)                              │
├──────────────┼──────────────────────────────────────────────┤
│ 1. Vision    │  game-creative-director                      │
│              │  Sets scope, MDA goals, rejects scope creep  │
├──────────────┼──────────────────────────────────────────────┤
│ 2. Design    │  game-designer                               │
│              │  GDD, balancing, sink/faucet economy         │
├──────────────┼──────────────────────────────────────────────┤
│ 3. Arch      │  game-technical-director                     │
│              │  ADRs, tech choices, performance budgets     │
├──────────────┼──────────────────────────────────────────────┤
│ 4. Build     │  gameplay-programmer (game mechanics)        │
│              │  vault77-fullstack-dev (backend + frontend)  │
│              │  vault77-web3-specialist (Solana/NFT/CAPS)   │
├──────────────┼──────────────────────────────────────────────┤
│ 5. Test      │  vault77-game-tester / game-qa-lead          │
│              │  Regression, balance, exploit checks         │
├──────────────┼──────────────────────────────────────────────┤
│ 6. Security  │  cybersecurity-expert                        │
│              │  OWASP audit, CVE triage, hardening          │
├──────────────┼──────────────────────────────────────────────┤
│ 7. Ship      │  GitHub Copilot Task Agent                   │
│              │  Final PR, CI green, merge to main           │
└──────────────┴──────────────────────────────────────────────┘
```

### 9.1 Escalation Chain

| Scenario | Escalate To |
|----------|-------------|
| Scope conflict between features | `game-creative-director` |
| Architecture disagreement | `game-technical-director` |
| Balance/economy concern | `game-designer` |
| Security vulnerability found | `cybersecurity-expert` (blocks ship) |
| Test regression found | `vault77-game-tester` + fix owner |
| Human required | Open PR, request review — do not guess |

### 9.2 GitHub Copilot ↔ TX Agents (`.agentx`) Integration

The **GitHub Copilot Task Agent** (this agent) is the **integration layer** between human requests and the TX agent roster defined in `.agentx/agents.json`.

**How it works:**
1. Human issues a task via GitHub Copilot.
2. Copilot Task Agent identifies the domain (game mechanics, backend, Solana, security, etc.).
3. It delegates to the appropriate TX agent via the `task` tool (see §6.3 routing table).
4. TX agent executes and returns results.
5. Copilot Task Agent reviews, integrates, and commits.

**TX Agent Registry:** `.agentx/agents.json`  
**Active game-studio agents:** `vault77-overseer`, `vault77-fullstack-dev`, `vault77-hivemind-architect`, `vault77-game-tester`, `vault77-wasteland-assistant`, `vault77-web3-specialist`, `game-creative-director`, `game-designer`, `game-technical-director`, `gameplay-programmer`, `game-producer`, `game-qa-lead`, `cybersecurity-expert`

**Scoped coding instructions for GitHub Copilot Workspace:**
- `backend/**` → `.github/instructions/backend.instructions.md`
- `public/**` → `.github/instructions/frontend.instructions.md`
- `programs/**, workers/**, solana/**` → `.github/instructions/solana.instructions.md`

### 9.3 Agent Authority Ladder

```
game-creative-director  ← highest creative authority
        ↓
game-technical-director ← highest technical authority
        ↓
cybersecurity-expert    ← blocks any ship on security finding
        ↓
game-designer           ← owns balance & economy decisions
        ↓
gameplay-programmer / vault77-fullstack-dev / vault77-web3-specialist
        ↓
vault77-game-tester / game-qa-lead
        ↓
GitHub Copilot Task Agent ← integration, PR, merge
```

Security invariants override **everything**. An agent enforcing a security rule (no `Math.random`, wallet verification, `timingSafeEqual`) wins unconditionally, regardless of stage.

---

*☢️ Per Vault-Tec Regulation 77-D: All agents must read this document before
coordinating on any cross-system change. The wasteland rewards preparation.
Rads rising. What's your move, smoothskin? ☢️*
