// El roster: los Axies que se eligen para jugar. Elegir un Axie es elegir con qué
// mazo jugás — el mazo sale de su clase (y de sus partes evolucionadas, si tiene).
//
// Hay dos clases de Axie en el roster:
//   - los seis starters de Origins (Olek, Momo, Puffy, Buba, Pomodoro, Venoki), cuerpos
//     fijos de Spine que trae el kit (ver `STARTERS`);
//   - seis Axies armados por partes con el mixer (Colmillo, Marea, Racha, Brote,
//     Aguijón, Escama).
//
// Los rivales de la Aventura son otros (ver `RIVALS`): también salen del mixer, no se
// eligen, y los de los últimos niveles traen partes evolucionadas.
//
// El dibujo son capas de PNG del CDN de Axie Infinity, calculadas de antemano por
// `npm run axies` y guardadas en `axie-avatars.js`. Si tocás `parts`, hay que volver
// a correrlo: el navegador no puede recalcularlas solo. Las partes válidas de cada
// clase están en `PART_CATALOG`, en ese mismo archivo.
//
// Ojo con `eyes`: no todas las partes animan igual. Cada una trae sus ojos cerrados,
// enojados y contentos, pero en varias el dibujo cerrado es casi el mismo que el
// abierto —`aquatic-02` cambia el 4% de los píxeles y `bug-08` el 2%—, así que el
// Axie parpadea y no se le nota. Los seis de acá están elegidos por eso.
import { SYMBOLS, buildPersonalDeck, toAxieNFTState, crest, makeCard } from './data.js';
import { AVATAR_BASE, AVATARS, EVOLVED } from './axie-avatars.js';
import { VARIANTS } from './axie-poses.js';

/**
 * Los starters de Origins, uno por clase: se juegan, no se enfrentan.
 *
 * No están hechos de partes del mixer: el kit los trae como cuerpos fijos de Spine, y
 * `kit` es el número de su carpeta en `PvE/Starters/`. El dibujo y las animaciones los
 * arman `npm run axies` y `npm run poses` desde ahí (ver `scripts/starters.mjs`).
 *
 *   `kitParts` sus partes de verdad, del catálogo del kit
 *             (`Assets/OriginsKit/Catalogs/pve-starters.json`). No son partes NFT —no
 *             están en el mixer— pero dicen de qué clase es cada una: Buba tiene el
 *             cuerno y la espalda de planta. El mazo sale de la clase, como el de
 *             cualquiera; la clase de la parte solo cuenta al evolucionarla (su carta
 *             suma ese símbolo, ver `deckFor`). Las Mech, Dawn y Dusk cuentan como de la
 *             clase del Axie (ver `partClass`).
 *   `awake`   la parte que cambia de dibujo en su cuerpo despierto (`N-1` en el kit).
 *             Es una sola —dos slots en las orejas de Puffy—; `npm run axies` verifica
 *             que sea esa.
 */
export const STARTERS = {
  olek: {
    id: 'olek', class: 'plant', name: 'Olek', kit: 2, awake: ['horn'],
    kitParts: {
      eyes: 'plant-eyes-01', ears: 'reptile-ears-03', mouth: 'plant-mouth-01',
      horn: 'mech-horn-03', back: 'plant-back-01', tail: 'plant-tail-01',
    },
  },
  momo: {
    id: 'momo', class: 'bird', name: 'Momo', kit: 12, awake: ['back'],
    kitParts: {
      eyes: 'bird-eyes-01', ears: 'bug-ears-03', mouth: 'bird-mouth-01',
      horn: 'bird-horn-01', back: 'bird-back-01', tail: 'bird-tail-01',
    },
  },
  puffy: {
    id: 'puffy', class: 'aquatic', name: 'Puffy', kit: 3, awake: ['ears'],
    kitParts: {
      eyes: 'aquatic-eyes-01', ears: 'aquatic-ears-01', mouth: 'beast-mouth-03',
      horn: 'aquatic-horn-01', back: 'reptile-back-03', tail: 'aquatic-tail-01',
    },
  },
  buba: {
    id: 'buba', class: 'beast', name: 'Buba', kit: 1, awake: ['horn'],
    kitParts: {
      eyes: 'beast-eyes-03', ears: 'beast-ears-03', mouth: 'beast-mouth-01',
      horn: 'plant-horn-01', back: 'plant-back-03', tail: 'beast-tail-03',
    },
  },
  pomodoro: {
    id: 'pomodoro', class: 'bug', name: 'Pomodoro', kit: 17, awake: ['horn'],
    kitParts: {
      eyes: 'bird-eyes-03', ears: 'bug-ears-08', mouth: 'beast-mouth-07',
      horn: 'mech-horn-05', back: 'mech-back-03', tail: 'bug-tail-05',
    },
  },
  venoki: {
    id: 'venoki', class: 'reptile', name: 'Venoki', kit: 7, awake: ['horn'],
    kitParts: {
      eyes: 'reptile-eyes-01', ears: 'reptile-ears-01', mouth: 'reptile-mouth-01',
      horn: 'reptile-horn-01', back: 'plant-back-05', tail: 'bug-tail-01',
    },
  },
};

/** Los seis del mixer que se eligen, uno por clase. */
const MIXED = {
  beast: {
    id: 'beast',
    class: 'beast',
    name: 'Colmillo',
    color: 3,
    parts: {
      eyes: 'beast-04', ears: 'beast-06', mouth: 'beast-02',
      horn: 'beast-12', back: 'beast-04', tail: 'beast-10',
    },
  },
  aquatic: {
    id: 'aquatic',
    class: 'aquatic',
    name: 'Marea',
    color: 3,
    parts: {
      eyes: 'aquatic-08', ears: 'aquatic-04', mouth: 'aquatic-08',
      horn: 'aquatic-06', back: 'aquatic-02', tail: 'aquatic-12',
    },
  },
  bird: {
    id: 'bird',
    class: 'bird',
    name: 'Racha',
    color: 4,
    parts: {
      eyes: 'bird-10', ears: 'bird-02', mouth: 'bird-04',
      horn: 'bird-08', back: 'bird-06', tail: 'bird-04',
    },
  },
  plant: {
    id: 'plant',
    class: 'plant',
    name: 'Brote',
    color: 4,
    parts: {
      eyes: 'plant-02', ears: 'plant-10', mouth: 'plant-04',
      horn: 'plant-02', back: 'plant-12', tail: 'plant-06',
    },
  },
  bug: {
    id: 'bug',
    class: 'bug',
    name: 'Aguijón',
    color: 2,
    parts: {
      eyes: 'bug-02', ears: 'bug-12', mouth: 'bug-10',
      horn: 'bug-04', back: 'bug-08', tail: 'bug-02',
    },
  },
  reptile: {
    id: 'reptile',
    class: 'reptile',
    name: 'Escama',
    color: 3,
    parts: {
      eyes: 'reptile-08', ears: 'reptile-08', mouth: 'reptile-02',
      horn: 'reptile-10', back: 'reptile-06', tail: 'reptile-04',
    },
  },
};

/**
 * El roster: primero los starters —los héroes de Origins—, después los del mixer.
 * @type {Record<string, {id: string, class: string, name: string, parts?: object, color?: number, kit?: number}>}
 */
export const AXIES = { ...STARTERS, ...MIXED };

export const AXIE_IDS = Object.keys(AXIES);

/** Las seis partes, en el orden en que evoluciona un rival si no dice otro. */
export const PART_TYPES = ['horn', 'back', 'tail', 'mouth', 'ears', 'eyes'];

/**
 * Los rivales de la Aventura: Axies del mixer, uno por nivel (ver `adventure-levels.js`).
 *
 *   `parts`   las seis partes, como en el roster. Pueden ser de otra clase (un pájaro
 *             con ojos de reptil): mientras la parte no evoluciona solo cambia el
 *             dibujo; evolucionada, su carta suma el símbolo de la clase de la parte.
 *             Las de evento (`japan-02`, `summer-a`, `xmas-01`, `agamo-00`) y las
 *             místicas (`reptile-mystic-02`) cuentan como de la clase del que las
 *             lleva: `npm run axies` verifica que en la tabla del mixer sean de esa.
 *   `body`/`skin`  el cuerpo si no es el normal, y su paleta (`skin` 1 escarcha,
 *             2 verano, 3 pesadilla; ver `getAxieColorsVariant` en el mixer).
 *   `evolve`  en qué orden evolucionan sus partes (ver `evolvedOf` en `adventure.js`).
 *             Sin él, el de `PART_TYPES`.
 *   `charms`  las partes de un jefe que traen amuleto: su carta del mazo lleva el poder
 *             que estrena el nivel (ver `deckFor`).
 *
 * Un rival con partes evolucionadas es otro Axie para el resto del juego: su id lleva
 * cuántas (`'nevisca+2'`), y `axie()` lo arma. Así el dibujo —las partes evolucionadas
 * usan el arte `-lv2` del mixer—, el nombre y el mazo viajan juntos en `state.axies`.
 */
export const RIVALS = {
  // ---- Capítulo 1: la plaza y el valle de otoño ----
  retono: {
    id: 'retono', class: 'plant', name: 'Retoño', color: 1,
    parts: { eyes: 'plant-04', ears: 'plant-02', mouth: 'plant-02', horn: 'plant-06', back: 'plant-02', tail: 'plant-02' },
  },
  pichon: {
    id: 'pichon', class: 'bird', name: 'Pichón', color: 2,
    parts: { eyes: 'bird-08', ears: 'bird-04', mouth: 'bird-02', horn: 'bird-02', back: 'bird-02', tail: 'bird-02' },
  },
  zarpa: {
    id: 'zarpa', class: 'beast', name: 'Zarpa', color: 1,
    parts: { eyes: 'beast-02', ears: 'beast-02', mouth: 'beast-04', horn: 'beast-02', back: 'beast-02', tail: 'beast-02' },
  },
  polilla: {
    id: 'polilla', class: 'bug', name: 'Polilla', color: 3,
    parts: { eyes: 'bug-04', ears: 'bug-04', mouth: 'bug-02', horn: 'bug-02', back: 'bug-02', tail: 'bug-04' },
  },
  vibora: {
    id: 'vibora', class: 'reptile', name: 'Víbora', color: 2,
    parts: { eyes: 'reptile-02', ears: 'reptile-02', mouth: 'reptile-04', horn: 'reptile-02', back: 'reptile-02', tail: 'reptile-02' },
  },
  // Los cuatro que no estrenan poder: el rival es lo nuevo (ver `RIVAL_LADDER`).
  renacuajo: {
    id: 'renacuajo', class: 'aquatic', name: 'Renacuajo', color: 1,
    parts: { eyes: 'aquatic-08', ears: 'aquatic-04', mouth: 'aquatic-08', horn: 'aquatic-02', back: 'aquatic-02', tail: 'aquatic-08' },
  },
  bellota: {
    id: 'bellota', class: 'plant', name: 'Bellota', color: 2,
    parts: { eyes: 'plant-08', ears: 'plant-08', mouth: 'plant-04', horn: 'plant-04', back: 'plant-04', tail: 'plant-04' },
  },
  gorrion: {
    id: 'gorrion', class: 'bird', name: 'Gorrión', color: 1,
    parts: { eyes: 'bird-04', ears: 'bird-02', mouth: 'bird-04', horn: 'bird-06', back: 'bird-04', tail: 'bird-04' },
  },
  cachorro: {
    id: 'cachorro', class: 'beast', name: 'Cachorro', color: 3,
    parts: { eyes: 'beast-04', ears: 'beast-04', mouth: 'beast-02', horn: 'beast-04', back: 'beast-04', tail: 'beast-04' },
  },
  shogun: {
    id: 'shogun', class: 'aquatic', name: 'Shogun', color: 4, boss: true,
    parts: { eyes: 'japan-02', ears: 'aquatic-10', mouth: 'japan-01', horn: 'agamo-00', back: 'aquatic-10', tail: 'japan-02' },
    evolve: ['tail', 'horn', 'eyes', 'mouth', 'back', 'ears'],
    charms: ['tail'],
  },
  // ---- Capítulo 2: la playa y la bahía pirata ----
  gaviota: {
    id: 'gaviota', class: 'bird', name: 'Gaviota', color: 0,
    parts: { eyes: 'bird-02', ears: 'bird-06', mouth: 'bird-08', horn: 'bird-04', back: 'bird-10', tail: 'bird-06' },
  },
  burbuja: {
    id: 'burbuja', class: 'aquatic', name: 'Burbuja', color: 2,
    parts: { eyes: 'aquatic-04', ears: 'aquatic-02', mouth: 'aquatic-02', horn: 'aquatic-04', back: 'aquatic-04', tail: 'aquatic-04' },
  },
  musgo: {
    id: 'musgo', class: 'plant', name: 'Musgo', color: 3,
    parts: { eyes: 'plant-08', ears: 'plant-04', mouth: 'plant-08', horn: 'plant-08', back: 'plant-06', tail: 'plant-08' },
  },
  ermitano: {
    id: 'ermitano', class: 'bug', name: 'Ermitaño', color: 1,
    parts: { eyes: 'bug-08', ears: 'bug-06', mouth: 'bug-04', horn: 'bug-06', back: 'bug-06', tail: 'bug-08' },
  },
  tortuga: {
    id: 'tortuga', class: 'reptile', name: 'Tortuga', color: 4,
    parts: { eyes: 'reptile-10', ears: 'reptile-04', mouth: 'reptile-08', horn: 'reptile-04', back: 'reptile-04', tail: 'reptile-06' },
  },
  cangrejo: {
    id: 'cangrejo', class: 'bug', name: 'Cangrejo', color: 2,
    parts: { eyes: 'bug-08', ears: 'bug-10', mouth: 'bug-10', horn: 'bug-10', back: 'bug-08', tail: 'bug-06' },
  },
  pelicano: {
    id: 'pelicano', class: 'bird', name: 'Pelícano', color: 3,
    parts: { eyes: 'bird-10', ears: 'bird-12', mouth: 'bird-10', horn: 'bird-08', back: 'bird-12', tail: 'bird-10' },
  },
  calamar: {
    id: 'calamar', class: 'aquatic', name: 'Calamar', color: 3,
    parts: { eyes: 'aquatic-10', ears: 'aquatic-10', mouth: 'aquatic-10', horn: 'aquatic-12', back: 'aquatic-12', tail: 'aquatic-12' },
  },
  alga: {
    id: 'alga', class: 'plant', name: 'Alga', color: 0,
    parts: { eyes: 'plant-10', ears: 'plant-10', mouth: 'plant-08', horn: 'plant-10', back: 'plant-12', tail: 'plant-04' },
  },
  solazo: {
    id: 'solazo', class: 'beast', name: 'Solazo', color: 2, boss: true,
    body: 'body-summer', skin: 2,
    parts: { eyes: 'beast-08', ears: 'beast-12', mouth: 'beast-08', horn: 'beast-06', back: 'summer-tc', tail: 'summer-as' },
    evolve: ['back', 'tail', 'horn', 'ears', 'mouth', 'eyes'],
    charms: ['back', 'tail'],
  },
  // ---- Capítulo 3: el bosque nevado ----
  pino: {
    id: 'pino', class: 'plant', name: 'Pino', color: 0,
    parts: { eyes: 'plant-10', ears: 'plant-06', mouth: 'plant-10', horn: 'plant-12', back: 'plant-08', tail: 'plant-10' },
  },
  tempano: {
    id: 'tempano', class: 'aquatic', name: 'Témpano', color: 1,
    parts: { eyes: 'aquatic-10', ears: 'aquatic-06', mouth: 'aquatic-04', horn: 'aquatic-08', back: 'aquatic-06', tail: 'aquatic-06' },
  },
  ventisca: {
    id: 'ventisca', class: 'beast', name: 'Ventisca', color: 0,
    parts: { eyes: 'beast-10', ears: 'beast-08', mouth: 'beast-10', horn: 'beast-08', back: 'beast-06', tail: 'beast-06' },
  },
  escarcha: {
    id: 'escarcha', class: 'bug', name: 'Escarcha', color: 0,
    parts: { eyes: 'bug-10', ears: 'bug-08', mouth: 'bug-08', horn: 'bug-08', back: 'bug-10', tail: 'bug-10' },
  },
  carambano: {
    id: 'carambano', class: 'reptile', name: 'Carámbano', color: 1,
    parts: { eyes: 'reptile-10', ears: 'reptile-06', mouth: 'reptile-10', horn: 'reptile-06', back: 'reptile-08', tail: 'reptile-08' },
  },
  buho: {
    id: 'buho', class: 'bird', name: 'Búho', color: 4,
    parts: { eyes: 'bird-08', ears: 'bird-12', mouth: 'bird-04', horn: 'bird-12', back: 'bird-06', tail: 'bird-12' },
  },
  foca: {
    id: 'foca', class: 'aquatic', name: 'Foca', color: 0,
    parts: { eyes: 'aquatic-04', ears: 'aquatic-02', mouth: 'aquatic-02', horn: 'aquatic-06', back: 'aquatic-08', tail: 'aquatic-04' },
  },
  reno: {
    id: 'reno', class: 'beast', name: 'Reno', color: 4,
    parts: { eyes: 'beast-08', ears: 'beast-06', mouth: 'beast-04', horn: 'beast-12', back: 'beast-12', tail: 'beast-08' },
  },
  acebo: {
    id: 'acebo', class: 'plant', name: 'Acebo', color: 1,
    parts: { eyes: 'plant-02', ears: 'plant-02', mouth: 'plant-10', horn: 'plant-02', back: 'plant-06', tail: 'plant-06' },
  },
  nevisca: {
    id: 'nevisca', class: 'bird', name: 'Nevisca', color: 2, boss: true,
    body: 'body-frosty', skin: 1,
    parts: { eyes: 'xmas-02', ears: 'bird-08', mouth: 'bird-10', horn: 'xmas-01', back: 'bird-08', tail: 'bird-08' },
    evolve: ['horn', 'eyes', 'back', 'tail', 'mouth', 'ears'],
    charms: ['horn'],
  },
  // ---- Capítulo 4: la guarida. Desde acá los rivales evolucionan ----
  // Son híbridos: llevan partes de otras clases y esas evolucionan primero, así cada
  // evolución les suma un símbolo nuevo con el que encadenar. Las de su clase, que
  // alargan sus rachas de a dos, quedan para el final.
  cuervo: {
    id: 'cuervo', class: 'bird', name: 'Cuervo', color: 0,
    parts: { eyes: 'reptile-08', ears: 'bird-10', mouth: 'bird-08', horn: 'plant-06', back: 'bird-12', tail: 'bird-12' },
    evolve: ['eyes', 'horn', 'back', 'tail', 'mouth', 'ears'],
  },
  hiedra: {
    id: 'hiedra', class: 'plant', name: 'Hiedra', color: 2,
    parts: { eyes: 'plant-02', ears: 'plant-12', mouth: 'reptile-08', horn: 'bug-10', back: 'plant-10', tail: 'plant-12' },
    evolve: ['horn', 'mouth', 'back', 'tail', 'ears', 'eyes'],
  },
  abisal: {
    id: 'abisal', class: 'aquatic', name: 'Abisal', color: 0,
    parts: { eyes: 'aquatic-02', ears: 'aquatic-12', mouth: 'bird-08', horn: 'aquatic-10', back: 'reptile-12', tail: 'aquatic-10' },
    evolve: ['back', 'mouth', 'horn', 'tail', 'ears', 'eyes'],
  },
  lobo: {
    id: 'lobo', class: 'beast', name: 'Lobo', color: 4,
    parts: { eyes: 'bug-08', ears: 'beast-12', mouth: 'beast-08', horn: 'beast-10', back: 'beast-10', tail: 'bird-10' },
    evolve: ['tail', 'eyes', 'horn', 'back', 'mouth', 'ears'],
  },
  mamba: {
    id: 'mamba', class: 'reptile', name: 'Mamba', color: 0,
    parts: { eyes: 'reptile-10', ears: 'aquatic-06', mouth: 'reptile-04', horn: 'beast-08', back: 'reptile-12', tail: 'plant-04' },
    evolve: ['tail', 'ears', 'horn', 'back', 'mouth', 'eyes'],
  },
  arana: {
    id: 'arana', class: 'bug', name: 'Araña', color: 3,
    parts: { eyes: 'bug-10', ears: 'bug-12', mouth: 'bug-08', horn: 'reptile-12', back: 'beast-02', tail: 'bug-12' },
    evolve: ['horn', 'back', 'tail', 'ears', 'eyes', 'mouth'],
  },
  murcielago: {
    id: 'murcielago', class: 'bird', name: 'Murciélago', color: 4,
    parts: { eyes: 'bird-02', ears: 'beast-10', mouth: 'bird-08', horn: 'bird-10', back: 'bug-12', tail: 'bird-06' },
    evolve: ['ears', 'back', 'horn', 'tail', 'eyes', 'mouth'],
  },
  hongo: {
    id: 'hongo', class: 'plant', name: 'Hongo', color: 3,
    parts: { eyes: 'plant-04', ears: 'bug-04', mouth: 'plant-02', horn: 'plant-06', back: 'aquatic-04', tail: 'plant-08' },
    evolve: ['back', 'ears', 'horn', 'tail', 'eyes', 'mouth'],
  },
  anguila: {
    id: 'anguila', class: 'aquatic', name: 'Anguila', color: 4,
    parts: { eyes: 'aquatic-08', ears: 'aquatic-06', mouth: 'reptile-02', horn: 'aquatic-10', back: 'aquatic-08', tail: 'bird-04' },
    evolve: ['tail', 'mouth', 'horn', 'back', 'ears', 'eyes'],
  },
  umbra: {
    id: 'umbra', class: 'bug', name: 'Umbra', color: 4, boss: true,
    body: 'body-nightmare', skin: 3,
    parts: { eyes: 'bug-02', ears: 'aquatic-12', mouth: 'japan-03', horn: 'agamo-01', back: 'beast-10', tail: 'japan-01' },
    evolve: ['ears', 'back', 'horn', 'mouth', 'tail', 'eyes'],
    charms: ['horn', 'tail'],
  },
  // ---- Capítulo 5: el coliseo ----
  halcon: {
    id: 'halcon', class: 'bird', name: 'Halcón', color: 3,
    parts: { eyes: 'plant-10', ears: 'reptile-06', mouth: 'bird-10', horn: 'beast-04', back: 'bird-06', tail: 'aquatic-06' },
    evolve: ['horn', 'eyes', 'ears', 'tail', 'back', 'mouth'],
  },
  loto: {
    id: 'loto', class: 'plant', name: 'Loto', color: 1,
    parts: { eyes: 'plant-10', ears: 'aquatic-08', mouth: 'plant-10', horn: 'bug-06', back: 'beast-06', tail: 'bird-08' },
    evolve: ['ears', 'horn', 'tail', 'back', 'mouth', 'eyes'],
  },
  kraken: {
    id: 'kraken', class: 'aquatic', name: 'Kraken', color: 6,
    parts: { eyes: 'aquatic-08', ears: 'aquatic-08', mouth: 'bug-08', horn: 'reptile-02', back: 'bird-04', tail: 'plant-12' },
    evolve: ['mouth', 'horn', 'back', 'tail', 'ears', 'eyes'],
  },
  furia: {
    id: 'furia', class: 'beast', name: 'Furia', color: 6,
    parts: { eyes: 'aquatic-10', ears: 'beast-10', mouth: 'beast-04', horn: 'bird-06', back: 'bug-04', tail: 'reptile-10' },
    evolve: ['tail', 'horn', 'back', 'eyes', 'ears', 'mouth'],
  },
  mantis: {
    id: 'mantis', class: 'bug', name: 'Mantis', color: 2,
    parts: { eyes: 'plant-08', ears: 'reptile-10', mouth: 'bug-10', horn: 'beast-12', back: 'plant-12', tail: 'aquatic-12' },
    evolve: ['horn', 'back', 'tail', 'ears', 'eyes', 'mouth'],
  },
  escorpion: {
    id: 'escorpion', class: 'bug', name: 'Escorpión', color: 4,
    parts: { eyes: 'reptile-02', ears: 'bug-06', mouth: 'bug-04', horn: 'beast-06', back: 'bug-06', tail: 'reptile-04' },
    evolve: ['tail', 'horn', 'eyes', 'back', 'ears', 'mouth'],
  },
  cobra: {
    id: 'cobra', class: 'reptile', name: 'Cobra', color: 1,
    parts: { eyes: 'reptile-08', ears: 'plant-06', mouth: 'reptile-02', horn: 'reptile-08', back: 'aquatic-10', tail: 'bug-02' },
    evolve: ['back', 'ears', 'tail', 'horn', 'mouth', 'eyes'],
  },
  grifo: {
    id: 'grifo', class: 'bird', name: 'Grifo', color: 2,
    parts: { eyes: 'beast-10', ears: 'bird-04', mouth: 'bird-08', horn: 'beast-02', back: 'bird-08', tail: 'beast-10' },
    evolve: ['horn', 'tail', 'eyes', 'back', 'ears', 'mouth'],
  },
  cactus: {
    id: 'cactus', class: 'plant', name: 'Cactus', color: 4,
    parts: { eyes: 'plant-08', ears: 'reptile-08', mouth: 'plant-04', horn: 'bug-12', back: 'plant-08', tail: 'aquatic-02' },
    evolve: ['ears', 'horn', 'tail', 'back', 'mouth', 'eyes'],
  },
  basilisco: {
    id: 'basilisco', class: 'reptile', name: 'Basilisco', color: 3, boss: true,
    body: 'body-mystic-normal',
    parts: { eyes: 'bird-08', ears: 'beast-06', mouth: 'aquatic-10', horn: 'reptile-mystic-02', back: 'reptile-mystic-02', tail: 'reptile-mystic-02' },
    evolve: ['horn', 'back', 'tail', 'mouth', 'ears', 'eyes'],
    charms: ['horn', 'back', 'tail'],
  },
  // De acá en adelante los arma un generador sembrado (ver docs/aventura.md §8): partes de
  // otra clase que evolucionan primero y, a medida que avanza la campaña, más partes
  // coleccionables de su clase —místicas, de Japón, de Navidad, de verano y de Agamo— y
  // alguna Shiny en lo difícil. Los jefes van enteros de partes coleccionables.
  // ---- Capítulo 6: El Bosque de Otoño ----
  ciervo: {
    id: 'ciervo', class: 'beast', name: 'Ciervo', color: 0,
    parts: { eyes: 'bug-04', ears: 'beast-10', mouth: 'beast-02', horn: 'beast-12', back: 'beast-04', tail: 'plant-12' },
    evolve: ['tail', 'eyes', 'back', 'horn', 'mouth', 'ears'],
  },
  hojarasca: {
    id: 'hojarasca', class: 'plant', name: 'Hojarasca', color: 1,
    parts: { eyes: 'plant-10', ears: 'plant-02', mouth: 'plant-08', horn: 'bug-08', back: 'aquatic-10', tail: 'plant-04' },
    evolve: ['back', 'horn', 'mouth', 'tail', 'ears', 'eyes'],
  },
  escarabajo: {
    id: 'escarabajo', class: 'bug', name: 'Escarabajo', color: 4,
    parts: { eyes: 'bug-04', ears: 'plant-08', mouth: 'bug-08', horn: 'bug-12', back: 'beast-04', tail: 'bug-08' },
    evolve: ['back', 'ears', 'tail', 'eyes', 'horn', 'mouth'],
  },
  lechuza: {
    id: 'lechuza', class: 'bird', name: 'Lechuza', color: 1,
    parts: { eyes: 'bird-02', ears: 'bird-02', mouth: 'reptile-04', horn: 'bird-10', back: 'bird-04', tail: 'plant-12' },
    evolve: ['mouth', 'tail', 'horn', 'eyes', 'ears', 'back'],
  },
  rana: {
    id: 'rana', class: 'aquatic', name: 'Rana', color: 2,
    parts: { eyes: 'plant-02', ears: 'beast-04', mouth: 'aquatic-02', horn: 'aquatic-02', back: 'reptile-10', tail: 'aquatic-08' },
    evolve: ['back', 'eyes', 'ears', 'mouth', 'horn', 'tail'],
  },
  salamandra: {
    id: 'salamandra', class: 'reptile', name: 'Salamandra', color: 0,
    parts: { eyes: 'reptile-10', ears: 'reptile-10', mouth: 'plant-04', horn: 'reptile-10', back: 'plant-06', tail: 'reptile-12' },
    evolve: ['mouth', 'back', 'horn', 'eyes', 'ears', 'tail'],
  },
  jabali: {
    id: 'jabali', class: 'beast', name: 'Jabalí', color: 1,
    parts: { eyes: 'plant-02', ears: 'beast-08', mouth: 'beast-08', horn: 'beast-02', back: 'plant-08', tail: 'bug-10' },
    evolve: ['eyes', 'back', 'tail', 'ears', 'mouth', 'horn'],
  },
  luciernaga: {
    id: 'luciernaga', class: 'bug', name: 'Luciérnaga', color: 1,
    parts: { eyes: 'bug-10', ears: 'beast-10', mouth: 'bug-04', horn: 'aquatic-04', back: 'bug-08', tail: 'bug-06' },
    evolve: ['horn', 'ears', 'tail', 'eyes', 'back', 'mouth'],
  },
  petirrojo: {
    id: 'petirrojo', class: 'bird', name: 'Petirrojo', color: 2,
    parts: { eyes: 'plant-02', ears: 'beast-12', mouth: 'bird-10', horn: 'bird-10', back: 'bird-12', tail: 'bird-02' },
    evolve: ['eyes', 'ears', 'back', 'tail', 'mouth', 'horn'],
  },
  kodama: {
    id: 'kodama', class: 'plant', name: 'Kodama', color: 2, boss: true,
    parts: { eyes: 'plant-10', ears: 'japan-01', mouth: 'plant-02', horn: 'japan-01', back: 'japan-03', tail: 'plant-06' },
    evolve: ['horn', 'back', 'ears', 'tail', 'mouth', 'eyes'],
    charms: ['horn', 'back'],
  },
  // ---- Capítulo 7: La Jungla ----
  tucan: {
    id: 'tucan', class: 'bird', name: 'Tucán', color: 4,
    parts: { eyes: 'bug-02', ears: 'bird-mystic-02', mouth: 'bird-10', horn: 'beast-04', back: 'bird-08', tail: 'aquatic-04' },
    evolve: ['horn', 'eyes', 'tail', 'back', 'mouth', 'ears'],
  },
  orquidea: {
    id: 'orquidea', class: 'plant', name: 'Orquídea', color: 4,
    parts: { eyes: 'reptile-10', ears: 'reptile-04', mouth: 'xmas-01', horn: 'bug-10', back: 'plant-02', tail: 'plant-10' },
    evolve: ['eyes', 'ears', 'horn', 'back', 'tail', 'mouth'],
  },
  jaguar: {
    id: 'jaguar', class: 'beast', name: 'Jaguar', color: 2,
    parts: { eyes: 'bird-02', ears: 'beast-mystic-02', mouth: 'beast-04', horn: 'beast-06', back: 'bird-08', tail: 'beast-12' },
    evolve: ['back', 'eyes', 'horn', 'mouth', 'tail', 'ears'],
  },
  pirana: {
    id: 'pirana', class: 'aquatic', name: 'Piraña', color: 1,
    parts: { eyes: 'aquatic-02', ears: 'plant-02', mouth: 'aquatic-08', horn: 'bug-04', back: 'aquatic-mystic-02', tail: 'aquatic-06' },
    evolve: ['horn', 'ears', 'eyes', 'tail', 'mouth', 'back'],
  },
  camaleon: {
    id: 'camaleon', class: 'reptile', name: 'Camaleón', color: 0,
    parts: { eyes: 'bird-08', ears: 'reptile-10', mouth: 'aquatic-08', horn: 'summer-a', back: 'reptile-04', tail: 'beast-04' },
    evolve: ['tail', 'mouth', 'eyes', 'ears', 'back', 'horn'],
  },
  hormiga: {
    id: 'hormiga', class: 'bug', name: 'Hormiga', color: 0,
    parts: { eyes: 'bug-08', ears: 'plant-06', mouth: 'japan-03', horn: 'aquatic-04', back: 'bug-10', tail: 'bird-06' },
    evolve: ['tail', 'horn', 'ears', 'back', 'eyes', 'mouth'],
  },
  liana: {
    id: 'liana', class: 'plant', name: 'Liana', color: 4,
    parts: { eyes: 'plant-mystic-02', ears: 'plant-06', mouth: 'plant-08', horn: 'reptile-08', back: 'beast-04', tail: 'reptile-06' },
    evolve: ['back', 'horn', 'tail', 'mouth', 'ears', 'eyes'],
  },
  guacamayo: {
    id: 'guacamayo', class: 'bird', name: 'Guacamayo', color: 4,
    parts: { eyes: 'bird-02', ears: 'bird-08', mouth: 'bird-10', horn: 'plant-06', back: 'japan-01', tail: 'plant-08' },
    evolve: ['tail', 'horn', 'ears', 'eyes', 'mouth', 'back'],
  },
  tapir: {
    id: 'tapir', class: 'beast', name: 'Tapir', color: 2,
    parts: { eyes: 'beast-08', ears: 'bird-06', mouth: 'reptile-02', horn: 'beast-08', back: 'beast-12', tail: 'summer-a' },
    evolve: ['mouth', 'ears', 'back', 'eyes', 'horn', 'tail'],
  },
  mantodea: {
    id: 'mantodea', class: 'bug', name: 'Mantodea', color: 1, boss: true,
    parts: { eyes: 'bug-mystic-02', ears: 'japan-03', mouth: 'japan-03', horn: 'agamo-01', back: 'bug-12', tail: 'japan-01' },
    evolve: ['back', 'horn', 'mouth', 'ears', 'tail', 'eyes'],
    charms: ['horn', 'mouth'],
  },
  // ---- Capítulo 8: La Laguna ----
  garza: {
    id: 'garza', class: 'bird', name: 'Garza', color: 1,
    parts: { eyes: 'bird-10', ears: 'aquatic-08', mouth: 'bug-04', horn: 'bird-12', back: 'beast-08', tail: 'japan-03' },
    evolve: ['mouth', 'back', 'ears', 'eyes', 'horn', 'tail'],
  },
  nutria: {
    id: 'nutria', class: 'beast', name: 'Nutria', color: 3,
    parts: { eyes: 'xmas-01', ears: 'aquatic-08', mouth: 'beast-10', horn: 'beast-06', back: 'beast-08', tail: 'bug-04' },
    evolve: ['tail', 'ears', 'horn', 'back', 'mouth', 'eyes'],
  },
  libelula: {
    id: 'libelula', class: 'bug', name: 'Libélula', color: 4,
    parts: { eyes: 'bug-08', ears: 'bug-mystic-02', mouth: 'aquatic-08', horn: 'reptile-10', back: 'bird-10', tail: 'bug-12' },
    evolve: ['mouth', 'back', 'horn', 'tail', 'eyes', 'ears'],
  },
  junco: {
    id: 'junco', class: 'plant', name: 'Junco', color: 0,
    parts: { eyes: 'plant-mystic-02', ears: 'bug-04', mouth: 'reptile-08', horn: 'aquatic-10', back: 'plant-08', tail: 'plant-06' },
    evolve: ['ears', 'mouth', 'horn', 'tail', 'back', 'eyes'],
  },
  galapago: {
    id: 'galapago', class: 'reptile', name: 'Galápago', color: 1,
    parts: { eyes: 'reptile-10', ears: 'reptile-02', mouth: 'xmas-02', horn: 'plant-10', back: 'reptile-08', tail: 'aquatic-08' },
    evolve: ['horn', 'tail', 'eyes', 'back', 'ears', 'mouth'],
  },
  carpa: {
    id: 'carpa', class: 'aquatic', name: 'Carpa', color: 1,
    parts: { eyes: 'plant-04', ears: 'aquatic-mystic-02', mouth: 'aquatic-02', horn: 'aquatic-12', back: 'beast-04', tail: 'aquatic-02' },
    evolve: ['back', 'eyes', 'mouth', 'tail', 'horn', 'ears'],
  },
  sapo: {
    id: 'sapo', class: 'aquatic', name: 'Sapo', color: 4,
    parts: { eyes: 'reptile-02', ears: 'aquatic-mystic-02', mouth: 'aquatic-08', horn: 'reptile-06', back: 'aquatic-10', tail: 'aquatic-08' },
    evolve: ['horn', 'eyes', 'back', 'mouth', 'tail', 'ears'],
  },
  mosquito: {
    id: 'mosquito', class: 'bug', name: 'Mosquito', color: 2,
    parts: { eyes: 'bug-mystic-02', ears: 'bug-04', mouth: 'bug-08', horn: 'bird-06', back: 'bug-08', tail: 'bird-06' },
    evolve: ['tail', 'horn', 'mouth', 'back', 'ears', 'eyes'],
  },
  martin: {
    id: 'martin', class: 'bird', name: 'Martín', color: 1,
    parts: { eyes: 'bird-04', ears: 'bird-10', mouth: 'bug-10', horn: 'xmas-01', back: 'reptile-10', tail: 'bird-04' },
    evolve: ['mouth', 'back', 'tail', 'ears', 'eyes', 'horn'],
  },
  nenufar: {
    id: 'nenufar', class: 'aquatic', name: 'Nenúfar', color: 3, boss: true,
    body: 'body-mystic-normal',
    parts: { eyes: 'japan-02', ears: 'aquatic-mystic-02', mouth: 'japan-01', horn: 'agamo-00', back: 'aquatic-mystic-02', tail: 'japan-02' },
    evolve: ['horn', 'tail', 'eyes', 'mouth', 'back', 'ears'],
    charms: ['horn', 'tail'],
  },
  // ---- Capítulo 9: La Isla del Verano ----
  delfin: {
    id: 'delfin', class: 'aquatic', name: 'Delfín', color: 3,
    parts: { eyes: 'japan-02', ears: 'bird-08', mouth: 'aquatic-10', horn: 'aquatic-06', back: 'aquatic-08', tail: 'bird-08' },
    evolve: ['tail', 'ears', 'horn', 'mouth', 'back', 'eyes'],
  },
  coco: {
    id: 'coco', class: 'plant', name: 'Coco', color: 1,
    parts: { eyes: 'plant-10', ears: 'bug-08', mouth: 'xmas-01', horn: 'plant-12', back: 'aquatic-08', tail: 'plant-02' },
    evolve: ['back', 'ears', 'tail', 'horn', 'eyes', 'mouth'],
  },
  lagartija: {
    id: 'lagartija', class: 'reptile', name: 'Lagartija', color: 4,
    parts: { eyes: 'reptile-10', ears: 'aquatic-06', mouth: 'reptile-02', horn: 'summer-tc', back: 'bird-08', tail: 'aquatic-04' },
    evolve: ['ears', 'back', 'tail', 'mouth', 'eyes', 'horn'],
  },
  albatros: {
    id: 'albatros', class: 'bird', name: 'Albatros', color: 4,
    parts: { eyes: 'bird-04', ears: 'aquatic-02', mouth: 'bird-08', horn: 'bug-04', back: 'bug-10', tail: 'bird-mystic-02' },
    evolve: ['back', 'horn', 'ears', 'eyes', 'mouth', 'tail'],
  },
  mono: {
    id: 'mono', class: 'beast', name: 'Mono', color: 0,
    parts: { eyes: 'reptile-08', ears: 'beast-02', mouth: 'aquatic-10', horn: 'japan-03', back: 'beast-12', tail: 'bug-04' },
    evolve: ['mouth', 'tail', 'eyes', 'back', 'ears', 'horn'],
  },
  medusa: {
    id: 'medusa', class: 'aquatic', name: 'Medusa', color: 0,
    parts: { eyes: 'reptile-02', ears: 'aquatic-mystic-02', mouth: 'aquatic-04', horn: 'aquatic-12', back: 'plant-12', tail: 'plant-02' },
    evolve: ['eyes', 'back', 'tail', 'mouth', 'horn', 'ears'],
  },
  hibisco: {
    id: 'hibisco', class: 'plant', name: 'Hibisco', color: 1,
    parts: { eyes: 'plant-mystic-02', ears: 'plant-06', mouth: 'reptile-04', horn: 'plant-12', back: 'plant-06', tail: 'reptile-06' },
    evolve: ['mouth', 'tail', 'horn', 'ears', 'back', 'eyes'],
  },
  avispa: {
    id: 'avispa', class: 'bug', name: 'Avispa', color: 1,
    parts: { eyes: 'reptile-10', ears: 'bug-08', mouth: 'reptile-08', horn: 'bird-12', back: 'xmas-01', tail: 'bug-12' },
    evolve: ['horn', 'mouth', 'eyes', 'tail', 'ears', 'back'],
  },
  iguana: {
    id: 'iguana', class: 'reptile', name: 'Iguana', color: 0,
    parts: { eyes: 'bird-10', ears: 'reptile-08', mouth: 'reptile-10', horn: 'reptile-mystic-02', back: 'reptile-04', tail: 'beast-08' },
    evolve: ['eyes', 'tail', 'mouth', 'ears', 'back', 'horn'],
  },
  verano: {
    id: 'verano', class: 'beast', name: 'Verano', color: 2, boss: true,
    body: 'body-summer', skin: 2,
    parts: { eyes: 'beast-08', ears: 'beast-10', mouth: 'beast-10', horn: 'japan-02', back: 'summer-a', tail: 'summer-a' },
    evolve: ['back', 'tail', 'ears', 'horn', 'mouth', 'eyes'],
    charms: ['back'],
  },
  // ---- Capítulo 10: La Meseta ----
  leon: {
    id: 'leon', class: 'beast', name: 'León', color: 0,
    parts: { eyes: 'xmas-01', ears: 'beast-04', mouth: 'bird-08', horn: 'plant-10', back: 'summer-a', tail: 'beast-12' },
    evolve: ['horn', 'mouth', 'ears', 'tail', 'back', 'eyes'],
  },
  buitre: {
    id: 'buitre', class: 'bird', name: 'Buitre', color: 0,
    parts: { eyes: 'reptile-02', ears: 'bird-mystic-02', mouth: 'aquatic-02', horn: 'xmas-01', back: 'bird-02', tail: 'bird-12' },
    evolve: ['eyes', 'mouth', 'back', 'tail', 'ears', 'horn'],
  },
  suricata: {
    id: 'suricata', class: 'beast', name: 'Suricata', color: 4,
    parts: { eyes: 'beast-mystic-02', ears: 'beast-12', mouth: 'beast-mystic-02', horn: 'bird-08', back: 'beast-08', tail: 'bird-08' },
    evolve: ['horn', 'tail', 'ears', 'back', 'eyes', 'mouth'],
  },
  baobab: {
    id: 'baobab', class: 'plant', name: 'Baobab', color: 0,
    parts: { eyes: 'plant-mystic-02', ears: 'plant-mystic-02', mouth: 'aquatic-08', horn: 'reptile-02', back: 'plant-08', tail: 'bird-10' },
    evolve: ['horn', 'tail', 'mouth', 'back', 'eyes', 'ears'],
  },
  termita: {
    id: 'termita', class: 'bug', name: 'Termita', color: 4,
    parts: { eyes: 'beast-10', ears: 'bug-04', mouth: 'bug-mystic-02', horn: 'bug-mystic-02', back: 'plant-08', tail: 'plant-10' },
    evolve: ['back', 'tail', 'eyes', 'ears', 'horn', 'mouth'],
  },
  avestruz: {
    id: 'avestruz', class: 'bird', name: 'Avestruz', color: 2,
    parts: { eyes: 'bird-10', ears: 'bird-08', mouth: 'bug-08', horn: 'bird-mystic-02', back: 'plant-06', tail: 'japan-03' },
    evolve: ['mouth', 'back', 'eyes', 'ears', 'tail', 'horn'],
  },
  gacela: {
    id: 'gacela', class: 'beast', name: 'Gacela', color: 0,
    parts: { eyes: 'xmas-01', ears: 'beast-04', mouth: 'bug-10', horn: 'japan-03', back: 'beast-10', tail: 'bird-08' },
    evolve: ['tail', 'mouth', 'back', 'ears', 'eyes', 'horn'],
  },
  cocodrilo: {
    id: 'cocodrilo', class: 'reptile', name: 'Cocodrilo', color: 3,
    parts: { eyes: 'aquatic-02', ears: 'reptile-mystic-02', mouth: 'beast-04', horn: 'reptile-02', back: 'beast-10', tail: 'reptile-mystic-02' },
    evolve: ['back', 'eyes', 'mouth', 'horn', 'tail', 'ears'],
  },
  hipopotamo: {
    id: 'hipopotamo', class: 'aquatic', name: 'Hipopótamo', color: 2,
    parts: { eyes: 'bug-10', ears: 'beast-04', mouth: 'beast-08', horn: 'aquatic-02', back: 'aquatic-mystic-02', tail: 'japan-02' },
    evolve: ['eyes', 'ears', 'mouth', 'horn', 'back', 'tail'],
  },
  sauria: {
    id: 'sauria', class: 'reptile', name: 'Sauria', color: 1, boss: true,
    body: 'body-summer', skin: 2,
    parts: { eyes: 'japan-03', ears: 'reptile-mystic-02', mouth: 'japan-02', horn: 'summer-tc', back: 'summer-ta', tail: 'xmas-02' },
    evolve: ['horn', 'back', 'tail', 'mouth', 'eyes', 'ears'],
    charms: ['horn', 'back'],
  },
  // ---- Capítulo 11: El Cañón Rojo ----
  coyote: {
    id: 'coyote', class: 'beast', name: 'Coyote', color: 1,
    parts: { eyes: 'reptile-08', ears: 'xmas-01', mouth: 'beast-08', horn: 'bird-10', back: 'aquatic-04', tail: 'summer-a' },
    evolve: ['horn', 'eyes', 'back', 'mouth', 'tail', 'ears'],
  },
  correcaminos: {
    id: 'correcaminos', class: 'bird', name: 'Correcaminos', color: 4,
    parts: { eyes: 'aquatic-02', ears: 'japan-02', mouth: 'bird-08', horn: 'reptile-06', back: 'bird-mystic-02', tail: 'plant-02' },
    evolve: ['eyes', 'horn', 'tail', 'mouth', 'ears', 'back'],
  },
  ciempies: {
    id: 'ciempies', class: 'bug', name: 'Ciempiés', color: 0,
    parts: { eyes: 'bug-mystic-02', ears: 'reptile-06', mouth: 'japan-03', horn: 'bug-06', back: 'beast-12', tail: 'bug-10' },
    evolve: ['back', 'ears', 'tail', 'horn', 'mouth', 'eyes'],
  },
  cardo: {
    id: 'cardo', class: 'plant', name: 'Cardo', color: 3,
    parts: { eyes: 'bird-10', ears: 'aquatic-04', mouth: 'plant-mystic-02', horn: 'plant-06', back: 'bug-04', tail: 'plant-mystic-02' },
    evolve: ['eyes', 'ears', 'back', 'horn', 'tail', 'mouth'],
  },
  gila: {
    id: 'gila', class: 'reptile', name: 'Gila', color: 4,
    parts: { eyes: 'bug-08', ears: 'reptile-mystic-02', mouth: 'japan-02', horn: 'plant-12', back: 'beast-10', tail: 'reptile-06' },
    evolve: ['eyes', 'horn', 'back', 'tail', 'mouth', 'ears'],
  },
  ajolote: {
    id: 'ajolote', class: 'aquatic', name: 'Ajolote', color: 3,
    parts: { eyes: 'bird-02', ears: 'aquatic-mystic-02', mouth: 'bug-10', horn: 'aquatic-mystic-02', back: 'reptile-04', tail: 'aquatic-04' },
    evolve: ['back', 'mouth', 'eyes', 'tail', 'horn', 'ears'],
  },
  puma: {
    id: 'puma', class: 'beast', name: 'Puma', color: 4,
    parts: { eyes: 'beast-08', ears: 'bird-04', mouth: 'beast-mystic-02', horn: 'beast-06', back: 'reptile-08', tail: 'summer-a' },
    evolve: ['ears', 'back', 'eyes', 'horn', 'tail', 'mouth'],
  },
  alacran: {
    id: 'alacran', class: 'bug', name: 'Alacrán', color: 4,
    parts: { eyes: 'bug-02', ears: 'reptile-04', mouth: 'bug-mystic-02', horn: 'beast-08', back: 'xmas-01', tail: 'bug-12' },
    evolve: ['horn', 'ears', 'tail', 'eyes', 'back', 'mouth'],
  },
  cernicalo: {
    id: 'cernicalo', class: 'bird', name: 'Cernícalo', color: 2,
    parts: { eyes: 'xmas-02', ears: 'bird-06', mouth: 'bird-04', horn: 'plant-02', back: 'japan-01', tail: 'aquatic-12' },
    evolve: ['horn', 'tail', 'mouth', 'ears', 'eyes', 'back'],
  },
  carmin: {
    id: 'carmin', class: 'bird', name: 'Carmín', color: 0, boss: true,
    body: 'body-mystic-normal',
    parts: { eyes: 'xmas-02', ears: 'japan-02', mouth: 'bird-mystic-02', horn: 'xmas-01', back: 'japan-01', tail: 'japan-03' },
    evolve: ['back', 'horn', 'tail', 'ears', 'eyes', 'mouth'],
    charms: ['back', 'horn'],
  },
  // ---- Capítulo 12: El Cielo ----
  colibri: {
    id: 'colibri', class: 'bird', name: 'Colibrí', color: 0,
    parts: { eyes: 'bird-10', ears: 'reptile-04', mouth: 'bird-mystic-02', horn: 'bird-mystic-02', back: 'plant-02', tail: 'bug-12' },
    evolve: ['tail', 'ears', 'back', 'eyes', 'horn', 'mouth'],
  },
  algodon: {
    id: 'algodon', class: 'plant', name: 'Algodón', color: 3,
    parts: { eyes: 'plant-mystic-02', ears: 'reptile-06', mouth: 'aquatic-10', horn: 'plant-08', back: 'plant-02', tail: 'plant-mystic-02' },
    evolve: ['mouth', 'ears', 'back', 'horn', 'eyes', 'tail'],
  },
  mariposa: {
    id: 'mariposa', class: 'bug', name: 'Mariposa', color: 1,
    parts: { eyes: 'bug-10', ears: 'japan-03', mouth: 'plant-10', horn: 'agamo-01', back: 'bird-06', tail: 'aquatic-02' },
    evolve: ['mouth', 'tail', 'back', 'eyes', 'horn', 'ears'],
  },
  potrillo: {
    id: 'potrillo', class: 'beast', name: 'Potrillo', color: 3,
    parts: { eyes: 'xmas-01', ears: 'beast-10', mouth: 'reptile-04', horn: 'bug-02', back: 'summer-a', tail: 'bug-02' },
    evolve: ['tail', 'mouth', 'horn', 'ears', 'eyes', 'back'],
  },
  nimbo: {
    id: 'nimbo', class: 'aquatic', name: 'Nimbo', color: 3,
    parts: { eyes: 'japan-02', ears: 'plant-02', mouth: 'plant-10', horn: 'bird-06', back: 'aquatic-mystic-02', tail: 'aquatic-08' },
    evolve: ['ears', 'horn', 'mouth', 'tail', 'eyes', 'back'],
  },
  cometa: {
    id: 'cometa', class: 'bird', name: 'Cometa', color: 2,
    parts: { eyes: 'xmas-02', ears: 'bird-04', mouth: 'bird-mystic-02', horn: 'bird-08', back: 'beast-04', tail: 'reptile-04' },
    evolve: ['tail', 'back', 'horn', 'ears', 'mouth', 'eyes'],
  },
  dragoncito: {
    id: 'dragoncito', class: 'reptile', name: 'Dragoncito', color: 2,
    parts: { eyes: 'plant-10', ears: 'plant-08', mouth: 'reptile-04', horn: 'summer-a', back: 'xmas-02', tail: 'reptile-04' },
    evolve: ['eyes', 'ears', 'mouth', 'tail', 'horn', 'back'],
  },
  abeja: {
    id: 'abeja', class: 'bug', name: 'Abeja', color: 1,
    parts: { eyes: 'bug-mystic-02', ears: 'bug-10', mouth: 'japan-03', horn: 'bird-10', back: 'bird-12', tail: 'bird-08' },
    evolve: ['back', 'horn', 'tail', 'ears', 'mouth', 'eyes'],
  },
  brisa: {
    id: 'brisa', class: 'plant', name: 'Brisa', color: 2,
    parts: { eyes: 'plant-02', ears: 'japan-01', mouth: 'bird-04', horn: 'plant-02', back: 'bug-12', tail: 'plant-mystic-02' },
    evolve: ['back', 'mouth', 'horn', 'eyes', 'ears', 'tail'],
  },
  celeste: {
    id: 'celeste', class: 'plant', name: 'Celeste', color: 3, boss: true,
    body: 'body-mystic-normal',
    parts: { eyes: 'plant-mystic-02', ears: 'xmas-02', mouth: 'xmas-01', horn: 'xmas-02', back: 'japan-03', tail: 'plant-mystic-02' },
    evolve: ['horn', 'back', 'ears', 'mouth', 'tail', 'eyes'],
    charms: ['horn', 'back'],
  },
  // ---- Capítulo 13: La Caverna ----
  topo: {
    id: 'topo', class: 'beast', name: 'Topo', color: 4,
    parts: { eyes: 'beast-mystic-02', ears: 'beast-mystic-02', mouth: 'plant-10', horn: 'reptile-10', back: 'beast-04', tail: 'aquatic-04' },
    evolve: ['tail', 'mouth', 'horn', 'back', 'ears', 'eyes'],
  },
  gusano: {
    id: 'gusano', class: 'bug', name: 'Gusano', color: 2,
    parts: { eyes: 'bug-02', ears: 'japan-03', mouth: 'beast-04', horn: 'bug-mystic-02', back: 'plant-02', tail: 'plant-08' },
    evolve: ['tail', 'back', 'mouth', 'eyes', 'horn', 'ears'],
  },
  cristalino: {
    id: 'cristalino', class: 'aquatic', name: 'Cristalino', color: 2,
    parts: { eyes: 'japan-02', ears: 'beast-08', mouth: 'aquatic-mystic-02', horn: 'aquatic-02', back: 'plant-02', tail: 'plant-08' },
    evolve: ['tail', 'back', 'ears', 'horn', 'mouth', 'eyes'],
  },
  trufa: {
    id: 'trufa', class: 'plant', name: 'Trufa', color: 2,
    parts: { eyes: 'aquatic-08', ears: 'bird-04', mouth: 'xmas-01', horn: 'plant-mystic-02', back: 'beast-08', tail: 'plant-04' },
    evolve: ['eyes', 'back', 'ears', 'tail', 'horn', 'mouth'],
  },
  geco: {
    id: 'geco', class: 'reptile', name: 'Geco', color: 3,
    parts: { eyes: 'aquatic-02', ears: 'beast-04', mouth: 'reptile-mystic-02', horn: 'summer-a', back: 'reptile-02', tail: 'reptile-06' },
    evolve: ['eyes', 'ears', 'back', 'tail', 'horn', 'mouth'],
  },
  tarantula: {
    id: 'tarantula', class: 'bug', name: 'Tarántula', color: 3,
    parts: { eyes: 'aquatic-10', ears: 'aquatic-04', mouth: 'japan-03', horn: 'plant-10', back: 'bug-mystic-02', tail: 'bug-04' },
    evolve: ['eyes', 'ears', 'horn', 'tail', 'mouth', 'back'],
  },
  oso: {
    id: 'oso', class: 'beast', name: 'Oso', color: 3,
    parts: { eyes: 'beast-mystic-02', ears: 'xmas-01', mouth: 'beast-04', horn: 'plant-04', back: 'reptile-08', tail: 'beast-04' },
    evolve: ['horn', 'back', 'mouth', 'tail', 'ears', 'eyes'],
  },
  liquen: {
    id: 'liquen', class: 'plant', name: 'Liquen', color: 1,
    parts: { eyes: 'plant-04', ears: 'plant-mystic-02', mouth: 'aquatic-04', horn: 'plant-02', back: 'japan-03', tail: 'aquatic-08' },
    evolve: ['tail', 'mouth', 'eyes', 'horn', 'back', 'ears'],
  },
  vencejo: {
    id: 'vencejo', class: 'bird', name: 'Vencejo', color: 1,
    parts: { eyes: 'bird-04', ears: 'aquatic-12', mouth: 'reptile-02', horn: 'reptile-12', back: 'japan-01', tail: 'japan-03' },
    evolve: ['horn', 'mouth', 'ears', 'eyes', 'back', 'tail'],
  },
  oculo: {
    id: 'oculo', class: 'bug', name: 'Óculo', color: 4, boss: true,
    body: 'body-nightmare', skin: 3,
    parts: { eyes: 'bug-mystic-02', ears: 'japan-03', mouth: 'japan-03', horn: 'agamo-01', back: 'xmas-01', tail: 'japan-01' },
    evolve: ['horn', 'tail', 'back', 'mouth', 'ears', 'eyes'],
    charms: ['horn', 'tail', 'back'],
  },
  // ---- Capítulo 14: El Desierto ----
  camello: {
    id: 'camello', class: 'beast', name: 'Camello', color: 3,
    parts: { eyes: 'reptile-08', ears: 'xmas-01', mouth: 'beast-mystic-02', horn: 'reptile-10', back: 'japan-02', tail: 'beast-04' },
    evolve: ['eyes', 'horn', 'tail', 'back', 'mouth', 'ears'],
  },
  gavilan: {
    id: 'gavilan', class: 'bird', name: 'Gavilán', color: 4,
    parts: { eyes: 'bird-02', ears: 'beast-10', mouth: 'bird-mystic-02', horn: 'xmas-01', back: 'beast-10', tail: 'japan-03' },
    evolve: ['ears', 'back', 'eyes', 'tail', 'mouth', 'horn'],
  },
  escarabeo: {
    id: 'escarabeo', class: 'bug', name: 'Escarabeo', color: 3,
    parts: { eyes: 'bug-mystic-02', ears: 'aquatic-04', mouth: 'reptile-08', horn: 'bug-mystic-02', back: 'xmas-01', tail: 'bug-08' },
    evolve: ['ears', 'mouth', 'tail', 'back', 'horn', 'eyes'],
  },
  saguaro: {
    id: 'saguaro', class: 'plant', name: 'Saguaro', color: 3,
    parts: { eyes: 'plant-mystic-02', ears: 'bird-04', mouth: 'bird-10', horn: 'japan-01', back: 'plant-mystic-02', tail: 'plant-12' },
    evolve: ['mouth', 'ears', 'tail', 'eyes', 'back', 'horn'],
  },
  cascabel: {
    id: 'cascabel', class: 'reptile', name: 'Cascabel', color: 3,
    parts: { eyes: 'japan-01', ears: 'bird-08', mouth: 'reptile-02', horn: 'summer-as', back: 'xmas-02', tail: 'bird-02' },
    evolve: ['ears', 'tail', 'mouth', 'horn', 'back', 'eyes'],
  },
  fenec: {
    id: 'fenec', class: 'beast', name: 'Fénec', color: 0,
    parts: { eyes: 'beast-mystic-02', ears: 'reptile-08', mouth: 'beast-08', horn: 'japan-03', back: 'bird-12', tail: 'summer-as' },
    evolve: ['back', 'ears', 'mouth', 'eyes', 'horn', 'tail'],
  },
  espejismo: {
    id: 'espejismo', class: 'aquatic', name: 'Espejismo', color: 2,
    parts: { eyes: 'bug-04', ears: 'bird-06', mouth: 'aquatic-08', horn: 'aquatic-mystic-02', back: 'aquatic-mystic-02', tail: 'aquatic-mystic-02' },
    evolve: ['eyes', 'ears', 'mouth', 'back', 'tail', 'horn'],
  },
  chapulin: {
    id: 'chapulin', class: 'bug', name: 'Chapulín', color: 2,
    parts: { eyes: 'bug-mystic-02', ears: 'bug-12', mouth: 'japan-03', horn: 'agamo-01', back: 'bird-04', tail: 'bird-06' },
    evolve: ['tail', 'back', 'ears', 'horn', 'mouth', 'eyes'],
  },
  agave: {
    id: 'agave', class: 'plant', name: 'Agave', color: 3,
    parts: { eyes: 'plant-mystic-02', ears: 'japan-01', mouth: 'bug-04', horn: 'beast-02', back: 'plant-mystic-02', tail: 'plant-06' },
    evolve: ['mouth', 'horn', 'tail', 'ears', 'eyes', 'back'],
  },
  faraon: {
    id: 'faraon', class: 'reptile', name: 'Faraón', color: 2, boss: true,
    body: 'body-summer', skin: 2,
    parts: { eyes: 'japan-01', ears: 'reptile-mystic-02', mouth: 'xmas-02', horn: 'summer-ta', back: 'agamo-00', tail: 'xmas-01' },
    evolve: ['horn', 'back', 'tail', 'eyes', 'mouth', 'ears'],
    charms: ['horn', 'back', 'tail'],
  },
  // ---- Capítulo 15: El Ocaso ----
  magma: {
    id: 'magma', class: 'reptile', name: 'Magma', color: 3,
    parts: { eyes: 'aquatic-10', ears: 'reptile-mystic-02', mouth: 'reptile-04', horn: 'summer-as', back: 'xmas-02', tail: 'bug-10' },
    evolve: ['tail', 'eyes', 'mouth', 'horn', 'ears', 'back'],
  },
  fenix: {
    id: 'fenix', class: 'bird', name: 'Fénix', color: 3,
    parts: { eyes: 'bug-10', ears: 'japan-02', mouth: 'bird-mystic-02', horn: 'reptile-08', back: 'bird-02', tail: 'bird-mystic-02' },
    evolve: ['eyes', 'horn', 'back', 'tail', 'ears', 'mouth'],
  },
  brasa: {
    id: 'brasa', class: 'bug', name: 'Brasa', color: 0,
    parts: { eyes: 'bug-08', ears: 'bug-mystic-02', mouth: 'aquatic-08', horn: 'aquatic-08', back: 'xmas-01', tail: 'bug-mystic-02' },
    evolve: ['mouth', 'horn', 'eyes', 'tail', 'back', 'ears'],
  },
  ceniza: {
    id: 'ceniza', class: 'plant', name: 'Ceniza', color: 4,
    parts: { eyes: 'plant-mystic-02', ears: 'beast-12', mouth: 'beast-08', horn: 'xmas-02', back: 'plant-02', tail: 'plant-mystic-02' },
    evolve: ['ears', 'mouth', 'back', 'horn', 'eyes', 'tail'],
  },
  tejon: {
    id: 'tejon', class: 'beast', name: 'Tejón', color: 2,
    parts: { eyes: 'xmas-01', ears: 'bug-12', mouth: 'aquatic-02', horn: 'japan-02', back: 'japan-02', tail: 'beast-06' },
    evolve: ['ears', 'mouth', 'tail', 'eyes', 'back', 'horn'],
  },
  vapor: {
    id: 'vapor', class: 'aquatic', name: 'Vapor', color: 3,
    parts: { eyes: 'reptile-10', ears: 'aquatic-04', mouth: 'summer-as', horn: 'agamo-00', back: 'reptile-12', tail: 'aquatic-mystic-02' },
    evolve: ['eyes', 'back', 'ears', 'mouth', 'horn', 'tail'],
  },
  obsidiana: {
    id: 'obsidiana', class: 'reptile', name: 'Obsidiana', color: 2,
    parts: { eyes: 'beast-08', ears: 'reptile-04', mouth: 'japan-02', horn: 'bug-08', back: 'agamo-00', tail: 'xmas-02' },
    evolve: ['eyes', 'horn', 'ears', 'mouth', 'back', 'tail'],
  },
  mirlo: {
    id: 'mirlo', class: 'bird', name: 'Mirlo', color: 4,
    parts: { eyes: 'bird-02', ears: 'japan-02', mouth: 'bird-mystic-02', horn: 'aquatic-08', back: 'bird-mystic-02', tail: 'plant-10' },
    evolve: ['tail', 'horn', 'eyes', 'ears', 'mouth', 'back'],
  },
  espina: {
    id: 'espina', class: 'plant', name: 'Espina', color: 0,
    parts: { eyes: 'plant-08', ears: 'plant-mystic-02', mouth: 'bug-04', horn: 'plant-mystic-02', back: 'bug-04', tail: 'plant-mystic-02' },
    evolve: ['back', 'mouth', 'eyes', 'ears', 'tail', 'horn'],
  },
  behemot: {
    id: 'behemot', class: 'beast', name: 'Behemot', color: 4, boss: true,
    body: 'body-nightmare', skin: 3,
    parts: { eyes: 'xmas-01', ears: 'xmas-01', mouth: 'beast-mystic-02', horn: 'japan-03', back: 'japan-02', tail: 'summer-as' },
    evolve: ['back', 'horn', 'tail', 'eyes', 'ears', 'mouth'],
    charms: ['back', 'horn'],
  },
  // ---- Capítulo 16: El Bosque Nocturno ----
  zorro: {
    id: 'zorro', class: 'beast', name: 'Zorro', color: 0,
    parts: { eyes: 'bird-02', ears: 'beast-06', mouth: 'beast-mystic-02', horn: 'plant-04', back: 'summer-a', tail: 'summer-as' },
    evolve: ['eyes', 'horn', 'ears', 'mouth', 'tail', 'back'],
  },
  mochuelo: {
    id: 'mochuelo', class: 'bird', name: 'Mochuelo', color: 3,
    parts: { eyes: 'aquatic-08', ears: 'japan-02', mouth: 'bird-04', horn: 'xmas-01', back: 'bird-mystic-02', tail: 'bug-12' },
    evolve: ['tail', 'eyes', 'mouth', 'horn', 'back', 'ears'],
  },
  esfinge: {
    id: 'esfinge', class: 'bug', name: 'Esfinge', color: 1,
    parts: { eyes: 'bug-mystic-02', ears: 'bird-04', mouth: 'reptile-10', horn: 'bug-mystic-02', back: 'bug-mystic-02', tail: 'bug-02' },
    evolve: ['ears', 'mouth', 'tail', 'horn', 'back', 'eyes'],
  },
  belladona: {
    id: 'belladona', class: 'plant', name: 'Belladona', color: 2,
    parts: { eyes: 'plant-mystic-02', ears: 'plant-mystic-02', mouth: 'bug-10', horn: 'plant-04', back: 'reptile-02', tail: 'plant-mystic-02' },
    evolve: ['back', 'mouth', 'horn', 'tail', 'eyes', 'ears'],
  },
  triton: {
    id: 'triton', class: 'aquatic', name: 'Tritón', color: 3,
    parts: { eyes: 'bug-02', ears: 'aquatic-04', mouth: 'japan-01', horn: 'aquatic-mystic-02', back: 'aquatic-mystic-02', tail: 'bug-10' },
    evolve: ['eyes', 'tail', 'ears', 'horn', 'back', 'mouth'],
  },
  boa: {
    id: 'boa', class: 'reptile', name: 'Boa', color: 0,
    parts: { eyes: 'reptile-mystic-02', ears: 'reptile-04', mouth: 'plant-10', horn: 'summer-tc', back: 'bird-06', tail: 'reptile-mystic-02' },
    evolve: ['back', 'mouth', 'ears', 'eyes', 'tail', 'horn'],
  },
  lince: {
    id: 'lince', class: 'beast', name: 'Lince', color: 0,
    parts: { eyes: 'xmas-01', ears: 'xmas-01', mouth: 'bird-10', horn: 'beast-12', back: 'reptile-04', tail: 'summer-a' },
    evolve: ['back', 'mouth', 'horn', 'ears', 'eyes', 'tail'],
  },
  cocuyo: {
    id: 'cocuyo', class: 'bug', name: 'Cocuyo', color: 4,
    parts: { eyes: 'bug-mystic-02', ears: 'bug-08', mouth: 'bug-mystic-02', horn: 'reptile-08', back: 'xmas-01', tail: 'reptile-10' },
    evolve: ['horn', 'tail', 'ears', 'back', 'mouth', 'eyes'],
  },
  mandragora: {
    id: 'mandragora', class: 'plant', name: 'Mandrágora', color: 2,
    parts: { eyes: 'plant-mystic-02', ears: 'beast-10', mouth: 'beast-08', horn: 'plant-mystic-02', back: 'japan-03', tail: 'plant-08' },
    evolve: ['mouth', 'ears', 'tail', 'horn', 'eyes', 'back'],
  },
  leviatan: {
    id: 'leviatan', class: 'aquatic', name: 'Leviatán', color: 3, boss: true,
    body: 'body-mystic-normal',
    parts: { eyes: 'japan-02', ears: 'aquatic-mystic-02', mouth: 'summer-as', horn: 'agamo-00', back: 'aquatic-mystic-02', tail: 'japan-02' },
    evolve: ['horn', 'tail', 'back', 'mouth', 'eyes', 'ears'],
    charms: ['horn', 'tail'],
  },
  // ---- Capítulo 17: El Salón de Invierno ----
  polar: {
    id: 'polar', class: 'beast', name: 'Polar', color: 4,
    parts: { eyes: 'reptile-02', ears: 'xmas-01', mouth: 'beast-mystic-02', horn: 'beast-mystic-02', back: 'bug-08', tail: 'summer-as' },
    evolve: ['back', 'eyes', 'mouth', 'horn', 'ears', 'tail'],
  },
  pinguino: {
    id: 'pinguino', class: 'bird', name: 'Pingüino', color: 0,
    parts: { eyes: 'xmas-02', ears: 'japan-02', mouth: 'bird-mystic-02', horn: 'bird-mystic-02', back: 'beast-08', tail: 'reptile-02' },
    evolve: ['back', 'tail', 'ears', 'eyes', 'mouth', 'horn'],
  },
  muerdago: {
    id: 'muerdago', class: 'plant', name: 'Muérdago', color: 2,
    parts: { eyes: 'reptile-08', ears: 'plant-mystic-02', mouth: 'plant-mystic-02', horn: 'plant-mystic-02', back: 'japan-03', tail: 'beast-06' },
    evolve: ['eyes', 'tail', 'mouth', 'horn', 'ears', 'back'],
  },
  morsa: {
    id: 'morsa', class: 'aquatic', name: 'Morsa', color: 2,
    parts: { eyes: 'aquatic-mystic-02', ears: 'beast-04', mouth: 'aquatic-mystic-02', horn: 'reptile-08', back: 'aquatic-mystic-02', tail: 'japan-02' },
    evolve: ['horn', 'ears', 'mouth', 'back', 'eyes', 'tail'],
  },
  cochinilla: {
    id: 'cochinilla', class: 'bug', name: 'Cochinilla', color: 2,
    parts: { eyes: 'beast-02', ears: 'bug-mystic-02', mouth: 'bird-08', horn: 'bug-mystic-02', back: 'xmas-01', tail: 'bug-mystic-02' },
    evolve: ['mouth', 'eyes', 'ears', 'horn', 'tail', 'back'],
  },
  escarcho: {
    id: 'escarcho', class: 'reptile', name: 'Escarcho', color: 4,
    parts: { eyes: 'japan-01', ears: 'beast-12', mouth: 'reptile-mystic-02', horn: 'summer-a', back: 'summer-as', tail: 'plant-06' },
    evolve: ['tail', 'ears', 'back', 'mouth', 'eyes', 'horn'],
  },
  alce: {
    id: 'alce', class: 'beast', name: 'Alce', color: 1,
    parts: { eyes: 'bug-02', ears: 'xmas-01', mouth: 'beast-mystic-02', horn: 'beast-mystic-02', back: 'summer-a', tail: 'reptile-12' },
    evolve: ['tail', 'eyes', 'horn', 'mouth', 'ears', 'back'],
  },
  abeto: {
    id: 'abeto', class: 'plant', name: 'Abeto', color: 4,
    parts: { eyes: 'beast-04', ears: 'reptile-02', mouth: 'xmas-01', horn: 'plant-mystic-02', back: 'japan-03', tail: 'plant-mystic-02' },
    evolve: ['ears', 'eyes', 'horn', 'tail', 'back', 'mouth'],
  },
  cardenal: {
    id: 'cardenal', class: 'bird', name: 'Cardenal', color: 4,
    parts: { eyes: 'xmas-02', ears: 'bird-mystic-02', mouth: 'aquatic-04', horn: 'aquatic-06', back: 'bird-mystic-02', tail: 'bird-mystic-02' },
    evolve: ['horn', 'mouth', 'eyes', 'back', 'ears', 'tail'],
  },
  estrella: {
    id: 'estrella', class: 'bird', name: 'Estrella', color: 2, boss: true,
    body: 'body-frosty', skin: 1,
    parts: { eyes: 'xmas-02', ears: 'japan-02', mouth: 'bird-mystic-02', horn: 'xmas-01', back: 'japan-01', tail: 'japan-03' },
    evolve: ['horn', 'eyes', 'back', 'tail', 'ears', 'mouth'],
    charms: ['horn', 'eyes'],
  },
  // ---- Capítulo 18: Los Engranajes ----
  tuerca: {
    id: 'tuerca', class: 'bug', name: 'Tuerca', color: 1,
    parts: { eyes: 'bug-mystic-02', ears: 'bug-mystic-02', mouth: 'aquatic-04', horn: 'agamo-01', back: 'bug-mystic-02', tail: 'bird-04' },
    evolve: ['tail', 'mouth', 'back', 'eyes', 'ears', 'horn'],
  },
  resorte: {
    id: 'resorte', class: 'beast', name: 'Resorte', color: 2,
    parts: { eyes: 'aquatic-02', ears: 'beast-mystic-02', mouth: 'aquatic-08', horn: 'beast-mystic-02', back: 'summer-tc', tail: 'beast-mystic-02' },
    evolve: ['eyes', 'mouth', 'back', 'horn', 'ears', 'tail'],
  },
  veleta: {
    id: 'veleta', class: 'bird', name: 'Veleta', color: 4,
    parts: { eyes: 'bird-mystic-02', ears: 'bird-mystic-02', mouth: 'bird-mystic-02', horn: 'bird-mystic-02', back: 'bug-12', tail: 'plant-04' },
    evolve: ['tail', 'back', 'mouth', 'eyes', 'ears', 'horn'],
  },
  bonsai: {
    id: 'bonsai', class: 'plant', name: 'Bonsái', color: 0,
    parts: { eyes: 'plant-mystic-02', ears: 'aquatic-10', mouth: 'beast-04', horn: 'japan-01', back: 'plant-mystic-02', tail: 'plant-mystic-02' },
    evolve: ['ears', 'mouth', 'horn', 'eyes', 'tail', 'back'],
  },
  escafandra: {
    id: 'escafandra', class: 'aquatic', name: 'Escafandra', color: 2,
    parts: { eyes: 'japan-02', ears: 'aquatic-mystic-02', mouth: 'beast-04', horn: 'bug-10', back: 'aquatic-mystic-02', tail: 'aquatic-mystic-02' },
    evolve: ['horn', 'mouth', 'back', 'ears', 'tail', 'eyes'],
  },
  tornillo: {
    id: 'tornillo', class: 'reptile', name: 'Tornillo', color: 4,
    parts: { eyes: 'japan-03', ears: 'bug-02', mouth: 'bug-04', horn: 'summer-as', back: 'agamo-00', tail: 'reptile-mystic-02' },
    evolve: ['ears', 'mouth', 'horn', 'tail', 'back', 'eyes'],
  },
  piston: {
    id: 'piston', class: 'beast', name: 'Pistón', color: 4,
    parts: { eyes: 'beast-mystic-02', ears: 'reptile-04', mouth: 'beast-mystic-02', horn: 'japan-02', back: 'summer-tc', tail: 'reptile-08' },
    evolve: ['tail', 'ears', 'eyes', 'horn', 'mouth', 'back'],
  },
  cigarra: {
    id: 'cigarra', class: 'bug', name: 'Cigarra', color: 0,
    parts: { eyes: 'bug-mystic-02', ears: 'japan-03', mouth: 'beast-02', horn: 'agamo-01', back: 'xmas-01', tail: 'reptile-12' },
    evolve: ['tail', 'mouth', 'horn', 'back', 'ears', 'eyes'],
  },
  cuco: {
    id: 'cuco', class: 'bird', name: 'Cuco', color: 2,
    parts: { eyes: 'xmas-02', ears: 'bird-mystic-02', mouth: 'aquatic-10', horn: 'xmas-01', back: 'bird-mystic-02', tail: 'bug-10' },
    evolve: ['tail', 'mouth', 'ears', 'back', 'horn', 'eyes'],
  },
  automata: {
    id: 'automata', class: 'bug', name: 'Autómata', color: 0, boss: true,
    body: 'body-mystic-normal',
    parts: { eyes: 'bug-mystic-02', ears: 'japan-03', mouth: 'japan-03', horn: 'agamo-01', back: 'xmas-01', tail: 'japan-01' },
    evolve: ['horn', 'back', 'tail', 'mouth', 'ears', 'eyes'],
    charms: ['horn', 'back', 'tail'],
  },
  // ---- Capítulo 19: El Mar Violeta ----
  manta: {
    id: 'manta', class: 'aquatic', name: 'Manta', color: 1,
    parts: { eyes: 'aquatic-mystic-02', ears: 'aquatic-mystic-02', mouth: 'summer-as', horn: 'beast-04', back: 'aquatic-mystic-02', tail: 'plant-08' },
    evolve: ['horn', 'tail', 'mouth', 'back', 'ears', 'eyes'],
  },
  coral: {
    id: 'coral', class: 'plant', name: 'Coral', color: 2,
    parts: { eyes: 'plant-mystic-02', ears: 'xmas-02', mouth: 'plant-mystic-02', horn: 'bird-10', back: 'bug-06', tail: 'plant-mystic-02' },
    evolve: ['back', 'horn', 'tail', 'mouth', 'ears', 'eyes'],
  },
  caracola: {
    id: 'caracola', class: 'bug', name: 'Caracola', color: 0,
    parts: { eyes: 'bug-mystic-02', ears: 'japan-03', mouth: 'japan-03', horn: 'agamo-01', back: 'aquatic-10', tail: 'plant-02' },
    evolve: ['tail', 'back', 'horn', 'mouth', 'ears', 'eyes'],
  },
  pulpo: {
    id: 'pulpo', class: 'aquatic', name: 'Pulpo', color: 1,
    parts: { eyes: 'japan-02', ears: 'aquatic-mystic-02', mouth: 'japan-01', horn: 'bug-04', back: 'aquatic-mystic-02', tail: 'bug-02' },
    evolve: ['tail', 'horn', 'back', 'eyes', 'ears', 'mouth'],
  },
  morena: {
    id: 'morena', class: 'reptile', name: 'Morena', color: 1,
    parts: { eyes: 'japan-01', ears: 'reptile-mystic-02', mouth: 'aquatic-08', horn: 'summer-as', back: 'summer-ta', tail: 'plant-12' },
    evolve: ['mouth', 'tail', 'ears', 'horn', 'eyes', 'back'],
  },
  gaviotin: {
    id: 'gaviotin', class: 'bird', name: 'Gaviotín', color: 4,
    parts: { eyes: 'bird-mystic-02', ears: 'beast-10', mouth: 'bird-mystic-02', horn: 'reptile-08', back: 'bird-mystic-02', tail: 'japan-03' },
    evolve: ['ears', 'horn', 'mouth', 'back', 'tail', 'eyes'],
  },
  lobomarino: {
    id: 'lobomarino', class: 'beast', name: 'Lobo Marino', color: 0,
    parts: { eyes: 'beast-mystic-02', ears: 'bug-08', mouth: 'beast-mystic-02', horn: 'japan-02', back: 'aquatic-10', tail: 'summer-as' },
    evolve: ['ears', 'back', 'horn', 'eyes', 'mouth', 'tail'],
  },
  anemona: {
    id: 'anemona', class: 'plant', name: 'Anémona', color: 3,
    parts: { eyes: 'plant-mystic-02', ears: 'japan-01', mouth: 'plant-mystic-02', horn: 'beast-02', back: 'plant-mystic-02', tail: 'reptile-08' },
    evolve: ['tail', 'horn', 'eyes', 'mouth', 'back', 'ears'],
  },
  ostra: {
    id: 'ostra', class: 'bug', name: 'Ostra', color: 4,
    parts: { eyes: 'bug-mystic-02', ears: 'bug-mystic-02', mouth: 'aquatic-04', horn: 'agamo-01', back: 'xmas-01', tail: 'plant-12' },
    evolve: ['tail', 'mouth', 'horn', 'eyes', 'back', 'ears'],
  },
  nacar: {
    id: 'nacar', class: 'plant', name: 'Nácar', color: 1, boss: true,
    body: 'body-mystic-normal',
    parts: { eyes: 'plant-mystic-02', ears: 'xmas-02', mouth: 'xmas-01', horn: 'japan-01', back: 'japan-03', tail: 'plant-mystic-02' },
    evolve: ['horn', 'back', 'tail', 'ears', 'mouth', 'eyes'],
    charms: ['horn', 'back', 'tail'],
  },
  // ---- Capítulo 20: El Amanecer ----
  alba: {
    id: 'alba', class: 'bird', name: 'Alba', color: 0,
    parts: { eyes: 'plant-02', ears: 'japan-02', mouth: 'aquatic-02', horn: 'bird-mystic-02', back: 'japan-01', tail: 'bird-mystic-02' },
    evolve: ['eyes', 'mouth', 'back', 'tail', 'horn', 'ears'],
  },
  rocio: {
    id: 'rocio', class: 'plant', name: 'Rocío', color: 3,
    parts: { eyes: 'plant-mystic-02', ears: 'reptile-08', mouth: 'plant-mystic-02', horn: 'bug-08', back: 'japan-03', tail: 'plant-mystic-02' },
    evolve: ['ears', 'horn', 'mouth', 'tail', 'eyes', 'back'],
  },
  centella: {
    id: 'centella', class: 'beast', name: 'Centella', color: 0,
    parts: { eyes: 'bird-04', ears: 'beast-mystic-02', mouth: 'beast-mystic-02', horn: 'japan-02', back: 'plant-02', tail: 'summer-as' },
    evolve: ['back', 'eyes', 'mouth', 'tail', 'ears', 'horn'],
  },
  lucero: {
    id: 'lucero', class: 'bug', name: 'Lucero', color: 0,
    parts: { eyes: 'bug-mystic-02', ears: 'japan-03', mouth: 'bird-08', horn: 'agamo-01', back: 'xmas-01', tail: 'reptile-04' },
    evolve: ['tail', 'mouth', 'horn', 'eyes', 'back', 'ears'],
  },
  horizonte: {
    id: 'horizonte', class: 'aquatic', name: 'Horizonte', color: 4,
    parts: { eyes: 'bird-08', ears: 'aquatic-mystic-02', mouth: 'summer-as', horn: 'aquatic-mystic-02', back: 'plant-12', tail: 'aquatic-mystic-02' },
    evolve: ['back', 'eyes', 'mouth', 'tail', 'horn', 'ears'],
  },
  quimera: {
    id: 'quimera', class: 'reptile', name: 'Quimera', color: 4,
    parts: { eyes: 'reptile-mystic-02', ears: 'reptile-mystic-02', mouth: 'reptile-mystic-02', horn: 'summer-as', back: 'plant-04', tail: 'bird-04' },
    evolve: ['tail', 'back', 'eyes', 'horn', 'mouth', 'ears'],
  },
  paladin: {
    id: 'paladin', class: 'beast', name: 'Paladín', color: 4,
    parts: { eyes: 'plant-08', ears: 'xmas-01', mouth: 'bug-08', horn: 'japan-03', back: 'japan-02', tail: 'summer-as' },
    evolve: ['mouth', 'eyes', 'tail', 'ears', 'back', 'horn'],
  },
  serafin: {
    id: 'serafin', class: 'bird', name: 'Serafín', color: 3,
    parts: { eyes: 'aquatic-08', ears: 'bird-mystic-02', mouth: 'bird-mystic-02', horn: 'aquatic-10', back: 'bird-mystic-02', tail: 'japan-03' },
    evolve: ['eyes', 'horn', 'tail', 'mouth', 'ears', 'back'],
  },
  guardian: {
    id: 'guardian', class: 'plant', name: 'Guardián', color: 3,
    parts: { eyes: 'plant-mystic-02', ears: 'plant-mystic-02', mouth: 'beast-08', horn: 'reptile-04', back: 'plant-mystic-02', tail: 'plant-mystic-02' },
    evolve: ['horn', 'mouth', 'tail', 'ears', 'eyes', 'back'],
  },
  aurora: {
    id: 'aurora', class: 'reptile', name: 'Aurora', color: 3, boss: true,
    body: 'body-mystic-normal',
    parts: { eyes: 'japan-01', ears: 'reptile-mystic-02', mouth: 'japan-02', horn: 'summer-as', back: 'summer-as', tail: 'xmas-02' },
    evolve: ['horn', 'back', 'tail', 'mouth', 'eyes', 'ears'],
    charms: ['horn', 'back', 'tail'],
  },
};

/**
 * La clase de una parte para la evolución: la que dice su nombre (`bird-10`,
 * `reptile-mystic-02`), o la del que la lleva si es de evento (`japan-02`).
 */
export const partClass = (key, owner) => {
  const prefix = String(key).split('-')[0];
  return SYMBOLS[prefix] ? prefix : owner;
};

/** Las partes evolucionadas de un rival con `n` evoluciones, en su orden. */
export const evolvedOf = (rival, n) => (rival.evolve ?? PART_TYPES).slice(0, Math.max(0, n));

/** El id de un rival con `n` partes evolucionadas: `'nevisca'`, `'nevisca+2'`. */
export const rivalId = (id, n = 0) => (n > 0 ? `${id}+${n}` : id);

/**
 * Las partes evolucionadas que valen: de las seis, sin repetir y en el orden de
 * `PART_TYPES`. Lo que no es una parte se descarta: la lista llega del almacenamiento
 * y, en una sala, del aparato del otro.
 */
export function cleanEvolved(list) {
  if (!Array.isArray(list)) return [];
  return PART_TYPES.filter((part) => list.includes(part));
}

/**
 * El id de un Axie del roster con sus partes evolucionadas (ver `evolution.js`):
 * `'buba'` sin ninguna, `'buba~horn.eyes'` con dos. Como el `'lobo+2'` de los rivales,
 * el id lleva todo lo que lo hace distinto, así la partida, el dibujo y el mazo salen
 * de él solos: el que lo reciba no tiene que saber que hay evoluciones.
 */
export function evolvedId(id, evolved = []) {
  const base = String(id).split('~')[0];
  const parts = cleanEvolved(evolved);
  return parts.length ? `${base}~${parts.join('.')}` : base;
}

/**
 * El Axie de un id —del roster, del roster evolucionado (`'buba~horn'`), un rival, o un
 * rival evolucionado (`'lobo+2'`)—, o el primero del roster si el id no existe. Los
 * evolucionados son un objeto nuevo con su id completo, el del que salen (`base`) y la
 * lista de partes evolucionadas (`evolved`).
 */
export function axie(id) {
  if (AXIES[id]) return AXIES[id];
  if (RIVALS[id]) return RIVALS[id];
  const [rosterId, evo] = String(id).split('~');
  if (evo !== undefined && AXIES[rosterId]) {
    const evolved = cleanEvolved(evo.split('.'));
    return evolved.length
      ? { ...AXIES[rosterId], id: evolvedId(rosterId, evolved), base: rosterId, evolved }
      : AXIES[rosterId];
  }
  const [base, n] = String(id).split('+');
  const rival = RIVALS[base];
  const count = Number(n);
  if (rival && Number.isInteger(count) && count > 0 && count <= PART_TYPES.length) {
    return { ...rival, id: rivalId(base, count), base, evolved: evolvedOf(rival, count) };
  }
  return AXIES[AXIE_IDS[0]];
}

/**
 * El mazo con el que arranca un Axie: 8 cartas según la taxonomía canónica y Axie Core.
 * Si se pasa `nftState`, tiene prioridad para mutaciones de Part Evolution.
 *
 * `boosts` son las mejoras elegidas en la pantalla de elección —un símbolo de más en
 * algunas cartas— y van de la clave de la carta al símbolo que se le suma (ver
 * `buildPersonalDeck`). Sin ellas es el mazo pelado de siempre.
 *
 * Un Axie evolucionado —un rival (`'lobo+2'`) o uno tuyo (`'buba~horn'`)— trae sus
 * partes evolucionadas: la carta de cada una suma el símbolo de la clase de **esa
 * parte** (ver `baseDeck`). Los starters no tienen partes del mixer pero sí las del kit
 * (`kitParts`), que dicen de qué clase es cada una. Y `charm` es el poder que llevan
 * las cartas de las partes con amuleto de un jefe (`charms`): uno para todas, o uno por
 * parte (`{ horn: 'poison', tail: 'viper' }`, ver `adventureCharms`).
 */
export function deckFor(id, boosts = {}, nftState = null, { charm = null } = {}) {
  const a = axie(id);
  const parts = a.parts ?? a.kitParts;
  const own = parts
    ? {
        id: a.id,
        baseClass: a.class,
        parts: Object.fromEntries(Object.entries(parts).map(([type, key]) => [type, {
          class: partClass(key, a.class),
          isEvolved: Boolean(a.evolved?.includes(type)),
        }])),
      }
    : a.class;
  const deck = buildPersonalDeck(toAxieNFTState(nftState ?? own), boosts);
  if (!charm || !a.charms?.length) return deck;
  const powerOf = (part) => (typeof charm === 'string' ? charm : charm[part] ?? null);
  return deck.map((card) => (a.charms.includes(card.associatedPart) && powerOf(card.associatedPart)
    ? makeCard(card.symbols, powerOf(card.associatedPart), {
        id: card.id, isFavorable: card.isFavorable, associatedPart: card.associatedPart,
      })
    : card));
}

const pc = (n) => `${(n * 100).toFixed(3)}%`;

/**
 * La URL de una capa. Las del mixer están en el CDN; las de los starters viajan con el
 * juego en `Axies/`, y en el build de un solo archivo son data URI (`AXIE_URLS`).
 */
const layerUrl = (src) =>
  src.startsWith('Axies/') ? (globalThis.AXIE_URLS?.[src] ?? src) : AVATAR_BASE + src;

/**
 * De qué parte del bicho es una capa, sacado de la ruta del PNG: `.../tail.png` es
 * la cola, `body-normal/leg-front-left/...` una pata. El nombre que sale de acá es el
 * mismo que usa el esqueleto del kit, y es por donde `axie-motion.js` engancha las
 * animaciones horneadas con las capas dibujadas.
 *
 * El prefijo `body-normal/` se saca antes de buscar: empieza con "body" y se comería
 * a las patas, que viven abajo de él.
 */
const PARTS =
  /(leg-front-left|leg-front-right|leg-back-left|leg-back-right|body|tail|ear-left|ear-right|back|horn|eyes|mouth)/;

const partOf = (src) => src.replace('body-normal/', '').match(PARTS)?.[1] ?? 'body';

/**
 * Con qué se dibuja un Axie: `art` es su pila (`ratio` y capas) y `pose`, la entrada de
 * `axie-poses.js` que la anima.
 *
 * Uno del roster con alguna parte evolucionada **que cambie de dibujo** va con la pila
 * evolucionada (`EVOLVED`), encendida parte por parte: la de siempre o la `lv2`. Su
 * pose es `<id>@evo`, que mide el cuerpo en ese marco. Un starter evolucionado en otra
 * parte que no es la que despierta se ve igual que siempre, y va con su entrada de
 * siempre: el marco evolucionado lo achicaría sin que nada cambie.
 */
function lookOf(a) {
  if (AVATARS[a.id]) return { art: AVATARS[a.id], pose: a.id };
  const evo = a.base ? EVOLVED[a.base] : null;
  if (!evo?.layers.some((l) => l.lv2 && a.evolved.includes(l.part))) {
    return { art: AVATARS[a.base ?? a.id], pose: a.base ?? a.id };
  }
  const layers = evo.layers.filter((l) => !l.part || a.evolved.includes(l.part) === Boolean(l.lv2));
  return { art: { ratio: evo.ratio, layers }, pose: `${a.base}@evo` };
}

/** Una capa: el PNG del CDN puesto en porcentajes del marco del dibujo. */
function layerImg(src, slot, att, box, alt) {
  return `<img src="${layerUrl(src)}" alt=""${alt ? ' class="axie-alt"' : ' loading="lazy"'}
    data-part="${slot}" data-att="${att}"
    onerror="this.closest('.axie').dataset.broken='true'"
    style="left:${pc(box.x)};top:${pc(box.y)};width:${pc(box.w)};height:${pc(box.h)}">`;
}

/**
 * El Axie dibujado: una pila de <img> posicionados en porcentajes, así el tamaño lo
 * pone el contenedor y el mismo HTML sirve para el tablero y para el selector. Si el
 * CDN no responde, `onerror` marca el bloque y el CSS muestra el crest de la clase.
 *
 * Son cuatro cajas anidadas y no una sola porque las cuatro se mueven a la vez, y un
 * elemento tiene un solo `transform`:
 *   `.axie`      el bicho entero yendo a algún lado: el salto al ataque, el sacudón
 *                del golpe.
 *   `.axie-rig`  la postura que pone el juego: agacharse a cargar, desplomarse.
 *   `.axie-body` el espejo. Los Axies vienen mirando a la izquierda, y el de la
 *                izquierda de la mesa tiene que darse vuelta para enfrentar al otro.
 *   `.axie-pose` lo que hace el cuerpo en la animación del kit. Va adentro del espejo
 *                para que una animación de girar a la derecha sea, del lado de la
 *                izquierda, girar a la izquierda: los dos actúan hacia su rival.
 * Adentro va una capa por parte, y detrás de cada una sus dibujos alternativos —los
 * ojos cerrados, la boca abierta, la pata estirada—, apagados hasta que un clip los
 * encienda. Ver `axie-motion.js`.
 *
 * Los alternativos van pegados a su capa base a propósito: el orden del HTML es el
 * orden en que se apilan, así que la boca abierta queda exactamente donde estaba la
 * boca cerrada y no adelante del cuerno.
 *
 * `alts` los apaga: en el selector los seis Axies están quietos y no los va a usar
 * nadie, y son doce PNG más por bicho para pedirle al CDN.
 */
export function axieArt(id, { alts = true } = {}) {
  const a = axie(id);
  const { art, pose } = lookOf(a);
  const style = `--c:${SYMBOLS[a.class].color}`;
  if (!art) return `<span class="axie" data-broken="true" style="${style}">
    <span class="axie-fallback">${crest(a.class)}</span></span>`;

  const bag = alts ? (VARIANTS[pose] ?? {}) : {};
  const layers = art.layers
    .map((l) => {
      // Las de la pila evolucionada dicen su slot; la evolucionada lleva `@2`, como sus
      // dibujos y sus pistas en `axie-poses.js`.
      const slot = l.slot ? `${l.slot}${l.lv2 ? '@2' : ''}` : partOf(l.src);
      const mine = Object.entries(bag).filter(([, v]) => v.slot === slot);
      return (
        layerImg(l.src, slot, slot, l, false) +
        mine.map(([att, v]) => layerImg(v.src, slot, att, v, true)).join('')
      );
    })
    .join('');
  return `<span class="axie" data-broken="false" data-pose="${pose}"
    style="${style};--ratio:${art.ratio}" title="${a.name}"
    ><span class="axie-rig"><span class="axie-body"><span class="axie-pose"
    >${layers}</span></span></span
    ><span class="axie-fallback">${crest(a.class)}</span></span>`;
}
