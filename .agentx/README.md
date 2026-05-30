# AgentX Pack — Atomic Fizz Caps / Vault-77 Wasteland GPS

TX agent roster for the Vault-77 game studio. 15 focused specialists. No bloat.

## Files
- `agents.json` — 15 game-studio agents (trimmed from generic bloat)
- `access_profiles.json` — safe / balanced / power profiles
- `agency_import.json` — original import manifest (reference only)

## Studio Pipeline

```
game-creative-director → game-designer → game-technical-director
       → gameplay-programmer / vault77-fullstack-dev / vault77-web3-specialist
              → vault77-game-tester / game-qa-lead
                     → cybersecurity-expert
                            → GitHub Copilot Task Agent (PR + merge)
```

## Agent Roster

| Agent ID | Role |
|----------|------|
| `vault77-overseer` | Jax Harlan — player-facing Overseer AI, persistent learning |
| `vault77-fullstack-dev` | Backend (Node/Express/Redis) + Frontend (vanilla JS/Pip-Boy) |
| `vault77-hivemind-architect` | Cross-system coordination, shared memory, convergence rules |
| `vault77-game-tester` | QA: 1000 concurrent players, exploits, balance, regression |
| `vault77-wasteland-assistant` | Game mechanics, battle system, crafting, economy |
| `vault77-web3-specialist` | Solana / Phantom wallet / CAPS token / NFT minting |
| `vault77-mcp-server` | MCP server tooling for agent infrastructure |
| `agents-orchestrator` | Multi-agent task orchestration and routing |
| `game-creative-director` | Creative vision, MDA framework, scope arbitration |
| `game-designer` | GDD authoring, balancing, sink/faucet economy design |
| `game-technical-director` | Architecture, ADRs, performance budgets, tech decisions |
| `gameplay-programmer` | Feature implementation, data-driven design, state machines |
| `game-producer` | Sprint planning, milestones, cross-team coordination |
| `game-qa-lead` | Test strategy, bug triage, release quality gates |
| `cybersecurity-expert` | OWASP audits, CVE triage, security remediations |

## Integration with GitHub Copilot

The **GitHub Copilot Task Agent** orchestrates all TX agents. It reads:
- `.github/agents-instructions.md` — coordination rules, routing table, studio pipeline (§9)
- `.github/copilot-instructions.md` — stack conventions, security invariants
- `.github/instructions/backend.instructions.md` — scoped backend rules (`backend/**`)
- `.github/instructions/frontend.instructions.md` — scoped frontend rules (`public/**`)
- `.github/instructions/solana.instructions.md` — scoped Web3 rules (`programs/**`, `workers/**`)

## Suggested Commands
```bash
agentx list
agentx find game
agentx check vault77-fullstack-dev --profile balanced
agentx check game-creative-director --profile balanced
agentx check cybersecurity-expert --profile balanced
agentx check vault77-hivemind-architect --profile power
```
