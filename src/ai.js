import { playCard, scoreChain, survivalOdds } from './rules.js';
import { TUNING } from './data.js';

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

/**
 * Cuánto vale cada poder para la CPU, medido en cartas: 1 es "tanto como sumar una
 * carta más al mazo".
 *
 * Salen de atar al jugador a un solo poder contra la CPU normal y contar partidas
 * ganadas, 800 sembradas por poder, contra un control que nunca agarra ninguno
 * (`npm run balance`). En puntos sobre ese control:
 *
 *   veneno +11.4 · pulpo +10.4 · huevo +8.9 · fuerza +8.4 · caracol +7.7 · maceta +6.5
 *
 * De ese orden solo hay **dos escalones** afirmables: {veneno, pulpo, huevo, fuerza} y
 * {caracol, maceta}. Comparando cada poder pareado contra el líder de su grupo,
 * adentro de cada uno el banco no distingue nada. Los ± de la tabla son el error
 * contra el control, no el de la diferencia entre dos poderes: no sirven para
 * ordenarlos entre sí.
 *
 * Los pesos igual siguen los valores medidos y no los dos escalones, porque esto no
 * es una afirmación sino una decisión bajo incertidumbre: para elegir, el mejor
 * número disponible es la estimación, aunque no alcance para publicarla. Lo que no
 * hay que hacer es leer el orden fino como si fuera un hecho.
 *
 * La escala de la banda —cuán seguido un poder le gana a dos cartas sin poder— resultó
 * no importar. Está detrás de `TUNING.powerBias`, y multiplicarla por 0.7, 1.5 y 2 no
 * mueve ningún resultado fuera del ruido. Lo que decide es el **orden relativo**, no
 * el nivel absoluto.
 *
 * Ojo con el lazo: la medición corre contra esta misma CPU, así que cambiar estos
 * pesos mueve los números de los que salieron. No es circular como contar cuántas
 * veces la CPU elige cada poder —eso solo refleja estos pesos y nada más—, pero
 * conviene volver a correr el banco después de tocarlos. Por la misma razón, subir un
 * poder **baja** a los otros cinco: el rival también lo tiene.
 */
const POWER_WORTH = {
  poison: 1.7,
  octopus: 1.55,
  egg: 1.3,
  strength: 1.25,
  snail: 1.15,
  pot: 0.95,
};

/**
 * La carta suelta que paga cada pulpo. No es el reparto: es una sola carta, sirve
 * cualquiera —también con poder— y no sale del mazo sino de arriba de él, o sea que
 * es con lo que vas a abrir la ronda que viene.
 *
 * Se puntúa igual que en `planDraft`, con el efecto convertido a conectividad, pero
 * sin la comparación contra dos cartas: acá no se resigna nada, así que gana la de
 * más valor a secas. Las 36 cartas con poder son todas de 3 símbolos, así que la que
 * trae efecto casi siempre gana — y está bien: abrir con un trío abre tres cadenas en
 * vez de dos y **solo los símbolos de la primera carta puntúan**.
 */
export function pickBonus(pool, deck) {
  if (!pool.length) return null;
  const plain = pool.filter((c) => !c.power);
  const two = bestCards(plain, deck, 2);
  const perCard = two.cards.length ? two.value / two.cards.length : 0;

  let best = null;
  let bestValue = -Infinity;
  for (const card of pool) {
    const bonus = card.power ? POWER_WORTH[card.power] * TUNING.powerBias * perCard : 0;
    const value = connectivity(card, deck) + bonus;
    if (value > bestValue) { bestValue = value; best = card; }
  }
  return best;
}

/**
 * Qué se lleva la CPU del centro.
 *
 * La elección es poder contra cantidad: dos cartas sin poder, o una con poder. Se
 * miden en la misma unidad —conectividad con el mazo— sumándole al poder lo que
 * vale su efecto, convertido a conectividad con el promedio de las dos cartas que
 * estaría resignando. Así la comparación se adapta al mazo: cuando las cartas sin
 * poder enlazan muy bien, el efecto tiene que valer más para ganarles.
 *
 * @param {'stand'|'bust'} kind  se plantó (2 sin poder o 1 con poder) o se cortó (1 sin poder)
 */
export function planDraft(pool, deck, { kind }) {
  if (pool.length === 0) return { mode: null, cards: [] };
  const plain = pool.filter((c) => !c.power);
  const powered = pool.filter((c) => c.power);

  if (kind === 'bust') {
    return plain.length ? { mode: 'plain', ...bestCards(plain, deck, 1) } : { mode: null, cards: [] };
  }

  const two = bestCards(plain, deck, 2);
  const perCard = two.cards.length ? two.value / two.cards.length : 0;

  let best = null;
  let bestValue = -1;
  for (const card of powered) {
    const value = connectivity(card, deck) + POWER_WORTH[card.power] * TUNING.powerBias * perCard;
    if (value > bestValue) { bestValue = value; best = card; }
  }

  if (best && bestValue > two.value) return { mode: 'power', cards: [best], value: bestValue };
  return two.cards.length ? { mode: 'plain', ...two } : { mode: null, cards: [] };
}
