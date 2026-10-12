// La entrada a un nivel de la Aventura: la transición de cartas y la pantalla de carga.
//
// Tocar pelear reparte un muro de cartas boca abajo —el dorso de las cartas del juego:
// la madera con el rombo de Axie— que salen del nivel que se tocó y tapan la pantalla.
// Encima del muro, la previa: el logo, el nivel, tu Axie y su rival frente a frente y
// vivos, y una cadena con los seis símbolos que se enciende de a uno, en bucle, mientras
// se baja lo que la pelea necesita (ver `levelAssets`): el escenario, los dibujos de los
// dos, el golpe de cada clase y el tema con el que arranca la música. Con todo listo la
// cadena se prende entera, la partida arranca detrás del muro y las cartas se dan
// vuelta de a una, dejando ver la arena.
//
// La partida no arranca antes: el reloj del turno correría detrás del muro. La pantalla
// dura por lo menos `LOADING_BEAT.hold` —para que la previa se lea— y como mucho
// `LOADING_BEAT.max`: un dibujo que no llega no deja a nadie mirando cartas.
//
// Todo lo que se mueve es `transform` y `opacity`. Sin navegador que anime (los tests) la
// partida arranca en el acto; con menos movimiento pedido, la previa sale y se va sin
// cartas volando, pero igual espera a que esté todo.
import { tr } from './i18n.js';
import { SYMBOLS, SYMBOL_IDS, crest, iconUrl } from './data.js';
import { TARGET } from './game.js';
import { axie, axieArt } from './axies.js';
import { adventureChapters, getAdventureLevel, levelKicker } from './adventure.js';
import { createMotion } from './axie-motion.js';
import { loadPosesFor } from './rival-poses.js';
import { preloadVfx } from './vfx.js';

/**
 * Los tiempos de la entrada, en ms. `deal` es lo que tarda cada carta en llegar y
 * `dealGap` cuánto sale una después de la anterior; `hold` lo mínimo que se ve la previa
 * y `max` lo máximo que se espera la carga; `ready` es la cadena entera prendida antes
 * de irse, `out` lo que tarda la previa en irse y `flip`/`flipGap` las cartas dándose
 * vuelta.
 */
export const LOADING_BEAT = { deal: 460, dealGap: 55, hold: 1600, max: 12000, ready: 560, out: 260, flip: 380, flipGap: 50 };

/** Cada cuánto hace un gesto un Axie de la previa, en ms. */
const LOADING_FIDGET = [1800, 3600];

/**
 * Lo que dice la previa del nivel de `setup`, con tu Axie `hero`: el capítulo y el nivel
 * arriba, el nombre grande, los dos que pelean con su clase, si es jefe y su vida, el
 * escenario y la música con la que arranca (la de jefe desde la primera carta).
 */
export function loadingView(setup = {}, hero) {
  const level = getAdventureLevel(setup.adventureLevel);
  const chapter = adventureChapters().find((ch) => ch.levels.some((l) => l.id === level.id));
  // Como en el panel del mapa: "Nivel 7" o "Jefe" va chico arriba y el nombre grande.
  const kicker = [
    chapter ? tr('Capítulo {n}', { n: chapter.n }) : '',
    levelKicker(level),
  ].filter(Boolean).join(' · ');
  const me = axie(hero ?? setup.axie);
  const foe = axie(level.rival);
  return {
    level: level.id,
    kicker,
    title: level.name,
    hero: { id: me.id, name: me.name, cls: me.class },
    rival: { id: foe.id, name: foe.name, cls: foe.class },
    boss: Boolean(level.boss),
    hp: level.hp ?? TARGET,
    stage: level.stage,
    music: level.boss ? 'boss' : 'battle',
  };
}

/** Una de las dos puntas del cara a cara. */
function loadingFighterHtml(side, who, extra = '') {
  return `<div class="loading-fighter" data-role="${side}" style="--c:${SYMBOLS[who.cls]?.color ?? '#fff'}">
    <i class="loading-base" aria-hidden="true"></i>
    <div class="loading-axie" data-axie="${who.id}" aria-hidden="true">${axieArt(who.id)}</div>
    <span class="loading-name">${crest(who.cls, 'sm')}${who.name}</span>${extra}
  </div>`;
}

/** Todo lo que se dibuja: el muro de `cards` cartas y, encima, la previa. */
export function loadingHtml(view, cards = 5) {
  const wall = Array.from({ length: cards }, (_, i) => `<i class="loading-card" style="--i:${i}"></i>`).join('');
  const chain = SYMBOL_IDS.map((s, i) => `<span class="loading-link" style="--i:${i};--c:${SYMBOLS[s].color}">${crest(s)}</span>`).join('');
  const boss = view.boss
    ? `<span class="loading-boss">${tr('Jefe')} · ${tr('{hp} de vida', { hp: view.hp })}</span>`
    : '';
  return `<div class="loading-wall" style="--n:${cards}" aria-hidden="true">${wall}</div>
  <div class="loading-scene">
    <i class="loading-shade" aria-hidden="true"></i>
    <img class="loading-logo" src="${iconUrl('logo-outline.png')}" alt="Axie Chance">
    <p class="loading-kicker">${view.kicker}</p>
    <h2 class="loading-title">${view.title}</h2>
    <div class="loading-duel">
      ${loadingFighterHtml('hero', view.hero)}
      <span class="loading-vs" aria-hidden="true">VS</span>
      ${loadingFighterHtml('rival', view.rival, boss)}
    </div>
    <div class="loading-chain" aria-hidden="true"><i class="loading-beam"></i>${chain}</div>
    <p class="loading-note" role="status"><span data-note="wait">${tr('Barajando el mazo')}<i class="loading-dots"><b></b><b></b><b></b></i></span><span data-note="go">${tr('¡A pelear!')}</span></p>
  </div>`;
}

/** Las direcciones de cada `url(...)` de un valor de CSS. */
const loadingUrls = (value) => [...String(value ?? '').matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1]);

/** Baja y decodifica una imagen. Nunca falla: una que no llega no traba la entrada. */
function loadingImage(src) {
  if (typeof Image !== 'function') return Promise.resolve();
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
}

/**
 * Lo que la pelea necesita tener bajado para verse entera desde el primer cuadro: el
 * escenario del nivel (con sus marcos, si tiene), los dibujos de los dos —los mismos que
 * pone la mesa, ya en la previa—, el golpe de cada clase y el tema con el que arranca la
 * música. El escenario se le pregunta al CSS, que es el que sabe qué dibujo va: en el
 * archivo único de `dist/` es un data URI y no una ruta.
 */
export function levelAssets(root, view, audio) {
  const probe = document.createElement('div');
  probe.className = 'arena';
  probe.dataset.stage = view.stage;
  probe.hidden = true;
  root.appendChild(probe);
  const css = getComputedStyle(probe);
  const stage = ['--arena', '--fl', '--fr'].flatMap((v) => loadingUrls(css.getPropertyValue(v)));
  probe.remove();
  const drawings = [...root.querySelectorAll('.loading-axie img')].map((img) => img.decode?.());
  const letters = globalThis.document?.fonts?.load?.('400 48px "Caesar Dressing"');
  return Promise.all([
    ...stage.map(loadingImage),
    ...drawings,
    preloadVfx(view.hero.cls),
    preloadVfx(view.rival.cls),
    audio?.prepare?.(view.music),
    letters,
  ].map((p) => Promise.resolve(p).catch(() => {})));
}

/**
 * La pantalla de la entrada, sobre `node` (`#loading`). `run` la juega entera y devuelve
 * `false` si ya había una andando (un doble toque en pelear no reparte dos muros).
 */
export function createLoading(node, { audio = null } = {}) {
  let busy = false;
  let motions = [];
  const wait = (ms) => new Promise((r) => { setTimeout(r, ms); });
  const frame = () => new Promise((r) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => r());
    else r();
  });

  return {
    get busy() { return busy; },
    /**
     * Entra al nivel: `view` es lo que dice la previa (ver `loadingView`), `from` el punto
     * de la pantalla de donde salen las cartas (el nivel o el botón que se tocó),
     * `onCovered` lo que pasa cuando el muro ya tapa todo (la portada se va sin que se
     * vea) y `start` arranca la partida, detrás del muro, justo antes de darlo vuelta.
     */
    async run({ view, from = null, onCovered = null, start }) {
      if (busy) return false;
      const doc = globalThis.document;
      if (!node || typeof node.animate !== 'function' || !doc || typeof getComputedStyle !== 'function') {
        onCovered?.();
        start();
        return true;
      }
      busy = true;
      const quiet = Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
      const width = globalThis.innerWidth || 1280;
      const height = globalThis.innerHeight || 720;
      // Cartas del alto de la pantalla y más o menos de la proporción de un naipe.
      const count = Math.max(3, Math.min(7, Math.round(width / (height * 0.36))));
      const origin = from ?? { x: width / 2, y: height / 2 };

      // Las poses del rival, si su capítulo todavía no las trajo (ver `rival-poses.js`):
      // sin ellas la previa lo dibuja sin sus gestos. Desde el mapa ya están; viniendo de
      // "Siguiente Nivel" a un capítulo nuevo se esperan un momento, nunca de más.
      await Promise.race([loadPosesFor(view.rival.id), wait(900)]);

      node.innerHTML = loadingHtml(view, count);
      node.dataset.phase = 'deal';
      node.setAttribute('aria-busy', 'true');
      node.hidden = false;

      // El reparto: cada carta sale de donde se tocó, chiquita y girada, y va a su lugar.
      const cards = [...node.querySelectorAll('.loading-card')];
      if (!quiet) {
        audio?.whoosh?.(0, { dur: 420, from: 500, to: 3200, gain: 0.5 });
        cards.forEach((card, i) => {
          const r = card.getBoundingClientRect();
          const dx = origin.x - (r.left + r.width / 2);
          const dy = origin.y - (r.top + r.height / 2);
          const turn = (i % 2 ? 1 : -1) * (14 + i * 3);
          card.animate([
            { transform: `translate(${dx}px, ${dy}px) scale(.12) rotate(${turn}deg)`, opacity: 0 },
            { opacity: 1, offset: 0.2 },
            { transform: 'none', opacity: 1 },
          ], { duration: LOADING_BEAT.deal, delay: i * LOADING_BEAT.dealGap, easing: 'cubic-bezier(.2, .8, .3, 1.04)', fill: 'backwards' });
          if (i % 2 === 0) audio?.sfx?.('draw', { delay: i * LOADING_BEAT.dealGap + 120, rate: 1 + i * 0.05, gain: 0.7 });
        });
        await wait(LOADING_BEAT.deal + (count - 1) * LOADING_BEAT.dealGap);
      }
      onCovered?.();

      // La previa: los dos se ven vivos mientras se baja lo que falta.
      node.dataset.phase = 'show';
      motions = [...node.querySelectorAll('.loading-axie')].map((el, i) => {
        const motion = createMotion(el, i * 0.5, { fidget: LOADING_FIDGET });
        motion.mount(el.dataset.axie);
        return motion;
      });
      const loaded = levelAssets(node, view, audio);
      await Promise.race([Promise.all([loaded, wait(quiet ? 400 : LOADING_BEAT.hold)]), wait(LOADING_BEAT.max)]);

      // Listo: la cadena se prende entera y la previa se va.
      node.dataset.phase = 'ready';
      await wait(quiet ? 0 : LOADING_BEAT.ready);
      node.dataset.phase = 'out';
      await wait(quiet ? 0 : LOADING_BEAT.out);
      for (const motion of motions) motion.stop();
      motions = [];

      // La partida arranca detrás del muro; se deja pintar la mesa y recién ahí las
      // cartas se dan vuelta de a una, de izquierda a derecha.
      start();
      await frame();
      await frame();
      if (!quiet) {
        audio?.sfx?.('renew', { gain: 0.8 });
        const flips = cards.map((card, i) => card.animate([
          { transform: 'none', opacity: 1 },
          { transform: 'perspective(900px) rotateY(-90deg) scale(.96)', opacity: 0.6 },
        ], { duration: LOADING_BEAT.flip, delay: i * LOADING_BEAT.flipGap, easing: 'cubic-bezier(.55, 0, .8, .5)', fill: 'forwards' }));
        await Promise.all(flips.map((a) => a.finished.catch(() => {})));
      }
      node.hidden = true;
      node.innerHTML = '';
      delete node.dataset.phase;
      node.removeAttribute('aria-busy');
      busy = false;
      return true;
    },
  };
}
