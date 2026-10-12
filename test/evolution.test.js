// La evolución de los Axies del roster (ver `evolution.js` y docs/economy.md): el nivel,
// la experiencia, los Moonshards, qué carta evoluciona y qué símbolo suma, el dibujo
// evolucionado y que todo eso llegue a la partida y a la sala.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const memoria = new Map();
globalThis.localStorage = {
  getItem: (k) => memoria.get(k) ?? null,
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
};
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

const {
  MAX_LEVEL, EVOLVE_STEP, EVOLVE_COSTS, LEVEL_UP_SHARDS, PROGRESS_KEY, WALLET_KEY, KEY_KINDS,
  axpNeed, axpAt, levelInfo, evolveSlots, nextEvolution, evolveBlock, evolveCard, gainAxp,
  cleanProgress, readProgress, writeProgress, readWallet, writeWallet, recordOf, playingId, evolveSymbol, countMatch,
} = await import('../src/evolution.js');
const { AXIES, AXIE_IDS, STARTERS, PART_TYPES, axie, axieArt, deckFor, evolvedId, cleanEvolved } = await import('../src/axies.js');
const { EVOLVED } = await import('../src/axie-avatars.js');
const { POSES, VARIANTS, MOTIONS } = await import('../src/axie-poses.js');
const { buildPersonalDeck } = await import('../src/data.js');
const { cleanLoadout } = await import('../src/loadout.js');
const { createGame } = await import('../src/game.js');

// ---- el nivel -----------------------------------------------------------------
assert.equal(axpNeed(1), 30, 'el primer nivel pide 30');
assert.equal(axpNeed(59), 320, 'el último, 320');
assert.deepEqual(levelInfo(0), { level: 1, into: 0, need: 30, frac: 0, max: false });
assert.equal(levelInfo(29).level, 1);
assert.equal(levelInfo(30).level, 2, 'con 30 sube al 2');
assert.equal(levelInfo(axpAt(10)).level, 10);
assert.equal(levelInfo(axpAt(10) - 1).level, 9);
assert.equal(axpAt(MAX_LEVEL), 10325, 'del 1 al 60 son 10.325 de experiencia (ver docs/economy.md)');
assert.deepEqual(levelInfo(axpAt(MAX_LEVEL) + 5000), { level: MAX_LEVEL, into: 0, need: 0, frac: 1, max: true },
  'en el 60 la barra queda llena y no sigue');
assert.equal(levelInfo(-50).level, 1, 'lo negativo no resta niveles');
console.log('✓ el nivel ok');

// ---- las evoluciones que abre cada nivel ---------------------------------------
assert.deepEqual([1, 9, 10, 19, 20, 35, 59, 60].map(evolveSlots), [0, 0, 1, 1, 2, 3, 5, 6]);
assert.equal(EVOLVE_STEP, 10);
assert.deepEqual(EVOLVE_COSTS, [300, 600, 900, 1200, 1500, 2000], 'los precios de docs/economy.md');
const fresh = { axp: 0, evolved: [] };
assert.deepEqual(nextEvolution(fresh), { index: 0, level: 10, cost: 300 });
assert.deepEqual(nextEvolution({ axp: 0, evolved: ['horn', 'eyes'] }), { index: 2, level: 30, cost: 900 });
assert.equal(nextEvolution({ axp: 0, evolved: PART_TYPES }), null, 'con las seis no hay próxima');
console.log('✓ las evoluciones de cada nivel ok');

// ---- por qué no se puede ----------------------------------------------------------
const rich = { moonshards: 99999 };
assert.equal(evolveBlock(fresh, rich, 'horn'), 'level', 'en el nivel 1 todavía no se abre');
const at10 = { axp: axpAt(10), evolved: [] };
assert.equal(evolveBlock(at10, { moonshards: 299 }, 'horn'), 'shards', 'sin plata no');
assert.equal(evolveBlock(at10, { moonshards: 300 }, 'horn'), null, 'con nivel y plata, sí');
assert.equal(evolveBlock(at10, rich, 'cola'), 'part', 'una parte que no existe');
assert.equal(evolveBlock({ axp: axpAt(20), evolved: ['horn'] }, rich, 'horn'), 'evolved', 'la misma dos veces no');
assert.equal(evolveBlock({ axp: axpAt(19), evolved: ['horn'] }, rich, 'tail'), 'level', 'la segunda pide el nivel 20');
assert.equal(evolveBlock({ axp: axpAt(60), evolved: PART_TYPES.slice(0, 5) }, rich, 'eyes'), null);
console.log('✓ por qué no se puede ok');

// ---- evolucionar --------------------------------------------------------------------
{
  const progress = { buba: { axp: axpAt(25), evolved: [] } };
  let wallet = { moonshards: 1000 };
  let p = progress;
  ({ progress: p, wallet } = evolveCard(p, wallet, 'buba', 'tail'));
  assert.deepEqual(p.buba.evolved, ['tail']);
  assert.equal(wallet.moonshards, 700, 'la primera cuesta 300');
  ({ progress: p, wallet } = evolveCard(p, wallet, 'buba', 'horn'));
  assert.deepEqual(p.buba.evolved, ['horn', 'tail'], 'en el orden canónico');
  assert.equal(wallet.moonshards, 100, 'la segunda, 600');
  const same = evolveCard(p, wallet, 'buba', 'eyes');
  assert.equal(same.progress, p, 'en el 25 no abre la tercera: nada cambia');
  assert.equal(same.wallet, wallet);
  assert.equal(evolveCard(p, rich, 'lobo', 'eyes').progress, p, 'un rival no se evoluciona desde acá');
  assert.equal(progress.buba.evolved.length, 0, 'no toca lo que recibe');
}
console.log('✓ evolucionar ok');

// ---- la experiencia y los Moonshards de cada subida ---------------------------------
{
  const got = gainAxp({}, { moonshards: 0 }, 'buba', 30);
  assert.deepEqual(got.levels, [2], 'con 30 sube al 2');
  assert.equal(got.wallet.moonshards, LEVEL_UP_SHARDS, 'y paga 5');
  const all = gainAxp({}, { moonshards: 0 }, 'momo', axpAt(MAX_LEVEL));
  assert.equal(all.levels.length, 59);
  assert.equal(all.wallet.moonshards, 295, 'del 1 al 60, 295 Moonshards (ver docs/economy.md)');
  const none = gainAxp({}, { moonshards: 7 }, 'momo', 0);
  assert.deepEqual(none, { progress: {}, wallet: { moonshards: 7 }, levels: [] }, 'sin experiencia no pasa nada');
}
console.log('✓ la experiencia ok');

// ---- lo guardado --------------------------------------------------------------------
assert.deepEqual(readProgress(), {}, 'sin nada guardado, todos en el 1');
const noKeys = { basic: 0, gold: 0 };
assert.deepEqual(readWallet(), { moonshards: 0, keys: noKeys });
writeProgress({ buba: { axp: axpAt(20), evolved: ['horn', 'tail'] } });
writeWallet({ moonshards: 1234 });
assert.deepEqual(readProgress(), { buba: { axp: axpAt(20), evolved: ['horn', 'tail'] } });
assert.deepEqual(readWallet(), { moonshards: 1234, keys: noKeys });
assert.ok(memoria.has(PROGRESS_KEY) && memoria.has(WALLET_KEY));
// Lo que se lee se limpia: puede venir de una versión anterior o de la consola.
assert.deepEqual(cleanProgress({
  buba: { axp: axpAt(10), evolved: ['horn', 'tail', 'eyes', 'nariz', 'horn'] },
  lobo: { axp: 500 },
  momo: { axp: -3, evolved: 'horn' },
  olek: null,
}), { buba: { axp: axpAt(10), evolved: ['horn'] } },
'solo los del roster, y nunca más evoluciones que las que abre su nivel');
memoria.set(WALLET_KEY, '{"moonshards":"mucho"}');
assert.deepEqual(readWallet(), { moonshards: 0, keys: noKeys });
// Las llaves del pase (ver `missions.js`) viven en la misma bolsa, y se limpian igual.
memoria.set(WALLET_KEY, '{"moonshards":5,"keys":{"basic":2,"gold":-1,"power":"x","otra":9}}');
assert.deepEqual(readWallet(), { moonshards: 5, keys: { basic: 2, gold: 0 } });
assert.deepEqual(KEY_KINDS, ['basic', 'gold']);
// Las llaves de poder que quedaron guardadas de antes pasan a ser de oro.
memoria.set(WALLET_KEY, '{"moonshards":5,"keys":{"basic":1,"gold":2,"power":1}}');
assert.deepEqual(readWallet(), { moonshards: 5, keys: { basic: 1, gold: 3 } });
{
  // Lo que arma una bolsa nueva a partir de otra no le borra las llaves.
  const keys = { basic: 3, gold: 1 };
  assert.deepEqual(gainAxp({}, { moonshards: 0, keys }, 'buba', 30).wallet.keys, keys, 'subir de nivel');
  const ready = { buba: { axp: axpAt(10), evolved: [] } };
  assert.deepEqual(evolveCard(ready, { moonshards: 300, keys }, 'buba', 'horn').wallet, { moonshards: 0, keys }, 'evolucionar');
}
memoria.set(PROGRESS_KEY, 'no es json');
assert.deepEqual(readProgress(), {});
assert.deepEqual(recordOf({}, 'buba'), { axp: 0, evolved: [] });
assert.deepEqual(cleanProgress({ momo: { played: 4.7 }, olek: { axp: 3, played: -1 } }),
  { momo: { axp: 0, evolved: [], played: 4 }, olek: { axp: 3, evolved: [] } }, 'las partidas jugadas, enteras y ≥ 0');
assert.deepEqual(countMatch(countMatch({}, 'momo'), 'momo'), { momo: { axp: 0, evolved: [], played: 2 } }, 'cada partida suma una');
assert.deepEqual(countMatch({}, 'lobo'), {}, 'solo los del roster');
console.log('✓ lo guardado ok');

// ---- el id evolucionado ----------------------------------------------------------------
assert.equal(evolvedId('buba', []), 'buba');
assert.equal(evolvedId('buba', ['tail', 'horn', 'nariz', 'horn']), 'buba~horn.tail', 'sin repetir y en orden');
assert.equal(evolvedId('buba~eyes', ['tail']), 'buba~tail', 'de un id evolucionado sale el del roster');
assert.deepEqual(cleanEvolved(['ears', 'x', 'eyes']), ['ears', 'eyes']);
assert.deepEqual(cleanEvolved('horn'), []);
{
  const a = axie('buba~tail.horn');
  assert.equal(a.id, 'buba~horn.tail', 'el id queda en su forma canónica');
  assert.equal(a.base, 'buba');
  assert.deepEqual(a.evolved, ['horn', 'tail']);
  assert.equal(a.name, 'Buba');
  assert.equal(axie('buba~').id, 'buba', 'sin partes es el de siempre');
  assert.equal(axie('buba~nariz').id, 'buba');
  assert.equal(playingId({ buba: { axp: 0, evolved: ['eyes'] } }, 'buba'), 'buba~eyes');
}
console.log('✓ el id evolucionado ok');

// ---- el mazo: la carta suma la clase de **esa** parte ---------------------------------
const fav = (id) => Object.fromEntries(deckFor(id).filter((c) => c.isFavorable).map((c) => [c.associatedPart, c.symbols]));
for (const id of Object.keys(STARTERS)) {
  assert.deepEqual(deckFor(id).map((c) => c.symbols), buildPersonalDeck(AXIES[id].class).map((c) => c.symbols),
    `${id}: sus partes del kit no cambian el mazo hasta que evolucionan`);
}
// Buba es bestia con el cuerno y la espalda de planta.
assert.deepEqual(fav('buba~horn').horn.slice().sort(), ['beast', 'plant', 'reptile'], 'el cuerno de Buba suma planta');
assert.deepEqual(fav('buba~tail').tail, ['beast', 'beast'], 'su cola es de bestia: suma bestia');
assert.equal(evolveSymbol('buba', 'horn'), 'plant');
assert.equal(evolveSymbol('buba', 'eyes'), 'beast');
// Las partes Mech, Dawn y Dusk cuentan como de la clase del Axie (por ahora).
assert.equal(evolveSymbol('pomodoro', 'horn'), 'bug', 'el cuerno Mech de Pomodoro suma bicho');
assert.equal(evolveSymbol('olek', 'horn'), 'plant');
assert.equal(evolveSymbol('olek', 'ears'), 'reptile', 'las orejas de Olek son de reptil');
// Los del mixer del roster son puros: siempre su propio símbolo.
for (const id of AXIE_IDS.filter((x) => AXIES[x].parts)) {
  for (const part of PART_TYPES) assert.equal(evolveSymbol(id, part), AXIES[id].class, `${id}/${part}`);
}
// Las desfavorables no evolucionan nunca.
{
  const plain = deckFor('momo').filter((c) => !c.isFavorable).map((c) => c.symbols);
  const all = deckFor(evolvedId('momo', PART_TYPES)).filter((c) => !c.isFavorable).map((c) => c.symbols);
  assert.deepEqual(all, plain, 'con las seis evolucionadas, las dos desfavorables siguen igual: hay chance');
}
console.log('✓ el mazo evolucionado ok');

// ---- el dibujo ----------------------------------------------------------------------
assert.deepEqual(Object.keys(EVOLVED).sort(), [...AXIE_IDS].sort(), 'todos los del roster tienen su pila evolucionada');
for (const id of AXIE_IDS) {
  const drawn = [...new Set(EVOLVED[id].layers.filter((l) => l.lv2).map((l) => l.part))].sort();
  const want = AXIES[id].parts ? [...PART_TYPES].sort() : [...STARTERS[id].awake].sort();
  assert.deepEqual(drawn, want, `${id}: los del mixer cambian las seis partes; los starters, la que despierta`);
  assert.ok(POSES[`${id}@evo`], `${id}: le falta la pose evolucionada — falta correr \`npm run poses\``);
  assert.ok(POSES[id].evolve, `${id}: le falta el clip de evolucionar`);
}
assert.equal(MOTIONS.evolve.from, 'activity/evolve');
{
  // Los de cada capítulo se cargan cuando hacen falta (ver `rival-poses.js`).
  const { loadRivalPoses } = await import('../src/rival-poses.js');
  const { adventureChapters } = await import('../src/adventure.js');
  const inBase = Object.keys(POSES).filter((k) => !AXIES[k] && !k.endsWith('@evo')).length;
  for (const ch of adventureChapters()) await loadRivalPoses(ch.n);
  const rivals = Object.keys(POSES).filter((k) => !AXIES[k] && !k.endsWith('@evo'));
  assert.ok(inBase <= 12, 'la base trae solo los del primer capítulo');
  assert.ok(rivals.length > inBase, 'los demás capítulos se cargan aparte');
  assert.ok(rivals.every((k) => !POSES[k].evolve), 'los rivales no llevan el clip de evolucionar');
}
{
  const look = axieArt('buba~horn');
  assert.match(look, /data-pose="buba@evo"/, 'con el cuerno evolucionado, Buba despierta');
  assert.match(look, /Axies\/buba\/horn-lv2\.png/);
  assert.doesNotMatch(look, /Axies\/buba\/horn\.png/, 'y el cuerno de antes no se dibuja');
  assert.match(look, /data-part="horn@2"/);
  const tail = axieArt('buba~tail');
  assert.match(tail, /data-pose="buba"/, 'otra parte: se ve igual que siempre, en su marco de siempre');
  assert.doesNotMatch(tail, /-lv2/);
  const mix = axieArt('beast~eyes');
  assert.match(mix, /data-pose="beast@evo"/);
  assert.match(mix, /beast-04-lv2\/eyes/, 'Colmillo evolucionado de ojos: el arte -lv2 del mixer');
  assert.doesNotMatch(mix, /beast-12-lv2/, 'y el cuerno sigue el de siempre');
  assert.match(axieArt('beast'), /data-pose="beast"/);
  assert.match(axieArt('lobo+1'), /data-pose="lobo\+1"/, 'los rivales siguen con lo suyo');
  // Las poses evolucionadas solo guardan lo que cambia: lo de las partes nuevas, con @2.
  const evo = POSES['beast@evo'].idle;
  assert.ok(Object.keys(evo.parts).every((n) => n.endsWith('@2')), 'las pistas propias son de los dibujos evolucionados');
  assert.ok(Object.keys(VARIANTS['beast@evo']).some((n) => n.endsWith('@2')));
}
console.log('✓ el dibujo evolucionado ok');

// ---- la partida y la sala ------------------------------------------------------------
{
  const game = createGame({ pace: 0, seed: 7, clock: null });
  game.newMatch({ mode: 'cpu', axie: 'buba', evolved: ['horn'] });
  assert.equal(game.state.axies.p1, 'buba~horn', 'la partida lleva el id evolucionado');
  const horn = game.state.start.p1.find((c) => c.associatedPart === 'horn');
  assert.ok(horn.symbols.includes('plant'), 'y el mazo, la carta evolucionada');
  game.newMatch({});
  assert.equal(game.state.axies.p1, 'buba~horn', 'la revancha también');
  game.newMatch({ mode: 'net', axie: 'momo', axie2: 'olek', evolved2: ['ears', 'trucho'] });
  assert.deepEqual(game.state.axies, { p1: 'momo', p2: 'olek~ears' }, 'en una sala, cada asiento con lo suyo');
}
assert.deepEqual(cleanLoadout({ axie: 'buba', evolved: ['tail', 'horn', 'horn', 'x'] }).evolved, ['horn', 'tail'],
  'el loadout que cruza el cable lleva las evoluciones limpias');
assert.deepEqual(cleanLoadout({ axie: 'buba' }).evolved, []);
console.log('✓ la partida y la sala ok');

// ---- el Taller y la evolución en el HTML ----------------------------------------------
{
  const html = read('index.html');
  for (const [file, helper] of [['workshop.js', 'wsEl'], ['evolve-view.js', 'evEl']]) {
    const ids = [...read('src', file).matchAll(new RegExp(`\\b${helper}\\('([\\w-]+)'\\)`, 'g'))].map((m) => m[1]);
    assert.ok(ids.length >= 8, `${file}: ${ids.length} ids, ¿se dejó de buscar por id?`);
    for (const id of ids) {
      assert.match(html, new RegExp(`id="${id}"`), `${file} busca #${id} y no está en el HTML`);
    }
  }
  assert.match(html, /<symbol id="ic-moon"/, 'el Moonshard está pintado en el sprite');
  assert.match(html, /<symbol id="ic-evolve"/, 'la flecha de evolucionar también');
}
console.log('✓ el Taller y la evolución en el HTML ok');

console.log('✓ evolución ok');
