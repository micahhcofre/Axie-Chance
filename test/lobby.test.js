// La portada.
//
// Casi todo lo que hace es mover bichos por la pantalla, y eso no se prueba sin
// navegador. Lo que sí se puede probar es lo que se rompe en silencio:
//
//   el paseo    que un Axie que sale a caminar llegue a algún lado dentro del terreno.
//   los ids     que los nodos que `lobby.js` busca por id existan en el HTML. Es el
//               mismo motivo por el que `dom.mjs` tiene una sola lista: un id escrito
//               en dos archivos se desincroniza en cuanto alguien renombra uno.
//   el clip     que los seis Axies sepan caminar. `walk` lo hornea `npm run poses`, y
//               si algún día se cae de la lista los bichos se deslizan por el piso con
//               las patas quietas — que es exactamente lo que se ve en un juego roto.
//   el terreno  que las seis clases tengan fondo en la portada, no solo en la mesa.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

const { nextStroll } = await import('../src/lobby.js');
const { AXIE_IDS, AXIES } = await import('../src/axies.js');
const { SYMBOLS } = await import('../src/data.js');
const { MOTIONS, POSES } = await import('../src/axie-poses.js');

/** Un azar de mentira, para que el paseo sea siempre el mismo y se pueda mirar. */
function rng(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

// ---- el paseo ---------------------------------------------------------------
// Mil viajes desde mil lugares distintos: ninguno se sale del terreno, ninguno es un
// pasito de nada, y todos miran hacia donde van.
const rnd = rng(7);
let at = { x: 0.5, lane: 0.5 };
for (let i = 0; i < 1000; i++) {
  const before = at;
  const next = nextStroll(before, rnd);
  assert.ok(next.x >= 0 && next.x <= 1, `se fue del terreno: ${next.x}`);
  assert.ok(next.lane >= 0 && next.lane <= 1, `se fue de la banda: ${next.lane}`);
  assert.ok(Math.abs(next.x - before.x) >= 0.17,
    `un paso que no se ve: ${before.x} → ${next.x}`);
  assert.equal(next.face, next.x > before.x ? 'right' : 'left', 'camina de espaldas');
  // El tiempo sale de la distancia y no de un número fijo: los cuatro caminan a la
  // misma velocidad, que es lo que hace que se lean como el mismo bicho a distintas
  // distancias y no como cuatro cosas moviéndose cada una a su antojo.
  assert.ok(next.ms > 0 && next.ms < 12000, `un viaje eterno: ${next.ms}ms`);
  // La parada tiene que darle tiempo al aburrimiento de `axie-motion.js`, que larga un
  // emote entre los 5 y los 11 segundos: con paradas más cortas los Axies no hacen otra
  // cosa que caminar.
  assert.ok(next.rest >= 2200 && next.rest <= 9000, `una parada rara: ${next.rest}ms`);
  at = next;
}
// La velocidad es una sola: el doble de camino, el doble de tiempo.
const corto = nextStroll({ x: 0.5, lane: 0.5 }, () => 0);
const largo = nextStroll({ x: 0.5, lane: 0.5 }, () => 0.999);
assert.ok(
  Math.abs(largo.ms / corto.ms - Math.abs(largo.x - 0.5) / Math.abs(corto.x - 0.5)) < 0.02,
  'el tiempo no sale de la distancia',
);
console.log('✓ el paseo ok (1000 viajes)');

// ---- los ids ----------------------------------------------------------------
const html = read('index.html');
const source = read('src', 'lobby.js');
const ids = [...source.matchAll(/\bel\('([\w-]+)'\)/g)].map((m) => m[1]);
assert.ok(ids.length >= 8, `${ids.length} ids: ¿se dejó de buscar por id?`);
for (const id of new Set(ids)) {
  assert.match(html, new RegExp(`id="${id}"`), `la portada busca #${id} y no está en el HTML`);
}
// Y las dos opciones del menú, que se leen del `data-play` del botón que se tocó.
for (const play of ['cpu', 'net']) {
  assert.match(html, new RegExp(`data-play="${play}"`), `falta la opción ${play}`);
}
// La tercera se fue con el modo de dos en el mismo teclado, y el menú tiene que
// quedar sin rastros: un botón que no lleva a ningún lado es peor que no tenerlo.
assert.doesNotMatch(html, /data-play="local"/, 'el modo de dos en un teclado ya no existe');
console.log(`✓ los ids ok (${new Set(ids).size} nodos)`);

// ---- caminar ----------------------------------------------------------------
assert.equal(MOTIONS.walk?.loop, true, 'caminar tiene que repetirse mientras dure el viaje');
for (const id of AXIE_IDS) {
  assert.ok(POSES[id]?.walk, `${id} no sabe caminar: falta correr \`npm run poses\``);
  assert.ok(POSES[id].walk.dur > 0, `${id}: el clip de caminar está vacío`);
}
console.log(`✓ caminar ok (${AXIE_IDS.length} Axies)`);

// ---- el terreno -------------------------------------------------------------
const css = read('styles.css');
for (const id of AXIE_IDS) {
  const clase = AXIES[id].class;
  assert.match(css, new RegExp(`\\.lobby\\[data-arena="${clase}"\\]`),
    `sin fondo de portada para ${clase}: el sorteo del terreno lo puede sacar`);
}
console.log(`✓ los terrenos de la portada ok (${AXIE_IDS.length})`);

// ---- la portada andando -----------------------------------------------------
// El resto es cableado, y el cableado se prueba tocándolo. Con un DOM de mentira —el
// mínimo que `lobby.js` toca— se recorren los dos caminos que salen de la portada: el
// de tu Axie, que es una puerta propia y vuelve a la portada, y el de jugar, que ya no
// pregunta con cuál. Es lo único que hay que hacer bien para poder jugar.
const made = [];
const node = (id) => ({
  id, hidden: false, disabled: true, dataset: {}, textContent: '', innerHTML: '',
  value: 'normal', open: false, kids: [], handlers: {},
  style: { z: null, props: {}, setProperty(k, v) { this.props[k] = v; }, set zIndex(v) { this.z = v; } },
  addEventListener(type, fn) { (this.handlers[type] ??= []).push(fn); },
  appendChild(kid) { this.kids.push(kid); },
  querySelector() { return null; },
  showModal() { this.open = true; },
});
const nodes = {};
const docHandlers = {};
globalThis.document = {
  getElementById: (id) => (nodes[id] ??= node(id)),
  createElement: () => { const n = node(''); made.push(n); return n; },
  // La capa del tutorial cuelga del cuerpo y busca por selector lo que va a señalar.
  body: node('body'),
  querySelector: () => null,
  querySelectorAll: () => [],
  // Las flechas del teclado recorren el roster, y eso cuelga del documento.
  addEventListener(type, fn) { (docHandlers[type] ??= []).push(fn); },
  removeEventListener() {},
};
// El navegador que se acuerda con qué jugás. La elección se guarda ahí porque tiene que
// cruzar una recarga: a la sala se entra por `?red`, que es otra dirección (ver
// `loadout.js`).
const memoria = new Map();
globalThis.localStorage = {
  getItem: (k) => memoria.get(k) ?? null,
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
};

const { createLobby, symbolTally } = await import('../src/lobby.js');
const { deckFor } = await import('../src/axies.js');
const started = [];
// La mesa de mentira: la portada le pide `restart` para arrancar una partida y `_game`
// para el tutorial, que se monta sobre la partida que ya está puesta.
const mesa = { restart: (setup) => started.push(setup), _game: null };
const portada = createLobby(mesa);
const fire = (id, type, event = {}) => nodes[id].handlers[type].forEach((fn) => fn(event));
/** Qué Axie se está mirando en la elección, leído del cartel del bicho grande. */
const mirando = () => AXIE_IDS.find((id) => nodes['lobby-choose-id'].innerHTML.includes(AXIES[id].name));
/** Con cuál estás jugando, leído del botón de la portada. */
const puesto = () => AXIE_IDS.find((id) => nodes['lobby-loadout-now'].innerHTML.includes(AXIES[id].name));
/** Los Axies que muestra la colección, en orden, leídos de la grilla. */
const coleccion = () => [...nodes['lobby-choose-roster'].innerHTML.matchAll(/data-axie="([\w-]+)"/g)].map((m) => m[1]);
/** Tocar un Axie de la colección. */
const tocarAxie = (id) => fire('lobby-choose-roster', 'click',
  { target: { closest: () => ({ dataset: { axie: id } }) } });
/** Una flecha del teclado. */
const flecha = (key) => docHandlers.keydown.forEach((fn) => fn({ key }));

assert.equal(nodes.lobby.hidden, false, 'la portada es lo primero que se ve');
assert.equal(nodes['lobby-front'].hidden, false, 'y arranca en la tapa, con el botón de jugar');
assert.equal(nodes['lobby-menu'].hidden, true, 'con el menú guardado');
assert.equal(nodes['lobby-choose'].hidden, true, 'y la elección también');
assert.equal(nodes['menu-btn'].hidden, true, 'en la portada no hay partida que abandonar');
assert.ok(AXIE_IDS.some((id) => AXIES[id].class === nodes.lobby.dataset.arena),
  `el terreno sorteado no es de nadie: ${nodes.lobby.dataset.arena}`);
assert.equal(nodes['lobby-cast'].kids.length, 4, 'cuatro Axies paseándose');
assert.ok(made.every((n) => n.innerHTML.includes('class="axie')), 'y los cuatro dibujados');
// Tu Axie viene puesto desde el arranque —sorteado— y el botón lo dice: si no, el que
// aprieta "Jugar" sin pasar por la elección jugaría con nadie.
assert.ok(puesto(), 'el botón de la portada no dice con qué Axie estás jugando');

// ---- la puerta de tu Axie ---------------------------------------------------
// El botón de la izquierda abre la elección directo, sin pasar por el menú: no es un
// paso del camino de jugar, es tu bicho.
fire('lobby-loadout', 'click');
assert.equal(nodes['lobby-choose'].hidden, false, 'el botón de la izquierda abre la elección');
assert.equal(nodes['lobby-front'].hidden, true, 'y la tapa se guarda');
assert.equal(nodes['lobby-menu'].hidden, true, 'sin pasar por el menú');
assert.equal(nodes['lobby-choose-title'].textContent, 'Elegí tu Axie');
assert.equal(nodes['lobby-choose-art'].innerHTML.includes('class="axie'), true, 'falta el Axie grande');
// Se abre parada en el que tenés puesto, que es lo que uno espera al abrir su ropero.
assert.equal(mirando(), puesto(), 'la elección tiene que abrirse en el que tenés puesto');

// Lo que hay que ver en la pantalla: el bicho grande, su nombre, su clase, las diez
// cartas del mazo inicial y la cuenta de los símbolos.
const yo = mirando();
assert.match(nodes['lobby-choose-id'].innerHTML, /choose-class/, 'falta la clase');
assert.equal((nodes['lobby-choose-deck'].innerHTML.match(/class="card card--deck"/g) ?? []).length,
  10, 'el mazo inicial son diez cartas');

// La cuenta de símbolos: seis del color propio —cinco pares más la carta sola— y de
// tres para abajo el resto, ordenada de mayor a menor.
const cuenta = symbolTally(deckFor(yo));
assert.equal(cuenta[0].symbol, AXIES[yo].class, 'el color propio va primero');
assert.equal(cuenta[0].n, 6, 'seis cartas llevan el símbolo propio');
assert.deepEqual(cuenta.map((c) => c.n), [...cuenta.map((c) => c.n)].sort((a, b) => b - a),
  'la cuenta va de mayor a menor');
assert.equal(cuenta.reduce((n, c) => n + c.n, 0), 19, 'diecinueve símbolos en diez cartas');
assert.equal((nodes['lobby-choose-tally'].innerHTML.match(/class="tally"/g) ?? []).length,
  cuenta.length, 'cada símbolo del mazo tiene su cuenta en pantalla');

// La colección los muestra a todos juntos, con el que tenés puesto marcado: los Axies
// van a ser los de cada jugador, y muchos no se recorren de a uno.
assert.deepEqual(coleccion(), AXIE_IDS, 'la colección tiene que mostrar a todos, en orden');
assert.equal((nodes['lobby-choose-roster'].innerHTML.match(/roster-mark--on/g) ?? []).length, 1,
  'uno solo lleva la marca de puesto');
assert.equal(nodes['lobby-start'].textContent, 'Listo', 'con el tuyo en la ficha no hay nada que elegir');
// Con seis —uno por clase— ni filtros ni buscador: no achicarían nada.
assert.equal(nodes['lobby-choose-filters'].hidden, true, 'con pocos Axies los filtros sobran');
assert.equal(nodes['lobby-choose-search'].hidden, true, 'y el buscador también');

// Tocar uno lo pone en la ficha, y el botón pasa a elegirlo.
const otroAxie = AXIE_IDS.find((id) => id !== yo);
tocarAxie(otroAxie);
assert.equal(mirando(), otroAxie, 'tocar un Axie de la colección lo pone en la ficha');
assert.equal(nodes['lobby-start'].textContent, 'Elegir Axie');
tocarAxie(yo);

// Las flechas del teclado recorren la colección y dan la vuelta entera: al pasar el
// último se vuelve al primero.
flecha('ArrowRight');
assert.notEqual(mirando(), yo, 'la flecha no movió nada');
for (let i = 0; i < AXIE_IDS.length - 1; i++) flecha('ArrowRight');
assert.equal(mirando(), yo, 'dando la vuelta entera se vuelve al mismo');
flecha('ArrowLeft');
flecha('ArrowRight');
assert.equal(mirando(), yo, 'para atrás y para adelante es quedarse en el mismo');
// Escribiendo en el buscador, las flechas son del cursor.
docHandlers.keydown.forEach((fn) => fn({ key: 'ArrowRight', target: { tagName: 'INPUT' } }));
assert.equal(mirando(), yo, 'las flechas del buscador no mueven el Axie');

// El filtro de clase deja solo los de esa clase, y tocarlo de nuevo lo saca.
const claseAjena = AXIES[otroAxie].class;
const porClase = (filter) => fire('lobby-choose-filters', 'click',
  { target: { closest: () => ({ dataset: { filter } }) } });
porClase(claseAjena);
assert.ok(coleccion().length > 0 && coleccion().every((id) => AXIES[id].class === claseAjena),
  'el filtro tiene que dejar solo los de su clase');
assert.match(nodes['lobby-choose-filters'].innerHTML, new RegExp(`data-filter="${claseAjena}" aria-pressed="true"`),
  'y marcarse');
flecha('ArrowRight');
assert.equal(AXIES[mirando()].class, claseAjena, 'las flechas recorren solo lo filtrado');
porClase(claseAjena);
assert.deepEqual(coleccion(), AXIE_IDS, 'tocar el filtro puesto lo saca');

// El buscador encuentra por nombre, sin importar tildes ni mayúsculas.
const buscar = (value) => fire('lobby-choose-search', 'input', { target: { value } });
const conTilde = AXIE_IDS.find((id) => /[áéíóú]/i.test(AXIES[id].name)) ?? AXIE_IDS[0];
buscar(AXIES[conTilde].name.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase());
assert.ok(coleccion().includes(conTilde), 'buscar sin tildes y en mayúsculas lo tiene que encontrar');
buscar('zzzz');
assert.deepEqual(coleccion(), [], 'lo que no coincide no aparece');
assert.match(nodes['lobby-choose-roster'].innerHTML, /choose-empty/, 'y la grilla lo dice');
buscar('');
assert.deepEqual(coleccion(), AXIE_IDS, 'borrar la búsqueda vuelve a mostrar todos');

// Y el botón lo sienta y devuelve a la portada. Elegir tu Axie no arranca ninguna
// partida: es la otra puerta, no un paso de la de jugar.
flecha('ArrowRight');
const mio = mirando();
fire('lobby-start', 'click');
assert.deepEqual(started, [], 'elegir tu Axie no tiene que arrancar una partida');
assert.equal(nodes['lobby-front'].hidden, false, 'después de elegir se vuelve a la tapa');
assert.equal(nodes['lobby-choose'].hidden, true);
assert.equal(nodes.lobby.hidden, false, 'y la portada se queda');
assert.equal(puesto(), mio, 'el botón de la portada tiene que decir el que acabás de elegir');

// La flecha de atrás, sin elegir nada, también devuelve a la tapa —y no cambia nada—.
fire('lobby-loadout', 'click');
flecha('ArrowRight');
fire('lobby-choose-back', 'click');
assert.equal(nodes['lobby-front'].hidden, false, '"Volver" desde tu Axie vuelve a la tapa');
assert.equal(puesto(), mio, 'volver sin elegir no tiene que cambiar tu Axie');

// ---- las mejoras: un símbolo de más en una carta -----------------------------
// El (+) de cada carta. Las seis de tu clase admiten el tuyo y nada más, así que el
// botón lo pone de una; las cuatro no favorables admiten cualquiera de sus dos, así
// que primero preguntan cuál. El símbolo de más no es adorno: la racha cuenta cada
// aparición (ver `timesIn` en `rules.js`).
fire('lobby-loadout', 'click'); // se abre en el que tenés puesto
/** Los botones de mejora que hay ahora en pantalla, leídos del marcado. */
const botones = () => [...nodes['lobby-choose-deck'].innerHTML.matchAll(
  /data-boost="(\w+)" data-key="([^"]+)"(?: data-sym="(\w+)")?/g)]
  .map((m) => ({ boost: m[1], key: m[2], sym: m[3] }));
const tocar = (b) => fire('lobby-choose-deck', 'click',
  { target: { closest: () => ({ dataset: { boost: b.boost, key: b.key, sym: b.sym } }) } });
/** Cuántos símbolos hay dibujados en el mazo: 19 pelado, uno más por mejora. */
const simbolos = () => (nodes['lobby-choose-deck'].innerHTML.match(/class="sym"/g) ?? []).length;

const propias = botones().filter((b) => b.boost === 'add');
const ajenas = botones().filter((b) => b.boost === 'open');
assert.equal(propias.length, 6, 'las seis cartas de tu clase ponen el tuyo de una');
assert.ok(propias.every((b) => b.sym === AXIES[mio].class), 'y ponen el tuyo, no otro');
assert.equal(ajenas.length, 4, 'las cuatro no favorables preguntan cuál de sus dos');
assert.equal(simbolos(), 19, 'el mazo pelado son diecinueve símbolos');

tocar(propias[0]);
assert.equal(simbolos(), 20, 'la carta mejorada tiene que mostrar el símbolo de más');
assert.match(nodes['lobby-choose-tally'].innerHTML,
  new RegExp(`${SYMBOLS[AXIES[mio].class].name}: 7 en el mazo`),
  'la cuenta de símbolos tiene que contar la mejora');
assert.match(nodes['lobby-choose-deck-label'].textContent, /1 mejorada/);

// La no favorable abre sus dos símbolos ahí mismo, debajo de su carta, y ninguno de
// los dos es el tuyo: si lo llevara no sería no favorable.
tocar(ajenas[0]);
const cuales = botones().filter((b) => b.boost === 'add' && b.key === ajenas[0].key);
assert.equal(cuales.length, 2, 'la no favorable tiene que ofrecer sus dos símbolos');
assert.equal(new Set(cuales.map((b) => b.sym)).size, 2, 'y que sean dos distintos');
assert.ok(!cuales.some((b) => b.sym === AXIES[mio].class), 'el tuyo no está en esa carta');
assert.ok(ajenas[0].key.split('+').includes(cuales[1].sym), 'solo símbolos de la carta');
tocar(cuales[1]);
assert.equal(simbolos(), 21, 'la segunda mejora también se ve');

// Y se deshacen donde se hicieron.
const puestas = botones().filter((b) => b.boost === 'clear');
assert.equal(puestas.length, 2, 'las dos mejoradas se tienen que poder deshacer');
tocar(puestas.find((b) => b.key === ajenas[0].key));
assert.equal(simbolos(), 20, 'sacar la mejora devuelve la carta como estaba');

// Las mejoras son del bicho y no de la pantalla: el de al lado tiene su mazo pelado, y
// al volver las tuyas siguen puestas.
flecha('ArrowRight');
assert.equal(simbolos(), 19, 'las mejoras no se contagian al Axie de al lado');
flecha('ArrowLeft');
assert.equal(simbolos(), 20, 'y al volver siguen puestas');
fire('lobby-start', 'click');
assert.equal(puesto(), mio, 'salir de las mejoras no cambia el Axie que tenías puesto');
/** La mejora que quedó puesta, que es la que tiene que llegar a la partida. */
const mejora = { [propias[0].key]: AXIES[mio].class };

// ---- la puerta de jugar -----------------------------------------------------
// Contra la CPU el menú es el último botón: tu Axie ya está elegido y el de la máquina
// se sortea, así que no queda nada que preguntar.
fire('lobby-play', 'click');
assert.equal(nodes['lobby-menu'].hidden, false, 'el botón grande abre el menú');
assert.equal(nodes['lobby-front'].hidden, true);
fire('lobby-menu', 'click', { target: { closest: () => ({ dataset: { diff: 'duro' } }) } });
assert.equal(nodes.difficulty.dataset.value, 'duro', 'la dificultad se elige tocando su botón');
fire('lobby-menu', 'click', { target: { closest: () => ({ dataset: { play: 'cpu' } }) } });
assert.deepEqual(
  started,
  [{ mode: 'cpu', difficulty: 'duro', axie: mio, boosts: mejora }],
  'contra la CPU la partida arranca en el menú, con el Axie que tenés puesto y sus mejoras');
assert.equal(nodes.lobby.hidden, true, 'la portada se tiene que ir');
assert.equal(nodes['menu-btn'].hidden, false, 'con la partida andando se puede abandonar');

// Jugar con otra persona es una sala, y la sala es otra pantalla: el menú no vuelve a
// preguntar nada acá adentro. La única elección que queda en la portada es la tuya, y
// vive del otro lado —en el botón de tu Axie—, así que la vuelta tiene los seis: ya no
// hay un segundo asiento al que restarle el tuyo.
fire('menu-btn', 'click');
fire('lobby-loadout', 'click');
assert.equal(nodes['lobby-choose'].hidden, false, 'el botón de tu Axie abre la elección');
assert.equal(nodes['lobby-choose-title'].textContent, 'Elegí tu Axie');
const vuelta = new Set();
for (let i = 0; i < AXIE_IDS.length; i++) {
  vuelta.add(mirando());
  flecha('ArrowRight');
}
assert.equal(vuelta.size, AXIE_IDS.length, 'la vuelta tiene los seis, sin restas');
assert.equal(started.length, 1, 'elegir Axie no arranca ninguna partida');

// Y la flecha de atrás sale a la tapa, venga de donde venga: la elección es una puerta
// propia y no un escalón del camino de jugar.
fire('lobby-choose-back', 'click');
assert.equal(nodes['lobby-front'].hidden, false, '"Volver" de la elección sale a la tapa');

// Desde la mesa se vuelve al menú, no a la tapa: el que abandona en el medio de una
// partida ya sabe a qué vino.
fire('menu-btn', 'click');
assert.equal(nodes.lobby.hidden, false);
assert.equal(nodes['lobby-menu'].hidden, false, 'vuelve directo al menú');
fire('lobby-menu-close', 'click');
assert.equal(nodes['lobby-front'].hidden, false, '"Volver" vuelve a la tapa');

// Tocar afuera de la tabla también lo guarda; tocar adentro, no.
fire('lobby-play', 'click');
fire('lobby', 'click', { target: { closest: (sel) => (sel.includes('#lobby-play') ? {} : null) } });
assert.equal(nodes['lobby-menu'].hidden, false, 'el toque que abre el menú no lo cierra');
fire('lobby', 'click', { target: { closest: (sel) => (sel.includes('#lobby-menu') ? {} : null) } });
assert.equal(nodes['lobby-menu'].hidden, false, 'tocar adentro del menú no lo cierra');
fire('lobby', 'click', { target: { closest: () => null } });
assert.equal(nodes['lobby-menu'].hidden, true, 'tocar afuera del menú lo cierra');
assert.equal(nodes['lobby-front'].hidden, false, 'y vuelve a la tapa');
fire('lobby-vision', 'click');
assert.equal(nodes['vision-modal'].open, true, 'la visión del producto se abre desde la portada');

// Del tutorial se sale a la tapa y no al menú de modos: el que lo termina (o lo corta)
// no viene de una partida que quiera repetir. Es la misma puerta de la mesa —el botón
// de las tres rayitas, que adentro del tutorial dice "Salir del tutorial"— y la del
// final (ver `endActionsHtml` en `ui.js`), así que se prueban las dos.
{
  const stub = { state: {}, newMatch() {}, refresh() {}, subscribe: () => () => {} };
  mesa._game = stub;
  fire('lobby-tutorial', 'click');
  assert.equal(nodes.lobby.hidden, true, 'el tutorial se juega en la mesa, sin portada encima');
  fire('menu-btn', 'click');
  assert.equal(nodes['lobby-front'].hidden, false, 'salir del tutorial vuelve a la tapa');
  assert.equal(nodes['lobby-menu'].hidden, true, 'y no al menú de modos');

  // Y desde la pantalla del final, la misma puerta.
  fire('lobby-tutorial', 'click');
  fire('result', 'click', { target: { closest: (sel) => (sel.includes('menu') ? {} : null) } });
  assert.equal(nodes['lobby-front'].hidden, false, 'el final del tutorial también sale a la tapa');
  assert.equal(nodes['lobby-menu'].hidden, true, 'y tampoco al menú de modos');
}

// ---- el Modo Aventura ------------------------------------------------------------
// La misma pantalla que la elección de Axie: el mapa de naipes a la izquierda —uno por
// nivel, con el rival adentro— y la ficha del tocado a la derecha. Se abre parado en
// el nivel que toca jugar, los cerrados no se tocan y las flechas recorren los abiertos.
{
  memoria.set('axie-chance:adventure', JSON.stringify({ unlockedLevel: 3, completedLevels: [1, 2] }));
  const mapa = () => nodes['adventure-levels'].innerHTML;
  const ficha = () => nodes['adventure-card'].innerHTML;
  const tocarNivel = (n) => fire('lobby-adventure', 'click',
    { target: { closest: (sel) => (sel === '[data-adv-level]' ? { dataset: { advLevel: String(n) } } : null) } });
  const antes = started.length;

  fire('lobby-play', 'click');
  fire('lobby-menu', 'click', { target: { closest: () => ({ dataset: { play: 'adventure' } }) } });
  assert.equal(nodes['lobby-adventure'].hidden, false, 'la Aventura se abre desde el menú');
  assert.equal(nodes['lobby-menu'].hidden, true, 'y el menú se guarda');
  assert.equal((mapa().match(/class="roster-tile adv-tile"/g) ?? []).length, 6, 'un naipe por nivel');
  assert.match(mapa(), /data-adv-level="3" data-state="open"\s+aria-pressed="true"/,
    'se abre parado en el nivel que toca jugar');
  assert.match(mapa(), /data-adv-level="1" data-state="done"/, 'los ganados, superados');
  assert.match(mapa(), /data-adv-level="4" data-state="locked"\s+aria-pressed="false" disabled/,
    'y los que faltan, cerrados');
  assert.equal((mapa().match(/class="roster-name">\?\?\?</g) ?? []).length, 3,
    'de los cerrados no se dice contra quién');
  assert.match(nodes['adventure-progress'].innerHTML, /2\/6/, 'la cuenta de la campaña');
  assert.match(ficha(), /El Arte del Mercado/, 'la ficha es la del nivel elegido');
  assert.match(ficha(), /adv-rival-stage[\s\S]*class="axie/, 'con el rival dibujado');
  assert.match(ficha(), /data-diff="normal">Normal</, 'y su dificultad');
  assert.equal((ficha().match(/class="adv-power"/g) ?? []).length, 2, 'con los dos poderes que estrena');

  tocarNivel(4);
  assert.match(ficha(), /El Arte del Mercado/, 'un nivel cerrado no se abre');
  tocarNivel(1);
  assert.match(ficha(), /Primeros Pasos/, 'tocar un nivel abierto lo pone en la ficha');
  assert.match(ficha(), /Volver a Jugar/, 'y si ya se ganó, se vuelve a jugar');
  flecha('ArrowRight');
  assert.match(ficha(), /Defensa y Estrategia/, 'la flecha pasa al siguiente');
  flecha('ArrowRight');
  flecha('ArrowRight');
  assert.match(ficha(), /Primeros Pasos/, 'sin pasar a los cerrados: del último abierto vuelve al primero');
  flecha('ArrowLeft');
  assert.match(ficha(), /El Arte del Mercado/);

  fire('lobby-adventure', 'click',
    { target: { closest: (sel) => (sel === '#lobby-adventure-play' ? {} : null) } });
  assert.equal(started.length, antes + 1, 'el botón arranca la partida');
  assert.equal(started.at(-1).mode, 'adventure');
  assert.equal(started.at(-1).adventureLevel, 3, 'en el nivel de la ficha');
  assert.equal(nodes.lobby.hidden, true, 'y la portada se va');

  // Ganado el nivel, la puerta del final vuelve al mapa parado en el siguiente.
  memoria.set('axie-chance:adventure', JSON.stringify({ unlockedLevel: 4, completedLevels: [1, 2, 3] }));
  fire('result', 'click', { target: { closest: (sel) => (sel.includes('adv-map') ? {} : null) } });
  assert.equal(nodes['lobby-adventure'].hidden, false, 'el final vuelve al mapa');
  assert.match(mapa(), /data-adv-level="4" data-state="open"\s+aria-pressed="true"/,
    'parado en el nivel que se acaba de abrir');
  fire('lobby-adventure-back', 'click');
  assert.equal(nodes['lobby-menu'].hidden, false, '"Volver" sale al menú de modos');
  console.log('  ✓ la Aventura: mapa de naipes, niveles cerrados, flechas y la vuelta al siguiente');
}

portada.close();
assert.equal(nodes.lobby.hidden, true);
console.log('✓ la portada ok (tu Axie por un lado, jugar por el otro)');

// ---- lo elegido se queda -----------------------------------------------------
// El Axie y sus mejoras quedan anotados en el navegador. No es una comodidad: es lo
// único que cruza a la pantalla de las salas, que vive en otra dirección —`?red`— y
// por lo tanto del otro lado de una recarga. Sin esto, la sala no tenía de dónde
// sacarlo y lo volvía a preguntar con un roster arriba de la mesa.
{
  const anotado = JSON.parse(localStorage.getItem('axie-chance:axie'));
  assert.equal(anotado.axie, mio, 'se anota con qué Axie estás jugando');
  assert.deepEqual(anotado.boosts, mejora, 'y con qué mejoras: lo que elegís es el mazo');

  // Y al abrir de nuevo el juego, ahí sigue: no se vuelve a sortear.
  for (const key of Object.keys(nodes)) delete nodes[key];
  docHandlers.keydown = [];
  const otraVez = createLobby({ restart: () => {} });
  assert.equal(puesto(), mio, 'al volver, tu Axie sigue puesto');
  otraVez.close(); // los bichos dejan de pasearse: si no, el test no termina nunca
  console.log('  ✓ tu Axie se queda anotado entre visitas');
}

// ---- la elección, encima de una sala -----------------------------------------
// En `?red` no hay portada: se entra por un link y lo que se ve es la sala. Pero la
// pregunta "¿con cuál jugás?" se contesta en un solo lugar del juego, así que de la
// portada se usa esa pantalla y nada más — abierta encima de la sala, sin tapa, sin
// menú y sin las puertas de vuelta, que no llevarían a ningún lado.
{
  for (const key of Object.keys(nodes)) delete nodes[key];
  docHandlers.keydown = [];
  let avisos = 0;
  const sala = createLobby(null, { net: true, onPick: () => { avisos++; } });

  assert.equal(nodes.lobby.hidden, true, 'en una sala la portada arranca guardada');
  assert.equal(nodes['menu-btn'], undefined,
    'ni se toca el botón de abandonar: no hay portada a la que volver');
  assert.equal(nodes['lobby-cast'].kids.length, 0, 'ni bichos paseándose detrás del panel');

  sala.open('choose');
  assert.equal(nodes.lobby.hidden, false, 'el botón de la sala abre la elección');
  assert.equal(nodes['lobby-choose'].hidden, false);
  assert.equal(nodes['lobby-front'].hidden, true, 'sin la tapa: a la sala ya entraste');
  assert.equal(mirando(), mio, 'y parada en el que tenés puesto');

  flecha('ArrowRight');
  const otro = mirando();
  fire('lobby-start', 'click');
  assert.equal(avisos, 1, 'elegir se le avisa a la sala, que es la que va a repartir');
  assert.equal(JSON.parse(localStorage.getItem('axie-chance:axie')).axie, otro,
    'y queda anotado igual que en la portada');
  assert.equal(nodes.lobby.hidden, true, 'elegir cierra: atrás está la sala');

  // Y la flecha de atrás también sale a la sala, que es de donde se vino.
  sala.open('choose');
  fire('lobby-choose-back', 'click');
  assert.equal(nodes.lobby.hidden, true, '"Volver" sale a la sala');
  console.log('  ✓ en una sala se abre la misma elección, encima');
}

// ---- las salas, en la misma página ---------------------------------------------
// Pasar del menú a las salas no recarga: la música del menú seguiría cortándose y, sin
// un toque nuevo del jugador, el navegador no la dejaría volver. La portada se guarda,
// la sala la abre `openNet`, y "Volver" trae de nuevo el menú de modos.
{
  const urls = [];
  globalThis.location ??= { search: '', pathname: '/' };
  globalThis.history ??= {};
  const replace = globalThis.history.replaceState;
  globalThis.history.replaceState = (_s, _t, url) => urls.push(url);
  const temas = [];
  let salas = 0;
  const mesaRed = { restart() {}, abortMatch() {}, audio: { music: (t) => temas.push(t) }, _game: null };
  const conSalas = createLobby(mesaRed, { openNet: () => { salas++; } });
  conSalas.open('menu');

  conSalas.toNet();
  assert.equal(salas, 1, 'el menú abre las salas en la misma página');
  assert.equal(nodes.lobby.hidden, true, 'y la portada se guarda');
  assert.equal(nodes['menu-btn'].hidden, true, 'la salida de la mesa pasa a ser de la sala');

  // Tu Axie se cambia encima de la sala, y elegir vuelve a ella.
  conSalas.open('choose');
  assert.equal(nodes.lobby.hidden, false, 'la elección se abre encima de la sala');
  assert.equal(nodes['lobby-choose'].hidden, false);
  fire('lobby-start', 'click');
  assert.equal(nodes.lobby.hidden, true, 'elegir vuelve a la sala');
  assert.equal(nodes['menu-btn'].hidden, true, 'sin prender la salida de la mesa');

  conSalas.leaveNet();
  assert.equal(nodes.lobby.hidden, false, '"Volver" de las salas trae la portada');
  assert.equal(nodes['lobby-menu'].hidden, false, 'en el menú de modos, que es de donde se fue');
  assert.equal(urls.at(-1), '/', 'y la dirección vuelve a ser la de la portada');
  assert.ok(temas.length && temas.every((t) => t === 'menu'), 'y todo el recorrido pide la música del menú');
  conSalas.close();
  globalThis.history.replaceState = replace;
  console.log('  ✓ las salas se abren en la misma página y "Volver" trae el menú');
}

// ---- la visión del producto se lee en los dos idiomas -------------------------
// El pitch es el panel más largo del juego y el único escrito para alguien de afuera,
// que lo más probable es que lo lea en inglés. Es todo HTML estático, así que no pasa
// por `tr()`: lo traduce `translateDom()` nodo por nodo contra `EN_STRINGS`. Una frase
// que se edita en el HTML y no en el diccionario no rompe nada — se queda en español
// en medio del inglés, que es peor, porque nadie lo ve desde acá.
{
  const { EN_STRINGS } = await import('../src/i18n-en.js');
  const html = read('index.html');
  const modal = html.match(
    /<dialog class="modal modal--vision o-panel" id="vision-modal">([\s\S]*?)\n<\/dialog>/,
  );
  assert.ok(modal, 'el modal de la visión del producto no está en el HTML');

  const faltan = [];
  for (const trozo of modal[1].split(/<[^>]+>/)) {
    const texto = trozo.replace(/&amp;/g, '&').trim().replace(/\s+/g, ' ');
    if (texto && EN_STRINGS[texto] === undefined && !faltan.includes(texto)) faltan.push(texto);
  }
  assert.deepEqual(faltan, [], 'la visión del producto tiene texto sin traducir en EN_STRINGS');
  console.log('  ✓ la visión del producto entera tiene traducción al inglés');
}
