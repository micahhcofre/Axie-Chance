// Los seis poderes de las cartas del centro, uno por uno.
//
// Cada prueba arma a mano la cadena del jugador —con la carta del poder adentro— y
// suelta el ataque, que es el momento en que todos resuelven. Se mira el estado que
// queda puesto, no el registro: lo que importa es que el próximo golpe cuente bien.
import assert from 'node:assert/strict';
import { createGame, TARGET, TUNING, brutalBonusOf, hpOf, lastChance, powerBeat, swingOf } from '../src/game.js';
import { activeSymbols, emptyChain, playCard, scoreChain, stackOnCard } from '../src/rules.js';

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

// --- fuerza: +1 permanente instantáneo cada vez que aparece ------------------
{
  const game = createGame({ pace: 0 });
  game.newMatch({ difficulty: 'normal', axie: 'aquatic' });
  await idle();
  assert.equal(game.state.status.p1.strength, 0, 'fuerza inicial 0');
  game.state.chains.p1 = chainOf(card(['aquatic', 'bird']));

  // Ponemos una carta con Charm of Power en el mazo
  const strCard = card(['aquatic', 'plant'], 'strength');
  game.state.decks.p1.push(strCard);

  // Al robarla (aparece en mesa), suma inmediatamente +1 daño permanente
  await game.hit();
  await idle();
  assert.equal(game.state.status.p1.strength, TUNING.strengthStep, 'otorga +1 instantáneamente al aparecer');
  // El swing del turno actual ya incluye la fuerza
  assert.equal(swingOf(game.state, 'p1'), scoreChain(game.state.chains.p1).total + TUNING.strengthStep, 'el ataque actual ya suma la fuerza');

  // Al plantarse, finishTurn no la vuelve a sumar
  await game.stand();
  await idle();
  assert.equal(game.state.status.p1.strength, TUNING.strengthStep, 'al plantarse no se duplica');

  // Persiste si la cadena se corta en un turno futuro:
  game.state.chains.p1 = chainOf(card(['aquatic', 'bird']));
  const bustCard = card(['bug', 'reptile']); // corta cadena de aquatic
  game.state.decks.p1.push(bustCard);
  game.state.turn = 'p1';
  await game.hit(); // corta la cadena y cierra el turno con 0
  await idle();
  assert.equal(game.state.status.p1.strength, TUNING.strengthStep, 'la fuerza ganada es permanente aunque se corte');

  // Otra carta de Charm of Power que aparece suma otro +1 permanente
  const strCard2 = card(['aquatic', 'beast'], 'strength');
  game.state.chains.p1 = emptyChain();
  game.state.decks.p1.push(strCard2);
  game.state.phase = 'turn';
  game.state.turn = 'p1';
  game.state.busy = false;
  await game.hit();
  await idle();
  assert.equal(game.state.status.p1.strength, 2 * TUNING.strengthStep, 'se acumula +1 con cada aparición');

  console.log('  ✓ fuerza');
}

// --- caracol: el próximo ataque del rival sale partido al medio ---------------
{
  // El caracol ya no depende del golpe con que se lo puso: sea una cadena de 10 o de
  // 3, lo que deja puesto es el mismo ataque partido al medio.
  const chain = chainOf(
    card(['aquatic', 'bird']),
    card(['aquatic', 'plant'], 'snail'),
    card(['aquatic', 'beast']),
  );
  const game = await atPlayerTurn(chain);
  assert.equal(scoreChain(chain).total, 10);
  await game.stand();
  await idle();

  const st = game.state.status.p2;
  assert.equal(st.weak, TUNING.snailAttacks, 'un caracol, un ataque debilitado');
  assert.equal(st.weakBite, undefined, 'no queda ningún mordisco guardado');

  const clean = 5; // beast 2² + bird 1²
  game.state.chains.p2 = chainOf(card(['beast', 'bird']), card(['beast', 'plant']));
  assert.equal(swingOf(game.state, 'p2'), 3, 'pega la mitad, redondeando para arriba');

  // La fuerza entra en la cuenta antes de partir: el caracol parte el ataque entero.
  game.state.status.p2.strength = 3;
  assert.equal(swingOf(game.state, 'p2'), Math.ceil((clean + 3) / 2), 'parte todo el golpe');
  game.state.status.p2.strength = 0;

  // Los caracoles se suman por ataques, y no hay nada que pueda bajar de la mitad:
  // dos caracoles son dos ataques a la mitad, no un cuarto.
  game.state.status.p2.weak += TUNING.snailAttacks;
  assert.equal(game.state.status.p2.weak, 2, 'se acumulan por ataques');
  assert.equal(swingOf(game.state, 'p2'), 3, 'pero cada ataque sale a la mitad, no menos');

  // Nunca deja un ataque en cero: una cadena que puntuó siempre pega algo.
  game.state.chains.p2 = chainOf(card(['beast', 'bird']));
  assert.equal(swingOf(game.state, 'p2'), 1, 'una cadena de 2 sale en 1, no en 0');

  // Una cadena cortada hace 0 y ningún modificador la mueve.
  game.state.chains.p2 = { ...game.state.chains.p2, busted: true };
  assert.equal(swingOf(game.state, 'p2'), 0, 'cortada es 0');
  console.log('  ✓ caracol');
}

{
  // Se gasta con un ataque que hizo daño, no con el turno: una cadena cortada no le
  // paga el caracol a nadie. Si se gastara igual, el debilitado se lo sacaría de
  // encima con el turno que ya venía perdido.
  const game = await atPlayerTurn(chainOf(card(['aquatic', 'bird']), card(['bug', 'reptile'])));
  game.state.status.p1.weak = 2;
  assert.ok(game.state.chains.p1.busted, 'la cadena quedó cortada');
  await game.stand();
  await idle();
  assert.equal(game.state.roundScores.p1, 0, 'el ataque hizo 0');
  assert.equal(game.state.status.p1.weak, 2, 'y el caracol sigue entero');

  // Con un ataque que sí sale, se gasta uno.
  const g2 = await atPlayerTurn(chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'])));
  g2.state.status.p1.weak = 2;
  await g2.stand();
  await idle();
  assert.equal(g2.state.roundScores.p1, 3, 'pegó la mitad de 5, redondeando');
  assert.equal(g2.state.status.p1.weak, 1, 'y se gastó un ataque');
  console.log('  ✓ caracol (se gasta con daño)');
}

// --- veneno: dosis fija por frasco, mordiendo cada ronda y partiéndose al medio ---
{
  // Un frasco pone 6 de veneno, pegue lo que pegue el ataque.
  const chain = chainOf(
    card(['aquatic', 'bird']),
    card(['aquatic', 'plant'], 'poison'),
    card(['aquatic', 'beast']),
  );
  const game = await atPlayerTurn(chain);
  assert.equal(scoreChain(chain).total, 10);
  await game.stand();
  await idle();

  assert.equal(game.state.status.p2.poison, TUNING.poisonDose, 'un frasco, una dosis');
  const before = hpOf(game.state, 'p2');

  // El veneno muerde al finalizar el turno del oponente (p2) y recién después se parte al medio.
  let closed = null;
  game.subscribe((s) => {
    if (closed || (s.phase !== 'roundEnd' && s.phase !== 'matchEnd')) return;
    closed = { hp: hpOf(s, 'p2'), poison: s.status.p2.poison };
  });
  for (let i = 0; i < 800 && !closed; i++) {
    if (game.state.phase === 'draft' && game.drafting() === 'p1') await game.skipDraft();
    else await idle();
  }
  assert.ok(closed, 'el intercambio cerró');
  assert.equal(closed.hp, before - 6, 'mordió por 6');
  // 6 se parte en 3, que todavía pasa el piso de 2.
  assert.equal(closed.poison, 3, 'y quedó la mitad');
  console.log('  ✓ veneno');
}
{
  // Dos frascos en la cadena ponen dos dosis, y se suman al veneno que ya había.
  const chain = chainOf(
    card(['aquatic', 'bird'], 'poison'),
    card(['aquatic', 'plant'], 'poison'),
  );
  const game = await atPlayerTurn(chain);
  game.state.status.p2.poison = 4;
  await game.stand();
  await idle();
  assert.equal(game.state.status.p2.poison, 4 + 2 * TUNING.poisonDose, 'dos frascos, dos dosis, sobre lo que había');
  console.log('  ✓ veneno (acumulable)');
}
{
  // El veneno no pasa por el escudo ni por el tope de la máscara: va directo a la vida.
  const game = await atPlayerTurn(chainOf(card(['aquatic', 'bird'])));
  game.state.status.p1.poison = 10;
  game.state.status.p1.egg = 50;
  game.state.status.p1.steelskin = 6;
  await game.stand();
  for (let i = 0; i < 50 && game.state.status.p1.poison === 10; i++) await idle();
  assert.equal(hpOf(game.state, 'p1'), TARGET - 10, 'mordió los 10 enteros');
  assert.equal(game.state.status.p1.egg, 50, 'sin tocar el escudo');
  assert.equal(game.state.status.p1.steelskin, 6, 'ni gastar la máscara');
  console.log('  ✓ veneno (atraviesa el escudo)');
}

{
  // Si te toca jugar segundo y aplicás veneno, no muerde enseguida al cerrar la ronda:
  // espera a que el rival termine su próximo turno.
  const game = createGame({ pace: 0 });
  game.newMatch({ difficulty: 'normal', axie: 'aquatic' });
  await idle();

  // Simulamos que p2 abrió la ronda y ya jugó:
  game.state.order = ['p2', 'p1'];
  game.state.roundScores.p2 = 5;
  game.state.turn = 'p1';
  const chain = chainOf(
    card(['aquatic', 'bird']),
    card(['aquatic', 'plant'], 'poison'),
    card(['aquatic', 'beast']),
  );
  game.state.chains.p1 = chain;

  const p2HpBefore = hpOf(game.state, 'p2');
  await game.stand();
  await idle();

  // p1 le aplicó una dosis de veneno a p2 (ataque de 10)
  assert.equal(game.state.status.p2.poison, 6, 'le aplicó 6 de veneno al rival');
  const p2HpAfterAttack = hpOf(game.state, 'p2');
  assert.equal(p2HpAfterAttack, p2HpBefore - 10, 'el ataque conectó por 10');

  // p1 omite el draft para cerrar la ronda
  await game.skipDraft();
  await idle();

  // La ronda cerró porque p1 era el segundo en jugar.
  // ¡El veneno NO debió morder a p2 al cerrar la ronda!
  assert.equal(game.state.status.p2.poison, 6, 'p2 conserva los 6 de veneno al cerrar la ronda');
  assert.equal(hpOf(game.state, 'p2'), p2HpAfterAttack, 'p2 no recibió daño de veneno enseguida');

  // En la siguiente ronda, cuando p2 juega y termina su turno, muerde el veneno:
  for (let i = 0; i < 800; i++) {
    if (game.state.status.p2.poison !== 6) break;
    if (game.state.phase === 'draft' && game.drafting() === 'p1') await game.skipDraft();
    else await idle();
  }
  assert.equal(game.state.status.p2.poison, 3, 'el veneno mordió y se partió al medio al finalizar el turno de p2');
  assert.equal(hpOf(game.state, 'p2'), p2HpAfterAttack - 6, 'p2 perdió los 6 puntos de veneno');
  console.log('  ✓ veneno (jugando segundo no muerde enseguida al cerrar la ronda)');
}

{
  // La cola del veneno, sin partida de por medio: muerde entero, se parte al medio y
  // se va cuando la mitad ya no alcanza el piso. Un veneno de 20 dura tres mordiscos
  // —20, 10, 5— y en el cuarto ya no está, en vez de arrastrar diez rondas de a 2.
  const bites = [];
  let left = 20;
  while (left > 0) {
    bites.push(left);
    const half = Math.floor(left / TUNING.poisonHalve);
    left = half <= TUNING.poisonFloor ? 0 : half;
    assert.ok(bites.length < 20, 'el veneno termina');
  }
  assert.deepEqual(bites, [20, 10, 5], 'tres mordiscos y se va');
  console.log('  ✓ veneno (se parte al medio y se va)');
}

// --- maceta: te curás lo que pegaste, sin pasarte de la vida inicial ----------
{
  // Entero no hay nada que curar: la maceta no sirve para pasarse de 100.
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'], 'pot'));
  const game = await atPlayerTurn(chain);
  await game.stand();
  await idle();
  assert.equal(hpOf(game.state, 'p1'), TARGET, 'la cura no pasa de la vida inicial');
  assert.equal(game.state.healed.p1, 0, 'no se guarda curación desperdiciada');
}
{
  // Lastimado sí cura, y exactamente lo que pegó.
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'], 'pot'));
  const game = await atPlayerTurn(chain);
  game.state.totals.p2 = 40;
  assert.equal(hpOf(game.state, 'p1'), 60);
  await game.stand();
  await idle();
  assert.equal(hpOf(game.state, 'p1'), 65, 'se curó los 5 que pegó');
  assert.equal(game.state.healed.p1, 5);
}
{
  // Y cura solo hasta el tope, aunque pegue mucho más de lo que le falta.
  const chain = chainOf(
    card(['aquatic', 'bird']),
    card(['aquatic', 'plant'], 'pot'),
    card(['aquatic', 'beast']),
  );
  const game = await atPlayerTurn(chain);
  game.state.totals.p2 = 4; // le faltan 4 de vida y va a pegar 10
  await game.stand();
  await idle();
  assert.equal(hpOf(game.state, 'p1'), TARGET, 'no se pasa del tope');
  assert.equal(game.state.healed.p1, 4, 'solo se guarda lo que curó de verdad');
}
{
  // En la última chance no hay cura: la maceta no levanta del cero.
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'], 'pot'));
  const game = await atPlayerTurn(chain);
  game.state.totals.p2 = TARGET;
  assert.equal(lastChance(game.state), 'p1');
  await game.stand();
  for (let i = 0; i < 50 && game.state.phase !== 'matchEnd'; i++) await idle();
  assert.equal(game.state.healed.p1, 0, 'la maceta no cura sin vida');
  assert.equal(hpOf(game.state, 'p1'), 0);
  assert.equal(game.state.phase, 'matchEnd', 'y el golpe cierra la partida');
  console.log('  ✓ maceta');
}

// --- huevo: escudo de un tercio del golpe, que se suma -------------------------
{
  const chain = chainOf(
    card(['aquatic', 'bird']),
    card(['aquatic', 'plant'], 'egg'),
    card(['aquatic', 'beast']),
  );
  const game = await atPlayerTurn(chain);
  await game.stand(); // ataque de 10 → escudo de 3
  await idle();
  assert.equal(game.state.status.p1.egg, 3, 'escudo de un tercio del golpe');
}
{
  // El huevo se come lo que puede del próximo golpe y deja pasar el resto.
  const chain = chainOf(
    card(['aquatic', 'bird']),
    card(['aquatic', 'plant']),
    card(['aquatic', 'beast']),
  );
  const game = await atPlayerTurn(chain);
  // Los golpes se anotan a medida que salen: `lastHit` es un pulso y se pisa. Con la
  // cáscara encendida son dos —el ataque y la respuesta— y el segundo tapa al primero.
  const hits = [];
  game.subscribe((s) => {
    if (s.lastHit && s.lastHit.id !== hits.at(-1)?.id) hits.push({ ...s.lastHit });
  });
  game.state.status.p2.egg = 4;
  await game.stand(); // 10 de ataque contra 4 de huevo
  await idle();
  assert.equal(game.state.roundScores.p1, 10, 'el ataque vale lo mismo igual');
  assert.equal(game.state.totals.p1, 6, 'solo entraron 6');
  assert.equal(hpOf(game.state, 'p2'), TARGET - 6);
  assert.equal(game.state.status.p2.egg, 0, 'el huevo se rompe');
  const golpe = hits.find((h) => h.by === 'p1');
  assert.equal(golpe.blocked, 4, 'el golpe recuerda cuánto le frenaron');
  assert.equal(golpe.amount, 6, 'y cuánto entró');
}
{
  // Con más huevo que golpe no entra nada y el huevo sigue puesto, gastado en parte:
  // aguanta hasta terminarse, que es lo que lo hace valer la carta.
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant']));
  const game = await atPlayerTurn(chain);
  game.state.status.p2.egg = 40;
  await game.stand(); // 5 de ataque contra 40 de huevo
  await idle();
  assert.equal(game.state.totals.p1, 0, 'no entró nada');
  assert.equal(hpOf(game.state, 'p2'), TARGET);
  assert.equal(game.state.status.p2.egg, 35, 'le quedan 35 para el próximo golpe');
  console.log('  ✓ huevo');
}
{
  // La cáscara: cuando el huevo se gasta del todo, le vuelve un número fijo al que lo
  // rompió. Fijo y no una fracción del golpe — romper un huevo cuesta siempre lo
  // mismo, se rompa con un golpe de 10 o con uno de 40.
  const chain = chainOf(
    card(['aquatic', 'bird']),
    card(['aquatic', 'plant']),
    card(['aquatic', 'beast']),
  );
  const game = await atPlayerTurn(chain);
  game.state.status.p2.egg = 4;
  game.state.status.p2.eggBreak = TUNING.eggBreak; // un huevo de verdad trae su cáscara
  await game.stand(); // 10 de ataque contra 4 de huevo: lo rompe
  await idle();
  assert.equal(game.state.status.p2.egg, 0, 'el huevo se rompió');
  assert.equal(game.state.totals.p1, 6, 'pasaron 6, como sin cáscara');
  assert.equal(game.state.totals.p2, TUNING.eggBreak, 'y le volvieron 8 al que pegó');
  assert.equal(hpOf(game.state, 'p1'), TARGET - TUNING.eggBreak, 'la cáscara le sacó vida');
  // Y sale como golpe propio, en sentido contrario, para que se vea en pantalla.
  const back = game.state.lastHit;
  assert.equal(back.kind, 'thorns');
  assert.equal(back.by, 'p2', 'lo devuelve el dueño del huevo');
  assert.equal(back.target, 'p1', 'contra el que pegó');
  assert.equal(back.amount, TUNING.eggBreak);

  // Un huevo que aguanta no corta: solo devuelve el que se rompe. Y el golpe avisa que
  // no lo rompió, que es lo que la pantalla mira para no cantar una cáscara de más.
  const g2 = await atPlayerTurn(chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'])));
  g2.state.status.p2.egg = 40;
  await g2.stand();
  await idle();
  assert.equal(g2.state.status.p2.egg, 35, 'el huevo sigue puesto');
  assert.equal(g2.state.totals.p2, 0, 'y no devolvió nada');
  assert.equal(g2.state.lastHit.blocked, 5, 'el golpe entero se lo comió el huevo');
  assert.equal(g2.state.lastHit.broke, false, 'y el golpe sabe que no lo rompió');
  console.log('  ✓ huevo (cáscara)');
}
{
  // Un ataque de 0 no toca el huevo: se gasta con daño, no con turnos.
  const chain = chainOf(card(['aquatic', 'bird']), card(['bug', 'reptile']));
  const game = await atPlayerTurn(chain);
  assert.ok(chain.busted);
  game.state.status.p2.egg = 8;
  await game.stand();
  await idle();
  assert.equal(game.state.status.p2.egg, 8, 'una cadena cortada no le hace nada al huevo');
  console.log('  ✓ huevo (cadena cortada)');
}
{
  // Dos cartas de huevo en la misma cadena: se suman el escudo (3 + 3) y la cáscara
  // (+8 por cada huevo = 16).
  const chain = chainOf(
    card(['aquatic', 'bird']),
    card(['aquatic', 'plant'], 'egg'),
    card(['aquatic', 'beast'], 'egg'),
  );
  const game = await atPlayerTurn(chain);
  await game.stand(); // 10 de ataque -> 3 de escudo por huevo, eggBreak de 16 (8+8)
  await idle();
  assert.equal(game.state.status.p1.egg, 6, 'el escudo se acumula');
  assert.equal(game.state.status.p1.eggBreak, 16, 'el daño de rotura acumula 8 por cada huevo');
  console.log('  ✓ huevo (escudo y cáscara acumulables)');
}
{
  // Ganar huevo teniendo ya escudo: se suma al anterior; el daño de rotura también (+8).
  const chain = chainOf(
    card(['aquatic', 'bird']),
    card(['aquatic', 'plant']),
    card(['aquatic', 'beast'], 'egg'),
  );
  const game = await atPlayerTurn(chain);
  game.state.status.p1.egg = 2; // escudo previo
  game.state.status.p1.eggBreak = 8;
  await game.stand(); // 10 de ataque -> +3 de escudo sobre los 2, +8 de eggBreak (total 16)
  await idle();
  assert.equal(game.state.status.p1.egg, 5, 'el nuevo escudo se suma al anterior');
  assert.equal(game.state.status.p1.eggBreak, 16, 'el daño de rotura se acumula a 16');
  console.log('  ✓ huevo (el escudo se suma al que había)');
}
{
  // Un golpe chico igual deja escudo: al menos 1, para que la cáscara tenga qué romper.
  const game = await atPlayerTurn(chainOf(card(['aquatic', 'bird'], 'egg')));
  await game.stand(); // 2 de ataque: un tercio es 0, queda en 1
  await idle();
  assert.equal(game.state.status.p1.egg, 1, 'mínimo 1 de escudo');
  assert.equal(game.state.status.p1.eggBreak, TUNING.eggBreak);
  console.log('  ✓ huevo (mínimo 1 de escudo)');
}
{
  // El rival tiene huevo acumulado (por ejemplo 10 de escudo y 16 de daño de cáscara).
  // Un ataque de 10 lo rompe del todo y le devuelve los 16 de daño al atacante.
  const chain = chainOf(
    card(['aquatic', 'bird']),
    card(['aquatic', 'plant']),
    card(['aquatic', 'beast']),
  );
  const game = await atPlayerTurn(chain);
  game.state.status.p2.egg = 10;
  game.state.status.p2.eggBreak = 16;
  await game.stand(); // 10 de ataque contra 10 de huevo: lo rompe
  await idle();
  assert.equal(game.state.status.p2.egg, 0, 'el huevo se rompió del todo');
  assert.equal(game.state.status.p2.eggBreak, 0, 'el daño acumulado se gastó');
  assert.equal(game.state.totals.p1, 0, 'el golpe de 10 fue completamente absorbido');
  assert.equal(game.state.totals.p2, 16, 'y le volvieron los 16 acumulados al que pegó');
  assert.equal(hpOf(game.state, 'p1'), TARGET - 16, 'la cáscara le sacó 16 de vida');
  assert.equal(game.state.lastHit.kind, 'thorns');
  assert.equal(game.state.lastHit.amount, 16);
  console.log('  ✓ huevo (rotura de escudo acumulado)');
}
{
  // Daño parcial que no rompe el escudo: conserva el daño de rotura acumulado.
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant']));
  const game = await atPlayerTurn(chain);
  game.state.status.p2.egg = 20;
  game.state.status.p2.eggBreak = 16;
  await game.stand(); // 5 de ataque contra 20 de huevo: absorbe 5, quedan 15
  await idle();
  assert.equal(game.state.status.p2.egg, 15, 'quedan 15 de escudo');
  assert.equal(game.state.status.p2.eggBreak, 16, 'el daño acumulado de 16 sigue en pie');
  assert.equal(game.state.totals.p2, 0, 'no hubo contraataque porque no se rompió');

  // Ahora un segundo golpe rompe los 15 restantes:
  const game2 = await atPlayerTurn(chainOf(
    card(['aquatic', 'bird']),
    card(['aquatic', 'plant']),
    card(['aquatic', 'beast']),
    card(['aquatic', 'bug']),
  ));
  game2.state.status.p2.egg = 15;
  game2.state.status.p2.eggBreak = 16;
  await game2.stand(); // 17 de daño contra 15 de huevo
  await idle();
  assert.equal(game2.state.status.p2.egg, 0, 'ahora sí se rompió');
  assert.equal(game2.state.status.p2.eggBreak, 0, 'el daño acumulado se consumió');
  assert.equal(game2.state.totals.p2, 16, 'devolvió los 16 de daño');
  console.log('  ✓ huevo (daño parcial conserva acumulación hasta romperse)');
}

// --- cadena cortada: no sale ningún poder ------------------------------------
{
  // Cuatro poderes en la mano y un ataque de 0: no sale ninguno de los que requieren conectar daño.
  const chain = chainOf(
    card(['aquatic', 'bird'], 'pot'),
    card(['aquatic', 'plant'], 'snail'),
    card(['aquatic', 'beast'], 'poison'),
    card(['bug', 'reptile'], 'egg'), // ni bug ni reptile siguen vivos: acá se corta
  );
  const game = await atPlayerTurn(chain);
  assert.ok(chain.busted, 'la cadena quedó cortada');
  assert.ok(chain.bustCard, 'y la carta que la cortó está guardada');
  await game.stand();
  await idle();

  const s = game.state;
  assert.equal(s.roundScores.p1, 0, 'una cadena cortada hace 0');
  assert.equal(s.totals.p1, 0);
  assert.equal(s.healed.p1, 0, 'la maceta no cura sin ataque');
  assert.equal(s.status.p2.weak, 0, 'el caracol se mide contra el daño: nada');
  assert.equal(s.status.p2.poison, 0, 'el veneno tampoco');
  assert.equal(s.status.p1.egg, 0, 'el huevo tampoco');
  console.log('  ✓ cadena cortada');
}

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
  // Pero se mide contra la cadena, no contra el daño. Con el caracol de antes eso se
  // veía: dejaba ataques enteros en 0 y el pulpo cobraba igual. El de ahora parte al
  // medio y redondea para arriba, así que un ataque hundido a 0 por el rival ya no
  // existe — lo que se puede comprobar es lo otro, que el pulpo cobra entero aunque
  // el golpe con que se plantó haya salido a la mitad.
  const chain = chainOf(card(['aquatic', 'bird'], 'octopus'));
  const game = await atPlayerTurn(chain);
  assert.ok(!chain.busted, 'la cadena está entera');
  game.state.status.p1.weak = 2;
  assert.equal(swingOf(game.state, 'p1'), 1, 'se planta y pega la mitad de 2');

  await game.stand();
  await idle();
  assert.equal(game.state.status.p1.stacked, 1, 'el pulpo cobra entero igual');
  console.log('  ✓ pulpo (plantado y debilitado: cobra)');
}

// --- garra brutal: +3 de daño por cada símbolo de la cadena más larga ---------
{
  // 1. Cadena de 1 carta con Garra Brutal: se activa siempre
  const chain1 = chainOf(
    card(['beast', 'bird'], 'brutal'),
  );
  const game1 = await atPlayerTurn(chain1);
  // beast = 1, bird = 1. base = 1^2 + 1^2 = 2. brutal: 1 * 3 * 1 = 3. swing = 5
  assert.equal(swingOf(game1.state, 'p1'), 5, 'se activa siempre, incluso con 1 carta');

  // 2. Cadena de 3 cartas con Bestia viva (longitud 3 de Bestia)
  const chain3 = chainOf(
    card(['beast', 'bird']),
    card(['beast', 'plant']),
    card(['beast', 'aquatic'], 'brutal'),
  );
  const game3 = await atPlayerTurn(chain3);
  // scoreChain: beast 3^2 = 9, bird 1^2 = 1. total = 10
  // maxRunLength = 3 (beast = 3). 1 brutal * 3 * 3 = 9 de bono. total swing = 10 + 9 = 19
  assert.equal(swingOf(game3.state, 'p1'), 19, 'suma +3 por símbolo de la cadena más larga');

  await game3.stand();
  await idle();
  assert.equal(game3.state.roundScores.p1, 19, 'el daño aplicado incluye el bono');

  // 3. Cadena donde la más larga no es Bestia (ej. Bird tiene 3 y Bestia murió en 1)
  const chainNoBeast = chainOf(
    card(['beast', 'bird']),
    card(['bird', 'plant'], 'brutal'),
    card(['bird', 'aquatic']),
  );
  const gameNoBeast = await atPlayerTurn(chainNoBeast);
  // bird 3^2 = 9, beast 1^2 = 1. base = 10. maxRunLength = 3 (bird).
  // bono = 1 * 3 * 3 = 9. total = 10 + 9 = 19.
  assert.equal(swingOf(gameNoBeast.state, 'p1'), 19, 'da bono por la cadena más larga de cualquier clase');

  // 4. Cadena con 2 cartas de Garra Brutal (acumulable)
  const chain2Brutal = chainOf(
    card(['beast', 'bird']),
    card(['beast', 'plant'], 'brutal'),
    card(['beast', 'aquatic'], 'brutal'),
  );
  const game2Brutal = await atPlayerTurn(chain2Brutal);
  // 2 garras * 3 * 3 (largo max) = +18 de bono. Base: 10. Total: 28.
  assert.equal(swingOf(game2Brutal.state, 'p1'), 28, 'dos garras se acumulan (+18)');

  // 5. Cadena cortada: todo da 0
  const chainBusted = playCard(chain3, card(['bug', 'reptile']));
  assert.equal(chainBusted.busted, true);
  const gameBusted = await atPlayerTurn(chainBusted);
  assert.equal(swingOf(gameBusted.state, 'p1'), 0, 'cadena cortada vale 0');

  console.log('  ✓ garra brutal');
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

// --- pluma sagrada: 5 de daño directo inmediato al salir ---------------------
{
  // 1. Al robar con hit(), inflige 5 de daño directo inmediato
  const game = await atPlayerTurn(chainOf(card(['aquatic', 'bird'])));
  const fCard = card(['aquatic', 'plant'], 'feather');
  game.state.decks.p1.push(fCard);
  const hpBefore = hpOf(game.state, 'p2');
  await game.hit();
  await idle();
  assert.equal(game.state.totals.p1, 5, 'se sumaron 5 al daño total');
  assert.equal(hpOf(game.state, 'p2'), hpBefore - 5, 'el rival perdió 5 de vida al instante');
  assert.equal(game.state.lastHit?.kind, 'feather');
  assert.equal(game.state.lastHit?.amount, 5);
  console.log('  ✓ pluma sagrada (daño directo al salir)');
}

{
  // 2. Si la siguiente carta corta la cadena, los 5 de daño se mantienen
  const game = await atPlayerTurn(chainOf(card(['aquatic', 'bird'])));
  const fCard = card(['aquatic', 'plant'], 'feather');
  const bustCard = card(['bug', 'reptile']);
  game.state.decks.p1.push(bustCard, fCard); // fCard pops primero, luego bustCard
  await game.hit();
  await idle();
  assert.equal(game.state.totals.p1, 5, 'pegó 5 por la pluma');
  await game.hit();
  await idle();
  assert.ok(game.state.chains.p1.busted, 'la cadena se cortó');
  assert.equal(game.state.roundScores.p1, 0, 'el ataque falló');
  assert.equal(game.state.totals.p1, 5, 'los 5 de la pluma se mantienen a pesar del corte');
  console.log('  ✓ pluma sagrada (se mantiene con cadena cortada)');
}

{
  // 3. Acumulación de plumas: cada pluma suma 5 de daño directo
  const game = await atPlayerTurn(chainOf(card(['aquatic', 'bird'])));
  const f1 = card(['aquatic', 'plant'], 'feather');
  const f2 = card(['aquatic', 'beast'], 'feather');
  game.state.decks.p1.push(f2, f1); // f1 sale primero, luego f2
  await game.hit();
  await idle();
  assert.equal(game.state.totals.p1, 5, 'primera pluma suma 5');
  await game.hit();
  await idle();
  assert.equal(game.state.totals.p1, 10, 'segunda pluma suma otros 5 (total 10)');
  await game.stand();
  await idle();
  assert.ok(game.state.totals.p1 > 10, 'el ataque se suma al daño de las plumas');
  console.log('  ✓ pluma sagrada (acumulación)');
}

/**
 * Deja correr la partida hasta que al jugador le vuelve a tocar, salteando su centro.
 * Las hojas curan al empezar ese turno, antes de robar.
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

// --- hoja (leaf): 2 hojas por carta, cura 4 por hoja y consume 1 -------------
{
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'], 'leaf'));
  const game = await atPlayerTurn(chain);
  game.state.totals.p2 += 20;

  await game.stand();
  await idle();
  assert.equal(game.state.healed.p1, 0, 'al plantarse todavía no cura');
  assert.equal(game.state.status.p1.leaf, 2, 'ganó 2 hojas');

  // Próximo turno: cura antes de robar.
  await toNextPlayerTurn(game);
  assert.equal(game.state.healed.p1, 8, 'curó +8 al inicio del turno (2 hojas * 4)');
  assert.equal(game.state.status.p1.leaf, 1, 'quedó 1 hoja activa tras consumir 1');

  // Se planta con cartas sin hoja y al turno siguiente la última hoja cura 4.
  game.state.chains.p1 = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'bird']));
  await game.stand();
  await toNextPlayerTurn(game);
  assert.equal(game.state.healed.p1, 12, 'curó +4 adicional en el turno siguiente (total 12)');
  assert.equal(game.state.status.p1.leaf, 0, 'se consumieron todas las hojas');

  console.log('  ✓ hoja (leaf)');
}

// --- hoja (leaf): acumulación hasta un máximo de 5 ----------------------------
{
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'], 'leaf'));
  const game = await atPlayerTurn(chain);
  // Simular que ya tenía 4 hojas acumuladas y 40 de daño
  game.state.status.p1.leaf = 4;
  game.state.totals.p2 += 40;

  await game.stand();
  await idle();
  // Tenía 4 + 2 de la carta = 6, pero tope 5.
  assert.equal(game.state.status.p1.leaf, 5, 'tope de 5 hojas');

  // Al inicio del próximo turno cura 5 * 4 = 20 HP y consume 1 hoja -> quedan 4
  await toNextPlayerTurn(game);
  assert.equal(game.state.healed.p1, 20, 'curó 20 con el tope de 5 hojas');
  assert.equal(game.state.status.p1.leaf, 4, 'quedan 4 hojas tras consumir 1');
  console.log('  ✓ hoja (acumulación hasta 5)');
}

// --- hoja (leaf): la cura llega aunque la cadena se corte ---------------------
{
  const game = await atPlayerTurn(chainOf(card(['aquatic', 'bird'])));
  game.state.status.p1.leaf = 2;
  game.state.totals.p2 += 20;

  // Roba una carta que corta la cadena (y que además tiene hoja)
  const bustCardWithLeaf = card(['bug', 'reptile'], 'leaf');
  game.state.decks.p1.push(bustCardWithLeaf);
  await game.hit();
  await idle();

  assert.ok(game.state.chains.p1.busted, 'la cadena se cortó');
  // No suma hojas nuevas porque el golpe fue 0, y las que tenía no curan al cortarse.
  assert.equal(game.state.status.p1.leaf, 2, 'sin hojas nuevas y sin gastar');
  assert.equal(game.state.healed.p1, 0, 'no cura al cortarse');

  // Al empezar el próximo turno las 2 hojas curan 8 y se gasta 1, antes de robar.
  await toNextPlayerTurn(game);
  assert.equal(game.state.healed.p1, 8, 'curó +8 al inicio del turno');
  assert.equal(game.state.status.p1.leaf, 1, 'quedó 1 hoja tras consumir 1');
  console.log('  ✓ hoja (curación al inicio del turno aunque el anterior se haya cortado)');
}

// --- Mantis Dagger: roba 5 HP por cada mantis en ataque exitoso --------------
{
  // 1. Cadena con 1 Mantis Dagger: roba 5 de vida
  const chain1 = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'bug'], 'leech'));
  const game1 = await atPlayerTurn(chain1);
  game1.state.totals.p2 += 20; // p1 tiene 80 HP
  const hpP2Before = hpOf(game1.state, 'p2');
  const hpP1Before = hpOf(game1.state, 'p1');

  await game1.stand();
  await idle();

  // Daño normal de cadena (aquatic 2^2 + bird 1^2 = 5) + 5 de leech = 10 de daño total
  assert.equal(game1.state.totals.p1, 5 + TUNING.leechDrain, 'suma 5 al daño por drenaje');
  assert.equal(hpOf(game1.state, 'p2'), hpP2Before - 5 - TUNING.leechDrain, 'rival pierde 10 HP');
  assert.equal(hpOf(game1.state, 'p1'), hpP1Before + TUNING.leechDrain, 'jugador se cura 5 HP');

  // 2. Con 2 Mantis Dagger en la cadena: roba 10 de vida (5 por cada una)
  const chain2 = chainOf(
    card(['aquatic', 'bird']),
    card(['aquatic', 'bug'], 'leech'),
    card(['aquatic', 'plant']),
    card(['aquatic', 'bug'], 'leech'),
  );
  const game2 = await atPlayerTurn(chain2);
  game2.state.totals.p2 += 30;
  const p2Start = hpOf(game2.state, 'p2');
  const p1Start = hpOf(game2.state, 'p1');
  const pts2 = scoreChain(chain2).total;

  await game2.stand();
  await idle();

  assert.equal(game2.state.totals.p1, pts2 + 2 * TUNING.leechDrain, 'con 2 mantis drena 10 (5 por cada una)');
  assert.equal(hpOf(game2.state, 'p2'), p2Start - pts2 - 2 * TUNING.leechDrain, 'rival pierde daño + 10');
  assert.equal(hpOf(game2.state, 'p1'), p1Start + 2 * TUNING.leechDrain, 'jugador se cura 10');

  // 3. Cadena cortada: no drena
  const chainBusted = playCard(chain1, card(['plant', 'reptile']));
  const gameBusted = await atPlayerTurn(chainBusted);
  const p2Busted = hpOf(gameBusted.state, 'p2');
  await gameBusted.stand();
  await idle();
  assert.equal(hpOf(gameBusted.state, 'p2'), p2Busted, 'si se corta no drena nada');

  console.log('  ✓ Mantis Dagger (greedy leech)');
}

// --- Gecko Mask: +2 de escudo y tope de 12 a la vida (acumulable bajando de a 2) ---
{
  // 1. Al plantarse, activa steelskin = 12
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'reptile'], 'steelskin'));
  const game = await atPlayerTurn(chain);
  await game.stand();
  await idle();

  assert.equal(game.state.status.p1.steelskin, TUNING.steelskinBaseCap, 'blindaje inicial de 12');
  assert.equal(game.state.status.p1.egg, TUNING.steelskinShield, 'y 2 de escudo');
  assert.equal(game.state.status.p1.eggBreak, 0, 'sin cáscara: eso es del huevo');

  // 2. Acumulable: un segundo steelskin baja el tope en -2 (a 10)
  const chain2 = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'reptile'], 'steelskin'));
  const game2 = await atPlayerTurn(chain2);
  game2.state.status.p1.steelskin = 12;
  await game2.stand();
  await idle();
  assert.equal(game2.state.status.p1.steelskin, 10, 'segunda piel reduce tope a 10');
  assert.equal(game2.state.status.p1.egg, 2, 'y suma su escudo');

  // El escudo de la máscara se suma al que ya había.
  const gameStack = await atPlayerTurn(chainOf(card(['aquatic', 'bird']), card(['aquatic', 'reptile'], 'steelskin')));
  gameStack.state.status.p1.egg = 5;
  await gameStack.stand();
  await idle();
  assert.equal(gameStack.state.status.p1.egg, 7, 'el escudo se suma');

  // Piso mínimo de 6
  game2.state.status.p1.steelskin = 6;
  game2.state.chains.p1 = chain2;
  await game2.stand();
  await idle();
  assert.equal(game2.state.status.p1.steelskin, 6, 'no baja de 6');

  // 3. Mitigación de golpe: el atacante golpea por 26, pero solo entran 12
  const game3 = await atPlayerTurn(chainOf(card(['aquatic', 'bird'])));
  game3.state.status.p2.steelskin = 12; // la CPU tiene steelskin 12
  const bigChain = chainOf(
    card(['aquatic', 'bird']),
    card(['aquatic', 'plant']),
    card(['aquatic', 'beast']),
    card(['aquatic', 'bug']),
    card(['aquatic', 'reptile']),
  );
  assert.equal(scoreChain(bigChain).total, 25 + 1); // 26
  game3.state.chains.p1 = bigChain;
  const p2HpBefore = hpOf(game3.state, 'p2');
  await game3.stand();
  await idle();

  assert.equal(game3.state.roundScores.p1, 12, 'golpe limitado a 12');
  assert.equal(hpOf(game3.state, 'p2'), p2HpBefore - 12, 'la CPU solo recibió 12 de daño');
  assert.equal(game3.state.status.p2.steelskin, 0, 'el blindaje se consumió con el ataque');

  // 4. El escudo va primero y el tope, sobre lo que llega a la vida: 26 contra 10 de
  // escudo dejan pasar 16, y la máscara los baja a 12.
  const game4 = await atPlayerTurn(bigChain);
  game4.state.status.p2.egg = 10;
  game4.state.status.p2.steelskin = 12;
  await game4.stand();
  await idle();
  assert.equal(hpOf(game4.state, 'p2'), TARGET - 12, 'a la vida llegan 12');
  assert.equal(game4.state.status.p2.egg, 0, 'el escudo se gastó');
  assert.equal(game4.state.totals.p2, 0, 'escudo sin huevo: no hay cáscara');
  assert.equal(game4.state.roundScores.p1, 22, 'el ataque vale lo que no frenó la máscara');

  // 5. Un golpe que se come entero el escudo no gasta la máscara.
  const game5 = await atPlayerTurn(chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'])));
  game5.state.status.p2.egg = 20;
  game5.state.status.p2.steelskin = 12;
  await game5.stand();
  await idle();
  assert.equal(game5.state.status.p2.egg, 15);
  assert.equal(game5.state.status.p2.steelskin, 12, 'la máscara sigue puesta');

  console.log('  ✓ Gecko Mask');
}

// --- free game: apilado en primera carta y cartas posteriores ----------------
{
  // 1. Free game en la primera carta: activa freeGame y el siguiente robo da pendingStack
  const fgCard = card(['aquatic', 'bird'], 'freegame');
  const game = await atPlayerTurn(chainOf(fgCard));
  game.state.freeGame.p1 = true;
  assert.equal(game.state.chains.p1.cards.length, 1, 'primera carta en mesa');
  assert.equal(game.state.freeGame.p1, true, 'free game quedó activo');
  assert.equal(game.state.pendingStack, null, 'todavía no se robó la carta para apilar');

  const extraCard = card(['aquatic', 'plant']);
  game.state.decks.p1.push(extraCard);

  // El siguiente robo (auto-draw o hit) roba la carta extra
  await game.hit();
  await idle();

  assert.ok(game.state.pendingStack, 'muestra pendingStack para elegir/colocar la carta');
  assert.equal(game.state.pendingStack.player, 'p1');
  assert.equal(game.state.pendingStack.card.uid, extraCard.uid);
  assert.equal(game.state.chains.p1.cards.length, 1, 'la carta extra todavía no está montada');

  // Colocar sobre la columna 0
  await game.chooseStackTarget(0);
  await idle();

  assert.equal(game.state.pendingStack, null, 'se resolvió el pendingStack');
  assert.equal(game.state.chains.p1.cards.length, 1, 'sigue siendo 1 columna');
  assert.equal(game.state.chains.p1.cards[0].stackedCards.length, 2, 'ahora tiene 2 cartas apiladas');
  assert.equal(game.state.freeGame.p1, false, 'se consumió el free game');
  assert.ok(swingOf(game.state, 'p1') > 0, 'la carta apilada suma al ataque');
  console.log('  ✓ free game (primera carta: activa pendingStack y coloca)');
}

{
  // 2. Free game como carta de apertura en beginTurn
  const game = await atPlayerTurn();
  const fgOpen = card(['aquatic', 'bird'], 'freegame');
  game.state.chains.p1 = chainOf(fgOpen);
  game.state.freeGame.p1 = true;
  assert.equal(game.state.chains.p1.cards.length, 1);
  assert.equal(game.state.freeGame.p1, true, 'abrió con free game');

  const extra = card(['aquatic', 'bug']);
  game.state.decks.p1.push(extra);
  await game.hit();
  await idle();
  assert.ok(game.state.pendingStack, 'abre pendingStack con la extra');
  await game.chooseStackTarget(0);
  await idle();
  assert.equal(game.state.chains.p1.cards[0].stackedCards.length, 2);
  console.log('  ✓ free game (apertura de turno activa robo extra)');
}

{
  // 3. Free game encadenado en primera carta
  const fg1 = card(['aquatic', 'bird'], 'freegame');
  const game = await atPlayerTurn(chainOf(fg1));
  game.state.freeGame.p1 = true;

  const fg2 = card(['aquatic', 'plant'], 'freegame');
  const plain = card(['aquatic', 'bug']);
  game.state.decks.p1.push(plain, fg2); // fg2 -> plain

  await game.hit(); // roba fg2 (como carta a montar)
  await idle();
  assert.ok(game.state.pendingStack);
  assert.equal(game.state.pendingStack.card.uid, fg2.uid);

  await game.chooseStackTarget(0); // monta fg2
  await idle();
  assert.equal(game.state.freeGame.p1, true, 'encadenó free game');
  assert.equal(game.state.pendingStack, null);

  await game.hit(); // roba plain
  await idle();
  assert.ok(game.state.pendingStack);
  assert.equal(game.state.pendingStack.card.uid, plain.uid);

  await game.chooseStackTarget(0); // monta plain
  await idle();
  assert.equal(game.state.freeGame.p1, false);
  assert.equal(game.state.chains.p1.cards[0].stackedCards.length, 3, '3 cartas apiladas en columna 0');
  console.log('  ✓ free game (encadenado en primera carta)');
}

{
  // 4. Free game con carta de poder apilada sobre él: el poder se preserva y tiene efecto al atacar
  const fg = card(['aquatic', 'bird'], 'freegame');
  const game = await atPlayerTurn(chainOf(fg));
  game.state.freeGame.p1 = true;

  const strCard = card(['aquatic', 'beast'], 'strength');
  game.state.decks.p1.push(strCard);

  await game.hit(); // roba carta con fuerza
  await idle();
  assert.ok(game.state.pendingStack);
  assert.equal(game.state.pendingStack.card.power, 'strength');

  await game.chooseStackTarget(0); // monta fuerza sobre free game
  await idle();

  const col = game.state.chains.p1.cards[0];
  assert.equal(col.stackedCards.length, 2, '2 cartas apiladas en columna 0');
  assert.deepEqual(col.powers, ['freegame', 'strength'], 'la columna conserva ambos poderes');
  assert.equal(col.power, 'strength', 'power refleja el poder de combate');

  // El poder de fuerza se aplica de inmediato al aparecer la carta
  assert.equal(game.state.status.p1.strength, 1, 'la fuerza se aplicó al aparecer (+1 de fuerza)');
  await game.stand();
  await idle();
  assert.equal(game.state.status.p1.strength, 1, 'conserva +1 de fuerza');
  console.log('  ✓ free game (poder apilado sobre free game no desaparece y tiene efecto)');
}

{
  // 5. Carta con poder de base con Free Game apilado sobre ella
  const poisonCard = card(['aquatic', 'bird'], 'poison');
  const game = await atPlayerTurn(chainOf(poisonCard));
  game.state.freeGame.p1 = true;

  const fgCard = card(['aquatic', 'plant'], 'freegame');
  game.state.decks.p1.push(fgCard);

  await game.hit();
  await idle();
  await game.chooseStackTarget(0);
  await idle();

  const col = game.state.chains.p1.cards[0];
  assert.deepEqual(col.powers, ['poison', 'freegame'], 'conserva veneno y free game');

  await game.stand();
  await idle();
  assert.ok(game.state.status.p2.poison > 0, 'el veneno se aplicó al rival');
  console.log('  ✓ free game (free game apilado sobre poder conserva el efecto del poder)');
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
    const game = await atPlayerTurn(chainOf(
      card(['aquatic', 'bird']),
      card(['aquatic', 'plant'], 'egg'),
      card(['aquatic', 'beast'], 'poison'),
      card(['aquatic', 'bug'], 'snail'),
      card(['aquatic', 'reptile'], 'octopus'),
      card(['aquatic', 'plant'], 'bubble'),
      card(['aquatic', 'beast'], 'brutal'),
      card(['aquatic', 'bug'], 'leaf'),
      card(['aquatic', 'reptile'], 'leech'),
      card(['aquatic', 'plant'], 'steelskin'),
      card(['aquatic', 'beast'], 'pot'),
    ));
    game.state.totals.p2 = 30; // que la maceta y la daga tengan algo que curar
    const events = watch(game);
    await game.stand();
    await idle();

    const [drink, stand] = events;
    assert.deepEqual(moments([drink]), ['brutal:stand:p1'], 'la bebida se vuelca primero, sola, al plantarse');
    assert.ok(stand, 'el ataque deja sus poderes animados en el estado');
    assert.equal(stand.player, 'p1');
    assert.deepEqual(moments([stand]), [
      'egg:apply:p1', 'poison:apply:p2', 'snail:apply:p2', 'octopus:apply:p1', 'bubble:apply:p1',
      'leaf:apply:p1', 'leech:apply:p2', 'steelskin:apply:p1', 'pot:apply:p1',
    ], 'cada uno sobre quien cae, en el orden de la cadena; la bebida ya se animó al plantarse');
    const of = (power) => stand.fx.find((f) => f.power === power);
    assert.equal(of('egg').amount + TUNING.steelskinShield, stand.status.p1.egg, 'con lo que sumó al escudo');
    assert.equal(of('poison').amount, stand.status.p2.poison);
    assert.equal(of('steelskin').amount, stand.status.p1.steelskin);
    assert.equal(of('leech').amount, TUNING.leechDrain);
    assert.ok(of('leech').heal > 0 && of('pot').amount > 0, 'y lo que curó de verdad');
    assert.ok(stand.fx.every((f) => powerBeat(f) > 0), 'cada uno con su compás');
  }

  // Los segundos momentos: el caracol parte el ataque y la máscara lo frena.
  {
    const game = await atPlayerTurn(chainOf(
      card(['aquatic', 'bird']), card(['aquatic', 'plant']), card(['aquatic', 'beast']), card(['aquatic', 'bug']),
    ));
    game.state.status.p1.weak = 1;
    game.state.status.p2.steelskin = 3;
    const events = watch(game);
    await game.stand();
    await idle();
    assert.deepEqual(moments(events).slice(0, 2), ['snail:slow:p1', 'steelskin:block:p2'],
      'el caracol sobre el que pega y la máscara sobre el que la tiene');
    assert.ok(events[0].fx[1].mitigated > 0, 'con lo que frenó');
  }

  // La fuerza, al robarla; la burbuja, al abrir la ronda.
  {
    const game = await atPlayerTurn(chainOf(card(['aquatic', 'bird'])));
    const events = watch(game);
    game.state.decks.p1.push(card(['aquatic', 'plant'], 'strength'));
    await game.hit();
    await idle();
    assert.deepEqual(moments(events), ['strength:draw:p1'], 'la fuerza se anima al salir');
  }

  // La bebida no se anima al entrar: se vuelca al plantarse, antes del recorrido y del
  // golpe, con lo que le suma al daño.
  {
    const game = await atPlayerTurn(chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant'])));
    const events = watch(game);
    game.state.decks.p1.push(card(['aquatic', 'beast'], 'brutal'));
    await game.hit();
    assert.deepEqual(moments(events), [], 'al entrar a la cadena todavía no se anima');
    assert.equal(game.state.poured.p1, false, 'ni cuenta en el número de la pantalla');
    const bonus = brutalBonusOf(game.state.chains.p1);
    assert.ok(bonus > 0);
    const full = swingOf(game.state, 'p1');
    assert.equal(swingOf(game.state, 'p1', { brutal: false }), full - bonus, 'sin la bebida, el golpe sin su bono');

    const beats = [];
    game.subscribe((s) => {
      if (s.aiming && beats.at(-1) !== 'aim') beats.push('aim');
      if (s.lastHit && !beats.includes('hit')) beats.push('hit');
    });
    const standing = game.stand();
    const [drink] = events;
    assert.deepEqual(moments(events), ['brutal:stand:p1'], 'se vuelca al plantarse');
    assert.equal(drink.fx[0].amount, bonus, 'con lo que suma la bebida');
    assert.deepEqual(beats, [], 'antes de que la cadena se recorra y salga el golpe');
    assert.equal(game.state.poured.p1, true);
    await standing;
    await idle();
    assert.deepEqual(beats.slice(0, 2), ['aim', 'hit'], 'y después, el recorrido y el golpe');
    assert.equal(game.state.lastHit.amount, full, 'el golpe la lleva sumada');
  }

  // El veneno al finalizar el turno, las hojas al empezarlo, y la burbuja y el pulpo en el centro.
  {
    const game = await atPlayerTurn(chainOf(
      card(['aquatic', 'bird']),
      card(['aquatic', 'plant'], 'poison'),
      card(['aquatic', 'beast'], 'leaf'),
      card(['aquatic', 'bug'], 'octopus'),
      card(['aquatic', 'reptile'], 'bubble'),
    ));
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

console.log('✓ poderes ok');


