import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    ignores: [
      "node_modules/**",
      "programs/**",
      "public/js/leaflet.js",
      "**/*.min.js"
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
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
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        crypto: "readonly",
        fetch: "readonly",
        CustomEvent: "readonly",
        EventSource: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        confirm: "readonly",
        alert: "readonly",
        Game: "writable",
        PLAYER: "readonly",
        ITEMS_DB: "readonly",
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "warn",
    }
  }
];
