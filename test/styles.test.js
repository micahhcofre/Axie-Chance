// Una sola cosa, pero es la que rompió la partida en red.
//
// `el.hidden = true` no oculta nada si una regla nuestra le pone `display`: las hojas
// del autor le ganan siempre al `[hidden] { display: none }` del navegador. El panel de
// la sala tenía `display: flex`, así que nunca se iba — la partida arrancaba detrás de
// un cartel que decía "Empezando…", y desde afuera parecía que no arrancaba.
//
// No se puede probar con un DOM de mentira, porque ahí `hidden` es una propiedad y no
// hay CSS que la pise. Lo que sí se puede es exigir la regla que lo arregla de una vez
// para todo, y eso es lo que mira este test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');
const css = read('styles.css');

// ---- los nodos que la mesa busca por id --------------------------------------
// `ui.js` los pide con `$('loquesea')` y el DOM de mentira los lista uno por uno, así
// que un id que se renombra en el HTML no lo canta nadie: los tests siguen andando
// contra nodos falsos que en la página de verdad no existen. Acá se cruzan las dos
// listas, que es lo único que ata el HTML al código.
const html = read('index.html');
const { IDS } = await import('./dom.mjs');
for (const id of IDS) {
  assert.match(html, new RegExp(`id="${id}"`), `la mesa busca #${id} y no está en el HTML`);
}

assert.match(
  css,
  /\[hidden\]\s*\{\s*display:\s*none\s*!important\s*;?\s*\}/,
  'falta la regla global `[hidden] { display: none !important }`: sin ella, cualquier ' +
  'panel con `display` propio se queda puesto aunque el código lo esconda',
);

// Y que nadie la deje sin efecto poniéndole `display` a algo *más* específico que
// además se oculte desde el código. La regla global lleva `!important`, así que solo
// otro `!important` podría ganarle.
const shouty = [...css.matchAll(/display:\s*[^;]*!important/g)]
  .map((m) => m[0])
  .filter((d) => !d.includes('none'));
assert.deepEqual(shouty, [], `un display !important le puede ganar a [hidden]: ${shouty}`);

// Lo otro que solo vive en el CSS: las texturas de interfaz del Origins. El juego pide
// once dibujos al asset kit —el canal de la barra de vida, el aro del piso, las cuatro
// cintas talladas, el cartel de madera, y la tabla, el cartel, el aro y la cruz con los
// que está hecha la pantalla de las salas— y los pide por CDN, igual que los atlas de
// los golpes. Con las cintas, además, están hechos todos los botones.
//
// Dos cosas que se pueden romper sin que nadie se entere hasta abrir la pantalla:
// que alguien cuelgue el juego de un servidor cualquiera, y que un dibujo del kit sea
// lo único que dibuje algo — el día que el CDN no conteste, esa parte de la pantalla
// desaparece en vez de verse peor.
const KIT = 'https://cdn.jsdelivr.net/gh/axieinfinity/axie-origins-asset-kit@main/';

const remotas = [...css.matchAll(/url\(\s*"(https?:[^"]+)"\s*\)/g)].map((m) => m[1]);
assert.ok(remotas.length >= 11, `el CSS pide ${remotas.length} dibujos remotos: esperaba las texturas del kit`);

const ajenas = [...new Set(remotas.filter((u) => !u.startsWith(KIT)))];
assert.deepEqual(ajenas, [], `el CSS le pide dibujos a un servidor que no es el asset kit: ${ajenas}`);

/** El cuerpo de una regla, para leerle las declaraciones. */
function regla(sel) {
  const i = css.indexOf(`\n${sel} {`);
  assert.notEqual(i, -1, `falta la regla \`${sel}\``);
  return css.slice(i, css.indexOf('}', i));
}

// Las que pintan una superficie entera con un dibujo del kit llevan su color debajo.
// (El aro del piso no está acá a propósito: ahí el dibujo es la máscara, y sin máscara
// el aro no se ve — que es exactamente lo que tiene que pasar.)
//
// Los botones son casi toda esta lista: sin el color de abajo, un CDN caído deja la
// pantalla sin nada que apretar. Los que solo cambian el dibujo —el verde, el rojo, el
// de tu Axie— heredan la forma de su base y declaran su propio `background-color`.
for (const sel of ['.hpbar', '.btn', '.lobby-play', '.lobby-pick',
  '.netbox-panel', '.netbox-banner', '.netbox-x', '.netbox-room', '.netbox-seats li',
  '.room-go']) {
  assert.match(
    regla(sel),
    /background:\s*(#[0-9a-fA-F]{3,8}|rgba?\()/,
    `\`${sel}\` pide un dibujo al CDN sin un color de fondo debajo: el día que el CDN ` +
    'no conteste se queda en nada en vez de verse peor',
  );
}
for (const sel of ['.btn-primary', '.btn-danger', '.lobby-play--alt']) {
  const cuerpo = regla(sel);
  assert.match(cuerpo, /background-image:\s*url\(/, `\`${sel}\` dejó de pedir su dibujo del kit`);
  assert.match(
    cuerpo,
    /background-color:\s*(#[0-9a-fA-F]{3,8}|rgba?\()/,
    `\`${sel}\` cambia el dibujo pero no el color de abajo: sin CDN se vería del color ` +
    'del botón que no es',
  );
}

// ---- el orden de las capas ---------------------------------------------------
// El centro —el panel del reparto— tiene por encima de la barra: mientras se elige del
// centro no hay ninguna otra cosa que hacer.
const capa = (sel) => {
  const m = regla(sel).match(/z-index:\s*(\d+)/);
  assert.ok(m, `\`${sel}\` dejó de declarar su capa`);
  return Number(m[1]);
};
assert.ok(capa('.overlay') > capa('.topbar'),
  'el centro tiene que tapar la barra: mientras se elige no hay nada más que hacer');

// ---- nada de scroll ----------------------------------------------------------
// Esto es un juego, no una página: la escena es la ventana y nada la empuja fuera de
// ella. El mazo y el historial vivían en una columna al costado que en un teléfono se
// mandaba una pantalla más abajo —`margin: 100vh`—, así que para leer el historial
// había que scrollear el combate. Los dos se mudaron a un `<dialog>` que se abre cuando
// se lo pide. Si alguna de las dos cosas vuelve, esto lo canta.
assert.ok(!/\.sidebar/.test(css),
  'volvió la columna del costado: el mazo y el historial van en su panel, no apoyados sobre la pelea');
assert.ok(!/margin:[^;]*100vh/.test(css),
  'algo se está empujando una pantalla más abajo: eso es scroll, y acá no hay scroll');

// ---- el encuadre del terreno -------------------------------------------------
// Dónde cuelga el dibujo. `bottom` baja el dibujo exactamente lo que le sobra por debajo
// de su horizonte, y de esa cuenta depende que la línea de suelo pintada caiga sobre las
// patas. Tocarla —o meterle cualquier otro número— despega las dos cosas y el bicho
// queda flotando sobre el agua o enterrado en ella. No hay test que lo vea sin abrir la
// pantalla, y desde afuera parece un problema del dibujo y no de una división.
// El terreno lo cuelgan tres pantallas de la misma regla —la mesa, la portada y la
// sala en red—, así que el ancla es la primera de las tres y no la lista entera: sumar
// una cuarta no tiene que romper este test, tocarle la cuenta sí.
const marco = css.slice(css.indexOf('.arena-art i, .lobby-art i'));
assert.match(css, /\.netbox-art i/,
  'la sala en red dejó de colgar su terreno de la regla del arena: es la única pantalla ' +
  'que se abre sin haber pasado por la portada, y sin terreno vuelve a ser un cartel');
assert.match(
  marco,
  /bottom: calc\(var\(--alto\) \* \(var\(--horizonte, \.5\) - 1\)\)/,
  'a `bottom` se le tocó la cuenta: la línea de suelo pintada se despega de las patas',
);

// Y que la ventana alta siga subiendo la escena. Es todo lo que separa una portada con
// el foco en el medio de una con los Axies apretados contra los botones.
const alta = css.slice(css.indexOf('@media (max-aspect-ratio: 5/4)'));
assert.match(alta.slice(0, 300), /--suelo:/,
  'la ventana alta dejó de bajar el horizonte: la escena vuelve a apoyarse en los botones');

// La juntura del dibujo tiene que pasar la costura del relleno. `cuadrar.py` extendió
// los seis terrenos de 16:9 a 1:1, así que el 43,75% de arriba del archivo no es dibujo:
// si el degradé termina antes, esa mancha desenfocada se ve en pantalla. Y si termina
// después, se come la foto.
const junta = Number(marco.match(/transparent (\d+)%\),/)[1]) / 100;
assert.ok(junta > .30 && junta < 1 - 9 / 16,
  `la juntura del dibujo quedó en ${junta}: tiene que apagar el relleno de cuadrar.py ` +
  '(43,75% del archivo) sin llegar a tocar la foto');

// ---- el pie no cambia de alto ------------------------------------------------
// La franja de abajo —lo que se lee y lo que se aprieta— es lo único que la mesa tiene
// debajo, y las filas de abajo del arena se empaquetan contra el borde de la ventana:
// si el pie cambia de alto se mueve todo lo que tiene encima. Y cambia de contenido
// cuatro veces por ronda: el renglón del turno con sus dos botones, el mismo renglón
// solo mientras juega la CPU, la cinta del cierre sin botones, la del final con el suyo.
// De ahí que el alto sea una medida elegida y no la suma de lo que haya adentro.
//
// Nada de esto se ve desde un DOM de mentira —el temblequeo es de la página, no del
// marcado—, así que lo que se puede exigir es la forma de la regla.
// Sin los comentarios: acá se leen las declaraciones, y el comentario de esa regla
// habla justamente de lo que no tiene que estar puesto.
const pie = regla('.controls').replace(/\/\*[\s\S]*?\*\//g, '');
assert.match(pie, /height: var\(--pie\)/,
  'el pie dejó de tener un alto propio: vuelve a medir lo que haya adentro, y la mesa ' +
  'entera sube y baja con cada cierre de turno');
assert.match(pie, /grid-template-rows: var\(--botones\) var\(--zocalo\)/,
  'el casillero de botones tiene que ser de alto fijo: un `auto` acá es lo mismo ' +
  'que no tener alto propio');
assert.ok(!/min-height|max-height|auto/.test(pie),
  `algo en \`.controls\` vuelve a depender del contenido: ${pie}`);

// Y las medidas viajan juntas. Cada ventana tiene su pie —el teléfono lo quiere con
// botones más grandes, la ventana baja lo quiere al mínimo— y pisar una sola deja los
// otros casilleros con la medida de otra pantalla.
const botones = (css.match(/--botones:/g) ?? []).length;
const zocalos = (css.match(/--zocalo:/g) ?? []).length;
assert.ok(botones === zocalos,
  `\`--botones\` se declara ${botones} veces y \`--zocalo\` ` +
  `${zocalos}: las dos son el pie y se pisan juntas o no se pisan`);

// El suelo tiene que llegar al borde de abajo de cualquier ventana. Medido en píxeles
// fijos se terminaba antes en las ventanas angostas y altas —ahí la línea de las patas
// sube—, y debajo de los botones quedaba una franja del color pelado del terreno con un
// corte recto de lado a lado. Desde afuera parecía un fondo mal recortado.
assert.match(regla('.arena::after'), /--under: max\(\d+px, 100vh\)/,
  '`--under` volvió a ser una medida fija: el suelo se corta antes de llegar al borde ' +
  'de abajo en las ventanas donde las patas quedan altas');

// ---- las clases que la pantalla nombra ---------------------------------------
// Un nombre de clase escrito en el marcado y no en el CSS no rompe nada: el panel sale
// sin estilo, apilado contra la esquina, y la suite sigue en verde — el peor tipo de
// falla que tiene este proyecto. Estas son las que dibujan pantallas enteras, y salen
// mitad del HTML y mitad de los módulos que arman su contenido.
const marcado = ['index.html', 'src/lobby.js', 'src/ui.js', 'src/net.js', 'src/result.js']
  .map((f) => read(...f.split('/'))).join('\n');
for (const cls of [
  'topbar-cfg-btn', 'hud-menu', 'hud-row', 'hud-vol', 'hud-item',
  // La caja de los botones: hace que los dos midan lo mismo.
  'controls-acts',
  'lobby-aside', 'lobby-play--alt', 'loadout-cta', 'loadout-now',
  'lobby-foot', 'lobby-help',
  'lobby-choose', 'choose-bar', 'choose-sheet', 'choose-head', 'choose-info', 'choose-cards',
  'choose-deck', 'choose-tally', 'choose-go', 'card--deck', 'tally',
  // La colección de Axies: los filtros, el buscador, la grilla y cada naipe.
  'choose-roster', 'choose-tools', 'choose-filters', 'choose-chip', 'choose-search',
  'choose-grid', 'choose-empty', 'choose-tags', 'choose-on',
  'roster-tile', 'roster-art', 'roster-crest', 'roster-name', 'roster-mark',
  // El (+) de cada carta: la mejora del Axie.
  'deck-slot', 'card-boost', 'boost-btn',
  // La sala en red, que es la única pantalla a la que se entra sin pasar por la
  // portada: el terreno, el logo, la tabla del panel y su cartel, y los renglones de
  // madera de cada sala y de cada asiento.
  'netbox-art', 'netbox-stack', 'netbox-logo', 'netbox-panel', 'netbox-banner',
  'netbox-x', 'netbox-view', 'netbox-rooms', 'netbox-room', 'netbox-empty',
  'room-no', 'room-id', 'room-seats', 'room-go', 'netbox-count', 'netbox-code',
  'netbox-seats', 'seat-art', 'seat-empty', 'seat-id', 'seat-who', 'seat-state',
  'netbox-you', 'netbox-axie', 'netbox-mine', 'netbox-urls', 'netbox-label',
  // La pantalla del final (ver `result.js`): la escena, la tela, el escenario, las
  // marcas, el botín y las puertas.
  'result-scene', 'result-sky', 'result-vfx', 'result-box', 'result-banner', 'result-cloth',
  'result-title', 'result-stage', 'result-fighter', 'result-stats', 'result-stat',
  'result-loot', 'result-item', 'result-acts', 'result-peek', 'result-back',
]) {
  assert.match(marcado, new RegExp(`class="[^"]*${cls}`), `nadie usa \`.${cls}\``);
  assert.match(css, new RegExp(`\\.${cls}[\\s,{:.\\[]`), `\`.${cls}\` no está dibujada en el CSS`);
}

// Carta gigante de Free Game y apilados: mantiene el modo de columnas y la carta soporta zoom out automático
const card = regla('.card');
assert.match(card, /--zoom/, 'la carta soporta zoom out dinámico con --zoom');
assert.match(regla('.card.card--giant'), /card--giant/, 'existe la regla .card.card--giant');
assert.match(regla('.field'), /max-height:/, '.field debe tener límite de alto para no tapar los controles');

// ---- la capa del tutorial ---------------------------------------------------
// Sin capas que apaguen o difuminen la mesa: hubo un scrim (primero con
// `backdrop-filter`, después un SVG con recortes) que tapaba lo que había que leer y
// costaba un repintado de pantalla entera por cuadro. La barra y el menú de
// configuración siguen por encima del centro y de la flecha.
const sinComentarios = (txt) => txt.replace(/\/\*[\s\S]*?\*\//g, '');
const tutoCss = sinComentarios(css.slice(css.indexOf('.tuto-overlay'), css.indexOf('Modo Aventura')));
assert.doesNotMatch(tutoCss, /backdrop-filter|\.tuto-backdrop/, 'el tutorial no apaga la mesa');
const tutorialJs = read('src', 'tutorial.js');
assert.doesNotMatch(tutorialJs, /tuto-backdrop|<mask/, 'el tutorial no apaga la mesa');
assert.match(tutoCss, /\.hud-menu[\s\S]{0,60}z-index:\s*10020/, 'la configuración va por encima del tutorial');
assert.match(regla('.tuto-quit'), /pointer-events:\s*auto/, 'se tiene que poder salir del tutorial');

// La fila del centro se desplaza y recorta lo que se salga de su caja: el brillo de las
// cartas señaladas tiene que entrar en el colchón, o se ve cortado a los costados.
const colchon = Math.min(...[...css.matchAll(/\.market-row\s*\{[^}]*?padding:\s*(\d+)px/g)].map((m) => Number(m[1])));
const brillo = Math.max(...[...tutoCss.matchAll(/(?:\.market-card\.tuto-hl\s*\{|@keyframes tuto-pulse-tight)[^@]*?(?=\n\}|\n@|$)/g)]
  .flatMap((m) => [...m[0].matchAll(/0 0 (\d+)px/g)].map((n) => Number(n[1]))));
assert.ok(Number.isFinite(brillo) && brillo <= colchon, `el brillo del centro (${brillo}px) se corta contra .market-row (${colchon}px)`);

// ---- la animación de los poderes ------------------------------------------------
// La marca de la chapa se esconde mientras el amuleto viaja (ver `holdPip` en
// `power-fx.js`). Sin la regla del CSS no se esconde nada, y sin la de aparecer se queda
// escondida: ninguna de las dos cosas la ve un DOM de mentira. Lo mismo el gesto de la
// carta, el brillo del amuleto y el color del cartel de cada poder.
{
  const { POWER_FX } = await import('../src/power-fx.js');
  const has = (rule, why) => assert.ok(css.includes(rule), why);
  for (const [power, moments] of Object.entries(POWER_FX)) {
    has(`[data-power="${power}"]`, `${power}: el amuleto no tiene su color`);
    has(`.dmg[data-kind^="power-${power}"]`, `${power}: el cartel no tiene su color`);
    for (const [moment, spec] of Object.entries(moments)) {
      if (['apply', 'draw', 'stand'].includes(moment) && spec.flight) {
        assert.match(css, new RegExp(`\\.card\\[data-fx="${power}"\\]\\s*\\{[^}]*animation`),
          `${power}: la carta no tiene su gesto`);
      }
      for (const pip of [].concat(spec.pip ?? [])) {
        const mark = pip === 'shield' ? '.plate-shield' : '.pip-status';
        has(`.plate[data-fx-wait~="${pip}"] ${mark}[data-pip="${pip}"]`,
          `${power}: la marca ${pip} no se esconde mientras viaja el amuleto`);
        has(`.plate[data-fx-pop~="${pip}"] ${mark}[data-pip="${pip}"]`,
          `${power}: la marca ${pip} no aparece al llegar`);
      }
    }
  }
  for (const sel of ['.power-fly', '.power-orb', '.hud-tag']) {
    assert.match(regla(sel), /position:\s*fixed/, `${sel} vuela en coordenadas de la ventana`);
    assert.match(regla(sel), /pointer-events:\s*none/, `${sel} no se come los clics`);
  }
}

console.log(`✓ estilos ok (\`hidden\` oculta, ${remotas.length} texturas del kit con piso propio, tutorial sin scrim)`);
