// public/js/authClient.js

// Requires bs58 to be included in your HTML:
// <script src="https://cdn.jsdelivr.net/npm/bs58@5.0.0/dist/bs58.min.js"></script>

// Use window.API_BASE if available (set in index.html), otherwise default to relative path
// This allows direct API calls in production and Vercel rewrite fallback in dev
function getAuthApiUrl() {
  const base = (window.API_BASE || '').replace(/\/+$/, '');
  return base ? `${base}/api/auth` : '/api/auth';
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
  constructor() {
    this.state = {
      wallet: null,
      sessionId: null,
      authenticated: false,
    };
    this.restoreSession();
  }

  saveSession(sessionId, wallet) {
    localStorage.setItem("sessionId", sessionId);
    localStorage.setItem("wallet", wallet);

    this.state = {
      wallet,
      sessionId,
      authenticated: true,
    };
  }

  clearSession() {
    localStorage.removeItem("sessionId");
    localStorage.removeItem("wallet");

    this.state = {
      wallet: null,
      sessionId: null,
      authenticated: false,
    };
  }

  restoreSession() {
    const sessionId = localStorage.getItem("sessionId");
    const wallet = localStorage.getItem("wallet");

    if (sessionId && wallet) {
      this.state = {
        wallet,
        sessionId,
        authenticated: true,
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
    const nonceRes = await fetch(`${authUrl}/nonce/${publicKey}`);
    const nonceJson = await safeJsonParse(nonceRes);
    if (!nonceJson.ok) throw new Error(nonceJson.error || "Failed to get nonce");

    const nonce = nonceJson.nonce;
    const message = `Atomic Fizz Caps login: ${nonce}`;
    const encoded = new TextEncoder().encode(message);

    // 2. Sign nonce
    const signature = await wallet.signMessage(encoded);
    const signatureBase58 = bs58.encode(signature);

    // 3. Verify
    const verifyRes = await fetch(`${authUrl}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey,
        signature: signatureBase58,
      }),
    });

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
    await fetch(`${authUrl}/logout`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.state.sessionId}`,
      },
    });

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
