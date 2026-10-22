// public/js/modules/economy-roles.js
// -----------------------------------------------------------------------
// Atomic Fizz Caps – Player Economy Roles Module
// -----------------------------------------------------------------------
// Enables players to adopt a role in the wasteland economy, unlocking
// perks, trade bonuses, special inventory access, and crafting recipes.
//
// Attaches to: Game.modules.economyRoles
//
// SECURITY: All RNG uses crypto.getRandomValues(). No Math.random().
// XSS: All user-visible strings must go through escapeHtml() before
//       being inserted into innerHTML (handled by callers).
// -----------------------------------------------------------------------

(function () {
  'use strict';

  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  // -----------------------------------------------------------------------
  // Secure RNG helper
  // -----------------------------------------------------------------------
  const _rngBuf = new Uint32Array(1);
  function _secureRandom() {
    crypto.getRandomValues(_rngBuf);
    return _rngBuf[0] / 0x100000000; // [0, 1)
  }

  function _secureRandInt(min, max) {
    // Returns integer in [min, max] inclusive
    const range = max - min + 1;
    return min + Math.floor(_secureRandom() * range);
  }

  // -----------------------------------------------------------------------
  // Role definitions
  // -----------------------------------------------------------------------
  const ROLES = {
    arms_dealer: {
      id          : 'arms_dealer',
      name        : 'Arms Dealer',
      description : 'You traffic in weapons and ammunition, keeping the wasteland\'s warriors supplied.',
      lore        : 'Caps flow toward those who control the means of violence. You\'ve learned that lesson well.',
      unlockLevel : 5,
      perks       : [
        { id: 'weapon_appraisal',    name: 'Weapon Appraisal',    description: 'Identify weapon condition and hidden value instantly. +15% sell price on weapons.' },
        { id: 'bulk_ammo_discount',  name: 'Bulk Ammo Discount',  description: 'Manufacture or purchase ammo in bulk. -20% buy price on all ammunition.' },
        { id: 'dealer_reputation',   name: 'Dealer Reputation',   description: 'Known suppliers get better deals. Unlocks exclusive stock from faction arms caches.' },
        { id: 'weapon_modification', name: 'Field Modification',  description: 'Modify weapons in the field without a workbench. +1 mod slot on owned weapons.' },
      ],
      tradeBonuses: {
        weapons   : { buy: -0.15, sell: 0.20 },
        ammo      : { buy: -0.20, sell: 0.15 },
        armor     : { buy: -0.05, sell: 0.05 },
        consumables: { buy: 0,   sell: 0 },
      },
      specialItems: [
        'dealer_exclusive_pistol', 'surplus_ammo_crate', 'weapon_mod_kit',
        'pre_war_rifle_schematic', 'military_grade_suppressor', 'explosive_rounds_pack',
      ],
      craftableRecipes: ['weapon_mod_basic', 'weapon_mod_advanced', 'ammo_manufacture_9mm', 'ammo_manufacture_308'],
      iconClass : 'role-icon-arms',
    },

    field_medic: {
      id          : 'field_medic',
      name        : 'Field Medic',
      description : 'You keep people alive in a world determined to kill them.',
      lore        : 'Every life you save is a defiance of the bomb. You\'ve made it personal.',
      unlockLevel : 3,
      perks       : [
        { id: 'triage_expert',    name: 'Triage Expert',    description: 'Heal 40% more HP with stimpaks and medical items.' },
        { id: 'chem_efficiency',  name: 'Chem Efficiency',  description: 'Medical chems last 50% longer. Addiction chance halved.' },
        { id: 'field_surgery',    name: 'Field Surgery',    description: 'Remove crippled limb debuffs in the field without a clinic.' },
        { id: 'doctor_discount',  name: 'Doctor\'s Discount', description: 'Medical item purchase prices reduced by 25%.' },
      ],
      tradeBonuses: {
        consumables : { buy: -0.25, sell: 0.20 },
        chems        : { buy: -0.20, sell: 0.15 },
        weapons      : { buy: 0,    sell: 0 },
        armor        : { buy: 0,    sell: 0 },
      },
      specialItems: [
        'trauma_kit_advanced', 'neural_stimpak', 'rad_scrubber_iv', 'surgical_laser',
        'field_defibrillator', 'anti_venom_cocktail',
      ],
      craftableRecipes: ['stimpak_craft', 'rad_away_craft', 'trauma_kit_craft', 'anti_venom_craft'],
      iconClass : 'role-icon-medic',
    },

    scrap_merchant: {
      id          : 'scrap_merchant',
      name        : 'Scrap Merchant',
      description : 'You find value in what others discard. The wasteland\'s refuse is your currency.',
      lore        : 'Pre-war civilization left an ocean of material. You\'re just harvesting it.',
      unlockLevel : 1,
      perks       : [
        { id: 'salvage_expert',   name: 'Salvage Expert',   description: '+35% components from scrapping items. Recognize rare materials instantly.' },
        { id: 'carry_weight',     name: 'Pack Rat',          description: 'Junk and scrap items weigh 50% less in your inventory.' },
        { id: 'component_sense',  name: 'Component Sense',  description: 'Highlight scavengeable objects when Pocket-Boy scanner is active.' },
        { id: 'junk_trader',      name: 'Junk Trader',      description: '+25% sell value on scrap and component items.' },
      ],
      tradeBonuses: {
        junk        : { buy: -0.20, sell: 0.30 },
        components  : { buy: -0.15, sell: 0.25 },
        weapons     : { buy: 0,    sell: 0 },
        consumables : { buy: 0,    sell: 0 },
      },
      specialItems: [
        'bulk_steel_shipment', 'rare_component_cache', 'pre_war_circuit_board',
        'military_grade_polymer', 'quantum_battery_cell', 'superconductor_wire',
      ],
      craftableRecipes: ['component_upgrade', 'bulk_scrap_processing', 'rare_material_extraction'],
      iconClass : 'role-icon-scrap',
    },

    info_broker: {
      id          : 'info_broker',
      name        : 'Information Broker',
      description : 'You trade in the wasteland\'s most valuable commodity: knowledge.',
      lore        : 'Bullets run out. Information compounds. You play the long game.',
      unlockLevel : 8,
      perks       : [
        { id: 'network_access',   name: 'Network Access',   description: 'Access black market listings and faction intel boards not visible to others.' },
        { id: 'read_the_room',    name: 'Read the Room',    description: 'Detect NPC faction affiliation and hostility intent before engaging.' },
        { id: 'market_watch',     name: 'Market Watch',     description: 'See FIZZ price trends 24h ahead. +10% FIZZ trading profit.' },
        { id: 'rumor_mill',       name: 'Rumor Mill',       description: 'Randomly receive quest tips and location intel from the NPC network.' },
      ],
      tradeBonuses: {
        intel_items  : { buy: -0.30, sell: 0.35 },
        holotapes    : { buy: -0.20, sell: 0.30 },
        weapons      : { buy: 0,    sell: 0 },
        consumables  : { buy: 0,    sell: 0 },
      },
      specialItems: [
        'encrypted_intel_package', 'faction_movement_report', 'vault_access_code_fragment',
        'pre_war_financial_record', 'nsa_decryption_stub', 'overseer_comm_log',
      ],
      craftableRecipes: ['data_encryption_key', 'signal_relay_tap', 'intel_decoder'],
      iconClass : 'role-icon-broker',
    },

    chems_cook: {
      id          : 'chems_cook',
      name        : 'Chems Cook',
      description : 'You synthesize the compounds that keep the wasteland moving. Most of them legally.',
      lore        : 'Chemistry is the one pre-war science that got better after the bombs.',
      unlockLevel : 10,
      perks       : [
        { id: 'master_chemist',    name: 'Master Chemist',   description: '50% chance to produce double yield when cooking chems.' },
        { id: 'pure_batch',        name: 'Pure Batch',       description: 'Your chems have zero addiction chance. They just hit harder.' },
        { id: 'chems_wholesale',   name: 'Wholesale Supplier', description: 'Sell chems to faction medics at 40% above market rate.' },
        { id: 'synthesis_speed',   name: 'Rapid Synthesis',  description: 'Chem crafting time reduced by 60%.' },
      ],
      tradeBonuses: {
        chems        : { buy: -0.30, sell: 0.40 },
        consumables  : { buy: -0.15, sell: 0.20 },
        components   : { buy: -0.10, sell: 0 },
        weapons      : { buy: 0,    sell: 0 },
      },
      specialItems: [
        'x_cell_prototype', 'overdrive_formula', 'steady_compound', 'berry_mentats',
        'slasher_batch', 'ultra_jet_flask',
      ],
      craftableRecipes: [
        'jet_craft', 'psycho_craft', 'mentats_craft', 'buffout_craft',
        'med_x_craft', 'rad_x_craft', 'overdrive_craft',
      ],
      iconClass : 'role-icon-chems',
    },

    bounty_hunter: {
      id          : 'bounty_hunter',
      name        : 'Bounty Hunter',
      description : 'You bring in targets. The wasteland\'s most wanted don\'t stay that way for long.',
      lore        : 'Justice is expensive in the wasteland. You provide it at market rate.',
      unlockLevel : 12,
      perks       : [
        { id: 'target_marking',   name: 'Target Marking',   description: 'Pocket-Boy marks bounty targets within 500m. Last known position updated every 30s.' },
        { id: 'restraint_expert', name: 'Restraint Expert', description: 'Non-lethal takedowns deal no XP penalty. Captives fetch 50% more alive.' },
        { id: 'bounty_network',   name: 'Bounty Network',   description: 'Access to exclusive bounty board with high-value targets other players cannot see.' },
        { id: 'fugitive_sense',   name: 'Fugitive Sense',   description: 'Detect when a target is fleeing before they move. +2s reaction window.' },
      ],
      tradeBonuses: {
        bounty_tokens: { buy: 0,    sell: 0.50 },
        weapons      : { buy: -0.10, sell: 0.10 },
        armor        : { buy: -0.10, sell: 0.10 },
        consumables  : { buy: 0,    sell: 0 },
      },
      specialItems: [
        'bounty_restraints', 'tracker_beacon', 'wanted_poster_set',
        'silent_10mm_pistol', 'stealth_field_emitter', 'faction_wanted_dossier',
      ],
      craftableRecipes: ['restraint_kit_craft', 'tracker_beacon_craft', 'stun_grenade_craft'],
      iconClass : 'role-icon-bounty',
    },
  };

  // -----------------------------------------------------------------------
  // PlayerState integration key
  // -----------------------------------------------------------------------
  const ROLE_STATE_KEY = 'afc_economy_role';
  const ROLE_HISTORY_KEY = 'afc_role_history';

  // -----------------------------------------------------------------------
  // Module object
  // -----------------------------------------------------------------------
  const economyRoles = {

    // ----------------------------------------------------------------
    // getAllRoles() → array of all role definitions
    // ----------------------------------------------------------------
    getAllRoles() {
      return Object.values(ROLES);
    },

    // ----------------------------------------------------------------
    // getRole(roleId) → role definition or null
    // ----------------------------------------------------------------
    getRole(roleId) {
      return ROLES[roleId] || null;
    },

    // ----------------------------------------------------------------
    // getCurrentRole(playerState) → role id string or null
    // ----------------------------------------------------------------
    getCurrentRole(playerState) {
      if (!playerState) return null;
      return playerState[ROLE_STATE_KEY] || null;
    },

    // ----------------------------------------------------------------
    // canClaim(roleId, playerLevel) → { eligible: bool, reason: string }
    // ----------------------------------------------------------------
    canClaim(roleId, playerLevel) {
      const role = ROLES[roleId];
      if (!role) return { eligible: false, reason: `Unknown role: ${roleId}` };

      const level = Number(playerLevel) || 1;
      if (level < role.unlockLevel) {
        return {
          eligible: false,
          reason  : `Requires level ${role.unlockLevel} (you are level ${level})`,
        };
      }
      return { eligible: true, reason: 'Requirements met' };
    },

    // ----------------------------------------------------------------
    // claimRole(roleId, playerState) → { success: bool, message: string }
    // Mutates playerState to store the chosen role.
    // ----------------------------------------------------------------
    claimRole(roleId, playerState) {
      if (!playerState) return { success: false, message: 'No player state provided' };

      const role = ROLES[roleId];
      if (!role) return { success: false, message: `Unknown role: ${roleId}` };

      const level = playerState.level || playerState.xp_level || 1;
      const check = this.canClaim(roleId, level);
      if (!check.eligible) return { success: false, message: check.reason };

      const previous = playerState[ROLE_STATE_KEY];

      // Record history
      const history = playerState[ROLE_HISTORY_KEY] || [];
      if (previous) {
        history.push({ role: previous, left_at: Date.now() });
        playerState[ROLE_HISTORY_KEY] = history.slice(-10); // keep last 10
      }

      playerState[ROLE_STATE_KEY] = roleId;

      console.log(`[economy-roles] Player claimed role: ${roleId}`);

      // Dispatch event for UI to react
      try {
        window.dispatchEvent(new CustomEvent('economyRoleClaimed', {
          detail: { roleId, role, previous },
        }));
      } catch (_) { /* non-DOM environment */ }

      return {
        success: true,
        message: `You are now a ${role.name}. ${role.lore}`,
      };
    },

    // ----------------------------------------------------------------
    // getRolePerks(roleId) → array of perk objects
    // ----------------------------------------------------------------
    getRolePerks(roleId) {
      const role = ROLES[roleId];
      if (!role) return [];
      return role.perks;
    },

    // ----------------------------------------------------------------
    // getTradeBonus(roleId, itemType) → { buy: number, sell: number }
    // Positive = bonus (e.g. 0.20 = 20% better price)
    // Negative = penalty
    // ----------------------------------------------------------------
    getTradeBonus(roleId, itemType) {
      const role = ROLES[roleId];
      if (!role || !role.tradeBonuses) return { buy: 0, sell: 0 };

      const bonus = role.tradeBonuses[itemType] || { buy: 0, sell: 0 };
      return {
        buy : Number(bonus.buy)  || 0,
        sell: Number(bonus.sell) || 0,
      };
    },

    // ----------------------------------------------------------------
    // applyBuyPrice(basePrice, roleId, itemType) → adjusted price
    // ----------------------------------------------------------------
    applyBuyPrice(basePrice, roleId, itemType) {
      const bonus = this.getTradeBonus(roleId, itemType);
      return Math.max(1, Math.round(basePrice * (1 + bonus.buy)));
    },

    // ----------------------------------------------------------------
    // applySellPrice(basePrice, roleId, itemType) → adjusted price
    // ----------------------------------------------------------------
    applySellPrice(basePrice, roleId, itemType) {
      const bonus = this.getTradeBonus(roleId, itemType);
      return Math.max(1, Math.round(basePrice * (1 + bonus.sell)));
    },

    // ----------------------------------------------------------------
    // canCraft(roleId, recipeId) → boolean
    // ----------------------------------------------------------------
    canCraft(roleId, recipeId) {
      const role = ROLES[roleId];
      if (!role || !Array.isArray(role.craftableRecipes)) return false;
      return role.craftableRecipes.includes(recipeId);
    },

    // ----------------------------------------------------------------
    // getCraftableRecipes(roleId) → array of recipe ids
    // ----------------------------------------------------------------
    getCraftableRecipes(roleId) {
      const role = ROLES[roleId];
      if (!role) return [];
      return role.craftableRecipes || [];
    },

    // ----------------------------------------------------------------
    // getRoleInventory(roleId, playerLevel) → array of item objects
    // Generates a curated set of role-appropriate items available to buy/sell.
    // Uses crypto.getRandomValues() for any randomisation.
    // ----------------------------------------------------------------
    getRoleInventory(roleId, playerLevel) {
      const role = ROLES[roleId];
      if (!role || !Array.isArray(role.specialItems)) return [];

      const level    = Math.max(1, Number(playerLevel) || 1);
      const allItems = role.specialItems;

      // Scale available item count with level (2 at level 1, up to all items at max level)
      const maxAvailable = Math.min(allItems.length, Math.max(2, Math.floor(level / 3)));

      // Secure shuffle using the _secureRandInt helper to avoid modulo bias
      const shuffled = [...allItems];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = _secureRandInt(0, i);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const selected = shuffled.slice(0, maxAvailable);

      // Build item objects with level-scaled pricing
      return selected.map((itemId) => {
        const basePrice  = _secureRandInt(200, 800) + level * 15;
        const fizzPrice  = Math.max(5, Math.round(basePrice / 12));
        return {
          id        : itemId,
          name      : _formatItemName(itemId),
          role      : roleId,
          price_caps: basePrice,
          price_fizz: fizzPrice,
          level_req : Math.max(1, level - _secureRandInt(0, 3)),
          stock     : _secureRandInt(1, 5),
        };
      });
    },

    // ----------------------------------------------------------------
    // getRoleSummary(roleId) → human-readable summary string
    // ----------------------------------------------------------------
    getRoleSummary(roleId) {
      const role = ROLES[roleId];
      if (!role) return 'Unknown role';
      return [
        `${role.name} (Unlock: Level ${role.unlockLevel})`,
        role.description,
        `Perks: ${role.perks.map(p => p.name).join(', ')}`,
      ].join('\n');
    },

    // ----------------------------------------------------------------
    // hasPerk(roleId, perkId) → boolean
    // ----------------------------------------------------------------
    hasPerk(roleId, perkId) {
      const role = ROLES[roleId];
      if (!role) return false;
      return role.perks.some(p => p.id === perkId);
    },
  };

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  function _formatItemName(itemId) {
    return String(itemId)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  // -----------------------------------------------------------------------
  // Register module
  // -----------------------------------------------------------------------
  Game.modules.economyRoles = economyRoles;

  console.log('[economy-roles] module loaded — roles:', Object.keys(ROLES).join(', '));
})();
