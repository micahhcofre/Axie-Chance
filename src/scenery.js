/**
 * El escenario vivo: lo que le pasa al lugar mientras se pelea.
 *
 * El dibujo del escenario lo pone el CSS con `data-stage` (ver `stages.js`); acá va lo
 * que se mueve encima, y se mueve **con la partida**, que es la gracia de todo esto.
 * Un fondo lindo y quieto sigue siendo un papel pintado; uno que se tensa con la
 * cadena cuenta lo mismo que cuenta el juego:
 *
 * - **El aire.** Cada escenario tiene lo suyo flotando —pétalos en la plaza, polvo en
 *   el coliseo, espuma en la playa, nieve, hojas, brasas en la guarida— y corre más
 *   rápido cuanto más larga la cadena del que juega (`heat`). Va con Web Animations y
 *   no con `@keyframes` porque así la velocidad se cambia con `updatePlaybackRate` sin
 *   que las partículas salten de lugar.
 * - **La luz.** Desde el piso sube un resplandor del color del que ataca (`--heat`,
 *   `--heat-c` en el arena), más fuerte cuanto más arriesga.
 * - **El corte.** Se apagan las luces: el dibujo pierde el color de golpe y el aire se
 *   queda casi quieto, como un estadio que se calla (`data-mood="bust"`).
 * - **El golpe.** Uno grande hace estallar el aire y encender la luz un instante
 *   (`cheer`), que es lo más parecido a la tribuna saltando que se puede hacer con un
 *   público pintado.
 *
 * Todo es transformación y opacidad sobre unas pocas decenas de nodos, así que corre
 * en el compositor. Con el sistema pidiendo menos movimiento el aire no se arma, y la
 * luz y el apagón siguen (son un cambio de color, no un movimiento).
 */
import { STAGES, isStage } from './stages.js';

const sceneryStill = () => Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

/** Cuánto dura el apagón del corte, en ms. Lo mismo que tarda la mesa en romperse. */
export const SCENE_BUST_MS = 1700;
/** Cuánto dura el estallido de un golpe grande, en ms. */
const SCENE_CHEER_MS = 900;

/**
 * Lo que flota en cada aire: cuántas partículas y cómo es cada una. `trip` devuelve el
 * recorrido de una sola, en unidades del propio contenedor (`cqw`/`cqh`, ver
 * `.arena-air`), así sirve para cualquier ventana sin medir nada.
 */
const AIR = {
  // cae despacio y se mece
  snow: { count: 28, trip: (r) => ({
    size: 4 + r() * 6, x: r() * 100, y: -4, dur: 9000 + r() * 7000,
    path: [[0, 0], [2 + r() * 3, 50], [-2 - r() * 3, 104]], spin: 0,
  }) },
  // cae en diagonal dando vueltas
  leaves: { count: 14, trip: (r) => ({
    size: 9 + r() * 6, x: 10 + r() * 100, y: -6, dur: 8000 + r() * 6000,
    path: [[0, 0], [-8 - r() * 6, 45], [-20 - r() * 10, 106]], spin: 540 + r() * 540,
  }) },
  petals: { count: 16, trip: (r) => ({
    size: 6 + r() * 5, x: r() * 110, y: -5, dur: 10000 + r() * 6000,
    path: [[0, 0], [-6 - r() * 5, 40], [-14 - r() * 8, 105]], spin: 360 + r() * 360,
  }) },
  // flota hacia arriba desde el piso, en la luz de las gradas
  dust: { count: 22, trip: (r) => ({
    size: 3 + r() * 5, x: r() * 100, y: 70 + r() * 30, dur: 11000 + r() * 7000,
    path: [[0, 0], [3 + r() * 4, -30], [6 + r() * 6, -64]], spin: 0,
  }) },
  // la espuma que brilla y se apaga cerca del agua
  spray: { count: 18, trip: (r) => ({
    size: 3 + r() * 5, x: r() * 100, y: 42 + r() * 56, dur: 2600 + r() * 2400,
    path: [[0, 0], [0.5, -3], [1, -6]], spin: 0, twinkle: true,
  }) },
  // luciérnagas: suben despacio, se corren y se prenden y apagan
  fireflies: { count: 20, trip: (r) => ({
    size: 3 + r() * 4, x: r() * 100, y: 50 + r() * 45, dur: 7000 + r() * 6000,
    path: [[0, 0], [6 - r() * 12, -14], [8 - r() * 16, -30]], spin: 0, twinkle: true,
  }) },
  // sube titilando desde el piso
  embers: { count: 22, trip: (r) => ({
    size: 3 + r() * 5, x: r() * 100, y: 80 + r() * 22, dur: 5000 + r() * 4000,
    path: [[0, 0], [-3 + r() * 6, -40], [-6 + r() * 12, -86]], spin: 0,
  }) },
};

/** Un azar sembrado por nombre: el mismo escenario siempre arma el mismo aire. */
function airRng(name) {
  let a = [...name].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Los fotogramas de una partícula: el recorrido, la vuelta que da y cómo aparece y se
 * va. Aparece y se va siempre en transparente, así el lazo de la animación no se ve.
 */
function airFrames(p) {
  const at = ([x, y], i, n) => {
    const spin = p.spin * (i / (n - 1));
    return `translate(${x}cqw, ${y}cqh) rotate(${spin.toFixed(0)}deg)`;
  };
  if (p.twinkle) {
    return [
      { transform: `${at(p.path[0], 0, 3)} scale(0)`, opacity: 0 },
      { transform: `${at(p.path[1], 1, 3)} scale(1)`, opacity: 1 },
      { transform: `${at(p.path[2], 2, 3)} scale(0)`, opacity: 0 },
    ];
  }
  return [
    { transform: at(p.path[0], 0, 3), opacity: 0 },
    { transform: at(p.path[0], 0, 3), opacity: 1, offset: 0.08 },
    { transform: at(p.path[1], 1, 3), opacity: 1, offset: 0.5 },
    { transform: at(p.path[2], 2, 3), opacity: 1, offset: 0.9 },
    { transform: at(p.path[2], 2, 3), opacity: 0 },
  ];
}

/**
 * @param {HTMLElement} arena la sección `#arena`. Adentro busca `.arena-air`, el
 *   contenedor del aire (va dentro del terreno, así se mueve con la cámara).
 */
export function createScenery(arena) {
  const air = arena?.querySelector?.('.arena-air') ?? null;
  let kind = null;
  let anims = [];
  let heat = 0;
  // La velocidad a la que tiene que volver el aire después de un corte o un golpe.
  let pace = 1;
  let moodTimer = null;
  let paceTimer = null;

  const alive = () => Boolean(air?.ownerDocument?.createElement) && !sceneryStill();

  function setRate(rate) {
    for (const a of anims) a.updatePlaybackRate?.(rate);
  }

  function clearAir() {
    for (const a of anims) a.cancel?.();
    anims = [];
    if (air) air.innerHTML = '';
    kind = null;
  }

  /** Arma el aire de `name`: siempre el mismo para el mismo escenario. */
  function fillAir(name) {
    const want = STAGES[name]?.air ?? null;
    if (want === kind) return;
    clearAir();
    if (!want || !alive()) return;
    const spec = AIR[want];
    const r = airRng(name);
    const doc = air.ownerDocument;
    for (let i = 0; i < spec.count; i++) {
      const p = spec.trip(r);
      const el = doc.createElement('span');
      el.className = `air-${want}`;
      el.style.left = `${p.x.toFixed(1)}%`;
      el.style.top = `${p.y.toFixed(1)}%`;
      el.style.setProperty('--s', `${p.size.toFixed(1)}px`);
      air.appendChild(el);
      if (typeof el.animate !== 'function') continue;
      // Arrancan en cualquier punto de su vuelta: si no, todas saldrían juntas del borde.
      const anim = el.animate(airFrames(p), {
        duration: p.dur, iterations: Infinity, easing: 'linear', delay: -r() * p.dur,
      });
      anims.push(anim);
    }
    kind = want;
    setRate(pace);
  }

  /** Un estado de ánimo del lugar por un rato (ver `data-mood` en `styles.css`). */
  function mood(name, ms) {
    clearTimeout(moodTimer);
    arena.dataset.mood = name;
    moodTimer = setTimeout(() => {
      if (arena.dataset.mood === name) delete arena.dataset.mood;
    }, ms);
    moodTimer?.unref?.();
  }

  /** El aire va a `rate` un rato y después vuelve a lo que pide la cadena. */
  function burst(rate, ms) {
    clearTimeout(paceTimer);
    setRate(rate);
    paceTimer = setTimeout(() => {
      paceTimer = null;
      setRate(pace);
    }, ms);
    paceTimer?.unref?.();
  }

  return {
    /** Se para en `name`. Uno que no existe deja la mesa con el terreno de la clase. */
    set(name) {
      if (!arena) return;
      if (isStage(name)) arena.dataset.stage = name;
      else delete arena.dataset.stage;
      fillAir(isStage(name) ? name : null);
    },

    /**
     * La tensión del momento, de 0 a 1, y el color del que la está armando. Cambia a
     * cada carta, así que no hace nada si no cambió.
     */
    heat(value, color = null) {
      const h = Math.max(0, Math.min(1, Number(value) || 0));
      if (color) arena?.style?.setProperty('--heat-c', color);
      if (Math.abs(h - heat) < 0.001) return;
      heat = h;
      arena?.style?.setProperty('--heat', h.toFixed(3));
      pace = 1 + h * 1.6;
      if (!paceTimer) setRate(pace);
    },

    /** La cadena se cortó: se apagan las luces y el aire se queda casi quieto. */
    bust() {
      mood('bust', SCENE_BUST_MS);
      burst(0.2, SCENE_BUST_MS);
    },

    /**
     * "¿Una más?": el lugar se apaga y el aire casi se detiene mientras se espera la
     * carta, como el tráiler antes del corte. `ms` es lo que dura la espera.
     */
    hush(ms) {
      mood('hush', ms);
      burst(0.1, ms);
    },

    /** Un golpe que conecta. De 8 para arriba la tribuna salta. */
    cheer(amount = 0) {
      if (amount < 8) return;
      mood('cheer', SCENE_CHEER_MS);
      burst(2 + Math.min(amount, 30) / 10, SCENE_CHEER_MS);
    },

    /** Partida nueva: sin tensión, sin apagón. */
    reset() {
      clearTimeout(moodTimer);
      clearTimeout(paceTimer);
      paceTimer = null;
      if (arena?.dataset) delete arena.dataset.mood;
      this.heat(0);
      setRate(1);
    },
  };
}
