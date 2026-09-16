import { tr, currentLang, setLang } from './i18n.js';
import { SYMBOLS, POWERS, cardLabel, crest, iconUrl, powerIcon, powersOf } from './data.js';
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
import { markLevelCompleted, isFinalLevel, nextLevelId } from './adventure.js';

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
  if (mySeat) return player === mySeat ? `${tr('Vos')} · ` : `${seatVoice(state, player).name} · `;
  return seatVoice(state, player).you ? '' : `${seatVoice(state, player).name} · `;
}

// El símbolo va escrito en el casillero y no solo pintado: el recorrido de la cadena
// necesita encontrar el eslabón de cada racha carta por carta (ver `traceChain`).
function symChip(symbol, on) {
  return `<span class="sym" data-sym="${symbol}" data-on="${on}" style="--c:${SYMBOLS[symbol].color}">
    ${crest(symbol)}</span>`;
}

/**
 * El poder de una carta, colgado abajo y separado por una línea: la cadena no lo
 * mira, así que tampoco se lee como un eslabón más.
 */
function powerChip(card) {
  const powers = powersOf(card);
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
  const targetAttr = isStackTarget ? ` data-stack-col="${index}" role="button" tabindex="0" title="${tr('Alargar columna {n}', { n: index + 1 })}"` : '';
  const dropHint = isStackTarget ? '<span class="card-stack-drop-hint" aria-hidden="true">↓</span>' : '';
  return `<div class="${cls}" data-col="${index}"${targetAttr}>${dropHint}${syms}${powerChip(card)}</div>`;
}

function bustCardHtml(card) {
  const cls = settled.has(card.uid) ? 'card card--bust is-settled' : 'card card--bust';
  settled.add(card.uid);
  const syms = card.symbols.map((s) => symChip(s, false)).join('');
  return `<div class="card-gap"></div><div class="${cls}">${syms}${powerChip(card)}</div>`;
}

// `chooser` es quién elige la columna cuando no es esta pantalla: en red, el rival ve
// la carta esperando pero no la puede mover.
function pendingStackHtml(card, zoomAttr = '', chooser = null) {
  const syms = card.symbols.map((s) => symChip(s, true)).join('');
  const badge = chooser
    ? tr('Free Game — {name} elige la columna', { name: chooser })
    : tr('Free Game — Elegí qué columna colocar');
  return `
    <div class="tetris-dock"${zoomAttr} id="tetris-dock" aria-label="${tr('Carta de Free Game para colocar')}">
      <div class="tetris-badge">
        <i>✨</i>
        <span>${badge}</span>
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
  if (chain.cards.length === 0) return `<span class="runs-empty">${tr('sin cartas')}</span>`;
  if (chain.busted) {
    return `<span class="runs-zero">${
      chain.timeout
        ? tr('Se acabó el tiempo · el ataque falla')
        : tr('Cadena cortada · el ataque falla')}</span>`;
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
      tr('{name}: {dmg} de daño acumulado al romperse (escudo: {shield})', {
        name: POWERS.egg.name,
        dmg: breakDmg,
        shield: st.egg,
      })));
  }
  if (st.poison) {
    chips.push(pip('poison', st.poison,
      tr('{name}: {poison} de daño al finalizar su turno, después se parte al medio', {
        name: POWERS.poison.name,
        poison: st.poison,
      })));
  }
  if (st.weak) {
    chips.push(pip('weak', st.weak, st.weak === 1
      ? tr('Debilitado: su próximo ataque pega la mitad')
      : tr('Debilitado: sus próximos {weak} ataques pegan la mitad', { weak: st.weak })));
  }
  if (st.strength) {
    chips.push(pip('strength', `+${st.strength}`,
      tr('{name}: +{strength} de daño en cada ataque', {
        name: POWERS.strength.name,
        strength: st.strength,
      })));
  }
  if (st.stacked) {
    chips.push(pipIcon(POWERS.octopus.icon, st.stacked,
      st.stacked === 1
        ? tr('{name}: +1 carta extra para tu mazo al cerrar el turno', { name: POWERS.octopus.name })
        : tr('{name}: +{count} cartas extra para tu mazo al cerrar el turno', {
            name: POWERS.octopus.name,
            count: st.stacked,
          })));
  }
  if (st.bubbles) {
    chips.push(pipIcon(POWERS.bubble.icon, st.bubbles,
      st.bubbles === 1
        ? tr('{name}: la carta que elijas del centro abrirá tu próxima ronda', { name: POWERS.bubble.name })
        : tr('{name}: {bubbles} cartas apiladas abrirán tu próxima ronda como carta gigante', {
            name: POWERS.bubble.name,
            bubbles: st.bubbles,
          })));
  }
  if (state.bubbleCard?.[player]) {
    chips.push(pipIcon(POWERS.bubble.icon, '🫧',
      tr('{name}: apertura lista para la próxima ronda', { name: POWERS.bubble.name })));
  }
  if (st.leaf > 0) {
    const heal = st.leaf * TUNING.leafHeal;
    chips.push(pip('leaf', st.leaf,
      st.leaf === 1
        ? tr('{name}: 1 hoja (cura +{heal} al final de tu turno y consume 1)', { name: POWERS.leaf.name, heal })
        : tr('{name}: {leaf} hojas (cura +{heal} al final de tu turno y consume 1)', {
            name: POWERS.leaf.name,
            leaf: st.leaf,
            heal,
          })));
  }
  if (st.steelskin) {
    chips.push(pipIcon(POWERS.steelskin.icon, `≤${st.steelskin}`,
      tr('{name}: limita el próximo ataque rival a máximo {cap} de daño', {
        name: POWERS.steelskin.name,
        cap: st.steelskin,
      })));
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
    tag = `<span class="plate-tag" data-kind="bust">${tr('falló')}</span>`;
  } else if (dealt) {
    tag = `<span class="plate-tag" data-kind="hit">${tr('{dealt} de daño', { dealt })}</span>`;
  }

  const shieldBadge = shield > 0
    ? `<span class="plate-shield" title="${tr('Escudo: aguanta {shield} de daño', { shield })}"><img src="${iconUrl('shield.png')}" alt="" class="shield-icon"><b>${shield}</b></span>`
    : '';

  return `
    <span class="plate-top" style="--c:${SYMBOLS[own.class].color}">
      ${crest(own.class, 'sm')}<span class="plate-name">${own.name}</span>
      <span class="plate-who">${
        player === mySeat ? tr('Vos') : seatVoice(state, player).short}</span>${tag}
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
    mods.push(tr('{raw} de cadena', { raw }));
    if (st.strength) mods.push(tr('+{str} de fuerza', { str: st.strength }));
    if (st.weak) mods.push(tr('partido al medio por el caracol'));
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
  // sale su tamaño. Abajo los dos miden lo mismo —la rueda— y la palabra hace de pie. El
  // cuerpo de la letra sale de cuántas tiene la palabra en el idioma de la pantalla (ver
  // `.swing-cap` en el CSS): "DAMAGE" no entra en el ancho de "DAÑO".
  const cap = tr('DAÑO');
  return `
    <span class="swing-dmg"${grew ? ' data-up="true"' : ''} data-busted="${
      chain.busted}"${size}>${points}</span>
    <span class="swing-cap" style="--cap-chars:${cap.length}">${cap}</span>
    ${breakdown}`;
}

// `fit` es lo que la pantalla le pide achicar de más para que la mesa entre en el alto
// que tiene (ver `fitField` en `mount`): acá no se sabe cuánto mide la ventana.
function fieldHtml(state, player, fit = 1) {
  const chain = state.chains[player];
  const isStackTarget = Boolean(state.pendingStack && state.pendingStack.player === player);
  // La columna la elige solo el dueño de la carta: en la pantalla del rival no hay
  // columnas que tocar.
  const placing = isStackTarget && isMine(player);
  const cards = chain.cards.map((c, i) => {
    const colAllowed = !state.tutorial || state.tutorialAllowedCol == null || state.tutorialAllowedCol === i;
    return cardHtml(chain, c, i, placing && colAllowed);
  }).join('');
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
  zoom = Math.round(zoom * fit * 100) / 100;

  const zoomAttr = zoom < 1 ? ` style="--zoom:${zoom}"` : '';
  const pending = isStackTarget
    ? pendingStackHtml(state.pendingStack.card, zoomAttr, placing ? null : seatVoice(state, player).name)
    : '';

  return `
    ${pending}
    <div class="strip"${zoomAttr}>${cards}${bust}</div>
    <div class="runs"${zoomAttr}>${runsHtml(chain)}</div>`;
}

// Arriba solo queda dónde estamos parados: la vida se lee sobre cada Axie y las cartas
// que quedan en la reserva no las lee nadie —no se cuentan cartas, se apuesta contra el
// azar—, así que el marcador es una palabra y un número.
function scoreboardHtml(state) {
  return `<span class="sb-round">${tr('Ronda {round}', { round: state.round })}</span>`;
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
  const label = card.symbols.map((s) => SYMBOLS[s].name).join(tr(' y '))
    + (card.power ? tr(', con {power}', { power: POWERS[card.power].name }) : '');
  return `<button class="${cls}" data-uid="${card.uid}"${pickable ? '' : ' disabled'}
    data-power="${card.power ?? ''}" data-syms="${card.symbols.join(' ')}"
    aria-label="${label}">${syms}${powerChip(card)}</button>`;
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
      ? tr('La CPU cobra su carta del {icon}…', { icon: powerIcon('octopus', 'sm') })
      : tr('La CPU está eligiendo…');
    head = `<span class="overlay-title">${tr('El centro')}</span><p class="overlay-note">${note}</p>`;
  } else if (!isMine(picking)) {
    // En red, el centro del rival se mira pero no se toca: sin botones, y el cartel
    // habla de él y no de vos.
    head = `<span class="overlay-title">${tr('El centro')}</span>` +
      `<p class="overlay-note">${tr('{at}está eligiendo del centro…', { at: addressing(state, picking) })}</p>`;
  } else if (bonus) {
    // La etapa del pulpo tiene su propio cartel: es una carta de más y sin reglas, y
    // si se lee como parte del reparto normal el jugador cree que está gastando su
    // elección. El título cambia entero, no solo la bajada.
    const note = bonus === 1
      ? tr('Una carta <b>de más</b>, la que quieras. Abre tu próxima ronda.')
      : tr('<b>{bonus} cartas de más</b>, las que quieras. Abren tu próxima ronda, en el orden que las toques.', { bonus });
    head = `<span class="overlay-title">${addressing(state, picking)}` +
      `${powerIcon('octopus', 'sm')} ${tr('Carta del pulpo')}</span>` +
      `<p class="overlay-note">${note}</p>`;
    actions = `<div class="overlay-actions">
      <button class="btn" data-action="skip"
        title="${tr('Perdés la carta que te debe el pulpo')}">${tr('No agarrar')}</button></div>`;
  } else {
    // No se pregunta el modo: la carta que toques ya dice qué te llevás.
    let note;
    if (state.chains[picking].busted) {
      note = tr('Se te cortó la cadena: llevate <b>una carta sin poder</b>.');
    } else if (!mode) {
      note = tr('Llevate <b>una con poder</b> (y listo) <b>o dos sin poder</b>.');
    } else {
      note = remaining === 1
        ? tr('Vas por cartas sin poder: te queda 1.')
        : tr('Vas por cartas sin poder: te quedan {remaining}.', { remaining });
    }
    head = `<span class="overlay-title">${addressing(state, picking)}${tr('Elegí del centro')}</span>` +
      `<p class="overlay-note">${note}</p>`;
    // Nada de lo que podés llevarte lleva tu símbolo: te queda una renovación del centro.
    const renew = (canRenew && !(state.tutorial && !state.tutorialAllowRenew))
      ? `<button class="btn" data-action="renew"
          title="${tr('Ninguna carta que podés llevarte tiene tu símbolo')}">${tr('Renovar el centro ⟳')}</button>`
      : '';
    const skipDisabled = (state.tutorial && state.tutorialDisallowSkip) ? 'disabled style="opacity:0.3;pointer-events:none;"' : '';
    const skipLabel = state.draft.took ? tr('No agarrar más') : tr('No agarrar');
    actions = `<div class="overlay-actions">${renew}
      <button class="btn" data-action="skip" ${skipDisabled}
        title="${tr('Cerrá el reparto sin sumar cartas al mazo')}">${skipLabel}</button></div>`;
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
  return `<div class="overlay-panel o-panel">
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

/**
 * El renglón del pie. Casi siempre es gris y calla; la única vez que levanta la voz es
 * la última chance, y ahí va en fuego, el mismo naranja que en ese momento tiene el
 * bicho prendido alrededor (ver `rage` y `.controls-msg[data-tone="fury"]`). Es el
 * único turno de la partida en el que seguir significa otra cosa —ya no se juega por
 * ganar sino por empatar—, así que se dice con el color y no solo con la frase.
 */
const say = (msg, fury = false) =>
  `<span class="controls-msg"${fury ? ' data-tone="fury"' : ''}>${msg}</span>`;

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
      ? (isFinalLevel(state.adventure?.level)
        ? tr('¡Aventura Completada!')
        : tr('¡{name} Superado!', { name: state.adventure?.name ?? tr('Nivel') }))
      : tr('Derrota en la Aventura');
  } else if (state.mode === 'tutorial') {
    text = tr('¡TUTORIAL COMPLETADO!');
  } else {
    text = won ? tr('¡Victoria!') : voided ? tr('Partida anulada') : tr('La suerte no estuvo de tu lado…');
  }
  const gone = state.forfeit && seatVoice(state, state.forfeit.by).name;
  const note = !gone ? ''
    : voided
      ? tr('{gone} abandonó en las primeras {rounds} rondas: no gana nadie.', { gone, rounds: FORFEIT_ROUNDS })
      : tr('{gone} abandonó la partida.', { gone });
  return `<strong class="finale-text">${text}</strong>` +
    (note ? `<span class="finale-note">${note}</span>` : '') +
    (won ? confettiHtml() : '');
}

/** En el tutorial solo vale la acción que habilita el guión ('any' las habilita todas). */
const gated = (state, action) => Boolean(state?.tutorial && state.tutorialAllowed
  && state.tutorialAllowed !== action && state.tutorialAllowed !== 'any');

function controlsHtml(state, { picking, acting }) {
  // El centro ya lo dice todo: su propio cartel abre con quién elige y con qué
  // llevarse (ver `marketHtml`). Repetirlo acá abajo era el mismo dato dos veces
  // en la misma pantalla, uno leído y el otro ignorado.
  if (state.phase === 'draft') return pie('');

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
      return pie('', `<button class="btn btn-primary" data-action="leave">${tr('Volver a las salas')}</button>`);
    }
    // El tutorial termina en una puerta hacia el juego de verdad, no en una revancha.
    if (state.mode === 'tutorial') {
      return pie(
        '',
        `<button class="btn btn-primary" data-action="adv-map">${tr('Ir a modo Aventura')}</button>` +
        `<button class="btn" data-action="menu">${tr('Menú principal')}</button>`,
      );
    }
    if (state.mode === 'adventure') {
      const won = wonMatch(state);
      const isLastLevel = isFinalLevel(state.adventure?.level);
      if (won) {
        return pie(
          '',
          (!isLastLevel
            ? `<button class="btn btn-primary" data-action="adv-next">${tr('Siguiente Nivel')}</button>`
            : `<button class="btn btn-primary" data-action="adv-map">${tr('Ver Aventura')}</button>`) +
          `<button class="btn" data-action="adv-map">${tr('Aventura')}</button>` +
          `<button class="btn" data-action="menu">${tr('Menú principal')}</button>`,
        );
      }
      return pie(
        '',
        `<button class="btn btn-primary" data-action="restart">${tr('Reintentar Nivel')}</button>` +
        `<button class="btn" data-action="adv-map">${tr('Aventura')}</button>` +
        `<button class="btn" data-action="menu">${tr('Menú principal')}</button>`,
      );
    }
    return pie(
      '',
      `<button class="btn btn-primary" data-action="restart">${tr('Jugar de nuevo')}</button>` +
      (netPlay ? '' : `<button class="btn" data-action="menu">${tr('Menú principal')}</button>`),
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
    const msg = !state.turn ? tr('Repartiendo…')
      : !acting && dying === state.turn ? tr('Última chance de la CPU: si te deja sin vida, empatan.')
      : !acting ? tr('La CPU está cargando su ataque…')
      : dying === acting
        ? tr('{at}última chance: si te deja sin vida, empatan.', { at: addressing(state, acting) })
        : tr('{at}está cargando su ataque…', { at: addressing(state, acting) });
    return pie(say(msg, Boolean(state.turn) && dying === (acting ?? state.turn)));
  }

  const off = (action) => (state.busy || gated(state, action) ? 'disabled' : '');
  const lit = (action) => (state.tutorial && state.tutorialAllowed === action ? ' tuto-allowed' : '');
  const acts = `<button class="btn btn-danger${lit('hit')}" data-action="hit" ${off('hit')}>${tr('Robar carta')}</button>
     <button class="btn btn-primary${lit('stand')}" data-action="stand" ${off('stand')}>${tr('Atacar')}</button>`;

  if (state.pendingStack && state.pendingStack.player === acting) {
    const card = state.pendingStack.card;
    return pie(
      say(tr('✨ Free Game: elegí la columna donde colocar {card}', { card: cardLabel(card) })),
      acts,
    );
  }

  if (state.freeGame?.[acting]) {
    return pie(
      say(tr('✨ Free Game activo: robando carta automáticamente…')),
      acts,
    );
  }

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
    ? tr('{at}última chance: si dejás sin vida al otro, empatan.', { at })
    : at && !mySeat ? tr('Le toca a {name}.', { name: seatVoice(state, acting).name })
    : '';
  // Los dos botones van juntos en su propia caja y no sueltos al pie, y el cartel
  // queda arriba de ellos. Son la única cosa que se aprieta en toda la partida: tienen
  // que estar donde el pulgar los busca —en el medio, uno al lado del otro y del mismo
  // tamaño—, y no arrinconados contra el borde derecho con el cartel tirando del otro
  // lado. Que midan lo mismo lo hace la caja (ver `.controls-acts` en el CSS), no el
  // largo de lo que dice cada uno: "Atacar" es una palabra y "Robar carta" son dos, y
  // aun así ninguno de los dos es el botón grande.
  return pie(say(msg, dying === acting), acts);
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
 * Existe mientras haya alguien decidiendo, propio o rival: la cadena viva ya está
 * a la vista entera, así que la chance de que la próxima carta la siga no es
 * información escondida de nadie.
 */
function oddsHtml(state, player, pool) {
  if (!player) return '';

  const { p } = survivalOdds(state.chains[player], pool);
  const pct = Math.round(p * 100);
  const risk = pct >= 65 ? 'low' : pct >= 40 ? 'mid' : 'high';

  // El aro se dibuja con `--p`; el texto del lector de pantalla va aparte porque
  // "72 %" suelto no dice nada.
  return `
    <div class="odds-dial" data-risk="${risk}" style="--p:${pct}" aria-hidden="true">
      <b class="odds-pct">${pct}<i>%</i></b>
    </div>
    <span class="sr-only">${tr('La próxima carta continúa la cadena: {pct}%.', { pct })}</span>`;
}

/**
 * Los dos números del mazo, en un renglón: lo que juntó y lo que todavía no salió esta
 * ronda. Van arriba del panel que se abre tocando un Axie.
 */
function deckHtml(state, player) {
  const owned = ownedBy(state, player);
  const unseen = state.decks[player].length;
  const ownedLabel = owned === 1 ? tr('1 carta') : tr('{n} cartas', { n: owned });
  const unseenLabel = unseen === 1 ? tr('1 sin salir') : tr('{n} sin salir', { n: unseen });
  return `<span>${ownedLabel}</span>
    <span>${unseenLabel}</span>`;
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
  return player === you ? tr('Tu mazo') : tr('Mazo {of}', { of: seatVoice(state, player).of });
}

/** Los símbolos de una carta y su poder, en texto plano: es un `title`, no un cartel. */
function cardTitle(card) {
  const syms = card.symbols.map((sym) => SYMBOLS[sym].name).join(' · ');
  const powers = powersOf(card);
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
  return sheet(tr('Mazo inicial · {count} cartas', { count: state.start[player].length }), state.start[player])
    + (added.length
      ? sheet(tr('Sumadas del centro · {count}', { count: added.length }), added)
      : `<p class="sheet-label">${tr('Sumadas del centro')}</p>
         <p class="sheet-empty">${tr('Todavía ninguna: las cartas del centro se ganan atacando.')}</p>`);
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
 * Cuánto espera la furia después de que el golpe cae, en ms.
 *
 * Es lo que tarda en irse el número del daño (ver `dmg-float`), y ni un milisegundo
 * menos: los dos salen en el mismo lugar —arriba de la cabeza del que recibió— y
 * encimados no se lee ninguno de los dos. Y además es el orden en que pasan las cosas:
 * primero el golpe que lo dejó sin vida, después el bicho que se niega a caerse.
 */
const FURY_BEAT = 900;

/**
 * La furia: el instante en que a un Axie lo dejan sin vida y le queda un golpe.
 *
 * Hasta acá la última chance era un halo dorado que se prendía atrás del bicho, y el
 * turno más raro de la partida entraba sin que nadie levantara la voz. Es al revés de
 * lo que está pasando: a ese bicho lo acaban de matar y sigue de pie: lo que le queda
 * no es un turno más, es el último, y con él solo puede empatar.
 *
 * Así que entra en furia, y entra en tres cosas que caen juntas porque son una sola:
 * el gruñido —`snarl`, el clip del kit en que el bicho enseña los dientes—, el anillo
 * de fuego que se le abre a los pies, y el aviso en naranja sobre la cabeza. Lo que
 * queda después del estallido es el estado: el fuego prendido alrededor mientras dure
 * el turno regalado, y el bicho al rojo (ver `.fighter[data-last-chance="true"]`).
 *
 * `wait` es lo que falta para que caiga el golpe que lo dejó así. La furia no se puede
 * adelantar al impacto: quien la enciende es el golpe, y salida antes se lee como un
 * bicho que se enojó solo.
 *
 * `still` es si cuando por fin le toca rugir el bicho sigue en su última chance. Entre
 * el golpe y el rugido hay un segundo y medio, y en un segundo y medio se puede haber
 * terminado la partida —el otro abandonó, se cortó el cable—: un muñeco tirado en el
 * piso rugiendo sobre el cartel del final no es una furia, es un error.
 */
function rage(el, motion, audio, wait, still) {
  if (!el?.insertAdjacentHTML) return;
  setTimeout(() => {
    if (!still()) return;
    motion?.pulse?.('snarl');
    pulse(el, 'fury', 'in', 900);
    el.insertAdjacentHTML('beforeend', '<span class="fury-ring"></span>');
    const ring = el.querySelector('.fury-ring:last-child');
    ring?.addEventListener('animationend', () => ring.remove());
    floatTag(el, 'fury', tr('¡ÚLTIMA CHANCE!'));
    // El golpe de poder del amuleto de fuerza, pedido una cuarta abajo: grave, y ya
    // está en la biblioteca. No hay un rugido propio, y bajar uno nuevo del CDN es un
    // pedido más por un instante que pasa una vez cada varias partidas.
    audio?.sfx?.('strength', { rate: 0.72, gain: 0.95 });
  }, wait);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Cómo se reparte el compás que hay entre soltar el ataque y el golpe (ver `aimMs` en
 * `game.js`): un respiro para que se entienda que empezó otra cosa, el recorrido en sí,
 * y lo que queda para que la última racha se quede un instante encendida antes de que
 * salga el zarpazo.
 */
const TRACE_LEAD = 0.16;
const TRACE_TRAVEL = 0.68;

/** El punto de un eslabón, en coordenadas de la capa que dibuja las cadenas. */
function chipPoint(chip, box) {
  const r = chip.getBoundingClientRect?.();
  if (!r?.width) return null;
  return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top, w: r.width, chip };
}

/**
 * Las rachas de la cadena convertidas en recorridos: uno por símbolo, con sus puntos
 * en la pantalla y el momento en que la línea llega a cada uno.
 *
 * Una racha llega hasta donde llegó y ni un casillero más — `run.cards` es exactamente
 * la carta donde se quedó, y de ahí sale que la línea se corte sola cuando la carta
 * siguiente no trajo ese símbolo. Los pasos van por **carta** y no por punto, así todas
 * las líneas avanzan juntas: las que siguen vivas cruzan a la carta que entra en el
 * mismo instante, y la que se murió ya se quedó quieta.
 *
 * Una carta mejorada trae el símbolo dos veces y la racha avanza de a dos: los dos
 * eslabones son dos puntos, y la línea los une adentro de la carta antes de cruzar.
 */
function traceLanes(chain, cards, box, lead, seg) {
  const lanes = [];
  for (const run of chain.runs) {
    const points = [];
    const times = [];
    for (let col = 0; col < run.cards && col < cards.length; col++) {
      const chips = [...(cards[col].querySelectorAll?.(`.sym[data-sym="${run.symbol}"]`) ?? [])];
      chips.forEach((chip, j) => {
        const point = chipPoint(chip, box);
        if (!point) return;
        points.push(point);
        times.push(lead + col * seg + (j / Math.max(chips.length, 1)) * seg * 0.5);
      });
    }
    if (points.length === 0) continue;
    // Lo que mide cada tramo, acumulado: con eso la línea se descubre a la velocidad
    // que marcan los tiempos sin tener que medir el `<path>` después de escribirlo.
    const cum = [0];
    for (let i = 1; i < points.length; i++) {
      const [a, b] = [points[i - 1], points[i]];
      cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    lanes.push({
      symbol: run.symbol,
      color: SYMBOLS[run.symbol]?.color ?? '#fff',
      points, times, cum, total: cum[cum.length - 1],
    });
  }
  return lanes;
}

/**
 * El recorrido de la cadena, que es lo que se ve al soltar el ataque y antes del golpe.
 *
 * Una línea por símbolo, cada una del color de su clase, saliendo de la primera carta
 * —la que abre las rachas y la única que puntúa— y uniendo los eslabones carta por
 * carta. Es la fórmula del daño dibujada: lo que el jugador venía sumando de a una
 * carta se recorre entero de un saque, y recién cuando termina sale el golpe.
 *
 * Vive fuera del repintado, en su propia capa: la mesa se rehace en cada estado y unas
 * líneas escritas adentro se borrarían en el medio del recorrido.
 *
 * Es decorado, como los efectos del kit: si no hay SVG, si la mesa no está medida o si
 * el sistema pide menos movimiento, la pausa igual sucede —la manda el motor— y el
 * golpe sale igual.
 */
function traceChain(svg, field, audio, chain, ms) {
  if (!svg || !document.createElementNS || !svg.getBoundingClientRect) return;
  svg.innerHTML = '';
  const box = svg.getBoundingClientRect();
  const cards = [...(field.querySelectorAll?.('.strip > .card[data-col]') ?? [])];
  if (!box.width || cards.length === 0) return;

  // Primero se quedan quietas. La fila se corre sola cuando entra una carta (ver
  // `glideCards`), y ese pase dura lo suyo: si el ataque sale mientras la fila todavía
  // se está acomodando —que es lo que pasa cuando se aprieta Atacar apenas cae la
  // última carta—, los eslabones se miden donde estaban y las líneas quedan dibujadas
  // al lado de las cartas. Se las lleva al final de su pase y recién ahí se mide.
  for (const el of cards) {
    for (const anim of el.getAnimations?.() ?? []) {
      try { anim.finish(); } catch { /* una animación sin fin no se puede terminar */ }
    }
  }

  const lead = ms * TRACE_LEAD;
  const seg = (ms * TRACE_TRAVEL) / Math.max(1, chain.cards.length - 1);
  const lanes = traceLanes(chain, cards, box, lead, seg);
  if (lanes.length === 0) return;

  // El grosor sale del eslabón y no de un número fijo: la mesa se achica sola cuando la
  // cadena se hace larga (ver `--zoom`), y una línea clavada en píxeles quedaría
  // tapando las cartas justo cuando hay más para mirar.
  const unit = lanes[0].points[0].w;
  svg.style.setProperty('--trace-w', `${Math.max(2, unit * 0.09)}px`);
  const headR = Math.max(3, unit * 0.16);

  for (const lane of lanes) {
    lane.line = svg.appendChild(document.createElementNS(SVG_NS, 'path'));
    lane.line.setAttribute('class', 'chainfx-line');
    lane.line.setAttribute('d', lane.points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' '));
    // El color va dos veces a propósito: el trazo lo usa para pintarse y el `filter`
    // del CSS lo lee como `currentColor` para el resplandor, que sale de `color`.
    lane.line.style.stroke = lane.color;
    lane.line.style.color = lane.color;
    lane.line.style.strokeDasharray = `${lane.total} ${lane.total}`;
    lane.line.style.strokeDashoffset = `${lane.total}`;
    lane.head = svg.appendChild(document.createElementNS(SVG_NS, 'circle'));
    lane.head.setAttribute('class', 'chainfx-head');
    lane.head.setAttribute('r', String(headR));
    lane.head.style.fill = lane.color;
    lane.head.style.color = lane.color;
    lane.lit = 0;
  }

  /** Enciende el eslabón al que la línea acaba de llegar. */
  const light = (lane, i) => {
    while (lane.lit <= i) {
      const chip = lane.points[lane.lit]?.chip;
      if (chip?.dataset) chip.dataset.linked = 'true';
      lane.lit++;
    }
  };

  // Un tic por carta, subiendo de tono con la cadena: es el mismo número que se venía
  // sumando, contado de nuevo y de corrido.
  for (let col = 0; col < chain.cards.length; col++) {
    audio?.sfx?.('take', { delay: lead + col * seg, rate: Math.min(1 + 0.07 * col, 1.6), gain: 0.35 });
  }

  const quiet = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (quiet || !globalThis.requestAnimationFrame) {
    // Sin movimiento la cadena se muestra entera y quieta: lo que cuenta es qué se
    // enganchó con qué, y eso se lee igual sin que nada se mueva.
    for (const lane of lanes) {
      lane.line.style.strokeDashoffset = '0';
      lane.head.remove?.();
      light(lane, lane.points.length - 1);
    }
    setTimeout(() => { svg.innerHTML = ''; }, ms);
    return;
  }

  const started = performance.now();
  // La cadena no se apaga con el golpe: se queda encendida mientras el que pegó toma
  // carrera y se va mientras el zarpazo cruza, así el ataque se lee como su remate.
  const fadeFor = 420;
  const step = () => {
    const t = performance.now() - started;
    for (const lane of lanes) {
      let i = 0;
      while (i < lane.times.length - 1 && t >= lane.times[i + 1]) i++;
      const [t0, t1] = [lane.times[i], lane.times[i + 1]];
      const k = t1 === undefined ? 1 : Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
      const at = lane.cum[i] + (t1 === undefined ? 0 : (lane.cum[i + 1] - lane.cum[i]) * k);
      lane.line.style.strokeDashoffset = `${Math.max(0, lane.total - at)}`;
      const [a, b] = [lane.points[i], lane.points[i + 1] ?? lane.points[i]];
      lane.head.setAttribute('cx', String(a.x + (b.x - a.x) * k));
      lane.head.setAttribute('cy', String(a.y + (b.y - a.y) * k));
      lane.head.style.opacity = t < lead || t >= lane.times[lane.times.length - 1] ? '0' : '1';
      if (t >= t0) light(lane, i);
    }
    if (t >= ms) svg.style.opacity = String(Math.max(0, 1 - (t - ms) / fadeFor));
    if (t < ms + fadeFor) requestAnimationFrame(step);
    else {
      svg.innerHTML = '';
      svg.style.opacity = '';
    }
  };
  requestAnimationFrame(step);
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
 * Devuelve cuándo cae el golpe, en ms desde ahora. Eso lo sabe solo esta función —el
 * efecto de cada clase conecta en su propio momento— y afuera hace falta para colgar
 * de ese mismo instante lo que venga después (ver `rage`).
 *
 * Vive fuera del render normal porque es un pulso, no un estado: la pantalla se
 * repinta entera a cada carta y una animación puesta en el HTML se cortaría a la
 * mitad. El `<span>` del número se saca solo al terminar, así no se apilan.
 */
function playHit(vfx, audio, arena, portraits, motions, hit, klass) {
  const el = portraits[hit.target];
  if (!el) return 0;

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
  if (hit.kind === 'bust') return 0;

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
      `<span class="dmg-label">${powerIcon('egg', 'sm')} ${tr('{name} roto', { name: POWERS.egg.name })}</span>−${hit.amount}`);
    return 0;
  }

  if (hit.kind === 'feather') {
    audio.sfx('thorns');
    pulse(el, 'react', 'hit', 900);
    motions[hit.target].pulse('hurt');
    pulse(arena, 'shake', shakeOf(hit.amount) || 'soft', 500);
    floatTag(el, 'feather',
      `<span class="dmg-label">${powerIcon('feather', 'sm')} ${POWERS.feather.name}</span>−${hit.amount}`);
    return 0;
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
      floatTag(el, 'egg', `${powerIcon('egg', 'sm')} ${hit.broke ? tr('¡se rompe!') : `−${hit.blocked}`}`);
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
    if (miss) floatTag(el, 'whiff', tr('fallo'));
    else if (hit.amount > 0) floatTag(el, 'hit', `−${hit.amount}`);
  }, impact);

  return impact;
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
/** Abre la enciclopedia de símbolos. Los filtros por clase se enganchan la primera vez. */
export function openSymbols() {
  const modal = $('symbols-modal');
  if (!modal) return;
  if (!modal._symInit && modal.addEventListener) {
    modal._symInit = true;
    modal.addEventListener('click', (e) => {
      const btn = e.target.closest?.('[data-sym-filter]');
      if (!btn) return;
      const filter = btn.dataset?.symFilter;
      modal.querySelectorAll?.('[data-sym-filter]')?.forEach?.((b) => b.classList?.toggle('active', b === btn));
      modal.querySelectorAll?.('.symbol-card')?.forEach?.((card) => {
        card.hidden = !(filter === 'all' || card.dataset?.symClass === filter);
      });
    });
  }
  modal.showModal?.();
}

/** Sincroniza el botón alternador de idioma en el panel de configuración. */
export function syncLangBtn() {
  const btn = $('lang-btn');
  if (!btn) return;
  const isEn = currentLang?.() === 'en';
  const label = btn.querySelector?.('.hud-lang-label') ?? btn;
  label.textContent = isEn ? 'English' : 'Español';
  const titleText = isEn ? 'Switch to Spanish' : tr('Cambiar a inglés');
  btn.setAttribute('aria-label', titleText);
  btn.setAttribute('title', titleText);
}
export const syncLangPills = syncLangBtn;

/** Alterna entre español e inglés y recarga la interfaz. */
export function toggleLang() {
  const next = currentLang?.() === 'es' ? 'en' : 'es';
  setLang(next);
  if (typeof location?.reload === 'function') location.reload();
}

/** Abre o cierra el menú de opciones/sonido tanto en el combate como en la portada. */
export function openHud(on) {
  const hud = $('hud-menu');
  const hudBtn = $('hud-btn');
  const lobbyBtn = $('lobby-settings-btn');
  if (!hud) return;
  const show = on !== undefined ? Boolean(on) : hud.hidden;
  hud.hidden = !show;
  hudBtn?.setAttribute('aria-expanded', String(show));
  lobbyBtn?.setAttribute('aria-expanded', String(show));
  if (show) {
    syncLangBtn();
    const btn = $('lang-btn');
    if (btn && !btn._boundToggle) {
      btn._boundToggle = true;
      btn.addEventListener('click', (e) => {
        e.stopPropagation?.();
        toggleLang();
      });
    }
    const inLobby = !$('lobby')?.hidden;
    const logBtn = $('log-btn');
    if (logBtn && inLobby) logBtn.hidden = true;
  }
}

export function mount(game, { seat = null, net = false, start = true, leave = null } = {}) {
  mySeat = seat;
  netPlay = net;
  const fighters = { p1: $('fighter-p1'), p2: $('fighter-p2') };
  const plates = { p1: $('plate-p1'), p2: $('plate-p2') };
  const portraits = { p1: $('axie-p1'), p2: $('axie-p2') };
  // Los Axies solo cambian entre partidas: se repintan aparte del resto de la
  // pantalla, que se rehace en cada carta. Recrear sus capas a cada rato la haría
  // parpadear entera.
  const shown = { p1: null, p2: null, match: null, finale: null };
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
  // Una carta de Free Game apilada crece para abajo y el dock de la carta a colocar se
  // suma arriba: en una ventana baja eso no entra en el alto de la mesa, y la fila se
  // recortaba o se metía encima de los Axies. Se mide lo que ocupa y se achica el zoom
  // hasta que entre; si después sobra lugar, vuelve a crecer. El alto es casi
  // proporcional al zoom (todo en la mesa va multiplicado por `--zoom`), así que una
  // regla de tres alcanza y en dos vueltas queda.
  let fieldFit = 1;
  //
  // El lugar no es el `max-height` a secas: la fila de la mesa es `auto` y la de arriba
  // un `1fr` que, en una ventana ancha y baja, queda en cero y le deja menos que eso. Lo
  // que la mesa puede ocupar son esas dos filas juntas, y eso no depende de lo que haya
  // adentro —medir el alto de la mesa sí, y se pondría a oscilar—.
  function fitField() {
    const css = globalThis.getComputedStyle;
    if (!css) return fieldFit;
    const rows = css(arena).gridTemplateRows.split(' ').map(parseFloat);
    const style = css(field);
    const room = Math.min(parseFloat(style.maxHeight) || Infinity,
      (rows[1] || 0) + (rows[2] || Infinity) - (parseFloat(style.marginTop) || 0));
    const rects = [...(field.children ?? [])].map((el) => el.getBoundingClientRect?.()).filter(Boolean);
    if (!room || !rects.length) return fieldFit;
    const need = Math.max(...rects.map((r) => r.bottom)) - Math.min(...rects.map((r) => r.top));
    if (!need) return fieldFit;
    const next = Math.max(0.4, Math.min(1, fieldFit * room * 0.97 / need));
    return Math.abs(next - fieldFit) < 0.02 ? fieldFit : next;
  }
  function paintField(state, focus) {
    // Lo que ocupaba cada carta antes de repintar, para que no salte (ver `glideCards`).
    // Si la mesa cambia de dueño las cartas son otras y entran con su propio pase.
    const before = field.dataset.owner === focus ? cardBoxes() : null;
    paint(field, fieldHtml(state, focus, fieldFit));
    for (let i = 0; i < 2; i++) {
      const fit = fitField();
      if (fit === fieldFit) break;
      fieldFit = fit;
      paint(field, fieldHtml(state, focus, fieldFit));
    }
    if (before) glideCards(before);
  }
  // La mesa se reescribe entera a cada carta, así que cada carta es un nodo nuevo y la
  // transición de `width` del CSS nunca tiene de dónde arrancar: cuando la cadena se
  // alarga y todas se achican —el zoom baja un escalón, o la fila las aprieta— pegaban
  // el salto de un cuadro para el otro. Se mide dónde estaba cada una (por columna), se
  // mide dónde quedó, y se la lleva de una caja a la otra con un `transform`: lo que se
  // ve es la fila achicándose y corriéndose para hacerle lugar a la que entra.
  function cardBoxes() {
    const boxes = new Map();
    for (const el of field.querySelectorAll?.('.strip > .card[data-col]') ?? []) {
      const r = el.getBoundingClientRect?.();
      if (r?.width) boxes.set(el.dataset.col, r);
    }
    return boxes;
  }
  function glideCards(before) {
    if (!before.size || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    for (const el of field.querySelectorAll?.('.strip > .card.is-settled[data-col]') ?? []) {
      const was = before.get(el.dataset.col);
      const now = el.getBoundingClientRect?.();
      if (!was || !now?.width || !now.height || !el.animate) continue;
      const dx = was.left - now.left, dy = was.top - now.top;
      const sx = was.width / now.width, sy = was.height / now.height;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) continue;
      el.animate([
        { transformOrigin: '0 0', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
        { transformOrigin: '0 0', transform: 'none' },
      ], { duration: 280, easing: 'cubic-bezier(.2, .8, .3, 1)' });
    }
  }
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
  // La capa donde se dibuja el recorrido de la cadena. Va aparte de la mesa porque la
  // mesa se repinta a cada estado (ver `traceChain`).
  const chainfx = $('chainfx');
  const audio = createAudio();
  // El remate del final es del asiento de esta pantalla: en una sala los dos aparatos
  // miran la misma partida y solo uno ganó.
  const cues = createCues(audio, { seat: mySeat });
  let animated = 0; // id del último golpe ya animado
  let aimed = 0; // id del último recorrido de cadena ya dibujado
  // Qué mazo está abierto, o `null` si no hay ninguno. Lo mira el repintado para saber
  // si tiene que dibujar las cartas y de quién (ver más abajo).
  let peeking = null;
  // Cartas que ya se le vieron a cada uno en la cadena en curso, para que el tirón
  // de robar salga una sola vez por carta y no en cada repintado.
  const seen = { p1: 0, p2: 0 };
  // Si a cada uno ya se le vio entrar en furia. La última chance dura todo un turno y
  // la pantalla se repinta a cada carta: sin esto el bicho rugiría de nuevo con cada
  // una, y un rugido repetido deja de ser el momento en que pasó algo.
  const raging = { p1: false, p2: false };
  // De quién era la mesa y si el turno era de esta pantalla, en el repintado anterior.
  // Los dos sirven para lo mismo: saber qué acaba de **aparecer**. Lo que entra tiene
  // una animación de entrada, y una animación de entrada que se dispara en cada
  // repintado —la pantalla se rehace a cada carta— es un temblequeo, no una entrada.
  let held = null;
  let acted = false;
  let oddsTurn = null;
  let animatedStack = 0;
  let autoDrawing = false;
  let autoDrawTimer = null;
  let isDroppingStack = false;
  let hadPendingStack = false;

  game.subscribe((state) => {
    // Una partida nueva se olvida de la anterior: las cartas ya animadas y el último
    // número del golpe son de otra mesa. Sale del estado y no del botón que la arrancó
    // porque en red la puede haber arrancado el otro aparato.
    if (shown.match !== state.match) {
      shown.match = state.match;
      forget();
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
        // En el tutorial el Axie propio dice con el cuerpo lo que antes decía un cartel:
        // festeja la carta que engancha y se pone nervioso cuando la rueda cae a rojo.
        else if (state.tutorial && player === 'p1') {
          const { p } = survivalOdds(chain, game.unseenPool(player));
          motions[player].pulse(p < 0.4 ? 'peek' : 'cheer');
        }
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
    paintField(state, focus);
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
    // El medidor es de quien tiene la mesa: es información pública —la cadena viva ya
    // se ve entera— y se muestra en el turno de cualquiera de los dos, no solo el propio.
    const decider = state.phase === 'turn' ? state.turn : null;
    if (decider && decider !== oddsTurn) pulse($('odds'), 'enter', 'turn', 620);
    oddsTurn = decider;
    paint($('odds'), decider
      ? oddsHtml(state, decider, game.unseenPool(decider))
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

    // El ataque se soltó: antes del golpe, la cadena se recorre. La mesa ya está
    // repintada acá arriba, así que los eslabones están donde van a quedar.
    if (state.aiming && state.aiming.id !== aimed) {
      aimed = state.aiming.id;
      // Las cartas que están puestas son las del que tiene la mesa, y el recorrido se
      // dibuja encima de ellas: si la mesa fuera de otro no habría dónde dibujarlo.
      if (state.aiming.player === focus) {
        traceChain(chainfx, field, audio, state.chains[focus], state.aiming.ms);
      }
    }

    const struck = state.lastHit && state.lastHit.id !== animated ? state.lastHit : null;
    let landed = 0;
    if (struck) {
      animated = struck.id;
      landed = playHit(vfx, audio, arena, portraits, motions, struck, state.symbols[struck.by]);
    }
    // La furia de la última chance, que sale una vez y cuelga del golpe que la
    // enciende: si el que quedó sin vida es justo el que está por recibir el golpe que
    // acaba de entrar al estado, el rugido espera a que ese golpe caiga. El resto del
    // tiempo —la pluma, el veneno, un estado que llega por el cable ya hecho— no hay
    // nada que esperar y sale ahí mismo.
    for (const player of PLAYERS) {
      const furious = lastChance(state) === player;
      if (furious && !raging[player]) {
        rage(portraits[player], motions[player], audio,
          struck?.target === player ? landed + FURY_BEAT : 0,
          () => lastChance(game.state) === player);
      }
      raging[player] = furious;
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
  const hud = $('hud-menu');
  const hudBtn = $('hud-btn');

  // Guardado, y diciéndolo. La partida en red engancha esta pantalla cuando ya está
  // andando, así que el estado del menú se pone acá y no se hereda del HTML.
  openHud(false);

  hudBtn?.addEventListener('click', (e) => {
    // Sin esto el clic sigue viaje hasta el documento y cierra lo que acaba de abrir.
    e.stopPropagation?.();
    openHud(hud?.hidden);
  });
  $('hud-close')?.addEventListener('click', (e) => {
    e.stopPropagation?.();
    openHud(false);
  });
  const langBtn = $('lang-btn');
  if (langBtn && !langBtn._boundToggle) {
    langBtn._boundToggle = true;
    langBtn.addEventListener('click', (e) => {
      e.stopPropagation?.();
      toggleLang();
    });
  }
  hud?.addEventListener('click', (e) => {
    // Los interruptores, perillas y selector de idioma dejan el panel abierto.
    // Lo que abre otra pantalla —las reglas, abandonar— lo cierra.
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


  /** Hay una carta de Free Game esperando columna, y la columna la elige esta pantalla. */
  const placing = () => Boolean(game.state?.pendingStack) && isMine(game.state.pendingStack.player);

  $('controls').addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'hit') {
      if (gated(game.state, 'hit')) return;
      if (placing() && !isDroppingStack) {
        const targets = field.querySelectorAll('[data-stack-col]');
        if (targets.length > 0) {
          dropTetrisCard(0, targets[0]);
          return;
        }
      }
      game.hit();
    }
    else if (action === 'stand') {
      if (!gated(game.state, 'stand')) game.stand();
    }
    else if (action === 'restart') restart();
    else if (action === 'adv-next') {
      const nextLvl = nextLevelId(game.state?.adventure?.level);
      if (nextLvl !== null) {
        restart({ mode: 'adventure', adventureLevel: nextLvl });
      }
    }
    else if (action === 'leave') leave?.();
  });

  /** Lo que hay que olvidar al cambiar de partida: cartas ya animadas y números viejos. */
  function forget() {
    settled.clear();
    raging.p1 = false;
    raging.p2 = false;
    lastPoints.p1 = null;
    lastPoints.p2 = null;
    autoDrawing = false;
    clearTimeout(autoDrawTimer);
    isDroppingStack = false;
    hadPendingStack = false;
    animatedStack = 0;
    aimed = 0;
    if (chainfx) chainfx.innerHTML = '';
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

  // Las restricciones del tutorial las aplica la partida misma (ver `game.js`).
  market.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="renew"]')) return game.renewMarket();
    if (e.target.closest('[data-action="skip"]')) return game.skipDraft();
    const uid = e.target.closest('.market-card:not([disabled])')?.dataset.uid;
    if (uid) game.takeCard(Number(uid));
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

  /**
   * La caída de una carta de Free Game sobre su columna: un haz de luz, la carta que se
   * estira al caer y se aplasta al llegar, y la salpicadura. `clone` ya viene armado y
   * parado en `top`; se cuelga del `body` recién después del haz, para quedar encima.
   * `first` es su primer cuadro y `lead` cuánto baja en el primer quinto del recorrido.
   */
  async function fallOnto(targetEl, clone, tRect, top, dx, first, lead) {
    const beam = document.createElement('div');
    beam.className = 'tetris-drop-beam';
    beam.style.left = `${tRect.left - 6}px`;
    beam.style.top = `${top}px`;
    beam.style.width = `${tRect.width + 12}px`;
    beam.style.height = `${Math.max(10, tRect.bottom - top)}px`;
    document.body.appendChild(beam);
    try {
      document.body.appendChild(clone);
      // Sonido de deslizamiento fluido de la gota
      audio?.sfx?.('renew', { rate: 1.6, gain: 0.55, cut: 0.35 });
      const dy = tRect.top - top;
      if (typeof clone.animate === 'function') {
        // Deformación líquida ("Squash & Stretch" con caída aerodinámica)
        const anim = clone.animate([
          first,
          { transform: `translate(${dx * 0.2}px, ${dy * lead}px) scale(0.92, 1.12)`, opacity: 1, offset: 0.2 },
          { transform: `translate(${dx * 0.7}px, ${dy * 0.65}px) scale(0.86, 1.20)`, opacity: 1, offset: 0.65 },
          { transform: `translate(${dx}px, ${dy}px) scale(1.26, 0.74)`, opacity: 1 },
        ], { duration: 340, easing: 'cubic-bezier(0.25, 0.1, 0.4, 1)', fill: 'forwards' });
        await anim.finished.catch(() => {});
      } else {
        await new Promise((r) => setTimeout(r, 260));
      }
    } finally {
      beam.remove();
      clone.remove();
    }
    // Fusión de sonido al impactar: burbuja + impacto táctil + plop líquido
    audio?.sfx?.('freegame');
    spawnLiquidImpactVfx(tRect);
    targetEl.classList?.add?.('card--stack-impact');
    setTimeout(() => targetEl.classList?.remove?.('card--stack-impact'), 560);
  }

  /** El jugador eligió columna: la carta del dock cae sobre ella y recién ahí se monta. */
  async function dropTetrisCard(colIndex, targetEl) {
    if (isDroppingStack || !placing()) return;
    const floating = document.getElementById('tetris-floating-card');
    if (!floating || !targetEl?.getBoundingClientRect) {
      game.chooseStackTarget(colIndex);
      return;
    }
    isDroppingStack = true;
    try {
      const fRect = floating.getBoundingClientRect();
      const tRect = targetEl.getBoundingClientRect();
      floating.style.opacity = '0';
      const clone = floating.cloneNode(true);
      clone.id = '';
      clone.className = 'card card--tetris-falling';
      Object.assign(clone.style, {
        left: `${fRect.left}px`, top: `${fRect.top}px`, width: `${fRect.width}px`, height: `${fRect.height}px`,
        margin: '0', transform: 'none', transition: 'none', opacity: '1',
      });
      const dx = (tRect.left + (tRect.width - fRect.width) / 2) - fRect.left;
      await fallOnto(targetEl, clone, tRect, fRect.top, dx,
        { transform: 'translate(0, 0) scale(1, 1)', opacity: 1 }, 0.16);
      await new Promise((r) => setTimeout(r, 50));
    } finally {
      try {
        game.chooseStackTarget(colIndex);
      } finally {
        isDroppingStack = false;
      }
    }
  }

  /** La CPU (o el robo automático) montó una carta: se la ve caer desde arriba. */
  async function playAutoStackAnimation({ colIndex, card }) {
    const targetEl = field.querySelector?.(`[data-col="${colIndex}"]`);
    if (!targetEl?.getBoundingClientRect) return;
    const tRect = targetEl.getBoundingClientRect();
    if (!tRect || tRect.width === 0) return;
    const top = Math.max(16, tRect.top - 140);
    const clone = document.createElement('div');
    clone.className = 'card card--tetris-falling';
    clone.innerHTML = `<span class="card-no">✨</span>${card.symbols.map((s) => symChip(s, true)).join('')}${powerChip(card)}`;
    Object.assign(clone.style, {
      left: `${tRect.left}px`, top: `${top}px`, width: `${tRect.width}px`, height: `${tRect.height}px`,
      margin: '0', transform: 'none', transition: 'none',
    });
    try {
      await fallOnto(targetEl, clone, tRect, top, 0, { transform: 'translate(0, 0) scale(0.96, 1)', opacity: 0.95 }, 0.2);
    } catch {
      // Es decorado: si algo falla, la carta ya está montada igual.
    }
  }

  field.addEventListener('click', (e) => {
    const target = e.target.closest('[data-stack-col]');
    if (target && !isDroppingStack) {
      const col = Number(target.dataset.stackCol);
      if (game.state?.tutorial && game.state.tutorialAllowedCol != null && col !== game.state.tutorialAllowedCol) return;
      dropTetrisCard(col, target);
      return;
    }
    const floating = e.target.closest('#tetris-floating-card, .tetris-dock');
    if (floating && !isDroppingStack && placing()) {
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
      if (col !== null && placing()) {
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
        const col = Number(target.dataset.stackCol);
        if (game.state?.tutorial && game.state.tutorialAllowedCol != null && col !== game.state.tutorialAllowedCol) return;
        e.preventDefault();
        dropTetrisCard(col, target);
        return;
      }
      if (placing() && !isDroppingStack) {
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
  $('symbols-btn')?.addEventListener('click', openSymbols);

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea')) return;
    // Con un panel abierto encima —el mazo, el historial o las reglas— las teclas son
    // del panel y no de la mesa.
    if (document.querySelector?.('dialog[open]')) return;
    const state = game.state;
    if (e.key === 'r' || e.key === 'R') {
      if (placing()) {
        const targets = field.querySelectorAll('[data-stack-col]');
        if (targets.length === 1 && !isDroppingStack) {
          dropTetrisCard(0, targets[0]);
          return;
        }
      }
      if (!gated(state, 'hit')) game.hit();
    }
    if ((e.key === 'p' || e.key === 'P') && !gated(state, 'stand')) game.stand();
    if (e.key === 'Enter') {
      // La ronda ya viene sola; Enter solo se saltea la pausa del cartel.
      if (state.phase === 'roundEnd') game.nextRound();
      // Terminada por abandono no hay otra igual: enfrente no queda nadie.
      else if (state.phase === 'matchEnd' && !state.forfeit) {
        const nextLvl = state.mode === 'adventure' && wonMatch(state)
          ? nextLevelId(state.adventure?.level)
          : null;
        if (nextLvl !== null) {
          restart({ mode: 'adventure', adventureLevel: nextLvl });
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

  return { restart, _game: game };
}
