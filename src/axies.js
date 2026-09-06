// El roster: seis Axies fijos, uno por clase. Elegir un Axie es elegir con qué
// mazo jugás — hoy el mazo sale de su clase y nada más.
//
// Un Axie es su clase (`class`, que es también el símbolo con el que puntúa) más
// seis partes. Las partes todavía no cambian nada de las reglas: solo lo dibujan.
// El día que influyan en el mazo, el gancho es `deckFor`.
//
// El dibujo son capas de PNG del CDN de Axie Infinity, calculadas de antemano por
// `npm run axies` y guardadas en `axie-avatars.js`. Si tocás `parts`, hay que volver
// a correrlo: el navegador no puede recalcularlas solo. Las partes válidas de cada
// clase están en `PART_CATALOG`, en ese mismo archivo.
import { SYMBOLS, buildPersonalDeck, crest } from './data.js';
import { AVATAR_BASE, AVATARS } from './axie-avatars.js';

/** @type {Record<string, {id: string, class: string, name: string, parts: object, color: number}>} */
export const AXIES = {
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
      eyes: 'aquatic-02', ears: 'aquatic-04', mouth: 'aquatic-08',
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
      eyes: 'bug-08', ears: 'bug-12', mouth: 'bug-10',
      horn: 'bug-04', back: 'bug-08', tail: 'bug-02',
    },
  },
  reptile: {
    id: 'reptile',
    class: 'reptile',
    name: 'Escama',
    color: 3,
    parts: {
      eyes: 'reptile-04', ears: 'reptile-08', mouth: 'reptile-02',
      horn: 'reptile-10', back: 'reptile-06', tail: 'reptile-04',
    },
  },
};

export const AXIE_IDS = Object.keys(AXIES);

/** El Axie de un id, o el primero del roster si el id no existe. */
export function axie(id) {
  return AXIES[id] ?? AXIES[AXIE_IDS[0]];
}

/**
 * El mazo con el que arranca un Axie: el de su clase, 10 cartas.
 * Acá entran las partes el día que modifiquen la baraja.
 */
export function deckFor(id) {
  return buildPersonalDeck(axie(id).class);
}

const pc = (n) => `${(n * 100).toFixed(3)}%`;

/**
 * De qué parte del bicho es una capa, sacado de la ruta del PNG: `.../tail.png` es
 * la cola, `body-normal/leg-front-left/...` una pata. Es lo que le permite al CSS
 * animar cada pedazo por su cuenta —la cola se hamaca, las orejas tiemblan, los ojos
 * parpadean— sin tener que volver a generar `axie-avatars.js`.
 *
 * El prefijo `body-normal/` se saca antes de buscar: empieza con "body" y se comería
 * a las patas, que viven abajo de él.
 */
const PARTS =
  /(leg-front-left|leg-front-right|leg-back-left|leg-back-right|body|tail|ear-left|ear-right|back|horn|eyes|mouth)/;

const partOf = (src) => src.replace('body-normal/', '').match(PARTS)?.[1] ?? 'body';

/**
 * El Axie dibujado: una pila de <img> posicionados en porcentajes, así el tamaño lo
 * pone el contenedor y el mismo HTML sirve para el tablero y para el selector. Si el CDN no responde, `onerror` marca el bloque
 * y el CSS muestra el crest de la clase en su lugar.
 *
 * Son tres cajas anidadas y no una sola porque las tres se mueven a la vez, y un
 * elemento tiene un solo `transform`:
 *   `.axie`      el bicho entero yendo a algún lado: el salto al ataque, el sacudón
 *                del golpe.
 *   `.axie-rig`  la postura: el pecho que respira, el cuerpo que se agacha para
 *                cargar, el que se desploma al quedarse sin vida.
 *   `.axie-body` el espejo. Los Axies vienen mirando a la izquierda, y el de la
 *                izquierda de la mesa tiene que darse vuelta para enfrentar al otro.
 * Adentro, cada capa anima su parte por el `data-part`.
 *
 * `--beat` desfasa el reloj de todas esas animaciones según el lugar del Axie en el
 * roster: dos Axies respirando exactamente al mismo tiempo delatan al muñeco.
 */
export function axieArt(id) {
  const a = axie(id);
  const art = AVATARS[a.id];
  const style = `--c:${SYMBOLS[a.class].color}`;
  if (!art) return `<span class="axie" data-broken="true" style="${style}">
    <span class="axie-fallback">${crest(a.class)}</span></span>`;

  const layers = art.layers
    .map(
      (l) => `<img src="${AVATAR_BASE}${l.src}" alt="" loading="lazy"
        data-part="${partOf(l.src)}"
        onerror="this.closest('.axie').dataset.broken='true'"
        style="left:${pc(l.x)};top:${pc(l.y)};width:${pc(l.w)};height:${pc(l.h)}">`,
    )
    .join('');
  const beat = (AXIE_IDS.indexOf(a.id) * -0.47).toFixed(2);
  return `<span class="axie" data-broken="false"
    style="${style};--ratio:${art.ratio};--beat:${beat}s" title="${a.name}"
    ><span class="axie-rig"><span class="axie-body">${layers}</span></span
    ><span class="axie-fallback">${crest(a.class)}</span></span>`;
}
