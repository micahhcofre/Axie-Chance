// Los efectos de la mesa: lo que el escenario (`stage.js`) dibuja cuando pasa algo en
// la partida. Cada función mide en el momento dónde está lo que le importa (una carta,
// un eslabón, un Axie) y cuelga un efecto con su propio reloj; `ui.js` solo dice qué
// pasó y a quién.
import { SYMBOLS } from './data.js';
import {
  EASE, fxSpan, lerpFx, fxHash, fxBurst, fxShock, fxGlow, fxPuff, fxBeam, fxClaws, fxText, fxStar,
  TEXT_IN, TEXT_OUT, fxBoth, FX_SHARDS, fxRand,
} from './stage-kit.js';

/** Cuánto dura el vuelo de una carta del mazo a la mesa, en ms. */
export const FLY_MS = 400;

/**
 * La carta que sale del mazo: vuela en arco, se da vuelta en el aire y cae con un
 * aplastón. Se mueve la carta de verdad de la mesa (Web Animations), así que al
 * terminar ya está donde tiene que estar; el escenario pone el polvo, el anillo y las
 * chispas al caer. Devuelve cuánto tarda en caer, en ms (0 si no voló).
 */
export function flyCard(stage, el, pile, color, side = 1) {
  const quiet = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const from = pile?.getBoundingClientRect?.();
  const to = el?.getBoundingClientRect?.();
  if (quiet || !el?.animate || !from?.width || !to?.width) return 0;
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const s0 = Math.max(0.3, Math.min(1, from.width / to.width));
  const lift = Math.min(170, 40 + Math.hypot(dx, dy) * 0.3);
  const tilt = side * 12;
  el.classList.add('is-flying');
  // Tres tramos con su propia curva: sale y sube (frena arriba, de espaldas y de canto),
  // baja sobre su lugar (acelera) y se aplasta al tocar.
  const fly = el.animate([
    { transform: `perspective(700px) translate(${dx}px, ${dy}px) scale(${s0}) rotate(${-tilt}deg) rotateY(180deg)`, easing: 'cubic-bezier(.2, .7, .4, 1)' },
    { offset: 0.55, transform: `perspective(700px) translate(${dx * 0.3}px, ${dy * 0.3 - lift}px) scale(1.14) rotate(${-tilt * 0.3}deg) rotateY(90deg)`, easing: 'cubic-bezier(.55, 0, .85, .6)' },
    { offset: 0.86, transform: 'perspective(700px) translate(0, 4px) scale(1.08, .9) rotateY(0deg)', easing: 'ease-out' },
    { transform: 'none' },
  ], { duration: FLY_MS, easing: 'linear' });
  // El dorso tapa la cara mientras la carta está de espaldas: hasta que queda de canto.
  try {
    el.animate([{ opacity: 1 }, { offset: 0.55, opacity: 1 }, { offset: 0.551, opacity: 0 }, { opacity: 0 }],
      { duration: FLY_MS, pseudoElement: '::after' });
  } catch { /* sin dorso animado, la carta vuela con la cara */ }
  // Al caer queda asentada: si no, la entrada vieja de la carta (`deal` en el CSS)
  // arrancaría de nuevo encima del vuelo.
  const done = () => {
    el.classList.add('is-settled');
    el.classList.remove('is-flying');
  };
  fly.onfinish = done;
  fly.oncancel = done;
  stage.add((B, G, age) => landing(B, G, age, stage, el, color), 0.9, (FLY_MS * 0.86) / 1000);
  return FLY_MS * 0.86;
}

/**
 * La carta que perdonó el Secret Egg vuelve al mazo: el vuelo de `flyCard` al revés. Se
 * levanta, se da vuelta de espaldas en el aire y se achica hasta meterse en el mazo, y
 * se queda escondida hasta que la mesa la saque. Devuelve lo que tarda, en ms (0 si no
 * voló: sin movimiento, la mesa la esconde de una).
 */
export const FLY_BACK_MS = 520;
export function flyBack(el, pile, side = 1) {
  const quiet = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const from = el?.getBoundingClientRect?.();
  const to = pile?.getBoundingClientRect?.();
  if (quiet || !el?.animate || !from?.width || !to?.width) return 0;
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const s1 = Math.max(0.3, Math.min(1, to.width / from.width));
  const lift = Math.min(150, 40 + Math.hypot(dx, dy) * 0.25);
  const tilt = side * 12;
  el.classList.add('is-flying');
  el.animate([
    { transform: 'none', easing: 'cubic-bezier(.3, 0, .6, 1)' },
    { offset: 0.4, transform: `perspective(700px) translate(${dx * 0.3}px, ${dy * 0.3 - lift}px) scale(1.1) rotate(${-tilt * 0.3}deg) rotateY(90deg)`, easing: 'cubic-bezier(.4, 0, .9, .7)' },
    { offset: 0.92, opacity: 1, transform: `perspective(700px) translate(${dx}px, ${dy}px) scale(${s1}) rotate(${-tilt}deg) rotateY(180deg)` },
    { opacity: 0, transform: `perspective(700px) translate(${dx}px, ${dy}px) scale(${s1 * 0.9}) rotate(${-tilt}deg) rotateY(180deg)` },
  ], { duration: FLY_BACK_MS, easing: 'linear', fill: 'forwards' });
  // El dorso aparece cuando la carta queda de canto, y ya no se va.
  try {
    el.animate([{ opacity: 0 }, { offset: 0.4, opacity: 0 }, { offset: 0.401, opacity: 1 }, { opacity: 1 }],
      { duration: FLY_BACK_MS, pseudoElement: '::after', fill: 'forwards' });
  } catch { /* sin dorso animado, vuelve con la cara */ }
  return FLY_BACK_MS;
}

/**
 * La carta de "¿una más?", en cámara lenta. Sale del mazo de espaldas y sube hasta el
 * medio de la pantalla, grande; se queda ahí temblando mientras detrás crece la luz;
 * se da vuelta de golpe —estalla dorado si engancha, rojo si corta— y recién entonces
 * cae a su lugar con el aplastón de siempre. `flip` y `land` son los ms desde que sale
 * (`ONE_MORE_FLIP` y `ONE_MORE_LAND` en `game.js`: el motor espera lo mismo). Devuelve
 * cuándo cae, en ms (0 si no voló: sin movimiento la carta aparece en su lugar).
 */
export function flyEpic(stage, el, pile, color, side, { flip, land, good }) {
  const quiet = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const from = pile?.getBoundingClientRect?.();
  const to = el?.getBoundingClientRect?.();
  if (quiet || !el?.animate || !from?.width || !to?.width) return 0;
  const tx = to.left + to.width / 2;
  const ty = to.top + to.height / 2;
  const dx = from.left + from.width / 2 - tx;
  const dy = from.top + from.height / 2 - ty;
  const s0 = Math.max(0.3, Math.min(1, from.width / to.width));
  // El lugar de la vitrina: el medio de la pantalla, un poco arriba, con la carta a un
  // tercio del alto de la ventana (y nunca más de dos veces y media su tamaño).
  const vw = globalThis.innerWidth || to.right + to.left;
  const vh = globalThis.innerHeight || to.bottom + to.top;
  const sx = vw / 2 - tx;
  const sy = vh * 0.42 - ty;
  const big = Math.max(1.2, Math.min(2.6, (vh * 0.34) / to.height));
  const total = land + 260;
  const at = (ms) => Math.min(1, Math.max(0, ms / total));
  const pose = (x, y, s, z, ry, sy2 = s) =>
    `perspective(900px) translate(${x}px, ${y}px) scale(${s}, ${sy2}) rotate(${z}deg) rotateY(${ry}deg)`;
  const rise = flip * 0.36;
  el.classList.add('is-flying', 'is-epic');
  const fly = el.animate([
    { offset: 0, transform: pose(dx, dy, s0, -side * 12, 180), easing: 'cubic-bezier(.2, .8, .3, 1)' },
    { offset: at(rise), transform: pose(sx, sy, big, side * 4, 180), easing: 'ease-in-out' },
    // el temblequeo: cada vez más grande, cada vez más nervioso
    { offset: at(flip * 0.52), transform: pose(sx - 3, sy - 5, big * 1.03, -side * 3, 180), easing: 'ease-in-out' },
    { offset: at(flip * 0.66), transform: pose(sx + 4, sy + 3, big * 1.05, side * 3, 180), easing: 'ease-in-out' },
    { offset: at(flip * 0.78), transform: pose(sx - 4, sy - 2, big * 1.07, -side * 4, 180), easing: 'ease-in-out' },
    { offset: at(flip * 0.88), transform: pose(sx + 5, sy + 2, big * 1.09, side * 5, 180), easing: 'ease-in' },
    { offset: at(flip - 40), transform: pose(sx, sy, big * 1.1, 0, 180), easing: 'cubic-bezier(.3, 1.6, .5, 1)' },
    // se da vuelta de un golpe y se pasa de tamaño
    { offset: at(flip + 160), transform: pose(sx, sy, big * 1.24, 0, 0), easing: 'ease-out' },
    { offset: at(land - 230), transform: pose(sx, sy, big * 1.16, 0, 0), easing: 'cubic-bezier(.55, 0, .85, .6)' },
    { offset: at(land), transform: pose(0, 4, 1.08, 0, 0, 0.9), easing: 'ease-out' },
    { offset: 1, transform: 'none' },
  ], { duration: total, easing: 'linear' });
  try {
    const edge = at(flip + 70);
    el.animate([{ opacity: 1 }, { offset: edge, opacity: 1 }, { offset: Math.min(1, edge + 0.001), opacity: 0 }, { opacity: 0 }],
      { duration: total, pseudoElement: '::after' });
  } catch { /* sin dorso animado, la carta vuela con la cara */ }
  const done = () => {
    el.classList.add('is-settled');
    el.classList.remove('is-flying', 'is-epic');
  };
  fly.onfinish = done;
  fly.oncancel = done;

  const hue = good ? color : '#ff4a3a';
  // La luz detrás de la carta mientras espera: crece hasta la vuelta.
  stage.add((B, G, age) => {
    const b = stage.box(el);
    if (!b) return;
    const secs = flip / 1000;
    const grow = EASE.inCubic(fxSpan(age, rise / 1000 * 0.6, secs));
    const fade = 1 - fxSpan(age, secs, secs + 0.35);
    if (grow <= 0 || fade <= 0) return;
    fxRays(G, b.cx, b.cy, b.h * (0.9 + 0.5 * grow), '#fff4d6', 0.16 * grow * fade, age * 0.9);
    fxGlow(G, b.cx, b.cy, b.h * (0.7 + 0.4 * grow), '#ffe7b0', 0.3 * grow * fade);
  }, (flip + 400) / 1000);
  // La vuelta: el estallido que dice qué salió.
  stage.add((B, G, age) => {
    const b = stage.box(el);
    if (!b) return;
    const u = b.w / 90;
    fxShock(G, age, 0, b.cx, b.cy, b.h * 1.3, hue, 0.55, 12 * u);
    fxBurst(G, age, {
      x: b.cx, y: b.cy, t0: 0, n: good ? 46 : 30, seed: 57, speed: [320, 1100], life: [0.35, 0.8], drag: 4,
      gravity: good ? 260 : 700, size: [2, 4.5], colors: good ? [color, '#ffffff', '#ffe066'] : [hue, '#ffd2cc', '#5a0d0a'], s: u,
    });
    fxGlow(G, b.cx, b.cy, b.h * 1.2, hue, 0.5 * Math.exp(-age * 4));
  }, 1.1, flip / 1000);
  stage.add((B, G, age) => landing(B, G, age, stage, el, color), 0.9, land / 1000);
  return land;
}

/** Un abanico de rayos de luz alrededor de un punto, girando con `spin`. */
function fxRays(G, x, y, r, color, alpha, spin) {
  G.save();
  G.translate(x, y);
  G.rotate(spin);
  G.globalAlpha = alpha;
  G.fillStyle = color;
  const n = 14;
  for (let i = 0; i < n; i++) {
    G.rotate((Math.PI * 2) / n);
    G.beginPath();
    G.moveTo(0, 0);
    G.lineTo(r, -r * 0.08);
    G.lineTo(r, r * 0.08);
    G.closePath();
    G.fill();
  }
  G.restore();
}

/** La caída: polvo abajo, un anillo, chispas y un destello que se apaga. */
function landing(B, G, age, stage, el, color) {
  const b = stage.box(el);
  if (!b) return;
  const u = b.w / 90;
  const t = age;
  fxPuff(B, t, 0, b.cx, b.y + b.h, b.w * 1.1, '#e8d6bd', 0.5, 7, 6);
  fxShock(G, t, 0, b.cx, b.cy, b.w * 1.1, color, 0.42, 7 * u);
  fxBurst(G, t, {
    x: b.cx, y: b.cy, t0: 0, n: 18, seed: 31, speed: [260, 780], life: [0.25, 0.55], drag: 5, gravity: 500,
    size: [1.5, 3.2], colors: [color, '#ffffff', '#ffe2a8'], s: u,
  });
  const flash = Math.exp(-t * 7);
  if (flash > 0.02) {
    G.save();
    G.globalAlpha = 0.55 * flash;
    G.strokeStyle = '#ffe0a8';
    G.lineWidth = 3 * u;
    roundRect(G, b.x - 2, b.y - 2, b.w + 4, b.h + 4, 10 * u);
    G.stroke();
    G.restore();
    fxGlow(G, b.cx, b.cy, b.w * 0.8, color, 0.22 * flash);
  }
}

function roundRect(x, px, py, w, h, r) {
  x.beginPath();
  x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r);
  x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r);
  x.arcTo(px, py, px + w, py, r);
  x.closePath();
}


/**
 * Las vigas de la cadena, en vivo: cada eslabón se engancha con el anterior en el
 * momento en que cae su carta, del color de su racha. La racha que se murió se queda
 * apagada donde llegó; la viva late en la punta. Es lo que en el tráiler une las patas
 * de carta en carta, pero con las rachas de verdad: una por símbolo de la primera carta.
 *
 * Devuelve lo que el escenario dibuja en cada cuadro (`stage.keep`), así que mide los
 * eslabones cada vez: la fila se corre, se achica y la cámara se mueve.
 *   chainOf()       la cadena que está en la mesa (o null)
 *   bornOf(col)     cuándo cayó la carta de esa columna, en segundos del escenario
 *   surgeOf(t, u)   cuánto brilla de más el punto `u` (0 a 1) del recorrido al atacar
 */
export function chainKeeper(stage, field, chainOf, bornOf, surgeOf = () => 0, bustOf = () => 0) {
  return (B, G, t) => {
    const chain = chainOf();
    if (!chain || chain.cards.length === 0) return;
    // cortada, se queda a media luz mientras la carta busca dónde engancharse, titila
    // justo antes de romperse y se apaga al romperse
    const left = bustOf() + BUST_BREAK - t;
    const flicker = !chain.busted ? 1 : left <= 0 ? 0 : left > 0.35 ? 0.5 : 0.3 + 0.5 * Math.abs(Math.sin(t * 38));
    if (flicker <= 0) return;
    const cards = field.querySelectorAll?.('.strip > .card[data-col]') ?? [];
    chain.runs.forEach((run, r) => {
      const color = SYMBOLS[run.symbol]?.color ?? '#ffffff';
      const pts = [];
      for (let col = 0; col < run.cards && col < cards.length; col++) {
        // la que todavía vuela no tiene dónde engancharse: la viga llega cuando cae
        if (cards[col].classList?.contains('is-flying')) break;
        for (const chip of cards[col].querySelectorAll?.(`.sym[data-sym="${run.symbol}"]`) ?? []) {
          const b = stage.box(chip);
          if (b) pts.push({ ...b, col });
        }
      }
      if (pts.length === 0) return;
      const n = pts.length;
      const dim = (run.alive ? 1 : 0.32) * flicker;
      for (let i = 1; i < n; i++) {
        const a = pts[i - 1];
        const c = pts[i];
        const born = bornOf(c.col);
        const p = EASE.outCubic(fxSpan(t, born, born + 0.2));
        if (p <= 0) continue;
        const surge = surgeOf(t, i / Math.max(1, n - 1));
        const fresh = Math.exp(-Math.max(0, t - born) * 3) * 0.8;
        // de borde a borde de los medallones: el símbolo tiene que seguir leyéndose
        const dx = c.cx - a.cx;
        const dy = c.cy - a.cy;
        const len = Math.hypot(dx, dy) || 1;
        const ra = Math.min(a.w * 0.42, len * 0.3);
        const rc = Math.min(c.w * 0.42, len * 0.3);
        fxBeam(G, a.cx + (dx / len) * ra, a.cy + (dy / len) * ra, c.cx - (dx / len) * rc, c.cy - (dy / len) * rc, color, t, {
          p, heat: dim * (0.75 + 0.15 * Math.sin(t * 5 + i) + fresh * 0.7 + surge * 1.1),
          seed: i + r * 7, bulge: i % 2 ? -0.2 : 0.2, width: Math.max(0.45, c.w / 34),
        });
        // al engancharse, un chispazo en el eslabón que llega
        const since = t - (born + 0.18);
        if (since >= 0 && since < 0.5) {
          fxBurst(G, t, {
            x: c.cx, y: c.cy, t0: born + 0.18, n: 12, seed: 70 + c.col * 3 + r, speed: [160, 520],
            life: [0.2, 0.45], drag: 5, gravity: 200, size: [1.2, 2.6], colors: [color, '#ffffff'], s: c.w / 34,
          });
          fxShock(G, t, born + 0.18, c.cx, c.cy, c.w * 1.1, color, 0.35, 4);
        }
      }
      // la punta viva, una pista y nada más: un eco finito con la forma de la ficha (un
      // aro redondo no calzaba) que se abre despacio y se apaga. Va en la capa de arriba,
      // sin bloom: los brillos fuertes son de los poderes. Ahí se engancha la próxima.
      if (run.alive && !chain.busted) {
        const tip = pts[n - 1];
        const surge = surgeOf(t, 1);
        if (surge > 0.01) fxGlow(G, tip.cx, tip.cy, tip.w * 0.9, color, surge * 0.3);
        const period = 2.4;
        const u = ((((t + r * 0.6) / period) % 1) + 1) % 1;
        const grow = EASE.outCubic(u) * tip.w * 0.14;
        const round = Math.min(tip.w, tip.h) * 0.24;
        B.save();
        B.strokeStyle = color;
        B.globalAlpha = 0.55 * Math.sin(u * Math.PI) * (1 - u);
        B.lineWidth = Math.max(1, tip.w * 0.035);
        roundRect(B, tip.x - grow, tip.y - grow, tip.w + 2 * grow, tip.h + 2 * grow, round + grow * 0.6);
        B.stroke();
        B.restore();
      }
    });
  };
}

/**
 * El recorrido del ataque, como brillo que viaja por las vigas: de la primera carta a
 * la última en el compás que da el motor (ver `aimMs`), y después se queda encendido
 * hasta el golpe.
 */
export function surgeFrom(t0, ms, lead = 0.16, travel = 0.68) {
  const dur = ms / 1000;
  const a = t0 + dur * lead;
  const c = a + dur * travel;
  return (t, u) => {
    if (t < t0 || t > t0 + dur + 0.5) return 0;
    const head = fxSpan(t, a, c);
    const wave = Math.exp(-(((u - head) * 5) ** 2));
    const lit = u <= head ? 0.45 : 0;
    const fade = 1 - fxSpan(t, t0 + dur, t0 + dur + 0.5);
    return (wave + lit) * fade;
  };
}

// =====================================================================
// el golpe
// =====================================================================

const quietNow = () => Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

/** El dibujo de un Axie adentro de su nodo (el nodo ocupa media pantalla). */
const artOf = (portrait) => portrait?.querySelector?.('.axie') ?? null;

/** Cuánto está escalado el mundo en este momento (la cámara lo agranda). */
function scaleOf(el) {
  const r = el?.getBoundingClientRect?.();
  const w = el?.offsetWidth;
  return r?.width && w ? r.width / w : 1;
}

/**
 * La carga: mientras la cadena se recorre, el que va a pegar junta la energía. Un aura
 * que late alrededor y chispas que suben, del color de su clase.
 */
export function chargeFx(stage, portrait, color, secs) {
  const art = artOf(portrait);
  if (!art || !stage.on) return;
  stage.add((B, G, age) => {
    const b = stage.box(art);
    if (!b) return;
    const k = Math.min(1, age / 0.25) * (1 - fxSpan(age, secs - 0.12, secs));
    const u = b.w / 260;
    const beat = 0.5 + 0.5 * Math.sin(age * 14);
    fxGlow(G, b.cx, b.y + b.h * 0.55, b.w * (0.62 + 0.05 * beat), color, 0.18 * k);
    for (let n = 0; n < 16; n++) {
      const life = 0.7;
      const a = (age * 1.2 + fxHash(n, 71) * life) % life;
      const ang = fxHash(n, 72) * Math.PI * 2;
      const rr = b.w * (0.2 + 0.28 * fxHash(n, 73));
      const px = b.cx + Math.cos(ang) * rr;
      const py = b.y + b.h * 0.75 + Math.sin(ang) * rr * 0.3 - (a / life) * b.h * 0.9;
      fxGlow(G, px, py, (5 + 5 * fxHash(n, 74)) * u, color, k * Math.sin((a / life) * Math.PI));
    }
  }, secs);
}

/**
 * El cruce: el Axie se agazapa, sale disparado en arco hasta el rival, pega (se
 * queda un instante clavado: la pausa del impacto) y vuelve de un salto a su lugar.
 * Se mueve el dibujo de verdad (Web Animations), medido contra donde está el otro, así
 * llega hasta él en cualquier pantalla. `approach` es cuánto tarda en llegar y
 * `start`, cuándo sale, los dos en ms.
 */
export const HIT_STOP = 70;
export function lungeAxie(portrait, target, { start = 0, approach = 320, back = 430 } = {}) {
  const art = artOf(portrait);
  const foe = artOf(target);
  if (quietNow() || !art?.animate || !foe) return;
  const t = setTimeout(() => {
    const a = art.getBoundingClientRect?.();
    const b = foe.getBoundingClientRect?.();
    if (!a?.width || !b?.width) return;
    const dir = b.left + b.width / 2 > a.left + a.width / 2 ? 1 : -1;
    const k = scaleOf(art);
    // Se frena delante del otro: las panzas se tocan, no se atraviesan.
    const gap = (b.width * 0.5 + a.width * 0.28) * dir;
    const dx = (b.left + b.width / 2 - (a.left + a.width / 2) - gap) / k;
    const dy = (b.bottom - a.bottom) / k;
    const hop = Math.min(120, Math.abs(dx) * 0.22);
    const total = approach + HIT_STOP + back;
    const o = (ms) => ms / total;
    const frames = [
      { offset: 0, transform: 'none', easing: 'ease-out' },
      { offset: o(approach * 0.26), transform: `translate(${-dir * 16}px, 4px) scale(1.06, .9)`, easing: 'cubic-bezier(.5, 0, .9, .5)' },
      { offset: o(approach * 0.7), transform: `translate(${dx * 0.7}px, ${dy * 0.7 - hop}px) scale(.94, 1.1) rotate(${dir * 6}deg)`, easing: 'cubic-bezier(.3, 0, 1, .7)' },
      { offset: o(approach), transform: `translate(${dx}px, ${dy}px) scale(1.12, .9) rotate(${dir * 3}deg)`, easing: 'linear' },
      { offset: o(approach + HIT_STOP), transform: `translate(${dx}px, ${dy}px) scale(1.1, .92)`, easing: 'cubic-bezier(.3, .6, .5, 1)' },
      { offset: o(approach + HIT_STOP + back * 0.55), transform: `translate(${dx * 0.3}px, ${dy * 0.3 - hop * 0.9}px) scale(.96, 1.06) rotate(${-dir * 8}deg)`, easing: 'cubic-bezier(.5, 0, .8, .6)' },
      { offset: o(approach + HIT_STOP + back * 0.86), transform: 'translate(0, 0) scale(1.08, .9)', easing: 'ease-out' },
      { offset: 1, transform: 'none' },
    ];
    art.animate(frames, { duration: total, easing: 'linear' });
    // La sombra del piso lo sigue y se achica en el aire.
    const floor = portrait;
    for (const pseudo of ['::after', '::before']) {
      try {
        floor.animate([
          { offset: 0, transform: 'translateX(-50%) scale(1)', opacity: 1 },
          { offset: o(approach * 0.7), transform: `translateX(calc(-50% + ${dx * 0.7}px)) scale(.55)`, opacity: 0.4 },
          { offset: o(approach), transform: `translateX(calc(-50% + ${dx}px)) scale(1.05)`, opacity: 1 },
          { offset: o(approach + HIT_STOP), transform: `translateX(calc(-50% + ${dx}px)) scale(1.05)`, opacity: 1 },
          { offset: o(approach + HIT_STOP + back * 0.55), transform: `translateX(calc(-50% + ${dx * 0.3}px)) scale(.6)`, opacity: 0.45 },
          { offset: o(approach + HIT_STOP + back * 0.86), transform: 'translateX(-50%) scale(1.1, .9)', opacity: 1 },
          { offset: 1, transform: 'translateX(-50%) scale(1)', opacity: 1 },
        ], { duration: total, pseudoElement: pseudo });
      } catch { /* sin sombra animada */ }
    }
  }, Math.max(0, start));
  t?.unref?.();
}

/**
 * El impacto sobre el que recibe: el zarpazo del color de quien pega, chispas que
 * salen para el lado del golpe, un anillo y un destello. Más daño, más grande.
 */
export function impactFx(stage, target, color, amount, dir, delay = 0) {
  const art = artOf(target);
  if (!art || !stage.on) return;
  const big = Math.min(1, amount / 30);
  stage.add((B, G, age) => {
    const b = stage.box(art);
    if (!b) return;
    const u = (b.w / 260) * (0.85 + 0.35 * big);
    const cx = b.cx - dir * b.w * 0.08;
    const cy = b.y + b.h * 0.5;
    fxClaws(B, G, age, 0, cx, cy, color, u, dir);
    fxBurst(G, age, {
      x: cx, y: cy, t0: 0, n: 30 + Math.round(40 * big), seed: 90, speed: [400, 1500], life: [0.25, 0.65], drag: 4,
      gravity: 800, size: [2, 4.5], colors: ['#ffe2a8', '#ffffff', color], dir: dir > 0 ? 0 : Math.PI, spread: Math.PI * 1.2, s: u,
    });
    fxBurst(G, age, {
      x: cx, y: cy - 10 * u, t0: 0, n: 6 + Math.round(8 * big), seed: 91, speed: [250, 700], life: [0.45, 0.85], drag: 3,
      gravity: 400, size: [3.5, 6], colors: ['#ffd65c', '#ffffff'], kind: 'star', s: u,
    });
    fxShock(G, age, 0, cx, cy, 300 * u, '#ffd08a', 0.45, 12 * u);
    fxGlow(G, cx, cy, 200 * u, '#fff2d8', 0.55 * Math.exp(-age * 12));
  }, 1.1, delay / 1000);
}

/**
 * El K.O.: el golpe final lo levanta, da una vuelta en el aire y cae panza arriba con
 * las estrellitas del mareo. El dibujo queda así (`fill: forwards`) hasta la partida
 * que viene (`resetAxie`).
 */
export function knockOut(stage, target, dir, delay = 0) {
  const art = artOf(target);
  if (quietNow() || !art?.animate) return;
  // Se guarda para que `resetAxie` la encuentre sin buscarla (ver ahí).
  const down = { timer: 0, anim: null };
  downed.set(art, down);
  down.timer = setTimeout(() => {
    down.timer = 0;
    const k = scaleOf(art);
    const w = (art.getBoundingClientRect?.().width ?? 200) / k;
    const back = dir * w * 0.28;
    // Gira sobre el centro del cuerpo: el dibujo tiene el origen en las patas y dado
    // vuelta desde ahí quedaba enterrado.
    art.style.transformOrigin = '50% 52%';
    down.anim = art.animate([
      { offset: 0, transform: 'none', easing: 'cubic-bezier(.2, .7, .4, 1)' },
      { offset: 0.45, transform: `translate(${back * 0.7}px, ${-w * 0.55}px) rotate(${dir * 120}deg)`, easing: 'cubic-bezier(.6, 0, .9, .5)' },
      { offset: 0.72, transform: `translate(${back}px, ${w * 0.06}px) rotate(${dir * 185}deg) scale(1.08, .9)`, easing: 'ease-out' },
      { offset: 0.84, transform: `translate(${back}px, ${-w * 0.05}px) rotate(${dir * 178}deg)`, easing: 'ease-in' },
      { offset: 1, transform: `translate(${back}px, ${w * 0.04}px) rotate(${dir * 180}deg)` },
    ], { duration: 900, fill: 'forwards' });
    if (!stage.on) return;
    stage.add((B, G, age) => {
      // las estrellitas se van con la revancha
      if (downed.get(art) !== down) return;
      const b = stage.box(art);
      if (!b) return;
      const a = age;
      for (let n = 0; n < 5; n++) {
        const ang = a * 4.2 + (n / 5) * Math.PI * 2;
        const front = Math.sin(ang) > 0;
        const x = b.cx + Math.cos(ang) * b.w * 0.34;
        const y = b.y + b.h * 0.1 + Math.sin(ang) * b.w * 0.07;
        const r = (front ? 14 : 10) * (b.w / 220) * Math.min(1, a / 0.3);
        const img = fxStar('#ffe066');
        if (img) {
          B.save();
          B.globalAlpha = front ? 1 : 0.7;
          B.drawImage(img, x - r, y - r, 2 * r, 2 * r);
          B.restore();
        }
        fxGlow(G, x, y, r * 1.8, '#ffd24a', 0.35);
      }
    }, 6, 0.8);
  }, Math.max(0, delay));
  down.timer?.unref?.();
}

/** La vuelta del K.O. de cada Axie, y el timer que la larga si todavía no salió. */
const downed = new WeakMap();

/**
 * Vuelve a dejar al Axie parado (partida nueva). La vuelta del K.O. se cancela por su
 * referencia y no buscándola con `getAnimations()`: Safari no siempre devuelve una
 * animación terminada que se sostiene con `fill: forwards`, y el Axie arrancaba la
 * revancha panza arriba. Y si el K.O. todavía no había salido —la revancha entró antes
 * que la vuelta—, su timer se corta acá: si no, caía sobre la partida nueva.
 */
export function resetAxie(portrait) {
  const art = artOf(portrait);
  if (!art) return;
  const down = downed.get(art);
  if (down) {
    clearTimeout(down.timer);
    down.anim?.cancel();
    downed.delete(art);
  }
  if (art.style) art.style.transformOrigin = '';
  for (const a of art.getAnimations?.() ?? []) {
    if (a.effect?.getTiming?.().fill === 'forwards') a.cancel();
  }
}

// =====================================================================
// los carteles grandes
// =====================================================================

/**
 * Un cartel grande en letras de a una, como en el tráiler: entra golpeando, se queda
 * y se va. Va en la talla de los carteles de resultado del kit (`FX_FONT.rite`).
 * `style`: 'ko' | 'bust' | 'ask' (la placa de "¿una más?", blanca y fría sobre la mesa
 * apagada). Se dibuja en el escenario, centrado arriba de la mesa.
 */
export function bigWord(stage, text, style = 'ko', delay = 0, hold = 1.4) {
  if (!stage.on) return;
  const look = {
    ko: { fill: ['#fffbe0', '#ffe066', '#ff9d1a'], stroke: '#3b1500', glow: '#ffb02e' },
    bust: { fill: ['#ffffff', '#ffd7d2', '#ff4a3a'], stroke: '#2a0303', glow: '#ff4040' },
    ask: { fill: ['#ffffff', '#eaf4ff', '#9cc8ff'], stroke: '#06142b', glow: '#7fb4ff' },
  }[style];
  stage.add((B, G, age, st) => {
    const W = st.box(B.canvas)?.w ?? 800;
    const size = Math.min(170, W * 0.16);
    const x = W / 2;
    const y = (st.box(B.canvas)?.h ?? 600) * 0.34;
    fxGlow(G, x, y - size * 0.35, size * 2.2, look.glow, 0.35 * Math.exp(-age * 2.5));
    fxText(B, text, x, y, {
      size, font: 'rite', spacing: 0.05, fill: look.fill, stroke: look.stroke, strokeW: 0.09,
      anim: fxBoth(TEXT_IN.slam(age, 0, 0.045, 3, 0.28), TEXT_OUT.shrink(age, hold, 0.02)),
    });
  }, hold + 0.6, delay / 1000);
}


// =====================================================================
// el corte
// =====================================================================

/**
 * Cuándo se rompe la cadena después de que sale la carta que no encaja, en segundos. Es
 * largo a propósito: el jugador tiene que alcanzar a leer qué símbolos le salieron y
 * ver que ninguno engancha antes de que todo vuele. El motor espera lo mismo o más
 * (`BUST_HOLD` en `game.js`).
 */
export const BUST_BREAK = 1.7;

/**
 * La carta que no encaja: cae y se queda quieta a la vista un momento, y después, símbolo
 * por símbolo, desde la punta de cada racha viva sale un haz punteado que lo busca, no
 * engancha y se retira, y el símbolo queda rodeado por un aro rojo que no lo tapa. A los
 * `BUST_BREAK` segundos se rompe la cadena (`onBreak`); la carta que la cortó queda en
 * la mesa, con sus símbolos prendidos y la chapita ✕ (ver `.card--bust`).
 */
export function bustFx(stage, field, chain, onBreak) {
  const land = (FLY_MS * 0.86) / 1000;
  const scan0 = land + 0.3;
  const step = 0.3;
  // La rotura va con su propio reloj: no puede depender de que justo se dibuje un cuadro.
  setTimeout(() => onBreak?.(), BUST_BREAK * 1000)?.unref?.();
  const draw = (B, G, age) => {
    const bust = field.querySelector?.('.strip > .card--bust');
    const cards = field.querySelectorAll?.('.strip > .card[data-col]') ?? [];
    if (!bust || age >= BUST_BREAK) return;
    const card = stage.box(bust);
    // la carta recién caída late una vez en rojo: "esta es"
    if (card) {
      const k = fxSpan(age, land, land + 0.5);
      if (k > 0 && k < 1) fxGlow(G, card.cx, card.cy, card.w * 1.3, '#ff4a3a', 0.2 * Math.sin(k * Math.PI));
    }
    const targets = [...(bust.querySelectorAll?.('.sym') ?? [])].map((c) => stage.box(c)).filter(Boolean);
    const tips = chain.runs.filter((r) => r.alive).map((run) => {
      const chips = cards[run.cards - 1]?.querySelectorAll?.(`.sym[data-sym="${run.symbol}"]`) ?? [];
      const tip = chips.length ? stage.box(chips[chips.length - 1]) : null;
      return tip && { tip, color: SYMBOLS[run.symbol]?.color ?? '#ffffff' };
    }).filter(Boolean);
    targets.forEach((to, k) => {
      const a0 = scan0 + k * step;
      // el haz va, no engancha y se retira
      const reach = EASE.outCubic(fxSpan(age, a0, a0 + 0.22));
      const gone = fxSpan(age, a0 + 0.3, a0 + 0.5);
      if (reach > 0 && gone < 1) {
        tips.forEach(({ tip, color }, r) => {
          const ex = lerpFx(tip.cx, to.cx, reach * 0.82);
          const ey = lerpFx(tip.cy, to.cy, reach * 0.82);
          G.save();
          G.setLineDash([6, 7]);
          G.lineDashOffset = -age * 140;
          G.lineWidth = Math.max(1.5, tip.w * 0.06);
          G.globalAlpha = 0.6 * (1 - gone) * (0.7 + 0.3 * Math.sin(age * 30 + r));
          G.strokeStyle = color;
          G.beginPath();
          G.moveTo(tip.cx, tip.cy);
          G.lineTo(ex, ey);
          G.stroke();
          G.restore();
        });
      }
      // y el símbolo queda marcado sin taparlo: un aro rojo punteado alrededor (la cruz
      // es una sola, la chapita de la carta, ver `.card--bust::after`)
      const xp = fxSpan(age, a0 + 0.2, a0 + 0.32);
      if (xp <= 0) return;
      B.save();
      B.globalAlpha = 0.9;
      B.setLineDash([to.w * 0.14, to.w * 0.08]);
      B.lineWidth = Math.max(1.5, to.w * 0.055);
      B.strokeStyle = '#ff5a48';
      B.beginPath();
      B.arc(to.cx, to.cy, to.w * 0.56 * EASE.outBack(xp), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * EASE.outCubic(xp));
      B.stroke();
      B.restore();
    });
  };
  stage.add(draw, BUST_BREAK + 0.05);
}

/**
 * Rompe la fila en pedazos: cada carta se copia en fragmentos recortados (`clip-path`
 * con las celdas de `FX_SHARDS`) que salen volando, giran, caen y se apagan. Son las
 * cartas de verdad, rotas; las de la mesa se esconden hasta que la mesa cambie.
 */
export function shatterCards(stage, field, host) {
  // la carta que cortó no se rompe: se queda a la vista (ver `.field[data-shattered]`)
  const cards = [...(field.querySelectorAll?.('.strip > .card:not(.card--bust)') ?? [])];
  const hb = host?.getBoundingClientRect?.();
  // Sin movimiento la cadena no se rompe: se queda apagada en su lugar (ver `.card--bust`).
  if (quietNow() || !cards.length || !hb || !document?.createElement) return;
  const layer = document.createElement('div');
  layer.className = 'shards';
  layer.setAttribute('aria-hidden', 'true');
  host.appendChild(layer);
  cards.forEach((el, ci) => {
    const r = el.getBoundingClientRect?.();
    if (!r?.width || !el.cloneNode) return;
    FX_SHARDS.forEach((sh, i) => {
      const piece = el.cloneNode(true);
      piece.classList.add('shard', 'is-settled');
      piece.classList.remove('is-flying');
      const poly = sh.pts.map(([x, y]) => `${((sh.cx + x + 0.5) * 100).toFixed(1)}% ${(((sh.cy + y) / 1.4 + 0.5) * 100).toFixed(1)}%`).join(', ');
      piece.style.cssText = `position:absolute;left:${r.left - hb.left}px;top:${r.top - hb.top}px;width:${r.width}px;height:${r.height}px;margin:0;clip-path:polygon(${poly})`;
      layer.appendChild(piece);
      const w = r.width;
      const ang = Math.atan2(sh.cy, sh.cx) + (fxHash(ci * 13 + 5, i) - 0.5) * 0.8;
      const sp = fxRand(1.2, 3.2, ci * 13 + 5, i, 2) * w;
      const spin = (fxHash(ci * 13 + 5, i, 3) - 0.5) * 540;
      const frames = [];
      for (let k = 0; k <= 8; k++) {
        const a = (k / 8) * 0.9;
        const dx = Math.cos(ang) * sp * a;
        const dy = Math.sin(ang) * sp * a - 1.9 * w * a + 7.5 * w * a * a;
        frames.push({ transform: `translate(${dx}px, ${dy}px) rotate(${spin * a}deg)`, opacity: a < 0.45 ? 1 : 1 - (a - 0.45) / 0.45 });
      }
      piece.animate?.(frames, { duration: 900, easing: 'linear', fill: 'forwards' });
    });
    // chispas donde estaba la carta
    if (stage.on) {
      const b = { cx: r.left - hb.left + r.width / 2, cy: r.top - hb.top + r.height / 2, w: r.width };
      stage.add((B, G, age) => {
        fxBurst(G, age, {
          x: b.cx, y: b.cy, t0: ci * 0.02, n: 14, seed: 700 + ci, speed: [200, 700], life: [0.3, 0.7], drag: 3,
          gravity: 900, size: [1.5, 3], colors: ['#ffe9e0', '#ffffff', '#ff6a5c'], s: b.w / 70,
        });
      }, 0.9);
    }
  });
  field.dataset.shattered = 'true';
  setTimeout(() => layer.remove(), 1000)?.unref?.();
}

// =====================================================================
// la entrada
// =====================================================================

/**
 * El Axie cae a la arena desde arriba, como en el cara a cara del tráiler: se estira en
 * el aire, se aplasta al tocar el piso, rebota y levanta polvo. Devuelve cuándo toca el
 * piso, en ms (0 si no hubo caída).
 */
export function dropIn(stage, portrait, delay = 0) {
  const art = artOf(portrait);
  if (quietNow() || !art?.animate) return 0;
  const fall = 380;
  art.animate([
    { offset: 0, transform: 'translateY(-110vh) scale(.88, 1.2)', opacity: 1, easing: 'cubic-bezier(.55, 0, 1, .45)' },
    { offset: 0.5, transform: 'translateY(0) scale(1.22, .74)', easing: 'cubic-bezier(.2, .8, .3, 1)' },
    { offset: 0.68, transform: 'translateY(-9%) scale(.94, 1.08)', easing: 'ease-in' },
    { offset: 0.84, transform: 'translateY(0) scale(1.05, .95)', easing: 'ease-out' },
    { offset: 1, transform: 'none' },
  ], { duration: fall * 2, delay, fill: 'backwards' });
  if (stage.on) {
    stage.add((B, G, age) => {
      const b = stage.box(art);
      if (!b) return;
      const u = b.w / 240;
      const feet = b.y + b.h * 0.97;
      fxPuff(B, age, 0, b.cx, feet, b.w * 0.9, '#efe2cf', 0.6, 11, 7);
      fxShock(G, age, 0, b.cx, feet - 6 * u, b.w * 0.95, '#fff0d0', 0.45, 9 * u);
      fxBurst(G, age, {
        x: b.cx, y: feet - 10 * u, t0: 0, n: 22, seed: 12, speed: [260, 820], life: [0.3, 0.6], drag: 4, gravity: 900,
        size: [1.6, 3.4], colors: ['#ffe6c0', '#ffffff'], dir: -Math.PI / 2, spread: 2.4, s: u,
      });
    }, 0.9, (delay + fall) / 1000);
  }
  return delay + fall;
}
