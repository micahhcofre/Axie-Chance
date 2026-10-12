import assert from 'node:assert/strict';
import {
  ADVENTURE_LEVELS, getAdventureProgress, saveAdventureProgress,
  isLevelUnlocked, markLevelCompleted, resetAdventureProgress,
  getAdventureLevel, isFinalLevel, nextLevelId, buildAdventureLevels,
  DIFFICULTY_LABELS, evolvedAt, adventurePowers, adventureChapters,
  RIVAL_LADDER, rivalKitAt, rivalExtras, adventureCharms, fromV1, levelKicker, levelTitle, rivalHpAt,
  UNLOCK_ORDER, LAST_UNLOCK, LEVEL_POWERS,
} from '../src/adventure.js';
import { ADVENTURE_CAMPAIGN } from '../src/adventure-levels.js';
import { CRAFT_TIERS, tierOf } from '../src/crafting.js';
import { CLASS_POWER_IDS, NEUTRAL_POWERS, buildPool, POWERS, SYMBOL_IDS, makeRng, EXTRA_SLOTS } from '../src/data.js';
import { axie, deckFor, RIVALS } from '../src/axies.js';
import { createGame, hpOf } from '../src/game.js';
import { isStage } from '../src/stages.js';
import { fakeDom } from './dom.mjs';
import { store } from '../src/loadout.js';

// ---- Configuración de niveles -----------------------------------------------
// Capítulos de diez con el jefe al final. Los poderes se estrenan de a poco hasta el
// 175: primero los doce neutrales, después los treinta de clase. Cada nivel pelea con
// una combinación fija y única de los ya desbloqueados.
const LAST_LEVEL = ADVENTURE_LEVELS.length;
ADVENTURE_LEVELS.forEach((lvl, i) => assert.equal(lvl.id, i + 1, `el id debe coincidir con ${i + 1}`));

const seenPowers = [];
for (const lvl of ADVENTURE_LEVELS) {
  assert.ok(!/^(Nivel|Jefe)\b|\d/.test(lvl.name), `nivel ${lvl.id}: el nombre no lleva el número ("${lvl.name}")`);
  assert.ok(lvl.id === 1 || lvl.newPowers.length <= 1, `nivel ${lvl.id}: estrena a lo sumo un poder`);
  for (const p of lvl.newPowers) {
    assert.ok(!seenPowers.includes(p), `el poder ${p} ya fue introducido en un nivel anterior`);
    seenPowers.push(p);
  }
  // Lo desbloqueado es todo lo estrenado hasta acá, en orden.
  assert.deepEqual(lvl.unlocked, seenPowers, `nivel ${lvl.id}: desbloqueados`);
}
assert.deepEqual(seenPowers, UNLOCK_ORDER, 'se estrenan en el orden del calendario');
assert.deepEqual(seenPowers.slice().sort(), [...NEUTRAL_POWERS, ...CLASS_POWER_IDS].sort(), 'están los cuarenta y dos');
assert.deepEqual(seenPowers.slice(0, NEUTRAL_POWERS.length), NEUTRAL_POWERS, 'primero los neutrales');
assert.equal(ADVENTURE_LEVELS[0].newPowers.length, 3, 'el nivel 1 trae tres');
assert.equal(ADVENTURE_LEVELS.findLast((l) => l.newPowers.length).id, LAST_UNLOCK, 'el último se estrena en el 175');
// De a poco: entre un estreno y el siguiente nunca pasan más de seis niveles.
{
  const at = ADVENTURE_LEVELS.filter((l) => l.newPowers.length).map((l) => l.id);
  at.slice(1).forEach((id, i) => assert.ok(id - at[i] <= 6 && id > at[i], `estrenos parejos: ${at[i]} → ${id}`));
}
const chapters = adventureChapters();
for (const ch of chapters) {
  assert.equal(ch.levels.length, 10, `capítulo ${ch.n}: diez niveles`);
  assert.ok(ch.levels.at(-1).boss, `capítulo ${ch.n}: termina con un jefe`);
  assert.ok(ch.levels.slice(0, -1).every((l) => !l.boss), `capítulo ${ch.n}: un solo jefe`);
}

// ---- La combinación de cada nivel -------------------------------------------------
// Fija, única y de lo ya desbloqueado: el que estrena entra siempre, un poder por clase,
// hasta seis, y todo lo desbloqueado vuelve a salir pronto.
{
  const seen = new Set();
  const last = {};
  for (const lvl of ADVENTURE_LEVELS) {
    const set = lvl.activePowers;
    assert.ok(set.length >= 1 && set.length <= LEVEL_POWERS, `nivel ${lvl.id}: entre uno y ${LEVEL_POWERS} poderes`);
    assert.ok(set.every((p) => lvl.unlocked.includes(p)), `nivel ${lvl.id}: solo desbloqueados`);
    for (const p of lvl.newPowers) assert.ok(set.includes(p), `nivel ${lvl.id}: el que estrena entra siempre`);
    const classes = set.map((p) => POWERS[p].symbol).filter(Boolean);
    assert.equal(new Set(classes).size, classes.length, `nivel ${lvl.id}: un poder por clase`);
    const key = set.slice().sort().join('+');
    assert.ok(!seen.has(key), `nivel ${lvl.id}: combinación repetida (${key})`);
    seen.add(key);
    assert.deepEqual(adventurePowers(lvl), set, `nivel ${lvl.id}: la partida usa la combinación del nivel`);
    for (const p of set) last[p] = lvl.id;
    if (lvl.id >= 30) {
      for (const p of lvl.unlocked) assert.ok(lvl.id - last[p] <= 10, `nivel ${lvl.id}: ${p} hace más de diez niveles que no sale`);
    }
  }
  assert.deepEqual(buildAdventureLevels(ADVENTURE_CAMPAIGN).map((l) => l.activePowers), ADVENTURE_LEVELS.map((l) => l.activePowers),
    'siempre las mismas combinaciones');
  assert.ok(ADVENTURE_LEVELS.slice(12).every((l) => l.activePowers.length === LEVEL_POWERS), 'desde el 13, seis poderes por nivel');
  assert.ok(ADVENTURE_LEVELS.every((l, i) => !i || l.activePowers.length >= Math.min(LEVEL_POWERS, l.unlocked.length) - 1), 'y antes, casi todo lo abierto');
}

// ---- La escalera del rival ------------------------------------------------------
// Lo que trae el rival crece de a poco y nunca baja: primero cartas de mochila de su
// clase, después esas cartas fusionadas, después partes evolucionadas. El jefe va un
// escalón arriba. Nunca más cartas que las tuyas.
const TIER_RANK = Object.fromEntries(CRAFT_TIERS.map((t, i) => [t.id, i]));
assert.equal(RIVAL_LADDER[0].from, 1, 'la escalera arranca en el 1');
assert.ok(RIVAL_LADDER.every((s, i) => !i || s.from > RIVAL_LADDER[i - 1].from), 'los escalones van en orden');
let prevKit = { extras: [], evolved: 0 };
for (let id = 1; id <= 200; id++) {
  const kit = rivalKitAt(id);
  assert.ok(kit.extras.length <= EXTRA_SLOTS, `nivel ${id}: a lo sumo ${EXTRA_SLOTS} cartas, como las tuyas`);
  assert.ok(kit.extras.length >= prevKit.extras.length, `nivel ${id}: no pierde cartas`);
  const rank = (k) => k.extras.reduce((n, t) => n + TIER_RANK[t] + 1, 0);
  assert.ok(rank(kit) >= rank(prevKit), `nivel ${id}: sus cartas no bajan de rareza`);
  assert.ok(kit.evolved >= prevKit.evolved, `nivel ${id}: no pierde evoluciones`);
  prevKit = kit;
}
assert.deepEqual(rivalKitAt(1), { extras: [], evolved: 0 }, 'el primero, pelado');
assert.deepEqual(rivalKitAt(3).extras, ['common'], 'lo primero que suma: una común');
assert.equal(evolvedAt(30), 0, 'las evoluciones llegan con la Guarida');
assert.equal(evolvedAt(31), 1);
// Nunca más evoluciones que las que tiene el jugador a esa altura (la cuarta le llega
// cerca del 165), salvo el jefe final.
assert.ok(ADVENTURE_LEVELS.slice(0, -1).every((l) => l.evolved <= 4), 'hasta cuatro, como el jugador');
assert.equal(ADVENTURE_LEVELS.at(-1).evolved, 6, 'el jefe final, con las seis');
// Las épicas llegan en lo medio y las legendarias recién en lo difícil; la mítica, solo el final.
const tiers = (l) => l.extras.map((c) => tierOf(c)?.id);
assert.ok(ADVENTURE_LEVELS.filter((l) => l.id < 80).every((l) => l.extras.every((c) => !c.power)), 'sin poderes antes del 80 (el jefe del 80 trae la primera)');
assert.ok(ADVENTURE_LEVELS.filter((l) => l.id < 170).every((l) => !tiers(l).includes('legendary')), 'legendarias desde el 170');
assert.deepEqual(ADVENTURE_LEVELS.filter((l) => tiers(l).includes('mythic')).map((l) => l.id), [200], 'la mítica, solo el final');
// La CPU: fácil en el Valle y la Costa, normal hasta el 130, dura de ahí al final.
assert.ok(ADVENTURE_LEVELS.every((l) => l.difficulty === (l.id <= 20 ? 'facil' : l.id <= 130 ? 'normal' : 'duro')), 'fácil, normal y dura');
// La vida de los rivales comunes sube por tramos (es lo que hace la curva de menos a más),
// y la de un jefe le gana a la de los comunes de su capítulo.
assert.equal(rivalHpAt(25), 130, 'en el Bosque Nevado, menos que la tuya: recién empieza la CPU normal');
assert.equal(rivalHpAt(199), 190);
{
  let prev = 0;
  for (const lvl of ADVENTURE_LEVELS.filter((l) => !l.boss && l.id > 30)) {
    const hp = lvl.hp ?? 150;
    assert.ok(hp >= prev, `nivel ${lvl.id}: la vida no baja`);
    prev = hp;
  }
  for (const b of ADVENTURE_LEVELS.filter((l) => l.boss)) {
    assert.ok(b.hp > rivalHpAt(b.id), `${b.base}: más vida que los de su capítulo`);
  }
}
assert.deepEqual(rivalKitAt(10, { boss: true }), rivalKitAt(13), 'el jefe pelea con el escalón siguiente');
for (const lvl of ADVENTURE_LEVELS) {
  const kit = rivalKitAt(lvl.id, { boss: lvl.boss });
  assert.equal(lvl.evolved, ADVENTURE_CAMPAIGN[lvl.id - 1].evolved ?? kit.evolved, `nivel ${lvl.id}: sus evoluciones (las de la escalera, o las que declara)`);
  assert.equal(axie(lvl.rival).evolved?.length ?? 0, lvl.evolved, `nivel ${lvl.id}: el rival las trae`);
  assert.equal(lvl.rival, lvl.evolved ? `${lvl.base}+${lvl.evolved}` : lvl.base);
  if (!ADVENTURE_CAMPAIGN[lvl.id - 1].extras) assert.equal(lvl.extras.length, kit.extras.length, `nivel ${lvl.id}: sus cartas de mochila`);
  const cls = axie(lvl.rival).class;
  for (const card of lvl.extras) {
    assert.ok(card.symbols.includes(cls), `nivel ${lvl.id}: cada carta lleva su clase`);
    assert.equal(new Set(card.symbols).size, card.symbols.length, `nivel ${lvl.id}: la carta de siempre, sin símbolos repetidos`);
    if (card.power) assert.ok(lvl.unlocked.includes(card.power) && POWERS[card.power].symbol === cls, `nivel ${lvl.id}: un poder de su clase y ya visto`);
    if (card.power) assert.notEqual(card.power, 'egg', `nivel ${lvl.id}: sin Secret Egg en la mochila del rival`);
  }
  assert.deepEqual(buildAdventureLevels(ADVENTURE_CAMPAIGN)[lvl.id - 1].extras, lvl.extras, `nivel ${lvl.id}: siempre las mismas`);
}
assert.deepEqual(rivalExtras(['common', 'uncommon', 'rare'], { id: 7, cls: 'bug' }).map((c) => c.symbols.length), [1, 2, 3]);
assert.throws(() => rivalExtras(['epic'], { id: 7, cls: 'bug', unlocked: [] }), /poder/, 'una épica pide un poder');
assert.equal(rivalExtras(['epic'], { id: 7, cls: 'bug', unlocked: ['pot', 'leech'] })[0].power, 'leech', 'de su clase si hay');
assert.equal(rivalExtras(['epic'], { id: 7, cls: 'bug', unlocked: ['pot'] })[0].power, 'pot', 'y si no, uno de los abiertos');

// Los jefes traen más vida que vos, amuletos y partes de evento.
const bosses = ADVENTURE_LEVELS.filter((l) => l.boss);
assert.equal(bosses.length, chapters.length, 'un jefe por capítulo');
bosses.forEach((b) => {
  assert.ok(b.hp > 150, `${b.base}: más vida`);
  assert.ok(RIVALS[b.base].charms?.length, `${b.base}: trae amuletos`);
  assert.ok(b.charmPowers.length >= 1 && b.charmPowers.every((p) => b.unlocked.includes(p)), `${b.base}: amuletos que ya conocés`);
  assert.ok(RIVALS[b.base].body || /mystic|japan|summer|xmas|agamo/.test(Object.values(RIVALS[b.base].parts).join()),
    `${b.base}: con partes o cuerpo de evento`);
});
// Las partes coleccionables (místicas, de evento, Shiny): los jefes las llevan casi todas;
// los rivales comunes las van sumando capítulo a capítulo, y las Shiny quedan para lo
// difícil (salvo la cola de Solazo, que ya la traía).
{
  const collectible = (key) => !/^(beast|bug|bird|plant|aquatic|reptile)-\d\d$/.test(key);
  const count = (lvl) => Object.values(RIVALS[lvl.base].parts).filter(collectible).length;
  let prev = 0;
  for (const ch of adventureChapters().slice(5)) {
    const commons = ch.levels.filter((l) => !l.boss).map(count);
    assert.ok(Math.min(...commons) >= prev, `capítulo ${ch.n}: no menos coleccionables que el anterior`);
    prev = Math.min(...commons);
    assert.ok(count(ch.levels.at(-1)) >= 3, `capítulo ${ch.n}: su jefe, de partes coleccionables`);
  }
  assert.equal(prev, 4, 'al final, cuatro por rival común');
  const shiny = ADVENTURE_LEVELS.filter((l) => Object.values(RIVALS[l.base].parts).includes('summer-as')).map((l) => l.id);
  assert.ok(shiny.length >= 10 && shiny.every((id) => id === 20 || id > 130), `Shiny en lo difícil: ${shiny}`);
  assert.ok(Object.values(RIVALS.aurora.parts).filter((k) => k === 'summer-as').length === 2, 'el jefe final, con dos Shiny');
}
assert.ok(bosses.every((b) => !b.charmPowers.includes('egg')), 'ningún jefe junta huevos en sus amuletos');
// Los amuletos salen de la combinación del nivel, fijos: el que estrena, primero.
for (const b of bosses) {
  assert.ok(b.charmPowers.every((p) => b.activePowers.includes(p)), `${b.base}: amuletos de su nivel`);
  const charms = adventureCharms(b);
  assert.deepEqual(Object.keys(charms), RIVALS[b.base].charms, `${b.base}: uno por parte con amuleto`);
  assert.deepEqual(adventureCharms(b), charms, `${b.base}: siempre los mismos`);
  if (b.newPowers.length && RIVALS[b.base].charms.length) assert.equal(charms[RIVALS[b.base].charms[0]], b.newPowers[0], `${b.base}: el que estrena, en la primera`);
}
assert.equal(adventureCharms(ADVENTURE_LEVELS[0]), null, 'un rival sin amuletos');
console.log('✓ capítulos de diez, calendario hasta el 175, combinaciones únicas, escalera del rival y jefes con amuletos ok');

// ---- Derivación con una campaña de prueba ---------------------------------------
const sampleCampaign = [
  {
    name: 'Nivel Test 1',
    description: 'Nivel inicial de prueba',
    rival: 'retono',
    stage: 'plaza',
    difficulty: 'facil',
    newPowers: ['strength', 'pot'],
  },
  {
    name: 'Nivel Test 2',
    description: 'Un poder más de bestia',
    rival: 'zarpa',
    stage: 'nevada',
    difficulty: 'normal',
    newPowers: ['brutal'],
    hp: 180,
  },
  {
    name: 'Nivel Test 3',
    description: 'Nivel con override explícito',
    rival: 'vibora',
    stage: 'coliseo',
    difficulty: 'duro',
    newPowers: ['steelskin'],
    activePowers: ['poison', 'bubble'],
  },
];

const derivedLevels = buildAdventureLevels(sampleCampaign);
assert.deepEqual(derivedLevels.map((l) => l.id), [1, 2, 3]);
assert.deepEqual(derivedLevels[0].unlocked, ['strength', 'pot']);
assert.deepEqual(derivedLevels[1].unlocked, ['strength', 'pot', 'brutal']);
assert.equal(derivedLevels[1].hp, 180);
// En el nivel 2 la bestia puede ser cualquiera de las dos, pero el nuevo entra siempre.
assert.ok(adventurePowers(derivedLevels[1], makeRng(1)).includes('brutal'));
// Nivel 3: override explícito tiene prioridad sobre el sorteo.
assert.deepEqual(adventurePowers(derivedLevels[2], makeRng(1)), ['poison', 'bubble']);
console.log('✓ derivación de niveles, ids y desbloqueos ok');

// ---- Helpers de navegación de niveles (isFinalLevel, nextLevelId) ------------
assert.equal(isFinalLevel(1), false, 'nivel 1 no es el nivel final');
assert.equal(isFinalLevel(LAST_LEVEL - 1), false, 'el anteúltimo no es el nivel final');
assert.equal(isFinalLevel(LAST_LEVEL), true, 'el último nivel es el final');
assert.equal(isFinalLevel(LAST_LEVEL + 1), true, 'un id más allá del último cuenta como final');
assert.equal(isFinalLevel(String(LAST_LEVEL)), true, 'soporta id numérico como string');
assert.equal(isFinalLevel(null), false, 'id nulo devuelve false');

assert.equal(nextLevelId(1), 2, 'el siguiente de 1 es 2');
assert.equal(nextLevelId(5), 6, 'el siguiente de 5 es 6');
assert.equal(nextLevelId(LAST_LEVEL), null, 'el último nivel no tiene siguiente (null)');
assert.equal(nextLevelId('2'), 3, 'soporta id numérico como string');
assert.equal(nextLevelId(999), null, 'un id inexistente devuelve null');

assert.equal(DIFFICULTY_LABELS.facil, 'Fácil');
assert.equal(DIFFICULTY_LABELS.normal, 'Normal');
assert.equal(DIFFICULTY_LABELS.duro, 'Dura');

console.log('✓ helpers isFinalLevel, nextLevelId y DIFFICULTY_LABELS ok');

// ---- Validación de la definición de niveles ---------------------------------
assert.throws(() => buildAdventureLevels(null), /array/i);
assert.throws(() => buildAdventureLevels('invalido'), /array/i);
assert.throws(() => buildAdventureLevels([null]), /objeto/i);
assert.throws(() => buildAdventureLevels([{ description: 'd', rival: 'retono', difficulty: 'facil', newPowers: [] }]), /nombre/i);
assert.throws(() => buildAdventureLevels([{ name: 'N1', rival: 'retono', difficulty: 'facil', newPowers: [] }]), /descripción/i);
assert.throws(() => buildAdventureLevels([{ name: 'N1', description: 'd', rival: 'retono', difficulty: 'imposible', newPowers: [] }]), /dificultad/i);
assert.throws(() => buildAdventureLevels([{ name: 'N1', description: 'd', rival: 'rival_fantasma', difficulty: 'facil', newPowers: [] }]), /rival/i);
assert.throws(() => buildAdventureLevels([{ name: 'N1', description: 'd', rival: 'retono', difficulty: 'facil', newPowers: 'strength' }]), /newPowers/i);
assert.throws(() => buildAdventureLevels([{ name: 'N1', description: 'd', rival: 'retono', difficulty: 'facil', newPowers: ['poder_inexistente'] }]), /inexistente/i);
assert.throws(() => buildAdventureLevels([{ name: 'N1', description: 'd', rival: 'retono', difficulty: 'facil', newPowers: ['strength', 'brutal'] }]), /misma clase/i);
assert.throws(() => buildAdventureLevels([{ name: 'N1', description: 'd', rival: 'retono', difficulty: 'facil', newPowers: ['strength'], showcase: ['invalido'] }]), /showcase/i);
assert.throws(() => buildAdventureLevels([{ name: 'N1', description: 'd', rival: 'retono', difficulty: 'facil', newPowers: ['strength'], activePowers: ['strength', 'brutal'] }]), /misma clase/i);

assert.throws(() => buildAdventureLevels([{ name: 'N1', description: 'd', rival: 'retono', difficulty: 'facil', newPowers: ['strength'] }]), /escenario/i);
assert.throws(() => buildAdventureLevels([{ name: 'N1', description: 'd', rival: 'olek', difficulty: 'facil', newPowers: [] }]), /rival/i, 'un starter ya no es rival');
assert.throws(() => buildAdventureLevels([
  { name: 'N1', description: 'd', rival: 'retono', difficulty: 'facil', newPowers: ['pot'], stage: 'plaza' },
  { name: 'N2', description: 'd', rival: 'retono', difficulty: 'facil', newPowers: ['pot'], stage: 'plaza' },
]), /ya se desbloqueó/i);
assert.throws(() => buildAdventureLevels([{ name: 'N1', description: 'd', rival: 'retono', difficulty: 'facil', newPowers: ['pot'], stage: 'plaza', hp: -3 }]), /hp/i);
assert.throws(() => buildAdventureLevels([{ name: 'N1', description: 'd', rival: 'retono', difficulty: 'facil', newPowers: ['strength'], stage: 'luna' }]), /escenario/i);
// Cada nivel pelea en su lugar, y cada capítulo es un tramo del viaje: de la plaza al
// amanecer, pasando por los veintidós escenarios. Del sexto en adelante, uno por capítulo.
assert.ok(ADVENTURE_LEVELS.every((lvl) => isStage(lvl.stage)), 'todo nivel tiene escenario');
assert.equal(new Set(ADVENTURE_LEVELS.map((lvl) => lvl.stage)).size, 22, 'los veintidós escenarios');
assert.equal(ADVENTURE_LEVELS[0].stage, 'plaza', 'arranca en la plaza');
assert.equal(ADVENTURE_LEVELS.at(-1).stage, 'amanecer', 'el final se pelea en el amanecer');
for (const ch of adventureChapters().slice(5)) {
  assert.equal(new Set(ch.levels.map((l) => l.stage)).size, 1, `capítulo ${ch.n}: su escenario`);
}

console.log('✓ validación de errores en campaña y niveles ok');

// ---- Generación de la reserva de cartas según nivel --------------------------
for (const lvl of ADVENTURE_LEVELS) {
  const active = adventurePowers(lvl);
  const pool = buildPool(active);
  const powered = pool.filter((c) => c.power && c.power !== 'freegame');
  // Cada poder aporta 6 cartas al mercado, y solo los de la partida.
  assert.equal(powered.length, active.length * 6, `nivel ${lvl.id}: seis cartas por poder`);
  assert.ok(powered.every((c) => active.includes(c.power)), `nivel ${lvl.id}: solo sus poderes`);
}

// Nivel 1: sus tres amuletos neutrales más los comodines Free Game (15 cartas). Las de
// un neutral son de dos símbolos, y cada clase sale dos veces entre las seis.
const lvl1 = ADVENTURE_LEVELS[0];
const pool1 = buildPool(adventurePowers(lvl1));
assert.equal(pool1.filter((c) => c.power === 'freegame').length, 15, 'el nivel 1 incluye 15 cartas de Free Game');
assert.equal(pool1.length, 35 + 3 * 6 + 15, 'el pool de nivel 1 tiene 68 cartas (35 + 18 + 15)');
for (const p of NEUTRAL_POWERS) {
  const cards = buildPool([p]).filter((c) => c.power === p);
  assert.ok(cards.every((c) => c.symbols.length === 2), `${p}: cartas de dos símbolos`);
  for (const sym of SYMBOL_IDS) assert.equal(cards.filter((c) => c.symbols.includes(sym)).length, 2, `${p}: ${sym} dos veces`);
}
assert.ok(lvl1.showcase.includes('freegame'), 'la ficha del nivel 1 muestra el Rocket Stamp');

console.log('✓ reserva de cartas (buildPool) escalonada según nivel ok');

// ---- Persistencia y progresión ----------------------------------------------
fakeDom();
resetAdventureProgress();

let prog = getAdventureProgress();
assert.equal(prog.unlockedLevel, 1, 'arranca con nivel 1 desbloqueado');
assert.deepEqual(prog.completedLevels, [], 'sin niveles completados al inicio');
assert.ok(isLevelUnlocked(1), 'nivel 1 está desbloqueado');
assert.ok(!isLevelUnlocked(2), 'nivel 2 está bloqueado');

// Ganar nivel 1
prog = markLevelCompleted(1);
assert.equal(prog.unlockedLevel, 2, 'desbloquea nivel 2');
assert.deepEqual(prog.completedLevels, [1], 'nivel 1 registrado como completado');
assert.ok(isLevelUnlocked(2), 'nivel 2 ahora está desbloqueado');
assert.ok(!isLevelUnlocked(3), 'nivel 3 sigue bloqueado');

// Ganar de nuevo nivel 1 no salta niveles
prog = markLevelCompleted(1);
assert.equal(prog.unlockedLevel, 2, 'repetir nivel 1 mantiene unlockedLevel en 2');

// Completar progresivamente hasta el último nivel
for (let lvl = 2; lvl <= LAST_LEVEL; lvl++) {
  prog = markLevelCompleted(lvl);
}
assert.equal(prog.unlockedLevel, LAST_LEVEL, 'el máximo nivel desbloqueado es el último');
assert.equal(prog.completedLevels.length, LAST_LEVEL, 'todos los niveles están completados');

// Las estrellas: solo los ganados por K.O. Volver a ganarlo sin K.O. no la saca.
resetAdventureProgress();
prog = markLevelCompleted(1, { star: true });
prog = markLevelCompleted(2);
assert.deepEqual(prog.completedLevels, [1, 2], 'los dos pasan');
assert.deepEqual(prog.starredLevels, [1], 'pero la estrella es solo del ganado por K.O.');
assert.equal(prog.unlockedLevel, 3, 'pasar sin estrella también abre el siguiente');
prog = markLevelCompleted(1);
assert.deepEqual(getAdventureProgress().starredLevels, [1], 'ganarlo otra vez sin K.O. no la saca');
prog = markLevelCompleted(2, { star: true });
assert.deepEqual(getAdventureProgress().starredLevels, [1, 2], 'y volver por la estrella la da');
// Un progreso de antes de las estrellas: lo ganado cuenta con estrella.
store().setItem('axie-chance:adventure', JSON.stringify({ unlockedLevel: 3, completedLevels: [1, 2] }));
assert.deepEqual(getAdventureProgress().starredLevels, [1, 2], 'lo ganado antes de las estrellas no se pierde');
store().setItem('axie-chance:adventure', JSON.stringify({ unlockedLevel: 3, completedLevels: [1], starredLevels: [1, 2, 99] }));
assert.deepEqual(getAdventureProgress().starredLevels, [1], 'no hay estrella de un nivel sin pasar');

// Reinicio
resetAdventureProgress();
assert.equal(getAdventureProgress().unlockedLevel, 1);
assert.deepEqual(getAdventureProgress().completedLevels, []);
console.log('✓ progresión y persistencia en localStorage ok');

// ---- Compatibilidad y desbloqueo de nuevos niveles en campañas ampliadas ----
// Caso: el jugador ya había completado hasta el nivel 5 cuando la campaña tenía 5 niveles.
// Al abrir el juego con el nivel 6 presente en ADVENTURE_LEVELS, el nivel 6 debe figurar desbloqueado.
store().setItem('axie-chance:adventure', JSON.stringify({
  v: 2,
  unlockedLevel: 5,
  completedLevels: [1, 2, 3, 4, 5],
}));

const progAmple = getAdventureProgress();
assert.equal(progAmple.unlockedLevel, 6, 'si completó el nivel 5, el nivel 6 queda automáticamente desbloqueado');
assert.ok(isLevelUnlocked(6), 'el nivel 6 figura como disponible para jugar');

// Un progreso de la campaña de capítulos de 6 (sin versión): cada nivel ganado va a su
// lugar de ahora, y los niveles nuevos que quedaron atrás se pueden jugar.
assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 12, 13, 30].map(fromV1), [1, 2, 4, 6, 8, 10, 11, 20, 21, 50]);
for (let old = 1; old <= 30; old++) {
  assert.equal(getAdventureLevel(fromV1(old)).base, [
    'retono', 'pichon', 'zarpa', 'polilla', 'vibora', 'shogun', 'gaviota', 'burbuja', 'musgo', 'ermitano', 'tortuga', 'solazo',
    'pino', 'tempano', 'ventisca', 'escarcha', 'carambano', 'nevisca', 'cuervo', 'hiedra', 'abisal', 'lobo', 'mamba', 'umbra',
    'halcon', 'loto', 'kraken', 'furia', 'mantis', 'basilisco'][old - 1], `el ${old} de antes sigue siendo el mismo rival`);
}
store().setItem('axie-chance:adventure', JSON.stringify({ unlockedLevel: 8, completedLevels: [1, 2, 3, 4, 5, 6, 7], starredLevels: [1, 6] }));
const moved = getAdventureProgress();
assert.deepEqual(moved.completedLevels, [1, 2, 4, 6, 8, 10, 11], 'lo ganado, en su lugar nuevo');
assert.deepEqual(moved.starredLevels, [1, 10], 'con sus estrellas');
assert.equal(moved.unlockedLevel, 12, 'abierto hasta donde había llegado');
assert.ok(isLevelUnlocked(3) && isLevelUnlocked(9), 'los nuevos de atrás se pueden jugar');
markLevelCompleted(12);
assert.equal(JSON.parse(store().getItem('axie-chance:adventure')).v, 2, 'al guardar queda en la versión nueva');
assert.deepEqual(getAdventureProgress().completedLevels, [1, 2, 4, 6, 8, 10, 11, 12], 'y no se migra dos veces');
resetAdventureProgress();

// Simular agregar un nivel más a la campaña: se deriva igual, con lo desbloqueado de
// antes y lo que le toca de la escalera.
const campaignPlus = [
  ...ADVENTURE_CAMPAIGN,
  {
    name: 'Desafío',
    description: 'Un nivel más para probar la expansión.',
    rival: 'retono',
    stage: 'plaza',
    difficulty: 'duro',
  },
];
const levelsPlus = buildAdventureLevels(campaignPlus);
assert.equal(levelsPlus.length, LAST_LEVEL + 1);
assert.equal(levelsPlus.at(-1).id, LAST_LEVEL + 1);
assert.equal(levelsPlus.at(-1).unlocked.length, UNLOCK_ORDER.length, 'con todo lo desbloqueado');
assert.deepEqual(levelsPlus.at(-1).newPowers, [], 'sin poder nuevo');
assert.equal(levelsPlus.at(-1).rival, `retono+${rivalKitAt(LAST_LEVEL + 1).evolved}`, 'y el rival con lo de su escalón');
assert.equal(adventureChapters(levelsPlus).at(-1).levels.length, 1, 'el nivel de más va en un capítulo aparte');

// Lo que el nivel declara pisa a la escalera, y lo que no vale no entra.
const one = (extra) => buildAdventureLevels([{ name: 'N1', description: 'd', rival: 'retono', difficulty: 'facil', stage: 'plaza', ...extra }]);
assert.deepEqual(one({ extras: [{ symbols: ['bird', 'plant'] }] })[0].extras.map((c) => [c.symbols.slice().sort(), c.power]), [[['bird', 'plant'], null]]);
assert.throws(() => one({ extras: [{ symbols: ['luna'] }] }), /extras/);
assert.throws(() => one({ extras: Array.from({ length: 5 }, () => ({ symbols: ['plant'] })) }), /tope/);
assert.throws(() => one({ charmPowers: ['pot'] }), /amuleto/, 'un rival sin partes con amuleto');
assert.throws(() => buildAdventureLevels([{ name: 'N1', description: 'd', rival: 'shogun', difficulty: 'facil', stage: 'plaza', charmPowers: ['poison'] }]),
  /desbloqueó/, 'un amuleto que todavía no viste');

// El rótulo de cada nivel sale de su número, no del nombre.
assert.equal(levelKicker(ADVENTURE_LEVELS[2]), 'Nivel 3');
assert.equal(levelKicker(ADVENTURE_LEVELS[9]), 'Jefe');
assert.equal(levelKicker(ADVENTURE_LEVELS.at(-1)), 'Jefe Final');
assert.equal(levelTitle(ADVENTURE_LEVELS[2]), `Nivel 3: ${ADVENTURE_LEVELS[2].name}`);

console.log('✓ desbloqueo hacia adelante al incorporar nuevos niveles ok');

// ---- Integración con el motor de juego (game.js) ----------------------------
const game = createGame({ pace: 0, seed: 3 });

game.newMatch({ mode: 'adventure', adventureLevel: 1, axie: 'olek' });
assert.equal(game.state.mode, 'adventure');
assert.equal(game.state.adventure?.level, 1);
assert.equal(game.state.axies.p1, 'olek', 'un starter se juega');
assert.equal(game.state.axies.p2, 'retono', 'el rival del nivel 1 es Retoño');
assert.deepEqual(game.state.activePowers, ['focus', 'spell', 'lens'], 'nivel 1: los tres primeros neutrales');
assert.deepEqual(game.state.maxHp, { p1: 150, p2: 150 });

// Un jefe: más vida, y sus partes con amuleto llevan el poder del nivel en el mazo.
const shogun = ADVENTURE_LEVELS.find((l) => l.base === 'shogun');
game.newMatch({ mode: 'adventure', adventureLevel: shogun.id, axie: 'buba' });
assert.equal(game.state.maxHp.p2, shogun.hp, 'el jefe arranca con su vida');
assert.equal(hpOf(game.state, 'p2'), shogun.hp);
assert.equal(game.state.adventure.boss, true);
const owned = [...game.state.decks.p2, ...game.state.chains.p2.cards];
const shogunCharms = adventureCharms(shogun);
for (const [part, power] of Object.entries(shogunCharms)) {
  assert.ok(owned.some((c) => c.associatedPart === part && c.power === power), `su ${part} lleva ${power}`);
}

// Un rival evolucionado y con mochila: su mazo trae las partes evolucionadas y las
// cartas de su nivel, que también se ven en su mazo de fábrica.
const late = ADVENTURE_LEVELS.find((l) => l.evolved === 1 && !l.boss && l.extras.length === 4);
game.newMatch({ mode: 'adventure', adventureLevel: late.id, axie: 'venoki' });
assert.equal(game.state.axies.p2, late.rival);
const symbolsOf = (deck) => deck.reduce((n, c) => n + c.symbols.length, 0);
const all = [...game.state.decks.p2, ...game.state.chains.p2.cards];
assert.equal(all.length, 8 + late.extras.length, 'sus ocho y las de su mochila');
assert.equal(symbolsOf(all), symbolsOf(deckFor(late.base)) + 1 + symbolsOf(late.extras), 'una parte evolucionada y sus cartas');
assert.deepEqual(game.state.extras.p2, late.extras, 'las cartas del nivel, ni una más');
assert.deepEqual(game.state.activePowers, late.activePowers, 'los poderes de su nivel');
// Las que vos le pongas al rival no cuentan: lleva las de su nivel.
game.newMatch({ mode: 'adventure', adventureLevel: 1, axie: 'venoki', extras2: [{ symbols: ['plant', 'plant', 'plant'] }] });
assert.deepEqual(game.state.extras.p2, [], 'el nivel 1, sin mochila');
assert.equal(game.state.decks.p2.length + game.state.chains.p2.cards.length, 8);
// Un jefe pelea siempre igual: los mismos amuletos en cualquier partida.
const solazo = ADVENTURE_LEVELS.find((l) => l.base === 'solazo');
for (let seed = 1; seed <= 6; seed++) {
  const g = createGame({ pace: 0, seed });
  g.newMatch({ mode: 'adventure', adventureLevel: solazo.id, axie: 'olek' });
  assert.deepEqual(g.state.activePowers, solazo.activePowers, 'los mismos poderes en el centro');
  const powered = [...g.state.decks.p2, ...g.state.chains.p2.cards].filter((c) => c.power && RIVALS.solazo.charms.includes(c.associatedPart));
  assert.deepEqual(Object.fromEntries(powered.map((c) => [c.associatedPart, c.power])), adventureCharms(solazo), 'los mismos amuletos');
}

console.log('✓ integración de partidas en modo aventura ok');

// ---- El escenario de la partida ------------------------------------------------
{
  const game = createGame({ pace: 0, seed: 11 });
  for (const lvl of ADVENTURE_LEVELS) {
    game.newMatch({ mode: 'adventure', adventureLevel: lvl.id });
    assert.equal(game.state.stage, lvl.stage, `el nivel ${lvl.id} se pelea en su escenario`);
  }
  game.newMatch({ mode: 'tutorial' });
  assert.equal(game.state.stage, 'plaza', 'el tutorial va en la plaza');
  game.newMatch({ mode: 'cpu', stage: 'nevada' });
  assert.equal(game.state.stage, 'nevada', 'un escenario pedido se respeta');
  game.newMatch({ mode: 'cpu', stage: 'luna' });
  assert.ok(isStage(game.state.stage), 'uno desconocido se cambia por uno sorteado');

  // Sortear el escenario no le mueve el reparto a una partida sembrada: sale de otro azar.
  const a = createGame({ pace: 0, seed: 4 });
  const b = createGame({ pace: 0, seed: 4 });
  a.newMatch({ mode: 'cpu' });
  b.newMatch({ mode: 'cpu', stage: 'guarida' });
  const face = (deck) => deck.map((c) => `${c.symbols}|${c.power ?? ''}`);
  assert.deepEqual([face(a.state.decks.p1), face(a.state.pool)], [face(b.state.decks.p1), face(b.state.pool)],
    'el mazo sembrado no depende del escenario');
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    a.newMatch({ mode: 'cpu' });
    seen.add(a.state.stage);
  }
  assert.ok(seen.size >= 5, `las partidas sueltas van rotando de escenario: ${[...seen]}`);
}
console.log('✓ escenario por nivel, tutorial y sorteo ok');

// ---- El mapa: un solo mundo, el camino por los niveles y tu Axie caminando ---------
// Lo que manda son los niveles: el camino se genera pasando por cada uno (no se calca de
// ningún dibujo) y el decorado nunca se para encima del camino ni de un nivel.
{
  const { buildWorld, worldArt, worldLife, worldZoneArt, worldZoneBox, worldGroundCss, WORLD_LANDS, WORLD_ORDER, WORLD_ORIENT } = await import('../src/map-world.js');
  const { levelSpot, walkHero } = await import('../src/adventure-map.js');
  const chapters = adventureChapters();
  for (const orient of ['h', 'v']) {
    const world = buildWorld(chapters, orient);
    assert.equal(world.levels.length, ADVENTURE_LEVELS.length, `${orient}: todos los niveles en el mapa`);
    assert.deepEqual(world.zones.map((z) => z.land), WORLD_ORDER, `${orient}: una tierra por capítulo, en orden`);
    // El camino pasa por cada nivel, en orden, y avanza siempre.
    const along = (p) => (orient === 'v' ? world.H - p.y : p.x);
    let last = -1;
    for (const lv of world.levels) {
      const near = world.route.pts.reduce((best, p) => Math.min(best, Math.hypot(p.x - lv.x, p.y - lv.y)), Infinity);
      assert.ok(near < 1, `${orient}: el camino pasa por el nivel ${lv.id}`);
      assert.ok(lv.f > last, `${orient}: el nivel ${lv.id} viene después del anterior`);
      last = lv.f;
      assert.ok(lv.x > 0 && lv.x < world.W && lv.y > 0 && lv.y < world.H, `${orient}: el nivel ${lv.id} adentro del mapa`);
    }
    assert.ok(world.route.pts.every((p, i, all) => !i || along(p) >= along(all[i - 1]) - 40), `${orient}: el camino no vuelve para atrás`);
    // De costado, los niveles caen en la franja entre la barra y el panel.
    if (orient === 'h') assert.ok(world.levels.every((l) => l.y >= 260 && l.y <= 610), 'de costado, los niveles en su franja');
    // El decorado deja libre el camino.
    const roadNear = (x, y) => world.route.pts.reduce((best, p) => Math.min(best, Math.hypot(p.x - x, p.y - y)), Infinity);
    const onRoad = world.props.filter((p) => roadNear(p.x, p.y) < 32 + p.r);
    assert.deepEqual(onRoad, [], `${orient}: ninguna pieza sobre el camino`);
    assert.ok(world.props.length > 600, `${orient}: un mundo lleno (${world.props.length} piezas)`);
    // Un hito por jefe, el de su fondo de pelea, y el camino termina en la puerta del
    // Amanecer, el último.
    assert.deepEqual(world.landmarks.map((m) => m.kind), ['totems', 'ship', 'sacredtree', 'pumpkin', 'colosseum',
      'gate', 'temple', 'lotus', 'lighthouse', 'arch', 'hive', 'nest', 'geode', 'tent', 'volcano',
      'glowshroom', 'xmastree', 'clocktower', 'portal', 'sungate']);
    const gate = world.landmarks.at(-1);
    const end = world.route.pts.at(-1);
    assert.ok(Math.hypot(end.x - gate.x, end.y - gate.y) < 60, `${orient}: el camino termina en la puerta del Amanecer`);
    // Lo que se mueve lo pide cada módulo: el viento en todas las tierras, las matas que
    // ruedan en el desierto, el agua según su clase y lo de cada hito. Nada del agua pasa
    // por encima de un puente.
    const life = worldLife(buildWorld(chapters, orient));
    const byLand = Object.fromEntries(life.map((z) => [z.land, z]));
    for (const z of life) assert.ok(z.gusts.length > 0, `${orient}: viento en ${z.land}`);
    assert.ok(byLand.coliseo.tumbles.length > 0, `${orient}: matas secas rodando por el Coliseo`);
    assert.ok(byLand.valle.flows.length > 0 && byLand.guarida.flows.length > 0, `${orient}: los ríos corren`);
    assert.ok(byLand.costa.waves.length > 0, `${orient}: olas en la orilla`);
    assert.ok(byLand.valle.ripples.length > 0 && byLand.nieve.ripples.length > 0, `${orient}: anillos en las lagunas`);
    assert.ok(byLand.valle.lights.some((l) => l.kind === 'spirit'), `${orient}: los ojos de los tótems se encienden`);
    assert.ok(byLand.guarida.wisps.some((w) => w.kind === 'ghost'), `${orient}: fuegos fatuos alrededor de la calabaza`);
    assert.equal(byLand.costa.ships.length, 1, `${orient}: el barco se mece en el agua`);
    assert.ok(byLand.valle.sway.length > 0 && byLand.coliseo.sway.length > 0, `${orient}: árboles y matas que se mecen`);
    for (const [i, z] of life.entries()) {
      const zone = world.zones[i];
      const toMap = (q) => (orient === 'v' ? { x: q.x, y: q.y + (1 - zone.b) * world.H } : { x: q.x + zone.a * world.W, y: q.y });
      const wet = [...z.flows, ...z.glints.filter((g) => z.land !== 'costa')].map(toMap);
      assert.deepEqual(wet.filter((q) => roadNear(q.x, q.y) < 60), [], `${orient}: el agua de ${z.land} no se mueve sobre el camino`);
    }
    assert.deepEqual(worldLife(buildWorld(chapters, orient)), life, `${orient}: se mueve igual cada vez`);
    // Siempre sale igual: el azar está sembrado.
    const again = buildWorld(chapters, orient);
    assert.equal(worldArt(again), worldArt(world), `${orient}: el mismo mundo cada vez`);
    // Cada tierra trae su kit completo y el dibujo solo define las piezas que usa.
    const art = worldArt(world);
    for (const land of WORLD_ORDER) assert.ok(WORLD_LANDS[land].kit.length >= 5, `${land}: su kit`);
    const defined = new Set([...art.matchAll(/<g id="(adv-p-[^"]+)"/g)].map((m) => m[1]));
    const used = new Set([...art.matchAll(/<use href="#(adv-p-[^"]+)"/g)].map((m) => m[1]));
    assert.deepEqual([...used].filter((id) => !defined.has(id)), [], `${orient}: cada pieza usada, definida`);
    // Las costuras no se cortan en seco: el suelo es uno solo (uno por tierra dejaba una
    // raya donde se tocan) y lo pintado en el suelo de una tierra se mete en la de al lado.
    const ground = worldGroundCss(world);
    assert.ok(WORLD_ORDER.every((l) => ground.includes(WORLD_LANDS[l].ground)), `${orient}: el suelo de todas las tierras, de una pieza`);
    const zoneArt = worldZoneArt(world, 3);
    assert.doesNotMatch(zoneArt.ground, /adv-g-ground/, `${orient}: ninguna tierra pinta su propio suelo`);
    const [bx, by, bw, bh] = worldZoneBox(world, 3);
    const spills = [...zoneArt.soil.matchAll(/<ellipse cx="([-\d.]+)" cy="([-\d.]+)"/g)]
      .filter(([, x, y]) => (orient === 'v' ? +y < by || +y > by + bh : +x < bx || +x > bx + bw));
    assert.ok(spills.length > 0, `${orient}: lo pintado en el suelo pasa la costura`);
    // El cara a cara: en cada nivel, el rival del lado de adelante y tu Axie del de atrás,
    // mirándolo. De costado el viaje sigue siempre a la derecha; parado, para donde dobla.
    for (const lvl of ADVENTURE_LEVELS) {
      const spot = levelSpot(lvl.id, orient);
      assert.ok(spot.at.x >= 0 && spot.at.x <= 1 && spot.at.y >= 0 && spot.at.y <= 1, `${orient}: nivel ${lvl.id} adentro del mapa`);
      assert.ok(spot.ahead === 1 || spot.ahead === -1, `${orient}: el nivel ${lvl.id} sabe para dónde sigue el camino`);
      assert.equal(spot.face, spot.ahead > 0 ? 'right' : 'left', `${orient}: tu Axie mira al nivel ${lvl.id} y a su rival`);
      if (orient === 'h') assert.equal(spot.ahead, 1, `de costado, el rival del nivel ${lvl.id} corta el camino a la derecha`);
    }
    // Y a los costados de cada nivel no crece nada: ahí se paran los dos que pelean.
    for (const lv of world.levels) {
      const side = (lv.boss ? WORLD_ORIENT[orient].duel.boss : WORLD_ORIENT[orient].duel.side) * 0.8;
      const inDuel = world.props.filter((p) => Math.abs(p.x - lv.x) < side && p.y > lv.y - 60 && p.y < lv.y + 60);
      assert.deepEqual(inDuel, [], `${orient}: nada crece donde se pelea el nivel ${lv.id}`);
    }
  }
  // Tu Axie se para en el nivel nuevo y camina hasta allá por el camino, a saltitos,
  // también de una tierra a otra: el mundo es uno solo. El FLIP se mide en la pantalla:
  // acá, una pantalla de mentira donde el Axie está donde dicen sus variables.
  const board = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 10000, height: 800 }) };
  const hero = {
    dataset: {}, parentElement: board, vars: {},
    style: { setProperty(k, v) { hero.vars[k] = v; } },
    getBoundingClientRect() {
      const x = Number(hero.vars['--x'] ?? 0) * 10000;
      const y = Number(hero.vars['--y'] ?? 0) * 800;
      return { left: x - 45, top: y - 80, width: 90, height: 90 };
    },
    animate: (frames, opts) => ({ frames, opts, cancel() {} }),
  };
  const walk = walkHero(hero, 1, 3, 'h');
  assert.ok(walk && walk.frames.length >= 5, 'del 1 al 3, pasando por el camino');
  assert.equal(walk.frames.at(-1).transform, 'translate(0px, 0px)', 'y termina donde ya está puesto');
  assert.notEqual(walk.frames[0].transform, 'translate(0px, 0px)', 'saliendo de donde estaba');
  assert.equal(hero.vars['--x'], levelSpot(3, 'h').at.x.toFixed(5), 'parado en el nivel 3');
  assert.equal(hero.vars['--ahead'], '1', 'del lado de atrás');
  assert.equal(hero.dataset.face, levelSpot(3, 'h').face, 'mirando al nivel');
  const far = walkHero(hero, 10, 11, 'h');
  assert.ok(far && far.opts.duration <= 2500, 'del jefe del Valle al primero de la Costa, también caminando');
  assert.equal(hero.dataset.boss, 'false', 'y el 11 no es jefe');
  // Sin navegador que anime, solo se para.
  const quiet = { ...hero, animate: undefined, vars: {}, style: { setProperty(k, v) { quiet.vars[k] = v; } } };
  assert.equal(walkHero(quiet, 1, 6, 'h'), null);
  assert.equal(quiet.vars['--x'], levelSpot(6, 'h').at.x.toFixed(5), 'pero queda parado en el nivel');
}
console.log('✓ mapa: un solo mundo, camino por los niveles, decorado libre del camino, cara a cara y caminata ok');

// ---- La entrada a un nivel: la previa y la transición --------------------------------
{
  const { loadingView, loadingHtml, createLoading, LOADING_BEAT } = await import('../src/loading.js');
  const view = loadingView({ adventureLevel: 10 }, 'buba');
  assert.equal(view.level, 10);
  assert.equal(view.hero.id, 'buba', 'tu Axie');
  assert.equal(view.rival.id, getAdventureLevel(10).rival, 'contra el rival del nivel');
  assert.equal(view.boss, true, 'el 10 es jefe');
  assert.equal(view.music, 'boss', 'y arranca con la música de jefe');
  assert.equal(view.kicker, 'Capítulo 1 · Jefe', 'dice el capítulo y que es jefe');
  assert.equal(view.title, 'El Shogun del Valle', 'y el nombre, sin número');
  assert.equal(loadingView({ adventureLevel: 3 }, 'buba').kicker, 'Capítulo 1 · Nivel 3');
  assert.equal(loadingView({ adventureLevel: 11 }, 'buba').music, 'battle');
  const html = loadingHtml(view, 5);
  assert.equal((html.match(/class="loading-card"/g) ?? []).length, 5, 'el muro de cartas');
  assert.equal((html.match(/class="loading-fighter"/g) ?? []).length, 2, 'el cara a cara');
  assert.equal((html.match(/class="loading-link"/g) ?? []).length, 6, 'la cadena con los seis símbolos');
  assert.match(html, /class="loading-boss">Jefe · 180 de vida</, 'el jefe con su vida');
  assert.match(html, /class="axie-alt"/, 'los dos vivos, con sus gestos');
  assert.ok(LOADING_BEAT.hold < LOADING_BEAT.max, 'se ve un rato y nunca se espera de más');
  // Sin navegador que anime, la partida arranca en el acto.
  const steps = [];
  const sinMesa = createLoading(null);
  await sinMesa.run({ view, onCovered: () => steps.push('tapa'), start: () => steps.push('arranca') });
  assert.deepEqual(steps, ['tapa', 'arranca'], 'tapa y arranca, en ese orden');
}
console.log('✓ entrada a un nivel: la previa y la transición ok');

// ---- el perfil ------------------------------------------------------------------
// El nivel del jugador sale de lo ganado en la Aventura: cada nivel superado y cada
// estrella dan experiencia, y cada nivel del perfil pide un poco más que el anterior.
{
  const { profileOf, profileNeed, PROFILE_XP } = await import('../src/profile.js');
  assert.deepEqual(profileOf({ completedLevels: [], starredLevels: [] }), { xp: 0, level: 1, into: 0, need: 100, frac: 0 }, 'sin jugar, nivel 1 y la barra vacía');
  assert.deepEqual(profileOf(), profileOf({ completedLevels: [] }), 'sin progreso, lo mismo');
  const one = profileOf({ completedLevels: [1], starredLevels: [1] });
  assert.equal(one.xp, PROFILE_XP.level + PROFILE_XP.star);
  assert.equal(one.level, 2, 'un nivel ganado por K.O. sube el perfil');
  assert.equal(one.into, one.xp - profileNeed(1));
  assert.ok(one.frac > 0 && one.frac < 1, 'y la barra arranca a llenarse');
  assert.equal(profileOf({ completedLevels: [1, 1, 2], starredLevels: [2, 2] }).xp, 2 * PROFILE_XP.level + PROFILE_XP.star, 'lo repetido no suma dos veces');
  const all = profileOf({ completedLevels: ADVENTURE_LEVELS.map((l) => l.id), starredLevels: ADVENTURE_LEVELS.map((l) => l.id) });
  assert.ok(all.level > 10 && all.frac >= 0 && all.frac < 1, `la campaña entera: nivel ${all.level}`);
  console.log(`✓ perfil: nivel y experiencia desde la Aventura ok (todo ganado: nivel ${all.level})`);
}
