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
import { PLAYERS, TARGET, TUNING, hpOf, matchResult, ownedBy } from './game.js';
import { hitDelay } from './vfx.js';

/**
 * Cuánto más agudo suena el tic por cada carta que se suma a la cadena, y hasta dónde.
 * La cadena más larga que se vio en el banco de pruebas tiene 8 cartas; a 6% por carta
 * eso es una quinta justa de diferencia entre la primera y la última. Es la tensión de
 * la tirada dicha con el oído: mientras sube, la cosa va bien.
 */
const STEP = 0.06;
const TOP_RATE = 1.55;

/** Con menos de esto de vida, el combate cambia de música. */
const LOW_HP = 0.3;

/**
 * Los poderes se aplican en el mismo instante en que se suelta el ataque, o sea todos
 * juntos y antes de que el golpe llegue a verse. Sonando así serían un acorde: se
 * espera a que pase el impacto y salen de a uno.
 */
const AFTER_HIT = 300;
const APART = 260;

/** El estado de un jugador, reducido a lo que puede hacer ruido. */
function snapPlayer(state, player) {
  const chain = state.chains[player];
  const st = state.status[player];
  return {
    cards: chain.cards.length + (chain.bustCard ? 1 : 0),
    busted: chain.busted,
    egg: st.egg,
    poison: st.poison,
    weak: st.weak,
    strength: st.strength,
    stacked: st.stacked,
    healed: state.healed[player],
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
 *
 * `seat` es el asiento de esta pantalla, que hace falta para una sola cosa: el remate
 * del final. En una sala la misma partida suena en dos aparatos y el que ganó no es el
 * mismo para los dos. Sin asiento —contra la CPU— el que escucha es `p1`.
 */
export function createCues(audio, { seat = null } = {}) {
  let last = null;

  function watch(state) {
    if (!state) return;
    const before = last;
    last = snapshot(state);
    // Partida nueva: el estado es otro y comparar contra el anterior daría cualquier
    // cosa —una cadena de 5 cartas que "vuelve" a 1, la vida entera de golpe—.
    if (!before || state.round < before.round || state.hitId < before.hitId) return music(state);

    // Si en este repintado se soltó un ataque, todo lo que venga con él tiene que
    // esperar a que el golpe llegue: el estado cambia al soltarlo, pero el impacto se
    // ve y se oye hasta 700 ms más tarde.
    const swung = state.hitId !== before.hitId && state.lastHit;
    const impact = swung
      ? hitDelay(state.lastHit.amount === 0 ? 'bust' : state.symbols[state.lastHit.by])
      : 0;
    // Los poderes de los dos lados van a una misma fila: el ataque le pone cosas
    // encima al que pega y al que recibe, y contando cada uno por su cuenta el suyo,
    // los dos saldrían en el mismo instante.
    const powers = [];

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
        else audio.sfx('draw', { rate: Math.min(1 + STEP * (now.cards - 1), TOP_RATE) });
      }

      // El huevo que se gasta del todo devuelve la cáscara, justo después del golpe.
      if (was.egg > 0 && now.egg === 0 && TUNING.eggBreak > 0) {
        audio.sfx('thorns', { delay: impact + 200 });
      }

      if (now.strength > was.strength) powers.push('strength');
      if (now.egg > was.egg) powers.push('egg');
      if (now.poison > was.poison) powers.push('poison');
      if (now.weak > was.weak) powers.push('snail');
      if (now.stacked > was.stacked) powers.push('octopus');
      if (now.healed > was.healed) powers.push('pot');

      // El veneno muerde al finalizar el turno de quien lo tiene, no cuando se puso.
      if (was.poison > 0 && now.poison < was.poison) {
        audio.sfx('poison', { rate: 0.85, delay: 200 });
      }

      // Una carta más en el mazo es una carta que se llevó del centro.
      if (now.owned > was.owned) audio.sfx('take');
      if (now.renewed && !was.renewed) audio.sfx('renew');
    }

    const wait = swung ? impact + AFTER_HIT : 0;
    powers.forEach((key, i) => audio.sfx(key, { delay: wait + i * APART }));

    if (state.phase === 'draft' && before.phase !== 'draft') audio.sfx('open');

    if (state.phase === 'matchEnd' && before.phase !== 'matchEnd') {
      // El último golpe todavía está en el aire: el resultado entra después de él.
      //
      // El remate es del que está escuchando: gana o pierde. En una sala eso es distinto
      // en cada aparato —el mismo estado, dos remates opuestos—, y por eso hace falta
      // saber de quién es esta pantalla. El doble KO no es de nadie: suena el otro.
      //
      // La partida anulada no tiene remate: no se ganó ni se perdió nada, y el de
      // perder sería decirle al que se quedó que perdió él.
      const result = matchResult(state);
      if (result !== 'void') audio.sfx(result === (seat ?? 'p1') ? 'win' : 'lose', { delay: 900 });
    }

    music(state);
  }

  /**
   * El tema que corresponde. Se pide en cada repintado y el mezclador ignora lo que
   * ya está sonando, así que acá solo hay que decir en qué situación estamos: alguien
   * con la vida corta cambia el tema, y el final lo apaga —el remate suena solo—.
   */
  function music(state) {
    if (state.phase === 'matchEnd') return audio.music(null);
    const low = PLAYERS.some((p) => hpOf(state, p) <= TARGET * LOW_HP);
    audio.music(low ? 'boss' : 'battle');
  }

  // Los botones no suenan por tocarlos. Lo tuvieron un tiempo —un toque seco, la
  // misma carta más arriba y más corta— y era un sonido de más: los botones que
  // importan ya suenan por lo que hacen, y el de robar quedaba con dos cosas encima,
  // el toque y el tic. Lo que se oye al robar tiene que ser el tic y nada más, que es
  // el que va contando cómo crece la cadena.
  return { watch };
}
