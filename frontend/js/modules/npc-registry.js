// public/js/modules/npc-registry.js
// Simple global NPC registry to store NPC data and appearance parts

(function () {
  if (!window.NPCS) window.NPCS = {};

  const registry = {
    _data: {},

    register(npc) {
      if (!npc || !npc.id) return null;
      this._data[npc.id] = npc;
      window.NPCS[npc.id] = npc;
      return npc;
    },

    get(id) {
      return this._data[id] || null;
    },

    all() {
      return Object.values(this._data);
    }
  };

  window.NPCRegistry = registry;
})();
