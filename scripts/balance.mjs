// Banco de pruebas del balance de los poderes.
//
//   npm run balance                 # 300 partidas por celda
//   npm run balance -- --games 800  # más partidas, menos ruido
//   npm run balance -- --arms base,venenoMax
//
// Qué mide y por qué así:
//
// Un poder "vale" lo que le suma a tus chances de ganar. Para aislarlo, el jugador
// queda atado a un solo poder —si hay una carta de ese poder en el centro la agarra,
// y si no se lleva las dos sin poder— y enfrenta siempre a la misma CPU, que elige
// con su criterio normal. El control es un jugador que nunca agarra poderes. La
// diferencia contra el control es lo que ese poder vale en partidas.
//
// Las partidas van **sembradas**, y todas las celdas usan las mismas semillas. Eso es
// lo que hace comparables dos variantes: la diferencia entre ellas se mide de a pares
// sobre repartos idénticos, así el ruido del sorteo se cancela en vez de sumarse. Sin
// esto hacen falta miles de partidas por celda para distinguir un efecto real de la
// suerte — y es exactamente el error que se cometió antes de que este script existiera.
import { createGame, TUNING, hpOf } from '../src/game.js';
import { decideDraw, pickBest } from '../src/ai.js';
import { POWER_IDS } from '../src/data.js';

const AXIES = ['aquatic', 'beast', 'bird', 'plant', 'bug', 'reptile'];
const idle = () => new Promise((r) => setTimeout(r, 0));

/**
 * Las variantes a comparar. Cada una es un parche sobre `TUNING`; `base` es el juego
 * tal como está. Agregar una variante es agregar una línea acá.
 */
const ARMS = {
  base: {},
  // El valor viejo de la fuerza, antes de medirla. Queda como variante para que el
  // cambio se pueda volver a comprobar en vez de tener que creerle a este comentario.
  fuerza2: { strengthStep: 2 },
  // Medida y descartada: el tope hace lo que dice —muerde una de cada cinco veces que
  // se aplica veneno— pero no mueve las partidas (-1.1 ±1.2 sobre 400). Queda acá
  // porque una variante que se midió y no sirvió también es un resultado.
  venenoMax: { poisonStacks: false },
  // La escala de POWER_WORTH: cuán seguido la CPU cambia dos cartas sin poder por
  // una con poder. Acá el que se mide es el rival, no el juego — con el jugador
  // atado a una estrategia fija, la escala que le gana más partidas es la mejor, o
  // sea la que **baja** la columna "gana".
  sesgo07: { powerBias: 0.7 },
  sesgo15: { powerBias: 1.5 },
  sesgo20: { powerBias: 2 },
};

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : fallback;
};
const GAMES = Number(flag('games', 300));
const armNames = flag('arms', Object.keys(ARMS).join(',')).split(',');
// Solo los poderes que interesan por defecto: los dos que se escapan y uno del
// pelotón como referencia. `--powers all` corre los seis.
const powers = flag('powers', 'strength,poison,snail');
const POWERS = powers === 'all' ? POWER_IDS : powers.split(',');

/** El humano se lleva las dos cartas sin poder que mejor se enlazan con su mazo. */
const bestPlain = (game, s) => {
  const plain = game.pickable().filter((c) => !c.power);
  return plain.length ? pickBest(plain, s.decks.human) : null;
};

/**
 * Una partida. `only` ata al jugador a ese poder; `null` es el control, que nunca
 * agarra ninguno. Devuelve 1 si gana, 0 si pierde, 0.5 si es doble KO.
 */
async function playOne(seed, only) {
  const game = createGame({ pace: 0, seed });
  game.newMatch({ difficulty: 'normal', axie: AXIES[seed % 6] });

  let guard = 0;
  while (game.state.phase !== 'matchEnd') {
    if (guard++ > 6000) throw new Error(`la partida ${seed} no termina`);
    const s = game.state;

    if (s.phase === 'draft') {
      if (game.drafting() !== 'human') { await idle(); continue; }
      const mine = only && game.pickable().find((c) => c.power === only);
      if (mine) { await game.takeCard(mine.uid); continue; }
      const plain = bestPlain(game, s);
      if (plain) await game.takeCard(plain.uid);
      else await game.skipDraft();
      continue;
    }
    if (s.phase === 'roundEnd') { await game.nextRound(); continue; }
    if (s.turn === 'human' && !s.busy) {
      // Mismo criterio que la CPU, incluido el golpe final: sin vida, plantarse por
      // debajo pierde igual. Si el jugador simulado juega peor que la CPU, la brecha
      // que se mide es la de las cabezas y no la de los poderes.
      const needs = (s.roundScores.cpu !== null && hpOf(s, 'human') <= 0)
        ? s.totals.cpu - s.totals.human + 1
        : null;
      if (decideDraw(s.chains.human, game.unseenPool('human'), { needs, difficulty: 'normal' })) {
        await game.hit();
      } else {
        await game.stand();
      }
      continue;
    }
    await idle();
  }

  const s = game.state;
  const down = { human: hpOf(s, 'human') <= 0, cpu: hpOf(s, 'cpu') <= 0 };
  if (down.human && down.cpu) return 0.5;
  return down.cpu ? 1 : 0;
}

/** Una celda: un poder bajo una variante, sobre todas las semillas. */
async function cell(only, tuning, seeds) {
  const saved = { ...TUNING };
  Object.assign(TUNING, tuning);
  try {
    const out = [];
    for (const seed of seeds) out.push(await playOne(seed, only));
    return out;
  } finally {
    Object.assign(TUNING, saved);
  }
}

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
/** Error estándar de la media de una muestra de 0/1 (y algún 0.5). */
function stderr(xs) {
  const m = mean(xs);
  const v = xs.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(xs.length - 1, 1);
  return Math.sqrt(v / xs.length);
}
/**
 * Error de la diferencia **pareada**: se mide seed por seed y se promedia. Es la
 * razón de sembrar — comparar dos medias sueltas tiene mucho más ruido que comparar
 * la diferencia sobre los mismos repartos.
 */
function pairedDiff(a, b) {
  const d = a.map((x, i) => x - b[i]);
  return { diff: mean(d), err: stderr(d) };
}

const pct = (x) => `${(100 * x).toFixed(1)}%`;
const signed = (x) => `${x >= 0 ? '+' : ''}${(100 * x).toFixed(1)}`;

const seeds = Array.from({ length: GAMES }, (_, i) => i + 1);
console.log(`${GAMES} partidas sembradas por celda · variantes: ${armNames.join(', ')}`);
console.log(`poderes: ${POWERS.join(', ')}\n`);

const results = {};
for (const arm of armNames) {
  const tuning = ARMS[arm];
  if (!tuning) throw new Error(`no existe la variante "${arm}"`);
  const control = await cell(null, tuning, seeds);
  const rows = [];
  for (const power of POWERS) {
    const got = await cell(power, tuning, seeds);
    const { diff, err } = pairedDiff(got, control);
    rows.push({ power, win: mean(got), diff, err, got });
  }
  results[arm] = { control, rows };

  console.log(`── ${arm} ${'─'.repeat(Math.max(46 - arm.length, 0))}`);
  console.log(`   control (nunca agarra poderes)  ${pct(mean(control))}`);
  // Los escalones, que es lo único que se puede leer del orden.
  //
  // La columna "vs control" no sirve para comparar dos poderes entre sí: su ± es el
  // error de cada estimación contra el control, no el de la diferencia entre las dos.
  // Dos poderes pueden estar los dos clarísimo arriba del control y ser
  // indistinguibles entre ellos; ordenarlos ahí es leerle una cifra al ruido.
  //
  // Así que cada poder se compara pareado contra el **líder de su escalón**, no
  // contra el de al lado. Contra el de al lado no alcanza: una cadena de pasos
  // chicos, ninguno medible por separado, puede sumar entre las puntas una diferencia
  // que sí lo es, y la tabla los mostraría todos empatados. Cuando uno cae por debajo
  // del líder con el margen afuera, abre un escalón nuevo y pasa a ser el líder.
  rows.sort((x, y) => y.diff - x.diff);
  let tier = 1;
  let lead = rows[0];
  for (const r of rows) {
    if (r !== lead) {
      const { diff, err } = pairedDiff(lead.got, r.got);
      if (diff > 2 * err) { tier++; lead = r; }
    }
    console.log(`   ${String(tier).padStart(2)}. ${r.power.padEnd(9)} ${pct(r.win).padStart(6)}   ` +
      `${signed(r.diff).padStart(6)} ±${(200 * r.err).toFixed(1)} vs control`);
  }
  console.log('');
}

// Y la comparación que importa: qué le hizo cada variante a cada poder.
//
// Acá el pareado rinde de verdad. Contra el control son dos estrategias distintas y
// las partidas divergen a la primera decisión, así que compartir la semilla solo
// comparte el reparto inicial. Entre variantes es la **misma** estrategia sobre las
// **mismas** semillas, cambiando una constante: las partidas arrancan idénticas y se
// separan recién donde el cambio pesa. Ahí la diferencia se mide con mucho menos ruido
// que restando dos promedios sueltos.
if (armNames.length > 1 && armNames.includes('base')) {
  console.log('── contra base, pareado partida a partida ────────');
  for (const arm of armNames.filter((a) => a !== 'base')) {
    console.log(`   ${arm}:`);
    for (const power of POWERS) {
      const a = results[arm].rows.find((r) => r.power === power);
      const b = results.base.rows.find((r) => r.power === power);
      const { diff, err } = pairedDiff(a.got, b.got);
      const solid = Math.abs(diff) > 2 * err ? '' : '  (dentro del ruido)';
      console.log(`     ${power.padEnd(9)} ${signed(diff).padStart(6)} ±${(200 * err).toFixed(1)}${solid}`);
    }
  }
}
