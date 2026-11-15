'use strict';

const TAU = Math.PI * 2;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;

function smoothstep(t) {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function pointInEllipse(x, y, cx, cy, rx, ry) {
  const nx = (x - cx) / rx;
  const ny = (y - cy) / ry;
  return nx * nx + ny * ny <= 1;
}

function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
  };
}

function formatTime(hours) {
  const h = ((hours % 24) + 24) % 24;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Rounded rectangle path. */
function rr(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}

function blob(ctx, x, y, rx, ry, rot, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
  ctx.fill();
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + amount, 0, 255);
  const g = clamp(((n >> 8) & 255) + amount, 0, 255);
  const b = clamp((n & 255) + amount, 0, 255);
  return `rgb(${r},${g},${b})`;
}

/** Tiny WebAudio synth — no assets, no dependencies. */
const Sound = {
  ctx: null,
  muted: false,
  rainLevel: 0,
  rain: null,
  ambienceStarted: false,
  ambienceTimer: null,

  ensure() {
    if (this.muted) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        this.ctx = new AC();
      } catch (err) {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.rainLevel > 0 && !this.rain) this.setRain(this.rainLevel);
    return this.ctx;
  },

  tone(freq, dur = 0.12, type = 'sine', vol = 0.04, slideTo = freq, delay = 0) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (slideTo !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  },

  /* ---------- weather noise ---------- */

  buildRain() {
    const ctx = this.ctx;
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * 2);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.035 * white) / 1.035;
      data[i] = last * 4.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 950;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
    this.rain = { gain };
  },

  setRain(level) {
    level = clamp(level, 0, 1);
    this.rainLevel = level;
    if (!this.ctx) return;
    if (!this.rain) this.buildRain();
    if (!this.rain) return;
    const target = this.muted ? 0 : level * 0.045;
    this.rain.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.7);
  },

  /* ---------- effects ---------- */

  chop() {
    this.tone(150, 0.09, 'triangle', 0.05, 92);
    this.tone(340, 0.05, 'square', 0.015, 170);
  },
  mine() {
    this.tone(200, 0.07, 'square', 0.025, 120);
    this.tone(720, 0.04, 'triangle', 0.02, 560);
  },
  rustle() {
    this.tone(420, 0.09, 'sine', 0.02, 260);
  },
  buzz() {
    this.tone(118, 0.34, 'sawtooth', 0.012, 92);
    this.tone(168, 0.3, 'sawtooth', 0.008, 132, 0.05);
  },
  splash() {
    this.tone(340, 0.16, 'sine', 0.03, 120);
    this.tone(940, 0.1, 'triangle', 0.012, 320, 0.02);
  },
  collect() {
    this.tone(660, 0.08, 'sine', 0.04, 880);
    this.tone(990, 0.12, 'sine', 0.025, 1180, 0.06);
  },
  coin() {
    this.tone(880, 0.07, 'triangle', 0.04, 880);
    this.tone(1320, 0.12, 'triangle', 0.035, 1320, 0.07);
  },
  fanfare() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.26, 'sine', 0.03, f, i * 0.08));
  },
  craft() {
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.2, 'sine', 0.03, f, i * 0.07));
  },
  eat() {
    this.tone(300, 0.1, 'triangle', 0.04, 200);
    this.tone(520, 0.1, 'sine', 0.03, 620, 0.1);
  },
  error() {
    this.tone(170, 0.16, 'sawtooth', 0.025, 108);
  },
  click() {
    this.tone(520, 0.05, 'sine', 0.022, 640);
  },
  page() {
    this.tone(330, 0.06, 'triangle', 0.016, 430);
  },
  step() {
    this.tone(118, 0.045, 'triangle', 0.007, 82);
  },
  sleep() {
    [392, 330, 262].forEach((f, i) => this.tone(f, 0.34, 'sine', 0.028, f, i * 0.16));
  },
  nightfall() {
    this.tone(330, 0.5, 'sine', 0.02, 262);
    this.tone(220, 0.7, 'sine', 0.018, 196, 0.12);
  },
  bird() {
    const base = 1900 + Math.random() * 900;
    this.tone(base, 0.08, 'sine', 0.011, base * 1.35);
    this.tone(base * 1.2, 0.07, 'sine', 0.009, base * 0.82, 0.09);
    if (Math.random() < 0.6) this.tone(base * 0.92, 0.1, 'sine', 0.007, base * 1.18, 0.18);
  },
  cricket() {
    for (let i = 0; i < 3; i++) this.tone(2500, 0.035, 'triangle', 0.006, 2350, i * 0.075);
  },

  /** Slow, very quiet generative pad to fill the forest. */
  pad() {
    if (this.muted) return;
    const scale = [196, 220, 246.94, 293.66, 329.63, 392];
    const f = scale[Math.floor(Math.random() * scale.length)] * (Math.random() < 0.3 ? 2 : 1);
    this.tone(f, 3.4, 'sine', 0.0075, f);
    this.tone(f * 1.5, 2.8, 'sine', 0.0042, f * 1.5, 0.3);
  },

  startAmbience() {
    if (this.ambienceStarted) return;
    this.ambienceStarted = true;
    const loop = () => {
      this.pad();
      this.ambienceTimer = setTimeout(loop, 5200 + Math.random() * 6200);
    };
    this.ambienceTimer = setTimeout(loop, 2600);
  },
};
