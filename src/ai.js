import { playCard, scoreChain, survivalOdds } from './rules.js';

// El mazo tiene 96 cartas pero solo 41 combinaciones distintas de símbolos.
// Agrupando por combinación, un lookahead de 3 niveles cuesta ~70k evaluaciones.
function deckProfile(deck) {
  const byKey = new Map();
  for (const card of deck) {
    const entry = byKey.get(card.key);
    if (entry) entry.count++;
    else byKey.set(card.key, { symbols: card.symbols, count: 1 });
  }
  return [...byKey.values()];
}

// Valor de estar en `chain` pudiendo plantarse o seguir robando.
function chainValue(chain, profile, remaining, depth) {
  const stand = scoreChain(chain).total;
  if (depth <= 0 || remaining <= 0) return stand;

  let drawValue = 0;
  for (const entry of profile) {
    if (entry.count === 0) continue;
    const next = playCard(chain, entry);
    if (next.busted) continue; // aporta 0
    const p = entry.count / remaining;
    entry.count--;
    drawValue += p * chainValue(next, profile, remaining - 1, depth - 1);
    entry.count++;
  }
  return Math.max(stand, drawValue);
}

function drawEV(chain, deck, depth) {
  const profile = deckProfile(deck);
  let ev = 0;
  for (const entry of profile) {
    if (entry.count === 0) continue;
    const next = playCard(chain, entry);
    if (next.busted) continue;
    const p = entry.count / deck.length;
    entry.count--;
    ev += p * chainValue(next, profile, deck.length - 1, depth - 1);
    entry.count++;
  }
  return ev;
}

// Profundidad del lookahead y cuánto tiene que superar el EV al puntaje actual.
// "Fácil" es tímida a propósito: se planta antes de tiempo y deja puntos en la mesa.
const STYLE = {
  facil:  { depth: 1, margin: 1.35, playsEndgame: false },
  normal: { depth: 2, margin: 1.0,  playsEndgame: true },
  duro:   { depth: 3, margin: 1.0,  playsEndgame: true },
};

/**
 * @param {object} chain      cadena actual de la CPU
 * @param {Array}  deck       cartas que todavía no se vieron
 * @param {object} opts
 * @param {number|null} opts.needs  puntaje mínimo que necesita para ganar el partido
 *                                  (solo en la última ronda jugando segunda)
 * @param {string} opts.difficulty
 */
export function decideDraw(chain, deck, { needs = null, difficulty = 'normal' } = {}) {
  if (deck.length === 0) return false;
  const style = STYLE[difficulty] ?? STYLE.normal;
  const stand = scoreChain(chain).total;

  // Si plantarse pierde el partido igual, no hay nada que conservar.
  if (needs !== null && style.playsEndgame) return stand < needs;

  return drawEV(chain, deck, style.depth) > stand * style.margin;
}

// ---- elección de cartas de la reserva ---------------------------------------

/**
 * Qué tan bien se enlaza una carta con un mazo: por cada símbolo suyo, cuántas
 * cartas del mazo lo llevan. Es la medida directa de lo que puntúa el juego —
 * una carta sirve en la medida en que puede continuar cadenas que ya podés abrir.
 */
export function connectivity(card, deck) {
  return card.symbols.reduce(
    (sum, s) => sum + deck.reduce((n, c) => n + (c.symbols.includes(s) ? 1 : 0), 0),
    0,
  );
}

/** La carta de `options` que mejor se enlaza con `deck`. */
export function pickBest(options, deck) {
  let best = null;
  let bestValue = -1;
  for (const card of options) {
    const v = connectivity(card, deck);
    if (v > bestValue) { bestValue = v; best = card; }
  }
  return best;
}

/** Las `n` mejores de `options`, reevaluando después de cada elección. */
function bestCards(options, deck, n) {
  const picked = [];
  const grown = deck.slice();
  const left = options.slice();
  let value = 0;
  while (picked.length < n && left.length) {
    let bestAt = 0;
    let best = -1;
    for (let i = 0; i < left.length; i++) {
      const v = connectivity(left[i], grown);
      if (v > best) { best = v; bestAt = i; }
    }
    const [card] = left.splice(bestAt, 1);
    picked.push(card);
    grown.push(card);
    value += best;
  }
  return { cards: picked, value };
}

const bySize = (pool, size) => {
  const match = pool.filter((c) => c.symbols.length === size);
  // Si no queda ninguna del tamaño pedido, sirve cualquiera: así la reserva
  // siempre se vacía y la partida termina.
  return match.length ? match : pool;
};

/**
 * Qué se lleva la CPU de la reserva.
 * @param {'stand'|'bust'} kind  se plantó (1 trío o 2 pares) o se cortó (1 par)
 */
export function planDraft(pool, deck, { kind }) {
  if (pool.length === 0) return { mode: null, cards: [] };
  if (kind === 'bust') return { mode: 'pair', ...bestCards(bySize(pool, 2), deck, 1) };

  const trio = bestCards(bySize(pool, 3), deck, 1);
  const pairs = bestCards(bySize(pool, 2), deck, 2);
  // Se compara por carta, no por total: cada carta extra diluye el mazo, así que
  // dos pares solo convienen si cada uno por separado se enlaza mejor que el trío.
  // Medido, comparar totales le hace perder 68-32 contra llevarse siempre el trío.
  const perCard = pairs.cards.length ? pairs.value / pairs.cards.length : -1;
  return perCard > trio.value ? { mode: 'pair', ...pairs } : { mode: 'trio', ...trio };
}
