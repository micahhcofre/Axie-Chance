import { SYMBOLS, POWERS, crest, iconUrl, powerIcon } from './data.js';
import { AXIES, AXIE_IDS, axie, axieArt } from './axies.js';
import { activeSymbols, isScoringCell, scoreChain, survivalOdds } from './rules.js';
import { createVfx, hitDelay, preloadVfx } from './vfx.js';
import {
  TARGET, PLAYERS, MARKET_SIZE, POWER_NUMBERS, hpOf, ownedBy, swingOf,
} from './game.js';

const $ = (id) => document.getElementById(id);
const settled = new Set();

const NAMES = { human: 'Vos', cpu: 'CPU' };

function symChip(symbol, on) {
  return `<span class="sym" data-on="${on}" style="--c:${SYMBOLS[symbol].color}">
    ${crest(symbol)}</span>`;
}

/**
 * El poder de una carta, colgado abajo y separado por una línea: la cadena no lo
 * mira, así que tampoco se lee como un eslabón más.
 */
function powerChip(card) {
  if (!card.power) return '';
  return `<span class="card-power" style="--c:${SYMBOLS[POWERS[card.power].symbol].color}"
    >${powerIcon(card.power)}</span>`;
}

function cardHtml(chain, card, index) {
  const cls = settled.has(card.uid) ? 'card is-settled' : 'card';
  settled.add(card.uid);
  const syms = card.symbols.map((s) => symChip(s, isScoringCell(chain, index, s))).join('');
  return `<div class="${cls}"><span class="card-no">${index + 1}</span>${syms}${powerChip(card)}</div>`;
}

function bustCardHtml(card) {
  const cls = settled.has(card.uid) ? 'card card--bust is-settled' : 'card card--bust';
  settled.add(card.uid);
  const syms = card.symbols.map((s) => symChip(s, false)).join('');
  return `<div class="card-gap"></div><div class="${cls}">${syms}${powerChip(card)}</div>`;
}

function runsHtml(chain) {
  if (chain.cards.length === 0) return '<span class="runs-empty">sin cartas</span>';
  if (chain.busted) return '<span class="runs-zero">Cadena cortada · el ataque falla</span>';
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
function statusHtml(state, player) {
  const st = state.status[player];
  const pipIcon = (src, value, title) =>
    `<span class="pip-status" title="${title}"><img src="${src}" alt=""><b>${value}</b></span>`;
  const pip = (id, value, title) => pipIcon(iconUrl(`status-${id}.png`), value, title);

  const chips = [];
  if (st.egg) chips.push(pip('egg', st.egg, `Huevo: aguanta ${st.egg} de daño antes de romperse`));
  if (st.poison) {
    chips.push(pip('poison', st.poison,
      `Veneno: ${st.poison} de daño al cerrar la ronda, después baja ${POWER_NUMBERS.poisonDecay}`));
  }
  if (st.weak) {
    chips.push(pip('weak', st.weak,
      `Debilitado: sus próximos ${st.weak} ataques pegan ${st.weakBite} menos`));
  }
  if (st.strength) chips.push(pip('strength', `+${st.strength}`, `Fuerza: +${st.strength} de daño en cada ataque`));
  if (st.stacked) {
    chips.push(pipIcon(POWERS.octopus.icon, st.stacked,
      `Pulpo: las próximas ${st.stacked} cartas que agarre del centro salen arriba del ` +
      'mazo, sin barajar'));
  }
  // Lo ya reservado, esperando a la ronda que viene.
  const held = state.top[player].length;
  if (held) {
    chips.push(pipIcon(POWERS.octopus.icon, `▲${held}`,
      `${held === 1 ? 'Una carta reservada' : `${held} cartas reservadas`}: ` +
      'abre la ronda que viene'));
  }
  return chips.length ? `<span class="plate-status">${chips.join('')}</span>` : '';
}

/**
 * La chapa que flota sobre cada Axie: su clase, su nombre y la barrita de vida.
 * Es lo único fijo de cada lado — el resto de la pantalla es de los dos.
 */
function plateHtml(state, player) {
  const own = axie(state.axies[player]);
  const chain = state.chains[player];
  const hp = hpOf(state, player);
  const dealt = state.roundScores[player];

  // Una sola marca por vez, y el orden importa: lo que está pasando ahora tapa a lo
  // que ya pasó.
  let tag = '';
  if (state.turn === player && state.phase === 'turn') {
    tag = '<span class="plate-tag" data-kind="turn">cargando</span>';
  } else if (dealt === 0 && chain.busted) {
    tag = '<span class="plate-tag" data-kind="bust">falló</span>';
  } else if (dealt) {
    tag = `<span class="plate-tag" data-kind="hit">${dealt} de daño</span>`;
  }

  return `
    <span class="plate-top" style="--c:${SYMBOLS[own.class].color}">
      ${crest(own.class, 'sm')}<span class="plate-name">${own.name}</span>
      <span class="plate-who">${NAMES[player]}</span>${tag}
    </span>
    <span class="plate-hp" data-low="${hp <= TARGET / 4}">
      <span class="hpbar"><i style="width:${(100 * hp) / TARGET}%"></i></span>
      <b>${hp}</b>
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

function fieldHtml(state, player) {
  const chain = state.chains[player];
  const own = axie(state.axies[player]);
  // El número grande es el daño que se va a aplicar de verdad, no el de la cadena
  // pelada: si la fuerza o el caracol lo mueven, el desglose va abajo.
  const points = swingOf(state, player);
  const raw = chain.busted ? 0 : scoreChain(chain).total;
  const st = state.status[player];
  const locked = state.roundScores[player] !== null;

  let note;
  if (chain.busted) note = 'se le cortó la cadena';
  else if (state.turn === player) note = 'está cargando el ataque';
  else if (locked) note = 'soltó el ataque';
  else note = 'abre el intercambio';

  // Solo se muestra el desglose cuando hay algo que explicar: si la cadena vale lo
  // mismo que el golpe, el número solo alcanza.
  const mods = [];
  if (points !== raw) {
    mods.push(`${raw} de cadena`);
    if (st.strength) mods.push(`+${st.strength} de fuerza`);
    if (st.weak) mods.push(`−${st.weakBite} por el caracol`);
  }
  const breakdown = mods.length ? `<span class="field-mods">${mods.join(' · ')}</span>` : '';

  const cards = chain.cards.map((c, i) => cardHtml(chain, c, i)).join('');
  const bust = chain.bustCard ? bustCardHtml(chain.bustCard) : '';
  return `
    <div class="field-head" style="--c:${SYMBOLS[own.class].color}">
      <span class="field-who">${crest(own.class, 'sm')}<b>${NAMES[player]}</b> ${note}</span>
      <span class="field-dmg" data-busted="${chain.busted}">${points}<small>DAÑO</small></span>
      ${breakdown}
    </div>
    <div class="strip">${cards}${bust}</div>
    <div class="runs">${runsHtml(chain)}</div>`;
}

// Arriba solo queda dónde estamos parados: la vida se lee sobre cada Axie.
function scoreboardHtml(state) {
  return `<span class="sb-round">Ronda ${state.round}</span>
    <span class="sb-pool">${state.pool.length + state.market.length} cartas en la reserva</span>`;
}

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

  let head;
  let actions = '';
  if (picking === 'cpu') {
    head = '<span class="overlay-title">El centro</span><p class="overlay-note">La CPU está eligiendo…</p>';
  } else {
    // No se pregunta el modo: la carta que toques ya dice qué te llevás.
    let note;
    if (state.chains.human.busted) {
      note = 'Se te cortó la cadena: llevate <b>una carta sin poder</b>.';
    } else if (!mode) {
      note = 'Llevate <b>una con poder</b> (y listo) <b>o dos sin poder</b>.';
    } else {
      note = `Vas por cartas sin poder: te ${
        remaining === 1 ? 'queda 1' : `quedan ${remaining}`}.`;
    }
    head = `<span class="overlay-title">Elegí del centro</span><p class="overlay-note">${note}</p>`;
    // Nada de lo que podés llevarte lleva tu símbolo: te queda una renovación del centro.
    const renew = canRenew
      ? `<button class="btn" data-action="renew"
          title="Ninguna carta que podés llevarte tiene tu símbolo">Renovar el centro ⟳</button>`
      : '';
    actions = `<div class="overlay-actions">${renew}
      <button class="btn" data-action="skip"
        title="Cerrá el reparto sin sumar cartas al mazo">${
          state.draft.took ? 'No agarrar más' : 'No agarrar'
        }</button></div>`;
  }

  const slots = state.market.map((c) => marketCardHtml(c, open.has(c.uid))).join('');
  const empty = '<div class="market-slot"></div>'.repeat(
    Math.max(MARKET_SIZE - state.market.length, 0),
  );
  return `<div class="overlay-panel">
    <div class="overlay-head">${head}</div>
    <div class="market-row">${slots}${empty}</div>
    ${actions}
  </div>`;
}

function controlsHtml(state, picking) {
  if (state.phase === 'draft') {
    const msg = picking === 'cpu' ? 'La CPU elige del centro…' : 'Elegí tu carta del centro.';
    return `<span class="controls-msg">${msg}</span>`;
  }

  if (state.phase === 'matchEnd') {
    // Gana el que deja al otro sin vida. Con la maceta curando y el veneno mordiendo
    // fuera del ataque, el daño repartido dejó de ser un buen sustituto de la vida.
    const down = { human: hpOf(state, 'human') <= 0, cpu: hpOf(state, 'cpu') <= 0 };
    const r = down.human && down.cpu ? 'tie' : down.cpu ? 'human' : 'cpu';
    const text = { human: '¡Ganaste el combate!', cpu: 'Te noquea la CPU.', tie: 'Doble KO.' }[r];
    return `<div class="banner" data-result="${r}">${text}</div>
      <span class="controls-msg">Vida final ${hpOf(state, 'human')} — ${hpOf(state, 'cpu')}
        en ${state.round} intercambios.</span>
      <div class="controls-spacer"></div>
      <button class="btn btn-primary" data-action="restart">Jugar de nuevo</button>`;
  }

  if (state.phase === 'roundEnd') {
    const r = state.roundWinner;
    const text = { human: 'Pegaste más fuerte', cpu: 'La CPU pegó más fuerte', tie: 'Intercambio parejo' }[r];
    return `<div class="banner" data-result="${r}">${text}</div>
      <span class="controls-msg">${state.roundScores.human} vs ${state.roundScores.cpu} de daño ·
        vida ${hpOf(state, 'human')} — ${hpOf(state, 'cpu')}.</span>
      <div class="controls-spacer"></div>
      <button class="btn btn-primary" data-action="next">Siguiente ronda →</button>`;
  }

  // Entre el reparto y el turno propio (turn === null) no hay nada que decidir.
  if (state.turn !== 'human') {
    const msg = state.turn === 'cpu' ? 'La CPU está cargando su ataque…' : 'Repartiendo…';
    return `<span class="controls-msg">${msg}</span>`;
  }

  const chain = state.chains.human;
  const alive = activeSymbols(chain).map((s) => crest(s, 'sm')).join('');
  const disabled = state.busy || state.turn !== 'human' ? 'disabled' : '';
  return `
    <span class="controls-msg">Sigue viva ${alive || '—'}</span>
    <div class="controls-spacer"></div>
    <button class="btn btn-danger" data-action="hit" ${disabled}>Robar carta</button>
    <button class="btn btn-primary" data-action="stand" ${disabled}>Atacar</button>`;
}

function oddsHtml(state, pool) {
  // No hay descarte: fuera del mazo solo están las cartas de la cadena en curso.
  const deckInfo = `<div class="odds-deck"><span>Tu mazo ${ownedBy(state, 'human')}</span>
    <span>Sin salir ${state.decks.human.length}</span></div>`;

  if (state.turn !== 'human' || state.phase !== 'turn') {
    return `<div class="odds-label">Tu mazo</div>
      <div class="odds-note" style="margin-top:6px">
        Las probabilidades aparecen cuando te toque decidir.</div>${deckInfo}`;
  }

  const chain = state.chains.human;
  const { ok, total, p } = survivalOdds(chain, pool);
  const pct = Math.round(p * 100);
  const risk = pct >= 65 ? 'low' : pct >= 40 ? 'mid' : 'high';
  const pips = activeSymbols(chain)
    .map((s) => `<span class="pip" style="--c:${SYMBOLS[s].color}">${crest(s)}</span>`)
    .join('');

  return `
    <div class="odds-label">La próxima carta continúa</div>
    <div class="odds-value" data-risk="${risk}">${pct}%
      <div class="odds-bar"><i style="width:${pct}%"></i></div>
    </div>
    <div class="odds-note">${ok} de ${total} cartas sirven</div>
    <div class="odds-alive">${pips}</div>${deckInfo}`;
}

/**
 * El roster: seis Axies, uno por clase. Tocar uno arranca una partida nueva con su
 * mazo. Son más de sesenta imágenes, así que solo se repinta cuando cambia el roster.
 */
function axiePickerHtml(state) {
  return AXIE_IDS.map((id) => {
    const a = AXIES[id];
    const taken = state.axies.cpu === id;
    const on = state.axies.human === id;
    const label = taken
      ? `${a.name}, ${SYMBOLS[a.class].name}, lo juega la CPU`
      : `Jugar con ${a.name}, ${SYMBOLS[a.class].name}`;
    return `<button class="crest-btn" data-axie="${id}" data-on="${on}"
      data-taken="${taken}" style="--c:${SYMBOLS[a.class].color}"
      aria-label="${label}" aria-pressed="${on}">${axieArt(id)}${crest(a.class)}</button>`;
  }).join('');
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
 * Cuánto tarda el Axie en cruzar hasta el rival, en ms: lo que va del comienzo del
 * salto al momento en que su cuerpo llega. Es el 44% de `axie-lunge` en el CSS.
 */
const LUNGE_REACH = 270;

/**
 * El intercambio de golpes: el que pega sale disparado contra el otro, y en el
 * momento en que llega revienta el efecto de su clase, el que lo recibe sale
 * despedido y le aparece el número encima. Las tres cosas caen juntas porque las
 * tres se cuelgan del mismo instante — `hitDelay`, lo que tarda en conectar el
 * efecto de esa clase—, cada una arrancando lo suyo por adelantado.
 *
 * Vive fuera del render normal porque es un pulso, no un estado: la pantalla se
 * repinta entera a cada carta y una animación puesta en el HTML se cortaría a la
 * mitad. El `<span>` del número se saca solo al terminar, así no se apilan.
 */
function playHit(vfx, portraits, hit, klass) {
  const el = portraits[hit.target];
  if (!el) return;
  const miss = hit.amount === 0;
  // Un ataque que conecta es el golpe de la clase del que pegó; uno que se desarma
  // es el efecto de "desarmado", y cae sobre el que falló.
  const key = miss ? 'bust' : klass;
  const impact = hitDelay(key);
  vfx.play(key, el, { from: hit.by === 'human' ? 'left' : 'right' });

  // Un ataque que falla no es un ataque: no cruza a ningún lado, se le desarma
  // encima y trastabilla —eso ya lo cuenta el `whiff` sobre el que falló—.
  if (!miss) {
    setTimeout(
      () => pulse(portraits[hit.by], 'act', 'attack', 620),
      Math.max(impact - LUNGE_REACH, 0),
    );
  }

  setTimeout(() => {
    pulse(el, 'react', miss ? 'whiff' : 'hit', 900);
    el.insertAdjacentHTML(
      'beforeend',
      `<span class="dmg" data-kind="${miss ? 'whiff' : 'hit'}">${miss ? 'fallo' : `−${hit.amount}`}</span>`,
    );
    const tag = el.querySelector('.dmg:last-child');
    tag?.addEventListener('animationend', () => tag.remove());
  }, impact);
}

/**
 * Cómo está parado un Axie ahora mismo. Es estado, no pulso: dura mientras dure la
 * situación, así que va como atributo y el CSS decide qué animación corre encima de
 * la respiración —agacharse a cargar, desplomarse, festejar—.
 */
function stanceOf(state, player) {
  // El que se queda sin vida no se desploma en el acto: alcanza a devolver el golpe
  // y recién cuando cierra el intercambio se cae. Por eso el KO mira la fase y no la
  // vida — si no, la CPU jugaría su último turno tirada en el piso.
  if (state.phase === 'matchEnd') return hpOf(state, player) <= 0 ? 'ko' : 'win';
  if (state.turn === player && state.phase === 'turn') return 'charging';
  return 'idle';
}

export function mount(game) {
  const fighters = { human: $('fighter-human'), cpu: $('fighter-cpu') };
  const plates = { human: $('plate-human'), cpu: $('plate-cpu') };
  const portraits = { human: $('axie-human'), cpu: $('axie-cpu') };
  // Los Axies solo cambian entre partidas: se repintan aparte del resto de la
  // pantalla, que se rehace en cada carta. Recrear sus capas a cada rato la haría
  // parpadear entera.
  const shown = { human: null, cpu: null, picker: null };
  const arena = $('arena');
  const field = $('field');
  const market = $('market');
  const vfx = createVfx($('vfx'));
  let animated = 0; // id del último golpe ya animado
  // Cartas que ya se le vieron a cada uno en la cadena en curso, para que el tirón
  // de robar salga una sola vez por carta y no en cada repintado.
  const seen = { human: 0, cpu: 0 };

  game.subscribe((state) => {
    // El terreno es el de tu clase: cambia al elegir otro Axie, no a cada carta.
    arena.dataset.arena = axie(state.axies.human).class;
    $('scoreboard').innerHTML = scoreboardHtml(state);

    const picking = game.drafting();
    const focus = focusOf(state, picking);

    for (const player of PLAYERS) {
      plates[player].innerHTML = plateHtml(state, player);
      fighters[player].dataset.active = String(state.turn === player && state.phase === 'turn');
      fighters[player].dataset.busted = String(state.chains[player].busted);
      portraits[player].dataset.stance = stanceOf(state, player);

      // Cada carta que sale se siente en el cuerpo del que la robó. La que corta la
      // cadena no: a esa la cuenta el ataque desarmado, que llega enseguida.
      const chain = state.chains[player];
      const cards = chain.cards.length + (chain.bustCard ? 1 : 0);
      if (cards > seen[player] && !chain.busted) pulse(portraits[player], 'act', 'draw', 420);
      seen[player] = cards;

      if (shown[player] !== state.axies[player]) {
        shown[player] = state.axies[player];
        portraits[player].innerHTML = axieArt(state.axies[player]);
        // El atlas del golpe pesa: se pide al arrancar la partida, no al primer ataque.
        preloadVfx(state.symbols[player]);
      }
    }

    field.innerHTML = fieldHtml(state, focus);
    field.dataset.owner = focus;
    field.dataset.busted = String(state.chains[focus].busted);

    // El centro solo existe mientras haya que elegir; el resto del tiempo no está.
    const drafting = state.phase === 'draft';
    market.hidden = !drafting;
    market.innerHTML = drafting
      ? marketHtml(state, { picking, pickable: game.pickable(), canRenew: game.canRenew('human') })
      : '';

    $('controls').innerHTML = controlsHtml(state, picking);
    const roster = `${state.axies.human}|${state.axies.cpu}`;
    if (shown.picker !== roster) {
      shown.picker = roster;
      $('axie-picker').innerHTML = axiePickerHtml(state);
    }
    $('odds').innerHTML = oddsHtml(state, game.unseenPool('human'));
    $('log').innerHTML = logHtml(state);

    if (state.lastHit && state.lastHit.id !== animated) {
      animated = state.lastHit.id;
      playHit(vfx, portraits, state.lastHit, state.symbols[state.lastHit.by]);
    }
  });

  $('controls').addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'hit') game.hit();
    else if (action === 'stand') game.stand();
    else if (action === 'next') game.nextRound();
    else if (action === 'restart') restart();
  });

  function restart(axieId) {
    settled.clear();
    game.newMatch({ difficulty: $('difficulty').value, axie: axieId });
  }

  market.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="renew"]')) return game.renewMarket();
    if (e.target.closest('[data-action="skip"]')) return game.skipDraft();
    const uid = e.target.closest('.market-card:not([disabled])')?.dataset.uid;
    if (uid) game.takeCard(Number(uid));
  });

  $('axie-picker').addEventListener('click', (e) => {
    const id = e.target.closest('[data-axie]')?.dataset.axie;
    if (id) restart(id);
  });

  $('new-match').addEventListener('click', () => restart());
  $('difficulty').addEventListener('change', () => restart());
  $('rules-btn').addEventListener('click', () => $('rules-modal').showModal());

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea')) return;
    const state = game.state;
    if (!state) return;
    if (state.phase === 'draft') return;
    if (e.key === 'r' || e.key === 'R') game.hit();
    if (e.key === 'p' || e.key === 'P') game.stand();
    if (e.key === 'Enter') {
      if (state.phase === 'roundEnd') game.nextRound();
      else if (state.phase === 'matchEnd') restart();
    }
  });

  restart();
}
