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
    // GENERATE SVG PORTRAIT
    // ============================================================
    generatePortraitSVG(appearance, size = 240) {
      if (!appearanceOptions) {
        return this._generateFallbackPortrait(appearance, size);
      }

      const app = appearance || currentAppearance;
      
      // Get color values
      const skinTone = appearanceOptions.skinTones.find(s => s.id === app.skinTone) || appearanceOptions.skinTones[3];
      const hairColor = appearanceOptions.hairColors.find(h => h.id === app.hairColor) || appearanceOptions.hairColors[2];
      const eyeColor = appearanceOptions.eyeColors.find(e => e.id === app.eyeColor) || appearanceOptions.eyeColors[0];
      const _race = appearanceOptions.races.find(r => r.id === app.race) || appearanceOptions.races[0];
      const faceShape = appearanceOptions.faceShapes.find(f => f.id === app.faceShape) || appearanceOptions.faceShapes[0];
      
      // Adjust skin color for ghouls
      let skinColor = skinTone.color;
      if (app.race === 'ghoul') {
        skinColor = skinTone.ghoulVariant || '#7B6B5B';
      }
      
      // Calculate face dimensions
      const faceWidth = 80 * (faceShape.widthMod || 1);
      const faceHeight = 100 * (faceShape.heightMod || 1);
      
      // Eye glow for synths
      const eyeGlow = app.race === 'synth' || (eyeColor.glowing);
      
      // Build SVG
      let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size * 1.25}" width="${size}" height="${size * 1.25}">`;
      
      // Background
      svg += `<rect width="100%" height="100%" fill="#0a1a0a"/>`;
      
      // Vignette gradient + skin texture filter + portrait-specific eye/iris gradients
      svg += `<defs>
        <radialGradient id="vignette">
          <stop offset="60%" stop-color="transparent"/>
          <stop offset="100%" stop-color="rgba(0,0,0,0.6)"/>
        </radialGradient>
        <filter id="skinTex" x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" result="noise"/>
          <feColorMatrix type="saturate" values="0" result="gray"/>
          <feBlend in="SourceGraphic" in2="gray" mode="multiply" result="blended"/>
          <feComposite in="blended" in2="SourceGraphic" operator="in"/>
        </filter>
        <radialGradient id="eyeWhiteP" cx="40%" cy="38%">
          <stop offset="0%"   stop-color="#fffff5"/>
          <stop offset="60%"  stop-color="#f5f2e0"/>
          <stop offset="100%" stop-color="#ddd8c0"/>
        </radialGradient>
        <radialGradient id="irisDepth" cx="35%" cy="30%">
          <stop offset="0%"   stop-color="#ffffff" stop-opacity="0.38"/>
          <stop offset="28%"  stop-color="${eyeColor.color}"/>
          <stop offset="72%"  stop-color="${this._darkenColor(eyeColor.color, 20)}"/>
          <stop offset="100%" stop-color="${this._darkenColor(eyeColor.color, 42)}"/>
        </radialGradient>
        <radialGradient id="pupilDepth" cx="36%" cy="30%">
          <stop offset="0%"   stop-color="#2a2a2a"/>
          <stop offset="100%" stop-color="#000000"/>
        </radialGradient>
        <radialGradient id="noseTipHL" cx="50%" cy="40%">
          <stop offset="0%"   stop-color="rgba(255,255,255,0.28)"/>
          <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
        </radialGradient>
        <radialGradient id="templeShad" cx="50%" cy="50%">
          <stop offset="0%"   stop-color="rgba(0,0,0,0.22)"/>
          <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
        </radialGradient>
        ${eyeGlow ? `<filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>` : ''}
      </defs>`;
      
      // Center point
      const cx = size / 2;
      // Push cy down enough so the crown of the tallest face shape (oblong,
      // heightMod 1.2 → faceHeight 120) sits at least ~12 px inside the viewBox.
      // At size=240 this was 0.45 (108), leaving oval/oblong crowns clipped.
      const cy = size * 0.55;
      
      // ── Hair back-layer ─────────────────────────────────────────────────────
      // Drawn FIRST so panels sit behind the face/neck skin.
      // Each flowing style uses proper Bezier panel paths instead of a blob ellipse.
      if (['long', 'medium', 'ponytail', 'braids', 'dreads'].includes(app.hairStyle)) {
        const hBL_hc  = cy - faceHeight;               // headCrown
        const hBL_fw  = faceWidth;
        const hBL_fh  = faceHeight;
        const hBL_col = hairColor.color;
        const hBL_dk  = this._darkenColor(hBL_col, 30);
        const hBL_dk2 = this._darkenColor(hBL_col, 48);
        const hBL_lt  = this._lightenColor(hBL_col, 12);
        const hBL_pt  = hBL_hc + hBL_fh * 0.52;       // panel origin (ear level)

        if (app.hairStyle === 'long') {
          // Two wide panels flowing well past the bottom of the frame
          svg += `<path d="M${cx-hBL_fw*0.90},${hBL_pt} Q${cx-hBL_fw*1.12},${cy+hBL_fh*0.18} ${cx-hBL_fw*1.06},${cy+hBL_fh*0.85} Q${cx-hBL_fw*0.92},${cy+hBL_fh*1.38} ${cx-hBL_fw*0.62},${cy+hBL_fh*1.75} L${cx-hBL_fw*0.18},${cy+hBL_fh*1.80} Q${cx-hBL_fw*0.52},${cy+hBL_fh*1.38} ${cx-hBL_fw*0.55},${cy+hBL_fh*0.85} Q${cx-hBL_fw*0.58},${cy+hBL_fh*0.28} ${cx-hBL_fw*0.88},${hBL_pt} Z" fill="${hBL_dk}"/>`;
          svg += `<path d="M${cx+hBL_fw*0.90},${hBL_pt} Q${cx+hBL_fw*1.12},${cy+hBL_fh*0.18} ${cx+hBL_fw*1.06},${cy+hBL_fh*0.85} Q${cx+hBL_fw*0.92},${cy+hBL_fh*1.38} ${cx+hBL_fw*0.62},${cy+hBL_fh*1.75} L${cx+hBL_fw*0.18},${cy+hBL_fh*1.80} Q${cx+hBL_fw*0.52},${cy+hBL_fh*1.38} ${cx+hBL_fw*0.55},${cy+hBL_fh*0.85} Q${cx+hBL_fw*0.58},${cy+hBL_fh*0.28} ${cx+hBL_fw*0.88},${hBL_pt} Z" fill="${hBL_dk}"/>`;
          // Strand lines
          svg += `<path d="M${cx-hBL_fw*0.88},${hBL_pt+10} Q${cx-hBL_fw*1.05},${cy+hBL_fh*0.50} ${cx-hBL_fw*0.95},${cy+hBL_fh*1.18}" fill="none" stroke="${hBL_dk2}" stroke-width="1.5" stroke-linecap="round" opacity="0.48"/>`;
          svg += `<path d="M${cx-hBL_fw*0.70},${hBL_pt+5} Q${cx-hBL_fw*0.82},${cy+hBL_fh*0.50} ${cx-hBL_fw*0.72},${cy+hBL_fh*1.28}" fill="none" stroke="${hBL_dk2}" stroke-width="1" stroke-linecap="round" opacity="0.38"/>`;
          svg += `<path d="M${cx+hBL_fw*0.88},${hBL_pt+10} Q${cx+hBL_fw*1.05},${cy+hBL_fh*0.50} ${cx+hBL_fw*0.95},${cy+hBL_fh*1.18}" fill="none" stroke="${hBL_dk2}" stroke-width="1.5" stroke-linecap="round" opacity="0.48"/>`;
          svg += `<path d="M${cx+hBL_fw*0.70},${hBL_pt+5} Q${cx+hBL_fw*0.82},${cy+hBL_fh*0.50} ${cx+hBL_fw*0.72},${cy+hBL_fh*1.28}" fill="none" stroke="${hBL_dk2}" stroke-width="1" stroke-linecap="round" opacity="0.38"/>`;

        } else if (app.hairStyle === 'medium') {
          // Side panels extending to jaw level
          svg += `<path d="M${cx-hBL_fw*0.90},${hBL_pt} Q${cx-hBL_fw*1.10},${cy} ${cx-hBL_fw*1.00},${cy+hBL_fh*0.48} Q${cx-hBL_fw*0.76},${cy+hBL_fh*0.75} ${cx-hBL_fw*0.48},${cy+hBL_fh*0.85} L${cx-hBL_fw*0.28},${cy+hBL_fh*0.85} Q${cx-hBL_fw*0.58},${cy+hBL_fh*0.72} ${cx-hBL_fw*0.62},${cy+hBL_fh*0.48} Q${cx-hBL_fw*0.72},${cy} ${cx-hBL_fw*0.88},${hBL_pt} Z" fill="${hBL_dk}"/>`;
          svg += `<path d="M${cx+hBL_fw*0.90},${hBL_pt} Q${cx+hBL_fw*1.10},${cy} ${cx+hBL_fw*1.00},${cy+hBL_fh*0.48} Q${cx+hBL_fw*0.76},${cy+hBL_fh*0.75} ${cx+hBL_fw*0.48},${cy+hBL_fh*0.85} L${cx+hBL_fw*0.28},${cy+hBL_fh*0.85} Q${cx+hBL_fw*0.58},${cy+hBL_fh*0.72} ${cx+hBL_fw*0.62},${cy+hBL_fh*0.48} Q${cx+hBL_fw*0.72},${cy} ${cx+hBL_fw*0.88},${hBL_pt} Z" fill="${hBL_dk}"/>`;
          svg += `<path d="M${cx-hBL_fw*0.85},${hBL_pt+8} Q${cx-hBL_fw*1.02},${cy+hBL_fh*0.24} ${cx-hBL_fw*0.92},${cy+hBL_fh*0.58}" fill="none" stroke="${hBL_dk2}" stroke-width="1.2" stroke-linecap="round" opacity="0.44"/>`;
          svg += `<path d="M${cx+hBL_fw*0.85},${hBL_pt+8} Q${cx+hBL_fw*1.02},${cy+hBL_fh*0.24} ${cx+hBL_fw*0.92},${cy+hBL_fh*0.58}" fill="none" stroke="${hBL_dk2}" stroke-width="1.2" stroke-linecap="round" opacity="0.44"/>`;

        } else if (app.hairStyle === 'ponytail') {
          // Flat back panel + tapered ponytail hanging down
          svg += `<path d="M${cx-hBL_fw*0.82},${hBL_pt} Q${cx-hBL_fw*0.92},${cy-hBL_fh*0.12} ${cx-hBL_fw*0.84},${cy+hBL_fh*0.22} L${cx+hBL_fw*0.84},${cy+hBL_fh*0.22} Q${cx+hBL_fw*0.92},${cy-hBL_fh*0.12} ${cx+hBL_fw*0.82},${hBL_pt} Q${cx+hBL_fw*0.55},${hBL_pt-10} ${cx},${hBL_pt-12} Q${cx-hBL_fw*0.55},${hBL_pt-10} ${cx-hBL_fw*0.82},${hBL_pt} Z" fill="${hBL_dk}"/>`;
          // Ponytail body — tapered cylindrical shape
          svg += `<path d="M${cx-12},${cy+hBL_fh*0.22} Q${cx-16},${cy+hBL_fh*0.65} ${cx-10},${cy+hBL_fh*1.12} Q${cx-6},${cy+hBL_fh*1.32} ${cx},${cy+hBL_fh*1.38} Q${cx+6},${cy+hBL_fh*1.32} ${cx+10},${cy+hBL_fh*1.12} Q${cx+16},${cy+hBL_fh*0.65} ${cx+12},${cy+hBL_fh*0.22} Z" fill="${hBL_col}"/>`;
          // Scrunchie band
          svg += `<rect x="${cx-14}" y="${cy+hBL_fh*0.22}" width="28" height="8" rx="3" fill="${hBL_dk2}" opacity="0.82"/>`;
          svg += `<rect x="${cx-14}" y="${cy+hBL_fh*0.22}" width="28" height="4" rx="2" fill="${hBL_lt}" opacity="0.28"/>`;
          // Tail strand lines
          svg += `<path d="M${cx-4},${cy+hBL_fh*0.30} Q${cx-6},${cy+hBL_fh*0.82} ${cx-3},${cy+hBL_fh*1.22}" fill="none" stroke="${hBL_dk2}" stroke-width="1.2" stroke-linecap="round" opacity="0.48"/>`;
          svg += `<path d="M${cx+4},${cy+hBL_fh*0.30} Q${cx+6},${cy+hBL_fh*0.82} ${cx+3},${cy+hBL_fh*1.22}" fill="none" stroke="${hBL_dk2}" stroke-width="1.2" stroke-linecap="round" opacity="0.48"/>`;

        } else if (app.hairStyle === 'braids') {
          // Two hanging braids with alternating weave marks
          const bHW  = Math.max(7, hBL_fw * 0.10);
          const bTop = cy + hBL_fh * 0.12;
          const bBot = cy + hBL_fh * 1.32;
          const bLen = bBot - bTop;
          [cx - hBL_fw * 0.42, cx + hBL_fw * 0.42].forEach(bx => {
            // Braid body (tapered tube)
            svg += `<path d="M${bx-bHW},${bTop} Q${bx-bHW-3},${bTop+bLen*0.45} ${bx-bHW+2},${bBot-10} Q${bx},${bBot+8} ${bx+bHW-2},${bBot-10} Q${bx+bHW+3},${bTop+bLen*0.45} ${bx+bHW},${bTop} Z" fill="${hBL_col}"/>`;
            // Alternating diagonal weave marks (11 segments, evenly spaced)
            for (let segIdx = 0; segIdx < 11; segIdx++) {
              const wy  = bTop + bLen * (segIdx / 11);
              const whn = bLen / 11;
              if (segIdx % 2 === 0) {
                svg += `<path d="M${bx-bHW},${wy} Q${bx},${wy+whn*0.35} ${bx+bHW},${wy+whn*0.65}" fill="none" stroke="${hBL_dk2}" stroke-width="1.4" stroke-linecap="round" opacity="0.55"/>`;
              } else {
                svg += `<path d="M${bx-bHW},${wy+whn*0.65} Q${bx},${wy+whn*0.35} ${bx+bHW},${wy}" fill="none" stroke="${hBL_dk2}" stroke-width="1.4" stroke-linecap="round" opacity="0.55"/>`;
              }
            }
            // Tie at top + rounded tip
            svg += `<rect x="${bx-bHW}" y="${bTop-4}" width="${bHW*2}" height="7" rx="3" fill="${hBL_dk2}" opacity="0.82"/>`;
            svg += `<path d="M${bx-bHW+2},${bBot-8} Q${bx},${bBot+8} ${bx+bHW-2},${bBot-8}" fill="${hBL_dk2}" opacity="0.72"/>`;
          });

        } else if (app.hairStyle === 'dreads') {
          // Five fat dreadlocks with knotted wrap rings
          const dTop = cy + hBL_fh * 0.14;
          const dCfg = [
            { x: cx - hBL_fw * 0.68, w: 8,  len: hBL_fh * 1.05 },
            { x: cx - hBL_fw * 0.36, w: 10, len: hBL_fh * 1.28 },
            { x: cx,                  w: 9,  len: hBL_fh * 1.18 },
            { x: cx + hBL_fw * 0.36, w: 10, len: hBL_fh * 1.28 },
            { x: cx + hBL_fw * 0.68, w: 8,  len: hBL_fh * 1.05 },
          ];
          dCfg.forEach(d => {
            const dBot = dTop + d.len;
            svg += `<path d="M${d.x-d.w},${dTop} Q${d.x-d.w-4},${dTop+d.len*0.35} ${d.x-d.w+3},${dTop+d.len*0.65} Q${d.x-d.w-1},${dBot-8} ${d.x},${dBot} Q${d.x+d.w+1},${dBot-8} ${d.x+d.w-3},${dTop+d.len*0.65} Q${d.x+d.w+4},${dTop+d.len*0.35} ${d.x+d.w},${dTop} Z" fill="${hBL_col}"/>`;
            // Wrap rings suggesting knotted/wrapped texture
            const wrapCount = Math.max(3, Math.floor(d.len / 20));
            for (let wrapIdx = 1; wrapIdx <= wrapCount; wrapIdx++) {
              const wy = dTop + d.len * (wrapIdx / (wrapCount + 1));
              svg += `<ellipse cx="${d.x}" cy="${wy}" rx="${d.w-1}" ry="3.5" fill="${hBL_dk2}" opacity="0.44"/>`;
              svg += `<ellipse cx="${d.x}" cy="${wy}" rx="${d.w-3}" ry="1.5" fill="${hBL_lt}" opacity="0.14"/>`;
            }
            svg += `<ellipse cx="${d.x}" cy="${dBot}" rx="${d.w-2}" ry="5" fill="${hBL_dk2}" opacity="0.65"/>`;
          });
        }
      }

      // Neck — tapered column with subtle bottom shadow
      svg += `<path d="M${cx-18},${cy+faceHeight*0.55} C${cx-22},${cy+faceHeight*0.7} ${cx-20},${cy+faceHeight*1.05} ${cx-14},${cy+faceHeight*1.2} L${cx+14},${cy+faceHeight*1.2} C${cx+20},${cy+faceHeight*1.05} ${cx+22},${cy+faceHeight*0.7} ${cx+18},${cy+faceHeight*0.55} Z" fill="${skinColor}"/>`;
      // Neck/jaw junction shadow
      svg += `<ellipse cx="${cx}" cy="${cy+faceHeight*0.62}" rx="20" ry="7" fill="rgba(0,0,0,0.22)"/>`;

      // Ears — drawn before face base so skin silhouette slightly overlaps inner edges
      const earDk       = this._darkenColor(skinColor, 25);
      const earCy       = cy - faceHeight * 0.08;
      const earRx       = Math.max(6, faceWidth * 0.09);
      const earRy       = Math.max(12, faceHeight * 0.19);
      const earInnerOff = earRy * 0.12; // proportional inner-shadow vertical offset
      // Left ear
      svg += `<ellipse cx="${cx - faceWidth * 0.94}" cy="${earCy}" rx="${earRx}" ry="${earRy}" fill="${skinColor}"/>`;
      svg += `<ellipse cx="${cx - faceWidth * 0.88}" cy="${earCy + earInnerOff}" rx="${earRx * 0.55}" ry="${earRy * 0.52}" fill="${earDk}" opacity="0.40"/>`;
      // Right ear
      svg += `<ellipse cx="${cx + faceWidth * 0.94}" cy="${earCy}" rx="${earRx}" ry="${earRy}" fill="${skinColor}"/>`;
      svg += `<ellipse cx="${cx + faceWidth * 0.88}" cy="${earCy + earInnerOff}" rx="${earRx * 0.55}" ry="${earRy * 0.52}" fill="${earDk}" opacity="0.40"/>`;

      // Face base — 5-point anatomical silhouette (wider temples, defined jaw/chin)
      svg += `<path d="
        M ${cx},${cy-faceHeight}
        C ${cx+faceWidth*0.85},${cy-faceHeight*0.95} ${cx+faceWidth},${cy-faceHeight*0.38} ${cx+faceWidth*0.9},${cy+faceHeight*0.18}
        C ${cx+faceWidth*0.74},${cy+faceHeight*0.60} ${cx+faceWidth*0.30},${cy+faceHeight*0.90} ${cx},${cy+faceHeight}
        C ${cx-faceWidth*0.30},${cy+faceHeight*0.90} ${cx-faceWidth*0.74},${cy+faceHeight*0.60} ${cx-faceWidth*0.9},${cy+faceHeight*0.18}
        C ${cx-faceWidth},${cy-faceHeight*0.38} ${cx-faceWidth*0.85},${cy-faceHeight*0.95} ${cx},${cy-faceHeight}
        Z" fill="${skinColor}" filter="url(#skinTex)"/>`;

      // Temple / cheekbone shadows for 3-D depth
      svg += `<ellipse cx="${cx-faceWidth*0.76}" cy="${cy}" rx="${faceWidth*0.38}" ry="${faceHeight*0.52}" fill="url(#templeShad)"/>`;
      svg += `<ellipse cx="${cx+faceWidth*0.76}" cy="${cy}" rx="${faceWidth*0.38}" ry="${faceHeight*0.52}" fill="url(#templeShad)"/>`;
      // Subtle under-chin / jaw darkening
      svg += `<ellipse cx="${cx}" cy="${cy+faceHeight*0.82}" rx="${faceWidth*0.55}" ry="${faceHeight*0.18}" fill="rgba(0,0,0,0.10)"/>`;
      // Forehead ambient highlight — top-lit for 3-D depth
      svg += `<ellipse cx="${cx}" cy="${cy - faceHeight * 0.56}" rx="${faceWidth * 0.50}" ry="${faceHeight * 0.26}" fill="rgba(255,255,255,0.07)"/>`;
      // Cheekbone catch-lights
      svg += `<ellipse cx="${cx - faceWidth * 0.50}" cy="${cy + faceHeight * 0.13}" rx="${faceWidth * 0.20}" ry="${faceHeight * 0.12}" fill="rgba(255,255,255,0.06)"/>`;
      svg += `<ellipse cx="${cx + faceWidth * 0.50}" cy="${cy + faceHeight * 0.13}" rx="${faceWidth * 0.20}" ry="${faceHeight * 0.12}" fill="rgba(255,255,255,0.06)"/>`;

      // Ghoul texture — use deterministic positions based on appearance hash
      if (app.race === 'ghoul') {
        // Generate consistent patches using simple hash from appearance
        const hashStr = `${app.skinTone}${app.faceShape}${app.hairStyle}`;
        let hash = 0;
        for (let i = 0; i < hashStr.length; i++) {
          hash = ((hash << 5) - hash) + hashStr.charCodeAt(i);
          hash = hash & hash;
        }
        // Add rough patches at deterministic positions
        const patchPositions = [
          { dx: 0.3, dy: -0.2, r: 8 },
          { dx: -0.25, dy: 0.15, r: 6 },
          { dx: 0.15, dy: 0.35, r: 10 },
          { dx: -0.35, dy: -0.1, r: 7 },
          { dx: 0.05, dy: 0.25, r: 9 }
        ];
        patchPositions.forEach((pos, _i) => {
          const px = cx + pos.dx * faceWidth;
          const py = cy + pos.dy * faceHeight;
          svg += `<circle cx="${px}" cy="${py}" r="${pos.r}" fill="rgba(80,60,40,0.3)"/>`;
        });
      }
      
      // ── Hair top cap ─────────────────────────────────────────────────────────
      // Drawn ON TOP of the face skin. Bezier paths for each style give a
      // unique silhouette. All coords are relative to headCrown so proportions
      // scale correctly with all face shapes.
      if (app.hairStyle !== 'bald') {
        const hc  = cy - faceHeight;   // headCrown
        const fw  = faceWidth;
        const fh  = faceHeight;
        const hCol  = hairColor.color;
        const hDk   = this._darkenColor(hCol, 28);
        const hDk2  = this._darkenColor(hCol, 48);
        const hLt   = this._lightenColor(hCol, 15);

        switch (app.hairStyle) {
          case 'buzzcut': {
            // Very tight cap — sits like a thin skin on the skull
            const hlY = hc + fh * 0.58;
            svg += `<path d="M${cx-fw*0.82},${hlY} Q${cx-fw*1.00},${hc+fh*0.20} ${cx-fw*0.72},${hc+fh*0.04} Q${cx-fw*0.28},${hc-fh*0.02} ${cx},${hc-fh*0.02} Q${cx+fw*0.28},${hc-fh*0.02} ${cx+fw*0.72},${hc+fh*0.04} Q${cx+fw*1.00},${hc+fh*0.20} ${cx+fw*0.82},${hlY} Q${cx+fw*0.60},${hlY-8} ${cx},${hlY-10} Q${cx-fw*0.60},${hlY-8} ${cx-fw*0.82},${hlY} Z" fill="${hCol}"/>`;
            svg += `<path d="M${cx-fw*0.35},${hc+fh*0.12} Q${cx},${hc-fh*0.03} ${cx+fw*0.35},${hc+fh*0.12}" fill="none" stroke="${hLt}" stroke-width="2.5" stroke-linecap="round" opacity="0.50"/>`;
            svg += `<path d="M${cx-fw*0.82},${hlY} Q${cx-fw*0.60},${hlY-6} ${cx},${hlY-8} Q${cx+fw*0.60},${hlY-6} ${cx+fw*0.82},${hlY}" fill="none" stroke="${hDk}" stroke-width="1.5" stroke-linecap="round" opacity="0.55"/>`;
            // Stipple dots — stubble texture
            [{dx:-0.55,dy:0.42},{dx:-0.35,dy:0.34},{dx:-0.15,dy:0.29},{dx:0.06,dy:0.27},{dx:0.26,dy:0.30},{dx:0.48,dy:0.36},{dx:0.64,dy:0.44}].forEach(d => {
              svg += `<circle cx="${cx+fw*d.dx}" cy="${hc+fh*d.dy}" r="1.2" fill="${hDk}" opacity="0.40"/>`;
            });
            break;
          }

          case 'short': {
            // Classic short cut with side-sweep texture
            const hlY = hc + fh * 0.65;
            svg += `<path d="M${cx-fw*0.88},${hlY} Q${cx-fw*1.06},${hc+fh*0.28} ${cx-fw*0.76},${hc+fh*0.04} Q${cx-fw*0.28},${hc-fh*0.05} ${cx},${hc-fh*0.05} Q${cx+fw*0.28},${hc-fh*0.05} ${cx+fw*0.76},${hc+fh*0.04} Q${cx+fw*1.06},${hc+fh*0.28} ${cx+fw*0.88},${hlY} Q${cx+fw*0.65},${hlY-12} ${cx},${hlY-14} Q${cx-fw*0.65},${hlY-12} ${cx-fw*0.88},${hlY} Z" fill="${hCol}"/>`;
            // Temple bulk
            svg += `<path d="M${cx-fw*0.88},${hlY} Q${cx-fw*0.98},${hlY+14} ${cx-fw*0.88},${hlY+26} Q${cx-fw*0.82},${hlY+18} ${cx-fw*0.78},${hlY} Z" fill="${hDk}" opacity="0.55"/>`;
            svg += `<path d="M${cx+fw*0.88},${hlY} Q${cx+fw*0.98},${hlY+14} ${cx+fw*0.88},${hlY+26} Q${cx+fw*0.82},${hlY+18} ${cx+fw*0.78},${hlY} Z" fill="${hDk}" opacity="0.55"/>`;
            svg += `<path d="M${cx-fw*0.40},${hc+fh*0.10} Q${cx},${hc-fh*0.05} ${cx+fw*0.40},${hc+fh*0.10}" fill="none" stroke="${hLt}" stroke-width="3" stroke-linecap="round" opacity="0.48"/>`;
            // Side-sweep texture arcs
            [0.36, 0.46, 0.54, 0.60].forEach(t => {
              svg += `<path d="M${cx-fw*0.62},${hc+fh*t} Q${cx-fw*0.10},${hc+fh*(t-0.08)} ${cx+fw*0.58},${hc+fh*(t+0.03)}" fill="none" stroke="${hDk}" stroke-width="1.1" stroke-linecap="round" opacity="0.32"/>`;
            });
            svg += `<path d="M${cx-fw*0.88},${hlY} Q${cx-fw*0.65},${hlY-10} ${cx},${hlY-12} Q${cx+fw*0.65},${hlY-10} ${cx+fw*0.88},${hlY}" fill="none" stroke="${hDk}" stroke-width="1.5" stroke-linecap="round" opacity="0.50"/>`;
            break;
          }

          case 'medium': {
            // Medium cap; side panels already drawn in back layer
            const hlY = hc + fh * 0.67;
            svg += `<path d="M${cx-fw*0.90},${hlY} Q${cx-fw*1.08},${hc+fh*0.32} ${cx-fw*0.78},${hc+fh*0.04} Q${cx-fw*0.28},${hc-fh*0.05} ${cx},${hc-fh*0.06} Q${cx+fw*0.28},${hc-fh*0.05} ${cx+fw*0.78},${hc+fh*0.04} Q${cx+fw*1.08},${hc+fh*0.32} ${cx+fw*0.90},${hlY} Q${cx+fw*0.65},${hlY-14} ${cx},${hlY-16} Q${cx-fw*0.65},${hlY-14} ${cx-fw*0.90},${hlY} Z" fill="${hCol}"/>`;
            svg += `<path d="M${cx-fw*0.40},${hc+fh*0.10} Q${cx},${hc-fh*0.06} ${cx+fw*0.40},${hc+fh*0.10}" fill="none" stroke="${hLt}" stroke-width="3" stroke-linecap="round" opacity="0.44"/>`;
            svg += `<path d="M${cx-fw*0.65},${hc+fh*0.35} Q${cx-fw*0.82},${hc+fh*0.50} ${cx-fw*0.86},${hlY-5}" fill="none" stroke="${hDk}" stroke-width="1.2" stroke-linecap="round" opacity="0.40"/>`;
            svg += `<path d="M${cx+fw*0.65},${hc+fh*0.35} Q${cx+fw*0.82},${hc+fh*0.50} ${cx+fw*0.86},${hlY-5}" fill="none" stroke="${hDk}" stroke-width="1.2" stroke-linecap="round" opacity="0.40"/>`;
            svg += `<path d="M${cx-fw*0.90},${hlY} Q${cx-fw*0.65},${hlY-12} ${cx},${hlY-14} Q${cx+fw*0.65},${hlY-12} ${cx+fw*0.90},${hlY}" fill="none" stroke="${hDk}" stroke-width="1.5" stroke-linecap="round" opacity="0.50"/>`;
            break;
          }

          case 'long': {
            // Long — top cap with center part; flowing panels in back layer
            const hlY = hc + fh * 0.68;
            svg += `<path d="M${cx-fw*0.90},${hlY} Q${cx-fw*1.08},${hc+fh*0.32} ${cx-fw*0.78},${hc+fh*0.04} Q${cx-fw*0.24},${hc-fh*0.06} ${cx},${hc-fh*0.07} Q${cx+fw*0.24},${hc-fh*0.06} ${cx+fw*0.78},${hc+fh*0.04} Q${cx+fw*1.08},${hc+fh*0.32} ${cx+fw*0.90},${hlY} Q${cx+fw*0.65},${hlY-16} ${cx},${hlY-18} Q${cx-fw*0.65},${hlY-16} ${cx-fw*0.90},${hlY} Z" fill="${hCol}"/>`;
            // Center part line
            svg += `<path d="M${cx},${hc-fh*0.06} L${cx},${hlY-18}" fill="none" stroke="${hDk}" stroke-width="1.5" stroke-linecap="round" opacity="0.50"/>`;
            // Crown highlights flanking part
            svg += `<path d="M${cx-fw*0.42},${hc+fh*0.12} Q${cx-fw*0.12},${hc-fh*0.04} ${cx-fw*0.02},${hc+fh*0.08}" fill="none" stroke="${hLt}" stroke-width="2.5" stroke-linecap="round" opacity="0.46"/>`;
            svg += `<path d="M${cx+fw*0.42},${hc+fh*0.12} Q${cx+fw*0.12},${hc-fh*0.04} ${cx+fw*0.02},${hc+fh*0.08}" fill="none" stroke="${hLt}" stroke-width="2.5" stroke-linecap="round" opacity="0.46"/>`;
            svg += `<path d="M${cx-fw*0.90},${hlY} Q${cx-fw*0.65},${hlY-14} ${cx},${hlY-16} Q${cx+fw*0.65},${hlY-14} ${cx+fw*0.90},${hlY}" fill="none" stroke="${hDk}" stroke-width="1.5" stroke-linecap="round" opacity="0.50"/>`;
            break;
          }

          case 'mohawk': {
            // Shaved sides + spiky center strip
            const mohW  = Math.max(9, fw * 0.13);
            const mBase = hc + fh * 0.52;
            const mTip  = hc - fh * 0.28;
            // Shaved-side shadow (subtle stubble)
            svg += `<ellipse cx="${cx-fw*0.58}" cy="${hc+fh*0.38}" rx="${fw*0.42}" ry="${fh*0.44}" fill="${hDk2}" opacity="0.15"/>`;
            svg += `<ellipse cx="${cx+fw*0.58}" cy="${hc+fh*0.38}" rx="${fw*0.42}" ry="${fh*0.44}" fill="${hDk2}" opacity="0.15"/>`;
            // Stubble dots
            [{dx:-0.72,dy:0.28},{dx:-0.58,dy:0.38},{dx:-0.68,dy:0.48},{dx:-0.52,dy:0.20},
             {dx: 0.72,dy:0.28},{dx: 0.58,dy:0.38},{dx: 0.68,dy:0.48},{dx: 0.52,dy:0.20}].forEach(d => {
              svg += `<circle cx="${cx+fw*d.dx}" cy="${hc+fh*d.dy}" r="1.1" fill="${hDk2}" opacity="0.30"/>`;
            });
            // Main mohawk strip — narrow, rises to spike tip
            svg += `<path d="M${cx-mohW},${mBase} Q${cx-mohW-3},${mBase-fh*0.20} ${cx-mohW+1},${mBase-fh*0.44} Q${cx-mohW-2},${mBase-fh*0.60} ${cx-mohW+4},${mBase-fh*0.76} L${cx-3},${mTip+6} L${cx},${mTip} L${cx+3},${mTip+6} L${cx+mohW-4},${mBase-fh*0.76} Q${cx+mohW+2},${mBase-fh*0.60} ${cx+mohW-1},${mBase-fh*0.44} Q${cx+mohW+3},${mBase-fh*0.20} ${cx+mohW},${mBase} Z" fill="${hCol}"/>`;
            // Center spine highlight
            svg += `<path d="M${cx},${mTip} L${cx},${mBase}" fill="none" stroke="${hLt}" stroke-width="2" stroke-linecap="round" opacity="0.40"/>`;
            // Tip gleam
            svg += `<path d="M${cx-3},${mTip+10} L${cx},${mTip} L${cx+3},${mTip+10}" fill="none" stroke="${hLt}" stroke-width="1.8" stroke-linecap="round" opacity="0.55"/>`;
            // Side edge shading
            svg += `<path d="M${cx-mohW},${mBase} Q${cx-mohW-2},${mBase-fh*0.50} ${cx-mohW+2},${mTip+12}" fill="none" stroke="${hDk}" stroke-width="1.5" stroke-linecap="round" opacity="0.50"/>`;
            svg += `<path d="M${cx+mohW},${mBase} Q${cx+mohW+2},${mBase-fh*0.50} ${cx+mohW-2},${mTip+12}" fill="none" stroke="${hDk}" stroke-width="1.5" stroke-linecap="round" opacity="0.50"/>`;
            svg += `<path d="M${cx-mohW},${mBase} Q${cx},${mBase+5} ${cx+mohW},${mBase}" fill="none" stroke="${hDk}" stroke-width="2.5" stroke-linecap="round" opacity="0.60"/>`;
            break;
          }

          case 'ponytail': {
            // Smooth flat cap pulled tightly back; tail is in the back layer
            const hlY = hc + fh * 0.60;
            svg += `<path d="M${cx-fw*0.85},${hlY} Q${cx-fw*1.02},${hc+fh*0.22} ${cx-fw*0.72},${hc+fh*0.03} Q${cx-fw*0.22},${hc-fh*0.06} ${cx},${hc-fh*0.07} Q${cx+fw*0.22},${hc-fh*0.06} ${cx+fw*0.72},${hc+fh*0.03} Q${cx+fw*1.02},${hc+fh*0.22} ${cx+fw*0.85},${hlY} Q${cx+fw*0.65},${hlY-10} ${cx},${hlY-12} Q${cx-fw*0.65},${hlY-10} ${cx-fw*0.85},${hlY} Z" fill="${hCol}"/>`;
            // Wide pomade-like shine (pulled-back tension)
            svg += `<path d="M${cx-fw*0.55},${hc+fh*0.14} Q${cx},${hc-fh*0.05} ${cx+fw*0.55},${hc+fh*0.14}" fill="none" stroke="${hLt}" stroke-width="4" stroke-linecap="round" opacity="0.52"/>`;
            // Back-sweep texture lines
            [0.24, 0.37, 0.48, 0.56].forEach(t => {
              svg += `<path d="M${cx-fw*0.80},${hc+fh*t} Q${cx-fw*0.40},${hc+fh*(t-0.05)} ${cx+fw*0.80},${hc+fh*t}" fill="none" stroke="${hDk}" stroke-width="1" stroke-linecap="round" opacity="0.28"/>`;
            });
            svg += `<path d="M${cx-fw*0.85},${hlY} Q${cx-fw*0.65},${hlY-9} ${cx},${hlY-11} Q${cx+fw*0.65},${hlY-9} ${cx+fw*0.85},${hlY}" fill="none" stroke="${hDk}" stroke-width="1.5" stroke-linecap="round" opacity="0.50"/>`;
            break;
          }

          case 'braids': {
            // Braided top cap with center part; braid bodies in back layer
            const hlY = hc + fh * 0.66;
            svg += `<path d="M${cx-fw*0.90},${hlY} Q${cx-fw*1.08},${hc+fh*0.30} ${cx-fw*0.78},${hc+fh*0.04} Q${cx-fw*0.28},${hc-fh*0.05} ${cx},${hc-fh*0.06} Q${cx+fw*0.28},${hc-fh*0.05} ${cx+fw*0.78},${hc+fh*0.04} Q${cx+fw*1.08},${hc+fh*0.30} ${cx+fw*0.90},${hlY} Q${cx+fw*0.65},${hlY-13} ${cx},${hlY-15} Q${cx-fw*0.65},${hlY-13} ${cx-fw*0.90},${hlY} Z" fill="${hCol}"/>`;
            // Center part
            svg += `<path d="M${cx},${hc-fh*0.05} L${cx},${hlY-15}" fill="none" stroke="${hDk}" stroke-width="1.5" stroke-linecap="round" opacity="0.48"/>`;
            svg += `<path d="M${cx-fw*0.38},${hc+fh*0.11} Q${cx-fw*0.12},${hc-fh*0.04} ${cx-fw*0.02},${hc+fh*0.06}" fill="none" stroke="${hLt}" stroke-width="2.5" stroke-linecap="round" opacity="0.45"/>`;
            svg += `<path d="M${cx+fw*0.38},${hc+fh*0.11} Q${cx+fw*0.12},${hc-fh*0.04} ${cx+fw*0.02},${hc+fh*0.06}" fill="none" stroke="${hLt}" stroke-width="2.5" stroke-linecap="round" opacity="0.45"/>`;
            svg += `<path d="M${cx-fw*0.90},${hlY} Q${cx-fw*0.65},${hlY-11} ${cx},${hlY-13} Q${cx+fw*0.65},${hlY-11} ${cx+fw*0.90},${hlY}" fill="none" stroke="${hDk}" stroke-width="1.5" stroke-linecap="round" opacity="0.50"/>`;
            break;
          }

          case 'dreads': {
            // Dreads top cap; dread bodies in back layer
            const hlY = hc + fh * 0.66;
            svg += `<path d="M${cx-fw*0.90},${hlY} Q${cx-fw*1.08},${hc+fh*0.30} ${cx-fw*0.78},${hc+fh*0.04} Q${cx-fw*0.28},${hc-fh*0.05} ${cx},${hc-fh*0.06} Q${cx+fw*0.28},${hc-fh*0.05} ${cx+fw*0.78},${hc+fh*0.04} Q${cx+fw*1.08},${hc+fh*0.30} ${cx+fw*0.90},${hlY} Q${cx+fw*0.65},${hlY-13} ${cx},${hlY-15} Q${cx-fw*0.65},${hlY-13} ${cx-fw*0.90},${hlY} Z" fill="${hCol}"/>`;
            svg += `<path d="M${cx-fw*0.38},${hc+fh*0.12} Q${cx},${hc-fh*0.05} ${cx+fw*0.38},${hc+fh*0.12}" fill="none" stroke="${hLt}" stroke-width="3" stroke-linecap="round" opacity="0.42"/>`;
            svg += `<path d="M${cx-fw*0.90},${hlY} Q${cx-fw*0.65},${hlY-11} ${cx},${hlY-13} Q${cx+fw*0.65},${hlY-11} ${cx+fw*0.90},${hlY}" fill="none" stroke="${hDk}" stroke-width="1.5" stroke-linecap="round" opacity="0.50"/>`;
            break;
          }

          case 'slickedback': {
            // Very flat cap, dramatically swept backward with pomade shine
            const hlY = hc + fh * 0.57;
            svg += `<path d="M${cx-fw*0.88},${hlY} Q${cx-fw*1.05},${hc+fh*0.18} ${cx-fw*0.70},${hc+fh*0.02} Q${cx-fw*0.22},${hc-fh*0.06} ${cx},${hc-fh*0.07} Q${cx+fw*0.22},${hc-fh*0.06} ${cx+fw*0.70},${hc+fh*0.02} Q${cx+fw*1.05},${hc+fh*0.18} ${cx+fw*0.88},${hlY} Q${cx+fw*0.62},${hlY-6} ${cx},${hlY-7} Q${cx-fw*0.62},${hlY-6} ${cx-fw*0.88},${hlY} Z" fill="${hCol}"/>`;
            // Root shadow (hair flattened tight)
            svg += `<ellipse cx="${cx}" cy="${hc+fh*0.48}" rx="${fw*0.62}" ry="${fh*0.10}" fill="${hDk}" opacity="0.20"/>`;
            // Wide pomade shine
            svg += `<path d="M${cx-fw*0.62},${hc+fh*0.11} Q${cx},${hc-fh*0.05} ${cx+fw*0.62},${hc+fh*0.11}" fill="none" stroke="${hLt}" stroke-width="5.5" stroke-linecap="round" opacity="0.54"/>`;
            svg += `<path d="M${cx-fw*0.58},${hc+fh*0.13} Q${cx},${hc-fh*0.03} ${cx+fw*0.58},${hc+fh*0.13}" fill="none" stroke="${hLt}" stroke-width="2" stroke-linecap="round" opacity="0.32"/>`;
            // Back-sweep texture lines
            [0.20, 0.30, 0.40, 0.50].forEach(t => {
              svg += `<path d="M${cx-fw*0.84},${hc+fh*t} Q${cx-fw*0.42},${hc+fh*(t-0.06)} ${cx+fw*0.56},${hc+fh*t}" fill="none" stroke="${hDk}" stroke-width="1.2" stroke-linecap="round" opacity="0.36"/>`;
            });
            svg += `<path d="M${cx-fw*0.88},${hlY} Q${cx-fw*0.62},${hlY-5} ${cx},${hlY-6} Q${cx+fw*0.62},${hlY-5} ${cx+fw*0.88},${hlY}" fill="none" stroke="${hDk}" stroke-width="1.5" stroke-linecap="round" opacity="0.55"/>`;
            break;
          }

          case 'wasteland':
          default: {
            // Messy, matted, asymmetric post-apoc hair
            const hlY = hc + fh * 0.68;
            // Jagged irregular cap outline
            svg += `<path d="M${cx-fw*0.88},${hlY} Q${cx-fw*1.08},${hc+fh*0.32} ${cx-fw*0.82},${hc+fh*0.08} Q${cx-fw*0.65},${hc-fh*0.02} ${cx-fw*0.38},${hc-fh*0.06} Q${cx-fw*0.18},${hc-fh*0.10} ${cx},${hc-fh*0.08} Q${cx+fw*0.12},${hc-fh*0.12} ${cx+fw*0.28},${hc-fh*0.08} Q${cx+fw*0.50},${hc-fh*0.02} ${cx+fw*0.68},${hc+fh*0.06} Q${cx+fw*0.90},${hc+fh*0.20} ${cx+fw*0.92},${hlY} Q${cx+fw*0.68},${hlY-10} ${cx+fw*0.20},${hlY-17} Q${cx},${hlY-15} ${cx-fw*0.20},${hlY-19} Q${cx-fw*0.55},${hlY-12} ${cx-fw*0.88},${hlY} Z" fill="${hCol}"/>`;
            // Wild sticking-out wisps
            svg += `<path d="M${cx-fw*0.88},${hc+fh*0.40} Q${cx-fw*1.22},${hc+fh*0.15} ${cx-fw*1.12},${hc}" fill="none" stroke="${hCol}" stroke-width="3.5" stroke-linecap="round"/>`;
            svg += `<path d="M${cx-fw*0.70},${hc+fh*0.22} Q${cx-fw*0.96},${hc+fh*0.04} ${cx-fw*0.88},${hc-fh*0.12}" fill="none" stroke="${hCol}" stroke-width="2.5" stroke-linecap="round"/>`;
            svg += `<path d="M${cx+fw*0.82},${hc+fh*0.35} Q${cx+fw*1.16},${hc+fh*0.18} ${cx+fw*1.06},${hc+fh*0.02}" fill="none" stroke="${hCol}" stroke-width="3" stroke-linecap="round"/>`;
            svg += `<path d="M${cx-fw*0.10},${hc-fh*0.08} Q${cx+fw*0.06},${hc-fh*0.26} ${cx-fw*0.08},${hc-fh*0.36}" fill="none" stroke="${hCol}" stroke-width="2.5" stroke-linecap="round"/>`;
            // Dark matted patches
            svg += `<path d="M${cx-fw*0.26},${hc+fh*0.30} Q${cx+fw*0.10},${hc+fh*0.25} ${cx+fw*0.40},${hc+fh*0.35}" fill="none" stroke="${hDk}" stroke-width="3.5" stroke-linecap="round" opacity="0.32"/>`;
            svg += `<path d="M${cx-fw*0.55},${hc+fh*0.18} Q${cx-fw*0.30},${hc+fh*0.14} ${cx-fw*0.08},${hc+fh*0.20}" fill="none" stroke="${hDk}" stroke-width="3" stroke-linecap="round" opacity="0.28"/>`;
            // Muted highlight (dirty, no shine)
            svg += `<path d="M${cx-fw*0.30},${hc+fh*0.15} Q${cx+fw*0.08},${hc} ${cx+fw*0.35},${hc+fh*0.12}" fill="none" stroke="${hLt}" stroke-width="2" stroke-linecap="round" opacity="0.22"/>`;
            // Jagged hairline
            svg += `<path d="M${cx-fw*0.88},${hlY} Q${cx-fw*0.65},${hlY-8} ${cx-fw*0.20},${hlY-14} Q${cx},${hlY-12} ${cx+fw*0.28},${hlY-16} Q${cx+fw*0.60},${hlY-10} ${cx+fw*0.92},${hlY}" fill="none" stroke="${hDk}" stroke-width="1.5" stroke-linecap="round" opacity="0.48"/>`;
            break;
          }
        }
      }
      
      // Eyes — fully detailed with almond whites, iris depth, pupil, catchlights, lash lines
      const eyeY = cy - 10;
      const eyeSpacing = 25;
      const eyeWidth = 18;
      const eyeHeight = app.eyeShape === 'round' ? 14 : 10;
      const irisR = 8;
      const pupilR = 4;
      const irisFilter = eyeGlow ? ' filter="url(#glow)"' : '';

      // Helper to build one detailed eye at (ex, ey)
      const buildEye = (ex, ey, isRight) => {
        const ew = eyeWidth, eh = eyeHeight;
        // Socket shadow
        let e = `<ellipse cx="${ex}" cy="${ey}" rx="${ew+4}" ry="${eh+3}" fill="rgba(0,0,0,0.13)"/>`;
        // Eye white — almond path
        e += `<path d="M${ex-ew},${ey} Q${ex-ew*0.4},${ey-eh*1.15} ${ex},${ey-eh*0.85} Q${ex+ew*0.4},${ey-eh*1.15} ${ex+ew},${ey} Q${ex+ew*0.4},${ey+eh*0.65} ${ex},${ey+eh*0.65} Q${ex-ew*0.4},${ey+eh*0.65} ${ex-ew},${ey} Z" fill="url(#eyeWhiteP)"/>`;
        // Upper eyelid crease
        e += `<path d="M${ex-ew},${ey} Q${ex},${ey-eh*1.3} ${ex+ew},${ey}" fill="none" stroke="${this._darkenColor(skinColor, 14)}" stroke-width="1" stroke-linecap="round" opacity="0.45"/>`;
        // Iris
        e += `<circle cx="${ex}" cy="${ey}" r="${irisR}"${irisFilter} fill="url(#irisDepth)"/>`;
        // Limbal ring
        e += `<circle cx="${ex}" cy="${ey}" r="${irisR}" fill="none" stroke="${this._darkenColor(eyeColor.color, 50)}" stroke-width="1.8" opacity="0.72"/>`;
        // Pupil
        e += `<circle cx="${ex}" cy="${ey}" r="${pupilR}" fill="url(#pupilDepth)"/>`;
        // Catchlights
        const _clSign = isRight ? 1 : 1;
        e += `<circle cx="${ex + irisR*0.36}" cy="${ey - irisR*0.42}" r="2.0" fill="#ffffff" opacity="0.90"/>`;
        e += `<circle cx="${ex - irisR*0.22}" cy="${ey + irisR*0.32}" r="1.0" fill="#ffffff" opacity="0.50"/>`;
        // Upper lash line
        e += `<path d="M${ex-ew},${ey} Q${ex},${ey-eh*1.25} ${ex+ew},${ey}" fill="none" stroke="#181210" stroke-width="2.4" stroke-linecap="round" opacity="0.88"/>`;
        // Lower lash line
        e += `<path d="M${ex-ew*0.88},${ey+eh*0.32} Q${ex},${ey+eh*0.70} ${ex+ew*0.88},${ey+eh*0.32}" fill="none" stroke="#2a2018" stroke-width="1.1" stroke-linecap="round" opacity="0.55"/>`;
        // Tear duct hint
        const tdx = isRight ? ex + ew*0.92 : ex - ew*0.92;
        e += `<ellipse cx="${tdx}" cy="${ey+2}" rx="2.8" ry="2.1" fill="#d8a898" opacity="0.40"/>`;
        return e;
      };

      svg += buildEye(cx - eyeSpacing, eyeY, false);
      svg += buildEye(cx + eyeSpacing, eyeY, true);
      
      // Eyebrows — arched path with hair-texture inner stroke
      const browY = eyeY - 18;
      // Left brow
      svg += `<path d="M${cx-eyeSpacing-14},${browY+3} Q${cx-eyeSpacing-2},${browY-8} ${cx-eyeSpacing+14},${browY+2}" fill="none" stroke="${hairColor.color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
      svg += `<path d="M${cx-eyeSpacing-11},${browY+2} Q${cx-eyeSpacing-2},${browY-4} ${cx-eyeSpacing+11},${browY+1}" fill="none" stroke="${hairColor.color}" stroke-width="1.2" stroke-linecap="round" opacity="0.48"/>`;
      // Right brow (mirrored arch)
      svg += `<path d="M${cx+eyeSpacing-14},${browY+2} Q${cx+eyeSpacing+2},${browY-8} ${cx+eyeSpacing+14},${browY+3}" fill="none" stroke="${hairColor.color}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
      svg += `<path d="M${cx+eyeSpacing-11},${browY+1} Q${cx+eyeSpacing+2},${browY-4} ${cx+eyeSpacing+11},${browY+2}" fill="none" stroke="${hairColor.color}" stroke-width="1.2" stroke-linecap="round" opacity="0.48"/>`;
      
      // Nose — bridge, nostrils, tip highlight
      const noseY = cy + 15;
      const nsTone = this._darkenColor(skinColor, 22);
      const nsDeep = this._darkenColor(skinColor, 38);
      // Bridge sides — descending curves
      svg += `<path d="M${cx-4},${eyeY+10} C${cx-5},${noseY+2} ${cx-8},${noseY+8} ${cx-10},${noseY+13}" fill="none" stroke="${nsTone}" stroke-width="1.6" stroke-linecap="round" opacity="0.55"/>`;
      svg += `<path d="M${cx+4},${eyeY+10} C${cx+5},${noseY+2} ${cx+8},${noseY+8} ${cx+10},${noseY+13}" fill="none" stroke="${nsTone}" stroke-width="1.6" stroke-linecap="round" opacity="0.55"/>`;
      // Nose bottom curve / tip
      svg += `<path d="M${cx-10},${noseY+13} Q${cx},${noseY+20} ${cx+10},${noseY+13}" fill="none" stroke="${nsTone}" stroke-width="2.2" stroke-linecap="round"/>`;
      // Nostril shadows — small angled ellipses
      svg += `<ellipse cx="${cx-10}" cy="${noseY+15}" rx="4.5" ry="3" fill="${nsDeep}" opacity="0.48" transform="rotate(-14 ${cx-10} ${noseY+15})"/>`;
      svg += `<ellipse cx="${cx+10}" cy="${noseY+15}" rx="4.5" ry="3" fill="${nsDeep}" opacity="0.48" transform="rotate(14 ${cx+10} ${noseY+15})"/>`;
      // Bridge highlight
      svg += `<path d="M${cx},${eyeY+12} L${cx},${noseY+9}" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="2.2" stroke-linecap="round"/>`;
      // Nose tip highlight
      svg += `<ellipse cx="${cx}" cy="${noseY+12}" rx="5" ry="4" fill="url(#noseTipHL)"/>`;
      
      // Mouth — Bezier cupid's bow upper lip + fuller lower lip with highlight
      const mouthY = cy + 40;
      const mouthWidth = app.mouthType === 'wide' ? 30 : (app.mouthType === 'small' ? 15 : 22);
      const lipDark  = this._darkenColor(skinColor, 28);
      const lipMid   = this._darkenColor(skinColor, 18);
      const lipLight = this._darkenColor(skinColor, 8);

      // Philtrum — two faint guide strokes above lip center
      svg += `<path d="M${cx-4},${mouthY-9} L${cx-2},${mouthY-2}" fill="none" stroke="${this._darkenColor(skinColor, 20)}" stroke-width="1.0" stroke-linecap="round" opacity="0.38"/>`;
      svg += `<path d="M${cx+4},${mouthY-9} L${cx+2},${mouthY-2}" fill="none" stroke="${this._darkenColor(skinColor, 20)}" stroke-width="1.0" stroke-linecap="round" opacity="0.38"/>`;

      // Expression-based mouth with Bezier paths
      switch (app.expression) {
        case 'friendly': {
          // Cupid's bow upper lip
          svg += `<path d="M${cx-mouthWidth},${mouthY} Q${cx-mouthWidth*0.55},${mouthY-7} ${cx},${mouthY-4} Q${cx+mouthWidth*0.55},${mouthY-7} ${cx+mouthWidth},${mouthY}" fill="${lipDark}" stroke="${lipDark}" stroke-width="1.4" stroke-linecap="round"/>`;
          // Fuller lower lip (smile)
          svg += `<path d="M${cx-mouthWidth},${mouthY} Q${cx},${mouthY+17} ${cx+mouthWidth},${mouthY}" fill="${lipMid}" stroke="${lipDark}" stroke-width="1.4" stroke-linecap="round"/>`;
          // Lower lip center highlight
          svg += `<path d="M${cx-mouthWidth*0.45},${mouthY+8} Q${cx},${mouthY+13} ${cx+mouthWidth*0.45},${mouthY+8}" fill="none" stroke="${lipLight}" stroke-width="1" stroke-linecap="round" opacity="0.50"/>`;
          break;
        }
        case 'stern':
        case 'determined': {
          svg += `<path d="M${cx-mouthWidth},${mouthY} Q${cx-mouthWidth*0.55},${mouthY-6} ${cx},${mouthY-3} Q${cx+mouthWidth*0.55},${mouthY-6} ${cx+mouthWidth},${mouthY}" fill="${lipDark}" stroke="${lipDark}" stroke-width="1.4" stroke-linecap="round"/>`;
          svg += `<path d="M${cx-mouthWidth},${mouthY} Q${cx},${mouthY+6} ${cx+mouthWidth},${mouthY}" fill="${lipMid}" stroke="${lipDark}" stroke-width="1.4" stroke-linecap="round"/>`;
          break;
        }
        case 'smirking': {
          svg += `<path d="M${cx-mouthWidth},${mouthY+4} Q${cx-mouthWidth*0.4},${mouthY-5} ${cx},${mouthY-3} Q${cx+mouthWidth*0.4},${mouthY-6} ${cx+mouthWidth},${mouthY-6}" fill="${lipDark}" stroke="${lipDark}" stroke-width="1.4" stroke-linecap="round"/>`;
          svg += `<path d="M${cx-mouthWidth},${mouthY+4} Q${cx},${mouthY+7} ${cx+mouthWidth},${mouthY-6}" fill="${lipMid}" stroke="${lipDark}" stroke-width="1.4" stroke-linecap="round"/>`;
          break;
        }
        case 'weary': {
          svg += `<path d="M${cx-mouthWidth},${mouthY-4} Q${cx-mouthWidth*0.55},${mouthY-8} ${cx},${mouthY-5} Q${cx+mouthWidth*0.55},${mouthY-8} ${cx+mouthWidth},${mouthY-4}" fill="${lipDark}" stroke="${lipDark}" stroke-width="1.4" stroke-linecap="round"/>`;
          svg += `<path d="M${cx-mouthWidth},${mouthY-4} Q${cx},${mouthY+7} ${cx+mouthWidth},${mouthY-4}" fill="${lipMid}" stroke="${lipDark}" stroke-width="1.4" stroke-linecap="round"/>`;
          break;
        }
        default: {
          svg += `<path d="M${cx-mouthWidth},${mouthY} Q${cx-mouthWidth*0.55},${mouthY-6} ${cx},${mouthY-3} Q${cx+mouthWidth*0.55},${mouthY-6} ${cx+mouthWidth},${mouthY}" fill="${lipDark}" stroke="${lipDark}" stroke-width="1.4" stroke-linecap="round"/>`;
          svg += `<path d="M${cx-mouthWidth},${mouthY} Q${cx},${mouthY+6} ${cx+mouthWidth},${mouthY}" fill="${lipMid}" stroke="${lipDark}" stroke-width="1.4" stroke-linecap="round"/>`;
        }
      }
      
      // Facial hair — anchored to face geometry so every style sits correctly
      // regardless of faceShape.  chinY is the bottom of the face silhouette;
      // lipBotY is just below the lower lip; fhH is the space between them.
      if (app.facialHair && app.facialHair !== 'none') {
        const beardColor = this._darkenColor(hairColor.color, 10);
        const chinY    = cy + faceHeight;       // bottom of chin
        const lipBotY  = mouthY + 8;           // bottom of lower lip
        const fhH      = chinY - lipBotY;       // chin-to-lip distance
        switch (app.facialHair) {
          case 'stubble': {
            // Two translucent ellipses across the lower face for a grain effect
            svg += `<ellipse cx="${cx}" cy="${lipBotY + fhH * 0.45}" rx="${faceWidth * 0.78}" ry="${fhH * 0.62}" fill="${beardColor}" opacity="0.22"/>`;
            svg += `<ellipse cx="${cx}" cy="${lipBotY + fhH * 0.30}" rx="${faceWidth * 0.55}" ry="${fhH * 0.38}" fill="${beardColor}" opacity="0.14"/>`;
            break;
          }
          case 'mustache': {
            // Sits above the upper lip — centred between nose tip and mouth
            const muY = mouthY - 5;
            svg += `<ellipse cx="${cx}" cy="${muY}" rx="${faceWidth * 0.35}" ry="${Math.max(5, faceHeight * 0.045)}" fill="${beardColor}" opacity="0.95"/>`;
            // Lighter inner volume stripe
            svg += `<ellipse cx="${cx}" cy="${muY - 1}" rx="${faceWidth * 0.20}" ry="${Math.max(2.5, faceHeight * 0.022)}" fill="${beardColor}" opacity="0.42"/>`;
            break;
          }
          case 'goatee': {
            const gCy = lipBotY + fhH * 0.48;
            svg += `<ellipse cx="${cx}" cy="${gCy}" rx="${faceWidth * 0.22}" ry="${fhH * 0.55}" fill="${beardColor}" opacity="0.95"/>`;
            // Lighter inner volume
            svg += `<ellipse cx="${cx}" cy="${gCy - 2}" rx="${faceWidth * 0.12}" ry="${fhH * 0.32}" fill="${beardColor}" opacity="0.48"/>`;
            // Thin strip connecting goatee to the lower lip
            svg += `<ellipse cx="${cx}" cy="${lipBotY + 2}" rx="${faceWidth * 0.14}" ry="${Math.max(4, faceHeight * 0.04)}" fill="${beardColor}" opacity="0.78"/>`;
            break;
          }
          case 'fullbeard': {
            const bCy = lipBotY + fhH * 0.52;
            // Wide jaw coverage
            svg += `<ellipse cx="${cx}" cy="${bCy}" rx="${faceWidth * 0.85}" ry="${fhH * 0.62}" fill="${beardColor}" opacity="0.90"/>`;
            // Denser centre
            svg += `<ellipse cx="${cx}" cy="${bCy - 2}" rx="${faceWidth * 0.52}" ry="${fhH * 0.46}" fill="${beardColor}" opacity="0.52"/>`;
            // Mustache strip
            svg += `<ellipse cx="${cx}" cy="${mouthY - 5}" rx="${faceWidth * 0.38}" ry="${Math.max(5, faceHeight * 0.045)}" fill="${beardColor}" opacity="0.85"/>`;
            break;
          }
          case 'wastelandbeard': {
            // Larger and rougher than fullbeard — extends to sides of jaw
            const wCy = lipBotY + fhH * 0.55;
            svg += `<ellipse cx="${cx}" cy="${wCy}" rx="${faceWidth * 1.00}" ry="${fhH * 0.72}" fill="${beardColor}" opacity="0.92"/>`;
            svg += `<ellipse cx="${cx}" cy="${wCy - 4}" rx="${faceWidth * 0.68}" ry="${fhH * 0.52}" fill="${beardColor}" opacity="0.48"/>`;
            // Mustache
            svg += `<ellipse cx="${cx}" cy="${mouthY - 5}" rx="${faceWidth * 0.42}" ry="${Math.max(6, faceHeight * 0.05)}" fill="${beardColor}" opacity="0.90"/>`;
            // Sparse side wisps
            svg += `<ellipse cx="${cx - faceWidth * 0.55}" cy="${lipBotY + fhH * 0.28}" rx="${faceWidth * 0.28}" ry="${fhH * 0.36}" fill="${beardColor}" opacity="0.32"/>`;
            svg += `<ellipse cx="${cx + faceWidth * 0.55}" cy="${lipBotY + fhH * 0.28}" rx="${faceWidth * 0.28}" ry="${fhH * 0.36}" fill="${beardColor}" opacity="0.32"/>`;
            break;
          }
          case 'mutton': {
            // Sideburn strips along the outer jaw — positioned at faceWidth*0.78
            const mCy  = cy + fhH * 0.18;
            const mRx  = faceWidth * 0.22;
            const mRy  = fhH * 0.70;
            svg += `<ellipse cx="${cx - faceWidth * 0.78}" cy="${mCy}" rx="${mRx}" ry="${mRy}" fill="${beardColor}" opacity="0.92"/>`;
            svg += `<ellipse cx="${cx + faceWidth * 0.78}" cy="${mCy}" rx="${mRx}" ry="${mRy}" fill="${beardColor}" opacity="0.92"/>`;
            // Thin mustache to bridge the gap
            svg += `<ellipse cx="${cx}" cy="${mouthY - 5}" rx="${faceWidth * 0.28}" ry="${Math.max(4, faceHeight * 0.04)}" fill="${beardColor}" opacity="0.80"/>`;
            break;
          }
        }
      }
      
      // Scars — drawn with a raised highlight + dark groove for realism
      if (app.scar && app.scar !== 'none') {
        const scarDark  = this._darkenColor(skinColor, 35);
        const scarLight = this._lightenColor(skinColor, 20);
        const drawScar = (x1, y1, x2, y2, w = 2.5) => {
          // Dark groove
          svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${scarDark}" stroke-width="${w + 1}" stroke-linecap="round" opacity="0.85"/>`;
          // Raised highlight shifted slightly
          svg += `<line x1="${x1 + 1}" y1="${y1 - 1}" x2="${x2 + 1}" y2="${y2 - 1}" stroke="${scarLight}" stroke-width="${w * 0.55}" stroke-linecap="round" opacity="0.42"/>`;
        };
        switch (app.scar) {
          case 'cheek_left':
            drawScar(cx - 50, cy, cx - 30, cy + 20);
            break;
          case 'cheek_right':
            drawScar(cx + 50, cy, cx + 30, cy + 20);
            break;
          case 'brow':
            drawScar(cx - 35, browY - 5, cx - 15, browY + 5);
            break;
          case 'lip':
            drawScar(cx - 5, mouthY - 8, cx + 5, mouthY + 8, 2);
            break;
          case 'claw':
            drawScar(cx - 40, cy - 20, cx - 20, cy + 30, 2);
            drawScar(cx - 30, cy - 20, cx - 10, cy + 30, 2);
            drawScar(cx - 20, cy - 20, cx,       cy + 30, 2);
            break;
        }
      }
      
      // Accessories
      if (app.accessory && app.accessory !== 'none') {
        // Helper: distance from face edge to portrait edge (for strap endpoints)
        const strapEdgeL = cx - faceWidth * 1.15;
        const strapEdgeR = cx + faceWidth * 1.15;
        switch (app.accessory) {
          case 'eyepatch_left': {
            svg += `<ellipse cx="${cx - eyeSpacing}" cy="${eyeY}" rx="${eyeWidth + 5}" ry="${eyeHeight + 5}" fill="#1a1205"/>`;
            svg += `<ellipse cx="${cx - eyeSpacing}" cy="${eyeY}" rx="${eyeWidth + 3}" ry="${eyeHeight + 3}" fill="#0d0d0d" stroke="#3a3020" stroke-width="1.5"/>`;
            // Strap — left side goes to face edge, right side crosses nose bridge
            svg += `<path d="M${cx - eyeSpacing - eyeWidth - 4},${eyeY - eyeHeight} L${strapEdgeL},${eyeY - eyeHeight * 0.5}" stroke="#3a3020" stroke-width="3" stroke-linecap="round"/>`;
            svg += `<path d="M${cx - eyeSpacing + eyeWidth + 4},${eyeY - eyeHeight} L${cx + faceWidth * 0.10},${eyeY - eyeHeight}" stroke="#3a3020" stroke-width="3" stroke-linecap="round"/>`;
            break;
          }
          case 'eyepatch_right': {
            svg += `<ellipse cx="${cx + eyeSpacing}" cy="${eyeY}" rx="${eyeWidth + 5}" ry="${eyeHeight + 5}" fill="#1a1205"/>`;
            svg += `<ellipse cx="${cx + eyeSpacing}" cy="${eyeY}" rx="${eyeWidth + 3}" ry="${eyeHeight + 3}" fill="#0d0d0d" stroke="#3a3020" stroke-width="1.5"/>`;
            svg += `<path d="M${cx + eyeSpacing + eyeWidth + 4},${eyeY - eyeHeight} L${strapEdgeR},${eyeY - eyeHeight * 0.5}" stroke="#3a3020" stroke-width="3" stroke-linecap="round"/>`;
            svg += `<path d="M${cx + eyeSpacing - eyeWidth - 4},${eyeY - eyeHeight} L${cx - faceWidth * 0.10},${eyeY - eyeHeight}" stroke="#3a3020" stroke-width="3" stroke-linecap="round"/>`;
            break;
          }
          case 'glasses': {
            const gR = eyeWidth + 4;
            svg += `<circle cx="${cx - eyeSpacing}" cy="${eyeY}" r="${gR}" fill="rgba(180,200,220,0.12)" stroke="#555" stroke-width="2"/>`;
            svg += `<circle cx="${cx + eyeSpacing}" cy="${eyeY}" r="${gR}" fill="rgba(180,200,220,0.12)" stroke="#555" stroke-width="2"/>`;
            // Bridge
            svg += `<line x1="${cx - eyeSpacing + gR}" y1="${eyeY - 2}" x2="${cx + eyeSpacing - gR}" y2="${eyeY - 2}" stroke="#555" stroke-width="2"/>`;
            // Temple arms — extend proportionally to face edge
            const armLen = faceWidth * 0.30;
            svg += `<line x1="${cx - eyeSpacing - gR}" y1="${eyeY - 3}" x2="${cx - eyeSpacing - gR - armLen}" y2="${eyeY + armLen * 0.22}" stroke="#555" stroke-width="2" stroke-linecap="round"/>`;
            svg += `<line x1="${cx + eyeSpacing + gR}" y1="${eyeY - 3}" x2="${cx + eyeSpacing + gR + armLen}" y2="${eyeY + armLen * 0.22}" stroke="#555" stroke-width="2" stroke-linecap="round"/>`;
            // Lens glare
            svg += `<path d="M${cx - eyeSpacing - gR + 4},${eyeY - gR + 5} Q${cx - eyeSpacing},${eyeY - gR + 3} ${cx - eyeSpacing + gR - 4},${eyeY - gR + 8}" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5" stroke-linecap="round"/>`;
            svg += `<path d="M${cx + eyeSpacing - gR + 4},${eyeY - gR + 5} Q${cx + eyeSpacing},${eyeY - gR + 3} ${cx + eyeSpacing + gR - 4},${eyeY - gR + 8}" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5" stroke-linecap="round"/>`;
            break;
          }
          case 'goggles': {
            const ggW = eyeSpacing + eyeWidth + 6;  // half-width of goggle frame
            const ggH = Math.max(14, eyeHeight + 6); // frame half-height
            svg += `<rect x="${cx - ggW * 2}" y="${eyeY - ggH}" width="${ggW * 4}" height="${ggH * 2}" rx="6" fill="rgba(60,50,30,0.85)" stroke="#555" stroke-width="2.5"/>`;
            const lensR = Math.max(14, eyeWidth + 2);
            svg += `<circle cx="${cx - eyeSpacing}" cy="${eyeY}" r="${lensR}" fill="rgba(100,180,255,0.25)" stroke="#666" stroke-width="2"/>`;
            svg += `<circle cx="${cx + eyeSpacing}" cy="${eyeY}" r="${lensR}" fill="rgba(100,180,255,0.25)" stroke="#666" stroke-width="2"/>`;
            // Goggle glare
            svg += `<path d="M${cx - eyeSpacing - lensR * 0.55},${eyeY - lensR * 0.62} Q${cx - eyeSpacing},${eyeY - lensR * 0.88} ${cx - eyeSpacing + lensR * 0.55},${eyeY - lensR * 0.62}" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="2" stroke-linecap="round"/>`;
            svg += `<path d="M${cx + eyeSpacing - lensR * 0.55},${eyeY - lensR * 0.62} Q${cx + eyeSpacing},${eyeY - lensR * 0.88} ${cx + eyeSpacing + lensR * 0.55},${eyeY - lensR * 0.62}" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="2" stroke-linecap="round"/>`;
            // Side straps — scale to face width
            svg += `<line x1="${cx - ggW * 2}" y1="${eyeY}" x2="${strapEdgeL}" y2="${eyeY}" stroke="#444" stroke-width="4" stroke-linecap="round"/>`;
            svg += `<line x1="${cx + ggW * 2}" y1="${eyeY}" x2="${strapEdgeR}" y2="${eyeY}" stroke="#444" stroke-width="4" stroke-linecap="round"/>`;
            break;
          }
          case 'bandana': {
            // Bandana over the nose/mouth area
            const bnY = cy + 5;
            svg += `<path d="M${cx - faceWidth * 0.9},${bnY - 8} Q${cx},${bnY - 14} ${cx + faceWidth * 0.9},${bnY - 8} L${cx + faceWidth * 0.85},${bnY + 22} Q${cx},${bnY + 26} ${cx - faceWidth * 0.85},${bnY + 22} Z" fill="#7a1010"/>`;
            // Fabric fold lines
            svg += `<path d="M${cx - faceWidth * 0.6},${bnY} Q${cx},${bnY - 4} ${cx + faceWidth * 0.6},${bnY}" fill="none" stroke="#5a0a0a" stroke-width="1.2" stroke-linecap="round" opacity="0.55"/>`;
            svg += `<path d="M${cx - faceWidth * 0.7},${bnY + 12} Q${cx},${bnY + 8} ${cx + faceWidth * 0.7},${bnY + 12}" fill="none" stroke="#5a0a0a" stroke-width="1" stroke-linecap="round" opacity="0.45"/>`;
            break;
          }
          case 'cybernetic_eye': {
            // Replace right eye with glowing cybernetic implant
            svg += `<circle cx="${cx + eyeSpacing}" cy="${eyeY}" r="${eyeWidth + 2}" fill="#0a0505"/>`;
            svg += `<circle cx="${cx + eyeSpacing}" cy="${eyeY}" r="${eyeWidth - 1}" fill="#1a0505" stroke="#440000" stroke-width="1.5"/>`;
            svg += `<circle cx="${cx + eyeSpacing}" cy="${eyeY}" r="8" fill="#cc0000" filter="url(#glow)" opacity="0.9"/>`;
            svg += `<circle cx="${cx + eyeSpacing}" cy="${eyeY}" r="4" fill="#ff2020"/>`;
            // Scan lines
            svg += `<line x1="${cx + eyeSpacing - 10}" y1="${eyeY}" x2="${cx + eyeSpacing + 10}" y2="${eyeY}" stroke="rgba(255,0,0,0.3)" stroke-width="1"/>`;
            // Implant ring
            svg += `<circle cx="${cx + eyeSpacing}" cy="${eyeY}" r="${eyeWidth + 1}" fill="none" stroke="#660000" stroke-width="2"/>`;
            svg += `<circle cx="${cx + eyeSpacing - 1}" cy="${eyeY - 6}" r="2" fill="#333" opacity="0.7"/>`;
            break;
          }
        }
      }
      
      // Synth circuitry marking — visible circuit traces on temple/cheek
      if (app.race === 'synth' || app.marking === 'circuitry') {
        const cktColor = 'rgba(0,200,255,0.55)';
        // Right temple circuit traces
        svg += `<path d="M${cx + faceWidth * 0.62},${cy - faceHeight * 0.35} L${cx + faceWidth * 0.74},${cy - faceHeight * 0.22} L${cx + faceWidth * 0.68},${cy} L${cx + faceWidth * 0.76},${cy + faceHeight * 0.22}" fill="none" stroke="${cktColor}" stroke-width="1.2"/>`;
        // Branch nodes
        svg += `<circle cx="${cx + faceWidth * 0.74}" cy="${cy - faceHeight * 0.22}" r="2" fill="${cktColor}"/>`;
        svg += `<circle cx="${cx + faceWidth * 0.68}" cy="${cy}" r="2" fill="${cktColor}"/>`;
        // Horizontal branches
        svg += `<line x1="${cx + faceWidth * 0.68}" y1="${cy}" x2="${cx + faceWidth * 0.88}" y2="${cy - faceHeight * 0.04}" stroke="${cktColor}" stroke-width="0.9"/>`;
        svg += `<line x1="${cx + faceWidth * 0.74}" y1="${cy - faceHeight * 0.22}" x2="${cx + faceWidth * 0.90}" y2="${cy - faceHeight * 0.30}" stroke="${cktColor}" stroke-width="0.9"/>`;
      }
      
      // Vignette overlay
      svg += `<rect width="100%" height="100%" fill="url(#vignette)"/>`;
      
      // Pocket-Boy green tint overlay
      svg += `<rect width="100%" height="100%" fill="rgba(0,255,65,0.05)"/>`;
      
      svg += `</svg>`;
      
      return svg;
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
          <span class="cc-sp-value" id="ccSpPoints">${remaining}</span>
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
            <div class="cc-derived-item"><span class="cc-derived-label">MAX HP</span><span class="cc-derived-val" id="ccDerMaxHP">${derived.maxHP}</span></div>
            <div class="cc-derived-item"><span class="cc-derived-label">ACTION POINTS</span><span class="cc-derived-val" id="ccDerAP">${derived.actionPoints}</span></div>
            <div class="cc-derived-item"><span class="cc-derived-label">CARRY WEIGHT</span><span class="cc-derived-val" id="ccDerCW">${derived.carryWeight}</span></div>
            <div class="cc-derived-item"><span class="cc-derived-label">RAD RESISTANCE</span><span class="cc-derived-val" id="ccDerRR">${derived.radResistance}%</span></div>
            <div class="cc-derived-item"><span class="cc-derived-label">CRIT CHANCE</span><span class="cc-derived-val" id="ccDerCC">${derived.critChance}%</span></div>
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

  // Export to Game.modules
  Game.modules.CharacterCreator = CharacterCreator;

  // Also export globally for convenience
  window.CharacterCreator = CharacterCreator;

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CharacterCreator.init());
  } else {
    CharacterCreator.init();
  }

})();
