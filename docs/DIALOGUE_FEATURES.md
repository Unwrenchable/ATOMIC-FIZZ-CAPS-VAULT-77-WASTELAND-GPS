# 📟 FALLOUT 4 DIALOGUE SYSTEM - FEATURE DOCUMENTATION

## OVERSEER REPORT: Enhanced Dialogue System v2.0

Per Vault-Tec Protocol 77, this document outlines the comprehensive enhancements to the NPC dialogue system, bringing it to full Fallout 4 parity.

---

## 🎮 1. DIAMOND WHEEL DIALOGUE

### Overview
The dialogue system now supports both **list layout** (default) and **diamond wheel layout** (Fallout 4 style).

### Usage
```javascript
// Enable wheel layout
Game.modules.FO4Dialogue.toggleWheelLayout(true);

// Disable wheel layout (return to list)
Game.modules.FO4Dialogue.toggleWheelLayout(false);
```

### Controls
- **List Mode**: Press `1`, `2`, `3`, `4` to select responses
- **Wheel Mode**: Press `W`, `A`, `S`, `D` to select responses
  - `W` = Top (typically "Question/More Info")
  - `D` = Right (typically "Affirmative/Yes")
  - `S` = Bottom (typically "Negative/No")
  - `A` = Left (typically "Sarcastic/Aggressive")
- **Both Modes**: `SPACE`/`ENTER` to continue, `ESC` to exit
- **Toggle**: `SHIFT+TAB` to switch between layouts

### Dialogue Format
```javascript
{
  nodes: [{
    id: 'intro',
    text: 'Well, well... another vault dweller looking for trouble?',
    responses: [
      { text: "What can you tell me about this place?", tone: 'question', next: 'info' },
      { text: "I'm just passing through.", tone: 'neutral', next: 'goodbye' },
      { text: "You got a problem with vault dwellers?", tone: 'aggressive', next: 'hostile' },
      { text: "Trouble? I AM the trouble.", tone: 'sarcastic', next: 'sarcasm' }
    ]
  }]
}
```

---

## 💬 2. SPEECH CHECKS / PERSUASION

### Overview
Charisma-based skill checks with color-coded difficulty indicators.

### Difficulty Levels
- **Yellow** = Easy (75% base chance, requires Charisma 3+)
- **Orange** = Medium (50% base chance, requires Charisma 5+)
- **Red** = Hard (25% base chance, requires Charisma 7+)

### Success Calculation
```
Base Chance + (Player Stat - Required) × 10%
Minimum: 5% | Maximum: 95%
```

### Dialogue Format
```javascript
{
  responses: [
    {
      text: "Trust me, I know what I'm doing.",
      speechCheck: {
        stat: 'charisma',
        difficulty: 'hard'
      },
      next: 'success_path',
      onFailure: 'failure_path'
    }
  ]
}
```

### Skill Check Types
- `charisma` - Persuasion, lying, charm
- `intelligence` - Technical knowledge, logic
- `luck` - Risky gambles, fortune

### Example with Failure Handling
```javascript
{
  nodes: [
    {
      id: 'guard_check',
      text: 'Nobody gets through without authorization.',
      responses: [
        {
          text: "[Charisma] I'm with the Overseer's office.",
          speechCheck: { stat: 'charisma', difficulty: 'medium' },
          next: 'allowed_in',
          onFailure: 'caught_lying'
        },
        {
          text: "I'll come back later.",
          end: true
        }
      ]
    },
    {
      id: 'caught_lying',
      text: "Nice try. Get out of here before I call reinforcements.",
      responses: [{ text: 'Fine...', end: true }]
    }
  ]
}
```

---

## ❤️ 3. COMPANION AFFINITY SYSTEM

### Overview
Track relationship status with companions (-1000 to +1000 scale).

### Affinity Levels
- **+1000 to +750**: Idolizes
- **+749 to +500**: Admires
- **+499 to +250**: Likes
- **+249 to -249**: Neutral
- **-250 to -499**: Dislikes
- **-500 to -749**: Hates
- **-750 to -1000**: Despises

### Dialogue Format
```javascript
{
  responses: [
    {
      text: "We should help these settlers.",
      affinity: +15,  // Companion likes this
      next: 'help_settlers'
    },
    {
      text: "Let's take their supplies.",
      affinity: -25,  // Companion dislikes this
      next: 'rob_settlers'
    }
  ]
}
```

### API Methods
```javascript
// Get current affinity
const affinity = Game.modules.FO4Dialogue.getCompanionAffinity('piper');

// Get affinity level
const level = Game.modules.FO4Dialogue.getAffinityLevel('piper');
// Returns: 'idolizes', 'admires', 'likes', 'neutral', 'dislikes', 'hates', 'despises'

// Manually modify affinity
Game.modules.FO4Dialogue.modifyCompanionAffinity('piper', 50);
```

### Companion Definition
```javascript
Game.companions.active = {
  id: 'piper',
  name: 'Piper Wright',
  faction: 'Diamond City Reporter'
};
```

### Events
```javascript
// Listen for affinity milestones
window.addEventListener('companion_idolizes', (e) => {
  console.log(`${e.detail.companionId} now idolizes you!`);
});

window.addEventListener('companion_hates', (e) => {
  console.log(`${e.detail.companionId} now hates you!`);
});
```

---

## 🎭 4. DRAGONBONES INTEGRATION

### Overview
Animated NPC portraits with expressions, lip sync, and idle animations.

### NPC Setup
```javascript
const npc = {
  id: 'merchant_joe',
  name: 'Joe the Merchant',
  armatureBase: '/assets/dragonbones/npcs/merchant',
  armatureName: 'merchant_rig',
  appearance: { /* SVG fallback */ }
};
```

### Features
- **Expression Changes**: Based on dialogue mood
- **Lip Sync**: Simplified mouth animation during speech
- **Idle Breathing**: Subtle movement when not talking
- **NPC Variations**: Consistent randomized tints/scales per NPC ID
- **Automatic Fallback**: SVG portraits if DragonBones fails

### Visual Effects by NPC Type
- **Ghoul**: Radiation static overlay
- **Synth/Robot**: Scanning line effect
- **Hostile**: Glitch distortion effect

---

## 🗺️ 5. QUEST HOOKS IN DIALOGUE

### Quest Start
```javascript
{
  id: 'quest_offer',
  text: 'I need someone to clear out those raiders. Interested?',
  offers_quest: 'clear_raider_camp',
  responses: [
    { text: 'I'll do it.', next: 'accept_quest' },
    { text: 'Not interested.', end: true }
  ]
}
```

### Quest Objective Completion
```javascript
{
  text: "Great work clearing those raiders!",
  complete_objective: {
    quest: 'clear_raider_camp',
    objective: 'kill_raiders'
  }
}
```

### Quest Stage Checks
```javascript
// Show different dialogue based on quest progress
{
  nodes: [
    {
      id: 'intro',
      text: Game.quests?.isActive('main_quest') 
        ? "Back already? Find what you were looking for?"
        : "First time in these parts?"
    }
  ]
}
```

### Rewards
```javascript
{
  text: "Here's your payment. You earned it.",
  rewards: {
    caps: 250,
    xp: 100,
    items: ['stimpak', 'rad_away', 'ammo_556']
  }
}
```

---

## 🌍 6. AMBIENT NPC REACTIONS

### Overview
NPCs react to player proximity with dynamic behaviors.

### Registration
```javascript
// Register an NPC for ambient behaviors
Game.modules.npcEncounter.registerAmbientNPC(npc);

// Start monitoring
Game.modules.npcEncounter.startAmbientMonitoring();
```

### Reaction Zones
- **0-5m**: Greeting (time-of-day aware)
- **10-15m**: Turn to face player
- **15-25m**: Occasional ambient comments

### Time-Based Greetings
```
Morning (5am-12pm): "Morning, wanderer."
Afternoon (12pm-6pm): "Afternoon."
Evening (6pm-10pm): "Getting dark soon."
Night (10pm-5am): "Can't sleep either?"
```

### Disposition-Based Reactions
- **Friendly**: Warm greetings
- **Neutral**: Basic acknowledgment
- **Suspicious**: Wary comments
- **Hostile**: Threats and warnings

---

## 📦 7. ENHANCED DIALOGUE NODE FEATURES

### Barter Option
```javascript
{
  text: "Take a look at what I've got for sale.",
  barter: true,  // Shows [TRADE] option
  responses: [
    { text: "Let me see your inventory.", /* triggers trade UI */ },
    { text: "Maybe later.", end: true }
  ]
}
```

### Rumor System
```javascript
{
  text: "I heard something interesting the other day...",
  rumor: "There's a hidden bunker in the hills north of here. Full of pre-war tech.",
  responses: [{ text: "Thanks for the tip.", end: true }]
}
```

Access rumors:
```javascript
// Get all rumors
const rumors = Game.rumors;

// Recent rumors
const recent = Game.rumors.filter(r => Date.now() - r.timestamp < 86400000);
```

### Knowledge Unlocks
```javascript
{
  text: "I can mark those locations on your map.",
  knowledge_unlock: {
    map_markers: ['raider_camp_1', 'hidden_vault', 'trader_outpost'],
    lore: 'pre_war_history_chapter_3',
    perks: ['wasteland_survival']
  }
}
```

### Flag Checks
```javascript
{
  nodes: [
    {
      id: 'check_reputation',
      text: Game.flags?.get('helped_settlers') 
        ? "I heard about what you did. You're alright."
        : "I don't know you. Move along.",
      responses: [/* ... */]
    }
  ]
}
```

---

## 🎨 8. VISUAL POLISH

### NPC Type Effects

#### Ghoul NPCs
```javascript
npc.type = 'ghoul';  // or npc.appearance.race = 'ghoul'
// Applies radiation static effect
```

#### Synth/Robot NPCs
```javascript
npc.type = 'synth';  // or 'robot'
// Applies scanning line effect
```

#### Hostile NPCs
```javascript
npc.mood = 'hostile';  // or npc.disposition = 'hostile'
// Applies glitch distortion effect
```

### Portrait Zoom
Camera zooms slightly on active speaker for cinematic effect.

### Pulsing Highlights
Active dialogue options pulse to draw attention.

---

## 🎯 COMPLETE EXAMPLE

```javascript
const merchantDialogue = {
  nodes: [
    {
      id: 'intro',
      text: "Welcome to Joe's Emporium! Best prices in the wasteland.",
      responses: [
        {
          text: "What are you selling?",
          tone: 'question',
          next: 'show_inventory'
        },
        {
          text: "[Charisma] How about a discount for a fellow wastelander?",
          speechCheck: { stat: 'charisma', difficulty: 'medium' },
          affinity: +10,
          next: 'discount',
          onFailure: 'no_discount'
        },
        {
          text: "Hand over your caps.",
          tone: 'aggressive',
          affinity: -50,
          next: 'robbery_attempt'
        },
        {
          text: "Just browsing.",
          end: true
        }
      ]
    },
    {
      id: 'show_inventory',
      text: "Got weapons, ammo, supplies... you name it.",
      barter: true,
      responses: [
        { text: "[Trade]", /* opens trade UI */ },
        { text: "Tell me about this area.", next: 'rumor' }
      ]
    },
    {
      id: 'discount',
      text: "Alright, alright. I like you. Twenty percent off.",
      set_flags: ['joe_discount'],
      responses: [{ text: "Appreciate it.", next: 'show_inventory' }]
    },
    {
      id: 'no_discount',
      text: "Nice try, but business is business.",
      responses: [{ text: "Worth a shot.", next: 'show_inventory' }]
    },
    {
      id: 'rumor',
      text: "Raiders have been scouting the old factory. Something big is happening.",
      rumor: "Raiders planning something at the old factory",
      knowledge_unlock: {
        map_markers: ['raider_factory']
      },
      responses: [{ text: "Thanks for the heads up.", end: true }]
    },
    {
      id: 'robbery_attempt',
      text: "HELP! GUARDS!",
      set_flags: ['hostile_to_joe', 'wanted_in_settlement'],
      affinity: -100,
      responses: [{ text: "[COMBAT STARTS]", end: true }]
    }
  ]
};

// Trigger dialogue
const joe = {
  id: 'merchant_joe',
  name: 'Joe',
  type: 'human',
  disposition: 'friendly',
  armatureBase: '/assets/dragonbones/npcs/merchant'
};

Game.modules.FO4Dialogue.startDialogue(joe, merchantDialogue, () => {
  console.log('Dialogue ended');
});
```

---

## 🔧 CONFIGURATION

### Player Stats
Set player stats for skill checks:
```javascript
Game.player = {
  stats: {
    charisma: 7,
    intelligence: 6,
    luck: 4,
    strength: 5,
    perception: 6,
    endurance: 5,
    agility: 4
  }
};
```

### Companion Setup
```javascript
Game.companions = {
  active: {
    id: 'piper',
    name: 'Piper Wright'
  },
  affinity: {
    piper: 350  // Likes you
  }
};
```

---

## 🎮 KEYBOARD REFERENCE

| Key | Action |
|-----|--------|
| `1-4` | Select response (list mode) |
| `W` | Select top response (wheel mode) |
| `A` | Select left response (wheel mode) |
| `S` | Select bottom response (wheel mode) |
| `D` | Select right response (wheel mode) |
| `SPACE` / `ENTER` | Continue / Skip typewriter |
| `ESC` | Close dialogue |
| `SHIFT+TAB` | Toggle layout mode |

---

## 📊 STORAGE

All data is persisted to localStorage:
- **Companion Affinity**: `companion_affinity`
- **Rumors**: `rumors`
- **Quest Flags**: Managed by quest system

---

## 🚀 INITIALIZATION

The dialogue system auto-initializes. To manually configure:

```javascript
// Wait for DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Configure wheel layout
  Game.modules.FO4Dialogue.toggleWheelLayout(false);
  
  // Start ambient monitoring
  Game.modules.npcEncounter.startAmbientMonitoring();
  
  // Register ambient NPCs
  ambientNPCs.forEach(npc => {
    Game.modules.npcEncounter.registerAmbientNPC(npc);
  });
});
```

---

## ☢️ FALLOUT 4 AUTHENTICITY CHECKLIST

✅ Diamond wheel dialogue layout  
✅ Color-coded speech checks (Yellow/Orange/Red)  
✅ Companion affinity reactions  
✅ Animated NPC portraits with lip sync  
✅ Camera zoom on active speaker  
✅ Quest triggers in dialogue  
✅ Persuasion success/failure feedback  
✅ Time-of-day greetings  
✅ Disposition-based reactions  
✅ Skill-based checks (Charisma, Intelligence, Luck)  
✅ Barter integration  
✅ Rumor system  
✅ Knowledge/map unlocks  

---

**📟 OVERSEER SIGN-OFF:**
*All systems operational. The wasteland awaits, Vault Dweller.* ☢️

---

## 🔗 SEE ALSO
- `/public/js/modules/fo4-dialogue.js` - Main dialogue system
- `/public/css/fo4-dialogue.css` - Visual styling
- `/public/js/modules/npcEncounter.js` - Encounter management
- `/public/js/modules/dragonbones-npc.js` - Animation system
