// Los Axies en el lienzo: la misma pila de capas que arma `axieArt()` en el juego, con
// las mismas animaciones horneadas del kit (`axie-poses.js`), pero dibujadas cuadro a
// cuadro. En la página del juego las mueve la Web Animations API; acá cada pose es una
// función del segundo, así el desenfoque de movimiento las agarra en el aire.
import { AVATARS } from '../../src/axie-avatars.js';
import { MOTIONS, POSES, TRACKS, VARIANTS } from '../../src/axie-poses.js';
import { img } from './assets.js';
import { DEG, clamp } from './core.js';

const PARTS =
  /(leg-front-left|leg-front-right|leg-back-left|leg-back-right|body|tail|ear-left|ear-right|back|horn|eyes|mouth)/;
const partOf = (src) => src.replace('body-normal/', '').match(PARTS)?.[1] ?? 'body';

/** Una pista `[[dx, dy, giro], ...]` en el punto `p` (0 a 1), con los cuadros repartidos parejo. */
function sample(track, p) {
  const n = track.length;
  if (n === 1) return track[0];
  const x = clamp(p) * (n - 1);
  const i = Math.min(n - 2, Math.floor(x));
  const f = x - i;
  const a = track[i];
  const c = track[i + 1];
  return [a[0] + (c[0] - a[0]) * f, a[1] + (c[1] - a[1]) * f, a[2] + (c[2] - a[2]) * f];
}

/** Qué dibujo lleva un slot en el punto `p` del clip. Los cambios son de golpe, como en el kit. */
function swapAt(swaps, slot, p) {
  let att = slot;
  for (const [at, name] of swaps ?? []) if (p >= at) att = name;
  return att;
}

/**
 * En qué punto de su clip está un Axie. `ct` son los segundos desde que arrancó el
 * clip; los bucles dan la vuelta y los demás se quedan en el último cuadro.
 */
export function clipPoint(id, clip, ct) {
  const c = POSES[id]?.[clip];
  if (!c) return 0;
  const rate = MOTIONS[clip]?.rate ?? 1;
  const x = (Math.max(0, ct) * rate) / c.dur;
  return MOTIONS[clip]?.loop ? x - Math.floor(x) : clamp(x);
}

/** Cuánto dura un clip, en segundos de reloj. */
export const clipDur = (clip, id = 'buba') => (POSES[id]?.[clip]?.dur ?? 1) / (MOTIONS[clip]?.rate ?? 1);

/**
 * Dibuja un Axie parado en (x, y) —el punto entre las patas— con `h` píxeles de alto.
 *
 *   clip, ct     la animación del kit y cuántos segundos lleva
 *   face         'left' (como viene dibujado) o 'right'
 *   eyes, mouth  para forzar un dibujo: 'eyes-happy', 'mouth-open', ...
 *   sx, sy, rot  el aplastado y el giro de la puesta en escena, desde las patas
 */
export function drawAxie(x, id, o = {}) {
  const art = AVATARS[id];
  if (!art) return;
  const {
    px = 0, py = 0, h = 300, clip = 'idle', ct = 0, face = 'left',
    eyes = null, mouth = null, sx = 1, sy = 1, rot = 0, alpha = 1, shadow = 0.35,
  } = o;
  const H = h;
  const Wd = art.ratio * h;
  const c = POSES[id]?.[clip];
  const p = clipPoint(id, clip, ct);
  x.save();
  x.globalAlpha *= alpha;
  if (shadow > 0) {
    x.save();
    x.fillStyle = `rgba(0,0,0,${shadow})`;
    x.beginPath();
    x.ellipse(px, py + h * 0.01, Wd * 0.36 * sx, h * 0.06, 0, 0, Math.PI * 2);
    x.fill();
    x.restore();
  }
  x.translate(px, py);
  x.rotate(rot);
  x.scale(sx * (face === 'right' ? -1 : 1), sy);
  x.translate(-Wd / 2, -H);
  if (c) {
    const [rx, ry, rr] = sample(TRACKS[c.root] ?? [[0, 0, 0]], p);
    x.translate(Wd / 2 + (rx / 100) * Wd, H / 2 + (ry / 100) * H);
    x.rotate(rr * DEG);
    x.translate(-Wd / 2, -H / 2);
  }
  const bag = VARIANTS[id] ?? {};
  for (const l of art.layers) {
    const slot = partOf(l.src);
    let att = slot;
    if (slot === 'eyes' && eyes) att = eyes;
    else if (slot === 'mouth' && mouth) att = mouth;
    else if (c) att = swapAt(c.swaps?.[slot], slot, p);
    const v = att !== slot ? bag[att] : null;
    const box = v ?? l;
    const im = img[box.src];
    if (!im) continue;
    const bw = box.w * Wd;
    const bh = box.h * H;
    let dx = 0;
    let dy = 0;
    let dr = 0;
    const tid = c?.parts?.[att];
    if (tid !== undefined) [dx, dy, dr] = sample(TRACKS[tid], p);
    x.save();
    x.translate(box.x * Wd + bw / 2 + (dx / 100) * bw, box.y * H + bh / 2 + (dy / 100) * bh);
    if (dr) x.rotate(dr * DEG);
    x.drawImage(im, -bw / 2, -bh / 2, bw, bh);
    x.restore();
  }
  x.restore();
}

/** Ancho de un Axie dibujado a `h` de alto. */
export const axieWidth = (id, h) => (AVATARS[id]?.ratio ?? 1.25) * h;
