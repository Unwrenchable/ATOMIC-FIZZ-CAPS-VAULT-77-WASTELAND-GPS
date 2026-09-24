import fetch from "node-fetch";

const PROVIDERS = {
  openai: { url: "https://api.openai.com/v1/chat/completions" },
  grok:   { url: "https://api.x.ai/v1/chat/completions" },
  ollama: { url: "http://localhost:11434/api/chat" }
};

class RealAI {
  constructor() {
    this.defaultProvider = process.env.AI_PROVIDER || "grok";
    this.defaultModel = process.env.AI_MODEL || "grok-4.3";
  }

  async chat(prompt, options = {}) {
    const provider = options.provider || this.defaultProvider;
    const model = options.model || this.defaultModel;
    const temperature = options.temperature ?? 0.75;

    console.log(`[RealAI] Using ${provider} / ${model}`);

    if (provider === "ollama") {
      return this._callOllama(prompt, model, temperature);
    } else {
      return this._callCloud(prompt, provider, model, temperature);
    }
  }

  async _callCloud(prompt, provider, model, temperature) {
    const apiKey = process.env[`${provider.toUpperCase()}_API_KEY`] || process.env.AI_API_KEY;
    if (!apiKey) throw new Error(`Missing ${provider.toUpperCase()}_API_KEY`);

    const res = await fetch(PROVIDERS[provider].url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: prompt }],
        temperature: temperature,
        max_tokens: 2048
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`${provider} error ${res.status}: ${errorText}`);
    }

    const data = await res.json();
    return {
      content: data.choices?.[0]?.message?.content || "",
      provider,
      model
    };
  }

  async _callOllama(prompt, model, temperature) {
    // ... (same as before)
    const res = await fetch(PROVIDERS.ollama.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        options: { temperature }
      })
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
    const data = await res.json();
    return { content: data.message?.content || "", provider: "ollama", model };
  }
}

const realAI = new RealAI();
export default realAI;
