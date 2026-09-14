// Demostración interactiva y no invasiva de poderes para los primeros niveles
// del Modo Aventura (cubriendo los 7 símbolos de los niveles 1 a 3 y extensible a los demás).

import { SYMBOLS, POWERS, crest, powerIcon } from './data.js';

export const DEMO_PREF_KEY = 'axie-chance:demo-pref:lvl-';
export const DEMO_SEEN_KEY = 'axie-chance:demo-seen:lvl-';

/**
 * Catálogo completo de demostraciones visuales por poder.
 */
export const POWER_DEMOS = {
  strength: {
    id: 'strength',
    powerId: 'strength',
    symbol: 'beast',
    name: 'Fuerza',
    className: 'Bestia',
    badge: '🦁 Ofensivo Permanente',
    tagline: '+1 de daño permanente en este ataque y en todos los futuros',
    description: 'Cada carta de Fuerza jugada en un ataque que conecte (daño > 0) suma +1 a ese golpe y agrega una carga permanente de Fuerza para el resto de la partida. ¡Se acumula con cada carta de Fuerza jugada!',
    tacticalTip: 'Ideal para construir ventaja a largo plazo: mientras más rondas dure el combate, más destructivos serán tus ataques base.',
    simulation: {
      title: 'Demostración en Combate: Acumulación de Fuerza',
      steps: [
        {
          label: 'Paso 1: Jugás carta con Fuerza',
          fieldCard: { syms: ['beast', 'aquatic'], power: 'strength' },
          baseDamage: 4,
          powerBonus: 1,
          totalDamage: 5,
          statusGain: '+1 Fuerza',
          notes: 'Tu cadena de cartas tiene 4 puntos base. La carta incluye el poder de Fuerza.',
        },
        {
          label: 'Paso 2: ¡Golpe conectado!',
          fieldCard: { syms: ['beast', 'aquatic'], power: 'strength' },
          baseDamage: 4,
          powerBonus: 1,
          totalDamage: 5,
          statusGain: '+1 Fuerza',
          attackerHp: 100,
          rivalHp: 95,
          strikeText: '💥 5 de daño (4 base + 1 Fuerza)',
          notes: 'Al soltar el ataque, el +1 se suma al daño total y el rival recibe 5 de daño.',
        },
        {
          label: 'Paso 3: Bono permanente activo',
          fieldCard: null,
          baseDamage: 0,
          powerBonus: 1,
          totalDamage: 1,
          statusGain: 'Fuerza activa: +1',
          attackerHp: 100,
          rivalHp: 95,
          strikeText: '✨ Próximas rondas: arrancás con +1 de daño garantizado',
          notes: 'El bono queda grabado en tu Axie: cada futuro golpe sumará +1 aunque no tengas cartas de Fuerza ese turno.',
        },
      ],
    },
  },

  pot: {
    id: 'pot',
    powerId: 'pot',
    symbol: 'plant',
    name: 'Maceta',
    className: 'Planta',
    badge: '🌿 Curación Instantánea',
    tagline: 'Te curás el 100% del daño que conectás este turno',
    description: 'Cuando jugás una carta de Maceta y te plantás con éxito (daño > 0), tu Axie recupera tanta vida como daño le infligiste al rival (hasta el tope de 100 HP).',
    tacticalTip: 'Un combo largo con Maceta puede restaurar tu vida de 10 a 100 de un solo golpe y revertir una partida perdida.',
    simulation: {
      title: 'Demostración en Combate: Curación Directa',
      steps: [
        {
          label: 'Paso 1: Axie herido prepara golpe',
          fieldCard: { syms: ['plant', 'bug'], power: 'pot' },
          baseDamage: 14,
          powerBonus: 0,
          totalDamage: 14,
          attackerHp: 65,
          rivalHp: 100,
          notes: 'Tu Axie ha recibido daño y está en 65 HP. Jugás una carta de Maceta y lográs 14 de daño.',
        },
        {
          label: 'Paso 2: ¡Impacto al rival!',
          fieldCard: { syms: ['plant', 'bug'], power: 'pot' },
          baseDamage: 14,
          powerBonus: 0,
          totalDamage: 14,
          attackerHp: 65,
          rivalHp: 86,
          strikeText: '💥 14 de daño al rival',
          notes: 'El golpe conecta con éxito reduciendo la vida del rival en 14 puntos.',
        },
        {
          label: 'Paso 3: ¡Efecto Maceta!',
          fieldCard: { syms: ['plant', 'bug'], power: 'pot' },
          baseDamage: 14,
          powerBonus: 0,
          totalDamage: 14,
          attackerHp: 79,
          rivalHp: 86,
          healText: '💚 +14 HP curados (65 ➔ 79 HP)',
          notes: '¡Te curás exactamente lo mismo que pegaste! Tu Axie recupera 14 HP al instante.',
        },
      ],
    },
  },

  freegame: {
    id: 'freegame',
    powerId: 'freegame',
    symbol: null,
    name: 'Free Game',
    className: 'Neutral',
    badge: '🃏 Comodín Apilable',
    tagline: 'Al entrar en mesa, alarga una carta existente',
    description: 'Free Game es una carta comodín con 2 símbolos: al salir de tu mazo debe coincidir con tus cadenas vivas o te cortás como siempre. Al entrar en mesa con éxito, tu próximo robo alarga una carta que elijas sumando sus símbolos.',
    tacticalTip: 'Úsala para extender tus rachas montando símbolos sobre una carta ya jugada.',
    simulation: {
      title: 'Demostración en Combate: Comodín Apilable',
      steps: [
        {
          label: 'Paso 1: Cadena viva en mesa',
          fieldCard: { syms: ['aquatic', 'bird'] },
          baseDamage: 5,
          powerBonus: 0,
          totalDamage: 5,
          notes: 'Tenés cartas en mesa y el dial de riesgo indica peligro de corte.',
        },
        {
          label: 'Paso 2: ¡Robás Free Game!',
          fieldCard: { syms: ['aquatic', 'bird'], power: 'freegame' },
          baseDamage: 5,
          powerBonus: 0,
          totalDamage: 5,
          strikeText: '🃏 ¡Free Game! Entra en mesa y activa el comodín',
          notes: 'La carta conectó con tu racha: ahora tu próximo robo alargará la carta que elijas de la mesa.',
        },
        {
          label: 'Paso 3: Carta alargada con éxito',
          fieldCard: { syms: ['aquatic', 'bird', 'plant'], power: 'freegame' },
          baseDamage: 9,
          powerBonus: 0,
          totalDamage: 9,
          strikeText: '✨ ¡Racha extendida a 9 puntos!',
          notes: 'Alarga la carta elegida sumando sus símbolos sin peligro de corte.',
        },
      ],
    },
  },

  egg: {
    id: 'egg',
    powerId: 'egg',
    symbol: 'bird',
    name: 'Huevo',
    className: 'Pájaro',
    badge: '🐦 Escudo y Contraataque',
    tagline: 'Escudo por medio golpe y 8 de contraataque al romperse',
    description: 'Al atacar con Huevo (daño > 0), ganás un escudo equivalente a la mitad del golpe infligido. Este escudo aguanta daño rival y, al romperse completamente por un ataque enemigo, ¡castiga al rival con 8 de daño fijo acumulable!',
    tacticalTip: 'Combina defensa con ofensiva: si el rival intenta golpearte fuerte, la cáscara rota le devolverá 8 de daño directo.',
    simulation: {
      title: 'Demostración en Combate: Escudo y Rotura',
      steps: [
        {
          label: 'Paso 1: Pegás y armás escudo',
          fieldCard: { syms: ['bird', 'aquatic'], power: 'egg' },
          baseDamage: 14,
          totalDamage: 14,
          attackerShield: 7,
          notes: 'Conectás un golpe de 14 de daño ➔ Ganás un escudo protector de 7 HP (la mitad).',
        },
        {
          label: 'Paso 2: El rival ataca',
          fieldCard: null,
          attackerHp: 97,
          attackerShield: 0,
          rivalDamage: 10,
          strikeText: '🛡️ Escudo absorbe 7 de daño y se rompe (vida: 100 ➔ 97)',
          notes: 'El rival pega 10: el huevo absorbe los primeros 7 puntos y se quiebra.',
        },
        {
          label: 'Paso 3: ¡Cáscara rota!',
          fieldCard: null,
          rivalHp: 78,
          strikeText: '💥 ¡Contraataque de cáscara! -8 HP al rival',
          notes: '¡Al romperse el escudo, la cáscara estalla devolviendo 8 de daño directo al rival!',
        },
      ],
    },
  },

  snail: {
    id: 'snail',
    powerId: 'snail',
    symbol: 'bug',
    name: 'Caracol',
    className: 'Bicho',
    badge: '🐛 Debilidad Defensiva',
    tagline: 'El próximo ataque del rival inflige la mitad del daño',
    description: 'Al atacar con éxito con un Caracol (daño > 0), aplicás 1 carga de debilidad al rival. El próximo ataque que el rival ejecute verá su daño reducido a la mitad (redondeado hacia arriba). Si jugás varios caracoles, debilita múltiples ataques.',
    tacticalTip: 'Neutraliza ataques letales: un golpe masivo de 30 puntos queda reducido a solo 15.',
    simulation: {
      title: 'Demostración en Combate: Baba Debilitadora',
      steps: [
        {
          label: 'Paso 1: Conectás Caracol',
          fieldCard: { syms: ['bug', 'plant'], power: 'snail' },
          totalDamage: 8,
          rivalWeak: 1,
          strikeText: '🐌 Debilidad aplicada al rival (x1)',
          notes: 'Tu ataque conecta y el rival queda cubierto de baba con 1 carga de debilidad.',
        },
        {
          label: 'Paso 2: Rival prepara golpe fuerte',
          fieldCard: null,
          rivalRawSwing: 16,
          strikeText: '⚠️ Rival ataca con 16 de daño base',
          notes: 'El rival completa una buena cadena que normalmente te sacaría 16 de vida.',
        },
        {
          label: 'Paso 3: ¡Caracol reduce el golpe!',
          fieldCard: null,
          attackerHp: 92,
          strikeText: '🛡️ ¡Daño cortado al 50%! Recibís solo 8 de daño',
          notes: 'La debilidad se consume y parte el daño a la mitad: recibís 8 en lugar de 16.',
        },
      ],
    },
  },

  octopus: {
    id: 'octopus',
    powerId: 'octopus',
    symbol: 'aquatic',
    name: 'Pulpo',
    className: 'Pez',
    badge: '🐟 Ventaja de Mercado',
    tagline: '+1 elección adicional del Centro de draft al plantarte',
    description: 'Si lográs plantarte sin cortarte la cadena, cada carta de Pulpo en tu mesa te otorga 1 carta extra del centro del mercado directamente a tu mazo, sin importar si conectaste daño o no.',
    tacticalTip: 'Permite robar las mejores cartas del mercado antes de que el rival las tome, acelerando la calidad de tu mazo.',
    simulation: {
      title: 'Demostración en Combate: Draft Extraordinario',
      steps: [
        {
          label: 'Paso 1: Te plantás con Pulpo',
          fieldCard: { syms: ['aquatic', 'beast'], power: 'octopus' },
          totalDamage: 6,
          notes: 'Te plantás con éxito. La carta de Pulpo está activa en tu mesa.',
        },
        {
          label: 'Paso 2: Mercado Central abierto',
          fieldCard: null,
          draftSlots: 1,
          octopusBonus: 1,
          strikeText: '🐙 ¡Bono de Pulpo activo en el Centro!',
          notes: 'Al entrar al mercado, se habilita una ronda bonus de selección especial.',
        },
        {
          label: 'Paso 3: ¡Pick extra para tu mazo!',
          fieldCard: null,
          draftSlots: 2,
          strikeText: '🎁 +1 Carta extra gratis agregada a tu mazo',
          notes: 'Elegís tu carta normal y además te llevás otra carta del mercado directamente a tu mazo.',
        },
      ],
    },
  },

  poison: {
    id: 'poison',
    powerId: 'poison',
    symbol: 'reptile',
    name: 'Veneno',
    className: 'Reptil',
    badge: '🦎 Daño Residual Inevitable',
    tagline: 'Inocula veneno por la mitad del golpe; muerde y se reduce',
    description: 'Al atacar con Veneno (daño > 0), inoculás veneno al rival equivalente a la mitad del daño infligido. Al finalizar el turno del rival, el veneno muerde restando vida y luego se divide a la mitad hasta disiparse al llegar a 2 o menos.',
    tacticalTip: 'El veneno ignora escudos y defensas convencionales, asegurando desgaste continuo contra Axies defensivos.',
    simulation: {
      title: 'Demostración en Combate: Mordida de Veneno',
      steps: [
        {
          label: 'Paso 1: Inoculación de Veneno',
          fieldCard: { syms: ['reptile', 'plant'], power: 'poison' },
          totalDamage: 12,
          rivalPoison: 6,
          strikeText: '🧪 Inoculás 6 de Veneno al rival (mitad de 12)',
          notes: 'Conectás 12 de daño directo e inoculás 6 cargas de veneno al rival.',
        },
        {
          label: 'Paso 2: Fin de turno rival (1ª mordida)',
          fieldCard: null,
          rivalHp: 82,
          rivalPoison: 3,
          strikeText: '💜 El veneno muerde: -6 HP ➔ Se reduce a 3',
          notes: 'Al terminar su turno, el veneno le resta 6 de vida y luego se parte a la mitad (3).',
        },
        {
          label: 'Paso 3: 2ª mordida y disipación',
          fieldCard: null,
          rivalHp: 79,
          rivalPoison: 0,
          strikeText: '💜 Muerde -3 HP ➔ Se reduce a 1 y se disipa ✨',
          notes: 'El veneno muerde 3 más y se disipa por completo. ¡Daño total del veneno: 9 HP extra!',
        },
      ],
    },
  },

  brutal: {
    id: 'brutal',
    powerId: 'brutal',
    symbol: 'beast',
    name: 'Garra Brutal',
    className: 'Bestia',
    badge: '🦁 Multiplicador Feroz',
    tagline: '+2 de daño por cada símbolo de tu cadena más larga',
    description: 'Al atacar, suma +2 de daño adicional por cada símbolo que tenga tu cadena más larga.',
    tacticalTip: 'Se activa siempre que conectes daño: cuanto más larga sea tu mejor racha, más daño sumás.',
    simulation: {
      title: 'Demostración: Garra Brutal',
      steps: [
        {
          label: 'Cadena con 3 símbolos en tu racha más larga',
          fieldCard: { syms: ['beast', 'bird'], power: 'brutal' },
          baseDamage: 9,
          powerBonus: 6,
          totalDamage: 15,
          strikeText: '💥 +6 de bono brutal (3 símbolos × +2)',
          notes: '¡Suma +2 de daño por cada símbolo de tu cadena más larga!',
        },
      ],
    },
  },

  leaf: {
    id: 'leaf',
    powerId: 'leaf',
    symbol: 'plant',
    name: 'Hoja (Leaf)',
    className: 'Planta',
    badge: '🌿 Regeneración Turno a Turno',
    tagline: '+2 hojas: cura 4 HP por hoja al final de tu turno',
    description: 'Al plantarte con daño, ganás +2 hojas (hasta 5). Al final de cada uno de tus turnos, cura 4 de vida por cada hoja activa y consume 1 hoja.',
    tacticalTip: 'Sana de forma pasiva y constante, incluso en turnos donde la cadena se corte.',
    simulation: {
      title: 'Demostración: Curación con Hojas',
      steps: [
        {
          label: 'Ganás 2 hojas regenerativas',
          fieldCard: { syms: ['plant', 'beast'], power: 'leaf' },
          totalDamage: 6,
          statusGain: '+2 Hojas',
          notes: 'Sumás hojas de vida que sanarán automáticamente al terminar tus turnos.',
        },
        {
          label: 'Fin de turno: Curación continua',
          fieldCard: null,
          healText: '💚 Cura 8 HP (2 hojas x 4) y consume 1 hoja',
          notes: 'Recuperás vida turno a turno de manera garantizada.',
        },
      ],
    },
  },

  feather: {
    id: 'feather',
    powerId: 'feather',
    symbol: 'bird',
    name: 'Pluma Sagrada',
    className: 'Pájaro',
    badge: '🐦 Daño Directo Instantáneo',
    tagline: '5 de daño inmediato al rival apenas robás la carta',
    description: 'Inflige 5 de daño directo al rival apenas se roba la carta, sin esperar a que termine el turno e incluso si la cadena se corta.',
    tacticalTip: 'Daño 100% seguro que no puede ser bloqueado ni evitado.',
    simulation: {
      title: 'Demostración: Pluma Sagrada',
      steps: [
        {
          label: 'Robás la Pluma Sagrada',
          fieldCard: { syms: ['bird', 'plant'], power: 'feather' },
          strikeText: '⚡ ¡5 de daño directo al instante!',
          notes: 'El rival recibe 5 de daño en el momento exacto en que la carta sale del mazo.',
        },
      ],
    },
  },

  leech: {
    id: 'leech',
    powerId: 'leech',
    symbol: 'bug',
    name: 'Greedy Leech',
    className: 'Bicho',
    badge: '🐛 Drenaje Vampírico',
    tagline: 'Robás 6 de vida al rival (se duplica a 12 con 4 columnas en mesa)',
    description: 'Al conectar tu ataque, le quitás 6 de vida al rival y te los curás vos. Si tenés 4 o más columnas en mesa, ¡el drenaje se duplica a 12 de vida!',
    tacticalTip: 'Tené en cuenta que las cartas Free Game apiladas no cuentan como columna nueva.',
    simulation: {
      title: 'Demostración: Drenaje de Vida',
      steps: [
        {
          label: 'Ataque con Sanguijuela',
          fieldCard: { syms: ['bug', 'reptile'], power: 'leech' },
          strikeText: '🩸 Drena 6 HP del rival a tu Axie',
          notes: 'Golpea y cura al mismo tiempo.',
        },
      ],
    },
  },

  bubble: {
    id: 'bubble',
    powerId: 'bubble',
    symbol: 'aquatic',
    name: 'Burbuja de Retorno',
    className: 'Pez',
    badge: '🐟 Apertura Estratégica',
    tagline: 'Tu pick del mercado abre tu próxima ronda garantizada',
    description: 'La carta que elijas del centro queda atrapada en una burbuja y abrirá obligatoriamente tu próxima ronda. Con varias burbujas, fusiona cartas en una carta gigante multisímbolo.',
    tacticalTip: 'Controlá qué símbolos vas a tener en la primera carta de la siguiente ronda.',
    simulation: {
      title: 'Demostración: Burbuja de Retorno',
      steps: [
        {
          label: 'Atrapás carta en burbuja',
          fieldCard: { syms: ['aquatic', 'bird'], power: 'bubble' },
          strikeText: '🫧 Carta atrapada para abrir la ronda que viene',
          notes: 'Garantiza una apertura sólida sin azar en el primer robo.',
        },
      ],
    },
  },

  steelskin: {
    id: 'steelskin',
    powerId: 'steelskin',
    symbol: 'reptile',
    name: 'Piel de Escamas',
    className: 'Reptil',
    badge: '🦎 Blindaje Antigolpe',
    tagline: 'Limita el próximo ataque rival a un máximo de 12 de daño',
    description: 'Establece un blindaje que topa el próximo golpe del rival a 12 de daño máximo. Cada carga adicional reduce el tope en -2 (12 ➔ 10 ➔ 8 con piso de 6).',
    tacticalTip: 'La mejor defensa contra combos colosales del rival.',
    simulation: {
      title: 'Demostración: Piel de Escamas',
      steps: [
        {
          label: 'Blindaje de Escamas activo',
          fieldCard: { syms: ['reptile', 'beast'], power: 'steelskin' },
          strikeText: '🛡️ Tope defensivo: máx. 12 de daño',
          notes: 'Cualquier ataque enemigo de 30 o 40 puntos chocará contra el tope de 12.',
        },
      ],
    },
  },
};

/**
 * Mapeo de poderes a demostrar según el nivel de aventura.
 * Los primeros 3 niveles enseñan los 7 primeros símbolos/poderes:
 * - N1: Fuerza, Maceta y Free Game (3)
 * - N2: Huevo y Caracol (2)
 * - N3: Pulpo y Veneno (2)
 * Total: 3 + 2 + 2 = 7 símbolos
 */
export const LEVEL_DEMO_POWERS = {
  1: ['strength', 'pot', 'freegame'],
  2: ['egg', 'snail'],
  3: ['octopus', 'poison'],
  4: ['brutal', 'leaf'],
  5: ['leech', 'feather'],
  6: ['bubble', 'steelskin'],
};

function getStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Comprueba si el usuario ya vio la demo de este nivel */
export function hasSeenPowerDemo(levelId) {
  try {
    return getStorage()?.getItem(`${DEMO_SEEN_KEY}${levelId}`) === 'true';
  } catch {
    return false;
  }
}

/** Guarda que el usuario ya vio la demo de este nivel */
export function setPowerDemoSeen(levelId, seen = true) {
  try {
    getStorage()?.setItem(`${DEMO_SEEN_KEY}${levelId}`, String(seen));
  } catch {
    // Silencioso
  }
}

/** Comprueba si el usuario configuró "no volver a mostrar" */
export function isDemoAutoShowDisabled(levelId) {
  try {
    return getStorage()?.getItem(`${DEMO_PREF_KEY}${levelId}`) === 'dismissed';
  } catch {
    return false;
  }
}

/** Configura la preferencia de "no volver a mostrar" */
export function setDemoAutoShowDisabled(levelId, disabled = true) {
  try {
    if (disabled) {
      getStorage()?.setItem(`${DEMO_PREF_KEY}${levelId}`, 'dismissed');
    } else {
      getStorage()?.removeItem(`${DEMO_PREF_KEY}${levelId}`);
    }
  } catch {
    // Silencioso
  }
}

/**
 * Determina si la demostración debe mostrarse automáticamente al arrancar el nivel.
 * Solo aplica a los primeros 3 niveles (los 7 símbolos) y si el usuario no la desactivó.
 */
export function shouldAutoShowDemo(levelId) {
  const num = Number(levelId);
  if (![1, 2, 3].includes(num)) return false;
  if (isDemoAutoShowDisabled(num)) return false;
  return !hasSeenPowerDemo(num);
}

/**
 * Genera el modal o tarjeta de demostración no invasiva.
 */
export function createPowerDemoController({
  levelId = 1,
  initialPower = null,
  onClose = null,
  container = null,
} = {}) {
  const levelNum = Number(levelId) || 1;
  const powerIds = LEVEL_DEMO_POWERS[levelNum] ?? ['strength', 'pot', 'freegame'];
  let currentPowerId = (initialPower && powerIds.includes(initialPower)) ? initialPower : powerIds[0];
  let currentStepIdx = 0;
  let animTimer = null;

  const targetContainer = container || (typeof document !== 'undefined' ? document.body : null);
  if (!targetContainer) return null;

  // Limpiar instancias previas si existen
  const existing = typeof document !== 'undefined' ? document.getElementById('power-demo-modal') : null;
  if (existing) existing.remove();

  const overlay = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (!overlay) return null;

  overlay.id = 'power-demo-modal';
  overlay.className = 'power-demo-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', `Demostración de poderes Nivel ${levelNum}`);

  function stopAnimation() {
    if (animTimer) {
      clearInterval(animTimer);
      animTimer = null;
    }
  }

  function startStepAnimation() {
    stopAnimation();
    const demo = POWER_DEMOS[currentPowerId];
    if (!demo?.simulation?.steps?.length) return;
    const stepsCount = demo.simulation.steps.length;
    if (stepsCount <= 1) return;

    animTimer = setInterval(() => {
      currentStepIdx = (currentStepIdx + 1) % stepsCount;
      paintSimStage();
    }, 2800);
  }

  function renderCardMini(fieldCard) {
    if (!fieldCard) return '';
    const symIcons = (fieldCard.syms || []).map((s) => crest(s, 'sm')).join('');
    const pIcon = fieldCard.power ? powerIcon(fieldCard.power, 'sm') : '';
    return `
      <div class="pdemo-sim-card">
        <div class="pdemo-card-syms">${symIcons}</div>
        ${pIcon ? `<div class="pdemo-card-power">${pIcon}</div>` : ''}
      </div>
    `;
  }

  function paintSimStage() {
    const stageEl = overlay.querySelector('#pdemo-sim-stage');
    if (!stageEl) return;
    const demo = POWER_DEMOS[currentPowerId];
    if (!demo?.simulation) return;

    const step = demo.simulation.steps[currentStepIdx] ?? demo.simulation.steps[0];
    const steps = demo.simulation.steps;

    const progressDots = steps.map((_, i) => `
      <button class="pdemo-dot ${i === currentStepIdx ? 'active' : ''}" data-step="${i}" type="button" aria-label="Paso ${i + 1}"></button>
    `).join('');

    stageEl.innerHTML = `
      <div class="pdemo-sim-header">
        <span class="pdemo-sim-title">⚡ ${demo.simulation.title}</span>
        <div class="pdemo-sim-step-badge">${step.label}</div>
      </div>

      <div class="pdemo-sim-arena">
        <div class="pdemo-sim-side left">
          <div class="pdemo-sim-axie user-side">
            <span class="pdemo-axie-tag">Tu Axie</span>
            ${step.attackerShield ? `<div class="pdemo-shield-badge">🛡️ Escudo: ${step.attackerShield}</div>` : ''}
            ${step.statusGain ? `<div class="pdemo-status-pill gain">${step.statusGain}</div>` : ''}
          </div>
          ${renderCardMini(step.fieldCard)}
        </div>

        <div class="pdemo-sim-center">
          ${step.strikeText ? `<div class="pdemo-strike-callout">${step.strikeText}</div>` : ''}
          ${step.healText ? `<div class="pdemo-heal-callout">${step.healText}</div>` : ''}
          ${step.totalDamage ? `
            <div class="pdemo-damage-calc">
              <span class="pdemo-calc-total">💥 ${step.totalDamage} Daño</span>
              ${step.baseDamage !== undefined && step.powerBonus ? `
                <span class="pdemo-calc-detail">(${step.baseDamage} base + ${step.powerBonus} poder)</span>
              ` : ''}
            </div>
          ` : ''}
        </div>

        <div class="pdemo-sim-side right">
          <div class="pdemo-sim-axie rival-side">
            <span class="pdemo-axie-tag">Rival</span>
            ${step.rivalPoison ? `<div class="pdemo-status-pill poison">🧪 Veneno: ${step.rivalPoison}</div>` : ''}
            ${step.rivalWeak ? `<div class="pdemo-status-pill weak">🐌 Debilidad</div>` : ''}
          </div>
        </div>
      </div>

      <div class="pdemo-sim-footer">
        <p class="pdemo-sim-notes">${step.notes}</p>
        <div class="pdemo-sim-controls">
          <div class="pdemo-dots">${progressDots}</div>
          <button class="pdemo-replay-btn" type="button" id="pdemo-replay">▶ Repetir animación</button>
        </div>
      </div>
    `;

    // Conectar botones de pasos
    stageEl.querySelectorAll('.pdemo-dot').forEach((btn) => {
      btn.onclick = () => {
        stopAnimation();
        currentStepIdx = Number(btn.dataset.step);
        paintSimStage();
      };
    });

    const replayBtn = stageEl.querySelector('#pdemo-replay');
    if (replayBtn) {
      replayBtn.onclick = () => {
        currentStepIdx = 0;
        paintSimStage();
        startStepAnimation();
      };
    }
  }

  function paint() {
    const demo = POWER_DEMOS[currentPowerId] ?? POWER_DEMOS.strength;

    const tabsHtml = powerIds.map((pId) => {
      const p = POWER_DEMOS[pId] ?? POWERS[pId];
      if (!p) return '';
      const active = pId === currentPowerId;
      const classCrest = p.symbol ? crest(p.symbol, 'sm') : '🃏';
      return `
        <button class="pdemo-tab ${active ? 'active' : ''}" data-power-tab="${pId}" type="button">
          <span class="pdemo-tab-icon">${powerIcon(pId, 'sm')}</span>
          <span class="pdemo-tab-name">${p.name}</span>
          <span class="pdemo-tab-crest">${classCrest}</span>
        </button>
      `;
    }).join('');

    const levelTitle = levelNum === 1
      ? 'Nivel 1: Primeros Pasos'
      : levelNum === 2
      ? 'Nivel 2: Defensa y Estrategia'
      : levelNum === 3
      ? 'Nivel 3: El Arte del Mercado'
      : `Nivel ${levelNum}`;

    overlay.innerHTML = `
      <div class="power-demo-card" id="power-demo-card">
        <div class="pdemo-header">
          <div class="pdemo-title-box">
            <span class="pdemo-level-tag">🎬 Demostración de Poderes · ${levelTitle}</span>
            <h2 class="pdemo-title">Cómo funcionan los nuevos poderes</h2>
            <p class="pdemo-subtitle">Descubrí las habilidades tácticas que se suman en este nivel para usarlas a tu favor.</p>
          </div>
          <button class="pdemo-close-btn" id="pdemo-close-x" title="Cerrar (Esc)" aria-label="Cerrar">✕</button>
        </div>

        <div class="pdemo-tabs-bar" role="tablist">
          ${tabsHtml}
        </div>

        <div class="pdemo-body">
          <div class="pdemo-power-profile">
            <div class="pdemo-icon-wrap">
              ${powerIcon(demo.powerId, 'lg')}
            </div>
            <div class="pdemo-details">
              <div class="pdemo-name-row">
                <h3 class="pdemo-power-name">${demo.name}</h3>
                <span class="pdemo-class-badge" style="--c:${SYMBOLS[demo.symbol]?.color ?? '#888'}">
                  ${demo.symbol ? `${crest(demo.symbol, 'sm')} ${demo.className}` : 'Neutral'}
                </span>
                <span class="pdemo-type-badge">${demo.badge}</span>
              </div>
              <p class="pdemo-tagline"><strong>${demo.tagline}</strong></p>
              <p class="pdemo-desc">${demo.description}</p>
              <div class="pdemo-tip-box">
                <span class="pdemo-tip-label">💡 Consejo Táctico:</span>
                <span class="pdemo-tip-text">${demo.tacticalTip}</span>
              </div>
            </div>
          </div>

          <div class="pdemo-sim-stage-box" id="pdemo-sim-stage"></div>
        </div>

        <div class="pdemo-footer">
          <label class="pdemo-pref-label">
            <input type="checkbox" id="pdemo-dont-show" ${isDemoAutoShowDisabled(levelNum) ? 'checked' : ''}>
            <span>No volver a mostrar al iniciar este nivel</span>
          </label>
          <div class="pdemo-actions">
            <button class="btn btn-primary pdemo-btn-play" id="pdemo-confirm-btn" type="button">
              ¡Entendido, a jugar! →
            </button>
          </div>
        </div>
      </div>
    `;

    paintSimStage();
    startStepAnimation();

    // Eventos de pestañas
    overlay.querySelectorAll('[data-power-tab]').forEach((tabBtn) => {
      tabBtn.onclick = () => {
        const targetPower = tabBtn.dataset.powerTab;
        if (targetPower && targetPower !== currentPowerId) {
          currentPowerId = targetPower;
          currentStepIdx = 0;
          paint();
        }
      };
    });

    // Cerrar
    const handleClose = () => {
      const dontShowCheck = overlay.querySelector('#pdemo-dont-show');
      if (dontShowCheck?.checked) {
        setDemoAutoShowDisabled(levelNum, true);
      }
      setPowerDemoSeen(levelNum, true);
      stopAnimation();
      overlay.classList.remove('is-open');
      setTimeout(() => overlay.remove(), 200);
      if (typeof onClose === 'function') onClose();
    };

    const closeBtn = overlay.querySelector('#pdemo-close-x');
    if (closeBtn) closeBtn.onclick = handleClose;

    const confirmBtn = overlay.querySelector('#pdemo-confirm-btn');
    if (confirmBtn) confirmBtn.onclick = handleClose;

    // Clic fuera para cerrar sin fricción (no invasivo)
    overlay.onclick = (e) => {
      if (e.target === overlay) handleClose();
    };
  }

  // Tecla Escape para cerrar
  const keyHandler = (e) => {
    if (e.key === 'Escape') {
      overlay.querySelector('#pdemo-close-x')?.click();
      if (typeof window !== 'undefined') window.removeEventListener('keydown', keyHandler);
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', keyHandler);
  }

  targetContainer.appendChild(overlay);
  paint();
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => overlay.classList.add('is-open'));
  } else {
    overlay.classList.add('is-open');
  }

  return {
    destroy() {
      stopAnimation();
      if (typeof window !== 'undefined') window.removeEventListener('keydown', keyHandler);
      overlay.remove();
    },
    switchPower(powerId) {
      if (powerIds.includes(powerId)) {
        currentPowerId = powerId;
        currentStepIdx = 0;
        paint();
      }
    },
    element: overlay,
  };
}

