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

  // Current character appearance state
  let currentAppearance = null;

  // Character Creator Module
  const CharacterCreator = {
    isOpen: false,
    overlayEl: null,
    onSaveCallback: null,

    // ============================================================
    // INITIALIZATION
    // ============================================================
    async init() {
      try {
        // Load appearance options
        const response = await fetch('/data/character_creator/appearance_options.json');
        appearanceOptions = await response.json();
        
        // Set default appearance
        currentAppearance = { ...appearanceOptions.defaultAppearance };
        currentAppearance.name = "Wanderer";
        
        console.log("[CharacterCreator] Initialized with", Object.keys(appearanceOptions).length, "option categories");
        
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
      }

      this.onSaveCallback = onSave;
      this.isOpen = true;
      this.overlayEl.classList.remove('hidden');
      this._renderOptions();
      this._updatePreview();
      
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
      const race = appearanceOptions.races.find(r => r.id === app.race) || appearanceOptions.races[0];
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
      
      // Vignette gradient
      svg += `<defs>
        <radialGradient id="vignette">
          <stop offset="60%" stop-color="transparent"/>
          <stop offset="100%" stop-color="rgba(0,0,0,0.6)"/>
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
      const cy = size * 0.45;
      
      // Neck
      svg += `<ellipse cx="${cx}" cy="${cy + faceHeight * 0.6}" rx="25" ry="40" fill="${skinColor}"/>`;
      
      // Face base
      svg += `<ellipse cx="${cx}" cy="${cy}" rx="${faceWidth}" ry="${faceHeight}" fill="${skinColor}"/>`;
      
      // Ghoul texture - use deterministic positions based on appearance hash
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
        patchPositions.forEach((pos, i) => {
          const px = cx + pos.dx * faceWidth;
          const py = cy + pos.dy * faceHeight;
          svg += `<circle cx="${px}" cy="${py}" r="${pos.r}" fill="rgba(80,60,40,0.3)"/>`;
        });
      }
      
      // Hair (back layer for longer styles)
      if (['long', 'medium', 'ponytail', 'braids', 'dreads'].includes(app.hairStyle)) {
        const hairLength = app.hairStyle === 'long' ? 80 : 50;
        svg += `<ellipse cx="${cx}" cy="${cy - 20}" rx="${faceWidth + 15}" ry="${faceHeight + hairLength}" fill="${hairColor.color}"/>`;
      }
      
      // Hair (top layer)
      if (app.hairStyle !== 'bald') {
        const hairTop = cy - faceHeight * 0.85;
        
        switch (app.hairStyle) {
          case 'buzzcut':
            svg += `<ellipse cx="${cx}" cy="${hairTop + 20}" rx="${faceWidth - 5}" ry="30" fill="${hairColor.color}"/>`;
            break;
          case 'short':
            svg += `<ellipse cx="${cx}" cy="${hairTop + 15}" rx="${faceWidth + 5}" ry="40" fill="${hairColor.color}"/>`;
            break;
          case 'mohawk':
            svg += `<rect x="${cx - 8}" y="${hairTop - 20}" width="16" height="60" rx="4" fill="${hairColor.color}"/>`;
            break;
          case 'slickedback':
            svg += `<ellipse cx="${cx}" cy="${hairTop + 25}" rx="${faceWidth + 10}" ry="35" fill="${hairColor.color}"/>`;
            break;
          default:
            svg += `<ellipse cx="${cx}" cy="${hairTop + 15}" rx="${faceWidth + 8}" ry="45" fill="${hairColor.color}"/>`;
        }
      }
      
      // Eyes
      const eyeY = cy - 10;
      const eyeSpacing = 25;
      const eyeWidth = 18;
      const eyeHeight = app.eyeShape === 'round' ? 14 : 10;
      
      // Eye whites
      svg += `<ellipse cx="${cx - eyeSpacing}" cy="${eyeY}" rx="${eyeWidth}" ry="${eyeHeight}" fill="#f8f8f8"/>`;
      svg += `<ellipse cx="${cx + eyeSpacing}" cy="${eyeY}" rx="${eyeWidth}" ry="${eyeHeight}" fill="#f8f8f8"/>`;
      
      // Iris/pupils
      const pupilSize = 8;
      const irisFilter = eyeGlow ? ' filter="url(#glow)"' : '';
      svg += `<circle cx="${cx - eyeSpacing}" cy="${eyeY}" r="${pupilSize}" fill="${eyeColor.color}"${irisFilter}/>`;
      svg += `<circle cx="${cx + eyeSpacing}" cy="${eyeY}" r="${pupilSize}" fill="${eyeColor.color}"${irisFilter}/>`;
      
      // Pupils
      svg += `<circle cx="${cx - eyeSpacing}" cy="${eyeY}" r="4" fill="#000"/>`;
      svg += `<circle cx="${cx + eyeSpacing}" cy="${eyeY}" r="4" fill="#000"/>`;
      
      // Eyebrows
      const browY = eyeY - 18;
      svg += `<line x1="${cx - eyeSpacing - 12}" y1="${browY}" x2="${cx - eyeSpacing + 12}" y2="${browY - 2}" stroke="${hairColor.color}" stroke-width="4" stroke-linecap="round"/>`;
      svg += `<line x1="${cx + eyeSpacing - 12}" y1="${browY - 2}" x2="${cx + eyeSpacing + 12}" y2="${browY}" stroke="${hairColor.color}" stroke-width="4" stroke-linecap="round"/>`;
      
      // Nose
      const noseY = cy + 15;
      svg += `<path d="M${cx} ${eyeY + 10} L${cx - 8} ${noseY + 10} Q${cx} ${noseY + 15} ${cx + 8} ${noseY + 10} L${cx} ${eyeY + 10}" fill="none" stroke="${this._darkenColor(skinColor, 20)}" stroke-width="2"/>`;
      
      // Mouth
      const mouthY = cy + 40;
      const mouthWidth = app.mouthType === 'wide' ? 30 : (app.mouthType === 'small' ? 15 : 22);
      
      // Expression-based mouth
      switch (app.expression) {
        case 'friendly':
          svg += `<path d="M${cx - mouthWidth} ${mouthY} Q${cx} ${mouthY + 15} ${cx + mouthWidth} ${mouthY}" fill="none" stroke="#8B4513" stroke-width="3" stroke-linecap="round"/>`;
          break;
        case 'stern':
        case 'determined':
          svg += `<line x1="${cx - mouthWidth}" y1="${mouthY}" x2="${cx + mouthWidth}" y2="${mouthY}" stroke="#8B4513" stroke-width="3" stroke-linecap="round"/>`;
          break;
        case 'smirking':
          svg += `<path d="M${cx - mouthWidth} ${mouthY + 3} Q${cx} ${mouthY} ${cx + mouthWidth} ${mouthY - 5}" fill="none" stroke="#8B4513" stroke-width="3" stroke-linecap="round"/>`;
          break;
        case 'weary':
          svg += `<path d="M${cx - mouthWidth} ${mouthY - 3} Q${cx} ${mouthY + 5} ${cx + mouthWidth} ${mouthY - 3}" fill="none" stroke="#8B4513" stroke-width="3" stroke-linecap="round"/>`;
          break;
        default:
          svg += `<line x1="${cx - mouthWidth}" y1="${mouthY}" x2="${cx + mouthWidth}" y2="${mouthY}" stroke="#8B4513" stroke-width="3" stroke-linecap="round"/>`;
      }
      
      // Facial hair
      if (app.facialHair && app.facialHair !== 'none') {
        const beardColor = this._darkenColor(hairColor.color, 10);
        switch (app.facialHair) {
          case 'stubble':
            svg += `<ellipse cx="${cx}" cy="${mouthY + 15}" rx="35" ry="20" fill="${beardColor}" opacity="0.3"/>`;
            break;
          case 'goatee':
            svg += `<ellipse cx="${cx}" cy="${mouthY + 20}" rx="20" ry="25" fill="${beardColor}"/>`;
            break;
          case 'fullbeard':
          case 'wastelandbeard':
            svg += `<ellipse cx="${cx}" cy="${mouthY + 25}" rx="50" ry="40" fill="${beardColor}"/>`;
            break;
          case 'mustache':
            svg += `<ellipse cx="${cx}" cy="${mouthY - 5}" rx="25" ry="8" fill="${beardColor}"/>`;
            break;
          case 'mutton':
            svg += `<ellipse cx="${cx - 45}" cy="${mouthY + 10}" rx="15" ry="30" fill="${beardColor}"/>`;
            svg += `<ellipse cx="${cx + 45}" cy="${mouthY + 10}" rx="15" ry="30" fill="${beardColor}"/>`;
            break;
        }
      }
      
      // Scars
      if (app.scar && app.scar !== 'none') {
        const scarColor = this._darkenColor(skinColor, 30);
        switch (app.scar) {
          case 'cheek_left':
            svg += `<line x1="${cx - 50}" y1="${cy}" x2="${cx - 30}" y2="${cy + 20}" stroke="${scarColor}" stroke-width="3" stroke-linecap="round"/>`;
            break;
          case 'cheek_right':
            svg += `<line x1="${cx + 50}" y1="${cy}" x2="${cx + 30}" y2="${cy + 20}" stroke="${scarColor}" stroke-width="3" stroke-linecap="round"/>`;
            break;
          case 'brow':
            svg += `<line x1="${cx - 35}" y1="${browY - 5}" x2="${cx - 15}" y2="${browY + 5}" stroke="${scarColor}" stroke-width="3" stroke-linecap="round"/>`;
            break;
          case 'lip':
            svg += `<line x1="${cx - 5}" y1="${mouthY - 8}" x2="${cx + 5}" y2="${mouthY + 8}" stroke="${scarColor}" stroke-width="2" stroke-linecap="round"/>`;
            break;
          case 'claw':
            svg += `<line x1="${cx - 40}" y1="${cy - 20}" x2="${cx - 20}" y2="${cy + 30}" stroke="${scarColor}" stroke-width="2"/>`;
            svg += `<line x1="${cx - 30}" y1="${cy - 20}" x2="${cx - 10}" y2="${cy + 30}" stroke="${scarColor}" stroke-width="2"/>`;
            svg += `<line x1="${cx - 20}" y1="${cy - 20}" x2="${cx}" y2="${cy + 30}" stroke="${scarColor}" stroke-width="2"/>`;
            break;
        }
      }
      
      // Accessories
      if (app.accessory && app.accessory !== 'none') {
        switch (app.accessory) {
          case 'eyepatch_left':
            svg += `<ellipse cx="${cx - eyeSpacing}" cy="${eyeY}" rx="${eyeWidth + 5}" ry="${eyeHeight + 5}" fill="#1a1a1a"/>`;
            svg += `<line x1="${cx - eyeSpacing - 30}" y1="${eyeY - 15}" x2="${cx - eyeSpacing + 30}" y2="${eyeY - 15}" stroke="#333" stroke-width="3"/>`;
            break;
          case 'eyepatch_right':
            svg += `<ellipse cx="${cx + eyeSpacing}" cy="${eyeY}" rx="${eyeWidth + 5}" ry="${eyeHeight + 5}" fill="#1a1a1a"/>`;
            svg += `<line x1="${cx + eyeSpacing - 30}" y1="${eyeY - 15}" x2="${cx + eyeSpacing + 30}" y2="${eyeY - 15}" stroke="#333" stroke-width="3"/>`;
            break;
          case 'glasses':
            svg += `<circle cx="${cx - eyeSpacing}" cy="${eyeY}" r="${eyeWidth + 3}" fill="none" stroke="#333" stroke-width="2"/>`;
            svg += `<circle cx="${cx + eyeSpacing}" cy="${eyeY}" r="${eyeWidth + 3}" fill="none" stroke="#333" stroke-width="2"/>`;
            svg += `<line x1="${cx - eyeSpacing + eyeWidth + 3}" y1="${eyeY}" x2="${cx + eyeSpacing - eyeWidth - 3}" y2="${eyeY}" stroke="#333" stroke-width="2"/>`;
            break;
          case 'goggles':
            svg += `<rect x="${cx - 55}" y="${eyeY - 15}" width="110" height="30" rx="5" fill="none" stroke="#555" stroke-width="3"/>`;
            svg += `<circle cx="${cx - eyeSpacing}" cy="${eyeY}" r="20" fill="rgba(150,200,255,0.3)" stroke="#666" stroke-width="2"/>`;
            svg += `<circle cx="${cx + eyeSpacing}" cy="${eyeY}" r="20" fill="rgba(150,200,255,0.3)" stroke="#666" stroke-width="2"/>`;
            break;
          case 'bandana':
            svg += `<rect x="${cx - faceWidth - 10}" y="${cy - faceHeight - 10}" width="${(faceWidth + 10) * 2}" height="25" fill="#8B0000"/>`;
            break;
          case 'cybernetic_eye':
            svg += `<circle cx="${cx + eyeSpacing}" cy="${eyeY}" r="${eyeWidth}" fill="#1a1a1a"/>`;
            svg += `<circle cx="${cx + eyeSpacing}" cy="${eyeY}" r="8" fill="#ff0000" filter="url(#glow)"/>`;
            svg += `<circle cx="${cx + eyeSpacing}" cy="${eyeY}" r="3" fill="#ff4444"/>`;
            break;
        }
      }
      
      // Synth circuitry marking
      if (app.race === 'synth' || app.marking === 'circuitry') {
        svg += `<path d="M${cx + 40} ${cy - 30} L${cx + 50} ${cy - 20} L${cx + 45} ${cy} L${cx + 55} ${cy + 20}" fill="none" stroke="rgba(0,200,255,0.5)" stroke-width="1"/>`;
      }
      
      // Vignette overlay
      svg += `<rect width="100%" height="100%" fill="url(#vignette)"/>`;
      
      // Pip-Boy green tint overlay
      svg += `<rect width="100%" height="100%" fill="rgba(0,255,65,0.05)"/>`;
      
      svg += `</svg>`;
      
      return svg;
    },

    // Fallback portrait when options not loaded
    _generateFallbackPortrait(appearance, size) {
      const app = appearance || { gender: 'male', expression: 'neutral' };
      const genderIcons = { male: '👨', female: '👩', nonbinary: '🧑' };
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
            <div>
              <div class="cc-title">CHARACTER CREATION</div>
              <div class="cc-subtitle">VAULT-TEC PERSONNEL FILE</div>
            </div>
            <button class="cc-close-btn" id="ccCloseBtn">✕ CANCEL</button>
          </div>

          <!-- Main Content -->
          <div class="cc-main">
            <!-- Preview Panel -->
            <div class="cc-preview-panel">
              <div class="cc-preview-title">PREVIEW</div>
              <div class="cc-portrait-container">
                <div class="cc-portrait-svg" id="ccPortraitSvg"></div>
              </div>
              <div class="cc-preview-name" id="ccPreviewName">WANDERER</div>
              <div class="cc-preview-stats" id="ccPreviewStats">HUMAN • ADULT</div>
              <button class="cc-randomize-btn" id="ccRandomizeBtn">🎲 RANDOMIZE</button>
            </div>

            <!-- Options Panel -->
            <div class="cc-options-panel">
              <!-- Category Tabs -->
              <div class="cc-category-tabs" id="ccCategoryTabs">
                <button class="cc-tab active" data-category="identity">IDENTITY</button>
                <button class="cc-tab" data-category="face">FACE</button>
                <button class="cc-tab" data-category="hair">HAIR</button>
                <button class="cc-tab" data-category="eyes">EYES</button>
                <button class="cc-tab" data-category="details">DETAILS</button>
                <button class="cc-tab" data-category="extras">EXTRAS</button>
              </div>

              <!-- Options Content -->
              <div class="cc-options-content" id="ccOptionsContent">
                <!-- Identity Section -->
                <div class="cc-category-section active" data-category="identity">
                  <div class="cc-section-title">IDENTITY</div>
                  
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
                  
                  <div class="cc-option-group">
                    <div class="cc-option-label">ACCESSORIES</div>
                    <div class="cc-option-grid large" id="ccAccessoryGrid"></div>
                  </div>

                  <div class="cc-option-group">
                    <div class="cc-option-label">VOICE</div>
                    <div class="cc-option-grid" id="ccVoiceGrid"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="cc-footer">
            <div class="cc-footer-left">
              <button class="cc-reset-btn" id="ccResetBtn">RESET TO DEFAULT</button>
            </div>
            <button class="cc-confirm-btn" id="ccConfirmBtn">CONFIRM</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);
      this.overlayEl = overlay;

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
      document.getElementById('ccRandomizeBtn').addEventListener('click', () => this.randomize());

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
        
        // Save to localStorage using base64 encoding for data integrity
        // This stores only cosmetic game preferences (avatar visual settings)
        const appearanceData = JSON.stringify(currentAppearance);
        const encodedAppearance = btoa(unescape(encodeURIComponent(appearanceData)));
        localStorage.setItem('playerAppearance_encoded', encodedAppearance);
        
        // Callback if provided
        if (this.onSaveCallback) {
          this.onSaveCallback(currentAppearance);
        }
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('characterCreated', { 
          detail: { appearance: currentAppearance }
        }));
        
        this.close();
      });

      // Name input
      document.getElementById('ccNameInput').addEventListener('input', (e) => {
        currentAppearance.name = e.target.value;
        document.getElementById('ccPreviewName').textContent = e.target.value || "WANDERER";
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
        }
      });
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

      container.innerHTML = options.map(opt => `
        <div class="cc-option-item ${currentAppearance[property] === opt.id ? 'selected' : ''}" 
             data-value="${opt.id}" data-property="${property}">
          ${opt.icon ? `<span class="option-icon">${opt.icon}</span>` : ''}
          <span class="option-name">${opt.name}</span>
          ${showDesc && opt.description ? `<span style="font-size:9px;opacity:0.6;display:block;margin-top:2px;">${opt.description}</span>` : ''}
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
