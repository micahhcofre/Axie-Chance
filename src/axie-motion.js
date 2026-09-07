// Las animaciones del Axie Origins Asset Kit, puestas a andar sobre la pila de PNG.
//
// Los Axies vienen con sus animaciones hechas —caras, patas, colas, el ataque, el
// golpe recibido, el festejo y cinco maneras de aburrirse, entre ellas rascarse con
// la pata—. Son de Spine y este juego no dibuja un esqueleto, así que `npm run poses`
// las hornea a números (ver `axie-poses.js`) y este módulo los reproduce.
//
// Cada clip son tres cosas a la vez:
//   el cuerpo   `.axie-pose` se corre y gira: es la mayor parte del movimiento.
//   las partes  las capas con hueso propio animado —patas, cola, orejas, lomo— se
//               corren y giran **encima** de eso.
//   los dibujos los ojos y la boca cambian de PNG —cerrados, enojados, mordiendo—.
//               Están todos puestos desde el principio y lo que se anima es cuál se
//               ve, en escalones, sin fundido.
//
// Las dos últimas van por separado a propósito. Cada dibujo alternativo está puesto en
// su propio lugar de reposo —la boca abierta no va donde iba la cerrada—, así que
// cambiar de dibujo no tiene que mover nada: encender uno y apagar el otro alcanza.
//
// Se usa la Web Animations API y no CSS: los clips vienen como listas de cuadros y
// escribirlos como `@keyframes` sería generar hojas de estilo en el navegador. Además
// `animate()` devuelve el handle, que es lo que hace falta para cortar un clip cuando
// llega otro. Al terminar, la animación se descarta sola y la capa vuelve a su
// posición de reposo: no hay estado que limpiar.
import { MOTIONS, POSES, TRACKS } from './axie-poses.js';

/** Cada cuánto se aburre un Axie que no está haciendo nada, en ms. */
const FIDGET = [5200, 11000];
/**
 * Los clips que salen de ese aburrimiento, elegidos al azar. Los tres primeros son
 * los que el kit hizo para esto; los otros cuatro están prestados de situaciones que
 * el juego no usa —recibir un buff, comer, entrar a la arena— y fuera de contexto se
 * leen igual de bien: un saltito, masticar, un tarascón, plantarse.
 */
const FIDGETS = ['scratch', 'peek', 'snarl', 'cheer', 'chew', 'snap', 'stomp'];

/**
 * Las poses horneadas son relativas al reposo, así que un clip que no existe se
 * reproduce como "no te muevas" y no rompe nada.
 */
const trackOf = (id) => (id === undefined ? null : TRACKS[id]);

/** Los cuadros de un `transform` a partir de una pista `[dx, dy, giro]`. */
function moveFrames(track, unit) {
  return track.map(([x, y, r]) => ({
    transform: `translate(${x}${unit}, ${y}${unit}) rotate(${r}deg)`,
  }));
}

/**
 * Los cuadros de opacidad de un dibujo: 1 mientras es el que va, 0 el resto.
 *
 * `steps(1, end)` es lo que lo vuelve un cambio y no un fundido — mantiene el valor
 * del cuadro hasta el siguiente y ahí salta—. Una boca que aparece de a poco encima
 * de la otra se ve como un fantasma; el kit las dibujó para cambiarse de golpe.
 */
function swapFrames(points, att) {
  const frames = points.map(([at, name]) => ({
    offset: at,
    opacity: name === att ? 1 : 0,
    easing: 'steps(1, end)',
  }));
  const last = frames[frames.length - 1];
  if (last.offset < 1) frames.push({ offset: 1, opacity: last.opacity });
  return frames;
}

/**
 * El reproductor de un Axie del tablero.
 *
 * Tiene dos niveles: una **base** que se repite mientras dure la situación —quieto,
 * dormido, festejando— y **pulsos** que la tapan y se van —el ataque, el golpe, un
 * aburrimiento—. Cuando un pulso termina vuelve la base sola, así que quien lo usa
 * solo dice qué está pasando y nunca tiene que acordarse de limpiar.
 *
 * `node` es el bloque del Axie en el tablero; se le vuelve a pedir `mount()` cada vez
 * que se repinta, porque las capas de adentro son otras.
 *
 * `phase` es en qué punto del bucle arranca, de 0 a 1. Los dos que pelean usan el clip
 * de estar quieto, que dura lo mismo para los dos: sin desfasarlos respiran y
 * parpadean al mismo tiempo, y dos muñecos sincronizados se leen como un solo muñeco
 * repetido. Va como parámetro y no sale del nombre del Axie para poder ponerlos en
 * contrafase exacta, que es lo más lejos que pueden estar.
 */
export function createMotion(node, phase = 0) {
  // Todo esto es decorado. Si el navegador no tiene `animate()` —o si esto corre
  // fuera de un navegador, como en los tests, que renderizan contra un DOM de
  // mentira—, el reproductor existe igual y no hace nada: los Axies quedan quietos y
  // la partida es exactamente la misma.
  const quiet = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (typeof node?.animate !== 'function' || typeof node?.querySelectorAll !== 'function') {
    return { mount() {}, stance() {}, pulse() {}, stop() {} };
  }
  let clips = null; // las poses del Axie que está puesto
  let pose = null; // la caja que lleva el cuerpo
  let layers = new Map(); // slot → [<img>], la base primero
  let running = []; // lo que está sonando ahora
  let base = 'idle';
  let entered = false; // si la base de entrada ya se reprodujo
  let pulsing = false;
  let timer = 0;

  const cancelAll = () => {
    for (const a of running) a.cancel();
    running = [];
  };

  /**
   * Larga un clip. Devuelve cuánto dura en ms, o 0 si no hay nada que reproducir
   * —sin CDN, sin clip, o con el sistema pidiendo menos movimiento—.
   */
  function run(name, loop) {
    cancelAll();
    const clip = clips?.[name];
    if (!clip || !pose) return 0;
    // `rate` estira o acorta el clip del kit. Los bucles vienen pensados para verse un
    // rato suelto, no encadenados toda la partida: al de estar quieto se lo afloja.
    const ms = (clip.dur * 1000) / (MOTIONS[name]?.rate ?? 1);
    const opts = { duration: ms, iterations: loop ? Infinity : 1, easing: 'linear' };
    // Todo lo que larga un clip comparte duración, así que moverles el reloj a todas
    // por igual las deja igual de sincronizadas entre sí y desfasadas del rival.
    const start = () => {
      if (!loop) return;
      for (const a of running) a.currentTime = phase * ms;
    };

    const root = trackOf(clip.root);
    if (root) running.push(pose.animate(moveFrames(root, '%'), opts));

    // Las pistas van por dibujo, no por slot: cada una está medida contra el reposo
    // de ese dibujo y en porcentaje de su tamaño, que es como la aplica el CSS. El que
    // no se ve se mueve igual, para estar en su lugar cuando le toque aparecer.
    for (const imgs of layers.values()) {
      for (const img of imgs) {
        const track = trackOf(clip.parts[img.dataset.att]);
        if (track) running.push(img.animate(moveFrames(track, '%'), opts));
      }
    }

    for (const [slot, swaps] of Object.entries(clip.swaps)) {
      const imgs = layers.get(slot);
      if (!imgs || !swaps.length) continue;
      const points = [[0, slot], ...swaps];
      for (const img of imgs) {
        running.push(img.animate(swapFrames(points, img.dataset.att), opts));
      }
    }
    start();
    return ms;
  }

  /**
   * Vuelve a la base. Hay dos clases de base: las que se repiten —quieto, festejando,
   * desmayado— y las de entrada, que se reproducen una vez y después dejan al Axie
   * respirando. `activity/prepare` es de las segundas: se planta para atacar y de ahí
   * en más está tan quieto como el que no hace nada, así que también se aburre.
   */
  function rest() {
    pulsing = false;
    clearTimeout(timer);
    // Con el sistema pidiendo menos movimiento no se reproduce nada, ni siquiera al
    // cambiar de postura: el Axie se queda en su dibujo de reposo.
    if (quiet) return;
    if (!MOTIONS[base]?.loop && !entered) {
      entered = true;
      const ms = run(base, false);
      timer = setTimeout(rest, ms);
      return;
    }
    const loop = MOTIONS[base]?.loop;
    run(loop ? base : 'idle', true);
    // Se aburre el que está respirando, sea porque no pasa nada o porque ya se plantó
    // para atacar: `ready` es un pulso y cuando termina abajo queda el mismo bucle de
    // estar quieto. Eso es casi todo tu turno, así que mirar solo `idle` dejaba al
    // Axie propio sin hacer un gesto en toda la partida — el único que se aburría era
    // el de la CPU, que espera en `idle`. El festejo y el desmayo tienen bucle propio
    // y ahí no hay nada que interrumpir.
    if (loop && base !== 'idle') return;
    const [min, max] = FIDGET;
    timer = setTimeout(() => {
      pulse(FIDGETS[Math.floor(Math.random() * FIDGETS.length)]);
    }, min + Math.random() * (max - min));
  }

  /** Un clip que tapa a la base y se va solo. El último que llega gana. */
  function pulse(name) {
    if (quiet || !clips?.[name]) return;
    clearTimeout(timer);
    const ms = run(name, false);
    if (!ms) return rest();
    pulsing = true;
    timer = setTimeout(rest, ms);
  }

  return {
    /** Toma las capas del Axie recién dibujado y arranca. */
    mount(axieId) {
      cancelAll();
      clearTimeout(timer);
      entered = false;
      clips = POSES[axieId] ?? null;
      pose = node.querySelector('.axie-pose');
      layers = new Map();
      for (const img of node.querySelectorAll('.axie img[data-part]')) {
        const slot = img.dataset.part;
        // La capa base va primero: es la que está puesta cuando no hay ningún clip.
        if (img.classList.contains('axie-alt')) layers.get(slot)?.push(img);
        else layers.set(slot, [img]);
      }
      rest();
    },
    /** Lo que le está pasando ahora y va a durar: `idle`, `ready`, `win`, `ko`. */
    stance(name) {
      const next = clips?.[name] ? name : 'idle';
      if (next === base) return;
      base = next;
      entered = false;
      if (!pulsing) rest();
    },
    /** Un momento: `attack`, `hurt`, `whiff`. */
    pulse,
    /** Corta todo. */
    stop() {
      cancelAll();
      clearTimeout(timer);
    },
  };
}
