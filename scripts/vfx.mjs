// Genera `src/vfx-clips.js`: la geometría de los efectos de golpe, uno por clase.
//
// Los efectos salen del Axie Origins Asset Kit (`web-vfx/public/vfx/`), que publica
// cada uno como un `atlas.png` —una grilla de cuadros— más un `clip.json` con la
// geometría de la captura original. Acá se baja solo el JSON y se guarda lo mínimo
// que el reproductor necesita; los atlas los pide el navegador por CDN cuando hacen
// falta, igual que las capas de los Axies. El repo no engorda 5 MB y el build sigue
// siendo un solo .html.
//
//   npm run vfx           # regenera src/vfx-clips.js
//
// Para cambiar el golpe de una clase, tocá `PICKS`: el kit trae slash, bite, smash,
// gore, cast, projectile y throw para cada una. El catálogo entero está en
// https://github.com/axieinfinity/axie-origins-asset-kit → web-vfx/public/vfx/index.json
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'src', 'vfx-clips.js');

const REPO = 'axieinfinity/axie-origins-asset-kit';
const REF = 'main';
const RAW = `https://raw.githubusercontent.com/${REPO}/${REF}/web-vfx/public/vfx/`;
// jsDelivr sirve el mismo repo con CORS y caché; los `atlas.png` se piden de acá.
const CDN = `https://cdn.jsdelivr.net/gh/${REPO}@${REF}/web-vfx/public/vfx/`;

/**
 * Un golpe por clase, todos `slash` para que se lean como el mismo tipo de ataque
 * y la diferencia sea la clase. `bust` es el que sale cuando la cadena se corta.
 */
const PICKS = {
  aquatic: 'aquatic_slash',
  beast: 'beast_slash',
  bird: 'bird_slash',
  bug: 'bug_slash',
  plant: 'plant_slash',
  reptile: 'reptile_slash',
  bust: 'disarmed',
};

async function clipJson(id) {
  const res = await fetch(`${RAW}${id}/clip.json`);
  if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
  return res.json();
}

/** El momento del impacto, para sincronizar el sacudón con el efecto y no con el clic. */
function hitTime(clip) {
  const hit = clip.events?.find((e) => e.function === 'OnHit');
  // Sin evento de impacto, el cuadro más brillante es la mejor aproximación.
  return hit ? hit.time : (clip.peakFrame ?? 0) / clip.fps;
}

const entries = [];
for (const [key, id] of Object.entries(PICKS)) {
  const c = await clipJson(id);
  for (const field of ['atlas', 'anchor', 'frames', 'fps', 'duration']) {
    if (c[field] == null) throw new Error(`${id}: falta '${field}' en clip.json`);
  }
  console.log(
    `${key.padEnd(8)} ${id.padEnd(16)} ${c.frames} cuadros · ` +
      `${c.atlas.frameW}×${c.atlas.frameH} · impacto a los ${hitTime(c).toFixed(2)}s`,
  );
  entries.push([
    key,
    {
      id,
      kind: c.kind,
      frames: c.frames,
      fps: c.fps,
      duration: c.duration,
      cols: c.atlas.cols,
      frameW: c.atlas.frameW,
      frameH: c.atlas.frameH,
      // Dónde cae el efecto: `anchor` es el punto del cuadro que va sobre quien lo
      // recibe, en píxeles del recorte. El resto de la geometría de la captura no
      // sirve acá: los tableros están uno arriba del otro, no enfrentados.
      anchor: { x: Math.round(c.anchor.x), y: Math.round(c.anchor.y) },
      hitAt: Number(hitTime(c).toFixed(3)),
    },
  ]);
}

const body = entries
  .map(([key, v]) => `  ${key}: ${JSON.stringify(v)},`)
  .join('\n')
  .replaceAll('"', "'");

writeFileSync(
  OUT,
  `// GENERADO por \`npm run vfx\` desde ${REPO}@${REF} — no editar a mano.
//
// Un efecto por clase más el de cadena cortada. Cada uno es una grilla de \`cols\`
// columnas de cuadros de \`frameW\`×\`frameH\` dentro de su \`atlas.png\`, que se pide
// al CDN recién cuando esa clase golpea por primera vez. \`anchor\` es el punto del
// cuadro que se apoya sobre el Axie que recibe; \`hitAt\` es el segundo en que pega.
export const VFX_BASE = '${CDN}';

export const CLIPS = {
${body}
};

/** La URL del atlas de un clip. */
export const atlasUrl = (clip) => \`\${VFX_BASE}\${clip.id}/atlas.png\`;
`,
);
console.log(`\n→ ${OUT}`);
