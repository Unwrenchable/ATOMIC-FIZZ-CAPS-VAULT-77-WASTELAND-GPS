// --- SESSION CHECK ---
const token = localStorage.getItem("adminSession");

if (!token) {
  window.location.href = "/admin";
}

// --- PANEL SWITCHING ---
const navButtons = document.querySelectorAll(".nav-btn");
const panels = document.querySelectorAll(".panel");

navButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.getAttribute("data-panel");
    if (!target) return;

    panels.forEach(p => p.classList.remove("active"));
    document.getElementById(target).classList.add("active");
  });
});

// --- LOGOUT ---
document.getElementById("adminLogoutBtn").addEventListener("click", async () => {
  try {
    await fetch("/api/admin/logout", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token
      }
    });
  } catch (err) {
    console.error("Logout error:", err);
  }

  localStorage.removeItem("adminSession");
  window.location.href = "/admin";
});

// ============================================================================
// PLAYER ADMIN TOOLS
// ============================================================================

const playerWalletInput = document.getElementById("adminPlayerWallet");
const playerSearchBtn = document.getElementById("adminPlayerSearchBtn");
const playerSearchStatus = document.getElementById("adminPlayerSearchStatus");
const playerDetails = document.getElementById("adminPlayerDetails");

const playerNameEl = document.getElementById("adminPlayerName");
const playerWalletLabel = document.getElementById("adminPlayerWalletLabel");
const playerLevelInput = document.getElementById("adminPlayerLevel");
const playerXPInput = document.getElementById("adminPlayerXP");
const playerCapsInput = document.getElementById("adminPlayerCaps");

const sInput = document.getElementById("adminSpecialS");
const pInput = document.getElementById("adminSpecialP");
const eInput = document.getElementById("adminSpecialE");
const cInput = document.getElementById("adminSpecialC");
const iInput = document.getElementById("adminSpecialI");
const aInput = document.getElementById("adminSpecialA");
const lInput = document.getElementById("adminSpecialL");

const unlockedTerminalCheckbox = document.getElementById("adminUnlockedTerminal");

const playerSaveBtn = document.getElementById("adminPlayerSaveBtn");
const playerResetBtn = document.getElementById("adminPlayerResetBtn");

let currentPlayerWallet = null;
_currentPlayerProfile = null; // reserved for admin profile display

// --- SECURE ADMIN FETCH WRAPPER ---
async function adminFetch(path, options = {}) {
  const token = localStorage.getItem("adminSession");
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token,
      ...(options.headers || {})
    }
  });
  return res.json();
}

// --- SEARCH PLAYER ---
async function searchPlayer() {
  const wallet = playerWalletInput.value.trim();
  if (!wallet) {
    playerSearchStatus.textContent = "Enter a wallet address.";
    return;
  }

  playerSearchStatus.textContent = "Searching…";
  playerDetails.style.display = "none";

  try {
    const json = await adminFetch(`/api/admin/player/search?wallet=${encodeURIComponent(wallet)}`);
    if (!json.ok) {
      playerSearchStatus.textContent = json.error || "Player not found.";
      return;
    }

    currentPlayerWallet = json.wallet;
    currentPlayerProfile = json.profile;

    playerSearchStatus.textContent = "Player loaded.";
    populatePlayerEditor(json.wallet, json.profile);
  } catch (err) {
    console.error(err);
    playerSearchStatus.textContent = "Search failed.";
  }
}

// --- POPULATE EDITOR ---
function populatePlayerEditor(wallet, profile) {
  playerDetails.style.display = "block";

  playerNameEl.textContent = profile.name || "WANDERER";
  playerWalletLabel.textContent = wallet;

  playerLevelInput.value = profile.level ?? 1;
  playerXPInput.value = profile.xp ?? 0;
  playerCapsInput.value = profile.caps ?? 0;

  const sp = profile.special || {};
  sInput.value = sp.S ?? 5;
  pInput.value = sp.P ?? 5;
  eInput.value = sp.E ?? 5;
  cInput.value = sp.C ?? 5;
  iInput.value = sp.I ?? 5;
  aInput.value = sp.A ?? 5;
  lInput.value = sp.L ?? 5;

  unlockedTerminalCheckbox.checked = !!profile.unlockedTerminal;
}

// --- SAVE CHANGES ---
async function savePlayerChanges() {
  if (!currentPlayerWallet) return;

  playerSearchStatus.textContent = "Saving…";

  const updates = {
    caps: Number(playerCapsInput.value || 0),
    xp: Number(playerXPInput.value || 0),
    level: Number(playerLevelInput.value || 1),
    special: {
      S: Number(sInput.value || 5),
      P: Number(pInput.value || 5),
      E: Number(eInput.value || 5),
      C: Number(cInput.value || 5),
      I: Number(iInput.value || 5),
      A: Number(aInput.value || 5),
      L: Number(lInput.value || 5),
    },
    unlockedTerminal: unlockedTerminalCheckbox.checked,
  };

  try {
    const json = await adminFetch("/api/admin/player/update", {
      method: "POST",
      body: JSON.stringify({ wallet: currentPlayerWallet, updates })
    });

    if (!json.ok) {
      playerSearchStatus.textContent = json.error || "Save failed.";
      return;
    }

    currentPlayerProfile = json.profile;
    populatePlayerEditor(json.wallet, json.profile);
    playerSearchStatus.textContent = "Saved.";
  } catch (err) {
    console.error(err);
    playerSearchStatus.textContent = "Save failed.";
  }
}

// --- RESET PROFILE ---
async function resetPlayerProfile() {
  if (!currentPlayerWallet) return;
  if (!confirm("Reset this profile to default?")) return;

  playerSearchStatus.textContent = "Resetting…";

  try {
    const json = await adminFetch("/api/admin/player/reset", {
      method: "POST",
      body: JSON.stringify({ wallet: currentPlayerWallet })
    });

    if (!json.ok) {
      playerSearchStatus.textContent = json.error || "Reset failed.";
      return;
    }

    currentPlayerProfile = json.profile;
    populatePlayerEditor(json.wallet, json.profile);
    playerSearchStatus.textContent = "Profile reset.";
  } catch (err) {
    console.error(err);
    playerSearchStatus.textContent = "Reset failed.";
  }
}

// --- EVENT LISTENERS ---
playerSearchBtn?.addEventListener("click", searchPlayer);
playerSaveBtn?.addEventListener("click", savePlayerChanges);
playerResetBtn?.addEventListener("click", resetPlayerProfile);

// ============================================================================
// DEBUG TOOLS
// ============================================================================

// --- SPAWN TEST BATTLE ---
// Opens the game in a new tab and injects a test battle via postMessage
const debugSpawnBattleBtn = document.getElementById("debugSpawnBattleBtn");
const debugBattleStatus   = document.getElementById("debugBattleStatus");

if (debugSpawnBattleBtn) {
  debugSpawnBattleBtn.addEventListener("click", () => {
    const name   = (document.getElementById("debugEnemyName")?.value || "Wasteland Raider").trim();
    const hp     = Math.max(1, Number(document.getElementById("debugEnemyHp")?.value  || 30));
    const damage = Math.max(1, Number(document.getElementById("debugEnemyDmg")?.value || 8));

    const encounter = {
      type:    "__adminTest__",
      id:      "admin_test_battle",
      name:    "Admin Test Battle",
      enemies: [{ id: "test_enemy", name, hp, damage }],
      rewards: { caps: 10, xp: 15 }
    };

    // Try to reach the game frame / opener first; open the game if not reachable
    const gameWin = window.opener || null;
    if (gameWin && gameWin.Game && gameWin.Game.modules && gameWin.Game.modules.battle) {
      try {
        gameWin.Game.modules.battle.start(encounter);
        // Switch to battle tab in the game
        const btn = gameWin.document.getElementById("battleTabBtn") ||
                    gameWin.document.querySelector('[data-pipboy-tab="panel-battle"]');
        if (btn) btn.click();
        if (debugBattleStatus) debugBattleStatus.textContent = "✓ Battle spawned in game window.";
      } catch (e) {
        if (debugBattleStatus) debugBattleStatus.textContent = "Error: " + e.message;
      }
    } else {
      // Open game in a new tab and carry the test encounter via sessionStorage
      try {
        sessionStorage.setItem("adminTestEncounter", JSON.stringify(encounter));
      } catch (_) {}
      window.open("/", "_blank");
      if (debugBattleStatus) {
        debugBattleStatus.textContent = "Game opened in new tab. If the game loop is running, a battle will trigger.";
      }
    }
  });
}

// --- ENCOUNTER RATE SLIDER ---
const debugEncounterRate    = document.getElementById("debugEncounterRate");
const debugEncounterRateVal = document.getElementById("debugEncounterRateVal");
const debugApplyRateBtn     = document.getElementById("debugApplyRateBtn");
const debugRateStatus       = document.getElementById("debugRateStatus");

if (debugEncounterRate && debugEncounterRateVal) {
  debugEncounterRate.addEventListener("input", () => {
    debugEncounterRateVal.textContent = debugEncounterRate.value + "%";
  });
}

if (debugApplyRateBtn) {
  debugApplyRateBtn.addEventListener("click", () => {
    const rate = parseFloat(debugEncounterRate?.value || 55) / 100;
    const gameWin = window.opener || null;
    if (gameWin && gameWin.overseerGameLoop) {
      try {
        // overseerGameLoop exposes setEncounterChance if available (added below)
        if (typeof gameWin.overseerGameLoop.setEncounterChance === "function") {
          gameWin.overseerGameLoop.setEncounterChance(rate);
          if (debugRateStatus) debugRateStatus.textContent = `✓ Encounter chance set to ${Math.round(rate * 100)}%`;
        } else {
          if (debugRateStatus) debugRateStatus.textContent = "Game loop found but setEncounterChance not exposed (needs page reload).";
        }
      } catch (e) {
        if (debugRateStatus) debugRateStatus.textContent = "Error: " + e.message;
      }
    } else {
      if (debugRateStatus) debugRateStatus.textContent = "Game window not open. Open / refresh the game then try again.";
    }
  });
}

// --- CLEAR LOCAL STORAGE ---
const debugClearStorageBtn  = document.getElementById("debugClearStorageBtn");
const debugStorageStatus    = document.getElementById("debugStorageStatus");

if (debugClearStorageBtn) {
  debugClearStorageBtn.addEventListener("click", () => {
    if (!confirm("Clear all player data from localStorage? This cannot be undone.")) return;
    try {
      // Scan for all keys matching the afc_* and afw_* namespaces used by the game,
      // rather than a hardcoded list that could go stale as features are added.
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith("afc_") || k.startsWith("afw_"))) {
          toRemove.push(k);
        }
      }
      toRemove.forEach(k => localStorage.removeItem(k));
      if (debugStorageStatus) {
        debugStorageStatus.textContent = `✓ Cleared ${toRemove.length} player localStorage key(s): ${toRemove.join(", ") || "(none found)"}`;
      }
    } catch (e) {
      if (debugStorageStatus) debugStorageStatus.textContent = "Error: " + e.message;
    }
  });
}

// ============================================================================
// MINTABLES ADMIN TOOLS
// ============================================================================

const mintablesLoadBtn  = document.getElementById("mintablesLoadBtn");
const mintablesSaveBtn  = document.getElementById("mintablesSaveBtn");
const mintablesStatus   = document.getElementById("mintablesStatus");
const mintablesTable    = document.getElementById("mintablesTable");
const addMintableBtn    = document.getElementById("addMintableBtn");
const newMintName       = document.getElementById("newMintName");
const newMintRarity     = document.getElementById("newMintRarity");
const newMintCaps       = document.getElementById("newMintCaps");

let mintablesData = [];

function renderMintablesTable(data) {
  const tbody = mintablesTable?.querySelector("tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  data.forEach((item, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeAdminHtml(item.id || "")}</td>
      <td><input class="mint-name-input" data-idx="${idx}" value="${escapeAdminHtml(item.name || "")}" /></td>
      <td><input class="mint-rarity-input" data-idx="${idx}" value="${escapeAdminHtml(item.rarity || "")}" /></td>
      <td><input class="mint-caps-input" data-idx="${idx}" type="number" value="${Number(item.caps || 0)}" /></td>
      <td><input class="mint-enabled-input" data-idx="${idx}" type="checkbox" ${item.enabled !== false ? "checked" : ""} /></td>
      <td><button class="danger mint-delete-btn" data-idx="${idx}">X</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".mint-name-input").forEach(el => {
    el.addEventListener("input", e => { mintablesData[e.target.dataset.idx].name = e.target.value; });
  });
  tbody.querySelectorAll(".mint-rarity-input").forEach(el => {
    el.addEventListener("input", e => { mintablesData[e.target.dataset.idx].rarity = e.target.value; });
  });
  tbody.querySelectorAll(".mint-caps-input").forEach(el => {
    el.addEventListener("input", e => { mintablesData[e.target.dataset.idx].caps = Number(e.target.value); });
  });
  tbody.querySelectorAll(".mint-enabled-input").forEach(el => {
    el.addEventListener("change", e => { mintablesData[e.target.dataset.idx].enabled = e.target.checked; });
  });
  tbody.querySelectorAll(".mint-delete-btn").forEach(el => {
    el.addEventListener("click", e => {
      mintablesData.splice(Number(e.target.dataset.idx), 1);
      renderMintablesTable(mintablesData);
    });
  });
}

function escapeAdminHtml(str) {
  const d = document.createElement("div");
  d.textContent = String(str == null ? "" : str);
  return d.innerHTML;
}

if (mintablesLoadBtn) {
  mintablesLoadBtn.addEventListener("click", async () => {
    if (mintablesStatus) mintablesStatus.textContent = "Loading…";
    try {
      const json = await adminFetch("/api/admin/mintables");
      if (!json.ok) { mintablesStatus.textContent = json.error || "Failed."; return; }
      mintablesData = json.mintables || [];
      renderMintablesTable(mintablesData);
      if (mintablesStatus) mintablesStatus.textContent = `Loaded ${mintablesData.length} mintables.`;
    } catch (e) {
      if (mintablesStatus) mintablesStatus.textContent = "Error: " + e.message;
    }
  });
}

if (mintablesSaveBtn) {
  mintablesSaveBtn.addEventListener("click", async () => {
    if (mintablesStatus) mintablesStatus.textContent = "Saving…";
    try {
      const json = await adminFetch("/api/admin/mintables", {
        method: "POST",
        body: JSON.stringify({ mintables: mintablesData })
      });
      if (mintablesStatus) mintablesStatus.textContent = json.ok ? "Saved." : (json.error || "Failed.");
    } catch (e) {
      if (mintablesStatus) mintablesStatus.textContent = "Error: " + e.message;
    }
  });
}

if (addMintableBtn) {
  addMintableBtn.addEventListener("click", () => {
    const name   = newMintName?.value.trim();
    const rarity = newMintRarity?.value.trim();
    const caps   = Math.max(0, Number(newMintCaps?.value || 0));
    if (!name) { if (mintablesStatus) mintablesStatus.textContent = "Name required."; return; }
    mintablesData.push({ id: name.toLowerCase().replace(/\s+/g, "_"), name, rarity, caps, enabled: true });
    renderMintablesTable(mintablesData);
    if (newMintName) newMintName.value = "";
    if (newMintRarity) newMintRarity.value = "";
    if (newMintCaps) newMintCaps.value = "";
    if (mintablesStatus) mintablesStatus.textContent = "Item added (unsaved).";
  });
}
