// Símbolos del juego. `color` es el del anillo del crest y tiñe las cadenas en la mesa.
export const SYMBOLS = {
  beast:   { id: 'beast',   name: 'Bestia', color: '#f5b53d' },
  aquatic: { id: 'aquatic', name: 'Pez',    color: '#4bb8f0' },
  bird:    { id: 'bird',    name: 'Pájaro', color: '#ff7bac' },
  plant:   { id: 'plant',   name: 'Planta', color: '#54cf8b' },
  bug:     { id: 'bug',     name: 'Bicho',  color: '#ff6a5c' },
  reptile: { id: 'reptile', name: 'Reptil', color: '#a97cff' },
};

// El build de un solo archivo (`npm run build`) inyecta los crests como data URI
// en `CREST_URLS`; servido desde el repo se usan los PNG de Icons/.
for (const [id, sym] of Object.entries(SYMBOLS)) {
  sym.crest = globalThis.CREST_URLS?.[id] ?? `Icons/${id}-crest.png`;
}

export const SYMBOL_IDS = Object.keys(SYMBOLS);

/** Crest como HTML. `size` es una clase modificadora: 'sm' para texto corrido. */
export function crest(symbol, size = '') {
  const s = SYMBOLS[symbol];
  const cls = size ? `crest crest--${size}` : 'crest';
  return `<img class="${cls}" src="${s.crest}" alt="${s.name}" title="${s.name}">`;
}

// Los uid son únicos entre todos los mazos: la UI los usa para no reanimar cartas ya vistas.
let nextUid = 0;
const byOrder = (a, b) => SYMBOL_IDS.indexOf(a) - SYMBOL_IDS.indexOf(b);

/** Los símbolos se guardan siempre en el orden de SYMBOL_IDS, así `key` es canónica. */
function makeCard(symbols) {
  const sorted = symbols.slice().sort(byOrder);
  return { uid: nextUid++, symbols: sorted, key: sorted.join('+') };
}

function combinations(items, size) {
  if (size === 0) return [[]];
  const out = [];
  for (let i = 0; i <= items.length - size; i++) {
    for (const rest of combinations(items.slice(i + 1), size - 1)) {
      out.push([items[i], ...rest]);
    }
  }
  return out;
}

// Reserva común: 15 pares + 20 tríos = 35 cartas, todas distintas. De acá salen
// las cartas que los jugadores suman a su mazo personal.
export function buildPool() {
  return [2, 3].flatMap((size) => combinations(SYMBOL_IDS, size).map(makeCard));
}

// Las 6 cartas "no favorables": dos triángulos disjuntos de tres símbolos.
// Cada símbolo aparece en exactamente dos, así que a cualquier jugador le sobran 4.
export const UNFAVORABLE = [
  ['beast', 'bird'],
  ['bird', 'plant'],
  ['beast', 'plant'],
  ['bug', 'reptile'],
  ['reptile', 'aquatic'],
  ['aquatic', 'bug'],
];

/**
 * Mazo base del jugador que juega `symbol`: 10 cartas.
 *  - 5 pares del símbolo propio con cada uno de los otros cinco
 *  - 1 carta con el símbolo propio solo
 *  - las 4 cartas no favorables que no lo incluyen
 */
export function buildPersonalDeck(symbol) {
  return [
    ...SYMBOL_IDS.filter((s) => s !== symbol).map((s) => makeCard([symbol, s])),
    makeCard([symbol]),
    ...UNFAVORABLE.filter((pair) => !pair.includes(symbol)).map((pair) => makeCard(pair)),
  ];
}

export function shuffle(cards) {
  const out = cards.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Los símbolos de una carta, para intercalar en el registro de la partida. */
export function cardLabel(card) {
  return card.symbols.map((s) => crest(s, 'sm')).join('');
}
