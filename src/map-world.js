// El mundo de la Aventura: un solo mapa, armado por módulos.
//
// Lo que manda son los niveles. Cada capítulo es una tierra (`WORLD_LANDS`: el Valle, la
// Costa, el Bosque Nevado, la Guarida, el Coliseo) y cada tierra es un módulo que dice su
// paleta, qué piezas crecen ahí (`kit`), su agua, el hito de su jefe y el dibujo de sus
// niveles sobre la franja del camino (`pattern`). El camino se genera pasando por los
// niveles —no se calca de ningún dibujo—, así camino y niveles son una sola cosa. Después
// se reparte el decorado con azar sembrado: denso lejos del camino, ralo cerca, nunca
// encima del camino, del agua, de un nivel o de un hito. Un capítulo nuevo en la campaña
// alarga el mundo solo: toma la tierra que sigue en `WORLD_ORDER`.
//
// Todo se genera en coordenadas del viaje: `u` a lo largo (del comienzo al final) y `v`
// a lo ancho. De costado (`h`) el viaje va de izquierda a derecha; en un teléfono parado
// (`v`) va de abajo para arriba. Las piezas se paran siempre derechas en la pantalla.
//
// Es puro: sin DOM. `buildWorld` arma los datos y `worldArt` los dibuja en un SVG.
import { makeRng } from './data.js';
import {
  artN, artSmooth, artBlob, artGlowDefs, artTree, artSnowTree, artConifer, artPalm, artDeadTree,
  artBush, artThorns, artSnowMound, artRock, artGrass, artFlowers, artMushrooms, artTotem, artLantern,
  artPaperLantern, artCat, artVase, artCandles, artShells, artCargo, artColumn, artCactus, artDryBush,
  artAmphora, artBanner, artSpear, artBrazier, artBridge, artDock, artTotems, artShip, artSacredTree,
  artPumpkin, artColosseum, artCamp, artCrystal, artGear, artGift, artBall, artReeds, artLily, artCloud,
  artGate, artTemple, artLotus, artLighthouse, artArch, artHive, artNest, artGeode, artTent, artVolcano,
  artGlowShroom, artXmasTree, artClockTower, artPortal, artSunGate,
} from './map-art.js';

/**
 * Las dos maneras de recorrerlo. `cross` es el ancho del mundo en unidades, `band` la
 * franja (en fracción del ancho) por donde pasa el camino —de costado, entre la barra de
 * arriba y el panel de abajo—, `behind` a qué distancia del jefe se para su hito (de
 * costado, arriba; parado, a la izquierda) y `duel` lo que se deja libre alrededor de
 * cada nivel para el cara a cara: a cada costado (`side`, más ancho en los jefes) va uno
 * de los dos que pelean, parados en la línea del nivel (ver `levelSpot`). Las medidas
 * son las del peor caso, el teléfono, donde un Axie ocupa más mapa. `seam` pisa al de
 * `WORLD_LAYOUT`.
 */
export const WORLD_ORIENT = {
  h: { cross: 1000, band: [0.27, 0.6], behind: 200, duel: { side: 215, boss: 290, up: 140, down: 85 }, start: 700 },
  // Parado, el comienzo tiene más lugar: la casa tiene que quedar arriba del panel. Y la
  // costura es más larga: el teléfono parado ve todo el ancho del mundo, así que la mezcla
  // de una tierra con la otra ocupa menos pantalla y el cambio se lee como un corte.
  v: { cross: 960, band: [0.22, 0.78], behind: 330, duel: { side: 230, boss: 310, up: 140, down: 95 }, start: 1100, seam: 400 },
};

/**
 * Cómo se reparte el viaje a lo largo, en unidades del mapa: el primer capítulo empieza
 * en `start` (lo de antes es la casa; ver `WORLD_ORIENT`), su primer nivel está `entry`
 * adentro, los siguientes cada `gap` y después del último quedan `exit` hasta la tierra
 * que sigue (ver `chapterLength`); después del último capítulo quedan `end`, y las
 * tierras se mezclan `seam` a cada lado de la costura (parado, más: ver `WORLD_ORIENT`):
 * el suelo, el camino, lo pintado en el suelo y el decorado.
 */
export const WORLD_LAYOUT = { start: 700, entry: 340, gap: 380, exit: 460, end: 560, seam: 230 };

/** Lo que mide a lo largo un capítulo de `size` niveles. */
export const chapterLength = (size) => WORLD_LAYOUT.entry + Math.max(0, size - 1) * WORLD_LAYOUT.gap + WORLD_LAYOUT.exit;

/** Medio ancho del camino, en unidades del mapa. */
const WORLD_ROAD = 32;

/** La sombra que cada pieza tira al piso: el degradé frío de su tierra. */
const worldCast = (land) => `url(#adv-sh-${land})`;

/**
 * Las tierras, con la paleta de su fondo de pelea (`Backgrounds/stage-*`): el suelo
 * (`ground`), los charcos de luz cálida (`light`) y de sombra fría (`shade`), la sombra
 * que tiran las piezas (`cast`), lo oscuro de los bordes (`frame`), el camino y sus
 * pinceladas (`brush`). `pattern` es dónde cae cada nivel a lo ancho de la franja (0 del
 * lado de lejos: arriba de costado, a la izquierda parado; 1 del lado de cerca); los
 * jefes van del lado de cerca, así su hito se para detrás. En el `kit`, `r` es el radio
 * de la pieza en el suelo, `zones` dónde crece (cerca del camino, a media distancia o
 * lejos), `w` su peso en el sorteo, `s` su rango de tamaños, `h` su alto (para que la
 * copa de un árbol no tape un nivel) y `flip` si se puede dar vuelta (lo que no tiene luz
 * propia ni un lado en sombra).
 *
 * Lo que se mueve también lo dice cada módulo (ver `worldLife`): en el `kit`, `sway` es
 * cuánto se mece la pieza con el viento (`share`, qué parte de ellas; 0.8 si no dice),
 * `light` dónde tiene su fuego y de qué color, y `low` si es bajita (no tapa a lo que se
 * mece detrás). En la tierra, `life` pide el viento que cruza (`wind`: su clase y
 * cuántas ráfagas) y las matas secas que ruedan (`tumble`); el agua se mueve sola según
 * su clase, y los hitos traen lo suyo en `WORLD_MARKS`.
 */
export const WORLD_LANDS = {
  // El valle de otoño: pasto dorado, sombras lavanda, tótems tallados.
  valle: {
    ground: '#c8ae6a', light: '#ecd896', shade: '#a2788c', frame: '#4a3350', cast: '#5a3d5c',
    path: '#f6e4b4', pathLight: '#fff5da', pathShade: '#c9a986', halo: '#a88a86', brush: ['#e4cf86', '#9c8a7a'],
    plate: ['#f3dcae', '#c49a88'], marks: 'grass',
    weather: 'leaves', pattern: [0.62, 0.2, 0.48, 0.75, 0.4, 0.15, 0.42, 0.68, 0.3, 0.85], density: { near: 0.2, mid: 0.42, far: 0.86 },
    water: { kind: 'stream', between: 1, bridge: 'wood', colors: ['#3e7d97', '#5b9fae', '#9ccfcb'], bank: '#c49c8a' },
    pond: { at: 5, colors: ['#3e7d97', '#5b9fae', '#9ccfcb'], bank: '#c49c8a' },
    landmark: 'totems',
    life: { wind: { kind: 'breeze', n: 4 } },
    kit: [
      { kind: 'tree-a', draw: (id) => artTree(id, { shadow: '#9c4a5e', mid: '#df8646', light: '#f5b666', trunk: '#6d4a3e', trunkShadow: '#4a2f44', cast: worldCast('valle') }), h: 140, r: 36, zones: ['mid', 'far'], w: 2.6, s: [0.7, 1.05] , sway: 1 },
      { kind: 'tree-b', draw: (id) => artTree(id, { shadow: '#96665e', mid: '#e0b24c', light: '#f5d57e', trunk: '#6d4a3e', trunkShadow: '#4a2f44', cast: worldCast('valle') }), h: 140, r: 36, zones: ['mid', 'far'], w: 1.8, s: [0.7, 1.05] , sway: 1 },
      { kind: 'tree-c', draw: (id) => artTree(id, { shadow: '#7a3452', mid: '#c95347', light: '#ec8458', trunk: '#6d4a3e', trunkShadow: '#4a2f44', cast: worldCast('valle') }), h: 140, r: 36, zones: ['mid', 'far'], w: 1.2, s: [0.7, 1.05] , sway: 1 },
      { kind: 'conifer', draw: (id) => artConifer(id, { shadow: '#2a4a5c', mid: '#3e7a76', light: '#72ad8e', trunk: '#5a3e3e', cast: worldCast('valle') }), h: 156, r: 24, zones: ['mid', 'far'], w: 3.2, s: [0.75, 1.15] , sway: 0.75 },
      { kind: 'bush-a', draw: (id) => artBush(id, { shadow: '#8a4a58', mid: '#c77a4c', light: '#eaa662', cast: worldCast('valle') }), h: 48, r: 26, zones: ['near', 'mid'], w: 2.4, s: [0.7, 1.1] },
      { kind: 'bush-b', draw: (id) => artBush(id, { shadow: '#2c4c58', mid: '#4a8474', light: '#7fb48e', cast: worldCast('valle') }), h: 48, r: 26, zones: ['near', 'mid'], w: 1.6, s: [0.7, 1.1] },
      { kind: 'rock', draw: () => artRock({ shadow: '#6a5a88', mid: '#9c8cb2', light: '#cfbfd8', cast: worldCast('valle') }), r: 22, zones: ['near', 'mid'], w: 1.6, s: [0.6, 1] },
      { kind: 'grass', draw: () => artGrass({ grass: '#c890b2', grassShadow: '#9a6a96', cast: worldCast('valle') }), r: 14, zones: ['near', 'mid', 'far'], w: 3.6, s: [0.9, 1.4], flip: true , low: true },
      { kind: 'grass-b', draw: () => artGrass({ grass: '#e6cf78', grassShadow: '#a8955e', cast: worldCast('valle') }), r: 14, zones: ['near', 'mid', 'far'], w: 3.6, s: [0.9, 1.5], flip: true , low: true },
      { kind: 'flowers', draw: () => artFlowers({ petal: '#f3b6c6', petal2: '#c7a6e0', core: '#f6d58a', leaf: '#8aa466' }), r: 14, zones: ['near'], w: 2, s: [0.9, 1.3], flip: true , low: true },
      { kind: 'mushrooms', draw: () => artMushrooms({ stem: '#efdcc2', cap: '#c65a4a', capShadow: '#8e3a4c', dots: '#f6e4cc', cast: worldCast('valle') }), r: 16, zones: ['near', 'mid'], w: 0.9, s: [0.8, 1.2] , low: true },
      { kind: 'totem', draw: () => artTotem({ mid: '#d9a26a', light: '#f3c98c', shadow: '#976272', carve: '#5a3448', stripe: '#f6e8d4', moss: '#e6c26c', cast: worldCast('valle') }), h: 66, r: 18, zones: ['mid'], w: 0.35, s: [0.85, 1.1] },
      { kind: 'lantern', draw: () => artLantern({ mid: '#bfae9e', light: '#dccbb4', shadow: '#806a78', window: '#ffe2a0', cast: worldCast('valle') }), h: 60, r: 14, zones: ['near'], w: 0.4, s: [0.9, 1.1] , light: { x: 0, y: -40, r: 30, kind: 'warm' } },
    ],
    art: { mid: '#d9a26a', light: '#f3c98c', shadow: '#976272', carve: '#5a3448', stripe: '#f6e8d4', moss: '#e6c26c', cast: worldCast('valle') },
    bridge: { deck: '#b98458', deckLight: '#d8a574', line: '#7a5048', rail: '#6e4640', railLight: '#a8765a', post: '#5a3a3a', cast: '#5e3b5a' },
  },
  // La costa: arena dorada con sombras azules y el mar turquesa.
  costa: {
    ground: '#f0c878', light: '#fde4a8', shade: '#7a82b4', frame: '#2e3a5a', cast: '#434d7a',
    path: '#f7dfae', pathLight: '#fff3d4', pathShade: '#d2ab78', halo: '#b38a78', brush: ['#f8d690', '#c7996e'],
    plate: ['#f6e0b2', '#c49a78'], marks: 'sand',
    weather: 'glints', pattern: [0.72, 0.38, 0.65, 0.82, 0.45, 0.4, 0.7, 0.55, 0.4, 0.85], density: { near: 0.2, mid: 0.38, far: 0.7 },
    sea: { deep: '#105a74', mid: '#2294ad', shallow: '#5fc1c1', foam: '#d8f1e8', wave: '#8fd6cf', wet: '#cf9f62', depth: 0.22, bay: 0.3 },
    dock: { at: 5, deck: '#c48a52', deckLight: '#e0ae72', line: '#7c5248', post: '#5a3a3a', cast: '#43507a' },
    landmark: 'ship',
    life: { wind: { kind: 'breeze', n: 3 } },
    kit: [
      { kind: 'palm', draw: (id) => artPalm(id, { trunk: '#b98252', trunkShadow: '#6f4a4a', frondShadow: '#2c6566', frondMid: '#4d9658', frondLight: '#8cc46c', nut: '#6d4a3a', cast: worldCast('costa') }), h: 166, r: 28, zones: ['mid', 'far'], w: 5, s: [0.75, 1.1] , sway: 1.6 },
      { kind: 'bush', draw: (id) => artBush(id, { shadow: '#2c5a5c', mid: '#55955c', light: '#94c876', cast: worldCast('costa') }), h: 48, r: 26, zones: ['mid', 'far'], w: 3, s: [0.7, 1.05] },
      { kind: 'grass', draw: () => artGrass({ grass: '#98b46a', grassShadow: '#5f8a62', cast: worldCast('costa') }), r: 14, zones: ['near', 'mid'], w: 4, s: [0.9, 1.4], flip: true , low: true },
      { kind: 'shells', draw: () => artShells({ shell: '#f2c6b6', shellShadow: '#c38a8e', star: '#e78a5a', starShadow: '#b35a4e' }), r: 16, zones: ['near'], w: 2, s: [0.9, 1.2], flip: true , low: true },
      { kind: 'rock', draw: () => artRock({ shadow: '#5c587c', mid: '#8e8aa6', light: '#c3bfcf', cast: worldCast('costa') }), r: 22, zones: ['near', 'mid'], w: 1.6, s: [0.6, 1] },
      { kind: 'cargo', draw: () => artCargo({ wood: '#c48a52', woodShadow: '#7c5248', woodLight: '#e2b172', hoop: '#4c3a40', cast: worldCast('costa') }), r: 28, zones: ['near'], w: 0.6, s: [0.9, 1] },
    ],
    art: { wood: '#b8703e', woodShadow: '#6f4048', woodLight: '#dca068', sail: '#f3e6c8', sailShadow: '#b8aac8', rope: '#6b4a3e', ink: '#2a2334', bone: '#f2eadb', window: '#ffd98e' },
  },
  // El bosque nevado: nieve blanca de sombras celestes, árboles de hojas naranjas bajo la
  // nieve y el árbol sagrado.
  nieve: {
    ground: '#e6eef0', light: '#fffcf0', shade: '#a4d0d4', frame: '#3f5a68', cast: '#5f8a9a',
    path: '#cfdfe2', pathLight: '#edf4f3', pathShade: '#a9c8cc', halo: '#9cc2c8', brush: ['#ffffff', '#b4d8da'],
    plate: ['#f2f6f4', '#a9c6cc'], marks: 'snow',
    weather: 'snow', pattern: [0.7, 0.25, 0.55, 0.78, 0.4, 0.2, 0.5, 0.68, 0.32, 0.85], density: { near: 0.2, mid: 0.45, far: 0.86 },
    lake: { at: 5, colors: ['#8cc4d4', '#b8dfe6', '#f4fbfa'], rim: '#6c9cb0' },
    landmark: 'sacredtree',
    life: { wind: { kind: 'powder', n: 5 } },
    kit: [
      { kind: 'tree', draw: (id) => artSnowTree(id, { shadow: '#9a4838', mid: '#e06c3c', light: '#f39c58', snow: '#fbfaf3', snowShade: '#b2d9dc', trunk: '#6a8282', trunkShadow: '#44585f', cast: worldCast('nieve') }), h: 140, r: 36, zones: ['mid', 'far'], w: 4, s: [0.7, 1.05] , sway: 1 },
      { kind: 'conifer', draw: (id) => artConifer(id, { shadow: '#2c4852', mid: '#4c6e74', light: '#7c9c98', snow: '#fbfaf3', snowShade: '#b2d9dc', trunk: '#5a4a4a', cast: worldCast('nieve') }, true), h: 156, r: 24, zones: ['mid', 'far'], w: 3, s: [0.75, 1.15] , sway: 0.75 },
      { kind: 'mound', draw: () => artSnowMound({ snow: '#fbfaf3', snowShade: '#b2d9dc', grass: '#e0904a', cast: worldCast('nieve') }), h: 40, r: 26, zones: ['near', 'mid'], w: 3, s: [0.7, 1.1] , low: true },
      { kind: 'rock', draw: () => artRock({ shadow: '#56687a', mid: '#8c9ea6', light: '#bccccf', cap: '#fbfaf3', cast: worldCast('nieve') }), r: 22, zones: ['near', 'mid'], w: 1.8, s: [0.6, 1] },
      { kind: 'grass', draw: () => artGrass({ grass: '#e49c54', grassShadow: '#c06a3a', cast: worldCast('nieve') }), r: 14, zones: ['near', 'mid'], w: 2.6, s: [0.9, 1.4], flip: true , low: true },
      { kind: 'lantern', draw: () => artLantern({ mid: '#8ea0a6', light: '#b6c6c8', shadow: '#5a6c76', window: '#ffe2a0', snow: '#fbfaf3', cast: worldCast('nieve') }, true), h: 60, r: 14, zones: ['near'], w: 0.6, s: [0.9, 1.1] , light: { x: 0, y: -40, r: 30, kind: 'warm' } },
    ],
    art: { bark: '#34405a', barkLight: '#56647e', barkShadow: '#222a3e', hollow: '#12182a', wisp: '#9ff5e6', rope: '#b98c6c', snow: '#fbfaf3', snowShade: '#b2d9dc', shadow: '#9a4838', mid: '#e06c3c', light: '#f39c58', leaf: '#e8763e', cast: worldCast('nieve') },
  },
  // La guarida: ciruela y magenta de sombras índigo, faroles de papel rojos, gatitos de
  // la suerte, niebla que se arrastra y la calabaza gigante.
  guarida: {
    ground: '#5a324e', light: '#8c5670', shade: '#2a2240', frame: '#140a1e', cast: '#170c22',
    path: '#957488', pathLight: '#b4929c', pathShade: '#6c4c66', halo: '#3a2640', brush: ['#7a4a66', '#3a2644'],
    plate: ['#a4889a', '#5c3e58'], marks: 'cracks',
    weather: 'embers', pattern: [0.7, 0.3, 0.6, 0.8, 0.45, 0.25, 0.55, 0.62, 0.35, 0.85], density: { near: 0.2, mid: 0.4, far: 0.78 },
    water: { kind: 'river', between: 4, bridge: 'stone', colors: ['#262654', '#3a3a78', '#7472b6'], bank: '#34203e' },
    landmark: 'pumpkin',
    life: { wind: { kind: 'mist', n: 4 } },
    kit: [
      { kind: 'deadtree', draw: () => artDeadTree({ bark: '#3c2238', barkLight: '#6e4462', barkShadow: '#241428', cast: worldCast('guarida') }), h: 124, r: 24, zones: ['mid', 'far'], w: 5, s: [0.8, 1.2] , sway: 0.45 },
      { kind: 'thorns', draw: (id) => artThorns(id, { shadow: '#281a34', mid: '#4a2c4a', light: '#6e4466', cast: worldCast('guarida') }), h: 52, r: 26, zones: ['mid', 'far'], w: 3, s: [0.7, 1.05] },
      { kind: 'rock', draw: () => artRock({ shadow: '#2a2040', mid: '#4c3a60', light: '#705c84', cast: worldCast('guarida') }), r: 22, zones: ['near', 'mid', 'far'], w: 2.4, s: [0.6, 1.1] },
      { kind: 'lantern', draw: () => artPaperLantern({ post: '#2e1c26', paper: '#d8483a', paperShadow: '#962a36', band: '#f0c46a', cast: worldCast('guarida') }), h: 60, r: 16, zones: ['near'], w: 0.9, s: [0.9, 1.1] , light: { x: 12, y: -52, r: 40, kind: 'red' } },
      { kind: 'cat', draw: () => artCat({ body: '#eadcd0', shade: '#b89eb2', ear: '#e89aaa', ink: '#3a2230', collar: '#c83a3a', bell: '#f0c060', cast: worldCast('guarida') }), r: 14, zones: ['near'], w: 0.6, s: [0.9, 1.1] },
      { kind: 'vase', draw: () => artVase({ mid: '#6e4a5e', light: '#8e6a7a', shadow: '#3e2a3e', ink: '#1e1220', cast: worldCast('guarida') }), r: 12, zones: ['near', 'mid'], w: 1.2, s: [0.8, 1.2] },
      { kind: 'candles', draw: () => artCandles({ wax: '#efe0d0', waxShadow: '#c4a8b0', flame: '#ffb050', cast: worldCast('guarida') }), r: 14, zones: ['near'], w: 0.7, s: [0.9, 1.1] , light: { x: 0, y: -20, r: 34, kind: 'fire' } },
      { kind: 'mushrooms', draw: () => artMushrooms({ stem: '#d9c8e2', cap: '#8a5aa8', capShadow: '#5a3a78', dots: '#e6d6f0', cast: worldCast('guarida') }), r: 16, zones: ['near', 'mid'], w: 1, s: [0.8, 1.2] , low: true },
    ],
    art: {
      mid: '#e8853c', light: '#f9b560', shadow: '#a8506a', deep: '#6e3058', rim: '#8a2e2a', glow: '#ffc85a', core: '#fff0b4',
      stem: '#6a5a3a', stemLight: '#9a8a58', vine: '#4e6e44', leaf: '#6a9a50', leafShadow: '#3c5e40',
      post: '#2e1c26', lantern: '#d8483a', lanternShadow: '#962a36', wax: '#efe0d0', waxShadow: '#c4a8b0', flame: '#ffb050', cast: worldCast('guarida'),
    },
    bridge: { deck: '#6e5a7a', line: '#3e2e4c', wall: '#4a3a58', wallLight: '#8a7898', cast: '#170c22' },
  },
  // El coliseo: arena terracota de sombras malva, estandartes rojos y lanzas clavadas.
  coliseo: {
    ground: '#d69860', light: '#f1c68c', shade: '#8a5a66', frame: '#3a1a1c', cast: '#4a2a36',
    path: '#f0d6a6', pathLight: '#fbe9c8', pathShade: '#c69a72', halo: '#a87060', brush: ['#efc080', '#a8705e'],
    plate: ['#f2dcb4', '#b8866c'], marks: 'sand',
    weather: 'confetti', pattern: [0.7, 0.3, 0.55, 0.75, 0.4, 0.25, 0.5, 0.6, 0.35, 0.85], density: { near: 0.2, mid: 0.36, far: 0.62 },
    pond: { at: 1, colors: ['#3c8a98', '#5eaeae', '#a0d6ca'], bank: '#e8c48e' },
    landmark: 'colosseum',
    life: { wind: { kind: 'dust', n: 3 }, tumble: { n: 4, colors: ['#8a5a3e', '#a8703e', '#d09a58'] } },
    kit: [
      { kind: 'column', draw: () => artColumn({ light: '#f6e6c8', mid: '#e0c89e', shadow: '#a88690', cast: worldCast('coliseo') }), h: 107, r: 22, zones: ['mid'], w: 1.6, s: [0.8, 1.05] },
      { kind: 'ruin', draw: () => artColumn({ light: '#f6e6c8', mid: '#e0c89e', shadow: '#a88690', cast: worldCast('coliseo') }, true), h: 64, r: 30, zones: ['near', 'mid'], w: 1.8, s: [0.8, 1.05] },
      { kind: 'cactus', draw: () => artCactus({ shadow: '#3c5a52', mid: '#6a8a4c', light: '#9eba6c', dots: '#34503e', cast: worldCast('coliseo') }), h: 66, r: 22, zones: ['mid', 'far'], w: 3, s: [0.8, 1.2] },
      { kind: 'dry', draw: () => artDryBush({ shadow: '#8a5a3e', mid: '#a8703e', light: '#d09a58', cast: worldCast('coliseo') }), r: 18, zones: ['near', 'mid', 'far'], w: 3, s: [0.8, 1.3], flip: true , low: true, sway: 1.8, share: 0.3 },
      { kind: 'rock', draw: () => artRock({ shadow: '#7c5c62', mid: '#b98a66', light: '#e2bc8a', cast: worldCast('coliseo') }), r: 22, zones: ['near', 'mid', 'far'], w: 2.2, s: [0.6, 1.1] },
      { kind: 'amphora', draw: () => artAmphora({ clay: '#b8643e', clayShadow: '#7a3a3c', band: '#efd29a', cast: worldCast('coliseo') }), r: 12, zones: ['near'], w: 0.8, s: [0.9, 1.1] },
      { kind: 'banner', draw: () => artBanner({ pole: '#5a3a2a', gold: '#e8b85a', cloth: '#b83a34', clothShadow: '#7a2432', cast: worldCast('coliseo') }), h: 96, r: 14, zones: ['near'], w: 0.7, s: [0.9, 1.05] },
      { kind: 'spear', draw: () => artSpear({ shaft: '#7a5a3a', head: '#d4dae0', headShadow: '#8a96b0', ribbon: '#b83a34', cast: worldCast('coliseo') }), h: 110, r: 14, zones: ['near', 'mid'], w: 1, s: [0.9, 1.1] },
      { kind: 'brazier', draw: () => artBrazier({ metal: '#4e3e36', stone: '#b89a78', stoneShadow: '#86685a', flame: '#ff9a3c', flameCore: '#ffe08a', cast: worldCast('coliseo') }), h: 58, r: 14, zones: ['near'], w: 0.5, s: [0.9, 1.05] , light: { x: 0, y: -40, r: 50, kind: 'fire' } },
    ],
    art: { top: '#efd6aa', wall: '#b8845a', sand: '#ecc690', sandShadow: '#b88a86', light: '#f4dcae', mid: '#d9ae7a', shadow: '#9a7486', arch: '#6a3e3e', pole: '#5a3a2a', cloth: '#b83a34', cast: worldCast('coliseo') },
  },
  // ---- Las tierras de los capítulos 6 a 20, cada una con la paleta de su fondo de pelea ----
  // El bosque de otoño: el piso de hojas doradas, troncos claros y faroles de piedra.
  bosque: {
    ground: '#d9a04a', light: '#f6cf78', shade: '#a2687a', frame: '#4c2c3a', cast: '#5e3a4c',
    path: '#f3dbac', pathLight: '#fff1d0', pathShade: '#c99e76', halo: '#a87e6a', brush: ['#f0c070', '#a6785e'],
    plate: ['#f3d9a8', '#c28c6c'], marks: 'grass',
    weather: 'leaves', pattern: [0.62, 0.25, 0.5, 0.78, 0.42, 0.2, 0.46, 0.7, 0.32, 0.85], density: { near: 0.22, mid: 0.46, far: 0.9 },
    water: { kind: 'stream', between: 2, bridge: 'wood', colors: ['#3e7d97', '#5b9fae', '#9ccfcb'], bank: '#b98a6a' },
    landmark: 'gate',
    life: { wind: { kind: 'breeze', n: 4 } },
    kit: [
      { kind: 'tree-a', draw: (id) => artTree(id, { shadow: '#a0483a', mid: '#e8863a', light: '#f8b85a', trunk: '#eadcc6', trunkShadow: '#a8907e', cast: worldCast('bosque') }), h: 140, r: 36, zones: ['mid', 'far'], w: 3, s: [0.75, 1.1], sway: 1 },
      { kind: 'tree-b', draw: (id) => artTree(id, { shadow: '#a0703a', mid: '#e6b23e', light: '#f8d870', trunk: '#eadcc6', trunkShadow: '#a8907e', cast: worldCast('bosque') }), h: 140, r: 36, zones: ['mid', 'far'], w: 2.4, s: [0.75, 1.1], sway: 1 },
      { kind: 'bush', draw: (id) => artBush(id, { shadow: '#94463e', mid: '#d9763c', light: '#f2a65a', cast: worldCast('bosque') }), h: 48, r: 26, zones: ['near', 'mid'], w: 2.4, s: [0.7, 1.1] },
      { kind: 'rock', draw: () => artRock({ shadow: '#6e5a7a', mid: '#a896a8', light: '#d8c8cc', cast: worldCast('bosque') }), r: 22, zones: ['near', 'mid'], w: 1.4, s: [0.6, 1] },
      { kind: 'grass', draw: () => artGrass({ grass: '#e8b85a', grassShadow: '#a8764a', cast: worldCast('bosque') }), r: 14, zones: ['near', 'mid', 'far'], w: 4, s: [0.9, 1.4], flip: true, low: true },
      { kind: 'mushrooms', draw: () => artMushrooms({ stem: '#efdcc2', cap: '#d0563e', capShadow: '#8e3a4c', dots: '#f6e4cc', cast: worldCast('bosque') }), r: 16, zones: ['near', 'mid'], w: 1.2, s: [0.8, 1.2], low: true },
      { kind: 'lantern', draw: () => artLantern({ mid: '#bfae9e', light: '#dccbb4', shadow: '#806a78', window: '#ffe2a0', cast: worldCast('bosque') }), h: 60, r: 14, zones: ['near'], w: 0.6, s: [0.9, 1.1], light: { x: 0, y: -40, r: 30, kind: 'warm' } },
    ],
    art: { mid: '#bfae9e', light: '#dccbb4', shadow: '#806a78', window: '#ffe2a0', rope: '#c8a46a', paper: '#f6efe0', moss: '#8aa466', leaf: '#e8863a', cast: worldCast('bosque') },
    bridge: { deck: '#b98458', deckLight: '#d8a574', line: '#7a5048', rail: '#6e4640', railLight: '#a8765a', post: '#5a3a3a', cast: '#5e3a4c' },
  },
  // La jungla: verdes hondos de sombra azul, el río y el templo de piedra.
  jungla: {
    ground: '#4f8c4c', light: '#8cc66c', shade: '#1e4a56', frame: '#0c2a2c', cast: '#14363c',
    path: '#d8c68c', pathLight: '#f0e2b0', pathShade: '#a8925e', halo: '#4e6e52', brush: ['#7cba66', '#2e5e4c'],
    plate: ['#e0d0a0', '#8a8a5a'], marks: 'grass',
    weather: 'petals', pattern: [0.7, 0.3, 0.55, 0.8, 0.45, 0.25, 0.55, 0.62, 0.35, 0.85], density: { near: 0.24, mid: 0.5, far: 0.92 },
    water: { kind: 'river', between: 4, bridge: 'stone', colors: ['#1e5e6a', '#2e8a8a', '#7ac6b4'], bank: '#3a5a3e' },
    landmark: 'temple',
    life: { wind: { kind: 'mist', n: 3 } },
    kit: [
      { kind: 'palm', draw: (id) => artPalm(id, { trunk: '#8a6a4a', trunkShadow: '#4e3a3a', frondShadow: '#1e4a46', frondMid: '#3a8452', frondLight: '#7cbe5c', nut: '#5a4a3a', cast: worldCast('jungla') }), h: 166, r: 28, zones: ['mid', 'far'], w: 3, s: [0.75, 1.1], sway: 1.4 },
      { kind: 'tree', draw: (id) => artTree(id, { shadow: '#1e4a46', mid: '#3c8a4c', light: '#78bc5a', trunk: '#6a5040', trunkShadow: '#3a2a32', cast: worldCast('jungla') }), h: 140, r: 36, zones: ['mid', 'far'], w: 3.4, s: [0.8, 1.15], sway: 1 },
      { kind: 'bush', draw: (id) => artBush(id, { shadow: '#1c4642', mid: '#3e8a4e', light: '#86c866', berry: '#e8507a', cast: worldCast('jungla') }), h: 48, r: 26, zones: ['near', 'mid'], w: 3, s: [0.7, 1.1] },
      { kind: 'flowers', draw: () => artFlowers({ petal: '#f05a8a', petal2: '#f6c84a', core: '#fff0b0', leaf: '#3a7a46' }), r: 14, zones: ['near'], w: 2.4, s: [0.9, 1.3], flip: true, low: true },
      { kind: 'grass', draw: () => artGrass({ grass: '#6cb45a', grassShadow: '#2e6a4a', cast: worldCast('jungla') }), r: 14, zones: ['near', 'mid', 'far'], w: 4, s: [0.9, 1.5], flip: true, low: true },
      { kind: 'rock', draw: () => artRock({ shadow: '#2a4a5a', mid: '#5a7a7a', light: '#9ab89a', cap: '#7aaa5a', cast: worldCast('jungla') }), r: 22, zones: ['near', 'mid'], w: 1.4, s: [0.6, 1] },
      { kind: 'mushrooms', draw: () => artMushrooms({ stem: '#e6dcc8', cap: '#e8a03a', capShadow: '#a8582e', dots: '#fff2d0', cast: worldCast('jungla') }), r: 16, zones: ['near', 'mid'], w: 0.8, s: [0.8, 1.2], low: true },
    ],
    art: { mid: '#8aa08a', light: '#b8c8a4', shadow: '#4a6a6a', roof: '#4e8a5a', roofShadow: '#2a5a4a', door: '#1a2a2a', glow: '#9af0d8', vine: '#3a7a46', leaf: '#5aa456', cast: worldCast('jungla') },
    bridge: { deck: '#8a8a7a', line: '#4a4a46', wall: '#6a6a5e', wallLight: '#a8a894', cast: '#14363c' },
  },
  // La laguna: pasto húmedo, el lago grande, juncos y el loto gigante.
  laguna: {
    ground: '#6aa886', light: '#a8dab0', shade: '#2a5a78', frame: '#0e2a3e', cast: '#1e3e58',
    path: '#e6dcb0', pathLight: '#fff6d6', pathShade: '#b4a882', halo: '#6a8a86', brush: ['#94cc9a', '#3a6a6a'],
    plate: ['#eae0b8', '#8aa496'], marks: 'grass',
    weather: 'glints', pattern: [0.66, 0.3, 0.55, 0.78, 0.4, 0.28, 0.5, 0.7, 0.36, 0.85], density: { near: 0.2, mid: 0.4, far: 0.8 },
    lake: { at: 5, colors: ['#2e7a9a', '#4aa2b8', '#c8ecee'], rim: '#3a6a6a' },
    pond: { at: 1, colors: ['#2e7a9a', '#4aa2b8', '#c8ecee'], bank: '#4a7a6a' },
    landmark: 'lotus',
    life: { wind: { kind: 'breeze', n: 3 } },
    kit: [
      { kind: 'tree', draw: (id) => artTree(id, { shadow: '#2a5a5e', mid: '#4a9a7a', light: '#8acc8a', trunk: '#6a5a4a', trunkShadow: '#3a3a3e', cast: worldCast('laguna') }), h: 140, r: 36, zones: ['mid', 'far'], w: 2.6, s: [0.75, 1.1], sway: 1 },
      { kind: 'reeds', draw: () => artReeds({ stem: '#4a8a5a', head: '#8a5a3a', leaf: '#6aaa6a', cast: worldCast('laguna') }), h: 56, r: 14, zones: ['near', 'mid'], w: 3, s: [0.9, 1.3], flip: true, sway: 1.2, share: 0.4 },
      { kind: 'lily', draw: () => artLily({ pad: '#5a9a5a', padShadow: '#3a6a4a', petal: '#f6b6cc', petalShadow: '#d47a9a', core: '#f6d870' }), r: 16, zones: ['near'], w: 1.4, s: [0.9, 1.2], low: true },
      { kind: 'bush', draw: (id) => artBush(id, { shadow: '#2a5a5a', mid: '#4e9a6e', light: '#8ccc84', cast: worldCast('laguna') }), h: 48, r: 26, zones: ['mid', 'far'], w: 2.6, s: [0.7, 1.05] },
      { kind: 'grass', draw: () => artGrass({ grass: '#7cbc80', grassShadow: '#3a7a6a', cast: worldCast('laguna') }), r: 14, zones: ['near', 'mid', 'far'], w: 4, s: [0.9, 1.4], flip: true, low: true },
      { kind: 'rock', draw: () => artRock({ shadow: '#3a5a72', mid: '#7a9aa6', light: '#bcd6d6', cast: worldCast('laguna') }), r: 22, zones: ['near', 'mid'], w: 1.4, s: [0.6, 1] },
    ],
    art: { bank: '#4a7a6a', water: '#2e7a9a', waterLight: '#4aa2b8', pad: '#5a9a5a', padShadow: '#3a6a4a', petal: '#f6b6cc', petalShadow: '#d47a9a', core: '#f6d870', cast: worldCast('laguna') },
  },
  // La isla del verano: arena brillante, el mar, pelotas de playa y el faro.
  isla: {
    ground: '#f2cc7a', light: '#ffe6aa', shade: '#7a86b8', frame: '#2a3a5c', cast: '#3e4c7c',
    path: '#f8e2b2', pathLight: '#fff6da', pathShade: '#d6ae7c', halo: '#b08c7c', brush: ['#fad894', '#c89a70'],
    plate: ['#f8e4b6', '#c69c7a'], marks: 'sand',
    weather: 'glints', pattern: [0.72, 0.42, 0.66, 0.82, 0.46, 0.42, 0.7, 0.56, 0.42, 0.85], density: { near: 0.2, mid: 0.36, far: 0.66 },
    sea: { deep: '#0e5a7e', mid: '#1e9ab6', shallow: '#5ccad0', foam: '#e0f6ee', wave: '#94dad4', wet: '#d4a464', depth: 0.22, bay: 0.3 },
    dock: { at: 5, deck: '#c48a52', deckLight: '#e0ae72', line: '#7c5248', post: '#5a3a3a', cast: '#3e4c7c' },
    landmark: 'lighthouse',
    life: { wind: { kind: 'breeze', n: 3 } },
    kit: [
      { kind: 'palm', draw: (id) => artPalm(id, { trunk: '#c08a56', trunkShadow: '#74504c', frondShadow: '#2a6a62', frondMid: '#4c9c5a', frondLight: '#94cc6c', nut: '#6d4a3a', cast: worldCast('isla') }), h: 166, r: 28, zones: ['mid', 'far'], w: 5, s: [0.75, 1.1], sway: 1.6 },
      { kind: 'ball', draw: () => artBall({ a: '#f6f0e0', b: '#e85a5a', c: '#4aa0e0', cast: worldCast('isla') }), r: 14, zones: ['near'], w: 0.8, s: [0.9, 1.2] },
      { kind: 'shells', draw: () => artShells({ shell: '#f6cebe', shellShadow: '#c8908e', star: '#ee8e5a', starShadow: '#b85e4e' }), r: 16, zones: ['near'], w: 2, s: [0.9, 1.2], flip: true, low: true },
      { kind: 'bush', draw: (id) => artBush(id, { shadow: '#2c5e5c', mid: '#58985c', light: '#9ccc78', cast: worldCast('isla') }), h: 48, r: 26, zones: ['mid', 'far'], w: 2.6, s: [0.7, 1.05] },
      { kind: 'grass', draw: () => artGrass({ grass: '#a0bc6c', grassShadow: '#628c62', cast: worldCast('isla') }), r: 14, zones: ['near', 'mid'], w: 3.4, s: [0.9, 1.4], flip: true, low: true },
      { kind: 'rock', draw: () => artRock({ shadow: '#5c587c', mid: '#8e8aa6', light: '#c3bfcf', cast: worldCast('isla') }), r: 22, zones: ['near', 'mid'], w: 1.4, s: [0.6, 1] },
      { kind: 'cargo', draw: () => artCargo({ wood: '#c48a52', woodShadow: '#7c5248', woodLight: '#e2b172', hoop: '#4c3a40', cast: worldCast('isla') }), r: 28, zones: ['near'], w: 0.5, s: [0.9, 1] },
    ],
    art: { shadow: '#5c587c', mid: '#8e8aa6', light: '#c3bfcf', wall: '#f6f0e6', wallShadow: '#b8b0c8', stripe: '#e05a4e', trim: '#4c4a6a', glass: '#ffe8a8', lamp: '#fff6d0', window: '#5a6a8a', cast: worldCast('isla') },
  },
  // La meseta: pasto seco dorado, sombras malva, acacias, matas que ruedan y el arco de roca.
  meseta: {
    ground: '#cca25a', light: '#efd28c', shade: '#8c6a88', frame: '#3c2a30', cast: '#4e3644',
    path: '#f0dcae', pathLight: '#fff0d0', pathShade: '#c8a27c', halo: '#a68270', brush: ['#e8c47a', '#a07a62'],
    plate: ['#f2dcb0', '#bc946e'], marks: 'sand',
    weather: 'leaves', pattern: [0.68, 0.3, 0.56, 0.78, 0.42, 0.26, 0.5, 0.66, 0.34, 0.85], density: { near: 0.18, mid: 0.34, far: 0.6 },
    landmark: 'arch',
    life: { wind: { kind: 'dust', n: 3 }, tumble: { n: 3, colors: ['#8a6a3e', '#b0844a', '#dcae66'] } },
    kit: [
      { kind: 'acacia', draw: (id) => artTree(id, { shadow: '#5a6a3e', mid: '#8a9a4c', light: '#c0c86a', trunk: '#6a4a3a', trunkShadow: '#3e2a2e', cast: worldCast('meseta') }), h: 140, r: 36, zones: ['mid', 'far'], w: 2.2, s: [0.7, 1], sway: 0.6 },
      { kind: 'dry', draw: () => artDryBush({ shadow: '#8a6a3e', mid: '#b0844a', light: '#dcae66', cast: worldCast('meseta') }), r: 18, zones: ['near', 'mid', 'far'], w: 3.4, s: [0.8, 1.3], flip: true, low: true, sway: 1.8, share: 0.3 },
      { kind: 'rock', draw: () => artRock({ shadow: '#7a4e5a', mid: '#c0765a', light: '#eaa478', cast: worldCast('meseta') }), r: 22, zones: ['near', 'mid', 'far'], w: 2.4, s: [0.6, 1.2] },
      { kind: 'grass', draw: () => artGrass({ grass: '#e2bc66', grassShadow: '#a8844e', cast: worldCast('meseta') }), r: 14, zones: ['near', 'mid', 'far'], w: 4, s: [0.9, 1.5], flip: true, low: true },
      { kind: 'cactus', draw: () => artCactus({ shadow: '#3c5a52', mid: '#6a8a4c', light: '#9eba6c', dots: '#34503e', cast: worldCast('meseta') }), h: 66, r: 22, zones: ['mid', 'far'], w: 1, s: [0.8, 1.1] },
    ],
    art: { mid: '#c0765a', light: '#eaa478', shadow: '#7a4e5a', top: '#e6b47e', cast: worldCast('meseta') },
  },
  // El cañón: piedra roja de sombras violeta, grietas y el termitero gigante.
  canon: {
    ground: '#b8584a', light: '#e48c66', shade: '#6a2e4c', frame: '#2a0e1c', cast: '#3a142a',
    path: '#ecc098', pathLight: '#fbdcbc', pathShade: '#b88470', halo: '#8a4a4e', brush: ['#d8785a', '#7a3a46'],
    plate: ['#f0c8a6', '#a8645c'], marks: 'cracks',
    weather: 'embers', pattern: [0.7, 0.32, 0.58, 0.8, 0.44, 0.26, 0.52, 0.64, 0.36, 0.85], density: { near: 0.18, mid: 0.36, far: 0.66 },
    landmark: 'hive',
    life: { wind: { kind: 'dust', n: 4 }, tumble: { n: 2, colors: ['#7a3a2e', '#a8583e', '#d08458'] } },
    kit: [
      { kind: 'rock', draw: () => artRock({ shadow: '#6a2e4a', mid: '#b05a4a', light: '#e48c66', cast: worldCast('canon') }), r: 22, zones: ['near', 'mid', 'far'], w: 3.4, s: [0.6, 1.4] },
      { kind: 'dry', draw: () => artDryBush({ shadow: '#7a3a2e', mid: '#a8583e', light: '#d08458', cast: worldCast('canon') }), r: 18, zones: ['near', 'mid', 'far'], w: 2.6, s: [0.8, 1.3], flip: true, low: true, sway: 1.8, share: 0.3 },
      { kind: 'thorns', draw: (id) => artThorns(id, { shadow: '#4a1e30', mid: '#8a3a3e', light: '#c06a4e', cast: worldCast('canon') }), h: 52, r: 26, zones: ['mid', 'far'], w: 2, s: [0.7, 1.05] },
      { kind: 'mushrooms', draw: () => artMushrooms({ stem: '#f0d8c0', cap: '#e8903a', capShadow: '#a8502e', dots: '#ffe8c8', cast: worldCast('canon') }), r: 16, zones: ['near', 'mid'], w: 1, s: [0.8, 1.2], low: true },
      { kind: 'grass', draw: () => artGrass({ grass: '#d8885a', grassShadow: '#94483e', cast: worldCast('canon') }), r: 14, zones: ['near', 'mid'], w: 2.4, s: [0.9, 1.3], flip: true, low: true },
    ],
    art: { mid: '#c26a4c', light: '#eca07a', shadow: '#7a3446', hole: '#3a0e1c', cast: worldCast('canon') },
  },
  // El cielo: un suelo de nubes rosadas, árboles en flor y el nido gigante.
  cielo: {
    ground: '#f0d4d0', light: '#fff2ec', shade: '#b4a0cc', frame: '#6a5a8c', cast: '#8a78ac',
    path: '#fff8f0', pathLight: '#ffffff', pathShade: '#dcc4cc', halo: '#c0a8c4', brush: ['#ffffff', '#c8b0cc'],
    plate: ['#fff4ec', '#c8a8bc'], marks: 'snow',
    weather: 'petals', pattern: [0.66, 0.3, 0.56, 0.78, 0.42, 0.26, 0.52, 0.66, 0.34, 0.85], density: { near: 0.2, mid: 0.4, far: 0.8 },
    landmark: 'nest',
    life: { wind: { kind: 'powder', n: 4 } },
    kit: [
      { kind: 'cloud', draw: () => artCloud({ shadow: '#d4bcd8', light: '#fffaf6', cast: worldCast('cielo') }), h: 40, r: 30, zones: ['near', 'mid', 'far'], w: 4, s: [0.8, 1.4], low: true },
      { kind: 'blossom', draw: (id) => artTree(id, { shadow: '#c0607e', mid: '#f08aa8', light: '#ffc6d6', trunk: '#8a5a5a', trunkShadow: '#5a3a46', cast: worldCast('cielo') }), h: 140, r: 36, zones: ['mid', 'far'], w: 2.6, s: [0.75, 1.1], sway: 1 },
      { kind: 'bush', draw: (id) => artBush(id, { shadow: '#a88ab8', mid: '#d6b8e0', light: '#f6e4f6', cast: worldCast('cielo') }), h: 48, r: 26, zones: ['near', 'mid'], w: 2, s: [0.7, 1.05] },
      { kind: 'flowers', draw: () => artFlowers({ petal: '#ffb6cc', petal2: '#c6b6f0', core: '#f6e08a', leaf: '#a8c49a' }), r: 14, zones: ['near'], w: 2.4, s: [0.9, 1.3], flip: true, low: true },
      { kind: 'column', draw: () => artColumn({ light: '#ffffff', mid: '#ece0ec', shadow: '#b8a4c8', cast: worldCast('cielo') }), h: 107, r: 22, zones: ['mid'], w: 0.6, s: [0.8, 1] },
    ],
    art: { mid: '#c08a5a', light: '#e4b47a', shadow: '#7a5a4a', cloud: '#fffaf6', cloudShadow: '#d4bcd8', egg: '#f6eee0', eggShadow: '#d8c8c8', spot: '#7ab0d8', cast: worldCast('cielo') },
  },
  // La caverna: roca magenta de sombras índigo, el río violeta y el cristal gigante.
  caverna: {
    ground: '#6c2c5c', light: '#a85488', shade: '#2a1042', frame: '#14061e', cast: '#1a0a28',
    path: '#a87c9c', pathLight: '#c89cb8', pathShade: '#7a5470', halo: '#3a1e48', brush: ['#8a3e72', '#3a1a48'],
    plate: ['#b894ac', '#6a3e64'], marks: 'cracks',
    weather: 'embers', pattern: [0.7, 0.3, 0.58, 0.8, 0.44, 0.24, 0.54, 0.64, 0.36, 0.85], density: { near: 0.2, mid: 0.4, far: 0.8 },
    water: { kind: 'river', between: 4, bridge: 'stone', colors: ['#2a1a5a', '#4a3a8a', '#9a8ad8'], bank: '#3a1a40' },
    landmark: 'geode',
    life: { wind: { kind: 'mist', n: 4 } },
    kit: [
      { kind: 'crystal', draw: () => artCrystal({ shadow: '#4a2a8a', mid: '#8a6ad8', light: '#c8b8ff', cast: worldCast('caverna') }), h: 46, r: 20, zones: ['near', 'mid', 'far'], w: 2.4, s: [0.7, 1.3], light: { x: 0, y: -24, r: 30, kind: 'teal' } },
      { kind: 'rock', draw: () => artRock({ shadow: '#2a1040', mid: '#5a2a5a', light: '#8a4a7a', cast: worldCast('caverna') }), r: 22, zones: ['near', 'mid', 'far'], w: 3, s: [0.6, 1.3] },
      { kind: 'mushrooms', draw: () => artMushrooms({ stem: '#d8c8e8', cap: '#4ac8c8', capShadow: '#2a7a8a', dots: '#d8fff8', cast: worldCast('caverna') }), r: 16, zones: ['near', 'mid'], w: 1.6, s: [0.8, 1.3], low: true, light: { x: 0, y: -22, r: 24, kind: 'teal' } },
      { kind: 'thorns', draw: (id) => artThorns(id, { shadow: '#281a34', mid: '#4a2c4a', light: '#6e4466', cast: worldCast('caverna') }), h: 52, r: 26, zones: ['mid', 'far'], w: 2, s: [0.7, 1.05] },
      { kind: 'candles', draw: () => artCandles({ wax: '#efe0d0', waxShadow: '#c4a8b0', flame: '#ffb050', cast: worldCast('caverna') }), r: 14, zones: ['near'], w: 0.4, s: [0.9, 1.1], light: { x: 0, y: -20, r: 34, kind: 'fire' } },
    ],
    art: { shadow: '#4a2a8a', mid: '#8a6ad8', light: '#d0c4ff', glowKind: 'teal', cast: worldCast('caverna') },
    bridge: { deck: '#6e5a7a', line: '#3e2e4c', wall: '#4a3a58', wallLight: '#8a7898', cast: '#1a0a28' },
  },
  // El desierto: arena caliente, el oasis, cactus, ruedan las matas y la carpa del mercado.
  desierto: {
    ground: '#e4b268', light: '#f9dc9a', shade: '#9a6a5c', frame: '#4a2a1c', cast: '#5c3628',
    path: '#f6e2b8', pathLight: '#fff4d8', pathShade: '#d0a87e', halo: '#b88a6a', brush: ['#f4cc84', '#b8865e'],
    plate: ['#f8e2b6', '#c8986c'], marks: 'sand',
    weather: 'confetti', pattern: [0.7, 0.3, 0.56, 0.8, 0.42, 0.26, 0.52, 0.66, 0.34, 0.85], density: { near: 0.16, mid: 0.3, far: 0.56 },
    pond: { at: 5, colors: ['#2e8a98', '#52b0b0', '#a6dccc'], bank: '#d8b07a' },
    landmark: 'tent',
    life: { wind: { kind: 'dust', n: 4 }, tumble: { n: 4, colors: ['#8a5a3e', '#a8703e', '#d09a58'] } },
    kit: [
      { kind: 'cactus', draw: () => artCactus({ shadow: '#3c5a52', mid: '#6a8a4c', light: '#9eba6c', dots: '#34503e', cast: worldCast('desierto') }), h: 66, r: 22, zones: ['mid', 'far'], w: 3, s: [0.8, 1.3] },
      { kind: 'dry', draw: () => artDryBush({ shadow: '#8a5a3e', mid: '#a8703e', light: '#d09a58', cast: worldCast('desierto') }), r: 18, zones: ['near', 'mid', 'far'], w: 2.6, s: [0.8, 1.3], flip: true, low: true, sway: 1.8, share: 0.3 },
      { kind: 'rock', draw: () => artRock({ shadow: '#7c5c62', mid: '#c8946a', light: '#f0c890', cast: worldCast('desierto') }), r: 22, zones: ['near', 'mid', 'far'], w: 2.4, s: [0.6, 1.2] },
      { kind: 'palm', draw: (id) => artPalm(id, { trunk: '#b98252', trunkShadow: '#6f4a4a', frondShadow: '#3a6a4a', frondMid: '#6a9a4a', frondLight: '#a8c86a', nut: '#6d4a3a', cast: worldCast('desierto') }), h: 166, r: 28, zones: ['mid'], w: 0.8, s: [0.75, 1], sway: 1.4 },
      { kind: 'amphora', draw: () => artAmphora({ clay: '#c86e3e', clayShadow: '#7a3a3c', band: '#efd29a', cast: worldCast('desierto') }), r: 12, zones: ['near'], w: 0.8, s: [0.9, 1.1] },
    ],
    art: { cloth: '#e8d4b0', clothShadow: '#a8886a', stripe: '#c84a3e', door: '#5a2a2a', pole: '#5a3a2a', flag: '#c84a3e', rope: '#8a6a4a', wood: '#c48a52', woodShadow: '#7c5248', woodLight: '#e2b172', hoop: '#4c3a40', cast: worldCast('desierto') },
  },
  // El ocaso: roca oscura de luz rosada, ríos de lava con puentes de piedra y el volcán.
  ocaso: {
    ground: '#7a3a5c', light: '#c8687c', shade: '#3a1a3c', frame: '#1a0a1a', cast: '#240e26',
    path: '#c49098', pathLight: '#e8b4b4', pathShade: '#8a5a6c', halo: '#4a2440', brush: ['#a8506a', '#3e1a3c'],
    plate: ['#d0a4a8', '#7a4460'], marks: 'cracks',
    weather: 'embers', pattern: [0.7, 0.32, 0.58, 0.8, 0.44, 0.24, 0.54, 0.64, 0.36, 0.85], density: { near: 0.18, mid: 0.36, far: 0.7 },
    water: { kind: 'river', between: 5, bridge: 'stone', colors: ['#d8402e', '#f2783a', '#ffd070'], bank: '#2a0e1c' },
    landmark: 'volcano',
    life: { wind: { kind: 'mist', n: 3 } },
    kit: [
      { kind: 'rock', draw: () => artRock({ shadow: '#200a1e', mid: '#4a1e3a', light: '#8a3e5a', cast: worldCast('ocaso') }), r: 22, zones: ['near', 'mid', 'far'], w: 3.4, s: [0.6, 1.5] },
      { kind: 'deadtree', draw: () => artDeadTree({ bark: '#3a1830', barkLight: '#6a3450', barkShadow: '#200c1c', cast: worldCast('ocaso') }), h: 124, r: 24, zones: ['mid', 'far'], w: 2.4, s: [0.8, 1.2], sway: 0.4 },
      { kind: 'crystal', draw: () => artCrystal({ shadow: '#7a1a2e', mid: '#d8443e', light: '#ff9a6a', cast: worldCast('ocaso') }), h: 46, r: 20, zones: ['near', 'mid'], w: 1.4, s: [0.7, 1.2], light: { x: 0, y: -24, r: 30, kind: 'fire' } },
      { kind: 'thorns', draw: (id) => artThorns(id, { shadow: '#280a20', mid: '#4a1a34', light: '#7a3048', cast: worldCast('ocaso') }), h: 52, r: 26, zones: ['mid', 'far'], w: 1.6, s: [0.7, 1.05] },
      { kind: 'brazier', draw: () => artBrazier({ metal: '#3e2e2e', stone: '#8a5a6a', stoneShadow: '#5a3a4a', flame: '#ff7a3c', flameCore: '#ffd08a', cast: worldCast('ocaso') }), h: 58, r: 14, zones: ['near'], w: 0.5, s: [0.9, 1.05], light: { x: 0, y: -40, r: 50, kind: 'fire' } },
    ],
    art: { mid: '#4a1e3a', light: '#8a3e5a', shadow: '#200a1e', lava: '#f2783a', lavaCore: '#ffd070', smoke: '#6a4a5a', cast: worldCast('ocaso') },
    bridge: { deck: '#5a3a4a', line: '#2a1420', wall: '#3a2232', wallLight: '#7a5468', cast: '#240e26' },
  },
  // El bosque nocturno: azules hondos, el lago oscuro, hongos que brillan y luciérnagas.
  nocturno: {
    ground: '#21405e', light: '#3e7090', shade: '#0a1a34', frame: '#040a18', cast: '#06101e',
    path: '#6a8aa8', pathLight: '#98b8cc', pathShade: '#3e5a78', halo: '#1e3450', brush: ['#3a6a8a', '#0e2440'],
    plate: ['#8aa6bc', '#3a5a76'], marks: 'grass',
    weather: 'fireflies', pattern: [0.66, 0.3, 0.56, 0.78, 0.42, 0.26, 0.52, 0.66, 0.34, 0.85], density: { near: 0.22, mid: 0.46, far: 0.9 },
    lake: { at: 5, colors: ['#0e2a4a', '#1e4a6e', '#8ac8e8'], rim: '#0a1a30' },
    landmark: 'glowshroom',
    life: { wind: { kind: 'mist', n: 4 } },
    kit: [
      { kind: 'conifer', draw: (id) => artConifer(id, { shadow: '#06182a', mid: '#123250', light: '#2a5a7a', trunk: '#1a2a3a', cast: worldCast('nocturno') }), h: 156, r: 24, zones: ['mid', 'far'], w: 4, s: [0.8, 1.2], sway: 0.6 },
      { kind: 'tree', draw: (id) => artTree(id, { shadow: '#0a2238', mid: '#1e4a6a', light: '#3a7a94', trunk: '#1e2a3a', trunkShadow: '#0e1622', cast: worldCast('nocturno') }), h: 140, r: 36, zones: ['mid', 'far'], w: 2.4, s: [0.75, 1.1], sway: 0.8 },
      { kind: 'mushrooms', draw: () => artMushrooms({ stem: '#c8e0ec', cap: '#3ad8d0', capShadow: '#1a8a9a', dots: '#e0fffa', cast: worldCast('nocturno') }), r: 16, zones: ['near', 'mid'], w: 2, s: [0.8, 1.3], low: true, light: { x: 0, y: -22, r: 26, kind: 'teal' } },
      { kind: 'grass', draw: () => artGrass({ grass: '#3e7a8a', grassShadow: '#1a3a54', cast: worldCast('nocturno') }), r: 14, zones: ['near', 'mid', 'far'], w: 4, s: [0.9, 1.4], flip: true, low: true },
      { kind: 'rock', draw: () => artRock({ shadow: '#0a1a30', mid: '#2a4a64', light: '#4e7a90', cast: worldCast('nocturno') }), r: 22, zones: ['near', 'mid'], w: 1.4, s: [0.6, 1] },
      { kind: 'lantern', draw: () => artLantern({ mid: '#4a6078', light: '#6a849a', shadow: '#2a3a4e', window: '#9af0e8', cast: worldCast('nocturno') }), h: 60, r: 14, zones: ['near'], w: 0.5, s: [0.9, 1.1], light: { x: 0, y: -40, r: 30, kind: 'teal' } },
    ],
    art: { stem: '#c8e0ec', stemShadow: '#7a9ab0', cap: '#2ac8c8', capShadow: '#127a8a', dots: '#e8fffa', stemS: '#c8e0ec', capS: '#3ad8d0', cast: worldCast('nocturno') },
  },
  // El salón de invierno: nieve, pinos, regalos y el gran árbol de Navidad.
  navidad: {
    ground: '#eef2f0', light: '#fffef6', shade: '#b2c8d8', frame: '#4a3a4e', cast: '#6a7a92',
    path: '#d8c4b8', pathLight: '#f0e2d6', pathShade: '#b49c94', halo: '#c8a8a8', brush: ['#ffffff', '#c8d8e2'],
    plate: ['#f6eee6', '#c4a8a8'], marks: 'snow',
    weather: 'snow', pattern: [0.7, 0.28, 0.56, 0.78, 0.4, 0.22, 0.5, 0.68, 0.32, 0.85], density: { near: 0.2, mid: 0.44, far: 0.86 },
    lake: { at: 5, colors: ['#9acce0', '#c4e4ee', '#f8fdfc'], rim: '#7aa6bc' },
    landmark: 'xmastree',
    life: { wind: { kind: 'powder', n: 5 } },
    kit: [
      { kind: 'conifer', draw: (id) => artConifer(id, { shadow: '#1e4a3e', mid: '#2e6a4e', light: '#5a9a6a', snow: '#fbfaf3', snowShade: '#b2d0dc', trunk: '#5a3a3a', cast: worldCast('navidad') }, true), h: 156, r: 24, zones: ['mid', 'far'], w: 4, s: [0.75, 1.15], sway: 0.6 },
      { kind: 'mound', draw: () => artSnowMound({ snow: '#fbfaf3', snowShade: '#b2d0dc', grass: '#c84a3e', cast: worldCast('navidad') }), h: 40, r: 26, zones: ['near', 'mid'], w: 3, s: [0.7, 1.1], low: true },
      { kind: 'gift-a', draw: () => artGift({ mid: '#c83a3e', light: '#e8706a', shadow: '#8a2232', ribbon: '#f0c460', cast: worldCast('navidad') }), r: 16, zones: ['near'], w: 1, s: [0.9, 1.2] },
      { kind: 'gift-b', draw: () => artGift({ mid: '#2e7a5a', light: '#5aa67a', shadow: '#1a4a3e', ribbon: '#f6f0e0', cast: worldCast('navidad') }), r: 16, zones: ['near'], w: 1, s: [0.9, 1.2] },
      { kind: 'lantern', draw: () => artLantern({ mid: '#8ea0a6', light: '#b6c6c8', shadow: '#5a6c76', window: '#ffd28a', snow: '#fbfaf3', cast: worldCast('navidad') }, true), h: 60, r: 14, zones: ['near'], w: 0.7, s: [0.9, 1.1], light: { x: 0, y: -40, r: 30, kind: 'warm' } },
      { kind: 'rock', draw: () => artRock({ shadow: '#56687a', mid: '#8c9ea6', light: '#bccccf', cap: '#fbfaf3', cast: worldCast('navidad') }), r: 22, zones: ['near', 'mid'], w: 1.2, s: [0.6, 1] },
    ],
    art: { mid: '#2e6a4e', shadow: '#1e4a3e', snow: '#fbfaf3', trunk: '#5a3a3a', ballA: '#d8403e', ballB: '#f0c460', star: '#ffd86a', giftLight: '#f6e0d0', giftShadow: '#8a5a5a', ribbon: '#f0c460', cast: worldCast('navidad') },
  },
  // Los engranajes: suelo de metal gris, grietas de óxido, engranajes y la torre del reloj.
  engranajes: {
    ground: '#6c6a7a', light: '#a4a2b6', shade: '#3a3a52', frame: '#141420', cast: '#1e1e2e',
    path: '#b8aa98', pathLight: '#d8ccb6', pathShade: '#8a7e72', halo: '#4a4a5a', brush: ['#8a889c', '#3e3e52'],
    plate: ['#c8bcaa', '#7a7080'], marks: 'cracks',
    weather: 'embers', pattern: [0.7, 0.3, 0.58, 0.8, 0.44, 0.26, 0.52, 0.64, 0.36, 0.85], density: { near: 0.18, mid: 0.36, far: 0.66 },
    water: { kind: 'river', between: 3, bridge: 'stone', colors: ['#2a2a3a', '#3e3e56', '#8a8aa6'], bank: '#2a2a36' },
    landmark: 'clocktower',
    life: { wind: { kind: 'mist', n: 3 } },
    kit: [
      { kind: 'gear', draw: () => artGear({ mid: '#8a8496', light: '#bcb6c8', shadow: '#4a4658', hole: '#2a2834', cast: worldCast('engranajes') }), h: 54, r: 26, zones: ['near', 'mid', 'far'], w: 2.4, s: [0.6, 1.3] },
      { kind: 'gear-gold', draw: () => artGear({ mid: '#c8963e', light: '#ecc06a', shadow: '#7a5432', hole: '#3a2a22', cast: worldCast('engranajes') }), h: 54, r: 26, zones: ['mid', 'far'], w: 1.2, s: [0.6, 1.1] },
      { kind: 'rock', draw: () => artRock({ shadow: '#2a2a3a', mid: '#5a586a', light: '#8a889a', cast: worldCast('engranajes') }), r: 22, zones: ['near', 'mid', 'far'], w: 2.4, s: [0.6, 1.2] },
      { kind: 'column', draw: () => artColumn({ light: '#b8b4c4', mid: '#8a8696', shadow: '#4a4658', cast: worldCast('engranajes') }, true), h: 64, r: 30, zones: ['near', 'mid'], w: 1.2, s: [0.8, 1.05] },
      { kind: 'brazier', draw: () => artBrazier({ metal: '#3e3a46', stone: '#7a7686', stoneShadow: '#4a4658', flame: '#ff9a3c', flameCore: '#ffe08a', cast: worldCast('engranajes') }), h: 58, r: 14, zones: ['near'], w: 0.5, s: [0.9, 1.05], light: { x: 0, y: -40, r: 50, kind: 'fire' } },
    ],
    art: { mid: '#7a7688', light: '#a8a4b8', shadow: '#3e3a4e', roof: '#5a4a5a', roofShadow: '#3a2e3e', face: '#f2e8d0', trim: '#c8963e', ink: '#2a2230', window: '#ffd28a', door: '#2a2230', gear: '#c8963e', gearLight: '#ecc06a', gearShadow: '#7a5432', hole: '#3a2a22', cast: worldCast('engranajes') },
    bridge: { deck: '#7a7688', line: '#3a3848', wall: '#5a5868', wallLight: '#a8a4b8', cast: '#1e1e2e' },
  },
  // El mar violeta: arena lila, el mar púrpura, cristales y el portal.
  violeta: {
    ground: '#7a5ab8', light: '#b498e8', shade: '#2e1e72', frame: '#120a34', cast: '#1e1248',
    path: '#d8c8f0', pathLight: '#f0e8ff', pathShade: '#a894cc', halo: '#5a4a9a', brush: ['#a888e0', '#3e2a8a'],
    plate: ['#e0d4f6', '#8a74c4'], marks: 'snow',
    weather: 'fireflies', pattern: [0.72, 0.42, 0.66, 0.82, 0.46, 0.42, 0.7, 0.56, 0.42, 0.85], density: { near: 0.18, mid: 0.36, far: 0.66 },
    sea: { deep: '#2a0e6a', mid: '#5a2aa8', shallow: '#9a6ae0', foam: '#eadcff', wave: '#c4a8f6', wet: '#6a4aa8', depth: 0.22, bay: 0.3 },
    dock: { at: 5, deck: '#8a6aa8', deckLight: '#b494d0', line: '#4a3a6a', post: '#3a2a5a', cast: '#1e1248' },
    landmark: 'portal',
    life: { wind: { kind: 'breeze', n: 3 } },
    kit: [
      { kind: 'crystal', draw: () => artCrystal({ shadow: '#4a2a9a', mid: '#9a6ae8', light: '#e4d4ff', cast: worldCast('violeta') }), h: 46, r: 20, zones: ['near', 'mid', 'far'], w: 3, s: [0.7, 1.4], light: { x: 0, y: -24, r: 30, kind: 'teal' } },
      { kind: 'bush', draw: (id) => artBush(id, { shadow: '#3e2a8a', mid: '#7a5ac8', light: '#c4a8f6', cast: worldCast('violeta') }), h: 48, r: 26, zones: ['mid', 'far'], w: 2.4, s: [0.7, 1.05] },
      { kind: 'coral', draw: (id) => artThorns(id, { shadow: '#8a2a6a', mid: '#d85a9a', light: '#ff9ac4', cast: worldCast('violeta') }), h: 52, r: 26, zones: ['near', 'mid'], w: 1.6, s: [0.7, 1.05] },
      { kind: 'shells', draw: () => artShells({ shell: '#e8d8ff', shellShadow: '#a894cc', star: '#ff9ac4', starShadow: '#c85a8a' }), r: 16, zones: ['near'], w: 1.6, s: [0.9, 1.2], flip: true, low: true },
      { kind: 'rock', draw: () => artRock({ shadow: '#2a1a6a', mid: '#5a4a9a', light: '#9a88d0', cast: worldCast('violeta') }), r: 22, zones: ['near', 'mid'], w: 1.4, s: [0.6, 1] },
    ],
    art: { shadow: '#4a2a9a', mid: '#8a6ad0', light: '#d4c4ff', swirl: '#3a1a8a', swirlLight: '#7a4ad8', core: '#e8dcff', cast: worldCast('violeta') },
  },
  // El amanecer, el final del viaje: lavanda y oro, columnas de mármol y la puerta del sol.
  amanecer: {
    ground: '#9a8cd4', light: '#d4ccf6', shade: '#4a4498', frame: '#1e1c4c', cast: '#2a2860',
    path: '#f6e8c8', pathLight: '#fff8e6', pathShade: '#c8b89e', halo: '#8a7cb8', brush: ['#c8bcf0', '#5a54a8'],
    plate: ['#faeed4', '#a898cc'], marks: 'snow',
    weather: 'petals', pattern: [0.66, 0.3, 0.56, 0.78, 0.42, 0.26, 0.52, 0.66, 0.34, 0.85], density: { near: 0.18, mid: 0.36, far: 0.7 },
    pond: { at: 1, colors: ['#6a8ad8', '#9ab4f0', '#eef4ff'], bank: '#b4a8e0' },
    landmark: 'sungate',
    life: { wind: { kind: 'breeze', n: 3 } },
    kit: [
      { kind: 'column', draw: () => artColumn({ light: '#fffaf0', mid: '#e8e0f6', shadow: '#a89ad0', cast: worldCast('amanecer') }), h: 107, r: 22, zones: ['mid'], w: 1.4, s: [0.8, 1.05] },
      { kind: 'ruin', draw: () => artColumn({ light: '#fffaf0', mid: '#e8e0f6', shadow: '#a89ad0', cast: worldCast('amanecer') }, true), h: 64, r: 30, zones: ['near', 'mid'], w: 1.4, s: [0.8, 1.05] },
      { kind: 'crystal', draw: () => artCrystal({ shadow: '#8a7ac8', mid: '#d4c8f6', light: '#ffffff', cast: worldCast('amanecer') }), h: 46, r: 20, zones: ['near', 'mid', 'far'], w: 1.6, s: [0.7, 1.3], light: { x: 0, y: -24, r: 30, kind: 'warm' } },
      { kind: 'blossom', draw: (id) => artTree(id, { shadow: '#9a6aa8', mid: '#e0a8d0', light: '#fff0f6', trunk: '#8a7a9a', trunkShadow: '#5a4a6e', cast: worldCast('amanecer') }), h: 140, r: 36, zones: ['mid', 'far'], w: 2.4, s: [0.75, 1.1], sway: 1 },
      { kind: 'cloud', draw: () => artCloud({ shadow: '#b8acdc', light: '#fffaf6', cast: worldCast('amanecer') }), h: 40, r: 30, zones: ['mid', 'far'], w: 2.4, s: [0.8, 1.3], low: true },
      { kind: 'flowers', draw: () => artFlowers({ petal: '#fff6e0', petal2: '#f6d8f0', core: '#f6d870', leaf: '#8aa0c8' }), r: 14, zones: ['near'], w: 2.4, s: [0.9, 1.3], flip: true, low: true },
    ],
    art: { mid: '#e8e0f6', light: '#fffaf0', shadow: '#a89ad0', inner: '#6a5ab8', door: '#3a2a6a', sun: '#ffd27a', sunLight: '#fff2c4', cast: worldCast('amanecer') },
  },
};

/** El orden de las tierras a lo largo del viaje: un capítulo, una tierra. */
export const WORLD_ORDER = [
  'valle', 'costa', 'nieve', 'guarida', 'coliseo', 'bosque', 'jungla', 'laguna', 'isla', 'meseta',
  'canon', 'cielo', 'caverna', 'desierto', 'ocaso', 'nocturno', 'navidad', 'engranajes', 'violeta', 'amanecer',
];

/** La casa del comienzo, en el Valle. */
const worldCampArt = {
  wood: '#c98a56', woodShadow: '#7c5050', door: '#5a3a34', window: '#ffe2a0', stone: '#9a8e96', smoke: '#eeeaf0',
  roof: '#c65a4a', roofLight: '#e08060', roofShadow: '#8e3a4c', dots: '#f6e4cc', flame: '#ff9a3c', flameCore: '#ffe08a', cast: worldCast('valle'),
};

/**
 * Cada hito: su dibujo, su escala y lo que ocupa en el suelo (en coordenadas de la pieza,
 * antes de escalar: `[x0, y0, x1, y1]`), que queda libre de otras piezas. `afloat` va en
 * el agua de su tierra (y se mece en ella: sale del dibujo, ver `worldLife`). `life` es
 * lo que se mueve en él, en coordenadas de la pieza: luces que titilan (`lights`, con
 * `beat: 'slow'` laten despacio) y fuegos fatuos o luciérnagas que suben (`wisps`).
 */
const WORLD_MARKS = {
  totems: {
    draw: (p) => artTotems(p), scale: 0.9, box: [-200, -230, 205, 36],
    // Los ojos tallados de las tres caras se encienden despacio, y alrededor, luciérnagas.
    life: [
      { as: 'lights', x: -122, y: -56, r: 16, kind: 'spirit', beat: 'slow' }, { as: 'lights', x: -102, y: -56, r: 16, kind: 'spirit', beat: 'slow' },
      { as: 'lights', x: 92, y: -71, r: 18, kind: 'spirit', beat: 'slow' }, { as: 'lights', x: 116, y: -71, r: 18, kind: 'spirit', beat: 'slow' },
      { as: 'lights', x: -15, y: -134, r: 22, kind: 'spirit', beat: 'slow' }, { as: 'lights', x: 15, y: -134, r: 22, kind: 'spirit', beat: 'slow' },
      { as: 'wisps', x: 0, y: -90, n: 6, spread: 190, kind: 'firefly' },
    ],
  },
  ship: {
    draw: (p) => artShip(p), scale: 0.62, box: [-170, -236, 216, 20], afloat: true,
    life: [{ as: 'ripples', x: 10, y: 6, rx: 190, ry: 26, n: 2 }],
  },
  sacredtree: {
    draw: (p, id) => artSacredTree(id, p), scale: 0.78, box: [-200, -340, 200, 30],
    life: [
      { as: 'lights', x: 0, y: -20, r: 44, kind: 'teal', beat: 'slow' },
      { as: 'wisps', x: 0, y: -24, n: 5, spread: 30, kind: 'teal' },
    ],
  },
  pumpkin: {
    draw: (p, id) => artPumpkin(id, p), scale: 0.8, box: [-214, -262, 214, 30],
    // La cara encendida titila como una vela adentro; las velas y los faroles, igual. Y
    // alrededor rondan fuegos fatuos.
    life: [
      { as: 'lights', x: -56, y: -136, r: 44, kind: 'fire' }, { as: 'lights', x: 56, y: -136, r: 44, kind: 'fire' },
      { as: 'lights', x: 0, y: -60, r: 70, kind: 'fire' },
      { as: 'lights', x: -86, y: 4, r: 30, kind: 'fire' }, { as: 'lights', x: 100, y: 6, r: 34, kind: 'fire' },
      { as: 'lights', x: -182, y: -96, r: 34, kind: 'red' }, { as: 'lights', x: 190, y: -88, r: 34, kind: 'red' },
      { as: 'wisps', x: 0, y: -150, n: 5, spread: 420, kind: 'ghost' },
    ],
  },
  colosseum: { draw: (p) => artColosseum(p), scale: 0.86, box: [-236, -300, 236, 10], door: true },
  gate: {
    draw: (p) => artGate(p), scale: 0.85, box: [-200, -240, 200, 30],
    life: [
      { as: 'lights', x: -166, y: -30, r: 26, kind: 'warm' }, { as: 'lights', x: 170, y: -30, r: 26, kind: 'warm' },
      { as: 'wisps', x: 0, y: -80, n: 5, spread: 260, kind: 'firefly' },
    ],
  },
  temple: {
    draw: (p) => artTemple(p), scale: 0.8, box: [-220, -270, 220, 30],
    life: [{ as: 'lights', x: 0, y: -160, r: 46, kind: 'teal', beat: 'slow' }, { as: 'wisps', x: 0, y: -170, n: 4, spread: 60, kind: 'teal' }],
  },
  lotus: {
    draw: (p) => artLotus(p), scale: 0.8, box: [-224, -170, 224, 44],
    life: [{ as: 'lights', x: 0, y: -90, r: 60, kind: 'warm', beat: 'slow' }, { as: 'ripples', x: 0, y: -12, rx: 170, ry: 36, n: 2 }],
  },
  lighthouse: {
    draw: (p) => artLighthouse(p), scale: 0.85, box: [-130, -340, 130, 24],
    life: [{ as: 'lights', x: 0, y: -282, r: 50, kind: 'warm', beat: 'slow' }],
  },
  arch: { draw: (p) => artArch(p), scale: 0.8, box: [-250, -290, 250, 30] },
  hive: {
    draw: (p) => artHive(p), scale: 0.8, box: [-170, -300, 170, 28],
    life: [{ as: 'lights', x: -30, y: -120, r: 20, kind: 'warm' }, { as: 'lights', x: 36, y: -96, r: 20, kind: 'warm' }],
  },
  nest: { draw: (p) => artNest(p), scale: 0.85, box: [-210, -160, 210, 30] },
  geode: {
    draw: (p) => artGeode(p), scale: 0.8, box: [-190, -300, 190, 30],
    life: [{ as: 'lights', x: 0, y: -140, r: 80, kind: 'teal', beat: 'slow' }, { as: 'wisps', x: 0, y: -120, n: 5, spread: 200, kind: 'teal' }],
  },
  tent: {
    draw: (p) => artTent(p), scale: 0.85, box: [-210, -270, 210, 30],
    life: [{ as: 'lights', x: 0, y: -40, r: 40, kind: 'warm' }],
  },
  volcano: {
    draw: (p) => artVolcano(p), scale: 0.75, box: [-240, -380, 240, 30],
    life: [{ as: 'lights', x: 0, y: -262, r: 70, kind: 'fire', beat: 'slow' }, { as: 'smoke', x: 0, y: -300, r: 22, n: 4 }],
  },
  glowshroom: {
    draw: (p) => artGlowShroom(p), scale: 0.8, box: [-170, -280, 170, 28],
    life: [
      { as: 'lights', x: -80, y: -214, r: 22, kind: 'teal', beat: 'slow' }, { as: 'lights', x: 50, y: -222, r: 24, kind: 'teal', beat: 'slow' },
      { as: 'lights', x: -20, y: -244, r: 20, kind: 'teal', beat: 'slow' }, { as: 'wisps', x: 0, y: -160, n: 6, spread: 320, kind: 'teal' },
    ],
  },
  xmastree: {
    draw: (p, id) => artXmasTree(id, p), scale: 0.85, box: [-170, -360, 170, 30],
    life: [{ as: 'lights', x: 0, y: -334, r: 34, kind: 'warm', beat: 'slow' }, { as: 'lights', x: -90, y: -40, r: 14, kind: 'red' }, { as: 'lights', x: 70, y: -60, r: 14, kind: 'warm' }],
  },
  clocktower: {
    draw: (p) => artClockTower(p), scale: 0.85, box: [-160, -340, 160, 24],
    life: [{ as: 'lights', x: 0, y: -110, r: 30, kind: 'warm' }, { as: 'smoke', x: 40, y: -330, r: 14, n: 3 }],
  },
  portal: {
    draw: (p) => artPortal(p), scale: 0.8, box: [-170, -340, 170, 26],
    life: [{ as: 'lights', x: 0, y: -150, r: 90, kind: 'teal', beat: 'slow' }, { as: 'wisps', x: 0, y: -150, n: 6, spread: 200, kind: 'teal' }],
  },
  // El final del viaje: el camino termina en su puerta (`door`).
  sungate: {
    draw: (p) => artSunGate(p), scale: 0.86, box: [-260, -360, 260, 30], door: true,
    life: [{ as: 'lights', x: 0, y: -230, r: 120, kind: 'warm', beat: 'slow' }, { as: 'wisps', x: 0, y: -180, n: 6, spread: 360, kind: 'firefly' }],
  },
};

/** La casa del comienzo: lo que se mueve en ella, como en los hitos (ver `WORLD_MARKS`). */
const WORLD_CAMP_LIFE = [
  { as: 'lights', x: -92, y: -4, r: 50, kind: 'fire' },
  { as: 'lights', x: 28, y: -34, r: 22, kind: 'warm', beat: 'slow' },
  { as: 'smoke', x: 30, y: -120, r: 12, n: 4 },
];

/** Catmull-Rom en (u, v), de `p1` a `p2`. */
function worldCurve(p0, p1, p2, p3, t) {
  const cr = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  return { u: cr(p0.u, p1.u, p2.u, p3.u), v: cr(p0.v, p1.v, p2.v, p3.v) };
}

/** Una curva suave por los puntos de control, muestreada cada `step` unidades. */
function worldSpline(ctrl, step = 14) {
  const pts = [];
  const idx = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(i - 1, 0)];
    const p3 = ctrl[Math.min(i + 2, ctrl.length - 1)];
    idx[i] = pts.length;
    const m = Math.max(2, Math.ceil(Math.hypot(ctrl[i + 1].u - ctrl[i].u, ctrl[i + 1].v - ctrl[i].v) / step));
    for (let j = 0; j < m; j++) pts.push(worldCurve(p0, ctrl[i], ctrl[i + 1], p3, j / m));
  }
  idx[ctrl.length - 1] = pts.length;
  pts.push({ u: ctrl.at(-1).u, v: ctrl.at(-1).v });
  return { pts, idx };
}

/**
 * La distancia de un punto a una polilínea, mirando solo los tramos cercanos a lo largo.
 * Los tramos van en cubetas de `bucket` a lo largo; un tramo que cae en dos cubetas se
 * mira una sola vez (`stamp`, sin armar un conjunto por consulta: se llama decenas de
 * miles de veces al armar el mundo). Más allá de `reach` devuelve `Infinity`.
 */
function worldNear(line, bucket = 100) {
  const buckets = new Map();
  line.forEach((p, i) => {
    if (i === line.length - 1) return;
    const lo = Math.floor(Math.min(p.u, line[i + 1].u) / bucket);
    const hi = Math.floor(Math.max(p.u, line[i + 1].u) / bucket);
    for (let b = lo; b <= hi; b++) {
      if (!buckets.has(b)) buckets.set(b, []);
      buckets.get(b).push(i);
    }
  });
  const stamp = new Int32Array(line.length);
  let call = 0;
  return (u, v, reach = 420) => {
    let best = Infinity;
    call++;
    const lo = Math.floor((u - reach) / bucket);
    const hi = Math.floor((u + reach) / bucket);
    for (let b = lo; b <= hi; b++) {
      const list = buckets.get(b);
      if (!list) continue;
      for (let k = 0; k < list.length; k++) {
        const i = list[k];
        if (stamp[i] === call) continue;
        stamp[i] = call;
        const a = line[i];
        const c = line[i + 1];
        const du = c.u - a.u;
        const dv = c.v - a.v;
        const len2 = du * du + dv * dv || 1;
        const t = Math.min(1, Math.max(0, ((u - a.u) * du + (v - a.v) * dv) / len2));
        const x = u - (a.u + du * t);
        const y = v - (a.v + dv * t);
        const d2 = x * x + y * y;
        if (d2 < best) best = d2;
      }
    }
    return best === Infinity ? best : Math.sqrt(best);
  };
}

/**
 * Arma el mundo para `chapters` (los de `adventureChapters()`) en la orientación dada.
 * Devuelve los datos que dibujan el mapa y ubican lo que se toca: el camino (`route`, en
 * unidades de pantalla, con cuánto del largo lleva cada punto), los niveles, los
 * capítulos a lo largo (`zones`), dónde va cada cartel, el agua, los hitos y las piezas.
 */
export function buildWorld(chapters, orient = 'h') {
  const o = WORLD_ORIENT[orient] ?? WORLD_ORIENT.h;
  const L = { ...WORLD_LAYOUT, start: o.start ?? WORLD_LAYOUT.start, seam: o.seam ?? WORLD_LAYOUT.seam };
  const C = o.cross;
  const n = chapters.length;
  // Dónde empieza cada capítulo a lo largo del viaje; el último número es donde termina.
  const starts = chapters.reduce((out, ch) => [...out, out.at(-1) + chapterLength(ch.levels.length)], [L.start]);
  const U = starts[n] + L.end;
  const vertical = orient === 'v';
  const toScreen = vertical ? (u, v) => ({ x: v, y: U - u }) : (u, v) => ({ x: u, y: v });
  const fromScreen = vertical ? (x, y) => ({ u: U - y, v: x }) : (x, y) => ({ u: x, v: y });
  const band = (b) => C * (o.band[0] + (o.band[1] - o.band[0]) * b);
  const landOf = (c) => WORLD_ORDER[((c % WORLD_ORDER.length) + WORLD_ORDER.length) % WORLD_ORDER.length];
  const chapterStart = (c) => starts[Math.min(n, Math.max(0, c))];
  const rng = makeRng(vertical ? 0x5eed2 : 0x5eed1);

  // ---- los niveles y el camino que pasa por ellos ----
  const levels = [];
  chapters.forEach((ch, c) => {
    const land = WORLD_LANDS[landOf(c)];
    ch.levels.forEach((lvl, k) => {
      const b = land.pattern[k] ?? (k % 2 ? 0.28 : 0.72);
      levels.push({ id: lvl.id, chapter: c, k, land: landOf(c), boss: Boolean(lvl.boss), u: chapterStart(c) + L.entry + k * L.gap, v: band(b) });
    });
  });

  // La casa del comienzo: el camino sale de su puerta, hacia adelante, y dobla al costado
  // del cartel —la fogata está del otro—. Recién pasada la casa sigue al primer nivel: si
  // fuera derecho, de parado subiría por encima del techo y de costado pisaría el fuego.
  const campAt = toScreen(L.start - 400, band(0.5) - 30);
  const campScale = 0.9;
  const campDoor = fromScreen(campAt.x, campAt.y + 40);
  const campExit = fromScreen(campAt.x + (vertical ? 205 : 190), campAt.y + (vertical ? 30 : 46));

  // El hito de cada jefe, parado detrás de él: de costado, arriba; parado, a la izquierda.
  // El barco de la Costa, en cambio, va en el agua.
  const landmarks = [];
  for (const lv of levels.filter((l) => l.boss)) {
    const kind = WORLD_LANDS[lv.land].landmark;
    if (!kind) continue;
    const at = toScreen(lv.u, lv.v);
    const mark = WORLD_MARKS[kind];
    let x;
    let y;
    if (mark.afloat) {
      const sea = WORLD_LANDS[lv.land].sea;
      const edge = C * sea.bay;
      if (vertical) { x = edge * 0.52; y = at.y + 40; } else { x = at.x + 110; y = edge * 0.78; }
    } else if (vertical) { x = at.x - o.behind; y = at.y + 30; } else { x = at.x + 30; y = at.y - o.behind; }
    landmarks.push({ kind, land: lv.land, x, y, s: mark.scale, level: lv.id });
  }

  const ctrl = [{ u: campDoor.u, v: campDoor.v }, { u: campExit.u, v: campExit.v }];
  let flip = 1;
  levels.forEach((lv, i) => {
    const prev = i ? levels[i - 1] : campExit;
    const gap = lv.u - prev.u;
    const mids = gap > L.gap * 1.3 ? [1 / 3, 2 / 3] : [0.5];
    for (const t of mids) {
      flip = -flip;
      const v = prev.v + (lv.v - prev.v) * t + flip * C * 0.035;
      ctrl.push({ u: prev.u + gap * t + (rng() - 0.5) * 30, v: Math.min(band(1.05), Math.max(band(-0.05), v)) });
    }
    ctrl.push({ u: lv.u, v: lv.v, level: i });
  });
  // El camino termina en la puerta del hito del último jefe, si tiene puerta (el Coliseo, la
  // puerta del Amanecer); si no, un poco más allá del último nivel.
  const finale = landmarks.find((m) => WORLD_MARKS[m.kind].door && m.level === levels.at(-1)?.id);
  if (finale) {
    const door = fromScreen(finale.x, finale.y + 6);
    ctrl.push({ u: door.u, v: door.v });
  } else {
    ctrl.push({ u: levels.at(-1).u + 200, v: levels.at(-1).v });
  }
  const spline = worldSpline(ctrl);
  const road = spline.pts;
  const roadDist = worldNear(road);
  const screenRoad = road.map((p) => toScreen(p.u, p.v));
  const lens = [0];
  for (let i = 1; i < screenRoad.length; i++) lens.push(lens[i - 1] + Math.hypot(screenRoad[i].x - screenRoad[i - 1].x, screenRoad[i].y - screenRoad[i - 1].y));
  const total = lens.at(-1) || 1;
  const route = { pts: screenRoad, at: lens.map((l) => l / total), length: total };
  ctrl.forEach((c, i) => {
    if (c.level === undefined) return;
    const lv = levels[c.level];
    const s = toScreen(lv.u, lv.v);
    Object.assign(lv, { x: s.x, y: s.y, f: route.at[spline.idx[i]] });
  });

  // El punto del camino más cercano a lo largo de `u` (para cruces, carteles y muelles).
  const roadAtU = (u) => {
    let best = 0;
    for (let i = 1; i < road.length; i++) if (Math.abs(road[i].u - u) < Math.abs(road[best].u - u)) best = i;
    return best;
  };
  const angleAt = (i) => {
    const a = screenRoad[Math.max(i - 2, 0)];
    const b = screenRoad[Math.min(i + 2, screenRoad.length - 1)];
    return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  };

  // ---- el agua ----
  const waters = [];
  const bridges = [];
  const docks = [];
  chapters.forEach((ch, c) => {
    const land = WORLD_LANDS[landOf(c)];
    const mine = levels.filter((l) => l.chapter === c);
    const u0 = chapterStart(c);
    if (land.water && mine[land.water.between + 1]) {
      const a = mine[land.water.between];
      const b = mine[land.water.between + 1];
      const i = roadAtU((a.u + b.u) / 2);
      const P = road[i];
      // Un río que culebrea: cruza el camino en `P`, entre los dos niveles, y se aleja de
      // ellos hacia los dos bordes del mapa.
      const line = [
        { u: P.u + 30, v: -90 }, { u: P.u - 70, v: P.v * 0.22 }, { u: P.u + 36, v: P.v * 0.6 }, { u: P.u, v: P.v },
        { u: P.u - 40, v: P.v + (C - P.v) * 0.4 }, { u: P.u + 60, v: P.v + (C - P.v) * 0.78 }, { u: P.u - 10, v: C + 90 },
      ];
      const pts = worldSpline(line, 18).pts;
      waters.push({ kind: land.water.kind, land: landOf(c), line: pts, near: worldNear(pts), width: 44 });
      const s = screenRoad[i];
      bridges.push({ x: s.x, y: s.y, angle: angleAt(i), land: landOf(c), stone: land.water.bridge === 'stone' });
    }
    for (const key of ['pond', 'lake']) {
      const spec = land[key];
      const lv = spec && mine[spec.at];
      if (!lv) continue;
      // Del lado contrario al del nivel, para que se vea y no lo tape.
      const nearSide = lv.v < C / 2;
      const cv = nearSide ? band(1) + 80 : band(0) - 70;
      const rx = key === 'lake' ? 190 : 120;
      const ry = key === 'lake' ? 88 : 64;
      waters.push({ kind: key, land: landOf(c), u: lv.u + 40, v: cv, rx, ry, seed: rng() });
    }
    if (land.sea) {
      // La bahía: el agua entra del lado de lejos, más honda cerca del jefe, y se cierra
      // redonda en las dos puntas del capítulo.
      const a = u0 + 60;
      const b = chapterStart(c + 1) - 40;
      const boss = mine.at(-1);
      const shore = [];
      for (let u = a; u <= b; u += 50) {
        const k = Math.sin(Math.PI * ((u - a) / (b - a))) ** 0.55;
        const nearBoss = boss ? Math.exp(-(((u - boss.u) / 420) ** 2)) : 0;
        const depth = C * (land.sea.depth + (land.sea.bay - land.sea.depth) * nearBoss);
        shore.push({ u, v: k * depth + Math.sin(u / 97) * 9 * k });
      }
      waters.push({ kind: 'sea', land: landOf(c), shore });
      const lv = land.dock && mine[land.dock.at];
      if (lv) {
        const i = roadAtU(lv.u + 150);
        const P = road[i];
        const edgeV = shore.reduce((best, s) => (Math.abs(s.u - P.u) < Math.abs(best.u - P.u) ? s : best), shore[0]).v;
        const len = P.v - WORLD_ROAD - 4 - (edgeV - 70);
        const from = toScreen(P.u, P.v - WORLD_ROAD - 2);
        docks.push({ x: from.x, y: from.y, len, angle: vertical ? 180 : -90, land: landOf(c) });
      }
    }
  });
  const inWater = (u, v, r) => waters.some((w) => {
    if (w.kind === 'stream' || w.kind === 'river') return w.near(u, v, 200) < w.width + 26 + r;
    if (w.kind === 'pond' || w.kind === 'lake') return ((u - w.u) / (w.rx + 30 + r)) ** 2 + ((v - w.v) / (w.ry + 26 + r)) ** 2 < 1;
    if (w.kind === 'sea') {
      if (u < w.shore[0].u - r || u > w.shore.at(-1).u + r) return false;
      const s = w.shore.reduce((best, p) => (Math.abs(p.u - u) < Math.abs(best.u - u) ? p : best), w.shore[0]);
      return v < s.v + 24 + r * 0.5;
    }
    return false;
  });

  // ---- los carteles de cada capítulo ----
  // En el medio entre el jefe del capítulo anterior y el primer nivel de este (en el
  // primero, entre la casa y el nivel 1).
  const signs = chapters.map((ch, c) => {
    const first = levels.find((l) => l.chapter === c);
    const prev = c ? [...levels].reverse().find((l) => l.chapter === c - 1) : campExit;
    const i = roadAtU(first && prev ? (first.u + prev.u) / 2 : chapterStart(c) + 30);
    const s = screenRoad[i];
    if (vertical) return { chapter: c + 1, x: s.x, y: s.y, side: 'on' };
    const far = road[i].v > band(0.45);
    return { chapter: c + 1, x: s.x, y: far ? s.y - 56 : s.y + 56, side: far ? 'far' : 'near' };
  });

  // ---- lo que queda libre de piezas: los niveles, los hitos, los carteles y la casa ----
  const blocks = [];
  for (const lv of levels) {
    const side = lv.boss ? o.duel.boss : o.duel.side;
    blocks.push({ x0: lv.x - side, y0: lv.y - o.duel.up, x1: lv.x + side, y1: lv.y + o.duel.down });
  }
  for (const m of landmarks) {
    const [x0, y0, x1, y1] = WORLD_MARKS[m.kind].box;
    blocks.push({ x0: m.x + x0 * m.s, y0: m.y + y0 * m.s, x1: m.x + x1 * m.s, y1: m.y + y1 * m.s });
  }
  for (const s of signs) {
    const w = vertical ? 230 : 170;
    const top = s.side === 'far' ? s.y - 130 : s.side === 'near' ? s.y : s.y - 80;
    blocks.push({ x0: s.x - w, y0: top, x1: s.x + w, y1: top + (s.side === 'on' ? 160 : 130) });
  }
  blocks.push({ x0: campAt.x - 140, y0: campAt.y - 150, x1: campAt.x + 150, y1: campAt.y + 40 });
  for (const d of docks) {
    const a = (d.angle * Math.PI) / 180;
    const ex = d.x + Math.cos(a) * d.len;
    const ey = d.y + Math.sin(a) * d.len;
    blocks.push({ x0: Math.min(d.x, ex) - 40, y0: Math.min(d.y, ey) - 40, x1: Math.max(d.x, ex) + 40, y1: Math.max(d.y, ey) + 40 });
  }
  // Una pieza alta (un árbol) también estorba con la copa: cuenta de su pie a su punta.
  // Los lugares libres van en una grilla de 400: cada pieza mira solo los de su casilla.
  const BLOCK_CELL = 400;
  const blockCells = new Map();
  for (const b of blocks) {
    for (let gx = Math.floor((b.x0 - 80) / BLOCK_CELL); gx <= Math.floor((b.x1 + 80) / BLOCK_CELL); gx++) {
      for (let gy = Math.floor((b.y0 - 80) / BLOCK_CELL); gy <= Math.floor((b.y1 + 260) / BLOCK_CELL); gy++) {
        const key = `${gx}|${gy}`;
        if (!blockCells.has(key)) blockCells.set(key, []);
        blockCells.get(key).push(b);
      }
    }
  }
  const blocked = (x, y, r, h = 0) => (blockCells.get(`${Math.floor(x / BLOCK_CELL)}|${Math.floor(y / BLOCK_CELL)}`) ?? []).some((b) =>
    x > b.x0 - r && x < b.x1 + r && y > b.y0 - r * 0.5 && y - h * 0.8 < b.y1 + r * 0.5);

  // ---- la tierra de cada lugar: fija adentro del capítulo, mezclada en las costuras ----
  const landAt = (u, pick = rng) => {
    const c = Math.min(n - 1, Math.max(0, starts.findLastIndex((at) => at <= u)));
    const seamIn = chapterStart(c);
    const seamOut = chapterStart(c + 1);
    if (c > 0 && u - seamIn < L.seam && pick() > 0.5 + (u - seamIn) / (2 * L.seam)) return landOf(c - 1);
    if (c < n - 1 && seamOut - u < L.seam && pick() > 0.5 + (seamOut - u) / (2 * L.seam)) return landOf(c + 1);
    return landOf(c);
  };

  // ---- el decorado ----
  const props = [];
  const grid = new Map();
  const CELL = 60;
  const key = (x, y) => `${Math.floor(x / 90)}|${Math.floor(y / 90)}`;
  const crowded = (x, y, r) => {
    for (let gx = -1; gx <= 1; gx++) {
      for (let gy = -1; gy <= 1; gy++) {
        for (const p of grid.get(`${Math.floor(x / 90) + gx}|${Math.floor(y / 90) + gy}`) ?? []) {
          // Una pieza delante de otra (más abajo en la pantalla) se puede encimar más que
          // una al lado de otra: de arriba, así se ve un bosque.
          if (Math.hypot(p.x - x, (p.y - y) * 0.8) < (p.r + r) * 0.78) return true;
        }
      }
    }
    return false;
  };
  for (let u = -CELL; u < U + CELL; u += CELL) {
    for (let v = -CELL; v < C + CELL; v += CELL) {
      const pu = u + rng() * CELL;
      const pv = v + rng() * CELL;
      const landId = landAt(pu);
      const land = WORLD_LANDS[landId];
      const d = roadDist(pu, pv, 340);
      const zone = d < 170 ? 'near' : d < 330 ? 'mid' : 'far';
      if (rng() > land.density[zone]) continue;
      const kit = land.kit.filter((k) => k.zones.includes(zone));
      let roll = rng() * kit.reduce((sum, k) => sum + k.w, 0);
      const item = kit.find((k) => (roll -= k.w) < 0) ?? kit[0];
      const s = item.s[0] + rng() * (item.s[1] - item.s[0]);
      const r = item.r * s;
      if (d < WORLD_ROAD + r + 16) continue;
      if (inWater(pu, pv, r)) continue;
      const at = toScreen(pu, pv);
      if (blocked(at.x, at.y, r, (item.h ?? 30) * s)) continue;
      if (crowded(at.x, at.y, r)) continue;
      const prop = { x: at.x, y: at.y, r, s, land: landId, kind: item.kind, flip: item.flip && rng() < 0.5 };
      props.push(prop);
      const cellKey = key(at.x, at.y);
      if (!grid.has(cellKey)) grid.set(cellKey, []);
      grid.get(cellKey).push(prop);
    }
  }

  const zones = chapters.map((ch, c) => {
    const a = c === 0 ? 0 : chapterStart(c);
    const b = c === n - 1 ? U : chapterStart(c + 1);
    return { chapter: c + 1, land: landOf(c), a: a / U, b: b / U };
  });

  return {
    orient, U, C, W: vertical ? C : U, H: vertical ? U : C, n, start: L.start, starts, seam: L.seam,
    toScreen, road, route, levels, zones, signs, landmarks, waters, bridges, docks, props,
    camp: { x: campAt.x, y: campAt.y, s: campScale },
    // La tierra de un lugar: sin `pick`, la de su capítulo; con él, mezclada en las costuras.
    landAt: (u, pick = () => 0.5) => landAt(u, pick),
  };
}

/** El dibujo del hito `i` del mundo, en sus coordenadas (el pie en el origen). */
export function worldMark(world, i) {
  const m = world.landmarks[i];
  const land = WORLD_LANDS[m.land];
  const art = WORLD_MARKS[m.kind].afloat && land.sea ? { ...land.art, foam: land.sea.foam, deep: land.sea.deep } : land.art;
  return WORLD_MARKS[m.kind].draw(art, `adv-lm-${i}`);
}

// ---- lo que se mueve ----------------------------------------------------------------

/** Qué parte de las piezas que se mecen se mece de verdad, si el `kit` no dice (`share`). */
const LIFE_SHARE = 0.8;

/**
 * Lo que se mueve en el mapa, por tierra. Cada módulo dice lo suyo y acá solo se reparte:
 *
 * - las piezas del `kit` que se mecen (`sway`) y las luces que titilan (`light`);
 * - el viento de cada tierra (`life.wind`): ráfagas de aire en el Valle y la Costa,
 *   polvo de nieve en el Bosque, niebla que se arrastra en la Guarida, arena en el
 *   Coliseo; y las matas secas que ruedan por el desierto (`life.tumble`);
 * - el agua, según su clase: la corriente de los ríos y arroyos, los anillos que se abren
 *   en las lagunas, las olas que llegan a la orilla del mar y los brillos;
 * - lo de cada hito (`WORLD_MARKS`: el barco que se mece, los ojos de los tótems, los
 *   fuegos fatuos alrededor de la calabaza) y de la casa (`WORLD_CAMP_LIFE`);
 * - y el cielo: las sombras de las nubes y una bandada.
 *
 * El dibujo es un solo SVG, y animar algo adentro lo vuelve a pintar entero a cada
 * cuadro. Por eso lo que se mueve sale del dibujo y va en una capa HTML por tierra (ver
 * `lifeHtml` en `adventure-map.js`), animada solo con `transform` y `opacity`. Un árbol
 * que se mece sale de la pieza del dibujo (`live`: `worldArt` no lo pinta) y va encima,
 * así que solo se eligen los que no tienen nada delante que se les cruce.
 *
 * Todo en unidades del mapa y relativo a su tierra (`x`, `y`), con azar sembrado: el
 * mismo mundo se mueve igual cada vez. Se llama una sola vez por mundo y antes del
 * dibujo (ver `worldFor`).
 */
export function worldLife(world) {
  const rng = makeRng(world.orient === 'v' ? 0x11fe2 : 0x11fe1);
  const vertical = world.orient === 'v';
  const zoneOf = (x, y) => {
    const f = vertical ? 1 - y / world.H : x / world.W;
    return world.zones.findIndex((z) => f >= z.a && f <= z.b);
  };
  const local = (i, x, y) => {
    const z = world.zones[i];
    return vertical ? { x, y: y - (1 - z.b) * world.H } : { x: x - z.a * world.W, y };
  };
  const zones = world.zones.map((z) => ({
    land: z.land, sway: [], lights: [], smoke: [], glints: [], clouds: [], birds: [], ships: [],
    wisps: [], ripples: [], flows: [], waves: [], gusts: [], tumbles: [],
    w: vertical ? world.W : (z.b - z.a) * world.W,
    h: vertical ? (z.b - z.a) * world.H : world.H,
  }));
  const put = (list, x, y, item) => {
    const i = zoneOf(x, y);
    if (i < 0) return;
    zones[i][list].push({ ...local(i, x, y), ...item });
  };
  const kitOf = (p) => WORLD_LANDS[p.land].kit.find((k) => k.kind === p.kind);
  const time = (a, b) => +(a + rng() * (b - a)).toFixed(2);
  // Lejos del camino: lo del agua no se dibuja sobre los puentes. Los puntos del camino van
  // en cubetas de 200: se mira solo lo cercano, no el camino entero.
  const ROAD_CELL = 200;
  const roadCells = new Map();
  world.route.pts.forEach((r, j) => {
    if (j % 3) return;
    const key = `${Math.floor(r.x / ROAD_CELL)}|${Math.floor(r.y / ROAD_CELL)}`;
    if (!roadCells.has(key)) roadCells.set(key, []);
    roadCells.get(key).push(r);
  });
  const offRoad = (q, reach) => {
    const span = Math.ceil(reach / ROAD_CELL);
    const cx = Math.floor(q.x / ROAD_CELL);
    const cy = Math.floor(q.y / ROAD_CELL);
    for (let gx = cx - span; gx <= cx + span; gx++) {
      for (let gy = cy - span; gy <= cy + span; gy++) {
        for (const r of roadCells.get(`${gx}|${gy}`) ?? []) if (Math.hypot(r.x - q.x, r.y - q.y) <= reach) return false;
      }
    }
    return true;
  };

  // Lo que puede tapar a lo que se mece: todo lo que no es bajito, los hitos y la casa.
  const front = [
    ...world.props.filter((p) => !kitOf(p).low).map((p) => ({ p, x: p.x, y: p.y, r: p.r, h: (kitOf(p).h ?? 30) * p.s })),
    ...world.landmarks.map((m) => ({ x: m.x, y: m.y, r: 240 * m.s, h: 320 * m.s })),
    { x: world.camp.x, y: world.camp.y, r: 150 * world.camp.s, h: 180 * world.camp.s },
  ];
  // Lo de adelante, en una grilla de 300: cada pieza mira solo las casillas a su costado
  // y por debajo de ella, hasta lo más alto que puede taparla (un hito mide ~330).
  const FRONT_CELL = 300;
  const cells = new Map();
  for (const q of front) {
    const row = Math.floor(q.y / FRONT_CELL);
    for (let c = Math.floor((q.x - q.r) / FRONT_CELL); c <= Math.floor((q.x + q.r) / FRONT_CELL); c++) {
      const key = `${c}|${row}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(q);
    }
  }
  for (const p of world.props) {
    const { sway: amp, share = LIFE_SHARE } = kitOf(p);
    if (!amp || rng() > share) continue;
    const reach = p.r * 1.7;
    const near = [];
    for (let c = Math.floor((p.x - reach) / FRONT_CELL); c <= Math.floor((p.x + reach) / FRONT_CELL); c++) {
      for (let row = Math.floor(p.y / FRONT_CELL); row <= Math.floor((p.y + 340) / FRONT_CELL); row++) {
        for (const q of cells.get(`${c}|${row}`) ?? []) near.push(q);
      }
    }
    const hidden = near.some((q) => q.p !== p && q.y > p.y && q.y - q.h < p.y + 6
      && Math.abs(q.x - p.x) < reach + q.r);
    if (hidden) continue;
    p.live = true;
    put('sway', p.x, p.y, { s: p.s, flip: p.flip, piece: `adv-p-${p.land}-${p.kind}`, amp, dur: time(3.2, 5.4), delay: -time(0, 5) });
  }

  // Las luces de las piezas: los faroles, las velas y los braseros.
  for (const p of world.props) {
    const { light } = kitOf(p);
    if (!light) continue;
    const dx = (p.flip ? -light.x : light.x) * p.s;
    put('lights', p.x + dx, p.y + light.y * p.s, { r: light.r * p.s * 1.1, kind: light.kind, dur: time(0.9, 1.6), delay: -time(0, 2) });
  }

  // Lo de los hitos y la casa, en coordenadas de su pieza: se lleva al mapa con su escala.
  const emit = (life, at, s) => {
    for (const e of life ?? []) {
      const x = at.x + e.x * s;
      const y = at.y + e.y * s;
      if (e.as === 'lights') {
        const slow = e.beat === 'slow';
        put('lights', x, y, { r: e.r * s * 1.1, kind: e.kind, beat: e.beat, dur: slow ? time(2.6, 4.2) : time(0.9, 1.6), delay: -time(0, 3) });
      } else if (e.as === 'smoke') {
        for (let j = 0; j < e.n; j++) put('smoke', x, y, { r: e.r * s, dur: 5.2, delay: -j * 1.3 });
      } else if (e.as === 'wisps') {
        for (let j = 0; j < e.n; j++) {
          put('wisps', x + (rng() - 0.5) * e.spread * s, y + (rng() - 0.5) * e.spread * s * 0.4, {
            kind: e.kind, dur: e.kind === 'firefly' ? time(5, 8) : time(3.2, 5.2), delay: -time(0, 6),
          });
        }
      } else if (e.as === 'ripples') {
        for (let j = 0; j < e.n; j++) put('ripples', x, y, { rx: e.rx * s, ry: e.ry * s, dur: 4, delay: -j * 2 });
      }
    }
  };
  world.landmarks.forEach((m, i) => {
    const mark = WORLD_MARKS[m.kind];
    // Lo que va en el agua sale del dibujo y se mece en ella.
    if (mark.afloat) {
      m.live = true;
      put('ships', m.x, m.y, { s: m.s, index: i });
    }
    emit(mark.life, m, m.s);
  });
  emit(WORLD_CAMP_LIFE, world.camp, world.camp.s);

  // El agua. Los ríos y los arroyos corren: rayitas que bajan con la corriente, y
  // brillos. Las lagunas abren anillos y brillan. El mar trae olas a la orilla.
  const along = (a, b) => Math.round((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
  for (const w of world.waters) {
    const land = WORLD_LANDS[w.land];
    const foam = land.sea?.foam ?? (land.water ?? land.pond ?? land.lake)?.colors?.[2] ?? '#e8f4f4';
    if (w.kind === 'stream' || w.kind === 'river') {
      for (let j = 3; j < w.line.length - 3; j += 7) {
        const q = world.toScreen(w.line[j].u, w.line[j].v + (rng() - 0.5) * 30);
        if (offRoad(q, 80)) put('glints', q.x, q.y, { len: time(14, 30), dur: time(2.2, 4.2), delay: -time(0, 4) });
      }
      for (let j = 2; j < w.line.length - 3; j += 4) {
        const q = world.toScreen(w.line[j].u, w.line[j].v + (rng() - 0.5) * 22);
        if (!offRoad(q, 90)) continue;
        const next = world.toScreen(w.line[j + 2].u, w.line[j + 2].v);
        put('flows', q.x, q.y, { ang: along(q, next), len: time(18, 34), run: time(40, 70), foam, dur: time(1.8, 2.8), delay: -time(0, 3) });
      }
    } else if (w.kind === 'pond' || w.kind === 'lake') {
      const c = world.toScreen(w.u, w.v);
      for (let j = 0; j < (w.kind === 'lake' ? 5 : 3); j++) {
        put('glints', c.x + (rng() - 0.5) * w.rx, c.y + (rng() - 0.5) * w.ry * 0.8, { len: time(14, 30), dur: time(2.2, 4.2), delay: -time(0, 4) });
      }
      for (let j = 0; j < (w.kind === 'lake' ? 3 : 2); j++) {
        const r = time(22, 38);
        put('ripples', c.x + (rng() - 0.5) * w.rx * 0.9, c.y + (rng() - 0.5) * w.ry * 0.6, { rx: r, ry: r * 0.42, foam, dur: time(3.2, 4.6), delay: -time(0, 4) });
      }
    } else if (w.kind === 'sea') {
      // La orilla mira para donde crece `v`: abajo de costado, a la derecha parado. La ola
      // avanza para abajo en su pieza, así que parada se gira un cuarto.
      for (let j = 0; j < w.shore.length; j += 4) {
        const s = w.shore[j];
        if (s.v > 70) {
          const q = world.toScreen(s.u + (rng() - 0.5) * 40, s.v * (0.2 + rng() * 0.5));
          put('glints', q.x, q.y, { len: time(14, 30), dur: time(2.2, 4.2), delay: -time(0, 4) });
        }
      }
      for (let j = 2; j < w.shore.length - 2; j += 3) {
        const s = w.shore[j];
        if (s.v < 90) continue;
        const q = world.toScreen(s.u + (rng() - 0.5) * 30, s.v - 46 - rng() * 24);
        put('waves', q.x, q.y, { ang: vertical ? -90 : 0, run: 34, len: time(46, 80), foam, dur: time(3.4, 4.8), delay: -time(0, 5) });
      }
    }
  }

  // El viento y lo que rueda, repartidos por cada tierra en sus coordenadas.
  zones.forEach((z) => {
    const { life } = WORLD_LANDS[z.land];
    const wind = life?.wind;
    for (let j = 0; wind && j < wind.n; j++) {
      const slow = wind.kind === 'mist';
      z.gusts.push({
        kind: wind.kind, x: z.w * ((j + rng() * 0.8) / wind.n), y: z.h * (0.12 + rng() * 0.76),
        w: slow ? time(260, 380) : time(120, 200), run: slow ? time(180, 280) : time(360, 560),
        dur: slow ? time(18, 26) : time(7, 11), delay: -time(0, 12),
      });
    }
    const tumble = life?.tumble;
    for (let j = 0; tumble && j < tumble.n; j++) {
      z.tumbles.push({
        x: z.w * ((j + rng() * 0.5) / tumble.n) - 200, y: z.h * (0.18 + rng() * 0.7), r: time(22, 30),
        run: time(620, 900), colors: tumble.colors, dur: time(9, 14), delay: -time(0, 14), spin: time(0.9, 1.4),
      });
    }
  });

  // Por el cielo de cada tierra: dos sombras de nubes que cruzan el suelo, despacio, y una
  // bandada que pasa de vez en cuando.
  zones.forEach((z) => {
    for (let j = 0; j < 2; j++) {
      z.clouds.push({ y: z.h * (0.15 + rng() * 0.7), w: 520 + rng() * 260, dur: time(70, 110), delay: -time(0, 100) });
    }
    z.birds.push({ y: z.h * (0.1 + rng() * 0.5), dur: time(26, 38), delay: -time(0, 30) });
  });
  return zones;
}

/** El color de cada tierra a lo largo del viaje, mezclado en las costuras: `[fracción, color]`. */
function worldStops(world, color) {
  return world.zones.flatMap((z, c) => {
    const tone = color(WORLD_LANDS[z.land]);
    const a = c === 0 ? 0 : (world.starts[c] + world.seam) / world.U;
    const b = c === world.n - 1 ? 1 : (world.starts[c + 1] - world.seam) / world.U;
    return [[a, tone], [b, tone]];
  });
}

/** Un degradé a lo largo del viaje con el color de cada tierra y la mezcla en las costuras. */
function worldGradient(world, id, color) {
  const stops = worldStops(world, color).map(([at, tone]) => `<stop offset="${at.toFixed(4)}" stop-color="${tone}"/>`);
  const dir = world.orient === 'v' ? `x1="0" y1="${world.H}" x2="0" y2="0"` : `x1="0" y1="0" x2="${world.W}" y2="0"`;
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" ${dir}>${stops.join('')}</linearGradient>`;
}

/**
 * El suelo del mundo entero como fondo CSS del mapa: el degradé de `adv-g-ground`, de una
 * sola pieza, debajo de todas las tierras. Con un suelo por tierra quedaba en cada costura
 * una raya: dos bordes que no caen justo en un píxel se pintan a medias y dejan ver el
 * fondo oscuro. Y así una tierra que todavía no se montó ya tiene su color.
 */
export function worldGroundCss(world) {
  const stops = worldStops(world, (l) => l.ground).map(([at, tone]) => `${tone} ${(at * 100).toFixed(4)}%`);
  return `linear-gradient(${world.orient === 'v' ? 'to top' : 'to right'}, ${stops.join(', ')})`;
}

/** Un trazo por puntos en pantalla. */
const worldLine = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${artN(p.x)} ${artN(p.y)}`).join('');

/** Un charco de color de borde suave: `color` en el medio, nada en el borde. */
const worldPool = (id, color, alpha) => `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${alpha}"/>`
  + `<stop offset=".55" stop-color="${color}" stop-opacity="${artN(alpha * 0.55 * 100) / 100}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;

/**
 * Pinceladas cortas a lo largo de una línea (el camino, un río): cada `every` puntos,
 * una raya paralela a la línea, corrida al costado hasta `spread`.
 */
function worldStreaks(pts, rng, every, spread, len, keep = () => true) {
  let d = '';
  for (let i = 2; i < pts.length - 2; i += every) {
    if (rng() < 0.3 || !keep(i)) continue;
    const a = pts[i - 1];
    const b = pts[i + 1];
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const tx = (b.x - a.x) / l;
    const ty = (b.y - a.y) / l;
    const off = (rng() - 0.5) * 2 * spread;
    const x = pts[i].x - ty * off;
    const y = pts[i].y + tx * off;
    const k = len * (0.6 + rng() * 0.8);
    d += `M${artN(x)} ${artN(y)}l${artN(tx * k)} ${artN(ty * k)}`;
  }
  return d;
}

/**
 * Lo que comparten todos los pedazos del dibujo (ver `worldZoneArt`): las luces, los
 * degradés del viaje —el suelo y el camino de una tierra se mezclan con los de la que
 * sigue—, el camino entero y el grano de la tela. Va una vez, en su propio `<defs>`.
 */
export function worldBaseDefs(world) {
  const defs = [artGlowDefs()];
  defs.push(worldGradient(world, 'adv-g-ground', (l) => l.ground));
  defs.push(worldGradient(world, 'adv-g-light', (l) => l.light));
  defs.push(worldGradient(world, 'adv-g-path', (l) => l.path));
  defs.push(worldGradient(world, 'adv-g-pathlight', (l) => l.pathLight));
  defs.push(worldGradient(world, 'adv-g-halo', (l) => l.halo));
  defs.push(`<path id="adv-road" d="${worldLine(world.route.pts.filter((_, i) => i % 2 === 0 || i === world.route.pts.length - 1))}"/>`);
  // El grano de la tela: puntitos claros y oscuros, parejos, en un azulejo chico.
  const grain = makeRng(0x9a1);
  let grainDots = '';
  for (let i = 0; i < 70; i++) {
    grainDots += `<circle cx="${artN(grain() * 90)}" cy="${artN(grain() * 90)}" r="${artN(0.8 + grain() * 1.1)}" fill="${i % 2 ? '#ffffff' : '#1a0e20'}" opacity="${i % 2 ? 0.08 : 0.07}"/>`;
  }
  defs.push(`<pattern id="adv-grain" width="90" height="90" patternUnits="userSpaceOnUse">${grainDots}</pattern>`);
  return defs.join('');
}

/**
 * Las piezas de una tierra (todo su `kit`, una vez cada una, para usar con `<use>`) y los
 * degradés de sus charcos, de sus sombras, de los manchones de su suelo y de su marco.
 */
export function worldLandDefs(land) {
  const t = WORLD_LANDS[land];
  return [
    worldPool(`adv-sh-${land}`, t.cast, 0.5),
    worldPool(`adv-gp-${land}`, t.ground, 0.75),
    worldPool(`adv-lp-${land}`, t.light, 0.62),
    worldPool(`adv-sp-${land}`, t.shade, 0.5),
    worldPool(`adv-fr-${land}`, t.frame, 0.6),
    ...t.kit.map((item) => {
      const id = `adv-p-${land}-${item.kind}`;
      return `<g id="${id}">${item.draw(id)}</g>`;
    }),
  ].join('');
}

/** Las tierras cuyas piezas usa el pedazo `c`: la suya y las de al lado (las costuras se mezclan). */
export const worldZoneLands = (world, c) => [...new Set(
  [c - 1, c, c + 1].filter((i) => i >= 0 && i < world.n).map((i) => world.zones[i].land),
)];

/** Dónde empieza y termina a lo largo el pedazo de la tierra `c`. */
const zoneSpan = (world, c) => [c === 0 ? 0 : world.starts[c], c === world.n - 1 ? world.U : world.starts[c + 1]];

/**
 * El rectángulo del pedazo `c` en el mapa: `[x, y, ancho, alto]`, para el `viewBox` de sus
 * capas (de costado el viaje va a lo ancho; parado, de abajo para arriba).
 */
export function worldZoneBox(world, c) {
  const [u0, u1] = zoneSpan(world, c);
  return world.orient === 'v' ? [0, world.U - u1, world.W, u1 - u0] : [u0, 0, u1 - u0, world.H];
}

/** A lo largo, dónde cae un punto de la pantalla del mapa. */
const alongOf = (world, x, y) => (world.orient === 'v' ? world.U - y : x);

/**
 * El dibujo de la tierra `c`, en cuatro capas que se apilan con las de las demás tierras,
 * sobre el suelo de todo el mundo (`worldGroundCss`):
 *   `soil`    lo pintado en el suelo: charcos de luz cálida y de sombra fría, pinceladas
 *             secas y las marcas. Pasa la costura y se funde con lo de la tierra de al lado.
 *   `ground`  el agua, el camino y los puentes. Recortado a su tierra.
 *   `things`  las piezas y los hitos, de atrás para adelante. Se sale de su tierra: una
 *             copa puede asomar sobre la de al lado.
 *   `top`     los bordes oscuros, como el primer plano fuera de foco de los fondos de
 *             pelea, que también pasan la costura, y el grano.
 * Cada una es el contenido de un `<svg>` con el `viewBox` de `worldZoneBox`. Usa lo de
 * `worldBaseDefs` y las piezas de `worldZoneLands` (`worldLandDefs`). El azar es propio de
 * cada tierra: sale igual se dibuje en el orden que se dibuje.
 */
export function worldZoneArt(world, c) {
  const rng = makeRng((world.orient === 'v' ? 0xa27 : 0xa26) + c * 7919);
  const { toScreen } = world;
  const z = world.zones[c];
  const land = WORLD_LANDS[z.land];
  const [u0, u1] = zoneSpan(world, c);
  const inZone = (u) => u >= u0 && u < u1;
  const soil = [];
  const ground = [];
  const defs = [];
  const [bx, by, bw, bh] = worldZoneBox(world, c);

  // Lo pintado en el suelo pasa la costura `seam` y se mezcla con lo de la tierra de al
  // lado como el decorado (ver `landAt`): de cada tierra, la mitad en la costura y nada
  // `seam` más allá. Recortado a su tierra, cortaba en seco charcos y pinceladas.
  const S = world.seam;
  const lo = c === 0 ? u0 : u0 - S;
  const hi = c === world.n - 1 ? u1 : u1 + S;
  const share = (u) => Math.min(1, Math.max(0, 0.5 + Math.min(c === 0 ? S : u - u0, c === world.n - 1 ? S : u1 - u) / (2 * S)));

  // La tierra se mete en la de al lado a manchones de su suelo, del tamaño de la costura:
  // queda gastada, no una franja recta de lado a lado.
  const patches = [];
  for (const [edge, out] of [[u0, -1], [u1, 1]]) {
    if (c === (out < 0 ? 0 : world.n - 1)) continue;
    for (let i = 0; i < Math.round(world.C / 70); i++) {
      const at = toScreen(edge + out * S * 0.9 * rng() ** 1.4, rng() * world.C);
      const r = S * (0.35 + rng() * 0.4);
      const [rx, ry] = world.orient === 'v' ? [r * 1.15, r * 0.85] : [r * 0.85, r * 1.15];
      patches.push(`<ellipse cx="${artN(at.x)}" cy="${artN(at.y)}" rx="${artN(rx)}" ry="${artN(ry)}" fill="url(#adv-gp-${z.land})"/>`);
    }
  }
  soil.push(patches.join(''));

  // El suelo: charcos de sombra hacia los bordes, de luz cerca del camino, pinceladas
  // secas y, de su tierra, las marcas del suelo.
  const pools = [];
  for (let i = 0; i < Math.round((hi - lo) / 170); i++) {
    const u = lo + rng() * (hi - lo);
    if (rng() > share(u)) continue;
    const v = rng() < 0.5 ? rng() * world.C * 0.28 : world.C * (0.72 + rng() * 0.28);
    const at = toScreen(u, v);
    const r = 220 + rng() * 220;
    pools.push(`<ellipse cx="${artN(at.x)}" cy="${artN(at.y)}" rx="${artN(r)}" ry="${artN(r * 0.6)}" fill="url(#adv-sp-${z.land})"/>`);
  }
  const along = world.road.filter((p) => p.u >= lo && p.u < hi);
  for (let i = 0; i < Math.round((hi - lo) / 200) && along.length; i++) {
    const p = along[Math.floor(rng() * along.length)];
    if (rng() > share(p.u)) continue;
    const at = toScreen(p.u + (rng() - 0.5) * 200, p.v + (rng() - 0.5) * 260);
    const r = 200 + rng() * 200;
    pools.push(`<ellipse cx="${artN(at.x)}" cy="${artN(at.y)}" rx="${artN(r)}" ry="${artN(r * 0.62)}" fill="url(#adv-lp-${z.land})"/>`);
  }
  soil.push(pools.join(''));

  // Las pinceladas secas del suelo: cortas, casi del color del suelo, todas con la misma
  // inclinación, como el pasto de los fondos pintados.
  const tilt = -0.35;
  const strokes = ['', ''];
  const count = Math.round((hi - lo) / 5);
  for (let i = 0; i < count; i++) {
    const u = lo + rng() * (hi - lo);
    if (rng() > share(u)) continue;
    const { x, y } = toScreen(u, rng() * world.C);
    const k = 16 + rng() * 26;
    const a = tilt + (rng() - 0.5) * 0.5;
    strokes[i % 2] += `M${artN(x)} ${artN(y)}q${artN(Math.cos(a) * k * 0.5)} ${artN(Math.sin(a) * k * 0.5 - 3)} ${artN(Math.cos(a) * k)} ${artN(Math.sin(a) * k)}`;
  }
  soil.push(`<path d="${strokes[0]}" stroke="${land.brush[0]}" stroke-width="6" stroke-linecap="round" fill="none" opacity=".32"/>`
    + `<path d="${strokes[1]}" stroke="${land.brush[1]}" stroke-width="5" stroke-linecap="round" fill="none" opacity=".24"/>`);

  let marks = '';
  const many = Math.round((hi - lo) / 40);
  for (let i = 0; i < many; i++) {
    const u = lo + rng() * (hi - lo);
    if (rng() > share(u)) continue;
    const { x, y } = toScreen(u, rng() * world.C);
    const X = artN(x);
    const Y = artN(y);
    if (land.marks === 'sand') marks += `M${X} ${Y}q12 -6 24 0`;
    else if (land.marks === 'snow') marks += `M${X} ${Y}q16 -6 32 0`;
    else if (land.marks === 'cracks') marks += `M${X} ${Y}l8 5 -4 7 9 4`;
  }
  if (marks) {
    const tone = land.marks === 'cracks' ? land.shade : land.brush[1];
    soil.push(`<path d="${marks}" stroke="${tone}" stroke-width="${land.marks === 'cracks' ? 2.5 : 3.5}" stroke-linecap="round" fill="none" opacity="${land.marks === 'cracks' ? 0.55 : 0.35}"/>`);
  }

  // El claro del camino: el sol cae sobre la huella, como en los fondos de pelea.
  ground.push(`<use href="#adv-road" stroke="url(#adv-g-light)" stroke-width="280" opacity=".28" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
  ground.push(`<use href="#adv-road" stroke="url(#adv-g-light)" stroke-width="170" opacity=".3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);

  // El agua de esta tierra, debajo del camino: mate, con pinceladas más claras en vez de espuma.
  world.waters.forEach((w, i) => {
    const center = w.line ? w.line[Math.floor(w.line.length / 2)].u : w.shore ? w.shore[Math.floor(w.shore.length / 2)].u : w.u;
    if (!inZone(center)) return;
    const wl = WORLD_LANDS[w.land];
    if (w.kind === 'stream' || w.kind === 'river') {
      const spec = wl.water;
      const id = `adv-water-${world.orient}-${i}`;
      const line = w.line.map((p) => toScreen(p.u, p.v));
      defs.push(`<path id="${id}" d="${artSmooth(line.filter((_, j) => j % 3 === 0), false)}"/>`);
      const use = (stroke, width, extra = '') => `<use href="#${id}" stroke="${stroke}" stroke-width="${width}" fill="none" stroke-linecap="round" ${extra}/>`;
      ground.push(use(spec.bank, 124, 'opacity=".75"') + use(spec.colors[0], 90) + use(spec.colors[1], 54));
      ground.push(`<path d="${worldStreaks(line, rng, 2, 26, 26)}" stroke="${spec.colors[2]}" stroke-width="5" stroke-linecap="round" opacity=".6"/>`);
      if (w.kind === 'stream') {
        let pads = '';
        for (let j = 4; j < w.line.length - 4; j += 5) {
          if (rng() < 0.6) continue;
          const p = w.line[j];
          const at = toScreen(p.u + (rng() < 0.5 ? -1 : 1) * (24 + rng() * 10), p.v);
          pads += `<path d="M${artN(at.x)} ${artN(at.y)}l10 -3a10.4 10.4 0 1 1 0 6Z"/>`;
        }
        ground.push(`<g fill="#6f9a66">${pads}</g>`);
      }
    } else if (w.kind === 'pond' || w.kind === 'lake') {
      const spec = wl[w.kind];
      const at = toScreen(w.u, w.v);
      const prng = makeRng(Math.floor(w.seed * 1e9));
      const rx = world.orient === 'v' ? w.ry : w.rx;
      const ry = world.orient === 'v' ? w.rx * 0.62 : w.ry;
      const streaks = [];
      for (let j = 0; j < 7; j++) {
        const x = at.x - rx * 0.6 + prng() * rx * 1.1;
        const y = at.y - ry * 0.5 + prng() * ry * 0.9;
        streaks.push(`M${artN(x)} ${artN(y)}l${artN(18 + prng() * 26)} ${artN(-4 - prng() * 6)}`);
      }
      if (w.kind === 'lake') {
        ground.push(`<path d="${artBlob(at.x + 8, at.y + 10, rx + 18, ry + 14, prng, 9, 0.12)}" fill="${spec.rim}" opacity=".55"/>`
          + `<path d="${artBlob(at.x, at.y, rx + 12, ry + 10, prng, 9, 0.12)}" fill="${spec.colors[2]}"/>`
          + `<path d="${artBlob(at.x, at.y, rx, ry, prng, 9, 0.12)}" fill="${spec.colors[0]}"/>`
          + `<path d="${artBlob(at.x - rx * 0.14, at.y - ry * 0.16, rx * 0.62, ry * 0.52, prng, 8, 0.15)}" fill="${spec.colors[1]}"/>`
          + `<path d="${streaks.join('')}" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity=".55"/>`
          + `<path d="M${artN(at.x - rx * 0.5)} ${artN(at.y + ry * 0.1)}l${artN(rx * 0.3)} ${artN(ry * 0.2)} ${artN(rx * 0.22)} ${artN(-ry * 0.3)}" stroke="${wl.shade}" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".7"/>`);
      } else {
        let pads = '';
        for (let j = 0; j < 5; j++) {
          const a = prng() * Math.PI * 2;
          pads += `<path d="M${artN(at.x + Math.cos(a) * rx * 0.55)} ${artN(at.y + Math.sin(a) * ry * 0.5)}l11 -3a11.4 11.4 0 1 1 0 6Z"/>`;
        }
        ground.push(`<path d="${artBlob(at.x, at.y, rx + 24, ry + 18, prng, 9, 0.16)}" fill="${spec.bank}" opacity=".8"/>`
          + `<path d="${artBlob(at.x, at.y, rx, ry, prng, 9, 0.16)}" fill="${spec.colors[0]}"/>`
          + `<path d="${artBlob(at.x - rx * 0.1, at.y - ry * 0.12, rx * 0.66, ry * 0.58, prng, 8, 0.2)}" fill="${spec.colors[1]}"/>`
          + `<path d="${streaks.join('')}" stroke="${spec.colors[2]}" stroke-width="5" stroke-linecap="round" opacity=".6"/>`
          + `<g fill="#6f9a66">${pads}</g>`);
      }
    } else if (w.kind === 'sea') {
      const spec = wl.sea;
      const shore = w.shore.map((p) => toScreen(p.u, p.v));
      const a = toScreen(w.shore[0].u - 30, -60);
      const b = toScreen(w.shore.at(-1).u + 30, -60);
      const coast = artSmooth(shore, false);
      const poly = `M${artN(a.x)} ${artN(a.y)}${coast.replace(/^M/, 'L')}L${artN(b.x)} ${artN(b.y)}Z`;
      const depth = world.C * spec.bay;
      const dir = world.orient === 'v' ? `x1="0" y1="0" x2="${artN(depth)}" y2="0"` : `x1="0" y1="0" x2="0" y2="${artN(depth)}"`;
      const sid = `${world.orient}-${i}`;
      defs.push(`<linearGradient id="adv-g-sea-${sid}" gradientUnits="userSpaceOnUse" ${dir}><stop offset="0" stop-color="${spec.deep}"/><stop offset=".65" stop-color="${spec.mid}"/><stop offset="1" stop-color="${spec.shallow}"/></linearGradient>`);
      defs.push(`<clipPath id="adv-clip-sea-${sid}"><path d="${poly}"/></clipPath>`);
      // Las olas: pinceladas más claras, paralelas a la orilla, adentro del agua.
      let waves = '';
      for (let j = 0; j < w.shore.length; j += 1) {
        const sh = w.shore[j];
        if (sh.v < 70 || rng() < 0.45) continue;
        const at = toScreen(sh.u + (rng() - 0.5) * 40, sh.v * (0.15 + rng() * 0.62));
        const k = 20 + rng() * 26;
        waves += world.orient === 'v' ? `M${artN(at.x)} ${artN(at.y)}l0 ${artN(k)}` : `M${artN(at.x)} ${artN(at.y)}l${artN(k)} 0`;
      }
      ground.push(`<path d="${coast}" stroke="${spec.wet}" stroke-width="56" fill="none" stroke-linecap="round" opacity=".55"/>`
        + `<path d="${poly}" fill="url(#adv-g-sea-${sid})"/>`
        + `<path d="${coast}" stroke="${spec.shallow}" stroke-width="64" fill="none" clip-path="url(#adv-clip-sea-${sid})"/>`
        + `<path d="${waves}" stroke="${spec.wave}" stroke-width="5" fill="none" stroke-linecap="round" opacity=".55"/>`
        + `<path d="${coast}" stroke="${spec.foam}" stroke-width="9" fill="none" stroke-linecap="round" opacity=".7"/>`);
    }
  });

  // El camino: un halo frío alrededor, la huella clara y cálida, y pinceladas secas a
  // lo largo, más oscuras y más claras, del color del camino de cada tierra.
  ground.push(`<use href="#adv-road" stroke="url(#adv-g-halo)" stroke-width="${WORLD_ROAD * 2 + 44}" opacity=".32" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
  ground.push(`<use href="#adv-road" stroke="url(#adv-g-path)" stroke-width="${WORLD_ROAD * 2 + 4}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
  ground.push(`<use href="#adv-road" stroke="url(#adv-g-pathlight)" stroke-width="30" opacity=".6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
  // En la costura las pinceladas de las dos tierras se mezclan, punto a punto, con un azar
  // propio de cada punto: así cada uno es de una sola tierra.
  const pts = world.route.pts;
  const dither = (i) => () => {
    const x = Math.sin(i * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  for (const lid of worldZoneLands(world, c)) {
    const keep = (i) => inZone(world.road[i].u) && world.landAt(world.road[i].u, dither(i)) === lid;
    const dark = worldStreaks(pts, rng, 2, WORLD_ROAD - 8, 30, keep);
    const lite = worldStreaks(pts, rng, 3, WORLD_ROAD - 14, 26, keep);
    if (!dark && !lite) continue;
    ground.push(`<path d="${dark}" stroke="${WORLD_LANDS[lid].pathShade}" stroke-width="5" stroke-linecap="round" opacity=".45"/>`
      + `<path d="${lite}" stroke="${WORLD_LANDS[lid].pathLight}" stroke-width="5" stroke-linecap="round" opacity=".6"/>`);
  }

  // Los puentes y el muelle, sobre el camino y el agua.
  for (const b of world.bridges) {
    if (!inZone(alongOf(world, b.x, b.y))) continue;
    ground.push(`<g transform="translate(${artN(b.x)} ${artN(b.y)}) rotate(${artN(b.angle)})">${artBridge(WORLD_LANDS[b.land].bridge, 150, WORLD_ROAD * 2 + 26, b.stone)}</g>`);
  }
  for (const d of world.docks) {
    if (!inZone(alongOf(world, d.x, d.y))) continue;
    ground.push(`<g transform="translate(${artN(d.x)} ${artN(d.y)}) rotate(${d.angle})">${artDock(WORLD_LANDS[d.land].dock, d.len)}</g>`);
  }

  // Las piezas y los hitos, de atrás para adelante. Lo que se mueve (ver `worldLife`) no
  // se pinta acá: lo pinta la capa de arriba con la misma pieza.
  const things = world.props.filter((p) => !p.live && inZone(alongOf(world, p.x, p.y))).map((p) => ({
    y: p.y,
    html: `<use href="#adv-p-${p.land}-${p.kind}" transform="translate(${artN(p.x)} ${artN(p.y)}) scale(${p.flip ? -artN(p.s * 100) / 100 : artN(p.s * 100) / 100} ${artN(p.s * 100) / 100})"/>`,
  }));
  world.landmarks.forEach((m, i) => {
    if (m.live || !inZone(alongOf(world, m.x, m.y))) return;
    things.push({ y: m.y, html: `<g transform="translate(${artN(m.x)} ${artN(m.y)}) scale(${m.s})">${worldMark(world, i)}</g>` });
  });
  if (c === 0) {
    things.push({ y: world.camp.y, html: `<g transform="translate(${artN(world.camp.x)} ${artN(world.camp.y)}) scale(${world.camp.s})">${artCamp(worldCampArt)}</g>` });
  }
  things.sort((a, b) => a.y - b.y);

  // Los bordes, oscuros y sin foco, como el primer plano de los fondos de pelea: cierran
  // el cuadro y llevan la vista al camino. En la costura se apagan mientras se encienden
  // los de la tierra de al lado.
  let frame = '';
  for (let u = lo + 60; u < hi; u += 230) {
    const fade = share(u);
    for (const edge of [-50, world.C + 50]) {
      const at = toScreen(u + (rng() - 0.5) * 120, edge + (rng() - 0.5) * 60);
      const r = 240 + rng() * 160;
      const [rx, ry] = world.orient === 'v' ? [r * 0.5, r] : [r, r * 0.5];
      if (fade <= 0) continue;
      frame += `<ellipse cx="${artN(at.x)}" cy="${artN(at.y)}" rx="${artN(rx)}" ry="${artN(ry)}" fill="url(#adv-fr-${z.land})"${fade < 1 ? ` opacity="${artN(fade * 100) / 100}"` : ''}/>`;
    }
  }
  const top = `${frame}<rect x="${artN(bx)}" y="${artN(by)}" width="${artN(bw)}" height="${artN(bh)}" fill="url(#adv-grain)"/>`;

  return {
    soil: soil.join(''),
    ground: `${defs.length ? `<defs>${defs.join('')}</defs>` : ''}${ground.join('')}`,
    things: things.map((t) => t.html).join(''),
    top,
  };
}

/**
 * El dibujo del mundo entero en un solo SVG: las definiciones, el suelo y las cuatro capas
 * de cada tierra (ver `worldZoneArt`). Es lo que se pinta donde no se puede ir montando de a una
 * tierra (sin `IntersectionObserver`, y en los tests). Es estático: no depende del
 * progreso (eso va aparte, ver `adventure-map.js`).
 */
export function worldArt(world) {
  const parts = world.zones.map((_, c) => worldZoneArt(world, c));
  // Parado, las tierras de más arriba (las de después) van detrás de las de abajo.
  const order = parts.map((_, c) => c);
  if (world.orient === 'v') order.reverse();
  const lands = [...new Set(world.zones.map((z) => z.land))];
  return `<svg class="adv-art" viewBox="0 0 ${world.W} ${world.H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">`
    + `<defs>${worldBaseDefs(world)}${lands.map(worldLandDefs).join('')}</defs>`
    + `<rect width="${world.W}" height="${world.H}" fill="url(#adv-g-ground)"/>`
    + `${parts.map((p) => p.soil).join('')}${parts.map((p) => p.ground).join('')}${order.map((c) => parts[c].things).join('')}${parts.map((p) => p.top).join('')}</svg>`;
}
