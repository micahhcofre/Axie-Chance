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

// --- caracol: el rival pega 2 menos, dos ataques ------------------------------
{
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'], 'snail'));
  const game = await atPlayerTurn(chain);
  await game.stand();
  await idle();

  const st = game.state.status.cpu;
  assert.equal(st.weak, POWER_NUMBERS.snailAttacks, 'quedan dos ataques debilitados');

  // El caracol muerde siempre lo mismo, tenga uno o cinco encima: acumula duración.
  game.state.chains.cpu = chainOf(card(['beast', 'bird']), card(['beast', 'plant']));
  const clean = 5; // beast 2² + bird 1²
  assert.equal(swingOf(game.state, 'cpu'), clean - POWER_NUMBERS.snailBite, 'pega 2 menos');
  game.state.status.cpu.weak += POWER_NUMBERS.snailAttacks;
  assert.equal(swingOf(game.state, 'cpu'), clean - POWER_NUMBERS.snailBite,
    'un segundo caracol dura más, no muerde más');

  // Una cadena cortada hace 0 y ningún modificador la mueve —ni para abajo.
  game.state.chains.cpu = { ...game.state.chains.cpu, busted: true };
  assert.equal(swingOf(game.state, 'cpu'), 0, 'cortada es 0, no menos que 0');
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
  // Con más huevo que golpe no pasa nada… pero el huevo se rompe igual.
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant']));
  const game = await atPlayerTurn(chain);
  game.state.status.cpu.egg = 40;
  await game.stand(); // 5 de ataque contra 40 de huevo
  await idle();
  assert.equal(game.state.totals.human, 0, 'no entró nada');
  assert.equal(hpOf(game.state, 'cpu'), TARGET);
  assert.equal(game.state.status.cpu.egg, 0, 'se rompe aunque le sobrara');
  console.log('  ✓ huevo');
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
  assert.equal(s.status.human.strength, POWER_NUMBERS.strength, 'la fuerza sale igual');
  assert.equal(s.status.cpu.weak, POWER_NUMBERS.snailAttacks, 'el caracol también');
  assert.equal(s.status.cpu.poison, 0, 'el veneno se mide contra el daño: nada');
  assert.equal(s.status.human.egg, 0, 'el huevo también: nada');
  console.log('  ✓ cadena cortada');
}

// --- pulpo: una carta del centro directo a la cadena, a mitad de turno --------

/** Deja `card` como próxima carta a salir del mazo del jugador: `draw` hace `pop`. */
const nextDraw = (game, card) => game.state.decks.human.push(card);

/**
 * Pone en el centro una carta sin poder que lleve `symbol`, para que el pulpo tenga
 * algo que ofrecer. Sin esto el centro es sorteado y la prueba sale distinta cada vez.
 */
function seedGrabbable(game, symbol) {
  const s = game.state;
  const at = s.pool.findIndex((c) => !c.power && c.symbols.includes(symbol));
  assert.ok(at >= 0, 'queda alguna carta sin poder del símbolo en la reserva');
  s.pool.push(s.market[0]);
  s.market[0] = s.pool.splice(at, 1)[0];
}

{
  // El pulpo sale, el centro se abre y el turno queda esperando al jugador.
  const game = await atPlayerTurn(chainOf(card(['aquatic', 'bird'])));
  seedGrabbable(game, 'aquatic');
  nextDraw(game, card(['aquatic', 'plant'], 'octopus'));
  await game.hit();
  await idle();

  assert.equal(game.state.phase, 'grab', 'el centro se abre a mitad de turno');
  assert.equal(game.state.grab.player, 'human');
  assert.equal(game.state.busy, false, 'el jugador puede actuar');

  const options = game.grabOptions();
  assert.ok(options.length > 0, 'con aquatic vivo algo tiene que servir');
  assert.ok(options.every((c) => !c.power), 'el pulpo no encadena poderes');
  assert.ok(options.every((c) => game.state.market.includes(c)), 'salen del centro');
  // Todas las opciones continúan la cadena: colocar una que la corte no es colocar.
  const alive = activeSymbols(game.state.chains.human);
  assert.ok(options.every((c) => c.symbols.some((sym) => alive.includes(sym))),
    'ninguna opción corta la cadena');

  // Colocarla: entra en la cadena, sale del centro y el centro se repone.
  const chosen = options[0];
  const before = game.state.chains.human.cards.length;
  const market = game.state.market.length;
  game.grabCard(chosen.uid);

  assert.equal(game.state.phase, 'turn', 'el turno sigue');
  assert.equal(game.state.chains.human.cards.length, before + 1, 'la carta entró a la cadena');
  assert.equal(game.state.chains.human.cards.at(-1).uid, chosen.uid);
  assert.ok(!game.state.market.includes(chosen), 'salió del centro');
  assert.equal(game.state.market.length, market, 'el centro se repuso');
  assert.ok(!game.state.decks.human.some((c) => c.uid === chosen.uid),
    'todavía no está en el mazo: está en la mesa');

  // Y al cerrar el turno se la queda, como el resto de la cadena.
  await game.stand();
  await idle();
  assert.ok(game.state.decks.human.some((c) => c.uid === chosen.uid),
    'la carta agarrada queda en el mazo');
  console.log('  ✓ pulpo (colocar)');
}

{
  // No colocar es una decisión: el turno sigue igual y la cadena queda intacta.
  const game = await atPlayerTurn(chainOf(card(['aquatic', 'bird'])));
  seedGrabbable(game, 'aquatic');
  nextDraw(game, card(['aquatic', 'plant'], 'octopus'));
  await game.hit();
  await idle();
  assert.equal(game.state.phase, 'grab');

  const cards = game.state.chains.human.cards.length;
  const market = game.state.market.map((c) => c.uid);
  game.skipGrab();

  assert.equal(game.state.phase, 'turn', 'vuelve al turno');
  assert.equal(game.state.chains.human.cards.length, cards, 'la cadena queda igual');
  assert.deepEqual(game.state.market.map((c) => c.uid), market, 'el centro queda igual');
  // Y se puede seguir robando o plantarse, que es el punto de poder pasar.
  await game.hit();
  await idle();
  assert.ok(['turn', 'draft', 'grab'].includes(game.state.phase), 'el turno sigue jugable');
  console.log('  ✓ pulpo (pasar)');
}

{
  // Con las cinco del centro trayendo poder no hay nada que colocar: el pulpo se
  // pierde y el turno no se interrumpe.
  const game = await atPlayerTurn(chainOf(card(['aquatic', 'bird'])));
  const s = game.state;
  for (let i = 0; i < s.market.length; i++) {
    const at = s.pool.findIndex((c) => c.power);
    assert.ok(at >= 0, 'quedan cartas con poder en la reserva');
    s.pool.push(s.market[i]);
    s.market[i] = s.pool.splice(at, 1)[0];
  }
  nextDraw(game, card(['aquatic', 'plant'], 'octopus'));
  await game.hit();
  await idle();
  assert.equal(game.state.phase, 'turn', 'sin nada que colocar el turno no se frena');
  console.log('  ✓ pulpo (centro sin nada)');
}

console.log('✓ poderes ok');
