// Los QR de la invitación a una sala (ver `qr.js`) y el link que llevan adentro.
//
// Que un QR se **lea** no se puede probar sin un lector, y acá no hay dependencias:
// lo que se prueba es lo que un lector necesita encontrar —el tamaño de la versión,
// los tres ojos, las líneas de tiempo y los bits de formato con su código de
// corrección válido— y que el link salga bien en cada lugar donde corre el juego.
import assert from 'node:assert/strict';
import { fakeDom } from './dom.mjs';
import { qrMatrix, qrSvg } from '../src/qr.js';

fakeDom();

const read = (g, x, y) => (g[y][x] ? 1 : 0);

/** El ojo de 7×7: borde oscuro, anillo claro, centro de 3×3 oscuro. */
function isFinder(g, left, top) {
  for (let dy = 0; dy < 7; dy++) {
    for (let dx = 0; dx < 7; dx++) {
      const d = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
      if (g[top + dy][left + dx] !== (d !== 2)) return false;
    }
  }
  return true;
}

for (const [text, version] of [
  ['a', 1],
  ['https://drq0zy79h9845.cloudfront.net/?red&sala=KJ7M', 4],
  ['http://192.168.1.5:8000/?red&sala=ABCD', 3],
  ['x'.repeat(200), 10],
]) {
  const g = qrMatrix(text);
  const size = version * 4 + 17;
  assert.equal(g.length, size, `"${text.slice(0, 20)}" entra en la versión ${version}`);
  assert.ok(g.every((row) => row.length === size), 'la grilla es cuadrada');
  assert.ok(isFinder(g, 0, 0) && isFinder(g, size - 7, 0) && isFinder(g, 0, size - 7), 'los tres ojos');
  for (let i = 8; i < size - 8; i++) {
    assert.equal(g[6][i], i % 2 === 0, 'línea de tiempo horizontal');
    assert.equal(g[i][6], i % 2 === 0, 'línea de tiempo vertical');
  }
  assert.equal(g[size - 8][8], true, 'el módulo oscuro fijo');

  // Los bits de formato, leídos de sus dos copias: iguales entre sí, nivel M y con
  // el resto BCH que corresponde a sus 5 bits de datos.
  let first = 0;
  let second = 0;
  const firstPos = [
    ...[0, 1, 2, 3, 4, 5].map((i) => [8, i]), [8, 7], [8, 8], [7, 8],
    ...[9, 10, 11, 12, 13, 14].map((i) => [14 - i, 8]),
  ];
  firstPos.forEach(([x, y], i) => { first |= read(g, x, y) << i; });
  for (let i = 0; i < 8; i++) second |= read(g, size - 1 - i, 8) << i;
  for (let i = 8; i < 15; i++) second |= read(g, 8, size - 15 + i) << i;
  assert.equal(first, second, 'las dos copias del formato coinciden');
  const bits = first ^ 0x5412;
  const data = bits >>> 10;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  assert.equal(bits, (data << 10) | rem, 'el formato trae su corrección BCH');
  assert.equal(data >>> 3, 0, 'nivel de corrección M');
}

assert.deepEqual(qrMatrix('sala KJ7M'), qrMatrix('sala KJ7M'), 'el mismo texto da el mismo QR');
assert.notDeepEqual(qrMatrix('sala KJ7M'), qrMatrix('sala KJ7N'), 'y otro texto, otro');
assert.throws(() => qrMatrix('z'.repeat(3000)), RangeError, 'lo que no entra, avisa');

const svg = qrSvg('hola', { label: 'a <b> & c' });
assert.match(svg, /viewBox="0 0 29 29"/, 'versión 1 más el margen de 4 por lado');
assert.match(svg, /<title>a &lt;b> &amp; c<\/title>/, 'el título va escapado');
assert.match(svg, /fill="#fff"/, 'fondo blanco: oscuro sobre claro');
console.log('✓ QR ok (versiones, ojos, tiempo y formato)');

// ---- el link que va adentro -------------------------------------------------
globalThis.EventSource = class {};
const { roomLink } = await import('../src/net.js');

const at = (href) => {
  const u = new URL(href);
  return { hostname: u.hostname, origin: u.origin, pathname: u.pathname };
};
assert.equal(roomLink('KJ7M', at('https://drq0zy79h9845.cloudfront.net/')),
  'https://drq0zy79h9845.cloudfront.net/?red&sala=KJ7M', 'publicado: la dirección de la página');
assert.equal(roomLink('KJ7M', at('https://example.com/juegos/axie/'), ['http://10.0.0.2:8000']),
  'https://example.com/juegos/axie/?red&sala=KJ7M', 'con carpeta, y sin mirar la red');
assert.equal(roomLink('AB CD', at('http://192.168.1.5:8000/')),
  'http://192.168.1.5:8000/?red&sala=AB%20CD', 'el código va escapado');
for (const local of ['http://localhost:8000/', 'http://127.0.0.1:8000/', 'http://[::1]:8000/']) {
  assert.equal(roomLink('KJ7M', at(local), ['http://192.168.1.5:8000']),
    'http://192.168.1.5:8000/?red&sala=KJ7M', `${local}: la IP de la red`);
  assert.equal(roomLink('KJ7M', at(local)), null, `${local} sin IP de la red: no hay link`);
}
assert.equal(roomLink('KJ7M', { hostname: '', origin: 'null', pathname: '/x.html' }), null,
  'un archivo suelto no tiene link');
console.log('✓ link de la sala ok (publicado, red local y localhost)');
