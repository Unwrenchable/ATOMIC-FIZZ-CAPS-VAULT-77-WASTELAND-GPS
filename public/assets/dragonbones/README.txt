DragonBones Animation Assets Directory
======================================

Place your DragonBones exported files here. Example file names expected by loader:

- demo/hero.json             (skeleton file)
- demo/hero_tex.json         (atlas json)
- demo/hero_tex.png          (atlas image)

You can export from DragonBones and drop files under public/assets/dragonbones/demo/

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
