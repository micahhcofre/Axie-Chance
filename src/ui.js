import { SYMBOLS, POWERS, cardLabel, crest, iconUrl, powerIcon } from './data.js';
import { axie, axieArt } from './axies.js';
import { createMotion } from './axie-motion.js';
import { isScoringCell, scoreChain, survivalOdds } from './rules.js';
import { createVfx, hitDelay, preloadVfx } from './vfx.js';
import { createAudio } from './audio.js';
import { createCues } from './audio-cues.js';
import {
  FORFEIT_ROUNDS, TARGET, PLAYERS, MARKET_SIZE, TUNING, hpOf, isBotSeat, lastChance,
  matchResult, ownedBy,
  seatVoice, swingOf,
} from './game.js';
import { markLevelCompleted } from './adventure.js';
import { createPowerDemoController, shouldAutoShowDemo } from './power-demos.js';

const $ = (id) => document.getElementById(id);
const settled = new Set();

/**
 * Lo último que mostró el número del golpe, por jugador. Sirve para una sola cosa:
 * saber si subió desde el repintado anterior, que es cuando el número pega el salto.
 */
const lastPoints = { p1: null, p2: null };

/**
 * A partir de acá el número deja de crecer. No es el máximo posible —una cadena puede
 * pasarse—, es donde termina de agrandarse: ahí ya mide lo mismo que la rueda de la
 * próxima carta, que es el ancho de la columna (ver `.swing-dmg` en el CSS). 20 puntos
 * ya es un ataque enorme —uno de cada veinte de los que conectan— y se lee como tal.
 */
const DMG_TOPE = 20;

/**
 * Qué asiento es el de **esta** pantalla, o null si la pantalla es de los dos —contra
 * la CPU, y con dos jugadores en el mismo teclado—. En red cada dispositivo es un solo
 * asiento, y de eso dependen los botones que se dejan apretar, a quién le habla cada
 * cartel y de qué lado se dibuja cada bicho.
 *
 * Va suelto en el módulo y no como parámetro porque lo miran seis funciones de render
 * y no cambia nunca dentro de una sesión: lo pone `mount` una vez y ahí queda.
 */
let mySeat = null;
/**
 * Si esta pantalla está enganchada a una partida de otro aparato. Va aparte de
 * `mySeat` porque hay un caso en que no alcanza con el asiento: el que entra con los
 * dos ocupados **mira**, no tiene asiento, y sin esta bandera un `mySeat` en null se
 * leería como "la pantalla es de los dos" y le daría los botones de ambos.
 */
let netPlay = false;
const isMine = (player) => (netPlay ? player === mySeat : true);

/**
 * De qué lado de la pantalla va un asiento. Con la pantalla compartida el orden es el
 * de la mesa —`p1` a la izquierda—; en red cada uno se ve a sí mismo a la izquierda,
 * que es donde uno se busca. Lo mismo mira el jugador de la computadora y el del
 * celular, cada uno con su bicho de este lado.
 */
const sideOf = (player) => (player === (mySeat ?? 'p1') ? 'left' : 'right');

/**
 * Cómo empieza un cartel que le habla al que tiene que apretar el botón. Contra la
 * CPU no hace falta decir a quién: hay un solo par de manos. Con dos jugadores el
 * "vos" de la pantalla cambia de silla en cada turno, así que el cartel arranca
 * diciendo de quién es — y en red, cuando el turno es de este aparato, ese "de quién"
 * volvés a ser vos.
 */
function addressing(state, player) {
  if (mySeat) return player === mySeat ? 'Vos · ' : `${seatVoice(state, player).name} · `;
  return seatVoice(state, player).you ? '' : `${seatVoice(state, player).name} · `;
}

function symChip(symbol, on) {
  return `<span class="sym" data-on="${on}" style="--c:${SYMBOLS[symbol].color}">
    ${crest(symbol)}</span>`;
}

/**
 * El poder de una carta, colgado abajo y separado por una línea: la cadena no lo
 * mira, así que tampoco se lee como un eslabón más.
 */
function powerChip(card) {
  const powers = card.stackedCards
    ? card.stackedCards.map((c) => c.power).filter(Boolean)
    : (card.powers || (card.power ? [card.power] : []));
  if (powers.length === 0) return '';
  const classPower = powers.find((p) => POWERS[p]?.symbol);
  const color = classPower ? (SYMBOLS[POWERS[classPower].symbol]?.color ?? '#f5c542') : '#f5c542';
  const cls = powers.length > 1 ? 'card-power card-power--multi' : 'card-power';
  return `<span class="${cls}" style="--c:${color}"
    >${powers.map((p) => powerIcon(p)).join('')}</span>`;
}

function cardHtml(chain, card, index, isStackTarget = false) {
  const giant = card.stackedCards ? ' card--giant' : '';
  const targetCls = isStackTarget ? ' card--stack-target' : '';
  const cls = (settled.has(card.uid) ? 'card is-settled' : 'card') + giant + targetCls;
  settled.add(card.uid);
  const syms = card.symbols.map((s) => symChip(s, isScoringCell(chain, index, s))).join('');
  const targetAttr = isStackTarget ? ` data-stack-col="${index}" role="button" tabindex="0" title="Alargar columna ${index + 1}"` : '';
  const dropHint = isStackTarget ? '<span class="card-stack-drop-hint" aria-hidden="true">↓</span>' : '';
  return `<div class="${cls}" data-col="${index}"${targetAttr}>${dropHint}<span class="card-no">${index + 1}</span>${syms}${powerChip(card)}</div>`;
}

function bustCardHtml(card) {
  const cls = settled.has(card.uid) ? 'card card--bust is-settled' : 'card card--bust';
  settled.add(card.uid);
  const syms = card.symbols.map((s) => symChip(s, false)).join('');
  return `<div class="card-gap"></div><div class="${cls}">${syms}${powerChip(card)}</div>`;
}

function pendingStackHtml(card, zoomAttr = '') {
  const syms = card.symbols.map((s) => symChip(s, true)).join('');
  return `
    <div class="tetris-dock"${zoomAttr} id="tetris-dock" aria-label="Carta de Free Game para colocar">
      <div class="tetris-badge">
        <i>✨</i>
        <span>Free Game — Elegí qué columna colocar</span>
      </div>
      <div class="tetris-lane" id="tetris-lane">
        <div class="card card--tetris-floating" id="tetris-floating-card">
          <span class="card-no">✨</span>
          ${syms}
          ${powerChip(card)}
        </div>
      </div>
    </div>`;
}

function runsHtml(chain) {
  if (chain.cards.length === 0) return '<span class="runs-empty">sin cartas</span>';
  if (chain.busted) {
    return `<span class="runs-zero">${
      chain.timeout ? 'Se acabó el tiempo' : 'Cadena cortada'} · el ataque falla</span>`;
  }
  return scoreChain(chain)
    .breakdown.map((run) => {
      return `<span class="run" data-alive="${run.alive}" style="--c:${SYMBOLS[run.symbol].color}">
        ${crest(run.symbol, 'sm')} ×${run.length} <b>${run.points}</b></span>`;
    })
    .join('');
}

/**
 * Lo que le quedó puesto encima: el huevo que le protege, el veneno que lo carcome,
 * el caracol que lo debilita y la fuerza que juntó. Solo aparece lo que está activo,
 * con el número al lado — sin esto los poderes serían invisibles después de la carta.
 */
export function statusHtml(state, player) {
  const st = state.status[player];
  const pipIcon = (src, value, title) =>
    `<span class="pip-status" title="${title}"><img src="${src}" alt=""><b>${value}</b></span>`;
  const pip = (id, value, title) => pipIcon(iconUrl(`status-${id}.png`), value, title);

  const chips = [];
  if (st.egg) {
    const breakDmg = st.eggBreak || TUNING.eggBreak;
    chips.push(pip('egg', breakDmg,
      `Huevo: ${breakDmg} de daño acumulado al romperse (escudo: ${st.egg})`));
  }
  if (st.poison) {
    chips.push(pip('poison', st.poison,
      `Veneno: ${st.poison} de daño al finalizar su turno, después se parte al medio`));
  }
  if (st.weak) {
    chips.push(pip('weak', st.weak, st.weak === 1
      ? 'Debilitado: su próximo ataque pega la mitad'
      : `Debilitado: sus próximos ${st.weak} ataques pegan la mitad`));
  }
  if (st.strength) chips.push(pip('strength', `+${st.strength}`, `Fuerza: +${st.strength} de daño en cada ataque`));
  if (st.stacked) {
    chips.push(pipIcon(POWERS.octopus.icon, st.stacked,
      `Pulpo: +${st.stacked} carta${st.stacked > 1 ? 's' : ''} extra para tu mazo al cerrar el turno`));
  }
  if (st.bubbles) {
    chips.push(pipIcon(POWERS.bubble.icon, st.bubbles,
      st.bubbles === 1
        ? 'Burbuja de Retorno: la carta que elijas del centro abrirá tu próxima ronda'
        : `Burbuja de Retorno: ${st.bubbles} cartas apiladas abrirán tu próxima ronda como carta gigante`));
  }
  if (state.bubbleCard?.[player]) {
    chips.push(pipIcon(POWERS.bubble.icon, '🫧',
      'Burbuja de Retorno: apertura lista para la próxima ronda'));
  }
  // Lo ya reservado, esperando a la ronda que viene.
  const held = state.top[player].length;
  if (held) {
    chips.push(pipIcon(POWERS.octopus.icon, `▲${held}`,
      `${held === 1 ? 'Una carta reservada' : `${held} cartas reservadas`}: ` +
      'abre la ronda que viene'));
  }
  const leafCount = typeof st.leaf === 'number' ? st.leaf : (st.leaf?.length || (typeof st.oak === 'number' ? st.oak : (st.oak?.length || 0)));
  if (leafCount > 0) {
    const totalRegen = leafCount * (TUNING.leafHeal ?? 4);
    chips.push(pip('leaf', leafCount,
      `Hoja (Leaf): ${leafCount} hoja${leafCount > 1 ? 's' : ''} (cura +${totalRegen} al final de tu turno y consume 1)`));
  }
  if (st.steelskin) {
    chips.push(pipIcon(POWERS.steelskin.icon, `≤${st.steelskin}`,
      `Piel de Escamas: limita el próximo ataque rival a máximo ${st.steelskin} de daño`));
  }
  return chips.length ? `<span class="plate-status">${chips.join('')}</span>` : '';
}

/**
 * La chapa que flota sobre cada Axie: su clase, su nombre y la barrita de vida.
 * Es lo único fijo de cada lado — el resto de la pantalla es de los dos.
 */
/**
 * El ancho de la barra de vida no se escribe acá adentro: cuelga de `--hp`, que la pone
 * `mount` sobre el nodo de la chapa —que es de los que no se repintan—. La barrita de
 * adentro sí se rehace con la chapa, y un nodo recién hecho no anima nada: naciendo con
 * el ancho puesto en el HTML, la vida saltaba de un número al otro. Naciendo con el
 * ancho de afuera nace donde estaba, y de ahí se vacía sola.
 */
export function plateHtml(state, player) {
  const own = axie(state.axies[player]);
  const chain = state.chains[player];
  const hp = hpOf(state, player);
  const dealt = state.roundScores[player];
  const shield = state.status[player].egg;

  // Una sola marca por vez: cómo terminó su ataque. El turno no se escribe acá —lo
  // cuenta el aro de color que se prende alrededor de la chapa entera mientras dura
  // (ver `.fighter[data-active="true"] .plate`)—, y un cartelito que dijera
  // "cargando" al lado del aro sería la misma cosa dos veces.
  let tag = '';
  if (dealt === 0 && chain.busted) {
    tag = '<span class="plate-tag" data-kind="bust">falló</span>';
  } else if (dealt) {
    tag = `<span class="plate-tag" data-kind="hit">${dealt} de daño</span>`;
  }

  const shieldBadge = shield > 0
    ? `<span class="plate-shield" title="Escudo: aguanta ${shield} de daño"><img src="${iconUrl('shield.png')}" alt="" class="shield-icon"><b>${shield}</b></span>`
    : '';

  return `
    <span class="plate-top" style="--c:${SYMBOLS[own.class].color}">
      ${crest(own.class, 'sm')}<span class="plate-name">${own.name}</span>
      <span class="plate-who">${
        player === mySeat ? 'Vos' : seatVoice(state, player).short}</span>${tag}
    </span>
    <span class="plate-hp" data-low="${hp <= TARGET / 4}">
      <span class="hpbar"><i></i></span>
      <b>${hp}</b>
      ${shieldBadge}
    </span>
    ${statusHtml(state, player)}`;
}

/**
 * La mesa es una sola y la usa el que está jugando: se ve la cadena del que tiene el
 * turno y, cuando nadie lo tiene, la del último que atacó — sus cartas se quedan
 * puestas hasta que abre el siguiente.
 */
function focusOf(state, picking) {
  if (state.phase === 'draft') return picking ?? state.order[0];
  if (state.turn) return state.turn;
  const played = state.order.filter((p) => state.roundScores[p] !== null);
  return played[played.length - 1] ?? state.order[0];
}

/**
 * Los puntos que lleva cargados el ataque: el número grande, apoyado justo encima del
 * aro de la próxima carta. Es lo que mira el que está decidiendo si sigue.
 *
 * Vivió arriba de las cartas, en el eje de la mesa, y de ahí se subió. Va con el aro
 * porque son la misma pregunta: cuánto se gana si sale, contra cuánto tiene de salir.
 * Los dos números uno encima del otro y del mismo ancho se leen de una sola mirada —y
 * el aro además le pone la escala al número, que mide lo que mide la rueda (ver
 * `.gauge` en el CSS)—.
 *
 * Es uno solo para los dos jugadores, como la mesa: muestra el del que la tiene puesta
 * (ver `focusOf`).
 */
function swingHtml(state, player) {
  const chain = state.chains[player];
  // El número grande es el daño que se va a aplicar de verdad, no el de la cadena
  // pelada: si la fuerza o el caracol lo mueven, el desglose va abajo.
  const points = swingOf(state, player);
  const raw = chain.busted ? 0 : scoreChain(chain).total;
  const st = state.status[player];

  // Solo se muestra el desglose cuando hay algo que explicar: si la cadena vale lo
  // mismo que el golpe, el número solo alcanza.
  const mods = [];
  if (points !== raw) {
    mods.push(`${raw} de cadena`);
    if (st.strength) mods.push(`+${st.strength} de fuerza`);
    if (st.weak) mods.push('partido al medio por el caracol');
  }
  const breakdown = mods.length ? `<span class="swing-mods">${mods.join(' · ')}</span>` : '';

  // Las dos medidas que necesita el CSS para elegir el cuerpo de la letra, y las dos
  // son del número y no de la pantalla:
  //
  // `--n` son los puntos, y de ahí sale el crecimiento —el número se agranda con la
  // cadena, así que un ataque grande se ve grande antes de leerse—. Se corta en
  // `DMG_TOPE`, que es donde termina de crecer.
  //
  // `--chars` es cuántos dígitos ocupa, y es lo que lo mantiene dentro de la rueda: la
  // letra es monoespaciada, así que el ancho es exactamente los dígitos por el paso, y
  // con eso el CSS lo achica solo cuando se pasaría de largo. Sin esto un `100` se
  // saldría por los costados del aro.
  const size = ` style="--n:${Math.min(points, DMG_TOPE)};--chars:${String(points).length}"`;

  // El `data-up` es el salto del momento en que sube, y sale de comparar contra lo
  // último que se pintó: la pantalla se repinta a cada rato y sin esta cuenta el
  // número estaría rebotando todo el tiempo por cosas que no son él.
  const grew = lastPoints[player] !== null && points > lastPoints[player];
  lastPoints[player] = points;

  // El color de la clase no se escribe acá: lo cuelga el nodo entero desde `mount`,
  // porque el número es del que está jugando y el aro de abajo no.
  //
  // "DAÑO" va debajo y no al lado: al lado le comía el ancho al número, que es de donde
  // sale su tamaño. Abajo los dos miden lo mismo —la rueda— y la palabra hace de pie.
  return `
    <span class="swing-dmg"${grew ? ' data-up="true"' : ''} data-busted="${
      chain.busted}"${size}>${points}</span>
    <span class="swing-cap">DAÑO</span>
    ${breakdown}`;
}

function fieldHtml(state, player) {
  const chain = state.chains[player];
  const isStackTarget = Boolean(state.pendingStack && state.pendingStack.player === player);
  const cards = chain.cards.map((c, i) => cardHtml(chain, c, i, isStackTarget)).join('');
  const bust = chain.bustCard ? bustCardHtml(chain.bustCard) : '';

  let maxSyms = 2;
  if (chain?.cards) {
    for (const c of chain.cards) {
      if (c.symbols && c.symbols.length > maxSyms) {
        maxSyms = c.symbols.length;
      }
    }
  }

  // Zoom out dinámico y progresivo:
  // 1. Durante Free Game (pendingStack): el dock y la hilera de cartas conviven verticalmente.
  // 2. Al apilar símbolos en Free Game (4+ símbolos): reduce la altura vertical de la carta.
  // 3. Al acumular cartas en la cadena (5+ cartas): escala hacia afuera progresivamente.
  let zoom = 1;
  if (isStackTarget) {
    const base = Math.max(maxSyms, 3);
    zoom = base <= 3 ? 0.74 : base === 4 ? 0.66 : 0.58;
  } else if (maxSyms >= 4) {
    zoom = maxSyms === 4 ? 0.72
      : maxSyms === 5 ? 0.64
      : maxSyms === 6 ? 0.56
      : 0.48;
  }
  if (chain?.cards?.length >= 5) {
    const cardZoom = chain.cards.length === 5 ? 0.90
      : chain.cards.length === 6 ? 0.82
      : 0.74;
    zoom = Math.min(zoom, cardZoom);
  }

  const zoomAttr = zoom < 1 ? ` style="--zoom:${zoom}"` : '';
  const pending = isStackTarget ? pendingStackHtml(state.pendingStack.card, zoomAttr) : '';

  return `
    ${pending}
    <div class="strip"${zoomAttr}>${cards}${bust}</div>
    <div class="runs"${zoomAttr}>${runsHtml(chain)}</div>`;
}

// Arriba solo queda dónde estamos parados: la vida se lee sobre cada Axie y las cartas
// que quedan en la reserva no las lee nadie —no se cuentan cartas, se apuesta contra el
// azar—, así que el marcador es una palabra y un número.
function scoreboardHtml(state) {
  return `<span class="sb-round">Ronda ${state.round}</span>`;
}

/**
 * El reloj: los segundos que quedan y una rayita que se vacía. Se ve en dos lugares
 * —debajo de la ronda, y adentro del centro mientras se elige, que tapa la barra— y
 * los dos salen de acá. Lo que se mueve entre un estado y otro lo pone `setClock`, a
 * su propio ritmo: el estado cambia cuando alguien juega, y el reloj corre igual.
 */
const clockLeft = (clock) => Math.max(0, clock.ends - Date.now());
const clockHtml = (clock) =>
  `<b>${Math.ceil(clockLeft(clock) / 1000)}</b><span class="clock-bar"><i></i></span>`;

function setClock(el, clock) {
  if (!el) return;
  el.dataset.on = String(Boolean(clock));
  if (!clock) return;
  const left = clockLeft(clock);
  // En rojo los últimos segundos: 5 del turno, 3 del reparto.
  el.dataset.low = String(left <= Math.min(5000, clock.ms * 0.3));
  el.style.setProperty('--p', String(left / clock.ms));
  paint(el, clockHtml(clock));
}

const clockColor = (state, clock) => SYMBOLS[axie(state.axies[clock.seat]).class].color;

function marketCardHtml(card, pickable) {
  const syms = card.symbols
    .map((s) => `<span class="sym" data-on="true" style="--c:${SYMBOLS[s].color}">${crest(s)}</span>`)
    .join('');
  const cls = settled.has(card.uid) ? 'market-card is-settled' : 'market-card';
  settled.add(card.uid);
  const label = card.symbols.map((s) => SYMBOLS[s].name).join(' y ')
    + (card.power ? `, con ${POWERS[card.power].name}` : '');
  return `<button class="${cls}" data-uid="${card.uid}"${pickable ? '' : ' disabled'}
    data-power="${card.power ?? ''}" aria-label="${label}">${syms}${powerChip(card)}</button>`;
}

/**
 * El centro. No está siempre puesto: aparece encima del combate recién cuando alguien
 * cierra su turno, que es cuando hay algo que elegir, y se va al terminar el reparto.
 */
function marketHtml(state, { picking, pickable, canRenew }) {
  const open = new Set(pickable.map((c) => c.uid));
  const mode = state.draft?.mode;
  const remaining = state.draft?.remaining ?? 0;
  const bonus = state.draft?.step === 'bonus' ? state.draft.bonus : 0;

  let head;
  let actions = '';
  if (isBotSeat(state, picking)) {
    const note = bonus
      ? `La CPU cobra su carta del ${powerIcon('octopus', 'sm')}…`
      : 'La CPU está eligiendo…';
    head = `<span class="overlay-title">El centro</span><p class="overlay-note">${note}</p>`;
  } else if (bonus) {
    // La etapa del pulpo tiene su propio cartel: es una carta de más y sin reglas, y
    // si se lee como parte del reparto normal el jugador cree que está gastando su
    // elección. El título cambia entero, no solo la bajada.
    const note = bonus === 1
      ? 'Una carta <b>de más</b>, la que quieras. Abre tu próxima ronda.'
      : `<b>${bonus} cartas de más</b>, las que quieras. Abren tu próxima ronda, en el orden que las toques.`;
    head = `<span class="overlay-title">${addressing(state, picking)}` +
      `${powerIcon('octopus', 'sm')} Carta del pulpo</span>` +
      `<p class="overlay-note">${note}</p>`;
    actions = `<div class="overlay-actions">
      <button class="btn" data-action="skip"
        title="Perdés la carta que te debe el pulpo">No agarrar</button></div>`;
  } else {
    // No se pregunta el modo: la carta que toques ya dice qué te llevás.
    let note;
    if (state.chains[picking].busted) {
      note = 'Se te cortó la cadena: llevate <b>una carta sin poder</b>.';
    } else if (!mode) {
      note = 'Llevate <b>una con poder</b> (y listo) <b>o dos sin poder</b>.';
    } else {
      note = `Vas por cartas sin poder: te ${
        remaining === 1 ? 'queda 1' : `quedan ${remaining}`}.`;
    }
    head = `<span class="overlay-title">${addressing(state, picking)}Elegí del centro</span>` +
      `<p class="overlay-note">${note}</p>`;
    // Nada de lo que podés llevarte lleva tu símbolo: te queda una renovación del centro.
    const renew = (canRenew && !(state.tutorial && !state.tutorialAllowRenew))
      ? `<button class="btn" data-action="renew"
          title="Ninguna carta que podés llevarte tiene tu símbolo">Renovar el centro ⟳</button>`
      : '';
    const skipDisabled = (state.tutorial && state.tutorialDisallowSkip) ? 'disabled style="opacity:0.3;pointer-events:none;"' : '';
    actions = `<div class="overlay-actions">${renew}
      <button class="btn" data-action="skip" ${skipDisabled}
        title="Cerrá el reparto sin sumar cartas al mazo">${
          state.draft.took ? 'No agarrar más' : 'No agarrar'
        }</button></div>`;
  }

  const slots = state.market.map((c) => {
    let isPick = state.tutorial && state.tutorialAllowedCard ? c.uid === state.tutorialAllowedCard : open.has(c.uid);
    if (state.tutorial && state.tutorialPlainOnly && c.power) {
      isPick = false;
    }
    return marketCardHtml(c, isPick);
  }).join('');
  const empty = '<div class="market-slot"></div>'.repeat(
    Math.max(MARKET_SIZE - state.market.length, 0),
  );
  // El centro tapa la barra, y con ella el reloj: acá va una copia.
  const clock = state.clock?.kind === 'draft' ? state.clock : null;
  const timer = clock
    ? `<div class="clock clock--draft" role="timer" data-on="true"
        style="--c:${clockColor(state, clock)};--p:${clockLeft(clock) / clock.ms}">${clockHtml(clock)}</div>`
    : '';
  return `<div class="overlay-panel">
    <div class="overlay-head">${head}${timer}</div>
    <div class="market-row">${slots}${empty}</div>
    ${actions}
  </div>`;
}

/**
 * El pie de la pantalla, armado. Son dos casilleros y siempre los mismos dos: arriba lo
 * que hay para leer —el renglón de lo que está pasando, y la cinta cuando algo cierra—
 * y abajo lo que hay para apretar.
 *
 * Los dos salen siempre, aunque estén vacíos, y eso no es de adorno: el alto del pie lo
 * fija el CSS (ver `--pie`) contando con que las dos cajas están puestas. Devolver
 * nada más el renglón cuando no hay nada que apretar —el turno de la CPU, el respiro
 * entre rondas— dejaría el casillero de abajo sin nadie adentro y, con él, la mesa
 * entera subiendo y bajando dos veces por turno. Vacío es un estado, no una ausencia.
 */
const pie = (say, acts = '') =>
  `<div class="controls-say">${say}</div>
   <div class="controls-acts">${acts}</div>`;

/** Cuántos papelitos caen al ganar. Los suficientes para que se lea como una lluvia
 * y no como una docena de cuadraditos contables, y no tantos como para que un teléfono
 * tenga que mover doscientas cajas a la vez. */
const CONFETTI = 46;

/**
 * La lluvia de papelitos de la victoria.
 *
 * Se arma acá, en HTML, y no en el canvas de los golpes: ese canvas está en
 * `plus-lighter` —los efectos del kit vienen capturados sobre negro y se **suman** a
 * la pantalla— y un papelito sumado deja de ser un papelito, es una luz. Esto es papel:
 * opaco, con su color plano, tapando lo que pasa por atrás.
 *
 * Cada uno lleva lo suyo en variables: de dónde arranca, cuánto tarda, cuánto se
 * corre al caer y cuánto gira. El CSS pone el resto (ver `.confetti`). El azar va acá
 * y no en el CSS porque el cartel se pinta una sola vez por partida: la lluvia se
 * sortea entera al terminar y después no cambia más.
 *
 * Los colores son los seis de las clases, que son los colores del juego.
 */
function confettiHtml() {
  const colors = Object.values(SYMBOLS).map((s) => s.color);
  const bits = [];
  for (let i = 0; i < CONFETTI; i++) {
    // Repartidos a lo ancho por su lugar en la fila y no al azar puro: sorteando las
    // dos coordenadas quedan grumos y claros, que se lee como que algo se rompió. El
    // empujón al azar es para que no se note la fila.
    const x = ((i + .5) / CONFETTI) * 100 + (Math.random() * 5 - 2.5);
    const bit = [
      `--x:${x.toFixed(2)}%`,
      // Los primeros salen enseguida y el resto va cayendo detrás: la lluvia entra con
      // el cartel y se termina sola a los cuatro segundos y pico.
      `--delay:${(Math.random() * 1.5).toFixed(2)}s`,
      `--dur:${(2.4 + Math.random() * 1.9).toFixed(2)}s`,
      // Para qué lado se va mientras cae, y cuántas vueltas da en el camino.
      `--sway:${(Math.random() * 120 - 60).toFixed(0)}px`,
      `--spin:${(Math.random() * 1080 - 540).toFixed(0)}deg`,
      `--c:${colors[i % colors.length]}`,
      // Unos anchos y otros finitos, que es lo que hace que parezcan recortados.
      `--w:${(6 + Math.random() * 6).toFixed(1)}px`,
    ].join(';');
    bits.push(`<i style="${bit}"></i>`);
  }
  return `<div class="confetti" aria-hidden="true">${bits.join('')}</div>`;
}

/**
 * Ganó el que está mirando.
 *
 * Se mira contra el asiento de **este** aparato y no contra `p1`: en una sala la misma
 * partida se ve en dos pantallas y el que ganó no es el mismo para las dos —el cartel
 * viejo le decía "te noquearon" al que jugaba de `p2` y ganaba—. Sin asiento propio
 * —contra la CPU, y el que entra a mirar una sala llena— el que mira es `p1`.
 *
 * El doble KO no es de nadie: no ganó ninguno, y ahí el cartel es el otro.
 */
const wonMatch = (state) => matchResult(state) === (mySeat ?? 'p1');

/**
 * El cartel del final: el grande, el del medio de la pantalla.
 *
 * Estaba abajo, en el pie, sobre la misma cinta tallada que usan los carteles de cada
 * intercambio. Dos problemas con eso. Uno: apoyado sobre la cinta y pegado al botón de
 * abajo se leía como **otro botón**, y el que termina la partida se queda mirando cuál
 * de los dos hay que apretar. Dos: el final de la partida no es una noticia más de la
 * fila de noticias — es *la* noticia, y las noticias que importan no se dan en el
 * mismo renglón donde venía diciéndose quién pegó más fuerte.
 *
 * Así que acá no hay caja: es letra sola, grande, en el medio, encima de los dos
 * bichos —uno festejando y el otro tirado, que es la otra mitad de lo que se está
 * diciendo—.
 *
 * Y son dos carteles y no cinco. Antes había uno por cada combinación de modo y
 * resultado —"¡Ganaste el combate!", "Te noquea la CPU", "¡Gana el Jugador 2!", el
 * empate— y todos decían el mismo dato con distintas palabras. Lo único que el que
 * está mirando quiere saber al terminar es si ganó, así que hay uno para cada
 * respuesta: la victoria, que además tira papelitos, y la otra, que no le echa la
 * culpa a nadie. El doble KO cae del lado de la segunda: nadie ganó, y eso es
 * exactamente lo que dice.
 *
 * La tercera es la partida anulada —alguien se fue en las primeras rondas (ver
 * `FORFEIT_ROUNDS`)—, que no es perder ni empatar: no se jugó, y decir cualquiera de
 * las otras dos sería mentir. Cuando la partida terminó por abandono, abajo se dice
 * quién se fue: sin eso, la partida se corta de golpe en el medio y no se entiende por qué.
 */
function finaleHtml(state) {
  const won = wonMatch(state);
  const voided = matchResult(state) === 'void';
  let text;
  if (state.mode === 'adventure') {
    text = won
      ? (state.adventure?.level === 6 ? '¡Aventura Completada!' : `¡${state.adventure?.name ?? 'Nivel'} Superado!`)
      : 'Derrota en la Aventura';
  } else {
    text = won ? '¡Victoria!' : voided ? 'Partida anulada' : 'La suerte no estuvo de tu lado…';
  }
  const gone = state.forfeit && seatVoice(state, state.forfeit.by).name;
  const note = !gone ? ''
    : voided ? `${gone} abandonó en las primeras ${FORFEIT_ROUNDS} rondas: no gana nadie.`
    : `${gone} abandonó la partida.`;
  return `<strong class="finale-text">${text}</strong>` +
    (note ? `<span class="finale-note">${note}</span>` : '') +
    (won ? confettiHtml() : '');
}

function controlsHtml(state, { picking, acting }) {
  if (state.phase === 'draft') {
    const bonus = state.draft?.step === 'bonus';
    const at = picking ? addressing(state, picking) : '';
    const msg = !picking || isBotSeat(state, picking)
      ? 'La CPU elige del centro…'
      : !isMine(picking) ? `${at}está eligiendo del centro…`
      : bonus ? `${at}elegí la carta que te debe el pulpo.` : `${at}elegí tu carta del centro.`;
    return pie(`<span class="controls-msg">${msg}</span>`);
  }

  if (state.phase === 'matchEnd') {
    // Cómo terminó no se dice acá abajo: sale grande en el medio de la pantalla (ver
    // `finaleHtml`). El pie queda con lo único que hay para hacer, que son las dos
    // puertas: otra partida con lo mismo, o volver a elegir.
    //
    // Y no dice más nada. El renglón traía la vida final y en cuántos intercambios, y
    // era repetir en letra chica lo que ya está en pantalla: las dos barras de vida
    // siguen puestas arriba y el número de intercambio, en el marcador.
    //
    // La puerta al menú es de la portada, así que solo existe donde hay portada: en la
    // partida en red la salida es la de la sala, y un botón que no lleva a ningún lado
    // es peor que no tenerlo.
    //
    // Si alguien se fue, tampoco hay "Jugar de nuevo": el asiento de enfrente quedó
    // vacío y no hay contra quién. Queda una sola puerta, la de volver a las salas.
    if (netPlay && state.forfeit) {
      return pie('', '<button class="btn btn-primary" data-action="leave">Volver a las salas</button>');
    }
    if (state.mode === 'adventure') {
      const won = wonMatch(state);
      const isLastLevel = (state.adventure?.level ?? 1) >= 6;
      if (won) {
        return pie(
          '',
          (!isLastLevel
            ? '<button class="btn btn-primary" data-action="adv-next">Siguiente Nivel</button>'
            : '<button class="btn btn-primary" data-action="adv-map">Ver Aventura</button>') +
          '<button class="btn" data-action="adv-map">Aventura</button>' +
          '<button class="btn" data-action="menu">Menú principal</button>',
        );
      }
      return pie(
        '',
        '<button class="btn btn-primary" data-action="restart">Reintentar Nivel</button>' +
        '<button class="btn" data-action="adv-map">Aventura</button>' +
        '<button class="btn" data-action="menu">Menú principal</button>',
      );
    }
    return pie(
      '',
      '<button class="btn btn-primary" data-action="restart">Jugar de nuevo</button>' +
      (netPlay ? '' : '<button class="btn" data-action="menu">Menú principal</button>'),
    );
  }

  if (state.phase === 'roundEnd') {
    // El cierre del intercambio no dice nada. Ni el cartel de quién pegó más fuerte,
    // ni el renglón con el daño de cada uno y las dos vidas.
    //
    // Los dos contaban en palabras lo que el intercambio acaba de actuar: los números
    // del daño salen volando de los bichos al golpear, el que se llevó la peor parte
    // lo muestra el cuerpo, y las vidas están arriba, en las barras, moviéndose. Un
    // cartel y una línea de texto apilados bajo las cartas para repetir eso, en el
    // único momento de la partida que tenía que ser un respiro y no una lectura más.
    //
    // Sin botón, además: la ronda siguiente arranca sola (ver `endRound`). Así que el
    // pie queda con las dos cajas vacías, que es un estado y no un olvido — el alto
    // lo fija el CSS con las dos puestas (ver `pie`), y la mesa no se mueve.
    return pie('');
  }

  // El que juega su última chance ya está sin vida: el único final que le queda es el
  // empate, y eso se dice, porque cambia por completo cómo se lee el turno.
  const dying = lastChance(state);

  // Sin nadie a quien darle un botón: o está jugando la máquina, o entre el reparto y
  // el turno siguiente (turn === null) no hay nada que decidir.
  if (!acting || !isMine(acting)) {
    // En red el turno del otro no es una espera muerta: se ve cómo se le arma la
    // cadena carta por carta en la misma mesa. El cartel solo dice de quién es.
    const msg = !state.turn ? 'Repartiendo…'
      : !acting && dying === state.turn ? 'Última chance de la CPU: si te deja sin vida, empatan.'
      : !acting ? 'La CPU está cargando su ataque…'
      : dying === acting
        ? `${addressing(state, acting)}última chance: si te deja sin vida, empatan.`
        : `${addressing(state, acting)}está cargando su ataque…`;
    return pie(`<span class="controls-msg">${msg}</span>`);
  }

  const hitDisabled = (state.busy || (state.tutorial && state.tutorialAllowed && state.tutorialAllowed !== 'hit' && state.tutorialAllowed !== 'any')) ? 'disabled' : '';
  const standDisabled = (state.busy || (state.tutorial && state.tutorialAllowed && state.tutorialAllowed !== 'stand' && state.tutorialAllowed !== 'any')) ? 'disabled' : '';
  const hitCls = (state.tutorial && state.tutorialAllowed === 'hit') ? 'btn btn-danger tuto-allowed' : 'btn btn-danger';
  const standCls = (state.tutorial && state.tutorialAllowed === 'stand') ? 'btn btn-primary tuto-allowed' : 'btn btn-primary';
  const acts = `<button class="${hitCls}" data-action="hit" ${hitDisabled}>Robar carta</button>
     <button class="${standCls}" data-action="stand" ${standDisabled}>Atacar</button>`;

  if (state.pendingStack && state.pendingStack.player === acting) {
    const card = state.pendingStack.card;
    return pie(
      `<span class="controls-msg">✨ Free Game: elegí la columna donde colocar ${cardLabel(card)}</span>`,
      acts,
    );
  }

  if (state.freeGame?.[acting]) {
    return pie(
      `<span class="controls-msg">✨ Free Game activo: robando carta automáticamente…</span>`,
      acts,
    );
  }

  const disabled = state.busy ? 'disabled' : '';
  const at = addressing(state, acting);
  // En un turno normal el renglón no dice nada, y eso es lo correcto: lo que decía
  // —"sigue viva 🦋🐙"— ya está dibujado dos veces más arriba, en los símbolos
  // encendidos de la cadena. Repetirlo en palabras no agregaba un dato: le sacaba aire
  // a lo único que se aprieta y le pedía al ojo que leyera para enterarse de algo que
  // ya estaba mirando.
  //
  // Quedan las dos cosas que la cadena no puede mostrar: la última chance —que cambia
  // qué significa seguir— y, en la partida compartida, de quién es el turno, que sin
  // esto no lo dice nadie porque los dos juegan en la misma pantalla.
  const msg = dying === acting
    ? `${at}última chance: si dejás sin vida al otro, empatan.`
    : at && !mySeat ? `Le toca a ${seatVoice(state, acting).name}.`
    : '';
  // Los dos botones van juntos en su propia caja y no sueltos al pie, y el cartel
  // queda arriba de ellos. Son la única cosa que se aprieta en toda la partida: tienen
  // que estar donde el pulgar los busca —en el medio, uno al lado del otro y del mismo
  // tamaño—, y no arrinconados contra el borde derecho con el cartel tirando del otro
  // lado. Que midan lo mismo lo hace la caja (ver `.controls-acts` en el CSS), no el
  // largo de lo que dice cada uno: "Atacar" es una palabra y "Robar carta" son dos, y
  // aun así ninguno de los dos es el botón grande.
  return pie(
    `<span class="controls-msg">${msg}</span>`,
    acts,
  );
}

/**
 * El medidor de la próxima carta, colgado en el aire entre los dos Axies, debajo de los
 * puntos que lleva cargados el ataque (ver `swingHtml`).
 *
 * Antes era un cuadro en la barra de la derecha, y ahí el número más importante de la
 * decisión —seguir o plantarse— quedaba fuera de la pelea: había que despegar la vista
 * del combate para leerlo. Acá es un aro, del tamaño de una moneda, en el hueco que
 * los dos bichos dejan libre: se lee sin mover los ojos y no tapa nada.
 *
 * Solo existe mientras te toca decidir. Cuando juega la CPU no hay nada que medir, y
 * un aro apagado en el medio de la pantalla sería un adorno.
 */
function oddsHtml(state, player, pool) {
  if (!player) return '';

  const { ok, total, p } = survivalOdds(state.chains[player], pool);
  const pct = Math.round(p * 100);
  const risk = pct >= 65 ? 'low' : pct >= 40 ? 'mid' : 'high';

  // El aro se dibuja con `--p`; el texto del lector de pantalla va aparte porque
  // "72 % 6/10" suelto no dice nada.
  return `
    <div class="odds-cap" aria-hidden="true">continúa la cadena</div>
    <div class="odds-dial" data-risk="${risk}" style="--p:${pct}" aria-hidden="true">
      <b class="odds-pct">${pct}<i>%</i></b>
      <span class="odds-frac">${ok}/${total}</span>
    </div>
    <span class="sr-only">La próxima carta continúa la cadena: ${pct}%.
      ${ok} de ${total} cartas sirven.</span>`;
}

/**
 * Los dos números del mazo, en un renglón: lo que juntó y lo que todavía no salió esta
 * ronda. Van arriba del panel que se abre tocando un Axie.
 */
function deckHtml(state, player) {
  return `<span>${ownedBy(state, player)} cartas</span>
    <span>${state.decks[player].length} sin salir</span>`;
}

/**
 * De quién es el mazo que se está mirando.
 *
 * "Tuyo" es el asiento que maneja esta pantalla: el que le tocó en la sala, o el
 * primero jugando contra la CPU. El que entra a mirar una sala llena no tiene ninguno,
 * y ahí los dos mazos se nombran por su asiento.
 */
function deckTitle(state, player) {
  const you = mySeat ?? (netPlay ? null : 'p1');
  return player === you ? 'Tu mazo' : `Mazo ${seatVoice(state, player).of}`;
}

/** Los símbolos de una carta y su poder, en texto plano: es un `title`, no un cartel. */
function cardTitle(card) {
  const syms = card.symbols.map((sym) => SYMBOLS[sym].name).join(' · ');
  const powers = card.stackedCards
    ? card.stackedCards.map((c) => c.power).filter(Boolean)
    : (card.powers || (card.power ? [card.power] : []));
  if (powers.length > 0) {
    const names = powers.map((p) => POWERS[p]?.name).filter(Boolean).join(' + ');
    return `${syms} — ${names}`;
  }
  return syms;
}

/**
 * Una carta como se ve en un mazo: sin número de orden, porque acá no hay orden —el
 * mazo se rebaraja entero al empezar cada intercambio— y con su poder colgado si lo
 * trae, que es lo que separa una carta ganada de una de fábrica.
 */
function sheetCardHtml(card) {
  const syms = card.symbols
    .map((sym) => `<span class="sym" data-on="true" style="--c:${SYMBOLS[sym].color}">${crest(sym)}</span>`)
    .join('');
  return `<div class="card card--deck" title="${cardTitle(card)}">${syms}${powerChip(card)}</div>`;
}

/**
 * El mazo entero de un jugador, partido en dos por donde de verdad está partido: las
 * diez con las que arrancó —que salen de su clase y son las mismas todas las partidas—
 * y lo que se fue llevando del centro, que es la partida que jugó.
 *
 * Las dos listas salen de `state.start` y `state.added` y no de `state.decks`, que se
 * baraja de una ronda a la otra: acá el orden tiene que quedarse quieto.
 */
function deckSheetHtml(state, player) {
  const added = state.added[player];
  const sheet = (label, cards) => `<p class="sheet-label">${label}</p>
    <div class="sheet-row">${cards.map(sheetCardHtml).join('')}</div>`;
  return sheet(`Mazo inicial · ${state.start[player].length} cartas`, state.start[player])
    + (added.length
      ? sheet(`Sumadas del centro · ${added.length}`, added)
      : `<p class="sheet-label">Sumadas del centro</p>
         <p class="sheet-empty">Todavía ninguna: las cartas del centro se ganan atacando.</p>`);
}

function logHtml(state) {
  return state.log.map((e) => `<li data-kind="${e.kind}">${e.text}</li>`).join('');
}

/**
 * Un pulso de animación sobre el nodo de un Axie, que es de los pocos que no se
 * repintan. Se limpia el atributo, se fuerza el reflow y recién ahí se pone: sin eso
 * el navegador no reinicia una animación cuyo valor no cambió, y dos golpes seguidos
 * del mismo tipo solo se verían una vez. Se saca solo al terminar.
 */
const pulses = new Map();
function pulse(el, attr, value, ms) {
  if (!el?.dataset) return;
  const key = `${el.id}:${attr}`;
  clearTimeout(pulses.get(key));
  el.dataset[attr] = '';
  void el.offsetWidth;
  el.dataset[attr] = value;
  pulses.set(key, setTimeout(() => { el.dataset[attr] = ''; }, ms));
}

/**
 * Escribe una parte de la pantalla, y solo si lo que dice cambió.
 *
 * La mesa se repinta entera a cada carta, y hasta acá eso quería decir tirar y rehacer
 * cada nodo aunque dijera exactamente lo mismo. Un nodo recién nacido no tiene de dónde
 * venir: no hay transición que pueda correr —el navegador no anima el primer valor de
 * algo que acaba de aparecer—, la animación de entrada que tuviera arranca de nuevo, y
 * el botón que estabas por apretar deja de estar abajo del dedo: pierde el `:hover`, y
 * si lo tenías con el teclado, el foco se cae al cuerpo de la página.
 *
 * Comparar contra lo último que se escribió deja quieto lo que no cambió. Eso es todo
 * lo que hace falta para que la pantalla deje de aparecer de golpe: lo que sigue igual
 * se queda donde está, y lo que cambia es lo único que se mueve.
 *
 * Devuelve si escribió, que es lo que necesita saber quien después va a animar el nodo
 * nuevo (ver la barra de vida en `mount`). La llave es el nodo, en un `WeakMap`: no
 * hay nada que limpiar cuando la pantalla se va.
 */
const painted = new WeakMap();
function paint(node, html) {
  if (!node || painted.get(node) === html) return false;
  painted.set(node, html);
  node.innerHTML = html;
  return true;
}

/**
 * Abrir y cerrar el centro.
 *
 * Abrir es en el acto —lo que se abre encima de todo no se hace esperar— pero cerrar
 * no: el panel se va con una animación y el nodo recién se esconde cuando terminó. Sin
 * esto el centro desaparecía en un cuadro y en ese mismo instante aparecían los dos
 * botones del turno, el aro y la mesa vacía: media pantalla cambiaba de golpe y no
 * quedaba claro qué había pasado.
 *
 * Mientras se va, el panel se queda escrito —se está yendo con él— y deja de recibir
 * clics, que es lo que evita que alguien toque una carta que ya no está.
 */
const OVERLAY_OUT = 200;
let closing = 0;
function overlay(el, open) {
  if (open) {
    clearTimeout(closing);
    el.dataset.open = 'true';
    el.dataset.closing = '';
    el.hidden = false;
    return;
  }
  // Si ya se está yendo, se lo deja irse. Esto no es un detalle: la pantalla se repinta
  // varias veces en el medio segundo que sigue al reparto —arranca la ronda, se reparte
  // la primera carta— y cada uno de esos repintados vuelve a pedir cerrar. Sin esta
  // línea, el segundo cortaba la animación por la mitad y el centro desaparecía de un
  // cuadro para el otro, que es exactamente lo que se vino a arreglar.
  if (el.dataset.closing === 'true') return;
  // Y cerrar lo que ya estaba cerrado no es una animación, es el estado de siempre: el
  // centro está guardado casi toda la partida. La marca de abierto la lleva el nodo y
  // no `hidden`, que arranca puesto desde el HTML.
  if (el.dataset.open !== 'true') {
    el.hidden = true;
    return;
  }
  el.dataset.open = '';
  el.dataset.closing = 'true';
  closing = setTimeout(() => {
    el.hidden = true;
    el.dataset.closing = '';
    paint(el, '');
  }, OVERLAY_OUT);
}

/**
 * Cuánto tarda el Axie en cruzar hasta el rival, en ms: lo que va del comienzo del
 * salto al momento en que su cuerpo llega. Es el 44% de `axie-lunge` en el CSS.
 */
const LUNGE_REACH = 270;

/**
 * Las dos maneras de sacar una carta, para `pulse`: la que alarga la cadena y la que
 * la corta. Los milisegundos son los de sus animaciones en el CSS.
 *
 * El desplome dura 1,6 s enteros y nada lo interrumpe: el ataque desarmado que sale
 * 1,3 s después ya no le pisa el `data-react` —dejó de tener animación propia, ver
 * `playHit`— así que el Axie se queda abajo mientras el turno se cierra en cero. Los
 * 1,6 s son los del CSS; el clip `sad` del kit dura 1,67 y termina de volver solo.
 */
const DRAW = ['act', 'draw', 420];
const SLUMP = ['react', 'slump', 1600];

/**
 * Cuánto sacude la pantalla un golpe. Los golpes chicos no sacuden nada: si la
 * pantalla tiembla a cada rato deja de contar nada, y el sacudón tiene que querer
 * decir "esta te dolió".
 *
 * Los cortes salen de medir 3820 ataques con la CPU jugando de los dos lados: el 40%
 * se desarma y hace 0, la mitad de los que conectan pega 5 o 6, y de ahí para arriba
 * la cola se afina rápido. Con 10 sacude uno de cada tres ataques que conectan; con
 * 20, uno de cada veinte —que es más o menos una vez por partida, y es justo lo que
 * tiene que ser—.
 */
const shakeOf = (amount) => (amount >= 20 ? 'hard' : amount >= 10 ? 'soft' : '');

/** El número —o la palabra— que sube flotando sobre un Axie y se saca solo. */
function floatTag(el, kind, text) {
  el.insertAdjacentHTML('beforeend', `<span class="dmg" data-kind="${kind}">${text}</span>`);
  const tag = el.querySelector('.dmg:last-child');
  tag?.addEventListener('animationend', () => tag.remove());
}

/**
 * Si un golpe se leyó como un ataque desarmado.
 *
 * `amount` es lo que le sacó de vida al rival, y eso no alcanza para saberlo: un ataque
 * que el huevo se comió entero también llega en cero. Lo que separa las dos cosas es si
 * algo se bloqueó — ahí el ataque salió, cruzó y rebotó contra la cáscara, y contarlo
 * como un fallo dejaba al que pegaba clavado en su lugar (ver `playHit`).
 *
 * Sale exportado porque es la clase de cuenta de una línea que se vuelve a escribir mal
 * el día que alguien la toque, y así hay un test que la mira.
 */
export const whiffed = (hit) => hit.amount === 0 && hit.blocked === 0;

/**
 * El intercambio de golpes: el que pega sale disparado contra el otro, y en el
 * momento en que llega revienta el efecto de su clase, el que lo recibe sale
 * despedido y le aparece el número encima. Las tres cosas caen juntas porque las
 * tres se cuelgan del mismo instante — `hitDelay`, lo que tarda en conectar el
 * efecto de esa clase—, cada una arrancando lo suyo por adelantado.
 *
 * El sonido va con ellas, y es el único que no sale de mirar el estado (ver
 * `audio-cues.js`): el estado ya cambió, lo que falta es el instante.
 *
 * Vive fuera del render normal porque es un pulso, no un estado: la pantalla se
 * repinta entera a cada carta y una animación puesta en el HTML se cortaría a la
 * mitad. El `<span>` del número se saca solo al terminar, así no se apilan.
 */
function playHit(vfx, audio, arena, portraits, motions, hit, klass) {
  const el = portraits[hit.target];
  if (!el) return;

  // La cadena que se cortó ya se contó entera, y se contó bien: la carta cayó, sonó la
  // nota que se cae y el Axie se desplomó ahí mismo (ver el desplome más arriba). Esto
  // que llega ahora es el mismo fallo por segunda vez, y venía con el efecto de
  // desarme del kit encima y un trastabillar de `battle/get-debuff`: un fogonazo y un
  // sacudón de cuerpo, o sea exactamente el vocabulario de recibir un golpe. Después
  // de haberse puesto triste, eso no leía como "fallaste" sino como "y encima te
  // pegaron" — dos cosas contradictorias pegadas una atrás de la otra.
  //
  // Acá no queda nada. Se probó dejar el cartelito de "fallo" flotando en el instante
  // en que el ataque se cierra, y no llega a verse: con la cadena cortada la ronda
  // cierra 1,2 s después de la carta y el centro se abre encima, así que el cartel
  // sale atrás del panel. Y aunque se viera, no diría nada nuevo — en ese mismo
  // momento la chapa ya dice FALLÓ y la cadena ya dice "se le cortó la cadena · 0
  // DAÑO", las dos quietas en pantalla y no medio segundo flotando.
  //
  // Así que el fallo se cuenta una sola vez, cuando la carta cae, y el Axie se queda
  // desinflado hasta que la ronda cierre.
  if (hit.kind === 'bust') return;

  // La cáscara del huevo es un golpe pero no un ataque: nadie cruza la pantalla, el
  // que pegó se corta donde está. Por eso no hay embestida ni efecto de clase —el kit
  // no trae uno para el huevo— y todo el peso lo llevan el retroceso, el número y el
  // sonido de rebote. El huevo ya se vio romperse en el golpe anterior; esto es la
  // consecuencia, y llega un beat después justamente para que se lean separados.
  if (hit.kind === 'thorns') {
    audio.sfx('thorns');
    pulse(el, 'react', 'hit', 900);
    motions[hit.target].pulse('hurt');
    // Sacudón siempre, aunque sean 5. `shakeOf` mide ataques, y 5 no le llega ni al
    // escalón más chico; pero acá el sacudón no está midiendo el tamaño del golpe
    // sino avisando que hubo uno, que es lo único que este número necesita.
    pulse(arena, 'shake', shakeOf(hit.amount) || 'soft', 500);
    // Y el número dice de qué es. Un `−5` suelto sobre el Axie que acaba de atacar no
    // se explica solo —nadie cruzó la pantalla, no hubo efecto de clase—, así que va
    // con el huevo dibujado al lado y la palabra encima: HUEVO, −5.
    floatTag(el, 'thorns',
      `<span class="dmg-label">${powerIcon('egg', 'sm')} Huevo roto</span>−${hit.amount}`);
    return;
  }

  if (hit.kind === 'feather') {
    audio.sfx('thorns');
    pulse(el, 'react', 'hit', 900);
    motions[hit.target].pulse('hurt');
    pulse(arena, 'shake', shakeOf(hit.amount) || 'soft', 500);
    floatTag(el, 'feather',
      `<span class="dmg-label">${powerIcon('feather', 'sm')} Pluma</span>−${hit.amount}`);
    return;
  }

  // El único fallo que llega hasta acá es el del que se plantó y quedó en cero igual
  // —el caracol le comió el mordisco—. Ese sí no se vio venir: el ataque salió y se
  // desarmó en el aire, y este es el primer y único momento en que se cuenta.
  //
  // Y "quedó en cero" no es lo mismo que "no llegó nada": `amount` es lo que **pasó**
  // del escudo, así que un golpe de 6 contra un huevo de 10 llega acá valiendo cero.
  // Mirando solo ese número el ataque se contaba como desarmado —el que pegaba no
  // cruzaba la pantalla, al otro le explotaba el efecto de fallo encima y quedaba
  // flotando un FALLO— mientras el registro decía que el huevo había aguantado 6. El
  // ataque salió, cruzó y rebotó contra la cáscara: lo que lo separa de un fallo es que
  // algo se bloqueó, no que el rival no haya sacado vida.
  const miss = whiffed(hit);
  // Un ataque que conecta es el golpe de la clase del que pegó; uno que se desarma
  // es el efecto de "desarmado", y cae sobre el que falló.
  const key = miss ? 'bust' : klass;
  const impact = hitDelay(key);
  vfx.play(key, el, { from: sideOf(hit.by) });
  // El sonido se larga **antes** que el efecto: lo que tiene que caer sobre el impacto
  // es su punto más fuerte, y a eso tarda en llegar (ver `lead` en `audio.js`).
  //
  // El ataque que se desarmó no suena acá: ya sonó al romperse la cadena, que es el
  // momento que cuenta (ver `audio-cues.js`). Lo que se ve acá es la consecuencia, y
  // repetirle el ruido encima solo la corría de lugar.
  if (!miss) audio.sfx(key, { delay: Math.max(impact - audio.lead(key), 0) });
  // El huevo que aguanta suena arriba del golpe, apenas después — y ahora también se
  // ve, debajo del número: cuánto se comió el huevo, y si con eso se terminó. Es la
  // mitad que faltaba de la cáscara —el número que le vuelve al atacante un beat
  // después sale de acá—; sin esto el escudo se rompía solo en el registro y el
  // jugador recibía un golpe salido de la nada.
  if (hit.blocked > 0) {
    audio.sfx('block', { delay: impact + 80 });
    setTimeout(() => {
      floatTag(el, 'egg', `${powerIcon('egg', 'sm')} ${hit.broke ? '¡se rompe!' : `−${hit.blocked}`}`);
    }, impact + 80);
  }

  // Un ataque que falla no es un ataque: no cruza a ningún lado, se le desarma
  // encima y trastabilla —eso ya lo cuenta el `whiff` sobre el que falló—.
  if (!miss) {
    setTimeout(() => {
      pulse(portraits[hit.by], 'act', 'attack', 620);
      // El salto lo pone el CSS y el zarpazo lo pone el kit: los dos arrancan juntos.
      motions[hit.by].pulse('attack');
    }, Math.max(impact - LUNGE_REACH, 0));
  }

  setTimeout(() => {
    pulse(el, 'react', miss ? 'whiff' : 'hit', 900);
    motions[hit.target].pulse(miss ? 'whiff' : 'hurt');
    // El sacudón es de la cámara, no del que recibe: va sobre el arena entero y cae
    // en el mismo instante que el efecto y el número.
    const shake = miss ? '' : shakeOf(hit.amount);
    if (shake) pulse(arena, 'shake', shake, 500);
    // El número sale solo si hay número. Un ataque que el huevo se comió entero no
    // deja un `−0` colgado sobre el rival: lo que pasó ya lo cuenta la cáscara, que
    // sale justo ahí abajo diciendo cuánto aguantó y si con eso se rompió.
    if (miss) floatTag(el, 'whiff', 'fallo');
    else if (hit.amount > 0) floatTag(el, 'hit', `−${hit.amount}`);
  }, impact);
}

/**
 * Cómo está parado un Axie ahora mismo. Es estado, no pulso: dura mientras dure la
 * situación, así que va como atributo y el CSS decide qué animación corre encima de
 * la respiración —agacharse a cargar, desplomarse, festejar—.
 */
/**
 * El clip del kit que le corresponde a cada postura. `charging` no tiene uno propio
 * que se repita: `activity/prepare` es plantarse para atacar, se reproduce una vez y
 * el Axie se queda así hasta que le toque golpear.
 */
const CLIP_OF = { idle: 'idle', charging: 'ready', ko: 'ko', win: 'win' };

function stanceOf(state, player) {
  // El que se queda sin vida no se desploma en el acto: alcanza a devolver el golpe
  // y recién cuando cierra el intercambio se cae. Por eso el KO mira la fase y no la
  // vida — si no, la CPU jugaría su último turno tirada en el piso.
  if (state.phase === 'matchEnd') {
    // Por abandono nadie quedó tirado: festeja el que se quedó, si ganó algo.
    if (state.forfeit) return player === state.forfeit.winner ? 'win' : 'idle';
    return hpOf(state, player) <= 0 ? 'ko' : 'win';
  }
  if (state.turn === player && state.phase === 'turn') return 'charging';
  return 'idle';
}

/**
 * @param {object} game   la partida: la de acá, o la que vive en el servidor y llega
 *   por el cable (ver `net.js`). Las dos contestan lo mismo.
 * @param {{seat?: string|null, net?: boolean, start?: boolean}} opts  `net` dice que la
 *   partida vive en otro lado; `seat` es el asiento que le tocó a esta pantalla, y en
 *   red puede ser null: es el que entró con los dos asientos ocupados y solo mira.
 *   `start` es si hay que arrancar una partida al montar: con la portada puesta no,
 *   porque contra quién se juega todavía no está elegido (ver `lobby.js`).
 *   `leave` es qué hacer con "Volver a las salas", que es asunto de la sala y no de la
 *   mesa (ver `net.js`).
 * @returns {{restart: (setup?: object) => void}} con qué arrancar una partida desde
 *   afuera. Es lo que usa la portada cuando por fin se elige un modo.
 */
export function mount(game, { seat = null, net = false, start = true, leave = null } = {}) {
  mySeat = seat;
  netPlay = net;
  const fighters = { p1: $('fighter-p1'), p2: $('fighter-p2') };
  const plates = { p1: $('plate-p1'), p2: $('plate-p2') };
  const portraits = { p1: $('axie-p1'), p2: $('axie-p2') };
  // Los Axies solo cambian entre partidas: se repintan aparte del resto de la
  // pantalla, que se rehace en cada carta. Recrear sus capas a cada rato la haría
  // parpadear entera.
  const shown = { p1: null, p2: null, match: null, finale: null, demoMatch: null };
  // Las animaciones que traen los propios Axies. Viven aparte del repintado: son del
  // muñeco, no de la partida, y siguen corriendo entre carta y carta.
  const motions = {
    p1: createMotion(portraits.p1, 0),
    p2: createMotion(portraits.p2, 0.5),
  };
  const arena = $('arena');
  // El cartel del final, encima de la escena (ver `finaleHtml`).
  const finale = $('finale');
  // Cómo arranca la próxima partida: contra quién, con qué dificultad y con qué Axie.
  // Todo eso se elige en la portada y queda acá adentro, así "Jugar de nuevo" repite
  // lo último que se eligió sin volver a preguntar nada.
  const config = { mode: 'cpu', difficulty: 'normal' };
  const field = $('field');
  // Los puntos cargados, encima del aro de la próxima carta. Es uno solo para los dos,
  // como la mesa: muestra la cadena del que la tiene puesta (ver `swingHtml`).
  const swing = $('swing');
  const market = $('market');
  const clockEl = $('clock');
  // El reloj corre entre estado y estado: un intervalo que vive mientras haya reloj.
  let ticking = 0;
  function paintClock() {
    const clock = game.state?.clock ?? null;
    setClock(clockEl, clock);
    setClock(market.querySelector?.('.clock'), clock?.kind === 'draft' ? clock : null);
    if (!clock && ticking) {
      clearInterval(ticking);
      ticking = 0;
    }
  }
  const vfx = createVfx($('vfx'));
  const audio = createAudio();
  // El remate del final es del asiento de esta pantalla: en una sala los dos aparatos
  // miran la misma partida y solo uno ganó.
  const cues = createCues(audio, { seat: mySeat });
  let animated = 0; // id del último golpe ya animado
  // Qué mazo está abierto, o `null` si no hay ninguno. Lo mira el repintado para saber
  // si tiene que dibujar las cartas y de quién (ver más abajo).
  let peeking = null;
  // Cartas que ya se le vieron a cada uno en la cadena en curso, para que el tirón
  // de robar salga una sola vez por carta y no en cada repintado.
  const seen = { p1: 0, p2: 0 };
  // De quién era la mesa y si el turno era de esta pantalla, en el repintado anterior.
  // Los dos sirven para lo mismo: saber qué acaba de **aparecer**. Lo que entra tiene
  // una animación de entrada, y una animación de entrada que se dispara en cada
  // repintado —la pantalla se rehace a cada carta— es un temblequeo, no una entrada.
  let held = null;
  let acted = false;
  let animatedStack = 0;
  let autoDrawing = false;
  let autoDrawTimer = null;
  let isDroppingStack = false;
  let hadPendingStack = false;
  let activePowerDemo = null;

  function openPowerDemo(levelId, initialPower = null) {
    if (activePowerDemo) {
      activePowerDemo.destroy();
      activePowerDemo = null;
    }
    activePowerDemo = createPowerDemoController({
      levelId,
      initialPower,
      onClose: () => {
        activePowerDemo = null;
      },
    });
    return activePowerDemo;
  }

  game.subscribe((state) => {
    // Una partida nueva se olvida de la anterior: las cartas ya animadas y el último
    // número del golpe son de otra mesa. Sale del estado y no del botón que la arrancó
    // porque en red la puede haber arrancado el otro aparato.
    if (shown.match !== state.match) {
      shown.match = state.match;
      forget();
      if (activePowerDemo) {
        activePowerDemo.destroy();
        activePowerDemo = null;
      }
    }

    const isAdv = state.mode === 'adventure' && Boolean(state.adventure?.level);
    const powersDemoBtn = $('powers-demo-btn');
    const hudPowersBtn = $('hud-powers-btn');
    if (powersDemoBtn) powersDemoBtn.hidden = !isAdv;
    if (hudPowersBtn) hudPowersBtn.hidden = !isAdv;

    // Demostración automática no invasiva al inicio de los primeros 3 niveles (7 símbolos)
    if (
      isAdv &&
      state.round === 1 &&
      shown.demoMatch !== state.match
    ) {
      shown.demoMatch = state.match;
      if (shouldAutoShowDemo(state.adventure.level)) {
        openPowerDemo(state.adventure.level);
      }
    }

    // El terreno es el de tu clase: cambia al elegir otro Axie, no a cada carta.
    arena.dataset.arena = axie(state.axies[mySeat ?? 'p1']).class;
    paint($('scoreboard'), scoreboardHtml(state));

    const picking = game.drafting();
    // El asiento que la pantalla está manejando: el del turno, si no lo juega la
    // máquina. Con dos jugadores cambia de silla en cada turno y los mismos botones
    // le sirven a los dos — nunca les toca a la vez.
    const acting = game.acting();
    const focus = focusOf(state, picking);

    for (const player of PLAYERS) {
      // La chapa se escribe sola; el ancho de la barra de vida se le cuelga después.
      // Cuando la chapa se rehizo hay un reflow en el medio, que es el mismo truco de
      // `pulse`: sin él el navegador ve la barrita nueva y el ancho nuevo como un solo
      // cambio y la pone directamente ahí. Con él, la barrita nace donde estaba la
      // anterior —el `--hp` viejo sigue puesto— y recién entonces se va vaciando.
      if (paint(plates[player], plateHtml(state, player))) void plates[player].offsetWidth;
      plates[player].style.setProperty('--hp', `${(100 * hpOf(state, player)) / TARGET}%`);
      // El color de la clase vive en el peleador y no en la chapa: la chapa se repinta
      // entera a cada carta, y el aro del turno se dibuja sobre el borde de ese nodo.
      fighters[player].style.setProperty('--c', SYMBOLS[axie(state.axies[player]).class].color);
      // De qué lado se dibuja. Es del lado y no del asiento porque en red los dos se
      // ven a sí mismos a la izquierda: el CSS cuelga de acá la posición, el retroceso
      // del golpe y hacia dónde mira el bicho.
      fighters[player].dataset.side = sideOf(player);
      fighters[player].dataset.active = String(state.turn === player && state.phase === 'turn');
      fighters[player].dataset.busted = String(state.chains[player].busted);
      // El halo de la última chance. Se prende con el golpe que lo deja sin vida y se
      // apaga cuando contesta, así que dura exactamente lo que dura el turno regalado.
      fighters[player].dataset.lastChance = String(lastChance(state) === player);
      const stance = stanceOf(state, player);
      portraits[player].dataset.stance = stance;
      motions[player].stance(CLIP_OF[stance] ?? 'idle');

      // Cada carta que sale se siente en el cuerpo del que la robó: un tirón hacia
      // arriba, y una más en la cadena. La que corta la cadena se siente al revés —el
      // cuerpo se desinfla— y hay que verlo **acá**, cuando la carta cae, por el mismo
      // motivo por el que el sonido suena acá y no con el desarme que llega 700 ms
      // después (ver `audio-cues.js`): lo que el jugador tiene que entender es que no
      // enganchó, y eso pasa cuando la ve.
      //
      // Antes esta carta no movía al Axie —lo dejaba en manos del ataque desarmado— y
      // el resultado era que la peor carta de la tirada pasaba sin que el muñeco se
      // enterara, y después llegaba un efecto que se leía como un golpe más.
      const chain = state.chains[player];
      const cards = chain.cards.length + (chain.bustCard ? 1 : 0);
      if (cards > seen[player]) {
        pulse(portraits[player], ...(chain.busted ? SLUMP : DRAW));
        if (chain.busted) motions[player].pulse('sad');
      }
      seen[player] = cards;

      if (shown[player] !== state.axies[player]) {
        shown[player] = state.axies[player];
        portraits[player].innerHTML = axieArt(state.axies[player]);
        // Las capas son otras: el reproductor tiene que volver a tomarlas.
        motions[player].mount(state.axies[player]);
        // El atlas del golpe pesa: se pide al arrancar la partida, no al primer ataque.
        preloadVfx(state.symbols[player]);
      }
    }

    // La mesa cambia de dueño entre un turno y el otro, y cuando eso pasa cambia
    // entera: las cartas del que atacaba se van y el número grande vuelve a cero. Que
    // aparezca lo nuevo **entrando** —y no puesto ahí de un cuadro para el otro— es
    // toda la diferencia entre un cambio de turno y un parpadeo.
    if (held !== null && held !== focus) {
      pulse(field, 'swap', 'true', 320);
      pulse(swing, 'swap', 'true', 320);
    }
    held = focus;
    paint(field, fieldHtml(state, focus));
    field.dataset.owner = focus;
    field.dataset.busted = String(state.chains[focus].busted);

    // Los puntos cargados son de la misma cadena que la mesa, así que son del mismo:
    // uno solo en pantalla, con el color del que la tiene puesta. El color va en el
    // nodo y no en el HTML porque adentro se repinta a cada carta y el resplandor
    // cuelga de acá.
    paint(swing, swingHtml(state, focus));
    swing.style.setProperty('--c', SYMBOLS[axie(state.axies[focus]).class].color);

    // El centro solo existe mientras haya que elegir; el resto del tiempo no está.
    const drafting = state.phase === 'draft' && Boolean(picking);
    const drafter = game.drafter();
    overlay(market, drafting);
    // Se ve el centro del otro mientras elige —es información pública y se está
    // llevando cartas que después vas a ver salir—, pero no se puede tocar.
    const myDraft = Boolean(drafter) && isMine(drafter);
    // Cerrado no se borra acá: el panel se queda escrito mientras se va, y lo limpia
    // `overlay` cuando terminó de irse.
    if (drafting) {
      paint(market, marketHtml(state, {
        picking,
        pickable: myDraft ? game.pickable() : [],
        canRenew: myDraft && game.canRenew(drafter),
      }));
    }

    // El reloj, con el color del que lo tiene encima. Va después del centro porque
    // también le escribe la copia de adentro.
    if (state.clock) clockEl.style.setProperty('--c', clockColor(state, state.clock));
    paintClock();
    if (state.clock && !ticking) {
      ticking = setInterval(paintClock, 200);
      ticking.unref?.();
    }

    // El turno propio entra: los dos botones suben a su lugar uno detrás del otro y el
    // aro de la próxima carta aparece con ellos. Sale del cambio y no del estado —solo
    // cuando el turno *pasa* a ser de esta pantalla— porque si no se repetiría en cada
    // carta que sale.
    const mine = Boolean(acting && isMine(acting) && state.phase === 'turn');
    if (mine && !acted) {
      pulse($('controls'), 'enter', 'turn', 620);
      pulse($('odds'), 'enter', 'turn', 620);
    }
    acted = mine;
    paint($('controls'), controlsHtml(state, { picking, acting }));

    // El cartel del final entra con una animación, así que se pinta una sola vez por
    // partida y no en cada repintado: escribirlo de nuevo le haría arrancar la entrada
    // desde cero cada vez que se mueve algo atrás. La llave es la partida y el
    // resultado, que es lo único que puede cambiar sin que la partida cambie —el
    // último golpe todavía puede dar vuelta un KO en empate—.
    const ended = state.phase === 'matchEnd' ? `${state.match}|${matchResult(state)}` : null;
    if (shown.finale !== ended) {
      shown.finale = ended;
      finale.hidden = !ended;
      // El color y los papelitos cuelgan de una sola cosa: si ganó el que mira.
      finale.dataset.won = ended ? String(wonMatch(state)) : '';
      finale.innerHTML = ended ? finaleHtml(state) : '';
      if (ended && state.mode === 'adventure' && wonMatch(state) && state.adventure?.level) {
        markLevelCompleted(state.adventure.level);
      }
    }
    // El medidor es de quien decide, y solo si esa decisión es de esta pantalla: la
    // probabilidad del otro sale de su mazo, y mostrársela sería jugarle el turno.
    paint($('odds'), acting && isMine(acting)
      ? oddsHtml(state, acting, game.unseenPool(acting))
      : '');
    // El panel del mazo es del Axie que se tocó. Sin ninguno tocado sigue al que juega
    // —salvo en red, donde es siempre el tuyo—: es lo que va a mostrar cuando se abra,
    // y dejarlo puesto es lo que hace que abrirlo no parpadee.
    const owner = peeking ?? mySeat ?? focus;
    $('deck-label').textContent = deckTitle(state, owner);
    paint($('deck'), deckHtml(state, owner));
    // Las cartas se dibujan solo con el panel abierto: son hasta cuarenta, y repintarlas
    // en cada carta que sale es trabajo tirado a la basura el 99% de la partida. Abierto
    // sí se repinta con todo lo demás, así una carta que entra al mazo aparece ahí
    // mismo en vez de esperar a que el panel se cierre y se vuelva a abrir.
    paint($('deck-sheet'), peeking ? deckSheetHtml(state, peeking) : '');
    paint($('log'), logHtml(state));

    if (state.lastHit && state.lastHit.id !== animated) {
      animated = state.lastHit.id;
      playHit(vfx, audio, arena, portraits, motions, state.lastHit, state.symbols[state.lastHit.by]);
    }
    // Todo lo demás que suena sale de comparar este estado con el anterior.
    cues.watch(state);

    if (state.lastStacked && state.lastStacked.id !== animatedStack) {
      animatedStack = state.lastStacked.id;
      if (!isDroppingStack && state.lastStacked.player === focus) {
        playAutoStackAnimation(state.lastStacked);
      }
    }

    if (state.pendingStack && !hadPendingStack && state.pendingStack.player === (mySeat ?? 'p1')) {
      audio?.sfx?.('pot', { rate: 1.25, gain: 0.8 });
      audio?.sfx?.('open', { rate: 1.4, gain: 0.65 });
    }
    hadPendingStack = Boolean(state.pendingStack);

    // Auto-draw de Free Game: si está activo y todavía no se sacó la carta para montar,
    // se roba automáticamente sin obligar al jugador a apretar un botón.
    const canAutoDraw = mine && Boolean(state.freeGame?.[acting]) && !state.pendingStack && !state.busy;
    if (canAutoDraw && !autoDrawing) {
      autoDrawing = true;
      clearTimeout(autoDrawTimer);
      autoDrawTimer = setTimeout(() => {
        autoDrawing = false;
        if (game.state && game.state.freeGame?.[acting] && !game.state.pendingStack && !game.state.busy) {
          game.hit();
        }
      }, 420);
    }
  });

  /**
   * El audio no puede arrancar solo: hasta que el jugador no toca algo, el navegador
   * no deja sonar nada. Cualquier clic o tecla sirve, y se sigue llamando después de
   * la primera vez porque el contexto se suspende al volver de otra pestaña.
   */
  for (const kind of ['pointerdown', 'keydown']) {
    document.addEventListener(kind, () => audio.unlock(), { capture: true });
  }
  // Un combate en una pestaña que nadie está mirando sigue solo: que siga callado.
  document.addEventListener('visibilitychange', () => audio.listen(!document.hidden));

  // ---- el menú de las tres rayitas -------------------------------------------
  // Todo lo que no es jugar vive acá adentro: el sonido, las reglas y la puerta de
  // salida. Antes estaba desparramado por la barra, encima del combate.

  const hud = $('hud-menu');
  const hudBtn = $('hud-btn');

  function openHud(on) {
    hud.hidden = !on;
    hudBtn.setAttribute('aria-expanded', String(on));
  }

  // Guardado, y diciéndolo. La partida en red engancha esta pantalla cuando ya está
  // andando, así que el estado del menú se pone acá y no se hereda del HTML.
  openHud(false);

  hudBtn.addEventListener('click', (e) => {
    // Sin esto el clic sigue viaje hasta el documento y cierra lo que acaba de abrir.
    e.stopPropagation?.();
    openHud(hud.hidden);
  });
  hud.addEventListener('click', (e) => {
    // Los interruptores y las perillas dejan el panel abierto: se toquetean de a
    // varios. Lo que abre otra pantalla —las reglas, abandonar— lo cierra, y para eso
    // alcanza con dejar que el clic llegue al documento.
    if (!e.target?.closest?.('.hud-item')) e.stopPropagation?.();
  });
  document.addEventListener('click', () => openHud(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') openHud(false);
  });

  const toggles = { sfx: $('sfx-btn'), music: $('music-btn') };
  const dials = { sfx: $('sfx-vol'), music: $('music-vol') };
  const pcts = { sfx: $('sfx-pct'), music: $('music-pct') };

  /**
   * Los dos interruptores y las dos perillas diciendo la verdad. El volumen se pinta
   * aunque el sonido esté apagado: es lo que va a sonar cuando lo vuelvan a prender,
   * y una perilla que se borra al apagar hace pensar que se perdió lo elegido.
   */
  function paintToggles() {
    for (const kind of ['sfx', 'music']) {
      const on = kind === 'sfx' ? audio.sfxOn : audio.musicOn;
      const vol = Math.round((kind === 'sfx' ? audio.sfxVol : audio.musicVol) * 100);
      toggles[kind].dataset.on = String(on);
      toggles[kind].setAttribute('aria-pressed', String(on));
      dials[kind].value = String(vol);
      pcts[kind].textContent = `${vol}%`;
    }
  }
  toggles.sfx.addEventListener('click', () => {
    audio.setSfx(!audio.sfxOn);
    paintToggles();
  });
  toggles.music.addEventListener('click', () => {
    audio.setMusic(!audio.musicOn);
    paintToggles();
  });
  // `input` y no `change`: el volumen se escucha mientras se arrastra, que es la única
  // forma de elegirlo — nadie sabe de antemano en qué número le gusta.
  dials.sfx.addEventListener('input', (e) => {
    audio.setSfxLevel(Number(e.target.value) / 100);
    paintToggles();
  });
  dials.music.addEventListener('input', (e) => {
    audio.setMusicLevel(Number(e.target.value) / 100);
    paintToggles();
  });
  paintToggles();


  $('controls').addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'hit') {
      if (game.state?.tutorial && game.state?.tutorialAllowed && game.state.tutorialAllowed !== 'hit' && game.state.tutorialAllowed !== 'any') return;
      if (game.state?.pendingStack && !isDroppingStack) {
        const targets = field.querySelectorAll('[data-stack-col]');
        if (targets.length > 0) {
          dropTetrisCard(0, targets[0]);
          return;
        }
      }
      game.hit();
    }
    else if (action === 'stand') {
      if (game.state?.tutorial && game.state?.tutorialAllowed && game.state.tutorialAllowed !== 'stand' && game.state.tutorialAllowed !== 'any') return;
      game.stand();
    }
    else if (action === 'restart') restart();
    else if (action === 'adv-next') {
      const nextLvl = (game.state?.adventure?.level ?? 1) + 1;
      restart({ mode: 'adventure', adventureLevel: nextLvl });
    }
    else if (action === 'leave') leave?.();
  });

  /** Lo que hay que olvidar al cambiar de partida: cartas ya animadas y números viejos. */
  function forget() {
    settled.clear();
    lastPoints.p1 = null;
    lastPoints.p2 = null;
    autoDrawing = false;
    clearTimeout(autoDrawTimer);
    isDroppingStack = false;
    hadPendingStack = false;
    animatedStack = 0;
  }

  /**
   * Arranca una partida nueva con la misma configuración que la anterior, salvo lo
   * que venga en `setup`. Contra quién se juega, con qué dificultad y con qué Axie se
   * eligen en la portada y no acá: esta pantalla es la mesa, y una vez sentado a la
   * mesa lo único que se vuelve a apretar es "Jugar de nuevo", que repite lo que había.
   */
  function restart(setup = {}) {
    Object.assign(config, setup);
    game.newMatch({ ...config });
  }

  market.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="renew"]')) {
      if (game.state?.tutorial && !game.state?.tutorialAllowRenew) return;
      return game.renewMarket();
    }
    if (e.target.closest('[data-action="skip"]')) {
      if (game.state?.tutorial && game.state?.tutorialDisallowSkip) return;
      return game.skipDraft();
    }
    const cardEl = e.target.closest('.market-card:not([disabled])');
    const uid = cardEl?.dataset.uid;
    if (uid) {
      if (game.state?.tutorial && game.state?.tutorialAllowedCard && Number(uid) !== game.state.tutorialAllowedCard) return;
      if (game.state?.tutorial && game.state?.tutorialPlainOnly) {
        const card = game.state.market.find((c) => c.uid === Number(uid));
        if (card?.power) return;
      }
      game.takeCard(Number(uid));
    }
  });

  function updateFloatingCardPosition(targetEl) {
    if (isDroppingStack) return;
    const floating = typeof document !== 'undefined' ? document.getElementById('tetris-floating-card') : null;
    const lane = typeof document !== 'undefined' ? document.getElementById('tetris-lane') : null;
    if (!floating || !lane) return;
    if (!targetEl) {
      floating.style.transform = '';
      return;
    }
    const tRect = targetEl.getBoundingClientRect?.();
    const lRect = lane.getBoundingClientRect?.();
    if (!tRect || !lRect) return;
    const initialCenterX = lRect.left + (lRect.width / 2);
    const targetCenterX = tRect.left + (tRect.width / 2);
    const shiftX = targetCenterX - initialCenterX;
    floating.style.transform = `translateX(${shiftX}px)`;
  }

  function spawnLiquidImpactVfx(tRect) {
    if (typeof document === 'undefined' || !tRect) return;
    const centerX = tRect.left + (tRect.width / 2);
    const centerY = tRect.top + (tRect.height / 2);
    const rippleSize = Math.max(tRect.width, tRect.height) * 1.3;

    // 1. Doble onda concéntrica líquida (Ripples)
    for (let i = 0; i < 2; i++) {
      const ripple = document.createElement('div');
      ripple.className = 'tetris-liquid-ripple';
      ripple.style.left = `${centerX - rippleSize / 2}px`;
      ripple.style.top = `${centerY - rippleSize / 2}px`;
      ripple.style.width = `${rippleSize}px`;
      ripple.style.height = `${rippleSize}px`;
      if (i === 1) {
        ripple.style.animationDelay = '80ms';
        ripple.style.borderColor = 'rgba(255, 245, 180, 0.75)';
      }
      document.body.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    }

    // 2. Destello radial difuso
    const flash = document.createElement('div');
    flash.className = 'tetris-impact-flash';
    flash.style.left = `${tRect.left - 16}px`;
    flash.style.top = `${tRect.top - 16}px`;
    flash.style.width = `${tRect.width + 32}px`;
    flash.style.height = `${tRect.height + 32}px`;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 400);

    // 3. Salpicadura de micro-gotas doradas fluidas (splash droplets)
    const dropCount = 8;
    for (let i = 0; i < dropCount; i++) {
      const drop = document.createElement('div');
      drop.className = 'tetris-splash-droplet';
      const size = 5 + Math.random() * 5;
      drop.style.width = `${size}px`;
      drop.style.height = `${size}px`;
      drop.style.left = `${centerX - size / 2}px`;
      drop.style.top = `${centerY - size / 2}px`;
      document.body.appendChild(drop);

      const angle = (Math.PI * 1.08) + (Math.PI * 0.84 * (i / (dropCount - 1)));
      const distance = 35 + Math.random() * 45;
      const destX = Math.cos(angle) * distance;
      const destY = Math.sin(angle) * (distance * 0.75);

      if (typeof drop.animate === 'function') {
        const dAnim = drop.animate([
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: `translate(${destX * 0.6}px, ${destY - 14}px) scale(1.15)`, opacity: 0.95, offset: 0.4 },
          { transform: `translate(${destX}px, ${destY + 18}px) scale(0.4)`, opacity: 0 }
        ], {
          duration: 450 + Math.random() * 80,
          easing: 'cubic-bezier(0.2, 0.8, 0.35, 1)',
          fill: 'forwards'
        });
        dAnim.finished.then(() => drop.remove()).catch(() => drop.remove());
      } else {
        setTimeout(() => drop.remove(), 450);
      }
    }
  }

  async function dropTetrisCard(colIndex, targetEl) {
    if (isDroppingStack) return;
    const floating = typeof document !== 'undefined' ? document.getElementById('tetris-floating-card') : null;
    if (!floating || !targetEl?.getBoundingClientRect) {
      game.chooseStackTarget(colIndex);
      return;
    }
    isDroppingStack = true;
    let clone = null;
    let beam = null;
    try {
      const fRect = floating.getBoundingClientRect();
      const tRect = targetEl.getBoundingClientRect();

      floating.style.opacity = '0';

      if (typeof document !== 'undefined') {
        beam = document.createElement('div');
        beam.className = 'tetris-drop-beam';
        beam.style.left = `${tRect.left - 6}px`;
        beam.style.top = `${fRect.top}px`;
        beam.style.width = `${tRect.width + 12}px`;
        beam.style.height = `${Math.max(10, tRect.bottom - fRect.top)}px`;
        document.body.appendChild(beam);

        clone = floating.cloneNode(true);
        clone.id = '';
        clone.className = 'card card--tetris-falling';
        clone.style.left = `${fRect.left}px`;
        clone.style.top = `${fRect.top}px`;
        clone.style.width = `${fRect.width}px`;
        clone.style.height = `${fRect.height}px`;
        clone.style.margin = '0';
        clone.style.transform = 'none';
        clone.style.transition = 'none';
        clone.style.opacity = '1';
        document.body.appendChild(clone);
      }

      // Sonido de deslizamiento fluido de la gota
      audio?.sfx?.('renew', { rate: 1.6, gain: 0.55, cut: 0.35 });

      const deltaX = (tRect.left + (tRect.width - fRect.width) / 2) - fRect.left;
      const deltaY = tRect.top - fRect.top;

      if (clone && typeof clone.animate === 'function') {
        // Deformación líquida ("Squash & Stretch" con caída aerodinámica)
        const anim = clone.animate([
          { transform: 'translate(0, 0) scale(1, 1)', opacity: 1 },
          { transform: `translate(${deltaX * 0.2}px, ${deltaY * 0.16}px) scale(0.92, 1.12)`, opacity: 1, offset: 0.2 },
          { transform: `translate(${deltaX * 0.7}px, ${deltaY * 0.65}px) scale(0.86, 1.20)`, opacity: 1, offset: 0.65 },
          { transform: `translate(${deltaX}px, ${deltaY}px) scale(1.26, 0.74)`, opacity: 1 }
        ], {
          duration: 340,
          easing: 'cubic-bezier(0.25, 0.1, 0.4, 1)',
          fill: 'forwards'
        });
        await anim.finished.catch(() => {});
      } else {
        await new Promise((r) => setTimeout(r, 260));
      }

      beam?.remove?.();
      clone?.remove?.();

      // Fusión de sonido al impactar: burbuja + impacto táctil + plop líquido
      audio?.sfx?.('freegame');
      spawnLiquidImpactVfx(tRect);

      targetEl.classList?.add?.('card--stack-impact');
      setTimeout(() => targetEl.classList?.remove?.('card--stack-impact'), 560);
      await new Promise((r) => setTimeout(r, 50));
    } finally {
      beam?.remove?.();
      clone?.remove?.();
      try {
        game.chooseStackTarget(colIndex);
      } finally {
        isDroppingStack = false;
      }
    }
  }

  async function playAutoStackAnimation(stackInfo) {
    if (typeof document === 'undefined') return;
    const targetEl = field.querySelector?.(`[data-col="${stackInfo.colIndex}"]`);
    if (!targetEl?.getBoundingClientRect) return;
    const tRect = targetEl.getBoundingClientRect();
    if (!tRect || tRect.width === 0) return;

    let clone = null;
    let beam = null;
    try {
      const startY = Math.max(16, tRect.top - 140);
      const startX = tRect.left;

      beam = document.createElement('div');
      beam.className = 'tetris-drop-beam';
      beam.style.left = `${tRect.left - 6}px`;
      beam.style.top = `${startY}px`;
      beam.style.width = `${tRect.width + 12}px`;
      beam.style.height = `${Math.max(10, tRect.bottom - startY)}px`;
      document.body.appendChild(beam);

      clone = document.createElement('div');
      clone.className = 'card card--tetris-falling';
      const syms = stackInfo.card.symbols.map((s) => symChip(s, true)).join('');
      clone.innerHTML = `<span class="card-no">✨</span>${syms}${powerChip(stackInfo.card)}`;
      clone.style.left = `${startX}px`;
      clone.style.top = `${startY}px`;
      clone.style.width = `${tRect.width}px`;
      clone.style.height = `${tRect.height}px`;
      clone.style.margin = '0';
      clone.style.transform = 'none';
      clone.style.transition = 'none';
      document.body.appendChild(clone);

      audio?.sfx?.('renew', { rate: 1.6, gain: 0.55, cut: 0.35 });

      const deltaY = tRect.top - startY;
      if (typeof clone.animate === 'function') {
        const anim = clone.animate([
          { transform: 'translate(0, 0) scale(0.96, 1)', opacity: 0.95 },
          { transform: `translate(0, ${deltaY * 0.2}px) scale(0.92, 1.12)`, opacity: 1, offset: 0.2 },
          { transform: `translate(0, ${deltaY * 0.65}px) scale(0.86, 1.20)`, opacity: 1, offset: 0.65 },
          { transform: `translate(0, ${deltaY}px) scale(1.26, 0.74)`, opacity: 1 }
        ], {
          duration: 340,
          easing: 'cubic-bezier(0.25, 0.1, 0.4, 1)',
          fill: 'forwards'
        });
        await anim.finished.catch(() => {});
      } else {
        await new Promise((r) => setTimeout(r, 260));
      }

      beam?.remove?.();
      clone?.remove?.();

      audio?.sfx?.('freegame');
      spawnLiquidImpactVfx(tRect);

      targetEl.classList.add('card--stack-impact');
      setTimeout(() => targetEl.classList.remove('card--stack-impact'), 560);
    } catch {
      beam?.remove?.();
      clone?.remove?.();
    }
  }

  field.addEventListener('click', (e) => {
    const target = e.target.closest('[data-stack-col]');
    if (target && !isDroppingStack) {
      const col = Number(target.dataset.stackCol);
      dropTetrisCard(col, target);
      return;
    }
    const floating = e.target.closest('#tetris-floating-card, .tetris-dock');
    if (floating && !isDroppingStack && game.state?.pendingStack) {
      const targets = field.querySelectorAll('[data-stack-col]');
      if (targets.length === 1) {
        dropTetrisCard(0, targets[0]);
      } else if (targets.length > 1) {
        const activeTarget = field.querySelector('[data-stack-col]:hover') || targets[0];
        const col = Number(activeTarget.dataset.stackCol);
        dropTetrisCard(col, activeTarget);
      }
    }
  });

  let lastHoveredCol = null;
  field.addEventListener('mousemove', (e) => {
    if (isDroppingStack) return;
    const target = e.target.closest('[data-stack-col]');
    const col = target?.dataset?.stackCol ?? null;
    if (col !== lastHoveredCol) {
      lastHoveredCol = col;
      if (col !== null && game.state?.pendingStack) {
        audio?.sfx?.('octopus', { rate: 2.2, gain: 0.22, cut: 0.12 });
      }
    }
    updateFloatingCardPosition(target);
  });

  field.addEventListener('mouseleave', () => {
    lastHoveredCol = null;
    if (isDroppingStack) return;
    updateFloatingCardPosition(null);
  });

  field.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const target = e.target.closest('[data-stack-col]');
      if (target && !isDroppingStack) {
        e.preventDefault();
        const col = Number(target.dataset.stackCol);
        dropTetrisCard(col, target);
        return;
      }
      if (game.state?.pendingStack && !isDroppingStack) {
        const targets = field.querySelectorAll('[data-stack-col]');
        if (targets.length === 1) {
          e.preventDefault();
          dropTetrisCard(0, targets[0]);
        }
      }
    }
  });

  // ---- los dos paneles que reemplazaron a la columna del costado ------------
  // Lo que se mira entre rondas —el mazo y el historial— ya no vive apoyado sobre la
  // pelea: se pide, se mira y se cierra. La pantalla es del combate.

  // El mazo se abre tocando un Axie, el suyo. Se repinta antes de abrirlo porque el
  // repintado que corre solo dibuja las cartas únicamente si el panel ya estaba
  // abierto: sin este empujón el primero se abriría vacío.
  const deckModal = $('deck-modal');
  for (const player of PLAYERS) {
    $(`peek-${player}`).addEventListener('click', () => {
      peeking = player;
      if (game.state) {
        $('deck-label').textContent = deckTitle(game.state, player);
        paint($('deck'), deckHtml(game.state, player));
        paint($('deck-sheet'), deckSheetHtml(game.state, player));
      }
      deckModal.showModal();
    });
  }
  // Cerrado vuelve a no ser de nadie, y se vacía en el acto: si no, el panel seguiría
  // repintando cartas que no se están mirando en cada carta que sale, y guardaría el
  // mazo de la partida anterior hasta que alguien lo vuelva a abrir.
  deckModal.addEventListener('close', () => {
    peeking = null;
    paint($('deck-sheet'), '');
  });

  $('log-btn').addEventListener('click', () => $('log-modal').showModal());
  $('rules-btn').addEventListener('click', () => $('rules-modal').showModal());
  $('symbols-btn')?.addEventListener('click', () => {
    const modal = $('symbols-modal');
    if (modal) {
      if (!modal._symInit && modal.addEventListener) {
        modal._symInit = true;
        modal.addEventListener('click', (e) => {
          const btn = e.target.closest?.('[data-sym-filter]');
          if (!btn) return;
          const filter = btn.dataset?.symFilter;
          modal.querySelectorAll?.('[data-sym-filter]')?.forEach?.((b) => b.classList?.toggle('active', b === btn));
          modal.querySelectorAll?.('.symbol-card')?.forEach?.((card) => {
            const match = filter === 'all' || card.dataset?.symClass === filter;
            card.hidden = !match;
          });
        });
      }
      modal.showModal?.();
    }
  });

  const openDemoFromUi = (initialPower = null) => {
    const lvl = game.state?.adventure?.level ?? 1;
    openPowerDemo(lvl, initialPower);
  };
  $('powers-demo-btn')?.addEventListener('click', () => openDemoFromUi());
  $('hud-powers-btn')?.addEventListener('click', () => {
    $('hud-menu')?.setAttribute('hidden', '');
    openDemoFromUi();
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea')) return;
    // Con un panel abierto encima —el mazo, el historial, las reglas o demostración—
    // las teclas son del panel y no de la mesa.
    if (document.querySelector?.('dialog[open]') || document.querySelector?.('.power-demo-overlay') || activePowerDemo) return;
    const state = game.state;
    if (e.key === 'r' || e.key === 'R') {
      if (state.pendingStack) {
        const targets = field.querySelectorAll('[data-stack-col]');
        if (targets.length === 1 && !isDroppingStack) {
          dropTetrisCard(0, targets[0]);
          return;
        }
      }
      if (state.tutorial && state.tutorialAllowed && state.tutorialAllowed !== 'hit' && state.tutorialAllowed !== 'any') return;
      game.hit();
    }
    if (e.key === 'p' || e.key === 'P') {
      if (state.tutorial && state.tutorialAllowed && state.tutorialAllowed !== 'stand' && state.tutorialAllowed !== 'any') return;
      game.stand();
    }
    if (e.key === 'Enter') {
      // La ronda ya viene sola; Enter solo se saltea la pausa del cartel.
      if (state.phase === 'roundEnd') game.nextRound();
      // Terminada por abandono no hay otra igual: enfrente no queda nadie.
      else if (state.phase === 'matchEnd' && !state.forfeit) {
        if (state.mode === 'adventure' && wonMatch(state) && (state.adventure?.level ?? 1) < 6) {
          restart({ mode: 'adventure', adventureLevel: (state.adventure?.level ?? 1) + 1 });
        } else {
          restart();
        }
      }
    }
  });

  if (typeof window !== 'undefined') {
    window.addEventListener?.('resize', () => game.refresh?.());
    window.addEventListener?.('orientationchange', () => game.refresh?.());
  }

  // La partida en red ya está andando cuando esta pantalla se engancha: la arrancó el
  // servidor al juntarse los dos, y arrancar otra acá sería pisarla. Con la portada
  // puesta tampoco se arranca nada: la mesa queda vacía atrás hasta que alguien elija
  // contra quién juega.
  if (!netPlay && start) restart();

  return { restart, _game: game, openPowerDemo };
}
