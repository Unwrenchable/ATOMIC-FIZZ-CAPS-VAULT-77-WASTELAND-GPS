# Vault 77 Character Creator Assets

## 📁 Directory Contents

This directory contains **77 SVG assets** for the Atomic Fizz Caps Vault 77 character creator system.

### Asset Categories

- **Head Shapes:** 6 variants (base, round, square, heart, oblong, diamond)
- **Eye Shapes:** 8 variants (almond, round, hooded, downturned, upturned, monolid, deepset)
- **Nose Types:** 7 variants (straight, roman, snub, button, aquiline, wide, narrow)
- **Mouth Types:** 5 variants (thin, full, wide, small, heartshaped)
- **Hair Styles:** 11 variants (bald to wasteland survivor)
- **Facial Hair:** 7 variants (stubble to full beard)
- **Scars:** 9 variants (battle damage & burns)
- **Markings:** 8 variants (tattoos, freckles, race-specific)
- **Accessories:** 12 variants (eyewear, piercings, equipment)
- **Clothing:** 4 variants (vault suit, armor, wasteland gear)

## 📋 Technical Specifications

- **Format:** SVG 1.1+
- **ViewBox:** 256x256 (all assets)
- **Total Size:** ~34 KB uncompressed
- **Average File Size:** 450 bytes per asset
- **Transparency:** Yes (for layering)
- **Style:** Muted wasteland aesthetic

## 🎨 Style Guidelines

### Color Palette
- Earthy, post-apocalyptic tones
- Muted browns, grays, and greens
- Vault-Tec blue (#2e5a8a) for vault suits
- Synth glow blue (#00d4ff) for tech
- Natural skin tones (#e8d2b0 to #5c4033)

### Design Principles
- Simple SVG paths (minimal complexity)
- Transparent backgrounds for layering
- Consistent 256x256 viewBox
- Optimized for web performance
- Layering-friendly design

## 📖 Usage

### Loading Assets
```javascript
// Load asset
const img = document.createElement('img');
img.src = '/assets/avatars/hair_mohawk.svg';
```

### Layering Order
1. Head shape (base)
2. Eyes
3. Nose
4. Mouth
5. Hair
6. Facial hair
7. Scars
8. Markings
9. Accessories
10. Clothing

### Colorization
```javascript
// Change hair color (CSS filter)
hairElement.style.filter = 'hue-rotate(45deg)';

// Change fill color (SVG manipulation)
svgElement.querySelector('path').setAttribute('fill', '#3b2b24');
```

## 🔍 Asset Naming Convention

- `head_*.svg` - Head/face shapes
- `eyes_*.svg` - Eye shapes and styles
- `nose_*.svg` - Nose types
- `mouth_*.svg` - Mouth types
- `hair_*.svg` - Hair styles
- `beard_*.svg` - Facial hair styles
- `scar_*.svg` - Battle scars and wounds
- `marking_*.svg` - Tattoos, freckles, special marks
- `acc_*.svg` - Accessories (eyewear, jewelry, equipment)
- `shirt_*.svg` - Clothing and body wear

## 📄 Files

### Reference Files
- `manifest.json` - Complete asset catalog (v2.0.0)

### Documentation
See `/docs/CHARACTER_CREATOR_ASSETS.md` for comprehensive documentation.

### Testing
Open `/legacy/test-character-assets.html` in browser to preview all assets.

## 🎮 Race-Specific Assets

### Ghoul-Only
- `marking_radiation_burns.svg` - Radiation scarring

### Synth-Only
- `marking_circuitry.svg` - Visible circuits
- `acc_cybernetic_eye.svg` - Robotic eye implant

### Vault 77 Themed
- `marking_tattoo_vault.svg` - Vault 77 insignia
- `shirt_vault_suit.svg` - Blue Vault 77 jumpsuit

## ⚛️ License

Created for the Atomic Fizz Caps Vault 77 Wasteland GPS project.
CC0 or original - free for use within the project.

---

**For the good of the Vault** ☢️
