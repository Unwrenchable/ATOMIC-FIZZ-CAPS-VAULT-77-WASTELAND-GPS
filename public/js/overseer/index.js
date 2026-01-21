// public/js/overseer/index.js
// Overseer module loader — loads all AI engines + terminal + brain + extensions

// CORE AI ENGINES
import "./core.personality.js";
import "./core.memory.js";
import "./core.lore.js";
import "./core.faction.js";
import "./core.threat.js";
import "./core.weather.js";
import "./core.worldstate.js";
import "./core.commands.js";
import "./core.quest_mapintel.js";

// TERMINAL ENGINE (UI + input/output)
import "./overseer.full.js";

// PERSONALITY + CUSTOM COMMANDS (must load BEFORE overseer.js)
import "./core.personality.js";
import "./handlers.js";

// UNIFIED OVERSEER BRAIN (attaches engines + commands)
import "./overseer.js";
