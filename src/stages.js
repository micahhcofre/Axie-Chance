/**
 * Los escenarios de pelea.
 *
 * Hasta acá la mesa se paraba sobre el fondo de la clase del que jugaba, y esos fondos
 * son los de los menús del kit: un paisaje sin piso donde pararse, siempre el mismo
 * con el mismo Axie. Los escenarios son los de las batallas de eventos del Origins
 * Asset Kit —la plaza con los slimes mirando, el coliseo con las gradas llenas, la
 * playa con los barcos piratas—: tienen piso, tienen público y cambian de una partida
 * a la otra. Los fondos de clase siguen siendo los de la portada y la sala.
 *
 * Módulo puro: la partida guarda el nombre del escenario en su estado (así en red las
 * dos pantallas ven el mismo) y el dibujo, el marco y el aire los pone la pantalla
 * (`styles.css`, con `data-stage`, y `scenery.js`).
 *
 * `air` es lo que flota en el aire de cada uno (ver `AIR` en `scenery.js`).
 */
export const STAGES = Object.freeze({
  plaza: { air: 'petals' },
  coliseo: { air: 'dust' },
  pirata: { air: 'spray' },
  playa: { air: 'spray' },
  nevada: { air: 'snow' },
  otono: { air: 'leaves' },
  guarida: { air: 'embers' },
  // Los de los capítulos 6 a 20 de la Aventura: más batallas de eventos del kit (el bosque
  // de otoño, la playa de las pelotas, el salón de Navidad, el desierto de la tienda), los
  // fondos de clase que antes eran solo de la portada y los de Dusk, Mech y Dawn.
  bosque: { air: 'leaves' },
  jungla: { air: 'petals' },
  laguna: { air: 'spray' },
  isla: { air: 'spray' },
  meseta: { air: 'dust' },
  canon: { air: 'dust' },
  cielo: { air: 'petals' },
  caverna: { air: 'embers' },
  desierto: { air: 'dust' },
  ocaso: { air: 'embers' },
  nocturno: { air: 'fireflies' },
  navidad: { air: 'snow' },
  engranajes: { air: 'embers' },
  violeta: { air: 'fireflies' },
  amanecer: { air: 'petals' },
});

export const STAGE_IDS = Object.freeze(Object.keys(STAGES));

/** El del tutorial: la plaza, que es el lugar más amable para aprender. */
export const TUTORIAL_STAGE = 'plaza';

/** Si `id` es un escenario conocido. Lo que llega de otro navegador pasa por acá. */
export const isStage = (id) => typeof id === 'string' && Object.hasOwn(STAGES, id);

/** Un escenario al azar. */
export function pickStage(rng = Math.random) {
  return STAGE_IDS[Math.floor(rng() * STAGE_IDS.length) % STAGE_IDS.length];
}
