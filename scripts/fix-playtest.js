#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../tests/visual-playtest.js');
let code = fs.readFileSync(filePath, 'utf8');

// Replace everything between the first forEach('body > div') call and the closing });
// Strategy: find the broken section markers and replace the whole dismiss function body

const FUNC_START = '// ── Dismiss boot/intro screen ─────────────────────────────────\nasync function dismissBootScreen(page) {';
const FUNC_END_MARKER = '  await page.waitForTimeout(500);\n}';

const startIdx = code.indexOf(FUNC_START);
if (startIdx === -1) {
  console.error('Could not find dismissBootScreen function start');
  process.exit(1);
}

const endIdx = code.indexOf(FUNC_END_MARKER, startIdx);
if (endIdx === -1) {
  console.error('Could not find dismissBootScreen function end');
  process.exit(1);
}

const before = code.slice(0, startIdx);
const after = code.slice(endIdx + FUNC_END_MARKER.length);

const fixedFunc = `// ── Dismiss boot/intro screen ─────────────────────────────────
async function dismissBootScreen(page) {
  await page.evaluate(() => {
    ['#introScreen','#bootScreen','#splashScreen','#loadingScreen','#startScreen',
     '.intro-screen','.boot-screen','.loading-screen'].forEach(function(sel) {
      try { document.querySelectorAll(sel).forEach(function(el) {
        el.style.display = 'none'; el.classList.add('hidden');
      }); } catch(e) {}
    });
    document.querySelectorAll('body > div').forEach(function(el) {
      var s = window.getComputedStyle(el);
      var z = parseInt(s.zIndex) || 0;
      if (s.position === 'fixed' && z > 100 &&
          el.id !== 'pipboyScreen' &&
          !el.id.startsWith('pipboy') &&
          !el.id.startsWith('dungeon') &&
          !el.id.startsWith('random-encounter')) {
        el.style.display = 'none';
      }
    });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(500);
}`;

const newCode = before + fixedFunc + after;
fs.writeFileSync(filePath, newCode, 'utf8');
console.log('Fixed dismissBootScreen successfully');
