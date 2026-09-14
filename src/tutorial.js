// El tutorial: una partida controlada y guiada paso a paso donde cada carta,
// acción y decisión está pautada para enseñar todas las mecánicas del juego.
//
// Reglas del tutorial:
//  - Las acciones están BLOQUEADAS ('hit', 'stand', 'draft') según lo que el
//    paso actual requiera. El jugador no puede robar cuando debe atacar ni viceversa.
//  - Los mazos están guionados por ronda, con cartas de respaldo para evitar desbordes.
//  - La CPU juega de forma determinística en cada ronda.
//  - En la ronda 5 la vida de la CPU se calibra para demostrar la Última Chance y la Victoria.

import { SYMBOLS, crest, makeCard } from './data.js';

// ---- Mazos guionados por ronda -----------------------------------------------
// En game.js `draw(player)` saca con `.pop()` del final del array.
// Por lo tanto, el último elemento del array es la primera carta en salir.

function createDecks() {
  return {
    // Ronda 1: Tu primer golpe (2 cartas: Pez + Bestia -> Pez + Pájaro = 5 pts)
    1: {
      p1: [
        makeCard(['aquatic', 'plant']),
        makeCard(['aquatic', 'reptile']),
        makeCard(['aquatic', 'bug']),
        makeCard(['bird', 'plant']),
        makeCard(['aquatic', 'bird']),   // 2ª carta (robar)
        makeCard(['aquatic', 'beast']),  // 1ª carta (apertura)
      ],
      p2: [
        makeCard(['plant', 'bug']),
        makeCard(['plant', 'reptile']),
        makeCard(['plant', 'beast']),    // 2ª carta
        makeCard(['plant', 'bird']),     // 1ª carta (CPU hace 4 pts)
      ],
    },

    // Ronda 2: El riesgo y el bust (Cadena de 3 Pez -> 9 pts -> 4ª carta corta)
    2: {
      p1: [
        makeCard(['beast', 'bird']),
        makeCard(['bug', 'reptile']),
        makeCard(['bird', 'plant']),      // 4ª carta (corta la cadena -> BUST!)
        makeCard(['aquatic', 'reptile']), // 3ª carta (Pez largo 3 = 9 pts)
        makeCard(['aquatic', 'bug']),     // 2ª carta (Pez largo 2 = 4 pts)
        makeCard(['aquatic', 'plant']),   // 1ª carta (apertura)
      ],
      p2: [
        makeCard(['plant', 'bug']),
        makeCard(['plant', 'aquatic']),
        makeCard(['plant', 'reptile']),   // 2ª carta
        makeCard(['plant', 'beast']),     // 1ª carta
      ],
    },

    // Ronda 3: El draft de poderes (Cadena segura de 2 -> stand -> draft Maceta)
    3: {
      p1: [
        makeCard(['aquatic', 'reptile']),
        makeCard(['beast', 'bird']),
        makeCard(['aquatic', 'bird']),    // 2ª carta
        makeCard(['aquatic', 'plant']),   // 1ª carta
      ],
      p2: [
        makeCard(['plant', 'bug']),
        makeCard(['plant', 'reptile']),
        makeCard(['plant', 'bird']),      // 2ª carta
        makeCard(['plant', 'beast']),     // 1ª carta
      ],
    },

    // Ronda 4: Los poderes en acción (Sale la Maceta y cadena de 7 cartas = 75 pts)
    4: {
      p1: [
        makeCard(['aquatic', 'plant']),                   // Respaldo
        makeCard(['beast', 'bird']),                      // Respaldo
        makeCard(['aquatic', 'beast']),                   // 7ª carta (Pez largo 7 = 49 pts)
        makeCard(['aquatic', 'bird']),                    // 6ª carta (Planta cierra en 5 = 25 pts)
        makeCard(['aquatic', 'plant']),                   // 5ª carta (Pez y Planta largo 5)
        makeCard(['aquatic', 'plant']),                   // 4ª carta (Pez y Planta largo 4)
        makeCard(['aquatic', 'plant', 'reptile'], 'pot'), // 3ª carta (¡Maceta! Pez y Planta largo 3)
        makeCard(['aquatic', 'plant']),                   // 2ª carta (Bicho cierra en 1 = 1 pt)
        makeCard(['aquatic', 'plant', 'bug']),            // 1ª carta (apertura: Pez + Planta + Bicho)
      ],
      p2: [
        makeCard(['plant', 'bug']),
        makeCard(['plant', 'aquatic']),
        makeCard(['plant', 'reptile']),   // 2ª carta
        makeCard(['plant', 'bird']),      // 1ª carta
      ],
    },

    // Ronda 5: Remate, Última Chance y Victoria (Cadena de 4 = 16 pts -> CPU a 0)
    5: {
      p1: [
        makeCard(['aquatic', 'plant']),
        makeCard(['aquatic', 'beast']),   // 4ª carta (Pez largo 4 = 16 pts)
        makeCard(['aquatic', 'bug']),     // 3ª carta (Pez largo 3)
        makeCard(['aquatic', 'bird']),    // 2ª carta (Pez largo 2)
        makeCard(['aquatic', 'reptile']), // 1ª carta (apertura)
      ],
      p2: [
        makeCard(['plant', 'bug']),
        makeCard(['bird', 'beast']),      // 3ª carta (CPU se corta en Última Chance!)
        makeCard(['plant', 'reptile']),   // 2ª carta
        makeCard(['plant', 'beast']),     // 1ª carta
      ],
    },
  };
}

let potCardRef = null;
function buildTutorialPool() {
  potCardRef = makeCard(['aquatic', 'plant', 'reptile'], 'pot');
  const marketCards = [
    makeCard(['beast', 'bird']),
    makeCard(['aquatic', 'reptile']),
    makeCard(['bird', 'plant']),
    potCardRef, // Maceta en el market
    makeCard(['bug', 'reptile']),
    makeCard(['plant', 'bug']),
  ];
  const reserveCards = [
    makeCard(['beast', 'aquatic', 'bird'], 'egg'),
    makeCard(['aquatic', 'bug', 'reptile'], 'poison'),
    makeCard(['beast', 'aquatic', 'plant'], 'strength'),
    makeCard(['aquatic', 'bird', 'plant']),
    makeCard(['beast', 'reptile']),
    makeCard(['aquatic', 'plant']),
    makeCard(['bird', 'bug']),
    makeCard(['beast', 'plant']),
  ];
  // refillMarket() saca con .pop() del final, así que la reserva va al inicio
  // y las 6 cartas del mercado inicial van al final para salir de inmediato.
  return [...reserveCards, ...marketCards];
}

// ---- Pasos del tutorial ------------------------------------------------------
// Cada paso define:
//   id: identificador único
//   allowedAction: 'hit' | 'stand' | 'draft' | 'none' | 'any'
//   allowedCard: uid o 'pot' para restringir la elección del market
//   highlight: selector CSS a resaltar
//   message: texto HTML explicativo
//   ctaText: texto del botón de avance si requiere clic (por defecto 'Dale →')
//   isActionStep: true si el paso avanza al realizar la acción en el tablero
//   advanceTrigger: función (state, prev) => boolean que avanza al siguiente paso

function createSteps() {
  return [
    // ── Ronda 1: Tu primer golpe ──────────────────────────────────────────
    {
      id: 'r1-intro',
      round: 1,
      type: 'coach',
      allowedAction: 'hit',
      highlight: '#controls [data-action="hit"], #field .card, #field .sym[data-on="true"]',
      title: 'Tu primera carta',
      desc: 'Esta es tu carta inicial. Los símbolos que aparecen acá abren tus <b>cadenas de puntos</b>.',
      action: 'Apretá <b>"Robar carta"</b> para sacar la siguiente del mazo.',
      advanceTrigger: (s) => s.round === 1 && s.chains.p1.cards.length >= 2,
    },
    {
      id: 'r1-card2',
      round: 1,
      type: 'coach',
      allowedAction: 'stand',
      highlight: (s) => s.roundScores?.p1 !== null
        ? '#axie-p2'
        : '#controls [data-action="stand"], #swing, #field .sym[data-on="true"], #field .runs .run',
      title: '¡La cadena continúa!',
      desc: `Tu cadena de ${crest('aquatic', 'sm')} Pez sigue viva (largo <b>2</b> = 4 pts). ` +
        `La de ${crest('beast', 'sm')} Bestia se cerró (1 pt). Daño total: <b>5</b>.`,
      action: (s) => s.roundScores?.p1 !== null
        ? '¡Atacando! Mirá el impacto...'
        : 'Apretá <b>"Atacar"</b> para plantarte y golpear al rival.',
      advanceTrigger: (s) => s.round === 1 && s.phase === 'draft',
    },
    {
      id: 'r1-damage-expl',
      round: 1,
      type: 'modal',
      allowedAction: 'none',
      highlight: '#swing, #field .sym[data-on="true"], #field .runs .run',
      title: '¡Golpe conectado! 💥',
      message: (s) => `<b>¡Golpe conectado! 💥</b><br><br>` +
        `Hiciste <b>${s.roundScores.p1 ?? 5}</b> de daño a tu rival.<br><br>` +
        `Los puntos se calculan como <b>largo al cuadrado (L²)</b>:<br>` +
        `• Pez (largo 2): 2² = <b>4 puntos</b><br>` +
        `• Bestia (largo 1): 1² = <b>1 punto</b><br>` +
        `Total: <b>5 de daño</b>.<br><br>` +
        `¡Cuanto más larga sea la cadena, mucho más daño hacés!`,
      ctaText: 'Entendido →',
      advanceTrigger: () => true,
    },
    {
      id: 'r1-draft',
      round: 1,
      type: 'coach',
      allowedAction: 'draft',
      highlight: '#market .market-row',
      title: 'El Centro (Draft)',
      desc: (s) => s.phase !== 'draft'
        ? 'Carta agregada a tu mazo. Ahora la CPU juega su turno...'
        : 'Después de atacar, podés elegir cartas del Centro para sumar a tu mazo en las próximas rondas.',
      action: (s) => s.phase !== 'draft'
        ? 'Esperá a que la CPU termine su turno.'
        : 'Elegí cualquier carta <b>sin poder</b> para sumarla a tu mazo.',
      advanceTrigger: (s) => s.round === 2 && s.turn === 'p1' && s.phase === 'turn',
    },

    // ── Ronda 2: El riesgo y el corte (Bust) ──────────────────────────────
    {
      id: 'r2-start',
      round: 2,
      type: 'coach',
      allowedAction: 'hit',
      highlight: '#controls [data-action="hit"]',
      title: 'Ronda 2 — La ambición y el riesgo',
      desc: 'Tu mazo se rebarajó completo. Vamos a armar una cadena más larga para multiplicar los puntos.',
      action: 'Apretá <b>"Robar carta"</b>.',
      advanceTrigger: (s) => s.round === 2 && s.chains.p1.cards.length >= 2,
    },
    {
      id: 'r2-card2',
      round: 2,
      type: 'coach',
      allowedAction: 'hit',
      highlight: '#controls [data-action="hit"], #swing, #field .sym[data-on="true"], #field .runs .run',
      title: 'Cadena viva',
      desc: 'Pez sigue vivo con largo 2 (4 puntos). Sigamos arriesgando para sumar más.',
      action: 'Apretá <b>"Robar carta"</b> otra vez.',
      advanceTrigger: (s) => s.round === 2 && s.chains.p1.cards.length >= 3,
    },
    {
      id: 'r2-card3',
      round: 2,
      type: 'coach',
      allowedAction: 'hit',
      highlight: '#controls [data-action="hit"], #odds, #swing, #field .sym[data-on="true"], #field .runs .run',
      title: '¡Cadena de 3! 🎉',
      desc: 'Pez ahora vale <b>3² = 9 puntos</b>. Pero mirá el <b>dial de odds</b>: las chances de sobrevivir bajaron mucho.',
      action: (s) => s.chains?.p1?.busted
        ? '¡Se cortó la cadena! Mirá lo que pasa...'
        : 'Robá una carta más para ver qué pasa cuando se corta.',
      advanceTrigger: (s) => s.round === 2 && s.chains.p1.busted && s.phase === 'draft',
    },
    {
      id: 'r2-busted',
      round: 2,
      type: 'modal',
      allowedAction: 'none',
      highlight: null,
      title: '¡Se cortó la cadena! 💥',
      message: `<b>¡Se cortó la cadena! 💥</b><br><br>` +
        `Ningún símbolo de esta carta coincidía con los que seguían vivos.<br><br>` +
        `Tu ataque vale <b>0 de daño</b> y perdiste todo el puntaje de esta ronda.<br><br>` +
        `Saber cuándo plantarte es la decisión más importante del juego.`,
      ctaText: 'Continuar →',
      advanceTrigger: () => true,
    },
    {
      id: 'r2-draft',
      round: 2,
      type: 'coach',
      allowedAction: 'draft',
      highlight: '#market .market-row',
      title: 'Penalización por corte',
      desc: (s) => s.phase !== 'draft'
        ? 'Carta agregada. La CPU juega su turno...'
        : 'Al cortarse la cadena, el centro te penaliza: solo podés llevarte <b>1 carta sin poder</b>.',
      action: (s) => s.phase !== 'draft'
        ? 'Esperá a que la CPU termine su turno.'
        : 'Elegí una carta del centro.',
      advanceTrigger: (s) => s.round === 3 && s.turn === 'p1' && s.phase === 'turn',
    },

    // ── Ronda 3: El draft de poderes ──────────────────────────────────────
    {
      id: 'r3-start',
      round: 3,
      type: 'coach',
      allowedAction: 'hit',
      highlight: '#controls [data-action="hit"]',
      title: 'Ronda 3 — Cartas con Poder',
      desc: 'Armá una cadena segura de 2 cartas y asegurá el ataque.',
      action: 'Apretá <b>"Robar carta"</b>.',
      advanceTrigger: (s) => s.round === 3 && s.chains.p1.cards.length >= 2,
    },
    {
      id: 'r3-stand',
      round: 3,
      type: 'coach',
      allowedAction: 'stand',
      highlight: (s) => s.roundScores?.p1 !== null
        ? '#axie-p2'
        : '#controls [data-action="stand"], #swing, #field .sym[data-on="true"], #field .runs .run',
      title: 'Asegurar el ataque',
      desc: 'Tenés 5 puntos seguros. Plantate con éxito para desbloquear el draft de poderes.',
      action: (s) => s.roundScores?.p1 !== null
        ? '¡Atacando! Mirá el impacto...'
        : 'Apretá <b>"Atacar"</b>.',
      advanceTrigger: (s) => s.round === 3 && s.phase === 'draft',
    },
    {
      id: 'r3-draft-pot',
      round: 3,
      type: 'coach',
      allowedAction: 'draft',
      allowedCard: 'pot',
      highlight: '#market [data-power="pot"]',
      title: '¡Cartas con Poder! 🔮',
      desc: (s) => s.phase !== 'draft'
        ? '¡Maceta conseguida! La CPU juega su turno...'
        : 'Como te plantaste bien, podés elegir <b>1 carta con poder</b>. ' +
          'Mirá la <b>Maceta 🌱</b>: te cura exactamente lo mismo que pegás.',
      action: (s) => s.phase !== 'draft'
        ? 'Esperá a que la CPU termine su turno.'
        : 'Hacé click en la carta de la <b>Maceta 🌱</b> en el centro.',
      advanceTrigger: (s) => s.round === 4 && s.turn === 'p1' && s.phase === 'turn',
    },

    // ── Ronda 4: Los poderes en acción ────────────────────────────────────
    {
      id: 'r4-start',
      round: 4,
      type: 'coach',
      allowedAction: 'hit',
      highlight: '#controls [data-action="hit"]',
      title: 'Ronda 4 — Activando el poder',
      desc: 'La Maceta ya está en tu mazo. Vamos a buscarla y a armar una súper cadena.',
      action: 'Apretá <b>"Robar carta"</b>.',
      advanceTrigger: (s) => s.round === 4 && s.chains.p1.cards.length >= 2,
    },
    {
      id: 'r4-card2',
      round: 4,
      type: 'coach',
      allowedAction: 'hit',
      highlight: '#controls [data-action="hit"]',
      title: 'Buscando la Maceta',
      desc: 'Todavía no salió. Robá otra carta del mazo.',
      action: 'Apretá <b>"Robar carta"</b>.',
      advanceTrigger: (s) => s.round === 4 && s.chains.p1.cards.some((c) => c.power === 'pot'),
    },
    {
      id: 'r4-pot-drawn',
      round: 4,
      type: 'coach',
      allowedAction: 'hit',
      highlight: '#controls [data-action="hit"], #field [data-power="pot"]',
      title: '¡Salió la Maceta! 🌱',
      desc: 'Mirá el icono de la maceta abajo de la carta. Al atacar con éxito, ' +
        '<b>te vas a curar todo el daño que hagas</b>. ¡Sigamos robando para armar un golpe demoledor!',
      action: 'Apretá <b>"Robar carta"</b>.',
      advanceTrigger: (s) => s.round === 4 && s.chains.p1.cards.length >= 4,
    },
    {
      id: 'r4-card4',
      round: 4,
      type: 'coach',
      allowedAction: 'hit',
      highlight: '#controls [data-action="hit"], #swing, #field .sym[data-on="true"], #field .runs .run',
      title: 'Cadena doble en alza ⚡',
      desc: `Tanto ${crest('aquatic', 'sm')} Pez como ${crest('plant', 'sm')} Planta siguen vivos (largo 4 cada uno). ` +
        `¡El daño escala a toda velocidad!`,
      action: 'Apretá <b>"Robar carta"</b>.',
      advanceTrigger: (s) => s.round === 4 && s.chains.p1.cards.length >= 5,
    },
    {
      id: 'r4-card5',
      round: 4,
      type: 'coach',
      allowedAction: 'hit',
      highlight: '#controls [data-action="hit"], #swing, #field .sym[data-on="true"], #field .runs .run',
      title: '¡5 cartas seguidas! 🔥',
      desc: 'Largo 5 en Pez y Planta (25 + 25 = 50 puntos). ¡El combo ya es gigante, sigamos!',
      action: 'Apretá <b>"Robar carta"</b>.',
      advanceTrigger: (s) => s.round === 4 && s.chains.p1.cards.length >= 6,
    },
    {
      id: 'r4-card6',
      round: 4,
      type: 'coach',
      allowedAction: 'hit',
      highlight: '#controls [data-action="hit"], #swing, #field .sym[data-on="true"], #field .runs .run',
      title: '¡6 cartas! Pez imparable 🌊',
      desc: `Planta cerró en 25 pts, pero ${crest('aquatic', 'sm')} Pez sigue con largo 6 (36 pts). ` +
        `¡Robá una carta más para alcanzar el daño colosal!`,
      action: 'Apretá <b>"Robar carta"</b>.',
      advanceTrigger: (s) => s.round === 4 && s.chains.p1.cards.length >= 7,
    },
    {
      id: 'r4-strike',
      round: 4,
      type: 'coach',
      allowedAction: 'stand',
      highlight: (s) => s.roundScores?.p1 !== null
        ? '#axie-p1'
        : '#controls [data-action="stand"], #swing, #field [data-power="pot"], #field .sym[data-on="true"], #field .runs .run',
      title: '¡Cadena colosal de 7 cartas! 💥',
      desc: 'Pez (largo 7 = 49) + Planta (largo 5 = 25) + Bicho (1) = <b>¡75 de daño!</b> ' +
        'Vas a dejar al rival con solo <b>15 HP</b> y la Maceta te restaurará toda la vida.',
      action: (s) => s.roundScores?.p1 !== null
        ? '¡Ataque colosal y curación! Mirá el impacto...'
        : 'Apretá <b>"Atacar"</b> para conectar el golpe y curarte.',
      advanceTrigger: (s) => s.round === 4 && s.phase === 'draft',
    },
    {
      id: 'r4-healed',
      round: 4,
      type: 'modal',
      allowedAction: 'none',
      highlight: null,
      title: '¡Poder activado y daño demoledor! ✨💥',
      message: (s) => `<b>¡Poder activado y daño demoledor! ✨💥</b><br><br>` +
        `Pegaste <b>${s.roundScores.p1 ?? 75} de daño</b> y la <b>Maceta 🌱</b> recuperó tu vida al máximo.<br><br>` +
        `Tu rival quedó tambaleando con solo <b>15 HP</b>.<br><br>` +
        `Las cadenas largas combinadas con poderes especiales pueden dar vuelta y definir cualquier partida.`,
      ctaText: 'Continuar →',
      advanceTrigger: () => true,
    },
    {
      id: 'r4-draft',
      round: 4,
      type: 'coach',
      allowedAction: 'draft',
      highlight: '#market .market-row',
      title: 'Draft del Centro',
      desc: (s) => s.phase !== 'draft'
        ? 'Carta agregada. La CPU juega su turno...'
        : 'Elegí cualquier carta disponible del centro para sumar a tu mazo.',
      action: (s) => s.phase !== 'draft'
        ? 'Esperá a que la CPU termine su turno.'
        : 'Elegí una carta del centro.',
      advanceTrigger: (s) => s.round === 5 && s.turn === 'p1' && s.phase === 'turn',
    },

    // ── Ronda 5: Remate, Última Chance y Victoria ─────────────────────────
    {
      id: 'r5-start',
      round: 5,
      type: 'coach',
      allowedAction: 'hit',
      highlight: '#controls [data-action="hit"], #plate-p2 .plate-hp',
      title: 'Ronda 5 — ¡El remate final!',
      desc: 'A tu rival le quedan solo <b>15 HP</b>. Con una cadena de 4 cartas (4² = <b>16 de daño</b>), ¡lo dejamos en 0!',
      action: 'Apretá <b>"Robar carta"</b>.',
      advanceTrigger: (s) => s.round === 5 && s.chains.p1.cards.length >= 2,
    },
    {
      id: 'r5-card2',
      round: 5,
      type: 'coach',
      allowedAction: 'hit',
      highlight: '#controls [data-action="hit"], #swing, #field .sym[data-on="true"], #field .runs .run',
      title: 'Cadena de 2',
      desc: 'Pez largo 2 (4 puntos). Seguí robando para alcanzar 16.',
      action: 'Apretá <b>"Robar carta"</b>.',
      advanceTrigger: (s) => s.round === 5 && s.chains.p1.cards.length >= 3,
    },
    {
      id: 'r5-card3',
      round: 5,
      type: 'coach',
      allowedAction: 'hit',
      highlight: '#controls [data-action="hit"], #swing, #field .sym[data-on="true"], #field .runs .run',
      title: 'Cadena de 3',
      desc: 'Pez largo 3 (9 puntos). ¡Una carta más para alcanzar 16!',
      action: 'Apretá <b>"Robar carta"</b>.',
      advanceTrigger: (s) => s.round === 5 && s.chains.p1.cards.length >= 4,
    },
    {
      id: 'r5-card4',
      round: 5,
      type: 'coach',
      allowedAction: 'stand',
      highlight: (s) => s.roundScores?.p1 !== null
        ? '#axie-p2'
        : '#controls [data-action="stand"], #swing, #field .sym[data-on="true"], #field .runs .run',
      title: '¡Cadena de 4! 🎯',
      desc: '4² = <b>16 de daño</b>. Es suficiente para dejar a la CPU en 0 de vida.',
      action: (s) => s.roundScores?.p1 !== null
        ? '¡Ataque final! Mirá el impacto...'
        : 'Apretá <b>"Atacar"</b>.',
      advanceTrigger: (s) => s.round === 5 && Boolean(s.tutorialLastChanceReady),
    },
    {
      id: 'r5-last-chance-expl',
      round: 5,
      type: 'modal',
      allowedAction: 'none',
      highlight: null,
      title: '¡Rival en 0 de vida! Pero atención... ⏳',
      message: `<b>¡Rival en 0 de vida! Pero atención... ⏳</b><br><br>` +
        `Como la CPU juega segunda en el intercambio, tiene su <b>Última Chance</b>.<br>` +
        `Si en este turno te deja en 0 a vos también, empatan. Si falla, ¡ganás!<br><br>` +
        `Mirá su último intento...`,
      ctaText: 'Ver Última Chance →',
      advanceTrigger: () => true,
    },
    {
      id: 'r5-victory',
      round: 5,
      type: 'modal',
      allowedAction: 'none',
      highlight: null,
      title: '¡Victoria! 🎉🏆',
      message: `<b>¡Victoria! 🎉🏆</b><br><br>` +
        `¡Completaste con éxito el tutorial de Axie Chance!<br><br>` +
        `Ya dominás los pilares del juego:<br>` +
        `✅ Cadenas de símbolos y fórmula L²<br>` +
        `✅ El dial de odds y el riesgo de corte<br>` +
        `✅ El draft del Centro y deck building<br>` +
        `✅ Los poderes especiales<br>` +
        `✅ La Última Chance<br><br>` +
        `¡Todo listo para jugar de verdad!`,
      ctaText: 'Ir al Menú Principal 🎮',
      advanceTrigger: () => true,
    },
  ];
}

// ---- Overlay del tutorial ----------------------------------------------------

/** Un texto de un paso: fijo, o calculado del estado. */
const stepText = (value, state) => (typeof value === 'function' ? value(state) : (value || ''));

export function createOverlay() {
  let el = document.getElementById('tutorial-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tutorial-overlay';
    el.className = 'tuto-overlay';
    document.body.appendChild(el);
  }

  let onCtaClick = null;
  let onQuitClick = null;
  let activeHighlights = [];

  function clearHighlights() {
    activeHighlights.forEach((node) => {
      try { node.classList.remove('tuto-hl'); } catch {}
    });
    activeHighlights = [];
    document.querySelectorAll('.tuto-hl').forEach((node) => {
      try { node.classList.remove('tuto-hl'); } catch {}
    });
  }

  function applyHighlights(selector) {
    clearHighlights();
    if (!selector) return;
    try {
      document.querySelectorAll(selector).forEach((target) => {
        target.classList.add('tuto-hl');
        activeHighlights.push(target);
      });
    } catch {
      // Ignorar selectores que no existan en el DOM simulado
    }
  }

  return {
    show({ step, state, onDismiss = null, onQuit = null }) {
      const isModal = step.allowedAction === 'none' || step.type === 'modal';
      onCtaClick = onDismiss;
      onQuitClick = onQuit;

      el.hidden = false;
      el.className = `tuto-overlay is-on ${isModal ? 'is-modal' : 'is-coach'}`;

      const title = stepText(step.title, state);
      const desc = stepText(step.desc, state);
      const action = stepText(step.action, state);
      const messageHtml = stepText(step.message, state);
      const ctaText = step.ctaText ?? (isModal ? 'Continuar →' : 'Entendido');
      const roundNum = step.round ?? state?.round ?? 1;

      if (isModal) {
        el.innerHTML = `
          <div class="tuto-dialog" role="dialog" aria-modal="true">
            <div class="tuto-msg">${messageHtml || (title ? `<b>${title}</b><br><br>${desc}` : desc)}</div>
            <button class="tuto-cta" type="button">${ctaText}</button>
          </div>`;
        const ctaBtn = el.querySelector('.tuto-cta');
        if (ctaBtn) {
          ctaBtn.onclick = () => {
            if (onCtaClick) onCtaClick();
          };
        }
      } else {
        // Coach mode: banner superior
        const contentHtml = desc || messageHtml;
        el.innerHTML = `
          <div class="tuto-coach" role="region" aria-label="Guía del tutorial">
            <div class="tuto-coach-header">
              <span class="tuto-coach-tag"><i class="tuto-bulb" aria-hidden="true">💡</i> Tutorial</span>
              <span class="tuto-coach-step">Ronda ${roundNum}</span>
              <button class="tuto-coach-close" type="button" title="Salir del tutorial">Salir ✕</button>
            </div>
            <div class="tuto-coach-body">
              ${title ? `<strong class="tuto-coach-title">${title}</strong>` : ''}
              <div class="tuto-coach-desc">${contentHtml}</div>
            </div>
            ${action ? `<div class="tuto-coach-act"><span class="tuto-act-icon" aria-hidden="true">👉</span> <span>${action}</span></div>` : ''}
          </div>`;

        const closeBtn = el.querySelector('.tuto-coach-close');
        if (closeBtn) {
          closeBtn.onclick = () => {
            if (onQuitClick) onQuitClick();
          };
        }
      }

      applyHighlights(typeof step.highlight === 'function' ? step.highlight(state) : step.highlight);
    },
    updateText({ step, state }) {
      if (el.hidden || !step || step.type !== 'coach') return;
      const descEl = el.querySelector('.tuto-coach-desc');
      if (descEl) descEl.innerHTML = stepText(step.desc, state);
      const actSpan = el.querySelector('.tuto-coach-act span:last-child');
      if (actSpan) actSpan.innerHTML = stepText(step.action, state);
    },
    refreshHighlight(selector) {
      applyHighlights(selector);
    },
    hide() {
      el.classList.remove('is-on');
      el.hidden = true;
      clearHighlights();
    },
    destroy() {
      clearHighlights();
      el.remove();
    },
  };
}

// ---- Motor del Tutorial ------------------------------------------------------

export function createTutorial(game, onDone = () => {}) {
  const overlay = createOverlay();
  const allDecks = createDecks();
  const STEPS = createSteps();
  let stepIndex = 0;
  let currentStep = STEPS[0];
  let unsub = null;
  let finished = false;
  let pendingLastChanceResolve = null;

  function applyStepGating(step, state) {
    if (!state) return;
    state.tutorialAllowed = step.allowedAction ?? 'any';
    // En los repartos de las rondas 1 y 2 solo hay cartas sin poder; en el de la 3, la
    // Maceta y nada más, sin poder saltearla.
    const pot = step.allowedCard === 'pot';
    if (pot && !state.market.some((c) => c.power === 'pot')) {
      potCardRef ??= makeCard(['aquatic', 'plant', 'reptile'], 'pot');
      state.market[0] = potCardRef;
    }
    state.tutorialPlainOnly = step.id === 'r1-draft' || step.id === 'r2-draft';
    state.tutorialAllowedCard = pot ? state.market.find((c) => c.power === 'pot').uid : null;
    state.tutorialDisallowSkip = pot;
    state.tutorialAllowRenew = false;
    game.refresh();
  }

  function presentStep(step, state) {
    currentStep = step;
    applyStepGating(step, state);

    const isInfoOnly = step.allowedAction === 'none';

    overlay.show({
      step,
      state,
      onQuit: () => {
        cleanup();
        onDone();
      },
      onDismiss: () => {
        if (step.id === 'r5-victory') {
          cleanup();
          onDone();
          return;
        }

        if (step.id === 'r5-last-chance-expl') {
          overlay.hide();
          if (pendingLastChanceResolve) {
            const resolve = pendingLastChanceResolve;
            pendingLastChanceResolve = null;
            resolve();
          }
          return;
        }

        if (isInfoOnly) {
          // Los pasos solo informativos avanzan con el botón CTA
          advanceStep();
        } else {
          // En los pasos de acción, cerrar mantiene el gating activo en el tablero
          overlay.hide();
        }
      },
    });
  }

  function advanceStep() {
    stepIndex++;
    if (stepIndex >= STEPS.length) {
      cleanup();
      onDone();
      return;
    }
    const next = STEPS[stepIndex];
    presentStep(next, game.state);
  }

  function onRoundStart(round) {
    const st = game.state;
    if (!st) return;

    // En ronda 5, ajustar vida de la CPU para que comience con 15 HP
    if (round === 5) {
      st.totals.p1 = 85; // 100 - 85 = 15 HP
      st.status.p2.egg = 0; // sin escudo
      st.tutorialLastChanceReady = false;
    }

    const roundDecks = allDecks[round];
    if (roundDecks) {
      st.decks.p1 = roundDecks.p1.map((c) => ({ ...c }));
      st.decks.p2 = roundDecks.p2.map((c) => ({ ...c }));
    }
  }

  function cleanup() {
    if (finished) return;
    finished = true;
    if (unsub) unsub();
    overlay.destroy();
    if (pendingLastChanceResolve) {
      pendingLastChanceResolve();
      pendingLastChanceResolve = null;
    }
    if (game.state) {
      game.state.tutorial = false;
      game.state.tutorialAllowed = null;
      game.state.tutorialAllowedCard = null;
      game.state.tutorialPlainOnly = false;
      game.state.tutorialLastChanceReady = false;
      game.state.onRoundStart = null;
      game.state.onTutorialBeforeBot = null;
    }
    localStorage.setItem('tutorialDone', 'true');
  }

  // Configurar la partida en modo tutorial
  const pool = buildTutorialPool();
  game.newMatch({
    mode: 'tutorial',
    difficulty: 'facil',
    axie: 'aquatic',
    axie2: 'plant',
    activePowers: ['pot', 'egg', 'poison', 'strength', 'snail', 'octopus'],
    scriptedDecks: allDecks[1],
    scriptedPool: pool,
  });

  game.state.onRoundStart = onRoundStart;
  game.state.onTutorialBeforeBot = () => {
    return new Promise((resolve) => {
      pendingLastChanceResolve = resolve;
      game.state.tutorialLastChanceReady = true;
      game.refresh();
    });
  };

  // Presentar el primer paso una vez que la mesa está lista
  setTimeout(() => {
    if (game.state) {
      presentStep(STEPS[0], game.state);
    }
  }, 400);

  // Escuchar cambios de estado para avanzar según las acciones del jugador
  unsub = game.subscribe((state) => {
    if (!state || finished) return;

    // Refrescar texto dinámico del banner coach
    overlay.updateText({ step: currentStep, state });

    // Refrescar resaltado en el DOM si el estado cambió
    if (currentStep?.highlight) {
      const sel = typeof currentStep.highlight === 'function'
        ? currentStep.highlight(state)
        : currentStep.highlight;
      overlay.refreshHighlight(sel);
    }

    // Si el paso actual es de acción y su condición de avance se cumplió:
    if (currentStep && currentStep.allowedAction !== 'none') {
      if (currentStep.advanceTrigger && currentStep.advanceTrigger(state)) {
        advanceStep();
        return;
      }
    }

    // Si la partida terminó por victoria antes del último paso
    if (state.phase === 'matchEnd' && currentStep?.id !== 'r5-victory') {
      const victoryStep = STEPS.find((s) => s.id === 'r5-victory');
      if (victoryStep) {
        stepIndex = STEPS.indexOf(victoryStep);
        setTimeout(() => {
          if (!finished) presentStep(victoryStep, state);
        }, 500);
      }
    }
  });

  return {
    destroy: cleanup,
  };
}

export { createSteps, createDecks, buildTutorialPool };

