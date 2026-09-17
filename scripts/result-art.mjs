// Los dibujos de la pantalla del final, cortados de las pantallas de resultado del
// Axie Origins Asset Kit (`Assets/OriginsKit/BattleUI/{victory,defeated,draw}`).
//
//   npm run result-art    # regenera Icons/result-*.png
//
// El kit trae cada pantalla como un esqueleto de Spine con su atlas: la tela azul de la
// victoria con la rama que florece, la roja de la derrota con la rama seca y las
// telarañas. Acá no se arma el esqueleto: se cortan las piezas sueltas y la puesta en
// escena la hace el CSS (ver `.result` en `styles.css`).
//
// Los carteles con la palabra ("VICTORY", "DEFEATED", "DRAW") no se cortan: están
// dibujados en inglés y el juego habla dos idiomas. La palabra la escribe `tr()` con la
// letra del juego, encima de la tela.
//
// Van a `Icons/` porque de ahí los inlinea el build (ver `scripts/build.mjs`) y los pide
// `iconUrl()`: el archivo suelto de `dist/` no depende del CDN para el final.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng, parseAtlas, regionImage } from './starters.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(root, '.cache', 'result-art');
const KIT = 'https://raw.githubusercontent.com/axieinfinity/axie-origins-asset-kit/main/Assets/OriginsKit/BattleUI';

/** Pantalla del kit → región del atlas → archivo que se escribe en `Icons/`. */
const PICKS = {
  victory: {
    clouth: 'result-cloth-blue.png',
    leaf: 'result-branch.png',
  },
  defeated: {
    clouth: 'result-cloth-red.png',
    leaf: 'result-twig.png',
    spider_web_l: 'result-web-l.png',
    spider_web_r: 'result-web-r.png',
  },
};

async function cached(screen, file) {
  const path = join(CACHE, screen, file);
  if (!existsSync(path)) {
    const res = await fetch(`${KIT}/${screen}/${file}`);
    if (!res.ok) throw new Error(`no se pudo bajar ${screen}/${file}: HTTP ${res.status}`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return readFileSync(path);
}

for (const [screen, regions] of Object.entries(PICKS)) {
  const atlas = parseAtlas((await cached(screen, `${screen}.atlas.txt`)).toString('utf8'));
  const page = decodePng(await cached(screen, `${screen}.png`));
  for (const [name, out] of Object.entries(regions)) {
    const region = atlas[name];
    if (!region) throw new Error(`${screen}/${name}: no está en el atlas`);
    const png = encodePng(regionImage(page, region));
    writeFileSync(join(root, 'Icons', out), png);
    console.log(`${out.padEnd(24)} ${region.orig.join('×')} · ${(png.length / 1024).toFixed(0)} KB`);
  }
}
