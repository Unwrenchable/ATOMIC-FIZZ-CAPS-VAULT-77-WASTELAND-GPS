# FizzSwap Copilot Helper Pack

This directory contains repo-local context files that help GitHub Copilot and
AI coding assistants give more accurate, project-aware suggestions as the
codebase evolves.

## Files

| File | Purpose |
|------|---------|
| `agent.md` | Repo-specific guidance: structure, toolchain, conventions |
| `memory.md` | Persistent notes updated over time (decisions, gotchas, commands) |
| `bootstrap.md` | Step-by-step local setup for every sub-project |

## Safety rules — please read before editing

1. **Never store secrets.** No private keys, mnemonic phrases, API keys,
   passwords, RPC credentials, or any other sensitive values may appear in any
   file under `.github/agents/`.
2. **Use `.env` files (git-ignored) for all runtime secrets.** Templates with
   placeholder values live in `.env.example` files at the appropriate level.
3. **Human review required.** All additions to `memory.md` must be reviewed in
   a pull request before merging to `main`.
4. **No executable code.** These are documentation files only; they must not
   contain runnable scripts that could be auto-executed by tools.
5. **Keep it factual.** Record only what is true of the repository right now.
   Outdated notes should be removed or corrected promptly.

## How the memory loop works

```
Code change ──► agent proposes memory.md update ──► PR review ──► merge
                                                        │
                                              Human verifies no secrets
                                              and content is accurate
```

Over time `memory.md` accumulates decisions, tested commands, and architecture
notes that make every subsequent AI interaction faster and more accurate.
