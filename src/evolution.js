// La evolución de los Axies del roster: su nivel, su experiencia (AXP), las cartas que
// evolucionaron y los Moonshards con que se pagan. El diseño está en
// [docs/economy.md](../docs/economy.md).
//
//   Nivel      cada Axie va del 1 al 60 con su propia experiencia (AXP). Pasar del nivel
//              `L` al siguiente pide `30 + 5·(L−1)`, y cada subida paga 5 Moonshards.
//   Evolución  cada 10 niveles se abre una (son seis). Se elige la carta favorable, se
//              paga en Moonshards (cada vez más) y evoluciona la parte del cuerpo de
//              esa carta: la carta suma el símbolo de **la clase de esa parte**, que no
//              siempre es la del Axie (ver `kitParts` en `axies.js`).
//   Moonshards la moneda, una sola bolsa para todos los Axies.
//
// Lo que sale de acá es el id con que juega cada uno (`playingId`, ver `evolvedId`): con
// eso la partida, el mazo y el dibujo ya salen evolucionados sin preguntar nada.
//
// La experiencia y los Moonshards se ganan al terminar cada partida, según el resultado y
// el modo (ver `payout.js`); la zona de testeo (`?testeo`, ver `sandbox.js`) los carga sin
// jugar.
//
// Las cuentas son puras —sin DOM—; lo que se guarda va por el mismo almacenamiento que
// la mochila (ver `store` en `loadout.js`), y todo lo que se lee se limpia: lo escribe
// esta máquina, pero puede venir de una versión anterior o de alguien con la consola.
import { AXIES, AXIE_IDS, axie, cleanEvolved, evolvedId, partClass } from './axies.js';
import { store, FREE_PLAY } from './loadout.js';
import { currentLang } from './i18n.js';

export const PROGRESS_KEY = 'axie-chance:axies';
export const WALLET_KEY = 'axie-chance:wallet';

/** El nivel más alto de un Axie. */
export const MAX_LEVEL = 60;
/** Cada cuántos niveles se abre una evolución. */
export const EVOLVE_STEP = 10;
/** Lo que cuesta cada evolución, en orden: la primera, la segunda… */
export const EVOLVE_COSTS = [300, 600, 900, 1200, 1500, 2000];
/** Los Moonshards que da cada subida de nivel. */
export const LEVEL_UP_SHARDS = 5;

/** La experiencia que pide pasar del nivel `level` al siguiente. */
export const axpNeed = (level) => 30 + 5 * (level - 1);

/**
 * El nivel que da tanta experiencia: `level`, lo juntado dentro de ese nivel (`into`), lo
 * que pide el siguiente (`need`) y la fracción de la barra (`frac`). En el 60 la barra
 * queda llena (`max`).
 */
export function levelInfo(axp) {
  let level = 1;
  let into = Math.max(0, Math.floor(Number(axp) || 0));
  while (level < MAX_LEVEL && into >= axpNeed(level)) {
    into -= axpNeed(level);
    level += 1;
  }
  if (level >= MAX_LEVEL) return { level: MAX_LEVEL, into: 0, need: 0, frac: 1, max: true };
  const need = axpNeed(level);
  return { level, into, need, frac: into / need, max: false };
}

/** Cuántas evoluciones abre un nivel: una cada 10, hasta seis. */
export const evolveSlots = (level) => Math.min(EVOLVE_COSTS.length, Math.floor(level / EVOLVE_STEP));

// ---------- lo guardado ----------

/** Un Axie sin nada: nivel 1 y ninguna carta evolucionada (`played` falta: ninguna partida). */
const freshRecord = () => ({ axp: 0, evolved: [] });

/**
 * Lo que vale como progreso: por Axie del roster, su experiencia (un entero ≥ 0), sus
 * partes evolucionadas, nunca más de las que abre su nivel, y las partidas que terminó
 * (`played`, un entero ≥ 0: dice cuáles son los que más usás, ver el perfil en
 * `lobby.js`). Lo demás no se guarda.
 */
export function cleanProgress(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const id of AXIE_IDS) {
    const r = raw[id];
    if (!r || typeof r !== 'object') continue;
    const axp = Math.max(0, Math.floor(Number(r.axp) || 0));
    const evolved = cleanEvolved(r.evolved).slice(0, evolveSlots(levelInfo(axp).level));
    const played = Math.max(0, Math.floor(Number(r.played) || 0));
    if (axp || evolved.length || played) out[id] = played ? { axp, evolved, played } : { axp, evolved };
  }
  return out;
}

/** Lo de un Axie: su experiencia y sus partes evolucionadas. */
export const recordOf = (progress, id) => progress?.[id] ?? freshRecord();

/**
 * El progreso de esta máquina. En el modo libre (ver `FREE_PLAY`) todos los Axies están
 * en el nivel 60: las seis evoluciones abiertas.
 */
export function readProgress() {
  let progress;
  try {
    progress = cleanProgress(JSON.parse(store()?.getItem(PROGRESS_KEY) ?? 'null'));
  } catch {
    progress = {};
  }
  if (!FREE_PLAY) return progress;
  const top = axpAt(MAX_LEVEL);
  return Object.fromEntries(AXIE_IDS.map((id) => {
    const record = recordOf(progress, id);
    return [id, { ...record, axp: Math.max(record.axp, top) }];
  }));
}

export function writeProgress(progress) {
  try { store()?.setItem(PROGRESS_KEY, JSON.stringify(cleanProgress(progress))); } catch { /* sin almacenamiento, dura la página */ }
}

/**
 * Las llaves del Taller, la común y la de oro: cada una crea una carta sin pagar
 * Moonshards (ver `KEY_ODDS` en `crafting.js`). Salen del pase de temporada (ver
 * `missions.js`), y diez comunes se cambian por una de oro (`KEY_TRADE`).
 */
export const KEY_KINDS = ['basic', 'gold'];

/** Un entero ≥ 0. */
const walletCount = (n) => Math.max(0, Math.floor(Number(n) || 0));

/**
 * Lo que vale como bolsa: los Moonshards y las llaves de cada clase, enteros ≥ 0.
 *
 * Quien arma una bolsa nueva a partir de otra la copia entera (`{ ...wallet, … }`):
 * armarla de cero con los Moonshards solos le borraría las llaves al guardarla.
 *
 * Hubo una llave de poder (`power`): las que quedaron guardadas pasan a ser de oro.
 */
export function cleanWallet(raw) {
  const keys = Object.fromEntries(KEY_KINDS.map((k) => [k, walletCount(raw?.keys?.[k])]));
  keys.gold += walletCount(raw?.keys?.power);
  return { moonshards: walletCount(raw?.moonshards), keys };
}

/** La bolsa del modo libre: no se gasta nunca. */
const FREE_WALLET = { moonshards: 999999, keys: { basic: 999, gold: 999 } };

export function readWallet() {
  if (FREE_PLAY) return cleanWallet(FREE_WALLET);
  try {
    return cleanWallet(JSON.parse(store()?.getItem(WALLET_KEY) ?? 'null'));
  } catch {
    return cleanWallet(null);
  }
}

export function writeWallet(wallet) {
  if (FREE_PLAY) return;
  try { store()?.setItem(WALLET_KEY, JSON.stringify(cleanWallet(wallet))); } catch { /* ídem */ }
}

/** Un número con los separadores del idioma: 1.250 o 1,250. */
export const shardAmount = (n) => Number(n).toLocaleString(currentLang() === 'en' ? 'en-US' : 'es-AR');

/** El Moonshard, chico, para ponerlo al lado de un número (pintado en `#ic-moon`). */
export const moonIcon = (cls = 'moon-ico') =>
  `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true"><use href="#ic-moon"/></svg>`;

/** Una cantidad de Moonshards: el ícono y el número. La usan el Taller y la evolución. */
export const shardsHtml = (n) => `<span class="moon-amt">${moonIcon()}<b>${shardAmount(n)}</b></span>`;

/** El id con que juega un Axie, con sus partes evolucionadas: `'buba~horn'`. */
export const playingId = (progress, id) => evolvedId(id, recordOf(progress, id).evolved);

// ---------- evolucionar ----------

/**
 * Lo que pide la próxima evolución de un Axie: cuál es (`index`, de 0 a 5), el nivel
 * desde el que se abre y lo que cuesta. `null` con las seis hechas.
 */
export function nextEvolution(record) {
  const index = record.evolved.length;
  if (index >= EVOLVE_COSTS.length) return null;
  return { index, level: (index + 1) * EVOLVE_STEP, cost: EVOLVE_COSTS[index] };
}

/**
 * Por qué no se puede evolucionar `part` de un Axie, o `null` si se puede:
 *
 *   'part'     no es una de las seis partes
 *   'evolved'  esa ya evolucionó
 *   'done'     ya están las seis
 *   'level'    el nivel todavía no abre la próxima
 *   'shards'   no alcanzan los Moonshards
 */
export function evolveBlock(record, wallet, part) {
  if (!cleanEvolved([part]).length) return 'part';
  if (record.evolved.includes(part)) return 'evolved';
  const next = nextEvolution(record);
  if (!next) return 'done';
  if (levelInfo(record.axp).level < next.level) return 'level';
  if (wallet.moonshards < next.cost) return 'shards';
  return null;
}

/**
 * Evoluciona la carta de `part` de un Axie: cobra y la anota. Devuelve el progreso y la
 * bolsa nuevos, o los mismos si no se podía (ver `evolveBlock`).
 */
export function evolveCard(progress, wallet, id, part) {
  const record = recordOf(progress, id);
  if (!AXIES[id] || evolveBlock(record, wallet, part)) return { progress, wallet };
  const { cost } = nextEvolution(record);
  return {
    progress: { ...progress, [id]: { ...record, evolved: cleanEvolved([...record.evolved, part]) } },
    wallet: { ...wallet, moonshards: wallet.moonshards - cost },
  };
}

/**
 * Le suma experiencia a un Axie. Cada nivel que sube paga `LEVEL_UP_SHARDS`. Devuelve
 * el progreso y la bolsa nuevos, y los niveles a los que llegó (`levels`, vacío si no
 * subió ninguno). Es la puerta del botín de las partidas (ver `claimPayout`).
 */
export function gainAxp(progress, wallet, id, amount) {
  const record = recordOf(progress, id);
  const add = Math.max(0, Math.floor(Number(amount) || 0));
  if (!AXIES[id] || !add) return { progress, wallet, levels: [] };
  const before = levelInfo(record.axp).level;
  const axp = record.axp + add;
  const after = levelInfo(axp).level;
  const levels = Array.from({ length: after - before }, (_, i) => before + i + 1);
  return {
    progress: { ...progress, [id]: { ...record, axp } },
    wallet: { ...wallet, moonshards: wallet.moonshards + levels.length * LEVEL_UP_SHARDS },
    levels,
  };
}

/** Anota una partida terminada con un Axie del roster (ver `claimPayout`). */
export function countMatch(progress, id) {
  if (!AXIES[id]) return progress;
  const record = recordOf(progress, id);
  return { ...progress, [id]: { ...record, played: (record.played ?? 0) + 1 } };
}

/** La experiencia que hace falta para estar justo en el nivel `level`. */
export function axpAt(level) {
  let axp = 0;
  for (let l = 1; l < Math.min(level, MAX_LEVEL); l++) axp += axpNeed(l);
  return axp;
}

/**
 * El símbolo que suma la carta de `part` al evolucionar: la clase de esa parte (las Mech,
 * Dawn y Dusk cuentan como de la clase del Axie, ver `partClass`).
 */
export function evolveSymbol(id, part) {
  const a = axie(id);
  const key = (a.parts ?? a.kitParts)?.[part];
  return partClass(key ?? a.class, a.class);
}
