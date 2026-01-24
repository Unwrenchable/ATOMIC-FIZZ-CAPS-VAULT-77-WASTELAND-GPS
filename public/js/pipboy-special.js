// public/js/pipboy-special.js
window.Pipboy = window.Pipboy || {};

(function () {
  const SPECIAL_KEYS = ["S", "P", "E", "C", "I", "A", "L"];

  async function apiGetProfile(wallet) {
    const res = await fetch(`${window.API_BASE}/api/player/${wallet}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.ok ? data.profile : null;
  }

  async function apiCreateProfile(wallet, name) {
    const res = await fetch(`${window.API_BASE}/api/player/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet, name }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error("create failed");
    return data.profile;
  }

  async function apiRespec(wallet) {
    const res = await fetch(`${window.API_BASE}/api/player/respec`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet }),
    });
    const data = await res.json();
    return { ok: res.ok && data.ok, data };
  }

  function renderSpecial(profile) {
    if (!profile) return;

    const nameEl = document.getElementById("stat-name");
    if (nameEl) nameEl.textContent = profile.name || "WANDERER";

    const lvlEl = document.getElementById("stat-level");
    if (lvlEl) lvlEl.textContent = profile.level || 1;

    const special = profile.special || {};
    SPECIAL_KEYS.forEach((k) => {
      const value = special[k] ?? 5;

      const valEl = document.getElementById(`special-${k}`);
      if (valEl) valEl.textContent = value;

      const bar = document.querySelector(`.special-bar[data-special-key="${k}"]`);
      if (!bar) return;

      bar.innerHTML = "";
      const fill = document.createElement("div");
      fill.style.position = "absolute";
      fill.style.left = "0";
      fill.style.top = "0";
      fill.style.bottom = "0";

      const clamped = Math.min(10, Math.max(1, value));
      fill.style.width = `${clamped * 10}%`;
      fill.style.background = "#00ff41";

      bar.appendChild(fill);
    });
  }

  window.Pipboy.loadProfile = async function (wallet) {
    if (!wallet) return;

    try {
      let profile = await apiGetProfile(wallet);
      if (!profile) {
        const name =
          prompt("VAULT 77 REGISTRATION\n\nENTER NAME:", "WANDERER") ||
          "WANDERER";
        profile = await apiCreateProfile(wallet, name);
      }

      renderSpecial(profile);
      window.Pipboy.currentProfile = profile;
    } catch (err) {
      console.error("[Pipboy] loadProfile error", err);
    }
  };

  async function handleRespec(wallet) {
    const statusEl = document.getElementById("respecStatus");
    if (!wallet) {
      if (statusEl) statusEl.textContent = "Connect wallet first.";
      return;
    }

    if (
      !confirm(
        "Burn a Vault‑Tec Recalibration Token to rebuild SPECIAL?\nThis action cannot be undone."
      )
    )
      return;

    try {
      if (statusEl) statusEl.textContent = "Checking token and burning...";
      const { ok, data } = await apiRespec(wallet);

      if (!ok) {
        if (statusEl)
          statusEl.textContent = data.error || "Respec failed (no token?).";
        return;
      }

      if (statusEl) statusEl.textContent = "SPECIAL reset.";
      renderSpecial(data.profile);
      window.Pipboy.currentProfile = data.profile;
    } catch (err) {
      console.error("[Pipboy] respec error", err);
      if (statusEl) statusEl.textContent = "Error during respec.";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("respecBtn");
    if (btn) {
      btn.addEventListener("click", () => {
        handleRespec(window.currentWallet);
      });
    }
  });
})();
