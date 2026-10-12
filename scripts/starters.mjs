// Los starters del Axie Origins Asset Kit —Buba, Olek, Puffy, Momo…—, listos para las
// dos cuentas de siempre. Es un módulo y no un comando: lo usan `npm run axies`, que
// saca de acá la pila quieta, y `npm run poses`, que hornea sus animaciones.
//
// No son Axies del mixer. El kit los trae como cuerpos fijos de Spine 3.8 —un
// esqueleto, un atlas y una textura cada uno—, los mismos del tutorial de Origins, y
// sus partes (`plant-eyes-01`) no están en la tabla de genes del mixer, que solo tiene
// las pares. No se pueden rearmar por partes: se usan tal cual vienen.
//
// Lo que hace falta para que entren en el mismo molde que los otros es que cada dibujo
// sea un PNG suelto y derecho. Así que esto baja el esqueleto, corta el atlas en un PNG
// por dibujo, lo endereza y lo deja en `Axies/<id>/`, que viaja con el juego (el build
// lo inlinea). En el esqueleto le anota a cada dibujo esa ruta y su caja nueva: de ahí
// en más es un esqueleto como el del mixer.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync, inflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(root, '.cache', 'starters');
const KIT = 'https://raw.githubusercontent.com/axieinfinity/axie-origins-asset-kit/main/Assets/OriginsKit/PvE/Starters';

/** Dónde quedan los PNG, relativo a la raíz: es también la ruta que usa el juego. */
export const STARTER_DIR = 'Axies';

/**
 * Las capas que no se dibujan. Las mismas que saltea `exportAvatarLayers` con los del
 * mixer: la sombra y la pelota no son parte del bicho, y el patrón no se usa.
 */
export const SKIP = new Set(['shadow', 'ball', 'body-pattern']);

/**
 * Cuánto tiene que estar torcido un dibujo en reposo para enderezarlo, en grados. Casi
 * todos vienen derechos; los que no son las patas, y las patas estiradas bastante.
 * Debajo de esto girar solo agrega el borroso del remuestreo.
 */
const TILT = 0.5;

const RAD = Math.PI / 180;

// ---------- PNG ----------

/** Un PNG de 8 bits, RGB o RGBA y sin entrelazar —lo que exporta Spine—, a RGBA. */
export function decodePng(buf) {
  let pos = 8;
  let head = null;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const kind = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') {
      head = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], type: data[9], lace: data[12] };
    } else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    pos += 12 + len;
  }
  const { width, height, depth, type, lace } = head;
  if (depth !== 8 || lace || (type !== 6 && type !== 2)) {
    throw new Error(`PNG que no se sabe leer: ${depth} bits, tipo ${type}, entrelazado ${lace}`);
  }
  const bpp = type === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      line[i] = (line[i] + unfilter(filter, a, b, c)) & 255;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      px[o] = line[x * bpp];
      px[o + 1] = line[x * bpp + 1];
      px[o + 2] = line[x * bpp + 2];
      px[o + 3] = bpp === 4 ? line[x * bpp + 3] : 255;
    }
    prev = line;
  }
  return { width, height, px };
}

/** Lo que el filtro `f` de PNG le restó a un byte, dados el de la izquierda, arriba y arriba a la izquierda. */
function unfilter(f, a, b, c) {
  if (f === 1) return a;
  if (f === 2) return b;
  if (f === 3) return (a + b) >> 1;
  if (f === 4) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  }
  return 0;
}

function chunk(kind, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(kind, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/**
 * RGBA a PNG. Cada fila va con el filtro que la deja más chica —la heurística de
 * siempre: la menor suma de diferencias—, porque estos PNG terminan en base64 adentro
 * del build y ahí cada byte cuenta cuatro tercios.
 */
export function encodePng({ width, height, px }) {
  const stride = width * 4;
  const out = Buffer.alloc((stride + 1) * height);
  const zero = Buffer.alloc(stride);
  const row = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const cur = px.subarray(y * stride, (y + 1) * stride);
    const prev = y ? px.subarray((y - 1) * stride, y * stride) : zero;
    let best = 0;
    let bestCost = Infinity;
    for (let f = 0; f < 5; f++) {
      let cost = 0;
      for (let i = 0; i < stride; i++) {
        const v = (cur[i] - unfilter(f, i >= 4 ? cur[i - 4] : 0, prev[i], i >= 4 ? prev[i - 4] : 0)) & 255;
        cost += v < 128 ? v : 256 - v;
      }
      if (cost < bestCost) {
        bestCost = cost;
        best = f;
      }
    }
    for (let i = 0; i < stride; i++) {
      row[i] = (cur[i] - unfilter(best, i >= 4 ? cur[i - 4] : 0, prev[i], i >= 4 ? prev[i - 4] : 0)) & 255;
    }
    out[y * (stride + 1)] = best;
    row.copy(out, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(out, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- el atlas ----------

/**
 * Un `.atlas` de Spine 3.8 de una sola página: por región, dónde está en la textura
 * (`xy`, `size`), si está acostada (`rotate`) y cuánto transparente le recortaron
 * alrededor (`orig`, `offset`).
 */
export function parseAtlas(text) {
  const regions = {};
  let page = null;
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const prop = line.match(/^(\s*)([a-z]+):\s*(.*)$/);
    if (prop) {
      // Las propiedades de la página van sin sangría y no interesan.
      if (cur && prop[1]) cur[prop[2]] = prop[3];
      continue;
    }
    if (!page) {
      page = line.trim();
      continue;
    }
    if (line.trim().endsWith('.png')) throw new Error('atlas de más de una página');
    cur = regions[line.trim()] = {};
  }
  const pair = (s) => s.split(',').map(Number);
  for (const r of Object.values(regions)) {
    r.rotate = r.rotate === 'true' || r.rotate === '90';
    r.xy = pair(r.xy);
    r.size = pair(r.size);
    r.orig = pair(r.orig ?? r.size.join(','));
    r.offset = pair(r.offset ?? '0,0');
  }
  return regions;
}

/**
 * Una región del atlas como imagen suelta, del tamaño original.
 *
 * Spine acuesta las regiones para empaquetarlas mejor: `rotate` es que está guardada
 * girada 90° en contra del reloj. Y les recorta el transparente de alrededor: `offset`
 * dice dónde va lo que quedó dentro de `orig`, contado desde abajo a la izquierda.
 */
export function regionImage(page, r) {
  const [w, h] = r.size;
  const [ow, oh] = r.orig;
  const left = r.offset[0];
  const top = oh - h - r.offset[1];
  const px = Buffer.alloc(ow * oh * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = r.xy[0] + (r.rotate ? y : x);
      const sy = r.xy[1] + (r.rotate ? w - 1 - x : y);
      page.px.copy(px, ((top + y) * ow + left + x) * 4, (sy * page.width + sx) * 4, (sy * page.width + sx) * 4 + 4);
    }
  }
  return { width: ow, height: oh, px };
}

/** Las medidas de una caja `w × h` girada `deg` grados. */
function turned(w, h, deg) {
  const c = Math.abs(Math.cos(deg * RAD));
  const s = Math.abs(Math.sin(deg * RAD));
  return [w * c + h * s, w * s + h * c];
}

/**
 * La imagen girada `deg` grados en contra del reloj —el sentido de Spine—, en una caja
 * que la contiene entera. Bilineal y con el alfa premultiplicado para promediar: sin
 * eso el borde de cada dibujo se come el color de los píxeles transparentes y sale con
 * un halo negro.
 */
function rotateImage(img, deg) {
  const c = Math.cos(deg * RAD);
  const s = Math.sin(deg * RAD);
  const [fw, fh] = turned(img.width, img.height, deg);
  const width = Math.ceil(fw);
  const height = Math.ceil(fh);
  const px = Buffer.alloc(width * height * 4);
  const at = (x, y, k) =>
    x < 0 || y < 0 || x >= img.width || y >= img.height ? 0 : img.px[(y * img.width + x) * 4 + k];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x + 0.5 - width / 2;
      const dy = y + 0.5 - height / 2;
      // De la pantalla (con la y para abajo) al dibujo sin girar.
      const sx = dx * c - dy * s + img.width / 2 - 0.5;
      const sy = dx * s + dy * c + img.height / 2 - 0.5;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      const acc = [0, 0, 0, 0];
      for (const [ix, iy, wt] of [
        [x0, y0, (1 - fx) * (1 - fy)],
        [x0 + 1, y0, fx * (1 - fy)],
        [x0, y0 + 1, (1 - fx) * fy],
        [x0 + 1, y0 + 1, fx * fy],
      ]) {
        const a = (at(ix, iy, 3) / 255) * wt;
        acc[0] += at(ix, iy, 0) * a;
        acc[1] += at(ix, iy, 1) * a;
        acc[2] += at(ix, iy, 2) * a;
        acc[3] += a;
      }
      const o = (y * width + x) * 4;
      if (acc[3] > 0) {
        px[o] = Math.round(acc[0] / acc[3]);
        px[o + 1] = Math.round(acc[1] / acc[3]);
        px[o + 2] = Math.round(acc[2] / acc[3]);
        px[o + 3] = Math.round(acc[3] * 255);
      }
    }
  }
  return { width, height, px };
}

// ---------- el esqueleto ----------

/**
 * La matriz de cada hueso en reposo. Es la cuenta de `poseAt` en `poses.mjs` sin
 * animación: rotar y trasladar, sin escala —los starters no la usan en reposo—.
 */
function restWorld(skeleton) {
  const byName = new Map(skeleton.bones.map((b) => [b.name, b]));
  const world = new Map();
  const solve = (bone) => {
    if (world.has(bone.name)) return world.get(bone.name);
    const rot = bone.rotation ?? 0;
    const la = Math.cos(rot * RAD);
    const lb = Math.cos((rot + 90) * RAD);
    const lc = Math.sin(rot * RAD);
    const ld = Math.sin((rot + 90) * RAD);
    const x = bone.x ?? 0;
    const y = bone.y ?? 0;
    const p = bone.parent ? solve(byName.get(bone.parent)) : null;
    const m = p
      ? {
          a: p.a * la + p.b * lc,
          b: p.a * lb + p.b * ld,
          c: p.c * la + p.d * lc,
          d: p.c * lb + p.d * ld,
          x: p.a * x + p.b * y + p.x,
          y: p.c * x + p.d * y + p.y,
        }
      : { a: la, b: lb, c: lc, d: ld, x, y };
    world.set(bone.name, m);
    return m;
  };
  for (const bone of skeleton.bones) solve(bone);
  return world;
}

/** Los slots que se dibujan: los que tienen un dibujo puesto en reposo. */
const drawn = (skeleton) => {
  const bag = skeleton.skins[0].attachments;
  return skeleton.slots.filter((s) => s.attachment && !SKIP.has(s.name) && bag[s.name]?.[s.attachment]);
};

/**
 * Le da al dibujo de reposo de un slot el nombre del slot.
 *
 * El juego reconoce la capa de reposo porque se llama como su slot (ver `swaps` en
 * `axie-motion.js`). Los del mixer cumplen siempre, y los starters casi: Momo tiene la
 * pata de adelante estirada en reposo (`leg-front-right-long`). Se intercambian los dos
 * nombres en el esqueleto y en las animaciones, así que todo se ve igual que antes; lo
 * único que cambia es cómo se llama cada uno. Cada dibujo se queda con su región del
 * atlas en `path`, que no se toca.
 */
function nameRestAfterSlot(skeleton, slot) {
  const skin = skeleton.skins[0].attachments;
  const a = slot.name;
  const b = slot.attachment;
  const swap = (n) => (n === a ? b : n === b ? a : n);
  const next = {};
  for (const [name, att] of Object.entries(skin[a])) {
    att.path ??= name;
    next[swap(name)] = att;
  }
  skin[a] = next;
  for (const anim of Object.values(skeleton.animations)) {
    for (const f of anim.slots?.[a]?.attachment ?? []) if (f.name) f.name = swap(f.name);
  }
  slot.attachment = a;
}

async function cached(kit, ext) {
  const file = join(CACHE, String(kit), `${kit}.${ext}`);
  if (!existsSync(file)) {
    const res = await fetch(`${KIT}/${kit}/${kit}.${ext}`);
    if (!res.ok) throw new Error(`no se pudo bajar el starter ${kit}.${ext}: HTTP ${res.status}`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return readFileSync(file);
}

/** Lo mismo, o `null` si el kit no lo trae (los despiertos vienen en JSON o en `.skel`). */
async function cachedOrNull(kit, ext) {
  try {
    return await cached(kit, ext);
  } catch {
    return null;
  }
}

// ---------- el cuerpo despierto ----------

/**
 * De qué parte del Axie es cada slot del esqueleto. Las orejas son dos slots; el resto,
 * uno. Lo que no está acá —el cuerpo, las patas— no evoluciona.
 */
export const PART_OF_SLOT = {
  eyes: 'eyes',
  mouth: 'mouth',
  'ear-left': 'ears',
  'ear-right': 'ears',
  horn: 'horn',
  back: 'back',
  tail: 'tail',
};

/** Cómo se llaman los PNG de los dibujos despiertos: `horn-lv2.png`, como el arte `-lv2` del mixer. */
export const AWAKE_SUFFIX = '-lv2';

/** Los números de un dibujo de región que importan para ubicarlo. */
const placeOf = (att) => [att.rotation ?? 0, att.x ?? 0, att.y ?? 0, att.width ?? 0, att.height ?? 0];

/**
 * Busca un dibujo de región en un esqueleto binario de Spine 3.8 (`.skel`). Cada uno se
 * guarda como siete floats big-endian seguidos: giro, x, y, escala x, escala y, ancho y
 * alto. Devuelve los que tienen ese giro, escala 1 y —si se pide— ese tamaño.
 */
function scanSkel(buf, rotation, size = null, tol = 0.01) {
  const out = [];
  for (let o = 0; o + 28 <= buf.length; o++) {
    if (Math.abs(buf.readFloatBE(o) - rotation) > 0.01) continue;
    if (Math.abs(buf.readFloatBE(o + 12) - 1) > 1e-4 || Math.abs(buf.readFloatBE(o + 16) - 1) > 1e-4) continue;
    const width = buf.readFloatBE(o + 20);
    const height = buf.readFloatBE(o + 24);
    if (size && (Math.abs(width - size[0]) > tol || Math.abs(height - size[1]) > tol)) continue;
    out.push({ x: buf.readFloatBE(o + 4), y: buf.readFloatBE(o + 8), width, height });
  }
  return out;
}

/**
 * El esqueleto del cuerpo despierto de un starter: `PvE/Starters/N-1/`, que el kit
 * llama "body stage 1 (awakened)". Es el mismo esqueleto —mismos huesos, slots y
 * animaciones— con **una** parte dibujada de nuevo: la firma de cada uno. Lo único que
 * cambia de esa parte es dónde se dibuja y de qué tamaño (`x`, `y`, `width`, `height`).
 *
 * Tres de los seis vienen en JSON y tres solo en binario (`.skel`). El binario no se
 * lee entero: se busca cada dibujo del base con sus números, y los que no aparecen son
 * los que cambiaron. Su versión nueva es la única con el mismo giro y el tamaño de su
 * región en el atlas despierto, a la misma escala que el base. Si algún dibujo no se
 * encuentra o aparece dos veces, falla: mejor eso que una parte corrida.
 *
 * Devuelve el esqueleto (una copia del base con los dibujos nuevos) y qué slots cambiaron.
 */
async function awakenedSkeleton(axie, base) {
  const kit = `${axie.kit}-1`;
  const skeleton = structuredClone(base);
  const bag = skeleton.skins[0].attachments;
  const changed = new Set();
  const json = await cachedOrNull(kit, 'json');
  if (json) {
    const awake = JSON.parse(json);
    for (const key of ['bones', 'slots', 'animations']) {
      if (JSON.stringify(awake[key]) !== JSON.stringify(base[key])) {
        throw new Error(`${axie.id}: el despierto (${kit}) tiene otros ${key}, no solo otra parte`);
      }
    }
    const next = awake.skins[0].attachments;
    for (const [slot, drawings] of Object.entries(bag)) {
      for (const [name, att] of Object.entries(drawings)) {
        const now = next[slot]?.[name];
        if (!now) throw new Error(`${axie.id}: al despierto le falta ${slot}/${name}`);
        if (JSON.stringify(placeOf(now)) !== JSON.stringify(placeOf(att))) {
          drawings[name] = { ...att, ...now };
          changed.add(slot);
        }
      }
    }
  } else {
    const skel = await cached(kit, 'skel');
    const regions = parseAtlas((await cached(kit, 'atlas')).toString('utf8'));
    const baseRegions = parseAtlas((await cached(axie.kit, 'atlas')).toString('utf8'));
    for (const [slot, drawings] of Object.entries(bag)) {
      for (const [name, att] of Object.entries(drawings)) {
        if (att.type && att.type !== 'region') continue;
        const [rot, x, y, w, h] = placeOf(att);
        const same = scanSkel(skel, rot, [w, h]).filter((c) => Math.abs(c.x - x) < 0.01 && Math.abs(c.y - y) < 0.01);
        if (same.length) continue;
        // Cambió: el nuevo tiene el tamaño de su región despierta, a la escala del base.
        const region = att.path ?? name;
        const scale = w / baseRegions[region].orig[0];
        const want = regions[region].orig.map((n) => n * scale);
        const found = scanSkel(skel, rot, want, 1.5);
        if (found.length !== 1) {
          throw new Error(`${axie.id}: ${slot}/${name} despierto aparece ${found.length} veces en ${kit}.skel`);
        }
        drawings[name] = { ...att, ...found[0] };
        changed.add(slot);
      }
    }
  }
  const parts = [...new Set([...changed].map((s) => PART_OF_SLOT[s]))];
  if (!parts.length || parts.some((p) => !p)) {
    throw new Error(`${axie.id}: el despierto cambia ${[...changed].join(', ') || 'nada'}`);
  }
  if (axie.awake && JSON.stringify(parts.sort()) !== JSON.stringify([...axie.awake].sort())) {
    throw new Error(`${axie.id}: el despierto cambia ${parts.join(', ')} y \`awake\` en axies.js dice ${axie.awake.join(', ')}`);
  }
  return { skeleton, changed };
}

/**
 * El esqueleto de un starter, con sus dibujos cortados y escritos en `Axies/<id>/`.
 *
 * Cada dibujo sale del atlas **ya girado** como está en reposo. El juego pone cada capa
 * derecha y le suma encima solo lo que la animación la gira *desde* el reposo (ver
 * `bakeClip`), igual que con los del mixer, cuyos PNG ya vienen así del CDN. Acá no
 * vienen: una pata en reposo está inclinada doce grados, y la estirada, más de cien.
 *
 * Devuelve el esqueleto con cada dibujo apuntando a su PNG (`path`) y con la caja de
 * ese PNG (`width`, `height`, en unidades del esqueleto): el resto de las cuentas no
 * tiene que saber que viene de otro lado.
 *
 * Con `awake` es el cuerpo despierto (ver `awakenedSkeleton`): solo se cortan los
 * dibujos de los slots que cambiaron, con el sufijo `-lv2` y del atlas despierto; los
 * demás apuntan a los PNG del base, que son idénticos. Va **después** del base, que es
 * el que limpia la carpeta. `skeleton.awakened` dice qué slots cambiaron.
 */
export async function loadStarter(axie, { awake = false } = {}) {
  let skeleton = JSON.parse(await cached(axie.kit, 'json'));
  let kit = axie.kit;
  let changed = null;
  if (awake) {
    ({ skeleton, changed } = await awakenedSkeleton(axie, skeleton));
    kit = `${axie.kit}-1`;
  }
  const regions = parseAtlas((await cached(kit, 'atlas')).toString('utf8'));
  const page = decodePng(await cached(kit, 'png'));
  const world = restWorld(skeleton);
  for (const slot of drawn(skeleton)) if (slot.attachment !== slot.name) nameRestAfterSlot(skeleton, slot);
  const bag = skeleton.skins[0].attachments;

  const dir = join(root, STARTER_DIR, axie.id);
  if (!awake) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
  }
  for (const slot of drawn(skeleton)) {
    const m = world.get(slot.bone);
    const boneRot = Math.atan2(m.c, m.a) / RAD;
    // En el despierto, lo que no cambió es el mismo dibujo del base: no se vuelve a cortar.
    const fresh = !awake || changed.has(slot.name);
    for (const [name, att] of Object.entries(bag[slot.name])) {
      if (att.type && att.type !== 'region') throw new Error(`${axie.id}/${name}: dibujo de tipo ${att.type}`);
      const region = regions[att.path ?? name];
      if (!region) throw new Error(`${axie.id}/${name}: no está en el atlas`);
      let tilt = (boneRot + (att.rotation ?? 0)) % 360;
      if (tilt > 180) tilt -= 360;
      if (tilt <= -180) tilt += 360;
      if (Math.abs(tilt) < TILT) tilt = 0;
      const file = `${name}${awake && fresh ? AWAKE_SUFFIX : ''}.png`;
      if (fresh) {
        const img = regionImage(page, region);
        writeFileSync(join(dir, file), encodePng(tilt ? rotateImage(img, tilt) : img));
      }
      [att.width, att.height] = turned(att.width, att.height, tilt);
      att.path = `${STARTER_DIR}/${axie.id}/${file}`;
    }
  }
  if (awake) skeleton.awakened = changed;
  return skeleton;
}

/**
 * La pila quieta, en el formato de las capas del mixer: el PNG y su caja, en el orden
 * en que se dibujan y con la `y` para abajo. `slot` es de qué parte es.
 */
export function restLayers(skeleton) {
  const world = restWorld(skeleton);
  const bag = skeleton.skins[0].attachments;
  return drawn(skeleton).map((slot) => {
    const att = bag[slot.name][slot.attachment];
    const m = world.get(slot.bone);
    const ax = att.x ?? 0;
    const ay = att.y ?? 0;
    const cx = m.a * ax + m.b * ay + m.x;
    const cy = m.c * ax + m.d * ay + m.y;
    return { slot: slot.name, src: att.path, x: cx - att.width / 2, y: -cy - att.height / 2, w: att.width, h: att.height };
  });
}
