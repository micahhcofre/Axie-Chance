import assert from 'node:assert/strict';
import {
  buildPool, buildPersonalDeck, buildAxieDeck, toAxieNFTState, boostOptions, UNFAVORABLE, SYMBOL_IDS, POWER_IDS, CLASS_POWER_IDS, POWERS,
  POWER_TRIOS, CANONICAL_CLASSES, ANATOMICAL_PARTS, ANATOMICAL_JUMPS, TRIADS, TRIAD_BEATS, TRIAD_LOSES_TO,
  getTriadForClass, getCounterSuppressionCards,
} from '../src/data.js';
import {
  emptyChain, playCard, scoreChain, activeSymbols, isScoringCell, survivalOdds, stackOnCard, bestStack, isFreeStack,
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
// dos no favorables.
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
  // Quince símbolos en ocho cartas; cada mejora suma uno.
  const cuenta = (boosts) => buildPersonalDeck('beast', boosts)
    .reduce((n, c) => n + c.symbols.length, 0);
  assert.equal(cuenta({}), 15);
  assert.equal(cuenta({ 'beast+bird': 'beast', 'plant+reptile': 'reptile' }), 17);
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
    assert.equal(deck.length, 8, `${cls}: mazo de 8`);
    assert.equal(new Set(deck.map((c) => c.key)).size, 8, `${cls}: sin repetidas`);

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

    // 2 cartas desfavorables (Counter Suppression Formula)
    const foreign = deck.filter((c) => !c.isFavorable);
    assert.equal(foreign.length, 2, `${cls}: 2 cartas no favorables`);
    assert.ok(foreign.every((c) => !c.symbols.includes(cls)), `${cls}: ninguna desfavorable contiene la clase base`);

    // Verificación matemática canónica: una carta por tríada rival —la doble presa y
    // el confinamiento—, el Aliado afuera, y ningún símbolo en las dos a la vez.
    const triad = getTriadForClass(cls);
    const ally = TRIADS[triad].find((c) => c !== cls);
    const preys = TRIADS[TRIAD_BEATS[triad]];
    const counters = TRIADS[TRIAD_LOSES_TO[triad]];
    const same = (card, pair) => [...card.symbols].sort().join() === [...pair].sort().join();

    assert.ok(foreign.some((c) => same(c, preys)), `${cls}: Doble Presa [${preys}]`);
    assert.ok(foreign.some((c) => same(c, counters)), `${cls}: Confinamiento [${counters}]`);
    assert.ok(foreign.every((c) => !c.symbols.includes(ally)), `${cls}: el Aliado (${ally}) no es desfavorable`);

    const foreignSyms = foreign.flatMap((c) => c.symbols);
    assert.equal(new Set(foreignSyms).size, foreignSyms.length,
      `${cls}: ningún símbolo en las dos desfavorables (no hay cadena asegurada)`);
    assert.equal(foreignSyms.length, 4, `${cls}: 4 símbolos en las 2 cartas desfavorables`);

    // Aunque un mismo símbolo ajeno se le sume a las seis favorables, queda una
    // desfavorable que no lo lleva: siempre hay una carta que corta.
    for (const x of CANONICAL_CLASSES.filter((c) => c !== cls)) {
      assert.ok(foreign.some((c) => !c.symbols.includes(x)), `${cls}: con ${x} en todo, algo corta`);
    }
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
  assert.equal(evolvedDeck.length, 8);
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
  assert.equal(odds.ok, 6, 'de 8 cartas, 6 llevan el símbolo propio');
  assert.equal(odds.total, 8);
}

// --- IA ----------------------------------------------------------------------
{
  const deck = buildPool();

  // Con una cadena recién abierta de 3 símbolos siempre conviene robar.
  for (const difficulty of ['facil', 'normal', 'duro']) {
    assert.equal(decideDraw(chainOf(card('bird', 'plant', 'bug')), deck, { difficulty }), true, difficulty);
  }

  // Con un solo símbolo vivo y una racha larga, plantarse.
  const risky = chainOf(card('bird'), card('bird', 'plant'), card('bird', 'bug'), card('bird', 'beast'));
  assert.equal(scoreChain(risky).total, 16);
  assert.equal(decideDraw(risky, deck, { difficulty: 'normal' }), false);
  assert.equal(decideDraw(risky, deck, { difficulty: 'duro' }), false);

  // La última chance (`needs`): el empate es el único final que le queda.
  const fresh = chainOf(card('bird', 'plant', 'bug'));
  assert.equal(scoreChain(fresh).total, 3);
  // Con lo que ya tiene alcanza: se planta y lo asegura, aunque el EV diga robar
  // —robar no puede mejorar un empate y sí puede perderlo—.
  assert.equal(decideDraw(fresh, deck, { needs: 3, difficulty: 'normal' }), false);
  assert.equal(decideDraw(fresh, deck, { needs: 3, difficulty: 'duro' }), false);
  // "Fácil" no juega el final: roba igual.
  assert.equal(decideDraw(fresh, deck, { needs: 3, difficulty: 'facil' }), true);
  // Si todavía no alcanza, "normal" no persigue el número: sigue con su cabeza de
  // siempre. Acá eso es robar, porque la cadena recién abierta lo pide.
  assert.equal(decideDraw(fresh, deck, { needs: 30, difficulty: 'normal' }), true);
  // Y acá es plantarse, con el mismo número imposible.
  assert.equal(decideDraw(risky, deck, { needs: 30, difficulty: 'normal' }), false);
  assert.equal(decideDraw(risky, deck, { needs: 10, difficulty: 'normal' }), false);
  // "Duro" sabe que un golpe que no empata pierde igual: con 16 contra 30 va a buscarlo.
  assert.equal(decideDraw(risky, deck, { needs: 30, difficulty: 'duro' }), true);
  assert.equal(decideDraw(risky, deck, { needs: 10, difficulty: 'duro' }), false);
}

// --- IA "duro": el ataque contra la partida ----------------------------------
{
  const view = (over = {}) => ({
    feathers: 0, weak: 0, claws: 0, myHp: 100, maxHp: 100, myShield: 0, myCap: 0, myPoison: 0, myBleed: 0,
    foeHp: 100, foeShield: 0, foeSpikes: 0, foeGloves: 0, foeCap: 0, lastChance: false, saves: 0, ...over,
  });
  // Poderes fijos: con el pool sorteado, un Secret Egg y los Rocket Stamp —que no cortan
  // nunca— dejan robar apenas por encima de plantarse con el golpe que ya lo tumba, y
  // el test pasaba o fallaba según el sorteo.
  const deck = buildPool(['strength', 'octopus', 'feather', 'pot', 'snail', 'poison']);
  const fresh = chainOf(card('bird', 'plant', 'bug'));

  // Si plantarse ya lo deja sin vida, se planta: "normal" seguiría robando por puntos.
  assert.equal(decideDraw(fresh, deck, { difficulty: 'normal' }), true);
  assert.equal(decideDraw(fresh, deck, { difficulty: 'duro', view: view({ foeHp: 3 }) }), false);
  assert.equal(decideDraw(fresh, deck, { difficulty: 'duro', view: view({ foeHp: 20 }) }), true);

  // Un mazo donde 7 de 10 cartas siguen la racha: robar conviene por puntos.
  const sevenOfTen = [
    ...Array.from({ length: 7 }, () => card('bird', 'aquatic')),
    ...Array.from({ length: 3 }, () => card('reptile')),
  ];
  const plain = chainOf(card('bird', 'plant'), card('bird', 'bug'));
  const poisoned = chainOf(card('bird', 'plant'), { ...card('bird', 'bug'), power: 'poison' });
  assert.equal(decideDraw(plain, sevenOfTen, { difficulty: 'normal' }), true);
  assert.equal(decideDraw(plain, sevenOfTen, { difficulty: 'duro', view: view() }), true);
  // Pero con un veneno en la mesa cortarse lo pierde: "duro" lo cobra y se planta.
  assert.equal(decideDraw(poisoned, sevenOfTen, { difficulty: 'normal' }), true);
  assert.equal(decideDraw(poisoned, sevenOfTen, { difficulty: 'duro', view: view() }), false);
  // Salvo que el próximo golpe del rival lo tumbe: ahí lo que rinde después no importa.
  assert.equal(decideDraw(poisoned, sevenOfTen, { difficulty: 'duro', view: view({ myHp: 5 }) }), true);

  const t0 = performance.now();
  decideDraw(chainOf(card('bird', 'plant', 'bug')), deck, { difficulty: 'duro' });
  const ms = performance.now() - t0;
  assert.ok(ms < 400, `lookahead demasiado lento: ${ms.toFixed(0)}ms`);
  console.log(`  lookahead 'duro' desde cadena de 3 símbolos: ${ms.toFixed(1)}ms`);
}

// --- el roster --------------------------------------------------------------
{
  const { AXIES, AXIE_IDS, STARTERS, RIVALS, PART_TYPES, axie, deckFor, axieArt, partClass } = await import('../src/axies.js');
  const { AVATARS, PART_CATALOG } = await import('../src/axie-avatars.js');
  const { ADVENTURE_LEVELS } = await import('../src/adventure.js');

  // El roster: los seis starters de Origins y seis del mixer, uno de cada por clase.
  assert.equal(AXIE_IDS.length, 12, 'doce Axies');
  const mixed = AXIE_IDS.filter((id) => AXIES[id].parts);
  for (const group of [Object.keys(STARTERS), mixed]) {
    assert.deepEqual(group.map((id) => AXIES[id].class).sort(), SYMBOL_IDS.slice().sort(), 'uno por clase, sin repetir');
  }

  for (const id of AXIE_IDS) {
    const a = AXIES[id];
    assert.equal(a.id, id, `${id}: el id coincide con la clave`);
    assert.ok(a.name, `${id}: sin nombre`);
    assert.equal(axie(id), a, `${id}: axie() lo conoce`);

    // Cada Axie arranca con el mazo de su clase.
    assert.deepEqual(
      deckFor(id).map((c) => c.key).sort(),
      buildPersonalDeck(a.class).map((c) => c.key).sort(),
      `${id}: el mazo no es el de su clase`,
    );
    assert.match(axieArt(id), /class="axie/);
    assert.match(axieArt(id), /axie-fallback/, `${id}: falta el crest de reserva`);
    assert.ok(AVATARS[id]?.layers.length > 0, `${id}: sin capas — corré npm run axies`);

    if (a.kit) {
      // Los starters: cuerpos fijos del kit, que viajan con el juego.
      assert.deepEqual(AVATARS[id].from, { kit: a.kit }, `${id}: el dibujo es de otro starter — corré npm run axies`);
      assert.match(axieArt(id), /src="Axies\//, `${id}: las capas de un starter viajan con el juego`);
      continue;
    }
    // Las partes salen del catálogo que dejó el mixer, así que `npm run axies` las dibuja.
    for (const [type, part] of Object.entries(a.parts)) {
      assert.ok(
        PART_CATALOG[a.class][type].includes(part),
        `${id}: ${type} ${part} no está en el catálogo de ${a.class}`,
      );
    }
    // Y el manifiesto de capas está al día con el roster.
    assert.deepEqual(
      AVATARS[id].from,
      { class: a.class, color: a.color, parts: a.parts },
      `${id}: el dibujo es de otras partes — corré npm run axies`,
    );
  }

  // Un id que no existe no rompe el render: cae en el primero del roster.
  assert.equal(axie('no-existe').id, AXIE_IDS[0]);
  assert.equal(axie('lobo+9').id, AXIE_IDS[0], 'más evoluciones que partes no existe');

  // Los rivales de la Aventura: fuera del roster, del mixer, y con dibujo tal como salen
  // en su nivel (con las partes evolucionadas en su arte `-lv2`).
  for (const [id, r] of Object.entries(RIVALS)) {
    assert.ok(!AXIE_IDS.includes(id), `${id}: un rival no es del roster`);
    assert.equal(r.id, id);
    for (const type of PART_TYPES) assert.ok(r.parts[type], `${id}: le falta ${type}`);
    for (const [type, key] of Object.entries(r.parts)) {
      const cls = partClass(key, r.class);
      // Las de evento no están en el catálogo de partes comunes; `npm run axies` las verifica.
      if (/^[a-z]+-\d\d$/.test(key) && SYMBOL_IDS.includes(key.split('-')[0])) {
        assert.ok(PART_CATALOG[cls][type].includes(key), `${id}: ${type} ${key} no está en el catálogo de ${cls}`);
      }
    }
    if (r.evolve) assert.deepEqual(r.evolve.slice().sort(), PART_TYPES.slice().sort(), `${id}: evoluciona las seis partes`);
    for (const part of r.charms ?? []) assert.ok(PART_TYPES.includes(part), `${id}: amuleto en ${part}`);
  }
  for (const lvl of ADVENTURE_LEVELS) {
    const r = axie(lvl.rival);
    assert.equal(r.id, lvl.rival, `nivel ${lvl.id}: axie() arma a ${lvl.rival}`);
    const from = { class: r.class, color: r.color, parts: r.parts };
    if (r.body) from.body = r.body;
    if (r.skin) from.skin = r.skin;
    if (r.evolved?.length) from.evolved = r.evolved;
    assert.deepEqual(AVATARS[lvl.rival]?.from, from, `${lvl.rival}: sin dibujo al día — corré npm run axies`);
    assert.match(axieArt(lvl.rival), /class="axie/);
  }

  // Evolucionada, la carta de cada parte suma el símbolo de la clase de la parte: el
  // mismo que ya tiene si la parte es de su clase (y encadena de a dos), o uno nuevo.
  const base = deckFor('cuervo');
  const evolved = deckFor('cuervo+1');
  const partOf = (deck, part) => deck.find((c) => c.associatedPart === part);
  const horn = RIVALS.cuervo.evolve?.[0] ?? PART_TYPES[0];
  assert.deepEqual(
    partOf(evolved, horn).symbols.slice().sort(),
    [...partOf(base, horn).symbols, partClass(RIVALS.cuervo.parts[horn], 'bird')].sort(),
    'la parte evolucionada suma el símbolo de su clase',
  );
  for (const part of PART_TYPES.filter((p) => p !== horn)) {
    assert.deepEqual(partOf(evolved, part).symbols, partOf(base, part).symbols, `${part} no evolucionó`);
  }
  // Con todas evolucionadas, las seis cartas propias suman un símbolo.
  const full = deckFor('mantis+6');
  assert.equal(full.filter((c) => c.isFavorable).reduce((n, c) => n + c.symbols.length, 0),
    deckFor('mantis').filter((c) => c.isFavorable).reduce((n, c) => n + c.symbols.length, 0) + 6);

  // Los amuletos de un jefe: sus cartas llevan el poder que se les pase, y sin poder nada.
  const charmed = deckFor('basilisco+6', {}, null, { charm: 'viper' });
  assert.deepEqual(
    charmed.filter((c) => c.power).map((c) => c.associatedPart).sort(),
    RIVALS.basilisco.charms.slice().sort(),
  );
  assert.ok(charmed.filter((c) => c.power).every((c) => c.power === 'viper'));
  assert.equal(deckFor('basilisco+6').filter((c) => c.power).length, 0);
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
  // Una columna que no es un entero (llega del cable en una sala) no toca la cadena.
  for (const bad of [NaN, 0.5, '0', undefined]) {
    assert.equal(stackOnCard(initial, bad, card('aquatic', 'bird')), initial, `columna ${bad}`);
  }

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

// --- Rocket Stamp: la carta gratis ---------------------------------------------
{
  const rocket = { ...card('reptile', 'bug'), power: 'freegame' };
  assert.equal(isFreeStack(rocket), true);
  assert.equal(isFreeStack(card('reptile', 'bug')), false);

  // En el mazo no corta nunca: la rueda lo cuenta como carta segura aunque no comparta
  // ningún símbolo vivo.
  const chain = chainOf(card('aquatic', 'bird'), card('aquatic', 'plant'));
  assert.deepEqual(survivalOdds(chain, [rocket, card('reptile', 'bug')]), { ok: 1, total: 2, p: 0.5 });

  // La mejor columna: el Rocket de Pez sobre la 2ª alarga la racha viva de Pez a 3 (9 +
  // 1 de Pájaro = 10); sobre la 1ª también, pero además abre una racha nueva de Bestia
  // que muere en la 2ª (9 + 1 + 1 = 11).
  const fish = { ...card('aquatic', 'beast'), power: 'freegame' };
  assert.equal(scoreChain(stackOnCard(chain, 1, fish)).total, 10);
  assert.equal(scoreChain(stackOnCard(chain, 0, fish)).total, 11);
  assert.equal(bestStack(chain, fish), 0);
}

console.log('✓ todos los tests pasan');
