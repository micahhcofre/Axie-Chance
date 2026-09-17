import { playCard, scoreChain } from './rules.js';
import { TUNING } from './data.js';

// El mazo tiene 96 cartas pero solo 41 combinaciones distintas de símbolos.
// Agrupando por combinación, un lookahead de 3 niveles cuesta ~70k evaluaciones. El
// poder entra en la combinación: para "duro" una pluma no es la misma carta que su
// gemela sin poder.
function deckProfile(deck) {
  const byKey = new Map();
  for (const card of deck) {
    const key = `${card.symbols.join('+')}|${card.power ?? ''}`;
    const entry = byKey.get(key);
    if (entry) entry.count++;
    else byKey.set(key, { symbols: card.symbols, power: card.power ?? null, count: 1 });
  }
  return [...byKey.values()];
}

/**
 * Lo que la carta robada ya dio apenas salió, se corte o no la cadena después: la
 * pluma pega y el amuleto de fuerza suma. Solo lo cuenta "duro"; `NOTHING` es el
 * punto de partida de cada turno.
 */
const NOTHING = { feather: 0, strength: 0 };
const afterDraw = (drawn, card) => {
  if (card.power === 'feather') return { ...drawn, feather: drawn.feather + TUNING.featherDamage };
  if (card.power === 'strength') return { ...drawn, strength: drawn.strength + TUNING.strengthStep };
  return drawn;
};

// Valor de estar en `chain` pudiendo plantarse o seguir robando.
function chainValue(chain, profile, remaining, depth, worth, drawn) {
  const stand = worth(chain, drawn);
  if (depth <= 0 || remaining <= 0) return stand;
  return Math.max(stand, drawEV(chain, profile, remaining, depth, worth, drawn));
}

// Lo que se espera ganar robando una carta más. La que corta vale lo que `worth` le dé
// a una cadena cortada: 0 para "normal", y para "duro" lo que la carta ya dio al salir.
function drawEV(chain, profile, remaining, depth, worth, drawn) {
  let ev = 0;
  for (const entry of profile) {
    if (entry.count === 0) continue;
    const p = entry.count / remaining;
    const got = afterDraw(drawn, entry);
    const next = playCard(chain, entry);
    if (next.busted) {
      ev += p * worth(next, got);
      continue;
    }
    entry.count--;
    ev += p * chainValue(next, profile, remaining - 1, depth - 1, worth, got);
    entry.count++;
  }
  return ev;
}

/** "Fácil" y "normal" miden el ataque por los puntos de la cadena y nada más. */
const pointsOnly = (chain) => scoreChain(chain).total;

// ---- "duro": el ataque medido contra la partida ------------------------------
//
// "Normal" maximiza los puntos de cada turno, y para eso le alcanza mirar una carta:
// si robar una más no conviene, robar dos tampoco, porque cada carta sube el riesgo de
// cortarse. Por eso la profundidad nunca cambiaba nada.
//
// "Duro" no juega por puntos sino por la partida, y eso cambia qué vale una cadena:
// - Pega contra la vida que hay: el escudo del rival se come la punta del golpe, la
//   Gecko Mask la topea, y lo que se pase de la vida no suma —salvo que se pase tanto
//   que le borre la última chance—.
// - Dejarlo sin vida vale mucho más que el daño en sí. Esos saltos son los que hacen
//   que mirar tres cartas adelante sí cambie decisiones.
// - Cortarse cuesta más que el golpe: se pierden los poderes que ya están en la mesa
//   (un veneno plantado, un huevo, una maceta) y la mitad del centro.
// - Si el rival lo va a dejar sin vida en su próximo golpe, lo que rinde después
//   (hojas, veneno, fuerza, el centro) ya no importa: va a todo o nada.
// - En su última chance solo cuenta dejarlo en cero: juega a la probabilidad de empatar.

/** Cuánto vale, en puntos de vida, cada cosa que no es daño directo. */
const DURO = {
  // Plantarse se lleva dos cartas del centro (o un poder); cortarse, una.
  stand: 3,
  // Dejarlo sin vida, con y sin la última chance de por medio.
  down: 15,
  knockout: 40,
  // Un punto de fuerza rinde en cada ataque que queda.
  strength: 3,
  // La cáscara del huevo que se rompe le devuelve el golpe: pesa, pero no entero.
  thorns: 0.5,
  poison: 9,
  octopus: 3,
  bubble: 2,
  snail: 3,
  steelskin: 4,
  eggThorns: 3,
  // El ataque de la última chance: ganarla lo es todo.
  lastChance: 100,
};

/** Lo que "duro" asume de la mesa si no se la pasan: rival entero, nada puesto. */
const QUIET_VIEW = {
  strength: 0, weak: false, myHp: 100, myShield: 0, myCap: 0, myPoison: 0,
  foeHp: 100, foeShield: 0, foeThorns: 0, foeCap: 0, foeStrength: 0, foeWeak: false,
  lastChance: false,
};

/** Un golpe bueno del rival, sin contar fuerza: con esto se mide si el próximo lo tumba. */
const FOE_HIT = 12;

/**
 * Si el próximo golpe del rival lo deja sin vida: el veneno muerde al terminar este
 * turno, y después pega el rival contra su escudo y su máscara.
 */
function doomedAt(view) {
  let hit = FOE_HIT + view.foeStrength;
  if (view.foeWeak) hit = Math.ceil(hit / TUNING.snailShare);
  hit = Math.max(hit - view.myShield, 0);
  if (view.myCap > 0) hit = Math.min(hit, view.myCap);
  return view.myHp - view.myPoison <= hit;
}

const unstacked = (cards) => cards.flatMap((c) => c.stackedCards || [c]);

/** Valor de plantarse con `chain`, en puntos de vida, para la mesa que describe `view`. */
function attackWorth(view, chain, drawn) {
  const foeHp = Math.max(view.foeHp - drawn.feather, 0);
  const later = view.doomed || view.lastChance ? 0 : 1;
  const early = drawn.feather + drawn.strength * DURO.strength * later;
  if (view.lastChance && foeHp <= 0) return DURO.lastChance;
  if (chain.busted) return view.lastChance ? 0 : early;

  const points = scoreChain(chain).total;
  const cards = unstacked(chain.cards);
  const claws = cards.filter((c) => c.power === 'brutal').length;
  const longest = Math.max(0, ...chain.runs.map((r) => r.length));
  let swing = points > 0 ? points + view.strength + drawn.strength + claws * TUNING.brutalStep * longest : 0;
  if (view.weak && swing > 0) swing = Math.ceil(swing / TUNING.snailShare);
  const blocked = Math.min(view.foeShield, swing);
  let landed = swing - blocked;
  if (view.foeCap > 0 && landed > view.foeCap) landed = view.foeCap;
  const downs = foeHp > 0 && landed >= foeHp;

  if (view.lastChance) return downs ? DURO.lastChance : landed / 100;

  let value = early + Math.min(landed, foeHp) + DURO.stand * later;
  if (blocked > 0 && blocked === view.foeShield) value -= view.foeThorns * DURO.thorns;
  if (downs) value += landed - foeHp > TUNING.overkill ? DURO.knockout : DURO.down;

  // Los poderes de la mesa: se cobran plantándose, y se pierden si la cadena se corta.
  const missing = 100 - view.myHp;
  for (const { power } of cards) {
    if (!power || power === 'brutal' || power === 'feather' || power === 'strength') continue;
    if (power === 'poison') value += DURO.poison * later;
    else if (power === 'octopus') value += DURO.octopus * later;
    else if (power === 'bubble') value += DURO.bubble * later;
    else if (swing <= 0) continue;
    else if (power === 'snail') value += DURO.snail;
    else if (power === 'steelskin') value += DURO.steelskin;
    else if (power === 'egg') value += Math.max(1, Math.floor(swing / TUNING.eggShare)) + DURO.eggThorns;
    else if (power === 'pot') value += Math.min(swing, missing);
    else if (power === 'leech') value += TUNING.leechDrain + Math.min(TUNING.leechDrain, missing);
    else if (power === 'leaf') value += Math.min(TUNING.leafGain * TUNING.leafHeal, missing) * later;
  }
  return value;
}

// Profundidad del lookahead y cuánto tiene que superar el EV a plantarse.
// - "Fácil" es tímida a propósito: se planta antes de tiempo, no juega el final y
//   elige mal del centro la mitad de las veces (`sloppy`).
// - "Normal" maximiza los puntos de cada turno: juega bien, pero no mira la partida.
// - "Duro" lee la mesa (`reads`: ver `attackWorth`) y mira tres cartas adelante.
const STYLE = {
  facil:  { depth: 1, margin: 1.35, playsEndgame: false, sloppy: 0.5 },
  normal: { depth: 1, margin: 1.0,  playsEndgame: true },
  duro:   { depth: 3, playsEndgame: true, reads: true },
};

/** Con qué probabilidad la CPU elige del centro al azar en vez de pensar. */
export const sloppyDraft = (difficulty) => STYLE[difficulty]?.sloppy ?? 0;

/** Si la CPU usa la renovación del centro cuando puede: "fácil" no se da cuenta. */
export const renewsMarket = (difficulty) => !STYLE[difficulty]?.sloppy;

/**
 * @param {object} chain      cadena actual de la CPU
 * @param {Array}  deck       cartas que todavía no se vieron
 * @param {object} opts
 * @param {number|null} opts.needs  puntaje de cadena que le alcanza para empatar en su
 *                                  última chance (ver `cpuNeeds`); null el resto del
 *                                  tiempo
 * @param {string} opts.difficulty
 * @param {object} [opts.view]  la mesa desde su asiento (ver `attackViewOf` en
 *                              `game.js`); solo la usa "duro"
 */
export function decideDraw(chain, deck, { needs = null, difficulty = 'normal', view = null } = {}) {
  if (deck.length === 0) return false;
  const style = STYLE[difficulty] ?? STYLE.normal;

  if (style.reads) {
    // Sin mesa, `needs` hace de vida del rival: es la pared que hay que pasar.
    const seen = view ?? { ...QUIET_VIEW, foeHp: needs ?? QUIET_VIEW.foeHp, lastChance: needs !== null };
    const table = { ...seen, doomed: doomedAt(seen) };
    const worth = (c, drawn) => attackWorth(table, c, drawn);
    const stand = worth(chain, NOTHING);
    // Con el empate ya asegurado no hay nada que ganar robando.
    if (table.lastChance && stand >= DURO.lastChance) return false;
    return drawEV(chain, deckProfile(deck), deck.length, style.depth, worth, NOTHING) > stand;
  }

  const stand = scoreChain(chain).total;

  // La última chance. Si con lo que ya tiene alcanza para empatar, se planta y lo
  // asegura: robar una carta más no puede mejorar un empate y sí puede perderlo.
  //
  // Y si todavía no alcanza, sigue con su cabeza de siempre en vez de perseguir el
  // número. Antes lo perseguía —robaba mientras la cadena estuviera por debajo—, y
  // como el número suele ser la vida entera del rival, eso era robar hasta cortarse:
  // el golpe final salía en 0 casi siempre. Juega su turno normal y pega lo que pueda.
  if (needs !== null && style.playsEndgame && stand >= needs) return false;

  return drawEV(chain, deckProfile(deck), deck.length, style.depth, pointsOnly, NOTHING) > stand * style.margin;
}

// ---- elección de cartas de la reserva ---------------------------------------

/**
 * Qué tan bien se enlaza una carta con un mazo: por cada símbolo suyo, cuántas
 * cartas del mazo lo llevan. Es la medida directa de lo que puntúa el juego —
 * una carta sirve en la medida en que puede continuar cadenas que ya podés abrir.
 */
export function connectivity(card, deck) {
  return card.symbols.reduce(
    (sum, s) => sum + deck.reduce((n, c) => n + (c.symbols.includes(s) ? 1 : 0), 0),
    0,
  );
}

/** La carta de `options` que mejor se enlaza con `deck`. */
export const pickBest = (options, deck) => argmax(options, (card) => connectivity(card, deck), -1).best;

/** Las `n` mejores de `options`, reevaluando después de cada elección. */
function bestCards(options, deck, n) {
  const picked = [];
  const grown = deck.slice();
  const left = options.slice();
  let value = 0;
  while (picked.length < n && left.length) {
    let bestAt = 0;
    let best = -1;
    for (let i = 0; i < left.length; i++) {
      const v = connectivity(left[i], grown);
      if (v > best) { best = v; bestAt = i; }
    }
    const [card] = left.splice(bestAt, 1);
    picked.push(card);
    grown.push(card);
    value += best;
  }
  return { cards: picked, value };
}

/**
 * Cuánto vale cada poder para la CPU, medido en cartas: 1 es "tanto como sumar una
 * carta más al mazo".
 *
 * Salen de atar al jugador a un solo poder contra la CPU normal y contar partidas
 * ganadas, 800 sembradas por poder, contra un control que nunca agarra ninguno
 * (`npm run balance`). En puntos sobre ese control:
 *
 *   veneno +11.4 · pulpo +10.4 · huevo +8.9 · fuerza +8.4 · caracol +7.7 · maceta +6.5
 *
 * De ese orden solo hay **dos escalones** afirmables: {veneno, pulpo, huevo, fuerza} y
 * {caracol, maceta}. Comparando cada poder pareado contra el líder de su grupo,
 * adentro de cada uno el banco no distingue nada. Los ± de la tabla son el error
 * contra el control, no el de la diferencia entre dos poderes: no sirven para
 * ordenarlos entre sí.
 *
 * Los pesos igual siguen los valores medidos y no los dos escalones, porque esto no
 * es una afirmación sino una decisión bajo incertidumbre: para elegir, el mejor
 * número disponible es la estimación, aunque no alcance para publicarla. Lo que no
 * hay que hacer es leer el orden fino como si fuera un hecho.
 *
 * La escala de la banda —cuán seguido un poder le gana a dos cartas sin poder— resultó
 * no importar. Está detrás de `TUNING.powerBias`, y multiplicarla por 0.7, 1.5 y 2 no
 * mueve ningún resultado fuera del ruido. Lo que decide es el **orden relativo**, no
 * el nivel absoluto.
 *
 * Ojo con el lazo: la medición corre contra esta misma CPU, así que cambiar estos
 * pesos mueve los números de los que salieron. No es circular como contar cuántas
 * veces la CPU elige cada poder —eso solo refleja estos pesos y nada más—, pero
 * conviene volver a correr el banco después de tocarlos. Por la misma razón, subir un
 * poder **baja** a los otros cinco: el rival también lo tiene.
 *
 * Y una advertencia de fecha: estos seis números salieron de un juego en el que la
 * fuerza cobraba con la cadena rota, el veneno bajaba de a 2, la cáscara era un tercio
 * del golpe y el caracol mordía un número fijo durante dos ataques. Cuatro reglas
 * cambiaron, y la del caracol es la más grande: mordía la mitad del golpe con que se
 * lo ponían, así que en manos del que venía pegando fuerte apagaba ataques enteros.
 * Su 1.15 es de esa versión y casi seguro está alto para la de ahora. Siguen siendo la
 * mejor estimación que hay, pero son de antes: hay que volver a correr el banco antes
 * de tratarlos como medidos.
 */
const POWER_WORTH = {
  poison: 1.7,
  octopus: 1.55,
  bubble: 1.55,
  leech: 1.45,
  egg: 1.3,
  feather: 1.3,
  steelskin: 1.3,
  strength: 1.25,
  brutal: 1.25,
  leaf: 1.2,
  snail: 1.15,
  pot: 0.95,
  freegame: 1.2,
};

/**
 * La carta suelta que paga cada pulpo. No es el reparto: es una sola carta, sirve
 * cualquiera —también con poder— y no sale del mazo sino de arriba de él, o sea que
 * es con lo que vas a abrir la ronda que viene.
 *
 * Se puntúa igual que en `planDraft`, con el efecto convertido a conectividad, pero
 * sin la comparación contra dos cartas: acá no se resigna nada, así que gana la de
 * más valor a secas. Las 36 cartas con poder son todas de 3 símbolos, así que la que
 * trae efecto casi siempre gana — y está bien: abrir con un trío abre tres cadenas en
 * vez de dos y **solo los símbolos de la primera carta puntúan**.
 */
export function pickBonus(pool, deck) {
  const { perCard } = plainPair(pool, deck);
  return argmax(pool, (card) => worth(card, deck, perCard)).best;
}

/**
 * Las dos mejores cartas sin poder de `pool`, y lo que vale cada una en promedio: con
 * eso se convierte el efecto de un poder a conectividad.
 */
function plainPair(pool, deck) {
  const two = bestCards(pool.filter((c) => !c.power), deck, 2);
  return { two, perCard: two.cards.length ? two.value / two.cards.length : 0 };
}

/** Conectividad de la carta más lo que vale su efecto, si tiene. */
const worth = (card, deck, perCard) =>
  connectivity(card, deck) + (card.power ? POWER_WORTH[card.power] * TUNING.powerBias * perCard : 0);

/** El primer elemento de `items` con el valor más alto por encima de `floor`. */
function argmax(items, value, floor = -Infinity) {
  let best = null;
  let bestValue = floor;
  for (const item of items) {
    const v = value(item);
    if (v > bestValue) { bestValue = v; best = item; }
  }
  return { best, bestValue };
}

/**
 * Qué se lleva la CPU del centro.
 *
 * La elección es poder contra cantidad: dos cartas sin poder, o una con poder. Se
 * miden en la misma unidad —conectividad con el mazo— sumándole al poder lo que
 * vale su efecto, convertido a conectividad con el promedio de las dos cartas que
 * estaría resignando. Así la comparación se adapta al mazo: cuando las cartas sin
 * poder enlazan muy bien, el efecto tiene que valer más para ganarles.
 *
 * Es la misma para "normal" y "duro". Se probó una elección que leyera la partida
 * —poderes pesados según la vida de cada uno, y llevarse lo que más le serviría al
 * rival— y sobre 600 partidas no movió nada (+0.5 ±2.6); negarle cartas al rival
 * incluso empeoraba. La diferencia de "duro" está en cuándo plantarse.
 *
 * @param {'stand'|'bust'} kind  se plantó (2 sin poder o 1 con poder) o se cortó (1 sin poder)
 */
export function planDraft(pool, deck, { kind }) {
  if (pool.length === 0) return { mode: null, cards: [] };

  if (kind === 'bust') {
    const plain = pool.filter((c) => !c.power);
    return plain.length ? { mode: 'plain', ...bestCards(plain, deck, 1) } : { mode: null, cards: [] };
  }

  const { two, perCard } = plainPair(pool, deck);
  const powered = pool.filter((c) => c.power);
  const { best, bestValue } = argmax(powered, (card) => worth(card, deck, perCard), -1);

  if (best && bestValue > two.value) return { mode: 'power', cards: [best], value: bestValue };
  return two.cards.length ? { mode: 'plain', ...two } : { mode: null, cards: [] };
}
