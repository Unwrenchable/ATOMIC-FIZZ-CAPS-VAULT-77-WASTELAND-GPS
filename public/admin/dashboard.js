// --- SESSION CHECK ---
const token = localStorage.getItem("adminSession");

if (!token) {
  window.location.href = "/admin/index.html";
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
  window.location.href = "/admin/index.html";
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
let currentPlayerProfile = null;

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
