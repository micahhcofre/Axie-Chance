// Con qué Axie jugás, guardado en el navegador.
//
// La elección se hace una sola vez y en un solo lugar —la portada, en el botón de tu
// Axie (ver `lobby.js`)—, pero de ahí tiene que llegar a dos partidas distintas.
// Contra la CPU el camino es corto: la misma pantalla que eligió es la que arranca.
// A una sala, en cambio, se entra por `?red`, que es otra dirección: la página se
// recarga entera y una variable no cruza. Esto es lo único que la cruza.
//
// Sin esto, la sala no tenía de dónde sacar tu Axie y volvía a preguntarlo con un
// roster arriba de la mesa, con la partida ya andando — la pantalla que se había
// sacado justamente para que, sentado a la mesa, lo único que se haga sea jugar.
//
// Lo que se guarda es el Axie, **sus mejoras, las cartas de la mochila que lleva
// puestas** (ver `backpack.js`) **y sus partes evolucionadas** (ver `evolution.js`): es
// todo la misma respuesta, porque lo que elegís es el mazo con el que vas a jugar.
import { AXIE_IDS, cleanEvolved } from './axies.js';
import { cleanExtras } from './data.js';

const LOADOUT_KEY = 'axie-chance:axie';

/**
 * El **modo libre** (`?libre`): el juego entero, como lo ve un jugador, con el mapa
 * abierto, los Axies en nivel 60 y Moonshards y llaves sin fin (ver `readWallet` en
 * `evolution.js`, `getAdventureProgress` en `adventure.js` y `free-play.js`). Guarda en
 * su propio cajón (`axie-chance:libre:…`): lo que se pruebe acá no toca lo de verdad.
 */
export const FREE_PLAY = (() => {
  try { return new URLSearchParams(globalThis.location?.search ?? '').has('libre'); } catch { return false; }
})();

const STORE_NS = 'axie-chance:';
const FREE_NS = 'axie-chance:libre:';
const freeKey = (key) => (String(key).startsWith(STORE_NS) ? FREE_NS + String(key).slice(STORE_NS.length) : key);

/** Una dirección de la página que no se sale del modo libre: `withFree('?red')`. */
export const withFree = (search = '') => (FREE_PLAY ? `${search}${search ? '&' : '?'}libre` : search);

/** El almacenamiento, o nada si el navegador lo tiene apagado. En el modo libre, su cajón. */
export function store() {
  let ls;
  try { ls = globalThis.localStorage ?? null; } catch { return null; }
  if (!ls || !FREE_PLAY) return ls;
  return {
    getItem: (key) => ls.getItem(freeKey(key)),
    setItem: (key, value) => ls.setItem(freeKey(key), value),
    removeItem: (key) => ls.removeItem(freeKey(key)),
  };
}

/** Borra todo lo guardado del modo libre (sus Axies, su mochila, su Aventura…). */
export function clearFreePlay() {
  try {
    const ls = globalThis.localStorage;
    const keys = Array.from({ length: ls.length }, (_, i) => ls.key(i)).filter((k) => k?.startsWith(FREE_NS));
    for (const k of keys) ls.removeItem(k);
  } catch { /* sin almacenamiento no hay nada que borrar */ }
}

/**
 * Lo que vale como elección: un Axie del roster y sus mejoras, y nada más.
 *
 * Se revisa acá y no en cada lado que lo lee porque son dos los que lo leen y uno de
 * ellos es el servidor de las salas: lo que sale de este archivo viaja por el cable
 * como el pedido de un jugador, así que lo que entra puede ser cualquier cosa —lo que
 * quedó de una versión anterior, o lo que alguien escriba a mano—. Las mejoras que no
 * correspondan las descarta después el mazo (ver `buildPersonalDeck`); lo de acá es
 * que sean un objeto de textos y no una bomba.
 *
 * Las cartas de la mochila pasan por `cleanExtras`: símbolos que existan, un poder que
 * exista y no más de `EXTRA_SLOTS`. Las partes evolucionadas, por `cleanEvolved`: de
 * las seis y sin repetir.
 *
 * @returns {{axie: string, boosts: Record<string, string>, extras: object[], evolved: string[]}|null}
 */
export function cleanLoadout(raw) {
  if (!raw || typeof raw !== 'object' || !AXIE_IDS.includes(raw.axie)) return null;
  const boosts = {};
  if (raw.boosts && typeof raw.boosts === 'object') {
    for (const [key, sym] of Object.entries(raw.boosts)) {
      if (typeof sym === 'string') boosts[key] = sym;
    }
  }
  return { axie: raw.axie, boosts, extras: cleanExtras(raw.extras), evolved: cleanEvolved(raw.evolved) };
}

/** Con qué estás jugando, o `null` si todavía no elegiste en esta máquina. */
export function readLoadout() {
  try {
    return cleanLoadout(JSON.parse(store()?.getItem(LOADOUT_KEY) ?? 'null'));
  } catch {
    return null;
  }
}

/** Deja anotado con qué jugás. Lo que no se entienda no se guarda. */
export function writeLoadout(axie, boosts = {}, extras = [], evolved = []) {
  const clean = cleanLoadout({ axie, boosts, extras, evolved });
  if (!clean) return;
  try { store()?.setItem(LOADOUT_KEY, JSON.stringify(clean)); } catch { /* ídem */ }
}
