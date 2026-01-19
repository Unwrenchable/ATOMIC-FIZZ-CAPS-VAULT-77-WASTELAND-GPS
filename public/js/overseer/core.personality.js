// OVERSEER V‑BOT PERSONALITY CORE (AI‑ENABLED)
// -------------------------------------------------------------

(function () {
  if (!window.overseerPersonality) window.overseerPersonality = {};

  // -------------------------------------------------------------
  // CONFIG — YOUR HUGGINGFACE KEY + MODEL
  // -------------------------------------------------------------
  const HF_API_KEY = "YOUR_HF_KEY_HERE";   // <— replace with your JS key
  const MODEL = "mistralai/Mixtral-8x7B-Instruct-v0.1";

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

      const data = await res.json();

      if (Array.isArray(data) && data[0]?.generated_text) {
        return data[0].generated_text.trim();
      }

      return null;
    } catch (err) {
      console.error("Overseer AI error:", err);
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
