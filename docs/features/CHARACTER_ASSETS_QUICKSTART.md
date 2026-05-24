# 📟 VAULT 77 CHARACTER ASSETS - QUICK START

## Overview
Complete SVG asset library for character creation with **77 assets** across **10 categories**.

## Quick Access

### 📁 Asset Location
```
/public/assets/avatars/
```

### 📋 Key Files
- `manifest.json` - Complete catalog (v2.0.0)
- `README.md` - Quick reference guide
- 77 `.svg` files organized by category

### 📚 Documentation
- `/docs/CHARACTER_CREATOR_ASSETS.md` - Comprehensive guide
- `/docs/ASSET_GENERATION_COMPLETE.md` - Completion report
- `/test-character-assets.html` - Visual test page

## Asset Categories (77 total)

| Category | Count | Examples |
|----------|-------|----------|
| Head Shapes | 6 | head_round, head_square, head_diamond |
| Eyes | 8 | eyes_almond, eyes_hooded, eyes_round |
| Noses | 7 | nose_straight, nose_roman, nose_button |
| Mouths | 5 | mouth_full, mouth_thin, mouth_wide |
| Hair | 11 | hair_mohawk, hair_dreads, hair_wasteland |
| Facial Hair | 7 | beard_full, beard_goatee, beard_stubble |
| Scars | 9 | scar_claw, scar_bullet, scar_burn_left |
| Markings | 8 | marking_tribal, marking_freckles, marking_circuitry |
| Accessories | 12 | acc_goggles, acc_glasses, acc_cybernetic_eye |
| Clothing | 4 | shirt_vault_suit, shirt_armor, shirt_wasteland_gear |

## Quick Integration

### 1. Load Asset Manifest
```javascript
const manifest = await fetch('/assets/avatars/manifest.json').then(r => r.json());
console.log(manifest.parts); // All assets by category
```

### 2. Layer Character Assets
```javascript
const layers = [
  'head_base.svg',
  'eyes_almond.svg',
  'nose_straight.svg',
  'mouth_full.svg',
  'hair_mohawk.svg',
  'beard_goatee.svg',
  'acc_goggles.svg',
  'shirt_vault_suit.svg'
];

layers.forEach((asset, i) => {
  const img = document.createElement('img');
  img.src = `/assets/avatars/${asset}`;
  img.style.position = 'absolute';
  img.style.zIndex = i;
  container.appendChild(img);
});
```

### 3. Test Visually
```bash
# Open in browser
./test-character-assets.html
```

## Technical Specs

- **Format:** SVG 1.1+
- **ViewBox:** 256x256 (all assets)
- **Size:** ~34 KB total (~11 KB gzipped)
- **Transparency:** Yes
- **Colorizable:** Hair, eyes, facial hair

## Race-Specific Assets

### 🧟 Ghoul
- `marking_radiation_burns.svg`

### 🤖 Synth  
- `marking_circuitry.svg`
- `acc_cybernetic_eye.svg`

### ⚛️ Vault 77
- `shirt_vault_suit.svg` (with badge)
- `marking_tattoo_vault.svg`

## Next Steps

1. ✅ Open `/test-character-assets.html` to preview
2. ✅ Review `/docs/CHARACTER_CREATOR_ASSETS.md` for details
3. ✅ Integrate with `/public/js/modules/character-creator.js`
4. ✅ Test with `/public/data/character_creator/appearance_options.json`

## File Naming Convention

```
{category}_{variant}.svg

Examples:
- hair_mohawk.svg
- beard_goatee.svg
- acc_goggles.svg
- scar_claw.svg
```

## Performance

- ⚡ Fast: 34 KB total (all 77 assets)
- ⚡ Optimized: ~450 bytes average per asset
- ⚡ Efficient: No external dependencies
- ⚡ Scalable: Vector format (no pixelation)

## Support

**Documentation:** `/docs/CHARACTER_CREATOR_ASSETS.md`  
**Test Page:** `/test-character-assets.html`  
**Manifest:** `/public/assets/avatars/manifest.json`

---

**Stay safe out there, Vault Dweller.** ☢️
