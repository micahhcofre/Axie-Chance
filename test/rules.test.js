import assert from 'node:assert/strict';
import { buildPool, buildPersonalDeck, UNFAVORABLE, SYMBOL_IDS } from '../src/data.js';
import { emptyChain, playCard, scoreChain, activeSymbols, survivalOdds } from '../src/rules.js';
import { decideDraw } from '../src/ai.js';

let uid = 0;
const card = (...symbols) => ({ uid: uid++, symbols, key: symbols.join('+') });
const chainOf = (...cards) => cards.reduce(playCard, emptyChain());

// --- ejemplo de las reglas ---------------------------------------------------
{
  const c = chainOf(
    card('aquatic', 'bird'),
    card('bird', 'aquatic', 'beast'),
    card('bird', 'plant'),
  );
  assert.equal(c.busted, false);
  const { total, breakdown } = scoreChain(c);
  const by = Object.fromEntries(breakdown.map((r) => [r.symbol, r]));
  assert.equal(by.bird.length, 3);
  assert.equal(by.bird.points, 9);
  assert.equal(by.aquatic.length, 2);
  assert.equal(by.aquatic.points, 4);
  assert.equal(breakdown.length, 2, 'beast y plant no abren cadena: no estaban en la 1ª carta');
  assert.equal(total, 13);
  assert.deepEqual(activeSymbols(c), ['bird']);
}

// --- corte de cadena ---------------------------------------------------------
{
  const c = chainOf(card('aquatic', 'bird'), card('bird'), card('aquatic', 'plant'));
  assert.equal(c.busted, true, 'aquatic ya estaba muerto: no revive');
  assert.equal(scoreChain(c).total, 0);
  assert.equal(c.bustCard.symbols.includes('plant'), true);
}

// --- una sola carta ----------------------------------------------------------
{
  assert.equal(scoreChain(chainOf(card('bug'))).total, 1);
  assert.equal(scoreChain(chainOf(card('bug', 'plant', 'reptile'))).total, 3);
}

// --- inmutabilidad (la IA simula sobre copias) -------------------------------
{
  const base = chainOf(card('bird', 'plant'));
  const next = playCard(base, card('bird'));
  assert.equal(base.cards.length, 1);
  assert.equal(base.runs.find((r) => r.symbol === 'plant').alive, true);
  assert.equal(next.runs.find((r) => r.symbol === 'plant').alive, false);
}

// --- reserva común -----------------------------------------------------------
{
  assert.equal(SYMBOL_IDS.length, 6);
  const pool = buildPool();
  assert.equal(pool.length, 35, '15 pares + 20 tríos');
  assert.ok(pool.every((c) => c.symbols.length === 2 || c.symbols.length === 3));
  assert.equal(new Set(pool.map((c) => c.key)).size, 35, 'ninguna combinación repetida');
  assert.equal(pool.filter((c) => c.symbols.includes('bird')).length, 15);
}

// --- mazo personal -----------------------------------------------------------
{
  // Los 6 pares no favorables son dos triángulos disjuntos, así que cada símbolo
  // aparece en exactamente dos y a todo jugador le sobran justo cuatro.
  assert.equal(UNFAVORABLE.length, 6);
  for (const id of SYMBOL_IDS) {
    assert.equal(UNFAVORABLE.filter((pair) => pair.includes(id)).length, 2, id);
  }

  for (const id of SYMBOL_IDS) {
    const deck = buildPersonalDeck(id);
    assert.equal(deck.length, 10, `${id}: mazo de 10`);
    assert.equal(new Set(deck.map((c) => c.key)).size, 10, `${id}: sin repetidas`);

    const own = deck.filter((c) => c.symbols.includes(id));
    assert.equal(own.length, 6, `${id}: 5 pares propios + la carta sola`);
    assert.equal(own.filter((c) => c.symbols.length === 1).length, 1, `${id}: una carta sola`);
    // Los 5 pares propios cubren cada uno de los otros símbolos, sin repetir.
    const partners = own.filter((c) => c.symbols.length === 2).flatMap((c) => c.symbols)
      .filter((s) => s !== id);
    assert.deepEqual(partners.sort(), SYMBOL_IDS.filter((s) => s !== id).sort(), id);

    const foreign = deck.filter((c) => !c.symbols.includes(id));
    assert.equal(foreign.length, 4, `${id}: 4 cartas no favorables`);
    assert.ok(
      foreign.every((c) => UNFAVORABLE.some((pair) => pair.join('+') === c.symbols.join('+')
        || pair.slice().reverse().join('+') === c.symbols.join('+'))),
      `${id}: las ajenas salen de la lista no favorable`,
    );
  }

  // Los uid no se repiten entre mazos: la UI los usa para no reanimar cartas.
  const all = [...buildPersonalDeck('bird'), ...buildPersonalDeck('bug'), ...buildPool()];
  assert.equal(new Set(all.map((c) => c.uid)).size, all.length, 'uid únicos entre mazos');

  const deck = buildPersonalDeck('aquatic');
  const odds = survivalOdds(chainOf(card('aquatic')), deck);
  assert.equal(odds.ok, 6, 'de 10 cartas, 6 llevan el símbolo propio');
  assert.equal(odds.total, 10);
}

// --- IA ----------------------------------------------------------------------
{
  const deck = buildPool();

  // Con una cadena recién abierta de 3 símbolos siempre conviene robar.
  assert.equal(decideDraw(chainOf(card('bird', 'plant', 'bug')), deck, { difficulty: 'duro' }), true);

  // Con un solo símbolo vivo y una racha larga, plantarse.
  const risky = chainOf(card('bird'), card('bird', 'plant'), card('bird', 'bug'), card('bird', 'beast'));
  assert.equal(scoreChain(risky).total, 16);
  assert.equal(decideDraw(risky, deck, { difficulty: 'duro' }), false);

  // `needs` manda por encima del EV: si plantarse pierde igual, roba.
  assert.equal(decideDraw(risky, deck, { needs: 30, difficulty: 'duro' }), true);
  assert.equal(decideDraw(risky, deck, { needs: 10, difficulty: 'duro' }), false);

  const t0 = performance.now();
  decideDraw(chainOf(card('bird', 'plant', 'bug')), deck, { difficulty: 'duro' });
  const ms = performance.now() - t0;
  assert.ok(ms < 400, `lookahead demasiado lento: ${ms.toFixed(0)}ms`);
  console.log(`  lookahead 'duro' desde cadena de 3 símbolos: ${ms.toFixed(1)}ms`);
}

// --- el roster --------------------------------------------------------------
{
  const { AXIES, AXIE_IDS, axie, deckFor, axieArt } = await import('../src/axies.js');
  const { AVATARS, PART_CATALOG } = await import('../src/axie-avatars.js');

  assert.equal(AXIE_IDS.length, 6, 'seis Axies');
  assert.deepEqual(
    AXIE_IDS.map((id) => AXIES[id].class).sort(),
    SYMBOL_IDS.slice().sort(),
    'uno por clase, sin repetir',
  );

  for (const id of AXIE_IDS) {
    const a = AXIES[id];
    assert.equal(a.id, id, `${id}: el id coincide con la clave`);
    assert.ok(a.name, `${id}: sin nombre`);

    // Cada Axie arranca con el mazo de su clase.
    assert.deepEqual(
      deckFor(id).map((c) => c.key).sort(),
      buildPersonalDeck(a.class).map((c) => c.key).sort(),
      `${id}: el mazo no es el de su clase`,
    );

    // Las partes salen del catálogo que dejó el mixer, así que `npm run axies` las dibuja.
    for (const [type, part] of Object.entries(a.parts)) {
      assert.ok(
        PART_CATALOG[a.class][type].includes(part),
        `${id}: ${type} ${part} no está en el catálogo de ${a.class}`,
      );
    }

    // Y el manifiesto de capas está al día con el roster.
    assert.ok(AVATARS[id]?.layers.length > 0, `${id}: sin capas — corré npm run axies`);
    assert.deepEqual(
      AVATARS[id].from,
      { class: a.class, color: a.color, parts: a.parts },
      `${id}: el dibujo es de otras partes — corré npm run axies`,
    );
    assert.match(axieArt(id), /class="axie/);
    assert.match(axieArt(id), /axie-fallback/, `${id}: falta el crest de reserva`);
  }

  // Un id que no existe no rompe el render: cae en el primero del roster.
  assert.equal(axie('no-existe').id, AXIE_IDS[0]);
}

console.log('✓ todos los tests pasan');
