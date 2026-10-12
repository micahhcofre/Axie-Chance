// La mochila (ver `backpack.js`): cartas sueltas que se le ponen a un Axie desde su
// inventario y viajan con él a la partida (`extras` en `newMatch`).
import assert from 'node:assert/strict';

const memoria = new Map();
globalThis.localStorage = {
  getItem: (k) => memoria.get(k) ?? null,
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
};

const {
  BACKPACK_KEY, STARTER_PACK, readBackpack, writeBackpack, cleanBackpack, equip, unequip,
  equippedOn, looseCards, extrasOf, addToBackpack,
} = await import('../src/backpack.js');
const { EXTRA_SLOTS, cleanExtras, extraCards } = await import('../src/data.js');
const { cleanLoadout } = await import('../src/loadout.js');
const { createGame } = await import('../src/game.js');
const { AXIE_IDS } = await import('../src/axies.js');

// ---- la primera vez: el paquete de bienvenida, todo suelto y guardado ----------
let bag = readBackpack();
assert.equal(bag.items.length, STARTER_PACK.length, 'la mochila arranca con el paquete de bienvenida');
assert.ok(bag.items.every((it) => it.axie === null), 'todo suelto');
assert.ok(memoria.has(BACKPACK_KEY), 'y queda guardada');
console.log('✓ el paquete de bienvenida ok');

// ---- poner y sacar ---------------------------------------------------------
const [a, b] = AXIE_IDS;
bag = equip(bag, bag.items[0].id, a);
assert.equal(equippedOn(bag, a).length, 1);
assert.equal(looseCards(bag).length, STARTER_PACK.length - 1, 'la carta puesta deja de estar suelta');
// Es una sola: ponérsela a otro se la saca al primero.
bag = equip(bag, equippedOn(bag, a)[0].id, b);
assert.equal(equippedOn(bag, a).length, 0);
assert.equal(equippedOn(bag, b).length, 1);
bag = unequip(bag, equippedOn(bag, b)[0].id);
assert.equal(looseCards(bag).length, STARTER_PACK.length, 'la × la devuelve a la mochila');
// Tope de espacios.
bag = addToBackpack(bag, [{ symbols: ['bird'] }, { symbols: ['bug', 'bird'] }, { symbols: ['nada'] }]);
assert.equal(bag.items.length, STARTER_PACK.length + 2, 'lo que no es una carta no entra');
for (const it of looseCards(bag)) bag = equip(bag, it.id, a);
assert.equal(equippedOn(bag, a).length, EXTRA_SLOTS, `no más de ${EXTRA_SLOTS} por Axie`);
writeBackpack(bag);
assert.deepEqual(readBackpack(), bag, 'se guarda y se relee igual');
// Lo que viene roto de afuera se limpia: ids repetidos, Axies que no existen, de más.
const rota = cleanBackpack({ items: [
  { id: 'x', symbols: ['plant'], axie: 'nadie' },
  { id: 'x', symbols: ['beast'] },
  ...Array.from({ length: 6 }, (_, i) => ({ id: `y${i}`, symbols: ['bird'], axie: a })),
] });
assert.equal(rota.items.length, 7);
assert.equal(rota.items[0].axie, null, 'un Axie que no existe deja la carta suelta');
assert.equal(equippedOn(rota, a).length, EXTRA_SLOTS, 'lo que sobra de un Axie lleno queda suelto');
console.log('✓ poner, sacar, tope y limpieza ok');

// ---- lo que cruza el cable -------------------------------------------------
assert.deepEqual(cleanExtras([{ symbols: ['beast', 'plant'] }, { symbols: ['x'] }, { symbols: [] },
  { symbols: ['a', 'b', 'c', 'd'] }, { symbols: ['bird'], power: 'inventado' }]),
[{ symbols: ['beast', 'plant'], power: null }, { symbols: ['bird'], power: null }]);
assert.equal(cleanExtras(Array(9).fill({ symbols: ['bird'] })).length, EXTRA_SLOTS, 'no más que los espacios');
assert.deepEqual(cleanLoadout({ axie: a, boosts: {}, extras: 'bomba' }).extras, [], 'basura no es una lista');
console.log('✓ cartas limpias para la sala ok');

// ---- llegan a la partida ---------------------------------------------------
const extras = extrasOf(bag, a);
const game = createGame({ pace: 0, seed: 7, clock: null });
game.newMatch({ mode: 'cpu', axie: a, extras });
const { state } = game;
assert.equal(state.start.p1.length, 8 + EXTRA_SLOTS, 'el mazo de la partida suma las cartas de la mochila');
assert.deepEqual(state.start.p1.slice(8).map((c) => c.symbols), extraCards(extras).map((c) => c.symbols));
assert.equal(state.start.p2.length, 8, 'la CPU no lleva mochila');
game.newMatch({});
assert.equal(game.state.start.p1.length, 8 + EXTRA_SLOTS, '"Jugar de nuevo" repite las mismas cartas');
game.abortMatch?.();
console.log('✓ las cartas de la mochila entran al mazo de la partida');
console.log('✓ mochila ok');
