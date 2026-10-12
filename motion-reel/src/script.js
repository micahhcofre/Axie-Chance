// El guion del reel: 124 tiempos a 128 por minuto (58 segundos). Lo leen la imagen
// (`scenes.js` y sus escenas) y la música (`score.js`), así cada golpe cae junto.
//
//   t 0-10    CARA A CARA   Buba y Puffy caen a la arena. VS. Las barras de vida.
//   t 10-32   CÓMO SE JUEGA el turno de Buba, carta por carta: 1, 4, 9, 16, 25.
//                           Se planta y pega: Puffy queda en 75.
//   t 32-48   EL RIESGO     el turno de Puffy: 1, 4, 9… y una carta que no comparte
//                           nada. Se corta. CERO.
//   t 48-84   LOS PODERES   cuatro peleas en cuatro mundos, un poder cada una
//   t 84-112  EL FINAL      Buba en 64 contra 75: no alcanza. ¿UNA MÁS? 81. K.O.
//   t 112-124 EL TÍTULO     el logo, la frase y a jugar
//
// Los números son los del juego: `playCard()` y `scoreChain()` de `rules.js` deciden
// cada racha, así que el 81 del final es un 81 de verdad.
import { emptyChain, playCard, scoreChain } from '../../src/rules.js';

export const TEXT = {
  es: {
    vs: 'VS', turn: (name) => `TURNO DE ${name}`,
    draw: 'ROBÁ UNA CARTA.', share: '¿COMPARTE UN SÍMBOLO?', grow: '¡LA CADENA CRECE!',
    more: 'MÁS LARGA, MÁS DAÑO.', stand: 'PLANTATE… ¡Y PEGÁ!',
    but: 'PERO SI NO COMPARTE NINGUNO…', zero: 'CERO.', broke: 'SE CORTÓ LA CADENA',
    powers: '12 PODERES', powersSub: 'PARA DAR VUELTA LA PELEA',
    feather: '5 de daño directo apenas la robás', poison: '6 de veneno que atraviesa el escudo',
    leech: 'Robás 5 de vida al pegar', pot: 'Te curás lo que pegás',
    short: 'NO ALCANZA…', one: '¿UNA', more2: 'MÁS?', odds: 'CHANCE', dmg: 'DAÑO', ko: '¡K.O.!',
    tagline: '¿UNA MÁS?', cta: 'JUGÁ GRATIS', url: 'SINDADOS.COM.AR',
  },
  en: {
    vs: 'VS', turn: (name) => `${name}'S TURN`,
    draw: 'DRAW A CARD.', share: 'SHARES A SYMBOL?', grow: 'THE CHAIN GROWS!',
    more: 'LONGER CHAIN, BIGGER HIT.', stand: 'STAND… AND STRIKE!',
    but: 'BUT IF IT MATCHES NOTHING…', zero: 'ZERO.', broke: 'THE CHAIN BREAKS',
    powers: '12 POWERS', powersSub: 'TO TURN THE FIGHT AROUND',
    feather: '5 direct damage right as you draw it', poison: '6 poison that goes through shields',
    leech: 'Steal 5 HP on hit', pot: 'You heal what you hit',
    short: 'NOT ENOUGH…', one: 'ONE', more2: 'MORE?', odds: 'ODDS', dmg: 'DAMAGE', ko: 'K.O.!',
    tagline: 'ONE MORE?', cta: 'PLAY FREE', url: 'SINDADOS.COM.AR',
  },
};

// ---- las cadenas, jugadas con las reglas del juego ----
//
// La primera carta de cada cadena lleva un solo símbolo: así hay una sola racha y el
// daño es exactamente el cuadrado del largo (1, 4, 9…), que es lo que el reel explica.

/** El turno de Buba que enseña: cinco cartas, siempre con la pata. */
export const HERO_A = [['beast'], ['beast', 'aquatic'], ['bird', 'beast'], ['beast', 'plant', 'bug'], ['reptile', 'beast']];
/** El turno de Puffy, y la carta que no comparte nada. */
export const RIVAL = [['aquatic'], ['aquatic', 'bird'], ['plant', 'aquatic']];
export const RIVAL_BUST = ['reptile', 'bug'];
/** El turno final de Buba: ocho cartas y la novena, la que se juega todo. */
export const HERO_C = [
  ['beast'], ['bird', 'beast'], ['beast', 'plant'], ['aquatic', 'beast'], ['beast', 'bug', 'reptile'],
  ['beast', 'bird'], ['plant', 'beast', 'aquatic'], ['beast', 'bug'], ['bird', 'reptile', 'beast'],
];

function scores(cards) {
  let chain = emptyChain();
  return cards.map((symbols) => {
    chain = playCard(chain, { symbols });
    return chain.busted ? 0 : scoreChain(chain).total;
  });
}
export const HERO_A_SCORE = scores(HERO_A); // 1 4 9 16 25
export const RIVAL_SCORE = scores(RIVAL); // 1 4 9
export const RIVAL_BUSTED = scores([...RIVAL, RIVAL_BUST]).at(-1); // 0
export const HERO_C_SCORE = scores(HERO_C); // 1 4 9 16 25 36 49 64 81

/** La vida de Puffy: 100, lo que le saca el primer golpe de Buba y lo que le saca el último. */
export const PUFFY_HP = [100, 100 - HERO_A_SCORE.at(-1), Math.max(0, 100 - HERO_A_SCORE.at(-1) - HERO_C_SCORE.at(-1))];

/** Las cuatro peleas de los poderes: quién lo usa, contra quién, dónde y qué pasa con la vida. */
export const VIGNETTES = [
  { power: 'feather', cls: 'bird', name: 'FEATHER EARRING', hero: 'momo', foe: 'pomodoro', heroHp: [100, 100], foeHp: [100, 95], amount: 5 },
  { power: 'poison', cls: 'reptile', name: 'POISON VIAL', hero: 'venoki', foe: 'olek', heroHp: [100, 100], foeHp: [100, 94], amount: 6 },
  { power: 'leech', cls: 'bug', name: 'MANTIS DAGGER', hero: 'pomodoro', foe: 'momo', heroHp: [95, 100], foeHp: [100, 95], amount: 5 },
  { power: 'pot', cls: 'plant', name: 'LEAFY POT', hero: 'olek', foe: 'venoki', heroHp: [80, 92], foeHp: [100, 88], amount: 12 },
];

/** Los tiempos del guion, en tiempos musicales. */
export const CUE = {
  // 1. cara a cara
  bubaIn: 2, puffyIn: 4, vs: 6, hud: 6.25, vsOut: 9.4,
  // 2. el turno de Buba: cómo se juega
  turnA: 10, capDraw: 10.5, a: [12, 16, 19, 22, 24], capShare: 14, capGrow: 16.4, capMore: 20.5,
  capStand: 25.5, charge: 26.25, fly: 27.1, lunge: 27.5, hitA: 28, homeA: 29.4, capOutA: 30.6,
  // 3. el turno de Puffy: el corte
  turnB: 32, b: [33.5, 35, 36.5], capBut: 37.5, pDraw: 38.5, pFlip: 39.5, scan: 40, bust: 41,
  zero: 41.6, cero: 42, laugh: 42.5, ceroOut: 46.4, push1: [47.4, 48.1],
  // 4. los poderes
  powers: 48, v: [52, 60, 68, 76],
  // 5. el final
  push2: [83.5, 84.2], turnC: 84.2, c: [85, 85.5, 86, 86.5, 87, 87.5, 89, 91], short: 92, dial: 93.5, una: 95, mas: 96,
  beats: [97, 98, 99, 100], lift: 99, float: 100, flip: [101, 103], drop: 103, number: 103.35,
  charge2: 104, fly2: 105.05, attack: 105.5, hit: 106, ko: 107, outro: 110.5, converge: 111,
  // 6. el título
  logo: 112, tag: 113.5, cta: 114.75, axies: 116, final: 118, end: 124,
};

/** Cuándo pega cada poder, en tiempos desde que arranca su pelea. */
export const V_HIT = { feather: 4, poison: 3.6, leech: 3.3, pot: 3.2 };
/** Y cuándo llega lo segundo (la vida que vuelve, la cura). */
export const V_SECOND = { leech: 4.8, pot: 4.6 };

/** Los golpes: sacuden la cámara y encienden el revelado. [tiempo, fuerza, x, y, color] */
export const IMPACTS = [
  [CUE.bubaIn, 0.6, 330, 820, '#ffd9a0'], [CUE.puffyIn, 0.55, 1590, 820, '#cdefff'], [CUE.vs, 0.8, 960, 560, '#ffffff'],
  ...CUE.a.map((bt, i) => [bt, 0.18 + i * 0.03, 960, 545]),
  [CUE.hitA, 0.9, 1440, 720, '#ffe6c8'],
  ...CUE.b.map((bt) => [bt, 0.15, 960, 545]),
  [CUE.bust, 0.95, 1100, 520, '#ff3b3b'], [CUE.cero, 0.5, 960, 700, '#ffffff'],
  [CUE.powers, 0.4, 960, 540],
  ...VIGNETTES.flatMap((v, i) => [[CUE.v[i] + 0.55, 0.2, 960, 380], [CUE.v[i] + V_HIT[v.power], 0.55, 1360, 640]]),
  [CUE.turnC, 0.3, 960, 540],
  ...CUE.c.map((bt, i) => [bt, i < 6 ? 0.1 : 0.28, 960, 470]),
  [CUE.una, 0.45, 760, 700], [CUE.mas, 0.5, 1160, 700],
  [CUE.drop, 1.1, 960, 660, '#fff4d6'], [CUE.number, 0.7, 960, 640], [CUE.hit, 0.9, 1440, 720, '#ffe6c8'],
  [CUE.ko, 0.5, 1650, 800], [CUE.logo, 0.8, 960, 400, '#ffffff'], [CUE.final, 0.45, 960, 400],
];
