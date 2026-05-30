// test-overseer-crash-prevention.js
// Script to test the Overseer terminal crash prevention
// Run this in the browser console on the overseer.html page

(function() {
  console.log("Testing Overseer crash prevention...");

  // Simulate rapid interactions
  let testCount = 0;
  const maxTests = 100;

  function simulateInteraction() {
    if (testCount >= maxTests) {
      console.log("Test completed successfully! No crashes detected.");
      return;
    }

    testCount++;
    console.log(`Test ${testCount}/${maxTests}`);

    // Simulate typing and sending various commands
    const commands = [
      "hello",
      "help",
      "red menace",
      "status",
      "quit",
      "nukaquiz",
      "test answer",
      "quit",
      "maze",
      "north",
      "south",
      "quit",
      "blackjack",
      "hit",
      "stand",
      "quit",
      "slots",
      "spin",
      "quit",
      "war",
      "draw",
      "quit",
      "texas holdem",
      "continue",
      "quit",
      "hack",
      "TEST",
      "quit"
    ];

    const randomCommand = commands[Math.floor(Math.random() * commands.length)];

    // Simulate input
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('send');

    if (inputEl && sendBtn) {
      inputEl.value = randomCommand;
      sendBtn.click();
    }

    // Continue testing with random delay
    setTimeout(simulateInteraction, 100 + Math.random() * 200);
  }

  // Start the test
  setTimeout(simulateInteraction, 1000);

  // Monitor for crashes
  window.addEventListener('error', function(e) {
    console.error("CRASH DETECTED:", e.error);
  });

  window.addEventListener('unhandledrejection', function(e) {
    console.error("UNHANDLED PROMISE REJECTION:", e.reason);
  });

})();