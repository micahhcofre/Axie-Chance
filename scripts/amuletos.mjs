// Sincroniza los íconos de poderes especiales desde la carpeta de amuletos
// (`simbolos especiales/amuletos/`) hacia `Icons/power-<id>.png`.
//
// Todos los símbolos especiales se obtienen EXCLUSIVAMENTE de la carpeta amuletos.
//
//   npm run amuletos       # copia y sincroniza los amuletos configurados
//
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const AMULETOS_DIR = join(root, 'simbolos especiales', 'amuletos');
const ICONS_DIR = join(root, 'Icons');

/**
 * Mapeo de poder -> archivo de amuleto en `simbolos especiales/amuletos/`.
 */
export const AMULETO_PICKS = {
  strength: 'ecard_beast_4001.png',
  brutal: 'ecard_beast_5003.png',
  octopus: 'ecard_aquatic_5004.png',
  bubble: 'ecard_aquatic_4003.png',
  egg: 'ecard_bird_5003.png',
  feather: 'ecard_bird_momo_1.png',
  pot: 'ecard_plant_4003.png',
  leaf: 'ecard_plant_ena_1.png',
  snail: 'ecard_bug_5005.png',
  leech: 'ecard_mantis_dagger.png',
  poison: 'ecard_reptile_venoki_1.png',
  steelskin: 'ecard_reptile_4003.png',
  freegame: 'ecard_neutral_5001.png',
};

export function syncAmuletos() {
  console.log('Sincronizando símbolos especiales desde amuletos:');
  let count = 0;
  for (const [id, file] of Object.entries(AMULETO_PICKS)) {
    const src = join(AMULETOS_DIR, file);
    const dest = join(ICONS_DIR, `power-${id}.png`);
    if (!existsSync(src)) {
      console.warn(`  ! No encontrado en amuletos: ${file}`);
      continue;
    }
    copyFileSync(src, dest);
    console.log(`  ✓ ${id.padEnd(10)} -> Icons/power-${id}.png (${file})`);
    count++;
  }
  console.log(`\n${count} símbolos especiales sincronizados desde amuletos.`);
}

syncAmuletos();
