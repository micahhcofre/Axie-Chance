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
  // Bestia
  strength: 'ecard_beast_4001.png',
  brutal: 'ecard_beast_5003.png',
  razor: 'ecard_beast_5005.png',
  dagger: 'ecard_beast_buba_1.png',
  rage: 'ecard_beast_4003.png',
  // Pez
  octopus: 'ecard_aquatic_5004.png',
  bubble: 'ecard_aquatic_4003.png',
  maker: 'ecard_aquatic_puffy_1.png',
  jellyfish: 'ecard_aquatic_5005.png',
  redbubble: 'ecard_aquatic_rouge_1.png',
  // Pájaro
  egg: 'ecard_bird_5003.png',
  feather: 'ecard_bird_momo_1.png',
  shuriken: 'ecard_storm_shuriken.png',
  fan: 'ecard_bird_4003.png',
  hammer: 'ecard_bird_5005.png',
  // Planta
  pot: 'ecard_plant_4003.png',
  leaf: 'ecard_plant_ena_1.png',
  guard: 'ecard_plant_bard_1.png',
  sage: 'ecard_plant_5005.png',
  pillow: 'ecard_plant_mit_1.png',
  // Bicho
  snail: 'ecard_bug_5005.png',
  leech: 'ecard_mantis_dagger.png',
  cocoon: 'ecard_bug_pomodoro_1.png',
  scanner: 'ecard_bug_shillin_1.png',
  trickster: 'ecard_bug_4003.png',
  // Reptil
  poison: 'ecard_reptile_venoki_1.png',
  steelskin: 'ecard_reptile_4003.png',
  viper: 'ecard_reptile_5005.png',
  gloves: 'ecard_glove_of_infection.png',
  edge: 'ecard_reptile_machito_1.png',
  // Neutral
  freegame: 'ecard_neutral_5001.png',
  // Neutrales de la Aventura (ver `NEUTRAL_POWERS` en src/data.js)
  focus: 'ecard_neutral_1003.png',
  lens: 'ecard_lens_of_revelation.png',
  spell: 'ecard_dusk_4003.png',
  mirror: 'ecard_neutral_red_mirror.png',
  energy: 'ecard_neutral_5006.png',
  papa: 'ecard_papa_bear.png',
  mama: 'ecard_mama_bear.png',
  blood: 'ecard_neutral_bloodpact.png',
  dispel: 'ecard_black_sage.png',
  stamp: 'ecard_neutral_4001.png',
  tape: 'ecard_neutral_5004.png',
  gift: 'ecard_neutral_last_gift.png',
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
