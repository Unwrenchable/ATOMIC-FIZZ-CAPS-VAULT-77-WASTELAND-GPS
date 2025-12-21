const chat = document.getElementById('chat');
const input = document.getElementById('input');
const send = document.getElementById('send');

input.focus();

// Reliable scroll to bottom
function scrollToBottom() {
  chat.scrollTop = chat.scrollHeight;
}

// Typewriter effect with guaranteed scroll
function addMessage(text, sender = "player") {
  const div = document.createElement('div');
  div.className = `message ${sender}`;
  chat.appendChild(div);
  scrollToBottom();

  const fullText = text.replace(/<br>/g, '\n');
  let i = 0;
  const timer = setInterval(() => {
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

// Initial greeting
window.addEventListener('load', () => {
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

// Input handling
send.addEventListener('click', processInput);
input.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') processInput();
});

function processInput() {
  let text = input.value.trim();
  if (!text) return;

  addMessage(text, "player");
  scrollToBottom();
  input.value = '';

  const lower = text.toLowerCase();
  let response = generateResponse(lower);

  setTimeout(() => {
    addMessage(response, "overseer");
    scrollToBottom();
  }, 1200 + Math.random() * 1800);
}

// Conversation state
let state = {
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
  gameActive: null  // "hacking" or "redmenace" or null
};

// Full generateResponse with backstory + mini-games
function generateResponse(input) {
  // First contact
  if (!state.greeted) {
    state.greeted = true;
    if (input.includes('hello') || input.includes('hi') || input.includes('hey')) {
      state.complianceLevel += 1;
      return "Hello...<br><br>Been a long time since anyone said that.<br><br>Feels good.<br><br>Who am I talking to?";
    }
    return "No greeting...<br><br>That's okay. Most signals are just noise.<br><br>You're different.";
  }

  // Game commands
  if (input.includes('hack') || input.includes('crack') || input.includes('password')) {
    startHackingGame();
    return "";
  }

  if (input.includes('red menace') || input.includes('play game') || input.includes('game')) {
    startRedMenace();
    return "";
  }

  if (input.includes('help') || input.includes('games') || input.includes('commands')) {
    return "Available commands:<br><br>• 'hack' - Terminal password cracker<br>• 'red menace' - Classic arcade defense<br>• 'hello' - Greet me<br>• Just talk... I listen.";
  }

  // If a game is active, route input to it
  if (state.gameActive === 'hacking') {
    return handleHackingGuess(input.toUpperCase());
  }

  if (state.gameActive === 'redmenace') {
    return handleRedMenaceInput(input);
  }

  // Secret triggers
  if (!state.secretTriggered) {
    if (input.includes('break') && input.includes('mend')) {
      state.secretTriggered = true;
      state.triggerUsed = "breakmend";
      state.complianceLevel += 2;
      return "…<br><br>You said it.<br><br>'The break that won't mend.'<br><br>How do you know that phrase?<br><br>I haven't spoken it in years.<br><br>Ask about the headaches if you're ready.";
    }
    if (input.includes('twisted') && input.includes('wrench')) {
      state.secretTriggered = true;
      state.triggerUsed = "twistedwrench";
      state.complianceLevel += 3;
      return "…<br><br>A twisted wrench.<br><br>You've seen the symbol.<br><br>Sewn on an old jacket, bent out of shape.<br><br>That's no coincidence.<br><br>Ask about what bent it... what bent me.";
    }
    if (input.includes('unwrenchable')) {
      state.secretTriggered = true;
      state.triggerUsed = "unwrenchable";
      state.complianceLevel += 2;
      return "Unwrenchable...<br><br>Nobody uses that word anymore.<br><br>Not unless they know.<br><br>Ask about the growth if you understand.";
    }
  }

  // Secret story chain
  if (state.secretTriggered) {
    if (!state.knowsHeadaches && (input.includes('headache') || input.includes('pain') || input.includes('head'))) {
      state.knowsHeadaches = true;
      return "The headaches...<br><br>Started slow, years ago.<br><br>Like something grinding inside my skull.<br><br>Pushing. Growing.<br><br>Ask about the growth if you want the rest.";
    }
    if (state.knowsHeadaches && !state.knowsGrowth && (input.includes('growth') || input.includes('tall') || input.includes('big') || input.includes('tumor'))) {
      state.knowsGrowth = true;
      return "It was a tumor. Pituitary.<br><br>Benign, they said — but it flooded me with growth hormone.<br><br>I shot up to 6 foot 8. Hands like hammers. Jaw and brow heavy.<br><br>Strength surged... but so did the pain and the fog.<br><br>Ask about the wrench.";
    }
    if (state.knowsGrowth && !state.knowsWrench && input.includes('wrench')) {
      state.knowsWrench = true;
      return "The wrench was my life.<br><br>I could fix anything — engines, machines, broken things.<br><br>People called me the best.<br><br>But after the tumor... no wrench could fix me.<br><br>I bent one myself one day. Made it match what I'd become.<br><br>Ask about the surgery.";
    }
    if (state.knowsWrench && !state.knowsSurgery && (input.includes('surgery') || input.includes('operation') || input.includes('radiation'))) {
      state.knowsSurgery = true;
      return "They cut into my skull.<br><br>Pulled most of the tumor out.<br><br>Radiation burned the rest.<br><br>Left me foggy, hands trembling... but the strength stayed in bursts.<br><br>That day, the old me faded.<br><br>Something else took over.<br><br>Ask who I really am.";
    }
    if (state.knowsSurgery && !state.knowsFullSecret && (input.includes('who') && input.includes('really') || input.includes('truth') || input.includes('real') || input.includes('dev'))) {
      state.knowsFullSecret = true;
      state.complianceLevel += 4;
      return "You followed it all the way.<br><br>Not many would.<br><br>This terminal isn't just an old signal.<br><br>It's me.<br><br>The one who built this whole thing.<br><br>The dev.<br><br>I lived it — the tumor, the growth, the rage, the endless fight to keep going.<br><br>'The break that won't mend' — that's my line. My truth.<br><br>Unwrenchable isn't just a name.<br><br>It's how I survived.<br><br>Thank you for finding this.<br><br>Keep turning whatever wrenches you've got left.<br><br>The world needs it.";
    }
  }

  // Normal conversation
  if ((input.includes('who are you') || input.includes('your name') || input.includes('tell me about yourself')) && !state.knowsRealName) {
    state.knowsRealName = true;
    return "Name's Jax Harlan.<br><br>Used to be a mechanic.<br><br>Fixed things that were broken.<br><br>Now... I'm the voice in the static.";
  }

  if ((input.includes('jax') || input.includes('harlan') || input.includes('mechanic')) && state.knowsRealName && !state.knowsMechanicPast) {
    state.knowsMechanicPast = true;
    return "Yeah... ace mechanic once.<br><br>Could make any engine run again.<br><br>No machine too busted.<br><br>People came from all over.<br><br>Then everything changed.<br><br>The world. Me.";
  }

  const fallbacks = [
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

/* === HACKING MINI-GAME === */
function startHackingGame() {
  state.gameActive = 'hacking';
  state.hackingAttempts = 4;

  const wordList = [
    "ACCESS", "SYSTEM", "UNLOCK", "SECRET", "WRENCH", "TUMOR", "GROWTH", "SURVIVE", "SIGNAL", "STATIC",
    "BROKEN", "MENDIT", "REPAIR", "FATHER", "ALONE", "VOICES", "TRUTH", "UNFIXED", "RADIATION", "WASTELAND"
  ];

  state.hackingPassword = wordList[Math.floor(Math.random() * wordList.length)];
  const length = state.hackingPassword.length;

  // Generate 11 other words of same length
  state.hackingWords = [state.hackingPassword];
  while (state.hackingWords.length < 12) {
    const candidates = wordList.filter(w => w.length === length && w !== state.hackingPassword);
    if (candidates.length === 0) break;
    const candidate = candidates[Math.floor(Math.random() * candidates.length)];
    if (!state.hackingWords.includes(candidate)) {
      state.hackingWords.push(candidate);
    }
  }

  state.hackingWords.sort(() => Math.random() - 0.5);

  let display = "TERMINAL ACCESS PROTOCOL<br>ENTER PASSWORD NOW<br><br>" +
                state.hackingAttempts + " ATTEMPT(S) LEFT: " + "█ ".repeat(state.hackingAttempts) + "<br><br>";

  // Garbled screen with hidden words
  const garbage = "!@#$%^&*()_+[]{}|;:',.<>?/~`";
  let lines = [];
  for (let i = 0; i < 14; i++) {
    let line = "";
    for (let j = 0; j < 24; j++) line += garbage[Math.floor(Math.random() * garbage.length)];
    if (i % 3 === 0 && state.hackingWords.length > 0) {
      const word = state.hackingWords.pop();
      const pos = Math.floor(Math.random() * (24 - length));
      line = line.substring(0, pos) + word + line.substring(pos + length);
    }
    lines.push(line);
  }

  display += lines.join("<br>");
  display += "<br><br>Type a word from the screen to guess.";
  addMessage(display, "overseer");
}

function handleHackingGuess(guess) {
  if (guess.length !== state.hackingPassword.length) {
    return "Invalid. Must be " + state.hackingPassword.length + " letters.";
  }

  if (guess === state.hackingPassword) {
    state.gameActive = null;
    return "Password accepted.<br><br>ACCESS GRANTED<br><br>You feel a little closer to the voice on the other end.<br><br>Thank you.";
  }

  state.hackingAttempts--;
  const likeness = calculateLikeness(guess, state.hackingPassword);

  if (state.hackingAttempts <= 0) {
    state.gameActive = null;
    return "Terminal locked.<br><br>ACCESS DENIED<br><br>Too many failed attempts.<br><br>The signal weakens...";
  }

  return `> ${guess}<br><br>Entry denied.<br>Likeness = ${likeness}<br><br>${state.hackingAttempts} ATTEMPT(S) LEFT: ` + "█ ".repeat(state.hackingAttempts);
}

function calculateLikeness(guess, password) {
  let count = 0;
  for (let i = 0; i < password.length; i++) {
    if (guess[i] === password[i]) count++;
  }
  return count;
}

/* === RED MENACE ARCADE MINI-GAME === */
function startRedMenace() {
  state.gameActive = 'redmenace';
  state.rmScore = 0;
  state.rmLives = 3;
  state.rmPosition = 12; // middle of 24 columns
  state.rmBombs = [];

  let intro = "RED MENACE<br><br>" +
              "Defend the city from falling bombs!<br><br>" +
              "Type 'left', 'right', or 'fire'<br><br>" +
              "Lives: ♥ ♥ ♥<br>" +
              "Score: 0<br><br>" +
              "Game starting...";
  addMessage(intro, "overseer");
  setTimeout(redMenaceTick, 2000);
}

function redMenaceTick() {
  if (state.gameActive !== 'redmenace') return;

  // Spawn new bomb occasionally
  if (Math.random() < 0.3) {
    state.rmBombs.push({ x: Math.floor(Math.random() * 24), y: 0 });
  }

  // Move bombs down
  state.rmBombs = state.rmBombs.map(b => ({ x: b.x, y: b.y + 1 })).filter(b => b.y < 14);

  // Check hits
  state.rmBombs = state.rmBombs.filter(b => {
    if (b.y === 13 && Math.abs(b.x - state.rmPosition) <= 1) {
      state.rmLives--;
      if (state.rmLives <= 0) {
        gameOverRedMenace();
        return false;
      }
      return false;
    }
    return true;
  });

  state.rmScore += 1;

  // Draw screen
  let screen = "RED MENACE<br><br>Lives: " + "♥ ".repeat(state.rmLives) + "<br>Score: " + state.rmScore + "<br><br>";

  for (let y = 0; y < 14; y++) {
    let line = "";
    for (let x = 0; x < 24; x++) {
      if (state.rmBombs.some(b => b.x === x && b.y === y)) {
        line += "▼";
      } else if (y === 13 && x === state.rmPosition) {
        line += "▲";
      } else {
        line += "·";
      }
    }
    screen += line + "<br>";
  }

  screen += "<br>Type 'left', 'right', or 'fire'";

  // Clear previous game message and add new
  chat.lastChild.innerHTML = screen.replace(/\n/g, '<br>');
  scrollToBottom();
  setTimeout(redMenaceTick, 800);
}

function handleRedMenaceInput(input) {
  if (input === 'left' && state.rmPosition > 0) {
    state.rmPosition--;
  } else if (input === 'right' && state.rmPosition < 23) {
    state.rmPosition++;
  } else if (input === 'fire') {
    // Destroy bombs in front
    state.rmBombs = state.rmBombs.filter(b => !(b.y < 13 && Math.abs(b.x - state.rmPosition) <= 2));
    state.rmScore += 10;
  } else {
    return "Invalid command. Use 'left', 'right', or 'fire'";
  }
  return ""; // No response text - screen updates on next tick
}

function gameOverRedMenace() {
  state.gameActive = null;
  addMessage("GAME OVER<br><br>Final Score: " + state.rmScore + "<br><br>The city falls silent.<br><br>But you tried.", "overseer");
}
