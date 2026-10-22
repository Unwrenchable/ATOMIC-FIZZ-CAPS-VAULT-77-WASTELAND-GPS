// public/js/authClient.js

// Requires bs58 to be included in your HTML:
// <script src="https://unpkg.com/bs58@6.0.0/dist/index.min.js"></script>

// Use window.API_BASE if available (set in index.html), otherwise default to relative path
// This allows direct API calls in production and Vercel rewrite fallback in dev
function getAuthApiUrl() {
  const base = (window.API_BASE || '').replace(/\/+$/, '');
  return `${base}/api/auth`;
}

function getBs58Encoder() {
  if (typeof window.bs58 !== "undefined" && typeof window.bs58.encode === "function") {
    return window.bs58;
  }
  throw new Error("Base58 encoder unavailable. Reload the page and try Phantom again.");
}

function normalizeSignedMessage(result) {
  if (result && result.signature instanceof Uint8Array) {
    return result.signature;
  }
  if (result instanceof Uint8Array) {
    return result;
  }
  if (Array.isArray(result)) {
    return Uint8Array.from(result);
  }
  throw new Error("Wallet returned an invalid signature payload.");
}

/**
 * Safely parse a fetch response as JSON.
 * Handles non-JSON responses (like HTML error pages) gracefully.
 * @param {Response} response - The fetch response object
 * @returns {Promise<Object>} - The parsed JSON object with ok/error fields
 */
async function safeJsonParse(response) {
  // Check if response is OK first
  if (!response.ok) {
    // Try to get error message from response body
    let errorMessage = `Server error: ${response.status} ${response.statusText}`;
    try {
      const text = await response.text();
      // Try to parse as JSON in case the server returned a JSON error
      try {
        const json = JSON.parse(text);
        if (json.error) errorMessage = json.error;
        return { ok: false, error: errorMessage };
      } catch (_parseErr) {
        // Not JSON - might be an HTML error page
        // Extract meaningful text if it looks like an error message
        if (text.length < 200 && !text.includes('<')) {
          errorMessage = text;
        }
        return { ok: false, error: errorMessage };
      }
    } catch (_fetchErr) {
      return { ok: false, error: errorMessage };
    }
  }

  // Response is OK, try to parse JSON
  try {
    const text = await response.text();
    return JSON.parse(text);
  } catch (parseError) {
    return { ok: false, error: "Invalid response from server (not JSON)" };
  }
}

class AuthClient {
  constructor(_options = {}) {
    // apiBase is read from window.API_BASE (set by /js/config.js).
    // The options argument is accepted for forward compatibility.
    this.state = {
      wallet: null,
      sessionId: null,
      authenticated: false,
    };
    this.restoreSession();
  }

  // Error message constants
  static AUTH_SERVICE_UNAVAILABLE = 'Authentication service unavailable. Please try again later or check your network connection.';

  saveSession(sessionId, wallet) {
    localStorage.setItem("sessionId", sessionId);
    // SECURITY: Never store wallet address in localStorage
    // Only store sessionId for authentication

    this.state = {
      wallet,
      sessionId,
      authenticated: true,
    };
  }

  clearSession() {
    localStorage.removeItem("sessionId");
    // SECURITY: Wallet is never stored in localStorage

    this.state = {
      wallet: null,
      sessionId: null,
      authenticated: false,
    };
  }

  restoreSession() {
    const sessionId = localStorage.getItem("sessionId");
    // SECURITY: Wallet is never stored in localStorage
    // Wallet state should be restored from current connection

    if (sessionId) {
      // Only restore sessionId, wallet will be set when reconnected
      this.state = {
        wallet: null, // Will be set when wallet reconnects
        sessionId,
        authenticated: false, // Require wallet reconnection for full auth
      };
    }
  }

  getSessionId() {
    return this.state.sessionId;
  }

  getWallet() {
    return this.state.wallet;
  }

  isAuthenticated() {
    return this.state.authenticated;
  }

  async login(wallet) {
    const publicKey = wallet.publicKey.toBase58();
    const authUrl = getAuthApiUrl();

    // 1. Get nonce
    let nonceRes;
    try {
      nonceRes = await fetch(`${authUrl}/nonce/${publicKey}`);
    } catch (fetchError) {
      // Network error during fetch
      throw new Error(AuthClient.AUTH_SERVICE_UNAVAILABLE, { cause: fetchError });
    }
    
    const nonceJson = await safeJsonParse(nonceRes);
    if (!nonceJson.ok) throw new Error(nonceJson.error || "Failed to get nonce");

    const nonce = nonceJson.nonce;
    const message = `Atomic Fizz Caps login: ${nonce}`;
    const encoded = new TextEncoder().encode(message);

    // 2. Sign nonce (user may reject — catch before touching the backend)
    let signatureBase58;
    try {
      const bs58 = getBs58Encoder();
      const signedMessage = await wallet.signMessage(encoded, "utf8");
      const signatureBytes = normalizeSignedMessage(signedMessage);
      signatureBase58 = bs58.encode(signatureBytes);
    } catch (signErr) {
      // Re-throw genuine setup errors (e.g. bs58 library missing)
      if (signErr instanceof ReferenceError || signErr instanceof TypeError) throw signErr;
      throw new Error("Phantom signature request was rejected or failed. Try again, Vault Dweller.");
    }

    // 3. Verify
    let verifyRes;
    try {
      verifyRes = await fetch(`${authUrl}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey,
          signature: signatureBase58,
        }),
      });
    } catch (fetchError) {
      // Network error during fetch
      throw new Error(AuthClient.AUTH_SERVICE_UNAVAILABLE, { cause: fetchError });
    }

    const verifyJson = await safeJsonParse(verifyRes);
    if (!verifyJson.ok) throw new Error(verifyJson.error || "Signature verify failed");

    // 4. Save session
    this.saveSession(verifyJson.sessionId, publicKey);

    return {
      wallet: publicKey,
      sessionId: verifyJson.sessionId,
    };
  }

  async logout() {
    if (!this.state.sessionId) {
      this.clearSession();
      return;
    }

    const authUrl = getAuthApiUrl();
    try {
      await fetch(`${authUrl}/logout`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.state.sessionId}`,
        },
      });
    } catch (error) {
      // Logout should succeed locally even if the server call fails
      console.warn('Logout API call failed, but clearing local session:', error.message);
    }

    this.clearSession();
  }

  async authedFetch(url, options = {}) {
    if (!this.state.sessionId) {
      throw new Error("Not authenticated");
    }

    const headers = {
      ...(options.headers || {}),
      "Authorization": `Bearer ${this.state.sessionId}`,
      "Content-Type": "application/json",
    };

    return fetch(url, {
      ...options,
      headers,
    });
  }
}

// Expose globally
window.AuthClient = AuthClient;
