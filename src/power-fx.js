// Las animaciones de los poderes: cada carta con poder cuenta con su propio gesto lo
// que hace.
//
// Un poder se ve en tres tiempos, siempre los mismos: la carta que lo trae se enciende
// en la mesa, su amuleto viaja hasta el Axie sobre el que cae —el propio o el rival— y,
// al llegar, revienta el efecto del kit, el Axie reacciona y la chapa muestra lo que le
// quedó puesto. Lo que cambia de un poder a otro es el carácter de cada tiempo, y no se
// repite ninguno: el huevo se rompe y da la segunda chance, el veneno se revolea, la
// pluma cae del cielo, el amuleto de fuerza se clava de un envión, la navaja y la daga
// dejan sangrando, el pulpo salta, la burbuja sube, la maceta brota del piso, la hoja
// vuela en remolino, el caracol se arrastra, la daga de Mantis se clava y vuelve con la
// vida, y la máscara salta y cae puesta con sus espinas.
//
// El motor dice qué poderes actuaron (`state.powerFx`, y la pluma en `lastHit`) y
// cuánto espera a que se vean (`POWER_BEAT`); acá se decide cómo. Como el golpe, todo
// esto es decorado: sin canvas, sin Web Animations o con el sistema pidiendo menos
// movimiento, los tiempos son los mismos y lo que queda es el cartel y la chapa.
import { POWERS, iconUrl, powerIcon } from './data.js';
import { POWER_LEAD, powerBeat } from './game.js';
import { tr } from './i18n.js';
import { preloadVfx } from './vfx.js';
import { CLIPS } from './vfx-clips.js';

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
 *             ancho en anchos de Axie. Con `clipHit` el clip arranca ya en su impacto:
 *             es para los lanzamientos del kit, que traen su vuelo, y para los que
 *             tardan en crecer (ver `HIT_LEAD`)
 *   `motion`  el gesto del Axie que lo recibe; `react` el pulso del CSS encima
 *   `sfx`     el sonido, que se larga antes para que su pico caiga al llegar; con
 *             `contact` arranca justo al tocar. `flySfx` suena mientras viaja
 *   `hp`      la vida que ya cambió en el estado pero la chapa no muestra hasta que
 *             el poder llega: `[asiento, cuánto]`, positivo si es daño
 *   `swing`   el daño que suma al número grande: se retiene y, al llegar, sube contando
 *   `at`      sin viaje, dónde revienta el efecto en vez del Axie: `egg` es la carta
 *             del huevo en la cadena (`fx.col`), que se enciende; con `crack` se parte
 *   `back`    un segundo viaje de vuelta, del que recibió al que lo jugó; su `sfx`
 *             arranca cuando salen los orbes
 *   `tag`     el cartel que sube sobre el Axie (vacío, no sube nada)
 *   `hud`     el cartel que sube de la chapa: `at` es de dónde (`hp`, la vida, o
 *             `shield`, el escudo) y `html` lo que dice
 */
/**
 * Lo que un clip con `clipHit` se adelanta a su impacto, en segundos: lo justo para que
 * se vea venir el golpe y no aparezca de la nada.
 */
const HIT_LEAD = 0.12;

// El sangrado que cae sobre el rival: la navaja, la garra y la bebida lo ponen igual,
// con el sangrado del kit, y cada uno le cambia el viaje.
const bleedOn = (flight) => ({
  flight,
  pip: 'razor', clip: 'bleed', width: 1.7,
  motion: 'hurt', react: 'hit', sfx: 'bleed',
  tag: (fx) => `${fxStatus('bleed')} +${fx.amount}`,
});
// Lo que se le pone al centro del rival (medusa, Red Bubble): el amuleto se revolea
// hasta él y le queda la marca en la chapa.
const marketLock = (id) => ({
  flight: { path: 'hurl', ms: 720, arc: 120, spin: 360 },
  pip: id, width: 1.8,
  motion: 'whiff',
  tag: () => fxIcon(id),
});

export const POWER_FX = {
  strength: {
    // El amuleto de fuerza no se tira: sale de un envión derecho al Axie y se le mete.
    // Deja una garra más.
    draw: {
      flight: { path: 'surge', ms: 520 },
      pip: 'strength', clip: 'strength', width: 1.9,
      motion: 'snarl', sfx: 'strength',
      tag: (fx) => `${fxStatus('strength')} +${fx.amount}`,
    },
    // Y cada golpe que conecta, las garras dejan sangrando al rival.
    apply: bleedOn({ path: 'surge', ms: 480 }),
  },
  brutal: {
    // La bebida se vuelca sobre el rival y le abre la herida: el debuff del kit.
    apply: {
      ...bleedOn({ path: 'pour', ms: 760, lift: 70 }),
      clip: 'debuff', sfx: 'brutal',
    },
    // Y lo que sangra por la herida le vuelve como vida al que la abrió.
    drain: {
      clip: 'wound', width: 1.3,
      motion: 'snap', sfx: 'leech', sfxRate: 1.2,
      hp: (fx) => [[fx.on, -fx.amount]],
      hud: { at: 'hp', kind: 'heal', html: (fx) => (fx.amount > 0 ? `${fxIcon('brutal')} +${fx.amount} HP` : '') },
    },
  },
  rage: {
    // La máscara sale temblando de furia, cada vez más grande, y se le pone al Axie, que ruge.
    draw: {
      flight: { path: 'quake', ms: 620 },
      pip: 'rage', clip: 'rage', width: 1.8,
      motion: 'snarl', sfx: 'rage',
      tag: (fx) => `${fxStatus('rage')} +${fx.amount}`,
    },
    // Y la Furia se descarga sobre el rival con el golpe.
    fury: {
      clip: 'fury', width: 2.4,
      motion: 'hurt', react: 'hit', sfx: 'fury',
      tag: (fx) => `${fxLabel('rage')}+${fx.amount}`,
    },
  },
  razor: {
    // La navaja sale escondida, se clava con el desgarro de Bestia del kit y deja sangrando.
    apply: {
      ...bleedOn({ path: 'slice', ms: 480, bend: 60 }),
      clip: 'razor', clipHit: true, width: 2, sfx: 'razor',
    },
    // Cada carta que roba el que sangra: el corte sale de su propio Axie.
    bleed: {
      clip: 'bleed', width: 1.2,
      motion: 'hurt', react: 'hit', sfx: 'bleed', sfxRate: 1.2,
      hp: (fx) => [[fx.on, fx.amount]],
      tag: (fx) => `${fxStatus('bleed')} −${fx.amount}`,
    },
  },
  dagger: {
    // La daga se revolea dando vueltas y se clava con el lanzamiento de Bestia del kit.
    draw: {
      ...bleedOn({ path: 'hurl', ms: 620, arc: 110, spin: 720 }),
      clip: 'dagger', clipHit: true, width: 2,
      flySfx: 'daggerFly', sfx: 'daggerHit',
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
  maker: {
    // Cada burbuja sube meciéndose hasta el Axie que la juntó.
    draw: {
      flight: { path: 'rise', ms: 800, wobble: 16 },
      pip: 'maker', clip: 'maker', width: 1.6,
      motion: 'peek', sfx: 'maker',
      tag: (fx) => `${fxStatus('bubblemaker')} ${fx.amount}`,
    },
    // Y con cuatro, la bomba: baja sobre el rival y revienta.
    bomb: {
      flight: { path: 'pop', ms: 760 },
      clip: 'bubbleBomb', clipHit: true, width: 2.6,
      motion: 'hurt', react: 'hit', sfx: 'bubblePop', contact: true,
      hp: (fx) => [[fx.on, fx.amount]],
      tag: (fx) => `${fxLabel('maker')}−${fx.amount}`,
    },
  },
  // La medusa se le mete en el mazo (el mareo del kit), y cuando sale lo deja paralizado;
  // la burbuja roja, sin poderes (el silencio del kit).
  jellyfish: {
    apply: {
      ...marketLock('jellyfish'),
      // La medusa nada a pulsos, contrayéndose como una campana.
      flight: { path: 'drift', ms: 900, pulses: 3, arc: 60 },
      clip: 'jellyfish', clipHit: true, width: 2, flySfx: 'jellyFly', sfx: 'jellyfish',
      tag: (fx) => `${fxIcon('jellyfish')} +${fx.amount}`,
    },
    sting: {
      clip: 'stun', width: 1.6,
      motion: 'hurt', react: 'hit', sfx: 'stun', sfxRate: 1.15,
      tag: () => fxIcon('jellyfish'),
    },
  },
  redbubble: {
    apply: {
      ...marketLock('redbubble'),
      flight: { path: 'rise', ms: 900, wobble: 14 },
      clip: 'silence', sfx: 'silence',
    },
  },
  egg: {
    // La segunda chance: la carta del huevo tiembla en la cadena y el huevo se rompe
    // encima de ella; el Axie festeja. La carta que cortaba la mueve la mesa (ver
    // `eggSaveFx` en `ui.js`).
    save: {
      at: 'egg', crack: true,
      clip: 'eggBreak', width: 2.2,
      motion: 'cheer', sfx: 'egg',
      tag: () => `${fxIcon('egg')} ${tr('¡Segunda chance!')}`,
    },
  },
  // La pluma pega apenas sale del mazo, así que llega como golpe (`lastHit`) y no como
  // efecto de plantarse; ver `feather` más abajo.
  feather: {
    draw: {
      flight: { path: 'fall', ms: 1250, height: 300, sway: 34, swings: 2.5 },
      clip: 'feather', width: 1.8,
      motion: 'hurt', react: 'hit',
      flySfx: 'feather', sfx: 'featherHit', contact: true,
      hp: (fx) => [[fx.on, fx.amount]],
      tag: (fx) => `${fxLabel('feather')}−${fx.amount}`,
    },
  },
  shuriken: {
    // La cadena se rompe y el shuriken sale igual, rasante y girando a toda velocidad, y
    // se clava con el lanzamiento de Pájaro del kit.
    apply: {
      flight: { path: 'zip', ms: 520, curve: 40, spin: 1440 },
      clip: 'shuriken', clipHit: true, width: 2,
      motion: 'hurt', react: 'hit', flySfx: 'shurikenFly', sfx: 'shurikenHit',
      hp: (fx) => [[fx.on, fx.amount]],
      tag: (fx) => `${fxLabel('shuriken')}−${fx.amount}`,
    },
  },
  fan: {
    draw: {
      flight: { path: 'fan', ms: 820, spread: 70 },
      pip: 'fan', clip: 'fan', width: 1.6,
      motion: 'cheer', sfx: 'fan',
      tag: (fx) => `${fxStatus('plume')} +${fx.amount}`,
    },
  },
  hammer: {
    // La cadena se rompe y el martillo sube igual sobre el rival, se echa para atrás y
    // baja de un mazazo con el golpe de Pájaro del kit: le rompe todo el escudo.
    apply: {
      flight: { path: 'slam', ms: 760, height: 150 },
      clip: 'hammer', clipHit: true, width: 2.1,
      motion: 'hurt', react: 'hit', sfx: 'hammer',
      tag: (fx) => `${fxShield()} −${fx.amount}`,
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
      tag: (fx) => `${fxStatus('leaf')} +${fx.amount}`,
    },
    tick: {
      pip: 'leaf', clip: 'leaf', width: 1.3,
      motion: 'cheer', sfx: 'leafHeal',
      hp: (fx) => [[fx.on, -fx.amount]],
      hud: { at: 'hp', kind: 'heal', html: (fx) => (fx.amount > 0 ? `${fxIcon('leaf')} +${fx.amount} HP` : '') },
    },
  },
  guard: {
    // La guardia llega dormida, cabeceando, y lo deja con escudo y el Limpiador.
    apply: {
      flight: { path: 'doze', ms: 950, arc: 70 },
      pip: ['guard', 'shield'], clip: 'cleanser', width: 1.9,
      motion: 'peek', sfx: 'cleanser',
      hud: { at: 'shield', kind: 'shield', html: (fx) => (fx.amount > 0 ? `${fxShield()} +${fx.amount}` : '') },
    },
    // El Limpiador que cancela lo que le tiraron.
    cleanse: {
      pip: 'guard', clip: 'cleanser', width: 1.4,
      motion: 'cheer', sfx: 'cleanser', sfxRate: 1.2,
      tag: () => `${fxIcon('guard')} ✕`,
    },
  },
  sage: {
    // La salvia no brota: baja como humo sahumándolo de arriba y lo limpia entero.
    apply: {
      flight: { path: 'smudge', ms: 900, height: 130, from: 'self' },
      clip: 'cleanse', width: 2,
      motion: 'cheer', sfx: 'cleanse',
      hp: (fx) => [[fx.on, -fx.amount]],
      hud: { at: 'hp', kind: 'heal', html: (fx) => (fx.amount > 0 ? `${fxIcon('sage')} +${fx.amount} HP` : '') },
    },
  },
  pillow: {
    // La almohada cae mullida y el Axie se acomoda a dormir encima.
    apply: {
      flight: { path: 'lob', ms: 680, arc: 90 },
      pip: 'pillow', clip: 'sleep', width: 1.9,
      motion: 'peek', sfx: 'sleep',
      tag: (fx) => `${fxStatus('pillow')} −${fx.amount}`,
    },
    // Y le resta lo suyo a cada golpe rival.
    block: {
      clip: 'pillow', width: 1.7,
      motion: 'snarl', sfx: 'block', sfxRate: 0.85,
      tag: (fx) => `${fxIcon('pillow')} −${fx.amount}`,
    },
  },
  snail: {
    // El caracol se arrastra hasta el rival, a paso de caracol.
    apply: {
      flight: { path: 'crawl', ms: 1300 },
      pip: 'weak', clip: 'snail', width: 1.9,
      motion: 'whiff', sfx: 'snail',
      tag: (fx) => `${fxStatus('weak')} −${fx.amount}`,
    },
    // Y le apaga las mejores rachas cuando suelta el ataque.
    slow: {
      pip: 'weak', motion: 'whiff', sfx: 'snail', sfxRate: 1.3,
      tag: (fx) => `${fxIcon('snail')} −${fx.amount}`,
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
  cocoon: {
    // El capullo baja colgado de su hilo y se hamaca hasta quedarse quieto.
    apply: {
      flight: { path: 'dangle', ms: 950, height: 160, swing: 30 },
      pip: 'cocoon', clip: 'cocoon', width: 1.7,
      motion: 'peek', sfx: 'cocoon',
      tag: (fx) => `${fxStatus('cocoon')} +${fx.amount}`,
    },
    tick: {
      pip: ['cocoon', 'shield'], clip: 'eggShield', width: 1.5,
      motion: 'cheer', sfx: 'cocoonShield',
      hud: { at: 'shield', kind: 'shield', html: (fx) => (fx.amount > 0 ? `${fxShield()} +${fx.amount}` : '') },
    },
  },
  scanner: {
    // El escáner barre de un lado al otro, como buscando, y se trae el escudo del rival.
    draw: {
      flight: { path: 'sweep', ms: 760, width: 40 },
      pip: 'shield', clip: 'scanner', width: 1.8,
      motion: 'snap', sfx: 'scanner',
      hud: { at: 'shield', kind: 'shield', html: (fx) => (fx.amount > 0 ? `${fxShield()} +${fx.amount}` : '') },
    },
  },
  trickster: {
    // El naipe vuela en zigzag dándose vuelta, como en un truco de manos.
    apply: {
      flight: { path: 'flip', ms: 760, zig: 30, arc: 100, flips: 3 },
      clip: 'hex', width: 1.7,
      motion: 'whiff', sfx: 'hex',
      tag: () => fxIcon('trickster'),
    },
    // La carta robada: el naipe le saca la carta al rival, que se queda mirando.
    pick: {
      clip: 'doubt', width: 1.5,
      motion: 'whiff', sfx: 'disarm',
      tag: (fx) => `${fx.card ? fxIcon(fx.card) : ''} ↩`,
    },
  },
  poison: {
    apply: {
      flight: { path: 'hurl', ms: 700, arc: 150, spin: 720 },
      pip: 'poison', clip: 'poison', width: 2.1,
      motion: 'whiff', sfx: 'poison',
      tag: (fx) => `${fxStatus('poison')} ${fx.amount}`,
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
    // La máscara salta alto dando vueltas de moneda y cae puesta con sus espinas.
    apply: {
      flight: { path: 'mask', ms: 980, height: 170 },
      pip: 'steelskin', clip: 'steelskin', width: 1.9,
      motion: 'stomp', sfx: 'steelskin', contact: true,
      tag: (fx) => `${fxStatus('steelskin')} +${fx.amount}`,
    },
  },
  edge: {
    // El filo cae de punta, se clava en el piso al lado del Axie y le estallan las púas
    // del golpe de Reptil del kit.
    draw: {
      flight: { path: 'plunge', ms: 700, height: 220 },
      pip: 'steelskin', clip: 'edge', clipHit: true, width: 1.8,
      motion: 'stomp', sfx: 'edge',
      tag: (fx) => `${fxStatus('steelskin')} +${fx.amount}`,
    },
  },
  viper: {
    // La víbora serpentea en el aire y, de cerca, se tira a morder.
    apply: {
      flight: { path: 'strike', ms: 760, wave: 34 },
      pip: 'viper', clip: 'healBlock', width: 1.8,
      motion: 'whiff', sfx: 'healBlock',
      tag: () => fxIcon('viper'),
    },
    // La cura que no entró.
    block: {
      pip: 'viper', clip: 'healBlock', width: 1.3,
      motion: 'whiff', sfx: 'healBlock', sfxRate: 1.25,
      tag: () => `${fxIcon('viper')} ✕`,
    },
  },
  gloves: {
    // Los guantes infectan a los dos: el veneno se revolea sobre el rival…
    draw: {
      flight: { path: 'jab', ms: 620 },
      pip: 'poison', clip: 'gloves', clipHit: true, width: 1.9,
      motion: 'hurt', react: 'hit', sfx: 'gloves',
      tag: (fx) => `${fxIcon('gloves')} ${fx.amount}`,
    },
    // …y le salpica también al que los robó: la misma mordida, más chica,
    self: {
      pip: 'poison', clip: 'gloves', clipHit: true, width: 1.3,
      motion: 'snarl', sfx: 'debuff',
      tag: (fx) => `${fxIcon('gloves')} ${fx.amount}`,
    },
    // que al terminar el turno lo cura en vez de morderlo.
    cure: {
      pip: 'poison', clip: 'cure', width: 1.5,
      motion: 'cheer', sfx: 'cleanse',
      hp: (fx) => [[fx.on, -fx.amount]],
      hud: { at: 'hp', kind: 'heal', html: (fx) => (fx.amount > 0 ? `${fxIcon('gloves')} +${fx.amount} HP` : '') },
    },
  },
};

// Los amuletos neutrales de la Aventura, cada uno con su recorrido, su efecto (de las
// clases escondidas del kit) y su sonido.
Object.assign(POWER_FX, {
  focus: {
    draw: {
      flight: { path: 'orbit', ms: 820, radius: 60, turns: 1 },
      pip: 'focus', clip: 'focus', width: 1.8,
      motion: 'snarl', sfx: 'focus',
      tag: (fx) => `${fxIcon('focus')} +${fx.amount}`,
    },
  },
  lens: {
    draw: {
      flight: { path: 'peer', ms: 900, lift: 60, from: 'card', to: 'self' },
      clip: 'lens', width: 1.6,
      motion: 'peek', sfx: 'lens',
      tag: (fx) => `${fxIcon('lens')} ${fx.amount}`,
    },
  },
  spell: {
    // Llega parpadeando sobre quien la recibe: el rival si eligió pegar, el propio si no.
    cast: {
      flight: { path: 'blink', ms: 700 },
      clip: 'spell', clipHit: true, width: 2,
      motion: (fx) => (fx.kind === 'hit' ? 'hurt' : 'cheer'), react: (fx) => (fx.kind === 'hit' ? 'hit' : ''), sfx: 'spell',
      hp: (fx) => (fx.kind === 'hit' ? [[fx.on, fx.amount]] : fx.kind === 'heal' ? [[fx.on, -fx.amount]] : []),
      pip: (fx) => (fx.kind === 'shield' ? 'shield' : []),
      tag: (fx) => (fx.kind === 'hit' ? `${fxLabel('spell')}−${fx.amount}` : ''),
      hud: {
        at: (fx) => (fx.kind === 'shield' ? 'shield' : 'hp'),
        kind: (fx) => (fx.kind === 'shield' ? 'shield' : 'heal'),
        html: (fx) => (fx.kind === 'heal' && fx.amount > 0 ? `${fxIcon('spell')} +${fx.amount} HP`
          : fx.kind === 'shield' && fx.amount > 0 ? `${fxShield()} +${fx.amount}` : ''),
      },
    },
  },
  mirror: {
    draw: {
      flight: { path: 'reflect', ms: 700, flips: 2, to: 'self' },
      clip: 'mirror', clipHit: true, width: 1.6,
      motion: 'peek', sfx: 'mirror',
      tag: () => fxIcon('mirror'),
    },
  },
  energy: {
    apply: {
      flight: { path: 'gulp', ms: 820, lift: 70, to: 'self' },
      clip: 'energy', width: 1.8,
      motion: 'snarl', sfx: 'energy',
      tag: (fx) => `${fxIcon('energy')} ×${fx.amount}`,
    },
  },
  papa: {
    apply: {
      flight: { path: 'lumber', ms: 860, height: 70 },
      clip: 'papa', clipHit: true, width: 2,
      motion: (fx) => (fx.kind === 'hit' ? 'hurt' : 'cheer'), react: (fx) => (fx.kind === 'hit' ? 'hit' : ''), sfx: 'papa',
      pip: (fx) => (fx.kind === 'shield' ? 'shield' : []),
      tag: (fx) => (fx.kind === 'hit' ? `${fxLabel('papa')}+${fx.amount}` : ''),
      hud: { at: 'shield', kind: 'shield', html: (fx) => (fx.kind === 'shield' && fx.amount > 0 ? `${fxShield()} +${fx.amount}` : '') },
    },
  },
  mama: {
    // En ronda impar cura; en par, el sangrado lo pone `addBleed` con su `bleed`.
    apply: {
      flight: { path: 'cradle', ms: 900, arc: 70 },
      clip: 'mama', width: 1.9,
      motion: (fx) => (fx.kind === 'heal' ? 'cheer' : 'hurt'), sfx: 'mama',
      pip: (fx) => (fx.kind === 'heal' ? [] : 'razor'),
      hp: (fx) => (fx.kind === 'heal' ? [[fx.on, -fx.amount]] : []),
      tag: (fx) => (fx.kind === 'heal' ? '' : `${fxStatus('bleed')} +${fx.amount}`),
      hud: { at: 'hp', kind: 'heal', html: (fx) => (fx.kind === 'heal' && fx.amount > 0 ? `${fxIcon('mama')} +${fx.amount} HP` : '') },
    },
  },
  blood: {
    apply: {
      flight: { path: 'oath', ms: 860, radius: 70, turns: 1.2, from: 'self' },
      pip: 'razor', clip: 'blood', clipHit: true, width: 1.8,
      motion: 'snarl', sfx: 'blood',
      tag: (fx) => `${fxStatus('bleed')} +${fx.amount}`,
    },
  },
  dispel: {
    apply: {
      flight: { path: 'exorcise', ms: 780, zig: 40 },
      clip: 'dispel', clipHit: true, width: 2,
      motion: 'whiff', react: 'hit', sfx: 'dispel',
      tag: (fx) => (fx.amount > 0 ? `${fxShield()} −${fx.amount}` : fxIcon('dispel')),
    },
  },
  stamp: {
    apply: {
      flight: { path: 'stampdown', ms: 760, height: 120, to: 'self' },
      pip: 'stamp', clip: 'stamp', clipHit: true, width: 1.8,
      motion: 'stomp', sfx: 'stamp', contact: true,
      tag: (fx) => `${fxIcon('stamp')} +${fx.amount}`,
    },
    // Cuando se abre la carta de regalo, el sello baja del Axie al centro.
    pick: {
      flight: { path: 'stampdown', ms: 700, height: 90, from: 'self', to: 'market' },
      marketFx: 'stamp', sfx: 'stamp', sfxRate: 1.2,
    },
  },
  tape: {
    // La cinta se desenrolla sobre la cadena y la pega: el Axie se queda con lo que tenía.
    save: {
      flight: { path: 'unroll', ms: 700, from: 'card0', to: 'self' },
      clip: 'tape', width: 1.9,
      motion: 'cheer', sfx: 'tape',
      tag: () => `${fxIcon('tape')} ${tr('¡Pegada!')}`,
    },
  },
  gift: {
    apply: {
      flight: { path: 'float', ms: 1000, sway: 24, depth: 120, from: 'self' },
      pip: 'gift', clip: 'gift', width: 1.9,
      motion: 'peek', sfx: 'gift',
      tag: (fx) => `${fxIcon('gift')} +${fx.amount}`,
    },
  },
});

/**
 * La receta de un efecto ya armada para `fx`. Los poderes que hacen una cosa u otra según
 * la partida (la Novice Spell según lo que se eligió, los osos según la ronda) dan como
 * función el gesto, el pulso, la marca y el cartel de la chapa: acá se resuelven.
 */
export function specOf(fx) {
  const spec = POWER_FX[fx.power]?.[fx.moment];
  if (!spec) return spec;
  const pick = (v) => (typeof v === 'function' ? v(fx) : v);
  const out = { ...spec };
  for (const key of ['motion', 'react', 'pip']) if (typeof spec[key] === 'function') out[key] = pick(spec[key]);
  if (spec.hud) out.hud = { ...spec.hud, at: pick(spec.hud.at), kind: pick(spec.hud.kind) };
  return out;
}

/** Los efectos del kit que puede pedir cada poder en la partida, para bajarlos antes. */
const POWER_CLIPS = {
  strength: ['strength', 'bleed'],
  brutal: ['debuff', 'bleed', 'wound'],
  razor: ['razor', 'bleed'],
  dagger: ['dagger', 'bleed'],
  rage: ['rage', 'fury'],
  octopus: ['octopus'],
  bubble: ['bubble'],
  maker: ['maker', 'bubbleBomb'],
  jellyfish: ['jellyfish', 'stun'],
  redbubble: ['silence'],
  egg: ['eggBreak'],
  feather: ['feather'],
  shuriken: ['shuriken'],
  fan: ['fan'],
  hammer: ['hammer'],
  pot: ['pot'],
  leaf: ['leaf'],
  guard: ['cleanser'],
  sage: ['cleanse'],
  pillow: ['sleep', 'pillow'],
  snail: ['snail'],
  leech: ['leech'],
  cocoon: ['cocoon', 'eggShield'],
  scanner: ['scanner'],
  trickster: ['hex', 'doubt'],
  poison: ['poison'],
  steelskin: ['steelskin', 'eggThorns'],
  edge: ['edge', 'eggThorns'],
  viper: ['healBlock'],
  gloves: ['gloves', 'cure'],
  focus: ['focus'],
  lens: ['lens'],
  spell: ['spell'],
  mirror: ['mirror'],
  energy: ['energy'],
  papa: ['papa'],
  mama: ['mama', 'bleed'],
  blood: ['blood'],
  dispel: ['dispel'],
  stamp: ['stamp'],
  tape: ['tape'],
  gift: ['gift'],
};

/** Precarga los efectos de los poderes en juego: el primero no tiene que llegar tarde. */
export function preloadPowers(powers = []) {
  for (const power of powers) for (const key of POWER_CLIPS[power] ?? []) preloadVfx(key, { later: true });
}

/**
 * Los efectos de los poderes que ya están en la mesa, ya: la fila de `preloadPowers` va
 * de a uno y con la página libre, y el de una carta que acaba de salir puede estar
 * último. Bajado recién al llegar el amuleto, el efecto caía cuando ya había pasado todo.
 */
export function warmPowers(powers = []) {
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
  // Las plumas del abanico: sube abanicándose de un lado al otro y planea hasta el Axie.
  fan(t, a, b, f) {
    const k = fxSmooth(t);
    return {
      x: fxLerp(a.x, b.x, k),
      y: fxLerp(a.y, b.y, k) - f.spread * Math.sin(k * Math.PI),
      rotate: 40 * Math.sin(t * Math.PI * 4) * (1 - t),
      scale: 1 + 0.2 * Math.sin(t * Math.PI),
    };
  },
  // La salvia: el sahumerio baja despacio sobre el Axie, ondeando como humo.
  smudge(t, a, b, f) {
    const k = fxSmooth(t);
    return {
      x: b.x + 18 * Math.sin(t * Math.PI * 3) * (1 - t * 0.5),
      y: b.y - f.height * (1 - k),
      rotate: -12 + 24 * t,
      scale: 0.7 + 0.5 * k,
    };
  },
  // El filo: sube dando vueltas hasta quedar de punta arriba del Axie y cae a clavarse
  // en el piso, a sus pies.
  plunge(t, a, b, f, box) {
    if (t < 0.4) {
      const u = fxSmooth(t / 0.4);
      return { x: fxLerp(a.x, b.x, u), y: fxLerp(a.y, b.y - f.height, u), rotate: 495 * u, scale: 1.1 };
    }
    const v = ((t - 0.4) / 0.6) ** 2.4;
    return {
      x: b.x,
      y: fxLerp(b.y - f.height, b.y + box.height * 0.3, v),
      rotate: 135,
      scale: 1.1,
      sy: v > 0.95 ? 0.8 : 1,
    };
  },
  // Los guantes: se echan para atrás cargando el puño y salen de una piña derecha.
  jab(t, a, b) {
    if (t < 0.28) {
      const u = fxSmooth(t / 0.28);
      return { x: a.x, y: a.y - 12 * u, rotate: -22 * u, scale: 1 - 0.22 * u };
    }
    const v = ((t - 0.28) / 0.72) ** 2;
    return { x: fxLerp(a.x, b.x, v), y: fxLerp(a.y - 12, b.y, v), rotate: -22 + 22 * v, scale: 0.78 + 0.9 * v };
  },
  // El shuriken: rasante, casi derecho, girando a toda velocidad.
  zip(t, a, b, f) {
    const k = t ** 1.4;
    return {
      x: fxLerp(a.x, b.x, k),
      y: fxLerp(a.y, b.y, k) - f.curve * Math.sin(k * Math.PI),
      rotate: f.spin * t,
      scale: 1,
    };
  },
  // El martillo: sube hasta arriba del rival echándose para atrás y baja de un mazazo.
  slam(t, a, b, f) {
    if (t < 0.55) {
      const u = fxSmooth(t / 0.55);
      return {
        x: fxLerp(a.x, b.x, u),
        y: fxLerp(a.y, b.y - f.height, u) - 30 * Math.sin(u * Math.PI),
        rotate: -60 * u,
        scale: 1 + 0.3 * u,
      };
    }
    const v = ((t - 0.55) / 0.45) ** 3;
    return { x: b.x, y: fxLerp(b.y - f.height, b.y, v), rotate: -60 + 150 * v, scale: 1.3 };
  },
  // El naipe del tramposo: en zigzag, dándose vuelta como en un truco de manos.
  flip(t, a, b, f) {
    const k = fxSmooth(t);
    return {
      x: fxLerp(a.x, b.x, k) + f.zig * Math.sin(t * Math.PI * 3) * (1 - t),
      y: fxLerp(a.y, b.y, k) - f.arc * 4 * k * (1 - k),
      rotate: 15 * Math.sin(t * Math.PI * 2),
      scale: 1.1,
      sx: Math.cos(t * Math.PI * f.flips * 2),
    };
  },
  // La víbora: serpentea de costado mientras se acerca y al final se tira derecho.
  strike(t, a, b, f) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const k = t < 0.7 ? fxSmooth(t / 0.7) * 0.7 : 0.7 + 0.3 * ((t - 0.7) / 0.3) ** 2;
    const wave = t < 0.7 ? f.wave * Math.sin((t / 0.7) * Math.PI * 3) * (1 - t / 0.7) : 0;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    return {
      x: fxLerp(a.x, b.x, k) - (dy / len) * wave,
      y: fxLerp(a.y, b.y, k) + (dx / len) * wave,
      rotate: t < 0.7 ? 25 * Math.cos((t / 0.7) * Math.PI * 3) : angle * 0.3,
      scale: t < 0.7 ? 1 : 1 + 0.4 * ((t - 0.7) / 0.3),
    };
  },
  // La medusa: nada a pulsos, contrayéndose como una campana en cada empujón.
  drift(t, a, b, f) {
    const n = f.pulses;
    const k = t - Math.sin(t * Math.PI * 2 * n) / (Math.PI * 2 * n);
    const p = Math.sin(t * Math.PI * 2 * n);
    return {
      x: fxLerp(a.x, b.x, k),
      y: fxLerp(a.y, b.y, k) - f.arc * Math.sin(k * Math.PI),
      rotate: 0,
      scale: 1,
      sx: 1 + 0.15 * p,
      sy: 1 - 0.18 * p,
    };
  },
  // La guardia dormida: flota de a cabezazos, bamboleándose como quien se duerme.
  doze(t, a, b, f) {
    const k = fxSmooth(t);
    return {
      x: fxLerp(a.x, b.x, k),
      y: fxLerp(a.y, b.y, k) - f.arc * Math.sin(k * Math.PI) + 10 * Math.sin(t * Math.PI * 5) * (1 - t),
      rotate: 18 * Math.sin(t * Math.PI * 2.5) * (1 - t),
      scale: 1,
    };
  },
  // El escáner: barre de lado a lado, cada vez más angosto, hasta dar con el blanco.
  sweep(t, a, b, f) {
    const k = fxSmooth(t);
    const beat = Math.sin(t * Math.PI * 5);
    return {
      x: fxLerp(a.x, b.x, k) + f.width * beat * (1 - t),
      y: fxLerp(a.y, b.y, k),
      rotate: 0,
      scale: 1 + 0.15 * Math.abs(beat) * (1 - t),
    };
  },
  // La máscara de la furia: avanza temblando, cada vez más grande.
  quake(t, a, b) {
    const k = t ** 2;
    const j = 8 * (1 - t * 0.5);
    return {
      x: fxLerp(a.x, b.x, k) + j * Math.sin(t * 90),
      y: fxLerp(a.y, b.y, k) + j * Math.cos(t * 77),
      rotate: 10 * Math.sin(t * 60),
      scale: 0.9 + 0.6 * k,
    };
  },
  // La navaja: un tajo en curva, rápido, que entra de costado.
  slice(t, a, b, f) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const k = t ** 1.6;
    const bulge = f.bend * Math.sin(k * Math.PI);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    return {
      x: fxLerp(a.x, b.x, k) - (dy / len) * bulge,
      y: fxLerp(a.y, b.y, k) + (dx / len) * bulge,
      rotate: angle + 45 + 70 * (0.5 - k),
      scale: 1.1,
    };
  },
  // El capullo: baja colgado de su hilo sobre el Axie y se hamaca hasta quedarse quieto.
  dangle(t, a, b, f) {
    const drop = 1 - (1 - Math.min(t / 0.5, 1)) ** 3;
    const swing = f.swing * Math.sin(t * Math.PI * 4) * (1 - t);
    return { x: b.x + swing, y: b.y - f.height * (1 - drop), rotate: -swing * 0.6, scale: 1 };
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
  // Charm of Focus: da una vuelta entera alrededor del Axie, apuntando, y se le mete.
  orbit(t, a, b, f) {
    const k = fxSmooth(t);
    const r = f.radius * (1 - k);
    const ang = k * Math.PI * 2 * f.turns;
    return {
      x: fxLerp(a.x, b.x, k) + r * Math.cos(ang),
      y: fxLerp(a.y, b.y, k) + r * Math.sin(ang) * 0.5,
      rotate: (ang * 180) / Math.PI,
      scale: 1 + 0.25 * (1 - k),
    };
  },
  // La lente: sube a la altura de los ojos y se acerca y se aleja, como quien mira.
  peer(t, a, b, f) {
    const k = fxSmooth(Math.min(t / 0.6, 1));
    const look = t < 0.6 ? 0 : Math.sin(((t - 0.6) / 0.4) * Math.PI * 2);
    return {
      x: fxLerp(a.x, b.x, k),
      y: fxLerp(a.y, b.y - f.lift, k),
      rotate: -12 * look,
      scale: 1 + 0.35 * Math.abs(look),
    };
  },
  // La Novice Spell: desaparece a mitad de camino y reaparece encima, de un parpadeo.
  blink(t, a, b) {
    const k = fxSmooth(t);
    const flicker = Math.abs(Math.cos(t * Math.PI));
    return { x: fxLerp(a.x, b.x, k), y: fxLerp(a.y, b.y, k) - 30 * Math.sin(k * Math.PI), rotate: 0, scale: 0.2 + 0.9 * flicker };
  },
  // El espejo: viaja derecho dándose vuelta, como si reflejara lo que tiene enfrente.
  reflect(t, a, b, f) {
    const k = fxSmooth(t);
    return { x: fxLerp(a.x, b.x, k), y: fxLerp(a.y, b.y, k) - 20 * Math.sin(k * Math.PI), rotate: 0, scale: 1.1, sx: Math.cos(k * Math.PI * 2 * f.flips) };
  },
  // La bebida: sube, se inclina sobre el Axie para volcarse y tiembla al quebrarse.
  gulp(t, a, b, f) {
    const k = fxSmooth(Math.min(t / 0.7, 1));
    const shake = t < 0.7 ? 0 : Math.sin(((t - 0.7) / 0.3) * Math.PI * 8) * 6;
    return { x: fxLerp(a.x, b.x, k) + shake, y: fxLerp(a.y, b.y - f.lift, k), rotate: 120 * k, scale: 1.1 };
  },
  // Papa Bear: dos pisotones pesados, uno más alto que el otro.
  lumber(t, a, b, f) {
    const step = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
    const h = t < 0.5 ? f.height : f.height * 0.6;
    return {
      x: fxLerp(a.x, b.x, t),
      y: fxLerp(a.y, b.y, t) - h * 4 * step * (1 - step),
      rotate: 10 * Math.sin(t * Math.PI * 2),
      scale: 1.1, sy: step > 0.92 ? 0.82 : 1,
    };
  },
  // Mama Bear: llega meciéndose, como quien acuna.
  cradle(t, a, b, f) {
    const k = fxSmooth(t);
    return {
      x: fxLerp(a.x, b.x, k),
      y: fxLerp(a.y, b.y, k) - f.arc * Math.sin(k * Math.PI),
      rotate: 22 * Math.sin(t * Math.PI * 3) * (1 - k),
      scale: 1 + 0.2 * Math.sin(k * Math.PI),
    };
  },
  // Bloodpact: el pacto se cierra en espiral hacia adentro, sobre el que lo firma.
  oath(t, a, b, f) {
    const k = fxSmooth(t);
    const r = f.radius * (1 - k);
    const ang = -k * Math.PI * 2 * f.turns;
    return { x: b.x + r * Math.cos(ang), y: b.y + r * Math.sin(ang) * 0.6, rotate: -k * 360, scale: 0.8 + 0.5 * k };
  },
  // La Black Sage: barre de un lado al otro, rápido, y termina girando sobre el rival.
  exorcise(t, a, b, f) {
    const k = fxSmooth(t);
    return {
      x: fxLerp(a.x, b.x, k) + f.zig * Math.sin(t * Math.PI * 5) * (1 - k),
      y: fxLerp(a.y, b.y, k) - 40 * Math.sin(k * Math.PI),
      rotate: t > 0.7 ? ((t - 0.7) / 0.3) * 540 : 0,
      scale: 1.1,
    };
  },
  // La Earth Stamp: sube por arriba del Axie y baja de un sellazo, aplastándose.
  stampdown(t, a, b, f) {
    if (t < 0.6) {
      const u = fxSmooth(t / 0.6);
      return { x: fxLerp(a.x, b.x, u), y: fxLerp(a.y, b.y - f.height, u), rotate: -15 * u, scale: 1.2 };
    }
    const v = (t - 0.6) / 0.4;
    return { x: b.x, y: b.y - f.height * (1 - v * v), rotate: -15 * (1 - v), scale: 1.2, sy: v > 0.88 ? 0.7 : 1, sx: v > 0.88 ? 1.25 : 1 };
  },
  // La Scotch Tape: se desenrolla a lo ancho sobre la cadena y la pega.
  unroll(t, a, b) {
    const k = fxSmooth(t);
    return { x: fxLerp(a.x, b.x, k), y: fxLerp(a.y, b.y, k), rotate: 0, scale: 1, sx: 0.2 + 1.3 * k, sy: 1 - 0.3 * k };
  },
  // Last Gift: sube despacio desde abajo, como un farolito que se suelta.
  float(t, a, b, f) {
    const k = 1 - (1 - t) ** 2;
    return {
      x: b.x + f.sway * Math.sin(t * Math.PI * 2),
      y: b.y + f.depth * (1 - k),
      rotate: 8 * Math.sin(t * Math.PI * 3),
      scale: 0.6 + 0.5 * k,
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
    if (where === 'egg') return field?.querySelector?.(`.strip > .card[data-col="${fx.col}"]`) ?? art(fx.on);
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
    const spec = specOf(fx);
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
    const spec = specOf(fx);
    if (!spec) return;
    const { land, back } = arrivalOf(spec);
    const flight = spec.flight;
    const cards = ['apply', 'draw', 'stand'].includes(fx.moment) ? cardsWith(fx.card ?? fx.power) : [];
    cards.forEach((card) => lightCard(card, fx.power));
    const target = flight ? spot(flight.to ?? 'on', fx, by, cards) : spec.at ? spot(spec.at, fx, by, cards) : art(fx.on);
    if (spec.at && target?.classList?.contains('card')) {
      lightCard(target, fx.power);
      if (spec.crack) pulse(target, 'crack', 'true', 900);
    }

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
      if (spec.clip) {
        const skip = spec.clipHit ? Math.max((CLIPS[spec.clip]?.hitAt ?? 0) - HIT_LEAD, 0) : 0;
        vfx.play(spec.clip, target, { from: sideOf(by), width: spec.width, skip });
      }
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
