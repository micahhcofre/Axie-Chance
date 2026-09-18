import { buildPool, shuffle, makeRng, cardLabel, crest, powerIcon, POWERS, TUNING, chooseActivePowers, makeCard } from './data.js';
import { AXIES, AXIE_IDS, axie, deckFor } from './axies.js';
import { emptyChain, playCard, scoreChain, stackOnCard } from './rules.js';
import { decideDraw, planDraft, pickBest, pickBonus, sloppyDraft, renewsMarket } from './ai.js';
import { getAdventureLevel } from './adventure.js';
import { tr } from './i18n.js';

// Los números de los poderes viven en `data.js`, al lado de los carteles que los
// explican, así el texto sale de los mismos valores que usa el juego. Se reexportan
// porque el banco de pruebas y los tests los buscan acá.
export { TUNING };

export const PLAYERS = ['p1', 'p2'];
/**
 * Vida con la que arranca cada Axie. Los puntos de una cadena son el daño que le
 * hace al rival, así que `totals[p]` es "daño repartido por p" y la vida que le
 * queda a alguien es TARGET menos el daño del otro (ver `hpOf`). Cuando uno llega
 * a cero le queda un golpe más, salvo overkill (ver `lastChance`).
 */
export const TARGET = 100;
/** Cartas boca arriba en el centro. Se repone en el acto al llevarse una. */
export const MARKET_SIZE = 6;
/**
 * El reloj, en milisegundos: lo que tiene una persona para jugar su turno y para
 * elegir del centro después. Cuando se acaba decide el juego —el turno falla, como si
 * se hubiera cortado la cadena, y el reparto se cierra sin llevarse nada más—, así
 * nadie deja la mesa esperando. La máquina no lleva reloj: no tarda.
 */
export const CLOCK = { turn: 30000, draft: 20000 };

/**
 * El compás que hay entre soltar el ataque y el golpe: la cadena se recorre sola,
 * carta por carta, y recién cuando termina de recorrerse sale el zarpazo (ver
 * `traceChain` en `ui.js`). Es puro tiempo —el motor no sabe qué se dibuja—, pero el
 * tiempo sí es suyo: es él quien decide cuándo cae el daño, y la pantalla no puede
 * frenarlo por su cuenta sin que el número y la vida se le adelanten al dibujo.
 *
 * Un tramo por carta, con un piso para la cadena de una sola —que igual tiene su
 * chispazo— y un techo para que una cadena larga no se haga eterna.
 */
export const aimMs = (cards) => (cards > 0 ? Math.min(1500, 380 + 210 * (cards - 1)) : 0);

/**
 * Lo que tarda en verse cada poder que tiene animación propia, en ms, según el momento:
 * `apply` es cuando entra en juego al plantarse, `stand` cuando actúa antes del golpe
 * (la bebida, que se vuelca sobre el daño al plantarse) y `tick` cuando vuelve a actuar al
 * finalizar un turno (las hojas, al empezarlo). La pantalla los muestra de a uno y completos, después del golpe
 * (ver `power-fx.js`), y el turno espera a que termine el último antes de seguir.
 *
 * Como `aimMs`, es puro tiempo: el motor no sabe qué se dibuja, pero es él quien
 * decide cuándo se abre el centro. Un poder que no está acá no agrega espera.
 */
export const POWER_BEAT = {
  strength: { draw: 1300 },
  brutal: { stand: 1500 },
  octopus: { apply: 1500, pick: 1100 },
  bubble: { apply: 1700, trap: 1300, open: 1300 },
  egg: { apply: 1500 },
  feather: { draw: 2000 },
  pot: { apply: 1600 },
  leaf: { apply: 1600, tick: 1500 },
  snail: { apply: 1900, slow: 900 },
  leech: { apply: 2100 },
  poison: { apply: 1900, tick: 1900 },
  steelskin: { apply: 1700, block: 1000 },
};

/** Del golpe al primer poder: lo que tarda en conectar el golpe (hasta 700) y un respiro. */
export const POWER_LEAD = 1000;

/** Lo que pide un efecto de poder (`{ power, moment }`) antes de dejar pasar al siguiente. */
export const powerBeat = (fx) => POWER_BEAT[fx.power]?.[fx.moment] ?? 0;

/**
 * Lo que le queda puesto a un jugador de una ronda a la otra:
 *   `egg`      vida del escudo; aguanta golpes hasta gastarse. Se llama así por el
 *              huevo, pero es el escudo entero: lo suman el huevo y la máscara
 *   `eggBreak` daño acumulado que devuelve al romperse el escudo; solo lo cargan
 *              los huevos
 *   `steelskin` tope del daño que llega a la vida en el próximo golpe (máscara)
 *   `poison`   cuánto muerde al finalizar el turno, partiéndose al medio después
 *   `weak`     cuántos de sus próximos ataques salen partidos al medio. Los
 *              caracoles se suman: dos caracoles, los dos próximos ataques
 *   `strength` daño extra acumulado, para siempre
 *   `stacked`  cuántas de las próximas cartas que agarre del centro van arriba del
 *              mazo en vez de perderse en el barajado (ver el pulpo)
 */
const emptyStatus = () => ({ egg: 0, eggBreak: 0, poison: 0, weak: 0, strength: 0, stacked: 0, bubbles: 0, leaf: 0, steelskin: 0 });

/** Las cartas de una fila de la mesa, desarmando las montadas (Free Game, burbuja). */
const unstack = (cards) => cards.flatMap((c) => c.stackedCards || [c]);

/** El largo de la racha más larga de la cadena. */
const longestRun = (chain) => Math.max(0, ...chain.runs.map((r) => r.length));

// Cada jugador roba de su propio mazo y no hay descarte: cada ronda arranca con el
// mazo entero barajado de nuevo, como una tragamonedas. Contar lo que salió sigue
// valiendo dentro de la ronda —las cartas jugadas no vuelven hasta que cierre—, pero
// nada se arrastra de una ronda a la otra.

const other = (p) => (p === 'p1' ? 'p2' : 'p1');

/**
 * Cómo se nombra cada asiento, y en qué persona le habla el registro.
 *
 * Contra la máquina el jugador es "vos" y el verbo va en segunda —"abrís", "sacás"—;
 * en una sala el registro es el mismo para los dos aparatos, así que ninguno de los
 * dos asientos puede ser "vos": se nombran desde afuera y todo va en tercera. La
 * pantalla sí sabe cuál es el suyo y lo dice —ver `addressing` en `ui.js`—, pero el
 * registro es uno solo y lo leen los dos. Sin esta distinción un mismo texto no puede
 * servir a los dos modos: o dice "Jugador 1 abrís" o dice "Vos abre".
 *
 * Las formas con "a" y con "de" adelante están escritas enteras y no armadas pegando
 * la preposición, porque el español contrae: "a el Jugador 2" no existe, es "al
 * Jugador 2". Una regla para dos casos se lee peor que los dos casos.
 */
const YOU = { name: tr('Vos'), short: tr('Vos'), mid: tr('vos'), to: tr('a vos'), of: tr('de vos'), you: true };
const CPU = { name: tr('La CPU'), short: tr('CPU'), mid: tr('la CPU'), to: tr('a la CPU'), of: tr('de la CPU') };
const VOICE = {
  cpu: { p1: YOU, p2: CPU },
  tutorial: { p1: YOU, p2: CPU },
  adventure: {
    p1: YOU,
    p2: { name: tr('Rival'), short: tr('Rival'), mid: tr('el rival'), to: tr('al rival'), of: tr('del rival') },
  },
  net: {
    p1: { name: tr('Jugador 1'), short: tr('J1'), mid: tr('el Jugador 1'), to: tr('al Jugador 1'), of: tr('del Jugador 1') },
    p2: { name: tr('Jugador 2'), short: tr('J2'), mid: tr('el Jugador 2'), to: tr('al Jugador 2'), of: tr('del Jugador 2') },
  },
};

/**
 * La voz de un asiento: cómo se llama y en qué persona se le habla. La pantalla la
 * necesita por lo mismo que el registro: los carteles le hablan al que va a apretar el
 * botón, y en una sala ese botón es de uno de los dos aparatos.
 */
export const seatVoice = (state, player) => VOICE[state.mode][player];

/**
 * Si a `player` lo juega la máquina. Solo el segundo asiento puede tocarle a la CPU, y
 * en una sala no le toca a nadie: los dos los mueve una persona.
 *
 * Vive acá y no adentro de la partida porque la UI también la necesita —para saber si
 * el turno que corre es de alguien que va a apretar un botón o de alguien a quien hay
 * que esperar— y las dos tienen que contestar lo mismo.
 */
export const isBotSeat = (state, player) => state.mode !== 'net' && player === 'p2';

/**
 * Vida que le queda a `player`: la inicial, menos el daño que le hizo el otro, más
 * lo que se curó con la maceta. `healed` solo acumula lo que efectivamente curó
 * (ver `heal`), así que nunca hace falta recortar por arriba.
 */
export const hpOf = (state, player) =>
  Math.max(TARGET - state.totals[other(player)] + state.healed[player], 0);

/** Bono de daño de la Energy Drink: `TUNING.brutalStep` por cada símbolo de la cadena más larga, por carta. Se activa siempre. */
export function brutalBonusOf(chain) {
  if (!chain || chain.busted) return 0;
  const claws = unstack(chain.cards).filter((c) => c.power === 'brutal').length;
  return claws * TUNING.brutalStep * longestRun(chain);
}

/**
 * Lo que pegaría `player` si soltara el ataque ahora: los puntos de su cadena más la
 * fuerza que acumuló, partido al medio si tiene un caracol encima. Una cadena cortada
 * hace 0 y no la levanta ningún modificador.
 *
 * El caracol parte y no resta, y esa es toda la diferencia entre el poder de ahora y
 * el de antes. Antes mordía un número fijo —la mitad del golpe **con que se lo
 * pusieron**—, así que un atacante grande dejaba puesto un mordisco de 15 que borraba
 * los tres ataques siguientes del otro enteros: el caracol no debilitaba, apagaba. La
 * mitad no depende de quién lo puso y no puede apagar a nadie.
 *
 * Redondea para arriba a propósito: un ataque que sacó puntos siempre pega algo. Si
 * redondeara para abajo, una cadena de 1 saldría en 0 y volvería la misma pregunta
 * que el mordisco fijo —¿el caracol se gastó o no, si el ataque no hizo nada?—.
 *
 * Vive acá y no en la UI porque es la cuenta con la que se reparte el daño: el
 * número grande de la pantalla tiene que ser exactamente el que se va a aplicar.
 *
 * Con `brutal: false` es el mismo golpe sin la bebida: lo que muestra la pantalla
 * mientras la bebida todavía no se volcó (ver `poured`).
 */
export function swingOf(state, player, { brutal = true } = {}) {
  const chain = state.chains[player];
  const points = chain.busted ? 0 : scoreChain(chain).total;
  if (points <= 0) return 0;
  const st = state.status[player];
  const hit = points + st.strength + (brutal ? brutalBonusOf(chain) : 0);
  return st.weak > 0 ? Math.ceil(hit / TUNING.snailShare) : hit;
}

/**
 * La mesa vista desde el asiento de `player`, con lo que la CPU "duro" necesita para
 * medir un ataque contra la partida y no solo contra sus puntos (ver `decideDraw`):
 * su fuerza y su caracol, las dos vidas, lo que protege a cada uno y si este es el
 * golpe de su última chance.
 */
export function attackViewOf(state, player) {
  const foe = other(player);
  const mine = state.status[player];
  const theirs = state.status[foe];
  return {
    strength: mine.strength,
    weak: mine.weak > 0,
    myHp: hpOf(state, player),
    myShield: mine.egg,
    myCap: mine.steelskin,
    myPoison: mine.poison,
    foeHp: hpOf(state, foe),
    foeShield: theirs.egg,
    foeThorns: theirs.eggBreak || 0,
    foeCap: theirs.steelskin,
    foeStrength: theirs.strength,
    foeWeak: theirs.weak > 0,
    lastChance: lastChance(state) === player,
  };
}

/**
 * Cómo terminó la partida: `'p1'`, `'p2'`, `'tie'`, o `null` si todavía se juega. Gana
 * el que deja al otro sin vida; si los dos quedaron en cero —una última chance que
 * conecta— es empate.
 *
 * Si alguien abandonó, gana el que se quedó, sin importar en qué ronda fue: irse es
 * dar la partida por perdida.
 *
 * Es una regla y por eso vive acá: la pantalla la pinta, no la decide.
 */
export function matchResult(state) {
  if (!state || state.phase !== 'matchEnd') return null;
  if (state.forfeit) return state.forfeit.winner;
  const down = { p1: hpOf(state, 'p1') <= 0, p2: hpOf(state, 'p2') <= 0 };
  if (down.p1 && down.p2) return 'tie';
  return down.p2 ? 'p1' : 'p2';
}

/**
 * Daño que recibió `player` de más, pasado el cero: lo que el golpe que lo dejó sin
 * vida —y lo que le siguió cayendo después— se pasó de la vida que tenía.
 */
export const overkillOf = (state, player) =>
  Math.max(state.totals[other(player)] - state.healed[player] - TARGET, 0);

/**
 * El que está jugando su última chance, o esperándola: lo dejaron sin vida y todavía
 * no soltó el golpe que le queda. Le toca un turno normal —roba, encadena, se planta—
 * y si en ese golpe deja sin vida al otro también, la partida termina empatada.
 *
 * Le toca a cualquiera de los dos. Al que cierra, si lo matan antes de atacar, la
 * juega en el mismo intercambio; al que abre —que cuando cae ya tiró su golpe— se la
 * juega abriendo la ronda siguiente, y la partida se cierra con ese golpe sin que el
 * otro vuelva a jugar.
 *
 * No hay última chance:
 * - con overkill: si le pegaron más de `TUNING.overkill` pasado el cero, no se levanta.
 *   Cuenta todo lo que le cae mientras espera, no solo el golpe que lo tumbó.
 * - si ya la jugó (`lastChanceUsed`).
 * - con los dos sin vida: eso ya es el empate.
 *
 * En el tutorial el remate está guionado con la última chance del rival: ahí no hay
 * overkill que la borre.
 *
 * Vive acá y no en la UI porque es una regla y no un adorno: el halo que la marca en
 * pantalla y el número que persigue la máquina (`needsOf`) tienen que salir de la
 * misma cuenta.
 */
export function lastChance(state) {
  if (!state || state.phase === 'matchEnd') return null;
  const down = PLAYERS.filter((p) => hpOf(state, p) <= 0);
  if (down.length !== 1) return null;
  const [player] = down;
  if (state.lastChanceUsed?.[player]) return null;
  if (!state.tutorial && overkillOf(state, player) > TUNING.overkill) return null;
  return player;
}

// ---- las vistas del estado --------------------------------------------------
//
// Preguntas que se contestan mirando `state` y nada más: quién está eligiendo, qué
// puede tocar, si le queda una renovación.
//
// Viven acá, sueltas y exportadas, porque hay dos lados que necesitan la misma
// respuesta. La partida que corre adentro de `createGame` las usa para decidir; y con
// la partida en red, la pantalla del otro dispositivo solo tiene el estado que le
// llegó por el cable —no tiene el cierre, ni la partida— y tiene que poder contestarlas
// igual. Escritas dos veces se irían separando sin que nadie se entere; escritas una
// sola vez, no pueden.

/** El asiento al que le toca elegir del centro, lo juegue quien lo juegue. */
export const draftingSeat = (state) =>
  (state?.draft ? state.draft.order[state.draft.index] ?? null : null);

/** El mismo, pero solo si lo juega una persona: es a quien la pantalla le da el centro. */
export const drafterOf = (state) => {
  const player = draftingSeat(state);
  return player && !isBotSeat(state, player) ? player : null;
};

/**
 * El asiento que está jugando su turno y al que la pantalla le da los botones: el del
 * turno, salvo que lo juegue la máquina.
 */
export const actingOf = (state) => {
  if (!state || state.phase !== 'turn') return null;
  const player = state.turn;
  return player && !isBotSeat(state, player) ? player : null;
};

/** Cartas que todavía pueden salir del mazo de `player`: el mazo, sin más. */
export const unseenOf = (state, player) => state.decks[player];

/** Cómo terminó la ronda de `player`, que es lo que decide qué le toca del centro. */
const awardKindOf = (state, player) => (state.chains[player].busted ? 'bust' : 'stand');
const plainCardsOf = (state) => state.market.filter((c) => !c.power);

/**
 * Todo lo que `player` podría llegar a llevarse ahora mismo. Plantado y sin haber
 * tocado nada las dos ramas siguen abiertas, así que sirve el centro entero; una
 * vez que agarró una carta sin poder ya se comprometió, y la segunda tampoco puede
 * llevar poder. El tamaño de la carta dejó de importar.
 */
export function draftableFor(state, player) {
  // La carta del pulpo es aparte del reparto: no la limita ni la rama que eligió ni
  // haberse cortado. Es un turno de mercado suelto.
  if (state.draft?.step === 'bonus') {
    return TUNING.octopusPowers ? state.market.slice() : plainCardsOf(state);
  }
  const mode = state.draft?.mode;
  if (mode === 'power') return []; // la carta con poder cierra el reparto
  if (mode === 'plain' || awardKindOf(state, player) === 'bust') return plainCardsOf(state);
  return state.market.slice();
}

/**
 * Si nada de lo que puede agarrar lleva su símbolo, el centro no le ofrece nada que
 * enlace con su mazo: puede renovarlo entero, una sola vez por reparto.
 */
export function canRenewFor(state, player) {
  if (!state || state.phase !== 'draft' || draftingSeat(state) !== player) return false;
  if (state.draft.renewed[player] || state.pool.length === 0) return false;
  const own = state.symbols[player];
  return !draftableFor(state, player).some((c) => c.symbols.includes(own));
}

/**
 * Cartas de `player` que están en la mesa y todavía no volvieron a su mazo. Apenas
 * termina su turno la cadena se devuelve (`returned`), pero se sigue mostrando hasta
 * que cierre la ronda: sin esta cuenta, lo que está a la vista se contaría dos veces.
 */
export function onTable(state, player) {
  if (state.returned[player]) return 0;
  const chain = state.chains[player];
  const pending = state.pendingStack?.player === player ? 1 : 0;
  return unstack(chain.cards).length - state.recycled[player] + (chain.bustCard ? 1 : 0) + pending;
}

/**
 * Todas las cartas de `player`: el mazo, la que espera en la burbuja, y lo que sigue
 * en la mesa sin devolver.
 */
export const ownedBy = (state, player) =>
  state.decks[player].length + (state.bubbleCard?.[player] ? 1 : 0) + onTable(state, player);

/**
 * @param {{pace?: number, seed?: number}} opts
 *   `pace` 0 corre sin pausas (tests).
 *   `seed` fija todo el azar de la partida: los barajados y el Axie que le toca a la
 *   CPU. Dos partidas con la misma semilla y las mismas decisiones son idénticas, que
 *   es lo que hace comparables dos corridas del banco de pruebas. Sin semilla, azar
 *   del sistema — que es como se juega.
 *   `clock` es cuánto dura el reloj de cada cosa (ver `CLOCK`), o `null` para jugar
 *   sin reloj. Sin pausas (`pace: 0`) va apagado: es el banco de pruebas, y ahí nadie
 *   está pensando.
 */
export function createGame({ pace = 1, seed, clock = pace > 0 ? CLOCK : null } = {}) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms * pace));
  const rng = seed === undefined ? Math.random : makeRng(seed);
  /** Baraja con el azar de esta partida, no con el del sistema. */
  const deal = (cards) => shuffle(cards, rng);
  let state = null;
  // Los turnos son asíncronos. Si se arranca otra partida en el medio, la época
  // cambia y las corrutinas viejas se cortan en vez de escribir sobre el estado nuevo.
  let epoch = 0;
  const listeners = new Set();
  // Si los efectos de poder anotados todavía no salieron en un `emit` (ver `stageFx`).
  let fxOpen = false;
  const emit = () => {
    fxOpen = false;
    listeners.forEach((fn) => fn(state));
  };

  /**
   * Anota un poder que acaba de actuar para que la pantalla lo anime (ver `powerFx`).
   * Lo que se anota antes del mismo `emit` sale junto y en orden: plantarse pone varios
   * de una, y en el centro la burbuja puede atrapar la carta en el mismo instante en
   * que se abre la carta extra del pulpo.
   */
  function stageFx(fx) {
    if (fxOpen && state.powerFx) state.powerFx.fx.push(fx);
    else state.powerFx = { id: ++state.powerFxId, player: fx.by, fx: [fx] };
    fxOpen = true;
  }

  /** Espera `ms` y devuelve false si esta corrutina quedó obsoleta. */
  async function tick(ms, era) {
    await sleep(ms);
    return era === epoch;
  }

  /** El asiento por su nombre, en las formas que piden las frases del registro. */
  const voice = (p) => VOICE[state.mode][p];
  const who = (p) => voice(p).name;
  const whom = (p) => voice(p).mid;
  const toWhom = (p) => voice(p).to;
  const ofWhom = (p) => voice(p).of;
  /** El verbo en la persona que le toca al asiento (ver `VOICE`). */
  const verb = (p, second, third) => (voice(p).you ? second : third);
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const isBot = (p) => isBotSeat(state, p);

  /**
   * Una línea del registro. `kind` es su color: casi siempre el asiento que la provocó
   * ('p1'/'p2'). Antes el color decía si la noticia era buena o mala, y eso solo tiene
   * sentido cuando hay un solo lado mirando; con dos personas, "bueno" es de quién.
   */
  function log(text, kind = 'info') {
    state.log.unshift({ id: state.logId++, text, kind });
    if (state.log.length > 24) state.log.pop();
  }

  // ---- el reloj -----------------------------------------------------------------

  let alarm = 0;

  /**
   * Le pone el reloj a `player` para `kind` —'turn' o 'draft'— y lo escribe en el
   * estado, que es de donde lo lee la pantalla. Hay uno solo por vez: armar uno nuevo
   * desarma el anterior. `ends` es la hora de acá; la sala lo manda como lo que falta
   * (ver `redact` en `rooms.js`), porque el reloj del celular no es el del
   * anfitrión.
   */
  function armClock(player, kind) {
    clearTimeout(alarm);
    const ms = clock?.[kind];
    if (!ms || isBot(player) || state.tutorial) { state.clock = null; return; }
    const era = epoch;
    state.clock = { seat: player, kind, ms, ends: Date.now() + ms };
    alarm = setTimeout(() => { if (era === epoch) timeUp(player, kind); }, ms);
    // En Node no retiene el proceso: un test con pausas no se queda 30 segundos colgado.
    alarm.unref?.();
  }

  function stopClock() {
    clearTimeout(alarm);
    state.clock = null;
  }

  /** Se acabó el tiempo: el juego hace lo que el jugador no hizo. */
  function timeUp(player, kind) {
    const on = state.clock;
    if (!on || on.seat !== player || on.kind !== kind) return;
    state.clock = null;
    if (kind === 'turn') {
      // Ocupado es que ya está cerrando —la carta que cortó la cadena está cayendo—.
      if (canAct() !== player) return;
      // Quedarse sin tiempo no arruina lo que ya se armó: el reloj se planta por el
      // jugador y ataca con lo que llegó a robar. Dudar de más cuesta lo que la cadena
      // hubiera crecido, no la cadena entera.
      const timeoutMsg = voice(player).you
        ? tr('Se acabó el tiempo: atacás con lo que tenés.')
        : tr('Se acabó el tiempo: ataca con lo que tiene.');
      log(timeoutMsg, 'muted');
      void stand();
    } else {
      if (state.phase !== 'draft' || drafter() !== player) return;
      log(tr('Se acabó el tiempo de elegir.'), 'muted');
      void skipDraft(player);
    }
  }

  function draw(player) {
    if (state.decks[player].length === 0) {
      // Sin descarte, lo único fuera del mazo es lo que ya salió esta ronda: vuelve
      // adentro. `recycled` marca hasta dónde de la cadena ya se devolvió, para no
      // contarlo otra vez al cerrar la ronda.
      const played = unstack(state.chains[player].cards);
      state.decks[player] = deal(played.slice(state.recycled[player]));
      state.recycled[player] = played.length;
      log(voice(player).you
        ? tr('Vos rebarajás lo que ya salió.')
        : tr('{who} rebaraja lo que ya salió.', { who: who(player) }), 'muted');
    }
    const card = state.decks[player].pop();
    return card ?? makeCard([state.symbols[player]]);
  }

  const unseenPool = (player) => unseenOf(state, player);

  /** Las cartas de `player` con las que la CPU mide conectividad. */
  const cardsOf = (player) => state.decks[player];

  /**
   * @param {{difficulty?: string, mode?: string, axie?: string, axie2?: string,
   *   boosts?: object, boosts2?: object}} opts
   *   `axie` y `axie2` son ids del roster: el del primer asiento y el del segundo.
   *   `axie2` solo se respeta en una sala —contra la CPU su Axie es sorteado, que es
   *   parte de la partida—, y ahí se respeta entero: los dos pueden traer el mismo
   *   bicho. Cada uno eligió el suyo en su aparato antes de entrar, y decirle a uno de
   *   los dos que ese no, que lo agarró el otro, sería devolverle una elección que ya
   *   había hecho. Con el mismo mazo de los dos lados la partida es pareja, no es un
   *   error.
   *
   *   `boosts` y `boosts2` son las mejoras que cada asiento eligió en la pantalla de
   *   elección (ver `buildPersonalDeck`). Viajan al lado del Axie porque son de él: un
   *   mazo mejorado es el mazo de ese bicho y de ningún otro. La CPU no lleva: su Axie
   *   se sortea en el momento y no pasó por ninguna pantalla donde elegir nada.
   */
  function newMatch({
    difficulty, mode, axie: axieId, axie2: axieId2, boosts, boosts2, activePowers,
    adventureLevel, scriptedDecks, scriptedPool, onRoundStart,
  } = {}) {
    mode = mode ?? state?.mode ?? 'cpu';
    const advCfg = mode === 'adventure'
      ? getAdventureLevel(adventureLevel ?? state?.adventure?.level ?? 1)
      : null;
    difficulty = difficulty ?? advCfg?.difficulty ?? state?.difficulty ?? 'normal';
    const mine = axie(axieId ?? state?.axies.p1 ?? 'aquatic');
    // El Axie que pidió el segundo asiento, que solo existe en una sala o en el tutorial:
    // ahí vale tal cual para mantener el guión contra el Axie indicado.
    const wanted = (mode === 'net' || mode === 'tutorial')
      ? (axieId2 ?? state?.axies.p2)
      : (mode === 'adventure' ? (axieId2 ?? advCfg?.rival ?? state?.axies.p2) : null);
    // El sorteo, para cuando no hay nadie que haya elegido: el de la CPU, y el del
    // asiento que entró a la sala sin pasar por la elección. Ese sí es de otra clase,
    // que es lo mismo que decir de otro mazo: al que juega solo, verse en el espejo no
    // le agrega nada.
    const rivals = AXIE_IDS.filter((id) => AXIES[id].class !== mine.class);
    // En la Aventura el rival es un starter, que no está en el roster pero `axie()` conoce.
    const known = mode === 'adventure' ? axie(wanted).id === wanted : AXIE_IDS.includes(wanted);
    const theirs = known ? axie(wanted) : AXIES[rivals[Math.floor(rng() * rivals.length)]];
    // Las mejoras de cada asiento. Las del segundo solo valen si de verdad se sentó el
    // Axie que se pidió: si salió sorteado —contra la CPU, o porque el pedido no era
    // válido—, es otro bicho y las mejoras eran del anterior.
    const bags = {
      p1: boosts ?? state?.boosts?.p1 ?? {},
      p2: (theirs.id === wanted ? (boosts2 ?? state?.boosts?.p2) : null) ?? {},
    };

    // El mazo de fábrica de cada uno, armado una sola vez y guardado tal cual: de acá
    // sale el que se baraja para jugar, y la copia sin barajar es la que se mira en el
    // panel del mazo. Tiene que ser **el mismo** armado y no dos llamadas a `deckFor`,
    // porque cada llamada crea cartas nuevas con uid nuevos y entonces el panel no
    // podría reconocer las que están en juego.
    const start = { p1: deckFor(mine.id, bags.p1), p2: deckFor(theirs.id, bags.p2) };

    const powers = activePowers || (advCfg ? advCfg.activePowers : chooseActivePowers(rng));

    epoch++;
    clearTimeout(alarm);
    state = {
      // Qué partida es esta. La pantalla lo mira para olvidar lo que traía de la
      // anterior —cartas ya animadas, el último número del golpe— y con la partida en
      // red es la única forma que tiene de enterarse: la puede haber arrancado el otro.
      match: epoch,
      difficulty,
      mode,
      axies: { p1: mine.id, p2: theirs.id },
      // Las mejoras puestas, guardadas para que "Jugar de nuevo" reparta el mismo mazo
      // sin que la portada tenga que volver a mandarlas.
      boosts: bags,
      // La clase del Axie es el símbolo con el que puntúa; el resto del juego usa esto.
      symbols: { p1: mine.class, p2: theirs.class },
      round: 0,
      activePowers: powers,
      pool: scriptedPool ? scriptedPool.slice() : deal(buildPool(powers, rng)),
      market: [], // las 6 cartas a la vista, se llena abajo
      decks: scriptedDecks
        ? { p1: scriptedDecks.p1.slice(), p2: scriptedDecks.p2.slice() }
        : { p1: deal(start.p1), p2: deal(start.p2) },
      // Las diez de fábrica, en el orden en que las arma la clase, y lo que cada uno se
      // fue llevando del centro, en el orden en que lo agarró. Ninguna de las dos las
      // usa la partida: son para el panel que se abre tocando un Axie, que es el único
      // lugar donde el mazo se mira entero.
      //
      // Están acá y no se calculan de `decks` porque `decks` se baraja de una ronda a
      // la otra: la misma pregunta contestada dos veces daría dos órdenes distintos, y
      // una lista que se reordena sola cada ronda se lee como un error. Juntas son
      // todo lo que tiene el jugador, que es lo que cuenta `ownedBy` por el otro lado.
      start,
      added: { p1: [], p2: [] },
      // La carta que atrapó la burbuja, esperando para abrir la ronda siguiente.
      bubbleCard: { p1: null, p2: null },
      // Cuántas cartas de la cadena en curso ya volvieron al mazo (ver `draw`).
      recycled: { p1: 0, p2: 0 },
      // Si la cadena entera ya volvió al mazo, al terminar el turno de ese jugador.
      returned: { p1: false, p2: false },
      totals: { p1: 0, p2: 0 },
      // Vida recuperada con la maceta. Va aparte de `totals` porque `totals` es
      // "daño repartido" y se usa para juzgar el intercambio, no para la vida.
      healed: { p1: 0, p2: 0 },
      // Las marcas de la partida: el ataque más fuerte que soltó cada uno y la cadena más
      // larga con la que atacó. La partida no las usa; son para la pantalla del final
      // (ver `result.js`), y se anotan acá porque después del golpe ya no se pueden
      // reconstruir: la cadena vuelve al mazo.
      records: { p1: { hit: 0, chain: 0 }, p2: { hit: 0, chain: 0 } },
      // Huevo, veneno, caracol y fuerza: lo que dejan puesto las cartas con poder.
      status: { p1: emptyStatus(), p2: emptyStatus() },
      chains: { p1: emptyChain(), p2: emptyChain() },
      roundScores: { p1: null, p2: null },
      // Si cada uno ya soltó el golpe de su última chance (ver `lastChance`).
      lastChanceUsed: { p1: false, p2: false },
      // Quién abre, para toda la partida. Contra la CPU es fijo a propósito (abajo);
      // entre dos personas se sortea.
      order: mode === 'net' && rng() < 0.5 ? ['p2', 'p1'] : ['p1', 'p2'],
      turn: null,
      phase: 'turn', // 'turn' | 'draft' | 'roundEnd' | 'matchEnd'
      draft: null,
      busy: false,
      // Lo que le queda a quien tiene que decidir (ver `armClock`), o `null`.
      clock: null,
      roundWinner: null,
      // Quién se fue y quién ganó con eso, si la partida terminó por abandono (ver
      // `forfeit`). Mientras nadie se vaya, `null`.
      forfeit: null,
      // Último golpe resuelto. La UI compara `id` con el que ya animó: mientras no
      // cambie no vuelve a sacudir a nadie, aunque el tablero se repinte diez veces.
      lastHit: null,
      hitId: 0,
      // El recorrido de la cadena, mientras dura: quién ataca y cuánto tarda en
      // recorrerse. La UI compara `id` con el que ya dibujó, igual que con `lastHit`.
      aiming: null,
      aimId: 0,
      // Los poderes que acaban de actuar y tienen animación propia (ver `POWER_BEAT`):
      // `{ id, player, fx: [{ power, moment, on, amount }] }`, en el orden en que se
      // muestran. `on` es el asiento sobre el que cae. Como `lastHit`, la UI compara `id`.
      powerFx: null,
      powerFxId: 0,
      // Si la bebida (Energy Drink) ya se volcó sobre el daño de la cadena de cada uno. La
      // bebida cuenta en el golpe desde que entra a la cadena, pero se ve recién al
      // plantarse: hasta entonces el número grande la deja afuera (ver `finishTurn`).
      poured: { p1: false, p2: false },
      freeGame: { p1: false, p2: false },
      pendingStack: null,
      lastStacked: null,
      stackId: 0,
      log: [],
      logId: 0,
      // El tutorial: una partida guionada donde el mazo y la reserva están puestos a
      // mano. `tutorial` marca la partida como tal y `onRoundStart` es un gancho que el
      // motor del tutorial engancha para poner los mazos de cada ronda antes de que se
      // repartan. Sin este gancho, `startRound` barajaría todo y se perdería el guión.
      tutorial: mode === 'tutorial',
      tutorialAllowed: null,
      tutorialAllowedCard: null,
      tutorialDisallowSkip: false,
      tutorialAllowRenew: false,
      tutorialPlainOnly: false,
      tutorialSkipDraft: false,
      tutorialBotStandAt: null,
      tutorialAllowedCol: null,
      onRoundStart,
      adventure: advCfg ? {
        level: advCfg.id,
        name: advCfg.name,
        newPowers: advCfg.newPowers,
        rival: advCfg.rival,
      } : null,
    };
    refillMarket();
    const versus = tr('{mine} contra {theirs}', {
      mine: `${mine.name} ${crest(mine.class, 'sm')}`,
      theirs: `${theirs.name} ${crest(theirs.class, 'sm')}`,
    });
    const hp = tr('{target} de vida cada uno.', { target: TARGET });
    log(
      mode === 'net' ? tr('{versus}, dos jugadores. {hp}', { versus, hp })
        : advCfg ? tr('Modo Aventura ({name}): {versus}. {hp}', { name: advCfg.name, versus, hp })
        : tr('Jugás con {versus}. {hp}', { versus, hp }),
      'muted',
    );
    return startRound(epoch);
  }

  async function startRound(era) {
    state.round++;
    // En el tutorial, el motor pone los mazos de cada ronda a mano antes de que se
    // repartan. Sin esto `deal` barajaría todo y se perdería el guión. La ronda 1 ya
    // tiene los mazos puestos por `scriptedDecks` en `newMatch`; las siguientes las
    // pone el gancho `onRoundStart` si existe.
    if (state.tutorial) {
      state.onRoundStart?.(state.round);
    } else {
      // Se rebaraja todo el mazo propio: lo de la ronda pasada y lo que se sumó del centro.
      for (const player of PLAYERS) state.decks[player] = deal(state.decks[player]);
    }
    state.recycled = { p1: 0, p2: 0 };
    state.returned = { p1: false, p2: false };
    state.chains = { p1: emptyChain(), p2: emptyChain() };
    state.poured = { p1: false, p2: false };
    state.roundScores = { p1: null, p2: null };
    state.roundWinner = null;
    state.draft = null;
    state.phase = 'turn';
    state.freeGame = { p1: false, p2: false };
    state.pendingStack = null;
    // El orden no se toca: es el que se sorteó al empezar la partida y vale para todas
    // las rondas. Antes se alternaba entre rondas, y como la ronda es un turno de cada
    // lado el orden que se veía de verdad era p1, p2 · p2, p1 · p1, p2: en cada cambio
    // de ronda el mismo bicho jugaba dos veces seguidas.
    //
    // La ventaja de cerrar —ver el golpe del otro antes de decidir— se la queda siempre
    // el segundo. Contra la CPU se la queda ella a propósito: es el lado que no la
    // necesita, y ahí el orden es fijo porque con él se midió todo el balance de los
    // poderes. Entre dos personas no hay ningún lado que la merezca, así que se sortea
    // al empezar (ver `newMatch`) — el que abre es el que le tocó, no el que se sentó
    // primero.
    log(tr('Ronda {round}', { round: state.round }), 'round');
    emit();
    if (!(await tick(350, era))) return;
    // Con alguien en su última chance la ronda es solo de él: al que abre lo mataron
    // cerrando el intercambio anterior, y su golpe es lo último de la partida.
    await beginTurn((!state.tutorial && lastChance(state)) || state.order[0], era);
  }

  /**
   * Suma daño repartido por `by`. En el tutorial la CPU nunca deja al jugador por debajo
   * de 20: el guión necesita que llegue entero a la ronda 5.
   */
  function addDamage(by, amount) {
    state.totals[by] += amount;
    if (state.tutorial && by === 'p2') {
      state.totals.p2 = Math.min(state.totals.p2, Math.max(0, TARGET + state.healed.p1 - 20));
    }
  }

  /** Una carta de Free Game que entra en la cadena deja montado el próximo robo. */
  function armFreeGame(player, card) {
    if (card.power !== 'freegame') return;
    state.freeGame[player] = true;
    log(`${powerIcon('freegame', 'sm')} ${tr('Free Game activo: tu próximo robo no corta y se monta sobre una carta')}`, player);
  }

  /** Monta `card` sobre la columna `col` de la cadena de `player` (Free Game). */
  function stackCard(player, col, card) {
    state.chains[player] = stackOnCard(state.chains[player], col, card);
    state.lastStacked = { player, colIndex: col, card, id: ++state.stackId };
    state.freeGame[player] = card.power === 'freegame';
    if (state.freeGame[player]) {
      log(`${powerIcon('freegame', 'sm')} ${tr('Free Game encadenado: el próximo robo también se monta en mesa')}`, player);
    }
    const stackMsg = voice(player).you
      ? tr('Vos montás {card} sobre la columna {col} alargándola → ataque de {swing}', {
          card: cardLabel(card),
          col: col + 1,
          swing: swingOf(state, player),
        })
      : tr('{who} monta {card} sobre la columna {col} alargándola → ataque de {swing}', {
          who: who(player),
          card: cardLabel(card),
          col: col + 1,
          swing: swingOf(state, player),
        });
    log(`${powerIcon('freegame', 'sm')} ${stackMsg}`, player);
  }

  /**
   * Juega `card` en la cadena de `player`. Si la corta, deja caer la carta `ms`, cierra
   * el turno en 0 y devuelve false.
   */
  async function extend(player, card, ms, era) {
    const next = playCard(state.chains[player], card);
    state.chains[player] = next;
    if (next.busted) {
      state.freeGame[player] = false;
      log(bustLine(player, card), 'bad');
      emit();
      // En el tutorial el corte se queda un rato a la vista: si pasa rápido, no se ve.
      if (await tick(state.tutorial ? ms * 3 : ms, era)) await finishTurn(player, 0, era);
      return false;
    }
    armFreeGame(player, card);
    const swingText = voice(player).you
      ? tr('Vos sacás {card} → ataque de {swing}', { card: cardLabel(card), swing: swingOf(state, player) })
      : tr('{who} saca {card} → ataque de {swing}', { who: who(player), card: cardLabel(card), swing: swingOf(state, player) });
    log(swingText, player);
    return true;
  }

  /** La Pluma Sagrada pega apenas sale del mazo, una vez por cada pluma de la carta. */
  function applyFeathers(player, card) {
    const count = unstack([card]).filter((c) => c.power === 'feather').length;
    if (count === 0) return;
    const foe = other(player);
    const dmg = count * TUNING.featherDamage;
    state.totals[player] += dmg;
    state.lastHit = {
      id: ++state.hitId,
      by: player,
      target: foe,
      amount: dmg,
      blocked: 0,
      broke: false,
      kind: 'feather',
    };
    const featherMsg = voice(foe).you
      ? tr('Pluma Sagrada le pega a vos por {dmg}: quedás en {hp}.', { dmg, hp: hpOf(state, foe) })
      : tr('Pluma Sagrada le pega {target} por {dmg}: queda en {hp}.', { target: toWhom(foe), dmg, hp: hpOf(state, foe) });
    log(`${powerIcon('feather', 'sm')} ${featherMsg}`, player);
  }

  /** Charm of Power suma fuerza permanente apenas aparece en mesa. */
  function applyStrength(player, card) {
    const count = unstack([card]).filter((c) => c.power === 'strength').length;
    if (count === 0) return;
    const mine = state.status[player];
    mine.strength += count * TUNING.strengthStep;
    stageFx({ power: 'strength', moment: 'draw', by: player, on: player, amount: count * TUNING.strengthStep });
    const strMsg = voice(player).you
      ? tr('Vos afilás: +{str} de daño de acá en más.', { str: mine.strength })
      : tr('{who} afila: +{str} de daño de acá en más.', { who: who(player), str: mine.strength });
    log(`${powerIcon('strength', 'sm')} ${strMsg}`, player);
  }

  async function beginTurn(player, era) {
    // Las hojas curan antes de robar: la cura se ve sola, con la mesa quieta, y no
    // encimada con el golpe y los poderes del final del turno. `turn` sigue vacío
    // mientras tanto, así que nadie puede robar ni plantarse en el medio.
    // Sin vida no hay cura: las hojas esperan (ver `heal`).
    if (state.status[player].leaf > 0 && hpOf(state, player) > 0) {
      tickLeaf(player);
      emit();
      if (!(await tick(Math.max(1000, POWER_BEAT.leaf.tick), era))) return;
    }
    if (lastChance(state) === player) {
      const lcMsg = voice(player).you
        ? tr('Última chance: a vos no le queda vida, pero sí este golpe. Si deja sin vida {foe}, empatan.', { foe: toWhom(other(player)) })
        : tr('Última chance: {target} no le queda vida, pero sí este golpe. Si deja sin vida {foe}, empatan.', { target: toWhom(player), foe: toWhom(other(player)) });
      log(lcMsg, 'round');
    }
    state.turn = player;
    armClock(player, 'turn');
    let card;
    const bubble = state.bubbleCard[player];
    if (bubble) {
      // La carta de la burbuja abre la ronda; con varias burbujas se le funden encima
      // las primeras del mazo en una carta gigante.
      state.bubbleCard[player] = null;
      const extra = [];
      for (let i = 1; i < bubble.count; i++) extra.push(draw(player));
      card = extra.length === 0 ? bubble.card : {
        ...bubble.card,
        symbols: [...bubble.card.symbols, ...extra.flatMap((c) => c.symbols)],
        stackedCards: [bubble.card, ...extra],
      };
      const bubbleMsg = extra.length
        ? (extra.length === 1
            ? (voice(player).you
                ? tr('Vos abrís con {card} y 1 carta más en una carta gigante', { card: cardLabel(bubble.card) })
                : tr('{who} abre con {card} y 1 carta más en una carta gigante', { who: who(player), card: cardLabel(bubble.card) }))
            : (voice(player).you
                ? tr('Vos abrís con {card} y {count} cartas más en una carta gigante', { card: cardLabel(bubble.card), count: extra.length })
                : tr('{who} abre con {card} y {count} cartas más en una carta gigante', { who: who(player), card: cardLabel(bubble.card), count: extra.length })))
        : (voice(player).you
            ? tr('Vos abrís con {card} de la burbuja', { card: cardLabel(bubble.card) })
            : tr('{who} abre con {card} de la burbuja', { who: who(player), card: cardLabel(bubble.card) }));
      log(`${powerIcon('bubble', 'sm')} ${bubbleMsg}`, player);
      stageFx({ power: 'bubble', moment: 'open', by: player, on: player, amount: bubble.count });
    } else {
      card = draw(player);
      const openMsg = voice(player).you
        ? tr('Vos abrís con {card}', { card: cardLabel(card) })
        : tr('{who} abre con {card}', { who: who(player), card: cardLabel(card) });
      log(openMsg, player);
    }
    state.chains[player] = playCard(state.chains[player], card);
    applyFeathers(player, card);
    applyStrength(player, card);
    armFreeGame(player, card);
    emit();
    if (isBot(player)) {
      if (!(await tick(800, era))) return;
      await botTurn(player, era);
    }
  }

  /**
   * Puntos de cadena que le alcanzan a la CPU para empatar en su última chance. Ya
   * está sin vida y este es su último turno: ganar no está sobre la mesa, y el empate
   * pide que el golpe se lleve toda la vida que le sobra al otro, huevo incluido.
   * Llegado ese número se planta y lo asegura (ver `decideDraw`).
   *
   * Va en puntos de cadena y no en daño porque es lo que mira `decideDraw`: hay que
   * deshacer los dos modificadores que `swingOf` mete entre la cadena y el golpe.
   * La fuerza se descuenta; el caracol se deshace al revés de como se aplica —para
   * que `ceil(golpe / s)` llegue a `wall` hace falta `s · (wall − 1) + 1`, o sea casi
   * el doble—.
   */
  function needsOf(player) {
    if (lastChance(state) !== player) return null;
    const foe = other(player);
    const mine = state.status[player];
    const wall = hpOf(state, foe) + state.status[foe].egg;
    const hit = mine.weak > 0 ? TUNING.snailShare * (wall - 1) + 1 : wall;
    return hit - mine.strength;
  }

  /**
   * La carta que corta la cadena, dicha igual la juegue quien la juegue. Es la misma
   * frase para los dos asientos y para los dos modos: lo único que cambia es la
   * persona del verbo.
   */
  const bustLine = (player, card) =>
    voice(player).you
      ? tr('Vos sacás {card}: se te desarma el ataque. 0 de daño.', { card: cardLabel(card) })
      : tr('{who} saca {card}: se le desarma el ataque. 0 de daño.', { who: who(player), card: cardLabel(card) });

  function pickStackColumn(chain, card) {
    if (!chain || chain.cards.length <= 1) return 0;
    let bestCol = 0;
    let bestScore = -1;
    for (let i = 0; i < chain.cards.length; i++) {
      const sim = stackOnCard(chain, i, card);
      const score = scoreChain(sim).total;
      if (score > bestScore) {
        bestScore = score;
        bestCol = i;
      }
    }
    return bestCol;
  }

  /** El turno de un asiento que juega la máquina. Solo puede ser `p2` (ver `isBotSeat`). */
  async function botTurn(player, era) {
    state.busy = true;
    const needs = needsOf(player);
    if (needs !== null) {
      log(tr('{target} le alcanza una cadena de {needs} para empatar.', { target: cap(toWhom(player)), needs: Math.max(needs, 0) }), 'muted');
    }

    for (;;) {
      emit();
      if (!(await tick(750, era))) return;
      const chain = state.chains[player];

      const isFree = state.freeGame[player];
      let willStand = false;
      if (state.tutorial) {
        // La CPU del tutorial ataca con las cartas que diga el guión; sin tope, roba
        // hasta cortarse (ver `BOT_STAND_AT` en `tutorial.js`).
        willStand = chain.cards.length >= (state.tutorialBotStandAt ?? 2);
      } else {
        willStand = !isFree && !decideDraw(chain, unseenPool(player), {
          needs, difficulty: state.difficulty, view: attackViewOf(state, player),
        });
      }

      if (willStand) {
        const points = scoreChain(chain).total;
        const standMsg = voice(player).you
          ? tr('Vos cerrás su ataque con {points}.', { points })
          : tr('{who} cierra su ataque con {points}.', { who: who(player), points });
        log(standMsg, player);
        await finishTurn(player, points, era);
        return;
      }

      const card = draw(player);
      applyFeathers(player, card);
      applyStrength(player, card);
      if (isFree) stackCard(player, pickStackColumn(chain, card), card);
      else if (!(await extend(player, card, 600, era))) return;
    }
  }

  /**
   * Los poderes de las cartas que salieron este turno, incluida la que cortó la
   * cadena: el poder es de la carta, no del ataque. El pulpo no aparece acá —ya
   * corrió al salir del mazo—.
   */
  function powersPlayed(player) {
    const chain = state.chains[player];
    const baseCards = chain.bustCard ? [...chain.cards, chain.bustCard] : chain.cards;
    const cards = baseCards.flatMap((c) => c.stackedCards || [c]);
    return cards.map((c) => c.power).filter(Boolean);
  }

  /**
   * Cura a `player` sin pasarse de la vida inicial y devuelve cuánto curó de verdad.
   * Recortar acá y no en `hpOf` es lo que mantiene la cuenta honesta: si `healed`
   * guardara curación desperdiciada, después amortiguaría golpes que sí tendrían
   * que entrar.
   */
  function heal(player, amount) {
    // En la última chance no hay cura: sin esto la maceta o la daga levantaban del cero
    // al que solo tenía que devolver un golpe.
    if (hpOf(state, player) <= 0) return 0;
    const room = TARGET - hpOf(state, player);
    const got = Math.min(amount, room);
    state.healed[player] += got;
    return got;
  }

  /**
   * Los poderes jugados en el turno, todos juntos al soltar el ataque. Casi todos se
   * miden contra el daño del golpe —el huevo, el veneno, el caracol, la maceta y la
   * fuerza salen de él—, así que un ataque en cero no deja nada puesto. El pulpo es
   * el único que cobra igual, porque no se mide contra el daño sino contra haberse
   * plantado.
   *
   * Cada uno queda anotado para la pantalla (ver `stageFx`).
   */
  function applyPowers(player, swing) {
    const foe = other(player);
    const mine = state.status[player];
    const theirs = state.status[foe];
    const kind = player;
    const mark = (id) => powerIcon(id, 'sm');

    for (const power of powersPlayed(player)) {
      if (power === 'octopus' && (!TUNING.octopusOnStand || !state.chains[player].busted)) {
        mine.stacked++;
        stageFx({ power: 'octopus', moment: 'apply', by: player, on: player, amount: mine.stacked });
        const octMsg = mine.stacked === 1
          ? (voice(player).you
              ? tr('Vos vas a elegir una carta extra para tu mazo.')
              : tr('{who} va a elegir una carta extra para tu mazo.', { who: who(player) }))
          : (voice(player).you
              ? tr('Vos vas a elegir {count} cartas extra para tu mazo.', { count: mine.stacked })
              : tr('{who} va a elegir {count} cartas extra para tu mazo.', { who: who(player), count: mine.stacked }));
        log(`${mark('octopus')} ${octMsg}`, kind);
      } else if (power === 'bubble' && !state.chains[player].busted) {
        mine.bubbles = (mine.bubbles || 0) + 1;
        stageFx({ power: 'bubble', moment: 'apply', by: player, on: player, amount: mine.bubbles });
        const bubMsg = voice(player).you
          ? tr('Vos atrapás la apertura en una burbuja: la carta que elijas del centro abrirá tu próxima ronda.')
          : tr('{who} atrapa la apertura en una burbuja: la carta que elijas del centro abrirá tu próxima ronda.', { who: who(player) });
        log(`${mark('bubble')} ${bubMsg}`, kind);
      } else if (power === 'freegame') {
        // Free Game actúa al robar/apilar; no tiene efecto de ataque al cerrar el turno.
      } else if (power === 'feather') {
        // La pluma ya pegó directo al salir del mazo.
      } else if (power === 'strength') {
        // Charm of Power ya sumó fuerza directo al aparecer en mesa.
      } else if (power === 'poison' && !state.chains[player].busted) {
        // El veneno no se mide contra el golpe: cada frasco pone una dosis fija, alcanza
        // con plantarse. Sumar o quedarse con el mayor es la diferencia entre un veneno
        // que se acumula con cada frasco y uno que respeta la regla del caracol.
        const dose = TUNING.poisonDose;
        theirs.poison = TUNING.poisonStacks ? theirs.poison + dose : Math.max(theirs.poison, dose);
        stageFx({ power: 'poison', moment: 'apply', by: player, on: foe, amount: dose });
        const poiMsg = voice(foe).you
          ? tr('Vos quedás con {poison} de veneno.', { poison: theirs.poison })
          : tr('{who} queda con {poison} de veneno.', { who: who(foe), poison: theirs.poison });
        log(`${mark('poison')} ${poiMsg}`, kind);
      } else if (swing <= 0) {
        // Sin daño no hay poder. Ninguno: un ataque que no salió no envenena,
        // no debilita, no cura y no pone huevo.
        // El pulpo sigue afuera de esta regla porque no se mide contra el daño
        // sino contra plantarse, que es una decisión y no un resultado.
        log(`${mark(power)} ${tr('{name} sin efecto: el ataque hizo 0.', { name: tr(POWERS[power].name) })}`, 'muted');
      } else if (power === 'snail') {
        // Los caracoles se suman y no hay nada más que guardar: cuántos ataques, y
        // listo. El golpe con que se lo pusieron ya no entra en la cuenta —era lo que
        // hacía que el mismo caracol valiera cuatro veces más en manos del que venía
        // pegando fuerte—, así que este poder es el único de los seis que se mide
        // contra el daño para salir pero no para cuánto pega.
        theirs.weak += TUNING.snailAttacks;
        stageFx({ power: 'snail', moment: 'apply', by: player, on: foe, amount: theirs.weak });
        const snailMsg = theirs.weak === 1
          ? (voice(foe).you
              ? tr('Vos quedás debilitado: su próximo ataque pega la mitad.')
              : tr('{who} queda debilitado: su próximo ataque pega la mitad.', { who: who(foe) }))
          : (voice(foe).you
              ? tr('Vos quedás debilitado: sus próximos {weak} ataques pegan la mitad.', { weak: theirs.weak })
              : tr('{who} queda debilitado: sus próximos {weak} ataques pegan la mitad.', { who: who(foe), weak: theirs.weak }));
        log(`${mark('snail')} ${snailMsg}`, kind);
      } else if (power === 'egg') {
        // El escudo se suma al que ya había —otro huevo, la máscara—, y la cáscara
        // también. Siempre al menos 1: un huevo sin escudo cargaría una cáscara que no
        // tiene qué romper.
        const gain = Math.max(1, Math.floor(swing / TUNING.eggShare));
        mine.egg += gain;
        mine.eggBreak = (mine.eggBreak || 0) + TUNING.eggBreak;
        stageFx({ power: 'egg', moment: 'apply', by: player, on: player, amount: gain });
        const eggMsg = voice(player).you
          ? tr('Vos quedás con un huevo de {egg}.', { egg: mine.egg })
          : tr('{who} queda con un huevo de {egg}.', { who: who(player), egg: mine.egg });
        log(`${mark('egg')} ${eggMsg}`, kind);
      } else if (power === 'pot') {
        const got = heal(player, swing);
        stageFx({ power: 'pot', moment: 'apply', by: player, on: player, amount: got });
        const potMsg = got > 0
          ? (voice(player).you
              ? tr('Vos te curás {got} y quedás en {hp}.', { got, hp: hpOf(state, player) })
              : tr('{who} se cura {got} y queda en {hp}.', { who: who(player), got, hp: hpOf(state, player) }))
          : hpOf(state, player) <= 0
            ? (voice(player).you
                ? tr('Vos no te podés curar en la última chance: la maceta no cura nada.')
                : tr('{who} no se puede curar en la última chance: la maceta no cura nada.', { who: who(player) }))
            : (voice(player).you
                ? tr('Vos ya estás entero: la maceta no cura nada.')
                : tr('{who} ya está entero: la maceta no cura nada.', { who: who(player) }));
        log(`${mark('pot')} ${potMsg}`, got > 0 ? kind : 'muted');
      } else if (power === 'brutal') {
        const longest = longestRun(state.chains[player]);
        if (longest > 0) {
          const step = TUNING.brutalStep;
          const brutMsg = voice(player).you
            ? tr('Vos desgarrás: +{dmg} de daño (+{step} × {longest} de tu cadena más larga).', { dmg: step * longest, step, longest })
            : tr('{who} desgarra: +{dmg} de daño (+{step} × {longest} de tu cadena más larga).', { who: who(player), dmg: step * longest, step, longest });
          log(`${mark('brutal')} ${brutMsg}`, kind);
        }
      } else if (power === 'leaf') {
        mine.leaf = Math.min(TUNING.leafMax, mine.leaf + TUNING.leafGain);
        stageFx({ power: 'leaf', moment: 'apply', by: player, on: player, amount: TUNING.leafGain });
        const leafMsg = voice(player).you
          ? tr('Vos sumás +{gain} hojas (Leaf) ({leaf}/{max}): curará +{heal} de vida al inicio de tu próximo turno.', {
              gain: TUNING.leafGain,
              leaf: mine.leaf,
              max: TUNING.leafMax,
              heal: mine.leaf * TUNING.leafHeal,
            })
          : tr('{who} suma +{gain} hojas (Leaf) ({leaf}/{max}): curará +{heal} de vida al inicio de su próximo turno.', {
              who: who(player),
              gain: TUNING.leafGain,
              leaf: mine.leaf,
              max: TUNING.leafMax,
              heal: mine.leaf * TUNING.leafHeal,
            });
        log(`${mark('leaf')} ${leafMsg}`, kind);
      } else if (power === 'leech') {
        const drain = TUNING.leechDrain;
        state.totals[player] += drain;
        const got = heal(player, drain);
        stageFx({ power: 'leech', moment: 'apply', by: player, on: foe, amount: drain, heal: got });
        const healStr = got > 0
          ? (voice(player).you ? tr(' y te curás {got}', { got }) : tr(' y se cura {got}', { got }))
          : '';
        const foeEndStr = voice(foe).you
          ? tr('Vos quedás en {hp}.', { hp: hpOf(state, foe) })
          : tr('{who} queda en {hp}.', { who: who(foe), hp: hpOf(state, foe) });
        const drainMsg = voice(player).you
          ? tr('Vos drenás {drain} de vida {target}{bonus}{heal}: {foeEnd}', {
              drain,
              target: toWhom(foe),
              bonus: '',
              heal: healStr,
              foeEnd: foeEndStr,
            })
          : tr('{who} drena {drain} de vida {target}{bonus}{heal}: {foeEnd}', {
              who: who(player),
              drain,
              target: toWhom(foe),
              bonus: '',
              heal: healStr,
              foeEnd: foeEndStr,
            });
        log(`${mark('leech')} ${drainMsg}`, kind);
      } else if (power === 'steelskin') {
        // La primera pone el tope; cada una más lo baja, hasta el piso. Y cada una suma
        // escudo, que se apila con el del huevo.
        mine.steelskin = mine.steelskin > 0
          ? Math.max(TUNING.steelskinFloor, mine.steelskin - TUNING.steelskinStep)
          : TUNING.steelskinBaseCap;
        mine.egg += TUNING.steelskinShield;
        stageFx({ power: 'steelskin', moment: 'apply', by: player, on: player, amount: mine.steelskin, shield: TUNING.steelskinShield });
        const steelMsg = voice(player).you
          ? tr('Vos te ponés la Gecko Mask: +{shield} de escudo, y el próximo golpe rival te saca {cap} de vida como máximo.', { cap: mine.steelskin, shield: TUNING.steelskinShield })
          : tr('{who} se pone la Gecko Mask: +{shield} de escudo, y el próximo golpe rival le saca {cap} de vida como máximo.', { who: who(player), cap: mine.steelskin, shield: TUNING.steelskinShield });
        log(`${mark('steelskin')} ${steelMsg}`, kind);
      }
    }
  }

  async function finishTurn(player, points, era) {
    const foe = other(player);
    const mine = state.status[player];
    const theirs = state.status[foe];

    // Antes del golpe, la cadena se recorre. Es lo primero que pasa y por eso el reloj
    // se apaga acá y no más abajo: la decisión ya está tomada, y un reloj que siguiera
    // corriendo podría cortar la cadena en medio de su propio recorrido.
    //
    // Solo se recorre lo que hay para recorrer: el ataque que se cortó —o el que se
    // quedó sin tiempo— no tiene cadena que mostrar, ya se vio caer la carta que lo
    // rompió, y meterle una pausa acá sería hacerlo esperar por nada.
    stopClock();
    // La bebida se activa al plantarse, antes que nada: se vuelca sobre el número de
    // daño, que sube contando lo que suma, y recién después la cadena se recorre. Cuenta
    // en el golpe desde que entró a la cadena (ver `brutalBonusOf`), pero hasta acá la
    // pantalla la dejaba afuera y marcaba la racha más larga, que es la que la mide.
    const drink = swingOf(state, player) - swingOf(state, player, { brutal: false });
    state.poured[player] = true;
    if (drink > 0) {
      const fx = { power: 'brutal', moment: 'stand', by: player, on: player, amount: drink };
      stageFx(fx);
      emit();
      if (!(await tick(powerBeat(fx), era))) return;
    }
    const aimed = state.chains[player];
    if (!aimed.busted && aimed.cards.length > 0) {
      const ms = aimMs(aimed.cards.length);
      state.aiming = { id: ++state.aimId, player, ms };
      emit();
      if (!(await tick(ms, era))) return;
      state.aiming = null;
    }

    const swing = swingOf(state, player);
    const brutal = brutalBonusOf(state.chains[player]);
    if (swing > 0) {
      const record = state.records[player];
      record.hit = Math.max(record.hit, swing);
      record.chain = Math.max(record.chain, state.chains[player].cards.length);
    }
    // El caracol se gasta con un ataque que haya hecho daño, y no con el turno: una
    // cadena cortada no le paga el caracol a nadie. Si se gastara igual, el debilitado
    // se lo sacaría de encima justo con el turno que ya venía perdido.
    //
    // Por ataque y no por ronda, eso sí: así dura siempre lo mismo, sin depender de si
    // le tocaba abrir o cerrar el intercambio.
    const weakened = mine.weak > 0 && swing > 0;
    if (weakened) mine.weak--;
    // Lo que se anote de acá hasta el `emit` del golpe es de este ataque.
    const fxBefore = state.powerFxId;
    fxOpen = false;
    if (weakened) stageFx({ power: 'snail', moment: 'slow', by: foe, on: player, amount: swing });
    if (swing !== points) {
      const mods = [
        mine.strength ? tr('+{str} de fuerza', { str: mine.strength }) : '',
        brutal ? tr('+{brutal} de Energy Drink', { brutal }) : '',
        weakened ? tr('partido al medio por el caracol') : '',
      ].filter(Boolean);
      const swingMsg = voice(player).you
        ? tr('Vos atacás por {swing}: {points} de cadena {mods}.', { swing, points, mods: mods.join(', ') })
        : tr('{who} ataca por {swing}: {points} de cadena {mods}.', { who: who(player), swing, points, mods: mods.join(', ') });
      log(swingMsg, 'muted');
    }

    // Primero el escudo del rival —huevos y máscaras, todo junto—, que se come lo que
    // puede y solo se rompe cuando se gasta: si le sobra, sigue puesto para el próximo
    // golpe.
    const blocked = Math.min(theirs.egg, swing);
    // La cáscara: daño fijo acumulable que devuelve al romperse (8 por cada huevo
    // acumulado). Solo la cargan los huevos: el escudo de la máscara no devuelve nada.
    let thorns = 0;
    let broke = false;
    if (blocked > 0) {
      theirs.egg -= blocked;
      broke = theirs.egg === 0;
      if (broke) {
        thorns = theirs.eggBreak || 0;
        theirs.eggBreak = 0;
      }
      const rest = broke
        ? (thorns > 0
            ? (voice(player).you
                ? tr(' y se rompe: la cáscara le devuelve {thorns} a vos', { thorns })
                : tr(' y se rompe: la cáscara le devuelve {thorns} {target}', { thorns, target: toWhom(player) }))
            : tr(' y se rompe'))
        : tr(' y le quedan {egg}', { egg: theirs.egg });
      const shieldMsg = voice(foe).you
        ? tr('Tu escudo aguanta {blocked}{rest}.', { blocked, rest })
        : tr('El escudo {owner} aguanta {blocked}{rest}.', { owner: ofWhom(foe), blocked, rest });
      log(`${powerIcon('egg', 'sm')} ${shieldMsg}`, 'muted');
    }

    // Después el tope de la máscara, sobre lo que pasó el escudo: es un tope a la vida,
    // no al golpe. Se gasta cuando algo le llega a la vida; un golpe que se come
    // entero el escudo no la toca.
    let landed = swing - blocked;
    let mitigated = 0;
    if (theirs.steelskin > 0 && landed > 0) {
      if (landed > theirs.steelskin) {
        mitigated = landed - theirs.steelskin;
        landed = theirs.steelskin;
        stageFx({ power: 'steelskin', moment: 'block', by: foe, on: foe, amount: theirs.steelskin, mitigated });
        const steelMsg = voice(foe).you
          ? tr('Tu Gecko Mask frena el golpe: mitiga {mitigated} de daño (tope máximo {cap}).', { mitigated, cap: theirs.steelskin })
          : tr('La Gecko Mask {owner} frena el golpe: mitiga {mitigated} de daño (tope máximo {cap}).', { owner: ofWhom(foe), mitigated, cap: theirs.steelskin });
        log(`${powerIcon('steelskin', 'sm')} ${steelMsg}`, foe);
      }
      theirs.steelskin = 0;
    }
    // Lo que vale el ataque para los poderes del que pegó: lo que frenó la máscara no
    // cuenta, lo que se comió el escudo sí (como siempre con el huevo).
    const effectiveSwing = swing - mitigated;

    state.roundScores[player] = effectiveSwing;
    // Si era su última chance, este es el golpe: el halo se apaga cuando cae.
    if (lastChance(state) === player) state.lastChanceUsed[player] = true;
    // El turno se cierra acá mismo. Si no, entre el golpe y el turno del otro queda
    // una ventana con `turn` todavía puesto y los botones vivos: alcanzaba para
    // plantarse dos veces y aplicar el daño dos veces.
    state.turn = null;
    stopClock();
    // El daño entra acá y no al cerrar la ronda: el golpe tiene que verse cuando el
    // jugador lo suelta, no dos turnos después. Los totales terminan iguales.
    addDamage(player, landed);
    state.busy = false;
    const target = effectiveSwing > 0 ? foe : player;
    // Un ataque hace 0 por dos motivos distintos y la pantalla los cuenta distinto: si
    // la cadena se cortó, el fallo ya se vio y se oyó cuando cayó la carta —no hay
    // nada nuevo que mostrar—; si se plantó y el caracol se lo comió, este es el
    // primer momento en que el jugador se entera. `kind` es lo que los separa, y sale
    // de acá porque es el juego el que sabe por qué el golpe quedó en cero.
    const kind = effectiveSwing <= 0 && state.chains[player].busted ? { kind: 'bust' } : null;
    // `broke` viaja con el golpe para que la pantalla pueda decir en el momento por
    // qué, un beat después, le vuelve un número al que pegó (ver `playHit`).
    state.lastHit = { id: ++state.hitId, by: player, target, amount: landed, blocked, broke, ...kind };
    if (landed > 0) {
      const hitMsg = voice(player).you
        ? tr('Vos pegás por {landed}. {who} queda en {hp}.', { landed, who: who(target), hp: hpOf(state, target) })
        : (voice(target).you
            ? tr('{who} pega por {landed}. Vos quedás en {hp}.', { who: who(player), landed, hp: hpOf(state, target) })
            : tr('{who} pega por {landed}. {target} queda en {hp}.', { who: who(player), landed, target: who(target), hp: hpOf(state, target) }));
      log(hitMsg, player);
    }
    applyPowers(player, effectiveSwing);
    const staged = state.powerFxId !== fxBefore ? state.powerFx.fx : [];
    emit();

    // Sus cartas vuelven al mazo antes de repartirle: lo que se lleve del centro entra
    // sobre el mazo completo, y la cadena sigue en pantalla hasta que cierre la ronda.
    const chain = state.chains[player];
    const played = chain.cards.flatMap((c) => c.stackedCards || [c]);
    state.decks[player].push(...played.slice(state.recycled[player]));
    if (chain.bustCard) state.decks[player].push(chain.bustCard);
    state.returned[player] = true;

    // Un golpe que conecta se mira entero, y "entero" es más largo de lo que parece:
    // el efecto de clase tarda hasta 700 ms en llegar al impacto (`hitDelay`) y recién
    // ahí sale el número, que flota 900 ms más. Con 900 de espera el centro se abría
    // encima del número todavía subiendo, y el jugador terminaba de leer cuánto le
    // pegaron abajo del panel de cartas. Ahora la espera cubre el golpe completo y
    // deja un beat después, antes de cambiar de tema.
    //
    // El ataque que se desarmó tiene su propio cartel —"fallo", 900 ms desde el
    // impacto—, pero solo cuando se plantó: con la cadena cortada el desplome (slump)
    // dura 1600 ms, y el fallo flotante 900 ms. Con 1000 ms para bust (sumado a los 700 ms
    // de caída) o 1700 ms para fallo por plantarse, la animación termina por completo
    // antes de que se abra el centro.
    //
    // Los poderes con animación propia salen después del golpe, de a uno y completos:
    // con alguno en juego la espera es la que ellos pidan, si es más larga.
    const powersMs = staged.length ? POWER_LEAD + staged.reduce((ms, fx) => ms + powerBeat(fx), 0) : 0;
    const shown = Math.max(swing > 0 ? 1800 : state.chains[player].busted ? 1000 : 1700, powersMs);
    if (!(await tick(shown, era))) return;

    // Y recién ahí contesta la cáscara, con su propio golpe en sentido contrario. Va
    // después y no junto con el ataque porque son dos cosas distintas —le pegaste, y
    // el huevo te contestó— y encimadas se leen como un solo número mal sumado.
    //
    // El daño se aplica acá, del otro lado del `tick`, y por eso el `return` de arriba
    // no lo pierde: cuando `tick` da false es porque arrancó otra partida y `state` ya
    // es otro objeto. Sumárselo ahí le metería daño de la partida anterior a la nueva.
    if (thorns > 0) {
      addDamage(foe, thorns);
      state.lastHit = {
        id: ++state.hitId, by: foe, target: player, amount: thorns, blocked: 0, broke: false,
        kind: 'thorns',
      };
      const shellMsg = voice(player).you
        ? tr('La cáscara le vuelve a vos por {thorns}: quedás en {hp}.', { thorns, hp: hpOf(state, player) })
        : tr('La cáscara le vuelve {target} por {thorns}: queda en {hp}.', { target: toWhom(player), thorns, hp: hpOf(state, player) });
      log(`${powerIcon('egg', 'sm')} ${shellMsg}`, foe);
      emit();
      // La cáscara sale en el momento —no hay efecto de clase que esperar—, así que
      // con 900 alcanzaba justo para su número y ni un instante más: cerraba al mismo
      // tiempo que la animación. Un beat más y se termina de ver.
      if (!(await tick(1300, era))) return;
    }

    if (state.status[player].poison > 0) {
      tickPoison(player);
      emit();
      if (!(await tick(Math.max(1000, POWER_BEAT.poison.tick), era))) return;
    }

    // Con alguien sin vida no hay mazo que armar: o la partida ya está resuelta, o
    // solo queda el golpe de la última chance.
    if (matchOver()) return endRound(era);
    if (lastChance(state)) return afterDraft(era);
    await startDraft(player, era);
  }

  // Con la maceta curando y el veneno mordiendo fuera del ataque, "llegó a 100 de
  // daño" ya no equivale a "lo dejó sin vida": la partida se cierra por vida.
  // En el tutorial la partida nunca termina antes de la ronda 5, garantizando que
  // el jugador complete todas las etapas guiadas.
  //
  // Alguien sin vida no la cierra mientras le quede la última chance (ver `lastChance`).
  const matchOver = () => {
    const down = PLAYERS.filter((p) => hpOf(state, p) <= 0);
    if (state.tutorial) return state.round >= 5 && down.includes('p2') && lastChance(state) !== 'p2';
    return down.length > 0 && !lastChance(state);
  };

  /** Terminado el reparto de un jugador: juega el que falta, o cierra el intercambio. */
  async function afterDraft(era) {
    const pending = state.order.find((p) => state.roundScores[p] === null);
    if (pending) {
      state.phase = 'turn';
      emit();
      if (!(await tick(600, era))) return;
      await beginTurn(pending, era);
    } else {
      await endRound(era);
    }
  }

  /**
   * Las hojas (Leaf) curan al empezar el turno de quien las tiene, antes de robar:
   * curan 4 de vida por cada hoja activa y luego se consume una hoja.
   */
  function tickLeaf(player) {
    const st = state.status[player];
    const leaves = st.leaf;
    const got = heal(player, leaves * TUNING.leafHeal);
    const left = --st.leaf;
    stageFx({ power: 'leaf', moment: 'tick', by: player, on: player, amount: got });
    const leftMsg = left > 0
      ? (left === 1 ? tr(' (le queda 1 hoja)') : tr(' (le quedan {left} hojas)', { left }))
      : tr(' (se consumió la última hoja)');
    const leafCountStr = leaves === 1 ? tr('1 hoja') : tr('{leaves} hojas', { leaves });
    const body = got > 0
      ? (voice(player).you
          ? tr('Vos te curás +{got} de vida ({leafCount}) y quedás en {hp}.', { got, leafCount: leafCountStr, hp: hpOf(state, player) })
          : tr('{who} se cura +{got} de vida ({leafCount}) y queda en {hp}.', { who: who(player), got, leafCount: leafCountStr, hp: hpOf(state, player) }))
      : (voice(player).you
          ? tr('Vos ya estás entero ({leafCount}).', { leafCount: leafCountStr })
          : tr('{who} ya está entero ({leafCount}).', { who: who(player), leafCount: leafCountStr }));
    log(`${powerIcon('leaf', 'sm')} ${tr('Hoja (Leaf):')} ${body}${leftMsg}`, player);
    return got;
  }

  /**
   * El veneno se cobra al finalizar el turno de quien lo tiene encima: muerde
   * por su cuenta entera y recién después se parte al medio. Cuenta como daño de
   * quien lo puso, así que suma a su total como cualquier golpe.
   *
   * Partirse al medio y no bajar de a dos: un veneno grande pega fuerte dos o tres
   * rondas y se apaga, en vez de arrastrarse media partida sacando 2. Y como esa
   * mitad nunca llega sola a cero, `poisonFloor` la corta: con 2 o menos encima el
   * veneno ya mordió lo que tenía para morder y se va.
   *
   * No pasa por el escudo ni por el tope de la máscara: el veneno va directo a la vida.
   */
  function tickPoison(player) {
    const st = state.status[player];
    if (st.poison <= 0) return;
    const bite = st.poison;
    addDamage(other(player), bite);
    const half = Math.floor(bite / TUNING.poisonHalve);
    const left = half <= TUNING.poisonFloor ? 0 : half;
    const poisonEnd = left > 0
      ? tr(' y le baja a {left}', { left })
      : tr(' y se le va');
    const poisonMsg = voice(player).you
      ? tr('El veneno le saca {bite} a vos: quedás en {hp}{poisonEnd}.', { bite, hp: hpOf(state, player), poisonEnd })
      : tr('El veneno le saca {bite} {target}: queda en {hp}{poisonEnd}.', { bite, target: toWhom(player), hp: hpOf(state, player), poisonEnd });
    log(`${powerIcon('poison', 'sm')} ${poisonMsg}`, other(player));
    st.poison = left;
    stageFx({ power: 'poison', moment: 'tick', by: other(player), on: player, amount: bite });
  }

  async function endRound(era) {
    const { p1, p2 } = state.roundScores;
    state.turn = null;
    // El daño ya está aplicado (ver `finishTurn`); acá solo se juzga el intercambio. Si
    // uno no llegó a atacar —la partida se cerró antes, o la ronda era solo de una
    // última chance— no hay intercambio que juzgar.
    state.roundWinner = null;
    if (p1 !== null && p2 !== null) {
      state.roundWinner = p1 === p2 ? 'tie' : p1 > p2 ? 'p1' : 'p2';
      const verdict =
        state.roundWinner === 'tie'
          ? tr('Pegaron igual')
          : tr('Pegó más fuerte {winner}', { winner: whom(state.roundWinner) });
      log(
        tr('Fin del intercambio {round}: {p1} vs {p2} de daño. {verdict}. Vida {hp1} — {hp2}.', {
          round: state.round,
          p1,
          p2,
          verdict,
          hp1: hpOf(state, 'p1'),
          hp2: hpOf(state, 'p2'),
        }),
        'round',
      );
    }

    const down = PLAYERS.filter((p) => hpOf(state, p) <= 0);
    if (!state.tutorial && down.length === 1 && !state.lastChanceUsed[down[0]] && matchOver()) {
      const extra = overkillOf(state, down[0]);
      log(voice(down[0]).you
        ? tr('Overkill: te pegaron {extra} de más y no tenés última chance.', { extra })
        : tr('Overkill: {who} recibió {extra} de más y no tiene última chance.', { who: who(down[0]), extra }), 'bad');
    }

    state.phase = matchOver() ? 'matchEnd' : 'roundEnd';
    emit();
    if (state.phase !== 'roundEnd') return;

    // El cierre se muestra un momento y la ronda siguiente arranca sola. Apretar
    // "Siguiente ronda" no decidía nada —el veredicto ya estaba escrito— y partía el
    // combate en tarjetas: se leía el cartel, se buscaba el botón, recién ahí seguía.
    // El cartel se sigue viendo; lo que se fue es el trámite.
    //
    // Va suelto, sin `await`: el que cerró el intercambio no se queda esperando al
    // siguiente. Encadenado, la llamada que soltó el ataque no volvería hasta el
    // final de la partida, con una promesa por ronda colgando de la anterior.
    const closed = state.round;
    void (async () => {
      if (!(await tick(1100, era))) return;
      // `nextRound` puede haberlo adelantado mientras tanto: si ya arrancó otra
      // ronda, esta corrutina no tiene nada que hacer.
      if (state.phase !== 'roundEnd' || state.round !== closed) return;
      await startRound(era);
    })();
  }

  // ---- reparto de la reserva --------------------------------------------------

  /**
   * Qué le corresponde a `player` según cómo terminó su ronda. Plantado elige entre
   * dos cartas sin poder o una con poder; cortado, una sin poder y nada más — los
   * poderes son el premio de haber soltado el ataque.
   */
  const awardKind = (player) => awardKindOf(state, player);

  const plainCards = () => plainCardsOf(state);

  function refillMarket() {
    while (state.market.length < MARKET_SIZE && state.pool.length) {
      state.market.push(state.pool.pop());
    }
  }


  /** Pasa `card` del centro al mazo de `player`, o a su burbuja si tiene una puesta. */
  function takeFromMarket(player, card) {
    const at = state.market.indexOf(card);
    if (at < 0) return;
    state.market.splice(at, 1);
    state.added[player].push(card);
    const count = state.status[player].bubbles;
    if (count > 0) {
      state.status[player].bubbles = 0;
      state.bubbleCard[player] = { card, count };
      stageFx({ power: 'bubble', moment: 'trap', by: player, on: player, amount: count });
      const bubbleMore = count > 1
        ? (count - 1 === 1
            ? tr(' junto a 1 carta más en una carta gigante')
            : tr(' junto a {more} cartas más en una carta gigante', { more: count - 1 }))
        : '';
      const bubbleMsg = voice(player).you
        ? tr('Vos atrapás {card} en la burbuja: abrirá tu próxima ronda{more}.', { card: cardLabel(card), more: bubbleMore })
        : tr('{who} atrapa {card} en la burbuja: abrirá tu próxima ronda{more}.', { who: who(player), card: cardLabel(card), more: bubbleMore });
      log(`${powerIcon('bubble', 'sm')} ${bubbleMsg}`, player);
    } else {
      state.decks[player].push(card);
      const deckMsg = voice(player).you
        ? tr('Vos sumás {card} al mazo.', { card: cardLabel(card) })
        : tr('{who} suma {card} al mazo.', { who: who(player), card: cardLabel(card) });
      log(deckMsg, player);
    }
    // Se repone en el acto, en el mismo hueco para que las cartas no salten de lugar.
    if (state.pool.length) state.market.splice(at, 0, state.pool.pop());
  }

  const draftable = (player) => draftableFor(state, player);
  const canRenew = (player) => canRenewFor(state, player);

  /** Lo que está a la vista se va al fondo de la reserva y salen 6 cartas nuevas. */
  function renew(player) {
    state.draft.renewed[player] = true;
    state.pool.unshift(...state.market.splice(0, state.market.length));
    refillMarket();
    const renewMsg = voice(player).you
      ? tr('Vos renovás el centro: no había nada con {crest}.', { crest: crest(state.symbols[player], 'sm') })
      : tr('{who} renueva el centro: no había nada con {crest}.', { who: who(player), crest: crest(state.symbols[player], 'sm') });
    log(renewMsg, player);
  }

  /** El reparto de `player`, apenas cierra su turno y antes de que juegue el otro. */
  async function startDraft(player, era) {
    state.draft = {
      order: [player],
      index: 0,
      // 'normal' es el reparto de siempre —una carta con poder o dos sin—; 'bonus'
      // son las cartas sueltas que debe cada pulpo, una por pulpo.
      step: 'normal',
      mode: null,
      remaining: 0,
      took: 0,
      bonus: 0,
      renewed: { p1: false, p2: false },
    };
    state.phase = 'draft';
    await runDraft(era);
  }

  const drafting = () => draftingSeat(state);

  /** Cierra el reparto de quien esté eligiendo y pasa al siguiente. */
  function nextDrafter() {
    state.draft.index++;
    state.draft.step = 'normal';
    state.draft.mode = null;
    state.draft.remaining = 0;
    state.draft.bonus = 0;
  }

  /**
   * Termina el reparto normal. Si el jugador tiene pulpos puestos, en vez de pasar el
   * turno se abre la etapa de las cartas extra: una por pulpo, sin las reglas del
   * reparto. Devuelve si quedó algo por elegir.
   */
  function openBonus(player) {
    state.draft.mode = null;
    state.draft.remaining = 0;
    const owed = state.status[player].stacked;
    // Sin acumulación, los pulpos de más se pierden: pagan una carta por reparto.
    state.draft.bonus = TUNING.octopusStacks ? owed : Math.min(owed, 1);
    if (state.draft.bonus === 0) { nextDrafter(); return false; }
    if (!TUNING.octopusStacks) state.status[player].stacked = state.draft.bonus;
    state.draft.step = 'bonus';
    stageFx({ power: 'octopus', moment: 'pick', by: player, on: player, amount: state.draft.bonus });
    return true;
  }

  /** Se lleva una de las cartas del pulpo y consume la reserva que la pagó. */
  function takeBonus(player, card) {
    state.status[player].stacked--;
    state.draft.bonus--;
    takeFromMarket(player, card, false);
  }

  /**
   * El reparto de una CPU distraída: una carta cualquiera de las que puede llevarse, y
   * si le salió una con poder, esa sola. Tiene la misma forma que `planDraft`.
   */
  function carelessPlan(player, kind) {
    const options = draftableFor(state, player);
    if (!options.length) return { mode: null, cards: [] };
    const card = options[Math.floor(rng() * options.length)];
    if (card.power) return { mode: 'power', cards: [card] };
    return { mode: 'plain', cards: kind === 'bust' ? [card] : [card, card] };
  }

  async function runDraft(era) {
    while (state.draft.index < state.draft.order.length) {
      const player = drafting();
      if (state.market.length === 0) {
        state.draft.index++;
        continue;
      }
      const kind = awardKind(player);

      // El tutorial esconde el centro hasta la ronda en que lo enseña.
      if (state.tutorial && state.tutorialSkipDraft) {
        nextDrafter();
        continue;
      }

      if (isBot(player)) {
        if (state.tutorial) {
          nextDrafter();
          continue;
        }
        emit();
        if (!(await tick(700, era))) return;
        if (canRenew(player) && renewsMarket(state.difficulty)) {
          renew(player);
          emit();
          if (!(await tick(700, era))) return;
        }
        // Decide la rama una vez —poder, o cartas sin poder— y después vuelve a
        // mirar el centro entre carta y carta: la reposición puede ofrecerle algo
        // mejor que lo que había al empezar.
        //
        // "Fácil" a veces no piensa: agarra cualquier carta que pueda (ver `sloppyDraft`).
        const careless = sloppyDraft(state.difficulty) > 0 && sloppyDraft(state.difficulty) > rng();
        const plan = careless ? carelessPlan(player, kind) : planDraft(state.market, cardsOf(player), { kind });
        state.draft.mode = plan.mode;
        if (plan.mode === 'power') {
          takeFromMarket(player, plan.cards[0]);
        } else {
          for (let n = 0; n < plan.cards.length && plainCards().length; n++) {
            const plain = plainCards();
            takeFromMarket(player, careless ? plain[Math.floor(rng() * plain.length)] : pickBest(plain, cardsOf(player)));
          }
        }
        // Y las cartas que le deben los pulpos, de a una y a la vista.
        if (openBonus(player)) {
          state.draft.step = 'bonus';
          while (state.draft.bonus > 0 && state.market.length) {
            emit();
            if (!(await tick(700, era))) return;
            takeBonus(player, pickBonus(state.market, cardsOf(player)));
          }
          nextDrafter();
        }
        continue;
      }

      // Al jugador se le prepara la elección y se espera a que actúe desde la UI.
      armClock(player, 'draft');
      if (state.draft.step === 'bonus') { emit(); return; }
      state.draft.took = 0;
      if (kind === 'bust') {
        state.draft.mode = 'plain';
        state.draft.remaining = 1;
      } else {
        // Sin modo: la carta que toque lo decide (ver `takeCard`).
        state.draft.mode = null;
        state.draft.remaining = 0;
      }
      emit();
      return;
    }

    state.draft = null;
    stopClock();
    await afterDraft(era);
  }

  /**
   * El asiento que la pantalla está manejando ahora mismo: el que está eligiendo del
   * centro, salvo que lo juegue la máquina. Contra la CPU es siempre `p1`; en una sala
   * es el que acaba de atacar.
   */
  const drafter = () => drafterOf(state);

  /**
   * Quién pidió la acción tiene que ser quien está jugando.
   *
   * Contra la máquina no hay a quién comprobarle nada: hay un solo par de manos, `as`
   * no viene y vale cualquiera. En una sala viene siempre, y es lo único que impide que
   * el celular juegue el turno de la computadora — el estado vive en el servidor, así
   * que esta es la línea que lo defiende.
   */
  const allowed = (player, as) => Boolean(player) && (!as || as === player);

  function renewMarket(as) {
    const player = drafter();
    if (!allowed(player, as) || !canRenew(player)) return;
    if (state.tutorial && !state.tutorialAllowRenew) return;
    renew(player);
    armClock(player, 'draft');
    emit();
  }

  /** Lo que el jugador que elige puede tocar ahora mismo en el centro. */
  function pickable() {
    const player = drafter();
    if (!player) return [];
    const list = draftable(player);
    if (state.tutorial && state.tutorialAllowedCard) {
      return list.filter((c) => c.uid === state.tutorialAllowedCard);
    }
    if (state.tutorial && state.tutorialPlainOnly) {
      return list.filter((c) => !c.power);
    }
    return list;
  }

  /**
   * Qué se lleva el jugador según la carta que tocó, sin preguntarle nada antes: una
   * carta con poder cierra el reparto ahí mismo; una sin poder deja pendiente una
   * segunda, que tampoco va a poder llevar poder.
   */
  const inferMode = (card) => (card.power ? 'power' : 'plain');

  async function takeCard(uid, as) {
    const player = drafter();
    if (!allowed(player, as)) return;
    if (state.tutorial && state.tutorialAllowedCard && uid !== state.tutorialAllowedCard) return;
    const card = pickable().find((c) => c.uid === uid);
    if (!card) return;
    if (state.tutorial && state.tutorialPlainOnly && card.power) return;
    const era = epoch;

    if (state.draft.step === 'bonus') {
      takeBonus(player, card);
      if (state.draft.bonus > 0 && state.market.length > 0) { emit(); return; }
      nextDrafter();
      await runDraft(era);
      return;
    }

    if (!state.draft.mode) {
      state.draft.mode = inferMode(card);
      state.draft.remaining = state.draft.mode === 'power' ? 1 : 2;
    }
    takeFromMarket(player, card);
    state.draft.took++;
    state.draft.remaining--;
    if (state.draft.remaining > 0 && state.market.length > 0) {
      emit();
      return;
    }
    // Las cartas del pulpo son otra elección, y traen su propio reloj.
    if (openBonus(player) && state.market.length > 0) {
      armClock(player, 'draft');
      emit();
      return;
    }
    await runDraft(era);
  }

  /** Cierra el reparto del jugador sin llevarse nada más. */
  async function skipDraft(as) {
    const player = drafter();
    if (!allowed(player, as)) return;
    if (state.tutorial && state.tutorialDisallowSkip) return;
    const era = epoch;

    // Rechazar la carta del pulpo gasta la reserva. Es gratis y sirve cualquier carta,
    // así que no tomarla es una decisión rara; pero si no se gastara, un pulpo sin usar
    // se arrastraría de ronda en ronda para siempre.
    if (state.draft.step === 'bonus') {
      log(`${who(player)} ${verb(player, 'dejás', 'deja')} pasar ` +
        `${state.draft.bonus === 1 ? 'la carta' : `las ${state.draft.bonus} cartas`} ` +
        `del ${powerIcon('octopus', 'sm')}.`, 'muted');
      state.status[player].stacked -= state.draft.bonus;
      nextDrafter();
      await runDraft(era);
      return;
    }

    log(
      state.draft.took
        ? `${who(player)} ${verb(player, 'te quedás', 'se queda')} con lo que ya agarró.`
        : `${who(player)} no ${verb(player, 'te llevás', 'se lleva')} nada del centro.`,
      'muted',
    );
    if (openBonus(player) && state.market.length > 0) {
      armClock(player, 'draft');
      emit();
      return;
    }
    await runDraft(era);
  }

  // ---- acciones del jugador ----

  /**
   * El asiento que está jugando y al que la pantalla le puede dar órdenes: el del
   * turno, salvo que lo juegue la máquina. Es uno solo: nunca les toca a los dos a la
   * vez, y en una sala cada aparato además solo maneja el suyo (ver `allowed`).
   */
  const acting = () => actingOf(state);

  /**
   * El mismo, pero solo si además puede apretar **ahora**: entre la carta que cae y el
   * repintado el turno queda ocupado, y en esa ventana los botones no valen. La
   * pantalla necesita las dos cosas por separado —el medidor de la próxima carta sigue
   * puesto mientras el turno es tuyo, aunque justo no puedas tocar nada—.
   */
  const canAct = () => (state && !state.busy ? acting() : null);

  async function hit(as, targetCol = null) {
    const player = canAct();
    if (!allowed(player, as)) return;
    if (state.pendingStack) {
      if (state.pendingStack.player === player) {
        await chooseStackTarget(targetCol ?? 0, as);
      }
      return;
    }
    if (state.tutorial && state.tutorialAllowed && state.tutorialAllowed !== 'hit' && state.tutorialAllowed !== 'any') return;
    const era = epoch;
    state.busy = true;
    emit();
    const card = draw(player);
    applyFeathers(player, card);
    applyStrength(player, card);

    // Con Free Game activo la carta no se encadena: se monta sobre una columna. Si no
    // vino una elegida, queda esperando a que el jugador la elija.
    const chain = state.chains[player];
    if (state.freeGame[player] && chain.cards.length > 0) {
      if (targetCol !== null && targetCol >= 0 && targetCol < chain.cards.length) {
        stackCard(player, targetCol, card);
      } else {
        state.pendingStack = { player, card };
        log(`${powerIcon('freegame', 'sm')} Free Game: ${who(player)} ${verb(player, 'sacás', 'saca')} ` +
          `${cardLabel(card)}. Elegí sobre qué carta montarla.`, player);
      }
    } else if (!(await extend(player, card, 700, era))) return;
    state.busy = false;
    emit();
  }

  async function chooseStackTarget(colIndex, as) {
    if (!state || !state.pendingStack) return;
    const { player, card } = state.pendingStack;
    if (!allowed(player, as)) return;
    if (colIndex < 0 || colIndex >= state.chains[player].cards.length) return;
    if (state.tutorial && state.tutorialAllowedCol != null && colIndex !== state.tutorialAllowedCol) return;
    state.pendingStack = null;
    stackCard(player, colIndex, card);
    emit();
  }

  async function stand(as) {
    const player = canAct();
    if (!allowed(player, as)) return;
    if (state.tutorial && state.tutorialAllowed && state.tutorialAllowed !== 'stand' && state.tutorialAllowed !== 'any') return;
    // Una carta de Free Game sin columna elegida se monta sobre la primera.
    if (state.pendingStack?.player === player) {
      state.chains[player] = stackOnCard(state.chains[player], 0, state.pendingStack.card);
    }
    state.freeGame[player] = false;
    state.pendingStack = null;
    const era = epoch;
    state.busy = true;
    const points = scoreChain(state.chains[player]).total;
    log(`${who(player)} ${verb(player, 'soltás', 'suelta')} el ataque con ${points}.`,
      player);
    await finishTurn(player, points, era);
  }

  /**
   * Adelanta el cierre del intercambio. La ronda siguiente arranca sola (ver
   * `endRound`); esto es para no esperarla —el Enter de la UI, y los tests—.
   */
  async function nextRound() {
    if (!state || state.phase !== 'roundEnd') return;
    await startRound(epoch);
  }

  /**
   * `player` se va de la partida. Se cierra en el acto —lo que estaba en curso se
   * corta, reloj incluido— y gana el que se quedó, en la ronda que sea: irse es dar la
   * partida por perdida.
   *
   * Solo lo usan las salas: contra la CPU irse es volver al menú, y no hay a quién
   * darle nada.
   */
  function forfeit(player) {
    if (!state || state.phase === 'matchEnd' || !PLAYERS.includes(player)) return;
    // La época cambia para que las corrutinas de la ronda en curso —la carta que cae,
    // el cierre que arranca la siguiente— se corten en vez de seguir jugando sin nadie.
    epoch++;
    stopClock();
    const winner = other(player);
    state.forfeit = { by: player, winner };
    state.phase = 'matchEnd';
    state.turn = null;
    state.draft = null;
    state.busy = false;
    log(`${who(player)} ${verb(player, 'abandonás', 'abandona')} la partida. ` +
      `Gana ${whom(winner)}.`, 'round');
    emit();
  }

  /**
   * Levantarse de la mesa: la partida deja de existir. Es lo que hace el que vuelve al
   * menú en el medio —contra la CPU, en la Aventura o en el tutorial—, donde no hay a
   * quién darle la victoria: enfrente está la máquina. Lo que estaba en curso se corta
   * —reloj, corrutinas de la ronda, turnos de la máquina— y la mesa queda vacía, como
   * antes de la primera partida. En una sala irse es abandonar, y eso es `forfeit`.
   */
  function abortMatch() {
    if (!state) return;
    // La época cambia para que lo que está andando —la carta que cae, el turno de la
    // máquina, el cierre de la ronda— se corte en vez de seguir jugando solo.
    epoch++;
    clearTimeout(alarm);
    state = null;
    // Sin `emit`: acá no hay estado que mandar, y los que miran la partida esperan
    // siempre uno (ver `subscribe` y `refresh`). Desarmar la mesa es de quien la pinta
    // (ver el `abortMatch` que devuelve `mount` en `ui.js`).
  }

  return {
    get state() {
      return state;
    },
    unseenPool,
    pickable,
    drafting,
    drafter,
    acting,
    canRenew,
    /** Vuelve a pintar el estado actual sin tocarlo. Sin partida no hay nada que pintar. */
    refresh: () => { if (state) emit(); },
    subscribe(fn) {
      listeners.add(fn);
      if (state) fn(state);
      return () => listeners.delete(fn);
    },
    newMatch,
    hit,
    stand,
    chooseStackTarget,
    nextRound,
    takeCard,
    skipDraft,
    renewMarket,
    forfeit,
    abortMatch,
  };
}
