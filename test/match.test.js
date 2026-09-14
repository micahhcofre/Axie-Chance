// Smoke test del flujo completo: rondas, reparto de la reserva y final a 100 puntos.
import assert from 'node:assert/strict';
import {
  createGame, TARGET, PLAYERS, MARKET_SIZE, hpOf, lastChance, matchResult, ownedBy,
} from '../src/game.js';
import { scoreChain } from '../src/rules.js';

const idle = () => new Promise((r) => setTimeout(r, 0));
const other = (p) => (p === 'p1' ? 'p2' : 'p1');
// Todo lo que tiene un jugador: mazo, lo que reservó el pulpo y lo que sigue en la
// mesa sin devolver.
const owned = (s, p) => ownedBy(s, p);


for (const difficulty of ['facil', 'normal', 'duro']) {
  const game = createGame({ pace: 0 });
  const openers = [];
  const gains = [];
  game.newMatch({ difficulty, axie: 'aquatic' });
  assert.equal(game.state.axies.p1, 'aquatic');
  assert.equal(game.state.symbols.p1, 'aquatic', 'la clase del Axie es su símbolo');
  assert.notEqual(game.state.symbols.p2, 'aquatic', 'la CPU juega otra clase');
  assert.equal(game.state.market.length, MARKET_SIZE, `el centro arranca con ${MARKET_SIZE}`);
  assert.equal(game.state.pool.length, 86 - MARKET_SIZE);

  // Qué terminó llevándose el humano en cada draft. No se elige un modo aparte: lo
  // decide la carta que toca —con poder cierra el reparto, sin poder deja una
  // segunda—, así que se alterna qué carta tocar para probar las dos ramas.
  let p1Mode = 'power';
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
        p1: owned(s, 'p1'),
        p2: owned(s, 'p2'),
        pool: s.pool.length + s.market.length,
        // Cada pulpo puesto paga una carta de más, aparte del reparto.
        octopus: s.status[s.draft.order[0]].stacked,
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
        octopus: before.octopus,
        extra: before.octopus - s.status[p].stacked,
      });
      before = null;
    }
  });

  // La ronda cierra sola: la fase 'roundEnd' dura una pausa y se va, así que el bucle
  // puede no verla nunca. Quién abrió se anota al cambiar el número de ronda.
  let seenRound = 0;
  while (game.state.phase !== 'matchEnd') {
    assert.ok(guard++ < 4000, 'la partida no termina');
    const s = game.state;
    if (s.round > seenRound) {
      seenRound = s.round;
      openers.push(s.order[0]);
    }

    // Invariante: 86 comunes + 10 de cada mazo base, nunca se pierde ni se duplica nada.
    assert.equal(
      s.pool.length + s.market.length + owned(s, 'p1') + owned(s, 'p2'),
      106,
      'cartas totales en juego',
    );
    // Ninguna carta está en dos lados a la vez: el pulpo saca cartas del reparto y
    // las guarda aparte hasta que arranca la ronda, y ahí es fácil duplicarlas.
    for (const p of PLAYERS) {
      // Lo que sigue en la mesa sin devolver: `recycled` marca hasta dónde de la
      // cadena ya volvió al mazo, y `returned` que volvió entera. Esas sí están en
      // los dos lados a propósito (ver `draw`), así que no cuentan acá.
      const table = s.returned[p] ? [] : [
        ...s.chains[p].cards.flatMap((c) => c.stackedCards || [c]).slice(s.recycled[p]),
        ...(s.chains[p].bustCard ? [s.chains[p].bustCard] : []),
        ...(s.pendingStack?.player === p ? [s.pendingStack.card] : []),
      ];
      const uids = [...s.decks[p], ...table].map((c) => c.uid);
      assert.equal(new Set(uids).size, uids.length, `${p}: una carta en dos lados`);
    }
    // El centro está siempre lleno mientras quede reserva para reponer.
    assert.equal(
      s.market.length,
      Math.min(MARKET_SIZE, s.market.length + s.pool.length),
      'el centro se repone en el acto',
    );

    if (s.phase === 'draft') {
      const picking = game.drafting();
      if (picking === 'p2') { await idle(); continue; }
      const options = game.pickable();
      assert.ok(options.length <= MARKET_SIZE, 'se elige solo entre las cartas del centro');
      assert.ok(options.every((c) => s.market.includes(c)), 'las opciones salen del centro');
      // El centro puede no ofrecer nada: las seis cartas con poder y el jugador
      // yendo por cartas sin poder. Queda la renovación —una— y después pasar.
      if (options.length === 0) {
        assert.ok(s.market.length > 0 && s.market.every((c) => c.power),
          'sin nada elegible, el centro es todo poderes');
        if (game.canRenew('p1')) game.renewMarket();
        else await game.skipDraft();
        continue;
      }
      // La etapa del pulpo va aparte del reparto: una carta suelta por pulpo, sin
      // reglas. No toca `p1Mode`, que describe la rama del reparto normal.
      if (s.draft.step === 'bonus') {
        await game.takeCard(options[0].uid);
        continue;
      }
      if (s.draft.mode) {
        // Segunda carta del par (o el par único de una cadena cortada).
        await game.takeCard(options[0].uid);
        continue;
      }
      // Se alterna entre las dos ramas: una carta con poder cierra el reparto (suma
      // 1) y una sin poder deja pendiente la segunda (suma 2).
      const want = (!gains.includes(2) || p1Mode === 'power') ? 'plain' : 'power';
      // Para llegar a 2 hacen falta dos cartas sin poder a la vista, y 36 de las 71
      // traen poder: hay repartos donde no hay ninguna. Con partidas de 7 rondas eso
      // alcanzaba para terminar sin haber probado nunca la rama, así que se fuerza.
      if (want === 'plain' && s.pool.length) {
        for (let i = 0; i < s.market.length && s.market.filter((c) => !c.power).length < 2; i++) {
          if (!s.market[i].power) continue;
          const at = s.pool.findIndex((c) => !c.power);
          if (at < 0) break;
          s.pool.push(s.market[i]);
          s.market[i] = s.pool.splice(at, 1)[0];
        }
      }
      const options2 = game.pickable();
      const card = options2.find((c) => (want === 'power' ? c.power : !c.power)) ?? options2[0];
      // Espejo de la inferencia del juego: la carta que tocás decide.
      p1Mode = card.power ? 'power' : 'plain';
      await game.takeCard(card.uid);
      continue;
    }

    while (drafts.length) {
      const d = drafts.shift();
      // El que no repartió no toca su mazo: cada uno se lleva lo suyo en su turno.
      assert.equal(d.otherGain, 0, `${other(d.player)} sumó en el reparto ajeno`);
      // Las cartas del pulpo se cuentan aparte: son de más, no parte del reparto. Así
      // los invariantes del reparto siguen siendo los de siempre en vez de aflojarse.
      assert.ok(d.extra >= 0 && d.extra <= d.octopus,
        `${d.player} cobró ${d.extra} cartas de pulpo y debía ${d.octopus}`);
      const draftGain = d.gain - d.extra;
      // Nadie se lleva más de dos cartas del reparto, y una cadena cortada nunca llega
      // a dos: le toca una sola, y sin poder.
      assert.ok(draftGain >= 0 && draftGain <= 2, `${d.player} sumó ${draftGain}`);
      assert.ok(d.poolAfter <= d.pool, 'la reserva nunca crece');
      // Cortarse da una carta sin poder, nunca dos. Puede dar cero: si las seis del
      // centro traen poder no hay nada que llevarse.
      if (d.busted) assert.ok(draftGain <= 1, `${d.player} se cortó y sumó ${draftGain}`);
      if (d.player === 'p1') {
        // La carta con poder cierra el reparto ahí mismo, siempre.
        if (!d.busted && p1Mode === 'power') {
          assert.equal(draftGain, 1, 'una carta con poder y se acabó');
        }
        gains.push(draftGain);
      }
    }

    if (s.pendingStack && s.pendingStack.player === 'p1') {
      await game.chooseStackTarget(0);
    } else if (s.turn === 'p1' && !s.busy) {
      // En las rondas pares se planta con la primera carta. Robar hasta 6 se corta el
      // ~65% de las veces, y una racha de cortes deja el reparto de quien se planta
      // (1 trío o 2 pares) sin probar: plantarse seguro cada dos rondas lo garantiza.
      if (s.round % 2 === 0 || scoreChain(s.chains.p1).total >= 6) await game.stand();
      else await game.hit();
    } else {
      await idle();
    }
  }

  const s = game.state;
  assert.ok(PLAYERS.some((p) => hpOf(s, p) <= 0), 'alguien se quedó sin vida');
  assert.ok(Math.max(s.totals.p1, s.totals.p2) >= TARGET, 'hizo falta el daño de una vida');
  assert.ok(s.roundScores.p1 !== null && s.roundScores.p2 !== null, 'los dos jugaron la ronda');
  // Uno y uno: abre siempre el jugador y contesta la CPU, así ningún lado juega dos
  // turnos seguidos al cambiar de ronda.
  assert.deepEqual(openers, openers.map(() => 'p1'), 'abre siempre el jugador');
  assert.ok(gains.includes(1) && gains.includes(2), 'se probaron poder y cantidad');
  assert.equal(s.pool.length + s.market.length + owned(s, 'p1') + owned(s, 'p2'), 106);
  console.log(
    `  ${difficulty.padEnd(6)} ${s.totals.p1} — ${s.totals.p2} en ${s.round} rondas` +
      ` · mazos ${owned(s, 'p1')}/${owned(s, 'p2')}` +
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
  assert.equal(game.state.symbols.p1, 'bug');
  assert.equal(game.state.round, 1);
  assert.equal(game.state.totals.p1, 0);
  assert.equal(game.state.market.length, MARKET_SIZE, `el centro arranca con ${MARKET_SIZE}`);
  assert.equal(game.state.pool.length, 86 - MARKET_SIZE);
}

// El reloj: al que no juega su turno a tiempo se le desarma el ataque, como si se le
// hubiera cortado la cadena, y al que no elige del centro a tiempo se queda sin carta.
// La CPU no lleva reloj.
{
  const game = createGame({ pace: 0, seed: 4, clock: { turn: 40, draft: 25 } });
  const until = async (ok, what) => {
    for (let i = 0; i < 400; i++) {
      if (ok()) return;
      await new Promise((r) => setTimeout(r, 2));
    }
    assert.fail(what);
  };
  let botClock = false;
  game.subscribe((s) => { if (s.turn === 'p2' && s.clock) botClock = true; });
  game.newMatch({ difficulty: 'normal', axie: 'aquatic' });

  await until(() => game.state.turn === 'p1', 'no arranca el turno');
  const c = game.state.clock;
  assert.equal(c?.seat, 'p1');
  assert.equal(c?.kind, 'turn');
  assert.equal(c?.ms, 40);
  assert.equal(game.state.roundScores.p1, null);

  await until(() => game.state.phase === 'draft' && game.drafting() === 'p1',
    'el turno no se cierra solo');
  assert.equal(game.state.roundScores.p1, 0, 'sin tiempo el ataque falla');
  assert.equal(game.state.chains.p1.busted, true, 'cuenta como cadena cortada');
  assert.equal(game.state.draft.mode, 'plain', 'y el reparto es el de un fallo');
  assert.ok(game.state.log.some((l) => l.text.startsWith('Se acabó el tiempo:')));
  assert.equal(game.state.clock?.kind, 'draft', 'el reparto trae su reloj');
  const deck = owned(game.state, 'p1');

  await until(() => game.state.phase !== 'draft' || game.drafting() !== 'p1',
    'el reparto no se cierra solo');
  assert.ok(game.state.log.some((l) => l.text === 'Se acabó el tiempo de elegir.'));
  assert.equal(owned(game.state, 'p1'), deck, 'sin elegir no se lleva nada');

  await until(() => game.state.round === 2 || game.state.phase === 'matchEnd',
    'la CPU no cierra la ronda');
  assert.equal(botClock, false, 'la CPU juega sin reloj');
  game.newMatch({ difficulty: 'normal', axie: 'aquatic' });
}

// No hay descarte: cada ronda arranca con todas las cartas propias barajadas de nuevo.
{
  const game = createGame({ pace: 0 });
  // El cierre de ronda dura una pausa y sigue solo, así que la foto se saca en el
  // subscriber: entre dos vueltas del bucle la ronda nueva ya arrancó.
  let closed = null;
  game.subscribe((s) => {
    if (s.phase !== 'roundEnd' || closed) return;
    closed = {
      round: s.round,
      played: s.chains.p1.cards.map((c) => c.uid),
      deck: s.decks.p1.map((c) => c.uid),
    };
  });
  game.newMatch({ difficulty: 'normal', axie: 'plant' });
  let guard = 0;
  while (!closed || game.state.round === closed.round) {
    assert.ok(guard++ < 4000, 'la ronda no cierra');
    const s = game.state;
    if (s.phase === 'draft') {
      if (game.drafting() !== 'p1') { await idle(); continue; }
      const options = game.pickable();
      if (!options.length) { await game.skipDraft(); continue; }
      await game.takeCard(options[0].uid);
      continue;
    }
    if (s.turn === 'p1' && !s.busy) await game.stand();
    else await idle();
  }

  // Cerrada la ronda no queda nada afuera: mazo = todo lo que el jugador posee.
  assert.ok(closed.played.length > 0, 'el jugador jugó al menos una carta');
  assert.ok(closed.played.every((uid) => closed.deck.includes(uid)), 'lo jugado vuelve al mazo');
  assert.equal(new Set(closed.deck).size, closed.deck.length, 'sin cartas duplicadas');

  const after = game.state.decks.p1.map((c) => c.uid).concat(
    game.state.chains.p1.cards.map((c) => c.uid),
  );
  assert.deepEqual(new Set(after), new Set(closed.deck), 'la ronda nueva reparte el mazo entero');
}

// El centro se renueva una vez cuando nada de lo que podés agarrar lleva tu símbolo.
{
  const game = createGame({ pace: 0 });
  game.newMatch({ difficulty: 'normal', axie: 'plant' });
  let guard = 0;
  while (!(game.state.phase === 'draft' && game.drafting() === 'p1')) {
    assert.ok(guard++ < 4000, 'no se llegó al reparto del jugador');
    const s = game.state;
    if (s.phase === 'draft' || s.busy || s.turn !== 'p1') await idle();
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

  assert.ok(game.canRenew('p1'), 'sin nada del símbolo propio se puede renovar');
  game.renewMarket();
  assert.equal(s.market.length, MARKET_SIZE, 'el centro vuelve a estar lleno');
  assert.equal(s.pool.length + s.market.length, total, 'la reserva no pierde ni gana cartas');
  assert.notDeepEqual(s.market.map((c) => c.uid), before, 'salieron cartas nuevas');
  assert.ok(s.draft.renewed.p1, 'queda marcado que ya renovó');
  assert.ok(!game.canRenew('p1'), 'se renueva una sola vez por reparto');

  // Con una carta propia a la vista no hay renovación que ofrecer.
  s.draft.renewed.p1 = false;
  const at = s.pool.findIndex((c) => c.symbols.includes('plant'));
  s.market[0] = s.pool.splice(at, 1)[0];
  assert.ok(!game.canRenew('p1'), 'con una carta del símbolo propio no se renueva');
}

// Con semilla la partida es reproducible. Es lo que hace comparables dos corridas
// del banco de pruebas: mismo reparto, y la diferencia que se mida es del cambio y
// no del sorteo.
{
  /** Juega una partida entera con decisiones fijas y devuelve su huella. */
  async function trace(seed) {
    const game = createGame({ pace: 0, seed });
    game.newMatch({ difficulty: 'normal', axie: 'aquatic' });
    const steps = [];
    let guard = 0;
    while (game.state.phase !== 'matchEnd') {
      assert.ok(guard++ < 4000, 'la partida no termina');
      const s = game.state;
      if (s.phase === 'draft') {
        if (game.drafting() !== 'p1') { await idle(); continue; }
        const options = game.pickable();
        if (!options.length) await game.skipDraft();
        else await game.takeCard(options[0].uid);
        continue;
      }
      if (s.phase === 'roundEnd') { await game.nextRound(); continue; }
      if (s.turn === 'p1' && !s.busy) {
        if (s.chains.p1.cards.length < 2) await game.hit();
        else await game.stand();
        steps.push(`${s.round}:${s.chains.p1.cards.map((c) => c.key).join('|')}`);
        continue;
      }
      await idle();
    }
    const s = game.state;
    return [s.axies.p2, s.round, s.totals.p1, s.totals.p2, ...steps].join('/');
  }

  const a = await trace(1234);
  const b = await trace(1234);
  const c = await trace(1235);
  assert.equal(a, b, 'la misma semilla juega la misma partida');
  assert.notEqual(a, c, 'otra semilla juega otra partida');
  assert.ok(a.length > 40, 'la huella cubre la partida entera');
}

// La última chance: al que dejan sin vida antes de haber atacado le queda su turno
// entero, y si en ese golpe se lleva puesto al otro, empatan. Solo le puede tocar al
// que juega segundo, que con el orden fijo es siempre la CPU.
{
  const game = createGame({ pace: 0, seed: 7 });
  game.newMatch({ difficulty: 'normal', axie: 'aquatic' });
  await idle();
  assert.equal(game.state.order[0], 'p1', 'abre el jugador');
  assert.equal(game.state.turn, 'p1');
  assert.equal(lastChance(game.state), null, 'con los dos enteros no hay última chance');

  // Los dos a un punto de morir: el golpe del jugador deja sin vida a la CPU, y el que
  // la CPU alcanza a devolver lo deja sin vida a él.
  game.state.totals.p1 = TARGET - 1;
  game.state.totals.p2 = TARGET - 1;

  // El halo se prende con el golpe que la mata y se apaga cuando contesta: dura
  // exactamente el turno regalado, ni un repintado más.
  const halo = [];
  game.subscribe((s) => {
    const dying = lastChance(s);
    if (halo[halo.length - 1] !== dying) halo.push(dying);
  });

  await game.stand();
  let guard = 0;
  while (game.state.phase !== 'matchEnd') {
    assert.ok(guard++ < 400, 'la partida no termina');
    await idle();
  }

  const s = game.state;
  assert.ok(s.roundScores.p2 !== null, 'la CPU jugó su última chance');
  assert.ok(s.roundScores.p2 > 0, 'y pegó: sin vida, plantarse por debajo pierde igual');
  assert.ok(hpOf(s, 'p1') <= 0 && hpOf(s, 'p2') <= 0, 'los dos quedaron sin vida');
  assert.equal(matchResult(s), 'tie', 'doble KO: empate');
  assert.deepEqual(halo, [null, 'p2', null], 'el halo dura el turno regalado y se apaga');
  console.log('  última chance: empate por doble KO');
}

// El que abre nunca cobra la última chance: cuando lo dejan sin vida ya tiró su golpe.
// Es la contracara del orden fijo, y se mide sobre una partida entera.
{
  const game = createGame({ pace: 0, seed: 11 });
  const halo = new Set();
  game.subscribe((s) => halo.add(lastChance(s)));
  game.newMatch({ difficulty: 'normal', axie: 'aquatic' });

  let guard = 0;
  while (game.state.phase !== 'matchEnd') {
    assert.ok(guard++ < 4000, 'la partida no termina');
    const s = game.state;
    if (s.phase === 'draft') {
      if (game.drafting() !== 'p1') { await idle(); continue; }
      const options = game.pickable();
      if (!options.length) await game.skipDraft();
      else await game.takeCard(options[0].uid);
      continue;
    }
    if (s.phase === 'turn' && s.turn === 'p1' && !s.busy) await game.stand();
    else await idle();
  }

  assert.ok(!halo.has('p1'), 'al que abre nunca se le prende el halo');
  const s = game.state;
  const r = matchResult(s);
  assert.equal(r, hpOf(s, 'p1') <= 0 ? (hpOf(s, 'p2') <= 0 ? 'tie' : 'p2') : 'p1',
    'el resultado sale de la vida, no del daño repartido');
  // Si al jugador lo mataron, fue la CPU cerrando el intercambio: no quedó turno suyo
  // pendiente que devolver.
  if (r === 'p2') assert.ok(s.roundScores.p1 !== null, 'ya había atacado cuando cayó');
  console.log(`  última chance: el que abre no la cobra (${r})`);
}

console.log('✓ flujo de partida ok');
