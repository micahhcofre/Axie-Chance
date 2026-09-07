// Símbolos del juego. `color` es el del anillo del crest y tiñe las cadenas en la mesa.
export const SYMBOLS = {
  beast:   { id: 'beast',   name: 'Bestia', color: '#f5b53d' },
  aquatic: { id: 'aquatic', name: 'Pez',    color: '#4bb8f0' },
  bird:    { id: 'bird',    name: 'Pájaro', color: '#ff7bac' },
  plant:   { id: 'plant',   name: 'Planta', color: '#54cf8b' },
  bug:     { id: 'bug',     name: 'Bicho',  color: '#ff6a5c' },
  reptile: { id: 'reptile', name: 'Reptil', color: '#a97cff' },
};

/**
 * La URL de un PNG de `Icons/`. El build de un solo archivo (`npm run build`) mete
 * todos como data URI en `ICON_URLS`; servido desde el repo son rutas relativas.
 */
export const iconUrl = (file) => globalThis.ICON_URLS?.[file] ?? `Icons/${file}`;

for (const [id, sym] of Object.entries(SYMBOLS)) sym.crest = iconUrl(`${id}-crest.png`);

export const SYMBOL_IDS = Object.keys(SYMBOLS);

/** Crest como HTML. `size` es una clase modificadora: 'sm' para texto corrido. */
export function crest(symbol, size = '') {
  const s = SYMBOLS[symbol];
  const cls = size ? `crest crest--${size}` : 'crest';
  return `<img class="${cls}" src="${s.crest}" alt="${s.name}" title="${s.name}">`;
}

// ---- poderes ----------------------------------------------------------------

/**
 * Los seis poderes. Cada uno viaja pegado a una carta como un símbolo de más que la
 * cadena no ve: no abre cadena, no la continúa, no la corta y no puntúa —`rules.js`
 * ni se entera de que existe—. Solo dispara su efecto cuando su dueño suelta el
 * ataque; el pulpo es la excepción y corre a mitad de turno (ver `game.js`).
 *
 * `symbol` es la clase a la que pertenece: las seis cartas de un poder la llevan
 * siempre entre sus tres símbolos, así el efecto de tu color encadena con tu mazo
 * mejor que con ningún otro.
 */
/**
 * Los números de los poderes, en un solo lugar y mutables a propósito: el banco de
 * pruebas los cambia para medir variantes sin editar código entre corridas. El juego
 * los lee en cada uso, así que un cambio acá vale desde la partida siguiente.
 *
 *   strengthStep   cuánto suma cada carta de fuerza, para siempre
 *   poisonShare    divisor del golpe con que se envenena (2 = la mitad)
 *   poisonDecay    cuánto baja el veneno al cerrar la ronda, después de morder
 *   poisonStacks   true suma venenos; false se queda con el mayor, como el caracol
 *   snailShare     divisor del golpe con que se debilita
 *   snailAttacks   cuántos ataques dura cada caracol
 *   eggShare       divisor del golpe con que se arma el escudo
 *   octopusPowers  si la carta que paga el pulpo puede llevar poder
 *   octopusStacks  true: cada pulpo paga una carta. false: una por reparto, salgan
 *                  los pulpos que salgan
 *   octopusOnStand si el pulpo exige haberse plantado. Con false sale igual con la
 *                  cadena cortada, como la fuerza.
 *                  Ojo: se mide contra la cadena, no contra el daño. Un jugador muy
 *                  debilitado puede plantarse y pegar 0 igual (ver `swingOf`), y ahí
 *                  cobrar el pulpo es lo correcto: ya lo castigó el caracol
 *   powerBias      multiplicador sobre POWER_WORTH: cuán seguido la CPU prefiere un
 *                  poder antes que dos cartas sin poder. No es un número del juego
 *                  sino de la cabeza que lo juega, y está acá para poder medirlo
 *
 * Viven acá y no en `game.js` para que los carteles de los poderes puedan salir de
 * los mismos números que el juego usa. La versión anterior los escribía a mano en
 * cada `note`, y el del caracol ya mentía: decía "pega 2 menos" cuando hace rato que
 * saca la mitad del golpe. Un texto que hay que acordarse de actualizar se
 * desactualiza.
 */
export const TUNING = {
  strengthStep: 1,
  poisonShare: 2,
  poisonDecay: 2,
  poisonStacks: true,
  snailShare: 2,
  snailAttacks: 2,
  eggShare: 2,
  octopusPowers: true,
  octopusStacks: true,
  octopusOnStand: true,
  powerBias: 1,
};

export const POWERS = {
  egg: {
    id: 'egg', symbol: 'bird', name: 'Huevo',
    note: 'escudo de medio golpe: se come el próximo ataque y se rompe',
  },
  octopus: {
    id: 'octopus', symbol: 'aquatic', name: 'Pulpo',
    note: 'una carta de más del centro, la que quieras: abre tu próxima ronda',
  },
  pot: {
    id: 'pot', symbol: 'plant', name: 'Maceta',
    note: 'te curás lo mismo que pegaste',
  },
  poison: {
    id: 'poison', symbol: 'reptile', name: 'Veneno',
    note: `la mitad del daño, cada ronda, bajando de a ${TUNING.poisonDecay}`,
  },
  snail: {
    id: 'snail', symbol: 'bug', name: 'Caracol',
    note: `el rival pega la mitad durante ${TUNING.snailAttacks} ataques`,
  },
  strength: {
    id: 'strength', symbol: 'beast', name: 'Fuerza',
    note: `+${TUNING.strengthStep} de daño en este ataque y en todos los que siguen`,
  },
};

for (const p of Object.values(POWERS)) p.icon = iconUrl(`power-${p.id}.png`);

export const POWER_IDS = Object.keys(POWERS);

/** El símbolo de poder como HTML, para la carta y para el registro. */
export function powerIcon(id, size = '') {
  const p = POWERS[id];
  const cls = size ? `power power--${size}` : 'power';
  return `<img class="${cls}" src="${p.icon}" alt="${p.name}" title="${p.name}: ${p.note}">`;
}

/**
 * Las dos clases que acompañan a cada poder en sus seis cartas —la tercera es
 * siempre la suya—. Están elegidas para que las seis clases aparezcan exactamente
 * 18 veces entre las 36 cartas: 6 como dueña de su propio poder y 12 como
 * acompañante. Así ninguna queda sobrerrepresentada en la reserva.
 *
 * Son 36 cartas sobre 20 tríos posibles, así que el mismo trío aparece con poderes
 * distintos. Encadenan igual y se eligen por el efecto, que es justo la decisión
 * que el centro tiene que ofrecer.
 */
export const POWER_TRIOS = {
  egg: [
    ['beast', 'aquatic'], ['beast', 'plant'], ['aquatic', 'bug'],
    ['plant', 'bug'], ['plant', 'reptile'], ['bug', 'reptile'],
  ],
  octopus: [
    ['beast', 'bird'], ['beast', 'plant'], ['bird', 'plant'],
    ['bird', 'bug'], ['plant', 'reptile'], ['bug', 'reptile'],
  ],
  pot: [
    ['beast', 'aquatic'], ['beast', 'bug'], ['aquatic', 'reptile'],
    ['bird', 'bug'], ['bird', 'reptile'], ['bug', 'reptile'],
  ],
  poison: [
    ['beast', 'aquatic'], ['beast', 'bird'], ['beast', 'plant'],
    ['aquatic', 'bird'], ['aquatic', 'bug'], ['plant', 'bug'],
  ],
  snail: [
    ['beast', 'aquatic'], ['beast', 'bird'], ['beast', 'plant'],
    ['aquatic', 'reptile'], ['bird', 'reptile'], ['plant', 'reptile'],
  ],
  strength: [
    ['aquatic', 'bird'], ['aquatic', 'plant'], ['aquatic', 'bug'],
    ['bird', 'plant'], ['bird', 'reptile'], ['bug', 'reptile'],
  ],
};

// Los uid son únicos entre todos los mazos: la UI los usa para no reanimar cartas ya vistas.
let nextUid = 0;
const byOrder = (a, b) => SYMBOL_IDS.indexOf(a) - SYMBOL_IDS.indexOf(b);

/**
 * Los símbolos se guardan siempre en el orden de SYMBOL_IDS, así `key` es canónica.
 * `power` entra en la clave porque dos cartas con los mismos tres símbolos y poderes
 * distintos son cartas distintas —encadenan igual, pero no valen lo mismo—.
 */
function makeCard(symbols, power = null) {
  const sorted = symbols.slice().sort(byOrder);
  const key = sorted.join('+');
  return { uid: nextUid++, symbols: sorted, power, key: power ? `${key}@${power}` : key };
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

/**
 * Reserva común: 71 cartas. Las 35 sin poder —las 15 combinaciones de 2 símbolos y
 * las 20 de 3, una por combinación— más las 36 con poder, seis por cada uno. De acá
 * salen las cartas que los jugadores suman a su mazo personal; los mazos iniciales
 * de 10 no llevan poderes.
 */
export function buildPool() {
  const plain = [2, 3].flatMap((size) =>
    combinations(SYMBOL_IDS, size).map((symbols) => makeCard(symbols)),
  );
  const powered = POWER_IDS.flatMap((id) =>
    POWER_TRIOS[id].map((pair) => makeCard([POWERS[id].symbol, ...pair], id)),
  );
  return [...plain, ...powered];
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

/**
 * Un generador de azar reproducible a partir de un número (mulberry32: corto, rápido
 * y de período de sobra para una partida).
 *
 * Existe para poder medir. Sin esto, dos corridas del mismo experimento reparten
 * cartas distintas y la diferencia entre ellas es mitad efecto y mitad sorteo — hacen
 * falta miles de partidas para distinguir una cosa de la otra. Con la misma semilla,
 * un A/B se compara de a pares sobre repartos idénticos y el ruido se cancela en vez
 * de sumarse.
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(cards, rng = Math.random) {
  const out = cards.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Los símbolos de una carta —y su poder, si tiene—, para el registro de la partida. */
export function cardLabel(card) {
  const syms = card.symbols.map((s) => crest(s, 'sm')).join('');
  return card.power ? `${syms}${powerIcon(card.power, 'sm')}` : syms;
}
