// La portada: lo primero que se ve al abrir el juego.
//
// Antes el juego arrancaba solo. Se abría la página y ya había una partida contra la
// CPU andando, con los selectores de modo y dificultad perdidos entre los botones de
// arriba: para jugar contra otra persona había que darse cuenta de que ahí había un
// desplegable, cambiarlo, y ver cómo la partida que estabas mirando se reiniciaba sola.
// Eso no es un juego, es un formulario que además baraja cartas.
//
// Acá hay tres pantallas y dos puertas:
//
//   la portada  el terreno, los Axies del roster paseándose por ahí, y dos botones:
//               jugar a la derecha y tu Axie a la izquierda.
//   el menú     contra quién: la máquina, o alguien en otro aparato. Detrás del botón
//               de jugar, y de ahí sale la partida.
//   la elección con qué Axie. Detrás del botón de la izquierda.
//
// Las dos preguntas se hacen antes de jugar y no durante, que es de donde vienen: el
// Axie se elegía de un roster chiquito arriba en la barra, con la partida ya andando,
// y tocarlo la reiniciaba de cero. Elegir un Axie es elegir el mazo con el que vas a
// jugar —la clase es el mazo—, así que es una decisión de antes de empezar, y se toma
// mirándolos grandes. Sentado a la mesa lo único que se hace es jugar.
//
// Pero son dos preguntas distintas y no dos escalones de la misma escalera, y por eso
// no van una detrás de la otra. "Contra quién" se contesta cada vez que te sentás a
// jugar; "con cuál" se contesta una vez y queda. Colgada del camino de jugar, la
// elección volvía a preguntar lo mismo antes de cada partida —seis bichos, siempre el
// mismo— y encima obligaba a pasar por el menú para mirarlos. Suelta en la portada es
// **tu Axie**: la abrís cuando querés, cambiás o no cambiás, y el botón de jugar
// arranca sin preguntar nada. Es también lo que la deja crecer: es la pantalla de tu
// bicho, y ahí es donde van a vivir las mejoras temporales.
//
// Y no hay excepciones: las dos preguntas son tuyas y se contestan acá. Hubo una
// tercera opción —dos personas en el mismo teclado— y con ella un tercer paso: el
// Jugador 2 elegía su Axie en el medio del camino de jugar, porque no tenía portada
// propia. Se fue el modo y se fue el paso. Jugar con otra persona es una sala, y ahí
// cada uno elige en su aparato.
//
// El paseo es todo el punto de la portada. Los Axies ya traían las animaciones hechas
// —`npm run poses` hornea también `walk`, que es el `action/run` del kit— y lo único
// que falta es llevarlos de un lado a otro: el clip mueve las patas en el lugar y esto
// mueve el lugar. Cada uno camina por su cuenta, se para donde se le da la gana, se
// queda un rato haciendo nada —y ahí `axie-motion.js` lo hace aburrirse solo, que es
// de donde salen los rascados y los bostezos— y arranca de nuevo.
import { AXIE_IDS, AXIES, axie, axieArt, deckFor } from './axies.js';
import { createMotion } from './axie-motion.js';
import { POWERS, SYMBOLS, SYMBOL_IDS, boostOptions, crest, powerIcon } from './data.js';
import { readLoadout, writeLoadout } from './loadout.js';
import { netAvailable } from './net.js';
import { createTutorial } from './tutorial.js';
import {
  ADVENTURE_LEVELS, getAdventureProgress, getAdventureLevel, isLevelUnlocked,
} from './adventure.js';
import { createPowerDemoController } from './power-demos.js';

// `el` y no `$` como en `ui.js` ni `byId` como en `net.js`: el build de un solo
// archivo concatena los módulos sin envolverlos, así que dos nombres iguales en
// archivos distintos chocan (ver `build.mjs`).
const el = (id) => document.getElementById(id);

/** Cuántos Axies se pasean. */
const CAST_SIZE = 4;

/**
 * Cuánto camina un Axie de una parada a la siguiente, en fracciones del ancho del
 * terreno. El mínimo es lo que hace falta para que se lea como "se fue hasta allá" y
 * no como un pasito nervioso.
 */
const STRIDE = [0.18, 0.62];
/** A qué velocidad, en fracciones del ancho por segundo. Es un paseo, no una carrera. */
const SPEED = 0.085;
/**
 * Cuánto se queda quieto al llegar, en ms. El piso está puesto contra el aburrimiento
 * de `axie-motion.js`, que larga un emote —rascarse, gruñir, un saltito— entre los 5 y
 * los 11 segundos de estar respirando: con paradas más cortas que eso, salir a caminar
 * le cancelaba el gesto siempre y los Axies no hacían más que ir y venir.
 */
const REST = [2200, 9000];
/** Cuánto puede cambiar de carril —de profundidad— en un viaje. */
const DRIFT = 0.5;

const clamp01 = (n) => Math.min(1, Math.max(0, n));

/**
 * El próximo paseo de un Axie que está en `from`: adónde va, por qué carril, hacia
 * dónde mira, cuánto tarda en llegar y cuánto se queda parado después.
 *
 * `x` es dónde está a lo ancho del terreno y `lane` a qué profundidad, de 0 —contra el
 * horizonte, chiquito— a 1 —adelante de todo, grande—. Las dos van de 0 a 1 y no en
 * píxeles porque el terreno es la ventana: se estira con ella y los bichos no tienen
 * que enterarse.
 *
 * Si el destino se sale del terreno se va para el otro lado, que es lo que hace
 * cualquiera al llegar a una pared. Rebotar así —y no recortar contra el borde— es lo
 * que evita que se junten todos en las esquinas.
 *
 * Está separado del resto y devuelve un objeto en vez de mover nada porque es lo único
 * de la portada que se puede probar sin un navegador.
 */
export function nextStroll({ x, lane }, rnd = Math.random) {
  const span = STRIDE[0] + rnd() * (STRIDE[1] - STRIDE[0]);
  let to = x + (rnd() < 0.5 ? -span : span);
  if (to < 0 || to > 1) to = x - (to - x); // rebota
  to = clamp01(to);
  return {
    x: to,
    lane: clamp01(lane + (rnd() - 0.5) * DRIFT),
    // Los Axies vienen dibujados mirando a la izquierda: el que va para el otro lado
    // se da vuelta. Caminar de espaldas al rumbo es lo primero que se nota.
    face: to > x ? 'right' : 'left',
    ms: Math.round((Math.abs(to - x) / SPEED) * 1000),
    rest: Math.round(REST[0] + rnd() * (REST[1] - REST[0])),
  };
}

/** El sistema pidiendo menos movimiento. Ahí los Axies se quedan quietos donde están. */
const stillness = () =>
  Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

/** Unos cuantos Axies del roster, distintos entre sí y en otro orden cada vez. */
function cast(size, rnd = Math.random) {
  const ids = [...AXIE_IDS];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, size);
}

/**
 * Un Axie paseándose. Se dibuja una sola vez y de ahí en más lo único que cambia son
 * dos variables CSS: dónde está y en cuánto tiempo llega. El movimiento lo hace la
 * transición del navegador, no un temporizador que reparte píxeles — un `setTimeout`
 * cada 16 ms para mover cuatro bichos es la manera más segura de que la portada
 * empiece a tironear.
 */
function createStroller(host, id, start) {
  const node = document.createElement('div');
  node.className = 'lobby-axie';
  node.dataset.face = 'left';
  node.innerHTML = axieArt(id);
  host.appendChild(node);

  const motion = createMotion(node, Math.random());
  let at = start;
  let timer = 0;

  function place() {
    node.style.setProperty('--x', String(at.x));
    node.style.setProperty('--lane', String(at.lane));
    // El que está más adelante tapa al que está más atrás. Sale del carril y no del
    // orden en que se dibujaron: se cruzan todo el tiempo.
    node.style.zIndex = String(Math.round(at.lane * 100));
  }

  function step() {
    const next = nextStroll(at);
    at = next;
    node.dataset.face = next.face;
    node.style.setProperty('--dur', `${next.ms}ms`);
    place();
    motion.stance('walk');
    timer = setTimeout(() => {
      // Parado deja de caminar y vuelve a respirar; de ahí en más se aburre solo.
      motion.stance('idle');
      timer = setTimeout(step, next.rest);
    }, next.ms);
  }

  place();
  return {
    /** Empieza a pasearse. Se llama cada vez que la portada vuelve a la pantalla. */
    wake() {
      motion.mount(id);
      if (stillness()) return;
      clearTimeout(timer);
      // Escalonados, pero no tanto: cuatro bichos arrancando a caminar a la vez se ven
      // como un desfile, y cuatro que tardan diez segundos en moverse, como un dibujo.
      timer = setTimeout(step, Math.random() * 2500);
    },
    /** Se queda quieto. Con la portada tapada no hay para quién moverse. */
    sleep() {
      clearTimeout(timer);
      motion.stop();
    },
  };
}

// ---- la elección de Axie ------------------------------------------------------

/**
 * Cuántas veces aparece cada símbolo en un mazo, de mayor a menor.
 *
 * Es el número que dice para qué sirve un Axie. Los diez mazos iniciales tienen la
 * misma forma —cinco pares del color propio, uno solo y cuatro cartas ajenas—, así que
 * lo único que los distingue es **de qué color** son esas repeticiones: seis del propio
 * y de tres para abajo del resto. Puesto como cuenta, elegir un Axie deja de ser elegir
 * un dibujo.
 *
 * Ordenado por cantidad y no por el orden fijo de los símbolos: así el color propio
 * queda siempre primero, sin tener que decirlo aparte.
 */
export function symbolTally(cards) {
  const count = new Map();
  for (const card of cards) {
    for (const sym of card.symbols) count.set(sym, (count.get(sym) ?? 0) + 1);
  }
  return [...count.entries()]
    .map(([symbol, n]) => ({ symbol, n }))
    .sort((a, b) => b.n - a.n || SYMBOL_IDS.indexOf(a.symbol) - SYMBOL_IDS.indexOf(b.symbol));
}

/**
 * "Reptil ×2 y Pez": lo que trae la carta, sin repetir el nombre dos veces.
 *
 * No se llama `cardLabel` —que es lo que hace el mismo trabajo en `data.js`— porque el
 * build de un solo archivo concatena los módulos sin envolverlos y dos funciones con el
 * mismo nombre chocan (ver `build.mjs`, y el `el` de más arriba).
 */
function slotTitle(card) {
  return [...new Set(card.symbols)]
    .map((s) => {
      const n = card.symbols.filter((x) => x === s).length;
      return n > 1 ? `${SYMBOLS[s].name} ×${n}` : SYMBOLS[s].name;
    })
    .join(' y ');
}

/**
 * El botón de (+) de una carta: la mejora del Axie, que es un símbolo de más.
 *
 * Son tres estados y no uno, porque las cartas no admiten lo mismo (ver `boostOptions`
 * en `data.js`):
 *
 *   sin mejorar, un solo candidato  las seis cartas de tu clase solo admiten el tuyo,
 *                                   así que el botón lo muestra y lo pone de una: un
 *                                   menú de una opción es un clic de más.
 *   sin mejorar, dos candidatos     las cuatro no favorables admiten cualquiera de sus
 *                                   dos símbolos, y ahí hay algo que elegir: el (+)
 *                                   abre los dos crests ahí mismo, debajo de su carta.
 *                                   Un menú flotante, sobre un panel que además
 *                                   scrollea, se abre lejos de la carta de la que
 *                                   habla.
 *   mejorada                        el símbolo que le pusiste, con una × para sacarlo.
 *                                   Se deshace en el mismo lugar donde se hizo.
 */
function boostHtml(base, own, added, open) {
  const options = boostOptions(base, own);
  const btn = (attrs, cls, inner, title) =>
    `<button class="boost-btn${cls}" ${attrs} title="${title}">${inner}</button>`;

  if (added) {
    return btn(`data-boost="clear" data-key="${base.key}"`, ' is-on',
      `${crest(added)}<b class="boost-sign">×</b>`,
      `Sacarle el ${SYMBOLS[added].name} de más`);
  }
  if (options.length === 1) {
    return btn(`data-boost="add" data-key="${base.key}" data-sym="${options[0]}"`, '',
      `<b class="boost-sign">+</b>${crest(options[0])}`,
      `Sumarle otro ${SYMBOLS[options[0]].name}`);
  }
  if (open) {
    return options
      .map((s) => btn(`data-boost="add" data-key="${base.key}" data-sym="${s}"`, '',
        crest(s), `Sumarle otro ${SYMBOLS[s].name}`))
      .join('');
  }
  return btn(`data-boost="open" data-key="${base.key}"`, '',
    '<b class="boost-sign">+</b>', 'Sumarle uno de sus dos símbolos');
}

/**
 * Una carta del mazo inicial con su botón de mejora debajo.
 *
 * La carta va en el mismo formato en que se va a ver en la mesa —son las mismas
 * cartas— y ya viene con la mejora puesta: lo que se ve es el mazo con el que vas a
 * jugar, no el de fábrica más una promesa. Los símbolos van todos encendidos porque
 * acá no hay cadena que apagarlos: es la carta como objeto, no como jugada.
 *
 * `card--deck` le saca el hueco de arriba donde en la mesa va el número de la carta:
 * acá no hay orden, se ve el mazo entero de una.
 *
 * `base` es la carta sin mejorar, que es de donde salen la clave y los candidatos;
 * `card` es la que se dibuja.
 */
function deckSlotHtml(base, card, own, added, open) {
  const syms = card.symbols
    .map((s) => `<span class="sym" data-on="true" style="--c:${SYMBOLS[s].color}">${crest(s)}</span>`)
    .join('');
  return `<div class="deck-slot" data-boosted="${Boolean(added)}">
    <div class="card card--deck" title="${slotTitle(card)}">${syms}</div>
    <div class="card-boost">${boostHtml(base, own, added, open)}</div>
  </div>`;
}

/**
 * La portada, montada sobre el HTML que ya está en la página.
 *
 * @param {{restart: (setup?: object) => void}} ui  la pantalla del combate, que es
 *   quien sabe arrancar una partida (ver `mount` en `ui.js`). En una sala no hay
 *   ninguna que arrancar acá —la partida vive en el servidor— y va en `null`.
 * @param {{net?: boolean, onPick?: () => void}} opts  `net` es la portada de la
 *   pantalla de las salas: de todo esto se usa **una sola** de sus tres pantallas, la
 *   elección de Axie, y se abre encima de la sala. No hay tapa ni menú —a la sala ya
 *   entraste— ni puertas de vuelta, y elegir cierra en vez de volver a la tapa.
 *   `onPick` es que elegiste otro: lo escucha la sala, que tiene que contárselo al
 *   servidor antes de que reparta.
 */
export function createLobby(ui, { net = false, onPick = null } = {}) {
  const lobby = el('lobby');
  const front = el('lobby-front');
  const menu = el('lobby-menu');
  const choose = el('lobby-choose');
  const adv = el('lobby-adventure');
  const advBack = el('lobby-adventure-back');
  const advLevels = el('adventure-levels');
  const advCard = el('adventure-card');
  const board = el('lobby-cast');
  let strollers = null;
  let selectedAdvLevel = 1;
  /** Lo que elegiste la última vez, si esta máquina se acuerda (ver `loadout.js`). */
  const saved = readLoadout();
  /**
   * Con qué Axie jugás.
   *
   * Se sortea la primera vez y de ahí en más es tuyo: se queda entre partidas, se
   * queda entre visitas, y se cambia en su pantalla. Arranca puesto y no en blanco
   * porque el botón de jugar no pregunta nada — el que abre el juego y aprieta jugar
   * tiene que poder jugar, y el que quiere elegir tiene el otro botón ahí al lado.
   *
   * Es uno solo desde que se fue el modo de dos en el mismo teclado: el segundo asiento
   * de una sala lo elige en su propio aparato, en esta misma pantalla.
   */
  let pick = saved?.axie ?? AXIE_IDS[Math.floor(Math.random() * AXIE_IDS.length)];
  /**
   * Las mejoras de cada Axie: de su id a `{ clave de la carta: símbolo que se le suma }`
   * (ver `buildPersonalDeck` en `data.js`).
   *
   * Guardadas por bicho y no por asiento porque son del bicho: te vas a mirar los otros
   * cinco, volvés, y tu mazo está como lo dejaste. Las del que tenés puesto se guardan
   * con él; las de los otros cinco duran lo que dure la página, que es lo que dura
   * mirarlos.
   */
  const boosts = saved ? { [saved.axie]: saved.boosts } : {};
  /**
   * De qué carta están abiertos los dos candidatos. Solo una a la vez: son los dos
   * símbolos de *esa* carta, y dos juegos de crests abiertos al mismo tiempo no dicen
   * cuál es cuál. Se cierra al elegir, al sacar una mejora y al cambiar de Axie.
   */
  let boostOpen = null;
  /** Cuál de los seis se está mirando: un índice sobre `pool()`. */
  let at = 0;
  /** El Axie grande, respirando. Es el mismo reproductor de la mesa y del paseo. */
  const heroMotion = createMotion(el('lobby-choose-art'), 0);

  /**
   * El terreno de la portada y quiénes andan por él. Se sortea al abrir la página: son
   * seis fondos y seis Axies, y verlos siempre en el mismo hace que el juego parezca
   * más chico de lo que es. El terreno es el del primero del reparto, así que el que
   * abre la escena está en su casa.
   */
  function populate() {
    const ids = cast(CAST_SIZE);
    lobby.dataset.arena = axie(ids[0]).class;
    strollers = ids.map((id, i) =>
      createStroller(board, id, {
        // Repartidos a lo ancho, cada uno con su lugar y un empujón al azar para que
        // no se lea la fila. El carril arranca sorteado: unos adelante, otros contra
        // el horizonte.
        x: clamp01((i + 0.5) / ids.length + (Math.random() - 0.5) * 0.18),
        lane: Math.random(),
      }));
  }

  /** Qué pantalla de la portada se ve: el botón grande, el menú o la elección. */
  function view(which) {
    lobby.dataset.view = which;
    front.hidden = which !== 'front';
    menu.hidden = which !== 'menu';
    choose.hidden = which !== 'choose';
    if (adv) adv.hidden = which !== 'adventure';
    // El Axie grande deja de respirar al salir de su pantalla: un clip en bucle sobre
    // un nodo que nadie está viendo es trabajo que el navegador hace para nadie.
    if (which !== 'choose') heroMotion.stop();
  }

  /**
   * Entre cuáles se puede elegir: los seis, sin restas.
   *
   * Hubo una: al Jugador 2 del teclado compartido le faltaba el del primero, porque las
   * clases tienen que ser distintas. Ese asiento ya no elige acá —el de una sala elige
   * en su aparato, y contra la CPU el suyo se sortea de otra clase (ver `newMatch`)—,
   * así que la vuelta es entera. Elegís tu Axie sin saber contra quién vas a jugar, que
   * es como tiene que ser: es tu bicho, no tu respuesta a algo.
   */
  const pool = () => AXIE_IDS;

  /** El que se está mirando ahora. */
  const shown = () => pool()[at] ?? pool()[0];

  /** Repinta la pantalla entera con el Axie que se está mirando. */
  function paintChoose() {
    const ring = pool();
    const id = ring[at];
    const a = AXIES[id];
    const sym = SYMBOLS[a.class];
    // Dos mazos: el de fábrica, de donde salen las claves y los candidatos de cada
    // botón, y el mejorado, que es el que se dibuja y el que se cuenta abajo. Van en el
    // mismo orden porque los arma la misma función.
    const bag = boosts[id] ?? {};
    const base = deckFor(id);
    const deck = deckFor(id, bag);

    el('lobby-choose-title').textContent = 'Elegí tu Axie';

    // El bicho grande. Se redibuja entero al cambiar de Axie —son otras capas— y el
    // reproductor tiene que volver a tomarlas: sin esto queda quieto, con las capas
    // del anterior anotadas.
    el('lobby-choose-art').innerHTML = axieArt(id);
    heroMotion.mount(id);

    el('lobby-choose-id').innerHTML = `<b class="choose-name">${a.name}</b>
      <span class="choose-class" style="--c:${sym.color}">${crest(a.class)}${sym.name}</span>
      <span class="choose-of">${ring.indexOf(id) + 1} de ${ring.length}</span>`;

    const boosted = base.filter((c) => bag[c.key]).length;
    el('lobby-choose-deck-label').textContent = boosted
      ? `Mazo inicial · 10 cartas · ${boosted} mejorada${boosted > 1 ? 's' : ''}`
      : 'Mazo inicial · 10 cartas · sumale un símbolo con el +';
    el('lobby-choose-deck').innerHTML = base
      .map((c, i) => deckSlotHtml(c, deck[i], a.class, bag[c.key], boostOpen === c.key))
      .join('');
    el('lobby-choose-tally').innerHTML = symbolTally(deck)
      .map(({ symbol, n }) => `<span class="tally" style="--c:${SYMBOLS[symbol].color}"
        title="${SYMBOLS[symbol].name}: ${n} en el mazo">${crest(symbol)}<b>${n}</b></span>`)
      .join('');

    // Qué pasa cuando apretás el botón. Es lo único que no se ve mirando la pantalla.
    el('lobby-choose-note').textContent = 'Con este vas a jugar hasta que lo cambies.';
  }

  /**
   * Deja anotado con qué jugás, para la próxima vez que se abra el juego y —sobre
   * todo— para la sala: a `?red` se entra por otra dirección y la página se recarga
   * entera, así que esto es lo único que cruza (ver `loadout.js`).
   */
  function remember() {
    writeLoadout(pick, boosts[pick] ?? {});
  }

  /**
   * El botón de la portada, con el nombre del que tenés puesto colgando abajo. Es lo
   * único que queda del Axie elegido cuando la pantalla de elección se cierra: sin
   * esto, la elección se hunde y no hay dónde ver con qué estás jugando.
   */
  function paintFront() {
    const a = AXIES[pick];
    el('lobby-loadout-now').innerHTML =
      `${crest(a.class, 'sm')}<b>${a.name}</b>`;
  }

  /** Deja la vuelta parada en un Axie, o en el primero libre si ese ya no está. */
  function focusOn(id) {
    const ring = pool();
    at = Math.max(ring.indexOf(id), 0);
  }

  /** Un lugar para adelante o para atrás en la vuelta. Da la vuelta entera: es un aro. */
  function browse(step) {
    const ring = pool();
    at = (at + step + ring.length) % ring.length;
    boostOpen = null;
    paintChoose();
  }

  /**
   * El (+) de una carta. Tres cosas, según el botón que se haya tocado: abrir los dos
   * candidatos de una carta no favorable, poner el símbolo, o sacarlo.
   *
   * Nada de esto se valida acá: `buildPersonalDeck` solo pone lo que la carta admite,
   * así que la pantalla puede ofrecer y el mazo decide. Y todo termina repintando la
   * pantalla entera —la carta, la cuenta de símbolos, el cartel— porque la mejora se
   * ve en los tres lados.
   */
  function boost(what, key, sym) {
    const bag = (boosts[shown()] ??= {});
    if (what === 'open') boostOpen = boostOpen === key ? null : key;
    else if (what === 'clear') { delete bag[key]; boostOpen = null; }
    else if (what === 'add') { bag[key] = sym; boostOpen = null; }
    // Mejorar el mazo del que ya tenés puesto es cambiar el mazo con el que jugás: se
    // guarda ahí mismo, sin pasar por el botón de elegir, que es de elegir bicho.
    if (shown() === pick) remember();
    paintChoose();
  }

  /** Abre la elección, parada en el Axie que tenés puesto. */
  function toChoose() {
    boostOpen = null;
    focusOn(pick);
    paintChoose();
    view('choose');
  }

  function toAdventure() {
    const progress = getAdventureProgress();
    if (!isLevelUnlocked(selectedAdvLevel)) {
      selectedAdvLevel = progress.unlockedLevel;
    }
    paintAdventure();
    view('adventure');
  }

  function paintAdventure() {
    if (!advLevels || !advCard) return;
    const progress = getAdventureProgress();
    const current = getAdventureLevel(selectedAdvLevel);
    const rivalAxie = AXIES[current.rival];
    const rivalSym = SYMBOLS[rivalAxie.class];

    advLevels.innerHTML = ADVENTURE_LEVELS.map((lvl) => {
      const unlocked = isLevelUnlocked(lvl.id);
      const completed = progress.completedLevels.includes(lvl.id);
      const active = lvl.id === selectedAdvLevel;
      const statusIcon = completed ? '★' : (unlocked ? `${lvl.id}` : '🔒');
      const cls = [
        'adv-level-btn',
        active ? 'active' : '',
        completed ? 'completed' : '',
        !unlocked ? 'locked' : '',
      ].filter(Boolean).join(' ');

      return `<button class="${cls}" data-adv-level="${lvl.id}" ${!unlocked ? 'disabled' : ''}>` +
        `<span class="adv-level-num">${statusIcon}</span>` +
        `<span class="adv-level-name">Nivel ${lvl.id}</span>` +
      `</button>`;
    }).join('');

    const isLevel1 = current.id === 1;
    const powersToShow = isLevel1 ? [...current.newPowers, 'freegame'] : current.newPowers;

    const powersHtml = powersToShow.map((pId) => {
      const p = POWERS[pId];
      if (!p) return '';
      const isNeutral = pId === 'freegame';
      const label = isNeutral ? `${p.name} (Comodín Neutral)` : p.name;
      const note = isNeutral
        ? 'Carta comodín apilable: no corta la cadena jamás y se monta sobre cualquier carta en mesa para extenderla.'
        : p.note;
      return `<div class="adv-power-item" data-power-id="${pId}" role="button" tabindex="0" title="Ver demostración de ${label}">` +
        `<div class="adv-power-icon">${powerIcon(pId, 'lg')}</div>` +
        `<div class="adv-power-text">` +
          `<b>${label} <span class="adv-power-demo-hint">🎬 Demo</span></b>` +
          `<p>${note}</p>` +
        `</div>` +
      `</div>`;
    }).join('');

    const completed = progress.completedLevels.includes(current.id);
    const diffLabel = current.difficulty === 'facil' ? 'Fácil' : current.difficulty === 'duro' ? 'Dura' : 'Normal';
    const sectionTitle = isLevel1
      ? 'Nuevos poderes y especiales en este nivel (+2 poderes + Free Game)'
      : 'Nuevos poderes en este nivel (+2)';

    advCard.innerHTML = `
      <div class="adv-card-header">
        <div class="adv-card-title-group">
          <span class="adv-badge ${completed ? 'adv-badge--won' : ''}">${completed ? '★ Nivel Superado' : 'Combate Disponible'}</span>
          <h2 class="adv-card-title">${current.name}</h2>
          <p class="adv-card-desc">${current.description}</p>
        </div>
      </div>

      <div class="adv-card-section">
        <h3 class="adv-section-title">${sectionTitle}</h3>
        <div class="adv-powers-grid">${powersHtml}</div>
      </div>

      <div class="adv-card-section">
        <h3 class="adv-section-title">Rival</h3>
        <div class="adv-rival-box">
          <div class="adv-rival-info">
            <span class="adv-rival-crest" style="--c:${rivalSym.color}">${crest(rivalAxie.class, 'sm')}</span>
            <b>${rivalAxie.name}</b>
            <span class="adv-rival-diff">Dificultad: ${diffLabel}</span>
          </div>
        </div>
      </div>

      <div class="adv-card-actions">
        <button class="btn btn-ghost adv-demo-btn" id="lobby-adventure-demo" type="button" title="Ver demostración de los poderes de este nivel">
          🎬 Ver demostración de poderes
        </button>
        <button class="lobby-play choose-go" id="lobby-adventure-play">
          ${completed ? 'Volver a Jugar' : 'Comenzar Nivel'}
        </button>
      </div>
    `;
  }

  function playAdventure(lvlId) {
    ui.restart({
      mode: 'adventure',
      adventureLevel: lvlId,
      axie: pick,
      boosts: boosts[pick] ?? {},
    });
    close();
  }

  /**
   * Empieza la partida contra la CPU con el Axie que tenés puesto, y se va de la
   * pantalla. Es el único modo que arranca desde acá: la sala es otra pantalla y se
   * entra por la URL (ver el `click` del menú, más abajo).
   */
  function play() {
    ui.restart({
      mode: 'cpu',
      difficulty: el('difficulty').value,
      axie: pick,
      // Las mejoras viajan al lado de su Axie: son de él, no del asiento. El de la
      // máquina se sortea en el momento y no lleva ninguna.
      boosts: boosts[pick] ?? {},
    });
    close();
  }

  /**
   * El botón grande de la elección: se queda con el que estabas mirando y ahí termina
   * —volvés a la portada con el bicho puesto, que es lo que fuiste a hacer—. No arranca
   * ninguna partida: el botón de jugar está del otro lado de la portada, y son dos
   * preguntas distintas (ver el comentario de arriba de todo).
   */
  function chooseGo() {
    pick = shown();
    remember();
    onPick?.();
    // En una sala esta pantalla es una visita: se abrió encima de la sala y al elegir
    // se va, porque atrás está lo que estabas haciendo. Acá atrás está la portada.
    if (net) return close();
    paintFront();
    view('front');
  }

  let activeTutorial = null;
  function cleanupTutorial() {
    if (activeTutorial) {
      activeTutorial.destroy();
      activeTutorial = null;
    }
  }

  function open(which = 'front') {
    cleanupTutorial();
    // El paseo es de la portada. En una sala se abre una sola de estas pantallas —la
    // elección—, y tapa el terreno entero: poner cuatro Axies a caminar detrás sería
    // trabajo que el navegador hace para nadie.
    if (!strollers && !net) populate();
    // En una sala no hay reparto que sortee el terreno —no hay nadie paseándose—, así
    // que lo pone el tuyo: la pantalla es tuya y el fondo es tu casa.
    if (net) lobby.dataset.arena = axie(pick).class;
    paintFront();
    // La elección se abre parada en el Axie que tenés puesto y con las diez cartas ya
    // dibujadas, venga del botón de la portada o de la sala: las dos cosas las hace
    // `toChoose`, así que abrir esa pantalla es pasar por ahí y no solo mostrarla.
    if (which === 'choose') toChoose();
    else if (which === 'adventure') toAdventure();
    else view(which);
    lobby.hidden = false;
    for (const s of strollers ?? []) s.wake();
  }

  function close() {
    lobby.hidden = true;
    heroMotion.stop();
    for (const s of strollers ?? []) s.sleep();
  }

  el('lobby-play').addEventListener('click', () => view('menu'));
  el('lobby-loadout').addEventListener('click', toChoose);
  el('lobby-back').addEventListener('click', () => view('front'));
  el('lobby-choose-back').addEventListener('click', () => (net ? close() : view('front')));
  advBack.addEventListener('click', () => view('menu'));
  adv.addEventListener('click', (e) => {
    const lvlBtn = e.target.closest('[data-adv-level]');
    if (lvlBtn) {
      selectedAdvLevel = Number(lvlBtn.dataset.advLevel);
      paintAdventure();
      return;
    }
    const demoBtn = e.target.closest('#lobby-adventure-demo') || e.target.closest('.adv-power-item');
    if (demoBtn) {
      const pId = demoBtn.dataset?.powerId || null;
      createPowerDemoController({ levelId: selectedAdvLevel, initialPower: pId });
      return;
    }
    const playBtn = e.target.closest('#lobby-adventure-play');
    if (playBtn) {
      playAdventure(selectedAdvLevel);
    }
  });
  el('lobby-prev').addEventListener('click', () => browse(-1));
  el('lobby-next').addEventListener('click', () => browse(1));
  function initSymbolsFilter() {
    const modal = el('symbols-modal');
    if (!modal || modal._symInit || !modal.addEventListener) return;
    modal._symInit = true;
    modal.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-sym-filter]');
      if (!btn) return;
      const filter = btn.dataset.symFilter;
      modal.querySelectorAll('[data-sym-filter]').forEach((b) => b.classList.toggle('active', b === btn));
      modal.querySelectorAll('.symbol-card').forEach((card) => {
        const match = filter === 'all' || card.dataset.symClass === filter;
        card.hidden = !match;
      });
    });
  }

  el('lobby-rules').addEventListener('click', () => el('rules-modal').showModal());
  el('lobby-symbols')?.addEventListener('click', () => {
    initSymbolsFilter();
    el('symbols-modal').showModal();
  });

  // El tutorial: una partida guionada con tooltips. Arranca un game propio y lo
  // monta en la misma mesa. Al terminar vuelve a la portada.
  el('lobby-tutorial').addEventListener('click', () => {
    cleanupTutorial();
    activeTutorial = createTutorial(ui._game, () => {
      cleanupTutorial();
      open('front');
    });
    close();
  });

  menu.addEventListener('click', (e) => {
    const mode = e.target.closest('[data-play]:not([disabled])')?.dataset.play;
    if (!mode) return;
    // La sala es otra pantalla: la sirve el mismo servidor y la maneja `net.js`, así
    // que se entra por la URL igual que entra el que llega del celular.
    if (mode === 'net') {
      location.search = '?red';
      return;
    }
    if (mode === 'adventure') {
      toAdventure();
      return;
    }
    // Contra la CPU no falta nada que preguntar: tu Axie ya está elegido y el de la
    // máquina se sortea, así que el menú es el último botón antes de la partida.
    play();
  });

  el('lobby-start').addEventListener('click', chooseGo);

  // Los (+) del mazo. Van colgados de la fila entera y no de cada botón: las cartas se
  // redibujan en cada toque, y un `addEventListener` por botón sería volver a
  // engancharlos diez veces por clic.
  el('lobby-choose-deck').addEventListener('click', (e) => {
    const data = e.target.closest('[data-boost]')?.dataset;
    if (data) boost(data.boost, data.key, data.sym);
  });

  // Las flechas del teclado recorren la vuelta, que es lo que uno intenta apenas ve dos
  // flechas en pantalla. Solo esas dos: Enter y las letras ya las tiene tomadas la mesa
  // (ver el `keydown` de `ui.js`), y con la portada encima seguirían llegando allá.
  document.addEventListener('keydown', (e) => {
    if (choose.hidden || lobby.hidden) return;
    if (e.key === 'ArrowLeft') browse(-1);
    else if (e.key === 'ArrowRight') browse(1);
  });

  // Tu Axie viene puesto desde el arranque —sorteado, si es la primera vez que se abre
  // el juego en esta máquina— y queda anotado desde ya: la sala lo lee de ahí y no
  // tiene a quién preguntarle (ver `loadout.js`).
  remember();

  // Las dos puertas de vuelta a la portada, y lo que solo tiene sentido habiendo
  // portada a la que volver. En una sala no la hay: la partida es del servidor, se
  // entró por un link, y lo único que se usa de todo esto es la pantalla de elección,
  // que se abre desde la sala y arranca guardada.
  if (net) {
    close();
    return { open, close };
  }

  // Abandonar la partida: la puerta de vuelta, adentro del menú de las tres rayitas.
  // La prende la portada porque es suya —con la partida en red no hay portada a la que
  // volver y el botón se queda guardado—, y vuelve al menú y no al botón grande: el que
  // abandona en el medio de una partida ya sabe a qué vino.
  const back = el('menu-btn');
  back.hidden = false;
  back.addEventListener('click', () => open('menu'));

  // La otra puerta de vuelta: la que aparece al pie cuando la partida termina (ver
  // `controlsHtml` en `ui.js`). Terminada la partida hay dos cosas que se pueden
  // querer —otra igual, o cambiar de idea— y las dos tienen que estar ahí, sin ir a
  // buscar la de las tres rayitas. La engancha la portada por el mismo motivo que la
  // otra: el botón lo dibuja la mesa, pero volver es asunto de la portada, y en la
  // partida en red no hay portada a la que volver.
  el('controls').addEventListener('click', (e) => {
    if (e.target.closest('[data-action="menu"]')) open('menu');
    if (e.target.closest('[data-action="adv-map"]')) open('adventure');
  });

  // Jugar en red solo existe si la página la sirvió el servidor del juego: abierta
  // como archivo suelto, o con un servidor estático cualquiera, no hay sala a la que
  // entrar. La opción se prende sola cuando contesta.
  netAvailable().then((info) => {
    if (info) el('lobby-net').disabled = false;
    else el('lobby-net-note').textContent = 'Hace falta abrir el juego con npm start';
  });

  open();
  return { open, close };
}
