// public/js/konami.js - Vault-Tec Interactive Entertainment System
// Module: V77-IES Protocol Handler
(function() {
  'use strict';

  // Obfuscated sequence storage using encoded values
  // This prevents easy discovery by searching for "ArrowUp" or similar strings
  // The sequence is encoded using base64 and character codes
  var _0x7f = (function() {
    // Encoded directional sequence (not directly readable)
    var _a = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65];
    var _m = {};
    _m[38] = 'ArrowUp';
    _m[40] = 'ArrowDown';
    _m[37] = 'ArrowLeft';
    _m[39] = 'ArrowRight';
    _m[66] = 'b';
    _m[65] = 'a';
    return _a.map(function(c) { return _m[c]; });
  })();

  var _idx = 0;
  var _flag = false;
  var _ts = 0;

  // Decode portal target using char codes
  function _d(arr) {
    return arr.map(function(c) { return String.fromCharCode(c); }).join('');
  }

  // Portal location (encoded)
  var _pt = [47, 100, 111, 110, 97, 116, 101, 46, 104, 116, 109, 108]; // /donate.html

  function _activate() {
    if (_flag) return;
    if (Date.now() - _ts < 5000) return;
    _flag = true;
    _ts = Date.now();

    // Audio feedback
    try {
      var _au = new Audio(_d([47, 97, 117, 100, 105, 111, 47, 112, 111, 119, 101, 114, 117, 112, 46, 109, 112, 51]));
      _au.volume = 0.3;
      _au.play()['catch'](function() {});
    } catch (_e) {}

    // Notification using encoded message
    var _msg = String.fromCharCode(127918) + ' ' + _d([86, 65, 85, 76, 84, 45, 84, 69, 67, 32, 80, 82, 79, 84, 79, 67, 79, 76, 32, 65, 67, 84, 73, 86, 65, 84, 69, 68]) + '!\n\n' +
               String.fromCharCode(9762) + ' ' + _d([83, 69, 67, 82, 69, 84, 32, 80, 79, 82, 84, 65, 76, 32, 85, 78, 76, 79, 67, 75, 69, 68]) + '!\n\n' +
               _d([72, 101, 108, 112, 32, 107, 101, 101, 112, 32, 116, 104, 101, 32, 87, 97, 115, 116, 101, 108, 97, 110, 100, 32, 111, 110, 108, 105, 110, 101, 33]);
    alert(_msg);

    // Calculate dimensions
    var _sw = window.innerWidth || screen.width;
    var _sh = window.innerHeight || screen.height;
    var _w = Math.min(700, Math.max(400, Math.floor(_sw * 0.7)));
    var _h = Math.min(800, Math.max(600, Math.floor(_sh * 0.8)));
    var _l = Math.floor((_sw - _w) / 2);
    var _t = Math.floor((_sh - _h) / 2);

    var _f = [
      'resizable=yes', 'scrollbars=yes', 'status=no',
      'toolbar=no', 'menubar=no', 'location=no',
      'width=' + _w, 'height=' + _h,
      'left=' + _l, 'top=' + _t
    ].join(',');

    window.open(_d(_pt), '_v77_portal', _f);

    setTimeout(function() { _flag = false; }, 5000);
  }

  // Input handler with obfuscated comparison
  function _h(e) {
    var _k = e.key;
    
    // Compare against obfuscated sequence
    if (_k === _0x7f[_idx]) {
      _idx++;
      if (_idx === _0x7f.length) {
        _idx = 0;
        _activate();
      }
    } else {
      _idx = 0;
    }
  }

  // Attach listener
  document.addEventListener('keydown', _h, false);

  // No console hint - this would give away the secret!
  // The old code had: console.log('🎮 Konami Code listener active. Try: ↑↑↓↓←→←→BA');
  // We remove this to keep it hidden
})();

