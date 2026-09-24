import json
from datetime import datetime, timezone
from pathlib import Path

root = Path("frontend/data")
ts = datetime.now(timezone.utc).isoformat()

npc = {
    "id": "npc_vault77_cartographer_quill",
    "canonical_name": "Quill Voss",
    "title": "Vault-77 Contract Cartographer",
    "faction": "vault_tec_remnant",
    "region": "mojave",
    "lvl": 22,
    "rarity": "uncommon",
    "personality": (
        "Bureaucratic optimism with a Geiger counter for a heart. "
        "Treats map errors as shareholder risk."
    ),
    "appearance": (
        "Sun-bleached Vault-Tec survey vest, cracked Pip-Boy clone, "
        "rad-stained parchment tubes."
    ),
    "greeting": (
        "Citizen! Your coordinates have been logged for mild radiation exposure "
        "and maximum shareholder value. Shall we claim a POI, or would you prefer "
        "a complimentary pamphlet on dehydration?"
    ),
    "dialogue_samples": [
        "Vault-Tec is not responsible for mutants attracted by accurate cartography.",
        "Every glowing FIZZ Cap is a vote of confidence in yesterday's tomorrow.",
        "If the map is wrong, the wasteland is wrong. Update your attitude accordingly.",
    ],
    "offers": ["poi_survey", "lore_fragment", "caps_tip"],
    "generated_by": "universal_badass_engine/creative",
    "generated_at": ts,
}

lore_addendum = {
    "id": "chapter_omniverse_cartography",
    "title": "Addendum: Multi-World Cartography Directive 77-Ω",
    "year_range": "2296-present",
    "content": (
        'Following repeated shareholder complaints that the wasteland contained '
        '"too many dimensions and not enough usable parking," Vault-Tec Research '
        "issued Directive 77-Ω. Cartographers were authorized to treat every repository "
        "of survivor data as a parallel world: game clients, RealAI home trees, recovered "
        "nests, and Solana program workspaces. Patterns learned in one world may be "
        "promoted to another only after three mild radiation reviews and one sarcastic "
        "Overseer sign-off. Vault-Tec reminds citizens that cross-world learning is a "
        "feature, not a breach of the user agreement — unless it is, in which case it "
        "was always intentional."
    ),
    "key_figures": [
        {
            "name": "Quill Voss",
            "role": "Contract Cartographer",
            "fate": "Active — currently arguing with a GPS ghost near Hoover.",
        },
        {"name": "Overseer AI", "role": "Directive co-signer", "fate": "Still smiling."},
    ],
    "locations": ["Vault 77 Relay", "RealAI Home Lattice", "Atomic Fizz Caps Workspace"],
    "game_mechanic": (
        "Players who talk to Quill Voss unlock a one-time +5% claim XP bonus "
        'labeled "Cross-World Survey Credit."'
    ),
}

ui = {
    "id": "ui_omniverse_banner_copy",
    "surface": "discovery_banner_secondary",
    "strings": {
        "label": "COORDINATES VALIDATED",
        "sublabel": "Vault-Tec Omniverse Survey // mild rad optional",
        "toast_claim_ready": "POI locked. Shareholder value inbound.",
        "toast_locations_healed": "Location lattice restored. Wander freely, citizen.",
    },
    "css_hint": {
        "color": "#00ff41",
        "border": "1px solid #00ff41",
        "fontFamily": "VT323, monospace",
    },
    "generated_by": "universal_badass_engine/creative",
    "generated_at": ts,
}

npc_path = root / "npc" / "npc_vault77_cartographer_quill.json"
npc_path.parent.mkdir(parents=True, exist_ok=True)
npc_path.write_text(json.dumps(npc, indent=2) + "\n", encoding="utf-8")

lore_path = root / "lore" / "omniverse_cartography_addendum.json"
lore_path.write_text(json.dumps(lore_addendum, indent=2) + "\n", encoding="utf-8")

ui_path = root / "ui" / "omniverse_banner.json"
ui_path.parent.mkdir(parents=True, exist_ok=True)
ui_path.write_text(json.dumps(ui, indent=2) + "\n", encoding="utf-8")

caps = root / "lore" / "fizz_caps_lore.json"
if caps.exists():
    data = json.loads(caps.read_text(encoding="utf-8"))
    chapters = data.setdefault("chapters", [])
    if not any(c.get("id") == lore_addendum["id"] for c in chapters):
        chapters.append(lore_addendum)
        caps.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

reg = root / "narrative" / "npc_registry.json"
if reg.exists():
    r = json.loads(reg.read_text(encoding="utf-8"))
    npcs = r.setdefault("npcs", [])
    if not any(
        n.get("id") == "npc_vault77_cartographer_quill"
        or n.get("canonical_name") == "Quill Voss"
        for n in npcs
    ):
        npcs.append(
            {
                "id": "npc_vault77_cartographer_quill",
                "canonical_name": "Quill Voss",
                "title": "Vault-77 Contract Cartographer",
                "dialog_file": None,
                "npc_file": "npc_vault77_cartographer_quill.json",
                "region": "mojave",
                "quest_ids": [],
            }
        )
        r["total_entries"] = len(npcs)
        reg.write_text(json.dumps(r, indent=2) + "\n", encoding="utf-8")

print("wrote", npc_path)
print("wrote", lore_path)
print("wrote", ui_path)
