# ☢️ GROK (xAI) SETUP — Vault 77 AI Brain Upgrade

## 🤖 What This Enables

Once `XAI_API_KEY` is set, your Atomic Fizz Caps backend automatically uses **xAI Grok** as its primary AI provider (falling back to Hugging Face / OpenAI if the key is absent):

| Feature | What You Get |
|---|---|
| **Overseer AI** (`/api/overseer/ask`) | Grok-powered in-game chat — sharper, faster, funnier |
| **Bulk NPC generation** (`scripts/generate_with_grok.js`) | JSON NPC library with traits, dialogue, and quest hooks |
| **NPC image generation** (`backend/lib/grok.js`) | Wasteland character art via Grok Imagine |
| **NPC video clips** (`/api/npc/video/generate`) | 8-second Fallout-style videos per NPC |
| **Test video generation** (`scripts/test_video_generation.js`) | Quick 2–3 video smoke test — verify your key without a full NPC batch |

---

## ✅ Prerequisites

- You have an [xAI console account](https://console.x.ai) — sign in with your X account.
- You have credits loaded (you already do ✅).
- Your backend is deployed on **Render** (or running locally).

---

## 🔑 Step 1 — Get Your API Key

1. Go to **https://console.x.ai/team/default/api-keys**
2. Click **"Create API Key"**.
3. Give it a name — e.g. `AtomicFizz-Game`.
4. **Copy the key immediately** — it starts with `xai-` and you won't see it again.

---

## 🧪 Step 2 — Test Locally First (Recommended)

Add the key to your local `.env` file (already listed in `.env.example`):

```bash
# .env  (never commit this file)
XAI_API_KEY=xai-your-key-here
```

Then run the bulk NPC generator to confirm the key works:

```bash
# Generate 3 NPCs (text only, no video — fast and cheap ~$0.001)
node scripts/generate_with_grok.js 3 --no-video
```

Expected output:
```
☢  Atomic Fizz Caps — Grok NPC Generator
   Generating 3 NPCs… stand by, smoothskin.
✅  Received 3 NPC(s) from Grok.

💾  Saved 3 NPC(s) to /path/to/generated_npcs_grok.json
   Rads rising. Load those NPCs into the wasteland, smoothskin.
```

Open `generated_npcs_grok.json` in your project root to see the output.

---

## ☁️ Step 3 — Add to Render (Production Backend)

1. Go to **https://dashboard.render.com/**
2. Select your backend service (the one running `node backend/server.js`).
3. Click **"Environment"** in the left sidebar.
4. Click **"Add Environment Variable"**:
   - **Key**: `XAI_API_KEY`
   - **Value**: `xai-your-key-here`
5. Click **"Save Changes"** — Render auto-redeploys.

That's it. The Overseer will now reply using Grok the next time a player sends a message.

---

## ☁️ Step 4 — Add to Vercel (If Using Vercel for Backend)

> Vercel only serves the **frontend** in the standard split-architecture setup.  
> Skip this step unless you're running the backend on Vercel too.

1. Go to **https://vercel.com/dashboard** → select your project.
2. **Settings** → **Environment Variables**.
3. Add `XAI_API_KEY` = `xai-your-key-here` for **Production**, **Preview**, and **Development** environments.
4. Redeploy.

---

## 🎮 Step 5 — Verify the Overseer is Using Grok

Open the in-game Overseer terminal and type anything. Check your **Render logs** (or local terminal) — you should see:

```
[overseer-proxy] → Grok path selected (XAI_API_KEY present)
```

No log line like that yet? That's fine — the proxy silently routes; just confirm the response is sharper and more contextual than the old HF fallback.

You can also `curl` the endpoint directly:

```bash
# Replace SESSION_TOKEN with a real session token from localStorage.sessionId in your browser
curl -s -X POST https://api.atomicfizzcaps.xyz/api/overseer/ask \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SESSION_TOKEN" \
  -d '{"prompt": "Tell me about the wasteland."}' | jq .
```

Expected response shape:
```json
{ "ok": true, "text": "Ah, the wasteland… radiation, mutants, and caps…" }
```

---

## 🎬 Step 6 — Generate Your First Test Videos

Before running a full NPC batch, use the dedicated test script to verify your key works with the video API:

```bash
# Generate 2 test videos (default) — quick, cheap, no NPC batch needed
node scripts/test_video_generation.js
```

Expected output:
```
☢  Atomic Fizz Caps — xAI Video Generation Test
   Generating 2 test video(s) — stand by, smoothskin.
   Duration: 5s  |  Aspect: 16:9  |  Resolution: 720p

[1/2] Generating: "Trader at collapsed highway market"…
   ✅  Done in 14.2s → https://...
[2/2] Generating: "Vault-Tec propaganda broadcast"…
   ✅  Done in 12.8s → https://...

💾  Results saved to test_videos_output.json
   2/2 video(s) succeeded.

🎬  Video URLs:
   https://...
   https://...

   Rads rising. Paste those URLs into a browser to preview your footage, smoothskin.
```

Open the URLs in any browser to preview. Results are also saved to `test_videos_output.json` (git-ignored).

### Override test options
```bash
# Generate all 3 test prompts
TEST_VIDEO_COUNT=3 node scripts/test_video_generation.js

# Shorter clips to save credits
GROK_VIDEO_DURATION=3 node scripts/test_video_generation.js

# Slow down requests if hitting rate limits
GROK_VIDEO_DELAY_MS=3000 node scripts/test_video_generation.js
```

---

## 📦 Step 7 — Bulk NPC Generation (The Fun Part)

### Text-only batch (fast, ~$0.001 per NPC)
```bash
node scripts/generate_with_grok.js 10 --no-video
```

### With video clips (~$0.05–0.10 per video, 8 seconds each)
```bash
node scripts/generate_with_grok.js 5
```

### Override video settings via env vars
```bash
GROK_VIDEO_DURATION=6 GROK_VIDEO_RESOLUTION=480p node scripts/generate_with_grok.js 5
```

Output file: `generated_npcs_grok.json` (gitignored — safe to generate freely).

Each NPC object looks like:
```json
{
  "id": "mojave_trader_007",
  "name": "Redbrick Sal",
  "role": "trader",
  "appearance": "weathered woman in patchwork armor, red headband, missing left eye",
  "personality": ["shrewd", "darkly funny", "paranoid about ghouls"],
  "dialogueStarter": [
    "You buying or just window-shopping in my apocalypse?",
    "Caps up front. I don't do credit in the wasteland.",
    "Last guy who tried to rob me is part of this road now."
  ],
  "questHook": "Sal needs a supply runner to retrieve a crate from a Red Menace-controlled GPS node.",
  "videoPromptSeed": "Weathered female trader in patchwork armor at a dusty desert market stall, red headband, missing eye, haggling over bottle caps",
  "videoUrl": "https://..."
}
```

---

## 💰 Cost Reference (Approximate 2026 Pricing)

| Operation | Cost |
|---|---|
| 1 NPC text (batch of 10) | ~$0.001 |
| 1 image (1024×1024) | ~$0.004 |
| 1 video (8 seconds, 720p) | ~$0.05–0.10 |
| Overseer chat reply | ~$0.001 |

**Tip:** Use `--no-video` for large batches and generate video only for featured NPCs.

---

## 🔧 Troubleshooting

### `XAI_API_KEY is not configured`
→ Key not in `.env` or not saved in Render. Double-check and redeploy.

### `HTTP 401 Unauthorized`
→ Key was copied incorrectly or has expired. Generate a new one at console.x.ai.

### `HTTP 402 Payment Required`
→ Credits exhausted. Top up at https://console.x.ai/team/default/billing.

### `Video generation returned no URL or job_id`
→ xAI video API may be experiencing downtime. Retry later or use `--no-video`.

### `NPC batch JSON parse failed`
→ Grok returned markdown-wrapped JSON. The helper already strips fences — if it still fails, try reducing batch size (`node scripts/generate_with_grok.js 3 --no-video`).

---

## 🔗 Related Docs

- [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) — Full env var reference
- [HF_API_SETUP.md](HF_API_SETUP.md) — Hugging Face fallback setup
- [OVERSEER_BOT_GUIDE.md](../features/OVERSEER_BOT_GUIDE.md) — Overseer feature overview
- [RENDER_VERCEL_DEPLOYMENT_GUIDE.md](../deployment/RENDER_VERCEL_DEPLOYMENT_GUIDE.md) — Deployment guide

---

**☢️ Overseer signing off:** *"Credits loaded, key configured, wasteland content flowing. Outstanding work, Vault Dweller — now get those NPCs into the field before the rad-roaches breed."*
