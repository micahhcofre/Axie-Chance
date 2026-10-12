// Las poses de los rivales de la Aventura, de a un capítulo.
//
// `axie-poses.js` trae las del roster y las de los rivales del primer capítulo: es lo que
// hace falta al abrir el juego. Las de cada capítulo siguiente viven en su propio archivo
// (`poses/rivales-NN.js`, los escribe `npm run poses`) y se piden recién cuando hacen
// falta: cuando su tierra aparece en el mapa y en la previa de un nivel, antes de pelear.
// Con doscientos niveles, cada rival suma ~8 KB de poses y de dibujos alternativos, y
// cargarlos todos al abrir el juego eran casi 2 MB que nadie miraba todavía.
//
// Cada archivo de capítulo se registra solo al cargarse (`registerRivalPoses`): suma sus
// pistas al final de `TRACKS` y sus poses y dibujos a `POSES` y `VARIANTS`, los mismos
// objetos que leen `axie-motion.js` y `axieArt`. Las pistas que ya estaban en la base las
// nombra por su número de siempre; las suyas, con números negativos (`-1` es su primera),
// que acá pasan a su lugar al final de `TRACKS`.
//
// En el archivo suelto de `npm run build` todos los capítulos van adentro y se registran
// al cargar la página: `loadRivalPoses` los encuentra ya puestos y no pide nada.

import { TRACKS, VARIANTS, POSES } from './axie-poses.js';
import { adventureChapters } from './adventure.js';

/** Los capítulos cuyas poses ya están puestas. El primero viene en la base. */
const loadedChapters = new Set([1]);
/** Los pedidos en curso, para no pedir dos veces el mismo archivo. */
const pending = new Map();

/** Suma las poses de un capítulo a las de la base. Lo llama cada archivo de capítulo. */
export function registerRivalPoses(chapter, { tracks = [], variants = {}, poses = {} }) {
  if (loadedChapters.has(chapter)) return;
  const base = TRACKS.length;
  TRACKS.push(...tracks);
  const at = (n) => (n < 0 ? base + (-1 - n) : n);
  for (const [axie, clips] of Object.entries(poses)) {
    POSES[axie] = Object.fromEntries(Object.entries(clips).map(([name, clip]) => [name, {
      ...clip,
      root: at(clip.root),
      parts: Object.fromEntries(Object.entries(clip.parts).map(([slot, id]) => [slot, at(id)])),
    }]));
  }
  Object.assign(VARIANTS, variants);
  loadedChapters.add(chapter);
}

/** El nombre del archivo de un capítulo: `poses/rivales-06.js`. */
const chapterFile = (n) => `./poses/rivales-${String(n).padStart(2, '0')}.js`;

/** El capítulo donde aparece por primera vez el rival `id` (con sus evoluciones), o `null`. */
export function rivalChapter(id) {
  return adventureChapters().find((ch) => ch.levels.some((l) => l.rival === id))?.n ?? null;
}

/**
 * Trae las poses del capítulo `n`, si no están. Devuelve una promesa que se cumple con
 * las poses puestas; si el archivo no llega (sin red, o sin navegador que importe), se
 * cumple igual: el rival se dibuja quieto, que no rompe nada.
 */
export function loadRivalPoses(n) {
  if (!n || loadedChapters.has(n)) return Promise.resolve();
  if (!pending.has(n)) {
    pending.set(n, import(chapterFile(n)).catch(() => {}).finally(() => pending.delete(n)));
  }
  return pending.get(n);
}

/** Trae las poses del rival `id` (las del capítulo donde aparece). */
export const loadPosesFor = (id) => loadRivalPoses(rivalChapter(id));

/** Si las poses del capítulo `n` ya están puestas. */
export const hasRivalPoses = (n) => loadedChapters.has(n);
