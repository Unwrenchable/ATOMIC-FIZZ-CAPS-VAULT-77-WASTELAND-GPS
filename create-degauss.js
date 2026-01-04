import fs from "fs";
import WavEncoder from "wav-encoder";

const sampleRate = 44100;

// Utility to generate a buffer
function createBuffer(seconds) {
  return new Float32Array(Math.floor(seconds * sampleRate));
}

// Mix two buffers
function mix(a, b, gain = 1) {
  const out = new Float32Array(Math.max(a.length, b.length));
  for (let i = 0; i < out.length; i++) {
    const av = a[i] || 0;
    const bv = (b[i] || 0) * gain;
    out[i] = av + bv;
  }
  return out;
}

// Generate sine tone
function sine(freq, seconds, amp = 1) {
  const buf = createBuffer(seconds);
  for (let i = 0; i < buf.length; i++) {
    buf[i] = amp * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return buf;
}

// Generate exponential chirp
function chirp(startFreq, endFreq, seconds, amp = 1) {
  const buf = createBuffer(seconds);
  for (let i = 0; i < buf.length; i++) {
    const t = i / sampleRate;
    const k = Math.log(endFreq / startFreq) / seconds;
    const freq = startFreq * Math.exp(k * t);
    buf[i] = amp * Math.sin((2 * Math.PI * freq * t));
  }
  return buf;
}

// Generate noise
function noise(seconds, amp = 1) {
  const buf = createBuffer(seconds);
  for (let i = 0; i < buf.length; i++) {
    buf[i] = amp * (Math.random() * 2 - 1);
  }
  return buf;
}

// === BUILD THE CRT DEGAUSS SOUND ===

// 1. Magnetic thump
const thump = sine(55, 0.12, 0.9);

// 2. Coil snap (filtered noise)
const snap = noise(0.04, 0.4);

// 3. Sweep whoosh
const sweep = chirp(200, 1800, 0.35, 0.7);

// 4. EM shimmer tail
const shimmer = noise(0.25, 0.15);

// Mix layers
let final = thump;
final = mix(final, snap);
final = mix(final, sweep);
final = mix(final, shimmer, 0.5);

// Normalize
const max = Math.max(...final.map(Math.abs));
for (let i = 0; i < final.length; i++) {
  final[i] /= max * 1.05;
}

// Encode WAV
const audioData = {
  sampleRate,
  channelData: [final]
};

WavEncoder.encode(audioData).then(buffer => {
  fs.writeFileSync("degauss.wav", Buffer.from(buffer));
  console.log("✔ degauss.wav generated");
});
