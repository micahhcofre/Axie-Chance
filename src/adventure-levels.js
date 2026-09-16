// Campaña del Modo Aventura: definición declarativa de niveles.
//
// Para agregar un nivel nuevo a la campaña:
// 1. Agregá un nuevo objeto al final del array ADVENTURE_CAMPAIGN.
// 2. Definí solo los campos propios del nivel:
//    - `name` (string): Nombre visible en la ficha y en la pantalla final.
//    - `description` (string): Texto descriptivo del combate y los poderes en juego.
//    - `rival` (string): ID del rival en `STARTERS` de `src/axies.js` (olek, momo, puffy, buba, pomodoro, venoki).
//    - `difficulty` (string): 'facil' | 'normal' | 'duro'.
//    - `newPowers` (string[]): IDs de los nuevos poderes de `POWERS` en `src/data.js` introducidos en este nivel.
//    - `showcase` (string[], opcional): Poderes o cartas especiales extra para destacar en la ficha del lobby (ej: ['freegame']).
//    - `activePowers` (string[], opcional): Sobrescribe la derivación automática si el nivel requiere un set especial de poderes.
//
// Los campos `id` (1-based según la posición) y `activePowers` (acumulación con
// sustitución por clase) se derivan automáticamente en `src/adventure.js`.

import { tr } from './i18n.js';

export const ADVENTURE_CAMPAIGN = [
  {
    name: tr('Nivel 1: Primeros Pasos'),
    description: tr('Aprende los fundamentos del combate, aprovecha la fuerza y la curación, y usá el comodín apilable Free Game.'),
    rival: 'olek', // starter de Planta
    difficulty: 'facil',
    newPowers: ['strength', 'pot'],
    showcase: ['freegame'],
  },
  {
    name: tr('Nivel 2: Defensa y Estrategia'),
    description: tr('El combate se intensifica. Protegete con cáscaras de huevo y ralentiza al rival con baba de caracol.'),
    rival: 'momo', // starter de Pájaro
    difficulty: 'facil',
    newPowers: ['egg', 'snail'],
  },
  {
    name: tr('Nivel 3: El Arte del Mercado'),
    description: tr('Los 6 poderes clásicos se completan. Reclama cartas extra con el pulpo e inocula veneno mortal.'),
    rival: 'puffy', // starter de Pez
    difficulty: 'normal',
    newPowers: ['octopus', 'poison'],
  },
  {
    name: tr('Nivel 4: Furia de la Naturaleza'),
    description: tr('Desata el poder de la garra brutal acumulando bestias y sana progresivamente con hojas de regeneración.'),
    rival: 'buba', // starter de Bestia
    difficulty: 'normal',
    newPowers: ['brutal', 'leaf'],
  },
  {
    name: tr('Nivel 5: Sombras y Vuelo'),
    description: tr('Golpes directos desde el aire con plumas sagradas y drenaje voraz de vida con sanguijuela.'),
    rival: 'pomodoro', // starter de Bicho
    difficulty: 'duro',
    newPowers: ['leech', 'feather'],
  },
  {
    name: tr('Nivel 6: Duelo de Maestros'),
    description: tr('El desafío definitivo: los 6 poderes avanzados en juego con burbujas estratégicas y piel de escamas impenetrable.'),
    rival: 'venoki', // starter de Reptil
    difficulty: 'duro',
    newPowers: ['bubble', 'steelskin'],
  },
];
