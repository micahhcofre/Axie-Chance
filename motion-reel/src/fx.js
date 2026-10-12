// Las herramientas de dibujo del reel: partículas resueltas en fórmula, tipografía que se
// mueve letra por letra, números, vigas de energía, anillos y humo.
//
// Ninguna partícula "vive": cada una es una parábola con arrastre evaluada en su edad,
// con sus azares sacados de un hash de su índice. Pedirle el cuadro 1243 dos veces da
// dos veces lo mismo, que es lo que el desenfoque de movimiento necesita.
import {
  TAU, E, clamp, hash, hr, lerp, mixHex, rgba, span,
} from './core.js';
import { glowDot, tex, tinted } from './assets.js';

export const FONT = {
  title: '"Lilita One", "Archivo", sans-serif',
  body: '"Archivo", sans-serif',
};

// ---- partículas ----

/**
 * La posición de una partícula lanzada con velocidad (vx, vy), arrastre `k` (1/s) y
 * gravedad `g` (px/s²) después de `a` segundos. Devuelve también su velocidad.
 */
export function ballistic(a, vx, vy, k, g) {
  if (k < 1e-4) {
    return [vx * a, vy * a + 0.5 * g * a * a, vx, vy + g * a];
  }
  const e = Math.exp(-k * a);
  const f = (1 - e) / k;
  return [vx * f, vy * f + (g / k) * (a - f), vx * e, vy * e + (g / k) * (1 - e)];
}

/**
 * Un estallido de chispas. `o`:
 *   x, y, n, seed, t0          dónde, cuántas, el azar y cuándo
 *   speed [a,b], life [a,b]    rapidez (px/s) y vida (s)
 *   dir, spread                hacia dónde (rad) y cuánto se abre
 *   drag, gravity              arrastre (1/s) y gravedad (px/s²)
 *   size [a,b], colors         grosor y paleta
 *   kind                       'streak' | 'dot' | 'star' | 'ember'
 *   stretch                    largo de la estela, en segundos de velocidad
 *   spawn                      cuánto se reparte el nacimiento (s)
 */
export function burst(x, t, o) {
  const {
    n = 30, seed = 1, t0 = 0, speed = [300, 900], life = [0.4, 0.9], dir = -Math.PI / 2,
    spread = TAU, drag = 3, gravity = 600, size = [2, 5], colors = ['#ffffff'], kind = 'streak',
    stretch = 0.035, spawn = 0, alpha = 1, radius = 0,
  } = o;
  if (t < t0) return;
  for (let i = 0; i < n; i++) {
    const birth = t0 + hash(seed, i, 7) * spawn;
    const a = t - birth;
    const lf = hr(life[0], life[1], seed, i, 3);
    if (a < 0 || a > lf) continue;
    const ang = dir + (hash(seed, i, 1) - 0.5) * spread;
    const sp = hr(speed[0], speed[1], seed, i, 2);
    const vx0 = Math.cos(ang) * sp;
    const vy0 = Math.sin(ang) * sp;
    const [dx, dy, vx, vy] = ballistic(a, vx0, vy0, drag, gravity);
    const r0 = radius * hash(seed, i, 9);
    const px = o.x + Math.cos(ang) * r0 + dx;
    const py = o.y + Math.sin(ang) * r0 + dy;
    const p = a / lf;
    const fade = (1 - p) ** 1.4 * Math.min(1, a / 0.03);
    const sz = hr(size[0], size[1], seed, i, 4) * (kind === 'ember' ? 1 : 1 - p * 0.5);
    const col = colors[Math.floor(hash(seed, i, 5) * colors.length)];
    x.globalAlpha = fade * alpha;
    if (kind === 'streak') {
      x.strokeStyle = col;
      x.lineWidth = sz;
      x.lineCap = 'round';
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(px - vx * stretch, py - vy * stretch);
      x.stroke();
    } else if (kind === 'star') {
      const s = sz * 6;
      const rot = hash(seed, i, 6) * TAU + a * 3;
      x.save();
      x.translate(px, py);
      x.rotate(rot);
      x.drawImage(tinted('Star_TX_FX', col), -s, -s, 2 * s, 2 * s);
      x.restore();
    } else {
      const s = sz * (kind === 'ember' ? 5 : 4);
      x.drawImage(glowDot(col, 0.55), px - s, py - s, 2 * s, 2 * s);
    }
  }
  x.globalAlpha = 1;
}

/** Un anillo que se abre: la onda de un golpe, dibujada (la deformación la pone el revelado). */
export function shockRing(x, t, t0, cx, cy, r1, color, dur = 0.5, width = 18, alpha = 1) {
  const p = span(t, t0, t0 + dur);
  if (p <= 0 || p >= 1) return;
  const r = lerp(r1 * 0.12, r1, E.outCubic(p));
  x.save();
  x.globalAlpha = (1 - p) ** 1.5 * alpha;
  x.strokeStyle = color;
  x.lineWidth = width * (1 - p * 0.7);
  x.beginPath();
  x.arc(cx, cy, r, 0, TAU);
  x.stroke();
  x.restore();
}

/** Un brillo redondo, aditivo. */
export function glow(x, cx, cy, r, color, alpha = 1, soft = 0.5) {
  if (alpha <= 0.002 || r <= 0.5) return;
  x.globalAlpha = Math.min(1, alpha);
  x.drawImage(glowDot(color, soft), cx - r, cy - r, 2 * r, 2 * r);
  x.globalAlpha = 1;
}

/** Un cuadro de una hoja de sprites de `cols` x `rows`. */
export function sheet(x, name, frame, cols, rows, cx, cy, w, h, alpha = 1, rot = 0, color = null) {
  const src = color ? tinted(name, color) : tex[name];
  if (!src) return;
  const f = Math.max(0, Math.min(cols * rows - 1, Math.floor(frame)));
  const fw = src.width / cols;
  const fh = src.height / rows;
  x.save();
  x.globalAlpha *= alpha;
  x.translate(cx, cy);
  if (rot) x.rotate(rot);
  x.drawImage(src, (f % cols) * fw, Math.floor(f / cols) * fh, fw, fh, -w / 2, -h / 2, w, h);
  x.restore();
}

/** Una bocanada de humo de dibujo animado (`SmokeStylize_TX`, 4x4). */
export function puff(x, t, t0, cx, cy, size, color = '#f3e3cf', dur = 0.55, seed = 1, n = 5) {
  if (t < t0 || t > t0 + dur + 0.2) return;
  for (let i = 0; i < n; i++) {
    const d = t0 + hash(seed, i) * 0.06;
    const p = span(t, d, d + dur);
    if (p <= 0 || p >= 1) continue;
    const ang = (i / n) * Math.PI + Math.PI + (hash(seed, i, 2) - 0.5) * 0.6;
    const dist = size * (0.35 + 0.65 * E.outCubic(p)) * hr(0.7, 1.2, seed, i, 3);
    const s = size * hr(0.45, 0.7, seed, i, 4) * (0.6 + 0.4 * p);
    sheet(x, 'SmokeStylize_TX', p * 15, 4, 4, cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist * 0.45 - p * size * 0.2,
      s, s, 0.5 * (1 - p), hash(seed, i, 5) * TAU, color);
  }
}

// ---- tipografía ----

/**
 * Texto que se mueve por letra. `o`:
 *   size, font ('title' | 'body'), weight, stretch, spacing (em)
 *   align ('center' | 'left' | 'right')
 *   fill (color o [arriba, abajo]), stroke, strokeW (em), shadow (em), glowColor
 *   anim(i, n, ch) → { dx, dy, sx, sy, rot, a } para cada letra
 */
export function kinetic(x, str, px, py, o = {}) {
  const {
    size = 100, font = 'title', weight = 400, stretch = 'normal', spacing = 0.02, align = 'center',
    fill = '#ffffff', stroke = '#1a0c1f', strokeW = 0.1, shadow = 0.07, anim = null, alpha = 1,
    shadowColor = 'rgba(8,4,16,0.55)',
  } = o;
  x.save();
  x.font = `${weight} ${size}px ${FONT[font]}`;
  x.fontStretch = stretch;
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
  // El gradiente va en coordenadas de la letra (la línea de base es y = 0): así sirve
  // igual para todas aunque cada una se mueva por su lado.
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
    const m = anim ? anim(i, chars.length, ch) : null;
    const a = (m?.a ?? 1) * alpha;
    if (a <= 0.003) continue;
    const cx = x0 + xs[i] + w / 2 + (m?.dx ?? 0);
    const cy = py - size * 0.35 + (m?.dy ?? 0);
    x.save();
    x.globalAlpha = a;
    x.translate(cx, cy);
    if (m?.rot) x.rotate(m.rot);
    x.scale(m?.sx ?? 1, m?.sy ?? 1);
    x.translate(-w / 2, size * 0.35);
    if (shadow) {
      x.fillStyle = shadowColor;
      x.strokeStyle = shadowColor;
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

/** Cuánto mide un texto con esas opciones, sin dibujarlo. */
export function measure(x, str, size, font = 'title', weight = 400, spacing = 0.02, stretch = 'normal') {
  x.save();
  x.font = `${weight} ${size}px ${FONT[font]}`;
  x.fontStretch = stretch;
  const w = x.measureText(str).width + spacing * size * ([...str].length - 1);
  x.restore();
  return w;
}

/** Las entradas de letras más usadas, listas para `kinetic`. */
export const IN = {
  /** Cae desde arriba con un rebote y se aplasta al tocar. */
  drop: (t, t0, stagger = 0.035, dist = 160, dur = 0.42) => (i) => {
    const p = span(t, t0 + i * stagger, t0 + i * stagger + dur);
    if (p <= 0) return { a: 0 };
    const land = span(p, 0.5, 1);
    const squash = land > 0 && land < 1 ? Math.sin(land * Math.PI) * (1 - land) * 0.5 : 0;
    return {
      dy: -dist * (1 - E.outBounce(p)),
      a: Math.min(1, p * 5),
      sx: 1 + squash * 0.5,
      sy: 1 - squash * 0.45,
    };
  },
  /** Golpea desde grande, como un sello. */
  slam: (t, t0, stagger = 0.03, from = 2.6, dur = 0.3) => (i) => {
    const p = span(t, t0 + i * stagger, t0 + i * stagger + dur);
    if (p <= 0) return { a: 0 };
    const s = lerp(from, 1, E.outExpo(p));
    const land = span(p, 0.55, 1);
    const squash = land > 0 && land < 1 ? Math.sin(land * Math.PI) * 0.12 : 0;
    return { sx: s * (1 + squash), sy: s * (1 - squash), a: Math.min(1, p * 3), rot: (1 - E.outExpo(p)) * (hash(i, 3) - 0.5) * 0.5 };
  },
  /** Sube desde abajo con un resorte. */
  rise: (t, t0, stagger = 0.03, dist = 80, dur = 0.5) => (i) => {
    const p = span(t, t0 + i * stagger, t0 + i * stagger + dur);
    if (p <= 0) return { a: 0 };
    return { dy: dist * (1 - E.outBackBig(p)), a: Math.min(1, p * 4), rot: (1 - E.outBack(p)) * 0.2 };
  },
  /** Aparece de a una, con un saltito. */
  pop: (t, t0, stagger = 0.06, dur = 0.22) => (i) => {
    const p = span(t, t0 + i * stagger, t0 + i * stagger + dur);
    if (p <= 0) return { a: 0 };
    const s = E.outBackBig(p);
    return { sx: s, sy: s, a: 1, dy: (1 - p) * 20 };
  },
};

/** Las salidas: se combinan con una entrada multiplicando alfa y sumando desplazamientos. */
export const OUT = {
  up: (t, t0, stagger = 0.02, dist = 90, dur = 0.28) => (i) => {
    const p = span(t, t0 + i * stagger, t0 + i * stagger + dur);
    return { dy: -dist * E.inCubic(p), a: 1 - E.inQuad(p), sx: 1 - p * 0.2, sy: 1 + p * 0.3 };
  },
  shrink: (t, t0, stagger = 0.015, dur = 0.25) => (i) => {
    const p = span(t, t0 + i * stagger, t0 + i * stagger + dur);
    const s = 1 - E.inBack(p);
    return { sx: Math.max(0, s), sy: Math.max(0, s), a: 1 - p * p };
  },
};

/** Junta una entrada y una salida. */
export const both = (fin, fout) => (i, n, ch) => {
  const a = fin(i, n, ch) ?? {};
  const c = fout ? fout(i, n, ch) ?? {} : {};
  return {
    dx: (a.dx ?? 0) + (c.dx ?? 0),
    dy: (a.dy ?? 0) + (c.dy ?? 0),
    sx: (a.sx ?? 1) * (c.sx ?? 1),
    sy: (a.sy ?? 1) * (c.sy ?? 1),
    rot: (a.rot ?? 0) + (c.rot ?? 0),
    a: (a.a ?? 1) * (c.a ?? 1),
  };
};

// ---- vigas ----

/**
 * La viga de energía que une dos símbolos iguales de cartas vecinas (las "vigas" de la
 * mesa, con esteroides). `p` es cuánto se dibujó (0 a 1), `heat` cuánto brilla.
 * `B` es la escena y `G` la capa emisiva.
 */
export function beam(B, G, x0, y0, x1, y1, color, t, { p = 1, heat = 1, bulge = -0.18, seed = 1, width = 1 } = {}) {
  if (p <= 0) return;
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const cx = mx + nx * len * bulge;
  const cy = my + ny * len * bulge;
  const pt = (u) => [
    (1 - u) ** 2 * x0 + 2 * (1 - u) * u * cx + u * u * x1,
    (1 - u) ** 2 * y0 + 2 * (1 - u) * u * cy + u * u * y1,
  ];
  const N = 28;
  const path = new Path2D();
  const upto = Math.max(1, Math.ceil(N * p));
  for (let i = 0; i <= upto; i++) {
    const u = Math.min(p, i / N);
    const [px, py] = pt(u);
    // un temblor eléctrico que se mueve con el tiempo
    const w = Math.sin(u * 19 + t * 23 + seed) * Math.sin(u * Math.PI) * 3.5 * heat;
    if (i === 0) path.moveTo(px + nx * w, py + ny * w);
    else path.lineTo(px + nx * w, py + ny * w);
  }
  B.save();
  B.lineCap = 'round';
  B.lineJoin = 'round';
  B.globalCompositeOperation = 'lighter';
  B.strokeStyle = rgba(color, 0.22 * heat);
  B.lineWidth = 22 * width;
  B.stroke(path);
  B.restore();
  G.save();
  G.lineCap = 'round';
  G.lineJoin = 'round';
  G.strokeStyle = rgba(color, 0.55 * heat);
  G.lineWidth = 9 * width;
  G.stroke(path);
  G.strokeStyle = rgba(mixHex(color, '#ffffff', 0.7), 0.9 * heat);
  G.lineWidth = 3 * width;
  G.stroke(path);
  // pulsos que viajan por la viga
  for (let k = 0; k < 3; k++) {
    const u = ((t * 1.6 + k / 3 + seed * 0.13) % 1) * p;
    const [px, py] = pt(u);
    glow(G, px, py, 16 * width, color, 0.9 * heat);
  }
  // la punta mientras se dibuja
  if (p < 1) {
    const [px, py] = pt(p);
    glow(G, px, py, 40 * width, color, 1);
    glow(G, px, py, 14 * width, '#ffffff', 1);
  }
  G.restore();
}

// ---- confeti ----

/** Papelitos que caen girando: cada uno es un rectángulo que se da vuelta (escala en x). */
export function confetti(x, t, o) {
  const {
    t0 = 0, n = 80, seed = 3, cx = 960, cy = 400, speed = [500, 1300], spread = Math.PI * 0.9,
    dir = -Math.PI / 2, gravity = 900, drag = 1.6, life = [1.6, 2.6], colors = ['#ffcc3d', '#4bb8f0', '#ff7bac', '#54cf8b', '#ff6a5c', '#a97cff'],
    size = [10, 18], spawn = 0.05, rain = false, width = 1920,
  } = o;
  if (t < t0) return;
  for (let i = 0; i < n; i++) {
    const birth = t0 + hash(seed, i, 11) * spawn;
    const a = t - birth;
    const lf = hr(life[0], life[1], seed, i, 12);
    if (a < 0 || a > lf) continue;
    let px;
    let py;
    if (rain) {
      px = hash(seed, i, 13) * width + Math.sin(a * 2.3 + i) * 30;
      py = -40 + a * hr(160, 320, seed, i, 14);
    } else {
      const ang = dir + (hash(seed, i, 15) - 0.5) * spread;
      const sp = hr(speed[0], speed[1], seed, i, 16);
      const [dx, dy] = ballistic(a, Math.cos(ang) * sp, Math.sin(ang) * sp, drag, gravity);
      px = cx + dx + Math.sin(a * 5 + i) * 18 * Math.min(1, a);
      py = cy + dy;
    }
    const s = hr(size[0], size[1], seed, i, 17);
    const flip = Math.cos(a * hr(6, 14, seed, i, 18) + i);
    const rot = a * hr(-6, 6, seed, i, 19) + i;
    const col = colors[i % colors.length];
    x.save();
    x.globalAlpha = Math.min(1, (lf - a) / 0.4);
    x.translate(px, py);
    x.rotate(rot);
    x.scale(flip, 1);
    x.fillStyle = flip > 0 ? col : mixHex(col, '#000000', 0.3);
    x.fillRect(-s / 2, -s * 0.32, s, s * 0.64);
    x.restore();
  }
}

// ---- utilidades de lienzo ----

export function clearCtx(x, color) {
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalAlpha = 1;
  x.globalCompositeOperation = 'source-over';
  x.filter = 'none';
  x.fillStyle = color;
  x.fillRect(0, 0, x.canvas.width, x.canvas.height);
}

/** Una foto cubriendo un rectángulo, con empuje (`zoom`) y corrimiento (`ox`, `oy` en 0..1). */
export function cover(x, im, rx, ry, rw, rh, zoom = 1, ox = 0.5, oy = 0.5) {
  const s = Math.max(rw / im.width, rh / im.height) * zoom;
  const w = im.width * s;
  const h = im.height * s;
  x.drawImage(im, rx + (rw - w) * ox, ry + (rh - h) * oy, w, h);
}

export { clamp };
