// El cliente de red, del lado de la pantalla.
//
// `net.test.js` prueba el servidor; este prueba lo otro: el lobby, la sala y que la
// pantalla se enganche como **un** jugador. Es lo que no se puede ver corriendo el
// juego de a uno, porque de a uno la pantalla es de los dos.
import assert from 'node:assert/strict';
import { fakeDom } from './dom.mjs';

const nodes = fakeDom();
const idle = () => new Promise((r) => setTimeout(r, 0));
const settle = async (n = 12) => { for (let i = 0; i < n; i++) await idle(); };
/** Un click como el que manda el navegador, con el `closest` que mira el código. */
const click = (node, sel, dataset) => node.handlers.click({
  target: { closest: (q) => (q === sel ? { dataset } : null) },
});

globalThis.location = { search: '?red', pathname: '/' };
globalThis.history = { replaceState() {} };

/** Un EventSource al que los mensajes se los empuja el test. */
class FakeEventSource {
  constructor(url) {
    this.url = url;
    FakeEventSource.last = this;
  }

  send(msg) { this.onmessage({ data: JSON.stringify(msg) }); }
  close() { this.closed = true; }
}
globalThis.EventSource = FakeEventSource;

const SALA = {
  code: 'KJ7M', name: 'Sala 1', seats: { p1: true, p2: false },
  ready: { p1: false, p2: false }, axies: { p1: 'beast', p2: null },
  playing: false, round: 0,
};
const posted = [];
globalThis.fetch = async (url, opts) => {
  if (url === '/net/hello') return { ok: true, json: async () => ({ net: true, urls: ['http://192.168.1.5:8000'] }) };
  if (url === '/net/rooms' && opts?.method === 'POST') {
    return { ok: true, json: async () => ({ room: SALA }) };
  }
  if (url === '/net/rooms') {
    return { ok: true, json: async () => ({ rooms: [SALA], urls: ['http://192.168.1.5:8000'] }) };
  }
  posted.push(JSON.parse(opts.body));
  return { ok: true, json: async () => ({ sent: true }) };
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
await source.skipDraft();
await settle();
assert.equal(source.state.turn, 'p2', 'para probar el turno propio hace falta uno de p2');
const turnOfP2 = wire(source.state);

// ---- el lobby ---------------------------------------------------------------
// Con qué Axie entrás no se pregunta acá: se eligió en la portada y quedó anotado en
// el navegador, que es lo único que cruza la recarga con la que se entra a `?red`
// (ver `loadout.js`). La sala lo lee de ahí.
localStorage.setItem('axie-chance:axie',
  JSON.stringify({ axie: 'beast', boosts: { 'beast+beast': 'beast' } }));

const { connect } = await import('../src/net.js');
/** Cuántas veces se pidió abrir la pantalla de elección de la portada. */
let elegidas = 0;
const sala = connect({ chooseAxie: () => { elegidas++; } });
await settle();

assert.equal(nodes.net.hidden, false, 'sin sala, el lobby tapa la mesa');
assert.equal(nodes['net-lobby'].hidden, false);
assert.equal(nodes['net-room'].hidden, true);
assert.match(nodes['net-title'].textContent, /Salas/);
assert.match(nodes['net-rooms'].innerHTML, /data-sala="KJ7M"/, 'se listan las salas que hay');
assert.match(nodes['net-rooms'].innerHTML, /Sala 1/);
assert.match(nodes['net-list'].innerHTML, /192\.168\.1\.5:8000\/\?red/,
  'y con qué dirección entra el otro aparato');

// Cada sala es un renglón del Origins: su número, su nombre, un hueco por asiento con
// el crest del que ya está sentado, y qué pasa si la tocás. Lo último es lo que
// importa: con los dos asientos ocupados se entra igual, pero a mirar, y eso se dice
// **antes** de tocar (ver `roomsHtml`).
assert.match(nodes['net-rooms'].innerHTML, /class="room-no">1</, 'la sala lleva su número');
assert.match(nodes['net-rooms'].innerHTML, /room-go" data-watch="false">Entrar</,
  'con un asiento libre, se entra');
assert.match(nodes['net-rooms'].innerHTML, /room-seats[\s\S]*data-here="true"[\s\S]*beast-crest/,
  'y se ve con qué bicho está el que ya se sentó');
// El terreno de la pantalla es el del Axie que tenés puesto, igual que en la portada:
// la sala es una pantalla del juego y no un cartel encima de una mesa vacía.
assert.equal(nodes.net.dataset.arena, 'beast', 'la sala se para sobre tu terreno');

// ---- crear una sala y sentarse ----------------------------------------------
nodes['net-create'].handlers.click();
await settle();
const es = FakeEventSource.last;
assert.match(es.url, /^\/net\/stream\?id=.*&sala=KJ7M$/, 'el stream se abre contra esa sala');

es.onopen();
es.send({ t: 'hello', seat: 'p2', room: { ...SALA, seats: { p1: true, p2: true } } });
await settle();

assert.equal(nodes['net-lobby'].hidden, true, 'el lobby se va');
assert.equal(nodes['net-room'].hidden, false, 'y queda la sala');
assert.match(nodes['net-title'].textContent, /Sala 1/);
assert.match(nodes['net-seats'].innerHTML, /Jugador 2/);
assert.match(nodes['net-seats'].innerHTML, /netbox-you/, 'se marca cuál de los dos sos');

// ---- con qué Axie entra cada uno --------------------------------------------
// Al sentarse, la pantalla le cuenta a la sala con qué bicho viene: es lo que la sala
// va a repartir cuando los dos digan que están listos, y llega antes que la partida.
const dicho = posted.filter((p) => p.action === 'loadout');
assert.equal(dicho.length, 1, 'el Axie elegido se manda al sentarse');
assert.deepEqual(dicho[0].arg, { axie: 'beast', boosts: { 'beast+beast': 'beast' } },
  'y va con sus mejoras: lo que elegís es el mazo, no el dibujo');
assert.match(nodes['net-seats'].innerHTML, /Colmillo/,
  'la sala muestra con qué Axie entra cada uno');
// Y lo muestra dibujado: el mismo muñeco de la mesa, que es la primera vez que se ve al
// rival. El asiento que todavía no tiene a nadie muestra su número en el aro tallado.
assert.match(nodes['net-seats'].innerHTML, /class="seat-art"><span class="axie"/,
  'el asiento ocupado dibuja su Axie');
// La elección es una sola en todo el juego —la de la portada— y desde acá se abre esa
// misma pantalla: en la barra de la mesa no hay ningún roster que la repita.
assert.equal(nodes['net-axie'].hidden, false, 'con asiento, el botón de tu Axie está');
assert.match(nodes['net-axie-now'].innerHTML, /Colmillo/, 'y dice con cuál entrás');
nodes['net-axie'].handlers.click();
assert.equal(elegidas, 1, 'tocarlo abre la elección de la portada');

// Elegir otro se le cuenta a la sala en el acto: todavía no repartió nada.
localStorage.setItem('axie-chance:axie', JSON.stringify({ axie: 'plant', boosts: {} }));
sala.axieChanged();
assert.equal(posted.at(-1).action, 'loadout', 'el cambio se manda a la sala');
assert.deepEqual(posted.at(-1).arg, { axie: 'plant', boosts: {} });
assert.match(nodes['net-axie-now'].innerHTML, /Brote/, 'y el botón dice con cuál entrás ahora');
assert.equal(nodes['net-ready'].hidden, false, 'con asiento, hay botón de listo');
assert.equal(nodes['net-ready'].textContent, 'Estoy listo');

// ---- listo ------------------------------------------------------------------
nodes['net-ready'].handlers.click();
await settle();
assert.equal(posted.at(-1).action, 'ready', 'el listo se manda al servidor');
assert.equal(posted.at(-1).sala, 'KJ7M', 'con la sala en que estás');

es.send({ t: 'room', room: { ...SALA, seats: { p1: true, p2: true }, ready: { p1: false, p2: true } } });
assert.equal(nodes['net-ready'].textContent, 'Ya no', 'el botón se puede desdecir');
assert.match(nodes['net-note'].textContent, /Esperando/, 'y se espera al otro');
assert.equal(nodes.net.hidden, false, 'con uno solo listo no empieza nada');

// ---- el turno del otro: se ve, no se toca -----------------------------------
es.send({ t: 'state', state: turnOfP1 });
await settle();

assert.equal(nodes.net.hidden, true, 'con partida, el cartel se va');
assert.ok(nodes.field.innerHTML.length > 0, 'y la mesa se pintó');
// Cada uno se ve a sí mismo a la izquierda: acá el de la izquierda es p2.
assert.equal(nodes['fighter-p2'].dataset.side, 'left', 'tu bicho, de este lado');
assert.equal(nodes['fighter-p1'].dataset.side, 'right', 'el del otro, enfrente');
assert.match(nodes['plate-p2'].innerHTML, /Vos/, 'tu chapa dice Vos');
assert.match(nodes['plate-p1'].innerHTML, /J1/, 'y la del otro, quién es');

assert.doesNotMatch(nodes.controls.innerHTML, /data-action="hit"/,
  'en el turno del otro no hay botones que apretar');
assert.match(nodes.controls.innerHTML, /Jugador 1 ·/, 'el cartel dice de quién es el turno');
assert.equal(nodes.odds.innerHTML, '', 'ni se te muestra la probabilidad del mazo ajeno');

// ---- tu turno ---------------------------------------------------------------
es.send({ t: 'state', state: turnOfP2 });
await settle();

assert.match(nodes.controls.innerHTML, /data-action="hit"/, 'en el tuyo sí');
assert.match(nodes.controls.innerHTML, /data-action="stand"/);
// Y en el tuyo el renglón se calla: con los botones puestos no hace falta que nadie
// avise de quién es el turno, y lo que decía antes —los símbolos que siguen vivos— ya
// está dibujado en la cadena.
assert.match(nodes.controls.innerHTML, /class="controls-msg"><\/span>/,
  'en tu propio turno el renglón no dice nada: hablan los botones');
assert.match(nodes.odds.innerHTML, /odds-dial/, 'con el medidor de tu propia próxima carta');
assert.equal(nodes['deck-label'].textContent, 'Tu mazo', 'el panel del mazo es siempre el tuyo');

// ---- apretar manda, y no adivina --------------------------------------------
const cardsBefore = turnOfP2.chains.p2.cards.length;
click(nodes.controls, '[data-action]', { action: 'hit' });
await settle();
assert.equal(posted.at(-1).action, 'hit', 'robar se manda al servidor');
assert.ok(posted.at(-1).id, 'firmado con el id de este navegador');
assert.equal(turnOfP2.chains.p2.cards.length, cardsBefore,
  'y la pantalla no se adelanta: lo que vale es el estado que vuelva');

// ---- el id es de la pantalla, no del navegador -------------------------------
// Dos ventanas del mismo navegador son dos jugadores: es la única manera de probar una
// sala con una sola máquina. Con el id en el `localStorage` las dos mandaban el mismo,
// el servidor le daba a las dos el asiento del Jugador 1, el segundo no se ocupaba
// nunca y la partida no arrancaba — la sala se quedaba esperando para siempre.
const ID_KEY = 'axie-chance:cliente';
assert.equal(posted.at(-1).id, sessionStorage.getItem(ID_KEY),
  'se firma con el id de esta pantalla, el que guarda el sessionStorage');
assert.equal(localStorage.getItem(ID_KEY), null,
  'y no con uno del navegador entero, que sería el mismo en las dos ventanas');
// Lo que sí es del navegador entero es el registro de las pantallas abiertas, que es
// contra lo que se defiende una pestaña duplicada (le copian el sessionStorage).
assert.ok(
  Object.keys(JSON.parse(localStorage.getItem('axie-chance:pantallas'))).includes(posted.at(-1).id),
  'esta pantalla queda anotada como abierta',
);

// ---- abandonar ---------------------------------------------------------------
// Con la partida andando y un asiento propio, el menú de las tres rayitas tiene la
// puerta. Pregunta antes, y dice qué va a pasar: en la primera ronda, que se anula.
{
  assert.equal(nodes['menu-btn'].hidden, false, 'con partida y asiento, se puede abandonar');
  nodes['menu-btn'].handlers.click();
  assert.equal(nodes['quit-modal'].open, true, 'abandonar pregunta antes');
  assert.match(nodes['quit-note'].innerHTML, /se anula/, 'y avisa que en la primera ronda no gana nadie');

  const before = posted.length;
  nodes['quit-modal'].returnValue = 'stay';
  nodes['quit-modal'].handlers.close();
  await settle();
  assert.equal(posted.length, before, 'arrepentirse no manda nada');

  nodes['menu-btn'].handlers.click();
  nodes['quit-modal'].returnValue = 'quit';
  nodes['quit-modal'].handlers.close();
  await settle();
  assert.equal(posted.at(-1).action, 'leave', 'confirmar se lo avisa a la sala');
  assert.equal(location.href, '/?red', 'y después vuelve a la lista de salas');

  // Del otro lado: la partida que le llega al que se quedó.
  const gone = matchOpenedByP1();
  await settle();
  gone.forfeit('p1');
  es.send({ t: 'state', state: wire(gone.state) });
  await settle();
  assert.match(nodes.finale.innerHTML, /Partida anulada/, 'anulada no es perder');
  assert.match(nodes.finale.innerHTML, /Jugador 1 abandonó/, 'y se dice quién se fue');
  assert.match(nodes.controls.innerHTML, /data-action="leave"/, 'la salida es volver a las salas');
  assert.doesNotMatch(nodes.controls.innerHTML, /data-action="restart"/,
    'sin "Jugar de nuevo": enfrente no queda nadie');
  assert.equal(nodes['menu-btn'].hidden, true, 'terminada, no hay nada que abandonar');
  console.log('  ✓ abandonar pregunta, avisa a la sala y el que se queda ve por qué terminó');
}

// ---- si se cae el cable, se dice ---------------------------------------------
es.onerror();
assert.equal(nodes.net.hidden, false, 'sin conexión, el cartel vuelve');
assert.match(nodes['net-title'].textContent, /cortó/);
// Y con el cable cortado la puerta sigue puesta, que es justo cuando uno quiere salir.
assert.equal(nodes['net-close'].hidden, false, 'adentro de una sala hay cruz para salir');

console.log('  ✓ lobby, sala, listo y partida');

// ---- la cruz de la esquina sale a la lista ------------------------------------
// Es la única puerta de la sala: atrás está la lista de salas, que es de donde se vino.
// En la lista no hay nada que cerrar y por eso ahí no está.
{
  nodes['net-close'].handlers.click();
  await settle();
  assert.equal(nodes['net-lobby'].hidden, false, 'la cruz vuelve a la lista de salas');
  assert.equal(nodes['net-room'].hidden, true);
  assert.equal(nodes['net-close'].hidden, true, 'y en la lista la cruz no está');
  assert.match(nodes['net-rooms'].innerHTML, /data-sala="KJ7M"/, 'con las salas que hay');
  console.log('  ✓ la cruz de la esquina sale de la sala a la lista');
}

// ---- el que llega tarde mira -------------------------------------------------
// Con los dos asientos ocupados se entra igual y se ve todo, pero sin asiento no hay
// nada que apretar. Es el caso que un `seat` en null solo no distingue —una pantalla
// sin asiento es la compartida, que sí tiene los botones de los dos— y por eso la
// partida en red se marca aparte.
{
  const { mount } = await import('../src/ui.js');
  const watched = matchOpenedByP1();
  await settle();
  assert.equal(watched.state.turn, 'p1', 'hay un turno en curso que mirar');

  mount(watched, { seat: null, net: true });
  assert.ok(nodes.field.innerHTML.length > 0, 'el mirón ve la mesa');
  assert.doesNotMatch(nodes.controls.innerHTML, /data-action="hit"/,
    'pero no le tocan los botones de nadie');
  assert.equal(nodes.odds.innerHTML, '', 'ni el medidor de nadie');
  assert.doesNotMatch(nodes['plate-p1'].innerHTML, /Vos/, 'ninguna chapa dice Vos');
  assert.doesNotMatch(nodes['plate-p2'].innerHTML, /Vos/);
  console.log('  ✓ el que entra con los dos asientos ocupados, mira');
}

// ---- de quién es cada id -----------------------------------------------------
// La parte que se puede probar sin navegador: con qué id arranca una pantalla según lo
// que traía guardado y qué otras están abiertas.
{
  const { idForScreen } = await import('../src/net.js');
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
}

console.log('✓ cliente de red ok');
