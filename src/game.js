import { buildPool, shuffle, cardLabel, crest } from './data.js';
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

// Cada jugador roba de su propio mazo y no hay descarte: cada ronda arranca con el
// mazo entero barajado de nuevo, como una tragamonedas. Contar lo que salió sigue
// valiendo dentro de la ronda —las cartas jugadas no vuelven hasta que cierre—, pero
// nada se arrastra de una ronda a la otra.

const who = (p) => (p === 'human' ? 'Vos' : 'La CPU');
/** El mismo nombre en mitad de una frase: "abre vos", "pegó más fuerte la CPU". */
const whom = (p) => (p === 'human' ? 'vos' : 'la CPU');
const other = (p) => (p === 'human' ? 'cpu' : 'human');

/** Vida que le queda a `player`: la vida inicial menos el daño que le hizo el otro. */
export const hpOf = (state, player) => Math.max(TARGET - state.totals[other(player)], 0);

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

  /** Todas las cartas que posee `player`. Entre rondas están todas en el mazo. */
  const ownedBy = (player) => state.decks[player];

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
      // Cuántas cartas de la cadena en curso ya volvieron al mazo (ver `draw`).
      recycled: { human: 0, cpu: 0 },
      // Si la cadena entera ya volvió al mazo, al terminar el turno de ese jugador.
      returned: { human: false, cpu: false },
      totals: { human: 0, cpu: 0 },
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
    // Se rebaraja todo el mazo propio: lo de la ronda pasada y lo que se sumó del centro.
    for (const player of PLAYERS) state.decks[player] = shuffle(state.decks[player]);
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
    if (state.totals.human < TARGET) return null;
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
      log(`La CPU saca ${cardLabel(card)} → ataque de ${scoreChain(next).total}`, 'cpu');
    }
  }

  async function finishTurn(player, points, era) {
    state.roundScores[player] = points;
    // El turno se cierra acá mismo. Si no, entre el golpe y el turno del otro queda
    // una ventana con `turn` todavía puesto y los botones vivos: alcanzaba para
    // plantarse dos veces y aplicar el daño dos veces.
    state.turn = null;
    // El daño entra acá y no al cerrar la ronda: el golpe tiene que verse cuando el
    // jugador lo suelta, no dos turnos después. Los totales terminan iguales.
    state.totals[player] += points;
    state.busy = false;
    const target = points > 0 ? other(player) : player;
    state.lastHit = { id: ++state.hitId, by: player, target, amount: points };
    if (points > 0) {
      log(`${who(player)} pega por ${points}. ${who(target)} queda en ${hpOf(state, target)}.`,
        player === 'cpu' ? 'cpu' : 'good');
    }
    emit();

    // Sus cartas vuelven al mazo antes de repartirle: lo que se lleve del centro entra
    // sobre el mazo completo, y la cadena sigue en pantalla hasta que cierre la ronda.
    const chain = state.chains[player];
    state.decks[player].push(...chain.cards.slice(state.recycled[player]));
    if (chain.bustCard) state.decks[player].push(chain.bustCard);
    state.returned[player] = true;

    // Un golpe que conecta se mira: el centro no se enciende encima del efecto.
    if (!(await tick(points > 0 ? 900 : 500, era))) return;
    // Con alguien sin vida la partida ya está resuelta: no hay mazo que armar, solo
    // queda que el otro devuelva el golpe.
    if (matchOver()) return afterDraft(era);
    await startDraft(player, era);
  }

  const matchOver = () => Math.max(state.totals.human, state.totals.cpu) >= TARGET;

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

  async function endRound(era) {
    const { human, cpu } = state.roundScores;
    // El daño ya está aplicado (ver `finishTurn`); acá solo se juzga el intercambio.
    state.roundWinner = human === cpu ? 'tie' : human > cpu ? 'human' : 'cpu';
    state.turn = null;

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

  /** Qué le corresponde a `player` según cómo terminó su ronda. */
  const awardKind = (player) => (state.chains[player].busted ? 'bust' : 'stand');

  function refillMarket() {
    while (state.market.length < MARKET_SIZE && state.pool.length) {
      state.market.push(state.pool.pop());
    }
  }

  /**
   * Cartas del centro que puede tomar quien está eligiendo. Si ninguna de las 5 es
   * del tamaño pedido sirve cualquiera: con un centro tan chico el tipo pedido puede
   * no estar, y quedarse sin nada sería peor.
   */
  function eligible(mode) {
    if (!mode) return [];
    const size = mode === 'trio' ? 3 : 2;
    const match = state.market.filter((c) => c.symbols.length === size);
    return match.length ? match : state.market;
  }

  function takeFromMarket(player, card) {
    const at = state.market.indexOf(card);
    if (at < 0) return;
    state.market.splice(at, 1);
    state.decks[player].push(card);
    log(`${who(player)} suma ${cardLabel(card)} al mazo.`, player === 'cpu' ? 'cpu' : 'good');
    // Se repone en el acto, en el mismo hueco para que las cartas no salten de lugar.
    if (state.pool.length) state.market.splice(at, 0, state.pool.pop());
  }

  /**
   * Todo lo que `player` podría llegar a llevarse. Plantado y antes de elegir modo
   * las dos opciones siguen abiertas, así que cuentan los dos tamaños.
   */
  function draftable(player) {
    const mode = state.draft?.mode;
    if (mode) return eligible(mode);
    if (awardKind(player) === 'bust') return eligible('pair');
    return [...new Set([...eligible('trio'), ...eligible('pair')])];
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
        // Decide el modo una vez y después vuelve a mirar el centro entre carta y
        // carta: la reposición puede ofrecerle algo mejor que lo que había al empezar.
        const plan = planDraft(state.market, ownedBy('cpu'), { kind });
        state.draft.mode = plan.mode;
        for (let n = 0; n < plan.cards.length && state.market.length; n++) {
          takeFromMarket('cpu', pickBest(eligible(plan.mode), ownedBy('cpu')));
        }
        state.draft.mode = null;
        state.draft.index++;
        continue;
      }

      // Al jugador se le prepara la elección y se espera a que actúe desde la UI.
      state.draft.took = 0;
      if (kind === 'bust') {
        state.draft.mode = 'pair';
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
   * Qué se lleva el jugador según la carta que tocó, sin preguntarle nada antes:
   * un trío cierra el reparto, un par deja pendiente la segunda carta.
   * Si el centro no tiene ningún par, "dos pares" se cobra con cualquier carta y
   * domina al trío, así que tocar un trío cuenta como par.
   */
  function inferMode(card) {
    const hasPairs = state.market.some((c) => c.symbols.length === 2);
    return card.symbols.length === 3 && hasPairs ? 'trio' : 'pair';
  }

  async function takeCard(uid) {
    if (state.phase !== 'draft' || drafting() !== 'human') return;
    const card = pickable().find((c) => c.uid === uid);
    if (!card) return;
    const era = epoch;
    if (!state.draft.mode) {
      state.draft.mode = inferMode(card);
      state.draft.remaining = state.draft.mode === 'trio' ? 1 : 2;
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
    log(`Sacaste ${cardLabel(card)} → ataque de ${scoreChain(next).total}`, 'good');
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
    eligible,
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
