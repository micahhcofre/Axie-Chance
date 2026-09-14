// Modo Aventura: progresión con niveles (cada batalla es un nivel).
// Los 12 poderes de clase se van desbloqueando de a 2 por nivel hasta completar
// todos los disponibles en el juego. Diseñado de forma modular para expandirse con
// futuras mecánicas (jefes, recompensas, modificadores, etc.).

export const ADVENTURE_KEY = 'axie-chance:adventure';

/**
 * Configuración de niveles de la campaña inicial:
 * - 6 niveles en total.
 * - Cada nivel incorpora exactamente 2 nuevos poderes de clase al mercado.
 * - Cada clase tiene como máximo un único poder activo a la vez (por ejemplo,
 *   en Planta es Maceta u Hoja, nunca ambos). Los nuevos poderes sustituyen
 *   al anterior de su misma clase al desbloquearse.
 */
export const ADVENTURE_LEVELS = [
  {
    id: 1,
    name: 'Nivel 1: Primeros Pasos',
    description: 'Aprende los fundamentos del combate, aprovecha la fuerza y la curación, y usá el comodín apilable Free Game.',
    rival: 'plant', // Brote
    difficulty: 'facil',
    newPowers: ['strength', 'pot'],
    activePowers: ['strength', 'pot'],
  },
  {
    id: 2,
    name: 'Nivel 2: Defensa y Estrategia',
    description: 'El combate se intensifica. Protegete con cáscaras de huevo y ralentiza al rival con baba de caracol.',
    rival: 'bird', // Racha
    difficulty: 'facil',
    newPowers: ['egg', 'snail'],
    activePowers: ['strength', 'pot', 'egg', 'snail'],
  },
  {
    id: 3,
    name: 'Nivel 3: El Arte del Mercado',
    description: 'Los 6 poderes clásicos se completan. Reclama cartas extra con el pulpo e inocula veneno mortal.',
    rival: 'aquatic', // Marea
    difficulty: 'normal',
    newPowers: ['octopus', 'poison'],
    activePowers: ['strength', 'pot', 'egg', 'snail', 'octopus', 'poison'],
  },
  {
    id: 4,
    name: 'Nivel 4: Furia de la Naturaleza',
    description: 'Desata el poder de la garra brutal acumulando bestias y sana progresivamente con hojas de regeneración.',
    rival: 'beast', // Colmillo
    difficulty: 'normal',
    newPowers: ['brutal', 'leaf'],
    activePowers: ['brutal', 'leaf', 'egg', 'snail', 'octopus', 'poison'],
  },
  {
    id: 5,
    name: 'Nivel 5: Sombras y Vuelo',
    description: 'Golpes directos desde el aire con plumas sagradas y drenaje voraz de vida con sanguijuela.',
    rival: 'bug', // Aguijón
    difficulty: 'duro',
    newPowers: ['leech', 'feather'],
    activePowers: ['brutal', 'leaf', 'feather', 'leech', 'octopus', 'poison'],
  },
  {
    id: 6,
    name: 'Nivel 6: Duelo de Maestros',
    description: 'El desafío definitivo: los 6 poderes avanzados en juego con burbujas estratégicas y piel de escamas impenetrable.',
    rival: 'reptile', // Escama
    difficulty: 'duro',
    newPowers: ['bubble', 'steelskin'],
    activePowers: [
      'brutal', 'leaf', 'feather', 'leech', 'bubble', 'steelskin',
    ],
  },
];

function store() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Lee el progreso del modo aventura guardado en el navegador.
 * @returns {{ unlockedLevel: number, completedLevels: number[] }}
 */
export function getAdventureProgress() {
  try {
    const raw = store()?.getItem(ADVENTURE_KEY);
    if (!raw) return { unlockedLevel: 1, completedLevels: [] };
    const parsed = JSON.parse(raw);
    const unlocked = typeof parsed.unlockedLevel === 'number'
      ? Math.max(1, Math.min(ADVENTURE_LEVELS.length, parsed.unlockedLevel))
      : 1;
    const completed = Array.isArray(parsed.completedLevels)
      ? parsed.completedLevels.filter(
          (n) => typeof n === 'number' && n >= 1 && n <= ADVENTURE_LEVELS.length,
        )
      : [];
    return { unlockedLevel: unlocked, completedLevels: completed };
  } catch {
    return { unlockedLevel: 1, completedLevels: [] };
  }
}

/**
 * Guarda el progreso en localStorage.
 */
export function saveAdventureProgress(progress) {
  try {
    store()?.setItem(ADVENTURE_KEY, JSON.stringify(progress));
  } catch {
    // Ignorar si el almacenamiento no está disponible
  }
}

/**
 * Comprueba si un nivel está disponible para jugar.
 */
export function isLevelUnlocked(levelId) {
  const { unlockedLevel } = getAdventureProgress();
  return levelId <= unlockedLevel;
}

/**
 * Marca un nivel como completado y desbloquea el siguiente si corresponde.
 * @param {number} levelId
 * @returns {{ unlockedLevel: number, completedLevels: number[] }}
 */
export function markLevelCompleted(levelId) {
  const current = getAdventureProgress();
  const completed = Array.from(new Set([...current.completedLevels, levelId]));
  let nextUnlocked = current.unlockedLevel;
  if (levelId >= current.unlockedLevel && levelId < ADVENTURE_LEVELS.length) {
    nextUnlocked = levelId + 1;
  }
  const updated = { unlockedLevel: nextUnlocked, completedLevels: completed };
  saveAdventureProgress(updated);
  return updated;
}

/**
 * Reinicia el progreso al nivel 1 inicial.
 */
export function resetAdventureProgress() {
  const initial = { unlockedLevel: 1, completedLevels: [] };
  saveAdventureProgress(initial);
  return initial;
}

/**
 * Obtiene la configuración de un nivel por su ID.
 * @param {number|string} id
 */
export function getAdventureLevel(id) {
  const num = Number(id);
  return ADVENTURE_LEVELS.find((l) => l.id === num) ?? ADVENTURE_LEVELS[0];
}

