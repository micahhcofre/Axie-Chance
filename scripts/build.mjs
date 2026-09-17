// Empaqueta el juego en un solo .html: CSS, módulos y crests en línea, sin
// dependencias ni servidor. src/ sigue siendo la fuente; esto solo lo concatena.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

const MODULES = [
  'i18n-en', 'i18n',
  'data', 'axie-avatars', 'axie-poses', 'axies', 'loadout', 'rules', 'ai', 'adventure-levels', 'adventure', 'game',
  'vfx-clips', 'vfx', 'power-fx', 'axie-motion', 'audio-clips', 'audio', 'audio-cues', 'result', 'ui', 'rooms', 'link', 'qr', 'net',
  'tutorial', 'lobby', 'main',
];
const FONTS =
  'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800' +
  '&family=Lilita+One&display=swap';

// Todos los PNG de Icons/ —crests, poderes, estados y las dos versiones del logo— en
// un solo mapa por nombre de archivo. `data.js` los pide con `iconUrl()`, y el HTML
// —el modal de reglas, la marca de la barra, el título de la portada— los nombra por
// ruta: las dos formas se resuelven abajo. Los originales del logo viven en `logo/` y
// no viajan: lo que se inlinea es la copia al tamaño en que se muestra.
const icons = Object.fromEntries(
  readdirSync(join(root, 'Icons'))
    .filter((f) => f.endsWith('.png'))
    .map((f) => [
      f,
      `data:image/png;base64,${readFileSync(join(root, 'Icons', f)).toString('base64')}`,
    ]),
);

// Los starters de la Aventura (`Axies/<id>/*.png`, ver `scripts/starters.mjs`): `axies.js`
// los pide por ruta, y en el archivo suelto la ruta se resuelve con este mapa. Viaja la
// ruta y no el data URI en el manifiesto porque de la ruta sale de qué parte es cada capa.
const axieUrls = Object.fromEntries(
  readdirSync(join(root, 'Axies'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) =>
      readdirSync(join(root, 'Axies', d.name))
        .filter((f) => f.endsWith('.png'))
        .map((f) => [
          `Axies/${d.name}/${f}`,
          `data:image/png;base64,${readFileSync(join(root, 'Axies', d.name, f)).toString('base64')}`,
        ]),
    ),
);

// Los fondos del arena se piden desde el CSS por ruta relativa, que en un archivo
// suelto no resuelve a nada: se cambian por data URI igual que los crests. Viajan los
// `.avif` de 3840 —los que carga el juego—, no los `.jpg` cuadrados que quedan al lado
// como original de `cuadrar.py`: ver `scripts/agrandar.py`.
const arenas = readdirSync(join(root, 'Backgrounds')).filter((f) => f.endsWith('.avif'));
const arenaUrl = (file) =>
  `data:image/avif;base64,${readFileSync(join(root, 'Backgrounds', file)).toString('base64')}`;

// Los módulos no tienen dependencias circulares ni nombres repetidos entre sí,
// así que alcanza con sacarles import/export y concatenarlos en orden.
const script = MODULES.map((name) =>
  read('src', `${name}.js`)
    .replace(/^import[^;]*;\n/gm, '')
    .replace(/^export /gm, '')
    .trim(),
).join('\n\n');

const html = read('index.html');
const body = html
  .slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('</body>'))
  .replace(/<script type="module"[^>]*><\/script>\s*/, '')
  .trim();

// Las rutas a Icons/ del modal de reglas también se reemplazan por el data URI.
const inlined = Object.entries(icons).reduce(
  (out, [file, url]) => out.replaceAll(`Icons/${file}`, url),
  body,
);

const css = arenas.reduce(
  (out, file) => out.replaceAll(`Backgrounds/${file}`, arenaUrl(file)),
  read('styles.css').trim(),
);

// El `<head>` del index no viaja —el body se recorta y el resto se arma acá—, así que
// las tres etiquetas que sí hacen falta se vuelven a poner. El `charset` no es
// opcional: abierto como archivo suelto nadie manda un `Content-Type`, el navegador
// adivina latin-1 y el juego entero queda con los acentos rotos.
const page = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="${icons['bird-crest.png']}">
<link rel="stylesheet" href="${FONTS}">
<title>Axie Chance</title>
<style>
${css}
</style>

${inlined}

<script>
globalThis.ICON_URLS = ${JSON.stringify(icons)};
globalThis.AXIE_URLS = ${JSON.stringify(axieUrls)};

${script}
<\/script>
`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'axie-chance.html'), page);
console.log(`dist/axie-chance.html · ${(page.length / 1024).toFixed(0)} KB`);
