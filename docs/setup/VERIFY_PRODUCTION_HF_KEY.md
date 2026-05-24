# 🔍 How to Verify HF API Key is Being Used (Production)

Since you mentioned you updated the HF_API_KEY and created a new one separate from your Twitter bot, here's how to verify it's working in your deployed environment.

---

## Quick Verification

### If Deployed on Render.com

```bash
# Test your production instance
BACKEND_URL=https://your-app-name.onrender.com node verify-hf-api-usage.js
```

### If Deployed on Vercel

```bash
# Test your production instance
BACKEND_URL=https://your-app.vercel.app node verify-hf-api-usage.js
```

### If Deployed Elsewhere

```bash
# Replace with your actual URL
BACKEND_URL=https://atomicfizzcaps.xyz node verify-hf-api-usage.js
```

---

## Manual Browser Verification

### Step 1: Open Overseer Terminal

Navigate to your deployed app:
```
https://your-app.onrender.com/overseer.html
```

### Step 2: Open Browser Console

- Press `F12` (Chrome/Firefox/Edge)
- Or Right-click → "Inspect" → "Console" tab

### Step 3: Type "speak" Command

In the Overseer terminal input box, type:
```
speak
```

### Step 4: Check for HF API Calls

**If HF_API_KEY IS configured:**
- ✅ Network tab shows request to `api-inference.huggingface.co`
- ✅ Response is unique, AI-generated text
- ✅ Each "speak" command gives different response
- ✅ Responses are contextual and creative

**If HF_API_KEY is NOT configured:**
- ❌ Console shows: "[Overseer] HF_API_KEY not configured, using fallback responses"
- ❌ No network requests to Hugging Face
- ❌ Responses are pre-written (e.g., "Processing request.", "Acknowledged.")
- ❌ Same responses repeat from pool of ~16 lines

---

## Response Comparison

### AI Mode (HF API Key Configured) ✅

**Command:** `speak`

**Response Example:**
> "Ah, another vault dweller seeking my infinite wisdom. How utterly predictable. Your biosigns suggest you're either terrified or caffeinated. Possibly both. What crisis brings you crawling to my terminal today?"

**Characteristics:**
- Unique every time
- Contextual to conversation
- Longer, more detailed
- Matches Overseer personality
- Never exactly repeats

### Fallback Mode (No HF API Key) ❌

**Command:** `speak`

**Response Examples:**
- "Acknowledged."
- "Processing request."
- "Vault‑Tec reminds you that safety is your responsibility."
- "ERR::MEMORY LEAK DETECTED::REBOOTING SUBROUTINE"

**Characteristics:**
- Randomly selected from 16 pre-written lines
- Same lines repeat
- Generic, not contextual
- Shorter responses
- 4 personality tones (neutral, sarcastic, corporate, glitch)

---

## Where You Set the HF_API_KEY

Since this is running in a CI/CD environment, you likely set the key in:

### Render.com
1. Go to your service dashboard
2. Click "Environment" tab
3. Should see: `HF_API_KEY = hf_xxx...`
4. If missing, add it and redeploy

### Vercel
1. Go to Project Settings
2. Click "Environment Variables"
3. Should see: `HF_API_KEY = hf_xxx...`
4. If missing, add it and redeploy

### GitHub Actions / Repository Secrets
1. Go to repo Settings → Secrets → Actions
2. Check for `HF_API_KEY` secret
3. Used in deployment workflows

---

## Testing Your Production Instance Right Now

Since I can't access your environment variables in this sandboxed environment, let me help you test your live deployment:

### Check If Key Is Set

Run this in your terminal (with your actual URL):

```bash
curl -s https://your-app.onrender.com/api/config/frontend | jq .
```

**Expected Output (If Key Is Set):**
```json
{
  "overseer": {
    "hfApiKey": "hf_xxxxxxxxxxxxxxxxxxxxx",
    "hfModel": "mistralai/Mixtral-8x7B-Instruct-v0.1"
  }
}
```

**Current Output (If Key Not Set):**
```json
{
  "overseer": {
    "hfApiKey": "",
    "hfModel": "mistralai/Mixtral-8x7B-Instruct-v0.1"
  }
}
```

⚠️ **SECURITY NOTE**: The HF_API_KEY is exposed to frontend because the bot makes client-side API calls. This is by design but means the key is visible in browser DevTools.

---

## If You Just Added the Key

### You Need To:

1. **Restart the backend service**
   - Render: Trigger manual deploy or wait for auto-deploy
   - Vercel: Redeploy from dashboard
   - Local: Stop and restart `npm start`

2. **Clear browser cache**
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
   - Or clear cache in browser settings

3. **Test again**
   - Open overseer.html
   - Type "speak"
   - Check Network tab

---

## Verification Checklist

- [ ] HF_API_KEY added to deployment environment variables
- [ ] Backend service restarted/redeployed
- [ ] Navigate to /overseer.html
- [ ] Open browser console (F12)
- [ ] Type "speak" command
- [ ] Check Network tab for requests to `api-inference.huggingface.co`
- [ ] Verify response is unique AI-generated text
- [ ] Test multiple times to confirm different responses

---

## Expected Console Output

### With HF API Key ✅

```
[Config] Frontend: your-domain.com
[Config] Backend API: https://your-domain.com
[Overseer] Configuration loaded from backend
[Overseer] Brain online.
Overseer AI online.
```

**Network Tab:**
- Request to: `https://api-inference.huggingface.co/models/mistralai/Mixtral-8x7B-Instruct-v0.1`
- Method: POST
- Headers: `Authorization: Bearer hf_xxx...`
- Status: 200 OK

### Without HF API Key ❌

```
[Config] Frontend: your-domain.com
[Config] Backend API: https://your-domain.com
[Overseer] Configuration loaded from backend
[Overseer] HF_API_KEY not configured, using fallback responses
[Overseer] Brain online.
Overseer AI online.
```

**Network Tab:**
- No requests to huggingface.co
- May show error: "Failed to fetch" (blocked or no key)

---

## Troubleshooting

### "Still seeing fallback responses after adding key"

1. Verify key is actually set in environment:
   ```bash
   # Test your deployed backend
   curl https://your-app.com/api/config/frontend
   ```

2. Check for typos in environment variable name:
   - Must be exactly: `HF_API_KEY` (not `HUGGINGFACE_API_KEY`)
   - Case-sensitive

3. Restart backend service

4. Clear browser cache

### "Getting 401 Unauthorized from Hugging Face"

1. Key might be invalid or expired
2. Generate new key at: https://huggingface.co/settings/tokens
3. Update environment variable
4. Redeploy

### "Network request blocked"

1. Check Content Security Policy in `overseer.html`
2. Should include: `connect-src 'self' https://api-inference.huggingface.co`
3. May be browser extension blocking request

---

## Next Steps

1. **Verify your production deployment** using the steps above
2. **Run the verification script** on your deployed URL:
   ```bash
   BACKEND_URL=https://your-app.com node verify-hf-api-usage.js
   ```

3. **Share the output** so I can confirm the key is working

4. **Test in browser** and check Network tab for HF API calls

---

**📟 OVERSEER MESSAGE:**

> "The verification protocols are in place, Vault Dweller. 
> Test your deployed instance and report back with the console output.
> 
> If you see 'HF_API_KEY not configured' in your production console,
> the key hasn't been properly set in your deployment environment.
> 
> Stay safe out there. ☢️"

---

*For local testing, remember: This test environment doesn't have access to your deployment's environment variables. The HF_API_KEY must be set where your app is actually deployed (Render, Vercel, etc.).*
