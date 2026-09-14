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
//
// Ojo con `eyes`: no todas las partes animan igual. Cada una trae sus ojos cerrados,
// enojados y contentos, pero en varias el dibujo cerrado es casi el mismo que el
// abierto —`aquatic-02` cambia el 4% de los píxeles y `bug-08` el 2%—, así que el
// Axie parpadea y no se le nota. Los seis de acá están elegidos por eso.
import { SYMBOLS, buildPersonalDeck, toAxieNFTState, crest } from './data.js';
import { AVATAR_BASE, AVATARS } from './axie-avatars.js';
import { VARIANTS } from './axie-poses.js';

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

export const AXIE_IDS = Object.keys(AXIES);

/** El Axie de un id, o el primero del roster si el id no existe. */
export function axie(id) {
  return AXIES[id] ?? AXIES[AXIE_IDS[0]];
}

/**
 * El mazo con el que arranca un Axie: 10 cartas según la taxonomía canónica y Axie Core.
 * Si se pasa `nftState`, tiene prioridad para mutaciones de Part Evolution.
 *
 * `boosts` son las mejoras elegidas en la pantalla de elección —un símbolo de más en
 * algunas cartas— y van de la clave de la carta al símbolo que se le suma (ver
 * `buildPersonalDeck`). Sin ellas es el mazo pelado de siempre.
 */
export function deckFor(id, boosts = {}, nftState = null) {
  const state = nftState ? toAxieNFTState(nftState) : toAxieNFTState(axie(id));
  return buildPersonalDeck(state, boosts);
}

const pc = (n) => `${(n * 100).toFixed(3)}%`;

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

/** Una capa: el PNG del CDN puesto en porcentajes del marco del dibujo. */
function layerImg(src, slot, att, box, alt) {
  return `<img src="${AVATAR_BASE}${src}" alt=""${alt ? ' class="axie-alt"' : ' loading="lazy"'}
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
  const art = AVATARS[a.id];
  const style = `--c:${SYMBOLS[a.class].color}`;
  if (!art) return `<span class="axie" data-broken="true" style="${style}">
    <span class="axie-fallback">${crest(a.class)}</span></span>`;

  const bag = alts ? (VARIANTS[a.id] ?? {}) : {};
  const layers = art.layers
    .map((l) => {
      const slot = partOf(l.src);
      const mine = Object.entries(bag).filter(([, v]) => v.slot === slot);
      return (
        layerImg(l.src, slot, slot, l, false) +
        mine.map(([att, v]) => layerImg(v.src, slot, att, v, true)).join('')
      );
    })
    .join('');
  return `<span class="axie" data-broken="false"
    style="${style};--ratio:${art.ratio}" title="${a.name}"
    ><span class="axie-rig"><span class="axie-body"><span class="axie-pose"
    >${layers}</span></span></span
    ><span class="axie-fallback">${crest(a.class)}</span></span>`;
}
