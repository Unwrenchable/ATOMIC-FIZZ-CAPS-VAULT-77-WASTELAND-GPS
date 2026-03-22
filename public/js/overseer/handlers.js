// /js/overseer/handlers.js
// Custom Overseer Commands (experimental zones, etc.)

window.overseerHandlers = {

  start() {
    const delay = (fn, ms) => setTimeout(fn, ms);

    overseerSay("> VAULT 77 // ATOMIC FIZZ CAPS INITIATIVE");
    overseerSay("> ────────────────────────────────────────");
    overseerSay("");
    delay(() => {
      overseerSay("> WELCOME TO THE ATOMIC FIZZ CAPS PROGRAM.");
      overseerSay("> YOU ARE ONE OF FEW SURVIVORS CHOSEN FOR THIS INITIATIVE.");
      overseerSay("");
    }, 500);
    delay(() => {
      overseerSay("> HOW THIS WORKS:");
      overseerSay(">  1. EXPLORE real GPS locations in the wasteland");
      overseerSay(">  2. CLAIM Points of Interest to earn FIZZ tokens (Solana)");
      overseerSay(">  3. LOOT gear, fight creatures, complete quests");
      overseerSay(">  4. LEVEL UP your survivor rank and build reputation");
      overseerSay("");
    }, 1500);
    delay(() => {
      overseerSay("> QUICK COMMANDS TO GET STARTED:");
      overseerSay(">  status    - Check your current stats & location");
      overseerSay(">  quest     - View your active quest log");
      overseerSay(">  inventory - See what you're carrying");
      overseerSay(">  map       - Scan nearby Points of Interest");
      overseerSay(">  caps      - Check your FIZZ cap balance");
      overseerSay("");
    }, 2800);
    delay(() => {
      overseerSay("> ENTERTAINMENT:");
      overseerSay(">  games     - List all mini-games");
      overseerSay(">  jokes     - Wasteland humor (questionable quality)");
      overseerSay(">  fortune   - Consult the oracle");
      overseerSay("");
    }, 4000);
    delay(() => {
      overseerSay("> Type HELP anytime for the full command list.");
      overseerSay("> The wasteland doesn't wait, smoothskin. Get moving.");
    }, 5200);
  },

  zones() {
    overseerSay("EXPERIMENTAL ZONES:");
    overseerSay(" - WORMHOLE BRIDGE (LOCKED)");
    overseerSay(" - NUKE TESTING GROUNDS (LOCKED)");
    overseerSay(" - SECTOR 7 (CLASSIFIED)");
    overseerSay("");
    overseerSay("TYPE 'bridge' OR 'nuke' FOR DETAILS.");
  },

  bridge() {
    overseerSay("> ACCESSING WORMHOLE BRIDGE SUBSYSTEM...");
    overseerSay("> STATUS: SEALED");
    overseerSay("> CLEARANCE LEVEL OMEGA REQUIRED");
    overseerSay("> TYPE 'bridge.unlock' TO REQUEST AUTHORIZATION.");
  },

  "bridge.unlock"() {
    overseerSay("> REQUESTING AUTHORIZATION...");
    setTimeout(() => {
      overseerSay("> AUTHORIZATION GRANTED.");
      overseerSay("> OPENING WORMHOLE BRIDGE INTERFACE...");
      setTimeout(() => {
        window.open("/bridge-portal", "_blank");
      }, 800);
    }, 1200);
  },

  nuke() {
    overseerSay("> ACCESSING NUCLEAR TESTING GROUNDS...");
    overseerSay("> STATUS: LOCKED");
    overseerSay("> RADIATION LEVELS: CRITICAL");
    overseerSay("> TYPE 'nuke.unlock' TO OVERRIDE SAFETY LOCKS.");
  },

  "nuke.unlock"() {
    overseerSay("> WARNING: OVERRIDING SAFETY LOCKS...");
    setTimeout(() => {
      overseerSay("> LOCKS DISENGAGED.");
      overseerSay("> OPENING TESTING GROUNDS INTERFACE...");
      setTimeout(() => {
        window.open("/nuke-portal", "_blank");
      }, 800);
    }, 1500);
  },

  redmenace() {
    if (window.redMenace) {
      overseerSay("> LOADING RED MENACE ARCADE SYSTEM...");
      overseerSay("> COPYRIGHT 2077 VAULT-TEC ENTERTAINMENT DIVISION");
      overseerSay("> CONTROLS: USE BUTTONS BELOW");
      overseerSay("> OBJECTIVE: DESTROY ALL COMMUNIST INVADERS!");
      setTimeout(() => {
        window.redMenace.start();
      }, 500);
    } else {
      overseerSay("> ERROR: RED MENACE MODULE NOT FOUND");
      overseerSay("> PLEASE CONTACT YOUR VAULT OVERSEER");
    }
  },

  "redmenace.stop"() {
    if (window.redMenace && window.redMenace.active) {
      window.redMenace.stop();
      overseerSay("> RED MENACE TERMINATED");
      overseerSay("> THANK YOU FOR SERVING THE VAULT");
    } else {
      overseerSay("> RED MENACE IS NOT CURRENTLY RUNNING");
    }
  },

  rm(args) {
    // Shortcut for redmenace - pass args through
    if (args && args[0]) {
      return window.overseerHandlers.redmenace(args);
    }
    return window.overseerHandlers.redmenace();
  },

  ttt(args) {
    if (!window.ticTacToe) {
      overseerSay("> ERROR: TIC-TAC-TOE MODULE NOT FOUND");
      return;
    }

    const arg = args && args[0] ? args[0].toLowerCase() : "";

    if (!arg || arg === "start") {
      window.ticTacToe.start();
    } else if (arg === "quit" || arg === "stop") {
      window.ticTacToe.quit();
    } else if (arg === "stats") {
      window.ticTacToe.stats();
    } else {
      // Assume it's a move (1-9)
      window.ticTacToe.move(arg);
    }
  },

  jokes() {
    const jokes = [
      "Why did the vault dweller cross the road? To get to the OTHER WASTELAND!",
      "How many raiders does it take to change a lightbulb? None. They prefer the dark.",
      "What's a super mutant's favorite game? SMASH BROTHERS.",
      "Why don't ghouls ever get lonely? They're always in DE-COMPOSING company!",
      "What do you call a deathclaw with no teeth? A GUMMY BEAR... still terrifying.",
      "Why was the Pip-Boy so popular? It had ALL the apps... before the apocalypse.",
      "What's a robot's favorite type of music? HEAVY METAL... literally.",
      "How do you know if a synth is lying? Their PROGRAMMING SHOWS.",
      "Why don't mirelurks share food? They're too SHELLFISH!",
      "What's Overseer's favorite dance? The ROBOT... obviously."
    ];
    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    overseerSay("> RETRIEVING JOKE FROM DATABASE...");
    setTimeout(() => overseerSay(joke), 800);
  },

  fortune() {
    const fortunes = [
      "I SEE... BOTTLE CAPS IN YOUR FUTURE. MANY BOTTLE CAPS.",
      "BEWARE THE DEATHCLAW. IT LURKS WHERE YOU LEAST EXPECT.",
      "A STRANGE ENCOUNTER AWAITS YOU IN THE WASTELAND.",
      "YOUR LUCK STAT IS HIGH TODAY. TAKE RISKS.",
      "THE RADIATION WILL SPARE YOU... FOR NOW.",
      "I SENSE A LEGENDARY WEAPON IN YOUR NEAR FUTURE.",
      "TRUST NO ONE. NOT EVEN YOURSELF. ESPECIALLY SYNTHS.",
      "YOUR NEXT QUEST WILL BRING GREAT REWARD... OR GREAT DANGER.",
      "THE STARS ALIGN. YOUR CRITICAL HIT CHANCE INCREASES.",
      "I FORESEE... A VERY LARGE EXPLOSION. DUCK."
    ];
    const fortune = fortunes[Math.floor(Math.random() * fortunes.length)];
    overseerSay("> CONSULTING THE WASTELAND ORACLE...");
    overseerSay("> INTERPRETING RADSTORM PATTERNS...");
    setTimeout(() => {
      overseerSay("> YOUR FORTUNE:");
      overseerSay(fortune);
    }, 1500);
  },

  trivia() {
    const questions = [
      {
        q: "What year did the Great War begin?",
        a: "2077",
        hint: "It's in the game title..."
      },
      {
        q: "What beverage is Atomic Fizz Caps named after?",
        a: "Nuka-Cola",
        hint: "It's bubbly, radioactive, and delicious"
      },
      {
        q: "What vault were you from?",
        a: "Vault 77",
        hint: "Check this terminal's header"
      },
      {
        q: "What company made the Pip-Boy?",
        a: "RobCo Industries",
        hint: "They also made Protectrons"
      },
      {
        q: "What is the main currency in the wasteland?",
        a: "Bottle Caps",
        hint: "You're collecting them right now"
      }
    ];
    
    const question = questions[Math.floor(Math.random() * questions.length)];
    overseerSay("> FALLOUT LORE TRIVIA:");
    overseerSay("> " + question.q);
    overseerSay("> TYPE YOUR ANSWER OR 'hint' FOR A CLUE");
    
    // Store for answer checking (simple implementation)
    if (!window.overseerTrivia) window.overseerTrivia = {};
    window.overseerTrivia.current = question;
  },

  hint() {
    if (window.overseerTrivia && window.overseerTrivia.current) {
      overseerSay("> HINT: " + window.overseerTrivia.current.hint);
    } else {
      overseerSay("> NO ACTIVE TRIVIA QUESTION. TYPE 'trivia' TO START.");
    }
  },

  answer(args) {
    if (!window.overseerTrivia || !window.overseerTrivia.current) {
      overseerSay("> NO ACTIVE TRIVIA QUESTION. TYPE 'trivia' TO START.");
      return;
    }

    const text = args ? args.join(" ") : "";
    const correct = window.overseerTrivia.current.a.toLowerCase();
    const guess = text.toLowerCase().trim();

    if (guess.includes(correct) || correct.includes(guess)) {
      overseerSay("> CORRECT! YOU KNOW YOUR FALLOUT LORE.");
      overseerSay("> THE ANSWER WAS: " + window.overseerTrivia.current.a);
      window.overseerTrivia.current = null;
    } else {
      overseerSay("> INCORRECT. TRY AGAIN OR TYPE 'hint' FOR A CLUE.");
    }
  },

  games() {
    overseerSay("> AVAILABLE MINI-GAMES:");
    overseerSay("> - RED MENACE: Classic arcade shooter (type 'redmenace' or 'rm')");
    overseerSay("> - TIC-TAC-TOE: Battle the Overseer AI (type 'ttt start')");
    overseerSay("> ");
    overseerSay("> OTHER ENTERTAINMENT:");
    overseerSay("> - jokes: Wasteland humor");
    overseerSay("> - fortune: Consult the oracle");
    overseerSay("> - trivia: Test your Fallout knowledge");
  },

  ascii() {
    overseerSay("    ___   ");
    overseerSay("   /   \\  ");
    overseerSay("  | O O | ");
    overseerSay("  |  ^  | ");
    overseerSay("  | \\_/ | ");
    overseerSay("   \\___/  ");
    overseerSay("");
    overseerSay(" VAULT-BOY APPROVES!");
  }
};
