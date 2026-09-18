/**
 * La cámara de la mesa.
 *
 * Lo que se mueve es el **mundo** —el terreno, el piso y los dos Axies con sus chapas—
 * y nada más: las cartas, el número del ataque y los botones son de la pantalla, no de
 * la escena, y se quedan quietos. Así el golpe se siente en todo el cuadro sin que se
 * mueva lo que hay que leer ni lo que hay que apretar.
 *
 * El CSS lee tres variables del arena (`--cam-s`, `--cam-x`, `--cam-y`) y las aplica a
 * cada capa alrededor del mismo punto de la pantalla (ver `--cam-k` en `styles.css`).
 * Acá solo se decide cuánto valen, y se decide con resortes: nada salta de un cuadro al
 * otro, todo llega y se va. Ese es todo el motivo de que sea un módulo con su propio
 * reloj y no un atributo con una animación de CSS: el sacudón viejo agrandaba la escena
 * de golpe al empezar y la achicaba de golpe al terminar, y eso era lo que se veía como
 * una vibración rara.
 *
 * Nunca se aleja más allá del cuadro: la escala no baja de 1, y cuando la cámara se
 * corre de costado —o tiembla— la escala sube lo justo para que el borde del dibujo no
 * asome. Con el sistema pidiendo menos movimiento no hace nada.
 */

/** El plano de siempre: la escena entera y quieta. */
export const CAMERA_REST = Object.freeze({ s: 1, x: 0, k: 30 });

/** Lo que dura el tirón de un golpe una vez que llegó, en ms. */
const PUNCH_HOLD = 380;
/** Cuánto se acerca la cámara al que recibe un golpe. */
const PUNCH_ZOOM = 0.085;
/** Hasta cuántos píxeles tiembla el cuadro con el sacudón más fuerte. */
const SHAKE_PX = 9;
/** Cuánto tarda en apagarse un sacudón entero, en segundos. */
const SHAKE_FADE = 0.7;

const motionless = () => Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

/**
 * Un ruido suave: la suma de dos senos con frecuencias que no se pisan. Un sacudón con
 * números al azar en cada cuadro titila; este va y viene como una cámara en mano.
 */
const wobble = (t, a, b, phase) => Math.sin(t * a + phase) * 0.62 + Math.sin(t * b + phase * 2.3) * 0.38;

export function createCamera(arena) {
  // `b` es el golpecito de cada carta: un resorte aparte, mucho más duro que el del
  // plano, que se suma a la escala y vuelve solo a cero.
  const cam = { s: 1, x: 0, y: 0, b: 0, vs: 0, vx: 0, vy: 0, vb: 0 };
  let aim = { ...CAMERA_REST };
  let hold = null;
  let trauma = 0;
  let frame = 0;
  let last = 0;
  let t = 0;
  const timers = new Set();
  const alive = () => Boolean(arena?.style && globalThis.requestAnimationFrame) && !motionless();

  function later(ms, fn) {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, Math.max(0, ms));
    id?.unref?.();
    timers.add(id);
  }

  /**
   * Cuánto está corrido `el` del centro del arena, en píxeles y sin la cámara: la caja
   * que devuelve el navegador ya viene movida, así que se le deshace el plano actual.
   */
  function offsetOf(el) {
    const r = el?.getBoundingClientRect?.();
    const box = arena.getBoundingClientRect?.();
    if (!r?.width || !box?.width) return 0;
    const seen = r.left + r.width / 2 - (box.left + box.width / 2);
    return (seen - cam.x) / Math.max(cam.s, 1);
  }

  /** El corrimiento que deja a `el` quieto en la pantalla mientras la cámara se acerca a `s`. */
  const toward = (el, s, lean = 1) => (el ? -(s - 1) * offsetOf(el) * lean : 0);

  function write(s, x, y) {
    arena.style.setProperty('--cam-s', s.toFixed(4));
    arena.style.setProperty('--cam-x', `${x.toFixed(2)}px`);
    arena.style.setProperty('--cam-y', `${y.toFixed(2)}px`);
  }

  function spring(key, vel, target, k, z, dt) {
    cam[vel] += (k * (target - cam[key]) - 2 * Math.sqrt(k) * z * cam[vel]) * dt;
    cam[key] += cam[vel] * dt;
  }

  function step(now) {
    frame = 0;
    if (!alive()) return park();
    const elapsed = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    t += elapsed;
    const goal = hold ?? aim;
    // Pasos cortos: con el resorte duro del golpe un paso de 50 ms (una pestaña que
    // volvió de estar escondida) haría explotar la cuenta.
    for (let left = elapsed; left > 0; left -= 1 / 240) {
      const dt = Math.min(left, 1 / 240);
      spring('s', 'vs', goal.s, goal.k, goal.z ?? 1, dt);
      spring('x', 'vx', goal.x, goal.k, goal.z ?? 1, dt);
      spring('y', 'vy', 0, 90, 0.8, dt);
      spring('b', 'vb', 0, 260, 0.45, dt);
    }
    trauma = Math.max(0, trauma - elapsed / SHAKE_FADE);

    const shake = SHAKE_PX * trauma * trauma;
    const x = cam.x + shake * wobble(t, 71, 43, 0.4);
    const y = cam.y + shake * 0.55 * wobble(t, 59, 37, 1.9);
    // Lo que haga falta de escala para que el corrimiento no destape el borde: a los
    // costados el dibujo sobra `(s - 1) / 2` del ancho, y arriba sobra lo que va del
    // borde al punto de la cámara (un tercio de la pantalla, contado corto). Un 10% de
    // más y nada fijo: con un margen fijo, al volver a su lugar la escala se quedaba
    // colgada un pelo arriba de 1 y caía de golpe en el último cuadro.
    const w = arena.clientWidth || 1000;
    const h = arena.clientHeight || 700;
    const s = Math.max(1, cam.s + cam.b,
      1 + (2.2 * Math.abs(x)) / w,
      1 + (1.1 * Math.max(0, y)) / (0.3 * h));
    write(s, x, y);

    const quiet = !hold && trauma === 0
      && Math.abs(cam.s - goal.s) < 5e-4 && Math.abs(cam.vs) < 5e-3
      && Math.abs(cam.x - goal.x) < 0.15 && Math.abs(cam.vx) < 1
      && Math.abs(cam.y) < 0.15 && Math.abs(cam.vy) < 1
      && Math.abs(cam.b) < 5e-4 && Math.abs(cam.vb) < 5e-3;
    if (quiet) {
      Object.assign(cam, { s: goal.s, x: goal.x, y: 0, b: 0, vs: 0, vx: 0, vy: 0, vb: 0 });
      write(goal.s, goal.x, 0);
      return;
    }
    frame = globalThis.requestAnimationFrame(step);
  }

  function wake() {
    if (!alive()) return park();
    if (frame) return;
    last = globalThis.performance?.now?.() ?? Date.now();
    frame = globalThis.requestAnimationFrame(step);
  }

  /** Sin movimiento la cámara se queda en su lugar, con la escena entera. */
  function park() {
    if (frame) globalThis.cancelAnimationFrame?.(frame);
    frame = 0;
    hold = null;
    trauma = 0;
    Object.assign(cam, { s: 1, x: 0, y: 0, b: 0, vs: 0, vx: 0, vy: 0, vb: 0 });
    if (arena?.style) write(1, 0, 0);
  }

  return {
    /**
     * El plano de la partida en este momento: `s` es cuánto se acerca, `el` a quién
     * mira (queda quieto mientras todo lo demás se agranda a su alrededor) y `lean`
     * cuánto: 1 lo deja clavado, 0 se acerca al centro. `k` es qué tan rápido llega.
     */
    frame({ s = 1, el = null, lean = 1, k = CAMERA_REST.k } = CAMERA_REST) {
      if (!alive()) return;
      const next = { s, x: toward(el, s, lean), k };
      if (Math.abs(next.s - aim.s) < 1e-4 && Math.abs(next.x - aim.x) < 0.5 && next.k === aim.k) return;
      aim = next;
      wake();
    },
    /** Un golpecito de cámara: la carta que entra se siente en el cuadro. */
    thump(power = 0.3) {
      if (!alive()) return;
      cam.vb += power;
      wake();
    },
    /**
     * La cámara se hunde: la cadena que se corta se lleva el aire con ella. La escena
     * sube, y para arriba sí sobra piso (ver `.arena::after`): no hace falta agrandar.
     */
    dip(px = 8) {
      if (!alive()) return;
      cam.vy -= px * 14;
      wake();
    },
    /**
     * El golpe: dentro de `at` ms la cámara se le tira encima a `el` —el que lo va a
     * recibir— y se queda ahí hasta que pasa el impacto, que cae `reach` ms después.
     */
    punch(el, { at = 0, reach = 0, zoom = PUNCH_ZOOM } = {}) {
      if (!alive() || !el) return;
      later(at, () => {
        const s = 1 + zoom;
        hold = { s, x: toward(el, s), k: 420, z: 0.72 };
        wake();
        later(reach + PUNCH_HOLD, () => {
          hold = null;
          wake();
        });
      });
    },
    /**
     * El impacto sobre el que recibe: el cuadro se va para el lado del golpe (`dir`:
     * -1 a la izquierda, 1 a la derecha) y, si el golpe duele, tiembla. `level` va de 0
     * a 1 y es cuánto tiembla.
     */
    hit(dir = 0, px = 8, level = 0) {
      if (!alive()) return;
      cam.vx += dir * px * 30;
      trauma = Math.min(1, Math.max(trauma, level));
      wake();
    },
    /** Tiembla sin empujar para ningún lado. */
    shake(level = 0.5) {
      this.hit(0, 0, level);
    },
    /** Vuelve a la escena entera, sin nada pendiente: se usa al irse de la mesa. */
    reset() {
      for (const id of timers) clearTimeout(id);
      timers.clear();
      aim = { ...CAMERA_REST };
      park();
    },
  };
}
