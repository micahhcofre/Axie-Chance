// Lo que el reel dibuja: fotos, texturas del kit y las piezas que se pintan una sola vez
// al cargar —medallones de clase, cartas de nogal, dorsos, pedazos del logo—.
//
// Los crests del juego miden 40 px: en un plano de cine se deshacen. Acá se redibujan
// en vector a partir de los mismos (pata, pez, pluma, brote, mariposa y pata de geco,
// el medallón de diez lados con su aro claro), así aguantan un primerísimo primer plano.
import { AVATARS } from '../../src/axie-avatars.js';
import { VARIANTS } from '../../src/axie-poses.js';
import { TAU, hexRgb, mixHex, rng } from './core.js';

export const CLASS_IDS = ['beast', 'aquatic', 'bird', 'plant', 'bug', 'reptile'];

/**
 * Las seis clases: el color del juego (`SYMBOLS` en `data.js`) y la paleta del crest.
 * `axie` es su starter de Origins; `bg`, su bioma.
 */
export const CLASSES = {
  beast: { color: '#f5b53d', rim: '#ffc15a', rimDark: '#c56a12', core: '#c4611c', edge: '#5e2305', glyph: '#ffa947', glyphHi: '#ffe2a8', axie: 'buba', name: { es: 'BESTIA', en: 'BEAST' } },
  aquatic: { color: '#4bb8f0', rim: '#77ecff', rimDark: '#1c8fc7', core: '#1d77b5', edge: '#0a2c56', glyph: '#5ad6ff', glyphHi: '#d2f7ff', axie: 'puffy', name: { es: 'PEZ', en: 'AQUATIC' } },
  bird: { color: '#ff7bac', rim: '#ffa6d6', rimDark: '#d0467f', core: '#ad3775', edge: '#4a0e32', glyph: '#ff8ccd', glyphHi: '#ffdaf0', axie: 'momo', name: { es: 'PÁJARO', en: 'BIRD' } },
  plant: { color: '#54cf8b', rim: '#e2f76a', rimDark: '#7fae16', core: '#57951c', edge: '#1d4a0a', glyph: '#bdef6a', glyphHi: '#f3ffd2', axie: 'olek', name: { es: 'PLANTA', en: 'PLANT' } },
  bug: { color: '#ff6a5c', rim: '#ff8266', rimDark: '#c02b1d', core: '#9f1f1d', edge: '#46060b', glyph: '#ff6d40', glyphHi: '#ffc9ad', axie: 'pomodoro', name: { es: 'BICHO', en: 'BUG' } },
  reptile: { color: '#a97cff', rim: '#dcb8ff', rimDark: '#7b4fd0', core: '#744bcb', edge: '#2e1670', glyph: '#d0a8ff', glyphHi: '#f3e8ff', axie: 'venoki', name: { es: 'REPTIL', en: 'REPTILE' } },
};

/** Los doce poderes: su amuleto de `Icons/` y la clase a la que pertenecen. */
export const POWERS = [
  ['strength', 'beast'], ['brutal', 'beast'], ['octopus', 'aquatic'], ['bubble', 'aquatic'],
  ['egg', 'bird'], ['feather', 'bird'], ['pot', 'plant'], ['leaf', 'plant'],
  ['snail', 'bug'], ['leech', 'bug'], ['poison', 'reptile'], ['steelskin', 'reptile'],
];

export const STARTER_IDS = ['buba', 'puffy', 'momo', 'olek', 'pomodoro', 'venoki'];

const TEX = [
  'glow', 'circle_boke01', 'circle_soft01', 'Tx_Spark_512', 'Tx_ring222', 'light_Ray_01_TX', 'lightray3',
  'Crack_TX', 'Break_TX', 'Confetti_Tx', 'explosion_spritesheet_3x3', 'Slash_Ray_TX', 'Tx_Glow_4',
  'Spark_Stretch_TX', 'Circle_Nova_TX', 'SmokeStylize_TX', 'Glow_Buff_02_TX', 'Star_TX_FX', 'Lightning_2x2_02_TX',
];
const BGS = ['beast', 'aquatic', 'bird', 'plant', 'bug', 'reptile', 'night'];

export const img = {}; // nombre → HTMLImageElement
export const tex = {}; // textura del kit → HTMLImageElement

function load(url) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`no cargó ${url}`));
    im.src = url;
  });
}

/** Todas las capas de los seis starters, con sus dibujos alternativos. */
function axieUrls() {
  const set = new Set();
  for (const id of STARTER_IDS) {
    for (const l of AVATARS[id].layers) set.add(l.src);
    for (const v of Object.values(VARIANTS[id] ?? {})) set.add(v.src);
  }
  return [...set];
}

export async function loadAll(onProgress = () => {}) {
  const jobs = [];
  const add = (key, url, into = img) => jobs.push(() => load(url).then((im) => { into[key] = im; }));
  for (const t of TEX) add(t, `assets/tex/${t}.png`, tex);
  for (const g of BGS) add(`bg:${g}`, `assets/bg/${g}.jpg`);
  for (const src of axieUrls()) add(src, `../${src}`);
  for (const [p] of POWERS) add(`power:${p}`, `../Icons/power-${p}.png`);
  for (const s of ['poison', 'leaf']) add(`status:${s}`, `../Icons/status-${s}.png`);
  add('shield', '../Icons/shield.png');
  add('logo', '../logo/Axie%20Chance.png');
  let done = 0;
  await Promise.all(jobs.map((job) => job().then(() => onProgress(++done / jobs.length))));
  await Promise.all([
    document.fonts.load('400 120px "Lilita One"'),
    document.fonts.load('900 60px "Archivo"'),
    document.fonts.load('800 60px "Archivo"'),
  ]);
  buildSprites();
}

// ---- lienzos auxiliares ----

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

const tintCache = new Map();
/** Una textura blanca del kit, teñida de un color. Para dibujar en modo aditivo. */
export function tinted(name, hex) {
  const key = `${name}|${hex}`;
  let c = tintCache.get(key);
  if (c) return c;
  const src = tex[name];
  c = canvas(src.width, src.height);
  const x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = hex;
  x.fillRect(0, 0, c.width, c.height);
  // El centro de los brillos queda casi blanco: un tinte parejo los aplana.
  x.globalCompositeOperation = 'lighter';
  x.globalAlpha = 0.35;
  const core = canvas(src.width, src.height);
  const cx = core.getContext('2d');
  cx.drawImage(src, 0, 0);
  cx.globalCompositeOperation = 'source-in';
  const g = cx.createRadialGradient(src.width / 2, src.height / 2, 0, src.width / 2, src.height / 2, src.width / 2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.35, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = g;
  cx.fillRect(0, 0, src.width, src.height);
  x.drawImage(core, 0, 0);
  tintCache.set(key, c);
  return c;
}

/** Un brillo redondo de un color, hecho con gradiente: sale más limpio que escalar un PNG. */
const glowCache = new Map();
export function glowDot(hex, soft = 0.5) {
  const key = `${hex}|${soft}`;
  let c = glowCache.get(key);
  if (c) return c;
  c = canvas(256, 256);
  const x = c.getContext('2d');
  const [r, g, bb] = hexRgb(hex);
  const grad = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, `rgba(${r},${g},${bb},1)`);
  grad.addColorStop(soft * 0.5, `rgba(${r},${g},${bb},0.55)`);
  grad.addColorStop(soft, `rgba(${r},${g},${bb},0.18)`);
  grad.addColorStop(1, `rgba(${r},${g},${bb},0)`);
  x.fillStyle = grad;
  x.fillRect(0, 0, 256, 256);
  glowCache.set(key, c);
  return c;
}

// ---- los glifos de las clases, en una caja de 100 x 100 ----

function ellipsePath(p, cx, cy, rx, ry, rot) {
  p.moveTo(cx + rx * Math.cos(rot), cy + rx * Math.sin(rot));
  p.ellipse(cx, cy, rx, ry, rot, 0, TAU);
}

function glyphPath(cls) {
  const p = new Path2D();
  switch (cls) {
    case 'beast': {
      p.addPath(new Path2D('M50 49 C64 49 79 61 78 74 C77 85 66 88 58 84 C54 82 46 82 42 84 C34 88 23 85 22 74 C21 61 36 49 50 49 Z'));
      ellipsePath(p, 24, 47, 8.2, 10.5, -0.45);
      ellipsePath(p, 39, 30, 8.8, 11.5, -0.14);
      ellipsePath(p, 61, 30, 8.8, 11.5, 0.14);
      ellipsePath(p, 76, 47, 8.2, 10.5, 0.45);
      break;
    }
    case 'aquatic': {
      p.addPath(new Path2D('M10 52 C18 30 44 24 63 41 C66 46 66 56 63 61 C44 78 18 72 10 52 Z'));
      p.addPath(new Path2D('M57 51 L88 28 C83 42 82 58 88 74 Z'));
      p.addPath(new Path2D('M28 35 C33 20 48 17 55 29 Z'));
      p.addPath(new Path2D('M34 66 C38 76 46 80 52 70 Z'));
      break;
    }
    case 'bird': {
      p.addPath(new Path2D('M27 77 C22 55 40 27 80 12 C84 36 70 66 33 81 Z'));
      p.addPath(new Path2D('M18 90 L22 86 L34 72 L37 75 L25 89 L21 93 Z'));
      break;
    }
    case 'plant': {
      p.addPath(new Path2D('M46.5 90 C46 76 47 62 49 50 L54 50 C53 62 53 76 54.5 90 Z'));
      p.addPath(new Path2D('M50 54 C40 62 18 58 10 38 C26 28 46 34 50 54 Z'));
      p.addPath(new Path2D('M52 51 C55 31 74 18 92 25 C88 46 69 58 52 51 Z'));
      break;
    }
    case 'bug': {
      p.addPath(new Path2D('M47 47 C36 18 12 14 9 32 C7 47 25 56 46 53 Z'));
      p.addPath(new Path2D('M53 47 C64 18 88 14 91 32 C93 47 75 56 54 53 Z'));
      p.addPath(new Path2D('M47 56 C31 59 20 71 28 82 C36 90 46 76 48 62 Z'));
      p.addPath(new Path2D('M53 56 C69 59 80 71 72 82 C64 90 54 76 52 62 Z'));
      ellipsePath(p, 50, 57, 4.2, 19, 0);
      break;
    }
    case 'reptile': {
      p.addPath(new Path2D('M50 90 C35 90 29 77 34 67 C39 58 61 58 66 67 C71 77 65 90 50 90 Z'));
      const toes = [[-2.62, 38], [-2.0, 42], [-1.14, 42], [-0.52, 38]];
      for (const [a, len] of toes) {
        const x0 = 50 + Math.cos(a) * 8;
        const y0 = 70 + Math.sin(a) * 8;
        const x1 = 50 + Math.cos(a) * len;
        const y1 = 70 + Math.sin(a) * len;
        const nx = -Math.sin(a) * 4.2;
        const ny = Math.cos(a) * 4.2;
        const toe = new Path2D();
        toe.moveTo(x0 + nx, y0 + ny);
        toe.lineTo(x1 + nx * 0.8, y1 + ny * 0.8);
        toe.lineTo(x1 - nx * 0.8, y1 - ny * 0.8);
        toe.lineTo(x0 - nx, y0 - ny);
        toe.closePath();
        p.addPath(toe);
        const pad = new Path2D();
        pad.arc(x1 + Math.cos(a) * 3, y1 + Math.sin(a) * 3, 8.5, 0, TAU);
        p.addPath(pad);
      }
      break;
    }
    default:
      break;
  }
  return p;
}

/** Los detalles oscuros que van encima del glifo (nervaduras, espirales, ojos). */
function glyphDetail(x, cls, ink) {
  x.save();
  x.strokeStyle = ink;
  x.fillStyle = ink;
  x.lineCap = 'round';
  x.lineJoin = 'round';
  switch (cls) {
    case 'aquatic':
      x.beginPath(); x.arc(24, 48, 4.2, 0, TAU); x.fill();
      x.lineWidth = 2.2; x.globalAlpha = 0.55;
      x.beginPath(); x.moveTo(46, 36); x.quadraticCurveTo(52, 50, 46, 64); x.stroke();
      break;
    case 'bird':
      x.lineWidth = 2.6; x.globalAlpha = 0.6;
      x.beginPath(); x.moveTo(34, 74); x.quadraticCurveTo(52, 50, 76, 17); x.stroke();
      x.lineWidth = 2; x.globalAlpha = 0.45;
      for (const [a, c] of [[[44, 62], [60, 58]], [[52, 50], [69, 44]], [[40, 60], [34, 52]], [[50, 46], [46, 36]]]) {
        x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(c[0], c[1]); x.stroke();
      }
      break;
    case 'plant':
      x.lineWidth = 2; x.globalAlpha = 0.5;
      x.beginPath(); x.moveTo(48, 52); x.quadraticCurveTo(32, 46, 16, 39); x.stroke();
      x.beginPath(); x.moveTo(54, 49); x.quadraticCurveTo(70, 36, 88, 27); x.stroke();
      break;
    case 'bug':
      x.globalAlpha = 0.5;
      x.beginPath(); x.arc(26, 34, 4.5, 0, TAU); x.arc(74, 34, 4.5, 0, TAU); x.fill();
      x.globalAlpha = 1; x.lineWidth = 2.4;
      x.strokeStyle = x.fillStyle;
      x.beginPath(); x.moveTo(48, 40); x.quadraticCurveTo(44, 30, 38, 24); x.moveTo(52, 40); x.quadraticCurveTo(56, 30, 62, 24); x.stroke();
      break;
    case 'reptile':
      x.globalAlpha = 0.55; x.lineWidth = 2;
      for (const [a, len] of [[-2.62, 38], [-2.0, 42], [-1.14, 42], [-0.52, 38]]) {
        const px = 50 + Math.cos(a) * (len + 3);
        const py = 70 + Math.sin(a) * (len + 3);
        x.beginPath(); x.arc(px, py, 4, 0.4, TAU - 0.4); x.stroke();
      }
      break;
    default:
      break;
  }
  x.restore();
}

/** Un polígono de `n` lados con las puntas redondeadas: el borde de los crests. */
export function roundedPoly(n, r, round, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const p = new Path2D();
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n];
    const c = pts[i];
    const d = pts[(i + 1) % n];
    const m1 = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
    if (i === 0) p.moveTo(m1[0], m1[1]);
    p.arcTo(c[0], c[1], (c[0] + d[0]) / 2, (c[1] + d[1]) / 2, round);
  }
  p.closePath();
  return p;
}

/** El medallón de una clase, centrado en el origen, de radio `r`. */
export function drawCrest(x, cls, r) {
  const P = CLASSES[cls];
  const rim = roundedPoly(10, r, r * 0.2, -Math.PI / 2 + 0.12);
  const inner = roundedPoly(10, r * 0.83, r * 0.16, -Math.PI / 2 + 0.12);
  x.save();
  // la sombra de apoyo
  x.save();
  x.translate(0, r * 0.07);
  x.fillStyle = 'rgba(8,4,2,0.55)';
  x.fill(rim);
  x.restore();
  // el aro claro
  const gRim = x.createLinearGradient(0, -r, 0, r);
  gRim.addColorStop(0, mixHex(P.rim, '#ffffff', 0.25));
  gRim.addColorStop(0.5, P.rim);
  gRim.addColorStop(1, P.rimDark);
  x.fillStyle = gRim;
  x.fill(rim);
  // el fondo del medallón
  const gIn = x.createRadialGradient(-r * 0.15, -r * 0.3, r * 0.05, 0, 0, r * 0.95);
  gIn.addColorStop(0, mixHex(P.core, '#ffffff', 0.08));
  gIn.addColorStop(0.55, P.core);
  gIn.addColorStop(1, P.edge);
  x.fillStyle = gIn;
  x.fill(inner);
  // las volutas del fondo
  x.save();
  x.clip(inner);
  x.strokeStyle = mixHex(P.rim, P.core, 0.4);
  x.globalAlpha = 0.16;
  x.lineWidth = r * 0.035;
  for (let i = 0; i < 3; i++) {
    x.beginPath();
    x.arc(r * (0.45 - i * 0.3), r * (0.2 + i * 0.12), r * (0.35 + i * 0.12), Math.PI * (0.9 + i * 0.3), Math.PI * (2.2 + i * 0.3));
    x.stroke();
  }
  // sombra interna arriba
  x.globalAlpha = 1;
  const gShade = x.createLinearGradient(0, -r, 0, -r * 0.3);
  gShade.addColorStop(0, 'rgba(0,0,0,0.35)');
  gShade.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gShade;
  x.fillRect(-r, -r, 2 * r, r * 0.8);
  x.restore();
  // el glifo
  const s = (r * 1.34) / 100;
  x.save();
  x.scale(s, s);
  x.translate(-50, -52);
  const path = glyphPath(cls);
  x.save();
  x.translate(0, 3.2);
  x.fillStyle = mixHex(P.edge, '#000000', 0.35);
  x.globalAlpha = 0.7;
  x.fill(path);
  x.restore();
  const gG = x.createLinearGradient(0, 12, 0, 92);
  gG.addColorStop(0, P.glyphHi);
  gG.addColorStop(0.45, P.glyph);
  gG.addColorStop(1, mixHex(P.glyph, P.rimDark, 0.45));
  x.fillStyle = gG;
  x.fill(path);
  x.lineWidth = 1.6;
  x.strokeStyle = mixHex(P.edge, '#000000', 0.2);
  x.globalAlpha = 0.55;
  x.stroke(path);
  x.globalAlpha = 1;
  glyphDetail(x, cls, mixHex(P.edge, '#000000', 0.1));
  x.restore();
  // el brillo de arriba
  x.save();
  x.clip(inner);
  const gGloss = x.createLinearGradient(0, -r, 0, 0);
  gGloss.addColorStop(0, 'rgba(255,255,255,0.22)');
  gGloss.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gGloss;
  x.beginPath();
  x.ellipse(0, -r * 0.62, r * 0.78, r * 0.42, 0, 0, TAU);
  x.fill();
  x.restore();
  // la línea de contorno
  x.lineWidth = Math.max(1, r * 0.035);
  x.strokeStyle = 'rgba(30,14,4,0.55)';
  x.stroke(rim);
  x.restore();
}

export const crestSprites = {};
function buildCrests() {
  for (const cls of CLASS_IDS) {
    const c = canvas(300, 300);
    const x = c.getContext('2d');
    x.translate(150, 146);
    drawCrest(x, cls, 132);
    crestSprites[cls] = c;
  }
}

/** Dibuja el medallón de `cls` centrado en (cx, cy) con radio `r`. */
export function crest(x, cls, cx, cy, r) {
  const c = crestSprites[cls];
  const k = r / 132;
  x.drawImage(c, cx - 150 * k, cy - 146 * k, 300 * k, 300 * k);
}

// ---- las cartas ----

export const CARD_W = 200;
export const CARD_H = 280;
const CARD_R = 22;
const CARD_SCALE = 2;

function roundRect(x, px, py, w, h, r) {
  x.beginPath();
  x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r);
  x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r);
  x.arcTo(px, py, px + w, py, r);
  x.closePath();
}
export { roundRect };

/** La madera: vetas finas que ondulan, sembradas para que todas las cartas sean iguales. */
function woodGrain(x, w, h, seed, dark = false) {
  const R = rng(seed);
  x.save();
  for (let i = 0; i < 46; i++) {
    const y0 = R() * h;
    const amp = 2 + R() * 7;
    const freq = 0.006 + R() * 0.012;
    const ph = R() * TAU;
    x.beginPath();
    for (let px = -10; px <= w + 10; px += 8) {
      const py = y0 + Math.sin(px * freq + ph) * amp + Math.sin(px * freq * 3.1 + ph * 2) * amp * 0.25;
      if (px === -10) x.moveTo(px, py); else x.lineTo(px, py);
    }
    x.lineWidth = 0.8 + R() * 2.2;
    x.strokeStyle = R() < 0.6 ? `rgba(0,0,0,${dark ? 0.12 : 0.1})` : `rgba(255,220,170,${dark ? 0.035 : 0.05})`;
    x.stroke();
  }
  x.restore();
}

/** Los huecos de los símbolos, de arriba abajo, en coordenadas de la carta (centro = 0,0). */
export function wellsOf(n) {
  const w = CARD_W - 36;
  if (n === 1) return [{ x: 0, y: 0, w, h: w, r: w * 0.4 }];
  const gap = 12;
  const h = n === 2 ? 104 : 72;
  const total = n * h + (n - 1) * gap;
  const out = [];
  for (let i = 0; i < n; i++) {
    const y = -total / 2 + h / 2 + i * (h + gap);
    out.push({ x: 0, y, w, h, r: h * 0.4 });
  }
  return out;
}

const cardCache = new Map();
/**
 * La carta de nogal del juego (`--naipe` en `styles.css`), con sus huecos y los
 * medallones. `symbols` es la lista de clases; la carta sale centrada en su lienzo.
 */
export function cardSprite(symbols, { back = false, empty = false } = {}) {
  const key = back ? 'back' : `${symbols.join(',')}${empty ? '|empty' : ''}`;
  let c = cardCache.get(key);
  if (c) return c;
  const pad = 12;
  c = canvas((CARD_W + pad * 2) * CARD_SCALE, (CARD_H + pad * 2) * CARD_SCALE);
  const x = c.getContext('2d');
  x.scale(CARD_SCALE, CARD_SCALE);
  x.translate(pad, pad);
  // el cuerpo
  roundRect(x, 0, 0, CARD_W, CARD_H, CARD_R);
  const g = x.createLinearGradient(0, 0, CARD_W * 0.5, CARD_H);
  if (back) {
    g.addColorStop(0, '#4a3122');
    g.addColorStop(1, '#261710');
  } else {
    g.addColorStop(0, '#6d4d34');
    g.addColorStop(0.55, '#4f3624');
    g.addColorStop(1, '#3a281b');
  }
  x.fillStyle = g;
  x.fill();
  x.save();
  x.clip();
  woodGrain(x, CARD_W, CARD_H, back ? 91 : 17 + symbols.length * 13 + symbols.join('').length, back);
  // la luz de arriba y la sombra de abajo, adentro de la carta
  const lg = x.createLinearGradient(0, 0, 0, CARD_H);
  lg.addColorStop(0, 'rgba(255,225,190,0.16)');
  lg.addColorStop(0.2, 'rgba(255,225,190,0)');
  lg.addColorStop(0.8, 'rgba(0,0,0,0)');
  lg.addColorStop(1, 'rgba(0,0,0,0.28)');
  x.fillStyle = lg;
  x.fillRect(0, 0, CARD_W, CARD_H);
  x.restore();
  // el borde y el filete interno
  roundRect(x, 1.5, 1.5, CARD_W - 3, CARD_H - 3, CARD_R - 1.5);
  x.lineWidth = 3;
  x.strokeStyle = back ? '#6d4a31' : '#8d6645';
  x.stroke();
  roundRect(x, 8, 8, CARD_W - 16, CARD_H - 16, CARD_R - 7);
  x.lineWidth = 1.4;
  x.strokeStyle = 'rgba(236,196,146,0.26)';
  x.stroke();
  x.beginPath();
  x.moveTo(CARD_R, 3.2);
  x.lineTo(CARD_W - CARD_R, 3.2);
  x.lineWidth = 1.2;
  x.strokeStyle = 'rgba(255,236,210,0.45)';
  x.stroke();

  x.translate(CARD_W / 2, CARD_H / 2);
  if (back) {
    drawBackEmblem(x);
  } else {
    const wells = wellsOf(symbols.length);
    symbols.forEach((s, i) => {
      const wl = wells[i];
      roundRect(x, wl.x - wl.w / 2, wl.y - wl.h / 2, wl.w, wl.h, Math.min(18, wl.h * 0.26));
      const wg = x.createLinearGradient(0, wl.y - wl.h / 2, 0, wl.y + wl.h / 2);
      wg.addColorStop(0, 'rgba(14,7,3,0.62)');
      wg.addColorStop(1, 'rgba(24,13,6,0.38)');
      x.fillStyle = wg;
      x.fill();
      x.lineWidth = 1.2;
      x.strokeStyle = 'rgba(255,220,180,0.12)';
      x.stroke();
      if (!empty) crest(x, s, wl.x, wl.y, crestRadius(wl));
    });
  }
  cardCache.set(key, c);
  return c;
}

/** El radio del medallón dentro de su hueco. */
export const crestRadius = (wl) => Math.min(wl.w, wl.h) * 0.41;

/** El dorso: el rombo del logo de Axie Infinity sobre un sello. */
function drawBackEmblem(x) {
  x.save();
  const r = 58;
  const ring = roundedPoly(10, r, 12, -Math.PI / 2 + 0.12);
  x.fillStyle = 'rgba(12,6,2,0.45)';
  x.fill(ring);
  x.lineWidth = 3;
  x.strokeStyle = 'rgba(236,196,146,0.35)';
  x.stroke(ring);
  const d = diamond();
  if (d) x.drawImage(d, -46, -46, 92, 92);
  // las esquinas
  x.strokeStyle = 'rgba(236,196,146,0.22)';
  x.lineWidth = 2;
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    x.beginPath();
    x.moveTo(sx * 70, sy * 112);
    x.lineTo(sx * 70, sy * 96);
    x.moveTo(sx * 70, sy * 112);
    x.lineTo(sx * 54, sy * 112);
    x.stroke();
  }
  x.restore();
}

/** El rombo celeste del logo, recortado del PNG. */
let diamondSprite = null;
export function diamond() {
  if (diamondSprite) return diamondSprite;
  const L = img.logo;
  if (!L) return null;
  const k = L.naturalWidth / 1089;
  const c = canvas(180, 180);
  c.getContext('2d').drawImage(L, 594 * k, 20 * k, 180 * k, 180 * k, 0, 0, 180, 180);
  diamondSprite = c;
  return c;
}

function buildSprites() {
  buildCrests();
}
