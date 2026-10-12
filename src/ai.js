import { bestStack, isFreeStack, playCard, scoreChain, stackOnCard } from './rules.js';
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
 * pluma pega, y los demás poderes "al robarla" (garra, abanico, burbuja, daga,
 * escáner, guantes, filo) dejan algo puesto. Solo lo cuenta "duro"; `NOTHING` es el
 * punto de partida de cada turno.
 */
const NOTHING = { feather: 0, value: 0 };
const ON_DRAW = { rage: 5, strength: 4, fan: 3, maker: 7, dagger: 4, scanner: 5, gloves: 5, edge: 3 };
const afterDraw = (drawn, card) => {
  if (card.power === 'feather') return { ...drawn, feather: drawn.feather + TUNING.featherDamage };
  if (ON_DRAW[card.power]) return { ...drawn, value: drawn.value + ON_DRAW[card.power] };
  return drawn;
};

// Valor de estar en `chain` pudiendo plantarse o seguir robando. `saves` son los
// huevos sanos que le quedan en la mesa: cada uno perdona un corte.
function chainValue(chain, profile, remaining, depth, worth, drawn, saves = 0) {
  const stand = worth(chain, drawn);
  if (depth <= 0 || remaining <= 0) return stand;
  return Math.max(stand, drawEV(chain, profile, remaining, depth, worth, drawn, saves));
}

/**
 * Cómo queda la cadena con la carta robada. El Rocket Stamp no se encadena: se monta
 * gratis donde más suma, que es lo que hace la CPU con él (ver `botTurn`).
 */
const withCard = (chain, card) =>
  isFreeStack(card) && chain.cards.length > 0
    ? stackOnCard(chain, bestStack(chain, card), card)
    : playCard(chain, card);

// Lo que se espera ganar robando una carta más. La que corta vale lo que `worth` le dé
// a una cadena cortada: 0 para "normal", y para "duro" lo que la carta ya dio al salir.
// Con un huevo sano el corte no pasa: la carta vuelve al mazo (el perfil no cambia) y
// se sigue desde la misma cadena, con un huevo menos.
function drawEV(chain, profile, remaining, depth, worth, drawn, saves = 0) {
  let ev = 0;
  for (const entry of profile) {
    if (entry.count === 0) continue;
    const p = entry.count / remaining;
    const got = afterDraw(drawn, entry);
    const next = withCard(chain, entry);
    if (next.busted) {
      ev += p * (saves > 0
        ? chainValue(chain, profile, remaining, depth - 1, worth, got, saves - 1)
        : worth(next, got));
      continue;
    }
    entry.count--;
    ev += p * chainValue(next, profile, remaining - 1, depth - 1, worth, got, saves);
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
//   almohada le resta, y lo que se pase de la vida no suma —salvo que se pase tanto
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
  // Las espinas del rival le vuelven al que pega: pesan, pero no enteras.
  thorns: 0.8,
  // Cada garra pone su sangrado en cada golpe que conecte.
  claw: 3,
  // El ataque de la última chance: ganarla lo es todo.
  lastChance: 100,
};

/**
 * Lo que rinde cada poder de la mesa al plantarse, en puntos de vida: todos cobran con
 * plantarse sin cortarse, pegue lo que pegue. Los de curar
 * se recortan con la vida que le falta, y los que rinden en turnos que vienen no
 * valen nada si el rival lo va a tumbar (`later`).
 */
const STAND_WORTH = {
  poison: 12, octopus: 3, bubble: 2, jellyfish: 6, redbubble: 4, guard: 8, sage: 8, trickster: 5,
  razor: 10, brutal: 7, snail: 5, cocoon: 12, steelskin: 8, viper: 3, pillow: 8,
};

/** Lo que "duro" asume de la mesa si no se la pasan: rival entero, nada puesto. */
const QUIET_VIEW = {
  feathers: 0, rage: 0, weak: 0, claws: 0, myHp: 150, maxHp: 150, myShield: 0, myPillow: 0, myPoison: 0, myBleed: 0,
  foeHp: 150, foeShield: 0, foeSpikes: 0, foePillow: 0, lastChance: false, saves: 0,
};

/** Un golpe bueno del rival: con esto se mide si el próximo lo tumba. */
const FOE_HIT = 17;

/**
 * Si el próximo golpe del rival lo deja sin vida: el veneno muerde al terminar este
 * turno, y después pega el rival contra su escudo y su almohada.
 */
function doomedAt(view) {
  let hit = Math.max(FOE_HIT - view.myShield, 0);
  if (view.myPillow > 0) hit = Math.max(hit - TUNING.pillowCut, 0);
  return view.myHp - view.myPoison - view.myBleed * TUNING.bleedDamage <= hit;
}

const unstacked = (cards) => cards.flatMap((c) => c.stackedCards || [c]);

/** Los puntos de la cadena sin las `weak` mejores rachas (ver `pointsOf` en `game.js`). */
const pointsWithout = (chain, weak) =>
  scoreChain(chain).breakdown.slice(weak).reduce((sum, r) => sum + r.points, 0);

/** Valor de plantarse con `chain`, en puntos de vida, para la mesa que describe `view`. */
function attackWorth(view, chain, drawn) {
  const foeHp = Math.max(view.foeHp - drawn.feather, 0);
  const later = view.doomed || view.lastChance ? 0 : 1;
  const early = drawn.feather + drawn.value * later;
  if (view.lastChance && foeHp <= 0) return DURO.lastChance;
  if (chain.busted) {
    if (view.lastChance) return 0;
    // El martillo le rompe el escudo, y el shuriken pega contra el que le quede.
    const hand = unstacked([...chain.cards, ...(chain.bustCard ? [chain.bustCard] : [])]);
    const hammer = hand.some((c) => c.power === 'hammer');
    const shield = hammer ? 0 : view.foeShield;
    const shurikens = hand.filter((c) => c.power === 'shuriken').length;
    return early + (hammer ? view.foeShield : 0) + Math.max(shurikens * TUNING.shuriken - shield, 0);
  }

  const points = pointsWithout(chain, view.weak ?? 0);
  const cards = unstacked(chain.cards);
  const swing = points + (view.feathers ?? 0) * TUNING.fanStep + (view.rage ?? 0);
  const blocked = Math.min(view.foeShield, swing);
  let landed = swing - blocked;
  if (view.foePillow > 0) landed = Math.max(landed - TUNING.pillowCut, 0);
  const downs = foeHp > 0 && landed >= foeHp;

  if (view.lastChance) return downs ? DURO.lastChance : landed / view.maxHp;

  let value = early + Math.min(landed, foeHp) + DURO.stand * later;
  if (swing > 0) value -= view.foeSpikes * DURO.thorns;
  if (downs) value += landed - foeHp > TUNING.overkill ? DURO.knockout : DURO.down;

  // Los poderes de la mesa: se cobran plantándose, y se pierden si la cadena se corta.
  const missing = view.maxHp - view.myHp;
  value += (view.claws ?? 0) * DURO.claw * later;
  for (const { power } of cards) {
    if (!power) continue;
    if (STAND_WORTH[power]) value += STAND_WORTH[power] * later;
    else if (power === 'pot') value += Math.min(TUNING.potHeal, missing);
    else if (power === 'leech') {
      // La daga pega después del golpe, contra el escudo que el golpe le haya dejado.
      const drain = Math.max(TUNING.leechDrain - Math.max(view.foeShield - swing, 0), 0);
      value += drain + Math.min(drain, missing);
    }
    else if (power === 'leaf') value += Math.min(TUNING.leafTurns * TUNING.leafHeal, missing) * later;
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
export function decideDraw(chain, deck, { needs = null, difficulty = 'normal', view = null, saves = view?.saves ?? 0 } = {}) {
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
    return drawEV(chain, deckProfile(deck), deck.length, style.depth, worth, NOTHING, saves) > stand;
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

  return drawEV(chain, deckProfile(deck), deck.length, style.depth, pointsOnly, NOTHING, saves) > stand * style.margin;
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
 * Los primeros seis salieron de atar al jugador a un solo poder contra la CPU normal y
 * contar partidas ganadas, 800 sembradas por poder, contra un control que nunca agarra
 * ninguno (`npm run balance`). En puntos sobre ese control:
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
 * El Rocket Stamp se mide distinto. Desde que es gratis (no corta, se pone sobre la
 * columna que uno elija), un jugador atado a él le saca +14.7 ±2.8 al control, pero el
 * control pierde el 96% y veneno y maceta quedan pegados (+1.9, +1.5): las anclas se
 * juntan en el ruido y no hay contra qué interpolar. Así que se midió lo que el peso
 * tiene que lograr, que la CPU normal gane más contra un jugador que elige con los
 * pesos de antes (`npm run balance -- --worth freegame=…`, pareado contra 1.2):
 *
 *   0.8 −2.4 ±2.7 · 1.6 +1.2 ±2.9 (800 por valor) · 2 −1.4 · 3 −5.9 · 5 −5.5 (400)
 *
 * Una loma chata con la punta cerca de 1.6: más arriba se lleva el Rocket en vez de dos
 * cartas que enlazan, y pierde. Nada sale del ruido cerca de 1.2; es la mejor
 * estimación, no un hecho.
 *
 * **Cada vez que se toca un poder** (su regla o sus números en `TUNING`) se vuelve a
 * medir su peso con `--worth` y se actualiza acá, en el mismo cambio.
 *
 * El rebalanceo de 2026-10 (sangrado de 2 por carta, medusas en el mazo, Trickster
 * que roba, víbora que cierra la cura de un turno, guantes al robar, martillo al
 * cortarte, almohada que resta, y casi todos los números arriba) cambió cuánto vale
 * cada poder, y los pesos se rehicieron enteros. Mover uno solo ±0.3 con `--worth` no
 * sale del ruido (±0.5), así que no se pueden afinar de a uno. Se midió entonces lo que
 * vale cada poder en un banco parejo: los dos jugadores eligen del centro como la CPU
 * normal, uno se lleva el poder siempre que puede y el otro nunca; la diferencia,
 * pareada por semilla, es lo que suma llevárselo en vez de lo que se habría llevado. El
 * peso es 1.3 + 0.05 por punto. La tabla entera contra la de antes, con el mismo
 * jugador enfrente: la CPU normal +0.8 ±1.2 (4000 partidas), la dura +0.5 ±1.5 (3000).
 * Con 0.1 por punto daba −0.3 ±1.4: más pendiente no ayuda.
 */
export const POWER_WORTH = {
  // Del rebalanceo de 2026-10: 1.3 + 0.05 por cada punto que le suma agarrar ese poder
  // en vez de lo que se habría llevado (banco parejo, 2000 partidas, ±2.1; ver arriba),
  // redondeado a 0.05 y entre 0.85 y 1.8. Entre paréntesis, ese punto.
  // Pájaro
  egg: 1.65, //        +6.6
  fan: 1.55, //        +5.2
  feather: 1.45, //    +2.7
  shuriken: 1.25, //   −0.9
  hammer: 0.9, //      −8.2
  // Pez
  jellyfish: 1.5, //   +3.9
  redbubble: 1.5, //   +3.9
  maker: 1.45, //      +3.0
  bubble: 1.1, //      −4.3
  octopus: 1.05, //    −5.0
  // Bestia
  strength: 1.6, //    +5.8
  dagger: 1.5, //      +4.2
  brutal: 1.45, //     +3.4
  rage: 1.45, //       +2.9
  razor: 1.4, //       +2.3
  // Planta
  leaf: 1.55, //       +4.5
  guard: 1.4, //       +1.6
  sage: 1.4, //        +1.6
  pot: 1.35, //        +1.1
  pillow: 1.2, //      −1.8
  // Bicho
  cocoon: 1.4, //      +2.5
  leech: 1.4, //       +2.2
  trickster: 1.3, //   +0.1
  snail: 1.25, //      −0.9
  scanner: 1.25, //    −1.4
  // Reptil
  gloves: 1.8, //      +10.1
  poison: 1.4, //      +2.5
  steelskin: 1.4, //   +2.5
  edge: 1.4, //        +2.4
  viper: 0.85, //      −8.6
  // El Rocket no se mide así —hay 15 en la reserva y "priorizarlo" es llevárselo en
  // casi todos los repartos—: queda el 1.6 que salió de `--worth` (ver arriba).
  freegame: 1.6,
  // Los neutrales de la Aventura: estimados, todavía sin medir. `--worth` corre partidas
  // sueltas, donde no salen (ver `NEUTRAL_POWERS` en `data.js`); para medirlos hace falta
  // un banco que los ponga en la reserva.
  focus: 1.6,
  mirror: 1.5,
  tape: 1.5,
  energy: 1.5,
  papa: 1.4,
  blood: 1.4,
  spell: 1.35,
  mama: 1.35,
  dispel: 1.25,
  lens: 1.2,
  gift: 1.2,
  stamp: 1.15,
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

/**
 * Conectividad de la carta más lo que vale su efecto, si tiene. `weights` es la tabla de
 * pesos: la de la CPU salvo en el banco, que fija la del jugador simulado para medir la
 * de la CPU (`npm run balance -- --worth`).
 */
const worth = (card, deck, perCard, weights = POWER_WORTH) =>
  connectivity(card, deck) + (card.power ? weights[card.power] * TUNING.powerBias * perCard : 0);

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
 * @param {object} [weights]     los pesos de los poderes (ver `worth`)
 */
export function planDraft(pool, deck, { kind, weights = POWER_WORTH }) {
  if (pool.length === 0) return { mode: null, cards: [] };

  if (kind === 'bust') {
    const plain = pool.filter((c) => !c.power);
    return plain.length ? { mode: 'plain', ...bestCards(plain, deck, 1) } : { mode: null, cards: [] };
  }

  const { two, perCard } = plainPair(pool, deck);
  const powered = pool.filter((c) => c.power);
  const { best, bestValue } = argmax(powered, (card) => worth(card, deck, perCard, weights), -1);

  if (best && bestValue > two.value) return { mode: 'power', cards: [best], value: bestValue };
  return two.cards.length ? { mode: 'plain', ...two } : { mode: null, cards: [] };
}
