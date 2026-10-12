// El crafteo del Taller: cartas sueltas para la mochila, sacadas a la suerte.
//
// Cada carta cuesta `CRAFT_COST` Moonshards y sale de un sorteo en dos pasos. Primero la
// rareza, con estas chances (en diez mil, así las cuentas son enteras):
//
//   Común       1 símbolo                     80 %
//   Poco común  2 símbolos                    15 %
//   Rara        3 símbolos                     4 %
//   Épica       1 símbolo  + un poder de clase  0,85 %
//   Legendaria  2 símbolos + un poder de clase  0,14 %
//   Mítica      3 símbolos + un poder de clase  0,01 %
//
// Después lo de adentro: cada símbolo es cualquiera de las seis clases, por separado, así
// que se pueden repetir (dos Planta en la misma carta adelantan su racha de a dos, ver
// `timesIn` en `rules.js`). El poder es cualquiera de los 30 de clase (`CLASS_POWER_IDS`),
// sin mirar los símbolos de la carta.
//
// La garantía: la carta número 50, 100, 150… que creás trae poder sí o sí. Si el sorteo
// ya le dio una con poder, queda esa (puede ser una Mítica); si no, es una Épica. La
// cuenta es fija —no se reinicia cuando sale un poder por suerte—, así el cartel de "te
// faltan N" nunca miente.
//
// Una llave paga una carta en vez de los Moonshards (`KEY_ODDS`). La común es lo mismo
// que crear con Moonshards: las mismas chances y la misma cuenta. La de oro sale poco
// común o mejor, casi siempre rara, con más épicas y míticas, y tiene su propia
// garantía: cada 50 cartas creadas con ella, una legendaria (`GOLD_PITY`). Salen del pase de temporada (ver `missions.js`), y la de
// oro se consigue también con diez comunes (`KEY_TRADE`) o con 100 Moonshards
// (`KEY_COST`), lo mismo que diez cartas.
//
// Lo que sale va a la mochila (`addToBackpack` en `backpack.js`), de donde se le pone a
// un Axie desde su inventario. Puro, sin DOM; lo único guardado es cuántas cartas creaste
// (`axie-chance:craft`), que es lo que cuenta la garantía.
//
// Y al revés, reciclar: una carta suelta de la mochila se rompe y devuelve el 10 % de lo
// que vale su rareza (`CARD_VALUE`, `scrapValue`, `scrapCards`).
//
// Y fusionar: tres cartas sueltas iguales (los mismos símbolos, con sus repetidos, y el
// mismo poder) se vuelven una de la rareza siguiente (`mergeGroups`, `mergeResult`,
// `mergeCards`). Gratis: lo que cuesta es juntar las tres.
//
//   Común → Poco común → Rara    quedan sus símbolos y se suma uno al azar
//   Rara → Épica                 queda uno de los tres, al azar, con un poder de su clase
//   Épica → Legendaria → Mítica  quedan sus símbolos y su poder, y se suma uno al azar
import { SYMBOL_IDS, CLASS_POWERS, CLASS_POWER_IDS, cleanExtra } from './data.js';
import { store } from './loadout.js';
import { addToBackpack } from './backpack.js';
import { tr } from './i18n.js';

export const CRAFT_KEY = 'axie-chance:craft';

/** Lo que cuesta crear una carta, en Moonshards. Borrador: ver docs/economy.md. */
export const CRAFT_COST = 10;
/** De a cuántas se crea con el botón grande. */
export const CRAFT_BATCH = 10;
/** Cada cuántas cartas creadas sale una con poder asegurada. */
export const CRAFT_PITY = 50;
/** El total de las chances: cada `weight` es en diez mil. */
export const CRAFT_ODDS_TOTAL = 10000;

/**
 * Las seis rarezas, de la más común a la más rara: cuántos símbolos trae la carta, si
 * trae un poder de clase y su chance en diez mil.
 */
export const CRAFT_TIERS = [
  { id: 'common', symbols: 1, power: false, weight: 8000 },
  { id: 'uncommon', symbols: 2, power: false, weight: 1500 },
  { id: 'rare', symbols: 3, power: false, weight: 400 },
  { id: 'epic', symbols: 1, power: true, weight: 85 },
  { id: 'legendary', symbols: 2, power: true, weight: 14 },
  { id: 'mythic', symbols: 3, power: true, weight: 1 },
];

/** El nombre de cada rareza. Se pide al pintar: el idioma puede cambiar en el medio. */
export const tierName = (id) => ({
  common: tr('Común'),
  uncommon: tr('Poco común'),
  rare: tr('Rara'),
  epic: tr('Épica'),
  legendary: tr('Legendaria'),
  mythic: tr('Mítica'),
}[id]);

/**
 * Lo que vale una carta de cada rareza, en Moonshards. La común vale lo que cuesta
 * crearla; de ahí para arriba, cada vez más, pero mucho menos que lo que costaría
 * sacarla del sorteo (una mítica sale una vez cada 10.000 cartas). Borrador: ver
 * docs/economy.md §12.
 */
export const CARD_VALUE = { common: 10, uncommon: 30, rare: 80, epic: 250, legendary: 800, mythic: 3000 };
/** Lo que devuelve reciclar una carta: esta parte de lo que vale. */
export const SCRAP_RATE = 0.1;

/** La rareza que da la garantía cuando el sorteo no trajo poder. */
const PITY_TIER = CRAFT_TIERS.find((t) => t.id === 'epic');
/** Cada cuántas cartas de llave de oro sale una legendaria asegurada. */
export const GOLD_PITY = 50;
/** La rareza que da la garantía de la llave de oro, si el sorteo no dio una igual o mejor. */
const GOLD_PITY_TIER = CRAFT_TIERS.find((t) => t.id === 'legendary');

/**
 * La rareza de una carta de la mochila, por lo que trae: cuántos símbolos y si su poder
 * es de clase. El Rocket Stamp no es de clase, así que el del paquete de bienvenida
 * cuenta como una de dos símbolos. `null` si no es ninguna (más de tres símbolos).
 */
export function tierOf(card) {
  const power = CLASS_POWER_IDS.includes(card?.power);
  return CRAFT_TIERS.find((t) => t.symbols === card?.symbols?.length && t.power === power) ?? null;
}

/** Uno de la lista, con el azar que venga. */
const drawFrom = (list, rng) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];

/**
 * Las llaves (ver `KEY_KINDS` en `evolution.js`): cada una crea una carta sin pagar
 * Moonshards. La común, con las chances de crear (`null`) y contando para la asegurada
 * cada 50 como una carta de Moonshards. La de oro, con las suyas, en diez mil:
 *
 *   gold  poco común 15 %, rara 70 %, épica 14 %, legendaria 0,75 %, mítica 0,25 %
 *
 * La de oro vale lo mismo que diez cartas (diez comunes o 100 Moonshards). Contra ellas,
 * en promedio: 0,7 raras contra 0,4, 0,0025 míticas contra 0,001 y, con su legendaria
 * asegurada cada 50, 0,027 legendarias contra 0,014; pero 0,14 épicas contra 0,28 (0,085
 * por suerte y 0,2 de la asegurada de poder que adelantan las diez). Ver docs/missions.md.
 */
export const KEY_ODDS = {
  basic: null,
  gold: { uncommon: 1500, rare: 7000, epic: 1400, legendary: 75, mythic: 25 },
};

/** Cuántas llaves comunes se cambian por una de oro. */
export const KEY_TRADE = 10;
/** Lo que cuesta una llave de oro en Moonshards: lo mismo que diez cartas. */
export const KEY_COST = { gold: KEY_TRADE * CRAFT_COST };

/** La chance de cada rareza: las de siempre o las de una llave (ver `KEY_ODDS`). */
export const tierWeight = (tier, odds = null) => (odds ? odds[tier.id] ?? 0 : tier.weight);

/**
 * Sortea la rareza de una carta. Con `odds` (las de una llave, ver `KEY_ODDS`), las
 * suyas: una rareza que no está ahí no sale.
 */
export function rollTier(rng = Math.random, odds = null) {
  const tiers = CRAFT_TIERS.filter((t) => tierWeight(t, odds) > 0);
  let r = Math.floor(rng() * tiers.reduce((t, x) => t + tierWeight(x, odds), 0));
  for (const tier of tiers) {
    const w = tierWeight(tier, odds);
    if (r < w) return tier;
    r -= w;
  }
  return tiers[0];
}

/** Arma una carta de esa rareza: sus símbolos al azar, con repetidos, y su poder si va. */
export function rollCard(tier, rng = Math.random) {
  const symbols = Array.from({ length: tier.symbols }, () => drawFrom(SYMBOL_IDS, rng));
  return cleanExtra({ symbols, power: tier.power ? drawFrom(CLASS_POWER_IDS, rng) : null });
}

/** Cuántas cartas faltan para la próxima con poder asegurada: de `CRAFT_PITY` a 1. */
export const pityLeft = (state) => CRAFT_PITY - (state.crafted % CRAFT_PITY);
/** Cuántas cartas de llave de oro faltan para la legendaria asegurada: de `GOLD_PITY` a 1. */
export const goldPityLeft = (state) => GOLD_PITY - ((state.gold ?? 0) % GOLD_PITY);

/**
 * Por qué no se pueden crear `count` cartas, o `null`: `'shards'`, no alcanzan los
 * Moonshards; con `key` (ver `KEY_ODDS`), `'keys'`, no alcanzan las llaves de esa
 * clase, o `'key'`, no es una llave.
 */
export function craftBlock(wallet, count, key = null) {
  if (key !== null) {
    if (!(key in KEY_ODDS)) return 'key';
    return (wallet.keys?.[key] ?? 0) < count ? 'keys' : null;
  }
  return wallet.moonshards < count * CRAFT_COST ? 'shards' : null;
}

/**
 * Cambia `KEY_TRADE` llaves comunes por cada una de oro: la bolsa nueva con `n` de oro
 * más, o `null` si no alcanzan.
 */
export function tradeKeys(wallet, n = 1) {
  const count = Math.max(0, Math.floor(Number(n) || 0));
  const basic = wallet.keys?.basic ?? 0;
  if (!count || basic < count * KEY_TRADE) return null;
  return {
    ...wallet,
    keys: { ...wallet.keys, basic: basic - count * KEY_TRADE, gold: (wallet.keys?.gold ?? 0) + count },
  };
}

/**
 * Compra `n` llaves de esa clase con Moonshards (ver `KEY_COST`): la bolsa nueva, o
 * `null` si no se venden o no alcanza.
 */
export function buyKeys(wallet, kind, n = 1) {
  const count = Math.max(0, Math.floor(Number(n) || 0));
  const cost = (KEY_COST[kind] ?? 0) * count;
  if (!cost || wallet.moonshards < cost) return null;
  return {
    ...wallet,
    moonshards: wallet.moonshards - cost,
    keys: { ...wallet.keys, [kind]: (wallet.keys?.[kind] ?? 0) + count },
  };
}

/**
 * Crea `count` cartas: cobra, cuenta y sortea cada una. Devuelve la cuenta y la bolsa
 * nuevas y las cartas, cada una con su rareza (`tier`) y si era la asegurada (`pity`);
 * las mismas cuenta y bolsa y ninguna carta si no alcanzaba.
 *
 * Con `key`, cada carta se paga con una llave de esa clase en vez de Moonshards, y sale
 * con sus chances (ver `KEY_ODDS`). Con Moonshards o con la común cuenta `crafted` (una
 * con poder cada `CRAFT_PITY`); con la de oro, `gold` (una legendaria cada `GOLD_PITY`).
 */
export function craftCards(state, wallet, count, rng = Math.random, { key = null } = {}) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (!n || craftBlock(wallet, n, key)) return { state, wallet, cards: [] };
  const odds = key ? KEY_ODDS[key] : null;
  let crafted = state.crafted;
  let gold = state.gold ?? 0;
  const cards = [];
  for (let i = 0; i < n; i++) {
    let tier = rollTier(rng, odds);
    let pity = false;
    if (key === 'gold') {
      gold += 1;
      pity = gold % GOLD_PITY === 0;
      // Si el sorteo ya dio una legendaria o una mítica, queda esa.
      if (pity && CRAFT_TIERS.indexOf(tier) < CRAFT_TIERS.indexOf(GOLD_PITY_TIER)) tier = GOLD_PITY_TIER;
    } else {
      crafted += 1;
      pity = crafted % CRAFT_PITY === 0;
      if (pity && !tier.power) tier = PITY_TIER;
    }
    cards.push({ ...rollCard(tier, rng), tier: tier.id, pity });
  }
  return {
    state: { ...state, crafted, gold },
    wallet: key
      ? { ...wallet, keys: { ...wallet.keys, [key]: wallet.keys[key] - n } }
      : { ...wallet, moonshards: wallet.moonshards - n * CRAFT_COST },
    cards,
  };
}

// ---------- reciclar ----------

/**
 * Lo que devuelve reciclar una carta, en Moonshards: el 10 % de lo que vale su rareza
 * (1, 3, 8, 25, 80 o 300). Una carta sin rareza no se recicla (0).
 */
export function scrapValue(card) {
  const tier = tierOf(card);
  return tier ? Math.round(CARD_VALUE[tier.id] * SCRAP_RATE) : 0;
}

/**
 * Recicla cartas de la mochila: las saca y paga lo que devuelve cada una. Solo las
 * sueltas: la que tiene puesta un Axie es parte de su mazo, y primero se la saca desde
 * su inventario. Devuelve la mochila y la bolsa nuevas, las cartas recicladas y lo que
 * se ganó; las mismas, sin cartas, si no había ninguna que reciclar.
 */
export function scrapCards(bag, wallet, ids) {
  const want = new Set(ids);
  const gone = bag.items.filter((it) => want.has(it.id) && !it.axie && scrapValue(it) > 0);
  if (!gone.length) return { bag, wallet, cards: [], gained: 0 };
  const gained = gone.reduce((sum, it) => sum + scrapValue(it), 0);
  return {
    bag: { ...bag, items: bag.items.filter((it) => !gone.includes(it)) },
    wallet: { ...wallet, moonshards: wallet.moonshards + gained },
    cards: gone,
    gained,
  };
}

// ---------- fusionar ----------

/** Cuántas cartas iguales se juntan en una fusión. */
export const MERGE_COPIES = 3;

/**
 * Lo que hace iguales a dos cartas para fusionarlas: los mismos símbolos, contando los
 * repetidos y sin importar el orden, y el mismo poder (o ninguno).
 */
export const cardKey = (card) => `${[...card.symbols].sort().join('+')}|${card.power ?? ''}`;

/**
 * La rareza que sale de fusionar tres de esta carta, o `null` si no se fusiona: la
 * mítica es la última, y una carta sin rareza o con un poder que no es de clase (el
 * Rocket Stamp del paquete de bienvenida) no tiene una siguiente.
 */
export function mergeTier(card) {
  const tier = tierOf(card);
  if (!tier || (card.power && !CLASS_POWER_IDS.includes(card.power))) return null;
  return CRAFT_TIERS[CRAFT_TIERS.indexOf(tier) + 1] ?? null;
}

/**
 * Lo que sale de fusionar tres de esta carta, o `null` si no se fusiona. Casi siempre
 * quedan sus símbolos y su poder y se suma un símbolo de cualquiera de las seis clases
 * (puede repetir uno que ya tiene). De rara a épica, en cambio, la carta pasa de tres
 * símbolos a uno con poder: queda uno de los tres, al azar —uno repetido tiene más
 * chances—, y el poder es uno de los cinco de su clase.
 */
export function mergeResult(card, rng = Math.random) {
  const next = mergeTier(card);
  if (!next) return null;
  if (next.power && !card.power) {
    const kept = drawFrom(card.symbols, rng);
    return cleanExtra({ symbols: [kept], power: drawFrom(CLASS_POWERS[kept], rng) });
  }
  return cleanExtra({ symbols: [...card.symbols, drawFrom(SYMBOL_IDS, rng)], power: card.power });
}

/**
 * Las cartas sueltas de la mochila juntadas de a iguales, solo las que se pueden
 * fusionar: cada grupo con su carta, su rareza y la que sale (`tier`, `next`) y los ids
 * de sus copias. Con `all`, también los que todavía no llegan a tres. De la rareza más
 * alta a la más baja y, a igual rareza, el que tiene más copias primero.
 */
export function mergeGroups(bag, { all = false } = {}) {
  const groups = new Map();
  for (const it of bag.items) {
    if (it.axie) continue;
    const next = mergeTier(it);
    if (!next) continue;
    const key = cardKey(it);
    if (!groups.has(key)) {
      groups.set(key, { key, card: { symbols: it.symbols, power: it.power ?? null }, tier: tierOf(it).id, next: next.id, ids: [] });
    }
    groups.get(key).ids.push(it.id);
  }
  const rank = (g) => CRAFT_TIERS.findIndex((t) => t.id === g.tier);
  return [...groups.values()]
    .filter((g) => all || g.ids.length >= MERGE_COPIES)
    .sort((a, b) => rank(b) - rank(a) || b.ids.length - a.ids.length);
}

/**
 * La mochila como colección: una pila por carta distinta (ver `cardKey`), con todas sus
 * copias —las sueltas por id en `loose`, las puestas en un Axie en `worn`—, su rareza y
 * la que sale de fusionarla (`next`, `null` si no se fusiona). De la rareza más alta a
 * la más baja y, a igual rareza, la que tiene más copias primero (si no, como llegaron).
 */
export function stacksOf(bag) {
  const stacks = new Map();
  for (const it of bag.items) {
    const key = cardKey(it);
    if (!stacks.has(key)) {
      stacks.set(key, {
        key, card: { symbols: it.symbols, power: it.power ?? null },
        tier: tierOf(it)?.id ?? null, next: mergeTier(it)?.id ?? null, loose: [], worn: [],
      });
    }
    const stack = stacks.get(key);
    if (it.axie) stack.worn.push({ id: it.id, axie: it.axie });
    else stack.loose.push(it.id);
  }
  const rank = (s) => CRAFT_TIERS.findIndex((t) => t.id === s.tier);
  const count = (s) => s.loose.length + s.worn.length;
  return [...stacks.values()].sort((a, b) => rank(b) - rank(a) || count(b) - count(a));
}

/**
 * Fusiona tres copias sueltas de la carta `key` (ver `cardKey`): las saca de la mochila
 * y suma la nueva, suelta. Devuelve la mochila nueva, la carta nueva con su id y su
 * rareza (`tier`) y las tres que se fueron; la misma mochila y ninguna carta si no
 * había tres sueltas.
 */
export function mergeCards(bag, key, rng = Math.random) {
  const used = bag.items.filter((it) => !it.axie && mergeTier(it) && cardKey(it) === key).slice(0, MERGE_COPIES);
  if (used.length < MERGE_COPIES) return { bag, card: null, used: [] };
  const made = mergeResult(used[0], rng);
  const next = addToBackpack({ ...bag, items: bag.items.filter((it) => !used.includes(it)) }, [made]);
  const added = next.items[next.items.length - 1];
  return { bag: next, card: { ...added, tier: tierOf(added).id }, used };
}

// ---------- lo guardado ----------

/**
 * Lo que vale como cuenta del crafteo, enteros ≥ 0: cuántas cartas creaste con
 * Moonshards (`crafted`) y con la llave de oro (`gold`).
 */
export function cleanCraft(raw) {
  const count = (n) => Math.max(0, Math.floor(Number(n) || 0));
  return { crafted: count(raw?.crafted), gold: count(raw?.gold) };
}

export function readCraft() {
  try {
    return cleanCraft(JSON.parse(store()?.getItem(CRAFT_KEY) ?? 'null'));
  } catch {
    return cleanCraft(null);
  }
}

export function writeCraft(state) {
  try { store()?.setItem(CRAFT_KEY, JSON.stringify(cleanCraft(state))); } catch { /* sin almacenamiento, dura la página */ }
}
