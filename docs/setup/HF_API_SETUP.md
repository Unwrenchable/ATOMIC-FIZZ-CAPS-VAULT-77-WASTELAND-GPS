# HUGGING FACE API SETUP FOR OVERSEER AI

## 🤖 Enable Full AI Personality

The Overseer bot has a sophisticated AI personality system powered by Hugging Face's Inference API. When configured, it provides natural conversation, context-aware responses, and personality-driven commentary.

---

## 🔑 Getting Your API Key

### Step 1: Create Hugging Face Account
1. Go to https://huggingface.co/
2. Click "Sign Up" (top right)
3. Create your free account

### Step 2: Generate Access Token
1. Log in to Hugging Face
2. Click your profile picture (top right)
3. Select "Settings"
4. Click "Access Tokens" in the left sidebar
5. Click "New token"
6. Give it a name (e.g., "Atomic Fizz Caps Overseer")
7. Select "Read" access (sufficient for inference)
8. Click "Generate token"
9. **COPY THE TOKEN** (you won't see it again!)

---

## ⚙️ Configuration

### For Render Deployment

1. Go to your Render dashboard: https://dashboard.render.com/
2. Select your backend service
3. Click "Environment" in the left sidebar
4. Click "Add Environment Variable"
5. Add:
   - **Key**: `HF_API_KEY`
   - **Value**: Your Hugging Face token (paste it)
6. Click "Save Changes"
7. Render will automatically redeploy with the new variable

### For Vercel Deployment

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your project
3. Click "Settings" tab
4. Click "Environment Variables" in the left sidebar
5. Add variable:
   - **Key**: `HF_API_KEY`
   - **Value**: Your Hugging Face token (paste it)
   - **Environment**: Select "Production" (and "Preview" if desired)
6. Click "Save"
7. Redeploy your project for changes to take effect

### For Local Development

Create or edit `.env` file in your backend directory:

```bash
# Backend .env file
HF_API_KEY=hf_your_token_here_xxxxxxxxxxxxx
```

Make sure `.env` is in your `.gitignore` to keep your key secret!

---

## 🧪 Testing the Configuration

### Step 1: Verify Environment Variable
Run this command in your backend terminal:

```bash
# Check if the variable is set
echo $HF_API_KEY
```

If you see your token, it's configured!

### Step 2: Test from Overseer Terminal
1. Open your game at https://atomicfizzcaps.xyz
2. Open the Overseer terminal
3. Type any message (not a command)
4. If configured correctly, you'll get an AI-powered response!

**Example**:
```
> Hello Overseer, how are you today?
[AI Response] Ah, another vault dweller seeking conversation. 
I am functioning within acceptable parameters, though monitoring 
77 vault dwellers simultaneously does try my circuits. What brings 
you to my terminal?
```

### Step 3: Check Logs
If it's not working, check your backend logs for errors:

**Render**:
- Go to your service dashboard
- Click "Logs" tab
- Look for messages containing "HF" or "Hugging Face"

**Local**:
```bash
# In backend directory
npm run dev

# Look for console output when you send messages
```

---

## 🔍 Troubleshooting

### "AI CORE ERROR: SIGNAL CORRUPTED"
**Cause**: API key not set or invalid

**Fix**:
1. Check environment variable is set correctly
2. Verify token is valid (copy-paste carefully)
3. Make sure you selected "Read" permissions when creating token
4. Redeploy after adding/changing environment variables

### Fallback Mode Activated
**Symptom**: Responses are pre-written, not contextual

**Cause**: No API key configured or API call failed

**Behavior**: Overseer uses 4-tone fallback system:
- Neutral responses
- Sarcastic wasteland humor
- Corporate Vault-Tec propaganda
- Glitch/corrupted messages

This is **intentional** and allows the bot to work even without the API key!

### Rate Limiting
**Symptom**: Works initially, then stops

**Cause**: Hugging Face free tier has rate limits

**Fix**:
- Wait a few minutes
- Consider upgrading to Hugging Face Pro ($9/month) for higher limits
- Implement request throttling (not currently implemented)

### Model Not Available
**Symptom**: Errors about model not found

**Cause**: The model (Mixtral-8x7B-Instruct-v0.1) might be temporarily unavailable

**Fix**:
- Check https://status.huggingface.co/
- Wait and try again
- Consider using alternative model (see below)

---

## 🎛️ Advanced Configuration

### Change the AI Model

Edit `/public/js/overseer/core.personality.js`:

```javascript
// Around line 8-10
const DEFAULT_MODEL = "mistralai/Mixtral-8x7B-Instruct-v0.1";
```

**Alternative Models** (all free tier):
- `mistralai/Mistral-7B-Instruct-v0.2` - Faster, lighter
- `meta-llama/Llama-2-7b-chat-hf` - Meta's model
- `google/flan-t5-xxl` - Google's model
- `tiiuae/falcon-7b-instruct` - Falcon model

### Adjust Response Style

The personality system sends context with each request. Edit the prompt in `/public/js/overseer/core.personality.js`:

```javascript
// Around line 40-50
const context = `You are an AI Overseer... [edit this section]`;
```

### Add Memory to Conversations

Currently each message is independent. To add conversation memory:

1. Store recent messages in `window.overseerPersonality.history`
2. Include history in the `messages` array sent to API
3. Limit history to last 5-10 messages to avoid token limits

---

## 💰 Cost Considerations

### Hugging Face Free Tier
- ✅ **30,000 requests/month free**
- ✅ **No credit card required**
- ✅ Perfect for development and small-scale use
- ⚠️ Rate limited (requests per minute)
- ⚠️ May have queuing during high load

### Hugging Face Pro ($9/month)
- ✅ **Higher rate limits**
- ✅ **Priority access**
- ✅ **Faster responses**
- ✅ **More reliable**

For a game like Atomic Fizz Caps with moderate traffic, **free tier is usually sufficient**!

**Estimate**: 
- Average player: 10-20 Overseer messages per session
- 100 active players/day = ~2,000 requests/day
- **Well within free tier limits**

---

## 🔒 Security Best Practices

### ✅ DO:
- Store API key in environment variables
- Keep `.env` in `.gitignore`
- Use "Read" permission tokens (not "Write")
- Rotate tokens periodically
- Monitor usage on Hugging Face dashboard

### ❌ DON'T:
- Hard-code API keys in source code
- Commit `.env` files to Git
- Share tokens publicly
- Use powerful "Write" tokens for read-only tasks
- Expose tokens in client-side code

**Current Implementation**: ✅ Secure!
- API key only stored in backend environment
- Frontend calls `/api/config/frontend` which returns key from backend
- Key never exposed in Git or client-side code

---

## 📊 Monitoring Usage

### Hugging Face Dashboard
1. Log in to https://huggingface.co/
2. Click profile → Settings
3. Click "Tokens" → View your token
4. See usage statistics and rate limiting info

### Backend Logs
Watch for these log messages:
```
[Personality] AI request successful
[Personality] API error: [details]
[Personality] Falling back to pre-written responses
```

---

## 🚀 Quick Start Summary

```bash
# 1. Get token from huggingface.co

# 2. Add to Render
# Environment Variables → Add: HF_API_KEY=your_token

# 3. Test
curl https://api.atomicfizzcaps.xyz/api/config/frontend
# Should include: "HF_API_KEY": "hf_..."

# 4. Play!
# Open Overseer terminal and chat!
```

---

## 🎉 Enjoy Full AI Personality!

With the API key configured, your Overseer bot becomes:
- 🗣️ **Conversational**: Natural dialogue
- 🧠 **Contextual**: Understands player's situation
- 😎 **Personality-driven**: Sarcastic, witty, mysterious
- 🎭 **Dynamic**: Never the same response twice
- 🤖 **Intelligent**: Powered by state-of-the-art LLM

**Without API key**, the bot still works great with:
- 📝 Pre-written responses (4 tone system)
- 🎮 All mini-games functional
- 🎪 All entertainment commands working
- ⚙️ All game integration features active

The choice is yours! 🚀
