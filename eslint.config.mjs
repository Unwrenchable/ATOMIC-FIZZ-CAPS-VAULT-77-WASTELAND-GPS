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
      "agents/**",
      "**/*.min.js",
      // ESM-only files that cannot be parsed with sourceType:"commonjs"
      "eslint.config.mjs",
      "lib/realai.js",
      "mcp/**",
      "public/js/game/player-state.js",
      "public/scripts/**",
      "public/js/overseer/index.js",
      "public/js/overseer/realai-brain.js",
      "legacy/**",
      // Service worker (browser-SW globals not wired below)
      "public/sw.js",
      // Offline / scaffolding scripts that are not part of the game runtime
      "backend/tools/**",
      "generate_npcs.js",
      "generate_sidequest_npcs.js",
      "generate_world.js",
      "integrate_world.js",
      "verify-hf-api-usage.js",
      "scripts/**",
      "systems/**",
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
        AbortController: "readonly",
        AbortSignal: "readonly",
        CSS: "readonly",
        CSSStyleSheet: "readonly",
        // Browser Web APIs
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        performance: "readonly",
        screen: "readonly",
        orientation: "readonly",
        atob: "readonly",
        btoa: "readonly",
        structuredClone: "readonly",
        queueMicrotask: "readonly",
        // Third-party CDN globals
        L: "readonly",        // Leaflet
        bs58: "readonly",     // bs58 / base-x
        baseX: "readonly",
        nacl: "readonly",     // tweetnacl
        solanaWeb3: "readonly",
        PIXI: "readonly",     // PixiJS
        turf: "readonly",     // Turf.js geospatial
        topojson: "readonly", // TopoJSON
        dragonBones: "readonly", // DragonBones animation
        // Game globals
        Game: "writable",
        game: "writable",
        PLAYER: "readonly",
        ITEMS_DB: "readonly",
        GAME_STATE: "writable",
        gameState: "writable",
        NPCRegistry: "readonly",
        NPCPortraits: "readonly",
        API_BASE: "readonly",
        safeLog: "readonly",
        safeWarn: "readonly",
        safeError: "readonly",
        escapeHtml: "readonly",
        // Overseer terminal API (loaded via overseer.full.js)
        overseerSay: "readonly",
        overseerSayBlock: "readonly",
        overseerWarn: "readonly",
        overseerError: "readonly",
        Overseer: "writable",
        // Misc browser globals not in ESLint's default browser env list
        loadBaseItems: "readonly",
        html: "writable",
        item: "writable",
      },
    },
    rules: {
      // Warn on unused vars but ignore:
      //   • caught error params (e, err, ex, _e — intentional swallow-errors)
      //   • underscore-prefixed args/vars (conventional "intentionally unused")
      "no-unused-vars": ["warn", {
        "caughtErrors": "none",
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
      }],
      "no-undef": "warn",
      // Allow empty catch blocks — many intentional error-swallowing patterns exist
      // in the codebase (e.g. try { el.focus() } catch(e) {}).
      "no-empty": ["error", { "allowEmptyCatch": true }],
    },
  },
];
