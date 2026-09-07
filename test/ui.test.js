// Smoke test de la capa de render con un DOM mínimo simulado: verifica que
// mount() pinte cada fase de la partida sin romperse y con el contenido esperado.
import assert from 'node:assert/strict';

const IDS = [
  'scoreboard', 'arena', 'fighter-human', 'fighter-cpu', 'plate-human', 'plate-cpu',
  'axie-human', 'axie-cpu', 'field', 'controls', 'odds', 'deck', 'log',
  'new-match', 'difficulty', 'rules-btn', 'rules-modal', 'axie-picker', 'market', 'vfx',
  'sfx-btn', 'music-btn',
];

const nodes = Object.fromEntries(
  IDS.map((id) => [id, {
    id, innerHTML: '', dataset: {}, value: 'normal', hidden: false, handlers: {},
    addEventListener(type, fn) { this.handlers[type] = fn; },
    showModal() { this.open = true; },
    setAttribute(name, value) { this[name] = value; },
    // Lo mínimo que necesita el número de daño flotante (ver `playHit` en ui.js).
    insertAdjacentHTML(_pos, html) { this.innerHTML += html; },
    querySelector() { return null; },
  }]),
);

globalThis.document = { getElementById: (id) => nodes[id] ?? null, addEventListener() {} };
// El mezclador se fija ahí si el jugador dejó el sonido prendido (ver `audio.js`).
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, value),
};

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

const pulses = { human: recordDataset(nodes['axie-human']), cpu: recordDataset(nodes['axie-cpu']) };

const { createGame } = await import('../src/game.js');
const { mount } = await import('../src/ui.js');
const { scoreChain } = await import('../src/rules.js');
const { hpOf } = await import('../src/game.js');

const idle = () => new Promise((r) => setTimeout(r, 0));
const game = createGame({ pace: 0 });
mount(game);

// Antes de que se reparta la primera carta no hay decisión que ofrecer.
assert.match(nodes.controls.innerHTML, /Repartiendo/);
assert.doesNotMatch(nodes.controls.innerHTML, /data-action="hit"/);
await idle();

assert.match(nodes.scoreboard.innerHTML, /Ronda 1/);
assert.match(nodes.scoreboard.innerHTML, /71 cartas en la reserva/);
// La vida vive sobre cada Axie, no en el marcador: al abrir, los dos enteros.
for (const side of ['human', 'cpu']) {
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
assert.match(nodes['axie-picker'].innerHTML, /data-axie="bird"/);
assert.equal((nodes['axie-picker'].innerHTML.match(/data-on="true"/g) ?? []).length, 1,
  'exactamente un Axie elegido');
assert.match(nodes['axie-picker'].innerHTML, /data-taken="true"/, 'la CPU ocupa otro Axie');
// Cada Axie se pinta una vez, aparte del tablero: capas del CDN y el crest de reserva.
for (const side of ['human', 'cpu']) {
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
assert.equal(nodes['axie-human'].dataset.stance, 'charging');
assert.equal(nodes['axie-cpu'].dataset.stance, 'idle');
// La mesa es una sola y la usa el que está jugando.
assert.match(nodes.field.innerHTML, /class="card"/);
assert.match(nodes.field.innerHTML, /class="field-dmg"/, 'se ven los puntos de daño');
assert.equal(nodes.field.dataset.owner, 'human', 'la mesa es del que tiene el turno');
assert.equal(nodes['fighter-human'].dataset.active, 'true');
// El terreno sale de la clase del Axie que jugás.
assert.equal(nodes.arena.dataset.arena, game.state.symbols.human,
  'el arena toma el terreno de tu clase');

// Se guarda el render de una cadena cortada apenas ocurra, jugando a robar siempre.
let bustHtml = '';
game.subscribe(() => {
  if (game.state.chains.human.busted && !bustHtml && game.state.chains.human.bustCard) {
    bustHtml = nodes.field.innerHTML;
  }
});

/**
 * Cambia por cartas de la reserva las del centro que lleven el símbolo del jugador,
 * para forzar el caso en que no queda nada que agarrar de su color.
 */
function dropOwnSymbol(s) {
  const own = s.symbols.human;
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
    if (game.drafting() === 'cpu') {
      assert.match(nodes.market.innerHTML, /La CPU está eligiendo/);
      await idle();
      continue;
    }
    // El centro nunca pregunta el modo: la carta que tocás decide, y siempre hay un
    // "no agarrar" —que es la única salida cuando las cinco traen poder y vas por
    // cartas sin poder—.
    assert.doesNotMatch(nodes.market.innerHTML, /data-mode=/, 'ya no se elige modo');
    assert.match(nodes.market.innerHTML, /data-action="skip"/, 'se ofrece no agarrar');
    const options = game.pickable();
    assert.ok(options.length <= 5, 'se elige entre las 5 del centro');
    if (options.length === 0) {
      if (game.canRenew('human')) game.renewMarket();
      else await game.skipDraft();
      continue;
    }
    assert.match(nodes.market.innerHTML, new RegExp(`data-uid="${options[0].uid}"`));

    if (!s.draft.mode) {
      // Sin cadena cortada el centro entero está a mano: con poder o sin poder.
      if (!s.chains.human.busted) {
        sawFreePick = true;
        assert.deepEqual(options.map((c) => c.uid).sort(), s.market.map((c) => c.uid).sort(),
          'plantado se puede tocar cualquiera de las 5');
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
        const had = s.decks.human.length;
        await game.skipDraft();
        assert.equal(game.state.decks.human.length, had, 'pasar no suma cartas');
        continue;
      }
    }
    sawPoolPick = true;
    await game.takeCard(options[0].uid);
    continue;
  }

  if (s.phase === 'roundEnd') {
    assert.match(nodes.controls.innerHTML, /data-action="next"/);
    assert.match(nodes.controls.innerHTML, /class="banner"/);
    await game.nextRound();
  } else if (s.turn === 'human' && !s.busy) {
    // Plantarse en las rondas pares asegura que se pinte la elección del reparto
    // aunque las cadenas se corten muchas veces seguidas; en las impares se roba.
    //
    // El umbral es alto a propósito. Con los poderes las partidas se acortaron de ~19
    // rondas a ~14, y contra una CPU cargada pueden terminar en 7: con pocas rondas
    // impares y un robo por ronda, había un ~1.5% de partidas donde todos los robos
    // se cortaban (y no quedaba ninguno exitoso que mirar) o ninguno se cortaba (y no
    // había cadena rota que pintar). Robando hasta 12 hay varios tiros por ronda y
    // los dos casos salen igual.
    if (s.round % 2 === 0 || scoreChain(s.chains.human).total >= 12) {
      await game.stand();
    } else {
      await game.hit();
      // Robar se siente en el cuerpo: el tirón se marca en el mismo repintado, así
      // que apenas vuelve `hit()` ya tiene que estar puesto. (Lo contrario no se
      // puede afirmar: el pulso dura 420 ms y acá las cartas salen mucho más rápido,
      // así que una carta que corta la cadena encuentra el tirón anterior todavía
      // puesto.)
      if (!game.state.chains.human.busted) {
        sawDraw = true;
        // Este sí se pone en el mismo repintado, sin timers de por medio.
        assert.equal(nodes['axie-human'].dataset.act, 'draw', 'el tirón de robar');
      }
    }
  } else {
    await idle();
  }
  // El medidor queda afuera: fuera del turno propio no muestra nada, y ese vacío es
  // justamente lo que tiene que pasar.
  for (const id of ['scoreboard', 'plate-human', 'plate-cpu', 'field', 'controls', 'deck']) {
    assert.ok(nodes[id].innerHTML.length > 0, `${id} quedó vacío`);
    assert.ok(!nodes[id].innerHTML.includes('undefined'), `undefined en ${id}`);
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
const down = hpOf(game.state, 'human') <= 0 ? 'human' : 'cpu';
assert.equal(nodes[`axie-${down}`].dataset.stance, 'ko', 'el que cae queda tirado');
assert.equal(nodes.market.hidden, true, 'el centro se va al terminar');
assert.match(nodes.controls.innerHTML, /data-action="restart"/);
assert.match(nodes.controls.innerHTML, /Vida final/);
assert.match(nodes.log.innerHTML, /<li data-kind="round">/);

assert.ok(bustHtml, 'robando hasta 20 pts alguna cadena tiene que cortarse');
assert.match(bustHtml, /card--bust/, 'se muestra la carta que rompió la cadena');
assert.match(bustHtml, /Cadena cortada/);
assert.match(bustHtml, /data-busted="true"/);
assert.match(bustHtml, /class="field-dmg" data-busted="true">0</, 'una cadena cortada no hace daño');

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

console.log('✓ render ok');
