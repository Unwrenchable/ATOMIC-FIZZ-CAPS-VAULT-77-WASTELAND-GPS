# 🚀 Twitter Bot Deployment Guide for Render

This guide will help you deploy the Gamemaker Twitter Bot on Render and keep it running 24/7.

## ✅ Prerequisites

Before deploying, you'll need:

1. **Twitter Developer Account**
   - Sign up at [developer.twitter.com](https://developer.twitter.com/)
   - Create a new app
   - Enable API v2 access
   - Generate API keys and access tokens

2. **Render Account**
   - Sign up at [render.com](https://render.com/)
   - Free tier works great for this bot

3. **Redis Instance** (Already have it!)
   - You're reusing Redis from your ATOMIC FIZZ CAPS game
   - Just copy the `REDIS_URL` from your backend

## 📋 Step-by-Step Deployment

### Step 1: Push Code to GitHub

Your code is already in the repository! The Twitter bot is in the `twitter-bot/` directory.

### Step 2: Create Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository: `Unwrenchable/ATOMIC-FIZZ-CAPS-VAULT-77-WASTELAND-GPS`
4. Configure the service:

   **Basic Settings:**
   - **Name:** `atomic-fizz-gamemaker-bot` (or your choice)
   - **Region:** Choose closest to you
   - **Branch:** `main` (or your branch)
   - **Root Directory:** `twitter-bot`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** Leave blank (uses Procfile with gunicorn)

   **Instance Type:**
   - Select **Free** (or Starter for guaranteed uptime)

### Step 3: Configure Environment Variables

In the Render dashboard, add these environment variables:

#### Required - Twitter API
```bash
API_KEY=your_twitter_api_key_here
API_SECRET=your_twitter_api_secret_here
ACCESS_TOKEN=your_twitter_access_token_here
ACCESS_SECRET=your_twitter_access_secret_here
```

#### Required - Bot Config
```bash
BOT_USERNAME=YourBotTwitterHandle
```

#### Required - Redis (REUSE from main game!)
```bash
REDIS_URL=redis://:password@your-redis-host.upstash.io:6379
```
*Copy this from your backend's environment variables*

#### Optional - Tuning
```bash
CHECK_EVERY_SECONDS=600
MAX_MENTIONS_PER_CYCLE=5
```

**Note:** Render automatically provides `PORT` - don't set it manually!

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Render will:
   - Clone your repository
   - Install dependencies
   - Start the bot
3. Watch the logs for: `🔥 The Gamemaker is ready. The arena awaits!`

### Step 5: Verify It's Working

Once deployed, visit your service URL:
```
https://your-service-name.onrender.com/health
```

You should see:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-29T12:00:00",
  "active_games": 0,
  "redis_connected": true
}
```

## 🎮 Test the Bot

1. Go to Twitter
2. Tweet at your bot: `@YourBot start`
3. The bot should reply with a game board!
4. Reply with a number (1-9) to make moves

## 🔥 Keep It Awake (Free Tier)

Render's free tier sleeps after 15 minutes of inactivity. Here's how to keep it alive:

### Option 1: UptimeRobot (Recommended)

1. Sign up at [uptimerobot.com](https://uptimerobot.com/) (free)
2. Create a new monitor:
   - **Monitor Type:** HTTP(s)
   - **URL:** `https://your-service.onrender.com/ping`
   - **Monitoring Interval:** 5 minutes
3. UptimeRobot will ping your bot every 5 minutes, keeping it awake!

### Option 2: Cron-job.org

1. Sign up at [cron-job.org](https://cron-job.org/) (free)
2. Create a new cron job:
   - **URL:** `https://your-service.onrender.com/health`
   - **Interval:** Every 5 minutes
3. Done!

### Option 3: Upgrade to Starter ($7/month)

Render's Starter plan never sleeps and includes:
- Always-on (no sleep)
- Faster cold starts
- More resources

## 📊 Monitoring

### View Logs
In Render dashboard:
- Go to your service
- Click **"Logs"** tab
- Watch for mentions being processed

### Check Stats
Visit: `https://your-service.onrender.com/stats`

You'll see:
- Total mentions processed
- Active games count
- Last check time
- Redis connection status
- Bot uptime

## 🐛 Troubleshooting

### Bot Not Responding to Tweets

**Check Twitter API Access:**
```bash
# In Render logs, look for:
"🎮 Gamemaker online as @YourBot"
```

If you see errors:
- Verify API credentials in environment variables
- Check Twitter Developer Portal for API access level
- Ensure API v2 is enabled

**Check Rate Limits:**
- Free Twitter API: 500K reads/month
- Monitor usage at [developer.twitter.com](https://developer.twitter.com/)

### Redis Connection Issues

**Verify Redis URL:**
```bash
# Should look like:
redis://:password@host:port
```

**Test Connection:**
The bot will log:
- ✅ `Using Redis for persistence (shared with main game)`
- ⚠️ `Could not connect to Redis... Falling back to file persistence`

If Redis fails, the bot uses file storage as backup (but won't persist across restarts).

### Service Keeps Sleeping

**Free Tier Behavior:**
- Sleeps after 15 minutes of no HTTP requests
- Takes 30-60 seconds to wake up

**Solutions:**
1. Set up UptimeRobot (see above)
2. Upgrade to Starter plan
3. Deploy on a different platform (Railway, Fly.io, etc.)

### Bot Running But Not Processing Mentions

**Check Polling:**
```bash
# Logs should show every 10 minutes:
"[2026-01-29 12:00:00] Scanning the arena… (last_id=...)"
```

**If not polling:**
- Check if bot thread crashed (look for Python errors)
- Restart the service in Render
- Verify Twitter API credentials

### High Memory Usage

The bot is lightweight, but if you see issues:
- Reduce `MAX_MENTIONS_PER_CYCLE` to 3
- Increase `CHECK_EVERY_SECONDS` to 900 (15 min)

## 🎯 Performance Tuning

### For High Traffic

If you have lots of players:

```bash
# Process more mentions per cycle
MAX_MENTIONS_PER_CYCLE=10

# Check more frequently
CHECK_EVERY_SECONDS=300
```

**Note:** This increases Twitter API usage!

### For Low Traffic / Rate Limit Conservation

```bash
# Process fewer mentions
MAX_MENTIONS_PER_CYCLE=3

# Check less frequently
CHECK_EVERY_SECONDS=1200
```

## 📈 Scaling Options

### Current Setup (Free Tier)
- **Cost:** $0
- **Uptime:** ~99% with UptimeRobot
- **Capacity:** Handles dozens of games
- **Rate Limit:** Twitter API free tier

### Starter Plan ($7/month)
- **Cost:** $7/month
- **Uptime:** 100% (always on)
- **Capacity:** Same (bot limited by Twitter API)
- **Benefits:** No cold starts

### Twitter API Pro ($100/month)
- **Rate Limits:** 1M reads/month
- **Better:** 300 requests per 15min window
- **Worth it:** Only for very popular bots

## 🔒 Security Best Practices

1. **Never commit .env file**
   - Use Render's environment variables
   - Keep credentials secret

2. **Rotate API keys regularly**
   - Update in Twitter Developer Portal
   - Update in Render dashboard

3. **Monitor for abuse**
   - Check `/stats` endpoint regularly
   - Look for unusual activity in logs

4. **Rate limit protection**
   - Bot automatically backs off on rate limits
   - Don't reduce `CHECK_EVERY_SECONDS` below 300

## 🎊 Success Checklist

- [x] Code deployed to GitHub
- [ ] Render web service created
- [ ] Environment variables configured
- [ ] Service deployed successfully
- [ ] Health endpoint returns 200
- [ ] Redis connection verified
- [ ] Bot responds to test tweet
- [ ] UptimeRobot monitoring set up (optional)
- [ ] Stats endpoint accessible

## 📞 Getting Help

**Render Issues:**
- Check [Render Status](https://status.render.com/)
- Read [Render Docs](https://render.com/docs)

**Twitter API Issues:**
- Check [Twitter API Status](https://api.twitterstat.us/)
- Read [Twitter API Docs](https://developer.twitter.com/en/docs)

**Bot Issues:**
- Check Render logs
- Visit `/stats` endpoint
- Test locally first

## 🎮 Next Steps

Once deployed:
1. Tweet announcement about your bot
2. Pin a tweet explaining how to play
3. Monitor the stats endpoint
4. Watch the logs for the first games
5. Have fun!

---

**May the odds be ever in your favor!** 🔥
