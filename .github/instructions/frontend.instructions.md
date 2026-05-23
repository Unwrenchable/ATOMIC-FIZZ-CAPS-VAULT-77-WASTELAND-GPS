---
applyTo: "public/**"
---

# Frontend Coding Standards — Vault-77 / Atomic Fizz Caps

## Stack
- **Vanilla HTML/CSS/JS only** — no React, no TypeScript, no build step.
- Scripts loaded via `<script src="...">` tags directly; no bundler.
- `bs58` loaded as a CDN global: `https://unpkg.com/bs58@6.0.0/dist/index.min.js`.
- Leaflet for GPS maps; Pip-Boy aesthetic for all UI.

## XSS Prevention
- **Always** call `escapeHtml()` before inserting any user-supplied text into `innerHTML`.
- `escapeHtml` pattern: create a temp `<div>`, set `.textContent`, return `.innerHTML`.
- `window.escapeHtml` is defined in `public/js/main.js` and available globally.
- Image URLs from user data: use `safeSrcUrl()` (defined in `public/wallet/wallet.js`).

## Random Numbers
- **Never `Math.random()`** for game-critical logic. Use `crypto.getRandomValues()` with `Uint32Array`.

## Module Layout
- `public/js/modules/` — game logic: `narrative.js`, `quests.js`, `battles.js`, etc.
- `public/js/game/` — player state: `player-state.js`, inventory.
- `public/js/overseer/` — Overseer AI: `overseer.full.js`, `core.personality.js`.
- `public/js/boot.js` — app bootstrap / game-ready init.
- `public/data/` — static JSON: items, narrative dialog, locations.

## Inventory / Item System
- `PlayerState.addItem()` — weapons and armor are non-stackable/non-duplicable (unique-item guard). Consumables/ammo/tools stack.
- Dialog nodes support `grant_items` and `grant_from`, handled by `_grantDialogItems()` in `narrative.js`.
- `items.json` must be **comment-free valid JSON**.

## NPC / Narrative System
- Dialog files: `public/data/narrative/dialog_*.json` — format: `{ intro, nodes, quest_nodes }`.
- Node branching via `_goToNode(nodeId, dialog)` in `narrative.js`.
- Tone colours: `question=#7fd4f5`, `kind=#a0e890`, `sarcastic=#ffcc55`, `direct=#ff9966`.

## Overseer AI
- Pipeline: `generateResponse()` returns `null` on fallback → `handleInput` calls `overseerPersonality.speak()`.
- Always proxy through `/api/overseer/ask` — never call Hugging Face directly from the browser.
