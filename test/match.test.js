// Smoke test del flujo completo: rondas, reparto de la reserva y final a 100 puntos.
import assert from 'node:assert/strict';
import { createGame, TARGET, PLAYERS, MARKET_SIZE, onTable } from '../src/game.js';
import { scoreChain } from '../src/rules.js';

const idle = () => new Promise((r) => setTimeout(r, 0));
const other = (p) => (p === 'human' ? 'cpu' : 'human');
// Todo lo que tiene un jugador: su mazo más lo que sigue en la mesa sin devolver.
const owned = (s, p) => s.decks[p].length + onTable(s, p);


for (const difficulty of ['facil', 'normal', 'duro']) {
  const game = createGame({ pace: 0 });
  const openers = [];
  const gains = [];
  game.newMatch({ difficulty, axie: 'aquatic' });
  assert.equal(game.state.axies.human, 'aquatic');
  assert.equal(game.state.symbols.human, 'aquatic', 'la clase del Axie es su símbolo');
  assert.notEqual(game.state.symbols.cpu, 'aquatic', 'la CPU juega otra clase');
  assert.equal(game.state.market.length, MARKET_SIZE, 'el centro arranca con 5');
  assert.equal(game.state.pool.length, 35 - MARKET_SIZE);

  // Qué terminó llevándose el humano en cada draft. Ya no se elige un modo aparte:
  // lo decide el tamaño de la carta que toca, así que se alterna qué carta tocar.
  let humanMode = 'trio';
  let guard = 0;

  // Ahora reparte un solo jugador por vez, apenas termina su turno, y el turno de la
  // CPU entero puede correr dentro de un solo `await` del bucle: entre dos vueltas se
  // pierden estados intermedios. Por eso cada reparto se mide en el subscriber —foto
  // al entrar en la fase, balance al salir— y el bucle solo revisa lo que quedó.
  let before = null;
  const drafts = [];
  game.subscribe((s) => {
    if (s.phase === 'draft' && !before) {
      before = {
        player: s.draft.order[0],
        human: owned(s, 'human'),
        cpu: owned(s, 'cpu'),
        pool: s.pool.length + s.market.length,
      };
    } else if (s.phase !== 'draft' && before) {
      const p = before.player;
      drafts.push({
        player: p,
        gain: owned(s, p) - before[p],
        otherGain: owned(s, other(p)) - before[other(p)],
        pool: before.pool,
        poolAfter: s.pool.length + s.market.length,
        busted: s.chains[p].busted,
      });
      before = null;
    }
  });

  while (game.state.phase !== 'matchEnd') {
    assert.ok(guard++ < 4000, 'la partida no termina');
    const s = game.state;

    // Invariante: 35 comunes + 10 de cada mazo base, nunca se pierde ni se duplica nada.
    assert.equal(
      s.pool.length + s.market.length + owned(s, 'human') + owned(s, 'cpu'),
      55,
      'cartas totales en juego',
    );
    // El centro está siempre lleno mientras quede reserva para reponer.
    assert.equal(
      s.market.length,
      Math.min(MARKET_SIZE, s.market.length + s.pool.length),
      'el centro se repone en el acto',
    );

    if (s.phase === 'draft') {
      const picking = game.drafting();
      if (picking === 'cpu') { await idle(); continue; }
      const options = game.pickable();
      assert.ok(options.length > 0, 'mientras haya centro siempre hay algo elegible');
      assert.ok(options.length <= MARKET_SIZE, 'se elige solo entre las cartas del centro');
      assert.ok(options.every((c) => s.market.includes(c)), 'las opciones salen del centro');
      if (s.draft.mode) {
        // Segunda carta del par (o el par único de una cadena cortada).
        await game.takeCard(options[0].uid);
        continue;
      }
      // Los dos pares solo se registran con reserva de sobra, y la reserva se vacía
      // hacia el final: se van primero hasta cubrirlos y recién ahí se alterna.
      const want = (!gains.includes(2) ? 'pair' : humanMode === 'trio' ? 'pair' : 'trio');
      const card = options.find((c) => c.symbols.length === (want === 'trio' ? 3 : 2))
        ?? options[0];
      // Espejo de la inferencia del juego: sin pares en el centro, cualquier carta
      // paga el premio de dos pares y el trío queda descartado.
      const hasPairs = s.market.some((c) => c.symbols.length === 2);
      humanMode = card.symbols.length === 3 && hasPairs ? 'trio' : 'pair';
      await game.takeCard(card.uid);
      continue;
    }

    while (drafts.length) {
      const d = drafts.shift();
      // El que no repartió no toca su mazo: cada uno se lleva lo suyo en su turno.
      assert.equal(d.otherGain, 0, `${other(d.player)} sumó en el reparto ajeno`);
      // Con reserva de sobra el reparto es exacto: cortarse da 1 par, plantarse 1 trío
      // o 2 pares. Cuando quedan menos de 4 cartas, se lleva lo que haya.
      if (d.pool >= 4) {
        if (d.busted) assert.equal(d.gain, 1, `${d.player} se cortó: 1 par`);
        else assert.ok(d.gain === 1 || d.gain === 2, `${d.player} se plantó y sumó ${d.gain}`);
        if (d.player === 'human') {
          if (!d.busted) {
            assert.equal(d.gain, humanMode === 'trio' ? 1 : 2, 'el jugador recibe lo que eligió');
          }
          gains.push(d.gain);
        }
      } else {
        assert.ok(d.gain >= 0 && d.gain <= 2, `${d.player} sumó ${d.gain} con ${d.pool} de reserva`);
        assert.ok(d.poolAfter <= d.pool, 'la reserva nunca crece');
      }
    }

    if (s.phase === 'roundEnd') {
      openers.push(s.order[0]);
      await game.nextRound();
    } else if (s.turn === 'human' && !s.busy) {
      // En las rondas pares se planta con la primera carta. Robar hasta 6 se corta el
      // ~65% de las veces, y una racha de cortes deja el reparto de quien se planta
      // (1 trío o 2 pares) sin probar: plantarse seguro cada dos rondas lo garantiza.
      if (s.round % 2 === 0 || scoreChain(s.chains.human).total >= 6) await game.stand();
      else await game.hit();
    } else {
      await idle();
    }
  }

  const s = game.state;
  assert.ok(Math.max(s.totals.human, s.totals.cpu) >= TARGET, 'alguien llegó a la meta');
  assert.ok(s.roundScores.human !== null && s.roundScores.cpu !== null, 'los dos jugaron la ronda');
  assert.deepEqual(
    openers,
    openers.map((_, i) => (i % 2 === 0 ? 'human' : 'cpu')),
    'se alterna quién abre',
  );
  assert.ok(gains.includes(1) && gains.includes(2), 'se probaron trío y par');
  assert.equal(s.pool.length + s.market.length + owned(s, 'human') + owned(s, 'cpu'), 55);
  console.log(
    `  ${difficulty.padEnd(6)} ${s.totals.human} — ${s.totals.cpu} en ${s.round} rondas` +
      ` · mazos ${owned(s, 'human')}/${owned(s, 'cpu')}` +
      ` · quedan ${s.pool.length + s.market.length}`,
  );
}

// La época corta los turnos viejos: reiniciar durante el turno de la CPU no ensucia el estado.
{
  const game = createGame({ pace: 1 });
  game.newMatch({ difficulty: 'normal', axie: 'bird' });
  game.newMatch({ difficulty: 'duro', axie: 'bug' });
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(game.state.difficulty, 'duro');
  assert.equal(game.state.symbols.human, 'bug');
  assert.equal(game.state.round, 1);
  assert.equal(game.state.totals.human, 0);
  assert.equal(game.state.market.length, MARKET_SIZE, 'el centro arranca con 5');
  assert.equal(game.state.pool.length, 35 - MARKET_SIZE);
}

// No hay descarte: cada ronda arranca con todas las cartas propias barajadas de nuevo.
{
  const game = createGame({ pace: 0 });
  game.newMatch({ difficulty: 'normal', axie: 'plant' });
  let guard = 0;
  while (game.state.phase !== 'roundEnd') {
    assert.ok(guard++ < 4000, 'la ronda no cierra');
    const s = game.state;
    if (s.phase === 'draft') {
      if (game.drafting() !== 'human') { await idle(); continue; }
      await game.takeCard(game.pickable()[0].uid);
      continue;
    }
    if (s.turn === 'human' && !s.busy) await game.stand();
    else await idle();
  }

  // Cerrada la ronda no queda nada afuera: mazo = todo lo que el jugador posee.
  const played = game.state.chains.human.cards.map((c) => c.uid);
  assert.ok(played.length > 0, 'el jugador jugó al menos una carta');
  const before = game.state.decks.human.map((c) => c.uid);
  assert.ok(played.every((uid) => before.includes(uid)), 'lo jugado vuelve al mazo');
  assert.equal(new Set(before).size, before.length, 'sin cartas duplicadas');

  await game.nextRound();
  const after = game.state.decks.human.map((c) => c.uid).concat(
    game.state.chains.human.cards.map((c) => c.uid),
  );
  assert.deepEqual(new Set(after), new Set(before), 'la ronda nueva reparte el mazo entero');
}

// El centro se renueva una vez cuando nada de lo que podés agarrar lleva tu símbolo.
{
  const game = createGame({ pace: 0 });
  game.newMatch({ difficulty: 'normal', axie: 'plant' });
  let guard = 0;
  while (!(game.state.phase === 'draft' && game.drafting() === 'human')) {
    assert.ok(guard++ < 4000, 'no se llegó al reparto del jugador');
    const s = game.state;
    if (s.phase === 'draft' || s.busy || s.turn !== 'human') await idle();
    else await game.stand();
  }

  const s = game.state;
  // Se fuerza un centro sin plant, cambiando por reserva las cartas que lo llevan.
  for (let i = 0; i < s.market.length; i++) {
    if (!s.market[i].symbols.includes('plant')) continue;
    const at = s.pool.findIndex((c) => !c.symbols.includes('plant'));
    assert.ok(at >= 0, 'queda algo sin plant en la reserva');
    const [swap] = s.pool.splice(at, 1);
    s.pool.push(s.market[i]);
    s.market[i] = swap;
  }
  const total = s.pool.length + s.market.length;
  const before = s.market.map((c) => c.uid);

  assert.ok(game.canRenew('human'), 'sin nada del símbolo propio se puede renovar');
  game.renewMarket();
  assert.equal(s.market.length, MARKET_SIZE, 'el centro vuelve a estar lleno');
  assert.equal(s.pool.length + s.market.length, total, 'la reserva no pierde ni gana cartas');
  assert.notDeepEqual(s.market.map((c) => c.uid), before, 'salieron cartas nuevas');
  assert.ok(s.draft.renewed.human, 'queda marcado que ya renovó');
  assert.ok(!game.canRenew('human'), 'se renueva una sola vez por reparto');

  // Con una carta propia a la vista no hay renovación que ofrecer.
  s.draft.renewed.human = false;
  const at = s.pool.findIndex((c) => c.symbols.includes('plant'));
  s.market[0] = s.pool.splice(at, 1)[0];
  assert.ok(!game.canRenew('human'), 'con una carta del símbolo propio no se renueva');
}

console.log('✓ flujo de partida ok');
