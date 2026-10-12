// La mochila: las cartas sueltas que tenés y todavía no son de ningún mazo.
//
// El mazo de un Axie son sus 8 cartas de fábrica, que salen de su clase y de sus partes
// (ver `baseDeck`). La mochila es lo otro: cartas tuyas y no del bicho, que se le cuelgan
// al Axie que quieras desde su inventario (ver `lobby.js`) y viajan con él a la partida
// (ver `extraCards` en `data.js` y `extras` en `newMatch`).
//
// Cada carta es una sola: puesta en un Axie, deja de estar libre y el inventario de otro
// ya no la ofrece. Sacarla la devuelve a la mochila. Por eso cada una lleva `axie`, el
// Axie que la tiene puesta, o `null` si está suelta.
//
// La primera vez la mochila arranca con un paquete de bienvenida (`STARTER_PACK`): sin
// cartas no hay nada que probar. De acá en más se llena con `addToBackpack`, que es la
// puerta para el botín de las partidas (ver `rewardsOf` en `result.js`).
import { AXIE_IDS } from './axies.js';
import { EXTRA_SLOTS, cleanExtra } from './data.js';
import { store } from './loadout.js';

export const BACKPACK_KEY = 'axie-chance:backpack';

/**
 * El paquete de bienvenida: cartas sin poder de dos y tres símbolos, repartidas entre
 * las seis clases para que cualquier Axie encuentre alguna que le sirva, y un Rocket
 * Stamp, que se apila en cualquier mazo.
 */
export const STARTER_PACK = [
  { symbols: ['plant', 'beast'] },
  { symbols: ['aquatic', 'bird'] },
  { symbols: ['bug', 'reptile'] },
  { symbols: ['plant', 'aquatic', 'bug'] },
  { symbols: ['beast', 'bird', 'reptile'] },
  { symbols: ['beast', 'aquatic'], power: 'freegame' },
];

/** Una mochila recién abierta: el paquete de bienvenida, todo suelto. */
function freshBackpack() {
  return { next: STARTER_PACK.length + 1, items: STARTER_PACK.map((c, i) => ({ id: `b${i + 1}`, ...cleanExtra(c), axie: null })) };
}

/**
 * Lo que vale como mochila: cartas limpias con un id que no se repite, cada una suelta
 * o puesta en un Axie del roster, y ningún Axie con más de `EXTRA_SLOTS`. Lo que sobre
 * de un Axie lleno —una versión anterior, algo escrito a mano— vuelve a estar suelto.
 */
export function cleanBackpack(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items)) return null;
  const seen = new Set();
  const perAxie = {};
  const items = [];
  for (const it of raw.items) {
    const card = cleanExtra(it);
    const id = typeof it?.id === 'string' ? it.id : null;
    if (!card || !id || seen.has(id)) continue;
    seen.add(id);
    let owner = AXIE_IDS.includes(it.axie) ? it.axie : null;
    if (owner && (perAxie[owner] = (perAxie[owner] ?? 0) + 1) > EXTRA_SLOTS) owner = null;
    items.push({ id, ...card, axie: owner });
  }
  const next = Number.isInteger(raw.next) && raw.next > items.length ? raw.next : items.length + 1;
  return { next, items };
}

/** La mochila de esta máquina. La primera vez, el paquete de bienvenida. */
export function readBackpack() {
  let saved = null;
  try { saved = cleanBackpack(JSON.parse(store()?.getItem(BACKPACK_KEY) ?? 'null')); } catch { /* se arranca de nuevo */ }
  if (saved) return saved;
  const fresh = freshBackpack();
  writeBackpack(fresh);
  return fresh;
}

export function writeBackpack(bag) {
  const clean = cleanBackpack(bag);
  if (!clean) return;
  try { store()?.setItem(BACKPACK_KEY, JSON.stringify(clean)); } catch { /* sin almacenamiento, dura la página */ }
}

/** Las cartas que tiene puestas un Axie, en el orden en que se le pusieron. */
export const equippedOn = (bag, axieId) => bag.items.filter((it) => it.axie === axieId);

/** Las cartas sueltas. */
export const looseCards = (bag) => bag.items.filter((it) => !it.axie);

/** Lo que viaja a la partida: las cartas de un Axie sin id ni dueño (ver `cleanExtras`). */
export const extrasOf = (bag, axieId) =>
  equippedOn(bag, axieId).map(({ symbols, power }) => ({ symbols, power }));

/**
 * Le pone una carta de la mochila a un Axie. Si la carta estaba en otro, se la saca:
 * es una sola. No hace nada si el Axie ya está lleno o la carta no existe.
 * Devuelve una mochila nueva.
 */
export function equip(bag, itemId, axieId) {
  if (!AXIE_IDS.includes(axieId) || equippedOn(bag, axieId).length >= EXTRA_SLOTS) return bag;
  // Se va al final: el inventario la muestra en el último lugar ocupado.
  const it = bag.items.find((x) => x.id === itemId);
  if (!it || it.axie === axieId) return bag;
  return { ...bag, items: [...bag.items.filter((x) => x !== it), { ...it, axie: axieId }] };
}

/** Vuelve una carta a la mochila. */
export function unequip(bag, itemId) {
  return { ...bag, items: bag.items.map((x) => (x.id === itemId ? { ...x, axie: null } : x)) };
}

/** Suma cartas sueltas a la mochila (el botín, cuando lo haya). Las que no valen no entran. */
export function addToBackpack(bag, cards) {
  let next = bag.next;
  const added = cards.map(cleanExtra).filter(Boolean).map((c) => ({ id: `b${next++}`, ...c, axie: null }));
  return { next, items: [...bag.items, ...added] };
}
