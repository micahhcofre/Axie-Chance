import { buildPool, shuffle, makeRng, cardLabel, crest, powerIcon, POWERS, TUNING, chooseActivePowers, makeCard, makeJelly, cleanExtras, extraCards } from './data.js';
import { AXIES, AXIE_IDS, axie, deckFor, evolvedId } from './axies.js';
import { bestStack, emptyChain, isFreeStack, playCard, scoreChain, stackOnCard } from './rules.js';
import { decideDraw, planDraft, pickBest, pickBonus, sloppyDraft, renewsMarket, POWER_WORTH } from './ai.js';
import { getAdventureLevel, adventurePowers, adventureCharms, levelTitle } from './adventure.js';
import { isStage, pickStage, TUTORIAL_STAGE } from './stages.js';
import { tr } from './i18n.js';

// Los números de los poderes viven en `data.js`, al lado de los carteles que los
// explican, así el texto sale de los mismos valores que usa el juego. Se reexportan
// porque el banco de pruebas y los tests los buscan acá.
export { TUNING };

export const PLAYERS = ['p1', 'p2'];
/**
 * Vida con la que arranca cada Axie. Los puntos de una cadena son el daño que le
 * hace al rival, así que `totals[p]` es "daño repartido por p" y la vida que le
 * queda a alguien es TARGET menos el daño del otro (ver `hpOf`). Cuando uno llega
 * a cero le queda un golpe más, salvo overkill (ver `lastChance`).
 *
 * Con el mazo de 8 cartas los turnos pegan más fuerte y con 100 la partida se iba en
 * diez rondas; 150 le devuelve el aire sin volver a las partidas largas.
 */
export const TARGET = 150;
/**
 * La vida del tutorial. Su guión está contado para 100: los cinco golpes del jugador
 * suman justo lo que hace falta para que el remate de la ronda 5 deje al rival en 0.
 */
export const TUTORIAL_TARGET = 100;
/** La vida con la que arrancó esta partida: la del juego, o la del tutorial. */
export const maxHpOf = (state, player) =>
  state?.maxHp?.[player] ?? (state?.tutorial ? TUTORIAL_TARGET : TARGET);
/** Lo que se ve el cierre de una ronda antes de que la siguiente arranque sola. */
const ROUND_PAUSE = 1100;
/**
 * En el tutorial, más: el cartel del corte ("¡Cadena rota!") sale cuando la carta
 * aterriza y con 1,1 s se iba antes de terminar de leerlo.
 */
const TUTORIAL_ROUND_PAUSE = 2600;
/** Cartas boca arriba en el centro. Se repone en el acto al llevarse una. */
export const MARKET_SIZE = 6;
/**
 * El reloj, en milisegundos: lo que tiene una persona para jugar su turno y para
 * elegir del centro después. Cuando se acaba decide el juego —el turno falla, como si
 * se hubiera cortado la cadena, y el reparto se cierra sin llevarse nada más—, así
 * nadie deja la mesa esperando. La máquina no lleva reloj: no tarda.
 */
export const CLOCK = { turn: 30000, draft: 20000 };

/**
 * Cuánto se queda a la vista la carta que cortó la cadena antes de cerrar el turno, en ms.
 * Cubre lo que tarda la pantalla en mostrarla, buscarle enganche símbolo por símbolo y
 * romper la cadena (`BUST_BREAK` en `table-fx.js`, 1,7 s): si el centro se abre antes,
 * el jugador no llega a leer qué le salió.
 */
export const BUST_HOLD = 1900;

/**
 * Lo que dura "¿una más?" antes de que salga la carta (ver `oneMoreOf`): la mesa se
 * apaga, sube el tono y el cartel golpea, como en el tráiler. El motor espera esto con
 * el turno ocupado, así nadie roba ni se planta en el medio.
 */
export const ONE_MORE_MS = 1500;

/**
 * La carta de "¿una más?" no vuela como las demás: sale en cámara lenta (ver `flyEpic`
 * en `table-fx.js`). Sube del mazo de espaldas hasta el medio de la pantalla, se queda
 * temblando, se da vuelta y recién ahí cae. `ONE_MORE_FLIP` es cuándo se da vuelta y
 * `ONE_MORE_LAND` cuándo cae, en ms desde que entra al estado. El motor espera que caiga
 * antes de resolverla; el sonido y el cuerpo del Axie reaccionan cuando se da vuelta,
 * que es cuando se ve qué salió.
 */
export const ONE_MORE_FLIP = 1150;
export const ONE_MORE_LAND = 1550;

/**
 * El Secret Egg perdona el corte en tres tiempos, y el motor espera cada uno (ver
 * `state.eggSave`): la carta cae al final de la cadena y corta (`bust`), el huevo de la
 * mesa se rompe (`crack`) y la carta vuelve volando al mazo (`back`). En ms.
 */
export const EGG_SAVE = { bust: 1250, crack: 1100, back: 650 };

/** Desde cuántas cartas para el K.O. se muestra la cuenta atrás (ver `koInOf`). */
export const KO_COUNTDOWN = 10;

/**
 * El compás que hay entre soltar el ataque y el golpe: la cadena se recorre sola,
 * carta por carta, y recién cuando termina de recorrerse sale el zarpazo (ver
 * `traceChain` en `ui.js`). Es puro tiempo —el motor no sabe qué se dibuja—, pero el
 * tiempo sí es suyo: es él quien decide cuándo cae el daño, y la pantalla no puede
 * frenarlo por su cuenta sin que el número y la vida se le adelanten al dibujo.
 *
 * Un tramo por carta, con un piso para la cadena de una sola —que igual tiene su
 * chispazo— y un techo para que una cadena larga no se haga eterna.
 */
export const aimMs = (cards) => (cards > 0 ? Math.min(1500, 380 + 210 * (cards - 1)) : 0);

/**
 * Lo que tarda en verse cada poder que tiene animación propia, en ms, según el momento:
 * `apply` es cuando entra en juego al plantarse, `stand` cuando actúa antes del golpe
 * (la bebida, que se vuelca sobre el daño al plantarse) y `tick` cuando vuelve a actuar al
 * finalizar un turno (las hojas, al empezarlo). La pantalla los muestra de a uno y completos, después del golpe
 * (ver `power-fx.js`), y el turno espera a que termine el último antes de seguir.
 *
 * Como `aimMs`, es puro tiempo: el motor no sabe qué se dibuja, pero es él quien
 * decide cuándo se abre el centro. Un poder que no está acá no agrega espera.
 */
export const POWER_BEAT = {
  strength: { draw: 1300, apply: 1400 },
  brutal: { apply: 1500, drain: 900 },
  razor: { apply: 1500, bleed: 900 },
  dagger: { draw: 1200 },
  rage: { draw: 1200, fury: 1400 },
  octopus: { apply: 1500, pick: 1100 },
  bubble: { apply: 1700, trap: 1300, open: 1300 },
  maker: { draw: 1100, bomb: 1600 },
  jellyfish: { apply: 1500, sting: 900 },
  redbubble: { apply: 1500 },
  egg: { save: EGG_SAVE.crack },
  feather: { draw: 2000 },
  shuriken: { apply: 1500 },
  fan: { draw: 1100 },
  hammer: { apply: 1200 },
  pot: { apply: 1600 },
  leaf: { apply: 1600, tick: 1500 },
  guard: { apply: 1500, cleanse: 900 },
  sage: { apply: 1600 },
  pillow: { apply: 1500, block: 1000 },
  snail: { apply: 1900, slow: 900 },
  leech: { apply: 2100 },
  cocoon: { apply: 1500, tick: 1300 },
  scanner: { draw: 1300 },
  trickster: { apply: 1300, pick: 1100 },
  poison: { apply: 1900, tick: 1900 },
  steelskin: { apply: 1700, spike: 1300 },
  viper: { apply: 1500, block: 900 },
  gloves: { draw: 1500, self: 1100, cure: 1300 },
  edge: { draw: 1200 },
  focus: { draw: 1200 },
  lens: { draw: 1100 },
  spell: { cast: 1400 },
  mirror: { draw: 1000 },
  energy: { apply: 1400 },
  papa: { apply: 1400 },
  mama: { apply: 1400 },
  blood: { apply: 1300 },
  dispel: { apply: 1400 },
  stamp: { apply: 1100, pick: 1100 },
  tape: { save: 1300 },
  gift: { apply: 1200 },
};

/** Del golpe al primer poder: lo que tarda en conectar el golpe (hasta 700) y un respiro. */
export const POWER_LEAD = 1000;

/** Lo que pide un efecto de poder (`{ power, moment }`) antes de dejar pasar al siguiente. */
export const powerBeat = (fx) => POWER_BEAT[fx.power]?.[fx.moment] ?? 0;

/**
 * Lo que le queda puesto a un jugador de una ronda a la otra. Lo propio:
 *   `egg`      el escudo; aguanta golpes hasta gastarse. Se llama así por el huevo
 *              de antes, pero es el escudo entero, lo sume quien lo sume (tope
 *              `TUNING.shieldMax`)
 *   `pillow`   turnos del rival en los que la almohada le resta `pillowCut` a cada
 *              ataque; se gasta uno al terminar cada turno suyo
 *   `claws`    garras de Charm of Power: cada ataque pone 2 de sangrado por garra
 *   `rage`     Rage de la Mask of Frenzy: +2 de daño por punto; al tope, Furia
 *   `feathers` plumas del abanico, que se gastan en el próximo golpe que conecta
 *   `bomb`     burbujas del Bubble Maker, hasta la bomba
 *   `leaf`     turnos de brote que quedan (cada uno cura al empezar el turno)
 *   `cocoon`   turnos de capullo que quedan (cada uno da escudo al empezar el turno)
 *   `spikes`   espinas: el próximo golpe rival que conecta se las lleva
 *   `antidote` guantes: al final de este turno su veneno lo cura en vez de dañarlo
 *   `cleanser` Limpiadores: cada uno cancela el próximo efecto que le pongan
 *   `stacked`  cartas extra del centro que debe el pulpo
 *   `bubbles`  burbujas de Bubble Paste: la próxima carta del centro abre la ronda
 *   `tricks`   cartas del rival que todavía tiene que robarle (Trickster's Card)
 *   `focus`    focos de Charm of Focus: cada ataque suma `focusStep` por foco, para siempre
 *   `gift`     daño que guardó Last Gift para su próximo ataque
 *   `stamps`   cartas de regalo del centro que debe la Earth Stamp
 * Y lo que le pusieron (los efectos que cancela el Limpiador y limpia la Red Sage):
 *   `poison`   cuánto muerde al finalizar su turno; después baja 1
 *   `bleed`    cuántas de las cartas que robe le cuestan `bleedDamage`; baja 1 con
 *              cada una
 *   `wound`    heridas abiertas (Energy Drink): en su próximo turno, cada carta que
 *              pague sangrando cura al rival `drinkHeal` por herida; se cierran al
 *              terminar ese turno
 *   `weak`     cuántas de sus mejores rachas no cuentan en su próximo ataque
 *   `healBlock` turnos en los que no le va a entrar ninguna cura (Viper's Venom): se
 *              gasta uno la primera vez que se cura en un turno
 *   `healShut` si la cura ya se le cerró en el turno que corre (ver `heal`)
 *   `noPowers` cartas sin poder que tiene que llevarse antes de volver a poder
 *              llevarse una con poder
 */
const emptyStatus = () => ({
  egg: 0, pillow: 0, claws: 0, rage: 0, feathers: 0, bomb: 0, leaf: 0, cocoon: 0, spikes: 0, antidote: 0,
  cleanser: 0, stacked: 0, bubbles: 0, tricks: 0, focus: 0, gift: 0, stamps: 0,
  poison: 0, bleed: 0, wound: 0, weak: 0, healBlock: 0, healShut: 0, noPowers: 0,
});

/**
 * Lo que hizo cada uno en la partida, contado mientras pasa. La partida no lo usa: es
 * para las misiones (ver `matchEvent` en `missions.js`), que lo leen al terminar, y se
 * cuenta acá porque después ya no se puede reconstruir.
 *
 *   `attacks`  la racha más larga de cada ataque que no se cortó, en orden
 *   `busts`    las veces que se cortó la cadena
 *   `powers`   las cartas con poder de clase que robó, por clase (las apagadas no)
 *   `picks`    las cartas que se llevó del centro
 *   `stacks`   los Rocket Stamps que montó
 *   `oneMoreKo` los K.O. directos con la carta de "¿una más?"
 *   `bleed`, `poison`, `thorns`  el daño que le hicieron al rival su sangrado, su veneno
 *              y sus espinas
 *   `direct`   el daño directo de las plumas y el que el shuriken le llevó a la vida
 *   `stolen`   la vida (Mantis Dagger) y el escudo (Metal Scanner) que le robó al rival
 */
const emptyStats = () => ({
  attacks: [], busts: 0, powers: {}, picks: 0, stacks: 0, oneMoreKo: 0,
  bleed: 0, poison: 0, thorns: 0, direct: 0, stolen: 0,
});


/** Los efectos que un jugador le puede poner al otro (ver `resist` y la Red Sage). */
const DEBUFFS = ['poison', 'bleed', 'wound', 'weak', 'healBlock', 'healShut', 'noPowers'];

/**
 * Las cartas de una fila de la mesa, desarmando las montadas (Free Game, burbuja). El
 * Red Mirror juega con los símbolos de la carta anterior en una copia (`mirrorOf`): lo
 * que vuelve al mazo es el espejo de verdad.
 */
const unstack = (cards) => cards.flatMap((c) => c.stackedCards || [c]).map((c) => c.mirrorOf ?? c);

/** Cuántas cartas de la cadena de `player` traen `power` (no la que cortó). */
const chainCount = (state, player, power) => unstack(state.chains[player].cards).filter((c) => c.power === power).length;

/** El largo de la racha más larga de la cadena. */
const longestRun = (chain) => Math.max(0, ...chain.runs.map((r) => r.length));

/**
 * Los huevos de la mesa de `player` que todavía no se rompieron este turno: cada uno
 * perdona un corte (ver `extend`).
 */
export function eggsLeft(state, player) {
  const chain = state.chains?.[player];
  if (!chain) return 0;
  const hatched = state.hatched?.[player] ?? [];
  return unstack(chain.cards)
    .filter((c) => c.power === 'egg' && !hatched.includes(c.uid)).length;
}

// Cada jugador roba de su propio mazo y no hay descarte: cada ronda arranca con el
// mazo entero barajado de nuevo, como una tragamonedas. Contar lo que salió sigue
// valiendo dentro de la ronda —las cartas jugadas no vuelven hasta que cierre—, pero
// nada se arrastra de una ronda a la otra.

const other = (p) => (p === 'p1' ? 'p2' : 'p1');

/**
 * Cómo se nombra cada asiento, y en qué persona le habla el registro.
 *
 * Contra la máquina el jugador es "vos" y el verbo va en segunda —"abrís", "sacás"—;
 * en una sala el registro es el mismo para los dos aparatos, así que ninguno de los
 * dos asientos puede ser "vos": se nombran desde afuera y todo va en tercera. La
 * pantalla sí sabe cuál es el suyo y lo dice —ver `addressing` en `ui.js`—, pero el
 * registro es uno solo y lo leen los dos. Sin esta distinción un mismo texto no puede
 * servir a los dos modos: o dice "Jugador 1 abrís" o dice "Vos abre".
 *
 * Las formas con "a" y con "de" adelante están escritas enteras y no armadas pegando
 * la preposición, porque el español contrae: "a el Jugador 2" no existe, es "al
 * Jugador 2". Una regla para dos casos se lee peor que los dos casos.
 */
const YOU = { name: tr('Vos'), short: tr('Vos'), mid: tr('vos'), to: tr('a vos'), of: tr('de vos'), you: true };
const CPU = { name: tr('La CPU'), short: tr('CPU'), mid: tr('la CPU'), to: tr('a la CPU'), of: tr('de la CPU') };
const VOICE = {
  cpu: { p1: YOU, p2: CPU },
  tutorial: { p1: YOU, p2: CPU },
  adventure: {
    p1: YOU,
    p2: { name: tr('Rival'), short: tr('Rival'), mid: tr('el rival'), to: tr('al rival'), of: tr('del rival') },
  },
  net: {
    p1: { name: tr('Jugador 1'), short: tr('J1'), mid: tr('el Jugador 1'), to: tr('al Jugador 1'), of: tr('del Jugador 1') },
    p2: { name: tr('Jugador 2'), short: tr('J2'), mid: tr('el Jugador 2'), to: tr('al Jugador 2'), of: tr('del Jugador 2') },
  },
};

/**
 * La voz de un asiento: cómo se llama y en qué persona se le habla. La pantalla la
 * necesita por lo mismo que el registro: los carteles le hablan al que va a apretar el
 * botón, y en una sala ese botón es de uno de los dos aparatos.
 */
export const seatVoice = (state, player) => VOICE[state.mode][player];

/**
 * Si a `player` lo juega la máquina. Solo el segundo asiento puede tocarle a la CPU, y
 * en una sala no le toca a nadie: los dos los mueve una persona.
 *
 * Vive acá y no adentro de la partida porque la UI también la necesita —para saber si
 * el turno que corre es de alguien que va a apretar un botón o de alguien a quien hay
 * que esperar— y las dos tienen que contestar lo mismo.
 */
export const isBotSeat = (state, player) => state.mode !== 'net' && player === 'p2';

/**
 * Vida que le queda a `player`: la inicial, menos el daño que le hizo el otro, más
 * lo que se curó con la maceta. `healed` solo acumula lo que efectivamente curó
 * (ver `heal`), así que nunca hace falta recortar por arriba.
 */
export const hpOf = (state, player) =>
  Math.max(maxHpOf(state, player) - state.totals[other(player)] + state.healed[player], 0);

/**
 * Los puntos de la cadena de `player` con el caracol encima: sus `weak` mejores rachas
 * no cuentan. Una cadena cortada hace 0.
 */
export function pointsOf(state, player) {
  const chain = state.chains[player];
  if (chain.busted) return 0;
  const runs = scoreChain(chain).breakdown; // de la que más puntúa a la que menos
  const cut = state.status[player]?.weak ?? 0;
  return runs.slice(cut).reduce((sum, r) => sum + r.points, 0);
}

/**
 * Lo que pegaría `player` si soltara el ataque ahora: los puntos de su cadena (sin las
 * rachas que le apagó el caracol) más las plumas del abanico y la Rage. Una cadena
 * cortada hace 0 y no la levanta nada; una entera que el caracol dejó en 0 es igual un
 * ataque, y lo que suma números fijos suma igual.
 *
 * Casi ningún poder multiplica el golpe: los que suman daño suman un número fijo por
 * copia. La excepción es la Energy Drink S, que dobla los puntos de la cadena (una sola
 * vez, tenga las que tenga) y se rompe al usarse. El número grande de la pantalla ya la
 * cuenta: es el que se va a aplicar.
 */
export function swingOf(state, player) {
  const chain = state.chains[player];
  if (chain.busted || chain.cards.length === 0) return 0;
  const points = pointsOf(state, player) * (chainCount(state, player, 'energy') > 0 ? TUNING.energyMult : 1);
  const st = state.status[player];
  return points + (st.feathers ?? 0) * TUNING.fanStep + rageBonusOf(st) + neutralBonusOf(state, player);
}

/**
 * Lo que suman al golpe los neutrales: los focos (para siempre), el regalo guardado, y
 * los osos y el pacto de sangre de la cadena. Números fijos, como las plumas.
 */
export function neutralBonusOf(state, player) {
  const st = state.status[player];
  const even = (state.round ?? 0) % 2 === 0;
  return (st.focus ?? 0) * TUNING.focusStep + (st.gift ?? 0)
    + (even ? chainCount(state, player, 'papa') * TUNING.papaDamage : 0)
    + chainCount(state, player, 'blood') * TUNING.bloodDamage;
}

/**
 * Lo que suma la Rage al golpe: +2 por punto, y con la Rage al tope, la Furia encima
 * (se gasta en el próximo golpe que conecta, ver `finishTurn`).
 */
export function rageBonusOf(st) {
  const rage = st?.rage ?? 0;
  return rage * TUNING.rageStep + (rage >= TUNING.rageMax ? TUNING.furyBonus : 0);
}

/**
 * Cuánta vida le sacaría al rival el ataque que `player` tiene armado, si se plantara
 * ahora: el golpe entero (`swingOf`), menos lo que se come el escudo del rival y lo
 * que le resta su almohada. Es lo que la pantalla pinta en rojo sobre la vida del otro
 * mientras se roba (ver `plateHtml` en `ui.js`), así que tiene que ser la misma cuenta
 * que hace el golpe de verdad en `stand`. No cuenta lo que llega después —el veneno,
 * el sangrado, las espinas—: eso no sale de este golpe.
 */
export function projectedHit(state, player) {
  const swing = swingOf(state, player);
  if (swing <= 0) return 0;
  const theirs = state.status[other(player)];
  const landed = swing - Math.min(theirs.egg, swing);
  return theirs.pillow > 0 ? Math.max(landed - TUNING.pillowCut, 0) : landed;
}

/**
 * La mesa vista desde el asiento de `player`, con lo que la CPU "duro" necesita para
 * medir un ataque contra la partida y no solo contra sus puntos (ver `decideDraw`):
 * sus plumas, las dos vidas, lo que protege a cada uno, los huevos que le quedan y si
 * este es el golpe de su última chance.
 */
export function attackViewOf(state, player) {
  const foe = other(player);
  const mine = state.status[player];
  const theirs = state.status[foe];
  return {
    feathers: mine.feathers,
    rage: rageBonusOf(mine),
    weak: mine.weak,
    claws: mine.claws,
    myHp: hpOf(state, player),
    maxHp: maxHpOf(state, player),
    myShield: mine.egg,
    myPillow: mine.pillow,
    myPoison: mine.poison,
    myBleed: mine.bleed,
    foeHp: hpOf(state, foe),
    foeShield: theirs.egg,
    foeSpikes: theirs.spikes,
    foePillow: theirs.pillow,
    lastChance: lastChance(state) === player,
    // Los huevos que le quedan sin romper en la mesa: cada uno perdona un corte.
    saves: eggsLeft(state, player),
  };
}

/**
 * Cómo terminó la partida: `'p1'`, `'p2'`, `'tie'`, o `null` si todavía se juega. Gana
 * el que deja al otro sin vida; si los dos quedaron en cero —una última chance que
 * conecta— es empate.
 *
 * Si alguien abandonó, gana el que se quedó, sin importar en qué ronda fue: irse es
 * dar la partida por perdida.
 *
 * Es una regla y por eso vive acá: la pantalla la pinta, no la decide.
 */
export function matchResult(state) {
  if (!state || state.phase !== 'matchEnd') return null;
  if (state.forfeit) return state.forfeit.winner;
  const down = { p1: hpOf(state, 'p1') <= 0, p2: hpOf(state, 'p2') <= 0 };
  if (down.p1 && down.p2) return 'tie';
  return down.p2 ? 'p1' : 'p2';
}

/**
 * Si la partida la ganó alguien por **K.O.**: el derrotado quedó sin vida sin llegar a
 * jugar su última chance (overkill, ver `lastChance`). Tumbarlo y que su último golpe
 * no alcance también es ganar, pero no es un K.O.: en la Aventura pasa el nivel sin la
 * estrella, y en la mesa el derrotado se desploma sin el cartel de "¡K.O.!".
 * Un abandono o un empate no son K.O.
 */
export function wonByKo(state) {
  const won = matchResult(state);
  if (state?.forfeit || (won !== 'p1' && won !== 'p2')) return false;
  const loser = other(won);
  return hpOf(state, loser) <= 0 && !state.lastChanceUsed?.[loser];
}

/**
 * Daño que recibió `player` de más, pasado el cero: lo que el golpe que lo dejó sin
 * vida —y lo que le siguió cayendo después— se pasó de la vida que tenía.
 */
export const overkillOf = (state, player) =>
  Math.max(state.totals[other(player)] - state.healed[player] - maxHpOf(state, player), 0);

/**
 * El que está jugando su última chance, o esperándola: lo dejaron sin vida y todavía
 * no soltó el golpe que le queda. Le toca un turno normal —roba, encadena, se planta—
 * y si en ese golpe deja sin vida al otro también, la partida termina empatada.
 *
 * Le toca a cualquiera de los dos. Al que cierra, si lo matan antes de atacar, la
 * juega en el mismo intercambio; al que abre —que cuando cae ya tiró su golpe— se la
 * juega abriendo la ronda siguiente, y la partida se cierra con ese golpe sin que el
 * otro vuelva a jugar.
 *
 * No hay última chance:
 * - con overkill: si le pegaron más de `TUNING.overkill` pasado el cero, no se levanta.
 *   Cuenta todo lo que le cae mientras espera, no solo el golpe que lo tumbó.
 * - si ya la jugó (`lastChanceUsed`).
 * - con los dos sin vida: eso ya es el empate.
 *
 * En el tutorial el remate está guionado con la última chance del rival: ahí no hay
 * overkill que la borre.
 *
 * Vive acá y no en la UI porque es una regla y no un adorno: el halo que la marca en
 * pantalla y el número que persigue la máquina (`needsOf`) tienen que salir de la
 * misma cuenta.
 */
export function lastChance(state) {
  if (!state || state.phase === 'matchEnd') return null;
  const down = PLAYERS.filter((p) => hpOf(state, p) <= 0);
  if (down.length !== 1) return null;
  const [player] = down;
  if (state.lastChanceUsed?.[player]) return null;
  if (!state.tutorial && overkillOf(state, player) > TUNING.overkill) return null;
  return player;
}

/**
 * Si el golpe que `player` tiene armado sería un K.O. directo: lo deja sin vida y con
 * más de `TUNING.overkill` pasado el cero, así que el rival no tiene última chance (ver
 * `lastChance`). Es la misma cuenta que hace el golpe de verdad (`projectedHit`).
 */
const directKo = (state, player) =>
  projectedHit(state, player) - hpOf(state, other(player)) > TUNING.overkill;

/**
 * Cuántas cartas le faltan a `player` para el **K.O.** —dejar al rival sin vida y sin
 * última chance: más de `TUNING.overkill` pasado el cero (ver `directKo`)— si cada una
 * sigue su racha más larga todavía viva (un eslabón más por carta), contando desde la
 * cadena que tiene ahora. 0 si con lo que tiene ya es K.O.; `null` si harían falta más
 * de `KO_COUNTDOWN`. No mira el mazo: es la cuenta que el jugador puede hacer mirando
 * su cadena, y la que hace la cuenta atrás (ver `koInOf`).
 */
export function koProjection(state, player) {
  let chain = state.chains[player];
  const ko = (c) => directKo({ ...state, chains: { ...state.chains, [player]: c } }, player);
  if (ko(chain)) return 0;
  for (let n = 1; n <= KO_COUNTDOWN; n++) {
    const alive = chain.runs.filter((r) => r.alive);
    if (alive.length === 0) return null;
    const longest = alive.reduce((a, b) => (b.length > a.length ? b : a));
    chain = playCard(chain, makeCard([longest.symbol]));
    if (ko(chain)) return n;
  }
  return null;
}

/**
 * Si el ataque que `player` tiene armado deja al rival en cero pero **con última
 * chance**: lo tumba sin pasarse `TUNING.overkill`, así que se levanta para un golpe
 * más. La pantalla lo avisa arriba del daño (ver `swingHtml` en `ui.js`), porque
 * plantarse ahí no es el K.O.
 */
export function leavesLastChance(state, player) {
  if (!state || state.tutorial || state.phase !== 'turn' || state.turn !== player) return false;
  if (lastChance(state) || state.chains[player].busted) return false;
  const foeHp = hpOf(state, other(player));
  return foeHp > 0 && projectedHit(state, player) >= foeHp && !directKo(state, player);
}

/**
 * La cuenta atrás del K.O.: cuántas cartas más tiene que robar `player` para el K.O.,
 * sin última chance para el rival (ver `koProjection`). Es la tentación puesta en número: la pantalla la muestra pegada al
 * daño (ver `swingHtml` en `ui.js`).
 *
 * Cuenta con la racha más larga (`koProjection`) y **nunca va para atrás**: cada carta
 * que engancha la baja por lo menos uno, y la que suma dos símbolos —o alarga otra
 * racha que empuja más— la hace saltar más de uno, porque se recalcula. Lo que ya bajó
 * lo guarda el motor en `state.koCount` (ver `countDown`). No baja de 1 mientras el
 * golpe no lo tumbe de verdad: nunca dice "cero" de mentira.
 *
 * `null` si no hay cuenta que mostrar: no es su turno, ya lo tumba (0) o faltan más de
 * `KO_COUNTDOWN`.
 */
export function koInOf(state, player) {
  if (!state || state.tutorial || state.phase !== 'turn' || state.turn !== player) return null;
  const chain = state.chains[player];
  if (chain.busted || chain.cards.length === 0) return null;
  // Con alguien en su última chance no hay K.O. que contar: el golpe que queda es el
  // último, y dejarlo en cero es el empate.
  if (hpOf(state, other(player)) <= 0 || lastChance(state)) return null;
  const fresh = koProjection(state, player);
  if (fresh === 0) return 0;
  const kept = state.koCount?.player === player ? state.koCount.n : null;
  const n = Math.min(fresh ?? Infinity, kept ?? Infinity);
  return n <= KO_COUNTDOWN ? n : null;
}

/**
 * "¿Una más?": el robo de `player` es la apuesta del K.O. directo. El ataque que tiene
 * armado no lo da —no alcanza, o alcanza pero le deja la última chance al rival—, pero
 * alguna carta de su mazo lo daría, y alguna otra le corta la cadena. Es el chiste del
 * tráiler hecho momento: la pantalla lo anuncia antes de que salga la carta, y el motor
 * lo resuelve con las reglas de siempre.
 *
 * - Si la carta engancha y el golpe ya es K.O. directo, ataca solo en el acto.
 * - Si corta, cero de daño, como cualquier corte (la pantalla le pone el trombón).
 * - Si engancha y todavía no lo es, el turno sigue como siempre.
 *
 * Mira el mazo entero y no la carta de arriba, como la rueda de chances: la apuesta es
 * sobre lo que puede salir, no sobre lo que va a salir. Sin tutorial —ahí no hay
 * overkill— y sin nadie en su última chance: ahí dejarlo en cero es el empate.
 */
export function oneMoreOf(state, player) {
  if (!state || state.tutorial || state.phase !== 'turn' || state.turn !== player) return false;
  if (state.pendingStack || lastChance(state)) return false;
  const chain = state.chains[player];
  if (chain.busted || chain.cards.length === 0) return false;
  if (hpOf(state, other(player)) <= 0 || directKo(state, player)) return false;
  let kills = false;
  let busts = false;
  for (const card of state.decks[player]) {
    const next = isFreeStack(card) ? stackOnCard(chain, bestStack(chain, card), card) : playCard(chain, card);
    if (next.busted) busts = true;
    else if (!kills) kills = directKo({ ...state, chains: { ...state.chains, [player]: next } }, player);
    if (kills && busts) return true;
  }
  return false;
}

// ---- las vistas del estado --------------------------------------------------
//
// Preguntas que se contestan mirando `state` y nada más: quién está eligiendo, qué
// puede tocar, si le queda una renovación.
//
// Viven acá, sueltas y exportadas, porque hay dos lados que necesitan la misma
// respuesta. La partida que corre adentro de `createGame` las usa para decidir; y con
// la partida en red, la pantalla del otro dispositivo solo tiene el estado que le
// llegó por el cable —no tiene el cierre, ni la partida— y tiene que poder contestarlas
// igual. Escritas dos veces se irían separando sin que nadie se entere; escritas una
// sola vez, no pueden.

/** El asiento al que le toca elegir del centro, lo juegue quien lo juegue. */
export const draftingSeat = (state) =>
  (state?.draft ? state.draft.order[state.draft.index] ?? null : null);

/** El mismo, pero solo si lo juega una persona: es a quien la pantalla le da el centro. */
export const drafterOf = (state) => {
  const player = draftingSeat(state);
  return player && !isBotSeat(state, player) ? player : null;
};

/**
 * El asiento que está jugando su turno y al que la pantalla le da los botones: el del
 * turno, salvo que lo juegue la máquina.
 */
export const actingOf = (state) => {
  if (!state || state.phase !== 'turn') return null;
  const player = state.turn;
  return player && !isBotSeat(state, player) ? player : null;
};

/** Cartas que todavía pueden salir del mazo de `player`: el mazo, sin más. */
export const unseenOf = (state, player) => state.decks[player];

/**
 * Cómo terminó la ronda de `player`, que es lo que decide qué le toca del centro. Pegada
 * con la Scotch Tape (`'taped'`) no le toca nada: solo la carta de regalo de la Earth
 * Stamp, si tiene.
 */
const awardKindOf = (state, player) => {
  const chain = state.chains[player];
  return chain.taped ? 'taped' : chain.busted ? 'bust' : 'stand';
};
const plainCardsOf = (state) => state.market.filter((c) => !c.power);

/**
 * Todo lo que `player` podría llegar a llevarse ahora mismo. Plantado y sin haber
 * tocado nada las dos ramas siguen abiertas, así que sirve el centro entero; una
 * vez que agarró una carta sin poder ya se comprometió, y la segunda tampoco puede
 * llevar poder. El tamaño de la carta dejó de importar.
 */
export function draftableFor(state, player) {
  // Robándole cartas al rival (Trickster's Card) no se elige del centro.
  if (state.draft?.step === 'trick') return [];
  // Con la Red Bubble encima no se lleva nada con poder, ni en el reparto ni del pulpo,
  // hasta que se lleve una sin poder.
  const locked = (state.status?.[player]?.noPowers ?? 0) > 0;
  // La carta del pulpo es aparte del reparto: no la limita ni la rama que eligió ni
  // haberse cortado. Es un turno de mercado suelto. La de la Earth Stamp, igual.
  if (state.draft?.step === 'bonus') {
    return (TUNING.octopusPowers || state.draft.bonusBy === 'stamp') && !locked ? state.market.slice() : plainCardsOf(state);
  }
  if (awardKindOf(state, player) === 'taped') return [];
  const mode = state.draft?.mode;
  if (mode === 'power') return []; // la carta con poder cierra el reparto
  if (locked || mode === 'plain' || awardKindOf(state, player) === 'bust') return plainCardsOf(state);
  return state.market.slice();
}

/**
 * Si nada de lo que puede agarrar lleva su símbolo, el centro no le ofrece nada que
 * enlace con su mazo: puede renovarlo entero, una sola vez por reparto.
 */
export function canRenewFor(state, player) {
  if (!state || state.phase !== 'draft' || draftingSeat(state) !== player) return false;
  if (state.draft.step === 'trick') return false;
  if (state.draft.renewed[player] || state.pool.length === 0) return false;
  const own = state.symbols[player];
  return !draftableFor(state, player).some((c) => c.symbols.includes(own));
}

/**
 * Las cartas del rival de `player` que el Trickster le puede robar: todas las suyas con
 * poder que están en su mazo o en su burbuja, Rocket incluido. Las de la mesa no: en el
 * reparto la mesa ya volvió al mazo (ver `finishTurn`). Van en un orden fijo (por uid) y
 * no en el del mazo: el mazo viaja barajado en red y la lista no puede cambiar de lugar
 * entre dos pantallas.
 */
export function trickTargetsFor(state, player) {
  const foe = other(player);
  const cards = [
    ...state.decks[foe],
    ...(state.bubbleCard?.[foe] ? [state.bubbleCard[foe].card] : []),
  ];
  return cards.filter((c) => c.power).sort((a, b) => a.uid - b.uid);
}

/** Cuántas de `cards` son del jugador: las medusas del rival no (se rompen al salir). */
const realCount = (cards) => cards.filter((c) => !c.jelly).length;

/**
 * Cartas de `player` que están en la mesa y todavía no volvieron a su mazo. Apenas
 * termina su turno la cadena se devuelve (`returned`), pero se sigue mostrando hasta
 * que cierre la ronda: sin esta cuenta, lo que está a la vista se contaría dos veces.
 */
export function onTable(state, player) {
  if (state.returned[player]) return 0;
  const chain = state.chains[player];
  const pending = state.pendingStack?.player === player ? 1 : 0;
  const bust = chain.bustCard && !chain.bustCard.jelly ? 1 : 0;
  return realCount(unstack(chain.cards).slice(state.recycled[player])) + bust + pending;
}

/**
 * Todas las cartas de `player`: el mazo, la que espera en la burbuja, lo que sigue
 * en la mesa sin devolver y la que el Secret Egg está devolviendo (ver `saveWithEgg`).
 * Las medusas que le metió el rival no cuentan: no son suyas y no vuelven.
 */
export const ownedBy = (state, player) =>
  realCount(state.decks[player]) + (state.bubbleCard?.[player] ? 1 : 0) + onTable(state, player)
  + (state.eggSave?.player === player && !state.eggSave.card?.jelly ? 1 : 0);

/**
 * @param {{pace?: number, seed?: number}} opts
 *   `pace` 0 corre sin pausas (tests).
 *   `seed` fija todo el azar de la partida: los barajados y el Axie que le toca a la
 *   CPU. Dos partidas con la misma semilla y las mismas decisiones son idénticas, que
 *   es lo que hace comparables dos corridas del banco de pruebas. Sin semilla, azar
 *   del sistema — que es como se juega.
 *   `clock` es cuánto dura el reloj de cada cosa (ver `CLOCK`), o `null` para jugar
 *   sin reloj. Sin pausas (`pace: 0`) va apagado: es el banco de pruebas, y ahí nadie
 *   está pensando.
 */
export function createGame({ pace = 1, seed, clock = pace > 0 ? CLOCK : null } = {}) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms * pace));
  const rng = seed === undefined ? Math.random : makeRng(seed);
  /** Baraja con el azar de esta partida, no con el del sistema. */
  const deal = (cards) => shuffle(cards, rng);
  // El escenario se sortea con su propio azar: si saliera de `rng`, sumar escenarios
  // le cambiaría el reparto a toda partida sembrada (los tests, el banco de balance).
  const stageRng = seed === undefined ? Math.random : makeRng((seed ^ 0x5ce7a9) >>> 0);
  let state = null;
  // Los turnos son asíncronos. Si se arranca otra partida en el medio, la época
  // cambia y las corrutinas viejas se cortan en vez de escribir sobre el estado nuevo.
  let epoch = 0;
  const listeners = new Set();
  // Si los efectos de poder anotados todavía no salieron en un `emit` (ver `stageFx`).
  let fxOpen = false;
  const emit = () => {
    fxOpen = false;
    listeners.forEach((fn) => fn(state));
  };

  /**
   * Anota un poder que acaba de actuar para que la pantalla lo anime (ver `powerFx`).
   * Lo que se anota antes del mismo `emit` sale junto y en orden: plantarse pone varios
   * de una, y en el centro la burbuja puede atrapar la carta en el mismo instante en
   * que se abre la carta extra del pulpo.
   */
  function stageFx(fx) {
    if (fxOpen && state.powerFx) state.powerFx.fx.push(fx);
    else state.powerFx = { id: ++state.powerFxId, player: fx.by, fx: [fx] };
    fxOpen = true;
  }

  /**
   * Las cuentas de `player` para las misiones (ver `emptyStats`). Un estado armado a mano
   * —los tests, la zona de testeo— puede no traerlas: se arman al primer uso.
   */
  function statsOf(player) {
    state.stats ??= { p1: emptyStats(), p2: emptyStats() };
    return state.stats[player];
  }

  /** Espera `ms` y devuelve false si esta corrutina quedó obsoleta. */
  async function tick(ms, era) {
    await sleep(ms);
    return era === epoch;
  }

  /** El asiento por su nombre, en las formas que piden las frases del registro. */
  const voice = (p) => VOICE[state.mode][p];
  const who = (p) => voice(p).name;
  const whom = (p) => voice(p).mid;
  const toWhom = (p) => voice(p).to;
  const ofWhom = (p) => voice(p).of;
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const isBot = (p) => isBotSeat(state, p);

  /**
   * Una línea del registro. `kind` es su color: casi siempre el asiento que la provocó
   * ('p1'/'p2'). Antes el color decía si la noticia era buena o mala, y eso solo tiene
   * sentido cuando hay un solo lado mirando; con dos personas, "bueno" es de quién.
   */
  function log(text, kind = 'info') {
    state.log.unshift({ id: state.logId++, text, kind });
    if (state.log.length > 24) state.log.pop();
  }

  // ---- el reloj -----------------------------------------------------------------

  let alarm = 0;

  /**
   * Le pone el reloj a `player` para `kind` —'turn' o 'draft'— y lo escribe en el
   * estado, que es de donde lo lee la pantalla. Hay uno solo por vez: armar uno nuevo
   * desarma el anterior. `ends` es la hora de acá; la sala lo manda como lo que falta
   * (ver `redact` en `rooms.js`), porque el reloj del celular no es el del
   * anfitrión.
   */
  function armClock(player, kind, left = null) {
    clearTimeout(alarm);
    const ms = clock?.[kind];
    // El reloj es para no hacer esperar a otra persona: solo en red. Contra la CPU
    // (la Aventura, el tutorial) cada uno piensa lo que quiera.
    if (!ms || state.mode !== 'net' || isBot(player)) { state.clock = null; return; }
    const era = epoch;
    // `left`: lo que le quedaba, si se lo frenó a mitad de camino (ver `askOneMore`).
    const wait = left ?? ms;
    state.clock = { seat: player, kind, ms, ends: Date.now() + wait };
    alarm = setTimeout(() => { if (era === epoch) timeUp(player, kind); }, wait);
    // En Node no retiene el proceso: un test con pausas no se queda 30 segundos colgado.
    alarm.unref?.();
  }

  function stopClock() {
    clearTimeout(alarm);
    state.clock = null;
  }

  /** Se acabó el tiempo: el juego hace lo que el jugador no hizo. */
  function timeUp(player, kind) {
    const on = state.clock;
    if (!on || on.seat !== player || on.kind !== kind) return;
    state.clock = null;
    if (kind === 'turn') {
      // Ocupado es que ya está cerrando —la carta que cortó la cadena está cayendo—.
      if (canAct() !== player) return;
      // Quedarse sin tiempo no arruina lo que ya se armó: el reloj se planta por el
      // jugador y ataca con lo que llegó a robar. Dudar de más cuesta lo que la cadena
      // hubiera crecido, no la cadena entera.
      const timeoutMsg = voice(player).you
        ? tr('Se acabó el tiempo: atacás con lo que tenés.')
        : tr('Se acabó el tiempo: ataca con lo que tiene.');
      log(timeoutMsg, 'muted');
      void stand();
    } else {
      if (state.phase !== 'draft' || drafter() !== player) return;
      log(tr('Se acabó el tiempo de elegir.'), 'muted');
      void skipDraft(player);
    }
  }

  function draw(player) {
    if (state.decks[player].length === 0) {
      // Sin descarte, lo único fuera del mazo es lo que ya salió esta ronda: vuelve
      // adentro. `recycled` marca hasta dónde de la cadena ya se devolvió, para no
      // contarlo otra vez al cerrar la ronda.
      // La medusa no: se rompió al salir.
      const played = unstack(state.chains[player].cards);
      state.decks[player] = deal(played.slice(state.recycled[player]).filter((c) => !c.jelly));
      state.recycled[player] = played.length;
      // Lo que mostró la lente ya no es lo de arriba: se barajó.
      if (state.peek?.player === player) state.peek = null;
      log(voice(player).you
        ? tr('Vos rebarajás lo que ya salió.')
        : tr('{who} rebaraja lo que ya salió.', { who: who(player) }), 'muted');
    }
    const card = state.decks[player].pop() ?? makeCard([state.symbols[player]]);
    if (state.peek?.player === player) {
      const left = state.peek.cards.filter((c) => c.uid !== card.uid);
      state.peek = left.length ? { ...state.peek, cards: left } : null;
    }
    reveal(player, card);
    return card;
  }

  /**
   * Lo que pasa con cada carta que le sale a `player`, venga del mazo o de la burbuja:
   * si es una medusa, se rompe (no vuelve al mazo: ver `finishTurn`), y si sangra, la
   * paga.
   */
  function reveal(player, card) {
    if (card.jelly) {
      stageFx({ power: 'jellyfish', moment: 'sting', by: other(player), on: player, amount: 1 });
      log(`${powerIcon('jellyfish', 'sm')} ${tr('Una medusa: no comparte nada y se rompe.')}`, other(player));
    }
    bleedOnDraw(player);
  }

  /**
   * El sangrado: cada carta que roba el que sangra le cuesta `bleedDamage` de vida, y el
   * sangrado baja 1: cuenta cartas, no vida. No pasa por el escudo. Con la herida
   * abierta de la Energy Drink, cada carta que paga le cura al rival `drinkHeal` por
   * herida.
   */
  function bleedOnDraw(player) {
    const st = state.status[player];
    if (st.bleed <= 0) return;
    const foe = other(player);
    const dmg = TUNING.bleedDamage;
    addDamage(foe, dmg);
    statsOf(foe).bleed += dmg;
    st.bleed--;
    stageFx({ power: 'razor', moment: 'bleed', by: foe, on: player, amount: dmg });
    log(`${powerIcon('razor', 'sm')} ${tr('Sangrado: −{dmg} de vida {target} (queda en {hp}).', { dmg, target: toWhom(player), hp: hpOf(state, player) })}`, foe);
    if (st.wound > 0) {
      const got = heal(foe, st.wound * TUNING.drinkHeal);
      if (got > 0) {
        stageFx({ power: 'brutal', moment: 'drain', by: foe, on: foe, amount: got });
        powerLog('brutal', tr('Energy Drink M: la herida cura {got} a {who}.', { got, who: whom(foe) }), foe);
      }
    }
  }

  const unseenPool = (player) => unseenOf(state, player);

  /** Las cartas de `player` con las que la CPU mide conectividad. */
  const cardsOf = (player) => state.decks[player];

  /**
   * @param {{difficulty?: string, mode?: string, axie?: string, axie2?: string,
   *   boosts?: object, boosts2?: object}} opts
   *   `axie` y `axie2` son ids del roster: el del primer asiento y el del segundo.
   *   `axie2` solo se respeta en una sala —contra la CPU su Axie es sorteado, que es
   *   parte de la partida—, y ahí se respeta entero: los dos pueden traer el mismo
   *   bicho. Cada uno eligió el suyo en su aparato antes de entrar, y decirle a uno de
   *   los dos que ese no, que lo agarró el otro, sería devolverle una elección que ya
   *   había hecho. Con el mismo mazo de los dos lados la partida es pareja, no es un
   *   error.
   *
   *   `boosts` y `boosts2` son las mejoras que cada asiento eligió en la pantalla de
   *   elección (ver `buildPersonalDeck`). Viajan al lado del Axie porque son de él: un
   *   mazo mejorado es el mazo de ese bicho y de ningún otro. La CPU no lleva: su Axie
   *   se sortea en el momento y no pasó por ninguna pantalla donde elegir nada.
   *
   *   `extras` y `extras2` son las cartas de la mochila que cada uno le puso a su Axie
   *   (ver `backpack.js`): se suman a sus 8 de fábrica y valen lo mismo que las
   *   mejoras, solo si se sentó el Axie que se pidió.
   *
   *   `evolved` y `evolved2` son las partes evolucionadas de cada uno (ver
   *   `evolution.js`). No van aparte: se meten en el id del Axie (`'buba~horn'`, ver
   *   `evolvedId`), y de ahí salen solos el mazo, el dibujo y la revancha, que reparte
   *   con `state.axies`. Sin ellas, el id se queda como vino.
   */
  function newMatch({
    difficulty, mode, axie: axieId, axie2: axieId2, boosts, boosts2, extras, extras2, evolved, evolved2,
    activePowers, adventureLevel, scriptedDecks, scriptedPool, onRoundStart, stage,
  } = {}) {
    mode = mode ?? state?.mode ?? 'cpu';
    const advCfg = mode === 'adventure'
      ? getAdventureLevel(adventureLevel ?? state?.adventure?.level ?? 1)
      : null;
    difficulty = difficulty ?? advCfg?.difficulty ?? state?.difficulty ?? 'normal';
    const withParts = (id, parts) => (parts && id ? evolvedId(id, parts) : id);
    const mine = axie(withParts(axieId, evolved) ?? state?.axies.p1 ?? 'aquatic');
    // El Axie que pidió el segundo asiento, que solo existe en una sala o en el tutorial:
    // ahí vale tal cual para mantener el guión contra el Axie indicado.
    const wanted = (mode === 'net' || mode === 'tutorial')
      ? (withParts(axieId2, evolved2) ?? state?.axies.p2)
      : (mode === 'adventure' ? (advCfg?.rival ?? axieId2 ?? state?.axies.p2) : null);
    // El sorteo, para cuando no hay nadie que haya elegido: el de la CPU, y el del
    // asiento que entró a la sala sin pasar por la elección. Ese sí es de otra clase,
    // que es lo mismo que decir de otro mazo: al que juega solo, verse en el espejo no
    // le agrega nada.
    const rivals = AXIE_IDS.filter((id) => AXIES[id].class !== mine.class);
    // En la Aventura el rival es un starter, que no está en el roster pero `axie()` conoce.
    const known = mode === 'adventure'
      ? axie(wanted).id === wanted
      : AXIE_IDS.includes(String(wanted).split('~')[0]) && axie(wanted).id === wanted;
    const theirs = known ? axie(wanted) : AXIES[rivals[Math.floor(rng() * rivals.length)]];
    // Las mejoras de cada asiento. Las del segundo solo valen si de verdad se sentó el
    // Axie que se pidió: si salió sorteado —contra la CPU, o porque el pedido no era
    // válido—, es otro bicho y las mejoras eran del anterior.
    const bags = {
      p1: boosts ?? state?.boosts?.p1 ?? {},
      p2: (theirs.id === wanted ? (boosts2 ?? state?.boosts?.p2) : null) ?? {},
    };
    // Las cartas de la mochila de cada asiento, con la misma regla que las mejoras. El
    // rival de la Aventura trae las de su nivel (ver `RIVAL_LADDER` en `adventure.js`).
    const packs = {
      p1: cleanExtras(extras ?? state?.extras?.p1),
      p2: advCfg ? cleanExtras(advCfg.extras)
        : theirs.id === wanted ? cleanExtras(extras2 ?? state?.extras?.p2) : [],
    };

    // El mazo de fábrica de cada uno, armado una sola vez y guardado tal cual: de acá
    // sale el que se baraja para jugar, y la copia sin barajar es la que se mira en el
    // panel del mazo. Tiene que ser **el mismo** armado y no dos llamadas a `deckFor`,
    // porque cada llamada crea cartas nuevas con uid nuevos y entonces el panel no
    // podría reconocer las que están en juego.
    const powers = activePowers || (advCfg ? adventurePowers(advCfg) : chooseActivePowers(rng));
    // Las partes con amuleto de un jefe de la Aventura llevan un poder de su pozo,
    // sorteado en cada partida (ver `adventureCharms`).
    const charm = advCfg ? adventureCharms(advCfg) : null;
    const start = {
      p1: [...deckFor(mine.id, bags.p1), ...extraCards(packs.p1)],
      p2: [...deckFor(theirs.id, bags.p2, null, { charm }), ...extraCards(packs.p2)],
    };

    epoch++;
    clearTimeout(alarm);
    state = {
      // Qué partida es esta. La pantalla lo mira para olvidar lo que traía de la
      // anterior —cartas ya animadas, el último número del golpe— y con la partida en
      // red es la única forma que tiene de enterarse: la puede haber arrancado el otro.
      match: epoch,
      difficulty,
      mode,
      axies: { p1: mine.id, p2: theirs.id },
      // Dónde se pelea (ver `stages.js`): el del nivel en la Aventura, la plaza en el
      // tutorial y uno al azar en cada partida suelta. Va en el estado para que en red
      // las dos pantallas estén paradas en el mismo lugar.
      stage: isStage(stage) ? stage
        : advCfg?.stage ?? (mode === 'tutorial' ? TUTORIAL_STAGE : pickStage(stageRng)),
      // Las mejoras puestas, guardadas para que "Jugar de nuevo" reparta el mismo mazo
      // sin que la portada tenga que volver a mandarlas.
      boosts: bags,
      // Y las cartas de la mochila, por lo mismo.
      extras: packs,
      // La clase del Axie es el símbolo con el que puntúa; el resto del juego usa esto.
      symbols: { p1: mine.class, p2: theirs.class },
      round: 0,
      activePowers: powers,
      pool: scriptedPool ? scriptedPool.slice() : deal(buildPool(powers, rng)),
      market: [], // las 6 cartas a la vista, se llena abajo
      decks: scriptedDecks
        ? { p1: scriptedDecks.p1.slice(), p2: scriptedDecks.p2.slice() }
        : { p1: deal(start.p1), p2: deal(start.p2) },
      // Las diez de fábrica, en el orden en que las arma la clase, y lo que cada uno se
      // fue llevando del centro, en el orden en que lo agarró. Ninguna de las dos las
      // usa la partida: son para el panel que se abre tocando un Axie, que es el único
      // lugar donde el mazo se mira entero.
      //
      // Están acá y no se calculan de `decks` porque `decks` se baraja de una ronda a
      // la otra: la misma pregunta contestada dos veces daría dos órdenes distintos, y
      // una lista que se reordena sola cada ronda se lee como un error. Juntas son
      // todo lo que tiene el jugador, que es lo que cuenta `ownedBy` por el otro lado.
      start,
      added: { p1: [], p2: [] },
      // La carta que atrapó la burbuja, esperando para abrir la ronda siguiente.
      bubbleCard: { p1: null, p2: null },
      // Cuántas cartas de la cadena en curso ya volvieron al mazo (ver `draw`).
      recycled: { p1: 0, p2: 0 },
      // Si la cadena entera ya volvió al mazo, al terminar el turno de ese jugador.
      returned: { p1: false, p2: false },
      totals: { p1: 0, p2: 0 },
      // La vida con la que arranca cada uno: la de siempre, salvo el jefe de un nivel de
      // la Aventura, que trae más (ver `hp` en `adventure-levels.js`).
      maxHp: {
        p1: mode === 'tutorial' ? TUTORIAL_TARGET : TARGET,
        p2: mode === 'tutorial' ? TUTORIAL_TARGET : (advCfg?.hp ?? TARGET),
      },
      // Vida recuperada con la maceta. Va aparte de `totals` porque `totals` es
      // "daño repartido" y se usa para juzgar el intercambio, no para la vida.
      healed: { p1: 0, p2: 0 },
      // Las marcas de la partida: el ataque más fuerte que soltó cada uno y la cadena más
      // larga con la que atacó. La partida no las usa; son para la pantalla del final
      // (ver `result.js`), y se anotan acá porque después del golpe ya no se pueden
      // reconstruir: la cadena vuelve al mazo.
      records: { p1: { hit: 0, chain: 0 }, p2: { hit: 0, chain: 0 } },
      // Lo que hizo cada uno, para las misiones (ver `emptyStats`).
      stats: { p1: emptyStats(), p2: emptyStats() },
      // Lo que dejan puesto las cartas con poder (ver `emptyStatus`).
      status: { p1: emptyStatus(), p2: emptyStatus() },
      // Los huevos que ya se rompieron este turno (uid): se vacía al empezar el turno.
      hatched: { p1: [], p2: [] },
      chains: { p1: emptyChain(), p2: emptyChain() },
      roundScores: { p1: null, p2: null },
      // Si cada uno ya soltó el golpe de su última chance (ver `lastChance`).
      lastChanceUsed: { p1: false, p2: false },
      // "¿Una más?" (ver `oneMoreOf`): `{ id, player, stage }`. `stage` es 'ask' mientras
      // se anuncia; 'bust' si la carta cortó, o 'draw' si enganchó y está cayendo (ver
      // `ONE_MORE_LAND`), y al caer 'ko' o 'short' según si el golpe ya es K.O. directo.
      // La UI compara `id` y `stage` con lo que ya mostró, como con `lastHit`.
      oneMore: null,
      oneMoreId: 0,
      // El Secret Egg que está perdonando un corte (ver `saveWithEgg`): `{ id, player,
      // card, egg, stage }`, con `card` la que cortaba, `egg` el uid de la carta del huevo
      // y `stage` 'bust', 'crack' o 'back' (ver `EGG_SAVE`). Mientras dura, la carta no
      // está ni en la cadena ni en el mazo: la pantalla la dibuja aparte.
      eggSave: null,
      eggSaveId: 0,
      // La cuenta atrás del K.O. de quien juega, como quedó con su última carta que
      // enganchó: `{ player, n }` (ver `koInOf` y `countDown`). `n` es `null` si faltan
      // más de `KO_COUNTDOWN`.
      koCount: null,
      // Quién abre, para toda la partida. Contra la CPU es fijo a propósito (abajo);
      // entre dos personas se sortea.
      order: mode === 'net' && rng() < 0.5 ? ['p2', 'p1'] : ['p1', 'p2'],
      turn: null,
      phase: 'turn', // 'turn' | 'draft' | 'roundEnd' | 'matchEnd'
      draft: null,
      busy: false,
      // Lo que le queda a quien tiene que decidir (ver `armClock`), o `null`.
      clock: null,
      roundWinner: null,
      // Quién se fue y quién ganó con eso, si la partida terminó por abandono (ver
      // `forfeit`). Mientras nadie se vaya, `null`.
      forfeit: null,
      // Último golpe resuelto. La UI compara `id` con el que ya animó: mientras no
      // cambie no vuelve a sacudir a nadie, aunque el tablero se repinte diez veces.
      lastHit: null,
      hitId: 0,
      // El recorrido de la cadena, mientras dura: quién ataca y cuánto tarda en
      // recorrerse. La UI compara `id` con el que ya dibujó, igual que con `lastHit`.
      aiming: null,
      aimId: 0,
      // Los poderes que acaban de actuar y tienen animación propia (ver `POWER_BEAT`):
      // `{ id, player, fx: [{ power, moment, on, amount }] }`, en el orden en que se
      // muestran. `on` es el asiento sobre el que cae. Como `lastHit`, la UI compara `id`.
      powerFx: null,
      powerFxId: 0,
      // Si la bebida (Energy Drink) ya se volcó sobre el daño de la cadena de cada uno. La
      // bebida cuenta en el golpe desde que entra a la cadena, pero se ve recién al
      // plantarse: hasta entonces el número grande la deja afuera (ver `finishTurn`).
      poured: { p1: false, p2: false },
      // El Rocket Stamp recién robado que espera columna: `{ player, card }`.
      pendingStack: null,
      // La Novice Spell que espera que su dueño elija qué hace: `{ player, count }`.
      pendingSpell: null,
      // Lo que la Lens of Revelation le muestra a su dueño: `{ id, player, cards }`, las
      // de arriba del mazo en el orden en que van a salir. Se borra al cerrar su turno.
      peek: null,
      peekId: 0,
      // La cadena como quedó con la última Scotch Tape, por si se corta (ver `saveWithTape`).
      taped: { p1: null, p2: null },
      lastStacked: null,
      stackId: 0,
      log: [],
      logId: 0,
      // El tutorial: una partida guionada donde el mazo y la reserva están puestos a
      // mano. `tutorial` marca la partida como tal y `onRoundStart` es un gancho que el
      // motor del tutorial engancha para poner los mazos de cada ronda antes de que se
      // repartan. Sin este gancho, `startRound` barajaría todo y se perdería el guión.
      tutorial: mode === 'tutorial',
      tutorialAllowed: null,
      tutorialAllowedCard: null,
      tutorialDisallowSkip: false,
      tutorialAllowRenew: false,
      tutorialPlainOnly: false,
      tutorialOwnColor: false,
      tutorialSkipDraft: false,
      tutorialBotStandAt: null,
      tutorialAllowedCol: null,
      onRoundStart,
      adventure: advCfg ? {
        level: advCfg.id,
        name: levelTitle(advCfg),
        newPowers: advCfg.newPowers,
        rival: advCfg.rival,
        boss: advCfg.boss,
        evolved: advCfg.evolved,
      } : null,
    };
    refillMarket();
    const versus = tr('{mine} contra {theirs}', {
      mine: `${mine.name} ${crest(mine.class, 'sm')}`,
      theirs: `${theirs.name} ${crest(theirs.class, 'sm')}`,
    });
    const hp = maxHpOf(state, 'p1') === maxHpOf(state, 'p2')
      ? tr('{target} de vida cada uno.', { target: maxHpOf(state, 'p1') })
      : tr('{p1} de vida contra {p2}.', { p1: maxHpOf(state, 'p1'), p2: maxHpOf(state, 'p2') });
    log(
      mode === 'net' ? tr('{versus}, dos jugadores. {hp}', { versus, hp })
        : advCfg ? tr('Modo Aventura ({name}): {versus}. {hp}', { name: levelTitle(advCfg), versus, hp })
        : tr('Jugás con {versus}. {hp}', { versus, hp }),
      'muted',
    );
    return startRound(epoch);
  }

  async function startRound(era) {
    state.round++;
    // En el tutorial, el motor pone los mazos de cada ronda a mano antes de que se
    // repartan. Sin esto `deal` barajaría todo y se perdería el guión. La ronda 1 ya
    // tiene los mazos puestos por `scriptedDecks` en `newMatch`; las siguientes las
    // pone el gancho `onRoundStart` si existe.
    if (state.tutorial) {
      state.onRoundStart?.(state.round);
    } else {
      // Se rebaraja todo el mazo propio: lo de la ronda pasada y lo que se sumó del centro.
      for (const player of PLAYERS) state.decks[player] = deal(state.decks[player]);
    }
    state.recycled = { p1: 0, p2: 0 };
    state.returned = { p1: false, p2: false };
    state.chains = { p1: emptyChain(), p2: emptyChain() };
    state.poured = { p1: false, p2: false };
    state.taped = { p1: null, p2: null };
    state.peek = null;
    state.pendingSpell = null;
    state.roundScores = { p1: null, p2: null };
    state.roundWinner = null;
    state.draft = null;
    state.phase = 'turn';
    state.pendingStack = null;
    // El orden no se toca: es el que se sorteó al empezar la partida y vale para todas
    // las rondas. Antes se alternaba entre rondas, y como la ronda es un turno de cada
    // lado el orden que se veía de verdad era p1, p2 · p2, p1 · p1, p2: en cada cambio
    // de ronda el mismo bicho jugaba dos veces seguidas.
    //
    // La ventaja de cerrar —ver el golpe del otro antes de decidir— se la queda siempre
    // el segundo. Contra la CPU se la queda ella a propósito: es el lado que no la
    // necesita, y ahí el orden es fijo porque con él se midió todo el balance de los
    // poderes. Entre dos personas no hay ningún lado que la merezca, así que se sortea
    // al empezar (ver `newMatch`) — el que abre es el que le tocó, no el que se sentó
    // primero.
    log(tr('Ronda {round}', { round: state.round }), 'round');
    emit();
    if (!(await tick(350, era))) return;
    // Con alguien en su última chance la ronda es solo de él: al que abre lo mataron
    // cerrando el intercambio anterior, y su golpe es lo último de la partida.
    await beginTurn((!state.tutorial && lastChance(state)) || state.order[0], era);
  }

  /**
   * Suma daño repartido por `by`. En el tutorial la CPU nunca deja al jugador por debajo
   * de 20: el guión necesita que llegue entero a la ronda 5.
   */
  function addDamage(by, amount) {
    state.totals[by] += amount;
    if (state.tutorial && by === 'p2') {
      state.totals.p2 = Math.min(state.totals.p2, Math.max(0, maxHpOf(state, 'p1') + state.healed.p1 - 20));
    }
  }

  /**
   * La cuenta atrás después de una carta que enganchó (o de la que abre el turno, con
   * `opened`): la de la racha más larga recalculada, pero nunca para atrás —baja por lo
   * menos uno— y sin bajar de 1 mientras el golpe no lo tumbe (ver `koInOf`).
   */
  function countDown(player, opened = false) {
    const fresh = koProjection(state, player) ?? Infinity;
    const prev = !opened && state.koCount?.player === player ? state.koCount.n ?? Infinity : Infinity;
    const n = fresh === 0 ? 0 : Math.max(1, Math.min(prev - 1, fresh));
    state.koCount = { player, n: Number.isFinite(n) ? n : null };
  }

  /** Monta el Rocket Stamp `card` sobre la columna `col` de la cadena de `player`. */
  function stackCard(player, col, card) {
    state.chains[player] = stackOnCard(state.chains[player], col, card);
    state.lastStacked = { player, colIndex: col, card, id: ++state.stackId };
    statsOf(player).stacks++;
    countDown(player);
    const stackMsg = voice(player).you
      ? tr('Vos montás {card} sobre la columna {col} alargándola → ataque de {swing}', {
          card: cardLabel(card),
          col: col + 1,
          swing: swingOf(state, player),
        })
      : tr('{who} monta {card} sobre la columna {col} alargándola → ataque de {swing}', {
          who: who(player),
          card: cardLabel(card),
          col: col + 1,
          swing: swingOf(state, player),
        });
    log(`${powerIcon('freegame', 'sm')} ${stackMsg}`, player);
  }

  /**
   * Juega `card` en la cadena de `player`. Si la corta, deja la carta a la vista
   * (`BUST_HOLD`, o `ms` × 3 en el tutorial), cierra el turno en 0 y devuelve false.
   */
  async function extend(player, card, ms, era) {
    const next = playCard(state.chains[player], card);
    // El Secret Egg: con un huevo sano en la mesa, el corte no pasa (ver `saveWithEgg`).
    if (next.busted && eggsLeft(state, player) > 0) return saveWithEgg(player, card, era);
    // La Scotch Tape: sin huevo, la cadena queda pegada hasta la última cinta y ataca.
    if (next.busted && state.taped?.[player]) return saveWithTape(player, card, era);
    state.chains[player] = next;
    if (!next.busted && card.power === 'tape') state.taped[player] = next;
    if (next.busted) {
      if (state.oneMore?.player === player && state.oneMore.stage === 'ask') {
        state.oneMore = { ...state.oneMore, stage: 'bust' };
      }
      log(bustLine(player, card), 'bad');
      emit();
      // La carta que cortó se queda a la vista hasta que la cadena se rompe en pantalla
      // (`BUST_HOLD`); en el tutorial, un rato más.
      // La de "¿una más?" tarda más en caer (ver `ONE_MORE_LAND`).
      const epic = state.oneMore?.player === player && state.oneMore.stage === 'bust' ? ONE_MORE_LAND : 0;
      if (await tick(state.tutorial ? Math.max(BUST_HOLD, ms * 3) : BUST_HOLD + epic, era)) await finishTurn(player, 0, era);
      return false;
    }
    countDown(player);
    const swingText = voice(player).you
      ? tr('Vos sacás {card} → ataque de {swing}', { card: cardLabel(card), swing: swingOf(state, player) })
      : tr('{who} saca {card} → ataque de {swing}', { who: who(player), card: cardLabel(card), swing: swingOf(state, player) });
    log(swingText, player);
    return true;
  }

  /**
   * El Secret Egg perdona el corte, y se ve: la carta cae y corta, el huevo de la mesa
   * se rompe y la carta vuelve al mazo —puede volver a salir— (ver `EGG_SAVE`). Después
   * sigue el turno: el jugador decide si roba otra o se planta. El reloj se frena
   * mientras tanto, como en "¿una más?". Devuelve 'saved', o false si la partida cambió.
   */
  async function saveWithEgg(player, card, era) {
    const egg = unstack(state.chains[player].cards)
      .find((c) => c.power === 'egg' && !state.hatched[player].includes(c.uid));
    const left = state.clock?.seat === player ? Math.max(state.clock.ends - Date.now(), 0) : null;
    stopClock();
    if (state.oneMore?.player === player) state.oneMore = null;
    state.eggSave = { id: ++state.eggSaveId, player, card, egg: egg.uid, stage: 'bust' };
    emit();
    if (!(await tick(EGG_SAVE.bust, era))) return false;
    state.hatched[player].push(egg.uid);
    state.eggSave = { ...state.eggSave, stage: 'crack' };
    // `col`: la columna de la carta del huevo, que es donde se rompe (ver `power-fx.js`).
    const col = state.chains[player].cards.findIndex((c) => unstack([c]).includes(egg));
    stageFx({ power: 'egg', moment: 'save', by: player, on: player, amount: eggsLeft(state, player), col });
    log(`${powerIcon('egg', 'sm')} ${tr('Secret Egg: {card} cortaba, pero el huevo se rompe y la carta vuelve al mazo. Sigue el turno.', { card: cardLabel(card) })}`, player);
    emit();
    if (!(await tick(EGG_SAVE.crack, era))) return false;
    state.eggSave = { ...state.eggSave, stage: 'back' };
    emit();
    if (!(await tick(EGG_SAVE.back, era))) return false;
    // La medusa no vuelve: el huevo salva el turno, pero ella se rompió al salir.
    const deck = state.decks[player];
    if (!card.jelly) deck.splice(Math.floor(rng() * (deck.length + 1)), 0, card.mirrorOf ?? card);
    state.eggSave = null;
    if (left !== null) armClock(player, 'turn', left);
    return 'saved';
  }

  /**
   * La Scotch Tape perdona el corte a medias: la cadena vuelve a como estaba con la última
   * cinta y el turno termina atacando con eso. Lo que salió después de la cinta y la carta
   * que cortó vuelven al mazo. No hay centro (ver `awardKindOf`), salvo la carta de
   * regalo de la Earth Stamp. Devuelve false: el turno se cerró.
   */
  async function saveWithTape(player, card, era) {
    const cur = state.chains[player];
    const snap = state.taped[player];
    state.taped[player] = null;
    const keep = new Set(unstack(snap.cards).map((c) => c.uid));
    const played = unstack(cur.cards);
    const rec = state.recycled[player];
    // Las que ya volvieron al mazo con un rebarajado siguen ahí; las demás, de la cinta
    // para adelante, vuelven ahora. La cuenta de devueltas queda la de la cadena pegada.
    state.decks[player].push(...played.slice(rec).filter((c) => !keep.has(c.uid) && !c.jelly));
    state.recycled[player] = played.slice(0, rec).filter((c) => keep.has(c.uid)).length;
    if (!card.jelly) state.decks[player].push(card.mirrorOf ?? card);
    state.chains[player] = { ...snap, taped: true, tapeCut: card };
    if (state.oneMore?.player === player) state.oneMore = null;
    stageFx({ power: 'tape', moment: 'save', by: player, on: player, amount: unstack(snap.cards).length });
    log(`${powerIcon('tape', 'sm')} ${voice(player).you
      ? tr('Scotch Tape: {card} cortaba, pero la cadena queda pegada hasta la cinta. Atacás con eso.', { card: cardLabel(card) })
      : tr('Scotch Tape: {card} cortaba, pero la cadena queda pegada hasta la cinta. {who} ataca con eso.', { card: cardLabel(card), who: who(player) })}`, player);
    emit();
    if (await tick(BUST_HOLD, era)) await finishTurn(player, scoreChain(state.chains[player]).total, era);
    return false;
  }

  /**
   * El Red Mirror copia los símbolos de la carta anterior de la cadena: lo que se juega
   * es una copia (`mirrorOf` apunta al espejo, que es lo que vuelve al mazo). Si abre la
   * ronda, va con los suyos.
   */
  function mirrored(player, card) {
    const chain = state.chains[player];
    if (card.power !== 'mirror' || chain.cards.length === 0) return card;
    const prev = chain.cards.at(-1);
    stageFx({ power: 'mirror', moment: 'draw', by: player, on: player, amount: 1, col: chain.cards.length - 1 });
    powerLog('mirror', tr('Red Mirror: copia {card}.', { card: cardLabel(prev) }), player);
    return { ...card, symbols: prev.symbols.slice(), mirrorOf: card };
  }

  /**
   * La Novice Spell: `kind` es lo que eligió su dueño —`'heal'`, `'shield'` o `'hit'`—,
   * por cada copia. El golpe va directo a la vida, como la pluma.
   */
  function castSpell(player, kind, count) {
    const foe = other(player);
    const amount = count * TUNING.spellAmount;
    let got = 0;
    if (kind === 'heal') got = heal(player, amount);
    else if (kind === 'shield') got = gainShield(player, amount);
    else {
      kind = 'hit';
      got = amount;
      addDamage(player, amount);
      statsOf(player).direct += amount;
    }
    stageFx({ power: 'spell', moment: 'cast', by: player, on: kind === 'hit' ? foe : player, amount: got, kind });
    powerLog('spell', kind === 'heal'
      ? tr('Novice Spell: cura {got} a {who}.', { got, who: whom(player) })
      : kind === 'shield'
        ? tr('Novice Spell: +{got} de escudo para {who}.', { got, who: whom(player) })
        : tr('Novice Spell: {got} de daño {target} (queda en {hp}).', { got, target: toWhom(foe), hp: hpOf(state, foe) }), player);
  }

  /** La CPU: se cura si está baja y tiene lugar; si no, pega. */
  function botSpell(player) {
    const hp = hpOf(state, player);
    const max = maxHpOf(state, player);
    if (hp > 0 && hp <= max * 0.4 && max - hp >= TUNING.spellAmount) return 'heal';
    return 'hit';
  }

  /** La Novice Spell que quedó sin elegir sale como golpe (se atacó, se cortó o se robó). */
  function settleSpell(player) {
    const pending = state.pendingSpell;
    if (pending?.player !== player) return;
    state.pendingSpell = null;
    castSpell(player, 'hit', pending.count);
  }

  /**
   * "¿Una más?" antes de robar (ver `oneMoreOf`): se anuncia, la mesa lo muestra
   * `ONE_MORE_MS` y recién ahí sale la carta. El reloj del turno se frena mientras
   * tanto —el que apretó robar ya decidió— y vuelve con lo que le quedaba. Devuelve
   * false si la partida cambió en el medio.
   */
  async function askOneMore(player, era) {
    const left = state.clock?.seat === player ? Math.max(state.clock.ends - Date.now(), 0) : null;
    stopClock();
    state.oneMore = { id: ++state.oneMoreId, player, stage: 'ask' };
    const askMsg = voice(player).you
      ? tr('¿Una más? Estás a una carta del K.O. directo.')
      : tr('¿Una más? {who} está a una carta del K.O. directo.', { who: who(player) });
    log(askMsg, 'round');
    emit();
    if (!(await tick(ONE_MORE_MS, era))) return false;
    if (left !== null) armClock(player, 'turn', left);
    return true;
  }

  /**
   * La carta de "¿una más?" enganchó: si el golpe ya es K.O. directo (overkill, sin
   * última chance para el rival), ataca solo. Si no, el turno sigue. Devuelve true si
   * el turno se cerró acá.
   */
  async function settleOneMore(player, era) {
    // Primero la carta, que sale en cámara lenta: se la deja caer y asentarse.
    state.oneMore = { ...state.oneMore, stage: 'draw' };
    emit();
    if (!(await tick(ONE_MORE_LAND + 250, era))) return true;
    const ko = directKo(state, player);
    state.oneMore = { ...state.oneMore, stage: ko ? 'ko' : 'short' };
    if (!ko) return false;
    statsOf(player).oneMoreKo++;
    const points = scoreChain(state.chains[player]).total;
    log(voice(player).you
      ? tr('¡Una más y K.O. directo! Atacás con {points}.', { points })
      : tr('¡Una más y K.O. directo! {who} ataca con {points}.', { who: who(player), points }), player);
    await finishTurn(player, points, era);
    return true;
  }

  /** La Pluma Sagrada pega apenas sale del mazo, una vez por cada pluma de la carta. */
  function applyFeathers(player, count) {
    if (count === 0) return;
    const foe = other(player);
    const dmg = count * TUNING.featherDamage;
    state.totals[player] += dmg;
    statsOf(player).direct += dmg;
    state.lastHit = {
      id: ++state.hitId,
      by: player,
      target: foe,
      amount: dmg,
      blocked: 0,
      broke: false,
      kind: 'feather',
    };
    const featherMsg = voice(foe).you
      ? tr('Pluma Sagrada le pega a vos por {dmg}: quedás en {hp}.', { dmg, hp: hpOf(state, foe) })
      : tr('Pluma Sagrada le pega {target} por {dmg}: queda en {hp}.', { target: toWhom(foe), dmg, hp: hpOf(state, foe) });
    log(`${powerIcon('feather', 'sm')} ${featherMsg}`, player);
  }

  /** Cuántas copias de cada poder trae `cards`. */
  function countPowers(player, cards) {
    const counts = {};
    for (const c of unstack(cards)) if (c.power) counts[c.power] = (counts[c.power] ?? 0) + 1;
    return counts;
  }

  /** Una línea del registro para un poder: su amuleto y el texto. */
  const powerLog = (power, text, kind) => log(`${powerIcon(power, 'sm')} ${text}`, kind);

  /**
   * Lo que se lleva el escudo de `target` de un daño de `amount`, y lo que pasa: el
   * escudo aguanta primero y lo que sobra llega a la vida. Devuelve lo que llegó a la
   * vida. La almohada no entra: frena ataques, no poderes.
   */
  function throughShield(by, target, amount) {
    const st = state.status[target];
    const blocked = Math.min(st.egg, amount);
    st.egg -= blocked;
    const landed = amount - blocked;
    addDamage(by, landed);
    return landed;
  }

  /**
   * Los poderes que actúan apenas sale la carta, se corte o no la cadena después: el
   * Pájaro (pluma, abanico), el Bubble Maker, la daga de Buba, la garra de Charm of
   * Power, el escáner, los guantes y el filo. Cada copia suma lo suyo.
   */
  function onDraw(player, card) {
    const foe = other(player);
    const mine = state.status[player];
    const theirs = state.status[foe];
    const n = countPowers(player, [card]);
    const drawn = statsOf(player).powers;
    for (const [power, copies] of Object.entries(n)) {
      const cls = POWERS[power]?.symbol;
      if (cls) drawn[cls] = (drawn[cls] ?? 0) + copies;
    }

    applyFeathers(player, n.feather ?? 0);

    if (n.strength) {
      const before = mine.claws;
      mine.claws = Math.min(TUNING.clawsMax, mine.claws + n.strength);
      stageFx({ power: 'strength', moment: 'draw', by: player, on: player, amount: mine.claws - before });
      powerLog('strength', tr('Charm of Power: {claws} de {max} garras. Cada golpe que conecte pone {bleed} de sangrado.', { claws: mine.claws, max: TUNING.clawsMax, bleed: mine.claws * TUNING.clawBleed }), player);
    }
    if (n.rage) {
      const before = mine.rage;
      mine.rage = Math.min(TUNING.rageMax, mine.rage + n.rage);
      stageFx({ power: 'rage', moment: 'draw', by: player, on: player, amount: mine.rage - before });
      powerLog('rage', mine.rage >= TUNING.rageMax
        ? tr('Mask of Frenzy: ¡Furia! El próximo golpe que conecte suma +{dmg}.', { dmg: rageBonusOf(mine) })
        : tr('Mask of Frenzy: {rage} de Rage, +{dmg} de daño en cada golpe.', { rage: mine.rage, dmg: rageBonusOf(mine) }), player);
    }
    if (n.fan) {
      const before = mine.feathers;
      mine.feathers = Math.min(TUNING.fanMax, mine.feathers + n.fan);
      stageFx({ power: 'fan', moment: 'draw', by: player, on: player, amount: mine.feathers - before });
      powerLog('fan', tr('Feather Fan: {feathers} plumas para el próximo golpe.', { feathers: mine.feathers }), player);
    }
    if (n.maker) {
      mine.bomb += n.maker;
      stageFx({ power: 'maker', moment: 'draw', by: player, on: player, amount: mine.bomb });
      powerLog('maker', tr('Bubble Maker: {bubbles} de {at} burbujas.', { bubbles: Math.min(mine.bomb, TUNING.bombAt), at: TUNING.bombAt }), player);
      while (mine.bomb >= TUNING.bombAt) {
        mine.bomb -= TUNING.bombAt;
        const landed = throughShield(player, foe, TUNING.bombDamage);
        stageFx({ power: 'maker', moment: 'bomb', by: player, on: foe, amount: landed });
        powerLog('maker', tr('¡Bomba de burbujas! {dmg} de daño {target} (queda en {hp}).', { dmg: landed, target: toWhom(foe), hp: hpOf(state, foe) }), player);
      }
    }
    if (n.dagger) addBleed(player, foe, n.dagger * TUNING.daggerBleed, 'dagger', 'draw');
    if (n.scanner) {
      for (let i = 0; i < n.scanner; i++) {
        const took = theirs.egg;
        theirs.egg = 0;
        statsOf(player).stolen += took;
        const got = gainShield(player, took > 0 ? took : TUNING.scannerShield);
        stageFx({ power: 'scanner', moment: 'draw', by: player, on: player, amount: got, took });
        powerLog('scanner', took > 0
          ? tr('Metal Scanner: le saca {took} de escudo {target} y gana {got}.', { took, target: toWhom(foe), got })
          : tr('Metal Scanner: el rival no tenía escudo, gana {got}.', { got }), player);
      }
    }
    if (n.gloves) {
      // Veneno para los dos: el del rival lo puede frenar su Limpiador; el propio no,
      // y al final de este turno cura en vez de dañar (ver `tickPoison`).
      addPoison(player, foe, TUNING.glovesPoison, 'gloves', 'draw', n.gloves);
      const before = mine.poison;
      mine.poison = Math.min(TUNING.poisonMax, mine.poison + n.gloves * TUNING.glovesPoison);
      mine.antidote = 1;
      stageFx({ power: 'gloves', moment: 'self', by: player, on: player, amount: mine.poison - before });
      powerLog('gloves', tr('Gloves of Infection: {n} de veneno para {who} también; al final de este turno le cura.', { n: mine.poison - before, who: whom(player) }), player);
    }
    if (n.edge) {
      const got = addSpikes(player, n.edge * TUNING.edgeSpikes);
      stageFx({ power: 'edge', moment: 'draw', by: player, on: player, amount: got });
      powerLog('edge', tr('Sharp Edge: {spikes} espinas.', { spikes: mine.spikes }), player);
    }
    if (n.focus) {
      const before = mine.focus;
      mine.focus = Math.min(TUNING.focusMax, mine.focus + n.focus);
      stageFx({ power: 'focus', moment: 'draw', by: player, on: player, amount: (mine.focus - before) * TUNING.focusStep });
      powerLog('focus', tr('Charm of Focus: +{dmg} de daño en cada ataque, para toda la partida.', { dmg: mine.focus * TUNING.focusStep }), player);
    }
    if (n.lens) {
      const deck = state.decks[player];
      const cards = deck.slice(-n.lens * TUNING.lensCards).reverse();
      state.peek = cards.length ? { id: ++state.peekId, player, cards } : null;
      stageFx({ power: 'lens', moment: 'draw', by: player, on: player, amount: cards.length });
      powerLog('lens', voice(player).you
        ? tr('Lens of Revelation: ves las {n} cartas que siguen.', { n: cards.length })
        : tr('Lens of Revelation: {who} mira las {n} cartas que siguen.', { who: who(player), n: cards.length }), player);
    }
    if (n.spell) {
      if (isBot(player)) castSpell(player, botSpell(player), n.spell);
      else {
        const count = (state.pendingSpell?.player === player ? state.pendingSpell.count : 0) + n.spell;
        state.pendingSpell = { player, count };
        powerLog('spell', voice(player).you
          ? tr('Novice Spell: elegí curarte, escudarte o pegarle.')
          : tr('Novice Spell: {who} elige qué hace.', { who: who(player) }), player);
      }
    }
  }

  async function beginTurn(player, era) {
    state.hatched[player] = [];
    state.taped[player] = null;
    state.peek = null;
    state.status[player].stamps = 0;
    // El bloqueo de la víbora dura el turno en que se cerró la cura (ver `heal`).
    for (const p of PLAYERS) state.status[p].healShut = 0;
    // Las hojas curan y el capullo escuda antes de robar: se ve solo, con la mesa
    // quieta, y no encimado con el golpe y los poderes del final del turno. `turn`
    // sigue vacío mientras tanto, así que nadie puede robar ni plantarse en el medio.
    // Sin vida no hay cura: las hojas esperan (ver `heal`).
    if (state.status[player].leaf > 0 && hpOf(state, player) > 0) {
      tickLeaf(player);
      emit();
      if (!(await tick(Math.max(1000, POWER_BEAT.leaf.tick), era))) return;
    }
    if (state.status[player].cocoon > 0) {
      tickCocoon(player);
      emit();
      if (!(await tick(Math.max(900, POWER_BEAT.cocoon.tick), era))) return;
    }
    if (lastChance(state) === player) {
      const lcMsg = voice(player).you
        ? tr('Última chance: a vos no le queda vida, pero sí este golpe. Si deja sin vida {foe}, empatan.', { foe: toWhom(other(player)) })
        : tr('Última chance: {target} no le queda vida, pero sí este golpe. Si deja sin vida {foe}, empatan.', { target: toWhom(player), foe: toWhom(other(player)) });
      log(lcMsg, 'round');
    }
    state.turn = player;
    state.oneMore = null;
    state.eggSave = null;
    armClock(player, 'turn');
    let card;
    const bubble = state.bubbleCard[player];
    if (bubble) {
      // La carta de la burbuja abre la ronda; con varias burbujas se le funden encima
      // las primeras del mazo en una carta gigante.
      state.bubbleCard[player] = null;
      // Es la primera carta del turno: como cualquier robo, cuesta sangrado y sale
      // apagada si el Trickster la eligió en la burbuja.
      reveal(player, bubble.card);
      const extra = [];
      for (let i = 1; i < bubble.count; i++) extra.push(draw(player));
      card = extra.length === 0 ? bubble.card : {
        ...bubble.card,
        symbols: [...bubble.card.symbols, ...extra.flatMap((c) => c.symbols)],
        stackedCards: [bubble.card, ...extra],
      };
      const bubbleMsg = extra.length
        ? (extra.length === 1
            ? (voice(player).you
                ? tr('Vos abrís con {card} y 1 carta más en una carta gigante', { card: cardLabel(bubble.card) })
                : tr('{who} abre con {card} y 1 carta más en una carta gigante', { who: who(player), card: cardLabel(bubble.card) }))
            : (voice(player).you
                ? tr('Vos abrís con {card} y {count} cartas más en una carta gigante', { card: cardLabel(bubble.card), count: extra.length })
                : tr('{who} abre con {card} y {count} cartas más en una carta gigante', { who: who(player), card: cardLabel(bubble.card), count: extra.length })))
        : (voice(player).you
            ? tr('Vos abrís con {card} de la burbuja', { card: cardLabel(bubble.card) })
            : tr('{who} abre con {card} de la burbuja', { who: who(player), card: cardLabel(bubble.card) }));
      log(`${powerIcon('bubble', 'sm')} ${bubbleMsg}`, player);
      stageFx({ power: 'bubble', moment: 'open', by: player, on: player, amount: bubble.count });
    } else {
      card = draw(player);
      const openMsg = voice(player).you
        ? tr('Vos abrís con {card}', { card: cardLabel(card) })
        : tr('{who} abre con {card}', { who: who(player), card: cardLabel(card) });
      log(openMsg, player);
    }
    state.chains[player] = playCard(state.chains[player], card);
    if (unstack([card]).some((c) => c.power === 'tape')) state.taped[player] = state.chains[player];
    onDraw(player, card);
    countDown(player, true);
    emit();
    if (isBot(player)) {
      if (!(await tick(800, era))) return;
      await botTurn(player, era);
    }
  }

  /**
   * Puntos de cadena que le alcanzan a la CPU para empatar en su última chance. Ya
   * está sin vida y este es su último turno: ganar no está sobre la mesa, y el empate
   * pide que el golpe se lleve toda la vida que le sobra al otro, escudo incluido.
   * Llegado ese número se planta y lo asegura (ver `decideDraw`).
   *
   * Va en puntos de cadena y no en daño porque es lo que mira `decideDraw`: las plumas
   * del abanico se descuentan, que suman al golpe sin salir de la cadena.
   */
  function needsOf(player) {
    if (lastChance(state) !== player) return null;
    const foe = other(player);
    const mine = state.status[player];
    const wall = hpOf(state, foe) + state.status[foe].egg;
    return wall - mine.feathers * TUNING.fanStep - rageBonusOf(mine) - neutralBonusOf(state, player);
  }

  /**
   * La carta que corta la cadena, dicha igual la juegue quien la juegue. Es la misma
   * frase para los dos asientos y para los dos modos: lo único que cambia es la
   * persona del verbo.
   */
  const bustLine = (player, card) =>
    voice(player).you
      ? tr('Vos sacás {card}: se te desarma el ataque. 0 de daño.', { card: cardLabel(card) })
      : tr('{who} saca {card}: se le desarma el ataque. 0 de daño.', { who: who(player), card: cardLabel(card) });

  /** El turno de un asiento que juega la máquina. Solo puede ser `p2` (ver `isBotSeat`). */
  async function botTurn(player, era) {
    state.busy = true;
    const needs = needsOf(player);
    if (needs !== null) {
      log(tr('{target} le alcanza una cadena de {needs} para empatar.', { target: cap(toWhom(player)), needs: Math.max(needs, 0) }), 'muted');
    }

    for (;;) {
      emit();
      if (!(await tick(750, era))) return;
      const chain = state.chains[player];

      let willStand = false;
      if (state.tutorial) {
        // La CPU del tutorial ataca con las cartas que diga el guión; sin tope, roba
        // hasta cortarse (ver `BOT_STAND_AT` en `tutorial.js`).
        willStand = chain.cards.length >= (state.tutorialBotStandAt ?? 2);
      } else {
        willStand = !decideDraw(chain, unseenPool(player), {
          needs, difficulty: state.difficulty, view: attackViewOf(state, player),
        });
        // Con la lente sabe qué viene: si la de arriba engancha (o no corta), roba; si
        // corta y no tiene con qué salvarse, se planta.
        const next = state.peek?.player === player ? state.peek.cards[0] : null;
        if (next) {
          const safe = isFreeStack(next) || next.power === 'mirror' || !playCard(chain, next).busted;
          willStand = !safe && eggsLeft(state, player) === 0 && !state.taped[player];
        }
      }

      if (willStand) {
        const points = scoreChain(chain).total;
        const standMsg = voice(player).you
          ? tr('Vos cerrás su ataque con {points}.', { points })
          : tr('{who} cierra su ataque con {points}.', { who: who(player), points });
        log(standMsg, player);
        await finishTurn(player, points, era);
        return;
      }

      const gamble = oneMoreOf(state, player);
      if (gamble && !(await askOneMore(player, era))) return;
      const card = draw(player);
      onDraw(player, card);
      let played = true;
      if (isFreeStack(card) && chain.cards.length > 0) stackCard(player, bestStack(chain, card), card);
      else if (!(played = await extend(player, mirrored(player, card), 600, era))) return;
      if (gamble && played !== 'saved' && (await settleOneMore(player, era))) return;
    }
  }

  /**
   * Las cartas que salieron este turno, incluida la que cortó la cadena: el poder es de
   * la carta, no del ataque.
   */
  function cardsPlayed(player) {
    const chain = state.chains[player];
    if (chain.bustCard) return [...chain.cards, chain.bustCard];
    return chain.tapeCut ? [...chain.cards, chain.tapeCut] : chain.cards;
  }

  /**
   * Cura a `player` sin pasarse de la vida inicial y devuelve cuánto curó de verdad.
   * Recortar acá y no en `hpOf` es lo que mantiene la cuenta honesta: si `healed`
   * guardara curación desperdiciada, después amortiguaría golpes que sí tendrían
   * que entrar. Con el veneno de víbora encima, la cura no entra (solo si había algo
   * para curar: ver `healShut`).
   */
  function heal(player, amount) {
    // En la última chance no hay cura: sin esto la maceta o la daga levantaban del cero
    // al que solo tenía que devolver un golpe.
    if (amount <= 0 || hpOf(state, player) <= 0) return 0;
    const room = maxHpOf(state, player) - hpOf(state, player);
    if (room <= 0) return 0;
    if (healShut(player)) return 0;
    const got = Math.min(amount, room);
    state.healed[player] += got;
    return got;
  }

  /** Suma escudo a `player` hasta el tope. */
  function gainShield(player, amount) {
    const st = state.status[player];
    const room = TUNING.shieldMax - st.egg;
    if (amount <= 0 || room <= 0) return 0;
    const got = Math.min(amount, room);
    st.egg += got;
    return got;
  }

  /**
   * Si la cura que iba a recibir `player` no entra (Viper's Venom). La primera cura de
   * un turno con la víbora encima la gasta y cierra la cura el resto de ese turno: no
   * le entra ninguna más hasta que empiece el siguiente (ver `beginTurn`).
   */
  function healShut(player) {
    const st = state.status[player];
    if (st.healShut) return true;
    if (st.healBlock <= 0) return false;
    st.healBlock--;
    st.healShut = 1;
    stageFx({ power: 'viper', moment: 'block', by: other(player), on: player, amount: 0 });
    powerLog('viper', tr("Viper's Venom: este turno no le entra ninguna cura {to}.", { to: toWhom(player) }), other(player));
    return true;
  }

  /**
   * Cuántas de `copies` aplicaciones de un efecto le llegan a `target`: cada Limpiador
   * que tenga cancela una entera (ver la Sleepy Guard).
   */
  function resist(target, copies) {
    const st = state.status[target];
    const stopped = Math.min(st.cleanser, copies);
    if (stopped > 0) {
      st.cleanser -= stopped;
      stageFx({ power: 'guard', moment: 'cleanse', by: target, on: target, amount: stopped });
      powerLog('guard', stopped === 1
        ? tr('Limpiador: se cancela un efecto sobre {who}.', { who: whom(target) })
        : tr('Limpiador: se cancelan {n} efectos sobre {who}.', { n: stopped, who: whom(target) }), target);
    }
    return copies - stopped;
  }

  /** `copies` aplicaciones de `amount` de sangrado de `by` sobre `target` (sin tope). */
  function addBleed(by, target, amount, power, moment, copies = 1) {
    return putBleed(by, target, amount, power, moment, resist(target, copies));
  }

  /** Lo mismo, con las `through` aplicaciones que ya pasaron el Limpiador. */
  function putBleed(by, target, amount, power, moment, through) {
    if (through <= 0) return 0;
    const st = state.status[target];
    const got = amount * through;
    st.bleed += got;
    stageFx({ power, moment, by, on: target, amount: got });
    powerLog(power, tr('{name}: +{n} de sangrado para {who} (total {total}).', { name: tr(POWERS[power].name), n: got, who: whom(target), total: st.bleed }), by);
    return got;
  }

  /** `copies` aplicaciones de `amount` de veneno de `by` sobre `target`, hasta el tope. */
  function addPoison(by, target, amount, power, moment, copies = 1) {
    const through = resist(target, copies);
    if (through <= 0) return 0;
    const st = state.status[target];
    const before = st.poison;
    st.poison = Math.min(TUNING.poisonMax, st.poison + amount * through);
    const got = st.poison - before;
    stageFx({ power, moment, by, on: target, amount: got });
    powerLog(power, tr('{name}: +{n} de veneno para {who} (total {total}).', { name: tr(POWERS[power].name), n: got, who: whom(target), total: st.poison }), by);
    return got;
  }

  /** Suma espinas a `player` hasta el tope y devuelve cuántas entraron. */
  function addSpikes(player, amount) {
    const st = state.status[player];
    const before = st.spikes;
    st.spikes = Math.min(TUNING.spikesMax, st.spikes + amount);
    return st.spikes - before;
  }

  /** La Red Sage: le saca a `player` todo lo que le pusieron. Devuelve si había algo. */
  function cleanse(player) {
    const st = state.status[player];
    const had = DEBUFFS.some((k) => st[k] > 0);
    for (const k of DEBUFFS) st[k] = 0;
    return had;
  }

  /**
   * Los poderes jugados en el turno, todos juntos al soltar el ataque. Dos momentos,
   * que son las dos formas de cerrar el turno:
   * - cortado: el Flamingo Hammer y el Storm Shuriken, que son justamente para eso.
   * - plantado sin cortarse: todos los que dicen "al plantarte". Plantarse es atacar
   *   aunque el caracol deje el golpe en 0: la decisión del jugador es la misma.
   * Cada copia suma lo suyo. Cada uno queda anotado para la pantalla (ver `stageFx`).
   */
  function applyPowers(player) {
    const foe = other(player);
    const mine = state.status[player];
    const theirs = state.status[foe];
    const chain = state.chains[player];
    const busted = chain.busted;
    // Pegada con la Scotch Tape: se cortó (y lo de cortarse vale) y además ataca.
    const taped = Boolean(chain.taped);
    let n = countPowers(player, cardsPlayed(player));
    let broke = null;

    if (busted || taped) {
      // El martillo primero: el shuriken que viene detrás encuentra al rival sin escudo.
      if (n.hammer) {
        const lost = theirs.egg;
        theirs.egg = 0;
        stageFx({ power: 'hammer', moment: 'apply', by: player, on: foe, amount: lost });
        powerLog('hammer', lost > 0
          ? tr('Flamingo Hammer: le rompe los {lost} de escudo {to}.', { lost, to: toWhom(foe) })
          : tr('Flamingo Hammer: no había escudo que romper.'), lost > 0 ? player : 'muted');
      }
      if (n.shuriken) {
        const dmg = n.shuriken * TUNING.shuriken;
        const landed = throughShield(player, foe, dmg);
        statsOf(player).direct += landed;
        stageFx({ power: 'shuriken', moment: 'apply', by: player, on: foe, amount: landed });
        powerLog('shuriken', tr('Storm Shuriken: la cadena se rompe y {dmg} de daño {target} (queda en {hp}).', { dmg: landed, target: toWhom(foe), hp: hpOf(state, foe) }), player);
      }
      if (n.stamp) {
        mine.stamps += n.stamp;
        stageFx({ power: 'stamp', moment: 'apply', by: player, on: player, amount: mine.stamps });
        powerLog('stamp', mine.stamps === 1
          ? tr('Earth Stamp: una carta del centro de regalo para {who}.', { who: whom(player) })
          : tr('Earth Stamp: {n} cartas del centro de regalo para {who}.', { n: mine.stamps, who: whom(player) }), player);
      }
      if (n.gift) {
        const before = mine.gift;
        mine.gift = Math.min(TUNING.giftMax, mine.gift + n.gift * TUNING.giftDamage);
        stageFx({ power: 'gift', moment: 'apply', by: player, on: player, amount: mine.gift - before });
        powerLog('gift', tr('Last Gift: el próximo ataque {of} suma +{dmg}.', { of: ofWhom(player), dmg: mine.gift }), player);
      }
      if (busted) return { broke };
      // Lo de atacar, solo con las cartas que quedaron pegadas.
      n = countPowers(player, chain.cards);
    }

    // La salvia va primero: si le habían bloqueado la cura, que la cura de este turno entre.
    if (n.sage) {
      const had = cleanse(player);
      const got = heal(player, n.sage * TUNING.sageHeal);
      stageFx({ power: 'sage', moment: 'apply', by: player, on: player, amount: got });
      powerLog('sage', had
        ? tr('Red Sage: limpia a {who} y cura {got}.', { who: whom(player), got })
        : tr('Red Sage: cura {got} a {who}.', { got, who: whom(player) }), player);
    }
    if (n.octopus && !taped && (!TUNING.octopusOnStand || !busted)) {
      mine.stacked += n.octopus;
      stageFx({ power: 'octopus', moment: 'apply', by: player, on: player, amount: mine.stacked });
      powerLog('octopus', mine.stacked === 1
        ? tr('Sticky Octopus: una carta extra del centro para {who}.', { who: whom(player) })
        : tr('Sticky Octopus: {count} cartas extra del centro para {who}.', { count: mine.stacked, who: whom(player) }), player);
    }
    if (n.bubble) {
      mine.bubbles += n.bubble;
      stageFx({ power: 'bubble', moment: 'apply', by: player, on: player, amount: mine.bubbles });
      powerLog('bubble', tr('Bubble Paste: la carta que se lleve del centro abre la próxima ronda {of}.', { of: ofWhom(player) }), player);
    }
    if (n.poison) addPoison(player, foe, TUNING.poisonDose, 'poison', 'apply', n.poison);
    if (n.jellyfish) {
      const got = resist(foe, n.jellyfish);
      if (got > 0) {
        // Mezcladas en el mazo, cada una en un lugar al azar.
        const count = got * TUNING.jellyCards;
        const deck = state.decks[foe];
        for (let i = 0; i < count; i++) deck.splice(Math.floor(rng() * (deck.length + 1)), 0, makeJelly());
        stageFx({ power: 'jellyfish', moment: 'apply', by: player, on: foe, amount: count });
        powerLog('jellyfish', tr('Paralyzing Jellyfish: {n} medusas en el mazo {of}.', { n: count, of: ofWhom(foe) }), player);
      }
    }
    if (n.redbubble) {
      const got = resist(foe, n.redbubble);
      if (got > 0) {
        theirs.noPowers += got * TUNING.redbubbleCards;
        stageFx({ power: 'redbubble', moment: 'apply', by: player, on: foe, amount: theirs.noPowers });
        powerLog('redbubble', tr('Red Bubble: sin poderes del centro para {who} hasta llevarse {n} sin poder.', { who: whom(foe), n: theirs.noPowers }), player);
      }
    }
    if (n.guard) {
      const got = gainShield(player, n.guard * TUNING.guardShield);
      mine.cleanser += n.guard;
      stageFx({ power: 'guard', moment: 'apply', by: player, on: player, amount: got, cleanser: mine.cleanser });
      powerLog('guard', tr('Sleepy Guard: +{got} de escudo y {n} Limpiador para {who}.', { got, n: mine.cleanser, who: whom(player) }), player);
    }
    if (n.trickster) {
      mine.tricks += n.trickster;
      stageFx({ power: 'trickster', moment: 'apply', by: player, on: foe, amount: mine.tricks });
      powerLog('trickster', tr("Trickster's Card: {n} carta del rival para robar.", { n: mine.tricks }), player);
    }


    // Las garras de Charm of Power son de la partida, no de esta mano: cada ataque pone
    // su sangrado, esté o no la carta en la mesa.
    if (mine.claws > 0) addBleed(player, foe, mine.claws * TUNING.clawBleed, 'strength', 'apply');
    if (n.razor) addBleed(player, foe, TUNING.razorBleed, 'razor', 'apply', n.razor);
    if (n.brutal) {
      // Cada bebida es una aplicación entera —sangrado y herida—: un Limpiador la
      // cancela toda, no la mitad.
      const got = resist(foe, n.brutal);
      putBleed(player, foe, TUNING.drinkBleed, 'brutal', 'apply', got);
      if (got > 0) {
        theirs.wound += got;
        powerLog('brutal', tr('Energy Drink M: herida abierta para {who}: en su próximo turno, lo que sangre te cura.', { who: whom(foe) }), player);
      }
    }
    if (n.pot) {
      const got = heal(player, n.pot * TUNING.potHeal);
      stageFx({ power: 'pot', moment: 'apply', by: player, on: player, amount: got });
      powerLog('pot', got > 0
        ? tr('Leafy Pot: cura {got} a {who} (queda en {hp}).', { got, who: whom(player), hp: hpOf(state, player) })
        : tr('Leafy Pot: no cura nada.'), got > 0 ? player : 'muted');
    }
    if (n.leaf) {
      const before = mine.leaf;
      mine.leaf = Math.min(TUNING.leafMax, mine.leaf + n.leaf * TUNING.leafTurns);
      stageFx({ power: 'leaf', moment: 'apply', by: player, on: player, amount: mine.leaf - before });
      powerLog('leaf', tr('Spring Leaf: {turns} turnos de brote para {who} ({heal} de cura cada uno).', { turns: mine.leaf, who: whom(player), heal: TUNING.leafHeal }), player);
    }
    if (n.leech) {
      // El escudo frena primero, y se cura solo lo que llegó a la vida.
      const drain = throughShield(player, foe, n.leech * TUNING.leechDrain);
      statsOf(player).stolen += drain;
      const got = heal(player, drain);
      stageFx({ power: 'leech', moment: 'apply', by: player, on: foe, amount: drain, heal: got });
      powerLog('leech', tr('Mantis Dagger: le roba {drain} de vida {target} y cura {got} (queda en {hp}).', { drain, target: toWhom(foe), got, hp: hpOf(state, foe) }), player);
    }
    if (n.snail) {
      const got = resist(foe, n.snail);
      if (got > 0) {
        theirs.weak += got;
        stageFx({ power: 'snail', moment: 'apply', by: player, on: foe, amount: theirs.weak });
        powerLog('snail', theirs.weak === 1
          ? tr('Lazy Snail: en el próximo ataque {of} no cuenta su mejor racha.', { of: ofWhom(foe) })
          : tr('Lazy Snail: en el próximo ataque {of} no cuentan sus {n} mejores rachas.', { of: ofWhom(foe), n: theirs.weak }), player);
      }
    }
    if (n.cocoon) {
      const before = mine.cocoon;
      mine.cocoon = Math.min(TUNING.cocoonMax, mine.cocoon + n.cocoon * TUNING.cocoonTurns);
      stageFx({ power: 'cocoon', moment: 'apply', by: player, on: player, amount: mine.cocoon - before });
      powerLog('cocoon', tr('Cocoon Whistle: {turns} turnos de capullo para {who} ({shield} de escudo cada uno).', { turns: mine.cocoon, who: whom(player), shield: TUNING.cocoonShield }), player);
    }
    if (n.steelskin) {
      const got = addSpikes(player, n.steelskin * TUNING.spikes);
      stageFx({ power: 'steelskin', moment: 'apply', by: player, on: player, amount: got });
      powerLog('steelskin', tr('Gecko Mask: {spikes} espinas para {who}.', { spikes: mine.spikes, who: whom(player) }), player);
    }
    if (n.viper) {
      const got = resist(foe, n.viper);
      if (got > 0) {
        theirs.healBlock += got;
        stageFx({ power: 'viper', moment: 'apply', by: player, on: foe, amount: theirs.healBlock });
        powerLog('viper', tr("Viper's Venom: el próximo turno en que {who} se cure, no le entra nada ({n} turnos).", { who: whom(foe), n: theirs.healBlock }), player);
      }
    }
    if (n.pillow) {
      mine.pillow += n.pillow * TUNING.pillowTurns;
      stageFx({ power: 'pillow', moment: 'apply', by: player, on: player, amount: TUNING.pillowCut });
      powerLog('pillow', tr("Mít's Comfy Pillow: los ataques {to} sacan {cut} menos durante {turns} turnos del rival.", { to: toWhom(player), cut: TUNING.pillowCut, turns: mine.pillow }), player);
    }
    // Los neutrales que actúan al atacar. Lo que suman al golpe ya entró en `swingOf`:
    // acá se ve, y se cobra lo demás.
    const even = state.round % 2 === 0;
    if (n.energy) {
      // Una sola bebida se gasta por ataque: la que dobló el golpe se rompe.
      broke = unstack(chain.cards).find((c) => c.power === 'energy') ?? null;
      stageFx({ power: 'energy', moment: 'apply', by: player, on: player, amount: TUNING.energyMult });
      powerLog('energy', tr('Energy Drink S: la cadena vale el doble y la bebida se rompe.'), player);
    }
    if (n.papa) {
      if (even) {
        stageFx({ power: 'papa', moment: 'apply', by: player, on: foe, amount: n.papa * TUNING.papaDamage, kind: 'hit' });
        powerLog('papa', tr('Papa Bear: ronda par, +{dmg} al golpe.', { dmg: n.papa * TUNING.papaDamage }), player);
      } else {
        const got = gainShield(player, n.papa * TUNING.papaShield);
        stageFx({ power: 'papa', moment: 'apply', by: player, on: player, amount: got, kind: 'shield' });
        powerLog('papa', tr('Papa Bear: ronda impar, +{got} de escudo para {who}.', { got, who: whom(player) }), player);
      }
    }
    if (n.mama) {
      if (even) addBleed(player, foe, TUNING.mamaBleed, 'mama', 'apply', n.mama);
      else {
        const got = heal(player, n.mama * TUNING.mamaHeal);
        stageFx({ power: 'mama', moment: 'apply', by: player, on: player, amount: got, kind: 'heal' });
        powerLog('mama', tr('Mama Bear: ronda impar, cura {got} a {who}.', { got, who: whom(player) }), player);
      }
    }
    if (n.blood) {
      // El pacto es con uno mismo: el Limpiador no lo frena.
      const got = n.blood * TUNING.bloodSelf;
      mine.bleed += got;
      stageFx({ power: 'blood', moment: 'apply', by: player, on: player, amount: got });
      powerLog('blood', tr('Bloodpact: +{dmg} al golpe, y {who} queda con {n} de sangrado.', { dmg: n.blood * TUNING.bloodDamage, who: whom(player), n: mine.bleed }), player);
    }
    return { broke };
  }

  /**
   * La Black Sage, antes del golpe: le saca al rival todo lo que tiene encima y lo
   * protege o lo potencia. Devuelve cuánto escudo le rompió.
   */
  function dispelFoe(player) {
    const foe = other(player);
    const theirs = state.status[foe];
    const had = ['egg', 'spikes', 'feathers', 'rage', 'pillow', 'gift'].filter((k) => theirs[k] > 0);
    const shield = theirs.egg;
    for (const k of had) theirs[k] = 0;
    stageFx({ power: 'dispel', moment: 'apply', by: player, on: foe, amount: shield });
    powerLog('dispel', had.length
      ? tr('Black Sage: le saca todo lo que tenía encima {to}.', { to: toWhom(foe) })
      : tr('Black Sage: no había nada que sacar.'), had.length ? player : 'muted');
  }

  /**
   * `card` se rompe: sale de lo de `player` para el resto de la partida, del mazo (si ya
   * había vuelto con un rebarajado) y de las listas del panel (ver `start` y `added`).
   */
  function breakCard(player, card) {
    const deck = state.decks[player];
    const at = deck.indexOf(card);
    if (at >= 0) deck.splice(at, 1);
    for (const list of [state.start[player], state.added[player]]) {
      const i = list.findIndex((c) => c.uid === card.uid);
      if (i >= 0) { list.splice(i, 1); break; }
    }
  }

  async function finishTurn(player, points, era) {
    const foe = other(player);
    const mine = state.status[player];
    const theirs = state.status[foe];

    // Antes del golpe, la cadena se recorre. Es lo primero que pasa y por eso el reloj
    // se apaga acá y no más abajo: la decisión ya está tomada, y un reloj que siguiera
    // corriendo podría cortar la cadena en medio de su propio recorrido.
    //
    // Solo se recorre lo que hay para recorrer: el ataque que se cortó —o el que se
    // quedó sin tiempo— no tiene cadena que mostrar, ya se vio caer la carta que lo
    // rompió, y meterle una pausa acá sería hacerlo esperar por nada.
    stopClock();
    settleSpell(player);
    if (state.peek?.player === player) state.peek = null;
    state.poured[player] = true;
    const aimed = state.chains[player];
    if (!aimed.busted && aimed.cards.length > 0) {
      const ms = aimMs(aimed.cards.length);
      state.aiming = { id: ++state.aimId, player, ms };
      emit();
      if (!(await tick(ms, era))) return;
      state.aiming = null;
    }

    const busted = state.chains[player].busted;
    const swing = swingOf(state, player);
    if (swing > 0) {
      const record = state.records[player];
      record.hit = Math.max(record.hit, swing);
      // En símbolos, como el daño: la racha más larga (la mejorada cuenta doble, el
      // Rocket suma sin sumar columna), no las cartas de la mesa.
      record.chain = Math.max(record.chain, longestRun(state.chains[player]));
    }
    if (busted) statsOf(player).busts++;
    else statsOf(player).attacks.push(longestRun(state.chains[player]));
    // El caracol se gasta con el ataque que no se cortó, pegue lo que pegue: ya le
    // apagó sus mejores rachas (ver `pointsOf`). Una cadena cortada no lo gasta.
    const weakened = !busted && mine.weak > 0 ? mine.weak : 0;
    if (weakened) mine.weak = 0;
    // Lo que se anote de acá hasta el `emit` del golpe es de este ataque.
    const fxBefore = state.powerFxId;
    fxOpen = false;
    if (weakened) stageFx({ power: 'snail', moment: 'slow', by: foe, on: player, amount: weakened });
    if (!busted && chainCount(state, player, 'dispel') > 0) dispelFoe(player);
    if (swing !== points) {
      const mods = [
        weakened ? tr('sin sus {n} mejores rachas por el caracol', { n: weakened }) : '',
        mine.feathers ? tr('+{dmg} de plumas', { dmg: mine.feathers * TUNING.fanStep }) : '',
        mine.rage ? tr('+{dmg} de Rage', { dmg: rageBonusOf(mine) }) : '',
        chainCount(state, player, 'energy') ? tr('×{n} de la bebida', { n: TUNING.energyMult }) : '',
        neutralBonusOf(state, player) ? tr('+{dmg} de amuletos', { dmg: neutralBonusOf(state, player) }) : '',
      ].filter(Boolean);
      const swingMsg = voice(player).you
        ? tr('Vos atacás por {swing}: {points} de cadena {mods}.', { swing, points, mods: mods.join(', ') })
        : tr('{who} ataca por {swing}: {points} de cadena {mods}.', { who: who(player), swing, points, mods: mods.join(', ') });
      log(swingMsg, 'muted');
    }

    // Primero el escudo del rival, que se come lo que puede y solo se rompe cuando se
    // gasta: si le sobra, sigue puesto para el próximo golpe.
    const blocked = Math.min(theirs.egg, swing);
    let broke = false;
    if (blocked > 0) {
      theirs.egg -= blocked;
      broke = theirs.egg === 0;
      const rest = broke ? tr(' y se rompe') : tr(' y le quedan {egg}', { egg: theirs.egg });
      const shieldMsg = voice(foe).you
        ? tr('Tu escudo aguanta {blocked}{rest}.', { blocked, rest })
        : tr('El escudo {owner} aguanta {blocked}{rest}.', { owner: ofWhom(foe), blocked, rest });
      log(shieldMsg, 'muted');
    }

    // Después la almohada, sobre lo que pasó el escudo: le resta `pillowCut` a lo que
    // llega a la vida. Dura turnos del que ataca, no golpes: se gasta uno al final de
    // este turno, pegue o se corte (ver más abajo).
    let landed = swing - blocked;
    let mitigated = 0;
    if (theirs.pillow > 0 && landed > 0) {
      mitigated = Math.min(landed, TUNING.pillowCut);
      landed -= mitigated;
      stageFx({ power: 'pillow', moment: 'block', by: foe, on: foe, amount: mitigated });
      powerLog('pillow', tr("Mít's Comfy Pillow frena el golpe: le resta {mitigated}.", { mitigated }), foe);
    }
    // Lo que vale el ataque para los poderes del que pegó: lo que frenó la almohada no
    // cuenta, lo que se comió el escudo sí.
    const effectiveSwing = swing - mitigated;

    state.roundScores[player] = effectiveSwing;
    // Si era su última chance, este es el golpe: el halo se apaga cuando cae.
    if (lastChance(state) === player) state.lastChanceUsed[player] = true;
    // El turno se cierra acá mismo. Si no, entre el golpe y el turno del otro queda
    // una ventana con `turn` todavía puesto y los botones vivos: alcanzaba para
    // plantarse dos veces y aplicar el daño dos veces.
    state.turn = null;
    stopClock();
    // El daño entra acá y no al cerrar la ronda: el golpe tiene que verse cuando el
    // jugador lo suelta, no dos turnos después. Los totales terminan iguales.
    addDamage(player, landed);
    state.busy = false;
    const target = effectiveSwing > 0 ? foe : player;
    // Un ataque hace 0 por dos motivos distintos y la pantalla los cuenta distinto: si
    // la cadena se cortó, el fallo ya se vio y se oyó cuando cayó la carta —no hay
    // nada nuevo que mostrar—; si se plantó y el caracol se lo comió, este es el
    // primer momento en que el jugador se entera. `kind` es lo que los separa.
    const kind = effectiveSwing <= 0 && busted ? { kind: 'bust' } : null;
    state.lastHit = { id: ++state.hitId, by: player, target, amount: landed, blocked, broke, ...kind };
    if (landed > 0) {
      const hitMsg = voice(player).you
        ? tr('Vos pegás por {landed}. {who} queda en {hp}.', { landed, who: who(target), hp: hpOf(state, target) })
        : (voice(target).you
            ? tr('{who} pega por {landed}. Vos quedás en {hp}.', { who: who(player), landed, hp: hpOf(state, target) })
            : tr('{who} pega por {landed}. {target} queda en {hp}.', { who: who(player), landed, target: who(target), hp: hpOf(state, target) }));
      log(hitMsg, player);
    }

    // Lo que le cuesta pegarle a alguien armado: sus espinas vuelven enteras (después
    // del golpe, ver abajo).
    let thorns = 0;
    if (swing > 0 && theirs.spikes > 0) {
      thorns = theirs.spikes;
      theirs.spikes = 0;
    }
    // La Furia se gasta con el ataque: la Rage vuelve a 0.
    if (swing > 0 && mine.rage >= TUNING.rageMax) {
      mine.rage = 0;
      stageFx({ power: 'rage', moment: 'fury', by: player, on: foe, amount: TUNING.furyBonus });
      powerLog('rage', tr('Mask of Frenzy: la Furia se descarga y la Rage vuelve a 0.'), player);
    }
    // Las plumas del abanico y el regalo ya sumaron al golpe: se van.
    if (swing > 0) {
      mine.feathers = 0;
      mine.gift = 0;
    }
    const { broke: drink } = applyPowers(player);
    const staged = state.powerFxId !== fxBefore ? state.powerFx.fx : [];
    emit();

    // Sus cartas vuelven al mazo antes de repartirle: lo que se lleve del centro entra
    // sobre el mazo completo, y la cadena sigue en pantalla hasta que cierre la ronda.
    const chain = state.chains[player];
    // Las medusas no vuelven: se rompieron al salir. Tampoco la bebida que se usó.
    const played = unstack(chain.cards);
    const kept = (c) => !c.jelly && c !== drink;
    state.decks[player].push(...played.slice(state.recycled[player]).filter(kept));
    if (chain.bustCard && !chain.bustCard.jelly) state.decks[player].push(chain.bustCard.mirrorOf ?? chain.bustCard);
    if (drink) breakCard(player, drink);
    state.returned[player] = true;

    // Un golpe que conecta se mira entero, y "entero" es más largo de lo que parece:
    // el efecto de clase tarda hasta 700 ms en llegar al impacto (`hitDelay`) y recién
    // ahí sale el número, que flota 900 ms más. La espera cubre el golpe completo y
    // deja un beat después, antes de cambiar de tema.
    //
    // Los poderes con animación propia salen después del golpe, de a uno y completos:
    // con alguno en juego la espera es la que ellos pidan, si es más larga.
    const powersMs = staged.length ? POWER_LEAD + staged.reduce((ms, fx) => ms + powerBeat(fx), 0) : 0;
    const shown = Math.max(swing > 0 ? 1800 : busted ? 1000 : 1700, powersMs);
    if (!(await tick(shown, era))) return;

    // Y recién ahí vuelven las espinas, con su propio golpe en sentido contrario. Van
    // después y no junto con el ataque porque son dos cosas distintas —le pegaste, y
    // las espinas te contestaron— y encimadas se leen como un solo número mal sumado.
    //
    // El daño se aplica acá, del otro lado del `tick`, y por eso el `return` de arriba
    // no lo pierde: cuando `tick` da false es porque arrancó otra partida y `state` ya
    // es otro objeto. Sumárselo ahí le metería daño de la partida anterior a la nueva.
    if (thorns > 0) {
      addDamage(foe, thorns);
      statsOf(foe).thorns += thorns;
      state.lastHit = {
        id: ++state.hitId, by: foe, target: player, amount: thorns, blocked: 0, broke: false,
        kind: 'thorns',
      };
      powerLog('steelskin', tr('Espinas: {thorns} de daño {target} (queda en {hp}).', { thorns, target: toWhom(player), hp: hpOf(state, player) }), foe);
      emit();
      if (!(await tick(1300, era))) return;
    }

    // La herida abierta dura el turno entero del que sangra: al cerrarlo, se cierra.
    // Y la almohada del rival cuenta este turno, haya pegado o no.
    if (mine.wound > 0) mine.wound = 0;
    if (theirs.pillow > 0) theirs.pillow--;

    if (mine.poison > 0) {
      tickPoison(player);
      emit();
      if (!(await tick(Math.max(1000, POWER_BEAT.poison.tick), era))) return;
    }
    // Los guantes curan con el veneno solo el turno en que salieron.
    mine.antidote = 0;

    // Con alguien sin vida no hay mazo que armar: o la partida ya está resuelta, o
    // solo queda el golpe de la última chance.
    if (matchOver()) return endRound(era);
    if (lastChance(state)) return afterDraft(era);
    await startDraft(player, era);
  }

  // Con la maceta curando y el veneno mordiendo fuera del ataque, "llegó a 100 de
  // daño" ya no equivale a "lo dejó sin vida": la partida se cierra por vida.
  // En el tutorial la partida nunca termina antes de la ronda 5, garantizando que
  // el jugador complete todas las etapas guiadas.
  //
  // Alguien sin vida no la cierra mientras le quede la última chance (ver `lastChance`).
  const matchOver = () => {
    const down = PLAYERS.filter((p) => hpOf(state, p) <= 0);
    if (state.tutorial) return state.round >= 5 && down.includes('p2') && lastChance(state) !== 'p2';
    return down.length > 0 && !lastChance(state);
  };

  /** Terminado el reparto de un jugador: juega el que falta, o cierra el intercambio. */
  async function afterDraft(era) {
    const pending = state.order.find((p) => state.roundScores[p] === null);
    if (pending) {
      state.phase = 'turn';
      emit();
      if (!(await tick(600, era))) return;
      await beginTurn(pending, era);
    } else {
      await endRound(era);
    }
  }

  /**
   * El brote de la Spring Leaf, al empezar el turno de quien lo tiene y antes de robar:
   * cura un número fijo y se gasta un turno.
   */
  function tickLeaf(player) {
    const st = state.status[player];
    const got = heal(player, TUNING.leafHeal);
    st.leaf--;
    stageFx({ power: 'leaf', moment: 'tick', by: player, on: player, amount: got });
    powerLog('leaf', got > 0
      ? tr('Spring Leaf: cura {got} a {who} (queda en {hp}, {left} turnos más).', { got, who: whom(player), hp: hpOf(state, player), left: st.leaf })
      : tr('Spring Leaf: no cura nada ({left} turnos más).', { left: st.leaf }), player);
    return got;
  }

  /** El capullo del Cocoon Whistle, al empezar el turno: escudo fijo y se gasta un turno. */
  function tickCocoon(player) {
    const st = state.status[player];
    const got = gainShield(player, TUNING.cocoonShield);
    st.cocoon--;
    stageFx({ power: 'cocoon', moment: 'tick', by: player, on: player, amount: got });
    powerLog('cocoon', tr('Cocoon Whistle: +{got} de escudo para {who} ({left} turnos más).', { got, who: whom(player), left: st.cocoon }), player);
    return got;
  }

  /**
   * El veneno se cobra al finalizar el turno de quien lo tiene encima: muerde por su
   * cuenta entera y después baja 1. Cuenta como daño de quien lo puso, así que suma a
   * su total como cualquier golpe. Un frasco de 5 saca 5 + 4 + 3 + 2 + 1.
   *
   * No pasa por el escudo ni por la almohada: el veneno va directo a la vida. El turno
   * en que robó los guantes (`antidote`), en vez de morder lo cura lo mismo.
   */
  function tickPoison(player) {
    const st = state.status[player];
    if (st.poison <= 0) return;
    const bite = st.poison;
    if (st.antidote) {
      st.poison--;
      const got = heal(player, bite);
      stageFx({ power: 'gloves', moment: 'cure', by: player, on: player, amount: got });
      powerLog('gloves', tr('Gloves of Infection: el veneno cura {got} a {who} (veneno {left}).', { got, who: whom(player), left: st.poison }), player);
      return;
    }
    addDamage(other(player), bite);
    statsOf(other(player)).poison += bite;
    st.poison--;
    powerLog('poison', tr('Veneno: −{bite} de vida {target} (queda en {hp}, veneno {left}).', { bite, target: toWhom(player), hp: hpOf(state, player), left: st.poison }), other(player));
    stageFx({ power: 'poison', moment: 'tick', by: other(player), on: player, amount: bite });
  }

  async function endRound(era) {
    const { p1, p2 } = state.roundScores;
    state.turn = null;
    // El daño ya está aplicado (ver `finishTurn`); acá solo se juzga el intercambio. Si
    // uno no llegó a atacar —la partida se cerró antes, o la ronda era solo de una
    // última chance— no hay intercambio que juzgar.
    state.roundWinner = null;
    if (p1 !== null && p2 !== null) {
      state.roundWinner = p1 === p2 ? 'tie' : p1 > p2 ? 'p1' : 'p2';
      const verdict =
        state.roundWinner === 'tie'
          ? tr('Pegaron igual')
          : tr('Pegó más fuerte {winner}', { winner: whom(state.roundWinner) });
      log(
        tr('Fin del intercambio {round}: {p1} vs {p2} de daño. {verdict}. Vida {hp1} — {hp2}.', {
          round: state.round,
          p1,
          p2,
          verdict,
          hp1: hpOf(state, 'p1'),
          hp2: hpOf(state, 'p2'),
        }),
        'round',
      );
    }

    const down = PLAYERS.filter((p) => hpOf(state, p) <= 0);
    if (!state.tutorial && down.length === 1 && !state.lastChanceUsed[down[0]] && matchOver()) {
      const extra = overkillOf(state, down[0]);
      log(voice(down[0]).you
        ? tr('Overkill: te pegaron {extra} de más y no tenés última chance.', { extra })
        : tr('Overkill: {who} recibió {extra} de más y no tiene última chance.', { who: who(down[0]), extra }), 'bad');
    }

    state.phase = matchOver() ? 'matchEnd' : 'roundEnd';
    emit();
    if (state.phase !== 'roundEnd') return;

    // El cierre se muestra un momento y la ronda siguiente arranca sola. Apretar
    // "Siguiente ronda" no decidía nada —el veredicto ya estaba escrito— y partía el
    // combate en tarjetas: se leía el cartel, se buscaba el botón, recién ahí seguía.
    // El cartel se sigue viendo; lo que se fue es el trámite.
    //
    // Va suelto, sin `await`: el que cerró el intercambio no se queda esperando al
    // siguiente. Encadenado, la llamada que soltó el ataque no volvería hasta el
    // final de la partida, con una promesa por ronda colgando de la anterior.
    const closed = state.round;
    void (async () => {
      if (!(await tick(state.tutorial ? TUTORIAL_ROUND_PAUSE : ROUND_PAUSE, era))) return;
      // `nextRound` puede haberlo adelantado mientras tanto: si ya arrancó otra
      // ronda, esta corrutina no tiene nada que hacer.
      if (state.phase !== 'roundEnd' || state.round !== closed) return;
      await startRound(era);
    })();
  }

  // ---- reparto de la reserva --------------------------------------------------

  /**
   * Qué le corresponde a `player` según cómo terminó su ronda. Plantado elige entre
   * dos cartas sin poder o una con poder; cortado, una sin poder y nada más — los
   * poderes son el premio de haber soltado el ataque.
   */
  const awardKind = (player) => awardKindOf(state, player);

  const plainCards = () => plainCardsOf(state);

  function refillMarket() {
    while (state.market.length < MARKET_SIZE && state.pool.length) {
      state.market.push(state.pool.pop());
    }
  }


  /** Pasa `card` del centro al mazo de `player`, o a su burbuja si tiene una puesta. */
  function takeFromMarket(player, card) {
    const at = state.market.indexOf(card);
    if (at < 0) return;
    state.market.splice(at, 1);
    state.added[player].push(card);
    statsOf(player).picks++;
    // La Red Bubble se va llevándose cartas sin poder, de a una.
    if (!card.power && state.status[player].noPowers > 0) state.status[player].noPowers--;
    const count = state.status[player].bubbles;
    if (count > 0) {
      state.status[player].bubbles = 0;
      state.bubbleCard[player] = { card, count };
      stageFx({ power: 'bubble', moment: 'trap', by: player, on: player, amount: count });
      const bubbleMore = count > 1
        ? (count - 1 === 1
            ? tr(' junto a 1 carta más en una carta gigante')
            : tr(' junto a {more} cartas más en una carta gigante', { more: count - 1 }))
        : '';
      const bubbleMsg = voice(player).you
        ? tr('Vos atrapás {card} en la burbuja: abrirá tu próxima ronda{more}.', { card: cardLabel(card), more: bubbleMore })
        : tr('{who} atrapa {card} en la burbuja: abrirá tu próxima ronda{more}.', { who: who(player), card: cardLabel(card), more: bubbleMore });
      log(`${powerIcon('bubble', 'sm')} ${bubbleMsg}`, player);
    } else {
      state.decks[player].push(card);
      const deckMsg = voice(player).you
        ? tr('Vos sumás {card} al mazo.', { card: cardLabel(card) })
        : tr('{who} suma {card} al mazo.', { who: who(player), card: cardLabel(card) });
      log(deckMsg, player);
    }
    // Se repone en el acto, en el mismo hueco para que las cartas no salten de lugar.
    if (state.pool.length) state.market.splice(at, 0, state.pool.pop());
  }

  const draftable = (player) => draftableFor(state, player);
  const canRenew = (player) => canRenewFor(state, player);

  /** Lo que está a la vista se va al fondo de la reserva y salen 6 cartas nuevas. */
  function renew(player) {
    state.draft.renewed[player] = true;
    state.pool.unshift(...state.market.splice(0, state.market.length));
    refillMarket();
    const renewMsg = voice(player).you
      ? tr('Vos renovás el centro: no había nada con {crest}.', { crest: crest(state.symbols[player], 'sm') })
      : tr('{who} renueva el centro: no había nada con {crest}.', { who: who(player), crest: crest(state.symbols[player], 'sm') });
    log(renewMsg, player);
  }

  /** El reparto de `player`, apenas cierra su turno y antes de que juegue el otro. */
  async function startDraft(player, era) {
    state.draft = {
      order: [player],
      index: 0,
      // 'normal' es el reparto de siempre —una carta con poder o dos sin—; 'bonus'
      // son las cartas sueltas que debe cada pulpo, una por pulpo.
      step: 'normal',
      mode: null,
      remaining: 0,
      took: 0,
      bonus: 0,
      renewed: { p1: false, p2: false },
    };
    // El Trickster se cobra antes que el centro: primero se apaga, después se elige.
    const st = state.status[player];
    if (st.tricks > 0) {
      if (trickTargetsFor(state, player).length) state.draft.step = 'trick';
      else {
        st.tricks = 0;
        powerLog('trickster', tr("Trickster's Card: el rival no tiene cartas con poder para robar."), 'muted');
      }
    }
    state.phase = 'draft';
    await runDraft(era);
  }

  /**
   * `player` le roba `card` al rival: sale de su mazo (o de su burbuja) y pasa al mazo
   * de `player` para el resto de la partida. Un Limpiador del rival lo cancela, y el
   * trickster se gasta igual.
   */
  function steal(player, card) {
    const foe = other(player);
    state.status[player].tricks--;
    if (resist(foe, 1) <= 0) return;
    const deck = state.decks[foe];
    const at = deck.indexOf(card);
    if (at >= 0) deck.splice(at, 1);
    else if (state.bubbleCard[foe]?.card === card) state.bubbleCard[foe] = null;
    else return;
    state.decks[player].push(card);
    // Y en las listas del panel del mazo (ver `start` y `added`): deja de ser del rival.
    for (const list of [state.start[foe], state.added[foe]]) {
      const i = list.findIndex((c) => c.uid === card.uid);
      if (i >= 0) { list.splice(i, 1); break; }
    }
    state.added[player].push(card);
    stageFx({ power: 'trickster', moment: 'pick', by: player, on: foe, amount: 1, card: card.power });
    powerLog('trickster', tr("Trickster's Card: le roba {power} {to}.", { power: tr(POWERS[card.power].name), to: toWhom(foe) }), player);
  }

  /** La carta que la CPU le roba al rival: la de más peso (ver `POWER_WORTH`). */
  function botTrick(player) {
    const targets = trickTargetsFor(state, player);
    return targets.reduce((best, c) => ((POWER_WORTH[c.power] ?? 1) > (POWER_WORTH[best.power] ?? 1) ? c : best), targets[0]);
  }

  /** Cierra la etapa del Trickster y pasa al centro. */
  function endTricks(player) {
    state.status[player].tricks = 0;
    state.draft.step = 'normal';
  }

  const drafting = () => draftingSeat(state);

  /** Cierra el reparto de quien esté eligiendo y pasa al siguiente. */
  function nextDrafter() {
    state.draft.index++;
    state.draft.step = 'normal';
    state.draft.mode = null;
    state.draft.remaining = 0;
    state.draft.bonus = 0;
  }

  /**
   * Termina el reparto normal. Si el jugador tiene cartas de regalo —primero las de la
   * Earth Stamp, después las de los pulpos—, en vez de pasar el turno se abre la etapa
   * de las cartas extra: una por cada una, sin las reglas del reparto (`bonusBy` dice de
   * quién son). Devuelve si quedó algo por elegir.
   */
  function openBonus(player) {
    state.draft.mode = null;
    state.draft.remaining = 0;
    const st = state.status[player];
    const by = st.stamps > 0 ? 'stamp' : 'octopus';
    // Sin acumulación, los pulpos de más se pierden: pagan una carta por reparto.
    state.draft.bonus = by === 'stamp' ? st.stamps : TUNING.octopusStacks ? st.stacked : Math.min(st.stacked, 1);
    state.draft.bonusBy = by;
    if (state.draft.bonus === 0) { nextDrafter(); return false; }
    if (by === 'octopus' && !TUNING.octopusStacks) st.stacked = state.draft.bonus;
    state.draft.step = 'bonus';
    stageFx({ power: by, moment: 'pick', by: player, on: player, amount: state.draft.bonus });
    return true;
  }

  /** Se lleva una de las cartas de regalo y consume lo que la pagó. */
  function takeBonus(player, card) {
    if (state.draft.bonusBy === 'stamp') state.status[player].stamps--;
    else state.status[player].stacked--;
    state.draft.bonus--;
    takeFromMarket(player, card, false);
  }

  /** Deja pasar las cartas de regalo que quedaban: se pierden. */
  function dropBonus(player) {
    if (state.draft.bonusBy === 'stamp') state.status[player].stamps = 0;
    else state.status[player].stacked -= state.draft.bonus;
    state.draft.bonus = 0;
  }

  /**
   * El reparto de una CPU distraída: una carta cualquiera de las que puede llevarse, y
   * si le salió una con poder, esa sola. Tiene la misma forma que `planDraft`.
   */
  function carelessPlan(player, kind) {
    const options = draftableFor(state, player);
    if (!options.length) return { mode: null, cards: [] };
    const card = options[Math.floor(rng() * options.length)];
    if (card.power) return { mode: 'power', cards: [card] };
    return { mode: 'plain', cards: kind === 'bust' ? [card] : [card, card] };
  }

  /** La CPU se lleva sus cartas de regalo, de a una y a la vista, hasta que no le deban más. */
  async function botBonus(player, era) {
    do {
      while (state.draft.bonus > 0 && state.market.length) {
        emit();
        if (!(await tick(700, era))) return;
        takeBonus(player, pickBonus(draftableFor(state, player), cardsOf(player)));
      }
      if (state.draft.bonus > 0) dropBonus(player);
    } while (openBonus(player));
  }

  async function runDraft(era) {
    while (state.draft.index < state.draft.order.length) {
      const player = drafting();
      if (state.draft.step === 'trick') {
        if (!isBot(player)) {
          armClock(player, 'draft');
          emit();
          return;
        }
        while (state.status[player].tricks > 0 && trickTargetsFor(state, player).length) {
          emit();
          if (!(await tick(700, era))) return;
          steal(player, botTrick(player));
        }
        endTricks(player);
        continue;
      }
      if (state.market.length === 0) {
        state.draft.index++;
        continue;
      }
      const kind = awardKind(player);

      // El tutorial esconde el centro hasta la ronda en que lo enseña.
      if (state.tutorial && state.tutorialSkipDraft) {
        nextDrafter();
        continue;
      }

      // Pegada con la Scotch Tape no hay reparto: solo las cartas de regalo, si hay.
      if (kind === 'taped' && state.draft.step === 'normal' && !openBonus(player)) continue;

      if (isBot(player) && state.draft.step === 'bonus') {
        await botBonus(player, era);
        if (era !== epoch) return;
        continue;
      }

      if (isBot(player)) {
        if (state.tutorial) {
          nextDrafter();
          continue;
        }
        emit();
        if (!(await tick(700, era))) return;
        if (canRenew(player) && renewsMarket(state.difficulty)) {
          renew(player);
          emit();
          if (!(await tick(700, era))) return;
        }
        // Decide la rama una vez —poder, o cartas sin poder— y después vuelve a
        // mirar el centro entre carta y carta: la reposición puede ofrecerle algo
        // mejor que lo que había al empezar.
        //
        // "Fácil" a veces no piensa: agarra cualquier carta que pueda (ver `sloppyDraft`).
        const careless = sloppyDraft(state.difficulty) > 0 && sloppyDraft(state.difficulty) > rng();
        const plan = careless ? carelessPlan(player, kind) : planDraft(draftableFor(state, player), cardsOf(player), { kind });
        state.draft.mode = plan.mode;
        let took = 0;
        if (plan.mode === 'power') {
          takeFromMarket(player, plan.cards[0]);
          took++;
        } else {
          for (let n = 0; n < plan.cards.length && plainCards().length; n++) {
            const plain = plainCards();
            takeFromMarket(player, careless ? plain[Math.floor(rng() * plain.length)] : pickBest(plain, cardsOf(player)));
            took++;
          }
        }
        // Y las cartas de regalo (Earth Stamp, pulpos), de a una y a la vista.
        if (openBonus(player)) {
          await botBonus(player, era);
          if (era !== epoch) return;
        }
        continue;
      }

      // Al jugador se le prepara la elección y se espera a que actúe desde la UI.
      armClock(player, 'draft');
      if (state.draft.step === 'bonus') { emit(); return; }
      state.draft.took = 0;
      if (kind === 'bust') {
        state.draft.mode = 'plain';
        state.draft.remaining = 1;
      } else {
        // Sin modo: la carta que toque lo decide (ver `takeCard`).
        state.draft.mode = null;
        state.draft.remaining = 0;
      }
      emit();
      return;
    }

    state.draft = null;
    stopClock();
    await afterDraft(era);
  }

  /**
   * El asiento que la pantalla está manejando ahora mismo: el que está eligiendo del
   * centro, salvo que lo juegue la máquina. Contra la CPU es siempre `p1`; en una sala
   * es el que acaba de atacar.
   */
  const drafter = () => drafterOf(state);

  /**
   * Quién pidió la acción tiene que ser quien está jugando.
   *
   * Contra la máquina no hay a quién comprobarle nada: hay un solo par de manos, `as`
   * no viene y vale cualquiera. En una sala viene siempre, y es lo único que impide que
   * el celular juegue el turno de la computadora — el estado vive en el servidor, así
   * que esta es la línea que lo defiende.
   */
  const allowed = (player, as) => Boolean(player) && (!as || as === player);

  function renewMarket(as) {
    const player = drafter();
    if (!allowed(player, as) || !canRenew(player)) return;
    if (state.tutorial && !state.tutorialAllowRenew) return;
    renew(player);
    armClock(player, 'draft');
    emit();
  }

  /** Lo que el jugador que elige puede tocar ahora mismo en el centro. */
  function pickable() {
    const player = drafter();
    if (!player) return [];
    let list = draftable(player);
    if (state.tutorial && state.tutorialAllowedCard) {
      return list.filter((c) => c.uid === state.tutorialAllowedCard);
    }
    if (state.tutorial && state.tutorialPlainOnly) list = list.filter((c) => !c.power);
    // El centro de la ronda que enseña a mirar el color ofrece solo cartas con el
    // símbolo del que elige: lo que se lleve tiene que enlazar con su mazo, porque el
    // guión de las rondas siguientes lo usa para alargar la cadena.
    if (state.tutorial && state.tutorialOwnColor) {
      list = list.filter((c) => c.symbols.includes(state.symbols[player]));
    }
    return list;
  }

  /**
   * Qué se lleva el jugador según la carta que tocó, sin preguntarle nada antes: una
   * carta con poder cierra el reparto ahí mismo; una sin poder deja pendiente una
   * segunda, que tampoco va a poder llevar poder.
   */
  const inferMode = (card) => (card.power ? 'power' : 'plain');

  async function takeCard(uid, as) {
    const player = drafter();
    if (!allowed(player, as)) return;
    if (state.tutorial && state.tutorialAllowedCard && uid !== state.tutorialAllowedCard) return;
    const card = pickable().find((c) => c.uid === uid);
    if (!card) return;
    if (state.tutorial && state.tutorialPlainOnly && card.power) return;
    const era = epoch;

    if (state.draft.step === 'bonus') {
      takeBonus(player, card);
      if (state.draft.bonus > 0 && state.market.length > 0) { emit(); return; }
      if (state.draft.bonus > 0) dropBonus(player);
      // Después de las de la Earth Stamp pueden venir las de los pulpos.
      if (openBonus(player) && state.market.length > 0) {
        armClock(player, 'draft');
        emit();
        return;
      }
      await runDraft(era);
      return;
    }

    if (!state.draft.mode) {
      state.draft.mode = inferMode(card);
      state.draft.remaining = state.draft.mode === 'power' ? 1 : 2;
    }
    takeFromMarket(player, card);
    state.draft.took++;
    state.draft.remaining--;
    if (state.draft.remaining > 0 && state.market.length > 0) {
      emit();
      return;
    }
    // Las cartas del pulpo son otra elección, y traen su propio reloj.
    if (openBonus(player) && state.market.length > 0) {
      armClock(player, 'draft');
      emit();
      return;
    }
    await runDraft(era);
  }

  /** Cierra el reparto del jugador sin llevarse nada más. */
  async function skipDraft(as) {
    const player = drafter();
    if (!allowed(player, as)) return;
    if (state.tutorial && state.tutorialDisallowSkip) return;
    const era = epoch;

    // Rechazar la carta del pulpo gasta la reserva. Es gratis y sirve cualquier carta,
    // así que no tomarla es una decisión rara; pero si no se gastara, un pulpo sin usar
    // se arrastraría de ronda en ronda para siempre.
    if (state.draft.step === 'bonus') {
      const n = state.draft.bonus;
      const by = state.draft.bonusBy;
      const passMsg = by === 'stamp'
        ? (voice(player).you ? tr('Dejás pasar la carta de la Earth Stamp.') : tr('{who} deja pasar la carta de la Earth Stamp.', { who: who(player) }))
        : voice(player).you
          ? (n === 1 ? tr('Dejás pasar la carta del pulpo.') : tr('Dejás pasar las {n} cartas del pulpo.', { n }))
          : (n === 1
            ? tr('{who} deja pasar la carta del pulpo.', { who: who(player) })
            : tr('{who} deja pasar las {n} cartas del pulpo.', { who: who(player), n }));
      log(`${powerIcon(by, 'sm')} ${passMsg}`, 'muted');
      dropBonus(player);
      if (openBonus(player) && state.market.length > 0) {
        armClock(player, 'draft');
        emit();
        return;
      }
      await runDraft(era);
      return;
    }

    // Sin robar nada: el Trickster se pierde y se pasa al centro.
    if (state.draft.step === 'trick') {
      powerLog('trickster', tr("Trickster's Card: no roba nada."), 'muted');
      endTricks(player);
      await runDraft(era);
      return;
    }

    const you = voice(player).you;
    log(
      state.draft.took
        ? (you ? tr('Te quedás con lo que ya agarraste.') : tr('{who} se queda con lo que ya agarró.', { who: who(player) }))
        : (you ? tr('No te llevás nada del centro.') : tr('{who} no se lleva nada del centro.', { who: who(player) })),
      'muted',
    );
    if (openBonus(player) && state.market.length > 0) {
      armClock(player, 'draft');
      emit();
      return;
    }
    await runDraft(era);
  }

  /** Le roba una carta con poder al rival (Trickster's Card). */
  async function stealCard(uid, as) {
    const player = drafter();
    if (!allowed(player, as) || state.draft?.step !== 'trick') return;
    const card = trickTargetsFor(state, player).find((c) => c.uid === uid);
    if (!card) return;
    steal(player, card);
    if (state.status[player].tricks > 0 && trickTargetsFor(state, player).length) {
      armClock(player, 'draft');
      emit();
      return;
    }
    endTricks(player);
    await runDraft(epoch);
  }

  /** Las cartas del rival que el que elige puede robar ahora mismo. */
  function trickTargets() {
    const player = drafter();
    return player && state.draft?.step === 'trick' ? trickTargetsFor(state, player) : [];
  }

  // ---- acciones del jugador ----

  /**
   * El asiento que está jugando y al que la pantalla le puede dar órdenes: el del
   * turno, salvo que lo juegue la máquina. Es uno solo: nunca les toca a los dos a la
   * vez, y en una sala cada aparato además solo maneja el suyo (ver `allowed`).
   */
  const acting = () => actingOf(state);

  /**
   * El mismo, pero solo si además puede apretar **ahora**: entre la carta que cae y el
   * repintado el turno queda ocupado, y en esa ventana los botones no valen. La
   * pantalla necesita las dos cosas por separado —el medidor de la próxima carta sigue
   * puesto mientras el turno es tuyo, aunque justo no puedas tocar nada—.
   */
  const canAct = () => (state && !state.busy ? acting() : null);

  async function hit(as, targetCol = null) {
    const player = canAct();
    if (!allowed(player, as)) return;
    // Con el Rocket esperando, robar lo pone: en la columna pedida o donde más suma.
    if (state.pendingStack) {
      const pending = state.pendingStack;
      if (pending.player === player) {
        await chooseStackTarget(targetCol ?? bestStack(state.chains[player], pending.card), as);
      }
      return;
    }
    if (state.tutorial && state.tutorialAllowed && state.tutorialAllowed !== 'hit' && state.tutorialAllowed !== 'any') return;
    const era = epoch;
    state.busy = true;
    // Una Novice Spell sin elegir sale como golpe antes de la carta que sigue.
    settleSpell(player);
    // La carta que sigue puede ser el K.O.: primero la pregunta (ver `oneMoreOf`).
    const gamble = oneMoreOf(state, player);
    if (gamble && !(await askOneMore(player, era))) return;
    emit();
    const card = draw(player);
    onDraw(player, card);

    // El Rocket Stamp no se encadena ni corta: es gratis y se monta sobre la columna
    // que elija el jugador. Si no vino una elegida, queda esperando a que la elija. En
    // "¿una más?" no espera: va donde más suma, y ahí se ve si alcanzó.
    const chain = state.chains[player];
    if (isFreeStack(card) && chain.cards.length > 0) {
      if (Number.isInteger(targetCol) && targetCol >= 0 && targetCol < chain.cards.length) {
        stackCard(player, targetCol, card);
      } else if (gamble) {
        stackCard(player, bestStack(chain, card), card);
      } else {
        state.pendingStack = { player, card };
        const drewMsg = voice(player).you
          ? tr('Rocket Stamp gratis: elegí sobre qué carta ponerlo.')
          : tr('Rocket Stamp gratis: {who} elige sobre qué carta ponerlo.', { who: who(player) });
        log(`${powerIcon('freegame', 'sm')} ${drewMsg}`, player);
      }
    } else {
      const played = await extend(player, mirrored(player, card), 700, era);
      if (!played) return;
      if (played === 'saved') {
        state.busy = false;
        emit();
        return;
      }
    }
    if (gamble && (await settleOneMore(player, era))) return;
    state.busy = false;
    emit();
  }

  /** El dueño de la Novice Spell elige qué hace: `'heal'`, `'shield'` o `'hit'`. */
  function chooseSpell(kind, as) {
    const pending = state?.pendingSpell;
    if (!pending || !allowed(pending.player, as) || !['heal', 'shield', 'hit'].includes(kind)) return;
    state.pendingSpell = null;
    castSpell(pending.player, kind, pending.count);
    emit();
  }

  async function chooseStackTarget(colIndex, as) {
    if (!state || !state.pendingStack) return;
    const { player, card } = state.pendingStack;
    if (!allowed(player, as)) return;
    // Viene del cable en una sala: `NaN` pasaba las dos comparaciones y la carta se perdía.
    if (!Number.isInteger(colIndex) || colIndex < 0 || colIndex >= state.chains[player].cards.length) return;
    if (state.tutorial && state.tutorialAllowedCol != null && colIndex !== state.tutorialAllowedCol) return;
    state.pendingStack = null;
    stackCard(player, colIndex, card);
    emit();
  }

  async function stand(as) {
    const player = canAct();
    if (!allowed(player, as)) return;
    if (state.tutorial && state.tutorialAllowed && state.tutorialAllowed !== 'stand' && state.tutorialAllowed !== 'any') return;
    // Un Rocket Stamp sin columna elegida (el jugador atacó o se le acabó el reloj) se
    // monta donde más suma: es gratis, no se pierde.
    const pending = state.pendingStack;
    if (pending?.player === player) {
      state.pendingStack = null;
      stackCard(player, bestStack(state.chains[player], pending.card), pending.card);
    }
    state.pendingStack = null;
    const era = epoch;
    state.busy = true;
    const points = scoreChain(state.chains[player]).total;
    log(voice(player).you
      ? tr('Soltás el ataque con {points}.', { points })
      : tr('{who} suelta el ataque con {points}.', { who: who(player), points }), player);
    await finishTurn(player, points, era);
  }

  /**
   * Adelanta el cierre del intercambio. La ronda siguiente arranca sola (ver
   * `endRound`); esto es para no esperarla —el Enter de la UI, y los tests—.
   */
  async function nextRound() {
    if (!state || state.phase !== 'roundEnd') return;
    await startRound(epoch);
  }

  /**
   * `player` se va de la partida. Se cierra en el acto —lo que estaba en curso se
   * corta, reloj incluido— y gana el que se quedó, en la ronda que sea: irse es dar la
   * partida por perdida.
   *
   * Solo lo usan las salas: contra la CPU irse es volver al menú, y no hay a quién
   * darle nada.
   */
  function forfeit(player) {
    if (!state || state.phase === 'matchEnd' || !PLAYERS.includes(player)) return;
    // La época cambia para que las corrutinas de la ronda en curso —la carta que cae,
    // el cierre que arranca la siguiente— se corten en vez de seguir jugando sin nadie.
    epoch++;
    stopClock();
    const winner = other(player);
    state.forfeit = { by: player, winner };
    state.phase = 'matchEnd';
    state.turn = null;
    state.draft = null;
    state.busy = false;
    log(voice(player).you
      ? tr('Abandonás la partida. Gana {winner}.', { winner: whom(winner) })
      : tr('{who} abandona la partida. Gana {winner}.', { who: who(player), winner: whom(winner) }), 'round');
    emit();
  }

  /**
   * Levantarse de la mesa: la partida deja de existir. Es lo que hace el que vuelve al
   * menú en el medio —contra la CPU, en la Aventura o en el tutorial—, donde no hay a
   * quién darle la victoria: enfrente está la máquina. Lo que estaba en curso se corta
   * —reloj, corrutinas de la ronda, turnos de la máquina— y la mesa queda vacía, como
   * antes de la primera partida. En una sala irse es abandonar, y eso es `forfeit`.
   */
  function abortMatch() {
    if (!state) return;
    // La época cambia para que lo que está andando —la carta que cae, el turno de la
    // máquina, el cierre de la ronda— se corte en vez de seguir jugando solo.
    epoch++;
    clearTimeout(alarm);
    state = null;
    // Sin `emit`: acá no hay estado que mandar, y los que miran la partida esperan
    // siempre uno (ver `subscribe` y `refresh`). Desarmar la mesa es de quien la pinta
    // (ver el `abortMatch` que devuelve `mount` en `ui.js`).
  }

  return {
    get state() {
      return state;
    },
    unseenPool,
    pickable,
    drafting,
    drafter,
    acting,
    canRenew,
    /** Vuelve a pintar el estado actual sin tocarlo. Sin partida no hay nada que pintar. */
    refresh: () => { if (state) emit(); },
    subscribe(fn) {
      listeners.add(fn);
      if (state) fn(state);
      return () => listeners.delete(fn);
    },
    newMatch,
    hit,
    stand,
    chooseStackTarget,
    chooseSpell,
    nextRound,
    takeCard,
    skipDraft,
    renewMarket,
    stealCard,
    trickTargets,
    forfeit,
    abortMatch,
  };
}
