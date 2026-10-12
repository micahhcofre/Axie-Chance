// Banco de pruebas del balance de los poderes.
//
//   npm run balance                 # 300 partidas por celda
//   npm run balance -- --games 800  # más partidas, menos ruido
//   npm run balance -- --arms base,venenoMax
//   npm run balance -- --cpu duro              # los poderes contra otra CPU
//   npm run balance -- --difficulties          # cuánto gana cada dificultad
//   npm run balance -- --worth freegame=1.2,2,3  # el peso de un poder para la CPU
//   npm run balance -- --adventure             # cuánto gana el rival de cada nivel de la Aventura
//   npm run balance -- --adventure --levels 6,12  # solo esos niveles
//   npm run balance -- --adventure --bare      # con un Axie pelado, sin el jugador esperado
//   npm run balance -- --adventure --rival-hp 180 --rival-cpu duro  # para probar palancas
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
import { createGame, TUNING, hpOf, lastChance, overkillOf, eggsLeft, trickTargetsFor } from '../src/game.js';
import { decideDraw, pickBest, pickBonus, planDraft, POWER_WORTH } from '../src/ai.js';
import { POWER_IDS, POWERS as POWER_DEFS, chooseActivePowers, makeRng, CLASS_POWER_IDS } from '../src/data.js';
import { ADVENTURE_LEVELS, rivalExtras } from '../src/adventure.js';
import { STARTER_PACK } from '../src/backpack.js';

const AXIES = ['aquatic', 'beast', 'bird', 'plant', 'bug', 'reptile'];

/**
 * El jugador esperado de la Aventura: lo que tiene alguien que llegó a esa altura del
 * mapa (supuestos en docs/aventura.md §5), con un Axie principal. El rival de cada nivel
 * se mide contra él, y la regla de la escalera (`RIVAL_LADDER`) es que el rival nunca
 * traiga más. Cada escalón dice desde qué nivel rige y lo que cambia:
 *
 *   1–10   el Axie pelado: el que recién empieza no sabe todavía de la mochila.
 *   11     el paquete de bienvenida en la mochila: las que llevan su color.
 *   31     su primera evolución (su nivel 10 de Axie); 66, la segunda; 116, la tercera;
 *          166, la cuarta.
 *   61     cartas del Taller y de fusionar, de su color: raras y poco comunes; desde el 81
 *          la épica que asegura el Taller cada 50, y de a poco más; una legendaria al 181.
 */
const EXPECTED = [
  { from: 1, pack: false, tiers: null, evolved: [] },
  { from: 11, pack: true },
  { from: 31, evolved: ['horn'] },
  { from: 61, pack: false, tiers: ['rare', 'rare', 'uncommon', 'uncommon'] },
  { from: 66, evolved: ['horn', 'back'] },
  { from: 81, tiers: ['epic', 'rare', 'rare', 'uncommon'] },
  { from: 101, tiers: ['epic', 'rare', 'rare', 'rare'] },
  { from: 116, evolved: ['horn', 'back', 'tail'] },
  { from: 131, tiers: ['epic', 'epic', 'rare', 'rare'] },
  { from: 161, tiers: ['epic', 'epic', 'epic', 'rare'] },
  { from: 166, evolved: ['horn', 'back', 'tail', 'mouth'] },
  { from: 181, tiers: ['legendary', 'epic', 'epic', 'rare'] },
].reduce((out, step) => [...out, { ...out.at(-1), ...step }], []);
function expectedPlayer(level, axieId) {
  const { pack, tiers, evolved } = EXPECTED.findLast((e) => e.from <= level);
  const cls = axieId;
  // Del paquete, las que llevan su color (dos o tres, según la clase): una carta sin su
  // color en el mazo es una carta que corta, y el que entiende la mochila no se la pone.
  // Medido: con las cuatro "mejores" aunque una no tuviera su color, el jugador perdía más
  // que pelado.
  const extras = pack ? STARTER_PACK.filter((c) => c.symbols.includes(cls))
    : tiers ? rivalExtras(tiers, { id: level * 7 + AXIES.indexOf(axieId), cls, unlocked: CLASS_POWER_IDS }) : [];
  return { extras, evolved };
}

const idle = () => new Promise((r) => setTimeout(r, 0));

/**
 * Las variantes a comparar. Cada una es un parche sobre `TUNING`; `base` es el juego
 * tal como está. Agregar una variante es agregar una línea acá.
 */
const ARMS = {
  base: {},
  // El pulpo con y sin poderes en su carta extra, y cobrando una sola por reparto.
  pulpoPlano: { octopusPowers: false },
  pulpoUno: { octopusStacks: false },
  pulpoSiempre: { octopusOnStand: false },
  // La escala de POWER_WORTH: cuán seguido la CPU cambia dos cartas sin poder por
  // una con poder. Acá el que se mide es el rival, no el juego — con el jugador
  // atado a una estrategia fija, la escala que le gana más partidas es la mejor, o
  // sea la que **baja** la columna "gana".
  sesgo07: { powerBias: 0.7 },
  sesgo15: { powerBias: 1.5 },
  sesgo20: { powerBias: 2 },
  // La última chance: sin overkill (siempre se levanta), y con el tope más bajo o más
  // alto. `overkill0` es "cualquier golpe de más la borra".
  sinOverkill: { overkill: Infinity },
  overkill0: { overkill: 0 },
  overkill15: { overkill: 15 },
  overkill50: { overkill: 50 },
  // Los topes de lo que queda puesto, que son los números que más mueven las copias.
  escudo15: { shieldMax: 15 },
  escudo30: { shieldMax: 30 },
  veneno10: { poisonMax: 10 },
  veneno20: { poisonMax: 20 },
  // Lo que cuesta cada carta que roba el que sangra.
  sangrado1: { bleedDamage: 1 },
  sangrado3: { bleedDamage: 3 },
  // Los valores de los poderes que más dudas dejan.
  navaja5: { razorBleed: 5 },
  bomba24: { bombDamage: 24 },
  espinas10: { spikes: 10 },
};

const args = process.argv.slice(2);
const BARE = args.includes('--bare');
// Para probar palancas de la Aventura sin tocar la campaña: la vida del rival y su CPU.
const RIVAL_HP = Number(args[args.indexOf('--rival-hp') + 1]) || null;
const RIVAL_CPU = args.includes('--rival-cpu') ? args[args.indexOf('--rival-cpu') + 1] : null;
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : fallback;
};
const GAMES = Number(flag('games', 300));
const armNames = flag('arms', Object.keys(ARMS).join(',')).split(',');
// Solo los poderes que interesan por defecto: los dos que se escapan y uno del
// pelotón como referencia. `--powers all` corre los seis.
const powers = flag('powers', 'strength,poison,snail');
const CPU = flag('cpu', 'normal');
const POWERS = powers === 'all' ? POWER_IDS : powers.split(',');

/** El humano se lleva las dos cartas sin poder que mejor se enlazan con su mazo. */
const bestPlain = (game, s) => {
  const plain = game.pickable().filter((c) => !c.power);
  return plain.length ? pickBest(plain, s.decks.p1) : null;
};

/** El jugador que no se ata a nada y elige del centro con el criterio de la CPU. */
const FREE = Symbol('libre');
// Sus pesos quedan fijos en los de la CPU al arrancar: `--worth` mueve los de la CPU y
// el jugador de enfrente tiene que ser siempre el mismo.
const FREE_WORTH = { ...POWER_WORTH };

/**
 * Una partida. `only` ata al jugador a ese poder; `null` es el control, que nunca
 * agarra ninguno; `FREE` elige como la CPU "normal". Devuelve 1 si gana, 0 si pierde, 0.5 si es doble KO.
 */
async function playOne(seed, only, cpu = CPU, level = null) {
  const game = createGame({ pace: 0, seed });
  const seen = { p1: false, p2: false };
  let killer = null;
  game.subscribe((st) => {
    const lc = lastChance(st);
    if (lc) seen[lc] = true;
  });
  // El poder que se mide está siempre en la reserva: con uno sorteado entre cuatro o
  // seis por clase, la mayoría de las partidas del brazo serían partidas del control.
  // Los de las otras clases salen del mismo sorteo sembrado para todas las celdas.
  const drawn = chooseActivePowers(makeRng(seed ^ 0x9e3779b9));
  const activePowers = typeof only === 'string' && POWER_DEFS[only]?.symbol
    ? drawn.map((id) => (POWER_DEFS[id].symbol === POWER_DEFS[only].symbol ? only : id))
    : drawn;
  if (level) {
    const axie = AXIES[seed % 6];
    game.newMatch({ mode: 'adventure', adventureLevel: level, axie, ...(BARE ? {} : expectedPlayer(level, axie)), ...(RIVAL_CPU ? { difficulty: RIVAL_CPU } : {}) });
    if (RIVAL_HP) game.state.maxHp.p2 = RIVAL_HP;
  }
  else game.newMatch({ difficulty: cpu, axie: AXIES[seed % 6], activePowers });

  let guard = 0;
  while (game.state.phase !== 'matchEnd') {
    if (guard++ > 6000) throw new Error(`la partida ${seed} no termina`);
    const s = game.state;

    if (s.phase === 'draft') {
      if (game.drafting() !== 'p1') { await idle(); continue; }

      // El Trickster se cobra antes del centro: roba la de más peso, como la CPU.
      if (s.draft.step === 'trick') {
        const targets = trickTargetsFor(s, 'p1');
        const best = targets.reduce((a, c) => ((POWER_WORTH[c.power] ?? 1) > (POWER_WORTH[a.power] ?? 1) ? c : a), targets[0]);
        if (best) await game.stealCard(best.uid);
        else await game.skipDraft();
        continue;
      }

      // La carta que paga el pulpo se elige a criterio, no atada al poder del brazo.
      // Atarla arruinaba justo al pulpo: su efecto **es** conseguir otras cartas, así
      // que obligarlo a traerse otro pulpo le saca casi todo el valor y lo medía
      // contra una versión de sí mismo que nadie jugaría. Los otros cinco brazos
      // nunca llegan acá —sin pulpos no hay etapa extra—, así que el cambio no los
      // toca.
      if (s.draft.step === 'bonus') {
        const card = pickBonus(game.pickable(), s.decks.p1);
        if (card) await game.takeCard(card.uid);
        else await game.skipDraft();
        continue;
      }

      // Sin atarse a nada: elige del centro como la CPU "normal" (ver `--difficulties`).
      if (only === FREE) {
        const options = game.pickable();
        const kind = s.draft.mode === 'plain' || s.chains.p1.busted ? 'bust' : 'stand';
        const [card] = planDraft(options, s.decks.p1, { kind, weights: FREE_WORTH }).cards;
        if (card) await game.takeCard(card.uid);
        else await game.skipDraft();
        continue;
      }
      const mine = only && game.pickable().find((c) => c.power === only);
      if (mine) { await game.takeCard(mine.uid); continue; }
      const plain = bestPlain(game, s);
      if (plain) await game.takeCard(plain.uid);
      else await game.skipDraft();
      continue;
    }
    if (s.phase === 'roundEnd') { await game.nextRound(); continue; }
    if (s.turn === 'p1' && !s.busy) {
      // Mismo criterio que la CPU, incluido el golpe final: sin vida, plantarse por
      // debajo pierde igual. Si el jugador simulado juega peor que la CPU, la brecha
      // que se mide es la de las cabezas y no la de los poderes.
      // Lo que necesita es la vida que le queda al otro, huevo incluido, menos su fuerza.
      const needs = lastChance(s) === 'p1'
        ? hpOf(s, 'p2') + s.status.p2.egg - s.status.p1.feathers * TUNING.fanStep
        : null;
      if (decideDraw(s.chains.p1, game.unseenPool('p1'), { needs, difficulty: 'normal', saves: eggsLeft(s, 'p1') })) {
        await game.hit();
      } else {
        await game.stand();
      }
      continue;
    }
    await idle();
  }

  const s = game.state;
  const down = { p1: hpOf(s, 'p1') <= 0, p2: hpOf(s, 'p2') <= 0 };
  const e = endings;
  e.games++;
  e.rounds += s.round;
  if (seen.p1) e.lc.p1++;
  if (seen.p2) e.lc.p2++;
  if (down.p1 && down.p2) e.tie++;
  for (const p of ['p1', 'p2']) {
    const other = p === 'p1' ? 'p2' : 'p1';
    if (!down[p]) continue;
    if (!seen[p] && !down[other]) e.overkill++;
    if (seen[p] && !down[other]) e.lcFailed++;
    e.excess.push(overkillOf(s, p));
  }
  if (down.p1 && down.p2) return 0.5;
  return down.p2 ? 1 : 0;
}

/** Cómo terminan las partidas de cada variante: se llena en `playOne`. */
let endings = null;
const freshEndings = () => ({ games: 0, rounds: 0, tie: 0, overkill: 0, lcFailed: 0, lc: { p1: 0, p2: 0 }, excess: [] });

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

// El peso de un poder en `POWER_WORTH` (ver `ai.js`). No se mide cuánto le suma el
// poder a un jugador atado a él —con el Rocket gratis ese control pierde casi siempre y
// las anclas se juntan en el ruido—, sino directamente lo que el peso tiene que
// lograr: que la CPU "normal" gane más partidas. El jugador de enfrente elige del
// centro como la CPU con los pesos de hoy (`FREE_WORTH`), y cada valor se compara de a
// pares contra el primero de la lista, que conviene que sea el actual.
const worthFlag = flag('worth', null);
if (worthFlag) {
  const [power, list] = worthFlag.split('=');
  if (!(power in POWER_WORTH)) throw new Error(`poder desconocido: ${power}`);
  const values = list.split(',').map(Number);
  const saved = POWER_WORTH[power];
  console.log(`${GAMES} partidas sembradas por valor · peso de ${power} para la CPU normal (hoy ${saved})\n`);
  const runs = [];
  for (const value of values) {
    POWER_WORTH[power] = value;
    endings = freshEndings();
    const got = [];
    for (const seed of seeds) got.push(1 - await playOne(seed, FREE, 'normal'));
    runs.push(got);
    const vs = runs.length > 1 ? pairedDiff(got, runs[0]) : null;
    console.log(`   ${String(value).padStart(5)}  gana la CPU ${pct(mean(got)).padStart(6)}` +
      (vs ? `   ${signed(vs.diff).padStart(6)} ±${(200 * vs.err).toFixed(1)} vs ${values[0]}` : ''));
  }
  POWER_WORTH[power] = saved;
  process.exit(0);
}

// La Aventura: el mismo jugador simulado contra el rival de cada nivel, con sus poderes,
// su vida y sus partes evolucionadas. Lo que se lee es cuánto gana el rival: la curva
// de la campaña. El jugador simulado juega como la CPU "normal", que no es un humano,
// así que el número dice el orden y los saltos, no la dificultad que va a sentir alguien.
if (args.includes('--adventure')) {
  console.log(`${GAMES} partidas sembradas por nivel · el jugador juega como "normal"${BARE ? ', pelado' : ', con lo que se espera a esa altura'}\n`);
  const only = flag('levels', null)?.split(',').map(Number);
  for (const lvl of ADVENTURE_LEVELS.filter((l) => !only || only.includes(l.id))) {
    endings = freshEndings();
    const got = [];
    for (const seed of seeds) got.push(await playOne(seed, FREE, lvl.difficulty, lvl.id));
    const lost = got.map((x) => 1 - x);
    const short = (c) => (c.power ? ['é', 'l', 'm'] : ['c', 'pc', 'r'])[c.symbols.length - 1];
    const bag = lvl.extras.map(short).join(' ');
    const tags = [lvl.difficulty, lvl.boss ? `jefe ${lvl.hp}` : '', lvl.evolved ? `evo ${lvl.evolved}` : '', bag ? `mochila ${bag}` : ''].filter(Boolean).join(' · ');
    console.log(`   ${String(lvl.id).padStart(2)} ${lvl.rival.padEnd(12)} gana el rival ${pct(mean(lost)).padStart(6)} ±${(200 * stderr(lost)).toFixed(1)} · ` +
      `${(endings.rounds / endings.games).toFixed(1)} rondas · ${tags}`);
  }
  process.exit(0);
}

// Las dificultades: el mismo jugador simulado —roba y elige del centro como la CPU
// "normal"— contra la CPU en cada una. Lo que se lee es cuánto gana la CPU. No sirve
// el control de arriba: sin agarrar nunca un poder pierde contra cualquiera.
if (args.includes('--difficulties')) {
  console.log(`${GAMES} partidas sembradas por dificultad · el jugador juega como "normal"\n`);
  for (const cpu of ['facil', 'normal', 'duro']) {
    endings = freshEndings();
    const got = [];
    for (const seed of seeds) got.push(await playOne(seed, FREE, cpu));
    const lost = got.map((x) => 1 - x);
    console.log(`   ${cpu.padEnd(6)} gana la CPU ${pct(mean(lost)).padStart(6)} ±${(200 * stderr(lost)).toFixed(1)} · ` +
      `${(endings.rounds / endings.games).toFixed(1)} rondas`);
  }
  process.exit(0);
}
console.log(`${GAMES} partidas sembradas por celda · variantes: ${armNames.join(', ')}`);
console.log(`poderes: ${POWERS.join(', ')}\n`);

const results = {};
for (const arm of armNames) {
  const tuning = ARMS[arm];
  if (!tuning) throw new Error(`no existe la variante "${arm}"`);
  endings = freshEndings();
  const control = await cell(null, tuning, seeds);
  const rows = [];
  for (const power of POWERS) {
    const got = await cell(power, tuning, seeds);
    const { diff, err } = pairedDiff(got, control);
    rows.push({ power, win: mean(got), diff, err, got });
  }
  results[arm] = { control, rows, endings };

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
  // Los finales, sobre todas las partidas de la variante (control y poderes juntos).
  const e = endings;
  const ex = e.excess.slice().sort((a, b) => a - b);
  const q = (f) => ex[Math.min(ex.length - 1, Math.floor(f * ex.length))];
  console.log(`   finales: ${e.games} partidas · ${(e.rounds / e.games).toFixed(1)} rondas · ` +
    `empates ${pct(e.tie / e.games)} · overkill ${pct(e.overkill / e.games)} · ` +
    `última chance fallida ${pct(e.lcFailed / e.games)}`);
  console.log(`   última chance: jugador ${pct(e.lc.p1 / e.games)} · CPU ${pct(e.lc.p2 / e.games)} · ` +
    `daño de más al caer: mediana ${q(0.5)}, p75 ${q(0.75)}, p90 ${q(0.9)}`);
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
