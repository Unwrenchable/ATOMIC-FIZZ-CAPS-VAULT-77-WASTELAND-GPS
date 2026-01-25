// public/js/modules/dragonbones-npc.js
// Minimal DragonBones + Pixi example loader and NPC portrait display

(function () {
  if (!window.Game) window.Game = {};
  if (!Game.modules) Game.modules = {};

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

    createArmatureDisplay(armatureName, animationName) {
      // Try to build a real DragonBones armature display. If anything fails, fallback to a simple composed Pixi sprite animation.
      if (!this.app) this.init();
      if (!this.factory) throw new Error('factory not loaded');

      // cleanup previous
      if (this.armatureDisplay) {
        try { this.app.stage.removeChild(this.armatureDisplay); } catch (e) {}
        try { this.armatureDisplay.destroy({ children: true }); } catch (e) {}
        this.armatureDisplay = null;
      }

      try {
        const armatureDisplay = this.factory.buildArmatureDisplay(armatureName);
        // animation names (may be empty)
        const animNames = armatureDisplay.animation && armatureDisplay.animation.animationNames ? armatureDisplay.animation.animationNames : [];
        if (animNames && animNames.length > 0) {
          armatureDisplay.animation.play(animationName || animNames[0]);
        } else {
          // no animations exported -> we'll apply a small runtime idle bob using PIXI ticker
          // to make the portrait feel alive without authoring animations
          let t = 0;
          armatureDisplay._idleTicker = (delta) => {
            t += 0.05 * (delta || 1);
            armatureDisplay.y = (this.app.view.height - 20) + Math.sin(t) * 4;
          };
          this.app.ticker.add(armatureDisplay._idleTicker);
        }
        armatureDisplay.x = this.app.view.width / 2;
        if (typeof armatureDisplay.y === 'undefined') armatureDisplay.y = this.app.view.height - 20;
        armatureDisplay.scale.set(0.6);
        this.app.stage.addChild(armatureDisplay);
        this.armatureDisplay = armatureDisplay;
        return armatureDisplay;
      } catch (e) {
        // Fallback: create a simple composed portrait sprite and a blink animation
        try {
          const container = new PIXI.Container();
          container.x = 0; container.y = 0;

          // Compose SVG using existing composer parts as a data URL
          const parts = { head: 'head_base.svg', eyes: 'eyes_set1.svg', hair: 'hair_short.svg', shirt: 'shirt_jacket.svg' };
          const dataUrl = await Game.Avatar.compose(parts);

          const sprite = PIXI.Sprite.from(dataUrl);
          // fit sprite to view
          const scale = Math.min(this.app.view.width / sprite.texture.width, this.app.view.height / sprite.texture.height);
          sprite.scale.set(scale);
          sprite.x = (this.app.view.width - sprite.width) / 2;
          sprite.y = (this.app.view.height - sprite.height) / 2;

          container.addChild(sprite);

          // simple blink: overlay a semi-opaque rectangle over eyes area periodically
          const blink = new PIXI.Graphics();
          const bw = sprite.width * 0.5;
          const bh = sprite.height * 0.12;
          const bx = sprite.x + sprite.width * 0.25;
          const by = sprite.y + sprite.height * 0.35;
          blink.beginFill(0x041f04);
          blink.drawRect(bx, by, bw, bh);
          blink.endFill();
          blink.alpha = 0; // start invisible
          container.addChild(blink);

          this.app.stage.addChild(container);
          this.armatureDisplay = container;

          // blink timer
          let blinkTimeout = null;
          function doBlink() {
            blink.alpha = 1;
            setTimeout(() => { blink.alpha = 0; scheduleBlink(); }, 120);
          }
          function scheduleBlink() { blinkTimeout = setTimeout(doBlink, 2000 + Math.random() * 3000); }
          scheduleBlink();

          // attach stop function for cleanup
          container._blinkTimeout = blinkTimeout;

          return container;
        } catch (ex) {
          throw ex;
        }
      }
    }
  };

  Game.modules.Dragon = Module;
})();
