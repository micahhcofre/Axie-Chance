// La pantalla del final (`src/result.js`): qué escena le toca a cada pantalla, qué
// dice, las marcas de la partida, el botín y cuándo suena el remate.
import assert from 'node:assert/strict';
import { fakeDom } from './dom.mjs';

fakeDom();
const { createGame, TARGET, swingOf } = await import('../src/game.js');
const { resultView, resultHtml, createResult, rewardsOf, RESULT_BEAT } = await import('../src/result.js');
const { isFinalLevel, ADVENTURE_LEVELS } = await import('../src/adventure.js');

const idle = () => new Promise((r) => setTimeout(r, 0));
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await idle(); };

/** Una partida en red recién empezada: nadie juega solo y el estado se toca a mano. */
async function table(setup = { mode: 'net', axie: 'aquatic', axie2: 'plant' }) {
  const game = createGame({ pace: 0, seed: 5 });
  game.newMatch(setup);
  await settle();
  return game;
}

/** Termina la partida con `down` sin vida (uno, los dos, o nadie si alguien se fue). */
function finish(state, down) {
  for (const p of down) state.totals[p === 'p1' ? 'p2' : 'p1'] = TARGET + state.healed[p];
  state.phase = 'matchEnd';
  state.round = 7;
}

// ---- las marcas las anota la partida ---------------------------------------
{
  const game = await table();
  const player = game.state.turn;
  const cards = game.state.chains[player].cards.length;
  const swing = swingOf(game.state, player);
  assert.deepEqual(game.state.records[player], { hit: 0, chain: 0 }, 'arranca sin marcas');
  await game.stand();
  assert.equal(game.state.records[player].hit, swing, 'el mejor golpe es el ataque soltado');
  assert.equal(game.state.records[player].chain, swing > 0 ? cards : 0, 'y la cadena, las cartas con que atacó');
  console.log('  ✓ la partida anota las marcas');
}

// ---- la escena de cada pantalla --------------------------------------------
{
  const game = await table();
  const s = game.state;
  assert.equal(resultView(s), null, 'mientras se juega no hay pantalla');

  finish(s, ['p2']);
  s.records.p1 = { hit: 21, chain: 5 };
  const p1 = resultView(s, { seat: 'p1', net: true });
  const p2 = resultView(s, { seat: 'p2', net: true });
  const eye = resultView(s, { seat: null, net: true });
  assert.equal(p1.outcome, 'win', 'el que dejó al otro sin vida ve la victoria');
  assert.equal(p2.outcome, 'lose', 'el otro aparato, la derrota');
  assert.equal(eye.outcome, 'win', 'el que mira ve la escena del que ganó');
  assert.equal(eye.hero, 'p1');
  assert.match(eye.title, /Gana Jugador 1/, 'con su nombre, porque no ganó él');
  assert.deepEqual(p1.stats.map((x) => x.value), [s.totals.p1, 21, 5, 7], 'las marcas son del que mira');
  assert.deepEqual(p1.cast.map((c) => c.stance), ['win']);
  assert.deepEqual(p2.cast.map((c) => [c.role, c.stance]), [['hero', 'ko'], ['rival', 'win']],
    'en la derrota el tuyo está tirado y el rival festeja atrás');
  assert.match(p2.line, /te ganó en la ronda 7/);

  const html = resultHtml(p1, '<button data-action="restart"></button>');
  assert.match(html, /class="confetti"/, 'la victoria tira papelitos');
  assert.match(html, /result-cloth-blue\.png/, 'sobre la tela azul del kit');
  assert.match(html, /result-branch\.png/);
  assert.match(html, /data-action="restart"/, 'con las puertas que le pasa la mesa');
  const lost = resultHtml(p2);
  assert.match(lost, /result-cloth-red\.png/, 'la derrota va en la tela roja');
  assert.match(lost, /result-web-l\.png/);
  assert.match(lost, /class="result-rain"/);
  assert.doesNotMatch(lost, /class="confetti"/, 'perdiendo no hay papelitos');
  console.log('  ✓ victoria y derrota, desde cada pantalla');
}
{
  const game = await table();
  finish(game.state, ['p1', 'p2']);
  const view = resultView(game.state, { seat: 'p2', net: true });
  assert.equal(view.outcome, 'tie', 'el doble KO es empate para los dos');
  assert.deepEqual(view.cast.map((c) => c.stance), ['ko', 'ko'], 'y los dos quedan mareados');
  const html = resultHtml(view);
  assert.match(html, /result-cloth--l[\s\S]*result-cloth--r/, 'media tela de cada lado');
  assert.match(html, /result-word--l[\s\S]*result-word--r/, 'y la palabra en dos mitades');
  assert.match(html, /class="result-bolt"/);
  console.log('  ✓ empate');
}
{
  const game = await table();
  game.forfeit('p2');
  const view = resultView(game.state, { seat: 'p1', net: true });
  assert.equal(view.outcome, 'void', 'irse temprano anula');
  assert.deepEqual(view.stats, [], 'una partida anulada no tiene marcas');
  assert.match(view.line, /Jugador 2 abandonó/);
  assert.doesNotMatch(resultHtml(view), /confetti|result-rain|result-bolt/, 'ni escena');
  console.log('  ✓ partida anulada');
}
{
  const last = ADVENTURE_LEVELS.length;
  for (const level of [1, last]) {
    const game = await table({ mode: 'adventure', adventureLevel: level });
    finish(game.state, ['p2']);
    const view = resultView(game.state);
    assert.equal(view.title, isFinalLevel(level) ? '¡Aventura Completada!' : '¡Nivel superado!');
    assert.match(view.kicker, /^Aventura · /, 'arriba, de qué nivel se trata');
  }
  console.log('  ✓ Aventura');
}

// ---- el botín -----------------------------------------------------------------
{
  const game = await table();
  const s = game.state;
  finish(s, ['p2']);
  assert.deepEqual(rewardsOf(s, 'p1'), [], 'sin botín no hay sección');
  assert.doesNotMatch(resultHtml(resultView(s, { seat: 'p1', net: true })), /result-loot/);

  s.rewards = { p1: [
    { id: 'hoja', name: 'Amuleto de hoja', icon: 'Icons/power-leaf.png' },
    { name: '<img src=x onerror=alert(1)>', icon: 'x" onload="alert(1)', qty: '3', rarity: 'legendary' },
    { name: 'sin dibujo' },
    null,
    { name: 'Rareza rara', icon: 'Icons/power-egg.png', rarity: 'mítica', qty: -2 },
  ] };
  const loot = rewardsOf(s, 'p1');
  assert.equal(loot.length, 3, 'lo que no tiene nombre o dibujo no se muestra');
  assert.deepEqual(loot.map((i) => [i.qty, i.rarity]), [[1, 'common'], [3, 'legendary'], [1, 'common']],
    'cantidad al menos uno, y una rareza desconocida se pinta común');
  const html = resultHtml(resultView(s, { seat: 'p1', net: true }));
  assert.match(html, /class="result-loot"/);
  assert.equal(html.split('class="result-item"').length - 1, 3);
  assert.doesNotMatch(html, /<img src=x|onload="alert/, 'lo que llega por la red se escribe como texto');
  assert.match(html, /×3/);
  assert.doesNotMatch(resultHtml(resultView(s, { seat: 'p2', net: true })), /result-loot/,
    'el botín es de cada asiento');
  console.log('  ✓ botín');
}

// ---- el reproductor ---------------------------------------------------------
{
  const game = await table();
  const s = game.state;
  const heard = [];
  const node = document.getElementById('result');
  const screen = createResult(node, { audio: { sfx: (key, opts) => heard.push({ key, ...opts }) } });

  finish(s, ['p1', 'p2']);
  s.rewards = { p2: [{ name: 'Amuleto', icon: 'Icons/power-leaf.png' }, { name: 'Huevo', icon: 'Icons/power-egg.png' }] };
  screen.show(s, { seat: 'p2', net: true, actions: '<button data-action="leave"></button>', wait: 2000 });
  assert.equal(node.hidden, false);
  assert.equal(node.dataset.outcome, 'tie');
  assert.equal(node.style.props['--wait'], '2000ms', 'el CSS espera lo mismo que el efecto');
  assert.equal(node.style.props['--t-fx'], `${RESULT_BEAT.fx}ms`);
  assert.equal(node.style.props['--t-acts'], `${RESULT_BEAT.loot + 2 * 350 + 250}ms`,
    'con botín, las puertas esperan al último objeto');
  assert.deepEqual(heard[0], { key: 'tie', delay: 2000 + RESULT_BEAT.fx }, 'el remate suena con el efecto');
  assert.equal(heard.filter((h) => h.key === 'take').length, 2, 'y cada objeto al caer');

  heard.length = 0;
  s.forfeit = { by: 'p1', winner: null };
  screen.show(s, { seat: 'p2', net: true });
  assert.equal(node.dataset.outcome, 'void');
  assert.equal(heard.filter((h) => ['win', 'lose', 'tie'].includes(h.key)).length, 0,
    'la partida anulada no suena');

  node.handlers.click({ target: { closest: () => ({ dataset: { result: 'peek' } }) } });
  assert.equal(node.dataset.peek, 'true', 'se puede mirar la mesa');
  node.handlers.click({ target: { closest: () => ({ dataset: { result: 'back' } }) } });
  assert.equal(node.dataset.peek, 'false', 'y volver');

  screen.hide();
  assert.equal(node.hidden, true);
  assert.equal(node.innerHTML, '');
  console.log('  ✓ reproductor');
}

console.log('✓ pantalla del final ok');
process.exit(0);
