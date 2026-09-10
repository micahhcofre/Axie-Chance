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
  await idle();
  await idle();
  assert.equal(pedidos.length, bajados + 1, 'ahí sí');
  assert.match(pedidos[pedidos.length - 1], /pve_1\.wav$/);
  const vueltas = started.length;
  audio.music('battle');
  await idle();
  assert.equal(started.length, vueltas, 'el tema que ya está sonando no se reinicia');

  // Y el final la apaga: el remate suena solo.
  audio.music(null);
  const tema = started[started.length - 1];
  assert.ok(tema.src.stopped > ctx.currentTime, 'el tema se corta con fundido, no de golpe');

  delete globalThis.AudioContext;
  delete globalThis.localStorage;
  console.log('✓ mezclador ok');
}

// --- las señales de la partida -----------------------------------------------

const { createGame, TARGET, hpOf } = await import('../src/game.js');
const { emptyChain, playCard } = await import('../src/rules.js');
const { hitDelay } = await import('../src/vfx.js');
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

// El ataque: los poderes esperan a que el golpe llegue, y salen de a uno.
{
  const { game, heard } = await listening();
  game.state.chains.p1 = chainOf(
    card(['aquatic', 'bird']),
    card(['aquatic', 'plant'], 'strength'),
    card(['aquatic', 'reptile'], 'poison'),
  );
  // La cadena se puso a mano, sin pasar por el mazo: se repinta para que la foto de
  // referencia sea esta y no la de antes de armarla.
  game.refresh();
  heard.length = 0;
  await game.stand();

  const impacto = hitDelay('aquatic');
  const fuerza = heard.find((h) => h.key === 'strength');
  const veneno = heard.find((h) => h.key === 'poison');
  assert.ok(fuerza && veneno, 'los dos poderes suenan');
  assert.ok(fuerza.delay >= impacto, 'ninguno se adelanta al golpe');
  assert.ok(veneno.delay > fuerza.delay, 'y salen de a uno, no todos juntos');
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
  const { game, heard } = await listening();
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
  const remate = heard.find((h) => h.key === 'win' || h.key === 'lose');
  assert.ok(remate, 'y suena el resultado');
  assert.equal(remate.key, hpOf(game.state, 'p1') > 0 ? 'win' : 'lose');
  assert.ok(remate.delay > 0, 'después del último golpe, no encima');
}

console.log('✓ señales ok');
