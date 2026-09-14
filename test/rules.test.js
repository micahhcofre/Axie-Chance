import assert from 'node:assert/strict';
import {
  buildPool, buildPersonalDeck, buildAxieDeck, toAxieNFTState, boostOptions, UNFAVORABLE, SYMBOL_IDS, POWER_IDS, CLASS_POWER_IDS, POWERS,
  POWER_TRIOS, CANONICAL_CLASSES, ANATOMICAL_PARTS, ANATOMICAL_JUMPS, TRIADS, TRIAD_BEATS, TRIAD_LOSES_TO,
  getTriadForClass, getCounterSuppressionCards,
} from '../src/data.js';
import {
  emptyChain, playCard, scoreChain, activeSymbols, isScoringCell, survivalOdds, stackOnCard,
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
  assert.ok(mazo({ 'plant+reptile': 'reptile' }).includes('plant+reptile+reptile'),
    'la no favorable admite uno de sus dos');
  assert.deepEqual(mazo({ 'beast+bird': 'plant' }), mazo({}),
    'a la propia no se le puede sumar cualquier otro símbolo');
  assert.deepEqual(mazo({ 'plant+reptile': 'beast' }), mazo({}),
    'a la no favorable tampoco: solo los que ya tiene');
  assert.deepEqual(mazo({ 'plant+bird': 'plant' }), mazo({}),
    'una clave de otro mazo se ignora en silencio');
  assert.deepEqual(boostOptions({ symbols: ['beast', 'bird'] }, 'beast'), ['beast']);
  assert.deepEqual(boostOptions({ symbols: ['plant', 'reptile'] }, 'beast'), ['plant', 'reptile']);
  assert.deepEqual(boostOptions({ symbols: ['beast'] }, 'beast'), ['beast'],
    'la carta de un símbolo solo también se puede mejorar');
  // Diecinueve símbolos en diez cartas; cada mejora suma uno.
  const cuenta = (boosts) => buildPersonalDeck('beast', boosts)
    .reduce((n, c) => n + c.symbols.length, 0);
  assert.equal(cuenta({}), 19);
  assert.equal(cuenta({ 'beast+bird': 'beast', 'plant+reptile': 'reptile' }), 21);
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
  assert.equal(pool.length, 86, '35 sin poder + 36 con poder de clase + 15 neutrales');
  assert.ok(pool.every((c) => c.symbols.length === 2 || c.symbols.length === 3));
  assert.equal(new Set(pool.map((c) => c.key)).size, 86, 'ninguna carta repetida');

  const plain = pool.filter((c) => !c.power);
  assert.equal(plain.length, 35, '15 pares + 20 tríos, una por combinación');
  assert.equal(new Set(plain.map((c) => c.key)).size, 35, 'ninguna combinación repetida');
  assert.equal(plain.filter((c) => c.symbols.includes('bird')).length, 15);
}

// --- las cartas con poder ----------------------------------------------------
{
  const pool = buildPool();
  const powered = pool.filter((c) => c.power);
  assert.equal(powered.length, 51, '36 cartas de poderes de clase + 15 neutrales Free Game');
  const classPowered = powered.filter((c) => c.power !== 'freegame');
  assert.equal(classPowered.length, 36, 'seis cartas por poder de clase');
  const active = [...new Set(classPowered.map((c) => c.power))];
  assert.equal(active.length, 6, 'un poder por clase en la reserva');
  assert.ok(POWER_IDS.length >= 7);

  // Poderes de clase: todas son tríos y llevan la clase de su propio poder
  for (const id of CLASS_POWER_IDS) {
    assert.equal(POWER_TRIOS[id].length, 6, `${id}: seis pares de acompañantes`);
    const trios = POWER_TRIOS[id].map((pair) => [POWERS[id].symbol, ...pair].sort());
    for (const symbols of trios) {
      assert.equal(symbols.length, 3, `${id}: son tríos`);
      assert.ok(symbols.includes(POWERS[id].symbol), `${id}: falta su propia clase`);
    }
    const keys = trios.map((s) => s.join('+'));
    assert.equal(new Set(keys).size, 6, `${id}: sin tríos repetidos`);
  }

  // Cartas neutrales de Free Game: 15 pares, 5 apariciones de cada clase
  const freegameCards = powered.filter((c) => c.power === 'freegame');
  assert.equal(freegameCards.length, 15, '15 cartas neutrales de Free Game');
  assert.ok(freegameCards.every((c) => c.symbols.length === 2), 'todas son pares');
  for (const sym of SYMBOL_IDS) {
    const count = freegameCards.filter((c) => c.symbols.includes(sym)).length;
    assert.equal(count, 5, `${sym}: aparece exactamente 5 veces en los pares de Free Game`);
  }

  // El reparto de clase está equilibrado: cada clase aparece 18 veces entre las 36 cartas de clase
  for (const id of SYMBOL_IDS) {
    const seen = classPowered.filter((c) => c.symbols.includes(id)).length;
    assert.equal(seen, 18, `${id}: aparece ${seen} veces y no 18 en cartas de clase`);
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

// --- mazo personal, tríadas y Axie Core --------------------------------------
{
  assert.equal(CANONICAL_CLASSES.length, 6);
  assert.deepEqual(CANONICAL_CLASSES, ['plant', 'beast', 'aquatic', 'bird', 'bug', 'reptile']);

  // Tríadas canónicas (Piedra, Papel o Tijera)
  assert.deepEqual(TRIADS.rock, ['plant', 'reptile']);
  assert.deepEqual(TRIADS.paper, ['beast', 'bug']);
  assert.deepEqual(TRIADS.scissors, ['bird', 'aquatic']);

  // Regla de combate: Paper vence a Rock, Scissors vence a Paper, Rock vence a Scissors
  assert.equal(TRIAD_BEATS.paper, 'rock');
  assert.equal(TRIAD_BEATS.scissors, 'paper');
  assert.equal(TRIAD_BEATS.rock, 'scissors');

  // Saltos anatómicos y Counter Suppression Formula para las 6 clases
  for (let i = 0; i < CANONICAL_CLASSES.length; i++) {
    const cls = CANONICAL_CLASSES[i];
    const deck = buildPersonalDeck(cls);
    assert.equal(deck.length, 10, `${cls}: mazo de 10`);
    assert.equal(new Set(deck.map((c) => c.key)).size, 10, `${cls}: sin repetidas`);

    // 6 cartas anatómicas favorables
    const favorable = deck.filter((c) => c.isFavorable);
    assert.equal(favorable.length, 6, `${cls}: 6 cartas anatómicas favorables`);

    const tail = favorable.find((c) => c.associatedPart === 'tail');
    assert.deepEqual(tail.symbols, [cls], `${cls}: cola es mono-símbolo pura`);

    const mouth = favorable.find((c) => c.associatedPart === 'mouth');
    assert.ok(mouth.symbols.includes(cls) && mouth.symbols.includes(CANONICAL_CLASSES[(i + 1) % 6]));

    const eyes = favorable.find((c) => c.associatedPart === 'eyes');
    assert.ok(eyes.symbols.includes(cls) && eyes.symbols.includes(CANONICAL_CLASSES[(i + 2) % 6]));

    const ears = favorable.find((c) => c.associatedPart === 'ears');
    assert.ok(ears.symbols.includes(cls) && ears.symbols.includes(CANONICAL_CLASSES[(i + 3) % 6]));

    const horn = favorable.find((c) => c.associatedPart === 'horn');
    assert.ok(horn.symbols.includes(cls) && horn.symbols.includes(CANONICAL_CLASSES[(i + 4) % 6]));

    const back = favorable.find((c) => c.associatedPart === 'back');
    assert.ok(back.symbols.includes(cls) && back.symbols.includes(CANONICAL_CLASSES[(i + 5) % 6]));

    // 4 cartas desfavorables (Counter Suppression Formula)
    const foreign = deck.filter((c) => !c.isFavorable);
    assert.equal(foreign.length, 4, `${cls}: 4 cartas no favorables`);
    assert.ok(foreign.every((c) => !c.symbols.includes(cls)), `${cls}: ninguna desfavorable contiene la clase base`);

    // Verificación matemática canónica:
    // En las cartas desfavorables, las Presas y el Aliado aparecen 2 veces cada una,
    // mientras que los Counters aparecen exactamente 1 vez.
    const triad = getTriadForClass(cls);
    const ally = TRIADS[triad].find((c) => c !== cls);
    const preys = TRIADS[TRIAD_BEATS[triad]];
    const counters = TRIADS[TRIAD_LOSES_TO[triad]];

    const foreignSyms = foreign.flatMap((c) => c.symbols);
    const countSym = (s) => foreignSyms.filter((sym) => sym === s).length;

    assert.equal(countSym(ally), 2, `${cls}: el Aliado (${ally}) aparece 2 veces`);
    assert.equal(countSym(preys[0]), 2, `${cls}: Presa 1 (${preys[0]}) aparece 2 veces`);
    assert.equal(countSym(preys[1]), 2, `${cls}: Presa 2 (${preys[1]}) aparece 2 veces`);
    assert.equal(countSym(counters[0]), 1, `${cls}: Counter 1 (${counters[0]}) aparece 1 vez`);
    assert.equal(countSym(counters[1]), 1, `${cls}: Counter 2 (${counters[1]}) aparece 1 vez`);
    assert.equal(foreignSyms.length, 8, `${cls}: 8 símbolos en las 4 cartas desfavorables`);
  }

  // Axie Core - Part Evolution (Mutación a 3 símbolos / 2 en cola)
  const nftState = {
    id: 'custom-beast',
    baseClass: 'beast',
    parts: {
      tail: { class: 'beast', isEvolved: true },
      mouth: { class: 'beast', isEvolved: false },
      eyes: { class: 'aquatic', isEvolved: true }, // parte híbrida evolucionada
      ears: { class: 'beast', isEvolved: true },
      horn: { class: 'plant', isEvolved: true },   // parte híbrida evolucionada
      back: { class: 'beast', isEvolved: false },
    },
  };

  const evolvedDeck = buildAxieDeck(nftState);
  assert.equal(evolvedDeck.length, 10);
  const evoTail = evolvedDeck.find((c) => c.associatedPart === 'tail');
  assert.deepEqual(evoTail.symbols, ['beast', 'beast'], 'cola evolucionada tiene 2 símbolos');

  const evoEyes = evolvedDeck.find((c) => c.associatedPart === 'eyes');
  // eyes base es [beast, bird] + mutación aquatic -> [aquatic, beast, bird]
  assert.equal(evoEyes.symbols.length, 3, 'ojos evolucionados mutan a 3 símbolos');
  assert.ok(evoEyes.symbols.includes('aquatic'), 'incorpora la clase de la parte NFT');

  const unevoMouth = evolvedDeck.find((c) => c.associatedPart === 'mouth');
  assert.equal(unevoMouth.symbols.length, 2, 'boca no evolucionada conserva 2 símbolos');

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

// --- stackOnCard (Free Game) -------------------------------------------------
{
  // Apertura con Pez + Bestia
  const initial = chainOf(card('aquatic', 'beast'));
  assert.equal(initial.cards.length, 1);
  assert.equal(scoreChain(initial).total, 2); // 1^2 + 1^2

  // Montar Pez + Pájaro sobre la Columna 1
  const stacked = stackOnCard(initial, 0, card('aquatic', 'bird'));
  assert.equal(stacked.cards.length, 1, 'no avanza la cantidad de cartas');
  assert.equal(stacked.cards[0].symbols.length, 4, 'contiene los 4 símbolos');
  assert.equal(stacked.busted, false);

  // Pez ahora tiene racha de 2 (largo 2 -> 4 pts), Bestia 1 pt, Pájaro 1 pt = 6 pts
  const sc = scoreChain(stacked);
  assert.equal(sc.total, 6);

  // Continuar la cadena con una segunda columna que conecta
  const col2 = playCard(stacked, card('bird', 'plant'));
  assert.equal(col2.busted, false);
  assert.equal(col2.cards.length, 2);

  // Montar una carta sobre la Columna 2 con símbolos que no están vivos no corta
  const col2Stacked = stackOnCard(col2, 1, card('reptile', 'bug'));
  assert.equal(col2Stacked.busted, false, 'alargar columna no produce bust');
  assert.equal(col2Stacked.cards.length, 2);
}

console.log('✓ todos los tests pasan');
