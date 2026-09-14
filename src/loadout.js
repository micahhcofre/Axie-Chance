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
// Lo que se guarda es el Axie **y sus mejoras**: son las dos mitades de la misma
// respuesta, porque lo que elegís es el mazo con el que vas a jugar.
import { AXIE_IDS } from './axies.js';

const LOADOUT_KEY = 'axie-chance:axie';

/** El almacenamiento, o nada si el navegador lo tiene apagado. */
export function store() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
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
 * @returns {{axie: string, boosts: Record<string, string>}|null}
 */
export function cleanLoadout(raw) {
  if (!raw || typeof raw !== 'object' || !AXIE_IDS.includes(raw.axie)) return null;
  const boosts = {};
  if (raw.boosts && typeof raw.boosts === 'object') {
    for (const [key, sym] of Object.entries(raw.boosts)) {
      if (typeof sym === 'string') boosts[key] = sym;
    }
  }
  return { axie: raw.axie, boosts };
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
export function writeLoadout(axie, boosts = {}) {
  const clean = cleanLoadout({ axie, boosts });
  if (!clean) return;
  try { store()?.setItem(LOADOUT_KEY, JSON.stringify(clean)); } catch { /* ídem */ }
}
