import { tr } from './i18n.js';

// Símbolos del juego. `color` es el del anillo del crest y tiñe las cadenas en la mesa.
export const SYMBOLS = {
  beast:   { id: 'beast',   name: tr('Bestia'), color: '#f5b53d' },
  aquatic: { id: 'aquatic', name: tr('Pez'),    color: '#4bb8f0' },
  bird:    { id: 'bird',    name: tr('Pájaro'), color: '#ff7bac' },
  plant:   { id: 'plant',   name: tr('Planta'), color: '#54cf8b' },
  bug:     { id: 'bug',     name: tr('Bicho'),  color: '#ff6a5c' },
  reptile: { id: 'reptile', name: tr('Reptil'), color: '#a97cff' },
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
 *   poisonHalve    en cuánto se parte el veneno al finalizar el turno, después de morder
 *   poisonFloor    con esto o menos encima, el veneno se va: la cola de un veneno
 *                  partiéndose al medio es infinita y no decide nada
 *   poisonStacks   true suma venenos; false se queda con el mayor, como el caracol
 *   snailShare     en cuánto se parte el ataque del debilitado (2 = la mitad).
 *                  Redondea para arriba: un caracol nunca deja un ataque en cero
 *   snailAttacks   cuántos ataques debilita cada caracol. Se suman
 *   eggShare       divisor del golpe con que se arma el escudo
 *   eggBreak       daño fijo que le vuelve al que rompió el huevo (acumulable por cada huevo). 0 lo apaga: el
 *                  huevo solo tapa
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
  poisonHalve: 2,
  poisonFloor: 2,
  poisonStacks: true,
  snailShare: 2,
  snailAttacks: 1,
  eggShare: 2,
  eggBreak: 8,
  octopusPowers: true,
  octopusStacks: true,
  octopusOnStand: true,
  powerBias: 1,
  brutalStep: 2,
  featherDamage: 5,
  leafHeal: 4,
  leafGain: 2,
  leafMax: 5,
  leechDrain: 6,
  leechBonusThreshold: 4,
  leechBonusDrain: 12,
  steelskinBaseCap: 12,
  steelskinStep: 2,
  steelskinFloor: 6,
};

// Cada `note` es la definición entera del poder: cuándo salta y qué hace. "Al pegar"
// es siempre lo mismo —te plantaste y el ataque hizo más de 0—; los que salen de
// otra forma lo dicen. Es el texto que ve el jugador en la aventura y en el `title`
// de cada ícono, así que los números salen de `TUNING` y no se escriben a mano.
const LEAF_NOTE = tr(
  'al pegar, +{gain} hojas (hasta {max}); al final de cada turno tuyo, cada hoja te cura {heal} y se gasta 1',
  { gain: TUNING.leafGain, max: TUNING.leafMax, heal: TUNING.leafHeal },
);

// Todos los símbolos especiales se obtienen EXCLUSIVAMENTE de la carpeta amuletos
// (`simbolos especiales/amuletos/`).
export const POWERS = {
  egg: {
    id: 'egg', symbol: 'bird', name: 'Secret Egg', amuleto: 'ecard_bird_5003.png',
    note: tr('al pegar, ganás un escudo de la mitad del golpe; si el rival lo rompe, recibe {dmg} de daño', { dmg: TUNING.eggBreak }),
  },
  feather: {
    id: 'feather', symbol: 'bird', name: 'Feather Earring', amuleto: 'ecard_bird_momo_1.png',
    note: tr('apenas la robás, {dmg} de daño directo al rival, aunque después te cortes', { dmg: TUNING.featherDamage }),
  },
  octopus: {
    id: 'octopus', symbol: 'aquatic', name: 'Sticky Octopus', amuleto: 'ecard_aquatic_5004.png',
    note: tr('al plantarte (aunque pegues 0), elegís 1 carta extra del mercado para tu mazo'),
  },
  pot: {
    id: 'pot', symbol: 'plant', name: 'Leafy Pot', amuleto: 'ecard_plant_4003.png',
    note: tr('al pegar, te curás lo mismo que pegaste'),
  },
  poison: {
    id: 'poison', symbol: 'reptile', name: 'Poison Vial', amuleto: 'ecard_reptile_venoki_1.png',
    note: tr('al pegar, envenenás al rival con la mitad del golpe; al final de cada turno suyo le saca eso ' +
      'y se reduce a la mitad'),
  },
  snail: {
    id: 'snail', symbol: 'bug', name: 'Lazy Snail', amuleto: 'ecard_bug_5005.png',
    note: tr('al pegar, el próximo ataque del rival hace la mitad de daño'),
  },
  strength: {
    id: 'strength', symbol: 'beast', name: 'Charm of Power', amuleto: 'ecard_beast_4001.png',
    note: tr('al pegar, +{step} de daño en ese ataque y en todos los que siguen', { step: TUNING.strengthStep }),
  },
  brutal: {
    id: 'brutal', symbol: 'beast', name: 'Energy Drink M', amuleto: 'ecard_beast_5003.png',
    note: tr('al pegar, +{step} de daño por cada símbolo de tu racha más larga', { step: TUNING.brutalStep }),
  },
  bubble: {
    id: 'bubble', symbol: 'aquatic', name: 'Bubble Paste', amuleto: 'ecard_aquatic_4003.png',
    note: tr('al plantarte, la carta que elijas del mercado abre tu próxima ronda'),
  },
  freegame: {
    id: 'freegame', symbol: null, name: 'Rocket Stamp', amuleto: 'ecard_neutral_5001.png',
    note: tr('si comparte un símbolo con tu cadena, tu próximo robo se monta sobre una carta de la mesa ' +
      'y le suma sus símbolos'),
  },
  leaf: { id: 'leaf', symbol: 'plant', name: 'Spring Leaf', amuleto: 'ecard_plant_ena_1.png', note: LEAF_NOTE },
  // Alias viejo de la hoja: mismo poder con otro id.
  oak: { id: 'oak', symbol: 'plant', name: 'Spring Leaf', amuleto: 'ecard_plant_ena_1.png', note: LEAF_NOTE },
  leech: {
    id: 'leech', symbol: 'bug', name: 'Mantis Dagger', amuleto: 'ecard_mantis_dagger.png',
    note: tr('al pegar, le sacás {drain} de vida al rival y te los curás ' +
      '({bonus} con {thresh} o más columnas en mesa)', {
      drain: TUNING.leechDrain,
      bonus: TUNING.leechBonusDrain,
      thresh: TUNING.leechBonusThreshold,
    }),
  },
  steelskin: {
    id: 'steelskin', symbol: 'reptile', name: 'Gecko Mask', amuleto: 'ecard_reptile_4003.png',
    note: tr('al pegar, el próximo golpe del rival te hace {cap} de daño como máximo', { cap: TUNING.steelskinBaseCap }),
  },
};

for (const p of Object.values(POWERS)) p.icon = iconUrl(`power-${p.id}.png`);

export const POWER_IDS = Object.keys(POWERS);

/** Los poderes disponibles por cada clase para sortear uno por partida. */
export const CLASS_POWERS = {
  beast:   ['strength', 'brutal'],
  aquatic: ['octopus', 'bubble'],
  bird:    ['egg', 'feather'],
  plant:   ['pot', 'leaf'],
  bug:     ['snail', 'leech'],
  reptile: ['poison', 'steelskin'],
};

export const CLASS_POWER_IDS = Object.values(CLASS_POWERS).flat();

/** Sortea un poder activo para cada clase. */
export function chooseActivePowers(rng = Math.random) {
  return SYMBOL_IDS.map((sym) => {
    const list = CLASS_POWERS[sym] || [];
    return list[Math.floor(rng() * list.length)];
  }).filter(Boolean);
}

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
 * que el centro tiene que ofrecer. Los dos poderes de una clase comparten tríos:
 * como solo uno de los dos entra en cada partida, el balance es el mismo.
 */
const CLASS_TRIOS = {
  bird: [
    ['beast', 'aquatic'], ['beast', 'plant'], ['aquatic', 'bug'],
    ['plant', 'bug'], ['plant', 'reptile'], ['bug', 'reptile'],
  ],
  aquatic: [
    ['beast', 'bird'], ['beast', 'plant'], ['bird', 'plant'],
    ['bird', 'bug'], ['plant', 'reptile'], ['bug', 'reptile'],
  ],
  plant: [
    ['beast', 'aquatic'], ['beast', 'bug'], ['aquatic', 'reptile'],
    ['bird', 'bug'], ['bird', 'reptile'], ['bug', 'reptile'],
  ],
  reptile: [
    ['beast', 'aquatic'], ['beast', 'bird'], ['beast', 'plant'],
    ['aquatic', 'bird'], ['aquatic', 'bug'], ['plant', 'bug'],
  ],
  bug: [
    ['beast', 'aquatic'], ['beast', 'bird'], ['beast', 'plant'],
    ['aquatic', 'reptile'], ['bird', 'reptile'], ['plant', 'reptile'],
  ],
  beast: [
    ['aquatic', 'bird'], ['aquatic', 'plant'], ['aquatic', 'bug'],
    ['bird', 'plant'], ['bird', 'reptile'], ['bug', 'reptile'],
  ],
};

export const POWER_TRIOS = Object.fromEntries(
  Object.values(POWERS).filter((p) => p.symbol).map((p) => [p.id, CLASS_TRIOS[p.symbol]]),
);

// Los uid son únicos entre todos los mazos: la UI los usa para no reanimar cartas ya vistas.
let nextUid = 0;
const byOrder = (a, b) => SYMBOL_IDS.indexOf(a) - SYMBOL_IDS.indexOf(b);

/**
 * Los símbolos se guardan siempre en el orden de SYMBOL_IDS, así `key` es canónica.
 * `power` entra en la clave porque dos cartas con los mismos tres símbolos y poderes
 * distintos son cartas distintas —encadenan igual, pero no valen lo mismo—.
 */
export function makeCard(symbols, power = null, opts = {}) {
  const sorted = symbols.slice().sort(byOrder);
  const key = sorted.join('+');
  const uid = nextUid++;
  return {
    uid,
    id: opts.id ?? `c_${uid}`,
    name: opts.name ?? (power ? (POWERS[power]?.name || tr('Poder')) : sorted.map((s) => SYMBOLS[s]?.name || s).join(' · ')),
    symbols: sorted,
    isFavorable: opts.isFavorable ?? false,
    associatedPart: opts.associatedPart,
    hasPower: Boolean(power),
    powerEffect: power || undefined,
    power,
    key: power ? `${key}@${power}` : key,
  };
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
export function buildPool(activePowers = null, rng = Math.random) {
  const plain = [2, 3].flatMap((size) =>
    combinations(SYMBOL_IDS, size).map((symbols) => makeCard(symbols)),
  );
  const powers = activePowers || chooseActivePowers(rng);
  const powered = powers.flatMap((id) =>
    POWER_TRIOS[id].map((pair) => makeCard([POWERS[id].symbol, ...pair], id)),
  );
  const freegame = combinations(SYMBOL_IDS, 2).map((symbols) => makeCard(symbols, 'freegame'));
  return [...plain, ...powered, ...freegame];
}

// ---- Taxonomía Canónica y Axie Core ------------------------------------------

/** Orden cíclico canónico de las 6 clases (índices 0 a 5) */
export const CANONICAL_CLASSES = ['plant', 'beast', 'aquatic', 'bird', 'bug', 'reptile'];

/** Partes anatómicas NFT del Axie */
export const ANATOMICAL_PARTS = ['eyes', 'ears', 'horn', 'mouth', 'back', 'tail'];

export const PART_NAMES = {
  tail: tr('Cola'),
  mouth: tr('Boca'),
  eyes: tr('Ojos'),
  ears: tr('Orejas'),
  horn: tr('Cuerno'),
  back: tr('Espalda'),
};

/**
 * Saltos anatómicos fijos sobre el ciclo canónico:
 *   tail:  0  (mono-símbolo pura: [C_i])
 *   mouth: +1 [C_i, C_{(i+1)%6}]
 *   eyes:  +2 [C_i, C_{(i+2)%6}]
 *   ears:  +3 [C_i, C_{(i+3)%6}]
 *   horn:  +4 [C_i, C_{(i+4)%6}]
 *   back:  +5 [C_i, C_{(i+5)%6}]
 */
export const ANATOMICAL_JUMPS = {
  tail: 0,
  mouth: 1,
  eyes: 2,
  ears: 3,
  horn: 4,
  back: 5,
};

/** Tríadas canónicas (Piedra, Papel o Tijera) */
export const TRIADS = {
  rock: ['plant', 'reptile'],
  paper: ['beast', 'bug'],
  scissors: ['bird', 'aquatic'],
};

/** Regla de combate: Paper vence a Rock, Scissors vence a Paper, Rock vence a Scissors */
export const TRIAD_BEATS = {
  paper: 'rock',
  scissors: 'paper',
  rock: 'scissors',
};

export const TRIAD_LOSES_TO = Object.fromEntries(
  Object.entries(TRIAD_BEATS).map(([winner, loser]) => [loser, winner]),
);

/** Determina la tríada canónica a la que pertenece una clase */
export const getTriadForClass = (cls) =>
  Object.keys(TRIADS).find((triad) => TRIADS[triad].includes(cls)) ?? null;

/**
 * Sistema de Tríadas y Cartas Desfavorables (Counter Suppression Formula):
 * Para cualquier clase base:
 *   A: Aliado (la otra clase de su misma tríada).
 *   P1, P2: Presas (las 2 clases de la tríada a la que vence).
 *   C1, C2: Counters (las 2 clases de la tríada que la vence).
 *
 * Retorna las 4 cartas desfavorables:
 *   Card 1: [A, P1]
 *   Card 2: [A, P2]
 *   Card 3: [P1, P2]
 *   Card 4: [C1, C2] (confinamiento de amenaza)
 *
 * Verificación matemática: En las cartas desfavorables, las Presas y el Aliado
 * aparecen 2 veces cada una, mientras que los Counters aparecen exactamente 1 vez.
 */
export function getCounterSuppressionCards(baseClass) {
  const triad = getTriadForClass(baseClass);
  if (!triad) throw new Error(`Clase no reconocida: ${baseClass}`);

  const ally = TRIADS[triad].find((c) => c !== baseClass);
  const byCanonical = (a, b) => CANONICAL_CLASSES.indexOf(a) - CANONICAL_CLASSES.indexOf(b);

  const preyTriad = TRIAD_BEATS[triad];
  const counterTriad = TRIAD_LOSES_TO[triad];

  const preys = TRIADS[preyTriad].slice().sort(byCanonical);
  const counters = TRIADS[counterTriad].slice().sort(byCanonical);

  const [p1, p2] = preys;
  const [c1, c2] = counters;

  return [
    [ally, p1],
    [ally, p2],
    [p1, p2],
    [c1, c2],
  ];
}

// Compatibilidad retroactiva: todas las cartas desfavorables posibles
export const UNFAVORABLE = CANONICAL_CLASSES.flatMap(getCounterSuppressionCards);

/** Normaliza un id de clase, objeto Axie o estado NFT a la estructura AxieNFTState */
export function toAxieNFTState(input) {
  if (!input) return null;
  if (typeof input === 'string') {
    const parts = {};
    for (const p of ANATOMICAL_PARTS) {
      parts[p] = { class: input, isEvolved: false };
    }
    return { id: input, baseClass: input, parts };
  }
  if (input.baseClass && input.parts) {
    return input;
  }
  if (input.class && input.parts) {
    const parts = {};
    for (const p of ANATOMICAL_PARTS) {
      const val = input.parts[p];
      if (typeof val === 'string') {
        const cls = val.split('-')[0];
        parts[p] = { class: cls, isEvolved: false };
      } else if (val && typeof val === 'object') {
        parts[p] = { class: val.class || input.class, isEvolved: Boolean(val.isEvolved) };
      } else {
        parts[p] = { class: input.class, isEvolved: false };
      }
    }
    return {
      id: input.id || input.class,
      baseClass: input.class,
      parts,
    };
  }
  return null;
}

/**
 * Genera el mazo base de 10 cartas según la taxonomía canónica y Axie Core:
 *  - 6 cartas favorables asociadas a las partes anatómicas con saltos canónicos
 *    y mutación por Part Evolution (isEvolved: true incorpora C_{part})
 *  - 4 cartas desfavorables calculadas por la Counter Suppression Formula
 */
export function baseDeck(baseClass, nftState = null) {
  const i = CANONICAL_CLASSES.indexOf(baseClass);
  if (i === -1) throw new Error(`Clase base inválida: ${baseClass}`);

  const state = nftState ? toAxieNFTState(nftState) : null;
  const parts = state?.parts || {};

  // 6 cartas favorables según saltos anatómicos fijos
  const favorableCards = Object.entries(ANATOMICAL_JUMPS).map(([part, jump]) => {
    const symbols = jump === 0 ? [baseClass] : [baseClass, CANONICAL_CLASSES[(i + jump) % 6]];
    // Axie Core - Part Evolution (Mutación a 3 símbolos / 2 en cola)
    if (parts[part]?.isEvolved) symbols.push(parts[part].class || baseClass);

    return makeCard(symbols, null, {
      id: `${baseClass}-${part}`,
      name: PART_NAMES[part],
      isFavorable: true,
      associatedPart: part,
    });
  });

  // 4 cartas desfavorables (Counter Suppression Formula)
  const unfavorablePairs = getCounterSuppressionCards(baseClass);
  const unfavorableNames = [
    tr('Alianza Presa 1'),
    tr('Alianza Presa 2'),
    tr('Doble Presa'),
    tr('Confinamiento'),
  ];

  const unfavorableCards = unfavorablePairs.map((pair, idx) =>
    makeCard(pair, null, {
      id: `${baseClass}-unfav-${idx + 1}`,
      name: unfavorableNames[idx],
      isFavorable: false,
    })
  );

  return [...favorableCards, ...unfavorableCards];
}

/**
 * Qué símbolo se le puede sumar a una carta del mazo de quien juega `symbol`. Uno
 * solo, y de los que la carta ya tiene algo que ver:
 *
 *  - las seis cartas propias —las que llevan tu símbolo— admiten **el tuyo**, que es
 *    el único que te sirve de las dos maneras: sube la racha de tu color y no le abre
 *    la puerta a ningún otro.
 *  - las cuatro no favorables —las que no lo llevan— admiten **uno de sus dos**, el
 *    que elijas. Son las cartas que no te representan, así que la mejora es elegir
 *    cuál de las dos mitades ajenas pesa más: un `pez+reptil` mejorado con reptil
 *    queda con dos reptiles y un pez.
 *
 * El símbolo repetido no es adorno: la racha cuenta cada aparición (ver `timesIn` en
 * `rules.js`), así que una carta con el símbolo dos veces adelanta su racha de a dos
 * y la racha puntúa al cuadrado.
 */
export function boostOptions(card, symbol) {
  const own = [...new Set(card.symbols)];
  return own.includes(symbol) ? [symbol] : own;
}

/**
 * Genera el mazo completo de 10 cartas a partir de un AxieNFTState.
 */
export function buildAxieDeck(nftState) {
  const state = toAxieNFTState(nftState);
  if (!state) throw new Error('Estado NFT inválido para buildAxieDeck');
  return baseDeck(state.baseClass, state);
}

/**
 * El mazo de 10 con las mejoras puestas y/o estado AxieNFTState.
 * Compatible con strings de clase, objetos Axie del roster y AxieNFTState.
 */
export function buildPersonalDeck(axieOrClass, boosts = {}) {
  const nftState = toAxieNFTState(axieOrClass);
  const baseClass = nftState.baseClass;
  const cards = baseDeck(baseClass, nftState);

  return cards.map((card) => {
    const add = boosts[card.key];
    return add && boostOptions(card, baseClass).includes(add)
      ? makeCard([...card.symbols, add], card.power, {
          id: card.id,
          name: card.name,
          isFavorable: card.isFavorable,
          associatedPart: card.associatedPart,
        })
      : card;
  });
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

/** Los poderes de una carta: uno, o todos los de las cartas que lleva montadas. */
export const powersOf = (card) => (card.stackedCards
  ? card.stackedCards.map((c) => c.power).filter(Boolean)
  : (card.powers || (card.power ? [card.power] : [])));

/** Los símbolos de una carta —y su poder, si tiene—, para el registro de la partida. */
export const cardLabel = (card) =>
  card.symbols.map((s) => crest(s, 'sm')).join('') + powersOf(card).map((p) => powerIcon(p, 'sm')).join('');
