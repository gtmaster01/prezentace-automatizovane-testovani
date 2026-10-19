'use strict';
/* ==========================================================================
   POMOCNÉ FUNKCE — matematika, easing, deterministická náhoda
   ========================================================================== */

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
/** Kde je x mezi a a b, oříznuto na 0..1 (pro časování animací). */
const inv = (a, b, x) => clamp((x - a) / (b - a), 0, 1);
/** Plynulé dorovnání hodnoty nezávislé na FPS. */
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

const ease = {
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  outExpo: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t) => {
    const c1 = 1.5, c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
};

/** Seedovaný generátor: animace vypadá při každém spuštění stejně. */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Kriticky tlumená pružina pro vektory (jako SmoothDamp v Unity).
 * Kamera díky ní plynule zrychlí i zpomalí a přerušený přelet nenaskočí.
 */
function smoothDamp(cur, target, vel, smoothTime, dt) {
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  for (const k of ['x', 'y', 'z']) {
    const change = cur[k] - target[k];
    const temp = (vel[k] + omega * change) * dt;
    vel[k] = (vel[k] - omega * temp) * exp;
    cur[k] = target[k] + (change + temp) * exp;
  }
}

/** Přešlo t přes značku m od minulého snímku? Počítá i s přetočením smyčky. */
function crossed(prev, cur, m) {
  return prev <= cur ? m > prev && m <= cur : m > prev || m <= cur;
}

/** Krok animace mezi klíčovými snímky [[t, ...hodnoty], ...]. */
function keyframes(frames, t, easing = ease.inOutCubic) {
  if (t <= frames[0][0]) return frames[0].slice(1);
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i];
    if (t <= b[0]) {
      const k = easing(inv(a[0], b[0], t));
      return a.slice(1).map((v, j) => lerp(v, b[j + 1], k));
    }
  }
  return frames[frames.length - 1].slice(1);
}
