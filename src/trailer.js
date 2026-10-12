// El tráiler: setenta segundos de Axie Chance contados por lo que tiene de
// gracioso de verdad, que no son los poderes sino lo que le pasa al que los usa.
//
// El chiste del juego es uno y es viejo como los dados: **una más**. La cadena paga al
// cuadrado, así que siempre conviene robar una carta más, hasta que no. El tráiler no lo
// explica: lo actúa, y lo actúa desde adentro de la cabeza del que está por hacerlo mal.
//
// Los cuatro actos que hacen el humor:
//   la combinación  las vigas que unen los símbolos iguales carta a carta, y la cuenta
//                   `4² + 2² = 20` armándose abajo del número. Es la regla escrita, y es
//                   lo que hace que la tentación después se entienda sola.
//   la tentación    el Axie **pensando** "¿una más?" arriba de la cabeza mientras la
//                   rueda de chances se pone roja, el cartel de racha crece y el otro
//                   piensa "...". Termina con el 49 hecho 0 y un trombón.
//   el arsenal      las trece armas leídas de corrido: un huevo, una lata de
//                   energizante, una maceta, un arito de plumas, un caracol.
//   el caracol      el mejor golpe de la partida esperando a que un caracol cruce la
//                   pantalla para partirlo al medio.
//
// No se dibuja nada nuevo y no se inventa ninguna cuenta. Las cartas, los símbolos, los
// Axies, sus reacciones y los golpes son los del juego —`axieArt()`, `createMotion()`,
// `.board-axie[data-act]`, `createVfx()`—, y **las cadenas son cadenas de verdad**:
// `playCard()` y `scoreChain()` de `rules.js` son las que dicen qué se prende y cuánto
// vale. Un tráiler que dibujara sus propios números estaría mintiendo sobre el juego.
//
// El reloj es `await`: cada acto es una función que espera. Rebobinar no existe —un
// tráiler se ve de punta a punta—, así que "Repetir" tira todo y vuelve a armarlo.
import { tr, translateDom, currentLang } from './i18n.js';
import { SYMBOLS, POWERS, crest, powerIcon, iconUrl, makeCard } from './data.js';
import { emptyChain, playCard, scoreChain, isScoringCell } from './rules.js';
import { axieArt } from './axies.js';
import { createMotion } from './axie-motion.js';
import { createVfx, preloadVfx } from './vfx.js';
import { createAudio } from './audio.js';

const $ = (id) => document.getElementById(id);

/** Menos movimiento: el tráiler cuenta lo mismo, pero nada viaja. */
const quiet = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

// ---- el reloj ----------------------------------------------------------------

/**
 * El error con el que se corta una toma a mitad de camino. No es una falla: es la
 * manera de salir de veinte `await` anidados cuando alguien aprieta "Repetir".
 */
const CUT = Symbol('corte');

/**
 * Un reloj que se puede cortar. `wait()` es lo único que el guion usa para medir el
 * tiempo, así que cortar el reloj alcanza para cortar el tráiler entero, sin importar en
 * qué toma estaba.
 */
function createClock() {
  let dead = false;
  const timers = new Set();
  return {
    get dead() { return dead; },
    wait(ms) {
      return new Promise((ok, fail) => {
        if (dead) return fail(CUT);
        const t = setTimeout(() => { timers.delete(t); dead ? fail(CUT) : ok(); }, ms);
        timers.add(t);
      });
    },
    kill() {
      dead = true;
      for (const t of timers) clearTimeout(t);
      timers.clear();
    },
  };
}

// ---- la música del tráiler --------------------------------------------------

/**
 * Lo que el juego no tiene: una música que cuente **este** minuto.
 *
 * El juego trae los temas del kit (ver `PLAYLISTS` en `audio.js`) y son buenos, pero son
 * canciones: entran, suenan y salen. Un tráiler necesita otra cosa —que el sonido suba
 * cuando sube la apuesta y se calle de golpe cuando hay que callarse—, y eso no se puede
 * pedir sortéandole un tema a una rueda.
 *
 * Así que el arco se reparte. Los temas del kit son la cama de los actos tranquilos; acá
 * adentro está lo que la cama no puede hacer:
 *
 *   `pulse(bpm)`  el latido. Entra en el acto de la tentación **con la cama apagada** y
 *                 acelera con cada carta, que es el acto entero contado sin una palabra.
 *   `riser(dur)`  el tono que sube antes del corte: avisa que algo va a pasar.
 *   `hush()`      el silencio. Es el efecto más fuerte que tiene un tráiler y es gratis.
 *   `fail()`      el trombón.
 *   `chord()`     el acorde que cierra sobre el título.
 *
 * Todo sintetizado: son osciladores, no hay nada que bajar, y respeta la misma perilla
 * que el resto del sonido. Los nodos se sueltan solos al terminar (`onended`): el pulso
 * larga uno por tiempo y un tráiler se repite muchas veces.
 */
function createScore(wants) {
  const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  let ctx = null;
  let bus = null;
  let beating = false;
  let bpm = 84;
  let nextBeat = 0;
  let timer = 0;

  function ready() {
    if (!Ctx || !wants()) return null;
    if (!ctx) {
      ctx = new Ctx();
      bus = ctx.createGain();
      // Por debajo de los temas del kit: esto acompaña, no compite.
      bus.gain.value = 0.5;
      bus.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume?.();
    return ctx;
  }

  /** Suelta los nodos de una voz cuando su oscilador termina. */
  function free(osc, ...nodes) {
    osc.onended = () => { osc.disconnect(); for (const n of nodes) n.disconnect(); };
  }

  /** Una nota de metal: diente de sierra abierto por un filtro que se cierra al apagarse. */
  function brass(at, from, to, dur, gain) {
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const vol = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(from, at);
    // El doblez va exponencial y no lineal: la afinación se oye en octavas, no en hercios.
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + dur * 0.9);
    lp.type = 'lowpass';
    lp.Q.value = 7;
    lp.frequency.setValueAtTime(from * 6, at);
    lp.frequency.exponentialRampToValueAtTime(Math.max(180, from * 1.6), at + dur);
    // El ataque de un metal no es instantáneo: hay un empujón de aire antes del tono.
    vol.gain.setValueAtTime(0.0001, at);
    vol.gain.linearRampToValueAtTime(gain, at + 0.055);
    vol.gain.setValueAtTime(gain, at + dur * 0.72);
    vol.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(lp); lp.connect(vol); vol.connect(bus);
    free(osc, lp, vol);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  /** El golpe del latido: un seno que cae de 150 a 45 en un suspiro. */
  function kick(at) {
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, at);
    osc.frequency.exponentialRampToValueAtTime(45, at + 0.12);
    vol.gain.setValueAtTime(0.0001, at);
    vol.gain.linearRampToValueAtTime(0.3, at + 0.006);
    vol.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
    osc.connect(vol); vol.connect(bus);
    free(osc, vol);
    osc.start(at);
    osc.stop(at + 0.32);
  }

  /**
   * El reloj del latido, con vista adelante: programa los golpes que entran en los
   * próximos 200 ms y se vuelve a llamar. Programarlos de a uno en el momento exacto
   * los dejaría a merced del hilo principal, y un latido que cojea no es un latido.
   */
  function run() {
    if (!beating || !ctx) return;
    while (nextBeat < ctx.currentTime + 0.2) {
      if (nextBeat < ctx.currentTime) nextBeat = ctx.currentTime + 0.02;
      kick(nextBeat);
      nextBeat += 60 / bpm;
    }
    timer = setTimeout(run, 60);
  }

  return {
    /** Arranca el latido, o le cambia el tempo sin cortarlo. */
    pulse(next) {
      if (!ready()) return;
      bpm = next;
      if (beating) return;
      beating = true;
      nextBeat = ctx.currentTime + 0.05;
      run();
    },
    /** El silencio. Lo más fuerte que tiene un tráiler. */
    hush() {
      beating = false;
      clearTimeout(timer);
    },
    /** El tono que sube: avisa que algo va a pasar. */
    riser(dur = 2.2) {
      if (!ready()) return;
      const at = ctx.currentTime;
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const vol = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(70, at);
      osc.frequency.exponentialRampToValueAtTime(700, at + dur);
      lp.type = 'lowpass';
      lp.Q.value = 9;
      lp.frequency.setValueAtTime(260, at);
      lp.frequency.exponentialRampToValueAtTime(2600, at + dur);
      vol.gain.setValueAtTime(0.0001, at);
      vol.gain.exponentialRampToValueAtTime(0.13, at + dur * 0.92);
      vol.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      osc.connect(lp); lp.connect(vol); vol.connect(bus);
      free(osc, lp, vol);
      osc.start(at);
      osc.stop(at + dur + 0.05);
    },
    /** Wah — wah — wah — waaaah. */
    fail() {
      if (!ready()) return;
      const t = ctx.currentTime + 0.02;
      // Tres notas cortas bajando de a un semitono y la cuarta larga, doblándose ocho
      // semitonos para abajo: el "waaah" es el doblez, no la nota. Ocho y no siete —que
      // sería la quinta— porque el chiste es que se pase de caída.
      brass(t + 0.00, 233.08, 233.08, 0.20, 0.17);
      brass(t + 0.24, 220.00, 220.00, 0.20, 0.17);
      brass(t + 0.48, 207.65, 207.65, 0.20, 0.17);
      brass(t + 0.74, 196.00, 123.47, 0.95, 0.20);
    },
    /** El acorde que cierra: una tríada mayor que se abre despacio sobre el título. */
    chord() {
      if (!ready()) return;
      const at = ctx.currentTime + 0.05;
      for (const [i, f] of [130.81, 164.81, 196.0, 261.63].entries()) {
        const osc = ctx.createOscillator();
        const vol = ctx.createGain();
        osc.type = i === 3 ? 'triangle' : 'sine';
        osc.frequency.value = f;
        vol.gain.setValueAtTime(0.0001, at);
        vol.gain.linearRampToValueAtTime(0.09, at + 0.5 + i * 0.12);
        vol.gain.exponentialRampToValueAtTime(0.0001, at + 3.6);
        osc.connect(vol); vol.connect(bus);
        free(osc, vol);
        osc.start(at);
        osc.stop(at + 3.7);
      }
    },
    stop() {
      this.hush();
      ctx?.close?.();
      ctx = null; bus = null;
    },
  };
}

// ---- el narrador -------------------------------------------------------------

/**
 * La voz que cuenta la historia.
 *
 * El tráiler estaba escrito en la pantalla: la cuenta de la cadena, el cartel de la
 * racha, el nombre y el chiste de cada una de las trece armas. Cuarenta cosas para leer
 * en un minuto, o sea ninguna. Todo eso lo dice ahora una voz, que es de donde no
 * tendría que haber salido nunca: un tráiler se mira.
 *
 * Se usa el sintetizador del navegador (`speechSynthesis`) y no un archivo grabado: el
 * proyecto no tiene dependencias y no iba a sumar un MP3 por idioma. A cambio, la voz y
 * su velocidad las pone el sistema, así que **no se puede sincronizar con el cuadro**:
 * se larga y se sigue. Lo que manda el reloj es la imagen; la voz acompaña. Por eso cada
 * línea se dice sobre la toma que le corresponde y no al revés, y por eso abajo va
 * siempre el subtítulo: si no hay voz —o está apagada— la historia se sigue entendiendo.
 */
function createNarrator(wants) {
  const synth = globalThis.speechSynthesis;
  if (!synth?.speak) return { say() {}, stop() {} };
  let voice = null;

  /** La voz del idioma que está puesto. La primera que coincida sirve. */
  function pick() {
    const lang = currentLang() === 'en' ? 'en' : 'es';
    const all = synth.getVoices?.() ?? [];
    voice = all.find((v) => v.lang?.toLowerCase().startsWith(lang)) ?? null;
  }
  pick();
  // En Chrome la lista llega después: si no está todavía, se vuelve a pedir cuando avisa.
  synth.addEventListener?.('voiceschanged', pick);

  return {
    say(text) {
      if (!wants() || !text) return;
      try {
        // Una línea a la vez. Dos voces encimadas no son un narrador, son un quilombo.
        synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        if (voice) u.voice = voice;
        u.lang = voice?.lang ?? (currentLang() === 'en' ? 'en-US' : 'es-AR');
        // Un poco más lento y un poco más grave que la voz por defecto: es la diferencia
        // entre alguien leyendo un cartel y alguien contando algo.
        u.rate = 0.95;
        u.pitch = 0.8;
        synth.speak(u);
      } catch {
        // Un navegador a medias con voces: queda el subtítulo, que es lo que importa.
      }
    },
    stop() { try { synth.cancel(); } catch { /* ya no hay nada que cortar */ } },
  };
}

// ---- las chispas ---------------------------------------------------------------

/**
 * La capa de partículas propia: chispas, polvo y papelitos. El kit del Origins trae los
 * golpes (ver `vfx.js`) pero no trae esto, y es lo que le falta a un impacto para que se
 * sienta que algo se rompió.
 *
 * Es una bolsa fija de partículas que se reusa —no se crea ni una sola en todo el
 * tráiler después del arranque— y un `requestAnimationFrame` que se apaga cuando no
 * queda ninguna viva. El tope es duro: pedir más de las que hay no agranda la bolsa, se
 * reusan las más viejas. Un tráiler no puede ponerse a tironear justo en el golpe.
 */
function createBits(canvas, cap = 180) {
  const ctx = canvas?.getContext?.('2d');
  if (!ctx || quiet()) return { burst() {}, clear() {} };

  const bag = Array.from({ length: cap }, () => ({ life: 0 }));
  let next = 0;
  let raf = 0;
  let last = 0;

  const take = () => {
    // La primera muerta que aparezca; si están todas vivas, la más vieja.
    for (let i = 0; i < cap; i++) {
      const p = bag[(next + i) % cap];
      if (p.life <= 0) { next = (next + i + 1) % cap; return p; }
    }
    const p = bag[next];
    next = (next + 1) % cap;
    return p;
  };

  function fit() {
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1); // techo de 2: arriba no se ve
    const { width, height } = canvas.getBoundingClientRect();
    const [w, h] = [Math.round(width * dpr), Math.round(height * dpr)];
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height };
  }

  function frame(now) {
    const dt = Math.min(48, now - (last || now)) / 1000;
    last = now;
    const { width, height } = fit();
    ctx.clearRect(0, 0, width, height);

    let alive = 0;
    for (const p of bag) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) continue;
      alive++;
      p.vy += p.g * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.spin += p.dspin * dt;
      const k = p.life / p.max;

      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 1.6);
      ctx.translate(p.x, p.y);
      if (p.kind === 'spark') {
        // Una chispa es una raya en la dirección en que va, no un punto: es lo que la
        // hace leerse rápido aunque dure 300 ms.
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * k;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-p.vx * 0.022, -p.vy * 0.022);
        ctx.stroke();
      } else if (p.kind === 'dust') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (1.6 - k), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.rotate(p.spin);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      }
      ctx.restore();
    }

    if (alive) {
      raf = requestAnimationFrame(frame);
    } else {
      raf = 0; last = 0;
      ctx.clearRect(0, 0, width, height);
    }
  }

  return {
    /**
     * Larga `n` partículas desde un elemento (o desde un punto del cuadro).
     * `kind` decide cómo se dibujan y cómo caen: la chispa sale disparada y se apaga, el
     * polvo se queda flotando y el papelito gira mientras cae.
     */
    burst(target, {
      n = 10, kind = 'spark', color = '#ffd98a', speed = 320, spread = Math.PI * 2,
      dir = -Math.PI / 2, gravity = 900, life = 0.5, size = 3, from = 'center',
    } = {}) {
      const field = canvas.getBoundingClientRect();
      if (!field.width) return;
      let ox = field.width / 2;
      let oy = field.height / 2;
      if (target?.getBoundingClientRect) {
        const b = target.getBoundingClientRect();
        if (!b.width && !b.height) return;
        ox = b.left + b.width / 2 - field.left;
        oy = (from === 'top' ? b.top : from === 'bottom' ? b.bottom : b.top + b.height / 2) - field.top;
      } else if (target && typeof target.x === 'number') {
        ox = target.x; oy = target.y;
      }
      for (let i = 0; i < n; i++) {
        const p = take();
        const a = dir + (Math.random() - 0.5) * spread;
        const v = speed * (0.45 + Math.random() * 0.75);
        p.x = ox + (Math.random() - 0.5) * 8;
        p.y = oy + (Math.random() - 0.5) * 8;
        p.vx = Math.cos(a) * v;
        p.vy = Math.sin(a) * v;
        p.g = gravity;
        p.drag = kind === 'dust' ? 0.92 : 0.985;
        p.max = life * (0.7 + Math.random() * 0.6);
        p.life = p.max;
        p.size = size * (0.7 + Math.random() * 0.8);
        p.spin = Math.random() * Math.PI;
        p.dspin = (Math.random() - 0.5) * 12;
        p.kind = kind;
        p.color = Array.isArray(color) ? color[(Math.random() * color.length) | 0] : color;
      }
      if (!raf) raf = requestAnimationFrame(frame);
    },
    /** Apaga todo. Se puede llamar dos veces seguidas sin que pase nada. */
    clear() {
      for (const p of bag) p.life = 0;
      if (raf) cancelAnimationFrame(raf);
      raf = 0; last = 0;
      const { width, height } = fit();
      ctx.clearRect(0, 0, width, height);
    },
  };
}

/**
 * Enciende un atributo y lo apaga cuando la animación del CSS terminó. Es lo que hace
 * que un mismo gesto —el sacudón, el fogonazo, el golpe de la chapa— se pueda pedir dos
 * veces seguidas: si el atributo se quedara puesto, la segunda vez no animaría nada.
 *
 * Comprueba antes de borrar porque entre medio puede haber llegado otro gesto, y el que
 * manda es el último.
 */
function flag(node, attr, value, ms) {
  if (!node) return;
  node.dataset[attr] = value;
  setTimeout(() => { if (node.dataset[attr] === value) delete node.dataset[attr]; }, ms);
}

// ---- el guion ----------------------------------------------------------------

/**
 * Las trece armas, en el orden en que da más risa **escucharlas**: primero las tres que
 * suenan a arma de verdad —un amuleto, un veneno, una daga—, para que la lista arranque
 * en serio, y de ahí en picada hasta el caracol.
 *
 * El chiste está en la enumeración, no en cada renglón, y por eso el narrador la lee de
 * corrido como una sola frase mientras los amuletos pasan. Antes cada arma traía su
 * nombre y su chiste escritos en pantalla: treinta y nueve renglones en nueve segundos,
 * que es la manera más segura de que no se lea ninguno.
 */
const ARSENAL = ['strength', 'poison', 'leech', 'egg', 'steelskin', 'brutal', 'bubble',
  'octopus', 'pot', 'leaf', 'feather', 'freegame', 'snail'];

/**
 * La lista, dicha. Es un solo renglón porque es una sola respiración — y va en un solo
 * literal, sin partirlo en tres, porque la clave de traducción es el texto entero: una
 * frase armada con `+` no se puede sacar del código para traducirla (lo cuida
 * `test/i18n.test.js`).
 */
const ARSENAL_LINE = tr('Un amuleto. Un veneno. Una daga. Un huevo. Una máscara de gecko. Una lata de energizante. Jabón. Un pulpo. Una maceta. Una hoja. Un arito de plumas. Una calcomanía de cohete. Y un caracol perezoso.');

/**
 * Las cartas con las que el jugador se entusiasma. Las seis comparten `plant`, así que la
 * racha crece de a una y el número va 1, 4, 9, 16, 25, 36: la curva al cuadrado hace sola
 * el trabajo de convencerlo. Los segundos símbolos están puestos para que se vean rachas
 * cortas naciendo y muriendo al lado de la larga —que es de lo que se trata combinar— y
 * la séptima es la única que no comparte nada vivo.
 */
const GREED = [['plant', 'beast'], ['plant', 'bird'], ['plant'], ['plant', 'reptile'],
  ['plant', 'aquatic'], ['plant', 'bug']];
const DOOM = ['bird', 'reptile'];

export function createTrailer() {
  const el = {
    frame: $('tr-frame'), world: $('tr-world'), sky: $('tr-sky'), dust: $('tr-dust'),
    ring: $('tr-ring'), hero: $('tr-hero'), foe: $('tr-foe'),
    seatHero: $('tr-seat-hero'), seatFoe: $('tr-seat-foe'),
    thinkHero: $('tr-think-hero'), thinkFoe: $('tr-think-foe'),
    plates: $('tr-plates'), plateHero: $('tr-plate-hero'), plateFoe: $('tr-plate-foe'),
    table: $('tr-table'), board: $('tr-board'), chain: $('tr-chain'), links: $('tr-links'),
    gauge: $('tr-gauge'), swing: $('tr-swing'), swingNum: $('tr-swing-num'),
    snail: $('tr-snail'), vfx: $('tr-vfx'), bits: $('tr-bits'),
    speed: $('tr-speed'), danger: $('tr-danger'), reel: $('tr-reel'), end: $('tr-end'),
    says: $('tr-says'), flash: $('tr-flash'), bars: $('tr-bars'),
    start: $('tr-start'), hud: $('tr-hud'), track: $('tr-track-fill'),
  };
  if (!el.frame) return { play() {}, stop() {} };

  const audio = createAudio();
  const score = createScore(() => audio.sfxOn);
  const narrator = createNarrator(() => audio.sfxOn);
  const fx = createVfx(el.vfx);
  const bits = createBits(el.bits);
  // Los dos Axies en contrafase, como en la mesa: así no respiran al mismo tiempo.
  const motion = { hero: createMotion(el.hero, 0), foe: createMotion(el.foe, 0.5) };
  let clock = createClock();
  let ticker = 0;
  let started = 0;

  const sfx = (key, opts) => audio.sfx(key, opts);

  // ---- la cámara ----

  /** Se acerca con cada carta, se aleja cuando se corta, tiembla cuando pega. */
  function cam({ s = 1, x = 0, y = 0 } = {}) {
    if (quiet()) return;
    el.world.style.setProperty('--cam-s', s);
    el.world.style.setProperty('--cam-x', x);
    el.world.style.setProperty('--cam-y', y);
  }
  const shake = (force = 'soft') => { if (!quiet()) flag(el.world, 'shake', force, force === 'hard' ? 520 : 340); };
  const flash = (color = 'white') => {
    if (quiet()) return;
    delete el.flash.dataset.fire;
    void el.flash.offsetWidth; // reinicia la animación aunque sea el mismo fogonazo
    flag(el.flash, 'fire', color, 560);
  };
  /** Las líneas de velocidad: el recurso más viejo del dibujo animado para decir "pegó". */
  const speedLines = () => { if (!quiet()) flag(el.speed, 'fire', 'true', 440); };

  // ---- los carteles ----

  /**
   * Un renglón en pantalla. `tone` es qué clase de renglón: `sub` es el subtítulo de la
   * voz, `slam` una de las dos placas del tráiler y `banner` el resultado.
   */
  function say(text, tone = 'sub') {
    const node = document.createElement('p');
    node.className = 'tr-say';
    node.dataset.tone = tone;
    node.textContent = text;
    el.says.append(node);
    // La placa y el número del golpe son los dos grandes y los dos en el medio: con una
    // placa en pantalla el número se va a un segundo plano, y vuelve cuando se fue.
    if (tone === 'slam') el.frame.dataset.slam = 'true';
    return node;
  }
  function unsay(node) {
    if (!node) return;
    node.dataset.out = 'true';
    if (node.dataset.tone === 'slam') delete el.frame.dataset.slam;
    setTimeout(() => node.remove(), 300);
  }
  const clearSays = () => { el.says.textContent = ''; delete el.frame.dataset.slam; };

  /**
   * El narrador dice una línea y abajo aparece lo mismo escrito. `voice` sirve para que
   * la voz diga la frase entera y el subtítulo muestre la versión corta: leer va más
   * lento que escuchar, y un subtítulo que no llega a leerse es ruido visual.
   */
  async function narrate(text, ms, { tone = 'sub', voice = text } = {}) {
    narrator.say(voice);
    const node = say(text, tone);
    try { await clock.wait(ms); } finally { unsay(node); }
  }
  /** Un renglón sin voz: el remate escrito, o lo que la voz ya dijo. */
  async function beat(text, tone, ms) {
    const node = say(text, tone);
    try { await clock.wait(ms); } finally { unsay(node); }
  }

  // ---- lo que está pensando ----

  /**
   * La nube de pensamiento. `art` es lo que se está imaginando: una carta, un número, o
   * nada. `itch` la hace latir, que es lo que hace una idea de la que no te podés
   * despegar.
   */
  function think(who, text, { art = '', itch = false } = {}) {
    const node = who === 'hero' ? el.thinkHero : el.thinkFoe;
    node.hidden = false;
    delete node.dataset.out;
    delete node.dataset.pop;
    node.dataset.itch = String(itch);
    node.innerHTML = (art ? `<span class="tr-think-art">${art}</span>` : '')
      + `<span class="tr-think-text">${text}</span>`;
    el.frame.dataset.thinking = 'true';
    return node;
  }
  function unthink(who, how = 'out') {
    const node = who === 'hero' ? el.thinkHero : el.thinkFoe;
    if (node.hidden) return;
    node.dataset[how] = 'true';
    setTimeout(() => {
      node.hidden = true;
      delete node.dataset[how];
      // El número vuelve al frente recién cuando no queda ninguna nube.
      if (el.thinkHero.hidden && el.thinkFoe.hidden) delete el.frame.dataset.thinking;
    }, how === 'pop' ? 440 : 260);
  }

  // ---- la mesa: la cadena de verdad ----

  // La cadena es una cadena del juego y no una imitación: `playCard()` decide si entra o
  // corta, `scoreChain()` pone el número y `isScoringCell()` dice qué símbolo se prende.
  // Lo único que hace el tráiler es elegir qué carta sale.
  let chain = emptyChain();
  const drawn = new Set(); // qué vigas ya se dibujaron, para no reanimarlas

  /** Una carta con el mismo HTML que la mesa (ver `cardHtml` en `ui.js`). */
  function cardFace(card, index, doom = false, lit = null) {
    const syms = card.symbols.map((s) => {
      const on = lit ?? (doom ? false : isScoringCell(chain, index, s));
      return `<span class="sym" data-sym="${s}" data-on="${on}" style="--c:${SYMBOLS[s].color}">${crest(s)}</span>`;
    }).join('');
    const chip = card.power
      ? `<span class="card-power" style="--c:${SYMBOLS[POWERS[card.power].symbol]?.color ?? '#f5c542'}"
          data-powers="${card.power}">${powerIcon(card.power)}</span>`
      : '';
    return `<div class="card"${doom ? ' data-doom="true"' : ''}>${syms}${chip}</div>`;
  }

  /** Repinta qué símbolos están vivos. Cambia con cada carta: una racha muere en silencio. */
  function refreshChips() {
    [...el.chain.children].forEach((node, i) => {
      if (node.dataset.doom) return;
      for (const chip of node.querySelectorAll('.sym')) {
        chip.dataset.on = String(isScoringCell(chain, i, chip.dataset.sym));
      }
    });
  }

  /**
   * Las vigas: el tramo de cada racha entre carta y carta, del color de su símbolo.
   *
   * Es lo que hace visible la combinación. Sin esto, una fila de cartas es una fila de
   * cartas; con esto se ve que hay **dos cadenas a la vez**, que una viene de lejos y
   * otra acaba de nacer, y que la larga es la que va a pagar. Se dibujan de una vez por
   * tramo —`drawn` se acuerda de cuáles ya salieron— así que agregar una carta anima solo
   * el tramo nuevo y no vuelve a abrir toda la mesa.
   */
  function drawLinks() {
    const board = el.board.getBoundingClientRect();
    if (!board.width) return;
    const cards = [...el.chain.children];
    for (const run of chain.runs) {
      const color = SYMBOLS[run.symbol].color;
      for (let i = 0; i < run.cards - 1; i++) {
        const key = `${run.symbol}:${i}`;
        const a = cards[i]?.querySelector(`.sym[data-sym="${run.symbol}"]`);
        const b = cards[i + 1]?.querySelector(`.sym[data-sym="${run.symbol}"]`);
        if (!a || !b) continue;
        let node = el.links.querySelector(`[data-key="${key}"]`);
        if (!node) {
          node = document.createElement('i');
          node.className = 'tr-link';
          node.dataset.key = key;
          node.innerHTML = '<b></b>';
          el.links.append(node);
          drawn.add(key);
          // Un puñado de chispas del color de la racha corriendo por la viga nueva: es
          // el premio de haber enganchado, y dura lo que dura la viga abriéndose.
          bits.burst(b, { n: 5, color, speed: 190, life: 0.34, size: 2.4, gravity: 220 });
        }
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const x1 = ra.left + ra.width / 2 - board.left;
        const y1 = ra.top + ra.height / 2 - board.top;
        const x2 = rb.left + rb.width / 2 - board.left;
        const y2 = rb.top + rb.height / 2 - board.top;
        node.style.cssText = `left:${x1}px;top:${y1}px;width:${Math.hypot(x2 - x1, y2 - y1)}px;`
          + `transform:translateY(-50%) rotate(${(Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI}deg);--c:${color}`;
        node.dataset.dead = String(!run.alive);
      }
    }
  }


  /** Pone una carta en la mesa y repinta todo lo que cambió con ella. */
  function deal(symbols, { power = null, doom = false } = {}) {
    const card = makeCard(symbols, power);
    const next = playCard(chain, card);
    chain = next;
    const index = next.busted ? -1 : chain.cards.length - 1;
    el.chain.insertAdjacentHTML('beforeend', cardFace(card, index, next.busted || doom));
    const node = el.chain.lastElementChild;
    // Sin sonido por carta. Eran diecinueve tics en setenta segundos y tapaban lo único
    // que de verdad tiene que oírse: la voz y el latido. Lo que confirma que la carta
    // entró es la viga que se abre y las chispas que corren por ella.
    flag(el.hero, 'act', 'draw', 440);
    if (!next.busted) {
      refreshChips();
      drawLinks();
      setSwing(scoreChain(chain).total);
      bits.burst(node, { n: 7, from: 'top', color: '#ffe9b0', speed: 260, life: 0.4, size: 2.6 });
    }
    return node;
  }

  // ---- el número del golpe ----

  let swing = 0;
  function setSwing(n, { grow = true } = {}) {
    swing = n;
    el.swing.hidden = false;
    el.swingNum.textContent = String(n);
    if (grow) flag(el.swing, 'grow', 'true', 260);
  }
  /** Cuenta de un número a otro: es lo que hace que subir se sienta como subir. */
  async function rollSwing(to, ms) {
    const from = swing;
    const steps = Math.max(1, Math.min(18, Math.abs(to - from)));
    for (let i = 1; i <= steps; i++) {
      setSwing(Math.round(from + ((to - from) * i) / steps), { grow: false });
      await clock.wait(ms / steps);
    }
    setSwing(to);
  }

  // ---- la vida ----

  const HP = { hero: 100, foe: 100 };
  function setHp(side, hp) {
    const plate = side === 'hero' ? el.plateHero : el.plateFoe;
    HP[side] = hp;
    plate.dataset.low = String(hp <= 25);
    // La barra baja de una y la estela la alcanza después: esa diferencia es lo que se
    // lee como "cuánto te sacaron", sin escribir el número.
    plate.style.setProperty('--ghost', plate.style.getPropertyValue('--hp') || 1);
    plate.style.setProperty('--hp', hp / 100);
    requestAnimationFrame(() => plate.style.setProperty('--ghost', hp / 100));
  }

  // ---- los golpes ----

  /** El ataque completo: el salto, el efecto del kit, las chispas, el sacudón y la vida. */
  async function hit({ from = 'hero', clip = 'plant', hp = null, side = 'left', big = false } = {}) {
    const attacker = from === 'hero' ? el.hero : el.foe;
    const target = from === 'hero' ? el.foe : el.hero;
    motion[from].pulse('attack');
    flag(attacker, 'act', 'attack', 640);
    sfx(clip);
    await clock.wait(190);
    if (big) speedLines();
    fx.play(clip, target.querySelector('.axie') ?? target, { from: side });
    await clock.wait(170);
    // El cuadro de impacto: un fogonazo blanco de un cuadro, que es lo que separa el
    // "viene" del "pegó".
    if (big) flash();
    flag(target, 'react', 'hit', 520);
    motion[from === 'hero' ? 'foe' : 'hero'].pulse('hurt');
    shake(big ? 'hard' : 'soft');
    bits.burst(target, { n: big ? 22 : 12, color: ['#fff3c4', '#ffd98a', '#ff9c6a'],
      speed: big ? 520 : 340, life: 0.55, size: 3.4 });
    bits.burst(target, { n: 8, kind: 'dust', color: 'rgba(210,200,180,.5)',
      speed: 130, life: 0.9, size: 7, gravity: -40 });
    if (hp !== null) setHp(from === 'hero' ? 'foe' : 'hero', hp);
  }

  // ---- limpiar ----

  /** Deja la mesa como estaba. Se puede llamar dos veces seguidas sin que pase nada. */
  function clearTable() {
    chain = emptyChain();
    drawn.clear();
    el.chain.textContent = '';
    el.links.textContent = '';
    delete el.chain.dataset.busted;
    el.swing.hidden = true;
    delete el.swing.dataset.zero;
    delete el.swing.dataset.halved;
    swing = 0;
    bits.clear();
  }

  function reset() {
    clearSays();
    clearTable();
    el.gauge.textContent = '';
    el.gauge.dataset.on = 'false';
    delete el.gauge.dataset.panic;
    el.danger.dataset.on = 'false';
    el.snail.hidden = true;
    delete el.snail.dataset.crawl;
    delete el.snail.dataset.leave;
    el.reel.hidden = true;
    el.reel.textContent = '';
    el.end.hidden = true;
    el.end.textContent = '';
    el.thinkHero.hidden = true;
    el.thinkFoe.hidden = true;
    delete el.frame.dataset.thinking;
    delete el.world.dataset.dim;
    el.seatHero.dataset.on = 'false';
    el.seatFoe.dataset.on = 'false';
    delete el.seatHero.dataset.lastChance;
    delete el.seatFoe.dataset.lastChance;
    el.plates.dataset.on = 'false';
    el.sky.dataset.on = 'false';
    el.dust.dataset.on = 'false';
    cam({ s: 1 });
    setHp('hero', 100);
    setHp('foe', 100);
  }

  /** El aro de chances, con el markup del juego: mismo semáforo, misma vuelta del anillo. */
  function setGauge(pct) {
    const risk = pct >= 70 ? 'low' : pct >= 45 ? 'mid' : 'high';
    // Sin el número: el color del anillo ya dice verde, amarillo o rojo, y eso es la
    // frase entera. El porcentaje obligaba a hacer una cuenta en el medio de un tráiler.
    el.gauge.innerHTML = `<div class="odds-dial" data-risk="${risk}" style="--p:${pct}" aria-hidden="true"></div>`;
    el.gauge.dataset.on = 'true';
    // Abajo del 45% el cuadro entero se pone nervioso: el peligro no se dice, se siente
    // en los bordes.
    el.gauge.dataset.panic = String(pct < 45);
    el.danger.dataset.on = String(pct < 45);
  }

  /** Seis motas de polvo en el aire. Son seis elementos, no un sistema de partículas. */
  function seedDust() {
    if (el.dust.children.length || quiet()) return;
    el.dust.innerHTML = Array.from({ length: 6 }, (_, i) =>
      `<i style="left:${8 + i * 15}%;bottom:${-10 + (i % 3) * 12}%;`
      + `animation-duration:${9 + i * 2.3}s;animation-delay:${-i * 2.7}s"></i>`).join('');
  }

  // =========================================================================
  // ACTO 0 — El prólogo. La voz del tráiler, y un bicho adorable.
  // =========================================================================
  async function act0() {
    el.bars.dataset.on = 'true';
    audio.music('menu');
    await clock.wait(700);
    await narrate(tr('En un mundo de criaturas adorables…'), 2600);

    // El bicho solo, en el medio, festejando: es lo más tierno que tiene el juego, y
    // está acá para que el resto del tráiler lo contradiga.
    el.ring.dataset.solo = 'true';
    el.sky.dataset.arena = 'plant';
    el.sky.dataset.on = 'true';
    seedDust();
    el.dust.dataset.on = 'true';
    el.hero.innerHTML = axieArt('olek');
    motion.hero.mount('olek');
    motion.hero.stance('celebrate');
    el.seatHero.dataset.on = 'true';
    cam({ s: 1.14, y: 3 });
    await clock.wait(1500);

    await narrate(tr('…alguien tiene que tomar malas decisiones.'), 2400);
  }

  // =========================================================================
  // ACTO 1 — La combinación. Cómo funciona, contado y no escrito.
  // =========================================================================
  async function act1() {
    flash();
    delete el.ring.dataset.solo;
    el.foe.innerHTML = axieArt('momo');
    motion.foe.mount('momo');
    motion.hero.stance('idle');
    el.seatFoe.dataset.on = 'true';
    el.plates.dataset.on = 'true';
    cam({ s: 1 });
    await clock.wait(500);

    // Las dos primeras cartas: la segunda engancha con `plant` y ahí nace la primera
    // viga. Es el momento más importante del tráiler, así que va despacio y solo.
    narrator.say(tr('Encadenás símbolos.'));
    let line = say(tr('Encadenás símbolos.'));
    deal(GREED[0]);
    cam({ s: 1.04 });
    await clock.wait(950);
    deal(GREED[1]);
    cam({ s: 1.08 });
    await clock.wait(1250);
    unsay(line);

    narrator.say(tr('Cuanto más larga la cadena, más fuerte el golpe.'));
    line = say(tr('Cuanto más larga, más fuerte el golpe.'));
    deal(GREED[2]);
    cam({ s: 1.12, y: 1 });
    await clock.wait(950);
    deal(GREED[3]);
    cam({ s: 1.16, y: 2 });
    await clock.wait(1300);
    unsay(line);

    motion.hero.stance('ready');
    await clock.wait(300);
    await hit({ from: 'hero', clip: 'plant', hp: 82, side: 'left', big: true });
    cam({ s: 1 });
    await clock.wait(1100);
  }

  // =========================================================================
  // ACTO 2 — La tentación. El acto que es el juego entero.
  //
  // Acá la cama de música se apaga y entra el latido: de ahí en adelante el que cuenta
  // cómo va la cosa es el tempo, que sube con cada carta mientras la rueda se pone roja.
  // =========================================================================
  async function act2() {
    clearTable();
    setGauge(91);
    motion.hero.stance('idle');
    audio.music(null);
    score.pulse(84);
    await clock.wait(700);

    await narrate(tr('Y entonces aparece la pregunta.'), 1500);

    const odds = [91, 74, 58, 41, 27];
    const tempo = [92, 102, 114, 128, 144, 160];
    for (let i = 0; i < 6; i++) {
      deal(GREED[i]);
      cam({ s: 1 + (i + 1) * 0.035, y: (i + 1) * 0.6 });
      score.pulse(tempo[i]);
      if (i >= 1) setGauge(odds[i - 1]);
      await clock.wait(620);

      // Lo que está pensando, que es la otra mitad del chiste: el que se va a cortar la
      // cadena **sabe** que se va a cortar. Es lo único escrito que queda en el acto, y
      // son tres palabras adentro de una nube.
      if (i === 2) {
        think('hero', tr('¿una más?'), { art: cardFace(makeCard(['plant', 'bug']), 0, false, true) });
        await clock.wait(1150);
        unthink('hero');
      }
      if (i === 4) {
        think('hero', tr('¿una más?'), { art: '<span class="tr-think-big">49</span>', itch: true });
        think('foe', tr('...'));
        await clock.wait(1000);
        unthink('foe');
      }
    }
    setGauge(19);
    think('hero', tr('¿una más?'), {
      art: '<span class="tr-think-big">49</span><span class="tr-think-drool">🤤</span>', itch: true,
    });

    // El silencio y la placa. La escena se apaga, el latido para y sube el tono: las tres
    // cosas dicen lo mismo y por eso se hacen juntas.
    el.world.dataset.dim = 'true';
    score.hush();
    score.riser(2.2);
    await beat(tr('¿Una más?'), 'slam', 2100);
    delete el.world.dataset.dim;

    // La carta que corta llega girando y en cámara lenta, y no comparte ni un símbolo.
    deal(DOOM, { doom: true });
    await clock.wait(1250);

    // Corte. Todo se calla de golpe y queda el trombón solo: la regla de la mezcla es que
    // lo importante se oye solo, y acá lo importante es el chiste.
    score.hush();
    sfx('bust');
    score.fail();
    flash('red');
    flag(el.frame, 'glitch', 'true', 470);
    shake('hard');
    el.chain.dataset.busted = 'true';
    el.gauge.dataset.on = 'false';
    delete el.gauge.dataset.panic;
    el.danger.dataset.on = 'false';
    for (const link of el.links.children) link.dataset.dead = 'true';
    cam({ s: 1, y: 2 });
    el.swing.dataset.zero = 'true';
    setSwing(0, { grow: false });
    fx.play('bust', el.chain, { from: 'right', width: 3 });
    bits.burst(el.chain, { n: 26, kind: 'dust', color: 'rgba(150,150,160,.55)',
      speed: 180, life: 1.2, size: 9, gravity: 120 });
    flag(el.hero, 'react', 'whiff', 780);
    motion.hero.pulse('whiff');
    unthink('hero', 'pop');
    motion.foe.stance('celebrate');
    // El trombón dura 1,69 s: la placa entra sobre la cola del último doblez y no encima
    // de las cuatro notas. Un chiste sonoro pisado no es un chiste.
    await clock.wait(1650);

    await beat(tr('Cero.'), 'slam', 1400);
    await narrate(tr('Siete cartas. Cero de daño.'), 2000);
  }

  // =========================================================================
  // ACTO 3 — El arsenal. Trece amuletos pasando y una sola frase leída de corrido.
  // =========================================================================
  async function act3() {
    flash();
    audio.music('battle');
    el.swing.hidden = true;
    el.reel.hidden = false;
    motion.foe.stance('idle');

    await narrate(tr('Por suerte, estás armado.'), 1400);

    // El narrador larga la lista entera de una y los amuletos pasan mientras la dice. No
    // se puede sincronizar cuadro a cuadro —la velocidad de la voz la pone el sistema—
    // pero tampoco hace falta: es una lista leída sobre un montaje, no un doblaje.
    narrator.say(ARSENAL_LINE);
    const held = say(tr('Trece armas letales.'));
    for (const id of ARSENAL) {
      const power = POWERS[id];
      const color = SYMBOLS[power.symbol]?.color ?? '#f5c542';
      el.reel.innerHTML = `<img class="tr-gun-amulet" style="--c:${color}"
        src="${iconUrl(`power-${id}.png`)}" alt="${power.name}">`;
      bits.burst(el.reel.firstElementChild, { n: 9, color, speed: 300, life: 0.45, size: 3 });
      // El caracol, que es el remate, se queda el doble: hay que verlo.
      await clock.wait(id === 'snail' ? 1600 : 820);
    }
    unsay(held);

    await beat(tr('…más o menos.'), 'sub', 1500);
    el.reel.hidden = true;
    el.reel.textContent = '';
  }

  // =========================================================================
  // ACTO 4 — El caracol. El mejor golpe de la partida contra un bicho lento.
  // =========================================================================
  async function act4() {
    flash();
    el.sky.dataset.arena = 'bug';
    clearTable();
    motion.hero.stance('idle');
    motion.foe.stance('idle');
    await clock.wait(450);

    // La cadena perfecta, esta vez sin suspenso: el tráiler ya enseñó a leerla, así que
    // se puede ir rápido y dejar que las vigas hagan el trabajo.
    for (let i = 0; i < 6; i++) {
      deal(GREED[i], { power: i === 5 ? 'brutal' : null });
      cam({ s: 1 + (i + 1) * 0.03 });
      await clock.wait(320);
    }
    await rollSwing(49, 520);
    cam({ s: 1.24, y: 3 });
    await narrate(tr('Tu mejor golpe de la partida.'), 1500);

    // Y ahora el caracol. Cruza la pantalla entera a su ritmo, que es el chiste: el
    // tráiler se queda mirándolo, igual que el jugador.
    el.snail.hidden = false;
    el.snail.dataset.crawl = 'true';
    await clock.wait(2600);

    // Llega, toca el número y el número se desinfla a la mitad. Un solo golpe de sonido:
    // el trombón ya se usó, y un chiste repetido dos veces es un chiste usado una vez.
    sfx('block');
    shake('soft');
    el.swing.dataset.halved = 'true';
    bits.burst(el.swing, { n: 14, kind: 'dust', color: 'rgba(255,190,150,.5)',
      speed: 150, life: 0.9, size: 7, gravity: 260 });
    await rollSwing(25, 440);
    delete el.snail.dataset.crawl;
    el.snail.dataset.leave = 'true';
    await clock.wait(500);

    await narrate(tr('Contra un caracol perezoso.'), 2100);
  }

  // =========================================================================
  // ACTO 5 — La última chance. Los dos en cero, los dos con un golpe más.
  // =========================================================================
  async function act5() {
    flash();
    el.sky.dataset.arena = 'reptile';
    clearTable();
    el.snail.hidden = true;
    delete el.snail.dataset.leave;
    setHp('hero', 0);
    setHp('foe', 0);
    // El fuego de la última chance, el mismo de la mesa: el halo que late vive en el
    // asiento —ahí hay lugar para que caiga debajo del bicho— y `data-fury` es el
    // fogonazo del cuadro en que se prende.
    el.seatHero.dataset.lastChance = 'true';
    el.seatFoe.dataset.lastChance = 'true';
    flag(el.hero, 'fury', 'in', 900);
    flag(el.foe, 'fury', 'in', 900);
    audio.music('boss');
    cam({ s: 1.12 });
    await clock.wait(500);

    await narrate(tr('Los dos en cero. Los dos con un golpe más.'), 2400);

    // Y los dos pegan a la vez. No hay ganador que mostrar, así que no se muestra.
    motion.hero.pulse('attack');
    motion.foe.pulse('attack');
    flag(el.hero, 'act', 'attack', 640);
    flag(el.foe, 'act', 'attack', 640);
    sfx('reptile');
    speedLines();
    await clock.wait(250);
    fx.play('reptile', el.foe.querySelector('.axie') ?? el.foe, { from: 'left' });
    fx.play('bug', el.hero.querySelector('.axie') ?? el.hero, { from: 'right' });
    flash();
    shake('hard');
    bits.burst(el.hero, { n: 18, color: ['#fff3c4', '#ff9c6a'], speed: 460, life: 0.6, size: 3.4 });
    bits.burst(el.foe, { n: 18, color: ['#fff3c4', '#a97cff'], speed: 460, life: 0.6, size: 3.4 });
    await clock.wait(600);

    delete el.seatHero.dataset.lastChance;
    delete el.seatFoe.dataset.lastChance;
    el.hero.dataset.stance = 'ko';
    el.foe.dataset.stance = 'ko';
    motion.hero.stance('ko');
    motion.foe.stance('ko');
    await clock.wait(700);

    await beat(tr('Empate'), 'banner', 1600);
    await narrate(tr('Nadie ganó.'), 1900);
  }

  // =========================================================================
  // ACTO 6 — El título.
  // =========================================================================
  async function act6() {
    flash();
    el.end.hidden = false;
    el.end.innerHTML = `
      <img class="tr-end-logo" src="${iconUrl('logo.png')}" alt="Axie Chance">
      <p class="tr-tagline">${tr('Encadená mientras te animes.')}</p>`;
    audio.music('menu');
    // El acorde en vez de un efecto: es el final, y un final se resuelve, no se golpea.
    score.chord();
    narrator.say(tr('Axie Chance. Encadená mientras te animes.'));
    bits.clear();
    await clock.wait(2600);

    el.end.insertAdjacentHTML('beforeend',
      `<p class="tr-end-note">${tr('Gratis, en el navegador.')}</p>`);
    await clock.wait(1800);
  }

  // ---- el pase ----

  const ACTS = [act0, act1, act2, act3, act4, act5, act6];
  /** Lo que dura el tráiler, para la barrita de abajo. Medido, no estimado. */
  const RUNTIME = 70200;

  async function run() {
    started = performance.now();
    clearInterval(ticker);
    ticker = setInterval(() => {
      el.track.style.width = `${Math.min(100, ((performance.now() - started) / RUNTIME) * 100)}%`;
    }, 200);
    try {
      for (const act of ACTS) await act();
      el.frame.dataset.done = 'true';
    } catch (err) {
      if (err !== CUT) throw err;
    } finally {
      clearInterval(ticker);
    }
  }

  return {
    /** Empieza (o vuelve a empezar) de cero. */
    play() {
      clock.kill();
      clock = createClock();
      // Repetir corta la voz y el latido: si no, el narrador sigue contando el acto
      // anterior encima del nuevo y el pulso queda sonando de la pasada de antes.
      narrator.stop();
      score.hush();
      delete el.frame.dataset.done;
      motion.hero.stop();
      motion.foe.stop();
      el.hero.textContent = '';
      el.foe.textContent = '';
      for (const node of [el.hero, el.foe]) {
        delete node.dataset.stance;
        delete node.dataset.fury;
      }
      reset();
      el.hud.hidden = false;
      audio.unlock();
      // Los efectos de los primeros segundos, pedidos antes de que hagan falta.
      for (const key of ['plant', 'bust', 'reptile', 'bug']) preloadVfx(key);
      return run();
    },
    stop() {
      clock.kill();
      clearInterval(ticker);
      narrator.stop();
      score.hush();
      motion.hero.stop();
      motion.foe.stop();
      bits.clear();
      audio.music(null);
    },
    audio,
  };
}

// ---- arranque ---------------------------------------------------------------

/* El tráiler no empieza solo: un navegador no larga sonido ni pide el CDN hasta que
   alguien toca la pantalla, y un tráiler sin sonido es la mitad del tráiler. */
if (typeof document !== 'undefined' && document.getElementById('tr-frame')) {
  translateDom(document.body);
  const show = createTrailer();
  const start = $('tr-start');
  const play = $('tr-play');
  const replay = $('tr-replay');
  const sound = $('tr-sound');
  const frame = $('tr-frame');

  const begin = () => {
    start.dataset.gone = 'true';
    setTimeout(() => { start.hidden = true; }, 500);
    show.play();
  };
  play?.addEventListener('click', begin);
  replay?.addEventListener('click', () => show.play());

  /* El interruptor del sonido, que es el único ajuste que un tráiler necesita.

     Arranca en lo que el jugador ya tenía elegido en el juego y no en "todo prendido":
     las dos perillas viven en el mismo `localStorage` (`axie-chance:audio`), así que
     encenderlas de prepo acá le cambiaría el sonido de la partida a alguien que entró a
     ver un tráiler. Apretar el botón sí es una decisión suya, y esa se guarda. */
  const soundOn = () => show.audio.sfxOn || show.audio.musicOn;
  const paintSound = () => {
    sound.setAttribute('aria-pressed', String(soundOn()));
    sound.textContent = soundOn() ? tr('Sonido') : tr('Silencio');
  };
  sound?.addEventListener('click', () => {
    const on = !soundOn();
    show.audio.setSfx(on);
    show.audio.setMusic(on);
    paintSound();
  });
  if (sound) paintSound();

  // Los controles aparecen cuando la mano se mueve y se van cuando se queda quieta: un
  // tráiler con botones encima todo el tiempo es un reproductor, no un tráiler.
  let hide = 0;
  const wake = () => {
    frame.dataset.hover = 'true';
    clearTimeout(hide);
    hide = setTimeout(() => { delete frame.dataset.hover; }, 2200);
  };
  frame.addEventListener('pointermove', wake);
  frame.addEventListener('pointerdown', wake);

  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      start.hidden ? show.play() : begin();
    }
    if (e.key === 'r' || e.key === 'R') show.play();
  });

  // La pestaña en segundo plano no tiene por qué seguir sonando.
  document.addEventListener('visibilitychange', () => show.audio.listen(!document.hidden));
}
