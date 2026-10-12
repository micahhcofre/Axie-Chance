// Las piezas del menú de modos, cortadas del Axie Origins Asset Kit.
//
//   npm run menu-art    # regenera Icons/menu-*.png
//
// Los banderines son las telas del cartel de PvP (`BattleUI/flag_pvp`): cuatro colores
// del mismo dibujo, uno por modo y el gris para el que está apagado. Vienen de 440×761
// y se muestran a unos 220 de ancho, así que se guardan a la mitad: viajan en base64
// adentro del build (ver `scripts/build.mjs`).
//
// Los medallones son los de las etapas del mapa de PvE (`PvE/UI/Chapter`): normal
// (espadas cruzadas), élite (lobo) y jefe. Se copian tal cual.

//
// Van a `Icons/` porque de ahí los inlinea el build: el archivo suelto de `dist/` no
// depende del CDN para el menú.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, parseAtlas, regionImage } from './starters.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(root, '.cache', 'menu-art');
const KIT = 'https://raw.githubusercontent.com/axieinfinity/axie-origins-asset-kit/main/Assets/OriginsKit';

/** Región del atlas del banderín → archivo que se escribe en `Icons/`. */
const FLAGS = {
  'flag_PVP.png': { pattern_flag1: 'menu-flag-grey.png', pattern_flag2: 'menu-flag-red.png' },
  'flag_PVP2.png': { pattern_flag3: 'menu-flag-green.png', pattern_flag4: 'menu-flag-teal.png' },
};

const MEDALS = {
  'icon_stage_normal.png': 'menu-medal-normal.png',
  'icon_stage_elite.png': 'menu-medal-elite.png',
  'icon_stage_boss.png': 'menu-medal-boss.png',
};

async function cached(path) {
  const file = join(CACHE, path.replaceAll('/', '_'));
  if (!existsSync(file)) {
    const res = await fetch(`${KIT}/${path}`);
    if (!res.ok) throw new Error(`no se pudo bajar ${path}: HTTP ${res.status}`);
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return readFileSync(file);
}

/**
 * La imagen a la mitad, promediando de a cuatro píxeles con el alfa premultiplicado:
 * sin eso el borde del banderín se come el negro de los píxeles transparentes.
 */
function half({ width, height, px }) {
  const w = width >> 1;
  const h = height >> 1;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const i = ((y * 2 + dy) * width + x * 2 + dx) * 4;
        const al = px[i + 3];
        r += px[i] * al; g += px[i + 1] * al; b += px[i + 2] * al; a += al;
      }
      const o = (y * w + x) * 4;
      if (a) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
      }
      out[o + 3] = Math.round(a / 4);
    }
  }
  return { width: w, height: h, px: out };
}

// El atlas trae dos páginas y `parseAtlas` lee una: se parte en el renglón vacío que
// las separa y se juntan las regiones.
const atlas = Object.assign({}, ...(await cached('BattleUI/flag_pvp/flag_PVP.atlas.txt'))
  .toString('utf8').trim().split(/\r?\n\s*\r?\n/).map(parseAtlas));
for (const [pageFile, regions] of Object.entries(FLAGS)) {
  const page = decodePng(await cached(`BattleUI/flag_pvp/${pageFile}`));
  for (const [name, out] of Object.entries(regions)) {
    const region = atlas[name];
    if (!region) throw new Error(`${pageFile}/${name}: no está en el atlas`);
    const png = encodePng(half(regionImage(page, region)));
    writeFileSync(join(root, 'Icons', out), png);
    console.log(`${out.padEnd(24)} ${(png.length / 1024).toFixed(0)} KB`);
  }
}

for (const [src, out] of Object.entries(MEDALS)) {
  const png = await cached(`PvE/UI/Chapter/${src}`);
  writeFileSync(join(root, 'Icons', out), png);
  console.log(`${out.padEnd(24)} ${(png.length / 1024).toFixed(0)} KB`);
}

