// Una sala: **una** partida y las pantallas que la miran.
//
// Corre en el navegador de quien la crea. Ese navegador es el anfitrión: tiene la única
// copia de `createGame()`, y las demás pantallas dibujan el estado que les llega y
// mandan lo que su dueño aprieta. El cable entre las dos puntas no sabe nada del juego
// —es un cartero, ver `relay/core.mjs`—, y por eso la partida en red no necesita un
// servidor prendido: el que juega pone la computadora.
//
// Una sola copia no es una decisión de arquitectura sino de confianza: si cada
// navegador tuviera la suya habría que creerle a los dos, y dos copias de una partida
// con azar adentro se separan en la primera carta. Con una sola no hay nada que
// sincronizar.
//
// Las pantallas se enganchan con una función `send(msg)` y nada más: la del anfitrión
// recibe los mensajes en el acto, y las de afuera, por el cable (ver `net.js`).
import { createGame } from './game.js';
import { shuffle } from './data.js';
import { cleanLoadout } from './loadout.js';

export const ROOM_SEATS = ['p1', 'p2'];

/**
 * Cuánto se le guarda el asiento a quien se desconecta. Recargar la página corta el
 * cable y lo vuelve a abrir enseguida, así que soltarlo en el acto le regalaría el
 * asiento al primero que estuviera mirando en cada F5.
 */
const SEAT_GRACE = 15_000;

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
 *
 * La pantalla del anfitrión recibe esto mismo y no el estado entero: ver lo que no ve
 * el otro sería jugar con las cartas marcadas.
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
 * la del anfitrión, y el reloj de un celular puede estar corrido unos segundos. Cada
 * aparato la vuelve a pasar a su propia hora al recibirlo (ver `apply` en `net.js`).
 */
const wireClock = (clock) => clock && {
  seat: clock.seat, kind: clock.kind, ms: clock.ms,
  left: Math.max(0, clock.ends - Date.now()),
};

/**
 * @param {{code: string, name: string, pace?: number, seed?: number, grace?: number,
 *   onInfo?: (info: object) => void}} opts
 *   `pace` y `seed` van derecho a la partida; los tests la corren sin pausas y sembrada.
 *   `grace` es lo que se le guarda el asiento al que se desconecta. `onInfo` se entera
 *   cada vez que la sala cambia de cara: es lo que la lista de salas muestra de ella.
 */
export function createRoom({ code, name, pace, seed, grace = SEAT_GRACE, onInfo } = {}) {
  const game = createGame({ pace, seed });
  /** id de cliente → asiento. El id lo guarda el navegador, así un F5 vuelve al mismo. */
  const seatOf = new Map();
  /** Las pantallas enganchadas: `{ id, send }`. Un mismo id puede tener más de una. */
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
   * están listos. El asiento que se va se lo lleva, igual que el "listo".
   */
  const loadout = { p1: null, p2: null };

  const taken = (seat) => [...seatOf.values()].includes(seat);
  const seats = () => Object.fromEntries(ROOM_SEATS.map((s) => [s, taken(s)]));
  const freeSeat = () => ROOM_SEATS.find((s) => !taken(s)) ?? null;

  let wire = null; // el último estado ya recortado, para el que llega tarde

  function push(msg) {
    for (const c of streams) c.send(msg);
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
  });

  function announce() {
    const room = info();
    push({ t: 'room', room });
    onInfo?.(room);
  }

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
    // sino la sala misma, que pasó a estar jugando. La lista lo lee de acá.
    announce();
  }

  function detach(client) {
    if (!streams.delete(client)) return;
    // Otra pestaña del mismo aparato sigue enganchada: no se fue nadie.
    if ([...streams].some((c) => c.id === client.id)) return;
    if (!seatOf.has(client.id)) return;
    clearTimeout(dropping.get(client.id));
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

  /** Engancha una pantalla. Devuelve con qué soltarla. */
  function attach(id, send) {
    clearTimeout(dropping.get(id));
    dropping.delete(id);
    if (!seatOf.has(id)) {
      const seat = freeSeat();
      // Sin asiento libre se entra igual, pero de espectador: se ve todo y no se toca
      // nada. Es lo que hace `allowed` en `game.js` sin que haya que pedirle nada.
      if (seat) seatOf.set(id, seat);
    }
    const client = { id, send };
    streams.add(client);
    send({ t: 'hello', seat: seatOf.get(id) ?? null, room: info() });
    // El reloj se vuelve a medir: el que llega tarde tiene que ver lo que falta ahora,
    // no lo que faltaba cuando se mandó el último estado.
    if (wire) send({ t: 'state', state: { ...wire, clock: wireClock(game.state?.clock) } });
    announce();
    return () => detach(client);
  }

  /**
   * Lo que puede pedir un cliente. Las seis primeras son del turno o del reparto y
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
    // ahí mismo, y de acá lo saca la mesa cuando arranca. Con la partida ya repartida no
    // cambia nada: el mazo está barajado y el Axie en la mesa. Se ve en la próxima.
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
    newMatch: () => { if (ROOM_SEATS.every(taken)) game.newMatch(setup()); },
    ready: (seat) => {
      ready[seat] = !ready[seat];
      announce();
      startIfReady();
    },
  };

  /**
   * `sent` es que la sala la recibió y se la pasó a la partida, y nada más: **no** es
   * que haya cambiado algo. Pedir robar en el turno del otro llega bien y no hace nada,
   * porque quien decide eso es `allowed` adentro del juego. Si cambió algo se ve en el
   * estado que sale, que es donde se mira.
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
    const fn = Object.hasOwn(ACTIONS, action) ? ACTIONS[action] : null;
    if (!fn) return { sent: false, why: 'acción desconocida' };
    if (!game.state && !['newMatch', 'ready', 'loadout'].includes(action)) {
      return { sent: false, why: 'todavía no hay partida' };
    }
    fn(seat, arg);
    return { sent: true };
  }

  return {
    code,
    name,
    attach,
    act,
    info,
    /** Suelta los relojes de los asientos guardados: la sala se cierra. */
    close() {
      for (const timer of dropping.values()) clearTimeout(timer);
      dropping.clear();
    },
    get state() { return game.state; },
  };
}
