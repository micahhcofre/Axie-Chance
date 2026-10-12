// La evolución de una carta, en grande (ver `evolve-view.js`): el momento que se paga.
//
// Es una escena corta con cinco tiempos, los de `EVOLVE_BEAT`:
//
//   charge  el Axie se carga: el clip `evolve` del kit (se aprieta, parpadea, abre la
//           boca), motas de luz del color de su clase que le caen encima y el hechizo
//           de Dawn que sube (`evolveCharge`).
//   burst   el destello: un blanco que tapa todo un instante, la onda que se abre y el
//           estallido (`evolve`). Detrás quedan girando los rayos.
//   swap    en lo más blanco cambia el dibujo: el Axie ya es el evolucionado y la parte
//           que evolucionó se enciende sola. Festeja.
//   title   el cartel: ¡EVOLUCIÓN! con la letra de los carteles grandes, y qué parte.
//   card    la carta de esa parte aparece abajo, le vuela encima un orbe con el símbolo
//           nuevo —sale de la parte, que es de donde viene— y al llegar la carta se da
//           vuelta con el símbolo de más (`take`, el ruido de algo que entra).
//   end     lo que ganó en una chapa y el botón de seguir.
//
// El JS solo marca cada tiempo con una clase (`is-charge`, `is-burst`…) que se van
// sumando; el movimiento es del CSS, todo `transform` y `opacity`, y nada se repite
// para siempre salvo los rayos de atrás, que giran con `transform`. Con el sistema
// pidiendo menos movimiento se muestra directo el final.
import { axie, axieArt } from './axies.js';
import { createMotion } from './axie-motion.js';
import { SYMBOLS, PART_NAMES, crest } from './data.js';
import { sheetCardHtml } from './ui.js';
import { tr } from './i18n.js';

/** Cuándo empieza cada tiempo, en ms desde que se abre la escena. */
export const EVOLVE_BEAT = { charge: 250, burst: 1750, swap: 1880, title: 2250, card: 2750, flip: 3350, end: 3900 };

/** Las motas de luz que le caen al Axie mientras se carga. */
const MOTES = 18;

/** Los slots del dibujo que son de cada parte (ver `PART_OF_SLOT` en `scripts/starters.mjs`). */
const SLOTS_OF = { ears: ['ear-left', 'ear-right'] };
const slotsOf = (part) => SLOTS_OF[part] ?? [part];

/**
 * Muestra la evolución de la carta de `part`, del Axie `from` (su id con lo que tenía
 * evolucionado) al `to`. `before` y `after` son la carta antes y después; `symbol`, el
 * que sumó; `step`, cuántas lleva con esta (1 a 6). Devuelve una promesa que se
 * cumple cuando el jugador toca seguir.
 *
 * @param {{host: HTMLElement, from: string, to: string, part: string, before: object,
 *   after: object, symbol: string, step: number, audio?: object}} opts
 */
export function playEvolution({ host, from, to, part, before, after, symbol, step, audio = null }) {
  if (!host) return Promise.resolve();
  const a = axie(to);
  const sym = SYMBOLS[symbol];
  const quiet = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const motes = Array.from({ length: MOTES }, (_, i) => {
    const angle = (360 / MOTES) * i + (i % 3) * 7;
    const reach = 34 + ((i * 37) % 26);
    const delay = (i * 53) % 900;
    return `<i class="evo-mote" style="--a:${angle}deg;--r:${reach}vmin;--d:${delay}ms"></i>`;
  }).join('');

  host.innerHTML = `
    <div class="evo" style="--c:${SYMBOLS[a.class].color};--s:${sym.color}" role="dialog" aria-modal="true"
      aria-label="${tr('Evolución')}">
      <div class="evo-sky" aria-hidden="true"><i class="evo-glow"></i><i class="evo-rays"></i></div>
      <div class="evo-stage">
        <i class="evo-ring" aria-hidden="true"></i>
        <div class="evo-axie" id="evo-axie">${axieArt(from)}</div>
        <div class="evo-motes" aria-hidden="true">${motes}</div>
      </div>
      <h2 class="evo-word">${tr('¡Evolución!')}</h2>
      <p class="evo-sub">${tr('{part} de {name}', { part: PART_NAMES[part], name: a.name })}</p>
      <div class="evo-card" id="evo-card">
        <div class="evo-face evo-face--before">${sheetCardHtml(before)}</div>
        <div class="evo-face evo-face--after">${sheetCardHtml(after)}</div>
      </div>
      <i class="evo-orb" id="evo-orb" aria-hidden="true">${crest(symbol)}</i>
      <p class="evo-gain"><span class="evolve-gain" style="--c:${sym.color}">+${crest(symbol)}<span>${sym.name}</span></span>
        <small>${tr('Evolución {n}/6', { n: step })}</small></p>
      <button class="lobby-play evo-go" id="evo-go">${tr('Seguir')}</button>
      <i class="evo-flash" aria-hidden="true"></i>
    </div>`;
  host.hidden = false;
  const root = host.firstElementChild;
  const stage = host.querySelector('#evo-axie');
  const motion = createMotion(stage, 0, { fidget: [2600, 5200] });
  motion.mount(from);

  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const mark = (name) => root.classList.add(`is-${name}`);

  /** El dibujo nuevo, con la parte que evolucionó encendida. */
  function swap() {
    stage.innerHTML = axieArt(to);
    motion.mount(to);
    for (const slot of slotsOf(part)) {
      for (const img of stage.querySelectorAll(`img[data-part="${slot}@2"], img[data-part="${slot}"]`)) {
        if (!img.classList.contains('axie-alt')) img.classList.add('evo-lit');
      }
    }
  }

  /**
   * El orbe vuela de la parte a la carta: se mide una vez dónde están las dos (no por
   * cuadro) y el CSS lo lleva de un punto al otro.
   */
  function aim() {
    const box = root.getBoundingClientRect();
    const lit = stage.querySelector('.evo-lit') ?? stage;
    const p = lit.getBoundingClientRect();
    const c = host.querySelector('#evo-card').getBoundingClientRect();
    const orb = host.querySelector('#evo-orb');
    orb.style.setProperty('--x0', `${p.left + p.width / 2 - box.left}px`);
    orb.style.setProperty('--y0', `${p.top + p.height / 2 - box.top}px`);
    orb.style.setProperty('--x1', `${c.left + c.width / 2 - box.left}px`);
    orb.style.setProperty('--y1', `${c.top + c.height / 2 - box.top}px`);
  }

  if (quiet) {
    swap();
    ['charge', 'burst', 'swap', 'title', 'card', 'flip', 'end'].forEach(mark);
    root.classList.add('is-quiet');
    audio?.sfx?.('evolve');
  } else {
    at(EVOLVE_BEAT.charge, () => {
      mark('charge');
      motion.pulse('evolve');
      audio?.sfx?.('evolveCharge');
    });
    at(EVOLVE_BEAT.burst, () => {
      mark('burst');
      audio?.sfx?.('evolve');
    });
    at(EVOLVE_BEAT.swap, () => {
      mark('swap');
      swap();
      motion.pulse('cheer');
    });
    at(EVOLVE_BEAT.title, () => mark('title'));
    at(EVOLVE_BEAT.card, () => {
      mark('card');
      aim();
    });
    at(EVOLVE_BEAT.flip, () => {
      mark('flip');
      audio?.sfx?.('take');
    });
    at(EVOLVE_BEAT.end, () => {
      mark('end');
      host.querySelector('#evo-go')?.focus?.({ preventScroll: true });
    });
  }

  return new Promise((resolve) => {
    const close = () => {
      for (const t of timers) clearTimeout(t);
      motion.stop();
      host.hidden = true;
      host.innerHTML = '';
      host.removeEventListener('click', onClick);
      host.removeEventListener('keydown', onKey);
      resolve();
    };
    // Se cierra con el botón, o tocando la pantalla una vez que ya está todo a la vista.
    const onClick = (e) => {
      if (e.target.closest?.('#evo-go') || root.classList.contains('is-end')) close();
    };
    const onKey = (e) => {
      if ((e.key === 'Escape' || e.key === 'Enter') && root.classList.contains('is-end')) close();
    };
    host.addEventListener('click', onClick);
    host.addEventListener('keydown', onKey);
  });
}
