// El cliente de red, del lado de la pantalla.
//
// `net.test.js` prueba la sala, el cartero y el cable; este prueba lo otro: el lobby,
// la sala y que la pantalla se enganche como **un** jugador, de los dos lados — como
// pantalla que entra a la sala de otro, y como anfitrión que corre la suya. Es lo que
// no se puede ver corriendo el juego de a uno, porque de a uno la pantalla es de los dos.
import assert from 'node:assert/strict';
import { fakeDom } from './dom.mjs';

const nodes = fakeDom();
const idle = () => new Promise((r) => setTimeout(r, 0));
const settle = async (n = 12) => { for (let i = 0; i < n; i++) await idle(); };
/** Un click como el que manda el navegador, con el `closest` que mira el código. */
const click = (node, sel, dataset) => node.handlers.click({
  target: { closest: (q) => (q === sel ? { dataset } : null) },
});

globalThis.location = {
  search: '?red', pathname: '/', hostname: 'localhost', host: 'localhost:8000',
  protocol: 'http:', origin: 'http://localhost:8000',
};
globalThis.history = { replaceState() {} };
globalThis.fetch = async (url) => {
  if (url === 'net.json') {
    return { ok: true, json: async () => ({ ws: '/net/ws', urls: ['http://192.168.1.5:8000'] }) };
  }
  throw new Error(`nada que pedir a ${url}`);
};

/** Un WebSocket al que el test le abre, le escribe y le lee. */
class FakeWebSocket {
  constructor(url) {
    this.url = url;
    this.sent = [];
    this.bufferedAmount = 0;
    FakeWebSocket.last = this;
  }

  send(text) { this.sent.push(JSON.parse(text)); }
  close() { this.closed = true; }
  /** Lo que manda el cartero. */
  push(msg) { this.onmessage({ data: JSON.stringify(msg) }); }
  /** El último envío de una acción. */
  lastSent(a, pred = () => true) { return [...this.sent].reverse().find((b) => b.a === a && pred(b)) ?? null; }
}
globalThis.WebSocket = FakeWebSocket;

const { packMessage } = await import('../src/link.js');
/** Lo que manda un anfitrión, empaquetado como viaja de verdad y con su número. */
async function fromHost(ws, msg, n) {
  for (const m of await packMessage(msg)) ws.push({ t: 'msg', m: { ...m, n } });
  await settle(30);
}
/** Lo que el anfitrión de este test le mandó a una pantalla de afuera, desempaquetado. */
function toPeer(ws, peer) {
  return ws.sent.filter((b) => b.a === 'to' && b.peer === peer).map((b) => JSON.parse(b.m.j));
}

const SALA = {
  code: 'KJ7M', name: 'Colmillo', seats: { p1: true, p2: false },
  ready: { p1: false, p2: false }, axies: { p1: 'beast', p2: null },
  playing: false, round: 0,
};

// ---- estados de verdad, para empujarlos por el cable ------------------------
// Salen de una partida real y pasan por JSON, que es el viaje que hacen de verdad: si
// algo del estado no sobreviviera a serializarse, se rompe acá y no en el celular.
const { createGame } = await import('../src/game.js');
const wire = (s) => JSON.parse(JSON.stringify(s));
/** Una partida en la que abre `p1`, para que el turno de `p2` sea el segundo. */
function matchOpenedByP1() {
  for (let seed = 0; seed < 40; seed++) {
    const g = createGame({ pace: 0, seed });
    g.newMatch({ mode: 'net', axie: 'aquatic', axie2: 'plant' });
    if (g.state.order[0] === 'p1') return g;
  }
  throw new Error('ninguna semilla abrió con p1');
}
const source = matchOpenedByP1();
await settle();
const turnOfP1 = wire(source.state);
await source.stand();
await settle();
const draftOfP1 = wire(source.state);
await source.skipDraft();
await settle();
assert.equal(source.state.turn, 'p2', 'para probar el turno propio hace falta uno de p2');
const turnOfP2 = wire(source.state);

// ---- el lobby ---------------------------------------------------------------
// Con qué Axie entrás no se pregunta acá: se eligió en la portada y quedó anotado en
// el navegador (ver `loadout.js`). La sala lo lee de ahí.
localStorage.setItem('axie-chance:axie',
  JSON.stringify({ axie: 'beast', boosts: { 'beast+beast': 'beast' } }));

const { connect } = await import('../src/net.js');
/** Cuántas veces se pidió abrir la pantalla de elección de la portada. */
let elegidas = 0;
// El mezclador de la sala, escuchado: es el que arma `main.js` para que los botones de
// la sala suenen, y tiene que ser **el mismo** que después usa la mesa. Si la mesa se
// armara uno propio, nacería dormido en medio de la partida —el navegador solo enciende
// el audio con un gesto del jugador, y para cuando la partida empieza ya no hay ninguno
// por venir— y no se oiría nada hasta el primer clic.
const { createAudio } = await import('../src/audio.js');
const mixer = createAudio();
/** Los temas que la mesa pidió por este mezclador. */
const temas = [];
const playMusic = mixer.music;
mixer.music = (track) => { temas.push(track); return playMusic(track); };
const sala = connect({ chooseAxie: () => { elegidas++; }, audio: mixer });
await settle();

let ws = FakeWebSocket.last;
assert.equal(ws.url, 'ws://localhost:8000/net/ws', 'el cable va al cartero que dice net.json');
assert.equal(nodes.net.hidden, false, 'sin sala, el lobby tapa la mesa');
assert.equal(nodes['net-create'].disabled, true, 'sin cable todavía no se puede crear');

ws.onopen();
await settle();
assert.ok(ws.lastSent('list'), 'con el cable abierto, se pide la lista de salas');
assert.equal(nodes['net-create'].disabled, false, 'y ya se puede crear');

ws.push({ t: 'rooms', rooms: [SALA, { ...SALA, code: 'X<b>', name: '<img src=x onerror=alert(1)>' }] });
assert.equal(nodes['net-lobby'].hidden, false);
assert.equal(nodes['net-room'].hidden, true);
assert.match(nodes['net-title'].textContent, /Salas/);
// En la lista la barra vuelve a la portada, y la ficha es tuya: tu Axie —que se puede
// cambiar antes de crear, porque la sala se llama por él— y el botón de crear.
assert.equal(nodes['net-home'].hidden, false, 'en la lista se vuelve a la portada');
assert.equal(nodes['net-close'].hidden, true, 'y no hay sala de la que salir');
assert.equal(nodes['net-code'].hidden, true, 'ni código que dictar');
assert.equal(nodes.net.dataset.sheet, 'true', 'la ficha está');
assert.equal(nodes['net-axie'].hidden, false, 'con tu Axie, que se puede cambiar antes de crear');
assert.match(nodes['net-axie-now'].innerHTML, /Colmillo/);
assert.match(nodes['net-axie-art'].innerHTML, /class="axie/, 'y dibujado');
assert.equal(nodes['net-create'].hidden, false, 'con el botón de crear');
assert.equal(nodes['net-ready'].hidden, true, 'y sin el de listo, que es de adentro');
assert.match(nodes['net-rooms'].innerHTML, /data-sala="KJ7M"/, 'se listan las salas que hay');
assert.match(nodes['net-rooms'].innerHTML, /Sala de Colmillo/, 'con el nombre de quien la creó');
// El naipe de cada sala trae dibujado al Axie de quien la creó, y sus capas llevan su
// propio `onerror` (ver `axieArt`): lo que se busca es el del otro navegador.
assert.doesNotMatch(nodes['net-rooms'].innerHTML, /<img src=x|onerror=alert|X<b>/,
  'lo que cuenta otro navegador se dibuja sin marcado');
assert.match(nodes['net-list'].innerHTML, /192\.168\.1\.5:8000\/\?red/,
  'y con qué dirección entra el otro aparato de la red');
assert.match(nodes['net-rooms'].innerHTML, /class="room-no">1</, 'la sala lleva su número');
assert.match(nodes['net-rooms'].innerHTML, /room-go" data-watch="false">Entrar</,
  'con un asiento libre, se entra');
assert.match(nodes['net-rooms'].innerHTML, /room-seats[\s\S]*data-here="true"[\s\S]*beast-crest/,
  'y se ve con qué bicho está el que ya se sentó');
assert.equal(nodes.net.dataset.arena, 'beast', 'la sala se para sobre tu terreno');

// ---- una sala que ya no está -------------------------------------------------
click(nodes['net-rooms'], '[data-sala]', { sala: 'NOPE' });
ws.push({ t: 'gone', code: 'NOPE' });
assert.equal(nodes['net-lobby'].hidden, false, 'si la sala ya no está, se vuelve a la lista');
assert.match(nodes['net-note'].textContent, /ya no está/, 'y se dice por qué');

// ---- entrar a la sala de otro ------------------------------------------------
click(nodes['net-rooms'], '[data-sala]', { sala: 'KJ7M' });
const join = ws.lastSent('join');
assert.equal(join.code, 'KJ7M', 'entrar le pide la sala al cartero');
assert.equal(nodes['net-title'].textContent, 'Entrando…', 'y mientras contesta, se dice');

// En AWS cada mensaje despierta su propia Lambda, y el `room` que el anfitrión manda
// justo después del `hello` lo pasa por el cable la mitad de las veces. El `hello` es
// el único que dice cuál es tu asiento: llegue cuando llegue, se lee.
await fromHost(ws, { t: 'room', room: { ...SALA, seats: { p1: true, p2: true } } }, 2);
assert.doesNotMatch(nodes['net-seats'].innerHTML, /netbox-you/, 'sin el hello todavía no se sabe cuál sos');
await fromHost(ws, { t: 'hello', seat: 'p2', room: SALA }, 1);
assert.match(nodes['net-seats'].innerHTML, /netbox-you/, 'el hello que llega después del room igual da el asiento');
assert.equal(nodes['net-invite'].hidden, true, 'pero la sala que trae es más vieja: se queda la llena');
assert.equal(nodes['net-lobby'].hidden, true, 'el lobby se va');
assert.equal(nodes['net-room'].hidden, false, 'y queda la sala');
assert.match(nodes['net-title'].textContent, /Sala de Colmillo/);
assert.match(nodes['net-seats'].innerHTML, /Jugador 2/);
assert.match(nodes['net-seats'].innerHTML, /netbox-you/, 'se marca cuál de los dos sos');
assert.match(nodes['net-seats'].innerHTML, /data-here="true"[\s\S]*seat-vs[\s\S]*data-here="true"/,
  'los dos asientos, frente a frente');
assert.equal(nodes['net-home'].hidden, true, 'adentro, la barra ya no vuelve a la portada');
assert.equal(nodes['net-close'].hidden, false, 'sale de la sala');
assert.equal(nodes['net-code'].hidden, false, 'con el código a la vista');
assert.equal(nodes['net-code'].textContent, 'KJ7M');
assert.equal(nodes['net-create'].hidden, true, 'adentro no se crea otra');

// ---- la invitación ----------------------------------------------------------
// Con los dos sentados no hay a quién invitar. Con un asiento libre aparece el QR, y
// desde `localhost` apunta a la IP de la red: el celular no llega a `localhost`.
assert.equal(nodes['net-invite'].hidden, true, 'sala llena: sin QR');
await fromHost(ws, { t: 'room', room: SALA }, 3);
assert.equal(nodes['net-invite'].hidden, false, 'con un asiento libre, está el QR');
assert.equal(nodes['net-link'].textContent, 'http://192.168.1.5:8000/?red&sala=KJ7M');
assert.match(nodes['net-qr'].innerHTML, /^<svg[\s\S]*<path fill="#1b1008" d="M/, 'y el QR dibujado');
await fromHost(ws, { t: 'room', room: { ...SALA, seats: { p1: true, p2: true } } }, 4);
assert.equal(nodes['net-invite'].hidden, true, 'y se va cuando llega el otro');
// Por el cable los envíos pueden llegar desordenados: uno viejo no pisa lo nuevo.
await fromHost(ws, { t: 'room', room: SALA }, 2);
assert.equal(nodes['net-invite'].hidden, true, 'un envío más viejo que el último se tira');

// ---- con qué Axie entra cada uno --------------------------------------------
const acts = (action) => ws.sent.filter((b) => b.a === 'act' && b.action === action);
assert.equal(acts('loadout').length, 1, 'el Axie elegido se manda al sentarse');
assert.deepEqual(acts('loadout')[0].arg, { axie: 'beast', boosts: { 'beast+beast': 'beast' } },
  'y va con sus mejoras: lo que elegís es el mazo, no el dibujo');
assert.match(nodes['net-seats'].innerHTML, /Colmillo/, 'la sala muestra con qué Axie entra cada uno');
assert.match(nodes['net-seats'].innerHTML, /class="seat-art"><span class="axie"/,
  'el asiento ocupado dibuja su Axie');
assert.equal(nodes['net-axie'].hidden, false, 'con asiento, el botón de tu Axie está');
assert.match(nodes['net-axie-now'].innerHTML, /Colmillo/, 'y dice con cuál entrás');
nodes['net-axie'].handlers.click();
assert.equal(elegidas, 1, 'tocarlo abre la elección de la portada');

localStorage.setItem('axie-chance:axie', JSON.stringify({ axie: 'plant', boosts: {} }));
sala.axieChanged();
assert.deepEqual(acts('loadout').at(-1).arg, { axie: 'plant', boosts: {} }, 'el cambio se manda a la sala');
assert.match(nodes['net-axie-now'].innerHTML, /Brote/, 'y el botón dice con cuál entrás ahora');
assert.equal(nodes['net-ready'].hidden, false, 'con asiento, hay botón de listo');
assert.equal(nodes['net-ready'].textContent, 'Estoy listo');

// ---- listo ------------------------------------------------------------------
nodes['net-ready'].handlers.click();
await settle();
assert.equal(acts('ready').at(-1).code, 'KJ7M', 'el listo se manda a la sala en que estás');

await fromHost(ws, { t: 'room', room: { ...SALA, seats: { p1: true, p2: true }, ready: { p1: false, p2: true } } }, 5);
assert.equal(nodes['net-ready'].textContent, 'Ya no', 'el botón se puede desdecir');
assert.match(nodes['net-note'].textContent, /Esperando/, 'y se espera al otro');
assert.equal(nodes.net.hidden, false, 'con uno solo listo no empieza nada');

// ---- el turno del otro: se ve, no se toca -----------------------------------
await fromHost(ws, { t: 'state', state: turnOfP1 }, 5);

assert.equal(nodes.net.hidden, true, 'con partida, el cartel se va');
assert.ok(nodes.field.innerHTML.length > 0, 'y la mesa se pintó');
assert.ok(temas.includes('battle'),
  'la mesa suena por el mezclador de la sala, que es el que el jugador ya encendió');
assert.equal(nodes['fighter-p2'].dataset.side, 'left', 'tu bicho, de este lado');
assert.equal(nodes['fighter-p1'].dataset.side, 'right', 'el del otro, enfrente');
assert.match(nodes['plate-p2'].innerHTML, /Vos/, 'tu chapa dice Vos');
assert.match(nodes['plate-p1'].innerHTML, /J1/, 'y la del otro, quién es');
assert.doesNotMatch(nodes.controls.innerHTML, /data-action="hit"/,
  'en el turno del otro no hay botones que apretar');
assert.match(nodes.odds.innerHTML, /odds-dial/, 'pero sí la probabilidad del mazo ajeno: es información pública');

// ---- tu turno ---------------------------------------------------------------
await fromHost(ws, { t: 'state', state: turnOfP2 }, 6);
assert.match(nodes.controls.innerHTML, /data-action="hit"/, 'en el tuyo sí');
assert.match(nodes.controls.innerHTML, /data-action="stand"/);
assert.match(nodes.odds.innerHTML, /odds-dial/, 'con el medidor de tu propia próxima carta');
assert.equal(nodes['deck-label'].textContent, 'Tu mazo', 'el panel del mazo es siempre el tuyo');
await fromHost(ws, { t: 'state', state: turnOfP1 }, 5);
assert.match(nodes.controls.innerHTML, /data-action="hit"/, 'un estado viejo que llega tarde no vuelve atrás');

// ---- apretar manda, y no adivina --------------------------------------------
const cardsBefore = turnOfP2.chains.p2.cards.length;
click(nodes.controls, '[data-action]', { action: 'hit' });
await settle();
assert.equal(acts('hit').at(-1).code, 'KJ7M', 'robar se manda a la sala');
assert.equal(turnOfP2.chains.p2.cards.length, cardsBefore,
  'y la pantalla no se adelanta: lo que vale es el estado que vuelva');

// ---- lo que decide el otro, lo decide el otro --------------------------------
// El Free Game del rival: la carta que espera se ve, pero las columnas no se tocan.
const stackOfP1 = wire(turnOfP1);
stackOfP1.freeGame.p1 = true;
stackOfP1.pendingStack = { player: 'p1', card: stackOfP1.chains.p1.cards[0] };
await fromHost(ws, { t: 'state', state: stackOfP1 }, 7);
assert.match(nodes.field.innerHTML, /tetris-dock/, 'la carta del Free Game del otro se ve');
assert.match(nodes.field.innerHTML, /elige la columna/, 'y se dice que la elige él');
assert.doesNotMatch(nodes.field.innerHTML, /data-stack-col/, 'pero no hay columnas que tocar');
const stacksBefore = acts('chooseStackTarget').length;
nodes.field.handlers.click({ target: { closest: (q) => (q === '#tetris-floating-card, .tetris-dock' ? {} : null) } });
nodes.controls.handlers.click({ target: { closest: () => ({ dataset: { action: 'hit' } }) } });
await settle();
assert.equal(acts('chooseStackTarget').length, stacksBefore, 'ni tocar la carta ni robar le eligen la columna');

// El centro del rival: se mira, sin botones.
assert.equal(draftOfP1.phase, 'draft', 'para probar el centro ajeno hace falta un reparto de p1');
await fromHost(ws, { t: 'state', state: draftOfP1 }, 8);
assert.match(nodes.market.innerHTML, /market-card/, 'el centro del otro se ve');
assert.doesNotMatch(nodes.market.innerHTML, /data-action="(skip|renew)"/, 'pero sin botones');
assert.doesNotMatch(nodes.market.innerHTML, /market-card[^>]*data-uid="\d+"(?![^>]*disabled)/,
  'y sus cartas no se pueden agarrar');
assert.match(nodes.market.innerHTML, /está eligiendo del centro/, 'el cartel dice que elige el otro');

// ---- el id es de la pantalla, no del navegador -------------------------------
// Dos ventanas del mismo navegador son dos jugadores: es la única manera de probar una
// sala con una sola máquina.
const ID_KEY = 'axie-chance:cliente';
assert.equal(join.id, sessionStorage.getItem(ID_KEY),
  'se entra con el id de esta pantalla, el que guarda el sessionStorage');
assert.equal(localStorage.getItem(ID_KEY), null,
  'y no con uno del navegador entero, que sería el mismo en las dos ventanas');
assert.ok(Object.keys(JSON.parse(localStorage.getItem('axie-chance:pantallas'))).includes(join.id),
  'esta pantalla queda anotada como abierta');

// ---- si se cae el anfitrión, se dice -----------------------------------------
ws.push({ t: 'down' });
assert.equal(nodes.net.hidden, false, 'sin anfitrión, el cartel vuelve');
assert.match(nodes['net-title'].textContent, /cortó/);
assert.match(nodes['net-note'].textContent, /vuelva quien creó la sala/, 'y se dice a quién se espera');
assert.equal(nodes['net-close'].hidden, false, 'con el cable cortado la cruz sigue puesta');
await fromHost(ws, { t: 'state', state: turnOfP2 }, 9);
assert.equal(nodes.net.hidden, true, 'y cuando vuelve, se sigue jugando');

// Y si se corta el cable propio, también, y se reconecta solo.
ws.onclose();
assert.equal(nodes.net.hidden, false, 'sin conexión, el cartel vuelve');
assert.match(nodes['net-title'].textContent, /cortó/);
ws.onopen();
assert.equal(nodes.net.hidden, false, 'lo que diga el socket viejo ya no cuenta');
await new Promise((r) => setTimeout(r, 900));
const ws2 = FakeWebSocket.last;
assert.notEqual(ws2, ws, 'el cable se vuelve a abrir solo');
ws2.onopen();
assert.equal(ws2.lastSent('join').code, 'KJ7M', 'y al volver, se vuelve a entrar a la sala');
await fromHost(ws2, { t: 'state', state: turnOfP2 }, 1);
assert.equal(nodes.net.hidden, true, 'con la numeración de nuevo desde la entrada');
ws = ws2;

// ---- abandonar ---------------------------------------------------------------
{
  assert.equal(nodes['menu-btn'].hidden, false, 'con partida y asiento, se puede abandonar');
  nodes['menu-btn'].handlers.click();
  assert.equal(nodes['quit-modal'].open, true, 'abandonar pregunta antes');
  assert.match(nodes['quit-note'].innerHTML, /gana el otro/, 'y avisa que el que se queda gana');

  const before = ws.sent.length;
  nodes['quit-modal'].returnValue = 'stay';
  nodes['quit-modal'].handlers.close();
  await settle();
  assert.equal(ws.sent.length, before, 'arrepentirse no manda nada');

  nodes['menu-btn'].handlers.click();
  nodes['quit-modal'].returnValue = 'quit';
  nodes['quit-modal'].handlers.close();
  await settle();
  assert.ok(acts('leave').length, 'confirmar se lo avisa a la sala');
  assert.equal(location.href, '/?red', 'y después vuelve a la lista de salas');

  // Del otro lado: la partida que le llega al que se quedó.
  const gone = matchOpenedByP1();
  await settle();
  gone.forfeit('p1');
  await fromHost(ws, { t: 'state', state: wire(gone.state) }, 2);
  assert.equal(nodes.result.dataset.outcome, 'win', 'el que se queda gana');
  assert.match(nodes.result.innerHTML, /¡Victoria!/, 'irse le regala la partida al otro');
  assert.match(nodes.result.innerHTML, /Jugador 1 abandonó/, 'y se dice quién se fue');
  assert.match(nodes.result.innerHTML, /data-action="leave"/, 'la salida es volver a las salas');
  assert.doesNotMatch(nodes.result.innerHTML, /data-action="restart"/,
    'sin "Jugar de nuevo": enfrente no queda nadie');
  assert.equal(nodes['menu-btn'].hidden, true, 'terminada, no hay nada que abandonar');

  // Que después se cierre la sala no tapa el final: ahí se lee cómo terminó.
  ws.push({ t: 'closed' });
  assert.equal(nodes.net.hidden, true, 'con la partida terminada, el cierre no tapa nada');
  console.log('  ✓ abandonar pregunta, avisa a la sala y el que se queda ve por qué terminó');
}
console.log('  ✓ lobby, sala, listo y partida');

// ---- la cruz de la esquina sale a la lista ------------------------------------
{
  nodes['net-close'].handlers.click();
  await settle();
  assert.equal(nodes['net-lobby'].hidden, false, 'la cruz vuelve a la lista de salas');
  assert.equal(nodes['net-room'].hidden, true);
  assert.equal(nodes['net-close'].hidden, true, 'y en la lista la cruz no está');
  ws.push({ t: 'rooms', rooms: [SALA] });
  assert.match(nodes['net-rooms'].innerHTML, /data-sala="KJ7M"/, 'con las salas que hay');
  console.log('  ✓ la cruz de la esquina sale de la sala a la lista');
}

// ---- tu propia sala: la partida corre acá -------------------------------------
// Crear una sala te hace anfitrión: la sala corre en este navegador (ver `rooms.js`),
// tu pantalla se engancha sin cable, y a las de afuera les llega lo suyo por el cartero.
{
  const mia = connect({ chooseAxie: () => {} });
  await settle();
  const hostWs = FakeWebSocket.last;
  hostWs.onopen();
  await settle();

  nodes['net-create'].handlers.click();
  const pedido = hostWs.lastSent('host');
  assert.ok(pedido, 'crear le pide una sala al cartero');
  assert.ok(pedido.key.length >= 16, 'con una llave para volver a ser su anfitrión si se corta');
  assert.equal(pedido.name, 'Brote', 'y el nombre de tu Axie');

  hostWs.push({ t: 'hosted', code: 'ZX9P', name: 'Brote' });
  await settle();
  assert.equal(nodes['net-room'].hidden, false, 'con el código, estás adentro de tu sala');
  assert.match(nodes['net-title'].textContent, /Sala de Brote/);
  assert.match(nodes['net-seats'].innerHTML, /netbox-you/, 'sentado, sin pasar por el cable');
  assert.deepEqual(hostWs.lastSent('info').info.seats, { p1: true, p2: false },
    'y la sala le cuenta al cartero cómo está, para la lista');
  assert.equal(nodes['net-invite'].hidden, false, 'con el QR para invitar');
  assert.equal(nodes['net-link'].textContent, 'http://192.168.1.5:8000/?red&sala=ZX9P');

  // Entra alguien de afuera.
  hostWs.push({ t: 'join', peer: 'peer-1', id: 'celu' });
  await settle(30);
  const hello = toPeer(hostWs, 'peer-1').find((m) => m.t === 'hello');
  assert.equal(hello?.seat, 'p2', 'la pantalla de afuera recibe su asiento por el cartero');
  const numbers = hostWs.sent.filter((b) => b.a === 'to').map((b) => b.m.n);
  assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b), 'con los envíos numerados en orden');
  assert.deepEqual(hostWs.lastSent('info').info.seats, { p1: true, p2: true }, 'la lista ve la sala llena');
  assert.equal(nodes['net-invite'].hidden, true, 'y el QR se va');

  // Lo que aprieta la pantalla de afuera le llega a la sala.
  hostWs.push({ t: 'act', peer: 'peer-1', action: 'ready' });
  await settle(30);
  assert.equal(hostWs.lastSent('info').info.ready.p2, true, 'el listo de afuera cuenta en la sala');
  assert.match(nodes['net-seats'].innerHTML, /data-ready="true"/, 'y tu pantalla lo ve');
  hostWs.push({ t: 'act', peer: 'intruso', action: 'ready' });
  await settle();
  assert.equal(hostWs.lastSent('info').info.ready.p1, false, 'de quien no entró, nada');

  // Se va: el asiento se le guarda un rato (la recarga), y cerrar la sala suelta todo.
  hostWs.push({ t: 'leave', peer: 'peer-1' });
  nodes['net-close'].handlers.click();
  await settle(30);
  assert.equal(hostWs.lastSent('close')?.code, 'ZX9P', 'salir de tu sala la cierra para todos');
  assert.equal(nodes['net-lobby'].hidden, false, 'y volvés a la lista');
  void mia;
  console.log('  ✓ tu propia sala: corre acá, invita con QR y atiende a las pantallas de afuera');
}

// ---- las salas en la misma página que la portada ------------------------------
// Con la mesa de la página (`table`), la sala no monta otra: sienta la de la página
// frente a su partida, y al irse la devuelve y vuelve a la lista sin recargar. "Volver"
// desde la lista guarda la pantalla, cierra el cable y le devuelve la página a la
// portada. Así la música de los menús no se corta nunca.
{
  const sentadas = [];
  let devueltas = 0;
  let salidas = 0;
  const table = { attach: (_g, opts) => sentadas.push(opts), detach: () => { devueltas++; } };
  const red = connect({ chooseAxie: () => {}, table, onExit: () => { salidas++; } });
  await settle();
  const cable = FakeWebSocket.last;
  cable.onopen();
  await settle();
  click(nodes['net-rooms'], '[data-sala]', { sala: 'KJ7M' });
  await fromHost(cable, { t: 'hello', seat: 'p2', room: { ...SALA, seats: { p1: true, p2: true } } }, 1);
  await fromHost(cable, { t: 'state', state: turnOfP1 }, 2);
  assert.equal(sentadas.length, 1, 'la partida sienta a la mesa de la página');
  assert.equal(sentadas[0].seat, 'p2', 'con tu asiento');
  assert.equal(sentadas[0].net, true);
  assert.equal(nodes.net.hidden, true, 'y la sala se guarda mientras se juega');

  await sentadas[0].leave();
  assert.ok(cable.lastSent('act', (b) => b.action === 'leave'), 'irse se le avisa a la sala');
  assert.equal(devueltas, 1, 'la mesa vuelve a la partida de la página');
  assert.equal(nodes.net.hidden, false, 'y se vuelve a la lista, sin recargar');
  assert.equal(nodes['net-lobby'].hidden, false);

  let evitado = false;
  nodes['net-home'].handlers.click({ preventDefault() { evitado = true; } });
  assert.ok(evitado, '"Volver" no navega: la portada está en esta misma página');
  assert.equal(salidas, 1, 'se la devuelve a la portada');
  assert.equal(nodes.net.hidden, true, 'la sala se guarda');
  assert.equal(cable.closed, true, 'y cierra el cable: en la portada no se mira ninguna lista');

  red.show();
  await settle();
  assert.notEqual(FakeWebSocket.last, cable, 'volver a las salas abre un cable nuevo');
  assert.equal(nodes.net.hidden, false);
  console.log('  ✓ las salas en la misma página: la mesa se sienta y se levanta sin recargar');
}

// ---- el que llega tarde mira -------------------------------------------------
{
  const { mount } = await import('../src/ui.js');
  const watched = matchOpenedByP1();
  await settle();
  assert.equal(watched.state.turn, 'p1', 'hay un turno en curso que mirar');

  mount(watched, { seat: null, net: true });
  assert.ok(nodes.field.innerHTML.length > 0, 'el mirón ve la mesa');
  assert.doesNotMatch(nodes.controls.innerHTML, /data-action="hit"/,
    'pero no le tocan los botones de nadie');
  assert.match(nodes.odds.innerHTML, /odds-dial/, 'pero el medidor de quien juega sí, que es información pública');
  assert.doesNotMatch(nodes['plate-p1'].innerHTML, /Vos/, 'ninguna chapa dice Vos');
  assert.doesNotMatch(nodes['plate-p2'].innerHTML, /Vos/);
  console.log('  ✓ el que entra con los dos asientos ocupados, mira');
}

// ---- de quién es cada id -----------------------------------------------------
{
  const { idForScreen, relayUrl } = await import('../src/net.js');
  const now = 1_000_000;
  const nuevo = () => 'acuñado';

  assert.equal(idForScreen('mio', {}, now, nuevo), 'mio',
    'un F5 vuelve con el mismo id, y con él al mismo asiento');
  assert.equal(idForScreen(null, {}, now, nuevo), 'acuñado',
    'una ventana nueva es alguien nuevo');
  assert.equal(idForScreen('mio', { mio: now - 1000 }, now, nuevo), 'acuñado',
    'si otra pantalla abierta ya usa ese id, esta es una copia y se acuña otro');
  assert.equal(idForScreen('mio', { mio: now - 60_000 }, now, nuevo), 'mio',
    'una firma vieja no cuenta: esa pantalla se fue sin borrarla');
  console.log('  ✓ el id es de la pantalla: dos ventanas, dos jugadores');

  assert.equal(relayUrl('wss://abc.execute-api.us-east-1.amazonaws.com/net'),
    'wss://abc.execute-api.us-east-1.amazonaws.com/net', 'publicado, el cartero de AWS tal cual');
  assert.equal(relayUrl('/net/ws', { protocol: 'https:', host: 'juego.com' }), 'wss://juego.com/net/ws',
    'en el mismo servidor, seguro si la página es segura');
  assert.equal(relayUrl('/net/ws', { protocol: 'http:', host: '192.168.1.5:8000' }), 'ws://192.168.1.5:8000/net/ws');
  console.log('  ✓ dónde está el cartero, según dónde corre el juego');
}

console.log('✓ cliente de red ok');
