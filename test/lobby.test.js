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
  // Las flechas del teclado recorren el roster, y eso cuelga del documento.
  addEventListener(type, fn) { (docHandlers[type] ??= []).push(fn); },
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
const portada = createLobby({ restart: (setup) => started.push(setup) });
const fire = (id, type, event = {}) => nodes[id].handlers[type].forEach((fn) => fn(event));
/** Qué Axie se está mirando en la elección, leído del cartel del bicho grande. */
const mirando = () => AXIE_IDS.find((id) => nodes['lobby-choose-id'].innerHTML.includes(AXIES[id].name));
/** Con cuál estás jugando, leído del botón de la portada. */
const puesto = () => AXIE_IDS.find((id) => nodes['lobby-loadout-now'].innerHTML.includes(AXIES[id].name));

assert.equal(nodes.lobby.hidden, false, 'la portada es lo primero que se ve');
assert.equal(nodes['lobby-front'].hidden, false, 'y arranca en la tapa, con el botón de jugar');
assert.equal(nodes['lobby-menu'].hidden, true, 'con el menú guardado');
assert.equal(nodes['lobby-choose'].hidden, true, 'y la elección también');
assert.equal(nodes['menu-btn'].hidden, false, 'la puerta de vuelta queda puesta');
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

// Las flechas recorren los seis, y dan la vuelta entera: es un aro, no una lista con
// bordes donde uno se queda trabado. Eligiendo el tuyo están los seis: no hay ningún
// asiento de al lado que te saque uno.
fire('lobby-next', 'click');
assert.notEqual(mirando(), yo, 'la flecha no movió nada');
for (let i = 0; i < AXIE_IDS.length - 1; i++) fire('lobby-next', 'click');
assert.equal(mirando(), yo, 'dando la vuelta entera se vuelve al mismo');
fire('lobby-prev', 'click');
docHandlers.keydown.forEach((fn) => fn({ key: 'ArrowRight' }));
assert.equal(mirando(), yo, 'las flechas del teclado recorren igual que los botones');

// Y el botón lo sienta y devuelve a la portada. Elegir tu Axie no arranca ninguna
// partida: es la otra puerta, no un paso de la de jugar.
fire('lobby-next', 'click');
const mio = mirando();
fire('lobby-start', 'click');
assert.deepEqual(started, [], 'elegir tu Axie no tiene que arrancar una partida');
assert.equal(nodes['lobby-front'].hidden, false, 'después de elegir se vuelve a la tapa');
assert.equal(nodes['lobby-choose'].hidden, true);
assert.equal(nodes.lobby.hidden, false, 'y la portada se queda');
assert.equal(puesto(), mio, 'el botón de la portada tiene que decir el que acabás de elegir');

// La flecha de atrás, sin elegir nada, también devuelve a la tapa —y no cambia nada—.
fire('lobby-loadout', 'click');
fire('lobby-next', 'click');
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
fire('lobby-next', 'click');
assert.equal(simbolos(), 19, 'las mejoras no se contagian al Axie de al lado');
fire('lobby-prev', 'click');
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
document.getElementById('difficulty').value = 'duro';
fire('lobby-menu', 'click', { target: { closest: () => ({ dataset: { play: 'cpu' } }) } });
assert.deepEqual(
  started,
  [{ mode: 'cpu', difficulty: 'duro', axie: mio, boosts: mejora }],
  'contra la CPU la partida arranca en el menú, con el Axie que tenés puesto y sus mejoras');
assert.equal(nodes.lobby.hidden, true, 'la portada se tiene que ir');

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
  fire('lobby-next', 'click');
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
fire('lobby-back', 'click');
assert.equal(nodes['lobby-front'].hidden, false, '"Volver" vuelve a la tapa');
fire('lobby-rules', 'click');
assert.equal(nodes['rules-modal'].open, true, 'las reglas se abren desde la portada');

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

  fire('lobby-next', 'click');
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
