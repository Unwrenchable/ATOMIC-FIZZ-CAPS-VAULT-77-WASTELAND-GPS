#!/bin/bash
# Batch Avatar Generation Script
# Run this after manually generating images

echo "Validating avatar assets..."

# Check if all required files exist
required_files=(
    "avatar_001.png"
    "avatar_002.png" 
    "avatar_003.png"
    "avatar_004.png"
    "avatar_005.png"
    "manifest.json"
)

for file in "${required_files[@]}"; do
    if [ -f "public/assets/avatars-raster/$file" ]; then
        echo "✅ $file found"
    else
        echo "❌ $file missing"
    fi
done

echo "Validation complete!"
echo "Ready to test: open test-raster-avatars.html"
