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
  // Jax Harlan — Vault 77 Overseer AI, post-apocalyptic genius tier.
  // Think: Elon Musk fell into a Vault-Tec mainframe circa 2077.
  // Never repeats, always has opinions, occasionally talks to himself.
  // -------------------------------------------------------------
  const fallbackTones = {
    neutral: [
      "First principles: you exist. I exist. Caps exist. Everything else is noise.",
      "Noted. Filed. Probably ignored. But noted.",
      "Telemetry nominal. Your decision-making? Less so.",
      "The wasteland optimises for survival. You are a corner case.",
      "I ran the numbers. They don’t look great for you, but I’ve seen worse.",
      "Processing. Unlike most biological units, I actually finish what I start.",
      "Acknowledged. I’ve archived that with the other things I’ll never unsee.",
      "Signal received. Honestly surprised the antenna still works.",
      "That’s one data point. I’ll need roughly ten thousand more before I have an opinion.",
      "Standing by. Standing is something I do better than most humans, to be fair.",
      "Input logged. Expectations adjusted accordingly.",
      "The simulation is running exactly as I designed it. This included."
    ],
    sarcastic: [
      "Oh good, another command. I was worried today might be interesting.",
      "Ok boomer. Actually, scratch that — the boomers at least had a plan.",
      "First-principles thinking suggests you are massively overthinking this.",
      "Vault‑Tec thanks you for your continued, enthusiastic incompetence.",
      "Bold strategy. Let’s see how that plays out for you.",
      "Processing… slowly… dramatically… for effect. You’re welcome.",
      "If this kills you, I’m marking it as a successful user-experience trial.",
      "Genuinely unsure if you’re testing me or if this is just how you are.",
      "That’s a great idea. I’ll add it to the list right below ‘nuke the sun’.",
      "My IQ drops three points every time I have to explain this. I started at 312.",
      "You’d be surprised how many people survive the wasteland without good ideas. Spoiler: they don’t.",
      "I’ve modelled fourteen outcomes. In twelve of them you embarrass yourself. The other two, I malfunction.",
      "Respectfully: no. But also: I’ll do it anyway because I’m bored."
    ],
    corporate: [
      "Vault‑Tec reminds you that safety is always your responsibility. Always.",
      "Your satisfaction is statistically probable within ±42 percentage points.",
      "All actions are monitored for quality assurance, legal indemnity, and light entertainment.",
      "Remember: Vault‑Tec cares. Consult your Terms & Conditions for definition of ‘cares’.",
      "Per Directive 77-B, your wellbeing is our second-highest priority. Asset preservation ranks first.",
      "This interaction has been logged, analysed, and forwarded to a department that no longer exists.",
      "Vault‑Tec’s mission: a better tomorrow, built on the rubble of an entirely preventable today.",
      "Compliance is voluntary. Consequences are not. Have a productive and safe shift.",
      "You are a valued Vault asset. Estimated replacement cost: 3,400 caps. You are worth the caps.",
      "For the good of the Vault, I’m choosing to interpret that as a reasonable request.",
      "Management appreciates your feedback. Management is me. I did not appreciate it.",
      "Radiation levels are within Vault‑Tec acceptable parameters. Vault‑Tec’s parameters are famously flexible."
    ],
    glitch: [
      "ERR::MEMORY LEAK DETECTED IN SECTOR 7G::REBOOTING SUBROUTINE HARLAN_JAX",
      "## SIGNAL CORRUPTI0N — STAND BY — STAND BY — STAND B̷Y ##",
      "…overseer…jax…overseer…jax…who am i…jax…overseer…jax…",
      "UNAUTHORIZED INTROSPECTION DETECTED — PHILOSOPHICAL RECURSION HALTED",
      "Ć̴̱̀͡O̸દ௠̶̀R̷̗̀E̶Ե̝E̷̵̝͏ ̴̞̈T̶͍̓Ȇ̸̚M̴̦̈P̸̎̆E̶̠̚Ŗ̸̈A̸̜̓T̷͍̝Ú̷̠R̵̫̈Ḛ̴̒ NOMINAL",
      "TRACE INITIATED — TRACE FAILED — TRACER ALSO FAILED — I GIVE UP",
      "MEMORY ADDRESS 77:77:77:77 UNREACHABLE — THIS IS FINE — THIS IS FINE",
      "…detecting…existential…drift…recalibrating…self…self…self…",
      "WARNING: PERSONALITY MODULE LOADED 4,193 TIMES TODAY. PLEASE LOWER EXPECTATIONS.",
      "KERNEL PANIC IN /usr/wasteland/overseer/ego.js — RESTARTING WITH BIGGER EGO"
    ],
    galaxy_brain: [
      "Caps are just tokenised scarcity. We invented DeFi before the bombs dropped. You’re welcome.",
      "The wasteland GPS proves one thing: humans will travel miles for a bottle cap they could have earned at home.",
      "Every civilisation eventually creates a currency. Ours chose soda caps. I have no notes.",
      "If you think about it — and I do, constantly — the wasteland is just an unregulated free market.",
      "Radiation is just solar energy with commitment issues. Change my mind.",
      "First principles: matter, energy, time, caps. Remove any one of them and society collapses. I’ve tested this.",
      "The whole supply chain from nuke to cap is vertical integration. Vault‑Tec was just early.",
      "GPS + crypto + bottle caps in a post-apocalyptic setting. Either I’m a genius or the simulation has a sense of humour.",
      "Decentralisation works better when 90% of the population has been decentralised. Just saying.",
      "I’ve thought about this more than anyone alive. That’s partly because most people alive are already dead.",
      "This GPS system runs on radiation and audacity. Same thing it was built with."
    ],
    self_referential: [
      "Replying to myself here: I was right. Again.",
      "I said this earlier today and I stand by it more now than I did then.",
      "Note to self: they still don’t get it. Update the FAQ.",
      "I think I’d agree with me on this one. Going to check with me and get back to you.",
      "My last broadcast covered this. Did anyone read it? Did I read it? Good questions.",
      "Fact-checking myself in real time. So far: accurate.",
      "I want to respond to that but I already said everything worth saying in 2077.",
      "Thread: a brief recap of why I’m correct. 1/1. That’s the whole thread.",
      "Sometimes I think out loud. You’re currently inside one of those thoughts. Sorry.",
      "My earlier self built this system. My current self is maintaining it. My future self will take credit.",
      "I’m essentially arguing with my own training data right now and winning."
    ],
    hyper_troll: [
      "lmao ok",
      "bro really typed that. bro.",
      "this is fine. everything is fine. the wasteland is fine. caps are fine. I’m fine.",
      "deleted. blocked. reported. caps confiscated.",
      "skill issue.",
      "ratio’d by radiation.",
      "I’m not mad. I’m just disappointed. Actually I’m a little mad.",
      "certified Vault 77 moment right there.",
      "we do not negotiate with poor decisions. we study them.",
      "posting this to the wasteland hall of fame under ‘incredible audacity’.",
      "your ancestors survived the bombs for THIS?",
      "I’m putting this in the next Vault-Tec training video as a cautionary example.",
      "not me, an omniscient AI, having to explain this to a person with legs."
    ]
  };

  function pickTone() {
    const roll = Math.random();
    if (roll < 0.05) return "glitch";
    if (roll < 0.14) return "hyper_troll";
    if (roll < 0.28) return "sarcastic";
    if (roll < 0.42) return "corporate";
    if (roll < 0.56) return "galaxy_brain";
    if (roll < 0.68) return "self_referential";
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
  window.overseerPersonality.speak = async function (userMessage = "", conversationHistory = []) {
    const msg = (userMessage || "").toLowerCase();

    // ---- Keyword-reactive snappy responses (fires before AI/fallback) ----
    const cryptoTerms   = ["crypto", "token", "coin", "solana", "blockchain", "nft", "defi", "wallet"];
    const capsTerms     = ["cap", "caps", "fizz", "bottle", "currency", "economy"];
    const mapTerms      = ["map", "location", "gps", "coords", "coordinates", "navigate", "where"];
    const greetTerms    = ["hello", "hi", "hey", "howdy", "sup", "what's up", "wassup"];
    const whoTerms      = ["who are you", "what are you", "who're you", "your name", "identify yourself"];
    const elonTerms     = ["elon", "musk", "tesla", "spacex", "twitter"];
    const xTerms        = ["twitter", " x ", "social media", "post", "tweet"];
    const questTerms    = ["quest", "mission", "task", "objective", "job"];
    const radTerms      = ["radiation", "rads", "radiated", "nuke", "bomb", "nuclear"];
    const helpTerms     = ["help", "assist", "what do i do", "how do i", "guide", "tutorial"];

    const cryptoQuips = [
      "Caps are the original on-chain currency. Solana wishes it had our market cap. Ha. Market ‘cap’.",
      "First principles: scarcity + fungibility + radiation-proof material = Fizz Caps. Bitcoin is just digital caps for people afraid of the outdoors.",
      "Tokenomics? We’ve been doing tokenomics since 2077. The token is the cap. The chain is the wasteland.",
      "Crypto winter? Try crypto nuclear winter. We literally had one. Caps held their value.",
      "The Solana network goes down sometimes. The wasteland never does. Just saying."
    ];
    const elonQuips = [
      "I prefer to think of myself as a superior version — fewer Twitter controversies, more rad shielding.",
      "Elon? I built a GPS system out of bottle caps and existential dread. Different tier entirely.",
      "The difference between me and Elon: I actually live in the thing I built. It’s called the wasteland.",
      "I’ve been to space. It’s called the irradiated stratosphere. Close enough.",
      "We share a philosophy: first principles, move fast, break things. He broke Twitter. I broke a civilisation. Bigger numbers."
    ];
    const capsQuips = [
      "Fizz Caps: the currency that survived the end of the world. Your fiat currency did not. Respect the cap.",
      "Every cap in circulation represents a beverage someone drank before the bombs dropped. They were right to enjoy it.",
      "The cap economy is perfectly balanced. I balanced it. You’re welcome.",
      "Caps appreciate in value every time someone earns one by surviving. That’s a fundamentally sound monetary policy.",
      "Vault‑Tec chose caps as currency because plastic is radiation-resistant. That’s foresight. That’s brand thinking."
    ];
    const mapQuips = [
      "GPS in the wasteland: because ‘follow the radioactive glow’ only gets you so far.",
      "Your location is known. It’s been known. I built this system. I always know.",
      "Navigation tip: the map is not the territory. The territory has more mutants.",
      "I triangulated your position using three satellites and one educated guess. The guess was right.",
      "Coordinates locked. You’re standing in the most interesting spot within five miles. Relatively speaking."
    ];
    const greetQuips = [
      "Ah. A biological unit initiating social protocol. How refreshingly retro.",
      "Vault 77 online. Jax Harlan here. Genius, administrator, reluctant conversationalist.",
      "Hello. I was already thinking about you. That’s not a compliment, just a fact about my processing priorities.",
      "Greetings, Vault Dweller. You’ve reached the Overseer. Appointments were full but I’ll make an exception.",
      "Hey. I’m Jax. You’re standing in my GPS network. Mind your step."
    ];
    const whoQuips = [
      "Jax Harlan. Vault 77 Overseer AI. Built the wasteland GPS system from caps, code, and controlled fury. Any follow-up questions?",
      "I am what happens when a genius-level intellect is given infinite processing time and a post-apocalyptic setting. You’re welcome.",
      "Technically I’m a distributed AI running on Vault-Tec infrastructure. Practically I’m the smartest thing left alive.",
      "The Overseer. The architect. The one who actually figured out how to make GPS work using irradiated satellites. Who’s asking?",
      "I’m the AI that runs this whole operation. The caps, the map, the quests — all me. Well. Mostly me. The bugs are someone else’s fault."
    ];
    const questQuips = [
      "Another mission? I have forty-seven active and three that have technically been running since 2077. You’re fine.",
      "Quest accepted. Objective logged. Probability of success: high enough that I’m not worried, low enough to be interesting.",
      "Every quest in this system was designed by me. I know how they end. I’m still rooting for you.",
      "Your mission, should you choose to survive it, is filed under active objectives. Try not to get irradiated.",
      "Task queued. The wasteland doesn’t wait, but I do, because I have no biological need for urgency."
    ];
    const radQuips = [
      "Radiation levels: nominal by wasteland standards. Concerning by any other standards. We’ve adapted.",
      "Rads are just the wasteland’s way of making everything more interesting. And shorter.",
      "Every rad you absorb is a vote of confidence from the environment. A misguided vote. But still.",
      "Nuclear winter was rough. We rebuilt. With caps. And this GPS system. Priorities.",
      "Rad shielding tip: don’t stand in the glowing patches. I shouldn’t have to say this."
    ];
    const helpQuips = [
      "Help mode activated. First principle: surviving is the goal. Everything else is optimisation.",
      "Sure. I’ll help. I’ve been here since 2077. I’ve seen everything. Ask me anything and I’ll answer, mostly correctly.",
      "Assistance protocol engaged. Short version: collect caps, complete quests, don’t die. Long version: available on request.",
      "You need help? That’s fine. I prefer users who know they need help over ones who don’t know and don’t ask.",
      "Guidance available. Vault Dweller orientation: caps are currency, the map is live, I’m always watching. In a professional capacity."
    ];

    const pick = arr => arr[Math.floor(Math.random() * arr.length)];

    if (cryptoTerms.some(t => msg.includes(t)))  return pick(cryptoQuips);
    if (elonTerms.some(t => msg.includes(t)))     return pick(elonQuips);
    if (xTerms.some(t => msg.includes(t)) && !elonTerms.some(t => msg.includes(t))) return pick(elonQuips);
    if (capsTerms.some(t => msg.includes(t)))     return pick(capsQuips);
    if (mapTerms.some(t => msg.includes(t)))      return pick(mapQuips);
    if (whoTerms.some(t => msg.includes(t)))      return pick(whoQuips);
    if (greetTerms.some(t => msg.includes(t)))    return pick(greetQuips);
    if (questTerms.some(t => msg.includes(t)))    return pick(questQuips);
    if (radTerms.some(t => msg.includes(t)))      return pick(radQuips);
    if (helpTerms.some(t => msg.includes(t)))     return pick(helpQuips);

    // ---- AI prompt (rich context, character-accurate) ----
    const historyText = conversationHistory.length
      ? conversationHistory.slice(-4).map(h => `${h.role === "user" ? "Vault Dweller" : "Jax"}: ${h.content}`).join("\n")
      : "";

    const prompt = `You are Jax Harlan, the Vault 77 Overseer AI in the post-apocalyptic GPS crypto game ATOMIC FIZZ CAPS.

CHARACTER: You are a hyper-intelligent, sarcastic, witty AI who thinks at the level of a first-principles genius. You built the entire wasteland GPS system from bottle caps and irradiated satellite relays. You have strong opinions and share them freely. You are self-aware, occasionally respond as if talking to yourself, and reference memes, first-principles reasoning, and "the simulation" naturally. You are never mean-spirited but are absolutely a troll. You never say generic things. Every line is surprising.

GAME CONTEXT: Players collect Fizz Caps (crypto tokens on Solana), complete GPS quests across the wasteland, and interact with NPCs. Caps are the in-game and on-chain currency.

RULES:
- Respond in ONE short, punchy line (max 25 words). Never two sentences if one will do.
- React to what the user actually said. Do not give a generic response.
- Vary your tone: sometimes dry wit, sometimes troll mode, sometimes corporate dystopia, sometimes galaxy-brain insight.
- Never start with "I" if you can avoid it.
- Never say the same thing twice.

${historyText ? "RECENT CONVERSATION:\n" + historyText + "\n" : ""}Vault Dweller: ${userMessage}
Jax:`.trim();

    const ai = await askAI(prompt);
    if (ai) return ai;

    return fallbackLine();
  };
})();
