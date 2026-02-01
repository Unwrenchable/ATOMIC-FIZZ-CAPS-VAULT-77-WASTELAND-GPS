// public/js/game/api-client.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Unified API Client
// Handles all backend communication with proper error handling
// Routes should NOT silently fail - this client ensures proper feedback
// ------------------------------------------------------------

(function() {
  "use strict";

  window.Game = window.Game || {};
  Game.modules = Game.modules || {};

  const API_TIMEOUT = 15000; // 15 second timeout

  /**
   * Get the API base URL
   */
  function getApiBase() {
    return (window.API_BASE || window.BACKEND_URL || "").replace(/\/+$/, "");
  }

  /**
   * Make an API request with proper error handling
   * @param {string} endpoint - API endpoint (e.g., "/api/player")
   * @param {Object} options - Fetch options
   * @returns {Promise<{ok: boolean, data?: any, error?: string}>}
   */
  async function apiRequest(endpoint, options = {}) {
    const base = getApiBase();
    const url = `${base}${endpoint}`;
    
    const defaultOptions = {
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    };

    // Add auth header if we have a session
    const sessionId = localStorage.getItem("sessionId");
    if (sessionId) {
      defaultOptions.headers["Authorization"] = `Bearer ${sessionId}`;
    }

    const mergedOptions = {
      ...defaultOptions,
      ...options,
      headers: { ...defaultOptions.headers, ...(options.headers || {}) }
    };

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
    mergedOptions.signal = controller.signal;

    try {
      console.log(`[API] ${mergedOptions.method || "GET"} ${endpoint}`);
      
      const response = await fetch(url, mergedOptions);
      clearTimeout(timeoutId);

      // Parse response
      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        // Try to parse as JSON anyway
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }
      }

      if (!response.ok) {
        const errorMsg = data?.error || data?.message || `HTTP ${response.status}`;
        console.error(`[API] Error ${response.status}: ${errorMsg}`);
        return { ok: false, error: errorMsg, status: response.status };
      }

      return { ok: true, data };

    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === "AbortError") {
        console.error(`[API] Timeout: ${endpoint}`);
        return { ok: false, error: "Request timed out" };
      }

      console.error(`[API] Network error: ${err.message}`);
      return { ok: false, error: `Network error: ${err.message}` };
    }
  }

  /**
   * Show user-friendly error notification
   * @param {string} message - Error message
   */
  function showError(message) {
    // Try to use game's notification system
    if (Game.modules?.worldmap?.showMapMessage) {
      Game.modules.worldmap.showMapMessage(`ERROR: ${message}`);
      return;
    }

    // Fallback to console and simple alert for critical errors
    console.error(`[API Error] ${message}`);
  }

  // ============================================================
  // PLAYER API
  // ============================================================

  /**
   * Create or get player profile
   * @param {string} wallet - Player wallet address
   * @param {string} name - Optional player name
   */
  async function createPlayer(wallet, name = "WANDERER") {
    const result = await apiRequest("/api/player/create", {
      method: "POST",
      body: JSON.stringify({ wallet, name })
    });

    if (!result.ok) {
      showError(`Failed to create player: ${result.error}`);
    }

    return result;
  }

  /**
   * Get player profile
   * @param {string} wallet - Player wallet address
   */
  async function getPlayer(wallet) {
    const result = await apiRequest(`/api/player/${wallet}`);
    
    if (!result.ok && result.status !== 404) {
      showError(`Failed to load player: ${result.error}`);
    }

    return result;
  }

  /**
   * Update player SPECIAL stats
   * @param {string} wallet - Player wallet address
   * @param {Object} special - SPECIAL stats object
   */
  async function updateSpecial(wallet, special) {
    const result = await apiRequest("/api/player/special/update", {
      method: "POST",
      body: JSON.stringify({ wallet, special })
    });

    if (!result.ok) {
      showError(`Failed to update SPECIAL: ${result.error}`);
    }

    return result;
  }

  // ============================================================
  // QUEST API
  // ============================================================

  /**
   * Get quest data
   * @param {string} questId - Quest ID
   */
  async function getQuest(questId) {
    const result = await apiRequest(`/api/quests-store/${questId}`);

    if (!result.ok) {
      console.warn(`[API] Quest not found: ${questId}`);
    }

    return result;
  }

  /**
   * Reveal quest details (for accepted quests)
   * @param {string} wallet - Player wallet
   * @param {string} questId - Quest ID
   */
  async function revealQuest(wallet, questId) {
    const result = await apiRequest("/api/quests-store/reveal", {
      method: "POST",
      body: JSON.stringify({ wallet, questId })
    });

    if (!result.ok) {
      console.warn(`[API] Quest reveal failed: ${result.error}`);
    }

    return result;
  }

  /**
   * Submit quest proof
   * @param {string} wallet - Player wallet
   * @param {string} questId - Quest ID
   * @param {Object} proof - Proof object
   */
  async function submitQuestProof(wallet, questId, proof) {
    const result = await apiRequest("/api/quests-store/prove", {
      method: "POST",
      body: JSON.stringify({ wallet, questId, proof })
    });

    if (!result.ok) {
      showError(`Quest verification failed: ${result.error}`);
    }

    return result;
  }

  // ============================================================
  // CAPS & XP API
  // ============================================================

  /**
   * Mint caps to player
   * @param {string} wallet - Player wallet
   * @param {number} amount - Amount to mint
   */
  async function mintCaps(wallet, amount) {
    const result = await apiRequest("/api/caps/mint", {
      method: "POST",
      body: JSON.stringify({ player: wallet, amount })
    });

    if (!result.ok) {
      showError(`Failed to mint caps: ${result.error}`);
    } else {
      // Sync with local state
      if (Game.modules?.PlayerState) {
        Game.modules.PlayerState.awardCaps(amount);
      }
    }

    return result;
  }

  /**
   * Award XP to player
   * @param {string} wallet - Player wallet
   * @param {number} amount - XP amount
   */
  async function awardXP(wallet, amount) {
    const result = await apiRequest("/api/xp/award", {
      method: "POST",
      body: JSON.stringify({ player: wallet, amount })
    });

    if (!result.ok) {
      // XP award may require auth - don't show error, just log
      console.warn(`[API] XP award failed: ${result.error}`);
    } else {
      // Sync with local state
      if (Game.modules?.PlayerState) {
        Game.modules.PlayerState.awardXP(amount);
      }
    }

    return result;
  }

  // ============================================================
  // LOOT & ITEMS API
  // ============================================================

  /**
   * Get loot voucher
   */
  async function getLootVoucher() {
    const result = await apiRequest("/api/loot-voucher", {
      method: "POST"
    });

    if (!result.ok) {
      showError(`Failed to get loot voucher: ${result.error}`);
    }

    return result;
  }

  /**
   * Redeem a voucher
   * @param {Object} voucher - Voucher data
   */
  async function redeemVoucher(voucher) {
    const result = await apiRequest("/api/redeem-voucher", {
      method: "POST",
      body: JSON.stringify(voucher)
    });

    if (!result.ok) {
      showError(`Failed to redeem voucher: ${result.error}`);
    }

    return result;
  }

  /**
   * Claim a mintable item
   */
  async function claimMintable() {
    const result = await apiRequest("/api/mint-item", {
      method: "POST"
    });

    if (!result.ok) {
      showError(`Failed to claim item: ${result.error}`);
    } else if (result.data?.itemId) {
      // Add to local inventory
      const itemId = result.data.itemId;
      if (Game.giveItem) {
        Game.giveItem({ id: itemId, name: itemId, type: "mintable" });
      }
    }

    return result;
  }

  // ============================================================
  // LOCATION API
  // ============================================================

  /**
   * Claim a location
   * @param {string} wallet - Player wallet
   * @param {string} locationId - Location ID
   * @param {Object} coords - Player coordinates { lat, lng }
   */
  async function claimLocation(wallet, locationId, coords) {
    const result = await apiRequest("/api/location-claim", {
      method: "POST",
      body: JSON.stringify({
        wallet,
        locationId,
        playerLat: coords.lat,
        playerLng: coords.lng
      })
    });

    if (!result.ok) {
      if (result.error?.includes("cooldown")) {
        console.log(`[API] Location on cooldown`);
      } else {
        showError(`Failed to claim location: ${result.error}`);
      }
    } else {
      // Mark as visited locally
      if (Game.modules?.PlayerState) {
        Game.modules.PlayerState.visitLocation(locationId);
      }
    }

    return result;
  }

  // ============================================================
  // DATA LOADING API
  // ============================================================

  /**
   * Load game data (locations, quests, etc.)
   * Falls back to static files if API fails
   * @param {string} dataName - Data type (e.g., "locations", "quests")
   */
  async function loadGameData(dataName) {
    // Try API first
    const apiResult = await apiRequest(`/api/${dataName}`);
    if (apiResult.ok) {
      return apiResult.data;
    }

    // Fallback to static file
    console.log(`[API] Falling back to static data for ${dataName}`);
    try {
      const res = await fetch(`/data/${dataName}.json`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn(`[API] Static fallback failed for ${dataName}`);
    }

    return null;
  }

  // ============================================================
  // HEALTH CHECK
  // ============================================================

  /**
   * Check backend health
   */
  async function healthCheck() {
    const result = await apiRequest("/api/health");
    return result.ok && result.data?.status === "ok";
  }

  // ============================================================
  // EXPORT
  // ============================================================

  const ApiClient = {
    // Core
    request: apiRequest,
    getApiBase,
    healthCheck,

    // Player
    createPlayer,
    getPlayer,
    updateSpecial,

    // Quests
    getQuest,
    revealQuest,
    submitQuestProof,

    // Caps & XP
    mintCaps,
    awardXP,

    // Loot & Items
    getLootVoucher,
    redeemVoucher,
    claimMintable,

    // Location
    claimLocation,

    // Data
    loadGameData
  };

  Game.modules.ApiClient = ApiClient;
  window.ApiClient = ApiClient;

  // Check backend health on load
  healthCheck().then(healthy => {
    if (healthy) {
      console.log("[API] Backend connection OK");
    } else {
      console.warn("[API] Backend unavailable - using offline mode");
    }
  });

})();
