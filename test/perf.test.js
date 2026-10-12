// El rendimiento de la página, en lo que se puede mirar sin un navegador.
//
// Nada de esto rompe una partida: si vuelve, el juego anda igual, solo que el teléfono
// se calienta y los cuadros se caen. Por eso no lo canta ningún otro test. Cada bloque
// vigila una causa que ya se midió en Chrome (ver `npm run perf`) y que se arregló:
// que no vuelva sin que nadie se entere.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');
const sinComentarios = (txt) => txt.replace(/\/\*[\s\S]*?\*\//g, '');
const css = sinComentarios(read('styles.css'));

// ---- los módulos se piden de una ------------------------------------------------
// Sin `modulepreload` el navegador descubre los imports de a un nivel por vez: ocho
// viajes en fila antes de poder arrancar. Todo módulo que `main.js` carga, directo o
// no, tiene que estar en el `<head>`; y nada que ya no se cargue.
{
  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const m of read('src', file).matchAll(/^import[^;]*?from\s+['"]\.\/([^'"]+)['"]/gm)) walk(m[1]);
  };
  walk('main.js');
  const html = read('index.html');
  const listed = new Set([...html.matchAll(/<link rel="modulepreload" href="src\/([^"]+)">/g)].map((m) => m[1]));
  assert.deepEqual([...seen].filter((f) => !listed.has(f)).sort(), [],
    'módulos que main.js carga sin `<link rel="modulepreload">` en index.html');
  assert.deepEqual([...listed].filter((f) => !seen.has(f)).sort(), [],
    '`modulepreload` de módulos que main.js ya no carga');
}

// ---- las animaciones en bucle las corre la placa de video ---------------------------
// Un `@keyframes` que se repite para siempre y anima algo que no sea `transform`,
// `opacity` o un filtro que no corre píxeles (brillo, saturación…) no lo puede correr
// el compositor: el navegador recalcula el estilo y repinta en el hilo principal a
// cada cuadro, todo el rato que dure. El aro del turno (`box-shadow`) y la rayita del
// reloj (`width`) tenían la página trabajando 60 veces por segundo con la mesa quieta.
// Un brillo que late se hace con un resplandor fijo y un `transform` o una `opacity`.
//
// Las de esta lista son deuda conocida: momentos puntuales —el tutorial, el apilado
// del Rocket, la bebida que se vuelca, la pantalla del final— y no la partida entera.
const KNOWN = new Set([
  'fluidStream', 'liquidBuoyancy', 'liquidCaustic', 'result-glint', 'stackGlow',
  'tetris-sparkle', 'tuto-axie-glow', 'tuto-pulse', 'tuto-pulse-tight',
]);
{
  const frames = {};
  const open = /@keyframes\s+([\w-]+)\s*\{/g;
  for (let m; (m = open.exec(css));) {
    let i = open.lastIndex;
    for (let depth = 1; depth && i < css.length; i++) depth += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0;
    frames[m[1]] = css.slice(open.lastIndex, i - 1);
  }
  const CHEAP = new Set(['transform', 'translate', 'scale', 'rotate', 'opacity', 'animation-timing-function']);
  const painted = (body) => [...new Set([...body.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)/g)]
    .filter(([, prop, value]) => !CHEAP.has(prop) && !(prop === 'filter' && !/\b(blur|drop-shadow)\(/.test(value)))
    .map(([, prop]) => prop))];
  const looping = new Set();
  for (const [, value] of css.matchAll(/animation(?:-name)?\s*:\s*([^;}]*)/g)) {
    for (const part of value.split(',')) {
      if (!/\binfinite\b/.test(part)) continue;
      for (const word of part.trim().split(/\s+/)) if (frames[word]) looping.add(word);
    }
  }
  const offenders = [...looping].filter((name) => !KNOWN.has(name) && painted(frames[name]).length)
    .map((name) => `${name} (${painted(frames[name]).join(', ')})`);
  assert.deepEqual(offenders, [], 'animaciones en bucle que repintan en el hilo principal');
  // Y que la lista no quede vieja: lo que se arregla, se saca.
  for (const name of KNOWN) {
    assert.ok(looping.has(name) && painted(frames[name]).length,
      `\`${name}\` ya no repinta en bucle: sacarla de KNOWN en test/perf.test.js`);
  }
}

// ---- la cámara solo recalcula a los que la usan ---------------------------------
// La cámara escribe `--cam-s`, `--cam-x` y `--cam-y` en el arena a cada cuadro. Una
// variable que se hereda obliga a recalcular el estilo de todo lo que hay adentro; por
// eso están registradas como no heredables y los que las leen las piden con `inherit`.
// Uno nuevo que las lea sin pedirlas se queda con la cámara quieta (y sin error).
{
  for (const name of ['--cam-s', '--cam-x', '--cam-y']) {
    assert.match(css, new RegExp(`@property\\s+${name}\\s*\\{[^}]*inherits:\\s*false`),
      `${name} registrada como no heredable`);
  }
  const inheriting = new Set();
  for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^{}]*--cam-s:\s*inherit[^{}]*)\}/g)) {
    for (const s of sel.split(',')) inheriting.add(s.trim());
  }
  const readers = new Set();
  for (const [, sel] of css.matchAll(/([^{}@]+)\{[^{}]*var\(--cam-[sxy]\)[^{}]*\}/g)) {
    for (const s of sel.split(',')) readers.add(s.trim());
  }
  const missing = [...readers].filter((sel) => !inheriting.has(sel));
  assert.deepEqual(missing, [], 'nodos que leen la cámara sin `--cam-*: inherit`');
}

// ---- los Axies no animan lo que no se ve ----------------------------------------
// Cada Axie tiene dibujos alternativos (la boca mordiendo, la pata estirada) puestos
// en transparente. Animarlos en un clip donde no aparecen no cambia nada en pantalla,
// y el navegador corre esas animaciones en el hilo principal: con el bucle de estar
// quieto eran una docena por Axie, 60 veces por segundo.
{
  const { POSES } = await import('../src/axie-poses.js');
  const { createMotion } = await import('../src/axie-motion.js');
  const anim = { cancel() {}, currentTime: 0 };
  for (const id of Object.keys(POSES)) {
    const idle = POSES[id].idle;
    if (!idle) continue;
    const animated = new Set();
    const layer = (part, att, alt) => ({
      dataset: { part, att },
      classList: { contains: (c) => c === 'axie-alt' && alt },
      animate() { animated.add(att); return anim; },
    });
    const layers = [];
    for (const att of Object.keys(idle.parts)) {
      const part = Object.keys(idle.parts).find((p) => att !== p && att.startsWith(`${p}-`)) ?? att;
      layers.push(layer(part, att, part !== att));
    }
    const node = { animate: () => anim, querySelector: () => ({ animate: () => anim }), querySelectorAll: () => layers };
    const motion = createMotion(node, 0);
    motion.mount(id);
    motion.stop();
    const shown = new Set(Object.entries(idle.swaps).flatMap(([slot, swaps]) => [slot, ...swaps.map(([, att]) => att)]));
    const wasted = [...animated].filter((att) => layers.find((l) => l.dataset.att === att).classList.contains('axie-alt') && !shown.has(att));
    assert.deepEqual(wasted, [], `${id}: capas alternativas animadas sin aparecer en \`idle\``);
  }
}

// ---- el escenario no emula WebGL en el procesador --------------------------------
// Sin placa de video el navegador emula WebGL, y cada cuadro del bloom se lee de vuelta
// píxel a píxel: el hilo principal se quedaba esperando 3 de cada 4 cuadros. Chrome
// entrega el contexto emulado aunque se pida `failIfMajorPerformanceCaveat`, así que
// `glKind` mira además el nombre del que dibuja. Con SwiftShader: sin bloom y los
// lienzos 2D en memoria común; con una placa de verdad, el bloom.
{
  globalThis.requestAnimationFrame ??= () => 0;
  const { createStage } = await import('../src/stage.js');
  const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
  const setup = (renderer) => {
    const asked = [];
    const fakeGl = {
      RENDERER: 1,
      getExtension: (name) => (name === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 2 } : { loseContext() {} }),
      getParameter: () => renderer,
    };
    globalThis.document = { createElement: () => ({ getContext: (type) => (type === 'webgl2' ? fakeGl : ctx2d) }) };
    const canvas = (kind) => ({
      dataset: {},
      getContext(type, opts) { asked.push({ kind, type, opts }); return type === '2d' ? ctx2d : null; },
    });
    const stage = createStage({ clientWidth: 800, clientHeight: 600 }, canvas('base'), canvas('glow'));
    return { stage, asked };
  };

  const soft = setup('Google SwiftShader');
  assert.equal(soft.asked.find((a) => a.type === 'webgl2'), undefined, 'con SwiftShader no se arma el bloom');
  assert.ok(soft.asked.filter((a) => a.type === '2d').every((a) => a.opts?.willReadFrequently),
    'con SwiftShader los lienzos 2D van en memoria común');
  assert.ok(soft.stage.on, 'sin bloom el escenario sigue andando en 2D');

  const gpu = setup('ANGLE (Apple, Apple M2, OpenGL 4.1)');
  const bloom = gpu.asked.find((a) => a.type === 'webgl2');
  assert.equal(bloom?.opts?.failIfMajorPerformanceCaveat, true, 'con placa de video se pide el bloom, sin emular');
  assert.ok(gpu.asked.filter((a) => a.type === '2d').every((a) => !a.opts?.willReadFrequently),
    'con placa de video los lienzos 2D quedan acelerados');
  delete globalThis.document;
}

console.log('✓ rendimiento ok (modulepreload, bucles en el compositor, cámara sin herencia, capas ocultas quietas, sin WebGL emulado)');
