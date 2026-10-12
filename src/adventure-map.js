// El mapa de la Aventura, en la pantalla.
//
// El mundo lo arman `map-world.js` (qué hay y dónde: las tierras, el camino que pasa por
// los niveles, el agua, los hitos y el decorado) y `map-art.js` (cómo se dibuja cada
// pieza). Es un solo mapa de punta a punta, dibujado en código, y se arma una vez por
// orientación: de costado en una pantalla apaisada y de abajo para arriba en un teléfono
// parado. Acá va lo que cambia con el progreso y lo que se toca, encima del dibujo:
//
// - el sendero de oro, desde la casa hasta el nivel abierto más lejano;
// - las nubes que tapan las tierras a las que todavía no llegaste;
// - los niveles, que son los íconos de etapa del kit de Origins (normal, élite, jefe) con
//   su número en una tablita y su estrella (dorada por K.O., apagada si no);
// - el cartel de cada capítulo y el clima de cada tierra;
// - los rivales: el de cada nivel abierto —los ganados y el que toca pasar— está parado
//   en el piso al costado de su nivel, del lado del camino que sigue, cortándolo, y vivo
//   (respira y hace gestos, ver `watchRivals` en `lobby.js`); los de los niveles cerrados
//   todavía no llegaron. Tu Axie, del otro lado del nivel elegido, mira a su rival, y al
//   elegir otro nivel camina por el camino a saltitos hasta allá.
//
// Todo se ubica en coordenadas del mapa (0 a 1 a lo ancho y a lo alto): el tablero
// (`.adv-board`) mide lo mismo que el dibujo.
//
// Con veinte tierras el mundo entero son miles de piezas, así que se pinta de a una
// tierra (`worldHtml({ lazy: true })` y `zoneContent`): el mapa sale con un lugar vacío
// por tierra en cada capa, y `lobby.js` va llenando las que se acercan a la pantalla y
// vaciando las que se alejan —el dibujo, lo que se mueve, las nubes, el clima y los
// rivales de sus niveles—. Sin `IntersectionObserver` (los tests) sale todo pintado.
import { axie, axieArt } from './axies.js';
import { makeRng } from './data.js';
import { adventureChapters, isLevelUnlocked, getAdventureProgress, levelToPlay } from './adventure.js';
import { buildWorld, worldLife, worldMark, worldBaseDefs, worldGroundCss, worldLandDefs, worldZoneArt, worldZoneBox, worldZoneLands, WORLD_LANDS } from './map-world.js';
import { artN } from './map-art.js';
import { tr } from './i18n.js';

/** La interfaz del PvE en el kit de Origins, servida por jsDelivr. */
export const PVE_UI = 'https://cdn.jsdelivr.net/gh/axieinfinity/axie-origins-asset-kit@main/Assets/OriginsKit/PvE/UI';
const KIT_POINTER = 'https://cdn.jsdelivr.net/gh/axieinfinity/axie-origins-asset-kit@main/Assets/OriginsKit/Textures/TargetPointer/arrow.png';

/** Cada cuánto camino da un saltito tu Axie al caminar, en unidades del mapa. */
const HERO_HOP = 46;
/** A qué altura del Axie están sus patas, en fracción de su alto (ver `.adv-hero`). */
const HERO_FEET = 0.84;

const mapWorlds = new Map();
/** El mundo de una orientación, armado una sola vez; el dibujo, la primera vez que se pinta. */
export function worldFor(orient = 'h') {
  const chapters = adventureChapters();
  const key = `${orient}|${chapters.length}|${chapters.reduce((sum, ch) => sum + ch.levels.length, 0)}`;
  if (!mapWorlds.has(key)) {
    const world = buildWorld(chapters, orient);
    // Lo que se mueve se elige antes del dibujo: lo que sale de él no se pinta dos veces.
    mapWorlds.set(key, { world, life: worldLife(world), defs: null, groundCss: null, zones: [], lands: new Map(), clouds: new Map() });
  }
  return mapWorlds.get(key);
}

/** El punto del camino a la fracción `f` de su largo, en unidades del mapa. */
function routePoint(route, f) {
  const k = Math.min(Math.max(f, 0), 1);
  let lo = 0;
  let hi = route.at.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (route.at[mid] < k) lo = mid;
    else hi = mid;
  }
  const a = route.pts[lo];
  const b = route.pts[hi];
  const u = (k - route.at[lo]) / ((route.at[hi] - route.at[lo]) || 1);
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
}

/** Las variables CSS que ubican algo sobre el mapa. */
const mapPlace = (world, p) => `--x:${(p.x / world.W).toFixed(5)};--y:${(p.y / world.H).toFixed(5)}`;

/** Las variables CSS que paran a tu Axie en un nivel (ver `levelSpot`). */
const heroPlace = (spot) => `--x:${spot.at.x.toFixed(5)};--y:${spot.at.y.toFixed(5)};--ahead:${spot.ahead}`;

/**
 * Dónde está el nivel `id` en la orientación dada: su capítulo, su fracción del camino
 * (`f`), su punto (`at`, de 0 a 1 en el mapa), si es de jefe, y para qué lado sigue el
 * viaje (`ahead`: 1 a la derecha, -1 a la izquierda). Ahí es la pelea: el rival se para
 * del lado de adelante, cortando el camino, y tu Axie del de atrás, mirándolo (`face`).
 * Los dos pisan la misma línea que el nivel, a su costado; el corrimiento lo pone el CSS
 * (`--ahead` en `.adv-spot-rival` y `.adv-hero`). `null` si no existe.
 */
export function levelSpot(id, orient = 'h') {
  const { world } = worldFor(orient);
  const lv = world.levels.find((l) => l.id === Number(id));
  if (!lv) return null;
  // De costado el viaje sigue siempre a la derecha. Parado sube, y el costado es para
  // donde dobla el camino después del nivel.
  let ahead = 1;
  if (world.orient === 'v') ahead = routePoint(world.route, lv.f + 140 / world.route.length).x >= lv.x ? 1 : -1;
  return {
    chapter: lv.chapter,
    f: lv.f,
    boss: lv.boss,
    at: { x: lv.x / world.W, y: lv.y / world.H },
    ahead,
    face: ahead > 0 ? 'right' : 'left',
  };
}

/**
 * Lo que cambia con el progreso, en otro SVG sobre el dibujo: el sendero de oro hasta
 * `walkedTo` (fracción del camino) y, desde la primera tierra cerrada (`fogFrom`, fracción
 * del viaje, o `null`), un velo oscuro. Las nubes encima del velo se mueven, así que van
 * aparte, en HTML (ver `cloudHtml`).
 */
function stateSvg(world, walkedTo, fogFrom) {
  let out = '';
  if (walkedTo > 0) {
    const pts = world.route.pts.filter((_, i) => world.route.at[i] <= walkedTo);
    pts.push(routePoint(world.route, walkedTo));
    const d = pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1).map((p, i) => `${i ? 'L' : 'M'}${artN(p.x)} ${artN(p.y)}`).join('');
    out += `<path class="adv-trail-glow" d="${d}"/><path class="adv-trail-walked" d="${d}"/>`;
  }
  if (fogFrom !== null) {
    const at = fogFrom * world.U;
    const veil = world.orient === 'v'
      ? `<rect x="0" y="0" width="${world.W}" height="${artN(world.U - at)}"/>`
      : `<rect x="${artN(at)}" y="0" width="${artN(world.U - at)}" height="${world.H}"/>`;
    out += `<g class="adv-fog">${veil}</g>`;
  }
  return `<svg class="adv-state" viewBox="0 0 ${world.W} ${world.H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${out}</svg>`;
}

/** Una nube que cruza el cielo de una tierra cerrada: tres copos, su sombra abajo. */
const DRIFTER = '<svg viewBox="-150 -80 300 150"><g class="adv-cloud-shade"><circle cx="-52" cy="10" r="52"/><circle cx="18" cy="-8" r="66"/><circle cx="84" cy="16" r="46"/></g>'
  + '<g class="adv-cloud"><circle cx="-58" cy="2" r="47"/><circle cx="12" cy="-16" r="60"/><circle cx="78" cy="8" r="41"/></g></svg>';

/**
 * Las nubes sobre las tierras cerradas, desde `fogFrom` (fracción del viaje), repartidas
 * por tierra: una pared en la entrada, a lo ancho del mapa, donde cada copo es un par
 * —su sombra lavanda y su luz— que respira y se corre un poco de un lado a otro; adentro,
 * nubes enteras que se mecen en su lugar, y por el cielo cruzan despacio otras.
 * HTML animado solo con `transform`, dentro del `.adv-zone` de su tierra: corre solo en
 * la que se ve. Devuelve el HTML de cada tierra.
 */
function cloudHtml(world, fogFrom) {
  const out = world.zones.map(() => ({ shade: '', puff: '', bank: '', sky: '' }));
  if (fogFrom === null) return out.map(() => '');
  const rng = makeRng(0xc10d);
  const vertical = world.orient === 'v';
  const at = fogFrom * world.U;
  const zoneOf = (u) => Math.max(0, world.zones.findIndex((z) => u / world.U <= z.b));
  const cloud = (u, v, r) => {
    const i = zoneOf(u);
    const z = world.zones[i];
    // En coordenadas de su tierra, como la capa viva.
    const x = vertical ? v : u - z.a * world.U;
    const y = vertical ? z.b * world.U - u : v;
    const dur = (10 + rng() * 10).toFixed(1);
    const delay = (-rng() * 20).toFixed(1);
    const dx = (8 + rng() * 22).toFixed(1);
    const vars = `--x:${lifeN(x)};--y:${lifeN(y)};--dx:${dx};--dur:${dur}s;--delay:${delay}s`;
    out[i].shade += `<i style="${vars};--r:${lifeN(r)};--ox:${lifeN(r * 0.12)};--oy:${lifeN(r * 0.16)}"></i>`;
    out[i].puff += `<i style="${vars};--r:${lifeN(r * 0.9)};--ox:${lifeN(-r * 0.04)};--oy:${lifeN(-r * 0.05)}"></i>`;
  };
  // La pared, a lo ancho del mapa en la entrada de la tierra cerrada, y adentro unas
  // nubes sueltas.
  for (let v = -40; v < world.C + 60; v += 64) cloud(at + (rng() - 0.5) * 70, v + (rng() - 0.5) * 30, 58 + rng() * 44);
  // Las sueltas son nubes enteras —tres copos, como las que cruzan— que se mecen en su lugar.
  for (let u = at + 420; u < world.U; u += 220) {
    const v = rng() * world.C;
    const i = zoneOf(u);
    const z = world.zones[i];
    const x = vertical ? v : u - z.a * world.U;
    const y = vertical ? z.b * world.U - u : v;
    out[i].bank += `<span class="adv-puffcloud"${rng() < 0.5 ? ' data-flip="true"' : ''} style="--x:${lifeN(x)};--y:${lifeN(y)};`
      + `--k:${(0.7 + rng() * 0.8).toFixed(2)};--dx:${(10 + rng() * 24).toFixed(1)};--dur:${(12 + rng() * 10).toFixed(1)}s;--delay:${(-rng() * 20).toFixed(1)}s">${DRIFTER}</span>`;
  }
  // Las nubes que cruzan, en las tierras enteras bajo el velo.
  world.zones.forEach((z, i) => {
    if (z.a < fogFrom - 1e-6) return;
    const w = vertical ? world.W : (z.b - z.a) * world.W;
    const h = vertical ? (z.b - z.a) * world.H : world.H;
    for (let j = 0; j < 3; j++) {
      const k = (0.7 + rng() * 0.6).toFixed(2);
      out[i].sky += `<span class="adv-drifter" style="--y:${lifeN(h * (0.08 + rng() * 0.8))};--k:${k};--run:${lifeN(w + 360 * k)};`
        + `--dur:${(55 + rng() * 45).toFixed(1)}s;--delay:${(-rng() * 100).toFixed(1)}s">${DRIFTER}</span>`;
    }
  });
  return out.map((c) => (c.shade || c.bank || c.sky
    ? `<div class="adv-clouds"><div class="adv-cloud-bank">${c.bank}</div><div class="adv-cloud-shade">${c.shade}</div>`
      + `<div class="adv-cloud">${c.puff}</div><div class="adv-cloud-sky">${c.sky}</div></div>`
    : ''));
}

/**
 * Lo que flota en el aire de cada tierra: hojas en el valle, destellos sobre el agua,
 * nieve, brasas en la guarida y papelitos en la arena. Posiciones y tiempos fijos (el
 * HTML sale igual cada vez); solo corre en la tierra que se ve, con `transform` y
 * `opacity`.
 */
function weatherHtml(kind) {
  const n = { glints: 12, snow: 30 }[kind] ?? 16;
  return Array.from({ length: n }, (_, i) => {
    const x = ((i * 37) % 100) + (i % 3) * 0.7;
    const y = ((i * 53) % 90) + 3;
    const delay = -((i * 1.7) % 9).toFixed(1);
    const dur = (7 + (i * 1.3) % 6).toFixed(1);
    const size = 0.6 + ((i * 7) % 5) / 5;
    const hue = (i * 47) % 360;
    return `<i style="--wx:${x}%;--wy:${y}%;--delay:${delay}s;--dur:${dur}s;--size:${size.toFixed(2)};--hue:${hue}"></i>`;
  }).join('');
}

/** Un número de la capa de vida, corto. */
const lifeN = (v) => Math.round(v * 10) / 10;

/** Una mata seca rodando: un ovillo de ramitas en los tres tonos de su tierra. */
const tumbleSvg = ([shadow, mid, light]) => '<svg viewBox="-24 -24 48 48">'
  + `<circle r="19" fill="${shadow}" opacity=".5"/>`
  + `<g fill="none" stroke-linecap="round"><path d="M-17 -4C-12 -18 10 -20 17 -6C22 8 6 20 -8 16C-20 12 -20 -2 -10 -8C0 -14 12 -6 8 4C4 12 -8 8 -6 0" stroke="${mid}" stroke-width="3.4"/>`
  + `<path d="M-14 8C-6 -2 8 -4 16 4M-4 -18C-8 -6 -2 8 4 18M-18 -8C-6 -10 6 -14 12 -16" stroke="${light}" stroke-width="2.8"/>`
  + `<path d="M6 -12C14 -4 12 10 2 14M-16 2C-10 12 2 16 12 12" stroke="${shadow}" stroke-width="2.6"/></g></svg>`;

/**
 * La capa de lo que se mueve en una tierra (ver `worldLife` en `map-world.js`): los
 * árboles y las matas que se mecen con la misma pieza del dibujo, las luces que titilan,
 * los fuegos fatuos, el humo, el agua (la corriente, los anillos, las olas y los
 * brillos), el barco, el viento, las matas secas que ruedan, las sombras de las nubes y
 * la bandada. Cada cosa es un elemento HTML animado con `transform` y `opacity`; el CSS la
 * frena cuando la tierra no se ve (`data-inview`) y cuando el mapa está de fondo.
 */
function lifeInner(world, z) {
  const at = (x, y) => `--x:${lifeN(x)};--y:${lifeN(y)}`;
  const trees = z.sway.map((t) => ({ y: t.y, html: `<span class="adv-sway" style="${at(t.x, t.y)};--k:${t.s.toFixed(3)};--amp:${t.amp};--dur:${t.dur}s;--delay:${t.delay}s">`
    + `<svg viewBox="-150 -280 300 320"><use href="#${t.piece}"${t.flip ? ' transform="scale(-1 1)"' : ''}/></svg></span>` }));
  const ships = z.ships.map((m) => ({ y: m.y, html: `<span class="adv-ship" style="${at(m.x, m.y)};--k:${m.s}">`
    + `<svg viewBox="-260 -300 520 340">${worldMark(world, m.index)}</svg></span>` }));
  const things = [...trees, ...ships].sort((a, b) => a.y - b.y).map((t) => t.html).join('');
  const lights = z.lights.map((l) => `<i class="adv-flame" data-kind="${l.kind}"${l.beat ? ` data-beat="${l.beat}"` : ''} style="${at(l.x, l.y)};--r:${lifeN(l.r)};--dur:${l.dur}s;--delay:${l.delay}s"></i>`).join('');
  const wisps = z.wisps.map((w) => `<i class="adv-wisp" data-kind="${w.kind}" style="${at(w.x, w.y)};--dur:${w.dur}s;--delay:${w.delay}s"></i>`).join('');
  const smoke = z.smoke.map((m) => `<i class="adv-smoke" style="${at(m.x, m.y)};--r:${lifeN(m.r)};--dur:${m.dur}s;--delay:${m.delay}s"></i>`).join('');
  const glints = z.glints.map((g) => `<i class="adv-glint" style="${at(g.x, g.y)};--len:${lifeN(g.len)};--dur:${g.dur}s;--delay:${g.delay}s"></i>`).join('');
  const ripples = z.ripples.map((r) => `<i class="adv-ripple" style="${at(r.x, r.y)};--rx:${lifeN(r.rx)};--ry:${lifeN(r.ry)};${r.foam ? `--foam:${r.foam};` : ''}--dur:${r.dur}s;--delay:${r.delay}s"></i>`).join('');
  const flows = z.flows.map((f) => `<i class="adv-flow" style="${at(f.x, f.y)};--ang:${f.ang}deg;--len:${lifeN(f.len)};--run:${lifeN(f.run)};--foam:${f.foam};--dur:${f.dur}s;--delay:${f.delay}s"></i>`).join('');
  const waves = z.waves.map((w) => `<i class="adv-wave" style="${at(w.x, w.y)};--ang:${w.ang}deg;--len:${lifeN(w.len)};--run:${w.run};--foam:${w.foam};--dur:${w.dur}s;--delay:${w.delay}s"></i>`).join('');
  const gusts = z.gusts.map((g) => `<i class="adv-gust" data-kind="${g.kind}" style="${at(g.x, g.y)};--w:${lifeN(g.w)};--run:${lifeN(g.run)};--dur:${g.dur}s;--delay:${g.delay}s"></i>`).join('');
  const tumbles = z.tumbles.map((t) => `<span class="adv-tumble" style="${at(t.x, t.y)};--r:${lifeN(t.r)};--run:${lifeN(t.run)};--dur:${t.dur}s;--delay:${t.delay}s;--spin:${t.spin}s">`
    + `<i></i><b>${tumbleSvg(t.colors)}</b></span>`).join('');
  const clouds = z.clouds.map((c) => `<i class="adv-shade" style="--y:${lifeN(c.y)};--w:${lifeN(c.w)};--run:${lifeN(z.w + c.w)};--dur:${c.dur}s;--delay:${c.delay}s"></i>`).join('');
  const birds = z.birds.map((b) => `<span class="adv-flock" style="--y:${lifeN(b.y)};--run:${lifeN(z.w + 200)};--dur:${b.dur}s;--delay:${b.delay}s">`
    + '<i></i><i></i><i></i></span>').join('');
  return `${flows}${ripples}${waves}${glints}${tumbles}${things}${lights}${wisps}${smoke}${gusts}<div class="adv-sky">${clouds}${birds}</div>`;
}

/** La capa viva de la tierra `i`, con su contenido o vacía (para llenarla después). */
function lifeHtml(world, z, i, locked, inner = '') {
  const zone = world.zones[i];
  return `<div class="adv-life" data-zone="${i}" data-land="${z.land}"${locked ? ' data-locked="true"' : ''} style="--a:${zone.a.toFixed(5)};--b:${zone.b.toFixed(5)}" aria-hidden="true">${inner}</div>`;
}

/** El ícono de etapa del kit de un nivel: normal, de élite (rival evolucionado) o jefe. */
const stageIcon = (lvl) => `${PVE_UI}/Chapter/icon_stage_${lvl.boss ? 'boss' : lvl.evolved ? 'elite' : 'normal'}.png`;

/** Las nubes de cada tierra con el velo desde `fogFrom`, armadas una vez por progreso. */
function cloudsFor(cache, fogFrom) {
  const key = String(fogFrom);
  if (!cache.clouds.has(key)) cache.clouds.set(key, cloudHtml(cache.world, fogFrom));
  return cache.clouds.get(key);
}

/** Desde dónde va el velo: la entrada de la primera tierra cerrada, o `null`. */
function fogOf(world) {
  const firstLocked = adventureChapters().findIndex((ch) => !isLevelUnlocked(ch.levels[0].id));
  return firstLocked < 0 ? null : world.zones[firstLocked].a;
}

/** Una capa del dibujo de la tierra `c`, en su `<svg>` del tamaño de su tierra. */
function layerSvg(world, c, html) {
  const [x, y, w, h] = worldZoneBox(world, c);
  return `<svg class="adv-art" viewBox="${artN(x)} ${artN(y)} ${artN(w)} ${artN(h)}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${html}</svg>`;
}

/**
 * Lo que va adentro de la tierra `c` cuando se monta: las cuatro capas del dibujo, lo que se
 * mueve, el clima y las nubes, las tierras cuyas piezas usa (sus `<defs>` van aparte, ver
 * `landDefsHtml`) y los rivales de sus niveles abiertos (`[{ level, axie }]`).
 */
export function zoneContent(orient, c) {
  const cache = worldFor(orient);
  const { world } = cache;
  cache.zones[c] ??= worldZoneArt(world, c);
  const art = cache.zones[c];
  const ch = adventureChapters()[c];
  const land = WORLD_LANDS[world.zones[c].land];
  // Los rivales de sus niveles abiertos: el dibujo lo pone quien monta, después de traer
  // las poses de su capítulo (sin ellas no tendría sus gestos).
  const rivals = (ch?.levels ?? []).filter((l) => isLevelUnlocked(l.id)).map((l) => ({ level: l.id, axie: l.rival }));
  return {
    soil: layerSvg(world, c, art.soil),
    ground: layerSvg(world, c, art.ground),
    things: layerSvg(world, c, art.things),
    top: layerSvg(world, c, art.top),
    life: lifeInner(world, cache.life[c]),
    sky: `<div class="adv-weather">${weatherHtml(land.weather)}</div>${cloudsFor(cache, fogOf(world))[c]}`,
    lands: worldZoneLands(world, c),
    chapter: ch?.n ?? c + 1,
    rivals,
  };
}

/** Las piezas de una tierra, en un `<svg>` sin tamaño que solo las define. */
export function landDefsHtml(orient, land) {
  const cache = worldFor(orient);
  if (!cache.lands.has(land)) cache.lands.set(land, worldLandDefs(land));
  return `<svg class="adv-defs" data-land="${land}" width="0" height="0" aria-hidden="true" focusable="false"><defs>${cache.lands.get(land)}</defs></svg>`;
}

/**
 * El mundo entero, en la orientación `orient`. `selected` es el nivel elegido (ahí
 * espera tu Axie, `pick`, y se ve su rival) y `progress`, lo ganado, lo abierto y las
 * estrellas. Con `lazy` las tierras salen vacías, para ir montándolas (ver `zoneContent`);
 * sin él, todo pintado.
 */
export function worldHtml({ selected, pick, progress = getAdventureProgress(), orient = 'h', lazy = false }) {
  const toPlay = levelToPlay(progress);
  const cache = worldFor(orient);
  const { world } = cache;
  cache.defs ??= worldBaseDefs(world);
  const chapters = adventureChapters();
  const starred = progress.starredLevels ?? progress.completedLevels;

  // Andado hasta el nivel abierto más lejano; hasta el final, si ya se ganó el último.
  const open = world.levels.filter((l) => isLevelUnlocked(l.id));
  const walkedTo = progress.completedLevels.includes(world.levels.at(-1)?.id) ? 1 : open.at(-1)?.f ?? 0;
  const fogFrom = fogOf(world);

  const full = lazy ? null : world.zones.map((_, c) => zoneContent(orient, c));
  const lockedAt = (c) => !isLevelUnlocked(chapters[c].levels[0].id);
  // `--fade`: lo que mide la costura adentro de la tierra, donde su clima se apaga.
  const place = (z) => `style="--a:${z.a.toFixed(5)};--b:${z.b.toFixed(5)};--fade:${((100 * world.seam) / ((z.b - z.a) * world.U)).toFixed(2)}%"`;
  const slots = (layer) => {
    const order = world.zones.map((_, c) => c);
    // Parado, las tierras de más arriba (las de después) van detrás de las de abajo.
    if (layer === 'things' && world.orient === 'v') order.reverse();
    return `<div class="adv-layer" data-layer="${layer}">${order.map((c) => `<div class="adv-art-zone" data-zone="${c}" ${place(world.zones[c])}>${full ? full[c][layer] : ''}</div>`).join('')}</div>`;
  };
  const lands = full ? [...new Set(world.zones.map((z) => z.land))].map((l) => landDefsHtml(orient, l)).join('') : '';

  const zones = world.zones.map((z, c) => `<div class="adv-zone" data-zone="${c}" data-chapter="${z.chapter}" data-land="${z.land}" data-weather="${WORLD_LANDS[z.land].weather}"
      ${lockedAt(c) ? 'data-locked="true"' : ''} ${place(z)} aria-hidden="true">${full ? full[c].sky : ''}</div>`).join('');

  const signs = world.signs.map((s, c) => {
    const ch = chapters[c];
    const head = ch.name || tr('Capítulo {n}', { n: ch.n });
    const prevBoss = chapters[c - 1]?.levels.at(-1);
    const lock = isLevelUnlocked(ch.levels[0].id) || !prevBoss ? ''
      : `<span class="adv-sign-lock">${tr('Vencé a {boss} para seguir el viaje', { boss: axie(prevBoss.rival).name })}</span>`;
    return `<div class="adv-sign" data-chapter="${ch.n}" data-side="${s.side}" style="${mapPlace(world, s)}">
      <span class="adv-sign-board o-banner"><small>${tr('Capítulo {n}', { n: ch.n })}</small>${head}</span>${lock}</div>`;
  }).join('');

  const spots = chapters.flatMap((ch, c) => ch.levels.map((lvl) => ({ lvl, c }))).map(({ lvl, c }) => {
    const lv = world.levels.find((l) => l.id === lvl.id);
    const land = WORLD_LANDS[lv.land];
    const unlocked = isLevelUnlocked(lvl.id);
    const done = progress.completedLevels.includes(lvl.id);
    const star = starred.includes(lvl.id);
    const state = done ? 'done' : unlocked ? 'open' : 'locked';
    const kind = lvl.boss ? 'boss' : lvl.evolved ? 'elite' : 'normal';
    const rival = axie(lvl.rival);
    const next = lvl.id === toPlay && !done;
    const label = unlocked
      ? tr('Nivel {n} · {rival}', { n: lvl.id, rival: rival.name })
        + (done ? ` · ${star ? tr('con estrella') : tr('sin estrella')}` : '')
      : tr('Nivel {n}', { n: lvl.id });
    // El rival, con sus dibujos alternativos: se aburre y hace gestos, y un gesto sin sus
    // ojos cerrados o su boca abierta lo deja sin cara. Con `lazy` llega con su tierra.
    const foe = unlocked
      ? `<span class="adv-spot-rival" data-axie="${rival.id}" aria-hidden="true">${full ? axieArt(rival.id) : ''}</span>`
      : '';
    return `<button class="adv-spot" data-adv-level="${lvl.id}" data-state="${state}" data-kind="${kind}"
      aria-pressed="${lvl.id === selected}" ${unlocked ? '' : 'disabled'}${next ? ' data-next="true"' : ''} data-zone="${c}"
      style="${mapPlace(world, lv)};--ahead:${levelSpot(lvl.id, orient).ahead};--plate-a:${land.plate[0]};--plate-b:${land.plate[1]}" aria-label="${label}">
      ${foe}
      <img class="adv-spot-icon" src="${stageIcon(lvl)}" alt="">
      <span class="adv-spot-no">${lvl.id}</span>
      ${done ? `<img class="adv-spot-star" data-earned="${star}" src="${PVE_UI}/Frames/star.png" alt="">` : ''}
      ${next ? `<img class="adv-spot-pointer" src="${KIT_POINTER}" alt="">` : ''}
    </button>`;
  }).join('');

  const here = levelSpot(selected, orient);
  // Con sus dibujos alternativos: respira y hace gestos (ver `mountHero` en `lobby.js`), y
  // un gesto sin sus ojos cerrados o su boca abierta la deja sin cara.
  const hero = here
    ? `<span class="adv-hero" data-face="${here.face}" data-boss="${here.boss}" style="${heroPlace(here)}" aria-hidden="true">${axieArt(pick)}</span>`
    : '';

  const life = cache.life.map((z, i) => lifeHtml(world, z, i, lockedAt(i), full ? full[i].life : '')).join('');

  cache.groundCss ??= worldGroundCss(world);
  return `<div class="adv-map" data-orient="${world.orient}" style="--mw:${world.W};--mh:${world.H};background:${cache.groundCss}">
    <svg class="adv-defs" width="0" height="0" aria-hidden="true" focusable="false"><defs>${cache.defs}</defs></svg>
    <div class="adv-land-defs">${lands}</div>
    ${slots('soil')}${slots('ground')}${slots('things')}${slots('top')}${life}${stateSvg(world, walkedTo, fogFrom)}${zones}
    <div class="adv-board">${signs}${spots}${hero}</div>
  </div>`;
}

/** El índice del capítulo (desde 0) donde está el nivel `id`. */
export function chapterIndexOf(id) {
  return Math.max(0, adventureChapters().findIndex((ch) => ch.levels.some((l) => l.id === Number(id))));
}

/**
 * Para a tu Axie en el nivel `id`: del lado de atrás, mirando al nivel y a su rival (ver
 * `levelSpot`). Devuelve dónde quedó, o `null` si el nivel no existe.
 */
export function placeHero(hero, id, orient = 'h') {
  const spot = levelSpot(id, orient);
  if (!spot || !hero?.style?.setProperty) return null;
  hero.style.setProperty('--x', spot.at.x.toFixed(5));
  hero.style.setProperty('--y', spot.at.y.toFixed(5));
  hero.style.setProperty('--ahead', String(spot.ahead));
  hero.dataset.face = spot.face;
  hero.dataset.boss = String(spot.boss);
  return spot;
}

/** La fracción del camino más cercana al punto `p` (en unidades del mapa), cerca de `around`. */
function nearestF(route, p, around) {
  const reach = 450 / route.length;
  const step = 4 / route.length;
  let best = around;
  let bestD = Infinity;
  for (let f = Math.max(0, around - reach); f <= Math.min(1, around + reach); f += step) {
    const q = routePoint(route, f);
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bestD) { bestD = d; best = f; }
  }
  return best;
}

/**
 * Tu Axie va del nivel `from` al `to`: se para en el nuevo (`placeHero`) y camina hasta
 * allá por el camino, a saltitos. Es un FLIP medido: dónde se ve ahora (a mitad de otra
 * caminata, si la había), dónde pisa en el nuevo nivel, y entre los dos el tramo de
 * camino que los une —sin pasar por encima de los niveles de las puntas—, solo con
 * `transform`. Mide al empezar y nada más. El viaje más largo se hace en dos segundos y
 * medio, con saltos más largos. Devuelve la animación, o `null` si solo se paró (sin
 * navegador que anime, o si se prefiere sin movimiento).
 */
export function walkHero(hero, from, to, orient = hero?.closest?.('.adv-map')?.dataset?.orient ?? 'h') {
  if (!hero?.style) return null;
  const a = levelSpot(from, orient);
  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const moving = Boolean(a) && from !== to && typeof hero.animate === 'function' && !still
    && typeof hero.getBoundingClientRect === 'function';
  const feet = () => {
    const r = hero.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * HERO_FEET };
  };
  // Se mide antes de cortar la caminata anterior: el Axie sale de donde se lo ve.
  const first = moving ? feet() : null;
  hero.walk?.cancel?.();
  const b = placeHero(hero, to, orient);
  const box = hero.parentElement?.getBoundingClientRect?.();
  if (!moving || !b || !box?.width) return null;
  const last = feet();
  const { world } = worldFor(orient);
  // De la pantalla al mapa y vuelta, para saber qué tramo de camino une las dos puntas.
  const toMap = (p) => ({ x: ((p.x - box.left) / box.width) * world.W, y: ((p.y - box.top) / box.height) * world.H });
  const fa = nearestF(world.route, toMap(first), a.f);
  const fb = nearestF(world.route, toMap(last), b.f);
  const n = Math.min(26, Math.max(2, Math.round((Math.abs(fb - fa) * world.route.length) / HERO_HOP)));
  const way = [{ x: first.x - last.x, y: first.y - last.y }];
  for (let i = 1; i < n; i++) {
    const p = routePoint(world.route, fa + ((fb - fa) * i) / n);
    way.push({ x: box.left + (p.x / world.W) * box.width - last.x, y: box.top + (p.y / world.H) * box.height - last.y });
  }
  way.push({ x: 0, y: 0 });
  const hop = Math.max(6, (hero.getBoundingClientRect().height || 60) * 0.14);
  const frames = [];
  way.forEach((p, i) => {
    if (i) {
      const prev = way[i - 1];
      frames.push({ transform: `translate(${artN((prev.x + p.x) / 2)}px, ${artN((prev.y + p.y) / 2 - hop)}px)` });
    }
    frames.push({ transform: `translate(${artN(p.x)}px, ${artN(p.y)}px)` });
  });
  hero.walk = hero.animate(frames, { duration: Math.min(2500, 150 * (way.length - 1)), easing: 'linear' });
  return hero.walk;
}
