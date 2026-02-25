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
      
      // Hair back-layer — drawn FIRST so it sits behind the face skin.
      // Long/flowing styles need a large ellipse that hangs down behind the head.
      if (['long', 'medium', 'ponytail', 'braids', 'dreads'].includes(app.hairStyle)) {
        const isLong = app.hairStyle === 'long';
        const hairBackRy  = isLong ? faceHeight * 1.15 : faceHeight * 0.95;
        const hairBackCy  = cy - faceHeight * (isLong ? 0.15 : 0.22);
        svg += `<ellipse cx="${cx}" cy="${hairBackCy}" rx="${faceWidth + 12}" ry="${hairBackRy}" fill="${hairColor.color}"/>`;
      }

      // Neck — tapered column with subtle bottom shadow
      svg += `<path d="M${cx-18},${cy+faceHeight*0.55} C${cx-22},${cy+faceHeight*0.7} ${cx-20},${cy+faceHeight*1.05} ${cx-14},${cy+faceHeight*1.2} L${cx+14},${cy+faceHeight*1.2} C${cx+20},${cy+faceHeight*1.05} ${cx+22},${cy+faceHeight*0.7} ${cx+18},${cy+faceHeight*0.55} Z" fill="${skinColor}"/>`;
      // Neck/jaw junction shadow
      svg += `<ellipse cx="${cx}" cy="${cy+faceHeight*0.62}" rx="20" ry="7" fill="rgba(0,0,0,0.22)"/>`;

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
      
      // Hair (top layer — cap sits on top of the face skin)
      // All positions are relative to headCrown (cy - faceHeight) so the hair
      // never sinks deep into the face regardless of face shape / heightMod.
      if (app.hairStyle !== 'bald') {
        const headCrown = cy - faceHeight;

        switch (app.hairStyle) {
          case 'buzzcut':
            // Very tight buzz — sits like a cap right at the crown
            svg += `<ellipse cx="${cx}" cy="${headCrown + faceHeight * 0.10}" rx="${faceWidth * 0.95}" ry="${faceHeight * 0.22}" fill="${hairColor.color}"/>`;
            break;
          case 'short':
            svg += `<ellipse cx="${cx}" cy="${headCrown + faceHeight * 0.12}" rx="${faceWidth + 3}" ry="${faceHeight * 0.28}" fill="${hairColor.color}"/>`;
            break;
          case 'mohawk':
            svg += `<rect x="${cx - 8}" y="${headCrown - 38}" width="16" height="55" rx="4" fill="${hairColor.color}"/>`;
            break;
          case 'slickedback':
            svg += `<ellipse cx="${cx}" cy="${headCrown + faceHeight * 0.08}" rx="${faceWidth + 10}" ry="${faceHeight * 0.22}" fill="${hairColor.color}"/>`;
            break;
          default:
            // wasteland / long / medium / ponytail / braids / dreads top cap
            svg += `<ellipse cx="${cx}" cy="${headCrown + faceHeight * 0.14}" rx="${faceWidth + 7}" ry="${faceHeight * 0.32}" fill="${hairColor.color}"/>`;
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
        const clSign = isRight ? 1 : 1;
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
