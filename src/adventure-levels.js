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
    description: tr('Aprendé lo básico: sumá fuerza, curate con la maceta y montá cartas con Free Game. Si te dejan en 0, te queda un último golpe, pero ahí ya no te podés curar.'),
    rival: 'olek', // starter de Planta
    difficulty: 'facil',
    newPowers: ['strength', 'pot'],
    showcase: ['freegame'],
  },
  {
    name: tr('Nivel 2: Defensa y Estrategia'),
    description: tr('El combate se intensifica. Juntá escudo con el Secret Egg (cada huevo suma el suyo y su cáscara) y partí al medio el golpe rival con el Lazy Snail.'),
    rival: 'momo', // starter de Pájaro
    difficulty: 'facil',
    newPowers: ['egg', 'snail'],
  },
  {
    name: tr('Nivel 3: El Arte del Mercado'),
    description: tr('Los 6 poderes clásicos se completan. Llevate cartas extra con el Sticky Octopus y envenená con el Poison Vial: 6 por frasco, y muerde a través del escudo.'),
    rival: 'puffy', // starter de Pez
    difficulty: 'normal',
    newPowers: ['octopus', 'poison'],
  },
  {
    name: tr('Nivel 4: Furia de la Naturaleza'),
    description: tr('Rachas largas y cura lenta: la Energy Drink suma +3 por cada símbolo de tu mejor racha, y el Spring Leaf te cura al empezar cada turno.'),
    rival: 'buba', // starter de Bestia
    difficulty: 'normal',
    newPowers: ['brutal', 'leaf'],
  },
  {
    name: tr('Nivel 5: Sombras y Vuelo'),
    description: tr('Daño que no se puede frenar: el Feather Earring pega apenas sale del mazo y la Mantis Dagger le roba vida al rival.'),
    rival: 'pomodoro', // starter de Bicho
    difficulty: 'duro',
    newPowers: ['leech', 'feather'],
  },
  {
    name: tr('Nivel 6: Duelo de Maestros'),
    description: tr('El desafío final: Bubble Paste elige tu apertura y la Gecko Mask suma escudo y topea el golpe que te llega. Cuidado con el overkill: si te pegan más de 30 pasado el cero, no hay última chance.'),
    rival: 'venoki', // starter de Reptil
    difficulty: 'duro',
    newPowers: ['bubble', 'steelskin'],
  },
];
