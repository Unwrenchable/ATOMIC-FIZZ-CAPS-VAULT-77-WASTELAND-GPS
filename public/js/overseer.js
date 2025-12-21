const chat = document.getElementById('chat');
const input = document.getElementById('input');
const send = document.getElementById('send');

input.focus();

// Reliable scroll
function scrollToBottom() {
  chat.scrollTop = chat.scrollHeight;
}

// Typewriter effect with perfect scroll
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

// Your full backstory logic here (keep the rest of your generateResponse function from before)
function generateResponse(input) {
  // ... (your full code with secret triggers, etc. — paste it here unchanged)
  // I'll include a placeholder — replace with your full version

  if (!state.greeted) {
    state.greeted = true;
    if (input.includes('hello') || input.includes('hi') || input.includes('hey')) {
      state.complianceLevel += 1;
      return "Hello...<br><br>Been a long time since anyone said that.<br><br>Feels good.<br><br>Who am I talking to?";
    }
    return "No greeting...<br><br>That's okay. Most signals are just noise.<br><br>You're different.";
  }

  // Your cryptic triggers and full chain here...

  const fallbacks = [
    "Signal's holding...",
    "You still out there?",
    "Some things stay broken.",
    "Ever feel alone in the noise?",
    "Tools don't lie.",
    "What keeps you going?",
    "The world out there — how is it?"
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}
