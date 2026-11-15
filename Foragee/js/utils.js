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
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  },

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
  collect() {
    this.tone(660, 0.08, 'sine', 0.04, 880);
    this.tone(990, 0.12, 'sine', 0.025, 1180, 0.06);
  },
  coin() {
    this.tone(880, 0.07, 'triangle', 0.04, 880);
    this.tone(1320, 0.12, 'triangle', 0.035, 1320, 0.07);
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
  sleep() {
    [392, 330, 262].forEach((f, i) => this.tone(f, 0.34, 'sine', 0.028, f, i * 0.16));
  },
  nightfall() {
    this.tone(330, 0.5, 'sine', 0.02, 262);
    this.tone(220, 0.7, 'sine', 0.018, 196, 0.12);
  },
};
