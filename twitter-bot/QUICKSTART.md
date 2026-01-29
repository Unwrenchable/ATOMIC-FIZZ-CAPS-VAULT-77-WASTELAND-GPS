# ⚡ Quick Start Guide - 9D Tic Tac Toe Twitter Bot

Get your @9dtictactoe bot running in 5 minutes!

## 🎯 What You'll Need

1. **Twitter Developer Account** (free) - [Apply here](https://developer.twitter.com/en/portal/petition/essential/basic-info)
2. **Redis URL** (optional) - For persistence across restarts
3. **Render Account** (free) - [Sign up here](https://render.com/)

## 🚀 Deploy in 3 Steps

### Step 1: Get Twitter API Credentials (5 min)

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new app or use existing
3. Go to "Keys and tokens" tab
4. Generate/copy these 4 values:
   - API Key
   - API Secret
   - Access Token
   - Access Token Secret

💡 **Save these somewhere safe!**

### Step 2: Deploy to Render (2 min)

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **New +** → **Web Service**
3. Connect repository: `Unwrenchable/ATOMIC-FIZZ-CAPS-VAULT-77-WASTELAND-GPS`
4. Configure:
   - **Name:** `9dttt-twitter-bot`
   - **Root Directory:** `twitter-bot`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `python gamemaker_bot.py`
5. Click **Create Web Service**

### Step 3: Add Environment Variables (2 min)

In Render dashboard, go to **Environment** tab and add:

```bash
API_KEY=<your_twitter_api_key>
API_SECRET=<your_twitter_api_secret>
ACCESS_TOKEN=<your_twitter_access_token>
ACCESS_SECRET=<your_twitter_access_secret>
BOT_USERNAME=9dtictactoe
REDIS_URL=<optional_redis_url>
```

Click **Save Changes** - bot will auto-restart!

## ✅ Test It!

1. Wait for deployment to complete (watch logs)
2. Visit: `https://your-service.onrender.com/health`
3. Should see: `{"status": "healthy", ...}`
4. Tweet: `@9dtictactoe start`
5. Bot replies with game board! 🎉

## 🔥 Keep It Awake (Optional but Recommended)

Render free tier sleeps after 15 min. Keep it awake:

1. Go to [UptimeRobot](https://uptimerobot.com/)
2. Create free account
3. Add monitor:
   - Type: HTTP(s)
   - URL: `https://your-service.onrender.com/ping`
   - Interval: 5 minutes
4. Done! Bot stays awake 24/7

## 🎮 How to Play

**Start Game:**
```
@9dtictactoe start
```

**Make Move:**
Reply with number 1-9:
```
1 2 3
4 5 6  ← Board positions
7 8 9
```

**Quit:**
```
@9dtictactoe quit
```

## 📊 Monitor Your Bot

**Health Check:**
```
https://your-service.onrender.com/health
```

**Stats:**
```
https://your-service.onrender.com/stats
```

**Logs:**
Render Dashboard → Your Service → Logs

## 🐛 Troubleshooting

**Bot not responding?**
- Check Twitter API credentials in Render
- Look for errors in Render logs
- Verify bot username is correct

**"redis_connected": false?**
- Check REDIS_URL format: `redis://:password@host:port`
- Bot will still work (uses file storage)

**Rate limited?**
- Normal! Bot backs off automatically
- Shows in logs: "Rate limited by Twitter API"

## 💡 Tips

- Pin a tweet explaining how to play
- Monitor stats endpoint regularly
- Check logs for any issues
- Adjust CHECK_EVERY_SECONDS if needed

## 🆘 Need Help?

1. Check [DEPLOYMENT.md](DEPLOYMENT.md) for detailed guide
2. Check [README.md](README.md) for full documentation
3. Look at Render logs for errors
4. Test locally: `python gamemaker_bot.py`

## 🎊 You're Done!

Your bot is live! Tweet at it to play.

**May the odds be ever in your favor!** 🔥

---

**Total Time:** ~10 minutes  
**Cost:** $0 (free tier)  
**Maintenance:** None (set it and forget it)
