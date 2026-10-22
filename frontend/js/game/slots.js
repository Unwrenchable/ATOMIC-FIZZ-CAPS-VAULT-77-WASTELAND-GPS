// frontend/js/game/slots.js
// One place that decides which equipment slot(s) an item occupies.
// Canonical slots: weapon, head, chest, arms, legs, accessory. Consumables are used, never equipped.
(function () {
  "use strict";
  const root = typeof window !== "undefined" ? window : globalThis;
  root.Game = root.Game || {};

  const SLOTS = ["weapon", "head", "chest", "arms", "legs", "accessory"];
  const ARMOR_SLOTS = ["head", "chest", "arms", "legs"];
  const ALIAS = {
    head: "head", helmet: "head", hat: "head", mask: "head", face: "head", eyes: "head",
    chest: "chest", body: "chest", torso: "chest", armor: "chest", outfit: "chest",
    arms: "arms", arm: "arms", arm_r: "arms", arm_l: "arms", hands: "arms", gloves: "arms",
    legs: "legs", leg: "legs", leg_r: "legs", leg_l: "legs", feet: "legs", boots: "legs",
    accessory: "accessory", ring: "accessory", neck: "accessory", offhand: "accessory", shield: "accessory",
    weapon: "weapon",
  };
  const FULL = ["chest", "arms", "legs"];

  function inferArmorSlot(item) {
    const s = `${item.id || ""} ${item.name || ""} ${(item.tags || []).join(" ")}`.toLowerCase();
    if (/\b(shield)\b|_shield/.test(s)) return "accessory";
    if (/(hat|helmet|mask|hood|goggles|cap|visor|helm)\b|_hat|_mask|_helmet/.test(s)) return "head";
    if (/(gloves?|gauntlets?|bracers?)\b|_gloves/.test(s)) return "arms";
    if (/(boots|greaves|pants|trousers)\b|_boots/.test(s)) return "legs";
    return "chest";
  }

  // -> array of canonical slots, or [] when the item cannot be equipped.
  function slotsFor(item) {
    if (!item || typeof item !== "object") return [];
    const type = String(item.type || "").toLowerCase();
    if (type === "quest" || type === "questitem" || type === "consumable" || type === "aid" || type === "chem") return [];
    if (type === "weapon") return ["weapon"];
    const raw = String(item.slot || "").toLowerCase();
    if (raw === "full" || raw === "full_body" || raw === "fullbody") return FULL.slice();
    if (Array.isArray(item.covers) && raw && ALIAS[raw]) {
      const out = [ALIAS[raw]];
      item.covers.forEach((c) => { const n = ALIAS[String(c).toLowerCase()]; if (n && n !== "weapon" && !out.includes(n)) out.push(n); });
      return out;
    }
    if (raw && ALIAS[raw]) return [ALIAS[raw]];
    if (type === "armor" || type === "apparel" || type === "clothing") return [inferArmorSlot(item)];
    if (type === "accessory") return ["accessory"];
    return [];
  }

  function slotFor(item) {
    const s = slotsFor(item);
    return s.length ? s[0] : null;
  }

  function normalizeSlotName(slot) {
    const raw = String(slot || "").toLowerCase();
    if (raw === "full") return "chest";
    return ALIAS[raw] || null;
  }

  root.Game.Slots = { SLOTS, ARMOR_SLOTS, slotsFor, slotFor, normalizeSlotName, inferArmorSlot };
})();
