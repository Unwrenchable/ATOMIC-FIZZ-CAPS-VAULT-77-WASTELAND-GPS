DragonBones Animation Assets Directory
======================================

Place your DragonBones exported files here. Example file names expected by loader:

- demo/hero.json             (skeleton file)
- demo/hero_tex.json         (atlas json)
- demo/hero_tex.png          (atlas image)

You can export from DragonBones and drop files under public/assets/dragonbones/demo/

## Upgrading Demo Assets - Free Fallout-Style Resources

Looking to upgrade from the demo placeholder assets? Here are recommended free resources
for post-apocalyptic/wasteland themed character assets:

### Recommended Free Asset Sources:

1. **itch.io** (Best for post-apocalyptic sprites)
   - https://itch.io/game-assets/free/tag-2d/tag-post-apocalyptic
   - https://itch.io/game-assets/free/tag-dragonbones
   - Look for: "Post-Apocalypse Pixel Art Asset Pack", "Urban Zombie Pixel Art Pack"

2. **OpenGameArt.org** (CC-licensed assets)
   - https://opengameart.org/
   - Search: "wasteland", "post-apocalyptic", "character sprites"
   - Most assets are CC0 (public domain) or CC-BY (attribution)

3. **Ækashics Librarium** (RPG character assets with animation rigs)
   - https://www.akashics.moe/
   - https://aekashics.itch.io/librariumnimatedmegapack
   - Free animated megapacks available, CC licensed

4. **Godot Community Assets** (Complete asset packs)
   - https://forum.godotengine.org/t/2d-pixelart-post-apocalyptic-asset-pack-characters-tilesets-houses-parallax-background/121766
   - Includes animated characters, tilesets, and environments

5. **CartographyAssets** (Environment/background assets)
   - https://cartographyassets.com/assets/27210/peapus-post-apocalypse-city-1-free/
   - Free post-apocalyptic city pack

### GitHub Collections:
- https://github.com/ahnerd/creative-commons-game-assets-collection
- Curated list of CC-licensed game assets

## How to Convert Assets for DragonBones

1. **From sprite sheets**: Use DragonBones Pro to slice and rig
2. **From layered PSD/Aseprite**: Import layers as separate body parts
3. **From Spine**: DragonBones can import Spine projects

### Tips:
- Look for assets with separate body parts (head, limbs, torso) as PNGs
- Layered formats (.psd, .aseprite) are easiest to rig
- Export at 1x scale for web, 30fps frame rate

## DragonBones Editor Download Options

DragonBones Pro v5.6 may no longer be available from the original source.
Here are alternative download options (as of January 2026):

### Official Sources:
- GitHub Releases: https://github.com/DragonBones/DragonBones-Editor/releases
- DragonBones Website Archive: https://dragonbones.github.io/

### Alternative/Archive Sources:
- SourceForge Mirror: https://sourceforge.net/projects/dragonbones-runtime.mirror/
- Archive.org: Search for "DragonBones Pro" for archived versions

### Compatible Runtime Libraries:
This project uses the pixi5-dragonbones runtime (v5.7.0-2b) which is compatible
with assets exported from DragonBones Pro v5.5+ and v5.6.

CDN URL: https://cdn.jsdelivr.net/npm/pixi5-dragonbones@5.7.0-2b/dragonBones.js
NPM Package: npm install pixi5-dragonbones

### File Format Notes:
- Export as "DragonBones JSON" format (not binary)
- Include texture atlas JSON and PNG
- Scale factor: 1.0 recommended for web
- Animation frame rate: 30fps recommended

## License Reminder

Always check the license of any assets you download:
- CC0 = Public domain, no attribution required
- CC-BY = Attribution required
- CC-BY-SA = Attribution + share-alike required
- CC-BY-NC = Attribution + non-commercial only

For the Atomic Fizz Caps project, CC0 or CC-BY assets are recommended.
