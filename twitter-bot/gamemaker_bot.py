#!/usr/bin/env python3
"""
Gamemaker Twitter bot with Flask server for Render deployment

Usage:
- Fill environment variables (API_KEY, API_SECRET, ACCESS_TOKEN, ACCESS_SECRET)
- Set REDIS_URL to use the same Redis instance as the main game
- Flask web server runs on PORT (default 10000) to keep Render service alive

This bot REUSES your existing Redis instance from the ATOMIC FIZZ CAPS game!
It uses a separate key namespace (gm:state) so it won't interfere with game data.
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
except Exception:
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
        "service": "Gamemaker Twitter Bot",
        "message": "The arena is active. May the odds be ever in your favor! 🎮",
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
BOT_USERNAME = os.getenv("BOT_USERNAME", "9dTic60428").lstrip("@")
CHECK_EVERY_SECONDS = int(os.getenv("CHECK_EVERY_SECONDS", "600"))
MAX_MENTIONS_PER_CYCLE = int(os.getenv("MAX_MENTIONS_PER_CYCLE", "5"))

# ────────────────────────────────────────
#  GAME STATE (persisted)
# ────────────────────────────────────────
EMPTY = "⬜"
X = "❌"    # human
O = "⭕"    # bot

WIN_COMBOS = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
]

GAMES_PATH = Path("games.json")
STATE_KEY = "gm:state"   # Redis key (stores JSON with games and last_tweet_id)

# ────────────────────────────────────────
#  Personality lines (unchanged)
# ────────────────────────────────────────
GM_LINES = {
    "start": [
        "Welcome to the arena, tribute! You = ❌   Gamemaker = ⭕\nMay the odds be ever in your favor…\nReply with 1–9 to claim your square.\nLet the games begin! 🔥",
        "A new player enters the Games… Bold choice.\nYou play as ❌. Make your first move, tribute. 1–9.",
        "The cannon sounds. The arena awaits.\nPlace your mark (1–9), or perish. ⏳"
    ],
    "move_ok": [
        "A cunning strike… The board trembles.",
        "Impressive, tribute. But the Gamemaker is watching.",
        "Your move is registered. Now… witness mine."
    ],
    "invalid": [
        "Foolish tribute. That square is already claimed.",
        "The arena rejects your plea. Choose an empty cell (1–9).",
        "Such insolence… Try again, if you dare."
    ],
    "human_win": [
        "…Impossible. You have bested the Gamemaker.\nVictory is yours… for now. 🎉",
        "The crowd roars! A rare upset in the arena.\nYou win, tribute. Magnificent."
    ],
    "bot_win": [
        "The odds were never in your favor.\nThe Gamemaker claims victory. 😈",
        "Another tribute falls… Delicious.",
        "Game over. Better luck in the next Games."
    ],
    "draw": [
        "A stalemate… How dreadfully dull.\nNo victor today. The arena is displeased.",
        "Neither triumphs. The Capitol is not amused."
    ],
    "quit": [
        "The tribute flees the arena… Cowardice noted.\nGame terminated. You may return… if you grow braver."
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

def gamemaker_move(board):
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
        s = redis_client.get(STATE_KEY)
        if s:
            return json.loads(s)
        return {"games": {}, "last_tweet_id": None}
    else:
        if not GAMES_PATH.exists():
            return {"games": {}, "last_tweet_id": None}
        try:
            return json.loads(GAMES_PATH.read_text(encoding="utf-8"))
        except Exception:
            return {"games": {}, "last_tweet_id": None}

def save_state(state):
    if use_redis:
        redis_client.set(STATE_KEY, json.dumps(state, ensure_ascii=False))
        return
    # atomic file write
    tmp = None
    try:
        fd, tmp = tempfile.mkstemp(prefix="games-", suffix=".json")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(state, f, ensure_ascii=False)
        Path(tmp).replace(GAMES_PATH)
    finally:
        if tmp and Path(tmp).exists():
            try:
                os.remove(tmp)
            except Exception:
                pass

# ────────────────────────────────────────
#  Twitter Bot Logic
# ────────────────────────────────────────
def run_twitter_bot():
    """Main Twitter bot loop running in a separate thread"""
    global bot_stats
    
    # API SETUP (Tweepy Client v4)
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
            print(f"[{datetime.now()}] Scanning the arena… (last_id={last_tweet_id})")

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
                last_tweet_id = max(int(last_tweet_id) if last_tweet_id else 0, newest)

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
                        except Exception:
                            author_username = str(tweet.author_id)

                    # Quick opt-out / quit
                    if contains_command(text, ["stop", "quit", "end game", "unsubscribe", "no more"]):
                        if str(conv_id) in games:
                            del games[str(conv_id)]
                        reply_text = f"@{author_username} {random.choice(GM_LINES['quit'])}"
                        client.create_tweet(text=reply_text[:280], in_reply_to_tweet_id=tweet.id)
                        continue

                    # Start game
                    if contains_command(text, ["start", "new game", "play", "enter arena", "begin", "let the games"]):
                        if str(conv_id) in games:
                            reply_text = f"@{author_username} The Games are already underway in this thread, tribute."
                        else:
                            board = [EMPTY] * 9
                            games[str(conv_id)] = {
                                "board": board,
                                "player": X,  # human starts
                                "status": "active",
                                "last_tweet_id": tweet.id
                            }
                            reply_text = f"@{author_username} {random.choice(GM_LINES['start'])}\n\n{render_board(board)}"
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
                            reply_text = f"@{author_username} Speak clearly, tribute. Reply with a number 1–9.\n\n{render_board(board)}"
                            client.create_tweet(text=reply_text[:280], in_reply_to_tweet_id=tweet.id)
                            continue

                        if not (0 <= pos < 9) or board[pos] != EMPTY:
                            reply_text = f"@{author_username} {random.choice(GM_LINES['invalid'])}\n\n{render_board(board)}"
                            client.create_tweet(text=reply_text[:280], in_reply_to_tweet_id=tweet.id)
                            continue

                        # Apply human move
                        board[pos] = X
                        game["last_tweet_id"] = tweet.id

                        board_str = render_board(board)

                        if check_winner(board, X):
                            game["status"] = "ended"
                            reply_text = f"@{author_username} {random.choice(GM_LINES['human_win'])}\n\n{board_str}\nReply 'start' for a new arena."
                            client.create_tweet(text=reply_text[:280], in_reply_to_tweet_id=tweet.id)
                            save_state({"games": games, "last_tweet_id": str(last_tweet_id)})
                            bot_stats["active_games"] = len([g for g in games.values() if g.get("status") == "active"])
                            continue
                        elif is_full(board):
                            game["status"] = "ended"
                            reply_text = f"@{author_username} {random.choice(GM_LINES['draw'])}\n\n{board_str}\nA new challenge awaits – say 'start'."
                            client.create_tweet(text=reply_text[:280], in_reply_to_tweet_id=tweet.id)
                            save_state({"games": games, "last_tweet_id": str(last_tweet_id)})
                            bot_stats["active_games"] = len([g for g in games.values() if g.get("status") == "active"])
                            continue

                        # Gamemaker moves
                        gm_pos = gamemaker_move(board)
                        if gm_pos is not None:
                            board[gm_pos] = O
                            board_str = render_board(board)

                            if check_winner(board, O):
                                game["status"] = "ended"
                                reply_text = f"@{author_username} {random.choice(GM_LINES['bot_win'])}\n\n{board_str}\nReply 'start' if you dare return."
                            elif is_full(board):
                                game["status"] = "ended"
                                reply_text = f"@{author_username} {random.choice(GM_LINES['draw'])}\n\n{board_str}"
                            else:
                                reply_text = f"@{author_username} {random.choice(GM_LINES['move_ok'])}\n\n{board_str}\nYour move, tribute. (1–9)"
                        else:
                            # Shouldn't happen (board full checked above)
                            reply_text = f"@{author_username} The arena is silent…\n\n{board_str}"

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
#  MAIN ENTRY POINT
# ────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("🎮 GAMEMAKER TWITTER BOT - ATOMIC FIZZ CAPS")
    print("=" * 60)
    print(f"Redis URL: {REDIS_URL[:30] + '...' if REDIS_URL and len(REDIS_URL) > 30 else 'Not configured'}")
    print(f"Check interval: {CHECK_EVERY_SECONDS} seconds")
    print(f"Max mentions per cycle: {MAX_MENTIONS_PER_CYCLE}")
    print("=" * 60)
    
    # Start Twitter bot in a separate thread
    bot_thread = threading.Thread(target=run_twitter_bot, daemon=True)
    bot_thread.start()
    
    # Start Flask server (keeps Render awake!)
    port = int(os.getenv("PORT", "10000"))
    print(f"🌐 Starting Flask server on port {port}...")
    print("🔥 The Gamemaker is ready. The arena awaits!")
    print("=" * 60)
    
    # Run Flask app
    app.run(host="0.0.0.0", port=port, debug=False)
