// Genera `src/axie-avatars.js`: las capas de imagen de cada Axie del roster.
//
// El juego no depende de esto en tiempo de ejecución. El mixer de Axie Infinity
// (@axieinfinity/mixer, ~6 MB de datos) corre una sola vez acá y deja un manifiesto
// chico —una lista de PNG con su posición— que `src/axies.js` pinta con <img>.
// Las imágenes viven en el CDN público de Sky Mavis, no en el repo.
//
//   npm run axies         # regenera src/axie-avatars.js
//
// Cuando cambies las partes de un Axie en `src/axies.js` (el catálogo de partes
// válidas está en el propio manifiesto), volvé a correrlo.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(root, '.cache');
const PKG = join(CACHE, 'package'); // el tarball de npm se expande en package/
const VERSION = '1.4.9';
const TARBALL = `https://registry.npmjs.org/@axieinfinity/mixer/-/mixer-${VERSION}.tgz`;
export const IMAGES = 'https://axiecdn.axieinfinity.com/mixer-stuffs/v6/';

const AVATARS_FILE = join(root, 'src', 'axie-avatars.js');

/** Baja y descomprime el mixer la primera vez; después usa la copia de `.cache/`. */
async function ensureMixer() {
  if (existsSync(join(PKG, 'dist', 'index.js'))) return;
  console.log(`bajando @axieinfinity/mixer@${VERSION}…`);
  mkdirSync(CACHE, { recursive: true });
  const res = await fetch(TARBALL);
  if (!res.ok) throw new Error(`no se pudo bajar el mixer: HTTP ${res.status}`);
  const tgz = join(CACHE, 'mixer.tgz');
  writeFileSync(tgz, Buffer.from(await res.arrayBuffer()));
  execFileSync('tar', ['-xzf', tgz, '-C', CACHE]);
}

/**
 * El paquete es CommonJS aunque declare `"module"`, así que se carga con require.
 * Las animaciones (2,4 MB) solo hacen falta para el Spine animado: para un avatar
 * quieto alcanza con un stub y `skipAnimation`.
 */
async function loadMixer() {
  await ensureMixer();
  const require = createRequire(import.meta.url);
  const mixer = require(join(PKG, 'dist', 'index.js'));
  const data = (name) =>
    JSON.parse(readFileSync(join(PKG, 'dist', 'data', `axie-2d-v3-stuff-${name}.json`), 'utf8'));
  mixer.initAxieMixer(data('genes'), data('samples'), data('variant'), {
    items: { header: [], animations: {} },
  });
  return mixer;
}

/** Partes disponibles por clase y tipo, sacadas de la tabla de genes del mixer. */
function partCatalog(mixer) {
  const out = {};
  for (const sample of mixer.genesStuff.partSamples) {
    const skin = sample.skins[0];
    if (!skin) continue;
    const cls = sample.class.toLowerCase();
    const type = sample.partType.toLowerCase();
    ((out[cls] ??= {})[type] ??= []).push(skin);
  }
  for (const cls of Object.keys(out))
    for (const type of Object.keys(out[cls])) out[cls][type] = [...new Set(out[cls][type])].sort();
  return out;
}

/**
 * Las capas de un Axie: PNG + rectángulo. `exportAvatarLayers` no devuelve el tamaño
 * de cada attachment, así que se anota el slot al vuelo (lo llama en orden) y de ahí
 * se sacan width/height, que es lo que la propia librería usa para posicionar.
 */
function buildLayers(mixer, axie) {
  const combo = new Map([
    ['body', axie.body ?? 'body-normal'],
    ['body-class', axie.class],
    ['back', axie.parts.back],
    ['ears', axie.parts.ears],
    ['eyes', axie.parts.eyes],
    ['horn', axie.parts.horn],
    ['mouth', axie.parts.mouth],
    ['tail', axie.parts.tail],
  ]);
  const variantIdx = mixer.genesStuff.getAxieColorsVariant(axie.color ?? 0, 0, axie.class);
  const built = mixer.getAxieSpineFromCombo(combo, variantIdx, true);
  if (built.error) throw new Error(`${axie.id}: ${built.error}`);

  const skeleton = built.skeletonDataAsset;
  const shift = mixer.getAxieColorPartShift(built.variant);
  const slots = [];
  const spy = (slotName, path, variantKey, partColorShift) => {
    slots.push(slotName);
    return mixer.getVariantAttachmentPath(slotName, path, variantKey, partColorShift);
  };
  const raw = mixer.exportAvatarLayers(skeleton, built.combo, built.variant, shift, spy, {
    width: 0,
    height: 0,
    offsetX: 0,
    offsetY: 0,
    scale: 1,
  });

  const attachments = skeleton.skins[0].attachments;
  return raw.map((layer, i) => {
    const slotName = slots[i];
    const bag = attachments[slotName];
    // Mismo criterio que exportAvatarLayers: el attachment homónimo, o el primero.
    const chosen = slotName in bag ? bag[slotName] : bag[Object.keys(bag)[0]];
    return {
      src: layer.imagePath,
      x: layer.px,
      y: layer.py,
      w: chosen.width ?? 0,
      h: chosen.height ?? 0,
    };
  });
}

/** Recorta el marco al contenido y pasa todo a fracciones 0–1 de ese marco. */
function normalize(layers) {
  const x0 = Math.min(...layers.map((l) => l.x));
  const y0 = Math.min(...layers.map((l) => l.y));
  const x1 = Math.max(...layers.map((l) => l.x + l.w));
  const y1 = Math.max(...layers.map((l) => l.y + l.h));
  const width = x1 - x0;
  const height = y1 - y0;
  const round = (n) => Number(n.toFixed(5));
  return {
    ratio: round(width / height),
    layers: layers.map((l) => ({
      src: l.src,
      x: round((l.x - x0) / width),
      y: round((l.y - y0) / height),
      w: round(l.w / width),
      h: round(l.h / height),
    })),
  };
}

/** Que ninguna capa apunte a un PNG que el CDN no tiene. */
async function checkUrls(layers) {
  const missing = [];
  await Promise.all(
    [...new Set(layers.map((l) => l.src))].map(async (src) => {
      const res = await fetch(IMAGES + src, { method: 'HEAD' });
      if (!res.ok) missing.push(`${src} (HTTP ${res.status})`);
    }),
  );
  return missing;
}

// El roster vive en src/axies.js, que importa el archivo que este script escribe:
// en un repo recién clonado hay que dejar un stub antes de poder leerlo.
if (!existsSync(AVATARS_FILE)) {
  writeFileSync(AVATARS_FILE, 'export const AVATAR_BASE = "";\nexport const AVATARS = {};\n');
}
const { AXIES } = await import(pathToFileURL(join(root, 'src', 'axies.js')).href);

const mixer = await loadMixer();
const avatars = {};
const all = [];
for (const axie of Object.values(AXIES)) {
  const layers = buildLayers(mixer, axie);
  avatars[axie.id] = {
    from: { class: axie.class, color: axie.color ?? 0, parts: axie.parts },
    ...normalize(layers),
  };
  all.push(...layers);
  console.log(`  ${axie.id.padEnd(8)} ${axie.name.padEnd(10)} ${layers.length} capas`);
}

const missing = await checkUrls(all);
if (missing.length) {
  console.error(`\nfaltan ${missing.length} texturas en el CDN:`);
  for (const m of missing) console.error(`  ${m}`);
  process.exit(1);
}

const catalog = partCatalog(mixer);
const body = Object.entries(avatars)
  .map(([id, av]) => {
    const layers = av.layers
      .map((l) => `      { src: '${l.src}', x: ${l.x}, y: ${l.y}, w: ${l.w}, h: ${l.h} },`)
      .join('\n');
    // `from` es con qué se dibujó: si el roster cambia y nadie regenera, los tests lo ven.
    const from = JSON.stringify(av.from);
    return `  ${id}: {\n    from: ${from},\n    ratio: ${av.ratio},\n    layers: [\n${layers}\n    ],\n  },`;
  })
  .join('\n');

const cat = Object.entries(catalog)
  .filter(([cls]) => Object.values(AXIES).some((a) => a.class === cls))
  .map(([cls, types]) => {
    const rows = Object.entries(types)
      .map(([type, ids]) => `    ${type}: [${ids.map((s) => `'${s}'`).join(', ')}],`)
      .join('\n');
    return `  ${cls}: {\n${rows}\n  },`;
  })
  .join('\n');

writeFileSync(
  AVATARS_FILE,
  `// GENERADO por \`npm run axies\` (@axieinfinity/mixer ${VERSION}) — no editar a mano.
//
// Cada Axie es una pila de PNG del CDN de Sky Mavis. \`ratio\` es el ancho/alto del
// marco recortado al dibujo; \`x/y/w/h\` son fracciones de ese marco, así el avatar
// escala a cualquier tamaño sin tocar estos números. \`from\` es la definición del roster
// con la que se generó: si no coincide con \`axies.js\`, falta correr \`npm run axies\`.
export const AVATAR_BASE = '${IMAGES}';

export const AVATARS = {
${body}
};

// Partes válidas por clase, para armar el roster de \`src/axies.js\`. Cambiar una
// parte pide volver a correr \`npm run axies\`: las capas salen del mixer, no del navegador.
export const PART_CATALOG = {
${cat}
};
`,
);
console.log(`\nsrc/axie-avatars.js · ${(readFileSync(AVATARS_FILE).length / 1024).toFixed(0)} KB`);
