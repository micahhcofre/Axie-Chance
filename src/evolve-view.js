// La evolución de un Axie: sus cartas favorables, de a una, con lo que cuesta cada paso
// (ver `evolution.js`).
//
// Se abre desde la elección de Axies, sobre el que estás mirando: es una puerta más de
// su vista previa, al lado del inventario. Arriba él, con su nivel, su barra de
// experiencia y las seis evoluciones que se abren de a diez niveles, y la rueda de
// símbolos de su mazo con sus porcentajes. Al lado, sus seis cartas favorables: cada una
// es una parte del cuerpo, y debajo de cada una el símbolo que sumaría al evolucionar,
// que es el de **la clase de esa parte**. Se toca una y la rueda pasa a mostrar el mazo
// como quedaría, con cuántos puntos sube o baja cada símbolo; debajo, la carta antes y
// después y el botón, que dice lo que cuesta o por qué todavía no se puede.
//
// Evolucionar es un momento (ver `evolve-scene.js`): el Axie se carga, cambia, y la
// carta suma su símbolo. Después la pantalla ya lo muestra evolucionado, y la portada
// se entera por `onEvolved` (la colección, tu Axie en la barra y el mazo con que jugás).
import { AXIE_IDS, axie, axieArt, deckFor, evolvedId } from './axies.js';
import { createMotion } from './axie-motion.js';
import { SYMBOLS, PART_NAMES, crest } from './data.js';
import { sheetCardHtml, symbolTally, mixPercents, deckMixHtml } from './ui.js';
import { tr } from './i18n.js';
import { readBackpack, equippedOn } from './backpack.js';
import {
  EVOLVE_COSTS, EVOLVE_STEP, readProgress, writeProgress, readWallet, writeWallet, recordOf, levelInfo,
  nextEvolution, evolveBlock, evolveCard, evolveSymbol, playingId, shardAmount, shardsHtml,
} from './evolution.js';
import { playEvolution } from './evolve-scene.js';

const evEl = (id) => document.getElementById(id);

/** Un símbolo como chapa con su color: `+ Planta`. */
const gainHtml = (sym) =>
  `<span class="evolve-gain" style="--c:${SYMBOLS[sym].color}">+${crest(sym)}<span>${SYMBOLS[sym].name}</span></span>`;

/**
 * Las seis cartas favorables de un Axie tal como juega, en el orden de su mazo, con lo
 * que hace falta para pintarlas: la parte, si ya evolucionó y qué símbolo suma.
 */
function benchCards(progress, id) {
  const record = recordOf(progress, id);
  return deckFor(playingId(progress, id))
    .filter((c) => c.isFavorable)
    .map((card) => ({
      card,
      part: card.associatedPart,
      evolved: record.evolved.includes(card.associatedPart),
      symbol: evolveSymbol(id, card.associatedPart),
    }));
}

/** El porcentaje de un símbolo en una cuenta del mazo (0 si no está). */
function shareOf(tally, symbol) {
  const i = tally.findIndex((x) => x.symbol === symbol);
  return i < 0 ? 0 : mixPercents(tally)[i];
}

/**
 * La evolución, montada sobre el HTML de `#lobby-evolve`.
 *
 * @param {{audio?: object, onEvolved?: (id: string) => void}} opts  `audio` es el
 *   mezclador de la mesa (ver `audio.js`); `onEvolved` avisa a la portada que un Axie
 *   cambió, para que repinte lo que lo muestra y guarde el mazo con que jugás.
 */
export function createEvolveView({ audio = null, onEvolved = null } = {}) {
  const root = evEl('lobby-evolve');
  const scene = evEl('evolve-scene');
  if (!root) return { open() {}, stop() {}, refresh() {} };
  const art = evEl('evolve-art');
  const motion = createMotion(art, 0);
  /** El Axie que se está evolucionando. */
  let id = AXIE_IDS[0];
  /** La parte de la carta elegida. */
  let part = null;
  let progress = {};
  let wallet = { moonshards: 0 };
  /** Las cartas de la mochila que lleva puestas: cuentan en la rueda, como en el inventario. */
  let extras = [];
  /** El dibujo que está puesto, para no volver a montarlo si no cambió. */
  let shown = null;
  /** Mientras dura la evolución en grande no se toca nada. */
  let busy = false;

  /** La carta que se elige al entrar: la primera sin evolucionar. */
  const firstOpen = (cards) => (cards.find((c) => !c.evolved) ?? cards[0])?.part ?? null;

  function paintArt() {
    const look = playingId(progress, id);
    if (look === shown) return;
    shown = look;
    const a = axie(id);
    art.innerHTML = axieArt(look);
    art.style.setProperty('--c', SYMBOLS[a.class].color);
    art.dataset.arena = a.class;
    motion.mount(look);
  }

  function paint() {
    const a = axie(id);
    const record = recordOf(progress, id);
    const info = levelInfo(record.axp);
    const sym = SYMBOLS[a.class];
    const cards = benchCards(progress, id);
    if (!cards.some((c) => c.part === part)) part = firstOpen(cards);

    evEl('evolve-shards').textContent = shardAmount(wallet.moonshards);
    evEl('evolve-purse').title = tr('{n} Moonshards', { n: shardAmount(wallet.moonshards) });
    paintArt();

    evEl('evolve-id').innerHTML = `<b class="choose-name">${a.name}</b>
      <span class="choose-tags">
        <span class="choose-lvl" title="${tr('Nivel {n}', { n: info.level })}">${tr('LVL')} <b>${info.level}</b></span>
        <span class="choose-class" style="--c:${sym.color}">${crest(a.class)}${sym.name}</span>
      </span>`;

    const bar = evEl('evolve-xp');
    evEl('evolve-xp-fill').style.setProperty('--fill', info.frac.toFixed(3));
    evEl('evolve-xp-text').textContent = info.max ? tr('Nivel máximo') : `${shardAmount(info.into)} / ${shardAmount(info.need)} AXP`;
    bar.setAttribute('aria-valuenow', String(Math.round(info.frac * 100)));
    bar.setAttribute('aria-valuetext', info.max
      ? tr('Nivel máximo')
      : tr('{into} de {need} de experiencia', { into: info.into, need: info.need }));

    // Las seis evoluciones: hechas, abiertas (el nivel ya llegó) o cerradas.
    const done = record.evolved.length;
    evEl('evolve-track').innerHTML = EVOLVE_COSTS.map((cost, i) => {
      const at = (i + 1) * EVOLVE_STEP;
      const state = i < done ? 'done' : info.level >= at ? 'open' : 'locked';
      const label = state === 'done'
        ? tr('Evolución {n}: hecha', { n: i + 1 })
        : tr('Evolución {n}: nivel {level} · {cost} Moonshards', { n: i + 1, level: at, cost: shardAmount(cost) });
      return `<li class="evolve-step" data-state="${state}" title="${label}" aria-label="${label}">
        <span class="evolve-step-dot">${state === 'done' ? '✓' : at}</span></li>`;
    }).join('');

    const next = nextEvolution(record);
    const open = next && info.level >= next.level;
    evEl('evolve-next').innerHTML = !next
      ? tr('Las seis cartas evolucionaron')
      : open
        ? tr('¡Evolución disponible!')
        : tr('Próxima evolución en el nivel {n}', { n: next.level });
    evEl('evolve-next').dataset.open = String(Boolean(open));

    evEl('evolve-cards-label').textContent =
      tr('Cartas favorables · {n}/6 evolucionadas', { n: done });
    evEl('evolve-deck').innerHTML = cards.map((c) => `
      <button class="evolve-slot" data-evolve-part="${c.part}" aria-pressed="${c.part === part}"
        data-evolved="${c.evolved}" title="${PART_NAMES[c.part]}">
        <span class="evolve-part">${PART_NAMES[c.part]}</span>
        ${sheetCardHtml(c.card)}
        ${c.evolved
          ? `<span class="evolve-tag is-done" title="${tr('Evolucionada')}"><span class="evolve-done-word">${tr('Evolucionada')}</span><b class="evolve-done-mark" aria-hidden="true">✓</b></span>`
          : `<span class="evolve-tag">${gainHtml(c.symbol)}</span>`}
      </button>`).join('');

    paintPick(cards, record);
  }

  /**
   * La rueda del mazo entero —con las cartas de la mochila, como en el inventario— y la
   * carta elegida: cómo está, cómo queda y el botón. Con una carta sin evolucionar
   * elegida, la rueda es la del mazo evolucionado y dice cuánto cambia cada símbolo.
   */
  function paintPick(cards, record) {
    const box = evEl('evolve-pick');
    const pick = cards.find((c) => c.part === part);
    const now = symbolTally([...deckFor(playingId(progress, id)), ...extras]);
    if (!pick || pick.evolved) {
      evEl('evolve-mix-label').textContent = tr('Símbolos del mazo');
      evEl('evolve-mix').innerHTML = deckMixHtml(now);
    }
    if (!pick) return void (box.innerHTML = '');
    const name = PART_NAMES[pick.part];
    if (pick.evolved) {
      box.innerHTML = `<div class="evolve-pick-cards evolve-pick-after">${sheetCardHtml(pick.card)}</div>
        <div class="evolve-pick-info">
          <p class="evolve-pick-title">${tr('{part} · evolucionada', { part: name })}</p>
          <p class="evolve-pick-note">${tr('Suma {symbol} a tu mazo.', { symbol: gainHtml(pick.symbol) })}</p>
        </div>`;
      return;
    }
    const deckAfter = deckFor(evolvedId(id, [...record.evolved, pick.part]));
    const after = deckAfter.find((c) => c.associatedPart === pick.part);
    const then = symbolTally([...deckAfter, ...extras]);
    evEl('evolve-mix-label').textContent = tr('Tu mazo al evolucionar: {part}', { part: name });
    evEl('evolve-mix').innerHTML = deckMixHtml(then, { from: now });
    const next = nextEvolution(record);
    const block = evolveBlock(record, wallet, pick.part);
    const reason = {
      level: () => tr('Se abre en el nivel {n}', { n: next.level }),
      shards: () => tr('Te faltan {n} Moonshards', { n: shardAmount(next.cost - wallet.moonshards) }),
      done: () => tr('Las seis cartas evolucionaron'),
    }[block]?.() ?? '';
    box.innerHTML = `<div class="evolve-pick-cards">
        ${sheetCardHtml(pick.card)}
        <span class="evolve-pick-arrow" aria-hidden="true">➜</span>
        <span class="evolve-pick-after">${sheetCardHtml(after)}</span>
      </div>
      <div class="evolve-pick-info">
        <p class="evolve-pick-title">${tr('Evolucionar: {part}', { part: name })}</p>
        <p class="evolve-pick-note">${tr('La parte es de {class}: la carta suma ese símbolo.', { class: gainHtml(pick.symbol) })}</p>
        <p class="evolve-pick-share">${tr('{symbol} en tu mazo: {from}% → {to}%', {
          symbol: SYMBOLS[pick.symbol].name, from: shareOf(now, pick.symbol), to: shareOf(then, pick.symbol),
        })}</p>
        <button class="lobby-play evolve-go" id="evolve-go" ${block ? 'disabled' : ''}>
          <span>${tr('Evolucionar')}</span>${next ? shardsHtml(next.cost) : ''}
        </button>
        ${reason ? `<p class="evolve-why">${reason}</p>` : ''}
      </div>`;
  }

  /** Evoluciona la carta elegida y lo muestra en grande. */
  async function evolveNow() {
    if (busy) return;
    const record = recordOf(progress, id);
    if (evolveBlock(record, wallet, part)) return;
    const before = deckFor(playingId(progress, id)).find((c) => c.associatedPart === part);
    const from = playingId(progress, id);
    const next = evolveCard(progress, wallet, id, part);
    progress = next.progress;
    wallet = next.wallet;
    writeProgress(progress);
    writeWallet(wallet);
    const to = playingId(progress, id);
    const after = deckFor(to).find((c) => c.associatedPart === part);
    onEvolved?.(id);
    busy = true;
    motion.stop();
    try {
      await playEvolution({
        host: scene, from, to, part, before, after, symbol: evolveSymbol(id, part), audio,
        step: recordOf(progress, id).evolved.length,
      });
    } finally {
      busy = false;
      shown = null;
      // La que sigue: la próxima sin evolucionar.
      part = null;
      paint();
    }
  }

  root.addEventListener('click', (e) => {
    if (busy) return;
    const t = e.target;
    const slot = t.closest?.('[data-evolve-part]');
    if (slot) {
      part = slot.dataset.evolvePart;
      return paint();
    }
    if (t.closest?.('#evolve-go')) evolveNow();
  });

  return {
    /** Pone la evolución de `axieId`, leyendo de nuevo lo guardado. */
    open(axieId) {
      progress = readProgress();
      wallet = readWallet();
      if (AXIE_IDS.includes(axieId) && axieId !== id) {
        id = axieId;
        part = null;
      }
      extras = equippedOn(readBackpack(), id);
      shown = null;
      paint();
    },
    /** Al salir de la pantalla: el Axie deja de respirar. */
    stop() {
      motion.stop();
    },
    /** Vuelve a leer lo guardado y repinta (la zona de testeo carga experiencia). */
    refresh() {
      progress = readProgress();
      wallet = readWallet();
      extras = equippedOn(readBackpack(), id);
      paint();
    },
    /** Si la escena de la evolución está andando: mientras tanto no se sale. */
    get busy() {
      return busy;
    },
    /** El Axie de la pantalla. */
    get axie() {
      return id;
    },
  };
}
