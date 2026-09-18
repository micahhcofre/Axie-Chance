// La partida en red, del lado del navegador.
//
// La partida vive en **un** navegador: el de quien creó la sala, que es el anfitrión
// (ver `rooms.js`). Las demás pantallas —y la del anfitrión también— tienen un objeto
// que **contesta lo mismo** que `createGame()` pero sin tener nada adentro: el estado
// llega como mensaje y cada botón se va como mensaje. La pantalla no se entera de la
// diferencia: `mount()` recibe uno u otro y hace lo mismo con los dos.
//
// Entre el anfitrión y las pantallas de afuera hay un cartero que no sabe nada del
// juego (ver `relay/core.mjs`): en `npm start` corre adentro del servidor de desarrollo
// y publicado corre en AWS. Por eso se puede jugar contra alguien de otro país sin
// pagar un servidor prendido: la partida la corre el que juega.
//
// Las preguntas que la pantalla le hace a la partida —quién está eligiendo, qué puede
// tocar, si le queda una renovación— se contestan acá con las mismas funciones que usa
// la partida de verdad, importadas de `game.js`. Son vistas del estado y el estado lo
// tenemos: no hace falta ir a preguntar por el cable ni escribirlas de nuevo.
import { mount } from './ui.js';
import {
  actingOf, canRenewFor, draftableFor, draftingSeat, drafterOf, unseenOf,
} from './game.js';
import { AXIES, axie, axieArt } from './axies.js';
import { SYMBOLS, crest } from './data.js';
import { readLoadout } from './loadout.js';
import { createRoom } from './rooms.js';
import { openLink, packMessage } from './link.js';
import { qrSvg } from './qr.js';
import { tr } from './i18n.js';

// `byId` y no `$` como en `ui.js`: el build de un solo archivo concatena los módulos
// sin envolverlos, así que dos `const $` en archivos distintos chocan (ver `build.mjs`).
const byId = (id) => document.getElementById(id);

const SEAT_NAME = { p1: 'Jugador 1', p2: 'Jugador 2' };

/** Dónde guarda cada pantalla su id, y dónde anotan todas que están abiertas. */
const ID_KEY = 'axie-chance:cliente';
const OPEN_KEY = 'axie-chance:pantallas';
/** Cada cuánto una pantalla abierta vuelve a firmar el registro, y a los cuántos vence. */
const BEAT = 8000;
const STALE = 25_000;
/**
 * Cada cuánto sale como mucho un estado a cada pantalla de afuera. La partida cambia
 * varias veces por segundo mientras anima, y cada cambio es el estado entero: mandar
 * solo el último de cada tanda ahorra mensajes y no se nota.
 */
const STATE_EVERY = 60;

/** Leer y escribir sin que un navegador con el almacenamiento apagado tumbe la sala. */
function slot(name) {
  try { return globalThis[name] ?? null; } catch { return null; }
}
const read = (name, key) => {
  try { return slot(name)?.getItem(key) ?? null; } catch { return null; }
};
const write = (name, key, value) => {
  try { slot(name)?.setItem(key, value); } catch { /* ídem */ }
};

const mint = () =>
  globalThis.crypto?.randomUUID?.() ?? `c${Math.random().toString(36).slice(2)}${Date.now()}`;

/** El registro de pantallas abiertas, sin las que hace rato no firman. */
function openScreens(now) {
  let map;
  try { map = JSON.parse(read('localStorage', OPEN_KEY) ?? '{}'); } catch { map = null; }
  if (!map || typeof map !== 'object') return {};
  return Object.fromEntries(
    Object.entries(map).filter(([, ts]) => typeof ts === 'number' && now - ts < STALE),
  );
}

/**
 * Qué id le toca a esta pantalla: el que traía guardado, salvo que otra pantalla
 * abierta ya lo esté usando, y entonces se acuña uno nuevo.
 *
 * Está afuera y devuelve un valor porque es la única parte que se puede probar: lo
 * demás es hablar con el almacenamiento del navegador.
 */
export function idForScreen(saved, open, now, newId = mint) {
  const busy = saved !== null && now - (open[saved] ?? -Infinity) < STALE;
  return !saved || busy ? newId() : saved;
}

/**
 * Quién es esta **pantalla**. No este navegador: la sala tiene dos asientos y la
 * manera de probarla es abrir dos ventanas en la misma máquina, así que dos pantallas
 * del mismo navegador tienen que ser dos jugadores y no uno.
 *
 * Por eso el id vive en el `sessionStorage`, que es de la pestaña: un F5 vuelve al
 * mismo asiento —la sala se lo guarda unos segundos, ver `SEAT_GRACE` en
 * `rooms.js`—, y una ventana nueva es alguien nuevo. Con el `localStorage`, que
 * es del navegador entero, las dos ventanas mandaban el mismo id, la sala les daba
 * a las dos el asiento del Jugador 1, el segundo asiento no se ocupaba nunca y la
 * partida no arrancaba: desde afuera, una sala que se queda esperando para siempre.
 *
 * Queda un agujero que el `sessionStorage` solo no tapa: duplicar una pestaña —o abrir
 * un link en una nueva— **copia** el `sessionStorage` entero, id incluido, y vuelve el
 * empate. Contra eso está el registro: cada pantalla abierta firma con su id en el
 * `localStorage` cada tantos segundos, y la que arranca con un id que ya está firmado
 * sabe que es una copia y se acuña otro. Al irse lo borra —una recarga también—, así
 * que el F5 encuentra el suyo libre y con él su asiento.
 */
function clientId() {
  const id = idForScreen(read('sessionStorage', ID_KEY), openScreens(Date.now()), Date.now());
  write('sessionStorage', ID_KEY, id);

  const sign = (mine) => {
    const open = openScreens(Date.now());
    if (mine) open[id] = Date.now();
    else delete open[id];
    write('localStorage', OPEN_KEY, JSON.stringify(open));
  };
  sign(true);
  const beat = setInterval(() => sign(true), BEAT);
  beat.unref?.();
  // `pagehide` y no `beforeunload`: es el que también corre en el celular, donde la
  // pestaña se descarta sin avisar.
  globalThis.addEventListener?.('pagehide', () => { clearInterval(beat); sign(false); });
  return id;
}

/**
 * La partida de allá, con la cara de la de acá.
 *
 * Las acciones se mandan y se olvidan: no se espera respuesta ni se adivina el
 * resultado. Lo que vale es el estado que vuelve — si la sala rechaza la acción porque
 * no era tu turno, no pasa nada y la pantalla sigue mostrando lo que había, que es
 * exactamente lo correcto. `send` devuelve cuándo terminó de salir, que solo le importa
 * a irse (ver `quit`): hay que avisar antes de soltar la página.
 */
function createRemoteGame(send) {
  let state = null;
  const listeners = new Set();

  return {
    get state() { return state; },
    /** Lo llama la sala con cada estado nuevo. */
    apply(next) {
      // El reloj llega como lo que le falta (ver `wireClock` en `rooms.js`) y
      // acá se vuelve a la hora de este aparato, que es la que mira la pantalla.
      if (next?.clock && next.clock.left != null) {
        next = { ...next, clock: { ...next.clock, ends: Date.now() + next.clock.left } };
      }
      state = next;
      listeners.forEach((fn) => fn(state));
    },
    subscribe(fn) {
      listeners.add(fn);
      if (state) fn(state);
      return () => listeners.delete(fn);
    },
    refresh() { if (state) listeners.forEach((fn) => fn(state)); },

    // ---- vistas del estado: las mismas que usa la partida de verdad ----
    unseenPool: (player) => unseenOf(state, player),
    drafting: () => draftingSeat(state),
    drafter: () => drafterOf(state),
    acting: () => actingOf(state),
    canRenew: (player) => canRenewFor(state, player),
    pickable: () => {
      const player = drafterOf(state);
      return player ? draftableFor(state, player) : [];
    },

    // ---- acciones ----
    newMatch: () => send('newMatch'),
    hit: () => send('hit'),
    stand: () => send('stand'),
    takeCard: (uid) => send('takeCard', uid),
    chooseStackTarget: (col) => send('chooseStackTarget', col),
    skipDraft: () => send('skipDraft'),
    renewMarket: () => send('renewMarket'),
    ready: () => send('ready'),
    // Con qué Axie entrás a la sala. No es una jugada —la partida todavía no existe—:
    // es lo que elegiste en la portada, que la sala guarda hasta repartir (ver
    // `loadout.js` y `ACTIONS.loadout` en `rooms.js`).
    loadout: (mine) => send('loadout', mine),
    // Irse de la sala. Con la partida andando es abandonarla (ver `forfeit`).
    leave: () => send('leave'),
    // La ronda siguiente arranca sola en el anfitrión. Acá el Enter no adelanta nada:
    // adelantársela a uno solo de los dos sería mostrarle otra partida.
    nextRound: () => {},
  };
}

/**
 * El link que abre una sala desde otro aparato: lo que va adentro del QR.
 *
 * Se arma con la dirección por la que **esta** pantalla llegó al juego, así sirve igual
 * en la red de casa que publicado en un dominio. La excepción es `localhost`: desde el
 * celular apunta al celular, y ahí va la IP de la red que cuenta el servidor (ver
 * `serverUrls` en `scripts/dev.mjs`). Sin ninguna de las dos no hay link que dar.
 */
export function roomLink(code, where = globalThis.location, lanUrls = []) {
  const host = where?.hostname ?? '';
  const local = host === 'localhost' || host === '[::1]' || host === '::1' || host.startsWith('127.');
  const path = where?.pathname || '/';
  const base = local ? lanUrls[0]?.replace(/\/$/, '') : where?.origin;
  if (!base || base === 'null') return null;
  return `${base}${path}?red&sala=${encodeURIComponent(code)}`;
}

/**
 * ¿Hay cartero de salas? Lo dice `net.json`, al lado de la página: publicado lo escribe
 * el deploy con la dirección del WebSocket en AWS (ver `infra/`), y en `npm start` lo
 * contesta el servidor de desarrollo, con las direcciones de la red de la casa. Un
 * archivo suelto no lo tiene, y ahí no hay partida en red.
 */
export async function netAvailable() {
  try {
    const res = await fetch('net.json', { cache: 'no-store' });
    const data = res.ok ? await res.json() : null;
    return typeof data?.ws === 'string' ? data : null;
  } catch {
    return null;
  }
}

/** La dirección del WebSocket: tal cual si es entera, o en este mismo servidor. */
export function relayUrl(ws, where = globalThis.location) {
  if (/^wss?:\/\//.test(ws)) return ws;
  return `${where.protocol === 'https:' ? 'wss:' : 'ws:'}//${where.host}${ws}`;
}

/** Lo que cuenta una sala de sí misma viene de otro navegador: se recorta a lo que se dibuja. */
function cleanRoom(r) {
  const known = (id) => (typeof id === 'string' && Object.hasOwn(AXIES, id) ? id : null);
  const pair = (o) => ({ p1: Boolean(o?.p1), p2: Boolean(o?.p2) });
  return {
    code: String(r?.code ?? '').replace(/[^A-Z0-9]/g, '').slice(0, 8),
    name: String(r?.name ?? '').replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 24),
    seats: pair(r?.seats),
    ready: pair(r?.ready),
    axies: { p1: known(r?.axies?.p1), p2: known(r?.axies?.p2) },
    playing: Boolean(r?.playing),
    round: Math.max(0, Math.floor(Number(r?.round) || 0)),
  };
}

/** El nombre de una sala: la de quien la creó, por su Axie. */
const roomTitle = (name) => (name ? tr('Sala de {name}', { name }) : tr('Sala'));

/**
 * El lobby y la sala.
 *
 * Son dos pantallas y no una porque contestan dos preguntas distintas: el lobby es
 * "¿dónde me meto?" y la sala es "¿estamos los dos?". Antes no había ninguna de las
 * dos —se entraba al primer asiento libre de la única sala que había y la partida
 * arrancaba sola al juntarse los dos—, y eso tenía dos problemas: no se podía mirar
 * quién estaba sin quedar sentado, y cuando el otro aparato no llegaba la pantalla se
 * quedaba esperando sin decir a qué.
 */
export function connect({ chooseAxie = null, audio = null } = {}) {
  const id = clientId();
  let sala = cleanRoom({ code: new URLSearchParams(location.search).get('sala')?.toUpperCase() }).code || null;
  const game = createRemoteGame((action, arg) => act(action, arg));
  const box = byId('net');

  let seat = null;
  let room = null;   // lo último que contó la sala de sí misma
  let rooms = [];    // la lista del lobby
  let mounted = false;
  let live = false;
  /**
   * Si alguna vez llegamos a estar conectados a esta sala. Sin esto, el instante entre
   * pedir entrar y que conteste se contaba como caída, y entrar a una sala arrancaba
   * con un cartel rojo que decía que se había cortado la conexión — la primera vez que
   * el jugador ve la sala, y ya diciéndole que algo anda mal.
   */
  let everLive = false;
  /** Por qué no hay sala del otro lado: `down` si el anfitrión se cortó, `closed` si se fue. */
  let why = null;
  let note = '';
  /** La lista de salas tal como está dibujada, para no volver a dibujar lo mismo. */
  let painted = null;
  /** Las direcciones de la red que cuenta el servidor, y el link que ya tiene su QR. */
  let lanUrls = [];
  let invited = null;
  /** El cable al cartero; `null` hasta saber si hay uno (ver `netAvailable`). */
  let link = null;
  /** ¿Hay cartero? `null` mientras se pregunta. */
  let reachable = null;

  /** La sala que corre en este navegador, si la creaste vos (ver `rooms.js`). */
  let hosted = null;
  /** La llave con la que se creó: para volver a ser su anfitrión si se corta el cable. */
  let hostKey = null;
  /** Las pantallas de afuera enganchadas a tu sala, por conexión. */
  const peers = new Map();
  /**
   * Hasta qué envío de cada tipo ya se dibujó. Por el cable pueden llegar desordenados
   * (ver `link.js`), y cada uno trae la sala o la partida enteras: el más viejo sobra.
   */
  let seen = {};

  // ---- lo que llega ------------------------------------------------------------

  /** Un mensaje de la sala: de la propia en el acto, o del anfitrión por el cable. */
  function receive(msg) {
    live = true;
    everLive = true;
    why = null;
    if (msg.t === 'hello') {
      seat = msg.seat === 'p1' || msg.seat === 'p2' ? msg.seat : null;
      room = cleanRoom(msg.room);
      // Recién acá se sabe si hay asiento y cuál, así que recién acá se puede decir
      // con qué Axie entra. Va en cada `hello` y no una sola vez: si se corta el
      // cable y se vuelve a entrar, la sala puede haber olvidado el asiento —y con él,
      // el bicho— mientras no estabas (ver `SEAT_GRACE` en `rooms.js`).
      if (seat) tellAxie();
    } else if (msg.t === 'room') {
      room = cleanRoom(msg.room);
    } else if (msg.t === 'state') {
      game.apply(msg.state);
      // La pantalla se engancha una sola vez, con la primera partida: `mount` deja
      // puestos sus escuchas y de ahí en más se repinta sola con cada estado.
      if (msg.state && !mounted) {
        mounted = true;
        mount(game, { seat, net: true, leave: quit, ...(audio ? { audio } : {}) });
      }
    }
    paint();
  }

  /** Lo que manda el cartero (`n` sin definir) o un anfitrión (`n` es el número de envío). */
  function onRelay(msg, n) {
    if (n !== undefined) {
      // Solo una pantalla de afuera recibe envíos, y solo de la sala en la que está.
      if (hosted || !sala || !['hello', 'room', 'state'].includes(msg.t)) return;
      const kind = msg.t === 'hello' ? 'room' : msg.t;
      if (n <= (seen[kind] ?? 0)) return;
      seen[kind] = n;
      receive(msg);
      return;
    }
    switch (msg.t) {
      case 'rooms':
        rooms = Array.isArray(msg.rooms) ? msg.rooms.map(cleanRoom) : [];
        if (!sala) paint();
        break;
      case 'hosted':
        host(msg.code, msg.name);
        break;
      case 'gone':
        // Se pidió una sala que ya no está: se vuelve a la lista y se dice por qué.
        if (sala && (!msg.code || msg.code === sala)) {
          dropHosted();
          toLobby(tr('Esa sala ya no está.'));
        } else if (!sala) {
          note = tr('No se pudo crear la sala.');
          paint();
        }
        break;
      case 'down':
      case 'closed':
        if (hosted) break;
        live = false;
        why = msg.t;
        paint();
        break;
      case 'join':
        if (hosted) peerJoin(String(msg.peer), String(msg.id));
        break;
      case 'act': {
        const peer = hosted && peers.get(String(msg.peer));
        if (peer) hosted.act(peer.id, msg.action, msg.arg);
        break;
      }
      case 'leave':
        if (hosted) peerLeave(String(msg.peer));
        break;
      default:
    }
  }

  // ---- tu sala: la que corre acá ----------------------------------------------

  /** El cartero dio el código de la sala nueva, o te devolvió la tuya tras un corte. */
  function host(code, name) {
    if (!hosted || hosted.code !== code) {
      const key = hostKey;
      dropHosted();
      hostKey = key;
      hosted = createRoom({
        code,
        name: cleanRoom({ name }).name,
        onInfo: (info) => link?.send({ a: 'info', code, info }),
      });
      sala = code;
      seat = null;
      room = null;
      history.replaceState(null, '', `${location.pathname}?red&sala=${encodeURIComponent(code)}`);
      // Tu pantalla es una más de la sala, enganchada sin cable.
      hosted.attach(id, receive);
    } else {
      // Volvió el cable: el cartero ya sabe que sos vos, y la lista vuelve a ver la sala.
      link?.send({ a: 'info', code, info: hosted.info() });
      live = true;
    }
    paint();
  }

  /** Una pantalla de afuera entra a tu sala. */
  function peerJoin(peer, peerId) {
    peerLeave(peer);
    const out = outbox(peer, hosted.code);
    const off = hosted.attach(peerId, out.push);
    peers.set(peer, { id: peerId, off, out });
  }

  function peerLeave(peer) {
    const gone = peers.get(peer);
    if (!gone) return;
    peers.delete(peer);
    gone.out.flush();
    gone.off();
  }

  /**
   * Lo que sale hacia una pantalla de afuera. Cada envío lleva su número, y los estados
   * se juntan: de una tanda sale solo el último (ver `STATE_EVERY`). Lo que no es estado
   * sale en el acto, pero después del estado pendiente, para no cambiar el orden.
   */
  function outbox(peer, code) {
    let n = 0;
    let chain = Promise.resolve();
    let pending = null;
    let timer = null;
    const ship = (msg) => {
      const seq = ++n;
      chain = chain
        .then(() => packMessage(msg))
        .then((parts) => parts.forEach((m) => link?.send({ a: 'to', code, peer, m: { ...m, n: seq } })))
        .catch(() => {});
    };
    const flush = () => {
      clearTimeout(timer);
      timer = null;
      if (pending) {
        const msg = pending;
        pending = null;
        ship(msg);
      }
    };
    return {
      push(msg) {
        if (msg.t === 'state') {
          pending = msg;
          timer ??= setTimeout(flush, STATE_EVERY);
          return;
        }
        flush();
        ship(msg);
      },
      flush,
      /** Cuándo terminó de salir todo lo pendiente. */
      drained() {
        flush();
        return chain;
      },
    };
  }

  /** Deja de correr tu sala acá. No le avisa a nadie: eso es `closeRoom`. */
  function dropHosted() {
    for (const peer of [...peers.keys()]) peerLeave(peer);
    hosted?.close();
    hosted = null;
    hostKey = null;
  }

  /** Cerrar tu sala: lo pendiente sale, y las pantallas de afuera se enteran. */
  async function closeRoom() {
    if (!hosted) return;
    const code = hosted.code;
    await Promise.all([...peers.values()].map((p) => p.out.drained()));
    link?.send({ a: 'close', code });
    dropHosted();
    await link?.flushed();
  }

  // ---- el cable ---------------------------------------------------------------

  /** Lo que aprieta esta pantalla: a la sala propia en el acto, o al anfitrión. */
  async function act(action, arg) {
    if (hosted) {
      hosted.act(id, action, arg);
      return;
    }
    if (!sala || !link) return;
    link.send({ a: 'act', code: sala, action, arg });
    await link.flushed();
  }

  function joinRoom() {
    seen = {};
    link?.send({ a: 'join', code: sala, id });
  }

  function onOpen() {
    if (hosted && hostKey) link.send({ a: 'host', code: hosted.code, key: hostKey });
    else if (sala) joinRoom();
    else refresh();
    paint();
  }

  function onClose() {
    live = false;
    paint();
  }

  /** Entrar a una sala de otro. */
  function open(code) {
    close();
    sala = code;
    // La sala queda en la dirección: recargar vuelve a la misma en vez de al lobby, y
    // el link se le puede pasar al otro ya apuntando adentro.
    history.replaceState(null, '', `${location.pathname}?red&sala=${encodeURIComponent(code)}`);
    everLive = false;
    if (link?.open) joinRoom();
  }

  function close() {
    live = false;
    everLive = false;
    why = null;
    seat = null;
    room = null;
    invited = null;
  }

  function toLobby(message = '') {
    close();
    sala = null;
    painted = null;
    note = message;
    history.replaceState(null, '', `${location.pathname}?red`);
    refresh();
    paint();
  }

  /** Le cuenta a la sala con qué Axie entrás. Lo elegiste en la portada, no acá. */
  function tellAxie() {
    const mine = readLoadout();
    if (mine) game.loadout(mine);
  }

  /**
   * Volver al lobby. Solo se puede antes de empezar, o con el cable cortado: en mitad
   * de una partida no hay botón. Si la sala es tuya, se cierra para todos.
   */
  async function leave() {
    if (hosted) await closeRoom();
    else if (sala && why !== 'closed') game.leave();
    toLobby();
  }

  /**
   * Irse de una sala con partida: se le avisa —suelta el asiento, y si la partida
   * seguía, la cierra por abandono— y recién después se vuelve a la lista.
   *
   * Volver es **recargar**, no `leave()`: la mesa se engancha una sola vez y con el
   * asiento que tenía (ver `mount`), y en la próxima sala te puede tocar el otro. Si la
   * sala es tuya se cierra: sin tu navegador no hay partida.
   */
  async function quit() {
    await game.leave();
    await closeRoom();
    location.href = `${location.pathname}?red`;
  }

  /** Abandonar, con la partida andando y un asiento propio: lo único que se puede dejar. */
  const canQuit = () => Boolean(seat && game.state && game.state.phase !== 'matchEnd');

  // ---- el lobby ---------------------------------------------------------------

  function refresh() {
    if (!sala) link?.send({ a: 'list' });
  }

  function create() {
    note = '';
    if (!link?.open) {
      note = tr('Sin conexión con el servidor de salas. Probá de nuevo en un rato.');
      paint();
      return;
    }
    hostKey = mint().replace(/[^A-Za-z0-9]/g, '') + mint().replace(/[^A-Za-z0-9]/g, '');
    const mine = readLoadout();
    link.send({ a: 'host', key: hostKey, name: mine ? AXIES[mine.axie]?.name : '' });
  }

  // ---- lo que se ve -----------------------------------------------------------

  /**
   * Un asiento de una sala **vista de afuera**: un hueco, y si está ocupado el crest
   * del bicho con el que entró. Es lo que uno quiere saber antes de tocar —si hay
   * lugar, y contra qué—, y son dos dibujos en vez de un renglón de texto.
   */
  function seatPipHtml(here, id) {
    const a = here && id ? axie(id) : null;
    const paint = a ? ` style="--c:${SYMBOLS[a.class].color}" title="${a.name}"` : '';
    return `<i data-here="${Boolean(here)}"${paint}>${a ? crest(a.class, 'sm') : ''}</i>`;
  }

  function roomsHtml() {
    if (!rooms.length) {
      return `<li class="netbox-empty">${tr('Todavía no hay ninguna. Creá una y esperá al otro.')}</li>`;
    }
    return rooms.map((r, i) => {
      const full = r.seats.p1 && r.seats.p2;
      const count = Number(r.seats.p1) + Number(r.seats.p2);
      const tag = r.playing ? tr('ronda {round}', { round: r.round }) : full ? tr('completa') : `${count}/2`;
      // Sin asiento libre se entra igual, pero a mirar (ver `paint`). La etiqueta lo
      // dice antes de tocar y no después: es la diferencia entre sentarse y espiar.
      const watch = Boolean(full || r.playing);
      return `<li><button class="netbox-room" data-sala="${r.code}">
        <span class="room-no">${i + 1}</span>
        <span class="room-id"><b>${roomTitle(r.name)}</b><span class="netbox-code">${r.code}</span></span>
        <span class="room-seats"
          >${seatPipHtml(r.seats.p1, r.axies?.p1)}${seatPipHtml(r.seats.p2, r.axies?.p2)}</span>
        <span class="netbox-count" data-full="${full}">${tag}</span>
        <span class="room-go" data-watch="${watch}">${watch ? tr('Mirar') : tr('Entrar')}</span>
      </button></li>`;
    }).join('');
  }

  /**
   * Con qué Axie entra un asiento, si ya lo dijo. Es el bicho y su nombre, chiquito,
   * al lado de quién es: lo que se está esperando cuando se espera al otro es que
   * llegue y con qué viene, y las dos cosas se contestan en el mismo renglón.
   *
   * Puede repetirse: los dos pueden traer el mismo, y está bien (ver `newMatch`).
   */
  function seatAxieHtml(id) {
    if (!id) return '';
    const a = axie(id);
    return `<span class="netbox-axie" style="--c:${SYMBOLS[a.class].color}"
      >${crest(a.class, 'sm')}${a.name}</span>`;
  }

  /**
   * Los dos asientos de la sala propia: quién está, con qué bicho y si dijo que sí.
   *
   * El bicho va **dibujado** y no solo nombrado, y es el mismo muñeco de la mesa
   * —`axieArt`, sin los dibujos alternativos, que acá nadie los va a usar—: es la
   * primera vez que se ve al rival, y verlo es la mitad de lo que se está esperando
   * cuando se espera al otro. El asiento vacío muestra su número en el aro tallado,
   * que es lo que dice que ahí falta alguien.
   *
   * El bicho puede repetirse: los dos pueden traer el mismo, y está bien (ver
   * `newMatch`).
   */
  function seatsHtml() {
    return ['p1', 'p2'].map((s, i) => {
      const here = room?.seats[s];
      const isReady = room?.ready[s];
      const id = here ? room?.axies?.[s] : null;
      const state = !here ? tr('esperando…') : isReady ? tr('listo') : tr('sin confirmar');
      const art = id
        ? axieArt(id, { alts: false })
        : `<span class="seat-empty">${i + 1}</span>`;
      return `<li data-ready="${Boolean(isReady)}" data-here="${Boolean(here)}">
        <span class="seat-art">${art}</span>
        <span class="seat-id">
          <span class="seat-who"
            ><b>${tr(SEAT_NAME[s])}</b>${s === seat ? `<span class="netbox-you">${tr('vos')}</span>` : ''}</span>
          ${seatAxieHtml(id)}
        </span>
        <span class="seat-state">${state}</span></li>`;
    }).join('');
  }

  /**
   * El botón de tu Axie, adentro de la sala.
   *
   * La elección es la de siempre y vive en la portada: acá no hay un roster distinto,
   * se abre **esa misma pantalla** encima de la sala (ver `chooseAxie` en `main.js`).
   * Está porque a una sala se puede llegar sin haber pasado por la portada —el otro te
   * pasa el link y entrás derecho—, y porque entre que entrás y que empieza hay un rato
   * de esperar al otro que es exactamente cuando uno se acuerda de que quería cambiar
   * de bicho. Con la partida repartida ya no: ahí lo único que se hace es jugar.
   */
  function minePaint() {
    const btn = byId('net-axie');
    const mine = readLoadout();
    // Sin asiento no hay nada que elegir: el que entró con los dos ocupados, mira.
    btn.hidden = !seat || !chooseAxie;
    if (btn.hidden) return;
    byId('net-axie-now').innerHTML = mine
      ? `${crest(AXIES[mine.axie].class, 'sm')}<b>${AXIES[mine.axie].name}</b>`
      : `<b>${tr('Elegí uno')}</b>`;
  }

  /**
   * El QR para que el otro entre a esta sala apuntándole con la cámara, con el link
   * escrito abajo por si el aparato no tiene cámara. Está mientras falte alguien: con
   * los dos asientos ocupados ya no hay a quién invitar, y en el teléfono ese lugar
   * es el de los asientos. El SVG se rehace solo si cambió el link.
   */
  function invitePaint() {
    const link = sala && live && room && !(room.seats.p1 && room.seats.p2)
      ? roomLink(sala, globalThis.location, lanUrls)
      : null;
    byId('net-invite').hidden = !link;
    if (!link || link === invited) return;
    invited = link;
    byId('net-qr').innerHTML = qrSvg(link, { label: tr('QR para entrar a la sala') });
    byId('net-link').textContent = link;
  }

  /**
   * El cartel tapa la mesa solo cuando de verdad no hay mesa: en el lobby, en la sala
   * antes de empezar, o si se cortó el cable. Con la partida andando se va, y el que
   * entró con los dos asientos ocupados se queda mirando sin nada encima.
   */
  function paint() {
    // "Abandonar partida", en el menú de las tres rayitas. Terminada la partida la
    // salida es la del pie (ver `controlsHtml` en `ui.js`), y el que mira no tiene
    // nada que abandonar.
    byId('menu-btn').hidden = !canQuit();

    // Con la partida terminada no se tapa nada aunque se haya ido el anfitrión: el
    // final dice cómo terminó y tiene su propia salida (ver `controlsHtml` en `ui.js`).
    const ended = game.state?.phase === 'matchEnd';
    const show = !sala || !game.state || (!live && !ended);
    box.hidden = !show;
    if (!show) return;
    // Sin partida todavía, el lobby y la sala suenan como la portada. Con el cable
    // cortado en medio de una partida sigue el tema del combate.
    if (!game.state) audio?.music('menu');

    const inRoom = Boolean(sala);
    byId('net-lobby').hidden = inRoom;
    byId('net-room').hidden = !inRoom;
    byId('net-urls').hidden = inRoom ? true : byId('net-list').innerHTML === '';
    // La cruz de la esquina cierra la sala, así que solo existe adentro de una: atrás
    // está la lista. Y está también con el cable cortado, que es justo cuando uno
    // quiere salir de ahí.
    byId('net-close').hidden = !inRoom;
    box.dataset.state = inRoom && !live && (everLive || why) ? 'down' : 'wait';
    // El terreno de la pantalla es el de tu Axie: la sala es tuya y el fondo es tu casa,
    // igual que en la portada cuando se entra por un link (ver `open` en `lobby.js`).
    box.dataset.arena = axie(readLoadout()?.axie).class;
    invitePaint();

    if (!inRoom) {
      byId('net-title').textContent = tr('Salas');
      byId('net-create').disabled = !link?.open;
      byId('net-note').textContent = note
        || (reachable === false ? tr('Hace falta abrir el juego con npm start') : '')
        || (link && !link.open ? tr('Conectando con el servidor de salas…') : '')
        || tr('Creá una sala y pasale el QR o el link al otro, esté donde esté.');
      // Se repinta solo si cambió algo. La lista se vuelve a pedir cada segundo y pico
      // y ahora tiene dibujos adentro —los crests de quién está sentado—: rehacer el
      // marcado con los mismos datos les hace pestañear.
      const stamp = JSON.stringify(rooms);
      if (stamp !== painted) {
        painted = stamp;
        byId('net-rooms').innerHTML = roomsHtml();
      }
      return;
    }

    if (!live) {
      byId('net-axie').hidden = true;
      byId('net-title').textContent = why === 'closed' ? tr('La sala se cerró')
        : everLive || why ? tr('Se cortó la conexión') : tr('Entrando…');
      byId('net-note').textContent = why === 'closed' ? tr('Quien la creó se fue. Volvé a la lista con la cruz.')
        : why === 'down' ? tr('Esperando que vuelva quien creó la sala…')
          : everLive ? tr('Reintentando solo. Si no vuelve, revisá tu conexión.')
            : tr('Buscando la sala.');
      byId('net-seats').innerHTML = '';
      byId('net-ready').hidden = true;
      return;
    }

    byId('net-title').textContent = roomTitle(room?.name);
    byId('net-seats').innerHTML = seatsHtml();
    minePaint();
    const btn = byId('net-ready');
    if (!seat) {
      byId('net-note').textContent = tr('Los dos asientos están ocupados: entrás a mirar.');
      btn.hidden = true;
    } else {
      const mine = room?.ready[seat];
      const both = room?.seats.p1 && room?.seats.p2;
      byId('net-note').textContent = mine
        ? (both ? tr('Esperando al otro…') : tr('Listo. Falta que entre el otro aparato.'))
        : tr('Cuando los dos aprieten Listo, empieza.');
      btn.hidden = false;
      btn.textContent = mine ? tr('Ya no') : tr('Estoy listo');
      btn.dataset.on = String(Boolean(mine));
    }
  }

  // ---- los botones ------------------------------------------------------------

  byId('net-create').addEventListener('click', create);
  byId('net-axie').addEventListener('click', () => chooseAxie?.());
  byId('net-close').addEventListener('click', leave);

  // Abandonar pregunta antes, y dice qué va a pasar: la partida se corta ahí y gana el
  // otro. Es lo único de la partida que no se puede deshacer, y el que lo aprieta tiene
  // que saber lo que está eligiendo.
  const quitBox = byId('quit-modal');
  byId('menu-btn').addEventListener('click', () => {
    if (!canQuit()) return;
    byId('quit-note').innerHTML = tr('Si te vas, la partida se termina ahí y <b>gana el otro</b>.');
    // Lo que dijo la última vez no cuenta: cerrarlo con Escape no lo pisa.
    quitBox.returnValue = '';
    quitBox.showModal();
  });
  quitBox.addEventListener('close', () => {
    if (quitBox.returnValue === 'quit' && canQuit()) quit();
  });
  byId('net-ready').addEventListener('click', () => game.ready());
  byId('net-rooms').addEventListener('click', (e) => {
    const code = e.target.closest('[data-sala]')?.dataset.sala;
    if (code) { open(code); paint(); }
  });

  // La lista se pide de a ratos mientras se mira el lobby. Adentro de una sala no hace
  // falta: lo que pasa ahí llega solo. Cada dos segundos y pico: lo que se está
  // esperando es que aparezca la que acaba de crear el otro, y cada pedido es un
  // mensaje que en AWS se paga.
  const poll = setInterval(refresh, 2500);
  poll.unref?.();

  // Si la sala es tuya, cerrar la pestaña la cierra: sin tu navegador no hay partida, y
  // es mejor que el otro lo sepa en el acto a que se quede esperando.
  globalThis.addEventListener?.('pagehide', () => {
    if (hosted) link?.send({ a: 'close', code: hosted.code });
  });

  netAvailable().then((config) => {
    reachable = Boolean(config);
    if (config) {
      lanUrls = Array.isArray(config.urls) ? config.urls.map(String) : [];
      if (lanUrls.length) {
        byId('net-list').innerHTML = lanUrls.map((u) => `<li>${u.replace(/[<&"]/g, '')}/?red</li>`).join('');
      }
      link = openLink(relayUrl(config.ws), { onOpen, onClose, onMessage: onRelay });
      // El latido: que el cable no se corte por silencio, y que la sala propia siga en la lista.
      link.onBeat = () => link.send({ a: 'ping', code: hosted?.code });
    }
    paint();
  });

  if (sala) open(sala);
  paint();

  return {
    /**
     * Elegiste otro Axie en la portada, encima de la sala. Se le cuenta a la sala —que
     * es la que va a repartir— y se repinta, que es donde se ve con qué entrás.
     */
    axieChanged() {
      if (seat) tellAxie();
      paint();
    },
  };
}
