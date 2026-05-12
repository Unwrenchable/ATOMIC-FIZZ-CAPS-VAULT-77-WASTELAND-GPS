import fetch from "node-fetch";

export async function realai(prompt, model = "local") {
  const url = "http://127.0.0.1:8080/v1/chat/completions";

  const body = {
    model: model,
    messages: [
      { role: "user", content: prompt }
    ]
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json();

  if (!data || !data.choices || !data.choices[0]) {
    return "";
  }

  return data.choices[0].message.content;
}
