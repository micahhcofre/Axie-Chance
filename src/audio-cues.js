// Qué suena en cada momento de la partida.
//
// El juego no avisa nada: `game.js` publica el estado entero cada vez que algo cambia
// y el que mira decide qué pasó. La pantalla ya trabaja así —el sacudón sale de
// comparar `lastHit` con el último que animó—, y el sonido hace lo mismo con todo lo
// demás: se guarda una foto del estado y en el repintado siguiente se comparan. Un
// huevo que subió es un huevo que se acaba de poner; una carta más en la cadena es una
// carta que se acaba de robar.
//
// La ventaja de leer el estado en vez de que el juego avise es que las reglas siguen
// sin saber que existe el audio: se le puede sacar entero y no falta nada.
//
// Lo único que no se deduce acá es el golpe, porque no se oye cuando el estado cambia
// sino cuando el efecto llega —hasta 700 ms después—: eso lo larga `playHit`, que es
// quien sabe de ese instante.
import { PLAYERS, TARGET, hpOf, ownedBy } from './game.js';
import { hitDelay } from './vfx.js';

/**
 * Cuánto más agudo suena el tic por cada carta que se suma a la cadena, y hasta dónde.
 * La cadena más larga que se vio en el banco de pruebas tiene 8 cartas; a 6% por carta
 * eso es una quinta justa de diferencia entre la primera y la última. Es la tensión de
 * la tirada dicha con el oído: mientras sube, la cosa va bien.
 */
const STEP = 0.06;
const TOP_RATE = 1.55;

/**
 * El tono que le toca a una cadena de `len` eslabones, en esa misma escalera.
 *
 * Se exporta porque no es solo del tic: cualquier cosa que quiera decir "la cadena
 * está así de larga" tiene que sonar en el mismo idioma, o son dos escaleras distintas
 * y ninguna se aprende. La usa el impacto del Rocket Stamp al fusionarse (ver
 * `fallOnto` en `ui.js`), que es el otro momento en que una cadena crece.
 */
export const chainRate = (len) => Math.min(1 + STEP * Math.max(0, len - 1), TOP_RATE);

/** Con menos de esto de vida, el combate cambia de música. */
const LOW_HP = 0.3;

// Los poderes no suenan acá: cada uno tiene su animación y suena con ella, cuando su
// amuleto llega (ver `power-fx.js`). Sonando también acá se oirían dos veces, y la
// primera antes de verse.

/** El estado de un jugador, reducido a lo que puede hacer ruido. */
function snapPlayer(state, player) {
  const chain = state.chains[player];
  const st = state.status[player];
  return {
    cards: chain.cards.length + (chain.bustCard ? 1 : 0),
    busted: chain.busted,
    egg: st.egg,
    eggBreak: st.eggBreak,
    // Todas sus cartas. Se cuenta con `ownedBy` y no con el mazo pelado porque el
    // mazo sube solo al cerrar el turno, cuando la cadena vuelve adentro, y eso no es
    // haber agarrado nada: `ownedBy` incluye lo que está en la mesa, así que la
    // devolución no lo mueve y solo crece con lo que entra del centro.
    owned: ownedBy(state, player),
    renewed: Boolean(state.draft?.renewed[player]),
  };
}

const snapshot = (state) => ({
  round: state.round,
  phase: state.phase,
  hitId: state.hitId,
  p1: snapPlayer(state, 'p1'),
  p2: snapPlayer(state, 'p2'),
});

/**
 * El que escucha la partida. `watch` se llama en cada repintado con el estado nuevo;
 * la primera vez —y cada vez que arranca una partida— solo toma la foto.
 */
export function createCues(audio) {
  let last = null;

  function watch(state) {
    if (!state) return;
    const before = last;
    last = snapshot(state);
    // Partida nueva: el estado es otro y comparar contra el anterior daría cualquier
    // cosa —una cadena de 5 cartas que "vuelve" a 1, la vida entera de golpe—.
    if (!before || state.round < before.round || state.hitId < before.hitId) return music(state, null);

    // Si en este repintado se soltó un ataque, todo lo que venga con él tiene que
    // esperar a que el golpe llegue: el estado cambia al soltarlo, pero el impacto se
    // ve y se oye hasta 700 ms más tarde.
    const swung = state.hitId !== before.hitId && state.lastHit;
    const impact = swung
      ? hitDelay(state.lastHit.amount === 0 ? 'bust' : state.symbols[state.lastHit.by])
      : 0;

    for (const player of PLAYERS) {
      const now = last[player];
      const was = before[player];

      // Cada carta que sale, un tono más arriba que la anterior — y la que corta la
      // cadena, un golpe seco en su lugar.
      //
      // Suena **acá**, en el momento en que la carta cae, y no con la animación de
      // desarme que llega 700 ms después: lo que el jugador tiene que oír es que su
      // carta no enganchó, y eso pasa cuando la ve. Puesto con la animación llegaba
      // tarde, y para entonces ya había leído en la pantalla que se le había cortado.
      if (now.cards > was.cards) {
        if (now.busted) audio.sfx('bust');
        else audio.sfx('draw', { rate: chainRate(now.cards) });
      }

      // El escudo que se gasta del todo devuelve la cáscara, justo después del golpe,
      // si había huevos cargándola: el escudo de la máscara solo no devuelve nada.
      if (was.egg > 0 && now.egg === 0 && was.eggBreak > 0 && now.eggBreak === 0) {
        audio.sfx('thorns', { delay: impact + 200 });
      }

      // Una carta más en el mazo es una carta que se llevó del centro.
      if (now.owned > was.owned) audio.sfx('take');
      if (now.renewed && !was.renewed) audio.sfx('renew');
    }

    if (state.phase === 'draft' && before.phase !== 'draft') audio.sfx('open');

    // El remate del final no sale de acá: lo larga la pantalla del final (ver
    // `result.js`), que sabe cuándo aparece y hace coincidir el pico con su efecto.

    music(state, before);
  }

  /**
   * El tema que corresponde. Se pide en cada repintado y el mezclador ignora lo que
   * ya está sonando, así que acá solo hay que decir en qué situación estamos: alguien
   * con la vida corta cambia el tema, y el final lo apaga —el remate suena solo—.
   */
  function music(state, before) {
    // El final apaga el combate una sola vez, al llegar: el remate suena solo y después
    // la pantalla del final pone la música de la portada (ver `RESULT_MUSIC` en
    // `result.js`). Pedir silencio en cada repintado la volvería a cortar.
    if (state.phase === 'matchEnd') {
      if (before?.phase !== 'matchEnd') audio.music(null);
      return;
    }
    const low = PLAYERS.some((p) => hpOf(state, p) <= TARGET * LOW_HP);
    audio.music(low ? 'boss' : 'battle');
  }

  // Los botones no suenan por tocarlos. Lo tuvieron un tiempo —un toque seco, la
  // misma carta más arriba y más corta— y era un sonido de más: los botones que
  // importan ya suenan por lo que hacen, y el de robar quedaba con dos cosas encima,
  // el toque y el tic. Lo que se oye al robar tiene que ser el tic y nada más, que es
  // el que va contando cómo crece la cadena.
  /** Olvida la foto: la próxima partida que se mire es otra mesa (ver `swap` en `ui.js`). */
  function reset() {
    last = null;
  }

  return { watch, reset };
}
