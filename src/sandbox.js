import { SYMBOLS, SYMBOL_IDS, POWERS, POWER_IDS, CLASS_POWER_IDS, NEUTRAL_POWERS, makeCard, crest, powerIcon } from './data.js';
import { PLAYERS, MARKET_SIZE, maxHpOf, hpOf, seatVoice } from './game.js';
import { POWER_FX } from './power-fx.js';
import { AXIES, AXIE_IDS } from './axies.js';
import { readLoadout, FREE_PLAY } from './loadout.js';
import { readBackpack, writeBackpack, addToBackpack } from './backpack.js';
import { MERGE_COPIES } from './crafting.js';
import { DIFFICULTY_LABELS } from './adventure.js';
import {
  MAX_LEVEL, readProgress, writeProgress, readWallet, writeWallet, recordOf, levelInfo, gainAxp, axpAt,
} from './evolution.js';
import { tr } from './i18n.js';

/**
 * La zona de testeo (`?testeo`): una partida contra la CPU sin reloj, con todos los
 * poderes en la reserva y un panel al costado para fabricar la carta que uno quiera
 * —los símbolos que quiera y el poder que quiera— y hacerla salir en el próximo robo
 * de cualquiera de los dos asientos, o ponerla en el centro. También deja tocar la vida
 * y los estados de cada uno, y disparar la animación de cada poder sin jugarlo.
 *
 * Y la evolución (ver `evolution.js`): subirle niveles a un Axie, darse Moonshards y
 * abrir su evolución o el Taller (la forja de cartas, ver `crafting.js`), para probarlo
 * sin jugar las partidas que hoy todavía no pagan. La carta fabricada también va a la
 * mochila de a tres, para probar la fusión sin esperar a que el Taller las repita.
 *
 * No es parte del juego: `main.js` lo carga con `import()` solo con `?testeo`, así que
 * no va en `MODULES` ni en `dist/`. Toca `game.state` directo —la partida lo devuelve
 * vivo— y repinta con `game.refresh()`: el motor no se entera de que existe.
 */

const other = (p) => (p === 'p1' ? 'p2' : 'p1');

// Los estados que se pueden tocar a mano, en el orden de la chapa (ver `emptyStatus`).
const STATUS_FIELDS = [
  ['egg', tr('Escudo')],
  ['poison', tr('Veneno')],
  ['bleed', tr('Sangrado')],
  ['weak', tr('Caracol')],
  ['healBlock', tr('Sin cura')],
  ['claws', tr('Garras')],
  ['rage', tr('Rage')],
  ['feathers', tr('Plumas')],
  ['bomb', tr('Bomba')],
  ['spikes', tr('Espinas')],
  ['pillow', tr('Almohada')],
  ['cleanser', tr('Limpiador')],
  ['leaf', tr('Hojas')],
  ['cocoon', tr('Capullo')],
  ['noPowers', tr('Sin poderes')],
  ['stacked', tr('Pulpo')],
  ['bubbles', tr('Burbujas')],
];

// Cómo se dice cada momento de un poder (las claves de `POWER_FX`).
const MOMENTS = {
  draw: tr('al robar'),
  stand: tr('al plantarse'),
  apply: tr('al pegar'),
  pick: tr('carta extra'),
  trap: tr('atrapa'),
  open: tr('abre la ronda'),
  tick: tr('turno'),
  slow: tr('frena'),
  block: tr('bloquea'),
  bleed: tr('sangra'),
  bomb: tr('bomba'),
  save: tr('segunda chance'),
  cleanse: tr('limpia'),
  drain: tr('cura con la herida'),
  sting: tr('sale la medusa'),
  self: tr('se infecta'),
  cure: tr('el veneno cura'),
};

// Sobre quién cae cada animación, mirado desde el asiento elegido: `foe` la tira el
// elegido sobre el otro; `hit` se la tira el otro al elegido.
const AIM = {
  'poison:apply': 'foe',
  'snail:apply': 'foe',
  'leech:apply': 'foe',
  'strength:apply': 'foe',
  'brutal:apply': 'foe',
  'razor:apply': 'foe',
  'dagger:draw': 'foe',
  'rage:fury': 'foe',
  'maker:bomb': 'foe',
  'jellyfish:apply': 'foe',
  'redbubble:apply': 'foe',
  'shuriken:apply': 'foe',
  'hammer:apply': 'foe',
  'gloves:draw': 'foe',
  'trickster:apply': 'foe',
  'trickster:pick': 'foe',
  'viper:apply': 'foe',
  'poison:tick': 'hit',
  'razor:bleed': 'hit',
  'snail:slow': 'hit',
  'viper:block': 'hit',
  'jellyfish:sting': 'hit',
};

// Un número creíble para cada animación suelta.
const AMOUNT = {
  strength: 1, octopus: 1, bubble: 1, egg: 1, pot: 15, leaf: 3, snail: 1, leech: 7, poison: 5, steelskin: 14, brutal: 4,
  razor: 2, dagger: 5, rage: 1, maker: 32, shuriken: 15, fan: 1, hammer: 12, guard: 10, sage: 12, pillow: 10, cocoon: 8,
  scanner: 8, trickster: 1, viper: 1, gloves: 5, edge: 8, jellyfish: 2, redbubble: 3,
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

let sheet = false;
function loadSheet() {
  if (sheet) return;
  sheet = true;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'sandbox.css';
  document.head.appendChild(link);
}

/**
 * Abre la zona de testeo sobre la mesa de `ui`. `lobby` es la portada, que se saca de
 * encima. La partida arranca con tu último Axie o con el de `axie`.
 */
export function openSandbox({ game, ui, lobby }) {
  loadSheet();
  lobby?.close({ instant: true });

  // Lo que se arma en el panel.
  const pick = { seat: 'p1', symbols: new Set(['beast']), power: null, keep: false };
  const setup = { axie: readLoadout()?.axie ?? AXIE_IDS[0], difficulty: 'normal' };
  // Las cartas fabricadas que esperan su robo, la primera es la que sale: `queue[p]`.
  // Viven en el mazo (arriba de todo) y acá se recuerdan para volver a subirlas si una
  // ronda nueva las baraja.
  let queue = { p1: [], p2: [] };
  // Las que ya salieron y no tienen que volver al mazo (sin "queda en el mazo").
  let spent = new Set();
  let match = null;

  function newMatch() {
    queue = { p1: [], p2: [] };
    spent = new Set();
    ui.restart({
      mode: 'cpu',
      axie: setup.axie,
      evolved: recordOf(readProgress(), setup.axie).evolved,
      difficulty: setup.difficulty,
      boosts: {},
      activePowers: [...CLASS_POWER_IDS, ...NEUTRAL_POWERS],
    });
  }

  const panel = document.createElement('aside');
  panel.className = 'sbx';
  panel.setAttribute('aria-label', tr('Zona de testeo'));
  document.body.appendChild(panel);

  const seatName = (s) => (game.state ? seatVoice(game.state, s).short : s);

  function symbolsHtml() {
    return SYMBOL_IDS.map((s) => `
      <button type="button" class="sbx-sym" data-sym="${s}" aria-pressed="${pick.symbols.has(s)}"
        style="--sym:${SYMBOLS[s].color}" title="${esc(SYMBOLS[s].name)}">${crest(s)}</button>`).join('');
  }

  function powersHtml() {
    const none = `<button type="button" class="sbx-pow sbx-pow--none" data-pow="" aria-pressed="${!pick.power}">${tr('Sin poder')}</button>`;
    return none + POWER_IDS.map((id) => `
      <button type="button" class="sbx-pow" data-pow="${id}" aria-pressed="${pick.power === id}"
        title="${esc(POWERS[id].name)}">${powerIcon(id)}</button>`).join('');
  }

  function cardHtml(card, extra = '') {
    return `<span class="sbx-card">${card.symbols.map((s) => crest(s)).join('')}${card.power ? powerIcon(card.power) : ''}${extra}</span>`;
  }

  function fxHtml() {
    return Object.entries(POWER_FX).map(([power, moments]) => `
      <div class="sbx-fxrow">
        <span class="sbx-fxname">${powerIcon(power)} ${esc(POWERS[power].name)}</span>
        <span class="sbx-fxbtns">${Object.keys(moments).map((m) => `
          <button type="button" class="sbx-btn sbx-btn--sm" data-fx="${power}:${m}">${MOMENTS[m] ?? m}</button>`).join('')}
        </span>
      </div>`).join('');
  }

  function statusHtml() {
    return PLAYERS.map((s) => `
      <fieldset class="sbx-seat" data-seat="${s}">
        <legend>${esc(seatName(s))}</legend>
        <label class="sbx-field sbx-field--hp">${tr('Vida')}
          <input type="number" min="0" data-hp="${s}" inputmode="numeric">
        </label>
        <span class="sbx-quick">
          <button type="button" class="sbx-btn sbx-btn--sm" data-hpset="${s}:max">${tr('Llena')}</button>
          <button type="button" class="sbx-btn sbx-btn--sm" data-hpset="${s}:20">20</button>
          <button type="button" class="sbx-btn sbx-btn--sm" data-hpset="${s}:1">1</button>
        </span>
        ${STATUS_FIELDS.map(([key, label]) => `
          <label class="sbx-field">${label}
            <input type="number" min="0" data-status="${s}:${key}" inputmode="numeric">
          </label>`).join('')}
      </fieldset>`).join('');
  }

  panel.innerHTML = `
    <header class="sbx-head">
      <strong>${tr('Zona de testeo')}</strong>
      ${FREE_PLAY ? `<button type="button" class="sbx-btn sbx-btn--sm" data-act="back">${tr('Volver al juego')}</button>` : ''}
      <button type="button" class="sbx-btn sbx-btn--sm" data-act="fold" aria-expanded="true">—</button>
    </header>
    <div class="sbx-body">
      <details open>
        <summary>${tr('Carta')}</summary>
        <div class="sbx-seg" role="group" aria-label="${tr('Para quién')}">
          ${PLAYERS.map((s) => `<button type="button" data-seat-pick="${s}" aria-pressed="${pick.seat === s}"></button>`).join('')}
        </div>
        <p class="sbx-label">${tr('Símbolos')}</p>
        <div class="sbx-syms">${symbolsHtml()}</div>
        <p class="sbx-label">${tr('Poder')}</p>
        <div class="sbx-pows">${powersHtml()}</div>
        <div class="sbx-preview" data-preview></div>
        <label class="sbx-check"><input type="checkbox" data-keep> ${tr('Queda en el mazo después de salir')}</label>
        <div class="sbx-actions">
          <button type="button" class="sbx-btn sbx-btn--go" data-act="draw">${tr('Robar esta')}</button>
          <button type="button" class="sbx-btn" data-act="queue">${tr('Arriba del mazo')}</button>
          <button type="button" class="sbx-btn" data-act="market">${tr('Al centro')}</button>
          <button type="button" class="sbx-btn" data-act="bag">${tr('Mochila ×{n}', { n: MERGE_COPIES })}</button>
        </div>
        <p class="sbx-label">${tr('Próximos robos')}</p>
        <ol class="sbx-queue" data-queue></ol>
      </details>
      <details>
        <summary>${tr('Vida y estados')}</summary>
        <div class="sbx-status">${statusHtml()}</div>
      </details>
      <details>
        <summary>${tr('Animaciones de los poderes')}</summary>
        <p class="sbx-note">${tr('Solo la animación, sobre el asiento elegido arriba: no cambia la partida.')}</p>
        <div class="sbx-fx">${fxHtml()}
          <div class="sbx-fxrow">
            <span class="sbx-fxname">${powerIcon('feather')} ${esc(POWERS.feather.name)}</span>
            <span class="sbx-fxbtns"><button type="button" class="sbx-btn sbx-btn--sm" data-fx="feather:draw">${MOMENTS.draw}</button></span>
          </div>
        </div>
      </details>
      <details>
        <summary>${tr('Partida')}</summary>
        <label class="sbx-field sbx-field--wide">${tr('Tu Axie')}
          <select data-setup="axie">${AXIE_IDS.map((id) => `<option value="${id}">${esc(AXIES[id].name)} · ${esc(SYMBOLS[AXIES[id].class].name)}</option>`).join('')}</select>
        </label>
        <label class="sbx-field sbx-field--wide">${tr('Dificultad')}
          <select data-setup="difficulty">${Object.entries(DIFFICULTY_LABELS).map(([id, label]) =>
            `<option value="${id}"${id === setup.difficulty ? ' selected' : ''}>${label}</option>`).join('')}</select>
        </label>
        <button type="button" class="sbx-btn sbx-btn--go" data-act="restart">${tr('Nueva partida')}</button>
        <p class="sbx-note">${tr('Sin reloj y con todos los poderes en la reserva.')}</p>
      </details>
      <details>
        <summary>${tr('Evolución')}</summary>
        <p class="sbx-note">${tr('Del Axie elegido en Partida: su nivel, sus evoluciones y tus Moonshards.')}</p>
        <p class="sbx-note" data-evo-now></p>
        <div class="sbx-fxbtns">
          <button type="button" class="sbx-btn sbx-btn--sm" data-evo="1">${tr('+1 nivel')}</button>
          <button type="button" class="sbx-btn sbx-btn--sm" data-evo="10">${tr('+10 niveles')}</button>
          <button type="button" class="sbx-btn sbx-btn--sm" data-evo="max">${tr('Nivel 60')}</button>
          <button type="button" class="sbx-btn sbx-btn--sm" data-evo="shards">${tr('+1.000 Moonshards')}</button>
          <button type="button" class="sbx-btn sbx-btn--sm" data-evo="reset">${tr('Sin evoluciones')}</button>
        </div>
        <div class="sbx-fxbtns">
          <button type="button" class="sbx-btn sbx-btn--go" data-evo="evolve">${tr('Abrir su evolución')}</button>
          <button type="button" class="sbx-btn sbx-btn--go" data-evo="taller">${tr('Abrir el Taller')}</button>
          <button type="button" class="sbx-btn sbx-btn--go" data-evo="bag">${tr('Abrir la mochila')}</button>
        </div>
      </details>
    </div>`;

  const $ = (sel) => panel.querySelector(sel);

  // En el teléfono el panel tapa los botones de la mesa: arranca plegado.
  function fold(on) {
    panel.classList.toggle('is-folded', on);
    const btn = panel.querySelector('[data-act="fold"]');
    btn.setAttribute('aria-expanded', String(!on));
    btn.textContent = on ? '+' : '—';
  }
  if (globalThis.matchMedia?.('(max-width: 640px)').matches) fold(true);
  const $$ = (sel) => [...panel.querySelectorAll(sel)];

  const built = () => [...pick.symbols];

  function paintPick() {
    for (const b of $$('[data-seat-pick]')) {
      b.textContent = seatName(b.dataset.seatPick);
      b.setAttribute('aria-pressed', String(b.dataset.seatPick === pick.seat));
    }
    for (const b of $$('[data-sym]')) b.setAttribute('aria-pressed', String(pick.symbols.has(b.dataset.sym)));
    for (const b of $$('[data-pow]')) b.setAttribute('aria-pressed', String((b.dataset.pow || null) === pick.power));
    const syms = built();
    const name = pick.power ? POWERS[pick.power].name : tr('Sin poder');
    $('[data-preview]').innerHTML = syms.length
      ? `${cardHtml({ symbols: syms, power: pick.power })}<span class="sbx-note">${esc(name)}</span>`
      : `<span class="sbx-note">${tr('Elegí al menos un símbolo.')}</span>`;
    for (const b of $$('[data-act="draw"], [data-act="queue"], [data-act="market"]')) b.disabled = !syms.length;
    // Una carta de la mochila trae de uno a tres símbolos (ver `cleanExtra`).
    $('[data-act="bag"]').disabled = !syms.length || syms.length > 3;
    // Robar a mano solo lo puede el asiento que se juega con botones.
    $('[data-act="draw"]').hidden = pick.seat !== 'p1';
  }

  function paintQueue() {
    const list = queue[pick.seat];
    $('[data-queue]').innerHTML = list.length
      ? list.map((c, i) => `<li>${cardHtml(c)}<button type="button" class="sbx-x" data-drop="${i}" aria-label="${tr('Sacar')}">×</button></li>`).join('')
      : `<li class="sbx-note">${tr('Nada: sale lo que diga el mazo.')}</li>`;
  }

  function paintStatus() {
    const state = game.state;
    if (!state) return;
    for (const s of PLAYERS) {
      const leg = $(`[data-seat="${s}"] legend`);
      if (leg) leg.textContent = seatName(s);
      const hp = $(`[data-hp="${s}"]`);
      if (hp && document.activeElement !== hp) hp.value = hpOf(state, s);
      for (const [key] of STATUS_FIELDS) {
        const input = $(`[data-status="${s}:${key}"]`);
        if (input && document.activeElement !== input) input.value = state.status[s][key] ?? 0;
      }
    }
  }

  /**
   * Deja las cartas de la cola arriba de todo del mazo, la primera en el tope (el mazo
   * se roba con `pop`). Las que ya no están en el mazo salieron: se van de la cola.
   */
  function settle() {
    const state = game.state;
    if (!state) return;
    for (const s of PLAYERS) {
      const deck = state.decks[s];
      queue[s] = queue[s].filter((c) => {
        if (deck.includes(c)) return true;
        if (!c.sbxKeep) spent.add(c.uid);
        return false;
      });
      const waiting = new Set(queue[s]);
      const rest = deck.filter((c) => !waiting.has(c) && !spent.has(c.uid));
      state.decks[s] = [...rest, ...queue[s].slice().reverse()];
    }
  }

  function makeOne() {
    const card = makeCard(built(), pick.power);
    card.sbxKeep = pick.keep;
    return card;
  }

  function enqueue(first) {
    const state = game.state;
    if (!state) return null;
    const card = makeOne();
    if (first) queue[pick.seat].unshift(card);
    else queue[pick.seat].push(card);
    state.decks[pick.seat].push(card);
    settle();
    paintQueue();
    return card;
  }

  /**
   * La carta fabricada, tres veces suelta en la mochila: lo justo para una fusión. El
   * botón lo dice un momento.
   */
  function toBackpack(btn) {
    const card = { symbols: built(), power: pick.power };
    writeBackpack(addToBackpack(readBackpack(), Array.from({ length: MERGE_COPIES }, () => card)));
    btn.textContent = tr('¡En la mochila!');
    setTimeout(() => { btn.textContent = tr('Mochila ×{n}', { n: MERGE_COPIES }); }, 1200);
  }

  function toMarket() {
    const state = game.state;
    if (!state) return;
    state.market.unshift(makeOne());
    while (state.market.length > MARKET_SIZE) state.pool.push(state.market.pop());
    game.refresh();
  }

  function setHp(seat, value) {
    const state = game.state;
    if (!state) return;
    const max = maxHpOf(state, seat);
    const hp = Math.max(0, Math.min(max, Math.round(Number(value) || 0)));
    state.healed[seat] = 0;
    state.totals[other(seat)] = max - hp;
    game.refresh();
  }

  function setStatus(seat, key, value) {
    const state = game.state;
    if (!state) return;
    state.status[seat][key] = Math.max(0, Math.round(Number(value) || 0));
    game.refresh();
  }

  /** Solo la animación de un poder, anotada como la anota la partida (ver `stageFx`). */
  function playFx(power, moment) {
    const state = game.state;
    if (!state) return;
    const me = pick.seat;
    if (power === 'feather') {
      state.lastHit = {
        id: ++state.hitId, by: me, target: other(me), amount: 6, blocked: 0, broke: false, kind: 'feather',
      };
      game.refresh();
      return;
    }
    const aim = AIM[`${power}:${moment}`];
    const by = aim === 'hit' ? other(me) : me;
    const on = aim === 'foe' ? other(me) : me;
    const fx = { power, moment, by, on, amount: AMOUNT[power] ?? 1 };
    if (power === 'leech') fx.heal = fx.amount;
    if (power === 'pillow' && moment === 'block') fx.mitigated = 6;
    state.powerFx = { id: ++state.powerFxId, player: by, fx: [fx] };
    game.refresh();
  }

  panel.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t || t.disabled) return;
    if (t.dataset.seatPick) { pick.seat = t.dataset.seatPick; paintPick(); paintQueue(); return; }
    if (t.dataset.sym) {
      const s = t.dataset.sym;
      if (pick.symbols.has(s)) pick.symbols.delete(s); else pick.symbols.add(s);
      return paintPick();
    }
    if (t.dataset.pow !== undefined) { pick.power = t.dataset.pow || null; return paintPick(); }
    if (t.dataset.drop !== undefined) {
      const [card] = queue[pick.seat].splice(Number(t.dataset.drop), 1);
      // Una carta sacada de la cola sale del mazo: nunca fue del jugador.
      if (card) spent.add(card.uid);
      settle();
      paintQueue();
      return;
    }
    if (t.dataset.hpset) {
      const [seat, v] = t.dataset.hpset.split(':');
      return setHp(seat, v === 'max' ? Infinity : v);
    }
    if (t.dataset.fx) return playFx(...t.dataset.fx.split(':'));
    if (t.dataset.evo) return evo(t.dataset.evo);
    const act = t.dataset.act;
    if (act === 'fold') fold(!panel.classList.contains('is-folded'));
    else if (act === 'back') location.href = `${location.pathname}?libre`;
    else if (act === 'queue') enqueue(false);
    else if (act === 'draw') {
      if (enqueue(true)) game.hit();
    } else if (act === 'market') toMarket();
    else if (act === 'bag') toBackpack(t);
    else if (act === 'restart') newMatch();
  });

  panel.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-keep]')) pick.keep = t.checked;
    else if (t.dataset.hp) setHp(t.dataset.hp, t.value);
    else if (t.dataset.status) {
      const [seat, key] = t.dataset.status.split(':');
      setStatus(seat, key, t.value);
    } else if (t.dataset.setup) {
      setup[t.dataset.setup] = t.value;
      paintEvo();
    }
  });

  // Las teclas del panel no son de la mesa (Enter, espacio, las flechas).
  panel.addEventListener('keydown', (e) => e.stopPropagation());

  /** Lo que dice el panel de la evolución del Axie elegido. */
  function paintEvo() {
    const now = $('[data-evo-now]');
    if (!now) return;
    const record = recordOf(readProgress(), setup.axie);
    now.textContent = tr('{name}: nivel {level} · {n} evolucionadas · {shards} Moonshards', {
      name: AXIES[setup.axie].name,
      level: levelInfo(record.axp).level,
      n: record.evolved.length,
      shards: readWallet().moonshards,
    });
  }

  /** Los botones de la evolución: escriben lo guardado, como lo haría el juego. */
  function evo(what) {
    if (what === 'taller') return lobby?.open('craft');
    if (what === 'bag') return lobby?.open('bag');
    if (what === 'evolve') return lobby?.open('evolve', { axie: setup.axie });
    let progress = readProgress();
    let wallet = readWallet();
    const record = recordOf(progress, setup.axie);
    const level = levelInfo(record.axp).level;
    const to = { 1: level + 1, 10: level + 10, max: MAX_LEVEL }[what];
    if (to) {
      ({ progress, wallet } = gainAxp(progress, wallet, setup.axie, axpAt(Math.min(to, MAX_LEVEL)) - record.axp));
    } else if (what === 'shards') {
      wallet = { ...wallet, moonshards: wallet.moonshards + 1000 };
    } else if (what === 'reset') {
      progress = { ...progress, [setup.axie]: { ...record, evolved: [] } };
    }
    writeProgress(progress);
    writeWallet(wallet);
    paintEvo();
  }

  game.subscribe((state) => {
    if (state.match !== match) {
      match = state.match;
      queue = { p1: [], p2: [] };
      spent = new Set();
      setup.axie = String(state.axies.p1).split('~')[0];
      const sel = $('[data-setup="axie"]');
      if (sel) sel.value = setup.axie;
    }
    settle();
    paintPick();
    paintQueue();
    paintStatus();
    paintEvo();
  });

  newMatch();
  return { panel, newMatch };
}
