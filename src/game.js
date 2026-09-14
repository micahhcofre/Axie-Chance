import { buildPool, shuffle, makeRng, cardLabel, crest, powerIcon, POWERS, TUNING, chooseActivePowers, makeCard } from './data.js';
import { AXIES, AXIE_IDS, axie, deckFor } from './axies.js';
import { emptyChain, playCard, scoreChain, stackOnCard } from './rules.js';
import { decideDraw, planDraft, pickBest, pickBonus } from './ai.js';
import { getAdventureLevel } from './adventure.js';

// Los números de los poderes viven en `data.js`, al lado de los carteles que los
// explican, así el texto sale de los mismos valores que usa el juego. Se reexportan
// porque el banco de pruebas y los tests los buscan acá.
export { TUNING };

export const PLAYERS = ['p1', 'p2'];
/**
 * Vida con la que arranca cada Axie. Los puntos de una cadena son el daño que le
 * hace al rival, así que `totals[p]` es "daño repartido por p" y la vida que le
 * queda a alguien es TARGET menos el daño del otro (ver `hpOf`). Cuando uno llega
 * a cero la partida termina, pero el rival igual cierra el intercambio.
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
export const CLOCK = { turn: 30000, draft: 10000 };

/**
 * Lo que le queda puesto a un jugador de una ronda a la otra:
 *   `egg`      vida del escudo; aguanta golpes hasta gastarse
 *   `eggBreak` daño acumulado que devuelve al romperse el escudo
 *   `poison`   cuánto muerde al finalizar el turno, partiéndose al medio después
 *   `weak`     cuántos de sus próximos ataques salen partidos al medio. Los
 *              caracoles se suman: dos caracoles, los dos próximos ataques
 *   `strength` daño extra acumulado, para siempre
 *   `stacked`  cuántas de las próximas cartas que agarre del centro van arriba del
 *              mazo en vez de perderse en el barajado (ver el pulpo)
 */
const emptyStatus = () => ({ egg: 0, eggBreak: 0, poison: 0, weak: 0, strength: 0, stacked: 0, bubbles: 0, leaf: 0, oak: 0, steelskin: 0 });

// Cada jugador roba de su propio mazo y no hay descarte: cada ronda arranca con el
// mazo entero barajado de nuevo, como una tragamonedas. Contar lo que salió sigue
// valiendo dentro de la ronda —las cartas jugadas no vuelven hasta que cierre—, pero
// nada se arrastra de una ronda a la otra.

const other = (p) => (p === 'p1' ? 'p2' : 'p1');

/**
 * Los dos modos de partida.
 *
 *   `cpu`  la de siempre: vos contra la máquina.
 *   `net`  los dos asientos jugados por personas, cada una en su aparato. Es la
 *          partida de las salas (ver `net.js` y `scripts/net.mjs`), y la partida vive
 *          en el servidor: acá el modo solo dice que el segundo asiento **no** lo
 *          juega la máquina.
 *
 * Hubo un tercero, `local`: los dos asientos en el mismo teclado. Se fue, y no por un
 * problema técnico —andaba— sino porque no era un modo, era una explicación: había que
 * contarle al que abría el juego que existía la posibilidad de que alguien se sentara
 * al lado, y el menú pagaba ese renglón siempre, para todos. Jugar con otra persona es
 * una sola cosa y ahora se pide en un solo lugar: una sala. Lo que sigue viviendo acá
 * de aquel modo es esto: que el segundo asiento pueda ser de alguien.
 */
export const MODES = ['cpu', 'net', 'tutorial'];

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
const VOICE = {
  cpu: {
    p1: { name: 'Vos', short: 'Vos', mid: 'vos', to: 'a vos', of: 'de vos', you: true },
    p2: { name: 'La CPU', short: 'CPU', mid: 'la CPU', to: 'a la CPU', of: 'de la CPU' },
  },
  tutorial: {
    p1: { name: 'Vos', short: 'Vos', mid: 'vos', to: 'a vos', of: 'de vos', you: true },
    p2: { name: 'La CPU', short: 'CPU', mid: 'la CPU', to: 'a la CPU', of: 'de la CPU' },
  },
  adventure: {
    p1: { name: 'Vos', short: 'Vos', mid: 'vos', to: 'a vos', of: 'de vos', you: true },
    p2: { name: 'Rival', short: 'Rival', mid: 'el rival', to: 'al rival', of: 'del rival' },
  },
  net: {
    p1: { name: 'Jugador 1', short: 'J1', mid: 'el Jugador 1', to: 'al Jugador 1', of: 'del Jugador 1' },
    p2: { name: 'Jugador 2', short: 'J2', mid: 'el Jugador 2', to: 'al Jugador 2', of: 'del Jugador 2' },
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
export const isBotSeat = (state, player) => (state.mode === 'cpu' || state.mode === 'tutorial' || state.mode === 'adventure') && player === 'p2';

/**
 * Vida que le queda a `player`: la inicial, menos el daño que le hizo el otro, más
 * lo que se curó con la maceta. `healed` solo acumula lo que efectivamente curó
 * (ver `heal`), así que nunca hace falta recortar por arriba.
 */
export const hpOf = (state, player) =>
  Math.max(TARGET - state.totals[other(player)] + state.healed[player], 0);

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
 */
/** Bono de daño por Garra Brutal: +2 de daño por cada símbolo de la cadena más larga. Se activa siempre. */
export function brutalBonusOf(chain) {
  if (!chain || chain.busted) return 0;
  const allCards = chain.cards.flatMap((c) => c.stackedCards || [c]);
  const brutalCount = allCards.filter((c) => c.power === 'brutal').length;
  if (brutalCount === 0) return 0;
  const maxRunLength = chain.runs.length > 0
    ? Math.max(...chain.runs.map((r) => r.length))
    : 0;
  return brutalCount * (TUNING.brutalStep ?? 2) * maxRunLength;
}

export function swingOf(state, player) {
  const chain = state.chains[player];
  const points = chain.busted ? 0 : scoreChain(chain).total;
  if (points <= 0) return 0;
  const st = state.status[player];
  const hit = points + st.strength + brutalBonusOf(chain);
  return st.weak > 0 ? Math.ceil(hit / TUNING.snailShare) : hit;
}

/**
 * Cuántas rondas tienen que haberse jugado enteras para que abandonar le cueste la
 * partida al que se va. Antes de eso irse no le da nada a nadie: la partida se anula.
 *
 * Sin este margen, entrar a una sala y ver que te tocó un rival que no te gusta se
 * resolvía yéndose en la primera ronda y regalándole una victoria que no jugó. Y al
 * revés, ganar por abandono tiene que ser algo que pasó en una partida de verdad.
 */
export const FORFEIT_ROUNDS = 5;

/** Las rondas ya cerradas: la que está en curso todavía no cuenta. */
const roundsDone = (state) =>
  (['roundEnd', 'matchEnd'].includes(state.phase) ? state.round : state.round - 1);

/**
 * Qué pasa si `player` abandona ahora: el asiento que gana, o `null` si la partida se
 * anula. Lo usa la partida al cerrarse, y la pantalla para avisarlo antes de que el
 * jugador confirme: las dos cosas tienen que salir de la misma cuenta.
 */
export function forfeitWinner(state, player) {
  return roundsDone(state) >= FORFEIT_ROUNDS ? other(player) : null;
}

/**
 * Cómo terminó la partida: `'p1'`, `'p2'`, `'tie'`, `'void'`, o `null` si todavía se
 * juega. Gana el que deja al otro sin vida; si los dos quedaron en cero —una última
 * chance que conecta— es empate.
 *
 * Si alguien abandonó, gana el que se quedó, o nadie: `'void'` no es un empate —no se
 * jugó hasta el final—, es una partida que no cuenta (ver `FORFEIT_ROUNDS`).
 *
 * Es una regla y por eso vive acá: la pantalla la pinta, no la decide.
 */
export function matchResult(state) {
  if (!state || state.phase !== 'matchEnd') return null;
  if (state.forfeit) return state.forfeit.winner ?? 'void';
  const down = { p1: hpOf(state, 'p1') <= 0, p2: hpOf(state, 'p2') <= 0 };
  if (down.p1 && down.p2) return 'tie';
  return down.p2 ? 'p1' : 'p2';
}

/**
 * El que está jugando su última chance: lo dejaron sin vida y todavía no atacó en
 * este intercambio. Le queda un turno normal —roba, encadena, se planta— y si en ese
 * golpe deja sin vida al otro también, la partida termina empatada.
 *
 * Solo le puede tocar al que juega segundo, y por eso importa quién abrió: al que
 * abre, cuando lo matan, ya le pasó el turno. Como el orden es fijo (ver
 * `startRound`), el que cobra la última chance es siempre el segundo asiento.
 *
 * Vive acá y no en la UI porque es una regla y no un adorno: el halo que la marca en
 * pantalla y el número que persigue la máquina (`needsOf`) tienen que salir de la
 * misma cuenta.
 */
export function lastChance(state) {
  if (!state || state.phase === 'matchEnd') return null;
  return PLAYERS.find((p) => state.roundScores[p] === null && hpOf(state, p) <= 0) ?? null;
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
  const allCards = chain.cards.flatMap((c) => c.stackedCards || [c]);
  const pending = state.pendingStack?.player === player ? 1 : 0;
  return allCards.length - state.recycled[player] + (chain.bustCard ? 1 : 0) + pending;
}

/**
 * Todas las cartas de `player`: el mazo, lo que reservó el pulpo para arriba del
 * mazo, y lo que sigue en la mesa sin devolver.
 */
export const ownedBy = (state, player) =>
  state.decks[player].length + state.top[player].length + (state.bubbleCard?.[player] ? 1 : 0) + onTable(state, player);

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
  const emit = () => listeners.forEach((fn) => fn(state));

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
  /**
   * El color de una línea del registro: el del asiento que la provocó. Antes el color
   * decía si la noticia era buena o mala, y eso solo tiene sentido cuando hay un solo
   * lado mirando; con dos personas en la misma pantalla, "bueno" es de quién.
   */
  const toneOf = (p) => p;
  const isBot = (p) => isBotSeat(state, p);

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
   * (ver `redact` en `scripts/net.mjs`), porque el reloj del celular no es el del
   * servidor.
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
      // Quedarse sin tiempo es fallar, no plantarse: si el reloj atacara con lo que
      // hay, dejarlo correr sería una forma de plantarse sin apretar nada. La cadena se
      // corta sin carta que la corte (`timeout` es para que la mesa diga por qué), y
      // de ahí en más es un fallo como cualquiera: 0 de daño, ningún poder, y en el
      // reparto una sola carta sin poder.
      state.busy = true;
      state.chains[player] = { ...state.chains[player], busted: true, timeout: true };
      log(`Se acabó el tiempo: ${verb(player, 'se te', 'se le')} desarma el ataque. 0 de daño.`, 'bad');
      void finishTurn(player, 0, epoch);
    } else {
      if (state.phase !== 'draft' || drafter() !== player) return;
      log('Se acabó el tiempo de elegir.', 'muted');
      void skipDraft(player);
    }
  }

  function draw(player) {
    if (state.decks[player].length === 0) {
      // Sin descarte, lo único fuera del mazo es lo que ya salió esta ronda: vuelve
      // adentro. `recycled` marca hasta dónde de la cadena ya se devolvió, para no
      // contarlo otra vez al cerrar la ronda.
      const played = state.chains[player].cards.flatMap((c) => c.stackedCards || [c]);
      state.decks[player] = deal(played.slice(state.recycled[player]));
      state.recycled[player] = played.length;
      log(`${who(player)} ${verb(player, 'rebarajás', 'rebaraja')} lo que ya salió.`, 'muted');
    }
    const card = state.decks[player].pop();
    return card ?? makeCard([state.symbols[player]]);
  }

  const unseenPool = (player) => unseenOf(state, player);

  /** Las cartas de `player` con las que la CPU mide conectividad: mazo y reservadas. */
  const cardsOf = (player) => [...state.decks[player], ...state.top[player]];

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
    adventureLevel, scriptedDecks, scriptedPool,
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
    const theirs = AXIES[AXIE_IDS.includes(wanted)
      ? wanted
      : rivals[Math.floor(rng() * rivals.length)]];
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
      // Cartas reservadas por el pulpo, esperando el arranque de la ronda siguiente
      // para entrar arriba del mazo. Ver `takeFromMarket` y `startRound`.
      top: { p1: [], p2: [] },
      bubbleCard: { p1: null, p2: null },
      // Cuántas cartas de la cadena en curso ya volvieron al mazo (ver `draw`).
      recycled: { p1: 0, p2: 0 },
      // Si la cadena entera ya volvió al mazo, al terminar el turno de ese jugador.
      returned: { p1: false, p2: false },
      totals: { p1: 0, p2: 0 },
      // Vida recuperada con la maceta. Va aparte de `totals` porque `totals` es
      // "daño repartido" y se usa para juzgar el intercambio, no para la vida.
      healed: { p1: 0, p2: 0 },
      // Huevo, veneno, caracol y fuerza: lo que dejan puesto las cartas con poder.
      status: { p1: emptyStatus(), p2: emptyStatus() },
      chains: { p1: emptyChain(), p2: emptyChain() },
      roundScores: { p1: null, p2: null },
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
      onRoundStart: null,
      adventure: advCfg ? {
        level: advCfg.id,
        name: advCfg.name,
        newPowers: advCfg.newPowers,
        rival: advCfg.rival,
      } : null,
    };
    refillMarket();
    log(
      mode === 'net'
        ? `${mine.name} ${crest(mine.class, 'sm')} contra ${theirs.name} ` +
          `${crest(theirs.class, 'sm')}, dos jugadores. ${TARGET} de vida cada uno.`
        : mode === 'adventure' && advCfg
        ? `Modo Aventura (${advCfg.name}): ${mine.name} ${crest(mine.class, 'sm')} contra ` +
          `${theirs.name} ${crest(theirs.class, 'sm')}. ${TARGET} de vida cada uno.`
        : `Jugás con ${mine.name} ${crest(mine.class, 'sm')} contra ` +
          `${theirs.name} ${crest(theirs.class, 'sm')}. ${TARGET} de vida cada uno.`,
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
      if (state.onRoundStart) state.onRoundStart(state.round);
      for (const player of PLAYERS) state.top[player] = [];
    } else {
      // Se rebaraja todo el mazo propio: lo de la ronda pasada y lo que se sumó del
      // centro. Lo que reservó el pulpo se apoya encima **después** de barajar —es todo
      // el punto: esas cartas no se sortean—. Van al revés porque `draw` saca del final,
      // así la primera que se tocó en el centro es la primera que sale.
      for (const player of PLAYERS) {
        state.decks[player] = deal(state.decks[player]).concat(state.top[player].reverse());
        state.top[player] = [];
      }
    }
    state.recycled = { p1: 0, p2: 0 };
    state.returned = { p1: false, p2: false };
    state.chains = { p1: emptyChain(), p2: emptyChain() };
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
    log(`Ronda ${state.round}`, 'round');
    emit();
    if (!(await tick(350, era))) return;
    await beginTurn(state.order[0], era);
  }

  function feathersIn(card) {
    if (!card) return 0;
    if (card.stackedCards) {
      return card.stackedCards.filter((c) => c.power === 'feather').length;
    }
    return card.power === 'feather' ? 1 : 0;
  }

  function applyFeatherDamage(player, count) {
    const foe = other(player);
    const dmg = count * (TUNING.featherDamage ?? 5);
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
    log(
      `${powerIcon('feather', 'sm')} Pluma Sagrada le pega ${toWhom(foe)} por ${dmg}: ` +
        `${verb(foe, 'quedás', 'queda')} en ${hpOf(state, foe)}.`,
      toneOf(player),
    );
  }

  async function beginTurn(player, era) {
    if (lastChance(state) === player) {
      log(`Última chance: ${toWhom(player)} no le queda vida, pero sí este golpe. ` +
        `Si deja sin vida ${toWhom(other(player))}, empatan.`, 'round');
    }
    state.turn = player;
    armClock(player, 'turn');
    let card;
    if (state.bubbleCard?.[player]) {
      const { card: bCard, count } = state.bubbleCard[player];
      state.bubbleCard[player] = null;
      const extra = Math.max(0, count - 1);
      const extraCards = [];
      for (let i = 0; i < extra; i++) {
        const c = draw(player);
        if (c) extraCards.push(c);
      }
      if (extraCards.length > 0) {
        card = {
          ...bCard,
          symbols: [...bCard.symbols, ...extraCards.flatMap((c) => c.symbols)],
          stackedCards: [bCard, ...extraCards],
        };
        state.chains[player] = playCard(state.chains[player], card);
        log(
          `${powerIcon('bubble', 'sm')} ${who(player)} ${verb(player, 'abrís', 'abre')} con ` +
            `${cardLabel(bCard)} y ${extraCards.length} carta${extraCards.length > 1 ? 's' : ''} más en una carta gigante`,
          toneOf(player),
        );
      } else {
        card = bCard;
        state.chains[player] = playCard(state.chains[player], card);
        log(
          `${powerIcon('bubble', 'sm')} ${who(player)} ${verb(player, 'abrís', 'abre')} con ${cardLabel(card)} de la burbuja`,
          toneOf(player),
        );
      }
    } else {
      card = draw(player);
      state.chains[player] = playCard(state.chains[player], card);
      log(`${who(player)} ${verb(player, 'abrís', 'abre')} con ${cardLabel(card)}`, toneOf(player));
    }
    const fCount = feathersIn(card);
    if (fCount > 0) {
      applyFeatherDamage(player, fCount);
    }
    if (card.power === 'freegame') {
      state.freeGame[player] = true;
      log(`${powerIcon('freegame', 'sm')} Free Game activo: tu próximo robo no corta y se monta sobre una carta`, toneOf(player));
    }
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
    `${who(player)} ${verb(player, 'sacás', 'saca')} ${cardLabel(card)}: se ` +
    `${verb(player, 'te', 'le')} desarma el ataque. 0 de daño.`;

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
      log(`${cap(toWhom(player))} le alcanza una cadena de ${Math.max(needs, 0)} para empatar.`,
        'muted');
    }

    for (;;) {
      emit();
      if (!(await tick(750, era))) return;
      const chain = state.chains[player];

      const isFree = state.freeGame[player];
      let willStand = false;
      if (state.tutorial) {
        if (state.round === 5) {
          willStand = false;
        } else if (chain.cards.length >= 2) {
          willStand = true;
        }
      } else {
        willStand = !isFree && !decideDraw(chain, unseenPool(player), { needs, difficulty: state.difficulty });
      }

      if (willStand) {
        const points = scoreChain(chain).total;
        log(`${who(player)} ${verb(player, 'cerrás', 'cierra')} su ataque con ${points}.`,
          toneOf(player));
        await finishTurn(player, points, era);
        return;
      }

      const card = draw(player);
      const fCount = feathersIn(card);
      if (fCount > 0) {
        applyFeatherDamage(player, fCount);
      }
      if (isFree) {
        const colIdx = pickStackColumn(chain, card);
        const next = stackOnCard(chain, colIdx, card);
        state.chains[player] = next;
        state.lastStacked = { player, colIndex: colIdx, card, id: ++state.stackId };
        state.freeGame[player] = (card.power === 'freegame');
        if (state.freeGame[player]) {
          log(`${powerIcon('freegame', 'sm')} Free Game encadenado: el próximo robo también se monta en mesa`, toneOf(player));
        }
        log(`${powerIcon('freegame', 'sm')} ${who(player)} ${verb(player, 'montás', 'monta')} ` +
          `${cardLabel(card)} sobre la columna ${colIdx + 1} alargándola → ataque de ${swingOf(state, player)}`, toneOf(player));
      } else {
        const next = playCard(chain, card);
        state.chains[player] = next;
        if (next.busted) {
          state.freeGame[player] = false;
          log(bustLine(player, card), 'bad');
          emit();
          if (!(await tick(600, era))) return;
          await finishTurn(player, 0, era);
          return;
        }
        if (card.power === 'freegame') {
          state.freeGame[player] = true;
          log(`${powerIcon('freegame', 'sm')} Free Game activo: tu próximo robo no corta y se monta sobre una carta`, toneOf(player));
        }
        log(`${who(player)} ${verb(player, 'sacás', 'saca')} ${cardLabel(card)} → ataque de ` +
          `${swingOf(state, player)}`, toneOf(player));
      }
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
   */
  function applyPowers(player, swing) {
    const foe = other(player);
    const mine = state.status[player];
    const theirs = state.status[foe];
    const kind = toneOf(player);
    const mark = (id) => powerIcon(id, 'sm');

    for (const power of powersPlayed(player)) {
      if (power === 'octopus' && (!TUNING.octopusOnStand || !state.chains[player].busted)) {
        mine.stacked++;
        log(`${mark('octopus')} ${who(player)} ${verb(player, 'vas', 'va')} a elegir ${mine.stacked === 1
          ? 'una carta extra para tu mazo'
          : `${mine.stacked} cartas extra para tu mazo`}.`, kind);
      } else if (power === 'bubble' && !state.chains[player].busted) {
        mine.bubbles = (mine.bubbles || 0) + 1;
        log(`${mark('bubble')} ${who(player)} ${verb(player, 'atrapás', 'atrapa')} la apertura en una burbuja: ` +
          `la carta que elijas del centro abrirá tu próxima ronda.`, kind);
      } else if (power === 'freegame') {
        // Free Game actúa al robar/apilar; no tiene efecto de ataque al cerrar el turno.
      } else if (swing <= 0) {
        // Sin daño no hay poder. Ninguno: un ataque que no salió no afila, no
        // envenena, no debilita, no cura y no pone huevo. La fuerza era la excepción
        // —no sale del golpe, decía— y ese era justo el problema: cobraba igual con
        // la cadena rota, así que la carta que menos te costaba jugar era la que
        // pagaba sola. El pulpo sigue afuera de esta regla porque no se mide contra
        // el daño sino contra plantarse, que es una decisión y no un resultado.
        log(`${mark(power)} ${POWERS[power].name} sin efecto: el ataque hizo 0.`, 'muted');
      } else if (power === 'strength') {
        mine.strength += TUNING.strengthStep;
        log(`${mark('strength')} ${who(player)} ${verb(player, 'afilás', 'afila')}: ` +
          `+${mine.strength} de daño de acá en más.`, kind);
      } else if (power === 'snail') {
        // Los caracoles se suman y no hay nada más que guardar: cuántos ataques, y
        // listo. El golpe con que se lo pusieron ya no entra en la cuenta —era lo que
        // hacía que el mismo caracol valiera cuatro veces más en manos del que venía
        // pegando fuerte—, así que este poder es el único de los seis que se mide
        // contra el daño para salir pero no para cuánto pega.
        theirs.weak += TUNING.snailAttacks;
        log(`${mark('snail')} ${who(foe)} ${verb(foe, 'quedás', 'queda')} debilitado: ${theirs.weak === 1
          ? 'su próximo ataque pega la mitad'
          : `sus próximos ${theirs.weak} ataques pegan la mitad`}.`, kind);
      } else if (power === 'egg') {
        mine.egg = Math.floor(swing / TUNING.eggShare);
        mine.eggBreak = (mine.eggBreak || 0) + TUNING.eggBreak;
        log(`${mark('egg')} ${who(player)} ${verb(player, 'quedás', 'queda')} con un huevo de ` +
          `${mine.egg}.`, kind);
      } else if (power === 'pot') {
        const got = heal(player, swing);
        log(got > 0
          ? `${mark('pot')} ${who(player)} ${verb(player, 'te curás', 'se cura')} ${got} y ` +
            `${verb(player, 'quedás', 'queda')} en ${hpOf(state, player)}.`
          : `${mark('pot')} ${who(player)} ya ${verb(player, 'estás', 'está')} entero: ` +
            'la maceta no cura nada.', got > 0 ? kind : 'muted');
      } else if (power === 'poison') {
        // Sumar o quedarse con el mayor: es la diferencia entre un veneno que se
        // dispara sin techo y uno que respeta la regla del caracol.
        const dose = Math.floor(swing / TUNING.poisonShare);
        theirs.poison = TUNING.poisonStacks ? theirs.poison + dose : Math.max(theirs.poison, dose);
        log(`${mark('poison')} ${who(foe)} ${verb(foe, 'quedás', 'queda')} con ` +
          `${theirs.poison} de veneno.`, kind);
      } else if (power === 'brutal') {
        const chain = state.chains[player];
        const maxRunLength = chain.runs.length > 0
          ? Math.max(...chain.runs.map((r) => r.length))
          : 0;
        if (maxRunLength > 0) {
          const step = TUNING.brutalStep ?? 2;
          const bonus = step * maxRunLength;
          log(
            `${mark('brutal')} ${who(player)} ${verb(player, 'desgarrás', 'desgarra')}: ` +
              `+${bonus} de daño (+${step} × ${maxRunLength} de tu cadena más larga).`,
            kind,
          );
        }
      } else if (power === 'feather') {
        // La pluma ya pegó directo al salir del mazo.
      } else if (power === 'leaf' || power === 'oak') {
        const gain = TUNING.leafGain ?? 2;
        const max = TUNING.leafMax ?? 5;
        const current = typeof mine.leaf === 'number' ? mine.leaf : (Array.isArray(mine.leaf) ? mine.leaf.length : (mine.oak || 0));
        mine.leaf = Math.min(max, current + gain);
        mine.oak = mine.leaf;
        const healAmt = TUNING.leafHeal ?? 4;
        log(
          `${mark(power)} ${who(player)} ${verb(player, 'sumás', 'suma')} +${gain} hojas (Leaf) ` +
            `(${mine.leaf}/${max}): curará +${mine.leaf * healAmt} de vida al final del turno.`,
          kind,
        );
      } else if (power === 'leech') {
        const columnsCount = state.chains[player].cards.length;
        const isBonus = columnsCount >= (TUNING.leechBonusThreshold ?? 4);
        const drain = isBonus ? (TUNING.leechBonusDrain ?? 12) : (TUNING.leechDrain ?? 6);
        state.totals[player] += drain;
        const got = heal(player, drain);
        log(
          `${mark('leech')} ${who(player)} ${verb(player, 'drenás', 'drena')} ${drain} de vida ${toWhom(foe)}` +
            `${isBonus ? ` (¡duplicado por tener ${columnsCount} columnas en mesa!)` : ''}` +
            `${got > 0 ? ` y ${verb(player, 'te curás', 'se cura')} ${got}` : ''}: ` +
            `${who(foe)} ${verb(foe, 'quedás', 'queda')} en ${hpOf(state, foe)}.`,
          kind,
        );
      } else if (power === 'steelskin') {
        if (!mine.steelskin || mine.steelskin <= 0) {
          mine.steelskin = TUNING.steelskinBaseCap ?? 12;
        } else {
          mine.steelskin = Math.max(TUNING.steelskinFloor ?? 6, mine.steelskin - (TUNING.steelskinStep ?? 2));
        }
        log(
          `${mark('steelskin')} ${who(player)} ${verb(player, 'endurecés', 'endurece')} su Piel de Escamas: ` +
            `limitará el próximo golpe rival a un máximo de ${mine.steelskin} de daño.`,
          kind,
        );
      }
    }
  }

  async function finishTurn(player, points, era) {
    const foe = other(player);
    const mine = state.status[player];
    const theirs = state.status[foe];

    const swing = swingOf(state, player);
    const brutal = brutalBonusOf(state.chains[player]);
    // El caracol se gasta con un ataque que haya hecho daño, y no con el turno: una
    // cadena cortada no le paga el caracol a nadie. Si se gastara igual, el debilitado
    // se lo sacaría de encima justo con el turno que ya venía perdido.
    //
    // Por ataque y no por ronda, eso sí: así dura siempre lo mismo, sin depender de si
    // le tocaba abrir o cerrar el intercambio.
    const weakened = mine.weak > 0 && swing > 0;
    if (weakened) mine.weak--;
    if (swing !== points) {
      const mods = [
        mine.strength ? `+${mine.strength} de fuerza` : '',
        brutal ? `+${brutal} de garra brutal` : '',
        weakened ? 'partido al medio por el caracol' : '',
      ].filter(Boolean);
      log(`${who(player)} ${verb(player, 'atacás', 'ataca')} por ${swing}: ` +
        `${points} de cadena ${mods.join(', ')}.`, 'muted');
    }

    let effectiveSwing = swing;
    if (theirs.steelskin > 0 && swing > 0) {
      if (swing > theirs.steelskin) {
        const mitigated = swing - theirs.steelskin;
        effectiveSwing = theirs.steelskin;
        log(
          `${powerIcon('steelskin', 'sm')} Piel de Escamas ${ofWhom(foe)} frena el golpe: ` +
            `mitiga ${mitigated} de daño (tope máximo ${theirs.steelskin}).`,
          toneOf(foe),
        );
      }
      theirs.steelskin = 0;
    }

    // El huevo del rival se come lo que puede y solo se rompe cuando se gasta: si le
    // sobra vida, sigue puesto para el próximo golpe.
    const blocked = Math.min(theirs.egg, effectiveSwing);
    // La cáscara: daño fijo acumulable que devuelve al romperse (8 por cada huevo
    // acumulado). Aguanta hasta que el escudo se gasta del todo.
    let thorns = 0;
    let broke = false;
    if (blocked > 0) {
      theirs.egg -= blocked;
      broke = theirs.egg === 0;
      if (broke && TUNING.eggBreak > 0) {
        thorns = theirs.eggBreak || TUNING.eggBreak;
      }
      if (broke) {
        theirs.eggBreak = 0;
      }
      const rest = broke
        ? (thorns > 0 ? ` y se rompe: la cáscara le devuelve ${thorns} ${toWhom(player)}` : ' y se rompe')
        : ` y le quedan ${theirs.egg}`;
      log(`${powerIcon('egg', 'sm')} El huevo ${ofWhom(foe)} aguanta ${blocked}${rest}.`, 'muted');
    }
    const landed = effectiveSwing - blocked;

    state.roundScores[player] = effectiveSwing;
    // El turno se cierra acá mismo. Si no, entre el golpe y el turno del otro queda
    // una ventana con `turn` todavía puesto y los botones vivos: alcanzaba para
    // plantarse dos veces y aplicar el daño dos veces.
    state.turn = null;
    stopClock();
    // El daño entra acá y no al cerrar la ronda: el golpe tiene que verse cuando el
    // jugador lo suelta, no dos turnos después. Los totales terminan iguales.
    state.totals[player] += landed;
    if (state.tutorial && foe === 'p1') {
      const maxP2Damage = Math.max(0, TARGET + state.healed.p1 - 20);
      state.totals[player] = Math.min(state.totals[player], maxP2Damage);
    }
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
      log(`${who(player)} ${verb(player, 'pegás', 'pega')} por ${landed}. ` +
        `${who(target)} ${verb(target, 'quedás', 'queda')} en ${hpOf(state, target)}.`,
        toneOf(player));
    }
    applyPowers(player, effectiveSwing);
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
    const shown = swing > 0 ? 1800 : state.chains[player].busted ? 1000 : 1700;
    if (!(await tick(shown, era))) return;

    // Y recién ahí contesta la cáscara, con su propio golpe en sentido contrario. Va
    // después y no junto con el ataque porque son dos cosas distintas —le pegaste, y
    // el huevo te contestó— y encimadas se leen como un solo número mal sumado.
    //
    // El daño se aplica acá, del otro lado del `tick`, y por eso el `return` de arriba
    // no lo pierde: cuando `tick` da false es porque arrancó otra partida y `state` ya
    // es otro objeto. Sumárselo ahí le metería daño de la partida anterior a la nueva.
    if (thorns > 0) {
      state.totals[foe] += thorns;
      if (state.tutorial && player === 'p1') {
        const maxP2Damage = Math.max(0, TARGET + state.healed.p1 - 20);
        state.totals[foe] = Math.min(state.totals[foe], maxP2Damage);
      }
      state.lastHit = {
        id: ++state.hitId, by: foe, target: player, amount: thorns, blocked: 0, broke: false,
        kind: 'thorns',
      };
      log(`${powerIcon('egg', 'sm')} La cáscara le vuelve ${toWhom(player)} por ${thorns}: ` +
        `${verb(player, 'quedás', 'queda')} en ${hpOf(state, player)}.`, toneOf(foe));
      emit();
      // La cáscara sale en el momento —no hay efecto de clase que esperar—, así que
      // con 900 alcanzaba justo para su número y ni un instante más: cerraba al mismo
      // tiempo que la animación. Un beat más y se termina de ver.
      if (!(await tick(1300, era))) return;
    }

    const leafCount = typeof state.status[player].leaf === 'number'
      ? state.status[player].leaf
      : (Array.isArray(state.status[player].leaf) ? state.status[player].leaf.length : (state.status[player].oak || 0));
    if (leafCount > 0) {
      tickLeaf(player);
      emit();
      if (!(await tick(1000, era))) return;
    }

    if (state.status[player].poison > 0) {
      tickPoison(player);
      emit();
      if (!(await tick(1000, era))) return;
    }

    // Con alguien sin vida la partida ya está resuelta: no hay mazo que armar, solo
    // queda que el otro devuelva el golpe.
    if (matchOver()) return afterDraft(era);
    await startDraft(player, era);
  }

  // Con la maceta curando y el veneno mordiendo fuera del ataque, "llegó a 100 de
  // daño" ya no equivale a "lo dejó sin vida": la partida se cierra por vida.
  // En el tutorial la partida nunca termina antes de la ronda 5, garantizando que
  // el jugador complete todas las etapas guiadas.
  const matchOver = () => {
    if (state.tutorial) return state.round >= 5 && hpOf(state, 'p2') <= 0;
    return PLAYERS.some((p) => hpOf(state, p) <= 0);
  };

  /** Terminado el reparto de un jugador: juega el que falta, o cierra el intercambio. */
  async function afterDraft(era) {
    const pending = state.order.find((p) => state.roundScores[p] === null);
    if (pending) {
      if (state.tutorial && state.round >= 5 && state.onTutorialBeforeBot) {
        await state.onTutorialBeforeBot();
        if (era !== epoch) return;
      }
      state.phase = 'turn';
      emit();
      if (!(await tick(600, era))) return;
      await beginTurn(pending, era);
    } else {
      await endRound(era);
    }
  }

  /**
   * Las hojas (Leaf) curan al finalizar el turno de quien las tiene:
   * curan 4 de vida por cada hoja activa y luego se consume una hoja.
   */
  function tickLeaf(player) {
    const st = state.status[player];
    const leaves = typeof st.leaf === 'number'
      ? st.leaf
      : (Array.isArray(st.leaf) ? st.leaf.length : (st.oak || 0));
    if (leaves <= 0) return 0;
    const healAmt = leaves * (TUNING.leafHeal ?? 4);
    const got = heal(player, healAmt);
    st.leaf = leaves - 1;
    st.oak = st.leaf;
    const left = st.leaf;
    const leftMsg = left > 0
      ? ` (le queda${left > 1 ? 'n' : ''} ${left} hoja${left > 1 ? 's' : ''})`
      : ' (se consumió la última hoja)';
    log(
      `${powerIcon('leaf', 'sm')} Hoja (Leaf): ${who(player)} ` +
        (got > 0
          ? `${verb(player, 'te curás', 'se cura')} +${got} de vida (${leaves} hoja${leaves > 1 ? 's' : ''}) y ${verb(player, 'quedás', 'queda')} en ${hpOf(state, player)}.`
          : `ya ${verb(player, 'estás', 'está')} entero (${leaves} hoja${leaves > 1 ? 's' : ''}).`) +
        leftMsg,
      toneOf(player),
    );
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
   */
  function tickPoison(player) {
    const st = state.status[player];
    if (st.poison <= 0) return;
    const bite = st.poison;
    state.totals[other(player)] += bite;
    if (state.tutorial && other(player) === 'p2') {
      const maxP2Damage = Math.max(0, TARGET + state.healed.p1 - 20);
      state.totals.p2 = Math.min(state.totals.p2, maxP2Damage);
    }
    const half = Math.floor(bite / TUNING.poisonHalve);
    const left = half <= TUNING.poisonFloor ? 0 : half;
    log(`${powerIcon('poison', 'sm')} El veneno le saca ${bite} ${toWhom(player)}: ` +
      `${verb(player, 'quedás', 'queda')} en ${hpOf(state, player)}` +
      `${left > 0 ? ` y le baja a ${left}` : ' y se le va'}.`, toneOf(other(player)));
    st.poison = left;
  }

  async function endRound(era) {
    const { p1, p2 } = state.roundScores;
    // El daño ya está aplicado (ver `finishTurn`); acá solo se juzga el intercambio.
    state.roundWinner = p1 === p2 ? 'tie' : p1 > p2 ? 'p1' : 'p2';
    state.turn = null;

    const verdict =
      state.roundWinner === 'tie'
        ? 'Pegaron igual'
        : `Pegó más fuerte ${whom(state.roundWinner)}`;
    log(
      `Fin del intercambio ${state.round}: ${p1} vs ${p2} de daño. ${verdict}. ` +
        `Vida ${hpOf(state, 'p1')} — ${hpOf(state, 'p2')}.`,
      'round',
    );

    // Alguien quedó sin vida, pero los dos llegaron hasta acá jugando el intercambio
    // completo: el que caía primero alcanzó a devolver el golpe.
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


  /**
   * @param {boolean} toTop  carta del pulpo: no se pierde en el barajado, sale arriba
   *   del mazo en la ronda que viene. Va aparte en `state.top` (ver `startRound`).
   */
  function takeFromMarket(player, card, toTop = false) {
    const at = state.market.indexOf(card);
    if (at < 0) return;
    state.market.splice(at, 1);
    const tone = toneOf(player);
    if (state.status[player].bubbles > 0 && !toTop) {
      const count = state.status[player].bubbles;
      state.status[player].bubbles = 0;
      state.bubbleCard = state.bubbleCard || { p1: null, p2: null };
      state.bubbleCard[player] = { card, count };
      state.added[player].push(card);
      log(
        `${powerIcon('bubble', 'sm')} ${who(player)} ${verb(player, 'atrapás', 'atrapa')} ${cardLabel(card)} ` +
          `en la burbuja: abrirá tu próxima ronda${count > 1 ? ` junto a ${count - 1} carta${count > 2 ? 's' : ''} más en una carta gigante` : ''}.`,
        tone,
      );
    } else if (toTop) {
      state.top[player].push(card);
      state.added[player].push(card);
      log(`${powerIcon('octopus', 'sm')} ${who(player)} ${verb(player, 'reservás', 'reserva')} ` +
        `${cardLabel(card)}: ` +
        `sale arriba del mazo la ronda que viene.`, tone);
    } else {
      state.decks[player].push(card);
      state.added[player].push(card);
      log(`${who(player)} ${verb(player, 'sumás', 'suma')} ${cardLabel(card)} al mazo.`, tone);
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
    log(
      `${who(player)} ${verb(player, 'renovás', 'renueva')} el centro: no había nada con ` +
        `${crest(state.symbols[player], 'sm')}.`,
      toneOf(player),
    );
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
    return true;
  }

  /** Se lleva una de las cartas del pulpo y consume la reserva que la pagó. */
  function takeBonus(player, card) {
    state.status[player].stacked--;
    state.draft.bonus--;
    takeFromMarket(player, card, false);
  }

  async function runDraft(era) {
    while (state.draft.index < state.draft.order.length) {
      const player = drafting();
      if (state.market.length === 0) {
        state.draft.index++;
        continue;
      }
      const kind = awardKind(player);

      if (isBot(player)) {
        if (state.tutorial) {
          nextDrafter();
          continue;
        }
        emit();
        if (!(await tick(700, era))) return;
        if (canRenew(player)) {
          renew(player);
          emit();
          if (!(await tick(700, era))) return;
        }
        // Decide la rama una vez —poder, o cartas sin poder— y después vuelve a
        // mirar el centro entre carta y carta: la reposición puede ofrecerle algo
        // mejor que lo que había al empezar.
        const plan = planDraft(state.market, cardsOf(player), { kind });
        state.draft.mode = plan.mode;
        if (plan.mode === 'power') {
          takeFromMarket(player, plan.cards[0]);
        } else {
          for (let n = 0; n < plan.cards.length && plainCards().length; n++) {
            takeFromMarket(player, pickBest(plainCards(), cardsOf(player)));
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
    const fCount = feathersIn(card);
    if (fCount > 0) {
      applyFeatherDamage(player, fCount);
    }

    if (state.freeGame[player]) {
      const chain = state.chains[player];
      if (chain.cards.length === 0) {
        const next = playCard(chain, card);
        state.chains[player] = next;
        if (next.busted) {
          state.freeGame[player] = false;
          log(bustLine(player, card), 'bad');
          emit();
          if (!(await tick(700, era))) return;
          await finishTurn(player, 0, era);
          return;
        }
        if (card.power === 'freegame') {
          state.freeGame[player] = true;
          log(`${powerIcon('freegame', 'sm')} Free Game activo: tu próximo robo no corta y se monta sobre una carta`, toneOf(player));
        }
        log(`${who(player)} ${verb(player, 'sacás', 'saca')} ${cardLabel(card)} → ataque de ` +
          `${swingOf(state, player)}`, toneOf(player));
        state.busy = false;
        emit();
        return;
      }
      if (targetCol !== null && targetCol >= 0 && targetCol < chain.cards.length) {
        state.chains[player] = stackOnCard(chain, targetCol, card);
        state.lastStacked = { player, colIndex: targetCol, card, id: ++state.stackId };
        state.freeGame[player] = (card.power === 'freegame');
        if (state.freeGame[player]) {
          log(`${powerIcon('freegame', 'sm')} Free Game encadenado: el próximo robo también se monta en mesa`, toneOf(player));
        }
        log(`${powerIcon('freegame', 'sm')} ${who(player)} ${verb(player, 'montás', 'monta')} ` +
          `${cardLabel(card)} sobre la columna ${targetCol + 1} alargándola → ataque de ${swingOf(state, player)}`, toneOf(player));
        state.busy = false;
        emit();
        return;
      }
      state.pendingStack = { player, card };
      log(`${powerIcon('freegame', 'sm')} Free Game: ${who(player)} ${verb(player, 'sacás', 'saca')} ${cardLabel(card)}. Elegí sobre qué carta montarla.`, toneOf(player));
      state.busy = false;
      emit();
      return;
    }

    const next = playCard(state.chains[player], card);
    state.chains[player] = next;
    if (next.busted) {
      state.freeGame[player] = false;
      log(bustLine(player, card), 'bad');
      emit();
      if (!(await tick(700, era))) return;
      await finishTurn(player, 0, era);
      return;
    }
    if (card.power === 'freegame') {
      state.freeGame[player] = true;
      log(`${powerIcon('freegame', 'sm')} Free Game activo: tu próximo robo no corta y se monta sobre una carta`, toneOf(player));
    }
    log(`${who(player)} ${verb(player, 'sacás', 'saca')} ${cardLabel(card)} → ataque de ` +
      `${swingOf(state, player)}`, toneOf(player));
    state.busy = false;
    emit();
  }

  async function chooseStackTarget(colIndex, as) {
    if (!state || !state.pendingStack) return;
    const { player, card } = state.pendingStack;
    if (!allowed(player, as)) return;
    const chain = state.chains[player];
    if (colIndex < 0 || colIndex >= chain.cards.length) return;
    state.chains[player] = stackOnCard(chain, colIndex, card);
    state.lastStacked = { player, colIndex, card, id: ++state.stackId };
    state.freeGame[player] = (card.power === 'freegame');
    state.pendingStack = null;
    if (state.freeGame[player]) {
      log(`${powerIcon('freegame', 'sm')} Free Game encadenado: el próximo robo también se monta en mesa`, toneOf(player));
    }
    log(`${powerIcon('freegame', 'sm')} ${who(player)} ${verb(player, 'montás', 'monta')} ` +
      `${cardLabel(card)} sobre la columna ${colIndex + 1} alargándola → ataque de ${swingOf(state, player)}`, toneOf(player));
    emit();
  }

  async function stand(as) {
    const player = canAct();
    if (!allowed(player, as)) return;
    if (state.tutorial && state.tutorialAllowed && state.tutorialAllowed !== 'stand' && state.tutorialAllowed !== 'any') return;
    if (state.pendingStack && state.pendingStack.player === player) {
      const { card } = state.pendingStack;
      state.chains[player] = stackOnCard(state.chains[player], 0, card);
      state.pendingStack = null;
    }
    state.freeGame[player] = false;
    state.pendingStack = null;
    const era = epoch;
    state.busy = true;
    const points = scoreChain(state.chains[player]).total;
    log(`${who(player)} ${verb(player, 'soltás', 'suelta')} el ataque con ${points}.`,
      toneOf(player));
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
   * corta, reloj incluido— y gana el otro o nadie, según cuánto se jugó (ver
   * `forfeitWinner`).
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
    const winner = forfeitWinner(state, player);
    state.forfeit = { by: player, winner };
    state.phase = 'matchEnd';
    state.turn = null;
    state.draft = null;
    state.busy = false;
    log(`${who(player)} ${verb(player, 'abandonás', 'abandona')} la partida. ` +
      (winner
        ? `Gana ${whom(winner)}.`
        : `Fue en las primeras ${FORFEIT_ROUNDS} rondas: no gana nadie.`), 'round');
    emit();
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
    /** Vuelve a pintar el estado actual sin tocarlo. */
    refresh: () => emit(),
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
  };
}
