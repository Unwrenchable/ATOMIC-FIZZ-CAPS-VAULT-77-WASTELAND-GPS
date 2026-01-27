// nuke.js
// ------------------------------------------------------------
// Gear Fusion Chamber - NFT gear destruction/fusion interface
// Opens from RADIO > Nuke section in main Pip-Boy UI
// ------------------------------------------------------------

(function () {
  "use strict";

  const NukeGear = {
    loaded: false,
    equippedGear: [],

    async init() {
      if (this.loaded) return;
      console.log("[nuke] Initializing Gear Fusion Chamber");

      // Setup back button
      const backBtn = document.getElementById("backBtn");
      if (backBtn) {
        backBtn.addEventListener("click", () => {
          window.close();
        });
      }

      // Load equipped gear
      await this.loadGear();
      this.loaded = true;
    },

    async loadGear() {
      const gearList = document.getElementById("gearList");
      if (!gearList) return;

      // Check for wallet connection from parent window or localStorage
      let walletAddress = null;

      try {
        // Try to get wallet from opener window
        if (window.opener && window.opener.web3Wallet) {
          walletAddress = window.opener.web3Wallet.getWalletAddress();
        }
      } catch (e) {
        console.warn("[nuke] Could not access opener wallet:", e);
      }

      // Fallback to localStorage
      if (!walletAddress) {
        try {
          const stored = localStorage.getItem("fizz_wallet_address");
          if (stored) {
            walletAddress = stored;
          }
        } catch (e) {
          console.warn("[nuke] Could not read localStorage:", e);
        }
      }

      if (!walletAddress) {
        gearList.innerHTML = `
          <div class="terminal-output terminal-system">
            ⚠️ WALLET NOT CONNECTED<br><br>
            Please connect your wallet in the main Wrist UI first,<br>
            then return to the Gear Fusion Chamber.
          </div>
        `;
        return;
      }

      gearList.innerHTML = `
        <div class="terminal-output terminal-system">
          🔄 SCANNING EQUIPPED GEAR FOR WALLET<br>
          ${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}
        </div>
      `;

      try {
        // Attempt to fetch player's equipped gear from API
        const apiBase = window.API_BASE || "https://api.atomicfizzcaps.xyz";
        const response = await fetch(`${apiBase}/api/player/${walletAddress}/inventory`, {
          method: "GET",
          headers: { "Content-Type": "application/json" }
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const equippedItems = (data.inventory || []).filter(item => item.equipped);

        if (equippedItems.length === 0) {
          gearList.innerHTML = `
            <div class="terminal-output terminal-system">
              NO EQUIPPED GEAR FOUND<br><br>
              Equip NFT gear from your inventory to use the Fusion Chamber.
            </div>
          `;
          return;
        }

        this.equippedGear = equippedItems;
        this.renderGear(gearList, equippedItems);

      } catch (err) {
        console.error("[nuke] Failed to load gear:", err);
        gearList.innerHTML = `
          <div class="terminal-output terminal-system">
            ⚠️ SIGNAL INTERFERENCE<br><br>
            Could not retrieve gear data. The wasteland comms are unstable.<br>
            Error: ${err.message || "Unknown"}<br><br>
            <em>Feature coming soon...</em>
          </div>
        `;
      }
    },

    renderGear(container, items) {
      let html = `
        <div class="terminal-output terminal-system">
          EQUIPPED GEAR DETECTED: ${items.length} ITEM(S)<br>
          ──────────────────────────────────────
        </div>
      `;

      items.forEach((item, index) => {
        const name = item.name || item.id || `GEAR #${index + 1}`;
        const rarity = item.rarity || "COMMON";
        const type = item.type || "UNKNOWN";

        html += `
          <div class="gear-item" data-item-id="${item.id || index}">
            <div class="terminal-output">
              ${index + 1}. <strong>${name}</strong><br>
              &nbsp;&nbsp;&nbsp;TYPE: ${type.toUpperCase()}<br>
              &nbsp;&nbsp;&nbsp;RARITY: ${rarity.toUpperCase()}
            </div>
            <button class="terminal-button nuke-btn" data-index="${index}">
              ☢️ MARK FOR FUSION
            </button>
          </div>
        `;
      });

      html += `
        <div class="terminal-output terminal-system" style="margin-top: 20px;">
          ──────────────────────────────────────<br>
          ⚠️ WARNING: Fusion is PERMANENT.<br>
          Fused items cannot be recovered.
        </div>
        <button class="terminal-button" id="executeNuke" disabled>
          ⚛️ EXECUTE FUSION (0 ITEMS)
        </button>
      `;

      container.innerHTML = html;

      // Wire up fusion buttons
      this.wireButtons();
    },

    wireButtons() {
      const markedItems = new Set();

      document.querySelectorAll(".nuke-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const index = parseInt(btn.dataset.index, 10);
          
          if (markedItems.has(index)) {
            markedItems.delete(index);
            btn.textContent = "☢️ MARK FOR FUSION";
            btn.style.borderColor = "";
          } else {
            markedItems.add(index);
            btn.textContent = "✓ MARKED";
            btn.style.borderColor = "#ff3333";
          }

          // Update execute button
          const executeBtn = document.getElementById("executeNuke");
          if (executeBtn) {
            const count = markedItems.size;
            executeBtn.disabled = count < 2;
            executeBtn.textContent = `⚛️ EXECUTE FUSION (${count} ITEM${count !== 1 ? "S" : ""})`;
          }
        });
      });

      const executeBtn = document.getElementById("executeNuke");
      if (executeBtn) {
        executeBtn.addEventListener("click", () => {
          if (markedItems.size < 2) {
            alert("⚠️ INSUFFICIENT MATERIALS\n\nSelect at least 2 items for fusion.");
            return;
          }

          const confirm = window.confirm(
            `☢️ FUSION CONFIRMATION\n\n` +
            `You are about to permanently fuse ${markedItems.size} items.\n\n` +
            `This action CANNOT be undone!\n\n` +
            `Proceed with fusion?`
          );

          if (confirm) {
            this.executeFusion(Array.from(markedItems));
          }
        });
      }
    },

    async executeFusion(itemIndices) {
      const items = itemIndices.map(i => this.equippedGear[i]).filter(Boolean);
      
      if (items.length < 2) {
        alert("⚠️ FUSION ERROR\n\nInsufficient items selected.");
        return;
      }

      const gearList = document.getElementById("gearList");
      if (gearList) {
        gearList.innerHTML = `
          <div class="terminal-output terminal-system">
            ☢️ INITIALIZING FUSION SEQUENCE...<br><br>
            ANALYZING MOLECULAR STRUCTURES...<br>
            CALCULATING RECOMBINATION MATRIX...<br>
            <br>
            <strong>STAND BY...</strong>
          </div>
        `;
      }

      // TODO: Implement actual fusion API call when backend is ready
      setTimeout(() => {
        if (gearList) {
          gearList.innerHTML = `
            <div class="terminal-output terminal-system">
              ⚠️ FUSION PROTOCOL OFFLINE<br><br>
              The Gear Fusion Chamber is currently undergoing<br>
              maintenance by Vault-Tec technicians.<br><br>
              Check back soon, Vault Dweller.<br><br>
              <em>Feature coming in a future update.</em>
            </div>
          `;
        }
      }, 2000);
    }
  };

  // Initialize on load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => NukeGear.init());
  } else {
    NukeGear.init();
  }

  // Expose globally
  window.NukeGear = NukeGear;
})();
