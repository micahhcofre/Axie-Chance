// Los seis poderes de las cartas del centro, uno por uno.
//
// Cada prueba arma a mano la cadena del jugador —con la carta del poder adentro— y
// suelta el ataque, que es el momento en que todos resuelven. Se mira el estado que
// queda puesto, no el registro: lo que importa es que el próximo golpe cuente bien.
import assert from 'node:assert/strict';
import { createGame, TARGET, TUNING, hpOf, swingOf } from '../src/game.js';
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
  assert.equal(game.state.turn, 'p1', 'arranca el jugador');
  if (chain) game.state.chains.p1 = chain;
  return game;
}

// --- fuerza: +2 en este ataque y en todos los que siguen ----------------------
{
  // Una cadena de dos aquatic vale 2² = 4. La carta de fuerza es el segundo eslabón.
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'], 'strength'));
  const game = await atPlayerTurn(chain);
  assert.equal(scoreChain(chain).total, 4 + 1, 'la cadena vale lo que vale'); // aquatic 2² + bird 1²

  // La fuerza todavía no está puesta: el golpe de este turno la estrena.
  assert.equal(swingOf(game.state, 'p1'), 5, 'antes de soltar, el golpe es la cadena pelada');
  await game.stand();
  await idle();

  const st = game.state.status.p1;
  assert.equal(st.strength, TUNING.strengthStep, 'quedó acumulada');
  assert.equal(game.state.roundScores.p1, 5, 'el ataque que la estrena no la cobra');
  assert.equal(game.state.totals.p1, 5, 'el daño aplicado es el del ataque');

  // La próxima cadena idéntica sí pega 2 más.
  game.state.chains.p1 = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant']));
  assert.equal(swingOf(game.state, 'p1'), 5 + TUNING.strengthStep, 'el golpe siguiente ya suma');

  // Y se acumula: una segunda carta de fuerza suma otros 2.
  game.state.status.p1.strength += TUNING.strengthStep;
  assert.equal(swingOf(game.state, 'p1'), 5 + 2 * TUNING.strengthStep, 'acumulable');
  console.log('  ✓ fuerza');
}

// --- caracol: el próximo ataque del rival sale partido al medio ---------------
{
  // El caracol ya no depende del golpe con que se lo puso: sea una cadena de 10 o de
  // 3, lo que deja puesto es el mismo ataque partido al medio.
  const chain = chainOf(
    card(['aquatic', 'bird']),
    card(['aquatic', 'plant'], 'snail'),
    card(['aquatic', 'beast']),
  );
  const game = await atPlayerTurn(chain);
  assert.equal(scoreChain(chain).total, 10);
  await game.stand();
  await idle();

  const st = game.state.status.p2;
  assert.equal(st.weak, TUNING.snailAttacks, 'un caracol, un ataque debilitado');
  assert.equal(st.weakBite, undefined, 'no queda ningún mordisco guardado');

  const clean = 5; // beast 2² + bird 1²
  game.state.chains.p2 = chainOf(card(['beast', 'bird']), card(['beast', 'plant']));
  assert.equal(swingOf(game.state, 'p2'), 3, 'pega la mitad, redondeando para arriba');

  // La fuerza entra en la cuenta antes de partir: el caracol parte el ataque entero.
  game.state.status.p2.strength = 3;
  assert.equal(swingOf(game.state, 'p2'), Math.ceil((clean + 3) / 2), 'parte todo el golpe');
  game.state.status.p2.strength = 0;

  // Los caracoles se suman por ataques, y no hay nada que pueda bajar de la mitad:
  // dos caracoles son dos ataques a la mitad, no un cuarto.
  game.state.status.p2.weak += TUNING.snailAttacks;
  assert.equal(game.state.status.p2.weak, 2, 'se acumulan por ataques');
  assert.equal(swingOf(game.state, 'p2'), 3, 'pero cada ataque sale a la mitad, no menos');

  // Nunca deja un ataque en cero: una cadena que puntuó siempre pega algo.
  game.state.chains.p2 = chainOf(card(['beast', 'bird']));
  assert.equal(swingOf(game.state, 'p2'), 1, 'una cadena de 2 sale en 1, no en 0');

  // Una cadena cortada hace 0 y ningún modificador la mueve.
  game.state.chains.p2 = { ...game.state.chains.p2, busted: true };
  assert.equal(swingOf(game.state, 'p2'), 0, 'cortada es 0');
  console.log('  ✓ caracol');
}

{
  // Se gasta con un ataque que hizo daño, no con el turno: una cadena cortada no le
  // paga el caracol a nadie. Si se gastara igual, el debilitado se lo sacaría de
  // encima con el turno que ya venía perdido.
  const game = await atPlayerTurn(chainOf(card(['aquatic', 'bird']), card(['bug', 'reptile'])));
  game.state.status.p1.weak = 2;
  assert.ok(game.state.chains.p1.busted, 'la cadena quedó cortada');
  await game.stand();
  await idle();
  assert.equal(game.state.roundScores.p1, 0, 'el ataque hizo 0');
  assert.equal(game.state.status.p1.weak, 2, 'y el caracol sigue entero');

  // Con un ataque que sí sale, se gasta uno.
  const g2 = await atPlayerTurn(chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'])));
  g2.state.status.p1.weak = 2;
  await g2.stand();
  await idle();
  assert.equal(g2.state.roundScores.p1, 3, 'pegó la mitad de 5, redondeando');
  assert.equal(g2.state.status.p1.weak, 1, 'y se gastó un ataque');
  console.log('  ✓ caracol (se gasta con daño)');
}

// --- veneno: la mitad del daño, mordiendo cada ronda y partiéndose al medio ---
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

  assert.equal(game.state.status.p2.poison, 5, 'medio ataque de veneno');
  const before = hpOf(game.state, 'p2');

  // El veneno muerde al cerrar el intercambio y recién después se parte al medio. El
  // cierre pasa solo y sigue de largo, así que la foto se saca en el repintado.
  let closed = null;
  game.subscribe((s) => {
    if (closed || (s.phase !== 'roundEnd' && s.phase !== 'matchEnd')) return;
    closed = { hp: hpOf(s, 'p2'), poison: s.status.p2.poison };
  });
  for (let i = 0; i < 800 && !closed; i++) {
    if (game.state.phase === 'draft' && game.drafting() === 'p1') await game.skipDraft();
    else await idle();
  }
  assert.ok(closed, 'el intercambio cerró');
  assert.equal(closed.hp, before - 5, 'mordió por 5');
  // 5 se parte en 2, y 2 es el piso: mordió con todo y se fue en la misma ronda.
  assert.equal(closed.poison, 0, 'y después se fue: la mitad de 5 no pasa el piso');
  console.log('  ✓ veneno');
}

{
  // La cola del veneno, sin partida de por medio: muerde entero, se parte al medio y
  // se va cuando la mitad ya no alcanza el piso. Un veneno de 20 dura tres mordiscos
  // —20, 10, 5— y en el cuarto ya no está, en vez de arrastrar diez rondas de a 2.
  const bites = [];
  let left = 20;
  while (left > 0) {
    bites.push(left);
    const half = Math.floor(left / TUNING.poisonHalve);
    left = half <= TUNING.poisonFloor ? 0 : half;
    assert.ok(bites.length < 20, 'el veneno termina');
  }
  assert.deepEqual(bites, [20, 10, 5], 'tres mordiscos y se va');
  console.log('  ✓ veneno (se parte al medio y se va)');
}

// --- maceta: te curás lo que pegaste, sin pasarte de la vida inicial ----------
{
  // Entero no hay nada que curar: la maceta no sirve para pasarse de 100.
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'], 'pot'));
  const game = await atPlayerTurn(chain);
  await game.stand();
  await idle();
  assert.equal(hpOf(game.state, 'p1'), TARGET, 'la cura no pasa de la vida inicial');
  assert.equal(game.state.healed.p1, 0, 'no se guarda curación desperdiciada');
}
{
  // Lastimado sí cura, y exactamente lo que pegó.
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'], 'pot'));
  const game = await atPlayerTurn(chain);
  game.state.totals.p2 = 40;
  assert.equal(hpOf(game.state, 'p1'), 60);
  await game.stand();
  await idle();
  assert.equal(hpOf(game.state, 'p1'), 65, 'se curó los 5 que pegó');
  assert.equal(game.state.healed.p1, 5);
}
{
  // Y cura solo hasta el tope, aunque pegue mucho más de lo que le falta.
  const chain = chainOf(
    card(['aquatic', 'bird']),
    card(['aquatic', 'plant'], 'pot'),
    card(['aquatic', 'beast']),
  );
  const game = await atPlayerTurn(chain);
  game.state.totals.p2 = 4; // le faltan 4 de vida y va a pegar 10
  await game.stand();
  await idle();
  assert.equal(hpOf(game.state, 'p1'), TARGET, 'no se pasa del tope');
  assert.equal(game.state.healed.p1, 4, 'solo se guarda lo que curó de verdad');
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
  assert.equal(game.state.status.p1.egg, 5, 'huevo de la mitad del golpe');
}
{
  // El huevo se come lo que puede del próximo golpe y deja pasar el resto.
  const chain = chainOf(
    card(['aquatic', 'bird']),
    card(['aquatic', 'plant']),
    card(['aquatic', 'beast']),
  );
  const game = await atPlayerTurn(chain);
  // Los golpes se anotan a medida que salen: `lastHit` es un pulso y se pisa. Con la
  // cáscara encendida son dos —el ataque y la respuesta— y el segundo tapa al primero.
  const hits = [];
  game.subscribe((s) => {
    if (s.lastHit && s.lastHit.id !== hits.at(-1)?.id) hits.push({ ...s.lastHit });
  });
  game.state.status.p2.egg = 4;
  await game.stand(); // 10 de ataque contra 4 de huevo
  await idle();
  assert.equal(game.state.roundScores.p1, 10, 'el ataque vale lo mismo igual');
  assert.equal(game.state.totals.p1, 6, 'solo entraron 6');
  assert.equal(hpOf(game.state, 'p2'), TARGET - 6);
  assert.equal(game.state.status.p2.egg, 0, 'el huevo se rompe');
  const golpe = hits.find((h) => h.by === 'p1');
  assert.equal(golpe.blocked, 4, 'el golpe recuerda cuánto le frenaron');
  assert.equal(golpe.amount, 6, 'y cuánto entró');
}
{
  // Con más huevo que golpe no entra nada y el huevo sigue puesto, gastado en parte:
  // aguanta hasta terminarse, que es lo que lo hace valer la carta.
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant']));
  const game = await atPlayerTurn(chain);
  game.state.status.p2.egg = 40;
  await game.stand(); // 5 de ataque contra 40 de huevo
  await idle();
  assert.equal(game.state.totals.p1, 0, 'no entró nada');
  assert.equal(hpOf(game.state, 'p2'), TARGET);
  assert.equal(game.state.status.p2.egg, 35, 'le quedan 35 para el próximo golpe');
  console.log('  ✓ huevo');
}
{
  // La cáscara: cuando el huevo se gasta del todo, le vuelve un número fijo al que lo
  // rompió. Fijo y no una fracción del golpe — romper un huevo cuesta siempre lo
  // mismo, se rompa con un golpe de 10 o con uno de 40.
  const chain = chainOf(
    card(['aquatic', 'bird']),
    card(['aquatic', 'plant']),
    card(['aquatic', 'beast']),
  );
  const game = await atPlayerTurn(chain);
  game.state.status.p2.egg = 4;
  await game.stand(); // 10 de ataque contra 4 de huevo: lo rompe
  await idle();
  assert.equal(game.state.status.p2.egg, 0, 'el huevo se rompió');
  assert.equal(game.state.totals.p1, 6, 'pasaron 6, como sin cáscara');
  assert.equal(game.state.totals.p2, TUNING.eggBreak, 'y le volvieron 5 al que pegó');
  assert.equal(hpOf(game.state, 'p1'), TARGET - TUNING.eggBreak, 'la cáscara le sacó vida');
  // Y sale como golpe propio, en sentido contrario, para que se vea en pantalla.
  const back = game.state.lastHit;
  assert.equal(back.kind, 'thorns');
  assert.equal(back.by, 'p2', 'lo devuelve el dueño del huevo');
  assert.equal(back.target, 'p1', 'contra el que pegó');
  assert.equal(back.amount, TUNING.eggBreak);

  // Un huevo que aguanta no corta: solo devuelve el que se rompe. Y el golpe avisa que
  // no lo rompió, que es lo que la pantalla mira para no cantar una cáscara de más.
  const g2 = await atPlayerTurn(chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'])));
  g2.state.status.p2.egg = 40;
  await g2.stand();
  await idle();
  assert.equal(g2.state.status.p2.egg, 35, 'el huevo sigue puesto');
  assert.equal(g2.state.totals.p2, 0, 'y no devolvió nada');
  assert.equal(g2.state.lastHit.blocked, 5, 'el golpe entero se lo comió el huevo');
  assert.equal(g2.state.lastHit.broke, false, 'y el golpe sabe que no lo rompió');
  console.log('  ✓ huevo (cáscara)');
}
{
  // Un ataque de 0 no toca el huevo: se gasta con daño, no con turnos.
  const chain = chainOf(card(['aquatic', 'bird']), card(['bug', 'reptile']));
  const game = await atPlayerTurn(chain);
  assert.ok(chain.busted);
  game.state.status.p2.egg = 8;
  await game.stand();
  await idle();
  assert.equal(game.state.status.p2.egg, 8, 'una cadena cortada no le hace nada al huevo');
  console.log('  ✓ huevo (cadena cortada)');
}

// --- cadena cortada: no sale ningún poder ------------------------------------
{
  // Cuatro poderes en la mano y un ataque de 0: no sale ninguno. Ni la fuerza, que
  // era la que cobraba igual.
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
  assert.equal(s.roundScores.p1, 0, 'una cadena cortada hace 0');
  assert.equal(s.totals.p1, 0);
  // La fuerza tampoco: sin ataque no hay nada que afilar.
  assert.equal(s.status.p1.strength, 0, 'la fuerza no sale de un ataque en cero');
  assert.equal(s.status.p2.weak, 0, 'el caracol se mide contra el daño: nada');
  assert.equal(s.status.p2.poison, 0, 'el veneno tampoco');
  assert.equal(s.status.p1.egg, 0, 'el huevo tampoco');
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
  assert.equal(game.drafting(), 'p1', 'y le toca al jugador');
  return game;
}

{
  // Un pulpo paga una carta **aparte** del reparto: no es la que elegiste, es una de
  // más. Acá el jugador rechaza el reparto entero y aun así se lleva una carta, que es
  // la prueba de que la etapa del pulpo es independiente.
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'], 'octopus'));
  const game = await atPlayerDraft(chain);
  assert.equal(game.state.status.p1.stacked, 1, 'quedó un pulpo puesto');

  const deck = game.state.decks.p1.length;
  await game.skipDraft(); // no se lleva nada del reparto normal
  assert.equal(game.state.draft.step, 'bonus', 'se abre la etapa del pulpo');
  assert.equal(game.state.decks.p1.length, deck, 'y el reparto no dejó nada');

  // Y ahí sirve el centro entero: la carta del pulpo puede llevar poder.
  assert.deepEqual(
    game.pickable().map((c) => c.uid).sort(),
    game.state.market.map((c) => c.uid).sort(),
    'sin reglas de reparto: sirve cualquier carta',
  );

  const pick = game.pickable().find((c) => c.power) ?? game.pickable()[0];
  await game.takeCard(pick.uid);

  assert.equal(game.state.status.p1.stacked, 0, 'el pulpo se gastó');
  assert.deepEqual(game.state.top.p1.map((c) => c.uid), [pick.uid], 'quedó reservada');
  assert.equal(game.state.decks.p1.length, deck, 'y no entró al mazo todavía');

  // Al arrancar la ronda se apoya encima del mazo barajado: es la próxima en salir.
  // La ronda siguiente arranca sola, así que se espera a que cambie el número.
  const round = game.state.round;
  for (let i = 0; i < 800 && game.state.round === round && game.state.phase !== 'matchEnd'; i++) {
    if (game.state.phase === 'draft' && game.drafting() === 'p1') await game.skipDraft();
    else await idle();
  }
  if (game.state.round > round) {
    assert.equal(game.state.top.p1.length, 0, 'la pila se vació al arrancar la ronda');
    // La promesa del pulpo: esa carta abre la ronda, no la sortea el barajado.
    for (let i = 0; i < 400 && game.state.chains.p1.cards.length === 0; i++) await idle();
    assert.equal(game.state.chains.p1.cards[0].uid, pick.uid,
      'la ronda abre con la carta reservada');
  }
  console.log('  ✓ pulpo (carta extra)');
}

{
  // La carta del pulpo es de más, no en lugar de: el jugador hace su reparto normal
  // —una carta con poder, que lo cierra— y **después** cobra la del pulpo.
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'], 'octopus'));
  const game = await atPlayerDraft(chain);
  const deck = game.state.decks.p1.length;

  const powered = game.pickable().find((c) => c.power);
  if (powered) {
    await game.takeCard(powered.uid);
    assert.equal(game.state.decks.p1.length, deck + 1, 'la del reparto va al mazo');
    assert.deepEqual(game.state.top.p1, [], 'y no se reservó');
    assert.equal(game.state.draft.step, 'bonus', 'recién ahora se abre la del pulpo');

    const extra = game.pickable()[0];
    await game.takeCard(extra.uid);
    assert.equal(game.state.decks.p1.length, deck + 1, 'la del pulpo no va al mazo');
    assert.deepEqual(game.state.top.p1.map((c) => c.uid), [extra.uid], 'va arriba');
  }
  console.log('  ✓ pulpo (es de más, no en lugar de)');
}

{
  // Dos pulpos pagan dos cartas, y salen en el orden en que se tocaron.
  const chain = chainOf(
    card(['aquatic', 'bird'], 'octopus'),
    card(['aquatic', 'plant'], 'octopus'),
  );
  const game = await atPlayerDraft(chain);
  assert.equal(game.state.status.p1.stacked, 2, 'dos pulpos, dos cartas');

  await game.skipDraft();
  assert.equal(game.state.draft.step, 'bonus');

  const first = game.pickable()[0];
  await game.takeCard(first.uid);
  assert.equal(game.state.status.p1.stacked, 1, 'queda uno');
  assert.equal(game.state.draft.step, 'bonus', 'sigue debiendo una');
  const second = game.pickable().find((c) => c.uid !== first.uid);
  await game.takeCard(second.uid);

  assert.deepEqual(game.state.top.p1.map((c) => c.uid), [first.uid, second.uid]);
  assert.equal(game.state.status.p1.stacked, 0);

  const round = game.state.round;
  for (let i = 0; i < 800 && game.state.round === round && game.state.phase !== 'matchEnd'; i++) {
    if (game.state.phase === 'draft' && game.drafting() === 'p1') await game.skipDraft();
    else await idle();
  }
  if (game.state.round > round) {
    for (let i = 0; i < 400 && game.state.chains.p1.cards.length === 0; i++) await idle();
    assert.equal(game.state.chains.p1.cards[0].uid, first.uid,
      'abre con la primera que tocó');
    // Y la que sigue en el mazo es la segunda: se arma el arranque entero.
    if (game.state.turn === 'p1' && !game.state.busy) {
      await game.hit();
      const chain = game.state.chains.p1;
      const played = chain.bustCard ?? chain.cards[1];
      assert.equal(played.uid, second.uid, 'la segunda sale justo después');
    }
  }
  console.log('  ✓ pulpo (dos, en orden)');
}

{
  // Rechazar la carta del pulpo la gasta. Si no, un pulpo sin usar se arrastraría de
  // ronda en ronda para siempre.
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'], 'octopus'));
  const game = await atPlayerDraft(chain);
  await game.skipDraft();
  assert.equal(game.state.draft.step, 'bonus');
  await game.skipDraft();
  assert.equal(game.state.status.p1.stacked, 0, 'la reserva se consumió igual');
  assert.deepEqual(game.state.top.p1, [], 'y no se llevó nada');
  console.log('  ✓ pulpo (rechazar la gasta)');
}

{
  // Con la cadena cortada no cobra nadie: ni el pulpo, que pide haberse plantado, ni
  // la fuerza, que se mide contra el daño como todo el resto.
  const chain = chainOf(
    card(['aquatic', 'bird'], 'octopus'),
    card(['bug', 'reptile'], 'strength'), // ni bug ni reptile viven: acá se corta
  );
  const game = await atPlayerTurn(chain);
  assert.ok(chain.busted);
  await game.stand();
  await idle();
  assert.equal(game.state.roundScores.p1, 0, 'el ataque hizo 0');
  assert.equal(game.state.status.p1.stacked, 0, 'el pulpo se fue con la cadena');
  assert.equal(game.state.status.p1.strength, 0, 'y la fuerza también');
  console.log('  ✓ pulpo (cadena cortada: no cobra)');
}

{
  // Pero se mide contra la cadena, no contra el daño. Con el caracol de antes eso se
  // veía: dejaba ataques enteros en 0 y el pulpo cobraba igual. El de ahora parte al
  // medio y redondea para arriba, así que un ataque hundido a 0 por el rival ya no
  // existe — lo que se puede comprobar es lo otro, que el pulpo cobra entero aunque
  // el golpe con que se plantó haya salido a la mitad.
  const chain = chainOf(card(['aquatic', 'bird'], 'octopus'));
  const game = await atPlayerTurn(chain);
  assert.ok(!chain.busted, 'la cadena está entera');
  game.state.status.p1.weak = 2;
  assert.equal(swingOf(game.state, 'p1'), 1, 'se planta y pega la mitad de 2');

  await game.stand();
  await idle();
  assert.equal(game.state.status.p1.stacked, 1, 'el pulpo cobra entero igual');
  console.log('  ✓ pulpo (plantado y debilitado: cobra)');
}

console.log('✓ poderes ok');
