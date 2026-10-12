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
// **El botín.** Abajo de las marcas, lo que te llevás: los Moonshards que cuentan hasta
// su número y la AXP de tu Axie, con su barra que se llena y la medalla del nivel que
// salta si subió (ver `payHtml`). Lo cobra la mesa al terminar (`claimPayout` en
// `payout.js`) y llega acá como `pay`; si la partida no paga, una línea dice por qué.
// Los objetos sueltos que pueda dejar una partida van en `state.rewards[asiento]` y salen
// después, uno detrás del otro. Ver `rewardsOf` para la forma de cada uno.
import { tr } from './i18n.js';
import { SYMBOLS, iconUrl } from './data.js';
import { axie, axieArt } from './axies.js';
import { createMotion } from './axie-motion.js';
import { createVfx, preloadVfx } from './vfx.js';
import { matchResult, seatVoice, wonByKo } from './game.js';
import { DIFFICULTY_LABELS, isFinalLevel } from './adventure.js';
import { levelInfo, moonIcon, shardAmount, EVOLVE_STEP, MAX_LEVEL, LEVEL_UP_SHARDS } from './evolution.js';
import { MATCH_PAY, FORFEIT_PAY_ROUND } from './payout.js';

/**
 * Cuándo entra cada cosa, en ms, contados desde que la pantalla aparece. La pantalla
 * aparece `wait` después del final (ver `show`): el último golpe tiene que caer y el
 * que perdió, desplomarse, antes de taparlos.
 */
export const RESULT_BEAT = { sky: 80, banner: 250, title: 480, axie: 650, fx: 900, stats: 1250, loot: 1750, up: 2900, acts: 1900 };

/**
 * El botín, contado desde `loot`: cada casillero cae `PAY_STEP` después del anterior, su
 * número cuenta `PAY_COUNT` después de caer y la barra de AXP arranca en `PAY_FILL`. Si
 * el Axie sube de nivel, la barra llega al tope y en `RESULT_BEAT.up` salta la medalla.
 */
const PAY_STEP = 350;
const PAY_COUNT = 150;
const PAY_FILL = 600;
/** Los casilleros del botín que ocupan los Moonshards y la AXP: los objetos caen después. */
const PAY_SLOTS = 2;

/**
 * Cuándo vuelve la música de la portada, desde que la pantalla entra: apenas se apaga
 * el remate (que suena en `fx` y dura un segundo y medio). La pantalla del final ya no
 * es la partida —es la puerta a la siguiente o al menú—, y el tema que suena en todos
 * los menús entra acá para seguir sin cortes cuando se vuelve a la portada.
 */
export const RESULT_MUSIC = RESULT_BEAT.fx + 1700;

/** La estrella del kit, la misma de los niveles ganados en el mapa de la Aventura. */
const RESULT_STAR = 'https://cdn.jsdelivr.net/gh/axieinfinity/axie-origins-asset-kit@main/Assets/OriginsKit/PvE/UI/Frames/star.png';

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
export function resultView(state, { seat = null, net = false, pay = null } = {}) {
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

  // En la Aventura, un nivel ganado dice si se lleva la estrella: solo por K.O. (ver
  // `wonByKo`). Si el rival cayó en su última chance, se pasa igual, sin estrella.
  const star = state.mode === 'adventure' && outcome === 'win' ? wonByKo(state) : null;

  return {
    outcome, hero, foe, title, kicker, line, stats, cast, star,
    pay: watching ? null : cleanPay(pay),
    rewards: rewardsOf(state, me),
  };
}

/** Lo que cobró la pantalla (ver `claimPayout`), con números de verdad o nada. */
function cleanPay(pay) {
  if (!pay || typeof pay.why !== 'string') return null;
  const n = (v) => Math.max(0, Math.floor(Number(v) || 0));
  const levels = Array.isArray(pay.levels) ? pay.levels.map(n).filter(Boolean) : [];
  return {
    why: pay.why, axie: pay.axie ?? null,
    amount: n(pay.amount), shards: n(pay.shards), axp: n(pay.axp),
    from: n(pay.from), to: n(pay.to), levels, purse: n(pay.purse),
  };
}

/** De dónde salió lo que se cobró, o por qué la partida no pagó nada. */
const PAY_WHY = {
  win: () => tr('Por la victoria'),
  ko: () => tr('Por la victoria por K.O.: el doble'),
  first: () => tr('Primera victoria del nivel'),
  firstKo: () => tr('Primera victoria del nivel, por K.O.: el doble'),
  star: () => tr('Por la estrella del K.O.'),
  practice: () => tr('Contra la CPU se practica: no se ganan Moonshards ni AXP.'),
  lose: () => tr('Ganá para llevarte Moonshards y AXP.'),
  tie: () => tr('En el empate nadie se lleva Moonshards ni AXP.'),
  early: () => tr('Un abandono antes de la ronda {round} no paga.', { round: FORFEIT_PAY_ROUND }),
  replay: () => tr('Este nivel ya lo ganaste: paga solo la primera vez.'),
  noStar: () => tr('Ganalo por K.O. y te llevás la estrella y {n} Moonshards.', { n: MATCH_PAY.ko - MATCH_PAY.win }),
};


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

/** La estrella del nivel de la Aventura: ganada por K.O., o apagada con cómo ganarla. */
function resultStarHtml(view) {
  if (view.star === null || view.star === undefined) return '';
  const text = view.star ? tr('¡Estrella! Lo ganaste por K.O.')
    : tr('Sin estrella: ganale por K.O., sin dejarle última chance.');
  return `<p class="result-star" data-earned="${view.star}">
    <img src="${RESULT_STAR}" alt=""><span>${esc(text)}</span></p>`;
}

function resultStageHtml(view) {
  return `<div class="result-stage" aria-hidden="true">${view.cast.map((c, i) => `
    <div class="result-fighter" data-role="${c.role}" data-stance="${c.stance}" style="--c:${c.color};--i:${i}">
      <i class="result-pedestal"></i>
      <div class="result-axie" data-axie="${esc(c.axie)}">${axieArt(c.axie)}</div>
    </div>`).join('')}</div>`;
}

/** El resumen de la pelea: las marcas en una tabla de madera, un número por columna. */
function resultStatsHtml(view) {
  if (!view.stats.length) return '';
  return `<section class="result-sum" aria-labelledby="result-sum-title">
    <h3 class="result-sum-title" id="result-sum-title">${tr('Resumen')}</h3>
    <dl class="result-stats o-panel">${view.stats.map((s, i) => `
    <div class="result-stat" data-stat="${s.key}" style="--i:${i}">
      <dt>${s.label}</dt><dd data-count="${Number(s.value) || 0}">${Number(s.value) || 0}</dd>
    </div>`).join('')}</dl>
  </section>`;
}

/**
 * Lo que cobraste: los Moonshards y la AXP de tu Axie en una tabla como la del resumen,
 * de dónde salen al pie, y la cinta del nivel nuevo si subió. Se pinta como queda al final
 * —la barra llena hasta donde llegó, el nivel nuevo—: así lo ve quien no quiere
 * movimiento, y el reproductor la lleva para atrás antes de mostrarla (ver `climb`).
 */
function payHtml(pay) {
  const who = pay.axie ? axie(pay.axie) : null;
  const after = levelInfo(pay.to);
  const xpText = after.max ? tr('Nivel máximo')
    : tr('{into} de {need} de experiencia', { into: after.into, need: after.need });
  const gain = (key, i, top, foot) =>
    `<div class="result-gain" data-gain="${key}" style="--i:${i}">${top}${foot}</div>`;
  const shards = gain('shards', 0,
    `<span class="result-gain-top">${moonIcon('moon-ico result-gain-ico')}
      <b class="result-gain-num">+<span data-count="${pay.shards}">${pay.shards}</span></b></span>`,
    `<span class="result-gain-label">${tr('Moonshards')}</span>
    ${Number.isFinite(pay.purse) ? `<span class="result-purse">${tr('En la bolsa')} <span class="moon-amt">${moonIcon()}<b>${shardAmount(pay.purse)}</b></span></span>` : ''}`);
  const axp = who ? gain('axp', 1,
    `<span class="result-gain-top"><span class="choose-lvl result-lvl">${tr('LVL')} <b>${after.level}</b></span>
      <b class="result-gain-num">+<span data-count="${pay.axp}">${pay.axp}</span></b></span>
    <span class="result-xp" role="progressbar" aria-valuemin="0" aria-valuemax="100"
      aria-valuenow="${Math.round(after.frac * 100)}" aria-valuetext="${esc(xpText)}">
      <i class="result-xp-fill" style="--fill:${after.frac.toFixed(3)}"></i></span>`,
    `<span class="result-gain-label">${esc(tr('AXP de {name}', { name: who.name }))}</span>`) : '';
  let up = '';
  if (who && pay.levels.length) {
    const level = pay.levels[pay.levels.length - 1];
    const opened = pay.levels.some((l) => l % EVOLVE_STEP === 0 && l <= MAX_LEVEL);
    up = `<p class="result-up">
      <span>${esc(tr('¡{name} subió al nivel {level}!', { name: who.name, level }))}</span>
      <span class="moon-amt">+${moonIcon()}<b>${shardAmount(pay.levels.length * LEVEL_UP_SHARDS)}</b></span>
      ${opened ? `<span class="result-up-evo">${esc(tr('Se abrió una evolución'))}</span>` : ''}
    </p>`;
  }
  return `<div class="result-pay o-panel"${who ? '' : ' data-solo'}>${shards}${axp}
    <p class="result-pay-why">${esc(PAY_WHY[pay.why]?.() ?? '')}</p></div>${up}`;
}

function resultLootHtml(view) {
  const paid = view.pay?.amount > 0;
  // Sin nada que cobrar, una sola línea que dice por qué; el tutorial no dice nada.
  const note = view.pay && !paid && view.pay.why !== 'tutorial' ? PAY_WHY[view.pay.why]?.() : '';
  if (!paid && !view.rewards.length) {
    return note ? `<p class="result-pay-note">${esc(note)}</p>` : '';
  }
  return `<section class="result-loot" aria-labelledby="result-loot-title">
    <h3 class="result-loot-title" id="result-loot-title">${tr('Botín')}</h3>
    ${paid ? payHtml(view.pay) : ''}
    ${view.rewards.length ? `<ul class="result-items">${view.rewards.map((item, i) => `
      <li class="result-item" data-rarity="${item.rarity}" style="--i:${i + (paid ? PAY_SLOTS : 0)}" title="${esc(tr(item.name))}">
        <span class="result-item-slot"><img src="${esc(item.icon)}" alt="">${item.qty > 1 ? `<b class="result-item-qty">×${item.qty}</b>` : ''}</span>
        <span class="result-item-name">${esc(tr(item.name))}</span>
      </li>`).join('')}</ul>` : ''}
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
        ${resultStarHtml(view)}
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

  /**
   * La barra de AXP, de donde estaba a donde llegó. El HTML la trae llena hasta el final
   * (ver `payHtml`): acá se la lleva para atrás —sin transición, la pantalla todavía no
   * se ve— y se la suelta. Si el Axie subió, llega al tope, en `up` vuelve a cero con el
   * nivel nuevo en la medalla, que salta, y sigue hasta donde quedó. Una partida paga
   * menos de lo que pide un nivel (`axpNeed`): se sube uno a lo sumo.
   */
  function climb(pay, wait) {
    const fill = node.querySelector('.result-xp-fill');
    const medal = node.querySelector('.result-lvl');
    const number = medal?.querySelector('b');
    if (!fill || !number) return;
    const before = levelInfo(pay.from);
    const after = levelInfo(pay.to);
    const set = (frac, snap = false) => {
      if (snap) fill.style.transition = 'none';
      fill.style.setProperty('--fill', frac.toFixed(3));
      if (!snap) return;
      void fill.offsetWidth; // que tome el salto antes de volver a la transición
      fill.style.transition = '';
    };
    set(before.frac, true);
    number.textContent = String(before.level);
    const start = wait + RESULT_BEAT.loot + PAY_FILL;
    if (!pay.levels.length) {
      later(start, () => set(after.frac));
      return;
    }
    later(start, () => set(1));
    later(wait + RESULT_BEAT.up, () => {
      set(0, true);
      number.textContent = String(after.level);
      medal.dataset.up = 'true';
      later(40, () => set(after.frac));
    });
  }

  return {
    get peeking() { return peeking; },
    /**
     * Pinta la pantalla del final de `state`. `wait` es cuánto espera para aparecer.
     * Devuelve lo que pintó (`resultView`), o `null` si la partida no terminó.
     */
    show(state, { seat = null, net = false, actions = '', wait = RESULT_WAIT, pay = null } = {}) {
      stop();
      const view = resultView(state, { seat, net, pay });
      if (!view) return this.hide();
      peek(false);
      node.dataset.outcome = view.outcome;
      node.style.setProperty('--wait', `${wait}ms`);
      // Con botín, los botones esperan a que caiga el último objeto, a que la barra de
      // AXP se llene y, si subió de nivel, a que salte la medalla.
      const paid = view.pay?.amount > 0;
      const slots = (paid ? PAY_SLOTS : 0) + view.rewards.length;
      const beats = {
        ...RESULT_BEAT,
        acts: Math.max(RESULT_BEAT.acts, RESULT_BEAT.loot + slots * PAY_STEP + 250,
          paid ? RESULT_BEAT.loot + PAY_FILL + 500 : 0, paid && view.pay.levels.length ? RESULT_BEAT.up + 500 : 0),
      };
      for (const [key, ms] of Object.entries(beats)) node.style.setProperty(`--t-${key}`, `${ms}ms`);
      node.innerHTML = resultHtml(view, actions);
      node.hidden = false;

      // El remate suena con la pantalla y no con el último golpe: el pico del sonido cae
      // sobre el efecto del kit.
      const sound = { win: 'win', lose: 'lose', tie: 'tie' }[view.outcome];
      preloadVfx(sound);
      audio?.sfx(sound, { delay: wait + RESULT_BEAT.fx });
      later(wait + RESULT_MUSIC, () => audio?.music?.('menu'));
      // Cada casillero del botín hace su ruido al caer, y la medalla del nivel nuevo, el
      // del poder que sale en el Taller.
      for (let i = 0; i < slots; i++) audio?.sfx('take', { delay: wait + RESULT_BEAT.loot + PAY_COUNT + i * PAY_STEP });
      if (paid && view.pay.levels.length) audio?.sfx('evolve', { delay: wait + RESULT_BEAT.up });

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
        for (const el of node.querySelectorAll('.result-stat [data-count]')) {
          const i = Number(el.closest('.result-stat')?.style.getPropertyValue('--i')) || 0;
          later(wait + RESULT_BEAT.stats + i * 90, () => count(el));
        }
        for (const el of node.querySelectorAll('.result-gain [data-count]')) {
          const i = Number(el.closest('.result-gain')?.style.getPropertyValue('--i')) || 0;
          later(wait + RESULT_BEAT.loot + PAY_COUNT + i * PAY_STEP, () => count(el));
        }
        if (paid) climb(view.pay, wait);
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
