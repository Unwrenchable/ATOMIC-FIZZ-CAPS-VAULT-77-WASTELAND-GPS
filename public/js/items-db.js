// items-db.js
// Static data for weapons, ammo, armor, consumables

window.ITEMS_DB = {
  ammo: [
    {
      id: "5mm_round",
      name: "5mm Round",
      type: "ammo",
      stack: true,
    },
    {
      id: "mf_cell",
      name: "Microfusion Cell",
      type: "ammo",
      stack: true,
    },
  ],
  weapons: [
    {
      id: "laser_rcw",
      name: "Laser RCW",
      type: "weapon",
      ammoType: "mf_cell",
      ammoPerShot: 1,
      damage: 24,
      rarity: "rare",
    },
    {
      id: "10mm_pistol",
      name: "10mm Pistol",
      type: "weapon",
      ammoType: "10mm_round",
      ammoPerShot: 1,
      damage: 12,
      rarity: "common",
    },
  ],
  armor: [
    {
      id: "leather_armor",
      name: "Leather Armor",
      type: "armor",
      defense: 4,
    },
  ],
  consumables: [
    {
      id: "stimpak",
      name: "Stimpak",
      type: "consumable",
      heal: 30,
    },
  ],
  questItems: [
    {
      id: "vault77_keycard",
      name: "Vault 77 Keycard",
      type: "questItem",
    },
  ],
};
