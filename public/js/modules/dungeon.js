// public/js/modules/dungeon.js
// ------------------------------------------------------------
// Atomic Fizz Caps – Dungeon Interior System
// Procedurally generated dungeon rooms with Fallout 1/2 aesthetic
// ASCII tile map, lockpick, terminal hack, keycard doors, loot & battles
//
// Exposes: Game.modules.dungeon
// ------------------------------------------------------------

(function () {
  "use strict";

  if (!window.Game) window.Game = {};
  if (!window.Game.modules) window.Game.modules = {};

  // ----------------------------------------------------------
  // XSS-safe HTML helper
  // ----------------------------------------------------------
  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = String(str == null ? "" : str);
    return d.innerHTML;
  }

  // ----------------------------------------------------------
  // Secure RNG helpers (no Math.random())
  // ----------------------------------------------------------
  function cryptoRandInt(max) {
    // Returns a cryptographically random integer in [0, max)
    if (max <= 0) return 0;
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % max;
  }

  function cryptoRandFloat() {
    // Returns a float in [0, 1)
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] / 0x100000000;
  }

  function _cryptoRandBool(chance) {
    // Returns true with `chance` probability (0..1)
    return cryptoRandFloat() < chance;
  }

  function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = cryptoRandInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pick(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[cryptoRandInt(arr.length)];
  }

  // ----------------------------------------------------------
  // Constants
  // ----------------------------------------------------------
  const API_BASE = window.API_BASE || "https://api.atomicfizzcaps.xyz";
  // Max random bonus caps on a variable-yield loot item (seeded RNG, not Math.random)
  const CAPS_STASH_BONUS_MAX = 80;

  // Map tile characters
  const TILES = {
    WALL:     "#",
    FLOOR:    ".",
    PLAYER:   "@",
    ENEMY:    "E",
    LOOT:     "$",
    TERMINAL: "T",
    DOOR_OPEN:  "+",
    DOOR_LOCKED:"[",
    DOOR_KEYCARD:"K",
    DOOR_TERMINAL:"?",
    VOID:     " ",
    ENTRANCE: ">",
    EXIT:     "<",
    BOSS:     "B",
  };

  // Direction vectors: [dy, dx]
  const DIRS = {
    N: [-1,  0],
    S: [ 1,  0],
    E: [ 0,  1],
    W: [ 0, -1],
  };

  // ----------------------------------------------------------
  // Dungeon theme definitions
  // ----------------------------------------------------------
  const THEMES = {
    vault: {
      wallChar:   "█",
      floorChar:  "░",
      label:      "Vault-Tec Facility",
      bgColor:    "#001a33",
      wallColor:  "#0055a0",
      floorColor: "#003366",
      enemyTypes: ["security_bot", "vault_ghoul", "overseer_mk2"],
      lootTables: ["stimpak", "rad_away", "caps_stash", "vault_suit", "fusion_cell"],
      roomNames: {
        entrance:       "Vault Atrium",
        corridor:       "Vault Corridor",
        loot_room:      "Supply Cache",
        encounter_room: "Security Station",
        boss_room:      "Overseer's Office",
        terminal_room:  "Data Processing Bay",
        storage:        "Vault Storage",
      },
    },
    bunker: {
      wallChar:   "#",
      floorChar:  ".",
      label:      "Military Bunker",
      bgColor:    "#1a1a0a",
      wallColor:  "#556b2f",
      floorColor: "#2a2a14",
      enemyTypes: ["enclave_soldier", "deathclaw_alpha", "sentry_bot"],
      lootTables: ["laser_rifle", "power_armor_piece", "military_rations", "fusion_core", "frag_grenade"],
      roomNames: {
        entrance:       "Bunker Entrance",
        corridor:       "Access Corridor",
        loot_room:      "Armory Cache",
        encounter_room: "Guard Room",
        boss_room:      "Command Center",
        terminal_room:  "Comms Room",
        storage:        "Supply Depot",
      },
    },
    raider_camp: {
      wallChar:   "▓",
      floorChar:  "~",
      label:      "Raider Hideout",
      bgColor:    "#1a0a00",
      wallColor:  "#8b4513",
      floorColor: "#2a1500",
      enemyTypes: ["raider", "raider_psycho", "raider_boss"],
      lootTables: ["pipe_gun", "leather_armor", "chems_stash", "nuka_cola", "caps_stash"],
      roomNames: {
        entrance:       "Main Gate",
        corridor:       "Raider Passage",
        loot_room:      "Stash Room",
        encounter_room: "Raider Den",
        boss_room:      "Boss's Quarters",
        terminal_room:  "Raider Terminal",
        storage:        "Junk Pile",
      },
    },
    ruin: {
      wallChar:   "▒",
      floorChar:  "·",
      label:      "Pre-War Ruins",
      bgColor:    "#0f0f0f",
      wallColor:  "#4a4a4a",
      floorColor: "#1a1a1a",
      enemyTypes: ["ghoul", "feral_ghoul", "glowing_one"],
      lootTables: ["pre_war_money", "scrap_metal", "wonderglue", "bobby_pin", "stimpak"],
      roomNames: {
        entrance:       "Collapsed Entry",
        corridor:       "Crumbled Hallway",
        loot_room:      "Pre-War Stockroom",
        encounter_room: "Ghoul Nest",
        boss_room:      "Executive Suite",
        terminal_room:  "Server Room",
        storage:        "Maintenance Closet",
      },
    },
    sewer: {
      wallChar:   "═",
      floorChar:  "≈",
      label:      "Wasteland Sewer",
      bgColor:    "#000d0d",
      wallColor:  "#1a4a4a",
      floorColor: "#001515",
      enemyTypes: ["radroach", "mole_rat", "bloatfly"],
      lootTables: ["rad_away", "dirty_water", "scrap_metal", "caps_stash", "pre_war_money"],
      roomNames: {
        entrance:       "Sewer Access",
        corridor:       "Dark Tunnel",
        loot_room:      "Maintenance Room",
        encounter_room: "Nest Chamber",
        boss_room:      "Sewer Boss Den",
        terminal_room:  "Pump Control Room",
        storage:        "Flooded Storage",
      },
    },
    office: {
      wallChar:   "|",
      floorChar:  ".",
      label:      "Pre-War Office Building",
      bgColor:    "#0a0a1a",
      wallColor:  "#3a3a6a",
      floorColor: "#14141e",
      enemyTypes: ["zombie_executive", "robobrain", "eyebot"],
      lootTables: ["holotape", "pre_war_money", "coffee_mug", "desk_fan", "caps_stash"],
      roomNames: {
        entrance:       "Reception Area",
        corridor:       "Office Corridor",
        loot_room:      "Break Room",
        encounter_room: "Conference Room",
        boss_room:      "CEO's Office",
        terminal_room:  "IT Department",
        storage:        "Supply Closet",
      },
    },
    military_base: {
      wallChar:   "#",
      floorChar:  ".",
      label:      "Military Installation",
      bgColor:    "#0a1400",
      wallColor:  "#4b5320",
      floorColor: "#1a2200",
      enemyTypes: ["enclave_soldier", "sentry_bot", "deathclaw_alpha"],
      lootTables: ["laser_rifle", "fusion_core", "power_armor_piece", "military_rations", "nuke_component"],
      roomNames: {
        entrance:       "Main Gate",
        corridor:       "Barracks Hallway",
        loot_room:      "Weapons Locker",
        encounter_room: "Barracks",
        boss_room:      "Commanding Officer's Quarters",
        terminal_room:  "Operations Room",
        storage:        "Quartermaster's Store",
      },
    },
    communist_vault: {
      wallChar:   "█",
      floorChar:  "·",
      label:      "Vault Zero — Communist Automation Facility",
      bgColor:    "#1a0000",
      wallColor:  "#8b0000",
      floorColor: "#2a0000",
      enemyTypes: ["propagandabot", "red_assaultron", "red_trooper"],
      lootTables: ["soviet_pulse_rifle", "fusion_core", "caps_stash", "military_rations"],
      roomNames: {
        entrance:       "Vault Zero Antechamber",
        corridor:       "Production Corridor",
        loot_room:      "Soviet Armory Cache",
        encounter_room: "Fabrication Bay",
        boss_room:      "Command Center — Commissar Station",
        terminal_room:  "Directive Control Terminal",
        storage:        "Component Storage Silo",
      },
    },
  };

  // Enemy display names
  const ENEMY_NAMES = {
    security_bot:      "Vault Security Bot",
    vault_ghoul:       "Vault Dweller Ghoul",
    overseer_mk2:      "Overseer MK-II",
    enclave_soldier:   "Enclave Trooper",
    deathclaw_alpha:   "Deathclaw Alpha",
    sentry_bot:        "Sentry Bot",
    raider:            "Raider",
    raider_psycho:     "Raider Psycho",
    raider_boss:       "Raider Warlord",
    ghoul:             "Rotting Ghoul",
    feral_ghoul:       "Feral Ghoul",
    glowing_one:       "Glowing One",
    radroach:          "Giant Radroach",
    mole_rat:          "Mole Rat",
    bloatfly:          "Bloatfly",
    zombie_executive:  "Zombie Executive",
    robobrain:         "RoboBrain",
    eyebot:            "Eyebot",
    propagandabot:     "Propagandabot (Red Eyebot)",
    red_assaultron:    "Red Star Assaultron",
    red_trooper:       "Communist Trooper Ghoul",
    vault_zero_commissar: "Vault Zero Commissar",
  };

  const ENEMY_HP = {
    security_bot: 45, vault_ghoul: 30, overseer_mk2: 80,
    enclave_soldier: 55, deathclaw_alpha: 120, sentry_bot: 90,
    raider: 25, raider_psycho: 35, raider_boss: 70,
    ghoul: 20, feral_ghoul: 28, glowing_one: 60,
    radroach: 10, mole_rat: 15, bloatfly: 8,
    zombie_executive: 22, robobrain: 50, eyebot: 18,
    propagandabot: 25, red_assaultron: 85, red_trooper: 40,
    vault_zero_commissar: 150,
  };

  // Loot display names / rewards
  // NOTE: caps values are fixed baselines. caps_stash gets a crypto-random
  // bonus added at loot-generation time (inside _populateRoom).
  const LOOT_DEFS = {
    stimpak:           { name: "Stimpak",               caps: 30,  type: "consumable" },
    rad_away:          { name: "RadAway",                caps: 25,  type: "consumable" },
    caps_stash:        { name: "Caps Stash",             caps: 20,  type: "caps",    variable: true },
    vault_suit:        { name: "Vault-Tec Jumpsuit",     caps: 45,  type: "armor" },
    fusion_cell:       { name: "Fusion Cell",            caps: 15,  type: "ammo" },
    laser_rifle:       { name: "Laser Rifle",            caps: 90,  type: "weapon" },
    power_armor_piece: { name: "Power Armor Piece",      caps: 120, type: "armor" },
    military_rations:  { name: "Military Rations",       caps: 20,  type: "consumable" },
    fusion_core:       { name: "Fusion Core",            caps: 80,  type: "misc" },
    frag_grenade:      { name: "Frag Grenade",           caps: 40,  type: "weapon" },
    pipe_gun:          { name: "Pipe Gun",               caps: 35,  type: "weapon" },
    leather_armor:     { name: "Leather Armor",          caps: 50,  type: "armor" },
    chems_stash:       { name: "Chems Stash",            caps: 55,  type: "misc" },
    nuka_cola:         { name: "Nuka-Cola",              caps: 10,  type: "consumable" },
    pre_war_money:     { name: "Pre-War Money",          caps: 60,  type: "misc" },
    scrap_metal:       { name: "Scrap Metal",            caps: 5,   type: "misc" },
    wonderglue:        { name: "Wonderglue",             caps: 8,   type: "misc" },
    bobby_pin:         { name: "Bobby Pin",              caps: 3,   type: "misc" },
    holotape:          { name: "Holotape",               caps: 22,  type: "misc" },
    coffee_mug:        { name: "Coffee Mug",             caps: 2,   type: "misc" },
    desk_fan:          { name: "Desk Fan",               caps: 4,   type: "misc" },
    dirty_water:       { name: "Dirty Water",            caps: 1,   type: "consumable" },
    nuke_component:    { name: "Nuke Component",         caps: 150, type: "misc" },
    soviet_pulse_rifle: { name: "Soviet Pulse Rifle (MK-9)", caps: 340, type: "weapon" },
  };

  // Hacking word pools for terminal mini-game
  const HACK_WORDS_BY_LEN = {
    4: ["LOCK","DATA","OPEN","GATE","CODE","FILE","SAFE","PASS","DOOR","CORE"],
    5: ["VAULT","ENCLAVE","ROBOT","LASER","MELEE","GUARD","BUNKER","POWER","ARMED","GUARD"],
    6: ["TURRET","COMBAT","PLASMA","SYSTEM","SECTOR","BUNKER","SHIELD","BREACH","SENSOR","LAUNCH"],
  };

  // Terminal hacking flavour text
  const HACK_PROMPTS = [
    ">>> RobCo Industries Terminal v2.2.0.3 — WELCOME <<<",
    ">>> ROBCO INDUSTRIES (TM) UNIFIED OPERATING SYSTEM <<<",
    ">>> PASSWORD REQUIRED. PLEASE ENTER PASSWORD. <<<",
  ];

  // ----------------------------------------------------------
  // Seeded PRNG (xorshift32, seeded from crypto for dungeon gen)
  // ----------------------------------------------------------
  function makeSeededRng(seed) {
    let s = seed >>> 0;
    if (s === 0) s = 1;
    return {
      next() {
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        return (s >>> 0) / 0x100000000;
      },
      int(max) {
        return Math.floor(this.next() * max);
      },
      bool(p) {
        return this.next() < p;
      },
    };
  }

  // ----------------------------------------------------------
  // Dungeon layout templates — pre-defined room position patterns
  // on the 3-column × 3-row grid used by DungeonGenerator.
  // Each template specifies an ordered array of {row, col} cells:
  //   positions[0]  → entrance room
  //   positions[last] → boss room (enforced in generate())
  // Templates vary in room count, giving each run a distinct shape.
  // ----------------------------------------------------------
  const DUNGEON_TEMPLATES = [
    {
      name: "gauntlet",
      label: "THE GAUNTLET",
      description: "One corridor. One exit. Whatever stands between you and it died there.",
      positions: [
        { row: 1, col: 0 },
        { row: 1, col: 1 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 1, col: 2 },
      ],
    },
    {
      name: "cross",
      label: "THE CROSS",
      description: "Four arms radiating from a dead center. Pick the wrong one and you won't pick again.",
      positions: [
        { row: 1, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 1 },
        { row: 2, col: 1 },
        { row: 1, col: 2 },
      ],
    },
    {
      name: "elbow",
      label: "THE ELBOW",
      description: "Turns without warning. Plans die at the corner.",
      positions: [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
        { row: 2, col: 0 },
        { row: 2, col: 1 },
        { row: 2, col: 2 },
        { row: 1, col: 2 },
      ],
    },
    {
      name: "hub",
      label: "THE HUB",
      description: "All roads lead to the center. The center doesn't forgive visitors.",
      positions: [
        { row: 0, col: 0 },
        { row: 0, col: 2 },
        { row: 1, col: 1 },
        { row: 2, col: 0 },
        { row: 1, col: 2 },
        { row: 0, col: 1 },
        { row: 1, col: 0 },
      ],
    },
    {
      name: "zigzag",
      label: "THE ZIGZAG",
      description: "Snakes through the ruin like a radscorpion trail. Less venomous. Barely.",
      positions: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 1 },
        { row: 1, col: 2 },
        { row: 2, col: 2 },
        { row: 2, col: 1 },
      ],
    },
    {
      name: "ring",
      label: "THE CIRCUIT",
      description: "Loop complete when you clear it all. Or when it clears you.",
      positions: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 1, col: 2 },
        { row: 2, col: 2 },
        { row: 2, col: 1 },
        { row: 2, col: 0 },
        { row: 1, col: 0 },
      ],
    },
    {
      name: "labyrinth",
      label: "THE LABYRINTH",
      description: "Nine rooms. Nine chances to die. The Overseer designed this personally.",
      positions: [
        { row: 0, col: 0 }, { row: 0, col: 1 }, { row: 0, col: 2 },
        { row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 },
        { row: 2, col: 0 }, { row: 2, col: 1 }, { row: 2, col: 2 },
      ],
    },
  ];

  // ----------------------------------------------------------
  // DungeonGenerator — builds a grid of rooms
  // ----------------------------------------------------------
  class DungeonGenerator {
    constructor(theme, rng) {
      this.theme = theme;
      this.rng = rng;
      this.rooms = [];          // array of room objects
      this.grid = null;         // 2D char grid
      this.gridW = 0;
      this.gridH = 0;
    }

    // Generate dungeon layout using a randomly-selected template
    generate() {
      // Pick a template from the catalogue using the seeded RNG so the
      // layout is deterministic for a given seed (reproducible per session).
      const template = DUNGEON_TEMPLATES[this.rng.int(DUNGEON_TEMPLATES.length)];
      this.template = template;

      const positions = template.positions.slice(); // use template positions directly
      const roomCount = positions.length;           // room count driven by template
      this.rooms = [];

      // Room types distribution
      const mandatoryTypes = ["entrance", "boss_room"];
      const optionalTypes  = ["loot_room", "encounter_room", "terminal_room", "storage", "corridor"];

      let types = [...mandatoryTypes];
      for (let i = types.length; i < roomCount; i++) {
        types.push(optionalTypes[this.rng.int(optionalTypes.length)]);
      }
      types = this._shuffle(types);
      // Always start with entrance
      const eIdx = types.indexOf("entrance");
      [types[0], types[eIdx]] = [types[eIdx], types[0]];
      // Always end with boss
      const bIdx = types.indexOf("boss_room");
      [types[types.length - 1], types[bIdx]] = [types[bIdx], types[types.length - 1]];

      // Build room graph (linear chain with occasional branches)
      const roomW = 9;
      const roomH = 7;
      const gap = 3; // corridor gap between rooms

      this.gridW = (roomW + gap) * 3 + gap;
      this.gridH = (roomH + gap) * 3 + gap;

      for (let i = 0; i < roomCount; i++) {
        const pos = positions[i];
        const room = {
          id:        i,
          type:      types[i],
          x:         pos.col * (roomW + gap) + gap,
          y:         pos.row * (roomH + gap) + gap,
          w:         roomW,
          h:         roomH,
          doors:     {},  // direction -> door object
          cleared:   false,
          looted:    false,
          enemies:   [],
          loot:      [],
          name:      THEMES[this.theme].roomNames[types[i]] || types[i],
        };

        // Populate room contents
        this._populateRoom(room);
        this.rooms.push(room);
      }

      // Connect adjacent rooms with doors
      this._connectRooms(positions, roomW, roomH, gap);

      // Build ASCII grid
      this._buildGrid();

      return {
        rooms:     this.rooms,
        grid:      this.grid,
        gridW:     this.gridW,
        gridH:     this.gridH,
        startRoom: 0,
        template:  { name: template.name, label: template.label, description: template.description },
      };
    }

    _shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = this.rng.int(i + 1);
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    }

    _populateRoom(room) {
      const theme = THEMES[this.theme];
      switch (room.type) {
        case "encounter_room":
          // 1-3 enemies
          for (let i = 0; i < 1 + this.rng.int(3); i++) {
            const eType = theme.enemyTypes[this.rng.int(theme.enemyTypes.length)];
            room.enemies.push({ type: eType, name: ENEMY_NAMES[eType] || eType });
          }
          break;
        case "boss_room": {
          // 1 boss enemy (always last enemy type = boss)
          const bossType = theme.enemyTypes[theme.enemyTypes.length - 1];
          room.enemies.push({ type: bossType, name: ENEMY_NAMES[bossType] || bossType });
          room.isBoss = true;
          break;
        }
        case "loot_room":
          // 2-4 loot items
          for (let i = 0; i < 2 + this.rng.int(3); i++) {
            const lootId = theme.lootTables[this.rng.int(theme.lootTables.length)];
            const def = LOOT_DEFS[lootId] || { name: lootId, caps: 10, type: "misc" };
            // caps_stash gets a per-instance random bonus (seeded, not static)
            const caps = def.variable
              ? def.caps + Math.floor(this.rng.next() * CAPS_STASH_BONUS_MAX)
              : def.caps;
            room.loot.push({ id: lootId, name: def.name, type: def.type, caps });
          }
          break;
        case "storage":
          // 1-2 loot items
          for (let i = 0; i < 1 + this.rng.int(2); i++) {
            const lootId = theme.lootTables[this.rng.int(theme.lootTables.length)];
            const def = LOOT_DEFS[lootId] || { name: lootId, caps: 10, type: "misc" };
            const caps = def.variable
              ? def.caps + Math.floor(this.rng.next() * CAPS_STASH_BONUS_MAX)
              : def.caps;
            room.loot.push({ id: lootId, name: def.name, type: def.type, caps });
          }
          // Sometimes also has enemies
          if (this.rng.bool(0.3)) {
            const eType = theme.enemyTypes[this.rng.int(theme.enemyTypes.length)];
            room.enemies.push({ type: eType, name: ENEMY_NAMES[eType] || eType });
          }
          break;
        case "entrance":
        case "corridor":
        case "terminal_room":
        default:
          break;
      }
    }

    _connectRooms(positions, _roomW, _roomH, _gap) {
      // Build adjacency: rooms sharing edges in the grid get connected
      const posMap = new Map();
      positions.forEach((p, i) => posMap.set(`${p.row},${p.col}`, i));

      const adjacent = [[-1,0,"N","S"], [1,0,"S","N"], [0,-1,"W","E"], [0,1,"E","W"]];

      for (let i = 0; i < positions.length; i++) {
        const p = positions[i];
        for (const [dr, dc, fromDir, toDir] of adjacent) {
          const nr = p.row + dr, nc = p.col + dc;
          const key = `${nr},${nc}`;
          if (!posMap.has(key)) continue;
          const j = posMap.get(key);
          if (i >= j) continue; // avoid duplicates

          // Choose door type
          const rA = this.rooms[i], rB = this.rooms[j];
          const doorType = this._chooseDoorType(rA, rB);

          rA.doors[fromDir] = { to: j, type: doorType };
          rB.doors[toDir]   = { to: i, type: doorType };
        }
      }
    }

    _chooseDoorType(rA, rB) {
      // Boss rooms always have locked doors
      if (rA.isBoss || rB.isBoss) {
        const roll = this.rng.next();
        if (roll < 0.33) return "locked";
        if (roll < 0.66) return "keycard";
        return "terminal";
      }
      // Terminal rooms often have terminal doors
      if (rA.type === "terminal_room" || rB.type === "terminal_room") {
        return this.rng.bool(0.5) ? "terminal" : "open";
      }
      const roll = this.rng.next();
      if (roll < 0.45) return "open";
      if (roll < 0.70) return "locked";
      if (roll < 0.85) return "keycard";
      return "terminal";
    }

    _buildGrid() {
      // Initialise grid with void
      this.grid = Array.from({ length: this.gridH }, () =>
        Array(this.gridW).fill(TILES.VOID)
      );

      const th = THEMES[this.theme];
      const wallCh  = th.wallChar;
      const floorCh = th.floorChar;

      for (const room of this.rooms) {
        // Draw walls
        for (let dy = 0; dy < room.h; dy++) {
          for (let dx = 0; dx < room.w; dx++) {
            const gy = room.y + dy;
            const gx = room.x + dx;
            if (gy < 0 || gy >= this.gridH || gx < 0 || gx >= this.gridW) continue;
            const isWall = dy === 0 || dy === room.h - 1 || dx === 0 || dx === room.w - 1;
            this.grid[gy][gx] = isWall ? wallCh : floorCh;
          }
        }

        // Place room feature tiles
        const cx = room.x + Math.floor(room.w / 2);
        const cy = room.y + Math.floor(room.h / 2);

        if (room.type === "entrance")    this.grid[cy][cx] = TILES.ENTRANCE;
        if (room.type === "boss_room")   this.grid[cy][cx] = TILES.BOSS;
        if (room.type === "loot_room")   this.grid[cy][cx] = TILES.LOOT;
        if (room.type === "storage")     this.grid[cy][cx] = TILES.LOOT;
        if (room.type === "terminal_room") this.grid[cy][cx] = TILES.TERMINAL;
        if (room.enemies.length > 0)     this.grid[cy][cx] = TILES.ENEMY;

        // Draw corridor connections (doors) on the walls
        for (const [dir, door] of Object.entries(room.doors)) {
          const toRoom = this.rooms[door.to];
          this._drawCorridor(room, toRoom, dir, door.type);
        }
      }
    }

    _drawCorridor(roomA, roomB, dir, doorType) {
      const [_dy, _dx] = DIRS[dir];
      let startX, startY, endX, endY;

      const midAy = roomA.y + Math.floor(roomA.h / 2);
      const midAx = roomA.x + Math.floor(roomA.w / 2);
      const _midBy = roomB.y + Math.floor(roomB.h / 2);
      const _midBx = roomB.x + Math.floor(roomB.w / 2);

      if (dir === "N" || dir === "S") {
        // Vertical corridor
        startY = dir === "N" ? roomA.y : roomA.y + roomA.h - 1;
        endY   = dir === "N" ? roomB.y + roomB.h - 1 : roomB.y;
        const corrX = midAx;
        const minY = Math.min(startY, endY);
        const maxY = Math.max(startY, endY);
        for (let y = minY; y <= maxY; y++) {
          if (y < 0 || y >= this.gridH || corrX < 0 || corrX >= this.gridW) continue;
          const cur = this.grid[y][corrX];
          // Don't overwrite room floors or walls unless it's void
          if (cur === TILES.VOID) this.grid[y][corrX] = THEMES[this.theme].floorChar;
        }
        // Door tile at the midpoint of corridor
        const doorY = Math.floor((startY + endY) / 2);
        const doorTile = this._doorTile(doorType);
        if (doorY >= 0 && doorY < this.gridH && corrX >= 0 && corrX < this.gridW)
          this.grid[doorY][corrX] = doorTile;
      } else {
        // Horizontal corridor
        startX = dir === "W" ? roomA.x : roomA.x + roomA.w - 1;
        endX   = dir === "W" ? roomB.x + roomB.w - 1 : roomB.x;
        const corrY = midAy;
        const minX = Math.min(startX, endX);
        const maxX = Math.max(startX, endX);
        for (let x = minX; x <= maxX; x++) {
          if (corrY < 0 || corrY >= this.gridH || x < 0 || x >= this.gridW) continue;
          const cur = this.grid[corrY][x];
          if (cur === TILES.VOID) this.grid[corrY][x] = THEMES[this.theme].floorChar;
        }
        const doorX = Math.floor((startX + endX) / 2);
        const doorTile = this._doorTile(doorType);
        if (corrY >= 0 && corrY < this.gridH && doorX >= 0 && doorX < this.gridW)
          this.grid[corrY][doorX] = doorTile;
      }
    }

    _doorTile(doorType) {
      switch (doorType) {
        case "open":     return TILES.DOOR_OPEN;
        case "locked":   return TILES.DOOR_LOCKED;
        case "keycard":  return TILES.DOOR_KEYCARD;
        case "terminal": return TILES.DOOR_TERMINAL;
        default:         return TILES.DOOR_OPEN;
      }
    }
  }

  // ----------------------------------------------------------
  // Terminal Hacking Mini-Game
  // ----------------------------------------------------------
  class TerminalHackGame {
    constructor(playerIntelligence) {
      this.intel = Math.max(1, Math.min(10, playerIntelligence || 5));
      this.attempts = Math.max(2, Math.floor(this.intel / 2) + 1); // 2-6 attempts
      this.remainingAttempts = this.attempts;
      this.wordLen = this.intel >= 7 ? 6 : this.intel >= 4 ? 5 : 4;
      this.words = this._buildWordList();
      this.targetWord = pick(this.words);
      this.guessHistory = [];
      this.solved = false;
    }

    _buildWordList() {
      const pool = HACK_WORDS_BY_LEN[this.wordLen] || HACK_WORDS_BY_LEN[4];
      const shuffled = shuffleArray(pool);
      return shuffled.slice(0, Math.min(6, shuffled.length));
    }

    guess(word) {
      if (this.solved || this.remainingAttempts <= 0) return null;
      this.remainingAttempts--;

      const upper = word.toUpperCase();
      let likeness = 0;
      for (let i = 0; i < Math.min(upper.length, this.targetWord.length); i++) {
        if (upper[i] === this.targetWord[i]) likeness++;
      }

      if (upper === this.targetWord) {
        this.solved = true;
        this.guessHistory.push({ word: upper, likeness: this.targetWord.length, correct: true });
        return { correct: true, likeness: this.targetWord.length, attemptsLeft: this.remainingAttempts };
      }

      this.guessHistory.push({ word: upper, likeness, correct: false });
      return { correct: false, likeness, attemptsLeft: this.remainingAttempts };
    }

    isFailed() {
      return !this.solved && this.remainingAttempts <= 0;
    }
  }

  // ----------------------------------------------------------
  // Dungeon Module
  // ----------------------------------------------------------
  const dungeonModule = {
    gs: null,
    _overlay: null,
    _state: null,     // current dungeon state
    _hackGame: null,  // active terminal hack game

    init(gameState) {
      this.gs = gameState;
    },

    // --------------------------------------------------------
    // Public: enter(poi)
    // --------------------------------------------------------
    enter(poi) {
      if (!poi || !poi.id) {
        console.warn("[dungeon] enter() called without valid poi");
        return;
      }

      const themeKey = this._resolveTheme(poi.type);
      const theme    = THEMES[themeKey];

      // Dungeon seed design: session-unique dungeons intentional.
      // Combining poi.id hash (deterministic) with crypto random suffix ensures
      // each session gets a fresh layout — prevents players from sharing maps
      // or pre-computing room positions. Not intended to be reproducible.
      const seedArr = new Uint32Array(1);
      crypto.getRandomValues(seedArr);
      const poiHash = this._hashStr(String(poi.id));
      const seed    = (poiHash ^ seedArr[0]) >>> 0;

      const rng  = makeSeededRng(seed);
      const gen  = new DungeonGenerator(themeKey, rng);
      const data = gen.generate();

      // Build dungeon state
      const dungeonId = `dungeon_${String(poi.id)}_${Date.now()}`;
      const startRoom = data.rooms[data.startRoom];

      this._state = {
        dungeonId,
        poiId:      poi.id,
        poiName:    poi.name || "Unknown Location",
        theme:      themeKey,
        themeDef:   theme,
        template:   data.template,
        rooms:      data.rooms,
        grid:       data.grid,
        gridW:      data.gridW,
        gridH:      data.gridH,
        currentRoomId: data.startRoom,
        playerY:    startRoom.y + Math.floor(startRoom.h / 2),
        playerX:    startRoom.x + Math.floor(startRoom.w / 2),
        clearedRooms: new Set(),
        lootedRooms:  new Set(),
      };

      // Save to global game state
      if (this.gs) this.gs.currentDungeon = this._state;

      // Notify backend (async, non-blocking)
      this._apiEnter(poi.id, themeKey).catch(err =>
        console.warn("[dungeon] apiEnter error:", err)
      );

      this._render();
      // Log template flavour text on entry
      if (this._state.template) {
        this._log(`≡ ${escapeHtml(this._state.template.label)} ≡ — ${escapeHtml(this._state.template.description)}`);
      }
      this._showRoom(this._state.currentRoomId);
    },

    // --------------------------------------------------------
    // Internal: resolve theme from POI type
    // --------------------------------------------------------
    _resolveTheme(poiType) {
      const map = {
        vault:            "vault",
        bunker:           "bunker",
        raider_camp:      "raider_camp",
        ruin:             "ruin",
        sewer:            "sewer",
        office:           "office",
        military_base:    "military_base",
        communist_vault:  "communist_vault",
      };
      return map[poiType] || "ruin";
    },

    // --------------------------------------------------------
    // Simple string hash (djb2)
    // --------------------------------------------------------
    _hashStr(str) {
      let h = 5381;
      for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
      }
      return h;
    },

    // --------------------------------------------------------
    // Render full dungeon overlay
    // --------------------------------------------------------
    _render() {
      // Remove existing overlay
      const existing = document.getElementById("dungeon-overlay");
      if (existing) existing.remove();

      const overlay = document.createElement("div");
      overlay.id = "dungeon-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-label", "Dungeon Interior");

      const th  = this._state.themeDef;
      const tpl = this._state.template;

      overlay.innerHTML = `
        <div class="dungeon-inner">
          <div class="dungeon-header">
            <span class="dungeon-title">[[ ${escapeHtml(th.label)} ]]</span>
            <span class="dungeon-template-name">${escapeHtml(tpl ? tpl.label : "")}</span>
            <span class="dungeon-poi-name">${escapeHtml(this._state.poiName)}</span>
            <button class="dungeon-exit-btn" id="dungeon-exit-btn" aria-label="Exit Dungeon">◄ EXIT</button>
          </div>

          <div class="dungeon-main">
            <div class="dungeon-map-panel">
              <div class="dungeon-map-title">≡ INTERIOR MAP ≡</div>
              <div class="dungeon-map" id="dungeon-map" aria-label="Dungeon map"></div>
              <div class="dungeon-map-legend">
                <span class="leg-wall">█ Wall</span>
                <span class="leg-player">@ You</span>
                <span class="leg-enemy">E Enemy</span>
                <span class="leg-loot">$ Loot</span>
                <span class="leg-terminal">T Terminal</span>
                <span class="leg-door">+ Door</span>
              </div>
            </div>

            <div class="dungeon-right-panel">
              <div class="dungeon-hud" id="dungeon-hud"></div>
              <div class="dungeon-room-info" id="dungeon-room-info"></div>
              <div class="dungeon-actions" id="dungeon-actions"></div>
              <div class="dungeon-log" id="dungeon-log">
                <div class="dungeon-log-title">≡ VAULT-TEC LOG ≡</div>
                <div id="dungeon-log-entries"></div>
              </div>
            </div>
          </div>

          <div class="dungeon-minigame-panel" id="dungeon-minigame-panel" style="display:none;"></div>
        </div>
      `;

      document.body.appendChild(overlay);
      this._overlay = overlay;

      document.getElementById("dungeon-exit-btn").addEventListener("click", () => this.exit());

      // Trap focus inside overlay for accessibility
      overlay.addEventListener("keydown", (e) => {
        if (e.key === "Escape") this.exit();
      });

      this._drawMap();
    },

    // --------------------------------------------------------
    // Draw ASCII map grid
    // --------------------------------------------------------
    _drawMap() {
      const mapEl = document.getElementById("dungeon-map");
      if (!mapEl || !this._state) return;

      const { grid, gridH, gridW, playerY, playerX } = this._state;

      // Build display grid (copy) with player marker
      const displayGrid = grid.map(row => [...row]);
      if (playerY >= 0 && playerY < gridH && playerX >= 0 && playerX < gridW) {
        displayGrid[playerY][playerX] = TILES.PLAYER;
      }

      // Render as spans for colour coding
      const lines = [];
      for (let y = 0; y < gridH; y++) {
        const cells = [];
        for (let x = 0; x < gridW; x++) {
          const ch = displayGrid[y][x];
          cells.push(`<span class="dt-${this._tileClass(ch)}">${escapeHtml(ch)}</span>`);
        }
        lines.push(`<div class="dmap-row">${cells.join("")}</div>`);
      }

      mapEl.innerHTML = lines.join("");
    },

    _tileClass(ch) {
      switch (ch) {
        case TILES.PLAYER:   return "player";
        case TILES.ENEMY:    return "enemy";
        case TILES.BOSS:     return "boss";
        case TILES.LOOT:     return "loot";
        case TILES.TERMINAL: return "terminal";
        case TILES.DOOR_OPEN:     return "door";
        case TILES.DOOR_LOCKED:   return "door-locked";
        case TILES.DOOR_KEYCARD:  return "door-keycard";
        case TILES.DOOR_TERMINAL: return "door-terminal";
        case TILES.ENTRANCE: return "entrance";
        case TILES.EXIT:     return "exit";
        case TILES.VOID:     return "void";
        default:
          // Wall characters vs floor characters
          if (["#","█","▓","▒","═","|"].includes(ch)) return "wall";
          return "floor";
      }
    },

    // --------------------------------------------------------
    // Show room info and actions
    // --------------------------------------------------------
    _showRoom(roomId) {
      const state = this._state;
      if (!state) return;

      const room = state.rooms[roomId];
      if (!room) return;

      state.currentRoomId = roomId;

      this._updateHUD();
      this._updateRoomInfo(room);
      this._updateActions(room);
      this._drawMap();
    },

    _updateHUD() {
      const hudEl = document.getElementById("dungeon-hud");
      if (!hudEl) return;

      const player  = this.gs ? this.gs.player : {};
      const hp      = player.hp     ?? 100;
      const maxHp   = player.maxHp  ?? 100;
      const caps    = player.caps   ?? 0;
      const _xp      = player.xp    ?? 0;
      const special = player.special || {};
      const agility = special.A     ?? 5;
      const intel   = special.I     ?? 5;

      const hpPct   = Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)));
      const hpColor = hpPct > 50 ? "#00ff41" : hpPct > 25 ? "#ffaa00" : "#ff4400";

      const bobby   = this._getBobbyPins();

      hudEl.innerHTML = `
        <div class="dungeon-hud-inner">
          <div class="hud-stat">
            <span class="hud-label">HP</span>
            <div class="hud-bar-bg">
              <div class="hud-bar" style="width:${hpPct}%;background:${escapeHtml(hpColor)};"></div>
            </div>
            <span class="hud-val">${escapeHtml(hp)}/${escapeHtml(maxHp)}</span>
          </div>
          <div class="hud-row">
            <span class="hud-label">AGI</span><span class="hud-val">${escapeHtml(agility)}</span>
            <span class="hud-label">INT</span><span class="hud-val">${escapeHtml(intel)}</span>
            <span class="hud-label">CAPS</span><span class="hud-val">${escapeHtml(caps)}</span>
          </div>
          <div class="hud-row">
            <span class="hud-label">BOBBY PINS</span><span class="hud-val">${escapeHtml(bobby)}</span>
          </div>
        </div>
      `;
    },

    _updateRoomInfo(room) {
      const infoEl = document.getElementById("dungeon-room-info");
      if (!infoEl) return;

      const cleared = this._state.clearedRooms.has(room.id);
      const looted  = this._state.lootedRooms.has(room.id);
      const hasEnemies = room.enemies.length > 0 && !cleared;
      const hasLoot    = room.loot.length > 0 && !looted;

      // Toggle class for CSS `:has()` fallback (older browser compatibility)
      infoEl.classList.toggle("has-threats", hasEnemies);

      const doorList = Object.entries(room.doors)
        .map(([dir, d]) => {
          const doorLabel = {
            open: `<span class="dl-open">${dir}: OPEN</span>`,
            locked: `<span class="dl-locked">${dir}: LOCKED [BOBBY PIN]</span>`,
            keycard: `<span class="dl-keycard">${dir}: KEYCARD REQUIRED</span>`,
            terminal: `<span class="dl-terminal">${dir}: TERMINAL LOCK</span>`,
          }[d.type] || `${dir}: UNKNOWN`;
          return doorLabel;
        })
        .join(" &nbsp;|&nbsp; ");

      const statusBadge = cleared
        ? `<span class="room-badge badge-cleared">CLEARED</span>`
        : hasEnemies
          ? `<span class="room-badge badge-danger">HOSTILE</span>`
          : `<span class="room-badge badge-safe">SAFE</span>`;

      const roomDesc = this._roomDescription(room);

      infoEl.innerHTML = `
        <div class="room-name">${escapeHtml(room.name)} ${statusBadge}</div>
        <div class="room-type-tag">[${escapeHtml(room.type.replace(/_/g," ").toUpperCase())}]</div>
        <div class="room-desc">${escapeHtml(roomDesc)}</div>
        <div class="room-doors">${doorList || "No connecting doors"}</div>
        ${hasEnemies ? `<div class="room-threats">⚠ THREATS: ${room.enemies.map(e => escapeHtml(e.name)).join(", ")}</div>` : ""}
        ${hasLoot    ? `<div class="room-loot-notice">$ LOOT AVAILABLE</div>` : ""}
        ${looted     ? `<div class="room-looted-notice">— Already looted —</div>` : ""}
      `;
    },

    _roomDescription(room) {
      const theme = this._state && this._state.theme;

      if (theme === "communist_vault") {
        const commDescs = {
          entrance:       "Red stars stencilled every two meters. The walls are brushed steel painted a deep crimson. A recorded voice from a damaged speaker plays a propaganda bulletin on loop, cutting in and out.",
          corridor:       "Conveyor belts run along both sides — still moving, still carrying partially assembled robot components toward fabrication bays that have never stopped. The noise is constant.",
          loot_room:      "Sealed Soviet arms crates line the walls, stacked ceiling-high. Most are two hundred years old. Some are not.",
          encounter_room: "Fabrication equipment fills the space — arc welders, chassis clamps, calibration rigs. The robots built here never asked where they were going.",
          boss_room:      "The command center. Red light from a dozen status terminals. A single throne-like chair, built for a Commissar that never sits. The air smells of ozone and certainty.",
          terminal_room:  "Directive terminals, amber screens still scrolling production quotas and ideological bulletins. The count ticks upward. It has not stopped since 2077.",
          storage:        "Component silos floor to ceiling. Reactor parts, servo assemblies, targeting arrays — enough to build an army. Someone was building one.",
        };
        return commDescs[room.type] || "Another section of the Directive's endless factory. The machines don't notice you.";
      }

      const descs = {
        entrance:       "The entrance chamber. Flickering lights cast long shadows across the scuffed floor.",
        corridor:       "A long, narrow passage. Pipes run along the ceiling, dripping with condensation.",
        loot_room:      "Shelves line the walls, stacked with pre-war supplies in various states of decay.",
        encounter_room: "Boot prints in the dust suggest this area is heavily patrolled. Stay sharp.",
        boss_room:      "The air tastes of ozone and old power. Something powerful waits in the darkness.",
        terminal_room:  "Banks of terminals hum softly. Their screens glow with amber text.",
        storage:        "Crates and barrels are piled high. Could be anything in them — or nothing at all.",
      };
      return descs[room.type] || "An unremarkable room. You feel watched.";
    },

    _updateActions(room) {
      const actEl = document.getElementById("dungeon-actions");
      if (!actEl) return;

      const state   = this._state;
      const cleared = state.clearedRooms.has(room.id);
      const looted  = state.lootedRooms.has(room.id);
      const hasEnemies = room.enemies.length > 0 && !cleared;
      const hasLoot    = room.loot.length > 0 && !looted;
      const isTermRoom = room.type === "terminal_room";

      const dirButtons = Object.entries(room.doors)
        .map(([dir, door]) => {
          const label = { N:"▲ NORTH", S:"▼ SOUTH", E:"► EAST", W:"◄ WEST" }[dir] || dir;
          return `<button class="dungeon-btn btn-move" data-dir="${escapeHtml(dir)}" data-to="${escapeHtml(door.to)}" data-door="${escapeHtml(door.type)}">${escapeHtml(label)}</button>`;
        })
        .join("");

      const fightBtn  = hasEnemies
        ? `<button class="dungeon-btn btn-fight" id="dungeon-fight-btn">⚔ ENGAGE ENEMIES</button>` : "";
      const lootBtn   = hasLoot && !hasEnemies
        ? `<button class="dungeon-btn btn-loot" id="dungeon-loot-btn">$ COLLECT LOOT</button>` : "";
      const termBtn   = isTermRoom && !cleared
        ? `<button class="dungeon-btn btn-terminal" id="dungeon-terminal-btn">T ACCESS TERMINAL</button>` : "";
      const examineBtn = `<button class="dungeon-btn btn-examine" id="dungeon-examine-btn">🔍 EXAMINE</button>`;

      actEl.innerHTML = `
        <div class="dungeon-actions-inner">
          <div class="actions-section">
            <div class="actions-label">≡ MOVEMENT ≡</div>
            <div class="actions-dir-btns">${dirButtons || "<span class='no-exits'>No exits</span>"}</div>
          </div>
          <div class="actions-section">
            <div class="actions-label">≡ ACTIONS ≡</div>
            <div class="actions-row">
              ${fightBtn}${lootBtn}${termBtn}${examineBtn}
            </div>
          </div>
        </div>
      `;

      // Bind move buttons
      actEl.querySelectorAll(".btn-move").forEach(btn => {
        btn.addEventListener("click", () => {
          const toRoom  = parseInt(btn.dataset.to, 10);
          const doorType = btn.dataset.door;
          this._handleMove(toRoom, doorType);
        });
      });

      const fightBtnEl = actEl.querySelector("#dungeon-fight-btn");
      if (fightBtnEl) fightBtnEl.addEventListener("click", () => this._handleFight(room));

      const lootBtnEl = actEl.querySelector("#dungeon-loot-btn");
      if (lootBtnEl) lootBtnEl.addEventListener("click", () => this._handleLoot(room));

      const termBtnEl = actEl.querySelector("#dungeon-terminal-btn");
      if (termBtnEl) termBtnEl.addEventListener("click", () => this._handleTerminalDoor(room, null));

      const examBtnEl = actEl.querySelector("#dungeon-examine-btn");
      if (examBtnEl) examBtnEl.addEventListener("click", () => this._handleExamine(room));
    },

    // --------------------------------------------------------
    // Move handling
    // --------------------------------------------------------
    _handleMove(toRoomId, doorType) {
      switch (doorType) {
        case "open":
          this._moveToRoom(toRoomId);
          break;
        case "locked":
          this._handleLockpick(toRoomId);
          break;
        case "keycard":
          this._handleKeycard(toRoomId);
          break;
        case "terminal":
          this._handleTerminalDoor(null, toRoomId);
          break;
        default:
          this._moveToRoom(toRoomId);
      }
    },

    _moveToRoom(roomId) {
      const state = this._state;
      const room  = state.rooms[roomId];
      if (!room) return;

      const cx = room.x + Math.floor(room.w / 2);
      const cy = room.y + Math.floor(room.h / 2);
      state.playerX = cx;
      state.playerY = cy;

      this._log(`You enter the ${room.name}.`);
      this._showRoom(roomId);
    },

    // --------------------------------------------------------
    // Lockpick mini-game
    // --------------------------------------------------------
    _handleLockpick(toRoomId) {
      const bobby = this._getBobbyPins();
      if (bobby <= 0) {
        this._log("⚠ No bobby pins! You need a bobby pin to pick this lock.");
        this._showNotification("NO BOBBY PINS", "You need at least one bobby pin to attempt this lock.", "warning");
        return;
      }

      const agility = this._getSPECIAL("A");
      // Success chance: 20% base + 8% per Agility point (max ~100% at A=10)
      const chance = Math.min(0.95, 0.20 + (agility * 0.08));
      this._showLockpickPanel(toRoomId, chance, bobby);
    },

    _showLockpickPanel(toRoomId, chance, bobby) {
      const panel = document.getElementById("dungeon-minigame-panel");
      if (!panel) return;

      const pct = Math.round(chance * 100);

      panel.innerHTML = `
        <div class="minigame-lockpick">
          <div class="mg-title">╔══ LOCKPICKING ══╗</div>
          <div class="mg-ascii">
            <pre class="lockpick-art">
   ___________
  |    LOCK   |
  |  _______  |
  | |  ___  | |
  | | |   | | |
  | |_|___|_| |
  |___________|
   [  <span class="pin-indicator">PIN</span>  ]
            </pre>
          </div>
          <div class="mg-info">
            <p>AGILITY: ${escapeHtml(this._getSPECIAL("A"))} &nbsp;|&nbsp; SUCCESS CHANCE: ${escapeHtml(pct)}%</p>
            <p>BOBBY PINS REMAINING: <span id="bobby-count">${escapeHtml(bobby)}</span></p>
            <p class="mg-warn">⚠ Each failed attempt breaks one bobby pin!</p>
          </div>
          <div class="mg-actions">
            <button class="dungeon-btn btn-pick" id="lockpick-attempt-btn">🔓 ATTEMPT PICK</button>
            <button class="dungeon-btn btn-cancel" id="lockpick-cancel-btn">✕ CANCEL</button>
          </div>
          <div id="lockpick-result" class="mg-result"></div>
        </div>
      `;

      panel.style.display = "flex";

      document.getElementById("lockpick-attempt-btn").addEventListener("click", () => {
        this._attemptLockpick(toRoomId, chance, panel);
      });
      document.getElementById("lockpick-cancel-btn").addEventListener("click", () => {
        panel.style.display = "none";
      });
    },

    _attemptLockpick(toRoomId, chance, panel) {
      const resultEl = document.getElementById("lockpick-result");
      // Consume one bobby pin regardless
      this._consumeBobbyPin();

      const roll = cryptoRandFloat();
      const success = roll < chance;

      if (success) {
        resultEl.className = "mg-result result-success";
        resultEl.textContent = "✔ LOCK DEFEATED! The door swings open.";
        this._log("🔓 Lock picked successfully!");

        // Mark door as open in state
        this._openDoor(this._state.currentRoomId, toRoomId);

        setTimeout(() => {
          panel.style.display = "none";
          this._moveToRoom(toRoomId);
        }, 1200);
      } else {
        const remaining = this._getBobbyPins();
        const countEl = document.getElementById("bobby-count");
        if (countEl) countEl.textContent = remaining;

        resultEl.className = "mg-result result-failure";
        if (remaining <= 0) {
          resultEl.textContent = "✘ Pick broken! No more bobby pins.";
          this._log("✘ Bobby pin broke. No more pins left!");
          document.getElementById("lockpick-attempt-btn").disabled = true;
        } else {
          resultEl.textContent = `✘ Pick broke! ${remaining} pin(s) remaining.`;
          this._log(`✘ Bobby pin snapped. ${remaining} pins left.`);
        }
      }

      this._updateHUD();
    },

    // --------------------------------------------------------
    // Keycard check
    // --------------------------------------------------------
    _handleKeycard(toRoomId) {
      const hasCard = this._hasKeycard();
      if (hasCard) {
        this._log("🔑 Keycard accepted. Door unlocked.");
        this._openDoor(this._state.currentRoomId, toRoomId);
        this._moveToRoom(toRoomId);
      } else {
        this._log("⛔ Door requires a KEYCARD. You don't have one.");
        this._showNotification(
          "KEYCARD REQUIRED",
          "This door is secured with a keycard reader. Find the matching keycard to proceed.",
          "warning"
        );
      }
    },

    // --------------------------------------------------------
    // Terminal hacking mini-game
    // --------------------------------------------------------
    _handleTerminalDoor(room, toRoomId) {
      const intel = this._getSPECIAL("I");
      this._hackGame = new TerminalHackGame(intel);
      this._showTerminalPanel(toRoomId);
    },

    _showTerminalPanel(toRoomId) {
      const panel = document.getElementById("dungeon-minigame-panel");
      if (!panel) return;

      const game  = this._hackGame;
      const words = game.words;
      const prompt = pick(HACK_PROMPTS);

      const wordListHtml = words.map(w =>
        `<button class="terminal-word" data-word="${escapeHtml(w)}">${escapeHtml(w)}</button>`
      ).join(" ");

      panel.innerHTML = `
        <div class="minigame-terminal">
          <div class="mg-title">╔══ ROBCO TERMINAL INTERFACE ══╗</div>
          <div class="terminal-screen">
            <div class="terminal-prompt">${escapeHtml(prompt)}</div>
            <div class="terminal-prompt">ATTEMPTS REMAINING: <span id="hack-attempts">${escapeHtml(game.remainingAttempts)}</span></div>
            <div class="terminal-prompt">INTELLIGENCE: ${escapeHtml(this._getSPECIAL("I"))}</div>
            <hr class="term-hr"/>
            <div class="terminal-prompt">PASSWORD REQUIRED. SELECT FROM OPTIONS:</div>
            <div id="terminal-word-list" class="terminal-wordlist">${wordListHtml}</div>
            <div id="terminal-guess-history" class="terminal-history"></div>
            <div id="terminal-result" class="mg-result"></div>
          </div>
          <div class="mg-actions">
            <button class="dungeon-btn btn-cancel" id="terminal-cancel-btn">✕ CLOSE TERMINAL</button>
          </div>
        </div>
      `;

      panel.style.display = "flex";

      panel.querySelectorAll(".terminal-word").forEach(btn => {
        btn.addEventListener("click", () => {
          this._attemptHack(btn.dataset.word, toRoomId, panel);
        });
      });

      document.getElementById("terminal-cancel-btn").addEventListener("click", () => {
        panel.style.display = "none";
      });
    },

    _attemptHack(word, toRoomId, panel) {
      const game   = this._hackGame;
      const result = game.guess(word);
      if (!result) return;

      const histEl    = document.getElementById("terminal-guess-history");
      const resultEl  = document.getElementById("terminal-result");
      const attemptsEl = document.getElementById("hack-attempts");

      if (attemptsEl) attemptsEl.textContent = result.attemptsLeft;

      // Disable clicked word
      panel.querySelectorAll(`.terminal-word[data-word="${CSS.escape(word.toUpperCase())}"]`)
        .forEach(b => { b.disabled = true; b.classList.add("word-guessed"); });

      if (histEl) {
        const entry = document.createElement("div");
        entry.className = "hist-entry";
        entry.textContent = `>${escapeHtml(word.toUpperCase())}   LIKENESS=${escapeHtml(result.likeness)}/${escapeHtml(game.targetWord.length)}`;
        histEl.appendChild(entry);
      }

      if (result.correct) {
        resultEl.className = "mg-result result-success";
        resultEl.textContent = "ACCESS GRANTED. WELCOME, VAULT OVERSEER.";
        this._log("💻 Terminal hacked! Door unlocked.");
        if (toRoomId !== null) this._openDoor(this._state.currentRoomId, toRoomId);

        setTimeout(() => {
          panel.style.display = "none";
          if (toRoomId !== null) this._moveToRoom(toRoomId);
          else this._showRoom(this._state.currentRoomId);
        }, 1500);
      } else if (game.isFailed()) {
        resultEl.className = "mg-result result-failure";
        resultEl.textContent = "TERMINAL LOCKED. PLEASE CONTACT YOUR LOCAL ADMINISTRATOR.";
        this._log("💻 Terminal lockout! Too many failed attempts.");
        panel.querySelectorAll(".terminal-word").forEach(b => (b.disabled = true));
      } else {
        resultEl.className = "mg-result result-failure";
        resultEl.textContent = `Incorrect. ${escapeHtml(result.attemptsLeft)} attempt(s) remaining.`;
      }
    },

    // --------------------------------------------------------
    // Fight handler
    // --------------------------------------------------------
    _handleFight(room) {
      if (room.enemies.length === 0) return;

      const theme = THEMES[this._state.theme];
      const enemies = room.enemies.map(e => ({
        name: e.name,
        type: e.type,
        hp:   ENEMY_HP[e.type] || 30,
        attack: Math.floor((ENEMY_HP[e.type] || 30) / 5) + cryptoRandInt(6),
      }));

      const encounter = {
        name:    `${room.name} Encounter`,
        theme:   theme.label,
        enemies,
        onVictory: () => {
          room.cleared = true;
          this._state.clearedRooms.add(room.id);
          this._log(`⚔ ${room.name} cleared!`);
          this._showRoom(room.id);
        },
      };

      if (window.Game && window.Game.modules && window.Game.modules.battles) {
        window.Game.modules.battles.start(encounter);
      } else {
        // Fallback: auto-resolve
        this._log(`⚔ Skirmish in ${room.name}... enemies defeated! (battles module not loaded)`);
        room.cleared = true;
        this._state.clearedRooms.add(room.id);
        this._showRoom(room.id);
      }
    },

    // --------------------------------------------------------
    // Loot handler
    // --------------------------------------------------------
    _handleLoot(room) {
      if (this._state.lootedRooms.has(room.id)) {
        this._log("Already looted this room.");
        return;
      }

      this._state.lootedRooms.add(room.id);
      room.looted = true;

      const itemNames = [];

      for (const item of room.loot) {
        itemNames.push(item.name);
        // Add to inventory if module is available
        if (this.gs && this.gs.inventory) {
          const inv = this.gs.inventory;
          if (!inv.misc) inv.misc = [];
          inv.misc.push({ id: item.id, name: item.name, type: item.type, quantity: 1 });
        }
      }

      // Notify backend — server is authoritative for caps/XP reward.
      // On success, update player caps with the server-returned value.
      this._apiLoot(this._state.dungeonId, room.id).then(data => {
        if (data && data.ok && typeof data.caps === "number") {
          if (this.gs && this.gs.player) {
            this.gs.player.caps = (this.gs.player.caps || 0) + data.caps;
          }
          this._log(`$ Looted: ${itemNames.join(", ")} (+${data.caps} caps, +${data.xp} XP)`);
          this._showNotification(
            "LOOT ACQUIRED",
            `Collected: ${itemNames.join(", ")}\n+${data.caps} caps`,
            "success"
          );
          this._updateHUD();
        }
      }).catch(err => {
        console.warn("[dungeon] apiLoot error:", err);
        // Show items anyway even if server call fails
        this._log(`$ Looted: ${itemNames.join(", ")}`);
        this._showNotification("LOOT ACQUIRED", `Collected: ${itemNames.join(", ")}`, "success");
      });

      this._showRoom(room.id);
    },

    // --------------------------------------------------------
    // Examine action
    // --------------------------------------------------------
    _handleExamine(_room) {
      const flavours = [
        "Radiation readings are within acceptable parameters. Barely.",
        "Scorch marks on the walls suggest a firefight happened here long ago.",
        "Someone scratched 'STAY AWAY' into the concrete. Charming.",
        "The fluorescent lights flicker in a pattern that seems almost... intentional.",
        "Pre-war graffiti reads: 'REMEMBER SHADY SANDS'. Someone misses home.",
        "A holotape lies in the corner, but it's too corrupted to play.",
        "The smell of stale Nuka-Cola lingers. Decades-old syrup.",
        "Emergency lighting casts everything in a bloody red hue.",
        "The silence here is the loudest thing you've heard all day.",
      ];
      this._log(`🔍 ${pick(flavours)}`);
    },

    // --------------------------------------------------------
    // Open a door in both directions
    // --------------------------------------------------------
    _openDoor(fromRoomId, toRoomId) {
      const rooms = this._state.rooms;
      if (!rooms) return;

      // Find and open the door in fromRoom → toRoom
      for (const room of rooms) {
        for (const [_dir, door] of Object.entries(room.doors)) {
          if ((room.id === fromRoomId && door.to === toRoomId) ||
              (room.id === toRoomId && door.to === fromRoomId)) {
            door.type = "open";
          }
        }
      }

      // Update grid door tiles
      this._drawMap();
    },

    // --------------------------------------------------------
    // Log message
    // --------------------------------------------------------
    _log(message) {
      const logEl = document.getElementById("dungeon-log-entries");
      if (!logEl) return;

      const entry = document.createElement("div");
      entry.className = "log-entry";
      const time = new Date().toLocaleTimeString("en-US", { hour12: false, hour:"2-digit", minute:"2-digit" });
      entry.textContent = `[${time}] ${message}`;
      logEl.insertBefore(entry, logEl.firstChild);

      // Keep only last 20 log entries
      while (logEl.children.length > 20) {
        logEl.removeChild(logEl.lastChild);
      }
    },

    // --------------------------------------------------------
    // Notification toast
    // --------------------------------------------------------
    _showNotification(title, body, type) {
      const existing = document.getElementById("dungeon-notify");
      if (existing) existing.remove();

      const n = document.createElement("div");
      n.id = "dungeon-notify";
      const VALID_NOTIFY_TYPES = ["success", "warning", "danger"];
      const safeType = VALID_NOTIFY_TYPES.includes(type) ? type : "success";
      n.className = `dungeon-notify notify-${safeType}`;

      const h = document.createElement("div");
      h.className = "notify-title";
      h.textContent = title;

      const p = document.createElement("div");
      p.className = "notify-body";
      p.textContent = body;

      n.appendChild(h);
      n.appendChild(p);

      const overlay = document.getElementById("dungeon-overlay");
      if (overlay) overlay.appendChild(n);

      setTimeout(() => n.remove(), 4000);
    },

    // --------------------------------------------------------
    // Inventory helpers
    // --------------------------------------------------------
    _getBobbyPins() {
      const inv = this.gs && this.gs.inventory;
      if (!inv) return 0;
      const allItems = [
        ...(inv.misc || []),
        ...(inv.consumables || []),
        ...(inv.questItems || []),
      ];
      const pin = allItems.find(i => i.id === "bobby_pin" || i.name === "Bobby Pin");
      if (!pin) return 0;
      return pin.quantity ?? pin.amount ?? 1;
    },

    _consumeBobbyPin() {
      const inv = this.gs && this.gs.inventory;
      if (!inv) return;
      const pools = [inv.misc, inv.consumables, inv.questItems].filter(Boolean);
      for (const pool of pools) {
        for (let i = pool.length - 1; i >= 0; i--) {
          const item = pool[i];
          if (item.id !== "bobby_pin" && item.name !== "Bobby Pin") continue;
          const qty = item.quantity ?? item.amount ?? 1;
          if (qty <= 1) { pool.splice(i, 1); return; }
          if ("quantity" in item) item.quantity--;
          else item.amount--;
          return;
        }
      }
    },

    _hasKeycard() {
      const inv = this.gs && this.gs.inventory;
      if (!inv) return false;
      const allItems = [
        ...(inv.misc || []),
        ...(inv.questItems || []),
        ...(inv.consumables || []),
      ];
      return allItems.some(i =>
        String(i.id || "").toLowerCase().includes("keycard") ||
        String(i.name || "").toLowerCase().includes("keycard")
      );
    },

    _getSPECIAL(stat) {
      const player  = this.gs && this.gs.player;
      const special = player && player.special;
      if (!special) return 5;
      return Math.max(1, Math.min(10, special[stat] ?? 5));
    },

    // --------------------------------------------------------
    // Exit dungeon
    // --------------------------------------------------------
    exit() {
      // Check if boss room cleared for completion bonus
      const state = this._state;
      if (state) {
        const bossRoom = state.rooms.find(r => r.type === "boss_room");
        const bossCleared = bossRoom && state.clearedRooms.has(bossRoom.id);

        if (bossCleared) {
          this._apiClear(state.dungeonId).catch(err =>
            console.warn("[dungeon] apiClear error:", err)
          );
          this._log("🏆 Dungeon cleared! Bonus rewards dispatched.");
        }

        // Clean up global state
        if (this.gs) this.gs.currentDungeon = null;
        this._state = null;
        this._hackGame = null;
      }

      const overlay = document.getElementById("dungeon-overlay");
      if (overlay) overlay.remove();

      console.log("[dungeon] Exited dungeon");
    },

    // --------------------------------------------------------
    // API calls
    // --------------------------------------------------------
    _sessionId() {
      return localStorage.getItem("sessionId") || "";
    },

    async _apiEnter(poiId, poiType) {
      const sessionId = this._sessionId();
      if (!sessionId) return;

      const res = await fetch(`${API_BASE}/api/dungeon/enter`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionId}`,
        },
        body: JSON.stringify({ poiId, poiType }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    },

    async _apiLoot(dungeonId, roomId) {
      const sessionId = this._sessionId();
      if (!sessionId) return null;

      const res = await fetch(`${API_BASE}/api/dungeon/loot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionId}`,
        },
        body: JSON.stringify({ dungeonId, roomId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    },

    async _apiClear(dungeonId) {
      const sessionId = this._sessionId();
      if (!sessionId) return;

      const res = await fetch(`${API_BASE}/api/dungeon/clear`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionId}`,
        },
        body: JSON.stringify({ dungeonId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
  };

  // ----------------------------------------------------------
  // Expose module
  // ----------------------------------------------------------
  window.Game.modules.dungeon = dungeonModule;

})();
