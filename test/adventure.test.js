import assert from 'node:assert/strict';
import {
  ADVENTURE_LEVELS, getAdventureProgress, saveAdventureProgress,
  isLevelUnlocked, markLevelCompleted, resetAdventureProgress,
  getAdventureLevel, isFinalLevel, nextLevelId, buildAdventureLevels,
  DIFFICULTY_LABELS,
} from '../src/adventure.js';
import { CLASS_POWER_IDS, buildPool, POWERS } from '../src/data.js';
import { createGame } from '../src/game.js';
import { fakeDom } from './dom.mjs';
import { store } from '../src/loadout.js';

// ---- Configuración de niveles -----------------------------------------------
// La campaña base son los 6 primeros niveles y se prueba tal cual. Los que se agreguen
// después van al final y no la tocan: estos tests siguen valiendo sin cambios.
const BASE_LEVELS = ADVENTURE_LEVELS.slice(0, 6);
const LAST_LEVEL = ADVENTURE_LEVELS.length;
assert.ok(ADVENTURE_LEVELS.length >= 6, 'la campaña base tiene 6 niveles');
ADVENTURE_LEVELS.forEach((lvl, i) => assert.equal(lvl.id, i + 1, `el id debe coincidir con ${i + 1}`));

// Comprobar que los poderes se introducen de a 2 hasta llegar a los 12
const seenPowers = new Set();
for (let i = 0; i < BASE_LEVELS.length; i++) {
  const lvl = BASE_LEVELS[i];
  assert.equal(lvl.id, i + 1, `el id debe coincidir con ${i + 1}`);
  assert.equal(lvl.newPowers.length, 2, `nivel ${lvl.id} debe introducir exactamente 2 poderes nuevos`);

  for (const p of lvl.newPowers) {
    assert.ok(POWERS[p], `el poder ${p} debe existir en POWERS`);
    assert.ok(!seenPowers.has(p), `el poder ${p} ya fue introducido en un nivel anterior`);
    seenPowers.add(p);
  }

  // Verificar que NINGUNA clase tenga más de un poder activo en el mismo nivel
  const activeSymbols = lvl.activePowers.map((p) => POWERS[p]?.symbol).filter(Boolean);
  const uniqueSymbols = new Set(activeSymbols);
  assert.equal(
    activeSymbols.length,
    uniqueSymbols.size,
    `nivel ${lvl.id} no debe tener dos poderes de la misma clase (símbolos de poder duplicados)`,
  );
}

// Validar que en niveles 1, 2 y 3 escalen de a 2, y en 4, 5 y 6 mantengan 6 (1 por clase con sustitución)
assert.equal(ADVENTURE_LEVELS[0].activePowers.length, 2, 'nivel 1 tiene 2 poderes');
assert.equal(ADVENTURE_LEVELS[1].activePowers.length, 4, 'nivel 2 tiene 4 poderes');
assert.equal(ADVENTURE_LEVELS[2].activePowers.length, 6, 'nivel 3 tiene 6 poderes (clásicos)');
assert.equal(ADVENTURE_LEVELS[3].activePowers.length, 6, 'nivel 4 tiene 6 poderes (sustituye fuerza y maceta)');
assert.ok(ADVENTURE_LEVELS[3].activePowers.includes('leaf') && !ADVENTURE_LEVELS[3].activePowers.includes('pot'), 'nivel 4 tiene hoja y no maceta');
assert.ok(ADVENTURE_LEVELS[3].activePowers.includes('brutal') && !ADVENTURE_LEVELS[3].activePowers.includes('strength'), 'nivel 4 tiene garra brutal y no fuerza');
assert.equal(ADVENTURE_LEVELS[4].activePowers.length, 6, 'nivel 5 tiene 6 poderes (sustituye huevo y caracol)');
assert.ok(ADVENTURE_LEVELS[4].activePowers.includes('feather') && !ADVENTURE_LEVELS[4].activePowers.includes('egg'), 'nivel 5 tiene pluma y no huevo');
assert.ok(ADVENTURE_LEVELS[4].activePowers.includes('leech') && !ADVENTURE_LEVELS[4].activePowers.includes('snail'), 'nivel 5 tiene sanguijuela y no caracol');
assert.equal(ADVENTURE_LEVELS[5].activePowers.length, 6, 'nivel 6 tiene 6 poderes (sustituye pulpo y veneno)');
assert.ok(ADVENTURE_LEVELS[5].activePowers.includes('bubble') && !ADVENTURE_LEVELS[5].activePowers.includes('octopus'), 'nivel 6 tiene burbuja y no pulpo');
assert.ok(ADVENTURE_LEVELS[5].activePowers.includes('steelskin') && !ADVENTURE_LEVELS[5].activePowers.includes('poison'), 'nivel 6 tiene piel de escamas y no veneno');

assert.equal(seenPowers.size, 12, 'deben haberse introducido exactamente los 12 poderes');
for (const pid of CLASS_POWER_IDS) {
  assert.ok(seenPowers.has(pid), `el poder de clase ${pid} debe estar incluido en la aventura`);
}
console.log('✓ configuración de niveles y poderes de 2 en 2 hasta 12 ok');

// ---- Derivación de activePowers por clase y overrides -----------------------
const sampleCampaign = [
  {
    name: 'Nivel Test 1',
    description: 'Nivel inicial de prueba',
    rival: 'olek',
    difficulty: 'facil',
    newPowers: ['strength', 'pot'],
  },
  {
    name: 'Nivel Test 2',
    description: 'Reemplazo de fuerza (bestia) por garra brutal (bestia)',
    rival: 'buba',
    difficulty: 'normal',
    newPowers: ['brutal'],
  },
  {
    name: 'Nivel Test 3',
    description: 'Nivel con override explícito',
    rival: 'venoki',
    difficulty: 'duro',
    newPowers: ['steelskin'],
    activePowers: ['poison', 'bubble'],
  },
];

const derivedLevels = buildAdventureLevels(sampleCampaign);
assert.equal(derivedLevels.length, 3);
assert.equal(derivedLevels[0].id, 1);
assert.equal(derivedLevels[1].id, 2);
assert.equal(derivedLevels[2].id, 3);

// Nivel 1 deriva ['strength', 'pot']
assert.deepEqual(derivedLevels[0].activePowers, ['strength', 'pot']);

// Nivel 2: brutal (bestia) reemplaza a strength (bestia) en la posición 0
assert.deepEqual(derivedLevels[1].activePowers, ['brutal', 'pot']);

// Nivel 3: override explícito tiene prioridad sobre lo derivado
assert.deepEqual(derivedLevels[2].activePowers, ['poison', 'bubble']);

console.log('✓ derivación de niveles, ids y sustitución de poderes por clase ok');

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
assert.equal(nextLevelId(99), null, 'un id inexistente devuelve null');

assert.equal(DIFFICULTY_LABELS.facil, 'Fácil');
assert.equal(DIFFICULTY_LABELS.normal, 'Normal');
assert.equal(DIFFICULTY_LABELS.duro, 'Dura');

console.log('✓ helpers isFinalLevel, nextLevelId y DIFFICULTY_LABELS ok');

// ---- Validación de la definición de niveles ---------------------------------
assert.throws(() => buildAdventureLevels(null), /array/i);
assert.throws(() => buildAdventureLevels('invalido'), /array/i);
assert.throws(() => buildAdventureLevels([null]), /objeto/i);
assert.throws(() => buildAdventureLevels([{ description: 'd', rival: 'olek', difficulty: 'facil', newPowers: [] }]), /nombre/i);
assert.throws(() => buildAdventureLevels([{ name: 'N1', rival: 'olek', difficulty: 'facil', newPowers: [] }]), /descripción/i);
assert.throws(() => buildAdventureLevels([{ name: 'N1', description: 'd', rival: 'olek', difficulty: 'imposible', newPowers: [] }]), /dificultad/i);
assert.throws(() => buildAdventureLevels([{ name: 'N1', description: 'd', rival: 'rival_fantasma', difficulty: 'facil', newPowers: [] }]), /rival/i);
assert.throws(() => buildAdventureLevels([{ name: 'N1', description: 'd', rival: 'olek', difficulty: 'facil', newPowers: 'strength' }]), /newPowers/i);
assert.throws(() => buildAdventureLevels([{ name: 'N1', description: 'd', rival: 'olek', difficulty: 'facil', newPowers: ['poder_inexistente'] }]), /inexistente/i);
assert.throws(() => buildAdventureLevels([{ name: 'N1', description: 'd', rival: 'olek', difficulty: 'facil', newPowers: ['strength', 'brutal'] }]), /misma clase/i);
assert.throws(() => buildAdventureLevels([{ name: 'N1', description: 'd', rival: 'olek', difficulty: 'facil', newPowers: ['strength'], showcase: ['invalido'] }]), /showcase/i);
assert.throws(() => buildAdventureLevels([{ name: 'N1', description: 'd', rival: 'olek', difficulty: 'facil', newPowers: ['strength'], activePowers: ['strength', 'brutal'] }]), /misma clase/i);

console.log('✓ validación de errores en campaña y niveles ok');

// ---- Generación de la reserva de cartas según nivel --------------------------
for (const lvl of ADVENTURE_LEVELS) {
  const pool = buildPool(lvl.activePowers);
  const powered = pool.filter((c) => c.power && c.power !== 'freegame');
  // Cada poder aporta 6 cartas al mercado
  assert.equal(
    powered.length,
    lvl.activePowers.length * 6,
    `nivel ${lvl.id} debe tener ${lvl.activePowers.length * 6} cartas con poder en la reserva`,
  );
  // Verificar que todas las cartas con poder pertenezcan a los activePowers de ese nivel
  for (const c of powered) {
    assert.ok(
      lvl.activePowers.includes(c.power),
      `la carta tiene el poder ${c.power} que no debería estar en el nivel ${lvl.id}`,
    );
  }
}

// Nivel 1 incluye los comodines neutrales Free Game (15 cartas)
const lvl1 = ADVENTURE_LEVELS[0];
const pool1 = buildPool(lvl1.activePowers);
const freegame1 = pool1.filter((c) => c.power === 'freegame');
assert.equal(freegame1.length, 15, 'el nivel 1 debe incluir 15 cartas de Free Game');
assert.equal(pool1.length, 35 + 2 * 6 + 15, 'el pool de nivel 1 debe tener 62 cartas (35 + 12 + 15)');
assert.match(lvl1.description, /Free Game/i, 'la descripción del nivel 1 debe explicar Free Game');

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

// Reinicio
resetAdventureProgress();
assert.equal(getAdventureProgress().unlockedLevel, 1);
assert.deepEqual(getAdventureProgress().completedLevels, []);
console.log('✓ progresión y persistencia en localStorage ok');

// ---- Compatibilidad y desbloqueo de nuevos niveles en campañas ampliadas ----
// Caso: el jugador ya había completado hasta el nivel 5 cuando la campaña tenía 5 niveles.
// Al abrir el juego con el nivel 6 presente en ADVENTURE_LEVELS, el nivel 6 debe figurar desbloqueado.
store().setItem('axie-chance:adventure', JSON.stringify({
  unlockedLevel: 5,
  completedLevels: [1, 2, 3, 4, 5],
}));

const progAmple = getAdventureProgress();
assert.equal(progAmple.unlockedLevel, 6, 'si completó el nivel 5, el nivel 6 queda automáticamente desbloqueado');
assert.ok(isLevelUnlocked(6), 'el nivel 6 figura como disponible para jugar');

// Simular agregar un nivel 7 a una campaña mediante buildAdventureLevels y verificar la lógica
const campaignWith7 = [
  ...ADVENTURE_LEVELS.map(({ name, description, rival, difficulty, newPowers, showcase }) => ({
    name, description, rival, difficulty, newPowers, ...(showcase ? { showcase } : {}),
  })),
  {
    name: 'Nivel 7: Desafío Extra',
    description: 'Un séptimo nivel para probar la expansión.',
    rival: 'olek',
    difficulty: 'duro',
    newPowers: ['strength'], // reemplaza brutal por strength
  },
];
const levelsWith7 = buildAdventureLevels(campaignWith7);
assert.equal(levelsWith7.length, LAST_LEVEL + 1);
assert.equal(levelsWith7.at(-1).id, LAST_LEVEL + 1);
assert.equal(levelsWith7.at(-1).activePowers.length, 6);

console.log('✓ desbloqueo hacia adelante al incorporar nuevos niveles ok');

// ---- Integración con el motor de juego (game.js) ----------------------------
const game = createGame({ pace: 0 });

// Iniciar en modo aventura nivel 1
game.newMatch({ mode: 'adventure', adventureLevel: 1, axie: 'beast' });
assert.equal(game.state.mode, 'adventure');
assert.equal(game.state.adventure?.level, 1);
assert.equal(game.state.axies.p2, 'olek', 'el rival del nivel 1 es Olek, el starter de Planta');
assert.equal(game.state.activePowers.length, 2, 'nivel 1 tiene 2 poderes activos');
assert.deepEqual(game.state.activePowers, ['strength', 'pot']);

// Iniciar en modo aventura nivel 3
game.newMatch({ mode: 'adventure', adventureLevel: 3, axie: 'plant' });
assert.equal(game.state.adventure?.level, 3);
assert.equal(game.state.axies.p2, 'puffy', 'el rival del nivel 3 es Puffy, el starter de Pez');
assert.equal(game.state.activePowers.length, 6, 'nivel 3 tiene 6 poderes activos');

// Iniciar en modo aventura nivel 6
game.newMatch({ mode: 'adventure', adventureLevel: 6, axie: 'bird' });
assert.equal(game.state.adventure?.level, 6);
assert.equal(game.state.activePowers.length, 6, 'nivel 6 tiene 6 poderes activos (uno por clase)');
assert.deepEqual(game.state.activePowers, ['brutal', 'leaf', 'feather', 'leech', 'bubble', 'steelskin']);

console.log('✓ integración de partidas en modo aventura ok');
