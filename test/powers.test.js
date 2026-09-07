// Los seis poderes de las cartas del centro, uno por uno.
//
// Cada prueba arma a mano la cadena del jugador —con la carta del poder adentro— y
// suelta el ataque, que es el momento en que todos resuelven. Se mira el estado que
// queda puesto, no el registro: lo que importa es que el próximo golpe cuente bien.
import assert from 'node:assert/strict';
import { createGame, TARGET, POWER_NUMBERS, hpOf, swingOf } from '../src/game.js';
import { activeSymbols, emptyChain, playCard, scoreChain } from '../src/rules.js';

const idle = () => new Promise((r) => setTimeout(r, 0));

let uid = 10_000;
/** Una carta suelta, con o sin poder. Alcanza con `symbols` y `power`: el resto del
 *  juego no le mira nada más a una carta que ya está en la mesa. */
const card = (symbols, power = null) => ({ uid: uid++, symbols, power, key: `t${uid}` });
const chainOf = (...cards) => cards.reduce(playCard, emptyChain());

/**
 * Una partida detenida en el turno del jugador, con la cadena que se le pida ya
 * puesta. `axie: 'aquatic'` fija su símbolo; la CPU juega cualquier otra clase.
 */
async function atPlayerTurn(chain) {
  const game = createGame({ pace: 0 });
  game.newMatch({ difficulty: 'normal', axie: 'aquatic' });
  await idle();
  assert.equal(game.state.turn, 'human', 'arranca el jugador');
  if (chain) game.state.chains.human = chain;
  return game;
}

// --- fuerza: +2 en este ataque y en todos los que siguen ----------------------
{
  // Una cadena de dos aquatic vale 2² = 4. La carta de fuerza es el segundo eslabón.
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'], 'strength'));
  const game = await atPlayerTurn(chain);
  assert.equal(scoreChain(chain).total, 4 + 1, 'la cadena vale lo que vale'); // aquatic 2² + bird 1²

  // La fuerza todavía no está puesta: el golpe de este turno la estrena.
  assert.equal(swingOf(game.state, 'human'), 5, 'antes de soltar, el golpe es la cadena pelada');
  await game.stand();
  await idle();

  const st = game.state.status.human;
  assert.equal(st.strength, POWER_NUMBERS.strength, 'quedó +2 acumulado');
  assert.equal(game.state.roundScores.human, 5, 'el ataque que la estrena no la cobra');
  assert.equal(game.state.totals.human, 5, 'el daño aplicado es el del ataque');

  // La próxima cadena idéntica sí pega 2 más.
  game.state.chains.human = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant']));
  assert.equal(swingOf(game.state, 'human'), 5 + POWER_NUMBERS.strength, 'el golpe siguiente ya suma');

  // Y se acumula: una segunda carta de fuerza suma otros 2.
  game.state.status.human.strength += POWER_NUMBERS.strength;
  assert.equal(swingOf(game.state, 'human'), 5 + 2 * POWER_NUMBERS.strength, 'acumulable');
  console.log('  ✓ fuerza');
}

// --- caracol: el rival pega la mitad de tu golpe menos, dos ataques -----------
{
  // Cadena de 10: el caracol le saca 5 a cada uno de los dos próximos ataques.
  const chain = chainOf(
    card(['aquatic', 'bird']),
    card(['aquatic', 'plant'], 'snail'),
    card(['aquatic', 'beast']),
  );
  const game = await atPlayerTurn(chain);
  assert.equal(scoreChain(chain).total, 10);
  await game.stand();
  await idle();

  const st = game.state.status.cpu;
  assert.equal(st.weak, POWER_NUMBERS.snailAttacks, 'quedan dos ataques debilitados');
  assert.equal(st.weakBite, 5, 'muerde la mitad del golpe con que se lo pusieron');

  const clean = 5; // beast 2² + bird 1²
  game.state.chains.cpu = chainOf(card(['beast', 'bird']), card(['beast', 'plant']));
  assert.equal(swingOf(game.state, 'cpu'), clean - 5, 'pega 5 menos');

  // Un caracol chico no debilita al grande que ya estaba: suma ataques y se queda
  // con el mordisco más grande.
  game.state.status.cpu.weak += POWER_NUMBERS.snailAttacks;
  game.state.status.cpu.weakBite = Math.max(game.state.status.cpu.weakBite, 1);
  assert.equal(game.state.status.cpu.weakBite, 5, 'el mordisco no baja');
  assert.equal(game.state.status.cpu.weak, 4, 'la duración sí sube');

  // Nunca deja un ataque en negativo.
  game.state.status.cpu.weakBite = 99;
  assert.equal(swingOf(game.state, 'cpu'), 0, 'el golpe se hunde hasta 0, no más');

  // Una cadena cortada hace 0 y ningún modificador la mueve.
  game.state.chains.cpu = { ...game.state.chains.cpu, busted: true };
  assert.equal(swingOf(game.state, 'cpu'), 0, 'cortada es 0');
  console.log('  ✓ caracol');
}

// --- veneno: la mitad del daño, mordiendo cada ronda y bajando de a 2 ---------
{
  // aquatic×3 = 9, bird muere en la segunda: 9 + 1 = 10 de ataque → 5 de veneno.
  const chain = chainOf(
    card(['aquatic', 'bird']),
    card(['aquatic', 'plant'], 'poison'),
    card(['aquatic', 'beast']),
  );
  const game = await atPlayerTurn(chain);
  assert.equal(scoreChain(chain).total, 10);
  await game.stand();
  await idle();

  assert.equal(game.state.status.cpu.poison, 5, 'medio ataque de veneno');
  const before = hpOf(game.state, 'cpu');

  // El veneno muerde al cerrar el intercambio y recién después baja de a 2.
  while (game.state.phase !== 'roundEnd' && game.state.phase !== 'matchEnd') {
    if (game.state.phase === 'draft' && game.drafting() === 'human') await game.skipDraft();
    else await idle();
  }
  assert.equal(hpOf(game.state, 'cpu'), before - 5, 'mordió por 5');
  assert.equal(game.state.status.cpu.poison, 5 - POWER_NUMBERS.poisonDecay, 'y después bajó 2');
  console.log('  ✓ veneno');
}

// --- maceta: te curás lo que pegaste, sin pasarte de la vida inicial ----------
{
  // Entero no hay nada que curar: la maceta no sirve para pasarse de 100.
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'], 'pot'));
  const game = await atPlayerTurn(chain);
  await game.stand();
  await idle();
  assert.equal(hpOf(game.state, 'human'), TARGET, 'la cura no pasa de la vida inicial');
  assert.equal(game.state.healed.human, 0, 'no se guarda curación desperdiciada');
}
{
  // Lastimado sí cura, y exactamente lo que pegó.
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'], 'pot'));
  const game = await atPlayerTurn(chain);
  game.state.totals.cpu = 40;
  assert.equal(hpOf(game.state, 'human'), 60);
  await game.stand();
  await idle();
  assert.equal(hpOf(game.state, 'human'), 65, 'se curó los 5 que pegó');
  assert.equal(game.state.healed.human, 5);
}
{
  // Y cura solo hasta el tope, aunque pegue mucho más de lo que le falta.
  const chain = chainOf(
    card(['aquatic', 'bird']),
    card(['aquatic', 'plant'], 'pot'),
    card(['aquatic', 'beast']),
  );
  const game = await atPlayerTurn(chain);
  game.state.totals.cpu = 4; // le faltan 4 de vida y va a pegar 10
  await game.stand();
  await idle();
  assert.equal(hpOf(game.state, 'human'), TARGET, 'no se pasa del tope');
  assert.equal(game.state.healed.human, 4, 'solo se guarda lo que curó de verdad');
  console.log('  ✓ maceta');
}

// --- huevo: escudo de medio golpe, de un solo uso -----------------------------
{
  const chain = chainOf(
    card(['aquatic', 'bird']),
    card(['aquatic', 'plant'], 'egg'),
    card(['aquatic', 'beast']),
  );
  const game = await atPlayerTurn(chain);
  await game.stand(); // ataque de 10 → huevo de 5
  await idle();
  assert.equal(game.state.status.human.egg, 5, 'huevo de la mitad del golpe');
}
{
  // El huevo se come lo que puede del próximo golpe y deja pasar el resto.
  const chain = chainOf(
    card(['aquatic', 'bird']),
    card(['aquatic', 'plant']),
    card(['aquatic', 'beast']),
  );
  const game = await atPlayerTurn(chain);
  game.state.status.cpu.egg = 4;
  await game.stand(); // 10 de ataque contra 4 de huevo
  await idle();
  assert.equal(game.state.roundScores.human, 10, 'el ataque vale lo mismo igual');
  assert.equal(game.state.totals.human, 6, 'solo entraron 6');
  assert.equal(hpOf(game.state, 'cpu'), TARGET - 6);
  assert.equal(game.state.status.cpu.egg, 0, 'el huevo se rompe');
  assert.equal(game.state.lastHit.blocked, 4, 'el golpe recuerda cuánto le frenaron');
}
{
  // Con más huevo que golpe no entra nada y el huevo sigue puesto, gastado en parte:
  // aguanta hasta terminarse, que es lo que lo hace valer la carta.
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant']));
  const game = await atPlayerTurn(chain);
  game.state.status.cpu.egg = 40;
  await game.stand(); // 5 de ataque contra 40 de huevo
  await idle();
  assert.equal(game.state.totals.human, 0, 'no entró nada');
  assert.equal(hpOf(game.state, 'cpu'), TARGET);
  assert.equal(game.state.status.cpu.egg, 35, 'le quedan 35 para el próximo golpe');
  console.log('  ✓ huevo');
}
{
  // Un ataque de 0 no toca el huevo: se gasta con daño, no con turnos.
  const chain = chainOf(card(['aquatic', 'bird']), card(['bug', 'reptile']));
  const game = await atPlayerTurn(chain);
  assert.ok(chain.busted);
  game.state.status.cpu.egg = 8;
  await game.stand();
  await idle();
  assert.equal(game.state.status.cpu.egg, 8, 'una cadena cortada no le hace nada al huevo');
  console.log('  ✓ huevo (cadena cortada)');
}

// --- cadena cortada: salen los poderes que no se miden contra el daño ---------
{
  // Cuatro poderes en la mano y un ataque de 0: solo la fuerza y el caracol salen.
  const chain = chainOf(
    card(['aquatic', 'bird'], 'strength'),
    card(['aquatic', 'plant'], 'snail'),
    card(['aquatic', 'beast'], 'poison'),
    card(['bug', 'reptile'], 'egg'), // ni bug ni reptile siguen vivos: acá se corta
  );
  const game = await atPlayerTurn(chain);
  assert.ok(chain.busted, 'la cadena quedó cortada');
  assert.ok(chain.bustCard, 'y la carta que la cortó está guardada');
  await game.stand();
  await idle();

  const s = game.state;
  assert.equal(s.roundScores.human, 0, 'una cadena cortada hace 0');
  assert.equal(s.totals.human, 0);
  // La fuerza es la única que no sale del golpe, así que es la única que sobrevive.
  assert.equal(s.status.human.strength, POWER_NUMBERS.strength, 'la fuerza sale igual');
  assert.equal(s.status.cpu.weak, 0, 'el caracol se mide contra el daño: nada');
  assert.equal(s.status.cpu.poison, 0, 'el veneno tampoco');
  assert.equal(s.status.human.egg, 0, 'el huevo tampoco');
  console.log('  ✓ cadena cortada');
}

// --- pulpo: reserva cartas del reparto para que abran la ronda siguiente -------

/**
 * Deja `n` cartas sin poder a la vista en el centro. El centro es sorteado, y una
 * prueba del reparto que dependa de lo que salió sale distinta cada vez.
 */
function seedPlain(game, n) {
  const s = game.state;
  for (let i = 0; i < n; i++) {
    if (!s.market[i].power) continue;
    const at = s.pool.findIndex((c) => !c.power);
    assert.ok(at >= 0, 'quedan cartas sin poder en la reserva');
    s.pool.push(s.market[i]);
    s.market[i] = s.pool.splice(at, 1)[0];
  }
}

/** Lleva la partida hasta el reparto del jugador, que es donde el pulpo se cobra. */
async function atPlayerDraft(chain) {
  const game = await atPlayerTurn(chain);
  await game.stand();
  for (let i = 0; i < 50 && game.state.phase !== 'draft'; i++) await idle();
  assert.equal(game.state.phase, 'draft', 'se abrió el reparto');
  assert.equal(game.drafting(), 'human', 'y le toca al jugador');
  return game;
}

{
  // Un pulpo reserva una carta: la que agarres del centro no se pierde en el
  // barajado, queda esperando arriba del mazo.
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'], 'octopus'));
  const game = await atPlayerDraft(chain);
  assert.equal(game.state.status.human.stacked, 1, 'quedó un pulpo puesto');

  const deck = game.state.decks.human.length;
  const pick = game.pickable().find((c) => c.power) ?? game.pickable()[0];
  await game.takeCard(pick.uid);

  assert.equal(game.state.status.human.stacked, 0, 'el pulpo se gastó');
  assert.deepEqual(game.state.top.human.map((c) => c.uid), [pick.uid], 'quedó reservada');
  assert.equal(game.state.decks.human.length, deck, 'y no entró al mazo todavía');

  // Al arrancar la ronda se apoya encima del mazo barajado: es la próxima en salir.
  for (let i = 0; i < 400 && !['roundEnd', 'matchEnd'].includes(game.state.phase); i++) {
    if (game.state.phase === 'draft' && game.drafting() === 'human') await game.skipDraft();
    else await idle();
  }
  if (game.state.phase === 'roundEnd') {
    await game.nextRound();
    assert.equal(game.state.top.human.length, 0, 'la pila se vació al arrancar la ronda');
    // La promesa del pulpo: esa carta abre la ronda, no la sortea el barajado.
    for (let i = 0; i < 400 && game.state.chains.human.cards.length === 0; i++) await idle();
    assert.equal(game.state.chains.human.cards[0].uid, pick.uid,
      'la ronda abre con la carta reservada');
  }
  console.log('  ✓ pulpo (reserva)');
}

{
  // Dos pulpos reservan dos cartas, y salen en el orden en que se tocaron.
  const chain = chainOf(
    card(['aquatic', 'bird'], 'octopus'),
    card(['aquatic', 'plant'], 'octopus'),
  );
  const game = await atPlayerDraft(chain);
  assert.equal(game.state.status.human.stacked, 2, 'dos pulpos, dos reservas');
  seedPlain(game, 2); // hacen falta dos sin poder: la primera compromete la rama

  const first = game.pickable().find((c) => !c.power);
  await game.takeCard(first.uid);
  assert.equal(game.state.status.human.stacked, 1, 'queda uno');
  const second = game.pickable().find((c) => c.uid !== first.uid);
  await game.takeCard(second.uid);

  assert.deepEqual(game.state.top.human.map((c) => c.uid), [first.uid, second.uid]);
  assert.equal(game.state.status.human.stacked, 0);

  for (let i = 0; i < 400 && !['roundEnd', 'matchEnd'].includes(game.state.phase); i++) {
    if (game.state.phase === 'draft' && game.drafting() === 'human') await game.skipDraft();
    else await idle();
  }
  if (game.state.phase === 'roundEnd') {
    await game.nextRound();
    for (let i = 0; i < 400 && game.state.chains.human.cards.length === 0; i++) await idle();
    assert.equal(game.state.chains.human.cards[0].uid, first.uid,
      'abre con la primera que tocó');
    // Y la que sigue en el mazo es la segunda: se arma el arranque entero.
    if (game.state.turn === 'human' && !game.state.busy) {
      await game.hit();
      const chain = game.state.chains.human;
      const played = chain.bustCard ?? chain.cards[1];
      assert.equal(played.uid, second.uid, 'la segunda sale justo después');
    }
  }
  console.log('  ✓ pulpo (dos, en orden)');
}

{
  // El pulpo no se mide contra el daño: sale igual con la cadena cortada, como la
  // fuerza. Es lo único que las dos comparten.
  const chain = chainOf(
    card(['aquatic', 'bird'], 'octopus'),
    card(['bug', 'reptile'], 'strength'), // ni bug ni reptile viven: acá se corta
  );
  const game = await atPlayerTurn(chain);
  assert.ok(chain.busted);
  await game.stand();
  await idle();
  assert.equal(game.state.roundScores.human, 0, 'el ataque hizo 0');
  assert.equal(game.state.status.human.stacked, 1, 'el pulpo sale igual');
  assert.equal(game.state.status.human.strength, POWER_NUMBERS.strength, 'la fuerza también');
  console.log('  ✓ pulpo (cadena cortada)');
}

console.log('✓ poderes ok');
