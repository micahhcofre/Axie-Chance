// El montaje: qué escena va en cada instante, el temblor de cámara de los golpes y el
// revelado (color, bloom, barras, fogonazos) a lo largo del reel. El guion con los
// tiempos está en `script.js`; cada escena, en su módulo.
import { W, H, b, bspan, span, lerp, E, pulse, noise1 } from './core.js';
import { CUE, IMPACTS, TEXT } from './script.js';
import { sceneDuel } from './duel.js';
import { scenePowers } from './powers.js';
import { sceneLogo, converge } from './title.js';

export { CUE, TEXT };

/** El temblor de cámara: la suma de todos los golpes todavía vivos. */
export function shakeAt(t) {
  let sx = 0;
  let sy = 0;
  let r = 0;
  for (const [bt, s] of IMPACTS) {
    const t0 = b(bt);
    const a = t - t0;
    if (a < 0 || a > 0.7) continue;
    const env = s * Math.exp(-a * 8) * (1 - a / 0.7);
    sx += noise1(a * 34, bt * 13) * 30 * env;
    sy += noise1(a * 34, bt * 13 + 5) * 30 * env;
    r += noise1(a * 26, bt * 13 + 9) * 0.014 * env;
  }
  return { sx, sy, r };
}

/** Dibuja el instante `t` en la escena `B` y la capa emisiva `G`. */
export function frame(B, G, t, lang = 'es') {
  const L = { ...TEXT[lang], lang };
  B.setTransform(1, 0, 0, 1, 0, 0);
  G.setTransform(1, 0, 0, 1, 0, 0);
  B.globalAlpha = 1; G.globalAlpha = 1;
  B.globalCompositeOperation = 'source-over';
  G.globalCompositeOperation = 'source-over';
  B.fillStyle = '#04040a';
  B.fillRect(0, 0, W, H);
  G.fillStyle = '#000000';
  G.fillRect(0, 0, W, H);
  G.globalCompositeOperation = 'lighter';

  const sh = shakeAt(t);
  B.save(); G.save();
  B.translate(W / 2 + sh.sx, H / 2 + sh.sy); B.rotate(sh.r); B.translate(-W / 2, -H / 2);
  G.translate(W / 2 + sh.sx, H / 2 + sh.sy); G.rotate(sh.r); G.translate(-W / 2, -H / 2);

  // los dos cambios de escena son un empuje: la nueva entra por la derecha y saca a la otra
  const [p1a, p1b] = CUE.push1;
  const [p2a, p2b] = CUE.push2;
  if (t < b(p1a)) sceneDuel(B, G, t, L);
  else if (t < b(p1b)) push(B, G, E.inOutCubic(bspan(t, p1a, p1b)), () => sceneDuel(B, G, t, L), () => scenePowers(B, G, t, L));
  else if (t < b(p2a)) scenePowers(B, G, t, L);
  else if (t < b(p2b)) push(B, G, E.inOutCubic(bspan(t, p2a, p2b)), () => scenePowers(B, G, t, L), () => sceneDuel(B, G, t, L));
  else if (t < b(CUE.logo)) sceneDuel(B, G, t, L);
  if (t >= b(CUE.converge) && t < b(CUE.logo)) converge(B, G, t);
  if (t >= b(CUE.logo)) sceneLogo(B, G, t, L);

  B.restore(); G.restore();
}

/** Dibuja la escena que se va corrida a la izquierda y la que llega, a la derecha. */
function push(B, G, p, drawOut, drawIn) {
  for (const [dx, draw] of [[-W * p, drawOut], [W * (1 - p), drawIn]]) {
    B.save(); G.save();
    B.translate(dx, 0); G.translate(dx, 0);
    B.beginPath(); B.rect(0, 0, W, H); B.clip();
    G.beginPath(); G.rect(0, 0, W, H); G.clip();
    draw();
    B.restore(); G.restore();
  }
}

// =====================================================================
// el revelado a lo largo del tiempo
// =====================================================================

const hex3 = (col) => col.match(/\w\w/g).map((h) => parseInt(h, 16) / 255);

export function postAt(t, base) {
  const fx = {
    ...base, lift: [...base.lift], gain: [...base.gain], tint: [...base.tint], flash: [1, 1, 1, 0], shocks: [],
  };
  // gradación por tramo: la meseta tibia, Puffy más frío, los poderes neutros
  let tint = [1.04, 1.0, 0.94];
  if (t >= b(CUE.turnB) && t < b(CUE.powers)) tint = [0.97, 1.0, 1.04];
  if (t >= b(CUE.powers) && t < b(CUE.turnC)) tint = [1, 1, 1];
  if (t >= b(CUE.short) && t < b(CUE.drop)) {
    const k = bspan(t, CUE.short, CUE.drop - 0.1);
    tint = [1.04 + k * 0.08, 1 - k * 0.06, 0.95 - k * 0.1];
  }
  fx.tint = tint;
  // el corte: se lava el color
  const tb = b(CUE.bust);
  if (t >= tb && t < b(CUE.powers)) {
    const k = E.outCubic(span(t, tb, tb + 0.35)) * (1 - span(t, b(CUE.ceroOut), b(CUE.push1[0])));
    fx.sat = lerp(base.sat, 0.3, k);
    fx.contrast = lerp(base.contrast, 1.1, k);
    fx.glitch = (1 - span(t, tb, tb + 0.55)) * 0.9 + (t > tb + 0.26 && t < tb + 0.32 ? 0.5 : 0);
    fx.ca += (1 - span(t, tb, tb + 0.6)) * 14;
  }
  // la tentación: más contraste, menos color, barras de cine
  if (t >= b(CUE.short) && t < b(CUE.drop)) {
    const k = bspan(t, CUE.una, CUE.drop - 0.1);
    fx.sat = lerp(base.sat, 0.72, k);
    fx.contrast = lerp(base.contrast, 1.16, k);
    fx.vignette = lerp(base.vignette, 1.0, k);
    fx.ca += k * 3;
    fx.letterbox = E.inOutCubic(bspan(t, CUE.una, CUE.una + 1.2)) * 0.09;
    fx.exposure = 1 - k * 0.12;
  }
  // el drop: todo se abre
  const d0 = b(CUE.drop);
  if (t >= d0 && t < b(CUE.logo)) {
    const k = Math.exp(-(t - d0) * 2.5);
    fx.sat = base.sat + 0.18 + k * 0.1;
    fx.bloom = base.bloom + k * 0.45;
    fx.letterbox = 0.09 * (1 - E.outExpo(span(t, d0, d0 + 0.18)));
    fx.zoomBlur = 0.12 * Math.exp(-(t - d0) * 9);
    fx.zoomCenter = [0.5, 1 - 660 / H];
    fx.exposure = 1 + k * 0.06;
  }
  for (const hit of [CUE.hitA, CUE.hit]) {
    const th = b(hit);
    if (t >= th && t < th + 0.6) {
      fx.zoomBlur = Math.max(fx.zoomBlur, 0.07 * Math.exp(-(t - th) * 14));
      fx.zoomCenter = [1440 / W, 1 - 720 / H];
    }
  }
  // los golpes: fogonazo, onda y aberración
  for (const [bt, s, x = 960, y = 540, col = '#ffffff'] of IMPACTS) {
    const t0 = b(bt);
    const a = t - t0;
    if (a < -0.02 || a > 0.8) continue;
    fx.exposure *= 1 + pulse(t, t0, 9) * s * 0.55;
    const fl = pulse(t, t0, 26) * s;
    if (fl > fx.flash[3]) {
      const c = hex3(col);
      fx.flash = [c[0], c[1], c[2], Math.min(0.35, fl * 0.22)];
    }
    fx.ca += pulse(t, t0, 7) * s * 9;
    if (a >= 0 && fx.shocks.length < 4) {
      const p = a / 0.8;
      fx.shocks.push([x, y, E.outCubic(p) * 1500 * (0.4 + s * 0.6), s * 34 * (1 - p) ** 2]);
    }
  }
  // el título: fogonazo blanco de entrada y fundido final
  const lt = b(CUE.logo);
  if (t >= b(CUE.converge) && t < lt + 0.6) {
    const f = t < lt ? E.inQuad(span(t, lt - 0.35, lt)) : 1 - E.outCubic(span(t, lt, lt + 0.55));
    fx.flash = [1, 1, 1, Math.max(fx.flash[3], f * 0.95)];
  }
  fx.fade = E.inQuad(span(t, b(CUE.end) - 0.45, b(CUE.end)));
  // al principio, de a poco sale del negro
  fx.exposure *= lerp(0.35, 1, E.outCubic(span(t, 0, b(2))));
  return fx;
}
