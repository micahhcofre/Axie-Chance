// Los dos momentos de las cartas sueltas, en grande: fusionar tres iguales (desde la
// mochila) y crear en el Taller. Tapan la portada entera, como la evolución (ver
// `evolve-scene.js`), y hablan su idioma: el fondo oscuro teñido del color de la rareza,
// el aro, las motas, el destello, los rayos y la palabra que anuncia con la letra de los
// carteles (`--rite`).
//
// Fusionar (`playMerge`), con los tiempos de `MERGE_BEAT`. No tapa la mochila con otro
// mundo: pasa en su ficha de pergamino, que se agranda y se vuelve el altar.
//
//   altar   las tres copias en triángulo alrededor de la que va a salir, que se ve
//           como un contorno de su rareza con lo que mantiene y un "?" por lo que se
//           sortea, en el lugar donde va a caer. Abajo, los tres naipes de la mochila
//           → la gema que sale, la regla y el botón.
//   charge  las tres tiemblan y se encienden, el aro se cierra y caen motas.
//   slam    caen sobre la que sale de a una, cada una más fuerte: la ficha tiembla, su
//           naipe de la fila se gasta y el "?" se enciende un poco más.
//   burst   el destello, los rayos, el efecto del kit (`power_awaken`): el contorno se
//           vuelve carta y el marco de la ficha toma el color de la rareza nueva. Lo
//           sorteado sigue en "?".
//   spin    una ruleta con los candidatos gira alrededor de la carta y frena con lo que
//           salió en la marca de abajo (el símbolo nuevo entre las seis clases o, de rara
//           a épica, el que queda entre los tres y después su poder entre los cinco de
//           su clase). La ficha que ganó vuela al "?" y recién ahí lo llena: el "?" no
//           muestra nunca otra cosa. Es lo que dice, sin palabras, que eso era al azar.
//   title   la rareza en grande y lo que trae; después, fusionar otra o seguir.
//
// Crear (`playCraft`), con los tiempos de `CRAFT_BEAT`. Todo crece con la mejor carta
// de la tanda (`--lvl`, de 0 la común a 5 la mítica): es lo que se siente antes de verla.
//
//   drop    el cofre cae y rebota.
//   shake   se sacude una vez más por escalón de rareza (una la común, seis la mítica),
//           cada vez más fuerte y más rápido; de rara en adelante se le escapa luz por
//           la tapa y el fondo se enciende, de épica en adelante sube el tono.
//   open    la tapa salta: una columna de luz de su color, una lluvia de chispas que
//           crece con la rareza y, de épica en adelante, el estallido del kit y el
//           temblor de la pantalla.
//   deal    las cartas saltan del cofre en arco a su lugar, de espaldas.
//   tell    las raras en adelante avisan antes de darse vuelta: el dorso se enciende
//           de su color (y las épicas en adelante tiemblan).
//   flip    se dan vuelta de a una, con chispas de su color de poco común para arriba;
//           una rara se hace esperar y una legendaria o mítica se adelanta sola, con las
//           otras apagadas, tiembla y estalla.
//   title   la mejor en grande, si fue rara o más.
//
// La fusión ya está hecha cuando arranca la animación (la mochila se guarda con
// `commit`, ver `lobby.js`), y lo creado también: la escena solo lo cuenta. Un toque en
// cualquier lado salta al final. Con menos movimiento se muestra el final, y sin
// navegador que dibuje (los tests) no se muestra nada: la fusión se hace y se sigue.
// Todo el movimiento es `transform` y `opacity`; lo único que se repite son los rayos,
// que giran con `transform`.
import { SYMBOLS, SYMBOL_IDS, POWERS, CLASS_POWERS, crest, powerIcon } from './data.js';
import { sheetCardHtml } from './ui.js';
import { createVfx, preloadVfx } from './vfx.js';
import { tr } from './i18n.js';
import { shardsHtml } from './evolution.js';
import { CRAFT_TIERS, MERGE_COPIES, tierName } from './crafting.js';

/**
 * Los tiempos de la fusión, en ms desde que se aprieta el botón: la carga, las copias
 * que caen de a una (`slam`, cada `slamStep`, y pegan a los `slamHit` de salir), el
 * estallido (`burst` después del último golpe) y la ruleta (`spin` después; cada una
 * dura lo que `SCENE_SPIN`, y entre la del símbolo y la del poder van `between`).
 * `title` y `end` se cuentan desde que lo último cae en su "?".
 */
export const MERGE_BEAT = { charge: 0, slam: 750, slamStep: 300, slamHit: 230, burst: 220, spin: 650, between: 350, title: 350, end: 550 };
/**
 * Los de crear: la caída del cofre, cada sacudida (la primera dura `shake` y cada una
 * `shakeStep` menos, hasta `shakeMin`), la pausa antes de abrir (`hold`, más `holdStep`
 * por escalón), cuándo salen las cartas y cuánto separa cada vuelta (`focus` es lo que
 * se hace esperar una legendaria o mítica).
 */
export const CRAFT_BEAT = {
  drop: 500, shake: 440, shakeStep: 34, shakeMin: 250, hold: 220, holdStep: 90,
  deal: 260, dealStep: 70, dealFly: 620, tell: 160, flip: 160, wait: 420, focus: 950, title: 450, end: 380,
};

/** La rareza como número, para comparar: 0 la común, 5 la mítica. */
const sceneRank = (tier) => CRAFT_TIERS.findIndex((t) => t.id === tier);
const SCENE_RARE = sceneRank('rare');
const SCENE_EPIC = sceneRank('epic');
const SCENE_LEGEND = sceneRank('legendary');

/** La gema de la rareza, pintada en `index.html` (`#ic-gem`); toma el color de su `data-tier`. */
export const gemHtml = (cls = '') =>
  `<svg class="gem${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" aria-hidden="true"><use href="#ic-gem"/></svg>`;

/** El dorso de las cartas del juego: la madera con el rombo celeste de Axie. */
const SCENE_BACK = '<span class="cs-back" aria-hidden="true"></span>';

/** Una carta de la escena con su gema arriba. */
const sceneFace = (card) => `${sheetCardHtml(card)}${gemHtml('cs-gem')}`;

/** Motas que caen al centro desde lejos, cada una en su ángulo y a su tiempo. */
function sceneMotes(n) {
  return Array.from({ length: n }, (_, i) => {
    const angle = (360 / n) * i + (i % 3) * 9;
    const reach = 30 + ((i * 37) % 24);
    const delay = (i * 47) % 700;
    return `<i class="cs-mote" style="--a:${angle}deg;--r:${reach}vmin;--d:${delay}ms"></i>`;
  }).join('');
}

/**
 * Una lluvia de chispas que sale de un punto: `n` pedacitos entre los ángulos `from` y
 * `to` (grados, 0 a la derecha, -90 arriba), que llegan entre `near` y `far` vmin.
 * Diamantes, puntos y rayitas, del color de la rareza y dorados.
 */
function sceneBurst(n, { from = -175, to = -5, near = 10, far = 30, cls = '' } = {}) {
  return `<span class="cs-burst${cls ? ` ${cls}` : ''}" aria-hidden="true">${Array.from({ length: n }, (_, i) => {
    const angle = from + ((to - from) / Math.max(1, n - 1)) * i + ((i * 23) % 11) - 5;
    const reach = near + ((i * 37) % 100) / 100 * (far - near);
    return `<i class="cs-bit" style="--a:${Math.round(angle)}deg;--r:${reach.toFixed(1)}vmin;--d:${(i * 29) % 140}ms"></i>`;
  }).join('')}</span>`;
}

/** Sin navegador que dibuje (o con menos movimiento) no hay animación que mostrar. */
const sceneQuiet = () => Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

/**
 * Abre la escena en `host` y devuelve su raíz, o `null` si no hay DOM de verdad (los
 * tests): ahí la escena no se muestra.
 */
function sceneMount(host, html) {
  if (!host) return null;
  host.innerHTML = html;
  host.hidden = false;
  const root = host.firstElementChild ?? null;
  if (!root?.querySelector) return null;
  return root;
}

/** Cierra la escena: el host se guarda (lo de adentro queda, por si se lo mira). */
function sceneUnmount(host) {
  if (host) host.hidden = true;
}

/**
 * Un reloj de la escena: `at` agenda, `stop` corta todo lo agendado (al saltar al final
 * o al cerrar).
 */
function sceneClock() {
  let timers = [];
  return {
    at(ms, fn) { timers.push(setTimeout(fn, ms)); },
    stop() { timers.forEach(clearTimeout); timers = []; },
  };
}

// ---------- fusionar ----------

/**
 * Lo que se sortea en la fusión de este grupo y dónde está en la carta que sale: el
 * casillero (`sym`, su índice entre los símbolos) y sus candidatos, y si se sortea el
 * poder. `made` es la carta que salió (sus símbolos vienen ordenados, ver `cleanExtra`).
 */
export function rollPlan(group, made) {
  // De rara a épica: queda uno de los tres y un poder de su clase.
  if (!group.card.power && made.power) {
    const kinds = [...new Set(group.card.symbols)];
    return {
      sym: kinds.length > 1 ? { at: 0, from: kinds, to: made.symbols[0] } : null,
      power: { from: CLASS_POWERS[made.symbols[0]], to: made.power },
    };
  }
  // Si no, el que sobra al sacarle a la nueva los símbolos de la vieja.
  const rest = [...group.card.symbols];
  let at = made.symbols.length - 1;
  made.symbols.forEach((s, i) => {
    const j = rest.indexOf(s);
    if (j >= 0) rest.splice(j, 1);
    else at = i;
  });
  return { sym: { at, from: SYMBOL_IDS, to: made.symbols[at] }, power: null };
}

/** Si la fusión de este grupo sube a una carta con poder (de rara a épica). */
const sceneToPower = (group) => !group.card.power && CRAFT_TIERS[sceneRank(group.next)].power;

/** La regla del grupo en pocas palabras, debajo de la rareza que sale. */
function sceneRule(group) {
  if (sceneToPower(group)) return tr('Queda 1 símbolo y gana un poder de su clase');
  return tr('Gana 1 símbolo al azar');
}

/**
 * Lo alta que es una carta, en anchos de carta: todas miden lo mismo, traigan lo que
 * traigan (`aspect-ratio: 1 / 2` en `.card`), más el marco. Es para armar el altar sin
 * que una copia tape a la que sale ni se salga de la ficha.
 */
const SCENE_TALL = 2.05;

/**
 * La carta que sale tal como se ve antes de saberla: lo que mantiene y un "?" por cada
 * cosa sorteada, **en el lugar donde va a caer**. Es la misma carta de punta a punta: el
 * "?" no se cambia por nada hasta que llega lo que salió (ver `fillSlot`). De rara a
 * épica, el símbolo que queda es un "?" si eran distintos, y el poder otro.
 */
function sceneSeed(group) {
  if (!sceneToPower(group)) return { card: group.card, blanks: 1, blankPower: false };
  const kinds = [...new Set(group.card.symbols)];
  return kinds.length > 1
    ? { card: { symbols: [], power: null }, blanks: 1, blankPower: true }
    : { card: { symbols: kinds, power: null }, blanks: 0, blankPower: true };
}

/**
 * Dónde va cada cosa en el altar, en anchos de carta desde el centro: la que sale en el
 * medio, una copia arriba y dos a los costados, abajo. Y el alto del altar y a qué
 * altura queda el centro, para que entre justo. `orbit` es el radio de la ruleta, que
 * gira alrededor de la que sale cuando las copias ya se fundieron.
 */
function sceneAltar() {
  const tall = SCENE_TALL;
  const ghost = SCENE_TALL;
  const topY = -(ghost / 2 + tall / 2 + 0.34);
  const sideY = Math.max(0.2, tall / 2 - ghost / 2 + 0.1);
  // La que sale crece un 15 % al volverse carta (`.is-forged`): la ruleta la rodea así.
  const orbit = Math.max(1.2, (ghost * 1.15) / 2 + 0.45);
  const above = Math.max(-topY + tall / 2, orbit + 0.3) + 0.2;
  const below = Math.max(sideY + tall / 2, orbit + 0.3) + 0.15;
  return {
    copies: [[0, topY, 0], [1.25, sideY, 11], [-1.25, sideY, -11]],
    orbit,
    height: above + below,
    center: (above / (above + below)) * 100,
  };
}

/** La ruleta: cuánto dura, cuántas vueltas da y su frenada (rápida al salir, larga al final). */
const SCENE_SPIN = { ms: 2300, turns: 2, ease: [0.12, 0.62, 0.16, 1] };

/**
 * Los tiempos de una ruleta de `n` fichas que da `turns` vueltas y frena con la ficha
 * `win` abajo, donde está la marca. Devuelve los grados que gira y, para el tic-tac,
 * los milisegundos en que cada ficha pasa por la marca: se muestrea la curva de
 * `SCENE_SPIN.ease` en vez de leer el giro cuadro a cuadro.
 */
export function spinPlan(n, win, { turns = SCENE_SPIN.turns, ms = SCENE_SPIN.ms } = {}) {
  const step = 360 / n;
  // La ficha `i` arranca en `i·step` (desde arriba, en el sentido del reloj); abajo es 180.
  const deg = turns * 360 + ((180 - win * step) % 360 + 360) % 360;
  const [x1, y1, x2, y2] = SCENE_SPIN.ease;
  const bez = (s, a, b) => 3 * (1 - s) * (1 - s) * s * a + 3 * (1 - s) * s * s * b + s * s * s;
  const offset = ((180 % step) + step) % step;
  const ticks = [];
  let passed = 0;
  for (let k = 1; k <= 600; k++) {
    const s = k / 600;
    const crossed = Math.floor((bez(s, y1, y2) * deg - offset) / step + 1e-9) + 1;
    if (crossed > passed) {
      passed = crossed;
      ticks.push(Math.round(bez(s, x1, x2) * ms));
    }
  }
  return { deg, ticks };
}

/** Una ficha de la ruleta: el escudo de un símbolo o el ícono de un poder, en su moneda. */
function sceneToken(kind, id) {
  const color = kind === 'sym' ? SYMBOLS[id].color : SYMBOLS[POWERS[id].symbol]?.color ?? '#f5c542';
  return `<span class="cs-tok-face" style="--c:${color}">${kind === 'sym' ? crest(id) : powerIcon(id)}</span>`;
}

/**
 * Pone lo que salió en el casillero del "?" (un símbolo o el poder), con el mismo marcado
 * que `sheetCardHtml`. Devuelve el casillero nuevo.
 */
function fillSlot(slot, kind, id) {
  if (!slot || !id) return slot;
  if (kind === 'sym') {
    slot.className = 'sym';
    slot.dataset.on = 'true';
    slot.removeAttribute('aria-hidden');
    slot.style.setProperty('--c', SYMBOLS[id].color);
    slot.innerHTML = crest(id);
    return slot;
  }
  const color = SYMBOLS[POWERS[id].symbol]?.color ?? '#f5c542';
  slot.insertAdjacentHTML('afterend', `<span class="card-power" style="--c:${color}" data-powers="${id}">${powerIcon(id)}</span>`);
  const chip = slot.nextElementSibling;
  slot.remove();
  return chip;
}

/** Las tres copias dibujadas como en la ficha de la mochila: tres naipes, la flecha y la gema. */
function sceneFusionRow(group) {
  return `<div class="bag-fusion cs-fusion" data-ready="true" aria-hidden="true">
    <span class="bag-copies" data-tier="${group.tier}">${'<i data-on></i>'.repeat(MERGE_COPIES)}</span>
    <svg class="bag-arrow" viewBox="0 0 24 24"><path d="M4 12h13M12 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <span class="bag-next" data-tier="${group.next}">${gemHtml()}</span>
  </div>`;
}

const SCENE_UP = '<svg class="bag-up" viewBox="0 0 24 24" aria-hidden="true"><use href="#ic-up"/></svg>';

/** Los botones de la fusión antes de empezar: Fusionar en grande y, chico, Reciclar una. */
const sceneActs = (scrap) =>
  `<button class="lobby-play bag-fuse cs-go" data-cs="go">${SCENE_UP}<span>${tr('Fusionar')}</span></button>${
    scrap ? `<button class="bag-scrap" data-cs="scrap">${tr('Reciclar')} ${scrap}</button>` : ''}`;

/**
 * La fusión de tres copias de `group` (ver `mergeGroups` en `crafting.js`). Pasa en la
 * ficha de la mochila, que se vuelve el altar (el mismo pergamino, el marco del color de
 * la rareza y sus botones; la mochila apagada detrás): es lo que se abre al tocar una pila
 * lista, así que también trae lo de la ficha —`detail`, lo que hace su poder, y `scrap`,
 * lo que devuelve reciclar una copia (sin él no hay botón)—. Abre quieta, salvo con
 * `auto` (se viene de "Fusionar otra"), que arranca directo. Al apretar el botón llama a
 * `commit`, que hace la fusión y devuelve `{ card, again }` —la carta que salió, con su
 * `tier`, y si quedan tres para otra— o `null` si no se pudo. Se cumple con `'back'`
 * (volvió sin fusionar), `'scrap'` (reciclar una, ya confirmado), `'again'` o `'done'`.
 *
 * @param {{host: HTMLElement, group: object, commit: () => ({card: object, again: boolean}|null),
 *   audio?: object, auto?: boolean, detail?: string, scrap?: string}} opts
 */
export function playMerge({ host, group, commit, audio = null, auto = false, detail = '', scrap = '' }) {
  const altar = sceneAltar();
  const seed = sceneSeed(group);
  const copies = altar.copies.map(([x, y, r], k) =>
    `<div class="cs-copy" data-tier="${group.tier}" style="--k:${k};--x:${x.toFixed(2)};--y:${y.toFixed(2)};--r:${r}deg">${sceneFace(group.card)}</div>`).join('');
  const root = sceneMount(host, `
    <div class="cs cs--merge" data-tier="${group.next}" role="dialog" aria-modal="true" aria-label="${tr('Fusionar')}">
      <canvas class="cs-vfx" aria-hidden="true"></canvas>
      <div class="cs-sheet bag-sheet" data-tier="${group.tier}">
        <div class="cs-sky" aria-hidden="true"><i class="cs-glow"></i><i class="cs-rays"></i><i class="cs-flash"></i></div>
        <button class="bag-close" data-cs="back" aria-label="${tr('Cerrar')}" title="${tr('Cerrar')}">×</button>
        <div class="cs-stage">
          <div class="cs-altar" style="--hgt:${altar.height.toFixed(2)};--mid:${altar.center.toFixed(1)}%;--orbit:${altar.orbit.toFixed(2)}">
            <i class="cs-ring" aria-hidden="true"></i>
            <div class="cs-motes" aria-hidden="true">${sceneMotes(16)}</div>
            <div class="cs-ghost" data-tier="${group.next}">${sheetCardHtml(seed.card, seed)}${gemHtml('cs-gem')}</div>
            ${copies}
            <div class="cs-orbit" aria-hidden="true"></div>
          </div>
        </div>
        <div class="cs-info">
          ${detail ? `<div class="cs-detail">${detail}</div>` : ''}
          ${sceneFusionRow(group)}
          <p class="cs-to" data-tier="${group.next}">${gemHtml()}<b>${tierName(group.next)}</b></p>
          <p class="cs-rule">${sceneRule(group)}</p>
        </div>
        <h2 class="cs-word"></h2>
        <p class="cs-sub"></p>
        <div class="cs-acts">${sceneActs(scrap)}</div>
      </div>
    </div>`);

  // Sin DOM de verdad no hay altar que mostrar: se fusiona y se sigue.
  if (!root) {
    const made = commit();
    sceneUnmount(host);
    return Promise.resolve(made ? 'done' : 'back');
  }
  preloadVfx('win');
  const vfx = createVfx(root.querySelector('.cs-vfx'));
  const t = sceneClock();
  const mark = (name) => root.classList.add(`is-${name}`);
  const sheet = root.querySelector('.cs-sheet');
  const ghost = root.querySelector('.cs-ghost');
  const orbit = root.querySelector('.cs-orbit');
  let made = null;
  let plan = null;
  let ended = false;
  let finish = () => {};
  const live = [];

  /** Los casilleros con "?" de la que sale: el del símbolo y el del poder. */
  const symSlot = () => ghost.querySelector('.sym--blank');
  const powerSlot = () => ghost.querySelector('.card-power--blank');

  /** Un temblor corto de la ficha (cada copia que llega pega). */
  function thud(px) {
    live.push(sheet.animate?.([
      { transform: 'none' }, { transform: `translate(${-px}px, ${px * 0.6}px)` },
      { transform: `translate(${px * 0.8}px, ${-px * 0.4}px)` }, { transform: 'none' },
    ], { duration: 220, easing: 'ease-out' }));
  }

  /** Una lluvia de chispas del color `color` en el centro de `el`, encima de todo. */
  function sparks(el, color, n = 14) {
    const box = el?.getBoundingClientRect?.();
    const base = root.getBoundingClientRect?.();
    if (!box || !base) return;
    root.insertAdjacentHTML('beforeend', sceneBurst(n, { from: -180, to: 180, near: 5, far: 13, cls: 'cs-burst--slot' }));
    const burst = root.lastElementChild;
    burst.style.left = `${box.left - base.left + box.width / 2}px`;
    burst.style.top = `${box.top - base.top + box.height / 2}px`;
    burst.style.setProperty('--t', color);
    t.at(1200, () => burst.remove());
  }

  /**
   * Una ruleta alrededor de la que sale: las fichas de los candidatos giran, frenan con
   * lo que salió abajo, en la marca, y esa ficha vuela al "?" y lo llena. Devuelve en qué
   * ms termina (desde `start`).
   */
  function wheel(kind, from, to, start) {
    const pool = from.includes(to) ? from : [...from, to];
    const win = pool.indexOf(to);
    const { deg, ticks } = spinPlan(pool.length, win);
    const ms = SCENE_SPIN.ms;
    t.at(start, () => {
      orbit.style.setProperty('--n', pool.length);
      orbit.innerHTML = `<i class="cs-orbit-mark"></i><span class="cs-orbit-spin">${pool.map((id, i) =>
        `<span class="cs-tok" style="--i:${i}">${sceneToken(kind, id)}</span>`).join('')}</span>`;
      orbit.classList.remove('is-done');
      orbit.classList.add('is-on');
      const spin = orbit.querySelector('.cs-orbit-spin');
      const opts = { duration: ms, easing: `cubic-bezier(${SCENE_SPIN.ease.join(',')})`, fill: 'forwards' };
      live.push(spin.animate?.([{ transform: 'rotate(0deg)' }, { transform: `rotate(${deg}deg)` }], opts));
      // Cada ficha gira al revés lo mismo: así quedan derechas mientras la rueda gira.
      orbit.querySelectorAll('.cs-tok-face').forEach((face) =>
        live.push(face.animate?.([{ rotate: '0deg' }, { rotate: `${-deg}deg` }], opts)));
      audio?.sfx?.('draw', { gain: 0.5 });
    });
    ticks.forEach((ms2, k) => t.at(start + ms2, () => {
      orbit.querySelector('.cs-orbit-mark')?.classList.toggle('is-tick');
      if (k % 2 === 0 || ms2 > ms * 0.5) audio?.sfx?.('take', { gain: 0.3, rate: 1.7 - Math.min(0.6, ms2 / ms * 0.6) });
    }));
    const stop = start + ms;
    t.at(stop, () => {
      const tok = orbit.querySelectorAll('.cs-tok')[win];
      tok?.classList.add('is-win');
      orbit.classList.add('is-done');
      audio?.sfx?.('take', { gain: 0.9 });
    });
    // La ficha que salió vuela al "?": una copia suelta en la escena, del lugar de la
    // ficha al del casillero (medidos una vez).
    const fly = 420;
    t.at(stop + 380, () => {
      const tok = orbit.querySelectorAll('.cs-tok')[win];
      const slot = kind === 'sym' ? symSlot() : powerSlot();
      const a = tok?.getBoundingClientRect?.();
      const b = slot?.getBoundingClientRect?.();
      const base = root.getBoundingClientRect?.();
      if (!a || !b || !base) return;
      root.insertAdjacentHTML('beforeend', `<span class="cs-fly">${sceneToken(kind, to)}</span>`);
      const flyer = root.lastElementChild;
      Object.assign(flyer.style, { left: `${a.left - base.left}px`, top: `${a.top - base.top}px`, width: `${a.width}px`, height: `${a.height}px` });
      tok.style.opacity = '0';
      const dx = b.left + b.width / 2 - (a.left + a.width / 2);
      const dy = b.top + b.height / 2 - (a.top + a.height / 2);
      const k = Math.min(b.width, b.height) / a.width;
      live.push(flyer.animate?.([
        { transform: 'translate(0, 0) scale(1.15)' },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 30}px) scale(1.3)`, offset: 0.45 },
        { transform: `translate(${dx}px, ${dy}px) scale(${k})` },
      ], { duration: fly, easing: 'cubic-bezier(.5, 0, .6, 1)', fill: 'forwards' }));
      orbit.classList.add('is-gone');
    });
    t.at(stop + 380 + fly, () => {
      root.querySelector('.cs-fly')?.remove();
      const slot = fillSlot(kind === 'sym' ? symSlot() : powerSlot(), kind, to);
      slot?.classList.add('is-land');
      sparks(slot, kind === 'sym' ? SYMBOLS[to].color : SYMBOLS[POWERS[to].symbol]?.color ?? '#f5c542', 16);
      thud(3);
      audio?.sfx?.(kind === 'sym' ? to : 'draw');
      if (kind === 'power') audio?.sfx?.(to, { gain: 0.8 });
    });
    return stop + 380 + fly;
  }

  /** La rareza en grande y lo que trae. */
  function title() {
    root.querySelector('.cs-word').textContent = tr('¡{tier}!', { tier: tierName(made.card.tier) });
    root.querySelector('.cs-sub').innerHTML = made.card.power
      ? `${powerIcon(made.card.power)}<span>${POWERS[made.card.power].name}</span>`
      : made.card.symbols.map((s) => crest(s, 'sm')).join('');
    mark('title');
  }

  /** Los botones del final: fusionar otra, si quedan tres, y seguir. */
  function end() {
    ended = true;
    t.stop();
    const acts = root.querySelector('.cs-acts');
    acts.innerHTML = made.again
      ? `<button class="lobby-play bag-fuse cs-go" data-cs="again">${SCENE_UP}<span>${tr('Fusionar otra')}</span></button>
        <button class="bag-cancel cs-done" data-cs="done">${tr('Seguir')}</button>`
      : `<button class="lobby-play bag-fuse cs-go" data-cs="done"><span>${tr('Seguir')}</span></button>`;
    mark('end');
    acts.querySelector('button')?.focus?.();
  }

  /** Pregunta antes de reciclar (o vuelve a los botones de siempre). */
  function askScrap(ask) {
    const acts = root.querySelector('.cs-acts');
    acts.innerHTML = ask
      ? `<p class="bag-ask">${tr('¿Seguro? La carta se rompe y no se recupera.')}</p>
        <span class="bag-acts-row">
          <button class="bag-cancel" data-cs="scrap-no">${tr('No')}</button>
          <button class="bag-scrap is-sure" data-cs="scrap-yes">${tr('Reciclar')} ${scrap}</button>
        </span>`
      : sceneActs(scrap);
    acts.querySelector('button')?.focus?.();
  }

  /** Salta al final: todo puesto, sin sonidos. */
  function skip() {
    if (ended || !made) return;
    t.stop();
    live.forEach((a) => a?.cancel?.());
    root.querySelectorAll('.cs-fly, .cs-burst--slot').forEach((el) => el.remove());
    ['charge', 'slam', 'burst', 'forged'].forEach(mark);
    root.classList.add('is-skip');
    sheet.dataset.tier = made.card.tier;
    orbit.innerHTML = '';
    if (plan.sym) fillSlot(symSlot(), 'sym', plan.sym.to);
    if (plan.power) fillSlot(powerSlot(), 'power', plan.power.to);
    title();
    end();
  }

  /** Aprieta el botón: se fusiona (se guarda ya) y empieza la animación. */
  function go() {
    made = commit();
    if (!made) return finish('back');
    plan = rollPlan(group, made.card);
    root.querySelector('.cs-acts').innerHTML = '';
    mark('go');
    if (sceneQuiet()) {
      root.classList.add('is-quiet');
      audio?.sfx?.('evolve');
      return skip();
    }
    const B = MERGE_BEAT;
    t.at(B.charge, () => { mark('charge'); audio?.sfx?.('evolveCharge'); });
    // Las copias caen sobre la que sale de a una, cada una más fuerte: la ficha tiembla,
    // el naipe de la fila se gasta y el "?" se enciende un poco más.
    for (let k = 0; k < MERGE_COPIES; k++) {
      t.at(B.slam + k * B.slamStep, () => {
        root.querySelectorAll('.cs-copy')[k]?.classList.add('is-in');
        root.querySelectorAll('.cs-fusion .bag-copies i')[k]?.classList.add('is-spent');
      });
      t.at(B.slam + k * B.slamStep + B.slamHit, () => {
        ghost.style.setProperty('--hits', k + 1);
        ghost.classList.remove('is-hit');
        void ghost.offsetWidth;
        ghost.classList.add('is-hit');
        thud(2 + k * 2);
        audio?.sfx?.('take', { rate: 0.8 + k * 0.25, gain: 0.6 + k * 0.2 });
      });
    }
    const burst = B.slam + (MERGE_COPIES - 1) * B.slamStep + B.slamHit + B.burst;
    t.at(burst, () => {
      mark('burst');
      mark('forged');
      sheet.dataset.tier = made.card.tier;
      audio?.sfx?.('evolve');
      vfx.play('win', ghost, { width: 1.6 });
      thud(7);
    });
    let at = burst + B.spin;
    if (plan.sym) at = wheel('sym', plan.sym.from, plan.sym.to, at) + B.between;
    if (plan.power) at = wheel('power', plan.power.from, plan.power.to, at);
    t.at(at + B.title, title);
    t.at(at + B.title + B.end, end);
  }

  return new Promise((resolve) => {
    finish = (choice) => {
      t.stop();
      live.forEach((a) => a?.cancel?.());
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKey);
      sceneUnmount(host);
      resolve(choice);
    };
    function onClick(e) {
      const btn = e.target.closest?.('[data-cs]');
      const what = btn?.dataset.cs;
      if (what === 'go' && !made) return go();
      if (what === 'back' && !made) return finish('back');
      // Reciclar pide un segundo toque, ahí mismo: la carta se rompe.
      if (what === 'scrap' && !made) return askScrap(true);
      if (what === 'scrap-no' && !made) return askScrap(false);
      if (what === 'scrap-yes' && !made) return finish('scrap');
      if ((what === 'again' || what === 'done') && ended) return finish(what);
      // Antes de apretar, tocar afuera de la ficha vuelve, como en la mochila.
      if (!made && e.target === root) return finish('back');
      if (made && !ended) skip();
    }
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (!made) finish('back');
      else if (!ended) skip();
      else finish('done');
    }
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKey);
    if (auto) go();
    else root.querySelector('[data-cs="go"]')?.focus?.();
  });
}

// ---------- crear ----------

/**
 * El cofre, pintado como el mapa (ver `map-art.js`): madera mate con la luz cálida
 * arriba a la izquierda y la sombra fría, herrajes dorados y la cerradura con el rombo
 * celeste del dorso. Tapa y caja van separadas para que la tapa salte.
 */
const CHEST_BAND = (x, y, h) => `<rect x="${x}" y="${y}" width="12" height="${h}" fill="#b88d4a"/>
  <rect x="${x}" y="${y}" width="4" height="${h}" fill="#e3c071"/><rect x="${x + 9}" y="${y}" width="3" height="${h}" fill="#6f5f86"/>`;
const CHEST_LID = `<svg class="cs-chest-lid" viewBox="0 0 160 58" aria-hidden="true">
  <defs><clipPath id="cs-lid-clip"><path d="M9 56V28Q9 7 38 7H122Q151 7 151 28V56Z"/></clipPath></defs>
  <path d="M5 58V28Q5 3 38 3H122Q155 3 155 28V58Z" fill="#2a1608"/>
  <g clip-path="url(#cs-lid-clip)">
    <rect width="160" height="58" fill="#8a5230"/>
    <path d="M9 46V7H98Q88 14 93 21Q72 19 66 29Q46 27 41 37Q24 35 9 46Z" fill="#b8743c"/>
    <path d="M151 7H120Q138 14 141 29Q143 40 151 46Z" fill="#5d3a52"/>
    <path d="M12 21Q60 13 148 21M10 34H150" stroke="#5e331d" stroke-width="1.6" fill="none" opacity=".55"/>
    ${CHEST_BAND(28, 0, 58)}${CHEST_BAND(120, 0, 58)}
  </g>
  <rect x="5" y="45" width="150" height="13" fill="#2a1608"/>
  <rect x="8" y="47" width="144" height="10" fill="#b88d4a"/>
  <rect x="8" y="47" width="144" height="3" fill="#e3c071"/><rect x="8" y="54" width="144" height="3" fill="#6f5f86"/>
  <path d="M69 40H91V58H69Z" fill="#2a1608"/><path d="M72 43H88V58H72Z" fill="#c99a52"/><path d="M72 43H77V58H72Z" fill="#e3c071"/>
</svg>`;
const CHEST_BASE = `<svg class="cs-chest-base" viewBox="0 0 160 78" aria-hidden="true">
  <defs>
    <clipPath id="cs-base-clip"><path d="M9 6H151V69Q151 73 147 73H13Q9 73 9 69Z"/></clipPath>
    <linearGradient id="cs-gem-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8ff0ff"/><stop offset=".6" stop-color="#1d8fe0"/><stop offset="1" stop-color="#0b5fae"/></linearGradient>
  </defs>
  <path d="M5 2H155V70Q155 77 148 77H12Q5 77 5 70Z" fill="#2a1608"/>
  <g clip-path="url(#cs-base-clip)">
    <rect width="160" height="78" fill="#8a5230"/>
    <path d="M9 6H72Q64 18 72 27Q50 30 46 44Q28 44 21 58Q14 56 9 61Z" fill="#b8743c"/>
    <path d="M151 6V73H40Q62 66 96 64Q118 52 127 31Q139 17 151 6Z" fill="#5d3a52"/>
    <path d="M10 30Q80 26 150 31M10 51H150" stroke="#5e331d" stroke-width="1.6" fill="none" opacity=".55"/>
    ${CHEST_BAND(28, 0, 78)}${CHEST_BAND(120, 0, 78)}
    <rect x="0" y="64" width="160" height="14" fill="#6f5f86" opacity=".55"/>
  </g>
  <rect x="5" y="2" width="150" height="11" fill="#2a1608"/>
  <rect x="8" y="4" width="144" height="7" fill="#b88d4a"/><rect x="8" y="4" width="144" height="2.5" fill="#e3c071"/>
  <rect x="65" y="6" width="30" height="32" rx="5" fill="#2a1608"/>
  <rect x="68" y="9" width="24" height="26" rx="3" fill="#c99a52"/><path d="M68 9H80Q74 18 76 35H71Q68 35 68 32Z" fill="#e3c071"/>
  <rect x="74" y="15" width="12" height="12" rx="2" transform="rotate(45 80 21)" fill="url(#cs-gem-fill)" stroke="#140a04" stroke-opacity=".5" stroke-width="1.5"/>
</svg>`;

/**
 * Lo que crearon los botones del Taller, contado: el cofre cae, se sacude tanto como
 * vale la mejor carta, se abre y las cartas saltan de adentro y se dan vuelta de a una;
 * la mejor en grande. `cards` son las de `craftCards` (con `tier` y `pity`). `again` es
 * el botón de crear otra vez (cuántas, lo que cuesta —`price`, en HTML: Moonshards o
 * llaves; si no, `cost` en Moonshards— y si alcanza). Se cumple con `'again'`, `'bag'`
 * o `'done'`.
 *
 * @param {{host: HTMLElement, cards: object[], audio?: object,
 *   again?: {count: number, price?: string, cost?: number, ok: boolean}}} opts
 */
export function playCraft({ host, cards, audio = null, again = null }) {
  const best = cards.reduce((a, c) => (sceneRank(c.tier) > sceneRank(a.tier) ? c : a), cards[0]);
  const lvl = Math.max(0, sceneRank(best.tier));
  const pulls = cards.map((c, i) => {
    const r = sceneRank(c.tier);
    const burst = r > 0 ? sceneBurst(4 + r * 3, { from: -180, to: 180, near: 5 + r, far: 9 + r * 3, cls: 'cs-burst--pull' }) : '';
    return `<div class="cs-pull" data-tier="${c.tier}" data-pity="${c.pity}" style="--i:${i};--k:${((i * 47) % 50) - 25}deg">
      <span class="cs-card">${SCENE_BACK}<span class="cs-face">${sceneFace(c)}</span>${burst}</span>
      ${r >= SCENE_RARE || c.pity ? `<b class="cs-pull-tier">${c.pity ? '★ ' : ''}${tierName(c.tier)}</b>` : ''}
      ${c.power ? `<small class="cs-pull-power">${POWERS[c.power].name}</small>` : ''}
    </div>`;
  }).join('');
  const sub = cards.length === 1 ? tr('Una carta nueva en tu mochila') : tr('{n} cartas nuevas en tu mochila', { n: cards.length });
  const root = sceneMount(host, `
    <div class="cs cs--craft" data-tier="${best.tier}" data-count="${cards.length}" style="--lvl:${lvl}" role="dialog" aria-modal="true" aria-label="${tr('Taller')}">
      <div class="cs-sky" aria-hidden="true"><i class="cs-glow"></i><i class="cs-rays"></i></div>
      <canvas class="cs-vfx" aria-hidden="true"></canvas>
      <div class="cs-stage">
        <div class="cs-chest" style="--gone:${380 + cards.length * CRAFT_BEAT.dealStep}ms" aria-hidden="true">
          <i class="cs-chest-halo"></i><i class="cs-chest-beam"></i>
          <div class="cs-chest-box">${CHEST_BASE}<i class="cs-chest-light"></i>${CHEST_LID}<i class="cs-chest-leak"></i></div>
          ${sceneBurst(12 + lvl * 8, { near: 14 + lvl * 2, far: 30 + lvl * 6 })}
          ${lvl >= SCENE_LEGEND ? `<span class="cs-motes">${sceneMotes(18)}</span>` : ''}
        </div>
        <div class="cs-pulls" data-count="${cards.length}">${pulls}</div>
      </div>
      <h2 class="cs-word">${lvl >= SCENE_RARE ? tr('¡{tier}!', { tier: tierName(best.tier) }) : ''}</h2>
      <p class="cs-sub">${sub}</p>
      <div class="cs-acts">
        ${again ? `<button class="lobby-play cs-go" data-cs="again"${again.ok ? '' : ' disabled'}>
          <span>${tr('Crear ×{n}', { n: again.count })}</span>${again.price ?? shardsHtml(again.cost)}</button>` : ''}
        <button class="cs-back-btn" data-cs="bag">${tr('Ver en la mochila')}</button>
        <button class="cs-back-btn" data-cs="done">${tr('Seguir')}</button>
      </div>
      <i class="cs-flash" aria-hidden="true"></i>
    </div>`);
  if (!root) {
    sceneUnmount(host);
    return Promise.resolve('done');
  }
  if (lvl >= SCENE_EPIC) preloadVfx('win');
  const vfx = createVfx(root.querySelector('.cs-vfx'));
  const t = sceneClock();
  const mark = (name) => root.classList.add(`is-${name}`);
  const els = [...root.querySelectorAll('.cs-pull')];
  const chest = root.querySelector('.cs-chest');
  const box = root.querySelector('.cs-chest-box');
  const stage = root.querySelector('.cs-stage');
  let moves = [];
  let ended = false;

  /** Un movimiento suelto (Web Animations, solo `transform`), que se corta al saltar. */
  function move(el, frames, opts) {
    if (typeof el?.animate !== 'function') return;
    moves.push(el.animate(frames, opts));
  }

  /** La sacudida número `k`: cada una salta más alto, se tuerce más y dura menos. */
  function shake(k, ms) {
    const side = k % 2 ? -1 : 1;
    const amp = (2.5 + k * 1.5 + lvl * 0.7) * side;
    const hop = 4 + k * 1.6 + lvl;
    move(box, [
      { transform: 'none' },
      { transform: `translateY(${-hop}px) rotate(${-amp}deg)`, offset: 0.25 },
      { transform: `translateY(0) rotate(${amp * 0.8}deg) scale(1.05, .94)`, offset: 0.5 },
      { transform: `translateY(${-hop * 0.4}px) rotate(${-amp * 0.4}deg)`, offset: 0.75 },
      { transform: 'none' },
    ], { duration: Math.min(ms - 20, 320), easing: 'ease-out' });
  }

  /** La pantalla tiembla, más con más rareza. */
  function quake(px) {
    move(stage, [
      { transform: 'none' }, { transform: `translate(${-px}px, ${px * 0.4}px)` }, { transform: `translate(${px}px, ${-px * 0.5}px)` },
      { transform: `translate(${-px * 0.6}px, 0)` }, { transform: `translate(${px * 0.3}px, ${px * 0.2}px)` }, { transform: 'none' },
    ], { duration: 420, easing: 'linear' });
  }

  /**
   * Cada carta sale de la boca del cofre. Se mide una vez, al abrirse, con el cofre ya
   * quieto en su lugar (mientras cae, su caja está corrida para arriba). El punto es el
   * centro de cada `.cs-pull`, que la escala no mueve.
   */
  function aim() {
    const c = chest.getBoundingClientRect();
    const fx = c.left + c.width / 2;
    const fy = c.top + c.height * 0.45;
    for (const el of els) {
      const box = el.getBoundingClientRect();
      el.style.setProperty('--dx', `${Math.round(fx - (box.left + box.width / 2))}px`);
      el.style.setProperty('--dy', `${Math.round(fy - (box.top + box.height / 2))}px`);
    }
  }

  function end() {
    if (ended) return;
    ended = true;
    t.stop();
    mark('title');
    mark('end');
    root.querySelector('.cs-acts button:not([disabled])')?.focus?.();
  }

  function skip() {
    if (ended) return;
    t.stop();
    moves.forEach((m) => m.cancel?.());
    moves = [];
    root.classList.add('is-skip');
    root.classList.remove('is-focus');
    ['leak', 'open', 'deal', 'tell'].forEach(mark);
    els.forEach((el) => { el.classList.remove('is-focus'); el.classList.add('is-flip'); });
    if (lvl >= SCENE_EPIC) mark('rays');
    end();
  }

  if (sceneQuiet()) {
    root.classList.add('is-quiet');
    skip();
  } else {
    const B = CRAFT_BEAT;
    t.at(B.drop - 160, () => audio?.sfx?.('hammer', { rate: 0.8, gain: 0.35 }));
    // Las sacudidas: una más por escalón, cada una más fuerte y más rápida.
    const shakes = 1 + lvl;
    let at = B.drop;
    const from = at;
    for (let k = 0; k < shakes; k++) {
      const ms = Math.max(B.shakeMin, B.shake - k * B.shakeStep);
      t.at(at, () => {
        shake(k, ms);
        audio?.sfx?.('hammer', { rate: 1.1 + k * 0.08, gain: 0.35 + k * 0.08 });
        if (lvl >= SCENE_RARE && k >= 1) mark('leak');
        if (lvl > 0) chest.style.setProperty('--heat', (((k + 1) / shakes) * (0.25 + lvl * 0.15)).toFixed(2));
        if (lvl >= SCENE_EPIC && k === 1) mark('charge');
      });
      at += ms;
    }
    if (lvl >= SCENE_EPIC) audio?.riser?.(from + 200, at - from);
    if (lvl >= SCENE_LEGEND) t.at(from + 200, () => audio?.sfx?.('evolveCharge', { gain: 0.8 }));
    // La pausa antes de abrir: más larga cuanto más vale lo de adentro.
    at += B.hold + lvl * B.holdStep;
    t.at(at, () => {
      aim();
      mark('open');
      move(box, [{ transform: 'scale(1.12, .86)' }, { transform: 'scale(.96, 1.06)', offset: 0.45 }, { transform: 'none' }],
        { duration: 380, easing: 'ease-out' });
      audio?.sfx?.('open', { gain: 0.9 });
      if (lvl >= SCENE_RARE) audio?.sfx?.('take', { gain: 0.8 });
      if (lvl >= SCENE_EPIC) {
        audio?.sfx?.('win', { gain: 0.7 });
        vfx.play('win', box, { width: 2.2 });
        quake(3 + lvl * 2);
        mark('flash');
      }
      if (lvl >= SCENE_LEGEND) mark('rays');
    });
    at += B.deal;
    t.at(at, () => {
      mark('deal');
      els.forEach((_, i) => { if (i < 6) audio?.sfx?.('draw', { gain: 0.45, delay: i * B.dealStep }); });
    });
    at += B.dealFly + B.dealStep * (els.length - 1) + B.tell;
    t.at(at, () => mark('tell'));
    at += 260;
    cards.forEach((c, i) => {
      const r = sceneRank(c.tier);
      const el = els[i];
      // Una legendaria o mítica se adelanta sola, con las otras apagadas, y tiembla.
      if (r >= SCENE_LEGEND) {
        t.at(at, () => {
          root.classList.add('is-focus');
          el.classList.add('is-focus');
          audio?.sfx?.('evolveCharge', { gain: 0.7 });
        });
        at += B.focus;
      } else {
        // Una rara se hace esperar: el dorso encendido tiembla un momento antes.
        at += r >= SCENE_RARE ? B.wait : B.flip;
      }
      t.at(at, () => {
        el.classList.add('is-flip');
        audio?.sfx?.(c.power ? 'evolve' : r >= SCENE_RARE ? 'take' : 'draw', { gain: r >= SCENE_RARE ? 1 : 0.5 });
        if (r >= SCENE_EPIC) {
          vfx.play('win', el.querySelector('.cs-card'), { width: 2 });
          mark('flash');
        }
        if (r >= SCENE_LEGEND) quake(6 + r * 2);
      });
      if (r >= SCENE_LEGEND) {
        t.at(at + 750, () => { root.classList.remove('is-focus'); el.classList.remove('is-focus'); });
        at += 450;
      }
    });
    t.at(at + 200, () => { if (lvl >= SCENE_EPIC) mark('rays'); });
    t.at(at + B.title, () => mark('title'));
    t.at(at + B.title + B.end, end);
  }

  return new Promise((resolve) => {
    const finish = (choice) => {
      t.stop();
      moves.forEach((m) => m.cancel?.());
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKey);
      sceneUnmount(host);
      resolve(choice);
    };
    function onClick(e) {
      const what = e.target.closest?.('[data-cs]:not([disabled])')?.dataset.cs;
      if (ended && what) return finish(what);
      if (!ended) skip();
    }
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (ended) finish('done');
      else skip();
    }
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKey);
  });
}
