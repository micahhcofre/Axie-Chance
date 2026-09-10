import assert from 'node:assert/strict';
import {
  buildPool, buildPersonalDeck, boostOptions, UNFAVORABLE, SYMBOL_IDS, POWER_IDS, POWERS,
  POWER_TRIOS,
} from '../src/data.js';
import {
  emptyChain, playCard, scoreChain, activeSymbols, isScoringCell, survivalOdds,
} from '../src/rules.js';
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

// --- el símbolo repetido: las mejoras del Axie -------------------------------
// Una carta mejorada trae el mismo símbolo dos veces, y la racha cuenta cada aparición:
// abre en 2 y adelanta de a 2. Es todo lo que hacen las mejoras, y por eso valen — la
// racha puntúa al cuadrado.
{
  const sola = chainOf(card('beast', 'beast', 'bird'));
  assert.equal(sola.runs.length, 2, 'un símbolo repetido no abre dos rachas');
  const abre = Object.fromEntries(sola.runs.map((r) => [r.symbol, r]));
  assert.equal(abre.beast.length, 2, 'la carta mejorada abre su racha en 2');
  assert.equal(abre.bird.length, 1);
  assert.equal(scoreChain(sola).total, 5, '2² + 1²');

  const c = chainOf(card('beast', 'bird'), card('beast', 'beast', 'bird'));
  const by = Object.fromEntries(scoreChain(c).breakdown.map((r) => [r.symbol, r]));
  assert.equal(by.beast.length, 3, 'la mejorada adelanta la racha de a dos');
  assert.equal(by.beast.cards, 2, 'pero son dos cartas, no tres');
  assert.equal(by.bird.length, 2);
  assert.equal(scoreChain(c).total, 13, '3² + 2²');
  // Lo que pinta la mesa va por cartas y no por largo: si fuera por largo, la carta
  // mejorada encendería una casilla de una carta que todavía no salió.
  assert.equal(isScoringCell(c, 1, 'beast'), true);
  assert.equal(isScoringCell(c, 2, 'beast'), false, 'la racha llega hasta la 2ª carta');

  // Y la mejora no cambia con qué encadena: dos beast siguen siendo beast.
  assert.equal(chainOf(card('plant'), card('beast', 'beast', 'bird')).busted, true);
}

// --- el mazo mejorado --------------------------------------------------------
// `boosts` va de la clave de la carta sin mejorar al símbolo que se le suma. Solo se
// aplica lo que la carta admite: el tuyo en las seis propias, uno de sus dos en las
// cuatro no favorables.
{
  const mazo = (boosts) => buildPersonalDeck('beast', boosts).map((c) => c.symbols.join('+'));
  assert.ok(mazo({ 'beast+bird': 'beast' }).includes('beast+beast+bird'), 'la propia admite el tuyo');
  assert.ok(mazo({ 'aquatic+reptile': 'reptile' }).includes('aquatic+reptile+reptile'),
    'la no favorable admite uno de sus dos');
  assert.deepEqual(mazo({ 'beast+bird': 'plant' }), mazo({}),
    'a la propia no se le puede sumar cualquier otro símbolo');
  assert.deepEqual(mazo({ 'aquatic+reptile': 'beast' }), mazo({}),
    'a la no favorable tampoco: solo los que ya tiene');
  assert.deepEqual(mazo({ 'plant+bird': 'plant' }), mazo({}),
    'una clave de otro mazo se ignora en silencio');
  assert.deepEqual(boostOptions({ symbols: ['beast', 'bird'] }, 'beast'), ['beast']);
  assert.deepEqual(boostOptions({ symbols: ['aquatic', 'reptile'] }, 'beast'), ['aquatic', 'reptile']);
  assert.deepEqual(boostOptions({ symbols: ['beast'] }, 'beast'), ['beast'],
    'la carta de un símbolo solo también se puede mejorar');
  // Diecinueve símbolos en diez cartas; cada mejora suma uno.
  const cuenta = (boosts) => buildPersonalDeck('beast', boosts)
    .reduce((n, c) => n + c.symbols.length, 0);
  assert.equal(cuenta({}), 19);
  assert.equal(cuenta({ 'beast+bird': 'beast', 'aquatic+reptile': 'reptile' }), 21);
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
  assert.equal(pool.length, 71, '35 sin poder + 36 con poder');
  assert.ok(pool.every((c) => c.symbols.length === 2 || c.symbols.length === 3));
  assert.equal(new Set(pool.map((c) => c.key)).size, 71, 'ninguna carta repetida');

  const plain = pool.filter((c) => !c.power);
  assert.equal(plain.length, 35, '15 pares + 20 tríos, una por combinación');
  assert.equal(new Set(plain.map((c) => c.key)).size, 35, 'ninguna combinación repetida');
  assert.equal(plain.filter((c) => c.symbols.includes('bird')).length, 15);
}

// --- las cartas con poder ----------------------------------------------------
{
  const pool = buildPool();
  const powered = pool.filter((c) => c.power);
  assert.equal(powered.length, 36, 'seis cartas por poder');
  assert.equal(POWER_IDS.length, 6);

  // Todas son tríos y todas llevan la clase de su propio poder: el efecto de tu
  // color tiene que encadenar con tu mazo mejor que con ningún otro.
  for (const id of POWER_IDS) {
    const cards = powered.filter((c) => c.power === id);
    assert.equal(cards.length, 6, `${id}: seis cartas`);
    assert.equal(POWER_TRIOS[id].length, 6, `${id}: seis pares de acompañantes`);
    for (const c of cards) {
      assert.equal(c.symbols.length, 3, `${id}: son tríos`);
      assert.ok(c.symbols.includes(POWERS[id].symbol), `${id}: falta su propia clase`);
    }
    assert.equal(new Set(cards.map((c) => c.key)).size, 6, `${id}: sin tríos repetidos`);
  }

  // El reparto está equilibrado: cada clase aparece 18 veces entre las 36 cartas,
  // 6 como dueña de su poder y 12 como acompañante.
  for (const id of SYMBOL_IDS) {
    const seen = powered.filter((c) => c.symbols.includes(id)).length;
    assert.equal(seen, 18, `${id}: aparece ${seen} veces y no 18`);
    assert.equal(powered.filter((c) => c.power === id).length, 0, `${id} no es un poder`);
  }

  // Los mazos iniciales no traen poderes: los seis solo salen del centro.
  for (const id of SYMBOL_IDS) {
    assert.ok(buildPersonalDeck(id).every((c) => !c.power), `${id}: mazo base sin poderes`);
  }

  // Dos cartas con los mismos símbolos y poderes distintos son cartas distintas.
  const trios = powered.map((c) => c.symbols.join('+'));
  assert.ok(new Set(trios).size < trios.length, '36 cartas sobre 20 tríos: alguno se repite');
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

  // La última chance (`needs`): el empate es el único final que le queda.
  const fresh = chainOf(card('bird', 'plant', 'bug'));
  assert.equal(scoreChain(fresh).total, 3);
  // Con lo que ya tiene alcanza: se planta y lo asegura, aunque el EV diga robar
  // —robar no puede mejorar un empate y sí puede perderlo—.
  assert.equal(decideDraw(fresh, deck, { needs: 3, difficulty: 'duro' }), false);
  // Si todavía no alcanza, no persigue el número: sigue con su cabeza de siempre. Acá
  // eso es robar, porque la cadena recién abierta lo pide.
  assert.equal(decideDraw(fresh, deck, { needs: 30, difficulty: 'duro' }), true);
  // Y acá es plantarse, con el mismo número imposible: perseguirlo sería robar hasta
  // cortarse y dejar el golpe final en 0.
  assert.equal(decideDraw(risky, deck, { needs: 30, difficulty: 'duro' }), false);
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
