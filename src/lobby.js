// La portada: lo primero que se ve al abrir el juego.
//
// Antes el juego arrancaba solo. Se abría la página y ya había una partida contra la
// CPU andando, con los selectores de modo y dificultad perdidos entre los botones de
// arriba: para jugar contra otra persona había que darse cuenta de que ahí había un
// desplegable, cambiarlo, y ver cómo la partida que estabas mirando se reiniciaba sola.
// Eso no es un juego, es un formulario que además baraja cartas.
//
// Ahora es como un juego de celular: una barra de cinco pestañas abajo, con íconos y
// sin palabras, y la pantalla de cada una arriba. Se abre en la del medio.
//
//   Duelos    contra quién, fuera de la Aventura: el tutorial, la CPU o alguien en otro
//             aparato. Tres banderines sobre el video de la pelea en loop.
//   Axies     con cuál: la colección, la vista previa y el inventario de cada uno.
//   Aventura  el mapa, parado en el nivel que toca. Es con la que se abre el juego.
//   Mochila   las cartas sueltas (ver `backpack.js`).
//   Taller    la forja: cartas nuevas para la mochila, a la suerte (ver `workshop.js`).
//
// La evolución de las cartas de un Axie no es una pestaña: es una puerta de su vista
// previa, al lado del inventario (ver `evolve-view.js`), porque se evoluciona *ese*
// Axie y se elige mirándolo.
//
// Antes había una tapa con dos botones —jugar y tu Axie— y todo colgaba de ellos: para
// llegar al mapa había que pasar por jugar y por el menú de modos. Con la Aventura como
// casa, lo que más se juega queda a cero toques, y lo demás a uno.
//
// Las dos preguntas de antes siguen siendo dos, en dos pestañas: "contra quién" se
// contesta cada vez que te sentás a jugar; "con cuál" se contesta una vez y queda. Tu
// Axie arranca puesto (sorteado la primera vez), así que ninguna pestaña de jugar
// pregunta con cuál. Jugar con otra persona es una sala, y ahí cada uno elige en su
// aparato, en esta misma pantalla de Axies abierta encima de la sala (sin la barra).
//
// Detrás de todas las pestañas está el mapa. La pantalla de la Aventura no se guarda
// nunca: en las otras queda de fondo, desenfocada y quieta (`data-behind`), porque el
// mapa es el juego y lo demás se hace encima de él.
import { AXIE_IDS, AXIES, axie, axieArt, deckFor } from './axies.js';
import { createMotion } from './axie-motion.js';
import { POWERS, SYMBOLS, PART_NAMES, EXTRA_SLOTS, crest, momentTag, powerIcon, shuffle } from './data.js';
import { readLoadout, writeLoadout, FREE_PLAY, withFree } from './loadout.js';
import {
  readBackpack, writeBackpack, equippedOn, looseCards, extrasOf, equip, unequip,
} from './backpack.js';
import { readProgress, readWallet, writeWallet, recordOf, levelInfo, playingId, nextEvolution, shardsHtml, shardAmount } from './evolution.js';
import {
  readCraft, tierOf, tierName, scrapValue, scrapCards,
  MERGE_COPIES, cardKey, mergeGroups, mergeCards, stacksOf,
} from './crafting.js';
import { playMerge, gemHtml } from './card-scene.js';
import { preloadVfx } from './vfx.js';
import { createEvolveView } from './evolve-view.js';
import { createWorkshop } from './workshop.js';
import { netAvailable } from './net.js';
import { recordMissions, refreshMissions } from './missions.js';
import { createMissionsView } from './missions-view.js';
import { createTutorial, TUTORIAL_AXIES } from './tutorial.js';
import {
  ADVENTURE_KEY, ADVENTURE_LEVELS, getAdventureProgress, getAdventureLevel, isLevelUnlocked, levelToPlay,
  adventureChapters, adventureCharms,
} from './adventure.js';
import { worldHtml, walkHero, zoneContent, landDefsHtml, chapterIndexOf, PVE_UI } from './adventure-map.js';
import { loadRivalPoses } from './rival-poses.js';
import { profileOf, PROFILE_XP } from './profile.js';

/**
 * Cuándo el mapa de la Aventura se recorre para arriba: la misma regla que pone el panel
 * del nivel a todo el ancho (ver `.lobby-adventure` en el CSS).
 */
const MAP_PORTRAIT = '(orientation: portrait), (max-width: 620px)';
import { TARGET } from './game.js';
import { openHud, ghostOut, sheetCardHtml, symbolTally, deckMixHtml } from './ui.js';
import { tr, currentLang, setLang } from './i18n.js';

// `el` y no `$` como en `ui.js` ni `byId` como en `net.js`: el build de un solo
// archivo concatena los módulos sin envolverlos, así que dos nombres iguales en
// archivos distintos chocan (ver `build.mjs`).
const el = (id) => document.getElementById(id);

/**
 * Cada cuánto hace un gesto tu Axie en el mapa de la Aventura, en ms. Está solo en su
 * lugar, así que se aburre mucho más seguido que en la mesa.
 */
const RIVAL_FIDGET = [1400, 3200];

/**
 * Cada cuánto hace un gesto cada rival del mapa, en ms. Son varios a la vista a la vez:
 * más espaciado que el del panel, o el mapa entero se movería todo el tiempo.
 */
const MAP_FIDGET = [3200, 8000];

/** Cuántos de tus Axies muestra tu perfil: los que más usás. */
const PROFILE_TOP = 3;

/**
 * La pestaña de cada pantalla que se abre por nombre desde afuera (ver `open`): los
 * duelos se llaman `menu` y la elección `choose`, de antes de la barra.
 */
const TAB_FOR = { menu: 'duel', choose: 'axies' };

/** La dificultad de un nivel, con las mismas palabras que el selector del Vs CPU. */
const DIFF_CHIP = { facil: 'Fácil', normal: 'Normal', duro: 'Duro' };
/** Y en marcas: cuántas de las tres se encienden en el panel del nivel. */
const DIFF_LEVEL = { facil: 1, normal: 2, duro: 3 };

/**
 * El corazón de la vida de un jefe, pintado como el mapa: mate, el plano con luz arriba a
 * la izquierda y la sombra fría abajo a la derecha, sin contorno.
 */
const HEART_SVG = '<svg class="adv-heart" viewBox="0 0 20 18" aria-hidden="true">'
  + '<path d="M10 17C4 12.2 1 9 1 5.6 1 2.9 3.1 1 5.6 1 7.6 1 9 2.2 10 3.9 11 2.2 12.4 1 14.4 1 16.9 1 19 2.9 19 5.6 19 9 16 12.2 10 17Z" fill="#d8404a"/>'
  + '<path d="M10 17C16 12.2 19 9 19 5.6c0-1.5-.6-2.8-1.6-3.6.3 4.4-3.4 9.3-9.6 14.2Z" fill="#8c2352"/>'
  + '<path d="M3.2 6.4C3 4.2 4.4 2.6 6.2 2.6c1.3 0 2.2.8 2.7 1.8-2 .1-4 .8-5.7 2Z" fill="#f07a6a"/></svg>';

// ---- la elección de Axie ------------------------------------------------------

/**
 * Una de las 8 cartas de fábrica en el inventario, en el mismo formato en que se va a
 * ver en la mesa y con la mejora puesta, si la tiene (ver `buildPersonalDeck`): lo que
 * se ve es el mazo con el que vas a jugar. Los símbolos van todos encendidos porque acá
 * no hay cadena que apagarlos: es la carta como objeto, no como jugada.
 */
function deckSlotHtml(card, boosted, evolved = false) {
  return `<div class="deck-slot" data-boosted="${Boolean(boosted)}" data-evolved="${Boolean(evolved)}">${sheetCardHtml(card)}</div>`;
}

/**
 * Un espacio de la mochila en el inventario: la carta puesta con su × para devolverla,
 * o el hueco vacío que abre la mochila para elegir una. Los huecos se ven todos —no solo
 * los ocupados— porque dicen cuántas cartas más le entran al Axie.
 */
function extraSlotHtml(item) {
  if (!item) {
    return `<button class="deck-slot bag-slot" data-bag-pick title="${tr('Sumar una carta de la mochila')}">
      <span class="bag-slot-plus" aria-hidden="true">+</span></button>`;
  }
  const tier = tierOf(item)?.id ?? '';
  return `<div class="deck-slot bag-slot is-full" data-tier="${tier}">${sheetCardHtml(item)}${
    tier ? gemHtml('bag-gem') : ''}
    <button class="bag-slot-out" data-bag-out="${item.id}" title="${tr('Devolver a la mochila')}">×</button></div>`;
}

// ---- la mochila: la colección de cartas sueltas ----------------------------------

/** Lista para fusionar: la flecha verde para arriba, pintada en `index.html` (`#ic-up`). */
const UP_HTML = '<svg class="bag-up" viewBox="0 0 24 24" aria-hidden="true"><use href="#ic-up"/></svg>';
/** Recién llegada (del Taller o de una fusión): un destello en la esquina (`#ic-new`). */
const NEW_HTML = '<svg class="bag-new" viewBox="0 0 24 24" aria-hidden="true"><use href="#ic-new"/></svg>';

/**
 * La fusión de una pila, dibujada: tres naipes que se llenan con sus copias sueltas, una
 * flecha y la gema de la rareza a la que sube. Se lee sin números: tres llenos, se
 * fusiona. La mítica y el Rocket no llevan: no tienen a dónde subir.
 */
function fusionHtml(stack) {
  if (!stack.next) return '';
  const n = Math.min(stack.loose.length, MERGE_COPIES);
  const ready = stack.loose.length >= MERGE_COPIES;
  return `<div class="bag-fusion" data-ready="${ready}" data-have="${n}" role="img" aria-label="${tr('{n} de {k} para fusionar', { n, k: MERGE_COPIES })}">
    <span class="bag-copies">${Array.from({ length: MERGE_COPIES }, (_, i) => `<i${i < n ? ' data-on' : ''}></i>`).join('')}</span>
    <svg class="bag-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h13M12 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <span class="bag-next" data-tier="${stack.next}">${gemHtml()}</span>
  </div>`;
}

/** Lo que es una pila, dicho entero: para el lector de pantalla. */
function stackLabel(stack) {
  const count = stack.loose.length + stack.worn.length;
  const power = stack.card.power ? ` · ${POWERS[stack.card.power].name}` : '';
  return `${tierName(stack.tier) ?? ''} · ${stack.card.symbols.map((s) => SYMBOLS[s].name).join(' · ')}${power}${count > 1 ? ` · ×${count}` : ''}`;
}

/**
 * Una pila de la colección, en su casillero: la carta como se ve en la mesa (los
 * símbolos apilados y el poder abajo), el fondo y el borde del color de su rareza, y en
 * las esquinas lo que hay que saber de un vistazo —la gema, cuántas copias, el Axie que
 * la tiene puesta y la flecha verde si ya hay tres sueltas para fusionar—. Todas las
 * cartas van del mismo ancho y la fila estira los casilleros al alto de la más alta.
 */
function stackTileHtml(stack, { attr, pressed = false, off = false, fresh = false, worn = '' }) {
  const count = stack.loose.length + stack.worn.length;
  const ready = Boolean(stack.next) && stack.loose.length >= MERGE_COPIES;
  return `<button class="bag-stack" data-tier="${stack.tier ?? ''}" ${attr} aria-pressed="${pressed}"${off ? ' disabled' : ''}
    aria-label="${stackLabel(stack)}">
    ${sheetCardHtml(stack.card)}${stack.tier ? gemHtml('bag-gem') : ''}${
      count > 1 ? `<b class="bag-qty">×${count}</b>` : ''}${worn}${
      ready ? `<span class="bag-ready" title="${tr('Lista para fusionar')}">${UP_HTML}</span>` : ''}${fresh ? NEW_HTML : ''}
  </button>`;
}

/**
 * Desde cuántos Axies aparece el buscador. Con pocos se ven todos de un vistazo y una
 * caja de texto es un renglón que no ayuda a nadie; con muchos, el filtro por clase
 * deja igual demasiados y buscar por nombre es lo más rápido.
 */
const SEARCH_FROM = 12;

/** El orden de los símbolos en el filtro de la mochila: el de la rueda (ver `data.js`). */
const BAG_SYM_ORDER = ['plant', 'beast', 'aquatic', 'bird', 'bug', 'reptile'];

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
 * Un Axie en la colección: el dibujo quieto sobre el prado del lobby, su nombre y dos
 * marcas —el que tenés puesto y cuántas cartas de la mochila lleva—.
 *
 * Sin clase: ni crest ni el terreno de su clase detrás. En la colección se elige un
 * Axie, no un color; de qué clase es se ve al tocarlo, en la vista previa, junto a su
 * nivel. El prado es el mismo para todos, así ninguno se lee por su fondo.
 *
 * Quieto y sin dibujos alternativos (`alts: false`): son decenas en pantalla, y el que
 * respira es el de la vista previa. `data-axie` es lo que lee el clic (ver `createLobby`).
 */
function rosterTileHtml(id, { equipped, extras, look = id }) {
  const a = axie(id);
  const marks = [
    equipped ? `<span class="roster-mark roster-mark--on">${tr('En uso')}</span>` : '',
    extras ? `<span class="roster-mark roster-mark--plus" title="${tr('Cartas de la mochila: {n}', { n: extras })}">+${extras}</span>` : '',
  ].join('');
  return `<button class="roster-tile" data-axie="${id}" aria-pressed="false" title="${a.name}">
    <span class="roster-art">${axieArt(look, { alts: false })}</span>${marks}
    <span class="roster-name">${a.name}</span>
  </button>`;
}

/**
 * El nombre, la clase y el nivel de un Axie: la cabecera de la vista previa y la del
 * inventario. La clase va con su crest y su color porque es el símbolo con el que
 * puntúa, o sea el mazo; el nivel, en su medalla.
 */
function axieIdHtml(id, { equipped, level = 1 }) {
  const a = axie(id);
  const sym = SYMBOLS[a.class];
  return `<b class="choose-name">${a.name}</b>
    <span class="choose-tags">
      <span class="choose-lvl" title="${tr('Nivel {n}', { n: level })}">${tr('LVL')} <b>${level}</b></span>
      <span class="choose-class" style="--c:${sym.color}">${crest(a.class)}${sym.name}</span>
      ${equipped ? `<span class="choose-on">${tr('En uso')}</span>` : ''}
    </span>`;
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
 *   servidor antes de que reparta. `openNet` pone la pantalla de las salas en esta
 *   misma página (ver `main.js`): sin recargar, la música de los menús sigue sonando
 *   de una pantalla a la otra. Sin él, a las salas se entra por la URL.
 */
/**
 * Si este navegador ya pasó por el tutorial. Quien ya tiene progreso en la Aventura
 * también cuenta: jugó antes de que existiera esta marca y no hay que mandarlo de nuevo
 * a aprender.
 */
export const TUTORIAL_KEY = 'axie-chance:tutorial';
function tutorialSeen() {
  // El modo libre es para mirar el juego armado: no manda a aprender.
  if (FREE_PLAY) return true;
  try {
    const store = globalThis.localStorage;
    if (!store) return true;
    return Boolean(store.getItem(TUTORIAL_KEY) || store.getItem(ADVENTURE_KEY));
  } catch {
    return true;
  }
}
function markTutorialSeen() {
  try { globalThis.localStorage?.setItem(TUTORIAL_KEY, '1'); } catch { /* sin almacenamiento, se juega igual */ }
}

export function createLobby(ui, { net = false, onPick = null, openNet = null } = {}) {
  const lobby = el('lobby');
  const menu = el('lobby-menu');
  const choose = el('lobby-choose');
  const inv = el('lobby-inv');
  const evolveEl = el('lobby-evolve');
  const bagView = el('lobby-bag');
  const adv = el('lobby-adventure');
  const craft = el('lobby-craft');
  /** La barra de las cinco pestañas. */
  const nav = el('lobby-nav');
  const advLevels = el('adventure-levels');
  const advCard = el('adventure-card');
  /**
   * Si la pantalla de las salas está puesta. Ahí la portada se guarda, y de ella se usa
   * una sola pantalla —la elección de Axie, abierta encima de la sala—, como en la
   * página que es solo de la sala (`net`).
   */
  let inNet = false;
  const overRoom = () => net || inNet;
  /** El nivel de la ficha. Arranca vacío: al abrir el mapa se pone en el que toca jugar. */
  let selectedAdvLevel = null;
  /** Si el panel del nivel muestra el detalle (poderes, descripción, lo que trae el rival). */
  let advMore = false;
  /** Tu Axie en el mapa, con su reproductor: respira y mira al camino. */
  let walkerMotion = null;
  /** Lo que elegiste la última vez, si esta máquina se acuerda (ver `loadout.js`). */
  const saved = readLoadout();
  /**
   * El nivel y las evoluciones de cada Axie (ver `evolution.js`). Se relee al abrir la
   * portada: la partida y la zona de testeo pueden haberlo cambiado.
   */
  let progress = readProgress();
  /** El id con que se dibuja y juega un Axie: con sus partes evolucionadas. */
  const playing = (id) => playingId(progress, id);
  const levelOfAxie = (id) => levelInfo(recordOf(progress, id).axp).level;
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
   * (ver `buildPersonalDeck` en `data.js`). Los botones para ponerlas están apagados;
   * las que quedaron guardadas con tu Axie siguen valiendo y se ven en su inventario.
   */
  const boosts = saved ? { [saved.axie]: saved.boosts } : {};
  /** La mochila: las cartas sueltas y las que tiene puesta cada Axie (ver `backpack.js`). */
  let bag = readBackpack();
  /**
   * Para qué se abrió la mochila: para mirar (`null`) o para elegir una carta para el
   * Axie del inventario (su id). También dice a dónde vuelve el botón de volver.
   */
  let bagFor = null;
  /**
   * La mochila para mirar: la pestaña (`'plain'`, las cartas sin poder; `'power'`, las
   * que traen uno, el Rocket incluido), la pila tocada (su `cardKey`), qué reciclado espera
   * confirmación (`'one'` una copia de la tocada, `'bulk'` todas las sueltas de lo
   * filtrado) y lo último que pasó, para contarlo arriba.
   */
  let bagTier = 'plain';
  /**
   * El filtro de símbolos de la colección: los prendidos (de a uno o varios). Una pila
   * se ve si su carta los trae a todos; sin ninguno prendido, se ven todas.
   */
  const bagSyms = new Set();
  let bagSel = null;
  let bagConfirm = null;
  let bagNote = '';
  /**
   * Las cartas recién llegadas (del Taller o de una fusión), por su `cardKey`: llevan su
   * destello hasta que se mira la mochila. `bagFresh` junta las nuevas y al abrir la
   * mochila pasan a `bagShown`, que es lo que se pinta mientras se la mira.
   */
  let bagFresh = new Set();
  let bagShown = new Set();
  /** El Axie de la ficha: el último que se tocó en la colección. */
  let seen = pick;
  /** Lo que se escribió en el buscador. */
  let query = '';
  /** El Axie grande, respirando. Es el mismo reproductor de la mesa y de la portada. */
  const heroMotion = createMotion(el('lobby-choose-art'), 0);
  /** El del inventario, que es otro nodo. */
  const invMotion = createMotion(el('lobby-inv-art'), 0);
  /**
   * La evolución de un Axie (ver `evolve-view.js`). Cuando evoluciona, lo que lo muestra
   * se repinta y, si es el que tenés puesto, cambia el mazo con que jugás.
   */
  const evolveView = createEvolveView({
    audio: ui?.audio ?? null,
    onEvolved: (id) => {
      progress = readProgress();
      if (id === pick) remember();
      paintYours();
      paintRoster();
    },
  });
  /**
   * El Taller (ver `workshop.js`). Lo que crea va a la mochila: la portada se queda con
   * la nueva para contar las sueltas en su pestaña, y lo creado llega con su destello.
   */
  const workshop = createWorkshop({
    audio: ui?.audio ?? null,
    host: el('card-scene'),
    onCrafted: (next, cards) => {
      bag = next;
      for (const card of cards) bagFresh.add(cardKey(card));
      paintBagCount();
      recordMissions({ type: 'craft', n: cards.length });
    },
    onBag: () => goTab('bag'),
  });
  // El alto del panel del nivel cambia con el nivel y con su detalle abierto: el panel de
  // las misiones se apoya encima (`--card-h` en el CSS). Se mide cuando cambia, no por
  // cuadro.
  if (advCard && typeof ResizeObserver === 'function') {
    new ResizeObserver(([entry]) => {
      const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
      if (h) adv.style.setProperty('--card-h', `${Math.round(h)}px`);
    }).observe(advCard);
  }
  /**
   * Las misiones sobre el mapa (ver `missions-view.js`). La AXP va al Axie que tenés
   * puesto; lo cobrado repinta la bolsa y, si subió de nivel, tu Axie en la barra.
   */
  const missions = createMissionsView({
    panel: el('adventure-quests'),
    host: adv,
    body: el('adventure-quests-body'),
    fold: el('adventure-quests-fold'),
    button: el('adventure-quests-btn'),
    count: el('adventure-quests-count'),
    navCount: el('lobby-quests-count'),
    sheet: el('quests-modal'),
    sheetBody: el('quests-body'),
    axie: () => pick,
    wallet: () => readWallet(),
    audio: ui?.audio ?? null,
    onPaid: (paid) => {
      paintPurses();
      if (paid.levels?.length) {
        progress = readProgress();
        paintYours();
      }
    },
  });

  /**
   * Qué pantalla de la portada se ve: `menu` (los duelos), `choose`, `inv` y `evolve`
   * (tus Axies), `bag`, `adventure` o `craft`. La pestaña que se enciende sale de ahí
   * (ver `tabOf`).
   */
  function view(which) {
    // La que se va sale con la misma suavidad con la que entró: se deja una copia
    // quieta que se apaga encima, y la de verdad se guarda en el acto.
    // El mapa no: se queda de fondo (ver `behindMap`).
    for (const [name, node] of [['menu', menu], ['choose', choose], ['inv', inv], ['evolve', evolveEl], ['bag', bagView], ['craft', craft]]) {
      if (name !== which && node && !node.hidden) ghostOut(node, lobby);
    }
    lobby.dataset.view = which;
    menu.hidden = which !== 'menu';
    choose.hidden = which !== 'choose';
    inv.hidden = which !== 'inv';
    if (evolveEl) evolveEl.hidden = which !== 'evolve';
    bagView.hidden = which !== 'bag';
    if (craft) craft.hidden = which !== 'craft';
    behindMap(which !== 'adventure');
    markTab(tabOf(which));
    paintPurses();
    // El Axie grande deja de respirar al salir de su pantalla: un clip en bucle sobre
    // un nodo que nadie está viendo es trabajo que el navegador hace para nadie.
    if (which === 'menu') paintModes();
    if (which !== 'choose') heroMotion.stop();
    if (which !== 'inv') invMotion.stop();
    if (which !== 'evolve') evolveView.stop();
    if (which !== 'craft') workshop.stop();
  }

  /**
   * Pone el mapa de fondo (`behind`) o al frente. De fondo está desenfocado, no se toca y
   * no se mueve: sin rivales que respiren ni tu Axie ni el clima (el CSS pausa lo que
   * queda), así el desenfoque se pinta una vez y no a cada cuadro. Si todavía no se
   * dibujó —se entró por otra pestaña— se dibuja ahí, parado en el nivel que toca.
   */
  function behindMap(behind) {
    if (!adv) return;
    adv.hidden = false;
    adv.dataset.behind = String(behind);
    adv.inert = behind;
    if (!behind) return;
    missions.stop();
    walkerMotion?.stop();
    stillRivals();
    if (advLevels && !advLevels.innerHTML) {
      selectedAdvLevel ??= levelToPlay();
      paintWorld({ still: true });
      centerLevel({ smooth: false });
    }
  }

  /**
   * La pestaña de cada pantalla. El inventario y la evolución son de tus Axies, y la
   * mochila abierta para ponerle una carta a uno también: se entró desde él y "Volver"
   * vuelve a él.
   */
  function tabOf(which) {
    if (which === 'menu') return 'duel';
    if (which === 'choose' || which === 'inv' || which === 'evolve') return 'axies';
    if (which === 'bag') return bagFor ? 'axies' : 'bag';
    return which;
  }

  /** Enciende la pestaña `tab` en la barra de abajo. */
  function markTab(tab) {
    for (const btn of nav?.querySelectorAll?.('[data-tab]') ?? []) {
      if (btn.dataset.tab === tab) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    }
  }

  /** El que está en la ficha. */
  const shown = () => seen;

  /** Los Axies de la colección que pasan el buscador, en orden. */
  function visibleIds() {
    const needle = foldText(query.trim());
    return AXIE_IDS.filter((id) => !needle || foldText(axie(id).name).includes(needle));
  }

  /**
   * El buscador, que se prende recién cuando la colección es grande. No hay filtro por
   * clase: la clase se ve al tocar un Axie, no antes (ver `rosterTileHtml`).
   */
  function paintSearch() {
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
          extras: equippedOn(bag, id).length,
          look: playing(id),
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

  /**
   * El mazo de un Axie tal como va a la partida: las 8 de fábrica con sus mejoras y las
   * cartas de la mochila que tiene puestas.
   */
  const deckOf = (id) => ({ base: deckFor(playing(id), boosts[id] ?? {}), extras: equippedOn(bag, id) });

  /** El Axie grande en su terreno, con su reproductor: se redibuja con cada Axie. */
  function paintArt(node, motion, id) {
    const a = axie(id);
    node.innerHTML = axieArt(playing(id));
    node.style.setProperty('--c', SYMBOLS[a.class].color);
    node.dataset.arena = a.class;
    // Son otras capas: sin esto el reproductor queda con las del anterior, quieto.
    motion.mount(playing(id));
  }

  /**
   * La vista previa del Axie que se está mirando: él en su terreno, su nombre, su clase
   * y su nivel, un renglón con de qué está hecho su mazo, y las dos puertas —su
   * inventario y elegirlo—.
   */
  function paintChoose() {
    const id = seen;
    const { base, extras } = deckOf(id);

    el('lobby-choose-title').textContent = tr('Elegí tu Axie');
    paintArt(el('lobby-choose-art'), heroMotion, id);
    el('lobby-choose-id').innerHTML = axieIdHtml(id, { equipped: id === pick, level: levelOfAxie(id) });
    el('lobby-choose-deckline').innerHTML = extras.length
      ? tr('{count} cartas · {extras} de la mochila', { count: base.length + extras.length, extras: extras.length })
      : tr('{n} cartas', { n: base.length });

    // El que ya tenés puesto no se vuelve a elegir. Encima de una sala el botón cierra
    // (atrás está la sala); en su pestaña no hay a dónde ir, y queda apagado.
    const start = el('lobby-start');
    start.disabled = id === pick && !overRoom();
    start.textContent = id !== pick ? tr('Elegir Axie') : overRoom() ? tr('Listo') : tr('Elegido');

    // La evolución no se hace encima de una sala: ahí se elige con cuál y nada más. La
    // marca dice que hay una abierta y alcanzan los Moonshards para pagarla.
    el('lobby-evolve-open').hidden = overRoom();
    const record = recordOf(progress, id);
    const next = nextEvolution(record);
    el('lobby-evolve-ready').hidden = !next
      || levelInfo(record.axp).level < next.level || readWallet().moonshards < next.cost;
  }

  /**
   * El inventario del Axie de la vista previa: él con su clase, su nivel y la rueda de
   * símbolos, las 8 cartas de fábrica y los espacios de la mochila. La rueda cuenta el
   * mazo entero —con las de la mochila—, así se ve lo que cambia una carta al ponerla.
   */
  function paintInventory() {
    const id = seen;
    const { base, extras } = deckOf(id);
    // El de fábrica va en el mismo orden (lo arma la misma función): de ahí se sabe cuál
    // carta está mejorada. Evolucionada es otra cosa: se marca aparte.
    const plain = deckFor(playing(id));
    const evolved = recordOf(progress, id).evolved;
    paintArt(el('lobby-inv-art'), invMotion, id);
    el('lobby-inv-id').innerHTML = axieIdHtml(id, { equipped: id === pick, level: levelOfAxie(id) });
    el('lobby-inv-tally').innerHTML = deckMixHtml(symbolTally([...base, ...extras]), { legend: false });
    el('lobby-inv-base-label').textContent = tr('Mazo');
    el('lobby-inv-base').innerHTML = base
      .map((c, i) => deckSlotHtml(c, c.symbols.length > plain[i].symbols.length,
        c.isFavorable && evolved.includes(c.associatedPart)))
      .join('');
    el('lobby-inv-extra-label').textContent = tr('Mochila');
    el('lobby-inv-extras').innerHTML = Array.from({ length: EXTRA_SLOTS }, (_, i) => extraSlotHtml(extras[i]))
      .join('');
  }

  /**
   * La mochila como colección: una pila por carta distinta, de la más rara a la más
   * común, cada una con la gema de su rareza, cuántas hay, quién la tiene puesta y sus
   * tres casilleros hacia la fusión (ver `stackTileHtml`). Para mirar, tocar una abre su
   * ficha abajo (`paintBagDetail`): ahí se fusiona y se recicla. Para elegir (`bagFor`),
   * tocar una le pone al Axie una copia suelta; las que no tienen sueltas se apagan.
   * Arriba, el filtro: todas, cada rareza por su gema y las listas para fusionar.
   */
  function paintBag() {
    const stacks = stacksOf(bag);
    const full = bagFor && equippedOn(bag, bagFor).length >= EXTRA_SLOTS;
    // La pestaña puede haberse quedado sin cartas (se recicló o se fusionó la última):
    // si la otra tiene, se pasa a esa.
    const other = bagTier === 'plain' ? 'power' : 'plain';
    if (!stacks.some((st) => shownBy(st, bagTier)) && stacks.some((st) => shownBy(st, other))) bagTier = other;
    if (bagSel && !stacks.some((st) => st.key === bagSel)) bagSel = null;
    el('lobby-bag-title').textContent = bagFor
      ? tr('Mochila · para {name}', { name: axie(bagFor).name })
      : tr('Mochila');
    const hint = !bag.items.length
      ? (bagNote || tr('La mochila está vacía.'))
      : bagFor
        ? (full ? tr('{name} no tiene más espacio.', { name: axie(bagFor).name })
          : looseCards(bag).length ? tr('Tocá una carta para sumarla a su mazo.') : tr('No te quedan cartas sueltas.'))
        : bagNote;
    const hintEl = el('lobby-bag-hint');
    hintEl.textContent = hint;
    hintEl.hidden = !hint;
    const bulk = paintBagTools(stacks);
    const shown = stacks.filter(visible);
    if (bag.items.length && bagSyms.size && !shown.length) {
      hintEl.textContent = bagSyms.size > 1 ? tr('Ninguna carta trae esos símbolos.') : tr('Ninguna carta trae ese símbolo.');
      hintEl.hidden = false;
    }
    el('lobby-bag-grid').innerHTML = shown.map((st) => stackTileHtml(st, {
      attr: bagFor ? `data-bag-add="${st.key}"` : `data-bag-sel="${st.key}"`,
      pressed: !bagFor && st.key === bagSel,
      off: Boolean(bagFor) && (full || !st.loose.length),
      fresh: bagShown.has(st.key),
      worn: wornHtml(st),
    })).join('') + (bulk ? `<div class="bag-foot">${bulk}</div>` : '');
    paintBagDetail(stacks);
    // "Volver" solo cuando se vino del inventario de un Axie: la mochila de la pestaña
    // es una pantalla de las de la barra, y de ahí no se vuelve a ningún lado.
    el('lobby-bag-back').hidden = !bagFor;
    paintBagCount();
  }

  /** Si la pila va en la pestaña: las cartas sin poder o las que traen uno. */
  function shownBy(stack, tab) {
    return tab === 'power' ? Boolean(stack.card.power) : !stack.card.power;
  }

  /** Si la pila trae todos los símbolos prendidos en el filtro. */
  function hasSyms(stack, syms = bagSyms) {
    return [...syms].every((sym) => stack.card.symbols.includes(sym));
  }

  /** Si la pila se ve en la colección: la de la pestaña y con los símbolos del filtro. */
  function visible(stack) {
    return shownBy(stack, bagTier) && hasSyms(stack);
  }

  /** El Axie que tiene puesta una copia de la pila, dibujado chiquito en la esquina (y cuántos más). */
  function wornHtml(stack) {
    const wearers = [...new Set(stack.worn.map((w) => w.axie))];
    if (!wearers.length) return '';
    const names = wearers.map((id) => axie(id).name).join(', ');
    return `<span class="bag-worn" title="${tr('En {name}', { name: names })}">${axieArt(playing(wearers[0]))}${
      wearers.length > 1 ? `<b>+${wearers.length - 1}</b>` : ''}</span>`;
  }

  /**
   * Arriba de la colección, las dos pestañas: las cartas sin poder y las que traen uno.
   * Adentro de cada una van de la más fuerte a la más débil (ver `stacksOf`). Devuelve,
   * para mirar, el reciclado de las sueltas de la pestaña, que va al pie de la colección
   * y chico: rompe cartas, no es a lo que se viene. Pide confirmación con lo que devuelve.
   */
  function paintBagTools(stacks) {
    if (!bag.items.length) { el('lobby-bag-tools').innerHTML = ''; return ''; }
    const tab = (id, label) => `<button class="bag-tab" role="tab" data-bag-tier="${id}"
      aria-pressed="${bagTier === id}" aria-selected="${bagTier === id}"${stacks.some((st) => shownBy(st, id)) ? '' : ' data-empty'}>${label}</button>`;
    let bulk = '';
    const loose = bulkCards(stacks);
    if (!bagFor && loose.length) {
      const gain = loose.reduce((sum, it) => sum + scrapValue(it), 0);
      const ask = bagTier === 'power'
        ? tr('¿Reciclar las {n} sueltas? {k} tienen poder. No se recuperan.', { n: loose.length, k: loose.length })
        : tr('¿Reciclar las {n} sueltas? No se recuperan.', { n: loose.length });
      const label = tr('Reciclado rápido · {n}', { n: loose.length });
      bulk = bagConfirm === 'bulk'
        ? `<span class="bag-bulk is-ask">
            <span class="bag-ask">${ask}</span>
            <button class="bag-scrap" data-bag-bulk-yes>${tr('Reciclar')} <span class="bag-gain">+${shardsHtml(gain)}</span></button>
            <button class="bag-cancel" data-bag-cancel>${tr('No')}</button>
          </span>`
        : `<button class="bag-bulk" data-bag-bulk title="${tr('Recicla todo lo que no tiene puesto ningún Axie')}">${label} <span class="bag-gain">+${shardsHtml(gain)}</span></button>`;
    }
    // Los seis símbolos, en el orden de la rueda. Uno apagado que no daría ninguna carta
    // de la pestaña junto con los ya prendidos se ve hundido.
    const syms = BAG_SYM_ORDER.map((sym) => {
      const on = bagSyms.has(sym);
      const some = stacks.some((st) => shownBy(st, bagTier) && hasSyms(st, new Set([...bagSyms, sym])));
      return `<button class="bag-sym" data-bag-sym="${sym}" aria-pressed="${on}" style="--c:${SYMBOLS[sym].color}"${
        on || some ? '' : ' data-empty'} title="${SYMBOLS[sym].name}">${crest(sym)}</button>`;
    }).join('');
    const clear = bagSyms.size
      ? `<button class="bag-sym bag-sym-clear" data-bag-sym-clear title="${tr('Ver todas')}" aria-label="${tr('Ver todas')}">×</button>` : '';
    el('lobby-bag-tools').innerHTML = `<div class="bag-tabs" role="tablist">${tab('plain', tr('Cartas'))}${tab('power', tr('Poderes'))}</div>
      <div class="bag-syms" role="group" aria-label="${tr('Filtrar por símbolo')}">${syms}${clear}</div>`;
    return bulk;
  }

  /** Lo que recicla el botón del pie: las sueltas de la pestaña. */
  function bulkCards(stacks = stacksOf(bag)) {
    const keys = new Set(stacks.filter(visible).map((st) => st.key));
    return looseCards(bag).filter((it) => scrapValue(it) > 0 && keys.has(cardKey(it)));
  }

  /**
   * La ficha de la pila tocada, encima de la colección: la carta en grande sobre la luz
   * de su rareza, su nombre (el del poder, o la rareza), lo que hace el poder, quién la
   * tiene puesta y la fusión dibujada (`fusionHtml`). Lo que se hace con ella va al pie:
   * fusionar es el botón grande, verde, y aparece solo con tres sueltas; reciclar una
   * copia es chico y pide confirmación. Si no le queda ninguna suelta no se recicla:
   * primero se la saca a un Axie desde su inventario. Se cierra con la ×, tocando
   * afuera o con Escape.
   */
  function paintBagDetail(stacks = stacksOf(bag)) {
    const box = el('lobby-bag-detail');
    const stack = !bagFor && bagSel ? stacks.find((st) => st.key === bagSel) : null;
    box.hidden = !stack;
    if (!stack) { box.innerHTML = ''; return; }
    const { card, tier } = stack;
    const power = card.power ? POWERS[card.power] : null;
    const back = scrapValue(card);
    const ready = Boolean(stack.next) && stack.loose.length >= MERGE_COPIES;
    const wearers = [...new Set(stack.worn.map((w) => w.axie))];
    const count = stack.loose.length + stack.worn.length;
    const name = power ? power.name : tierName(tier) ?? '';
    const scrapBtn = `<button class="bag-scrap" data-bag-scrap>${tr('Reciclar')} <span class="bag-gain">+${shardsHtml(back)}</span></button>`;
    let acts;
    if (bagConfirm === 'one' && stack.loose.length && back) {
      acts = `<p class="bag-ask">${tr('¿Seguro? La carta se rompe y no se recupera.')}</p>
        <span class="bag-acts-row">
          <button class="bag-cancel" data-bag-cancel>${tr('No')}</button>
          <button class="bag-scrap is-sure" data-bag-scrap-yes>${tr('Reciclar')} <span class="bag-gain">+${shardsHtml(back)}</span></button>
        </span>`;
    } else {
      acts = [
        ready ? `<button class="lobby-play bag-fuse" data-bag-fuse>${UP_HTML}<span>${tr('Fusionar')}</span></button>` : '',
        !stack.loose.length
          ? `<p class="bag-why">${tr('Sacala de {name} para reciclarla.', { name: axie(wearers[0]).name })}</p>`
          : back ? scrapBtn : '',
      ].join('');
    }
    box.dataset.tier = tier ?? '';
    box.innerHTML = `
      <div class="bag-sheet" data-tier="${tier ?? ''}" role="dialog" aria-modal="true" aria-label="${name}">
        <button class="bag-close" data-bag-close aria-label="${tr('Cerrar')}" title="${tr('Cerrar')}">×</button>
        <div class="bag-detail-card">${sheetCardHtml(card)}${
          count > 1 ? `<b class="bag-qty">×${count}</b>` : ''}</div>
        <div class="bag-detail-info">
          ${power ? `<p class="bag-detail-name">${name}</p>` : `<p class="bag-detail-name is-tier">${tier ? gemHtml() : ''}${name}</p>`}
          ${power && tier ? `<p class="bag-detail-tier">${gemHtml()}${tierName(tier)}</p>` : ''}
          ${power ? `<div class="bag-detail-power">${powerIcon(card.power)}<div>${momentTag(power.moment)}<p>${power.tip}</p></div></div>` : ''}
          ${wearers.length ? `<p class="bag-detail-worn">${wornHtml(stack)}<span>${tr('Equipada en {name}', { name: wearers.map((id) => axie(id).name).join(', ') })}</span></p>` : ''}
          ${fusionHtml(stack)}
        </div>
        <div class="bag-detail-acts">${acts}</div>
      </div>`;
  }

  /**
   * Fusiona tres copias sueltas de la pila `key` (ver `playMerge` en `card-scene.js`): la
   * escena abre en el altar y, al apretar, la fusión se guarda (`commit`) antes de
   * animarse. Antes de apretar, la escena también recicla una copia (`'scrap'`, con su
   * confirmación ahí mismo) y dice lo que hace el poder: es la ficha de la pila lista.
   * Al volver se queda en la colección, con la carta nueva y su destello; "Fusionar
   * otra" vuelve a abrir la escena, ya andando.
   */
  async function fuse(key, auto = false) {
    const group = mergeGroups(bag).find((g) => g.key === key);
    if (!group) return paintBag();
    let made = null;
    // La fusión pasa en una ficha como esta, más grande (ver `playMerge`): la de la
    // carta se esconde mientras tanto, así no quedan dos apiladas.
    el('lobby-bag-detail').hidden = true;
    const power = group.card.power ? POWERS[group.card.power] : null;
    const back = scrapValue(group.card);
    const choice = await playMerge({
      host: el('card-scene'), group, auto, audio: ui?.audio ?? null,
      detail: power
        ? `<p class="bag-detail-name">${power.name}</p>
          <div class="bag-detail-power">${powerIcon(group.card.power)}<div>${momentTag(power.moment)}<p>${power.tip}</p></div></div>`
        : '',
      scrap: back ? `<span class="bag-gain">+${shardsHtml(back)}</span>` : '',
      commit: () => {
        const done = mergeCards(bag, key);
        if (!done.card) return null;
        bag = done.bag;
        writeBackpack(bag);
        made = done.card;
        bagShown.add(cardKey(made));
        recordMissions({ type: 'merge', n: 1 });
        return { card: made, again: mergeGroups(bag).some((g) => g.key === key) };
      },
    });
    bagConfirm = null;
    bagNote = '';
    bagSel = null;
    if (made) bagTier = made.power ? 'power' : 'plain';
    if (choice === 'scrap') {
      const one = looseCards(bag).find((it) => cardKey(it) === key);
      return one ? scrap([one.id]) : paintBag();
    }
    paintBag();
    if (choice === 'again') return fuse(key, true);
    return choice;
  }

  /** Recicla cartas sueltas: las saca de la mochila y suma lo que devuelven. */
  function scrap(ids) {
    const done = scrapCards(bag, readWallet(), ids);
    bagConfirm = null;
    if (!done.cards.length) return paintBag();
    bag = done.bag;
    writeBackpack(bag);
    writeWallet(done.wallet);
    recordMissions({ type: 'scrap', n: done.cards.length });
    ui?.audio?.sfx?.('renew');
    bagNote = done.cards.length === 1
      ? tr('Reciclaste una carta: +{n} Moonshards', { n: shardAmount(done.gained) })
      : tr('Reciclaste {count} cartas: +{n} Moonshards', { count: done.cards.length, n: shardAmount(done.gained) });
    paintBag();
    paintPurses();
  }

  /** Cuántas cartas sueltas hay, en una chapa sobre la pestaña de la mochila. */
  function paintBagCount() {
    const loose = looseCards(bag).length;
    el('lobby-bag-count').textContent = loose ? String(loose) : '';
  }

  /**
   * Deja anotado con qué jugás, para la próxima vez que se abra el juego y —sobre
   * todo— para la sala: a `?red` se entra por otra dirección y la página se recarga
   * entera, así que esto es lo único que cruza (ver `loadout.js`).
   */
  function remember() {
    writeLoadout(pick, boosts[pick] ?? {}, extrasOf(bag, pick), recordOf(progress, pick).evolved);
  }

  /**
   * Lo que la portada dice del Axie que tenés puesto sin abrir su pestaña: el ícono de
   * los Axies va del color de su clase, y el fondo es su terreno.
   */
  function paintYours() {
    const a = AXIES[pick];
    lobby.dataset.arena = a.class;
    const avatar = el('lobby-nav-axie');
    avatar.innerHTML = axieArt(playing(pick), { alts: false });
    el('adventure-profile-axie').innerHTML = axieArt(playing(pick), { alts: false });
  }

  /**
   * Lo que tenés en la bolsa, arriba a la derecha del mapa, la elección de Axies, el
   * inventario y la mochila. Se lee de lo guardado cada vez que cambia la pantalla: así
   * se ve lo que dejó la última partida, la evolución o el Taller (que pintan la suya).
   */
  function paintPurses() {
    const n = shardAmount(readWallet().moonshards);
    for (const name of ['adventure', 'choose', 'inv', 'bag']) {
      const purse = document.getElementById(`${name}-purse`);
      if (!purse) continue;
      el(`${name}-shards`).textContent = n;
      purse.title = tr('{n} Moonshards', { n });
    }
  }

  /**
   * Tu perfil, arriba del mapa: el nivel y la barra de experiencia (ver `profile.js`).
   * La barra se llena con `transform`, no con el ancho.
   */
  function paintProfile(progress) {
    const me = profileOf(progress);
    el('adventure-profile-level').textContent = String(me.level);
    el('adventure-profile-name').textContent = tr('Nivel {n}', { n: me.level });
    el('adventure-profile-xp').textContent = `${me.into}/${me.need}`;
    el('adventure-profile-fill').style.setProperty('--fill', me.frac.toFixed(3));
    const bar = el('adventure-profile-bar');
    bar.setAttribute('aria-valuenow', String(Math.round(me.frac * 100)));
    bar.setAttribute('aria-valuetext', tr('{into} de {need} de experiencia', { into: me.into, need: me.need }));
    el('adventure-profile').title = tr('Nivel {n} · {into} de {need} de experiencia', { n: me.level, into: me.into, need: me.need });
  }

  /**
   * El panel de tu perfil (`#profile-modal`), que se abre tocando tu Axie y tu nivel
   * arriba del mapa. Todo sale de lo guardado: el progreso de la Aventura, la bolsa de
   * Moonshards, la mochila, el Taller y el nivel de cada Axie. Se pinta al abrirlo, así
   * lee lo último que dejó una partida.
   */
  function paintProfilePanel() {
    progress = readProgress();
    bag = readBackpack();
    const adv = getAdventureProgress();
    const me = profileOf(adv);
    const won = new Set(adv.completedLevels);
    const starred = new Set(adv.starredLevels);
    const total = ADVENTURE_LEVELS.length;
    const stat = (value, label) => `<li class="pf-stat"><b>${value}</b><span>${label}</span></li>`;
    const chapters = adventureChapters().map((ch) => {
      const done = ch.levels.filter((l) => won.has(l.id)).length;
      const stars = ch.levels.filter((l) => starred.has(l.id)).length;
      const open = ch.levels.some((l) => isLevelUnlocked(l.id));
      return `<li class="pf-chapter" data-locked="${!open}" style="--fill:${(done / ch.levels.length).toFixed(3)}">
        <span class="pf-chapter-name"><small>${tr('Capítulo {n}', { n: ch.n })}</small>${ch.name || ''}</span>
        <span class="pf-chapter-bar"><i></i></span>
        <span class="pf-chapter-count">${done}/${ch.levels.length} <b>★</b> ${stars}</span>
      </li>`;
    }).join('');
    // Tus Axies: los tres con más partidas terminadas (a la par, el de más AXP). Sin
    // ninguna jugada todavía, el que tenés puesto.
    const playedOf = (id) => recordOf(progress, id).played ?? 0;
    const used = AXIE_IDS.filter((id) => playedOf(id) > 0)
      .sort((a, b) => playedOf(b) - playedOf(a) || recordOf(progress, b).axp - recordOf(progress, a).axp)
      .slice(0, PROFILE_TOP);
    const axies = (used.length ? used : [pick]).map((id) => {
      const n = playedOf(id);
      return `<button type="button" class="pf-axie" data-axie="${id}" aria-current="${id === pick}" title="${AXIES[id].name}">
        <span class="roster-art">${axieArt(playing(id), { alts: false })}</span>
        <span class="pf-axie-name">${AXIES[id].name}</span>
        <span class="choose-lvl">${tr('LVL')} <b>${levelOfAxie(id)}</b></span>
        <span class="pf-axie-played">${n === 1 ? tr('1 partida') : tr('{n} partidas', { n })}</span>
      </button>`;
    }).join('');
    el('profile-body').innerHTML = `
      <div class="pf-head">
        <span class="adv-profile-ring pf-ring" aria-hidden="true"><span class="adv-profile-axie">${axieArt(playing(pick), { alts: false })}</span></span>
        <div class="pf-level">
          <p class="pf-title">${tr('Nivel {n}', { n: me.level })}</p>
          <span class="adv-profile-bar pf-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(me.frac * 100)}">
            <i class="adv-profile-fill" style="--fill:${me.frac.toFixed(3)}"></i>
            <small class="adv-profile-xp">${me.into}/${me.need}</small>
          </span>
          <p class="pf-next">${tr('Te faltan {n} de experiencia para el nivel {next}', { n: me.need - me.into, next: me.level + 1 })}</p>
          <p class="pf-how">${tr('Cada nivel superado da {a}; cada estrella, {b}.', { a: PROFILE_XP.level, b: PROFILE_XP.star })}</p>
        </div>
      </div>
      <ul class="pf-stats">
        ${stat(`${won.size}/${total}`, tr('Niveles superados'))}
        ${stat(`<span class="pf-star">★</span> ${starred.size}/${total}`, tr('Estrellas'))}
        ${stat(shardsHtml(readWallet().moonshards), tr('Moonshards'))}
        ${stat(String(me.xp), tr('Experiencia total'))}
        ${stat(String(bag.items.length), tr('Cartas en la mochila'))}
        ${stat(String(readCraft().crafted), tr('Cartas creadas'))}
      </ul>
      <h3>${tr('Aventura')}</h3>
      <ul class="pf-chapters">${chapters}</ul>
      <h3>${tr('Los que más usás')}</h3>
      ${used.length ? '' : `<p class="pf-note">${tr('Todavía no terminaste ninguna partida.')}</p>`}
      <div class="pf-axies">${axies}</div>`;
  }

  function openProfile() {
    paintProfilePanel();
    el('profile-modal').showModal();
  }

  /**
   * Los Axies de los tres banderines de los duelos. En el tutorial, los dos que se
   * cruzan en él (ver `createTutorial`). Contra la CPU, el tuyo frente a uno sorteado;
   * en la red, dos sorteados que no son el tuyo. Quietos: son dibujos, y un menú
   * abierto no tiene por qué trabajar (el saltito al pasar por encima es un
   * `transform` del CSS).
   */
  function paintModes() {
    const others = shuffle(AXIE_IDS.filter((id) => id !== pick));
    const scene = (node, ids) => {
      node.innerHTML = ids
        .map(([id, face]) => `<span class="mode-axie" data-face="${face}">${axieArt(id, { alts: false })}</span>`)
        .join('');
      node.dataset.cast = ids.length;
    };
    scene(el('mode-scene-tutorial'), [[TUTORIAL_AXIES[0], 'right'], [TUTORIAL_AXIES[1], 'left']]);
    scene(el('mode-scene-cpu'), [[playing(pick), 'right'], [others[0], 'left']]);
    scene(el('mode-scene-net'), [[others[1], 'right'], [others[2], 'left']]);
  }

  /** Pone un Axie en la ficha. */
  function show(id) {
    if (!id || id === seen) return;
    seen = id;
    paintChoose();
    markRoster({ reveal: true });
    // El que pasa a la ficha se presenta con un festejo.
    heroMotion.pulse('cheer');
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
   * Guarda la mochila y repinta lo que la muestra. Si el Axie que cambió es el que
   * tenés puesto, cambia el mazo con el que jugás: se anota ahí mismo, sin pasar por el
   * botón de elegir, que es de elegir bicho.
   */
  function saveBag(next, axieId) {
    bag = next;
    writeBackpack(bag);
    if (axieId === pick) remember();
    paintRoster();
  }

  /** Abre el inventario del Axie de la vista previa. */
  function toInventory() {
    paintInventory();
    view('inv');
  }

  /**
   * Abre la evolución de `id` (el de la vista previa). Queda en la ficha: "Volver" vuelve
   * a él, también cuando se entró desde la zona de testeo.
   */
  function toEvolve(id = seen) {
    seen = id;
    evolveView.open(id);
    view('evolve');
  }

  /** De la evolución a la vista previa, con lo que haya cambiado ya pintado. */
  function leaveEvolve() {
    if (evolveView.busy) return;
    paintChoose();
    paintRoster();
    view('choose');
  }

  /** Abre la mochila: para mirar, o para elegir una carta para `axieId`. */
  function toBag(axieId = null) {
    bagFor = axieId;
    // Se relee: el Taller o el botín de una partida la pudieron cambiar.
    bag = readBackpack();
    bagSel = null;
    bagConfirm = null;
    bagNote = '';
    // Lo recién llegado lleva su destello mientras se mira esta vez, y nunca más.
    bagShown = bagFresh;
    bagFresh = new Set();
    // El efecto del kit que estalla en la fusión se baja de a poco, con la página libre.
    preloadVfx('win', { later: true });
    paintBag();
    view('bag');
  }

  /**
   * Vuelve de la mochila al inventario del que se abrió. La de la pestaña no tiene a
   * dónde volver: es una de las pantallas de la barra.
   */
  function leaveBag() {
    if (!bagFor) return;
    paintInventory();
    view('inv');
    bagFor = null;
  }

  /** Abre la elección, parada en el Axie que tenés puesto. */
  function toChoose() {
    seen = pick;
    // Se abre con la colección entera: una búsqueda que quedó puesta de la otra vez
    // podría estar escondiendo justo el que tenés.
    query = '';
    // La mochila se relee: otra pestaña, o el botín de una partida, la pudo cambiar.
    bag = readBackpack();
    // "Volver" es para cuando se abre encima de una sala; en la barra es una pestaña.
    el('lobby-choose-back').hidden = !overRoom();
    paintSearch();
    paintBagCount();
    paintChoose();
    paintRoster();
    view('choose');
    markRoster({ reveal: true });
  }

  /**
   * Abre el mapa parado en el nivel que toca jugar. Se queda en el que estaba solo si
   * todavía no lo ganaste —perdiste y volvés a intentar—; uno ya superado no es a lo
   * que se vuelve después de ganarlo, así que el mapa salta al siguiente.
   */
  function toAdventure() {
    const progress = getAdventureProgress();
    const stay = selectedAdvLevel && isLevelUnlocked(selectedAdvLevel)
      && !progress.completedLevels.includes(selectedAdvLevel);
    if (!stay) selectedAdvLevel = levelToPlay(progress);
    advMore = false;
    paintWorld();
    paintAdventure();
    view('adventure');
    // Recién con la pantalla puesta el mundo mide algo: ahí se lo corre hasta el nivel.
    centerLevel({ smooth: false });
  }

  /**
   * Cómo se recorre el mundo en esta pantalla: de abajo para arriba en un teléfono parado
   * (o una ventana angosta, la misma regla que acomoda el panel en el CSS) y de costado
   * en todo lo demás.
   */
  function mapOrient() {
    return typeof matchMedia === 'function' && matchMedia(MAP_PORTRAIT).matches ? 'v' : 'h';
  }

  /**
   * El mundo, de nuevo entero: el dibujo, el camino, los niveles y tu Axie. Va al abrir
   * la pantalla y al girar el teléfono; elegir otro nivel no lo repinta (ver
   * `selectLevel`), así tu Axie puede ir caminando hasta allá.
   */
  function paintWorld({ still = false } = {}) {
    if (!advLevels) return;
    const orient = mapOrient();
    advLevels.dataset.orient = orient;
    // Con `IntersectionObserver` el mundo sale vacío y se pinta de a una tierra, la que se
    // acerca a la pantalla (ver `watchArt`); sin él, entero.
    const lazy = typeof IntersectionObserver === 'function';
    stillRivals();
    mountedZones.clear();
    advLevels.innerHTML = worldHtml({ selected: selectedAdvLevel, pick: playing(pick), orient, lazy });
    if (!still) watchRivals();
    // La del nivel elegido y las de al lado, ya: es lo primero que se ve.
    if (lazy) {
      const c = chapterIndexOf(selectedAdvLevel);
      for (const i of [c, c - 1, c + 1]) mountZone(i);
    }
    // De fondo (ver `behindMap`) el mundo se dibuja quieto.
    if (still) return;
    watchZones();
    if (lazy) watchArt();
    mountHero();
  }

  /**
   * Las tierras del mapa que están pintadas. Montar una es llenar su lugar en cada capa del
   * dibujo, su capa viva, su clima y sus nubes, y los rivales de sus niveles abiertos (ver
   * `zoneContent`); las piezas de su tierra y de las de al lado se definen una vez y quedan.
   */
  const mountedZones = new Set();
  function mountZone(c) {
    const map = advLevels?.querySelector?.('.adv-map');
    if (!map || c < 0 || mountedZones.has(c) || !map.querySelector(`.adv-zone[data-zone="${c}"]`)) return;
    mountedZones.add(c);
    const orient = map.dataset.orient;
    const part = zoneContent(orient, c);
    const defs = map.querySelector('.adv-land-defs');
    for (const land of part.lands) {
      if (!defs.querySelector(`[data-land="${land}"]`)) defs.insertAdjacentHTML('beforeend', landDefsHtml(orient, land));
    }
    for (const layer of ['soil', 'ground', 'things', 'top']) {
      const slot = map.querySelector(`.adv-layer[data-layer="${layer}"] [data-zone="${c}"]`);
      if (slot) slot.innerHTML = part[layer];
    }
    const life = map.querySelector(`.adv-life[data-zone="${c}"]`);
    if (life) life.innerHTML = part.life;
    const zone = map.querySelector(`.adv-zone[data-zone="${c}"]`);
    if (zone) zone.innerHTML = part.sky;
    // Los rivales, con las poses de su capítulo: sin ellas no tienen sus gestos.
    loadRivalPoses(part.chapter).then(() => {
      if (!mountedZones.has(c) || !map.isConnected) return;
      for (const r of part.rivals) {
        const node = map.querySelector(`[data-adv-level="${r.level}"] .adv-spot-rival`);
        if (!node || node.firstElementChild) continue;
        node.innerHTML = axieArt(r.axie);
        rivalWatch?.observe(node);
      }
    });
  }

  /** Vacía la tierra `c`: su dibujo, lo que se mueve y sus rivales (que se quedan quietos). */
  function unmountZone(c) {
    const map = advLevels?.querySelector?.('.adv-map');
    if (!map || !mountedZones.has(c)) return;
    mountedZones.delete(c);
    for (const slot of map.querySelectorAll(`.adv-art-zone[data-zone="${c}"], .adv-life[data-zone="${c}"], .adv-zone[data-zone="${c}"]`)) slot.innerHTML = '';
    for (const node of map.querySelectorAll(`.adv-spot[data-zone="${c}"] .adv-spot-rival`)) {
      rivalMotions.get(node)?.stop();
      rivalMotions.delete(node);
      rivalWatch?.unobserve(node);
      node.innerHTML = '';
    }
  }

  /**
   * Qué tierras se pintan: las que están a menos de una pantalla de lo que se ve. Las que
   * se alejan se vacían, así el mapa nunca tiene más de tres o cuatro tierras dibujadas.
   */
  let artWatch = null;
  function watchArt() {
    artWatch?.disconnect();
    const zones = [...(advLevels?.querySelectorAll?.('.adv-zone') ?? [])];
    artWatch = new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) {
        const c = Number(target.dataset.zone);
        if (isIntersecting) mountZone(c);
        else unmountZone(c);
      }
    }, { root: advLevels, rootMargin: '100%' });
    for (const zone of zones) artWatch.observe(zone);
  }

  /**
   * Los rivales del mapa, vivos: respiran y cada tanto hacen un gesto, cada uno a su
   * ritmo (en fase distinta, así no respiran todos juntos). Solo los que están cerca de
   * la pantalla: el que sale de vista se queda quieto, y vuelve a respirar al volver.
   */
  const rivalMotions = new Map();
  let rivalWatch = null;
  function stillRivals() {
    rivalWatch?.disconnect();
    rivalWatch = null;
    for (const motion of rivalMotions.values()) motion.stop();
    rivalMotions.clear();
  }
  function watchRivals() {
    stillRivals();
    const rivals = [...(advLevels?.querySelectorAll?.('.adv-spot-rival') ?? [])].filter((r) => r.firstElementChild ?? r.innerHTML);
    if (typeof IntersectionObserver !== 'function') return;
    rivalWatch = new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) {
        const motion = rivalMotions.get(target);
        if (isIntersecting && !motion) {
          const alive = createMotion(target, Math.random(), { fidget: MAP_FIDGET });
          alive.mount(target.dataset.axie);
          rivalMotions.set(target, alive);
        } else if (!isIntersecting && motion) {
          motion.stop();
          rivalMotions.delete(target);
        }
      }
    }, { root: advLevels, rootMargin: '15%' });
    for (const rival of rivals) rivalWatch.observe(rival);
  }

  /** Tu Axie, vivo: respira y cada tanto hace un gesto, como el rival del panel. */
  function mountHero() {
    walkerMotion?.stop();
    const hero = advLevels?.querySelector?.('.adv-hero');
    if (!hero?.classList) return;
    walkerMotion = createMotion(hero, 0, { fidget: RIVAL_FIDGET });
    walkerMotion.mount(playing(pick));
  }

  /** Qué tierra se ve: esa corre su clima (`data-inview`); las demás, quietas. */
  let zoneWatch = null;
  function watchZones() {
    zoneWatch?.disconnect();
    const zones = [...(advLevels?.querySelectorAll?.('.adv-zone, .adv-life') ?? [])];
    if (typeof IntersectionObserver !== 'function') return;
    zoneWatch = new IntersectionObserver((entries) => {
      for (const { target, intersectionRatio } of entries) target.dataset.inview = String(intersectionRatio > 0.08);
    }, { root: advLevels, threshold: [0, 0.08, 0.3] });
    for (const zone of zones) zoneWatch.observe(zone);
  }

  /**
   * Corre el mundo hasta dejar el nivel elegido en el medio de lo que se ve: de costado,
   * en el medio de la pantalla; parado, en el medio de la franja libre entre la barra de
   * arriba y el panel de abajo. Mide una sola vez.
   */
  function centerLevel({ smooth = true } = {}) {
    const node = advLevels?.querySelector?.(`[data-adv-level="${selectedAdvLevel}"]`);
    const map = node?.closest?.('.adv-map');
    if (!map || typeof advLevels.scrollTo !== 'function') return;
    const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const behavior = smooth && !still ? 'smooth' : 'auto';
    if (map.dataset.orient === 'v') {
      const box = advLevels.getBoundingClientRect();
      const bar = adv.querySelector('.adv-bar')?.getBoundingClientRect();
      const panel = advCard?.getBoundingClientRect?.();
      const top = (bar?.bottom ?? box.top) - box.top;
      const bottom = (panel?.top ?? box.bottom) - box.top;
      advLevels.scrollTo({ top: map.offsetTop + node.offsetTop - (top + bottom) / 2, behavior });
    } else {
      advLevels.scrollTo({ left: map.offsetLeft + node.offsetLeft - advLevels.clientWidth / 2, behavior });
    }
  }

  /**
   * Elige el nivel `id`: su rival se para al costado del nivel, el panel cuenta qué trae,
   * tu Axie camina por el camino hasta el otro costado y el mundo se corre hasta dejarlo
   * en el medio. Tocar otra vez el que ya está elegido lo juega: el primer toque muestra,
   * el segundo pelea.
   */
  function selectLevel(id) {
    if (!isLevelUnlocked(id)) return;
    if (id === selectedAdvLevel) {
      return playAdventure(id, centerOf(advLevels?.querySelector?.(`[data-adv-level="${id}"] .adv-spot-icon`)));
    }
    const from = selectedAdvLevel;
    const to = advLevels?.querySelector?.(`[data-adv-level="${id}"]`);
    const hero = advLevels?.querySelector?.('.adv-hero');
    selectedAdvLevel = id;
    advMore = false;
    if (!to?.style || !hero?.style) {
      paintWorld();
    } else {
      for (const btn of advLevels.querySelectorAll('[data-adv-level]')) {
        btn.setAttribute('aria-pressed', String(Number(btn.dataset.advLevel) === id));
      }
      walkHero(hero, from, id, advLevels.dataset?.orient ?? 'h');
    }
    paintAdventure();
    centerLevel();
  }

  /** Un nivel para adelante o para atrás en el mapa, sin pasar a los cerrados. */
  function browseLevels(step) {
    const open = ADVENTURE_LEVELS.filter((l) => isLevelUnlocked(l.id)).map((l) => l.id);
    const i = open.indexOf(selectedAdvLevel);
    const next = open[(i + step + open.length) % open.length];
    if (next === undefined || next === selectedAdvLevel) return;
    selectLevel(next);
  }

  /** Abre o cierra el detalle del nivel en el panel. */
  function toggleMore(force = !advMore) {
    advMore = force;
    if (advCard?.dataset) advCard.dataset.more = String(advMore);
    const btn = advCard?.querySelector?.('[data-adv-more]');
    if (btn) {
      btn.setAttribute('aria-expanded', String(advMore));
      btn.setAttribute('aria-label', advMore ? tr('Menos') : tr('Detalles'));
    }
  }

  /**
   * El panel del nivel elegido, al pie del mapa. Una tabla de madera con el número del
   * nivel en grande, el nombre, contra quién va y qué tan difícil es, y a la derecha la estrella que se gana
   * por K.O. y el único botón de pelear. El rival no se repite acá: ya está vivo en el
   * mapa, al lado de su nivel. Lo que estrena el nivel va en su naipe, y tocarlo abre
   * para arriba el detalle: la historia, la definición entera de cada poder y los que
   * también pueden salir.
   */
  function paintAdventure() {
    if (!advLevels || !advCard) return;
    const progress = getAdventureProgress();
    const current = getAdventureLevel(selectedAdvLevel);
    const rivalAxie = axie(current.rival);
    const rivalSym = SYMBOLS[rivalAxie.class];

    // Arriba, las estrellas: una por nivel ganado por K.O. (ver `wonByKo` en `game.js`).
    const total = ADVENTURE_LEVELS.length;
    const won = progress.completedLevels.length;
    const stars = progress.starredLevels.length;
    el('adventure-progress').innerHTML = `<b>★</b> ${stars}/${total}`;
    el('adventure-progress').title = tr('{stars} estrellas · {won} de {total} niveles superados', { stars, won, total });
    paintProfile(progress);
    paintPurses();
    missions.paint();

    // Lo que estrena el nivel: en el naipe, un renglón por poder con su `tip`; en el
    // detalle, la definición entera (`note`), la misma del `title` de los íconos en la
    // mesa: una sola redacción para todo el juego.
    const fresh = [...(current.newPowers ?? []), ...(current.showcase ?? [])];
    const freshLine = fresh.map((pId) => `<span class="adv-new">${powerIcon(pId)}<span class="adv-new-text"><b>${POWERS[pId].name}${momentTag(POWERS[pId].moment)}</b><span>${POWERS[pId].tip}</span></span></span>`).join('');
    const powersHtml = fresh.map((pId) => {
      const p = POWERS[pId];
      const color = p.symbol ? SYMBOLS[p.symbol].color : '#d9a05b';
      const owner = p.symbol ? `${crest(p.symbol, 'sm')}${SYMBOLS[p.symbol].name}` : tr('Comodín');
      return `<div class="adv-power" style="--c:${color}">
        <span class="adv-power-icon">${powerIcon(pId, 'lg')}</span>
        <span class="adv-power-text">
          <span class="adv-power-name"><b>${p.name}</b><span class="adv-power-owner">${owner}</span>${momentTag(p.moment)}</span>
          <span class="adv-power-note">${p.note[0].toUpperCase()}${p.note.slice(1)}.</span>
        </span>
      </div>`;
    }).join('');
    // Los demás poderes con que se pelea este nivel: su combinación es fija (ver
    // `levelPowers` en `adventure.js`), así que se pueden mostrar antes de entrar.
    const older = (current.activePowers ?? []).filter((p) => !fresh.includes(p));
    const powerColor = (pId) => (POWERS[pId].symbol ? SYMBOLS[POWERS[pId].symbol].color : '#d9a05b');
    // La mochila del rival (ver `RIVAL_LADDER`): sus cartas como en la mesa, con la gema
    // de su rareza. En un nivel que no estrena poder, lo nuevo es el rival: va en el naipe.
    const bag = current.extras ?? [];
    const bagHtml = bag.map((card) => `<span class="adv-bag-card" data-tier="${tierOf(card)?.id ?? ''}">${sheetCardHtml(card)}${gemHtml('adv-bag-gem')}</span>`).join('');
    const bagLabel = bag.length === 1 ? tr('1 carta de mochila') : tr('{n} cartas de mochila', { n: bag.length });
    const bagLine = bag.length
      ? `<span class="adv-new adv-new--bag"><span class="adv-bag" role="img" aria-label="${bagLabel}">${bagHtml}</span><span class="adv-new-text"><b>${tr('Su mochila')}</b></span></span>`
      : '';
    const bagMore = bag.length
      ? `<p class="choose-label">${tr('La mochila del rival')}</p><div class="adv-bag adv-bag--more" role="img" aria-label="${bagLabel}">${bagHtml}</div>`
      : '';
    // Los amuletos de un jefe: uno por parte, siempre los mismos (ver `adventureCharms`).
    const charms = current.boss ? Object.values(adventureCharms(current) ?? {}) : [];
    const charmMore = charms.length
      ? `<p class="choose-label">${tr('Sus amuletos')}</p>
        <div class="adv-pool">${charms.map((pId) => `<span class="adv-pool-power" title="${POWERS[pId].name}" style="--c:${powerColor(pId)}">${powerIcon(pId)}</span>`).join('')}</div>`
      : '';
    const olderHtml = older.length
      ? `<p class="choose-label">${fresh.length ? tr('También en este nivel') : tr('Los poderes de este nivel')}</p>
        <div class="adv-pool">${older.map((pId) => `<span class="adv-pool-power" title="${POWERS[pId].name}" style="--c:${powerColor(pId)}">${powerIcon(pId)}</span>`).join('')}</div>`
      : '';

    // Contra quién y qué trae: el rival con su clase, la dificultad en tres marcas (las
    // mismas palabras que el selector del Vs CPU), la vida de un jefe y sus partes
    // evolucionadas.
    const evolvedParts = rivalAxie.evolved ?? [];
    const level = DIFF_LEVEL[current.difficulty] ?? 2;
    const pips = [1, 2, 3].map((n) => `<i data-on="${n <= level}"></i>`).join('');
    const meta = [
      `<span class="adv-meta-rival" style="--c:${rivalSym.color}">${crest(rivalAxie.class, 'sm')}${rivalAxie.name}</span>`,
      `<span class="adv-diff" data-diff="${current.difficulty}"><span class="adv-pips" aria-hidden="true">${pips}</span>${tr(DIFF_CHIP[current.difficulty] ?? current.difficulty)}</span>`,
      current.boss ? `<span class="adv-meta-boss">${HEART_SVG}${tr('Jefe')} · ${tr('{hp} de vida', { hp: current.hp ?? TARGET })}</span>`
        : current.hp && current.hp !== TARGET ? `<span class="adv-meta-boss" data-common>${HEART_SVG}${tr('{hp} de vida', { hp: current.hp })}</span>` : '',
      evolvedParts.length ? `<span class="adv-meta-evo">${evolvedParts.length === 1
        ? tr('1 parte evolucionada') : tr('{n} partes evolucionadas', { n: evolvedParts.length })}</span>` : '',
    ].filter(Boolean).join('');
    const evolvedNote = evolvedParts.length
      ? `<p class="adv-evo-note">${tr('Evolucionadas: {parts}. Cada carta de una parte evolucionada suma un símbolo y encadena mejor.', {
          parts: evolvedParts.map((p) => PART_NAMES[p]).join(', '),
        })}</p>`
      : '';

    const completed = progress.completedLevels.includes(current.id);
    const starred = progress.starredLevels.includes(current.id);
    // El número va en grande al lado: el título es solo el nombre.
    const title = current.name;
    const kind = current.boss ? 'boss' : current.evolved ? 'elite' : 'normal';
    // El naipe toma el color de la clase del poder que estrena, como sus cartas; sin poder
    // nuevo, el del rival, que es lo nuevo.
    const lead = POWERS[fresh[0]]?.symbol ?? (fresh.length ? null : rivalAxie.class);
    const newsColor = lead ? SYMBOLS[lead].color : '#d9a05b';
    const newsTag = fresh.length ? tr('Nuevo') : tr('Rival');
    const newsList = fresh.length ? freshLine : bagLine;
    const starNote = starred ? tr('Con estrella') : completed ? tr('Superado') : tr('Por K.O.');

    advCard.dataset.more = String(advMore);
    advCard.dataset.kind = kind;
    advCard.innerHTML = `
      <div class="adv-panel-more" id="adventure-more">
        <p class="adv-card-desc">${current.description}</p>
        ${evolvedNote}
        <div class="adv-powers">${powersHtml}</div>
        ${charmMore}
        ${bagMore}
        ${olderHtml}
      </div>
      <span class="adv-no" data-kind="${kind}" aria-hidden="true">${current.id}</span>
      <div class="adv-head">
        <h2 class="adv-card-title"><span class="sr-only">${tr('Nivel {n}', { n: current.id })}: </span>${title}</h2>
        <p class="adv-meta">${meta}</p>
      </div>
      <button class="adv-news" style="--c:${newsColor}" data-adv-more aria-expanded="${advMore}" aria-controls="adventure-more"
        aria-label="${advMore ? tr('Menos') : tr('Detalles')}">
        <span class="adv-news-tag">${newsTag}</span>
        <span class="adv-news-list">${newsList}</span>
        <svg class="adv-news-more" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 12.5 10 7.5l5 5"/></svg>
      </button>
      <span class="adv-star" data-earned="${starred}" data-done="${completed}" title="${tr('Ganale por K.O. para la estrella')}">
        <img src="${PVE_UI}/Frames/star.png" alt=""><span>${starNote}</span>
      </span>
      <button class="lobby-play choose-go" id="lobby-adventure-play">${completed ? tr('Volver a Jugar') : tr('¡Pelear!')}</button>
    `;
  }

  /**
   * Entra al nivel `lvlId`, con la transición de la mesa (ver `enter` en `ui.js`): las
   * cartas salen de `from` —el nivel o el botón que se tocó— y la portada se va recién
   * cuando el muro ya tapa todo, así no se ve la mesa vieja en el medio.
   */
  function playAdventure(lvlId, from = null) {
    // La primera pelea de todas es el tutorial: el juego se abre en el mapa, y quien
    // llega de nuevo no sabe qué es una cadena. Termina ofreciendo volver al mapa.
    if (!tutorialSeen()) return startTutorial();
    ui.enter({
      mode: 'adventure',
      adventureLevel: lvlId,
      axie: pick,
      boosts: boosts[pick] ?? {},
      extras: extrasOf(bag, pick),
      evolved: recordOf(progress, pick).evolved,
    }, { from, onCovered: () => close({ instant: true }) });
  }

  /** El centro de lo que se tocó, en la pantalla. */
  const centerOf = (node) => {
    const r = node?.getBoundingClientRect?.();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  };

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
      // Las mejoras y las cartas de la mochila viajan al lado de su Axie: son de él,
      // no del asiento. El de la máquina se sortea en el momento y no lleva nada.
      boosts: boosts[pick] ?? {},
      extras: extrasOf(bag, pick),
      evolved: recordOf(progress, pick).evolved,
    });
    close();
  }

  /**
   * El botón grande de la elección: se queda con el que estabas mirando. No arranca
   * ninguna partida: jugar es de las otras pestañas, y son dos preguntas distintas (ver
   * el comentario de arriba de todo). Se queda en la pestaña, con el nuevo marcado.
   */
  function chooseGo() {
    if (shown() === pick && !overRoom()) return;
    pick = shown();
    remember();
    onPick?.();
    // En una sala esta pantalla es una visita: se abrió encima de la sala y al elegir
    // se va, porque atrás está lo que estabas haciendo.
    if (overRoom()) return close();
    paintYours();
    paintChoose();
    paintRoster();
    // El elegido lo festeja.
    heroMotion.pulse('cheer');
  }

  let activeTutorial = null;
  function cleanupTutorial() {
    if (activeTutorial) {
      activeTutorial.destroy();
      activeTutorial = null;
    }
  }

  /**
   * Pone la portada en la pantalla `which`. `axie` es para la evolución, que se abre
   * sobre un Axie (la zona de testeo la abre con el de su partida).
   */
  function open(which = 'adventure', { axie: axieId = null } = {}) {
    cleanupTutorial();
    progress = readProgress();
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
    // Detrás del video —y en las pantallas que no lo llevan— el terreno es el de tu
    // Axie: la pantalla es tuya y el fondo es tu casa.
    paintYours();
    // Encima de una sala no hay barra: de la portada se usa solo la elección.
    lobby.dataset.room = String(overRoom());
    if (nav) nav.hidden = overRoom();
    paintBagCount();
    lobby.hidden = false;
    if (which === 'evolve') {
      // Detrás de la evolución está la colección, que es a donde vuelve.
      toChoose();
      toEvolve(AXIE_IDS.includes(axieId) ? axieId : pick);
    } else goTab(TAB_FOR[which] ?? which);
    // En la portada no hay partida que abandonar: la salida del menú se guarda y vuelve
    // a aparecer cuando la portada se va y empieza una. En una sala la maneja `net.js`.
    if (!overRoom()) el('menu-btn').hidden = true;
  }

  /**
   * Pone la pantalla de una pestaña, desde el principio: la elección parada en el Axie
   * que tenés puesto y con las cartas ya dibujadas, el mapa en el nivel que toca, la
   * mochila para mirar. Tocar la pestaña que ya está puesta la vuelve a su raíz (del
   * inventario, a la colección).
   */
  function goTab(tab) {
    if (tab === 'axies') return toChoose();
    if (tab === 'adventure') return toAdventure();
    if (tab === 'bag') return toBag(null);
    if (tab === 'craft') {
      workshop.open();
      return view('craft');
    }
    return view('menu');
  }

  function close({ instant = false } = {}) {
    if (!lobby.hidden && !instant) ghostOut(lobby, document.body);
    lobby.hidden = true;
    if (!overRoom()) el('menu-btn').hidden = false;
    heroMotion.stop();
    invMotion.stop();
    evolveView.stop();
    workshop.stop();
    walkerMotion?.stop();
    stillRivals();
  }

  // La barra de abajo: cada pestaña pone su pantalla. Colgada de la barra y no de cada
  // botón, como el resto.
  nav?.addEventListener?.('click', (e) => {
    const tab = e.target?.closest?.('[data-tab]')?.dataset?.tab;
    if (tab) goTab(tab);
  });
  // "Volver" de la elección solo existe encima de una sala (ver `toChoose`).
  el('lobby-choose-back').addEventListener('click', () => close());
  adv.addEventListener('click', (e) => {
    const closest = (sel) => e.target?.closest?.(sel) ?? null;
    if (closest('#lobby-adventure-play')) return playAdventure(selectedAdvLevel, centerOf(closest('#lobby-adventure-play')));
    if (closest('[data-adv-more]')) return toggleMore();
    const lvlBtn = closest('[data-adv-level]');
    if (lvlBtn && !advDragged) return selectLevel(Number(lvlBtn.dataset.advLevel));
  });
  // El mundo se recorre de costado: con el dedo es el scroll de siempre; con el mouse,
  // la rueda (que va para abajo) lo corre y se lo puede arrastrar. Un arrastre no es un
  // toque: el nivel de abajo no se elige.
  let advDrag = null;
  let advDragged = false;
  advLevels?.addEventListener?.('wheel', (e) => {
    // Parado, la rueda ya corre el mundo por su cuenta.
    if (advLevels.dataset.orient === 'v' || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    advLevels.scrollLeft += e.deltaY;
    e.preventDefault();
  }, { passive: false });
  advLevels?.addEventListener?.('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    advDrag = { x: e.clientX, y: e.clientY, left: advLevels.scrollLeft, top: advLevels.scrollTop };
    advDragged = false;
  });
  advLevels?.addEventListener?.('pointermove', (e) => {
    if (!advDrag) return;
    const vertical = advLevels.dataset.orient === 'v';
    const d = vertical ? e.clientY - advDrag.y : e.clientX - advDrag.x;
    if (Math.abs(d) > 6) advDragged = true;
    if (!advDragged) return;
    if (vertical) advLevels.scrollTop = advDrag.top - d;
    else advLevels.scrollLeft = advDrag.left - d;
  });
  // Al girar el teléfono el mundo se rearma en la otra orientación, parado en el mismo
  // nivel.
  if (typeof matchMedia === 'function') {
    matchMedia(MAP_PORTRAIT).addEventListener?.('change', () => {
      if (lobby.hidden) return;
      paintWorld({ still: lobby.dataset.view !== 'adventure' });
      centerLevel({ smooth: false });
    });
  }
  const endDrag = () => {
    advDrag = null;
    // El `click` del final del arrastre llega después: se lo deja pasar vacío.
    setTimeout(() => { advDragged = false; }, 0);
  };
  advLevels?.addEventListener?.('pointerup', endDrag);
  advLevels?.addEventListener?.('pointerleave', endDrag);
  // La colección: tocar un Axie lo pone en la vista previa y escribir busca. Colgados de las cajas y no de cada botón, que se redibujan.
  el('lobby-choose-roster').addEventListener('click', (e) => {
    show(e.target.closest?.('[data-axie]')?.dataset?.axie);
  });
  el('lobby-choose-search').addEventListener('input', (e) => {
    query = e.target.value ?? '';
    paintRoster();
  });
  el('lobby-vision')?.addEventListener('click', () => el('vision-modal').showModal());
  // Tu perfil: tocar tu Axie y tu nivel arriba del mapa abre el panel; tocar uno de tus
  // Axies adentro lo abre en su pestaña.
  el('adventure-profile').addEventListener('click', openProfile);
  el('profile-body').addEventListener('click', (e) => {
    const id = e.target?.closest?.('[data-axie]')?.dataset?.axie;
    if (!id) return;
    el('profile-modal').close();
    toChoose();
    show(id);
  });

  // El tutorial: una partida guionada con tooltips. Arranca un game propio y lo
  // monta en la misma mesa. Al terminar vuelve al mapa, que es la casa.
  function startTutorial() {
    markTutorialSeen();
    cleanupTutorial();
    activeTutorial = createTutorial(ui._game, () => {
      cleanupTutorial();
      open('adventure');
    });
    close();
  }

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
      // La sala es otra pantalla y la maneja `net.js`. Se abre en esta misma página,
      // así la música del menú sigue; sin quien la abra, se entra por la URL igual que
      // entra el que llega del celular.
      if (mode === 'net') {
        if (openNet) toNet();
        else location.search = withFree('?red');
        return;
      }
      if (mode === 'tutorial') {
        startTutorial();
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

  // El inventario y la mochila. Colgados de las cajas y no de cada botón, que se
  // redibujan en cada toque.
  el('lobby-inventory').addEventListener('click', toInventory);
  el('lobby-inv-back').addEventListener('click', () => { paintChoose(); view('choose'); });
  el('lobby-evolve-open').addEventListener('click', () => toEvolve(seen));
  el('lobby-evolve-back').addEventListener('click', leaveEvolve);
  el('lobby-bag-back').addEventListener('click', leaveBag);
  el('lobby-inv-extras').addEventListener('click', (e) => {
    const out = e.target.closest?.('[data-bag-out]')?.dataset?.bagOut;
    if (out) {
      saveBag(unequip(bag, out), seen);
      return paintInventory();
    }
    if (e.target.closest?.('[data-bag-pick]')) toBag(seen);
  });
  el('lobby-bag-grid').addEventListener('click', (e) => {
    const sel = e.target.closest?.('[data-bag-sel]')?.dataset?.bagSel;
    if (sel && !bagFor) {
      // Con tres sueltas, un toque abre directo la fusión: ahí mismo están Fusionar,
      // Reciclar y lo que hace su poder (ver `fuse`).
      if (sel !== bagSel && mergeGroups(bag).some((g) => g.key === sel)) {
        bagSel = null;
        bagConfirm = null;
        bagNote = '';
        return fuse(sel);
      }
      // Tocar la que ya está abierta la cierra.
      bagSel = sel === bagSel ? null : sel;
      bagConfirm = null;
      bagNote = '';
      return paintBag();
    }
    const key = e.target.closest?.('[data-bag-add]:not([disabled])')?.dataset?.bagAdd;
    if (!key) {
      // El reciclado de todo lo filtrado, al pie de la colección.
      if (e.target.closest?.('[data-bag-bulk]')) { bagConfirm = 'bulk'; return paintBag(); }
      if (e.target.closest?.('[data-bag-cancel]')) { bagConfirm = null; return paintBag(); }
      if (e.target.closest?.('[data-bag-bulk-yes]')) scrap(bulkCards().map((it) => it.id));
      return;
    }
    const id = bagFor ? looseCards(bag).find((it) => cardKey(it) === key)?.id : null;
    if (!id) return;
    saveBag(equip(bag, id, bagFor), bagFor);
    // Una carta por viaje: se vuelve al inventario, que es donde se ve cómo quedó.
    leaveBag();
  });
  el('lobby-bag-tools').addEventListener('click', (e) => {
    const t = e.target;
    const tier = t.closest?.('[data-bag-tier]')?.dataset?.bagTier;
    if (tier) {
      bagTier = tier;
      bagConfirm = null;
      const open = stacksOf(bag).find((st) => st.key === bagSel);
      if (open && !shownBy(open, tier)) bagSel = null;
      return paintBag();
    }
    const sym = t.closest?.('[data-bag-sym]')?.dataset?.bagSym;
    if (sym || t.closest?.('[data-bag-sym-clear]')) {
      if (!sym) bagSyms.clear();
      else if (bagSyms.has(sym)) bagSyms.delete(sym);
      else bagSyms.add(sym);
      bagConfirm = null;
      const open = stacksOf(bag).find((st) => st.key === bagSel);
      if (open && !visible(open)) bagSel = null;
      return paintBag();
    }
  });
  el('lobby-bag-detail').addEventListener('click', (e) => {
    const t = e.target;
    // La × o un toque afuera de la ficha la cierran.
    if (t === e.currentTarget || t.closest?.('[data-bag-close]')) {
      bagSel = null;
      bagConfirm = null;
      return paintBag();
    }
    if (t.closest?.('[data-bag-fuse]') && bagSel) return fuse(bagSel);
    if (t.closest?.('[data-bag-scrap]')) { bagConfirm = 'one'; return paintBag(); }
    if (t.closest?.('[data-bag-cancel]')) { bagConfirm = null; return paintBag(); }
    const one = t.closest?.('[data-bag-scrap-yes]') && bagSel
      ? looseCards(bag).find((it) => cardKey(it) === bagSel) : null;
    if (one) scrap([one.id]);
  });

  // Las flechas del teclado recorren la colección, en el orden de la grilla. Solo esas
  // dos: Enter y las letras ya las tiene tomadas la mesa
  // (ver el `keydown` de `ui.js`), y con la portada encima seguirían llegando allá.
  // En el mapa de la Aventura hacen lo mismo con los niveles abiertos.
  document.addEventListener('keydown', (e) => {
    if (lobby.hidden) return;
    // Con una escena encima (la fusión, el Taller), las teclas son de ella.
    const scene = el('card-scene');
    if (scene && !scene.hidden && scene.innerHTML) return;
    if (e.key === 'Escape' && lobby.dataset.view === 'adventure' && advMore) return toggleMore(false);
    if (e.key === 'Escape' && !bagView.hidden && bagFor) return leaveBag();
    if (e.key === 'Escape' && !bagView.hidden && bagSel) { bagSel = null; bagConfirm = null; return paintBag(); }
    if (e.key === 'Escape' && lobby.dataset.view === 'evolve') return leaveEvolve();
    const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    if (!step) return;
    if (lobby.dataset.view === 'adventure') return browseLevels(step);
    if (choose.hidden) return;
    // Escribiendo en el buscador las flechas mueven el cursor, no el Axie.
    if (e.target?.tagName === 'INPUT') return;
    browse(step);
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
   * Pone la pantalla de las salas: la portada se guarda y deja de ser la dueña de la
   * salida del menú, que pasa a manejar la sala (ver `paint` en `net.js`).
   */
  function toNet({ instant = false } = {}) {
    inNet = true;
    close({ instant });
    el('menu-btn').hidden = true;
    openNet();
  }

  /** Vuelve de las salas a los duelos, que es de donde se fue. */
  function leaveNet() {
    inNet = false;
    history.replaceState?.(null, '', `${location.pathname}${withFree()}`);
    open('menu');
  }

  /**
   * La vuelta desde la mesa: a la pestaña de donde salió la partida. De un nivel, al
   * mapa; de una partida contra la CPU, a los duelos (el que abandona en el medio ya
   * sabe a qué vino). El tutorial no es una partida que se quiera repetir: se sale al
   * mapa, igual que cuando se termina solo (ver `startTutorial`).
   */
  const backFromTable = () => {
    // Con las salas puestas, la salida de la mesa es de la sala (ver `quit` en `net.js`).
    if (inNet) return;
    const fromMap = activeTutorial || ui?._game?.state?.mode === 'adventure';
    open(fromMap ? 'adventure' : 'menu');
  };

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

  // Botón de configuración de la portada (arriba a la derecha, en todas las pestañas).
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
    // Las misiones de multijugador solo salen si hay salas (ver `missions.js`).
    refreshMissions({ net: Boolean(info) });
    if (info) el('lobby-net').disabled = false;
    // Lo lee un jugador, no quien desarrolla: sin relay, la red simplemente no está.
    else el('lobby-net-note').textContent = tr('No disponible en esta versión');
  });

  open();
  return { open, close, toNet, leaveNet };
}
