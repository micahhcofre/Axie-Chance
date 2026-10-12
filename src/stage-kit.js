// Las herramientas de dibujo del escenario de efectos (ver `stage.js`), traídas del
// tráiler (`motion-reel/src/`): curvas, resortes, partículas resueltas en fórmula,
// anillos, vigas, humo, papelitos, letras que se mueven de a una, la carta que se rompe
// en pedazos y el zarpazo.
//
// Todo es una función de la edad del efecto: ninguna partícula "vive", cada una es una
// parábola con arrastre evaluada en su edad y con su azar sacado de un hash de su
// índice. Por eso un efecto se puede cortar, adelantar o dibujar dos veces igual.
//
// Los nombres llevan `fx` adelante: el archivo único (`scripts/build.mjs`) junta todos
// los módulos en un mismo ámbito, y `clamp` o `pulse` ya existen en otros.

export const FX_TAU = Math.PI * 2;

// ---- números ----

export const fxClamp = (v, a = 0, c = 1) => (v < a ? a : v > c ? c : v);
export const lerpFx = (a, c, p) => a + (c - a) * p;
/** Dónde está `t` en el tramo `a`→`c`, de 0 a 1. */
export const fxSpan = (t, a, c) => fxClamp((t - a) / (c - a || 1e-9));

export const EASE = {
  lin: (p) => p,
  inQuad: (p) => p * p,
  outQuad: (p) => 1 - (1 - p) * (1 - p),
  inCubic: (p) => p * p * p,
  outCubic: (p) => 1 - (1 - p) ** 3,
  inOutCubic: (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2),
  outQuart: (p) => 1 - (1 - p) ** 4,
  outExpo: (p) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p)),
  inOutSine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  outBack: (p) => 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2,
  outBackBig: (p) => 1 + 3.6 * (p - 1) ** 3 + 2.6 * (p - 1) ** 2,
  inBack: (p) => 2.70158 * p ** 3 - 1.70158 * p * p,
  outBounce: (p) => {
    const n = 7.5625;
    const d = 2.75;
    if (p < 1 / d) return n * p * p;
    if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
    if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
    return n * (p -= 2.625 / d) * p + 0.984375;
  },
};

/** Un resorte resuelto en fórmula: de 0 a 1 desde `t0`, frecuencia `f` y amortiguación `z`. */
export function fxSpring(t, t0, f = 3, z = 0.35) {
  if (t <= t0) return 0;
  const x = t - t0;
  const w = FX_TAU * f;
  if (z >= 1) return 1 - (1 + w * x) * Math.exp(-w * x);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * x) * (Math.cos(wd * x) + (z * w / wd) * Math.sin(wd * x));
}

/** Un golpe que se apaga oscilando. */
export function fxRing(t, t0, f = 8, decay = 6) {
  if (t < t0) return 0;
  const x = t - t0;
  return Math.sin(FX_TAU * f * x) * Math.exp(-decay * x);
}

/** Un pulso que sube de golpe en `t0` y se va con la cola exponencial. */
export function fxPulse(t, t0, decay = 8, attack = 0.012) {
  if (t < t0 - attack) return 0;
  if (t < t0) return (t - (t0 - attack)) / attack;
  return Math.exp(-(t - t0) * decay);
}

/** Un número de 0 a 1 que sale siempre igual para los mismos enteros. */
export function fxHash(a, c = 0, d = 0) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h ^= Math.imul((c | 0) + 0x165667b1, 0xc2b2ae35);
  h ^= Math.imul((d | 0) + 0x27d4eb2f, 0x9e3779b1);
  h ^= h >>> 15; h = Math.imul(h, 0x2545f491); h ^= h >>> 13;
  h = Math.imul(h, 0x85ebca6b); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export const fxRand = (a, c, i, j = 0, k = 0) => a + (c - a) * fxHash(i, j, k);

/** Ruido suave de una dimensión, para temblores. */
export function fxNoise(x, seed = 0) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerpFx(fxHash(i, seed) * 2 - 1, fxHash(i + 1, seed) * 2 - 1, u);
}

// ---- color ----

export function fxRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const fxRgba = (hex, a = 1) => {
  const [r, g, b] = fxRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};
export function fxMix(h1, h2, p) {
  const a = fxRgb(h1);
  const c = fxRgb(h2);
  return `#${a.map((v, i) => Math.round(lerpFx(v, c[i], p)).toString(16).padStart(2, '0')).join('')}`;
}

// ---- lienzos auxiliares, hechos una vez ----

function sprite(w, h) {
  if (typeof document === 'undefined' || !document.createElement) return null;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c.getContext ? c : null;
}

const dotCache = new Map();
/** Un brillo redondo de un color, hecho con gradiente. */
export function fxDot(hex, soft = 0.5) {
  const key = `${hex}|${soft}`;
  if (dotCache.has(key)) return dotCache.get(key);
  const c = sprite(128, 128);
  const x = c?.getContext('2d');
  if (x) {
    const [r, g, b] = fxRgb(hex);
    const grad = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grad.addColorStop(soft * 0.5, `rgba(${r},${g},${b},0.55)`);
    grad.addColorStop(soft, `rgba(${r},${g},${b},0.18)`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = grad;
    x.fillRect(0, 0, 128, 128);
  }
  dotCache.set(key, x ? c : null);
  return x ? c : null;
}

const starCache = new Map();
/** Una estrellita de cuatro puntas con brillo, del color pedido. */
export function fxStar(hex) {
  if (starCache.has(hex)) return starCache.get(hex);
  const c = sprite(96, 96);
  const x = c?.getContext('2d');
  if (x) {
    x.translate(48, 48);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 46);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.25, hex);
    g.addColorStop(1, fxRgba(hex, 0));
    x.fillStyle = g;
    x.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * FX_TAU - Math.PI / 2;
      const r = i % 2 ? 11 : 46;
      x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    x.closePath();
    x.fill();
  }
  starCache.set(hex, x ? c : null);
  return x ? c : null;
}

// ---- partículas ----

/** Posición y velocidad de algo lanzado con (vx, vy), arrastre `k` y gravedad `g` a los `a` segundos. */
export function fxBallistic(a, vx, vy, k, g) {
  if (k < 1e-4) return [vx * a, vy * a + 0.5 * g * a * a, vx, vy + g * a];
  const e = Math.exp(-k * a);
  const f = (1 - e) / k;
  return [vx * f, vy * f + (g / k) * (a - f), vx * e, vy * e + (g / k) * (1 - e)];
}

/**
 * Un estallido de chispas en `t0` desde (x, y). `kind`: 'streak' | 'dot' | 'star'.
 * `s` escala distancias y tamaños (la mesa se achica en pantallas chicas).
 */
export function fxBurst(x, t, o) {
  const {
    n = 24, seed = 1, t0 = 0, speed = [300, 900], life = [0.4, 0.9], dir = -Math.PI / 2,
    spread = FX_TAU, drag = 3, gravity = 600, size = [2, 5], colors = ['#ffffff'], kind = 'streak',
    stretch = 0.035, alpha = 1, s = 1,
  } = o;
  if (t < t0) return;
  for (let i = 0; i < n; i++) {
    const a = t - t0;
    const lf = fxRand(life[0], life[1], seed, i, 3);
    if (a < 0 || a > lf) continue;
    const ang = dir + (fxHash(seed, i, 1) - 0.5) * spread;
    const sp = fxRand(speed[0], speed[1], seed, i, 2) * s;
    const [dx, dy, vx, vy] = fxBallistic(a, Math.cos(ang) * sp, Math.sin(ang) * sp, drag, gravity * s);
    const px = o.x + dx;
    const py = o.y + dy;
    const p = a / lf;
    const fade = (1 - p) ** 1.4 * Math.min(1, a / 0.03);
    const sz = fxRand(size[0], size[1], seed, i, 4) * (1 - p * 0.5) * s;
    const col = colors[Math.floor(fxHash(seed, i, 5) * colors.length)];
    x.globalAlpha = fade * alpha;
    if (kind === 'streak') {
      x.strokeStyle = col;
      x.lineWidth = sz;
      x.lineCap = 'round';
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(px - vx * stretch, py - vy * stretch);
      x.stroke();
    } else {
      const img = kind === 'star' ? fxStar(col) : fxDot(col, 0.55);
      const r = sz * (kind === 'star' ? 6 : 4);
      if (img) x.drawImage(img, px - r, py - r, 2 * r, 2 * r);
    }
  }
  x.globalAlpha = 1;
}

/** Un anillo que se abre: la onda de un golpe. */
export function fxShock(x, t, t0, cx, cy, r1, color, dur = 0.5, width = 14, alpha = 1) {
  const p = fxSpan(t, t0, t0 + dur);
  if (p <= 0 || p >= 1) return;
  x.save();
  x.globalAlpha = (1 - p) ** 1.5 * alpha;
  x.strokeStyle = color;
  x.lineWidth = width * (1 - p * 0.7);
  x.beginPath();
  x.arc(cx, cy, lerpFx(r1 * 0.12, r1, EASE.outCubic(p)), 0, FX_TAU);
  x.stroke();
  x.restore();
}

/** Un brillo redondo. */
export function fxGlow(x, cx, cy, r, color, alpha = 1, soft = 0.5) {
  if (alpha <= 0.002 || r <= 0.5) return;
  const img = fxDot(color, soft);
  if (!img) return;
  x.globalAlpha = Math.min(1, alpha);
  x.drawImage(img, cx - r, cy - r, 2 * r, 2 * r);
  x.globalAlpha = 1;
}

/** Una bocanada de polvo: manchas suaves que se abren a los costados y se apagan. */
export function fxPuff(x, t, t0, cx, cy, size, color = '#f3e3cf', dur = 0.55, seed = 1, n = 6) {
  if (t < t0 || t > t0 + dur + 0.1) return;
  const img = fxDot(color, 0.8);
  if (!img) return;
  for (let i = 0; i < n; i++) {
    const p = fxSpan(t, t0, t0 + dur * fxRand(0.8, 1.1, seed, i));
    if (p <= 0 || p >= 1) continue;
    const ang = Math.PI + (i / (n - 1)) * Math.PI + (fxHash(seed, i, 2) - 0.5) * 0.4;
    const dist = size * (0.2 + 0.8 * EASE.outCubic(p)) * fxRand(0.7, 1.2, seed, i, 3);
    const r = size * fxRand(0.25, 0.4, seed, i, 4) * (0.6 + 0.6 * p);
    x.globalAlpha = 0.55 * (1 - p) ** 1.3;
    x.drawImage(img, cx + Math.cos(ang) * dist - r, cy + Math.sin(ang) * dist * 0.35 - r * 0.6 - p * size * 0.15, 2 * r, 1.2 * r);
  }
  x.globalAlpha = 1;
}

// ---- vigas ----

/**
 * La viga de energía que une dos símbolos iguales: una curva con temblor eléctrico,
 * pulsos que viajan y una punta encendida mientras se dibuja. `p` es cuánto se dibujó.
 */
export function fxBeam(G, x0, y0, x1, y1, color, t, { p = 1, heat = 1, bulge = -0.18, seed = 1, width = 1 } = {}) {
  if (p <= 0 || heat <= 0.003) return;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const cx = (x0 + x1) / 2 + nx * len * bulge;
  const cy = (y0 + y1) / 2 + ny * len * bulge;
  const pt = (u) => [
    (1 - u) ** 2 * x0 + 2 * (1 - u) * u * cx + u * u * x1,
    (1 - u) ** 2 * y0 + 2 * (1 - u) * u * cy + u * u * y1,
  ];
  const N = 22;
  const path = new Path2D();
  const upto = Math.max(1, Math.ceil(N * p));
  for (let i = 0; i <= upto; i++) {
    const u = Math.min(p, i / N);
    const [px, py] = pt(u);
    const w = Math.sin(u * 19 + t * 23 + seed) * Math.sin(u * Math.PI) * 3 * width * Math.min(1, heat);
    if (i === 0) path.moveTo(px + nx * w, py + ny * w);
    else path.lineTo(px + nx * w, py + ny * w);
  }
  G.save();
  G.lineCap = 'round';
  G.lineJoin = 'round';
  G.strokeStyle = fxRgba(color, Math.min(1, 0.08 * heat));
  G.lineWidth = 10 * width;
  G.stroke(path);
  G.strokeStyle = fxRgba(color, Math.min(1, 0.42 * heat));
  G.lineWidth = 4.2 * width;
  G.stroke(path);
  G.strokeStyle = fxRgba(fxMix(color, '#ffffff', 0.55), Math.min(1, 0.75 * heat));
  G.lineWidth = 1.8 * width;
  G.stroke(path);
  G.restore();
  for (let k = 0; k < 2; k++) {
    const u = ((t * 1.4 + k / 2 + seed * 0.13) % 1) * p;
    const [px, py] = pt(u);
    fxGlow(G, px, py, 10 * width, color, 0.6 * Math.min(1, heat));
  }
  if (p < 1) {
    const [px, py] = pt(p);
    fxGlow(G, px, py, 26 * width, color, 0.7);
    fxGlow(G, px, py, 9 * width, '#ffffff', 0.7);
  }
}

// ---- letras ----

/**
 * Las letras del lienzo, las mismas tres de `styles.css` (`--game`, `--rite`, `--text`).
 * `rite` es la talla de los carteles de resultado del kit: solo palabras que anuncian, grandes.
 */
export const FX_FONT = {
  title: '"Lilita One", "Work Sans", system-ui, sans-serif',
  rite: '"Caesar Dressing", "Lilita One", system-ui, sans-serif',
  body: '"Work Sans", system-ui, sans-serif',
};

/**
 * El lienzo no pide fuentes: dibuja con lo que ya está cargado y, si no, con la de
 * respaldo. La talla no la usa ningún texto de la página hasta el final de la partida,
 * así que el primer ¡SE CORTÓ! saldría en otra letra. Se pide una vez al armar el escenario.
 */
export function fxLoadFonts() {
  const fonts = globalThis.document?.fonts;
  if (!fonts?.load) return;
  for (const f of Object.values(FX_FONT)) fonts.load(`400 64px ${f}`).catch(() => {});
}

/**
 * Texto que se mueve por letra. `anim(i, n)` devuelve { dx, dy, sx, sy, rot, a } para
 * cada letra. `fill` puede ser un color o [arriba, …, abajo].
 */
export function fxText(x, str, px, py, o = {}) {
  const {
    size = 100, font = 'title', weight = 400, stretch = 'normal', spacing = 0.02, align = 'center',
    fill = '#ffffff', stroke = '#1a0c1f', strokeW = 0.1, shadow = 0.07, anim = null, alpha = 1,
  } = o;
  x.save();
  x.font = `${weight} ${size}px ${FX_FONT[font]}`;
  if ('fontStretch' in x) x.fontStretch = stretch;
  x.textBaseline = 'alphabetic';
  x.textAlign = 'left';
  x.lineJoin = 'round';
  x.miterLimit = 2;
  const chars = [...str];
  const sp = spacing * size;
  const xs = [];
  let acc = 0;
  for (let i = 0; i < chars.length; i++) {
    xs.push(acc);
    acc = x.measureText(chars.slice(0, i + 1).join('')).width + sp * (i + 1);
  }
  const total = acc - sp;
  const x0 = align === 'center' ? px - total / 2 : align === 'right' ? px - total : px;
  let fillStyle = fill;
  if (Array.isArray(fill)) {
    const g = x.createLinearGradient(0, -size * 0.74, 0, size * 0.04);
    fill.forEach((c, i) => g.addColorStop(i / (fill.length - 1), c));
    fillStyle = g;
  }
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === ' ') continue;
    const w = x.measureText(ch).width;
    const m = anim ? anim(i, chars.length) : null;
    const a = (m?.a ?? 1) * alpha;
    if (a <= 0.003) continue;
    x.save();
    x.globalAlpha = a;
    x.translate(x0 + xs[i] + w / 2 + (m?.dx ?? 0), py - size * 0.35 + (m?.dy ?? 0));
    if (m?.rot) x.rotate(m.rot);
    x.scale(m?.sx ?? 1, m?.sy ?? 1);
    x.translate(-w / 2, size * 0.35);
    if (shadow) {
      x.fillStyle = 'rgba(8,4,16,0.55)';
      x.strokeStyle = 'rgba(8,4,16,0.55)';
      x.lineWidth = strokeW * size * 2;
      if (strokeW) x.strokeText(ch, 0, shadow * size);
      x.fillText(ch, 0, shadow * size);
    }
    if (strokeW) {
      x.strokeStyle = stroke;
      x.lineWidth = strokeW * size * 2;
      x.strokeText(ch, 0, 0);
    }
    x.fillStyle = fillStyle;
    x.fillText(ch, 0, 0);
    x.restore();
  }
  x.restore();
  return total;
}

/** Cuánto mide un texto con esas opciones. */
export function fxMeasure(x, str, size, font = 'title', weight = 400, spacing = 0.02) {
  x.save();
  x.font = `${weight} ${size}px ${FX_FONT[font]}`;
  const w = x.measureText(str).width + spacing * size * ([...str].length - 1);
  x.restore();
  return w;
}

/** Entradas de letras. */
export const TEXT_IN = {
  /** Golpea desde grande, como un sello. */
  slam: (t, t0, stagger = 0.03, from = 2.6, dur = 0.3) => (i) => {
    const p = fxSpan(t, t0 + i * stagger, t0 + i * stagger + dur);
    if (p <= 0) return { a: 0 };
    const s = lerpFx(from, 1, EASE.outExpo(p));
    const land = fxSpan(p, 0.55, 1);
    const squash = land > 0 && land < 1 ? Math.sin(land * Math.PI) * 0.12 : 0;
    return { sx: s * (1 + squash), sy: s * (1 - squash), a: Math.min(1, p * 3), rot: (1 - EASE.outExpo(p)) * (fxHash(i, 3) - 0.5) * 0.5 };
  },
  /** Sube desde abajo con un resorte. */
  rise: (t, t0, stagger = 0.03, dist = 80, dur = 0.5) => (i) => {
    const p = fxSpan(t, t0 + i * stagger, t0 + i * stagger + dur);
    if (p <= 0) return { a: 0 };
    return { dy: dist * (1 - EASE.outBackBig(p)), a: Math.min(1, p * 4), rot: (1 - EASE.outBack(p)) * 0.2 };
  },
  /** Cae desde arriba con un rebote. */
  drop: (t, t0, stagger = 0.035, dist = 120, dur = 0.42) => (i) => {
    const p = fxSpan(t, t0 + i * stagger, t0 + i * stagger + dur);
    if (p <= 0) return { a: 0 };
    return { dy: -dist * (1 - EASE.outBounce(p)), a: Math.min(1, p * 5) };
  },
};

/** Salidas de letras. */
export const TEXT_OUT = {
  up: (t, t0, stagger = 0.02, dist = 70, dur = 0.26) => (i) => {
    const p = fxSpan(t, t0 + i * stagger, t0 + i * stagger + dur);
    return { dy: -dist * EASE.inCubic(p), a: 1 - EASE.inQuad(p), sx: 1 - p * 0.2, sy: 1 + p * 0.3 };
  },
  shrink: (t, t0, stagger = 0.015, dur = 0.24) => (i) => {
    const p = fxSpan(t, t0 + i * stagger, t0 + i * stagger + dur);
    const s = Math.max(0, 1 - EASE.inBack(p));
    return { sx: s, sy: s, a: 1 - p * p };
  },
};

/** Junta una entrada y una salida. */
export const fxBoth = (fin, fout) => (i, n) => {
  const a = fin(i, n) ?? {};
  const c = fout ? fout(i, n) ?? {} : {};
  return {
    dx: (a.dx ?? 0) + (c.dx ?? 0),
    dy: (a.dy ?? 0) + (c.dy ?? 0),
    sx: (a.sx ?? 1) * (c.sx ?? 1),
    sy: (a.sy ?? 1) * (c.sy ?? 1),
    rot: (a.rot ?? 0) + (c.rot ?? 0),
    a: (a.a ?? 1) * (c.a ?? 1),
  };
};

// ---- golpes ----

/** El zarpazo: tres tajos curvos que se dibujan de una punta a la otra y se apagan. */
export function fxClaws(B, G, t, t0, cx, cy, color = '#ff9a3c', k = 1, dir = 1) {
  for (let n = 0; n < 3; n++) {
    const d0 = t0 + n * 0.03;
    const draw = EASE.outCubic(fxSpan(t, d0, d0 + 0.1));
    const fade = 1 - fxSpan(t, d0 + 0.12, d0 + 0.42);
    if (draw <= 0 || fade <= 0) continue;
    const off = (n - 1) * 60 * k;
    const x0 = cx - 140 * k * dir + off;
    const y0 = cy - 175 * k;
    const x1 = cx + 100 * k * dir + off;
    const y1 = cy + 140 * k;
    const mx = cx + 55 * k * dir + off;
    const my = cy - 85 * k;
    const pt = (u) => [(1 - u) ** 2 * x0 + 2 * (1 - u) * u * mx + u * u * x1, (1 - u) ** 2 * y0 + 2 * (1 - u) * u * my + u * u * y1];
    const N = 20;
    const left = [];
    const right = [];
    for (let i = 0; i <= N; i++) {
      const u = (i / N) * draw;
      const [px, py] = pt(u);
      const [qx, qy] = pt(Math.min(1, u + 0.01));
      const len = Math.hypot(qx - px, qy - py) || 1;
      const nx = -(qy - py) / len;
      const ny = (qx - px) / len;
      const w = Math.sin(Math.PI * (i / N)) * 15 * k * fade;
      left.push([px + nx * w, py + ny * w]);
      right.push([px - nx * w, py - ny * w]);
    }
    const path = new Path2D();
    [...left, ...right.reverse()].forEach(([px, py], i) => (i ? path.lineTo(px, py) : path.moveTo(px, py)));
    path.closePath();
    G.save();
    G.globalAlpha = fade;
    G.fillStyle = color;
    G.fill(path);
    G.restore();
    B.save();
    B.globalAlpha = fade;
    B.fillStyle = '#fff8ea';
    B.fill(path);
    B.restore();
  }
}

/** Papelitos que caen girando. */
export function fxConfetti(x, t, o) {
  const {
    t0 = 0, n = 80, seed = 3, cx = 0, cy = 0, speed = [500, 1300], spread = Math.PI * 0.9, dir = -Math.PI / 2,
    gravity = 900, drag = 1.6, life = [1.6, 2.6], size = [8, 14], s = 1,
    colors = ['#ffcc3d', '#4bb8f0', '#ff7bac', '#54cf8b', '#ff6a5c', '#a97cff'],
  } = o;
  if (t < t0) return;
  for (let i = 0; i < n; i++) {
    const a = t - t0 - fxHash(seed, i, 11) * 0.05;
    const lf = fxRand(life[0], life[1], seed, i, 12);
    if (a < 0 || a > lf) continue;
    const ang = dir + (fxHash(seed, i, 15) - 0.5) * spread;
    const sp = fxRand(speed[0], speed[1], seed, i, 16) * s;
    const [dx, dy] = fxBallistic(a, Math.cos(ang) * sp, Math.sin(ang) * sp, drag, gravity * s);
    const w = fxRand(size[0], size[1], seed, i, 17) * s;
    const flip = Math.cos(a * fxRand(6, 14, seed, i, 18) + i);
    const col = colors[i % colors.length];
    x.save();
    x.globalAlpha = Math.min(1, (lf - a) / 0.4);
    x.translate(cx + dx + Math.sin(a * 5 + i) * 14 * s, cy + dy);
    x.rotate(a * fxRand(-6, 6, seed, i, 19) + i);
    x.scale(flip, 1);
    x.fillStyle = flip > 0 ? col : fxMix(col, '#000000', 0.3);
    x.fillRect(-w / 2, -w * 0.32, w, w * 0.64);
    x.restore();
  }
}

// ---- la carta que se rompe ----

/** Las piezas de un rectángulo de 1 x 1.4 roto: celdas de Voronoi sembradas, una vez. */
export const FX_SHARDS = (() => {
  const W = 1;
  const H = 1.4;
  const seeds = [];
  for (let i = 0; i < 8; i++) seeds.push([fxRand(-0.45, 0.45, 301, i), fxRand(-0.65, 0.65, 302, i)]);
  const rect = [[-W / 2, -H / 2], [W / 2, -H / 2], [W / 2, H / 2], [-W / 2, H / 2]];
  const cut = (poly, a, c) => {
    const mx = (a[0] + c[0]) / 2;
    const my = (a[1] + c[1]) / 2;
    const nx = c[0] - a[0];
    const ny = c[1] - a[1];
    const side = (p) => (p[0] - mx) * nx + (p[1] - my) * ny;
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const dp = side(p);
      const dq = side(q);
      if (dp <= 0) out.push(p);
      if ((dp <= 0) !== (dq <= 0)) {
        const k = dp / (dp - dq);
        out.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]);
      }
    }
    return out;
  };
  return seeds.map((s, i) => {
    let poly = rect;
    seeds.forEach((o, j) => { if (j !== i) poly = cut(poly, s, o); });
    const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length;
    const cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
    return { cx, cy, pts: poly.map(([x, y]) => [x - cx, y - cy]) };
  });
})();

/**
 * Rompe en pedazos lo que dibuja `img` (un lienzo con la carta) centrado en (x, y) con
 * `w` de ancho. Los pedazos salen para afuera, giran, caen y se apagan.
 */
export function fxShatter(B, img, t, t0, x, y, w, seed, force = 1) {
  const a = t - t0;
  if (a < 0 || !img) return;
  const alpha = 1 - fxSpan(a, 0.55, 1.2);
  if (alpha <= 0) return;
  const h = w * 1.4;
  for (let i = 0; i < FX_SHARDS.length; i++) {
    const sh = FX_SHARDS[i];
    const ang = Math.atan2(sh.cy, sh.cx) + (fxHash(seed, i) - 0.5) * 0.8;
    const sp = fxRand(1.2, 3.4, seed, i, 2) * w * force;
    const dx = Math.cos(ang) * sp * a;
    const dy = Math.sin(ang) * sp * a - 1.9 * w * a * force + 7.5 * w * a * a;
    B.save();
    B.globalAlpha *= alpha;
    B.translate(x + sh.cx * w + dx, y + sh.cy * w + dy);
    B.rotate((fxHash(seed, i, 3) - 0.5) * 9 * a);
    B.beginPath();
    sh.pts.forEach(([px, py], k) => (k ? B.lineTo(px * w, py * w) : B.moveTo(px * w, py * w)));
    B.closePath();
    B.save();
    B.clip();
    B.drawImage(img, -sh.cx * w - w / 2, -sh.cy * w - h / 2, w, h);
    B.restore();
    B.lineWidth = 1.5;
    B.strokeStyle = 'rgba(255,235,215,0.55)';
    B.stroke();
    B.restore();
  }
}
