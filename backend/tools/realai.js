import fetch from "node-fetch";

export async function realai(prompt, model = "realai-1.0") {
  const res = await fetch("http://localhost:8000/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await res.json();
  return data.output;
}
