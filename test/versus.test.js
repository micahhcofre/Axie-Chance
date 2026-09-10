// El modo con los dos asientos jugados por personas: el de las salas (`mode: 'net'`).
//
// Se prueba contra la partida sola, sin servidor ni cable de por medio, porque es acá
// donde vive lo único que ese modo cambia: que el segundo asiento **deje de jugarse
// solo**. Contra la CPU, `p2` roba, se planta y se lleva cartas por su cuenta; acá
// tiene que quedarse quieto esperando que alguien apriete, y las mismas funciones que
// mueven a `p1` tienen que moverlo a él. Lo que pasa arriba —quién puede pedir qué
// desde qué aparato— es de `net.test.js`.
//
// (Este archivo se llamaba `local.test.js`: probaba el modo de dos personas en el
// mismo teclado, que se fue. El modo de dos humanos sobrevive, y es este.)
import assert from 'node:assert/strict';
import {
  FORFEIT_ROUNDS, createGame, forfeitWinner, hpOf, matchResult, seatVoice,
} from '../src/game.js';

const idle = () => new Promise((r) => setTimeout(r, 0));
/** Deja correr las corrutinas del juego —los cierres de ronda arrancan solos—. */
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await idle(); };

// ---- el segundo asiento no se juega solo -----------------------------------
{
  const game = createGame({ pace: 0, seed: 11 });
  game.newMatch({ mode: 'net', axie: 'aquatic', axie2: 'plant' });
  await settle();

  const s = game.state;
  assert.equal(s.mode, 'net');
  assert.equal(s.axies.p1, 'aquatic', 'el primer asiento juega el Axie que se pidió');
  assert.equal(s.axies.p2, 'plant', 'y el segundo también, que contra la CPU se sortea');
  assert.equal(s.symbols.p2, 'plant');
  assert.equal(seatVoice(s, 'p2').name, 'Jugador 2', 'los dos se nombran desde afuera');

  // Quién abre se sorteó al empezar: el test no lo da por sentado, lo lee.
  const [first, second] = s.order;
  assert.equal(game.acting(), first, 'la pantalla sabe a quién darle los botones');
  await game.stand();
  await settle();

  // Su reparto es suyo: el centro espera a que elija, no elige nadie por él.
  assert.equal(game.state.phase, 'draft');
  assert.equal(game.drafter(), first);
  await game.skipDraft();
  await settle();

  // Y ahora el segundo. Acá es donde se ve la diferencia: contra la CPU este turno se
  // resolvería solo en unos cuantos `tick`.
  assert.equal(game.state.turn, second, 'contesta el segundo asiento');
  assert.equal(game.acting(), second, 'y lo juega la persona de ese asiento');
  const cards = game.state.chains[second].cards.length;
  await settle(20);
  assert.equal(game.state.turn, second, 'el turno no avanza solo');
  assert.equal(game.state.chains[second].cards.length, cards, 'y no roba solo');

  // Los mismos botones lo mueven.
  await game.hit();
  const now = game.state.chains[second];
  assert.equal(now.cards.length + (now.bustCard ? 1 : 0), cards + 1,
    'robar mueve al asiento del turno, sea cual sea');
  console.log('  ✓ el segundo asiento espera a su persona');
}

// ---- quién abre se sortea ---------------------------------------------------
// Cerrar el intercambio es una ventaja —ves el golpe del otro antes de decidir el
// tuyo— y entre dos personas no hay ningún lado que la merezca. Contra la CPU sigue
// siendo fija a propósito: es el lado que no la necesita, y con ese orden se midió
// todo el balance de los poderes.
{
  const opens = { p1: 0, p2: 0 };
  for (let seed = 0; seed < 60; seed++) {
    const game = createGame({ pace: 0, seed });
    game.newMatch({ mode: 'net', axie: 'aquatic', axie2: 'plant' });
    opens[game.state.order[0]]++;
  }
  assert.ok(opens.p1 > 5 && opens.p2 > 5, `los dos abren alguna vez (${opens.p1}/${opens.p2})`);

  const vsCpu = createGame({ pace: 0, seed: 1 });
  vsCpu.newMatch({ mode: 'cpu', axie: 'aquatic' });
  assert.deepEqual(vsCpu.state.order, ['p1', 'p2'], 'contra la CPU el orden no se toca');
  console.log(`  ✓ el que abre se sortea (${opens.p1} y ${opens.p2} de 60)`);
}

// ---- una partida entera jugada de los dos lados -----------------------------
{
  const game = createGame({ pace: 0, seed: 5 });
  game.newMatch({ mode: 'net', axie: 'bird', axie2: 'bug' });
  await settle();

  // Los dos juegan igual de tímido: se plantan con dos cartas. Lo que importa no es
  // la estrategia sino que la partida llegue al final movida solo desde afuera.
  const drafted = new Set();
  let guard = 0;
  while (game.state.phase !== 'matchEnd' && guard++ < 2000) {
    const s = game.state;
    if (s.phase === 'turn' && game.acting()) {
      const p = game.acting();
      if (s.chains[p].cards.length < 2 && !s.chains[p].busted) await game.hit();
      else await game.stand();
    } else if (s.phase === 'draft' && game.drafter()) {
      const p = game.drafter();
      drafted.add(p);
      const card = game.pickable()[0];
      if (card) await game.takeCard(card.uid);
      else await game.skipDraft();
    } else {
      await idle();
    }
  }

  assert.equal(game.state.phase, 'matchEnd', `la partida terminó (${guard} vueltas)`);
  assert.deepEqual([...drafted].sort(), ['p1', 'p2'], 'los dos eligieron del centro');
  const r = matchResult(game.state);
  assert.ok(['p1', 'p2', 'tie'].includes(r));
  if (r !== 'tie') assert.ok(hpOf(game.state, r) > 0, 'el que gana queda con vida');
  console.log(`  ✓ partida completa a dos manos (gana ${r}, ${game.state.round} rondas)`);
}

// ---- contra la CPU el segundo asiento sigue siendo suyo ---------------------
{
  const game = createGame({ pace: 0, seed: 3 });
  // El puntaje de la ronda se borra al arrancar la siguiente, así que mirarlo al final
  // no dice nada: se anota mientras pasa.
  let cpuSwung = false;
  game.subscribe((s) => { if (s?.roundScores.p2 !== null) cpuSwung = true; });
  game.newMatch({ mode: 'cpu', axie: 'aquatic' });
  await settle();
  assert.equal(game.state.mode, 'cpu');
  assert.equal(game.acting(), 'p1');
  await game.stand();
  await settle();
  await game.skipDraft();
  // El turno de la CPU corre solo y no hay botones que ofrecerle a nadie: apenas
  // empieza, `acting()` no devuelve a nadie.
  assert.equal(game.acting(), null, 'a la CPU no se le aprietan botones');
  await settle(40);
  assert.ok(cpuSwung, 'la CPU cerró su turno sola');
  console.log('  ✓ contra la CPU el segundo asiento se juega solo');
}

// ---- abandonar: anulada al principio, perdida después -----------------------
// Irse en las primeras rondas no le da nada a nadie —ni es empate: la partida no
// cuenta—. Pasadas las cinco, gana el que se quedó.
{
  const at = (phase, round) => ({ phase, round });
  assert.equal(FORFEIT_ROUNDS, 5);
  assert.equal(forfeitWinner(at('turn', 1), 'p1'), null, 'en la primera ronda, nadie');
  assert.equal(forfeitWinner(at('draft', 5), 'p1'), null, 'con la quinta a medio jugar, nadie');
  assert.equal(forfeitWinner(at('roundEnd', 5), 'p1'), 'p2', 'con la quinta cerrada, el otro');
  assert.equal(forfeitWinner(at('turn', 6), 'p2'), 'p1', 'y de ahí en adelante también');

  const early = createGame({ pace: 0, seed: 5 });
  early.newMatch({ mode: 'net', axie: 'bird', axie2: 'bug' });
  await settle();
  early.forfeit('p1');
  assert.equal(early.state.phase, 'matchEnd', 'irse cierra la partida en el acto');
  assert.equal(matchResult(early.state), 'void', 'en la primera ronda se anula');
  assert.equal(early.state.clock, null, 'y el reloj se apaga');
  await settle(20);
  assert.equal(early.state.round, 1, 'la ronda que estaba corriendo no sigue sola');
  early.forfeit('p2');
  assert.equal(early.state.forfeit.by, 'p1', 'terminada, ya no hay nada que abandonar');

  // Pasadas las cinco rondas, jugadas de verdad y no inventadas.
  const late = createGame({ pace: 0, seed: 5 });
  late.newMatch({ mode: 'net', axie: 'bird', axie2: 'bug' });
  await settle();
  let guard = 0;
  while (late.state.round <= FORFEIT_ROUNDS && late.state.phase !== 'matchEnd' && guard++ < 2000) {
    const s = late.state;
    if (s.phase === 'turn' && late.acting()) {
      const p = late.acting();
      if (s.chains[p].cards.length < 2 && !s.chains[p].busted) await late.hit();
      else await late.stand();
    } else if (s.phase === 'draft' && late.drafter()) {
      await late.skipDraft();
    } else {
      await idle();
    }
  }
  assert.equal(late.state.round, FORFEIT_ROUNDS + 1, 'se llegó a la sexta ronda con los dos vivos');
  late.forfeit('p2');
  assert.equal(matchResult(late.state), 'p1', 'pasadas las cinco, gana el que se quedó');
  console.log('  ✓ abandonar: anulada en las primeras 5 rondas, perdida después');
}

console.log('✓ los dos asientos de una sala ok');
