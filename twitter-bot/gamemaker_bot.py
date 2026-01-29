#!/usr/bin/env python3
"""
9D Tic Tac Toe Twitter bot with Flask server for Render deployment

Usage:
- Fill environment variables (API_KEY, API_SECRET, ACCESS_TOKEN, ACCESS_SECRET)
- Set REDIS_URL for game state persistence
- Flask web server runs on PORT (default 10000) to keep Render service alive

Bot for @9dtictactoe - Play 9D Tic Tac Toe on Twitter!
Website: https://9DTTT.COM
"""
import os
import time
import random
import json
import re
import tempfile
import threading
from pathlib import Path
from datetime import datetime

from dotenv import load_dotenv
load_dotenv()

import tweepy
from flask import Flask, jsonify

# Optional Redis (used if REDIS_URL is set)
try:
    import redis
except ImportError:
    redis = None

# ────────────────────────────────────────
#  FLASK WEB SERVER - Keeps Render awake!
# ────────────────────────────────────────
app = Flask(__name__)

# Global stats for monitoring
bot_stats = {
    "started_at": datetime.now().isoformat(),
    "total_mentions_processed": 0,
    "active_games": 0,
    "last_check": None,
    "status": "initializing",
    "redis_connected": False
}

@app.route('/')
def home():
    """Health check endpoint"""
    uptime_seconds = (datetime.now() - datetime.fromisoformat(bot_stats["started_at"])).total_seconds()
    return jsonify({
        "status": "alive",
        "service": "9D Tic Tac Toe Twitter Bot",
        "message": "Play 9D Tic Tac Toe on Twitter! @9dtictactoe 🎮",
        "website": "https://9DTTT.COM",
        "uptime_seconds": uptime_seconds,
        "uptime_human": f"{int(uptime_seconds // 3600)}h {int((uptime_seconds % 3600) // 60)}m",
        "stats": bot_stats
    })

@app.route('/health')
def health():
    """Health check for Render"""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "active_games": bot_stats["active_games"],
        "redis_connected": bot_stats["redis_connected"]
    }), 200

@app.route('/ping')
def ping():
    """Simple ping endpoint"""
    return "pong", 200

@app.route('/stats')
def stats():
    """Detailed stats endpoint"""
    return jsonify(bot_stats)

# ────────────────────────────────────────
#  CONFIG – Basic tier safe
# ────────────────────────────────────────
BOT_USERNAME = os.getenv("BOT_USERNAME", "9dtictactoe").lstrip("@")
CHECK_EVERY_SECONDS = int(os.getenv("CHECK_EVERY_SECONDS", "600"))
MAX_MENTIONS_PER_CYCLE = int(os.getenv("MAX_MENTIONS_PER_CYCLE", "5"))

# ────────────────────────────────────────
#  GAME STATE (persisted)
# ────────────────────────────────────────
EMPTY = "⬜"
X = "❌"    # human player
O = "⭕"    # bot player

WIN_COMBOS = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
]

GAMES_PATH = Path("games.json")
STATE_KEY = "9dttt:state"   # Redis key (stores JSON with games and last_tweet_id)

# ────────────────────────────────────────
#  Personality lines - 9D Tic Tac Toe themed
# ────────────────────────────────────────
BOT_MESSAGES = {
    "start": [
        "🎮 Welcome to 9D Tic Tac Toe! You play as ❌, I play as ⭕\nThink strategically across dimensions! Reply with 1–9 to make your move.\nLet's explore the multiverse of strategy! ✨",
        "⚡ A new challenger enters the dimensional grid!\nYou = ❌, Bot = ⭕\nEvery move ripples across the strategic plane. Choose 1–9 to begin! 🎯",
        "🌌 Welcome to the ultimate strategy challenge!\nPlace your mark (1–9) and let's see how deep your tactical thinking goes.\nIn 9D TTT, every move matters! 🧠"
    ],
    "move_ok": [
        "🎯 Brilliant tactical positioning! The board shifts in your favor...",
        "✨ Nice move! I can see you're thinking dimensionally.",
        "🧠 Strategic! Your move has been registered. Now witness my counter-strategy..."
    ],
    "invalid": [
        "⚠️ That square is already occupied! Choose an empty cell (1–9).",
        "🤔 Oops! That space is taken. Try another position 1–9.",
        "💡 Strategy tip: Pick an available square marked with ⬜ (1–9)."
    ],
    "human_win": [
        "🎉 VICTORY! You've mastered the dimensional grid!\nYour strategic thinking was flawless. Want to go again? 🏆",
        "👑 Incredible! You've conquered the 9D challenge!\nYour tactical prowess is impressive. Ready for another round? ✨"
    ],
    "bot_win": [
        "🤖 I win this round! But your strategy was solid.\nWant to try again? Every game makes you sharper! 💪",
        "✨ Victory is mine this time! But you're learning fast.\nReady for a rematch? The grid awaits! 🎮",
        "🎯 Game over! That was a great match.\nYour next game will be even better. Play again? 🔄"
    ],
    "draw": [
        "🤝 A perfect stalemate! Our strategies were evenly matched.\nThat's the beauty of 9D TTT. Another round? ⚖️",
        "⚡ Draw! Both players played brilliantly.\nIn the multiverse of possibilities, we found perfect balance. Again? 🌌"
    ],
    "quit": [
        "👋 Thanks for playing 9D Tic Tac Toe!\nCome back anytime for another strategic challenge. See you in the grid! 🎮"
    ]
}

# ────────────────────────────────────────
#  Helpers: render/check/AI move
# ────────────────────────────────────────
def render_board(board):
    return (
        f"{board[0]}{board[1]}{board[2]}\n"
        f"{board[3]}{board[4]}{board[5]}\n"
        f"{board[6]}{board[7]}{board[8]}"
    )

def check_winner(board, mark):
    return any(all(board[i] == mark for i in combo) for combo in WIN_COMBOS)

def is_full(board):
    return all(c != EMPTY for c in board)

def bot_move(board):
    """Select bot's next move - currently random selection"""
    empty = [i for i, c in enumerate(board) if c == EMPTY]
    return random.choice(empty) if empty else None

# Robust command matching and digit extraction
def contains_command(text, words):
    pattern = r"\b(?:" + "|".join(re.escape(w) for w in words) + r")\b"
    return bool(re.search(pattern, text, flags=re.I))

def extract_move(text):
    m = re.search(r"\b([1-9])\b", text)
    if m:
        return int(m.group(1)) - 1
    return None

# ────────────────────────────────────────
#  Persistence: Redis or file fallback
#  REUSES your existing game Redis!
# ────────────────────────────────────────
REDIS_URL = os.getenv("REDIS_URL")

redis_client = None
use_redis = False
if REDIS_URL and redis:
    try:
        redis_client = redis.from_url(REDIS_URL, decode_responses=True)
        # quick check
        redis_client.ping()
        use_redis = True
        bot_stats["redis_connected"] = True
        print("✅ Using Redis for persistence (shared with main game).")
    except Exception as e:
        print(f"⚠️  Could not connect to Redis at REDIS_URL: {e}. Falling back to file persistence.")
        bot_stats["redis_connected"] = False

def load_state():
    if use_redis:
        try:
            s = redis_client.get(STATE_KEY)
            if s:
                return json.loads(s)
        except (redis.RedisError, json.JSONDecodeError) as e:
            print(f"⚠️  Error loading state from Redis: {e}. Using default state.")
        except Exception as e:
            print(f"⚠️  Unexpected error loading state: {e}. Using default state.")
        return {"games": {}, "last_tweet_id": None}
    else:
        if not GAMES_PATH.exists():
            return {"games": {}, "last_tweet_id": None}
        try:
            return json.loads(GAMES_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print(f"⚠️  Error parsing games.json: {e}. Using default state.")
            return {"games": {}, "last_tweet_id": None}
        except Exception as e:
            print(f"⚠️  Error reading games.json: {e}. Using default state.")
            return {"games": {}, "last_tweet_id": None}

def save_state(state):
    if use_redis:
        try:
            redis_client.set(STATE_KEY, json.dumps(state, ensure_ascii=False))
        except redis.RedisError as e:
            print(f"⚠️  Error saving state to Redis: {e}. State not persisted.")
        except Exception as e:
            print(f"⚠️  Unexpected error saving state: {e}. State not persisted.")
        return
    # atomic file write
    tmp = None
    try:
        fd, tmp = tempfile.mkstemp(prefix="games-", suffix=".json")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False)
        Path(tmp).replace(GAMES_PATH)
    except Exception as e:
        print(f"⚠️  Error saving state to file: {e}. State not persisted.")
    finally:
        if tmp and Path(tmp).exists():
            try:
                os.remove(tmp)
            except OSError:
                pass  # Cleanup failed, not critical

# ────────────────────────────────────────
#  Twitter Bot Logic
# ────────────────────────────────────────
def run_twitter_bot():
    """Main Twitter bot loop running in a separate thread"""
    global bot_stats
    
    # Validate required environment variables
    required_vars = ['API_KEY', 'API_SECRET', 'ACCESS_TOKEN', 'ACCESS_SECRET']
    missing = [var for var in required_vars if not os.getenv(var)]
    if missing:
        error_msg = f"❌ Missing required environment variables: {', '.join(missing)}"
        print(error_msg)
        bot_stats["status"] = "error"
        bot_stats["error"] = error_msg
        return
    
    # API SETUP (Tweepy Client v4)
    try:
        client = tweepy.Client(
            consumer_key=os.getenv("API_KEY"),
            consumer_secret=os.getenv("API_SECRET"),
            access_token=os.getenv("ACCESS_TOKEN"),
            access_token_secret=os.getenv("ACCESS_SECRET"),
            wait_on_rate_limit=True
        )

        me = client.get_me(user_auth=True).data
        bot_id = me.id
        print(f"🎮 Gamemaker online as @{me.username} (ID: {bot_id})")
    except Exception as e:
        error_msg = f"❌ Failed to authenticate with Twitter API: {e}"
        print(error_msg)
        bot_stats["status"] = "error"
        bot_stats["error"] = error_msg
        return
    
    bot_stats["status"] = "running"
    bot_stats["bot_username"] = me.username

    # Load persisted state
    state = load_state()
    games = state.get("games", {})
    last_tweet_id = state.get("last_tweet_id")
    
    bot_stats["active_games"] = len([g for g in games.values() if g.get("status") == "active"])

    from tweepy.errors import TooManyRequests, TweepyException

    while True:
        try:
            bot_stats["last_check"] = datetime.now().isoformat()
            print(f"[{datetime.now()}] Scanning for new challenges… (last_id={last_tweet_id})")

            mentions = client.get_users_mentions(
                id=bot_id,
                since_id=last_tweet_id,
                tweet_fields=["conversation_id", "created_at", "author_id"],
                expansions=["author_id"],
                user_fields=["username"],
                max_results=MAX_MENTIONS_PER_CYCLE,
                user_auth=True
            )

            if mentions and getattr(mentions, "data", None):
                # update last_tweet_id to the newest processed id
                ids = [int(t.id) for t in mentions.data]
                newest = max(ids)
                # Handle both int and string last_tweet_id safely
                try:
                    current_last = int(last_tweet_id) if last_tweet_id else 0
                except (ValueError, TypeError):
                    print(f"⚠️  Invalid last_tweet_id: {last_tweet_id}, resetting to 0")
                    current_last = 0
                last_tweet_id = max(current_last, newest)

                # build author map from includes
                author_map = {}
                if getattr(mentions, "includes", None):
                    inc = mentions.includes
                    users = inc.get("users") if isinstance(inc, dict) else getattr(inc, "users", None)
                    if users:
                        for u in users:
                            author_map[str(u.id)] = u.username

                for tweet in mentions.data:
                    bot_stats["total_mentions_processed"] += 1
                    conv_id = tweet.conversation_id
                    raw_text = tweet.text or ""
                    text = raw_text.lower().strip()

                    author_username = author_map.get(str(tweet.author_id))
                    if not author_username:
                        # fallback: request user (rare, costly)
                        try:
                            u = client.get_user(id=tweet.author_id, user_auth=True).data
                            author_username = u.username if u else str(tweet.author_id)
                        except tweepy.TweepyException as e:
                            print(f"⚠️  Could not fetch user {tweet.author_id}: {e}")
                            author_username = str(tweet.author_id)
                        except Exception as e:
                            print(f"⚠️  Unexpected error fetching user: {e}")
                            author_username = str(tweet.author_id)

                    # Quick opt-out / quit
                    if contains_command(text, ["stop", "quit", "end game", "unsubscribe", "no more"]):
                        if str(conv_id) in games:
                            del games[str(conv_id)]
                        reply_text = f"@{author_username} {random.choice(BOT_MESSAGES['quit'])}"
                        client.create_tweet(text=reply_text[:280], in_reply_to_tweet_id=tweet.id)
                        continue

                    # Start game
                    if contains_command(text, ["start", "new game", "play", "challenge", "begin", "let's play"]):
                        if str(conv_id) in games:
                            reply_text = f"@{author_username} A game is already in progress in this thread! Finish this one first or start a new thread."
                        else:
                            board = [EMPTY] * 9
                            games[str(conv_id)] = {
                                "board": board,
                                "player": X,  # human starts
                                "status": "active",
                                "last_tweet_id": tweet.id
                            }
                            reply_text = f"@{author_username} {random.choice(BOT_MESSAGES['start'])}\n\n{render_board(board)}"
                        client.create_tweet(text=reply_text[:280], in_reply_to_tweet_id=tweet.id)
                        # persist after state change
                        save_state({"games": games, "last_tweet_id": str(last_tweet_id)})
                        bot_stats["active_games"] = len([g for g in games.values() if g.get("status") == "active"])
                        continue

                    # In-game move
                    if str(conv_id) in games and games[str(conv_id)]["status"] == "active":
                        game = games[str(conv_id)]
                        board = game["board"]

                        pos = extract_move(raw_text)
                        if pos is None:
                            reply_text = f"@{author_username} Please reply with a number 1–9 to make your move.\n\n{render_board(board)}"
                            client.create_tweet(text=reply_text[:280], in_reply_to_tweet_id=tweet.id)
                            continue

                        if not (0 <= pos < 9) or board[pos] != EMPTY:
                            reply_text = f"@{author_username} {random.choice(BOT_MESSAGES['invalid'])}\n\n{render_board(board)}"
                            client.create_tweet(text=reply_text[:280], in_reply_to_tweet_id=tweet.id)
                            continue

                        # Apply human move
                        board[pos] = X
                        game["last_tweet_id"] = tweet.id

                        board_str = render_board(board)

                        if check_winner(board, X):
                            game["status"] = "ended"
                            reply_text = f"@{author_username} {random.choice(BOT_MESSAGES['human_win'])}\n\n{board_str}\nReply 'start' for a new game!"
                            client.create_tweet(text=reply_text[:280], in_reply_to_tweet_id=tweet.id)
                            save_state({"games": games, "last_tweet_id": str(last_tweet_id)})
                            bot_stats["active_games"] = len([g for g in games.values() if g.get("status") == "active"])
                            continue
                        elif is_full(board):
                            game["status"] = "ended"
                            reply_text = f"@{author_username} {random.choice(BOT_MESSAGES['draw'])}\n\n{board_str}\nReady for another strategic challenge? Say 'start'!"
                            client.create_tweet(text=reply_text[:280], in_reply_to_tweet_id=tweet.id)
                            save_state({"games": games, "last_tweet_id": str(last_tweet_id)})
                            bot_stats["active_games"] = len([g for g in games.values() if g.get("status") == "active"])
                            continue

                        # Bot moves
                        bot_pos = bot_move(board)
                        if bot_pos is not None:
                            board[bot_pos] = O
                            board_str = render_board(board)

                            if check_winner(board, O):
                                game["status"] = "ended"
                                reply_text = f"@{author_username} {random.choice(BOT_MESSAGES['bot_win'])}\n\n{board_str}\nReply 'start' for another match!"
                            elif is_full(board):
                                game["status"] = "ended"
                                reply_text = f"@{author_username} {random.choice(BOT_MESSAGES['draw'])}\n\n{board_str}"
                            else:
                                reply_text = f"@{author_username} {random.choice(BOT_MESSAGES['move_ok'])}\n\n{board_str}\nYour turn! Reply with 1–9."
                        else:
                            # Shouldn't happen (board full checked above)
                            reply_text = f"@{author_username} Game complete!\n\n{board_str}"

                        client.create_tweet(text=reply_text[:280], in_reply_to_tweet_id=tweet.id)
                        save_state({"games": games, "last_tweet_id": str(last_tweet_id)})
                        bot_stats["active_games"] = len([g for g in games.values() if g.get("status") == "active"])

            # persist last_tweet_id even if no mentions processed (keeps state current)
            save_state({"games": games, "last_tweet_id": str(last_tweet_id) if last_tweet_id else None})

            time.sleep(CHECK_EVERY_SECONDS)

        except TooManyRequests as e:
            print(f"[{datetime.now()}] Rate limited by Twitter API: {e}. Backing off 15 minutes.")
            time.sleep(900)
        except TweepyException as e:
            print(f"Arena disturbance (TweepyException): {e}")
            time.sleep(60)
        except Exception as e:
            print(f"Arena disturbance (unexpected): {e}")
            import traceback
            traceback.print_exc()
            time.sleep(60)

# ────────────────────────────────────────
#  MAIN ENTRY POINT & BOT INITIALIZATION
# ────────────────────────────────────────

# Start bot thread when module is loaded (works with both gunicorn and direct run)
print("=" * 60)
print("🎮 9D TIC TAC TOE TWITTER BOT - @9dtictactoe")
print("=" * 60)
print(f"Website: https://9DTTT.COM")
print(f"Redis URL: {REDIS_URL[:30] + '...' if REDIS_URL and len(REDIS_URL) > 30 else 'Not configured'}")
print(f"Check interval: {CHECK_EVERY_SECONDS} seconds")
print(f"Max mentions per cycle: {MAX_MENTIONS_PER_CYCLE}")
print("=" * 60)

# Start Twitter bot in a separate thread
bot_thread = threading.Thread(target=run_twitter_bot, daemon=True)
bot_thread.start()

if __name__ == "__main__":
    # Direct run mode (development)
    port = int(os.getenv("PORT", "10000"))
    print(f"🌐 Starting Flask development server on port {port}...")
    print("🎮 9D Tic Tac Toe Bot is ready!")
    print("=" * 60)
    
    # Run Flask app
    app.run(host="0.0.0.0", port=port, debug=False)
