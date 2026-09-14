// Smoke test de la capa de render con un DOM mínimo simulado: verifica que
// mount() pinte cada fase de la partida sin romperse y con el contenido esperado.
import assert from 'node:assert/strict';
import { fakeDom } from './dom.mjs';

const nodes = fakeDom();

/**
 * Guarda todos los valores que pasaron por el `dataset` de un nodo.
 *
 * Los pulsos de animación se ponen con un `setTimeout` y se limpian con otro, así que
 * mirarlos en un instante fijo del reloj es apostar a que la máquina esté libre: con
 * el CPU ocupado los timers llegan tarde y la ventana se pierde. Sobre la historia la
 * pregunta deja de depender del reloj — "en algún momento pasó por acá".
 */
function recordDataset(node) {
  const seen = {};
  const raw = node.dataset;
  node.dataset = new Proxy(raw, {
    set(target, key, value) {
      (seen[key] ??= []).push(value);
      target[key] = value;
      return true;
    },
  });
  return seen;
}

const pulses = { p1: recordDataset(nodes['axie-p1']), p2: recordDataset(nodes['axie-p2']) };

const { createGame } = await import('../src/game.js');
const { mount, whiffed, plateHtml } = await import('../src/ui.js');
const { scoreChain } = await import('../src/rules.js');
const { hpOf, ownedBy, MARKET_SIZE } = await import('../src/game.js');

const idle = () => new Promise((r) => setTimeout(r, 0));
const game = createGame({ pace: 0 });
// `mount` devuelve con qué arrancar una partida: es lo que usa la portada al elegir
// contra quién se juega (ver `lobby.js`), y lo que usa este test para cambiar de modo.
const screen = mount(game);

// Antes de que se reparta la primera carta no hay decisión que ofrecer.
assert.match(nodes.controls.innerHTML, /Repartiendo/);
assert.doesNotMatch(nodes.controls.innerHTML, /data-action="hit"/);
await idle();

assert.match(nodes.scoreboard.innerHTML, /Ronda 1/);
// Arriba va la ronda y nada más: el tamaño de la reserva se sacó a propósito.
assert.doesNotMatch(nodes.scoreboard.innerHTML, /reserva/);
// Sin pausas la partida va sin reloj, y la barra no muestra uno quieto.
assert.equal(game.state.clock, null);
assert.equal(nodes.clock.dataset.on, 'false', 'el reloj apagado no se ve');
// La vida vive sobre cada Axie, no en el marcador: al abrir, los dos enteros.
for (const side of ['p1', 'p2']) {
  assert.match(nodes[`plate-${side}`].innerHTML, /class="hpbar"/, `${side}: falta la barrita`);
  assert.match(nodes[`plate-${side}`].innerHTML, /<b>100<\/b>/, `${side}: falta la vida`);
  assert.match(nodes[`plate-${side}`].innerHTML, /class="crest crest--sm"/, `${side}: falta la clase`);
}
// El centro no está puesto mientras se juega: aparece recién al cerrar un turno.
assert.equal(nodes.market.hidden, true, 'el centro está fuera de pantalla');
assert.equal(nodes.market.innerHTML, '');
assert.match(nodes.controls.innerHTML, /data-action="hit"/, 'turno del jugador');
// El medidor cuelga en el arena y solo existe mientras te toca decidir.
assert.match(nodes.odds.innerHTML, /class="odds-dial" data-risk="\w+" style="--p:\d+"/);
assert.match(nodes.odds.innerHTML, /La próxima carta continúa la cadena/, 'el texto del lector');
assert.match(nodes.deck.innerHTML, /cartas/);
assert.match(nodes.deck.innerHTML, /sin salir/);
// Cada Axie se pinta una vez, aparte del tablero: capas del CDN y el crest de reserva.
for (const side of ['p1', 'p2']) {
  assert.match(nodes[`axie-${side}`].innerHTML, /class="axie/, `${side}: falta el Axie`);
  assert.match(nodes[`axie-${side}`].innerHTML, /axie-fallback/, `${side}: falta el crest`);
  // Las capas van etiquetadas por parte: de ahí cuelga el CSS que las mueve por
  // separado —la cola, las orejas, el parpadeo—.
  const art = nodes[`axie-${side}`].innerHTML;
  assert.match(art, /class="axie-rig"/, `${side}: falta la capa de la postura`);
  for (const part of ['body', 'tail', 'eyes', 'ear-left']) {
    assert.match(art, new RegExp(`data-part="${part}"`), `${side}: falta la capa ${part}`);
  }
}
// La postura sale del estado, no de un pulso: al que le toca está cargando.
assert.equal(nodes['axie-p1'].dataset.stance, 'charging');
assert.equal(nodes['axie-p2'].dataset.stance, 'idle');
// La mesa es una sola y la usa el que está jugando.
assert.match(nodes.field.innerHTML, /class="card"/);
assert.equal(nodes.field.dataset.owner, 'p1', 'la mesa es del que tiene el turno');
// Los puntos cargados no van en la mesa: van encima del aro de la próxima carta, que
// es la otra mitad de la misma decisión.
assert.doesNotMatch(nodes.field.innerHTML, /swing-dmg/, 'el número no vive en la mesa');
assert.match(nodes.swing.innerHTML, /class="swing-dmg"/, 'se ven los puntos de daño');
assert.match(nodes.swing.innerHTML, /class="swing-cap">DAÑO</, 'y la palabra, debajo');
// El número crece con lo que dice y no se pasa del ancho del aro: el CSS saca lo
// primero de `--n` y lo segundo de cuántos dígitos ocupa.
assert.match(nodes.swing.innerHTML, /--n:\d+;--chars:\d+/, 'el número lleva su tamaño puesto');
assert.match(nodes.swing.style.props['--c'] ?? '', /^#[0-9a-f]{6}$/i,
  'y el color del que tiene la mesa');
// El turno se cuenta con el aro de color de la chapa, no con texto: ni cartelito en
// la chapa ni el renglón de "está cargando el ataque" sobre la mesa.
assert.equal(nodes['fighter-p1'].dataset.active, 'true');
assert.match(nodes['fighter-p1'].style.props['--c'] ?? '', /^#[0-9a-f]{6}$/i,
  'el peleador lleva el color de su clase, que es con lo que se dibuja el aro');
assert.doesNotMatch(nodes['plate-p1'].innerHTML, /cargando/, 'el turno no se escribe');
assert.doesNotMatch(nodes.field.innerHTML, /cargando el ataque/, 'la mesa tampoco lo escribe');
// El terreno sale de la clase del Axie que jugás.
assert.equal(nodes.arena.dataset.arena, game.state.symbols.p1,
  'el arena toma el terreno de tu clase');

// Se guarda el render de una cadena cortada apenas ocurra, jugando a robar siempre.
let bustHtml = '';
let bustSwing = '';
game.subscribe(() => {
  if (game.state.chains.p1.busted && !bustHtml && game.state.chains.p1.bustCard) {
    bustHtml = nodes.field.innerHTML;
    bustSwing = nodes.swing.innerHTML;
  }
});

/**
 * Cambia por cartas de la reserva las del centro que lleven el símbolo del jugador,
 * para forzar el caso en que no queda nada que agarrar de su color.
 */
function dropOwnSymbol(s) {
  const own = s.symbols.p1;
  for (let i = 0; i < s.market.length; i++) {
    if (!s.market[i].symbols.includes(own)) continue;
    const at = s.pool.findIndex((c) => !c.symbols.includes(own));
    if (at < 0) return false;
    s.pool.push(s.market[i]);
    s.market[i] = s.pool.splice(at, 1)[0];
  }
  return s.pool.length > 0;
}

const phases = new Set();
// El cierre de ronda pasa solo y dura una pausa: el bucle puede no verlo nunca, así
// que la fase y su pie se miran en el repintado.
game.subscribe((s) => {
  phases.add(s.phase);
  if (s.phase === 'roundEnd') {
    // El cierre no cuenta el intercambio: ni quién pegó más fuerte, ni el daño de cada
    // uno, ni las vidas. Eso ya se actuó en la mesa —los números volando, las barras
    // moviéndose— y repetirlo en letra apilada bajo las cartas es el ruido que se sacó.
    // (Se mira sacando las etiquetas y no con `textContent`: el DOM de mentira de
    // `test/dom.mjs` no lo deriva del `innerHTML`, así que ahí siempre sale vacío.)
    const dice = nodes.controls.innerHTML.replace(/<[^>]*>/g, '').trim();
    assert.equal(dice, '', `el cierre de ronda no dice nada, y dijo: ${dice}`);
    assert.doesNotMatch(nodes.controls.innerHTML, /data-action="next"/,
      'la ronda sigue sola: no hay botón que apretar');
  }
});
let sawDraw = false;
let sawFreePick = false;
let sawSkip = false;
let sawPoolPick = false;
let sawRenew = false;
let guard = 0;
while (game.state.phase !== 'matchEnd') {
  assert.ok(guard++ < 4000, 'la partida no termina');
  const s = game.state;
  phases.add(s.phase);

  if (s.phase === 'draft') {
    assert.equal(nodes.market.hidden, false, 'el centro se abre encima al cerrar el turno');
    if (game.drafting() === 'p2') {
      assert.match(nodes.market.innerHTML, /La CPU está eligiendo/);
      await idle();
      continue;
    }
    // El centro nunca pregunta el modo: la carta que tocás decide, y siempre hay un
    // "no agarrar" —que es la única salida cuando las seis traen poder y vas por
    // cartas sin poder—.
    assert.doesNotMatch(nodes.market.innerHTML, /data-mode=/, 'ya no se elige modo');
    assert.match(nodes.market.innerHTML, /data-action="skip"/, 'se ofrece no agarrar');
    const options = game.pickable();
    assert.ok(options.length <= MARKET_SIZE, `se elige entre las ${MARKET_SIZE} del centro`);
    if (options.length === 0) {
      if (game.canRenew('p1')) game.renewMarket();
      else await game.skipDraft();
      continue;
    }
    assert.match(nodes.market.innerHTML, new RegExp(`data-uid="${options[0].uid}"`));

    if (!s.draft.mode) {
      // Sin cadena cortada el centro entero está a mano: con poder o sin poder.
      if (!s.chains.p1.busted) {
        sawFreePick = true;
        assert.deepEqual(options.map((c) => c.uid).sort(), s.market.map((c) => c.uid).sort(),
          `plantado se puede tocar cualquiera de las ${MARKET_SIZE}`);
      }
      // Una vez en la partida se fuerza el centro sin el símbolo propio: ahí aparece
      // el botón para renovarlo, y después de usarlo no vuelve a ofrecerse.
      if (!sawRenew && dropOwnSymbol(s)) {
        sawRenew = true;
        game.refresh(); // dropOwnSymbol toca el estado por afuera: hay que repintar
        assert.match(nodes.market.innerHTML, /data-action="renew"/, 'se ofrece renovar');
        game.renewMarket();
        assert.doesNotMatch(nodes.market.innerHTML, /data-action="renew"/, 'una sola vez');
        continue;
      }
      // Una vez se prueba pasar sin llevarse nada.
      if (!sawSkip) {
        sawSkip = true;
        const had = s.decks.p1.length;
        await game.skipDraft();
        assert.equal(game.state.decks.p1.length, had, 'pasar no suma cartas');
        continue;
      }
    }
    sawPoolPick = true;
    await game.takeCard(options[0].uid);
    continue;
  }

  if (s.turn === 'p1' && !s.busy && s.phase === 'turn') {
    if (s.pendingStack && s.pendingStack.player === 'p1') {
      await game.chooseStackTarget(0);
      continue;
    }
    // Plantarse en las rondas pares asegura que se pinte la elección del reparto
    // aunque las cadenas se corten muchas veces seguidas; en las impares se roba.
    //
    // El umbral es alto a propósito. Con los poderes las partidas se acortaron de ~19
    // rondas a ~14, y contra una CPU cargada pueden terminar en 7: con pocas rondas
    // impares y un robo por ronda, había un ~1.5% de partidas donde todos los robos
    // se cortaban (y no quedaba ninguno exitoso que mirar) o ninguno se cortaba (y no
    // había cadena rota que pintar). Robando hasta 12 hay varios tiros por ronda y
    // los dos casos salen igual.
    if (s.round % 2 === 0 || scoreChain(s.chains.p1).total >= 12) {
      await game.stand();
    } else {
      await game.hit();
      // Robar se siente en el cuerpo: el tirón se marca en el mismo repintado, así
      // que apenas vuelve `hit()` ya tiene que estar puesto. (Lo contrario no se
      // puede afirmar: el pulso dura 420 ms y acá las cartas salen mucho más rápido,
      // así que una carta que corta la cadena encuentra el tirón anterior todavía
      // puesto.)
      if (!game.state.chains.p1.busted) {
        sawDraw = true;
        // Este sí se pone en el mismo repintado, sin timers de por medio.
        assert.equal(nodes['axie-p1'].dataset.act, 'draw', 'el tirón de robar');
      }
    }
  } else {
    await idle();
  }
  // El medidor queda afuera: fuera del turno propio no muestra nada, y ese vacío es
  // justamente lo que tiene que pasar.
  for (const id of ['scoreboard', 'plate-p1', 'plate-p2', 'field', 'controls', 'deck']) {
    assert.ok(nodes[id].innerHTML.length > 0, `${id} quedó vacío`);
    assert.ok(!nodes[id].innerHTML.includes('undefined'), `undefined en ${id}`);
  }
  // Y el pie son siempre los dos mismos casilleros, esté donde esté la partida: el que
  // se lee arriba y el que se aprieta abajo. El alto de la franja lo fija el CSS
  // contando con que los dos están puestos (ver `--pie` en `styles.css`), así que una
  // fase que se olvide de uno —el turno de la CPU no tiene botones, el cierre de ronda
  // tampoco— le devuelve al juego el temblequeo que tenía: la mesa entera subiendo y
  // bajando dos veces por turno. Vacío está bien; ausente no.
  for (const caja of ['controls-say', 'controls-acts']) {
    assert.equal(
      nodes.controls.innerHTML.split(`class="${caja}"`).length - 1, 1,
      `en ${game.state.phase} el pie no trae exactamente una \`.${caja}\``,
    );
  }
}

assert.ok(phases.has('roundEnd'), 'se pintó el cierre de ronda');
assert.ok(phases.has('draft'), 'se pintó el reparto de la reserva');
assert.ok(sawFreePick, 'se pudo tocar cualquier carta sin elegir modo antes');
assert.ok(sawSkip, 'se pudo cerrar el reparto sin agarrar');
assert.ok(sawPoolPick, 'se pudo tomar una carta del centro');
assert.ok(sawRenew, 'se pintó la renovación del centro');
assert.ok(sawDraw, 'se marcó el tirón de robar una carta');
// Terminada la partida el que se quedó sin vida se desploma y el otro festeja.
const down = hpOf(game.state, 'p1') <= 0 ? 'p1' : 'p2';
assert.equal(nodes[`axie-${down}`].dataset.stance, 'ko', 'el que cae queda tirado');
// El centro ya no desaparece de un cuadro para el otro: se apaga y recién cuando
// terminó de irse se guarda el nodo (ver `overlay` en `ui.js`). Así que hay que darle
// ese respiro antes de preguntarle, que es lo mismo que hay que darle en pantalla.
await new Promise((r) => setTimeout(r, 300));
assert.equal(nodes.market.hidden, true, 'el centro se va al terminar');
// Terminada la partida el pie tiene las dos puertas y nada más: cómo terminó lo dice
// el cartel grande del medio, y el pie no lo repite en letra chica.
assert.match(nodes.controls.innerHTML, /data-action="restart"/);
assert.match(nodes.controls.innerHTML, /data-action="menu"/);
assert.doesNotMatch(nodes.controls.innerHTML, /Vida final/);
assert.equal(nodes.finale.hidden, false, 'el cartel del final sale en el medio');
assert.match(nodes.finale.innerHTML, /class="finale-text"/);
// Dos carteles y no cinco: ganaste, o no. Contra la CPU el que mira es `p1`, así que
// gana el cartel de la victoria solo si el que quedó tirado es el otro.
const ganaste = hpOf(game.state, 'p1') > 0 && hpOf(game.state, 'p2') <= 0;
assert.equal(nodes.finale.dataset.won, String(ganaste));
if (ganaste) {
  assert.match(nodes.finale.innerHTML, /¡Victoria!/);
  // Y el festejo, que es lo único que separa un cartel del otro además del texto.
  assert.match(nodes.finale.innerHTML, /class="confetti"/, 'la victoria tira papelitos');
  assert.ok(
    nodes.finale.innerHTML.split('<i style=').length - 1 >= 20,
    'la lluvia son muchos papelitos, no dos',
  );
} else {
  assert.match(nodes.finale.innerHTML, /La suerte no estuvo de tu lado/);
  assert.doesNotMatch(nodes.finale.innerHTML, /class="confetti"/,
    'perdiendo no hay nada que festejar');
}
assert.match(nodes.log.innerHTML, /<li data-kind="round">/);

assert.ok(bustHtml, 'robando hasta 20 pts alguna cadena tiene que cortarse');
assert.match(bustHtml, /card--bust/, 'se muestra la carta que rompió la cadena');
assert.match(bustHtml, /Cadena cortada/);
assert.match(bustSwing, /class="swing-dmg" data-busted="true"[^>]*>0</,
  'una cadena cortada no hace daño');

// El golpe no es inmediato: el que pega sale disparado antes (~100-250 ms) y el que
// lo recibe se sacude cuando el efecto conecta (~370-520 ms). Se comprueban los dos
// después de terminada la partida, sobre el último golpe, esperando cada momento.
const last = game.state.lastHit;
assert.ok(last, 'la partida terminó con un golpe');
await new Promise((r) => setTimeout(r, 1200));
// Un ataque que se desarma no cruza a ningún lado: no hay salto que mirar.
if (last.amount > 0) {
  assert.ok(pulses[last.by].act?.includes('attack'), 'el que pega va hacia el otro');
}
const hitNode = nodes[`axie-${last.target}`];
assert.ok(pulses[last.target].react?.some((v) => /^(hit|whiff)$/.test(v)),
  'el que recibe el golpe se sacude');
assert.match(hitNode.innerHTML, /class="dmg"/, 'sale el número del golpe');

// Los dos interruptores de sonido arrancan como corresponde y se dan vuelta al
// tocarlos. Que suenen o no es cosa del mezclador (ver `audio.test.js`); acá lo único
// que se mira es que el botón diga la verdad.
assert.equal(nodes['sfx-btn'].dataset.on, 'true', 'los efectos vienen prendidos');
assert.equal(nodes['music-btn'].dataset.on, 'false', 'la música no');
nodes['music-btn'].handlers.click();
assert.equal(nodes['music-btn'].dataset.on, 'true');
assert.equal(nodes['music-btn']['aria-pressed'], 'true');

// Las dos perillas arrancan arriba de todo y el número dice lo mismo que la perilla.
assert.equal(nodes['sfx-vol'].value, '100', 'la perilla de efectos arranca al máximo');
assert.equal(nodes['music-pct'].textContent, '100%');
nodes['music-vol'].handlers.input({ target: { value: '40' } });
assert.equal(nodes['music-pct'].textContent, '40%', 'el número sigue a la perilla');
assert.equal(nodes['music-vol'].value, '40');
// Y bajar el volumen no apaga la música: son dos preguntas distintas.
assert.equal(nodes['music-btn'].dataset.on, 'true', 'bajar el volumen no apaga nada');

// ---- el mazo y el historial, que ya no viven apoyados sobre la pelea ---------
// Los dos se piden: el mazo tocando un Axie, el historial desde el menú. Hasta que
// alguien los abra no dibujan una carta —son hasta cuarenta y repintarlas en cada carta
// que sale es trabajo tirado—, así que abrirlos es parte de lo que se prueba acá.
assert.equal(nodes['deck-sheet'].innerHTML, '', 'sin abrir, el panel no dibuja nada');

for (const seat of ['p1', 'p2']) {
  nodes[`peek-${seat}`].handlers.click();
  assert.equal(nodes['deck-modal'].open, true, `${seat}: tocar el Axie abre su mazo`);
  assert.match(nodes['deck-sheet'].innerHTML, /Mazo inicial · 10 cartas/,
    `${seat}: están las diez de fábrica`);
  assert.match(nodes['deck-sheet'].innerHTML, /Sumadas del centro/,
    `${seat}: y lo que se llevó del centro`);
  assert.ok(!nodes['deck-sheet'].innerHTML.includes('undefined'), `undefined en el mazo de ${seat}`);
  // El panel es de quien se tocó, y lo dice: sin esto los dos mazos se ven iguales y no
  // hay forma de saber cuál se está mirando.
  assert.match(nodes['deck-label'].textContent, seat === 'p1' ? /Tu mazo/ : /Mazo de la CPU/,
    `${seat}: el título dice de quién es`);
  // Las dos listas juntas son todo lo que tiene el jugador, que es lo que cuenta la
  // partida por el otro lado. Si se separan, una de las dos está mintiendo.
  const st = game.state;
  assert.equal(st.start[seat].length + st.added[seat].length, ownedBy(st, seat),
    `${seat}: el panel no muestra las mismas cartas que tiene`);
  nodes['deck-modal'].handlers.close();
}
assert.equal(nodes['deck-sheet'].innerHTML, '', 'cerrado vuelve a no dibujar nada');

// El menú arranca cerrado y el botón lo abre y lo cierra.
assert.equal(nodes['hud-menu'].hidden, true, 'el menú arranca guardado');
nodes['hud-btn'].handlers.click({});
assert.equal(nodes['hud-menu'].hidden, false, 'las tres rayitas lo abren');
assert.equal(nodes['hud-btn']['aria-expanded'], 'true');
nodes['hud-btn'].handlers.click({});
assert.equal(nodes['hud-menu'].hidden, true, 'y lo vuelven a cerrar');

// Y de adentro del menú sale el historial, que es de donde se lee ahora.
nodes['log-btn'].handlers.click();
assert.equal(nodes['log-modal'].open, true, 'el historial se abre desde el menú');
assert.match(nodes.log.innerHTML, /<li/, 'y trae los renglones de la partida');

// ---- el ataque que el huevo se come entero -----------------------------------
// No es un fallo, y la diferencia se ve en pantalla: el fallo deja al que pegaba
// clavado en su lugar, con el efecto de desarme encima del rival y un FALLO flotando.
// Contra un huevo grande el golpe llega en cero igual —`amount` es lo que **pasó** del
// escudo— y mirando solo ese número la pantalla contaba un ataque de 6 como un ataque
// que nunca salió, mientras el registro decía que el huevo había aguantado 6.
assert.equal(whiffed({ amount: 0, blocked: 6, broke: false }), false,
  'el huevo se lo comió entero, pero el ataque salió: tiene que embestir igual');
assert.equal(whiffed({ amount: 0, blocked: 4, broke: true }), false,
  'y lo mismo el que rompe el huevo justo con el último punto');
assert.equal(whiffed({ amount: 0, blocked: 0 }), true,
  'sin nada bloqueado y sin daño sí falló: el caracol se le comió el mordisco');
// ---- Free Game: visualización de la carta a colocar (Tetris dock) -----------
game.state.phase = 'turn';
game.state.turn = 'p1';
game.state.pendingStack = {
  player: 'p1',
  card: { uid: 999, symbols: ['aquatic', 'beast'], power: null },
};
game.refresh();
await idle();

assert.match(nodes.field.innerHTML, /class="tetris-dock"/, 'muestra el dock de tetris');
assert.match(nodes.field.innerHTML, /class="card card--tetris-floating"/, 'muestra la carta flotante');
assert.match(nodes.field.innerHTML, /card-stack-drop-hint/, 'muestra la flecha de destino en las columnas');
assert.match(nodes.controls.innerHTML, /elegí la columna donde colocar/, 'aviso en los controles');
assert.match(nodes.controls.innerHTML, /data-action="hit"/, 'conserva botón de robar durante pendingStack');
assert.match(nodes.controls.innerHTML, /data-action="stand"/, 'conserva botón de atacar/saltar durante pendingStack');

// Verifica con exactamente 1 carta en la cadena (primera carta)
game.state.chains.p1 = { cards: [{ uid: 101, symbols: ['aquatic', 'bird'], power: 'freegame' }], busted: false, timeout: false, bustCard: null, runs: [] };
game.refresh();
await idle();
assert.match(nodes.field.innerHTML, /class="tetris-dock"/, 'muestra dock en primera carta');
assert.match(nodes.field.innerHTML, /data-stack-col="0"/, 'la primera columna es objetivo de stack');
assert.match(nodes.field.innerHTML, /card-stack-drop-hint/, 'muestra flecha sobre columna 1');

game.state.pendingStack = null;
game.state.chains.p1 = {
  cards: [{ uid: 101, symbols: ['aquatic', 'bird', 'plant', 'bug'], power: null, stackedCards: [{ uid: 101 }, { uid: 102 }] }],
  busted: false, timeout: false, bustCard: null, runs: []
};
game.refresh();
await idle();
assert.doesNotMatch(nodes.field.innerHTML, /tetris-dock/, 'limpia el dock tras resolver pendingStack');
assert.match(nodes.field.innerHTML, /card--giant/, 'la carta apilada tiene clase card--giant');
assert.match(nodes.field.innerHTML, /--zoom:/, 'aplica zoom out al apilar');
assert.match(nodes.controls.innerHTML, /data-action="hit"/, 'conserva botón de robar con carta apilada');
assert.match(nodes.controls.innerHTML, /data-action="stand"/, 'conserva botón de atacar/saltar con carta apilada');

// Verifica render de múltiples poderes apilados (Free Game + Poder)
game.state.chains.p1 = {
  cards: [{
    uid: 101,
    symbols: ['aquatic', 'bird', 'plant', 'beast'],
    power: 'strength',
    powers: ['freegame', 'strength'],
    stackedCards: [
      { uid: 101, symbols: ['aquatic', 'bird'], power: 'freegame' },
      { uid: 102, symbols: ['plant', 'beast'], power: 'strength' }
    ]
  }],
  busted: false, timeout: false, bustCard: null, runs: []
};
game.refresh();
await idle();
assert.match(nodes.field.innerHTML, /card-power--multi/, 'aplica card-power--multi con múltiples poderes');
assert.match(nodes.field.innerHTML, /power-freegame\.png/, 'muestra ícono de freegame en columna apilada');
assert.match(nodes.field.innerHTML, /power-strength\.png/, 'muestra ícono de strength en columna apilada');

// Verifica zoom out dinámico en el dock de colocación (pendingStack)
game.state.pendingStack = {
  player: 'p1',
  card: { uid: 999, symbols: ['plant', 'reptile'], power: null },
};
game.refresh();
await idle();
assert.match(nodes.field.innerHTML, /class="tetris-dock"[^>]*style="--zoom:/, 'el dock de tetris escala con zoom out');
assert.match(nodes.controls.innerHTML, /data-action="hit"/, 'conserva botón de robar durante colocación con dock');
assert.match(nodes.controls.innerHTML, /data-action="stand"/, 'conserva botón de atacar durante colocación con dock');

// Verifica zoom out en cadenas largas (5+ cartas) igual que versión vertical
game.state.pendingStack = null;
game.state.chains.p1 = {
  cards: [
    { uid: 1, symbols: ['aquatic', 'bird'], power: null },
    { uid: 2, symbols: ['bird', 'plant'], power: null },
    { uid: 3, symbols: ['plant', 'beast'], power: null },
    { uid: 4, symbols: ['beast', 'bug'], power: null },
    { uid: 5, symbols: ['bug', 'reptile'], power: null },
  ],
  busted: false, timeout: false, bustCard: null, runs: []
};
game.refresh();
await idle();
assert.match(nodes.field.innerHTML, /--zoom:/, 'aplica zoom out al acumular 5 cartas');
assert.match(nodes.controls.innerHTML, /data-action="hit"/, 'botones disponibles en cadena de 5 cartas');
assert.match(nodes.controls.innerHTML, /data-action="stand"/, 'botón de atacar disponible en cadena de 5 cartas');

console.log('✓ render ok');

// ---- los dos asientos de una sala -------------------------------------------
// La misma pantalla con una partida donde los dos asientos son de personas (es la de
// las salas: ver `net.js`). Sin asiento propio —esta pantalla no está enganchada a
// ninguna sala— los carteles pasan a decir de quién es el turno, que es lo único que
// no se puede adivinar mirando la mesa cuando ninguno de los dos es la máquina.
screen.restart({ mode: 'net' });
await idle();

assert.match(nodes['plate-p2'].innerHTML, /J2/, 'la chapa deja de decir CPU');
// Quién abre se sortea al empezar (ver `newMatch`), así que el cartel nombra al que
// le tocó y el test lo lee en vez de suponerlo. Contra la CPU ese renglón no existe:
// ahí el turno es siempre tuyo cuando hay botones.
const opener = game.state.order[0] === 'p1' ? 'Jugador 1' : 'Jugador 2';
assert.match(nodes.controls.innerHTML, new RegExp(`Le toca a ${opener}`),
  'el cartel dice de quién es el turno');
assert.match(nodes.controls.innerHTML, /data-action="hit"/, 'con sus botones puestos');

console.log('✓ render ok (los dos asientos de una sala)');

// --- verificación del escudo con icono en la vida y el daño en status effects ----
{
  const st = {
    ...game.state,
    status: {
      ...game.state.status,
      p1: { ...game.state.status.p1, egg: 12, eggBreak: 16 },
    },
  };
  const html = plateHtml(st, 'p1');
  assert.match(html, /class="plate-shield"/, 'el escudo se muestra al lado de la vida');
  assert.match(html, /shield\.png/, 'lleva el icono de escudo');
  assert.match(html, /<b>12<\/b>/, 'muestra el valor del escudo (12)');
  assert.match(html, /title="Huevo: 16 de daño acumulado al romperse/, 'status effect dice el daño acumulado');
  assert.match(html, /<b>16<\/b>/, 'el chip de status del huevo muestra el daño acumulado (16)');

  // Con 0 de huevo no hay escudo
  const stZero = {
    ...game.state,
    status: {
      ...game.state.status,
      p1: { ...game.state.status.p1, egg: 0, eggBreak: 0 },
    },
  };
  const htmlZero = plateHtml(stZero, 'p1');
  assert.doesNotMatch(htmlZero, /class="plate-shield"/, 'sin huevo no se muestra la insignia de escudo');
  console.log('  ✓ escudo en barra de vida y daño acumulado en status effects de huevo');
}
