// El botín de una partida: lo que paga el resultado en Moonshards y AXP, y el cobro. El
// diseño está en [docs/economy.md](../docs/economy.md) (§3):
//
//   Multijugador  ganar paga 10, y 20 por K.O. Empatar o perder, nada.
//   Aventura      la primera victoria de cada nivel paga 10, y 20 por K.O.; la estrella
//                 en un nivel ya ganado sin K.O., los 10 que faltaban. Volver a ganarlo,
//                 nada. Un jefe paga el doble (`BOSS_PAY`).
//   CPU, tutorial nada: se practica.
//
// Moonshards y AXP salen juntos y con el mismo número: los Moonshards van a la bolsa y la
// AXP al Axie con que se jugó, que al subir de nivel paga 5 Moonshards más por nivel (ver
// `gainAxp` en `evolution.js`). Paga el resultado, nunca la cadena ni el daño.
//
// `payoutOf` es pura; `claimPayout` cobra y guarda. Cada pantalla cobra lo suyo: en una
// sala la partida corre en el navegador del anfitrión, pero la bolsa y la AXP son de cada
// aparato.
import { matchResult, wonByKo } from './game.js';
import { AXIES } from './axies.js';
import { readProgress, writeProgress, readWallet, writeWallet, recordOf, gainAxp, countMatch, LEVEL_UP_SHARDS } from './evolution.js';

/** Lo que paga ganar: con el rival tumbado sin última chance (K.O.), el doble. */
export const MATCH_PAY = { win: 10, ko: 20 };

/** Cuánto más paga un jefe de la Aventura: uno cada diez niveles, y el más difícil de su capítulo. */
export const BOSS_PAY = 2;

/**
 * Ganar porque el otro se fue paga solo desde esta ronda: abrir una sala y abandonarla
 * enseguida no puede ser una forma de cobrar.
 */
export const FORFEIT_PAY_ROUND = 4;

/**
 * Lo que paga una partida terminada al asiento `seat`: `{ amount, why }`. `amount` es lo
 * mismo en Moonshards y en AXP; `why` dice de dónde sale, o por qué no hay nada:
 *
 *   'win', 'ko'          una victoria en red (por K.O., el doble)
 *   'first', 'firstKo'   la primera victoria de un nivel de la Aventura
 *   'star'               la estrella de un nivel que ya se había ganado sin K.O.
 *   'practice'           contra la CPU
 *   'tutorial'           el tutorial
 *   'lose', 'tie'        perder o empatar
 *   'early'              ganada porque el otro se fue antes de `FORFEIT_PAY_ROUND`
 *   'replay'             un nivel ya ganado, con su estrella
 *   'noStar'             un nivel ya ganado, ganado otra vez sin K.O.: falta la estrella
 *
 * `null` mientras se juega, o sin asiento (el que mira una sala no juega). `adventure` es
 * el progreso de la Aventura **antes** de anotar esta partida (ver `getAdventureProgress`):
 * de ahí sale si es la primera victoria del nivel.
 */
export function payoutOf(state, { seat = 'p1', adventure = null } = {}) {
  const result = matchResult(state);
  if (!result || !seat) return null;
  if (state.mode === 'tutorial') return { amount: 0, why: 'tutorial' };
  if (state.mode !== 'net' && state.mode !== 'adventure') return { amount: 0, why: 'practice' };
  const won = result === seat;
  const ko = won && wonByKo(state);
  if (state.mode === 'net') {
    if (!won) return { amount: 0, why: result === 'tie' ? 'tie' : 'lose' };
    if (state.forfeit && state.round < FORFEIT_PAY_ROUND) return { amount: 0, why: 'early' };
    return ko ? { amount: MATCH_PAY.ko, why: 'ko' } : { amount: MATCH_PAY.win, why: 'win' };
  }
  // En la Aventura, perder un nivel ya ganado dice lo mismo que volver a ganarlo: lo que
  // todavía se puede sacar de ahí, que es la estrella o nada.
  const level = Number(state.adventure?.level);
  const k = state.adventure?.boss ? BOSS_PAY : 1;
  if (!adventure?.completedLevels?.includes(level)) {
    if (!won) return { amount: 0, why: result === 'tie' ? 'tie' : 'lose' };
    return ko ? { amount: MATCH_PAY.ko * k, why: 'firstKo' } : { amount: MATCH_PAY.win * k, why: 'first' };
  }
  if (adventure.starredLevels?.includes(level)) return { amount: 0, why: 'replay' };
  return ko ? { amount: (MATCH_PAY.ko - MATCH_PAY.win) * k, why: 'star' } : { amount: 0, why: 'noStar' };
}

/** El Axie del roster con que jugó un asiento: su id sin las evoluciones (`'buba~horn'` → `'buba'`). */
const rosterId = (state, seat) => {
  const id = String(state?.axies?.[seat] ?? '').split('~')[0];
  return AXIES[id] ? id : null;
};

/**
 * Cobra lo que paga la partida (ver `payoutOf`): los Moonshards a la bolsa y la AXP al
 * Axie del asiento, con lo que paga cada nivel que sube. Devuelve lo que cuenta la
 * pantalla del final (ver `resultView`), o `null` si no hay nada que contar:
 *
 *   { amount, why, axie, shards, axp, from, to, levels, purse }
 *
 * `shards` es todo lo que entró a la bolsa (lo de la partida más lo de subir de nivel),
 * `axp` lo que ganó el Axie, `from` y `to` su AXP antes y después, `levels` los niveles a
 * los que llegó y `purse` la bolsa como quedó. Sin nada que pagar solo se anota la
 * partida jugada del Axie (`countMatch`).
 *
 * Cobra cada vez que se la llama: no llamarla dos veces por la misma partida es asunto de
 * quien la llama (ver `onState` en `ui.js`).
 */
export function claimPayout(state, opts = {}) {
  const pay = payoutOf(state, opts);
  if (!pay) return null;
  const axie = rosterId(state, opts.seat ?? 'p1');
  // Toda partida terminada cuenta para tu Axie, pague o no (el tutorial no: se juega con
  // los suyos). Es lo que dice cuáles son los que más usás.
  const counts = axie && state.mode !== 'tutorial';
  const progress = counts ? countMatch(readProgress(), axie) : readProgress();
  const wallet = readWallet();
  const from = recordOf(progress, axie).axp;
  if (!pay.amount || !axie) {
    if (counts) writeProgress(progress);
    return { ...pay, amount: 0, axie, shards: 0, axp: 0, from, to: from, levels: [], purse: wallet.moonshards };
  }
  const paid = { ...wallet, moonshards: wallet.moonshards + pay.amount };
  const gained = gainAxp(progress, paid, axie, pay.amount);
  writeProgress(gained.progress);
  writeWallet(gained.wallet);
  return {
    ...pay, axie,
    shards: pay.amount + gained.levels.length * LEVEL_UP_SHARDS,
    axp: pay.amount,
    from, to: from + pay.amount,
    levels: gained.levels,
    purse: gained.wallet.moonshards,
  };
}
