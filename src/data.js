import { tr } from './i18n.js';

// Símbolos del juego. `color` es el del anillo del crest y tiñe las cadenas en la mesa.
export const SYMBOLS = {
  beast:   { id: 'beast',   name: tr('Bestia'), color: '#f5b53d' },
  aquatic: { id: 'aquatic', name: tr('Pez'),    color: '#4bb8f0' },
  bird:    { id: 'bird',    name: tr('Pájaro'), color: '#ff7bac' },
  plant:   { id: 'plant',   name: tr('Planta'), color: '#54cf8b' },
  bug:     { id: 'bug',     name: tr('Bicho'),  color: '#ff6a5c' },
  reptile: { id: 'reptile', name: tr('Reptil'), color: '#a97cff' },
};

/**
 * La URL de un PNG de `Icons/`. El build de un solo archivo (`npm run build`) mete
 * todos como data URI en `ICON_URLS`; servido desde el repo son rutas relativas.
 */
export const iconUrl = (file) => globalThis.ICON_URLS?.[file] ?? `Icons/${file}`;

for (const [id, sym] of Object.entries(SYMBOLS)) sym.crest = iconUrl(`${id}-crest.png`);

export const SYMBOL_IDS = Object.keys(SYMBOLS);

/** Crest como HTML. `size` es una clase modificadora: 'sm' para texto corrido. */
export function crest(symbol, size = '') {
  const s = SYMBOLS[symbol];
  const cls = size ? `crest crest--${size}` : 'crest';
  return `<img class="${cls}" src="${s.crest}" alt="${s.name}" title="${s.name}">`;
}

// ---- poderes ----------------------------------------------------------------

/**
 * Los poderes. Cada uno viaja pegado a una carta como un símbolo de más que la cadena
 * no ve: no abre cadena, no la continúa, no la corta y no puntúa —`rules.js` ni se
 * entera de que existe—. Cuándo actúa depende de la clase, y cada clase tiene su
 * momento del turno (ver `game.js`):
 *
 *   Pájaro   al robarla o al cortarte: nunca vuelve con las manos vacías
 *   Pez      el centro y el mazo del rival
 *   Bestia   el sangrado (cada carta que roba el rival le cuesta vida) y la Rage
 *   Planta   cura y escudo propios, y limpiar lo que te pusieron
 *   Bicho    robarle al rival: vida, escudo o cartas
 *   Reptil   el turno del rival: veneno al terminarlo, espinas cuando te pega
 *
 * Todos son números fijos: ninguno mira el golpe, el largo de la racha ni cuántas
 * cartas salieron. Lo único que los multiplica son las copias: dos cartas del mismo
 * poder en la misma mano valen el doble (dos frascos, 10 de veneno).
 *
 * `symbol` es la clase a la que pertenece: las seis cartas de un poder la llevan
 * siempre entre sus tres símbolos, así el efecto de tu color encadena con tu mazo
 * mejor que con ningún otro.
 */
/**
 * Los números de los poderes, en un solo lugar y mutables a propósito: el banco de
 * pruebas los cambia para medir variantes sin editar código entre corridas. El juego
 * los lee en cada uso, así que un cambio acá vale desde la partida siguiente. Todos
 * son por copia: cada carta del poder en la mano suma lo suyo.
 *
 * Los topes son de lo que queda puesto (escudo, veneno, espinas…) y dejan entrar dos
 * copias enteras: si no, la segunda carta de la misma mano se perdería. El sangrado no
 * tiene tope: se paga de a una carta, así que se acumula sin cobrarse de golpe.
 *
 *   shieldMax      tope del escudo, sume quien lo sume
 *   featherDamage  daño directo de la pluma al robarla
 *   shuriken       daño del shuriken si te cortás (el escudo lo frena)
 *   fanStep/fanMax daño por pluma del abanico, y cuántas se guardan
 *   bombAt/bombDamage  burbujas para la bomba, y lo que pega (el escudo la frena)
 *   jellyCards     medusas que mete cada Paralyzing Jellyfish en el mazo del rival
 *   redbubbleCards cartas sin poder que tiene que llevarse el rival por Red Bubble
 *   bleedDamage    vida que cuesta cada carta que roba el que sangra; el sangrado
 *                  cuenta cartas y baja 1 con cada una
 *   razorBleed     sangrado de la navaja; daggerBleed el de la daga al robarla
 *   clawsMax/clawBleed  garras de Charm of Power, y el sangrado que pone cada una en
 *                  cada ataque
 *   drinkBleed/drinkHeal  la bebida: sangrado que pone, y lo que cura al que la tomó
 *                  cada carta que el rival pague sangrando en su próximo turno
 *   rageStep/rageMax/furyBonus  la Mask of Frenzy: daño por punto de Rage, tope, y lo que
 *                  suma la Furia (con Rage al tope, en el próximo ataque)
 *   potHeal        cura de la maceta
 *   leafTurns/leafHeal/leafMax  turnos de brote que suma la hoja, cura por turno, tope
 *   guardShield    escudo de la Sleepy Guard (además de su Limpiador)
 *   sageHeal       cura de la Red Sage
 *   pillowCut/pillowTurns  lo que la almohada le resta a cada ataque rival, y durante
 *                  cuántos turnos del rival; cada almohada más suma turnos
 *   leechDrain     golpe de cada Mantis Dagger (el escudo lo frena; cura lo que llega)
 *   cocoonTurns/cocoonShield/cocoonMax  turnos de capullo, escudo por turno, tope
 *   scannerShield  escudo que gana el escáner si el rival no tiene que robarle
 *   poisonDose/poisonMax  veneno por frasco y su tope. Muerde al final del turno del
 *                  envenenado y baja 1
 *   spikes/edgeSpikes/spikesMax  espinas de la máscara, del filo al robarla, y su tope
 *   glovesPoison   veneno que reparte cada guante, a los dos, al robarlo
 *   octopusPowers  si la carta que paga el pulpo puede llevar poder
 *   octopusStacks  true: cada pulpo paga una carta. false: una por reparto
 *   octopusOnStand si el pulpo exige haberse plantado
 *   powerBias      multiplicador sobre POWER_WORTH: cuán seguido la CPU prefiere un
 *                  poder antes que dos cartas sin poder. No es un número del juego
 *                  sino de la cabeza que lo juega, y está acá para poder medirlo
 *   overkill       daño de más, pasado el cero, que se lleva puesta la última chance
 *
 * Los neutrales (sin clase, ver `NEUTRAL_POWERS`):
 *   focusStep/focusMax  Charm of Focus: daño que suma cada foco a todos tus ataques, y
 *                  cuántos focos se juntan
 *   lensCards      cartas de arriba del mazo que te muestra la Lens of Revelation
 *   spellAmount    lo que cura, escuda o pega la Novice Spell (elegís una)
 *   giftDamage/giftMax  Last Gift: lo que guarda para tu próximo ataque, y su tope
 *   papaDamage/papaShield  Papa Bear: daño en ronda par, escudo en ronda impar
 *   mamaHeal/mamaBleed  Mama Bear: cura en ronda impar, sangrado al rival en ronda par
 *   bloodDamage/bloodSelf  Bloodpact: daño que suma al golpe, y el sangrado que te pone
 *   energyMult     por cuánto multiplica la Energy Drink S los puntos de la cadena
 *
 * Viven acá y no en `game.js` para que los carteles de los poderes salgan de los mismos
 * números que el juego usa: un texto que hay que acordarse de actualizar se desactualiza.
 */
export const TUNING = {
  shieldMax: 20,
  featherDamage: 8,
  shuriken: 15,
  fanStep: 10,
  fanMax: 3,
  bombAt: 3,
  bombDamage: 32,
  jellyCards: 2,
  redbubbleCards: 3,
  bleedDamage: 2,
  razorBleed: 7,
  daggerBleed: 5,
  clawsMax: 5,
  clawBleed: 2,
  drinkBleed: 4,
  drinkHeal: 2,
  rageStep: 2,
  rageMax: 5,
  furyBonus: 10,
  potHeal: 15,
  leafTurns: 3,
  leafHeal: 8,
  leafMax: 9,
  guardShield: 10,
  sageHeal: 12,
  pillowCut: 10,
  pillowTurns: 2,
  leechDrain: 7,
  cocoonTurns: 3,
  cocoonShield: 8,
  cocoonMax: 9,
  scannerShield: 5,
  poisonDose: 5,
  poisonMax: 15,
  spikes: 14,
  edgeSpikes: 8,
  spikesMax: 28,
  glovesPoison: 5,
  octopusPowers: true,
  octopusStacks: true,
  octopusOnStand: true,
  powerBias: 1,
  // Daño de más, pasado el cero, que se lleva puesta la última chance (ver `lastChance`).
  overkill: 30,
  focusStep: 3,
  focusMax: 3,
  lensCards: 2,
  spellAmount: 8,
  giftDamage: 15,
  giftMax: 30,
  papaDamage: 12,
  papaShield: 10,
  mamaHeal: 10,
  mamaBleed: 6,
  bloodDamage: 15,
  bloodSelf: 3,
  energyMult: 2,
};

// Cada `note` es lo que hace el poder; cuándo salta no lo dice: lo dice la etiqueta de su
// momento (`MOMENTS`, más abajo), que va siempre al lado. Es el texto que ve el jugador en la aventura y en el `title` de cada ícono, así que los números
// salen de `TUNING` y no se escriben a mano. Y cada `tip` es la misma definición en un
// renglón, para el cartel del centro al marcar una carta.
const T = TUNING;

// Todos los símbolos especiales se obtienen EXCLUSIVAMENTE de la carpeta amuletos
// (`simbolos especiales/amuletos/`).
export const POWERS = {
  // ---- Pájaro: al robarla o al cortarte ----
  egg: {
    id: 'egg', symbol: 'bird', name: 'Secret Egg', amuleto: 'ecard_bird_5003.png',
    note: tr('el huevo se rompe: la carta que te cortó vuelve a tu mazo y seguís jugando (una segunda chance por huevo)'),
    tip: tr('La carta vuelve al mazo y seguís'),
  },
  feather: {
    id: 'feather', symbol: 'bird', name: 'Feather Earring', amuleto: 'ecard_bird_momo_1.png',
    note: tr('{dmg} de daño directo al rival', { dmg: T.featherDamage }),
    tip: tr('{dmg} de daño directo', { dmg: T.featherDamage }),
  },
  shuriken: {
    id: 'shuriken', symbol: 'bird', name: 'Storm Shuriken', amuleto: 'ecard_storm_shuriken.png',
    note: tr('{dmg} de daño al rival; su escudo lo frena primero', { dmg: T.shuriken }),
    tip: tr('{dmg} de daño al rival', { dmg: T.shuriken }),
  },
  fan: {
    id: 'fan', symbol: 'bird', name: 'Feather Fan', amuleto: 'ecard_bird_4003.png',
    note: tr('+1 pluma (hasta {max}); tu próximo ataque las gasta: +{step} de daño por pluma', { max: T.fanMax, step: T.fanStep }),
    tip: tr('+1 pluma: +{step} de daño en tu próximo golpe', { step: T.fanStep }),
  },
  hammer: {
    id: 'hammer', symbol: 'bird', name: 'Flamingo Hammer', amuleto: 'ecard_bird_5005.png',
    note: tr('el rival pierde todo su escudo'),
    tip: tr('El rival pierde todo su escudo'),
  },
  // ---- Pez: el centro y el mazo del rival ----
  octopus: {
    id: 'octopus', symbol: 'aquatic', name: 'Sticky Octopus', amuleto: 'ecard_aquatic_5004.png',
    note: tr('elegís 1 carta extra del centro para tu mazo'),
    tip: tr('Una carta de más del centro'),
  },
  bubble: {
    id: 'bubble', symbol: 'aquatic', name: 'Bubble Paste', amuleto: 'ecard_aquatic_4003.png',
    note: tr('la carta que elijas del centro abre tu próxima ronda'),
    tip: tr('Tu carta del centro abre la próxima ronda'),
  },
  maker: {
    id: 'maker', symbol: 'aquatic', name: 'Bubble Maker', amuleto: 'ecard_aquatic_puffy_1.png',
    note: tr('+1 burbuja; con {at} estalla una bomba de {dmg} contra el rival (el escudo la frena)', { at: T.bombAt, dmg: T.bombDamage }),
    tip: tr('+1 burbuja: con {at}, bomba de {dmg}', { at: T.bombAt, dmg: T.bombDamage }),
  },
  jellyfish: {
    id: 'jellyfish', symbol: 'aquatic', name: 'Paralyzing Jellyfish', amuleto: 'ecard_aquatic_5005.png',
    note: tr('le mezclás {n} medusas en el mazo al rival: no tienen símbolos, así que si roba una con la cadena abierta se corta, y si abre con una no arma nada. Cada medusa se rompe apenas sale', { n: T.jellyCards }),
    tip: tr('{n} medusas en el mazo del rival: lo cortan', { n: T.jellyCards }),
  },
  redbubble: {
    id: 'redbubble', symbol: 'aquatic', name: 'Red Bubble', amuleto: 'ecard_aquatic_rouge_1.png',
    note: tr('el rival no puede llevarse cartas con poder del centro hasta que se lleve {n} sin poder', { n: T.redbubbleCards }),
    tip: tr('El rival no puede llevarse poderes'),
  },
  // ---- Bestia: el sangrado ----
  razor: {
    id: 'razor', symbol: 'beast', name: 'Hidden Razor', amuleto: 'ecard_beast_5005.png',
    note: tr('+{n} de sangrado al rival: cada carta que robe le saca {dmg} de vida, y el sangrado baja 1', { n: T.razorBleed, dmg: T.bleedDamage }),
    tip: tr('+{n} de sangrado al rival', { n: T.razorBleed }),
  },
  dagger: {
    id: 'dagger', symbol: 'beast', name: 'Raging Dagger', amuleto: 'ecard_beast_buba_1.png',
    note: tr('+{n} de sangrado al rival', { n: T.daggerBleed }),
    tip: tr('+{n} de sangrado al rival', { n: T.daggerBleed }),
  },
  strength: {
    id: 'strength', symbol: 'beast', name: 'Charm of Power', amuleto: 'ecard_beast_4001.png',
    note: tr('+1 garra para toda la partida (hasta {max}): cada ataque tuyo le pone +{bleed} de sangrado al rival por garra', { max: T.clawsMax, bleed: T.clawBleed }),
    tip: tr('+1 garra: cada golpe tuyo, +{bleed} de sangrado', { bleed: T.clawBleed }),
  },
  brutal: {
    id: 'brutal', symbol: 'beast', name: 'Energy Drink M', amuleto: 'ecard_beast_5003.png',
    note: tr('+{n} de sangrado al rival y herida abierta: en su próximo turno, cada carta que pague sangrando te cura {heal}', { n: T.drinkBleed, heal: T.drinkHeal }),
    tip: tr('+{n} de sangrado: lo que sangre te cura', { n: T.drinkBleed }),
  },
  rage: {
    id: 'rage', symbol: 'beast', name: 'Mask of Frenzy', amuleto: 'ecard_beast_4003.png',
    note: tr('+1 de Rage (hasta {max}): cada punto suma +{step} al daño de tus golpes, para toda la partida. Con {max} entrás en Furia: tu próximo ataque suma +{fury} más y la Rage vuelve a 0', { max: T.rageMax, step: T.rageStep, fury: T.furyBonus }),
    tip: tr('+1 de Rage: +{step} de daño; con {max}, Furia', { step: T.rageStep, max: T.rageMax }),
  },
  // ---- Planta: cura, escudo y limpieza ----
  pot: {
    id: 'pot', symbol: 'plant', name: 'Leafy Pot', amuleto: 'ecard_plant_4003.png',
    note: tr('te curás {heal}', { heal: T.potHeal }),
    tip: tr('Te curás {heal}', { heal: T.potHeal }),
  },
  leaf: {
    id: 'leaf', symbol: 'plant', name: 'Spring Leaf', amuleto: 'ecard_plant_ena_1.png',
    note: tr('+{turns} turnos de brote (hasta {max}): al empezar cada turno tuyo te curás {heal} y se gasta uno', { turns: T.leafTurns, max: T.leafMax, heal: T.leafHeal }),
    tip: tr('+{turns} turnos: te curás {heal} al empezar cada uno', { turns: T.leafTurns, heal: T.leafHeal }),
  },
  guard: {
    id: 'guard', symbol: 'plant', name: 'Sleepy Guard', amuleto: 'ecard_plant_bard_1.png',
    note: tr('+{shield} de escudo y 1 Limpiador: cancela el próximo efecto que te ponga el rival (veneno, sangrado, debilidad, bloqueos)', { shield: T.guardShield }),
    tip: tr('+{shield} de escudo y 1 Limpiador', { shield: T.guardShield }),
  },
  sage: {
    id: 'sage', symbol: 'plant', name: 'Red Sage', amuleto: 'ecard_plant_5005.png',
    note: tr('te sacás veneno, sangrado, debilidad y bloqueos, y te curás {heal}', { heal: T.sageHeal }),
    tip: tr('Te limpia y te cura {heal}', { heal: T.sageHeal }),
  },
  pillow: {
    id: 'pillow', symbol: 'plant', name: "Mít's Comfy Pillow", amuleto: 'ecard_plant_mit_1.png',
    note: tr('durante los próximos {turns} turnos del rival, cada ataque suyo te saca {cut} menos; cada almohada más suma {turns} turnos', { turns: T.pillowTurns, cut: T.pillowCut }),
    tip: tr('−{cut} a sus ataques por {turns} turnos', { cut: T.pillowCut, turns: T.pillowTurns }),
  },
  // ---- Bicho: robarle al rival ----
  leech: {
    id: 'leech', symbol: 'bug', name: 'Mantis Dagger', amuleto: 'ecard_mantis_dagger.png',
    note: tr('le pegás {drain} al rival (su escudo lo frena primero) y te curás lo que le llegue a la vida', { drain: T.leechDrain }),
    tip: tr('Le robás hasta {drain} de vida al rival', { drain: T.leechDrain }),
  },
  snail: {
    id: 'snail', symbol: 'bug', name: 'Lazy Snail', amuleto: 'ecard_bug_5005.png',
    note: tr('en el próximo ataque del rival que no se corte, no cuenta su mejor racha (con dos caracoles, tampoco la segunda)'),
    tip: tr('En el próximo ataque rival no cuenta su mejor racha'),
  },
  cocoon: {
    id: 'cocoon', symbol: 'bug', name: 'Cocoon Whistle', amuleto: 'ecard_bug_pomodoro_1.png',
    note: tr('+{turns} turnos de capullo (hasta {max}): al empezar cada turno tuyo ganás {shield} de escudo y se gasta uno', { turns: T.cocoonTurns, max: T.cocoonMax, shield: T.cocoonShield }),
    tip: tr('+{turns} turnos: {shield} de escudo al empezar cada uno', { turns: T.cocoonTurns, shield: T.cocoonShield }),
  },
  scanner: {
    id: 'scanner', symbol: 'bug', name: 'Metal Scanner', amuleto: 'ecard_bug_shillin_1.png',
    note: tr('le sacás todo el escudo al rival y pasa a ser tuyo; si no tiene, ganás {m}', { m: T.scannerShield }),
    tip: tr('Le robás el escudo (o ganás {m})', { m: T.scannerShield }),
  },
  trickster: {
    id: 'trickster', symbol: 'bug', name: "Trickster's Card", amuleto: 'ecard_bug_4003.png',
    note: tr('elegís una carta con poder del mazo del rival, Rocket incluido, y pasa a tu mazo'),
    tip: tr('Le robás una carta con poder al rival'),
  },
  // ---- Reptil: el turno del rival ----
  poison: {
    id: 'poison', symbol: 'reptile', name: 'Poison Vial', amuleto: 'ecard_reptile_venoki_1.png',
    note: tr('+{dose} de veneno al rival (hasta {max}); al final de cada turno suyo le saca eso sin importar su escudo, y baja 1', { dose: T.poisonDose, max: T.poisonMax }),
    tip: tr('+{dose} de veneno que atraviesa el escudo', { dose: T.poisonDose }),
  },
  steelskin: {
    id: 'steelskin', symbol: 'reptile', name: 'Gecko Mask', amuleto: 'ecard_reptile_4003.png',
    note: tr('+{n} espinas (hasta {max}): el próximo golpe del rival que conecte le devuelve eso', { n: T.spikes, max: T.spikesMax }),
    tip: tr('+{n} espinas: el que te pega las recibe', { n: T.spikes }),
  },
  viper: {
    id: 'viper', symbol: 'reptile', name: "Viper's Venom", amuleto: 'ecard_reptile_5005.png',
    note: tr('el próximo turno en que el rival se cure, no le entra ninguna cura de ese turno'),
    tip: tr('Le cancelás la cura de un turno al rival'),
  },
  gloves: {
    id: 'gloves', symbol: 'reptile', name: 'Gloves of Infection', amuleto: 'ecard_glove_of_infection.png',
    note: tr('+{n} de veneno para los dos; al final de este turno tu veneno te cura en vez de dañarte', { n: T.glovesPoison }),
    tip: tr('+{n} de veneno a los dos: el tuyo te cura este turno', { n: T.glovesPoison }),
  },
  edge: {
    id: 'edge', symbol: 'reptile', name: 'Sharp Edge', amuleto: 'ecard_reptile_machito_1.png',
    note: tr('+{n} espinas (hasta {max}): el próximo golpe del rival que conecte le devuelve eso', { n: T.edgeSpikes, max: T.spikesMax }),
    tip: tr('+{n} espinas: el que te pega las recibe', { n: T.edgeSpikes }),
  },
  // ---- Neutrales: sin clase, solo en la Aventura (ver `NEUTRAL_POWERS`) ----
  focus: {
    id: 'focus', symbol: null, name: 'Charm of Focus', amuleto: 'ecard_neutral_1003.png',
    note: tr('+1 foco para toda la partida (hasta {max}): cada ataque tuyo suma +{step} de daño por foco', { max: T.focusMax, step: T.focusStep }),
    tip: tr('+{step} de daño en todos tus ataques', { step: T.focusStep }),
  },
  lens: {
    id: 'lens', symbol: null, name: 'Lens of Revelation', amuleto: 'ecard_lens_of_revelation.png',
    note: tr('ves las {n} cartas de arriba de tu mazo antes de decidir si robás otra', { n: T.lensCards }),
    tip: tr('Ves las {n} cartas que siguen', { n: T.lensCards }),
  },
  spell: {
    id: 'spell', symbol: null, name: 'Novice Spell', amuleto: 'ecard_dusk_4003.png',
    note: tr('elegís uno: te curás {n}, ganás {n} de escudo o le pegás {n} al rival', { n: T.spellAmount }),
    tip: tr('Elegís: curar, escudo o daño ({n})', { n: T.spellAmount }),
  },
  mirror: {
    id: 'mirror', symbol: null, name: 'Red Mirror', amuleto: 'ecard_neutral_red_mirror.png',
    note: tr('copia los símbolos de la carta anterior de tu cadena, así que engancha siempre; si abre la ronda, vale con los suyos'),
    tip: tr('Copia la carta anterior: engancha siempre'),
  },
  energy: {
    id: 'energy', symbol: null, name: 'Energy Drink S', amuleto: 'ecard_neutral_5006.png',
    note: tr('los puntos de tu cadena valen el doble en este ataque, y la bebida se rompe: sale de tu mazo para siempre'),
    tip: tr('Tu cadena vale el doble; después se rompe'),
  },
  papa: {
    id: 'papa', symbol: null, name: 'Papa Bear', amuleto: 'ecard_papa_bear.png',
    note: tr('en ronda par tu golpe suma +{dmg}; en ronda impar ganás {shield} de escudo', { dmg: T.papaDamage, shield: T.papaShield }),
    tip: tr('Par: +{dmg} de daño. Impar: +{shield} de escudo', { dmg: T.papaDamage, shield: T.papaShield }),
  },
  mama: {
    id: 'mama', symbol: null, name: 'Mama Bear', amuleto: 'ecard_mama_bear.png',
    note: tr('en ronda impar te curás {heal}; en ronda par le ponés +{bleed} de sangrado al rival', { heal: T.mamaHeal, bleed: T.mamaBleed }),
    tip: tr('Impar: te curás {heal}. Par: +{bleed} de sangrado', { heal: T.mamaHeal, bleed: T.mamaBleed }),
  },
  blood: {
    id: 'blood', symbol: null, name: 'Bloodpact', amuleto: 'ecard_neutral_bloodpact.png',
    note: tr('tu golpe suma +{dmg}, pero vos quedás con +{self} de sangrado', { dmg: T.bloodDamage, self: T.bloodSelf }),
    tip: tr('+{dmg} de daño; vos sangrás {self}', { dmg: T.bloodDamage, self: T.bloodSelf }),
  },
  dispel: {
    id: 'dispel', symbol: null, name: 'Black Sage', amuleto: 'ecard_black_sage.png',
    note: tr('antes de tu golpe le sacás al rival lo que tiene encima: escudo, espinas, plumas, Rage, almohada y regalo'),
    tip: tr('Le sacás escudo, espinas y lo demás'),
  },
  stamp: {
    id: 'stamp', symbol: null, name: 'Earth Stamp', amuleto: 'ecard_neutral_4001.png',
    note: tr('te llevás una carta del centro de regalo, la que quieras, aparte de lo que te toque'),
    tip: tr('Una carta del centro de regalo'),
  },
  tape: {
    id: 'tape', symbol: null, name: 'Scotch Tape', amuleto: 'ecard_neutral_5004.png',
    note: tr('la cadena queda pegada hasta la última cinta: atacás con lo que tenías hasta ahí, pero no te llevás nada del centro'),
    tip: tr('Atacás con la cadena hasta la cinta'),
  },
  gift: {
    id: 'gift', symbol: null, name: 'Last Gift', amuleto: 'ecard_neutral_last_gift.png',
    note: tr('guardás un regalo: tu próximo ataque suma +{dmg} (hasta {max})', { dmg: T.giftDamage, max: T.giftMax }),
    tip: tr('+{dmg} en tu próximo ataque', { dmg: T.giftDamage }),
  },
  // ---- Neutral ----
  freegame: {
    id: 'freegame', symbol: null, name: 'Rocket Stamp', amuleto: 'ecard_neutral_5001.png',
    note: tr('no te corta: lo ponés sobre la carta de la mesa que elijas y le suma sus símbolos'),
    tip: tr('Ponelo sobre una carta'),
  },
};

for (const p of Object.values(POWERS)) p.icon = iconUrl(`power-${p.id}.png`);

/**
 * Las categorías de los poderes: el momento en que se activan, que es una de las tres
 * formas en que puede seguir el turno. Cada poder lleva la suya como etiqueta (ícono y
 * nombre) en su explicación, nunca adentro de la carta, así el jugador sabe qué esperar
 * de cada decisión antes de tomarla. Los
 * íconos están pintados en `index.html` (`#mo-draw`, `#mo-stand`, `#mo-bust`).
 */
export const MOMENTS = {
  draw:  { id: 'draw',  name: tr('Al robar'),    color: '#7ec3dc', line: tr('Se activa apenas la robás, aunque después te cortes.') },
  stand: { id: 'stand', name: tr('Al atacar'),   color: '#e0a445', line: tr('Se activa cuando te plantás sin cortarte, aunque el golpe haga 0.') },
  bust:  { id: 'bust',  name: tr('Al cortarte'), color: '#e0503c', line: tr('Se activa solo si se corta tu cadena.') },
};
export const MOMENT_IDS = Object.keys(MOMENTS);

const MOMENT_POWERS = {
  draw: [
    'feather', 'fan', 'maker', 'strength', 'dagger', 'rage', 'scanner', 'gloves', 'edge', 'freegame',
    'focus', 'lens', 'spell', 'mirror',
  ],
  stand: [
    'octopus', 'bubble', 'jellyfish', 'redbubble', 'razor', 'brutal', 'pot', 'leaf', 'guard', 'sage',
    'pillow', 'leech', 'snail', 'cocoon', 'trickster', 'poison', 'steelskin', 'viper',
    'energy', 'papa', 'mama', 'blood', 'dispel',
  ],
  bust: ['egg', 'shuriken', 'hammer', 'stamp', 'tape', 'gift'],
};
for (const [moment, ids] of Object.entries(MOMENT_POWERS)) for (const id of ids) POWERS[id].moment = moment;

/** El ícono de la categoría. */
export function momentIcon(moment) {
  return `<svg class="moment-ico" viewBox="0 0 100 100" aria-hidden="true"><use href="#mo-${moment}"/></svg>`;
}

/** La etiqueta de la categoría: el ícono y su nombre, para la explicación del poder. */
export function momentTag(moment) {
  const m = MOMENTS[moment];
  return `<span class="moment-tag" data-moment="${moment}" style="--m:${m.color}" title="${m.line}">${momentIcon(moment)}<span class="moment-word">${m.name}</span></span>`;
}

export const POWER_IDS = Object.keys(POWERS);

/**
 * Los poderes de cada clase. En cada partida se sortea uno por clase: todos los de una
 * lista comparten la especialidad de su clase, así cualquiera que salga se juega igual.
 */
export const CLASS_POWERS = {
  beast:   ['strength', 'brutal', 'razor', 'dagger', 'rage'],
  aquatic: ['octopus', 'bubble', 'maker', 'jellyfish', 'redbubble'],
  bird:    ['egg', 'feather', 'shuriken', 'fan', 'hammer'],
  plant:   ['pot', 'leaf', 'guard', 'sage', 'pillow'],
  bug:     ['snail', 'leech', 'cocoon', 'scanner', 'trickster'],
  reptile: ['poison', 'steelskin', 'viper', 'gloves', 'edge'],
};

export const CLASS_POWER_IDS = Object.values(CLASS_POWERS).flat();

/**
 * Los amuletos neutrales: sin clase, así que encadenan con cualquiera. Por ahora salen
 * solo en la Aventura, que los estrena primero (ver `UNLOCK_ORDER` en `adventure.js`);
 * las partidas sueltas siguen con un poder por clase. En el orden en que se estrenan:
 * de lo más simple a lo que pide pensar.
 */
export const NEUTRAL_POWERS = [
  'focus', 'spell', 'lens', 'gift', 'papa', 'stamp', 'mama', 'mirror', 'blood', 'tape', 'energy', 'dispel',
];

/** Sortea un poder activo para cada clase. */
export function chooseActivePowers(rng = Math.random) {
  return SYMBOL_IDS.map((sym) => {
    const list = CLASS_POWERS[sym] || [];
    return list[Math.floor(rng() * list.length)];
  }).filter(Boolean);
}

/** El símbolo de poder como HTML, para la carta y para el registro. */
export function powerIcon(id, size = '') {
  const p = POWERS[id];
  const cls = size ? `power power--${size}` : 'power';
  return `<img class="${cls}" src="${p.icon}" alt="${p.name}" title="${p.name}: ${p.note}">`;
}

/**
 * Las dos clases que acompañan a cada poder en sus seis cartas —la tercera es
 * siempre la suya—. Están elegidas para que las seis clases aparezcan exactamente
 * 18 veces entre las 36 cartas: 6 como dueña de su propio poder y 12 como
 * acompañante. Así ninguna queda sobrerrepresentada en la reserva.
 *
 * Son 36 cartas sobre 20 tríos posibles, así que el mismo trío aparece con poderes
 * distintos. Encadenan igual y se eligen por el efecto, que es justo la decisión
 * que el centro tiene que ofrecer. Todos los poderes de una clase comparten tríos:
 * como solo uno entra en cada partida, el balance es el mismo.
 */
const CLASS_TRIOS = {
  bird: [
    ['beast', 'aquatic'], ['beast', 'plant'], ['aquatic', 'bug'],
    ['plant', 'bug'], ['plant', 'reptile'], ['bug', 'reptile'],
  ],
  aquatic: [
    ['beast', 'bird'], ['beast', 'plant'], ['bird', 'plant'],
    ['bird', 'bug'], ['plant', 'reptile'], ['bug', 'reptile'],
  ],
  plant: [
    ['beast', 'aquatic'], ['beast', 'bug'], ['aquatic', 'reptile'],
    ['bird', 'bug'], ['bird', 'reptile'], ['bug', 'reptile'],
  ],
  reptile: [
    ['beast', 'aquatic'], ['beast', 'bird'], ['beast', 'plant'],
    ['aquatic', 'bird'], ['aquatic', 'bug'], ['plant', 'bug'],
  ],
  bug: [
    ['beast', 'aquatic'], ['beast', 'bird'], ['beast', 'plant'],
    ['aquatic', 'reptile'], ['bird', 'reptile'], ['plant', 'reptile'],
  ],
  beast: [
    ['aquatic', 'bird'], ['aquatic', 'plant'], ['aquatic', 'bug'],
    ['bird', 'plant'], ['bird', 'reptile'], ['bug', 'reptile'],
  ],
};

/**
 * Las seis cartas de cada amuleto neutral, de dos símbolos: cada clase sale dos veces,
 * así ninguna saca ventaja de que el amuleto esté en juego.
 */
const NEUTRAL_PAIRS = [
  ['beast', 'aquatic'], ['bird', 'bug'], ['plant', 'reptile'],
  ['beast', 'bird'], ['aquatic', 'plant'], ['bug', 'reptile'],
];

export const POWER_TRIOS = Object.fromEntries(
  Object.values(POWERS).filter((p) => p.symbol).map((p) => [p.id, CLASS_TRIOS[p.symbol]]),
);

/** Las seis cartas de un poder de la reserva: la clase y su par, o el par de un neutral. */
export const powerCardSymbols = (id) => (POWERS[id].symbol
  ? POWER_TRIOS[id].map((pair) => [POWERS[id].symbol, ...pair])
  : NEUTRAL_PAIRS.map((pair) => pair.slice()));

// Los uid son únicos entre todos los mazos: la UI los usa para no reanimar cartas ya vistas.
let nextUid = 0;
const byOrder = (a, b) => SYMBOL_IDS.indexOf(a) - SYMBOL_IDS.indexOf(b);

/**
 * Los símbolos se guardan siempre en el orden de SYMBOL_IDS, así `key` es canónica.
 * `power` entra en la clave porque dos cartas con los mismos tres símbolos y poderes
 * distintos son cartas distintas —encadenan igual, pero no valen lo mismo—.
 */
export function makeCard(symbols, power = null, opts = {}) {
  const sorted = symbols.slice().sort(byOrder);
  const key = sorted.join('+');
  const uid = nextUid++;
  return {
    uid,
    id: opts.id ?? `c_${uid}`,
    name: opts.name ?? (power ? (POWERS[power]?.name || tr('Poder')) : sorted.map((s) => SYMBOLS[s]?.name || s).join(' · ')),
    symbols: sorted,
    isFavorable: opts.isFavorable ?? false,
    associatedPart: opts.associatedPart,
    hasPower: Boolean(power),
    powerEffect: power || undefined,
    power,
    key: power ? `${key}@${power}` : key,
  };
}

/**
 * La medusa de la Paralyzing Jellyfish: una carta sin símbolos que se mezcla en el
 * mazo del rival. No comparte nada con ninguna racha, así que lo corta; si abre la
 * ronda, no abre ninguna. Se rompe apenas sale: nunca vuelve al mazo (ver `game.js`).
 */
export function makeJelly() {
  return { ...makeCard([], null, { name: tr('Medusa') }), jelly: true };
}

function combinations(items, size) {
  if (size === 0) return [[]];
  const out = [];
  for (let i = 0; i <= items.length - size; i++) {
    for (const rest of combinations(items.slice(i + 1), size - 1)) {
      out.push([items[i], ...rest]);
    }
  }
  return out;
}

/**
 * Reserva común: 71 cartas. Las 35 sin poder —las 15 combinaciones de 2 símbolos y
 * las 20 de 3, una por combinación— más las 36 con poder, seis por cada uno. De acá
 * salen las cartas que los jugadores suman a su mazo personal; los mazos iniciales
 * de 10 no llevan poderes.
 */
export function buildPool(activePowers = null, rng = Math.random) {
  const plain = [2, 3].flatMap((size) =>
    combinations(SYMBOL_IDS, size).map((symbols) => makeCard(symbols)),
  );
  const powers = activePowers || chooseActivePowers(rng);
  const powered = powers.flatMap((id) => powerCardSymbols(id).map((symbols) => makeCard(symbols, id)));
  const freegame = combinations(SYMBOL_IDS, 2).map((symbols) => makeCard(symbols, 'freegame'));
  return [...plain, ...powered, ...freegame];
}

// ---- Taxonomía Canónica y Axie Core ------------------------------------------

/** Orden cíclico canónico de las 6 clases (índices 0 a 5) */
export const CANONICAL_CLASSES = ['plant', 'beast', 'aquatic', 'bird', 'bug', 'reptile'];

/** Partes anatómicas NFT del Axie */
export const ANATOMICAL_PARTS = ['eyes', 'ears', 'horn', 'mouth', 'back', 'tail'];

export const PART_NAMES = {
  tail: tr('Cola'),
  mouth: tr('Boca'),
  eyes: tr('Ojos'),
  ears: tr('Orejas'),
  horn: tr('Cuerno'),
  back: tr('Espalda'),
};

/**
 * Saltos anatómicos fijos sobre el ciclo canónico:
 *   tail:  0  (mono-símbolo pura: [C_i])
 *   mouth: +1 [C_i, C_{(i+1)%6}]
 *   eyes:  +2 [C_i, C_{(i+2)%6}]
 *   ears:  +3 [C_i, C_{(i+3)%6}]
 *   horn:  +4 [C_i, C_{(i+4)%6}]
 *   back:  +5 [C_i, C_{(i+5)%6}]
 */
export const ANATOMICAL_JUMPS = {
  tail: 0,
  mouth: 1,
  eyes: 2,
  ears: 3,
  horn: 4,
  back: 5,
};

/** Tríadas canónicas (Piedra, Papel o Tijera) */
export const TRIADS = {
  rock: ['plant', 'reptile'],
  paper: ['beast', 'bug'],
  scissors: ['bird', 'aquatic'],
};

/** Regla de combate: Paper vence a Rock, Scissors vence a Paper, Rock vence a Scissors */
export const TRIAD_BEATS = {
  paper: 'rock',
  scissors: 'paper',
  rock: 'scissors',
};

export const TRIAD_LOSES_TO = Object.fromEntries(
  Object.entries(TRIAD_BEATS).map(([winner, loser]) => [loser, winner]),
);

/** Determina la tríada canónica a la que pertenece una clase */
export const getTriadForClass = (cls) =>
  Object.keys(TRIADS).find((triad) => TRIADS[triad].includes(cls)) ?? null;

/**
 * Sistema de Tríadas y Cartas Desfavorables (Counter Suppression Formula):
 * Para cualquier clase base:
 *   P1, P2: Presas (las 2 clases de la tríada a la que vence).
 *   C1, C2: Counters (las 2 clases de la tríada que la vence).
 *
 * Retorna las 2 cartas desfavorables, una por cada tríada rival:
 *   Card 1: [P1, P2] (doble presa)
 *   Card 2: [C1, C2] (confinamiento de amenaza)
 *
 * El aliado (la otra clase de tu tríada) no entra: ya está en una de tus favorables.
 *
 * Verificación matemática: las dos cartas no comparten ningún símbolo, así que cada
 * clase ajena aparece a lo sumo una vez entre las desfavorables. Es lo que impide una
 * cadena asegurada: aunque un mismo símbolo se le sume a las seis favorables (Part
 * Evolution), siempre queda una desfavorable que no lo lleva y corta.
 */
export function getCounterSuppressionCards(baseClass) {
  const triad = getTriadForClass(baseClass);
  if (!triad) throw new Error(`Clase no reconocida: ${baseClass}`);

  const byCanonical = (a, b) => CANONICAL_CLASSES.indexOf(a) - CANONICAL_CLASSES.indexOf(b);

  const preyTriad = TRIAD_BEATS[triad];
  const counterTriad = TRIAD_LOSES_TO[triad];

  const preys = TRIADS[preyTriad].slice().sort(byCanonical);
  const counters = TRIADS[counterTriad].slice().sort(byCanonical);

  const [p1, p2] = preys;
  const [c1, c2] = counters;

  return [
    [p1, p2],
    [c1, c2],
  ];
}

// Compatibilidad retroactiva: todas las cartas desfavorables posibles
export const UNFAVORABLE = CANONICAL_CLASSES.flatMap(getCounterSuppressionCards);

/** Normaliza un id de clase, objeto Axie o estado NFT a la estructura AxieNFTState */
export function toAxieNFTState(input) {
  if (!input) return null;
  if (typeof input === 'string') {
    const parts = {};
    for (const p of ANATOMICAL_PARTS) {
      parts[p] = { class: input, isEvolved: false };
    }
    return { id: input, baseClass: input, parts };
  }
  if (input.baseClass && input.parts) {
    return input;
  }
  if (input.class && input.parts) {
    const parts = {};
    for (const p of ANATOMICAL_PARTS) {
      const val = input.parts[p];
      if (typeof val === 'string') {
        const cls = val.split('-')[0];
        parts[p] = { class: cls, isEvolved: false };
      } else if (val && typeof val === 'object') {
        parts[p] = { class: val.class || input.class, isEvolved: Boolean(val.isEvolved) };
      } else {
        parts[p] = { class: input.class, isEvolved: false };
      }
    }
    return {
      id: input.id || input.class,
      baseClass: input.class,
      parts,
    };
  }
  return null;
}

/**
 * Genera el mazo base de 8 cartas según la taxonomía canónica y Axie Core:
 *  - 6 cartas favorables asociadas a las partes anatómicas con saltos canónicos
 *    y mutación por Part Evolution (isEvolved: true incorpora C_{part})
 *  - 2 cartas desfavorables calculadas por la Counter Suppression Formula
 */
export function baseDeck(baseClass, nftState = null) {
  const i = CANONICAL_CLASSES.indexOf(baseClass);
  if (i === -1) throw new Error(`Clase base inválida: ${baseClass}`);

  const state = nftState ? toAxieNFTState(nftState) : null;
  const parts = state?.parts || {};

  // 6 cartas favorables según saltos anatómicos fijos
  const favorableCards = Object.entries(ANATOMICAL_JUMPS).map(([part, jump]) => {
    const symbols = jump === 0 ? [baseClass] : [baseClass, CANONICAL_CLASSES[(i + jump) % 6]];
    // Axie Core - Part Evolution (Mutación a 3 símbolos / 2 en cola)
    if (parts[part]?.isEvolved) symbols.push(parts[part].class || baseClass);

    return makeCard(symbols, null, {
      id: `${baseClass}-${part}`,
      name: PART_NAMES[part],
      isFavorable: true,
      associatedPart: part,
    });
  });

  // 2 cartas desfavorables (Counter Suppression Formula)
  const unfavorablePairs = getCounterSuppressionCards(baseClass);
  const unfavorableNames = [
    tr('Doble Presa'),
    tr('Confinamiento'),
  ];

  const unfavorableCards = unfavorablePairs.map((pair, idx) =>
    makeCard(pair, null, {
      id: `${baseClass}-unfav-${idx + 1}`,
      name: unfavorableNames[idx],
      isFavorable: false,
    })
  );

  return [...favorableCards, ...unfavorableCards];
}

/**
 * Qué símbolo se le puede sumar a una carta del mazo de quien juega `symbol`. Uno
 * solo, y de los que la carta ya tiene algo que ver:
 *
 *  - las seis cartas propias —las que llevan tu símbolo— admiten **el tuyo**, que es
 *    el único que te sirve de las dos maneras: sube la racha de tu color y no le abre
 *    la puerta a ningún otro.
 *  - las dos no favorables —las que no lo llevan— admiten **uno de sus dos**, el
 *    que elijas. Son las cartas que no te representan, así que la mejora es elegir
 *    cuál de las dos mitades ajenas pesa más: un `planta+reptil` mejorado con reptil
 *    queda con dos reptiles y una planta.
 *
 * El símbolo repetido no es adorno: la racha cuenta cada aparición (ver `timesIn` en
 * `rules.js`), así que una carta con el símbolo dos veces adelanta su racha de a dos
 * y la racha puntúa al cuadrado.
 */
export function boostOptions(card, symbol) {
  const own = [...new Set(card.symbols)];
  return own.includes(symbol) ? [symbol] : own;
}

/**
 * Genera el mazo completo de 8 cartas a partir de un AxieNFTState.
 */
export function buildAxieDeck(nftState) {
  const state = toAxieNFTState(nftState);
  if (!state) throw new Error('Estado NFT inválido para buildAxieDeck');
  return baseDeck(state.baseClass, state);
}

/**
 * El mazo de 8 con las mejoras puestas y/o estado AxieNFTState.
 * Compatible con strings de clase, objetos Axie del roster y AxieNFTState.
 */
export function buildPersonalDeck(axieOrClass, boosts = {}) {
  const nftState = toAxieNFTState(axieOrClass);
  const baseClass = nftState.baseClass;
  const cards = baseDeck(baseClass, nftState);

  return cards.map((card) => {
    const add = boosts[card.key];
    return add && boostOptions(card, baseClass).includes(add)
      ? makeCard([...card.symbols, add], card.power, {
          id: card.id,
          name: card.name,
          isFavorable: card.isFavorable,
          associatedPart: card.associatedPart,
        })
      : card;
  });
}

// ---- las cartas de la mochila --------------------------------------------------

/**
 * Cuántas cartas de la mochila se le pueden sumar a un Axie. Son cartas de más en un
 * mazo de 8: cuatro es lo que se lleva uno en dos rondas buenas del centro, y el mazo
 * sigue siendo del Axie y no de la mochila.
 */
export const EXTRA_SLOTS = 4;

/**
 * Una carta de la mochila tal como viaja: sus símbolos (1 a 3, de las seis clases) y su
 * poder, si trae uno que exista. Lo que no sea eso no es una carta.
 *
 * Se limpia acá y no en la pantalla porque la lista cruza el cable en una sala (ver
 * `cleanLoadout`): lo que llega puede ser cualquier cosa.
 */
export function cleanExtra(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.symbols)) return null;
  const symbols = raw.symbols.filter((s) => SYMBOL_IDS.includes(s));
  if (symbols.length !== raw.symbols.length || symbols.length < 1 || symbols.length > 3) return null;
  const power = typeof raw.power === 'string' && POWERS[raw.power] ? raw.power : null;
  return { symbols: symbols.slice().sort(byOrder), power };
}

/** Las cartas de la mochila de un Axie, limpias y hasta `EXTRA_SLOTS`. */
export function cleanExtras(list) {
  if (!Array.isArray(list)) return [];
  return list.map(cleanExtra).filter(Boolean).slice(0, EXTRA_SLOTS);
}

/** Las cartas de la mochila, hechas cartas de verdad para sumar al mazo del Axie. */
export function extraCards(list) {
  return cleanExtras(list).map((c, i) => makeCard(c.symbols, c.power, { id: `bag-${i + 1}` }));
}

/**
 * Un generador de azar reproducible a partir de un número (mulberry32: corto, rápido
 * y de período de sobra para una partida).
 *
 * Existe para poder medir. Sin esto, dos corridas del mismo experimento reparten
 * cartas distintas y la diferencia entre ellas es mitad efecto y mitad sorteo — hacen
 * falta miles de partidas para distinguir una cosa de la otra. Con la misma semilla,
 * un A/B se compara de a pares sobre repartos idénticos y el ruido se cancela en vez
 * de sumarse.
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(cards, rng = Math.random) {
  const out = cards.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Los poderes de una carta: uno, o todos los de las cartas que lleva montadas. */
export const powersOf = (card) => (card.stackedCards
  ? card.stackedCards.map((c) => c.power).filter(Boolean)
  : (card.powers || (card.power ? [card.power] : [])));

/** Los símbolos de una carta —y su poder, si tiene—, para el registro de la partida. */
export const cardLabel = (card) =>
  (card.jelly ? powerIcon('jellyfish', 'sm') : '')
  + card.symbols.map((s) => crest(s, 'sm')).join('') + powersOf(card).map((p) => powerIcon(p, 'sm')).join('');
