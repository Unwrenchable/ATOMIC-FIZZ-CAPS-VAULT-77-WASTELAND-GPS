// Browser-safe shim for legacy imports that expected a "realai-brain" module.
// This routes calls to the local WebLLM Overseer implementation.

export async function overseerDecision(worldState, userPrompt) {
  const prompt = String(userPrompt || "Analyze the current world state and decide what happens next.");

  if (typeof window.overseerBrain === "function") {
    return window.overseerBrain(worldState || {}, prompt);
  }

  if (typeof window.talkToOverseer === "function") {
    return window.talkToOverseer(prompt, []);
  }

  return "OVERSEER CORE OFFLINE: local brain link unavailable.";
}
