# 📻 Radio System

The Radio System provides ambient wasteland radio stations with live streaming capabilities.

---

## Overview

The live radio streaming module (`live-radio-streaming.js`) enables both pre-recorded playlist playback and live DJ broadcasts.

---

## Features

- **Multiple Stream Types**: Twitch, YouTube, custom RTMP, direct audio
- **Live Broadcast**: Admin can go live as DJ
- **Live Chat**: Real-time chat during broadcasts
- **Auto-Detection**: Checks for active live streams
- **Visual Indicators**: Live badge and notifications
- **Reconnection**: Auto-reconnect on stream errors

---

## Stream Types

| Type | Description | Example |
|------|-------------|---------|
| `twitch` | Twitch.tv stream embed | `twitch.tv/channel` |
| `youtube` | YouTube Live embed | `youtube.com/watch?v=...` |
| `custom` | Custom RTMP/HLS stream | HLS playlist URL |
| `direct` | Direct audio file/stream | `.mp3` stream URL |

---

## Functions

### Initialization

#### `Game.modules.liveRadioStreaming.init()`
Initializes the radio streaming system.

```javascript
await Game.modules.liveRadioStreaming.init();
```

- Creates audio element
- Checks admin status
- Sets up event listeners
- Checks for active streams

---

### Stream Control

#### `startLiveStream(url, type, metadata)`
Starts a live stream broadcast.

```javascript
Game.modules.liveRadioStreaming.startLiveStream(
  "https://stream.example.com/live.mp3",
  "direct",
  { title: "Live from the Wasteland", host: "Fizzmaster Rex" }
);
```

#### `endLiveStream()`
Ends the current live broadcast.

```javascript
Game.modules.liveRadioStreaming.endLiveStream();
```

---

### Status Queries

#### `isStreamLive()`
Checks if a live stream is active.

```javascript
if (Game.modules.liveRadioStreaming.isStreamLive()) {
  console.log("Rex is live!");
}
```

#### `getCurrentStreamUrl()`
Gets the current stream URL.

#### `getStreamType()`
Gets the current stream type.

---

### User Actions

#### `tuneInToLive()`
Opens radio tab and starts playing.

```javascript
Game.modules.liveRadioStreaming.tuneInToLive();
```

---

### Chat Functions

#### `sendChatMessage()`
Sends a message to live chat.

```javascript
// Called from chat input
Game.modules.liveRadioStreaming.sendChatMessage();
```

#### `addChatMessage(message)`
Displays a received chat message.

```javascript
Game.modules.liveRadioStreaming.addChatMessage({
  userId: "player_123",
  username: "Wastelander",
  message: "Great tunes!",
  timestamp: Date.now()
});
```

---

## Admin Broadcasting

### Admin Controls
Admins see a broadcasting control panel:

```javascript
// Check if admin mode is active
if (Game.modules.liveRadioStreaming.adminMode) {
  // Admin controls visible
}
```

### `adminGoLive()`
Starts a broadcast (admin only).

```javascript
await Game.modules.liveRadioStreaming.adminGoLive();
```

### `adminEndStream()`
Ends the broadcast (admin only).

```javascript
await Game.modules.liveRadioStreaming.adminEndStream();
```

---

## UI Elements

### Live Indicator
```html
<div id="rex-live-indicator">
  <div class="live-badge">
    <span class="live-pulse">🔴</span>
    <span class="live-text">LIVE</span>
  </div>
  <div class="live-info">
    <div class="live-host">Fizzmaster Rex</div>
    <div class="live-title">LIVE FROM THE WASTELAND</div>
  </div>
  <button id="rex-live-tune-in">TUNE IN</button>
</div>
```

### Chat Interface
```html
<div id="rex-live-chat">
  <div class="chat-header">📻 LIVE CHAT</div>
  <div class="chat-messages" id="chat-messages"></div>
  <div class="chat-input-container">
    <input type="text" id="chat-input" placeholder="Send a message to Rex..."/>
    <button id="chat-send">SEND</button>
  </div>
</div>
```

---

## Server Events

Uses Server-Sent Events (SSE) for real-time updates:

```javascript
const eventSource = new EventSource('/api/radio/live-events');

eventSource.addEventListener('stream-started', (e) => {
  const data = JSON.parse(e.data);
  this.startLiveStream(data.url, data.type, data.metadata);
});

eventSource.addEventListener('stream-ended', () => {
  this.endLiveStream();
});

eventSource.addEventListener('chat-message', (e) => {
  const message = JSON.parse(e.data);
  this.addChatMessage(message);
});
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/radio/live-status` | GET | Check live stream status |
| `/api/radio/live-events` | SSE | Real-time event stream |
| `/api/radio/start-live` | POST | Start broadcast (admin) |
| `/api/radio/end-live` | POST | End broadcast (admin) |
| `/api/radio/live-chat` | POST | Send chat message |

---

## Events

### Custom Events

#### `rexLiveStarted`
```javascript
window.addEventListener('rexLiveStarted', (e) => {
  console.log(`Live stream: ${e.detail.metadata.title}`);
});
```

#### `rexLiveEnded`
```javascript
window.addEventListener('rexLiveEnded', () => {
  console.log("Stream ended");
});
```

---

## External Embeds

### Twitch Integration
```javascript
const embedUrl = "https://player.twitch.tv/?channel={CHANNEL}&parent={DOMAIN}";
```

### YouTube Integration
```javascript
const embedUrl = "https://www.youtube.com/embed/{VIDEO_ID}?autoplay=1";
```

---

## Error Handling

### Stream Error Recovery
```javascript
handleStreamError() {
  // Notify user
  notifications.show({
    title: "Stream Error",
    message: "Connection lost. Reconnecting..."
  });
  
  // Attempt reconnect after 5 seconds
  setTimeout(() => {
    if (this.isLive && this.streamUrl) {
      this.audioElement.load();
      this.audioElement.play();
    }
  }, 5000);
}
```

---

## Global Shorthand

```javascript
// Quick access
window.rexLive = Game.modules.liveRadioStreaming;

// Usage
rexLive.isStreamLive();
rexLive.tuneInToLive();
```

---

## Example: Live Broadcast Flow

```javascript
// 1. Admin starts broadcast
await Game.modules.liveRadioStreaming.adminGoLive();

// 2. Server notifies all clients via SSE
// stream-started event triggers startLiveStream()

// 3. Live indicator appears for all players

// 4. Players can tune in
Game.modules.liveRadioStreaming.tuneInToLive();

// 5. Chat messages flow
// chat-message events call addChatMessage()

// 6. Admin ends broadcast
await Game.modules.liveRadioStreaming.adminEndStream();

// 7. Server notifies all clients
// stream-ended event triggers endLiveStream()

// 8. Return to regular programming
```
