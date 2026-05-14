// API Base URL Configuration for Atomic Fizz Caps
// ============================================================
// IMPORTANT: This configuration uses split architecture:
//
// 1. Split Architecture (Production):
//    - Frontend: Vercel static hosting at atomicfizzcaps.xyz
//    - Backend: Render persistent server at api.atomicfizzcaps.xyz
//    - API calls should target the backend domain directly
//
// 2. Local Development:
//    - Frontend: Any static server
//    - Backend: Local Express server on localhost:3000
//    - API calls point to http://localhost:3000
//
// A fetch shim below rewrites relative /api/* calls to window.API_BASE so
// legacy modules keep working while still calling the backend directly.
// ============================================================
(function() {
  const hostname = window.location.hostname;

  // Local development environments
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isCodespace = hostname.endsWith('.github.dev') || hostname.endsWith('.preview.app.github.dev');

  if (isLocalhost || isCodespace) {
    // Local dev or GitHub Codespaces: point to local backend
    window.API_BASE = 'http://localhost:3000';
    // Use devnet for local development
    window.SOLANA_RPC = 'https://api.devnet.solana.com';
  } else {
  // Read backend URL from injected global (set in index.html or env.js)
  window.API_BASE = window.__BACKEND_URL__ || 'https://api.atomicfizzcaps.xyz';
  window.SOLANA_RPC = 'https://api.mainnet-beta.solana.com';
}


  // BACKEND_URL is an alias used by some older modules (main.js, authClient.js)
  // while newer modules use API_BASE - both point to the same endpoint
  window.BACKEND_URL = window.API_BASE;

  // Log configuration for debugging
  console.log('[Config] Frontend:', hostname);
  console.log('[Config] Backend API:', window.API_BASE || 'https://api.atomicfizzcaps.xyz');
  console.log('[Config] Solana RPC:', window.SOLANA_RPC);
  console.log('[Config] Mode: Split architecture (Vercel + Render, absolute backend API paths)');

  // Ensure legacy relative `/api/*` calls hit the backend API directly.
  if (!window.__AF_API_FETCH_PATCHED__) {
    const originalFetch = window.fetch.bind(window);
    window.fetch = function(input, init) {
      const base = String(window.API_BASE || '').replace(/\/+$/, '');

      if (typeof input === 'string' && input.startsWith('/api/')) {
        return originalFetch(`${base}${input}`, init);
      }

      if (input instanceof Request) {
        const requestUrl = input.url || '';
        if (requestUrl.startsWith(window.location.origin + '/api/')) {
          const rewrittenUrl = requestUrl.replace(window.location.origin, base);
          return originalFetch(new Request(rewrittenUrl, input), init);
        }
      }

      return originalFetch(input, init);
    };
    window.__AF_API_FETCH_PATCHED__ = true;
  }
})();
