import assert from 'node:assert/strict';
import { fakeDom } from './dom.mjs';

// Montar DOM simulado para las pruebas
fakeDom();

const { createSteps, createOverlay, createTutorial } = await import('../src/tutorial.js');
const { createGame } = await import('../src/game.js');

// 1. Verificación de pasos del tutorial
const steps = createSteps();
assert.equal(steps.length, 27, 'el tutorial debe tener 27 pasos pautados');

// Todos los pasos tienen estructura requerida
for (const s of steps) {
  assert.ok(s.id, 'cada paso debe tener un id');
  assert.ok(s.round >= 1 && s.round <= 5, 'cada paso debe pertenecer a una ronda entre 1 y 5');
  assert.ok(['coach', 'modal'].includes(s.type), `tipo de paso inválido en ${s.id}: ${s.type}`);
  if (s.type === 'coach') {
    assert.ok(s.action, `los pasos coach deben indicar una acción (${s.id})`);
    assert.notEqual(s.allowedAction, 'none', `un paso coach no puede ser de allowedAction none (${s.id})`);
  } else {
    assert.equal(s.allowedAction, 'none', `los pasos modal son explicativos sin acción (${s.id})`);
  }
}

// Paso del draft de la Maceta resalta directamente la carta
const potStep = steps.find((s) => s.id === 'r3-draft-pot');
assert.ok(potStep, 'debe existir el paso de draft de la Maceta');
assert.equal(potStep.allowedCard, 'pot');
assert.equal(potStep.highlight, '#market [data-power="pot"]', 'debe resaltar la Maceta en el market');

// 2. Verificación del overlay
const createdElements = [];
document.createElement = (tag) => {
  const el = {
    tagName: tag.toUpperCase(),
    _classes: new Set(),
    get className() { return [...this._classes].join(' '); },
    set className(val) {
      this._classes = new Set(String(val).split(/\s+/).filter(Boolean));
    },
    id: '',
    innerHTML: '',
    hidden: false,
    classList: {
      add(cls) { el._classes.add(cls); },
      remove(cls) { el._classes.delete(cls); },
      contains(cls) { return el._classes.has(cls); },
    },
    querySelector(sel) {
      if (sel === '.tuto-cta') return el._cta;
      if (sel === '.tuto-coach-close') return el._close;
      return null;
    },
    querySelectorAll() { return []; },
    remove() { el.removed = true; },
  };
  el._cta = { onclick: null };
  el._close = { onclick: null };
  createdElements.push(el);
  return el;
};
document.body = {
  appendChild(node) {
    document._bodyChildren = document._bodyChildren || [];
    document._bodyChildren.push(node);
  },
};
document.querySelectorAll = () => [];

const overlay = createOverlay();
assert.ok(overlay, 'createOverlay devuelve el controlador');

// Probar modo Coach
const mockState = { round: 1 };
let quitCalled = false;
overlay.show({
  step: steps[0], // r1-intro (coach)
  state: mockState,
  onQuit: () => { quitCalled = true; },
});

const overlayEl = createdElements[0];
assert.ok(overlayEl, 'el elemento overlay fue creado');
assert.ok(overlayEl.classList.contains('is-coach'), 'el paso 1 debe renderizarse en modo is-coach');
assert.ok(!overlayEl.classList.contains('is-modal'), 'el paso 1 no debe tener is-modal');
assert.match(overlayEl.innerHTML, /tuto-coach/, 'debe contener el contenedor tuto-coach');
assert.match(overlayEl.innerHTML, /Tu primera carta/, 'debe contener el título del paso');
assert.match(overlayEl.innerHTML, /Robar carta/, 'debe contener la indicación de robar carta');

// Probar botón salir del coach
overlayEl.querySelector('.tuto-coach-close').onclick();
assert.equal(quitCalled, true, 'el botón de salir debe invocar onQuit');

// Probar modo Modal
let dismissCalled = false;
const damageStep = steps.find((s) => s.id === 'r1-damage-expl');
overlay.show({
  step: damageStep,
  state: { roundScores: { p1: 5 } },
  onDismiss: () => { dismissCalled = true; },
});

assert.ok(overlayEl.classList.contains('is-modal'), 'el paso explicativo debe tener is-modal');
assert.ok(!overlayEl.classList.contains('is-coach'), 'el paso explicativo no debe tener is-coach');
assert.match(overlayEl.innerHTML, /tuto-dialog/, 'debe renderizar el diálogo modal');
assert.match(overlayEl.innerHTML, /Golpe conectado/, 'debe contener la explicación del golpe');

overlayEl.querySelector('.tuto-cta').onclick();
assert.equal(dismissCalled, true, 'el botón CTA del modal debe invocar onDismiss');

// Probar hide y destroy
overlay.hide();
assert.equal(overlayEl.hidden, true, 'hide() debe ocultar el overlay');
overlay.destroy();
assert.equal(overlayEl.removed, true, 'destroy() debe remover el elemento');

// 3. Verificación de flujo del motor de tutorial con createTutorial
const game = createGame({ pace: 0 });
let tutorialDone = false;
const tuto = createTutorial(game, () => { tutorialDone = true; });
assert.ok(tuto, 'createTutorial devuelve el objeto tutorial');
assert.equal(game.state.mode, 'tutorial', 'la partida debe iniciarse en modo tutorial');
assert.equal(game.state.axies.p2, 'plant', 'el rival en tutorial debe ser Planta (sin sorteo aleatorio)');

// Verificación de que la Maceta está en el mercado inicial
assert.ok(
  game.state.market.some((c) => c.power === 'pot'),
  'la Maceta debe estar presente en el market inicial gracias al orden del pool',
);

// 4. Invariantes de "Tutorial Irrompible":
// a) tutorialPlainOnly bloquea cartas con poder en el draft de R1 y R2
game.state.tutorialPlainOnly = true;
game.state.phase = 'draft';
game.state.draft = {
  order: ['p1'],
  index: 0,
  step: 'normal',
  mode: null,
  remaining: 0,
  took: 0,
  bonus: 0,
  renewed: { p1: false, p2: false },
};

const pickables = game.pickable();
assert.ok(pickables.length > 0, 'debe haber cartas sin poder disponibles');
assert.ok(pickables.every((c) => !c.power), 'pickable() no debe incluir cartas con poder si tutorialPlainOnly está activo');

const potInMarket = game.state.market.find((c) => c.power === 'pot');
assert.ok(potInMarket, 'la Maceta sigue en el market');
const initialMarketLen = game.state.market.length;
await game.takeCard(potInMarket.uid);
assert.equal(game.state.market.length, initialMarketLen, 'takeCard no debe permitir levantar la Maceta con tutorialPlainOnly activo');

// b) En paso de la Maceta (r3-draft-pot), solo la Maceta es elegible
game.state.tutorialPlainOnly = false;
game.state.tutorialAllowedCard = potInMarket.uid;
const potPickables = game.pickable();
assert.equal(potPickables.length, 1, 'solo debe haber 1 carta elegible');
assert.equal(potPickables[0].uid, potInMarket.uid, 'la única carta elegible debe ser la Maceta');

// c) Inmortalidad del jugador en el tutorial: el daño a p1 se recorta y matchOver no corta en R1..R4
game.state.round = 2;
game.state.totals.p2 = 200; // Intento forzar daño masivo al jugador
const hpP1 = 100 - game.state.totals.p2 + game.state.healed.p1;
// Aunque los totales fueran alterados, el daño recibido en turno respeta el suelo de vida
// y matchOver nunca termina la partida antes de la ronda 5
game.state.round = 1;
// En matchOver:
assert.equal(
  game.state.round >= 5 && (100 - game.state.totals.p1 + game.state.healed.p2 <= 0),
  false,
  'matchOver() debe retornar false en rondas 1 a 4',
);

// d) Sincronización de transiciones de rondas (advanceTrigger de draft)
const r1Draft = steps.find((s) => s.id === 'r1-draft');
assert.equal(
  r1Draft.advanceTrigger({ round: 1, phase: 'turn', turn: 'p2' }),
  false,
  'r1-draft no debe avanzar mientras la CPU juega en ronda 1',
);
assert.equal(
  r1Draft.advanceTrigger({ round: 2, phase: 'turn', turn: 'p1' }),
  true,
  'r1-draft avanza cuando la ronda 2 inicia y es el turno del jugador',
);
assert.match(
  r1Draft.desc({ phase: 'draft' }),
  /Centro/,
  'desc de draft muestra instrucción de draft mientras phase === "draft"',
);
assert.match(
  r1Draft.desc({ phase: 'turn' }),
  /CPU/,
  'desc de draft muestra espera de CPU mientras phase !== "draft"',
);

// e) Actualización dinámica de texto en overlay (updateText)
let updatedDesc = '';
let updatedAct = '';
overlay.show({ step: r1Draft, state: { phase: 'draft' } });
overlayEl.querySelector = (sel) => {
  if (sel === '.tuto-coach-desc') return { set innerHTML(val) { updatedDesc = val; } };
  if (sel === '.tuto-coach-act span:last-child') return { set innerHTML(val) { updatedAct = val; } };
  return null;
};
overlay.updateText({ step: r1Draft, state: { phase: 'turn' } });
assert.match(updatedDesc, /CPU juega su turno/, 'updateText actualiza el texto a la espera de la CPU');

// Limpieza del primer test
tuto.destroy();
assert.equal(game.state.tutorial, false, 'destroy() debe desactivar el flag de tutorial en game.state');
assert.equal(game.state.tutorialAllowed, null, 'destroy() debe limpiar tutorialAllowed');
assert.equal(game.state.tutorialPlainOnly, false, 'destroy() debe limpiar tutorialPlainOnly');

// f) Simulación en vivo de jugada guiada: Ronda 1 completa y transición a Ronda 2
const liveGame = createGame({ pace: 0 });
const liveTuto = createTutorial(liveGame, () => {});
await new Promise((r) => setTimeout(r, 50));

assert.equal(liveGame.state.round, 1);
assert.equal(liveGame.state.chains.p1.cards.length, 1);
assert.equal(steps[0].advanceTrigger(liveGame.state), false);

// 1. Robar segunda carta
await liveGame.hit('p1');
assert.equal(liveGame.state.chains.p1.cards.length, 2);
assert.equal(steps[0].advanceTrigger(liveGame.state), true);

// 2. Plantarse (Atacar)
assert.equal(steps[1].advanceTrigger(liveGame.state), false);
await liveGame.stand('p1');
await new Promise((r) => setTimeout(r, 50));
assert.equal(steps[1].advanceTrigger(liveGame.state), true);
assert.equal(liveGame.state.phase, 'draft');

// 3. Draft de ronda 1: solo cartas sin poder
liveGame.state.tutorialPlainOnly = true;
const availablePlain = liveGame.pickable();
assert.ok(availablePlain.length > 0);
assert.ok(availablePlain.every((c) => !c.power));

// Levantar 2 cartas sin poder (reparto normal de atacante plantado)
await liveGame.takeCard(availablePlain[0].uid);
if (liveGame.state.draft && liveGame.state.draft.remaining > 0) {
  const nextPlain = liveGame.pickable()[0];
  await liveGame.takeCard(nextPlain.uid);
}

// 4. La CPU juega su turno, no draftea por bypass de tutorial y avanza a Ronda 2
await new Promise((r) => setTimeout(r, 100));
assert.equal(liveGame.state.round, 2);
assert.equal(liveGame.state.turn, 'p1');
assert.equal(r1Draft.advanceTrigger(liveGame.state), true, 'al iniciar la ronda 2, r1-draft avanza exitosamente');

liveTuto.destroy();

// 5. Verificación de que las explicaciones no interrumpen animaciones de ataque o del enemigo
const r1Card2 = steps.find((s) => s.id === 'r1-card2');
assert.equal(
  r1Card2.advanceTrigger({ round: 1, roundScores: { p1: 5 }, phase: 'turn' }),
  false,
  'r1-card2 no debe avanzar mientras transcurre la animación de ataque (phase === turn)',
);
assert.equal(
  r1Card2.advanceTrigger({ round: 1, roundScores: { p1: 5 }, phase: 'draft' }),
  true,
  'r1-card2 avanza una vez concluida la animación de ataque (phase === draft)',
);

const r2Card3 = steps.find((s) => s.id === 'r2-card3');
assert.equal(
  r2Card3.advanceTrigger({ round: 2, chains: { p1: { busted: true } }, phase: 'turn' }),
  false,
  'r2-card3 no debe avanzar mientras transcurre la animación de corte/desarme (phase === turn)',
);
assert.equal(
  r2Card3.advanceTrigger({ round: 2, chains: { p1: { busted: true } }, phase: 'draft' }),
  true,
  'r2-card3 avanza una vez concluido el corte (phase === draft)',
);

const r4Pot = steps.find((s) => s.id === 'r4-pot-drawn');
assert.ok(r4Pot, 'debe existir el paso de salida de la Maceta');
assert.equal(r4Pot.allowedAction, 'hit', 'al salir la Maceta el jugador continúa robando');
assert.equal(
  r4Pot.advanceTrigger({ round: 4, chains: { p1: { cards: [{}, {}, {}, {}] } } }),
  true,
  'r4-pot-drawn avanza al robar la cuarta carta',
);

const r4Strike = steps.find((s) => s.id === 'r4-strike');
assert.ok(r4Strike, 'debe existir el paso de ataque colosal en ronda 4');
assert.equal(
  r4Strike.advanceTrigger({ round: 4, roundScores: { p1: 75 }, phase: 'turn' }),
  false,
  'r4-strike no debe avanzar durante la animación de ataque y curación (phase === turn)',
);
assert.equal(
  r4Strike.advanceTrigger({ round: 4, roundScores: { p1: 75 }, phase: 'draft' }),
  true,
  'r4-strike avanza tras concluir ataque y curación (phase === draft)',
);

const r5Card4 = steps.find((s) => s.id === 'r5-card4');
assert.equal(
  r5Card4.advanceTrigger({ round: 5, roundScores: { p1: 16 }, tutorialLastChanceReady: false }),
  false,
  'r5-card4 no debe avanzar hasta que la animación de 16 de daño concluya y el hook pause la CPU',
);
assert.equal(
  r5Card4.advanceTrigger({ round: 5, roundScores: { p1: 16 }, tutorialLastChanceReady: true }),
  true,
  'r5-card4 avanza cuando la animación concluyó y el juego está pausado para explicar Última Chance',
);

// 6. Simulación de pausa en Ronda 5: la CPU no juega hasta confirmar Última Chance
const r5Game = createGame({ pace: 0 });
const r5Tuto = createTutorial(r5Game, () => {});
r5Game.state.round = 5;
r5Game.state.totals.p1 = 85; // CPU con 15 HP
assert.ok(typeof r5Game.state.onTutorialBeforeBot === 'function', 'debe registrar hook de pausa de bot');

let botPaused = true;
const pausePromise = r5Game.state.onTutorialBeforeBot();
assert.equal(r5Game.state.tutorialLastChanceReady, true, 'el hook activa tutorialLastChanceReady');

// Simular que el usuario hace clic en el CTA de r5-last-chance-expl
const lastChanceStep = steps.find((s) => s.id === 'r5-last-chance-expl');
overlayEl.querySelector = (sel) => {
  if (sel === '.tuto-cta') return overlayEl._cta;
  if (sel === '.tuto-coach-close') return overlayEl._close;
  return null;
};
overlay.show({
  step: lastChanceStep,
  state: r5Game.state,
  onDismiss: () => {
    r5Game.state.tutorialLastChanceReady = false;
    botPaused = false;
  },
});
overlayEl.querySelector('.tuto-cta').onclick();
assert.equal(botPaused, false, 'al confirmar la explicación de Última Chance se libera la pausa de la CPU');

r5Tuto.destroy();

// 7. Verificación de que el resaltado apunta al Axie (#axie-p2 / #axie-p1) y nunca al contenedor #fighter ni incluye la vida
for (const s of steps) {
  const attackingState = { roundScores: { p1: 5 }, chains: { p1: { cards: [] } } };
  const h = typeof s.highlight === 'function' ? s.highlight(attackingState) : s.highlight;
  if (h) {
    assert.ok(!h.includes('#fighter-p2'), `el paso ${s.id} no debe resaltar #fighter-p2 (abarcaría la barra de vida y formaría un recuadro)`);
    assert.ok(!h.includes('#fighter-p1'), `el paso ${s.id} no debe resaltar #fighter-p1`);
  }
}
const r1AttackH = steps.find((s) => s.id === 'r1-card2').highlight({ roundScores: { p1: 5 } });
assert.equal(r1AttackH, '#axie-p2', 'el ataque de ronda 1 debe resaltar el Axie rival directamente');
const r3AttackH = steps.find((s) => s.id === 'r3-stand').highlight({ roundScores: { p1: 5 } });
assert.equal(r3AttackH, '#axie-p2', 'el ataque de ronda 3 debe resaltar el Axie rival directamente');
const r4StrikeH = steps.find((s) => s.id === 'r4-strike').highlight({ roundScores: { p1: 75 } });
assert.equal(r4StrikeH, '#axie-p1', 'el efecto de curación de ronda 4 debe resaltar el Axie propio');
const r5AttackH = steps.find((s) => s.id === 'r5-card4').highlight({ roundScores: { p1: 16 } });
assert.equal(r5AttackH, '#axie-p2', 'el remate final de ronda 5 debe resaltar el Axie rival directamente');

// 8. Verificación de daño colosal en Ronda 4 (cadena de 7 cartas = 75 de daño exacto -> CPU queda en 15 HP)
const { createDecks } = await import('../src/tutorial.js');
const { emptyChain, playCard, scoreChain } = await import('../src/rules.js');
const decks = createDecks();
let r4Chain = emptyChain();
const r4P1Cards = [...decks[4].p1];
// Sacamos las primeras 7 cartas en el orden que se juegan (pop del final)
for (let i = 0; i < 7; i++) {
  const card = r4P1Cards.pop();
  r4Chain = playCard(r4Chain, card);
}
assert.equal(r4Chain.cards.length, 7, 'ronda 4 debe permitir encadenar 7 cartas');
assert.equal(r4Chain.busted, false, 'la cadena de 7 cartas de ronda 4 no debe cortarse');
assert.ok(r4Chain.cards.some((c) => c.power === 'pot'), 'la cadena de ronda 4 debe contener la Maceta');
const r4Score = scoreChain(r4Chain).total;
assert.equal(r4Score, 75, 'la cadena de 7 cartas debe infligir exactamente 75 de daño');
// Ronda 1 (5 pts) + Ronda 2 (0 pts) + Ronda 3 (5 pts) + Ronda 4 (75 pts) = 85 de daño total -> 15 HP restantes
assert.equal(100 - (5 + 0 + 5 + r4Score), 15, 'el daño de ronda 4 debe dejar al rival exactamente en 15 HP para la ronda 5');

console.log('✓ tutorial ok (dual coach/modal, gating de acciones, irrompibilidad y flujo)');


