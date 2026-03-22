import js from "@eslint/js";

export default [
  // ── Global ignores (must be a standalone entry with only `ignores`) ─────────
  {
    ignores: [
      // Dependencies
      "node_modules/**",
      "programs/**",
      // Vendor / third-party bundles (never touch these)
      "public/vendor/**",
      "public/js/leaflet.js",
      "public/js/leaflet-fix.js",
      "**/*.min.js",
      // ESM-only files that cannot be parsed with sourceType:"commonjs"
      "eslint.config.mjs",
      "create-degauss.js",
      "mcp/**",
      "public/scripts/**",
      "public/js/overseer/index.js",
      // Service worker (browser-SW globals not wired below)
      "public/sw.js",
      // Offline / scaffolding scripts that are not part of the game runtime
      "backend/tools/**",
      "generate_npcs.js",
      "generate_sidequest_npcs.js",
      "generate_world.js",
      "integrate_world.js",
      "test-quest-persistence.js",
      "test-scrap-fuse.js",
      "verify-hf-api-usage.js",
      "workers/**",
    ],
  },

  js.configs.recommended,

  // ── Main rule set ────────────────────────────────────────────────────────────
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        // Node.js
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Promise: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        // Browser
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        location: "readonly",
        history: "readonly",
        crypto: "readonly",
        fetch: "readonly",
        Request: "readonly",
        Response: "readonly",
        Headers: "readonly",
        CustomEvent: "readonly",
        Event: "readonly",
        EventSource: "readonly",
        MutationObserver: "readonly",
        IntersectionObserver: "readonly",
        ResizeObserver: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        indexedDB: "readonly",
        confirm: "readonly",
        alert: "readonly",
        prompt: "readonly",
        Audio: "readonly",
        Image: "readonly",
        Uint8Array: "readonly",
        Uint32Array: "readonly",
        Float32Array: "readonly",
        ArrayBuffer: "readonly",
        Int32Array: "readonly",
        // Third-party CDN globals loaded via <script> tags
        L: "readonly",        // Leaflet
        bs58: "readonly",     // bs58 / base-x
        baseX: "readonly",
        nacl: "readonly",     // tweetnacl
        solanaWeb3: "readonly",
        // Game globals
        Game: "writable",
        PLAYER: "readonly",
        ITEMS_DB: "readonly",
        GAME_STATE: "writable",
        NPCRegistry: "readonly",
        NPCPortraits: "readonly",
        API_BASE: "readonly",
        safeLog: "readonly",
        safeWarn: "readonly",
        safeError: "readonly",
        escapeHtml: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "warn",
      // Allow empty catch blocks — many intentional error-swallowing patterns exist
      // in the codebase (e.g. try { el.focus() } catch(e) {}).
      "no-empty": ["error", { "allowEmptyCatch": true }],
    },
  },
];
