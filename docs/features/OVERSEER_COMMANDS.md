# 🎮 OVERSEER BOT - QUICK COMMAND REFERENCE

> 📟 **For the complete Overseer experience, see: [VAULT 77 OVERSEER - THE COMPLETE GUIDE](VAULT_77_OVERSEER_COMPLETE_GUIDE.md)**

---

## 🕹️ GAMES

| Command | Description |
|---------|-------------|
| `redmenace` | Start Red Menace arcade game (space shooter) |
| `rm` | Shortcut for Red Menace |
| `redmenace.stop` | Quit Red Menace |
| `ttt start` | Start Tic-Tac-Toe vs Overseer AI |
| `ttt [1-9]` | Place your X in position 1-9 |
| `ttt stats` | View your win/loss record |
| `ttt quit` | Quit Tic-Tac-Toe |
| `games` | List all available games |

## 🎪 ENTERTAINMENT

| Command | Description |
|---------|-------------|
| `jokes` | Tell a wasteland joke |
| `fortune` | Get your wasteland fortune |
| `trivia` | Test your Fallout knowledge |
| `hint` | Get a hint for current trivia question |
| `answer [text]` | Answer trivia question |
| `ascii` | Display Vault-Boy ASCII art |

## 🎯 GAME INFO

| Command | Description |
|---------|-------------|
| `status` | View player stats |
| `inventory` | View inventory |
| `map` / `scan` | Scan nearby locations |
| `quest` | View quest log |
| `whereami` | Current location |
| `caps` | Check CAPS balance |

## ⚙️ SYSTEMS

| Command | Description |
|---------|-------------|
| `zones` | List experimental zones |
| `bridge` | Access bridge portal (wormhole) |
| `bridge.unlock` | Unlock bridge with authorization |
| `nuke` | Access nuclear testing grounds |
| `nuke.unlock` | Override nuke safety locks |

## 💬 AI CHAT

| Command | Description |
|---------|-------------|
| `vbot [message]` | Send message to V-BOT AI |
| *Any text* | Chat with Overseer AI (if HF_API_KEY configured) |

## 🛠️ UTILITY

| Command | Description |
|---------|-------------|
| `help` | Show full command list |
| `clear` | Clear terminal screen |

---

## 🎮 RED MENACE CONTROLS

When Red Menace is active, use the buttons below the terminal:
- **← LEFT**: Move ship left
- **→ RIGHT**: Move ship right  
- **🔥 FIRE**: Shoot missiles

**Objective**: Destroy all communist invaders!

**Lives**: 3  
**Scoring**: Grunts = 10pts, Elites = 20pts

---

## ❌⭕ TIC-TAC-TOE BOARD

```
Position numbers:
1 | 2 | 3
---------
4 | 5 | 6
---------
7 | 8 | 9

Example moves:
> ttt start
> ttt 5    (place X in center)
> ttt 1    (place X in top-left)
```

---

## 💡 PRO TIPS

1. **Red Menace**: Limit 3 missiles on screen at once - aim carefully!
2. **Tic-Tac-Toe**: Center and corners are strategic positions
3. **Trivia**: Use `hint` command if stuck - no penalty!
4. **Fortune**: Ask multiple times for different predictions
5. **AI Chat**: Just type naturally - no special syntax needed

---

## 🔥 QUICK START

```
# Open Overseer Terminal
1. Navigate to /overseer.html

# Try the games!
> rm              # Play Red Menace (use buttons to control)
> ttt start       # Play Tic-Tac-Toe
> ttt 5           # Place X in center
> jokes           # Get a laugh
> fortune         # See your fate
> trivia          # Test your knowledge

# Check your game stats
> status          # Player stats
> inventory       # What you're carrying
> caps            # Your wealth

# Get help anytime
> help            # Full command list
> games           # List all games
```

---

## 🤖 AI PERSONALITY

**With HF_API_KEY configured**:
- Natural conversation
- Context-aware responses
- Unique personality (sarcastic, witty, mysterious)
- Reacts to game events

**Without API key**:
- Pre-written responses system
- 4 personality tones (neutral, sarcastic, corporate, glitch)
- All games still work perfectly!

Setup: See `HF_API_SETUP.md`

---

## 📱 MOBILE SUPPORT

The Overseer terminal works on mobile! Use:
- On-screen keyboard for commands
- Touch the input field to type
- Red Menace buttons are touch-friendly

---

## 🐛 TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| "Module not found" | Refresh page - scripts may not have loaded |
| Red Menace buttons don't work | Make sure you typed `redmenace` first |
| Tic-Tac-Toe won't accept move | Check position is 1-9 and not occupied |
| AI not responding | Check if HF_API_KEY is configured (see HF_API_SETUP.md) |
| Commands not working | Type `help` to see available commands |

---

## 📚 DOCUMENTATION

### 🌟 START HERE: THE COMPLETE GUIDE
**[VAULT_77_OVERSEER_COMPLETE_GUIDE.md](VAULT_77_OVERSEER_COMPLETE_GUIDE.md)** - **THE FULL DEAL**
- Complete consolidated documentation
- Everything about games, AI, features, and systems
- Technical architecture and developer reference
- The definitive Overseer resource

### Additional Documentation
- `OVERSEER_ENHANCEMENTS.md` - Technical features guide
- `HF_API_SETUP.md` - AI personality configuration
- `OVERSEER_BOT_GUIDE.md` - Original technical documentation

---

**Have fun in the wasteland, Vault Dweller! 🚀**
