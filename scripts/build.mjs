// Empaqueta el juego en un solo .html: CSS, módulos y crests en línea, sin
// dependencias ni servidor. src/ sigue siendo la fuente; esto solo lo concatena.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8');

const MODULES = [
  'data', 'axie-avatars', 'axies', 'rules', 'ai', 'game', 'vfx-clips', 'vfx', 'ui', 'main',
];
const FONTS =
  'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800' +
  '&family=IBM+Plex+Mono:wght@500;600&display=swap';

// Todos los PNG de Icons/ —crests, poderes y estados— en un solo mapa por nombre de
// archivo. `data.js` los pide con `iconUrl()`, y el HTML del modal de reglas los
// nombra por ruta: las dos formas se resuelven abajo.
const icons = Object.fromEntries(
  readdirSync(join(root, 'Icons'))
    .filter((f) => f.endsWith('.png'))
    .map((f) => [
      f,
      `data:image/png;base64,${readFileSync(join(root, 'Icons', f)).toString('base64')}`,
    ]),
);

// Los fondos del arena se piden desde el CSS por ruta relativa, que en un archivo
// suelto no resuelve a nada: se cambian por data URI igual que los crests.
const arenas = readdirSync(join(root, 'Backgrounds')).filter((f) => f.endsWith('.jpg'));
const arenaUrl = (file) =>
  `data:image/jpeg;base64,${readFileSync(join(root, 'Backgrounds', file)).toString('base64')}`;

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

const page = `<link rel="stylesheet" href="${FONTS}">
<title>Axie Chance</title>
<style>
${css}
</style>

${inlined}

<script>
globalThis.ICON_URLS = ${JSON.stringify(icons)};

${script}
<\/script>
`;

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'axie-chance.html'), page);
console.log(`dist/axie-chance.html · ${(page.length / 1024).toFixed(0)} KB`);
