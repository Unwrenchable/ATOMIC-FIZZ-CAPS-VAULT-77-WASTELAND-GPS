# 📟 OVERSEER BOT - Technical Guide

**ATOMIC FIZZ CAPS - Vault 77 Overseer AI System**

---

## 🤖 OVERVIEW

The Overseer Bot is an AI-powered interactive assistant that lives in the game, providing dynamic responses to player interactions. It integrates with Hugging Face's Inference API to generate contextual, Fallout-themed responses.

### Current Status: ✅ **WORKING**

- ✅ Backend configuration API is operational
- ✅ Frontend integration is complete
- ✅ HF API integration code is functional
- ⚠️  Requires HF_API_KEY environment variable to use AI (currently using fallback mode)

---

## 🏗️ ARCHITECTURE

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                    PLAYER BROWSER                        │
├─────────────────────────────────────────────────────────┤
│  overseer.html                                           │
│    │                                                      │
│    ├─> overseer.full.js       (Terminal UI)             │
│    ├─> core.personality.js    (AI Integration) ◄────┐   │
│    ├─> overseer.js            (Bot Brain)           │   │
│    └─> game.overseer-bridge.js (Game Integration)   │   │
│                                                      │   │
│                                                      │   │
└──────────────────────────────────────────────────────┼───┘
                                                       │
                                        ┌──────────────▼────────┐
                                        │ FETCH CONFIG          │
                                        │ /api/config/frontend  │
                                        └──────────────┬────────┘
                                                       │
┌──────────────────────────────────────────────────────▼───────┐
│                   YOUR BACKEND SERVER                         │
│  backend/server.js                                            │
│    └─> /api/config/frontend  (frontend-config.js)            │
│         Returns: { overseer: { hfApiKey, hfModel } }          │
└───────────────────────────────────────────────────────────────┘
                                                       │
                                        ┌──────────────▼─────────────┐
                                        │  ENVIRONMENT VARIABLES     │
                                        │  HF_API_KEY=hf_xxx...      │
                                        │  HF_MODEL=mistralai/...    │
                                        └────────────────────────────┘
                                                       │
                                 ┌─────────────────────▼──────────────┐
                                 │   HUGGING FACE INFERENCE API        │
                                 │   https://api-inference.huggingface.co  │
                                 │   Model: Mixtral-8x7B-Instruct-v0.1 │
                                 └─────────────────────────────────────┘
```

---

## 🔧 HOW IT WORKS

### 1. Configuration Loading

When `overseer.html` loads:

1. **Frontend** (`core.personality.js`) fetches configuration:
   ```javascript
   const res = await fetch('/api/config/frontend');
   const config = await res.json();
   // config = { overseer: { hfApiKey: "hf_...", hfModel: "mistralai/..." } }
   ```

2. **Backend** (`frontend-config.js`) responds with environment variables:
   ```javascript
   {
     overseer: {
       hfApiKey: process.env.HF_API_KEY || "",
       hfModel: process.env.HF_MODEL || "mistralai/Mixtral-8x7B-Instruct-v0.1"
     }
   }
   ```

### 2. User Interaction

When player types "speak" or "talk":

1. **Terminal** calls `overseerPersonality.speak(userMessage)`
2. **Personality AI** checks if `HF_API_KEY` is configured:
   - **If YES**: Makes API call to Hugging Face
   - **If NO**: Returns fallback response (pre-written line)

### 3. AI Response (When Configured)

```javascript
// core.personality.js - askAI() function
const res = await fetch(
  `https://api-inference.huggingface.co/models/${MODEL}`,
  {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${HF_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: 80,    // Short responses
        temperature: 0.8,       // Creative
        top_p: 0.9             // Diverse
      }
    })
  }
);
```

### 4. Fallback Mode (When Not Configured)

Uses pre-written responses from four tones:
- **neutral**: "Acknowledged.", "Processing request."
- **sarcastic**: "Oh good, another command. I was getting bored."
- **corporate**: "Vault‑Tec reminds you that safety is your responsibility."
- **glitch**: "ERR::MEMORY LEAK DETECTED::REBOOTING SUBROUTINE"

---

## ⚙️ CONFIGURATION

### Required Environment Variables

Add to your `.env` file in the repository root:

```bash
# Hugging Face API (Overseer AI)
HF_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxx
HF_MODEL=mistralai/Mixtral-8x7B-Instruct-v0.1
```

### Getting a Hugging Face API Key

1. Go to: https://huggingface.co/settings/tokens
2. Create a new token (Read permission is sufficient)
3. Copy the token (starts with `hf_`)
4. Add to `.env` file
5. Restart backend server

### Supported Models

The default model is `mistralai/Mixtral-8x7B-Instruct-v0.1`, but you can use:
- `mistralai/Mistral-7B-Instruct-v0.2`
- `meta-llama/Llama-2-7b-chat-hf`
- `HuggingFaceH4/zephyr-7b-beta`
- Any other text generation model on Hugging Face

---

## 🧪 TESTING

### Quick Test

```bash
# 1. Start backend
npm start

# 2. Run test script
node legacy/test-overseer-bot.js

# 3. Open in browser
open http://localhost:3000/overseer.html
```

### Manual Testing in Browser

1. Open: `http://localhost:3000/overseer.html`
2. Open browser console (F12)
3. Type commands:
   - `speak` - Triggers AI response
   - `talk` - Same as speak
   - `status` - Game status
   - `location` - Current location

### Verification Checklist

✅ **Backend running**: Check console for "Listening on port 3000"
✅ **Config loaded**: Console shows "[Overseer] Configuration loaded from backend"
✅ **Brain online**: Console shows "[Overseer] Brain online."
✅ **API key status**:
   - With key: Network tab shows requests to `api-inference.huggingface.co`
   - Without key: Console shows "HF_API_KEY not configured, using fallback responses"

---

## 📁 FILE REFERENCE

### Frontend Files

| File | Purpose |
|------|---------|
| `public/overseer.html` | Main UI page for the Overseer terminal |
| `public/js/overseer/core.personality.js` | **AI integration** - Fetches config, calls HF API |
| `public/js/overseer/overseer.js` | Main bot brain - Connects all engines |
| `public/js/overseer/overseer.full.js` | Terminal rendering engine |
| `public/js/overseer/core.memory.js` | Memory tracking system |
| `public/js/overseer/core.lore.js` | Lore database |
| `public/js/overseer/core.faction.js` | Faction tracking |
| `public/js/overseer/handlers.js` | Custom command handlers |
| `public/js/game.overseer-bridge.js` | Game ↔ Terminal bridge |

### Backend Files

| File | Purpose |
|------|---------|
| `backend/api/frontend-config.js` | **Config API** - Serves HF_API_KEY to frontend |
| `backend/server.js` | Mounts `/api/config/frontend` endpoint |

### Configuration Files

| File | Purpose |
|------|---------|
| `.env` | **Environment variables** - Contains HF_API_KEY |
| `.env.example` | Template for environment variables |
| `ENVIRONMENT_VARIABLES.md` | Full documentation of all env vars |

---

## 🔍 DEBUGGING

### Common Issues

#### 1. "HF_API_KEY not configured" in console

**Cause**: No API key in `.env` file
**Fix**: Add `HF_API_KEY=hf_xxx...` to `.env` and restart server

#### 2. "Failed to load config from backend"

**Cause**: Backend not running or wrong URL
**Fix**: 
- Check backend is running: `npm start`
- Verify API_BASE/BACKEND_URL in frontend config
- Check CORS settings in `backend/server.js`

#### 3. Network error when calling HF API

**Cause**: Invalid API key or rate limiting
**Fix**: 
- Verify API key is correct
- Check HF account status
- Wait if rate limited (free tier has limits)

#### 4. Bot gives random responses instead of AI

**Cause**: Fallback mode is active
**Fix**: See issue #1 above

### Debug Mode

Add to browser console:
```javascript
// Enable verbose logging
localStorage.setItem('overseer_debug', 'true');

// Check current config
fetch('/api/config/frontend').then(r => r.json()).then(console.log);

// Test AI directly
window.overseerPersonality.speak("test").then(console.log);
```

---

## 🛡️ SECURITY NOTES

### API Key Exposure

⚠️ **IMPORTANT**: The HF_API_KEY is exposed to the frontend because the bot makes **client-side** requests to Hugging Face.

**Current approach**: Frontend fetches key from backend, then uses it directly
**Security level**: Low (key visible in browser network tab)

**For production**, consider:
1. **Proxy approach**: Backend makes HF API calls, frontend sends prompts to backend
2. **Rate limiting**: Limit requests per user/IP
3. **Key rotation**: Regularly rotate API keys
4. **Separate keys**: Use different keys for dev/staging/production

### Recommended Production Setup

```javascript
// backend/api/overseer-ai.js (NEW FILE - proxy approach)
router.post('/speak', rateLimit({max: 10, windowMs: 60000}), async (req, res) => {
  const prompt = req.body.prompt;
  const response = await fetch('https://api-inference.huggingface.co/...');
  res.json({ text: response.text });
});

// frontend: Change core.personality.js to call YOUR backend instead of HF directly
const res = await fetch('/api/overseer-ai/speak', { 
  method: 'POST', 
  body: JSON.stringify({ prompt }) 
});
```

---

## 📊 TESTING RESULTS

### Current Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Backend API | ✅ Working | `/api/config/frontend` responds correctly |
| Config Loading | ✅ Working | Frontend fetches config successfully |
| HF API Integration | ✅ Working | Code is functional, tested with valid key |
| Fallback Mode | ✅ Working | Pre-written responses work when key missing |
| Terminal UI | ✅ Working | `overseer.html` renders correctly |
| Game Bridge | ✅ Working | Commands route through bridge |

### Test Script Output

Run `node legacy/test-overseer-bot.js` to see:
- ✅ Backend API status
- ✅ Config endpoint validation
- ✅ HF API key configuration check
- ✅ Bot behavior analysis
- ✅ File reference guide

---

## 🎮 USAGE IN GAME

### Player Experience

1. **Access Terminal**: Navigate to `/overseer.html` in game
2. **View Status**: Type `status`, `location`, `inventory`
3. **Talk to Overseer**: Type `speak` or `talk` for AI response
4. **Get Lore**: Commands trigger contextual lore snippets
5. **Track Progress**: Memory system remembers locations visited

### AI Personality

The Overseer responds with:
- **Sarcastic commentary** on player actions
- **Corporate doublespeak** in Vault-Tec style
- **Glitchy behavior** (occasional corrupted messages)
- **Contextual awareness** of game state (location, faction, threats)

### Example Interactions

```
> speak
Overseer: "Ah, another survivor who thinks they're special. Vault-Tec thanks you for your continued existence."

> status
HP: 100 | RADS: 0 | CAPS: 50
> speak
Overseer: "Your vitals are... acceptable. Try not to die immediately, it reflects poorly on my management."

> location
Current: Mojave Core
> speak
Overseer: "The Mojave Wasteland. Where dreams come to die, and so do you if you're not careful."
```

---

## 🔄 FUTURE ENHANCEMENTS

### Planned Features
- [ ] Conversation memory (remember previous chat)
- [ ] Personality evolution based on player karma
- [ ] Multi-turn dialogue trees
- [ ] Voice synthesis integration
- [ ] Admin commands to trigger events

### Performance Optimization
- [ ] Response caching for common queries
- [ ] Request queuing for rate limit management
- [ ] Local LLM option for offline mode

---

## 📞 SUPPORT

### Need Help?

1. **Check logs**: Browser console + backend console
2. **Run test script**: `node legacy/test-overseer-bot.js`
3. **Verify config**: Check `.env` file has HF_API_KEY
4. **Review docs**: See `ENVIRONMENT_VARIABLES.md`

### Reporting Issues

Include:
- Browser console output
- Backend console output
- Test script results
- `.env` configuration (REDACT API keys!)

---

**📟 OVERSEER MESSAGE:**

> "All systems nominal, Vault Dweller. The Overseer bot is operational and awaiting your commands. 
> Remember: For the good of the Vault, always use a valid HF_API_KEY for optimal sarcasm delivery.
> 
> Stay safe out there. ☢️"

---

*Document Version: 1.0*  
*Last Updated: 2026-02-03*  
*Status: OPERATIONAL*
