// El tutorial: una partida guionada que enseña jugando. La mesa muestra lo que pasa, un
// brillo celeste marca lo que hay que mirar y una flecha, con una burbuja de pocas
// palabras, marca qué tocar. Sin modales ni pantallas oscuras, y la ayuda llega sola si
// el jugador se queda quieto. Lineamientos completos en docs/tutorial.md.
//
// Cinco rondas, una idea por ronda: el objetivo, la cadena, el corte (y el centro), el
// Rocket Stamp que sale del centro, y el Rocket salvando la cadena para el remate. De
// paso, el mazo, que no se cuenta sino que se abre: dos veces el guión frena la mesa
// hasta que el jugador toca su Axie y mira las cartas que juntó.

import { makeCard } from './data.js';
import { hpOf, swingOf } from './game.js';
import { tr } from './i18n.js';

// ---- El guión de cada ronda ---------------------------------------------------
//
// El mazo de la mesa es el mazo de verdad: las diez cartas de fábrica del Axie (ver
// `baseDeck` en data.js) más lo que se fue llevando del centro. El guión no inventa
// cartas —una carta que no está en el mazo se robaba en la mesa y no aparecía al abrirlo
// (`#peek-p1`), y eso no es el juego—: solo dice cuáles salen primero y en qué orden,
// nombrándolas por sus símbolos. El resto del mazo queda abajo, sin salir, que es lo que
// mide la rueda de chances.
//
// `CENTER` es una de las cartas que se llevó del centro (cualquiera: las tres que ofrece
// la ronda 1 llevan los mismos dos símbolos y alargan la misma cadena) y `ROCKET` el
// Rocket Stamp de la ronda 4.

const CENTER = 'centro';
const ROCKET = 'cohete';

const SCRIPT = {
  // Ronda 1 — la cadena: tres cartas de Marea, todas con su símbolo (10 de daño).
  1: {
    p1: [['aquatic', 'bird'], ['aquatic', 'bug'], ['aquatic', 'reptile']],
    p2: [['plant', 'beast'], ['plant', 'bug']],
  },

  // Ronda 2 — cadena larga con lo que se llevó del centro (35) y corte del rival: sus
  // dos primeras van de Planta y la tercera no la lleva.
  2: {
    p1: [CENTER, CENTER, ['aquatic', 'bird'], ['aquatic', 'bug'], ['aquatic', 'reptile']],
    p2: [['plant', 'beast'], ['plant', 'reptile'], ['bird', 'reptile']],
  },

  // Ronda 3 — corte propio, y honesto: la racha va por Bestia, que en el mazo son tres
  // cartas y nada más. Con las tres afuera la rueda marca 0% y la cuarta corta de verdad.
  3: {
    p1: [['aquatic', 'beast'], ['beast', 'bird'], ['beast', 'bug'], ['aquatic', 'plant']],
    p2: [['aquatic', 'plant'], ['plant', 'bird']],
  },

  // Ronda 4 — la cadena más larga de todas (46) y el Rocket del centro.
  4: {
    p1: [CENTER, CENTER, ['aquatic', 'bird'], ['aquatic', 'bug'], ['aquatic', 'reptile'],
      ['aquatic', 'plant']],
    p2: [['plant', 'bug'], ['plant', 'reptile']],
  },

  // Ronda 5 — el Rocket sale tercero y la cuarta, montada en la 2ª carta, revive la
  // racha de Planta que murió ahí: 13 de daño, los que le quedan al rival (Last
  // Chance). El rival se corta en su último golpe.
  5: {
    p1: [['aquatic', 'plant'], ['aquatic', 'bug'], ROCKET, ['plant', 'reptile']],
    p2: [['plant', 'beast'], ['plant', 'reptile'], ['aquatic', 'bird']],
  },
};

/** Con cuántas cartas ataca la CPU en cada ronda. Sin tope, roba hasta cortarse. */
const BOT_STAND_AT = { 1: 2, 2: Infinity, 3: 2, 4: 2, 5: Infinity };

/** Las rondas en que se abre el centro: la del color (1) y la del Rocket (4). */
const DRAFT_ROUNDS = new Set([1, 4]);

const sameSymbols = (card, symbols) => card.symbols.length === symbols.length
  && [...card.symbols].sort().join() === [...symbols].sort().join();

/** Dónde está en el mazo la carta que pide el guión. */
function findCard(deck, want, added) {
  if (want === ROCKET) return deck.findIndex((c) => c.power === 'freegame');
  if (want === CENTER) return deck.findIndex((c) => !c.power && added.includes(c));
  return deck.findIndex((c) => !c.power && sameSymbols(c, want));
}

/**
 * El mazo de la ronda: el mazo entero del jugador, con las cartas que pide el guión
 * arriba de todo y el resto abajo. `draw` saca del final del array, así que la primera
 * en salir va última.
 */
function arrange(own, wants, added) {
  const rest = [...own];
  const top = [];
  for (const want of wants) {
    const at = findCard(rest, want, added);
    if (at >= 0) top.push(...rest.splice(at, 1));
  }
  return [...rest, ...top.reverse()];
}

/**
 * El centro del tutorial. `refillMarket` saca del final: las seis últimas son lo que se
 * ve al abrirlo. Las tres de tu color llevan tu símbolo **y** el de la Boca (Pez +
 * Pájaro), así que cualquier par que agarres alarga las mismas dos rachas y la ronda 2
 * pega lo mismo; las otras dos no llevan tu color, que es lo que la ronda enseña a
 * mirar, y la reposición tampoco: el centro no vuelve a ofrecer color hasta el Rocket.
 */
function buildTutorialPool() {
  const plain = (list) => list.map((syms) => makeCard(syms));
  const reserve = plain([
    ['beast', 'plant'], ['bird', 'bug'], ['plant', 'bird'], ['beast', 'bug'],
    ['beast', 'reptile'], ['bug', 'reptile'], ['plant', 'reptile'], ['beast', 'bird'],
  ]);
  const market = [
    makeCard(['plant', 'bug']),
    makeCard(['aquatic', 'bird', 'bug']),
    makeCard(['beast', 'reptile']),
    makeCard(['aquatic', 'bird'], 'freegame'),
    makeCard(['plant', 'aquatic', 'bird']),
    makeCard(['aquatic', 'bird', 'reptile']),
  ];
  return [...reserve, ...market];
}

// ---- Pasos -------------------------------------------------------------------
// Cada paso:
//   id, round
//   allowed: la única acción habilitada ('hit' | 'stand' | 'any' | 'none')
//   draft: reglas del centro mientras dura ({ plainOnly, ownColor } o { power: 'freegame' })
//   target(state): selector de lo que señala la flecha, o null para no señalar nada
//   glow(state): selector de lo que brilla en celeste (lo que hay que mirar)
//   bubble: texto de la burbuja (≤ 6 palabras; opcional)
//   delay: ms sin actuar antes de que aparezca la flecha (por defecto HINT_DELAY)
//   now: la burbuja sale junto con la flecha en vez de esperar BUBBLE_AFTER
//   done(state, seen): cuándo se pasa al siguiente paso. `seen.deck` es cuántas veces el
//     jugador abrió y cerró su mazo desde que empezó este paso.

const HINT_DELAY = 3000;
const BUBBLE_AFTER = 4000;

const HIT = '#controls [data-action="hit"]';
// Tu Axie es tu mazo: tocándolo se abre. El brillo va sobre el dibujo y la flecha sobre
// el botón transparente que lo abre (ver `.peek` en index.html), que es lo que se toca.
const MY_AXIE = '#axie-p1';
const MY_DECK = '#peek-p1';
const STAND = '#controls [data-action="stand"]';
// El centro no exige tu color: se recomienda. Brillan las que lo llevan (el Pez de Marea).
const MARKET_COLOR = '#market .market-card[data-syms~="aquatic"]:not([disabled])';
const MARKET_ROCKET = '#market [data-power="freegame"]';
// Tocar una carta del centro la marca y la compra se confirma con un botón: con una
// carta marcada, la flecha deja las cartas y señala el botón.
const CONFIRM = '#market [data-action="confirm"]:not([disabled])';
const toConfirm = (cards) => `#market:not(:has(.is-chosen)) ${cards.replace('#market ', '')}, ${CONFIRM}`;
const cardsOf = (s) => s.chains?.p1?.cards.length ?? 0;
const attacked = (s) => s.roundScores?.p1 != null;
const busted = (s) => Boolean(s.chains?.p1?.busted);
const myTurn = (s, round) => s.round === round && s.turn === 'p1' && s.phase === 'turn';
const picking = (s) => s.phase === 'draft' && s.draft?.order?.[s.draft.index] === 'p1';
const isRocket = (c) => (c.powers ?? [c.power]).includes('freegame');
const rocketCol = (s) => s.chains?.p1?.cards.findIndex(isRocket) ?? -1;
const lethal = (s) => swingOf(s, 'p1') >= hpOf(s, 'p2');

function createSteps() {
  return [
    // ── Ronda 1: objetivo, cadena y centro ─────────────────────────────
    {
      id: 'r1-draw',
      round: 1,
      allowed: 'hit',
      target: () => '#field .card[data-col="0"]',
      side: 'left',
      glow: () => '#field .card[data-col="0"]',
      bubble: tr('Cadenas vivas'),
      delay: 0,
      now: true,
      done: (s) => cardsOf(s) >= 3,
    },
    {
      id: 'r1-chain',
      round: 1,
      allowed: 'stand',
      target: () => '#swing',
      side: 'left',
      glow: () => '#swing',
      bubble: tr('Cadenas largas hacen más daño'),
      delay: 300,
      now: true,
      done: attacked,
    },
    {
      id: 'r1-color',
      round: 1,
      allowed: 'none',
      draft: { plainOnly: true, ownColor: true },
      target: (s) => (picking(s) ? toConfirm(MARKET_COLOR) : null),
      side: 'top',
      glow: (s) => (picking(s) ? MARKET_COLOR : null),
      bubble: tr('Buscá tu color'),
      delay: 500,
      now: true,
      done: (s) => myTurn(s, 2),
    },

    // ── Ronda 2: racha larga y corte del rival ─────────────────────────
    // Antes de robar, el mazo: lo que se llevó del centro ya está adentro. No se cuenta,
    // se abre —la mesa espera hasta que toca su Axie y vuelve.
    {
      id: 'r2-deck',
      round: 2,
      allowed: 'none',
      target: () => MY_DECK,
      glow: () => MY_AXIE,
      bubble: tr('Tocá tu Axie: es tu mazo'),
      delay: 300,
      now: true,
      done: (s, seen) => seen.deck >= 1,
    },
    {
      id: 'r2-draw',
      round: 2,
      allowed: 'hit',
      target: () => HIT,
      done: (s) => cardsOf(s) >= 5,
    },
    {
      id: 'r2-attack',
      round: 2,
      allowed: 'stand',
      target: () => STAND,
      done: attacked,
    },
    {
      id: 'r2-rival-bust',
      round: 2,
      allowed: 'none',
      target: (s) => (s.chains?.p2?.busted ? '#field .card--bust' : null),
      bubble: tr('¡Cadena rota! No comparte símbolos'),
      delay: 0,
      now: true,
      done: (s) => myTurn(s, 3),
    },

    // ── Ronda 3: corte propio (3 cartas y la 4ª no coincide) ───────────
    {
      id: 'r3-draw',
      round: 3,
      allowed: 'hit',
      target: () => HIT,
      done: (s) => cardsOf(s) >= 3,
    },
    {
      id: 'r3-odds',
      round: 3,
      allowed: 'hit',
      target: () => '#odds',
      side: 'top',
      glow: () => '#odds',
      bubble: tr('Chances de seguir la cadena'),
      delay: 300,
      now: true,
      done: busted,
    },
    {
      id: 'r3-bust',
      round: 3,
      allowed: 'none',
      target: (s) => (s.chains?.p1?.busted ? '#field .card--bust' : null),
      bubble: tr('¡Cadena rota! No comparte símbolos'),
      delay: 0,
      now: true,
      done: (s) => myTurn(s, 4),
    },

    // ── Ronda 4: práctica y agarrar el Rocket Stamp ───────────────────
    {
      id: 'r4-chain',
      round: 4,
      allowed: 'hit',
      target: () => HIT,
      done: (s) => cardsOf(s) >= 6,
    },
    {
      id: 'r4-attack',
      round: 4,
      allowed: 'stand',
      target: () => STAND,
      done: attacked,
    },
    {
      id: 'r4-rocket',
      round: 4,
      allowed: 'none',
      draft: { power: 'freegame' },
      target: (s) => (picking(s) ? toConfirm(MARKET_ROCKET) : null),
      side: 'top',
      glow: (s) => (picking(s) ? MARKET_ROCKET : null),
      bubble: tr('Llevate el cohete'),
      delay: 500,
      now: true,
      done: (s) => s.decks?.p1?.some(isRocket) || myTurn(s, 5),
    },
    // El cohete que acaba de salir del centro ya es suyo: se lo ve abriendo el mazo.
    {
      id: 'r4-deck',
      round: 4,
      allowed: 'none',
      target: () => MY_DECK,
      glow: () => MY_AXIE,
      bubble: tr('Tocá tu Axie: sumaste el cohete'),
      delay: 0,
      now: true,
      done: (s, seen) => seen.deck >= 1,
    },

    // ── Ronda 5: Rocket Stamp en 3ª carta, revivir Planta y Last Chance ─
    {
      id: 'r5-draw-2',
      round: 5,
      allowed: 'hit',
      target: () => HIT,
      done: (s) => cardsOf(s) >= 2,
    },
    {
      id: 'r5-draw-rocket',
      round: 5,
      allowed: 'hit',
      target: () => HIT,
      done: (s) => rocketCol(s) >= 0,
    },
    {
      id: 'r5-rocket-auto',
      round: 5,
      allowed: 'hit',
      target: (s) => (rocketCol(s) >= 0 ? `#field .card[data-col="${rocketCol(s)}"]` : null),
      glow: (s) => (rocketCol(s) >= 0 ? `#field .card[data-col="${rocketCol(s)}"]` : null),
      delay: 0,
      done: (s) => s.pendingStack?.player === 'p1',
    },
    {
      id: 'r5-stack',
      round: 5,
      allowed: 'none',
      col: 1, // solo sobre la 2ª carta (colIndex 1) para revivir la planta
      target: () => '#field [data-stack-col="1"]',
      side: 'bottom',
      glow: () => '#field [data-stack-col="1"]',
      bubble: tr('Montala en la 2ª carta'),
      delay: 400,
      now: true,
      done: (s) => !s.pendingStack,
    },
    {
      id: 'r5-finish',
      round: 5,
      allowed: 'stand',
      target: () => STAND,
      glow: () => '#swing',
      bubble: tr('¡Rematalo!'),
      delay: 800,
      now: true,
      done: attacked,
    },
    {
      id: 'r5-rival-last-chance',
      round: 5,
      allowed: 'none',
      target: () => null,
      glow: () => '#plate-p2 .plate-hp',
      delay: 0,
      done: (s) => s.phase === 'matchEnd',
    },
    {
      id: 'r5-end',
      round: 5,
      allowed: 'none',
      target: () => null,
      done: () => false,
    },
  ];
}

// ---- La flecha, la burbuja y el brillo ----------------------------------------

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * La barra con la configuración y la salida, el menú si está abierto, las dos vidas, los
 * dos instrumentos (daño y rueda) y los carteles. Son lecturas, no cosas que se agarren:
 * la flecha y la burbuja no las tapan. En una pantalla angosta
 * siempre se pisa algo; que sea una carta del centro, no un cartel.
 */
const ALWAYS_CLEAR = '.topbar, #hud-menu:not([hidden]), #plate-p1, #plate-p2, .gauge, '
  + '.overlay-head, .o-banner';

/**
 * Y lo que prefieren no tapar: la mesa que el jugador está leyendo. De las cartas cuentan
 * los símbolos y el poder, no la madera de alrededor: una flecha sobre el borde vacío de
 * una carta no esconde nada, sobre un símbolo sí.
 */
const KEEP_CLEAR = '#axie-p1, #axie-p2, #controls .btn, .overlay-actions .btn, '
  + '#field .card .sym, #field .card .card-power, #market .sym, #market .card-power, '
  + '.overlay-title, .overlay-note';

/** La madera de las cartas: se puede pisar, pero antes se prefiere el fondo. */
const CARD_BODIES = '#field .card, #market .market-card';

/** Cuántas cosas señala un paso a la vez (una flecha por cada una). */
const MAX_ARROWS = 6;

/**
 * La capa del tutorial: flecha del kit de Origins y burbuja que nunca se superpone al
 * objetivo. La mesa no se apaga: lo que hay que mirar brilla (`glow`) y lo que se puede
 * tocar late (`.tuto-allowed`).
 */
export function createOverlay({ onQuit = null } = {}) {
  const root = document.createElement('div');
  root.id = 'tutorial-overlay';
  root.className = 'tuto-overlay';
  root.innerHTML = `
    <div class="tuto-bubble o-panel" role="status" hidden></div>`;
  document.body.appendChild(root);

  document.querySelector?.('.topbar')?.classList.add('tuto-topbar');

  const bubble = root.querySelector?.('.tuto-bubble');

  const SIDES = { bottom: 0, top: 1, right: 2, left: 3 };
  const arrows = []; // una por cosa señalada; se crean a medida que hacen falta
  let target = null;
  let label = '';
  let fixedSide = null;
  let showing = false; // ya pasó la espera y las flechas están afuera
  let shine = null;
  let timers = [];
  let frame = 0;
  let placedFor = ''; // lo que midió la última ubicación (ver `place`)

  const stopTimers = () => { timers.forEach(clearTimeout); timers = []; };

  const arrowAt = (i) => {
    while (arrows.length <= i) {
      const el = document.createElement('div');
      el.className = 'tuto-arrow';
      el.hidden = true;
      el.innerHTML = '<i></i>';
      root.insertBefore?.(el, bubble) ?? root.appendChild(el);
      arrows.push(el);
    }
    return arrows[i];
  };
  const hideArrows = () => { for (const el of arrows) el.hidden = true; };

  /** Cuánto pisa la caja `a` al rectángulo `b` (área). */
  const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.right) - Math.max(a.x, b.left))
    * Math.max(0, Math.min(a.y + a.h, b.bottom) - Math.max(a.y, b.top));

  /**
   * Dónde van las flechas (una por objetivo) y la burbuja. Cada lugar posible tiene un
   * costo: tapar un objetivo lo descalifica, tapar un cartel pesa ocho veces lo que tapar
   * un símbolo, y la madera de una carta casi no cuenta. Gana el más barato.
   */
  function layout(rects, size, bw, bh, vw, vh, preferredSide) {
    const g = 6;
    const same = (a, b) => Math.abs(a.left - b.left) < 4 && Math.abs(a.top - b.top) < 4
      && Math.abs(a.width - b.width) < 4 && Math.abs(a.height - b.height) < 4;

    const obstacles = [];
    const collect = (selector, weight) => {
      for (const ob of document.querySelectorAll?.(selector) ?? []) {
        const rect = ob?.getBoundingClientRect?.();
        if (!rect || (rect.width === 0 && rect.height === 0)) continue;
        if (rects.some((r) => same(rect, r))) continue;
        obstacles.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, weight });
      }
    };
    collect(CARD_BODIES, 0.4);
    collect(KEEP_CLEAR, 1);
    collect(ALWAYS_CLEAR, 8);

    const boxCost = (box) => {
      let cost = 0;
      for (const r of rects) {
        // Rozar el borde por medio píxel de redondeo no es taparlo.
        const o = overlap(box, r);
        if (o > 60) cost += 1_000_000 + o * 100;
      }
      for (const ob of obstacles) {
        const o = overlap(box, ob);
        if (o > 0) cost += (1000 + o * 10) * ob.weight;
      }
      return cost;
    };

    // Las flechas: pegadas al objetivo, del lado que menos tape. Se salen de la pantalla
    // solo corriéndose a lo largo del borde, nunca alejándose del objetivo.
    const arrowFor = (r, side) => {
      const cx = r.left + r.width / 2 - size / 2;
      const cy = r.top + r.height / 2 - size / 2;
      const [x, y, rot] = [
        [cx, r.bottom + g, 90],
        [cx, r.top - g - size, -90],
        [r.right + g, cy, 0],
        [r.left - g - size, cy, 180],
      ][side];
      const box = { x: clamp(x, 8, vw - size - 8), y: clamp(y, 8, vh - size - 8), w: size, h: size };
      // Unos pocos píxeles de más contra el borde no la despegan del objetivo.
      const off = Math.abs(side < 2 ? box.y - y : box.x - x) > 12;
      return { ...box, rot, cost: boxCost(box) + (off ? 500_000 : 0) };
    };
    const options = rects.map((r) => [0, 1, 2, 3].map((side) => arrowFor(r, side)));
    const total = (side) => options.reduce((sum, o) => sum + o[side].cost, 0);

    // Todas del mismo lado, que se leen como un grupo; el lado lo fija el guión si ahí
    // no tapa nada. La que ahí tape algo que las otras no, busca el suyo.
    let side = [0, 1, 2, 3].reduce((a, b) => (total(b) < total(a) ? b : a));
    if (preferredSide != null && total(preferredSide) < 5000 * rects.length) side = preferredSide;
    const placed = options.map((o) => {
      const best = o.reduce((a, b) => (b.cost < a.cost ? b : a));
      return o[side].cost <= best.cost + 5000 ? o[side] : best;
    });

    if (!bw || !bh) return { arrows: placed };

    // La burbuja: al lado de alguna flecha o de algún objetivo, lo más cerca posible.
    const around = (b, gap) => [
      { x: b.x + b.w / 2 - bw / 2, y: b.y - gap - bh },
      { x: b.x + b.w / 2 - bw / 2, y: b.y + b.h + gap },
      { x: b.x - gap - bw, y: b.y + b.h / 2 - bh / 2 },
      { x: b.x + b.w + gap, y: b.y + b.h / 2 - bh / 2 },
    ];
    const spots = [
      ...placed.flatMap((a) => around(a, 4)),
      ...rects.flatMap((r) => around({ x: r.left, y: r.top, w: r.width, h: r.height }, 8)),
    ];
    let bubbleAt = null;
    let cheapest = Infinity;
    for (const spot of spots) {
      const box = { x: clamp(spot.x, 8, vw - bw - 8), y: clamp(spot.y, 8, vh - bh - 8), w: bw, h: bh };
      let cost = boxCost(box);
      for (const a of placed) {
        if (overlap(box, { left: a.x, top: a.y, right: a.x + a.w, bottom: a.y + a.h }) > 0) cost += 1_000_000;
      }
      const near = Math.min(...placed.map((a) => Math.hypot(
        box.x + bw / 2 - (a.x + size / 2), box.y + bh / 2 - (a.y + size / 2))));
      cost += near * 20;
      if (cost < cheapest) {
        cheapest = cost;
        bubbleAt = box;
      }
    }
    return { arrows: placed, bx: bubbleAt.x, by: bubbleAt.y };
  }

  function place() {
    if (!showing || !target) return;
    const rects = [];
    for (const node of document.querySelectorAll?.(target) ?? []) {
      const r = node.getBoundingClientRect?.();
      if (r && (r.width || r.height)) rects.push(r);
      if (rects.length === MAX_ARROWS) break;
    }
    if (!rects.length) {
      for (const el of arrows) el.style.visibility = 'hidden';
      if (bubble) bubble.style.visibility = 'hidden';
      placedFor = '';
      return;
    }

    const vw = globalThis.innerWidth || 0;
    const vh = globalThis.innerHeight || 0;
    const first = arrowAt(0);
    first.hidden = false;
    const size = first.offsetWidth || 34;
    const talking = bubble && !bubble.hidden;
    const bw = talking ? (bubble.offsetWidth || 150) : 0;
    const bh = talking ? (bubble.offsetHeight || 42) : 0;

    // Esto corre en cada cuadro. Medir los objetivos es barato; elegir el lugar mide cada
    // símbolo, botón y cartel de la mesa, así que solo se rehace si algo cambió: un
    // objetivo se movió, cambió la pantalla o la burbuja, o entraron o salieron cosas.
    const count = document.querySelectorAll?.(`${KEEP_CLEAR}, ${ALWAYS_CLEAR}`)?.length ?? 0;
    const key = rects.flatMap((r) => [r.left, r.top, r.width, r.height])
      .concat(vw, vh, size, bw, bh).map(Math.round).concat(count, target, fixedSide).join();
    if (key === placedFor) return;
    placedFor = key;

    const pos = layout(rects, size, bw, bh, vw, vh, fixedSide);
    pos.arrows.forEach((a, i) => {
      const el = arrowAt(i);
      el.hidden = false;
      el.style.visibility = '';
      el.style.transform = `translate(${Math.round(a.x)}px, ${Math.round(a.y)}px) rotate(${a.rot}deg)`;
    });
    for (let i = pos.arrows.length; i < arrows.length; i++) arrows[i].hidden = true;
    if (talking) {
      bubble.style.visibility = '';
      bubble.style.transform = `translate(${Math.round(pos.bx)}px, ${Math.round(pos.by)}px)`;
    }
  }

  function applyGlow() {
    for (const n of document.querySelectorAll?.('.tuto-hl') ?? []) {
      if (!shine || !n.matches?.(shine)) n.classList.remove('tuto-hl');
    }
    if (!shine) return;
    for (const n of document.querySelectorAll?.(shine) ?? []) n.classList.add('tuto-hl');
  }

  function follow() {
    frame = 0;
    if (!target && !shine) return;
    place();
    applyGlow();
    frame = globalThis.requestAnimationFrame?.(follow) ?? 0;
  }
  const wake = () => { if (!frame) follow(); };

  function showArrow() {
    if (!target) return;
    const node = document.querySelector?.(target);
    const r = node?.getBoundingClientRect?.();
    if (r && (r.top < 0 || r.bottom > (globalThis.innerHeight || Infinity))) {
      const quiet = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      node.scrollIntoView?.({ block: 'nearest', behavior: quiet ? 'auto' : 'smooth' });
    }
    showing = true;
    wake();
  }

  function showBubble() {
    if (!bubble || !label || !target) return;
    bubble.textContent = label;
    bubble.hidden = false;
    place();
  }

  function clear() {
    stopTimers();
    target = null;
    label = '';
    fixedSide = null;
    placedFor = '';
    showing = false;
    hideArrows();
    if (bubble) bubble.hidden = true;
  }

  return {
    point(selector, text = '', { delay = HINT_DELAY, bubbleAfter = BUBBLE_AFTER, side: preferredSide = null } = {}) {
      clear();
      if (!selector) return;
      target = selector;
      label = text;
      fixedSide = typeof preferredSide === 'number' ? preferredSide : (SIDES[preferredSide] ?? null);
      timers.push(setTimeout(showArrow, delay));
      if (label) timers.push(setTimeout(showBubble, delay + bubbleAfter));
    },
    glow(selector) {
      if (selector === shine) return;
      shine = selector;
      applyGlow();
      wake();
    },
    hurry() {
      if (!target) return;
      stopTimers();
      showArrow();
      showBubble();
    },
    clear,
    destroy() {
      clear();
      shine = null;
      applyGlow();
      if (frame) globalThis.cancelAnimationFrame?.(frame);
      frame = 0;
      document.querySelector?.('.topbar')?.classList.remove('tuto-topbar');
      root.remove?.();
    },
  };
}

// ---- Motor del tutorial ------------------------------------------------------

export function createTutorial(game, onDone = () => {}) {
  const steps = createSteps();
  let index = 0;
  let pointing; // lo que la flecha señala ahora (undefined: todavía nada decidido)
  let gatedFor = null; // el paso cuyas reglas están puestas en la partida
  let finished = false;
  let unsub = null;
  // El mazo se mira tocando tu Axie, que abre un panel encima de la mesa (ver `#peek-p1`
  // en index.html). Los pasos que lo enseñan esperan ese toque, así que se cuentan las
  // visitas y cada paso arranca con la cuenta en cero (`deckAt`).
  let deckSeen = 0;
  let deckAt = 0;

  // El toque sobre tu Axie abre el mazo: con eso el paso que lo pedía ya está visto. Se
  // cuenta al abrirlo y no al cerrarlo para que la mesa quede libre apenas sale el panel.
  const peekBtn = document.getElementById?.('peek-p1');
  const onPeek = () => { deckSeen++; sync(game.state); };

  const menuBtn = document.getElementById?.('menu-btn');
  const prevMenuText = menuBtn?.textContent;
  if (menuBtn) menuBtn.textContent = tr('Salir del tutorial');
  const onMenuQuit = () => { finish(); };
  menuBtn?.addEventListener?.('click', onMenuQuit);

  const overlay = createOverlay({ onQuit: finish });

  function cleanup() {
    if (finished) return;
    finished = true;
    unsub?.();
    document.removeEventListener?.('pointerdown', lost, true);
    peekBtn?.removeEventListener?.('click', onPeek);
    if (menuBtn) {
      menuBtn.removeEventListener?.('click', onMenuQuit);
      if (prevMenuText) menuBtn.textContent = prevMenuText;
    }
    overlay.destroy();
    const st = game.state;
    if (st) {
      st.tutorial = false;
      st.tutorialAllowed = null;
      st.tutorialAllowedCol = null;
      st.tutorialPlainOnly = false;
      st.tutorialOwnColor = false;
      st.tutorialAllowedCard = null;
      st.tutorialDisallowSkip = false;
      st.tutorialSkipDraft = false;
      st.tutorialBotStandAt = null;
      st.onRoundStart = null;
    }
    localStorage.setItem('tutorialDone', 'true');
  }

  function finish() {
    if (finished) return;
    cleanup();
    onDone();
  }

  /** Un toque fuera de lo señalado es la señal de que no sabe qué hacer. */
  function lost(e) {
    if (!pointing) return;
    if (
      e.target?.closest?.(pointing) ||
      // Cambiar la carta marcada del centro no es perderse (ver `CONFIRM`).
      e.target?.closest?.('#market .market-card:not([disabled])') ||
      // Con el mazo abierto, los toques son del panel: mirar las cartas y cerrarlo.
      e.target?.closest?.('#deck-modal') ||
      e.target?.closest?.('.topbar-actions') ||
      e.target?.closest?.('#hud-menu')
    ) {
      return;
    }
    e.stopPropagation?.();
    e.preventDefault?.();
    overlay.hurry();
  }

  /**
   * Pone el mazo de cada ronda antes de que se reparta. No es un mazo aparte: es el de
   * cada jugador —las diez de fábrica más lo que se llevó del centro— ordenado para que
   * salgan primero las cartas del guión (ver `SCRIPT`).
   */
  function setRound(st, round) {
    const script = SCRIPT[round];
    for (const player of ['p1', 'p2']) {
      const own = [...st.start[player], ...st.added[player]];
      st.decks[player] = arrange(own, script?.[player] ?? [], st.added[player]);
    }
    st.tutorialBotStandAt = BOT_STAND_AT[round] ?? 2;
    st.tutorialSkipDraft = !DRAFT_ROUNDS.has(round);
  }

  /** Las reglas del paso: qué botón vale y qué se puede llevar del centro. */
  function gate(step, st) {
    const rules = step.draft ?? {};
    st.tutorialAllowed = step.allowed;
    st.tutorialAllowedCol = step.col ?? null;
    st.tutorialPlainOnly = Boolean(rules.plainOnly);
    st.tutorialOwnColor = Boolean(rules.ownColor);
    // Dejar pasar el reparto rompería el guión: las cartas del centro son las que
    // alargan la cadena de las rondas siguientes.
    st.tutorialDisallowSkip = Boolean(rules.power || rules.ownColor);
    st.tutorialAllowedCard = null;
    if (rules.power) {
      let card = st.market.find((c) => c.power === rules.power);
      if (!card) {
        // Nunca debería faltar (el guión no deja llevárselo antes), pero si falta el
        // paso quedaría sin salida: se repone.
        card = makeCard(['aquatic', 'bird'], rules.power);
        st.market[0] = card;
      }
      st.tutorialAllowedCard = card.uid;
    }
  }

  /** Avanza lo que haya que avanzar y acomoda la flecha y el brillo a lo que pide el paso. */
  function sync(state) {
    if (finished || !state) return;
    let step = steps[index];
    while (step && step.done(state, { deck: deckSeen - deckAt })) {
      step = steps[++index];
      pointing = undefined;
      deckAt = deckSeen;
    }
    if (!step) { finish(); return; }

    overlay.glow(step.glow?.(state) ?? null);
    const target = step.target(state) ?? null;
    if (target !== pointing) {
      pointing = target;
      overlay.point(target, step.bubble, {
        delay: step.delay ?? HINT_DELAY,
        bubbleAfter: step.now ? 0 : BUBBLE_AFTER,
        side: step.side,
      });
    }
    if (gatedFor !== step) {
      gatedFor = step;
      gate(step, state);
      game.refresh();
    }
  }

  game.newMatch({
    mode: 'tutorial',
    difficulty: 'facil',
    axie: 'aquatic',
    axie2: 'plant',
    activePowers: ['strength', 'pot', 'egg', 'snail', 'octopus', 'poison'],
    scriptedPool: buildTutorialPool(),
    onRoundStart: (round) => setRound(game.state, round),
  });
  game.state.tutorialAllowed = steps[0].allowed;

  unsub = game.subscribe(sync);
  peekBtn?.addEventListener?.('click', onPeek);
  document.addEventListener?.('pointerdown', lost, true);
  // El primer paso, apenas la mesa está puesta.
  setTimeout(() => sync(game.state), 400);

  return { destroy: cleanup };
}

export { createSteps, buildTutorialPool, arrange, SCRIPT, CENTER, ROCKET };
