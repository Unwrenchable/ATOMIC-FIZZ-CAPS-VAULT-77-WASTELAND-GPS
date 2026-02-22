// API Base URL Configuration for Atomic Fizz Caps
// ============================================================
// IMPORTANT: This configuration uses split architecture:
//
// 1. Split Architecture (Production):
//    - Frontend: Vercel static hosting
//    - Backend: External server on Render (api.atomicfizzcaps.xyz)
//    - API calls point to external URL
//
// 2. Local Development:
//    - Frontend: Any static server
//    - Backend: Local Express server on localhost:3000
//    - API calls point to http://localhost:3000
//
// This split architecture ensures the backend runs on a persistent server
// (not serverless) for better mobile map persistence and WebSocket support.
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
    // Production/preview environments:
    // Point to external backend API on Render
    window.API_BASE = 'https://api.atomicfizzcaps.xyz';
    // Use mainnet for production
    window.SOLANA_RPC = 'https://api.mainnet-beta.solana.com';
  }

  // BACKEND_URL is an alias used by some older modules (main.js, authClient.js)
  // while newer modules use API_BASE - both point to the same endpoint
  window.BACKEND_URL = window.API_BASE;

  // Log configuration for debugging
  console.log('[Config] Frontend:', hostname);
  console.log('[Config] Backend API:', window.API_BASE);
  console.log('[Config] Solana RPC:', window.SOLANA_RPC);
  console.log('[Config] Mode: Split architecture (Vercel + Render)');
})();
