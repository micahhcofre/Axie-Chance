// El crafteo del Taller (ver `crafting.js` y docs/economy.md): las chances de cada
// rareza, que los símbolos salgan de las seis clases y se repitan, la carta con poder
// asegurada cada 50, lo que cuesta, lo guardado, que lo que sale entre en la mochila y
// en la partida como cualquier otra carta, reciclar y fusionar.
import assert from 'node:assert/strict';

const memoria = new Map();
globalThis.localStorage = {
  getItem: (k) => memoria.get(k) ?? null,
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
};

const {
  CRAFT_KEY, CRAFT_COST, CRAFT_BATCH, CRAFT_PITY, CRAFT_TIERS, CRAFT_ODDS_TOTAL, KEY_ODDS, KEY_TRADE, KEY_COST, GOLD_PITY, tradeKeys, buyKeys, goldPityLeft,
  tierOf, rollTier, rollCard, pityLeft, craftBlock, craftCards, cleanCraft, readCraft, writeCraft,
  CARD_VALUE, SCRAP_RATE, scrapValue, scrapCards,
  MERGE_COPIES, cardKey, mergeTier, mergeResult, mergeGroups, mergeCards, stacksOf,
} = await import('../src/crafting.js');
const { SYMBOL_IDS, CLASS_POWERS, CLASS_POWER_IDS, makeRng, extraCards } = await import('../src/data.js');
const { readBackpack, addToBackpack, looseCards, cleanBackpack, STARTER_PACK } = await import('../src/backpack.js');
const { playCard, emptyChain } = await import('../src/rules.js');

/** Un azar que devuelve siempre lo mismo. */
const always = (x) => () => x;
const tier = (id) => CRAFT_TIERS.find((t) => t.id === id);

// ---- las chances --------------------------------------------------------------
// Las del pedido: 70 / 20 / 8 sin poder y 1,5 / 0,45 / 0,05 con poder (el 2 % de
// cartas con poder, repartido).
assert.equal(CRAFT_ODDS_TOTAL, 10000);
assert.equal(CRAFT_TIERS.reduce((t, x) => t + x.weight, 0), CRAFT_ODDS_TOTAL, 'las chances suman el 100 %');
assert.deepEqual(CRAFT_TIERS.map((t) => [t.id, t.symbols, t.power, t.weight / 100]), [
  ['common', 1, false, 80],
  ['uncommon', 2, false, 15],
  ['rare', 3, false, 4],
  ['epic', 1, true, 0.85],
  ['legendary', 2, true, 0.14],
  ['mythic', 3, true, 0.01],
]);
assert.equal(CRAFT_TIERS.filter((t) => t.power).reduce((t, x) => t + x.weight, 0), 100, 'el 1 % trae poder');

// Los bordes de cada tramo, en diez mil.
const at = (r) => rollTier(always(r / CRAFT_ODDS_TOTAL)).id;
assert.equal(at(0), 'common');
assert.equal(at(7999), 'common');
assert.equal(at(8000), 'uncommon');
assert.equal(at(9499), 'uncommon');
assert.equal(at(9500), 'rare');
assert.equal(at(9899), 'rare');
assert.equal(at(9900), 'epic');
assert.equal(at(9984), 'epic');
assert.equal(at(9985), 'legendary');
assert.equal(at(9998), 'legendary');
assert.equal(at(9999), 'mythic');
assert.equal(at(9999.99), 'mythic');

// Y sorteando de verdad, con semilla: cada rareza cerca de su chance.
{
  const rng = makeRng(2026);
  const N = 400000;
  const count = Object.fromEntries(CRAFT_TIERS.map((t) => [t.id, 0]));
  for (let i = 0; i < N; i++) count[rollTier(rng).id]++;
  for (const t of CRAFT_TIERS) {
    const p = t.weight / CRAFT_ODDS_TOTAL;
    const sd = Math.sqrt((p * (1 - p)) / N);
    assert.ok(Math.abs(count[t.id] / N - p) < 5 * sd + 1e-9,
      `${t.id}: ${(count[t.id] / N * 100).toFixed(3)} % y tendría que andar por ${p * 100} %`);
  }
}
console.log('✓ las chances ok');

// ---- lo de adentro ----------------------------------------------------------------
{
  const rng = makeRng(7);
  const seen = new Set();
  let repeated = 0;
  for (const t of CRAFT_TIERS) {
    for (let i = 0; i < 400; i++) {
      const card = rollCard(t, rng);
      assert.equal(card.symbols.length, t.symbols, `${t.id}: ${t.symbols} símbolos`);
      assert.ok(card.symbols.every((s) => SYMBOL_IDS.includes(s)), 'solo las seis clases');
      card.symbols.forEach((s) => seen.add(s));
      if (new Set(card.symbols).size < card.symbols.length) repeated++;
      if (t.power) assert.ok(CLASS_POWER_IDS.includes(card.power), `${t.id}: un poder de clase`);
      else assert.equal(card.power, null, `${t.id}: sin poder`);
    }
  }
  assert.equal(seen.size, 6, 'salen las seis clases');
  assert.ok(repeated > 0, 'los símbolos se repiten en la misma carta');
}
// Repetidos de verdad: con el azar clavado salen las tres de la misma clase.
assert.deepEqual(rollCard(tier('rare'), always(0)).symbols, [SYMBOL_IDS[0], SYMBOL_IDS[0], SYMBOL_IDS[0]]);
assert.ok(rollCard(tier('epic'), always(0.9999)).power, 'el último poder de la lista también sale');

// La rareza de una carta de la mochila, por lo que trae.
assert.equal(tierOf({ symbols: ['plant'], power: null }).id, 'common');
assert.equal(tierOf({ symbols: ['plant', 'plant'], power: null }).id, 'uncommon');
assert.equal(tierOf({ symbols: ['bug', 'bug', 'bird'], power: 'poison' }).id, 'mythic');
assert.equal(tierOf({ symbols: ['beast'], power: 'egg' }).id, 'epic');
assert.equal(tierOf(STARTER_PACK.find((c) => c.power === 'freegame')).id, 'uncommon',
  'el Rocket Stamp no es un poder de clase');
console.log('✓ las cartas ok');

// ---- la garantía y lo que cuesta ---------------------------------------------------
assert.equal(CRAFT_PITY, 50);
assert.equal(pityLeft({ crafted: 0 }), 50);
assert.equal(pityLeft({ crafted: 49 }), 1);
assert.equal(pityLeft({ crafted: 50 }), 50);

assert.equal(craftBlock({ moonshards: CRAFT_COST - 1 }, 1), 'shards');
assert.equal(craftBlock({ moonshards: CRAFT_COST }, 1), null);
assert.equal(craftBlock({ moonshards: CRAFT_COST * CRAFT_BATCH - 1 }, CRAFT_BATCH), 'shards');
{
  const state = { crafted: 3 };
  const wallet = { moonshards: CRAFT_COST - 1 };
  const out = craftCards(state, wallet, 1);
  assert.equal(out.state, state, 'sin Moonshards no cuenta');
  assert.equal(out.wallet, wallet, 'ni cobra');
  assert.deepEqual(out.cards, [], 'ni sale nada');
}
{
  // Con el azar clavado en lo más común, la única con poder es la asegurada.
  let state = { crafted: 0 };
  let wallet = { moonshards: CRAFT_COST * 120 };
  const all = [];
  for (let i = 0; i < 12; i++) {
    const out = craftCards(state, wallet, CRAFT_BATCH, always(0));
    ({ state, wallet } = out);
    all.push(...out.cards);
  }
  assert.equal(state.crafted, 120);
  assert.equal(wallet.moonshards, 0, 'cada carta cuesta lo suyo');
  const powered = all.map((c, i) => (c.power ? i + 1 : 0)).filter(Boolean);
  assert.deepEqual(powered, [50, 100], 'la 50 y la 100 traen poder');
  assert.ok(all.filter((c) => c.power).every((c) => c.tier === 'epic' && c.pity && c.symbols.length === 1),
    'la asegurada es una Épica: un símbolo y un poder de clase');
  assert.ok(all.filter((c) => !c.power).every((c) => c.tier === 'common' && !c.pity));
}
{
  // La cuenta sigue entre tandas: de la 45, la quinta de la tanda es la 50.
  const out = craftCards({ crafted: 45 }, { moonshards: 1000 }, CRAFT_BATCH, always(0));
  assert.deepEqual(out.cards.map((c) => c.pity), [false, false, false, false, true, false, false, false, false, false]);
}
{
  // Si el sorteo ya dio una con poder justo en la asegurada, queda la del sorteo.
  const out = craftCards({ crafted: 49 }, { moonshards: 1000 }, 1, always(0.99999));
  assert.equal(out.cards[0].tier, 'mythic', 'la garantía no le quita una Mítica');
  assert.equal(out.cards[0].pity, true);
  assert.equal(out.cards[0].symbols.length, 3);
}
console.log('✓ la garantía y el precio ok');

// ---- las llaves -------------------------------------------------------------------
// Cada llave paga una carta en vez de los Moonshards (ver `KEY_ODDS`): la común es lo
// mismo que crear con Moonshards, chances y cuenta; la de oro sale poco común o mejor,
// con su legendaria asegurada cada 50 (`GOLD_PITY`). La de oro vale diez cartas: diez comunes
// (`KEY_TRADE`) o 100 Moonshards (`KEY_COST`).
{
  const { KEY_KINDS } = await import('../src/evolution.js');
  assert.deepEqual(Object.keys(KEY_ODDS), KEY_KINDS, 'dos llaves, unas chances por cada una');
  assert.equal(KEY_ODDS.basic, null, 'la común, como crear con Moonshards');
  assert.equal(Object.values(KEY_ODDS.gold).reduce((a, b) => a + b, 0), CRAFT_ODDS_TOTAL, 'las de oro suman el total');
  // Recorre el azar de punta a punta: cuántas de cada rareza salen.
  const share = (odds) => {
    const n = 20000;
    const out = {};
    for (let i = 0; i < n; i++) {
      const t = rollTier(always((i + 0.5) / n), odds).id;
      out[t] = (out[t] ?? 0) + 1;
    }
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Math.round((v / n) * 1000) / 10]));
  };
  assert.deepEqual(share(KEY_ODDS.gold), { uncommon: 15, rare: 70, epic: 14, legendary: 0.8, mythic: 0.3 },
    'la de oro, redondeado a una décima');
  assert.deepEqual(KEY_ODDS.gold, { uncommon: 1500, rare: 7000, epic: 1400, legendary: 75, mythic: 25 });
  assert.deepEqual(share(KEY_ODDS.basic), share(null), 'la común: las de crear');
  // Contra las diez cartas que vale: más raras y más míticas por suerte.
  const p = (id) => tier(id).weight / CRAFT_ODDS_TOTAL;
  const g = (id) => (KEY_ODDS.gold[id] ?? 0) / CRAFT_ODDS_TOTAL;
  for (const id of ['rare', 'mythic']) assert.ok(g(id) > KEY_TRADE * p(id), `la de oro gana en ${id}`);
  assert.equal(g('common'), 0, 'la de oro nunca da una común');

  const keys = { basic: 2, gold: 1 };
  const wallet = { moonshards: 7, keys };
  assert.equal(craftBlock(wallet, 2, 'basic'), null);
  assert.equal(craftBlock(wallet, 3, 'basic'), 'keys', 'no alcanzan las llaves');
  assert.equal(craftBlock(wallet, 2, 'gold'), 'keys');
  assert.equal(craftBlock(wallet, 1, 'power'), 'key', 'la de poder ya no existe');
  assert.equal(craftBlock(wallet, 1, 'nada'), 'key', 'no es una llave');
  assert.equal(craftBlock({ moonshards: 0 }, 1, 'basic'), 'keys', 'una bolsa vieja, sin llaves');

  const gold = craftCards({ crafted: 0, gold: 0 }, wallet, 1, makeRng(3), { key: 'gold' });
  assert.equal(gold.cards.length, 1);
  assert.notEqual(gold.cards[0].tier, 'common', 'la de oro nunca da una común');
  assert.deepEqual(gold.wallet, { moonshards: 7, keys: { basic: 2, gold: 0 } }, 'cobra la llave y no los Moonshards');
  assert.deepEqual(gold.state, { crafted: 0, gold: 1 }, 'cuenta en la suya, no en la de los Moonshards');
  const none = craftCards({ crafted: 0 }, gold.wallet, 1, makeRng(3), { key: 'gold' });
  assert.equal(none.cards.length, 0, 'sin llave de oro no sale nada');
  assert.equal(none.wallet, gold.wallet);
  const plain = craftCards({ crafted: 0, gold: 0 }, wallet, 2, makeRng(3), { key: 'basic' });
  assert.deepEqual(plain.state, { crafted: 2, gold: 0 }, 'la común cuenta como una de Moonshards');
  const moons = craftCards({ crafted: 0 }, { moonshards: CRAFT_COST, keys }, 1, always(0));
  assert.deepEqual(moons.wallet.keys, keys, 'pagar con Moonshards no toca las llaves');
  const sure = craftCards({ crafted: CRAFT_PITY - 1 }, wallet, 1, always(0), { key: 'basic' });
  assert.equal(sure.cards[0].pity, true, 'la 50 con llave común también trae poder');
  assert.ok(tier(sure.cards[0].tier).power);
  // La de oro: cada 50, una legendaria.
  assert.equal(GOLD_PITY, 50);
  assert.equal(goldPityLeft({ gold: 0 }), 50);
  assert.equal(goldPityLeft({}), 50, 'una cuenta vieja, sin la de oro');
  assert.equal(goldPityLeft({ gold: 49 }), 1);
  const lucky = { moonshards: 0, keys: { basic: 0, gold: 3 } };
  const legend = craftCards({ crafted: 0, gold: GOLD_PITY - 1 }, lucky, 1, always(0), { key: 'gold' });
  assert.equal(legend.cards[0].tier, 'legendary', 'la 50 de oro es legendaria');
  assert.equal(legend.cards[0].pity, true);
  const before = craftCards({ crafted: 0, gold: GOLD_PITY - 2 }, lucky, 1, always(0), { key: 'gold' });
  assert.equal(before.cards[0].tier, 'uncommon', 'la 49 sale como venga');
  // Conseguirla: diez comunes o 100 Moonshards, lo mismo que diez cartas.
  assert.equal(KEY_TRADE, 10);
  assert.deepEqual(KEY_COST, { gold: KEY_TRADE * CRAFT_COST });
  assert.deepEqual(tradeKeys({ moonshards: 5, keys: { basic: 23, gold: 1 } }, 2), { moonshards: 5, keys: { basic: 3, gold: 3 } });
  assert.equal(tradeKeys({ moonshards: 500, keys: { basic: 9, gold: 0 } }), null, 'no alcanzan');
  assert.equal(tradeKeys({ moonshards: 500 }), null, 'una bolsa vieja, sin llaves');
  assert.deepEqual(buyKeys({ moonshards: 250, keys }, 'gold', 2), { moonshards: 50, keys: { basic: 2, gold: 3 } });
  assert.equal(buyKeys({ moonshards: 99, keys }, 'gold'), null, 'no alcanza');
  assert.equal(buyKeys({ moonshards: 500, keys }, 'basic'), null, 'la común no se vende: es crear');
  assert.deepEqual(buyKeys({ moonshards: 100 }, 'gold').keys, { gold: 1 }, 'una bolsa vieja, sin llaves');
}
console.log('✓ las llaves ok');

// ---- lo guardado ----------------------------------------------------------------------
assert.deepEqual(cleanCraft(null), { crafted: 0, gold: 0 });
assert.deepEqual(cleanCraft({ crafted: -4, gold: 'x' }), { crafted: 0, gold: 0 });
assert.deepEqual(cleanCraft({ crafted: '12.9', gold: 3, otra: 1 }), { crafted: 12, gold: 3 });
assert.deepEqual(readCraft(), { crafted: 0, gold: 0 }, 'sin nada guardado arranca en cero');
writeCraft({ crafted: 51, gold: 7 });
assert.deepEqual(JSON.parse(memoria.get(CRAFT_KEY)), { crafted: 51, gold: 7 });
assert.deepEqual(readCraft(), { crafted: 51, gold: 7 });
memoria.set(CRAFT_KEY, '{roto');
assert.deepEqual(readCraft(), { crafted: 0, gold: 0 }, 'lo roto se ignora');
console.log('✓ lo guardado ok');

// ---- a la mochila y a la partida ------------------------------------------------------
{
  const out = craftCards({ crafted: 0 }, { moonshards: 1000 }, CRAFT_BATCH, makeRng(11));
  const before = readBackpack();
  const bag = addToBackpack(before, out.cards);
  assert.equal(looseCards(bag).length, looseCards(before).length + CRAFT_BATCH, 'las diez entran sueltas');
  const added = bag.items.slice(-CRAFT_BATCH);
  assert.ok(added.every((it) => !('tier' in it) && !('pity' in it)), 'a la mochila va la carta, no el sorteo');
  assert.deepEqual(added.map(({ symbols, power }) => ({ symbols, power })),
    out.cards.map(({ symbols, power }) => ({ symbols, power })));
  // Dos del mismo símbolo en una carta: en la partida la racha avanza de a dos.
  const [twin] = extraCards([{ symbols: ['plant', 'plant'] }]);
  const chain = playCard(playCard(emptyChain(), { symbols: ['plant'] }), twin);
  assert.equal(chain.runs.find((r) => r.symbol === 'plant').length, 3, 'la carta de dos Planta suma dos');
}
console.log('✓ a la mochila ok');

// Reciclar: una carta suelta se rompe y devuelve el 10 % de lo que vale su rareza.
{
  assert.equal(SCRAP_RATE, 0.1);
  const ladder = CRAFT_TIERS.map((t) => CARD_VALUE[t.id]);
  assert.ok(ladder.every((v, i) => !i || v > ladder[i - 1]), 'cuanto más rara, más vale');
  assert.equal(CARD_VALUE.common, CRAFT_COST, 'la común vale lo que cuesta crearla');
  const sample = {
    common: { symbols: ['plant'] },
    uncommon: { symbols: ['plant', 'bird'] },
    rare: { symbols: ['plant', 'bird', 'bug'] },
    epic: { symbols: ['plant'], power: 'poison' },
    legendary: { symbols: ['plant', 'bird'], power: 'poison' },
    mythic: { symbols: ['plant', 'bird', 'bug'], power: 'poison' },
  };
  for (const [id, card] of Object.entries(sample)) {
    assert.equal(scrapValue(card), Math.round(CARD_VALUE[id] * SCRAP_RATE), `${id} devuelve el 10 %`);
  }
  assert.deepEqual(Object.values(sample).map(scrapValue), [1, 3, 8, 25, 80, 300]);
  assert.equal(scrapValue({ symbols: ['beast', 'aquatic'], power: 'freegame' }), 3, 'el Rocket del paquete es poco común');

  const bag = {
    next: 4,
    items: [
      { id: 'b1', ...sample.rare, power: null, axie: null },
      { id: 'b2', ...sample.mythic, axie: 'buba' },
      { id: 'b3', ...sample.common, power: null, axie: null },
    ],
  };
  const out = scrapCards(bag, { moonshards: 5 }, ['b1', 'b2', 'b3', 'nada']);
  assert.deepEqual(out.cards.map((c) => c.id), ['b1', 'b3'], 'solo las sueltas: la puesta en un Axie no');
  assert.equal(out.gained, 9);
  assert.equal(out.wallet.moonshards, 14, 'lo que devuelven entra a la bolsa');
  assert.deepEqual(out.bag.items.map((c) => c.id), ['b2'], 'y salen de la mochila');
  assert.equal(out.bag.next, 4, 'los ids no se reusan');
  assert.equal(bag.items.length, 3, 'sin tocar la mochila de antes');
  const none = scrapCards(bag, { moonshards: 5 }, ['b2']);
  assert.equal(none.bag, bag, 'sin nada que reciclar, todo igual');
  assert.equal(none.gained, 0);
}
console.log('✓ reciclar ok');

// Fusionar: tres sueltas iguales hacen una de la rareza siguiente. Casi siempre quedan
// sus símbolos (y su poder) y se suma uno al azar; de rara a épica queda uno de los tres
// con un poder de su clase.
{
  assert.equal(MERGE_COPIES, 3);
  const c = (symbols, power = null) => ({ symbols, power });
  // Iguales: los mismos símbolos con sus repetidos, sin importar el orden, y el mismo poder.
  assert.equal(cardKey(c(['plant', 'bird'])), cardKey(c(['bird', 'plant'])), 'el orden no importa');
  assert.notEqual(cardKey(c(['plant', 'plant'])), cardKey(c(['plant'])), 'los repetidos sí');
  assert.notEqual(cardKey(c(['plant'], 'poison')), cardKey(c(['plant'], 'pot')), 'y el poder también');
  assert.notEqual(cardKey(c(['plant'], 'poison')), cardKey(c(['plant'])));

  // La escalera: cada rareza sube a la siguiente; la mítica es la última.
  const ladder = {
    common: c(['bug']),
    uncommon: c(['plant', 'bird']),
    rare: c(['plant', 'plant', 'bug']),
    epic: c(['bird'], 'egg'),
    legendary: c(['beast', 'bird'], 'egg'),
    mythic: c(['beast', 'bird', 'bug'], 'egg'),
  };
  assert.deepEqual(Object.values(ladder).map((card) => mergeTier(card)?.id ?? null),
    ['uncommon', 'rare', 'epic', 'legendary', 'mythic', null]);
  assert.equal(mergeResult(ladder.mythic), null, 'la mítica no se fusiona');
  assert.equal(mergeTier(c(['beast', 'aquatic'], 'freegame')), null, 'el Rocket del paquete no se fusiona');

  /** Lo que queda de `out` después de sacarle los símbolos de `kept`, uno por uno. */
  const extra = (out, kept) => {
    const rest = [...out.symbols];
    for (const s of kept) rest.splice(rest.indexOf(s), 1);
    return rest;
  };
  const added = { common: new Set(), epic: new Set() };
  let twin = false;
  const keptCount = { plant: 0, bug: 0 };
  const keptPowers = { plant: new Set(), bug: new Set() };
  for (let seed = 1; seed <= 3000; seed++) {
    const rng = makeRng(seed);
    for (const id of ['common', 'uncommon', 'epic', 'legendary']) {
      const card = ladder[id];
      const out = mergeResult(card, rng);
      assert.equal(tierOf(out).id, mergeTier(card).id, `${id}: sale una ${mergeTier(card).id}`);
      assert.equal(out.power, card.power, `${id}: el poder queda`);
      const rest = extra(out, card.symbols);
      assert.equal(rest.length, 1, `${id}: quedan sus símbolos y suma uno`);
      if (id === 'common') { added.common.add(rest[0]); twin ||= rest[0] === 'bug'; }
      if (id === 'epic') added.epic.add(rest[0]);
    }
    const epic = mergeResult(ladder.rare, rng);
    assert.equal(tierOf(epic).id, 'epic');
    assert.equal(epic.symbols.length, 1, 'de rara a épica queda uno');
    const [kept] = epic.symbols;
    assert.ok(kept in keptCount, 'uno de los tres');
    assert.ok(CLASS_POWERS[kept].includes(epic.power), 'con un poder de su clase');
    keptCount[kept] += 1;
    keptPowers[kept].add(epic.power);
  }
  assert.equal(added.common.size, SYMBOL_IDS.length, 'el que se suma sale de las seis clases');
  assert.equal(added.epic.size, SYMBOL_IDS.length);
  assert.ok(twin, 'y puede repetir uno que ya tiene');
  const share = keptCount.plant / 3000;
  assert.ok(share > 0.63 && share < 0.7, `el repetido tiene dos de tres chances (${share})`);
  assert.equal(keptPowers.plant.size, 5, 'cualquiera de los cinco poderes de su clase');
  assert.equal(keptPowers.bug.size, 5);
  // Con el azar fijo: el primero de cada lista.
  assert.deepEqual(mergeResult(ladder.rare, always(0)), { symbols: ['plant'], power: CLASS_POWERS.plant[0] });

  // Los grupos: solo las sueltas, solo lo que se fusiona, de la rareza más alta a la más baja.
  const loose = (id, card, axie = null) => ({ id, ...card, axie });
  const bag = cleanBackpack({
    next: 20,
    items: [
      loose('b1', ladder.common),
      loose('b2', ladder.common),
      loose('b3', ladder.common, 'buba'),
      loose('b4', ladder.common),
      loose('b5', ladder.uncommon),
      loose('b6', c(['bird', 'plant'])),
      loose('b7', ladder.uncommon),
      loose('b8', ladder.mythic),
      loose('b9', ladder.mythic),
      loose('b10', ladder.mythic),
      loose('b11', c(['beast', 'aquatic'], 'freegame')),
      loose('b12', ladder.epic),
    ],
  });
  const groups = mergeGroups(bag);
  assert.deepEqual(groups.map((g) => [g.tier, g.next, g.ids]), [
    ['uncommon', 'rare', ['b5', 'b6', 'b7']],
    ['common', 'uncommon', ['b1', 'b2', 'b4']],
  ], 'la puesta en un Axie no cuenta; la mítica y el Rocket no se fusionan');
  assert.deepEqual(groups[1].card, ladder.common);
  assert.deepEqual(mergeGroups(bag, { all: true }).map((g) => g.ids.length), [1, 3, 3], 'con `all`, también las que no llegan');
  // La colección: una pila por carta distinta, con todas sus copias, también las puestas.
  const stacks = stacksOf(bag);
  assert.deepEqual(stacks.map((st) => [st.tier, st.loose.length, st.worn.length]), [
    ['mythic', 3, 0], ['epic', 1, 0], ['uncommon', 3, 0], ['uncommon', 1, 0], ['common', 3, 1],
  ], 'de la más rara a la más común, y a igual rareza, la que tiene más copias primero');
  assert.deepEqual(stacks.find((st) => st.tier === 'common').worn, [{ id: 'b3', axie: 'buba' }], 'la puesta, con quién la tiene');
  assert.equal(stacks[0].next, null, 'la mítica no sube');
  assert.equal(stacks.find((st) => st.card.power === 'freegame').next, null, 'el Rocket tampoco');
  assert.equal(stacks.reduce((n, st) => n + st.loose.length + st.worn.length, 0), bag.items.length, 'ninguna carta se pierde');

  // Fusionar: se van tres sueltas y entra la nueva, suelta, con un id que no se repite.
  const key = cardKey(ladder.common);
  const out = mergeCards(bag, key, always(0));
  assert.deepEqual(out.used.map((it) => it.id), ['b1', 'b2', 'b4']);
  assert.deepEqual(out.card, { id: 'b20', symbols: ['beast', 'bug'], power: null, axie: null, tier: 'uncommon' });
  assert.deepEqual(out.bag.items.map((it) => it.id), ['b3', 'b5', 'b6', 'b7', 'b8', 'b9', 'b10', 'b11', 'b12', 'b20']);
  assert.equal(out.bag.next, 21);
  assert.deepEqual(cleanBackpack(out.bag), out.bag, 'la mochila nueva vale como guardada');
  assert.equal(bag.items.length, 12, 'sin tocar la mochila de antes');
  const again = mergeCards(out.bag, key);
  assert.equal(again.bag, out.bag, 'con una sola suelta no alcanza: todo igual');
  assert.equal(again.card, null);
  assert.equal(mergeCards(bag, cardKey(ladder.mythic)).card, null, 'tres míticas no se fusionan');
}
console.log('✓ fusionar ok');

console.log('✓ crafteo ok');
