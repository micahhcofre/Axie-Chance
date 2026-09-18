// El sonido: el mezclador con una Web Audio de mentira, y las señales sobre una
// partida de verdad.
//
// Las dos mitades se prueban por separado porque fallan distinto. El mezclador falla
// callado —un `onset` mal salteado o un bus que quedó en cero no rompen nada, solo no
// se oyen—, así que se le mira lo que le pide al navegador. Las señales fallan al
// revés: suenan de más, o suenan antes de tiempo, y eso solo se ve haciendo jugar una
// partida entera y anotando en qué orden salió cada cosa.
import assert from 'node:assert/strict';

const idle = () => new Promise((r) => setTimeout(r, 0));

// --- la Web Audio de mentira -------------------------------------------------

/** Un `AudioParam` que se acuerda de todo lo que le programaron. */
class FakeParam {
  constructor(value) {
    this.value = value;
    this.events = [];
  }
  cancelScheduledValues(at) { this.events.push(['cancel', at]); }
  setValueAtTime(v, at) { this.events.push(['set', v, at]); this.value = v; return this; }
  linearRampToValueAtTime(v, at) { this.events.push(['ramp', v, at]); this.value = v; return this; }
}

function fakeContext() {
  const started = [];
  const gains = [];
  const ctx = {
    currentTime: 10,
    state: 'running',
    destination: { name: 'salida' },
    resume() { ctx.state = 'running'; },
    createGain() {
      const node = { gain: new FakeParam(1), connect(to) { node.to = to; return to; } };
      gains.push(node);
      return node;
    },
    createBufferSource() {
      const src = {
        playbackRate: { value: 1 },
        connect(to) { src.to = to; return to; },
        start(when, offset = 0, duration = null) {
          started.push({ src, when, offset, duration, rate: src.playbackRate.value });
        },
        stop(at) { src.stopped = at; },
      };
      return src;
    },
    decodeAudioData: async (raw) => ({ decoded: raw.byteLength, duration: 3 }),
  };
  return { ctx, started, gains };
}

{
  const { ctx, started, gains } = fakeContext();
  const pedidos = [];
  const store = new Map();
  globalThis.AudioContext = function () { return ctx; };
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
  };
  globalThis.fetch = async (url) => {
    pedidos.push(url);
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(64) };
  };

  const { SOUNDS } = await import('../src/audio-clips.js');
  const { createAudio } = await import('../src/audio.js');
  const audio = createAudio();

  // De fábrica: efectos sí, música no. La música son dos minutos de wav.
  assert.equal(audio.sfxOn, true);
  assert.equal(audio.musicOn, false);

  // Antes del primer clic no hay AudioContext, y pedir un sonido no rompe ni baja nada.
  assert.equal(audio.live, false);
  audio.sfx('block');
  await idle();
  assert.deepEqual(pedidos, [], 'sin desbloquear no se baja nada');

  audio.unlock();
  assert.equal(audio.live, true);

  audio.sfx('block');
  await idle();
  await idle();
  assert.equal(pedidos.length, 1, 'se baja el wav una sola vez');
  assert.match(pedidos[0], /shield\.wav$/, 'el huevo que aguanta suena con el escudo del kit');
  assert.equal(started.length, 1);
  assert.equal(started[0].offset, SOUNDS.block.onset, 'se saltea el silencio del arranque');
  assert.equal(started[0].duration, SOUNDS.block.secs, 'y se suelta cuando dejó de oírse');
  assert.equal(started[0].src.to.gain.value, SOUNDS.block.gain * 0.8,
    'el volumen medido, retocado por la mezcla del juego');

  // El mismo sonido otra vez: ya no se vuelve a bajar, pero suena igual.
  audio.sfx('block');
  await idle();
  assert.equal(pedidos.length, 1, 'el wav ya estaba decodificado');
  assert.equal(started.length, 2, 'y se puede pisar consigo mismo');

  // El tic de robar sale más agudo y cortado: no dura los 1.8 s del archivo.
  audio.sfx('draw', { rate: 1.3 });
  await idle();
  const tic = started[2];
  assert.equal(tic.rate, 1.3);
  assert.ok(tic.duration < SOUNDS.draw.secs, 'el tic se corta antes de terminar');
  assert.ok(
    tic.src.to.gain.events.some(([kind, v]) => kind === 'ramp' && v === 0),
    'y se apaga con un fundido, para que el corte no chasquee',
  );

  // Adelantar el golpe: `lead` es lo que tarda en llegar a su punto más fuerte.
  assert.equal(audio.lead('block'), SOUNDS.block.lead * 1000);
  assert.equal(audio.lead('block', 2), (SOUNDS.block.lead * 1000) / 2, 'más agudo, llega antes');
  assert.equal(audio.lead('no-existe'), 0, 'un sonido que no está no atrasa nada');

  // La cadena cortada no sale al tono del archivo: cae, para despegarse de los golpes
  // de clase. `lead` lo tiene en cuenta sin que nadie se lo pida — si no, `playHit`
  // sincronizaría el impacto con un pico que ya no llega cuando llegaba.
  //
  // Y sale entera: es corta de fábrica y lo que cuenta es el final —la nota
  // cayéndose—, así que cortarla sería quedarse con la mitad de arriba.
  audio.sfx('bust');
  for (let i = 0; i < 5; i++) await idle();
  const roto = started[started.length - 1];
  assert.ok(roto.rate < 1, 'la cadena cortada suena más grave que el archivo');
  assert.equal(roto.duration, SOUNDS.bust.secs, 'y suena entera, no cortada');
  assert.ok(SOUNDS.bust.secs < 1, 'que para eso el archivo ya es corto');
  assert.equal(audio.lead('bust'), (SOUNDS.bust.lead * 1000) / roto.rate,
    'y el adelanto se estira con ella');

  // La carta que entra al mazo sí se corta: es un clic, y del archivo se usa la
  // cuarta parte.
  audio.sfx('take');
  for (let i = 0; i < 5; i++) await idle();
  const carta = started[started.length - 1];
  assert.ok(carta.duration < SOUNDS.take.secs / 3,
    'la carta que entra al mazo es un clic, no un efecto');

  // El interruptor calla el bus de efectos y queda guardado para la próxima partida.
  const sfxBus = gains[1];
  assert.equal(sfxBus.gain.value, 0.75);
  audio.setSfx(false);
  assert.equal(sfxBus.gain.value, 0, 'apagado, el bus de efectos queda en silencio');
  assert.match(store.get('axie-chance:audio'), /"sfx":false/);
  const antes = started.length;
  audio.sfx('block');
  await idle();
  assert.equal(started.length, antes, 'apagado no se larga ni una fuente');
  audio.setSfx(true);

  // El toque de los botones se sintetiza: sale en el acto, sin pedir nada al CDN, por
  // el bus de efectos —así lo calla el interruptor— y corto.
  const osciladores = [];
  ctx.createOscillator = () => {
    const osc = {
      frequency: new FakeParam(0),
      connect(to) { osc.to = to; return to; },
      start(at) { osc.start = at; },
      stop(at) { osc.stop = at; },
    };
    osc.frequency.exponentialRampToValueAtTime = osc.frequency.linearRampToValueAtTime;
    osciladores.push(osc);
    return osc;
  };
  FakeParam.prototype.exponentialRampToValueAtTime = FakeParam.prototype.linearRampToValueAtTime;
  const bajadosAntes = pedidos.length;
  audio.press();
  assert.equal(osciladores.length, 2, 'un chasquido y su cuerpo');
  assert.equal(pedidos.length, bajadosAntes, 'no baja ningún archivo');
  assert.ok(osciladores.every((o) => o.to.to === sfxBus), 'va por el bus de efectos');
  assert.ok(osciladores.every((o) => o.stop - ctx.currentTime <= 0.1), 'y dura menos de 100 ms');
  audio.setSfx(false);
  audio.press();
  assert.equal(osciladores.length, 2, 'con los efectos apagados, no suena');
  audio.setSfx(true);

  // La perilla es un multiplicador sobre la mezcla del juego, no un volumen absoluto:
  // al 100% suena como está medido, que es como tiene que sonar.
  assert.equal(audio.sfxVol, 1, 'de fábrica, la perilla arriba de todo');
  audio.setSfxLevel(0.5);
  assert.equal(sfxBus.gain.value, 0.75 * 0.5, 'la perilla multiplica la mezcla');
  assert.match(store.get('axie-chance:audio'), /"sfxVol":0\.5/, 'y queda guardada');

  // Apagar y volver a prender devuelve el volumen que había elegido, no el de fábrica:
  // el interruptor y la perilla contestan dos preguntas distintas.
  audio.setSfx(false);
  assert.equal(sfxBus.gain.value, 0, 'apagado es silencio, sin importar la perilla');
  audio.setSfx(true);
  assert.equal(sfxBus.gain.value, 0.75 * 0.5, 'y al volver, el volumen que había');
  audio.setSfxLevel(1);

  // La de la música mueve su propio bus, que es lo que deja bajarla con el tema ya
  // sonando: las vueltas programadas cuelgan de él.
  const musicBus = gains[2];
  assert.equal(musicBus.gain.value, 0.35);
  audio.setMusicLevel(0.2);
  assert.ok(Math.abs(musicBus.gain.value - 0.35 * 0.2) < 1e-9, 'la música también');
  // Fuera de rango se recorta en vez de reventar el mezclador.
  audio.setMusicLevel(4);
  assert.equal(musicBus.gain.value, 0.35, 'un volumen imposible se recorta al máximo');

  // La música: pedir lo mismo dos veces no la reinicia.
  const bajados = pedidos.length;
  audio.music('battle');
  await idle();
  assert.equal(pedidos.length, bajados, 'la música no se baja hasta que se la prende');
  audio.setMusic(true);
  for (let i = 0; i < 6; i++) await idle();
  const COMBATE = /(pve_1|pve_2|pve_3|pvp)\.wav$/;
  const temas = pedidos.slice(bajados);
  assert.equal(temas.length, 2, 'ahí sí: el tema que suena y el que sigue en la rueda');
  assert.match(temas[0], COMBATE);
  assert.match(temas[1], COMBATE);
  assert.notEqual(temas[0], temas[1], 'la rueda no repite el tema que acaba de sonar');
  const vueltas = started.length;
  audio.music('battle');
  await idle();
  assert.equal(started.length, vueltas, 'el tema que ya está sonando no se reinicia');

  // Y el final la apaga: el remate suena solo.
  audio.music(null);
  const tema = started[started.length - 1];
  assert.ok(tema.src.stopped > ctx.currentTime, 'el tema se corta con fundido, no de golpe');

  // La portada tiene su propia rueda.
  audio.music('menu');
  for (let i = 0; i < 6; i++) await idle();
  assert.match(pedidos[pedidos.length - 2], /(home|summer23)\.wav$/, 'la portada suena a portada');

  // La partida siguiente arranca con el tema que había quedado listo, no con el mismo.
  // Ese ya estaba bajado: lo único que se pide es el que va después.
  const sonando = started.length;
  const pedidosAntes = pedidos.length;
  audio.music('battle');
  for (let i = 0; i < 6; i++) await idle();
  assert.equal(started.length, sonando + 1, 'un solo tema a la vez');
  const nuevos = pedidos.slice(pedidosAntes);
  assert.equal(nuevos.length, 1, 'se pide solo el que sigue');
  assert.ok(!nuevos.includes(temas[1]), 'vuelve con el que seguía, que ya estaba bajado');
  audio.music(null);

  delete globalThis.AudioContext;
  delete globalThis.localStorage;
  console.log('✓ mezclador ok');
}

// --- las señales de la partida -----------------------------------------------

const { createGame, TARGET, hpOf } = await import('../src/game.js');
const { emptyChain, playCard } = await import('../src/rules.js');
const { createCues } = await import('../src/audio-cues.js');

let uid = 90_000;
const card = (symbols, power = null) => ({ uid: uid++, symbols, power, key: `t${uid}` });
const chainOf = (...cards) => cards.reduce(playCard, emptyChain());

/**
 * Un mezclador que anota en vez de sonar. `music` ignora lo que ya está puesto, igual
 * que el de verdad: si no, cada repintado contaría como un cambio de tema.
 */
function fakeAudio() {
  const heard = [];
  let track;
  return {
    heard,
    sfx: (key, opts = {}) => heard.push({ key, delay: 0, rate: 1, ...opts }),
    music(next) {
      if (next === track) return;
      track = next;
      heard.push({ music: next });
    },
    lead: () => 0,
  };
}

/** Una partida escuchada, detenida en el turno del jugador. */
async function listening(seed = 3) {
  const audio = fakeAudio();
  const game = createGame({ pace: 0, seed });
  const cues = createCues(audio);
  game.subscribe((state) => cues.watch(state));
  game.newMatch({ difficulty: 'normal', axie: 'aquatic' });
  await idle();
  assert.equal(game.state.turn, 'p1');
  return { game, audio, cues, heard: audio.heard };
}

// Arrancar una partida no suena hacia atrás: la foto inicial no dispara nada y lo
// único que se oye es la música entrando y la carta con la que abre la ronda.
{
  const { heard } = await listening();
  assert.deepEqual(heard, [
    { music: 'battle' },
    { key: 'draw', delay: 0, rate: 1 },
  ]);
}

// Cada carta de la cadena suena un poco más aguda que la anterior.
{
  const { game, heard } = await listening();
  // Un mazo que no puede cortar la cadena: así las dos cartas salen sí o sí.
  game.state.chains.p1 = chainOf(card(['aquatic', 'bird']));
  game.state.decks.p1 = [card(['aquatic', 'plant']), card(['aquatic', 'beast'])];
  heard.length = 0;

  await game.hit();
  await game.hit();
  const tics = heard.filter((h) => h.key === 'draw');
  assert.equal(tics.length, 2, 'una por carta');
  assert.ok(tics[0].rate > 1 && tics[1].rate > tics[0].rate, 'y cada una más arriba');
}

// La carta que rompe la cadena suena en el momento en que cae, no con la animación
// de desarme: es lo contrario del tic que venía subiendo, y llega sin esperar nada.
{
  const { game, heard } = await listening();
  game.state.chains.p1 = chainOf(card(['aquatic', 'bird']));
  game.state.decks.p1 = [card(['plant', 'beast'])]; // no comparte nada: corta seguro
  game.refresh();
  heard.length = 0;

  await game.hit();
  assert.ok(game.state.chains.p1.busted, 'la cadena se cortó');
  const golpes = heard.filter((h) => h.key);
  assert.equal(golpes[0].key, 'bust', 'lo primero que se oye es el corte');
  assert.equal(golpes[0].delay, 0, 'y sin esperar al efecto');
  assert.equal(heard.filter((h) => h.key === 'draw').length, 0,
    'la carta que corta no suena a carta más');
  assert.equal(heard.filter((h) => h.key === 'bust').length, 1, 'y suena una sola vez');
}

// El ataque: los poderes no suenan desde acá. Cada uno tiene su animación y suena con
// ella, cuando su amuleto llega (ver `power-fx.js`): sonando también acá se oirían dos
// veces, y la primera antes de verse.
{
  const { game, heard } = await listening();
  game.state.chains.p1 = chainOf(
    card(['aquatic', 'bird']),
    card(['aquatic', 'plant'], 'octopus'),
    card(['aquatic', 'reptile'], 'snail'),
    card(['aquatic', 'beast'], 'egg'),
    card(['aquatic', 'bug'], 'poison'),
  );
  // La cadena se puso a mano, sin pasar por el mazo: se repinta para que la foto de
  // referencia sea esta y no la de antes de armarla.
  game.refresh();
  heard.length = 0;
  await game.stand();

  const poderes = ['strength', 'brutal', 'octopus', 'bubble', 'egg', 'pot', 'leaf', 'snail', 'leech', 'poison'];
  assert.equal(heard.filter((h) => poderes.includes(h.key)).length, 0,
    'los poderes suenan con su animación, no desde acá');
  // El golpe en sí no sale de acá: lo larga `playHit`, que sabe cuándo conecta.
  assert.equal(heard.filter((h) => h.key === 'aquatic').length, 0);

  // Cerrado el turno se abre el centro. Las cartas de la cadena vuelven al mazo justo
  // ahí: eso no es haber agarrado nada y no tiene que sonar.
  await idle();
  assert.ok(heard.some((h) => h.key === 'open'), 'el centro que se abre suena');
  assert.equal(heard.filter((h) => h.key === 'take').length, 0,
    'la cadena que vuelve al mazo no suena a carta nueva');
  const antes = heard.length;
  await game.takeCard(game.pickable()[0].uid);
  assert.ok(heard.slice(antes).some((h) => h.key === 'take'), 'la carta que entra al mazo, también');
}

// La vida corta cambia el tema, y el final lo apaga.
{
  const { game, audio, heard } = await listening();
  // Al jugador le queda el 20% de la vida, y su golpe deja sin vida a la CPU: con la
  // partida resuelta no hay reparto, la CPU devuelve el golpe y ahí cierra.
  game.state.totals.p2 = TARGET * 0.8;
  game.state.totals.p1 = TARGET - 1;
  game.state.chains.p1 = chainOf(card(['aquatic', 'bird']));
  await game.stand();
  assert.ok(heard.some((h) => h.music === 'boss'), 'con alguien en las últimas cambia el tema');

  for (let i = 0; i < 400 && game.state.phase !== 'matchEnd'; i++) await idle();
  assert.equal(game.state.phase, 'matchEnd', 'la partida se cerró');
  assert.equal(heard[heard.length - 1].music, null, 'la música se apaga para el remate');
  // Después del remate la pantalla del final pone la del menú (ver `RESULT_MUSIC`), y
  // un repintado de la mesa terminada no la vuelve a cortar.
  audio.music('menu');
  game.refresh();
  await idle();
  assert.equal(heard[heard.length - 1].music, 'menu', 'repintar el final no apaga la música del menú');
  // El remate lo larga la pantalla del final, con su efecto (ver `test/result.test.js`).
  assert.equal(heard.filter((h) => ['win', 'lose', 'tie'].includes(h.key)).length, 0,
    'el resultado no suena desde las señales');
}

// La escalera de tonos es una sola, y la fusión del Rocket Stamp habla en ella.
//
// El Rocket no suma una carta a la cadena —`stackOnCard` reemplaza una, no agrega—, así
// que no dispara el tic que va contando cómo crece: si su impacto no dijera nada, la
// cadena daría su salto más grande en silencio. Suena en la misma escalera para que sea
// el mismo idioma y no dos que hay que aprender por separado (ver `fallOnto` en `ui.js`).
{
  const { chainRate } = await import('../src/audio-cues.js');
  const { stackOnCard } = await import('../src/rules.js');

  assert.equal(chainRate(1), 1, 'una sola carta suena al tono del archivo');
  assert.ok(chainRate(5) > chainRate(2), 'y cuanto más larga, más agudo');
  assert.equal(chainRate(0), 1, 'una cadena vacía no baja de tono');
  assert.equal(chainRate(999), chainRate(1000), 'la escalera tiene techo');

  // Una cadena de dos cartas que comparten `aquatic`: la racha vale 2.
  const chain = chainOf(card(['aquatic', 'bird']), card(['aquatic', 'plant']));
  const topRun = (c) => c.runs.reduce((n, r) => Math.max(n, r.length), 0);
  assert.equal(topRun(chain), 2);

  // El Rocket cae sobre la primera columna con dos `aquatic` encima: la racha salta a 4
  // sin que la cadena sume una sola carta.
  const fused = stackOnCard(chain, 0, card(['aquatic', 'aquatic']));
  assert.equal(fused.cards.length, chain.cards.length,
    'fusionar no agrega cartas: por eso no hay tic que lo cuente');
  assert.equal(topRun(fused), 4, 'pero la racha creció');
  assert.ok(chainRate(topRun(fused)) > chainRate(topRun(chain)),
    'y el impacto lo dice subiendo, que es lo único que lo dice');
}

console.log('✓ señales ok');
