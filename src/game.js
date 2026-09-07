import { buildPool, shuffle, cardLabel, crest, powerIcon, POWERS } from './data.js';
import { AXIES, AXIE_IDS, axie, deckFor } from './axies.js';
import { emptyChain, playCard, scoreChain } from './rules.js';
import { decideDraw, planDraft, pickBest } from './ai.js';

export const PLAYERS = ['human', 'cpu'];
/**
 * Vida con la que arranca cada Axie. Los puntos de una cadena son el daño que le
 * hace al rival, así que `totals[p]` es "daño repartido por p" y la vida que le
 * queda a alguien es TARGET menos el daño del otro (ver `hpOf`). Cuando uno llega
 * a cero la partida termina, pero el rival igual cierra el intercambio.
 */
export const TARGET = 100;
/** Cartas boca arriba en el centro. Se repone en el acto al llevarse una. */
export const MARKET_SIZE = 5;

// Los números de los poderes, todos juntos para poder moverlos de a uno.
/** Cuánto suma cada carta de fuerza, en este ataque y en todos los siguientes. */
const STRENGTH_STEP = 2;
/**
 * El caracol le saca a cada ataque del debilitado la mitad del golpe con que se lo
 * pusieron, durante SNAIL_ATTACKS ataques. Escala como el veneno y el huevo: pegar
 * fuerte al ponerlo es lo que lo hace valer.
 */
const SNAIL_SHARE = 2; // divisor del golpe
const SNAIL_ATTACKS = 2;
/** Cuánto baja el veneno al cerrar la ronda, después de haber mordido. */
const POISON_DECAY = 2;

/**
 * Lo que le queda puesto a un jugador de una ronda a la otra:
 *   `egg`      vida del escudo; aguanta golpes hasta gastarse
 *   `poison`   cuánto muerde al cerrar cada ronda, bajando de a POISON_DECAY
 *   `weak`     cuántos ataques suyos todavía pegan de menos
 *   `weakBite` cuánto de menos pegan. Dos caracoles suman ataques y se quedan con el
 *              mordisco más grande: acumulan duración, nunca cantidad
 *   `strength` daño extra acumulado, para siempre
 *   `stacked`  cuántas de las próximas cartas que agarre del centro van arriba del
 *              mazo en vez de perderse en el barajado (ver el pulpo)
 */
const emptyStatus = () => ({ egg: 0, poison: 0, weak: 0, weakBite: 0, strength: 0, stacked: 0 });

/** Los números de los poderes, para que la UI los cuente igual que el juego. */
export const POWER_NUMBERS = {
  strength: STRENGTH_STEP,
  snailShare: SNAIL_SHARE,
  snailAttacks: SNAIL_ATTACKS,
  poisonDecay: POISON_DECAY,
};

// Cada jugador roba de su propio mazo y no hay descarte: cada ronda arranca con el
// mazo entero barajado de nuevo, como una tragamonedas. Contar lo que salió sigue
// valiendo dentro de la ronda —las cartas jugadas no vuelven hasta que cierre—, pero
// nada se arrastra de una ronda a la otra.

const who = (p) => (p === 'human' ? 'Vos' : 'La CPU');
/** El mismo nombre en mitad de una frase: "abre vos", "pegó más fuerte la CPU". */
const whom = (p) => (p === 'human' ? 'vos' : 'la CPU');
const other = (p) => (p === 'human' ? 'cpu' : 'human');

/**
 * Vida que le queda a `player`: la inicial, menos el daño que le hizo el otro, más
 * lo que se curó con la maceta. `healed` solo acumula lo que efectivamente curó
 * (ver `heal`), así que nunca hace falta recortar por arriba.
 */
export const hpOf = (state, player) =>
  Math.max(TARGET - state.totals[other(player)] + state.healed[player], 0);

/**
 * Lo que pegaría `player` si soltara el ataque ahora: los puntos de su cadena, más
 * la fuerza que acumuló, menos el mordisco del caracol si lo tiene puesto. Una
 * cadena cortada hace 0 y no la levanta ningún modificador.
 *
 * Vive acá y no en la UI porque es la cuenta con la que se reparte el daño: el
 * número grande de la pantalla tiene que ser exactamente el que se va a aplicar.
 */
export function swingOf(state, player) {
  const chain = state.chains[player];
  const points = chain.busted ? 0 : scoreChain(chain).total;
  if (points <= 0) return 0;
  const st = state.status[player];
  return Math.max(points + st.strength - (st.weak > 0 ? st.weakBite : 0), 0);
}

/**
 * Cartas de `player` que están en la mesa y todavía no volvieron a su mazo. Apenas
 * termina su turno la cadena se devuelve (`returned`), pero se sigue mostrando hasta
 * que cierre la ronda: sin esta cuenta, lo que está a la vista se contaría dos veces.
 */
export function onTable(state, player) {
  if (state.returned[player]) return 0;
  const chain = state.chains[player];
  return chain.cards.length - state.recycled[player] + (chain.bustCard ? 1 : 0);
}

/**
 * Todas las cartas de `player`: el mazo, lo que reservó el pulpo para arriba del
 * mazo, y lo que sigue en la mesa sin devolver.
 */
export const ownedBy = (state, player) =>
  state.decks[player].length + state.top[player].length + onTable(state, player);

/** @param {{pace?: number}} opts  pace 0 corre sin pausas (tests). */
export function createGame({ pace = 1 } = {}) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms * pace));
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

  function log(text, kind = 'info') {
    state.log.unshift({ id: state.logId++, text, kind });
    if (state.log.length > 24) state.log.pop();
  }

  function draw(player) {
    if (state.decks[player].length === 0) {
      // Sin descarte, lo único fuera del mazo es lo que ya salió esta ronda: vuelve
      // adentro. `recycled` marca hasta dónde de la cadena ya se devolvió, para no
      // contarlo otra vez al cerrar la ronda.
      const played = state.chains[player].cards;
      state.decks[player] = shuffle(played.slice(state.recycled[player]));
      state.recycled[player] = played.length;
      log(`${who(player)} rebaraja lo que ya salió.`, 'muted');
    }
    return state.decks[player].pop();
  }

  /** Cartas que todavía pueden salir del mazo de `player`: el mazo, sin más. */
  const unseenPool = (player) => state.decks[player];

  /** Las cartas de `player` con las que la CPU mide conectividad: mazo y reservadas. */
  const cardsOf = (player) => [...state.decks[player], ...state.top[player]];

  /** @param {{difficulty?: string, axie?: string}} opts  `axie` es un id del roster. */
  function newMatch({ difficulty, axie: axieId } = {}) {
    difficulty = difficulty ?? state?.difficulty ?? 'normal';
    const mine = axie(axieId ?? state?.axies.human ?? 'aquatic');
    // La CPU juega otro Axie, y de otra clase: dos mazos iguales no tendrían gracia.
    const rivals = AXIE_IDS.filter((id) => AXIES[id].class !== mine.class);
    const theirs = AXIES[rivals[Math.floor(Math.random() * rivals.length)]];

    epoch++;
    state = {
      difficulty,
      axies: { human: mine.id, cpu: theirs.id },
      // La clase del Axie es el símbolo con el que puntúa; el resto del juego usa esto.
      symbols: { human: mine.class, cpu: theirs.class },
      round: 0,
      pool: shuffle(buildPool()), // pila boca abajo que alimenta el centro
      market: [], // las 5 cartas a la vista, se llena abajo
      decks: { human: shuffle(deckFor(mine.id)), cpu: shuffle(deckFor(theirs.id)) },
      // Cartas reservadas por el pulpo, esperando el arranque de la ronda siguiente
      // para entrar arriba del mazo. Ver `takeFromMarket` y `startRound`.
      top: { human: [], cpu: [] },
      // Cuántas cartas de la cadena en curso ya volvieron al mazo (ver `draw`).
      recycled: { human: 0, cpu: 0 },
      // Si la cadena entera ya volvió al mazo, al terminar el turno de ese jugador.
      returned: { human: false, cpu: false },
      totals: { human: 0, cpu: 0 },
      // Vida recuperada con la maceta. Va aparte de `totals` porque `totals` es
      // "daño repartido" y se usa para juzgar el intercambio, no para la vida.
      healed: { human: 0, cpu: 0 },
      // Huevo, veneno, caracol y fuerza: lo que dejan puesto las cartas con poder.
      status: { human: emptyStatus(), cpu: emptyStatus() },
      chains: { human: emptyChain(), cpu: emptyChain() },
      roundScores: { human: null, cpu: null },
      order: ['human', 'cpu'],
      turn: null,
      phase: 'turn', // 'turn' | 'draft' | 'roundEnd' | 'matchEnd'
      draft: null,
      busy: false,
      roundWinner: null,
      // Último golpe resuelto. La UI compara `id` con el que ya animó: mientras no
      // cambie no vuelve a sacudir a nadie, aunque el tablero se repinte diez veces.
      lastHit: null,
      hitId: 0,
      log: [],
      logId: 0,
    };
    refillMarket();
    log(
      `Jugás con ${mine.name} ${crest(mine.class, 'sm')} contra ` +
        `${theirs.name} ${crest(theirs.class, 'sm')}. ${TARGET} de vida cada uno.`,
      'muted',
    );
    return startRound(epoch);
  }

  async function startRound(era) {
    state.round++;
    // Se rebaraja todo el mazo propio: lo de la ronda pasada y lo que se sumó del
    // centro. Lo que reservó el pulpo se apoya encima **después** de barajar —es todo
    // el punto: esas cartas no se sortean—. Van al revés porque `draw` saca del final,
    // así la primera que se tocó en el centro es la primera que sale.
    for (const player of PLAYERS) {
      state.decks[player] = shuffle(state.decks[player]).concat(state.top[player].reverse());
      state.top[player] = [];
    }
    state.recycled = { human: 0, cpu: 0 };
    state.returned = { human: false, cpu: false };
    state.chains = { human: emptyChain(), cpu: emptyChain() };
    state.roundScores = { human: null, cpu: null };
    state.roundWinner = null;
    state.draft = null;
    state.phase = 'turn';
    // Se alterna quién abre: el segundo juega sabiendo el puntaje del primero.
    state.order = state.round % 2 === 1 ? ['human', 'cpu'] : ['cpu', 'human'];
    log(`Ronda ${state.round} · abre ${whom(state.order[0])}`, 'round');
    emit();
    if (!(await tick(350, era))) return;
    await beginTurn(state.order[0], era);
  }

  async function beginTurn(player, era) {
    state.turn = player;
    const card = draw(player);
    state.chains[player] = playCard(state.chains[player], card);
    log(`${who(player)} abre con ${cardLabel(card)}`, player === 'cpu' ? 'cpu' : 'info');
    emit();
    if (player === 'cpu') {
      if (!(await tick(800, era))) return;
      await cpuTurn(era);
    }
  }

  /**
   * Daño que la CPU necesita este intercambio. Solo aplica cuando el humano ya pegó
   * y la dejó sin vida: la partida termina acá, así que plantarse por debajo pierde
   * y no hay nada que conservar. (`totals.human` ya incluye el golpe de esta ronda.)
   */
  function cpuNeeds() {
    if (state.roundScores.human === null) return null;
    if (hpOf(state, 'cpu') > 0) return null;
    return state.totals.human - state.totals.cpu + 1;
  }

  async function cpuTurn(era) {
    state.busy = true;
    const needs = cpuNeeds();
    if (needs !== null) log(`Golpe final: la CPU necesita ${Math.max(needs, 0)} de daño.`, 'muted');

    for (;;) {
      emit();
      if (!(await tick(750, era))) return;
      const chain = state.chains.cpu;

      if (!decideDraw(chain, unseenPool('cpu'), { needs, difficulty: state.difficulty })) {
        const points = scoreChain(chain).total;
        log(`La CPU cierra su ataque con ${points}.`, 'cpu');
        await finishTurn('cpu', points, era);
        return;
      }

      const card = draw('cpu');
      const next = playCard(chain, card);
      state.chains.cpu = next;
      if (next.busted) {
        log(`La CPU saca ${cardLabel(card)}: se le desarma el ataque. 0 de daño.`, 'good');
        emit();
        if (!(await tick(600, era))) return;
        await finishTurn('cpu', 0, era);
        return;
      }
      log(`La CPU saca ${cardLabel(card)} → ataque de ${swingOf(state, 'cpu')}`, 'cpu');
    }
  }

  /**
   * Los poderes de las cartas que salieron este turno, incluida la que cortó la
   * cadena: el poder es de la carta, no del ataque. El pulpo no aparece acá —ya
   * corrió al salir del mazo—.
   */
  function powersPlayed(player) {
    const chain = state.chains[player];
    const cards = chain.bustCard ? [...chain.cards, chain.bustCard] : chain.cards;
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
   * Los poderes jugados en el turno, todos juntos al soltar el ataque. El huevo, la
   * maceta y el veneno se miden contra el daño del golpe, así que una cadena cortada
   * los deja en nada; la fuerza y el caracol no dependen del daño y salen igual.
   */
  function applyPowers(player, swing) {
    const foe = other(player);
    const mine = state.status[player];
    const theirs = state.status[foe];
    const kind = player === 'cpu' ? 'cpu' : 'good';
    const mark = (id) => powerIcon(id, 'sm');

    for (const power of powersPlayed(player)) {
      if (power === 'strength') {
        mine.strength += STRENGTH_STEP;
        log(`${mark('strength')} ${who(player)} afila: +${mine.strength} de daño de acá en más.`, kind);
      } else if (power === 'octopus') {
        // No se mide contra el daño: reserva una carta del reparto, salga como salga
        // el ataque. Se acumula, y con dos pulpos son las dos primeras de la ronda.
        mine.stacked++;
        log(`${mark('octopus')} ${who(player)} va a elegir ${mine.stacked === 1
          ? 'la carta con que abre'
          : `las ${mine.stacked} cartas con que abre`} la ronda que viene.`, kind);
      } else if (swing <= 0) {
        // Sin daño no hay nada contra qué medir: solo la fuerza sobrevive a un
        // ataque desarmado, porque es la única que no sale del golpe.
        log(`${mark(power)} ${POWERS[power].name} sin efecto: el ataque hizo 0.`, 'muted');
      } else if (power === 'snail') {
        // Suma ataques y se queda con el mordisco más grande: acumula duración, no
        // cantidad. Un caracol chico no debilita un caracol grande que ya estaba.
        theirs.weak += SNAIL_ATTACKS;
        theirs.weakBite = Math.max(theirs.weakBite, Math.floor(swing / SNAIL_SHARE));
        log(`${mark('snail')} ${who(foe)} queda debilitado: ${theirs.weak} ataques con ` +
          `${theirs.weakBite} menos.`, kind);
      } else if (power === 'egg') {
        mine.egg += Math.floor(swing / 2);
        log(`${mark('egg')} ${who(player)} queda con un huevo de ${mine.egg}.`, kind);
      } else if (power === 'pot') {
        const got = heal(player, swing);
        log(got > 0
          ? `${mark('pot')} ${who(player)} se cura ${got} y queda en ${hpOf(state, player)}.`
          : `${mark('pot')} ${who(player)} ya está entero: la maceta no cura nada.`, got > 0 ? kind : 'muted');
      } else if (power === 'poison') {
        theirs.poison += Math.floor(swing / 2);
        log(`${mark('poison')} ${who(foe)} queda con ${theirs.poison} de veneno.`, kind);
      }
    }
  }

  async function finishTurn(player, points, era) {
    const foe = other(player);
    const mine = state.status[player];
    const theirs = state.status[foe];

    const swing = swingOf(state, player);
    // El caracol se gasta por ataque y no por ronda: así dura siempre lo mismo, sin
    // depender de si le tocaba abrir o cerrar el intercambio.
    if (mine.weak > 0 && --mine.weak === 0) mine.weakBite = 0;
    if (swing !== points) {
      log(`${who(player)} ataca por ${swing}: ${points} de cadena` +
        `${mine.strength ? ` +${mine.strength} de fuerza` : ''}` +
        `${mine.weakBite && swing < points + mine.strength ? ` −${mine.weakBite} por el caracol` : ''}.`,
        'muted');
    }

    // El huevo del rival se come lo que puede y solo se rompe cuando se gasta: si le
    // sobra vida, sigue puesto para el próximo golpe.
    const blocked = Math.min(theirs.egg, swing);
    if (blocked > 0) {
      theirs.egg -= blocked;
      log(`${powerIcon('egg', 'sm')} El huevo de ${whom(foe)} aguanta ${blocked}` +
        `${theirs.egg > 0 ? ` y le quedan ${theirs.egg}` : ' y se rompe'}.`, 'muted');
    }
    const landed = swing - blocked;

    state.roundScores[player] = swing;
    // El turno se cierra acá mismo. Si no, entre el golpe y el turno del otro queda
    // una ventana con `turn` todavía puesto y los botones vivos: alcanzaba para
    // plantarse dos veces y aplicar el daño dos veces.
    state.turn = null;
    // El daño entra acá y no al cerrar la ronda: el golpe tiene que verse cuando el
    // jugador lo suelta, no dos turnos después. Los totales terminan iguales.
    state.totals[player] += landed;
    state.busy = false;
    const target = swing > 0 ? foe : player;
    state.lastHit = { id: ++state.hitId, by: player, target, amount: landed, blocked };
    if (landed > 0) {
      log(`${who(player)} pega por ${landed}. ${who(target)} queda en ${hpOf(state, target)}.`,
        player === 'cpu' ? 'cpu' : 'good');
    }
    applyPowers(player, swing);
    emit();

    // Sus cartas vuelven al mazo antes de repartirle: lo que se lleve del centro entra
    // sobre el mazo completo, y la cadena sigue en pantalla hasta que cierre la ronda.
    const chain = state.chains[player];
    state.decks[player].push(...chain.cards.slice(state.recycled[player]));
    if (chain.bustCard) state.decks[player].push(chain.bustCard);
    state.returned[player] = true;

    // Un golpe que conecta se mira: el centro no se enciende encima del efecto.
    if (!(await tick(swing > 0 ? 900 : 500, era))) return;
    // Con alguien sin vida la partida ya está resuelta: no hay mazo que armar, solo
    // queda que el otro devuelva el golpe.
    if (matchOver()) return afterDraft(era);
    await startDraft(player, era);
  }

  // Con la maceta curando y el veneno mordiendo fuera del ataque, "llegó a 100 de
  // daño" ya no equivale a "lo dejó sin vida": la partida se cierra por vida.
  const matchOver = () => PLAYERS.some((p) => hpOf(state, p) <= 0);

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
   * El veneno se cobra al cerrar el intercambio, cuando los dos ya pegaron: muerde
   * por su cuenta entera y recién después baja de a POISON_DECAY. Cuenta como daño
   * de quien lo puso, así que suma a su total como cualquier golpe.
   */
  function tickPoison() {
    for (const player of PLAYERS) {
      const st = state.status[player];
      if (st.poison <= 0) continue;
      state.totals[other(player)] += st.poison;
      log(`${powerIcon('poison', 'sm')} El veneno le saca ${st.poison} a ${whom(player)}: ` +
        `queda en ${hpOf(state, player)}.`, player === 'human' ? 'bad' : 'good');
      st.poison = Math.max(st.poison - POISON_DECAY, 0);
    }
  }

  async function endRound(era) {
    const { human, cpu } = state.roundScores;
    // El daño ya está aplicado (ver `finishTurn`); acá solo se juzga el intercambio.
    state.roundWinner = human === cpu ? 'tie' : human > cpu ? 'human' : 'cpu';
    state.turn = null;
    tickPoison();

    const verdict =
      state.roundWinner === 'tie'
        ? 'Pegaron igual'
        : `Pegó más fuerte ${whom(state.roundWinner)}`;
    log(
      `Fin del intercambio ${state.round}: ${human} vs ${cpu} de daño. ${verdict}. ` +
        `Vida ${hpOf(state, 'human')} — ${hpOf(state, 'cpu')}.`,
      'round',
    );

    // Alguien quedó sin vida, pero los dos llegaron hasta acá jugando el intercambio
    // completo: el que caía primero alcanzó a devolver el golpe.
    state.phase = matchOver() ? 'matchEnd' : 'roundEnd';
    emit();
  }

  // ---- reparto de la reserva --------------------------------------------------

  /**
   * Qué le corresponde a `player` según cómo terminó su ronda. Plantado elige entre
   * dos cartas sin poder o una con poder; cortado, una sin poder y nada más — los
   * poderes son el premio de haber soltado el ataque.
   */
  const awardKind = (player) => (state.chains[player].busted ? 'bust' : 'stand');

  const plainCards = () => state.market.filter((c) => !c.power);

  function refillMarket() {
    while (state.market.length < MARKET_SIZE && state.pool.length) {
      state.market.push(state.pool.pop());
    }
  }


  function takeFromMarket(player, card) {
    const at = state.market.indexOf(card);
    if (at < 0) return;
    state.market.splice(at, 1);
    // Con un pulpo puesto, esta carta no se pierde en el barajado: queda reservada
    // para salir arriba del mazo en la ronda que viene. Cada pulpo reserva una.
    const st = state.status[player];
    if (st.stacked > 0) {
      st.stacked--;
      state.top[player].push(card);
      log(`${powerIcon('octopus', 'sm')} ${who(player)} reserva ${cardLabel(card)}: ` +
        `sale arriba del mazo la ronda que viene.`, player === 'cpu' ? 'cpu' : 'good');
    } else {
      state.decks[player].push(card);
      log(`${who(player)} suma ${cardLabel(card)} al mazo.`, player === 'cpu' ? 'cpu' : 'good');
    }
    // Se repone en el acto, en el mismo hueco para que las cartas no salten de lugar.
    if (state.pool.length) state.market.splice(at, 0, state.pool.pop());
  }

  /**
   * Todo lo que `player` podría llegar a llevarse ahora mismo. Plantado y sin haber
   * tocado nada las dos ramas siguen abiertas, así que sirve el centro entero; una
   * vez que agarró una carta sin poder ya se comprometió, y la segunda tampoco puede
   * llevar poder. El tamaño de la carta dejó de importar.
   */
  function draftable(player) {
    const mode = state.draft?.mode;
    if (mode === 'power') return []; // la carta con poder cierra el reparto
    if (mode === 'plain' || awardKind(player) === 'bust') return plainCards();
    return state.market.slice();
  }

  /**
   * Si nada de lo que puede agarrar lleva su símbolo, el centro no le ofrece nada que
   * enlace con su mazo: puede renovarlo entero, una sola vez por reparto.
   */
  function canRenew(player) {
    if (!state || state.phase !== 'draft' || drafting() !== player) return false;
    if (state.draft.renewed[player] || state.pool.length === 0) return false;
    const own = state.symbols[player];
    return !draftable(player).some((c) => c.symbols.includes(own));
  }

  /** Lo que está a la vista se va al fondo de la reserva y salen 5 cartas nuevas. */
  function renew(player) {
    state.draft.renewed[player] = true;
    state.pool.unshift(...state.market.splice(0, state.market.length));
    refillMarket();
    log(
      `${who(player)} renueva el centro: no había nada con ${crest(state.symbols[player], 'sm')}.`,
      player === 'cpu' ? 'cpu' : 'good',
    );
  }

  /** El reparto de `player`, apenas cierra su turno y antes de que juegue el otro. */
  async function startDraft(player, era) {
    state.draft = {
      order: [player],
      index: 0,
      mode: null,
      remaining: 0,
      took: 0,
      renewed: { human: false, cpu: false },
    };
    state.phase = 'draft';
    await runDraft(era);
  }

  const drafting = () => (state.draft ? state.draft.order[state.draft.index] : null);

  async function runDraft(era) {
    while (state.draft.index < state.draft.order.length) {
      const player = drafting();
      if (state.market.length === 0) {
        state.draft.index++;
        continue;
      }
      const kind = awardKind(player);

      if (player === 'cpu') {
        emit();
        if (!(await tick(700, era))) return;
        if (canRenew('cpu')) {
          renew('cpu');
          emit();
          if (!(await tick(700, era))) return;
        }
        // Decide la rama una vez —poder, o cartas sin poder— y después vuelve a
        // mirar el centro entre carta y carta: la reposición puede ofrecerle algo
        // mejor que lo que había al empezar.
        const plan = planDraft(state.market, cardsOf('cpu'), { kind });
        state.draft.mode = plan.mode;
        if (plan.mode === 'power') {
          takeFromMarket('cpu', plan.cards[0]);
        } else {
          for (let n = 0; n < plan.cards.length && plainCards().length; n++) {
            takeFromMarket('cpu', pickBest(plainCards(), cardsOf('cpu')));
          }
        }
        state.draft.mode = null;
        state.draft.index++;
        continue;
      }

      // Al jugador se le prepara la elección y se espera a que actúe desde la UI.
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
    await afterDraft(era);
  }

  function renewMarket() {
    if (!canRenew('human')) return;
    renew('human');
    emit();
  }

  /** Lo que el jugador puede tocar ahora mismo en el centro. */
  function pickable() {
    if (!state || state.phase !== 'draft' || drafting() !== 'human') return [];
    return draftable('human');
  }

  /**
   * Qué se lleva el jugador según la carta que tocó, sin preguntarle nada antes: una
   * carta con poder cierra el reparto ahí mismo; una sin poder deja pendiente una
   * segunda, que tampoco va a poder llevar poder.
   */
  const inferMode = (card) => (card.power ? 'power' : 'plain');

  async function takeCard(uid) {
    if (state.phase !== 'draft' || drafting() !== 'human') return;
    const card = pickable().find((c) => c.uid === uid);
    if (!card) return;
    const era = epoch;
    if (!state.draft.mode) {
      state.draft.mode = inferMode(card);
      state.draft.remaining = state.draft.mode === 'power' ? 1 : 2;
    }
    takeFromMarket('human', card);
    state.draft.took++;
    state.draft.remaining--;
    if (state.draft.remaining > 0 && state.market.length > 0) {
      emit();
      return;
    }
    state.draft.index++;
    state.draft.mode = null;
    await runDraft(era);
  }

  /** Cierra el reparto del jugador sin llevarse nada más. */
  async function skipDraft() {
    if (state.phase !== 'draft' || drafting() !== 'human') return;
    const era = epoch;
    log(
      state.draft.took ? 'Te quedás con lo que ya agarraste.' : 'No te llevás nada del centro.',
      'muted',
    );
    state.draft.index++;
    state.draft.mode = null;
    state.draft.remaining = 0;
    await runDraft(era);
  }

  // ---- acciones del jugador ----

  const canAct = () => state && !state.busy && state.turn === 'human' && state.phase === 'turn';

  async function hit() {
    if (!canAct()) return;
    const era = epoch;
    state.busy = true;
    emit();
    const card = draw('human');
    const next = playCard(state.chains.human, card);
    state.chains.human = next;
    if (next.busted) {
      log(`Sacaste ${cardLabel(card)}: se te desarma el ataque. 0 de daño.`, 'bad');
      emit();
      if (!(await tick(700, era))) return;
      await finishTurn('human', 0, era);
      return;
    }
    log(`Sacaste ${cardLabel(card)} → ataque de ${swingOf(state, 'human')}`, 'good');
    state.busy = false;
    emit();
  }

  async function stand() {
    if (!canAct()) return;
    const era = epoch;
    state.busy = true;
    const points = scoreChain(state.chains.human).total;
    log(`Soltás el ataque con ${points}.`, 'good');
    await finishTurn('human', points, era);
  }

  async function nextRound() {
    if (!state || state.phase !== 'roundEnd') return;
    await startRound(epoch);
  }

  return {
    get state() {
      return state;
    },
    unseenPool,
    pickable,
    drafting,
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
    nextRound,
    takeCard,
    skipDraft,
    renewMarket,
  };
}
