/**
 * bs58.js — Browser UMD bundle for Base58 encode/decode
 *
 * Vendored from base-x@5.0.1 (MIT) + bs58 ALPHABET, so the game works
 * without depending on an external CDN URL that does not ship a browser
 * build for bs58@6.x.
 *
 * Sets  window.bs58 = { encode, decode, decodeUnsafe }
 */
(function (root) {
  'use strict';

  // ── base-x core (MIT — https://github.com/cryptocoinjs/base-x) ──────────
  function baseX(ALPHABET) {
    if (ALPHABET.length >= 255) throw new TypeError('Alphabet too long');

    var BASE_MAP = new Uint8Array(256);
    for (var j = 0; j < BASE_MAP.length; j++) BASE_MAP[j] = 255;
    for (var i = 0; i < ALPHABET.length; i++) {
      var x = ALPHABET.charAt(i);
      var xc = x.charCodeAt(0);
      if (BASE_MAP[xc] !== 255) throw new TypeError(x + ' is ambiguous');
      BASE_MAP[xc] = i;
    }

    var BASE    = ALPHABET.length;
    var LEADER  = ALPHABET.charAt(0);
    var FACTOR  = Math.log(BASE)  / Math.log(256); // log(BASE)/log(256)
    var iFACTOR = Math.log(256)   / Math.log(BASE); // log(256)/log(BASE)

    function encode(source) {
      if (source instanceof Uint8Array) {
        // ok
      } else if (ArrayBuffer.isView(source)) {
        source = new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
      } else if (Array.isArray(source)) {
        source = Uint8Array.from(source);
      }
      if (!(source instanceof Uint8Array)) throw new TypeError('Expected Uint8Array');
      if (source.length === 0) return '';

      var zeroes = 0, length = 0, pbegin = 0, pend = source.length;
      while (pbegin !== pend && source[pbegin] === 0) { pbegin++; zeroes++; }

      var size = ((pend - pbegin) * iFACTOR + 1) >>> 0;
      var b58 = new Uint8Array(size);
      while (pbegin !== pend) {
        var carry = source[pbegin];
        var k = 0;
        for (var it1 = size - 1; (carry !== 0 || k < length) && (it1 !== -1); it1--, k++) {
          carry += (256 * b58[it1]) >>> 0;
          b58[it1] = (carry % BASE) >>> 0;
          carry = (carry / BASE) >>> 0;
        }
        if (carry !== 0) throw new Error('Non-zero carry');
        length = k;
        pbegin++;
      }

      var it2 = size - length;
      while (it2 !== size && b58[it2] === 0) it2++;
      var str = LEADER.repeat(zeroes);
      for (; it2 < size; ++it2) str += ALPHABET.charAt(b58[it2]);
      return str;
    }

    function decodeUnsafe(source) {
      if (typeof source !== 'string') throw new TypeError('Expected String');
      if (source.length === 0) return new Uint8Array();
      var psz = 0, zeroes = 0, length = 0;
      while (source[psz] === LEADER) { zeroes++; psz++; }

      var size = (((source.length - psz) * FACTOR) + 1) >>> 0;
      var b256 = new Uint8Array(size);
      while (psz < source.length) {
        var charCode = source.charCodeAt(psz);
        if (charCode > 255) return undefined;
        var carry = BASE_MAP[charCode];
        if (carry === 255) return undefined;
        var m = 0;
        for (var it3 = size - 1; (carry !== 0 || m < length) && (it3 !== -1); it3--, m++) {
          carry += (BASE * b256[it3]) >>> 0;
          b256[it3] = (carry % 256) >>> 0;
          carry = (carry / 256) >>> 0;
        }
        if (carry !== 0) throw new Error('Non-zero carry');
        length = m;
        psz++;
      }

      var it4 = size - length;
      while (it4 !== size && b256[it4] === 0) it4++;
      var vch = new Uint8Array(zeroes + (size - it4));
      var idx = zeroes;
      while (it4 !== size) vch[idx++] = b256[it4++];
      return vch;
    }

    function decode(string) {
      var buffer = decodeUnsafe(string);
      if (buffer) return buffer;
      throw new Error('Non-base' + BASE + ' character');
    }

    return { encode: encode, decode: decode, decodeUnsafe: decodeUnsafe };
  }

  // ── bs58 (Base58 = base-x with Bitcoin/Solana alphabet) ─────────────────
  var ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  var codec = baseX(ALPHABET);

  // Expose as window.bs58 for browser use
  root.bs58 = codec;

}(typeof window !== 'undefined' ? window : this));
