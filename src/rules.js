// Una "cadena" es la tirada de un jugador dentro de una ronda.
//
// Reglas:
//  - La primera carta abre una racha por cada símbolo distinto que tiene.
//  - Cada carta siguiente debe compartir al menos un símbolo todavía vivo.
//    Si no comparte ninguno, se corta todo: la ronda vale 0.
//  - Las rachas que la carta nueva no contiene mueren, pero conservan su largo.
//  - Puntos = suma de (largo de racha)^2. Solo puntúan los símbolos de la primera carta.
//  - Una carta cuenta **cada vez** que trae el símbolo: la mejorada que lo lleva dos
//    veces adelanta su racha de a dos. Es lo único que hacen las mejoras del Axie
//    (ver `boostOptions` en `data.js`), y por eso valen: la racha puntúa al cuadrado.
//
// De ahí que la racha lleve dos cuentas y no una. `length` es lo que puntúa —cuántas
// veces salió el símbolo— y `cards` cuántas cartas la sostienen, que es lo que la mesa
// necesita para saber hasta qué carta pintar la racha. Con cartas mejoradas los dos
// números dejan de ser el mismo.

/** Cuántas veces trae `card` el símbolo `symbol`. Las mejoradas lo repiten. */
export const timesIn = (card, symbol) =>
  card.symbols.reduce((n, s) => n + (s === symbol ? 1 : 0), 0);

export function emptyChain() {
  return { cards: [], runs: [], busted: false, bustCard: null };
}

export function activeSymbols(chain) {
  return chain.runs.filter((r) => r.alive).map((r) => r.symbol);
}

function cardExtends(chain, card) {
  if (chain.cards.length === 0) return true;
  const alive = activeSymbols(chain);
  return card.symbols.some((s) => alive.includes(s));
}

// Una racha por símbolo distinto, ya arrancada en las veces que la carta lo trae: la
// mejorada abre en 2 y no en 1.
const openRuns = (card) => [...new Set(card.symbols)].map((symbol) => ({
  symbol, length: timesIn(card, symbol), cards: 1, alive: true,
}));

// Las rachas vivas que la carta trae se alargan; las que no, mueren.
const extendRuns = (runs, card) => runs.map((run) => {
  if (!run.alive) return run;
  return card.symbols.includes(run.symbol)
    ? { ...run, length: run.length + timesIn(card, run.symbol), cards: run.cards + 1 }
    : { ...run, alive: false };
});

// Devuelve una cadena nueva (no muta la anterior) para poder simular en la IA.
export function playCard(chain, card) {
  if (chain.busted) return chain;
  if (chain.cards.length === 0) {
    return { cards: [card], runs: openRuns(card), busted: false, bustCard: null };
  }
  if (!cardExtends(chain, card)) return { ...chain, busted: true, bustCard: card };
  return { cards: [...chain.cards, card], runs: extendRuns(chain.runs, card), busted: false, bustCard: null };
}

export function scoreChain(chain) {
  if (chain.busted) {
    return { total: 0, breakdown: chain.runs.map((r) => ({ ...r, points: 0 })) };
  }
  const breakdown = chain.runs
    .map((r) => ({ ...r, points: r.length * r.length }))
    .sort((a, b) => b.points - a.points);
  return { total: breakdown.reduce((sum, r) => sum + r.points, 0), breakdown };
}

// ¿Esta carta forma parte de la racha del símbolo? Sirve para pintar la mesa.
//
// Va contra `cards` y no contra `length`: lo que se pregunta es "¿la racha llegó hasta
// esta carta?", y con una carta mejorada de por medio el largo ya corre más rápido que
// las cartas.
export function isScoringCell(chain, cardIndex, symbol) {
  const run = chain.runs.find((r) => r.symbol === symbol);
  return Boolean(run && run.cards > cardIndex);
}

// Probabilidad de que la próxima carta del mazo continúe la cadena. El Rocket Stamp
// nunca corta: con la cadena abierta se monta gratis sobre una carta (ver `isFreeStack`).
export function survivalOdds(chain, deck) {
  if (deck.length === 0) return { ok: 0, total: 0, p: 0 };
  if (chain.cards.length === 0) return { ok: deck.length, total: deck.length, p: 1 };
  const alive = activeSymbols(chain);
  const ok = deck.filter((c) => isFreeStack(c) || c.symbols.some((s) => alive.includes(s))).length;
  return { ok, total: deck.length, p: ok / deck.length };
}

/**
 * El Rocket Stamp es la carta gratis: al salir no entra en la cadena ni la puede
 * cortar, se monta sobre la columna que elija su dueño (`stackOnCard`). Solo abre la
 * cadena como cualquier otra cuando sale primera, que no hay dónde montarla.
 */
export const isFreeStack = (card) => card?.power === 'freegame';

/**
 * La columna donde montar `card` que deja la cadena con más puntos (ante un empate, la
 * primera). La usa la CPU para elegir y el motor cuando nadie eligió a tiempo.
 */
export function bestStack(chain, card) {
  let col = 0;
  let best = -1;
  for (let i = 0; i < chain.cards.length; i++) {
    const points = stackPoints(chain, i, card);
    if (points > best) {
      best = points;
      col = i;
    }
  }
  return col;
}

/**
 * Los puntos de `stackOnCard(chain, col, card)` sin armar la cadena: la CPU los pide en
 * cada rama del lookahead, y armar cartas y rachas nuevas por columna triplicaba lo que
 * tarda en pensar.
 */
function stackPoints(chain, col, card) {
  const { cards } = chain;
  const times = (i, symbol) => timesIn(cards[i], symbol) + (i === col ? timesIn(card, symbol) : 0);
  const opening = col === 0 ? new Set([...cards[0].symbols, ...card.symbols]) : new Set(cards[0].symbols);
  let total = 0;
  for (const symbol of opening) {
    let length = times(0, symbol);
    for (let i = 1; i < cards.length; i++) {
      const n = times(i, symbol);
      if (n === 0) break;
      length += n;
    }
    total += length * length;
  }
  return total;
}

/**
 * Alarga una columna existente en la mesa montando una carta sobre ella (Free Game).
 * No suma casillero (`cards.length` se mantiene igual) y no corta la cadena.
 * Si se monta sobre la columna 1, sus símbolos quedan en la apertura y pueden
 * abrir nuevas rachas puntuables; en cualquier columna suma al largo de las
 * rachas vivas que coincidan con los símbolos nuevos.
 */
export function stackOnCard(chain, colIndex, card) {
  if (chain.busted || !Number.isInteger(colIndex) || colIndex < 0 || colIndex >= chain.cards.length) return chain;

  const target = chain.cards[colIndex];
  const stacked = target.stackedCards ? [...target.stackedCards, card] : [target, card];
  const allPowers = stacked.map((c) => c.power).filter(Boolean);
  const updatedCard = {
    ...target,
    symbols: [...target.symbols, ...card.symbols],
    stackedCards: stacked,
    powers: allPowers,
    power: allPowers.find((p) => p !== 'freegame') || allPowers[0] || null,
  };

  const cards = chain.cards.map((c, i) => (i === colIndex ? updatedCard : c));
  const [first, ...rest] = cards;
  return { ...chain, cards, runs: rest.reduce(extendRuns, openRuns(first)), busted: false, bustCard: null };
}
