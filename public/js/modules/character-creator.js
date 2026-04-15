// character-creator.js
// ============================================================
// Dynamic Character Creator - Grok Avatar & Photo Upload System
// Players can upload photos, use Grok-generated avatars, and evolve
// their characters through commands and gameplay progression
// ============================================================

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  // Character state
  let currentCharacter = {
    // Basic info
    name: '',
    gender: 'male',
    race: 'human',
    background: '',

    // Appearance
    appearance: {
      skinTone: 'medium',
      faceShape: 'round',
      hairStyle: 'short',
      hairColor: 'brown',
      eyeShape: 'round',
      eyeColor: 'brown',
      noseType: 'straight',
      mouthType: 'full',
      scar: 'none',
      marking: 'none',
      accessory: 'none'
    },

    // Stats and abilities
    special: { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 },
    perks: [],
    traits: [],

    // Avatar and evolution
    avatar: null, // {type: 'grok'|'upload'|'custom', data: url|blob, evolution: {}}
    evolution: {
      level: 1,
      experience: 0,
      mutations: [],
      scars: [],
      gear: [],
      commands: [] // Player commands that shape character evolution
    }
  };

  // Available data
  let grokAvatars = [];
  let appearanceOptions = {};
  let backgrounds = [];
  let availablePerks = [];

  // Evolution commands that players can use
  const EVOLUTION_COMMANDS = {
    // Physical changes
    'grow_beard': { type: 'physical', effect: 'Adds beard/mustache', cost: 100 },
    'shave_head': { type: 'physical', effect: 'Bald head', cost: 50 },
    'add_scar': { type: 'physical', effect: 'Adds battle scar', cost: 200 },
    'change_hair': { type: 'physical', effect: 'Changes hair style/color', cost: 150 },
    'add_tattoo': { type: 'physical', effect: 'Adds wasteland tattoo', cost: 300 },

    // Gear changes
    'add_helmet': { type: 'gear', effect: 'Adds helmet/headgear', cost: 500 },
    'add_goggles': { type: 'gear', effect: 'Adds protective goggles', cost: 250 },
    'add_mask': { type: 'gear', effect: 'Adds face mask/scarf', cost: 200 },
    'add_armor': { type: 'gear', effect: 'Adds armor pieces', cost: 1000 },

    // Mutation effects
    'radiation_burns': { type: 'mutation', effect: 'Radiation burn marks', cost: 400 },
    'cybernetic_eye': { type: 'mutation', effect: 'Replaces eye with cybernetic', cost: 800 },
    'ghoul_transformation': { type: 'mutation', effect: 'Partial ghoul transformation', cost: 1500 },

    // Personality expressions
    'battle_hardened': { type: 'expression', effect: 'More intense/warrior expression', cost: 300 },
    'weary_survivor': { type: 'expression', effect: 'Tired but determined look', cost: 200 },
    'cunning_trader': { type: 'expression', effect: 'Shrewd merchant expression', cost: 250 }
  };

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
  // UTILITY FUNCTIONS
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

  function formatEffectValue(val) {
    if (typeof val !== 'number') return String(val);
    if (Math.abs(val) > 0 && Math.abs(val) < 1) {
      return (val * 100).toFixed(0) + '%';
    }
    return String(val);
  }

  // Load Grok avatars from assets
  async function loadGrokAvatars() {
    try {
      const response = await fetch('/assets/avatars-grok/manifest.json');
      const manifest = await response.json();
      grokAvatars = manifest.avatars || [];
      console.log('[CharacterCreator] Loaded', grokAvatars.length, 'Grok avatars');
    } catch (error) {
      console.warn('[CharacterCreator] Could not load Grok avatars:', error);
      grokAvatars = [];
    }
  }

  // Load appearance customization options
  async function loadAppearanceOptions() {
    try {
      const response = await fetch('/data/character_creator/appearance_options.json');
      appearanceOptions = await response.json();
      console.log('[CharacterCreator] Loaded appearance options');
    } catch (error) {
      console.warn('[CharacterCreator] Could not load appearance options:', error);
      appearanceOptions = {};
    }
  }

  // Load background options
  async function loadBackgrounds() {
    try {
      const response = await fetch('/data/character_creator/backgrounds.json');
      backgrounds = await response.json();
      console.log('[CharacterCreator] Loaded', backgrounds.length, 'backgrounds');
    } catch (error) {
      console.warn('[CharacterCreator] Could not load backgrounds:', error);
      backgrounds = [];
    }
  }

  // Load available perks
  async function loadPerks() {
    try {
      const response = await fetch('/data/perks.json');
      const data = await response.json();
      availablePerks = data.perks || [];
      console.log('[CharacterCreator] Loaded', availablePerks.length, 'perks');
    } catch (error) {
      console.warn('[CharacterCreator] Could not load perks:', error);
      availablePerks = [];
    }
  }

  // Generate new Grok avatar via API
  async function generateGrokAvatar(prompt) {
    try {
      const response = await fetch('/api/grok/generate-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style: 'fallout-wasteland-survivor' })
      });
      const result = await response.json();
      return result.avatarUrl;
    } catch (error) {
      console.error('[CharacterCreator] Failed to generate Grok avatar:', error);
      return null;
    }
  }

  // Apply evolution command to character
  function applyEvolutionCommand(command) {
    if (!EVOLUTION_COMMANDS[command]) return false;

    const cmd = EVOLUTION_COMMANDS[command];
    if (currentCharacter.evolution.experience < cmd.cost) {
      return false; // Not enough XP
    }

    // Apply the evolution
    currentCharacter.evolution.experience -= cmd.cost;
    currentCharacter.evolution.commands.push({
      command,
      type: cmd.type,
      effect: cmd.effect,
      applied: Date.now()
    });

    // Update evolution state based on command type
    switch (cmd.type) {
      case 'physical':
        currentCharacter.evolution.mutations.push(cmd.effect);
        break;
      case 'gear':
        currentCharacter.evolution.gear.push(cmd.effect);
        break;
      case 'mutation':
        currentCharacter.evolution.mutations.push(cmd.effect);
        break;
      case 'expression':
        // Expression changes are stored in commands
        break;
    }

    return true;
  }

  // Calculate total SPECIAL points used
  function calculateSpecialTotal() {
    return Object.values(currentCharacter.special).reduce((sum, val) => sum + val, 0);
  }

  // Validate SPECIAL allocation
  function validateSpecialAllocation() {
    const total = calculateSpecialTotal();
    const used = total - 7; // 7 is the minimum (1 in each stat)
    return used <= SPECIAL_TOTAL_POINTS && used >= 0;
  }

  // ============================================================
  // CHARACTER CREATOR CLASS
  // ============================================================

  const CharacterCreator = {
    isOpen: false,
    overlayEl: null,
    onSaveCallback: null,

    // Initialize the character creator
    async init() {
      await Promise.all([
        loadGrokAvatars(),
        loadAppearanceOptions(),
        loadBackgrounds(),
        loadPerks()
      ]);

      // Assign loaded data to the object
      this.appearanceOptions = appearanceOptions;
      this.backgrounds = backgrounds;
      this.perks = availablePerks;

      this._createOverlay();
      console.log('[CharacterCreator] Initialized with full character creation system');
      return true;
    },

    // Open the character creator
    open(existingCharacter, onSave) {
      if (this.isOpen) return;

      this.onSaveCallback = onSave || (() => {});

      // Load existing character or use defaults
      if (existingCharacter) {
        currentCharacter = { ...existingCharacter };
      } else {
        currentCharacter = {
          avatar: null,
          special: { S: 5, P: 5, E: 5, C: 5, I: 5, A: 5, L: 5 },
          name: '',
          background: '',
          traits: [],
          evolution: {
            level: 1,
            experience: 0,
            mutations: [],
            scars: [],
            gear: [],
            commands: []
          }
        };
      }

      this._render();
      this.overlayEl.style.display = 'flex';
      this.isOpen = true;
    },

    // Close the character creator
    close() {
      if (!this.isOpen) return;
      this.overlayEl.style.display = 'none';
      this.isOpen = false;
    },

    // Save the current character
    save() {
      if (this.onSaveCallback) {
        this.onSaveCallback(currentCharacter);
      }
      this.close();
    },

    // Create the overlay UI
    _createOverlay() {
      this.overlayEl = document.createElement('div');
      this.overlayEl.className = 'character-creator-overlay';
      this.overlayEl.innerHTML = `
        <div class="character-creator-modal">
          <div class="cc-header">
            <h2>Character Creator</h2>
            <button class="cc-close-btn" onclick="Game.modules.CharacterCreator.close()">&times;</button>
          </div>

          <div class="cc-content">
            <!-- Left Column: Avatar & Basic Info -->
            <div class="cc-left-column">
              <div class="cc-avatar-section">
                <div class="cc-avatar-preview">
                  <img id="cc-avatar-img" src="/assets/avatars-grok/avatar_001.png" alt="Character Avatar">
                  <div class="cc-avatar-overlay" id="cc-avatar-overlay"></div>
                </div>
                <div class="cc-avatar-controls">
                  <button onclick="Game.modules.CharacterCreator._selectGrokAvatar()">Choose Grok Avatar</button>
                  <button onclick="Game.modules.CharacterCreator._uploadPhoto()">Upload Photo</button>
                  <button onclick="Game.modules.CharacterCreator._generateNewAvatar()">Generate New Avatar</button>
                </div>
              </div>

              <div class="cc-basic-info">
                <h3>Basic Information</h3>
                <div class="cc-name-input">
                  <label>Name:</label>
                  <input type="text" id="cc-name-input" placeholder="Enter character name" maxlength="50">
                </div>
                <div class="cc-basic-selects">
                  <div class="cc-select-group">
                    <label>Gender:</label>
                    <select id="cc-gender-select">${this._generateOptions(this.appearanceOptions?.genders || [], 'male')}</select>
                  </div>
                  <div class="cc-select-group">
                    <label>Race:</label>
                    <select id="cc-race-select">${this._generateOptions(this.appearanceOptions?.races || [], 'human')}</select>
                  </div>
                  <div class="cc-select-group">
                    <label>Background:</label>
                    <select id="cc-background-select">${this._generateBackgroundOptions()}</select>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Column: Customization -->
            <div class="cc-right-column">
              <div class="cc-tabs">
                <button class="cc-tab active" onclick="Game.modules.CharacterCreator._switchTab('appearance')">Appearance</button>
                <button class="cc-tab" onclick="Game.modules.CharacterCreator._switchTab('perks')">Perks</button>
                <button class="cc-tab" onclick="Game.modules.CharacterCreator._switchTab('special')">S.P.E.C.I.A.L.</button>
                <button class="cc-tab" onclick="Game.modules.CharacterCreator._switchTab('evolution')">Evolution</button>
              </div>

              <div class="cc-tab-content">
                <!-- Appearance Tab -->
                <div id="cc-appearance-tab" class="cc-tab-panel active">
                  <h3>Appearance Customization</h3>
                  <div id="cc-appearance-container" class="cc-appearance-grid">
                    <!-- Appearance options will be populated dynamically -->
                  </div>
                </div>

                <!-- Perks Tab -->
                <div id="cc-perks-tab" class="cc-tab-panel">
                  <h3>Available Perks</h3>
                  <div class="cc-perks-info">
                    <p>Select perks that match your character's SPECIAL stats and playstyle.</p>
                    <div class="cc-perks-requirements">Perks require minimum SPECIAL stat levels to unlock.</div>
                  </div>
                  <div class="cc-perks-list" id="cc-perks-list"></div>
                </div>

                <!-- SPECIAL Tab -->
                <div id="cc-special-tab" class="cc-tab-panel">
                  <div class="cc-special-stats">
                    <h3>S.P.E.C.I.A.L. Stats</h3>
                    <div class="cc-special-grid" id="cc-special-grid"></div>
                    <div class="cc-points-remaining">
                      Points remaining: <span id="cc-points-remaining">21</span>
                    </div>
                  </div>
                </div>

                <!-- Evolution Tab -->
                <div id="cc-evolution-tab" class="cc-tab-panel">
                  <div class="cc-evolution-section">
                    <h3>Character Evolution</h3>
                    <div class="cc-evolution-info">
                      <div>Level: <span id="cc-level">1</span></div>
                      <div>Experience: <span id="cc-experience">0</span></div>
                    </div>
                    <div class="cc-evolution-commands" id="cc-evolution-commands"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="cc-footer">
            <button class="cc-save-btn" onclick="Game.modules.CharacterCreator.save()">Save Character</button>
            <button class="cc-cancel-btn" onclick="Game.modules.CharacterCreator.close()">Cancel</button>
          </div>
        </div>
      `;

      // Helper functions for UI generation
      this._generateOptions = function(options, defaultValue) {
        return options.map(option =>
          `<option value="${option.id}" ${option.id === defaultValue ? 'selected' : ''}>${option.name}</option>`
        ).join('');
      };

      this._generateBackgroundOptions = function() {
        return (this.backgrounds || []).map(bg =>
          `<option value="${bg.id}" ${bg.id === 'vault_dweller' ? 'selected' : ''}>${bg.name}</option>`
        ).join('');
      };

      // Tab switching functionality
      this._switchTab = function(tabName) {
        // Update tab buttons
        const tabs = this.overlayEl.querySelectorAll('.cc-tab');
        tabs.forEach(tab => tab.classList.remove('active'));

        const activeTab = this.overlayEl.querySelector(`[onclick*="${tabName}"]`);
        if (activeTab) activeTab.classList.add('active');

        // Update tab content
        const panels = this.overlayEl.querySelectorAll('.cc-tab-panel');
        panels.forEach(panel => panel.classList.remove('active'));

        const activePanel = this.overlayEl.querySelector(`#cc-${tabName}-tab`);
        if (activePanel) activePanel.classList.add('active');
      };

      // Add styles
      const style = document.createElement('style');
      style.textContent = [
        '.character-creator-overlay {',
        '  position: fixed;',
        '  top: 0;',
        '  left: 0;',
        '  width: 100%;',
        '  height: 100%;',
        '  background: rgba(0, 0, 0, 0.8);',
        '  display: none;',
        '  justify-content: center;',
        '  align-items: center;',
        '  z-index: 10000;',
        '  font-family: "Courier New", monospace;',
        '}',
        '',
        '.character-creator-modal {',
        '  background: #000;',
        '  border: 2px solid #00ff41;',
        '  border-radius: 8px;',
        '  width: 90%;',
        '  max-width: 1200px;',
        '  max-height: 90vh;',
        '  overflow-y: auto;',
        '  color: #00ff41;',
        '}',
        '',
        '.cc-header {',
        '  display: flex;',
        '  justify-content: space-between;',
        '  align-items: center;',
        '  padding: 20px;',
        '  border-bottom: 1px solid #00ff41;',
        '}',
        '',
        '.cc-header h2 {',
        '  margin: 0;',
        '  color: #00ff41;',
        '}',
        '',
        '.cc-close-btn {',
        '  background: none;',
        '  border: none;',
        '  color: #00ff41;',
        '  font-size: 24px;',
        '  cursor: pointer;',
        '  padding: 0;',
        '  width: 30px;',
        '  height: 30px;',
        '  display: flex;',
        '  align-items: center;',
        '  justify-content: center;',
        '}',
        '',
        '.cc-content {',
        '  display: flex;',
        '  padding: 20px;',
        '  gap: 20px;',
        '}',
        '',
        '.cc-avatar-section {',
        '  flex: 1;',
        '  text-align: center;',
        '}',
        '',
        '.cc-avatar-preview {',
        '  position: relative;',
        '  display: inline-block;',
        '  margin-bottom: 20px;',
        '}',
        '',
        '#cc-avatar-img {',
        '  width: 256px;',
        '  height: 256px;',
        '  object-fit: cover;',
        '  border: 2px solid #00ff41;',
        '  border-radius: 8px;',
        '}',
        '',
        '.cc-avatar-overlay {',
        '  position: absolute;',
        '  top: 0;',
        '  left: 0;',
        '  width: 100%;',
        '  height: 100%;',
        '  background: rgba(0, 255, 65, 0.1);',
        '  display: none;',
        '  align-items: center;',
        '  justify-content: center;',
        '  color: #00ff41;',
        '  font-weight: bold;',
        '}',
        '',
        '.cc-avatar-controls {',
        '  display: flex;',
        '  flex-direction: column;',
        '  gap: 10px;',
        '}',
        '',
        '.cc-avatar-controls button {',
        '  padding: 10px;',
        '  background: rgba(0, 255, 65, 0.1);',
        '  border: 1px solid #00ff41;',
        '  color: #00ff41;',
        '  cursor: pointer;',
        '  border-radius: 4px;',
        '}',
        '',
        '.cc-avatar-controls button:hover {',
        '  background: rgba(0, 255, 65, 0.2);',
        '}',
        '',
        '.cc-stats-section {',
        '  flex: 1;',
        '  display: flex;',
        '  flex-direction: column;',
        '  gap: 20px;',
        '}',
        '',
        '.cc-name-input {',
        '  display: flex;',
        '  align-items: center;',
        '  gap: 10px;',
        '}',
        '',
        '.cc-name-input label {',
        '  min-width: 50px;',
        '}',
        '',
        '.cc-name-input input {',
        '  flex: 1;',
        '  padding: 8px;',
        '  background: #000;',
        '  border: 1px solid #00ff41;',
        '  color: #00ff41;',
        '  border-radius: 4px;',
        '}',
        '',
        '.cc-special-stats h3,',
        '.cc-evolution-section h3 {',
        '  margin: 0 0 10px 0;',
        '  color: #00ff41;',
        '}',
        '',
        '.cc-special-grid {',
        '  display: grid;',
        '  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));',
        '  gap: 10px;',
        '}',
        '',
        '.cc-special-stat {',
        '  display: flex;',
        '  align-items: center;',
        '  justify-content: space-between;',
        '  padding: 8px;',
        '  background: rgba(0, 255, 65, 0.05);',
        '  border: 1px solid #00ff41;',
        '  border-radius: 4px;',
        '}',
        '',
        '.cc-special-stat label {',
        '  font-weight: bold;',
        '}',
        '',
        '.cc-special-controls {',
        '  display: flex;',
        '  align-items: center;',
        '  gap: 5px;',
        '}',
        '',
        '.cc-special-value {',
        '  min-width: 20px;',
        '  text-align: center;',
        '}',
        '',
        '.cc-special-btn {',
        '  width: 25px;',
        '  height: 25px;',
        '  background: rgba(0, 255, 65, 0.1);',
        '  border: 1px solid #00ff41;',
        '  color: #00ff41;',
        '  cursor: pointer;',
        '  border-radius: 2px;',
        '  display: flex;',
        '  align-items: center;',
        '  justify-content: center;',
        '  font-weight: bold;',
        '}',
        '',
        '.cc-special-btn:hover {',
        '  background: rgba(0, 255, 65, 0.2);',
        '}',
        '',
        '.cc-special-btn:disabled {',
        '  opacity: 0.5;',
        '  cursor: not-allowed;',
        '}',
        '',
        '.cc-points-remaining {',
        '  text-align: center;',
        '  margin-top: 10px;',
        '  font-weight: bold;',
        '}',
        '',
        '.cc-evolution-info {',
        '  display: flex;',
        '  justify-content: space-between;',
        '  margin-bottom: 10px;',
        '}',
        '',
        '.cc-evolution-commands {',
        '  max-height: 200px;',
        '  overflow-y: auto;',
        '}',
        '',
        '.cc-evolution-command {',
        '  display: flex;',
        '  justify-content: space-between;',
        '  align-items: center;',
        '  padding: 8px;',
        '  margin: 5px 0;',
        '  background: rgba(0, 255, 65, 0.05);',
        '  border: 1px solid #00ff41;',
        '  border-radius: 4px;',
        '}',
        '',
        '.cc-evolution-command.available {',
        '  cursor: pointer;',
        '}',
        '',
        '.cc-evolution-command.available:hover {',
        '  background: rgba(0, 255, 65, 0.1);',
        '}',
        '',
        '.cc-evolution-command.applied {',
        '  background: rgba(0, 100, 65, 0.1);',
        '  border-color: #00aa41;',
        '}',
        '',
        '.cc-evolution-command.locked {',
        '  opacity: 0.5;',
        '}',
        '',
        '.cc-command-info {',
        '  flex: 1;',
        '}',
        '',
        '.cc-command-cost {',
        '  color: #ffff41;',
        '  font-size: 0.9em;',
        '}',
        '',
        '.cc-footer {',
        '  display: flex;',
        '  justify-content: flex-end;',
        '  gap: 10px;',
        '  padding: 20px;',
        '  border-top: 1px solid #00ff41;',
        '}',
        '',
        '.cc-save-btn,',
        '.cc-cancel-btn {',
        '  padding: 10px 20px;',
        '  border: 1px solid #00ff41;',
        '  border-radius: 4px;',
        '  cursor: pointer;',
        '  font-weight: bold;',
        '}',
        '',
        '.cc-save-btn {',
        '  background: rgba(0, 255, 65, 0.1);',
        '  color: #00ff41;',
        '}',
        '',
        '.cc-save-btn:hover {',
        '  background: rgba(0, 255, 65, 0.2);',
        '}',
        '',
        '.cc-cancel-btn {',
        '  background: rgba(255, 65, 65, 0.1);',
        '  color: #ff4141;',
        '  border-color: #ff4141;',
        '}',
        '',
        '.cc-cancel-btn:hover {',
        '  background: rgba(255, 65, 65, 0.2);',
        '}',
        '',
        '/* Responsive */',
        '@media (max-width: 768px) {',
        '  .cc-content {',
        '    flex-direction: column;',
        '  }',
        '',
        '  .cc-avatar-preview img {',
        '    width: 200px;',
        '    height: 200px;',
        '  }',
        '}',
        '',
        '.avatar-selection-modal {',
        '  position: fixed;',
        '  top: 0;',
        '  left: 0;',
        '  width: 100%;',
        '  height: 100%;',
        '  background: rgba(0, 0, 0, 0.9);',
        '  display: flex;',
        '  justify-content: center;',
        '  align-items: center;',
        '  z-index: 10001;',
        '}',
        '',
        '.avatar-selection-content {',
        '  background: #000;',
        '  border: 2px solid #00ff41;',
        '  border-radius: 8px;',
        '  padding: 20px;',
        '  max-width: 800px;',
        '  max-height: 80vh;',
        '  overflow-y: auto;',
        '  color: #00ff41;',
        '}',
        '',
        '.avatar-grid {',
        '  display: grid;',
        '  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));',
        '  gap: 15px;',
        '  margin: 20px 0;',
        '}',
        '',
        '.avatar-option {',
        '  cursor: pointer;',
        '  text-align: center;',
        '  padding: 10px;',
        '  border: 1px solid #00ff41;',
        '  border-radius: 4px;',
        '  transition: background 0.2s;',
        '}',
        '',
        '.avatar-option:hover {',
        '  background: rgba(0, 255, 65, 0.1);',
        '}',
        '',
        '.avatar-option img {',
        '  width: 100px;',
        '  height: 100px;',
        '  object-fit: cover;',
        '  border-radius: 4px;',
        '  margin-bottom: 5px;',
        '}',
        '',
        '.avatar-desc {',
        '  font-size: 0.8em;',
        '  line-height: 1.2;',
        '}',
        '',
        '/* New Two-Column Layout */',
        '.cc-content {',
        '  display: flex;',
        '  padding: 20px;',
        '  gap: 20px;',
        '  height: calc(100% - 140px);',
        '}',
        '',
        '.cc-left-column {',
        '  flex: 1;',
        '  display: flex;',
        '  flex-direction: column;',
        '  gap: 20px;',
        '}',
        '',
        '.cc-right-column {',
        '  flex: 1;',
        '  display: flex;',
        '  flex-direction: column;',
        '  gap: 15px;',
        '}',
        '',
        '.cc-basic-info {',
        '  background: rgba(0, 255, 65, 0.05);',
        '  border: 1px solid #00ff41;',
        '  border-radius: 4px;',
        '  padding: 15px;',
        '}',
        '',
        '.cc-basic-info h3 {',
        '  margin: 0 0 15px 0;',
        '  color: #00ff41;',
        '}',
        '',
        '.cc-basic-selects {',
        '  display: flex;',
        '  flex-direction: column;',
        '  gap: 10px;',
        '}',
        '',
        '.cc-select-group {',
        '  display: flex;',
        '  align-items: center;',
        '  gap: 10px;',
        '}',
        '',
        '.cc-select-group label {',
        '  min-width: 80px;',
        '  font-weight: bold;',
        '}',
        '',
        '.cc-select-group select {',
        '  flex: 1;',
        '  padding: 6px;',
        '  background: #000;',
        '  border: 1px solid #00ff41;',
        '  color: #00ff41;',
        '  border-radius: 4px;',
        '}',
        '',
        '/* Tab System */',
        '.cc-tabs {',
        '  display: flex;',
        '  gap: 2px;',
        '  border-bottom: 1px solid #00ff41;',
        '}',
        '',
        '.cc-tab {',
        '  padding: 10px 15px;',
        '  background: rgba(0, 255, 65, 0.1);',
        '  border: 1px solid #00ff41;',
        '  border-bottom: none;',
        '  color: #00ff41;',
        '  cursor: pointer;',
        '  border-radius: 4px 4px 0 0;',
        '  font-weight: bold;',
        '}',
        '',
        '.cc-tab.active {',
        '  background: rgba(0, 255, 65, 0.2);',
        '  border-bottom: 1px solid #000;',
        '}',
        '',
        '.cc-tab:hover {',
        '  background: rgba(0, 255, 65, 0.15);',
        '}',
        '',
        '.cc-tab-content {',
        '  flex: 1;',
        '  overflow-y: auto;',
        '  padding: 15px 0;',
        '}',
        '',
        '.cc-tab-panel {',
        '  display: none;',
        '}',
        '',
        '.cc-tab-panel.active {',
        '  display: block;',
        '}',
        '',
        '/* Appearance Customization */',
        '.cc-appearance-grid {',
        '  display: grid;',
        '  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));',
        '  gap: 10px;',
        '}',
        '',
        '.cc-appearance-group {',
        '  display: flex;',
        '  align-items: center;',
        '  gap: 10px;',
        '}',
        '',
        '.cc-appearance-group label {',
        '  min-width: 100px;',
        '  font-weight: bold;',
        '}',
        '',
        '.cc-appearance-group select {',
        '  flex: 1;',
        '  padding: 6px;',
        '  background: #000;',
        '  border: 1px solid #00ff41;',
        '  color: #00ff41;',
        '  border-radius: 4px;',
        '}',
        '',
        '/* Perks System */',
        '.cc-perks-info {',
        '  margin-bottom: 15px;',
        '}',
        '',
        '.cc-perks-requirements {',
        '  color: #ffff41;',
        '  font-size: 0.9em;',
        '  margin-top: 5px;',
        '}',
        '',
        '.cc-perks-list {',
        '  max-height: 400px;',
        '  overflow-y: auto;',
        '}',
        '',
        '.cc-perk-item {',
        '  display: flex;',
        '  justify-content: space-between;',
        '  align-items: flex-start;',
        '  padding: 12px;',
        '  margin: 8px 0;',
        '  background: rgba(0, 255, 65, 0.05);',
        '  border: 1px solid #00ff41;',
        '  border-radius: 4px;',
        '}',
        '',
        '.cc-perk-item.available {',
        '  cursor: pointer;',
        '}',
        '',
        '.cc-perk-item.available:hover {',
        '  background: rgba(0, 255, 65, 0.1);',
        '}',
        '',
        '.cc-perk-item.selected {',
        '  background: rgba(0, 100, 65, 0.1);',
        '  border-color: #00aa41;',
        '}',
        '',
        '.cc-perk-item.locked {',
        '  opacity: 0.5;',
        '  cursor: not-allowed;',
        '}',
        '',
        '.cc-perk-info {',
        '  flex: 1;',
        '}',
        '',
        '.cc-perk-name {',
        '  font-weight: bold;',
        '  margin-bottom: 4px;',
        '}',
        '',
        '.cc-perk-desc {',
        '  font-size: 0.9em;',
        '  line-height: 1.3;',
        '  margin-bottom: 6px;',
        '}',
        '',
        '.cc-perk-flavor {',
        '  font-size: 0.8em;',
        '  font-style: italic;',
        '  color: #aaa;',
        '}',
        '',
        '.cc-perk-requirements {',
        '  display: flex;',
        '  align-items: center;',
        '  gap: 10px;',
        '  margin-top: 8px;',
        '}',
        '',
        '.cc-perk-requirement {',
        '  font-size: 0.8em;',
        '  color: #ffff41;',
        '}',
        '',
        '.cc-perk-select-btn {',
        '  padding: 4px 8px;',
        '  background: rgba(0, 255, 65, 0.1);',
        '  border: 1px solid #00ff41;',
        '  color: #00ff41;',
        '  border-radius: 3px;',
        '  cursor: pointer;',
        '  font-size: 0.8em;',
        '}',
        '',
        '.cc-perk-select-btn:hover {',
        '  background: rgba(0, 255, 65, 0.2);',
        '}',
        '',
        '/* Responsive */',
        '@media (max-width: 768px) {',
        '  .cc-content {',
        '    flex-direction: column;',
        '    height: auto;',
        '  }',
        '',
        '  .cc-tabs {',
        '    flex-wrap: wrap;',
        '  }',
        '',
        '  .cc-tab {',
        '    flex: 1;',
        '    text-align: center;',
        '  }',
        '',
        '  .cc-appearance-grid {',
        '    grid-template-columns: 1fr;',
        '  }',
        '}'
      ].join('\n');
      document.head.appendChild(style);
      document.body.appendChild(this.overlayEl);
    },

    // Render the character creator UI
    _render() {
      // Update avatar
      const avatarImg = this.overlayEl.querySelector('#cc-avatar-img');
      if (currentCharacter.avatar) {
        if (currentCharacter.avatar.type === 'upload') {
          avatarImg.src = currentCharacter.avatar.data;
        } else if (currentCharacter.avatar.type === 'grok') {
          avatarImg.src = currentCharacter.avatar.data;
        }
      }

      // Update basic info
      const nameInput = this.overlayEl.querySelector('#cc-name-input');
      nameInput.value = currentCharacter.name || '';

      const genderSelect = this.overlayEl.querySelector('#cc-gender-select');
      genderSelect.value = currentCharacter.gender || 'male';

      const raceSelect = this.overlayEl.querySelector('#cc-race-select');
      raceSelect.value = currentCharacter.race || 'human';

      const backgroundSelect = this.overlayEl.querySelector('#cc-background-select');
      backgroundSelect.value = currentCharacter.background || 'vault_dweller';

      // Update appearance
      this._renderAppearance();

      // Update perks
      this._renderPerks();

      // Update SPECIAL stats
      this._renderSpecialStats();

      // Update evolution
      this._renderEvolution();

      // Add event listeners
      this._setupEventListeners();
    },

    // Render appearance options
    _renderAppearance() {
      if (!this.appearanceOptions) return;

      const container = this.overlayEl.querySelector('#cc-appearance-container');
      if (!container) return;

      container.innerHTML = Object.entries(this.appearanceOptions).map(([category, options]) => `
        <div class="cc-appearance-group">
          <label>${category.charAt(0).toUpperCase() + category.slice(1)}:</label>
          <select id="cc-${category}-select" onchange="Game.modules.CharacterCreator._updateAppearance('${category}', this.value)">
            ${options.map(option => `
              <option value="${option.id}" ${currentCharacter.appearance?.[category] === option.id ? 'selected' : ''}>
                ${option.name}
              </option>
            `).join('')}
          </select>
        </div>
      `).join('');
    },

    // Render perks list
    _renderPerks() {
      if (!this.perks) return;

      const container = this.overlayEl.querySelector('#cc-perks-list');
      if (!container) return;

      container.innerHTML = this.perks.map(perk => {
        const isSelected = currentCharacter.perks?.includes(perk.id);
        const meetsRequirements = this._checkPerkRequirements(perk);
        const isAvailable = meetsRequirements && !isSelected;
        const isLocked = !meetsRequirements && !isSelected;

        return `
          <div class="cc-perk-item ${isSelected ? 'selected' : isAvailable ? 'available' : 'locked'}"
               onclick="Game.modules.CharacterCreator._togglePerk('${perk.id}')">
            <div class="cc-perk-info">
              <div class="cc-perk-name">${perk.name}</div>
              <div class="cc-perk-desc">${perk.description}</div>
              ${perk.flavor_text ? `<div class="cc-perk-flavor">${perk.flavor_text}</div>` : ''}
              <div class="cc-perk-requirements">
                ${perk.required_special ? Object.entries(perk.required_special).map(([stat, value]) => `
                  <span class="cc-perk-requirement">${stat.toUpperCase()} ${value}+</span>
                `).join('') : ''}
              </div>
            </div>
            <button class="cc-perk-select-btn" ${isLocked ? 'disabled' : ''}>
              ${isSelected ? 'Selected' : isAvailable ? 'Select' : 'Locked'}
            </button>
          </div>
        `;
      }).join('');
    },

    // Setup event listeners
    _setupEventListeners() {
      // Name input
      const nameInput = this.overlayEl.querySelector('#cc-name-input');
      nameInput?.addEventListener('input', (e) => {
        currentCharacter.name = e.target.value;
      });

      // Basic info selects
      const genderSelect = this.overlayEl.querySelector('#cc-gender-select');
      genderSelect?.addEventListener('change', (e) => {
        currentCharacter.gender = e.target.value;
      });

      const raceSelect = this.overlayEl.querySelector('#cc-race-select');
      raceSelect?.addEventListener('change', (e) => {
        currentCharacter.race = e.target.value;
      });

      const backgroundSelect = this.overlayEl.querySelector('#cc-background-select');
      backgroundSelect?.addEventListener('change', (e) => {
        currentCharacter.background = e.target.value;
        this._applyBackgroundModifiers();
      });
    },

    // Update appearance option
    _updateAppearance(category, value) {
      if (!currentCharacter.appearance) currentCharacter.appearance = {};
      currentCharacter.appearance[category] = value;
    },

    // Toggle perk selection
    _togglePerk(perkId) {
      if (!currentCharacter.perks) currentCharacter.perks = [];

      const perk = this.perks.find(p => p.id === perkId);
      if (!perk || !this._checkPerkRequirements(perk)) return;

      const index = currentCharacter.perks.indexOf(perkId);
      if (index > -1) {
        currentCharacter.perks.splice(index, 1);
      } else {
        currentCharacter.perks.push(perkId);
      }

      this._renderPerks();
    },

    // Check if character meets perk requirements
    _checkPerkRequirements(perk) {
      if (!perk.required_special) return true;

      return Object.entries(perk.required_special).every(([stat, required]) => {
        return (currentCharacter.special[stat] || 0) >= required;
      });
    },

    // Apply background modifiers to SPECIAL stats
    _applyBackgroundModifiers() {
      if (!this.backgrounds || !currentCharacter.background) return;

      const background = this.backgrounds.find(b => b.id === currentCharacter.background);
      if (!background?.specialModifiers) return;

      // Reset to base stats first
      Object.keys(currentCharacter.special).forEach(stat => {
        currentCharacter.special[stat] = Math.max(1, currentCharacter.special[stat] - (background.specialModifiers[stat] || 0));
      });

      // Apply new modifiers
      Object.entries(background.specialModifiers).forEach(([stat, modifier]) => {
        currentCharacter.special[stat] = Math.max(1, Math.min(10, currentCharacter.special[stat] + modifier));
      });

      this._renderSpecialStats();
    },

    // Render SPECIAL stats grid
    _renderSpecialStats() {
      const grid = this.overlayEl.querySelector('#cc-special-grid');
      const pointsRemaining = this.overlayEl.querySelector('#cc-points-remaining');

      const totalUsed = calculateSpecialTotal() - 7; // Subtract minimum
      pointsRemaining.textContent = Math.max(0, SPECIAL_TOTAL_POINTS - totalUsed);

      grid.innerHTML = SPECIAL_STATS.map(stat => `
        <div class="cc-special-stat">
          <label title="${stat.desc}">${stat.label} (${stat.abbr})</label>
          <div class="cc-special-controls">
            <button class="cc-special-btn" onclick="Game.modules.CharacterCreator._adjustSpecial('${stat.key}', -1)">-</button>
            <span class="cc-special-value">${currentCharacter.special[stat.key]}</span>
            <button class="cc-special-btn" onclick="Game.modules.CharacterCreator._adjustSpecial('${stat.key}', 1)">+</button>
          </div>
        </div>
      `).join('');
    },

    // Render evolution section
    _renderEvolution() {
      const levelEl = this.overlayEl.querySelector('#cc-level');
      const expEl = this.overlayEl.querySelector('#cc-experience');
      const commandsEl = this.overlayEl.querySelector('#cc-evolution-commands');

      levelEl.textContent = currentCharacter.evolution.level;
      expEl.textContent = currentCharacter.evolution.experience;

      commandsEl.innerHTML = Object.entries(EVOLUTION_COMMANDS).map(([cmd, info]) => {
        const applied = currentCharacter.evolution.commands.some(c => c.command === cmd);
        const canAfford = currentCharacter.evolution.experience >= info.cost;
        const classes = [
          'cc-evolution-command',
          applied ? 'applied' : (canAfford ? 'available' : 'locked')
        ].join(' ');

        return `
          <div class="${classes}" ${canAfford && !applied ? `onclick="Game.modules.CharacterCreator._applyCommand('${cmd}')"` : ''}>
            <div class="cc-command-info">
              <div><strong>${cmd.replace(/_/g, ' ')}</strong></div>
              <div>${info.effect}</div>
            </div>
            <div class="cc-command-cost">${info.cost} XP</div>
          </div>
        `;
      }).join('');
    },

    // Adjust SPECIAL stat
    _adjustSpecial(stat, delta) {
      const newValue = currentCharacter.special[stat] + delta;

      if (newValue < SPECIAL_MIN || newValue > SPECIAL_MAX) return;

      // Check if we have enough points
      const wouldUse = calculateSpecialTotal() + delta - 7;
      if (wouldUse > SPECIAL_TOTAL_POINTS) return;

      currentCharacter.special[stat] = newValue;
      this._renderSpecialStats();
    },

    // Apply evolution command
    _applyCommand(command) {
      if (applyEvolutionCommand(command)) {
        this._renderEvolution();
        this._render(); // Re-render to show evolution effects
      }
    },

    // Select Grok avatar
    _selectGrokAvatar() {
      // Create avatar selection modal
      const modal = document.createElement('div');
      modal.className = 'avatar-selection-modal';
      modal.innerHTML = `
        <div class="avatar-selection-content">
          <h3>Choose Grok Avatar</h3>
          <div class="avatar-grid">
            ${grokAvatars.map(avatar => `
              <div class="avatar-option" onclick="Game.modules.CharacterCreator._chooseAvatar('${avatar.id}', '/assets/avatars-grok/${avatar.file}')">
                <img src="/assets/avatars-grok/${avatar.file}" alt="${avatar.description}">
                <div class="avatar-desc">${avatar.description}</div>
              </div>
            `).join('')}
          </div>
          <button onclick="this.closest('.avatar-selection-modal').remove()">Cancel</button>
        </div>
      `;

      // Add styles for avatar selection
      const style = document.createElement('style');
      style.textContent = `
        .avatar-selection-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.9);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 10001;
        }

        .avatar-selection-content {
          background: #000;
          border: 2px solid #00ff41;
          border-radius: 8px;
          padding: 20px;
          max-width: 800px;
          max-height: 80vh;
          overflow-y: auto;
          color: #00ff41;
        }

        .avatar-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 15px;
          margin: 20px 0;
        }

        .avatar-option {
          cursor: pointer;
          text-align: center;
          padding: 10px;
          border: 1px solid #00ff41;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .avatar-option:hover {
          background: rgba(0, 255, 65, 0.1);
        }

        .avatar-option img {
          width: 100px;
          height: 100px;
          object-fit: cover;
          border-radius: 4px;
          margin-bottom: 5px;
        }

        .avatar-desc {
          font-size: 0.8em;
          line-height: 1.2;
        }
      `;
      modal.appendChild(style);
      document.body.appendChild(modal);
    },

    // Choose an avatar
    _chooseAvatar(id, url) {
      currentCharacter.avatar = {
        type: 'grok',
        data: url,
        id: id,
        evolution: { ...currentCharacter.evolution }
      };
      this._render();

      // Close modal
      document.querySelector('.avatar-selection-modal').remove();
    },

    // Upload photo
    _uploadPhoto() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => this._handlePhotoUpload(e);
      input.click();
    },

    // Handle photo upload
    async _handlePhotoUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB.');
        return;
      }

      // Create object URL for the image
      const url = URL.createObjectURL(file);
      currentCharacter.avatar = {
        type: 'upload',
        data: url,
        file: file,
        evolution: { ...currentCharacter.evolution }
      };

      this._render();
    },

    // Generate new avatar
    async _generateNewAvatar() {
      const prompt = prompt('Describe your character (e.g., "rugged wasteland survivor with cybernetic arm"):');
      if (!prompt) return;

      // Show loading
      const overlay = this.overlayEl.querySelector('#cc-avatar-overlay');
      overlay.textContent = 'Generating...';
      overlay.style.display = 'flex';

      try {
        const avatarUrl = await generateGrokAvatar(prompt);
        if (avatarUrl) {
          currentCharacter.avatar = {
            type: 'custom',
            data: avatarUrl,
            prompt: prompt,
            evolution: { ...currentCharacter.evolution }
          };
          this._render();
        } else {
          alert('Failed to generate avatar. Please try again.');
        }
      } catch (error) {
        console.error('Avatar generation failed:', error);
        alert('Failed to generate avatar. Please try again.');
      } finally {
        overlay.style.display = 'none';
      }
    }
  };


  // ============================================================
  // EXPORTS
  // ============================================================

  Game.modules.CharacterCreator = CharacterCreator;

})();
