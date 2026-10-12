// La pelea de Buba contra Puffy, en la meseta: el cara a cara, el turno que enseña
// cómo se juega, el turno de Puffy que se corta y el final de "¿una más?".
//
// Todo pasa en un mismo escenario con una cámara: los Axies y las cartas viven en el
// mundo (la cámara los mueve); las barras de vida, el número del daño y los
// subtítulos van pegados a la pantalla.
import {
  W, H, b, bspan, span, clamp, lerp, E, btrack, ring, pulse, hash, hr, noise1, TAU, timeWarp,
} from './core.js';
import { img, CLASSES, CARD_H } from './assets.js';
import { drawAxie, clipDur } from './axie.js';
import {
  burst, shockRing, glow, puff, kinetic, measure, IN, OUT, both, beam, confetti, cover,
} from './fx.js';
import {
  applyCam, toScreen, toWorld, card, wellPos, numberHud, numberSprite, popNumber, shatter, claws,
  hpHud, captionBand, caption, turnBanner, countBadge, sweat, dizzy, aura, oddsDial,
} from './pieces.js';
import {
  CUE, HERO_A, HERO_A_SCORE, RIVAL, RIVAL_SCORE, RIVAL_BUST, RIVAL_BUSTED, HERO_C, HERO_C_SCORE, PUFFY_HP,
} from './script.js';

const FEET = 890;
const BUBA = { id: 'buba', x: 330, h: 300 };
const PUFFY = { id: 'puffy', x: 1590, h: 290 };
const DECK = [960, 852];
const DECK_S = 0.55;
const ROW_A = { y: 572, s: 0.78, pitch: 176 };
const ROW_C = { y: 492, s: 0.56, pitch: 124 };
const NUM = [960, 338];
const NUM_C = [960, 296];

/** El tiempo vivido del final: se frena casi hasta parar mientras la carta se da vuelta. */
const slow = timeWarp([[0, 1], [b(100.6), 1], [b(101.2), 0.3], [b(102.6), 0.16], [b(102.95), 0.5], [b(103), 1], [b(124), 1]]);

// =====================================================================
// la cámara
// =====================================================================

function duelCam(t) {
  let x = btrack(t, [[0, 640], [2.4, 640], [3.3, 1280, E.inOutCubic], [4.4, 1280], [6, 960, E.inOutCubic]]);
  let y = btrack(t, [[0, 600], [2, 620], [4.4, 620], [6, 540, E.inOutCubic]]);
  let z = btrack(t, [[0, 1.42], [2, 1.3, E.outCubic], [4.4, 1.3], [6, 1, E.inOutCubic]]);
  // el golpe de Buba: la cámara lo sigue hasta Puffy
  const follow = E.inOutCubic(bspan(t, CUE.lunge - 0.3, CUE.hitA)) * (1 - E.inOutCubic(bspan(t, CUE.hitA + 0.4, CUE.homeA + 0.4)));
  x += follow * 170;
  z += follow * 0.07;
  // el turno de Puffy: se inclina hacia él; después del corte, se le acerca
  const lean = E.inOutCubic(bspan(t, 31.6, 33)) * (1 - E.inOutCubic(bspan(t, 46, 47.3)));
  x += lean * 60;
  const sad = E.inOutSine(bspan(t, 41.5, 46.5)) * (t < b(80) ? 1 : 0);
  x += sad * 120;
  y += sad * 40;
  z += sad * 0.08;
  // al final: la cámara lenta, el golpe y la vuelta atrás
  if (t >= b(80)) {
    const dolly = E.inOutSine(bspan(t, CUE.una, CUE.flip[1] - 0.1)) * (t < b(CUE.drop) ? 1 : 0);
    const f2 = E.inOutCubic(bspan(t, CUE.attack - 0.3, CUE.hit)) * (1 - E.inOutCubic(bspan(t, CUE.hit + 0.5, CUE.ko + 1)));
    const savor = E.inOutSine(bspan(t, CUE.ko + 1, CUE.outro)) * 0.04;
    const out = E.inCubic(bspan(t, CUE.outro, CUE.logo));
    x = 960 + f2 * 170;
    y = 540 + dolly * 25;
    z = 1 + dolly * 0.06 + f2 * 0.07 + savor + out * 0.5 + pulse(t, b(CUE.drop), 5) * 0.06;
  }
  for (const bt of [...CUE.a, ...CUE.b]) z += pulse(t, b(bt), 6) * 0.012;
  return { x, y, z, r: Math.sin(t * 0.6) * 0.003, dolly: t >= b(80) ? E.inOutSine(bspan(t, CUE.una, CUE.flip[1] - 0.1)) : 0 };
}

// =====================================================================
// los Axies
// =====================================================================

/** La animación que corresponde en `t`: la última de la lista que ya empezó. */
function pick(t, segs) {
  let cur = segs[0];
  for (const s of segs) if (t >= b(s[0])) cur = s;
  const [bt, clip, o = {}] = cur;
  let ct = t - b(bt);
  if (o.loopAfter && ct > clipDur(clip)) ct = (ct - clipDur(clip)) % clipDur(o.loopAfter);
  return { clip: o.loopAfter && t - b(bt) > clipDur(clip) ? o.loopAfter : clip, ct, eyes: o.eyes ?? null, mouth: o.mouth ?? null };
}

const BUBA_CLIPS = [
  [0, 'idle'], [CUE.bubaIn, 'stomp', { loopAfter: 'idle' }], [CUE.vs, 'snarl', { eyes: 'eyes-angry', loopAfter: 'idle' }],
  [10.6, 'ready', { loopAfter: 'idle' }], [CUE.a[4], 'cheer', { loopAfter: 'idle' }],
  [CUE.charge, 'ready', { eyes: 'eyes-angry' }], [CUE.lunge, 'attack', { loopAfter: 'idle' }],
  [CUE.homeA, 'cheer', { eyes: 'eyes-happy', loopAfter: 'idle' }],
  [CUE.laugh, 'cheer', { eyes: 'eyes-happy', mouth: 'mouth-open', loopAfter: 'cheer' }], [45, 'idle'],
  [80, 'idle'], [CUE.c[0] - 0.4, 'ready', { loopAfter: 'idle' }], [CUE.short, 'idle', { eyes: 'eyes-angry' }],
  [CUE.beats[0], 'ready', { eyes: 'eyes-angry' }], [CUE.drop, 'cheer', { loopAfter: 'ready' }],
  [CUE.attack, 'attack', { loopAfter: 'idle' }], [CUE.ko + 0.4, 'win', { eyes: 'eyes-happy' }],
];

const PUFFY_CLIPS = [
  [0, 'idle'], [CUE.puffyIn, 'stomp', { loopAfter: 'idle' }], [CUE.vs, 'snarl', { eyes: 'eyes-angry', loopAfter: 'idle' }],
  [CUE.hitA, 'hurt', { eyes: 'eyes-shut', loopAfter: 'idle' }], [CUE.hitA + 1.3, 'idle', { eyes: 'eyes-angry' }],
  [CUE.turnB + 0.8, 'ready', { loopAfter: 'idle' }], [CUE.b[2], 'cheer', { eyes: 'eyes-happy', loopAfter: 'idle' }],
  [CUE.pDraw - 0.2, 'ready', { loopAfter: 'idle' }],
  [CUE.bust, 'whiff', { eyes: 'eyes-shut', loopAfter: 'idle' }], [CUE.bust + 2.2, 'idle', { eyes: 'eyes-shut', mouth: 'mouth-open' }],
  [80, 'idle', { eyes: 'eyes-angry' }], [CUE.short + 0.2, 'snarl', { mouth: 'mouth-open', loopAfter: 'idle' }],
  [CUE.una, 'idle', { eyes: 'eyes-shut' }], [CUE.drop, 'idle', { mouth: 'mouth-open' }],
  [CUE.hit, 'hurt', { eyes: 'eyes-shut' }],
];

/** La caída desde el cielo y el aplastón al tocar el piso. */
function dropIn(t, land) {
  const t0 = land - 0.4;
  if (t < t0) return null;
  const p = span(t, t0, land);
  const y = lerp(-420, 0, E.inQuad(p));
  const sq = ring(t, land, 3, 7) * 0.16;
  return { dy: y, sx: 1 + sq - (1 - p) * 0.12, sy: 1 - sq + (1 - p) * 0.2 };
}

function drawBuba(B, G, t) {
  const land = b(CUE.bubaIn);
  const d = dropIn(t, land);
  if (!d) return;
  let x = BUBA.x;
  let y = FEET + d.dy;
  let hop = 0;
  // los dos golpes: va hasta Puffy, pega y vuelve de un salto
  for (const [l0, hit, home] of [[CUE.lunge, CUE.hitA, CUE.homeA], [CUE.attack, CUE.hit, CUE.hit + 1.5]]) {
    const go = E.inQuad(bspan(t, l0 + 0.1, hit));
    const back = E.inOutCubic(bspan(t, hit + 0.35, home));
    const reach = PUFFY.x - 380;
    if (t >= b(l0) && t < b(home) + 0.05) {
      x = lerp(BUBA.x, reach, go * (1 - back));
      hop = Math.sin(back * Math.PI) * 130;
    }
  }
  y -= hop;
  const a = pick(t, BUBA_CLIPS);
  // el latido de la duda
  const beat = [...CUE.beats, 101, 102].reduce((acc, bt) => acc + pulse(t, b(bt), 9), 0) * (t < b(CUE.drop) && t > b(90) ? 1 : 0);
  drawAxie(B, BUBA.id, {
    px: x, py: y, h: BUBA.h, face: 'right', ...a, sx: d.sx * (1 + beat * 0.025), sy: d.sy * (1 - beat * 0.03), shadow: 0.5 * clamp(1 - Math.abs(d.dy) / 300),
  });
  if (t >= land && t < land + 0.8) {
    puff(B, t, land, x, FEET, 190, '#f1d9b8', 0.6, 11, 6);
    burst(G, t, { x, y: FEET - 20, t0: land, n: 26, seed: 12, speed: [300, 900], life: [0.3, 0.6], drag: 4, gravity: 900, size: [2, 4], colors: ['#ffd9a0', '#ffffff'], dir: -Math.PI / 2, spread: 2.2 });
    shockRing(G, t, land, x, FEET - 10, 320, '#ffd9a0', 0.45, 12);
  }
  // la carga antes de cada golpe
  const charge = window2(t, b(CUE.fly) + 0.25, b(CUE.lunge), b(CUE.hitA)) + window2(t, b(CUE.fly2) + 0.2, b(CUE.attack), b(CUE.hit));
  aura(G, t, x, y - BUBA.h * 0.45, 190, '#ffb347', charge);
  // la duda: sudor
  if (t >= b(CUE.una) + 0.5 && t < b(CUE.drop)) sweat(B, x + 150, y - 300, t, b(CUE.una) + 0.5);
  return x;
}

const window2 = (t, a, c, d) => (t < a || t > d ? 0 : t < c ? E.outCubic(span(t, a, c)) : 1 - span(t, c, d));

function drawPuffy(B, G, t) {
  const land = b(CUE.puffyIn);
  const d = dropIn(t, land);
  if (!d) return;
  let px = PUFFY.x;
  let py = FEET + d.dy;
  let rot = 0;
  let koFace = false;
  // el primer golpe lo empuja y vuelve
  px += (E.outCubic(bspan(t, CUE.hitA, CUE.hitA + 0.4)) - E.inOutCubic(bspan(t, CUE.hitA + 0.6, CUE.hitA + 1.6))) * 60;
  let sx = d.sx;
  let sy = d.sy;
  // el corte: se desinfla
  if (t >= b(CUE.bust) && t < b(48)) {
    const k = E.outCubic(bspan(t, CUE.bust + 0.5, CUE.bust + 1.6));
    sy *= 1 - k * 0.1 + ring(t, b(CUE.bust + 0.5), 2.5, 5) * 0.04;
    sx *= 1 + k * 0.07;
  }
  // el último golpe: vuela panza arriba y queda K.O.
  const hit = b(CUE.hit);
  const ko = b(CUE.ko);
  if (t >= hit && t >= b(80)) {
    const recoil = E.outCubic(span(t, hit, hit + 0.18)) * 40;
    const fly = span(t, ko - 0.12, ko + 0.42);
    px += recoil - E.outQuad(fly) * 30;
    py -= Math.sin(fly * Math.PI) * 240;
    rot = E.inOutCubic(fly) * Math.PI * 1.08;
    if (t >= ko + 0.42) {
      const a = t - ko - 0.42;
      py -= Math.abs(Math.sin(a * 9)) * 60 * Math.exp(-a * 5);
      rot = Math.PI * 1.08 + ring(t, ko + 0.42, 2, 5) * 0.12;
      koFace = true;
    }
  }
  const a = pick(t, PUFFY_CLIPS);
  const pivot = PUFFY.h * 0.45;
  const cx0 = px - Math.sin(rot) * pivot;
  const cy0 = py - pivot + Math.cos(rot) * pivot;
  drawAxie(B, PUFFY.id, {
    px: cx0, py: cy0, h: PUFFY.h, ...a, ct: koFace ? 0.3 : a.ct, mouth: koFace ? 'mouth-open' : a.mouth,
    sx, sy, rot, shadow: rot > 0.3 ? 0 : 0.45 * clamp(1 - Math.abs(d.dy) / 300),
  });
  if (koFace) {
    B.save();
    B.fillStyle = 'rgba(0,0,0,0.4)';
    B.beginPath();
    B.ellipse(px, FEET + 4, 160, 22, 0, 0, TAU);
    B.fill();
    B.restore();
    dizzy(B, G, t, ko + 0.42, px, FEET - 270);
  }
  if (t >= land && t < land + 0.8) {
    puff(B, t, land, PUFFY.x, FEET, 180, '#e6f4ff', 0.6, 21, 6);
    burst(G, t, { x: PUFFY.x, y: FEET - 20, t0: land, n: 26, seed: 22, speed: [300, 900], life: [0.3, 0.6], drag: 4, gravity: 900, size: [2, 4], colors: ['#bfe9ff', '#ffffff'], dir: -Math.PI / 2, spread: 2.2 });
    shockRing(G, t, land, PUFFY.x, FEET - 10, 320, '#bfe9ff', 0.45, 12);
  }
  // el corte y la duda: sudor
  if (t >= b(CUE.bust + 0.4) && t < b(47)) sweat(B, PUFFY.x - 150, FEET - 280, t, b(CUE.bust + 0.4));
  if (t >= b(CUE.short + 1) && t < b(CUE.hit)) sweat(B, PUFFY.x - 150, FEET - 280, t, b(CUE.short + 1), 0.9);
}

// =====================================================================
// el mazo y las cadenas
// =====================================================================

function drawDeck(B, G, t, t0, t1, fromSide, glowIt = 0) {
  const pin = E.outCubic(span(t, t0, t0 + 0.35));
  const pout = E.inCubic(span(t, t1, t1 + 0.35));
  if (pin <= 0 || pout >= 1) return;
  const off = (1 - pin) * fromSide * 900 + pout * fromSide * 900;
  for (let k = 3; k >= 0; k--) {
    card(B, G, [], { x: DECK[0] + k * 4 + off, y: DECK[1] - k * 4, s: DECK_S, back: true });
  }
  if (glowIt > 0) glow(G, DECK[0] + off, DECK[1] - 14, 150, '#ffcf6a', 0.25 * glowIt);
}

/** Cuántas cartas hay en la fila (con decimales mientras llega la última): la fila se recentra. */
function rowCount(t, lands, dur) {
  let n = 0;
  for (const l of lands) n += E.inOutCubic(span(t, b(l) - dur, b(l)));
  return n;
}
const slotX = (i, n, pitch) => 960 + (i - (Math.max(1, n) - 1) / 2) * pitch;

/** Una carta que sale del mazo, vuela dándose vuelta y cae en su lugar de la fila. */
function flying(t, land, tx, ty, S, dur, lift = 150) {
  const t0 = land - dur;
  if (t < t0) return null;
  const p = span(t, t0, land);
  const e = E.inOutCubic(p);
  const sq = ring(t, land, 3.5, 8) * 0.12;
  return {
    x: lerp(DECK[0], tx, e),
    y: lerp(DECK[1] - 12, ty, e) - Math.sin(p * Math.PI) * lift,
    s: lerp(DECK_S, S, E.outCubic(p)) * (1 + Math.sin(p * Math.PI) * 0.16),
    rot: (1 - e) * (tx < DECK[0] ? -0.3 : 0.3),
    flip: Math.PI * (1 - E.inOutCubic(span(p, 0.12, 0.8))),
    sx: 1 + sq, sy: 1 - sq,
    heat: t >= land ? Math.exp(-(t - land) * 4) : 0,
  };
}

/**
 * Una cadena de la fila: las cartas que llegan, las vigas entre los símbolos que
 * comparten, las chapitas con el largo y lo que no suma, apagado.
 *   suck: [t0, t1, destino]  las cartas se van al número (el ataque)
 */
function chainRow(B, G, t, o) {
  const { cards, lands, sym, row, dur, total = lands.length, extra = null, suck = null, color = CLASSES[sym].color, hide = 1 } = o;
  const n = rowCount(t, lands, dur) + (extra ? extra.count(t) : 0);
  const states = cards.map((symbols, i) => {
    const land = b(lands[i]);
    const st = flying(t, land, slotX(i, n, row.pitch), row.y, row.s, dur);
    if (!st) return null;
    if (suck) {
      const k = E.inCubic(span(t, suck[0] + i * 0.025, suck[1] + i * 0.025));
      if (k > 0) {
        st.x = lerp(st.x, suck[2][0], k);
        st.y = lerp(st.y, suck[2][1], k) - Math.sin(k * Math.PI) * 60;
        st.s *= 1 - k * 0.85;
        st.rot += k * (i % 2 ? 1 : -1) * 0.8;
        st.alpha = 1 - span(k, 0.75, 1);
        st.heat = Math.max(st.heat, k);
      }
    }
    return st;
  });
  // las vigas, por detrás de las cartas
  for (let i = 1; i < cards.length; i++) {
    const s0 = states[i - 1];
    const s1 = states[i];
    if (!s0 || !s1) continue;
    const land = b(lands[i]);
    if (t < land - 0.03) continue;
    const p = E.outCubic(span(t, land - 0.02, land + 0.2));
    const [x0, y0] = wellPos(cards[i - 1], sym, s0.x, s0.y, s0.s, s0.rot);
    const [x1, y1] = wellPos(cards[i], sym, s1.x, s1.y, s1.s, s1.rot);
    const fade = Math.min(s0.alpha ?? 1, s1.alpha ?? 1) * hide;
    if (fade < 0.01) continue;
    const heat = (0.75 + 0.25 * Math.sin(t * 5 + i) + Math.exp(-(t - land) * 3) * 0.9) * fade * (o.flicker ? o.flicker(t) : 1);
    beam(B, G, x0, y0, x1, y1, color, t, { p, heat, seed: i + (o.seed ?? 0), bulge: i % 2 ? -0.22 : 0.22, width: row.s * 1.05 });
  }
  // las cartas y sus chapitas
  states.forEach((st, i) => {
    if (!st) return;
    const land = b(lands[i]);
    const landed = t >= land;
    card(B, G, cards[i], {
      ...st, alpha: (st.alpha ?? 1) * hide,
      lit: (s) => (s === sym && landed ? 0.75 + 0.25 * Math.sin(t * 4 + i) + 1.2 * pulse(t, land + 0.04, 5) : 0),
      dim: (s) => (s === sym ? 1 : lerp(1, 0.32, span(t, land + 0.35, land + 0.7))),
      crestPop: (k, s) => (s === sym && landed ? 1 + 0.35 * pulse(t, land + 0.05, 6) : 1),
      crack: o.crack ? o.crack(t) : 0,
    });
    if (landed && t < land + 0.8) {
      const [px, py] = wellPos(cards[i], sym, st.x, st.y, st.s, st.rot);
      burst(G, t, { x: px, y: py, t0: land, n: 20, seed: 10 + i + (o.seed ?? 0), speed: [250, 900], life: [0.25, 0.55], drag: 5, gravity: 500, size: [1.5, 3.5], colors: [color, '#ffffff'] });
      shockRing(G, t, land, px, py, 150 * row.s, color, 0.4, 8);
    }
    if (landed && (st.alpha ?? 1) > 0.5 && !o.noBadges) {
      countBadge(B, G, t, land + 0.1, st.x, st.y - (CARD_H / 2) * st.s - 8 * row.s - 16, i + 1, color, 22 * Math.max(0.75, row.s));
    }
  });
  return { states, n };
}

// =====================================================================
// la escena
// =====================================================================

export function sceneDuel(B, G, t, L) {
  const cam = duelCam(t);
  const late = t >= b(80);
  const dropped = late && t >= b(CUE.drop);
  const tension = late ? bspan(t, CUE.short, CUE.drop - 0.1) * (dropped ? 0 : 1) : 0;

  // ---- el fondo: la meseta, con paralaje y la zoom-dolly del final ----
  const bgZoom = 1.08 + cam.dolly * 0.3 * (dropped ? 1 - E.outExpo(span(t, b(CUE.drop), b(CUE.drop) + 0.4)) : 1);
  B.save();
  B.translate(W / 2, H / 2);
  const pz = 1 + (cam.z - 1) * 0.55;
  B.scale(pz, pz);
  B.translate(-(W / 2 + (cam.x - 960) * 0.55), -(H / 2 + (cam.y - 540) * 0.55));
  cover(B, img['bg:beast'], -500, -200, W + 1000, H + 400, bgZoom, 0.5, 0.5);
  B.restore();
  // tierra y cielo más oscuros, para que se lean las cartas y los números
  const g = B.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, `rgba(12,6,20,${0.5 + tension * 0.3})`);
  g.addColorStop(0.3, `rgba(12,6,20,${0.2 + tension * 0.35})`);
  g.addColorStop(0.72, `rgba(20,8,4,${0.12 + tension * 0.3})`);
  g.addColorStop(1, `rgba(12,4,2,${0.55 + tension * 0.3})`);
  B.fillStyle = g;
  B.fillRect(0, 0, W, H);
  if (tension > 0) {
    const r = B.createRadialGradient(W / 2, H * 0.6, 200, W / 2, H * 0.6, W * 0.7);
    r.addColorStop(0, 'rgba(40,4,0,0)');
    r.addColorStop(1, `rgba(40,4,0,${tension * 0.5})`);
    B.fillStyle = r;
    B.fillRect(0, 0, W, H);
  }
  // polvo que flota a contraluz
  for (let i = 0; i < 34; i++) {
    const st = late ? slow(t) : t;
    const px = ((hash(401, i) * (W + 200) + st * hr(8, 30, 402, i) - (cam.x - 960) * 0.3) % (W + 200) + W + 200) % (W + 200) - 100;
    const py = H * 0.2 + hash(403, i) * H * 0.7 + Math.sin(st * 0.7 + i) * 24;
    glow(G, px, py, hr(2, 5, 404, i), '#ffe2b0', 0.25 + 0.2 * Math.sin(st * 1.7 + i * 2));
  }

  B.save(); G.save();
  applyCam(B, cam); applyCam(G, cam);
  drawBuba(B, G, t);
  drawPuffy(B, G, t);

  // ---- el turno de Buba: la cadena que enseña ----
  let numA = null;
  if (t >= b(CUE.turnA) && t < b(CUE.turnB)) {
    drawDeck(B, G, t, b(CUE.turnA), b(CUE.charge), -1, t < b(CUE.a[0]) ? pulse(t, b(CUE.capDraw) + 0.4, 2) : 0);
    const sink = toWorld(cam, NUM[0], NUM[1] - 40);
    chainRow(B, G, t, { cards: HERO_A, lands: CUE.a, sym: 'beast', row: ROW_A, dur: 0.46, suck: [b(CUE.charge), b(CUE.charge) + 0.3, sink] });
    numA = true;
  }
  // ---- el turno de Puffy: la cadena que se corta ----
  if (t >= b(CUE.turnB) - 0.2 && t < b(48)) rivalTurn(B, G, t, L, cam);
  // ---- el final ----
  let fate = null;
  if (late) fate = finalTurn(B, G, t, L, cam);

  // ---- los golpes ----
  for (const [hit, dmg, seed] of [[CUE.hitA, HERO_A_SCORE.at(-1), 1300], [CUE.hit, HERO_C_SCORE.at(-1), 1400]]) {
    const th = b(hit);
    if (t < th - 0.1 || t > th + 1.4) continue;
    if ((hit === CUE.hit) !== late) continue;
    const hx = PUFFY.x - 20;
    const hy = FEET - 140;
    claws(B, G, t, th - 0.05, hx, hy);
    if (t >= th) {
      burst(G, t, { x: hx, y: hy, t0: th, n: 70, seed, speed: [500, 1800], life: [0.25, 0.7], drag: 4, gravity: 800, size: [2, 5], colors: ['#ffe2a8', '#ffffff', '#ff9a2a'], dir: 0, spread: Math.PI * 1.3 });
      burst(G, t, { x: hx, y: hy - 20, t0: th, n: 14, seed: seed + 1, speed: [300, 800], life: [0.5, 0.9], drag: 3, gravity: 400, size: [5, 9], colors: ['#ffd65c', '#ffffff'], kind: 'star' });
      shockRing(G, t, th, hx, hy, 420, '#ffd08a', 0.5, 18);
      popNumber(B, G, t, th + 0.02, `−${dmg}`, PUFFY.x, FEET - 330, 'red', hit === CUE.hit ? 150 : 130, 1.2);
    }
  }
  B.restore(); G.restore();

  // ---- la pantalla ----
  drawHud(B, G, t, L, cam, { numA, fate, tension, late, dropped });
}

// =====================================================================
// el turno de Puffy
// =====================================================================

function rivalTurn(B, G, t, L, cam) {
  const tb = b(CUE.bust);
  const busted = t >= tb;
  drawDeck(B, G, t, b(CUE.turnB) - 0.2, tb + 1.2, 1, 0);
  // la carta que no encaja: sale despacio, grande, y se da vuelta frente a todos
  const extra = {
    count: (tt) => E.inOutCubic(span(tt, b(CUE.pDraw), b(CUE.pFlip) - 0.1)),
  };
  if (!busted) {
    const scanning = t > b(CUE.scan);
    const res = chainRow(B, G, t, {
      cards: RIVAL, lands: CUE.b, sym: 'aquatic', row: ROW_A, dur: 0.4, extra, seed: 40,
      flicker: (tt) => (tt > b(CUE.scan) ? 0.55 + 0.45 * Math.sin(tt * 50) : 1),
      crack: (tt) => (tt > tb - 0.12 ? span(tt, tb - 0.12, tb) : 0),
    });
    const n = res.n;
    const x3 = slotX(3, n, ROW_A.pitch);
    const d0 = b(CUE.pDraw);
    const d1 = b(CUE.pFlip) - 0.05;
    if (t >= d0) {
      const p = E.inOutCubic(span(t, d0, d1));
      const flip = Math.PI * (1 - E.inOutCubic(span(t, b(CUE.pFlip), b(CUE.pFlip) + 0.3)));
      const shake = scanning ? noise1(t * 40, 3) * 6 : 0;
      const st = {
        x: lerp(DECK[0], x3, p) + shake,
        y: lerp(DECK[1] - 12, ROW_A.y, p) - Math.sin(p * Math.PI) * 200,
        s: lerp(DECK_S, ROW_A.s * 1.12, p) * (1 + Math.sin(p * Math.PI) * 0.35),
        rot: (1 - p) * 0.3 + (scanning ? noise1(t * 30, 8) * 0.03 : 0),
        flip,
      };
      card(B, G, RIVAL_BUST, { ...st, crack: t > tb - 0.12 ? span(t, tb - 0.12, tb) : 0, heat: pulse(t, b(CUE.pFlip) + 0.3, 3) * 0.6, heatColor: '#ff8a7a' });
      // el haz que busca dónde engancharse y no encuentra
      const sp = span(t, b(CUE.scan), tb);
      if (sp > 0) {
        const last = res.states[2];
        const [x0, y0] = wellPos(RIVAL[2], 'aquatic', last.x, last.y, last.s, last.rot);
        RIVAL_BUST.forEach((sym, k) => {
          const [tx, ty] = wellPos(RIVAL_BUST, sym, st.x, st.y, st.s, st.rot);
          const k0 = k * 0.32;
          const reach = E.outCubic(span(sp, k0, k0 + 0.25));
          if (reach <= 0) return;
          const ex = lerp(x0, tx, reach * 0.86);
          const ey = lerp(y0, ty, reach * 0.86);
          G.save();
          G.setLineDash([10, 12]);
          G.lineDashOffset = -t * 200;
          G.lineWidth = 4;
          G.strokeStyle = `rgba(75,184,240,${0.85 * (1 - span(sp, k0 + 0.3, k0 + 0.45)) * (0.6 + 0.4 * Math.sin(t * 40))})`;
          G.beginPath(); G.moveTo(x0, y0); G.lineTo(ex, ey); G.stroke();
          G.restore();
          // la X roja sobre el símbolo que no está
          const xp = span(sp, k0 + 0.25, k0 + 0.34);
          if (xp > 0) {
            const s = 34 * E.outBack(xp) * st.s;
            G.save();
            G.translate(tx, ty);
            G.lineCap = 'round';
            G.lineWidth = 12 * st.s;
            G.strokeStyle = '#ff3b3b';
            G.beginPath(); G.moveTo(-s, -s); G.lineTo(s, s); G.moveTo(s, -s); G.lineTo(-s, s); G.stroke();
            G.restore();
            B.save();
            B.translate(tx, ty);
            B.lineCap = 'round';
            B.lineWidth = 7 * st.s;
            B.strokeStyle = '#ffffff';
            B.beginPath(); B.moveTo(-s, -s); B.lineTo(s, s); B.moveTo(s, -s); B.lineTo(-s, s); B.stroke();
            B.restore();
          }
        });
      }
    }
  } else {
    // todo se rompe
    const n = 4;
    RIVAL.forEach((symbols, i) => {
      shatter(B, () => card(B, null, symbols, { s: 1, crack: 0.55, shadow: 0 }), t, tb + i * 0.018, slotX(i, n, ROW_A.pitch), ROW_A.y, ROW_A.s, 500 + i, 1);
    });
    shatter(B, () => card(B, null, RIVAL_BUST, { s: 1, crack: 0.55, shadow: 0 }), t, tb, slotX(3, n, ROW_A.pitch), ROW_A.y, ROW_A.s * 1.12, 590, 1.3);
    for (let i = 0; i < 4; i++) {
      burst(G, t, { x: slotX(i, n, ROW_A.pitch) + 88, y: ROW_A.y - 30, t0: tb + i * 0.02, n: 16, seed: 700 + i, speed: [200, 700], life: [0.3, 0.7], drag: 3, gravity: 900, size: [1.5, 3], colors: ['#8fe6ff', '#ffffff', '#ff6a5c'] });
    }
  }
}

// =====================================================================
// el final
// =====================================================================

/** La carta de la duda: sube del mazo, flota y se da vuelta en cámara lenta. */
function fateCard(t, n) {
  const l0 = b(CUE.lift);
  const f0 = b(CUE.float);
  const d0 = b(CUE.drop);
  if (t < l0) return null;
  const lift = E.outCubic(span(t, l0, l0 + 0.45));
  const fl = E.inOutCubic(span(t, f0, f0 + 0.9));
  const st = slow(t);
  const flip = btrack(t, [[CUE.flip[0], 0], [102.1, 0.3 * Math.PI, E.inOutSine], [102.75, 0.47 * Math.PI, E.inOutSine], [CUE.drop, Math.PI, E.inCubic]]);
  let x = DECK[0];
  let y = lerp(DECK[1] - 12 - lift * 70, 700, fl);
  let s = lerp(DECK_S, 1.05, fl);
  let rot = Math.sin(st * 2.5) * 0.03 * fl;
  let flipA = Math.PI - flip;
  if (t >= d0) {
    // revelada: un instante al centro y a su lugar en la fila
    const g0 = b(CUE.number) - 0.1;
    const p = E.inOutCubic(span(t, g0, g0 + 0.36));
    const pop = 1 + 0.18 * Math.exp(-(t - d0) * 8);
    x = lerp(960, slotX(8, n, ROW_C.pitch), p);
    y = lerp(700, ROW_C.y, p) - Math.sin(p * Math.PI) * 120;
    s = lerp(1.05 * pop, ROW_C.s, p);
    rot = 0;
    flipA = 0;
  }
  return { x, y, s, rot, flip: flipA, heat: t >= d0 ? Math.exp(-(t - d0) * 3) : lift * 0.35 };
}

function finalTurn(B, G, t, L, cam) {
  const d0 = b(CUE.drop);
  const dropped = t >= d0;
  drawDeck(B, G, t, b(CUE.turnC), b(CUE.drop) + 0.05, -1, t > b(CUE.lift) - 0.3 && !dropped ? 0.5 + 0.5 * Math.sin(t * 7) : 0);
  const sink = toWorld(cam, 960, 680);
  const suck = [b(CUE.charge2), b(CUE.charge2) + 0.3, sink];
  // la novena cuenta en la fila desde que se revela
  const extra = { count: (tt) => E.inOutCubic(span(tt, b(CUE.number) - 0.1, b(CUE.number) + 0.26)) };
  const res = chainRow(B, G, t, {
    cards: HERO_C.slice(0, 8), lands: CUE.c, sym: 'beast', row: ROW_C, dur: 0.3, extra, seed: 60, suck,
  });
  const fate = fateCard(t, res.n);
  if (!fate) return null;
  const inRow = t >= b(CUE.number) + 0.26;
  const fk = E.inCubic(span(t, suck[0] + 8 * 0.025, suck[1] + 8 * 0.025));
  if (fk >= 1) return fate;
  const fx = inRow ? lerp(fate.x, sink[0], fk) : fate.x;
  const fy = inRow ? lerp(fate.y, sink[1], fk) : fate.y;
  // la viga que falta: de la octava a la novena, cuando se revela
  if (dropped) {
    const last = res.states[7];
    if (last && (last.alpha ?? 1) > 0.05) {
      const [x0, y0] = wellPos(HERO_C[7], 'beast', last.x, last.y, last.s, last.rot);
      const [x1, y1] = wellPos(HERO_C[8], 'beast', fx, fy, fate.s * (1 - fk * 0.85), fate.rot);
      beam(B, G, x0, y0, x1, y1, CLASSES.beast.color, t, { p: E.outCubic(span(t, d0 + 0.05, d0 + 0.3)), heat: 2 * (1 - fk) * (1 + Math.exp(-(t - d0) * 2)), seed: 9, width: 0.8 });
    }
  }
  card(B, G, HERO_C[8], {
    ...fate, x: fx, y: fy, s: fate.s * (1 - fk * 0.85), alpha: 1 - span(fk, 0.75, 1),
    lit: (s) => (s === 'beast' && dropped ? 1.8 * Math.exp(-(t - d0) * 1.5) + 0.7 : 0),
    dim: (s) => (s === 'beast' || !dropped ? 1 : lerp(1, 0.32, span(t, d0 + 0.4, d0 + 0.8))),
    crestPop: (k, s) => (s === 'beast' && dropped ? 1 + 0.5 * pulse(t, d0 + 0.02, 4) : 1),
  });
  if (inRow && fk < 0.5) countBadge(B, G, t, b(CUE.number) + 0.3, fx, fy - (CARD_H / 2) * fate.s - 22, 9, CLASSES.beast.color, 22 * 0.75);
  if (!dropped && t >= b(CUE.flip[0])) {
    // el polvo quieto alrededor de la carta: el tiempo casi parado
    for (let k = 0; k < 40; k++) {
      const st = slow(t);
      const ang = hash(1300, k) * TAU;
      const r = 190 + hash(1301, k) * 260 + st * 12;
      glow(G, 960 + Math.cos(ang + st * 0.3) * r, 700 + Math.sin(ang + st * 0.3) * r * 0.6, hr(2, 5, 1302, k), '#ffe0b0', 0.5);
    }
  }
  if (dropped && t < d0 + 1) {
    const [px, py] = wellPos(HERO_C[8], 'beast', 960, 700, 1.05, 0);
    burst(G, t, { x: px, y: py, t0: d0, n: 90, seed: 1500, speed: [600, 2200], life: [0.35, 0.9], drag: 3.5, gravity: 500, size: [2, 5], colors: ['#fff2c8', '#ffc14a', '#ffffff', '#ff8a1c'] });
    shockRing(G, t, d0, px, py, 700, '#ffd08a', 0.6, 26);
    shockRing(G, t, d0 + 0.08, px, py, 460, '#ffffff', 0.45, 10);
  }
  return fate;
}

// =====================================================================
// la pantalla: vida, turno, números y letras
// =====================================================================

function drawHud(B, G, t, L, cam, { late, dropped }) {
  // ---- las barras de vida ----
  const hudIn = t < b(80) ? E.outBack(bspan(t, CUE.hud, CUE.hud + 0.8)) : E.outCubic(bspan(t, CUE.turnC, CUE.turnC + 0.6));
  const hudOut = t < b(80) ? 0 : E.inCubic(bspan(t, CUE.outro, CUE.outro + 0.8));
  const hudA = clamp(hudIn) * (1 - hudOut);
  if (hudA > 0.003) {
    const fill = t < b(80) ? E.outCubic(bspan(t, CUE.hud + 0.3, CUE.hud + 1.8)) : 1;
    const drop = (1 - hudIn) * 140;
    // Puffy: 100, el primer golpe lo deja en 75 y el último en 0
    const h1 = b(CUE.hitA);
    const h2 = b(CUE.hit);
    let hp = PUFFY_HP[0];
    let trail = hp;
    if (t >= h1) {
      hp = lerp(PUFFY_HP[0], PUFFY_HP[1], E.outCubic(span(t, h1 + 0.04, h1 + 0.3)));
      trail = lerp(PUFFY_HP[0], PUFFY_HP[1], E.inOutCubic(span(t, h1 + 0.55, h1 + 1.2)));
    }
    if (late) {
      hp = t < h2 ? PUFFY_HP[1] : lerp(PUFFY_HP[1], PUFFY_HP[2], E.outCubic(span(t, h2 + 0.04, h2 + 0.3)));
      trail = t < h2 ? hp : lerp(PUFFY_HP[1], PUFFY_HP[2], E.inOutCubic(span(t, h2 + 0.55, h2 + 1.2)));
    }
    // el golpe que se está armando, en rojo sobre la vida de Puffy
    let ghost = 0;
    if (late && t >= b(CUE.short) + 0.2 && t < h2) ghost = t >= b(CUE.number) ? HERO_C_SCORE[8] : HERO_C_SCORE[7];
    const flashP = pulse(t, h1, 10) + (late ? pulse(t, h2, 10) : 0);
    hpHud(B, G, t, 'left', { name: 'BUBA', cls: 'beast', hp: 100, alpha: hudA, drop, fill });
    hpHud(B, G, t, 'right', { name: 'PUFFY', cls: 'aquatic', hp, trail, ghost, alpha: hudA, drop, fill, flash: flashP * 0.8 });
    // la flecha de "no alcanza": del daño a la vida de Puffy
    if (late) projection(B, G, t);
  }

  // ---- el cara a cara: nombres y VS ----
  if (t < b(12)) {
    [[BUBA, CUE.bubaIn, 'beast'], [PUFFY, CUE.puffyIn, 'aquatic']].forEach(([ax, land, cls]) => {
      const [sx] = toScreen(cam, ax.x, FEET);
      const anim = both(IN.slam(t, b(land) + 0.12, 0.03, 2.2, 0.26), OUT.up(t, b(CUE.vsOut), 0.02, 60));
      kinetic(B, ax.id.toUpperCase(), sx, 1010, { size: 92, anim, fill: ['#ffffff', CLASSES[cls].glyphHi, CLASSES[cls].color], stroke: CLASSES[cls].edge, strokeW: 0.1 });
    });
    const v0 = b(CUE.vs);
    if (t >= v0 - 0.05) {
      const out = OUT.shrink(t, b(CUE.vsOut), 0.03, 0.26);
      kinetic(B, L.vs, W / 2, 610, {
        size: 300, fill: ['#fffdf0', '#ffd65c', '#ff6a1c'], stroke: '#2a0a02', strokeW: 0.08,
        anim: both((i) => ({ ...IN.slam(t, v0, 0.06, 3.2, 0.3)(i), dx: (i ? 1 : -1) * 260 * (1 - E.outExpo(span(t, v0, v0 + 0.3))) }), out),
      });
      const k = 1 - span(t, v0, v0 + 0.6);
      if (k > 0) {
        burst(G, t, { x: W / 2, y: 520, t0: v0, n: 60, seed: 90, speed: [600, 2000], life: [0.3, 0.8], drag: 3, gravity: 200, size: [2, 5], colors: ['#fff2c8', '#ffc14a', '#ffffff'] });
        shockRing(G, t, v0, W / 2, 520, 800, '#ffe2b0', 0.55, 20);
      }
      glow(G, W / 2, 520, 420, '#ff9a3c', 0.25 * (1 - span(t, b(CUE.vsOut), b(CUE.vsOut) + 0.3)) * (0.6 + 0.4 * Math.exp(-(t - v0) * 3)));
    }
  }

  // ---- el turno ----
  turnBanner(B, G, t, L.turn('BUBA'), 'beast', b(CUE.turnA), b(31.6));
  turnBanner(B, G, t, L.turn('PUFFY'), 'aquatic', b(CUE.turnB), b(44.5));
  if (late) turnBanner(B, G, t, L.turn('BUBA'), 'beast', b(CUE.turnC) + 0.3, b(CUE.una) - 0.2);

  // ---- el daño de Buba, primer turno ----
  if (t >= b(CUE.a[0]) && t < b(CUE.lunge) + 0.1) {
    const keys = CUE.a.map((bt, i) => [b(bt) + 0.05, HERO_A_SCORE[i], `${i + 1} × ${i + 1}`]);
    // se agranda con cada carta que llega del ataque
    const gulp = [0, 1, 2, 3, 4].reduce((acc, i) => acc + pulse(t, b(CUE.charge) + 0.3 + i * 0.025, 8), 0);
    const fly = E.inCubic(bspan(t, CUE.fly, CUE.lunge));
    const [bx, by] = toScreen(cam, BUBA.x, FEET - 170);
    const px = lerp(NUM[0], bx, fly);
    const py = lerp(NUM[1], by, fly) - Math.sin(fly * Math.PI) * 120;
    const size = (150 + gulp * 22) * (1 - fly * 0.6);
    B.save(); G.save();
    numberHud(B, G, t, px, py, size, keys, 'beast', fly > 0.05 ? null : L.dmg);
    B.restore(); G.restore();
    if (fly > 0 && fly < 1) glow(G, px, py - size * 0.3, 160, '#ffb347', 0.7 * fly);
  }

  // ---- el daño de Puffy: 1, 4, 9… y se rompe ----
  if (t >= b(CUE.b[0]) && t < b(CUE.ceroOut) + 0.5) {
    const tb = b(CUE.bust);
    if (t < tb) {
      const keys = CUE.b.map((bt, i) => [b(bt) + 0.05, RIVAL_SCORE[i], `${i + 1} × ${i + 1}`]);
      numberHud(B, G, t, NUM[0], NUM[1], 150, keys, 'aquatic', L.dmg);
    } else {
      const spr = numberSprite(String(RIVAL_SCORE.at(-1)), 150, 'aquatic');
      shatter(B, () => B.drawImage(spr, -spr.width / 2, -spr.height / 2 - 20), t, tb, NUM[0], NUM[1] - 50, 0.9, 800, 0.8);
      const zp = span(t, b(CUE.zero), b(CUE.zero) + 0.5);
      const zOut = E.inBack(bspan(t, CUE.ceroOut, CUE.ceroOut + 0.4));
      if (zp > 0 && zOut < 1) {
        const y = NUM[1] - 600 * (1 - E.outBounce(zp));
        numberHud(B, G, t, NUM[0], y, 170, [[b(CUE.zero), RIVAL_BUSTED]], 'zero', L.dmg, { alpha: 1 - zOut });
      }
    }
    // CERO.
    const cz = b(CUE.cero);
    kinetic(B, L.zero, W / 2, 745, {
      size: 230, fill: ['#ffffff', '#ffd7d2', '#ff4a3a'], stroke: '#2a0303', strokeW: 0.07,
      anim: both(IN.slam(t, cz, 0.05, 3.2, 0.26), OUT.shrink(t, b(CUE.ceroOut), 0.02)),
    });
    kinetic(B, L.broke, W / 2, 822, {
      size: 40, font: 'body', weight: 900, stretch: 'expanded', spacing: 0.2, fill: '#ffd7d2', stroke: '#2a0303', strokeW: 0.14,
      anim: both(IN.pop(t, cz + 0.3, 0.02), OUT.up(t, b(CUE.ceroOut), 0.01, 30)),
    });
    if (t >= cz && t < cz + 0.8) {
      burst(G, t, { x: W / 2, y: 665, t0: cz, n: 40, seed: 900, speed: [300, 1100], life: [0.3, 0.8], drag: 4, gravity: 700, size: [2, 4], colors: ['#ff5a4a', '#ffffff', '#ffb0a0'] });
      puff(B, t, cz + 0.05, W / 2, 745, 320, '#d9e4ee', 0.7, 33, 7);
    }
  }

  // ---- el final: 64, no alcanza, ¿una más? y 81 ----
  if (late) finalHud(B, G, t, L, cam, dropped);

  // ---- los subtítulos ----
  const band = window4b(t, 10.3, 31, 0.5) + window4b(t, CUE.capBut - 0.2, CUE.bust + 0.2, 0.3) + window4b(t, CUE.short, CUE.una - 0.1, 0.3);
  captionBand(B, clamp(band));
  caption(B, t, L.draw, b(CUE.capDraw), b(CUE.capShare) - 0.3);
  caption(B, t, L.share, b(CUE.capShare), b(CUE.capGrow) - 0.25);
  caption(B, t, L.grow, b(CUE.capGrow), b(CUE.capMore) - 0.3, { fill: ['#fffdf0', '#ffd65c', '#ff8a1c'], stroke: '#3a1204' });
  caption(B, t, L.more, b(CUE.capMore), b(CUE.capStand) - 0.3, { fill: ['#fffdf0', '#ffd65c', '#ff8a1c'], stroke: '#3a1204' });
  caption(B, t, L.stand, b(CUE.capStand), b(CUE.capOutA));
  caption(B, t, L.but, b(CUE.capBut), b(CUE.bust) - 0.05, { fill: ['#ffffff', '#cfefff'] });
  if (late) caption(B, t, L.short, b(CUE.short) + 0.25, b(CUE.una) - 0.25, { fill: ['#ffffff', '#ffd2c8'] });
}

/** Una ventana en tiempos musicales con bordes suaves de `e` tiempos. */
const window4b = (t, a, c, e) => {
  if (t < b(a) || t > b(c)) return 0;
  return Math.min(1, span(t, b(a), b(a + e)), 1 - span(t, b(c - e), b(c)));
};

/** "No alcanza": una flecha punteada del daño a lo que le queda a Puffy. */
function projection(B, G, t) {
  const t0 = b(CUE.short);
  const out = E.inCubic(bspan(t, CUE.una - 0.3, CUE.una + 0.2));
  const p = E.outCubic(span(t, t0, t0 + 0.4));
  if (p <= 0 || out >= 1) return;
  const x0 = NUM_C[0] + 110;
  const y0 = NUM_C[1] - 60;
  const x1 = W - 150 - 680 * (PUFFY_HP[1] / 100) + 30;
  const y1 = 96;
  const cx = (x0 + x1) / 2 + 40;
  const cy = Math.min(y0, y1) + 30;
  const pt = (u) => [(1 - u) ** 2 * x0 + 2 * (1 - u) * u * cx + u * u * x1, (1 - u) ** 2 * y0 + 2 * (1 - u) * u * cy + u * u * y1];
  B.save();
  B.globalAlpha = 1 - out;
  B.setLineDash([12, 10]);
  B.lineDashOffset = -t * 60;
  B.lineWidth = 5;
  B.strokeStyle = '#ffffff';
  B.beginPath();
  const N = 30;
  for (let i = 0; i <= N * p; i++) {
    const [px, py] = pt(i / N);
    if (i === 0) B.moveTo(px, py); else B.lineTo(px, py);
  }
  B.stroke();
  B.setLineDash([]);
  if (p > 0.95) {
    const [ax, ay] = pt(1);
    const [bx, by] = pt(0.94);
    const ang = Math.atan2(ay - by, ax - bx);
    B.translate(ax, ay);
    B.rotate(ang);
    B.fillStyle = '#ffffff';
    B.beginPath(); B.moveTo(8, 0); B.lineTo(-14, -11); B.lineTo(-14, 11); B.closePath(); B.fill();
  }
  B.restore();
}

function finalHud(B, G, t, L, cam, dropped) {
  const d0 = b(CUE.drop);
  // el número del daño, arriba: 1, 4, 9… 64
  if (t >= b(CUE.c[0]) && t < d0) {
    const keys = CUE.c.map((bt, i) => [b(bt) + 0.04, HERO_C_SCORE[i], `${i + 1} × ${i + 1}`]);
    numberHud(B, G, t, NUM_C[0], NUM_C[1], 140, keys, 'beast', L.dmg);
  }
  // la rueda de chances
  const dialA = clamp((t - b(CUE.dial)) / 0.3) * (1 - span(t, b(CUE.float), b(CUE.float) + 0.4));
  const v = btrack(t, [[CUE.dial, 0.82], [CUE.dial + 0.4, 0.38, E.outBack], [100, 0.36]]);
  const beat = CUE.beats.reduce((acc, bt) => acc + pulse(t, b(bt), 8), 0);
  oddsDial(B, G, t, 1190, 830, v, dialA, L.odds, beat);
  // ¿UNA MÁS?
  const tension = bspan(t, CUE.short, CUE.drop - 0.1) * (dropped ? 0 : 1);
  const qOut = OUT.shrink(t, b(CUE.float) - 0.25, 0.025, 0.24);
  const tremble = (i) => ({ dx: noise1(t * 20 + i * 3, 5) * tension * 3, dy: noise1(t * 20 + i * 3, 9) * tension * 3 });
  const thump = 1 + beat * 0.07;
  const size = 150;
  const w1 = measure(B, L.one, size);
  const w2 = measure(B, L.more2, size);
  const gap = 60;
  const qx1 = W / 2 - (w1 + gap + w2) / 2 + w1 / 2;
  const qx2 = qx1 + w1 / 2 + gap + w2 / 2;
  const q = (tt, i) => {
    const a = IN.slam(t, tt, 0.04, 2.8, 0.26)(i);
    const tr = tremble(i);
    return { ...a, dx: tr.dx, dy: tr.dy, sx: (a.sx ?? 1) * thump, sy: (a.sy ?? 1) * thump };
  };
  kinetic(B, L.one, qx1, 745, { size, anim: both((i) => q(b(CUE.una), i), qOut) });
  kinetic(B, L.more2, qx2, 745, { size, fill: ['#fffdf0', '#ffd65c', '#ff8a1c'], stroke: '#3a1204', anim: both((i) => q(b(CUE.mas), i + 4), qOut) });
  // 81: grande al centro, y después vuela hasta Buba
  if (dropped) {
    const nt = b(CUE.number);
    const fly = E.inCubic(bspan(t, CUE.fly2, CUE.attack));
    if (t >= nt && fly < 1) {
      const [bx, by] = toScreen(cam, BUBA.x, FEET - 170);
      const gulp = [...Array(9)].reduce((acc, _, i) => acc + pulse(t, b(CUE.charge2) + 0.3 + i * 0.025, 8), 0);
      const px = lerp(W / 2, bx, fly);
      const py = lerp(800, by, fly) - Math.sin(fly * Math.PI) * 140;
      const s = (270 + gulp * 18) * (1 - fly * 0.7);
      numberHud(B, G, t, px, py, s, [[nt, HERO_C_SCORE[8], fly > 0.05 ? null : '9 × 9']], 'gold', null);
      if (t < nt + 1) {
        burst(G, t, { x: W / 2, y: 640, t0: nt, n: 40, seed: 1600, speed: [500, 1600], life: [0.4, 0.9], drag: 3, gravity: 300, size: [3, 7], colors: ['#ffe066', '#ffffff', '#ffb02e'], kind: 'star' });
      }
    }
    confetti(B, t, { t0: nt, n: 110, seed: 1650, cx: W / 2, cy: 700, speed: [700, 1700] });
  }
  // K.O.
  const ko = b(CUE.ko);
  if (t >= ko) {
    kinetic(B, L.ko, W / 2, 430, {
      size: 190, fill: ['#fffbe0', '#ffe066', '#ff9d1a'], stroke: '#3b1500', strokeW: 0.09,
      anim: both(IN.slam(t, ko + 0.05, 0.04, 3, 0.28), OUT.shrink(t, b(CUE.outro) + 0.3, 0.02)),
    });
    confetti(B, t, { t0: ko + 0.2, n: 150, seed: 1700, rain: true, spawn: 2.5, life: [4, 6] });
  }
}
