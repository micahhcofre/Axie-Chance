// Las piezas que comparten todas las escenas: la cámara, las cartas, los números, las
// barras de vida, los subtítulos, la carta que se rompe en pedazos y el zarpazo.
import {
  W, H, clamp, lerp, span, E, spring, ring, pulse, hash, hr, TAU, mixHex, rgba,
} from './core.js';
import {
  img, tinted, glowDot, CLASSES, cardSprite, wellsOf, crest, crestRadius, roundRect, CARD_W, CARD_H, canvas,
} from './assets.js';
import {
  burst, glow, kinetic, measure, IN, OUT, both,
} from './fx.js';

// ---- cámara ----

export function applyCam(x, cam) {
  x.translate(W / 2, H / 2);
  if (cam.r) x.rotate(cam.r);
  x.scale(cam.z, cam.z);
  x.translate(-cam.x, -cam.y);
}

/** Dónde cae en la pantalla un punto del mundo. */
export function toScreen(cam, wx, wy) {
  const dx = (wx - cam.x) * cam.z;
  const dy = (wy - cam.y) * cam.z;
  const c = Math.cos(cam.r ?? 0);
  const s = Math.sin(cam.r ?? 0);
  return [W / 2 + dx * c - dy * s, H / 2 + dx * s + dy * c];
}

/** Y al revés: qué punto del mundo está en ese lugar de la pantalla. */
export function toWorld(cam, sx, sy) {
  const dx = sx - W / 2;
  const dy = sy - H / 2;
  const c = Math.cos(-(cam.r ?? 0));
  const s = Math.sin(-(cam.r ?? 0));
  return [cam.x + (dx * c - dy * s) / cam.z, cam.y + (dx * s + dy * c) / cam.z];
}

// ---- cartas ----

/**
 * Una carta: el cuerpo pintado y los medallones aparte, para poder encenderlos.
 *   lit(sym)     cuánto brilla el medallón de ese símbolo
 *   dim(sym)     cuánto se ve (los símbolos que no suman se apagan)
 *   crestPop     escala de cada medallón (para que salten al llegar)
 *   flip         giro sobre el eje vertical (π = de espaldas)
 *   chip         el amuleto del poder: { power, cls, pop }
 */
export function card(B, G, symbols, o) {
  const {
    x = 0, y = 0, s = 1, rot = 0, sx = 1, sy = 1, alpha = 1, lit = null, dim = null, crestPop = null,
    flip = 0, heat = 0, back = false, crack = 0, chip = null, shadow = 0.55,
  } = o;
  if (alpha <= 0.003) return;
  const cf = Math.cos(flip);
  const showBack = back || cf < 0;
  B.save();
  B.globalAlpha *= alpha;
  B.translate(x, y);
  B.rotate(rot);
  B.scale(s * sx * Math.max(0.02, Math.abs(cf)), s * sy);
  if (shadow > 0) {
    B.save();
    B.globalAlpha *= shadow;
    B.drawImage(glowDot('#000000', 0.7), -CARD_W * 0.75, -CARD_H * 0.62 + 26, CARD_W * 1.5, CARD_H * 1.3);
    B.restore();
  }
  const spr = showBack ? cardSprite([], { back: true }) : cardSprite(symbols, { empty: true });
  const w = spr.width / 2;
  const h = spr.height / 2;
  B.drawImage(spr, -w / 2, -h / 2, w, h);
  if (!showBack) {
    const wells = wellsOf(symbols.length);
    symbols.forEach((sym, i) => {
      const wl = wells[i];
      const pop = crestPop ? crestPop(i, sym) : 1;
      if (pop <= 0.001) return;
      const r = crestRadius(wl) * pop;
      const hot = lit ? lit(sym, i) : 0;
      const see = dim ? dim(sym, i) : 1;
      B.save();
      B.globalAlpha *= see;
      if (hot > 0) {
        B.save();
        B.globalCompositeOperation = 'lighter';
        B.globalAlpha *= Math.min(0.75, 0.45 * hot);
        B.drawImage(glowDot(CLASSES[sym].color, 0.5), wl.x - r * 2.2, wl.y - r * 2.2, r * 4.4, r * 4.4);
        B.restore();
      }
      crest(B, sym, wl.x, wl.y, r);
      if (see < 0.999) {
        // lo que no suma se apaga: un velo de madera encima del medallón
        B.globalAlpha = (1 - see) * 0.55 * alpha;
        B.fillStyle = '#2a1a10';
        B.beginPath();
        B.arc(wl.x, wl.y, r * 1.02, 0, TAU);
        B.fill();
      }
      B.restore();
    });
    if (chip && chip.pop > 0.001) {
      // el amuleto del poder, en su chapa redonda arriba a la derecha
      const cr = 46 * chip.pop;
      const cx = CARD_W / 2 - 22;
      const cy = -CARD_H / 2 + 24;
      const col = CLASSES[chip.cls].color;
      B.save();
      B.fillStyle = 'rgba(10,6,4,0.6)';
      B.beginPath(); B.arc(cx, cy + 4, cr + 4, 0, TAU); B.fill();
      const g = B.createRadialGradient(cx, cy - cr * 0.3, cr * 0.1, cx, cy, cr);
      g.addColorStop(0, mixHex(col, '#ffffff', 0.35));
      g.addColorStop(1, mixHex(col, '#1a0a14', 0.35));
      B.fillStyle = g;
      B.beginPath(); B.arc(cx, cy, cr, 0, TAU); B.fill();
      B.lineWidth = 4;
      B.strokeStyle = '#fff2d0';
      B.stroke();
      if (!chip.hideIcon) amulet(B, chip.power, cx, cy, cr * 1.5);
      B.restore();
    }
  }
  const sheen = Math.abs(Math.sin(flip)) * 0.5 + heat * 0.8;
  if (sheen > 0.01) {
    B.save();
    roundRect(B, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 22);
    B.clip();
    B.globalCompositeOperation = 'lighter';
    B.globalAlpha = Math.min(1, sheen) * 0.5 * alpha;
    const g = B.createLinearGradient(-CARD_W / 2, 0, CARD_W / 2, 0);
    g.addColorStop(0, 'rgba(255,240,210,0)');
    g.addColorStop(0.5, 'rgba(255,240,210,0.9)');
    g.addColorStop(1, 'rgba(255,240,210,0)');
    B.fillStyle = g;
    B.fillRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H);
    B.restore();
  }
  if (crack > 0) {
    B.save();
    roundRect(B, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 22);
    B.clip();
    B.globalAlpha = crack;
    B.drawImage(tinted('Crack_TX', '#ffe9e0'), -CARD_W * 0.8, -CARD_W * 0.8 + 10, CARD_W * 1.6, CARD_W * 1.6);
    B.restore();
  }
  B.restore();
  if (heat > 0.01 && G) {
    G.save();
    G.translate(x, y);
    G.rotate(rot);
    G.scale(s * sx * Math.max(0.02, Math.abs(cf)), s * sy);
    G.globalAlpha = Math.min(1, heat) * alpha;
    roundRect(G, -CARD_W / 2 - 3, -CARD_H / 2 - 3, CARD_W + 6, CARD_H + 6, 24);
    G.lineWidth = 5;
    G.strokeStyle = o.heatColor ?? '#ffd08a';
    G.stroke();
    G.restore();
  }
}

/** Dónde queda el símbolo `sym` de una carta en (x, y) con escala `s` y giro `rot`. */
export function wellPos(symbols, sym, x, y, s = 1, rot = 0) {
  const i = symbols.indexOf(sym);
  const wl = wellsOf(symbols.length)[Math.max(0, i)];
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  return [x + (wl.x * c - wl.y * sn) * s, y + (wl.x * sn + wl.y * c) * s];
}

/** El dibujo de un amuleto de `Icons/`, centrado, con `h` de alto. */
export function amulet(x, power, cx, cy, h, rot = 0, alpha = 1) {
  const im = img[`power:${power}`];
  if (!im || alpha <= 0.003) return;
  const k = h / Math.max(im.width, im.height);
  x.save();
  x.globalAlpha *= alpha;
  x.translate(cx, cy);
  if (rot) x.rotate(rot);
  x.drawImage(im, (-im.width * k) / 2, (-im.height * k) / 2, im.width * k, im.height * k);
  x.restore();
}

// ---- números ----

export const NUM_STYLE = {
  beast: { fill: ['#fffdf0', '#ffd65c', '#ff8a1c'], stroke: '#3a1204', glow: '#ff9a2a', ink: '#ffcf6a' },
  aquatic: { fill: ['#f4feff', '#86e3ff', '#1f8fd6'], stroke: '#06223e', glow: '#3fb4ff', ink: '#8fe0ff' },
  zero: { fill: ['#ffffff', '#d0d0dc', '#80808f'], stroke: '#15151f', glow: '#ff4040', ink: '#ffb0a8' },
  red: { fill: ['#ffffff', '#ffd2c8', '#ff3d2e'], stroke: '#3a0606', glow: '#ff3d2e', ink: '#ffb0a8' },
  gold: { fill: ['#fffef4', '#ffe27a', '#ffae2a'], stroke: '#3a1a02', glow: '#ffc24a', ink: '#ffe08a' },
  heal: { fill: ['#f6fff0', '#b6ff8a', '#34c24a'], stroke: '#08300c', glow: '#5cff7a', ink: '#b6ff8a' },
  poison: { fill: ['#fbf2ff', '#e0a6ff', '#9a3fe0'], stroke: '#2a0a40', glow: '#b45cff', ink: '#e0a6ff' },
  pink: { fill: ['#fff4fa', '#ffb0d4', '#ff4f96'], stroke: '#40061f', glow: '#ff6aa8', ink: '#ffb0d4' },
};

/**
 * El número del daño con su etiqueta y, debajo, la cuenta que lo explica ("5 × 5").
 * `keys`: [[t, valor, cuenta?], ...]: el número cambia en cada tiempo con un golpe.
 */
export function numberHud(B, G, t, px, py, size, keys, style, label, o = {}) {
  let cur = null;
  let prev = null;
  let tc = -1;
  let formula = null;
  for (const [kt, v, f] of keys) {
    if (t >= kt) { prev = cur; cur = v; tc = kt; formula = f ?? null; }
  }
  if (cur === null) return;
  const S = NUM_STYLE[style];
  const a = t - tc;
  const big = prev === null || Math.abs(cur - prev) > 1;
  const punch = 1 + (big ? 0.5 : 0.1) * Math.exp(-a * (big ? 9 : 22)) * Math.cos(a * 18) * (a < 0.6 ? 1 : 0);
  const alpha = o.alpha ?? 1;
  const enter = o.enter ?? 1;
  if (label) {
    kinetic(B, label, px, py - size * 0.86, {
      size: Math.max(20, size * 0.17), font: 'body', weight: 900, stretch: 'expanded', spacing: 0.34,
      fill: 'rgba(255,255,255,0.88)', strokeW: 0, shadow: 0.1, alpha: alpha * enter,
    });
  }
  if (prev !== null && big && a < 0.28) {
    const p = a / 0.28;
    kinetic(B, String(prev), px, py - p * size * 0.5, {
      size, fill: S.fill, stroke: S.stroke, strokeW: 0.075, alpha: (1 - p) * alpha * 0.8,
      anim: () => ({ sx: 1 - p * 0.3, sy: 1 - p * 0.3 }),
    });
  }
  glow(G, px, py - size * 0.33, size * 1.1, S.glow, 0.14 * alpha * (0.5 + 0.9 * Math.exp(-a * 5)));
  kinetic(B, String(cur), px, py, {
    size, fill: S.fill, stroke: S.stroke, strokeW: 0.075, shadow: 0.06, alpha,
    anim: () => ({ sx: punch * enter, sy: punch * enter, a: Math.min(1, a / 0.05) }),
  });
  if (formula) {
    const fp = E.outBack(clamp((a - 0.06) / 0.22));
    kinetic(B, formula, px, py + size * 0.42, {
      size: size * 0.3, font: 'body', weight: 900, stretch: 'expanded', spacing: 0.08,
      fill: S.ink, stroke: 'rgba(10,4,2,0.85)', strokeW: 0.12, shadow: 0.05, alpha: alpha * clamp(a / 0.12),
      anim: () => ({ sx: fp, sy: fp }),
    });
  }
}

const numCache = new Map();
/** El número pintado en un lienzo aparte, para poder romperlo en pedazos. */
export function numberSprite(str, size, style) {
  const key = `${str}|${size}|${style}`;
  let c = numCache.get(key);
  if (c) return c;
  const S = NUM_STYLE[style];
  c = canvas(size * 2.2, size * 1.4);
  const x = c.getContext('2d');
  kinetic(x, str, c.width / 2, size * 1.05, { size, fill: S.fill, stroke: S.stroke, strokeW: 0.075, shadow: 0.06 });
  numCache.set(key, c);
  return c;
}

/** Un número de golpe o de cura que salta sobre un Axie y se va flotando. */
export function popNumber(B, G, t, t0, str, x, y, style, size = 120, life = 1.1) {
  const a = t - t0;
  if (a < 0 || a > life) return;
  const S = NUM_STYLE[style];
  const rise = E.outCubic(clamp(a / life)) * size * 0.9;
  const fade = 1 - span(a, life * 0.7, life);
  glow(G, x, y - size * 0.35 - rise, size * 0.9, S.glow, 0.25 * fade * Math.exp(-a * 3));
  kinetic(B, str, x, y - rise, {
    size, fill: S.fill, stroke: S.stroke, strokeW: 0.08, alpha: fade,
    anim: IN.slam(t, t0, 0.03, 2.2, 0.22),
  });
}

// ---- la carta que se rompe ----

/** Las piezas de una carta rota: celdas de Voronoi sembradas, calculadas una vez. */
const SHARDS = (() => {
  const seeds = [];
  for (let i = 0; i < 8; i++) seeds.push([hr(-90, 90, 301, i), hr(-130, 130, 302, i)]);
  const rect = [[-CARD_W / 2, -CARD_H / 2], [CARD_W / 2, -CARD_H / 2], [CARD_W / 2, CARD_H / 2], [-CARD_W / 2, CARD_H / 2]];
  const clipHalf = (poly, a, c) => {
    const mx = (a[0] + c[0]) / 2;
    const my = (a[1] + c[1]) / 2;
    const nx = c[0] - a[0];
    const ny = c[1] - a[1];
    const inside = (p) => (p[0] - mx) * nx + (p[1] - my) * ny <= 0;
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      const q = poly[(i + 1) % poly.length];
      const pi = inside(p);
      const qi = inside(q);
      if (pi) out.push(p);
      if (pi !== qi) {
        const dp = (p[0] - mx) * nx + (p[1] - my) * ny;
        const dq = (q[0] - mx) * nx + (q[1] - my) * ny;
        const k = dp / (dp - dq);
        out.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k]);
      }
    }
    return out;
  };
  return seeds.map((s, i) => {
    let poly = rect;
    seeds.forEach((o, j) => { if (j !== i) poly = clipHalf(poly, s, o); });
    const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length;
    const cy = poly.reduce((a, p) => a + p[1], 0) / poly.length;
    const shape = new Path2D();
    poly.forEach(([px, py], k) => (k ? shape.lineTo(px - cx, py - cy) : shape.moveTo(px - cx, py - cy)));
    shape.closePath();
    return { cx, cy, shape };
  });
})();

/** Rompe lo que dibuja `drawWhole` (centrado en el origen) en pedazos que vuelan. */
export function shatter(B, drawWhole, t, t0, x, y, s, seed, force = 1) {
  const a = t - t0;
  if (a < 0) return;
  SHARDS.forEach((sh, i) => {
    const ang = Math.atan2(sh.cy, sh.cx) + (hash(seed, i) - 0.5) * 0.8;
    const sp = hr(250, 700, seed, i, 2) * force;
    const dx = Math.cos(ang) * sp * a;
    const dy = Math.sin(ang) * sp * a - 380 * a * force + 1500 * a * a;
    const rot = (hash(seed, i, 3) - 0.5) * 9 * a;
    const alpha = 1 - span(a, 0.7, 1.5);
    if (alpha <= 0) return;
    B.save();
    B.globalAlpha *= alpha;
    B.translate(x + sh.cx * s + dx, y + sh.cy * s + dy);
    B.rotate(rot);
    B.scale(s, s);
    B.save();
    B.clip(sh.shape);
    B.translate(-sh.cx, -sh.cy);
    drawWhole();
    B.restore();
    B.lineWidth = 2;
    B.strokeStyle = 'rgba(255,235,215,0.5)';
    B.stroke(sh.shape);
    B.restore();
  });
}

// ---- golpes ----

/** El zarpazo: tres tajos curvos que se dibujan de una punta a la otra y se apagan. */
export function claws(B, G, t, t0, cx, cy, color = '#ff9a3c', k = 1) {
  for (let n = 0; n < 3; n++) {
    const d0 = t0 + n * 0.03;
    const draw = E.outCubic(span(t, d0, d0 + 0.1));
    const fade = 1 - span(t, d0 + 0.12, d0 + 0.45);
    if (draw <= 0 || fade <= 0) continue;
    const off = (n - 1) * 64 * k;
    const x0 = cx - 150 * k + off;
    const y0 = cy - 190 * k;
    const x1 = cx + 110 * k + off;
    const y1 = cy + 150 * k;
    const mx = cx + 60 * k + off;
    const my = cy - 90 * k;
    const pt = (u) => [(1 - u) ** 2 * x0 + 2 * (1 - u) * u * mx + u * u * x1, (1 - u) ** 2 * y0 + 2 * (1 - u) * u * my + u * u * y1];
    const N = 24;
    const left = [];
    const right = [];
    for (let i = 0; i <= N; i++) {
      const u = (i / N) * draw;
      const [px, py] = pt(u);
      const [qx, qy] = pt(Math.min(1, u + 0.01));
      const len = Math.hypot(qx - px, qy - py) || 1;
      const nx = -(qy - py) / len;
      const ny = (qx - px) / len;
      const w = Math.sin(Math.PI * (i / N)) * 16 * k * fade;
      left.push([px + nx * w, py + ny * w]);
      right.push([px - nx * w, py - ny * w]);
    }
    const path = new Path2D();
    [...left, ...right.reverse()].forEach(([px, py], i) => (i ? path.lineTo(px, py) : path.moveTo(px, py)));
    path.closePath();
    G.save();
    G.globalAlpha = fade;
    G.fillStyle = color;
    G.shadowColor = color;
    G.shadowBlur = 30;
    G.fill(path);
    G.restore();
    B.save();
    B.globalAlpha = fade;
    B.fillStyle = '#fff8ea';
    B.fill(path);
    B.restore();
  }
}

/** Un tajo recto de luz, para puñales y golpes rápidos. */
export function slash(B, G, t, t0, cx, cy, ang, len, color, width = 18) {
  const draw = E.outCubic(span(t, t0, t0 + 0.08));
  const fade = 1 - span(t, t0 + 0.1, t0 + 0.4);
  if (draw <= 0 || fade <= 0) return;
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const x0 = cx - dx * len / 2;
  const y0 = cy - dy * len / 2;
  const x1 = x0 + dx * len * draw;
  const y1 = y0 + dy * len * draw;
  const nx = -dy * width * fade;
  const ny = dx * width * fade;
  const path = new Path2D();
  path.moveTo(x0, y0);
  path.quadraticCurveTo((x0 + x1) / 2 + nx, (y0 + y1) / 2 + ny, x1, y1);
  path.quadraticCurveTo((x0 + x1) / 2 - nx * 0.3, (y0 + y1) / 2 - ny * 0.3, x0, y0);
  path.closePath();
  G.save();
  G.globalAlpha = fade;
  G.fillStyle = color;
  G.shadowColor = color;
  G.shadowBlur = 26;
  G.fill(path);
  G.restore();
  B.save();
  B.globalAlpha = fade;
  B.fillStyle = '#fffaf2';
  B.fill(path);
  B.restore();
}

// ---- barras de vida ----

const BAR = { outer: 150, w: 680, y: 44, h: 32 };

/**
 * La barra de vida de un lado, como en un juego de pelea: se vacía hacia afuera, deja
 * una estela clara que la sigue y puede mostrar en rojo lo que se llevaría un golpe.
 *   hp, trail    la vida y la estela (0 a 100)
 *   ghost        cuánto se llevaría el golpe que se está armando (parpadea)
 *   drop         cuánto bajó desde arriba al entrar (0 = en su lugar)
 */
export function hpHud(B, G, t, side, o) {
  const { name, cls, hp, trail = hp, ghost = 0, alpha = 1, drop = 0, fill = 1, flash = 0 } = o;
  if (alpha <= 0.003) return;
  const left = side === 'left';
  const dir = left ? 1 : -1;
  const x0 = left ? BAR.outer : W - BAR.outer; // el extremo de afuera, donde queda la vida
  const y = BAR.y - drop;
  const len = (v) => BAR.w * clamp(v / 100) * fill;
  const P = CLASSES[cls];
  B.save();
  B.globalAlpha = alpha;
  // el marco
  const fx = left ? x0 - 6 : x0 - BAR.w - 6;
  roundRect(B, fx, y - 6, BAR.w + 12, BAR.h + 12, (BAR.h + 12) / 2);
  B.fillStyle = 'rgba(14,8,22,0.88)';
  B.fill();
  B.lineWidth = 3;
  B.strokeStyle = 'rgba(255,224,160,0.8)';
  B.stroke();
  // el fondo vacío
  roundRect(B, left ? x0 : x0 - BAR.w, y, BAR.w, BAR.h, BAR.h / 2);
  B.fillStyle = '#3a1016';
  B.fill();
  B.save();
  roundRect(B, left ? x0 : x0 - BAR.w, y, BAR.w, BAR.h, BAR.h / 2);
  B.clip();
  // la estela: lo que se acaba de perder, en claro
  if (trail > hp) {
    const a0 = x0 + dir * len(hp);
    const a1 = x0 + dir * len(trail);
    B.fillStyle = '#fff1c8';
    B.fillRect(Math.min(a0, a1), y, Math.abs(a1 - a0), BAR.h);
  }
  // la vida
  const hl = len(hp);
  if (hl > 0.5) {
    const g = B.createLinearGradient(0, y, 0, y + BAR.h);
    const low = hp <= 30;
    g.addColorStop(0, low ? '#ffc08a' : '#b8ff9a');
    g.addColorStop(0.5, low ? '#ff7a3a' : '#54d86a');
    g.addColorStop(1, low ? '#c8301e' : '#1f9a3c');
    B.fillStyle = g;
    B.fillRect(left ? x0 : x0 - hl, y, hl, BAR.h);
    B.fillStyle = 'rgba(255,255,255,0.28)';
    B.fillRect(left ? x0 : x0 - hl, y + 3, hl, BAR.h * 0.28);
  }
  // lo que se llevaría el golpe: rojo que late
  if (ghost > 0) {
    const g0 = Math.max(0, hp - ghost);
    const a0 = x0 + dir * len(g0);
    const a1 = x0 + dir * len(hp);
    const beat = 0.72 + 0.28 * Math.sin(t * 14);
    B.fillStyle = `rgba(255,40,40,${0.9 * beat})`;
    B.fillRect(Math.min(a0, a1), y, Math.abs(a1 - a0), BAR.h);
    B.strokeStyle = '#ffffff';
    B.lineWidth = 3;
    B.setLineDash([6, 5]);
    B.strokeRect(Math.min(a0, a1) + 1.5, y + 1.5, Math.abs(a1 - a0) - 3, BAR.h - 3);
    B.setLineDash([]);
  }
  if (flash > 0) {
    B.fillStyle = `rgba(255,255,255,${flash})`;
    B.fillRect(left ? x0 : x0 - BAR.w, y, BAR.w, BAR.h);
  }
  B.restore();
  B.restore();
  // el medallón y el nombre
  const cx = left ? x0 - 36 : x0 + 36;
  crest(B, cls, cx, y + BAR.h / 2 + 4, 52 * alpha);
  glow(G, cx, y + BAR.h / 2, 90, P.color, 0.18 * alpha);
  kinetic(B, name, left ? x0 + 30 : x0 - 30, y + BAR.h + 58, {
    size: 40, align: left ? 'left' : 'right', strokeW: 0.12, alpha, fill: ['#ffffff', mixHex(P.color, '#ffffff', 0.45)],
  });
  kinetic(B, String(Math.round(hp)), left ? x0 + 16 : x0 - 16, y + BAR.h - 6, {
    size: 28, align: left ? 'left' : 'right', strokeW: 0.16, shadow: 0, alpha,
  });
}

/** Una barra chica sobre la cabeza de un Axie (las peleas de los poderes). */
export function miniHp(B, x, y, w, hp, trail, alpha = 1, heal = 0) {
  if (alpha <= 0.003) return;
  const h = 18;
  B.save();
  B.globalAlpha = alpha;
  roundRect(B, x - w / 2 - 4, y - 4, w + 8, h + 8, (h + 8) / 2);
  B.fillStyle = 'rgba(14,8,22,0.85)';
  B.fill();
  roundRect(B, x - w / 2, y, w, h, h / 2);
  B.fillStyle = '#3a1016';
  B.fill();
  B.save();
  roundRect(B, x - w / 2, y, w, h, h / 2);
  B.clip();
  if (trail > hp) {
    B.fillStyle = '#fff1c8';
    B.fillRect(x - w / 2, y, (w * trail) / 100, h);
  }
  const g = B.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#b8ff9a');
  g.addColorStop(1, '#1f9a3c');
  B.fillStyle = g;
  B.fillRect(x - w / 2, y, (w * hp) / 100, h);
  if (heal > 0) {
    B.fillStyle = `rgba(210,255,190,${heal})`;
    B.fillRect(x - w / 2, y, (w * hp) / 100, h);
  }
  B.restore();
  B.restore();
  kinetic(B, String(Math.round(hp)), x, y + h + 30, { size: 26, strokeW: 0.16, shadow: 0, alpha });
}

// ---- letras de pantalla ----

/** La franja oscura de abajo, para que los subtítulos se lean sobre cualquier fondo. */
export function captionBand(B, alpha) {
  if (alpha <= 0.003) return;
  const g = B.createLinearGradient(0, H - 190, 0, H);
  g.addColorStop(0, 'rgba(6,3,12,0)');
  g.addColorStop(0.55, `rgba(6,3,12,${0.55 * alpha})`);
  g.addColorStop(1, `rgba(6,3,12,${0.75 * alpha})`);
  B.fillStyle = g;
  B.fillRect(0, H - 190, W, 190);
}

/** Un subtítulo: entra letra por letra desde abajo y se va hacia arriba. */
export function caption(B, t, str, t0, t1, o = {}) {
  if (t < t0 - 0.05 || t > t1 + 0.5) return;
  const size = o.size ?? 64;
  const maxW = o.maxW ?? 1500;
  const s = Math.min(size, (size * maxW) / measure(B, str, size));
  kinetic(B, str, o.x ?? W / 2, o.y ?? 1002, {
    size: s, fill: o.fill ?? ['#ffffff', '#fff0cf'], stroke: o.stroke ?? '#1a0c1f', strokeW: 0.1,
    anim: both(IN.rise(t, t0, 0.018, 50, 0.4), OUT.up(t, t1, 0.008, 40, 0.24)),
  });
}

/** El cartel del turno: una píldora del color de la clase. */
export function turnBanner(B, G, t, str, cls, t0, t1) {
  const pin = spring(t, t0, 2.6, 0.5);
  const pout = E.inBack(span(t, t1, t1 + 0.25));
  const s = pin * (1 - pout);
  if (s <= 0.003) return;
  const size = 26;
  const w = measure(B, str, size, 'body', 900, 0.22, 'expanded') + 64;
  const col = CLASSES[cls].color;
  B.save();
  B.translate(W / 2, 128);
  B.scale(s, s);
  roundRect(B, -w / 2, -24, w, 48, 24);
  const g = B.createLinearGradient(0, -24, 0, 24);
  g.addColorStop(0, mixHex(col, '#ffffff', 0.15));
  g.addColorStop(1, mixHex(col, '#000000', 0.35));
  B.fillStyle = g;
  B.fill();
  B.lineWidth = 3;
  B.strokeStyle = 'rgba(255,245,220,0.9)';
  B.stroke();
  B.restore();
  glow(G, W / 2, 128, w * 0.7 * s, col, 0.2 * s * (0.7 + 0.3 * Math.sin(t * 4)));
  kinetic(B, str, W / 2, 138, {
    size: size * s, font: 'body', weight: 900, stretch: 'expanded', spacing: 0.22, strokeW: 0.08, shadow: 0.06,
  });
}

/** El número de la carta en la cadena: una chapita sobre la carta. */
export function countBadge(B, G, t, t0, x, y, n, color, r = 20) {
  const s = spring(t, t0, 3, 0.45);
  if (s <= 0.01) return;
  B.save();
  B.translate(x, y);
  B.scale(s, s);
  B.fillStyle = 'rgba(10,5,2,0.7)';
  B.beginPath(); B.arc(0, 3, r + 3, 0, TAU); B.fill();
  const g = B.createLinearGradient(0, -r, 0, r);
  g.addColorStop(0, mixHex(color, '#ffffff', 0.35));
  g.addColorStop(1, mixHex(color, '#5a2000', 0.3));
  B.fillStyle = g;
  B.beginPath(); B.arc(0, 0, r, 0, TAU); B.fill();
  B.lineWidth = 2.5;
  B.strokeStyle = '#fff4dc';
  B.stroke();
  B.restore();
  glow(G, x, y, r * 2.4, color, 0.3 * pulse(t, t0 + 0.05, 4) + 0.08);
  kinetic(B, String(n), x, y + r * 0.5, { size: r * 1.3 * s, strokeW: 0.14, shadow: 0 });
}

// ---- detalles de los Axies ----

/** La gota de sudor que cae al costado de la cabeza. */
export function sweat(B, x, y, t, t0, period = 1.1, k = 1) {
  if (t < t0) return;
  const dp = ((t - t0) % period) / period;
  const dx = x;
  const dy = y + dp * 70 * k;
  B.save();
  B.globalAlpha = (1 - dp) * 0.95;
  B.fillStyle = '#c8f2ff';
  B.beginPath();
  B.moveTo(dx, dy - 24 * k);
  B.quadraticCurveTo(dx + 15 * k, dy, dx, dy + 9 * k);
  B.quadraticCurveTo(dx - 15 * k, dy, dx, dy - 24 * k);
  B.fill();
  B.strokeStyle = 'rgba(20,60,90,0.5)';
  B.lineWidth = 2;
  B.stroke();
  B.restore();
}

/** Las estrellitas del mareo, girando en una elipse sobre la cabeza. */
export function dizzy(B, G, t, t0, x, y, rx = 120, k = 1) {
  const a = t - t0;
  if (a < 0) return;
  for (let n = 0; n < 5; n++) {
    const ang = a * 4.2 + (n / 5) * TAU;
    const sxp = x + Math.cos(ang) * rx;
    const syp = y + Math.sin(ang) * rx * 0.22;
    const front = Math.sin(ang) > 0;
    const r = (front ? 26 : 19) * k * clamp(a / 0.25);
    B.save();
    B.globalAlpha = front ? 1 : 0.75;
    B.translate(sxp, syp);
    B.rotate(ang * 2);
    B.drawImage(tinted('Star_TX_FX', '#ffe066'), -r, -r, 2 * r, 2 * r);
    B.restore();
    glow(G, sxp, syp, r * 1.6, '#ffd24a', 0.4);
  }
}

/** Un aura que late alrededor de algo cargado de poder. */
export function aura(G, t, x, y, r, color, a) {
  if (a <= 0.003) return;
  glow(G, x, y, r * (1 + 0.08 * Math.sin(t * 12)), color, 0.35 * a);
  for (let n = 0; n < 14; n++) {
    const life = 0.6;
    const age = (t * 1.3 + hash(n, 71) * life) % life;
    const ang = hash(n, 72) * TAU;
    const rr = r * (0.3 + 0.5 * hash(n, 73));
    const px = x + Math.cos(ang) * rr;
    const py = y + Math.sin(ang) * rr * 0.6 - age * 220;
    glow(G, px, py, 6 + 5 * hash(n, 74), color, a * Math.sin((age / life) * Math.PI));
  }
}

// ---- fondos ----

/** El fondo oscuro con bokeh: el escenario de los carteles. */
export function voidBg(B, G, t, tintHex = '#f5b53d', heat = 0.4) {
  const g = B.createRadialGradient(W / 2, H * 0.45, 40, W / 2, H / 2, W * 0.75);
  g.addColorStop(0, mixHex('#1c1a3a', tintHex, 0.12 * heat));
  g.addColorStop(0.55, '#0b0b1c');
  g.addColorStop(1, '#030309');
  B.fillStyle = g;
  B.fillRect(0, 0, W, H);
  B.save();
  B.globalCompositeOperation = 'lighter';
  glow(B, W * 0.5 + Math.sin(t * 0.4) * 160, H * 0.55, 900, tintHex, 0.12 * heat);
  glow(B, W * 0.2 + Math.cos(t * 0.3) * 120, H * 0.25, 700, '#5a3cff', 0.08);
  glow(B, W * 0.85, H * 0.8 + Math.sin(t * 0.5) * 80, 650, '#ff3d7f', 0.06);
  B.restore();
  bokeh(B, G, t);
}

/** Bokeh de los seis colores y chispas que suben. */
export function bokeh(B, G, t, amount = 1) {
  const palette = Object.values(CLASSES).map((c) => c.color);
  B.save();
  B.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 40; i++) {
    const d = hr(0.2, 1, 2100, i);
    const px = hash(2101, i) * W + Math.sin(t * 0.4 + i) * 40;
    const py = ((hash(2102, i) * H - t * 25 * d) % H + H) % H;
    const r = lerp(50, 8, d);
    B.globalAlpha = lerp(0.06, 0.2, d) * amount;
    B.drawImage(tinted(d < 0.5 ? 'circle_soft01' : 'circle_boke01', palette[i % 6]), px - r, py - r, 2 * r, 2 * r);
  }
  B.restore();
  B.globalAlpha = 1;
  for (let i = 0; i < 30; i++) {
    const life = hr(2, 4, 2103, i);
    const age = (t + hash(2104, i) * life) % life;
    const px = hash(2105, i) * W;
    const py = H - age * hr(80, 200, 2106, i);
    glow(G, px, py, hr(2, 5, 2107, i), '#fff0c8', Math.sin((age / life) * Math.PI) * 0.6 * amount);
  }
}

/** La rueda de chances: cuánto te queda de vivir si robás otra. */
export function oddsDial(B, G, t, cx, cy, v, a, label, beat = 0) {
  if (a <= 0.003) return;
  const col = v > 0.6 ? mixHex('#54cf8b', '#ffd23a', (0.82 - v) / 0.22) : mixHex('#ffd23a', '#ff4a3a', clamp((0.6 - v) / 0.22));
  const R = 62 * (1 + beat * 0.05);
  B.save();
  B.globalAlpha = a;
  B.translate(cx, cy);
  B.fillStyle = 'rgba(10,6,16,0.82)';
  B.beginPath(); B.arc(0, 0, R + 15, 0, TAU); B.fill();
  B.lineCap = 'round';
  B.lineWidth = 13;
  B.strokeStyle = 'rgba(255,255,255,0.12)';
  B.beginPath(); B.arc(0, 0, R, 0, TAU); B.stroke();
  B.strokeStyle = col;
  B.beginPath(); B.arc(0, 0, R, -Math.PI / 2, -Math.PI / 2 + TAU * v); B.stroke();
  B.restore();
  glow(G, cx, cy, R * 2, col, 0.25 * a * (0.7 + beat));
  kinetic(B, `${Math.round(v * 100)}%`, cx, cy + 17, { size: 46, alpha: a, strokeW: 0.1, shadow: 0.05 });
  kinetic(B, label, cx, cy + R + 44, {
    size: 20, font: 'body', weight: 900, stretch: 'expanded', spacing: 0.3, fill: 'rgba(255,255,255,0.85)', strokeW: 0, alpha: a,
  });
}

export { burst, ring };
