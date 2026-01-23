# Konami Code & Security Protection Guide
## VAULT-TEC INTERACTIVE ENTERTAINMENT SYSTEM

**Document Classification**: DEVELOPMENT REFERENCE  
**Version**: 1.0.0  
**Last Updated**: 2026-01-23

---

## 🎮 WHAT IS THE KONAMI CODE?

The Konami Code is a famous cheat code originally used in Konami video games. It's a classic gaming Easter egg.

### How It Works in This Application

1. **Event Listener**: A keyboard event listener tracks all key presses
2. **Sequence Matching**: Each key press is compared against the expected sequence
3. **Progressive Matching**: The system tracks progress through the sequence
4. **Reset on Mismatch**: If a wrong key is pressed, progress resets to zero
5. **Activation**: When all keys are entered correctly, the feature activates

### What Happens When Activated

In Atomic Fizz Caps, the Konami code:
1. Plays a sound effect (if audio is available)
2. Shows an alert notification
3. **Opens the secret donation portal** in a popup window
4. Has a 5-second cooldown to prevent spam

**Important**: This is a fun Easter egg for supporting the project. It does **NOT** provide any gameplay advantages - no extra caps, no invincibility, no cheat effects. It's purely a nostalgic nod to gaming history that lets players discover the donation page.

---

## 🔐 HIDING THE KONAMI CODE FROM INSPECTION

### The Problem

Users can inspect website source code using:
- **F12** - Opens DevTools
- **Ctrl+Shift+I** - Opens DevTools (Chrome/Firefox)
- **Ctrl+U** - View Page Source
- **Right-click → Inspect** - Element inspector
- **Right-click → View Page Source** - Source viewer

If the Konami sequence is stored as plain text like:
```javascript
const KONAMI_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', ...];
```

Anyone can search the source for "ArrowUp" or "Konami" and find it immediately.

### Our Solution: Code Obfuscation

The Konami code implementation uses several obfuscation techniques:

#### 1. Encoded Key Codes
Instead of storing readable strings, we use numeric key codes:
```javascript
// Original (readable)
const KONAMI_CODE = ['ArrowUp', 'ArrowUp', ...];

// Obfuscated (uses key codes)
var _a = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
// 38 = ArrowUp, 40 = ArrowDown, 37 = ArrowLeft, 39 = ArrowRight
// 66 = 'b', 65 = 'a'
```

#### 2. Dynamic Mapping
The codes are converted to key names at runtime:
```javascript
var _m = {};
_m[38] = 'ArrowUp';
_m[40] = 'ArrowDown';
// ... etc
return _a.map(function(c) { return _m[c]; });
```

#### 3. Encoded Strings
Text strings like file paths are stored as character code arrays:
```javascript
// Instead of: '/donate.html'
var _pt = [47, 100, 111, 110, 97, 116, 101, 46, 104, 116, 109, 108];
// Decoded at runtime using String.fromCharCode
```

#### 4. Obfuscated Variable Names
Instead of `konamiCode` or `donationUrl`, we use meaningless names:
- `_0x7f` - The sequence array
- `_idx` - Current index
- `_flag` - Activation flag
- `_pt` - Portal target

#### 5. No Console Hints
The original code logged a hint revealing the sequence. This has been **removed** to prevent easy discovery.

---

## 🛡️ DEVTOOLS PROTECTION

### What is DevTools Guard?

The DevTools Guard module (`/js/modules/devtools-guard.js`) implements multiple layers of protection against browser inspection.

### Protection Layers

#### 1. Keyboard Shortcut Blocking
```javascript
// Blocked shortcuts:
F12                    // DevTools
Ctrl+Shift+I          // DevTools (Chrome)
Ctrl+Shift+J          // Console (Chrome)
Ctrl+Shift+C          // Inspect Element
Ctrl+U                // View Source
Cmd+Option+I          // DevTools (Mac)
Cmd+Option+J          // Console (Mac)
Cmd+Option+U          // View Source (Mac)
```

When blocked, instead of opening DevTools, the user sees a security warning in the console.

#### 2. Window Size Detection
DevTools typically adds width to the browser window when opened. We detect this:
```javascript
const widthDiff = window.outerWidth - window.innerWidth;
const heightDiff = window.outerHeight - window.innerHeight;
// If difference > 160px, DevTools is likely open
```

#### 3. Console Warning
When DevTools is detected, a styled warning is displayed:
```
☢️ VAULT-TEC SECURITY ALERT ☢️
⚠️ UNAUTHORIZED ACCESS DETECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This application is protected by Vault-Tec security protocols.
Any attempt to reverse-engineer, decompile, or extract
confidential data is logged and may result in termination.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"Your cooperation is appreciated, Vault Dweller."
                    - Vault-Tec Corporation
```

#### 4. Debugger Detection (Optional)
Can detect when debugger breakpoints are hit:
```javascript
const start = performance.now();
(function() {})['constructor']('debugger')();
const end = performance.now();
// If > 100ms, execution was paused by debugger
```

This is disabled by default as it can impact performance.

---

## ⚠️ IMPORTANT LIMITATIONS

### What These Protections CANNOT Do

**Client-side code can NEVER be fully protected**. These measures are **deterrents**, not absolute security:

1. **View Source Still Works**: Users can always view raw HTML/JS files
2. **Browser Extensions**: Can bypass JavaScript-based detection
3. **Network Tab**: All data fetched can be intercepted
4. **JavaScript Disabled**: Protection relies on JS running
5. **Proxy Tools**: Fiddler, Charles, Burp Suite can intercept traffic
6. **Minified Code Can Be Beautified**: Tools like de4js, prettier
7. **Memory Inspection**: Browser memory can be examined

### Best Practices for True Secrets

For genuinely sensitive information:

1. **Keep Secrets Server-Side**: Never put API keys, passwords, or critical logic in client code
2. **Progressive Revelation**: Reveal story content via authenticated API calls
3. **Validation on Server**: All important checks should happen server-side
4. **Accept Discovery**: Treat Easter eggs as fun bonuses, not true secrets

---

## 🎯 IMPLEMENTATION FILES

| File | Purpose |
|------|---------|
| `/public/js/konami.js` | Obfuscated Konami code handler |
| `/public/js/modules/devtools-guard.js` | DevTools detection and blocking |
| `/public/index.html` | Loads both security modules |
| `/docs/AUDIT_REPORT_CERTEK.md` | Security audit documentation |

---

## 🔧 CONFIGURATION

### DevTools Guard Settings

Edit `/public/js/modules/devtools-guard.js`:

```javascript
const CONFIG = {
  enabled: true,                    // Master switch
  blockKeyboardShortcuts: true,     // Block F12, Ctrl+Shift+I, etc.
  detectDebugger: false,            // Performance impact, disabled
  detectResize: true,               // Detect DevTools via window size
  warnInConsole: true,              // Show console warning
  redirectOnDetection: false        // Redirect away (aggressive)
};
```

### Adding More Easter Eggs

To add a new hidden feature with the Konami code approach:

1. Define the sequence as numeric key codes
2. Create a mapping function for runtime conversion
3. Store any text as character code arrays
4. Use obfuscated variable names
5. Remove all console.log hints

---

## 📚 REFERENCES

- [Konami Code History](https://en.wikipedia.org/wiki/Konami_Code)
- [JavaScript Obfuscation Techniques](https://javascript-obfuscator.org/)
- [Browser DevTools Detection](https://github.com/nicholasstephan/detect-devtools-via-debugger-loop)

---

**VAULT-TEC CORPORATION**  
*"Building a Brighter Tomorrow, Yesterday."*

*Remember: Security through obscurity is not security. These protections enhance user experience by preserving surprises, but should never be relied upon for actual security requirements.*
