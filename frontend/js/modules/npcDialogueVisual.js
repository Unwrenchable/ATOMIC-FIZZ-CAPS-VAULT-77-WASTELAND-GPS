class NPCDialogueVisual {
    constructor() {
        this.manager = window.dialogueManager;
    }

    async openDialogue(npcData, playerData = null) {
        document.getElementById("dialogue-container").style.display = "block";
        
        if (!this.manager.app) {
            await this.manager.init("dialogue-container");
        }

        await this.manager.showNPC(npcData);
        
        if (this.manager.startTalking) {
            this.manager.startTalking();
        }
    }

    closeDialogue() {
        if (this.manager.stopTalking) this.manager.stopTalking();
        document.getElementById("dialogue-container").style.display = "none";
    }
}

window.npcDialogueVisual = new NPCDialogueVisual();
console.log("✅ Visual Dialogue System Ready");
