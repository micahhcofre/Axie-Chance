// La pelea sin fin: el video de fondo de la portada del juego.
//
// Buba contra Puffy en la meseta, sin un texto ni una barra: es un fondo, y lo que dice
// lo dice peleando. Tres actos que empalman consigo mismos, así el video se repite sin
// que se note la costura:
//
//   A  0-8,4 s     Buba encadena cinco cartas (las vigas unen las patas), carga y pega.
//   B  8,4-15,6 s  Puffy encadena tres, se estira por una cuarta que no comparte nada:
//                  la cadena se rompe en pedazos, Puffy se desinfla y Buba se ríe.
//   C  15,6-26 s   Buba va por todo: nueve cartas, el golpe grande, Puffy sale volando,
//                  rebota mareado y se levanta. Todo vuelve a su lugar.
//
// Las cadenas son las del tráiler (`script.js`), jugadas con `playCard()`/`scoreChain()`,
// así el −25 y el −81 son números de las reglas. Está pensada para dos cortes —apaisado
// (1920×1080) y parado (1080×1920, `?size=1080x1920`)—: todo se ubica con `layout()`,
// que mira `W` y `H`, y en el parado los Axies van más juntos y la fila más arriba.
//
// Lo que hace que empalme: la cámara y el polvo son periódicos en `LOOP`, y el
// respirar de los Axies al final se cuenta hacia atrás desde `LOOP`, así el último
// cuadro de quietud es el primero.
import { W, H, span, clamp, lerp, E, ring, pulse, hash, hr, noise1, TAU } from './core.js';
import { img, CLASSES, CARD_H } from './assets.js';
import { drawAxie, clipDur } from './axie.js';
import { burst, shockRing, glow, puff, beam, cover } from './fx.js';
import { applyCam, toScreen, card, wellPos, popNumber, shatter, claws, sweat, dizzy, aura } from './pieces.js';
import { HERO_A, HERO_A_SCORE, RIVAL, RIVAL_BUST, HERO_C, HERO_C_SCORE } from './script.js';

/** Cuánto dura una vuelta, en segundos. */
export const LOOP = 26;

/** Los tiempos de la vuelta, en segundos. */
const T = {
  // A: Buba encadena y pega
  deckA: 0.9, a: [2.0, 2.85, 3.6, 4.3, 4.95], chargeA: 5.55, lungeA: 5.95, hitA: 6.35, homeA: 7.35,
  // B: Puffy se corta
  deckB: 8.4, bb: [9.4, 10.15, 10.9], bustDraw: 11.6, bust: 12.55, laugh: 12.9,
  // C: Buba va por todo
  deckC: 15.6, c: [16.6, 17.05, 17.5, 17.95, 18.4, 18.85, 19.4, 20.0, 20.8],
  chargeC: 21.4, lungeC: 21.85, hitC: 22.25, ko: 22.55, land: 23.25, up: 24.7, homeC: 23.4, calm: 25.2,
};

/** Dónde va cada cosa. Apaisado: los dos en el tercio de abajo; parado, más juntos. */
function layout() {
  const tall = H > W;
  return tall ? {
    tall, feet: 1330, bubaX: 285, puffyX: 800, axH: 270,
    deck: [540, 1290], deckS: 0.42,
    rowA: { y: 860, s: 0.6, pitch: 136 }, rowC: { y: 800, s: 0.38, pitch: 96 },
    cam: [540, 1010], bgZoom: 1.18,
  } : {
    tall, feet: 940, bubaX: 500, puffyX: 1420, axH: 300,
    deck: [960, 905], deckS: 0.46,
    rowA: { y: 520, s: 0.68, pitch: 156 }, rowC: { y: 500, s: 0.47, pitch: 110 },
    // La cámara mira 90px más abajo que el medio de la escena: en la portada acostada
    // los botones tapan el tercio de abajo, y así los dos pisan más arriba.
    cam: [960, 650], bgZoom: 1.1,
  };
}

// =====================================================================
// la cámara: periódica, con tres empujes
// =====================================================================

const bump = (t, a, c, d, e) => (t < a || t > e ? 0 : t < c ? E.inOutCubic(span(t, a, c)) : t < d ? 1 : 1 - E.inOutCubic(span(t, d, e)));

function loopCam(t, L) {
  const w = (TAU * t) / LOOP;
  let x = L.cam[0] + Math.sin(w) * 26;
  let y = L.cam[1] + Math.sin(w * 2) * 10;
  let z = 1 + 0.015 * (1 - Math.cos(w));
  // cada cadena: la cámara se arrima a la fila
  z += bump(t, T.deckA, T.a[2], T.chargeA, T.homeA + 0.4) * 0.06;
  z += bump(t, T.deckB, T.bb[2], T.bust, T.bust + 2.5) * 0.06;
  z += bump(t, T.deckC, T.c[8], T.chargeC, T.up) * 0.1;
  // los golpes: sigue a Buba hasta Puffy
  const f1 = bump(t, T.lungeA - 0.2, T.hitA, T.hitA + 0.4, T.homeA + 0.3);
  const f2 = bump(t, T.lungeC - 0.2, T.hitC, T.land, T.up);
  x += (f1 * 0.6 + f2) * (L.puffyX - L.cam[0]) * 0.35;
  z += f1 * 0.05 + f2 * 0.09 + pulse(t, T.hitC, 5) * 0.05;
  // el corte: se va hacia Puffy
  x += bump(t, T.bust - 0.3, T.bust + 0.4, T.laugh + 1.4, T.deckC) * (L.puffyX - L.cam[0]) * 0.18;
  for (const l of [...T.a, ...T.bb, ...T.c]) z += pulse(t, l, 6) * 0.01;
  return { x, y, z, r: Math.sin(w * 3) * 0.003 };
}

/** Los golpes: sacuden la cámara y encienden el revelado. [t, fuerza, x, y, color] */
function impacts(L) {
  return [
    ...T.a.map((l) => [l, 0.14]), [T.hitA, 0.85, L.puffyX, L.feet - 150, '#ffe6c8'],
    ...T.bb.map((l) => [l, 0.12]), [T.bust, 0.95, L.deck[0], L.rowA.y, '#ff3b3b'],
    ...T.c.map((l, i) => [l, i < 6 ? 0.08 : 0.2]), [T.hitC, 1.2, L.puffyX, L.feet - 150, '#fff4d6'],
    [T.land, 0.5, L.puffyX, L.feet],
  ];
}

function shakeAt(t, L) {
  let sx = 0;
  let sy = 0;
  let r = 0;
  for (const [t0, s] of impacts(L)) {
    const a = t - t0;
    if (a < 0 || a > 0.7) continue;
    const env = s * Math.exp(-a * 8) * (1 - a / 0.7);
    sx += noise1(a * 34, t0 * 13) * 30 * env;
    sy += noise1(a * 34, t0 * 13 + 5) * 30 * env;
    r += noise1(a * 26, t0 * 13 + 9) * 0.014 * env;
  }
  return { sx, sy, r };
}

// =====================================================================
// los Axies
// =====================================================================

/**
 * La animación que corresponde en `t`: la última de la lista que ya empezó. La primera
 * y la última quietud cuentan el respirar desde el borde de la vuelta, así empalman.
 */
function clipAt(id, t, segs) {
  let cur = segs[0];
  for (const s of segs) if (t >= s[0]) cur = s;
  const [t0, clip, o = {}] = cur;
  const d = clipDur(clip, id);
  let ct = t - t0;
  if (o.edge) ct = (((t % d) + d) % d);
  else if (o.tail) ct = ((((t - LOOP) % d) + d) % d);
  let name = clip;
  if (o.then && ct > d) {
    const d2 = clipDur(o.then, id);
    ct = (ct - d) % d2;
    name = o.then;
  }
  return { clip: name, ct, eyes: o.eyes ?? null, mouth: o.mouth ?? null };
}

const BUBA_CLIPS = [
  [0, 'idle', { edge: true }],
  [T.deckA + 0.3, 'ready', { then: 'idle' }], [T.a[4], 'cheer', { eyes: 'eyes-happy', then: 'idle' }],
  [T.chargeA, 'ready', { eyes: 'eyes-angry' }], [T.lungeA, 'attack', { then: 'idle' }],
  [T.homeA, 'cheer', { eyes: 'eyes-happy', then: 'idle' }],
  [T.laugh, 'cheer', { eyes: 'eyes-happy', mouth: 'mouth-open', then: 'cheer' }], [T.laugh + 2.2, 'idle'],
  [T.deckC + 0.3, 'ready', { then: 'idle' }], [T.c[6], 'ready', { eyes: 'eyes-angry', then: 'ready' }],
  [T.lungeC, 'attack', { then: 'idle' }], [T.ko, 'win', { eyes: 'eyes-happy' }],
  [T.calm - 0.6, 'idle', { tail: true }],
];

const PUFFY_CLIPS = [
  [0, 'idle', { edge: true }],
  [T.hitA, 'hurt', { eyes: 'eyes-shut', then: 'idle' }], [T.hitA + 1.3, 'idle', { eyes: 'eyes-angry' }],
  [T.deckB + 0.3, 'ready', { then: 'idle' }], [T.bb[2], 'cheer', { eyes: 'eyes-happy', then: 'idle' }],
  [T.bustDraw, 'ready', { then: 'idle' }],
  [T.bust, 'whiff', { eyes: 'eyes-shut', then: 'idle' }], [T.bust + 1.8, 'idle', { eyes: 'eyes-shut', mouth: 'mouth-open' }],
  [T.deckC, 'idle', { eyes: 'eyes-angry' }], [T.c[7], 'idle', { eyes: 'eyes-shut' }],
  [T.hitC, 'hurt', { eyes: 'eyes-shut' }],
  [T.up, 'stomp', { eyes: 'eyes-angry', then: 'idle' }],
  [T.calm, 'idle', { tail: true }],
];

const envelope = (t, a, c, d) => (t < a || t > d ? 0 : t < c ? E.outCubic(span(t, a, c)) : 1 - span(t, c, d));

function drawBuba(B, G, t, L) {
  let x = L.bubaX;
  let hop = 0;
  for (const [l0, hit, home] of [[T.lungeA, T.hitA, T.homeA], [T.lungeC, T.hitC, T.homeC]]) {
    if (t < l0 || t > home + 0.05) continue;
    const go = E.inQuad(span(t, l0 + 0.1, hit));
    const back = E.inOutCubic(span(t, hit + 0.35, home));
    // se frena a un cuerpo de Puffy: el zarpazo llega, el Axie no se le mete adentro
    x = lerp(L.bubaX, L.puffyX - Math.sign(L.puffyX - L.bubaX) * L.axH * 1.25, go * (1 - back));
    hop = Math.sin(back * Math.PI) * L.axH * 0.42;
  }
  const y = L.feet - hop;
  drawAxie(B, 'buba', { px: x, py: y, h: L.axH, face: 'right', ...clipAt('buba', t, BUBA_CLIPS), shadow: 0.5 });
  const charge = envelope(t, T.chargeA, T.lungeA, T.hitA) + envelope(t, T.chargeC - 0.2, T.lungeC, T.hitC);
  aura(G, t, x, y - L.axH * 0.45, L.axH * 0.64, '#ffb347', charge);
  if (t >= T.c[7] && t < T.chargeC) sweat(B, x + L.axH * 0.5, y - L.axH, t, T.c[7], 1.0, 0.8);
}

function drawPuffy(B, G, t, L) {
  let px = L.puffyX;
  let py = L.feet;
  let rot = 0;
  let sx = 1;
  let sy = 1;
  let face = null;
  // el primer golpe lo empuja y vuelve
  px += (E.outCubic(span(t, T.hitA, T.hitA + 0.4)) - E.inOutCubic(span(t, T.hitA + 0.6, T.hitA + 1.6))) * 60 * Math.sign(L.puffyX - L.bubaX);
  // el corte: se desinfla y se vuelve a inflar
  if (t >= T.bust && t < T.deckC) {
    const k = E.outCubic(span(t, T.bust + 0.4, T.bust + 1.4)) * (1 - E.inOutCubic(span(t, T.deckC - 1.2, T.deckC - 0.2)));
    sy *= 1 - k * 0.1 + ring(t, T.bust + 0.4, 2.5, 5) * 0.04;
    sx *= 1 + k * 0.07;
  }
  // el golpe grande: vuela panza arriba, rebota, queda mareado y se levanta de un salto
  if (t >= T.hitC && t < T.up + 0.5) {
    const dir = Math.sign(L.puffyX - L.bubaX);
    const recoil = E.outCubic(span(t, T.hitC, T.hitC + 0.18)) * 40;
    const fly = span(t, T.ko - 0.1, T.land);
    px += (recoil + Math.sin(fly * Math.PI) * 50) * dir;
    py -= Math.sin(fly * Math.PI) * L.axH * 0.9;
    rot = E.inOutCubic(fly) * Math.PI * 1.08 * dir;
    if (t >= T.land) {
      const a = t - T.land;
      py -= Math.abs(Math.sin(a * 9)) * 50 * Math.exp(-a * 5);
      rot = Math.PI * 1.08 * dir + ring(t, T.land, 2, 5) * 0.12;
      face = 'ko';
      // de un salto, se da vuelta y cae parado
      const upP = span(t, T.up - 0.1, T.up + 0.4);
      if (upP > 0) {
        py -= Math.sin(upP * Math.PI) * L.axH * 0.5;
        rot = lerp(Math.PI * 1.08 * dir, 2 * Math.PI * dir, E.inOutCubic(upP));
        face = upP < 0.5 ? 'ko' : null;
      }
    }
  }
  const a = clipAt('puffy', t, PUFFY_CLIPS);
  const pivot = L.axH * 0.45;
  drawAxie(B, 'puffy', {
    px: px - Math.sin(rot) * pivot, py: py - pivot + Math.cos(rot) * pivot, h: L.axH, ...a,
    ct: face === 'ko' ? 0.3 : a.ct, mouth: face === 'ko' ? 'mouth-open' : a.mouth, eyes: face === 'ko' ? 'eyes-shut' : a.eyes,
    sx, sy, rot, shadow: Math.abs(Math.sin(rot / 2)) > 0.3 ? 0.15 : 0.45,
  });
  if (face === 'ko' && t > T.land) dizzy(B, G, t, T.land, px, L.feet - L.axH * 0.85, L.axH * 0.38, 0.9);
  if (t >= T.up + 0.3 && t < T.up + 1) {
    puff(B, t, T.up + 0.3, L.puffyX, L.feet, 170, '#f1d9b8', 0.6, 21, 5);
  }
  if (t >= T.land && t < T.land + 0.8) {
    puff(B, t, T.land, px, L.feet, 220, '#f1d9b8', 0.7, 31, 7);
    shockRing(G, t, T.land, px, L.feet - 10, 360, '#ffd9a0', 0.45, 12);
  }
  if (t >= T.bust + 0.4 && t < T.deckC - 0.5) sweat(B, L.puffyX - L.axH * 0.5, L.feet - L.axH * 0.95, t, T.bust + 0.4);
}

// =====================================================================
// el mazo y las cadenas (lo mismo que `duel.js`, ubicado por `layout()`)
// =====================================================================

function drawDeck(B, G, t, L, t0, t1, side) {
  const pin = E.outCubic(span(t, t0, t0 + 0.35));
  const pout = E.inCubic(span(t, t1, t1 + 0.35));
  if (pin <= 0 || pout >= 1) return;
  const off = ((1 - pin) + pout) * side * W * 0.5;
  for (let k = 3; k >= 0; k--) card(B, G, [], { x: L.deck[0] + k * 4 + off, y: L.deck[1] - k * 4, s: L.deckS, back: true });
}

function rowCount(t, lands, dur) {
  let n = 0;
  for (const l of lands) n += E.inOutCubic(span(t, l - dur, l));
  return n;
}
const slotX = (L, i, n, pitch) => L.deck[0] + (i - (Math.max(1, n) - 1) / 2) * pitch;

function flying(t, L, land, tx, ty, S, dur, lift = 150) {
  const t0 = land - dur;
  if (t < t0) return null;
  const p = span(t, t0, land);
  const e = E.inOutCubic(p);
  const sq = ring(t, land, 3.5, 8) * 0.12;
  return {
    x: lerp(L.deck[0], tx, e),
    y: lerp(L.deck[1] - 12, ty, e) - Math.sin(p * Math.PI) * lift,
    s: lerp(L.deckS, S, E.outCubic(p)) * (1 + Math.sin(p * Math.PI) * 0.16),
    rot: (1 - e) * (tx < L.deck[0] ? -0.3 : 0.3),
    flip: Math.PI * (1 - E.inOutCubic(span(p, 0.12, 0.8))),
    sx: 1 + sq, sy: 1 - sq,
    heat: t >= land ? Math.exp(-(t - land) * 4) : 0,
  };
}

/**
 * Una cadena: las cartas que llegan, las vigas entre los símbolos que comparten y lo que
 * no suma, apagado. `suck` manda las cartas al que carga el golpe; `extra` hace lugar
 * para una carta que todavía no llegó.
 */
function chainRow(B, G, t, L, o) {
  const { cards, lands, sym, row, dur, suck = null, extra = 0, seed = 0 } = o;
  const color = CLASSES[sym].color;
  const n = rowCount(t, lands, dur) + extra;
  const states = cards.map((symbols, i) => {
    const st = flying(t, L, lands[i], slotX(L, i, n, row.pitch), row.y, row.s, dur);
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
  for (let i = 1; i < cards.length; i++) {
    const s0 = states[i - 1];
    const s1 = states[i];
    if (!s0 || !s1 || t < lands[i] - 0.03) continue;
    const p = E.outCubic(span(t, lands[i] - 0.02, lands[i] + 0.2));
    const [x0, y0] = wellPos(cards[i - 1], sym, s0.x, s0.y, s0.s, s0.rot);
    const [x1, y1] = wellPos(cards[i], sym, s1.x, s1.y, s1.s, s1.rot);
    const fade = Math.min(s0.alpha ?? 1, s1.alpha ?? 1);
    if (fade < 0.01) continue;
    const heat = (0.75 + 0.25 * Math.sin(t * 5 + i) + Math.exp(-(t - lands[i]) * 3) * 0.9) * fade;
    beam(B, G, x0, y0, x1, y1, color, t, { p, heat, seed: i + seed, bulge: i % 2 ? -0.22 : 0.22, width: row.s * 1.05 });
  }
  states.forEach((st, i) => {
    if (!st) return;
    const land = lands[i];
    const landed = t >= land;
    card(B, G, cards[i], {
      ...st,
      lit: (s) => (s === sym && landed ? 0.75 + 0.25 * Math.sin(t * 4 + i) + 1.2 * pulse(t, land + 0.04, 5) : 0),
      dim: (s) => (s === sym ? 1 : lerp(1, 0.32, span(t, land + 0.35, land + 0.7))),
      crestPop: (k, s) => (s === sym && landed ? 1 + 0.35 * pulse(t, land + 0.05, 6) : 1),
      crack: o.crack ? o.crack(t) : 0,
    });
    if (landed && t < land + 0.8) {
      const [px, py] = wellPos(cards[i], sym, st.x, st.y, st.s, st.rot);
      burst(G, t, { x: px, y: py, t0: land, n: 18, seed: 10 + i + seed, speed: [250, 900], life: [0.25, 0.55], drag: 5, gravity: 500, size: [1.5, 3.5], colors: [color, '#ffffff'] });
      shockRing(G, t, land, px, py, 150 * row.s, color, 0.4, 8);
    }
  });
  return { states, n };
}

// =====================================================================
// los tres actos
// =====================================================================

function actA(B, G, t, L) {
  if (t < T.deckA || t > T.homeA + 0.5) return;
  drawDeck(B, G, t, L, T.deckA, T.chargeA, -1);
  chainRow(B, G, t, L, {
    cards: HERO_A, lands: T.a, sym: 'beast', row: L.rowA, dur: 0.44,
    suck: [T.chargeA, T.chargeA + 0.3, [L.bubaX, L.feet - L.axH * 0.5]],
  });
}

function actB(B, G, t, L) {
  if (t < T.deckB - 0.2 || t > T.bust + 2) return;
  drawDeck(B, G, t, L, T.deckB - 0.2, T.bust + 0.6, 1);
  const n = 4;
  if (t < T.bust) {
    const crack = (tt) => (tt > T.bust - 0.15 ? span(tt, T.bust - 0.15, T.bust) : 0);
    const extra = E.inOutCubic(span(t, T.bustDraw, T.bustDraw + 0.5));
    const res = chainRow(B, G, t, L, { cards: RIVAL, lands: T.bb, sym: 'aquatic', row: L.rowA, dur: 0.4, extra, seed: 40, crack });
    // la carta que no encaja: sube grande, se da vuelta frente a todos y tiembla
    if (t >= T.bustDraw) {
      const p = E.inOutCubic(span(t, T.bustDraw, T.bustDraw + 0.55));
      const flip = Math.PI * (1 - E.inOutCubic(span(t, T.bustDraw + 0.4, T.bustDraw + 0.75)));
      const nerve = span(t, T.bustDraw + 0.8, T.bust);
      const x = lerp(L.deck[0], slotX(L, 3, res.n, L.rowA.pitch), p) + noise1(t * 40, 3) * 7 * nerve;
      const y = lerp(L.deck[1] - 12, L.rowA.y, p) - Math.sin(p * Math.PI) * 200;
      card(B, G, RIVAL_BUST, {
        x, y, s: lerp(L.deckS, L.rowA.s * 1.12, p) * (1 + Math.sin(p * Math.PI) * 0.3),
        rot: (1 - p) * 0.3 + noise1(t * 30, 8) * 0.04 * nerve, flip,
        crack: crack(t), heat: nerve * 0.7, heatColor: '#ff8a7a',
      });
      if (nerve > 0) glow(G, x, y, 160 * L.rowA.s, '#ff3b3b', nerve * (0.5 + 0.5 * Math.sin(t * 30)) * 0.5);
    }
  } else {
    RIVAL.forEach((symbols, i) => {
      shatter(B, () => card(B, null, symbols, { s: 1, crack: 0.55, shadow: 0 }), t, T.bust + i * 0.018, slotX(L, i, n, L.rowA.pitch), L.rowA.y, L.rowA.s, 500 + i, 1);
    });
    shatter(B, () => card(B, null, RIVAL_BUST, { s: 1, crack: 0.55, shadow: 0 }), t, T.bust, slotX(L, 3, n, L.rowA.pitch), L.rowA.y, L.rowA.s * 1.12, 590, 1.3);
    for (let i = 0; i < 4; i++) {
      burst(G, t, { x: slotX(L, i, n, L.rowA.pitch), y: L.rowA.y - 30, t0: T.bust + i * 0.02, n: 16, seed: 700 + i, speed: [200, 700], life: [0.3, 0.7], drag: 3, gravity: 900, size: [1.5, 3], colors: ['#8fe6ff', '#ffffff', '#ff6a5c'] });
    }
    shockRing(G, t, T.bust, L.deck[0], L.rowA.y, 520, '#ff3b3b', 0.5, 16);
  }
}

function actC(B, G, t, L) {
  if (t < T.deckC || t > T.hitC + 0.5) return;
  drawDeck(B, G, t, L, T.deckC, T.chargeC, -1);
  chainRow(B, G, t, L, {
    cards: HERO_C, lands: T.c, sym: 'beast', row: L.rowC, dur: 0.36, seed: 80,
    suck: [T.chargeC, T.chargeC + 0.3, [L.bubaX, L.feet - L.axH * 0.5]],
  });
}

function hits(B, G, t, L) {
  for (const [th, dmg, seed, big] of [[T.hitA, HERO_A_SCORE.at(-1), 1300, false], [T.hitC, HERO_C_SCORE.at(-1), 1400, true]]) {
    if (t < th - 0.1 || t > th + 1.4) continue;
    const hx = L.puffyX - Math.sign(L.puffyX - L.bubaX) * 20;
    const hy = L.feet - L.axH * 0.47;
    claws(B, G, t, th - 0.05, hx, hy, '#ff9a3c', big ? 1.4 : 1);
    if (t < th) continue;
    burst(G, t, { x: hx, y: hy, t0: th, n: big ? 110 : 70, seed, speed: [500, big ? 2400 : 1800], life: [0.25, 0.8], drag: 4, gravity: 800, size: [2, 5], colors: ['#ffe2a8', '#ffffff', '#ff9a2a'], dir: L.puffyX > L.bubaX ? 0 : Math.PI, spread: Math.PI * 1.3 });
    burst(G, t, { x: hx, y: hy - 20, t0: th, n: big ? 24 : 14, seed: seed + 1, speed: [300, 900], life: [0.5, 1], drag: 3, gravity: 400, size: [5, 9], colors: ['#ffd65c', '#ffffff'], kind: 'star' });
    shockRing(G, t, th, hx, hy, big ? 620 : 420, '#ffd08a', 0.5, big ? 26 : 18);
    popNumber(B, G, t, th + 0.02, `−${dmg}`, L.puffyX, L.feet - L.axH * 1.15, 'red', big ? (L.tall ? 130 : 150) : (L.tall ? 104 : 120), 1.2);
  }
}

// =====================================================================
// el cuadro
// =====================================================================

export function frameLoop(B, G, tIn) {
  const t = ((tIn % LOOP) + LOOP) % LOOP;
  const L = layout();
  B.setTransform(1, 0, 0, 1, 0, 0);
  G.setTransform(1, 0, 0, 1, 0, 0);
  B.globalAlpha = 1; G.globalAlpha = 1;
  B.globalCompositeOperation = 'source-over';
  G.globalCompositeOperation = 'source-over';
  B.fillStyle = '#04040a';
  B.fillRect(0, 0, W, H);
  G.fillStyle = '#000000';
  G.fillRect(0, 0, W, H);
  G.globalCompositeOperation = 'lighter';

  const sh = shakeAt(t, L);
  const cam = loopCam(t, L);
  B.save(); G.save();
  B.translate(W / 2 + sh.sx, H / 2 + sh.sy); B.rotate(sh.r); B.translate(-W / 2, -H / 2);
  G.translate(W / 2 + sh.sx, H / 2 + sh.sy); G.rotate(sh.r); G.translate(-W / 2, -H / 2);

  // el fondo: la meseta, con paralaje
  B.save();
  B.translate(W / 2, H / 2);
  const pz = 1 + (cam.z - 1) * 0.55;
  B.scale(pz, pz);
  B.translate(-(W / 2 + (cam.x - L.cam[0]) * 0.55), -(H / 2 + (cam.y - L.cam[1]) * 0.55));
  cover(B, img['bg:beast'], -W * 0.26, -H * 0.19, W * 1.52, H * 1.38, L.bgZoom, 0.5, L.tall ? 0.62 : 0.5);
  B.restore();
  const g = B.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(12,6,20,0.45)');
  g.addColorStop(0.35, 'rgba(12,6,20,0.12)');
  g.addColorStop(0.75, 'rgba(20,8,4,0.12)');
  g.addColorStop(1, 'rgba(12,4,2,0.55)');
  B.fillStyle = g;
  B.fillRect(0, 0, W, H);
  // polvo a contraluz: se mueve en círculos que cierran en `LOOP`
  for (let i = 0; i < 34; i++) {
    const w = (TAU * t) / LOOP;
    const k = 1 + (i % 3);
    const px = hash(401, i) * W + Math.sin(w * k + i) * hr(40, 140, 402, i) - (cam.x - L.cam[0]) * 0.3;
    const py = H * 0.15 + hash(403, i) * H * 0.75 + Math.cos(w * k * 2 + i) * 24;
    glow(G, px, py, hr(2, 5, 404, i), '#ffe2b0', 0.22 + 0.18 * Math.sin(w * 6 + i * 2));
  }

  B.save(); G.save();
  applyCam(B, cam); applyCam(G, cam);
  drawBuba(B, G, t, L);
  drawPuffy(B, G, t, L);
  actA(B, G, t, L);
  actB(B, G, t, L);
  actC(B, G, t, L);
  hits(B, G, t, L);
  B.restore(); G.restore();

  B.restore(); G.restore();
}

const hex3 = (col) => col.match(/\w\w/g).map((h) => parseInt(h, 16) / 255);

/** El revelado de la vuelta: tibio, con el fogonazo de los golpes y el glitch del corte. */
export function postLoop(tIn, base) {
  const t = ((tIn % LOOP) + LOOP) % LOOP;
  const L = layout();
  // El revelado trabaja en la pantalla: lo que pasa en el mundo se pasa por la cámara.
  const cam = loopCam(t, L);
  const fx = {
    ...base, lift: [...base.lift], gain: [...base.gain], tint: [1.04, 1.0, 0.95], flash: [1, 1, 1, 0], shocks: [],
    grain: 0, // en un video comprimido el grano se come la calidad
  };
  if (t >= T.bust && t < T.deckC) {
    const k = E.outCubic(span(t, T.bust, T.bust + 0.3)) * (1 - E.inOutCubic(span(t, T.laugh + 0.3, T.laugh + 1.3)));
    fx.sat = lerp(base.sat, 0.45, k);
    fx.contrast = lerp(base.contrast, 1.1, k);
    fx.glitch = (1 - span(t, T.bust, T.bust + 0.55)) * 0.9;
    fx.ca += (1 - span(t, T.bust, T.bust + 0.6)) * 14;
  }
  for (const [th, strength] of [[T.hitA, 0.07], [T.hitC, 0.12]]) {
    if (t >= th && t < th + 0.6) {
      fx.zoomBlur = Math.max(fx.zoomBlur, strength * Math.exp(-(t - th) * 12));
      const [zx, zy] = toScreen(cam, L.puffyX, L.feet - L.axH * 0.47);
      fx.zoomCenter = [zx / W, 1 - zy / H];
    }
  }
  if (t >= T.hitC && t < T.up) fx.bloom = base.bloom + Math.exp(-(t - T.hitC) * 2.5) * 0.4;
  for (const [t0, s, wx, wy, col = '#ffffff'] of impacts(L)) {
    const [x, y] = wx === undefined ? [W / 2, H / 2] : toScreen(cam, wx, wy);
    const a = t - t0;
    if (a < -0.02 || a > 0.8) continue;
    fx.exposure *= 1 + pulse(t, t0, 9) * s * 0.5;
    const fl = pulse(t, t0, 26) * s;
    if (fl > fx.flash[3]) {
      const c = hex3(col);
      fx.flash = [c[0], c[1], c[2], Math.min(0.3, fl * 0.2)];
    }
    fx.ca += pulse(t, t0, 7) * s * 8;
    if (a >= 0 && fx.shocks.length < 4) {
      const p = a / 0.8;
      fx.shocks.push([x, y, E.outCubic(p) * 1500 * (0.4 + s * 0.6), s * 30 * (1 - p) ** 2]);
    }
  }
  return fx;
}

export { clamp, CARD_H };
