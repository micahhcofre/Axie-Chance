// El perfil del jugador: su nivel y cuánto le falta para el que sigue.
//
// La experiencia sale del progreso de la Aventura, que ya está guardado
// (`axie-chance:adventure`): cada nivel superado da `PROFILE_XP.level` y cada estrella
// (ganado por K.O.) suma `PROFILE_XP.star`. Así el perfil no guarda nada propio ni se
// desfasa del mapa: volver a ganar un nivel no da experiencia dos veces. Cada nivel del
// perfil pide un poco más que el anterior (`profileNeed`).
//
// Es puro: sin DOM ni almacenamiento. La barra de arriba del mapa lo pinta (ver
// `paintProfile` en `lobby.js`).

/** La experiencia que da cada cosa del progreso. */
export const PROFILE_XP = { level: 100, star: 50 };

/** La experiencia que pide pasar del nivel `level` al siguiente. */
export const profileNeed = (level) => 100 + 50 * (level - 1);

/**
 * El perfil a partir del progreso de la Aventura: la experiencia total (`xp`), el nivel
 * (`level`, desde 1), lo juntado dentro de ese nivel (`into`), lo que pide (`need`) y la
 * fracción de la barra (`frac`, de 0 a 1).
 * @param {{ completedLevels?: number[], starredLevels?: number[] }} progress
 */
export function profileOf(progress = {}) {
  const won = new Set(progress.completedLevels ?? []).size;
  const stars = new Set(progress.starredLevels ?? []).size;
  const xp = won * PROFILE_XP.level + stars * PROFILE_XP.star;
  let level = 1;
  let into = xp;
  while (into >= profileNeed(level)) {
    into -= profileNeed(level);
    level += 1;
  }
  const need = profileNeed(level);
  return { xp, level, into, need, frac: into / need };
}
