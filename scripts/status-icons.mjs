// Los íconos de los estados de la chapa, tal cual los dibujó el Axie Origins Asset Kit.
//
//   npm run status-icons    # regenera Icons/status-*.png
//
// El kit trae un ícono por estado (`Textures/StatusIcons`, con su descripción en
// `Catalogs/statuses.json`): el sangrado, la burbuja, el bloqueo de cura… La chapa los
// usa en vez del amuleto del poder que los pone, igual que en Origins: el amuleto es la
// carta y el ícono es lo que le quedó puesto encima. Se eligen por lo que el kit dice
// que hace cada uno, no por el nombre: `buff_shield_boost` es "recibe 10 menos de daño"
// (la almohada), `counter_feather_dmg` es "+daño por pluma" (el abanico),
// `poison_resistance` es "el veneno cura" (los guantes).
//
// Van a `Icons/` porque de ahí los inlinea el build (ver `scripts/build.mjs`).
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const KIT = 'https://raw.githubusercontent.com/axieinfinity/axie-origins-asset-kit/main/Assets/OriginsKit/Textures/StatusIcons';

/** `Icons/status-<clave>.png` ← el ícono del kit. */
export const STATUS_ICONS = {
  // Lo que te ponen.
  poison: 'debuff_poison',
  bleed: 'debuff_bleed',
  wound: 'debuff_grievous_wound',
  weak: 'debuff_weak',
  healblock: 'debuff_heal_block',
  stun: 'debuff_stunned',
  silence: 'debuff_silence',
  // Lo propio.
  egg: 'buff_eggshell',
  strength: 'buff_bloodspike',
  rage: 'buff_rage',
  fury: 'buff_fury',
  plume: 'counter_feather_dmg',
  bubblemaker: 'buff_bubble_maker',
  steelskin: 'thorn',
  antidote: 'poison_resistance',
  pillow: 'buff_shield_boost',
  cleanser: 'buff_cleanser',
  leaf: 'buff_leaf',
  cocoon: 'buff_cocoon',
  bubble: 'buff_bubble',
};

for (const [key, icon] of Object.entries(STATUS_ICONS)) {
  const res = await fetch(`${KIT}/${icon}.png`);
  if (!res.ok) throw new Error(`${icon}: HTTP ${res.status}`);
  writeFileSync(join(root, 'Icons', `status-${key}.png`), Buffer.from(await res.arrayBuffer()));
  console.log(`status-${key}.png ← ${icon}`);
}
