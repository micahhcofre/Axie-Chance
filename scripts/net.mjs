// Las salas: cada una es **una** partida, en el servidor, y las pantallas que la miran.
//
// Con los dos jugadores en el mismo teclado alcanzaba con que el juego dejara de
// jugarse solo el segundo asiento. En dos aparatos aparece la pregunta de dónde vive el
// estado, y la respuesta es acá: el servidor corre `createGame()` igual que lo corría
// el navegador, y los clientes dejan de tener partida — dibujan el estado que les llega
// y mandan lo que su dueño aprieta.
//
// Eso no es una decisión de arquitectura sino de confianza: si cada navegador tuviera
// su copia habría que creerle a los dos, y dos copias de una partida con azar adentro
// se separan en la primera carta. Con una sola copia no hay nada que sincronizar.
//
// El canal es SSE hacia abajo y un POST hacia arriba. No hace falta más: el juego es
// por turnos, los mensajes son unos pocos por segundo y SSE ya se usa en este mismo
// servidor para recargar la página (ver `dev.mjs`). Un WebSocket traería framing propio
// o una dependencia, y no compraría nada.
import { createGame } from '../src/game.js';
import { shuffle } from '../src/data.js';
import { cleanLoadout } from '../src/loadout.js';

export const SEATS = ['p1', 'p2'];

/**
 * Cuánto se le guarda el asiento a quien se desconecta. Recargar la página corta el
 * stream y abre otro enseguida, así que soltarlo en el acto le regalaría el asiento al
 * primero que estuviera mirando en cada F5.
 */
const GRACE = 15_000;
/** Un latido cada tanto: sin tráfico, un celular con la pantalla apagada corta el stream. */
const PING = 20_000;
/**
 * Una sala vacía tanto tiempo ya no la va a reclamar nadie. Corto a propósito: en una
 * casa, una lista con seis salas muertas es peor que una lista vacía — no se sabe a
 * cuál entrar—. El que se fue y quiere volver tiene su asiento guardado aparte
 * (`GRACE`), y mientras lo tenga la sala no cuenta como vacía.
 */
const STALE = 45_000;

/**
 * El alfabeto de los códigos de sala: sin las letras y números que se confunden al
 * leerlos en voz alta o al copiarlos de una pantalla a otra (O/0, I/1, S/5).
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789';

/**
 * El estado que sale al cable, sin lo que nadie puede ver.
 *
 * `pool` es la pila boca abajo que alimenta el centro: mandarla entera sería decirles a
 * los dos qué cartas van a reponerse. Va en blanco y queda el largo, que es lo único
 * que la pantalla le pide.
 *
 * Los mazos van barajados de nuevo. **Qué** cartas tienen es público —se ve cada carta
 * que el otro se lleva del centro, y el mazo inicial sale de su clase—, pero el orden
 * no lo conoce ni su dueño: es exactamente lo que mide el aro de la próxima carta.
 * Mandarlo tal cual convertiría ese medidor en un adorno, y de paso le mostraría a cada
 * uno lo que va a robar el otro.
 *
 * Lo demás viaja entero. Las cartas de la mesa, el centro, la vida, los poderes puestos
 * y el registro son públicos por definición: están a la vista de los dos en la pantalla.
 */
function redact(state) {
  return {
    ...state,
    pool: state.pool.map(() => null),
    decks: { p1: shuffle(state.decks.p1), p2: shuffle(state.decks.p2) },
    clock: wireClock(state.clock),
  };
}

/**
 * El reloj viaja como lo que le falta y no como la hora a la que termina: esa hora es
 * la del servidor, y el reloj de un celular puede estar corrido unos segundos. Cada
 * aparato la vuelve a pasar a su propia hora al recibirlo (ver `apply` en `net.js`).
 */
const wireClock = (clock) => clock && {
  seat: clock.seat, kind: clock.kind, ms: clock.ms,
  left: Math.max(0, clock.ends - Date.now()),
};

/**
 * @param {{code: string, name: string, pace?: number, seed?: number, grace?: number}} opts
 *   `pace` y `seed` van derecho a la partida; los tests la corren sin pausas y sembrada.
 *   `grace` es lo que se le guarda el asiento al que se desconecta.
 */
export function createRoom({ code, name, pace, seed, grace = GRACE } = {}) {
  const game = createGame({ pace, seed });
  /** id de cliente → asiento. El id lo guarda el navegador, así un F5 vuelve al mismo. */
  const seatOf = new Map();
  /** Los streams abiertos: `{ id, res }`. Un mismo id puede tener más de uno. */
  const streams = new Set();
  /** Los que se fueron recién y todavía tienen el asiento guardado. */
  const dropping = new Map();
  /**
   * Quién apretó "listo". La partida no arranca al juntarse los dos sino cuando los dos
   * dicen que sí, que es la diferencia entre una sala y una puerta giratoria: con el
   * arranque automático, entrar a mirar quién había te metía en una partida.
   */
  const ready = { p1: false, p2: false };
  /**
   * Con qué Axie entra cada asiento: lo que eligió esa persona en su aparato, antes de
   * sentarse (ver `loadout.js`). La sala no pregunta nada — lo recibe y lo guarda.
   *
   * Está acá y no adentro de la partida porque llega **antes** que la partida: los dos
   * lo mandan al sentarse, y la primera mesa recién se reparte cuando los dos dicen que
   * están listos. El asiento que se va se lo lleva, igual que el "listo": el que llegue
   * después no juega con el bicho del anterior.
   */
  const loadout = { p1: null, p2: null };
  let idle = Date.now();

  const taken = (seat) => [...seatOf.values()].includes(seat);
  const seats = () => Object.fromEntries(SEATS.map((s) => [s, taken(s)]));
  const freeSeat = () => SEATS.find((s) => !taken(s)) ?? null;

  let wire = null; // el último estado ya recortado, para el que llega tarde

  const line = (msg) => `data: ${JSON.stringify(msg)}\n\n`;
  function push(msg) {
    const text = line(msg);
    for (const c of streams) c.res.write(text);
  }

  const info = () => ({
    code,
    name,
    seats: seats(),
    ready: { ...ready },
    // Con qué bicho entra cada uno. Va en la sala y no solo en la partida para que se
    // vea **antes** de empezar: es la mitad de lo que se está esperando cuando se
    // espera al otro.
    axies: { p1: loadout.p1?.axie ?? null, p2: loadout.p2?.axie ?? null },
    playing: Boolean(game.state),
    round: game.state?.round ?? 0,
    watching: new Set([...streams].map((c) => c.id)).size - seatOf.size,
  });

  const announce = () => push({ t: 'room', room: info() });

  game.subscribe((state) => {
    wire = state ? redact(state) : null;
    push({ t: 'state', state: wire });
  });

  /** Cómo arranca una mesa acá: cada asiento con el Axie que trajo puesto. */
  const setup = () => ({
    mode: 'net',
    axie: loadout.p1?.axie,
    axie2: loadout.p2?.axie,
    boosts: loadout.p1?.boosts,
    boosts2: loadout.p2?.boosts,
  });

  /** Con los dos asientos listos, empieza. Es el único camino a la primera partida. */
  function startIfReady() {
    if (game.state || !ready.p1 || !ready.p2) return;
    game.newMatch(setup());
    // Y se vuelve a contar la sala: lo que cambió no es sólo el estado de la partida
    // sino la sala misma, que pasó a estar jugando. El lobby lo lee de acá.
    announce();
  }

  function detach(client) {
    streams.delete(client);
    idle = Date.now();
    // Otra pestaña del mismo aparato sigue abierta: no se fue nadie.
    if ([...streams].some((c) => c.id === client.id)) return;
    if (!seatOf.has(client.id)) return announce();
    dropping.set(client.id, setTimeout(() => {
      release(client.id);
      announce();
    }, grace));
  }

  /** Suelta el asiento de `id` y devuelve cuál era. */
  function release(id) {
    clearTimeout(dropping.get(id));
    dropping.delete(id);
    const seat = seatOf.get(id) ?? null;
    seatOf.delete(id);
    // El "listo" y el Axie se van con el asiento: el que llegue después no hereda ni
    // un sí ajeno ni el bicho de otro.
    if (seat) {
      ready[seat] = false;
      loadout[seat] = null;
    }
    return seat;
  }

  /** Engancha un stream nuevo. Devuelve con qué soltarlo. */
  function attach(id, res) {
    clearTimeout(dropping.get(id));
    dropping.delete(id);
    idle = Date.now();
    if (!seatOf.has(id)) {
      const seat = freeSeat();
      // Sin asiento libre se entra igual, pero de espectador: se ve todo y no se toca
      // nada. Es lo que hace `allowed` en `game.js` sin que haya que pedirle nada.
      if (seat) seatOf.set(id, seat);
    }
    const client = { id, res };
    streams.add(client);
    res.write(line({ t: 'hello', seat: seatOf.get(id) ?? null, room: info() }));
    // El reloj se vuelve a medir: el que llega tarde tiene que ver lo que falta ahora,
    // no lo que faltaba cuando se mandó el último estado.
    if (wire) res.write(line({ t: 'state', state: { ...wire, clock: wireClock(game.state?.clock) } }));
    announce();
    return () => detach(client);
  }

  /**
   * Lo que puede pedir un cliente. Las cinco primeras son del turno o del reparto y
   * llevan el asiento al juego, que es quien comprueba que le toque (ver `allowed`).
   * Las tres últimas no son de nadie en particular: cualquiera de los dos puede decir
   * con qué Axie entra, que está listo, o empezar de nuevo.
   */
  const ACTIONS = {
    hit: (seat) => game.hit(seat),
    stand: (seat) => game.stand(seat),
    skipDraft: (seat) => game.skipDraft(seat),
    renewMarket: (seat) => game.renewMarket(seat),
    takeCard: (seat, arg) => game.takeCard(Number(arg), seat),
    chooseStackTarget: (seat, arg) => game.chooseStackTarget(Number(arg), seat),
    // Con qué bicho entrás. Lo manda la pantalla al sentarse y cada vez que lo cambiás
    // ahí mismo, y de acá lo saca la mesa cuando arranca: entre las dos cosas puede
    // pasar un rato largo —el que uno tarda en esperar al otro— y por eso se guarda en
    // vez de aplicarse. Con la partida ya repartida no cambia nada: el mazo está
    // barajado y el Axie en la mesa. Se ve en la próxima.
    loadout: (seat, arg) => {
      // Lo que no se entiende se tira, y lo que ya había se queda: esto viene del
      // cable, y un pedido roto no tiene por qué costarle a nadie el bicho elegido.
      const mine = cleanLoadout(arg);
      if (!mine) return;
      loadout[seat] = mine;
      announce();
    },
    // Otra partida necesita a los dos sentados: después de un abandono el asiento de
    // enfrente está vacío, y repartir sería jugar contra nadie.
    newMatch: () => { if (SEATS.every(taken)) game.newMatch(setup()); },
    ready: (seat) => {
      ready[seat] = !ready[seat];
      announce();
      startIfReady();
    },
  };

  /**
   * `sent` es que la sala la recibió y se la pasó a la partida, y nada más: **no** es
   * que haya cambiado algo. Pedir robar en el turno del otro llega bien y no hace nada,
   * porque quien decide eso es `allowed` adentro del juego, un rato después y sin
   * devolver nada. Si cambió algo se ve por el stream, que es donde se mira.
   */
  function act(id, action, arg) {
    const seat = seatOf.get(id);
    if (!seat) return { sent: false, why: 'estás mirando' };
    // Irse no es una jugada sino un asunto de la sala: el asiento se suelta en el acto,
    // sin esperar el `grace` de una recarga —el que se va no vuelve—, y con la partida
    // andando se cierra por abandono (ver `forfeit` en `game.js`).
    if (action === 'leave') {
      release(id);
      if (game.state && game.state.phase !== 'matchEnd') game.forfeit(seat);
      announce();
      return { sent: true };
    }
    const fn = ACTIONS[action];
    if (!fn) return { sent: false, why: 'acción desconocida' };
    if (!game.state && !['newMatch', 'ready', 'loadout'].includes(action)) {
      return { sent: false, why: 'todavía no hay partida' };
    }
    fn(seat, arg);
    return { sent: true };
  }

  const beat = setInterval(() => {
    for (const c of streams) c.res.write(': ping\n\n');
  }, PING);
  beat.unref?.();

  return {
    code,
    name,
    attach,
    act,
    info,
    /** Sin nadie adentro y sin nadie a quien esperarle el asiento, hace rato. */
    stale: () => streams.size === 0 && seatOf.size === 0 && Date.now() - idle > STALE,
    close: () => clearInterval(beat),
    get state() { return game.state; },
  };
}

/**
 * El conjunto de salas. Vive una por servidor y las crea quien las necesita: un botón
 * en la pantalla, y listo. Sin esto había una sola sala fija, y "entrar" era sentarse
 * en el primer asiento que hubiera sin ver nunca quién más estaba.
 */
export function createLobby(opts = {}) {
  const rooms = new Map();
  let counter = 0;

  const code = () => {
    for (;;) {
      const tag = Array.from({ length: 4 }, () =>
        ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
      if (!rooms.has(tag)) return tag;
    }
  };

  /** Barre las salas que quedaron vacías. Se llama al mirar la lista: no hace falta reloj. */
  function sweep() {
    for (const [tag, room] of rooms) {
      if (room.stale()) {
        room.close();
        rooms.delete(tag);
      }
    }
  }

  return {
    create(name) {
      sweep();
      counter++;
      const tag = code();
      rooms.set(tag, createRoom({ code: tag, name: name || `Sala ${counter}`, ...opts }));
      return rooms.get(tag);
    },
    get: (tag) => rooms.get(String(tag ?? '').toUpperCase()) ?? null,
    list() {
      sweep();
      return [...rooms.values()].map((r) => r.info());
    },
  };
}
