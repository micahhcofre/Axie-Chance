// Modo Aventura: progresión con niveles (cada batalla es un nivel).
//
// Los poderes se estrenan de a poco hasta el nivel 175 (`UNLOCK_ORDER`, `UNLOCK_LEVELS`):
// primero los doce amuletos neutrales, después los treinta de clase. Cada nivel pelea
// con una combinación **fija y única** de los ya desbloqueados (`levelPowers`): el que
// estrena entra siempre, el resto rota por el que hace más que no sale, y nunca dos
// niveles iguales. El mismo nivel se juega siempre con los mismos poderes.
//
// El rival crece por una escalera (`RIVAL_LADDER`): primero cartas de mochila de su
// clase, que después se fusionan en rarezas más altas, y partes evolucionadas. La regla
// es que nunca traiga algo que el jugador no pueda tener a esa altura del mapa.

import { store, FREE_PLAY } from './loadout.js';
import { POWERS, SYMBOL_IDS, EXTRA_SLOTS, NEUTRAL_POWERS, cleanExtra, makeRng } from './data.js';
import { RIVALS, rivalId } from './axies.js';
import { CRAFT_TIERS } from './crafting.js';
import { isStage } from './stages.js';
import { ADVENTURE_CAMPAIGN, ADVENTURE_CHAPTERS } from './adventure-levels.js';
import { tr } from './i18n.js';

export const ADVENTURE_KEY = 'axie-chance:adventure';

/**
 * La escalera del rival: lo que trae de más a medida que avanza la campaña, de lo más
 * fácil de conseguir para un jugador a lo más difícil. Cada escalón dice desde qué
 * nivel rige y qué cambia; lo que no dice sigue como en el anterior.
 *
 *   `extras`   la rareza de cada carta de su mochila (las de `CRAFT_TIERS`), hasta
 *              `EXTRA_SLOTS`, el mismo tope que el tuyo. Una común es un símbolo de su
 *              clase, lo más barato del Taller; las demás son esa misma carta fusionada
 *              (ver `rivalExtras`).
 *   `evolved`  cuántas partes trae evolucionadas, en el orden de su `evolve`: los
 *              híbridos evolucionan primero las partes de otra clase.
 *
 * El jugador arranca con el paquete de bienvenida (tres poco comunes, dos raras y un
 * Rocket), su primera evolución le llega cerca del nivel 30, la segunda del 65, la
 * tercera del 115 y la cuarta del 165, y sus primeras épicas (la que asegura el Taller
 * cada 50 cartas) pasado el 80: el rival va detrás (ver `EXPECTED` en
 * `scripts/balance.mjs`). Un jefe pelea un escalón más arriba que su nivel (ver
 * `rivalKitAt`), y el último, con lo del 200.
 */
export const RIVAL_LADDER = [
  // Lo fácil (1–60): comunes de su clase, que se fusionan, y la primera evolución.
  { from: 1, extras: [], evolved: 0 },
  { from: 3, extras: ['common'] },
  { from: 7, extras: ['common', 'common'] },
  { from: 13, extras: ['common', 'common', 'common'] },
  { from: 17, extras: ['common', 'common', 'common', 'common'] },
  { from: 23, extras: ['uncommon', 'common', 'common', 'common'] },
  { from: 27, extras: ['uncommon', 'uncommon', 'common', 'common'] },
  { from: 31, evolved: 1 },
  { from: 35, extras: ['uncommon', 'uncommon', 'uncommon', 'common'] },
  { from: 39, extras: ['uncommon', 'uncommon', 'uncommon', 'uncommon'] },
  { from: 43, extras: ['rare', 'uncommon', 'uncommon', 'uncommon'] },
  { from: 47, extras: ['rare', 'rare', 'uncommon', 'uncommon'] },
  { from: 51, extras: ['rare', 'rare', 'rare', 'uncommon'] },
  // Lo medio (61–130): las raras, la segunda y la tercera evolución, y las primeras
  // épicas (una carta con un poder de su clase, como la que da el Taller cada 50).
  { from: 61, extras: ['rare', 'rare', 'rare', 'rare'] },
  { from: 71, evolved: 2 },
  { from: 81, extras: ['epic', 'rare', 'rare', 'rare'] },
  { from: 101, extras: ['epic', 'epic', 'rare', 'rare'] },
  { from: 121, evolved: 3 },
  // Lo difícil (131–200): épicas, la cuarta evolución, legendarias al final y, para el
  // último jefe, una mítica y casi todo evolucionado.
  { from: 131, extras: ['epic', 'epic', 'epic', 'rare'] },
  { from: 141, extras: ['epic', 'epic', 'epic', 'epic'] },
  { from: 161, evolved: 4 },
  { from: 171, extras: ['legendary', 'epic', 'epic', 'epic'] },
  { from: 181, extras: ['legendary', 'legendary', 'epic', 'epic'] },
  { from: 191, extras: ['legendary', 'legendary', 'legendary', 'epic'] },
  { from: 200, extras: ['mythic', 'legendary', 'legendary', 'legendary'], evolved: 6 },
];

/**
 * La vida de los rivales comunes a lo largo de la campaña (los jefes dicen la suya, `hp`).
 * Es lo que hace que la curva vaya de menos a más: la escalera le da al rival lo mismo
 * que va juntando el jugador, así que sin esto cada tramo se siente igual que el anterior
 * (medido con `npm run balance -- --adventure`: el rival ganaba ~55% de punta a punta).
 * La vida, en cambio, mueve: +40 son unos 12 puntos. En el Bosque Nevado arranca más baja
 * que la tuya para suavizar el paso de la CPU fácil a la normal.
 */
export const RIVAL_HP = [
  { from: 1, hp: 150 },
  { from: 21, hp: 130 },
  { from: 31, hp: 140 },
  { from: 41, hp: 150 },
  { from: 61, hp: 160 },
  { from: 81, hp: 165 },
  { from: 101, hp: 170 },
  { from: 121, hp: 175 },
  { from: 131, hp: 180 },
  { from: 161, hp: 190 },
];

/** La vida del rival común del nivel `id` (ver `RIVAL_HP`). */
export const rivalHpAt = (id) => RIVAL_HP.findLast((step) => step.from <= id).hp;

/** Los escalones con todo lo que rige en cada uno, ya acumulado. */
const LADDER = RIVAL_LADDER.reduce((out, step) => {
  out.push({ ...(out.at(-1) ?? {}), ...step });
  return out;
}, []);

/**
 * Lo que trae el rival del nivel `id` según la escalera: `{ extras, evolved }`, con
 * `extras` como rarezas. Un jefe (`boss`) pelea con el escalón siguiente al de su nivel.
 */
export function rivalKitAt(id, { boss = false } = {}) {
  let at = LADDER.findLastIndex((step) => step.from <= id);
  if (boss) at = Math.min(LADDER.length - 1, at + 1);
  const { extras, evolved } = LADDER[Math.max(0, at)];
  return { extras: [...extras], evolved };
}

/** Cuántas partes evolucionadas trae el rival del nivel `id` (ver `RIVAL_LADDER`). */
export const evolvedAt = (id, opts) => rivalKitAt(id, opts).evolved;

/**
 * Los poderes que no van en la mochila del rival. Con Secret Egg la CPU casi no se corta
 * —cada huevo le perdona un corte y arriesga sabiéndolo— y la pelea deja de ser pareja:
 * medido, un rival con dos huevos en la mochila ganaba ~87% donde sus vecinos ganaban
 * ~65%, y un jefe que los sumaba en sus amuletos, 92%.
 */
export const RIVAL_NO_POWER = new Set(['egg']);

/**
 * Las cartas de mochila del rival de un nivel, hechas a partir de sus rarezas. La común
 * es un símbolo de su clase; de ahí para arriba es la misma carta fusionada (ver
 * `mergeResult` en `crafting.js`): cada rareza sin poder suma un símbolo al azar, y las
 * de poder llevan uno de su clase, de los ya desbloqueados. El azar sale del número de
 * nivel: el mismo nivel trae siempre las mismas cartas, y el panel puede mostrarlas
 * antes de pelear.
 *
 * El símbolo que suma es de otra clase y no se repite en la carta. Tu fusión puede darte
 * dos de tu clase en una carta (avanza la racha de a dos), pero es la excepción: el
 * rival trae la carta de siempre, no la de la suerte. Con repetidos, los rivales que
 * tuvieron suerte en el sorteo saltaban 10 puntos sobre sus vecinos en el banco.
 */
export function rivalExtras(tiers, { id, cls, unlocked = [] }) {
  const rng = makeRng(0xad7e0 + id * 131);
  // Un poder de su clase; si todavía no se estrenó ninguno, cualquiera de los abiertos.
  const own = unlocked.filter((p) => POWERS[p]?.symbol === cls && !RIVAL_NO_POWER.has(p));
  const powers = own.length ? own : unlocked.filter((p) => POWERS[p] && !RIVAL_NO_POWER.has(p));
  return tiers.map((tierId) => {
    const tier = CRAFT_TIERS.find((t) => t.id === tierId);
    if (!tier) throw new Error(`Nivel ${id}: rareza inexistente "${tierId}" en la escalera del rival.`);
    const symbols = [cls];
    while (symbols.length < tier.symbols) {
      const others = SYMBOL_IDS.filter((s) => !symbols.includes(s));
      symbols.push(others[Math.floor(rng() * others.length)]);
    }
    if (tier.power && !powers.length) {
      throw new Error(`Nivel ${id}: el rival necesita un poder para su carta ${tierId}, y no hay ninguno desbloqueado.`);
    }
    const power = tier.power ? powers[Math.floor(rng() * powers.length)] : null;
    return cleanExtra({ symbols, power });
  });
}

/**
 * El orden en que se estrenan los poderes: los doce neutrales (de lo más simple a lo que
 * pide pensar) y después los treinta de clase, de a uno por clase en cada vuelta.
 */
export const UNLOCK_ORDER = [
  ...NEUTRAL_POWERS,
  'pot', 'feather', 'razor', 'leech', 'poison', 'octopus',
  'egg', 'bubble', 'leaf', 'snail', 'steelskin', 'strength',
  'guard', 'maker', 'dagger', 'scanner', 'edge', 'shuriken',
  'fan', 'sage', 'jellyfish', 'brutal', 'gloves', 'cocoon',
  'hammer', 'pillow', 'redbubble', 'rage', 'trickster', 'viper',
];

/** Cuántos poderes trae abiertos el nivel 1: con menos, los primeros niveles se repetirían. */
const OPENING = 3;
/** Cada cuántos niveles estrena un neutral, y hasta qué nivel siguen los de clase. */
const NEUTRAL_STEP = 3;
export const LAST_UNLOCK = 175;

/**
 * El nivel en que se estrena cada poder de `UNLOCK_ORDER`: tres en el 1, los otros
 * neutrales cada tres niveles, y los de clase repartidos parejo hasta el `LAST_UNLOCK`.
 */
export const UNLOCK_LEVELS = (() => {
  const neutrals = NEUTRAL_POWERS.length;
  const lastNeutral = 1 + (neutrals - OPENING) * NEUTRAL_STEP;
  const classes = UNLOCK_ORDER.length - neutrals;
  return Object.fromEntries(UNLOCK_ORDER.map((p, i) => [p,
    i < OPENING ? 1
      : i < neutrals ? 1 + (i - OPENING + 1) * NEUTRAL_STEP
        : Math.round(lastNeutral + ((i - neutrals + 1) * (LAST_UNLOCK - lastNeutral)) / classes)]));
})();

/** Los poderes que estrena el nivel `id`, en el orden de `UNLOCK_ORDER`. */
export const unlocksAt = (id) => UNLOCK_ORDER.filter((p) => UNLOCK_LEVELS[p] === id);

/** Cuántos poderes pelea cada nivel (más el Rocket, que está siempre). */
export const LEVEL_POWERS = 6;

/**
 * La combinación fija de poderes de cada nivel, en orden. Un poder por clase y hasta
 * `LEVEL_POWERS` en total; el que estrena entra siempre y el resto son los que hace más
 * que no salen (a igual espera, el más viejo). Si esa combinación ya la tuvo otro nivel,
 * se cambia uno —el que menos rota—, después dos, y si no alcanza se pelea con uno menos:
 * nunca hay dos niveles con los mismos poderes. Es puro: el mismo calendario da siempre
 * las mismas combinaciones.
 *
 * @param {string[][]} unlockedAt  los desbloqueados en cada nivel (índice 0 = nivel 1)
 * @param {string[][]} freshAt     los que estrena cada nivel
 * @returns {string[][]}
 */
export function levelPowers(unlockedAt, freshAt) {
  const lastSeen = {};
  const used = new Set();
  const sig = (set) => set.slice().sort().join('+');
  const fits = (set) => {
    const classes = set.map((p) => POWERS[p].symbol).filter(Boolean);
    return new Set(classes).size === classes.length;
  };
  return unlockedAt.map((unlocked, i) => {
    const id = i + 1;
    const fresh = freshAt[i].filter((p) => unlocked.includes(p));
    // Del que más espera al que menos; a igual espera, el que se estrenó antes.
    const rest = unlocked.filter((p) => !fresh.includes(p))
      .map((p, at) => ({ p, at, wait: id - (lastSeen[p] ?? -1000) }))
      .sort((a, b) => b.wait - a.wait || a.at - b.at)
      .map((x) => x.p);
    const pickFrom = (list, size) => {
      const out = [...fresh];
      for (const p of list) {
        if (out.length >= size) break;
        if (fits([...out, p])) out.push(p);
      }
      return out;
    };
    let chosen = null;
    for (let size = Math.min(LEVEL_POWERS, unlocked.length); size >= 1 && !chosen; size--) {
      const base = pickFrom(rest, size);
      if (base.length < size) continue;
      if (!used.has(sig(base))) { chosen = base; break; }
      // Cambiar uno (del final, el que menos espera) por otro de afuera; después dos.
      const outside = rest.filter((p) => !base.includes(p));
      const swappable = base.filter((p) => !fresh.includes(p)).reverse();
      for (const drop of swappable) {
        for (const add of outside) {
          const set = base.filter((p) => p !== drop).concat(add);
          if (fits(set) && !used.has(sig(set))) { chosen = set; break; }
        }
        if (chosen) break;
      }
      for (let a = 0; a < swappable.length && !chosen; a++) {
        for (let b = a + 1; b < swappable.length && !chosen; b++) {
          for (let x = 0; x < outside.length && !chosen; x++) {
            for (let y = x + 1; y < outside.length && !chosen; y++) {
              const set = base.filter((p) => p !== swappable[a] && p !== swappable[b]).concat(outside[x], outside[y]);
              if (fits(set) && !used.has(sig(set))) chosen = set;
            }
          }
        }
      }
    }
    if (!chosen) throw new Error(`Nivel ${id}: no queda una combinación de poderes que no haya salido antes.`);
    used.add(sig(chosen));
    for (const p of chosen) lastSeen[p] = id;
    // En el orden de estreno: la lista se lee igual en todos los niveles.
    return chosen.sort((a, b) => UNLOCK_ORDER.indexOf(a) - UNLOCK_ORDER.indexOf(b));
  });
}

/** Etiquetas legibles de dificultad para la UI y la ficha del nivel. */
export const DIFFICULTY_LABELS = {
  facil: tr('Fácil'),
  normal: tr('Normal'),
  duro: tr('Dura'),
};

/**
 * Valida una campaña y deriva las propiedades calculadas de cada nivel:
 * - `id`: posición 1-based en el array.
 * - `newPowers`: los que estrena, los del calendario (`unlocksAt`) si el nivel no dice.
 * - `unlocked`: los poderes desbloqueados hasta este nivel inclusive, en orden.
 * - `activePowers`: la combinación fija con que se pelea (ver `levelPowers`), o la que
 *   declare el nivel.
 * - `evolved`: cuántas partes trae evolucionadas el rival (ver `RIVAL_LADDER`).
 * - `rival`: el id completo del rival, con sus evoluciones (`'lobo+2'`); el que
 *   declara la campaña queda en `base`.
 * - `boss`: si el rival es un jefe.
 * - `extras`: las cartas de mochila del rival (`{ symbols, power }`, ver `rivalExtras`).
 * - `charmPowers`: los poderes de las partes con amuleto de un jefe, en orden (ver
 *   `adventureCharms`). Si el nivel no dice, los de su combinación.
 *
 * Si algún campo es inválido (poder inexistente o repetido, rival inexistente,
 * dificultad desconocida, dos poderes de una clase) lanza un Error descriptivo.
 *
 * @param {Array<object>} campaign
 * @returns {Array<object>}
 */
export function buildAdventureLevels(campaign = ADVENTURE_CAMPAIGN) {
  if (!Array.isArray(campaign)) {
    throw new Error('La campaña de aventura debe ser un array de niveles.');
  }

  const validDifficulties = new Set(['facil', 'normal', 'duro']);
  const unlocked = [];

  const levels = campaign.map((rawLevel, index) => {
    const id = index + 1;
    if (!rawLevel || typeof rawLevel !== 'object') {
      throw new Error(`Nivel ${id}: la definición del nivel debe ser un objeto.`);
    }

    const {
      name, description, rival, difficulty, newPowers = unlocksAt(id), stage,
      showcase, activePowers: explicitActive, hp,
    } = rawLevel;

    if (!name || typeof name !== 'string') {
      throw new Error(`Nivel ${id}: nombre inválido o ausente.`);
    }
    if (!description || typeof description !== 'string') {
      throw new Error(`Nivel ${id} ("${name}"): descripción inválida o ausente.`);
    }
    if (!validDifficulties.has(difficulty)) {
      throw new Error(`Nivel ${id} ("${name}"): dificultad inválida "${difficulty}". Debe ser "facil", "normal" o "duro".`);
    }
    if (!rival || !RIVALS[rival]) {
      throw new Error(`Nivel ${id} ("${name}"): rival inexistente "${rival}". Debe ser un id de RIVALS.`);
    }
    if (!Array.isArray(newPowers)) {
      throw new Error(`Nivel ${id} ("${name}"): newPowers debe ser un array.`);
    }
    if (hp !== undefined && !(Number.isInteger(hp) && hp > 0)) {
      throw new Error(`Nivel ${id} ("${name}"): hp inválido "${hp}".`);
    }

    // Validar poderes nuevos del nivel
    const newClasses = new Set();
    for (const p of newPowers) {
      const def = POWERS[p];
      if (!def) {
        throw new Error(`Nivel ${id} ("${name}"): poder inexistente "${p}" en newPowers.`);
      }
      if (unlocked.includes(p)) {
        throw new Error(`Nivel ${id} ("${name}"): el poder "${p}" ya se desbloqueó antes.`);
      }
      if (def.symbol) {
        if (newClasses.has(def.symbol)) {
          throw new Error(`Nivel ${id} ("${name}"): dos poderes de la misma clase "${def.symbol}" en newPowers.`);
        }
        newClasses.add(def.symbol);
      }
    }

    // Validar showcase opcional
    if (showcase !== undefined) {
      if (!Array.isArray(showcase)) {
        throw new Error(`Nivel ${id} ("${name}"): showcase debe ser un array.`);
      }
      for (const p of showcase) {
        if (!POWERS[p]) {
          throw new Error(`Nivel ${id} ("${name}"): poder o especial inexistente "${p}" en showcase.`);
        }
      }
    }

    // Un override de poderes se respeta tal cual, con un poder por clase.
    if (explicitActive !== undefined) {
      if (!Array.isArray(explicitActive)) {
        throw new Error(`Nivel ${id} ("${name}"): activePowers debe ser un array.`);
      }
      const activeClasses = new Set();
      for (const p of explicitActive) {
        const def = POWERS[p];
        if (!def) {
          throw new Error(`Nivel ${id} ("${name}"): poder inexistente "${p}" en activePowers.`);
        }
        if (def.symbol) {
          if (activeClasses.has(def.symbol)) {
            throw new Error(`Nivel ${id} ("${name}"): dos poderes activos de la misma clase "${def.symbol}".`);
          }
          activeClasses.add(def.symbol);
        }
      }
    }

    // Va al final: los errores de arriba se prueban de a uno con niveles sin escenario.
    if (!isStage(stage)) {
      throw new Error(`Nivel ${id} ("${name}"): escenario inexistente "${stage}". Debe ser un id de STAGES.`);
    }

    unlocked.push(...newPowers);
    const boss = Boolean(RIVALS[rival].boss);
    const kit = rivalKitAt(id, { boss });
    const evolved = rawLevel.evolved ?? kit.evolved;

    // Las cartas de mochila del rival: las de la escalera, o las que declare el nivel.
    let extras;
    if (rawLevel.extras !== undefined) {
      if (!Array.isArray(rawLevel.extras)) {
        throw new Error(`Nivel ${id} ("${name}"): extras debe ser un array.`);
      }
      extras = rawLevel.extras.map((raw) => {
        const card = cleanExtra(raw);
        if (!card) throw new Error(`Nivel ${id} ("${name}"): carta inválida en extras.`);
        return card;
      });
    } else {
      extras = rivalExtras(kit.extras, { id, cls: RIVALS[rival].class, unlocked });
    }
    if (extras.length > EXTRA_SLOTS) {
      throw new Error(`Nivel ${id} ("${name}"): el rival lleva ${extras.length} cartas de mochila; el tope es ${EXTRA_SLOTS}, como el tuyo.`);
    }

    // Los amuletos que declare el nivel: solo un rival con partes con amuleto, y solo
    // poderes que el jugador ya conoce. Si no declara, salen de su combinación (abajo).
    const charmPowers = rawLevel.charmPowers;
    if (charmPowers !== undefined) {
      if (!Array.isArray(charmPowers)) {
        throw new Error(`Nivel ${id} ("${name}"): charmPowers debe ser un array.`);
      }
      if (charmPowers.length && !RIVALS[rival].charms?.length) {
        throw new Error(`Nivel ${id} ("${name}"): el rival "${rival}" no tiene partes con amuleto para charmPowers.`);
      }
      for (const p of charmPowers) {
        if (!POWERS[p]) {
          throw new Error(`Nivel ${id} ("${name}"): poder inexistente "${p}" en charmPowers.`);
        }
        if (!unlocked.includes(p)) {
          throw new Error(`Nivel ${id} ("${name}"): el amuleto "${p}" todavía no se desbloqueó.`);
        }
      }
    }

    // La vida: la que declare el nivel (los jefes), o la de su tramo; la de siempre no se anota.
    const life = hp ?? (boss ? undefined : rivalHpAt(id));
    return {
      ...rawLevel,
      ...(life && life !== 150 ? { hp: life } : {}),
      id,
      base: rival,
      rival: rivalId(rival, evolved),
      evolved,
      boss,
      newPowers: [...newPowers],
      unlocked: [...unlocked],
      extras,
      ...(charmPowers ? { charmPowers: [...charmPowers] } : {}),
      ...(explicitActive ? { activePowers: [...explicitActive] } : {}),
      ...(showcase ? { showcase } : {}),
    };
  });

  // La combinación de cada nivel se arma mirando todos los anteriores (ver `levelPowers`).
  const combos = levelPowers(levels.map((l) => l.unlocked), levels.map((l) => l.newPowers));
  return levels.map((level, i) => {
    const activePowers = level.activePowers ?? combos[i];
    const charmPowers = level.charmPowers
      ?? (RIVALS[level.base].charms?.length ? activePowers.filter((p) => !RIVAL_NO_POWER.has(p)) : []);
    return { ...level, activePowers, charmPowers };
  });
}

/**
 * El poder de cada parte con amuleto del jefe de un nivel: `{ horn: 'poison', tail:
 * 'viper' }`, repartidos en orden de su `charmPowers` (el que estrena el nivel, primero).
 * Fijo: el jefe pelea siempre igual, como el resto del nivel. Sin amuletos, `null`.
 */
export function adventureCharms(level) {
  const parts = RIVALS[level?.base]?.charms ?? [];
  const fresh = level?.newPowers ?? [];
  const pool = [...(level?.charmPowers ?? [])].sort((a, b) => fresh.includes(b) - fresh.includes(a));
  if (!parts.length || !pool.length) return null;
  return Object.fromEntries(parts.map((part, i) => [part, pool[i % pool.length]]));
}

/** Los poderes de una partida del nivel `level`: su combinación fija (ver `levelPowers`). */
export function adventurePowers(level) {
  return [...(level.activePowers ?? [])];
}

/** Configuración de niveles de la campaña con ids y poderes ya derivados. */
export const ADVENTURE_LEVELS = buildAdventureLevels(ADVENTURE_CAMPAIGN);

/**
 * Los capítulos con sus niveles: `{ n, name, levels }`. Los niveles que queden afuera
 * de los capítulos declarados (una campaña que creció) van en uno sin nombre.
 */
export const adventureChapters = (levels = ADVENTURE_LEVELS, chapters = ADVENTURE_CHAPTERS) => {
  const out = [];
  let at = 0;
  for (const [i, ch] of chapters.entries()) {
    const mine = levels.slice(at, at + ch.size);
    if (mine.length) out.push({ n: i + 1, name: ch.name, levels: mine });
    at += ch.size;
  }
  if (at < levels.length) out.push({ n: out.length + 1, name: '', levels: levels.slice(at) });
  return out;
};

/**
 * Lo que va antes del título de un nivel: "Nivel 7", o "Jefe" (y "Jefe Final" en el
 * último). Sale del id y no del nombre: con la campaña creciendo, un número escrito a
 * mano en el nombre queda viejo.
 */
export function levelKicker(level) {
  if (!level?.boss) return tr('Nivel {n}', { n: level?.id ?? 1 });
  return isFinalLevel(level.id) ? tr('Jefe Final') : tr('Jefe');
}

/** El nombre entero de un nivel, como lo dicen el registro y la pantalla final. */
export const levelTitle = (level) => `${levelKicker(level)}: ${level.name}`;

/**
 * Comprueba si un nivel es el último de la campaña.
 * @param {number|string} id
 * @returns {boolean}
 */
export function isFinalLevel(id) {
  const num = Number(id);
  if (!Number.isFinite(num) || ADVENTURE_LEVELS.length === 0) return false;
  return num >= ADVENTURE_LEVELS[ADVENTURE_LEVELS.length - 1].id;
}

/**
 * Devuelve el ID del siguiente nivel en la campaña, o null si es el último o no existe.
 * @param {number|string} id
 * @returns {number|null}
 */
export function nextLevelId(id) {
  const num = Number(id);
  const idx = ADVENTURE_LEVELS.findIndex((lvl) => lvl.id === num);
  if (idx === -1 || idx >= ADVENTURE_LEVELS.length - 1) return null;
  return ADVENTURE_LEVELS[idx + 1].id;
}

/**
 * La versión del progreso guardado. La 1 (sin `v`) es la de la campaña de 30 niveles en
 * capítulos de 6; la 2, la de capítulos de 10, donde cada capítulo de antes sumó cuatro
 * niveles nuevos entre los suyos (ver `fromV1`).
 */
export const PROGRESS_VERSION = 2;

/** Dónde quedó cada nivel de un capítulo de 6 adentro de su capítulo de 10. */
const V1_SLOTS = [1, 2, 4, 6, 8, 10];

/** El id de ahora de un nivel de la campaña de capítulos de 6: el 7 de antes es el 11. */
export const fromV1 = (id) => 10 * Math.floor((id - 1) / 6) + V1_SLOTS[(id - 1) % 6];

/**
 * Lee el progreso del modo aventura guardado en el navegador.
 * Soporta compatibilidad hacia adelante: si se agregan niveles a la campaña
 * y el jugador ya completó el nivel anterior, el nuevo nivel se desbloquea.
 *
 * `starredLevels` son los niveles ganados por K.O. (ver `wonByKo` en `game.js`): pasar
 * un nivel dejándole la última chance al rival lo supera, pero sin estrella. Un
 * progreso guardado antes de las estrellas no las anotaba, y lo ganado entonces cuenta
 * con estrella: no se le quita a nadie lo que ya tenía.
 *
 * Un progreso de la versión 1 se lee con sus niveles en su lugar de ahora (`fromV1`):
 * lo ganado sigue ganado, y los niveles nuevos que quedaron antes del más lejano abierto
 * quedan abiertos para jugarlos cuando quiera.
 *
 * @returns {{ unlockedLevel: number, completedLevels: number[], starredLevels: number[] }}
 */
export function getAdventureProgress() {
  const fresh = () => ({ unlockedLevel: 1, completedLevels: [], starredLevels: [] });
  try {
    const raw = store()?.getItem(ADVENTURE_KEY);
    if (!raw) return openAll(fresh());
    const parsed = JSON.parse(raw);
    const moved = parsed.v === PROGRESS_VERSION ? (n) => n : fromV1;
    const valid = (list) => (Array.isArray(list)
      ? list.filter((n) => Number.isInteger(n) && n >= 1).map(moved).filter((n) => n <= ADVENTURE_LEVELS.length)
      : []);
    const completed = valid(parsed.completedLevels);
    const starred = Array.isArray(parsed.starredLevels)
      ? valid(parsed.starredLevels).filter((n) => completed.includes(n))
      : [...completed];
    let unlocked = Number.isInteger(parsed.unlockedLevel) && parsed.unlockedLevel >= 1
      ? Math.min(ADVENTURE_LEVELS.length, moved(parsed.unlockedLevel))
      : 1;

    // Si el nivel completado más alto permite avanzar a un nivel nuevo de la campaña
    // (por ejemplo, si se agregó un nivel 7 y el jugador ya tenía el 6 completado),
    // desbloquear el siguiente automáticamente.
    for (let lvl = 1; lvl < ADVENTURE_LEVELS.length; lvl++) {
      if (completed.includes(lvl) && unlocked <= lvl) {
        unlocked = lvl + 1;
      }
    }

    return openAll({ unlockedLevel: unlocked, completedLevels: completed, starredLevels: starred });
  } catch {
    return openAll(fresh());
  }
}

/** En el modo libre (ver `FREE_PLAY`) el mapa entero está abierto. */
const openAll = (progress) => (FREE_PLAY ? { ...progress, unlockedLevel: ADVENTURE_LEVELS.length } : progress);

/**
 * El nivel que toca jugar: el primero abierto que todavía no ganaste (en el modo libre,
 * con todo abierto, no es el último), o el más lejano abierto.
 */
export function levelToPlay(progress = getAdventureProgress()) {
  const won = new Set(progress.completedLevels);
  return ADVENTURE_LEVELS.find((l) => l.id <= progress.unlockedLevel && !won.has(l.id))?.id ?? progress.unlockedLevel;
}

/**
 * Guarda el progreso en localStorage.
 */
export function saveAdventureProgress(progress) {
  try {
    store()?.setItem(ADVENTURE_KEY, JSON.stringify({ ...progress, v: PROGRESS_VERSION }));
  } catch {
    // Ignorar si el almacenamiento no está disponible
  }
}

/**
 * Comprueba si un nivel está disponible para jugar.
 */
export function isLevelUnlocked(levelId) {
  const { unlockedLevel } = getAdventureProgress();
  return Number(levelId) <= unlockedLevel;
}

/**
 * Marca un nivel como completado y desbloquea el siguiente si corresponde. Con `star`
 * (ganado por K.O.) se lleva además su estrella; volver a ganarlo sin K.O. no se la
 * saca.
 * @param {number|string} levelId
 * @param {{ star?: boolean }} [opts]
 * @returns {{ unlockedLevel: number, completedLevels: number[], starredLevels: number[] }}
 */
export function markLevelCompleted(levelId, { star = false } = {}) {
  const current = getAdventureProgress();
  const numId = Number(levelId);
  const completed = Array.from(new Set([...current.completedLevels, numId]));
  const starred = star ? Array.from(new Set([...current.starredLevels, numId])) : current.starredLevels;
  let nextUnlocked = current.unlockedLevel;
  const next = nextLevelId(numId);
  if (next !== null && numId >= current.unlockedLevel) {
    nextUnlocked = next;
  }
  const updated = { unlockedLevel: nextUnlocked, completedLevels: completed, starredLevels: starred };
  saveAdventureProgress(updated);
  return updated;
}

/**
 * Reinicia el progreso al nivel 1 inicial.
 */
export function resetAdventureProgress() {
  const initial = { unlockedLevel: 1, completedLevels: [], starredLevels: [] };
  saveAdventureProgress(initial);
  return initial;
}

/**
 * Obtiene la configuración de un nivel por su ID.
 * @param {number|string} id
 */
export function getAdventureLevel(id) {
  const num = Number(id);
  return ADVENTURE_LEVELS.find((l) => l.id === num) ?? ADVENTURE_LEVELS[0];
}
