// Las salas: la partida en el servidor y dos pantallas mirándola.
//
// Lo que hay que probar es lo que la partida en el mismo teclado no necesitaba: que
// cada asiento sea de quien es. Con el estado del lado del servidor, la única cosa que
// impide que el celular juegue el turno de la computadora es la comprobación de
// `allowed`, y un error ahí no se nota jugando de a uno.
import assert from 'node:assert/strict';
import { createLobby, createRoom } from '../scripts/net.mjs';

const idle = () => new Promise((r) => setTimeout(r, 0));
const settle = async (n = 10) => { for (let i = 0; i < n; i++) await idle(); };
const opts = { pace: 0, seed: 4, grace: 20 };

/** Una pantalla de mentira: guarda lo que le mandan por el stream. */
function screen() {
  const msgs = [];
  return {
    msgs,
    write(text) {
      for (const line of text.split('\n')) {
        if (line.startsWith('data: ')) msgs.push(JSON.parse(line.slice(6)));
      }
    },
    /** El último mensaje de un tipo. */
    last(t) { return [...msgs].reverse().find((m) => m.t === t) ?? null; },
  };
}

/** Sienta a dos y los pone listos: el camino corto al principio de una partida. */
async function playing(room) {
  const a = screen();
  const b = screen();
  room.attach('compu', a);
  room.attach('celu', b);
  room.act('compu', 'ready');
  room.act('celu', 'ready');
  await settle();
  return { a, b };
}

// ---- el lobby: salas que alguien crea ---------------------------------------
{
  const lobby = createLobby(opts);
  assert.deepEqual(lobby.list(), [], 'al principio no hay ninguna');

  const one = lobby.create();
  const two = lobby.create();
  assert.notEqual(one.code, two.code, 'cada sala tiene su código');
  assert.match(one.code, /^[A-Z0-9]{4}$/, 'corto, para copiarlo a otra pantalla');
  assert.deepEqual(lobby.list().map((r) => r.name), ['Sala 1', 'Sala 2']);
  assert.equal(lobby.get(one.code).code, one.code, 'se llega a una sala por su código');
  assert.equal(lobby.get(one.code.toLowerCase()).code, one.code, 'sin importar cómo se escriba');
  assert.equal(lobby.get('NOPE'), null, 'y a una que no existe, no');

  const info = lobby.list()[0];
  assert.deepEqual(info.seats, { p1: false, p2: false });
  assert.equal(info.playing, false, 'una sala recién creada no está jugando nada');
  console.log('  ✓ el lobby: crear salas, listarlas y entrar por código');
}

// ---- los asientos se reparten por orden de llegada --------------------------
{
  const room = createRoom({ code: 'TEST', name: 'Sala', ...opts });
  const a = screen();
  const b = screen();
  const c = screen();

  const leaveA = room.attach('compu', a);
  assert.equal(a.last('hello').seat, 'p1', 'el primero que entra abre la mesa');

  room.attach('celu', b);
  assert.equal(b.last('hello').seat, 'p2', 'el segundo se sienta enfrente');

  room.attach('mirón', c);
  assert.equal(c.last('hello').seat, null, 'el tercero mira');
  assert.equal(room.act('mirón', 'ready').sent, false, 'y no toca nada');

  // Recargar la página no cuesta el asiento: el id vuelve y el asiento lo estaba
  // esperando.
  leaveA();
  const again = screen();
  room.attach('compu', again);
  assert.equal(again.last('hello').seat, 'p1', 'el que recarga vuelve a su asiento');
  console.log('  ✓ asientos por orden de llegada, y se guardan en la recarga');
}

// ---- nada empieza hasta que los dos dicen que sí ----------------------------
//
// Antes la partida arrancaba sola al juntarse los dos, y eso convertía la sala en una
// puerta giratoria: entrar a ver quién había te metía en una partida empezada.
{
  const room = createRoom({ code: 'TEST', name: 'Sala', ...opts });
  const a = screen();
  const b = screen();
  room.attach('compu', a);
  room.attach('celu', b);
  await settle();
  assert.equal(room.state, null, 'con los dos sentados todavía no pasa nada');

  room.act('compu', 'ready');
  await settle();
  assert.equal(room.state, null, 'con uno solo listo, tampoco');
  assert.deepEqual(a.last('room').room.ready, { p1: true, p2: false }, 'y se ve quién dijo que sí');

  room.act('celu', 'ready');
  await settle();
  assert.ok(room.state, 'con los dos, empieza');
  assert.equal(room.state.mode, 'net', 'sin CPU: los dos asientos son de personas');
  assert.equal(b.last('room').room.playing, true, 'y la sala lo cuenta');
  console.log('  ✓ la partida empieza cuando los dos aprietan Listo');
}

// ---- cada uno entra con el Axie que eligió en su aparato ---------------------
//
// La sala no pregunta con qué jugás: la elección se hace una sola vez y en un solo
// lugar —la portada—, y la pantalla la manda al sentarse (ver `loadout.js`). Acá se
// guarda hasta repartir, que puede ser un rato largo después: entre que te sentás y
// que el otro llega no hay partida donde poner nada.
{
  const room = createRoom({ code: 'TEST', name: 'Sala', ...opts });
  const a = screen();
  room.attach('compu', a);
  room.attach('celu', screen());

  // Los dos con el mismo bicho, que es el caso que antes no se podía: la clase es el
  // mazo, y el juego le cambiaba el Axie a uno de los dos para que no se repitieran.
  // Cada uno lo eligió en su aparato sin ver al otro, así que la partida los respeta.
  room.act('compu', 'loadout', { axie: 'plant', boosts: { nada: 'plant' } });
  room.act('celu', 'loadout', { axie: 'plant', boosts: {} });
  assert.deepEqual(a.last('room').room.axies, { p1: 'plant', p2: 'plant' },
    'la sala cuenta con qué entra cada uno, antes de repartir');

  room.act('compu', 'ready');
  room.act('celu', 'ready');
  await settle();
  assert.deepEqual(room.state.axies, { p1: 'plant', p2: 'plant' },
    'los dos juegan con el que eligieron, aunque sea el mismo');
  assert.deepEqual(room.state.symbols, { p1: 'plant', p2: 'plant' });

  // Lo que llega por el cable es de afuera: un Axie que no existe no tumba la sala ni
  // le cambia el bicho a nadie.
  room.act('compu', 'loadout', { axie: 'gato' });
  room.act('compu', 'newMatch');
  await settle();
  assert.equal(a.last('room').room.axies.p1, 'plant', 'un pedido que no se entiende se tira');
  assert.equal(room.state.axies.p1, 'plant', 'y no le cuesta el bicho al que lo mandó');
  console.log('  ✓ cada asiento entra con el Axie que eligió, y pueden ser el mismo');
}

// ---- el Axie se va con el asiento -------------------------------------------
{
  const room = createRoom({ code: 'TEST', name: 'Sala', ...opts });
  const a = screen();
  room.attach('compu', a);
  const leave = room.attach('celu', screen());
  room.act('celu', 'loadout', { axie: 'bird', boosts: {} });
  assert.equal(a.last('room').room.axies.p2, 'bird');

  leave();
  await new Promise((r) => setTimeout(r, 60)); // más que `grace`
  assert.equal(a.last('room').room.axies.p2, null,
    'el que llegue después no juega con el bicho del anterior');
  console.log('  ✓ el Axie se va con el asiento');
}

// ---- el "listo" no se hereda ------------------------------------------------
{
  const room = createRoom({ code: 'TEST', name: 'Sala', ...opts });
  const a = screen();
  room.attach('compu', a);
  const leave = room.attach('celu', screen());
  room.act('celu', 'ready');
  assert.equal(a.last('room').room.ready.p2, true);

  leave();
  await new Promise((r) => setTimeout(r, 60)); // más que `grace`
  assert.equal(a.last('room').room.ready.p2, false, 'el que se va se lleva su listo');
  assert.equal(a.last('room').room.seats.p2, false, 'y su asiento queda libre');
  console.log('  ✓ el listo se va con el asiento');
}

// ---- cada uno juega lo suyo -------------------------------------------------
{
  const room = createRoom({ code: 'TEST', name: 'Sala', ...opts });
  const { a, b } = await playing(room);

  // Quién abre se sortea al empezar la partida: el test lo lee en vez de suponerlo.
  const [first, second] = room.state.order;
  const idOf = { p1: 'compu', p2: 'celu' };
  assert.equal(room.state.turn, first);
  const before = room.state.chains[first].cards.length;

  // El que no tiene el turno pide robar. No pasa nada: ni roba por el otro, ni roba
  // para sí.
  room.act(idOf[second], 'hit');
  await settle();
  assert.equal(room.state.chains[first].cards.length, before, 'el otro no te roba el turno');
  assert.equal(room.state.chains[second].cards.length, 0, 'ni juega el suyo antes de tiempo');

  room.act(idOf[first], 'hit');
  await settle();
  const chain = room.state.chains[first];
  assert.equal(chain.cards.length + (chain.bustCard ? 1 : 0), before + 1,
    'el dueño del turno sí roba');

  // Y las dos pantallas ven lo mismo, sin haber pedido nada.
  assert.equal(a.last('state').state.hitId, b.last('state').state.hitId);
  assert.equal(a.last('state').state.chains[first].cards.length, chain.cards.length);
  console.log('  ✓ cada asiento juega lo suyo, y los dos ven lo mismo');
}

// ---- lo que no se puede ver no viaja ----------------------------------------
{
  const room = createRoom({ code: 'TEST', name: 'Sala', ...opts, seed: 8 });
  const { a } = await playing(room);

  const wire = a.last('state').state;
  const real = room.state;

  // La pila boca abajo que repone el centro: el largo sí, las cartas no. Mandarlas
  // sería decirle a los dos qué va a salir.
  assert.equal(wire.pool.length, real.pool.length, 'el largo de la reserva se ve');
  assert.ok(wire.pool.every((c) => c === null), 'pero no lo que hay adentro');

  // Los mazos van con lo mismo que tienen —es público: se ve cada carta que el otro se
  // lleva del centro— pero barajados: el orden no lo conoce ni su dueño, y es
  // exactamente lo que mide el aro de la próxima carta.
  for (const seat of ['p1', 'p2']) {
    const keys = (deck) => deck.map((c) => c.key).sort();
    assert.deepEqual(keys(wire.decks[seat]), keys(real.decks[seat]),
      `${seat}: el mazo lleva las mismas cartas`);
  }
  const order = (deck) => deck.map((c) => c.uid).join();
  // Con 30 cartas, que el barajado devuelva el mismo orden es de una en 10^32.
  assert.notEqual(order(wire.decks.p1), order(real.decks.p1), 'pero no en el mismo orden');
  console.log('  ✓ la reserva y el orden de los mazos no salen al cable');
}

// ---- una partida entera, jugada desde las dos pantallas ---------------------
{
  const room = createRoom({ code: 'TEST', name: 'Sala', ...opts, seed: 2 });
  await playing(room);

  const idOf = { p1: 'compu', p2: 'celu' };
  let guard = 0;
  while (room.state.phase !== 'matchEnd' && guard++ < 3000) {
    const s = room.state;
    if (s.phase === 'turn' && s.turn) {
      const seat = s.turn;
      room.act(idOf[seat], s.chains[seat].cards.length < 2 ? 'hit' : 'stand');
    } else if (s.phase === 'draft' && s.draft) {
      room.act(idOf[s.draft.order[s.draft.index]], 'skipDraft');
    }
    await idle();
  }
  assert.equal(room.state.phase, 'matchEnd', `terminó (${guard} vueltas)`);
  console.log(`  ✓ partida completa entre dos aparatos (${room.state.round} rondas)`);
}

// ---- abandonar una partida empezada -----------------------------------------
// Irse suelta el asiento en el acto —sin esperar el `grace` de una recarga— y cierra
// la partida: en la primera ronda, anulada.
{
  const room = createRoom({ code: 'TEST', name: 'Sala', ...opts });
  const { a } = await playing(room);
  assert.equal(room.state.round, 1);

  assert.equal(room.act('celu', 'leave').sent, true);
  assert.equal(room.state.phase, 'matchEnd', 'irse cierra la partida');
  assert.deepEqual(room.state.forfeit, { by: 'p2', winner: null }, 'en la primera ronda, no gana nadie');
  assert.equal(a.last('state').state.forfeit.by, 'p2', 'y el que se quedó se entera');
  assert.equal(a.last('room').room.seats.p2, false, 'el asiento queda libre en el acto');

  // Sin nadie enfrente no se puede rearmar: sería jugar contra nadie.
  const match = room.state.match;
  room.act('compu', 'newMatch');
  await settle();
  assert.equal(room.state.match, match, 'sin rival no hay partida nueva');
  console.log('  ✓ abandonar suelta el asiento y cierra la partida');
}

// ---- el servidor de verdad --------------------------------------------------
//
// Lo de arriba prueba las salas; esto prueba el cable: que las rutas estén puestas, que
// el stream salga con las cabeceras de SSE y que un POST llegue a la partida. Es la
// costura entre `net.mjs` y `dev.mjs`, y es la que se rompe en silencio — el juego anda
// perfecto y la página se queda esperando.
{
  const { spawn } = await import('node:child_process');
  const PORT = 8137;
  const base = `http://127.0.0.1:${PORT}`;
  const server = spawn(process.execPath, ['scripts/dev.mjs'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  });

  try {
    // A que levante. Sin esto el primer pedido sale antes que el `listen`.
    let hello = null;
    for (let i = 0; i < 100 && !hello; i++) {
      try {
        hello = await (await fetch(`${base}/net/hello`)).json();
      } catch {
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    assert.ok(hello?.net, 'el servidor contesta que sabe de partidas en red');
    assert.ok(Array.isArray(hello.urls), 'y con qué direcciones se llega');

    const post = (path, body) => fetch(base + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    const { room } = await (await post('/net/rooms')).json();
    assert.match(room.code, /^[A-Z0-9]{4}$/, 'se crea una sala por HTTP');
    const listed = await (await fetch(`${base}/net/rooms`)).json();
    assert.ok(listed.rooms.some((r) => r.code === room.code), 'y aparece en la lista');

    /** Abre un stream y devuelve los mensajes que van llegando. */
    async function stream(id) {
      const res = await fetch(`${base}/net/stream?id=${id}&sala=${room.code}`);
      assert.match(res.headers.get('content-type'), /text\/event-stream/, 'sale como SSE');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const msgs = [];
      (async () => {
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read().catch(() => ({ done: true }));
          if (done) return;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            if (line.startsWith('data: ')) msgs.push(JSON.parse(line.slice(6)));
          }
        }
      })();
      return { msgs, cancel: () => reader.cancel().catch(() => {}) };
    }

    const wait = async (test, why) => {
      for (let i = 0; i < 200; i++) {
        if (test()) return;
        await new Promise((r) => setTimeout(r, 25));
      }
      assert.fail(why);
    };

    const one = await stream('compu');
    await wait(() => one.msgs.some((m) => m.t === 'hello'), 'el primero no recibió su asiento');
    assert.equal(one.msgs.find((m) => m.t === 'hello').seat, 'p1');

    const two = await stream('celu');
    await wait(() => two.msgs.some((m) => m.t === 'hello'), 'el segundo no recibió su asiento');
    assert.equal(two.msgs.find((m) => m.t === 'hello').seat, 'p2');

    const last = (s) => [...s.msgs].reverse().find((m) => m.t === 'state');
    await post('/net/act', { id: 'compu', sala: room.code, action: 'ready' });
    await post('/net/act', { id: 'celu', sala: room.code, action: 'ready' });
    await wait(() => last(one) && last(two), 'la partida no arrancó con los dos listos');

    // Y un POST del que tiene el turno mueve la partida de los dos lados. El servidor
    // corre a velocidad real: entre que la ronda abre y que se reparte la primera carta
    // hay una pausa, así que primero hay que esperar a que haya turno.
    await wait(() => last(one).state.turn, 'la ronda no llegó a repartir');
    const turn = last(one).state.turn;
    const idOf = { p1: 'compu', p2: 'celu' };
    const cards = () => {
      const chain = last(one).state.chains[turn];
      return chain.cards.length + (chain.bustCard ? 1 : 0);
    };
    await wait(() => cards() === 1, 'no llegó la primera carta');
    const done = await post('/net/act', { id: idOf[turn], sala: room.code, action: 'hit' });
    assert.equal(done.status, 200);
    await wait(() => cards() === 2, 'el POST no movió la partida');

    one.cancel();
    two.cancel();
    console.log('  ✓ el servidor sirve las salas: crear, entrar, listo y jugar');
  } finally {
    server.kill();
  }
}

console.log('✓ salas en red ok');
