class DialogueManager {
    constructor() {
        this.app = null;
        this.npcSprite = null;
    }

    async init(containerId = "dialogue-container") {
        const container = document.getElementById(containerId);
        if (!container) return;

        this.app = new PIXI.Application({
            width: 1280,
            height: 720,
            backgroundColor: 0x0a0f1a,
            antialias: true
        });
        
        container.innerHTML = "";
        container.appendChild(this.app.view);
        this.createLayout();
    }

    createLayout() {
        const bg = new PIXI.Graphics();
        bg.beginFill(0x0a0f1a);
        bg.drawRect(0, 0, 1280, 720);
        this.app.stage.addChild(bg);

        this.npcContainer = new PIXI.Container();
        this.npcContainer.x = 680;
        this.npcContainer.y = 40;
        this.app.stage.addChild(this.npcContainer);

        const panel = new PIXI.Graphics();
        panel.beginFill(0x1a2a22, 0.97);
        panel.lineStyle(6, 0x55ff99);
        panel.drawRoundedRect(160, 460, 960, 230, 15);
        this.app.stage.addChild(panel);
    }

    async showNPC(npcData) {
        this.npcContainer.removeChildren();

        // Try to use real character creator portrait, fallback to good wasteland style
        let url = npcData.portrait || 
                 "https://picsum.photos/id/1015/600/700"; // gritty male survivor

        try {
            const texture = await PIXI.Texture.fromURL(url);
            this.npcSprite = new PIXI.Sprite(texture);
            this.npcSprite.scale.set(1.95);
            this.npcSprite.x = 60;
            this.npcContainer.addChild(this.npcSprite);
        } catch(e) {
            console.log("Portrait load failed");
        }
    }

    startTalking() {
        if (this.npcSprite) {
            let base = 1.95;
            const anim = () => {
                this.npcSprite.scale.set(base + Math.sin(Date.now()/130) * 0.06);
                if (this.isTalking) requestAnimationFrame(anim);
            };
            this.isTalking = true;
            anim();
        }
    }

    stopTalking() {
        this.isTalking = false;
    }
}

window.dialogueManager = new DialogueManager();
