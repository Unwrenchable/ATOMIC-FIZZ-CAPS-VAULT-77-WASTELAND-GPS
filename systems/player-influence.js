export function buildPlayerInfluence(player = {}) {
  return {
    player_look: {
      gender: player.gender || "unknown",
      style: player.style || "wasteland drifter",
      notable_feature: player.feature || player.notable_feature || "dust-stained coat"
    },
    player_personality: player.personality || "guarded",
    player_alignment: player.alignment || "neutral",
    tone: player.vibe || "gritty"
  };
}
