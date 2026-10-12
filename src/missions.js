// Las misiones: tareas del día y de la semana que pagan AXP o Moonshards, y puntos para
// el pase de temporada, que paga llaves y Moonshards. El diseño está en
// [docs/missions.md](../docs/missions.md).
//
//   Del día     tres, una fácil, una media y una difícil. Se renuevan a la medianoche de
//               esta máquina; una se puede cambiar por otra una vez por día.
//   De la semana  cinco, más largas: dos de pelea, una de la clase de la semana (rota en
//               el orden canónico), una de colección y un desafío. Se renuevan el lunes.
//   El pase     cada misión cumplida suma puntos; cada 50, un escalón (40 por temporada
//               de 28 días) con llaves o Moonshards. Pasado el último, una llave cada 100.
//
// Cada misión paga una cosa: AXP (al Axie que tenés elegido cuando la cobrás) o
// Moonshards. Los puntos del pase entran solos al cumplirla; lo de la misión y lo del
// pase se cobran a mano, y lo que quedó sin cobrar se paga solo cuando se renueva.
//
// Cuenta todo menos el tutorial y la zona de testeo, también contra la CPU: lo que se
// puede sacar ya lo topean las misiones mismas. Un abandono antes de la ronda 4 no cuenta,
// igual que no paga (ver `FORFEIT_PAY_ROUND`).
//
// La partida no sabe nada de esto: lo que hizo cada uno lo cuenta `game.js` en
// `state.stats` y acá se lee al terminar (`matchEvent`), una vez por partida (ver
// `payFor` en `ui.js`). El Taller, la fusión y el reciclado avisan desde la portada.
//
// Las cuentas son puras —sin DOM—; lo guardado va por el mismo almacenamiento que el
// resto (`axie-chance:missions`), y todo lo que se lee se limpia. La hora es la de esta
// máquina: el que la adelanta solo se engaña a sí mismo, como con todo lo demás (ver
// docs/economy.md §8).
import { tr } from './i18n.js';
import { makeRng, shuffle, CANONICAL_CLASSES } from './data.js';
import { AXIES } from './axies.js';
import { PLAYERS, matchResult, wonByKo, hpOf } from './game.js';
import { store, readLoadout } from './loadout.js';
import { readWallet, writeWallet, readProgress, writeProgress, gainAxp, KEY_KINDS } from './evolution.js';
import { readBackpack, looseCards } from './backpack.js';
import { getAdventureProgress, ADVENTURE_LEVELS } from './adventure.js';
import { CRAFT_COST } from './crafting.js';
import { FORFEIT_PAY_ROUND } from './payout.js';

export const MISSIONS_KEY = 'axie-chance:missions';

/**
 * Lo que paga cada clase de misión: puntos del pase y, según la misión, Moonshards (`ms`)
 * o AXP. Borrador: ver docs/missions.md.
 */
export const MISSION_PAY = {
  easy: { points: 10, ms: 5, axp: 10 },
  medium: { points: 15, ms: 10, axp: 15 },
  hard: { points: 25, ms: 15, axp: 25 },
  weekly: { points: 60, ms: 30, axp: 50 },
  challenge: { points: 100, ms: 50, axp: 80 },
};
/** Las del día, una de cada. */
export const DAILY_POOLS = ['easy', 'medium', 'hard'];
/** Las de la semana, en este orden. */
export const WEEKLY_SLOTS = ['battle', 'battle', 'class', 'collection', 'challenge'];
/** Las del día que se pueden cambiar por otra, por día. */
export const DAILY_SWAPS = 1;

/** Lo que dura una temporada, en días: cuatro semanas justas. */
export const SEASON_DAYS = 28;
/** Los escalones del pase y los puntos de cada uno. */
export const PASS_TIERS = 40;
export const TIER_POINTS = 50;
/** Pasado el último escalón, una llave cada tantos puntos. */
export const PASS_BONUS_POINTS = 100;

const MISSION_DAY_MS = 86400000;
/** El lunes en que arrancó la primera temporada: 5 de octubre de 2026. */
export const SEASON_EPOCH = Date.UTC(2026, 9, 5) / MISSION_DAY_MS;

// ---------- las misiones ----------

/** El nombre de una clase, pedido al pintar: el idioma puede cambiar en el medio. */
const missionClassName = (cls) => ({
  plant: tr('Planta'), beast: tr('Bestia'), aquatic: tr('Pez'),
  bird: tr('Pájaro'), bug: tr('Bicho'), reptile: tr('Reptil'),
}[cls]);

// Los textos que comparten varias misiones.
const playText = (t) => tr('Jugá {n} batallas', { n: t.target });
const winsText = (t) => tr('Ganá {n} batallas', { n: t.target });
const chainText = (t) => tr('Atacá con una cadena de {n} o más', { n: t.value });
const hitText = (t) => tr('Pegá un golpe de {n} o más', { n: t.value });
const damageText = (t) => tr('Hacé {n} de daño', { n: t.target });
const healText = (t) => tr('Curate {n} de vida', { n: t.target });
const picksText = (t) => tr('Llevate {n} cartas del centro', { n: t.target });
const powersText = (t) => tr('Robá {n} cartas con poder', { n: t.target });
const stackText = (t) => tr('Apilá {n} Rocket Stamps', { n: t.target });

/**
 * Lo propio de la clase de cada semana: lo que mejor hacen sus poderes (cualquiera de los
 * cinco que salga en la partida suma).
 */
const CLASS_SIGNATURES = {
  plant: { target: 100, count: (e) => e.healed, text: healText },
  beast: { target: 40, count: (e) => e.bleed, text: (t) => tr('Hacé {n} de daño con sangrado', { n: t.target }) },
  aquatic: { target: 30, count: (e) => e.picks, text: picksText },
  bird: { target: 40, count: (e) => e.direct, text: (t) => tr('Hacé {n} de daño directo con plumas y shuriken', { n: t.target }) },
  bug: { target: 30, count: (e) => e.stolen, text: (t) => tr('Robale al rival {n} de vida o escudo', { n: t.target }) },
  reptile: { target: 40, count: (e) => e.poison + e.thorns, text: (t) => tr('Hacé {n} de daño con veneno o espinas', { n: t.target }) },
};

/**
 * Todas las misiones. Cada una:
 *
 *   `pool`    de dónde sale: 'easy', 'medium', 'hard' (del día), 'battle', 'class',
 *             'collection', 'challenge' (de la semana)
 *   `pays`    'axp' o 'ms' (Moonshards); cuánto, lo dice `MISSION_PAY`
 *   `target`  cuánto hay que juntar; `value`, el umbral de las que lo tienen (una
 *             cadena de 5 o más)
 *   `on`      qué la hace avanzar: 'match' (una partida terminada, ver `matchEvent`),
 *             'craft', 'merge', 'scrap' (el Taller y la mochila) o 'levelUp'
 *   `count`   cuánto avanza con ese evento; `distinct`, en vez de contar, la llave de lo
 *             que se junta sin repetir (niveles, Axies); `reset`, si el evento la vuelve
 *             a cero (una racha de victorias)
 *   `net`     solo en multijugador: sale si hay salas, y nunca dos el mismo día o semana
 *   `needs`   si se puede hacer con lo que tenés (ver `missionContext`)
 *   `text`    lo que dice
 */
const TASKS = [
  // ---- del día: fáciles ----
  { id: 'd-play', pool: 'easy', pays: 'axp', target: 2, on: 'match', count: () => 1, text: playText },
  { id: 'd-win', pool: 'easy', pays: 'ms', target: 1, on: 'match', count: (e) => +e.won, text: () => tr('Ganá una batalla') },
  { id: 'd-chain3', pool: 'easy', pays: 'axp', target: 1, value: 3, on: 'match', count: (e) => +(e.chain >= 3), text: chainText },
  { id: 'd-damage', pool: 'easy', pays: 'ms', target: 60, on: 'match', count: (e) => e.damage, text: damageText },
  { id: 'd-picks', pool: 'easy', pays: 'ms', target: 3, on: 'match', count: (e) => e.picks, text: picksText },
  { id: 'd-powers', pool: 'easy', pays: 'axp', target: 2, on: 'match', count: (e) => e.powerCards, text: powersText },
  { id: 'd-craft', pool: 'easy', pays: 'axp', target: 1, on: 'craft', count: (e) => e.n, needs: (c) => c.pulls >= 1, text: () => tr('Creá una carta en el Taller') },
  // ---- del día: medias ----
  { id: 'd-win2', pool: 'medium', pays: 'ms', target: 2, on: 'match', count: (e) => +e.won, text: winsText },
  { id: 'd-chain5', pool: 'medium', pays: 'axp', target: 1, value: 5, on: 'match', count: (e) => +(e.chain >= 5), text: chainText },
  { id: 'd-hit30', pool: 'medium', pays: 'ms', target: 1, value: 30, on: 'match', count: (e) => +(e.hit >= 30), text: hitText },
  { id: 'd-damage200', pool: 'medium', pays: 'axp', target: 200, on: 'match', count: (e) => e.damage, text: damageText },
  { id: 'd-adventure', pool: 'medium', pays: 'axp', target: 1, on: 'match', count: (e) => +(e.adventure && e.won), text: () => tr('Ganá un nivel de la Aventura') },
  { id: 'd-heal', pool: 'medium', pays: 'axp', target: 30, on: 'match', count: (e) => e.healed, text: healText },
  { id: 'd-stack', pool: 'medium', pays: 'ms', target: 2, on: 'match', count: (e) => e.stacks, text: stackText },
  { id: 'd-net', pool: 'medium', pays: 'ms', target: 1, net: true, on: 'match', count: (e) => +e.net, text: () => tr('Jugá una batalla multijugador') },
  // ---- del día: difíciles ----
  { id: 'd-win3', pool: 'hard', pays: 'ms', target: 3, on: 'match', count: (e) => +e.won, text: winsText },
  { id: 'd-ko', pool: 'hard', pays: 'ms', target: 1, on: 'match', count: (e) => +e.ko, text: () => tr('Ganá por K.O.') },
  { id: 'd-chain7', pool: 'hard', pays: 'axp', target: 1, value: 7, on: 'match', count: (e) => +(e.chain >= 7), text: chainText },
  { id: 'd-hit50', pool: 'hard', pays: 'axp', target: 1, value: 50, on: 'match', count: (e) => +(e.hit >= 50), text: hitText },
  { id: 'd-healthy', pool: 'hard', pays: 'axp', target: 1, value: 100, on: 'match', count: (e) => +(e.won && e.hp >= 100), text: (t) => tr('Ganá con {n} de vida o más', { n: t.value }) },
  { id: 'd-clean', pool: 'hard', pays: 'ms', target: 1, on: 'match', count: (e) => +(e.won && e.busts === 0), text: () => tr('Ganá sin cortarte') },
  { id: 'd-netwin', pool: 'hard', pays: 'ms', target: 1, net: true, on: 'match', count: (e) => +(e.net && e.won), text: () => tr('Ganá una batalla multijugador') },
  // ---- de la semana: pelea ----
  { id: 'w-play', pool: 'battle', pays: 'axp', target: 15, on: 'match', count: () => 1, text: playText },
  { id: 'w-win', pool: 'battle', pays: 'ms', target: 8, on: 'match', count: (e) => +e.won, text: winsText },
  { id: 'w-ko', pool: 'battle', pays: 'ms', target: 3, on: 'match', count: (e) => +e.ko, text: (t) => tr('Ganá {n} batallas por K.O.', { n: t.target }) },
  { id: 'w-damage', pool: 'battle', pays: 'axp', target: 1500, on: 'match', count: (e) => e.damage, text: damageText },
  { id: 'w-heal', pool: 'battle', pays: 'axp', target: 150, on: 'match', count: (e) => e.healed, text: healText },
  { id: 'w-chains', pool: 'battle', pays: 'axp', target: 10, value: 5, on: 'match', count: (e) => e.attacks.filter((l) => l >= 5).length, text: (t) => tr('Atacá {n} veces con una cadena de {v} o más', { n: t.target, v: t.value }) },
  { id: 'w-picks', pool: 'battle', pays: 'ms', target: 25, on: 'match', count: (e) => e.picks, text: picksText },
  { id: 'w-powers', pool: 'battle', pays: 'axp', target: 15, on: 'match', count: (e) => e.powerCards, text: powersText },
  { id: 'w-stack', pool: 'battle', pays: 'ms', target: 8, on: 'match', count: (e) => e.stacks, text: stackText },
  { id: 'w-net', pool: 'battle', pays: 'ms', target: 5, net: true, on: 'match', count: (e) => +e.net, text: (t) => tr('Jugá {n} batallas multijugador', { n: t.target }) },
  // ---- de la semana: la clase de la semana (ver `weekClass`) ----
  ...CANONICAL_CLASSES.flatMap((cls) => [
    { id: `k-win-${cls}`, pool: 'class', cls, pays: 'axp', target: 5, on: 'match', count: (e) => +(e.won && e.cls === cls), text: (t) => tr('Ganá {n} batallas con un Axie {cls}', { n: t.target, cls: missionClassName(cls) }) },
    { id: `k-draw-${cls}`, pool: 'class', cls, pays: 'ms', target: 10, on: 'match', count: (e) => e.powers[cls] ?? 0, text: (t) => tr('Robá {n} cartas con poder de {cls}', { n: t.target, cls: missionClassName(cls) }) },
    { id: `k-sig-${cls}`, pool: 'class', cls, pays: 'ms', on: 'match', ...CLASS_SIGNATURES[cls] },
  ]),
  // ---- de la semana: colección ----
  { id: 'w-craft', pool: 'collection', pays: 'axp', target: 10, on: 'craft', count: (e) => e.n, needs: (c) => c.pulls >= 10, text: (t) => tr('Creá {n} cartas en el Taller', { n: t.target }) },
  { id: 'w-fuse', pool: 'collection', pays: 'ms', target: 2, on: 'merge', count: (e) => e.n, needs: (c) => c.loose >= 6, text: (t) => tr('Fusioná {n} cartas', { n: t.target }) },
  { id: 'w-scrap', pool: 'collection', pays: 'axp', target: 5, on: 'scrap', count: (e) => e.n, needs: (c) => c.loose >= 5, text: (t) => tr('Reciclá {n} cartas', { n: t.target }) },
  { id: 'w-levels', pool: 'collection', pays: 'axp', target: 3, on: 'match', distinct: (e) => (e.adventure && e.won ? e.level : null), needs: (c) => c.levels >= 3, text: (t) => tr('Ganá {n} niveles distintos de la Aventura', { n: t.target }) },
  { id: 'w-advko', pool: 'collection', pays: 'ms', target: 2, on: 'match', count: (e) => +(e.adventure && e.ko), text: (t) => tr('Ganá {n} niveles de la Aventura por K.O.', { n: t.target }) },
  { id: 'w-levelup', pool: 'collection', pays: 'ms', target: 1, on: 'levelUp', count: (e) => e.n, text: () => tr('Subí de nivel a un Axie') },
  { id: 'w-axies', pool: 'collection', pays: 'axp', target: 3, on: 'match', distinct: (e) => (e.won ? e.axie : null), text: (t) => tr('Ganá con {n} Axies distintos', { n: t.target }) },
  { id: 'w-extras', pool: 'collection', pays: 'ms', target: 3, on: 'match', count: (e) => +(e.won && e.extras > 0), needs: (c) => c.bag >= 1, text: (t) => tr('Ganá {n} batallas con cartas de la mochila puestas', { n: t.target }) },
  // ---- de la semana: desafío ----
  { id: 'c-streak', pool: 'challenge', pays: 'ms', target: 3, on: 'match', count: (e) => +e.won, reset: (e) => !e.won, text: (t) => tr('Ganá {n} batallas seguidas', { n: t.target }) },
  { id: 'c-hit70', pool: 'challenge', pays: 'axp', target: 1, value: 70, on: 'match', count: (e) => +(e.hit >= 70), text: hitText },
  { id: 'c-chain9', pool: 'challenge', pays: 'axp', target: 1, value: 9, on: 'match', count: (e) => +(e.chain >= 9), text: chainText },
  { id: 'c-close', pool: 'challenge', pays: 'ms', target: 1, value: 20, on: 'match', count: (e) => +(e.won && e.hp <= 20), text: (t) => tr('Ganá con {n} de vida o menos', { n: t.value }) },
  { id: 'c-boss', pool: 'challenge', pays: 'axp', target: 1, on: 'match', count: (e) => +(e.adventure && e.won && e.boss), needs: (c) => c.boss, text: () => tr('Vencé a un jefe de la Aventura') },
  { id: 'c-onemore', pool: 'challenge', pays: 'ms', target: 1, on: 'match', count: (e) => e.oneMoreKo, text: () => tr('Hacé un K.O. con ¿UNA MÁS?') },
  { id: 'c-clean', pool: 'challenge', pays: 'axp', target: 3, on: 'match', count: (e) => +(e.won && e.busts === 0), text: (t) => tr('Ganá {n} batallas sin cortarte', { n: t.target }) },
  { id: 'c-netko', pool: 'challenge', pays: 'ms', target: 2, net: true, on: 'match', count: (e) => +(e.net && e.ko), text: (t) => tr('Ganá {n} batallas multijugador por K.O.', { n: t.target }) },
];

/** Las misiones por id. */
export const MISSIONS = Object.fromEntries(TASKS.map((t) => [t.id, t]));

/** La clase de pago de cada pozo (ver `MISSION_PAY`). */
const POOL_PAY = {
  easy: 'easy', medium: 'medium', hard: 'hard',
  battle: 'weekly', class: 'weekly', collection: 'weekly', challenge: 'challenge',
};

/** Lo que paga una misión al cumplirla: puntos, y Moonshards o AXP. */
export const taskPay = (task) => MISSION_PAY[POOL_PAY[task.pool]];

/** Lo que se cobra de una misión cumplida: `{ moonshards }` o `{ axp }`. */
export function taskReward(task) {
  const pay = taskPay(task);
  return task.pays === 'axp' ? { axp: pay.axp } : { moonshards: pay.ms };
}

/** Lo que dice una misión, en el idioma de ahora. */
export const taskText = (task) => task.text(task);

/** Si una misión guardada (`{ id, n }`) ya está cumplida. */
export const taskDone = (t) => t.n >= (MISSIONS[t.id]?.target ?? Infinity);

// ---------- el calendario ----------

/** El día de `now` en el reloj de esta máquina: días desde el 1/1/1970, a la medianoche local. */
export const dayIndex = (now = new Date()) =>
  Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / MISSION_DAY_MS);
/** La semana de un día, de lunes a domingo, contada desde la primera temporada. */
export const weekIndex = (day) => Math.floor((day - SEASON_EPOCH) / 7);
/** La temporada de un día: la primera es la 1 (antes de que arranque, también). */
export const seasonIndex = (day) => Math.max(1, Math.floor((day - SEASON_EPOCH) / SEASON_DAYS) + 1);
/** La clase de una semana: rota en el orden canónico, Planta primero. */
export const weekClass = (week) => CANONICAL_CLASSES[((week % 6) + 6) % 6];

/**
 * Lo que falta, en milisegundos, para que se renueven las del día (`day`), las de la
 * semana (`week`) y para que cierre la temporada (`season`).
 */
export function resetsIn(now = new Date()) {
  const day = dayIndex(now);
  const at = (days) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + days) - now;
  const into = (span) => (((day - SEASON_EPOCH) % span) + span) % span;
  return { day: at(1), week: at(7 - into(7)), season: at(SEASON_DAYS - into(SEASON_DAYS)) };
}

// ---------- el sorteo ----------

/** Si una misión puede salir con lo que tenés (ver `missionContext`). */
const taskFits = (task, ctx) => (!task.net || Boolean(ctx.net)) && (!task.needs || task.needs(ctx));

/**
 * Elige una misión por casillero. Cada pozo se baraja entero con el azar del día o de la
 * semana —así el orden no depende de lo que tenga cada uno— y queda la primera que se
 * pueda hacer, que no esté ya y que no haya salido la vez anterior (`avoid`). Nunca dos
 * de multijugador.
 */
function pickTasks(slots, rng, ctx, avoid, poolOf) {
  const out = [];
  let net = false;
  for (const slot of slots) {
    const order = shuffle(poolOf(slot), rng);
    const fits = (task, fresh) => !out.includes(task.id) && taskFits(task, ctx)
      && !(net && task.net) && (!fresh || !avoid.includes(task.id));
    const task = order.find((t) => fits(t, true)) ?? order.find((t) => fits(t, false)) ?? order[0];
    out.push(task.id);
    if (task.net) net = true;
  }
  return out;
}

const poolTasks = (pool) => TASKS.filter((t) => t.pool === pool);

/** Las tres del día `day`, sin repetir `avoid` (las del día anterior) si se puede. */
export function dailyPicks(day, ctx = {}, avoid = []) {
  return pickTasks(DAILY_POOLS, makeRng(day * 7919 + 17), ctx, avoid, poolTasks);
}

/** Las cinco de la semana `week`: la de clase es de `weekClass(week)`. */
export function weeklyPicks(week, ctx = {}, avoid = []) {
  const cls = weekClass(week);
  return pickTasks(WEEKLY_SLOTS, makeRng(week * 104729 + 29), ctx, avoid,
    (slot) => (slot === 'class' ? poolTasks('class').filter((t) => t.cls === cls) : poolTasks(slot)));
}

// ---------- el estado ----------

const freshTask = (id) => (MISSIONS[id].distinct ? { id, n: 0, seen: [], claimed: false } : { id, n: 0, claimed: false });

/** Sin nada: se sortea todo la primera vez que se renueva (ver `rollMissions`). */
export const freshMissions = () => ({
  day: null, daily: [], swaps: 0,
  week: null, weekly: [],
  prev: { daily: [], weekly: [] },
  net: false,
  pass: { season: null, points: 0, claimed: [], bonus: 0 },
});

const missionInt = (n) => Math.max(0, Math.floor(Number(n) || 0));
const missionDayOrNull = (n) => (Number.isInteger(n) ? n : null);

/** Una lista de misiones guardada, de esos pozos y de a lo sumo `max`; `null` si no sirve. */
function cleanTasks(raw, pools, max) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > max) return null;
  const out = [];
  for (const t of raw) {
    const task = MISSIONS[t?.id];
    if (!task || !pools.includes(task.pool) || out.some((x) => x.id === task.id)) return null;
    const clean = { id: task.id, n: Math.min(task.target, missionInt(t.n)), claimed: t.claimed === true };
    if (task.distinct) {
      const seen = Array.isArray(t.seen)
        ? [...new Set(t.seen.filter((k) => typeof k === 'string' || Number.isInteger(k)))].slice(0, task.target)
        : [];
      clean.seen = seen;
      clean.n = seen.length;
    }
    if (clean.claimed && clean.n < task.target) clean.claimed = false;
    out.push(clean);
  }
  return out;
}

const cleanIds = (raw) => (Array.isArray(raw) ? raw.filter((id) => typeof id === 'string' && MISSIONS[id]) : []);

/**
 * Lo que vale como estado de las misiones. Una lista rota se descarta entera con su día
 * (o su semana), y se vuelve a sortear: es mejor que una misión que no existe.
 */
export function cleanMissions(raw) {
  const s = freshMissions();
  if (!raw || typeof raw !== 'object') return s;
  const daily = cleanTasks(raw.daily, DAILY_POOLS, DAILY_POOLS.length);
  if (daily && missionDayOrNull(raw.day) !== null) {
    s.day = raw.day;
    s.daily = daily;
    s.swaps = Math.min(DAILY_SWAPS, missionInt(raw.swaps));
  }
  const weekly = cleanTasks(raw.weekly, [...new Set(WEEKLY_SLOTS)], WEEKLY_SLOTS.length);
  if (weekly && missionDayOrNull(raw.week) !== null) {
    s.week = raw.week;
    s.weekly = weekly;
  }
  s.prev = { daily: cleanIds(raw.prev?.daily), weekly: cleanIds(raw.prev?.weekly) };
  s.net = raw.net === true;
  const pass = raw.pass;
  if (pass && typeof pass === 'object' && Number.isInteger(pass.season) && pass.season >= 1) {
    s.pass = {
      season: pass.season,
      points: missionInt(pass.points),
      claimed: Array.isArray(pass.claimed)
        ? [...new Set(pass.claimed.filter((n) => Number.isInteger(n) && n >= 1 && n <= PASS_TIERS))].sort((a, b) => a - b)
        : [],
      bonus: missionInt(pass.bonus),
    };
  }
  return s;
}

// ---------- el pase ----------

/** Los escalones alcanzados con tantos puntos. */
export const passTier = (points) => Math.min(PASS_TIERS, Math.floor(points / TIER_POINTS));
/** Las llaves de más ganadas pasado el último escalón. */
export const passBonusEarned = (points) =>
  Math.floor(Math.max(0, points - PASS_TIERS * TIER_POINTS) / PASS_BONUS_POINTS);

/**
 * Lo que da el escalón `tier` (1 a 40). Va por decenas, que suben de a poco:
 *
 *   impares        una llave (el 1, dos)
 *   pares          Moonshards: 10, 15, 20 y 25 según la decena
 *   5, 15, 25, 35  tres llaves
 *   10, 20, 30     cinco llaves y 40 Moonshards
 *   40             la llave de oro, la única del pase, y 100 Moonshards
 */
export function tierReward(tier) {
  if (tier === PASS_TIERS) return { gold: 1, moonshards: 100 };
  if (tier % 10 === 0) return { basic: 5, moonshards: 40 };
  if (tier % 5 === 0) return { basic: 3 };
  if (tier % 2 === 1) return { basic: tier === 1 ? 2 : 1 };
  return { moonshards: 10 + 5 * Math.floor((tier - 1) / 10) };
}

/** Lo que queda sin cobrar del pase: los escalones alcanzados y las llaves de más. */
function passDue(pass) {
  const due = [];
  for (let tier = 1; tier <= passTier(pass.points); tier++) {
    if (!pass.claimed.includes(tier)) due.push(tierReward(tier));
  }
  const bonus = passBonusEarned(pass.points) - pass.bonus;
  if (bonus > 0) due.push({ basic: bonus });
  return due;
}

// ---------- renovar, contar, cobrar ----------

/**
 * Renueva lo que toque a la hora `now`: las del día, las de la semana y la temporada.
 * Devuelve el estado nuevo y lo que se pagaba de lo que se va (`due`, una lista de
 * recompensas): las misiones cumplidas sin cobrar y los escalones del pase alcanzados.
 * `ctx` dice qué misiones pueden salir (ver `missionContext`).
 */
export function rollMissions(state, now = new Date(), ctx = {}) {
  const day = dayIndex(now);
  const week = weekIndex(day);
  const season = seasonIndex(day);
  let s = state;
  const due = [];
  const unpaid = (list) => list.filter((t) => taskDone(t) && !t.claimed).map((t) => taskReward(MISSIONS[t.id]));
  if (s.day !== day) {
    due.push(...unpaid(s.daily));
    const last = s.daily.length ? s.daily.map((t) => t.id) : s.prev.daily;
    s = { ...s, day, daily: dailyPicks(day, ctx, last).map(freshTask), swaps: 0, prev: { ...s.prev, daily: last } };
  }
  if (s.week !== week) {
    due.push(...unpaid(s.weekly));
    const last = s.weekly.length ? s.weekly.map((t) => t.id) : s.prev.weekly;
    s = { ...s, week, weekly: weeklyPicks(week, ctx, last).map(freshTask), prev: { ...s.prev, weekly: last } };
  }
  if (s.pass.season !== season) {
    if (s.pass.season !== null) due.push(...passDue(s.pass));
    s = { ...s, pass: { season, points: 0, claimed: [], bonus: 0 } };
  }
  return { state: s, due };
}

/**
 * Cuenta un evento en las misiones del día y de la semana. Las que se cumplen suman sus
 * puntos al pase en el acto. Devuelve el estado nuevo y las cumplidas recién (`done`:
 * `{ scope, index, id }`).
 *
 * Los eventos son una partida terminada (ver `matchEvent`), `{ type: 'craft', n }`,
 * `{ type: 'merge', n }`, `{ type: 'scrap', n }` y `{ type: 'levelUp', n }`.
 */
export function trackMissions(state, event) {
  if (!event?.type) return { state, done: [] };
  let points = 0;
  const done = [];
  const step = (list, scope) => list.map((t, index) => {
    const task = MISSIONS[t.id];
    if (!task || task.on !== event.type || taskDone(t)) return t;
    let next = task.reset?.(event) ? { ...t, n: 0 } : t;
    if (task.distinct) {
      const key = task.distinct(event);
      const seen = key === null || key === undefined || next.seen.includes(key) ? next.seen : [...next.seen, key];
      next = { ...next, seen, n: Math.min(task.target, seen.length) };
    } else {
      next = { ...next, n: Math.min(task.target, next.n + missionInt(task.count(event))) };
    }
    if (taskDone(next)) {
      points += taskPay(task).points;
      done.push({ scope, index, id: t.id });
    }
    return next;
  });
  const daily = step(state.daily, 'daily');
  const weekly = step(state.weekly, 'weekly');
  return {
    state: { ...state, daily, weekly, pass: { ...state.pass, points: state.pass.points + points } },
    done,
  };
}

/** Cobra una misión cumplida: `scope` es 'daily' o 'weekly'. `reward` es `null` si no se podía. */
export function claimTask(state, scope, index) {
  const list = scope === 'daily' || scope === 'weekly' ? state[scope] : null;
  const t = list?.[index];
  if (!t || t.claimed || !taskDone(t)) return { state, reward: null };
  return {
    state: { ...state, [scope]: list.map((x, i) => (i === index ? { ...x, claimed: true } : x)) },
    reward: taskReward(MISSIONS[t.id]),
  };
}

/** Cobra un escalón alcanzado del pase. `reward` es `null` si no se podía. */
export function claimTier(state, tier) {
  const { pass } = state;
  if (!Number.isInteger(tier) || tier < 1 || tier > passTier(pass.points) || pass.claimed.includes(tier)) {
    return { state, reward: null };
  }
  return {
    state: { ...state, pass: { ...pass, claimed: [...pass.claimed, tier].sort((a, b) => a - b) } },
    reward: tierReward(tier),
  };
}

/** Cobra las llaves de más que haya pasado el último escalón. */
export function claimBonus(state) {
  const { pass } = state;
  const left = passBonusEarned(pass.points) - pass.bonus;
  if (left <= 0) return { state, reward: null };
  return { state: { ...state, pass: { ...pass, bonus: pass.bonus + left } }, reward: { basic: left } };
}

/**
 * Cambia la misión del día `index` por otra del mismo pozo, una vez por día y solo si no
 * está cumplida (lo avanzado se pierde). `swapped` dice si se pudo.
 */
export function swapTask(state, index, ctx = {}) {
  const t = state.daily[index];
  if (!t || state.swaps >= DAILY_SWAPS || taskDone(t)) return { state, swapped: false };
  const pool = MISSIONS[t.id].pool;
  const taken = state.daily.map((x) => x.id);
  const net = state.daily.some((x, i) => i !== index && MISSIONS[x.id].net);
  const order = shuffle(poolTasks(pool), makeRng(state.day * 7919 + 101 * (index + 1) + state.swaps));
  const fits = (task, fresh) => !taken.includes(task.id) && taskFits(task, ctx)
    && !(net && task.net) && (!fresh || !state.prev.daily.includes(task.id));
  const pick = order.find((x) => fits(x, true)) ?? order.find((x) => fits(x, false));
  if (!pick) return { state, swapped: false };
  return {
    state: {
      ...state,
      daily: state.daily.map((x, i) => (i === index ? freshTask(pick.id) : x)),
      swaps: state.swaps + 1,
    },
    swapped: true,
  };
}

/** Varias recompensas en una: `{ moonshards?, axp?, basic?, gold? }`. */
export function sumRewards(list) {
  const out = {};
  for (const reward of list) {
    for (const [k, v] of Object.entries(reward ?? {})) out[k] = (out[k] ?? 0) + missionInt(v);
  }
  return out;
}

/**
 * Paga una recompensa: los Moonshards y las llaves a la bolsa, la AXP a `axie` (con lo
 * que paga cada nivel que sube, ver `gainAxp`). Devuelve la bolsa y el progreso nuevos y
 * los niveles a los que llegó. Sin un Axie del roster la AXP no va a ningún lado.
 */
export function payReward(wallet, progress, axie, reward) {
  let next = {
    ...wallet,
    moonshards: wallet.moonshards + missionInt(reward.moonshards),
    keys: Object.fromEntries(KEY_KINDS.map((k) => [k, (wallet.keys?.[k] ?? 0) + missionInt(reward[k])])),
  };
  if (!missionInt(reward.axp) || !AXIES[axie]) return { wallet: next, progress, levels: [] };
  const gained = gainAxp(progress, next, axie, reward.axp);
  return { wallet: gained.wallet, progress: gained.progress, levels: gained.levels };
}

// ---------- la partida ----------

/**
 * Lo que una partida terminada le cuenta a las misiones del asiento `seat`, o `null` si
 * no cuenta: sin terminar, sin asiento (el que mira una sala), el tutorial, o un
 * abandono antes de `FORFEIT_PAY_ROUND`. Todo lo que trae se limpia: en una sala el
 * estado llega del anfitrión.
 */
export function matchEvent(state, seat = 'p1') {
  const result = matchResult(state);
  if (!result || !PLAYERS.includes(seat) || state.mode === 'tutorial') return null;
  if (state.forfeit && state.round < FORFEIT_PAY_ROUND) return null;
  const won = result === seat;
  const stats = state.stats?.[seat] ?? {};
  const records = state.records?.[seat] ?? {};
  const powers = Object.fromEntries(CANONICAL_CLASSES.map((c) => [c, missionInt(stats.powers?.[c])]));
  const id = String(state.axies?.[seat] ?? '').split('~')[0];
  const axie = AXIES[id] ? id : null;
  return {
    type: 'match',
    mode: state.mode,
    net: state.mode === 'net',
    adventure: state.mode === 'adventure',
    won,
    ko: won && wonByKo(state),
    tie: result === 'tie',
    hp: missionInt(hpOf(state, seat)),
    damage: missionInt(state.totals?.[seat]),
    healed: missionInt(state.healed?.[seat]),
    chain: missionInt(records.chain),
    hit: missionInt(records.hit),
    attacks: Array.isArray(stats.attacks) ? stats.attacks.map(missionInt) : [],
    busts: missionInt(stats.busts),
    powers,
    powerCards: Object.values(powers).reduce((t, n) => t + n, 0),
    picks: missionInt(stats.picks),
    stacks: missionInt(stats.stacks),
    oneMoreKo: missionInt(stats.oneMoreKo),
    bleed: missionInt(stats.bleed),
    poison: missionInt(stats.poison),
    thorns: missionInt(stats.thorns),
    direct: missionInt(stats.direct),
    stolen: missionInt(stats.stolen),
    axie,
    cls: axie ? AXIES[axie].class : null,
    level: state.mode === 'adventure' ? missionInt(state.adventure?.level) || null : null,
    boss: Boolean(state.adventure?.boss),
    extras: Array.isArray(state.extras?.[seat]) ? state.extras[seat].length : 0,
  };
}

// ---------- lo guardado ----------

/**
 * Lo que dice qué misiones pueden salir: si hay salas (`net`), hasta qué nivel de la
 * Aventura llegaste y si alguno es de jefe, las cartas de la mochila (todas y sueltas) y
 * cuántas cartas podrías crear con tus Moonshards y tus llaves (`pulls`).
 */
export function missionContext(net = false) {
  const wallet = readWallet();
  const bag = readBackpack();
  const adventure = getAdventureProgress();
  return {
    net: Boolean(net),
    levels: adventure.unlockedLevel,
    boss: ADVENTURE_LEVELS.some((l) => l.boss && l.id <= adventure.unlockedLevel),
    bag: bag.items.length,
    loose: looseCards(bag).length,
    pulls: Math.floor(wallet.moonshards / CRAFT_COST) + KEY_KINDS.reduce((t, k) => t + wallet.keys[k], 0),
  };
}

export function readMissions() {
  try {
    return cleanMissions(JSON.parse(store()?.getItem(MISSIONS_KEY) ?? 'null'));
  } catch {
    return freshMissions();
  }
}

export function writeMissions(state) {
  try { store()?.setItem(MISSIONS_KEY, JSON.stringify(cleanMissions(state))); } catch { /* sin almacenamiento, dura la página */ }
}

/** El Axie que cobra la AXP: el que tenés elegido. */
const missionPayee = () => readLoadout()?.axie ?? null;

/**
 * Paga una lista de recompensas a la bolsa y a `axie`, y lo guarda. Devuelve lo pagado
 * junto y los niveles que subió el Axie.
 */
function payOut(rewards, axie) {
  const reward = sumRewards(rewards);
  if (!Object.values(reward).some((n) => n > 0)) return { reward, levels: [] };
  const paid = payReward(readWallet(), readProgress(), axie, reward);
  writeWallet(paid.wallet);
  if (paid.levels.length || reward.axp) writeProgress(paid.progress);
  return { reward, levels: paid.levels };
}

/**
 * Lo guardado, al día: renueva lo que toque, paga lo que se iba sin cobrar y lo guarda.
 * Con `net` anota si hay salas (lo sabe la portada, ver `netAvailable`). La AXP de lo
 * que se paga solo va a `axie` (el elegido, si no se dice). Devuelve el estado y lo que
 * se pagó solo (`due`).
 */
export function refreshMissions({ now = new Date(), net, axie = missionPayee() } = {}) {
  let state = readMissions();
  if (typeof net === 'boolean') state = { ...state, net };
  const rolled = rollMissions(state, now, missionContext(state.net));
  const paid = payOut(rolled.due, axie);
  state = rolled.state;
  if (paid.levels.length) state = trackMissions(state, { type: 'levelUp', n: paid.levels.length }).state;
  writeMissions(state);
  return { state, due: paid.reward };
}

/** Cuenta uno o varios eventos (ver `trackMissions`) y lo guarda. */
export function recordMissions(events, { now = new Date() } = {}) {
  let { state } = refreshMissions({ now });
  const done = [];
  for (const event of [events].flat()) {
    const out = trackMissions(state, event);
    state = out.state;
    done.push(...out.done);
  }
  writeMissions(state);
  return { state, done };
}

/**
 * Cuenta una partida terminada para el asiento `seat` (ver `matchEvent`), y los niveles
 * que subió su Axie con el botín (`levels`, ver `claimPayout`). `null` si no cuenta.
 */
export function recordMatch(gameState, { seat = 'p1', levels = 0, now } = {}) {
  const event = matchEvent(gameState, seat);
  if (!event) return null;
  return recordMissions([event, levels > 0 ? { type: 'levelUp', n: levels } : null], { now });
}

/**
 * Cobra la misión `index` del día o de la semana (`scope`): paga y lo guarda. La AXP va a
 * `axie` (el elegido, si no se dice). Devuelve lo cobrado, los niveles que subió y las
 * misiones que eso cumplió, o `null` si no se podía (sin cumplir, ya cobrada, o AXP sin
 * Axie a quien dársela).
 */
export function claimMission(scope, index, { axie = missionPayee(), now } = {}) {
  let { state } = refreshMissions({ now, axie });
  const out = claimTask(state, scope, index);
  if (!out.reward || (out.reward.axp && !AXIES[axie])) return null;
  state = out.state;
  const paid = payOut([out.reward], axie);
  let done = [];
  if (paid.levels.length) ({ state, done } = trackMissions(state, { type: 'levelUp', n: paid.levels.length }));
  writeMissions(state);
  return { reward: out.reward, axie: out.reward.axp ? axie : null, levels: paid.levels, done, state };
}

/** Cobra el escalón `tier` del pase. `null` si no se podía. */
export function claimPassTier(tier, { now } = {}) {
  let { state } = refreshMissions({ now });
  const out = claimTier(state, tier);
  if (!out.reward) return null;
  state = out.state;
  payOut([out.reward], null);
  writeMissions(state);
  return { reward: out.reward, state };
}

/** Cobra las llaves de más del pase. `null` si no hay. */
export function claimPassBonus({ now } = {}) {
  let { state } = refreshMissions({ now });
  const out = claimBonus(state);
  if (!out.reward) return null;
  state = out.state;
  payOut([out.reward], null);
  writeMissions(state);
  return { reward: out.reward, state };
}

/** Cambia la misión del día `index` por otra (ver `swapTask`). `null` si no se podía. */
export function swapMission(index, { now } = {}) {
  const { state } = refreshMissions({ now });
  const out = swapTask(state, index, missionContext(state.net));
  if (!out.swapped) return null;
  writeMissions(out.state);
  return { state: out.state };
}
