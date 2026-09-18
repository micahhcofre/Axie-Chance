// La pantalla del final: cómo terminó la partida, contado con una escena propia para
// cada respuesta.
//
// Antes el final era una palabra grande en el medio de la mesa, con papelitos si
// ganabas. Alcanzaba para decir el resultado, pero ganar, perder y empatar se sentían
// igual: la misma letra en otro color. Ahora cada uno tiene su puesta en escena, con
// las piezas de las pantallas de resultado del Origins Asset Kit (`npm run result-art`):
//
//   victoria  la tela azul baja con la rama que florece, la palabra cae de golpe y
//             brilla, tu Axie salta al pedestal y festeja con el despertar dorado del
//             kit, rayos de sol girando atrás y la lluvia de papelitos.
//   derrota   la tela roja cae pesada y se hamaca con la rama seca y las telarañas, las
//             letras caen de a una y la última queda torcida, tu Axie tirado y gris con
//             la marca de la muerte encima, llovizna, y el rival festejando atrás.
//   empate    media tela azul y media roja entran desde cada costado y chocan, la
//             palabra se arma con dos mitades, un rayo en la costura, chispas, y los dos
//             Axies mareados con el aturdido del kit.
//
// El orden de la entrada vive en `RESULT_BEAT` y es uno solo: el CSS lee los mismos
// números como variables (`--t-*`) y el efecto, el sonido y los contadores se agendan
// con ellos.
//
// **El botín.** Las partidas van a dejar objetos al terminar. La pantalla ya los sabe
// mostrar: la partida los anota en `state.rewards[asiento]` y acá salen, uno detrás del
// otro, después de las marcas. Ver `rewardsOf` para la forma de cada uno.
import { tr } from './i18n.js';
import { SYMBOLS, iconUrl } from './data.js';
import { axie, axieArt } from './axies.js';
import { createMotion } from './axie-motion.js';
import { createVfx, preloadVfx } from './vfx.js';
import { matchResult, seatVoice } from './game.js';
import { DIFFICULTY_LABELS, isFinalLevel } from './adventure.js';

/**
 * Cuándo entra cada cosa, en ms, contados desde que la pantalla aparece. La pantalla
 * aparece `wait` después del final (ver `show`): el último golpe tiene que caer y el
 * que perdió, desplomarse, antes de taparlos.
 */
export const RESULT_BEAT = { sky: 80, banner: 250, title: 480, axie: 650, fx: 900, stats: 1250, loot: 1750, acts: 1900 };

/**
 * Cuándo vuelve la música de la portada, desde que la pantalla entra: apenas se apaga
 * el remate (que suena en `fx` y dura un segundo y medio). La pantalla del final ya no
 * es la partida —es la puerta a la siguiente o al menú—, y el tema que suena en todos
 * los menús entra acá para seguir sin cortes cuando se vuelve a la portada.
 */
export const RESULT_MUSIC = RESULT_BEAT.fx + 1700;

/** Lo que espera la pantalla después del final si no hay un golpe en el aire. */
export const RESULT_WAIT = 1600;

/** Cuánto tarda cada marca en contar hasta su número. */
const COUNT_MS = 900;

/** Rarezas que la pantalla sabe pintar. Una desconocida se pinta como común. */
export const RARITIES = ['common', 'rare', 'epic', 'legendary'];

/** Lo que llega por la red se escribe como texto, nunca como HTML. */
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const otherSeat = (seat) => (seat === 'p1' ? 'p2' : 'p1');

/**
 * El botín de un asiento, limpio.
 *
 * La forma de cada objeto, para cuando la partida los reparta:
 *
 *   { id: 'amuleto-hoja', name: 'Amuleto de hoja', icon: 'Icons/…png',
 *     qty: 2, rarity: 'common' | 'rare' | 'epic' | 'legendary' }
 *
 * `name` va en español y se traduce acá con `tr()`, como todo texto del juego. `qty` y
 * `rarity` son opcionales. Lo que no tenga nombre o dibujo no se muestra: en una sala
 * el estado llega de otro navegador, y un objeto a medias es peor que ninguno.
 */
export function rewardsOf(state, seat) {
  const list = state?.rewards?.[seat];
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => item && typeof item.name === 'string' && typeof item.icon === 'string')
    .map((item) => ({
      id: String(item.id ?? item.name),
      name: item.name,
      icon: item.icon,
      qty: Math.max(1, Math.floor(Number(item.qty) || 1)),
      rarity: RARITIES.includes(item.rarity) ? item.rarity : 'common',
    }));
}

/**
 * Qué cuenta la pantalla: el resultado visto desde este aparato, y todo lo que se
 * escribe. `null` mientras la partida sigue.
 *
 * El que mira es el asiento de esta pantalla (`seat`), o `p1` cuando la pantalla es de
 * uno solo —contra la CPU, la Aventura, el tutorial—. El que entró a mirar una sala
 * llena no ganó ni perdió nada: para él la escena es la del que ganó, con su nombre.
 */
export function resultView(state, { seat = null, net = false } = {}) {
  const result = matchResult(state);
  if (!result) return null;
  const me = seat ?? 'p1';
  const watching = net && !seat;
  const winner = result === 'p1' || result === 'p2' ? result : null;
  const outcome = result === 'tie' ? 'tie'
    : watching || winner === me ? 'win' : 'lose';
  // El de adelante del escenario: el tuyo, salvo que estés mirando la sala de otros.
  const hero = watching && winner ? winner : me;
  const foe = otherSeat(hero);
  const nameOf = (seatId) => axie(state.axies[seatId]).name;

  let title = { win: tr('¡Victoria!'), lose: tr('Derrota'), tie: tr('¡Empate!') }[outcome];
  if (outcome === 'win' && watching) title = tr('¡Gana {name}!', { name: seatVoice(state, winner).name });
  if (outcome === 'win' && state.mode === 'tutorial') title = tr('¡TUTORIAL COMPLETADO!');
  if (outcome === 'win' && state.mode === 'adventure') {
    title = isFinalLevel(state.adventure?.level) ? tr('¡Aventura Completada!') : tr('¡Nivel superado!');
  }

  const kicker = {
    cpu: () => tr('Contra la CPU · {level}', { level: DIFFICULTY_LABELS[state.difficulty] ?? state.difficulty }),
    adventure: () => tr('Aventura · {name}', { name: state.adventure?.name ?? tr('Nivel') }),
    tutorial: () => tr('Tutorial'),
    net: () => tr('Partida en red'),
  }[state.mode]?.() ?? '';

  // Abajo de la tela, una línea que dice cómo. Si alguien se fue, eso es lo único que
  // importa: la partida se cortó de golpe y hay que decir por qué.
  const gone = state.forfeit ? seatVoice(state, state.forfeit.by).name : null;
  const round = state.round;
  let line;
  if (gone) line = tr('{gone} abandonó la partida.', { gone });
  else if (outcome === 'win') line = tr('{name} quedó fuera de combate en la ronda {round}.', { name: nameOf(foe), round });
  else if (outcome === 'lose') line = tr('{name} te ganó en la ronda {round}.', { name: nameOf(foe), round });
  else line = tr('Doble KO en la ronda {round}.', { round });

  const records = state.records?.[hero] ?? { hit: 0, chain: 0 };
  const stats = [
    { key: 'damage', label: tr('Daño hecho'), value: state.totals?.[hero] ?? 0 },
    { key: 'hit', label: tr('Mejor golpe'), value: records.hit },
    { key: 'chain', label: tr('Cadena más larga'), value: records.chain },
    { key: 'rounds', label: tr('Rondas'), value: round },
  ];

  // Quién está en el escenario y cómo. Por abandono nadie quedó tirado.
  const down = state.forfeit ? 'idle' : 'ko';
  const cast = {
    win: [{ seat: hero, stance: 'win', role: 'hero' }],
    lose: [{ seat: hero, stance: down, role: 'hero' }, { seat: foe, stance: 'win', role: 'rival' }],
    tie: [{ seat: hero, stance: 'ko', role: 'hero' }, { seat: foe, stance: 'ko', role: 'rival' }],
  }[outcome].map((c) => ({ ...c, axie: state.axies[c.seat], color: SYMBOLS[state.symbols[c.seat]]?.color }));

  return { outcome, hero, foe, title, kicker, line, stats, cast, rewards: rewardsOf(state, me) };
}

/**
 * La palabra, letra por letra y palabra por palabra: cada letra lleva su número para
 * caer a su tiempo, y cada palabra va entera en un renglón para que "¡Nivel superado!"
 * pueda partirse entre palabras y nunca por la mitad de una.
 */
function resultWordsHtml(text) {
  let i = 0;
  return text.split(' ').map((word) => `<span class="result-w">${
    Array.from(word).map((ch) => `<span class="result-l" style="--i:${i++}">${esc(ch)}</span>`).join('')
  }</span>`).join(' ');
}

/** Los papelitos. Son papel y no luz: van en HTML y no en el canvas aditivo. */
const RESULT_CONFETTI = 46;
function resultConfettiHtml(colors) {
  const bits = [];
  for (let i = 0; i < RESULT_CONFETTI; i++) {
    const x = ((i + .5) / RESULT_CONFETTI) * 100 + (Math.random() * 5 - 2.5);
    bits.push(`<i style="${[
      `--x:${x.toFixed(2)}%`,
      `--delay:${(Math.random() * 1.5).toFixed(2)}s`,
      `--dur:${(2.4 + Math.random() * 1.9).toFixed(2)}s`,
      `--sway:${(Math.random() * 120 - 60).toFixed(0)}px`,
      `--spin:${(Math.random() * 1080 - 540).toFixed(0)}deg`,
      `--c:${colors[i % colors.length]}`,
      `--w:${(6 + Math.random() * 6).toFixed(1)}px`,
    ].join(';')}"></i>`);
  }
  return `<div class="confetti" aria-hidden="true">${bits.join('')}</div>`;
}

/** Partículas sueltas por la pantalla: brillitos, gotas o chispas según la escena. */
function resultBitsHtml(kind, count) {
  const bits = [];
  for (let i = 0; i < count; i++) {
    bits.push(`<i style="--x:${(Math.random() * 100).toFixed(1)}%;--y:${(Math.random() * 100).toFixed(1)}%;` +
      `--d:${(Math.random() * 2.4).toFixed(2)}s;--s:${(.6 + Math.random() * .8).toFixed(2)};` +
      `--a:${(Math.random() * 360).toFixed(0)}deg"></i>`);
  }
  return `<div class="result-${kind}" aria-hidden="true">${bits.join('')}</div>`;
}

/** El fondo de cada escena. */
function resultSkyHtml(view) {
  const colors = Object.values(SYMBOLS).map((s) => s.color);
  const [a, b] = [view.cast[0]?.color, view.cast[1]?.color ?? view.cast[0]?.color];
  const sky = {
    win: `<i class="result-rays"></i><i class="result-glow"></i>${resultBitsHtml('sparks', 18)}${resultConfettiHtml(colors)}`,
    lose: `<i class="result-glow"></i>${resultBitsHtml('rain', 42)}<i class="result-fog"></i>`,
    tie: `<i class="result-half result-half--l" style="--c:${a}"></i><i class="result-half result-half--r" style="--c:${b}"></i>` +
      `<svg class="result-bolt" viewBox="0 0 40 400" preserveAspectRatio="none"><polyline points="22,0 12,70 26,120 8,200 28,250 14,330 24,400"/></svg>` +
      `${resultBitsHtml('clash', 24)}`,
  }[view.outcome];
  return `<div class="result-sky" aria-hidden="true">${sky}</div>`;
}

/** La tela del kit con sus adornos y la palabra encima. */
function resultBannerHtml(view) {
  const img = (file, cls) => `<img class="${cls}" src="${iconUrl(file)}" alt="" aria-hidden="true">`;
  const deco = {
    win: img('result-branch.png', 'result-deco result-branch'),
    lose: img('result-twig.png', 'result-deco result-twig') +
      img('result-web-l.png', 'result-deco result-web result-web--l') +
      img('result-web-r.png', 'result-deco result-web result-web--r'),
    tie: img('result-branch.png', 'result-deco result-branch') + img('result-twig.png', 'result-deco result-twig'),
  }[view.outcome];
  const cloth = view.outcome === 'tie'
    ? `<i class="result-cloth result-cloth--l" style="--cloth:url('${iconUrl('result-cloth-blue.png')}')"></i>` +
      `<i class="result-cloth result-cloth--r" style="--cloth:url('${iconUrl('result-cloth-red.png')}')"></i>`
    : `<i class="result-cloth" style="--cloth:url('${iconUrl(view.outcome === 'lose' ? 'result-cloth-red.png' : 'result-cloth-blue.png')}')"></i>`;
  const words = resultWordsHtml(view.title);
  // En el empate la palabra va dos veces, una por mitad: cada una entra desde su lado.
  const title = view.outcome === 'tie'
    ? `<span class="result-word result-word--l">${words}</span><span class="result-word result-word--r" aria-hidden="true">${words}</span>`
    : `<span class="result-word">${words}</span>`;
  return `<div class="result-banner">${cloth}${deco}
    <h2 class="result-title" id="result-title" aria-label="${esc(view.title)}">${title}</h2>
  </div>`;
}

function resultStageHtml(view) {
  return `<div class="result-stage" aria-hidden="true">${view.cast.map((c, i) => `
    <div class="result-fighter" data-role="${c.role}" data-stance="${c.stance}" style="--c:${c.color};--i:${i}">
      <i class="result-pedestal"></i>
      <div class="result-axie" data-axie="${esc(c.axie)}">${axieArt(c.axie)}</div>
    </div>`).join('')}</div>`;
}

function resultStatsHtml(view) {
  if (!view.stats.length) return '';
  return `<dl class="result-stats o-panel">${view.stats.map((s, i) => `
    <div class="result-stat" data-stat="${s.key}" style="--i:${i}">
      <dt>${s.label}</dt><dd data-count="${Number(s.value) || 0}">${Number(s.value) || 0}</dd>
    </div>`).join('')}</dl>`;
}

function resultLootHtml(view) {
  if (!view.rewards.length) return '';
  return `<section class="result-loot" aria-labelledby="result-loot-title">
    <h3 class="result-loot-title" id="result-loot-title">${tr('Botín')}</h3>
    <ul class="result-items">${view.rewards.map((item, i) => `
      <li class="result-item" data-rarity="${item.rarity}" style="--i:${i}" title="${esc(tr(item.name))}">
        <span class="result-item-slot"><img src="${esc(item.icon)}" alt="">${item.qty > 1 ? `<b class="result-item-qty">×${item.qty}</b>` : ''}</span>
        <span class="result-item-name">${esc(tr(item.name))}</span>
      </li>`).join('')}</ul>
  </section>`;
}

/**
 * Toda la pantalla. `actions` son los botones, que los arma la mesa: qué puertas hay
 * depende del modo y de la sala, y eso es asunto de `ui.js`.
 */
export function resultHtml(view, actions = '') {
  // Todo lo de la escena va en `.result-scene`, que es lo que se apaga para mirar la
  // mesa: el fondo, el efecto y la caja se van juntos y queda el botón para volver.
  return `<div class="result-scene">${resultSkyHtml(view)}
    <canvas class="result-vfx" aria-hidden="true"></canvas>
    <section class="result-box" aria-labelledby="result-title">
      <header class="result-head">
        ${view.kicker ? `<p class="result-kicker">${esc(view.kicker)}</p>` : ''}
        ${resultBannerHtml(view)}
        <p class="result-line">${esc(view.line)}</p>
      </header>
      ${resultStageHtml(view)}
      ${resultStatsHtml(view)}
      ${resultLootHtml(view)}
      <div class="result-acts">${actions}
        <button class="btn btn-ghost result-peek" data-result="peek">${tr('Ver la mesa')}</button>
      </div>
    </section></div>
    <button class="btn result-back" data-result="back">${tr('Ver resultado')}</button>`;
}

/**
 * El reproductor de la pantalla sobre `#result`.
 *
 * `show` la pinta una vez por final y agenda lo que no es CSS: los Axies con sus
 * animaciones del kit, el efecto del kit sobre cada uno, el sonido y los números que
 * cuentan. `hide` corta todo. Fuera del navegador (los tests) no hay nada que agendar
 * y la pantalla es solo su HTML.
 */
export function createResult(node, { audio = null } = {}) {
  let timers = [];
  let motions = [];
  let peeking = false;
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const quiet = () => Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

  function stop() {
    for (const t of timers) clearTimeout(t);
    timers = [];
    for (const m of motions) m.stop();
    motions = [];
  }

  function peek(on) {
    peeking = on;
    node.dataset.peek = String(on);
  }

  node.addEventListener?.('click', (e) => {
    const which = e.target?.closest?.('[data-result]')?.dataset.result;
    if (which === 'peek') peek(true);
    else if (which === 'back') peek(false);
  });

  /** Cuenta de cero hasta el número, frenando al final. */
  function count(el) {
    const to = Number(el.dataset.count) || 0;
    if (!to || typeof requestAnimationFrame !== 'function') return;
    const start = performance.now();
    el.textContent = '0';
    // La hora del cuadro puede ser un poco anterior a `start`: sin el piso en cero, el
    // primer cuadro contaba para abajo.
    const step = (now) => {
      const k = Math.min(1, Math.max(0, (now - start) / COUNT_MS));
      el.textContent = String(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    // Con la pestaña en segundo plano no hay cuadros: el número llega igual.
    later(COUNT_MS + 200, () => { el.textContent = String(to); });
  }

  return {
    get peeking() { return peeking; },
    /**
     * Pinta la pantalla del final de `state`. `wait` es cuánto espera para aparecer.
     * Devuelve lo que pintó (`resultView`), o `null` si la partida no terminó.
     */
    show(state, { seat = null, net = false, actions = '', wait = RESULT_WAIT } = {}) {
      stop();
      const view = resultView(state, { seat, net });
      if (!view) return this.hide();
      peek(false);
      node.dataset.outcome = view.outcome;
      node.style.setProperty('--wait', `${wait}ms`);
      // Con botín, los botones esperan a que caiga el último objeto.
      const beats = { ...RESULT_BEAT, acts: Math.max(RESULT_BEAT.acts, RESULT_BEAT.loot + view.rewards.length * 350 + 250) };
      for (const [key, ms] of Object.entries(beats)) node.style.setProperty(`--t-${key}`, `${ms}ms`);
      node.innerHTML = resultHtml(view, actions);
      node.hidden = false;

      // El remate suena con la pantalla y no con el último golpe: el pico del sonido cae
      // sobre el efecto del kit.
      const sound = { win: 'win', lose: 'lose', tie: 'tie' }[view.outcome];
      preloadVfx(sound);
      audio?.sfx(sound, { delay: wait + RESULT_BEAT.fx });
      later(wait + RESULT_MUSIC, () => audio?.music?.('menu'));
      // Cada objeto del botín hace su ruido al caer.
      view.rewards.forEach((_, i) => audio?.sfx('take', { delay: wait + RESULT_BEAT.loot + 150 + i * 350 }));

      const fighters = [...(node.querySelectorAll?.('.result-fighter') ?? [])];
      if (!fighters.length) return view;
      const vfx = createVfx(node.querySelector('.result-vfx'));
      fighters.forEach((el, i) => {
        const c = view.cast[i];
        const art = el.querySelector('.result-axie');
        const motion = createMotion(art, i * 0.5, { fidget: [2600, 5200] });
        motion.mount(c.axie);
        motions.push(motion);
        // La postura entra con el Axie y no antes: mientras la pantalla espera, el
        // muñeco quieto no se ve y un festejo arrancado ya iría por la mitad.
        // Festejar es `celebrate` y no el clip `win` del kit: ver `HOLDS` en `axie-motion.js`.
        later(wait + RESULT_BEAT.axie, () => motion.stance(c.stance === 'win' ? 'celebrate' : c.stance));
        if (!sound || quiet()) return;
        // El efecto va sobre los que protagonizan: el que gana, el que cae y los dos del
        // doble KO. En la derrota el rival que festeja atrás no lleva nada.
        if (view.outcome === 'lose' && c.role === 'rival') return;
        later(wait + RESULT_BEAT.fx + i * 260, () => vfx.play(sound, art, { width: view.outcome === 'win' ? 2.1 : 1.5 }));
      });
      if (!quiet()) {
        for (const el of node.querySelectorAll('[data-count]')) {
          const i = Number(el.closest('.result-stat')?.style.getPropertyValue('--i')) || 0;
          later(wait + RESULT_BEAT.stats + i * 90, () => count(el));
        }
      }
      return view;
    },
    hide() {
      stop();
      peek(false);
      node.hidden = true;
      node.innerHTML = '';
      delete node.dataset.outcome;
      return null;
    },
  };
}
