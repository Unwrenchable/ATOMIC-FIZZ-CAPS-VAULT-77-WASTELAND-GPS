// character-creator.js
// ============================================================
// Player Character Creator - Fallout 4 Style
// Allows players to customize their character's appearance
// and generates SVG-based portraits for both players and NPCs
// ============================================================

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  // Appearance options data (loaded from JSON)
  let appearanceOptions = null;

  // Backgrounds data (loaded from JSON)
  let backgroundsData = null;

  // Perks/traits data (loaded from JSON)
  let perksData = null;

  // Current character appearance state
  let currentAppearance = null;

  // ============================================================
  // SECURITY: HTML escape helper — MUST be used before any
  // user-supplied text is inserted via innerHTML
  // ============================================================
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Format a numeric perk/trait effect value for display.
   * Fractional values (|val| < 1) are converted to percentages.
   * Whole values are rendered as-is (e.g. 4, -15).
   * @param {number} val
   * @returns {string}
   */
  function formatEffectValue(val) {
    if (typeof val !== 'number') return String(val);
    if (Math.abs(val) > 0 && Math.abs(val) < 1) {
      return (val * 100).toFixed(0) + '%';
    }
    return String(val);
  }

  // SPECIAL stat metadata
  const SPECIAL_STATS = [
    { key: 'S', label: 'Strength',     abbr: 'STR', desc: 'Melee damage, carry weight' },
    { key: 'P', label: 'Perception',   abbr: 'PER', desc: 'Attack accuracy, environmental awareness' },
    { key: 'E', label: 'Endurance',    abbr: 'END', desc: 'Max HP, radiation resistance' },
    { key: 'C', label: 'Charisma',     abbr: 'CHR', desc: 'Prices, companion morale, speech checks' },
    { key: 'I', label: 'Intelligence', abbr: 'INT', desc: 'Crafting, hacking, XP gain' },
    { key: 'A', label: 'Agility',      abbr: 'AGI', desc: 'Action points, sneaking, reload speed' },
    { key: 'L', label: 'Luck',         abbr: 'LCK', desc: 'Critical hit chance, random events' }
  ];

  const SPECIAL_TOTAL_POINTS = 21;
  const SPECIAL_MIN = 1;
  const SPECIAL_MAX = 10;

  // ============================================================
  // VAULT BOY BOBBLEHEAD SVGS — unique pose per S.P.E.C.I.A.L. stat
  // Each uses viewBox="0 0 50 60" (50×60 logical units, rendered via CSS width/height).
  // Colors: suit #FFD700, skin #FFC48C, hair #4A3728, outline stroke #2a1a0a
  // ============================================================
  const VAULT_BOY_SVGS = {
    STR: `<svg class="cc-sp-vaultboy" viewBox="0 0 50 60" aria-hidden="true">
      <path d="M15,13 Q15,2 25,2 Q35,2 35,13" fill="#4A3728"/>
      <circle cx="25" cy="13" r="10" fill="#FFC48C" stroke="#2a1a0a" stroke-width="1"/>
      <circle cx="21" cy="12" r="1.5" fill="#2a1a0a"/>
      <circle cx="29" cy="12" r="1.5" fill="#2a1a0a"/>
      <path d="M21,17 Q25,21 29,17" fill="none" stroke="#2a1a0a" stroke-width="1"/>
      <circle cx="18.5" cy="15" r="2" fill="#FF9999" opacity="0.55"/>
      <circle cx="31.5" cy="15" r="2" fill="#FF9999" opacity="0.55"/>
      <rect x="22" y="22" width="6" height="4" fill="#FFC48C"/>
      <rect x="15" y="26" width="20" height="15" rx="2" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <path d="M22,26 L25,30 L28,26" fill="#CC9900" stroke="#2a1a0a" stroke-width="0.8"/>
      <rect x="8" y="27" width="7" height="12" rx="3.5" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <rect x="35" y="18" width="7" height="11" rx="3.5" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <ellipse cx="39.5" cy="20" rx="5.5" ry="4.5" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <rect x="36" y="8" width="6" height="11" rx="3" fill="#FFC48C" stroke="#2a1a0a" stroke-width="1"/>
      <rect x="16" y="41" width="8" height="15" rx="3" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <rect x="26" y="41" width="8" height="15" rx="3" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <ellipse cx="20" cy="57" rx="5" ry="2" fill="#4A3728" stroke="#2a1a0a" stroke-width="0.8"/>
      <ellipse cx="30" cy="57" rx="5" ry="2" fill="#4A3728" stroke="#2a1a0a" stroke-width="0.8"/>
    </svg>`,

    PER: `<svg class="cc-sp-vaultboy" viewBox="0 0 50 60" aria-hidden="true">
      <path d="M15,13 Q15,2 25,2 Q35,2 35,13" fill="#4A3728"/>
      <circle cx="25" cy="13" r="10" fill="#FFC48C" stroke="#2a1a0a" stroke-width="1"/>
      <rect x="13" y="9" width="11" height="8" rx="4" fill="#333" stroke="#2a1a0a" stroke-width="1"/>
      <rect x="26" y="9" width="11" height="8" rx="4" fill="#333" stroke="#2a1a0a" stroke-width="1"/>
      <rect x="23" y="11" width="4" height="3" rx="1" fill="#222" stroke="#2a1a0a" stroke-width="0.5"/>
      <circle cx="18.5" cy="13" r="2.5" fill="none" stroke="#6699ff" stroke-width="0.8" opacity="0.6"/>
      <circle cx="31.5" cy="13" r="2.5" fill="none" stroke="#6699ff" stroke-width="0.8" opacity="0.6"/>
      <path d="M21,19 Q25,23 29,19" fill="none" stroke="#2a1a0a" stroke-width="1"/>
      <circle cx="18.5" cy="17" r="2" fill="#FF9999" opacity="0.55"/>
      <circle cx="31.5" cy="17" r="2" fill="#FF9999" opacity="0.55"/>
      <rect x="22" y="22" width="6" height="4" fill="#FFC48C"/>
      <rect x="15" y="26" width="20" height="15" rx="2" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <path d="M22,26 L25,30 L28,26" fill="#CC9900" stroke="#2a1a0a" stroke-width="0.8"/>
      <rect x="4" y="15" width="12" height="7" rx="3.5" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <rect x="34" y="15" width="12" height="7" rx="3.5" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <rect x="16" y="41" width="8" height="15" rx="3" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <rect x="26" y="41" width="8" height="15" rx="3" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <ellipse cx="20" cy="57" rx="5" ry="2" fill="#4A3728" stroke="#2a1a0a" stroke-width="0.8"/>
      <ellipse cx="30" cy="57" rx="5" ry="2" fill="#4A3728" stroke="#2a1a0a" stroke-width="0.8"/>
    </svg>`,

    END: `<svg class="cc-sp-vaultboy" viewBox="0 0 50 60" aria-hidden="true">
      <path d="M15,13 Q15,2 25,2 Q35,2 35,13" fill="#4A3728"/>
      <circle cx="25" cy="13" r="10" fill="#FFC48C" stroke="#2a1a0a" stroke-width="1"/>
      <circle cx="21" cy="12" r="1.5" fill="#2a1a0a"/>
      <circle cx="29" cy="12" r="1.5" fill="#2a1a0a"/>
      <path d="M21,17 Q25,21 29,17" fill="none" stroke="#2a1a0a" stroke-width="1"/>
      <circle cx="18.5" cy="15" r="2" fill="#FF9999" opacity="0.55"/>
      <circle cx="31.5" cy="15" r="2" fill="#FF9999" opacity="0.55"/>
      <rect x="22" y="22" width="6" height="4" fill="#FFC48C"/>
      <rect x="15" y="26" width="20" height="15" rx="2" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <path d="M22,26 L25,30 L28,26" fill="#CC9900" stroke="#2a1a0a" stroke-width="0.8"/>
      <rect x="35" y="25" width="7" height="12" rx="3.5" fill="#FFD700" stroke="#2a1a0a" stroke-width="1" transform="rotate(-30 38 25)"/>
      <rect x="8" y="25" width="7" height="12" rx="3.5" fill="#FFD700" stroke="#2a1a0a" stroke-width="1" transform="rotate(25 11 25)"/>
      <rect x="16" y="41" width="8" height="15" rx="3" fill="#FFD700" stroke="#2a1a0a" stroke-width="1" transform="rotate(-20 20 41)"/>
      <rect x="26" y="41" width="8" height="15" rx="3" fill="#FFD700" stroke="#2a1a0a" stroke-width="1" transform="rotate(15 30 41)"/>
      <line x1="3" y1="28" x2="9" y2="30" stroke="#FFD700" stroke-width="1.2" opacity="0.45"/>
      <line x1="3" y1="32" x2="9" y2="33" stroke="#FFD700" stroke-width="1.2" opacity="0.45"/>
      <line x1="3" y1="36" x2="9" y2="37" stroke="#FFD700" stroke-width="1.2" opacity="0.45"/>
    </svg>`,

    CHR: `<svg class="cc-sp-vaultboy" viewBox="0 0 50 60" aria-hidden="true">
      <path d="M15,13 Q15,2 25,2 Q35,2 35,13" fill="#4A3728"/>
      <circle cx="25" cy="13" r="10" fill="#FFC48C" stroke="#2a1a0a" stroke-width="1"/>
      <circle cx="20" cy="11" r="1.5" fill="#2a1a0a"/>
      <circle cx="30" cy="11" r="1.5" fill="#2a1a0a"/>
      <path d="M19,17 Q25,24 31,17" fill="none" stroke="#2a1a0a" stroke-width="1.5"/>
      <circle cx="17" cy="15" r="2.5" fill="#FF9999" opacity="0.6"/>
      <circle cx="33" cy="15" r="2.5" fill="#FF9999" opacity="0.6"/>
      <rect x="22" y="22" width="6" height="4" fill="#FFC48C"/>
      <rect x="15" y="26" width="20" height="15" rx="2" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <path d="M22,26 L25,30 L28,26" fill="#CC9900" stroke="#2a1a0a" stroke-width="0.8"/>
      <rect x="35" y="29" width="13" height="7" rx="3.5" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <circle cx="48" cy="32" r="3.5" fill="#FFC48C" stroke="#2a1a0a" stroke-width="0.8"/>
      <rect x="47" y="28" width="2.5" height="5" rx="1" fill="#FFC48C" stroke="#2a1a0a" stroke-width="0.5"/>
      <rect x="8" y="27" width="7" height="10" rx="3.5" fill="#FFD700" stroke="#2a1a0a" stroke-width="1" transform="rotate(28 11 27)"/>
      <rect x="16" y="41" width="8" height="15" rx="3" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <rect x="26" y="41" width="8" height="15" rx="3" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <ellipse cx="20" cy="57" rx="5" ry="2" fill="#4A3728" stroke="#2a1a0a" stroke-width="0.8"/>
      <ellipse cx="30" cy="57" rx="5" ry="2" fill="#4A3728" stroke="#2a1a0a" stroke-width="0.8"/>
    </svg>`,

    INT: `<svg class="cc-sp-vaultboy" viewBox="0 0 50 60" aria-hidden="true">
      <path d="M15,13 Q15,2 25,2 Q35,2 35,13" fill="#4A3728"/>
      <circle cx="25" cy="13" r="10" fill="#FFC48C" stroke="#2a1a0a" stroke-width="1"/>
      <rect x="15" y="9" width="9" height="7" rx="3.5" fill="none" stroke="#2a1a0a" stroke-width="1.6"/>
      <rect x="26" y="9" width="9" height="7" rx="3.5" fill="none" stroke="#2a1a0a" stroke-width="1.6"/>
      <rect x="23" y="11" width="4" height="3" rx="1" fill="none" stroke="#2a1a0a" stroke-width="1.2"/>
      <line x1="15" y1="12" x2="10" y2="14" stroke="#2a1a0a" stroke-width="1.2"/>
      <line x1="35" y1="12" x2="40" y2="14" stroke="#2a1a0a" stroke-width="1.2"/>
      <circle cx="19.5" cy="12" r="1.2" fill="#2a1a0a" opacity="0.8"/>
      <circle cx="30.5" cy="12" r="1.2" fill="#2a1a0a" opacity="0.8"/>
      <path d="M21,18 Q25,22 29,18" fill="none" stroke="#2a1a0a" stroke-width="1"/>
      <circle cx="18.5" cy="16" r="1.8" fill="#FF9999" opacity="0.55"/>
      <circle cx="31.5" cy="16" r="1.8" fill="#FF9999" opacity="0.55"/>
      <rect x="22" y="22" width="6" height="4" fill="#FFC48C"/>
      <rect x="15" y="26" width="20" height="15" rx="2" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <path d="M22,26 L25,30 L28,26" fill="#CC9900" stroke="#2a1a0a" stroke-width="0.8"/>
      <rect x="11" y="34" width="28" height="18" rx="2" fill="#8B4513" stroke="#2a1a0a" stroke-width="1"/>
      <rect x="24" y="34" width="2" height="18" fill="#6B3410"/>
      <line x1="13" y1="38" x2="22" y2="38" stroke="#CC8855" stroke-width="0.8"/>
      <line x1="13" y1="41" x2="22" y2="41" stroke="#CC8855" stroke-width="0.8"/>
      <line x1="13" y1="44" x2="22" y2="44" stroke="#CC8855" stroke-width="0.8"/>
      <line x1="28" y1="38" x2="37" y2="38" stroke="#CC8855" stroke-width="0.8"/>
      <line x1="28" y1="41" x2="37" y2="41" stroke="#CC8855" stroke-width="0.8"/>
      <line x1="28" y1="44" x2="37" y2="44" stroke="#CC8855" stroke-width="0.8"/>
      <rect x="8" y="28" width="7" height="12" rx="3" fill="#FFD700" stroke="#2a1a0a" stroke-width="1" transform="rotate(-30 11 28)"/>
      <rect x="35" y="28" width="7" height="12" rx="3" fill="#FFD700" stroke="#2a1a0a" stroke-width="1" transform="rotate(30 39 28)"/>
    </svg>`,

    AGI: `<svg class="cc-sp-vaultboy" viewBox="0 0 50 60" aria-hidden="true">
      <path d="M15,10 Q15,-1 25,-1 Q35,-1 35,10" fill="#4A3728"/>
      <circle cx="25" cy="10" r="10" fill="#FFC48C" stroke="#2a1a0a" stroke-width="1"/>
      <circle cx="21" cy="9" r="1.5" fill="#2a1a0a"/>
      <circle cx="29" cy="9" r="1.5" fill="#2a1a0a"/>
      <path d="M21,14 Q25,18 29,14" fill="none" stroke="#2a1a0a" stroke-width="1"/>
      <circle cx="18.5" cy="12" r="2" fill="#FF9999" opacity="0.55"/>
      <circle cx="31.5" cy="12" r="2" fill="#FF9999" opacity="0.55"/>
      <rect x="22" y="19" width="6" height="4" fill="#FFC48C"/>
      <rect x="15" y="23" width="20" height="14" rx="2" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <path d="M22,23 L25,27 L28,23" fill="#CC9900" stroke="#2a1a0a" stroke-width="0.8"/>
      <rect x="1" y="22" width="14" height="7" rx="3.5" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <rect x="35" y="22" width="14" height="7" rx="3.5" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <rect x="13" y="37" width="8" height="16" rx="3" fill="#FFD700" stroke="#2a1a0a" stroke-width="1" transform="rotate(-22 17 37)"/>
      <rect x="29" y="37" width="8" height="16" rx="3" fill="#FFD700" stroke="#2a1a0a" stroke-width="1" transform="rotate(22 33 37)"/>
      <line x1="41" y1="25" x2="47" y2="27" stroke="#FFD700" stroke-width="1.2" opacity="0.5"/>
      <line x1="41" y1="29" x2="47" y2="30" stroke="#FFD700" stroke-width="1.2" opacity="0.5"/>
      <line x1="3" y1="25" x2="9" y2="27" stroke="#FFD700" stroke-width="1.2" opacity="0.5"/>
      <line x1="3" y1="29" x2="9" y2="30" stroke="#FFD700" stroke-width="1.2" opacity="0.5"/>
    </svg>`,

    LCK: `<svg class="cc-sp-vaultboy" viewBox="0 0 50 60" aria-hidden="true">
      <path d="M15,13 Q15,2 25,2 Q35,2 35,13" fill="#4A3728"/>
      <circle cx="25" cy="13" r="10" fill="#FFC48C" stroke="#2a1a0a" stroke-width="1"/>
      <circle cx="21" cy="11" r="1.5" fill="#2a1a0a"/>
      <circle cx="29" cy="11" r="1.5" fill="#2a1a0a"/>
      <path d="M20,17 Q25,22 30,17" fill="none" stroke="#2a1a0a" stroke-width="1.2"/>
      <circle cx="18" cy="15" r="2" fill="#FF9999" opacity="0.6"/>
      <circle cx="32" cy="15" r="2" fill="#FF9999" opacity="0.6"/>
      <rect x="22" y="22" width="6" height="4" fill="#FFC48C"/>
      <rect x="15" y="26" width="20" height="15" rx="2" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <path d="M22,26 L25,30 L28,26" fill="#CC9900" stroke="#2a1a0a" stroke-width="0.8"/>
      <rect x="35" y="16" width="7" height="13" rx="3.5" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <circle cx="38.5" cy="15" r="4.5" fill="#FFC48C" stroke="#2a1a0a" stroke-width="1"/>
      <rect x="37" y="8" width="3" height="9" rx="1.5" fill="#FFC48C" stroke="#2a1a0a" stroke-width="0.8"/>
      <rect x="8" y="27" width="7" height="12" rx="3.5" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <rect x="16" y="41" width="8" height="15" rx="3" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <rect x="26" y="41" width="8" height="15" rx="3" fill="#FFD700" stroke="#2a1a0a" stroke-width="1"/>
      <ellipse cx="20" cy="57" rx="5" ry="2" fill="#4A3728" stroke="#2a1a0a" stroke-width="0.8"/>
      <ellipse cx="30" cy="57" rx="5" ry="2" fill="#4A3728" stroke="#2a1a0a" stroke-width="0.8"/>
      <text x="3" y="12" font-size="9" fill="#FFD700" opacity="0.9" aria-hidden="true">&#9733;</text>
      <text x="40" y="9" font-size="7" fill="#FFD700" opacity="0.9" aria-hidden="true">&#9733;</text>
      <text x="7" y="22" font-size="6" fill="#FFD700" opacity="0.7" aria-hidden="true">&#9733;</text>
    </svg>`
  };
  const CharacterCreator = {
    isOpen: false,
    overlayEl: null,
    onSaveCallback: null,
    _novaNameTimer: null,
    _novaSpecialTimer: null,

    // ============================================================
    // INITIALIZATION
    // ============================================================
    async init() {
      try {
        // Load all data in parallel
        const [appearanceRes, backgroundsRes, perksRes] = await Promise.all([
          fetch('/data/character_creator/appearance_options.json'),
          fetch('/data/character_creator/backgrounds.json'),
          fetch('/data/perks.json')
        ]);

        appearanceOptions = await appearanceRes.json();
        backgroundsData   = await backgroundsRes.json();
        perksData         = await perksRes.json();

        // Set default appearance
        currentAppearance = { ...appearanceOptions.defaultAppearance };
        currentAppearance.name = "Wanderer";

        // Initialise SPECIAL allocation (each stat starts at 1, 21 points to spend)
        currentAppearance.special       = { S:1, P:1, E:1, C:1, I:1, A:1, L:1 };
        currentAppearance.specialPoints = SPECIAL_TOTAL_POINTS;
        currentAppearance.background    = null;
        currentAppearance.selectedTraits = [];

        console.log("[CharacterCreator] Initialized with", Object.keys(appearanceOptions).length, "option categories,",
          backgroundsData.length, "backgrounds,", perksData.traits.length, "traits");

        // Create the overlay element (hidden by default)
        this._createOverlay();

        return true;
      } catch (err) {
        console.error("[CharacterCreator] Failed to initialize:", err);
        return false;
      }
    },

    // ============================================================
    // OPEN/CLOSE THE CHARACTER CREATOR
    // ============================================================
    open(existingAppearance = null, onSave = null) {
      if (!appearanceOptions) {
        console.warn("[CharacterCreator] Not initialized yet");
        this.init().then(() => this.open(existingAppearance, onSave));
        return;
      }

      if (existingAppearance) {
        currentAppearance = { ...existingAppearance };
        // Ensure SPECIAL fields are present for legacy saved appearances
        if (!currentAppearance.special) {
          currentAppearance.special       = { S:1, P:1, E:1, C:1, I:1, A:1, L:1 };
          currentAppearance.specialPoints = SPECIAL_TOTAL_POINTS;
        }
        if (!currentAppearance.background)      currentAppearance.background = null;
        if (!currentAppearance.selectedTraits)  currentAppearance.selectedTraits = [];
      }

      this.onSaveCallback = onSave;
      this.isOpen = true;
      this.overlayEl.classList.remove('hidden');

      // Generate unique vault assignment number (cosmetic only)
      const _vArr = new Uint32Array(1);
      crypto.getRandomValues(_vArr);
      const _unitNum = String(_vArr[0] % 90000 + 10000); // always 5 digits: 10000–99999
      setTimeout(() => {
        const _unitEl = document.getElementById('ccVaultUnit');
        if (_unitEl) _unitEl.textContent = _unitNum;
      }, 50);
      this._renderOptions();
      this._updatePreview();

      // Nova-7 greeting on open
      this._novaGuide.show(
        "Welcome to Vault-Tec Personnel Assignment. I am NOVA-7, your character assignment AI. " +
        "Please complete all sections. Failure to do so will be noted in your permanent file."
      );

      // Provide DragonBones quick toggle if runtime available
      const dbToggle = document.createElement('button');
      dbToggle.textContent = 'Use Animated Preview';
      dbToggle.className = 'pipboy-button-small';
      dbToggle.style.marginLeft = '8px';
      dbToggle.addEventListener('click', async () => {
        // initialize DragonBones stage and load demo armature (if available)
        if (window.Game && Game.modules && Game.modules.Dragon) {
          document.getElementById('afc-cc-preview').style.display = 'none';
          document.getElementById('dragonbonesStage').style.display = 'block';
          try {
            await Game.modules.Dragon.init('dragonbonesStage');
            await Game.modules.Dragon.loadArmatureJSON('/assets/dragonbones/demo/hero');
            Game.modules.Dragon.createArmatureDisplay('hero', 'idle');
          } catch (e) {
            console.warn('DragonBones demo failed', e);
          }
        } else {
          alert('DragonBones runtime not available');
        }
      });
      this.overlayEl.querySelector('div').appendChild(dbToggle);
      
      // Dispatch event
      window.dispatchEvent(new CustomEvent('characterCreatorOpened'));
    },

    close() {
      this.isOpen = false;
      if (this.overlayEl) {
        this.overlayEl.classList.add('hidden');
      }
      window.dispatchEvent(new CustomEvent('characterCreatorClosed'));
    },

    // ============================================================
    // GET/SET APPEARANCE
    // ============================================================
    getAppearance() {
      return { ...currentAppearance };
    },

    setAppearance(appearance) {
      currentAppearance = { ...appearance };
      if (this.isOpen) {
        this._renderOptions();
        this._updatePreview();
      }
    },

    // ============================================================
    // GET PERKS DATA
    // ============================================================
    getPerksData() {
      return perksData;
    },

    // ============================================================
    // CRYPTOGRAPHICALLY SECURE RANDOM SELECTION
    // Uses crypto.getRandomValues() for security-compliant randomness
    // ============================================================
    _secureRandom(max) {
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      return array[0] % max;
    },

    _securePick(arr) {
      return arr[this._secureRandom(arr.length)];
    },

    // ============================================================
    // RANDOMIZE APPEARANCE (using cryptographically secure random)
    // ============================================================
    randomize() {
      const pick = (arr) => this._securePick(arr);
      
      currentAppearance.gender = pick(appearanceOptions.genders).id;
      currentAppearance.race = pick(appearanceOptions.races).id;
      currentAppearance.skinTone = pick(appearanceOptions.skinTones).id;
      currentAppearance.faceShape = pick(appearanceOptions.faceShapes).id;
      currentAppearance.hairStyle = pick(appearanceOptions.hairStyles).id;
      currentAppearance.hairColor = pick(appearanceOptions.hairColors).id;
      currentAppearance.eyeShape = pick(appearanceOptions.eyeShapes).id;
      currentAppearance.eyeColor = pick(appearanceOptions.eyeColors.filter(e => !e.raceRestrict || e.raceRestrict === currentAppearance.race)).id;
      currentAppearance.noseType = pick(appearanceOptions.noseTypes).id;
      currentAppearance.mouthType = pick(appearanceOptions.mouthTypes).id;
      currentAppearance.facialHair = pick(appearanceOptions.facialHair.filter(f => !f.genderRestrict || f.genderRestrict === currentAppearance.gender)).id;
      currentAppearance.scar = pick(appearanceOptions.scars).id;
      currentAppearance.marking = pick(appearanceOptions.markings.filter(m => !m.raceRestrict || m.raceRestrict === currentAppearance.race)).id;
      currentAppearance.accessory = pick(appearanceOptions.accessories).id;
      currentAppearance.expression = pick(appearanceOptions.expressions).id;
      currentAppearance.ageRange = pick(appearanceOptions.ageRanges).id;
      currentAppearance.bodyType = pick(appearanceOptions.bodyTypes).id;
      currentAppearance.voice = pick(appearanceOptions.voices.filter(v => !v.raceRestrict || v.raceRestrict === currentAppearance.race)).id;

      this._renderOptions();
      this._updatePreview();
    },

    // ============================================================
    // GENERATE RANDOM NPC APPEARANCE (using cryptographically secure random)
    // ============================================================
    generateNPCAppearance(options = {}) {
      const pick = (arr) => this._securePick(arr);
      const secureChance = (probability) => {
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        return (array[0] / 0xFFFFFFFF) < probability;
      };
      
      const appearance = {};
      
      // Apply options or randomize
      appearance.gender = options.gender || pick(appearanceOptions.genders).id;
      appearance.race = options.race || pick(appearanceOptions.races).id;
      appearance.skinTone = options.skinTone || pick(appearanceOptions.skinTones).id;
      appearance.faceShape = options.faceShape || pick(appearanceOptions.faceShapes).id;
      appearance.hairStyle = options.hairStyle || pick(appearanceOptions.hairStyles).id;
      appearance.hairColor = options.hairColor || pick(appearanceOptions.hairColors).id;
      appearance.eyeShape = options.eyeShape || pick(appearanceOptions.eyeShapes).id;
      appearance.eyeColor = options.eyeColor || pick(appearanceOptions.eyeColors.filter(e => !e.raceRestrict || e.raceRestrict === appearance.race)).id;
      appearance.noseType = options.noseType || pick(appearanceOptions.noseTypes).id;
      appearance.mouthType = options.mouthType || pick(appearanceOptions.mouthTypes).id;
      appearance.facialHair = options.facialHair || pick(appearanceOptions.facialHair.filter(f => !f.genderRestrict || f.genderRestrict === appearance.gender)).id;
      appearance.scar = options.scar || (secureChance(0.3) ? pick(appearanceOptions.scars.filter(s => s.id !== 'none')).id : 'none');
      appearance.marking = options.marking || (secureChance(0.2) ? pick(appearanceOptions.markings.filter(m => m.id !== 'none' && (!m.raceRestrict || m.raceRestrict === appearance.race))).id : 'none');
      appearance.accessory = options.accessory || (secureChance(0.25) ? pick(appearanceOptions.accessories.filter(a => a.id !== 'none')).id : 'none');
      appearance.expression = options.expression || pick(appearanceOptions.expressions).id;
      appearance.ageRange = options.ageRange || pick(appearanceOptions.ageRanges).id;
      appearance.bodyType = options.bodyType || pick(appearanceOptions.bodyTypes).id;
      appearance.voice = options.voice || pick(appearanceOptions.voices.filter(v => !v.raceRestrict || v.raceRestrict === appearance.race)).id;
      
      return appearance;
    },

    // ============================================================
    // GENERATE RASTER PORTRAIT (PNG with overlays)
    // ============================================================
    generatePortraitSVG(appearance, size = 240) {
      if (!appearanceOptions) {
        return this._generateFallbackPortrait(appearance, size);
      }

      const app = appearance || currentAppearance;
      
      // Select base avatar from raster manifest
      const baseAvatar = this._selectRasterAvatar(app);
      
      // Build HTML with base image and overlays
      let html = `<div class="raster-portrait" style="width:${size}px; height:${size}px; position:relative; display:flex; align-items:center; justify-content:center;">`;
      
      // Base avatar image
      html += `<img src="/assets/avatars-raster/${baseAvatar.file}" 
                   style="width:100%; height:100%; object-fit:cover; border-radius:2px;" 
                   alt="Character Portrait">`;
      
      // Overlay accessories
      const overlays = this._getAccessoryOverlays(app);
      overlays.forEach(overlay => {
        html += `<img src="/assets/avatars-raster/${overlay.file}" 
                     style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none;" 
                     onerror="this.style.display='none'"
                     alt="${overlay.type}">`;
      });
      
      html += `</div>`;
      
      return html;
    },

    // Select appropriate raster avatar based on appearance
    _selectRasterAvatar(appearance) {
      // Simple selection logic - in real implementation, this would match traits
      const avatars = [
        { id: "avatar_001", file: "avatar_001.png", tags: ["male", "scarred"] },
        { id: "avatar_002", file: "avatar_002.png", tags: ["female", "trader"] },
        { id: "avatar_003", file: "avatar_003.png", tags: ["male", "young"] },
        { id: "avatar_004", file: "avatar_004.png", tags: ["female", "raider"] },
        { id: "avatar_005", file: "avatar_005.png", tags: ["male", "elderly"] }
      ];
      
      // Match by gender first
      let candidates = avatars.filter(a => a.tags.includes(appearance.gender));
      if (candidates.length === 0) candidates = avatars;
      
      // Pick one based on appearance hash for consistency
      const hash = this._appearanceHash(appearance);
      return candidates[hash % candidates.length];
    },

    // Get accessory overlays
    _getAccessoryOverlays(appearance) {
      const overlays = [];
      
      // Add scar if present
      if (appearance.scar && appearance.scar !== 'none') {
        overlays.push({ file: `scar_${appearance.scar}.png`, type: 'scar' });
      }
      
      // Add accessories
      if (appearance.accessory && appearance.accessory !== 'none') {
        overlays.push({ file: `acc_${appearance.accessory}.png`, type: 'accessory' });
      }
      
      return overlays;
    },

    // Simple hash for consistent avatar selection
    _appearanceHash(appearance) {
      const str = `${appearance.gender}${appearance.race}${appearance.ageRange}`;
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash = hash & hash;
      }
      return Math.abs(hash);
    },

    // Fallback portrait when options not loaded
    _generateFallbackPortrait(appearance, size) {
      const app = appearance || { gender: 'male', expression: 'neutral' };
      const genderIcons = { male: '👨', female: '👩' };
      const icon = genderIcons[app.gender] || '🧑';
      
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        <rect width="100%" height="100%" fill="#0a1a0a"/>
        <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-size="${size * 0.4}">${icon}</text>
      </svg>`;
    },

    // ============================================================
    // HELPER: Darken a color
    // ============================================================
    _darkenColor(hex, percent) {
      const num = parseInt(hex.replace('#', ''), 16);
      const amt = Math.round(2.55 * percent);
      const R = Math.max(0, (num >> 16) - amt);
      const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
      const B = Math.max(0, (num & 0x0000FF) - amt);
      return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    },

    _lightenColor(hex, percent) {
      const num = parseInt(hex.replace('#', ''), 16);
      const amt = Math.round(2.55 * percent);
      const R = Math.min(255, (num >> 16) + amt);
      const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
      const B = Math.min(255, (num & 0x0000FF) + amt);
      return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    },

    // ============================================================
    // NOVA-7 GUIDE — Vault-Tec AI companion for character creator
    // ============================================================
    _novaGuide: {
      panel: null,

      _buildPanel() {
        if (this.panel) return;
        const p = document.createElement('div');
        p.className = 'nova-guide-panel hidden';
        p.id = 'novaGuidePanel';
        p.innerHTML = `
          <div class="nova-guide-header">
            <span style="font-size:18px;line-height:1;">🤖</span>
            <span class="nova-guide-name">NOVA-7</span>
            <button class="nova-guide-dismiss" id="novaDismissBtn" aria-label="Dismiss NOVA-7">✕</button>
          </div>
          <div class="nova-guide-text" id="novaGuideText"></div>
        `;
        p.querySelector('#novaDismissBtn').addEventListener('click', () => this.hide());
        this.panel = p;
        return p;
      },

      show(text) {
        if (!this.panel) return;
        const textEl = this.panel.querySelector('#novaGuideText');
        if (textEl) textEl.textContent = text;
        this.panel.classList.remove('hidden');
      },

      hide() {
        if (!this.panel) return;
        this.panel.classList.add('hidden');
      }
    },

    _buildNovaPanel() {
      const container = this.overlayEl ? this.overlayEl.querySelector('.character-creator-container') : null;
      if (!container) return;
      const panel = this._novaGuide._buildPanel();
      if (panel) {
        container.style.position = 'relative';
        container.appendChild(panel);
      }
    },

    // ============================================================
    // CREATE THE UI OVERLAY
    // ============================================================
    _createOverlay() {
      // Remove existing overlay if present
      const existing = document.getElementById('characterCreatorOverlay');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'characterCreatorOverlay';
      overlay.className = 'character-creator-overlay hidden';
      
      overlay.innerHTML = `
        <div class="character-creator-container">
          <!-- Header -->
          <div class="cc-header">
            <div class="cc-header-left">
              <div class="cc-vault-seal" aria-hidden="true"><span class="cc-seal-number">77</span></div>
              <div>
                <div class="cc-title">CHARACTER CREATION</div>
                <div class="cc-subtitle">VAULT-TEC PERSONNEL FILE · UNIT #<span id="ccVaultUnit">???</span></div>
              </div>
            </div>
            <button class="cc-close-btn" id="ccCloseBtn">✕ ABORT</button>
          </div>
          <div class="cc-vault-bar">VAULT-TEC CORPORATION · VAULT 77 · PERSONNEL ASSIGNMENT TERMINAL · YEAR 2277</div>

          <!-- Onboarding instruction strip -->
          <div class="cc-onboarding-strip" id="ccOnboardingStrip" style="
            background:rgba(0,255,65,0.06);
            border-bottom:1px solid rgba(0,255,65,0.2);
            padding:8px 16px;
            font-size:12px;
            color:#008822;
            letter-spacing:0.07em;
            text-align:center;
            position:relative;
          ">
            <span id="ccOnboardingText">▶ STEP 01 — Enter your name and define your identity. Work through each tab left-to-right. Use RANDOMIZE to generate a full character instantly.</span>
            <button id="ccOnboardingDismiss" style="
              position:absolute;right:10px;top:50%;transform:translateY(-50%);
              background:transparent;border:none;color:#004400;cursor:pointer;
              font-size:14px;padding:2px 6px;
            " title="Dismiss">✕</button>
          </div>

          <!-- Main Content -->
          <div class="cc-main">
            <!-- Preview Panel -->
            <div class="cc-preview-panel">
              <div class="cc-preview-title">PREVIEW</div>
              <div class="cc-portrait-container">
                <div class="cc-portrait-svg" id="ccPortraitSvg"></div>
                <div class="cc-scan-line-portrait" aria-hidden="true"></div>
                <div class="cc-portrait-frame" aria-hidden="true"></div>
              </div>
              <div class="cc-pip-label">VAULT DWELLER</div>
              <div class="cc-preview-name" id="ccPreviewName">WANDERER</div>
              <div class="cc-preview-stats" id="ccPreviewStats">HUMAN • ADULT</div>
              <div class="cc-vault-assignment">
                <div class="cc-va-row"><span class="cc-va-label">STATUS</span><span class="cc-va-val" id="ccVaStatus">PENDING</span></div>
                <div class="cc-va-row"><span class="cc-va-label">VAULT</span><span class="cc-va-val">77</span></div>
              </div>
              <button class="cc-randomize-btn" id="ccRandomizeBtn">🎲 RANDOMIZE</button>
            </div>

            <!-- Options Panel -->
            <div class="cc-options-panel">
              <!-- Category Tabs -->
              <div class="cc-category-tabs" id="ccCategoryTabs">
                <button class="cc-tab active" data-category="identity">01 IDENTITY</button>
                <button class="cc-tab" data-category="face">02 FACE</button>
                <button class="cc-tab" data-category="hair">03 HAIR</button>
                <button class="cc-tab" data-category="eyes">04 EYES</button>
                <button class="cc-tab" data-category="details">05 DETAILS</button>
                <button class="cc-tab" data-category="extras">06 EXTRAS</button>
                <button class="cc-tab" data-category="special">07 S.P.E.C.I.A.L.</button>
                <button class="cc-tab" data-category="background">08 BACKGROUND</button>
                <button class="cc-tab" data-category="traits">09 TRAITS</button>
              </div>

              <!-- Options Content -->
              <div class="cc-options-content" id="ccOptionsContent">
                <!-- Identity Section -->
                <div class="cc-category-section active" data-category="identity">
                  <div class="cc-section-title">IDENTITY</div>
                  <div class="cc-section-hint">Your name, presentation, and form. This is how the wasteland will know you.</div>
                  
                  <div class="cc-option-group">
                    <div class="cc-option-label">NAME</div>
                    <input type="text" class="cc-name-input" id="ccNameInput" placeholder="ENTER NAME" maxlength="24">
                  </div>

                  <div class="cc-option-group">
                    <div class="cc-option-label">GENDER</div>
                    <div class="cc-option-grid" id="ccGenderGrid"></div>
                  </div>

                  <div class="cc-option-group">
                    <div class="cc-option-label">RACE</div>
                    <div class="cc-option-grid large" id="ccRaceGrid"></div>
                  </div>

                  <div class="cc-option-group">
                    <div class="cc-option-label">AGE</div>
                    <div class="cc-option-grid" id="ccAgeGrid"></div>
                  </div>

                  <div class="cc-option-group">
                    <div class="cc-option-label">BODY TYPE</div>
                    <div class="cc-option-grid" id="ccBodyGrid"></div>
                  </div>
                </div>

                <!-- Face Section -->
                <div class="cc-category-section" data-category="face">
                  <div class="cc-section-title">FACE</div>
                  <div class="cc-section-hint">Facial features determine how NPCs react to you on first sight. No wrong choices — survivors come in all shapes.</div>
                  
                  <div class="cc-option-group">
                    <div class="cc-option-label">SKIN TONE</div>
                    <div class="cc-color-grid" id="ccSkinGrid"></div>
                  </div>

                  <div class="cc-option-group">
                    <div class="cc-option-label">FACE SHAPE</div>
                    <div class="cc-option-grid" id="ccFaceShapeGrid"></div>
                  </div>

                  <div class="cc-option-group">
                    <div class="cc-option-label">NOSE</div>
                    <div class="cc-option-grid" id="ccNoseGrid"></div>
                  </div>

                  <div class="cc-option-group">
                    <div class="cc-option-label">MOUTH</div>
                    <div class="cc-option-grid" id="ccMouthGrid"></div>
                  </div>

                  <div class="cc-option-group">
                    <div class="cc-option-label">DEFAULT EXPRESSION</div>
                    <div class="cc-option-grid" id="ccExpressionGrid"></div>
                  </div>
                </div>

                <!-- Hair Section -->
                <div class="cc-category-section" data-category="hair">
                  <div class="cc-section-title">HAIR</div>
                  <div class="cc-section-hint">The wasteland makes styling difficult. Choose something you can maintain with a knife and limited water.</div>
                  
                  <div class="cc-option-group">
                    <div class="cc-option-label">HAIR STYLE</div>
                    <div class="cc-option-grid large" id="ccHairStyleGrid"></div>
                  </div>

                  <div class="cc-option-group">
                    <div class="cc-option-label">HAIR COLOR</div>
                    <div class="cc-color-grid" id="ccHairColorGrid"></div>
                  </div>

                  <div class="cc-option-group">
                    <div class="cc-option-label">FACIAL HAIR</div>
                    <div class="cc-option-grid" id="ccFacialHairGrid"></div>
                  </div>
                </div>

                <!-- Eyes Section -->
                <div class="cc-category-section" data-category="eyes">
                  <div class="cc-section-title">EYES</div>
                  <div class="cc-section-hint">Eyes are the first thing people read. Choose wisely — or don't. The wasteland doesn't care either way.</div>
                  
                  <div class="cc-option-group">
                    <div class="cc-option-label">EYE SHAPE</div>
                    <div class="cc-option-grid" id="ccEyeShapeGrid"></div>
                  </div>

                  <div class="cc-option-group">
                    <div class="cc-option-label">EYE COLOR</div>
                    <div class="cc-color-grid" id="ccEyeColorGrid"></div>
                  </div>
                </div>

                <!-- Details Section -->
                <div class="cc-category-section" data-category="details">
                  <div class="cc-section-title">DETAILS</div>
                  <div class="cc-section-hint">Scars and markings are optional — but out here, most people have at least one story written on their skin.</div>
                  
                  <div class="cc-option-group">
                    <div class="cc-option-label">SCARS</div>
                    <div class="cc-option-grid large" id="ccScarGrid"></div>
                  </div>

                  <div class="cc-option-group">
                    <div class="cc-option-label">MARKINGS</div>
                    <div class="cc-option-grid large" id="ccMarkingGrid"></div>
                  </div>
                </div>

                <!-- Extras Section -->
                <div class="cc-category-section" data-category="extras">
                  <div class="cc-section-title">EXTRAS</div>
                  <div class="cc-section-hint">Accessories and voice. These affect how NPCs perceive you before you speak.</div>
                  
                  <div class="cc-option-group">
                    <div class="cc-option-label">ACCESSORIES</div>
                    <div class="cc-option-grid large" id="ccAccessoryGrid"></div>
                  </div>

                  <div class="cc-option-group">
                    <div class="cc-option-label">VOICE</div>
                    <div class="cc-option-grid" id="ccVoiceGrid"></div>
                  </div>
                </div>

                <!-- S.P.E.C.I.A.L. Section -->
                <div class="cc-category-section" data-category="special">
                  <div class="cc-section-title">S.P.E.C.I.A.L. ATTRIBUTES</div>
                  <div class="cc-section-hint">You have 21 points to distribute across 7 attributes. Minimum 1 per attribute, maximum 10. These affect combat, dialogue options, and crafting. You can rebalance at a Vault-Tec terminal later — costs caps.</div>
                  <div id="ccSpecialContent" class="cc-special-content"></div>
                </div>

                <!-- Background Section -->
                <div class="cc-category-section" data-category="background">
                  <div class="cc-section-title">ORIGIN BACKGROUND</div>
                  <div class="cc-section-hint">Where you came from changes what you know. Backgrounds grant starting bonuses, faction rep modifiers, and unique dialogue options. Choose what fits your play style.</div>
                  <div id="ccBackgroundContent" class="cc-background-content"></div>
                </div>

                <!-- Traits Section -->
                <div class="cc-category-section" data-category="traits">
                  <div class="cc-section-title">CHARACTER TRAITS <span style="font-size:0.75em;opacity:0.7;">(SELECT UP TO 2)</span></div>
                  <div class="cc-section-hint">Traits are double-edged. Every benefit comes with a drawback. Vault-Tec calls this "balanced incentive design." Survivors call it "the wasteland tax."</div>
                  <div id="ccTraitsContent" class="cc-traits-content"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="cc-footer">
            <div class="cc-footer-left">
              <button class="cc-reset-btn" id="ccResetBtn">RESET TO DEFAULT</button>
            </div>
            <button class="cc-confirm-btn" id="ccConfirmBtn">► ENTER VAULT</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      this.overlayEl = overlay;

      // Build Nova-7 guide panel
      this._buildNovaPanel();

      // Bind events
      this._bindEvents();
    },

    // ============================================================
    // BIND UI EVENTS
    // ============================================================
    _bindEvents() {
      // Close button
      document.getElementById('ccCloseBtn').addEventListener('click', () => this.close());

      // Randomize button
      document.getElementById('ccRandomizeBtn').addEventListener('click', () => {
        this.randomize();
        this._novaGuide.show(
          "Randomization protocol engaged. Results are... statistically defensible."
        );
      });

      // Reset button
      document.getElementById('ccResetBtn').addEventListener('click', () => {
        currentAppearance = { ...appearanceOptions.defaultAppearance };
        currentAppearance.name = document.getElementById('ccNameInput').value || "Wanderer";
        this._renderOptions();
        this._updatePreview();
      });

      // Confirm button
      document.getElementById('ccConfirmBtn').addEventListener('click', () => {
        currentAppearance.name = document.getElementById('ccNameInput').value || "Wanderer";

        // Validate all S.P.E.C.I.A.L. points have been allocated before allowing confirm
        const sp = currentAppearance.special || {};
        const used = SPECIAL_STATS.reduce((acc, s) => acc + ((sp[s.key] || 1) - 1), 0);
        const remaining = SPECIAL_TOTAL_POINTS - used;
        if (remaining > 0) {
          alert(`You have ${remaining} unspent S.P.E.C.I.A.L. point${remaining > 1 ? 's' : ''}. Allocate all points before entering the Vault.`);
          return;
        }
        
        // Save to localStorage using base64 encoding for data integrity
        // This stores only cosmetic game preferences (avatar visual settings)
        const appearanceData = JSON.stringify(currentAppearance);
        const encodedAppearance = btoa(unescape(encodeURIComponent(appearanceData)));
        localStorage.setItem('playerAppearance_encoded', encodedAppearance);
        
        // Callback if provided
        if (this.onSaveCallback) {
          this.onSaveCallback(currentAppearance);
        }
        
        // Dispatch event with full character data including SPECIAL, background, traits
        window.dispatchEvent(new CustomEvent('characterCreated', { 
          detail: {
            appearance:     currentAppearance,
            special:        { ...currentAppearance.special },
            background:     currentAppearance.background,
            selectedTraits: [...(currentAppearance.selectedTraits || [])]
          }
        }));
        
        // Brief vault-entry flash before closing
        this.overlayEl.classList.add('cc-entering-vault');
        setTimeout(() => { this.close(); }, 400);
        return;
      });

      // Name input
      document.getElementById('ccNameInput').addEventListener('input', (e) => {
        currentAppearance.name = e.target.value;
        document.getElementById('ccPreviewName').textContent = e.target.value || "WANDERER";
        // Nova comment on name change (debounced to 800ms)
        clearTimeout(this._novaNameTimer);
        this._novaNameTimer = setTimeout(() => {
          const name = e.target.value.trim();
          if (name) {
            this._novaGuide.show(
              "File updated. Biometric tags recalibrated. Welcome, " + escapeHtml(name) + ". Please proceed."
            );
          }
        }, 800);
      });

      // Category tabs
      document.getElementById('ccCategoryTabs').addEventListener('click', (e) => {
        if (e.target.classList.contains('cc-tab')) {
          const category = e.target.dataset.category;
          
          // Update tabs
          document.querySelectorAll('.cc-tab').forEach(tab => tab.classList.remove('active'));
          e.target.classList.add('active');
          
          // Update sections
          document.querySelectorAll('.cc-category-section').forEach(section => {
            section.classList.toggle('active', section.dataset.category === category);
          });

          // Update onboarding strip step text
          const stepHints = {
            identity:   '▶ STEP 01 — Enter your name and choose your identity. Name is required.',
            face:       '▶ STEP 02 — Choose your facial features. These appear in NPC dialogue and your Pocket-Boy file.',
            hair:       '▶ STEP 03 — Select your hair style and color. Facial hair options included.',
            eyes:       '▶ STEP 04 — Eye shape and color. Small details, big personality.',
            details:    '▶ STEP 05 — Optional scars and markings. The wasteland leaves marks.',
            extras:     '▶ STEP 06 — Accessories and voice type. Affects NPC first impressions.',
            special:    '▶ STEP 07 — S.P.E.C.I.A.L. attributes. 21 points across 7 stats. Min 1, max 10.',
            background: '▶ STEP 08 — Origin background. Grants starting bonuses and faction modifiers.',
            traits:     '▶ STEP 09 — Character traits (up to 2). Every benefit has a drawback. Choose carefully.',
          };
          const hintEl = document.getElementById('ccOnboardingText');
          const strip = document.getElementById('ccOnboardingStrip');
          if (hintEl && strip && strip.style.display !== 'none') {
            hintEl.textContent = stepHints[category] || '▶ Customize your character.';
          }

          // Render dynamic tabs on first activation
          if (category === 'special')    this._renderSpecialTab();
          if (category === 'background') this._renderBackgroundTab();
          if (category === 'traits')     this._renderTraitsTab();
        }
      });

      // Onboarding dismiss
      const dismissBtn = document.getElementById('ccOnboardingDismiss');
      if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
          const strip = document.getElementById('ccOnboardingStrip');
          if (strip) strip.style.display = 'none';
        });
      }
    },

    // ============================================================
    // RENDER OPTIONS
    // ============================================================
    _renderOptions() {
      if (!appearanceOptions) return;

      // Set name input
      document.getElementById('ccNameInput').value = currentAppearance.name || "";

      // Gender grid
      this._renderOptionGrid('ccGenderGrid', appearanceOptions.genders, 'gender');

      // Race grid
      this._renderOptionGrid('ccRaceGrid', appearanceOptions.races, 'race', true);

      // Age grid
      this._renderOptionGrid('ccAgeGrid', appearanceOptions.ageRanges, 'ageRange');

      // Body grid
      this._renderOptionGrid('ccBodyGrid', appearanceOptions.bodyTypes, 'bodyType');

      // Skin color grid
      this._renderColorGrid('ccSkinGrid', appearanceOptions.skinTones, 'skinTone');

      // Face shape grid
      this._renderOptionGrid('ccFaceShapeGrid', appearanceOptions.faceShapes, 'faceShape');

      // Nose grid
      this._renderOptionGrid('ccNoseGrid', appearanceOptions.noseTypes, 'noseType');

      // Mouth grid
      this._renderOptionGrid('ccMouthGrid', appearanceOptions.mouthTypes, 'mouthType');

      // Expression grid
      this._renderOptionGrid('ccExpressionGrid', appearanceOptions.expressions, 'expression');

      // Hair style grid
      this._renderOptionGrid('ccHairStyleGrid', appearanceOptions.hairStyles, 'hairStyle');

      // Hair color grid
      this._renderColorGrid('ccHairColorGrid', appearanceOptions.hairColors, 'hairColor');

      // Facial hair grid (filtered by gender)
      const facialHairOptions = appearanceOptions.facialHair.filter(f => 
        !f.genderRestrict || f.genderRestrict === currentAppearance.gender
      );
      this._renderOptionGrid('ccFacialHairGrid', facialHairOptions, 'facialHair');

      // Eye shape grid
      this._renderOptionGrid('ccEyeShapeGrid', appearanceOptions.eyeShapes, 'eyeShape');

      // Eye color grid (filtered by race)
      const eyeColorOptions = appearanceOptions.eyeColors.filter(e => 
        !e.raceRestrict || e.raceRestrict === currentAppearance.race
      );
      this._renderColorGrid('ccEyeColorGrid', eyeColorOptions, 'eyeColor');

      // Scar grid
      this._renderOptionGrid('ccScarGrid', appearanceOptions.scars, 'scar');

      // Marking grid (filtered by race)
      const markingOptions = appearanceOptions.markings.filter(m => 
        !m.raceRestrict || m.raceRestrict === currentAppearance.race
      );
      this._renderOptionGrid('ccMarkingGrid', markingOptions, 'marking');

      // Accessory grid
      this._renderOptionGrid('ccAccessoryGrid', appearanceOptions.accessories, 'accessory');

      // Voice grid (filtered by race)
      const voiceOptions = appearanceOptions.voices.filter(v => 
        !v.raceRestrict || v.raceRestrict === currentAppearance.race
      );
      this._renderOptionGrid('ccVoiceGrid', voiceOptions, 'voice');
    },

    // ============================================================
    // RENDER OPTION GRID
    // ============================================================
    _renderOptionGrid(containerId, options, property, showDesc = false) {
      const container = document.getElementById(containerId);
      if (!container) return;

      // BUG FIX: escape all option fields before inserting into innerHTML.
      // opt.id, opt.icon, opt.name, and opt.description come from game data JSON
      // files which could contain HTML if tampered with.
      container.innerHTML = options.map(opt => `
        <div class="cc-option-item ${currentAppearance[property] === opt.id ? 'selected' : ''}" 
             data-value="${escapeHtml(opt.id)}" data-property="${escapeHtml(property)}">
          ${opt.icon ? `<span class="option-icon">${escapeHtml(opt.icon)}</span>` : ''}
          <span class="option-name">${escapeHtml(opt.name)}</span>
          ${showDesc && opt.description ? `<span style="font-size:clamp(11px, 1.5vw, 13px);opacity:0.8;display:block;margin-top:2px;">${escapeHtml(opt.description)}</span>` : ''}
        </div>
      `).join('');

      // Click handlers
      container.querySelectorAll('.cc-option-item').forEach(item => {
        item.addEventListener('click', () => {
          const value = item.dataset.value;
          const prop = item.dataset.property;
          currentAppearance[prop] = value;
          
          // Re-render affected grids
          if (prop === 'gender' || prop === 'race') {
            this._renderOptions();
          } else {
            container.querySelectorAll('.cc-option-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
          }
          
          this._updatePreview();
        });
      });
    },

    // ============================================================
    // RENDER COLOR GRID
    // ============================================================
    _renderColorGrid(containerId, colors, property) {
      const container = document.getElementById(containerId);
      if (!container) return;

      container.innerHTML = colors.map(color => `
        <div class="cc-color-swatch ${currentAppearance[property] === color.id ? 'selected' : ''} ${color.rare ? 'rare' : ''}" 
             data-value="${color.id}" data-property="${property}"
             style="background-color: ${color.color}; ${color.glowing ? 'box-shadow: 0 0 10px ' + color.color : ''}"
             title="${color.name}">
        </div>
      `).join('');

      // Click handlers
      container.querySelectorAll('.cc-color-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
          const value = swatch.dataset.value;
          const prop = swatch.dataset.property;
          currentAppearance[prop] = value;
          
          container.querySelectorAll('.cc-color-swatch').forEach(s => s.classList.remove('selected'));
          swatch.classList.add('selected');
          
          this._updatePreview();
        });
      });
    },

    // ============================================================
    // RENDER S.P.E.C.I.A.L. TAB
    // ============================================================
    _renderSpecialTab() {
      const container = document.getElementById('ccSpecialContent');
      if (!container) return;

      const sp   = currentAppearance.special;
      const _pts  = currentAppearance.specialPoints;
      const used = SPECIAL_STATS.reduce((acc, s) => acc + (sp[s.key] - 1), 0);
      const remaining = SPECIAL_TOTAL_POINTS - used;
      currentAppearance.specialPoints = remaining;

      // Build derived stats (using base SPECIAL only — background applied on save)
      const derived = this._calcDerived(sp);

      // Vault Boy bobblehead icon — look up per-stat SVG from VAULT_BOY_SVGS

      let html = `
        <div class="cc-special-intro">
          <div class="cc-si-book-cover" aria-hidden="true"><div class="cc-si-book-title">YOU'RE</div><div class="cc-si-book-special">S.P.E.C.I.A.L.!</div></div>
          <span class="cc-si-text">"Every human being is born with <strong>S.P.E.C.I.A.L.</strong> attributes. These core values define your every action in the wasteland."</span>
        </div>
        <div class="cc-special-points-banner">
          <span class="cc-sp-label">POINTS REMAINING:</span>
          <span class="cc-sp-value" id="ccSpPoints">${escapeHtml(remaining)}</span>
        </div>
        <div class="cc-special-rows" id="ccSpecialRows">
      `;

      SPECIAL_STATS.forEach(stat => {
        const val   = sp[stat.key];
        const dots  = Array.from({length: 10}, (_, i) => `<span class="cc-sp-dot${i < val ? ' filled' : ''}"></span>`).join('');
        html += `
          <div class="cc-special-row" data-stat="${escapeHtml(stat.key)}">
            ${VAULT_BOY_SVGS[stat.abbr] || ''}
            <div class="cc-sp-meta">
              <span class="cc-sp-abbr">${escapeHtml(stat.abbr)}</span>
              <span class="cc-sp-name">${escapeHtml(stat.label)}</span>
              <span class="cc-sp-desc">${escapeHtml(stat.desc)}</span>
              <div class="cc-sp-bar"><div class="cc-sp-bar-fill" id="ccSpBar${escapeHtml(stat.key)}" style="width:${val * 10}%"></div></div>
            </div>
            <div class="cc-sp-controls">
              <button class="cc-sp-btn cc-sp-minus" data-stat="${escapeHtml(stat.key)}" ${val <= SPECIAL_MIN ? 'disabled' : ''}>−</button>
              <span class="cc-sp-num" id="ccSp${escapeHtml(stat.key)}">${val}</span>
              <button class="cc-sp-btn cc-sp-plus" data-stat="${escapeHtml(stat.key)}" ${val >= SPECIAL_MAX || remaining <= 0 ? 'disabled' : ''}>+</button>
            </div>
            <div class="cc-sp-dots" id="ccSpDots${escapeHtml(stat.key)}">${dots}</div>
          </div>
        `;
      });

      html += `</div>`;

      // Derived stats preview
      html += `
        <div class="cc-derived-stats">
          <div class="cc-derived-title">── DERIVED STATISTICS ──</div>
          <div class="cc-derived-grid" id="ccDerivedGrid">
            <div class="cc-derived-item"><span class="cc-derived-label">MAX HP</span><span class="cc-derived-val" id="ccDerMaxHP">${escapeHtml(derived.maxHP)}</span></div>
            <div class="cc-derived-item"><span class="cc-derived-label">ACTION POINTS</span><span class="cc-derived-val" id="ccDerAP">${escapeHtml(derived.actionPoints)}</span></div>
            <div class="cc-derived-item"><span class="cc-derived-label">CARRY WEIGHT</span><span class="cc-derived-val" id="ccDerCW">${escapeHtml(derived.carryWeight)}</span></div>
            <div class="cc-derived-item"><span class="cc-derived-label">RAD RESISTANCE</span><span class="cc-derived-val" id="ccDerRR">${escapeHtml(derived.radResistance)}%</span></div>
            <div class="cc-derived-item"><span class="cc-derived-label">CRIT CHANCE</span><span class="cc-derived-val" id="ccDerCC">${escapeHtml(derived.critChance)}%</span></div>
          </div>
        </div>
      `;

      container.innerHTML = html;

      // Bind +/- buttons
      container.querySelectorAll('.cc-sp-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const statKey = btn.dataset.stat;
          const isDelta = btn.classList.contains('cc-sp-plus') ? 1 : -1;
          this._adjustSpecial(statKey, isDelta);
        });
      });
    },

    // Adjust a single SPECIAL stat by delta (+1 or -1)
    _adjustSpecial(statKey, delta) {
      const sp  = currentAppearance.special;
      const cur = sp[statKey];
      const used = SPECIAL_STATS.reduce((acc, s) => acc + (sp[s.key] - 1), 0);
      const remaining = SPECIAL_TOTAL_POINTS - used;

      const newVal = cur + delta;
      if (newVal < SPECIAL_MIN || newVal > SPECIAL_MAX) return;
      if (delta > 0 && remaining <= 0) return;

      sp[statKey] = newVal;
      const newUsed = SPECIAL_STATS.reduce((acc, s) => acc + (sp[s.key] - 1), 0);
      const newRemaining = SPECIAL_TOTAL_POINTS - newUsed;
      currentAppearance.specialPoints = newRemaining;

      // Partial re-render (update only changed elements, not full re-render)
      const numEl  = document.getElementById(`ccSp${statKey}`);
      const dotsEl = document.getElementById(`ccSpDots${statKey}`);
      const barEl  = document.getElementById(`ccSpBar${statKey}`);
      const ptsBanner = document.getElementById('ccSpPoints');
      if (numEl)  numEl.textContent = newVal;
      if (dotsEl) dotsEl.innerHTML  = Array.from({length: 10}, (_, i) =>
        `<span class="cc-sp-dot${i < newVal ? ' filled' : ''}"></span>`).join('');
      if (barEl)  barEl.style.width = `${newVal * 10}%`;
      if (ptsBanner) ptsBanner.textContent = newRemaining;

      // Update button states for all stats
      SPECIAL_STATS.forEach(s => {
        const v    = sp[s.key];
        const minB = document.querySelector(`.cc-sp-minus[data-stat="${s.key}"]`);
        const maxB = document.querySelector(`.cc-sp-plus[data-stat="${s.key}"]`);
        if (minB) minB.disabled = (v <= SPECIAL_MIN);
        if (maxB) maxB.disabled = (v >= SPECIAL_MAX || newRemaining <= 0);
      });

      // Update derived stats preview
      const derived = this._calcDerived(sp);
      const _safe = id => { const el = document.getElementById(id); if (el) el.textContent = ''; return el; };
      const set  = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('ccDerMaxHP',  derived.maxHP);
      set('ccDerAP',     derived.actionPoints);
      set('ccDerCW',     derived.carryWeight);
      set('ccDerRR',     derived.radResistance + '%');
      set('ccDerCC',     derived.critChance + '%');

      // Nova comment on SPECIAL allocation (debounced)
      clearTimeout(this._novaSpecialTimer);
      this._novaSpecialTimer = setTimeout(() => {
        // High values for key stats trigger specific Nova commentary
        if (statKey === 'S' && newVal >= 7) {
          this._novaGuide.show("Structural integrity confirmed. You will break things. Vault-Tec is fine with this.");
        } else if (statKey === 'I' && newVal >= 7) {
          this._novaGuide.show("Intellectual profile noted. Try not to outsmart the Overseer. Again.");
        } else if (statKey === 'C' && newVal >= 7) {
          this._novaGuide.show("Social aptitude flagged. Please use your powers for authorized negotiations only.");
        } else if (statKey === 'P' && newVal >= 7) {
          this._novaGuide.show("Perception elevated. Vault-Tec recommends not pointing that out to other dwellers.");
        } else if (statKey === 'E' && newVal >= 7) {
          this._novaGuide.show("Endurance profile: above average. Radiation damage still applies. Just slower.");
        } else if (statKey === 'A' && newVal >= 7) {
          this._novaGuide.show("Agility confirmed exceptional. Please do not use this to skip orientation.");
        } else if (statKey === 'L' && newVal >= 7) {
          this._novaGuide.show("Luck stat flagged. Vault-Tec does not endorse luck as a survival strategy. And yet.");
        } else {
          const allEqual = SPECIAL_STATS.every(s => sp[s.key] === sp[SPECIAL_STATS[0].key]);
          if (allEqual) {
            this._novaGuide.show("Balanced allocation noted. Vault-Tec describes this as 'adequately mediocre.' Congratulations.");
          }
        }
      }, 600);
    },

    // Calculate derived stats from a SPECIAL object
    _calcDerived(sp) {
      return {
        maxHP:        90 + (sp.E * 10),
        actionPoints: 60 + (sp.A * 10),
        carryWeight:  150 + (sp.S * 10),
        radResistance: sp.E * 2,
        critChance:    sp.L
      };
    },

    // ============================================================
    // RENDER BACKGROUND TAB
    // ============================================================
    _renderBackgroundTab() {
      const container = document.getElementById('ccBackgroundContent');
      if (!container || !backgroundsData) return;

      let html = `<div class="cc-bg-list">`;

      backgroundsData.forEach(bg => {
        const isSelected = currentAppearance.background === bg.id;

        // Build SPECIAL modifier tags (green for +, red for -)
        let modTags = '';
        if (bg.specialModifiers) {
          Object.entries(bg.specialModifiers).forEach(([stat, val]) => {
            const sign  = val > 0 ? '+' : '';
            const color = val > 0 ? 'cc-mod-pos' : 'cc-mod-neg';
            modTags += `<span class="cc-mod-tag ${color}">${escapeHtml(stat)}${sign}${val}</span>`;
          });
        }

        html += `
          <div class="cc-bg-card${isSelected ? ' selected' : ''}" data-bg-id="${escapeHtml(bg.id)}">
            <div class="cc-bg-header">
              <span class="cc-bg-name">${escapeHtml(bg.name)}</span>
              <div class="cc-bg-mods">${modTags}</div>
            </div>
            <div class="cc-bg-desc">${escapeHtml(bg.description)}</div>
            ${isSelected ? `<div class="cc-bg-flavor">${escapeHtml(bg.flavor)}</div>` : ''}
          </div>
        `;
      });

      html += `</div>`;
      container.innerHTML = html;

      container.querySelectorAll('.cc-bg-card').forEach(card => {
        card.addEventListener('click', () => {
          const bgId = card.dataset.bgId;
          currentAppearance.background = (currentAppearance.background === bgId) ? null : bgId;
          this._renderBackgroundTab(); // Re-render to show/hide flavor text
          // Nova comment on background selection
          if (currentAppearance.background) {
            const selectedBg = backgroundsData.find(b => b.id === currentAppearance.background);
            if (selectedBg) {
              this._novaGuide.show(
                escapeHtml(selectedBg.name) + ": A solid history. Vault-Tec endorses your survival probability at [REDACTED]%."
              );
            }
          }
        });
      });
    },

    // ============================================================
    // RENDER TRAITS TAB
    // ============================================================
    _renderTraitsTab() {
      const container = document.getElementById('ccTraitsContent');
      if (!container || !perksData || !perksData.traits) return;

      const selected = currentAppearance.selectedTraits || [];
      let html = `<div class="cc-traits-list">`;

      perksData.traits.forEach(trait => {
        const isSelected = selected.includes(trait.id);

        // Categorise effects: SPECIAL bonuses vs other effects
        let effectTags = '';
        const SPECIAL_KEYS = ['S','P','E','C','I','A','L'];
        Object.entries(trait.effects || {}).forEach(([key, val]) => {
          if (SPECIAL_KEYS.includes(key)) {
            const sign  = val > 0 ? '+' : '';
            const color = val > 0 ? 'cc-mod-pos' : 'cc-mod-neg';
            effectTags += `<span class="cc-mod-tag ${color}">${escapeHtml(key)}${sign}${val}</span>`;
          } else if (typeof val === 'number') {
            const sign  = val > 0 ? '+' : '';
            const color = val > 0 ? 'cc-mod-pos' : 'cc-mod-neg';
            const label = key.replace(/_/g, ' ').toUpperCase();
            effectTags += `<span class="cc-mod-tag ${color}">${escapeHtml(label)}: ${sign}${escapeHtml(formatEffectValue(val))}</span>`;
          }
        });

        html += `
          <div class="cc-trait-card${isSelected ? ' selected' : ''}" data-trait-id="${escapeHtml(trait.id)}">
            <div class="cc-trait-header">
              <span class="cc-trait-name">${escapeHtml(trait.name)}</span>
              ${isSelected ? '<span class="cc-trait-badge">✓ ACTIVE</span>' : ''}
            </div>
            <div class="cc-trait-desc">${escapeHtml(trait.description)}</div>
            <div class="cc-trait-effects">${effectTags}</div>
            ${isSelected ? `<div class="cc-bg-flavor">${escapeHtml(trait.flavor)}</div>` : ''}
          </div>
        `;
      });

      html += `</div>`;
      container.innerHTML = html;

      container.querySelectorAll('.cc-trait-card').forEach(card => {
        card.addEventListener('click', () => {
          const traitId = card.dataset.traitId;
          let sel = [...(currentAppearance.selectedTraits || [])];

          if (sel.includes(traitId)) {
            // Deselect
            sel = sel.filter(t => t !== traitId);
          } else {
            // Select — if already 2, drop the oldest
            if (sel.length >= 2) sel.shift();
            sel.push(traitId);
          }

          currentAppearance.selectedTraits = sel;
          this._renderTraitsTab(); // Re-render to update UI

          // Nova comment on trait selection
          if (sel.length > 0) {
            this._novaGuide.show(
              "Trait acquisition confirmed. Side effects are not Vault-Tec's legal responsibility."
            );
          }
        });
      });
    },

    // ============================================================
    // UPDATE PREVIEW
    // ============================================================
    _updatePreview() {
      // Update portrait SVG
      const portraitContainer = document.getElementById('ccPortraitSvg');
      if (portraitContainer) {
        portraitContainer.innerHTML = this.generatePortraitSVG(currentAppearance, 240);
      }

      // Update name
      document.getElementById('ccPreviewName').textContent = currentAppearance.name || "WANDERER";

      // Update stats
      const race = appearanceOptions.races.find(r => r.id === currentAppearance.race);
      const age = appearanceOptions.ageRanges.find(a => a.id === currentAppearance.ageRange);
      document.getElementById('ccPreviewStats').textContent = 
        `${race?.name || 'Human'} • ${age?.name || 'Adult'}`;
    },

    // ============================================================
    // LOAD SAVED APPEARANCE (handles both encoded and legacy formats)
    // ============================================================
    loadSavedAppearance() {
      try {
        // Try new encoded format first
        const encodedSaved = localStorage.getItem('playerAppearance_encoded');
        if (encodedSaved) {
          const decoded = decodeURIComponent(escape(atob(encodedSaved)));
          currentAppearance = JSON.parse(decoded);
          return currentAppearance;
        }
        
        // Fallback to legacy format for migration
        const legacySaved = localStorage.getItem('playerAppearance');
        if (legacySaved) {
          currentAppearance = JSON.parse(legacySaved);
          // Migrate to new format
          const reencoded = btoa(unescape(encodeURIComponent(legacySaved)));
          localStorage.setItem('playerAppearance_encoded', reencoded);
          localStorage.removeItem('playerAppearance');
          return currentAppearance;
        }
      } catch (e) {
        console.warn("[CharacterCreator] Failed to load saved appearance:", e);
      }
      return null;
    }
  };

  // Expose private closure variable as a public getter so pipboy.js and
  // index.html can check `cc.appearanceOptions` to determine init state.
  Object.defineProperty(CharacterCreator, 'appearanceOptions', {
    get: function () { return appearanceOptions; },
    enumerable: false,
    configurable: true
  });

  // Export to Game.modules
  Game.modules.CharacterCreator = CharacterCreator;

  // Also export globally for convenience
  window.CharacterCreator = CharacterCreator;

  // NOTE: Character creator is now initialized when STATS tab is first opened
  // (see pipboy.js stat panel activation)

})();
