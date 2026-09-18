// Las animaciones de los poderes: cada carta con poder cuenta con su propio gesto lo
// que hace.
//
// Un poder se ve en tres tiempos, siempre los mismos: la carta que lo trae se enciende
// en la mesa, su amuleto viaja hasta el Axie sobre el que cae —el propio o el rival— y,
// al llegar, revienta el efecto del kit, el Axie reacciona y la chapa muestra lo que le
// quedó puesto. Lo que cambia de un poder a otro es el carácter de cada tiempo, y no se
// repite ninguno: el huevo se tira y rebota, el veneno se revolea, la pluma cae del
// cielo, el amuleto de fuerza se clava de un envión, la bebida se vuelca sobre el número
// de daño, el pulpo salta,
// la burbuja sube, la maceta brota del piso, la hoja vuela en remolino, el caracol se
// arrastra, la daga se clava y vuelve con la vida, y la máscara salta y cae puesta.
//
// El motor dice qué poderes actuaron (`state.powerFx`, y la pluma en `lastHit`) y
// cuánto espera a que se vean (`POWER_BEAT`); acá se decide cómo. Como el golpe, todo
// esto es decorado: sin canvas, sin Web Animations o con el sistema pidiendo menos
// movimiento, los tiempos son los mismos y lo que queda es el cartel y la chapa.
import { POWERS, iconUrl, powerIcon } from './data.js';
import { POWER_LEAD, powerBeat } from './game.js';
import { tr } from './i18n.js';
import { preloadVfx } from './vfx.js';

/**
 * Del instante del golpe al primer poder, en ms. Con el golpe que más tarda en
 * conectar (700) da justo `POWER_LEAD`, que es lo que el motor le reserva.
 */
export const POWER_GAP = POWER_LEAD - 700;

/** Lo que la carta brilla sola antes de que el amuleto salga de ella, en ms. */
const CARD_LEAD = 260;

/** Lo que se separan los orbes que vuelven de la daga, en ms. */
const ORB_GAP = 90;

const fxIcon = (id) => powerIcon(id, 'sm');
/** El símbolo del estado que deja un poder, el mismo de la chapa (`Icons/status-*.png`). */
const fxStatus = (id) => `<img class="power power--sm" src="${iconUrl(`status-${id}.png`)}" alt="">`;
const fxShield = () => `<img class="power power--sm" src="${iconUrl('shield.png')}" alt="">`;
const fxLabel = (id) => `<span class="dmg-label">${fxIcon(id)} ${tr(POWERS[id].name)}</span>`;

/**
 * Cada poder, por momento. Todas las claves son optativas:
 *   `flight`  el viaje del amuleto: `path` es su recorrido (ver `FLIGHT_PATHS`), `ms`
 *             lo que tarda y el resto lo afina. `from`/`to` dicen de dónde a dónde:
 *             `card` (la carta que lo trajo, por omisión), `self` (el Axie sobre el
 *             que cae), `market` (el centro) o `card0` (la carta que abre la ronda)
 *   `pip`     la marca de la chapa que deja (una o varias): se guarda hasta que el
 *             amuleto llega
 *   `clip`    el efecto del kit que revienta al llegar (`vfx-clips.js`), `width` su
 *             ancho en anchos de Axie
 *   `motion`  el gesto del Axie que lo recibe; `react` el pulso del CSS encima
 *   `sfx`     el sonido, que se larga antes para que su pico caiga al llegar; con
 *             `contact` arranca justo al tocar. `flySfx` suena mientras viaja
 *   `hp`      la vida que ya cambió en el estado pero la chapa no muestra hasta que
 *             el poder llega: `[asiento, cuánto]`, positivo si es daño
 *   `swing`   el daño que suma al número grande: se retiene y, al llegar, sube contando
 *   `back`    un segundo viaje de vuelta, del que recibió al que lo jugó; su `sfx`
 *             arranca cuando salen los orbes
 *   `tag`     el cartel que sube sobre el Axie (vacío, no sube nada)
 *   `hud`     el cartel que sube de la chapa: `at` es de dónde (`hp`, la vida, o
 *             `shield`, el escudo) y `html` lo que dice
 */
export const POWER_FX = {
  strength: {
    // El amuleto de fuerza no se tira: sale de un envión derecho al Axie y se le mete.
    draw: {
      flight: { path: 'surge', ms: 520 },
      pip: 'strength', clip: 'strength', width: 1.9,
      motion: 'snarl', sfx: 'strength',
      tag: (fx) => `${fxStatus('strength')} +${fx.amount}`,
    },
  },
  brutal: {
    // Al plantarse, justo antes del golpe: la bebida sube de la carta, se frena arriba y
    // se vuelca de cabeza sobre el número de daño, que sube contando lo que suma.
    stand: {
      flight: { path: 'pour', ms: 900, lift: 110, to: 'swing' },
      clip: 'brutal', width: 1.6, swing: true,
      motion: 'stomp', sfx: 'brutal', contact: true,
    },
  },
  octopus: {
    // El pulpo va a los saltos, y cada vez que toca el piso se aplasta.
    apply: {
      flight: { path: 'hop', ms: 820, hops: 3, height: 46 },
      pip: 'octopus', clip: 'octopus', width: 1.8,
      motion: 'cheer', sfx: 'octopus',
      tag: () => `${fxIcon('octopus')} +1`,
    },
    // Cuando se abre la carta extra, salta del Axie al centro.
    pick: {
      flight: { path: 'hop', ms: 720, hops: 2, height: 40, from: 'self', to: 'market' },
      marketFx: 'octopus', sfx: 'octopus', sfxRate: 1.2,
    },
  },
  bubble: {
    // La burbuja no se tira: sube sola, meciéndose, y se va hinchando.
    apply: {
      flight: { path: 'rise', ms: 1000, wobble: 18 },
      pip: 'bubble', clip: 'bubble', width: 1.9,
      motion: 'peek', sfx: 'bubble',
      tag: () => fxIcon('bubble'),
    },
    // La carta del centro queda adentro: la burbuja sube del centro al Axie.
    trap: {
      flight: { path: 'rise', ms: 900, wobble: 14, from: 'market' },
      pip: 'bubble', motion: 'cheer', sfx: 'bubble', sfxRate: 1.15,
    },
    // Y abre la ronda siguiente: baja del Axie a la primera carta y revienta encima.
    open: {
      flight: { path: 'pop', ms: 760, from: 'self', to: 'card0' },
      clip: 'bubble', width: 2.6,
      motion: 'cheer', sfx: 'bubblePop', contact: true,
    },
  },
  egg: {
    apply: {
      flight: { path: 'lob', ms: 680, arc: 90 },
      pip: ['egg', 'shield'], clip: 'eggShield', width: 2,
      motion: 'cheer', sfx: 'egg',
      hud: { at: 'shield', kind: 'shield', html: (fx) => `${fxShield()} +${fx.amount}` },
    },
  },
  // La pluma pega apenas sale del mazo, así que llega como golpe (`lastHit`) y no como
  // efecto de plantarse; ver `feather` más abajo.
  feather: {
    draw: {
      flight: { path: 'fall', ms: 1250, height: 300, sway: 34, swings: 2.5 },
      clip: 'feather', width: 1.8,
      motion: 'hurt', react: 'hit',
      flySfx: 'feather', sfx: 'thorns', contact: true,
      hp: (fx) => [[fx.on, fx.amount]],
      tag: (fx) => `${fxLabel('feather')}−${fx.amount}`,
    },
  },
  pot: {
    // La maceta no viaja: brota del piso a los pies del Axie.
    apply: {
      flight: { path: 'sprout', ms: 800, from: 'self' },
      clip: 'pot', width: 2,
      motion: 'chew', sfx: 'pot',
      hp: (fx) => [[fx.on, -fx.amount]],
      hud: { at: 'hp', kind: 'heal', html: (fx) => (fx.amount > 0 ? `+${fx.amount} HP` : '') },
    },
  },
  leaf: {
    // La hoja llega en remolino, girando alrededor del camino.
    apply: {
      flight: { path: 'spiral', ms: 950, radius: 46, turns: 1.5 },
      pip: 'leaf', clip: 'leaf', width: 1.9,
      motion: 'scratch', sfx: 'leaf',
      tag: (fx) => `${fxIcon('leaf')} +${fx.amount}`,
    },
    tick: {
      pip: 'leaf', clip: 'leaf', width: 1.3,
      motion: 'cheer', sfx: 'leafHeal',
      hp: (fx) => [[fx.on, -fx.amount]],
      hud: { at: 'hp', kind: 'heal', html: (fx) => (fx.amount > 0 ? `${fxIcon('leaf')} +${fx.amount} HP` : '') },
    },
  },
  snail: {
    // El caracol se arrastra hasta el rival, a paso de caracol.
    apply: {
      flight: { path: 'crawl', ms: 1300 },
      pip: 'weak', clip: 'snail', width: 1.9,
      motion: 'whiff', sfx: 'snail',
      tag: () => `${fxIcon('snail')} ½`,
    },
    // Y le parte el ataque al medio cuando lo suelta.
    slow: {
      pip: 'weak', motion: 'whiff', sfx: 'snail', sfxRate: 1.3,
      tag: () => `${fxIcon('snail')} ×½`,
    },
  },
  leech: {
    // La daga toma envión para atrás, se clava, y la vida vuelve en orbes. El drenaje
    // del kit tarda más de un segundo en crecer: largado solo, la daga se clavaba en
    // silencio. Por eso se clava con el tajo de Bicho y el drenaje acompaña a los orbes.
    apply: {
      flight: { path: 'stab', ms: 540 },
      clip: 'leech', width: 1.9,
      motion: 'hurt', react: 'hit', sfx: 'bug',
      hp: (fx) => [[fx.on, fx.amount], [fx.by, -fx.heal, 'back']],
      tag: (fx) => `${fxLabel('leech')}−${fx.amount}`,
      back: {
        path: 'siphon', ms: 720, orbs: 4,
        motion: 'snap', sfx: 'leech',
        hud: { at: 'hp', kind: 'heal', html: (fx) => (fx.heal > 0 ? `+${fx.heal} HP` : '') },
      },
    },
  },
  poison: {
    apply: {
      flight: { path: 'hurl', ms: 700, arc: 150, spin: 720 },
      pip: 'poison', clip: 'poison', width: 2.1,
      motion: 'whiff', sfx: 'poison',
      tag: (fx) => `${fxIcon('poison')} ${fx.amount}`,
    },
    // El veneno que muerde no sale de ninguna carta: brota del Axie que lo tiene. El
    // mordisco va primero y la nube después: la nube del kit se pone espesa pasado el
    // medio segundo y, sumada en luz encima de la chapa, borra el número que tape.
    tick: {
      pip: 'poison', clip: 'poison', width: 1.2,
      motion: 'hurt', react: 'hit',
      sfx: 'poison', sfxRate: 0.85,
      tag: (fx) => `${fxLabel('poison')}−${fx.amount}`,
    },
  },
  steelskin: {
    // La máscara salta alto dando vueltas de moneda y cae puesta de un golpe.
    apply: {
      flight: { path: 'mask', ms: 980, height: 170 },
      pip: ['steelskin', 'shield'], clip: 'steelskin', width: 1.9,
      motion: 'stomp', sfx: 'block', sfxRate: 0.75, contact: true,
      tag: (fx) => `${fxIcon('steelskin')} ≤${fx.amount}`,
      // Y el escudo que suma, desde la chapa, como el del huevo.
      hud: { at: 'shield', kind: 'shield', html: (fx) => (fx.shield > 0 ? `${fxShield()} +${fx.shield}` : '') },
    },
    // Y frena el golpe que se pasaba del tope.
    block: {
      clip: 'eggShield', width: 1.7,
      motion: 'snarl', sfx: 'block', sfxRate: 0.85,
      tag: (fx) => `${fxIcon('steelskin')} ≤${fx.amount}`,
    },
  },
};

/** Los efectos del kit que puede pedir cada poder en la partida, para bajarlos antes. */
const POWER_CLIPS = {
  strength: ['strength'],
  brutal: ['brutal'],
  octopus: ['octopus'],
  bubble: ['bubble'],
  egg: ['eggShield', 'eggBreak', 'eggThorns'],
  feather: ['feather'],
  pot: ['pot'],
  leaf: ['leaf'],
  snail: ['snail'],
  leech: ['leech'],
  poison: ['poison'],
  steelskin: ['steelskin', 'eggShield'],
};

/** Precarga los efectos de los poderes en juego: el primero no tiene que llegar tarde. */
export function preloadPowers(powers = []) {
  for (const power of powers) for (const key of POWER_CLIPS[power] ?? []) preloadVfx(key);
}

/**
 * En qué momento arranca cada efecto, en ms desde `start`: uno atrás del otro, cada uno
 * con el compás que le reserva el motor. Es lo mismo que suma `finishTurn` para
 * esperar, y por eso el último termina antes de que se abra el centro.
 */
export function powerTimeline(event, start = 0) {
  let at = start;
  return event.fx.map((fx) => {
    const step = { at, fx };
    at += powerBeat(fx);
    return step;
  });
}

const fxLerp = (from, to, k) => from + (to - from) * k;
const fxSmooth = (t) => t * t * (3 - 2 * t);
/** Se pasa un poco y vuelve: lo que crece de golpe. */
const fxOvershoot = (t) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;

/**
 * Los recorridos, uno por poder. Cada uno dice dónde está el amuleto en el instante `t`
 * (de 0 a 1) entre `a`, el centro de donde sale, y `b`, el punto del Axie donde cae;
 * `box` es la caja de lo que recibe. Devuelven posición, giro y escala (`sx`/`sy` si se
 * deforma).
 */
const FLIGHT_PATHS = {
  // El huevo: se tira sin fuerza, sube un poco, cae y rebota dos veces antes de quedarse.
  lob(t, a, b, f) {
    const air = Math.min(t / 0.7, 1);
    const bounce = t < 0.7 ? 0 : Math.abs(Math.sin(((t - 0.7) / 0.3) * Math.PI * 2)) * (1 - (t - 0.7) / 0.3) * 16;
    return {
      x: fxLerp(a.x, b.x, air),
      y: fxLerp(a.y, b.y, air) - f.arc * 4 * air * (1 - air) - bounce,
      rotate: 14 * Math.sin(t * Math.PI * 3) * (1 - t),
      scale: 1 + 0.3 * Math.sin(air * Math.PI),
    };
  },
  // El veneno: se revolea alto, girando entero, y se clava de golpe.
  hurl(t, a, b, f) {
    const k = fxSmooth(t) * 0.4 + t * t * 0.6;
    return {
      x: fxLerp(a.x, b.x, k),
      y: fxLerp(a.y, b.y, k) - f.arc * 4 * k * (1 - k),
      rotate: f.spin * k,
      scale: 1 + 0.45 * Math.sin(k * Math.PI),
    };
  },
  // La pluma: aparece arriba del rival y baja de un lado al otro, inclinándose hacia
  // donde va, cada vez más despacio hasta tocarlo.
  fall(t, a, b, f) {
    const k = 1 - (1 - t) ** 1.6;
    return {
      x: b.x + f.sway * Math.sin(t * Math.PI * 2 * f.swings) * (1 - t * 0.7),
      y: b.y - f.height * (1 - k),
      rotate: 28 * Math.cos(t * Math.PI * 2 * f.swings) * (1 - t * 0.6),
      scale: 1,
    };
  },
  // La fuerza: en línea recta y acelerando, y al entrar se agranda como un puñetazo.
  surge(t, a, b) {
    const k = t ** 2.2;
    return {
      x: fxLerp(a.x, b.x, k),
      y: fxLerp(a.y, b.y, k),
      rotate: 0,
      scale: t < 0.85 ? 0.8 + 0.4 * k : 1.2 + ((t - 0.85) / 0.15) * 0.9,
    };
  },
  // La bebida: sube derecho de la carta, se frena arriba agitándose y se tira de cabeza
  // sobre el número, dándose vuelta como quien la vuelca entera.
  pour(t, a, b, f) {
    const top = { x: a.x, y: a.y - f.lift };
    if (t < 0.4) {
      const u = 1 - (1 - t / 0.4) ** 2;
      return { x: a.x, y: fxLerp(a.y, top.y, u), rotate: 0, scale: 1 + 0.2 * u };
    }
    if (t < 0.55) {
      const v = (t - 0.4) / 0.15;
      return { x: top.x + 4 * Math.sin(v * Math.PI * 6), y: top.y, rotate: 12 * Math.sin(v * Math.PI * 6), scale: 1.2 };
    }
    const w = ((t - 0.55) / 0.45) ** 2;
    return { x: fxLerp(top.x, b.x, w), y: fxLerp(top.y, b.y, w), rotate: 180 * w, scale: 1.2 - 0.2 * w };
  },
  // El pulpo: a los saltos, aplastándose cada vez que toca el piso.
  hop(t, a, b, f) {
    const k = fxSmooth(t);
    const phase = (t * f.hops) % 1;
    const low = phase < 0.14 || phase > 0.86;
    return {
      x: fxLerp(a.x, b.x, k),
      y: fxLerp(a.y, b.y, k) - f.height * Math.abs(Math.sin(t * Math.PI * f.hops)),
      rotate: 0,
      scale: 1,
      sx: low ? 1.28 : 0.9,
      sy: low ? 0.78 : 1.12,
    };
  },
  // La burbuja: sube sola, meciéndose de costado, y se va hinchando.
  rise(t, a, b, f) {
    const k = 1 - (1 - t) ** 2;
    return {
      x: fxLerp(a.x, b.x, k) + f.wobble * Math.sin(t * Math.PI * 4),
      y: fxLerp(a.y, b.y, k),
      rotate: 0,
      scale: 0.7 + 0.5 * t,
    };
  },
  // La burbuja que abre la ronda: baja hasta la carta y revienta.
  pop(t, a, b) {
    const k = fxSmooth(Math.min(t / 0.8, 1));
    return {
      x: fxLerp(a.x, b.x, k) + 8 * Math.sin(t * Math.PI * 3) * (1 - k),
      y: fxLerp(a.y, b.y, k),
      rotate: 0,
      scale: t < 0.8 ? 1 : 1 + ((t - 0.8) / 0.2) * 1.4,
    };
  },
  // La maceta: brota del piso a los pies del Axie y crece de golpe, hamacándose.
  sprout(t, a, b, f, box) {
    const ground = b.y + box.height * 0.5;
    const grow = fxOvershoot(Math.min(t / 0.6, 1));
    return {
      x: b.x,
      y: ground - box.height * 0.4 * fxSmooth(t),
      rotate: 10 * Math.sin(t * Math.PI * 3) * (1 - t),
      scale: Math.max(grow, 0.05) * 1.1,
    };
  },
  // La hoja: en remolino, dando vueltas alrededor del camino hasta posarse.
  spiral(t, a, b, f) {
    const k = fxSmooth(t);
    const angle = t * Math.PI * 2 * f.turns;
    const r = f.radius * (1 - t);
    return {
      x: fxLerp(a.x, b.x, k) + r * Math.cos(angle),
      y: fxLerp(a.y, b.y, k) + r * Math.sin(angle),
      rotate: (angle * 180) / Math.PI / 2,
      scale: 1,
    };
  },
  // El caracol: pegado al piso, de a tirones —se estira, avanza, se junta— y mirando
  // para donde va.
  crawl(t, a, b, f, box) {
    const pulls = 6;
    const k = t - Math.sin(t * Math.PI * 2 * pulls) / (Math.PI * 2 * pulls);
    const stretch = Math.abs(Math.sin(t * Math.PI * pulls));
    const dir = b.x < a.x ? -1 : 1;
    return {
      x: fxLerp(a.x, b.x, k),
      y: fxLerp(a.y, b.y + box.height * 0.3, k) - 3 * stretch,
      rotate: 0,
      scale: 1,
      sx: dir * (1 + 0.25 * stretch),
      sy: 1 - 0.15 * stretch,
    };
  },
  // La daga: toma envión para atrás y sale disparada, apuntando al rival.
  stab(t, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const pull = t < 0.3 ? Math.sin((t / 0.3) * (Math.PI / 2)) * 26 : 26 * (1 - (t - 0.3) / 0.7);
    const k = t < 0.3 ? 0 : ((t - 0.3) / 0.7) ** 3;
    return {
      x: fxLerp(a.x, b.x, k) - (dx / len) * pull,
      y: fxLerp(a.y, b.y, k) - (dy / len) * pull,
      rotate: angle + 45,
      scale: 1.1,
    };
  },
  // La vida que vuelve: orbes que ondean de un Axie al otro.
  siphon(t, a, b) {
    const k = fxSmooth(t);
    return {
      x: fxLerp(a.x, b.x, k),
      y: fxLerp(a.y, b.y, k) + 26 * Math.sin(t * Math.PI * 2) * (1 - t * 0.5),
      rotate: 0,
      scale: 0.8 + 0.4 * Math.sin(t * Math.PI),
    };
  },
  // La máscara: salta alto dando vueltas de moneda y cae puesta, derecha y de golpe.
  mask(t, a, b, f) {
    if (t < 0.65) {
      const u = 1 - (1 - t / 0.65) ** 2;
      return {
        x: fxLerp(a.x, b.x, u),
        y: fxLerp(a.y, b.y - f.height, u),
        rotate: 0,
        scale: 1.2,
        sx: Math.cos(u * Math.PI * 4),
      };
    }
    const v = (t - 0.65) / 0.35;
    return {
      x: b.x,
      y: b.y - f.height + f.height * v * v,
      rotate: 0,
      scale: 1.2,
      sy: v > 0.9 ? 0.8 : 1,
    };
  },
};

/** Cuándo llega el amuleto y cuándo vuelve lo de `back`, en ms desde que arranca. */
function arrivalOf(spec) {
  const land = spec.flight ? CARD_LEAD + spec.flight.ms : 0;
  const back = spec.back ? land + spec.back.ms + ORB_GAP * ((spec.back.orbs ?? 1) - 1) : land;
  return { land, back };
}

/**
 * El que anima los poderes sobre la mesa. Recibe lo que ya tiene la pantalla —el
 * reproductor de efectos, el audio, los nodos que no se repintan y los pulsos del
 * CSS— para no tener una segunda copia de nada.
 */
export function createPowerFx({
  vfx, audio, field, market, swing, plates, portraits, motions, pulse, floatTag, shake, sideOf,
  holdHp, releaseHp, holdSwing, releaseSwing,
}) {
  const quiet = Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  // Una partida nueva deja sin efecto todo lo que la anterior tenía agendado.
  let era = 0;
  const later = (ms, fn) => {
    const mine = era;
    const t = setTimeout(() => mine === era && fn(), ms);
    t?.unref?.();
  };

  /**
   * El dibujo del Axie, que es adonde apuntan el amuleto y el efecto. El nodo del
   * peleador ocupa media pantalla y el Axie está parado contra un costado: centrado en
   * el nodo, el efecto caía al lado del bicho y, medido con ese ancho, no entraba.
   */
  const art = (seat) => portraits[seat]?.querySelector?.('.axie') ?? portraits[seat];

  /**
   * Las cartas de la mesa que traen `power`. La cadena de la mesa es la del que tiene
   * el turno, que es justo el que acaba de jugar el poder.
   */
  function cardsWith(power) {
    return [...(field?.querySelectorAll?.(`.strip > .card[data-col] .card-power[data-powers~="${power}"]`) ?? [])]
      .map((chip) => chip.closest?.('.card'))
      .filter(Boolean);
  }

  /** Un punto de la pantalla por su nombre (ver `flight` en `POWER_FX`). */
  function spot(where, fx, by, cards) {
    if (where === 'card') return cards[cards.length - 1] ?? art(by);
    if (where === 'market') return market?.querySelector?.('.overlay-head') ?? market;
    if (where === 'swing') return swing?.querySelector?.('.swing-dmg') ?? swing;
    if (where === 'card0') return field?.querySelector?.('.strip > .card[data-col="0"]') ?? art(fx.on);
    return art(fx.on);
  }

  /** La carta se enciende con el gesto de su poder (ver `.card[data-fx]` en el CSS). */
  function lightCard(card, power) {
    if (!card?.dataset) return;
    // Una carta recién robada todavía tiene la entrada puesta (`deal`): el gesto la pisa
    // y, al terminar, la entrada volvía a correr desde cero y la carta parpadeaba.
    card.classList?.add('is-settled');
    card.dataset.fx = '';
    void card.offsetWidth;
    card.dataset.fx = power;
    later(900, () => {
      if (card.dataset.fx === power) card.dataset.fx = '';
    });
  }

  /**
   * La marca del poder en la chapa se guarda hasta que el amuleto llega: la chapa se
   * repinta con el estado nuevo en el mismo instante en que se juega el poder, y el
   * huevo aparecía puesto antes de que nadie lo tirara.
   */
  const waiting = new Map();
  function holdPip(seat, pip) {
    const plate = plates?.[seat];
    if (!plate?.dataset) return;
    const key = `${seat}:${pip}`;
    waiting.set(key, (waiting.get(key) ?? 0) + 1);
    plate.dataset.fxWait = [...new Set([...(plate.dataset.fxWait ?? '').split(' ').filter(Boolean), pip])].join(' ');
  }
  function showPip(seat, pip) {
    const plate = plates?.[seat];
    if (!plate?.dataset) return;
    const key = `${seat}:${pip}`;
    const left = (waiting.get(key) ?? 1) - 1;
    if (left > 0) waiting.set(key, left);
    else {
      waiting.delete(key);
      plate.dataset.fxWait = (plate.dataset.fxWait ?? '').split(' ').filter((p) => p && p !== pip).join(' ');
    }
  }

  /** Lo que la pantalla guarda de un efecto al anotarse: la marca y la vida. */
  const pipsOf = (spec) => [].concat(spec.pip ?? []);
  function hold(fx) {
    const spec = POWER_FX[fx.power]?.[fx.moment];
    if (!spec) return;
    if (spec.flight) pipsOf(spec).forEach((pip) => holdPip(fx.on, pip));
    for (const [seat, delta] of spec.hp?.(fx) ?? []) if (delta) holdHp?.(seat, delta);
    if (spec.swing) holdSwing?.(fx.on, fx.amount);
  }
  function release(fx, spec, stage) {
    for (const [seat, delta, when = 'hit'] of spec.hp?.(fx) ?? []) {
      if (delta && when === stage) releaseHp?.(seat, delta);
    }
  }

  /** El amuleto —o un orbe— que viaja de `from` a `to`, en coordenadas de la ventana. */
  function fly(power, from, to, flight) {
    const doc = globalThis.document;
    if (quiet || !doc?.createElement || !doc.body) return;
    const a = from?.getBoundingClientRect?.();
    const b = to?.getBoundingClientRect?.();
    if (!a?.width || !b?.width) return;
    const orb = Boolean(flight.orbs);
    const el = doc.createElement(orb ? 'span' : 'img');
    if (typeof el.animate !== 'function') return;
    el.className = orb ? 'power-orb' : 'power-fly';
    el.dataset.power = power;
    if (!orb) {
      el.alt = '';
      el.src = POWERS[power].icon;
      // Del tamaño del Axie y no fijo: en un teléfono parado el bicho mide cien píxeles
      // y un amuleto de escritorio le tapaba la cara entera.
      const size = Math.round(Math.min(48, Math.max(26, b.width * 0.22)));
      el.style.width = el.style.height = `${size}px`;
    }
    doc.body.appendChild(el);

    const start = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
    const end = { x: b.left + b.width / 2, y: b.top + b.height * 0.45 };
    const place = FLIGHT_PATHS[flight.path];
    const frames = [];
    const STEPS = 40;
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const { x, y, rotate, scale, sx = 1, sy = 1 } = place(t, start, end, flight, b);
      // Aparece al salir y se funde al llegar: lo que queda es el efecto.
      frames.push({
        offset: t,
        opacity: t < 0.1 ? t / 0.1 : t > 0.9 ? (1 - t) / 0.1 : 1,
        transform: `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${rotate}deg) scale(${sx * scale}, ${sy * scale})`,
      });
    }
    // El ritmo está adentro de cada recorrido: la animación corre pareja.
    const anim = el.animate(frames, { duration: flight.ms, easing: 'linear', fill: 'forwards' });
    const drop = () => el.remove();
    anim.finished?.then(drop, drop);
  }

  /** El sonido de un efecto: su pico cae con `at`, o arranca ahí si es de contacto. */
  function sound(key, at, { rate = 1, contact = false } = {}) {
    const lead = contact ? 0 : (audio?.lead?.(key, rate) ?? 0);
    audio?.sfx?.(key, { rate, delay: Math.max(at - lead, 0) });
  }

  /**
   * Un efecto de punta a punta: la carta, el viaje y la llegada. `by` es el asiento que
   * jugó el poder; `fx.on`, sobre el que cae.
   */
  function run(fx, by) {
    const spec = POWER_FX[fx.power]?.[fx.moment];
    if (!spec) return;
    const { land, back } = arrivalOf(spec);
    const flight = spec.flight;
    const cards = ['apply', 'draw', 'stand'].includes(fx.moment) ? cardsWith(fx.card ?? fx.power) : [];
    cards.forEach((card) => lightCard(card, fx.power));
    const target = flight ? spot(flight.to ?? 'on', fx, by, cards) : art(fx.on);

    if (flight) {
      // Sale de la última carta con ese poder, que es la que se ve más cerca del final
      // de la cadena. Sin carta a la vista —una carta gigante, la mesa de otro— sale
      // del Axie que lo jugó.
      const from = spot(flight.from ?? 'card', fx, by, cards);
      later(CARD_LEAD, () => fly(fx.card ?? fx.power, from, target, flight));
      if (spec.flySfx) sound(spec.flySfx, CARD_LEAD, { contact: true });
    }
    if (spec.sfx) sound(spec.sfx, land, { rate: spec.sfxRate, contact: spec.contact });

    later(land, () => {
      if (spec.clip) vfx.play(spec.clip, target, { from: sideOf(by), width: spec.width });
      const pips = pipsOf(spec);
      if (flight) pips.forEach((pip) => showPip(fx.on, pip));
      // Aparece de un salto; y la que ya estaba y vuelve a actuar, late.
      if (pips.length) pulse(plates?.[fx.on], 'fxPop', pips.join(' '), 650);
      if (spec.swing) releaseSwing?.(fx.on, fx.amount);
      if (spec.marketFx) pulse(market, 'fx', spec.marketFx, 900);
      release(fx, spec, 'hit');
      react(fx.on, spec, fx, `power-${fx.power}-${fx.moment}`);
    });

    if (spec.back) {
      if (spec.back.sfx) sound(spec.back.sfx, land, { contact: true });
      for (let i = 0; i < (spec.back.orbs ?? 1); i++) {
        later(land + i * ORB_GAP, () => fly(fx.power, art(fx.on), art(by), spec.back));
      }
      later(back, () => {
        release(fx, spec, 'back');
        react(by, spec.back, fx, `power-${fx.power}-back`);
      });
    }
  }

  function react(seat, spec, fx, kind) {
    const node = portraits[seat];
    if (spec.react) pulse(node, 'react', spec.react, 900);
    if (spec.motion) motions[seat]?.pulse(spec.motion);
    if (spec.react === 'hit') shake?.(fx.amount, seat);
    const text = spec.tag?.(fx);
    if (text && node) floatTag(node, kind, text);
    if (spec.hud) hudTag(seat, spec.hud, fx);
  }

  /**
   * Un cartel que sube de la chapa: la cura saliendo del número de la vida, el escudo
   * saliendo de su insignia. Va colgado del `body` y no de la chapa porque la chapa se
   * repinta mientras la vida cuenta, y se lo llevaría puesto.
   */
  function hudTag(seat, hud, fx) {
    const doc = globalThis.document;
    const html = hud.html(fx);
    const anchor = plates?.[seat]?.querySelector?.(hud.at === 'shield' ? '.plate-shield' : '.plate-hp > b');
    const box = anchor?.getBoundingClientRect?.();
    if (!html || !doc?.createElement || !doc.body || !box?.width) return;
    const tag = doc.createElement('span');
    tag.className = 'hud-tag';
    tag.dataset.kind = hud.kind;
    tag.innerHTML = html;
    tag.style.left = `${box.left + box.width / 2}px`;
    tag.style.top = `${box.top}px`;
    doc.body.appendChild(tag);
    tag.addEventListener?.('animationend', () => tag.remove());
    // Por si la animación no corre (menos movimiento, pestaña de fondo): que no quede.
    later(1600, () => tag.remove());
  }

  return {
    /** Los poderes de `state.powerFx`, de a uno, arrancando `start` ms desde ahora. */
    play(event, start = 0) {
      // Lo que se guarda, ya: la chapa se acaba de repintar con todo puesto.
      event.fx.forEach(hold);
      for (const { at, fx } of powerTimeline(event, start)) later(at, () => run(fx, fx.by ?? event.player));
    },
    /** Corta lo que quedaba agendado y devuelve las marcas de la chapa a la vista. */
    reset() {
      era++;
      waiting.clear();
      for (const plate of Object.values(plates ?? {})) if (plate?.dataset) plate.dataset.fxWait = '';
    },
    /** La pluma que pega apenas sale del mazo: llega como golpe (`kind: 'feather'`). */
    feather(hit) {
      const fx = { power: 'feather', moment: 'draw', by: hit.by, on: hit.target, amount: hit.amount };
      hold(fx);
      run(fx, hit.by);
    },
  };
}
