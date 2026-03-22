// public/js/modules/faction-raids.js
// -----------------------------------------------------------------------
// Atomic Fizz Caps – Faction Raid System
// -----------------------------------------------------------------------
// Generates dynamic faction raids triggered by GPS position, time, and
// faction hostility. Dispatches CustomEvents for the UI layer to handle.
//
// Attaches to: Game.modules.factionRaids
//
// SECURITY: All RNG uses crypto.getRandomValues(). No Math.random().
// -----------------------------------------------------------------------

(function () {
  'use strict';

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  // -----------------------------------------------------------------------
  // Secure RNG helpers
  // -----------------------------------------------------------------------
  const _rngBuf  = new Uint32Array(1);
  const _rngBuf4 = new Uint32Array(4);

  function _rand() {
    crypto.getRandomValues(_rngBuf);
    return _rngBuf[0] / 0x100000000;
  }

  function _randInt(min, max) {
    const range = Math.max(1, max - min + 1);
    crypto.getRandomValues(_rngBuf);
    return min + (_rngBuf[0] % range);
  }

  function _pick(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[_randInt(0, arr.length - 1)];
  }

  function _shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      crypto.getRandomValues(_rngBuf);
      const j = _rngBuf[0] % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // -----------------------------------------------------------------------
  // Faction raid profiles
  // -----------------------------------------------------------------------
  const FACTION_RAID_PROFILES = {
    raiders: {
      name           : 'Raiders',
      hostility_base : 0.6,
      unit_names     : ['Raider Psycho', 'Raider Grunt', 'Raider Leader', 'Raider Veteran'],
      boss_names     : ['Raider Warlord', 'The Butcher', 'Scar Face'],
      raid_flavor    : [
        'A raider war party has spotted your Pip-Boy signal and wants what you\'re carrying.',
        'Raiders are converging on your position. Someone put a bounty on you.',
        'A raider convoy has diverted from its route. You\'re the new target.',
      ],
      loot_flavor    : 'raider_cache',
    },
    gunners: {
      name           : 'Gunners',
      hostility_base : 0.4,
      unit_names     : ['Gunner Private', 'Gunner Corporal', 'Gunner Sergeant', 'Gunner Captain'],
      boss_names     : ['Gunner Commander', 'Major Gutsy', 'Colonel Blackwood'],
      raid_flavor    : [
        'A Gunner fire team has a contract on your GPS signature.',
        'Gunner mercenaries have been hired to eliminate you. The contract came through Acela terminal.',
        'A Gunner patrol has identified you as a target of opportunity.',
      ],
      loot_flavor    : 'gunner_military_cache',
    },
    super_mutants: {
      name           : 'Super Mutants',
      hostility_base : 0.7,
      unit_names     : ['Super Mutant', 'Super Mutant Brute', 'Super Mutant Overlord', 'Nightkin'],
      boss_names     : ['Super Mutant Behemoth', 'Nightkin Master', 'Fist'],
      raid_flavor    : [
        'Super Mutants have picked up your scent. They\'re moving fast.',
        'A Nightkin patrol is tracking your movement pattern. They saw you before you saw them.',
        'Super Mutant hunting party. They want you for the herd.',
      ],
      loot_flavor    : 'mutant_stash',
    },
    brotherhood_of_steel: {
      name           : 'Brotherhood of Steel',
      hostility_base : 0.25,
      unit_names     : ['Brotherhood Initiate', 'Brotherhood Knight', 'Brotherhood Paladin'],
      boss_names     : ['Elder\'s Champion', 'Paladin Commander'],
      raid_flavor    : [
        'A Brotherhood patrol has flagged your technology signature as unauthorized.',
        'Brotherhood Knights are moving to confiscate your equipment. Elder\'s orders.',
        'Brotherhood recon team has marked you as non-compliant. They\'re en route.',
      ],
      loot_flavor    : 'brotherhood_armory_cache',
    },
    enclave: {
      name           : 'Enclave',
      hostility_base : 0.8,
      unit_names     : ['Enclave Soldier', 'Enclave Officer', 'Enclave Science Officer'],
      boss_names     : ['Enclave Commander', 'Hellfire Trooper', 'Colonel Autumn\'s Clone'],
      raid_flavor    : [
        'Enclave forces have flagged your biological signature. They want samples.',
        'An Enclave Vertibird has been tracking your GPS position for the last hour.',
        'Enclave soldiers are executing a target elimination protocol. You\'re the target.',
      ],
      loot_flavor    : 'enclave_tech_cache',
    },
    children_of_atom: {
      name           : 'Children of Atom',
      hostility_base : 0.35,
      unit_names     : ['Atom\'s Warrior', 'Atom\'s Zealot', 'Glowing One', 'High Confessor\'s Guard'],
      boss_names     : ['High Confessor', 'Atom\'s Chosen', 'The Radiant One'],
      raid_flavor    : [
        'Children of Atom believe you have desecrated a sacred site. They seek purification.',
        'Glowing Ones are converging on your position. Atom has spoken.',
        'Children of Atom zealots have declared your GPS location a Zone of Cleansing.',
      ],
      loot_flavor    : 'atom_shrine_cache',
    },
    institute: {
      name           : 'The Institute',
      hostility_base : 0.5,
      unit_names     : ['Gen-2 Synth', 'Gen-3 Synth', 'Institute Courser'],
      boss_names     : ['Institute Courser Unit', 'Z-2A Strike Team'],
      raid_flavor    : [
        'Institute Coursers have a retrieval order for your technological assets.',
        'A Synth strike team has been deployed to your coordinates.',
        'The Institute has flagged you as a threat to their operations. Coursers incoming.',
      ],
      loot_flavor    : 'institute_polymer_cache',
    },
  };

  // -----------------------------------------------------------------------
  // Raid type definitions
  // -----------------------------------------------------------------------
  const RAID_TYPES = {
    ambush: {
      id          : 'ambush',
      name        : 'Ambush',
      description : 'Enemies have set a trap. Escape or fight through.',
      wave_count  : { min: 1, max: 2 },
      has_boss    : false,
      loot_multiplier: 1.2,
      escape_window_ms: 15_000,
    },
    supply_convoy_attack: {
      id          : 'supply_convoy_attack',
      name        : 'Convoy Attack',
      description : 'A faction supply convoy has been diverted to deal with you.',
      wave_count  : { min: 2, max: 3 },
      has_boss    : false,
      loot_multiplier: 1.8,
      escape_window_ms: 20_000,
    },
    faction_war_zone: {
      id          : 'faction_war_zone',
      name        : 'War Zone',
      description : 'You\'ve walked into an active faction conflict. Both sides just noticed you.',
      wave_count  : { min: 3, max: 4 },
      has_boss    : true,
      loot_multiplier: 2.5,
      escape_window_ms: 0, // No clean escape
    },
    boss_patrol: {
      id          : 'boss_patrol',
      name        : 'Boss Patrol',
      description : 'A faction elite unit is on patrol. Their leader is with them.',
      wave_count  : { min: 1, max: 2 },
      has_boss    : true,
      loot_multiplier: 3.0,
      escape_window_ms: 10_000,
    },
  };

  // -----------------------------------------------------------------------
  // Cooldown and trigger tracking
  // -----------------------------------------------------------------------
  const _raidCooldowns = new Map(); // factionId → last raid timestamp
  const _lastRaidCheck = { ts: 0 };

  const RAID_COOLDOWN_MS   = 5 * 60_000;  // 5 minutes between raids from same faction
  const RAID_CHECK_INTERVAL_MS = 30_000;  // Check every 30 seconds max

  // Raid frequency multiplier applied to base faction hostility chance.
  // Tuned so that a maximally hostile faction at high player level triggers
  // roughly one raid every 10-15 minutes of active play. Reduce to lower
  // overall raid frequency without changing individual faction profiles.
  const RAID_FREQUENCY_MULTIPLIER = 0.15;

  // -----------------------------------------------------------------------
  // Module
  // -----------------------------------------------------------------------
  const factionRaids = {

    // ----------------------------------------------------------------
    // checkForRaid(playerPos, currentTime) → null | raidData
    // Probabilistic check; returns a raid object or null.
    // playerPos: { lat: number, lng: number }
    // currentTime: timestamp ms (Date.now())
    // ----------------------------------------------------------------
    checkForRaid(playerPos, currentTime) {
      const now = currentTime || Date.now();

      // Rate-limit checks to avoid every-frame spam
      if (now - _lastRaidCheck.ts < RAID_CHECK_INTERVAL_MS) return null;
      _lastRaidCheck.ts = now;

      // Need faction and player info
      const factions   = Game.modules.factions;
      const _world      = Game.modules.world;
      const playerState = window.PlayerState || (window.Game && Game.playerState);

      if (!factions || !playerState) return null;

      const playerLevel = playerState.level || playerState.xp_level || 1;
      const allFactions = factions.getAll ? factions.getAll() : [];

      // Find a faction that wants to raid us
      for (const faction of _shuffle(allFactions)) {
        const factionId = faction.id;

        // Skip if on cooldown
        const lastRaid = _raidCooldowns.get(factionId) || 0;
        if (now - lastRaid < RAID_COOLDOWN_MS) continue;

        // Check hostility
        const rep = factions.getReputation ? factions.getReputation(playerState, factionId) : null;
        const score = rep ? (rep.score || 0) : 0;

        if (score > -25) continue; // Not hostile enough to raid

        // Probability scales with hostility and player level
        const profile     = FACTION_RAID_PROFILES[factionId];
        const baseChance  = profile ? profile.hostility_base : 0.3;
        const levelFactor = Math.min(2.0, 1 + playerLevel / 30);
        const hostileFactor = Math.min(2.0, Math.abs(score) / 50);
        const triggerChance = baseChance * levelFactor * hostileFactor * RAID_FREQUENCY_MULTIPLIER;

        if (_rand() < triggerChance) {
          _raidCooldowns.set(factionId, now);

          const raid = this.generateRaid(factionId, playerLevel);
          if (raid) {
            // Dispatch event for UI
            try {
              window.dispatchEvent(new CustomEvent('factionRaid', { detail: raid }));
            } catch (_) { /* non-DOM */ }
            return raid;
          }
        }
      }

      return null;
    },

    // ----------------------------------------------------------------
    // generateRaid(factionId, playerLevel) → raidData object
    // ----------------------------------------------------------------
    generateRaid(factionId, playerLevel) {
      const profile = FACTION_RAID_PROFILES[factionId];
      if (!profile) {
        console.warn(`[faction-raids] Unknown faction: ${factionId}`);
        return null;
      }

      const level = Math.max(1, Number(playerLevel) || 1);

      // Pick raid type — escalate with level
      const raidTypeId = this._pickRaidType(level);
      const raidType   = RAID_TYPES[raidTypeId];

      // Generate waves
      const waveCount = _randInt(raidType.wave_count.min, raidType.wave_count.max);
      const waves     = [];

      for (let w = 0; w < waveCount; w++) {
        waves.push(this._generateWave(profile, level, w + 1, waveCount));
      }

      // Boss wave
      let boss = null;
      if (raidType.has_boss) {
        boss = this._generateBoss(profile, level);
      }

      // Narrative flavor
      const flavor = _pick(profile.raid_flavor) || `${profile.name} forces are converging on your position.`;

      const raid = {
        id             : _generateRaidId(),
        faction_id     : factionId,
        faction_name   : profile.name,
        raid_type      : raidTypeId,
        raid_type_name : raidType.name,
        description    : raidType.description,
        narrative_flavor: flavor,
        waves,
        boss,
        wave_count     : waveCount,
        loot_multiplier: raidType.loot_multiplier,
        loot_pool      : profile.loot_flavor,
        escape_window_ms: raidType.escape_window_ms,
        player_level   : level,
        started_at     : Date.now(),
        status         : 'incoming', // incoming | active | completed | escaped | failed
      };

      console.log(`[faction-raids] Generated ${raidTypeId} raid from ${factionId} (${waveCount} waves, boss: ${!!boss})`);
      return raid;
    },

    // ----------------------------------------------------------------
    // _pickRaidType(playerLevel) → raidTypeId string
    // Higher level players face more complex raids.
    // ----------------------------------------------------------------
    _pickRaidType(playerLevel) {
      // Weight table: [ambush, convoy, war_zone, boss_patrol]
      let weights;
      if (playerLevel < 10) {
        weights = [70, 20, 5, 5];
      } else if (playerLevel < 25) {
        weights = [40, 35, 15, 10];
      } else if (playerLevel < 50) {
        weights = [25, 30, 30, 15];
      } else {
        weights = [15, 25, 35, 25];
      }

      const total = weights.reduce((a, b) => a + b, 0);
      // Use _rand() float to avoid modulo bias with non-power-of-2 totals
      let roll = Math.floor(_rand() * total);

      const types = ['ambush', 'supply_convoy_attack', 'faction_war_zone', 'boss_patrol'];
      for (let i = 0; i < types.length; i++) {
        if (roll < weights[i]) return types[i];
        roll -= weights[i];
      }
      return 'ambush';
    },

    // ----------------------------------------------------------------
    // _generateWave(profile, playerLevel, waveNum, totalWaves) → wave object
    // ----------------------------------------------------------------
    _generateWave(profile, playerLevel, waveNum, totalWaves) {
      // Enemy count scales with wave number and player level
      const baseCount = _randInt(2, 4);
      const levelBonus = Math.floor(playerLevel / 10);
      const enemyCount = Math.min(8, baseCount + levelBonus + waveNum - 1);

      const enemies = [];
      for (let i = 0; i < enemyCount; i++) {
        const unitName = _pick(profile.unit_names) || 'Enemy';
        const levelVariance = _randInt(-2, 3);
        const enemyLevel = Math.max(1, playerLevel + levelVariance - 2);

        enemies.push({
          name   : unitName,
          level  : enemyLevel,
          hp     : _calculateEnemyHp(unitName, enemyLevel),
          damage : _calculateEnemyDamage(unitName, enemyLevel),
          type   : _classifyUnitType(unitName),
        });
      }

      return {
        wave_number: waveNum,
        is_last    : waveNum === totalWaves,
        enemy_count: enemyCount,
        enemies,
      };
    },

    // ----------------------------------------------------------------
    // _generateBoss(profile, playerLevel) → boss object
    // ----------------------------------------------------------------
    _generateBoss(profile, playerLevel) {
      const bossName = _pick(profile.boss_names) || `${profile.name} Leader`;
      const bossLevel = playerLevel + _randInt(2, 6);

      return {
        name   : bossName,
        level  : bossLevel,
        hp     : _calculateEnemyHp(bossName, bossLevel) * 3,
        damage : _calculateEnemyDamage(bossName, bossLevel) * 1.5,
        type   : 'boss',
        drops  : _generateBossDrops(bossLevel),
      };
    },

    // ----------------------------------------------------------------
    // resolveEscape(raidData) → { success: bool, penaltyXP: number }
    // Call when player attempts to escape a raid.
    // ----------------------------------------------------------------
    resolveEscape(raidData) {
      if (!raidData) return { success: false, penaltyXP: 0 };

      const now = Date.now();
      const elapsed = now - (raidData.started_at || now);
      const window  = raidData.escape_window_ms || 0;

      if (window === 0) {
        return { success: false, penaltyXP: 0, reason: 'No escape from war zones.' };
      }

      if (elapsed <= window) {
        // Within escape window — guaranteed success
        raidData.status = 'escaped';
        return { success: true, penaltyXP: 0 };
      }

      // Past window — escape chance decreases over time
      const extraTime   = elapsed - window;
      const escapePct   = Math.max(0.05, 1 - (extraTime / 60_000)); // 0% after 1 extra minute
      const escapeRoll  = _rand();

      if (escapeRoll < escapePct) {
        raidData.status = 'escaped';
        const penalty = Math.floor(raidData.player_level * 5 * (1 - escapePct));
        return { success: true, penaltyXP: penalty };
      }

      return { success: false, penaltyXP: 0, reason: 'Escape route blocked.' };
    },

    // ----------------------------------------------------------------
    // completeRaid(raidData, _playerState) → loot array
    // Awards loot based on raid type and player performance.
    // ----------------------------------------------------------------
    completeRaid(raidData, _playerState) {
      if (!raidData) return [];

      raidData.status = 'completed';
      const level = raidData.player_level || 1;

      // Generate loot
      const baseItemCount = _randInt(2, 4);
      const multipliedCount = Math.ceil(baseItemCount * raidData.loot_multiplier);
      const lootItems = [];

      for (let i = 0; i < multipliedCount; i++) {
        lootItems.push(_generateLootItem(raidData.loot_pool, level));
      }

      // Boss bonus loot
      if (raidData.boss && raidData.boss.drops) {
        lootItems.push(...raidData.boss.drops);
      }

      console.log(`[faction-raids] Raid complete — ${lootItems.length} loot items`);

      // Dispatch completion event
      try {
        window.dispatchEvent(new CustomEvent('factionRaidComplete', {
          detail: { raidData, loot: lootItems },
        }));
      } catch (_) { /* non-DOM */ }

      return lootItems;
    },

    // ----------------------------------------------------------------
    // getRaidSummary(raidData) → string
    // ----------------------------------------------------------------
    getRaidSummary(raidData) {
      if (!raidData) return 'No raid data.';
      return [
        `${raidData.faction_name} — ${raidData.raid_type_name}`,
        raidData.narrative_flavor,
        `Waves: ${raidData.wave_count}${raidData.boss ? ' + Boss' : ''}`,
        `Loot Multiplier: ${raidData.loot_multiplier}x`,
      ].join('\n');
    },

    // ----------------------------------------------------------------
    // clearCooldown(factionId) → void
    // For testing or admin reset.
    // ----------------------------------------------------------------
    clearCooldown(factionId) {
      if (factionId) {
        _raidCooldowns.delete(factionId);
      } else {
        _raidCooldowns.clear();
      }
    },
  };

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  function _generateRaidId() {
    crypto.getRandomValues(_rngBuf4);
    return 'raid_' + Array.from(_rngBuf4).map(n => n.toString(16).padStart(8, '0')).join('');
  }

  function _classifyUnitType(name) {
    const n = name.toLowerCase();
    if (n.includes('behemoth') || n.includes('boss') || n.includes('warlord') || n.includes('commander')) return 'heavy';
    if (n.includes('nightkin') || n.includes('courser') || n.includes('ghost')) return 'stealth';
    if (n.includes('glowing') || n.includes('irradiated')) return 'radiation';
    return 'standard';
  }

  function _calculateEnemyHp(name, level) {
    const type = _classifyUnitType(name);
    const base = type === 'heavy' ? 120 : type === 'stealth' ? 70 : 80;
    return Math.round(base + level * 8 + _randInt(-10, 20));
  }

  function _calculateEnemyDamage(name, level) {
    const type = _classifyUnitType(name);
    const base = type === 'heavy' ? 18 : type === 'stealth' ? 22 : 12;
    return Math.round(base + level * 1.5 + _randInt(-3, 5));
  }

  function _generateBossDrops(bossLevel) {
    const pool = [
      'boss_weapon_mod', 'faction_insignia', 'rare_ammo_pack',
      'boss_armor_piece', 'legendary_component', 'fizz_credit_chip',
    ];
    const count = _randInt(1, 3);
    const drops = [];
    for (let i = 0; i < count; i++) {
      drops.push({
        id      : _pick(pool),
        level   : bossLevel,
        quantity: 1,
        rarity  : bossLevel >= 40 ? 'legendary' : bossLevel >= 20 ? 'rare' : 'uncommon',
      });
    }
    return drops;
  }

  // Faction loot pool → item mapping
  const LOOT_POOL_ITEMS = {
    raider_cache           : ['raider_armor', 'pipe_pistol', 'ammo_38', 'caps_pouch', 'stimpak', 'rad_away'],
    gunner_military_cache  : ['combat_armor_piece', 'assault_rifle', 'ammo_556', 'military_ration', 'frag_grenade'],
    mutant_stash           : ['super_sledge_dented', 'radiation_source', 'mutant_flesh_sample', 'big_gun_ammo'],
    brotherhood_armory_cache: ['laser_pistol', 'fusion_core', 't45_armor_piece', 'brotherhood_holotape'],
    enclave_tech_cache     : ['plasma_pistol', 'advanced_power_cell', 'enclave_uniform', 'tesla_coil_component'],
    atom_shrine_cache      : ['atom_glory_robe', 'glowing_one_gland', 'atom_cats_token', 'irradiated_mushroom'],
    institute_polymer_cache: ['synth_component', 'institute_laser_pistol', 'gen3_neural_chip', 'biometric_scanner'],
    mutant_stash_default   : ['junk_pile', 'ammo_misc', 'stimpak', 'dirty_water'],
  };

  function _generateLootItem(poolKey, playerLevel) {
    const pool  = LOOT_POOL_ITEMS[poolKey] || LOOT_POOL_ITEMS.mutant_stash_default;
    const itemId = _pick(pool) || 'scrap_metal';

    // Rarity roll — scales with level
    const epicChance = Math.min(0.15, 0.02 + playerLevel * 0.002);
    const rareChance = Math.min(0.35, 0.10 + playerLevel * 0.004);
    const roll = _rand();

    let rarity;
    if (roll < epicChance)                       rarity = 'epic';
    else if (roll < epicChance + rareChance)     rarity = 'rare';
    else if (roll < epicChance + rareChance + 0.3) rarity = 'uncommon';
    else                                         rarity = 'common';

    return {
      id       : itemId,
      name     : itemId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      rarity,
      quantity : rarity === 'common' ? _randInt(1, 3) : 1,
      source   : 'faction_raid',
    };
  }

  // -----------------------------------------------------------------------
  // Register module
  // -----------------------------------------------------------------------
  Game.modules.factionRaids = factionRaids;

  console.log('[faction-raids] module loaded — raid types:', Object.keys(RAID_TYPES).join(', '));
})();
