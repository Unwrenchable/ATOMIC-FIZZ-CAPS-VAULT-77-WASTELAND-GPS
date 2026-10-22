# IP scrub — Atomic Fizz display names

User-facing Bethesda / Fallout trademarks were rewritten as original Atomic Fizz copy. Item ids, CSS classes, file names, and route paths were left alone so saves, fetches, and styles keep working.

This is a copy change, not a legal opinion.

## Mapping

| Former trademark | Atomic Fizz name | Notes |
| --- | --- | --- |
| Vault-Tec / VAULT-TEC | FizzTec / FIZZTEC | Already the in-world company on the shell footer. HavenTech stays a separate successor brand where the lore already used it. |
| Pip-Boy / PIP-BOY | Pocket-Boy / POCKET-BOY | Wrist terminal. CSS classes (`pipboy-button`) and `updatePipBoy*` functions were not renamed. |
| Nuka-Cola, Nuka-World, Nuka-Moonshine | Atomic Fizz, Fizz Fair, Fizz-Moonshine | The drink is the game's own soda. Ids such as `nuka_cola` stay. |
| Sunset Sarsaparilla | Dustpop | Competing pre-war soda. |
| Stimpak | FizzPak | Healing injector. Id `stimpak` and route `/api/buy-stimpak` stay. |
| RadAway | GlowFlush | Rad flush. Id `radaway` stays. |
| Rad-X | GlowTab | Rad resist. Id `radx` stays. |
| S.P.E.C.I.A.L. / SPECIAL | V.I.T.A.L.S. / VITALS | The seven letters S, P, E, C, I, A, L stay. Combat and the character creator key off those letters. |
| Vault 101 jumpsuit | Vault 77 jumpsuit | The suit the player wakes up in was already Vault 77. |
| Vault 101 (the place) | Bunker Kettle | Display name only. Id `vault_101_fo3` stays so it does not collide with the home vault. |
| Mojave | Cinder Basin | Region prose and the radio station **Cinder Nights**. Id `mojave_core` and `station-mojave.json` stay. |
| Brotherhood of Steel | Coil Covenant | Faction display name. |
| Enclave | Directorate | |
| NCR / New California Republic | Frontier Compact | |
| Caesar's Legion | Red Cohort | |
| Deathclaw | Radtalon | Id `deathclaw` stays. |
| Super Mutant | Glowborn | |
| Minutemen | Settlement Watch | |
| Mr. Handy / Mr. Gutsy | Servo-Unit / Servo-Sentry | |
| Protectron | Warden-Bot | |
| Radscorpion | Glowsting | Id prefix `radscorpion_` stays. |
| Mirelurk | Brineclaw | |
| Yao Guai | Ashbear | |
| RobCo | FizzCo | FizzCo was already used in location lore. |
| General Atomics | Helio Dynamics | |
| Vault-Boy | Fizz Kid | |
| Lucky 38 | The Spire | |
| New Vegas | Neon Reach | |
| Goodsprings | Dustwell | |
| Power Armor | Reactor Harness | Display string. Id `power_armor_piece` stays. |
| Sugar Bombs | Atom Flakes | |
| Bottle Caps (as the trivia answer) | Atomic Fizz Caps | The game's currency. The word "caps" itself stays. |
| Fallout (title word) | wasteland | "Fallout-themed" in the PWA manifest became "wasteland". |

## Judgment calls

- **Ids, filenames, and CSS.** `stimpak`, `pipboy-button`, `mojave_nights`, `station-mojave.json`, and `updatePipBoyEquipment` are not shown as titles. Renaming them would break fetches, saves, and styles. Display strings changed; those identifiers did not.
- **Stat letters.** VITALS is the label. The stored keys remain `S P E C I A L` because damage, carry weight, and the creator UI read those keys. Renaming the keys would wipe existing character sheets.
- **Other numbered vaults.** Vault 13, 76, 87, 111, and similar stay in quest text. Only Vault 101 was called out, and the place was renamed to Bunker Kettle so it is not mistaken for Vault 77. Quest ids were not rewritten.
- **Real geography.** Hoover Dam, Lake Mead, and similar real places stay. "Mojave" was treated as the fictional region name, not as a GPS desert label inside coordinates.
- **Caps.** "Caps" is the game's own token nickname (Atomic Fizz Caps). It was not scrubbed.
- **Ghoul.** Left as a generic English word. Fallout uses it as a creature type; rewriting every ghoul line would also rewrite original characters who are simply called ghouls in this setting.
- **2077.** Left. The game's own timeline already uses that year in Overseer copy.
- **Redis region slug.** `backend/world/worldstate.js` default key "Mojave Outskirts" is now "Cinder Basin Outskirts". The slug derived from that label changes. Older Redis blobs stored under `mojave-outskirts` are not migrated. The stable id `mojave_core` is unchanged.
- **Internal constants.** `SPECIAL_STATS` and `useRadAway` contained the trademark as a substring, so they moved with their call sites to `VITALS_STATS` and `useGlowFlush`. Nothing outside those files referenced the old names.
- **Archive docs and generators.** `docs/` history pages (other than this file) were not rewritten. `docs/setup/*` and feature guides may still say Vault-Tec. Root scripts `grok-avatars.js` / `check-locations.js` are dev-only and were only partly scrubbed. Shipped `frontend/` copy, radio JSON, and player-facing backend prompts were scrubbed.
- **`game: "fo3"` tags** inside POI JSON are internal source labels, not UI titles.

## Flagged image assets (not deleted)

These still depict Fallout-specific art. They were left on disk on purpose.

| Asset | Why it is flagged |
| --- | --- |
| `frontend/assets/avatars/shirt_vault_suit.svg` | Blue jumpsuit (`#4a7ab8` / `#3a6aa8`) with a yellow collar badge. The number drawn on the badge is 77, but the cut and colorway match the trademarked vault suit. |
| `frontend/assets/avatars-grok/avatar_001.png` | Portrait with a bulky wrist computer: green CRT, knobs, antenna. Reads as a Pip-Boy. |
| `frontend/assets/avatars-grok/avatar_002.png` | Blue and yellow vault jumpsuit, yellow collar, "101" on the chest, gear-and-wings chest logo. |
| `frontend/assets/avatars-grok/avatar_003.png` | Same blue/yellow jumpsuit plus a wrist-mounted device. |
| `frontend/img/icons/vault.svg` | Winged gear with a radiation trefoil. Green, not blue/yellow, but the mark is the Vault-Tec logo silhouette. |

Not flagged: `frontend/img/icons/pipboy-grid.svg` (plain grid), phosphor raster portraits under `frontend/assets/avatars-raster/`, `frontend/favicon.png`, and `frontend/wallet/branding/logo.png` (Atomic Fizz bottle).

## B.L.A.S.T.E.D. (2026-10-22)
Player-facing stat labels are now B.L.A.S.T.E.D. (Brawn, Lookout, Absorb, Swagger, Tinker, Escape, Dumb Luck). Internal keys S/P/E/C/I/A/L are kept for saves, the backend and battle math. Source of labels: frontend/js/game/vitals.js.


## Second pass (2026-10-22)

Display names (case-sensitive, URLs untouched). Item ids stay, per the policy above (saves, minted metadata).

| Former | Atomic Fizz | | Former | Atomic Fizz |
| --- | --- | --- | --- | --- |
| Cooper Howard / Cooper | Cutter Hale / Cutter | | Vault 13 / 111 / 76 / 87 | Vault 31 / 47 / 67 / 78 |
| Vault 3 / 8 / 11 / 15 / 19 / 21 / 22 / 34 / 81 / 95 | Vault 9 / 18 / 41 / 51 / 29 / 12 / 82 / 43 / 18-B / 59 | | Commonwealth | Bay Reaches |
| NCR (leftovers) | Frontier Compact | | McCarran | Halloran |
| Megaton | Craterhold | | Novac | Saurville |
| T-51 / X-01 | Mk-5 / Mk-X | | Dunwich | Grimwick |
| Far Harbor | Fogmoor | | Diamond City | Stadium Hollow |
| the Pitt | the Scrapforge | | Sole Survivor | Last Sleeper |
| Mr. House | Mr. Manor | | Shady Sands | Dustwater |
| Boneyard / Necropolis / Junktown | Ossuary Yard / Grave City / Scraptown | | Rivet City / Goodneighbor | Bolt Harbor / Kindly Row |
| Sanctuary Hills | Refuge Hills | | Caesar | the Imperator |
| Liberty Prime / Three Dog / Galaxy News | Freedom Titan / Two Hound / Starlight News | | Nick Valentine / Dogmeat / Codsworth | Rick Vallance / Scraps / Butlerbot |
| Preston Garvey / Paladin Danse | Prescott Garrow / Paladin Varr | | Big MT / Mothership Zeta | Big Crater / Starship Omega |
| Lone Wanderer | Lone Drifter | | Freeside | Outskirt Row |
| REPCONN / Ultra-Luxe / Gomorrah | SkyRocket Co. / Velvet Luxe / Sodom Lounge | | Atomic Wrangler / Crimson Caravan | Rad Rustler / Scarlet Caravan |
| Fallout N (game titles) | the First/Frontier/Capital/Neon/Bay/Hill Country saga | | | |

Renamed ids + files (aliases kept): `ghoul_cooper`→`cutter_hale`, `vault_dweller_echo`→`vault_sleeper_echo`, `sole_survivor_echo`→`last_sleeper_echo`, the four `npc_*_ncr_*` files→`*_compact_*`, `quest_fo2_ncr_founding`→`quest_fo2_compact_founding`, `quest_timeline_ncr_minutemen`→`quest_timeline_compact_watch`, `quest_tv_ghoul_cooper`→`quest_tv_cutter_hale`. `narrative.js` maps the old dialog ids; `player-state.js` migrates saved quest ids. Raster pack manifest renamed to `afc-avatar-pack-raster-wasteland`, `vault_tec` tags → `fizztec`.

Left on purpose: real places (Nipton, Primm, Hoover Dam, Zion, Point Lookout, Appalachia, Searchlight, Boulder City), generic words (Institute, Railroad, Legion, bare "Brotherhood", ghoul), item ids such as `mcCarran_trooper_armor` / `t51_power_armor`, the `ncr` map-icon key, `fallout_pois.json` filename, and `game: "fo3"` tags. R2 video URLs keep their old filenames. `tests/game.ip.part.js` guards the list.
