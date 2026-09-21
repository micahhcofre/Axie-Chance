import assert from 'node:assert/strict';
import { fakeDom } from './dom.mjs';

const dom = fakeDom();

const { createSteps, createTutorial, arrange, SCRIPT } = await import('../src/tutorial.js');
const { createGame, hpOf } = await import('../src/game.js');
const { buildPersonalDeck, makeCard, TUNING } = await import('../src/data.js');
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

// El mazo no se cuenta: se abre tocando tu Axie, y hasta que no lo abre, no se sigue.
const r2Deck = steps.find((s) => s.id === 'r2-deck');
assert.equal(r2Deck.target(), '#peek-p1', 'la flecha señala el botón que abre el mazo');
assert.equal(r2Deck.glow(), '#axie-p1', 'y el que brilla es el dibujo del Axie');
assert.equal(r2Deck.allowed, 'none', 'la mesa espera a que mire su mazo');
assert.equal(r2Deck.bubble, 'Tocá tu Axie: es tu mazo');
assert.equal(r2Deck.done({}, { deck: 0 }), false, 'sin abrir el mazo no se avanza');
assert.equal(r2Deck.done({}, { deck: 1 }), true, 'abrirlo y cerrarlo alcanza');

const r4Deck = steps.find((s) => s.id === 'r4-deck');
assert.equal(r4Deck.target(), '#peek-p1');
assert.equal(r4Deck.glow(), '#axie-p1');
assert.equal(r4Deck.allowed, 'none');
assert.equal(r4Deck.bubble, 'Tocá tu Axie: sumaste el cohete');
assert.equal(r4Deck.done({}, { deck: 0 }), false);
assert.equal(r4Deck.done({}, { deck: 1 }), true);
assert.ok(steps.indexOf(r4Deck) === steps.indexOf(r4Rocket) + 1, 'el cohete se mira después de llevárselo');

const r5Stack = steps.find((s) => s.id === 'r5-stack');
assert.equal(r5Stack.side, 'bottom');
assert.equal(r5Stack.bubble, 'Montala en la 2ª carta');

// 2. El guión no inventa cartas: reparte el mazo de verdad y hace lo que promete
//
// El mazo de cada uno son sus diez de fábrica más lo que se llevó del centro. Acá se
// arma el mismo mazo que tiene la partida y se comprueba que todo lo que sale en la
// mesa esté adentro —que es lo que el jugador ve al abrirlo— y que las cadenas den los
// números con los que está pensada la partida.
const mine = buildPersonalDeck('aquatic');
const theirs = buildPersonalDeck('plant');
// Las dos del centro de la ronda 1: dos de las tres de color que ofrece (las tres
// llevan Pez y Pájaro, así que cualquier par alarga la misma cadena).
const fromCenter = [makeCard(['aquatic', 'bird', 'bug']), makeCard(['aquatic', 'bird', 'reptile'])];
const rocketCard = makeCard(['aquatic', 'bird'], 'freegame');

/** Lo que pasa en una ronda: el mazo puesto por el guión y las `n` cartas que salen. */
function roundOf(seat, round, n, { own, added = [] }) {
  const deck = arrange([...own, ...added], SCRIPT[round][seat], added);
  assert.equal(deck.length, own.length + added.length, `la ronda ${round} reparte el mazo entero`);
  let chain = emptyChain();
  for (let i = 0; i < n; i++) {
    const card = deck.pop();
    assert.ok(own.includes(card) || added.includes(card),
      `la ronda ${round} reparte una carta que no está en el mazo de ${seat}`);
    chain = playCard(chain, card);
  }
  return { chain, deck, damage: scoreChain(chain).total };
}

const me = { own: mine };
const meDrafted = { own: mine, added: fromCenter };
const meRocket = { own: mine, added: [...fromCenter, rocketCard] };
const rival = { own: theirs };

// Ronda 1: tres cartas de tu color, sin cortarse
const r1 = roundOf('p1', 1, 3, me);
assert.equal(r1.chain.busted, false, 'la cadena de la ronda 1 no corta');
assert.equal(r1.damage, 10, 'la ronda 1 pega 10');
assert.equal(roundOf('p2', 1, 2, rival).damage, 5, 'el rival pega 5 en la ronda 1');

// Ronda 2: cadena larga con las dos del centro adelante; el rival se corta con la tercera
const r2 = roundOf('p1', 2, 5, meDrafted);
assert.equal(r2.chain.busted, false, 'las cinco cartas de la ronda 2 no cortan');
assert.equal(r2.damage, 35, 'la ronda 2 pega 35');
assert.equal(roundOf('p2', 2, 3, rival).chain.busted, true, 'la CPU se corta con su tercera de la ronda 2');

// Ronda 3: la racha va por Bestia, que son tres cartas en todo el mazo: con las tres
// afuera la rueda marca 0% y la cuarta corta de verdad.
const r3 = roundOf('p1', 3, 3, meDrafted);
assert.equal(r3.chain.busted, false, 'con tres cartas en la ronda 3 no corta');
assert.equal(survivalOdds(r3.chain, r3.deck).p, 0, 'la rueda de la ronda 3 llega a 0%');
assert.equal(roundOf('p1', 3, 4, meDrafted).chain.busted, true, 'la cuarta carta de la ronda 3 corta');

// Ronda 4: la cadena más larga de todas
const r4 = roundOf('p1', 4, 6, meDrafted);
assert.equal(r4.chain.busted, false, 'las seis cartas de la ronda 4 no cortan');
assert.equal(r4.damage, 46, 'la ronda 4 pega 46');

// Ronda 5: el Rocket sale tercero y la cuarta se monta en la 2ª carta, reviviendo Planta
const r5 = roundOf('p1', 5, 3, meRocket);
assert.equal(r5.chain.cards[2].power, 'freegame', 'el Rocket es la tercera carta');
const loose = r5.deck.pop();
assert.ok(loose.symbols.includes('plant'), 'la cuarta carta de la ronda 5 trae Planta');
const saved = stackOnCard(r5.chain, 1, loose);
assert.equal(saved.busted, false, 'montada en la 2ª carta, la cadena sigue viva');
assert.equal(scoreChain(saved).total, 13, 'montada en la 2ª carta revive Planta y suma 13');
assert.equal(roundOf('p2', 5, 3, rival).chain.busted, true, 'el rival se corta en su última chance');

// Y la cuenta de la partida: el remate de la ronda 5 lo deja en 0 sin pasarse de
// `overkill`, que es lo que le da su última chance.
const hits = [r1.damage, r2.damage, 0, r4.damage, scoreChain(saved).total];
const before = 100 - hits.slice(0, 4).reduce((a, b) => a + b, 0);
assert.ok(before > 0, 'el rival llega vivo a la ronda 5');
assert.ok(hits[4] >= before, 'el remate de la ronda 5 lo deja en 0');
assert.ok(hits[4] - before <= TUNING.overkill, 'sin pasarse: el rival tiene su última chance');

// 3. Una partida guiada de punta a punta
const game = createGame({ pace: 0 });
let done = false;
const tuto = createTutorial(game, () => { done = true; });
const st = () => game.state;
assert.equal(st().mode, 'tutorial');
assert.equal(st().axies.p2, 'plant', 'el rival del tutorial es Planta');

// Tocar tu Axie, que es lo que abre el mazo (el tutorial lo pide dos veces).
const peekDeck = () => dom['peek-p1'].handlers.click?.();

const rivalBusts = [];
const scores = {};
game.subscribe((s) => {
  if (s.chains?.p2?.busted) rivalBusts.push(s.round);
  if (s.roundScores?.p1 != null) scores[s.round] = s.roundScores.p1;
});
await wait(500);

// Ronda 1: robar dos cartas, atacar y draftear 2 cartas de tu color
assert.equal(st().round, 1);
assert.equal(st().chains.p1.cards.length, 1, 'la ronda 1 abre con una carta');
await game.stand('p1');
assert.equal(st().chains.p1.cards.length, 1, 'antes de robar no se puede atacar');
for (let i = 0; i < 2; i++) await game.hit('p1');
assert.equal(st().chains.p1.cards.length, 3, 'roba dos cartas más para formar la cadena');
for (const card of st().chains.p1.cards) {
  assert.ok(st().start.p1.includes(card), 'lo que sale en la mesa está en el mazo de fábrica');
}
await game.stand('p1');
await wait();

// Centro en ronda 1: solo cartas sin poder y de tu color
assert.equal(st().phase, 'draft', 'al atacar en ronda 1 se abre el centro');
assert.ok(game.pickable().length > 0, 'hay algo para elegir');
assert.ok(game.pickable().every((c) => !c.power && c.symbols.includes('aquatic')),
  'el centro de la ronda 1 solo ofrece cartas sin poder y de tu color');
assert.ok(st().market.some((c) => !c.power && !c.symbols.includes('aquatic')),
  'y el centro muestra también cartas ajenas, que son las que no se pueden llevar');
const pick1 = game.pickable().find((c) => c.symbols.includes('aquatic') && !c.power);
assert.ok(pick1, 'hay carta de tu color sin poder para elegir');
await game.takeCard(pick1.uid);
await wait();
assert.equal(st().phase, 'draft', 'quedan 2 cartas por elegir en ronda 1');
const pick2 = game.pickable().find((c) => c.symbols.includes('aquatic') && !c.power);
assert.ok(pick2, 'hay segunda carta de tu color para elegir');
await game.takeCard(pick2.uid);
await wait(50);

// Ronda 2: mirar el mazo, cadena larga, atacar, y la CPU se corta
assert.equal(st().round, 2, 'después del draft y la respuesta de la CPU empieza la ronda 2');
await game.hit('p1');
assert.equal(st().chains.p1.cards.length, 1, 'antes de abrir el mazo no se roba');
peekDeck();
await wait();
for (let i = 0; i < 4; i++) await game.hit('p1');
assert.equal(st().chains.p1.cards.length, 5);
// Todo lo que salió es del mazo: las de fábrica o las que se llevó del centro
for (const card of st().chains.p1.cards) {
  assert.ok(st().start.p1.includes(card) || st().added.p1.includes(card),
    'la ronda 2 reparte una carta que no está en el mazo');
}
await game.stand('p1');
await wait(50);
assert.ok(rivalBusts.includes(2), 'la CPU se corta en la ronda 2');
assert.equal(st().round, 3, 'el centro se saltea en ronda 2');

// Ronda 3: cadena de 3 cartas y la cuarta corta (you busted)
for (let i = 0; i < 3; i++) await game.hit('p1');
assert.equal(st().chains.p1.busted, true, 'la cuarta carta de la ronda 3 corta');
await wait(50);
assert.equal(st().round, 4, 'el centro se saltea tras el corte en ronda 3');

// Ronda 4: seis cartas, atacar y llevarse el Rocket del centro
for (let i = 0; i < 5; i++) await game.hit('p1');
assert.equal(st().chains.p1.cards.length, 6);
await game.stand('p1');
await wait();
assert.equal(st().phase, 'draft', 'en la ronda 4 se abre el centro para el Rocket');
const rocket = game.pickable();
assert.equal(rocket.length, 1, 'del centro de la ronda 4 solo se puede llevar una carta');
assert.equal(rocket[0].power, 'freegame', 'y es el Rocket Stamp');
await game.takeCard(rocket[0].uid);
await wait(50);

// Con el cohete adentro, el tutorial vuelve a pedir el mazo antes de seguir
assert.equal(st().round, 5);
await game.hit('p1');
assert.equal(st().chains.p1.cards.length, 1, 'antes de ver el cohete en el mazo no se roba');
peekDeck();
await wait();

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
assert.equal(scoreChain(st().chains.p1).total, 13, 'cadena de planta revivida');

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
