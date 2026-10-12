// El Axie evolucionado, en una sola pila: lo que comparten `npm run axies` y
// `npm run poses`. Es un módulo y no un comando.
//
// El jugador evoluciona las cartas que quiere y en el orden que quiere, así que un Axie
// del roster puede tener cualquier combinación de partes evolucionadas: 64. Hornear un
// dibujo por combinación, como se hace con los rivales (`'lobo+2'`), son 64 entradas por
// Axie en `axie-avatars.js` y en `axie-poses.js`. Así que se hornea **una** pila con las
// dos versiones de cada parte —la de siempre y la evolucionada— en un mismo marco, y el
// navegador enciende la que toca (ver `axieArt` en `axies.js`).
//
// El marco es la caja que envuelve a las dos versiones de todo: la evolucionada suele
// ser más grande (sobresale arriba), así que con alguna parte evolucionada el Axie se
// dibuja un poco más chico en su caja, siempre parado en la misma línea de piso.
import { PART_OF_SLOT } from './starters.mjs';

/** Una capa tal cual, para comparar las de las dos pilas. */
const sameLayer = (a, b) =>
  a.slot === b.slot && a.src === b.src && ['x', 'y', 'w', 'h'].every((k) => Math.abs(a[k] - b[k]) < 1e-6);

/**
 * Junta la pila de siempre (`base`) y la evolucionada (`lv2`) en una sola, en el orden
 * en que se dibujan. Cada capa es `{slot, src, x, y, w, h}` en unidades del esqueleto,
 * con la `y` para abajo.
 *
 * Las capas que están igual en las dos —el cuerpo, las patas, y en un starter todo lo
 * que no es su parte despierta— son una sola. Las demás van dos veces, marcadas con su
 * parte (`part`) y la evolucionada con `lv2`.
 *
 * El orden: las compartidas son las anclas y tienen que estar en el mismo orden en las
 * dos pilas. Entre dos anclas, cada capa evolucionada va pegada detrás de la de siempre
 * de su mismo slot, y las que no tienen pareja (las orejas de Racha, que de base tiene
 * una sola) al final del tramo. Con todo sin evolucionar sale la pila de siempre y con
 * todo evolucionado la evolucionada; las mezclas quedan en un orden que respeta los dos.
 */
export function mergeEvolved(base, lv2) {
  const shared = base.filter((b) => lv2.some((e) => sameLayer(b, e)));
  const anchorsLv2 = lv2.filter((e) => base.some((b) => sameLayer(b, e)));
  if (shared.map((l) => l.slot).join() !== anchorsLv2.map((l) => l.slot).join()) {
    throw new Error(`las capas compartidas no van en el mismo orden: ${shared.map((l) => l.slot)} / ${anchorsLv2.map((l) => l.slot)}`);
  }
  const partOf = (l) => {
    const part = PART_OF_SLOT[l.slot];
    if (!part) throw new Error(`la capa ${l.slot} (${l.src}) cambia al evolucionar y no es de ninguna parte`);
    return part;
  };
  // Los tramos entre anclas, de una pila: [antes de la 1ª, entre la 1ª y la 2ª, …].
  const segments = (list) => {
    const out = [[]];
    for (const l of list) {
      if (shared.some((s) => sameLayer(s, l))) out.push([]);
      else out.at(-1).push(l);
    }
    return out;
  };
  const segA = segments(base);
  const segB = segments(lv2);
  const out = [];
  for (let k = 0; k < segA.length; k++) {
    if (k > 0) out.push({ ...shared[k - 1] });
    const tail = [...segB[k]];
    for (const l of segA[k]) {
      out.push({ ...l, part: partOf(l) });
      const twin = tail.findIndex((e) => e.slot === l.slot);
      if (twin >= 0) out.push({ ...tail.splice(twin, 1)[0], part: partOf(l), lv2: true });
    }
    for (const e of tail) out.push({ ...e, part: partOf(e), lv2: true });
  }
  const x0 = Math.min(...out.map((l) => l.x));
  const y0 = Math.min(...out.map((l) => l.y));
  const x1 = Math.max(...out.map((l) => l.x + l.w));
  const y1 = Math.max(...out.map((l) => l.y + l.h));
  return { layers: out, box: { x0, y0, width: x1 - x0, height: y1 - y0 } };
}
