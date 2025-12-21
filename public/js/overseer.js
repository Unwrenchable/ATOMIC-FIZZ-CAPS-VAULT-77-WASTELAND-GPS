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
  scrollToBottom();  // Immediate scroll when message appears

  const fullText = text.replace(/<br>/g, '\n');
  let i = 0;
  const timer = setInterval(() => {
    if (i < fullText.length) {
      if (fullText[i] === '\n') div.innerHTML += '<br>';
      else div.innerHTML += fullText[i];
      i++;
      chat.scrollTop = chat.scrollHeight;  // Scroll during typing
    } else {
      clearInterval(timer);
      scrollToBottom();  // Final lock at bottom
    }
  }, 30);
}

// Initial greeting on load
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
  knowsFullSecret: false
};

// Full generateResponse with your personal backstory
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

  // ULTRA-OBSCURE CRYPTIC TRIGGERS — any one unlocks the secret path
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

  // Secret personal story chain
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

  // Normal public conversation
  if ((input.includes('who are you') || input.includes('your name') || input.includes('tell me about yourself')) && !state.knowsRealName) {
    state.knowsRealName = true;
    return "Name's Jax Harlan.<br><br>Used to be a mechanic.<br><br>Fixed things that were broken.<br><br>Now... I'm the voice in the static.";
  }

  if ((input.includes('jax') || input.includes('harlan') || input.includes('mechanic')) && state.knowsRealName && !state.knowsMechanicPast) {
    state.knowsMechanicPast = true;
    return "Yeah... ace mechanic once.<br><br>Could make any engine run again.<br><br>No machine too busted.<br><br>People came from all over.<br><br>Then everything changed.<br><br>The world. Me.";
  }

  // Random fallbacks for atmosphere
  const fallbacks = [
    "Signal's holding... barely.",
    "You still out there?",
    "Some things stay broken forever.",
    "Ever feel like something's growing inside you?",
    "Tools don't judge. People do.",
    "The world's quieter now.",
    "What keeps you moving?",
    "I still carry my old wrench. Bent, but mine.",
    "Quiet days are the worst."
  ];

  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}
