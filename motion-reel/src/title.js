// El título: los seis crests se juntan, sale el logo, la frase y la llamada a jugar.
import {
  W, H, b, span, clamp, lerp, E, spring, ring, pulse, TAU,
} from './core.js';
import { img, tinted, glowDot, CLASSES, CLASS_IDS, crest, roundRect, canvas } from './assets.js';
import { drawAxie } from './axie.js';
import { burst, shockRing, glow, kinetic, measure, IN } from './fx.js';
import { bokeh } from './pieces.js';
import { CUE } from './script.js';

/** Los seis crests vuelan desde los bordes y se juntan en el centro: de ahí sale el logo. */
export function converge(B, G, t) {
  const t0 = b(CUE.converge);
  const t1 = b(CUE.logo);
  const p = E.inCubic(span(t, t0, t1));
  CLASS_IDS.forEach((cls, i) => {
    const ang = (i / 6) * TAU + p * 2.5;
    const r = lerp(1100, 0, p);
    const px = W / 2 + Math.cos(ang) * r;
    const py = H / 2 + Math.sin(ang) * r * 0.62;
    glow(G, px, py, 120, CLASSES[cls].color, 0.8 * p);
    crest(B, cls, px, py, lerp(70, 30, p));
  });
  glow(G, W / 2, H / 2, 600 * p, '#ffffff', p * p);
}

export function sceneLogo(B, G, t, L) {
  const t0 = b(CUE.logo);
  const age = t - t0;
  const g = B.createRadialGradient(W / 2, H * 0.42, 50, W / 2, H * 0.5, W * 0.8);
  g.addColorStop(0, '#2a2a6a');
  g.addColorStop(0.45, '#14123a');
  g.addColorStop(1, '#05040f');
  B.fillStyle = g;
  B.fillRect(0, 0, W, H);
  B.save();
  B.globalCompositeOperation = 'lighter';
  B.translate(W / 2, 400);
  B.rotate(age * 0.08);
  for (let i = 0; i < 14; i++) {
    B.save();
    B.rotate((i / 14) * TAU);
    B.globalAlpha = 0.07 + 0.04 * Math.sin(age * 1.5 + i);
    B.drawImage(tinted('lightray3', i % 2 ? '#ffcf7a' : '#7fb8ff'), -70, 0, 140, 1300);
    B.restore();
  }
  B.restore();
  bokeh(B, G, t);

  // los seis crests giran alrededor del logo; los que pasan por detrás se achican y se tapan
  const orbit = E.outCubic(span(age, 0, 1.2));
  const crests = CLASS_IDS.map((cls, i) => {
    const ang = (i / 6) * TAU + age * 0.45 - Math.PI / 2;
    const depth = (Math.sin(ang) + 1) / 2;
    return {
      cls, depth,
      px: W / 2 + Math.cos(ang) * 660 * orbit,
      py: 390 + Math.sin(ang) * 312 * orbit,
      r: (24 + depth * 20) * orbit,
    };
  });
  const drawCrests = (front) => crests.forEach((c) => {
    if ((c.depth >= 0.5) !== front || c.r < 1) return;
    glow(G, c.px, c.py, c.r * 2.2, CLASSES[c.cls].color, (front ? 0.35 : 0.15) * orbit);
    B.save();
    B.globalAlpha = front ? 1 : 0.8;
    crest(B, c.cls, c.px, c.py, c.r);
    B.restore();
  });
  drawCrests(false);

  // el logo: fogonazo, golpe con resorte y un barrido de luz
  const logo = img.logo;
  const s = spring(t, t0, 2.2, 0.38);
  const squash = ring(t, t0 + 0.12, 2.4, 6) * 0.06;
  const lw = 740;
  const lh = (lw * logo.height) / logo.width;
  const final = pulse(t, b(CUE.final), 5) * 0.04;
  B.save();
  B.translate(W / 2, 400);
  B.scale(s * (1 + squash + final), s * (1 - squash + final));
  B.rotate((1 - Math.min(1, s)) * -0.2);
  B.drawImage(glowDot('#000000', 0.7), -lw * 0.6, -lh * 0.45, lw * 1.2, lh * 1.05);
  B.drawImage(logo, -lw / 2, -lh / 2, lw, lh);
  B.restore();
  drawCrests(true);
  const sw = span(age, 0.9, 1.8);
  const sw2 = span(t, b(CUE.final), b(CUE.final) + 0.9);
  for (const p of [sw, sw2]) {
    if (p <= 0 || p >= 1) continue;
    const c = logoSheen(lw, lh, p);
    G.save();
    G.translate(W / 2, 400);
    G.scale(s, s);
    G.drawImage(c, -lw / 2, -lh / 2, lw, lh);
    G.restore();
  }
  if (age >= 0 && age < 1.2) {
    burst(G, t, { x: W / 2, y: 400, t0, n: 80, seed: 2000, speed: [500, 1700], life: [0.4, 1.1], drag: 3, gravity: 200, size: [2, 5], colors: ['#ffffff', '#ffd27a', '#7fd0ff'] });
    burst(G, t, { x: W / 2, y: 400, t0, n: 18, seed: 2001, speed: [300, 900], life: [0.6, 1.2], drag: 2.5, gravity: 100, size: [6, 11], colors: ['#ffe27a', '#ffffff'], kind: 'star' });
    shockRing(G, t, t0, W / 2, 400, 900, '#ffffff', 0.7, 22);
  }
  // los seis Axies asoman por abajo, en las esquinas
  const ids = ['olek', 'momo', 'puffy', 'buba', 'pomodoro', 'venoki'];
  ids.forEach((id, i) => {
    const d = b(CUE.axies) + i * 0.09;
    const p = spring(t, d, 2, 0.5);
    if (p <= 0) return;
    const left = i < 3;
    const k = left ? i : i - 3;
    const px = left ? 120 + k * 150 : W - 120 - (2 - k) * 150;
    const py = H + 60 - p * 140 - (k === 1 ? 12 : 0);
    const clip = t - d < 1 ? 'cheer' : 'idle';
    drawAxie(B, id, { px, py, h: 180, clip, ct: t - d, face: left ? 'right' : 'left', shadow: 0 });
  });
  kinetic(B, L.tagline, W / 2, 818, { size: 92, anim: IN.rise(t, b(CUE.tag), 0.04, 70), fill: ['#ffffff', '#fff0cf'] });
  const cp = E.outBackBig(span(t, b(CUE.cta), b(CUE.cta) + 0.45));
  if (cp > 0) {
    const label = `${L.cta}  ·  ${L.url}`;
    const lw2 = measure(B, label, 34, 'body', 800, 0.12, 'expanded') + 80;
    B.save();
    B.translate(W / 2, 916);
    B.scale(cp, cp);
    roundRect(B, -lw2 / 2, -36, lw2, 72, 36);
    const pg = B.createLinearGradient(0, -36, 0, 36);
    pg.addColorStop(0, '#ff9a3c');
    pg.addColorStop(1, '#e8541e');
    B.fillStyle = pg;
    B.fill();
    B.lineWidth = 4;
    B.strokeStyle = '#ffe0a0';
    B.stroke();
    B.restore();
    kinetic(B, label, W / 2, 928, {
      size: 34, font: 'body', weight: 800, stretch: 'expanded', spacing: 0.12, strokeW: 0, shadow: 0.08, alpha: clamp(cp),
    });
  }
}

const sheenCache = new Map();
/** El barrido de luz recortado a la forma del logo. */
function logoSheen(lw, lh, p) {
  const key = Math.round(p * 60);
  let c = sheenCache.get(key);
  if (c) return c;
  c = canvas(lw, lh);
  const x = c.getContext('2d');
  x.drawImage(img.logo, 0, 0, lw, lh);
  x.globalCompositeOperation = 'source-in';
  const cx = lerp(-lw * 0.4, lw * 1.4, key / 60);
  const g = x.createLinearGradient(cx - 160, 0, cx + 160, lh * 0.3);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,250,235,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, lw, lh);
  sheenCache.set(key, c);
  return c;
}
