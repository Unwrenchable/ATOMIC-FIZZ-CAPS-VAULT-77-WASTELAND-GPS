# 🎮 9D Tic Tac Toe Twitter Bot - @9dtictactoe

An interactive Tic-Tac-Toe Twitter bot for playing games on Twitter/X.

**Bot Account:** [@9dtictactoe](https://twitter.com/9dtictactoe)  
**Website:** [9DTTT.COM](https://9DTTT.COM)  
**GitHub:** [github.com/9dtictactoe](https://github.com/9dtictactoe)

## 🌟 Features

- **Interactive Tic-Tac-Toe on Twitter** - Play against the bot AI
- **Persistent State** - Uses Redis or file storage for game persistence
- **Never Sleeps** - Flask web server keeps Render service alive 24/7
- **Health Monitoring** - Built-in health check and stats endpoints
- **Rate Limit Handling** - Automatic backoff and retry logic

## 🚀 Deployment on Render

### Prerequisites

1. Twitter Developer Account with API v2 access
2. Redis instance (optional - uses file storage fallback)
3. Render account

### Setup Instructions

1. **Create a new Web Service on Render**
   - Connect your GitHub repository
   - Set the root directory to `twitter-bot`
   - Build command: `pip install -r requirements.txt`
   - Start command: `python gamemaker_bot.py`

2. **Configure Environment Variables**
   
   Add these in Render's dashboard:
   
   ```bash
   # Twitter API (get from developer.twitter.com)
   API_KEY=your_twitter_api_key
   API_SECRET=your_twitter_api_secret
   ACCESS_TOKEN=your_twitter_access_token
   ACCESS_SECRET=your_twitter_access_secret
   
   # Bot Settings
   BOT_USERNAME=9dtictactoe
   CHECK_EVERY_SECONDS=600
   MAX_MENTIONS_PER_CYCLE=5
   
   # Redis (Optional)
   REDIS_URL=redis://:password@your-redis-host:6379
   
   # Render auto-sets PORT
   ```

3. **Deploy**
   - Click "Create Web Service"
   - Render will deploy and keep it running 24/7

## 🎯 How to Play

### Starting a Game
Tweet at your bot with any of:
- `@9dtictactoe start`
- `@9dtictactoe play`
- `@9dtictactoe new game`
- `@9dtictactoe enter arena`

### Making Moves
Reply with a number 1-9 to claim a square:
```
1 2 3
4 5 6
7 8 9
```

### Quitting
Reply with:
- `stop`
- `quit`
- `end game`

## 📊 Monitoring Endpoints

The bot exposes several endpoints for monitoring:

- `GET /` - General status and uptime
- `GET /health` - Health check (returns 200 if alive)
- `GET /ping` - Simple ping endpoint
- `GET /stats` - Detailed statistics

Example: `https://your-bot.onrender.com/stats`

## 🔧 Local Development

1. **Install dependencies**
   ```bash
   cd twitter-bot
   pip install -r requirements.txt
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Run the bot**
   ```bash
   python gamemaker_bot.py
   ```

4. **Test endpoints**
   ```bash
   curl http://localhost:10000/health
   ```

## 🧪 Testing

Test the bot without deploying:

```bash
# Check syntax
python -m py_compile gamemaker_bot.py

# Run locally
python gamemaker_bot.py
```

## 📝 Redis Integration

The bot reuses your existing Redis instance from the main ATOMIC FIZZ CAPS game:

- **Key namespace**: `gm:state` - Stores all bot game state
- **No conflicts**: Uses separate keys from the main game
- **Shared infrastructure**: Efficient resource usage
- **Automatic fallback**: Uses file storage if Redis unavailable

## 🎮 Game Features

- **Human vs AI** - You play as ❌, Gamemaker plays as ⭕
- **Smart AI** - Random move selection (keeps it fun!)
- **Multiple concurrent games** - Each Twitter thread is a separate game
- **Game persistence** - Resume after restarts
- **Dramatic responses** - Hunger Games themed messages

## 🛡️ Rate Limiting

Twitter API rate limits are automatically handled:
- Free tier: 500K reads/month
- Automatic backoff on rate limit errors
- Configurable check interval (default: 600 seconds)
- Batch processing (max 5 mentions per cycle)

## 🔥 Keep-Alive Strategy

Render's free tier sleeps after 15 minutes of inactivity. This bot stays awake by:

1. **Flask Web Server** - Always listening on PORT
2. **Health Endpoints** - Render can ping to keep alive
3. **Continuous Operation** - Twitter polling loop runs forever
4. **Thread Architecture** - Bot runs in background thread

### Optional: External Ping Service

For extra reliability, set up a free service like [UptimeRobot](https://uptimerobot.com/) to ping your `/health` endpoint every 5 minutes.

## 📚 API Response Examples

### Health Check
```json
{
  "status": "healthy",
  "timestamp": "2026-01-29T12:00:00",
  "active_games": 3,
  "redis_connected": true
}
```

### Stats
```json
{
  "started_at": "2026-01-29T10:00:00",
  "total_mentions_processed": 127,
  "active_games": 3,
  "last_check": "2026-01-29T12:00:00",
  "status": "running",
  "redis_connected": true,
  "bot_username": "9dtictactoe"
}
```

## 🎪 Personality Examples

**Game Start:**
> Welcome to the arena, tribute! You = ❌   Gamemaker = ⭕
> May the odds be ever in your favor…
> Reply with 1–9 to claim your square.
> Let the games begin! 🔥

**During Game:**
> A cunning strike… The board trembles.
> ⬜❌⭕
> ⬜⬜⬜
> ⬜⬜⬜
> Your move, tribute. (1–9)

**Victory:**
> …Impossible. You have bested the Gamemaker.
> Victory is yours… for now. 🎉

## 🐛 Troubleshooting

**Bot not responding?**
- Check Twitter API credentials
- Verify bot has API v2 access
- Check Render logs for errors

**Redis errors?**
- Verify REDIS_URL is correct
- Check Redis instance is running
- Bot will fall back to file storage

**Rate limited?**
- Increase CHECK_EVERY_SECONDS
- Decrease MAX_MENTIONS_PER_CYCLE
- Check Twitter API dashboard

## 📦 Dependencies

- `tweepy` - Twitter API v2 client
- `flask` - Web server framework
- `redis` - Redis client (optional)
- `python-dotenv` - Environment variable management
- `gunicorn` - Production WSGI server (if needed)

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│         Gamemaker Twitter Bot           │
├─────────────────────────────────────────┤
│  Flask Web Server (Port 10000)          │
│  ├─ / (status)                          │
│  ├─ /health (health check)              │
│  ├─ /ping (keep-alive)                  │
│  └─ /stats (monitoring)                 │
├─────────────────────────────────────────┤
│  Twitter Bot Thread                     │
│  ├─ Poll mentions                       │
│  ├─ Process commands                    │
│  ├─ Manage games                        │
│  └─ Send responses                      │
├─────────────────────────────────────────┤
│  State Management                       │
│  ├─ Redis (shared with main game)      │
│  └─ File fallback (games.json)         │
└─────────────────────────────────────────┘
```

## 📄 License

Part of the ATOMIC FIZZ CAPS project.

## 🎉 Credits

Built for the ATOMIC FIZZ CAPS Vault-77 Wasteland GPS game.
May the odds be ever in your favor! 🔥
