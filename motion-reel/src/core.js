// El núcleo del reel: el reloj, las curvas y el azar.
//
// Todo el reel es una función pura del segundo en el que está: `frame(t)` dibuja el
// cuadro entero sin memoria. Por eso se puede frenar, rebobinar, pedir `?t=20.6` y ver
// ese cuadro exacto, y —lo que importa— sacarle a Chrome sin cabeza los 3488 cuadros
// con desenfoque de movimiento de verdad: cada cuadro es el promedio de varios
// instantes dentro del obturador, y eso solo se puede si cualquier instante se puede
// dibujar por separado.

// El tamaño del cuadro. El reel es 1920×1080; la pelea en loop de la portada se exporta
// además parada (`?size=1080x1920`), y sus escenas se ubican contra `W` y `H`.
const SIZE = (globalThis.location ? new URLSearchParams(globalThis.location.search).get('size') : null)
  ?.split('x').map(Number);
export const W = SIZE?.[0] || 1920;
export const H = SIZE?.[1] || 1080;

/**
 * El pulso. A 128 negras por minuto el reel dura 124 tiempos: 31 compases de 4, 58
 * segundos. Todo lo que pasa cae en un tiempo o en una fracción simple de uno, así la
 * imagen y la música se cortan juntas.
 */
export const BPM = 128;
export const BEAT = 60 / BPM;
export const BEATS = 124;
export const DURATION = BEATS * BEAT;
/** Un tiempo, en segundos. `b(103)` es el tiempo 103: el drop. */
export const b = (n) => n * BEAT;

// ---- números ----

export const clamp = (v, a = 0, c = 1) => (v < a ? a : v > c ? c : v);
export const lerp = (a, c, p) => a + (c - a) * p;
export const mix = lerp;
/** Dónde está `t` en el tramo `a`→`c`, de 0 a 1. */
export const span = (t, a, c) => clamp((t - a) / (c - a || 1e-9));
/** Lo mismo en tiempos musicales. */
export const bspan = (t, a, c) => span(t, b(a), b(c));
export const smooth = (p) => p * p * (3 - 2 * p);
export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

/** Un valor que sube en `a`, se queda y baja en `d`: la envolvente de casi todo. */
export function window4(t, a, bb, c, d, ein = E.outCubic, eout = E.inCubic) {
  if (t <= a || t >= d) return 0;
  if (t < bb) return ein(span(t, a, bb));
  if (t <= c) return 1;
  return 1 - eout(span(t, c, d));
}

// ---- curvas ----

export const E = {
  lin: (p) => p,
  inQuad: (p) => p * p,
  outQuad: (p) => 1 - (1 - p) * (1 - p),
  inOutQuad: (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2),
  inCubic: (p) => p * p * p,
  outCubic: (p) => 1 - (1 - p) ** 3,
  inOutCubic: (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2),
  inQuart: (p) => p ** 4,
  outQuart: (p) => 1 - (1 - p) ** 4,
  inOutQuart: (p) => (p < 0.5 ? 8 * p ** 4 : 1 - (-2 * p + 2) ** 4 / 2),
  outQuint: (p) => 1 - (1 - p) ** 5,
  inQuint: (p) => p ** 5,
  inOutQuint: (p) => (p < 0.5 ? 16 * p ** 5 : 1 - (-2 * p + 2) ** 5 / 2),
  inExpo: (p) => (p <= 0 ? 0 : 2 ** (10 * p - 10)),
  outExpo: (p) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p)),
  inOutExpo: (p) => (p <= 0 ? 0 : p >= 1 ? 1
    : p < 0.5 ? 2 ** (20 * p - 10) / 2 : (2 - 2 ** (-20 * p + 10)) / 2),
  outCirc: (p) => Math.sqrt(1 - (p - 1) ** 2),
  inOutSine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  outSine: (p) => Math.sin((p * Math.PI) / 2),
  inSine: (p) => 1 - Math.cos((p * Math.PI) / 2),
  outBack: (p) => 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2,
  outBackBig: (p) => 1 + 3.6 * (p - 1) ** 3 + 2.6 * (p - 1) ** 2,
  inBack: (p) => 2.70158 * p ** 3 - 1.70158 * p * p,
  outElastic: (p) => (p <= 0 ? 0 : p >= 1 ? 1
    : 2 ** (-10 * p) * Math.sin((p * 10 - 0.75) * (TAU / 3)) + 1),
  outBounce: (p) => {
    const n = 7.5625;
    const d = 2.75;
    if (p < 1 / d) return n * p * p;
    if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
    if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
    return n * (p -= 2.625 / d) * p + 0.984375;
  },
};

/**
 * Una línea de tiempo de valores: `[[seg, valor, curva?], ...]`. Antes del primero y
 * después del último se queda quieta. Es lo mismo que una pista de After Effects.
 */
export function track(t, keys, ease = E.inOutCubic) {
  if (t <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last[1];
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (t <= k[0]) {
      const p = keys[i - 1];
      return lerp(p[1], k[1], (k[2] ?? ease)(span(t, p[0], k[0])));
    }
  }
  return last[1];
}

/** `track` con los tiempos escritos en tiempos musicales. */
export const btrack = (t, keys, ease) => track(t, keys.map(([k, v, e]) => [b(k), v, e]), ease);

/**
 * Un resorte resuelto: dónde está algo que salta de 0 a 1 en `t0` con un resorte de
 * frecuencia `f` (Hz) y amortiguación `z` (0 = rebota para siempre, 1 = crítico).
 * Cerrado en fórmula: no integra nada, así cualquier instante sale igual.
 */
export function spring(t, t0, f = 3, z = 0.35) {
  if (t <= t0) return 0;
  const x = t - t0;
  const w = TAU * f;
  if (z >= 1) return 1 - (1 + w * x) * Math.exp(-w * x);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + (z * w / wd) * Math.sin(wd * x));
}

/** Un golpe que se apaga oscilando: 0 antes, un pico en `t0` y de vuelta a 0. */
export function ring(t, t0, f = 8, decay = 6) {
  if (t < t0) return 0;
  const x = t - t0;
  return Math.sin(TAU * f * x) * Math.exp(-decay * x);
}

/** Un pulso que sube de golpe en `t0` y se va con la cola exponencial. */
export function pulse(t, t0, decay = 8, attack = 0.012) {
  if (t < t0 - attack) return 0;
  if (t < t0) return (t - (t0 - attack)) / attack;
  return Math.exp(-(t - t0) * decay);
}

// ---- azar determinista ----

/** Un número de 0 a 1 que sale siempre igual para los mismos enteros. */
export function hash(a, c = 0, d = 0) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h ^= Math.imul((c | 0) + 0x165667b1, 0xc2b2ae35);
  h ^= Math.imul((d | 0) + 0x27d4eb2f, 0x9e3779b1);
  h ^= h >>> 15; h = Math.imul(h, 0x2545f491); h ^= h >>> 13;
  h = Math.imul(h, 0x85ebca6b); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** Entre `a` y `c`. */
export const hr = (a, c, i, j = 0, k = 0) => a + (c - a) * hash(i, j, k);

/** Ruido suave de una dimensión (valor interpolado): para temblores y derivas. */
export function noise1(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i, seed) * 2 - 1, hash(i + 1, seed) * 2 - 1, u);
}
/** Ruido fractal: tres octavas del anterior. */
export const fbm = (x, seed = 0) => noise1(x, seed) * 0.6 + noise1(x * 2.13, seed + 7) * 0.28 + noise1(x * 4.7, seed + 13) * 0.12;

/** Un generador sembrado (mulberry32), para lo que se arma una sola vez al cargar. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- color ----

export function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgba = (hex, a = 1) => {
  const [r, g, bb] = hexRgb(hex);
  return `rgba(${r},${g},${bb},${a})`;
};
/** Mezcla dos colores hex. */
export function mixHex(h1, h2, p) {
  const a = hexRgb(h1);
  const c = hexRgb(h2);
  const m = a.map((v, i) => Math.round(lerp(v, c[i], p)));
  return `#${m.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Tiempo deformado: para las cámaras lentas. `keys` es la velocidad en el tiempo
 * (`[[seg, velocidad], ...]`); devuelve una función que da el tiempo "vivido" a partir
 * del tiempo de reloj, integrando la velocidad de antemano en una tabla.
 */
export function timeWarp(keys, from = 0, to = DURATION + 1, step = 1 / 2000) {
  const n = Math.ceil((to - from) / step) + 1;
  const acc = new Float64Array(n);
  let sum = from;
  for (let i = 0; i < n; i++) {
    acc[i] = sum;
    sum += track(from + i * step + step / 2, keys, E.lin) * step;
  }
  return (t) => {
    if (t <= from) return t;
    const x = (t - from) / step;
    const i = Math.min(n - 2, Math.floor(x));
    return lerp(acc[i], acc[i + 1], x - i);
  };
}
