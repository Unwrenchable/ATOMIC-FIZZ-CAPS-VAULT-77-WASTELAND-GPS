// public/js/modules/dragonbones-npc.js
// Minimal DragonBones + Pixi example loader and NPC portrait display
// Supports randomized variations so NPCs using the same armature feel unique

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

  // Secure RNG — no Math.random() for game-critical paths
  function _secureRand() {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 0x100000000;
  }

  // Randomization presets for NPC variety
  const NPC_TINTS = [
    0xFFFFFF, // normal
    0xFFE4C4, // warm/tan
    0xE8D4C4, // pale
    0xD4A574, // darker
    0xC4B4A4, // weathered
    0xF5DEB3, // wheat
    0xDEB887, // burlywood
    0xFFDAB9, // peach
  ];

  const ANIMATION_SPEED_RANGE = { min: 0.8, max: 1.2 };
  const SCALE_RANGE = { min: 0.55, max: 0.68 };
  const IDLE_BOB_RANGE = { min: 2, max: 6 };

  // Generate consistent random values from NPC id (so same NPC always looks the same)
  function seededRandom(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash % 1000) / 1000;
  }

  function getRandomVariation(npcId) {
    const r1 = seededRandom(npcId || 'default');
    const r2 = seededRandom((npcId || 'default') + '_2');
    const r3 = seededRandom((npcId || 'default') + '_3');
    const r4 = seededRandom((npcId || 'default') + '_4');

    return {
      tint: NPC_TINTS[Math.floor(r1 * NPC_TINTS.length)],
      animSpeed: ANIMATION_SPEED_RANGE.min + r2 * (ANIMATION_SPEED_RANGE.max - ANIMATION_SPEED_RANGE.min),
      scale: SCALE_RANGE.min + r3 * (SCALE_RANGE.max - SCALE_RANGE.min),
      idleBob: IDLE_BOB_RANGE.min + r4 * (IDLE_BOB_RANGE.max - IDLE_BOB_RANGE.min)
    };
  }

  const Module = {
    app: null,
    stageEl: null,
    factory: null,
    armatureDisplay: null,

    init(stageContainerId = 'dragonbonesStage') {
      // create Pixi app and attach to container
      const container = document.getElementById(stageContainerId);
      if (!container) return null;
      // create app if not exists
      if (!this.app) {
        const w = Math.max(80, container.clientWidth || 240);
        const h = Math.max(80, container.clientHeight || 240);
        this.app = new PIXI.Application({ width: w, height: h, transparent: true, resolution: window.devicePixelRatio || 1 });
        this.app.renderer.resize(w, h);
        container.appendChild(this.app.view);
      }
      return this.app;
    },

    async loadArmatureJSON(pathBase) {
      // pathBase should point to exported dragonbones files without extension, e.g. '/assets/dragon/hero'
      // expects: pathBase + '.json' (skeleton), pathBase + '_tex.json' (atlas json), pathBase + '_tex.png' (atlas image)
      if (!this.app) this.init();
      // allow alternative demo skeleton name if provided
      const skeletonUrl = pathBase + '.json';
      const atlasJsonUrl = pathBase + '_tex.json';
      const atlasPngUrl = pathBase + '_tex.png';

      // load via PIXI loader
      return new Promise((resolve, reject) => {
        const loader = new PIXI.Loader();
        loader.add('skeleton', skeletonUrl).add('atlasJson', atlasJsonUrl).add('atlasPng', atlasPngUrl).load((loader, resources) => {
          try {
            const factory = dragonBones.PixiFactory.factory;

            // atlas JSON
            let atlasData = null;
            if (resources.atlasJson && resources.atlasJson.data) atlasData = resources.atlasJson.data;
            else if (resources.atlasJson && resources.atlasJson.xhr && resources.atlasJson.xhr.responseText) atlasData = JSON.parse(resources.atlasJson.xhr.responseText || '{}');

            // texture
            let texture = null;
            if (resources.atlasPng && resources.atlasPng.texture) texture = resources.atlasPng.texture;
            else if (resources.atlasPng && resources.atlasPng.data && resources.atlasPng.data.url && PIXI.utils.TextureCache[resources.atlasPng.data.url]) texture = PIXI.utils.TextureCache[resources.atlasPng.data.url];

            if (!atlasData) return reject(new Error('atlas json not loaded'));
            if (!texture) return reject(new Error('atlas texture not loaded'));

            // parse and register
            try {
              factory.parseTextureAtlasData(atlasData, texture, pathBase);
            } catch (e) {
              return reject(new Error('failed to parse texture atlas: ' + (e && e.message)));
            }

            // skeleton
            let skeletonData = null;
            if (resources.skeleton && resources.skeleton.data) skeletonData = resources.skeleton.data;
            else if (resources.skeleton && resources.skeleton.xhr && resources.skeleton.xhr.responseText) skeletonData = JSON.parse(resources.skeleton.xhr.responseText || '{}');

            if (!skeletonData) return reject(new Error('skeleton data not loaded'));
            try {
              factory.parseDragonBonesData(skeletonData, pathBase);
            } catch (e) {
              return reject(new Error('failed to parse skeleton data: ' + (e && e.message)));
            }

            this.factory = factory;
            resolve(factory);
          } catch (e) {
            reject(e);
          }
        });
      });
    },

    async createArmatureDisplay(armatureName, animationName, npcId = null) {
      // Try to build a real DragonBones armature display. If anything fails, fallback to a simple composed Pixi sprite animation.
      // npcId is used to generate consistent random variations so each NPC looks unique
      if (!this.app) this.init();
      if (!this.factory) throw new Error('factory not loaded');

      // Get randomized variation based on NPC ID
      const variation = getRandomVariation(npcId || 'default_' + _secureRand());

      // cleanup previous
      if (this.armatureDisplay) {
        try { this.app.stage.removeChild(this.armatureDisplay); } catch (e) {}
        try { this.armatureDisplay.destroy({ children: true }); } catch (e) {}
        this.armatureDisplay = null;
      }

      try {
        const armatureDisplay = this.factory.buildArmatureDisplay(armatureName);
        
        // Apply NPC-specific variations for uniqueness
        armatureDisplay.tint = variation.tint;
        
        // animation names (may be empty)
        const animNames = armatureDisplay.animation && armatureDisplay.animation.animationNames ? armatureDisplay.animation.animationNames : [];
        if (animNames && animNames.length > 0) {
          armatureDisplay.animation.play(animationName || animNames[0]);
          // Vary animation speed slightly per NPC
          if (armatureDisplay.animation.timeScale !== undefined) {
            armatureDisplay.animation.timeScale = variation.animSpeed;
          }
        } else {
          // no animations exported -> we'll apply a small runtime idle bob using PIXI ticker
          // to make the portrait feel alive without authoring animations
          let t = _secureRand() * Math.PI * 2; // randomize starting phase
          const bobAmount = variation.idleBob;
          armatureDisplay._idleTicker = (delta) => {
            t += 0.05 * variation.animSpeed * (delta || 1);
            armatureDisplay.y = (this.app.view.height - 20) + Math.sin(t) * bobAmount;
          };
          this.app.ticker.add(armatureDisplay._idleTicker);
        }
        armatureDisplay.x = this.app.view.width / 2;
        if (typeof armatureDisplay.y === 'undefined') armatureDisplay.y = this.app.view.height - 20;
        armatureDisplay.scale.set(variation.scale);
        this.app.stage.addChild(armatureDisplay);
        this.armatureDisplay = armatureDisplay;
        return armatureDisplay;
      } catch (e) {
        // Fallback: create an animated SVG portrait using SMIL (no Pixi dependency)
        const stageEl = this.stageEl || document.getElementById('dragonbonesStage');
          const W = this.app ? this.app.view.width : 240;
          const H = this.app ? this.app.view.height : 300;

          // Compose SVG using existing avatar composer
          const parts = { head: 'head_base.svg', eyes: 'eyes_set1.svg', hair: 'hair_short.svg', shirt: 'shirt_jacket.svg' };
          const dataUrl = await Game.Avatar.compose(parts);

          // Outer wrapper — positioned over the Pixi canvas
          const container = document.createElement('div');
          container.id = 'dbFallbackPortrait';
          container.style.cssText = `position:absolute;top:0;left:0;width:${W}px;height:${H}px;overflow:hidden;pointer-events:none;`;

          // Portrait base image
          const img = document.createElement('img');
          img.src = dataUrl;
          img.style.cssText = `width:100%;height:100%;display:block;object-fit:contain;`;
          container.appendChild(img);

          // Inject breathing keyframes once
          if (!document.getElementById('dbFallbackStyles')) {
            const breatheStyle = document.createElement('style');
            breatheStyle.id = 'dbFallbackStyles';
            breatheStyle.textContent = `@keyframes dbBreathe{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.004)}}#dbFallbackPortrait img{transform-origin:50% 85%;animation:dbBreathe 4s ease-in-out infinite;}`;
            document.head.appendChild(breatheStyle);
          }

          // SVG overlay for SMIL-driven blink + mouth animations
          const ns = 'http://www.w3.org/2000/svg';
          const svgOverlay = document.createElementNS(ns, 'svg');
          svgOverlay.setAttribute('xmlns', ns);
          svgOverlay.setAttribute('width', '100%');
          svgOverlay.setAttribute('height', '100%');
          svgOverlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';

          // ── Blink rect (covers eye zone, normally height=0) ──
          const eyeRect = document.createElementNS(ns, 'rect');
          eyeRect.setAttribute('x', '18%');
          eyeRect.setAttribute('y', '33%');
          eyeRect.setAttribute('width', '64%');
          eyeRect.setAttribute('height', '0');
          eyeRect.setAttribute('rx', '5');
          eyeRect.setAttribute('fill', 'rgba(28,22,16,0.93)');
          const blinkAnim = document.createElementNS(ns, 'animate');
          blinkAnim.setAttribute('attributeName', 'height');
          blinkAnim.setAttribute('values', '0;12%;0');
          blinkAnim.setAttribute('dur', '0.10s');
          blinkAnim.setAttribute('begin', 'indefinite');
          blinkAnim.id = 'dbBlinkAnim';
          eyeRect.appendChild(blinkAnim);
          svgOverlay.appendChild(eyeRect);

          // ── Mouth rect (lip-sync, height toggles when talking) ──
          const mouthRect = document.createElementNS(ns, 'rect');
          mouthRect.setAttribute('x', '32%');
          mouthRect.setAttribute('y', '62%');
          mouthRect.setAttribute('width', '36%');
          mouthRect.setAttribute('height', '1');
          mouthRect.setAttribute('rx', '4');
          mouthRect.setAttribute('fill', 'rgba(18,10,8,0.78)');
          const mouthAnim = document.createElementNS(ns, 'animate');
          mouthAnim.setAttribute('attributeName', 'height');
          mouthAnim.setAttribute('values', '1;7;1');
          mouthAnim.setAttribute('dur', '0.15s');
          mouthAnim.setAttribute('repeatCount', 'indefinite');
          mouthAnim.setAttribute('begin', 'indefinite');
          mouthRect.appendChild(mouthAnim);
          svgOverlay.appendChild(mouthRect);

          container.appendChild(svgOverlay);

          // Attach overlay to stage element (on top of Pixi canvas)
          if (stageEl) {
            stageEl.style.position = 'relative';
            stageEl.appendChild(container);
          }

          this.armatureDisplay = container;

          // Periodic blink scheduler
          let blinkTimer = null;
          const scheduleBlink = () => {
            const delay = 3000 + _secureRand() * 2200;
            blinkTimer = setTimeout(() => {
              try { blinkAnim.beginElement(); } catch (_) {}
              scheduleBlink();
            }, delay);
          };
          scheduleBlink();

          // Cleanup
          container._cleanup = () => {
            if (blinkTimer) clearTimeout(blinkTimer);
            try { mouthAnim.endElement(); } catch (_) {}
            container.remove();
          };

          // Per-container talking controls (also wired via Module methods below)
          container.startTalking = () => { try { mouthAnim.beginElement(); } catch (_) {} };
          container.stopTalking  = () => { try { mouthAnim.endElement();   } catch (_) {} };

          return container;
      }
    }
  };

  Game.modules.Dragon = Module;
  
  // startTalking / stopTalking delegate to the current armatureDisplay
  // (works for both real DragonBones armature and the SMIL fallback div)
  Game.modules.Dragon.startTalking = function () {
    if (this.armatureDisplay && typeof this.armatureDisplay.startTalking === 'function') {
      this.armatureDisplay.startTalking();
    }
  };
  Game.modules.Dragon.stopTalking = function () {
    if (this.armatureDisplay && typeof this.armatureDisplay.stopTalking === 'function') {
      this.armatureDisplay.stopTalking();
    }
  };

  // Expose variation generator for external use (e.g., SVG tinting)
  Game.modules.Dragon.getRandomVariation = getRandomVariation;
})();
