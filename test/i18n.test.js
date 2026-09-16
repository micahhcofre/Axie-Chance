// Tests para la infraestructura de internacionalización (i18n).
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fakeDom } from './dom.mjs';
import { tr, currentLang, setLang, translateDom, LANG_KEY, LANGS } from '../src/i18n.js';
import { EN_STRINGS } from '../src/i18n-en.js';

fakeDom();

// ---- integridad del diccionario --------------------------------------------
assert.ok(Object.keys(EN_STRINGS).length > 0, 'EN_STRINGS no debe estar vacío');
for (const [key, val] of Object.entries(EN_STRINGS)) {
  assert.ok(typeof key === 'string' && key.trim().length > 0, `clave inválida: "${key}"`);
  assert.ok(typeof val === 'string' && val.trim().length > 0, `traducción vacía para la clave "${key}"`);
}
console.log(`✓ diccionario EN_STRINGS ok (${Object.keys(EN_STRINGS).length} entradas no vacías)`);

// ---- currentLang y setLang -------------------------------------------------
setLang('es');
assert.equal(currentLang(), 'es', 'idioma inicial debe ser español');

setLang('en');
assert.equal(currentLang(), 'en', 'setLang(en) debe activar inglés');

setLang('es');
assert.equal(currentLang(), 'es', 'setLang(es) debe activar español');

// Idioma desconocido debe caer en fallback español
setLang('fr');
assert.equal(currentLang(), 'es', 'idioma desconocido debe hacer fallback a español');
console.log('✓ currentLang y setLang ok');

// ---- función tr() ----------------------------------------------------------
// En español: texto original y reemplazo de parámetros
setLang('es');
assert.equal(tr('Jugar'), 'Jugar', 'en español debe devolver texto original');
assert.equal(tr('Nivel {n}', { n: 3 }), 'Nivel 3', 'en español debe reemplazar parámetros');
assert.equal(tr('Texto no catalogado'), 'Texto no catalogado', 'en español texto desconocido queda igual');
assert.equal(tr('{a} y {b}', { a: 'Pez', b: 'Planta' }), 'Pez y Planta');

// En inglés: traducción y reemplazo de parámetros
setLang('en');
assert.equal(tr('Jugar'), 'Play', 'en inglés debe traducir Jugar a Play');
assert.equal(tr('Nivel {n}', { n: 5 }), 'Level 5', 'en inglés debe traducir y reemplazar parámetros');
assert.equal(tr('{current} de {total}', { current: 1, total: 6 }), '1 of 6');
assert.equal(tr('Texto no catalogado'), 'Texto no catalogado', 'en inglés sin traducción debe hacer fallback a español');
assert.equal(tr('Falta {x}', { x: 42 }), 'Falta 42', 'fallback debe reemplazar parámetros igualmente');
console.log('✓ tr (fallback, placeholders e inglés) ok');

// ---- función translateDom() ------------------------------------------------
// Con idioma español no debe modificar el DOM
setLang('es');
const elEs = document.createElement('div');
elEs.textContent = 'Jugar';
elEs.setAttribute('title', 'Menú');
translateDom(elEs);
assert.equal(elEs.textContent, 'Jugar', 'en español translateDom no debe cambiar textContent');
assert.equal(elEs.getAttribute('title'), 'Menú', 'en español translateDom no debe cambiar atributos');

// Con idioma inglés debe traducir nodos y atributos
setLang('en');
const elEn = document.createElement('div');
elEn.textContent = 'Jugar';
elEn.setAttribute('title', 'Menú');
elEn.setAttribute('aria-label', 'Tiempo que queda');
translateDom(elEn);
assert.equal(elEn.textContent, 'Play', 'translateDom debe traducir textContent a Play');
assert.equal(elEn.getAttribute('title'), 'Menu', 'translateDom debe traducir title');
assert.equal(elEn.getAttribute('aria-label'), 'Time remaining', 'translateDom debe traducir aria-label');

// Recorrido de árbol con hijos
const parent = document.createElement('div');
const child1 = document.createElement('p');
child1.textContent = 'Modo Aventura';
const child2 = document.createElement('button');
child2.textContent = 'Volver';
child2.setAttribute('aria-label', 'Cerrar modal');
parent.appendChild(child1);
parent.appendChild(child2);

translateDom(parent);
assert.equal(child1.textContent, 'Adventure Mode', 'debe traducir hijos recursivamente');
assert.equal(child2.textContent, 'Back', 'debe traducir hijos recursivamente');
assert.equal(child2.getAttribute('aria-label'), 'Close modal', 'debe traducir atributos en hijos');

// Conservación de espacios en bordes de nodos de texto
const mockTextNode = {
  nodeType: 3,
  textContent: '   Jugar   \n',
};
translateDom(mockTextNode);
assert.equal(mockTextNode.textContent, '   Play   \n', 'debe conservar espacios en los bordes del texto');

// No traducir contenidos dentro de script o style
const scriptNode = document.createElement('script');
scriptNode.textContent = 'Jugar';
translateDom(scriptNode);
assert.equal(scriptNode.textContent, 'Jugar', 'script no debe ser modificado');
console.log('✓ translateDom ok');

// ---- cobertura: cada tr('...') literal de src/ tiene su traducción ------------
// La regla de `claude.md` —todo texto visible nuevo lleva su entrada en `EN_STRINGS`—
// la cuida este test: sin él, un texto sin traducir no rompe nada y aparece en español
// en medio de la pantalla en inglés. Una clave armada con `${}` tampoco sirve: no hay
// entrada fija que la encuentre.
const SRC = new URL('../src/', import.meta.url);
const untranslated = [];
for (const file of readdirSync(SRC).filter((f) => f.endsWith('.js'))) {
  const code = readFileSync(new URL(file, SRC), 'utf8');
  for (const [, quote, raw] of code.matchAll(/\btr\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    if (quote === '`' && raw.includes('${')) {
      untranslated.push(`${file}: clave armada con \${}: ${raw}`);
      continue;
    }
    const key = raw.replace(/\\(['"`\\])/g, '$1');
    if (EN_STRINGS[key] === undefined) untranslated.push(`${file}: ${key}`);
  }
}
assert.deepEqual(untranslated, [], `textos sin traducción en EN_STRINGS:\n${untranslated.join('\n')}`);
console.log('✓ cada tr() literal de src/ tiene su traducción ok');

// Limpieza final: dejar en español para no contaminar tests subsiguientes
setLang('es');
assert.equal(currentLang(), 'es', 'debe quedar en español al finalizar');
console.log('✓ i18n suite ok');
