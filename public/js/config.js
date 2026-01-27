// API Base URL Configuration for Atomic Fizz Caps
// Handles localhost, GitHub Codespaces, Vercel previews, and Render deployments
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
    window.API_BASE = 'https://api.atomicfizzcaps.xyz';
  }
  
  // Also set BACKEND_URL for modules that use that variable
  window.BACKEND_URL = window.API_BASE;
})();
