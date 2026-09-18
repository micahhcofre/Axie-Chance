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
import { POWERS, SYMBOLS, SYMBOL_IDS, boostOptions, crest, powerIcon, shuffle } from './data.js';
import { readLoadout, writeLoadout } from './loadout.js';
import { netAvailable } from './net.js';
import { createTutorial } from './tutorial.js';
import {
  ADVENTURE_LEVELS, getAdventureProgress, getAdventureLevel, isLevelUnlocked,
  DIFFICULTY_LABELS,
} from './adventure.js';
import { openHud, ghostOut } from './ui.js';
import { tr, currentLang, setLang } from './i18n.js';

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

/**
 * Cada cuánto hace un gesto el rival del cuadro de la Aventura, en ms. Está ahí para
 * presentarse, así que se aburre mucho más seguido que en la mesa.
 */
const RIVAL_FIDGET = [1400, 3200];

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
const cast = (size) => shuffle(AXIE_IDS).slice(0, size);

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
    .join(tr(' y '));
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
    `<button class="boost-btn${cls}" ${attrs} disabled title="${title}">${inner}</button>`;

  if (added) {
    return btn(`data-boost="clear" data-key="${base.key}"`, ' is-on',
      `${crest(added)}<b class="boost-sign">×</b>`,
      tr('Sacarle el {symbol} de más', { symbol: SYMBOLS[added].name }));
  }
  if (options.length === 1) {
    return btn(`data-boost="add" data-key="${base.key}" data-sym="${options[0]}"`, '',
      `<b class="boost-sign">+</b>${crest(options[0])}`,
      tr('Sumarle otro {symbol}', { symbol: SYMBOLS[options[0]].name }));
  }
  if (open) {
    return options
      .map((s) => btn(`data-boost="add" data-key="${base.key}" data-sym="${s}"`, '',
        crest(s), tr('Sumarle otro {symbol}', { symbol: SYMBOLS[s].name })))
      .join('');
  }
  return btn(`data-boost="open" data-key="${base.key}"`, '',
    '<b class="boost-sign">+</b>', tr('Sumarle uno de sus dos símbolos'));
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
 * Desde cuántos Axies aparece el buscador. Con pocos se ven todos de un vistazo y una
 * caja de texto es un renglón que no ayuda a nadie; con muchos, el filtro por clase
 * deja igual demasiados y buscar por nombre es lo más rápido.
 */
const SEARCH_FROM = 12;

/** Hasta cuántos Axies la colección los muestra en naipes grandes (ver el CSS). */
const FEW_AXIES = 8;

/**
 * Corre el scroll de `box` lo justo para que `item` quede adentro, en un solo eje.
 *
 * No es `scrollIntoView`: ese corre también a todos los de afuera que puedan correrse
 * —con `overflow: hidden` incluido—, y la portada entera se desplazaba de costado.
 */
function nudgeInto(box, item, axis = 'y') {
  if (!box?.getBoundingClientRect || !item?.getBoundingClientRect) return;
  const [start, end, scroll] = axis === 'x' ? ['left', 'right', 'scrollLeft'] : ['top', 'bottom', 'scrollTop'];
  const b = box.getBoundingClientRect();
  const i = item.getBoundingClientRect();
  const pad = 8;
  if (i[start] < b[start]) box[scroll] -= b[start] - i[start] + pad;
  else if (i[end] > b[end]) box[scroll] += i[end] - b[end] + pad;
}

/** Un nombre en minúsculas y sin tildes, para que "aguijon" encuentre a "Aguijón". */
const foldText = (text) => String(text).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Un Axie en la colección: el dibujo quieto sobre el color de su clase, su nombre, el
 * crest en la esquina y dos marcas —el que tenés puesto y el que tiene mejoras—.
 *
 * Quieto y sin dibujos alternativos (`alts: false`): son decenas en pantalla, y el que
 * respira es el de la ficha. `data-axie` es lo que lee el clic (ver `createLobby`).
 */
function rosterTileHtml(id, { equipped, boosted }) {
  const a = axie(id);
  const sym = SYMBOLS[a.class];
  const marks = [
    equipped ? `<span class="roster-mark roster-mark--on">${tr('En uso')}</span>` : '',
    boosted ? `<span class="roster-mark roster-mark--plus" title="${tr('Con mejoras')}">+</span>` : '',
  ].join('');
  return `<button class="roster-tile" data-axie="${id}" aria-pressed="false"
    style="--c:${sym.color}" title="${a.name} · ${sym.name}">
    <span class="roster-art">${axieArt(id, { alts: false })}</span>
    <span class="roster-crest">${crest(a.class, 'sm')}</span>${marks}
    <span class="roster-name">${a.name}</span>
  </button>`;
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
  /** El rival del nivel en su cuadro. Se vuelve a crear con cada ficha que se pinta. */
  let rivalMotion = null;
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
  /** El Axie de la ficha: el último que se tocó en la colección. */
  let seen = pick;
  /** La clase que filtra la colección, o `'all'`. */
  let classFilter = 'all';
  /** Lo que se escribió en el buscador. */
  let query = '';
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
    // La que se va sale con la misma suavidad con la que entró: se deja una copia
    // quieta que se apaga encima, y la de verdad se guarda en el acto.
    for (const [name, node] of [['front', front], ['menu', menu], ['choose', choose], ['adventure', adv]]) {
      if (name !== which && node && !node.hidden) ghostOut(node, lobby);
    }
    lobby.dataset.view = which;
    front.hidden = which !== 'front';
    menu.hidden = which !== 'menu';
    choose.hidden = which !== 'choose';
    if (adv) adv.hidden = which !== 'adventure';
    // El Axie grande deja de respirar al salir de su pantalla: un clip en bucle sobre
    // un nodo que nadie está viendo es trabajo que el navegador hace para nadie.
    if (which !== 'choose') heroMotion.stop();
    if (which !== 'adventure') rivalMotion?.stop();
  }

  /** El que está en la ficha. */
  const shown = () => seen;

  /** Los Axies de la colección que pasan el filtro de clase y el buscador, en orden. */
  function visibleIds() {
    const needle = foldText(query.trim());
    return AXIE_IDS.filter((id) => {
      const a = axie(id);
      if (classFilter !== 'all' && a.class !== classFilter) return false;
      return !needle || foldText(a.name).includes(needle);
    });
  }

  /**
   * Los filtros de clase: "Todos" y una por clase que haya en la colección, cada una
   * con cuántos tiene. Una clase sin Axies no se ofrece: sería un botón que vacía la
   * grilla. El buscador se prende recién cuando la colección es grande.
   */
  function paintFilters() {
    const count = {};
    for (const id of AXIE_IDS) count[axie(id).class] = (count[axie(id).class] ?? 0) + 1;
    const chip = (value, inner, label) =>
      `<button class="choose-chip" data-filter="${value}" aria-pressed="${classFilter === value}"
        title="${label}">${inner}</button>`;
    el('lobby-choose-filters').innerHTML =
      chip('all', `<span>${tr('Todos')}</span><b>${AXIE_IDS.length}</b>`, tr('Todos')) +
      SYMBOL_IDS.filter((s) => count[s])
        .map((s) => chip(s, `${crest(s, 'sm')}<b>${count[s]}</b>`, SYMBOLS[s].name))
        .join('');
    // Con pocos —uno por clase— filtrar no achica nada: la fila se guarda entera.
    el('lobby-choose-filters').hidden = AXIE_IDS.length <= FEW_AXIES;
    const search = el('lobby-choose-search');
    search.hidden = AXIE_IDS.length < SEARCH_FROM;
    search.placeholder = tr('Buscar');
    search.value = query;
  }

  /**
   * La grilla de la colección. Se arma entera solo cuando cambia qué se ve —abrir la
   * pantalla, un filtro, una letra—: son decenas de dibujos, y tocar uno no puede
   * volver a pedirlos todos. Cambiar de ficha pasa por `markRoster`.
   */
  function paintRoster() {
    const ids = visibleIds();
    const grid = el('lobby-choose-roster');
    grid.dataset.few = String(AXIE_IDS.length <= FEW_AXIES);
    grid.innerHTML = ids.length
      ? ids.map((id) => rosterTileHtml(id, {
          equipped: id === pick,
          boosted: Object.keys(boosts[id] ?? {}).length > 0,
        })).join('')
      : `<p class="choose-empty">${tr('Ningún Axie coincide')}</p>`;
    markRoster();
  }

  /** Marca en la grilla cuál está en la ficha, y lo trae a la vista si quedó afuera. */
  function markRoster({ reveal = false } = {}) {
    const grid = el('lobby-choose-roster');
    for (const tile of grid.querySelectorAll?.('[data-axie]') ?? []) {
      const on = tile.dataset.axie === seen;
      tile.setAttribute('aria-pressed', String(on));
      if (on && reveal) nudgeInto(grid, tile);
    }
  }

  /** Repinta la ficha con el Axie que se está mirando. */
  function paintChoose() {
    const id = seen;
    const a = axie(id);
    const sym = SYMBOLS[a.class];
    // Dos mazos: el de fábrica, de donde salen las claves y los candidatos de cada
    // botón, y el mejorado, que es el que se dibuja y el que se cuenta abajo. Van en el
    // mismo orden porque los arma la misma función.
    const bag = boosts[id] ?? {};
    const base = deckFor(id);
    const deck = deckFor(id, bag);

    el('lobby-choose-title').textContent = tr('Elegí tu Axie');

    // El bicho grande. Se redibuja entero al cambiar de Axie —son otras capas— y el
    // reproductor tiene que volver a tomarlas: sin esto queda quieto, con las capas
    // del anterior anotadas.
    el('lobby-choose-art').innerHTML = axieArt(id);
    el('lobby-choose-art').style.setProperty('--c', sym.color);
    heroMotion.mount(id);

    el('lobby-choose-id').innerHTML = `<b class="choose-name">${a.name}</b>
      <span class="choose-tags">
        <span class="choose-class" style="--c:${sym.color}">${crest(a.class)}${sym.name}</span>
        ${id === pick ? `<span class="choose-on">${tr('En uso')}</span>` : ''}
      </span>`;

    const boosted = base.filter((c) => bag[c.key]).length;
    el('lobby-choose-deck-label').textContent = boosted
      ? (boosted > 1
          ? tr('Mazo inicial · 10 cartas · {boosted} mejoradas', { boosted })
          : tr('Mazo inicial · 10 cartas · {boosted} mejorada', { boosted }))
      : tr('Mazo inicial · 10 cartas');
    el('lobby-choose-deck').innerHTML = base
      .map((c, i) => deckSlotHtml(c, deck[i], a.class, bag[c.key], boostOpen === c.key))
      .join('');
    el('lobby-choose-tally').innerHTML = symbolTally(deck)
      .map(({ symbol, n }) => `<span class="tally" style="--c:${SYMBOLS[symbol].color}"
        title="${tr('{name}: {n} en el mazo', { name: SYMBOLS[symbol].name, n })}">${crest(symbol)}<b>${n}</b></span>`)
      .join('');

    // El que ya tenés puesto no se vuelve a elegir: el botón solo cierra.
    el('lobby-start').textContent = id === pick ? tr('Listo') : tr('Elegir Axie');
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

  /** Pone un Axie en la ficha. */
  function show(id) {
    if (!id || id === seen) return;
    seen = id;
    boostOpen = null;
    paintChoose();
    markRoster({ reveal: true });
  }

  /**
   * Un lugar para adelante o para atrás entre los que se ven en la grilla, con las
   * flechas del teclado. Da la vuelta: al pasar el último se vuelve al primero.
   */
  function browse(step) {
    const ids = visibleIds();
    if (!ids.length) return;
    const i = ids.indexOf(seen);
    show(ids[i < 0 ? 0 : (i + step + ids.length) % ids.length]);
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
    paintRoster();
  }

  /** Abre la elección, parada en el Axie que tenés puesto. */
  function toChoose() {
    boostOpen = null;
    seen = pick;
    // Se abre con la colección entera: un filtro que quedó puesto de la otra vez podría
    // estar escondiendo justo el que tenés.
    classFilter = 'all';
    query = '';
    paintFilters();
    paintChoose();
    paintRoster();
    view('choose');
    markRoster({ reveal: true });
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
    const rivalAxie = axie(current.rival);
    const rivalSym = SYMBOLS[rivalAxie.class];

    advLevels.innerHTML = ADVENTURE_LEVELS.map((lvl) => {
      const unlocked = isLevelUnlocked(lvl.id);
      const completed = progress.completedLevels.includes(lvl.id);
      const active = lvl.id === selectedAdvLevel;
      const statusIcon = completed ? '★' : (unlocked ? `${lvl.id}` : '<span class="adv-lock" aria-hidden="true"></span>');
      const cls = [
        'adv-level-btn',
        active ? 'active' : '',
        completed ? 'completed' : '',
        !unlocked ? 'locked' : '',
      ].filter(Boolean).join(' ');

      return `<button class="${cls}" data-adv-level="${lvl.id}" ${!unlocked ? 'disabled' : ''}>` +
        `<span class="adv-level-num">${statusIcon}</span>` +
        `<span class="adv-level-name">${tr('Nivel {n}', { n: lvl.id })}</span>` +
      `</button>`;
    }).join('');

    const showcase = current.showcase ?? [];
    const powersToShow = [...(current.newPowers ?? []), ...showcase];

    // La definición de cada poder es su `note`, la misma del `title` de los íconos en
    // la mesa: una sola redacción para todo el juego.
    const powersHtml = powersToShow.map((pId) => {
      const p = POWERS[pId];
      const owner = p.symbol ? SYMBOLS[p.symbol].name : tr('Comodín');
      return `<div class="adv-power-item">` +
        `<div class="adv-power-icon">${powerIcon(pId, 'lg')}</div>` +
        `<div class="adv-power-text">` +
          `<b>${p.name} <span>· ${owner}</span></b>` +
          `<p>${p.note[0].toUpperCase()}${p.note.slice(1)}.</p>` +
        `</div>` +
      `</div>`;
    }).join('');

    const completed = progress.completedLevels.includes(current.id);
    const diffLabel = DIFFICULTY_LABELS[current.difficulty] ?? current.difficulty;
    const count = current.newPowers?.length ?? 0;
    let sectionTitle;
    if (showcase.length > 0) {
      const extra = showcase
        .map((pId) => (pId === 'freegame' ? 'Free Game' : (POWERS[pId]?.name ?? pId)))
        .join(' + ');
      sectionTitle = tr('Nuevos poderes y especiales en este nivel (+{count} poderes + {extra})', { count, extra });
    } else if (count > 0) {
      sectionTitle = tr('Nuevos poderes en este nivel (+{count})', { count });
    } else {
      sectionTitle = tr('Poderes en este nivel');
    }

    advCard.innerHTML = `
      <div class="adv-card-header">
        <div class="adv-card-title-group">
          <span class="adv-badge ${completed ? 'adv-badge--won' : ''}">${completed ? tr('★ Nivel Superado') : tr('Combate Disponible')}</span>
          <h2 class="adv-card-title">${current.name}</h2>
          <p class="adv-card-desc">${current.description}</p>
        </div>
      </div>

      <div class="adv-card-section">
        <h3 class="adv-section-title">${sectionTitle}</h3>
        <div class="adv-powers-grid">${powersHtml}</div>
        <p class="adv-powers-foot">${tr('«Al pegar» es plantarte con un ataque que haga daño: si te cortás, esos poderes no salen.')}</p>
      </div>

      <div class="adv-card-section">
        <h3 class="adv-section-title">${tr('Rival')}</h3>
        <div class="adv-rival-box">
          <div class="adv-rival-stage" data-arena="${rivalAxie.class}">${axieArt(rivalAxie.id)}</div>
          <div class="adv-rival-info">
            <b>${rivalAxie.name}</b>
            <span class="adv-rival-class" style="--c:${rivalSym.color}">${crest(rivalAxie.class, 'sm')} ${rivalSym.name}</span>
            <span class="adv-rival-diff">${tr('Dificultad: {diff}', { diff: tr(diffLabel) })}</span>
          </div>
        </div>
      </div>

      <div class="adv-card-actions">
        <button class="lobby-play choose-go" id="lobby-adventure-play">
          ${completed ? tr('Volver a Jugar') : tr('Comenzar Nivel')}
        </button>
      </div>
    `;
    // El rival vivo: respira y cada tanto hace un gesto, con el mismo reproductor de la
    // mesa. La ficha se acaba de pintar entera, así que el Axie es otro nodo.
    rivalMotion?.stop();
    rivalMotion = createMotion(advCard.querySelector('.adv-rival-stage'), 0, { fidget: RIVAL_FIDGET });
    rivalMotion.mount(rivalAxie.id);
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
      difficulty: el('difficulty').dataset.value ?? 'normal',
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
    // Volver a la portada es levantarse de la mesa: la partida de atrás se corta acá
    // —el reloj, los turnos de la máquina, la música— en vez de seguir jugándose sola
    // detrás de la portada (ver `abortMatch` en `game.js`). Va en `open` y no en cada
    // puerta porque las puertas son varias —las tres rayitas, el final, el mapa de la
    // Aventura— y con la portada puesta nunca hay partida que siga. En una sala la
    // partida no es de esta pantalla y no hay `ui` que cortar: irse de ahí es abandonar
    // (ver `quit` en `net.js`).
    ui?.abortMatch?.();
    // La portada tiene su música (ver `PLAYLISTS` en `audio.js`): la partida la cambia
    // por la del combate apenas reparte.
    ui?.audio?.music('menu');
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
    // En la portada no hay partida que abandonar: la salida del menú se guarda y vuelve
    // a aparecer cuando la portada se va y empieza una. En una sala la maneja `net.js`.
    if (!net) el('menu-btn').hidden = true;
    for (const s of strollers ?? []) s.wake();
  }

  function close() {
    if (!lobby.hidden) ghostOut(lobby, document.body);
    lobby.hidden = true;
    if (!net) el('menu-btn').hidden = false;
    heroMotion.stop();
    rivalMotion?.stop();
    for (const s of strollers ?? []) s.sleep();
  }

  el('lobby-play').addEventListener('click', () => view('menu'));
  el('lobby-loadout').addEventListener('click', toChoose);
  el('lobby-menu-close').addEventListener('click', () => view('front'));
  // El menú también se va tocando afuera de la tabla, como cualquier cartel que se
  // abre encima. El toque que lo abrió sube hasta acá con el menú ya puesto: por eso
  // el botón de jugar no cuenta, y tampoco la configuración, que abre lo suyo.
  lobby.addEventListener('click', (e) => {
    if (lobby.hidden || lobby.dataset.view !== 'menu') return;
    if (e.target?.closest?.('#lobby-menu, #lobby-play, #lobby-settings-btn')) return;
    view('front');
  });
  el('lobby-choose-back').addEventListener('click', () => (net ? close() : view('front')));
  advBack.addEventListener('click', () => view('menu'));
  adv.addEventListener('click', (e) => {
    const lvlBtn = e.target.closest('[data-adv-level]');
    if (lvlBtn) {
      selectedAdvLevel = Number(lvlBtn.dataset.advLevel);
      paintAdventure();
      return;
    }
    const playBtn = e.target.closest('#lobby-adventure-play');
    if (playBtn) {
      playAdventure(selectedAdvLevel);
    }
  });
  // La colección: tocar un Axie lo pone en la ficha, tocar una clase filtra y escribir
  // busca. Colgados de las cajas y no de cada botón, que se redibujan.
  el('lobby-choose-roster').addEventListener('click', (e) => {
    show(e.target.closest?.('[data-axie]')?.dataset?.axie);
  });
  el('lobby-choose-filters').addEventListener('click', (e) => {
    const value = e.target.closest?.('[data-filter]')?.dataset?.filter;
    if (!value) return;
    classFilter = value === classFilter ? 'all' : value;
    paintFilters();
    paintRoster();
    const filters = el('lobby-choose-filters');
    nudgeInto(filters, filters.querySelector?.(`[data-filter="${classFilter}"]`), 'x');
  });
  el('lobby-choose-search').addEventListener('input', (e) => {
    query = e.target.value ?? '';
    paintRoster();
  });
  el('lobby-vision')?.addEventListener('click', () => el('vision-modal').showModal());

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

  /** La dificultad elegida: queda en el grupo y cada botón dice si es el puesto. */
  const pickDifficulty = (val) => {
    el('difficulty').dataset.value = val;
    menu.querySelectorAll?.('.diff-pill')?.forEach((b) => {
      const on = b.dataset?.diff === val;
      b.classList?.toggle('is-active', on);
      b.setAttribute?.('aria-checked', String(on));
    });
  };

  menu.addEventListener('click', (e) => {
    const mode = e.target.closest?.('[data-play]:not([disabled])')?.dataset?.play;
    if (mode) {
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
      return;
    }
    const val = e.target.closest?.('.diff-pill')?.dataset?.diff;
    if (val) pickDifficulty(val);
  });

  el('lobby-start').addEventListener('click', chooseGo);

  // Los (+) del mazo. Van colgados de la fila entera y no de cada botón: las cartas se
  // redibujan en cada toque, y un `addEventListener` por botón sería volver a
  // engancharlos diez veces por clic.
  el('lobby-choose-deck').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-boost]');
    if (btn?.disabled) return;
    const data = btn?.dataset;
    if (data) boost(data.boost, data.key, data.sym);
  });

  // Las flechas del teclado recorren la colección, en el orden de la grilla. Solo esas
  // dos: Enter y las letras ya las tiene tomadas la mesa
  // (ver el `keydown` de `ui.js`), y con la portada encima seguirían llegando allá.
  document.addEventListener('keydown', (e) => {
    if (choose.hidden || lobby.hidden) return;
    // Escribiendo en el buscador las flechas mueven el cursor, no el Axie.
    if (e.target?.tagName === 'INPUT') return;
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

  /**
   * La vuelta desde la mesa: al menú de modos, salvo saliendo del tutorial.
   *
   * De una partida se vuelve al menú y no al botón grande —el que abandona en el medio
   * ya sabe a qué vino—, pero el tutorial no es una partida que se quiera repetir: se
   * sale a la portada, igual que cuando se termina solo (ver `onDone` más arriba).
   */
  const backFromTable = () => open(activeTutorial ? 'front' : 'menu');

  // Abandonar la partida: la puerta de vuelta, adentro del menú de las tres rayitas.
  // La prende la portada al irse (ver `close`) —con la partida en red no hay portada a
  // la que volver y el botón se queda guardado—.
  el('menu-btn').addEventListener('click', backFromTable);

  // La otra puerta de vuelta: la que aparece en la pantalla del final (ver
  // `endActionsHtml` en `ui.js`). Terminada la partida hay dos cosas que se pueden
  // querer —otra igual, o cambiar de idea— y las dos tienen que estar ahí, sin ir a
  // buscar la de las tres rayitas. La engancha la portada por el mismo motivo que la
  // otra: el botón lo dibuja la mesa, pero volver es asunto de la portada, y en la
  // partida en red no hay portada a la que volver.
  const doors = (e) => {
    if (e.target.closest('[data-action="menu"]')) backFromTable();
    if (e.target.closest('[data-action="adv-map"]')) open('adventure');
  };
  el('controls').addEventListener('click', doors);
  // Las puertas del final viven en la pantalla del final (ver `result.js`).
  el('result')?.addEventListener('click', doors);

  // Botón de configuración en la portada (arriba a la derecha).
  // Abre el mismo panel que hay en el juego (#hud-menu), donde vive el sonido y el idioma.
  const cfgBtn = el('lobby-settings-btn');
  if (cfgBtn) {
    cfgBtn.addEventListener('click', (e) => {
      e.stopPropagation?.();
      openHud();
    });
  }


  // Jugar en red solo existe si la página la sirvió el servidor del juego: abierta
  // como archivo suelto, o con un servidor estático cualquiera, no hay sala a la que
  // entrar. La opción se prende sola cuando contesta.
  netAvailable().then((info) => {
    if (info) el('lobby-net').disabled = false;
    else el('lobby-net-note').textContent = tr('Hace falta abrir el juego con npm start');
  });

  open();
  return { open, close };
}
