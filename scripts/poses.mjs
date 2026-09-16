// Genera `src/axie-poses.js`: las animaciones propias de los Axies, horneadas.
//
//   npm run poses
//
// El mixer trae, además de los PNG, el esqueleto Spine con 46 animaciones hechas por
// Sky Mavis: caras, patas, colas, el ataque, el golpe recibido, el festejo y —lo que
// hacen los bichos cuando no pasa nada— cinco maneras distintas de aburrirse, entre
// ellas rascarse con la pata de adelante. El juego no las puede reproducir: dibuja
// una pila de PNG, no un esqueleto. Así que se hornean acá y quedan en dos formas que
// el navegador sí sabe usar:
//
//   MOTIONS  qué clip del kit es cada uno de los diez que entran, y si se repite.
//   TRACKS   las pistas de movimiento, sin repetir: `[dx, dy, giro]` cuadro a cuadro.
//   POSES    por Axie y por clip, qué pista lleva el cuerpo, qué pista lleva cada
//            parte, y en qué momento cambia de dibujo cada slot.
//   VARIANTS por Axie, los recortes de las caras y patas alternativas —ojos cerrados,
//            boca abierta, pata estirada—, que son dibujos aparte del CDN.
//
// La matemática es la misma que usa `exportAvatarLayers` para armar la pila quieta
// —solo rotación y traslación, sin escala—, así la pose de reposo del horno cae
// exactamente sobre el manifiesto de `axie-avatars.js`. El script lo verifica antes de
// escribir nada: si algún día el mixer cambia de cuentas, esto falla en vez de
// producir Axies torcidos.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadStarter, restLayers } from './starters.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(root, '.cache');
const PKG = join(CACHE, 'package');
const VERSION = '1.4.9';
const TARBALL = `https://registry.npmjs.org/@axieinfinity/mixer/-/mixer-${VERSION}.tgz`;
const POSES_FILE = join(root, 'src', 'axie-poses.js');

/**
 * Los clips que se hornean, con el nombre corto que usa el juego. De los 46 del kit
 * entran los que un combate de cartas puede llegar a mostrar; el resto —comer,
 * bañarse, evolucionar, los ataques de cola y de cuerno— no tiene dónde caber.
 *
 *   loop  se repite mientras dure la situación; el resto son un pulso y se van.
 *   fps   cuadros por segundo que se guardan. Entre cuadro y cuadro interpola el
 *         navegador, así que subirlo solo hace falta si el clip tiene golpes secos.
 *   rate  a qué velocidad se reproduce. Los bucles del kit están hechos para verse un
 *         rato, no para encadenarse toda la partida: el de estar quieto dura 1,33 s y
 *         trae un parpadeo adentro, así que tal cual sale el Axie parpadea cada 1,3
 *         segundos y parece nervioso. Estirarlo es lo que lo vuelve un bicho tranquilo.
 */
const CLIPS = {
  // Estar vivo sin hacer nada: respirar y parpadear. Corre todo el tiempo.
  idle: { from: 'action/idle/normal', loop: true, fps: 10, rate: 0.6 },
  // Los aburrimientos, que salen cada tanto por encima del anterior. Son los tres
  // `idle/random` que el kit trae para eso más cuatro prestados de otras situaciones:
  // ninguno mueve al Axie de su lugar ni pide un dibujo que no esté ya cargado, así
  // que fuera de su contexto siguen leyéndose como un gesto y nada más.
  scratch: { from: 'action/idle/random-02', fps: 14 }, // se rasca con la pata
  peek: { from: 'action/idle/random-03', fps: 12 }, // estira el cuello y sonríe
  snarl: { from: 'action/idle/random-04', fps: 12 }, // gruñe
  cheer: { from: 'battle/get-buff', fps: 14 }, // un saltito contento
  chew: { from: 'activity/eat-chew', fps: 12 }, // masca al pedo
  snap: { from: 'activity/eat-bite', fps: 14 }, // tarascón al aire
  stomp: { from: 'activity/entrance', fps: 12 }, // se planta y se hace el malo
  // Andar. No es un clip del combate —en la mesa los dos pelean plantados uno
  // enfrente del otro— sino del lobby, donde los Axies se pasean por el terreno
  // mientras nadie apretó nada. El kit lo trae hecho (`action/run`) y corre **en el
  // lugar**: mueve las patas y hamaca el cuerpo, y de llevarlo de un lado a otro se
  // encarga el CSS. Va más lento que el original, que es un trote de pelea y en un
  // paseo se lee como si el bicho estuviera huyendo.
  walk: { from: 'action/run', loop: true, fps: 14, rate: 0.7 },
  // Su turno: se prepara. Es un pulso al empezar, no un loop — la postura de cargar
  // ya la sostiene el CSS.
  ready: { from: 'activity/prepare', fps: 10 },
  // La cadena que se corta. El kit no trae un clip triste —son 46 y ninguno se llama
  // así—, pero de los 46 hay exactamente dos que cierran los ojos y no los vuelven a
  // abrir en todo el clip, y uno de los dos ya es el desmayo (`activity/sleep`, que
  // acá abajo es `ko`). El otro es este: `activity/bath` cierra los ojos, hunde el
  // cuerpo casi tres por ciento del marco y lo deja respirando ahí abajo con las
  // cuatro patas aflojadas. Sacado de la bañera y puesto en la mesa no se lee como
  // bañarse: se lee como resoplar mirando el piso, que es lo que hace un bicho al que
  // se le desinfló el turno. Va al 80% para que el vaivén sea un suspiro y no un
  // temblor.
  sad: { from: 'activity/bath', fps: 12, rate: 0.8 },
  // El intercambio de golpes.
  attack: { from: 'attack/melee/normal-attack', fps: 20 },
  hurt: { from: 'defense/hit-with-shield', fps: 20 },
  whiff: { from: 'battle/get-debuff', fps: 14 },
  // El final.
  win: { from: 'activity/victory-pose-back-flip', loop: true, fps: 14 },
  ko: { from: 'activity/sleep', loop: true, fps: 6, rate: 0.5 },
};

/**
 * Las capas que el juego dibuja. `exportAvatarLayers` saltea estas tres —la sombra y
 * la pelota no son parte del bicho, y el patrón solo existe en cuerpos que no usamos—
 * y acá hay que saltearlas igual para que las dos listas coincidan.
 */
const SKIP = new Set(['shadow', 'ball', 'body-pattern']);

/**
 * Cuánto se tiene que mover una capa **por su cuenta** para que valga la pena
 * guardarla, en porcentaje de su propio tamaño. Casi todas las capas van colgadas del
 * cuerpo y no hacen nada aparte de él: se van, y lo que queda es la cara y las patas.
 */
const DEAD_ZONE = 0.4;

const RAD = Math.PI / 180;
const cosd = (a) => Math.cos(a * RAD);
const sind = (a) => Math.sin(a * RAD);
const round = (n, d = 2) => Number(n.toFixed(d));

/**
 * Los ángulos salen de `atan2`, que corta en ±180°: dos poses casi iguales pueden
 * dar 179° y -179°, y restarlas da un giro de 358° que no existió. `turn` sigue el
 * giro de un cuadro al siguiente por el camino corto y lo va acumulando, así una
 * vuelta de verdad —el salto mortal del festejo— se guarda como una vuelta y un
 * temblor alrededor de ±180° se guarda como un temblor.
 */
function turn(angle, prev) {
  let step = (angle - prev) % 360;
  if (step > 180) step -= 360;
  if (step < -180) step += 360;
  return prev + step;
}

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
 * A diferencia de `npm run axies`, acá el mixer se carga **con** las animaciones
 * (2,4 MB) y con `skipAnimation` en false: son justamente lo que venimos a buscar.
 */
async function loadMixer() {
  await ensureMixer();
  const require = createRequire(import.meta.url);
  const mixer = require(join(PKG, 'dist', 'index.js'));
  const data = (name) =>
    JSON.parse(readFileSync(join(PKG, 'dist', 'data', `axie-2d-v3-stuff-${name}.json`), 'utf8'));
  mixer.initAxieMixer(data('genes'), data('samples'), data('variant'), data('animations'));
  return mixer;
}

// ---------- leer una animación de Spine ----------

/**
 * La curva de un tramo de Spine. Puede ser lineal (sin `curve`), cortada de golpe
 * (`stepped`) o una bezier dada por sus dos puntos de control. Para la bezier hay que
 * invertir x(u) —el tiempo no avanza parejo sobre la curva—, y ocho pasos de Newton
 * alcanzan de sobra para el error que tolera un dibujo de 200 px.
 */
function ease(frame, t) {
  if (frame.curve === undefined) return t;
  if (frame.curve === 'stepped') return 0;
  const cx1 = frame.curve;
  const cy1 = frame.c2 ?? 0;
  const cx2 = frame.c3 ?? 1;
  const cy2 = frame.c4 ?? 1;
  let u = t;
  for (let i = 0; i < 8; i++) {
    const m = 1 - u;
    const x = 3 * m * m * u * cx1 + 3 * m * u * u * cx2 + u * u * u;
    const dx = 3 * m * m * cx1 + 6 * m * u * (cx2 - cx1) + 3 * u * u * (1 - cx2);
    if (Math.abs(dx) < 1e-6) break;
    u = Math.min(1, Math.max(0, u - (x - t) / dx));
  }
  const m = 1 - u;
  return 3 * m * m * u * cy1 + 3 * m * u * u * cy2 + u * u * u;
}

/** El valor de una pista en el instante `t`. `get` saca los números de un cuadro. */
function sampleTrack(frames, t, get, base) {
  if (!frames?.length) return base;
  if (t <= (frames[0].time ?? 0)) return get(frames[0]);
  const last = frames[frames.length - 1];
  if (t >= (last.time ?? 0)) return get(last);
  let i = 0;
  while (i < frames.length - 1 && (frames[i + 1].time ?? 0) <= t) i++;
  const a = frames[i];
  const b = frames[i + 1];
  const ta = a.time ?? 0;
  const tb = b.time ?? 0;
  const p = ease(a, tb === ta ? 0 : (t - ta) / (tb - ta));
  const va = get(a);
  const vb = get(b);
  return va.map((v, k) => v + (vb[k] - v) * p);
}

/**
 * El esqueleto entero en el instante `t`: la matriz de cada hueso.
 *
 * Es la misma cuenta que hace `exportAvatarLayers`, con dos diferencias: los huesos
 * llevan encima lo que dice la animación, y se ignoran las pistas de escala. Lo
 * segundo es a propósito: sin escala todos los huesos quedan en modo normal —los
 * `noScale` del esqueleto dejan de tener efecto— y la matemática se reduce a rotar y
 * trasladar, que es exactamente lo que la librería sabe hacer. Se pierde el
 * achatarse de los rebotes; lo pone el CSS, que ya lo hacía.
 */
function poseAt(skeleton, anim, t) {
  const byName = new Map(skeleton.bones.map((b) => [b.name, b]));
  const world = new Map();
  const solve = (bone) => {
    const cached = world.get(bone.name);
    if (cached) return cached;
    const track = anim?.bones?.[bone.name];
    const [dx, dy] = track
      ? sampleTrack(track.translate, t, (f) => [f.x ?? 0, f.y ?? 0], [0, 0])
      : [0, 0];
    const [da] = track ? sampleTrack(track.rotate, t, (f) => [f.angle ?? 0], [0]) : [0];
    const x = (bone.x ?? 0) + dx;
    const y = (bone.y ?? 0) + dy;
    const rot = (bone.rotation ?? 0) + da;
    const la = cosd(rot);
    const lb = cosd(rot + 90);
    const lc = sind(rot);
    const ld = sind(rot + 90);
    let m;
    if (!bone.parent) {
      m = { a: la, b: lb, c: lc, d: ld, x, y };
    } else {
      const p = solve(byName.get(bone.parent));
      m = {
        a: p.a * la + p.b * lc,
        b: p.a * lb + p.b * ld,
        c: p.c * la + p.d * lc,
        d: p.c * lb + p.d * ld,
        x: p.a * x + p.b * y + p.x,
        y: p.c * x + p.d * y + p.y,
      };
    }
    world.set(bone.name, m);
    return m;
  };
  for (const bone of skeleton.bones) solve(bone);
  return world;
}

/**
 * Dónde queda el centro de cada dibujo y cuánto rotó, en el instante `t`.
 *
 * Devuelve una entrada por **dibujo**, no por slot: los ojos cerrados y los abiertos
 * cuelgan del mismo hueso pero tienen su propio desplazamiento respecto de él —la boca
 * abierta no está donde estaba la cerrada—, así que cada uno se sigue por separado.
 * Mezclarlos fue el error: el salto que hay entre un dibujo y otro se horneaba como si
 * fuera movimiento del hueso y después se le aplicaba también al que no había cambiado.
 */
function layersAt(skeleton, anim, t, world = poseAt(skeleton, anim, t)) {
  const attachments = skeleton.skins[0].attachments;
  const out = {};
  for (const slot of skeleton.slots) {
    const bag = attachments[slot.name];
    if (!bag || SKIP.has(slot.name)) continue;
    const m = world.get(slot.bone);
    for (const [name, att] of Object.entries(bag)) {
      const ax = att.x ?? 0;
      const ay = att.y ?? 0;
      out[name] = {
        slot: slot.name,
        x: m.a * ax + m.b * ay + m.x,
        y: m.c * ax + m.d * ay + m.y,
        rot: Math.atan2(m.c, m.a) / RAD,
        w: att.width ?? 0,
        h: att.height ?? 0,
      };
    }
  }
  return out;
}

/** El dibujo de base de un slot: el que se llama igual que él, o el primero. */
function baseOf(skeleton, slotName) {
  const bag = skeleton.skins[0].attachments[slotName];
  return slotName in bag ? slotName : Object.keys(bag)[0];
}

// ---------- el marco de cada Axie ----------

/**
 * El mismo marco que usa `axie-avatars.js`: la caja que envuelve a todas las capas
 * quietas. Los números horneados son fracciones de ese marco, así el movimiento
 * escala con el dibujo y sirve igual en el tablero que en el selector.
 */
function frameOf(mixer, built, skeleton) {
  const slots = [];
  const spy = (slotName, path, variantKey, shift) => {
    slots.push(slotName);
    return mixer.getVariantAttachmentPath(slotName, path, variantKey, shift);
  };
  const raw = mixer.exportAvatarLayers(
    skeleton,
    built.combo,
    built.variant,
    mixer.getAxieColorPartShift(built.variant),
    spy,
    { width: 0, height: 0, offsetX: 0, offsetY: 0, scale: 1 },
  );
  const attachments = skeleton.skins[0].attachments;
  const boxes = raw.map((layer, i) => {
    const slotName = slots[i];
    const bag = attachments[slotName];
    const att = slotName in bag ? bag[slotName] : bag[Object.keys(bag)[0]];
    return { slot: slotName, x: layer.px, y: layer.py, w: att.width ?? 0, h: att.height ?? 0 };
  });
  return frameFrom(boxes);
}

/**
 * El marco a partir de las cajas de reposo, `{slot, x, y, w, h}` con la `y` para
 * abajo. Las de un starter no salen de la librería sino de su esqueleto
 * (`restLayers`), y el marco se arma igual.
 */
function frameFrom(boxes) {
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w));
  const y1 = Math.max(...boxes.map((b) => b.y + b.h));
  const width = x1 - x0;
  const height = y1 - y0;
  // El centro del marco, en coordenadas de esqueleto (que mide la `y` al revés). Es
  // el punto sobre el que gira el cuerpo entero: el `transform-origin` de la caja que
  // lleva la pose es su propio centro, y tiene que ser este mismo punto.
  const center = { x: x0 + width / 2, y: -(y0 + height / 2) };
  return { x0, y0, width, height, center, boxes: Object.fromEntries(boxes.map((b) => [b.slot, b])) };
}

// ---------- horneado ----------

/**
 * Un clip para un Axie, en dos capas.
 *
 * El esqueleto cuelga entero de un pivote, así que casi cualquier animación mueve las
 * once capas a la vez: guardar el recorrido de cada una es guardar once veces el mismo
 * movimiento del cuerpo. Se separa en dos:
 *
 *   root   lo que hace el cuerpo: correrse y girar. Va una sola vez por clip, y en el
 *          navegador lo lleva la caja que envuelve a todas las capas.
 *   parts  lo que hace cada dibujo **además** de lo que ya hizo el cuerpo. Para casi
 *          todos es cero —van de paseo— y se descartan; sobreviven las patas, la cola,
 *          las orejas y el lomo, que son los que tienen hueso propio animado.
 *
 * Va por dibujo y no por slot: cada uno se mide contra **su propio** reposo y en
 * porcentaje de **su propio** tamaño, que es como se aplica después en CSS. Así el
 * salto que hay entre la boca cerrada y la abierta no se cuela como movimiento — ese
 * salto ya está en dónde se dibuja cada una, y sumarlo otra vez era lo que corría los
 * ojos de lugar al parpadear.
 *
 * El residuo va en el sistema de la caja, no en el de la pantalla: la caja ya rotó, y
 * lo que se le sume adentro rota con ella. Por eso se lo desgira antes de guardarlo.
 */
function bakeClip(skeleton, clip, frame, setup, rest) {
  const anim = skeleton.animations[clip.from];
  if (!anim) throw new Error(`el esqueleto no trae "${clip.from}"`);
  const times = [
    ...Object.values(anim.bones ?? {}),
    ...Object.values(anim.slots ?? {}),
  ].flatMap((tl) => Object.values(tl).flatMap((frames) => frames.map((f) => f.time ?? 0)));
  const duration = Math.max(0, ...times);
  const steps = Math.max(1, Math.round(duration * clip.fps));

  // Los cambios de dibujo salen de la pista tal como viene, no de muestrear: un
  // parpadeo dura 80 ms y a 10 cuadros por segundo se pierde entero.
  const swaps = {};
  for (const [slotName, tl] of Object.entries(anim.slots ?? {})) {
    // Solo los slots que se dibujan: Olek tiene orejas en el esqueleto y no las muestra.
    if (!tl.attachment?.length || SKIP.has(slotName) || !frame.boxes[slotName]) continue;
    const base = baseOf(skeleton, slotName);
    const list = [];
    for (const f of tl.attachment) {
      const at = round(duration ? (f.time ?? 0) / duration : 0, 4);
      const name = f.name ?? base;
      if (list.at(-1)?.[1] === name) continue;
      list.push([at, name]);
    }
    if (list.length) swaps[slotName] = list;
  }

  const root = [];
  const moves = {};
  let spin = 0; // acumulado, para que el salto mortal no se lea como un temblor
  const spun = {};
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * duration;
    const world = poseAt(skeleton, anim, t);
    const now = layersAt(skeleton, anim, t, world);

    // El cuerpo: cuánto giró y adónde fue a parar el pivote `@axie`. En pantalla la
    // `y` va al revés que en el esqueleto, y con ella el sentido del giro.
    const axie = world.get('@axie');
    spin = turn(Math.atan2(axie.c, axie.a) / RAD - rest.axieRot, spin);
    const screenSpin = -spin;
    const ca = cosd(spin);
    const sa = sind(spin);
    // `rotate()` en CSS gira alrededor del centro de la caja; para que el resultado
    // sea el mismo mapa que hace el esqueleto hay que compensar ese centro.
    const bx = axie.x - (ca * rest.axieX - sa * rest.axieY);
    const by = axie.y - (sa * rest.axieX + ca * rest.axieY);
    const tx = bx + (ca * frame.center.x - sa * frame.center.y) - frame.center.x;
    const ty = by + (sa * frame.center.x + ca * frame.center.y) - frame.center.y;
    root.push([
      round((100 * tx) / frame.width, 1),
      round((-100 * ty) / frame.height, 1),
      round(screenSpin, 1),
    ]);

    // Cada dibujo, contra lo que le tocaba solo por ir colgado del cuerpo.
    const cs = cosd(screenSpin);
    const ss = sind(screenSpin);
    for (const [name, pose] of Object.entries(now)) {
      if (!frame.boxes[pose.slot]) continue;
      const home = setup[name];
      const wantX = ca * (home.x - rest.axieX) - sa * (home.y - rest.axieY) + axie.x;
      const wantY = sa * (home.x - rest.axieX) + ca * (home.y - rest.axieY) + axie.y;
      // A pantalla, y de ahí al sistema de la caja (que está girada `screenSpin`).
      const dx = pose.x - wantX;
      const dy = -(pose.y - wantY);
      spun[name] = turn(pose.rot - home.rot, spun[name] ?? 0);
      (moves[name] ??= []).push([
        round((100 * (cs * dx + ss * dy)) / home.w, 1),
        round((100 * (-ss * dx + cs * dy)) / home.h, 1),
        round(-spun[name] - screenSpin, 1),
      ]);
    }
  }

  // El clip arranca donde el cuerpo ya estaba parado.
  //
  // El kit no dibuja todos los clips sobre la misma línea de piso: `activity/prepare`
  // trae el esqueleto entero quince por ciento del marco más abajo desde su primer
  // cuadro —no es que se agache, las patas ni se doblan: el bicho está puesto más
  // abajo—, y el festejo, siete por ciento más arriba. Allá da igual, porque el clip
  // se reproduce solo; acá el suelo lo pone el CSS y no se mueve, así que esa
  // diferencia se lee como que el Axie se hunde bajo su propia sombra al empezar el
  // turno, o como que festeja flotando.
  //
  // El primer cuadro es, por definición, el cuerpo tal como venía: se le resta a toda
  // la pista y lo que queda es el movimiento, que es lo único que el juego quiere. Las
  // partes no necesitan esto —se miden contra su propio reposo y ya arrancan en cero—.
  const [ax, ay, ar] = root[0];
  if (ax || ay || ar) {
    for (const f of root) {
      f[0] = round(f[0] - ax, 1);
      f[1] = round(f[1] - ay, 1);
      f[2] = round(f[2] - ar, 1);
    }
  }

  // Los dibujos que apenas tiemblan se tiran: es ruido de coma flotante y ocupa lo
  // mismo que los que se mueven en serio.
  const parts = {};
  for (const [name, rows] of Object.entries(moves)) {
    const peak = Math.max(
      ...rows.flatMap((r) => [Math.abs(r[0]), Math.abs(r[1]), Math.abs(r[2]) * 2]),
    );
    if (peak >= DEAD_ZONE) parts[name] = rows;
  }
  return { dur: round(duration, 3), root, parts, swaps };
}

/**
 * Los recortes de los dibujos alternativos, en el mismo marco que los de reposo.
 *
 * Cada slot del esqueleto trae, además del dibujo de siempre, los que usan las
 * animaciones: los ojos cerrados, enojados y contentos, la boca abierta, mordiendo y
 * sonriendo, y las patas largas y estiradas. Son PNG aparte en el CDN, con su propio
 * tamaño y su propia posición respecto del hueso, así que cada uno necesita su
 * recorte — y una vez que lo tiene, cambiar de dibujo es solo encenderlo y apagarlo.
 */
function bakeVariants(skeleton, frame, setup, srcOf) {
  const attachments = skeleton.skins[0].attachments;
  const out = {};
  for (const slot of skeleton.slots) {
    const bag = attachments[slot.name];
    // Una variante de un slot que no se dibuja no tiene capa de reposo al lado de la
    // cual ponerse.
    if (!bag || SKIP.has(slot.name) || !frame.boxes[slot.name]) continue;
    const base = baseOf(skeleton, slot.name);
    for (const [name, att] of Object.entries(bag)) {
      if (name === base) continue;
      const home = setup[name];
      out[name] = {
        slot: slot.name,
        src: srcOf(slot.name, att),
        x: round((home.x - home.w / 2 - frame.x0) / frame.width, 5),
        y: round((-home.y - home.h / 2 - frame.y0) / frame.height, 5),
        w: round(home.w / frame.width, 5),
        h: round(home.h / frame.height, 5),
      };
    }
  }
  return out;
}

// ---------- correrlo ----------

const { AXIES, STARTERS } = await import(pathToFileURL(join(root, 'src', 'axies.js')).href);
const { AVATARS } = await import(pathToFileURL(join(root, 'src', 'axie-avatars.js')).href);
const mixer = await loadMixer();

const poses = {};
const variants = {};

/**
 * Hornea un Axie: sus dibujos alternativos y todos sus clips. `srcOf` dice qué PNG es
 * cada dibujo, que es lo único que cambia entre los del mixer y los starters.
 */
function bake(id, skeleton, frame, srcOf) {
  const setup = layersAt(skeleton, null, 0);

  // El control: la pose de reposo del horno tiene que caer sobre el manifiesto que ya
  // usa el juego. Si no cae, las dos cuentas se separaron y todo lo demás es basura.
  const manifest = AVATARS[id];
  if (!manifest) throw new Error(`${id}: no está en axie-avatars.js — falta correr \`npm run axies\``);
  for (const box of Object.values(frame.boxes)) {
    const home = setup[baseOf(skeleton, box.slot)];
    if (!home) throw new Error(`${id}: al horno le falta la capa ${box.slot}`);
    const mineX = (home.x - box.w / 2 - frame.x0) / frame.width;
    const mineY = (-home.y - box.h / 2 - frame.y0) / frame.height;
    if (
      Math.abs((box.x - frame.x0) / frame.width - mineX) > 1e-4 ||
      Math.abs((box.y - frame.y0) / frame.height - mineY) > 1e-4
    ) {
      throw new Error(`${id}/${box.slot}: el reposo del horno no coincide con la librería`);
    }
  }
  const ratio = round(frame.width / frame.height, 5);
  if (Math.abs(ratio - manifest.ratio) > 1e-4) {
    throw new Error(`${id}: marco distinto al de axie-avatars.js — falta correr \`npm run axies\``);
  }

  // El reposo del pivote del que cuelga todo: es contra esto que se mide el cuerpo.
  const home = poseAt(skeleton, null, 0).get('@axie');
  const rest = {
    axieX: home.x,
    axieY: home.y,
    axieRot: Math.atan2(home.c, home.a) / RAD,
  };

  variants[id] = bakeVariants(skeleton, frame, setup, srcOf);
  poses[id] = {};
  const shown = [];
  for (const [name, clip] of Object.entries(CLIPS)) {
    const baked = bakeClip(skeleton, clip, frame, setup, rest);
    poses[id][name] = baked;
    shown.push(`${name}:${Object.keys(baked.parts).join('+') || '—'}`);
  }
  console.log(`  ${id.padEnd(8)} ${shown.join('  ')}`);
}

for (const axie of Object.values(AXIES)) {
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
  const built = mixer.getAxieSpineFromCombo(combo, variantIdx, false);
  if (built.error) throw new Error(`${axie.id}: ${built.error}`);
  const skeleton = built.skeletonDataAsset;
  const shift = mixer.getAxieColorPartShift(built.variant);
  // La misma resolución que hacen las capas de reposo: el color del Axie decide qué PNG
  // del CDN es, y sin esto la boca abierta saldría de otro color.
  bake(axie.id, skeleton, frameOf(mixer, built, skeleton), (slot, att) =>
    mixer.getVariantAttachmentPath(slot, att.path, built.variant, shift));
}

// Los starters traen su propio esqueleto, con cada dibujo ya cortado en `Axies/`.
for (const axie of Object.values(STARTERS)) {
  const skeleton = await loadStarter(axie);
  bake(axie.id, skeleton, frameFrom(restLayers(skeleton)), (slot, att) => att.path);
}

// Que ningún dibujo alternativo apunte a un PNG que el CDN no tiene, y que ninguno
// salga deformado: son 72 archivos que el manifiesto de `npm run axies` no toca, así
// que nadie más los mira.
//
// Lo segundo pasa de verdad. El esqueleto dice de qué tamaño es cada dibujo, y de ahí
// sale el recorte; cuando Sky Mavis vuelve a exportar un PNG y no actualiza el
// esqueleto, los dos números dejan de coincidir y la capa se dibuja estirada. Le pasa
// a `reptile-04/eyes-shut`, que el esqueleto cree de 161×97 y el CDN entrega de
// 161×42: los ojos cerrados salían 2,3 veces más altos de lo que son. Así que se
// miran los primeros 64 bytes de cada PNG —el IHDR, que trae el ancho y el alto— y se
// compara la proporción del dibujo con la del recorte.
const IMAGES = 'https://axiecdn.axieinfinity.com/mixer-stuffs/v6/';
/**
 * Cuánto puede errarle el recorte al alto del dibujo, en píxeles. La cuenta se hace
 * en píxeles y no en porcentaje porque el kit redondea a píxel entero: en unos ojos
 * de 19 px de alto, un píxel ya es un 5%.
 */
const SKEW = 1.5;
const bad = [];
let checked = 0;
await Promise.all(
  Object.entries(variants).flatMap(([id, bag]) =>
    Object.entries(bag).map(async ([name, v]) => {
      if (!v.src) return;
      checked++;
      let png;
      if (v.src.startsWith('Axies/')) {
        // Los de un starter no están en el CDN: los acaba de escribir `starters.mjs`.
        png = readFileSync(join(root, v.src));
      } else {
        const res = await fetch(IMAGES + v.src, { headers: { Range: 'bytes=0-63' } });
        if (!res.ok) return void bad.push(`${id}/${name}: falta ${v.src} (HTTP ${res.status})`);
        png = Buffer.from(await res.arrayBuffer());
      }
      const wide = png.readUInt32BE(16);
      const tall = png.readUInt32BE(20);
      // El alto que tendría el dibujo si entrara en el recorte sin deformarse.
      const fits = wide / ((v.w / v.h) * AVATARS[id].ratio);
      if (Math.abs(fits - tall) > SKEW) {
        bad.push(
          `${id}/${name}: ${v.src} mide ${wide}×${tall} y el recorte lo quiere ${wide}×${fits.toFixed(0)}` +
            ` — el esqueleto y el CDN no dicen lo mismo, sale estirado`,
        );
      }
    }),
  ),
);
if (bad.length) {
  console.error(`\nhay ${bad.length} dibujo(s) alternativo(s) mal:`);
  for (const m of bad) console.error(`  ${m}`);
  process.exit(1);
}
console.log(`\n  ${checked} dibujos alternativos, todos en el CDN y sin deformar`);

// ---------- escribir ----------

const num = (n) => (Object.is(n, -0) ? '0' : String(n));
const rows = (list) => list.map((r) => `[${r.map(num).join(',')}]`).join(',');

/**
 * Las pistas repetidas se guardan una sola vez. Las patas salen todas del mismo
 * cuerpo (`body-normal`), así que las seis clases mueven exactamente las mismas: sin
 * esto el archivo guarda seis veces cada una. Cada pista queda en `TRACKS` y los
 * clips la nombran por su número.
 */
const tracks = [];
const seen = new Map();
const trackId = (list) => {
  const key = rows(list);
  if (!seen.has(key)) {
    seen.set(key, tracks.length);
    tracks.push(key);
  }
  return seen.get(key);
};

const clipMeta = Object.entries(CLIPS)
  .map(
    ([name, c]) =>
      `  ${name}: { from: '${c.from}'${c.loop ? ', loop: true' : ''}` +
      `${c.rate ? `, rate: ${c.rate}` : ''} },`,
  )
  .join('\n');

const posesOut = Object.entries(poses)
  .map(([id, clips]) => {
    const body = Object.entries(clips)
      .map(([name, c]) => {
        const parts = Object.entries(c.parts)
          .map(([slot, list]) => `'${slot}': ${trackId(list)}`)
          .join(', ');
        const swaps = Object.entries(c.swaps)
          .map(([slot, list]) => `'${slot}': [${list.map(([t, n]) => `[${t},'${n}']`).join(',')}]`)
          .join(', ');
        return (
          `    ${name}: { dur: ${c.dur}, root: ${trackId(c.root)},` +
          `\n      parts: { ${parts} },` +
          `\n      swaps: { ${swaps} } },`
        );
      })
      .join('\n');
    return `  ${id}: {\n${body}\n  },`;
  })
  .join('\n');

const tracksOut = tracks.map((t, i) => `  /* ${i} */ [${t}],`).join('\n');

const variantsOut = Object.entries(variants)
  .map(([id, bag]) => {
    const body = Object.entries(bag)
      .map(([name, v]) => `    '${name}': { slot: '${v.slot}', src: '${v.src}', x: ${v.x}, y: ${v.y}, w: ${v.w}, h: ${v.h} },`)
      .join('\n');
    return `  ${id}: {\n${body}\n  },`;
  })
  .join('\n');

writeFileSync(
  POSES_FILE,
  `// GENERADO por \`npm run poses\` (@axieinfinity/mixer ${VERSION}) — no editar a mano.
//
// Las animaciones que ya venían hechas con los Axies, horneadas para una pila de PNG.
// El porqué y las cuentas están en \`scripts/poses.mjs\`; acá va lo que sale.
//
//   MOTIONS   qué clip del kit es cada uno, si se repite y a qué velocidad va
//             (\`rate\`, cuando no es 1). Se llama así y no CLIPS
//             porque ese nombre ya es de los efectos de golpe (\`vfx-clips.js\`), y en
//             el archivo suelto de \`npm run build\` todo termina en el mismo alcance.
//   TRACKS    todas las pistas, sin repetir. Una pista es la lista de
//             \`[dx, dy, giro]\` de algo, cuadro a cuadro. Los clips las nombran por
//             su número: las patas salen del mismo cuerpo en las seis clases, así que
//             la mayoría se comparte.
//   POSES     por Axie y por clip, en dos capas y siempre **relativo al reposo** —es
//             lo que hay que sumarle, no dónde poner las cosas—:
//               \`root\`  lo que hace el cuerpo entero, \`[dx, dy, giro]\` cuadro a
//                       cuadro, en porcentaje del marco del dibujo. Lo lleva la caja
//                       que envuelve a todas las capas.
//               \`parts\` lo que hace cada parte además de eso, en porcentaje de su
//                       propio tamaño. Solo están las que se mueven por su cuenta.
//             Los giros van en grados de pantalla (positivo = horario).
//   SWAPS     dentro de un clip, en qué momento —0 a 1 del clip— cada slot cambia de
//             dibujo: los ojos cerrados, la boca abierta, la pata estirada.
//   VARIANTS  el recorte de esos dibujos alternativos, en el mismo marco que usa
//             \`axie-avatars.js\` para los de reposo.
export const MOTIONS = {
${clipMeta}
};

export const TRACKS = [
${tracksOut}
];

export const VARIANTS = {
${variantsOut}
};

export const POSES = {
${posesOut}
};
`,
);
console.log(`\nsrc/axie-poses.js · ${(readFileSync(POSES_FILE).length / 1024).toFixed(0)} KB`);
