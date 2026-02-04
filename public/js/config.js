// API Base URL Configuration for Atomic Fizz Caps
// ============================================================
// IMPORTANT: This configuration supports multiple deployment modes:
//
// 1. Full Stack Vercel (Recommended):
//    - Frontend: Vercel static hosting
//    - Backend: Vercel serverless functions (api/ directory)
//    - API calls use relative paths (e.g., /api/locations)
//
// 2. Split Architecture (Legacy):
//    - Frontend: Vercel static hosting
//    - Backend: External server (e.g., Render)
//    - API calls point to external URL (e.g., https://api.atomicfizzcaps.xyz)
//
// 3. Local Development:
//    - Frontend: Any static server
//    - Backend: Local Express server on localhost:3000
//    - API calls point to http://localhost:3000
//
// This ensures flexible deployment while maintaining a consistent API.
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
    // Production/preview environments on Vercel or custom domains:
    // Use relative paths for API calls - they'll be handled by:
    // - Vercel serverless functions if deployed as full stack
    // - External proxy if configured in vercel.json
    window.API_BASE = '';  // Empty string means relative paths
    // Use mainnet for production
    window.SOLANA_RPC = 'https://api.mainnet-beta.solana.com';
  }
  
  // BACKEND_URL is an alias used by some older modules (main.js, authClient.js)
  // while newer modules use API_BASE - both point to the same endpoint
  window.BACKEND_URL = window.API_BASE;
  
  // Log configuration for debugging
  console.log('[Config] Frontend:', hostname);
  console.log('[Config] Backend API:', window.API_BASE || '(relative paths)');
  console.log('[Config] Solana RPC:', window.SOLANA_RPC);
  console.log('[Config] Mode: Full stack or proxied deployment');
})();
