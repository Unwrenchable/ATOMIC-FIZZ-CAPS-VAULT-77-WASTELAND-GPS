#!/usr/bin/env node
"use strict";
// Simple local POI → icon audit.
// Scans public/data/*.json and compares icon/iconKey to public/img/icons/*.svg
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "..", "data");
const ICONS_DIR = path.join(__dirname, "..", "img", "icons");

function safeReadJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { return null; }
}

function flattenPois(obj) {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  return Object.values(obj).reduce((acc, v) => {
    if (Array.isArray(v)) acc.push(...v);
    return acc;
  }, []);
}

function readIconNames() {
  if (!fs.existsSync(ICONS_DIR)) return new Set();
  return new Set(fs.readdirSync(ICONS_DIR).filter(f => f.toLowerCase().endsWith(".svg")).map(f => f.replace(/\.svg$/i, "")));
}

const dataFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json")).map(f => path.join(DATA_DIR, f));
if (!dataFiles.length) {
  console.error("No JSON files found under public/data. Ensure path is correct.");
  process.exit(1);
}

const icons = readIconNames();
const missingMap = new Map();
const usageMap = new Map();

dataFiles.forEach(file => {
  const json = safeReadJson(file);
  if (!json) return;
  const pois = flattenPois(json);
  pois.forEach(p => {
    if (!p) return;
    const raw = (p.icon || p.iconKey || p.type || "").toString().trim();
    const key = raw.replace(/\.(svg|png|jpg|jpeg)$/i, "");
    const name = p.name || p.n || p.id || "(no-name)";
    const id = p.id || p.n || name;
    // Track usage
    if (!usageMap.has(key)) usageMap.set(key, []);
    usageMap.get(key).push({ id, name, file: path.relative(process.cwd(), file) });
    // Track missing
    if (key && !icons.has(key)) {
      if (!missingMap.has(key)) missingMap.set(key, []);
      missingMap.get(key).push({ id, name, file: path.relative(process.cwd(), file) });
    }
    if (!key) {
      if (!missingMap.has("(empty)")) missingMap.set("(empty)", []);
      missingMap.get("(empty)").push({ id, name, file: path.relative(process.cwd(), file) });
    }
  });
});

console.log("=== ICON AUDIT ===");
console.log(`Icons found: ${icons.size}\n`);
if (missingMap.size === 0) {
  console.log("No missing icons detected. All referenced icon keys have matching SVG files.");
} else {
  console.log("Missing icon files (referenced but no matching SVG in public/img/icons):");
  for (const [key, arr] of missingMap.entries()) {
    console.log(` - ${key} → ${arr.length} POI(s) (examples):`);
    arr.slice(0,6).forEach(p => console.log(`    • ${p.name} (id=${p.id}) in ${p.file}`));
  }
}
console.log("\nOptional: list of all referenced icon keys (usage counts):");
[...usageMap.entries()].sort((a,b)=>b[1].length-a[1].length).forEach(([k,v])=>{
  console.log(` - ${k || "(empty)"} : ${v.length}`);
});
