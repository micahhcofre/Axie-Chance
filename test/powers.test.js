// Los poderes de las cartas del centro, uno por uno.
//
// Cada prueba arma a mano la cadena del jugador —con la carta del poder adentro— y
// suelta el ataque (o roba la carta), que es el momento en que resuelven. Se mira el
// estado que queda puesto, no el registro: lo que importa es que el próximo golpe
// cuente bien. Todos son números fijos por copia: dos cartas del mismo poder en la
// misma mano suman el doble.
import assert from 'node:assert/strict';
import {
  createGame, TUNING, hpOf, powerBeat, projectedHit, swingOf, pointsOf,
  draftableFor, canRenewFor, trickTargetsFor, eggsLeft, ownedBy,
} from '../src/game.js';
import { emptyChain, playCard, scoreChain, survivalOdds } from '../src/rules.js';
import { CLASS_POWERS, MOMENTS, NEUTRAL_POWERS, POWERS, makeJelly } from '../src/data.js';

const idle = () => new Promise((r) => setTimeout(r, 0));

let uid = 10_000;
/** Una carta suelta, con o sin poder. Alcanza con `symbols` y `power`: el resto del
 *  juego no le mira nada más a una carta que ya está en la mesa. */
const card = (symbols, power = null) => ({ uid: uid++, symbols, power, key: `t${uid}` });
const chainOf = (...cards) => cards.reduce(playCard, emptyChain());

/**
 * Una partida detenida en el turno del jugador, con la cadena que se le pida ya
 * puesta. `axie: 'aquatic'` fija su símbolo; la CPU juega cualquier otra clase.
 */
async function atPlayerTurn(chain) {
  const game = createGame({ pace: 0 });
  game.newMatch({ difficulty: 'normal', axie: 'aquatic' });
  await idle();
  assert.equal(game.state.turn, 'p1', 'arranca el jugador');
  if (chain) game.state.chains.p1 = chain;
  return game;
}

/** Suelta el ataque con `chain` después de `setup(state)`, y devuelve la partida. */
async function standWith(chain, setup = () => {}) {
  const game = await atPlayerTurn(chain);
  setup(game.state);
  await game.stand();
  await idle();
  return game;
}

/** Roba `drawn` (la pone arriba del mazo) con `chain` en la mesa. */
async function drawWith(chain, drawn, setup = () => {}) {
  const game = await atPlayerTurn(chain);
  setup(game.state);
  game.state.decks.p1.push(drawn);
  await game.hit();
  await idle();
  return game;
}

// Una cadena que conecta: pez y pájaro abren, y cada carta con poder alarga el pez.
const hitting = (...powered) => chainOf(
  card(['aquatic', 'bird']),
  card(['aquatic', 'plant']),
  ...powered.map((power) => card(['aquatic'], power)),
);
// Una carta que corta cualquier cadena de pez.
const breaker = () => card(['bug', 'reptile']);

// --- el catálogo -------------------------------------------------------------
{
  for (const [cls, ids] of Object.entries(CLASS_POWERS)) {
    for (const id of ids) {
      assert.ok(POWERS[id], `${id} existe`);
      assert.equal(POWERS[id].symbol, cls, `${id} es de ${cls}`);
      assert.ok(POWERS[id].note && POWERS[id].tip, `${id} tiene su texto`);
    }
  }
  for (const ids of Object.values(CLASS_POWERS)) assert.equal(ids.length, 5, 'cinco por clase');
  console.log('  ✓ catálogo');

  // Cada poder tiene su categoría (el momento en que se activa), y su texto no la
  // repite: la etiqueta va siempre al lado y ya dice cuándo salta.
  const repeats = /apenas la robás|al robarla|al plantarte|si te cortás|aunque (después )?te cortes|gratis/i;
  for (const p of Object.values(POWERS)) {
    assert.ok(MOMENTS[p.moment], `${p.id} tiene categoría`);
    assert.doesNotMatch(p.note, repeats, `${p.id}: el texto no repite su etiqueta`);
    assert.doesNotMatch(p.tip, repeats, `${p.id}: el cartel no repite su etiqueta`);
  }
  console.log('  ✓ categorías (al robar, al atacar, al cortarte)');
}

// ==== Pájaro: al robarla o al cortarte =========================================

// --- Feather Earring: daño directo al robarla, aunque corte --------------------
{
  const game = await drawWith(hitting(), card(['aquatic'], 'feather'));
  assert.equal(game.state.totals.p1, TUNING.featherDamage, 'pega apenas sale');
  const bust = await drawWith(hitting(), { ...breaker(), power: 'feather' });
  assert.ok(bust.state.chains.p1.busted || bust.state.phase !== 'turn', 'esa carta cortaba');
  assert.ok(bust.state.totals.p1 >= TUNING.featherDamage, 'y pegó igual');
  console.log('  ✓ Feather Earring');
}

// --- Secret Egg: segunda chance, el jugador decide --------------------------------
{
  const game = await atPlayerTurn(hitting('egg'));
  const s = game.state;
  const before = scoreChain(s.chains.p1).total;
  s.decks.p1.push(breaker());
  const size = s.decks.p1.length;
  assert.equal(eggsLeft(s, 'p1'), 1);
  // Se ve en tres tiempos: la carta corta, el huevo se rompe y la carta vuelve al mazo.
  const owns = ownedBy(s, 'p1');
  const stages = [];
  const off = game.subscribe((st) => {
    if (st.eggSave) stages.push(st.eggSave.stage);
    assert.equal(ownedBy(st, 'p1'), owns, 'la carta en vuelo sigue contando como suya');
  });
  await game.hit();
  await idle();
  off();
  assert.deepEqual(stages, ['bust', 'crack', 'back']);
  assert.equal(s.eggSave, null);
  assert.equal(s.turn, 'p1', 'el turno sigue');
  assert.ok(!s.chains.p1.busted, 'la cadena no se cortó');
  assert.equal(scoreChain(s.chains.p1).total, before, 'queda como estaba');
  assert.equal(s.decks.p1.length, size - 1 + 1, 'la carta que cortaba volvió al mazo');
  assert.equal(eggsLeft(s, 'p1'), 0, 'el huevo se rompió');
  // Y sin huevo, el próximo corte es un corte.
  s.decks.p1.push(breaker());
  await game.hit();
  await idle();
  assert.notEqual(s.turn, 'p1', 'el segundo corte cierra el turno');

  // Dos huevos, dos chances.
  const two = await atPlayerTurn(hitting('egg', 'egg'));
  two.state.decks.p1.push(breaker(), breaker());
  await two.hit();
  await idle();
  await two.hit();
  await idle();
  assert.equal(two.state.turn, 'p1', 'dos cortes perdonados');
  assert.equal(eggsLeft(two.state, 'p1'), 0);
  console.log('  ✓ Secret Egg');
}

// --- Storm Shuriken: si te cortás, daño que frena el escudo ---------------------
{
  const busted = chainOf(card(['aquatic'], 'shuriken'), card(['aquatic'], 'shuriken'), breaker());
  assert.ok(busted.busted);
  const game = await standWith(busted);
  assert.equal(game.state.totals.p1, 2 * TUNING.shuriken, 'cada shuriken pega lo suyo');
  const shielded = await standWith(busted, (s) => { s.status.p2.egg = 10; });
  assert.equal(shielded.state.totals.p1, 2 * TUNING.shuriken - 10, 'el escudo frena primero');
  assert.equal(shielded.state.status.p2.egg, 0, 'y se gasta');
  const fine = await standWith(hitting('shuriken'));
  assert.equal(fine.state.totals.p1, scoreChain(hitting('shuriken')).total, 'sin corte no hace nada');
  console.log('  ✓ Storm Shuriken');
}

// --- Feather Fan: plumas que se guardan y se gastan en el golpe -------------------
{
  const game = await drawWith(hitting(), card(['aquatic'], 'fan'));
  const s = game.state;
  assert.equal(s.status.p1.feathers, 1);
  assert.equal(swingOf(s, 'p1'), scoreChain(s.chains.p1).total + TUNING.fanStep, 'suma al golpe');
  s.totals.p2 = 30;
  await game.stand();
  await idle();
  assert.equal(s.status.p1.feathers, 0, 'se gastan al pegar');
  assert.equal(s.healed.p1, 0, 'y no curan: son solo daño');
  // Se guardan aunque la cadena se corte.
  const bust = await drawWith(hitting(), { ...breaker(), power: 'fan' });
  assert.equal(bust.state.status.p1.feathers, 1, 'el corte no se las lleva');
  console.log('  ✓ Feather Fan');
}

// --- Flamingo Hammer: si te cortás, le rompe todo el escudo al rival ----------------
{
  const busted = chainOf(card(['aquatic'], 'hammer'), breaker());
  const game = await standWith(busted, (s) => { s.status.p2.egg = 18; });
  assert.equal(game.state.status.p2.egg, 0, 'el escudo entero');
  const drawn = await drawWith(hitting(), card(['aquatic'], 'hammer'), (s) => { s.status.p2.egg = 10; });
  assert.equal(drawn.state.status.p2.egg, 10, 'robarlo no hace nada');
  const fine = await standWith(hitting('hammer'), (s) => { s.status.p2.egg = 40; });
  assert.equal(fine.state.status.p2.egg, 40 - scoreChain(hitting('hammer')).total, 'plantado tampoco: solo el golpe');
  // Con el shuriken en la misma mano, el martillo va primero: el shuriken pega entero.
  const both = chainOf(card(['aquatic'], 'hammer'), card(['aquatic'], 'shuriken'), breaker());
  const combo = await standWith(both, (s) => { s.status.p2.egg = 12; });
  assert.equal(combo.state.totals.p1, TUNING.shuriken, 'el shuriken encuentra al rival sin escudo');
  console.log('  ✓ Flamingo Hammer');
}

// ==== Pez: el centro y el mazo del rival ==========================================

// --- Bubble Maker: con cuatro burbujas, la bomba -----------------------------------
{
  const almost = TUNING.bombAt - 1;
  const game = await drawWith(hitting(), card(['aquatic'], 'maker'), (s) => { s.status.p1.bomb = almost; });
  assert.equal(game.state.status.p1.bomb, 0, 'la bomba gasta las burbujas');
  assert.equal(game.state.totals.p1, TUNING.bombDamage, 'y pega');
  const shielded = await drawWith(hitting(), card(['aquatic'], 'maker'), (s) => { s.status.p1.bomb = almost; s.status.p2.egg = 12; });
  assert.equal(shielded.state.totals.p1, TUNING.bombDamage - 12, 'el escudo la frena');
  console.log('  ✓ Bubble Maker');
}

// --- Paralyzing Jellyfish y Red Bubble: el mazo y el centro del rival -----------------
{
  const game = await standWith(hitting('jellyfish', 'redbubble', 'jellyfish'));
  const jellies = game.state.decks.p2.filter((c) => c.jelly);
  assert.equal(jellies.length, 2 * TUNING.jellyCards, 'cada medusa le mete las suyas en el mazo');
  assert.ok(jellies.every((c) => c.symbols.length === 0 && !c.power), 'sin símbolos ni poder');
  assert.equal(game.state.status.p2.noPowers, TUNING.redbubbleCards);

  // Sin poderes hasta llevarse uno sin poder.
  const market = [card(['bird'], 'poison'), card(['bird', 'plant']), card(['bug'], 'leech')];
  const fake = (status) => ({
    phase: 'draft', market, pool: [card(['beast'])], symbols: { p1: 'reptile', p2: 'reptile' },
    draft: { order: ['p1'], index: 0, step: 'normal', mode: null, renewed: { p1: false, p2: false } },
    chains: { p1: { busted: false } }, status: { p1: status },
  });
  assert.equal(draftableFor(fake({ noPowers: 0 }), 'p1').length, 3);
  assert.deepEqual(draftableFor(fake({ noPowers: 1 }), 'p1').map((c) => c.power), [null], 'solo lo sin poder');
  assert.equal(canRenewFor(fake({}), 'p1'), true, 'nada de reptil: puede renovar');
  console.log('  ✓ Paralyzing Jellyfish y Red Bubble');
}

// --- La medusa: corta, abre sin rachas y se rompe al salir ---------------------------
{
  // Con la cadena abierta no comparte nada: corta, y no vuelve al mazo.
  const owned = (g) => ownedBy(g.state, 'p1');
  const cut = await atPlayerTurn(hitting());
  const before = owned(cut);
  cut.state.decks.p1.push(makeJelly());
  await cut.hit();
  for (let i = 0; i < 50 && cut.state.turn === 'p1'; i++) await idle();
  assert.ok(cut.state.chains.p1.busted, 'la medusa corta');
  assert.ok(!cut.state.decks.p1.some((c) => c.jelly), 'y no vuelve al mazo');
  assert.equal(owned(cut), before, 'no es una carta suya');

  // Abrir con una no abre ninguna racha: la siguiente corta seguro.
  const open = playCard(emptyChain(), makeJelly());
  assert.equal(open.runs.length, 0, 'sin rachas');
  assert.equal(survivalOdds(open, [card(['aquatic'])]).p, 0, 'cualquier carta la corta');

  // El huevo salva el turno, pero la medusa no vuelve.
  const egg = await atPlayerTurn(hitting('egg'));
  const size = egg.state.decks.p1.length;
  egg.state.decks.p1.push(makeJelly());
  await egg.hit();
  await idle();
  assert.equal(egg.state.turn, 'p1', 'el huevo salvó el turno');
  assert.equal(egg.state.decks.p1.length, size, 'y la medusa se rompió');
  console.log('  ✓ la medusa');
}

/**
 * Lleva la partida hasta el reparto del jugador. Lo que se le ponga a él en `setup`
 * vale para ese reparto.
 */
async function draftWith(chain, setup = () => {}) {
  const game = await atPlayerTurn(chain);
  setup(game.state);
  await game.stand();
  for (let i = 0; i < 50 && game.state.phase !== 'draft'; i++) await idle();
  assert.equal(game.drafting(), 'p1', 'le toca elegir al jugador');
  return game;
}

// --- Red Bubble en el reparto: solo lo sin poder, y cada una sin poder descuenta ------
{
  const took = await draftWith(hitting(), (s) => { s.status.p1.noPowers = 2; });
  seedPlain(took, 2);
  const [plain] = took.pickable();
  assert.ok(plain && !plain.power, 'con la Red Bubble solo se ofrece lo sin poder');
  assert.ok(took.pickable().every((c) => !c.power), 'nada con poder');
  await took.takeCard(plain.uid);
  await idle();
  assert.equal(took.state.status.p1.noPowers, 1, 'una sin poder descuenta una');
  console.log('  ✓ Red Bubble en el reparto');
}

// ==== Bestia: el sangrado ==========================================================

// --- el sangrado: cada carta robada cuesta lo mismo, y baja 1 --------------------------
{
  const game = await drawWith(hitting(), card(['aquatic']), (s) => { s.status.p1.bleed = 3; });
  assert.equal(game.state.totals.p2, TUNING.bleedDamage, 'la carta costó lo suyo');
  assert.equal(game.state.status.p1.bleed, 2, 'y bajó 1');
  game.state.decks.p1.push(card(['aquatic']));
  await game.hit();
  await idle();
  assert.equal(game.state.totals.p2, 2 * TUNING.bleedDamage, 'la siguiente cuesta lo mismo');
  console.log('  ✓ sangrado');
}

// --- Hidden Razor, Raging Dagger, Charm of Power y Energy Drink M ----------------------
{
  const razor = await standWith(hitting('razor'));
  assert.equal(razor.state.status.p2.bleed, TUNING.razorBleed);
  const two = await standWith(hitting('razor', 'razor'));
  assert.equal(two.state.status.p2.bleed, 2 * TUNING.razorBleed, 'dos navajas, el doble: no hay tope');

  const dagger = await drawWith(hitting(), { ...breaker(), power: 'dagger' });
  assert.equal(dagger.state.status.p2.bleed, TUNING.daggerBleed, 'la daga sangra aunque corte');

  const charm = await drawWith(hitting(), card(['aquatic'], 'strength'));
  assert.equal(charm.state.status.p1.claws, 1, 'una garra');
  await charm.stand();
  await idle();
  assert.equal(charm.state.status.p2.bleed, TUNING.clawBleed, 'y cada golpe pone 2 de sangrado por garra');

  const drink = await standWith(hitting('brutal'));
  assert.equal(drink.state.status.p2.bleed, TUNING.drinkBleed);
  assert.equal(drink.state.status.p2.wound, 1, 'herida abierta');

  // Con la herida abierta, cada carta que paga sangrando cura al que la abrió.
  const wound = await drawWith(hitting(), card(['aquatic']), (s) => {
    s.status.p1.bleed = 3; s.status.p1.wound = 1; s.totals.p1 = 30;
  });
  wound.state.decks.p1.push(card(['aquatic']));
  await wound.hit();
  await idle();
  assert.equal(wound.state.totals.p2, 2 * TUNING.bleedDamage, 'dos cartas sangrando');
  assert.equal(wound.state.status.p1.bleed, 1, 'el sangrado baja igual');
  assert.equal(wound.state.healed.p2, 2 * TUNING.drinkHeal, 'y cada una curó al rival');
  await wound.stand();
  await idle();
  assert.equal(wound.state.status.p1.wound, 0, 'al terminar el turno se cerró la herida');
  console.log('  ✓ Hidden Razor, Raging Dagger, Charm of Power y Energy Drink M');
}

// --- Mask of Frenzy: Rage que suma a cada golpe, y la Furia al tope ------------------------
{
  const game = await drawWith(hitting(), card(['aquatic'], 'rage'), (s) => { s.status.p1.rage = 1; });
  const s = game.state;
  assert.equal(s.status.p1.rage, 2, 'una Rage más');
  assert.equal(swingOf(s, 'p1'), scoreChain(s.chains.p1).total + 2 * TUNING.rageStep, '+2 por punto');
  await game.stand();
  await idle();
  assert.equal(s.status.p1.rage, 2, 'la Rage no se gasta al pegar');

  // Aunque la carta corte, suma.
  const bust = await drawWith(hitting(), { ...breaker(), power: 'rage' });
  assert.equal(bust.state.status.p1.rage, 1, 'la Rage entra aunque te cortes');

  // Al tope, la Furia: +10 más en el próximo golpe que conecta, y vuelve a 0.
  const fury = await drawWith(hitting(), card(['aquatic'], 'rage'), (st) => { st.status.p1.rage = TUNING.rageMax - 1; });
  const fs = fury.state;
  assert.equal(fs.status.p1.rage, TUNING.rageMax);
  const points = scoreChain(fs.chains.p1).total;
  assert.equal(swingOf(fs, 'p1'), points + TUNING.rageMax * TUNING.rageStep + TUNING.furyBonus, 'la Furia suma encima');
  await fury.stand();
  await idle();
  assert.equal(fs.totals.p1, points + TUNING.rageMax * TUNING.rageStep + TUNING.furyBonus, 'y pega');
  assert.equal(fs.status.p1.rage, 0, 'la Rage vuelve a 0');

  // Dos máscaras en la misma mano, dos puntos.
  const two = await drawWith(hitting(), { ...card(['aquatic'], 'rage'), stackedCards: [card(['aquatic'], 'rage'), card(['aquatic'], 'rage')] });
  assert.equal(two.state.status.p1.rage, 2, 'cada copia suma');
  console.log('  ✓ Mask of Frenzy');
}

// ==== Planta: cura, escudo y limpieza ==============================================

// --- Leafy Pot: cura fija por maceta ----------------------------------------------------
{
  const game = await standWith(hitting('pot', 'pot'), (s) => { s.totals.p2 = 40; });
  assert.equal(game.state.healed.p1, 2 * TUNING.potHeal, 'dos macetas, el doble');
  console.log('  ✓ Leafy Pot');
}

/**
 * Deja correr la partida hasta que al jugador le vuelve a tocar, salteando su centro.
 * Las hojas curan y el capullo escuda al empezar ese turno, antes de robar.
 */
async function toNextPlayerTurn(game) {
  for (let i = 0; i < 2000 && game.state.turn !== null; i++) await idle();
  for (let i = 0; i < 2000 && (game.state.turn !== 'p1' || game.state.phase !== 'turn'); i++) {
    if (game.state.phase === 'draft' && game.drafting() === 'p1') await game.skipDraft();
    else if (game.state.phase === 'roundEnd') await game.nextRound();
    else await idle();
  }
  assert.equal(game.state.turn, 'p1', 'le vuelve a tocar al jugador');
}

// --- Spring Leaf y Cocoon Whistle: turnos que curan o escudan al empezar -----------------
{
  const game = await standWith(hitting('leaf', 'cocoon'), (s) => { s.totals.p2 = 60; });
  const st = game.state.status.p1;
  assert.equal(st.leaf, TUNING.leafTurns);
  assert.equal(st.cocoon, TUNING.cocoonTurns);
  const healed = game.state.healed.p1;
  await toNextPlayerTurn(game);
  if (hpOf(game.state, 'p1') > 0) {
    assert.equal(st.leaf, TUNING.leafTurns - 1, 'se gastó un turno de brote');
    assert.ok(game.state.healed.p1 >= healed + Math.min(TUNING.leafHeal, 1), 'y curó');
    assert.equal(st.cocoon, TUNING.cocoonTurns - 1, 'y uno de capullo');
  }
  console.log('  ✓ Spring Leaf y Cocoon Whistle');
}

// --- Sleepy Guard y el Limpiador ---------------------------------------------------------
{
  const game = await standWith(hitting('guard'));
  assert.equal(game.state.status.p1.egg, TUNING.guardShield);
  assert.equal(game.state.status.p1.cleanser, 1);

  // El Limpiador del rival se come una aplicación entera: de dos frascos entra uno.
  const vials = await standWith(hitting('poison', 'poison'), (s) => { s.status.p2.cleanser = 1; });
  assert.equal(vials.state.status.p2.poison, TUNING.poisonDose, 'un frasco cancelado, el otro entra');
  assert.equal(vials.state.status.p2.cleanser, 0);

  // Una bebida es una aplicación entera: el Limpiador cancela el sangrado y la herida.
  const drink = await standWith(hitting('brutal'), (s) => { s.status.p2.cleanser = 1; s.status.p2.bleed = 2; });
  assert.equal(drink.state.status.p2.bleed, 2, 'no suma sangrado');
  assert.equal(drink.state.status.p2.wound, 0, 'ni herida');
  assert.equal(drink.state.status.p2.cleanser, 0, 'con un solo Limpiador');
  console.log('  ✓ Sleepy Guard');
}

// --- Red Sage: limpia y cura por copia ---------------------------------------------------
{
  const game = await standWith(hitting('sage', 'sage'), (s) => {
    Object.assign(s.status.p1, { poison: 5, bleed: 2, wound: 1, healBlock: 1, healShut: 1, noPowers: 1 });
    s.totals.p2 = 40;
  });
  const st = game.state.status.p1;
  for (const k of ['poison', 'bleed', 'wound', 'healBlock', 'healShut', 'noPowers']) assert.equal(st[k], 0, `saca ${k}`);
  assert.equal(game.state.healed.p1, 2 * TUNING.sageHeal, 'y cura, porque ya no está bloqueado');
  console.log('  ✓ Red Sage');
}

// --- Mít's Comfy Pillow: le resta a cada ataque rival, durante sus turnos ----------------
{
  const two = await standWith(hitting('pillow', 'pillow'));
  assert.equal(two.state.status.p1.pillow, 2 * TUNING.pillowTurns, 'cada almohada suma sus turnos');
  const hit = await atPlayerTurn(chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant']), card(['aquatic']), card(['aquatic'])));
  const swing = swingOf(hit.state, 'p1');
  hit.state.status.p2.pillow = 1;
  assert.equal(projectedHit(hit.state, 'p1'), swing - TUNING.pillowCut, 'le resta lo suyo al golpe');

  // Se gasta un turno al final de cada turno del rival, pegue o no.
  const game = await standWith(hitting('pillow'));
  assert.equal(game.state.status.p1.pillow, TUNING.pillowTurns);
  await toNextPlayerTurn(game);
  assert.equal(game.state.status.p1.pillow, TUNING.pillowTurns - 1, 'el turno del rival gastó uno');
  console.log("  ✓ Mít's Comfy Pillow");
}

// ==== Bicho: robarle al rival ======================================================

// --- Mantis Dagger: pega contra el escudo y cura lo que llega a la vida -----------------
{
  const game = await standWith(hitting('leech', 'leech'), (s) => { s.totals.p2 = 40; });
  const points = scoreChain(hitting('leech', 'leech')).total;
  assert.equal(game.state.totals.p1, points + 2 * TUNING.leechDrain, 'el golpe y lo que roban las dos');
  assert.equal(game.state.healed.p1, 2 * TUNING.leechDrain);
  // Con escudo: el golpe se come una parte, la daga la que queda, y cura lo que pasó.
  const shield = points + 3;
  const walled = await standWith(hitting('leech', 'leech'), (s) => { s.totals.p2 = 40; s.status.p2.egg = shield; });
  const through = 2 * TUNING.leechDrain - 3;
  assert.equal(walled.state.totals.p1, through, 'el escudo frena a la daga');
  assert.equal(walled.state.healed.p1, through, 'y cura solo lo que llegó a la vida');
  console.log('  ✓ Mantis Dagger');
}

// --- Lazy Snail: el próximo ataque, sin sus mejores rachas ---------------------------------
{
  const game = await standWith(hitting('snail'));
  assert.equal(game.state.status.p2.weak, 1);
  const s = game.state;
  s.chains.p2 = chainOf(card(['beast', 'bird']), card(['beast', 'bird']), card(['beast']));
  s.status.p2.weak = 0;
  assert.equal(pointsOf(s, 'p2'), 9 + 4);
  s.status.p2.weak = 1;
  assert.equal(pointsOf(s, 'p2'), 4, 'sin la mejor');
  s.status.p2.weak = 2;
  assert.equal(swingOf(s, 'p2'), 0, 'con dos, ninguna');
  console.log('  ✓ Lazy Snail');
}

// --- Metal Scanner: le saca todo el escudo, o gana el suyo -----------------------------------
{
  const game = await drawWith(hitting(), card(['aquatic'], 'scanner'), (s) => { s.status.p2.egg = 16; });
  assert.equal(game.state.status.p2.egg, 0, 'todo el escudo');
  assert.equal(game.state.status.p1.egg, 16, 'pasa a ser suyo');
  const bare = await drawWith(hitting(), card(['aquatic'], 'scanner'));
  assert.equal(bare.state.status.p1.egg, TUNING.scannerShield, 'sin escudo que robar, gana el suyo');
  console.log('  ✓ Metal Scanner');
}

// --- Trickster's Card: le roba una carta con poder al rival, Rocket incluido ---------------
{
  const target = card(['beast', 'bird'], 'pot');
  const rocket = card(['beast', 'bird'], 'freegame');
  const game = await draftWith(hitting('trickster'), (s) => { s.decks.p2.push(target, rocket); });
  const s = game.state;
  assert.equal(s.draft.step, 'trick', 'antes del centro, el trickster');
  const targets = trickTargetsFor(s, 'p1');
  assert.ok(targets.some((c) => c.uid === target.uid), 'las cartas con poder de su mazo');
  assert.ok(targets.some((c) => c.uid === rocket.uid), 'y el Rocket');
  const owned = { p1: ownedBy(s, 'p1'), p2: ownedBy(s, 'p2') };
  await game.stealCard(target.uid);
  await idle();
  assert.ok(!s.decks.p2.includes(target), 'sale del mazo del rival');
  assert.ok(s.decks.p1.includes(target), 'y entra al tuyo');
  assert.deepEqual([ownedBy(s, 'p1'), ownedBy(s, 'p2')], [owned.p1 + 1, owned.p2 - 1], 'cambia de dueño');
  assert.ok(s.added.p1.includes(target), 'el panel del mazo la muestra');
  assert.equal(s.draft?.step ?? 'normal', 'normal', 'y sigue el centro');

  // La carta de la burbuja es la primera del turno: paga el sangrado.
  const bubbled = await standWith(hitting());
  for (let i = 0; i < 50 && bubbled.state.phase !== 'draft'; i++) await idle();
  const earring = card(['aquatic'], 'feather');
  bubbled.state.status.p1.bleed = 2;
  bubbled.state.bubbleCard.p1 = { card: earring, count: 1 };
  await toNextPlayerTurn(bubbled);
  assert.equal(bubbled.state.chains.p1.cards[0].uid, earring.uid, 'abre con la de la burbuja');
  assert.equal(bubbled.state.status.p1.bleed, 1, 'costó sangrado, que bajó 1');
  console.log("  ✓ Trickster's Card");
}

// ==== Reptil: veneno y espinas =======================================================

// --- Poison Vial: 4 por frasco, muerde y baja 1 ------------------------------------------------
{
  const game = await standWith(hitting('poison', 'poison'));
  assert.equal(game.state.status.p2.poison, 2 * TUNING.poisonDose, 'dos frascos, 8');
  const capped = await standWith(hitting('poison', 'poison', 'poison', 'poison'));
  assert.equal(capped.state.status.p2.poison, TUNING.poisonMax, 'hasta el tope');
  // Muerde al final del turno del envenenado y baja 1.
  await toNextPlayerTurn(game);
  assert.equal(game.state.status.p2.poison, 2 * TUNING.poisonDose - 1, 'mordió y bajó 1');
  console.log('  ✓ Poison Vial');
}

// --- Gecko Mask y Sharp Edge: espinas para el que pegue ---------------------------------------
{
  const mask = await standWith(hitting('steelskin'));
  assert.equal(mask.state.status.p1.spikes, TUNING.spikes);
  const edge = await drawWith(hitting(), { ...breaker(), power: 'edge' });
  assert.equal(edge.state.status.p1.spikes, TUNING.edgeSpikes, 'el filo suma aunque corte');

  // El que pega con espinas enfrente se las lleva, y se gastan.
  const game = await standWith(hitting(), (s) => { s.status.p2.spikes = 8; });
  assert.equal(game.state.totals.p2, 8, 'le volvieron las espinas');
  assert.equal(game.state.status.p2.spikes, 0);
  console.log('  ✓ Gecko Mask y Sharp Edge');
}

// --- Gloves of Infection: veneno para los dos, y el tuyo te cura este turno --------------------
{
  const game = await drawWith(hitting(), card(['aquatic'], 'gloves'), (s) => { s.totals.p2 = 30; });
  const s = game.state;
  assert.equal(s.status.p2.poison, TUNING.glovesPoison, 'el rival se lleva lo suyo');
  assert.equal(s.status.p1.poison, TUNING.glovesPoison, 'y el que los robó también');
  assert.equal(s.status.p1.antidote, 1);
  const hurt = s.totals.p2;
  await game.stand();
  await idle();
  assert.equal(s.healed.p1, TUNING.glovesPoison, 'al final del turno, el veneno lo cura');
  assert.equal(s.totals.p2, hurt, 'en vez de morderlo');
  assert.equal(s.status.p1.poison, TUNING.glovesPoison - 1, 'y baja 1 igual');
  assert.equal(s.status.p1.antidote, 0, 'solo ese turno');
  // El Limpiador del rival frena su parte, no la tuya.
  const clean = await drawWith(hitting(), card(['aquatic'], 'gloves'), (st) => { st.status.p2.cleanser = 1; });
  assert.equal(clean.state.status.p2.poison, 0);
  assert.equal(clean.state.status.p1.poison, TUNING.glovesPoison);
  console.log('  ✓ Gloves of Infection');
}

// --- Viper's Venom: el próximo turno en que se cure, no le entra ninguna cura --------------------
{
  const game = await standWith(hitting('viper'));
  assert.equal(game.state.status.p2.healBlock, 1);
  const blocked = await standWith(hitting('pot', 'leech', 'guard'), (s) => { s.status.p1.healBlock = 1; s.totals.p2 = 40; });
  const st = blocked.state.status.p1;
  assert.equal(st.healBlock, 0, 'se gastó');
  assert.equal(blocked.state.healed.p1, 0, 'ni la maceta ni la daga curaron: todo el turno');
  assert.equal(st.egg, TUNING.guardShield, 'el escudo sí entra');
  // Y en el turno siguiente se puede curar otra vez.
  await toNextPlayerTurn(blocked);
  assert.equal(st.healShut, 0, 'el bloqueo era de ese turno');
  console.log("  ✓ Viper's Venom");
}

// --- cadena cortada: solo el shuriken ----------------------------------------------------------
{
  const chain = chainOf(
    card(['aquatic', 'bird'], 'pot'),
    card(['aquatic', 'plant'], 'snail'),
    card(['aquatic', 'beast'], 'poison'),
    card(['bug', 'reptile'], 'razor'), // ni bug ni reptile siguen vivos: acá se corta
  );
  const game = await standWith(chain);
  const s = game.state;
  assert.ok(chain.busted);
  assert.equal(s.roundScores.p1, 0, 'una cadena cortada hace 0');
  assert.equal(s.healed.p1, 0, 'la maceta no cura');
  assert.equal(s.status.p2.weak, 0, 'el caracol tampoco');
  assert.equal(s.status.p2.poison, 0, 'ni el veneno, que pide plantarse');
  assert.equal(s.status.p2.bleed, 0, 'ni la navaja');
  console.log('  ✓ cadena cortada');
}

// ==== Los de siempre: pulpo, Bubble Paste y Rocket Stamp ===========================

// --- pulpo: reserva cartas del reparto para que abran la ronda siguiente -------

/**
 * Deja `n` cartas sin poder a la vista en el centro. El centro es sorteado, y una
 * prueba del reparto que dependa de lo que salió sale distinta cada vez.
 */
function seedPlain(game, n) {
  const s = game.state;
  for (let i = 0; i < n; i++) {
    if (!s.market[i].power) continue;
    const at = s.pool.findIndex((c) => !c.power);
    assert.ok(at >= 0, 'quedan cartas sin poder en la reserva');
    s.pool.push(s.market[i]);
    s.market[i] = s.pool.splice(at, 1)[0];
  }
}

/** Lleva la partida hasta el reparto del jugador, que es donde el pulpo se cobra. */
async function atPlayerDraft(chain) {
  const game = await atPlayerTurn(chain);
  await game.stand();
  for (let i = 0; i < 50 && game.state.phase !== 'draft'; i++) await idle();
  assert.equal(game.state.phase, 'draft', 'se abrió el reparto');
  assert.equal(game.drafting(), 'p1', 'y le toca al jugador');
  return game;
}

{
  // Un pulpo paga una carta **aparte** del reparto: no es la que elegiste, es una de
  // más. Acá el jugador rechaza el reparto entero y aun así se lleva una carta, que es
  // la prueba de que la etapa del pulpo es independiente.
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'], 'octopus'));
  const game = await atPlayerDraft(chain);
  assert.equal(game.state.status.p1.stacked, 1, 'quedó un pulpo puesto');

  const deck = game.state.decks.p1.length;
  await game.skipDraft(); // no se lleva nada del reparto normal
  assert.equal(game.state.draft.step, 'bonus', 'se abre la etapa del pulpo');
  assert.equal(game.state.decks.p1.length, deck, 'y el reparto no dejó nada');

  // Y ahí sirve el centro entero: la carta del pulpo puede llevar poder.
  assert.deepEqual(
    game.pickable().map((c) => c.uid).sort(),
    game.state.market.map((c) => c.uid).sort(),
    'sin reglas de reparto: sirve cualquier carta',
  );

  const pick = game.pickable().find((c) => c.power) ?? game.pickable()[0];
  await game.takeCard(pick.uid);

  assert.equal(game.state.status.p1.stacked, 0, 'el pulpo se gastó');
  assert.equal(game.state.decks.p1.length, deck + 1, 'entró directo al mazo');
  console.log('  ✓ pulpo (carta extra al mazo)');
}

{
  // La carta del pulpo es de más, no en lugar de: el jugador hace su reparto normal
  // —una carta con poder, que lo cierra— y **después** cobra la del pulpo.
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'], 'octopus'));
  const game = await atPlayerDraft(chain);
  const deck = game.state.decks.p1.length;

  const powered = game.pickable().find((c) => c.power);
  if (powered) {
    await game.takeCard(powered.uid);
    assert.equal(game.state.decks.p1.length, deck + 1, 'la del reparto va al mazo');
    assert.equal(game.state.draft.step, 'bonus', 'recién ahora se abre la del pulpo');

    const extra = game.pickable()[0];
    await game.takeCard(extra.uid);
    assert.equal(game.state.decks.p1.length, deck + 2, 'la del pulpo también va al mazo');
  }
  console.log('  ✓ pulpo (es de más, no en lugar de)');
}

{
  // Dos pulpos pagan dos cartas para el mazo.
  const chain = chainOf(
    card(['aquatic', 'bird'], 'octopus'),
    card(['aquatic', 'plant'], 'octopus'),
  );
  const game = await atPlayerDraft(chain);
  assert.equal(game.state.status.p1.stacked, 2, 'dos pulpos, dos cartas');
  const deck = game.state.decks.p1.length;

  await game.skipDraft();
  assert.equal(game.state.draft.step, 'bonus');

  const first = game.pickable()[0];
  await game.takeCard(first.uid);
  assert.equal(game.state.status.p1.stacked, 1, 'queda uno');
  assert.equal(game.state.draft.step, 'bonus', 'sigue debiendo una');
  const second = game.pickable().find((c) => c.uid !== first.uid);
  await game.takeCard(second.uid);

  assert.equal(game.state.decks.p1.length, deck + 2, 'las dos cartas fueron al mazo');
  assert.equal(game.state.status.p1.stacked, 0);
  console.log('  ✓ pulpo (dos cartas al mazo)');
}

{
  // Rechazar la carta del pulpo la gasta. Si no, un pulpo sin usar se arrastraría de
  // ronda en ronda para siempre.
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'], 'octopus'));
  const game = await atPlayerDraft(chain);
  await game.skipDraft();
  assert.equal(game.state.draft.step, 'bonus');
  await game.skipDraft();
  assert.equal(game.state.status.p1.stacked, 0, 'la reserva se consumió igual');
  console.log('  ✓ pulpo (rechazar la gasta)');
}

{
  // Con la cadena cortada no cobra nadie: ni el pulpo, que pide haberse plantado, ni
  // la maceta, que se mide contra el daño.
  const chain = chainOf(
    card(['aquatic', 'bird'], 'octopus'),
    card(['bug', 'reptile'], 'pot'), // ni bug ni reptile viven: acá se corta
  );
  const game = await atPlayerTurn(chain);
  assert.ok(chain.busted);
  await game.stand();
  await idle();
  assert.equal(game.state.roundScores.p1, 0, 'el ataque hizo 0');
  assert.equal(game.state.status.p1.stacked, 0, 'el pulpo se fue con la cadena');
  assert.equal(game.state.healed.p1, 0, 'la maceta tampoco cura');
  console.log('  ✓ pulpo (cadena cortada: no cobra)');
}

{
  // Pero se mide contra la cadena, no contra el daño: con dos caracoles encima las dos
  // rachas de la carta no cuentan y el ataque sale en 0, y el pulpo cobra igual.
  const chain = chainOf(card(['aquatic', 'bird'], 'octopus'));
  const game = await atPlayerTurn(chain);
  assert.ok(!chain.busted, 'la cadena está entera');
  game.state.status.p1.weak = 2;
  assert.equal(swingOf(game.state, 'p1'), 0, 'se planta sin ninguna racha que cuente');

  await game.stand();
  await idle();
  assert.equal(game.state.status.p1.stacked, 1, 'el pulpo cobra entero igual');
  console.log('  ✓ pulpo (plantado y debilitado: cobra)');
}

{
  // Plantarse es atacar aunque el golpe salga en 0: los que antes pedían daño ("al
  // pegar") cobran igual que el pulpo.
  const chain = chainOf(card(['reptile', 'bird'], 'steelskin'));
  const game = await atPlayerTurn(chain);
  game.state.status.p1.weak = 2;
  assert.equal(swingOf(game.state, 'p1'), 0, 'se planta sin ninguna racha que cuente');

  await game.stand();
  await idle();
  assert.equal(game.state.status.p1.spikes, TUNING.spikes, 'las espinas entran igual');
  console.log('  ✓ Gecko Mask (plantado en 0: cobra)');
}

{
  // Con la cadena entera en 0 por el caracol, lo que suma números fijos suma igual:
  // la Rage pone su daño y las garras su sangrado.
  const chain = chainOf(card(['beast', 'bird']));
  const game = await atPlayerTurn(chain);
  game.state.status.p1.weak = 2;
  game.state.status.p1.rage = 2;
  game.state.status.p1.claws = 1;
  assert.equal(swingOf(game.state, 'p1'), 2 * TUNING.rageStep, 'la Rage suma sobre la cadena en 0');

  await game.stand();
  await idle();
  assert.equal(game.state.status.p2.bleed, TUNING.clawBleed, 'la garra sangra igual');
  console.log('  ✓ Rage y garras (cadena en 0: suman igual)');
}

// --- burbuja de retorno: abre la próxima ronda; acumulada apila carta gigante --
{
  // 1. Una sola burbuja: la carta elegida abre la ronda que viene
  const chain1 = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'], 'bubble'));
  const game1 = await atPlayerDraft(chain1);
  assert.equal(game1.state.status.p1.bubbles, 1, 'quedó 1 burbuja activa');

  const pick1 = game1.pickable()[0];
  await game1.takeCard(pick1.uid);
  assert.equal(game1.state.status.p1.bubbles, 0, 'se consumió la burbuja');
  assert.ok(game1.state.bubbleCard.p1, 'quedó guardada en bubbleCard');
  assert.equal(game1.state.bubbleCard.p1.card.uid, pick1.uid);
  assert.equal(game1.state.bubbleCard.p1.count, 1);

  // Al pasar de ronda, abre la mesa
  const round1 = game1.state.round;
  for (let i = 0; i < 800 && game1.state.round === round1 && game1.state.phase !== 'matchEnd'; i++) {
    if (game1.state.phase === 'draft' && game1.drafting() === 'p1') await game1.skipDraft();
    else await idle();
  }
  if (game1.state.round > round1) {
    for (let i = 0; i < 400 && game1.state.chains.p1.cards.length === 0; i++) await idle();
    assert.equal(game1.state.chains.p1.cards[0].uid, pick1.uid, 'abre con la carta de la burbuja');
    assert.equal(game1.state.chains.p1.cards.length, 1, 'es una sola carta en columna 1');
  }
  console.log('  ✓ burbuja de retorno (apertura simple)');
}

{
  // 2. Dos burbujas acumuladas: la elegida + 1 del mazo en carta gigante
  const chain2 = chainOf(
    card(['aquatic', 'bird'], 'bubble'),
    card(['aquatic', 'plant'], 'bubble'),
  );
  const game2 = await atPlayerDraft(chain2);
  assert.equal(game2.state.status.p1.bubbles, 2, 'dos burbujas activas');

  const pick2 = game2.pickable()[0];
  await game2.takeCard(pick2.uid);
  assert.equal(game2.state.bubbleCard.p1.count, 2, 'cuenta 2 burbujas');

  const round2 = game2.state.round;
  for (let i = 0; i < 800 && game2.state.round === round2 && game2.state.phase !== 'matchEnd'; i++) {
    if (game2.state.phase === 'draft' && game2.drafting() === 'p1') await game2.skipDraft();
    else await idle();
  }
  if (game2.state.round > round2) {
    for (let i = 0; i < 400 && game2.state.chains.p1.cards.length === 0; i++) await idle();
    const giant = game2.state.chains.p1.cards[0];
    assert.ok(giant.stackedCards, 'es una carta gigante con cartas apiladas');
    assert.equal(giant.stackedCards.length, 2, 'apila la del centro + 1 del mazo');
    assert.equal(giant.stackedCards[0].uid, pick2.uid, 'la primera es la del centro');
    assert.equal(game2.state.chains.p1.cards.length, 1, 'sigue siendo la columna 1');
  }
  console.log('  ✓ burbuja de retorno (carta gigante acumulada)');
}

{
  // 3. Cadena cortada con burbuja: no cobra
  const chainBusted = chainOf(
    card(['aquatic', 'bird'], 'bubble'),
    card(['bug', 'reptile']),
  );
  const gameBusted = await atPlayerTurn(chainBusted);
  assert.ok(chainBusted.busted);
  await gameBusted.stand();
  await idle();
  assert.equal(gameBusted.state.status.p1.bubbles, 0, 'con corte no activa burbuja');
  console.log('  ✓ burbuja de retorno (cadena cortada: no cobra)');
}



// --- Rocket Stamp (Free Game): la carta gratis que se pone sobre una columna ---
{
  // 1. Robado con la cadena abierta, no se encadena: espera columna, y no corta aunque
  // no comparta ningún símbolo vivo.
  const game = await atPlayerTurn(chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'])));
  const rocket = card(['reptile', 'bug'], 'freegame');
  game.state.decks.p1.push(rocket);

  await game.hit();
  await idle();
  assert.equal(game.state.chains.p1.busted, false, 'el Rocket no corta la cadena');
  assert.equal(game.state.pendingStack?.player, 'p1', 'espera que el jugador elija columna');
  assert.equal(game.state.pendingStack.card.uid, rocket.uid, 'la que espera es el Rocket mismo');
  assert.equal(game.state.chains.p1.cards.length, 2, 'todavía no está en la mesa');

  // Una columna que no existe no hace nada.
  await game.chooseStackTarget(5);
  assert.ok(game.state.pendingStack, 'una columna inválida no lo pone');

  await game.chooseStackTarget(1);
  await idle();
  assert.equal(game.state.pendingStack, null);
  const chain = game.state.chains.p1;
  assert.equal(chain.cards.length, 2, 'no suma columna');
  assert.deepEqual(chain.cards[1].stackedCards.map((c) => c.uid).at(-1), rocket.uid, 'quedó sobre la 2ª');
  assert.equal(game.state.lastStacked.colIndex, 1);

  // El robo siguiente vuelve a ser normal: el Rocket no arma nada para después.
  const bust = card(['beast']);
  game.state.decks.p1.push(bust);
  await game.hit();
  await idle();
  assert.equal(game.state.chains.p1.busted, true, 'la carta que sigue corta como cualquiera');
  console.log('  ✓ Rocket Stamp (gratis: no corta y espera columna)');
}

{
  // 2. Sobre la columna elegida suma sus símbolos: el de Pez sobre la 2ª alarga la racha
  // de Pez a 3.
  const game = await atPlayerTurn(chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'])));
  const rocket = card(['aquatic', 'beast'], 'freegame');
  game.state.decks.p1.push(rocket);
  await game.hit(null, 1); // con la columna ya elegida, se pone de una
  await idle();
  assert.equal(game.state.pendingStack, null);
  assert.equal(scoreChain(game.state.chains.p1).total, 10, 'Pez 3 (9) + Pájaro 1');
  console.log('  ✓ Rocket Stamp (con la columna elegida suma sus símbolos)');
}

{
  // 3. Atacar con el Rocket sin columna lo pone donde más suma: sobre la 1ª abre además
  // una racha de Bestia (11 contra 10 en la 2ª).
  const game = await atPlayerTurn(chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'])));
  game.state.decks.p1.push(card(['aquatic', 'beast'], 'freegame'));
  await game.hit();
  await idle();
  assert.ok(game.state.pendingStack);
  await game.stand();
  await idle();
  assert.equal(game.state.roundScores.p1, 11, 'se puso en la mejor columna y no se perdió');
  console.log('  ✓ Rocket Stamp (atacar sin elegir lo pone donde más suma)');
}

{
  // 4. Si abre la ronda no hay dónde ponerlo: abre la cadena como cualquier carta.
  const game = await atPlayerTurn();
  game.state.chains.p1 = emptyChain();
  const rocket = card(['aquatic', 'bird'], 'freegame');
  game.state.decks.p1.push(rocket);
  await game.hit();
  await idle();
  assert.equal(game.state.pendingStack, null);
  assert.equal(game.state.chains.p1.cards[0].uid, rocket.uid, 'abre la cadena');
  console.log('  ✓ Rocket Stamp (primera carta: abre la cadena)');
}

{
  // 5. Sobre una carta con poder, la columna conserva los dos y el poder actúa.
  const poisonCard = card(['aquatic', 'bird'], 'poison');
  const game = await atPlayerTurn(chainOf(poisonCard));
  game.state.decks.p1.push(card(['aquatic', 'plant'], 'freegame'));
  await game.hit();
  await idle();
  await game.chooseStackTarget(0);
  await idle();
  const col = game.state.chains.p1.cards[0];
  assert.deepEqual(col.powers, ['poison', 'freegame'], 'conserva veneno y Rocket');
  assert.equal(col.power, 'poison', 'el poder de combate es el veneno');
  await game.stand();
  await idle();
  assert.ok(game.state.status.p2.poison > 0, 'el veneno se aplicó al rival');
  console.log('  ✓ Rocket Stamp (sobre una carta con poder, el poder sigue)');
}

{
  // 6. La CPU lo pone sola, en la columna que más suma, sin dejar nada esperando.
  const game = await atPlayerTurn(chainOf(card(['aquatic', 'bird'])));
  const opener = card(['plant', 'bug']);
  const rocket = card(['plant', 'reptile'], 'freegame');
  game.state.decks.p2.push(rocket, opener); // abre `opener` y el segundo robo es el Rocket
  const stacks = [];
  game.subscribe((st) => {
    if (st.lastStacked?.player === 'p2' && st.lastStacked.id !== stacks.at(-1)?.id) stacks.push(st.lastStacked);
    assert.notEqual(st.pendingStack?.player, 'p2', 'la CPU nunca deja un Rocket esperando');
  });
  await game.stand();
  await idle();
  await game.skipDraft(); // el centro de p1, y después juega la CPU
  for (let i = 0; i < 20 && !stacks.length; i++) await idle();
  assert.equal(stacks.length, 1, 'la CPU robó el Rocket y lo puso');
  assert.equal(stacks[0].card.uid, rocket.uid);
  assert.equal(stacks[0].colIndex, 0, 'sobre la única columna');
  console.log('  ✓ Rocket Stamp (la CPU lo pone sola)');
}

// --- las animaciones: el motor dice qué poderes actuaron y sobre quién --------
// La pantalla no adivina mirando qué cambió: cada poder deja su efecto en
// `state.powerFx`, en orden, con el asiento sobre el que cae (ver `power-fx.js`).
{
  const watch = (game) => {
    const events = [];
    game.subscribe((s) => {
      // Con la foto del estado en ese instante: sin pausas la partida sigue enseguida.
      if (s.powerFx && s.powerFx.id !== events.at(-1)?.id) {
        events.push({ ...structuredClone(s.powerFx), status: structuredClone(s.status) });
      }
    });
    return events;
  };
  const moments = (events) => events.flatMap((e) => e.fx.map((f) => `${f.power}:${f.moment}:${f.on}`));

  // Todos los que actúan al plantarse salen juntos, en un solo efecto y en orden.
  {
    const game = await atPlayerTurn(hitting(
      'poison', 'snail', 'octopus', 'guard', 'razor', 'leaf', 'leech', 'steelskin', 'pot', 'pillow',
    ));
    game.state.totals.p2 = 30; // que la maceta y la daga tengan algo que curar
    const events = watch(game);
    await game.stand();
    await idle();
    const [stand] = events;
    assert.ok(stand, 'el ataque deja sus poderes animados en el estado');
    assert.equal(stand.player, 'p1');
    assert.deepEqual(moments([stand]), [
      'octopus:apply:p1', 'poison:apply:p2', 'guard:apply:p1', 'razor:apply:p2', 'pot:apply:p1',
      'leaf:apply:p1', 'leech:apply:p2', 'snail:apply:p2', 'steelskin:apply:p1', 'pillow:apply:p1',
    ], 'cada uno sobre quien cae: primero los de plantarse, después los de pegar');
    const of = (power) => stand.fx.find((f) => f.power === power);
    assert.equal(of('poison').amount, stand.status.p2.poison);
    assert.equal(of('razor').amount, stand.status.p2.bleed);
    assert.equal(of('leech').amount, TUNING.leechDrain);
    assert.ok(of('leech').heal > 0 && of('pot').amount > 0, 'y lo que curó de verdad');
    assert.ok(stand.fx.every((f) => powerBeat(f) > 0), 'cada uno con su compás');
  }

  // Los segundos momentos: el caracol apaga rachas y la almohada frena el golpe.
  {
    // Dos rachas de 3: sin la mejor quedan 9, y la almohada le resta.
    const game = await atPlayerTurn(chainOf(
      card(['aquatic', 'bird']), card(['aquatic', 'bird']), card(['aquatic', 'bird']),
    ));
    game.state.status.p1.weak = 1;
    game.state.status.p2.pillow = 1;
    const events = watch(game);
    await game.stand();
    await idle();
    assert.deepEqual(moments(events).slice(0, 2), ['snail:slow:p1', 'pillow:block:p2'],
      'el caracol sobre el que pega y la almohada sobre el que la tiene');
    assert.equal(events[0].fx[1].amount, 9, 'con lo que frenó');
  }

  // Los de robar: la garra y el sangrado.
  {
    const game = await atPlayerTurn(hitting());
    const events = watch(game);
    game.state.status.p1.bleed = 2;
    game.state.decks.p1.push(card(['aquatic', 'plant'], 'strength'));
    await game.hit();
    await idle();
    assert.deepEqual(moments(events), ['razor:bleed:p1', 'strength:draw:p1'], 'el sangrado y la garra, al salir');
  }

  // El veneno al finalizar el turno, las hojas al empezarlo, y la burbuja y el pulpo en el centro.
  {
    const game = await atPlayerTurn(hitting('poison', 'leaf', 'octopus', 'bubble'));
    game.state.totals.p2 = 40;
    const events = watch(game);
    await game.stand();
    for (let i = 0; i < 1500 && !moments(events).includes('bubble:open:p1'); i++) {
      if (game.drafting() === 'p1') {
        const [pick] = game.pickable();
        if (pick) await game.takeCard(pick.uid);
        else await game.skipDraft();
      } else await idle();
    }
    const seen = moments(events);
    for (const want of ['leaf:tick:p1', 'poison:tick:p2', 'bubble:trap:p1', 'octopus:pick:p1', 'bubble:open:p1']) {
      assert.ok(seen.includes(want), `falta ${want} (${seen.join(', ')})`);
    }
    const bite = events.find((e) => e.fx[0].moment === 'tick' && e.fx[0].power === 'poison');
    assert.equal(bite.player, 'p1', 'el veneno que muerde es del que lo puso');
  }

  console.log('  ✓ poderes animados en el estado');
}

// --- el golpe proyectado: lo que la pantalla pinta en rojo sobre la vida rival ----
{
  const game = await atPlayerTurn(chainOf(card(['aquatic']), card(['aquatic', 'bird']), card(['aquatic', 'plant'])));
  const st = game.state;
  assert.equal(projectedHit(st, 'p1'), 9, 'sin escudo: el golpe entero');
  st.status.p2.egg = 4;
  assert.equal(projectedHit(st, 'p1'), 5, 'el escudo se come lo suyo');
  st.status.p2.egg = 20;
  assert.equal(projectedHit(st, 'p1'), 0, 'un escudo más grande que el golpe lo deja en 0');
  // La almohada le resta su parte a lo que pasó el escudo (acá, menos de 10 por golpe).
  const cut = TUNING.pillowCut;
  TUNING.pillowCut = 3;
  st.status.p2.egg = 2;
  st.status.p2.pillow = 1;
  assert.equal(projectedHit(st, 'p1'), 9 - 2 - 3, 'después del escudo, lo que resta la almohada');
  st.status.p2.egg = 0;
  st.status.p2.pillow = 0;
  st.status.p1.weak = 1;
  assert.equal(projectedHit(st, 'p1'), swingOf(st, 'p1'), 'el caracol ya viene en el golpe');
  // y es la misma cuenta que hace el golpe de verdad
  st.status.p1.weak = 0;
  st.status.p2.egg = 3;
  st.status.p2.pillow = 1;
  const want = projectedHit(st, 'p1');
  const before = hpOf(st, 'p2');
  await game.stand();
  await idle();
  TUNING.pillowCut = cut;
  assert.equal(before - hpOf(game.state, 'p2'), want, 'lo proyectado es lo que pega');
  console.log('  ✓ golpe proyectado');
}

// ==== Neutrales de la Aventura ======================================================
{
  // El catálogo: doce, sin clase, con su momento y sus seis cartas de dos símbolos.
  assert.equal(NEUTRAL_POWERS.length, 12);
  for (const id of NEUTRAL_POWERS) {
    assert.equal(POWERS[id].symbol, null, `${id} es neutral`);
    assert.ok(POWERS[id].note && POWERS[id].tip && MOMENTS[POWERS[id].moment], `${id} tiene texto y momento`);
  }
  console.log('  ✓ catálogo de neutrales');
}

// --- Charm of Focus: +3 de daño en cada ataque, para siempre ---------------------
{
  const game = await drawWith(hitting(), card(['aquatic'], 'focus'));
  const s = game.state;
  assert.equal(s.status.p1.focus, 1);
  assert.equal(swingOf(s, 'p1'), scoreChain(s.chains.p1).total + TUNING.focusStep, 'suma al golpe');
  s.status.p1.focus = TUNING.focusMax;
  s.decks.p1.push(card(['aquatic'], 'focus'));
  await game.hit();
  await idle();
  assert.equal(s.status.p1.focus, TUNING.focusMax, 'con tope');
  await game.stand();
  await idle();
  assert.equal(s.status.p1.focus, TUNING.focusMax, 'no se gasta al pegar');
  console.log('  ✓ Charm of Focus');
}

// --- Lens of Revelation: ves las dos que siguen -----------------------------------
{
  const game = await atPlayerTurn(hitting());
  const s = game.state;
  const x = card(['aquatic']);
  const y = card(['aquatic', 'bird']);
  s.decks.p1.push(x, y, card(['aquatic'], 'lens'));
  await game.hit();
  await idle();
  assert.deepEqual(s.peek.cards.map((c) => c.uid), [y.uid, x.uid], 'en el orden en que salen');
  assert.equal(s.peek.player, 'p1');
  await game.hit();
  await idle();
  assert.deepEqual(s.peek.cards.map((c) => c.uid), [x.uid], 'la que salió se va de la lista');
  await game.stand();
  await idle();
  assert.equal(s.peek, null, 'se borra al cerrar el turno');
  console.log('  ✓ Lens of Revelation');
}

// --- Novice Spell: elegís curar, escudo o golpe -------------------------------------
{
  const shield = await drawWith(hitting(), card(['aquatic'], 'spell'));
  assert.deepEqual(shield.state.pendingSpell, { player: 'p1', count: 1 }, 'espera que elijas');
  shield.chooseSpell('shield');
  assert.equal(shield.state.status.p1.egg, TUNING.spellAmount);
  assert.equal(shield.state.pendingSpell, null);
  const heal = await drawWith(hitting(), card(['aquatic'], 'spell'), (s) => { s.totals.p2 = 30; });
  heal.chooseSpell('heal');
  assert.equal(heal.state.healed.p1, TUNING.spellAmount);
  const hit = await drawWith(hitting(), card(['aquatic'], 'spell'));
  hit.chooseSpell('hit');
  assert.equal(hit.state.totals.p1, TUNING.spellAmount, 'directo a la vida');
  // Sin elegir, sale como golpe cuando atacás.
  const idleSpell = await drawWith(hitting(), card(['aquatic'], 'spell'));
  const points = scoreChain(idleSpell.state.chains.p1).total;
  await idleSpell.stand();
  await idle();
  assert.equal(idleSpell.state.totals.p1, points + TUNING.spellAmount, 'el golpe del hechizo y el ataque');
  console.log('  ✓ Novice Spell');
}

// --- Red Mirror: copia la carta anterior y engancha siempre -------------------------
{
  const game = await atPlayerTurn(hitting());
  const s = game.state;
  const mirror = card(['beast'], 'mirror');
  const prev = s.chains.p1.cards.at(-1);
  s.decks.p1.push(mirror);
  await game.hit();
  await idle();
  assert.ok(!s.chains.p1.busted, 'el espejo no corta');
  assert.deepEqual(s.chains.p1.cards.at(-1).symbols, prev.symbols, 'con los símbolos de la anterior');
  await game.stand();
  await idle();
  assert.ok(s.decks.p1.includes(mirror), 'al mazo vuelve el espejo de verdad');
  assert.deepEqual(mirror.symbols, ['beast'], 'con sus símbolos');
  console.log('  ✓ Red Mirror');
}

// --- Energy Drink S: la cadena vale el doble y la bebida se rompe ----------------------
{
  const chain = hitting('energy');
  const drink = chain.cards.at(-1);
  const game = await standWith(chain);
  assert.equal(game.state.totals.p1, scoreChain(chain).total * TUNING.energyMult, 'el doble');
  assert.ok(!game.state.decks.p1.includes(drink), 'la bebida no vuelve al mazo');
  const two = await standWith(hitting('energy', 'energy'));
  assert.equal(two.state.totals.p1, scoreChain(hitting('energy', 'energy')).total * TUNING.energyMult, 'dos bebidas no multiplican de más');
  assert.equal(two.state.decks.p1.filter((c) => c.power === 'energy').length, 1, 'y se rompe una sola');
  const bust = chainOf(card(['aquatic'], 'energy'), breaker());
  const kept = await standWith(bust);
  assert.ok(kept.state.decks.p1.some((c) => c.power === 'energy'), 'cortado no se usa: vuelve al mazo');
  console.log('  ✓ Energy Drink S');
}

// --- Papa Bear y Mama Bear: según la ronda --------------------------------------------
{
  const odd = await standWith(hitting('papa'));
  assert.equal(odd.state.status.p1.egg, TUNING.papaShield, 'ronda impar: escudo');
  assert.equal(odd.state.totals.p1, scoreChain(hitting('papa')).total, 'sin daño de más');
  const even = await standWith(hitting('papa'), (s) => { s.round = 2; });
  assert.equal(even.state.totals.p1, scoreChain(hitting('papa')).total + TUNING.papaDamage, 'ronda par: daño');
  const mamaOdd = await standWith(hitting('mama'), (s) => { s.totals.p2 = 30; });
  assert.equal(mamaOdd.state.healed.p1, TUNING.mamaHeal, 'ronda impar: cura');
  const mamaEven = await standWith(hitting('mama'), (s) => { s.round = 2; });
  assert.equal(mamaEven.state.status.p2.bleed, TUNING.mamaBleed, 'ronda par: sangrado al rival');
  console.log('  ✓ Papa Bear y Mama Bear');
}

// --- Bloodpact: +15 al golpe y vos sangrás ---------------------------------------------
{
  const game = await standWith(hitting('blood'));
  assert.equal(game.state.totals.p1, scoreChain(hitting('blood')).total + TUNING.bloodDamage);
  assert.equal(game.state.status.p1.bleed, TUNING.bloodSelf, 'el pacto te deja sangrando');
  console.log('  ✓ Bloodpact');
}

// --- Black Sage: le saca todo antes del golpe ---------------------------------------------
{
  const game = await standWith(hitting('dispel'), (s) => {
    Object.assign(s.status.p2, { egg: 10, spikes: 14, feathers: 2, rage: 3, gift: 15 });
  });
  const st = game.state.status.p2;
  assert.deepEqual([st.egg, st.spikes, st.feathers, st.rage, st.gift], [0, 0, 0, 0, 0], 'todo afuera');
  assert.equal(game.state.totals.p1, scoreChain(hitting('dispel')).total, 'el escudo no frena nada');
  assert.equal(game.state.totals.p2, 0, 'sin espinas que vuelvan');
  console.log('  ✓ Black Sage');
}

// --- Earth Stamp: al cortarte, una carta del centro de regalo -------------------------------
{
  const game = await standWith(chainOf(card(['aquatic'], 'stamp'), breaker()));
  const s = game.state;
  assert.equal(s.phase, 'draft');
  assert.equal(s.status.p1.stamps, 1);
  const plain = s.market.find((c) => !c.power);
  await game.takeCard(plain.uid);
  assert.equal(s.draft.step, 'bonus', 'después de la del corte, la de regalo');
  assert.equal(s.draft.bonusBy, 'stamp');
  assert.deepEqual(draftableFor(s, 'p1'), s.market, 'cualquiera, con poder también');
  await game.takeCard(s.market[0].uid);
  await idle();
  assert.equal(s.status.p1.stamps, 0);
  assert.equal(s.added.p1.length, 2, 'la del corte y la de regalo');
  console.log('  ✓ Earth Stamp');
}

// --- Scotch Tape: la cadena queda pegada hasta la cinta y ataca ------------------------------
{
  const game = await atPlayerTurn(chainOf(card(['aquatic', 'bird'])));
  const s = game.state;
  const after = card(['aquatic']);
  const cut = breaker();
  s.decks.p1.push(card(['aquatic'], 'tape'));
  await game.hit();
  s.decks.p1.push(after);
  await game.hit();
  s.decks.p1.push(cut);
  await game.hit();
  await idle();
  // Pegada: pez 2 (la primera y la cinta) y pájaro 1. Lo de después no cuenta.
  assert.equal(s.totals.p1, 2 * 2 + 1, 'ataca con la cadena hasta la cinta');
  assert.equal(s.added.p1.length, 0, 'sin centro');
  assert.ok(s.decks.p1.includes(after) && s.decks.p1.includes(cut), 'lo de después y la que cortó vuelven al mazo');
  // Con una Earth Stamp en la cadena, la carta de regalo sí.
  const stamped = await atPlayerTurn(chainOf(card(['aquatic', 'bird'], 'stamp')));
  stamped.state.decks.p1.push(card(['aquatic'], 'tape'));
  await stamped.hit();
  stamped.state.decks.p1.push(breaker());
  await stamped.hit();
  await idle();
  assert.equal(stamped.state.draft?.step, 'bonus', 'pegada y con sello: la de regalo');
  assert.equal(stamped.state.draft.bonusBy, 'stamp');
  console.log('  ✓ Scotch Tape');
}

// --- Last Gift: al cortarte, +15 en tu próximo ataque ---------------------------------------
{
  const game = await standWith(chainOf(card(['aquatic'], 'gift'), breaker()));
  const s = game.state;
  assert.equal(s.status.p1.gift, TUNING.giftDamage);
  s.chains.p1 = hitting();
  assert.equal(swingOf(s, 'p1'), scoreChain(hitting()).total + TUNING.giftDamage, 'suma al próximo golpe');
  const two = await standWith(chainOf(card(['aquatic'], 'gift'), card(['aquatic'], 'gift'), card(['aquatic'], 'gift'), breaker()));
  assert.equal(two.state.status.p1.gift, TUNING.giftMax, 'con tope');
  console.log('  ✓ Last Gift');
}

console.log('✓ poderes ok');
