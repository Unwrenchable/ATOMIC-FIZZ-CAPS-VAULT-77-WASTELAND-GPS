// API Base URL Configuration for Atomic Fizz Caps
// ============================================================
// IMPORTANT: This ensures ALL frontend deployments connect to 
// the SAME backend API, creating ONE unified game instance.
//
// Architecture:
// - Backend API: https://api.atomicfizzcaps.xyz (Render)
//   → Single source of truth for all game state, player data, quests
//
// - All Frontends → Point to same backend:
//   → atomicfizzcaps.xyz (Vercel)
//   → www.atomicfizzcaps.xyz (Vercel)  
//   → *.vercel.app (Vercel previews)
//   → *.onrender.com (Render previews)
//   → All connect to: api.atomicfizzcaps.xyz
//
// This means: All players see the same game world regardless of
// which frontend URL they use. Progress syncs across all domains.
// ============================================================
(function() {
  const hostname = window.location.hostname;
  
  // Local development environments
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isCodespace = hostname.endsWith('.github.dev') || hostname.endsWith('.preview.app.github.dev');
  
  if (isLocalhost || isCodespace) {
    // Local dev or GitHub Codespaces: point to local backend
    window.API_BASE = 'http://localhost:3000';
  } else {
    // All production/preview environments (Vercel, Render, custom domain):
    // Use the centralized API at api.atomicfizzcaps.xyz
    // This ensures ONE unified game world for all players
    window.API_BASE = 'https://api.atomicfizzcaps.xyz';
  }
  
  // BACKEND_URL is an alias used by some older modules (main.js, authClient.js)
  // while newer modules use API_BASE - both point to the same endpoint
  window.BACKEND_URL = window.API_BASE;
  
  // Log configuration for debugging
  console.log('[Config] Frontend:', hostname);
  console.log('[Config] Backend API:', window.API_BASE);
  console.log('[Config] Architecture: Unified - all frontends → single backend');
})();
