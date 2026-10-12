// Los poderes: el cartel de los doce y cuatro peleas cortas, cada una en el mundo de
// su clase y con un Axie distinto, para que cada poder se entienda solo: la carta
// aparece, dice su nombre y lo que hace, y lo hace.
import {
  W, H, b, span, clamp, lerp, E, spring, ring, pulse, hash, hr, TAU, BEAT, mixHex,
} from './core.js';
import { img, CLASSES, POWERS, roundedPoly, CARD_W, CARD_H } from './assets.js';
import { drawAxie, clipDur } from './axie.js';
import {
  burst, shockRing, glow, puff, kinetic, IN, cover,
} from './fx.js';
import {
  card, amulet, popNumber, claws, slash, miniHp, captionBand, voidBg,
} from './pieces.js';
import { CUE, VIGNETTES, V_HIT, V_SECOND } from './script.js';

const HERO_X = 560;
const FOE_X = 1360;
const FEET = 830;
const CARD_AT = [960, 372];
const CARD_S = 0.9;
/** Dónde queda la chapa del amuleto de la carta, en la pantalla. */
const CHIP_AT = [CARD_AT[0] + (CARD_W / 2 - 22) * CARD_S, CARD_AT[1] + (-CARD_H / 2 + 24) * CARD_S];

// =====================================================================
// el cartel de los doce poderes
// =====================================================================

function powersTitle(B, G, t, L) {
  const t0 = b(CUE.powers);
  const age = t - t0;
  voidBg(B, G, t, '#b46cff', 0.5);
  // y se va metiéndose adentro del primer poder
  const exit = E.inCubic(span(t, b(CUE.v[0]) - 0.5, b(CUE.v[0]) + 0.1));
  B.save(); G.save();
  B.translate(W / 2, 520); G.translate(W / 2, 520);
  B.scale(1 + exit * 2.2, 1 + exit * 2.2); G.scale(1 + exit * 2.2, 1 + exit * 2.2);
  B.translate(-W / 2, -520); G.translate(-W / 2, -520);
  B.globalAlpha = 1 - exit;
  // los doce amuletos llegan desde afuera y quedan girando en un anillo
  POWERS.forEach(([pw, cls], k) => {
    const d0 = t0 + 0.12 + k * 0.045;
    const p = E.outCubic(span(t, d0, d0 + 0.55));
    if (p <= 0) return;
    const ang = (k / 12) * TAU - Math.PI / 2 + age * 0.35;
    const tx = W / 2 + Math.cos(ang) * 660;
    const ty = 520 + Math.sin(ang) * 330;
    const from = hash(k, 51) * TAU;
    const sx = W / 2 + Math.cos(from) * 1500;
    const sy = 520 + Math.sin(from) * 900;
    const px = lerp(sx, tx, p);
    const py = lerp(sy, ty, p);
    const depth = (Math.sin(ang) + 1) / 2;
    const r = (46 + depth * 18) * (0.6 + 0.4 * E.outBack(p));
    const col = CLASSES[cls].color;
    glow(G, px, py, r * 2.4, col, (0.35 + 0.25 * pulse(t, d0 + 0.55, 4)) * (1 - exit));
    B.save();
    B.fillStyle = 'rgba(10,6,20,0.7)';
    B.beginPath(); B.arc(px, py, r, 0, TAU); B.fill();
    B.lineWidth = 4;
    B.strokeStyle = mixHex(col, '#ffffff', 0.25);
    B.stroke();
    B.restore();
    amulet(B, pw, px, py, r * 1.5, (1 - p) * 3);
  });
  kinetic(B, L.powers, W / 2, 575, {
    size: 170, fill: ['#ffffff', '#fff0cf', '#ffd27a'], stroke: '#200a2a', strokeW: 0.08,
    anim: IN.slam(t, t0 + 0.3, 0.035, 2.6, 0.3),
  });
  kinetic(B, L.powersSub, W / 2, 660, {
    size: 44, font: 'body', weight: 900, stretch: 'expanded', spacing: 0.2, fill: '#ffe6b8', stroke: '#200a2a', strokeW: 0.14,
    anim: IN.rise(t, t0 + 0.75, 0.015, 40),
  });
  if (age >= 0.3 && age < 1.2) {
    burst(G, t, { x: W / 2, y: 520, t0: t0 + 0.3, n: 60, seed: 3000, speed: [500, 1600], life: [0.4, 0.9], drag: 3, gravity: 200, size: [2, 5], colors: ['#ffffff', '#d7a6ff', '#ffd27a'] });
    shockRing(G, t, t0 + 0.3, W / 2, 520, 700, '#e7c8ff', 0.5, 16);
  }
  B.restore(); G.restore();
  B.globalAlpha = 1;
}

// =====================================================================
// una pelea con un poder
// =====================================================================

/** La vida de una barra: cambia en `at` (tiempos desde el arranque) con estela. */
function hpAt(u, [h0, h1], at) {
  const hp = lerp(h0, h1, E.outCubic(clamp((u - at - 0.05) / 0.5)));
  const trail = h1 < h0 ? lerp(h0, h1, E.inOutCubic(clamp((u - at - 0.9) / 1.2))) : hp;
  return { hp, trail };
}

function vignette(B, G, t, i, L) {
  const V = VIGNETTES[i];
  const t0 = b(CUE.v[i]);
  const u = (t - t0) / BEAT; // tiempos desde que arranca esta pelea
  const col = CLASSES[V.cls].color;
  const hitU = V_HIT[V.power];
  const secU = V_SECOND[V.power] ?? hitU;
  // ---- el mundo ----
  cover(B, img[`bg:${V.cls}`], 0, 0, W, H, 1.1 + (t - t0) * 0.012, 0.5, 0.55);
  const g = B.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(8,4,16,0.5)');
  g.addColorStop(0.35, 'rgba(8,4,16,0.12)');
  g.addColorStop(0.7, 'rgba(8,4,16,0.2)');
  g.addColorStop(1, 'rgba(8,4,16,0.72)');
  B.fillStyle = g;
  B.fillRect(0, 0, W, H);

  // ---- los dos Axies ----
  let hx = HERO_X;
  let hClip = 'idle';
  let hCt = t - t0;
  let hEyes = null;
  if (u >= 0.7 && u < 2.3) { hClip = 'ready'; hCt = t - t0 - b(0.7); }
  if (V.power === 'pot' && u >= 2.3 && u < 4.2) {
    hClip = 'attack'; hCt = t - t0 - b(2.3);
    const go = E.inQuad(clamp((u - 2.4) / (hitU - 2.4)));
    const back = E.inOutCubic(clamp((u - hitU - 0.3) / 1));
    hx = lerp(HERO_X, FOE_X - 280, go * (1 - back));
  }
  const cheerU = V.power === 'pot' ? secU + 0.2 : hitU + 0.3;
  if (u >= cheerU && u < cheerU + 2.2) { hClip = 'cheer'; hCt = t - t0 - b(cheerU); hEyes = 'eyes-happy'; }
  const hHop = V.power === 'pot' ? Math.sin(E.inOutCubic(clamp((u - hitU - 0.3) / 1)) * Math.PI) * 110 : 0;
  drawAxie(B, V.hero, { px: hx, py: FEET - hHop, h: 330, face: 'right', clip: hClip, ct: hCt, eyes: hEyes, shadow: 0.45 });

  let fClip = 'idle';
  let fCt = t - t0 + 0.4;
  let fEyes = null;
  let fx = FOE_X;
  if (u >= hitU) {
    fClip = V.power === 'poison' ? 'whiff' : 'hurt';
    fCt = t - t0 - b(hitU);
    fEyes = 'eyes-shut';
    fx += E.outCubic(clamp((u - hitU) / 0.4)) * 40 - E.inOutCubic(clamp((u - hitU - 0.8) / 1.5)) * 40;
    if (fCt > clipDur(fClip) + 0.2) { fClip = 'idle'; fEyes = V.power === 'poison' ? 'eyes-shut' : 'eyes-angry'; }
  }
  drawAxie(B, V.foe, { px: fx, py: FEET, h: 320, clip: fClip, ct: fCt, eyes: fEyes, shadow: 0.45 });
  // el veneno: el rival queda violeta y le salen burbujas
  if (V.power === 'poison' && u >= hitU) poisoned(B, G, t, t0 + b(hitU), FOE_X, FEET);

  // ---- las vidas ----
  const foeHp = hpAt(u, V.foeHp, hitU);
  const heroHp = hpAt(u, V.heroHp, secU);
  const barA = clamp(u / 0.5);
  miniHp(B, HERO_X, FEET - 330 - 70, 200, heroHp.hp, heroHp.trail, barA, V.heroHp[1] > V.heroHp[0] ? pulse(t, t0 + b(secU), 4) * 0.8 : 0);
  miniHp(B, FOE_X, FEET - 320 - 70, 200, foeHp.hp, foeHp.trail, barA);

  // ---- la carta del poder ----
  const cIn = t0 + b(0.3);
  const land = t0 + b(0.55);
  const cp = span(t, cIn, land);
  if (cp > 0) {
    const e = E.outCubic(cp);
    const sq = ring(t, land, 3.5, 8) * 0.1;
    const used = u >= 2.4;
    const fade = 1 - E.inCubic(clamp((u - 6.6) / 0.8));
    card(B, G, [V.cls], {
      x: CARD_AT[0], y: lerp(H + 260, CARD_AT[1], e), s: CARD_S * (1 + sq), rot: (1 - e) * 0.6, flip: (1 - e) * Math.PI * 2,
      sx: 1 + sq, sy: 1 - sq, heat: pulse(t, land, 3) * 0.9 + (u > 2 && u < 2.5 ? pulse(t, t0 + b(2.1), 3) : 0), heatColor: col,
      lit: (s) => 0.6 + 0.4 * Math.sin(t * 4),
      chip: { power: V.power, cls: V.cls, pop: spring(t, land + 0.05, 2.8, 0.4) * (1 - E.inBack(clamp((u - 2.4) / 0.35))), hideIcon: used },
      alpha: fade,
    });
    // la chapa se enciende antes de soltar el poder
    glow(G, CHIP_AT[0], CHIP_AT[1], 80, col, (0.4 + 0.6 * pulse(t, t0 + b(2.1), 2.5)) * (used ? 0.3 : 1) * clamp((t - land) / 0.2) * fade);
    if (t >= land && t < land + 0.6) {
      burst(G, t, { x: CARD_AT[0], y: CARD_AT[1], t0: land, n: 30, seed: 3100 + i, speed: [300, 1000], life: [0.3, 0.6], drag: 4, gravity: 300, size: [2, 4], colors: [col, '#ffffff'] });
      shockRing(G, t, land, CARD_AT[0], CARD_AT[1], 260, col, 0.45, 10);
    }
  }

  // ---- el poder en acción ----
  EFFECTS[V.power](B, G, t, t0, u, V);

  // ---- el nombre y lo que hace ----
  captionBand(B, clamp(u / 0.6));
  kinetic(B, V.name, W / 2, 925, {
    size: 92, fill: ['#ffffff', mixHex(col, '#ffffff', 0.55), col], stroke: CLASSES[V.cls].edge, strokeW: 0.1,
    anim: IN.slam(t, t0 + b(0.85), 0.025, 2.2, 0.26),
  });
  kinetic(B, L[V.power], W / 2, 1000, {
    size: 44, font: 'body', weight: 800, spacing: 0.02, fill: '#fff5e0', stroke: '#140a1c', strokeW: 0.16,
    anim: IN.rise(t, t0 + b(1.25), 0.012, 36),
  });
}

/** El veneno: un velo violeta que late sobre el Axie y burbujas que suben. */
function poisoned(B, G, t, th, x, feet) {
  const a = t - th;
  const k = clamp(a / 0.3);
  glow(G, x, feet - 150, 230, '#a24bff', 0.3 * k * (0.7 + 0.3 * Math.sin(t * 6)));
  for (let n = 0; n < 22; n++) {
    const life = hr(0.9, 1.6, 3200, n);
    const age = (a + hash(3201, n) * life) % life;
    if (a < hash(3202, n) * 0.4) continue;
    const px = x + hr(-120, 120, 3203, n) + Math.sin(age * 5 + n) * 10;
    const py = feet - hr(40, 260, 3204, n) - age * hr(80, 160, 3205, n);
    const r = hr(5, 12, 3206, n) * (0.6 + age / life);
    const fade = Math.sin((age / life) * Math.PI) * k;
    B.save();
    B.globalAlpha = fade * 0.9;
    B.strokeStyle = '#e0b0ff';
    B.lineWidth = 2.5;
    B.fillStyle = 'rgba(160,70,230,0.45)';
    B.beginPath(); B.arc(px, py, r, 0, TAU); B.fill(); B.stroke();
    B.restore();
    glow(G, px, py, r * 2, '#b45cff', fade * 0.5);
  }
  const ic = img['status:poison'];
  if (ic) {
    const s = spring(t, th + 0.2, 2.5, 0.45);
    const h = 64 * s;
    B.save();
    B.globalAlpha = k;
    B.drawImage(ic, x + 110 - (h * ic.width / ic.height) / 2, feet - 390 - h / 2 + Math.sin(t * 3) * 6, (h * ic.width) / ic.height, h);
    B.restore();
  }
}

/** Un amuleto que viaja por una parábola de (x0,y0) a (x1,y1), girando, con estela. */
function throwAmulet(B, G, t, power, col, ta, tb, x0, y0, x1, y1, arc, spin, h = 110) {
  if (t < ta || t > tb) return null;
  const p = span(t, ta, tb);
  const at = (q) => [lerp(x0, x1, q), lerp(y0, y1, q) - Math.sin(q * Math.PI) * arc];
  for (let k = 1; k <= 8; k++) {
    const q = Math.max(0, p - k * 0.025);
    const [qx, qy] = at(q);
    glow(G, qx, qy, 34 - k * 2.5, col, 0.5 * (1 - k / 9));
  }
  const [px, py] = at(p);
  glow(G, px, py, 70, col, 0.7);
  amulet(B, power, px, py, h, p * spin);
  return [px, py];
}

const EFFECTS = {
  /** Feather Earring: la pluma sube, cae del cielo sobre el rival y le pega 5. */
  feather(B, G, t, t0, u, V) {
    const col = CLASSES.bird.color;
    const T = (x) => t0 + b(x);
    // sube desde la chapa y se va por arriba
    throwAmulet(B, G, t, 'feather', col, T(2.4), T(3), CHIP_AT[0], CHIP_AT[1], CHIP_AT[0] + 160, -200, 60, 5, 110);
    // la pluma gigante baja meciéndose y se clava
    const f0 = T(3);
    const f1 = T(V_HIT.feather);
    if (t >= f0 && t < f1 + 0.02) {
      const p = span(t, f0, f1);
      const sway = Math.sin(p * Math.PI * 3) * (1 - p) * 90;
      const px = FOE_X + sway - 20;
      const py = lerp(-260, FEET - 220, E.inQuad(p));
      const rot = Math.cos(p * Math.PI * 3) * (1 - p) * 0.6 + 0.5 * p;
      for (let k = 1; k <= 6; k++) glow(G, px - sway * 0.1 * k, py - k * 26, 40 - k * 4, col, 0.35 * (1 - k / 7));
      glow(G, px, py, 140, col, 0.35);
      amulet(B, 'feather', px, py, 300, rot);
    }
    if (t >= f1 && t < f1 + 1.2) {
      const hx = FOE_X - 10;
      const hy = FEET - 170;
      slash(B, G, t, f1, hx, hy, -0.9, 420, col, 20);
      slash(B, G, t, f1 + 0.05, hx + 20, hy + 10, -2.3, 360, col, 16);
      burst(G, t, { x: hx, y: hy, t0: f1, n: 50, seed: 3300, speed: [400, 1400], life: [0.3, 0.8], drag: 4, gravity: 600, size: [2, 5], colors: ['#ffd0e6', '#ffffff', col] });
      burst(B, t, { x: hx, y: hy - 40, t0: f1, n: 12, seed: 3301, speed: [150, 500], life: [0.8, 1.2], drag: 3, gravity: 120, size: [4, 7], colors: ['#ffe4f0', '#ffb0d4'], kind: 'ember' });
      shockRing(G, t, f1, hx, hy, 380, col, 0.5, 16);
      popNumber(B, G, t, f1 + 0.02, `−${V.amount}`, FOE_X, FEET - 360, 'pink', 130, 1.3);
    }
  },

  /** Poison Vial: el frasco atraviesa el escudo, se rompe y el veneno se queda. */
  poison(B, G, t, t0, u, V) {
    const col = CLASSES.reptile.color;
    const T = (x) => t0 + b(x);
    const hit = T(V_HIT.poison);
    // el escudo del rival, que no sirve para nada
    const sIn = spring(t, T(1.6), 2.2, 0.5);
    const sOut = span(t, hit + 0.6, hit + 1.2);
    const cross = T(V_HIT.poison - 0.35);
    if (sIn > 0.01 && sOut < 1) {
      const a = sIn * (1 - sOut);
      const sx = FOE_X - 190;
      const sy = FEET - 170;
      const ripple = pulse(t, cross, 5);
      G.save();
      G.globalAlpha = 0.6 * a * (1 + ripple);
      G.strokeStyle = '#7fe7ff';
      G.lineWidth = 7;
      G.beginPath();
      G.ellipse(sx, sy, 60 * a, 210 * a, 0, -Math.PI / 2 - 1.2, -Math.PI / 2 + 1.2 + Math.PI, true);
      G.stroke();
      G.restore();
      B.save();
      B.globalAlpha = 0.28 * a;
      B.fillStyle = '#7fe7ff';
      B.beginPath();
      B.ellipse(sx, sy, 60 * a, 210 * a, 0, 0, TAU);
      B.fill();
      B.restore();
      const sh = img.shield;
      if (sh) {
        const h = 70 * a;
        B.save();
        B.globalAlpha = a;
        B.drawImage(sh, sx - (h * sh.width / sh.height) / 2, sy - 250 * a - h / 2, (h * sh.width) / sh.height, h);
        B.restore();
      }
      if (t >= cross && t < cross + 0.5) shockRing(G, t, cross, sx, sy - 20, 160, '#bff4ff', 0.4, 8);
    }
    throwAmulet(B, G, t, 'poison', col, T(2.5), hit, CHIP_AT[0], CHIP_AT[1], FOE_X - 20, FEET - 170, 260, 9, 120);
    if (t >= hit && t < hit + 1.2) {
      burst(G, t, { x: FOE_X - 20, y: FEET - 170, t0: hit, n: 60, seed: 3400, speed: [300, 1200], life: [0.3, 0.8], drag: 4, gravity: 900, size: [2, 6], colors: ['#e0a6ff', '#b45cff', '#ffffff'], kind: 'dot' });
      burst(B, t, { x: FOE_X - 20, y: FEET - 170, t0: hit, n: 16, seed: 3401, speed: [200, 700], life: [0.4, 0.8], drag: 3, gravity: 1200, size: [3, 5], colors: ['#d8f2ff', '#ffffff'], kind: 'streak', stretch: 0.02 });
      shockRing(G, t, hit, FOE_X - 20, FEET - 170, 360, col, 0.5, 16);
      popNumber(B, G, t, hit + 0.02, `−${V.amount}`, FOE_X, FEET - 360, 'poison', 130, 1.3);
    }
  },

  /** Mantis Dagger: el puñal pega y la vida vuelve en orbes al que lo tiró. */
  leech(B, G, t, t0, u, V) {
    const col = CLASSES.bug.color;
    const T = (x) => t0 + b(x);
    const hit = T(V_HIT.leech);
    throwAmulet(B, G, t, 'leech', col, T(2.4), hit, CHIP_AT[0], CHIP_AT[1], FOE_X - 40, FEET - 180, 90, 12, 120);
    if (t >= hit && t < hit + 1.2) {
      slash(B, G, t, hit, FOE_X - 20, FEET - 170, -0.6, 380, '#ff5a4a', 20);
      burst(G, t, { x: FOE_X - 20, y: FEET - 170, t0: hit, n: 50, seed: 3500, speed: [400, 1400], life: [0.3, 0.7], drag: 4, gravity: 700, size: [2, 5], colors: ['#ffb0a0', '#ffffff', '#ff4a3a'] });
      shockRing(G, t, hit, FOE_X - 20, FEET - 170, 360, '#ff7a6a', 0.5, 16);
      popNumber(B, G, t, hit + 0.02, `−${V.amount}`, FOE_X, FEET - 360, 'red', 130, 1.3);
    }
    // los orbes de vida: salen del rival y llegan al que tiró el puñal
    const o0 = T(V_HIT.leech + 0.35);
    const o1 = T(V_SECOND.leech);
    for (let k = 0; k < 9; k++) {
      const d0 = o0 + k * 0.05;
      const d1 = o1 - 0.15 + k * 0.03;
      const p = span(t, d0, d1);
      if (p <= 0 || p >= 1) continue;
      const e = E.inOutCubic(p);
      const x0 = FOE_X - 20 + hr(-40, 40, 3510, k);
      const y0 = FEET - 170 + hr(-50, 50, 3511, k);
      const x1 = HERO_X + hr(-30, 30, 3512, k);
      const y1 = FEET - 170;
      const px = lerp(x0, x1, e);
      const py = lerp(y0, y1, e) - Math.sin(p * Math.PI) * hr(120, 260, 3513, k);
      glow(G, px, py, 36, '#ff3b5c', 0.8);
      glow(G, px, py, 12, '#ffffff', 0.9);
    }
    const sec = T(V_SECOND.leech);
    if (t >= sec && t < sec + 1.3) {
      glow(G, HERO_X, FEET - 170, 260, '#6aff8a', 0.45 * Math.exp(-(t - sec) * 3));
      burst(G, t, { x: HERO_X, y: FEET - 170, t0: sec, n: 30, seed: 3520, speed: [150, 500], life: [0.5, 1], drag: 2, gravity: -200, size: [2, 4], colors: ['#b6ff8a', '#ffffff'], kind: 'dot' });
      popNumber(B, G, t, sec + 0.02, `+${V.amount}`, HERO_X, FEET - 370, 'heal', 120, 1.3);
    }
  },

  /** Leafy Pot: pega, la maceta cae al lado y la cura sube en hojas. */
  pot(B, G, t, t0, u, V) {
    const T = (x) => t0 + b(x);
    const hit = T(V_HIT.pot);
    if (t >= hit - 0.05 && t < hit + 1.2) {
      claws(B, G, t, hit - 0.05, FOE_X - 20, FEET - 170, '#7aff5a', 0.9);
      if (t >= hit) {
        burst(G, t, { x: FOE_X - 20, y: FEET - 170, t0: hit, n: 60, seed: 3600, speed: [400, 1500], life: [0.3, 0.7], drag: 4, gravity: 800, size: [2, 5], colors: ['#d8ffb0', '#ffffff', '#54cf8b'], dir: 0, spread: Math.PI * 1.3 });
        shockRing(G, t, hit, FOE_X - 20, FEET - 170, 380, '#b6ff8a', 0.5, 16);
        popNumber(B, G, t, hit + 0.02, `−${V.amount}`, FOE_X, FEET - 360, 'red', 130, 1.3);
      }
    }
    // la maceta cae desde la carta al lado del que pegó
    const px = HERO_X - 190;
    const p0 = T(3.6);
    const p1 = T(4.1);
    const drop = span(t, p0, p1);
    if (drop > 0) {
      const sq = ring(t, p1, 3, 6) * 0.15;
      const y = lerp(CHIP_AT[1], FEET - 50, E.inQuad(drop)) - Math.sin(drop * Math.PI) * 150;
      const x = lerp(CHIP_AT[0], px, drop);
      const fade = 1 - span(t, T(7), T(7.6));
      B.save();
      B.globalAlpha = fade;
      B.translate(x, y + 50);
      B.scale(1 + sq, 1 - sq);
      amulet(B, 'pot', 0, -50, 110);
      B.restore();
      if (t >= p1 && t < p1 + 0.6) puff(B, t, p1, px, FEET, 120, '#e8f7d8', 0.5, 36, 4);
    }
    // las hojas que suben en espiral alrededor del que se cura
    const s0 = T(4.1);
    const s1 = T(V_SECOND.pot);
    for (let k = 0; k < 16; k++) {
      const d0 = s0 + k * 0.03;
      const a = t - d0;
      const life = 1.1;
      if (a < 0 || a > life) continue;
      const p = a / life;
      const ang = k * 1.7 + a * 7;
      const r = 150 * (1 - p * 0.3);
      const lx = HERO_X + Math.cos(ang) * r;
      const ly = FEET - 30 - p * 360 + Math.sin(ang) * 30;
      const fade = Math.sin(p * Math.PI);
      leafShape(B, lx, ly, 18, ang + Math.PI / 2, fade, k % 2 ? '#7fe36a' : '#b6f27a');
      glow(G, lx, ly, 22, '#8aff6a', fade * 0.5);
    }
    if (t >= s1 && t < s1 + 1.3) {
      glow(G, HERO_X, FEET - 170, 280, '#6aff8a', 0.5 * Math.exp(-(t - s1) * 3));
      burst(G, t, { x: HERO_X, y: FEET - 170, t0: s1, n: 30, seed: 3620, speed: [150, 500], life: [0.5, 1], drag: 2, gravity: -200, size: [2, 4], colors: ['#b6ff8a', '#ffffff'], kind: 'dot' });
      popNumber(B, G, t, s1 + 0.02, `+${V.amount}`, HERO_X, FEET - 370, 'heal', 120, 1.3);
    }
  },
};

function leafShape(B, x, y, s, rot, alpha, color) {
  if (alpha <= 0.01) return;
  B.save();
  B.globalAlpha = alpha;
  B.translate(x, y);
  B.rotate(rot);
  B.fillStyle = color;
  B.beginPath();
  B.moveTo(0, -s);
  B.quadraticCurveTo(s * 0.8, 0, 0, s);
  B.quadraticCurveTo(-s * 0.8, 0, 0, -s);
  B.fill();
  B.strokeStyle = 'rgba(20,70,10,0.6)';
  B.lineWidth = 1.5;
  B.beginPath(); B.moveTo(0, -s); B.lineTo(0, s); B.stroke();
  B.restore();
}

// =====================================================================
// la escena: el cartel y las cuatro peleas, cada una abre con un iris con la forma
// del medallón de su clase
// =====================================================================

export function scenePowers(B, G, t, L) {
  let cur = -1;
  CUE.v.forEach((bt, i) => { if (t >= b(bt)) cur = i; });
  const drawPrev = (k) => (k < 0 ? powersTitle(B, G, t, L) : vignette(B, G, t, k, L));
  if (cur < 0) { drawPrev(-1); return; }
  const t0 = b(CUE.v[cur]);
  const ip = E.outExpo(span(t, t0, t0 + 0.45));
  const R = ip * Math.hypot(W, H) * 0.62;
  const iris = roundedPoly(10, Math.max(1, R), Math.max(1, R) * 0.2, -Math.PI / 2 + 0.12 + (1 - ip) * 0.8);
  const shape = new Path2D();
  shape.addPath(iris, new DOMMatrix().translate(W / 2, H / 2));
  if (ip < 1) {
    // lo anterior, afuera del iris
    const outside = new Path2D();
    outside.rect(0, 0, W, H);
    outside.addPath(shape);
    B.save(); G.save();
    B.clip(outside, 'evenodd'); G.clip(outside, 'evenodd');
    drawPrev(cur - 1);
    B.restore(); G.restore();
  }
  B.save(); G.save();
  B.clip(shape); G.clip(shape);
  vignette(B, G, t, cur, L);
  B.restore(); G.restore();
  // el borde del iris, encendido
  const flashA = 1 - span(t, t0, t0 + 0.4);
  if (flashA > 0) {
    const col = CLASSES[VIGNETTES[cur].cls].color;
    G.save();
    G.globalAlpha = flashA;
    G.lineWidth = 8 * flashA + 2;
    G.strokeStyle = col;
    G.stroke(shape);
    G.restore();
  }
}
