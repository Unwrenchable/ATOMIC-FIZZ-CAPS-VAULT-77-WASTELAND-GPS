

SOURCE="public/js/exampleFunction.js"
TARGET="public/overseer"

mkdir -p "$TARGET"

declare -A MODULES=(
  ["core.personality.js"]="OVERSEER V-BOT PERSONALITY CORE"
  ["core.memory.js"]="OVERSEER V-BOT MEMORY CORE"
  ["core.lore.js"]="OVERSEER V-BOT LORE ENGINE"
  ["core.events_glitch.js"]="OVERSEER V-BOT EVENTS + GLITCH SYSTEM"
  ["core.threat.js"]="OVERSEER V-BOT THREAT SCANNER"
  ["core.weather.js"]="OVERSEER V-BOT WEATHER ENGINE"
  ["core.faction.js"]="OVERSEER V-BOT FACTION INTELLIGENCE ENGINE"
  ["core.quest_mapintel.js"]="OVERSEER V-BOT QUEST DIRECTOR + MAP INTELLIGENCE"
)

for FILE in "${!MODULES[@]}"; do
  MARKER="${MODULES[$FILE]}"

  awk -v marker="$MARKER" '
    $0 ~ marker {found=1}
    found {print}
    /^\/\/ OVERSEER V-BOT/ && $0 !~ marker && found {exit}
  ' "$SOURCE" > "$TARGET/$FILE"

  if [[ -s "$TARGET/$FILE" ]]; then
    echo "Created $FILE"
  else
    echo "WARNING: Marker not found for $FILE"
    rm "$TARGET/$FILE"
  fi
done

echo "Done!"
