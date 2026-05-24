#!/bin/bash

# 🎨 AI Avatar Integration Script
# Helps integrate AI-generated avatars into the project

echo "🎯 AI Avatar Integration Helper"
echo "================================"

# Check if ImageMagick is available
if ! command -v convert &> /dev/null; then
    echo "⚠️  ImageMagick not found. Installing..."
    sudo apt-get update && sudo apt-get install -y imagemagick
fi

# Create downloads directory hint
echo ""
echo "📁 Step 1: Place your AI-generated avatars in a 'downloads' folder"
echo "   Create: ./downloads/"
echo "   Add your PNG files: avatar_001.png, avatar_002.png, etc."
echo ""

read -p "Have you placed the avatar files in ./downloads/? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Create downloads directory if it doesn't exist
    mkdir -p downloads

    # Check for avatar files
    echo "🔍 Checking for avatar files..."
    missing_files=()
    for i in {001..005}; do
        if [ ! -f "downloads/avatar_${i}.png" ]; then
            missing_files+=("avatar_${i}.png")
        fi
    done

    if [ ${#missing_files[@]} -eq 0 ]; then
        echo "✅ All avatar files found!"

        # Resize and copy files
        echo ""
        echo "🔄 Processing avatars..."
        target_dir="public/assets/avatars-raster"

        for i in {001..005}; do
            src="downloads/avatar_${i}.png"
            dst="$target_dir/avatar_${i}.png"

            echo "Processing avatar_${i}.png..."

            # Resize to exactly 256x256 and convert to PNG
            convert "$src" -resize 256x256! -quality 100 "$dst"

            if [ $? -eq 0 ]; then
                echo "  ✅ Resized and copied avatar_${i}.png"
            else
                echo "  ❌ Failed to process avatar_${i}.png"
            fi
        done

        # Validate
        echo ""
        echo "🧪 Validating installation..."
        ./validate-avatars.sh

        echo ""
        echo "🎉 Integration complete!"
        echo ""
        echo "🧪 Test your avatars:"
        echo "   python3 -m http.server 8000"
        echo "   Visit: http://localhost:8000/test-raster-avatars.html"
        echo ""
        echo "🗑️  Clean up:"
        echo "   rm -rf downloads/  # Remove temporary files"

    else
        echo "❌ Missing files:"
        printf '   - %s\n' "${missing_files[@]}"
        echo ""
        echo "Please ensure all avatar files are in ./downloads/"
        exit 1
    fi

else
    echo "📋 To get started:"
    echo "1. Generate avatars using Midjourney or DALL-E"
    echo "2. Download them as PNG files"
    echo "3. Name them: avatar_001.png, avatar_002.png, etc."
    echo "4. Place them in: ./downloads/"
    echo "5. Run this script again"
    echo ""
    echo "📖 See AI_AVATAR_GENERATION_GUIDE.md for detailed instructions"
fi