# 🔑 HF API Key Sharing - Quick Reference

## TL;DR: Your Answer

**Question**: Can I share one Hugging Face API key across my Twitter bot, character AI, personal site, and this game?

**Answer**: ✅ **YES! One shared key is recommended.**

---

## Quick Facts

### ✅ Why One Key Works:

1. **Free Tier**: 30,000 requests/month covers multiple apps
2. **Cost-Effective**: $9/mo Pro > 3x$9/mo if you split
3. **Simpler**: One key to rotate, one dashboard to monitor
4. **HF Designed It**: Keys are meant to serve multiple apps

### 📊 Your Estimated Usage:

```
Atomic Fizz Caps Game:  ~30,000 req/month
Twitter Bot:            ~3,000 req/month
Personal Site:          ~15,000 req/month
───────────────────────────────────────
Total:                  ~48,000 req/month
```

**Recommendation**: Use one key + upgrade to Pro ($9/month)

---

## Setup (All Repos Use Same Key)

### Repo 1: Atomic Fizz Caps (this repo)
```bash
# Render/Vercel Environment Variables
HF_API_KEY=hf_your_key_here
```

### Repo 2: Twitter Bot
```bash
# Same key, same variable name
HF_API_KEY=hf_your_key_here
```

### Repo 3: Personal Site Characters
```bash
# Same key, same variable name
HF_API_KEY=hf_your_key_here
```

---

## Monitor Usage

Visit: https://huggingface.co/settings/tokens

Watch for:
- Monthly usage approaching 30k (free tier limit)
- Upgrade to Pro when needed
- Unusual spikes (possible abuse)

---

## When to Split Keys

Only if:
- ❌ You exceed Pro tier limits (very high traffic)
- ❌ Different security contexts (one compromised = all exposed)
- ❌ Client billing separation needed
- ❌ Different organizations/clients

For your hobby/personal projects: **Stay with one key!**

---

## Security Notes

### Current Setup (This Repo)
- ⚠️ Key exposed to frontend (by design)
- ⚠️ Visible in browser DevTools
- ⚠️ Anyone can see/use your key
- ✅ Read-only access (can't modify account)
- ✅ Worst case: Someone burns your quota

### Mitigation
- Monitor usage dashboard
- Rotate key if abused (regen every 3-6 months)
- Implement fallbacks (already done in this repo!)
- Consider backend proxy for sensitive apps

---

## Action Items

- [x] Use same `HF_API_KEY` across all deployments
- [ ] Set environment variable in each platform:
  - [ ] Render.com: Environment → Add `HF_API_KEY`
  - [ ] Vercel: Settings → Environment Variables
  - [ ] Other platforms as needed
- [ ] Monitor usage: https://huggingface.co/settings/tokens
- [ ] Upgrade to Pro ($9/mo) when approaching 30k/month
- [ ] Implement fallback responses in all apps

---

## Cost Breakdown

### Option 1: Shared Key + Pro (Recommended)
```
Cost: $9/month
Coverage: All apps (48k+ requests)
Management: Simple
```

### Option 2: Separate Keys + 3x Pro
```
Cost: $27/month
Coverage: All apps (48k+ requests)
Management: Complex
```

**Savings: $18/month by sharing!**

---

## Quick Verification

```bash
# Test this repo
BACKEND_URL=https://your-app.com node verify-hf-api-usage.js

# Check key is set
curl https://your-app.com/api/config/frontend | jq .overseer.hfApiKey

# Should return: "hf_xxxxxxxxxxxxx" (not empty string)
```

---

## Full Documentation

For complete details, see:
- [HF_API_KEY_SHARING_GUIDE.md](docs/setup/HF_API_KEY_SHARING_GUIDE.md) - Complete guide
- [HF_API_SETUP.md](docs/setup/HF_API_SETUP.md) - Initial setup
- [VERIFY_PRODUCTION_HF_KEY.md](docs/setup/VERIFY_PRODUCTION_HF_KEY.md) - Production testing

---

**Summary**: Share one key, save money, simplify management. You're good! 🚀

☢️ *For the good of the Vault!*
