import assert from 'node:assert/strict';
import {
  ADVENTURE_LEVELS, getAdventureProgress, saveAdventureProgress,
  isLevelUnlocked, markLevelCompleted, resetAdventureProgress,
  getAdventureLevel,
} from '../src/adventure.js';
import { CLASS_POWER_IDS, buildPool, POWERS } from '../src/data.js';
import { createGame } from '../src/game.js';
import { fakeDom } from './dom.mjs';

// ---- Configuración de niveles -----------------------------------------------
assert.equal(ADVENTURE_LEVELS.length, 6, 'deben ser 6 niveles');

// Comprobar que los poderes se introducen de a 2 hasta llegar a los 12
const seenPowers = new Set();
for (let i = 0; i < ADVENTURE_LEVELS.length; i++) {
  const lvl = ADVENTURE_LEVELS[i];
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

// Completar progresivamente hasta el nivel 6
for (let lvl = 2; lvl <= 6; lvl++) {
  prog = markLevelCompleted(lvl);
}
assert.equal(prog.unlockedLevel, 6, 'el máximo nivel desbloqueado es 6');
assert.equal(prog.completedLevels.length, 6, 'los 6 niveles están completados');

// Reinicio
resetAdventureProgress();
assert.equal(getAdventureProgress().unlockedLevel, 1);
assert.deepEqual(getAdventureProgress().completedLevels, []);
console.log('✓ progresión y persistencia en localStorage ok');

// ---- Integración con el motor de juego (game.js) ----------------------------
const game = createGame({ pace: 0 });

// Iniciar en modo aventura nivel 1
game.newMatch({ mode: 'adventure', adventureLevel: 1, axie: 'beast' });
assert.equal(game.state.mode, 'adventure');
assert.equal(game.state.adventure?.level, 1);
assert.equal(game.state.axies.p2, 'plant', 'el rival del nivel 1 es Brote (plant)');
assert.equal(game.state.activePowers.length, 2, 'nivel 1 tiene 2 poderes activos');
assert.deepEqual(game.state.activePowers, ['strength', 'pot']);

// Iniciar en modo aventura nivel 3
game.newMatch({ mode: 'adventure', adventureLevel: 3, axie: 'plant' });
assert.equal(game.state.adventure?.level, 3);
assert.equal(game.state.axies.p2, 'aquatic', 'el rival del nivel 3 es Marea (aquatic)');
assert.equal(game.state.activePowers.length, 6, 'nivel 3 tiene 6 poderes activos');

// Iniciar en modo aventura nivel 6
game.newMatch({ mode: 'adventure', adventureLevel: 6, axie: 'bird' });
assert.equal(game.state.adventure?.level, 6);
assert.equal(game.state.activePowers.length, 6, 'nivel 6 tiene 6 poderes activos (uno por clase)');
assert.deepEqual(game.state.activePowers, ['brutal', 'leaf', 'feather', 'leech', 'bubble', 'steelskin']);

console.log('✓ integración de partidas en modo aventura ok');

