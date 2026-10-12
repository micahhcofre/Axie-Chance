// El kit de piezas del mapa de la Aventura, pintado en código.
//
// La referencia son los fondos de pelea de Origins (los mismos escenarios de cada
// capítulo, ver `Backgrounds/stage-*`): pintura mate, sin contornos y sin brillos. La luz
// no es un punto blanco sino un plano entero, cálido (dorado, durazno), y la sombra no es
// el mismo color más oscuro sino otro, frío (lavanda, azul, índigo). Los bordes de las
// luces van en racimos, como pinceladas, y encima unas pinceladas secas de poco contraste.
//
// Cada pieza es una fábrica que devuelve SVG en coordenadas propias: el origen es el
// punto donde la pieza pisa el suelo y para arriba es negativo. La luz viene de arriba a
// la izquierda y la sombra cae abajo a la derecha, suave. Las paletas de cada tierra y
// qué piezas lleva cada una están en `map-world.js`; las fábricas que recortan con
// `clipPath` reciben un `id` único para ese recorte.
//
// Las luces de verdad —farolitos, faroles de papel, braseros, velas, la ventana de la
// casa, el hueco del árbol sagrado, la cara de la calabaza— van dibujadas en la misma
// pieza que las emite y centradas en ella: no hay brillos sueltos.

/** Un número corto para el SVG: un decimal alcanza a esta escala. */
export const artN = (v) => Math.round(v * 10) / 10;

/** Un azar chico y sembrado, para que cada pieza salga siempre igual. */
function artRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}
/** La semilla de una pieza, a partir de su nombre. */
const artSeed = (text) => [...String(text)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

/**
 * Una curva cerrada (o abierta) suave por los puntos: Catmull-Rom pasado a Bézier. Es
 * la forma de todo lo orgánico del mapa: manchas, lagunas, ríos, orillas.
 */
export function artSmooth(pts, closed = true) {
  const n = pts.length;
  if (n < 2) return '';
  const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.min(Math.max(i, 0), n - 1)]);
  let d = `M${artN(pts[0].x)} ${artN(pts[0].y)}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    d += `C${artN(p1.x + (p2.x - p0.x) / 6)} ${artN(p1.y + (p2.y - p0.y) / 6)} `
      + `${artN(p2.x - (p3.x - p1.x) / 6)} ${artN(p2.y - (p3.y - p1.y) / 6)} ${artN(p2.x)} ${artN(p2.y)}`;
  }
  return closed ? `${d}Z` : d;
}

/** Una mancha: un óvalo que tiembla un poco, siempre igual para el mismo `rng`. */
export function artBlob(cx, cy, rx, ry, rng, n = 8, wobble = 0.22) {
  const pts = [];
  const turn = rng() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = turn + (i / n) * Math.PI * 2;
    const k = 1 - wobble / 2 + rng() * wobble;
    pts.push({ x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k });
  }
  return artSmooth(pts);
}

/**
 * Una mancha de borde en racimos —una copa, un golpe de luz sobre las hojas—: un óvalo
 * cuyo borde sube y baja `bumps` veces, girado `turn` radianes.
 */
function artScallop(cx, cy, rx, ry, bumps, depth, turn, rng) {
  const pts = [];
  const n = bumps * 2;
  for (let i = 0; i < n; i++) {
    const a = turn + (i / n) * Math.PI * 2;
    const k = (i % 2 ? 1 - depth : 1) * (0.96 + rng() * 0.08);
    pts.push({ x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k });
  }
  return artSmooth(pts);
}

/** La sombra en el piso: fría y de borde suave (el degradé de cada tierra), abajo a la derecha. */
const artCast = (rx, ry, dx, p) => `<ellipse cx="${dx}" cy="2" rx="${rx}" ry="${ry}" fill="${p.cast}"/>`;

/** Una luz: el degradé del color de quien la emite, centrado en el emisor. */
const artGlow = (x, y, r, kind) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#adv-glow-${kind})"/>`;

/** Los degradés de las luces, uno por color. Van una sola vez en el `<defs>` del mapa. */
export function artGlowDefs() {
  const glows = { warm: '#ffcf80', fire: '#ffa24a', red: '#ff6a4a', teal: '#72f0dc' };
  return Object.entries(glows).map(([id, c]) => `<radialGradient id="adv-glow-${id}">`
    + `<stop offset="0" stop-color="${c}" stop-opacity=".55"/><stop offset=".5" stop-color="${c}" stop-opacity=".18"/>`
    + `<stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`).join('');
}

/**
 * Pinceladas secas: arquitos cortos dentro de la caja `[x0, y0, x1, y1]`, del grosor
 * `w`. Van arriba de una forma para romper el color parejo, con poco contraste.
 */
function artStrokes(rng, box, count, len, w, color, opacity) {
  const [x0, y0, x1, y1] = box;
  let d = '';
  for (let i = 0; i < count; i++) {
    const x = x0 + rng() * (x1 - x0);
    const y = y0 + rng() * (y1 - y0);
    const l = len * (0.6 + rng() * 0.8);
    d += `M${artN(x)} ${artN(y)}q${artN(l / 2)} ${artN(-l * 0.28)} ${artN(l)} 0`;
  }
  return `<path d="${d}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" fill="none" opacity="${opacity}"/>`;
}

/**
 * Una copa redonda hecha de racimos (`lobes`: `[x, y, r]`), pintada: la sombra fría abajo
 * a la derecha de cada racimo, el tono medio encima, un golpe grande de luz cálida arriba
 * a la izquierda con el borde en racimos, y pinceladas. Todo recortado a la copa.
 */
function artCanopy(id, p, lobes) {
  const rng = artRng(artSeed(id));
  const all = (dx, dy, dr) => lobes.map(([x, y, r]) => `<circle cx="${artN(x + dx)}" cy="${artN(y + dy)}" r="${artN(r + dr)}"/>`).join('');
  const xs = lobes.flatMap(([x, , r]) => [x - r, x + r]);
  const ys = lobes.flatMap(([, y, r]) => [y - r, y + r]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = (x1 - x0) / 2;
  const ry = (y1 - y0) / 2;
  const light = artScallop(cx - rx * 0.36, cy - ry * 0.42, rx * 0.86, ry * 0.66, 7, 0.2, -0.5, rng);
  return `<clipPath id="${id}-c">${all(0, 0, 0)}</clipPath>
<g fill="${p.shadow}">${all(0, 0, 0)}</g><g fill="${p.mid}">${all(-3, -5, -4)}</g>
<g clip-path="url(#${id}-c)"><path d="${light}" fill="${p.light}"/>
${artStrokes(rng, [x0 + rx * 0.2, y0 + ry * 0.25, cx + rx * 0.2, cy], 6, rx * 0.26, artN(Math.max(2.5, rx * 0.07)), p.mid, 0.6)}
${artStrokes(rng, [cx - rx * 0.3, cy + ry * 0.1, x1 - rx * 0.15, y1 - ry * 0.15], 5, rx * 0.24, artN(Math.max(2.5, rx * 0.07)), p.shadow, 0.5)}</g>`;
}

/** La nieve sobre los racimos de arriba de una copa: blanca, con el borde de abajo celeste. */
function artSnowCaps(p, lobes) {
  let caps = '';
  for (const [x, y, r] of lobes) {
    const capY = y - r * 0.18;
    const s = (capY - y) / r;
    const a0 = Math.PI + Math.asin(-s);
    const a1 = 2 * Math.PI - Math.asin(-s);
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const a = a0 + ((a1 - a0) * i) / 6;
      pts.push({ x: x + Math.cos(a) * r * 0.98, y: y + Math.sin(a) * r * 0.98 });
    }
    const w = Math.cos(Math.asin(-s)) * r * 0.98;
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      pts.push({ x: x + w - 2 * w * t, y: capY + (i % 2 ? r * 0.16 : r * 0.04) });
    }
    const d = artSmooth(pts);
    caps += `<path d="${d}" fill="${p.snowShade}" transform="translate(2 3)"/><path d="${d}" fill="${p.snow}"/>`;
  }
  return caps;
}

// ---- árboles ---------------------------------------------------------------------

const artTreeLobes = [[0, -84, 44], [-32, -66, 30], [32, -64, 30], [-18, -112, 30], [20, -110, 30], [2, -128, 22]];

/** El tronco de un árbol de copa redonda, con su lado en sombra. */
const artTrunk = (p) => `<path d="M-7 1C-6 -14 -6 -30 -9 -50H9C6 -30 6 -14 7 1Z" fill="${p.trunk}"/>
<path d="M1 1C2 -16 3 -32 4 -50H9C6 -30 6 -14 7 1Z" fill="${p.trunkShadow}"/>`;

/** Un árbol de copa redonda. */
export function artTree(id, p) {
  return `${artCast(58, 14, 26, p)}${artTrunk(p)}${artCanopy(id, p, artTreeLobes)}`;
}

/** Un árbol de hojas naranjas cargado de nieve, como los del Bosque Nevado. */
export function artSnowTree(id, p) {
  const top = artTreeLobes.filter(([, y]) => y < -80);
  return `${artCast(58, 14, 26, p)}${artTrunk(p)}${artCanopy(id, p, artTreeLobes)}${artSnowCaps(p, top)}`;
}

/** Un pino en punta: la sombra entera, el medio y la luz en racimos encima; con `snow`, nevado. */
export function artConifer(id, p, snow = false) {
  const rng = artRng(artSeed(id));
  const S = 'M0 -156C20 -124 33 -80 31 -46C29 -24 16 -14 0 -14C-16 -14 -29 -24 -31 -46C-33 -80 -20 -124 0 -156Z';
  let snowy = '';
  if (snow) {
    // Montoncitos de nieve apoyados en las ramas: una lente, redonda arriba y casi
    // chata abajo, con el borde de abajo celeste.
    for (const [x, y, rx] of [[-6, -124, 10], [-12, -92, 14], [8, -74, 10], [-8, -52, 15]]) {
      const top = rx * 0.62;
      const d = `M${x - rx} ${y}Q${x - rx * 0.2} ${artN(y - top * 1.5)} ${x + rx} ${y}Q${x} ${artN(y + top * 0.35)} ${x - rx} ${y}Z`;
      snowy += `<path d="${d}" fill="${p.snowShade}" transform="translate(1 2.5)"/><path d="${d}" fill="${p.snow}"/>`;
    }
  }
  return `${artCast(36, 9, 14, p)}<rect x="-4" y="-18" width="8" height="19" rx="2" fill="${p.trunk}"/>
<clipPath id="${id}-c"><path d="${S}"/></clipPath><path d="${S}" fill="${p.shadow}"/>
<g clip-path="url(#${id}-c)"><path d="${artScallop(-8, -84, 30, 80, 8, 0.14, 0.3, rng)}" fill="${p.mid}"/>
<path d="${artScallop(-17, -104, 16, 46, 6, 0.18, 0.3, rng)}" fill="${p.light}"/>
${artStrokes(rng, [-22, -140, 14, -30], 9, 12, 3, p.shadow, 0.45)}${snowy}</g>`;
}

/** Una palmera: el tronco con su lado en sombra y las hojas partidas en luz y sombra. */
export function artPalm(id, p) {
  const P = [[-4, 0], [0, -40], [-10, -80], [4, -118]];
  const at = (t) => {
    const u = 1 - t;
    const k = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
    return [0, 1].map((j) => k.reduce((s, c, i) => s + c * P[i][j], 0));
  };
  const rings = [0.16, 0.32, 0.48, 0.64, 0.8].map((t) => {
    const [x, y] = at(t);
    return `M${artN(x - 5)} ${artN(y)}q5 2.5 10 0`;
  }).join('');
  const frond = (angle, flip, lit) => `<g transform="translate(4 -118)${flip ? ' scale(-1 1)' : ''} rotate(${angle})">`
    + `<path d="M0 0C18 -12 40 -12 62 4C42 -3 20 -1 0 0Z" fill="${lit ? p.frondLight : p.frondMid}"/>`
    + `<path d="M0 0C20 -1 42 -3 62 4C42 6 20 5 0 0Z" fill="${p.frondShadow}"/></g>`;
  return `${artCast(48, 11, 34, p)}
<path d="M-4 0C0 -40 -10 -80 4 -118" stroke="${p.trunk}" stroke-width="11" stroke-linecap="round" fill="none"/>
<path d="M0 0C3 -40 -6 -80 7 -116" stroke="${p.trunkShadow}" stroke-width="4" stroke-linecap="round" fill="none"/>
<path d="${rings}" stroke="${p.trunkShadow}" stroke-width="2" fill="none" stroke-linecap="round" opacity=".7"/>
${frond(-48, false, false)}${frond(22, false, false)}${frond(-12, false, false)}${frond(22, true, true)}${frond(-48, true, true)}${frond(-12, true, true)}
<path d="M4 -118C2 -140 6 -156 14 -166C4 -150 6 -134 8 -118Z" fill="${p.frondLight}"/>
<g fill="${p.nut}"><circle cx="-1" cy="-113" r="5"/><circle cx="8" cy="-112" r="5"/><circle cx="4" cy="-119" r="4.5"/></g>`;
}

/** Un árbol seco y retorcido, con el lado de la luz más claro. */
export function artDeadTree(p) {
  return `${artCast(36, 9, 16, p)}
<path d="M-9 0C-7 -20 -12 -44 -6 -66C-3 -78 2 -86 1 -100L7 -99C9 -84 5 -74 6 -62C9 -42 7 -18 10 0Z" fill="${p.bark}"/>
<path d="M2 0C4 -20 2 -44 1 -62C2 -74 6 -84 7 -99C9 -84 5 -74 6 -62C9 -42 7 -18 10 0Z" fill="${p.barkShadow}"/>
<path d="M-3 -52C-14 -58 -22 -60 -30 -72M1 -70C10 -78 18 -80 24 -94M-4 -84C-12 -92 -14 -98 -20 -106M4 -36C12 -40 20 -40 28 -50" stroke="${p.bark}" stroke-width="5" stroke-linecap="round" fill="none"/>
<path d="M-30 -72C-34 -80 -32 -86 -36 -92M24 -94C30 -96 32 -102 36 -106M28 -50C34 -50 38 -54 42 -60M-20 -106C-18 -112 -22 -118 -20 -124" stroke="${p.bark}" stroke-width="2.6" stroke-linecap="round" fill="none"/>
<path d="M-6 -8C-5 -24 -9 -44 -4 -62" stroke="${p.barkLight}" stroke-width="3" stroke-linecap="round" fill="none"/>`;
}

// ---- matas, piedras, pasto -----------------------------------------------------------

/** Una mata redonda; con `berry`, unas bayas apagadas. */
export function artBush(id, p) {
  const lobes = [[0, -22, 20], [-18, -14, 14], [18, -14, 14], [-8, -34, 14], [10, -33, 13]];
  const berries = p.berry ? `<g fill="${p.berry}"><circle cx="-14" cy="-16" r="2.6"/><circle cx="2" cy="-26" r="2.6"/><circle cx="14" cy="-14" r="2.4"/></g>` : '';
  return `${artCast(34, 8, 12, p)}${artCanopy(id, p, lobes)}${berries}`;
}

/** Una mata con espinas, la de la Guarida. */
export function artThorns(id, p) {
  return `${artBush(id, p)}
<path d="M-34 -8l-8 -4 7 -3M-24 -30l-6 -8 8 2M-6 -46l0 -9 5 7M18 -42l6 -7 0 8M34 -20l8 -3 -6 -5" fill="none" stroke="${p.shadow}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
}

/** Un montón de nieve con unas matas naranjas asomando. */
export function artSnowMound(p) {
  return `${artCast(36, 8, 12, p)}
<path d="M-12 -24q-4 -10 -2 -18M-6 -26q2 -12 8 -16M16 -22q2 -10 8 -14" stroke="${p.grass}" stroke-width="3" stroke-linecap="round" fill="none"/>
<path d="M-38 0C-40 -16 -26 -30 -8 -30C4 -38 24 -34 30 -22C40 -18 42 -6 36 0Z" fill="${p.snowShade}"/>
<path d="M-36 -3C-38 -17 -26 -28 -9 -28C3 -35 21 -32 27 -21C31 -16 30 -10 24 -8C10 -12 -18 -8 -36 -3Z" fill="${p.snow}"/>`;
}

/** Una piedra facetada: la cara de arriba con luz cálida, la de la derecha en sombra fría. */
export function artRock(p) {
  const round = 'stroke-linejoin="round" stroke-width="3"';
  return `${artCast(32, 8, 10, p)}
<path d="M-28 0L-32 -14L-21 -29L-2 -34L17 -30L28 -17L26 0Z" fill="${p.mid}" stroke="${p.mid}" ${round}/>
<path d="M-32 -14L-21 -29L-2 -34L17 -30L4 -21L-15 -18Z" fill="${p.cap ?? p.light}" stroke="${p.cap ?? p.light}" ${round}/>
<path d="M17 -30L28 -17L26 0L10 0L8 -16Z" fill="${p.shadow}" stroke="${p.shadow}" ${round}/>
<path d="M-2 -34L4 -21M-15 -18L-17 -5" stroke="${p.shadow}" stroke-width="2" opacity=".45" fill="none" stroke-linecap="round"/>`;
}

/** Una mata de pasto: hojas finas en dos tonos. */
export function artGrass(p) {
  return `${artCast(16, 4, 5, p)}
<path d="M-2 0Q-8 -12 -15 -20Q-6 -12 3 0ZM1 0Q0 -16 3 -28Q4 -14 5 0ZM4 0Q10 -10 17 -16Q9 -8 7 0Z" fill="${p.grass}"/>
<path d="M-6 0Q-10 -8 -18 -11Q-9 -6 -3 0ZM6 0Q8 -8 12 -24Q9 -9 9 0Z" fill="${p.grassShadow ?? p.grass}"/>`;
}

/** Unas florcitas apagadas, sueltas en el pasto. */
export function artFlowers(p) {
  const dot = (x, y, c) => `<circle cx="${x}" cy="${y}" r="3.2" fill="${c}"/><circle cx="${x + 0.6}" cy="${y + 0.8}" r="1.2" fill="${p.core}"/>`;
  return `<path d="M-14 0q-6 -8 2 -10q3 6 -2 10ZM9 1q8 -5 11 2q-7 3 -11 -2Z" fill="${p.leaf}"/>
${dot(-10, -7, p.petal)}${dot(2, -12, p.petal2)}${dot(12, -5, p.petal)}${dot(-3, -3, p.petal2)}`;
}

/** Hongos de sombrero con lunares, uno grande y uno chico. */
export function artMushrooms(p) {
  const one = `<path d="M-5 0C-6 -8 -5 -15 -4 -19H4C5 -15 6 -8 5 0Z" fill="${p.stem}"/>
<path d="M-17 -17C-17 -33 17 -33 17 -17C9 -13 -9 -13 -17 -17Z" fill="${p.cap}"/>
<path d="M4 -30C12 -28 17 -23 17 -17C12 -15 8 -14 2 -14C6 -19 7 -25 4 -30Z" fill="${p.capShadow}"/>
<g fill="${p.dots}"><circle cx="-8" cy="-24" r="2.6"/><circle cx="2" cy="-27" r="2.1"/><circle cx="10" cy="-20" r="1.9"/></g>`;
  return `${artCast(22, 5, 6, p)}${one}<g transform="translate(16 3) scale(.62)">${one}</g>`;
}

/** Un tótem tallado de piedra, como los del valle de otoño, con su cara y su franja blanca. */
function artTotemShape(p, x, y, h, w) {
  const top = y - h;
  const fy = y - h * 0.64;
  const my = fy + w * 0.5;
  let teeth = '';
  for (let i = 0; i < 4; i++) {
    const tx = x - w * 0.5 + (i * w) / 3;
    teeth += `M${artN(tx)} ${artN(my)}l${artN(w / 6)} ${artN(w * 0.18)} ${artN(w / 6)} ${artN(-w * 0.18)}`;
  }
  let zig = '';
  const zy = y - h * 0.2;
  for (let i = 0; i <= 5; i++) zig += `${i ? 'L' : 'M'}${artN(x - w + (i * 2 * w) / 5)} ${artN(zy + (i % 2 ? -w * 0.18 : w * 0.1))}`;
  return `<path d="M${x - w} ${y}V${artN(top + w)}Q${x - w} ${top} ${x} ${top}Q${x + w} ${top} ${x + w} ${artN(top + w)}V${y}Z" fill="${p.mid}"/>
<path d="M${x - w} ${y}V${artN(top + w)}Q${x - w} ${top} ${x} ${top}Q${artN(x - w * 0.4)} ${artN(top + w * 0.3)} ${artN(x - w * 0.45)} ${artN(top + w * 1.2)}V${y}Z" fill="${p.light}"/>
<path d="M${artN(x + w * 0.45)} ${y}V${artN(top + w * 1.1)}Q${artN(x + w * 0.5)} ${artN(top + w * 0.3)} ${x} ${top}Q${x + w} ${top} ${x + w} ${artN(top + w)}V${y}Z" fill="${p.shadow}"/>
<path d="${zig}" stroke="${p.stripe}" stroke-width="${artN(w * 0.2)}" stroke-linejoin="round" fill="none"/>
<g fill="${p.carve}"><rect x="${artN(x - w * 0.62)}" y="${artN(fy - w * 0.14)}" width="${artN(w * 0.46)}" height="${artN(w * 0.3)}" rx="${artN(w * 0.1)}"/>
<rect x="${artN(x + w * 0.16)}" y="${artN(fy - w * 0.14)}" width="${artN(w * 0.46)}" height="${artN(w * 0.3)}" rx="${artN(w * 0.1)}"/>
<rect x="${artN(x - w * 0.62)}" y="${artN(my - w * 0.08)}" width="${artN(w * 1.24)}" height="${artN(w * 0.34)}" rx="${artN(w * 0.08)}"/></g>
<path d="${teeth}" stroke="${p.stripe}" stroke-width="${artN(Math.max(1.5, w * 0.08))}" fill="none" stroke-linejoin="round"/>
<path d="M${artN(x - w * 0.8)} ${artN(fy - w * 0.36)}L${artN(x - w * 0.12)} ${artN(fy - w * 0.22)}M${artN(x + w * 0.8)} ${artN(fy - w * 0.36)}L${artN(x + w * 0.12)} ${artN(fy - w * 0.22)}" stroke="${p.carve}" stroke-width="${artN(w * 0.14)}" stroke-linecap="round"/>
<path d="M${artN(x - w * 0.7)} ${artN(top + w * 0.3)}q${artN(w * 0.3)} ${artN(-w * 0.5)} ${artN(w * 0.7)} ${artN(-w * 0.2)}q${artN(w * 0.3)} ${artN(-w * 0.3)} ${artN(w * 0.7)} ${artN(w * 0.1)}" stroke="${p.moss}" stroke-width="${artN(w * 0.28)}" stroke-linecap="round" fill="none"/>`;
}

/** Un tótem chico suelto en el pasto. */
export function artTotem(p) {
  return `${artCast(30, 8, 14, p)}${artTotemShape(p, 0, 0, 64, 14)}`;
}

/** Un farolito de piedra; con `snow`, con nieve en el techo. La luz sale de su ventana. */
export function artLantern(p, snow = false) {
  return `${artCast(18, 5, 8, p)}${artGlow(0, -40, 30, 'warm')}
<rect x="-10" y="-6" width="20" height="6" rx="1.5" fill="${p.shadow}"/><rect x="-4" y="-27" width="8" height="21" fill="${p.mid}"/><rect x="0" y="-27" width="4" height="21" fill="${p.shadow}"/>
<rect x="-11" y="-33" width="22" height="6" rx="1.5" fill="${p.shadow}"/><rect x="-8" y="-47" width="16" height="14" rx="2" fill="${p.mid}"/>
<rect x="-4" y="-44" width="8" height="8" rx="1" fill="${p.window}"/><path d="M-15 -47L0 -57L15 -47Z" fill="${p.shadow}"/><path d="M-15 -47L0 -57L0 -47Z" fill="${p.light}"/>
${snow ? `<path d="M-16 -48C-12 -54 -4 -60 0 -60C6 -58 12 -54 16 -48C10 -50 -8 -50 -16 -48Z" fill="${p.snow}"/>` : ''}`;
}

/** Un farol de papel rojo colgado de su palo, como los de la Guarida. La luz sale del farol. */
export function artPaperLantern(p) {
  return `${artCast(16, 5, 10, p)}${artGlow(12, -52, 40, 'red')}
<path d="M0 0V-72H16" stroke="${p.post}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M12 -72V-66" stroke="${p.post}" stroke-width="1.6"/>
<ellipse cx="12" cy="-52" rx="10" ry="14" fill="${p.paper}"/><path d="M12 -66C18 -62 22 -56 22 -52C22 -46 18 -41 12 -38C16 -44 17 -58 12 -66Z" fill="${p.paperShadow}"/>
<path d="M2 -52h20M4 -60h16M4 -44h16" stroke="${p.band}" stroke-width="1.4" opacity=".8"/><rect x="8" y="-67" width="8" height="3" rx="1" fill="${p.post}"/><rect x="8" y="-39" width="8" height="3" rx="1" fill="${p.post}"/>`;
}

/** Un gatito de la suerte de piedra, con la pata en alto: los hay en el santuario de la Guarida. */
export function artCat(p) {
  return `${artCast(18, 5, 6, p)}
<path d="M-13 0C-15 -12 -12 -22 -7 -26H7C12 -22 15 -12 13 0Z" fill="${p.body}"/><path d="M2 -26H7C12 -22 15 -12 13 0H4C8 -8 8 -18 2 -26Z" fill="${p.shade}"/>
<circle cx="0" cy="-32" r="11" fill="${p.body}"/><path d="M4 -42C10 -40 12 -34 11 -30C9 -24 4 -22 0 -21C6 -26 7 -36 4 -42Z" fill="${p.shade}"/>
<path d="M-10 -38L-9 -47L-3 -42ZM10 -38L9 -47L3 -42Z" fill="${p.body}"/><path d="M-8.5 -40L-8 -44L-5 -42ZM8.5 -40L8 -44L5 -42Z" fill="${p.ear}"/>
<path d="M-6 -33q2 -2 4 0M2 -33q2 -2 4 0M-2 -28q2 1.5 4 0" stroke="${p.ink}" stroke-width="1.4" fill="none" stroke-linecap="round"/>
<g fill="${p.ear}" opacity=".7"><circle cx="-7" cy="-29" r="2"/><circle cx="7" cy="-29" r="2"/></g>
<path d="M-10 -22H10" stroke="${p.collar}" stroke-width="3"/><circle cx="0" cy="-19" r="2.4" fill="${p.bell}"/>
<path d="M-12 -22C-18 -26 -18 -34 -14 -36C-11 -34 -10 -28 -9 -24Z" fill="${p.body}"/>`;
}

/** Una vasija de barro oscuro. */
export function artVase(p) {
  return `${artCast(16, 4, 6, p)}
<path d="M-8 0C-14 -6 -15 -20 -9 -28C-7 -31 -7 -34 -6 -36H6C7 -34 7 -31 9 -28C15 -20 14 -6 8 0Z" fill="${p.mid}"/>
<path d="M-8 0C-14 -6 -15 -20 -9 -28C-7 -31 -7 -34 -6 -36H-2C-6 -26 -8 -12 -3 0Z" fill="${p.light}"/>
<path d="M3 -36H6C7 -34 7 -31 9 -28C15 -20 14 -6 8 0H3C8 -10 8 -24 3 -36Z" fill="${p.shadow}"/><ellipse cx="0" cy="-36" rx="6" ry="2" fill="${p.ink}"/>`;
}

/** Tres velas encendidas. La luz sale de las llamas. */
export function artCandles(p) {
  const candle = (x, h) => `<rect x="${x - 3}" y="${-h}" width="6" height="${h}" rx="1.5" fill="${p.wax}"/><rect x="${x}" y="${-h}" width="3" height="${h}" fill="${p.waxShadow}"/>
<path d="M${x} ${-h - 2}C${x - 3} ${-h - 6} ${x - 1} ${-h - 10} ${x} ${-h - 13}C${x + 2} ${-h - 9} ${x + 3} ${-h - 6} ${x} ${-h - 2}Z" fill="${p.flame}"/>`;
  return `${artCast(18, 4, 6, p)}${artGlow(0, -20, 34, 'fire')}${candle(-8, 16)}${candle(2, 22)}${candle(10, 12)}`;
}

/** Pasto de playa, unas hojas finas que se abren. */
export function artBeachGrass(p) {
  return artGrass(p);
}

/** Una concha y una estrella de mar. */
export function artShells(p) {
  let star = '';
  for (let i = 0; i < 10; i++) {
    const a = ((i * 36 - 90) * Math.PI) / 180;
    const r = i % 2 ? 4.5 : 11;
    star += `${i ? 'L' : 'M'}${artN(18 + Math.cos(a) * r)} ${artN(-6 + Math.sin(a) * r)}`;
  }
  return `<path d="M-9 0C-10 -8 -5 -14 0 -14C5 -14 10 -8 9 0Q0 3 -9 0Z" fill="${p.shell}"/>
<path d="M0 -14C5 -14 10 -8 9 0Q4 2 1 1C4 -4 3 -10 0 -14Z" fill="${p.shellShadow}"/>
<path d="${star}Z" fill="${p.star}" stroke="${p.star}" stroke-width="3" stroke-linejoin="round"/>
<path d="M18 -6l6 6M18 -6l7 -5" stroke="${p.starShadow}" stroke-width="2.4" stroke-linecap="round"/>`;
}

/** Un cajón y un barril, lo que dejan los piratas en la playa. */
export function artCargo(p) {
  return `${artCast(34, 7, 12, p)}
<path d="M-24 0V-24L-18 -30H6L0 -24V0Z" fill="${p.wood}"/><path d="M0 -24L6 -30V-6L0 0Z" fill="${p.woodShadow}"/><path d="M-24 -24L-18 -30H6L0 -24Z" fill="${p.woodLight}"/>
<path d="M-24 0L0 -24M-24 -24L0 0" stroke="${p.woodShadow}" stroke-width="2" opacity=".5"/>
<ellipse cx="20" cy="-30" rx="12" ry="4.5" fill="${p.woodLight}"/><path d="M8 -30C6 -20 6 -8 8 0H32C34 -8 34 -20 32 -30Z" fill="${p.wood}"/><path d="M22 -30V0H32C34 -8 34 -20 32 -30Z" fill="${p.woodShadow}"/>
<path d="M7 -22H33M7 -8H33" stroke="${p.hoop}" stroke-width="3"/>`;
}

// ---- el coliseo --------------------------------------------------------------------

/** Una columna de piedra; `broken`, partida con un tambor caído al lado. */
export function artColumn(p, broken = false) {
  if (broken) {
    return `${artCast(34, 8, 18, p)}
<rect x="-17" y="-9" width="34" height="9" rx="1.5" fill="${p.shadow}"/><rect x="-17" y="-9" width="16" height="9" rx="1.5" fill="${p.mid}"/>
<path d="M-12 -8V-56L-6 -62L0 -54L6 -64L12 -58V-8Z" fill="${p.mid}"/><path d="M-12 -8V-56L-6 -62L-4 -59V-8Z" fill="${p.light}"/><path d="M4 -8V-62L6 -64L12 -58V-8Z" fill="${p.shadow}"/>
<g transform="translate(30 -2) rotate(-8)"><rect x="-13" y="-10" width="26" height="12" rx="2" fill="${p.mid}"/><rect x="-13" y="-10" width="26" height="4" rx="2" fill="${p.light}"/><ellipse cx="13" cy="-4" rx="3" ry="6" fill="${p.shadow}"/></g>`;
  }
  return `${artCast(26, 7, 14, p)}
<rect x="-17" y="-9" width="34" height="9" rx="1.5" fill="${p.shadow}"/><rect x="-17" y="-9" width="16" height="9" rx="1.5" fill="${p.mid}"/>
<rect x="-12" y="-94" width="24" height="86" fill="${p.mid}"/><rect x="-12" y="-94" width="7" height="86" fill="${p.light}"/><rect x="4" y="-94" width="8" height="86" fill="${p.shadow}"/>
<path d="M-1 -92V-10M5 -92V-10" stroke="${p.shadow}" stroke-width="1.4" opacity=".35"/>
<rect x="-16" y="-101" width="32" height="8" rx="1.5" fill="${p.mid}"/><rect x="-19" y="-107" width="38" height="7" rx="1.5" fill="${p.light}"/><rect x="4" y="-107" width="15" height="14" rx="1.5" fill="${p.shadow}" opacity=".7"/>`;
}

/** Un cactus de brazos redondos, con sus pintitas. */
export function artCactus(p) {
  return `${artCast(28, 7, 12, p)}
<path d="M-10 -28C-22 -28 -27 -36 -26 -48C-25 -55 -18 -55 -17 -48C-17 -40 -15 -36 -10 -36Z" fill="${p.light}"/>
<path d="M10 -40C21 -40 25 -48 24 -60C23 -67 16 -67 15 -60C15 -52 14 -48 10 -48Z" fill="${p.shadow}"/>
<path d="M-11 0C-13 -24 -12 -54 0 -64C12 -54 13 -24 11 0Z" fill="${p.mid}"/>
<path d="M-11 0C-13 -24 -12 -54 0 -64C-5 -52 -6 -24 -4 0Z" fill="${p.light}"/><path d="M0 -64C12 -54 13 -24 11 0H3C6 -24 6 -48 0 -64Z" fill="${p.shadow}"/>
<g fill="${p.dots}"><circle cx="-5" cy="-44" r="1.5"/><circle cx="-6" cy="-24" r="1.5"/><circle cx="4" cy="-34" r="1.5"/><circle cx="5" cy="-14" r="1.5"/><circle cx="-21" cy="-44" r="1.3"/><circle cx="19" cy="-56" r="1.3"/></g>`;
}

/** Una mata seca, enredada. */
export function artDryBush(p) {
  return `${artCast(22, 5, 8, p)}
<path d="M-18 0C-24 -14 -12 -26 0 -24C12 -26 24 -14 18 0Z" fill="${p.shadow}" opacity=".35"/>
<path d="M-16 0C-18 -10 -10 -20 -2 -20M-8 0C-6 -12 2 -20 10 -18M2 0C6 -10 14 -14 18 -6" stroke="${p.mid}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
<path d="M-14 -12C-6 -8 4 -10 12 -16M-12 -4C-4 -2 6 -4 14 -8" stroke="${p.light}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
}

/** Un ánfora de barro con su franja. */
export function artAmphora(p) {
  return `${artCast(16, 4, 6, p)}
<path d="M-7 0C-13 -6 -13 -19 -8 -26C-6 -30 -6 -34 -5 -37H5C6 -34 6 -30 8 -26C13 -19 13 -6 7 0Z" fill="${p.clay}"/>
<path d="M2 -37H5C6 -34 6 -30 8 -26C13 -19 13 -6 7 0H2C6 -8 7 -22 2 -37Z" fill="${p.clayShadow}"/>
<path d="M-5 -34C-11 -34 -11 -26 -8 -24M5 -34C11 -34 11 -26 8 -24" stroke="${p.clayShadow}" stroke-width="2" fill="none"/>
<path d="M-11 -16H11" stroke="${p.band}" stroke-width="3"/><rect x="-6" y="-39" width="12" height="3" rx="1" fill="${p.clayShadow}"/>`;
}

/** Un estandarte rojo en su palo. */
export function artBanner(p) {
  return `${artCast(16, 4, 10, p)}
<rect x="-2" y="-92" width="4" height="92" fill="${p.pole}"/><circle cx="0" cy="-94" r="4" fill="${p.gold}"/>
<path d="M2 -86H32V-48L17 -56L2 -48Z" fill="${p.cloth}"/><path d="M20 -86H32V-48L20 -54Z" fill="${p.clothShadow}"/><path d="M2 -82H32" stroke="${p.gold}" stroke-width="2.5"/>
<circle cx="17" cy="-68" r="6" fill="none" stroke="${p.gold}" stroke-width="2"/>`;
}

/** Una lanza clavada en la arena, con su cinta: quedan después de cada pelea. */
export function artSpear(p) {
  return `${artCast(20, 4, 12, p)}
<path d="M-2 0L14 -86" stroke="${p.shaft}" stroke-width="4" stroke-linecap="round"/>
<path d="M14 -86L10 -100L20 -110L22 -94Z" fill="${p.head}"/><path d="M20 -110L22 -94L14 -86Z" fill="${p.headShadow}"/>
<path d="M13 -80C18 -76 22 -70 20 -62M13 -80C9 -74 8 -68 12 -62" stroke="${p.ribbon}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
}

/** Un brasero de piedra con su fuego. La luz sale de la llama. */
export function artBrazier(p) {
  return `${artCast(20, 5, 8, p)}${artGlow(0, -40, 50, 'fire')}
<path d="M-10 0L-4 -24M10 0L4 -24M0 0V-24" stroke="${p.metal}" stroke-width="3" stroke-linecap="round"/>
<path d="M-16 -28C-14 -20 14 -20 16 -28Z" fill="${p.stone}"/><path d="M-16 -28H16" stroke="${p.stoneShadow}" stroke-width="3" stroke-linecap="round"/>
<path d="M-11 -29C-13 -38 -6 -44 -4 -52C-1 -44 2 -48 3 -58C9 -48 13 -38 11 -29Z" fill="${p.flame}"/>
<path d="M-5 -29C-6 -35 -2 -38 -1 -44C2 -38 5 -36 5 -29Z" fill="${p.flameCore}"/>`;
}

// ---- puentes y muelle ---------------------------------------------------------------

/**
 * Un puente a lo largo de +x, centrado en el origen: `len` de largo y `wide` de ancho.
 * `stone` es de piedra; si no, de tablones.
 */
export function artBridge(p, len, wide, stone = false) {
  const x0 = -len / 2;
  const y0 = -wide / 2;
  if (stone) {
    let blocks = '';
    for (let x = x0 + 18; x < -x0 - 4; x += 18) blocks += `M${artN(x)} ${artN(y0 + 6)}V${artN(-y0 - 6)}`;
    return `<rect x="${artN(x0 - 4)}" y="${artN(y0 + 4)}" width="${artN(len + 8)}" height="${artN(wide)}" rx="6" fill="${p.cast}" opacity=".5"/>
<rect x="${artN(x0)}" y="${artN(y0)}" width="${artN(len)}" height="${artN(wide)}" rx="6" fill="${p.deck}"/>
<path d="${blocks}" stroke="${p.line}" stroke-width="2" opacity=".5"/>
<path d="M${artN(x0)} ${artN(y0 + 3)}H${artN(-x0)}" stroke="${p.wallLight}" stroke-width="9" stroke-linecap="round"/>
<path d="M${artN(x0)} ${artN(-y0 - 3)}H${artN(-x0)}" stroke="${p.wall}" stroke-width="9" stroke-linecap="round"/>`;
  }
  let planks = '';
  for (let x = x0 + 12; x < -x0 - 2; x += 12) planks += `M${artN(x)} ${artN(y0 + 2)}V${artN(-y0 - 2)}`;
  const posts = [x0 + 6, 0, -x0 - 6].map((x) => `<rect x="${artN(x - 4)}" y="${artN(y0 - 3)}" width="8" height="8" rx="2"/><rect x="${artN(x - 4)}" y="${artN(-y0 - 5)}" width="8" height="8" rx="2"/>`).join('');
  return `<rect x="${artN(x0 - 4)}" y="${artN(y0 + 5)}" width="${artN(len + 8)}" height="${artN(wide)}" rx="4" fill="${p.cast}" opacity=".45"/>
<rect x="${artN(x0)}" y="${artN(y0)}" width="${artN(len)}" height="${artN(wide)}" rx="4" fill="${p.deck}"/>
<rect x="${artN(x0)}" y="${artN(y0)}" width="${artN(len)}" height="${artN(wide * 0.4)}" rx="4" fill="${p.deckLight}"/>
<path d="${planks}" stroke="${p.line}" stroke-width="2" opacity=".55"/>
<path d="M${artN(x0)} ${artN(y0 + 1)}H${artN(-x0)}" stroke="${p.railLight}" stroke-width="5.5" stroke-linecap="round"/>
<path d="M${artN(x0)} ${artN(-y0 - 1)}H${artN(-x0)}" stroke="${p.rail}" stroke-width="5.5" stroke-linecap="round"/>
<g fill="${p.post}">${posts}</g>`;
}

/** Un muelle de tablones a lo largo de +x, desde el origen. */
export function artDock(p, len) {
  let planks = '';
  for (let x = 10; x < len; x += 11) planks += `M${artN(x)} -15V15`;
  const posts = [];
  for (let x = 14; x < len; x += 44) posts.push(`<circle cx="${artN(x)}" cy="-19" r="5"/><circle cx="${artN(x)}" cy="19" r="5"/>`);
  return `<rect x="4" y="-12" width="${artN(len)}" height="34" rx="3" fill="${p.cast}" opacity=".35"/>
<rect x="0" y="-17" width="${artN(len)}" height="34" rx="3" fill="${p.deck}"/><rect x="0" y="-17" width="${artN(len)}" height="12" rx="3" fill="${p.deckLight}"/>
<path d="${planks}" stroke="${p.line}" stroke-width="2" opacity=".55"/><g fill="${p.post}">${posts.join('')}</g>`;
}

// ---- piezas de las tierras de los capítulos 6 a 20 --------------------------------------

/** Una punta de cristal facetada: la cara de la luz cálida a la izquierda, la fría a la derecha. */
const artShard = (p, x, h, w, lean = 0) => {
  const t = x + lean;
  const L = artN(x - w);
  const R = artN(x + w);
  const sh = artN(-h * 0.68);
  return `<path d="M${L} 0L${artN(x - w * 0.9)} ${sh}L${artN(t)} ${artN(-h)}L${artN(x + w * 0.9)} ${sh}L${R} 0Z" fill="${p.mid}"/>`
    + `<path d="M${artN(x - w * 0.9)} ${sh}L${artN(t)} ${artN(-h)}L${artN(x - w * 0.05)} ${artN(-h * 0.6)}L${artN(x - w * 0.25)} 0L${L} 0Z" fill="${p.light}"/>`
    + `<path d="M${artN(t)} ${artN(-h)}L${artN(x + w * 0.9)} ${sh}L${R} 0L${artN(x + w * 0.35)} 0L${artN(x - w * 0.05)} ${artN(-h * 0.6)}Z" fill="${p.shadow}"/>`;
};

/** Un racimo de cristales: tres puntas, la del medio más alta. */
export function artCrystal(p) {
  return `${artCast(30, 7, 8, p)}${artShard(p, -13, 28, 7, -5)}${artShard(p, 12, 22, 6, 4)}${artShard(p, 0, 44, 9)}`;
}

/** Un engranaje parado, medio enterrado: los dientes, la cara con su luz y el agujero. */
export function artGear(p) {
  let teeth = '';
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * 360;
    teeth += `<rect x="-5" y="-40" width="10" height="12" rx="2" transform="translate(0 -26) rotate(${a}) translate(0 12)"/>`;
  }
  return `${artCast(36, 8, 12, p)}<g fill="${p.mid}">${teeth}</g>
<circle cx="0" cy="-26" r="26" fill="${p.mid}"/>
<path d="M-24 -32A26 26 0 0 1 8 -51C-8 -46 -18 -38 -24 -24Z" fill="${p.light}"/>
<path d="M22 -12A26 26 0 0 1 -6 0C10 -4 18 -12 24 -26Z" fill="${p.shadow}"/>
<circle cx="0" cy="-26" r="9" fill="${p.hole ?? p.shadow}"/><circle cx="2" cy="-24" r="4" fill="${p.light}" opacity=".35"/>
<path d="M-30 2H30" stroke="${p.cast}" stroke-width="6" stroke-linecap="round" opacity=".6"/>`;
}

/** Un regalo envuelto, con su moño. */
export function artGift(p) {
  return `${artCast(24, 6, 8, p)}
<path d="M-16 0V-22H10V0Z" fill="${p.mid}"/><path d="M10 0V-22L18 -27V-5Z" fill="${p.shadow}"/>
<path d="M-16 -22L-8 -27H18L10 -22Z" fill="${p.light}"/>
<path d="M-4 0V-22M-4 -22L4 -27" stroke="${p.ribbon}" stroke-width="5"/><path d="M14 -24V-3" stroke="${p.ribbon}" stroke-width="4" opacity=".8"/>
<path d="M0 -25C-8 -34 -14 -30 -8 -25C-14 -22 -6 -20 0 -25C6 -20 12 -22 8 -26C14 -31 6 -34 0 -25Z" fill="${p.ribbon}"/>`;
}

/** Una pelota de playa en la arena. */
export function artBall(p) {
  return `${artCast(16, 4, 6, p)}
<circle cx="0" cy="-12" r="12" fill="${p.a}"/>
<path d="M0 -24C-8 -18 -8 -6 0 0C-6 -1 -12 -6 -12 -12C-12 -18 -6 -23 0 -24Z" fill="${p.b}"/>
<path d="M0 -24C8 -18 8 -6 0 0C6 -1 12 -6 12 -12C12 -18 6 -23 0 -24Z" fill="${p.c}"/>
<path d="M4 -1A12 12 0 0 0 12 -12C10 -6 7 -3 4 -1Z" fill="#000" opacity=".15"/>
<circle cx="-5" cy="-17" r="3" fill="#fff" opacity=".55"/>`;
}

/** Juncos de la orilla: tallos finos con sus espigas marrones. */
export function artReeds(p) {
  const one = (x, h, bend) => `<path d="M${x} 0Q${x + bend} ${-h * 0.5} ${x + bend * 1.4} ${-h}" stroke="${p.stem}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
    + `<rect x="${artN(x + bend * 1.4 - 3)}" y="${-h - 4}" width="6" height="15" rx="3" fill="${p.head}"/>`;
  return `${artCast(18, 4, 4, p)}${one(-8, 40, -4)}${one(0, 52, 2)}${one(8, 36, 5)}
<path d="M-12 0Q-16 -12 -20 -18M12 0Q16 -10 22 -14" stroke="${p.leaf}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
}

/** Un nenúfar sobre su hoja redonda, bajito. */
export function artLily(p) {
  return `<ellipse cx="0" cy="-2" rx="18" ry="7" fill="${p.pad}"/><path d="M0 -2L16 -6A18 7 0 0 1 18 -2Z" fill="${p.padShadow}"/>
<path d="M-6 -6C-8 -14 -2 -16 0 -10C2 -16 8 -14 6 -6C2 -4 -2 -4 -6 -6Z" fill="${p.petal}"/>
<path d="M0 -10C2 -16 8 -14 6 -6C4 -5 2 -5 1 -5Z" fill="${p.petalShadow}"/>
<circle cx="0" cy="-7" r="1.8" fill="${p.core}"/>`;
}

/** Una nube bajita, apoyada en el suelo de las tierras del cielo. */
export function artCloud(p) {
  return `<ellipse cx="6" cy="2" rx="34" ry="7" fill="${p.cast}"/>
<g fill="${p.shadow}"><circle cx="-16" cy="-12" r="14"/><circle cx="4" cy="-18" r="18"/><circle cx="22" cy="-10" r="12"/></g>
<g fill="${p.light}"><circle cx="-18" cy="-15" r="11"/><circle cx="1" cy="-22" r="14"/><circle cx="19" cy="-13" r="8"/></g>`;
}

// ---- hitos --------------------------------------------------------------------------

/** Los tótems del valle de otoño, donde espera el Shogun: tres caras de piedra en el pasto. */
export function artTotems(p) {
  return `<ellipse cx="40" cy="8" rx="200" ry="30" fill="${p.cast}"/>
${artTotemShape(p, -112, 14, 110, 26)}${artTotemShape(p, 104, 18, 140, 30)}${artTotemShape(p, 0, 0, 210, 38)}
<g transform="translate(-160 22)">${artRock(p)}</g><g transform="translate(60 26) scale(.7)">${artRock(p)}</g><g transform="translate(160 24) scale(.8)">${artRock(p)}</g>
<path d="M-60 12q-4 -12 -10 -18M-56 12q0 -14 4 -20M30 20q-4 -12 -10 -16M36 20q2 -12 8 -16M-150 26q-2 -10 -8 -14" stroke="${p.moss}" stroke-width="4" stroke-linecap="round" fill="none"/>`;
}

/** El barco de los piratas, fondeado en la bahía de la Costa. Su base es la línea del agua. */
export function artShip(p) {
  return `<ellipse cx="10" cy="8" rx="176" ry="18" fill="${p.deep}" opacity=".45"/>
<path d="M150 -48L214 -80" stroke="${p.woodShadow}" stroke-width="6" stroke-linecap="round"/>
<path d="M-36 -228L-150 -50M-36 -228L150 -48M64 -198L214 -80M64 -198L-40 -48" stroke="${p.rope}" stroke-width="1.5" opacity=".6"/>
<rect x="-40" y="-232" width="8" height="186" fill="${p.woodShadow}"/><rect x="60" y="-202" width="7" height="156" fill="${p.woodShadow}"/>
<rect x="-50" y="-206" width="28" height="9" rx="2" fill="${p.wood}"/>
<path d="M-100 -192C-70 -200 -2 -200 26 -192C22 -158 22 -126 26 -96C-2 -90 -70 -90 -100 -96C-94 -126 -94 -158 -100 -192Z" fill="${p.sail}"/>
<path d="M-36 -197C-10 -198 12 -196 26 -192C22 -158 22 -126 26 -96C12 -92 -10 -91 -36 -91C-26 -126 -26 -160 -36 -197Z" fill="${p.sailShadow}"/>
<path d="M-70 -150h18v16h-18Z" fill="${p.sailShadow}"/>
<path d="M32 -176C52 -182 88 -182 104 -176C100 -148 100 -124 104 -102C86 -98 52 -98 32 -102C36 -124 36 -148 32 -176Z" fill="${p.sail}"/>
<path d="M68 -180C82 -181 96 -179 104 -176C100 -148 100 -124 104 -102C96 -100 82 -99 68 -99C74 -124 74 -150 68 -180Z" fill="${p.sailShadow}"/>
<path d="M-32 -232H10L2 -219L10 -206H-32Z" fill="${p.ink}"/><circle cx="-14" cy="-221" r="5" fill="${p.bone}"/><path d="M-22 -212l16 -6M-22 -218l16 6" stroke="${p.bone}" stroke-width="2"/>
<path d="M-150 -48C-146 -22 -126 0 -96 2L110 2C136 -2 156 -26 164 -52L128 -46H-120Z" fill="${p.wood}"/>
<path d="M-140 -22C-130 -6 -112 2 -96 2L110 2C128 -1 144 -12 154 -26Z" fill="${p.woodShadow}"/>
<path d="M-146 -36H160M-142 -26H155" stroke="${p.woodShadow}" stroke-width="2" opacity=".5"/>
<path d="M-152 -48V-90H-92V-48Z" fill="${p.wood}"/><path d="M-122 -48V-90H-92V-48Z" fill="${p.woodShadow}" opacity=".6"/><path d="M-152 -90H-92" stroke="${p.woodLight}" stroke-width="5" stroke-linecap="round"/>
${artGlow(-136, -70, 22, 'warm')}${artGlow(-108, -70, 22, 'warm')}
<g fill="${p.window}"><rect x="-142" y="-78" width="12" height="14" rx="2"/><rect x="-114" y="-78" width="12" height="14" rx="2"/></g>
<path d="M-120 -48H130" stroke="${p.woodLight}" stroke-width="5" stroke-linecap="round"/>
<g fill="${p.ink}"><circle cx="-60" cy="-30" r="5"/><circle cx="-20" cy="-30" r="5"/><circle cx="20" cy="-30" r="5"/><circle cx="60" cy="-30" r="5"/><circle cx="100" cy="-30" r="5"/></g>
<path d="M-168 4C-150 -2 -134 8 -116 3C-98 -2 -82 8 -64 3C-46 -2 -30 8 -12 3C6 -2 22 8 40 3C58 -2 74 8 92 3C110 -2 126 8 144 3C156 -1 166 4 176 2" stroke="${p.foam}" stroke-width="6" fill="none" stroke-linecap="round" opacity=".8"/>`;
}

/**
 * El árbol sagrado del Bosque Nevado: el tronco oscuro con su soga y sus borlas, la copa
 * naranja cargada de nieve y el hueco de abajo, de donde sale una luz turquesa.
 */
export function artSacredTree(id, p) {
  const lobes = [[0, -196, 100], [-92, -160, 62], [92, -158, 62], [-60, -244, 64], [62, -242, 62], [0, -276, 58], [-120, -200, 44], [122, -198, 44]];
  const top = lobes.filter(([, y]) => y < -190);
  return `<ellipse cx="34" cy="6" rx="190" ry="34" fill="${p.cast}"/>
<path d="M-40 4C-56 8 -76 10 -92 18M36 4C54 8 74 12 94 20M-10 6C-12 14 -18 20 -26 26" stroke="${p.bark}" stroke-width="10" stroke-linecap="round" fill="none"/>
<path d="M-52 6C-38 -4 -32 -24 -30 -58C-29 -80 -34 -98 -28 -122L28 -122C34 -98 29 -80 30 -58C32 -24 38 -4 52 6C34 10 -34 10 -52 6Z" fill="${p.bark}"/>
<path d="M-52 6C-38 -4 -32 -24 -30 -58C-29 -80 -34 -98 -28 -122L-10 -122C-18 -96 -16 -60 -24 -28C-28 -12 -36 0 -52 6Z" fill="${p.barkLight}"/>
<path d="M8 -122C14 -96 14 -52 18 -16C22 -2 34 4 52 6C38 -4 32 -24 30 -58C29 -80 34 -98 28 -122Z" fill="${p.barkShadow}"/>
${artGlow(0, -20, 36, 'teal')}
<path d="M-20 2C-24 -18 -18 -44 0 -48C18 -44 24 -18 20 2Z" fill="${p.hollow}"/>
<g fill="${p.wisp}"><ellipse cx="-6" cy="-18" rx="5" ry="3.5"/><ellipse cx="8" cy="-28" rx="4" ry="3"/><ellipse cx="2" cy="-8" rx="3" ry="2.4"/></g>
<path d="M-34 -70C-12 -60 12 -60 34 -70" stroke="${p.rope}" stroke-width="8" stroke-linecap="round" fill="none"/>
<path d="M-18 -64V-44M-18 -44l-4 8h8ZM16 -64V-46M16 -46l-4 8h8Z" stroke="${p.rope}" stroke-width="3" fill="${p.rope}" stroke-linejoin="round"/>
<path d="M-50 4C-34 -2 -14 0 0 -2C18 0 36 -2 52 6C30 8 -30 8 -50 4Z" fill="${p.snow}"/>
${artCanopy(id, p, lobes)}${artSnowCaps(p, top)}
<g fill="${p.leaf}"><path d="M-150 -60l6 -4 2 7Z"/><path d="M140 -40l6 -5 2 7Z"/><path d="M-100 -20l5 -3 2 6Z"/><path d="M110 -90l5 -4 2 6Z"/></g>`;
}

/**
 * Una calabaza pintada: gajos parados uno al lado del otro (`lobes`: `[x, rx, ry]`, el pie
 * en el suelo), cada uno con su luz a la izquierda y su sombra fría a la derecha, los de
 * la derecha más oscuros y un golpe de luz grande arriba a la izquierda, recortado a la
 * calabaza. Sin contornos: los gajos se separan por el tono.
 */
function artGourd(id, p, lobes) {
  const oval = ([x, rx, ry], dx = 0, k = 1) => `<ellipse cx="${artN(x + dx)}" cy="${artN(2 - ry)}" rx="${artN(rx * k)}" ry="${artN(ry)}"/>`;
  const rng = artRng(artSeed(id));
  const top = Math.max(...lobes.map(([, , ry]) => ry));
  const wide = Math.max(...lobes.map(([x, rx]) => Math.abs(x) + rx));
  let body = '';
  lobes.forEach((l, i) => {
    const [x, rx] = l;
    const right = x > rx * 0.3;
    body += `<clipPath id="${id}-l${i}">${oval(l)}</clipPath>`
      + `<g fill="${right ? p.deep : p.shadow}">${oval(l)}</g>`
      + `<g clip-path="url(#${id}-l${i})" fill="${right ? p.shadow : p.mid}">${oval(l, -rx * 0.3, 0.94)}</g>`;
  });
  // `top` es el radio del gajo más alto: la calabaza mide el doble.
  const light = artScallop(-wide * 0.4, -top * 1.56, wide * 0.3, top * 0.3, 6, 0.18, -0.4, rng);
  return `${body}<clipPath id="${id}-c">${lobes.map((l) => oval(l)).join('')}</clipPath>
<g clip-path="url(#${id}-c)"><path d="${light}" fill="${p.light}" opacity=".6"/>
${artStrokes(rng, [-wide * 0.8, -top * 1.8, wide * 0.6, -top * 0.3], Math.round(wide / 14), 16, 2.6, p.shadow, 0.3)}</g>`;
}

/**
 * La calabaza gigante de la Guarida, la del jefe: una linterna de calabaza con la cara
 * tallada del kit (los ojos rasgados y la sonrisa de dientes cuadrados de `Fear_Face`),
 * encendida por dentro. El tallo con su hoja y su zarcillo, las guías que se arrastran
 * por el suelo, calabacitas alrededor, velas y dos faroles de papel. La luz sale de la
 * cara y se derrama en el piso; el titilar lo pone la capa viva (ver `WORLD_MARKS` en
 * `map-world.js`).
 */
export function artPumpkin(id, p) {
  const lobes = [[-104, 64, 88], [104, 64, 88], [-56, 72, 104], [56, 72, 104], [0, 70, 112]];
  const face = `<path d="M-84 -156C-64 -150 -40 -142 -26 -130C-36 -116 -60 -110 -74 -120C-82 -128 -86 -140 -84 -156Z"/>
<path d="M84 -156C64 -150 40 -142 26 -130C36 -116 60 -110 74 -120C82 -128 86 -140 84 -156Z"/>
<path d="M0 -122L-12 -100H12Z"/>
<path d="M-100 -92C-60 -74 60 -74 100 -92C94 -52 52 -30 0 -30C-52 -30 -94 -52 -100 -92Z"/>`;
  // Los dientes cuadrados: lo que queda de la cáscara sin tallar.
  const teeth = `<path d="M-38 -80H-18V-62H-38Z"/><path d="M22 -80H42V-62H22Z"/><path d="M-8 -30V-48H12V-30Z"/>`;
  const leaf = (x, y, turn, k = 1) => `<g transform="translate(${x} ${y}) rotate(${turn}) scale(${k})"><path d="M0 0C6 -14 22 -20 36 -16C30 -2 16 6 0 0Z" fill="${p.leaf}"/><path d="M0 0C12 -4 24 -10 36 -16C30 -2 16 6 0 0Z" fill="${p.leafShadow}"/></g>`;
  const little = (x, y, k, n) => `<g transform="translate(${x} ${y}) scale(${k})">${artCast(46, 9, 12, p)}${artGourd(`${id}-s${n}`, p, [[-20, 22, 30], [20, 22, 30], [0, 24, 34]])}
<path d="M-2 -32C-2 -40 2 -46 8 -48L11 -44C6 -42 4 -38 4 -32Z" fill="${p.stem}"/></g>`;
  const lantern = (x, y) => `<path d="M${x - 12} 0V${y - 20}H${x}" stroke="${p.post}" stroke-width="4" fill="none" stroke-linecap="round"/>${artGlow(x, y, 30, 'red')}
<ellipse cx="${x}" cy="${y}" rx="10" ry="13" fill="${p.lantern}"/><path d="M${x} ${y - 13}C${x + 6} ${y - 9} ${x + 10} ${y - 4} ${x + 10} ${y}C${x + 10} ${y + 6} ${x + 5} ${y + 10} ${x} ${y + 13}C${x + 4} ${y + 6} ${x + 4} ${y - 7} ${x} ${y - 13}Z" fill="${p.lanternShadow}"/>`;
  return `<ellipse cx="34" cy="8" rx="214" ry="32" fill="${p.cast}"/>
${artGlow(0, 6, 150, 'fire')}
<path d="M-150 -6C-176 -2 -196 -10 -204 4M-176 -2C-184 10 -196 14 -208 12M150 -4C178 0 190 -8 206 2M184 -2C190 10 200 14 210 10" stroke="${p.vine}" stroke-width="4.5" fill="none" stroke-linecap="round"/>
${leaf(-190, -4, 170, 0.9)}${leaf(196, -2, -20, 0.8)}
${lantern(-182, -96)}${lantern(190, -88)}
${artGourd(id, p, lobes)}
<path d="M-8 -212C-10 -230 -4 -246 12 -256L24 -246C12 -238 8 -226 10 -210Z" fill="${p.stem}"/><path d="M-8 -212C-10 -230 -4 -246 12 -256L14 -250C4 -240 0 -226 0 -211Z" fill="${p.stemLight}"/>
<path d="M18 -246C34 -254 48 -246 44 -234C40 -224 28 -228 32 -236" stroke="${p.vine}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
${leaf(4, -218, -150, 1.2)}
<g fill="${p.rim}" transform="translate(4 5)">${face}</g><g fill="${p.glow}">${face}</g>
<g fill="${p.core}"><path d="M-70 -132C-58 -128 -46 -126 -38 -126C-48 -120 -62 -120 -70 -132Z"/><path d="M70 -132C58 -128 46 -126 38 -126C48 -120 62 -120 70 -132Z"/>
<path d="M-70 -50C-40 -40 40 -40 70 -50C54 -38 28 -34 0 -34C-28 -34 -54 -38 -70 -50Z"/></g>
<g fill="${p.mid}">${teeth}</g>
${little(-150, 16, 0.9, 1)}${little(146, 20, 0.75, 2)}${little(-112, 26, 0.55, 3)}
<g transform="translate(-86 22) scale(.9)">${artCandles({ ...p, cast: 'none' })}</g><g transform="translate(100 26)">${artCandles({ ...p, cast: 'none' })}</g>`;
}

/**
 * El Coliseo, la última pelea: un anillo de piedra visto de arriba y de frente, con dos
 * pisos de arcos, la arena adentro y la puerta grande abajo, donde termina el camino.
 */
export function artColosseum(p) {
  const cy = -196;
  const rx = 230;
  const ry = 96;
  const arches = [];
  for (let i = 1; i < 14; i++) {
    const t = (i / 14) * Math.PI;
    const w = 17 * Math.sin(t);
    if (w < 5) continue;
    const x = rx * Math.cos(t);
    for (const [dy, h] of [[34, 22], [72, 26]]) {
      const y = cy + ry * Math.sin(t) + dy;
      if (Math.abs(x) < 26 && dy === 72) continue;
      arches.push(`M${artN(x - w / 2)} ${artN(y + h / 2)}V${artN(y - h / 2 + w / 2)}A${artN(w / 2)} ${artN(w / 2)} 0 0 1 ${artN(x + w / 2)} ${artN(y - h / 2 + w / 2)}V${artN(y + h / 2)}Z`);
    }
  }
  const banner = (t) => {
    const x = artN(rx * 0.9 * Math.cos(t));
    const y = artN(cy + ry * 0.9 * Math.sin(t));
    return `<path d="M${x} ${y}V${y - 46}" stroke="${p.pole}" stroke-width="3"/><path d="M${x} ${y - 46}h22v16l-11 -5 -11 5Z" fill="${p.cloth}"/>`;
  };
  return `<defs><linearGradient id="adv-g-colo" x1="0" x2="1"><stop offset="0" stop-color="${p.light}"/><stop offset=".5" stop-color="${p.mid}"/><stop offset="1" stop-color="${p.shadow}"/></linearGradient></defs>
<ellipse cx="30" cy="-58" rx="256" ry="106" fill="${p.cast}"/>
${[3.6, 4.1, 4.6, 5.2, 5.7].map(banner).join('')}
<path d="M${-rx} ${cy}A${rx} ${ry} 0 1 0 ${rx} ${cy}A${rx} ${ry} 0 1 0 ${-rx} ${cy}Z" fill="${p.top}"/>
<ellipse cx="0" cy="${cy}" rx="172" ry="66" fill="${p.wall}"/>
<path d="M-150 ${cy - 30}A150 50 0 0 1 150 ${cy - 30}M-162 ${cy - 14}A162 58 0 0 1 162 ${cy - 14}" stroke="${p.shadow}" stroke-width="2" fill="none" opacity=".4"/>
<ellipse cx="0" cy="${cy + 26}" rx="150" ry="48" fill="${p.sand}"/><ellipse cx="40" cy="${cy + 34}" rx="96" ry="30" fill="${p.sandShadow}" opacity=".5"/>
<path d="M${-rx} ${cy}A${rx} ${ry} 0 0 0 ${rx} ${cy}V${cy + 100}A${rx} ${ry} 0 0 1 ${-rx} ${cy + 100}Z" fill="url(#adv-g-colo)"/>
<path d="M${-rx} ${cy + 52}A${rx} ${ry} 0 0 0 ${rx} ${cy + 52}" stroke="${p.shadow}" stroke-width="2.5" fill="none" opacity=".45"/>
<path d="${arches.join('')}" fill="${p.arch}" opacity=".8"/>
<path d="M-26 0V-44C-26 -64 26 -64 26 -44V0Z" fill="${p.arch}"/>
${[1.2, 1.95].map(banner).join('')}`;
}

// ---- los hitos de los capítulos 6 a 20 ----------------------------------------------------

/**
 * La puerta de piedra del Bosque de Otoño: dos pilares, el dintel con su soga y sus papeles,
 * musgo, y dos faroles de piedra encendidos a los costados.
 */
export function artGate(p) {
  const lantern = (x) => `<g transform="translate(${x} 0)"><rect x="-9" y="-46" width="18" height="46" rx="3" fill="${p.mid}"/><rect x="3" y="-46" width="6" height="46" fill="${p.shadow}"/>
<path d="M-16 -46L0 -60L16 -46Z" fill="${p.light}"/>${artGlow(0, -30, 26, 'warm')}<rect x="-5" y="-36" width="10" height="10" rx="2" fill="${p.window}"/></g>`;
  return `<ellipse cx="30" cy="8" rx="200" ry="28" fill="${p.cast}"/>
<path d="M-118 0V-196H-86V0Z" fill="${p.mid}"/><path d="M-98 0V-196H-86V0Z" fill="${p.shadow}"/>
<path d="M86 0V-196H118V0Z" fill="${p.mid}"/><path d="M106 0V-196H118V0Z" fill="${p.shadow}"/>
<path d="M-150 -204C-80 -214 80 -214 150 -204L156 -226C80 -238 -80 -238 -156 -226Z" fill="${p.light}"/>
<path d="M-150 -204C-80 -214 80 -214 150 -204L152 -214C80 -224 -80 -224 -152 -214Z" fill="${p.mid}" opacity=".55"/>
<path d="M-126 -172H126V-158H-126Z" fill="${p.mid}"/><path d="M-126 -160H126V-158H-126Z" fill="${p.shadow}"/>
<path d="M-86 -150C-40 -132 40 -132 86 -150" stroke="${p.rope}" stroke-width="7" fill="none" stroke-linecap="round"/>
<g fill="${p.paper}"><path d="M-48 -142l6 22 6 -20Z"/><path d="M-6 -138l6 22 6 -22Z"/><path d="M36 -142l6 20 6 -22Z"/></g>
<path d="M-118 -60q8 -6 16 0q6 -10 14 -4M88 -40q10 -8 18 -2q4 -8 12 -4" stroke="${p.moss}" stroke-width="7" fill="none" stroke-linecap="round"/>
${lantern(-166)}${lantern(170)}
<g fill="${p.leaf}"><path d="M-60 10l7 -4 2 7Z"/><path d="M40 14l7 -4 2 7Z"/><path d="M-10 20l6 -3 2 6Z"/></g>`;
}

/** El templo de la Jungla: escalones de piedra, la puerta encendida y las enredaderas. */
export function artTemple(p) {
  const step = (y, w, h) => `<path d="M${-w} ${y}V${y - h}H${w}V${y}Z" fill="${p.mid}"/><path d="M${-w} ${y - h}H${w}V${y - h + 6}H${-w}Z" fill="${p.light}"/><path d="M${w - 26} ${y}V${y - h + 6}H${w}V${y}Z" fill="${p.shadow}"/>`;
  return `<ellipse cx="34" cy="8" rx="226" ry="32" fill="${p.cast}"/>
${step(0, 200, 52)}${step(-52, 160, 50)}${step(-102, 120, 48)}${step(-150, 82, 46)}
<path d="M-70 -196L0 -258L70 -196Z" fill="${p.roof}"/><path d="M0 -258L70 -196H34Z" fill="${p.roofShadow}"/>
${artGlow(0, -160, 46, 'teal')}<path d="M-22 -150V-176C-22 -192 22 -192 22 -176V-150Z" fill="${p.door}"/>
<path d="M-12 -150V-170C-12 -180 12 -180 12 -170V-150Z" fill="${p.glow}" opacity=".85"/>
<path d="M-160 -60C-140 -90 -150 -110 -126 -132M150 -40C140 -70 156 -96 132 -120M-60 -8C-70 -30 -60 -50 -74 -74" stroke="${p.vine}" stroke-width="6" fill="none" stroke-linecap="round"/>
<g fill="${p.leaf}"><path d="M-150 -96l12 -6 -2 12Z"/><path d="M144 -82l12 -4 -4 12Z"/><path d="M-66 -46l10 -6 0 12Z"/><path d="M-132 -130l12 -4 -4 12Z"/></g>
<path d="M-200 -24H200M-160 -76H160M-120 -126H120" stroke="${p.shadow}" stroke-width="2" opacity=".35"/>`;
}

/** El loto gigante de la Laguna: su estanque, las hojas redondas y la flor abierta. */
export function artLotus(p) {
  const petal = (a, len, w, fill) => `<path d="M0 0C${artN(-w)} ${artN(-len * 0.5)} ${artN(-w * 0.4)} ${artN(-len)} 0 ${artN(-len)}C${artN(w * 0.4)} ${artN(-len)} ${artN(w)} ${artN(-len * 0.5)} 0 0Z" fill="${fill}" transform="translate(0 -60) rotate(${a})"/>`;
  return `<ellipse cx="0" cy="-10" rx="220" ry="62" fill="${p.bank}"/>
<ellipse cx="0" cy="-12" rx="200" ry="52" fill="${p.water}"/><ellipse cx="-30" cy="-20" rx="120" ry="26" fill="${p.waterLight}"/>
<g fill="${p.pad}"><ellipse cx="-120" cy="-6" rx="46" ry="16"/><ellipse cx="110" cy="-2" rx="40" ry="14"/><ellipse cx="0" cy="-40" rx="80" ry="24"/></g>
<path d="M0 -40L74 -48A80 24 0 0 1 78 -36Z" fill="${p.padShadow}"/>
${artGlow(0, -90, 70, 'warm')}
${[-70, -40, 40, 70].map((a) => petal(a, 70, 24, p.petalShadow)).join('')}
${[-25, 25, 0].map((a) => petal(a, 86, 26, p.petal)).join('')}
<circle cx="0" cy="-70" r="12" fill="${p.core}"/><circle cx="-3" cy="-73" r="5" fill="#fff" opacity=".35"/>`;
}

/** El faro de la Isla: la torre a franjas sobre las piedras, el cuarto de la luz encendido. */
export function artLighthouse(p) {
  return `<ellipse cx="20" cy="6" rx="130" ry="22" fill="${p.cast}"/>
<g transform="translate(-78 4)">${artRock(p)}</g><g transform="translate(70 6) scale(1.2)">${artRock(p)}</g>
<path d="M-40 0L-26 -250H26L40 0Z" fill="${p.wall}"/><path d="M10 0L14 -250H26L40 0Z" fill="${p.wallShadow}"/>
<path d="M-37 -46L-34 -84H34L37 -46ZM-32 -128L-30 -166H30L32 -128ZM-28 -208L-27 -236H27L28 -208Z" fill="${p.stripe}"/>
<path d="M-38 -16H38" stroke="${p.wallShadow}" stroke-width="4"/>
<path d="M-34 -250H34V-262H-34Z" fill="${p.trim}"/>
${artGlow(0, -282, 70, 'warm')}<path d="M-22 -262V-300H22V-262Z" fill="${p.glass}"/><path d="M-10 -266V-296H10V-266Z" fill="${p.lamp}"/>
<path d="M-28 -300L0 -326L28 -300Z" fill="${p.trim}"/><circle cx="0" cy="-330" r="5" fill="${p.trim}"/>
<path d="M-28 -88h10v14h-10ZM-24 -184h8v12h-8Z" fill="${p.window}"/>`;
}

/** El arco de roca de la Meseta: dos patas de piedra roja y el puente natural arriba. */
export function artArch(p) {
  return `<ellipse cx="34" cy="8" rx="230" ry="30" fill="${p.cast}"/>
<path d="M-200 0C-206 -80 -196 -170 -150 -230C-90 -290 90 -290 150 -230C196 -170 206 -80 200 0H120C126 -70 110 -140 70 -174C30 -204 -30 -204 -70 -174C-110 -140 -126 -70 -120 0Z" fill="${p.mid}"/>
<path d="M-200 0C-206 -80 -196 -170 -150 -230C-120 -260 -80 -276 -30 -280C-90 -260 -150 -200 -164 -120C-170 -70 -168 -30 -166 0Z" fill="${p.light}"/>
<path d="M200 0C206 -80 196 -170 150 -230C140 -240 128 -250 116 -256C150 -210 168 -150 160 -80C158 -50 156 -20 156 0Z" fill="${p.shadow}"/>
<path d="M-150 -230C-90 -290 90 -290 150 -230C120 -244 60 -262 0 -262C-60 -262 -120 -244 -150 -230Z" fill="${p.top}"/>
<path d="M-186 -60H-130M-180 -120H-136M130 -60H186M136 -124H180" stroke="${p.shadow}" stroke-width="3" opacity=".45"/>
<g transform="translate(-232 6) scale(.9)">${artRock(p)}</g><g transform="translate(238 8)">${artRock(p)}</g>`;
}

/** El termitero del Cañón: un montículo alto en capas, con sus agujeros y bichitos de luz. */
export function artHive(p) {
  const holes = [[-30, -120, 9], [20, -180, 8], [-14, -230, 7], [36, -96, 10], [-50, -60, 9]];
  return `<ellipse cx="30" cy="8" rx="170" ry="26" fill="${p.cast}"/>
<path d="M-120 0C-110 -60 -90 -100 -70 -150C-60 -200 -40 -260 -10 -290C10 -296 24 -280 30 -250C50 -200 70 -150 90 -100C104 -60 116 -30 126 0Z" fill="${p.mid}"/>
<path d="M-120 0C-110 -60 -90 -100 -70 -150C-60 -200 -40 -260 -10 -290C-24 -240 -40 -180 -56 -120C-66 -70 -74 -30 -76 0Z" fill="${p.light}"/>
<path d="M30 -250C50 -200 70 -150 90 -100C104 -60 116 -30 126 0H70C76 -60 60 -140 30 -250Z" fill="${p.shadow}"/>
<path d="M-100 -50H110M-84 -110H90M-64 -170H66M-40 -230H40" stroke="${p.shadow}" stroke-width="4" opacity=".4" stroke-linecap="round"/>
${holes.map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${artN(r * 1.3)}" fill="${p.hole}"/>`).join('')}
${artGlow(-30, -120, 22, 'warm')}${artGlow(36, -96, 22, 'warm')}
<g transform="translate(-150 8)">${artRock(p)}</g><g transform="translate(150 10) scale(.8)">${artRock(p)}</g>`;
}

/** El nido gigante del Cielo, sobre una nube: ramas trenzadas y tres huevos. */
export function artNest(p) {
  let twigs = '';
  for (let i = 0; i < 9; i++) {
    const y = -40 - i * 7;
    twigs += `M${-150 + i * 4} ${y}C-60 ${y - 18} 60 ${y - 14} ${150 - i * 4} ${y + 4}`;
  }
  return `<ellipse cx="20" cy="4" rx="210" ry="30" fill="${p.cast}"/>
<g fill="${p.cloudShadow}"><circle cx="-130" cy="-16" r="36"/><circle cx="-60" cy="-30" r="48"/><circle cx="20" cy="-34" r="52"/><circle cx="100" cy="-24" r="44"/><circle cx="160" cy="-10" r="30"/></g>
<g fill="${p.cloud}"><circle cx="-134" cy="-22" r="30"/><circle cx="-64" cy="-38" r="40"/><circle cx="14" cy="-42" r="44"/><circle cx="94" cy="-30" r="36"/></g>
<path d="M-160 -60C-150 -20 150 -20 160 -60C150 -110 -150 -110 -160 -60Z" fill="${p.mid}"/>
<path d="M-160 -60C-150 -20 0 -24 10 -26C-80 -30 -140 -42 -160 -60Z" fill="${p.light}"/>
<path d="${twigs}" stroke="${p.shadow}" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".7"/>
<g><ellipse cx="-44" cy="-100" rx="26" ry="34" fill="${p.egg}"/><ellipse cx="-36" cy="-96" rx="14" ry="22" fill="${p.eggShadow}"/>
<ellipse cx="10" cy="-110" rx="30" ry="40" fill="${p.egg}"/><ellipse cx="20" cy="-104" rx="16" ry="26" fill="${p.eggShadow}"/>
<ellipse cx="60" cy="-96" rx="24" ry="32" fill="${p.egg}"/><ellipse cx="68" cy="-92" rx="12" ry="20" fill="${p.eggShadow}"/></g>
<g fill="${p.spot}"><circle cx="-50" cy="-110" r="4"/><circle cx="2" cy="-126" r="5"/><circle cx="54" cy="-104" r="4"/></g>
<path d="M-160 -60C-150 -96 150 -96 160 -60" stroke="${p.light}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
}

/** El cristal gigante de la Caverna: un racimo de puntas altas, encendido por dentro. */
export function artGeode(p) {
  return `<ellipse cx="30" cy="8" rx="190" ry="28" fill="${p.cast}"/>
${artGlow(0, -120, 120, p.glowKind ?? 'teal')}
${artShard(p, -110, 90, 22, -14)}${artShard(p, 104, 110, 24, 16)}${artShard(p, -60, 170, 30, -10)}${artShard(p, 56, 200, 32, 8)}${artShard(p, 0, 290, 40, 2)}
<g transform="translate(-160 6)">${artCrystal(p)}</g><g transform="translate(160 8) scale(1.2)">${artCrystal(p)}</g>`;
}

/** La carpa del Desierto: lona a franjas, banderines, cajones y un farol. */
export function artTent(p) {
  let stripes = '';
  for (let i = -3; i <= 3; i++) stripes += `M${i * 30} -210L${i * 54} 0`;
  return `<ellipse cx="30" cy="8" rx="210" ry="28" fill="${p.cast}"/>
<path d="M-180 0L0 -220L180 0Z" fill="${p.cloth}"/>
<path d="${stripes}" stroke="${p.stripe}" stroke-width="16" opacity=".85"/>
<path d="M0 -220L180 0H90Z" fill="${p.clothShadow}" opacity=".7"/>
<path d="M-40 0V-80C-40 -100 40 -100 40 -80V0Z" fill="${p.door}"/>${artGlow(0, -40, 40, 'warm')}
<path d="M0 -220V-262" stroke="${p.pole}" stroke-width="5"/><path d="M0 -262L34 -252L0 -242Z" fill="${p.flag}"/>
<path d="M-180 0L-210 -10M180 0L210 -10" stroke="${p.rope}" stroke-width="3"/>
<g transform="translate(-140 6)">${artCargo(p)}</g><g transform="translate(150 8) scale(.85)">${artCargo(p)}</g>`;
}

/** El volcán del Ocaso: el cono oscuro, la boca encendida y la lava que baja. */
export function artVolcano(p) {
  return `<ellipse cx="30" cy="8" rx="240" ry="30" fill="${p.cast}"/>
${artGlow(0, -270, 110, 'fire')}
<path d="M-230 0L-70 -260H70L230 0Z" fill="${p.mid}"/>
<path d="M-230 0L-70 -260H-20L-140 0Z" fill="${p.light}"/>
<path d="M70 -260L230 0H120L40 -260Z" fill="${p.shadow}"/>
<path d="M-70 -260C-40 -276 40 -276 70 -260C40 -248 -40 -248 -70 -260Z" fill="${p.lava}"/>
<path d="M-20 -256C-30 -200 -60 -150 -50 -90C-46 -60 -60 -30 -56 0" stroke="${p.lava}" stroke-width="12" fill="none" stroke-linecap="round"/>
<path d="M30 -254C40 -200 70 -170 64 -110C60 -70 80 -40 76 0" stroke="${p.lava}" stroke-width="9" fill="none" stroke-linecap="round" opacity=".9"/>
<path d="M-20 -256C-30 -200 -60 -150 -50 -90" stroke="${p.lavaCore}" stroke-width="4" fill="none" stroke-linecap="round"/>
<g fill="${p.smoke}" opacity=".6"><circle cx="-10" cy="-300" r="22"/><circle cx="20" cy="-330" r="28"/><circle cx="0" cy="-366" r="20"/></g>`;
}

/** El hongo luminoso del Bosque Nocturno: el sombrero con lunares que brillan, y sus hijitos. */
export function artGlowShroom(p) {
  const small = (x, k) => `<g transform="translate(${x} 4) scale(${k})">${artMushrooms(p)}</g>`;
  return `<ellipse cx="30" cy="8" rx="170" ry="26" fill="${p.cast}"/>
${artGlow(0, -200, 120, 'teal')}
<path d="M-26 0C-30 -60 -24 -120 -20 -170H20C24 -120 30 -60 26 0Z" fill="${p.stem}"/><path d="M6 0C8 -60 12 -120 16 -170H20C24 -120 30 -60 26 0Z" fill="${p.stemShadow}"/>
<path d="M-150 -170C-150 -280 150 -280 150 -170C90 -150 -90 -150 -150 -170Z" fill="${p.cap}"/>
<path d="M30 -254C100 -240 150 -210 150 -170C110 -158 70 -154 20 -152C60 -180 64 -220 30 -254Z" fill="${p.capShadow}"/>
<g fill="${p.dots}"><circle cx="-80" cy="-214" r="14"/><circle cx="-20" cy="-244" r="12"/><circle cx="50" cy="-222" r="15"/><circle cx="100" cy="-186" r="10"/><circle cx="-110" cy="-180" r="9"/></g>
${small(-130, 1.6)}${small(130, 1.3)}`;
}

/** El árbol de Navidad del Salón de Invierno: el pino nevado, las esferas, la estrella y los regalos. */
export function artXmasTree(id, p) {
  // Tres pisos de abajo para arriba: `[base, punta, ancho]`.
  const tiers = [[-20, -170, 150], [-110, -255, 112], [-195, -330, 76]];
  const tier = ([y, top, w]) => `<path d="M${-w} ${y}L0 ${top}L${w} ${y}Z" fill="${p.mid}"/><path d="M0 ${top}L${w} ${y}H${artN(w * 0.35)}Z" fill="${p.shadow}"/>`
    + `<path d="M${-w} ${y}C${artN(-w * 0.5)} ${y + 10} ${artN(w * 0.5)} ${y + 10} ${w} ${y}" stroke="${p.snow}" stroke-width="7" fill="none" stroke-linecap="round" opacity=".9"/>`;
  const balls = [[-90, -40, 'a'], [70, -60, 'b'], [-40, -120, 'b'], [50, -150, 'a'], [-26, -210, 'a'], [30, -240, 'b'], [110, -32, 'a']];
  return `<ellipse cx="30" cy="8" rx="170" ry="26" fill="${p.cast}"/>
<rect x="-14" y="-26" width="28" height="30" fill="${p.trunk}"/>
${tiers.map(tier).join('')}
${balls.map(([x, y, k]) => `<circle cx="${x}" cy="${y}" r="9" fill="${k === 'a' ? p.ballA : p.ballB}"/><circle cx="${x - 3}" cy="${y - 3}" r="3" fill="#fff" opacity=".5"/>`).join('')}
${artGlow(0, -334, 40, 'warm')}<path d="M0 -356L7 -340L24 -338L11 -327L15 -310L0 -319L-15 -310L-11 -327L-24 -338L-7 -340Z" fill="${p.star}"/>
<g transform="translate(-120 10)">${artGift({ ...p, mid: p.ballA, light: p.giftLight, shadow: p.giftShadow, ribbon: p.star })}</g>
<g transform="translate(110 12) scale(1.2)">${artGift({ ...p, mid: p.ballB, light: p.giftLight, shadow: p.giftShadow, ribbon: p.star })}</g>`;
}

/** La torre del reloj de los Engranajes: la torre de metal, la esfera y los engranajes al costado. */
export function artClockTower(p) {
  return `<ellipse cx="30" cy="8" rx="160" ry="24" fill="${p.cast}"/>
<path d="M-60 0V-260H60V0Z" fill="${p.mid}"/><path d="M20 0V-260H60V0Z" fill="${p.shadow}"/><path d="M-60 -260H60V-250H-60Z" fill="${p.light}"/>
<path d="M-70 -260L0 -330L70 -260Z" fill="${p.roof}"/><path d="M0 -330L70 -260H30Z" fill="${p.roofShadow}"/>
<circle cx="0" cy="-200" r="40" fill="${p.face}"/><circle cx="0" cy="-200" r="40" fill="none" stroke="${p.trim}" stroke-width="6"/>
<path d="M0 -200V-228M0 -200L18 -190" stroke="${p.ink}" stroke-width="5" stroke-linecap="round"/>
${artGlow(0, -110, 30, 'warm')}<path d="M-16 -90V-126C-16 -138 16 -138 16 -126V-90Z" fill="${p.window}"/>
<path d="M-30 0V-50C-30 -70 30 -70 30 -50V0Z" fill="${p.door}"/>
<g transform="translate(-100 0) scale(1.6)">${artGear({ ...p, mid: p.gear, light: p.gearLight, shadow: p.gearShadow })}</g>
<g transform="translate(96 4) scale(1.1)">${artGear({ ...p, mid: p.gear, light: p.gearLight, shadow: p.gearShadow })}</g>`;
}

/** El portal del Mar Violeta: un aro de piedra y cristales con el remolino adentro. */
export function artPortal(p) {
  return `<ellipse cx="30" cy="8" rx="170" ry="24" fill="${p.cast}"/>
${artGlow(0, -150, 110, 'teal')}
<ellipse cx="0" cy="-150" rx="96" ry="130" fill="${p.swirl}"/>
<ellipse cx="0" cy="-150" rx="64" ry="96" fill="${p.swirlLight}" opacity=".7"/><ellipse cx="0" cy="-150" rx="30" ry="50" fill="${p.core}" opacity=".8"/>
<path d="M0 -150m-120 0a120 160 0 1 0 240 0a120 160 0 1 0 -240 0M0 -150m-96 0a96 130 0 1 1 192 0a96 130 0 1 1 -192 0Z" fill="${p.mid}" fill-rule="evenodd"/>
<path d="M-120 -150A120 160 0 0 1 0 -310V-280A96 130 0 0 0 -96 -150Z" fill="${p.light}"/>
<path d="M120 -150A120 160 0 0 1 0 10V-20A96 130 0 0 0 96 -150Z" fill="${p.shadow}"/>
<g transform="translate(-118 -40) scale(1.2)">${artCrystal(p)}</g><g transform="translate(118 -60)">${artCrystal(p)}</g><g transform="translate(0 -300) scale(1.1)">${artCrystal(p)}</g>`;
}

/**
 * La puerta del Amanecer, el final del viaje: un arco de mármol con el sol saliendo detrás,
 * dos columnas y la puerta grande abajo, donde termina el camino.
 */
export function artSunGate(p) {
  let rays = '';
  for (let i = 0; i < 12; i++) {
    const a = Math.PI + (i / 11) * Math.PI;
    rays += `M${artN(Math.cos(a) * 150)} ${artN(-230 + Math.sin(a) * 150)}L${artN(Math.cos(a) * 230)} ${artN(-230 + Math.sin(a) * 230)}`;
  }
  return `<ellipse cx="30" cy="8" rx="250" ry="30" fill="${p.cast}"/>
${artGlow(0, -240, 160, 'warm')}
<path d="${rays}" stroke="${p.sun}" stroke-width="12" stroke-linecap="round" opacity=".55"/>
<circle cx="0" cy="-230" r="120" fill="${p.sun}"/><circle cx="-30" cy="-260" r="60" fill="${p.sunLight}" opacity=".6"/>
<path d="M-200 0V-210C-200 -330 200 -330 200 -210V0H140V-200C140 -280 -140 -280 -140 -200V0Z" fill="${p.mid}"/>
<path d="M-200 0V-210C-200 -300 -120 -330 -40 -330C-120 -310 -170 -270 -170 -200V0Z" fill="${p.light}"/>
<path d="M200 0V-210C200 -260 180 -290 150 -310C176 -276 180 -240 180 -200V0Z" fill="${p.shadow}"/>
<path d="M-140 0V-200C-140 -280 140 -280 140 -200V0Z" fill="${p.inner}" opacity=".85"/>
<path d="M-40 0V-80C-40 -110 40 -110 40 -80V0Z" fill="${p.door}"/>
<g fill="${p.mid}"><rect x="-250" y="-170" width="30" height="170"/><rect x="220" y="-170" width="30" height="170"/></g>
<g fill="${p.light}"><rect x="-256" y="-180" width="42" height="12"/><rect x="214" y="-180" width="42" height="12"/></g>`;
}

/** La casa del comienzo: una cabaña de techo de hongo, con su fogata y el cartel. */
export function artCamp(p) {
  return `<ellipse cx="6" cy="4" rx="120" ry="18" fill="${p.cast}"/>
<path d="M-44 0V-46C-44 -52 -40 -56 -34 -56H34C40 -56 44 -52 44 -46V0Z" fill="${p.wood}"/><path d="M14 -56H34C40 -56 44 -52 44 -46V0H14Z" fill="${p.woodShadow}"/>
<path d="M-30 -54V0M-16 -54V0M16 -54V0M30 -54V0" stroke="${p.woodShadow}" stroke-width="2" opacity=".45"/>
<path d="M-12 0V-26C-12 -34 12 -34 12 -26V0Z" fill="${p.door}"/>
${artGlow(28, -34, 20, 'warm')}<circle cx="28" cy="-34" r="7" fill="${p.window}"/><path d="M21 -34h14M28 -41v14" stroke="${p.woodShadow}" stroke-width="2"/>
<rect x="22" y="-116" width="12" height="26" rx="2" fill="${p.stone}"/>
<g fill="${p.smoke}" opacity=".7"><circle cx="30" cy="-126" r="7"/><circle cx="38" cy="-138" r="9"/><circle cx="32" cy="-154" r="11"/></g>
<path d="M-64 -46C-62 -86 -32 -110 0 -112C32 -110 62 -86 64 -46C42 -38 -42 -38 -64 -46Z" fill="${p.roof}"/>
<path d="M-64 -46C-62 -86 -32 -110 0 -112C-22 -104 -40 -82 -42 -44C-52 -44 -58 -45 -64 -46Z" fill="${p.roofLight}"/>
<path d="M12 -111C38 -104 62 -80 64 -46C54 -42 44 -41 34 -40C38 -70 30 -96 12 -111Z" fill="${p.roofShadow}"/>
<g fill="${p.dots}"><circle cx="-30" cy="-72" r="8"/><circle cx="4" cy="-92" r="7"/><circle cx="-8" cy="-60" r="5"/><circle cx="30" cy="-68" r="6"/></g>
<g transform="translate(-92 14)">${artGlow(0, -16, 46, 'fire')}
<g fill="${p.stone}"><ellipse cx="-14" cy="0" rx="6" ry="4"/><ellipse cx="14" cy="0" rx="6" ry="4"/><ellipse cx="0" cy="4" rx="7" ry="4"/><ellipse cx="0" cy="-5" rx="6" ry="3"/></g>
<path d="M-12 -2L12 -8M-12 -8L12 -2" stroke="${p.woodShadow}" stroke-width="5" stroke-linecap="round"/>
<path d="M-9 -6C-11 -16 -4 -20 -3 -30C1 -22 3 -26 4 -34C10 -24 11 -14 9 -6Z" fill="${p.flame}"/><path d="M-4 -6C-5 -11 -2 -14 -1 -19C2 -14 4 -12 4 -6Z" fill="${p.flameCore}"/></g>
<g transform="translate(96 -12)"><rect x="-3" y="-58" width="6" height="58" rx="2" fill="${p.woodShadow}"/><path d="M-4 -56H34L44 -46L34 -36H-4Z" fill="${p.wood}"/><path d="M-4 -46H44L34 -36H-4Z" fill="${p.woodShadow}" opacity=".6"/></g>`;
}
