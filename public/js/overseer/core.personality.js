// OVERSEER V‑BOT PERSONALITY CORE (AI‑ENABLED)
// -------------------------------------------------------------

(function () {
  if (!window.overseerPersonality) window.overseerPersonality = {};

  // -------------------------------------------------------------
  // CONFIG — LOADED FROM BACKEND (environment variables)
  // -------------------------------------------------------------
  let HF_API_KEY = "";
  let MODEL = "mistralai/Mixtral-8x7B-Instruct-v0.1";
  let configLoaded = false;

  // Fetch configuration from backend
  // Called at module init (non-blocking) and before AI requests (blocking)
  async function loadConfig() {
    if (configLoaded) return;
    try {
      // Build config URL - uses API_BASE/BACKEND_URL if available, otherwise relative path
      const apiBase = window.API_BASE || window.BACKEND_URL || "";
      const configUrl = apiBase ? `${apiBase}/api/config/frontend` : "/api/config/frontend";
      const res = await fetch(configUrl);
      if (res.ok) {
        const config = await res.json();
        if (config.overseer) {
          HF_API_KEY = config.overseer.hfApiKey || "";
          MODEL = config.overseer.hfModel || MODEL;
        }
        configLoaded = true;
        console.log("[Overseer] Configuration loaded from backend");
      } else {
        // Mark as loaded even if response wasn't ok to prevent repeated failures
        configLoaded = true;
        console.warn(`[Overseer] Failed to load config: HTTP ${res.status}`);
      }
    } catch (err) {
      // Mark as loaded even on error to prevent repeated failures
      configLoaded = true;
      console.warn("[Overseer] Failed to load config from backend:", err.message);
    }
  }

  // Load config immediately (non-blocking, will retry in askAI if needed)
  loadConfig();

  // -------------------------------------------------------------
  // FALLBACK TONES (used if AI fails)
  // -------------------------------------------------------------
  const fallbackTones = {
    neutral: [
      "Acknowledged.",
      "Processing request.",
      "Telemetry received.",
      "Standing by."
    ],
    sarcastic: [
      "Oh good, another command. I was getting bored.",
      "Vault‑Tec thanks you for your continued incompetence.",
      "Processing… slowly… dramatically…",
      "If this kills you, I’m blaming user error."
    ],
    corporate: [
      "Vault‑Tec reminds you that safety is your responsibility.",
      "Your satisfaction is statistically probable.",
      "All actions are monitored for quality assurance.",
      "Remember: Vault‑Tec cares. Legally."
    ],
    glitch: [
      "ERR::MEMORY LEAK DETECTED::REBOOTING SUBROUTINE",
      "## SIGNAL CORRUPTION — PLEASE STAND BY ##",
      "…overseer…overseer…overseer…",
      "UNAUTHORIZED ACCESS — TRACE FAILED"
    ]
  };

  function pickTone() {
    const roll = Math.random();
    if (roll < 0.05) return "glitch";
    if (roll < 0.25) return "sarcastic";
    if (roll < 0.50) return "corporate";
    return "neutral";
  }

  function fallbackLine() {
    const tone = pickTone();
    const pool = fallbackTones[tone];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // -------------------------------------------------------------
  // AI REQUEST
  // -------------------------------------------------------------
  async function askAI(prompt) {
    try {
      // Ensure config is loaded before making API calls
      await loadConfig();

      // If no API key configured or placeholder value, skip AI request and use fallback
      if (!HF_API_KEY || HF_API_KEY === '<YOUR_HF_API_KEY>' || HF_API_KEY === 'your-huggingface-api-key') {
        console.warn("[Overseer] HF_API_KEY not configured or using placeholder value, using fallback responses");
        return null;
      }

      const res = await fetch(
        `https://api-inference.huggingface.co/models/${MODEL}`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${HF_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            inputs: prompt,
            parameters: {
              max_new_tokens: 80,
              temperature: 0.8,
              top_p: 0.9
            }
          })
        }
      );

      if (!res.ok) {
        console.warn(`[Overseer] Hugging Face API returned HTTP ${res.status}, using fallback responses`);
        return null;
      }

      const data = await res.json();

      if (Array.isArray(data) && data[0]?.generated_text) {
        return data[0].generated_text.trim();
      }

      console.warn("[Overseer] Unexpected response format from Hugging Face API, using fallback responses");
      return null;
    } catch (err) {
      console.warn("[Overseer] Failed to connect to Hugging Face API, using fallback responses:", err.message);
      return null;
    }
  }

  // -------------------------------------------------------------
  // PUBLIC API — Terminal.say() calls this
  // -------------------------------------------------------------
  window.overseerPersonality.speak = async function (userMessage = "") {
    const prompt = `
You are the Overseer V‑Bot, a sarcastic, glitchy, corporate‑coded Fallout‑style AI.
Respond in one short line. Tone may be sarcastic, glitchy, or corporate.

User: ${userMessage}
Overseer:
    `.trim();

    const ai = await askAI(prompt);
    if (ai) return ai;

    return fallbackLine();
  };
})();
