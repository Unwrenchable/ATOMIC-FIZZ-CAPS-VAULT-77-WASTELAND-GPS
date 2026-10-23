# Hive client pointer (Atomic Fizz ΓåÆ RealAI)

RealAI product home: `C:\RealAI-clean` (`REALAI_HOME`)
Gateway: `http://127.0.0.1:8001` (`REALAI_API_BASE`)
CJS client gold: `%REALAI_HOME%\realai\plugins\atomic_fizz_realai\realai-client.js`

Set in `.env` (see `.env.example`):
- REALAI_HOME
- REALAI_API_BASE
- REALAI_HIVE_CLIENT
- REALAI_API_KEY / REALAI_MODEL

Check:
```
node scripts/realai/resolve-hive-client.js
```

Ability on live: `ability.atomic_fizz_hive_client` (paths|health|chat).
Do not vendor the hive into this vault. HTTP only.
