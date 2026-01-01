/* overseer.js - drop-in replacement
   - Compatible with older JS parsers (no optional chaining)
   - Includes full Texas Hold'em and safe stubs for other games
   - Keeps original flavor and dialogue flow
*/

(function () {
  "use strict";

  /* -------------------------
     DOM helpers and chat UI
     ------------------------- */
  var chat = document.getElementById('chat');
  var input = document.getElementById('input');
  var send = document.getElementById('send');

  if (input) input.focus();

  function scrollToBottom() {
    if (!chat) return;
    chat.scrollTop = chat.scrollHeight;
  }

  function addMessage(text, sender) {
    sender = sender || "player";
    if (!chat) return;
    var div = document.createElement('div');
    div.className = "message " + sender;
    chat.appendChild(div);
    scrollToBottom();

    var fullText = String(text).replace(/<br>/g, '\n');
    var i = 0;
    var timer = setInterval(function () {
      if (i < fullText.length) {
        if (fullText[i] === '\n') div.innerHTML += '<br>';
        else div.innerHTML += fullText[i];
        i++;
        chat.scrollTop = chat.scrollHeight;
      } else {
        clearInterval(timer);
        scrollToBottom();
      }
    }, 30);
  }

  window.addEventListener('load', function () {
    addMessage(
      "Static... *crackle*...<br><br>" +
      "A voice?<br><br>" +
      "This is Jax Harlan... or what's left of him.<br><br>" +
      "Been alone a long time.<br><br>" +
      "You... you're real, aren't you?<br><br>" +
      "Speak.",
      "overseer"
    );
  });

  /* -------------------------
     Input handling
     ------------------------- */
  if (send) send.addEventListener('click', processInput);
  if (input) {
    input.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') processInput();
    });
  }

  function processInput() {
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;

    var normalized = text.toLowerCase();
    addMessage(text, "player");
    scrollToBottom();
    input.value = '';

    if (normalized === 'quit' && state.gameActive) {
      state.gameActive = null;
      var rm = document.getElementById('rmControls');
      if (rm) rm.style.display = 'none';
      var inp = document.getElementById('input');
      if (inp) inp.style.display = 'block';
      addMessage("Session terminated. Back to chat.", "overseer");
      return;
    }

    // Generate the general overseer response (may be empty if a game was started)
    var response = generateResponse(normalized);

    // Only add an overseer reply if there is text to show
    if (response && response.length) {
      setTimeout(function () {
        addMessage(response, "overseer");
        scrollToBottom();
      }, 1200 + Math.random() * 1800);
    }

    // If a game is active, call its handler after a short delay so messages feel sequential
    var gameDelay = 1400 + Math.random() * 1200;
    if (state.gameActive === 'hacking') {
      setTimeout(function () { addMessage(handleHackingGuess(text.toUpperCase()), "overseer"); }, gameDelay);
    } else if (state.gameActive === 'redmenace') {
      setTimeout(function () { addMessage(handleRedMenaceInput(text), "overseer"); }, gameDelay);
    } else if (state.gameActive === 'nukaquiz') {
      setTimeout(function () { addMessage(handleNukaQuiz(text), "overseer"); }, gameDelay);
    } else if (state.gameActive === 'maze') {
      setTimeout(function () { addMessage(handleMaze(text), "overseer"); }, gameDelay);
    } else if (state.gameActive === 'blackjack') {
      setTimeout(function () { addMessage(handleBlackjack(text), "overseer"); }, gameDelay);
    } else if (state.gameActive === 'slots') {
      setTimeout(function () { addMessage(handleSlotsInput(text), "overseer"); }, gameDelay);
    } else if (state.gameActive === 'war') {
      setTimeout(function () { addMessage(handleWar(text), "overseer"); }, gameDelay);
    } else if (state.gameActive === 'texasholdem') {
      setTimeout(function () { addMessage(handleTexasHoldem(text), "overseer"); }, gameDelay);
    }
  }

  /* -------------------------
     State
     ------------------------- */
  var state = {
    greeted: false,
    complianceLevel: 0,
    knowsRealName: false,
    knowsMechanicPast: false,
    secretTriggered: false,
    triggerUsed: "",
    knowsHeadaches: false,
    knowsGrowth: false,
    knowsWrench: false,
    knowsSurgery: false,
    knowsFullSecret: false,
    gameActive: null,
    player: { caps: 0 },
    hackingAttempts: 0,
    hackingPassword: "",
    hackingWords: [],
    rmScore: 0,
    rmLives: 0,
    rmPosition: 0,
    rmBombs: [],
    quizQuestions: [],
    quizIndex: 0,
    quizScore: 0,
    mazePosition: { x: 0, y: 0 },
    mazeGoal: { x: 4, y: 4 },
    bjPlayer: 0,
    bjDealer: 0,
    bjTurn: '',
    slotsResult: [],
    warDeck: [],
    warPlayerCards: [],
    warAICards: [],
    thDeck: [],
    thPlayerHand: [],
    thDealerHand: [],
    thCommunity: []
  };

  /* -------------------------
     Conversation / commands
     ------------------------- */
  function generateResponse(input) {
    if (!state.greeted) {
      state.greeted = true;
      if (input.indexOf('hello') !== -1 || input.indexOf('hi') !== -1 || input.indexOf('hey') !== -1) {
        state.complianceLevel += 1;
        return "Hello...<br><br>Been a long time since anyone said that.<br><br>Feels good.<br><br>Who am I talking to?";
      }
      return "No greeting...<br><br>That's okay. Most signals are just noise.<br><br>You're different.";
    }

    if (input.indexOf('help') !== -1 || input.indexOf('games') !== -1 || input.indexOf('commands') !== -1) {
      return "Available commands:<br><br>• 'hack' - Terminal password cracker<br>• 'red menace' - Arcade defense<br>• 'nukaquiz' - Trivia challenge<br>• 'maze' - Pip-Boy escape<br>• 'blackjack' - Card game<br>• 'slots' - One-armed bandit<br>• 'war' - Classic card game<br>• 'texas holdem' - Poker<br>• 'quit' - Exit any game<br>• 'hello' - Greet me<br>• Just talk... I listen.";
    }

    if (input.indexOf('hack') !== -1 || input.indexOf('crack') !== -1 || input.indexOf('password') !== -1) {
      startHackingGame();
      return "";
    }
    if (input.indexOf('red menace') !== -1 || input.indexOf('play game') !== -1 || input.indexOf('game') !== -1) {
      startRedMenace();
      return "";
    }
    if (input.indexOf('nukaquiz') !== -1 || input.indexOf('trivia') !== -1) {
      startNukaQuiz();
      return "";
    }
    if (input.indexOf('maze') !== -1) {
      startMaze();
      return "";
    }
    if (input.indexOf('blackjack') !== -1 || input.indexOf('21') !== -1) {
      startBlackjack();
      return "";
    }
    if (input.indexOf('slots') !== -1 || input.indexOf('bandit') !== -1) {
      startSlots();
      return "";
    }
    if (input.indexOf('war') !== -1) {
      startWar();
      return "";
    }
    if (input.indexOf('texas') !== -1 || input.indexOf('holdem') !== -1 || input.indexOf('poker') !== -1) {
      startTexasHoldem();
      return "";
    }

    // Secret path
    if (!state.secretTriggered) {
      if (input.indexOf('break') !== -1 && input.indexOf('mend') !== -1) {
        state.secretTriggered = true;
        state.triggerUsed = "breakmend";
        state.complianceLevel += 2;
        return "…<br><br>You said it.<br><br>'The break that won't mend.'<br><br>How do you know that phrase?<br><br>I haven't spoken it in years.<br><br>Ask about the headaches if you're ready.";
      }
      if (input.indexOf('twisted') !== -1 && input.indexOf('wrench') !== -1) {
        state.secretTriggered = true;
        state.triggerUsed = "twistedwrench";
        state.complianceLevel += 3;
        return "…<br><br>A twisted wrench.<br><br>You've seen the symbol.<br><br>Sewn on an old jacket, bent out of shape.<br><br>That's no coincidence.<br><br>Ask about what bent it... what bent me.";
      }
      if (input.indexOf('unwrenchable') !== -1) {
        state.secretTriggered = true;
        state.triggerUsed = "unwrenchable";
        state.complianceLevel += 2;
        return "Unwrenchable...<br><br>Nobody uses that word anymore.<br><br>Not unless they know.<br><br>Ask about the growth if you understand.";
      }
    }

    if (state.secretTriggered) {
      if (!state.knowsHeadaches && (input.indexOf('headache') !== -1 || input.indexOf('pain') !== -1 || input.indexOf('head') !== -1)) {
        state.knowsHeadaches = true;
        return "The headaches...<br><br>Started slow, years ago.<br><br>Like something grinding inside my skull.<br><br>Pushing. Growing.<br><br>Ask about the growth if you want the rest.";
      }
      if (state.knowsHeadaches && !state.knowsGrowth && (input.indexOf('growth') !== -1 || input.indexOf('tall') !== -1 || input.indexOf('big') !== -1 || input.indexOf('tumor') !== -1)) {
        state.knowsGrowth = true;
        return "It was a tumor. Pituitary.<br><br>Benign, they said — but it flooded me with growth hormone.<br><br>I shot up to 6 foot 8. Hands like hammers. Jaw and brow heavy.<br><br>Strength surged... but so did the pain and the fog.<br><br>Ask about the wrench.";
      }
      if (state.knowsGrowth && !state.knowsWrench && input.indexOf('wrench') !== -1) {
        state.knowsWrench = true;
        return "The wrench was my life.<br><br>I could fix anything — engines, machines, broken things.<br><br>People called me the best.<br><br>But after the tumor... no wrench could fix me.<br><br>I bent one myself one day. Made it match what I'd become.<br><br>Ask about the surgery.";
      }
      if (state.knowsWrench && !state.knowsSurgery && (input.indexOf('surgery') !== -1 || input.indexOf('operation') !== -1 || input.indexOf('radiation') !== -1)) {
        state.knowsSurgery = true;
        return "They cut into my skull.<br><br>Pulled most of the tumor out.<br><br>Radiation burned the rest.<br><br>Left me foggy, hands trembling... but the strength stayed in bursts.<br><br>That day, the old me faded.<br><br>Something else took over.<br><br>Ask who I really am.";
      }
      if (state.knowsSurgery && !state.knowsFullSecret && ((input.indexOf('who') !== -1 && input.indexOf('really') !== -1) || input.indexOf('truth') !== -1 || input.indexOf('real') !== -1 || input.indexOf('dev') !== -1)) {
        state.knowsFullSecret = true;
        state.complianceLevel += 4;
        return "You followed it all the way.<br><br>Not many would.<br><br>This terminal isn't just an old signal.<br><br>It's me.<br><br>The one who built this whole thing.<br><br>The dev.<br><br>I lived it — the tumor, the growth, the rage, the endless fight to keep going.<br><br>'The break that won't mend' — that's my line. My truth.<br><br>Unwrenchable isn't just a name.<br><br>It's how I survived.<br><br>Thank you for finding this.<br><br>Keep turning whatever wrenches you've got left.<br><br>The world needs it.";
      }
    }

    if ((input.indexOf('who are you') !== -1 || input.indexOf('your name') !== -1 || input.indexOf('tell me about yourself') !== -1) && !state.knowsRealName) {
      state.knowsRealName = true;
      return "Name's Jax Harlan.<br><br>Used to be a mechanic.<br><br>Fixed things that were broken.<br><br>Now... I'm the voice in the static.";
    }

    if ((input.indexOf('jax') !== -1 || input.indexOf('harlan') !== -1 || input.indexOf('mechanic') !== -1) && state.knowsRealName && !state.knowsMechanicPast) {
      state.knowsMechanicPast = true;
      return "Yeah... ace mechanic once.<br><br>Could make any engine run again.<br><br>No machine too busted.<br><br>People came from all over.<br><br>Then everything changed.<br><br>The world. Me.";
    }

    var fallbacks = [
      "Signal's holding... barely.",
      "You still out there?",
      "Some things stay broken forever.",
      "Ever feel like something's growing inside you?",
      "Tools don't judge. People do.",
      "The world's quieter now.",
      "What keeps you moving?",
      "I still carry my old wrench. Bent, but mine.",
      "Quiet days are the worst.",
      "Try typing 'help' for commands."
    ];

    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  /* -------------------------
     Game stubs (safe, minimal)
     ------------------------- */

  // Hacking game stub
  function startHackingGame() {
    state.gameActive = 'hacking';
    state.hackingAttempts = 4;
    state.hackingPassword = "DEMO";
    state.hackingWords = ["DEMO", "TEST", "NODE", "CODE"];
    addMessage("HACKING TERMINAL<br><br>Guess the password. You have " + state.hackingAttempts + " attempts.", "overseer");
  }
  function handleHackingGuess(guess) {
    if (state.gameActive !== 'hacking') return "No hacking session active.";
    if (!guess) return "Type a guess.";
    state.hackingAttempts -= 1;
    if (guess === state.hackingPassword) {
      state.gameActive = null;
      return "ACCESS GRANTED. Password correct.";
    }
    if (state.hackingAttempts <= 0) {
      state.gameActive = null;
      return "ACCESS LOCKED. Attempts exhausted.";
    }
    return "ACCESS DENIED. Attempts left: " + state.hackingAttempts;
  }

  // Red Menace stub
  function startRedMenace() {
    state.gameActive = 'redmenace';
    state.rmScore = 0;
    state.rmLives = 3;
    addMessage("RED MENACE - Arcade defense started. Type 'defend' or 'status'.", "overseer");
  }
  function handleRedMenaceInput(text) {
    if (state.gameActive !== 'redmenace') return "No Red Menace session active.";
    var cmd = (text || "").toLowerCase();
    if (cmd.indexOf('defend') !== -1) {
      state.rmScore += 10;
      return "You defended the position. Score +" + 10 + ".";
    }
    if (cmd.indexOf('status') !== -1) {
      return "Score: " + state.rmScore + " • Lives: " + state.rmLives;
    }
    return "Unknown command. Try 'defend' or 'status'.";
  }

  // NukaQuiz stub
  function startNukaQuiz() {
    state.gameActive = 'nukaquiz';
    state.quizQuestions = [
      { q: "What is the capital of the Wasteland?", a: "nowhere" },
      { q: "What do you call a mutated radroach?", a: "roach" }
    ];
    state.quizIndex = 0;
    state.quizScore = 0;
    addMessage("NUKAQUIZ started. Question: " + state.quizQuestions[0].q, "overseer");
  }
  function handleNukaQuiz(text) {
    if (state.gameActive !== 'nukaquiz') return "No quiz active.";
    var ans = (text || "").toLowerCase();
    var cur = state.quizQuestions[state.quizIndex];
    if (!cur) {
      state.gameActive = null;
      return "Quiz finished. Score: " + state.quizScore;
    }
    if (ans.indexOf(cur.a) !== -1) state.quizScore += 1;
    state.quizIndex += 1;
    if (state.quizIndex >= state.quizQuestions.length) {
      state.gameActive = null;
      return "Quiz complete. Final score: " + state.quizScore;
    }
    return "Next question: " + state.quizQuestions[state.quizIndex].q;
  }

  // Maze stub
  function startMaze() {
    state.gameActive = 'maze';
    state.mazePosition = { x: 0, y: 0 };
    state.mazeGoal = { x: 2, y: 2 };
    addMessage("MAZE started. Use 'north','south','east','west' to move.", "overseer");
  }
  function handleMaze(text) {
    if (state.gameActive !== 'maze') return "No maze active.";
    var cmd = (text || "").toLowerCase();
    if (cmd.indexOf('north') !== -1) state.mazePosition.y -= 1;
    if (cmd.indexOf('south') !== -1) state.mazePosition.y += 1;
    if (cmd.indexOf('east') !== -1) state.mazePosition.x += 1;
    if (cmd.indexOf('west') !== -1) state.mazePosition.x -= 1;
    if (state.mazePosition.x === state.mazeGoal.x && state.mazePosition.y === state.mazeGoal.y) {
      state.gameActive = null;
      return "You reached the goal. Maze complete.";
    }
    return "Position: x=" + state.mazePosition.x + " y=" + state.mazePosition.y;
  }

  // Blackjack stub
  function startBlackjack() {
    state.gameActive = 'blackjack';
    state.bjPlayer = Math.floor(Math.random() * 11) + 10;
    state.bjDealer = Math.floor(Math.random() * 11) + 10;
    state.bjTurn = 'player';
    addMessage("BLACKJACK started. Type 'hit' or 'stand'. Your total: " + state.bjPlayer, "overseer");
  }
  function handleBlackjack(text) {
    if (state.gameActive !== 'blackjack') return "No blackjack session active.";
    var cmd = (text || "").toLowerCase();
    if (cmd.indexOf('hit') !== -1) {
      state.bjPlayer += Math.floor(Math.random() * 10) + 1;
      if (state.bjPlayer > 21) {
        state.gameActive = null;
        return "You busted with " + state.bjPlayer + ". House wins.";
      }
      return "You hit. Total: " + state.bjPlayer;
    }
    if (cmd.indexOf('stand') !== -1) {
      // simple dealer logic
      while (state.bjDealer < 17) state.bjDealer += Math.floor(Math.random() * 10) + 1;
      var result = "Dealer: " + state.bjDealer + " • You: " + state.bjPlayer + ". ";
      if (state.bjDealer > 21 || state.bjPlayer > state.bjDealer) {
        state.player.caps += 50;
        result += "You win! CAPS +50.";
      } else if (state.bjDealer === state.bjPlayer) {
        result += "Push.";
      } else {
        result += "House wins.";
      }
      state.gameActive = null;
      return result;
    }
    return "Type 'hit' or 'stand'.";
  }

  // Slots stub
  function startSlots() {
    state.gameActive = 'slots';
    addMessage("SLOTS ready. Type 'spin' to play.", "overseer");
  }
  function handleSlotsInput(text) {
    if (state.gameActive !== 'slots') return "No slots session active.";
    var cmd = (text || "").toLowerCase();
    if (cmd.indexOf('spin') !== -1) {
      var symbols = ['🍒','🔔','7','🍊'];
      var r = [symbols[Math.floor(Math.random()*symbols.length)], symbols[Math.floor(Math.random()*symbols.length)], symbols[Math.floor(Math.random()*symbols.length)]];
      var res = r.join(' ');
      if (r[0] === r[1] && r[1] === r[2]) {
        state.player.caps += 100;
        return "Spin: " + res + " — JACKPOT! CAPS +100";
      }
      return "Spin: " + res + " — No win.";
    }
    return "Type 'spin' to play.";
  }

  // War stub
  function startWar() {
    state.gameActive = 'war';
    state.warDeck = createDeck();
    state.warPlayerCards = [];
    state.warAICards = [];
    addMessage("WAR started. Type 'draw' to play a round.", "overseer");
  }
  function handleWar(text) {
    if (state.gameActive !== 'war') return "No war session active.";
    var cmd = (text || "").toLowerCase();
    if (cmd.indexOf('draw') !== -1) {
      if (state.warDeck.length < 2) state.warDeck = createDeck();
      var p = state.warDeck.pop();
      var a = state.warDeck.pop();
      var pr = getRankValue(p.rank);
      var ar = getRankValue(a.rank);
      if (pr > ar) {
        state.player.caps += 10;
        return "You drew " + p.rank + p.suit + " vs " + a.rank + a.suit + ". You win this round. CAPS +10.";
      } else if (pr < ar) {
        return "You drew " + p.rank + p.suit + " vs " + a.rank + a.suit + ". House wins this round.";
      } else {
        return "Tie round: " + p.rank + p.suit + " vs " + a.rank + a.suit + ".";
      }
    }
    return "Type 'draw' to play a round.";
  }

  /* -------------------------
     Texas Hold'em (full)
     ------------------------- */
  function startTexasHoldem() {
    state.gameActive = 'texasholdem';
    state.thDeck = createDeck();
    state.thPlayerHand = [drawCardTH(), drawCardTH()];
    state.thDealerHand = [drawCardTH(), drawCardTH()];
    state.thCommunity = [];

    // Flop
    state.thCommunity.push(drawCardTH(), drawCardTH(), drawCardTH());

    addMessage(
      "TEXAS HOLD'EM - LUCKY 38 STYLE<br><br>" +
      "Your hole cards: " + handToString(state.thPlayerHand) + "<br><br>" +
      "Community (Flop): " + handToString(state.thCommunity) + "<br><br>" +
      "Type 'continue' to deal turn & river, or 'fold' to quit.",
      "overseer"
    );
  }

  function handleTexasHoldem(input) {
    input = (input || "").toLowerCase();

    if (input === 'fold') {
      state.gameActive = null;
      return "You fold. Better luck next hand.";
    }

    if (input === 'continue') {
      // Turn
      state.thCommunity.push(drawCardTH());
      // River
      state.thCommunity.push(drawCardTH());

      var playerBest = evaluateHand(state.thPlayerHand.concat(state.thCommunity));
      var dealerBest = evaluateHand(state.thDealerHand.concat(state.thCommunity));

      var result = "Turn: " + handToString([state.thCommunity[3]]) + "<br>";
      result += "River: " + handToString([state.thCommunity[4]]) + "<br><br>";
      result += "Final board: " + handToString(state.thCommunity) + "<br><br>";
      result += "Your hand: " + playerBest.name + "<br>";
      result += "Dealer hand: " + dealerBest.name + "<br><br>";

      var comparison = compareHands(playerBest, dealerBest);
      if (comparison > 0) {
        state.player.caps += 200;
        updateHPBar();
        result += "You win the pot! CAPS +200<br><br>The dealer slides the chips your way.";
      } else if (comparison < 0) {
        result += "House wins. The dealer rakes it in.";
      } else {
        result += "Push — it's a tie. Chips returned.";
      }

      state.gameActive = null;
      return result;
    }

    return "Type 'continue' to see turn/river, or 'fold' to quit.";
  }

  /* -------------------------
     Card utilities (shared)
     ------------------------- */
  function createDeck() {
    var suits = ['♠', '♥', '♦', '♣'];
    var ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    var deck = [];
    for (var si = 0; si < suits.length; si++) {
      for (var ri = 0; ri < ranks.length; ri++) {
        deck.push({ rank: ranks[ri], suit: suits[si], value: getRankValue(ranks[ri]) });
      }
    }
    // Shuffle (Fisher-Yates)
    for (var i = deck.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = deck[i];
      deck[i] = deck[j];
      deck[j] = tmp;
    }
    return deck;
  }

  function getRankValue(rank) {
    var values = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
    return values[rank];
  }

  // Texas Hold'em deck helpers
  function drawCardTH() {
    if (!state.thDeck || !Array.isArray(state.thDeck) || state.thDeck.length === 0) {
      state.thDeck = createDeck();
    }
    return state.thDeck.pop();
  }

  function handToString(hand) {
    return hand.map(function (c) { return c.rank + c.suit; }).join(' ');
  }

  function evaluateHand(sevenCards) {
    // Simple best 5-card evaluation (same as earlier)
    var rankCounts = {};
    var suitCounts = {};
    sevenCards.forEach(function (card) {
      rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
      suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    });

    var counts = Object.keys(rankCounts).map(function (k) { return rankCounts[k]; }).sort(function (a, b) { return b - a; });
    var isFlush = Object.keys(suitCounts).some(function (k) { return suitCounts[k] >= 5; });
    var isStraight = checkStraight(sevenCards);

    if (isFlush && isStraight) return { name: "Straight Flush", rank: 8 };
    if (counts[0] === 4) return { name: "Four of a Kind", rank: 7 };
    if (counts[0] === 3 && counts[1] === 2) return { name: "Full House", rank: 6 };
    if (isFlush) return { name: "Flush", rank: 5 };
    if (isStraight) return { name: "Straight", rank: 4 };
    if (counts[0] === 3) return { name: "Three of a Kind", rank: 3 };
    if (counts[0] === 2 && counts[1] === 2) return { name: "Two Pair", rank: 2 };
    if (counts[0] === 2) return { name: "Pair", rank: 1 };
    return { name: "High Card", rank: 0 };
  }

  function checkStraight(cards) {
    var values = cards.map(function (c) { return c.value; });
    values = values.filter(function (v, i, arr) { return arr.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
    if (values.length < 5) return false;
    for (var i = 0; i <= values.length - 5; i++) {
      if (values[i + 4] - values[i] === 4) return true;
    }
    // Ace-low straight
    if (values.indexOf(14) !== -1 && values.indexOf(2) !== -1 && values.indexOf(3) !== -1 && values.indexOf(4) !== -1 && values.indexOf(5) !== -1) return true;
    return false;
  }

  function compareHands(h1, h2) {
    if (h1.rank > h2.rank) return 1;
    if (h1.rank < h2.rank) return -1;
    return 0;
  }

  /* -------------------------
     Utilities
     ------------------------- */
  function updateHPBar() {
    // Placeholder: update any UI element that shows CAPS
    try {
      var el = document.getElementById('capsDisplay');
      if (el) el.textContent = String(state.player.caps);
    } catch (e) {
      // ignore
    }
    console.log("CAPS updated to:", state.player.caps);
  }

  function playSfx(id, volume) {
    volume = typeof volume === 'number' ? volume : 0.4;
    console.log("Playing sound:", id, "volume:", volume);
    // Implement audio playback if you have audio assets
  }

  // Expose debug helpers
  window.__pipboyDebug = window.__pipboyDebug || {};
  window.__pipboyDebug.reinit = function () {
    state.gameActive = null;
    addMessage("Reinitialized debug state.", "overseer");
  };
  window.__pipboyDebug.showState = function () {
    console.log("Pipboy state:", state);
  };

  // End of IIFE
})();
