// public/js/modules/dialogueBridge.js
// Connects your existing NPC system with the new visual dialogue

class DialogueBridge {
    constructor() {
        this.visual = window.npcDialogueVisual;
    }

    // Call this when player clicks/talks to an NPC
    async startNPCDialogue(npcData, playerData = null) {
        if (!playerData) {
            playerData = window.playerData || { portrait: "public/images/player/default.png" };
        }

        console.log(`Starting visual dialogue with ${npcData.name || "NPC"}`);

        await this.visual.openDialogue(npcData, playerData);

        // Example: Auto close after 10 seconds for testing
        // setTimeout(() => this.visual.closeDialogue(), 10000);
    }
}

window.dialogueBridge = new DialogueBridge();
console.log("✅ DialogueBridge loaded - Ready to show visual NPC conversations!");
