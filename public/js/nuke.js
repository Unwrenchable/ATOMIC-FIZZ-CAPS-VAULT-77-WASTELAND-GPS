// nuke.js
// ------------------------------------------------------------
// Gear Fusion Chamber - NFT gear destruction/fusion interface
// Opens from RADIO > Nuke section in main Pocket-Boy UI
// ------------------------------------------------------------

(function () {
  "use strict";

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = String(str == null ? "" : str);
    return d.innerHTML;
  }

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

      // Fallback to localStorage - REMOVED FOR SECURITY
      // Wallet addresses should never be stored in localStorage
      if (!walletAddress) {
        console.warn("[nuke] Wallet not available from opener, please connect wallet first");
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
          ${escapeHtml(walletAddress.slice(0, 8))}...${escapeHtml(walletAddress.slice(-6))}
        </div>
      `;

      try {
        // BUG-002 FIX: /api/player/:wallet/inventory does not exist.
        // Use the correct /api/player/:wallet endpoint and extract profile.inventory.
        const apiBase = window.API_BASE || "https://api.atomicfizzcaps.xyz";
        const response = await fetch(`${apiBase}/api/player/${walletAddress}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" }
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const inventory = data.profile?.inventory || data.inventory || [];
        const equippedItems = inventory.filter(item => item.equipped);

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
            Error: ${escapeHtml(err.message || "Unknown")}<br><br>
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
        const name = escapeHtml(item.name || item.id || `GEAR #${index + 1}`);
        const rarity = escapeHtml(item.rarity || "COMMON");
        const type = escapeHtml(item.type || "UNKNOWN");
        const itemId = escapeHtml(item.id || index);

        html += `
          <div class="gear-item" data-item-id="${itemId}">
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

      try {
        // Get wallet address
        let walletAddress = null;

        try {
          if (window.opener && window.opener.web3Wallet) {
            walletAddress = window.opener.web3Wallet.getWalletAddress();
          }
        } catch (e) {}

        if (!walletAddress) {
          // SECURITY: Wallet should not be stored in localStorage
          console.warn("[nuke] Wallet not available from opener");
        }

        if (!walletAddress) {
          throw new Error("Wallet not connected");
        }

        // Prepare fusion data
        const nftMints = items.map(item => item.mint || item.id);
        const fusionType = items.length >= 4 ? 'legendary' : items.length >= 3 ? 'modded' : 'upgrade';

        // Call fusion API
        const apiBase = window.API_BASE || "https://api.atomicfizzcaps.xyz";
        const response = await fetch(`${apiBase}/api/fuse`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // BUG-009 FIX: auth system stores session under "sessionId", not "fizz_auth_token"
            "Authorization": `Bearer ${localStorage.getItem("sessionId") || ""}`
          },
          body: JSON.stringify({
            nftMints,
            walletAddress,
            fusionType
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const result = await response.json();

        // Show success result
        if (gearList) {
          const newItem = result.fusionResult.newItem;
          const newItemName = escapeHtml(newItem.name);
          const newItemRarity = escapeHtml(newItem.rarity);
          const newItemLevel = escapeHtml(newItem.level);
          const moddedLine = newItem.modded
            ? `MODDED: Yes<br>MODIFIERS: ${newItem.modifiers.map(m => escapeHtml(m.name)).join(", ")}<br>`
            : "";
          gearList.innerHTML = `
            <div class="terminal-output terminal-system">
              ✅ FUSION COMPLETE<br><br>
              <strong>NEW ITEM CREATED:</strong><br>
              ${newItemName}<br>
              RARITY: ${newItemRarity.toUpperCase()}<br>
              LEVEL: ${newItemLevel}<br>
              ${moddedLine}
              <br>
              <em>${items.length} items were consumed in the fusion process.</em><br>
              <br>
              ⚛️ FUSION CHAMBER READY FOR NEXT OPERATION
            </div>
            <div style="text-align:center; margin-top:20px;">
              <button class="buy-btn sol-btn" onclick="location.reload()">
                CONTINUE FUSING
              </button>
            </div>
          `;
        }

      } catch (error) {
        console.error("[nuke] Fusion failed:", error);

        if (gearList) {
          gearList.innerHTML = `
            <div class="terminal-output terminal-system">
              ❌ FUSION FAILED<br><br>
              Error: ${escapeHtml(error.message)}<br><br>
              Possible causes:<br>
              • Insufficient fusion cores<br>
              • Network connectivity issues<br>
              • Invalid items selected<br><br>
              <em>Please try again or contact Vault-Tec support.</em>
            </div>
            <div style="text-align:center; margin-top:20px;">
              <button class="buy-btn sol-btn" onclick="location.reload()">
                TRY AGAIN
              </button>
            </div>
          `;
        }
      }
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
