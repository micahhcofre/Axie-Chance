// Modo Aventura: progresión con niveles (cada batalla es un nivel).
// Los poderes de clase se van desbloqueando de forma modular según la campaña
// definida en `src/adventure-levels.js`. Cada clase tiene como máximo un único
// poder activo a la vez; los nuevos poderes sustituyen al anterior de su misma
// clase respetando el orden de la reserva de cartas.

import { store } from './loadout.js';
import { POWERS } from './data.js';
import { STARTERS } from './axies.js';
import { ADVENTURE_CAMPAIGN } from './adventure-levels.js';
import { tr } from './i18n.js';

export const ADVENTURE_KEY = 'axie-chance:adventure';

/** Etiquetas legibles de dificultad para la UI y la ficha del nivel. */
export const DIFFICULTY_LABELS = {
  facil: tr('Fácil'),
  normal: tr('Normal'),
  duro: tr('Dura'),
};

/**
 * Valida una campaña y deriva las propiedades calculadas de cada nivel:
 * - `id`: posición 1-based en el array.
 * - `activePowers`: acumulación con sustitución por clase en el mismo índice,
 *   manteniendo el orden del pool. Soporta override explícito `activePowers` por nivel.
 *
 * Si algún campo es inválido (poder inexistente, rival inexistente, dificultad
 * desconocida o duplicación de clase activa), lanza un Error descriptivo en español.
 *
 * @param {Array<object>} campaign
 * @returns {Array<object>}
 */
export function buildAdventureLevels(campaign = ADVENTURE_CAMPAIGN) {
  if (!Array.isArray(campaign)) {
    throw new Error('La campaña de aventura debe ser un array de niveles.');
  }

  const validDifficulties = new Set(['facil', 'normal', 'duro']);
  let accumulatedPowers = [];

  return campaign.map((rawLevel, index) => {
    const id = index + 1;
    if (!rawLevel || typeof rawLevel !== 'object') {
      throw new Error(`Nivel ${id}: la definición del nivel debe ser un objeto.`);
    }

    const {
      name, description, rival, difficulty, newPowers,
      showcase, activePowers: explicitActive,
    } = rawLevel;

    if (!name || typeof name !== 'string') {
      throw new Error(`Nivel ${id}: nombre inválido o ausente.`);
    }
    if (!description || typeof description !== 'string') {
      throw new Error(`Nivel ${id} ("${name}"): descripción inválida o ausente.`);
    }
    if (!validDifficulties.has(difficulty)) {
      throw new Error(`Nivel ${id} ("${name}"): dificultad inválida "${difficulty}". Debe ser "facil", "normal" o "duro".`);
    }
    if (!rival || !STARTERS[rival]) {
      throw new Error(`Nivel ${id} ("${name}"): rival inexistente "${rival}". Debe ser un id de STARTERS.`);
    }
    if (!Array.isArray(newPowers)) {
      throw new Error(`Nivel ${id} ("${name}"): newPowers debe ser un array.`);
    }

    // Validar poderes nuevos del nivel
    const newClasses = new Set();
    for (const p of newPowers) {
      const def = POWERS[p];
      if (!def) {
        throw new Error(`Nivel ${id} ("${name}"): poder inexistente "${p}" en newPowers.`);
      }
      if (def.symbol) {
        if (newClasses.has(def.symbol)) {
          throw new Error(`Nivel ${id} ("${name}"): dos poderes de la misma clase "${def.symbol}" en newPowers.`);
        }
        newClasses.add(def.symbol);
      }
    }

    // Validar showcase opcional
    if (showcase !== undefined) {
      if (!Array.isArray(showcase)) {
        throw new Error(`Nivel ${id} ("${name}"): showcase debe ser un array.`);
      }
      for (const p of showcase) {
        if (!POWERS[p]) {
          throw new Error(`Nivel ${id} ("${name}"): poder o especial inexistente "${p}" en showcase.`);
        }
      }
    }

    // Derivación de activePowers:
    // Si viene un override explícito se respeta tal cual; de lo contrario, se acumulan
    // los nuevos poderes reemplazando al de la misma clase en su misma posición.
    let levelActive;
    if (Array.isArray(explicitActive)) {
      levelActive = [...explicitActive];
      accumulatedPowers = [...explicitActive];
    } else {
      const nextAcc = [...accumulatedPowers];
      for (const p of newPowers) {
        const sym = POWERS[p]?.symbol;
        if (!sym) {
          if (!nextAcc.includes(p)) nextAcc.push(p);
          continue;
        }
        const existingIdx = nextAcc.findIndex((cur) => POWERS[cur]?.symbol === sym);
        if (existingIdx !== -1) {
          nextAcc[existingIdx] = p;
        } else {
          nextAcc.push(p);
        }
      }
      accumulatedPowers = nextAcc;
      levelActive = [...accumulatedPowers];
    }

    // Validar que en los poderes activos finales no convivan dos de la misma clase
    const activeClasses = new Set();
    for (const p of levelActive) {
      const def = POWERS[p];
      if (!def) {
        throw new Error(`Nivel ${id} ("${name}"): poder inexistente "${p}" en activePowers.`);
      }
      if (def.symbol) {
        if (activeClasses.has(def.symbol)) {
          throw new Error(`Nivel ${id} ("${name}"): dos poderes activos de la misma clase "${def.symbol}".`);
        }
        activeClasses.add(def.symbol);
      }
    }

    return {
      ...rawLevel,
      id,
      activePowers: levelActive,
      ...(showcase ? { showcase } : {}),
    };
  });
}

/** Configuración de niveles de la campaña con ids y activePowers ya derivados. */
export const ADVENTURE_LEVELS = buildAdventureLevels(ADVENTURE_CAMPAIGN);

/**
 * Comprueba si un nivel es el último de la campaña.
 * @param {number|string} id
 * @returns {boolean}
 */
export function isFinalLevel(id) {
  const num = Number(id);
  if (!Number.isFinite(num) || ADVENTURE_LEVELS.length === 0) return false;
  return num >= ADVENTURE_LEVELS[ADVENTURE_LEVELS.length - 1].id;
}

/**
 * Devuelve el ID del siguiente nivel en la campaña, o null si es el último o no existe.
 * @param {number|string} id
 * @returns {number|null}
 */
export function nextLevelId(id) {
  const num = Number(id);
  const idx = ADVENTURE_LEVELS.findIndex((lvl) => lvl.id === num);
  if (idx === -1 || idx >= ADVENTURE_LEVELS.length - 1) return null;
  return ADVENTURE_LEVELS[idx + 1].id;
}

/**
 * Lee el progreso del modo aventura guardado en el navegador.
 * Soporta compatibilidad hacia adelante: si se agregan niveles a la campaña
 * y el jugador ya completó el nivel anterior, el nuevo nivel se desbloquea.
 *
 * @returns {{ unlockedLevel: number, completedLevels: number[] }}
 */
export function getAdventureProgress() {
  try {
    const raw = store()?.getItem(ADVENTURE_KEY);
    if (!raw) return { unlockedLevel: 1, completedLevels: [] };
    const parsed = JSON.parse(raw);
    const completed = Array.isArray(parsed.completedLevels)
      ? parsed.completedLevels.filter(
          (n) => typeof n === 'number' && n >= 1 && n <= ADVENTURE_LEVELS.length,
        )
      : [];
    let unlocked = typeof parsed.unlockedLevel === 'number'
      ? Math.max(1, Math.min(ADVENTURE_LEVELS.length, parsed.unlockedLevel))
      : 1;

    // Si el nivel completado más alto permite avanzar a un nivel nuevo de la campaña
    // (por ejemplo, si se agregó un nivel 7 y el jugador ya tenía el 6 completado),
    // desbloquear el siguiente automáticamente.
    for (let lvl = 1; lvl < ADVENTURE_LEVELS.length; lvl++) {
      if (completed.includes(lvl) && unlocked <= lvl) {
        unlocked = lvl + 1;
      }
    }

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
  return Number(levelId) <= unlockedLevel;
}

/**
 * Marca un nivel como completado y desbloquea el siguiente si corresponde.
 * @param {number|string} levelId
 * @returns {{ unlockedLevel: number, completedLevels: number[] }}
 */
export function markLevelCompleted(levelId) {
  const current = getAdventureProgress();
  const numId = Number(levelId);
  const completed = Array.from(new Set([...current.completedLevels, numId]));
  let nextUnlocked = current.unlockedLevel;
  const next = nextLevelId(numId);
  if (next !== null && numId >= current.unlockedLevel) {
    nextUnlocked = next;
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
