import fetch from "node-fetch";

export async function realaiChat(prompt) {
  const res = await fetch("http://localhost:8000/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "realai-2.0",
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "No response";
}
