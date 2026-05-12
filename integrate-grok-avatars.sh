#!/bin/bash

# 🤖 Grok Avatar Integration Script
# Copies Grok-generated avatars into the game system

echo "🤖 Grok Avatar Integration"
echo "=========================="

# Source and destination directories
SOURCE_DIR="public/assets/avatars-grok"
DEST_DIR="public/assets/avatars-raster"

# Check if source directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Source directory not found: $SOURCE_DIR"
    echo "💡 Run grok-only-avatars.js first to generate avatars"
    exit 1
fi

# Create destination directory if it doesn't exist
mkdir -p "$DEST_DIR"

echo "🔍 Checking for generated avatars..."

# Copy PNG files (preferred)
png_count=0
for file in "$SOURCE_DIR"/avatar_*.png; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        cp "$file" "$DEST_DIR/"
        echo "✅ Copied $filename"
        ((png_count++))
    fi
done

# If no PNGs, copy SVGs and try to convert
if [ $png_count -eq 0 ]; then
    echo "⚠️  No PNG files found, checking for SVGs..."

    svg_count=0
    for file in "$SOURCE_DIR"/avatar_*.svg; do
        if [ -f "$file" ]; then
            filename=$(basename "$file")
            png_file="${filename%.svg}.png"

            # Try to convert SVG to PNG
            if command -v convert &> /dev/null; then
                echo "🔄 Converting $filename to PNG..."
                convert "$file" -resize 256x256! "$DEST_DIR/$png_file"
                if [ $? -eq 0 ]; then
                    echo "✅ Converted and copied $png_file"
                    ((png_count++))
                else
                    echo "❌ Failed to convert $filename"
                fi
            else
                echo "⚠️  ImageMagick not available - copying SVG as-is"
                cp "$file" "$DEST_DIR/"
                echo "✅ Copied $filename (SVG)"
                ((svg_count++))
            fi
        fi
    done

    if [ $svg_count -eq 0 ]; then
        echo "❌ No SVG files found either!"
        echo "💡 Run grok-only-avatars.js to generate avatars first"
        exit 1
    fi
fi

# Update manifest if needed
MANIFEST="$DEST_DIR/manifest.json"
if [ -f "$MANIFEST" ]; then
    echo "📝 Manifest exists - avatars will use existing configuration"
else
    echo "📝 Creating basic manifest..."
    cat > "$MANIFEST" << 'EOF'
{
  "name": "grok-fallout-avatars",
  "version": "1.0.0",
  "description": "AI-generated Fallout character avatars created with Grok",
  "theme": "Authentic Fallout wasteland survivors designed by Grok AI",
  "imageSize": "256x256",
  "format": "png",
  "totalAvatars": 5,
  "avatars": [
    {
      "id": "avatar_001",
      "file": "avatar_001.png",
      "description": "Grok-designed weathered male survivor",
      "tags": ["male", "survivor", "grok-generated"]
    },
    {
      "id": "avatar_002",
      "file": "avatar_002.png",
      "description": "Grok-designed female wasteland trader",
      "tags": ["female", "trader", "grok-generated"]
    },
    {
      "id": "avatar_003",
      "file": "avatar_003.png",
      "description": "Grok-designed young male scout",
      "tags": ["male", "scout", "grok-generated"]
    },
    {
      "id": "avatar_004",
      "file": "avatar_004.png",
      "description": "Grok-designed mature female raider",
      "tags": ["female", "raider", "grok-generated"]
    },
    {
      "id": "avatar_005",
      "file": "avatar_005.png",
      "description": "Grok-designed elderly male vault dweller",
      "tags": ["male", "vault", "grok-generated"]
    }
  ]
}
EOF
    echo "✅ Created manifest.json"
fi

# Validate installation
echo ""
echo "🧪 Validating installation..."
if [ -f "validate-avatars.sh" ]; then
    ./validate-avatars.sh
else
    echo "⚠️  Validation script not found - checking manually..."
    file_count=$(ls -1 "$DEST_DIR"/avatar_*.png 2>/dev/null | wc -l)
    if [ $file_count -ge 5 ]; then
        echo "✅ Found $file_count avatar files"
        echo "✅ Integration successful!"
    else
        echo "⚠️  Only found $file_count avatar files (expected 5)"
    fi
fi

echo ""
echo "🎉 Grok avatars integrated!"
echo ""
echo "🧪 Test your new avatars:"
echo "   python3 -m http.server 8000"
echo "   Visit: http://localhost:8000/test-raster-avatars.html"
echo ""
echo "🤖 Enjoy your Grok-designed Fallout characters!"
echo ""
echo "🗑️  Optional cleanup:"
echo "   rm -rf $SOURCE_DIR  # Remove generation files"