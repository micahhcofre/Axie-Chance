// Las misiones y el pase de temporada (ver `missions.js` y docs/missions.md): los pozos,
// el calendario, el sorteo del día y de la semana, cómo cuenta cada evento, el cobro, el
// pase, lo que cuenta la partida (`state.stats`, ver `game.js`) y lo guardado.
import assert from 'node:assert/strict';

const memoria = new Map();
globalThis.localStorage = {
  getItem: (k) => memoria.get(k) ?? null,
  setItem: (k, v) => memoria.set(k, String(v)),
  removeItem: (k) => memoria.delete(k),
};

const {
  MISSIONS, MISSIONS_KEY, MISSION_PAY, DAILY_POOLS, WEEKLY_SLOTS, DAILY_SWAPS,
  SEASON_DAYS, SEASON_EPOCH, PASS_TIERS, TIER_POINTS, PASS_BONUS_POINTS,
  taskPay, taskReward, taskText, taskDone,
  dayIndex, weekIndex, seasonIndex, weekClass, resetsIn,
  dailyPicks, weeklyPicks, freshMissions, cleanMissions, rollMissions, trackMissions,
  claimTask, claimTier, claimBonus, swapTask, tierReward, passTier, passBonusEarned,
  sumRewards, payReward, matchEvent, missionContext,
  readMissions, writeMissions, refreshMissions, recordMissions, recordMatch,
  claimMission, claimPassTier, claimPassBonus, swapMission,
} = await import('../src/missions.js');
const { CANONICAL_CLASSES, makeCard, makeRng, TUNING } = await import('../src/data.js');
const { createGame, trickTargetsFor, matchResult, maxHpOf } = await import('../src/game.js');
const { playCard } = await import('../src/rules.js');
const { readWallet, writeWallet, readProgress, writeProgress, LEVEL_UP_SHARDS } = await import('../src/evolution.js');
const { writeLoadout } = await import('../src/loadout.js');
const { setLang } = await import('../src/i18n.js');

const idle = () => new Promise((r) => setTimeout(r, 0));
const settle = async (n = 12) => { for (let i = 0; i < n; i++) await idle(); };

/** Un miércoles de la primera semana, al mediodía. */
const NOW = new Date(2026, 9, 7, 12);
const DAY = dayIndex(NOW);
const at = (days, hour = 12) => new Date(2026, 9, 7 + days, hour);

/** Lo que puede salir con todo abierto. */
const ALL = { net: true, levels: 30, boss: true, bag: 10, loose: 10, pulls: 100 };

/** Una partida terminada, con lo que haga falta cambiar. */
const ev = (over = {}) => ({
  type: 'match', mode: 'cpu', net: false, adventure: false, won: false, ko: false, tie: false,
  hp: 50, damage: 0, healed: 0, chain: 0, hit: 0, attacks: [], busts: 0,
  powers: Object.fromEntries(CANONICAL_CLASSES.map((c) => [c, 0])), powerCards: 0,
  picks: 0, stacks: 0, oneMoreKo: 0, bleed: 0, poison: 0, thorns: 0, direct: 0, stolen: 0,
  axie: 'buba', cls: 'beast', level: null, boss: false, extras: 0,
  ...over,
});

/** Un estado del día `DAY` con estas misiones, sin avanzar. */
const withTasks = (daily, weekly, pass = {}) => cleanMissions({
  day: DAY, daily: daily.map((id) => ({ id, n: 0 })),
  week: weekIndex(DAY), weekly: weekly.map((id) => ({ id, n: 0 })),
  pass: { season: seasonIndex(DAY), points: 0, claimed: [], bonus: 0, ...pass },
});
const DAILY = ['d-play', 'd-damage200', 'd-win3'];
const WEEKLY = ['w-axies', 'w-craft', 'k-win-beast', 'w-levels', 'c-streak'];

// ---- las misiones -----------------------------------------------------------------
{
  const tasks = Object.values(MISSIONS);
  const count = (pool) => tasks.filter((t) => t.pool === pool).length;
  assert.deepEqual(
    ['easy', 'medium', 'hard', 'battle', 'class', 'collection', 'challenge'].map(count),
    [7, 8, 7, 10, 18, 8, 8],
    'los pozos del plan',
  );
  for (const cls of CANONICAL_CLASSES) {
    assert.deepEqual(tasks.filter((t) => t.cls === cls).map((t) => t.id), [`k-win-${cls}`, `k-draw-${cls}`, `k-sig-${cls}`],
      `tres de la clase ${cls}`);
  }
  for (const t of tasks) {
    assert.ok(['axp', 'ms'].includes(t.pays), `${t.id} paga AXP o Moonshards`);
    assert.ok(Number.isInteger(t.target) && t.target >= 1, `${t.id} tiene meta`);
    assert.ok(['match', 'craft', 'merge', 'scrap', 'levelUp'].includes(t.on), `${t.id} sabe qué la mueve`);
    assert.ok(taskPay(t), `${t.id} sabe cuánto paga`);
    // Cuenta sin romperse con una partida cualquiera, y nunca para atrás.
    if (t.count) {
      for (const e of [ev(), ev({ won: true, ko: true, net: true, adventure: true, boss: true, damage: 999, attacks: [9, 9] })]) {
        const n = t.count(t.on === 'match' ? e : { type: t.on, n: 2 });
        assert.ok(Number.isFinite(n) && n >= 0, `${t.id} cuenta un número`);
      }
    }
  }
  // Los textos, en los dos idiomas, con sus números puestos. Sin `document` el idioma es
  // siempre español (ver `currentLang`): se finge una pantalla.
  globalThis.document = {};
  for (const lang of ['es', 'en']) {
    setLang(lang);
    for (const t of tasks) {
      const text = taskText(t);
      assert.ok(text && !/[{}]/.test(text), `${t.id} en ${lang}: "${text}"`);
    }
  }
  setLang('en');
  assert.equal(taskText(MISSIONS['w-chains']), 'Attack 10 times with a chain of 5 or more');
  assert.equal(taskText(MISSIONS['k-win-plant']), 'Win 5 battles with a Plant Axie');
  setLang('es');
  assert.equal(taskText(MISSIONS['d-chain7']), 'Atacá con una cadena de 7 o más');
  assert.equal(taskText(MISSIONS['k-draw-bird']), 'Robá 10 cartas con poder de Pájaro');
  delete globalThis.document;
  // Lo que paga cada cosa: 50 puntos por día y 340 por semana (ver docs/missions.md).
  assert.equal(DAILY_POOLS.reduce((t, p) => t + MISSION_PAY[p].points, 0), 50);
  assert.equal(WEEKLY_SLOTS.reduce((t, s) => t + taskPay({ pool: s }).points, 0), 340);
  assert.deepEqual(taskReward(MISSIONS['d-play']), { axp: 10 });
  assert.deepEqual(taskReward(MISSIONS['d-win']), { moonshards: 5 });
  assert.deepEqual(taskReward(MISSIONS['c-streak']), { moonshards: 50 });
  assert.deepEqual(taskReward(MISSIONS['k-win-bug']), { axp: 50 });
}
console.log('✓ las misiones ok');

// ---- el calendario ----------------------------------------------------------------
{
  assert.equal(new Date(2026, 9, 5).getDay(), 1, 'la primera temporada arranca un lunes');
  assert.equal(dayIndex(new Date(2026, 9, 5, 0, 0)), SEASON_EPOCH, 'el día cambia a la medianoche de esta máquina');
  assert.equal(dayIndex(new Date(2026, 9, 5, 23, 59)), SEASON_EPOCH);
  assert.equal(dayIndex(new Date(2026, 9, 6, 0, 0)), SEASON_EPOCH + 1);
  assert.deepEqual([0, 6, 7, 13, 14, -1].map((d) => weekIndex(SEASON_EPOCH + d)), [0, 0, 1, 1, 2, -1], 'de lunes a domingo');
  assert.deepEqual([0, 27, 28, 55, 56, -30].map((d) => seasonIndex(SEASON_EPOCH + d)), [1, 1, 2, 2, 3, 1],
    `${SEASON_DAYS} días por temporada; antes de la primera, la primera`);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, -1].map(weekClass),
    ['plant', 'beast', 'aquatic', 'bird', 'bug', 'reptile', 'plant', 'reptile'], 'la clase de la semana rota en el orden canónico');
  const now = new Date(2026, 9, 5, 18);
  const left = resetsIn(now);
  assert.equal(left.day, 6 * 3600000, 'seis horas a la medianoche');
  assert.equal(left.week, new Date(2026, 9, 12) - now, 'hasta el lunes que viene');
  assert.equal(left.season, new Date(2026, 10, 2) - now, 'hasta el lunes en que arranca la segunda');
}
console.log('✓ el calendario ok');

// ---- el sorteo --------------------------------------------------------------------
{
  for (let d = DAY - 30; d < DAY + 30; d++) {
    const picks = dailyPicks(d, ALL);
    assert.deepEqual(picks, dailyPicks(d, ALL), 'el mismo día, las mismas');
    assert.deepEqual(picks.map((id) => MISSIONS[id].pool), DAILY_POOLS, 'una fácil, una media, una difícil');
    assert.ok(picks.filter((id) => MISSIONS[id].net).length <= 1, 'nunca dos de multijugador');
    const solo = dailyPicks(d, { ...ALL, net: false });
    assert.ok(solo.every((id) => !MISSIONS[id].net), 'sin salas, ninguna de multijugador');
    assert.ok(!dailyPicks(d, { ...ALL, pulls: 0 }).includes('d-craft'), 'sin con qué crear, nada del Taller');
    const yesterday = dailyPicks(d - 1, ALL);
    assert.ok(dailyPicks(d, ALL, yesterday).every((id) => !yesterday.includes(id)), 'no repite las del día anterior');
  }
  const shapes = new Set();
  for (let w = -12; w < 48; w++) {
    const picks = weeklyPicks(w, ALL);
    assert.deepEqual(picks, weeklyPicks(w, ALL));
    assert.deepEqual(picks.map((id) => MISSIONS[id].pool), WEEKLY_SLOTS, 'dos de pelea, la de clase, una de colección y un desafío');
    assert.equal(new Set(picks).size, picks.length, 'sin repetir');
    assert.equal(MISSIONS[picks[2]].cls, weekClass(w), 'la de clase es de la clase de la semana');
    shapes.add(picks[2].split('-').slice(0, 2).join('-'));
    assert.ok(picks.filter((id) => MISSIONS[id].net).length <= 1);
    const last = weeklyPicks(w - 1, ALL);
    assert.ok(weeklyPicks(w, ALL, last).every((id) => !last.includes(id)), 'no repite las de la semana anterior');
    // Lo que no se puede hacer todavía no sale.
    const fresh = weeklyPicks(w, { net: false, levels: 1, boss: false, bag: 0, loose: 0, pulls: 0 });
    for (const id of ['c-boss', 'w-levels', 'w-fuse', 'w-scrap', 'w-craft', 'w-extras', 'w-net', 'c-netko']) {
      assert.ok(!fresh.includes(id), `${id} no sale para el que recién empieza`);
    }
  }
  assert.deepEqual([...shapes].sort(), ['k-draw', 'k-sig', 'k-win'], 'las tres formas de la de clase salen');
}
console.log('✓ el sorteo ok');

// ---- renovar ------------------------------------------------------------------------
{
  const first = rollMissions(freshMissions(), NOW, ALL);
  assert.deepEqual(first.due, [], 'la primera vez no hay nada que pagar');
  const s = first.state;
  assert.equal(s.day, DAY);
  assert.equal(s.week, weekIndex(DAY));
  assert.deepEqual(s.pass, { season: 1, points: 0, claimed: [], bonus: 0 });
  assert.equal(s.daily.length, 3);
  assert.equal(s.weekly.length, 5);
  assert.ok([...s.daily, ...s.weekly].every((t) => t.n === 0 && !t.claimed));
  assert.equal(rollMissions(s, at(0, 23), ALL).state, s, 'el mismo día no cambia nada');

  // Una cumplida sin cobrar se paga sola al día siguiente.
  const done = { ...s, daily: s.daily.map((t, i) => (i === 0 ? { ...t, n: MISSIONS[t.id].target } : t)) };
  const next = rollMissions(done, at(1), ALL);
  assert.deepEqual(next.due, [taskReward(MISSIONS[s.daily[0].id])], 'lo cumplido sin cobrar');
  assert.equal(next.state.day, DAY + 1);
  assert.deepEqual(next.state.prev.daily, s.daily.map((t) => t.id), 'se acuerda de las de ayer');
  assert.ok(next.state.daily.every((t) => !next.state.prev.daily.includes(t.id)), 'y no las repite');
  assert.equal(next.state.weekly, s.weekly, 'las de la semana siguen');
  const claimed = { ...done, daily: done.daily.map((t, i) => (i === 0 ? { ...t, claimed: true } : t)) };
  assert.deepEqual(rollMissions(claimed, at(1), ALL).due, [], 'lo ya cobrado no se paga dos veces');

  // El lunes, las de la semana.
  const monday = rollMissions(s, new Date(2026, 9, 12, 9), ALL);
  assert.equal(monday.state.week, weekIndex(DAY) + 1);
  assert.equal(MISSIONS[monday.state.weekly[2].id].cls, 'beast', 'la segunda semana es de Bestia');

  // La temporada nueva paga lo que quedó del pase y arranca de cero.
  const pass = { ...s, pass: { season: 1, points: 3 * TIER_POINTS, claimed: [2], bonus: 0 } };
  const season = rollMissions(pass, new Date(2026, 10, 2, 9), ALL);
  assert.deepEqual(season.state.pass, { season: 2, points: 0, claimed: [], bonus: 0 });
  assert.deepEqual(season.due.slice(-2), [tierReward(1), tierReward(3)], 'los escalones alcanzados sin cobrar');
}
console.log('✓ renovar ok');

// ---- contar -------------------------------------------------------------------------
{
  let s = withTasks(DAILY, WEEKLY);
  let out = trackMissions(s, ev({ won: true, damage: 120 }));
  s = out.state;
  const n = (list) => list.map((t) => t.n);
  assert.deepEqual(n(s.daily), [1, 120, 1], 'jugar, daño y victorias');
  assert.deepEqual(n(s.weekly), [1, 0, 1, 0, 1], 'un Axie, nada del Taller, Bestia y la racha');
  assert.deepEqual(out.done, []);
  assert.equal(s.pass.points, 0);

  // Perder corta la racha; jugar dos cumple la primera y suma sus puntos.
  out = trackMissions(s, ev({ damage: 500 }));
  s = out.state;
  assert.deepEqual(n(s.daily), [2, 200, 1], 'el daño topea en la meta');
  assert.equal(s.weekly[4].n, 0, 'la racha vuelve a cero');
  assert.deepEqual(out.done, [{ scope: 'daily', index: 0, id: 'd-play' }, { scope: 'daily', index: 1, id: 'd-damage200' }]);
  assert.equal(s.pass.points, MISSION_PAY.easy.points + MISSION_PAY.medium.points, 'los puntos entran al cumplirla');
  const again = trackMissions(s, ev({ damage: 500 }));
  assert.equal(again.state.pass.points, s.pass.points, 'una cumplida no vuelve a sumar');
  assert.deepEqual(again.done, []);

  // Las que juntan sin repetir: el mismo Axie no cuenta dos veces, uno nuevo sí.
  s = trackMissions(s, ev({ won: true })).state;
  assert.equal(s.weekly[0].n, 1, 'Buba otra vez no suma');
  s = trackMissions(s, ev({ won: true, axie: 'momo', cls: 'bird' })).state;
  assert.deepEqual(s.weekly[0].seen, ['buba', 'momo']);
  assert.equal(s.weekly[2].n, 2, 'Momo no es de Bestia');
  s = trackMissions(s, ev({ won: true, adventure: true, level: 3 })).state;
  s = trackMissions(s, ev({ won: true, adventure: true, level: 3 })).state;
  assert.equal(s.weekly[3].n, 1, 'el mismo nivel de la Aventura cuenta una vez');

  // El Taller solo lo mueve el Taller.
  s = trackMissions(s, { type: 'craft', n: 4 }).state;
  assert.equal(s.weekly[1].n, 4);
  assert.equal(trackMissions(s, null).state, s, 'sin evento no pasa nada');
  assert.equal(trackMissions(s, { type: 'nada' }).state.weekly[1].n, 4);
}
console.log('✓ contar ok');

// ---- cobrar y el pase ---------------------------------------------------------------------
{
  let s = withTasks(DAILY, WEEKLY);
  assert.equal(claimTask(s, 'daily', 0).reward, null, 'sin cumplir no se cobra');
  s = trackMissions(s, ev()).state;
  s = trackMissions(s, ev()).state;
  const got = claimTask(s, 'daily', 0);
  assert.deepEqual(got.reward, { axp: MISSION_PAY.easy.axp });
  assert.equal(got.state.daily[0].claimed, true);
  assert.equal(claimTask(got.state, 'daily', 0).reward, null, 'dos veces no');
  assert.equal(claimTask(s, 'pass', 0).reward, null, 'solo del día o de la semana');
  assert.equal(claimTask(s, 'daily', 9).reward, null);

  // El pase: lo que da cada escalón y lo que suma la temporada entera.
  assert.deepEqual(
    [1, 2, 3, 5, 10, 12, 15, 22, 32, 39, 40].map(tierReward),
    [{ basic: 2 }, { moonshards: 10 }, { basic: 1 }, { basic: 3 }, { basic: 5, moonshards: 40 }, { moonshards: 15 },
      { basic: 3 }, { moonshards: 20 }, { moonshards: 25 }, { basic: 1 }, { gold: 1, moonshards: 100 }],
  );
  const all = sumRewards(Array.from({ length: PASS_TIERS }, (_, i) => tierReward(i + 1)));
  assert.deepEqual(all, { basic: 44, moonshards: 500, gold: 1 }, 'lo de docs/missions.md: la de oro, solo en el último');
  assert.equal(passTier(TIER_POINTS * 2 + 49), 2);
  assert.equal(passTier(999999), PASS_TIERS, 'no hay escalón 41');
  assert.equal(passBonusEarned(PASS_TIERS * TIER_POINTS + PASS_BONUS_POINTS * 2 + 99), 2);

  let p = { ...s, pass: { ...s.pass, points: 2 * TIER_POINTS } };
  const tier = claimTier(p, 1);
  assert.deepEqual(tier.reward, { basic: 2 });
  assert.deepEqual(tier.state.pass.claimed, [1]);
  assert.equal(claimTier(tier.state, 1).reward, null, 'cobrado');
  assert.equal(claimTier(p, 3).reward, null, 'sin alcanzar');
  for (const bad of [0, 41, 1.5, '1', null]) assert.equal(claimTier(p, bad).reward, null);
  assert.equal(claimBonus(p).reward, null, 'sin pasar el último no hay llaves de más');
  p = { ...s, pass: { ...s.pass, points: PASS_TIERS * TIER_POINTS + PASS_BONUS_POINTS * 2 } };
  const bonus = claimBonus(p);
  assert.deepEqual(bonus.reward, { basic: 2 });
  assert.equal(claimBonus(bonus.state).reward, null);

  // Cambiar una del día: una vez, por otra del mismo pozo, y no una cumplida.
  const swap = swapTask(withTasks(DAILY, WEEKLY), 2, ALL);
  assert.ok(swap.swapped);
  assert.equal(MISSIONS[swap.state.daily[2].id].pool, 'hard');
  assert.ok(!DAILY.includes(swap.state.daily[2].id));
  assert.equal(swap.state.swaps, DAILY_SWAPS);
  assert.equal(swapTask(swap.state, 1, ALL).swapped, false, 'una por día');
  assert.equal(swapTask(s, 0, ALL).swapped, false, 'la cumplida no se cambia');

  // Pagar: Moonshards y llaves a la bolsa, AXP al Axie.
  const wallet = { moonshards: 10, keys: { basic: 1, gold: 0 } };
  const paid = payReward(wallet, {}, 'buba', { moonshards: 5, basic: 2, gold: 1, axp: 30 });
  assert.deepEqual(paid.wallet, { moonshards: 15 + LEVEL_UP_SHARDS, keys: { basic: 3, gold: 1 } });
  assert.equal(paid.progress.buba.axp, 30);
  assert.deepEqual(paid.levels, [2], 'subir de nivel paga sus 5');
  assert.deepEqual(payReward(wallet, {}, null, { axp: 30 }).progress, {}, 'sin Axie la AXP no va a ningún lado');
}
console.log('✓ cobrar y el pase ok');

// ---- lo que cuenta la partida ---------------------------------------------------------------
/** Una partida contra la CPU jugada entera: roba hasta cuatro cartas y se planta. */
async function playMatch(seed, setup = {}) {
  const game = createGame({ pace: 0, seed });
  game.newMatch({ difficulty: 'normal', axie: 'buba', ...setup });
  let guard = 0;
  while (game.state.phase !== 'matchEnd') {
    assert.ok(guard++ < 6000, 'la partida no termina');
    const s = game.state;
    if (s.phase === 'draft') {
      if (game.drafting() !== 'p1') { await idle(); continue; }
      if (s.draft.step === 'trick') {
        const [target] = trickTargetsFor(s, 'p1');
        if (target) await game.stealCard(target.uid);
        else await game.skipDraft();
        continue;
      }
      const [card] = game.pickable();
      if (card) await game.takeCard(card.uid);
      else await game.skipDraft();
      continue;
    }
    if (s.phase === 'roundEnd') { await game.nextRound(); continue; }
    if (s.turn === 'p1' && !s.busy) {
      if (s.pendingStack || s.chains.p1.cards.length < 4) await game.hit();
      else await game.stand();
      continue;
    }
    await idle();
  }
  return game;
}

{
  const game = await playMatch(7);
  const s = game.state;
  const stats = s.stats.p1;
  const e = matchEvent(s, 'p1');
  assert.ok(e, 'una partida terminada cuenta');
  assert.equal(e.won, matchResult(s) === 'p1');
  assert.equal(e.picks, s.added.p1.length, 'cada carta que se llevó del centro');
  assert.ok(stats.attacks.length + stats.busts > 0, 'sus turnos: ataques o cortes');
  assert.ok(e.chain <= Math.max(0, ...stats.attacks), 'la cadena más larga sale de sus ataques');
  assert.equal(e.hit, s.records.p1.hit);
  assert.equal(e.damage, s.totals.p1);
  assert.deepEqual([e.axie, e.cls, e.mode, e.net], ['buba', 'beast', 'cpu', false]);
  assert.equal(e.powerCards, Object.values(stats.powers).reduce((t, n) => t + n, 0));
  assert.equal(matchEvent(s, null), null, 'el que mira no juega');
  assert.equal(matchEvent({ ...s, phase: 'turn' }, 'p1'), null, 'sin terminar no cuenta');
  assert.equal(matchEvent({ ...s, mode: 'tutorial' }, 'p1'), null, 'el tutorial no cuenta');
  assert.equal(matchEvent({ ...s, forfeit: { by: 'p2', winner: 'p1' }, round: 3 }, 'p1'), null, 'abandonar temprano no cuenta');
  assert.ok(matchEvent({ ...s, forfeit: { by: 'p2', winner: 'p1' }, round: 4 }, 'p1'), 'desde la ronda 4, sí');
  // Lo que llega de otro navegador se limpia.
  const odd = matchEvent({ ...s, stats: { p1: { attacks: 'x', busts: -3, powers: { beast: 'mucho' }, picks: 2.7 } } }, 'p1');
  assert.deepEqual([odd.attacks, odd.busts, odd.powers.beast, odd.picks], [[], 0, 0, 2]);
  const old = matchEvent({ ...s, stats: undefined }, 'p1');
  assert.deepEqual([old.picks, old.powerCards, old.attacks], [0, 0, []], 'un estado sin cuentas no rompe nada');
}
{
  // Cada cuenta en su lugar: la carta con poder que sale, su daño directo, el corte y el
  // ataque. Se le pone arriba del mazo la carta que se quiere.
  const game = createGame({ pace: 0, seed: 3 });
  game.newMatch({ difficulty: 'normal', axie: 'buba', activePowers: ['feather', 'strength', 'pot', 'snail', 'poison', 'octopus'] });
  await settle();
  const s = game.state;
  assert.equal(s.turn, 'p1', 'contra la CPU abre el jugador');
  const before = { ...s.stats.p1, powers: { ...s.stats.p1.powers } };
  const live = s.chains.p1.cards[0].symbols[0];
  s.decks.p1.push(makeCard([live], 'feather'));
  await game.hit();
  await settle();
  assert.equal(s.stats.p1.powers.bird, (before.powers.bird ?? 0) + 1, 'robó una con poder de Pájaro');
  assert.equal(s.stats.p1.direct, before.direct + TUNING.featherDamage, 'y su pluma pega directo');
  const cut = ['plant', 'beast', 'aquatic', 'bird', 'bug', 'reptile']
    .find((sym) => playCard(s.chains.p1, makeCard([sym])).busted);
  assert.ok(cut, 'hay un símbolo que corta la cadena');
  s.decks.p1.push(makeCard([cut]));
  await game.hit();
  await settle(40);
  assert.equal(game.state.stats.p1.busts, 1, 'el corte cuenta');
  assert.deepEqual(game.state.stats.p1.attacks, [], 'y no es un ataque');
  // El turno siguiente de p1 se planta: un ataque con su racha.
  let guard = 0;
  while (game.state.turn !== 'p1' || game.state.busy) {
    assert.ok(guard++ < 4000);
    if (game.state.phase === 'draft' && game.drafting() === 'p1') await game.skipDraft();
    else if (game.state.phase === 'roundEnd') await game.nextRound();
    else await idle();
  }
  await game.stand();
  await settle(40);
  assert.equal(game.state.stats.p1.attacks.length, 1, 'plantarse es un ataque');
  assert.ok(game.state.stats.p1.attacks[0] >= 1);
}
console.log('✓ lo que cuenta la partida ok');

// ---- lo guardado ----------------------------------------------------------------------
{
  memoria.clear();
  writeLoadout('buba');
  writeWallet({ moonshards: 0 });
  // La primera vez sortea y guarda.
  const first = refreshMissions({ now: NOW, net: true });
  assert.deepEqual(first.due, {});
  assert.ok(memoria.has(MISSIONS_KEY));
  assert.deepEqual(readMissions(), first.state);
  assert.equal(readMissions().net, true, 'se acuerda de si hay salas');

  // Con misiones conocidas: una partida y el Taller.
  writeMissions({ ...withTasks(DAILY, WEEKLY), net: true });
  const game = await playMatch(11);
  const rec = recordMatch(game.state, { seat: 'p1', now: NOW });
  assert.equal(readMissions().daily[0].n, 1, 'la partida cuenta');
  assert.deepEqual(rec.state, readMissions());
  assert.equal(recordMatch(game.state, { seat: null, now: NOW }), null, 'el que mira no');
  recordMatch(game.state, { seat: 'p1', now: NOW });
  assert.equal(readMissions().daily[0].n, 2);
  recordMissions({ type: 'craft', n: 10 }, { now: NOW });
  assert.equal(readMissions().weekly[1].n, 10);

  // Cobrar: la AXP a tu Axie, y lo que suba de nivel cuenta para "Subí de nivel".
  writeProgress({ buba: { axp: 25, evolved: [] } });
  const paid = claimMission('daily', 0, { now: NOW });
  assert.deepEqual(paid.reward, { axp: MISSION_PAY.easy.axp });
  assert.equal(paid.axie, 'buba');
  assert.equal(readProgress().buba.axp, 25 + MISSION_PAY.easy.axp);
  assert.deepEqual(paid.levels, [2]);
  assert.equal(readWallet().moonshards, LEVEL_UP_SHARDS);
  assert.equal(readMissions().daily[0].claimed, true);
  assert.equal(claimMission('daily', 0, { now: NOW }), null, 'dos veces no');
  const crafted = claimMission('weekly', 1, { now: NOW, axie: 'momo' });
  assert.equal(crafted.axie, 'momo', 'la AXP va al Axie que se diga');
  assert.equal(readProgress().momo.axp, MISSION_PAY.weekly.axp);
  assert.equal(claimMission('weekly', 1, { now: NOW, axie: 'nadie' }), null);

  // El pase: las llaves a la bolsa.
  writeMissions({ ...readMissions(), pass: { ...readMissions().pass, points: 2 * TIER_POINTS } });
  assert.deepEqual(claimPassTier(1, { now: NOW }).reward, { basic: 2 });
  assert.equal(readWallet().keys.basic, 2);
  assert.equal(claimPassTier(1, { now: NOW }), null);
  assert.equal(claimPassBonus({ now: NOW }), null);
  writeMissions({ ...readMissions(), pass: { ...readMissions().pass, points: PASS_TIERS * TIER_POINTS + PASS_BONUS_POINTS } });
  assert.deepEqual(claimPassBonus({ now: NOW }).reward, { basic: 1 });
  assert.equal(readWallet().keys.basic, 3);

  // Cambiar una del día.
  assert.ok(swapMission(2, { now: NOW }));
  assert.equal(swapMission(1, { now: NOW }), null, 'una por día');

  // Al día siguiente, lo cumplido sin cobrar se paga solo.
  writeMissions({ ...readMissions(), daily: readMissions().daily.map((t, i) => (i === 1 ? { ...t, n: MISSIONS[t.id].target } : t)) });
  const axp = readProgress().buba.axp;
  const due = refreshMissions({ now: at(1) }).due;
  assert.deepEqual(due, { axp: MISSION_PAY.medium.axp }, 'la media de ayer, al Axie elegido');
  assert.equal(readProgress().buba.axp, axp + MISSION_PAY.medium.axp);
  assert.equal(readMissions().day, DAY + 1);

  // Lo que se lee se limpia.
  memoria.set(MISSIONS_KEY, 'no es json');
  assert.deepEqual(readMissions(), freshMissions());
  const clean = cleanMissions({
    day: DAY, daily: [{ id: 'd-play', n: 99, claimed: true }, { id: 'd-win2', n: 1, claimed: true }, { id: 'd-ko', n: -2 }],
    week: 0, weekly: [{ id: 'w-axies', seen: ['buba', 'buba', 'momo', {}], n: 0 }, { id: 'c-streak', n: 1 }],
    swaps: 7, prev: { daily: ['d-play', 'nada'], weekly: 3 }, net: 'sí',
    pass: { season: 1, points: -4, claimed: [3, 3, 0, 41, 1], bonus: 'x' },
  });
  assert.deepEqual(clean.daily, [
    { id: 'd-play', n: 2, claimed: true },
    { id: 'd-win2', n: 1, claimed: false },
    { id: 'd-ko', n: 0, claimed: false },
  ], 'topea en la meta y no se cobra lo que no se cumplió');
  assert.deepEqual(clean.weekly[0], { id: 'w-axies', n: 2, seen: ['buba', 'momo'], claimed: false });
  assert.equal(clean.swaps, DAILY_SWAPS);
  assert.deepEqual(clean.prev, { daily: ['d-play'], weekly: [] });
  assert.equal(clean.net, false);
  assert.deepEqual(clean.pass, { season: 1, points: 0, claimed: [1, 3], bonus: 0 });
  const broken = cleanMissions({ day: DAY, daily: [{ id: 'w-play', n: 0 }], week: 0, weekly: [{ id: 'nada' }] });
  assert.deepEqual([broken.day, broken.daily, broken.week, broken.weekly], [null, [], null, []],
    'una lista rota se vuelve a sortear');

  // Lo que dice qué puede salir.
  memoria.clear();
  writeWallet({ moonshards: 25, keys: { basic: 1, gold: 1 } });
  const ctx = missionContext(true);
  assert.deepEqual([ctx.net, ctx.levels, ctx.boss, ctx.pulls], [true, 1, false, 4]);
  assert.ok(ctx.bag > 0 && ctx.loose === ctx.bag, 'el paquete de bienvenida, suelto');
}
console.log('✓ lo guardado ok');

// ---- el panel (`missions-view.js`): lo que se pinta ----------------------------------
{
  const { boardHtml, passHtml, claimableOf, leftText, rewardHtml, keyIcon } = await import('../src/missions-view.js');
  assert.equal(leftText(8 * 60000), '8 min');
  assert.equal(leftText(5 * 3600000 + 12 * 60000), '5 h 12 min');
  assert.equal(leftText(3 * 3600000), '3 h');
  assert.equal(leftText(27 * 86400000 + 5 * 3600000), '27 d 5 h');
  assert.equal(leftText(1), '1 min', 'nunca dice cero');
  assert.match(rewardHtml({ moonshards: 40, gold: 1 }), /data-key="gold"[\s\S]*#ic-moon[\s\S]*>40</, 'las llaves primero, después la luna');
  assert.match(rewardHtml({ basic: 3 }), />×3</);
  assert.match(rewardHtml({ axp: 25 }), /AXP[\s\S]*>25</);
  assert.match(keyIcon('power'), /data-key="power"[\s\S]*#ic-key/);

  let s = withTasks(DAILY, WEEKLY);
  s = trackMissions(s, ev()).state;
  s = trackMissions(s, ev()).state;
  s = { ...s, pass: { ...s.pass, points: 3 * TIER_POINTS + 20, claimed: [1] } };
  assert.deepEqual(claimableOf(s), { daily: 1, weekly: 0, tiers: 2, bonus: 0, total: 3 });
  const html = boardHtml(s, { tab: 'daily', now: NOW });
  assert.equal((html.match(/class="qb-task"/g) ?? []).length, 3, 'las tres del día');
  assert.match(html, /data-state="done"[\s\S]*data-claim="daily:0"/, 'la cumplida se cobra');
  assert.equal((html.match(/data-swap=/g) ?? []).length, 2, 'las otras dos se pueden cambiar');
  assert.match(html, /Jugá 2 batallas/);
  assert.match(html, /data-open-pass[\s\S]*<b>3<\/b>[\s\S]*20\/50/, 'la tira del pase: escalón 3 y 20 de 50');
  assert.doesNotMatch(html, /data-tab="pass"/, 'en el panel el pase es la tira, no una pestaña');
  const weekly = boardHtml(s, { tab: 'weekly', now: NOW });
  assert.equal((weekly.match(/class="qb-task"/g) ?? []).length, 5);
  assert.doesNotMatch(weekly, /data-swap=/, 'las de la semana no se cambian');
  const claimed = boardHtml(claimTask(s, 'daily', 0).state, { now: NOW });
  assert.match(claimed, /data-state="claimed"[\s\S]*qb-check/);
  const sheet = boardHtml(s, { tab: 'pass', now: NOW, sheet: true, wallet: { moonshards: 0, keys: { basic: 2, gold: 1 } } });
  assert.match(sheet, /data-tab="pass"/, 'en la hoja, el pase es una pestaña');
  assert.equal((sheet.match(/class="qp-tier"/g) ?? []).length, PASS_TIERS, 'los 40 escalones');
  assert.deepEqual([...sheet.matchAll(/data-tier="(\d+)"/g)].map((m) => Number(m[1])), [2, 3], 'se cobran los alcanzados sin cobrar');
  assert.match(sheet, /data-claim-all/, 'con dos o más, cobrar todo');
  assert.match(sheet, /data-next="true"/);
  assert.match(sheet, /Tus llaves/);
  assert.match(passHtml({ ...s, pass: { ...s.pass, points: PASS_TIERS * TIER_POINTS + PASS_BONUS_POINTS } }, { now: NOW }), /data-bonus/, 'pasado el 40, la llave de más');
}
console.log('✓ el panel ok');

console.log('✓ misiones ok');
