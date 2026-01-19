// public/js/authClient.js

// Requires bs58 to be included in your HTML:
// <script src="https://cdn.jsdelivr.net/npm/bs58@5.0.0/dist/bs58.min.js"></script>

const API_BASE = "/api/auth";

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

    // 1. Get nonce
    const nonceRes = await fetch(`${API_BASE}/nonce/${publicKey}`);
    const nonceJson = await nonceRes.json();
    if (!nonceJson.ok) throw new Error(nonceJson.error || "Failed to get nonce");

    const nonce = nonceJson.nonce;
    const message = `Atomic Fizz Caps login: ${nonce}`;
    const encoded = new TextEncoder().encode(message);

    // 2. Sign nonce
    const signature = await wallet.signMessage(encoded);
    const signatureBase58 = bs58.encode(signature);

    // 3. Verify
    const verifyRes = await fetch(`${API_BASE}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey,
        signature: signatureBase58,
      }),
    });

    const verifyJson = await verifyRes.json();
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

    await fetch(`${API_BASE}/logout`, {
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
