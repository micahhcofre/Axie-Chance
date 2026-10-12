// Lo que comparten `npm run axies` y `npm run poses` sobre los Axies del mixer: cuáles
// son y cómo se le piden al mixer. Es un módulo y no un comando.
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (name) => import(pathToFileURL(join(root, 'src', name)).href);

/**
 * Los Axies que se arman con el mixer: los del roster que tienen partes y los rivales
 * de la Aventura tal como salen en cada nivel, con sus partes evolucionadas.
 */
export async function mixedAxies() {
  const { AXIES, axie } = await src('axies.js');
  const { ADVENTURE_LEVELS } = await src('adventure.js');
  return [
    ...Object.values(AXIES).filter((a) => a.parts),
    ...[...new Set(ADVENTURE_LEVELS.map((l) => l.rival))].map(axie),
  ];
}

/** Las partes de un Axie como las pide el mixer. Una evolucionada, con su arte `-lv2`. */
export function comboOf(axie) {
  const part = (type) => (axie.evolved?.includes(type) ? `${axie.parts[type]}-lv2` : axie.parts[type]);
  return new Map([
    ['body', axie.body ?? 'body-normal'],
    ['body-class', axie.class],
    ['back', part('back')],
    ['ears', part('ears')],
    ['eyes', part('eyes')],
    ['horn', part('horn')],
    ['mouth', part('mouth')],
    ['tail', part('tail')],
  ]);
}

/** La paleta de un Axie: `skin` es la del cuerpo de evento (1 escarcha, 2 verano, 3 pesadilla). */
export const variantOf = (mixer, axie) =>
  mixer.genesStuff.getAxieColorsVariant(axie.color ?? 0, axie.skin ?? 0, axie.class);

/**
 * Con qué se dibujó un Axie, para que los tests vean si el manifiesto quedó viejo. Los
 * del roster llevan lo de siempre; los rivales, además, su cuerpo y lo evolucionado.
 */
export function fromOf(axie) {
  const out = { class: axie.class, color: axie.color ?? 0, parts: axie.parts };
  if (axie.body) out.body = axie.body;
  if (axie.skin) out.skin = axie.skin;
  if (axie.evolved?.length) out.evolved = axie.evolved;
  return out;
}

/** Una clave del manifiesto: los rivales evolucionados (`lobo+2`) van entre comillas. */
export const keyOf = (id) => (/^[a-z_]\w*$/i.test(id) ? id : `'${id}'`);
