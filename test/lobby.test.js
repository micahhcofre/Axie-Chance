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
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

const { AXIE_IDS, AXIES } = await import('../src/axies.js');
const { SYMBOLS } = await import('../src/data.js');

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
// mínimo que `lobby.js` toca— se recorren las cinco pestañas de la barra de abajo: la
// Aventura, que es con la que se abre; tus Axies, que no arrancan nada; la mochila, el
// taller, y los duelos, de donde salen las partidas sueltas sin preguntar con cuál.
const made = [];
const node = (id) => ({
  id, hidden: false, disabled: true, dataset: {}, textContent: '', innerHTML: '',
  value: 'normal', open: false, kids: [], handlers: {},
  style: { z: null, props: {}, setProperty(k, v) { this.props[k] = v; }, set zIndex(v) { this.z = v; } },
  addEventListener(type, fn) { (this.handlers[type] ??= []).push(fn); },
  setAttribute(k, v) { this[k] = String(v); },
  appendChild(kid) { this.kids.push(kid); },
  querySelector() { return null; },
  showModal() { this.open = true; },
  close() { this.open = false; },
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
// El dispositivo de mentira habla español: sin preferencia guardada, la portada sigue
// al dispositivo (ver `deviceLang` en `i18n.js`) y este test mira textos en español.
Object.defineProperty(globalThis, 'navigator', {
  value: { language: 'es-AR', languages: ['es-AR', 'es'] },
  configurable: true, writable: true,
});

const { createLobby } = await import('../src/lobby.js');
const { symbolTally, mixPercents, mixShift, deckMixHtml } = await import('../src/ui.js');
const { deckFor } = await import('../src/axies.js');
const started = [];
// La mesa de mentira: la portada le pide `restart` para arrancar una partida y `_game`
// para el tutorial, que se monta sobre la partida que ya está puesta.
// `enter` es la entrada a un nivel de la Aventura con su transición (ver `ui.js`): acá la
// partida arranca en el acto y el muro "tapa" enseguida, como sin navegador que anime.
const mesa = {
  restart: (setup) => started.push(setup),
  enter: (setup, { onCovered } = {}) => { onCovered?.(); started.push(setup); return true; },
  _game: null,
};
const portada = createLobby(mesa);
const fire = (id, type, event = {}) => nodes[id].handlers[type].forEach((fn) => fn(event));
/** Qué Axie se está mirando en la elección, leído del cartel del bicho grande. */
const mirando = () => AXIE_IDS.find((id) => nodes['lobby-choose-id'].innerHTML.includes(AXIES[id].name));
/** Con cuál estás jugando, leído de lo que la portada deja anotado (ver `loadout.js`). */
const puesto = () => JSON.parse(memoria.get('axie-chance:axie')).axie;
/** Tocar una pestaña de la barra de abajo. */
const pestaña = (tab) => fire('lobby-nav', 'click', { target: { closest: () => ({ dataset: { tab } }) } });
/** Los Axies que muestra la colección, en orden, leídos de la grilla. */
const coleccion = () => [...nodes['lobby-choose-roster'].innerHTML.matchAll(/data-axie="([\w-]+)"/g)].map((m) => m[1]);
/** Tocar un Axie de la colección. */
const tocarAxie = (id) => fire('lobby-choose-roster', 'click',
  { target: { closest: () => ({ dataset: { axie: id } }) } });
/** Una flecha del teclado. */
const flecha = (key) => docHandlers.keydown.forEach((fn) => fn({ key }));

assert.equal(nodes.lobby.hidden, false, 'la portada es lo primero que se ve');
assert.equal(nodes.lobby.dataset.view, 'adventure', 'y se abre en la Aventura');
assert.equal(nodes['lobby-adventure'].dataset.behind, 'false', 'con el mapa a la vista');
assert.match(nodes['adventure-card'].innerHTML, /¡Pelear!/, 'y el primer nivel listo para pelear');
assert.equal(nodes['lobby-nav'].hidden, false, 'con la barra de pestañas abajo');
assert.equal(nodes['lobby-menu'].hidden, true, 'con los duelos guardados');
assert.equal(nodes['lobby-choose'].hidden, true, 'y la elección también');
assert.equal(nodes['menu-btn'].hidden, true, 'en la portada no hay partida que abandonar');
assert.ok(AXIE_IDS.some((id) => AXIES[id].class === nodes.lobby.dataset.arena),
  `el terreno sorteado no es de nadie: ${nodes.lobby.dataset.arena}`);

// Tu Axie viene puesto desde el arranque —sorteado—: si no, el que toca pelear sin
// pasar por la elección jugaría con nadie. La portada lo dice sin abrir su pestaña: el
// ícono de los Axies es él.
assert.ok(AXIE_IDS.includes(puesto()), 'no hay ningún Axie puesto');
assert.equal(nodes.lobby.dataset.arena, AXIES[puesto()].class, 'sobre el terreno de tu Axie');
assert.match(nodes['lobby-nav-axie'].innerHTML, /class="axie/, 'el ícono de los Axies es el tuyo');

// ---- la pestaña de tus Axies ------------------------------------------------
// Abre la elección directo: no es un paso del camino de jugar, es tu bicho.
pestaña('axies');
assert.equal(nodes['lobby-choose'].hidden, false, 'la pestaña de los Axies abre la elección');
assert.equal(nodes['lobby-adventure'].dataset.behind, 'true', 'y el mapa queda de fondo');
assert.equal(nodes['lobby-adventure'].hidden, false, 'sin guardarse: se ve detrás, desenfocado');
assert.equal(nodes['lobby-adventure'].inert, true, 'y no se toca');
assert.equal(nodes['lobby-choose-back'].hidden, true, 'sin "Volver": es una pestaña');
assert.equal(nodes['lobby-choose-title'].textContent, 'Elegí tu Axie');
assert.equal(nodes['lobby-choose-art'].innerHTML.includes('class="axie'), true, 'falta el Axie grande');
// Se abre parada en el que tenés puesto, que es lo que uno espera al abrir su ropero.
assert.equal(mirando(), puesto(), 'la elección tiene que abrirse en el que tenés puesto');

// La vista previa: el bicho grande, su nombre, su clase, su nivel y de qué está hecho
// el mazo en un renglón. La clase se ve recién acá: la colección no la dice.
const yo = mirando();
assert.match(nodes['lobby-choose-id'].innerHTML, /choose-class/, 'falta la clase');
assert.match(nodes['lobby-choose-id'].innerHTML, /class="choose-lvl"[^>]*>LVL <b>1<\/b>/, 'falta el nivel (LVL 1)');
assert.equal(nodes['lobby-choose-deckline'].innerHTML, '8 cartas', 'el renglón del mazo');
assert.doesNotMatch(nodes['lobby-choose-roster'].innerHTML, /roster-crest|data-arena/,
  'los naipes de la colección no dicen la clase');

// La cuenta de símbolos: seis del color propio —cinco pares más la carta sola— y de
// dos para abajo el resto, ordenada de mayor a menor.
const cuenta = symbolTally(deckFor(yo));
assert.equal(cuenta[0].symbol, AXIES[yo].class, 'el color propio va primero');
assert.equal(cuenta[0].n, 6, 'seis cartas llevan el símbolo propio');
assert.deepEqual(cuenta.map((c) => c.n), [...cuenta.map((c) => c.n)].sort((a, b) => b - a),
  'la cuenta va de mayor a menor');
assert.equal(cuenta.reduce((n, c) => n + c.n, 0), 15, 'quince símbolos en ocho cartas');
// La torta del mazo: los porcentajes de la leyenda suman 100 exactos y ninguno se
// aleja más de un punto de su fracción real (6 de 19 es 31,6 → 32, no 31).
for (const id of AXIE_IDS) {
  const t = symbolTally(deckFor(id));
  const pct = mixPercents(t);
  const total = t.reduce((n, x) => n + x.n, 0);
  assert.equal(pct.reduce((a, p) => a + p, 0), 100, `${id}: la torta suma ${pct.reduce((a, p) => a + p, 0)}`);
  t.forEach((x, i) => assert.ok(Math.abs(pct[i] - (x.n * 100) / total) < 1, `${id}: ${x.symbol} redondeado de más`));
}
assert.deepEqual(mixPercents([{ n: 6 }, { n: 3 }, { n: 3 }, { n: 3 }, { n: 2 }, { n: 2 }]), [32, 16, 16, 16, 10, 10]);
// Lo que cambia la torta de una cuenta a otra: la resta de los porcentajes que se ven, y
// un símbolo que no estaba arranca de cero. Sin cambio no se dice nada.
{
  const antes = [{ symbol: 'plant', n: 6 }, { symbol: 'beast', n: 4 }];
  const despues = [{ symbol: 'plant', n: 7 }, { symbol: 'beast', n: 4 }, { symbol: 'bug', n: 1 }];
  // 60/40 → 59/33/8 (7 de 12 es 58,3 y se lleva el punto que sobra).
  assert.deepEqual([...mixShift(antes, despues)], [['plant', -1], ['beast', -7], ['bug', 8]]);
  assert.match(deckMixHtml(despues, { from: antes }), /class="mix-delta" data-sign="up">\+8</);
  assert.match(deckMixHtml(despues, { from: antes }), /class="mix-delta" data-sign="down">−7</);
  assert.doesNotMatch(deckMixHtml(antes, { from: antes }), /mix-delta/, 'sin cambios no hay marcas');
  assert.doesNotMatch(deckMixHtml(antes), /mix-delta/);
}

// La colección los muestra a todos juntos, con el que tenés puesto marcado: los Axies
// van a ser los de cada jugador, y muchos no se recorren de a uno.
assert.deepEqual(coleccion(), AXIE_IDS, 'la colección tiene que mostrar a todos, en orden');
assert.equal((nodes['lobby-choose-roster'].innerHTML.match(/roster-mark--on/g) ?? []).length, 1,
  'uno solo lleva la marca de puesto');
assert.equal(nodes['lobby-start'].textContent, 'Elegido', 'con el tuyo en la ficha no hay nada que elegir');
assert.equal(nodes['lobby-start'].disabled, true, 'y el botón se apaga');
// Con doce —los starters y los del mixer— ya hay buscador (filtros por clase no: la
// clase se descubre al tocar el Axie).
assert.equal(nodes['lobby-choose-search'].hidden, false, 'con doce Axies, el buscador');

// Tocar uno lo pone en la ficha, y el botón pasa a elegirlo.
const otroAxie = AXIE_IDS.find((id) => id !== yo);
tocarAxie(otroAxie);
assert.equal(mirando(), otroAxie, 'tocar un Axie de la colección lo pone en la ficha');
assert.equal(nodes['lobby-start'].textContent, 'Elegir Axie');
assert.equal(nodes['lobby-start'].disabled, false);
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

// Y el botón lo sienta, y ahí se queda: elegir tu Axie no arranca ninguna partida.
flecha('ArrowRight');
const mio = mirando();
fire('lobby-start', 'click');
assert.deepEqual(started, [], 'elegir tu Axie no tiene que arrancar una partida');
assert.equal(nodes['lobby-choose'].hidden, false, 'después de elegir se queda en la pestaña');
assert.equal(nodes.lobby.hidden, false, 'y la portada se queda');
assert.equal(puesto(), mio, 'el que acabás de elegir queda puesto');
assert.equal(nodes['lobby-start'].textContent, 'Elegido', 'y el botón lo dice');
assert.equal(nodes.lobby.dataset.arena, AXIES[mio].class, 'el fondo pasa a ser su terreno');

// Irse a otra pestaña sin elegir no cambia nada.
pestaña('axies');
flecha('ArrowRight');
pestaña('adventure');
assert.equal(nodes['lobby-adventure'].dataset.behind, 'false', 'la pestaña del medio vuelve al mapa');
assert.equal(puesto(), mio, 'irse sin elegir no tiene que cambiar tu Axie');

// ---- el inventario y la mochila ---------------------------------------------
// Adentro del Axie: sus 8 cartas, la rueda de símbolos y cuatro espacios para cartas de
// la mochila. La mochila arranca con el paquete de bienvenida (ver `backpack.js`).
pestaña('axies'); // se abre en el que tenés puesto
fire('lobby-inventory', 'click');
assert.equal(nodes['lobby-inv'].hidden, false, 'el botón de inventario abre el inventario');
assert.equal(nodes['lobby-choose'].hidden, true, 'y la elección se guarda');
const cartas = (id) => (nodes[id].innerHTML.match(/class="card card--deck"/g) ?? []).length;
assert.equal(cartas('lobby-inv-base'), 8, 'las ocho cartas base');
assert.equal((nodes['lobby-inv-tally'].innerHTML.match(/class="mix-mark"/g) ?? []).length,
  symbolTally(deckFor(mio)).length, 'la rueda con cada símbolo del mazo');
assert.doesNotMatch(nodes['lobby-inv-tally'].innerHTML, /mix-legend/, 'sin la leyenda de porcentajes');
assert.equal((nodes['lobby-inv-extras'].innerHTML.match(/data-bag-pick/g) ?? []).length, 4,
  'cuatro espacios vacíos para la mochila');
assert.equal(nodes['lobby-inv-extra-label'].textContent, 'Mochila');

// Un espacio vacío abre la mochila para ese Axie; tocar una carta suelta se la pone.
fire('lobby-inv-extras', 'click', { target: { closest: (sel) => (sel === '[data-bag-pick]' ? {} : null) } });
assert.equal(nodes['lobby-bag'].hidden, false, 'el espacio vacío abre la mochila');
assert.match(nodes['lobby-bag-title'].textContent, new RegExp(AXIES[mio].name), 'la mochila sabe para quién es');
// Una pila por carta distinta; las que no tienen copias sueltas se apagan.
const sueltas = () => [...nodes['lobby-bag-grid'].innerHTML.matchAll(/data-bag-add="([^"]+)" aria-pressed="\w+"(\s+disabled)?/g)]
  .filter((m) => !m[2]).map((m) => m[1]);
const bagTab = (bagTier) => fire('lobby-bag-tools', 'click', { target: { closest: (q) => (q === '[data-bag-tier]' ? { dataset: { bagTier } } : null) } });
assert.equal(sueltas().length, 5, 'el paquete de bienvenida: cinco cartas sin poder');
bagTab('power');
assert.equal(sueltas().length, 1, 'y el Rocket, en la pestaña de los poderes');
bagTab('plain');
const primera = sueltas()[0];
const puesta = () => JSON.parse(memoria.get('axie-chance:backpack')).items.find((it) => it.axie === mio)?.id;
fire('lobby-bag-grid', 'click', { target: { closest: () => ({ dataset: { bagAdd: primera } }) } });
assert.equal(nodes['lobby-inv'].hidden, false, 'después de elegir se vuelve al inventario');
assert.equal(cartas('lobby-inv-extras'), 1, 'con la carta puesta en su espacio');
assert.equal((nodes['lobby-inv-extras'].innerHTML.match(/data-bag-pick/g) ?? []).length, 3, 'le quedan tres espacios');
assert.equal(JSON.parse(memoria.get('axie-chance:axie')).extras.length, 1,
  'la carta de tu Axie queda anotada para la partida');
assert.match(nodes['lobby-choose-roster'].innerHTML, /roster-mark--plus[^>]*>\+1</, 'la colección cuenta sus cartas');

// Cada carta es una sola: puesta en uno, la mochila de otro no la ofrece.
fire('lobby-inv-extras', 'click', { target: { closest: (sel) => (sel === '[data-bag-pick]' ? {} : null) } });
assert.equal(sueltas().length, 4, 'la carta puesta ya no está suelta');
assert.match(nodes['lobby-bag-grid'].innerHTML, new RegExp(`En ${AXIES[mio].name}`), 'y dice quién la tiene');
assert.match(nodes['lobby-bag-grid'].innerHTML, /class="bag-worn"/, 'con el Axie asomado en la esquina');
fire('lobby-bag-back', 'click');
assert.equal(nodes['lobby-inv'].hidden, false, 'volver de la mochila vuelve al inventario');

// La × la devuelve.
fire('lobby-inv-extras', 'click', { target: { closest: (sel) => (sel === '[data-bag-out]' ? { dataset: { bagOut: puesta() } } : null) } });
assert.equal(cartas('lobby-inv-extras'), 0, 'la × devuelve la carta a la mochila');
fire('lobby-inv-extras', 'click', { target: { closest: (sel) => (sel === '[data-bag-pick]' ? {} : null) } });
fire('lobby-bag-grid', 'click', { target: { closest: () => ({ dataset: { bagAdd: primera } }) } });
// La mochila de su pestaña es para mirar: sin "Volver", con todas las cartas, y la
// pestaña cuenta las sueltas.
pestaña('bag');
assert.equal(nodes['lobby-bag'].hidden, false, 'la pestaña de la mochila la abre');
assert.equal(nodes['lobby-bag-back'].hidden, true, 'sin "Volver": es una pestaña');
assert.equal(nodes['lobby-bag-title'].textContent, 'Mochila');
assert.deepEqual(sueltas(), [], 'para mirar: ninguna se toca');
assert.equal(nodes['lobby-bag-count'].textContent, '5', 'la pestaña cuenta las cinco sueltas');
// El taller (ver `workshop.js`): la forja. Sin Moonshards los dos botones están apagados
// y dicen cuánto falta; las chances están siempre a la vista.
pestaña('craft');
assert.equal(nodes['lobby-craft'].hidden, false, 'la pestaña del taller muestra su pantalla');
assert.equal(nodes['lobby-bag'].hidden, true);
assert.equal(nodes['craft-shards'].textContent, '0', 'sin Moonshards todavía');
assert.equal((nodes['forge-acts'].innerHTML.match(/data-craft="\d+"( data-key="gold")? disabled/g) ?? []).length, 3,
  'sin Moonshards ni llaves no se crea nada, ni con la de oro');
assert.equal(nodes['craft-keys'].hidden, true, 'sin llaves, no se ven');
assert.match(nodes['forge-odds-head'].innerHTML, /data-key="gold"/, 'las chances con la llave de oro, al lado');
assert.match(nodes['forge-odds'].innerHTML, /forge-odd-pct--gold">0,25%/, 'mítica 0,25 % con la de oro');
assert.match(nodes['forge-acts'].innerHTML, /Te faltan 10 Moonshards/, 'y dice cuánto falta');
assert.equal((nodes['forge-odds'].innerHTML.match(/class="forge-odd"/g) ?? []).length, 6, 'las seis rarezas');
assert.match(nodes['forge-odds'].innerHTML, /0,01%/, 'con sus chances, la Mítica incluida');
assert.equal(nodes['forge-pity-text'].textContent, 'Carta con poder asegurada en 50');
assert.match(nodes['forge-odds'].innerHTML, /class="gem forge-gem"/, 'cada rareza con su gema');
// Con Moonshards se crean diez: se cobran, van sueltas a la mochila y se dan vuelta.
memoria.set('axie-chance:wallet', JSON.stringify({ moonshards: 250 }));
pestaña('craft');
assert.equal(nodes['craft-shards'].textContent, '250');
const forja = (sel) => fire('lobby-craft', 'click', { target: { closest: (q) => (q === sel ? { dataset: { craft: '10' } } : null) } });
forja('[data-craft]:not([disabled])');
assert.equal(nodes['craft-shards'].textContent, '150', 'diez cartas cuestan 100');
assert.equal(JSON.parse(memoria.get('axie-chance:craft')).crafted, 10, 'y quedan contadas');
// Lo que salió se cuenta en la escena (ver `playCraft` en `card-scene.js`): diez cartas
// de espaldas que saltan del cofre. Sin navegador que dibuje, la escena no se queda.
const escena = nodes['card-scene'].innerHTML;
assert.equal((escena.match(/class="cs-pull"/g) ?? []).length, 10, 'la escena trae las diez');
assert.match(escena, /class="cs-chest"/, 'con el cofre que se sacude y se abre');
assert.match(escena, /10 cartas nuevas en tu mochila/);
assert.equal(nodes['forge-pity-text'].textContent, 'Carta con poder asegurada en 40');
assert.match(nodes['forge-acts'].innerHTML, /data-craft="1" disabled/, 'mientras la escena cuenta no se crea otra tanda');
assert.equal(nodes['lobby-bag-count'].textContent, '15', 'la pestaña de la mochila cuenta las diez nuevas');
await Promise.resolve();
await Promise.resolve();
assert.equal(nodes['card-scene'].hidden, true, 'sin navegador que dibuje, la escena se cierra sola');
assert.doesNotMatch(nodes['forge-acts'].innerHTML, /data-craft="1" disabled/, 'y los botones vuelven');
// Con llaves: la común paga la tanda entera si alcanzan (es lo mismo que crear con
// Moonshards), y la de oro usa una tuya o, sin ninguna, cambia diez comunes o se compra.
{
  const { KEY_TRADE, KEY_COST, tierOf } = await import('../src/crafting.js');
  // Lo creado acá no cuenta para lo que sigue: la mochila y la cuenta vuelven como estaban.
  const antes = { bag: memoria.get('axie-chance:backpack'), craft: memoria.get('axie-chance:craft') };
  const bolsa = () => JSON.parse(memoria.get('axie-chance:wallet'));
  const cuenta = () => JSON.parse(memoria.get('axie-chance:craft'));
  const crear = (craft, key) => fire('lobby-craft', 'click', { target: { closest: (q) => (q === '[data-craft]:not([disabled])' ? { dataset: { craft, key } } : null) } });
  const listo = async () => { await Promise.resolve(); await Promise.resolve(); };
  memoria.set('axie-chance:wallet', JSON.stringify({ moonshards: 150, keys: { basic: 11, gold: 1 } }));
  pestaña('craft');
  assert.equal(nodes['craft-keys'].hidden, false, 'las llaves al lado de los Moonshards');
  assert.match(nodes['forge-acts'].innerHTML, /data-craft="10"[^>]*>\s*<span>Crear ×10<\/span><span class="moon-amt key-amt">/,
    'con once llaves, crear diez las usa');
  assert.match(nodes['forge-acts'].innerHTML, /Legendaria asegurada en 50/, 'la de oro con su asegurada');
  const hechas = cuenta().crafted;
  crear('10');
  assert.deepEqual(bolsa(), { moonshards: 150, keys: { basic: 1, gold: 1 } }, 'diez comunes, sin Moonshards');
  assert.equal(cuenta().crafted, hechas + 10, 'y cuentan para la asegurada como las de Moonshards');
  await listo();
  assert.match(nodes['forge-acts'].innerHTML, /data-craft="10"[^>]*>\s*<span>Crear ×10<\/span><span class="moon-amt">/,
    'con una sola, diez van con Moonshards');
  crear('1', 'gold');
  assert.deepEqual(bolsa(), { moonshards: 150, keys: { basic: 1, gold: 0 } }, 'la de oro usa la tuya');
  await listo();
  crear('1', 'gold');
  assert.deepEqual(bolsa(), { moonshards: 150 - KEY_COST.gold, keys: { basic: 1, gold: 0 } }, 'sin comunes para cambiar, la compra');
  await listo();
  memoria.set('axie-chance:wallet', JSON.stringify({ moonshards: 0, keys: { basic: KEY_TRADE, gold: 0 } }));
  pestaña('craft');
  crear('1', 'gold');
  assert.deepEqual(bolsa(), { moonshards: 0, keys: { basic: 0, gold: 0 } }, 'y con diez comunes, las cambia');
  assert.equal(cuenta().gold, 3, 'las tres cuentan para la legendaria');
  assert.equal(cuenta().crafted, hechas + 10, 'y no para la de Moonshards');
  await listo();
  assert.match(nodes['forge-acts'].innerHTML, /data-key="gold" disabled/, 'sin nada para otra, apagada');
  const rarezas = JSON.parse(memoria.get('axie-chance:backpack')).items.slice(-3).map((c) => tierOf(c)?.id);
  assert.ok(rarezas.every((t) => t && t !== 'common'), 'las tres de oro, ninguna común');
  memoria.set('axie-chance:wallet', JSON.stringify({ moonshards: 150 }));
  memoria.set('axie-chance:backpack', antes.bag);
  memoria.set('axie-chance:craft', antes.craft);
  pestaña('craft');
}
pestaña('bag');
assert.equal(nodes['lobby-bag'].hidden, false, 'la mochila');
assert.match(nodes['lobby-bag-grid'].innerHTML, /class="bag-new"/, 'lo recién creado llega con su destello');
pestaña('bag');
assert.doesNotMatch(nodes['lobby-bag-grid'].innerHTML, /class="bag-new"/, 'y la vez siguiente ya no');
assert.equal(nodes['bag-shards'].textContent, '150', 'la mochila dice lo que queda en la bolsa');
pestaña('adventure');
assert.equal(nodes['adventure-shards'].textContent, '150', 'y el mapa también');
pestaña('axies');
assert.equal(nodes['choose-shards'].textContent, '150', 'y la elección de Axies');
// Lo que deja una partida se ve al volver a la portada.
memoria.set('axie-chance:wallet', JSON.stringify({ moonshards: 170 }));
pestaña('adventure');
assert.equal(nodes['adventure-shards'].textContent, '170', 'se lee de lo guardado al cambiar de pantalla');
memoria.set('axie-chance:wallet', JSON.stringify({ moonshards: 150 }));
assert.equal(JSON.parse(memoria.get('axie-chance:backpack')).items.length, 16, 'con las seis de bienvenida y las diez');
// La mochila para mirar: una pila por carta distinta, el filtro, la ficha y reciclar.
{
  const { tierOf, scrapValue, cardKey, stacksOf } = await import('../src/crafting.js');
  const { readWallet } = await import('../src/evolution.js');
  pestaña('bag');
  const saved = () => JSON.parse(memoria.get('axie-chance:backpack'));
  const stacks = () => stacksOf(saved());
  assert.equal((nodes['lobby-bag-grid'].innerHTML.match(/class="bag-stack"/g) ?? []).length, stacks().filter((st) => !st.card.power).length,
    'una pila por carta distinta: las iguales van juntas');
  assert.match(nodes['lobby-bag-grid'].innerHTML, /<use href="#ic-gem"\/>/, 'cada una con la gema de su rareza');
  assert.doesNotMatch(nodes['lobby-bag-grid'].innerHTML, /bag-pips|bag-fusion/, 'sin barritas en la grilla: la fusión se ve en la ficha');
  assert.equal(nodes['lobby-bag-hint'].hidden, true, 'sin texto de más arriba');
  assert.match(nodes['lobby-bag-tools'].innerHTML, /data-bag-tier="plain"\s+aria-pressed="true"/, 'arranca en la pestaña de las cartas');
  assert.match(nodes['lobby-bag-tools'].innerHTML, /data-bag-tier="power"/, 'y la de los poderes al lado');
  assert.doesNotMatch(nodes['lobby-bag-grid'].innerHTML, /class="card-power/, 'en las cartas, ninguna con poder');
  const grid = (sel, data) => fire('lobby-bag-grid', 'click', { target: { closest: (q) => (q === sel ? { dataset: data } : null) } });
  const tools = (sel, data = {}) => fire('lobby-bag-tools', 'click', { target: { closest: (q) => (q === sel ? { dataset: data } : null) } });
  const detail = (sel) => fire('lobby-bag-detail', 'click', { target: { closest: (q) => (q === sel ? {} : null) } });
  // El filtro de símbolos: los seis, de a uno o varios; se ven las que traen todos los prendidos.
  {
    const tiles = () => (nodes['lobby-bag-grid'].innerHTML.match(/class="bag-stack"/g) ?? []).length;
    const plain = stacks().filter((st) => !st.card.power);
    const sym = (bagSym) => tools('[data-bag-sym]', { bagSym });
    assert.equal((nodes['lobby-bag-tools'].innerHTML.match(/data-bag-sym="/g) ?? []).length, 6, 'los seis símbolos');
    const [a, b] = plain.find((st) => st.card.symbols.length > 1).card.symbols;
    sym(a);
    assert.match(nodes['lobby-bag-tools'].innerHTML, new RegExp(`data-bag-sym="${a}" aria-pressed="true"`), 'el tocado se prende');
    assert.equal(tiles(), plain.filter((st) => st.card.symbols.includes(a)).length, 'uno: las que lo traen');
    sym(b);
    assert.equal(tiles(), plain.filter((st) => st.card.symbols.includes(a) && st.card.symbols.includes(b)).length, 'dos: las que traen los dos');
    sym(a);
    assert.equal(tiles(), plain.filter((st) => st.card.symbols.includes(b)).length, 'tocarlo otra vez lo apaga');
    fire('lobby-bag-tools', 'click', { target: { closest: (q) => (q === '[data-bag-sym-clear]' ? {} : null) } });
    assert.equal(tiles(), plain.length, 'la × las muestra a todas');
    assert.doesNotMatch(nodes['lobby-bag-tools'].innerHTML, /data-bag-sym-clear/, 'y sin filtro no hay ×');
  }
  // Una carta de la que hay una sola copia suelta.
  const single = stacks().find((st) => st.tier && st.loose.length === 1 && !st.worn.length);
  grid('[data-bag-sel]', { bagSel: single.key });
  assert.equal(nodes['lobby-bag-detail'].hidden, false, 'tocar una abre su ficha');
  assert.match(nodes['lobby-bag-detail'].innerHTML, /class="bag-detail-name/, 'con su nombre');
  assert.match(nodes['lobby-bag-detail'].innerHTML, /data-bag-scrap>/, 'y el botón de reciclar');
  assert.match(nodes['lobby-bag-detail'].innerHTML, /class="bag-fusion" data-ready="false" data-have="1"/, 'la fusión dibujada: un naipe de tres');
  assert.match(nodes['lobby-bag-detail'].innerHTML, /data-bag-close/, 'con su × para cerrarla');
  detail('[data-bag-close]');
  assert.equal(nodes['lobby-bag-detail'].hidden, true, 'la × cierra la ficha');
  grid('[data-bag-sel]', { bagSel: single.key });
  assert.doesNotMatch(nodes['lobby-bag-detail'].innerHTML, /data-bag-fuse/, 'con una sola no se fusiona');
  const shardsBefore = readWallet().moonshards;
  detail('[data-bag-scrap]');
  assert.equal(readWallet().moonshards, shardsBefore, 'el primer toque solo pregunta');
  assert.match(nodes['lobby-bag-detail'].innerHTML, /data-bag-scrap-yes/, 'y pide confirmación');
  detail('[data-bag-cancel]');
  assert.match(nodes['lobby-bag-detail'].innerHTML, /data-bag-scrap>/, '"No" vuelve atrás');
  detail('[data-bag-scrap]');
  detail('[data-bag-scrap-yes]');
  assert.equal(readWallet().moonshards, shardsBefore + scrapValue(single.card), 'reciclada: devuelve el 10 % de lo que vale');
  assert.ok(!saved().items.some((it) => cardKey(it) === single.key), 'y sale de la mochila');
  assert.equal(nodes['lobby-bag-detail'].hidden, true, 'era la única: la ficha se cierra');
  assert.match(nodes['lobby-bag-hint'].textContent, /Reciclaste una carta/, 'y lo cuenta arriba');
  assert.equal(nodes['bag-shards'].textContent, String(shardsBefore + scrapValue(single.card)), 'con la bolsa al día');
  // Las sueltas sin poder de una vez: en su pestaña, reciclar y confirmar.
  const plains = () => saved().items.filter((it) => !it.axie && !it.power && scrapValue(it) > 0);
  if (plains().length) {
    const gain = plains().reduce((sum, it) => sum + scrapValue(it), 0);
    const before = readWallet().moonshards;
    tools('[data-bag-tier]', { bagTier: 'plain' });
    grid('[data-bag-bulk]');
    assert.equal(readWallet().moonshards, before, 'pregunta antes');
    grid('[data-bag-bulk-yes]');
    assert.equal(plains().length, 0, 'se fueron todas las sueltas sin poder');
    assert.ok(saved().items.some((it) => it.power), 'las de poder no se tocan');
    assert.equal(readWallet().moonshards, before + gain);
  }
  // Una que tiene puesta un Axie (y ninguna suelta) no se recicla desde la mochila.
  const worn = stacks().find((st) => st.worn.length && !st.loose.length);
  if (worn) {
    tools('[data-bag-tier]', { bagTier: worn.card.power ? 'power' : 'plain' });
    grid('[data-bag-sel]', { bagSel: worn.key });
    assert.doesNotMatch(nodes['lobby-bag-detail'].innerHTML, /data-bag-scrap/, 'la que tiene un Axie no tiene botón');
    assert.match(nodes['lobby-bag-detail'].innerHTML, /class="bag-detail-worn"/, 'y dice quién la tiene');
  }
  // El reciclado rápido de la pestaña de los poderes: sus sueltas de una vez; las puestas se quedan.
  {
    tools('[data-bag-tier]', { bagTier: 'power' });
    const loose = saved().items.filter((it) => !it.axie);
    const wornIds = saved().items.filter((it) => it.axie).map((it) => it.id);
    if (loose.length) {
      assert.match(nodes['lobby-bag-grid'].innerHTML, /class="bag-foot"[^]*Reciclado rápido · \d+/, 'el reciclado rápido, al pie');
      const before = readWallet().moonshards;
      grid('[data-bag-bulk]');
      assert.equal(readWallet().moonshards, before, 'pregunta antes');
      grid('[data-bag-bulk-yes]');
      assert.deepEqual(saved().items.map((it) => it.id), wornIds, 'quedan solo las puestas');
      assert.equal(readWallet().moonshards, before + loose.reduce((sum, it) => sum + scrapValue(it), 0));
      assert.doesNotMatch(nodes['lobby-bag-grid'].innerHTML, /data-bag-bulk/, 'sin sueltas, sin botón');
    }
  }
  memoria.set('axie-chance:wallet', JSON.stringify({ moonshards: 150 }));
}

// La fusión: desde la ficha de una pila con tres sueltas iguales, a la escena (ver
// `playMerge` en `card-scene.js`). Sin navegador que dibuje, la escena fusiona y sigue.
{
  const { cardKey, tierOf } = await import('../src/crafting.js');
  const { CLASS_POWERS, SYMBOL_IDS } = await import('../src/data.js');
  const { rollPlan, spinPlan } = await import('../src/card-scene.js');
  const before = memoria.get('axie-chance:backpack');
  const saved = () => JSON.parse(memoria.get('axie-chance:backpack')).items;
  const worn = saved().filter((it) => it.axie);
  const common = { symbols: ['plant'], power: null };
  const rare = { symbols: ['beast', 'plant', 'plant'], power: null };
  const copies = (card, n, from) => Array.from({ length: n }, (_, i) => ({ id: `m${from + i}`, ...card, axie: null }));
  memoria.set('axie-chance:backpack', JSON.stringify({
    next: 100, items: [...worn, ...copies(common, 4, 1), ...copies(rare, 3, 10), { id: 'm20', ...common, axie: worn[0]?.axie ?? null }],
  }));
  const grid = (sel, data) => fire('lobby-bag-grid', 'click', { target: { closest: (q) => (q === sel ? { dataset: data } : null) } });
  const tools = (sel, data = {}) => fire('lobby-bag-tools', 'click', { target: { closest: (q) => (q === sel ? { dataset: data } : null) } });
  const detail = (sel) => fire('lobby-bag-detail', 'click', { target: { closest: (q) => (q === sel ? {} : null) } });
  pestaña('bag');
  const tile = (key) => nodes['lobby-bag-grid'].innerHTML.split('<button').find((b) => b.includes(`data-bag-sel="${key}"`)) ?? '';
  assert.match(tile(cardKey(common)), /×5/, 'las cinco iguales en una pila, la puesta incluida');
  assert.match(tile(cardKey(common)), /class="bag-ready"/, 'con tres sueltas, la marca de lista');
  assert.match(tile(cardKey(common)), /#ic-up/, 'y su flecha');
  assert.ok(nodes['lobby-bag-grid'].innerHTML.indexOf(`data-bag-sel="${cardKey(rare)}"`) < nodes['lobby-bag-grid'].innerHTML.indexOf(`data-bag-sel="${cardKey(common)}"`),
    'la más fuerte, primero');
  // Con tres sueltas, un toque abre directo la fusión (sin la ficha en el medio).
  grid('[data-bag-sel]', { bagSel: cardKey(common) });
  await Promise.resolve();
  let items = saved();
  assert.equal(items.filter((it) => !it.axie && cardKey(it) === cardKey(common)).length, 1, 'se fueron tres comunes sueltas');
  assert.ok(items.some((it) => it.axie && cardKey(it) === cardKey(common)), 'la puesta no se toca');
  const made = items.find((it) => it.id === 'b100');
  assert.equal(tierOf(made).id, 'uncommon', 'salió una poco común, suelta');
  assert.ok(made.symbols.includes('plant'), 'con su símbolo');
  assert.match(nodes['card-scene'].innerHTML, /class="cs-altar"/, 'la escena abre en el altar');
  assert.match(nodes['card-scene'].innerHTML, /class="cs-ghost"/, 'con la que sale en contorno');
  assert.match(nodes['card-scene'].innerHTML, /data-cs="scrap"/, 'con Reciclar a mano');
  assert.equal(nodes['lobby-bag-detail'].hidden, true, 'al volver, ninguna ficha encima: la colección');
  assert.match(nodes['lobby-bag-grid'].innerHTML, /class="bag-new"/, 'con su destello');
  // La rara: queda uno de sus símbolos con un poder de esa clase.
  grid('[data-bag-sel]', { bagSel: cardKey(rare) });
  await Promise.resolve();
  items = saved();
  const epic = items.find((it) => it.id === 'b101');
  assert.equal(tierOf(epic).id, 'epic');
  assert.ok(CLASS_POWERS[epic.symbols[0]].includes(epic.power), 'con un poder de su clase');
  assert.ok(!items.some((it) => cardKey(it) === cardKey(rare)), 'las tres raras se fueron');
  assert.match(nodes['lobby-bag-tools'].innerHTML, /data-bag-tier="power"\s+aria-pressed="true"/, 'salió con poder: queda a la vista su pestaña');
  assert.doesNotMatch(nodes['lobby-bag-grid'].innerHTML, /class="bag-ready"/, 'ya no queda ninguna lista');
  // Lo que gira en la escena: el símbolo nuevo entre las seis, o el que queda y su poder.
  const plan = rollPlan({ card: common }, made);
  assert.deepEqual(plan.sym.from, SYMBOL_IDS);
  assert.equal(made.symbols[plan.sym.at], plan.sym.to);
  assert.equal(plan.power, null);
  const plan2 = rollPlan({ card: rare }, epic);
  assert.deepEqual(plan2.sym.from, ['beast', 'plant'], 'de rara a épica gira entre sus símbolos');
  assert.deepEqual(plan2.power, { from: CLASS_POWERS[epic.symbols[0]], to: epic.power }, 'y el poder entre los de su clase');
  assert.equal(rollPlan({ card: { symbols: ['bug', 'bug', 'bug'], power: null } }, { symbols: ['bug'], power: 'snail' }).sym, null,
    'tres iguales: el símbolo no gira');
  // La ruleta frena con lo que salió abajo, en la marca, y hace tic una vez por ficha
  // que pasa (al menos las vueltas enteras).
  for (const [n, win] of [[6, 0], [6, 4], [5, 2], [3, 1], [2, 1]]) {
    const { deg, ticks } = spinPlan(n, win);
    assert.equal(((win * 360) / n + deg) % 360, 180, `${n} fichas: la ${win} queda abajo`);
    assert.ok(ticks.length >= 2 * n && ticks.every((ms, i) => i === 0 || ms >= ticks[i - 1]), 'los tics van en orden');
  }
  memoria.set('axie-chance:backpack', before);
}

// La evolución (ver `evolve-view.js`): una puerta de la vista previa, sobre el Axie que
// se está mirando. Sus seis cartas favorables, la rueda del mazo con lo que cambiaría la
// elegida, y el botón, que en el nivel 1 todavía no evoluciona nada y dice desde cuándo.
pestaña('axies');
assert.equal(nodes['lobby-evolve-open'].hidden, false, 'en su pestaña la evolución está');
assert.equal(nodes['lobby-evolve-ready'].hidden, true, 'en el nivel 1 no hay ninguna abierta');
fire('lobby-evolve-open', 'click');
assert.equal(nodes['lobby-evolve'].hidden, false, 'la puerta abre la evolución');
assert.equal(nodes['lobby-choose'].hidden, true);
assert.equal(nodes.lobby.dataset.view, 'evolve');
assert.match(nodes['evolve-id'].innerHTML, new RegExp(AXIES[mirando()].name), 'del Axie de la vista previa');
assert.equal(nodes['evolve-shards'].textContent, '150', 'con los Moonshards de la bolsa');
assert.equal((nodes['evolve-deck'].innerHTML.match(/data-evolve-part=/g) ?? []).length, 6, 'las seis cartas favorables');
assert.match(nodes['evolve-pick'].innerHTML, /id="evolve-go" disabled/, 'en el nivel 1 no se puede evolucionar');
assert.match(nodes['evolve-pick'].innerHTML, /Se abre en el nivel 10/, 'y dice desde cuándo');
assert.match(nodes['evolve-mix-label'].textContent, /^Tu mazo al evolucionar: /, 'la rueda muestra el mazo evolucionado');
assert.match(nodes['evolve-mix'].innerHTML, /class="mix-delta" data-sign="up"/, 'y cuánto sube el símbolo que suma');
assert.match(nodes['evolve-pick'].innerHTML, /en tu mazo: \d+% → \d+%/, 'con el porcentaje antes y después');
fire('lobby-evolve-back', 'click');
assert.equal(nodes['lobby-choose'].hidden, false, 'volver de la evolución vuelve a la vista previa');
pestaña('axies');
fire('lobby-inventory', 'click');
fire('lobby-inv-back', 'click');
assert.equal(nodes['lobby-choose'].hidden, false, 'volver del inventario vuelve a la vista previa');
assert.equal(nodes['lobby-choose-deckline'].innerHTML, '9 cartas · 1 de la mochila');
fire('lobby-start', 'click');
assert.equal(puesto(), mio, 'mirar el inventario no cambia el Axie que tenías puesto');
/** Lo que tiene que llegar a la partida: sin mejoras y con la carta de la mochila. */
const mejora = {};
const deLaMochila = JSON.parse(memoria.get('axie-chance:backpack')).items
  .filter((it) => it.axie === mio).map(({ symbols, power }) => ({ symbols, power }));
assert.equal(deLaMochila.length, 1);

// ---- la primera pelea es el tutorial ---------------------------------------------
// El juego se abre en el mapa, y quien llega de nuevo no sabe qué es una cadena: el
// botón de pelear lo lleva al tutorial, y solo la primera vez. Salir a mitad cuenta
// como visto, y se sale al mapa.
{
  const antes = mesa._game;
  mesa._game = { state: {}, newMatch() {}, refresh() {}, subscribe: () => () => {} };
  assert.equal(memoria.get('axie-chance:tutorial'), undefined);
  pestaña('adventure');
  fire('lobby-adventure', 'click', { target: { closest: (q) => (q === '#lobby-adventure-play' ? {} : null) } });
  assert.equal(nodes.lobby.hidden, true, 'la primera vez, pelear abre el tutorial');
  assert.deepEqual(started, [], 'y no el nivel');
  assert.equal(memoria.get('axie-chance:tutorial'), '1', 'y queda anotado');
  fire('menu-btn', 'click');
  assert.equal(nodes['lobby-adventure'].dataset.behind, 'false', 'salir del tutorial vuelve al mapa');
  mesa._game = antes;
}

// ---- la pestaña de los duelos -------------------------------------------------
// Contra la CPU el banderín es el último botón: tu Axie ya está elegido y el de la
// máquina se sortea, así que no queda nada que preguntar.
pestaña('duel');
assert.equal(nodes['lobby-menu'].hidden, false, 'la pestaña de los duelos abre los banderines');
assert.equal(nodes['lobby-adventure'].dataset.behind, 'true');
fire('lobby-menu', 'click', { target: { closest: () => ({ dataset: { diff: 'duro' } }) } });
assert.equal(nodes.difficulty.dataset.value, 'duro', 'la dificultad se elige tocando su botón');
fire('lobby-menu', 'click', { target: { closest: () => ({ dataset: { play: 'cpu' } }) } });
assert.deepEqual(
  started,
  [{ mode: 'cpu', difficulty: 'duro', axie: mio, boosts: mejora, extras: deLaMochila, evolved: [] }],
  'contra la CPU la partida arranca en el menú, con el Axie que tenés puesto y sus mejoras');
assert.equal(nodes.lobby.hidden, true, 'la portada se tiene que ir');
assert.equal(nodes['menu-btn'].hidden, false, 'con la partida andando se puede abandonar');

// Jugar con otra persona es una sala, y la sala es otra pantalla: el menú no vuelve a
// preguntar nada acá adentro. La única elección que queda en la portada es la tuya, y
// vive del otro lado —en el botón de tu Axie—, así que la vuelta tiene los seis: ya no
// hay un segundo asiento al que restarle el tuyo.
fire('menu-btn', 'click');
pestaña('axies');
assert.equal(nodes['lobby-choose'].hidden, false, 'la pestaña de tu Axie abre la elección');
assert.equal(nodes['lobby-choose-title'].textContent, 'Elegí tu Axie');
const vuelta = new Set();
for (let i = 0; i < AXIE_IDS.length; i++) {
  vuelta.add(mirando());
  flecha('ArrowRight');
}
assert.equal(vuelta.size, AXIE_IDS.length, 'la vuelta tiene los seis, sin restas');
assert.equal(started.length, 1, 'elegir Axie no arranca ninguna partida');

// Desde la mesa se vuelve a la pestaña de la partida: de una contra la CPU, a los
// duelos (el que abandona en el medio ya sabe a qué vino), y de un nivel, al mapa.
portada.close();
fire('menu-btn', 'click');
assert.equal(nodes.lobby.hidden, false);
assert.equal(nodes['lobby-menu'].hidden, false, 'de la CPU vuelve directo a los duelos');
{
  const antes = mesa._game;
  mesa._game = { state: { mode: 'adventure' } };
  portada.close();
  fire('menu-btn', 'click');
  assert.equal(nodes['lobby-adventure'].dataset.behind, 'false', 'de un nivel vuelve al mapa');
  mesa._game = antes;
}
pestaña('duel');
fire('lobby-vision', 'click');
assert.equal(nodes['vision-modal'].open, true, 'la visión del producto se abre desde la portada');

// El tutorial cuelga de los duelos, y de él se sale al mapa y no a los duelos: el que
// lo termina (o lo corta) no viene de una partida que quiera repetir. Es la misma
// puerta de la mesa —el botón de las tres rayitas, que adentro del tutorial dice
// "Salir del tutorial"— y la del final (ver `endActionsHtml` en `ui.js`), así que se
// prueban las dos.
{
  const stub = { state: {}, newMatch() {}, refresh() {}, subscribe: () => () => {} };
  mesa._game = stub;
  const tutorial = () => fire('lobby-menu', 'click', { target: { closest: () => ({ dataset: { play: 'tutorial' } }) } });
  tutorial();
  assert.equal(nodes.lobby.hidden, true, 'el tutorial se juega en la mesa, sin portada encima');
  fire('menu-btn', 'click');
  assert.equal(nodes['lobby-adventure'].dataset.behind, 'false', 'salir del tutorial vuelve al mapa');
  assert.equal(nodes['lobby-menu'].hidden, true, 'y no a los duelos');

  // Y desde la pantalla del final, la misma puerta.
  pestaña('duel');
  tutorial();
  fire('result', 'click', { target: { closest: (sel) => (sel.includes('menu') ? {} : null) } });
  assert.equal(nodes['lobby-adventure'].dataset.behind, 'false', 'el final del tutorial también sale al mapa');
  assert.equal(nodes['lobby-menu'].hidden, true, 'y tampoco a los duelos');
}

// ---- el Modo Aventura ------------------------------------------------------------
// La pantalla entera es el mundo: un solo mapa dibujado en código con un camino que
// cruza las veinte tierras, cada nivel un botón del kit sobre el camino y abajo el panel
// del nivel elegido, con su único botón de pelear. Tocar un nivel abierto lo elige y tocarlo otra
// vez lo juega; los cerrados no se tocan y las flechas del teclado recorren los abiertos.
// La estrella es solo del nivel ganado por K.O.
{
  memoria.set('axie-chance:adventure', JSON.stringify({ v: 2, unlockedLevel: 3, completedLevels: [1, 2], starredLevels: [1] }));
  const mapa = () => nodes['adventure-levels'].innerHTML;
  const ficha = () => nodes['adventure-card'].innerHTML;
  const tocar = (sel, data) => fire('lobby-adventure', 'click',
    { target: { closest: (q) => (q === sel ? { dataset: data } : null) } });
  const tocarNivel = (n) => tocar('[data-adv-level]', { advLevel: String(n) });
  const antes = started.length;

  pestaña('duel');
  pestaña('adventure');
  assert.equal(nodes['lobby-adventure'].dataset.behind, 'false', 'la Aventura se abre desde su pestaña');
  assert.equal(nodes['lobby-menu'].hidden, true, 'y los duelos se guardan');
  assert.equal((mapa().match(/class="adv-map"/g) ?? []).length, 1, 'un solo mapa de punta a punta');
  assert.match(mapa(), /<svg class="adv-art"/, 'dibujado en código');
  assert.equal((mapa().match(/class="adv-zone"/g) ?? []).length, 20, 'veinte tierras');
  for (const land of ['valle', 'costa', 'nieve', 'guarida', 'coliseo']) {
    assert.match(mapa(), new RegExp(`class="adv-zone"[^>]*data-land="${land}"`), `una es ${land}`);
  }
  assert.equal((mapa().match(/class="adv-spot"/g) ?? []).length, 200, 'un nivel por lugar en el camino');
  assert.equal((mapa().match(/<use href="#adv-road"/g) ?? []).length >= 3, true, 'un camino que los une');
  assert.equal((mapa().match(/class="adv-trail-walked"/g) ?? []).length, 1, 'andado, de oro, hasta donde llegaste');
  assert.match(mapa(), /class="adv-fog"/, 'y las tierras que faltan, bajo las nubes');
  assert.match(mapa(), /class="adv-zone"[^>]*data-locked="true"[\s\S]*?class="adv-clouds"/, 'con nubes que se mueven encima');
  assert.equal((mapa().match(/class="adv-drifter"/g) ?? []).length, 57, 'y tres que cruzan el cielo de cada tierra cerrada');
  // Los niveles son los íconos de etapa del kit: normal, élite (evolucionado) y jefe.
  assert.equal((mapa().match(/icon_stage_boss\.png/g) ?? []).length, 20, 'veinte jefes');
  assert.equal((mapa().match(/icon_stage_elite\.png/g) ?? []).length, 153, 'los rivales evolucionados');
  assert.match(mapa(), /data-adv-level="1"[^>]*>[\s\S]*?class="adv-spot-star" data-earned="true"[^>]*Frames\/star\.png/,
    'el ganado por K.O., con la estrella del kit');
  assert.match(mapa(), /data-adv-level="2"[^>]*>[\s\S]*?class="adv-spot-star" data-earned="false"/,
    'el pasado con última chance, con la estrella apagada');
  assert.match(mapa(), /data-adv-level="3"[^>]*data-next="true"[^>]*>[\s\S]*?TargetPointer\/arrow\.png/,
    'el próximo, con la flecha del kit');
  assert.match(mapa(), /class="adv-spot-no">3</, 'con su número a la vista');
  // Los rivales de los niveles abiertos están siempre en su lugar —no aparecen al tocar
  // el nivel— y con sus dibujos alternativos, para respirar y hacer gestos; los de los
  // cerrados todavía no llegaron.
  for (const n of [1, 2, 3]) {
    assert.match(mapa(), new RegExp(`data-adv-level="${n}"[^>]*>\\s*<span class="adv-spot-rival" data-axie="[^"]+"`), `el rival del nivel ${n}, en su lugar`);
  }
  assert.match(mapa(), /class="adv-spot-rival"[^>]*>[\s\S]*?class="axie-alt"/, 'con sus gestos');
  assert.doesNotMatch(mapa(), /data-adv-level="4"[^>]*>\s*<span class="adv-spot-rival"/, 'el del nivel cerrado, todavía no');
  assert.equal((mapa().match(/class="adv-hero"/g) ?? []).length, 1, 'tu Axie espera en un solo lugar');
  assert.match(mapa(), /data-adv-level="3" data-state="open" data-kind="normal"\s+aria-pressed="true"/,
    'se abre parado en el nivel que toca jugar');
  assert.match(mapa(), /data-adv-level="1" data-state="done"/, 'los ganados, superados');
  assert.match(mapa(), /data-adv-level="4" data-state="locked" data-kind="normal"\s+aria-pressed="false" disabled/,
    'y los que faltan, cerrados');
  assert.match(mapa(), /aria-label="Nivel 3 · Renacuajo"/, 'el botón dice qué nivel es y contra quién');
  assert.match(mapa(), /aria-label="Nivel 4"/, 'y el cerrado, solo el número');
  assert.equal((mapa().match(/class="adv-zone"[^>]*data-locked="true"/g) ?? []).length, 19, 'las tierras que faltan, cerradas');
  // Lo que se mueve: una capa por tierra, con los árboles que se mecen (la misma pieza del
  // dibujo) y el barco; la de las tierras cerradas, frenada debajo de las nubes.
  assert.equal((mapa().match(/class="adv-life"/g) ?? []).length, 20, 'una capa viva por tierra');
  assert.equal((mapa().match(/class="adv-life"[^>]*data-locked="true"/g) ?? []).length, 19, 'la de lo cerrado, quieta');
  assert.match(mapa(), /class="adv-sway"[^>]*>\s*<svg[^>]*><use href="#adv-p-valle-/, 'árboles que se mecen');
  assert.equal((mapa().match(/class="adv-ship"/g) ?? []).length, 1, 'y el barco en el agua');
  assert.match(mapa(), /Capítulo 1<\/small>El Valle/, 'cada lugar con su cartel');
  assert.match(mapa(), /Vencé a Shogun para seguir el viaje/, 'y el cerrado dice a quién hay que vencer');
  assert.match(nodes['adventure-progress'].innerHTML, /1\/200/, 'la cuenta de estrellas de la campaña');
  // Arriba, tu perfil en vez del título: tu Axie, tu nivel y la barra de experiencia,
  // que sale de lo ganado en la Aventura (ver `profile.js`).
  assert.match(nodes['adventure-profile-axie'].innerHTML, /class="axie/, 'tu Axie en el aro del perfil');
  assert.equal(nodes['adventure-profile-level'].textContent, '3', 'dos niveles y una estrella: 250 de experiencia, nivel 3');
  assert.equal(nodes['adventure-profile-xp'].textContent, '0/200', 'con la barra vacía: lo que pide el nivel 3');
  // Tocar tu Axie y tu nivel abre tu perfil: el nivel, lo juntado, los capítulos y los
  // tres Axies que más usás; tocar uno de ellos lo abre en su pestaña.
  fire('adventure-profile', 'click');
  assert.equal(nodes['profile-modal'].open, true, 'el perfil se abre');
  let perfil = nodes['profile-body'].innerHTML;
  assert.match(perfil, /class="pf-title">Nivel 3</, 'con tu nivel');
  assert.match(perfil, /<b>2\/200<\/b><span>Niveles superados/, 'los niveles superados');
  assert.match(perfil, /★<\/span> 1\/200/, 'las estrellas');
  assert.equal((perfil.match(/class="pf-chapter"/g) ?? []).length, 20, 'un renglón por capítulo');
  assert.equal((perfil.match(/class="pf-axie"/g) ?? []).length, 1, 'sin partidas jugadas, solo el tuyo');
  assert.match(perfil, /Todavía no terminaste ninguna partida/);
  nodes['profile-modal'].close();
  memoria.set('axie-chance:axies', JSON.stringify({
    olek: { axp: 0, evolved: [], played: 5 }, momo: { axp: 0, evolved: [], played: 2 },
    puffy: { axp: 0, evolved: [], played: 9 }, buba: { axp: 0, evolved: [], played: 1 },
  }));
  fire('adventure-profile', 'click');
  perfil = nodes['profile-body'].innerHTML;
  assert.deepEqual([...perfil.matchAll(/class="pf-axie" data-axie="(\w+)"/g)].map((m) => m[1]), ['puffy', 'olek', 'momo'],
    'los tres que más usás, del más jugado al menos');
  assert.match(perfil, /9 partidas/, 'con sus partidas');
  const otro = ['puffy', 'olek', 'momo'].find((id) => !perfil.includes(`data-axie="${id}" aria-current="true"`));
  fire('profile-body', 'click', { target: { closest: () => ({ dataset: { axie: otro } }) } });
  assert.equal(nodes['profile-modal'].open, false, 'tocar un Axie cierra el perfil');
  assert.equal(nodes['lobby-choose'].hidden, false, 'y lo abre en la pestaña de los Axies');
  assert.equal(mirando(), otro, 'parado en el que tocaste');
  fire('lobby-nav', 'click', { target: { closest: () => ({ dataset: { tab: 'adventure' } }) } });

  // El panel: el número del nivel en grande, contra quién, lo que estrena, la estrella y
  // un solo botón de pelear. Ni el rival ni el ícono del nivel se repiten: están en el mapa.
  assert.match(ficha(), /Una Carta de Más/, 'el panel es el del nivel elegido');
  assert.match(ficha(), /class="adv-no" data-kind="normal"[^>]*>3</, 'con su número en grande');
  assert.doesNotMatch(ficha(), /icon_stage_/, 'sin el ícono del nivel');
  assert.doesNotMatch(ficha(), /class="axie/, 'sin el rival dibujado');
  assert.match(ficha(), /class="adv-meta-rival"[^>]*>[\s\S]*?Renacuajo</, 'contra quién va');
  assert.match(ficha(), /data-diff="facil">[\s\S]*?<i data-on="true"><\/i><i data-on="false"><\/i><i data-on="false"><\/i><\/span>Fácil</,
    'y su dificultad, en marcas');
  assert.match(ficha(), /class="adv-new adv-new--bag"[\s\S]*?class="adv-bag-card"/, 'sin poder nuevo, la mochila del rival en su naipe');
  assert.match(ficha(), /class="adv-star" data-earned="false" data-done="false"/, 'y la estrella que falta ganar');
  assert.equal((ficha().match(/id="lobby-adventure-play"/g) ?? []).length, 1, 'un solo botón de pelear');
  assert.match(ficha(), /¡Pelear!/);
  assert.equal(nodes['adventure-card'].dataset.more, 'false', 'el detalle, cerrado');
  assert.equal((ficha().match(/class="adv-power"/g) ?? []).length, 0, 'no estrena ningún poder');
  assert.match(ficha(), /Los poderes de este nivel/, 'y los poderes con que se pelea');
  assert.equal((ficha().match(/class="adv-pool-power"/g) ?? []).length, 2, 'Charm of Focus y la lente: su combinación fija');
  tocar('[data-adv-more]', {});
  assert.equal(nodes['adventure-card'].dataset.more, 'true', '«Detalles» lo abre');
  docHandlers.keydown.forEach((fn) => fn({ key: 'Escape' }));
  assert.equal(nodes['adventure-card'].dataset.more, 'false', 'y Escape lo cierra');

  tocarNivel(4);
  assert.match(ficha(), /Una Carta de Más/, 'un nivel cerrado no se elige');
  tocarNivel(1);
  assert.match(ficha(), /Primeros Pasos/, 'tocar un nivel abierto lo elige');
  assert.match(mapa(), /data-adv-level="1" data-state="done" data-kind="normal"\s+aria-pressed="true"/, 'tu Axie va allá');
  assert.match(ficha(), /Volver a Jugar/, 'y si ya se ganó, se vuelve a jugar');
  assert.doesNotMatch(ficha(), /También en este nivel/, 'en el primero todo es nuevo');
  flecha('ArrowRight');
  assert.match(ficha(), /Pluma Veloz/, 'la flecha pasa al siguiente');
  flecha('ArrowRight');
  flecha('ArrowRight');
  assert.match(ficha(), /Primeros Pasos/, 'sin pasar a los cerrados: del último abierto vuelve al primero');
  flecha('ArrowLeft');
  assert.match(ficha(), /Una Carta de Más/);
  // Un nivel que no estrena poder: lo nuevo es el rival, con su mochila en el naipe.
  assert.match(ficha(), /class="adv-news-tag">Rival</, 'el naipe es del rival');
  assert.equal((ficha().match(/class="adv-bag-card" data-tier="common"/g) ?? []).length, 2, 'su carta común, en el naipe y en el detalle');
  assert.match(ficha(), /aria-label="1 carta de mochila"/);
  assert.match(ficha(), /La mochila del rival/);

  // El panel de un jefe evolucionado dice lo que trae de más, en su renglón.
  const guardado = memoria.get('axie-chance:adventure');
  memoria.set('axie-chance:adventure', JSON.stringify({ v: 2, unlockedLevel: 50, completedLevels: [] }));
  tocarNivel(40);
  assert.match(ficha(), /Umbra/);
  assert.match(ficha(), /class="adv-meta-boss">[\s\S]*?<\/svg>Jefe · 160 de vida</, 'que es jefe y su vida');
  assert.match(ficha(), /class="adv-no" data-kind="boss"[^>]*>40</, 'con el número de jefe');
  assert.match(ficha(), /1 parte evolucionada/, 'y sus partes evolucionadas');
  assert.match(ficha(), /Evolucionadas: Orejas/, 'cuáles, en el detalle');
  assert.match(ficha(), /Sus amuletos/, 'los amuletos que trae');
  assert.match(ficha(), /class="adv-news-tag">Rival</, 'sin estreno, el naipe es del rival');
  // Un nivel que estrena poder: el poder en el naipe, entero en el detalle.
  tocarNivel(4);
  assert.match(ficha(), /class="adv-new"[\s\S]*Last Gift/, 'con el poder que estrena en su naipe');
  assert.equal((ficha().match(/class="adv-power"/g) ?? []).length, 1, 'el detalle trae el poder entero');
  memoria.set('axie-chance:adventure', guardado);
  tocarNivel(3);
  assert.match(ficha(), /Una Carta de Más/);

  tocar('#lobby-adventure-play', {});
  assert.equal(started.length, antes + 1, 'el botón arranca la partida');
  assert.equal(started.at(-1).mode, 'adventure');
  assert.equal(started.at(-1).adventureLevel, 3, 'en el nivel del panel');
  assert.equal(nodes.lobby.hidden, true, 'y la portada se va');

  // Tocar dos veces el mismo nivel: el primero lo muestra, el segundo pelea.
  portada.open('adventure');
  tocarNivel(2);
  assert.equal(started.length, antes + 1, 'el primer toque solo muestra el nivel');
  assert.match(ficha(), /Pluma Veloz/);
  assert.match(ficha(), /Ganale por K.O. para la estrella/, 'y si se pasó sin K.O., cómo ganar la estrella');
  tocarNivel(2);
  assert.equal(started.length, antes + 2, 'el segundo toque lo juega');
  assert.equal(started.at(-1).adventureLevel, 2);

  // Ganado el nivel, la puerta del final vuelve al mapa parado en el siguiente.
  memoria.set('axie-chance:adventure', JSON.stringify({ v: 2, unlockedLevel: 4, completedLevels: [1, 2, 3] }));
  fire('result', 'click', { target: { closest: (sel) => (sel.includes('adv-map') ? {} : null) } });
  assert.equal(nodes['lobby-adventure'].dataset.behind, 'false', 'el final vuelve al mapa');
  assert.match(mapa(), /data-adv-level="4" data-state="open" data-kind="normal"\s+aria-pressed="true"/,
    'parado en el nivel que se acaba de abrir');
  console.log('  ✓ la Aventura: el camino, sus lugares, niveles cerrados, el panel y la vuelta al siguiente');
}

portada.close();
assert.equal(nodes.lobby.hidden, true);
console.log('✓ la portada ok (cinco pestañas, abre en la Aventura)');

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

  sala.open('choose');
  assert.equal(nodes.lobby.hidden, false, 'el botón de la sala abre la elección');
  assert.equal(nodes['lobby-choose'].hidden, false);
  assert.equal(nodes['lobby-nav'].hidden, true, 'sin la barra: a la sala ya entraste');
  assert.equal(nodes['lobby-choose-back'].hidden, false, 'y con "Volver" a la sala');
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

// ---- las misiones, sobre el mapa ------------------------------------------------------
// El panel (ver `missions-view.js`) se pinta con el mapa: las tres del día y la tira del
// pase. Una cumplida se cobra ahí mismo, y la chapa de la pestaña cuenta lo que queda.
{
  const { dayIndex, weekIndex, seasonIndex, readMissions } = await import('../src/missions.js');
  const today = dayIndex();
  memoria.set('axie-chance:missions', JSON.stringify({
    day: today, daily: [{ id: 'd-win', n: 1 }, { id: 'd-win2', n: 0 }, { id: 'd-win3', n: 0 }],
    week: weekIndex(today), weekly: ['w-play', 'w-win', 'k-win-beast', 'w-advko', 'c-streak'].map((id) => ({ id, n: 0 })),
    pass: { season: seasonIndex(today), points: 0, claimed: [], bonus: 0 },
  }));
  memoria.set('axie-chance:wallet', JSON.stringify({ moonshards: 0 }));
  pestaña('duel');
  pestaña('adventure');
  const board = nodes['adventure-quests-body'].innerHTML;
  assert.equal((board.match(/class="qb-task"/g) ?? []).length, 3, 'el panel muestra las tres del día');
  assert.match(board, /data-claim="daily:0"/, 'la cumplida, con su botón');
  assert.match(board, /data-open-pass/, 'y abajo la tira del pase');
  assert.equal(nodes['lobby-quests-count'].textContent, '1', 'la pestaña del mapa avisa que hay qué cobrar');
  fire('adventure-quests-body', 'click', { target: { closest: () => ({ dataset: { claim: 'daily:0' } }) } });
  assert.equal(JSON.parse(memoria.get('axie-chance:wallet')).moonshards, 5, 'cobrar paga a la bolsa');
  assert.equal(readMissions().daily[0].claimed, true);
  assert.equal(nodes['adventure-shards'].textContent, '5', 'y la bolsa del mapa se repinta');
  assert.equal(nodes['lobby-quests-count'].textContent, '', 'sin nada más que cobrar');
  assert.match(nodes['adventure-quests-body'].innerHTML, /data-state="claimed"/);
  // La tira del pase abre la hoja en su pestaña.
  fire('adventure-quests-body', 'click', { target: { closest: () => ({ dataset: { openPass: '' } }) } });
  assert.equal(nodes['quests-modal'].open, true);
  assert.match(nodes['quests-body'].innerHTML, /data-tab="pass" aria-selected="true"/);
  nodes['quests-modal'].open = false;
  // Plegado, queda el botón; se acuerda.
  fire('adventure-quests-fold', 'click');
  assert.equal(nodes['lobby-adventure'].dataset.quests, 'closed');
  assert.equal(memoria.get('axie-chance:quests-open'), 'false');
  fire('adventure-quests-btn', 'click');
  assert.equal(nodes['lobby-adventure'].dataset.quests, 'open', 'en una pantalla ancha el botón lo vuelve a abrir');
  console.log('  ✓ las misiones sobre el mapa: el panel, cobrar, la hoja del pase y plegarlo');
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
