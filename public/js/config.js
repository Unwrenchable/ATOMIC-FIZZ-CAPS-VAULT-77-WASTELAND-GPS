// API Base URL Configuration for Atomic Fizz Caps
// ============================================================
// IMPORTANT: This configuration uses split architecture:
//
// 1. Split Architecture (Production):
//    - Frontend: Vercel static hosting at atomicfizzcaps.xyz
//    - Backend: Render persistent server at api.atomicfizzcaps.xyz
//    - Vercel proxies /api/* requests to the backend via vercel.json rewrites
//    - API calls use relative paths ('') so they work the same on:
//        * Vercel (proxy rewrites /api/* → backend)
//        * Render (backend is on the same server, handles /api/* directly)
//
// 2. Local Development:
//    - Frontend: Any static server
//    - Backend: Local Express server on localhost:3000
//    - API calls point to http://localhost:3000
//
// This unified relative-path approach means the frontend and API always
// appear to be on the same origin, eliminating CORS for browser calls and
// keeping the persistent Render backend handling all real work.
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
    // Production/preview environments (Vercel or Render):
    // Use relative paths — Vercel proxies /api/* to the backend via rewrites,
    // and Render serves the backend directly on the same origin.
    window.API_BASE = '';
    // Use mainnet for production
    window.SOLANA_RPC = 'https://api.mainnet-beta.solana.com';
  }

  // BACKEND_URL is an alias used by some older modules (main.js, authClient.js)
  // while newer modules use API_BASE - both point to the same endpoint
  window.BACKEND_URL = window.API_BASE;

  // Log configuration for debugging
  console.log('[Config] Frontend:', hostname);
  console.log('[Config] Backend API:', window.API_BASE || '(same origin)');
  console.log('[Config] Solana RPC:', window.SOLANA_RPC);
  console.log('[Config] Mode: Split architecture (Vercel + Render, relative API paths)');
})();
