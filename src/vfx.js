// Los golpes: los efectos del Axie Origins Asset Kit, dibujados sobre el tablero.
//
// Cada efecto es una grilla de cuadros en un solo PNG (ver `vfx-clips.js`). Se dibuja
// cuadro a cuadro en un canvas que tapa la mesa, en modo aditivo: los atlas vienen
// capturados sobre negro, así que sumar es lo que corresponde —el negro no aporta y
// las luces se acumulan—. El canvas también va en `plus-lighter` sobre la página, que
// es como los usa el kit.
//
// Todo esto es decorado: si el CDN no responde, si el navegador no da canvas 2D o si
// el sistema pide menos movimiento, `play` no hace nada y el juego sigue igual.
import { CLIPS, atlasUrl } from './vfx-clips.js';

/** Un atlas se baja una sola vez por partida; `null` si no se pudo. */
const atlases = new Map();

function loadAtlas(clip) {
  // Fuera del navegador (los tests corren el render con un DOM de mentira) no hay
  // imágenes que bajar: el efecto simplemente no existe.
  if (typeof Image !== 'function') return Promise.resolve(null);
  if (!atlases.has(clip.id)) {
    atlases.set(
      clip.id,
      new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = atlasUrl(clip);
      }),
    );
  }
  return atlases.get(clip.id);
}

/**
 * Cuánto tarda el efecto en pegar, en ms. El sacudón y el número esperan a esto para
 * caer con el impacto y no con el clic. Se corta en 700 ms: más que eso el juego se
 * siente lento aunque el efecto siga.
 */
export const hitDelay = (key) => Math.min((CLIPS[key]?.hitAt ?? 0) * 1000, 700);

/** Precarga el efecto de una clase, para que el primer golpe no llegue tarde. */
export function preloadVfx(key) {
  const clip = CLIPS[key];
  if (clip) loadAtlas(clip);
}

/**
 * El reproductor sobre un `<canvas>`. Devuelve siempre la misma interfaz, aunque no
 * haya nada que dibujar: quien lo usa no tiene que preguntar si hay efectos o no.
 */
export function createVfx(canvas) {
  const ctx = canvas?.getContext?.('2d');
  const quiet = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (!ctx || quiet) return { play() {} };

  const playing = [];
  let raf = 0;

  /** El canvas sigue el tamaño de la mesa; se dibuja en píxeles CSS. */
  function fit() {
    const dpr = globalThis.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    const [w, h] = [Math.round(width * dpr), Math.round(height * dpr)];
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height };
  }

  function frame() {
    const now = performance.now();
    const { width, height } = fit();
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';

    for (let i = playing.length - 1; i >= 0; i--) {
      const fx = playing[i];
      const elapsed = (now - fx.started) / 1000;
      if (elapsed >= fx.clip.duration) {
        playing.splice(i, 1);
        continue;
      }
      const { clip, img, x, y, scale, flip } = fx;
      const index = Math.min(clip.frames - 1, Math.max(0, Math.floor(elapsed * clip.fps)));
      const col = index % clip.cols;
      const row = Math.floor(index / clip.cols);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(flip ? -scale : scale, scale);
      // El `anchor` del clip es el punto que va sobre quien recibe el golpe: se dibuja
      // el cuadro corrido para que ese punto caiga en el origen que acabamos de fijar.
      ctx.drawImage(
        img,
        col * clip.frameW, row * clip.frameH, clip.frameW, clip.frameH,
        -clip.anchor.x, -clip.anchor.y, clip.frameW, clip.frameH,
      );
      ctx.restore();
    }

    if (playing.length) {
      raf = requestAnimationFrame(frame);
    } else {
      raf = 0;
      ctx.clearRect(0, 0, width, height);
    }
  }

  /** Corre `at` lo mínimo para que quepan `before` y `after` dentro de `size`. */
  function fit1(at, before, after, size) {
    if (before + after >= size) return size / 2; // no entra ni centrado: al medio
    return Math.min(Math.max(at, before), size - after);
  }

  return {
    /**
     * Larga el efecto `key` sobre `target`, un elemento del tablero.
     * `from` es el lado desde el que llega el golpe. Los atlas vienen capturados con el
     * atacante a la derecha, así que un golpe que sale de la izquierda va espejado —
     * que es justo lo que hace falta ahora que los dos Axies están enfrentados.
     * `width` es el ancho del efecto en anchos del Axie que lo recibe.
     */
    play(key, target, { from = 'right', width = 2.4 } = {}) {
      const clip = CLIPS[key];
      if (!clip || !target?.getBoundingClientRect) return;
      loadAtlas(clip).then((img) => {
        if (!img) return;
        const box = target.getBoundingClientRect();
        const field = canvas.getBoundingClientRect();
        if (!box.width || !field.width) return;
        const scale = (box.width * width) / clip.frameW;
        const flip = from === 'left';
        // Los Axies están contra el borde de su mitad y el efecto es más ancho que
        // ellos: apoyado tal cual, medio golpe se cortaría afuera del arena. Se corre
        // lo justo para que entre entero — es una mancha de luz, no se nota, y es mejor
        // que verla cortada por el borde.
        const [ahead, behind] = flip
          ? [clip.frameW - clip.anchor.x, clip.anchor.x]
          : [clip.anchor.x, clip.frameW - clip.anchor.x];
        playing.push({
          clip,
          img,
          x: fit1(box.left + box.width / 2 - field.left, ahead * scale, behind * scale, field.width),
          y: fit1(box.top + box.height / 2 - field.top,
            clip.anchor.y * scale, (clip.frameH - clip.anchor.y) * scale, field.height),
          scale,
          flip,
          started: performance.now(),
        });
        if (!raf) raf = requestAnimationFrame(frame);
      });
    },
  };
}
