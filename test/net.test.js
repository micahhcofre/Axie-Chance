// Las salas en red: la partida en el navegador del anfitrión, el cartero que lleva los
// mensajes y el cable de punta a punta.
//
// Lo que hay que probar es lo que la partida en el mismo teclado no necesitaba: que
// cada asiento sea de quien es, y que lo que manda uno le llegue al otro —entero, en
// orden y solo a él— pasando por un cartero que no abre nada.
import assert from 'node:assert/strict';
import { createRoom } from '../src/rooms.js';
import { createRelay, memoryStore, LISTED_FOR } from '../relay/core.mjs';
import { openLink, packMessage } from '../src/link.js';

const idle = () => new Promise((r) => setTimeout(r, 0));
const settle = async (n = 10) => { for (let i = 0; i < n; i++) await idle(); };
const opts = { pace: 0, seed: 4, grace: 20 };

/** Una pantalla de mentira: guarda lo que le manda la sala. */
function screen() {
  const msgs = [];
  return {
    msgs,
    send: (msg) => msgs.push(JSON.parse(JSON.stringify(msg))),
    /** El último mensaje de un tipo. */
    last(t) { return [...msgs].reverse().find((m) => m.t === t) ?? null; },
  };
}

/** Sienta a dos y los pone listos: el camino corto al principio de una partida. */
async function playing(room) {
  const a = screen();
  const b = screen();
  room.attach('compu', a.send);
  room.attach('celu', b.send);
  room.act('compu', 'ready');
  room.act('celu', 'ready');
  await settle();
  return { a, b };
}

// ---- los asientos se reparten por orden de llegada --------------------------
{
  const infos = [];
  const room = createRoom({ code: 'TEST', name: 'Colmillo', ...opts, onInfo: (i) => infos.push(i) });
  const a = screen();
  const b = screen();
  const c = screen();

  const leaveA = room.attach('compu', a.send);
  assert.equal(a.last('hello').seat, 'p1', 'el primero que entra abre la mesa');
  assert.deepEqual(infos.at(-1).seats, { p1: true, p2: false }, 'y la lista se entera');

  room.attach('celu', b.send);
  assert.equal(b.last('hello').seat, 'p2', 'el segundo se sienta enfrente');

  room.attach('mirón', c.send);
  assert.equal(c.last('hello').seat, null, 'el tercero mira');
  assert.equal(room.act('mirón', 'ready').sent, false, 'y no toca nada');

  // Recargar la página no cuesta el asiento: el id vuelve y el asiento lo estaba
  // esperando.
  leaveA();
  const again = screen();
  room.attach('compu', again.send);
  assert.equal(again.last('hello').seat, 'p1', 'el que recarga vuelve a su asiento');
  assert.equal(room.act('compu', 'toString').sent, false, 'lo que no es una acción no se corre');
  console.log('  ✓ asientos por orden de llegada, y se guardan en la recarga');
}

// ---- nada empieza hasta que los dos dicen que sí ----------------------------
{
  const room = createRoom({ code: 'TEST', name: 'Sala', ...opts });
  const a = screen();
  const b = screen();
  room.attach('compu', a.send);
  room.attach('celu', b.send);
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
{
  const room = createRoom({ code: 'TEST', name: 'Sala', ...opts });
  const a = screen();
  room.attach('compu', a.send);
  room.attach('celu', screen().send);

  // Los dos con el mismo bicho: cada uno lo eligió en su aparato sin ver al otro.
  room.act('compu', 'loadout', { axie: 'plant', boosts: { nada: 'plant' } });
  room.act('celu', 'loadout', { axie: 'plant', boosts: {} });
  assert.deepEqual(a.last('room').room.axies, { p1: 'plant', p2: 'plant' },
    'la sala cuenta con qué entra cada uno, antes de repartir');

  room.act('compu', 'ready');
  room.act('celu', 'ready');
  await settle();
  assert.deepEqual(room.state.axies, { p1: 'plant', p2: 'plant' },
    'los dos juegan con el que eligieron, aunque sea el mismo');

  // Lo que llega por el cable es de afuera: un Axie que no existe no tumba la sala ni
  // le cambia el bicho a nadie.
  room.act('compu', 'loadout', { axie: 'gato' });
  room.act('compu', 'newMatch');
  await settle();
  assert.equal(a.last('room').room.axies.p1, 'plant', 'un pedido que no se entiende se tira');
  assert.equal(room.state.axies.p1, 'plant', 'y no le cuesta el bicho al que lo mandó');
  console.log('  ✓ cada asiento entra con el Axie que eligió, y pueden ser el mismo');
}

// ---- el Axie y el listo se van con el asiento --------------------------------
{
  const room = createRoom({ code: 'TEST', name: 'Sala', ...opts });
  const a = screen();
  room.attach('compu', a.send);
  const leave = room.attach('celu', screen().send);
  room.act('celu', 'loadout', { axie: 'bird', boosts: {} });
  room.act('celu', 'ready');
  assert.equal(a.last('room').room.axies.p2, 'bird');

  leave();
  await new Promise((r) => setTimeout(r, 60)); // más que `grace`
  assert.equal(a.last('room').room.axies.p2, null, 'el que llegue después no juega con el bicho del anterior');
  assert.equal(a.last('room').room.ready.p2, false, 'ni hereda su listo');
  assert.equal(a.last('room').room.seats.p2, false, 'y el asiento queda libre');
  console.log('  ✓ el Axie y el listo se van con el asiento');
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

  room.act(idOf[second], 'hit');
  await settle();
  assert.equal(room.state.chains[first].cards.length, before, 'el otro no te roba el turno');
  assert.equal(room.state.chains[second].cards.length, 0, 'ni juega el suyo antes de tiempo');

  room.act(idOf[first], 'hit');
  await settle();
  const chain = room.state.chains[first];
  assert.equal(chain.cards.length + (chain.bustCard ? 1 : 0), before + 1, 'el dueño del turno sí roba');

  assert.equal(a.last('state').state.hitId, b.last('state').state.hitId, 'y las dos pantallas ven lo mismo');
  console.log('  ✓ cada asiento juega lo suyo, y los dos ven lo mismo');
}

// ---- lo que no se puede ver no viaja ----------------------------------------
// Tampoco a la pantalla del anfitrión: es un jugador más, y ver el orden del mazo
// sería jugar con las cartas marcadas.
{
  const room = createRoom({ code: 'TEST', name: 'Sala', ...opts, seed: 8 });
  const { a } = await playing(room);

  const wire = a.last('state').state;
  const real = room.state;
  assert.equal(wire.pool.length, real.pool.length, 'el largo de la reserva se ve');
  assert.ok(wire.pool.every((c) => c === null), 'pero no lo que hay adentro');
  for (const seat of ['p1', 'p2']) {
    const keys = (deck) => deck.map((c) => c.key).sort();
    assert.deepEqual(keys(wire.decks[seat]), keys(real.decks[seat]), `${seat}: el mazo lleva las mismas cartas`);
  }
  const order = (deck) => deck.map((c) => c.uid).join();
  assert.notEqual(order(wire.decks.p1), order(real.decks.p1), 'pero no en el mismo orden');
  console.log('  ✓ la reserva y el orden de los mazos no salen de la sala');
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
      room.act(idOf[s.turn], s.chains[s.turn].cards.length < 2 ? 'hit' : 'stand');
    } else if (s.phase === 'draft' && s.draft) {
      room.act(idOf[s.draft.order[s.draft.index]], 'skipDraft');
    }
    await idle();
  }
  assert.equal(room.state.phase, 'matchEnd', `terminó (${guard} vueltas)`);
  console.log(`  ✓ partida completa entre dos aparatos (${room.state.round} rondas)`);
}

// ---- abandonar una partida empezada -----------------------------------------
{
  const room = createRoom({ code: 'TEST', name: 'Sala', ...opts });
  const { a } = await playing(room);

  assert.equal(room.act('celu', 'leave').sent, true);
  assert.equal(room.state.phase, 'matchEnd', 'irse cierra la partida');
  assert.deepEqual(room.state.forfeit, { by: 'p2', winner: null }, 'en la primera ronda, no gana nadie');
  assert.equal(a.last('state').state.forfeit.by, 'p2', 'y el que se quedó se entera');
  assert.equal(a.last('room').room.seats.p2, false, 'el asiento queda libre en el acto');

  const match = room.state.match;
  room.act('compu', 'newMatch');
  await settle();
  assert.equal(room.state.match, match, 'sin rival no hay partida nueva');
  console.log('  ✓ abandonar suelta el asiento y cierra la partida');
}

// ---- el cartero -------------------------------------------------------------
//
// No sabe nada del juego: qué salas hay, quién es el anfitrión de cada una y quiénes
// están enganchados. Acá con el almacén en memoria, que es el de `npm start`; en AWS
// cambia el almacén y no la lógica (ver `relay/lambda.mjs`).
{
  let clock = 1_000_000;
  let codes = ['AAAA', 'AAAA', 'BBBB', 'CCCC'];
  const inbox = new Map();
  const alive = new Set(['host', 'guest', 'other', 'spy', 'host2']);
  const relay = createRelay({
    store: memoryStore(),
    now: () => clock,
    newCode: () => codes.shift(),
    async post(conn, text) {
      if (!alive.has(conn)) return false;
      if (!inbox.has(conn)) inbox.set(conn, []);
      inbox.get(conn).push(JSON.parse(text));
      return true;
    },
  });
  const say = (conn, body) => relay.message(conn, JSON.stringify(body));
  const got = (conn) => inbox.get(conn) ?? [];
  const lastOf = (conn, t) => [...got(conn)].reverse().find((m) => m.t === t) ?? null;
  const KEY = 'llave-de-la-sala-1234';

  await say('host', { a: 'host', key: KEY, name: 'Colmillo <b>' });
  assert.deepEqual(lastOf('host', 'hosted'), { t: 'hosted', code: 'AAAA', name: 'Colmillo b' },
    'crear una sala da su código, y el nombre llega sin marcado');
  await say('host2', { a: 'host', key: KEY, name: 'Otra' });
  assert.equal(lastOf('host2', 'hosted').code, 'BBBB', 'un código repetido se vuelve a sortear');
  await say('spy', { a: 'host', key: 'corta' });
  assert.deepEqual(lastOf('spy', 'gone'), { t: 'gone', code: null }, 'sin una llave de verdad no hay sala');

  await say('other', { a: 'list' });
  assert.deepEqual(lastOf('other', 'rooms').rooms, [], 'una sala que todavía no contó nada no se lista');
  await say('host', { a: 'info', code: 'AAAA', info: { seats: { p1: true }, axies: { p1: 'beast', p2: '<img>' }, round: 'x' } });
  await say('other', { a: 'info', code: 'AAAA', info: { seats: { p1: false } } });
  await say('other', { a: 'list' });
  assert.deepEqual(lastOf('other', 'rooms').rooms, [{
    seats: { p1: true, p2: false }, ready: { p1: false, p2: false },
    axies: { p1: 'beast', p2: null }, playing: false, round: 0, code: 'AAAA', name: 'Colmillo b',
  }], 'la lista muestra lo que contó el anfitrión, recortado, y lo de otro no cuenta');

  await say('guest', { a: 'join', code: 'aaaa', id: 'celu' });
  assert.deepEqual(lastOf('host', 'join'), { t: 'join', peer: 'guest', id: 'celu' },
    'entrar le avisa al anfitrión quién llegó');
  await say('other', { a: 'join', code: 'ZZZZ', id: 'x' });
  assert.deepEqual(lastOf('other', 'gone'), { t: 'gone', code: 'ZZZZ' }, 'una sala que no existe, no');

  await say('guest', { a: 'act', code: 'AAAA', action: 'hit', arg: 3 });
  assert.deepEqual(lastOf('host', 'act'), { t: 'act', peer: 'guest', action: 'hit', arg: 3 },
    'lo que aprieta la pantalla le llega al anfitrión');
  const acts = got('host').length;
  await say('other', { a: 'act', code: 'AAAA', action: 'hit' });
  assert.equal(got('host').length, acts, 'de alguien que no entró, no llega nada');

  const m = { i: 0, of: 1, n: 1, z: 'H4sI' };
  await say('host', { a: 'to', code: 'AAAA', peer: 'guest', m });
  assert.deepEqual(lastOf('guest', 'msg'), { t: 'msg', m }, 'lo del anfitrión llega a la pantalla sin abrirse');
  const before = got('other').length;
  await say('host2', { a: 'to', code: 'AAAA', peer: 'guest', m: { ...m, n: 9 } });
  await say('host', { a: 'to', code: 'AAAA', peer: 'other', m });
  assert.equal(lastOf('guest', 'msg').m.n, 1, 'otro anfitrión no le escribe a una pantalla ajena');
  assert.equal(got('other').length, before, 'ni el anfitrión a quien no está en su sala');

  // El anfitrión se corta: las pantallas se enteran, y la sala deja de listarse.
  await relay.disconnect('host');
  assert.ok(lastOf('guest', 'down'), 'sin anfitrión, la pantalla se entera');
  await say('other', { a: 'list' });
  assert.deepEqual(lastOf('other', 'rooms').rooms, [], 'y la sala no se lista');
  await say('guest', { a: 'act', code: 'AAAA', action: 'hit' });

  // Vuelve con la llave: es otra vez el anfitrión y recupera a las pantallas.
  await say('spy', { a: 'host', code: 'AAAA', key: 'otra-llave-de-la-sala' });
  assert.deepEqual(lastOf('spy', 'gone'), { t: 'gone', code: 'AAAA' }, 'con otra llave no se roba una sala');
  alive.add('host-again');
  await say('host-again', { a: 'host', code: 'AAAA', key: KEY });
  assert.equal(lastOf('host-again', 'hosted').code, 'AAAA', 'con la suya, vuelve a ser el anfitrión');
  assert.deepEqual(lastOf('host-again', 'join'), { t: 'join', peer: 'guest', id: 'celu' },
    'y se entera de quién seguía adentro');

  // La pantalla se va: el anfitrión se entera.
  await relay.disconnect('guest');
  assert.deepEqual(lastOf('host-again', 'leave'), { t: 'leave', peer: 'guest' }, 'irse le avisa al anfitrión');

  // Una pantalla que se cortó sin avisar: al escribirle, se la saca.
  await say('other', { a: 'join', code: 'AAAA', id: 'tele' });
  alive.delete('other');
  await say('host-again', { a: 'to', code: 'AAAA', peer: 'other', m });
  assert.deepEqual(lastOf('host-again', 'leave'), { t: 'leave', peer: 'other' },
    'a quien ya no está se lo da por ido');

  // Cerrar la sala: las pantallas se enteran y no se puede volver.
  alive.add('guest');
  await say('guest', { a: 'join', code: 'AAAA', id: 'celu' });
  await say('host-again', { a: 'close', code: 'AAAA' });
  assert.ok(lastOf('guest', 'closed'), 'cerrar la sala avisa a los de adentro');
  await say('guest', { a: 'join', code: 'AAAA', id: 'celu' });
  assert.deepEqual(lastOf('guest', 'gone'), { t: 'gone', code: 'AAAA' }, 'y la sala ya no está');

  // Una sala sin noticias hace rato no se lista, aunque el anfitrión siga ahí.
  await say('host2', { a: 'info', code: 'BBBB', info: {} });
  clock += LISTED_FOR + 1;
  alive.add('late');
  await say('late', { a: 'list' });
  assert.deepEqual(lastOf('late', 'rooms').rooms, [], 'sin latidos, deja de listarse');
  await say('host2', { a: 'ping', code: 'BBBB' });
  await say('late', { a: 'list' });
  assert.equal(lastOf('late', 'rooms').rooms.length, 1, 'y un latido del anfitrión la vuelve a mostrar');

  await relay.message('late', 'no es JSON');
  await say('late', { a: '__proto__' });
  console.log('  ✓ el cartero: crear, listar, entrar, llevar y traer, cortes y cierre');
}

// ---- lo que va por el cable, empaquetado -------------------------------------
{
  const chico = await packMessage({ t: 'room', room: { code: 'AAAA' } });
  assert.equal(chico.length, 1, 'lo chico va en un solo pedazo');
  assert.ok('j' in chico[0], 'y sin comprimir');

  const estado = { t: 'state', state: { log: Array.from({ length: 400 }, (_, i) => `Robó la carta ${i}`) } };
  const [zip] = await packMessage(estado);
  assert.ok('z' in zip, 'lo grande va comprimido');
  assert.ok(zip.z.length < JSON.stringify(estado).length / 3, 'y ocupa bastante menos');

  // Lo que no se comprime —ruido— igual entra: en pedazos que pasan por API Gateway.
  const ruido = { t: 'state', state: { r: Array.from({ length: 12_000 }, () => Math.random().toString(36).slice(2)).join('') } };
  const partes = await packMessage(ruido);
  assert.ok(partes.length > 1, 'lo que no entra en un mensaje va en pedazos');
  assert.ok(partes.every((p) => JSON.stringify(p).length < 30_000), 'y cada pedazo entra en uno');
  assert.ok(partes.every((p, i) => p.i === i && p.of === partes.length), 'numerados');
  console.log('  ✓ los estados viajan comprimidos y, si hace falta, en pedazos');
}

// ---- el cable de verdad -----------------------------------------------------
//
// Lo de arriba prueba cada pieza; esto prueba la costura: el servidor de desarrollo
// levantado, `net.json` diciendo dónde está el cartero, y dos cables —anfitrión y
// pantalla— abiertos con `openLink` sobre WebSocket de verdad. Es lo que se rompe en
// silencio: cada pieza anda y la página se queda esperando.
{
  const { spawn } = await import('node:child_process');
  const PORT = 8137;
  const base = `http://127.0.0.1:${PORT}`;
  const server = spawn(process.execPath, ['scripts/dev.mjs'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  });
  const links = [];

  const wait = async (test, why) => {
    for (let i = 0; i < 200; i++) {
      if (test()) return;
      await new Promise((r) => setTimeout(r, 25));
    }
    assert.fail(why);
  };

  try {
    let config = null;
    for (let i = 0; i < 100 && !config; i++) {
      try {
        config = await (await fetch(`${base}/net.json`)).json();
      } catch {
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    assert.equal(config?.ws, '/net/ws', 'net.json dice dónde está el cartero');
    assert.ok(Array.isArray(config.urls), 'y con qué direcciones se llega desde la red');

    /** Un cable con lo que le va llegando. */
    const cable = () => {
      const got = [];
      const state = { open: false };
      const link = openLink(`ws://127.0.0.1:${PORT}/net/ws`, {
        onOpen: () => { state.open = true; },
        onClose: () => { state.open = false; },
        onMessage: (msg, n) => got.push({ msg, n }),
      });
      links.push(link);
      const last = (t) => [...got].reverse().find((g) => g.msg.t === t) ?? null;
      return { link, got, state, last };
    };

    const host = cable();
    const guest = cable();
    await wait(() => host.state.open && guest.state.open, 'los cables no abrieron');

    host.link.send({ a: 'host', key: 'una-llave-bien-larga-123', name: 'Marea' });
    await wait(() => host.last('hosted'), 'no se creó la sala');
    const { code } = host.last('hosted').msg;
    assert.match(code, /^[A-Z0-9]{4}$/, 'se crea una sala por WebSocket');
    host.link.send({ a: 'info', code, info: { seats: { p1: true } } });

    await new Promise((r) => setTimeout(r, 50));
    guest.link.send({ a: 'list' });
    await wait(() => guest.last('rooms'), 'no llegó la lista');
    assert.ok(guest.last('rooms').msg.rooms.some((r) => r.code === code), 'y aparece en la lista');

    guest.link.send({ a: 'join', code, id: 'celu' });
    await wait(() => host.last('join'), 'el anfitrión no se enteró de la entrada');
    const { peer } = host.last('join').msg;

    guest.link.send({ a: 'act', code, action: 'hit' });
    await wait(() => host.last('act'), 'la jugada no llegó al anfitrión');
    assert.equal(host.last('act').msg.action, 'hit');

    // Un estado que no entra en un mensaje: sale en pedazos y llega armado.
    const big = { t: 'state', state: { r: Array.from({ length: 12_000 }, () => Math.random().toString(36).slice(2)).join('') } };
    const parts = await packMessage(big);
    assert.ok(parts.length > 1);
    for (const m of parts.reverse()) host.link.send({ a: 'to', code, peer, m: { ...m, n: 7 } });
    await wait(() => guest.last('state'), 'el estado en pedazos no llegó');
    assert.equal(guest.last('state').n, 7, 'con su número de envío');
    assert.equal(guest.last('state').msg.state.r, big.state.r, 'y entero, aunque los pedazos lleguen al revés');

    host.link.send({ a: 'close', code });
    await wait(() => guest.last('closed'), 'cerrar la sala no le llegó a la pantalla');
    console.log('  ✓ el cable de verdad: net.json, crear, listar, entrar, jugar y cerrar');
  } finally {
    links.forEach((l) => l.close());
    server.kill();
  }
}

console.log('✓ salas en red ok');
