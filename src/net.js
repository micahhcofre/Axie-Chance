// La partida en red, del lado del navegador.
//
// Acá no hay reglas: la partida vive en el servidor (ver `scripts/net.mjs`) y esto es
// un objeto que **contesta lo mismo** que `createGame()` pero sin tener nada adentro.
// El estado llega por un stream y cada botón se va por un POST. La pantalla no se
// entera de la diferencia: `mount()` recibe uno u otro y hace lo mismo con los dos.
//
// Las preguntas que la pantalla le hace a la partida —quién está eligiendo, qué puede
// tocar, si le queda una renovación— se contestan acá con las mismas funciones que usa
// la partida de verdad, importadas de `game.js`. Son vistas del estado y el estado lo
// tenemos: no hace falta ir a preguntar por el cable ni escribirlas de nuevo.
import { mount } from './ui.js';
import {
  FORFEIT_ROUNDS, actingOf, canRenewFor, draftableFor, draftingSeat, drafterOf,
  forfeitWinner, unseenOf,
} from './game.js';
import { AXIES, axie, axieArt } from './axies.js';
import { SYMBOLS, crest } from './data.js';
import { readLoadout } from './loadout.js';

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
 * mismo asiento —el servidor se lo guarda unos segundos, ver `GRACE` en
 * `scripts/net.mjs`—, y una ventana nueva es alguien nuevo. Con el `localStorage`, que
 * es del navegador entero, las dos ventanas mandaban el mismo id, el servidor les daba
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
 * resultado. Lo que vale es el estado que vuelve, y vuelve por el stream — si el
 * servidor rechaza la acción porque no era tu turno, no pasa nada y la pantalla sigue
 * mostrando lo que había, que es exactamente lo correcto.
 */
function createRemoteGame(id, salaOf) {
  let state = null;
  const listeners = new Set();

  // Devuelve cuándo terminó de mandarse, que solo le importa a irse (ver `quit`): hay
  // que avisar antes de soltar la página.
  const send = (action, arg) => fetch('/net/act', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id, sala: salaOf(), action, arg }),
  }).catch(() => { /* se cortó el cable; el stream ya lo va a contar */ });

  return {
    get state() { return state; },
    /** Lo llama el stream con cada estado nuevo. */
    apply(next) {
      // El reloj llega como lo que le falta (ver `wireClock` en `scripts/net.mjs`) y
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
    skipDraft: () => send('skipDraft'),
    renewMarket: () => send('renewMarket'),
    ready: () => send('ready'),
    // Con qué Axie entrás a la sala. No es una jugada —la partida todavía no existe—:
    // es lo que elegiste en la portada, que la sala guarda hasta repartir (ver
    // `loadout.js` y `ACTIONS.loadout` en `scripts/net.mjs`).
    loadout: (mine) => send('loadout', mine),
    // Irse de la sala. Con la partida andando es abandonarla (ver `forfeit`).
    leave: () => send('leave'),
    // La ronda siguiente arranca sola en el servidor. Acá el Enter no adelanta nada:
    // adelantársela a uno solo de los dos sería mostrarle otra partida.
    nextRound: () => {},
  };
}

/** ¿Este servidor sabe de partidas en red? Un archivo suelto no contesta. */
export async function netAvailable() {
  try {
    const res = await fetch('/net/hello');
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

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
export function connect({ chooseAxie = null } = {}) {
  const id = clientId();
  let sala = new URLSearchParams(location.search).get('sala');
  const game = createRemoteGame(id, () => sala);
  const box = byId('net');

  let seat = null;
  let room = null;   // lo último que contó la sala de sí misma
  let rooms = [];    // la lista del lobby
  let mounted = false;
  let live = false;
  /**
   * Si alguna vez llegamos a estar conectados a esta sala. Sin esto, el instante entre
   * abrir el stream y que conteste se contaba como caída, y entrar a una sala arrancaba
   * con un cartel rojo que decía que se había cortado la conexión — la primera vez que
   * el jugador ve la sala, y ya diciéndole que algo anda mal.
   */
  let everLive = false;
  let es = null;
  let poll = null;
  let note = '';
  /** La lista de salas tal como está dibujada, para no volver a dibujar lo mismo. */
  let painted = null;

  // ---- el cable ---------------------------------------------------------------

  function open(code) {
    close();
    sala = code;
    // La sala queda en la dirección: recargar vuelve a la misma en vez de al lobby, y
    // el link se le puede pasar al otro ya apuntando adentro.
    history.replaceState(null, '', `${location.pathname}?red&sala=${encodeURIComponent(code)}`);

    everLive = false;
    es = new EventSource(`/net/stream?id=${encodeURIComponent(id)}&sala=${encodeURIComponent(code)}`);
    es.onopen = () => { live = true; everLive = true; paint(); };
    es.onerror = () => { live = false; paint(); };
    es.onmessage = (e) => {
      live = true;
      everLive = true;
      const msg = JSON.parse(e.data);
      if (msg.t === 'hello') {
        seat = msg.seat;
        room = msg.room;
        // Recién acá se sabe si hay asiento y cuál, así que recién acá se puede decir
        // con qué Axie entra. Va en cada `hello` y no una sola vez: si se corta el
        // cable y el stream se reengancha, la sala puede haber olvidado el asiento —y
        // con él, el bicho— mientras no estabas (ver `GRACE` en `scripts/net.mjs`).
        if (seat) tellAxie();
      } else if (msg.t === 'room') {
        room = msg.room;
      } else if (msg.t === 'state') {
        game.apply(msg.state);
        // La pantalla se engancha una sola vez, con la primera partida: `mount` deja
        // puestos sus escuchas y de ahí en más se repinta sola con cada estado.
        if (msg.state && !mounted) {
          mounted = true;
          mount(game, { seat, net: true, leave: quit });
        }
      }
      paint();
    };
  }

  /** Le cuenta a la sala con qué Axie entrás. Lo elegiste en la portada, no acá. */
  function tellAxie() {
    const mine = readLoadout();
    if (mine) game.loadout(mine);
  }

  function close() {
    es?.close();
    es = null;
    live = false;
    everLive = false;
    seat = null;
    room = null;
  }

  /** Volver al lobby. Solo se puede antes de empezar: en mitad de una no hay botón. */
  function leave() {
    close();
    sala = null;
    painted = null;
    history.replaceState(null, '', `${location.pathname}?red`);
    refresh();
    paint();
  }

  /**
   * Irse de una sala con partida: se le avisa —suelta el asiento, y si la partida
   * seguía, la cierra por abandono— y recién después se vuelve a la lista.
   *
   * Volver es **recargar**, no `leave()`: la mesa se engancha una sola vez y con el
   * asiento que tenía (ver `mount`), y en la próxima sala te puede tocar el otro.
   */
  function quit() {
    game.leave().finally(() => { location.href = `${location.pathname}?red`; });
  }

  /** Abandonar, con la partida andando y un asiento propio: lo único que se puede dejar. */
  const canQuit = () => Boolean(seat && game.state && game.state.phase !== 'matchEnd');

  // ---- el lobby ---------------------------------------------------------------

  async function refresh() {
    try {
      const res = await fetch('/net/rooms');
      const data = await res.json();
      rooms = data.rooms ?? [];
      if (data.urls?.length) {
        byId('net-list').innerHTML = data.urls.map((u) => `<li>${u}/?red</li>`).join('');
        byId('net-urls').hidden = false;
      }
    } catch {
      rooms = [];
    }
    if (!sala) paint();
  }

  async function create() {
    note = '';
    try {
      const res = await fetch('/net/rooms', { method: 'POST' });
      const data = await res.json();
      open(data.room.code);
      paint();
    } catch {
      note = 'No se pudo crear la sala. ¿Sigue andando el servidor?';
      paint();
    }
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
      return '<li class="netbox-empty">Todavía no hay ninguna. Creá una y esperá al otro.</li>';
    }
    return rooms.map((r, i) => {
      const full = r.seats.p1 && r.seats.p2;
      const count = Number(r.seats.p1) + Number(r.seats.p2);
      const tag = r.playing ? `ronda ${r.round}` : full ? 'completa' : `${count}/2`;
      // Sin asiento libre se entra igual, pero a mirar (ver `paint`). La etiqueta lo
      // dice antes de tocar y no después: es la diferencia entre sentarse y espiar.
      const watch = Boolean(full || r.playing);
      return `<li><button class="netbox-room" data-sala="${r.code}">
        <span class="room-no">${i + 1}</span>
        <span class="room-id"><b>${r.name}</b><span class="netbox-code">${r.code}</span></span>
        <span class="room-seats"
          >${seatPipHtml(r.seats.p1, r.axies?.p1)}${seatPipHtml(r.seats.p2, r.axies?.p2)}</span>
        <span class="netbox-count" data-full="${full}">${tag}</span>
        <span class="room-go" data-watch="${watch}">${watch ? 'Mirar' : 'Entrar'}</span>
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
      const state = !here ? 'esperando…' : isReady ? 'listo' : 'sin confirmar';
      const art = id
        ? axieArt(id, { alts: false })
        : `<span class="seat-empty">${i + 1}</span>`;
      return `<li data-ready="${Boolean(isReady)}" data-here="${Boolean(here)}">
        <span class="seat-art">${art}</span>
        <span class="seat-id">
          <span class="seat-who"
            ><b>${SEAT_NAME[s]}</b>${s === seat ? '<span class="netbox-you">vos</span>' : ''}</span>
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
      : '<b>Elegí uno</b>';
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

    const show = !sala || !game.state || (Boolean(sala) && !live);
    box.hidden = !show;
    if (!show) return;

    const inRoom = Boolean(sala);
    byId('net-lobby').hidden = inRoom;
    byId('net-room').hidden = !inRoom;
    byId('net-urls').hidden = inRoom ? true : byId('net-list').innerHTML === '';
    // La cruz de la esquina cierra la sala, así que solo existe adentro de una: atrás
    // está la lista. Y está también con el cable cortado, que es justo cuando uno
    // quiere salir de ahí.
    byId('net-close').hidden = !inRoom;
    box.dataset.state = inRoom && !live && everLive ? 'down' : 'wait';
    // El terreno de la pantalla es el de tu Axie: la sala es tuya y el fondo es tu casa,
    // igual que en la portada cuando se entra por un link (ver `open` en `lobby.js`).
    box.dataset.arena = axie(readLoadout()?.axie).class;

    if (!inRoom) {
      byId('net-title').textContent = 'Salas';
      byId('net-note').textContent = note
        || 'Creá una sala y pasale la dirección al otro aparato, o entrá a una que ya esté.';
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
      byId('net-title').textContent = everLive ? 'Se cortó la conexión' : 'Entrando…';
      byId('net-note').textContent = everLive
        ? 'Reintentando solo. Si no vuelve, fijate que el servidor siga andando.'
        : 'Buscando la sala.';
      byId('net-seats').innerHTML = '';
      byId('net-ready').hidden = true;
      return;
    }

    byId('net-title').textContent = room?.name ?? 'Sala';
    byId('net-seats').innerHTML = seatsHtml();
    minePaint();
    const btn = byId('net-ready');
    if (!seat) {
      byId('net-note').textContent = 'Los dos asientos están ocupados: entrás a mirar.';
      btn.hidden = true;
    } else {
      const mine = room?.ready[seat];
      const both = room?.seats.p1 && room?.seats.p2;
      byId('net-note').textContent = mine
        ? (both ? 'Esperando al otro…' : 'Listo. Falta que entre el otro aparato.')
        : 'Cuando los dos aprieten Listo, empieza.';
      btn.hidden = false;
      btn.textContent = mine ? 'Ya no' : 'Estoy listo';
      btn.dataset.on = String(Boolean(mine));
    }
  }

  // ---- los botones ------------------------------------------------------------

  byId('net-create').addEventListener('click', create);
  byId('net-axie').addEventListener('click', () => chooseAxie?.());
  byId('net-close').addEventListener('click', leave);

  // Abandonar pregunta antes, y dice qué va a pasar: en las primeras rondas se anula,
  // después gana el otro. Es lo único de la partida que no se puede deshacer, y el
  // que lo aprieta tiene que saber cuál de las dos cosas está eligiendo.
  const quitBox = byId('quit-modal');
  byId('menu-btn').addEventListener('click', () => {
    if (!canQuit()) return;
    byId('quit-note').innerHTML = forfeitWinner(game.state, seat)
      ? `Ya se jugaron ${FORFEIT_ROUNDS} rondas: si te vas, <b>gana el otro</b>.`
      : `Todavía no se jugaron ${FORFEIT_ROUNDS} rondas: si te vas, la partida ` +
        '<b>se anula</b> y no gana nadie.';
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
  // falta: lo que pasa ahí llega por el stream.
  // Cada segundo y pico: son cuatro datos por sala, y lo que se está esperando es que
  // aparezca la que acaba de crear el otro.
  poll = setInterval(() => { if (!sala) refresh(); }, 1200);
  poll.unref?.();

  refresh();
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
