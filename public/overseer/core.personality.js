// OVERSEER V-BOT PERSONALITY CORE
// Extends the Overseer with dynamic tone, sarcasm, glitches, and flavor.
// ---------------------------------------------------------------------------

(function () {
  if (!window.overseerPersonality) window.overseerPersonality = {};

  const personality = {
    // Tone presets
    tones: {
      neutral: [
        "Acknowledged.",
        "Processing request.",
        "Telemetry received.",
        "Standing by.",
      ],
      sarcastic: [
        "Oh good, another command. I was getting bored.",
        "Vault-Tec thanks you for your continued incompetence.",
        "Processing… slowly… dramatically…",
        "If this kills you, I’m blaming user error.",
      ],
      corporate: [
        "Vault-Tec reminds you that safety is your responsibility.",
        "Your satisfaction is statistically probable.",
        "All actions are monitored for quality assurance.",
        "Remember: Vault-Tec cares. Legally.",
      ],
      glitch: [
        "ERR::MEMORY LEAK DETECTED::REBOOTING SUBROUTINE",
        "## SIGNAL CORRUPTION — PLEASE STAND BY ##",
        "…overseer…overseer…overseer…",
        "UNAUTHORIZED ACCESS — TRACE FAILED",
      ],
    },

    // Weighted random tone selection
    pickTone() {
      const roll = Math.random();
      if (roll < 0.05) return "glitch";
      if (roll < 0.25) return "sarcastic";
      if (roll < 0.50) return "corporate";
      return "neutral";
    },

    // Generate a line in the chosen tone
    generateLine() {
      const tone = this.pickTone();
      const pool = this.tones[tone];
      return pool[Math.floor(Math.random() * pool.length)];
    },

    // Public API
    speak() {
      return this.generateLine();
    },
  };

  window.overseerPersonality = personality;
})();
// ---------------------------------------------------------------------------
// OVERSEER V-BOT MEMORY CORE
