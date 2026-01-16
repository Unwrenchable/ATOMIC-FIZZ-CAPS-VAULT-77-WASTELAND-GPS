// GLOBAL NPC CONTROLLER — ATOMIC FIZZ CAPS WASTELAND GPS
// This module controls ALL NPC behavior in the world.
// It requires NO changes to existing NPC JSON files.

// =============================
//  NPC CONTROLLER CORE OBJECT
// =============================
export const npcController = {
  npcs: [],
  tickInterval: 60000, // 1 minute real-time = 1 tick

  async init() {
    this.npcs = await this.loadAllNPCs();
    this.assignAutoProfiles();
    this.startSimulation();
  },

  // =============================
  //  LOAD ALL NPC JSON FILES
  // =============================
  async loadAllNPCs() {
    const npcFiles = await fetch("/public/data/npc/index.json")
      .then(res => res.json())
      .catch(() => []);

    const npcs = [];

    for (const file of npcFiles) {
      try {
        const data = await fetch(`/public/data/npc/${file}`).then(res => res.json());
        npcs.push(data);
      } catch (err) {
        console.warn("NPC load failed:", file);
      }
    }

    return npcs;
  },

  // =============================
  //  AUTO‑PROFILE GENERATION
  // =============================
  assignAutoProfiles() {
    for (const npc of this.npcs) {
      npc.status = npc.status || "active";

      npc.behavior = npc.behavior || {};

      npc.behavior.schedule = npc.behavior.schedule || this.generateSchedule(npc);
      npc.behavior.roaming = npc.behavior.roaming || this.generateRoaming(npc);
      npc.behavior.anomalySensitivity = npc.behavior.anomalySensitivity ?? this.generateAnomalySensitivity(npc);
      npc.behavior.rareEncounter = npc.behavior.rareEncounter || false;
    }
  },

  // =============================
  //  SCHEDULE GENERATION
  // =============================
  generateSchedule(npc) {
    const region = npc.currentRegion || npc.homeRegion;

    return {
      day: [npc.poi],
      night: [`${region}_home`],
      wanderChance: 0.15
    };
  },

  // =============================
  //  ROAMING GENERATION
  // =============================
  generateRoaming(npc) {
    const region = npc.currentRegion || npc.homeRegion;

    const roamingRegions = {
      "freeside-east": ["freeside-east", "strip-underground"],
      "outer-vegas-ruins": ["outer-vegas-ruins", "industrial-belt"],
      "dry-lake-edge": ["dry-lake-edge", "old-highway-route"],
      "strip-central": ["strip-central", "strip-underground"],
      "hidden-valley": ["hidden-valley", "bunker-tunnels"]
    };

    return roamingRegions[region] || [region];
  },

  // =============================
  //  ANOMALY SENSITIVITY
  // =============================
  generateAnomalySensitivity(npc) {
    const keywords = JSON.stringify(npc).toLowerCase();

    if (keywords.includes("hum") || keywords.includes("vault") || keywords.includes("echo"))
      return 0.8;

    return Math.random() * 0.4;
  },

  // =============================
  //  START SIMULATION LOOP
  // =============================
  startSimulation() {
    setInterval(() => this.tick(), this.tickInterval);
  },

  // =============================
  //  MAIN TICK LOOP
  // =============================
  tick() {
    const hour = new Date().getHours();

    for (const npc of this.npcs) {
      this.updateSchedule(npc, hour);
      this.updateRoaming(npc);
      this.updateAnomalyBehavior(npc);
    }
  },

  // =============================
  //  SCHEDULE LOGIC
  // =============================
  updateSchedule(npc, hour) {
    const schedule = npc.behavior.schedule;

    if (!schedule) return;

    const isDay = hour >= 6 && hour < 20;

    const targetPOIs = isDay ? schedule.day : schedule.night;

    if (Math.random() < schedule.wanderChance) {
      npc.status = "wandering";
    } else {
      npc.status = "active";
      npc.poi = targetPOIs[Math.floor(Math.random() * targetPOIs.length)];
    }
  },

  // =============================
  //  ROAMING LOGIC
  // =============================
  updateRoaming(npc) {
    const roaming = npc.behavior.roaming;

    if (!roaming || roaming.length <= 1) return;

    if (Math.random() < 0.02) {
      npc.status = "traveling";
      npc.currentRegion = roaming[Math.floor(Math.random() * roaming.length)];
    }
  },

  // =============================
  //  ANOMALY TRIANGLE LOGIC
  // =============================
  updateAnomalyBehavior(npc) {
    const sensitivity = npc.behavior.anomalySensitivity;

    if (Math.random() < sensitivity * 0.01) {
      npc.status = "drawn-to-anomaly";
    }

    if (Math.random() < sensitivity * 0.005) {
      npc.status = "avoiding-anomaly";
    }
  }
};
