import assert from 'node:assert/strict';
import { fakeDom } from './dom.mjs';

fakeDom();

const { createSteps, createDecks, createTutorial } = await import('../src/tutorial.js');
const { createGame, hpOf } = await import('../src/game.js');
const { emptyChain, playCard, scoreChain, stackOnCard, survivalOdds } = await import('../src/rules.js');

const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const words = (text) => String(text).replace(/<[^>]+>/g, ' ').trim().split(/\s+/).length;

// 1. Los pasos: poco texto y ningún modal (ver docs/tutorial.md)
const steps = createSteps();
const ids = new Set();
const bubblesPerRound = {};
for (const s of steps) {
  assert.ok(s.id && !ids.has(s.id), `id de paso repetido o vacío: ${s.id}`);
  ids.add(s.id);
  assert.ok(s.round >= 1 && s.round <= 5, `ronda fuera de rango en ${s.id}`);
  assert.ok(['hit', 'stand', 'any', 'none'].includes(s.allowed), `acción inválida en ${s.id}: ${s.allowed}`);
  assert.equal(typeof s.done, 'function', `${s.id} necesita una condición de avance`);
  assert.equal(typeof s.target, 'function', `${s.id} necesita decir qué señala`);
  assert.ok(!('message' in s) && !('ctaText' in s), `${s.id} parece un modal: el tutorial no tiene`);
  if (s.bubble) {
    assert.ok(words(s.bubble) <= 6, `la burbuja de ${s.id} pasa de 6 palabras: "${s.bubble}"`);
    bubblesPerRound[s.round] = (bubblesPerRound[s.round] ?? 0) + 1;
  }
}
for (const [round, n] of Object.entries(bubblesPerRound)) {
  const max = Number(round) === 1 ? 3 : 2;
  assert.ok(n <= max, `la ronda ${round} tiene ${n} burbujas (máximo ${max})`);
}
assert.deepEqual([...new Set(steps.map((s) => s.round))], [1, 2, 3, 4, 5], 'cinco rondas, en orden');

const r1Draw = steps.find((s) => s.id === 'r1-draw');
assert.equal(r1Draw.target(), '#field .card[data-col="0"]');
assert.equal(r1Draw.side, 'left');
assert.equal(r1Draw.bubble, 'Cadenas vivas');

const r1Chain = steps.find((s) => s.id === 'r1-chain');
assert.equal(r1Chain.target(), '#swing');
assert.equal(r1Chain.side, 'left');
assert.equal(r1Chain.bubble, 'Cadenas largas hacen más daño');

const r1Color = steps.find((s) => s.id === 'r1-color');
assert.equal(r1Color.side, 'top');
assert.equal(r1Color.bubble, 'Buscá tu color');

const r2Bust = steps.find((s) => s.id === 'r2-rival-bust');
assert.equal(r2Bust.target({ chains: { p2: { busted: true } } }), '#field .card--bust');
assert.equal(r2Bust.target({ chains: { p2: { busted: false } } }), null);
assert.equal(r2Bust.bubble, '¡Cadena rota! No comparte símbolos');

const r3Odds = steps.find((s) => s.id === 'r3-odds');
assert.equal(r3Odds.target(), '#odds');
assert.equal(r3Odds.side, 'top');
assert.equal(r3Odds.glow(), '#odds');
assert.equal(r3Odds.bubble, 'Chances de seguir la cadena');

const r3Bust = steps.find((s) => s.id === 'r3-bust');
assert.equal(r3Bust.target({ chains: { p1: { busted: true } } }), '#field .card--bust');
assert.equal(r3Bust.target({ chains: { p1: { busted: false } } }), null);
assert.equal(r3Bust.bubble, '¡Cadena rota! No comparte símbolos');

const r4Rocket = steps.find((s) => s.id === 'r4-rocket');
assert.equal(r4Rocket.side, 'top');
assert.equal(r4Rocket.bubble, 'Llevate el cohete');

const r5Stack = steps.find((s) => s.id === 'r5-stack');
assert.equal(r5Stack.side, 'bottom');
assert.equal(r5Stack.bubble, 'Montala en la 2ª carta');

// 2. Los mazos hacen lo que el guión promete
const decks = createDecks();
const play = (cards, n) => {
  const deck = [...cards];
  let chain = emptyChain();
  for (let i = 0; i < n; i++) chain = playCard(chain, deck.pop());
  return { chain, deck };
};

// Ronda 1: dos cartas que encadenan sin cortarse
assert.equal(play(decks[1].p1, 2).chain.busted, false, 'las dos cartas de la ronda 1 no cortan');

// Ronda 2: cuatro sin cortarse; la CPU se corta con su tercera
assert.equal(play(decks[2].p1, 4).chain.busted, false, 'las cuatro cartas de la ronda 2 no cortan');
assert.equal(play(decks[2].p2, 3).chain.busted, true, 'la CPU se corta con su tercera carta de la ronda 2');

// Ronda 3: racha de 3 cartas, la cuarta carta corta
assert.equal(play(decks[3].p1, 3).chain.busted, false, 'con tres cartas en ronda 3 no corta');
assert.equal(play(decks[3].p1, 4).chain.busted, true, 'la cuarta carta de la ronda 3 corta');

// Ronda 4: cinco cartas que encajan
assert.equal(play(decks[4].p1, 5).chain.busted, false, 'las cinco cartas de la ronda 4 no cortan');

// Ronda 5: el Rocket sale tercero, la cuarta en pendingStack se monta en columna 1 (2ª carta) reviviendo planta
{
  const deck = [...decks[5].p1];
  let chain = emptyChain();
  for (let i = 0; i < 3; i++) chain = playCard(chain, deck.pop());
  assert.ok(chain.cards[2].power === 'freegame', 'el Rocket es la tercera carta');
  const loose = deck.pop();

  const saved = stackOnCard(chain, 1, loose);
  assert.equal(saved.busted, false, 'montada en la columna 2, la cadena sigue viva');
  assert.equal(scoreChain(saved).total, 18, 'montada en la 2ª carta, revive planta y suma 18 de daño');
}

// 3. Una partida guiada de punta a punta
const game = createGame({ pace: 0 });
let done = false;
const tuto = createTutorial(game, () => { done = true; });
const st = () => game.state;
assert.equal(st().mode, 'tutorial');
assert.equal(st().axies.p2, 'plant', 'el rival del tutorial es Planta');

const rivalBusts = [];
const scores = {};
game.subscribe((s) => {
  if (s.chains?.p2?.busted) rivalBusts.push(s.round);
  if (s.roundScores?.p1 != null) scores[s.round] = s.roundScores.p1;
});
await wait(500);

// Ronda 1: robar 2ª carta, atacar y draftear 2 cartas de tu color
assert.equal(st().round, 1);
assert.equal(st().chains.p1.cards.length, 1, 'la ronda 1 abre con una carta');
await game.stand('p1');
assert.equal(st().chains.p1.cards.length, 1, 'antes de robar no se puede atacar');
await game.hit('p1');
assert.equal(st().chains.p1.cards.length, 2, 'roba la 2ª carta para formar la cadena');
await game.stand('p1');
await wait();

// Centro en ronda 1: draftear 2 cartas sin poder recomendando tu color
assert.equal(st().phase, 'draft', 'al atacar en ronda 1 se abre el centro');
const pick1 = game.pickable().find((c) => c.symbols.includes('aquatic') && !c.power);
assert.ok(pick1, 'hay carta de tu color sin poder para elegir');
await game.takeCard(pick1.uid);
await wait();
assert.equal(st().phase, 'draft', 'quedan 2 cartas por elegir en ronda 1');
const pick2 = game.pickable().find((c) => c.symbols.includes('aquatic') && !c.power);
assert.ok(pick2, 'hay segunda carta de tu color para elegir');
await game.takeCard(pick2.uid);
await wait(50);

// Ronda 2: cadena larga, atacar, y la CPU se corta
assert.equal(st().round, 2, 'después del draft y la respuesta de la CPU empieza la ronda 2');
for (let i = 0; i < 3; i++) await game.hit('p1');
assert.equal(st().chains.p1.cards.length, 4);
await game.stand('p1');
await wait(50);
assert.ok(rivalBusts.includes(2), 'la CPU se corta en la ronda 2');
assert.equal(st().round, 3, 'el centro se saltea en ronda 2');

// Ronda 3: cadena de 3 cartas y la cuarta corta (you busted)
for (let i = 0; i < 3; i++) await game.hit('p1');
assert.equal(st().chains.p1.busted, true, 'la cuarta carta de la ronda 3 corta');
await wait(50);
assert.equal(st().round, 4, 'el centro se saltea tras el corte en ronda 3');

// Ronda 4: cinco cartas, atacar y llevarse el Rocket del centro
for (let i = 0; i < 4; i++) await game.hit('p1');
assert.equal(st().chains.p1.cards.length, 5);
await game.stand('p1');
await wait();
assert.equal(st().phase, 'draft', 'en la ronda 4 se abre el centro para el Rocket');
const rocket = game.pickable();
assert.equal(rocket.length, 1, 'del centro de la ronda 4 solo se puede llevar una carta');
assert.equal(rocket[0].power, 'freegame', 'y es el Rocket Stamp');
await game.takeCard(rocket[0].uid);
await wait(50);

// Ronda 5: Rocket en 3ª carta, colocar en 2ª carta para revivir planta y remate en Last Chance
assert.equal(st().round, 5);
await game.hit('p1'); // 2ª carta
await game.hit('p1'); // 3ª carta (Rocket)
await wait(20);
assert.ok(st().freeGame.p1, 'el Rocket quedó activo');
await game.hit('p1'); // 4ª carta (se monta con Free Game)
assert.equal(st().pendingStack?.player, 'p1', 'la 4ª carta espera columna');

// No permitir columna que no sea la 1 (2ª carta)
await game.chooseStackTarget(0);
assert.ok(st().pendingStack, 'no se puede colocar en la columna 1');
await game.chooseStackTarget(1);
assert.equal(st().chains.p1.busted, false, 'montada en columna 2, la cadena sigue viva');
assert.equal(scoreChain(st().chains.p1).total, 18, 'cadena de planta revivida');

await game.stand('p1');
await wait(100);
assert.equal(st().phase, 'matchEnd', 'el remate termina la partida tras el Last Chance del rival');
assert.equal(hpOf(st(), 'p2'), 0, 'el rival quedó en 0');
assert.ok(hpOf(st(), 'p1') > 0, 'y vos seguís en pie');
assert.equal(done, false, 'el tutorial espera en la pantalla final');
tuto.destroy();
assert.equal(st().tutorial, false, 'al terminar se apaga el modo tutorial');
assert.equal(st().tutorialAllowed, null);

// 4. Salir a mitad de camino deja la partida limpia
const game2 = createGame({ pace: 0 });
const tuto2 = createTutorial(game2, () => {});
await wait();
tuto2.destroy();
assert.equal(game2.state.tutorial, false);
assert.equal(game2.state.tutorialSkipDraft, false);
assert.equal(game2.state.onRoundStart, null);

console.log('✓ tutorial ok (5 rondas, poco texto, sin modales, rueda, centro, Rocket y remate)');
