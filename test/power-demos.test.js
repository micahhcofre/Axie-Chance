import assert from 'node:assert/strict';
import {
  POWER_DEMOS,
  LEVEL_DEMO_POWERS,
  hasSeenPowerDemo,
  setPowerDemoSeen,
  isDemoAutoShowDisabled,
  setDemoAutoShowDisabled,
  shouldAutoShowDemo,
  createPowerDemoController,
} from '../src/power-demos.js';
import { fakeDom } from './dom.mjs';

// Setup fake DOM
fakeDom();

// ---- 1. Cobertura de los primeros 3 niveles y los primeros 7 símbolos --------
assert.deepEqual(
  LEVEL_DEMO_POWERS[1],
  ['strength', 'pot', 'freegame'],
  'Nivel 1 enseña Fuerza (Bestia), Maceta (Planta) y Free Game (Neutral)',
);
assert.deepEqual(
  LEVEL_DEMO_POWERS[2],
  ['egg', 'snail'],
  'Nivel 2 enseña Huevo (Pájaro) y Caracol (Bicho)',
);
assert.deepEqual(
  LEVEL_DEMO_POWERS[3],
  ['octopus', 'poison'],
  'Nivel 3 enseña Pulpo (Pez) y Veneno (Reptil)',
);

const first3LevelsPowers = [
  ...LEVEL_DEMO_POWERS[1],
  ...LEVEL_DEMO_POWERS[2],
  ...LEVEL_DEMO_POWERS[3],
];

assert.equal(first3LevelsPowers.length, 7, 'deben ser exactamente 7 poderes/símbolos en los primeros 3 niveles');
const uniqueSymbols = new Set(first3LevelsPowers);
assert.equal(uniqueSymbols.size, 7, 'los 7 poderes/símbolos deben ser únicos');

for (const pId of first3LevelsPowers) {
  const demo = POWER_DEMOS[pId];
  assert.ok(demo, `POWER_DEMOS debe contener definición completa para ${pId}`);
  assert.ok(demo.name, `${pId} debe tener nombre`);
  assert.ok(demo.tagline, `${pId} debe tener tagline explicativo`);
  assert.ok(demo.description, `${pId} debe tener descripción`);
  assert.ok(demo.tacticalTip, `${pId} debe tener consejo táctico`);
  assert.ok(demo.simulation, `${pId} debe tener simulación de combate`);
  assert.ok(Array.isArray(demo.simulation.steps), `${pId} debe tener pasos de simulación`);
  assert.ok(demo.simulation.steps.length >= 2, `${pId} debe tener al menos 2 pasos de simulación`);
}

console.log('✓ mapeo de 7 símbolos en los primeros 3 niveles con simulaciones ok');

// ---- 2. Lógica no invasiva y persistencia ------------------------------------
globalThis.localStorage.removeItem('axie-chance:demo-seen:lvl-1');
globalThis.localStorage.removeItem('axie-chance:demo-pref:lvl-1');

// Primera vez en Nivel 1: debe auto-mostrar
assert.equal(hasSeenPowerDemo(1), false, 'no vista inicialmente');
assert.equal(isDemoAutoShowDisabled(1), false, 'no desactivada inicialmente');
assert.equal(shouldAutoShowDemo(1), true, 'debe auto-mostrarse en primera visita de N1');

// Marcar como vista
setPowerDemoSeen(1, true);
assert.equal(hasSeenPowerDemo(1), true, 'marcada como vista');
assert.equal(shouldAutoShowDemo(1), false, 'no auto-mostrar si ya fue vista');

// Desactivar auto-show permanente
setDemoAutoShowDisabled(1, true);
assert.equal(isDemoAutoShowDisabled(1), true, 'auto-show desactivado');
assert.equal(shouldAutoShowDemo(1), false, 'no auto-mostrar si está desactivada');

// Reactivar auto-show
setDemoAutoShowDisabled(1, false);
assert.equal(isDemoAutoShowDisabled(1), false, 'auto-show reactivado');

// Niveles posteriores a los primeros 3 no deben auto-mostrar por defecto
assert.equal(shouldAutoShowDemo(4), false, 'nivel 4 no auto-muestra demo intrusiva');
assert.equal(shouldAutoShowDemo(5), false, 'nivel 5 no auto-muestra demo intrusiva');
assert.equal(shouldAutoShowDemo(6), false, 'nivel 6 no auto-muestra demo intrusiva');

console.log('✓ persistencia y comportamiento no invasivo ok');

// ---- 3. Renderizado y controlador interactivo en DOM -------------------------
const mockBody = {
  children: [],
  appendChild(el) {
    el.parentNode = this;
    this.children.push(el);
    return el;
  },
  removeChild(el) {
    this.children = this.children.filter((c) => c !== el);
  },
};

globalThis.document.body = mockBody;

let closed = false;
const ctrl = createPowerDemoController({
  levelId: 1,
  container: mockBody,
  onClose: () => { closed = true; },
});

assert.ok(ctrl, 'controlador creado');
assert.ok(ctrl.element, 'elemento modal creado');
assert.equal(ctrl.element.id, 'power-demo-modal');

// Verificar que contiene las 3 pestañas de nivel 1
assert.ok(ctrl.element.innerHTML.includes('data-power-tab="strength"'), 'pestaña fuerza');
assert.ok(ctrl.element.innerHTML.includes('data-power-tab="pot"'), 'pestaña maceta');
assert.ok(ctrl.element.innerHTML.includes('data-power-tab="freegame"'), 'pestaña freegame');

// Probar cambio de poder a 'pot'
ctrl.switchPower('pot');
assert.ok(ctrl.element.innerHTML.includes('Maceta'), 'muestra Maceta tras switchPower');

// Probar presencia de botones de salida no invasivos
assert.ok(ctrl.element.innerHTML.includes('id="pdemo-confirm-btn"'), 'botón confirmar / jugar presente');
assert.ok(ctrl.element.innerHTML.includes('id="pdemo-close-x"'), 'botón cerrar X presente');
assert.ok(ctrl.element.innerHTML.includes('id="pdemo-dont-show"'), 'checkbox no volver a mostrar presente');

ctrl.destroy();
assert.equal(mockBody.children.length, 0, 'modal removido al destruir');

console.log('✓ controlador visual e interactivo en DOM ok');

// ---- 4. Integración con Arena UI --------------------------------------------
const { createGame } = await import('../src/game.js');
const { mount } = await import('../src/ui.js');

globalThis.localStorage.removeItem('axie-chance:demo-seen:lvl-1');
globalThis.localStorage.removeItem('axie-chance:demo-pref:lvl-1');

const domNodes = fakeDom();
const testGame = createGame({ pace: 0 });
const testScreen = mount(testGame, { start: false });

// Arrancar en modo aventura nivel 1
testScreen.restart({ mode: 'adventure', adventureLevel: 1 });
await new Promise((r) => setTimeout(r, 10));

const demoBtn = domNodes['powers-demo-btn'];
assert.equal(demoBtn.hidden, false, 'botón de demostración de poderes visible en nivel de aventura');

// Abrir demo bajo demanda mediante API
const demoInst = testScreen.openPowerDemo(1, 'pot');
assert.ok(demoInst, 'demo abierta bajo demanda');
assert.ok(demoInst.element, 'elemento de demo presente');
demoInst.destroy();

console.log('✓ integración en Arena UI ok');
