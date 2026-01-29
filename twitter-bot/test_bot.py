#!/usr/bin/env python3
"""
Test script for Gamemaker bot - validates core functionality
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

# Mock environment variables for testing
os.environ.setdefault('API_KEY', 'test_key')
os.environ.setdefault('API_SECRET', 'test_secret')
os.environ.setdefault('ACCESS_TOKEN', 'test_token')
os.environ.setdefault('ACCESS_SECRET', 'test_access_secret')
os.environ.setdefault('BOT_USERNAME', 'TestBot')

print("🧪 Testing Gamemaker Bot Core Functions\n")

# Import game functions (before Flask app starts)
from gamemaker_bot import (
    render_board, check_winner, is_full, 
    bot_move, contains_command, extract_move,
    EMPTY, X, O
)

# Test 1: Board rendering
print("✓ Test 1: Board Rendering")
test_board = [X, O, EMPTY, EMPTY, X, O, EMPTY, EMPTY, X]
rendered = render_board(test_board)
expected = f"{X}{O}{EMPTY}\n{EMPTY}{X}{O}\n{EMPTY}{EMPTY}{X}"
assert rendered == expected, f"Board render failed: {rendered}"
print(f"  Board renders correctly:\n{rendered}\n")

# Test 2: Win detection - horizontal
print("✓ Test 2: Win Detection - Horizontal")
win_board = [X, X, X, O, O, EMPTY, EMPTY, EMPTY, EMPTY]
assert check_winner(win_board, X) == True, "Horizontal win not detected"
assert check_winner(win_board, O) == False, "False positive win"
print("  Horizontal win detected correctly\n")

# Test 3: Win detection - vertical
print("✓ Test 3: Win Detection - Vertical")
win_board = [X, O, EMPTY, X, O, EMPTY, X, EMPTY, EMPTY]
assert check_winner(win_board, X) == True, "Vertical win not detected"
print("  Vertical win detected correctly\n")

# Test 4: Win detection - diagonal
print("✓ Test 4: Win Detection - Diagonal")
win_board = [X, O, O, EMPTY, X, EMPTY, O, EMPTY, X]
assert check_winner(win_board, X) == True, "Diagonal win not detected"
print("  Diagonal win detected correctly\n")

# Test 5: Full board detection
print("✓ Test 5: Full Board Detection")
full_board = [X, O, X, O, X, O, O, X, O]
assert is_full(full_board) == True, "Full board not detected"
empty_board = [X, O, EMPTY, O, X, O, O, X, O]
assert is_full(empty_board) == False, "Empty board detected as full"
print("  Full board detection works\n")

# Test 6: AI move selection
print("✓ Test 6: AI Move Selection")
test_board = [X, O, EMPTY, EMPTY, X, O, EMPTY, EMPTY, X]
move = bot_move(test_board)
assert move in [2, 3, 6, 7], f"AI selected invalid move: {move}"
assert test_board[move] == EMPTY, "AI tried to move on occupied square"
print(f"  AI selected valid move: position {move}\n")

# Test 7: Command detection
print("✓ Test 7: Command Detection")
assert contains_command("@bot start", ["start"]) == True, "Start command not detected"
assert contains_command("@bot PLAY NOW", ["play"]) == True, "Play command not detected (case)"
assert contains_command("let's start a game", ["start", "play"]) == True, "Start in sentence not detected"
assert contains_command("@bot hello", ["start", "play"]) == False, "False positive command"
print("  Command detection works correctly\n")

# Test 8: Move extraction
print("✓ Test 8: Move Extraction")
assert extract_move("I choose 5") == 4, "Failed to extract move 5"
assert extract_move("@bot 1") == 0, "Failed to extract move 1"
assert extract_move("9 please") == 8, "Failed to extract move 9"
assert extract_move("no numbers") == None, "False positive move extraction"
# Note: "123" extracts first digit "1" due to \b boundary in regex
assert extract_move("move 7") == 6, "Failed to extract move with text"
print("  Move extraction works correctly\n")

# Test 9: Game flow simulation
print("✓ Test 9: Full Game Simulation")
board = [EMPTY] * 9
moves = [(0, X), (1, O), (4, X), (2, O), (8, X)]  # X wins diagonal
for pos, mark in moves:
    board[pos] = mark
    if check_winner(board, mark):
        print(f"  Winner detected: {mark}")
        break
assert check_winner(board, X) == True, "Game flow test failed"
print(f"  Final board:\n{render_board(board)}\n")

# Test 10: State management (basic)
print("✓ Test 10: State Management")
from gamemaker_bot import load_state, save_state
test_state = {"games": {"123": {"board": board, "status": "ended"}}, "last_tweet_id": "999"}
save_state(test_state)
loaded_state = load_state()
assert loaded_state["last_tweet_id"] == "999", "State not saved/loaded correctly"
print("  State save/load works (file fallback)\n")

print("=" * 60)
print("🎉 ALL TESTS PASSED!")
print("=" * 60)
print("\n📋 Summary:")
print("  ✓ Board rendering")
print("  ✓ Win detection (all directions)")
print("  ✓ Full board detection")
print("  ✓ AI move selection")
print("  ✓ Command parsing")
print("  ✓ Move extraction")
print("  ✓ Game flow")
print("  ✓ State management")
print("\n🚀 Bot core functionality is working correctly!")
print("\n💡 Next Steps:")
print("  1. Set up Twitter API credentials in .env")
print("  2. Deploy to Render")
print("  3. Set up UptimeRobot for keep-alive")
print("  4. Test with real Twitter mentions")
print("\n🔥 May the odds be ever in your favor!")
