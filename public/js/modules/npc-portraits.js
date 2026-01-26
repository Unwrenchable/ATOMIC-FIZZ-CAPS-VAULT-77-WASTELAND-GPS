// public/js/modules/npc-portraits.js
// Preload and manage NPC portraits (SVG composer + DragonBones when available)

(function () {
  if (!window.NPCPortraits) window.NPCPortraits = {};

  const cache = new Map();

  async function preloadSVG(npc) {
    // Ensure Game.Avatar is available before composing
    if (!window.Game || !Game.Avatar || typeof Game.Avatar.compose !== 'function') {
      console.warn('[NPCPortraits] Game.Avatar not ready, skipping preload for', npc.id);
      return null;
    }
    const parts = npc.parts || { head: 'head_base.svg', eyes: 'eyes_set1.svg', hair: 'hair_short.svg', shirt: 'shirt_jacket.svg' };
    const url = await Game.Avatar.compose(parts);
    cache.set(npc.id, { type: 'svg', url });
    return url;
  }

  async function preloadDragonbones(npc, armatureBase) {
    // armatureBase: '/assets/dragonbones/demo/hero' (without extension)
    try {
      if (!Game.modules || !Game.modules.Dragon) return null;
      await Game.modules.Dragon.init('dragonbonesStage');
      try {
        const res = await Game.modules.Dragon.loadArmatureJSON(armatureBase);
        // If DragonBones factory loaded
        if (res && res.type === 'dragon') {
          const display = Game.modules.Dragon.createArmatureDisplay('hero', 'idle');
          cache.set(npc.id, { type: 'dragon', display });
          return display;
        }

        // If spritesheet fallback loaded
        if (res && res.type === 'sprites') {
          try {
            const resources = res.resources;
            const frames = resources.spritesJson.data.frames || [];
            const textures = frames.map(f => {
              // create texture from atlas image using frame rectangle
              const tex = new PIXI.Texture(resources.atlasPng.texture.baseTexture, new PIXI.Rectangle(f.frame.x, f.frame.y, f.frame.w, f.frame.h));
              return tex;
            });
            const anim = new PIXI.AnimatedSprite(textures);
            anim.animationSpeed = 0.12;
            anim.play();
            // position and scale
            anim.x = Game.modules.Dragon.app.view.width / 2 - anim.width / 2;
            anim.y = Game.modules.Dragon.app.view.height - anim.height - 10;
            Game.modules.Dragon.app.stage.addChild(anim);
            cache.set(npc.id, { type: 'dragon', display: anim });
            return anim;
          } catch (e) {
            console.warn('[NPCPortraits] spritesheet preload failed', e);
            return null;
          }
        }

        // Fallback: compose an SVG portrait and create a tiny AnimatedSprite from it so the portrait feels animated
        try {
          if (!window.Game || !Game.Avatar || typeof Game.Avatar.compose !== 'function') {
            console.warn('[NPCPortraits] Game.Avatar not ready for fallback SVG');
            return null;
          }
          const parts = npc.parts || { head: 'head_base.svg', eyes: 'eyes_set1.svg', hair: 'hair_short.svg', shirt: 'shirt_jacket.svg' };
          const svgUrl = await Game.Avatar.compose(parts);
          const app = Game.modules.Dragon.app;
          if (!app) await Game.modules.Dragon.init('dragonbonesStage');
          const texture = PIXI.Texture.from(svgUrl);
          const frames = [texture, texture, texture];
          const anim = new PIXI.AnimatedSprite(frames);
          anim.animationSpeed = 0.12 + Math.random() * 0.08;
          anim.play();
          anim.x = Game.modules.Dragon.app.view.width / 2 - anim.width / 2;
          anim.y = Game.modules.Dragon.app.view.height - anim.height - 10;
          Game.modules.Dragon.app.stage.addChild(anim);
          cache.set(npc.id, { type: 'dragon', display: anim });
          return anim;
        } catch (e) {
          console.warn('[NPCPortraits] fallback animated SVG failed', e);
          return null;
        }
      } catch (e) {
        console.warn('[NPCPortraits] dragonbones preload failed', e);
        return null;
      }
    } catch (e) {
      console.warn('[NPCPortraits] dragonbones preload failed', e);
      return null;
    }
  }

  function get(npcId) {
    return cache.get(npcId) || null;
  }

  async function showInDialog(npc, opts = {}) {
    // opts.containerId or opts.containerElement can be provided
    let container = null;
    if (opts.containerElement) container = opts.containerElement;
    else if (opts.containerId) container = document.getElementById(opts.containerId);
    else container = document.getElementById('dialogPortraitContainer');
    const nameEl = document.getElementById('dialogNPCName');
    if (!container) return;
    nameEl.textContent = npc.name || 'NPC';

    // prefer dragonbones if requested and available
    if (opts.useDragonbones && Game.modules && Game.modules.Dragon) {
      const entry = get(npc.id);
      if (!entry || entry.type !== 'dragon') {
        await preloadDragonbones(npc, opts.armatureBase || '/assets/dragonbones/demo/hero');
      }
      const e = get(npc.id);
      if (e && e.type === 'dragon') {
        // attach Pixi canvas to container
      const appView = Game.modules.Dragon.app && Game.modules.Dragon.app.view;
      if (appView) {
        if (appView.parentElement) appView.parentElement.removeChild(appView);
        container.innerHTML = '';
        container.appendChild(appView);
      }
        return;
      }
    }

    // fallback to SVG
    const entry2 = get(npc.id);
    if (!entry2 || entry2.type !== 'svg') {
      await preloadSVG(npc);
    }
    const e2 = get(npc.id);
    if (e2 && e2.type === 'svg') {
      container.innerHTML = `<img src="${e2.url}" style="width:100px;height:120px;" alt="portrait"/>`;
    }
  }

  // Runtime skin-swap API for DragonBones armature and SVG composer
  async function swapSkin(npcId, skin) {
    // skin: { hair: 'hair_long.svg', shirt: 'shirt_coat.svg' } for SVG
    const entry = get(npcId);
    if (!entry) return false;
    if (entry.type === 'svg') {
      // we need original NPC data to compose; caller should pass parts in saved NPC record
      // For convenience assume global NPC registry: window.NPCS[npcId]
      const npc = window.NPCS && window.NPCS[npcId];
      if (!npc) return false;
      if (!window.Game || !Game.Avatar || typeof Game.Avatar.compose !== 'function') {
        console.warn('[NPCPortraits] Game.Avatar not ready for skin swap');
        return false;
      }
      const parts = Object.assign({}, npc.parts || {}, skin);
      const url = await Game.Avatar.compose(parts);
      cache.set(npcId, { type: 'svg', url });
      return true;
    }

    if (entry.type === 'dragon') {
      // swap attachment slots on dragonbones armature display
      try {
        const display = entry.display;
        // skin contains slotName: attachmentName mapping
        Object.keys(skin).forEach(slot => {
          const attachment = skin[slot];
          try { display.armature().getSlot(slot).setDisplayByName(attachment); } catch (e) {}
        });
        return true;
      } catch (e) {
        console.warn('[NPCPortraits] swapSkin dragon failed', e);
        return false;
      }
    }
    return false;
  }

  window.NPCPortraits = {
    preloadSVG,
    preloadDragonbones,
    showInDialog,
    swapSkin,
    _cache: cache
  };
})();
