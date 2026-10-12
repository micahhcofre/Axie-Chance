// La pantalla del final (`src/result.js`): qué escena le toca a cada pantalla, qué
// dice, las marcas de la partida, el botín y cuándo suena el remate.
import assert from 'node:assert/strict';
import { fakeDom } from './dom.mjs';

fakeDom();
const { createGame, maxHpOf, swingOf, wonByKo } = await import('../src/game.js');
const { resultView, resultHtml, createResult, rewardsOf, RESULT_BEAT, RESULT_MUSIC } = await import('../src/result.js');
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
  for (const p of down) state.totals[p === 'p1' ? 'p2' : 'p1'] = maxHpOf(state, p) + state.healed[p];
  state.phase = 'matchEnd';
  state.round = 7;
}

// ---- las marcas las anota la partida ---------------------------------------
{
  const game = await table();
  const player = game.state.turn;
  const longest = Math.max(0, ...game.state.chains[player].runs.map((r) => r.length));
  const swing = swingOf(game.state, player);
  assert.deepEqual(game.state.records[player], { hit: 0, chain: 0 }, 'arranca sin marcas');
  await game.stand();
  assert.equal(game.state.records[player].hit, swing, 'el mejor golpe es el ataque soltado');
  assert.equal(game.state.records[player].chain, swing > 0 ? longest : 0, 'y la cadena, los símbolos de su racha más larga');
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
  const win = resultView(game.state, { seat: 'p1', net: true });
  assert.equal(win.outcome, 'win', 'el que se queda gana, en la ronda que sea');
  assert.match(win.line, /Jugador 2 abandonó/);
  assert.match(resultHtml(win), /confetti/, 'con su escena');
  const lose = resultView(game.state, { seat: 'p2', net: true });
  assert.equal(lose.outcome, 'lose', 'y el que se va pierde');
  assert.deepEqual(lose.cast.map((c) => c.stance), ['idle', 'win'], 'pero no queda tirado');
  console.log('  ✓ abandono: gana el que se queda');
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
  // La estrella: solo si el rival cayó sin llegar a jugar su última chance (K.O.).
  const game = await table({ mode: 'adventure', adventureLevel: 1 });
  finish(game.state, ['p2']);
  assert.equal(wonByKo(game.state), true, 'tumbado sin última chance: K.O.');
  assert.equal(resultView(game.state).star, true, 'se lleva la estrella');
  assert.match(resultHtml(resultView(game.state)), /class="result-star" data-earned="true"/);
  game.state.lastChanceUsed.p2 = true;
  assert.equal(wonByKo(game.state), false, 'si jugó su última chance y no alcanzó, no es K.O.');
  assert.equal(resultView(game.state).star, false, 'pasa el nivel sin estrella');
  assert.equal(resultView(game.state).title, '¡Nivel superado!', 'pero lo pasa igual');
  assert.match(resultHtml(resultView(game.state)), /data-earned="false"[\s\S]*ganale por K\.O\./, 'y dice cómo ganarla');
  const lost = await table({ mode: 'adventure', adventureLevel: 1 });
  finish(lost.state, ['p1']);
  assert.equal(resultView(lost.state).star, null, 'perdiendo no hay estrella que mostrar');
  const cpu = await table({ mode: 'cpu', axie: 'aquatic' });
  finish(cpu.state, ['p2']);
  assert.equal(resultView(cpu.state).star, null, 'ni fuera de la Aventura');
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

// ---- lo que paga cada partida (payout.js, docs/economy.md §3) ----------------
{
  const { payoutOf, MATCH_PAY, FORFEIT_PAY_ROUND, BOSS_PAY } = await import('../src/payout.js');
  const net = await table();
  assert.equal(payoutOf(net.state, { seat: 'p1' }), null, 'mientras se juega no paga nada');
  finish(net.state, ['p2']);
  assert.deepEqual(payoutOf(net.state, { seat: 'p1' }), { amount: MATCH_PAY.ko, why: 'ko' }, 'en red, el K.O. paga el doble');
  assert.deepEqual(payoutOf(net.state, { seat: 'p2' }), { amount: 0, why: 'lose' }, 'perder no paga');
  assert.equal(payoutOf(net.state, { seat: null }), null, 'el que mira no juega');
  net.state.lastChanceUsed.p2 = true;
  assert.deepEqual(payoutOf(net.state, { seat: 'p1' }), { amount: MATCH_PAY.win, why: 'win' },
    'ganarle después de su última chance no es K.O.');
  finish(net.state, ['p1', 'p2']);
  assert.deepEqual(payoutOf(net.state, { seat: 'p1' }), { amount: 0, why: 'tie' }, 'en el empate no cobra nadie');
  assert.deepEqual(payoutOf(net.state, { seat: 'p2' }), { amount: 0, why: 'tie' });

  const early = await table();
  early.forfeit('p2');
  assert.ok(early.state.round < FORFEIT_PAY_ROUND);
  assert.deepEqual(payoutOf(early.state, { seat: 'p1' }), { amount: 0, why: 'early' },
    'abrir una sala y abandonarla enseguida no paga');
  early.state.round = FORFEIT_PAY_ROUND;
  assert.deepEqual(payoutOf(early.state, { seat: 'p1' }), { amount: MATCH_PAY.win, why: 'win' },
    'pasada la ronda 3, el que se queda cobra la victoria (un abandono no es K.O.)');

  for (const mode of ['cpu', 'tutorial']) {
    const g = await table({ mode, axie: 'puffy' });
    finish(g.state, ['p2']);
    assert.deepEqual(payoutOf(g.state), { amount: 0, why: mode === 'cpu' ? 'practice' : 'tutorial' },
      `${mode}: se practica, no se cobra`);
  }

  const adv = await table({ mode: 'adventure', adventureLevel: 3, axie: 'puffy' });
  const fresh = { completedLevels: [1, 2], starredLevels: [1, 2] };
  finish(adv.state, ['p2']);
  assert.deepEqual(payoutOf(adv.state, { adventure: fresh }), { amount: MATCH_PAY.ko, why: 'firstKo' },
    'la primera victoria de un nivel, por K.O.');
  adv.state.lastChanceUsed.p2 = true;
  assert.deepEqual(payoutOf(adv.state, { adventure: fresh }), { amount: MATCH_PAY.win, why: 'first' }, 'y sin K.O.');
  const won = { completedLevels: [1, 2, 3], starredLevels: [1, 2] };
  assert.deepEqual(payoutOf(adv.state, { adventure: won }), { amount: 0, why: 'noStar' },
    'volver a ganarlo sin K.O. no paga: falta la estrella');
  adv.state.lastChanceUsed.p2 = false;
  assert.deepEqual(payoutOf(adv.state, { adventure: won }), { amount: MATCH_PAY.ko - MATCH_PAY.win, why: 'star' },
    'la estrella que faltaba paga lo que faltaba del K.O.');
  assert.deepEqual(payoutOf(adv.state, { adventure: { completedLevels: [1, 2, 3], starredLevels: [1, 2, 3] } }),
    { amount: 0, why: 'replay' }, 'con la estrella ya puesta, nada');
  const lost = await table({ mode: 'adventure', adventureLevel: 3, axie: 'puffy' });
  finish(lost.state, ['p1']);
  assert.deepEqual(payoutOf(lost.state, { adventure: fresh }), { amount: 0, why: 'lose' }, 'perder un nivel no paga');
  // Un jefe paga el doble: la primera victoria, el K.O. y la estrella que faltaba.
  const boss = await table({ mode: 'adventure', adventureLevel: 10, axie: 'puffy' });
  finish(boss.state, ['p2']);
  const nine = { completedLevels: [1, 2, 3, 4, 5, 6, 7, 8, 9], starredLevels: [] };
  assert.deepEqual(payoutOf(boss.state, { adventure: nine }), { amount: MATCH_PAY.ko * BOSS_PAY, why: 'firstKo' }, 'un jefe por K.O., el doble');
  assert.deepEqual(payoutOf(boss.state, { adventure: { ...nine, completedLevels: [...nine.completedLevels, 10] } }),
    { amount: (MATCH_PAY.ko - MATCH_PAY.win) * BOSS_PAY, why: 'star' }, 'y su estrella, el doble');
  console.log('  ✓ lo que paga cada resultado');
}
{
  const { claimPayout, MATCH_PAY } = await import('../src/payout.js');
  const { readProgress, writeProgress, readWallet, writeWallet, levelInfo, LEVEL_UP_SHARDS } = await import('../src/evolution.js');
  writeProgress({ puffy: { axp: 25, evolved: [] } });
  writeWallet({ moonshards: 100 });

  const cpu = await table({ mode: 'cpu', axie: 'puffy' });
  finish(cpu.state, ['p2']);
  const nothing = claimPayout(cpu.state);
  assert.equal(nothing.amount, 0);
  assert.equal(readWallet().moonshards, 100, 'sin nada que pagar no se toca la bolsa');
  assert.equal(readProgress().puffy.axp, 25, 'ni la AXP');
  assert.equal(readProgress().puffy.played, 1, 'pero la partida cuenta para el Axie: es lo que dice cuáles usás más');

  // El Axie juega con sus evoluciones (`'puffy~ears'`): la AXP es del Axie del roster.
  const adv = await table({ mode: 'adventure', adventureLevel: 1, axie: 'puffy~ears' });
  finish(adv.state, ['p2']);
  const pay = claimPayout(adv.state, { adventure: { completedLevels: [], starredLevels: [] } });
  assert.equal(pay.why, 'firstKo');
  assert.equal(pay.axie, 'puffy');
  assert.deepEqual([pay.axp, pay.from, pay.to], [MATCH_PAY.ko, 25, 25 + MATCH_PAY.ko]);
  assert.deepEqual(pay.levels, [2], 'con 45 de AXP pasa al nivel 2');
  assert.equal(pay.shards, MATCH_PAY.ko + LEVEL_UP_SHARDS, 'y subir de nivel paga 5 más');
  assert.equal(pay.purse, 100 + pay.shards);
  assert.equal(readWallet().moonshards, pay.purse, 'los Moonshards quedan guardados');
  assert.equal(readProgress().puffy.axp, 45, 'y la AXP también');
  assert.equal(levelInfo(readProgress().puffy.axp).level, 2);
  assert.equal(readProgress().puffy.played, 2, 'cada partida terminada suma una, con o sin evoluciones');
  console.log('  ✓ el cobro: Moonshards a la bolsa y AXP al Axie');
}
{
  const { claimPayout } = await import('../src/payout.js');
  const { writeProgress, writeWallet } = await import('../src/evolution.js');
  writeProgress({ puffy: { axp: 25, evolved: [] } });
  writeWallet({ moonshards: 0 });
  const adv = await table({ mode: 'adventure', adventureLevel: 1, axie: 'puffy' });
  finish(adv.state, ['p2']);
  const pay = claimPayout(adv.state, { adventure: { completedLevels: [], starredLevels: [] } });
  const view = resultView(adv.state, { pay });
  assert.deepEqual(view.pay.levels, [2]);
  const html = resultHtml(view);
  assert.match(html, /class="result-pay o-panel"/, 'el botín va en su tabla');
  assert.match(html, /data-gain="shards"[\s\S]*data-count="25"/, 'los Moonshards, con lo de subir de nivel');
  assert.match(html, /data-gain="axp"[\s\S]*LVL <b>2<\/b>[\s\S]*data-count="20"/, 'la AXP, con el nivel al que llegó');
  assert.match(html, /AXP de Puffy/);
  assert.match(html, /Primera victoria del nivel, por K\.O\./, 'de dónde sale');
  assert.match(html, /¡Puffy subió al nivel 2!/, 'y la cinta del nivel nuevo');
  assert.doesNotMatch(html, /Se abrió una evolución/, 'el 2 no abre evolución');
  const ten = resultHtml(resultView(adv.state, { pay: { ...pay, levels: [10] } }));
  assert.match(ten, /Se abrió una evolución/, 'el 10 sí');

  assert.equal(resultView(adv.state, { seat: null, net: true, pay }).pay, null, 'el que mira una sala no cobra');
  const practice = resultHtml(resultView(adv.state, { pay: { amount: 0, why: 'practice', levels: [] } }));
  assert.doesNotMatch(practice, /result-pay o-panel|result-loot/, 'sin cobro no hay tabla');
  assert.match(practice, /class="result-pay-note">Contra la CPU se practica/, 'pero dice por qué');
  const tutorial = resultHtml(resultView(adv.state, { pay: { amount: 0, why: 'tutorial', levels: [] } }));
  assert.doesNotMatch(tutorial, /result-pay-note/, 'el tutorial no dice nada');
  assert.doesNotMatch(resultHtml(resultView(adv.state, { pay: { why: '<b>', amount: 'x' } })), /<b>/,
    'un motivo desconocido no se escribe');

  // Lo que agenda el reproductor con el botín.
  const heard = [];
  const node = document.getElementById('result');
  const screen = createResult(node, { audio: { sfx: (key, opts) => heard.push({ key, ...opts }), music() {} } });
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = () => 0;
  screen.show(adv.state, { wait: 1000, pay });
  globalThis.setTimeout = realTimeout;
  assert.equal(node.style.props['--t-acts'], `${RESULT_BEAT.up + 500}ms`, 'las puertas esperan a que salte la medalla');
  assert.equal(node.style.props['--t-up'], `${RESULT_BEAT.up}ms`, 'el CSS sabe cuándo');
  assert.equal(heard.filter((h) => h.key === 'take').length, 2, 'los dos casilleros suenan al caer');
  assert.deepEqual(heard.filter((h) => h.key === 'evolve').map((h) => h.delay), [1000 + RESULT_BEAT.up],
    'y el nivel nuevo, cuando salta la medalla');
  screen.hide();
  console.log('  ✓ el botín en la pantalla del final');
}

// ---- el reproductor ---------------------------------------------------------
{
  const game = await table();
  const s = game.state;
  const heard = [];
  const node = document.getElementById('result');
  const tracks = [];
  const screen = createResult(node, {
    audio: { sfx: (key, opts) => heard.push({ key, ...opts }), music: (list) => tracks.push(list) },
  });

  finish(s, ['p1', 'p2']);
  s.rewards = { p2: [{ name: 'Amuleto', icon: 'Icons/power-leaf.png' }, { name: 'Huevo', icon: 'Icons/power-egg.png' }] };
  // Lo que la pantalla agenda, anotado en vez de esperado.
  const agenda = [];
  const realTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms) => agenda.push({ fn, ms });
  screen.show(s, { seat: 'p2', net: true, actions: '<button data-action="leave"></button>', wait: 2000 });
  globalThis.setTimeout = realTimeout;
  // La pantalla del final ya no es la partida: apagado el remate, vuelve el tema del
  // menú, y sigue sin cortes al volver a la portada.
  assert.ok(RESULT_MUSIC > RESULT_BEAT.fx + 1500, 'la música vuelve cuando el remate ya se apagó');
  agenda.filter((t) => t.ms === 2000 + RESULT_MUSIC).forEach((t) => t.fn());
  assert.deepEqual(tracks, ['menu'], 'la pantalla del final pone la música del menú');
  assert.equal(node.hidden, false);
  assert.equal(node.dataset.outcome, 'tie');
  assert.equal(node.style.props['--wait'], '2000ms', 'el CSS espera lo mismo que el efecto');
  assert.equal(node.style.props['--t-fx'], `${RESULT_BEAT.fx}ms`);
  assert.equal(node.style.props['--t-acts'], `${RESULT_BEAT.loot + 2 * 350 + 250}ms`,
    'con botín, las puertas esperan al último objeto');
  assert.deepEqual(heard[0], { key: 'tie', delay: 2000 + RESULT_BEAT.fx }, 'el remate suena con el efecto');
  assert.equal(heard.filter((h) => h.key === 'take').length, 2, 'y cada objeto al caer');

  heard.length = 0;
  s.forfeit = { by: 'p1', winner: 'p2' };
  screen.show(s, { seat: 'p2', net: true });
  assert.equal(node.dataset.outcome, 'win', 'el abandono del otro se ve como victoria');
  assert.equal(heard.filter((h) => h.key === 'win').length, 1, 'y suena como tal');

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
