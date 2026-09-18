// El sonido: los efectos del Axie Origins Asset Kit y sus temas de fondo.
//
// Va sobre la Web Audio API y no sobre `<audio>` porque el juego necesita tres cosas
// que un `<audio>` no da: largar el mismo golpe dos veces sin cortar el anterior,
// **adelantar** un sonido para que su pico caiga sobre el impacto (ver `lead`), y
// cambiarle el tono —cada carta de la cadena suena un poco más aguda que la anterior,
// que es la tensión de la tirada contada con el oído—.
//
// Los wav se piden al CDN la primera vez que se usan, igual que los atlas de los
// efectos, y quedan decodificados para el resto de la partida. Lo que pesa está
// medido en `audio-clips.js`.
//
// Nada de esto es indispensable: sin AudioContext —los tests, un navegador viejo, la
// pestaña sin permiso todavía— todas las funciones siguen existiendo y no hacen nada.
import { SOUNDS, MUSIC, soundUrl } from './audio-clips.js';

/**
 * La mezcla: cuánto de cada cosa, ya con los archivos emparejados entre sí por
 * `npm run sfx`. Acá se decide qué manda sobre qué, que es una decisión de juego y no
 * una medición: el golpe es lo más fuerte, el tic de cada carta es lo más flojo —suena
 * hasta seis veces por turno— y la música va bien atrás.
 */
const MASTER = 0.9;
const SFX_BUS = 0.75;
const MUSIC_BUS = 0.35;

/** Retoques por evento, sobre el volumen ya emparejado. */
const MIX = {
  // La cadena que se corta es el peor momento de la tirada: se le da aire.
  bust: 1.2,
  draw: 0.45,
  take: 0.7,
  open: 0.5,
  renew: 0.6,
  block: 0.8,
  octopus: 0.8,
};

/**
 * Sonidos que no se dejan terminar, en segundos de archivo.
 *
 * El tic de robar dura 1.8 s y las cartas salen cada 700 ms: se queda con el arranque,
 * que es lo que se oye como golpecito, y se va. Y la carta que entra al mazo es un
 * clic: 0,25 s, lo que tarda una carta en apoyarse.
 *
 * La cadena cortada estuvo acá mientras fue un impacto —había que sacarle la cola para
 * que un corte durara lo que dura un corte—. Ya no lo es: `doubt` son 0,75 s enteros y
 * lo que cuenta es el final, la nota cayéndose. Cortada a la mitad se queda con la
 * pregunta y se pierde la respuesta.
 */
const CUT = { draw: 0.5, take: 0.25 };

/**
 * Sonidos que no salen al tono del archivo.
 *
 * La cadena cortada llega después de una seguidilla de tics que suben, así que lo que
 * tiene que hacer es caer — y el archivo ya cae solo, tres semitonos entre que empieza
 * y se apaga (ver `bust` en `scripts/sfx.mjs`). Bajarlo un 10% más lo deja empezando
 * abajo del último tic que sonó, que es de donde tiene que arrancar la caída, y lo
 * estira a 0,83 s. Va acá y no en quien lo larga porque es parte de la elección del
 * sonido: `lead` se estira con él y lo que se sincronice con su pico sigue dando.
 */
const RATE = { bust: 0.9 };

/** Cuánto se mueve el tono del toque de un botón de una vez a otra (±4%). */
const PRESS_DETUNE = 0.08;

/** Cuánto tarda un tema en entrar y en irse, en segundos. */
const FADE = 1.5;

/**
 * Qué suena en cada momento. Cada lista es una rueda: se baraja, suena entera y se
 * vuelve a barajar sin repetir el último tema, así dos partidas seguidas no arrancan
 * con lo mismo y una partida larga no da la vuelta sobre un solo tema. Para sumar o
 * sacar un tema alcanza con tocar esta lista (los temas medidos están en
 * `audio-clips.js`; `npm run sfx` mide los nuevos).
 *
 * - `menu`: la portada, la Aventura y la sala antes de empezar. `home` es el tema de
 *   la pantalla principal de Origins. Los otros medidos: `halloween` y
 *   `lunar_bloodmoon`.
 * - `battle`: la partida. Los cuatro combates del kit.
 * - `boss`: alguien quedó con la vida corta.
 */
const PLAYLISTS = {
  menu: ['home', 'summer23'],
  battle: ['pve_1', 'pve_2', 'pve_3', 'pvp'],
  boss: ['boss'],
};

/**
 * Cuánto tarda en entrar el tema siguiente de la rueda. Arranca encima de la cola del
 * anterior, que se está yendo (ver `overlapOf`): un fundido corto de entrada y los dos
 * se cruzan en vez de pisarse. Si el que sigue es el mismo tema, entra sin fundido,
 * como siempre.
 */
const SWAP = 1;

/**
 * Cuántos temas decodificados se guardan. Uno de dos minutos y medio ocupa unos 30 MB
 * ya decodificado: se guardan el que suena, el que sigue y uno más, y el resto se
 * vuelve a pedir si hace falta (el navegador ya lo tiene en su caché).
 */
const KEEP_TRACKS = 3;
/**
 * Los temas del kit no son bucles: terminan con un fundido. La vuelta siguiente se
 * larga encima de ese fundido, así el empalme queda tapado. Nunca menos de 2 s, aunque
 * el fundido medido sea más corto: la cola que se está yendo se apaga en ese tramo.
 */
const overlapOf = (clip) => Math.max(clip.tail, 2);

/** Lo que el jugador dejó elegido la última vez. */
const PREFS = 'axie-chance:audio';

/**
 * Una perilla de volumen: de 0 a 1, y el valor de fábrica si lo guardado es basura.
 * Es un multiplicador sobre la mezcla del juego (`SFX_BUS`, `MUSIC_BUS`), no un
 * volumen absoluto: al 100% suena como está medido, que es como tiene que sonar.
 */
const level = (n) => (typeof n === 'number' && n >= 0 && n <= 1 ? n : 1);

function loadPrefs() {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(PREFS) ?? '{}');
    return {
      sfx: saved.sfx !== false,
      music: saved.music === true,
      sfxVol: level(saved.sfxVol),
      musicVol: level(saved.musicVol),
    };
  } catch {
    // Sin localStorage —o con basura adentro— se juega con los valores de fábrica.
    return { sfx: true, music: false, sfxVol: 1, musicVol: 1 };
  }
}

function savePrefs(prefs) {
  try {
    globalThis.localStorage?.setItem(PREFS, JSON.stringify(prefs));
  } catch {
    // Que no se pueda guardar la preferencia no es motivo para romper el juego.
  }
}

/**
 * El mezclador. Se crea al arrancar, pero no toca nada hasta el primer clic: los
 * navegadores no dejan sonar antes de que el jugador interactúe, así que `unlock` es
 * lo que enciende el AudioContext de verdad (ver `mount` en `ui.js`).
 */
export function createAudio() {
  const prefs = loadPrefs();
  /** El volumen de cada bus: la mezcla del juego por la perilla del jugador. */
  const sfxGain = () => (prefs.sfx ? SFX_BUS * prefs.sfxVol : 0);
  const musicGain = () => MUSIC_BUS * prefs.musicVol;
  const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  /** Qué lista se querría estar escuchando, aunque todavía no haya con qué. */
  let wanted = null;
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  /** La lista sonando: sus pases encadenados y el temporizador del próximo. */
  let playing = null;
  const buffers = new Map();
  /** Lo que le queda a cada rueda por sonar, y el último que sonó de cada una. */
  const queues = {};
  const lastOf = {};
  /**
   * El tema que cada lista tenía listo para seguir. Si la lista se cortó antes de
   * llegar a él —se fue de la portada, se terminó la partida—, es con el que vuelve:
   * volver a la portada no repite el tema que sonaba al irse.
   */
  const upcoming = {};
  /** Los temas decodificados, del último que se usó al más viejo. */
  let recent = [];

  /** Baja el wav y lo decodifica, una sola vez. `null` si no se pudo: es decorado. */
  function load(clip) {
    const url = soundUrl(clip);
    if (!buffers.has(url)) {
      buffers.set(
        url,
        fetch(url)
          .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(res.status))))
          .then((raw) => ctx.decodeAudioData(raw))
          .catch(() => null),
      );
    }
    return buffers.get(url);
  }

  /** Una fuente lista para sonar, con su propio volumen. */
  function source(buffer, bus, gain) {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const vol = ctx.createGain();
    vol.gain.value = gain;
    src.connect(vol).connect(bus);
    return { src, vol };
  }

  function ramp(param, to, secs, from = ctx.currentTime) {
    param.cancelScheduledValues(from);
    param.setValueAtTime(param.value, from);
    param.linearRampToValueAtTime(to, from + secs);
  }

  // ---- sintetizados -----------------------------------------------------------

  /** Cuándo largar un sonido sintetizado, o `null` si no hay con qué (o no se quiere). */
  function synthAt(delay) {
    if (!ctx || !prefs.sfx || typeof ctx.createOscillator !== 'function') return null;
    return ctx.currentTime + delay / 1000;
  }

  /**
   * Una voz sintetizada: el tono va de `f0` a `f1`, el volumen pega en `peak` a los
   * `rise` segundos y se apaga a los `fall`. Todo contado desde `at`.
   */
  function tone(at, type, [f0, t0, f1, t1], [peak, rise, fall], [start, stop]) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, at + t0);
      osc.frequency.exponentialRampToValueAtTime(f1, at + t1);
      gain.gain.setValueAtTime(0.001, at);
      gain.gain.linearRampToValueAtTime(peak, at + rise);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + fall);
      osc.connect(gain);
      gain.connect(sfxBus);
      osc.start(at + start);
      osc.stop(at + stop);
    } catch {
      // Un navegador a medias con osciladores: el toque es decorado, no se rompe nada.
    }
  }

  // ---- música -----------------------------------------------------------------

  /** El próximo tema de la rueda de `list`. */
  function nextTrack(list) {
    const tracks = PLAYLISTS[list];
    if (!queues[list]?.length) {
      const bag = tracks.slice();
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      // La rueda nueva no empieza con el que cerró la anterior.
      if (bag.length > 1 && bag[0] === lastOf[list]) bag.push(bag.shift());
      queues[list] = bag;
    }
    return (lastOf[list] = queues[list].shift());
  }

  /** Baja un tema y suelta los decodificados que ya no se van a usar pronto. */
  function loadTrack(key) {
    const clip = MUSIC[key];
    recent = [key, ...recent.filter((k) => k !== key)];
    for (const old of recent.splice(KEEP_TRACKS)) buffers.delete(soundUrl(MUSIC[old]));
    return load(clip);
  }

  /**
   * Larga `key` apenas esté bajado, si `run` sigue siendo lo que suena. Se compara la
   * vuelta y no el nombre de la lista: portada, partida y portada de nuevo con el tema
   * todavía bajando son la misma lista, y el pedido viejo no puede largar un segundo
   * tema encima. Si no se pudo bajar, prueba con el que sigue, una vez por tema.
   */
  function play(run, key, fadeIn, tries = 1) {
    loadTrack(key).then((buffer) => {
      if (playing !== run) return;
      if (buffer) pass(run, key, buffer, ctx.currentTime, fadeIn);
      else if (tries < PLAYLISTS[run.list].length) play(run, nextTrack(run.list), fadeIn, tries + 1);
    });
  }

  /** Larga una vuelta del tema y deja programado el siguiente de la rueda sobre su fundido. */
  function pass(run, key, buffer, at, fadeIn) {
    const { list } = run;
    const clip = MUSIC[key];
    const { src, vol } = source(buffer, musicBus, clip.gain);
    if (fadeIn) {
      vol.gain.setValueAtTime(0, at);
      vol.gain.linearRampToValueAtTime(clip.gain, at + fadeIn);
    }
    src.start(at);
    src.stop(at + clip.secs);
    run.sources.push({ src, vol });

    // El siguiente se empieza a bajar ya: para cuando este llegue a su cola está listo.
    const next = (upcoming[list] = nextTrack(list));
    if (next !== key) loadTrack(next);

    const overlap = overlapOf(clip);
    // La cola se apaga mientras la vuelta siguiente ya está sonando: el empalme no se
    // oye ni cuando el tema termina más seco de lo que se midió.
    vol.gain.setValueAtTime(clip.gain, at + clip.secs - overlap);
    vol.gain.linearRampToValueAtTime(0, at + clip.secs);
    run.timer = setTimeout(() => {
      if (playing !== run) return;
      run.sources = run.sources.filter((s) => s.src !== src);
      play(run, next, next === key ? 0 : SWAP);
    }, Math.max((clip.secs - overlap) * 1000, 1000));
  }

  /** Apaga lo que esté sonando de fondo, con fundido. */
  function fadeOut(secs = FADE) {
    if (!playing) return;
    const { sources, timer } = playing;
    clearTimeout(timer);
    playing = null;
    for (const { src, vol } of sources) {
      ramp(vol.gain, 0, secs);
      try {
        src.stop(ctx.currentTime + secs + 0.05);
      } catch {
        // Ya estaba parada: es lo que se quería.
      }
    }
  }

  function startMusic(list) {
    if (!PLAYLISTS[list]) return;
    fadeOut();
    playing = { list, sources: [], timer: 0 };
    const key = upcoming[list] ?? nextTrack(list);
    delete upcoming[list];
    play(playing, key, FADE);
  }

  // ---- lo que usa el juego ----------------------------------------------------

  const api = {
    get sfxOn() {
      return prefs.sfx;
    },
    get musicOn() {
      return prefs.music;
    },
    /** Dónde quedaron las dos perillas, de 0 a 1. Las pinta el menú (ver `ui.js`). */
    get sfxVol() {
      return prefs.sfxVol;
    },
    get musicVol() {
      return prefs.musicVol;
    },
    /** Si ya hay con qué sonar. Los tests y los navegadores sin Web Audio dan `false`. */
    get live() {
      return Boolean(ctx);
    },

    /**
     * Enciende el audio. Tiene que salir de algo que hizo el jugador —un clic, una
     * tecla—: antes de eso el navegador no deja sonar nada. Se puede llamar todas las
     * veces que haga falta; después de la primera solo se asegura de que el contexto
     * no haya quedado suspendido.
     */
    unlock() {
      if (!Ctx) return;
      if (!ctx) {
        try {
          ctx = new Ctx();
        } catch {
          return; // sin audio: el juego sigue igual
        }
        master = ctx.createGain();
        master.gain.value = MASTER;
        master.connect(ctx.destination);
        sfxBus = ctx.createGain();
        sfxBus.gain.value = sfxGain();
        sfxBus.connect(master);
        musicBus = ctx.createGain();
        musicBus.gain.value = musicGain();
        musicBus.connect(master);
        if (prefs.music && wanted) startMusic(wanted);
      }
      if (ctx.state === 'suspended') ctx.resume?.();
    },

    /**
     * Cuánto tarda `key` en llegar a su punto más fuerte, en ms. Quien quiera que el
     * golpe se oiga **en** el impacto y no después tiene que largarlo con esta
     * anticipación (ver `playHit` en `ui.js`).
     */
    lead(key, rate = RATE[key] ?? 1) {
      return ((SOUNDS[key]?.lead ?? 0) * 1000) / rate;
    },

    /**
     * Larga un efecto.
     *
     * @param {string} key    el evento, no el archivo (ver `PICKS` en `scripts/sfx.mjs`)
     * @param {object} opts
     *   `rate`  el tono: 1 es como se grabó, 1.2 es más agudo y más corto
     *           (por omisión, lo que diga `RATE`)
     *   `gain`  un retoque puntual sobre la mezcla, de 0 a 1
     *   `cut`   cortarlo a los tantos segundos, con su fundidito para que no chasquee
     *           (por omisión, lo que diga `CUT`)
     *   `delay` esperar tantos ms antes de largarlo
     */
    sfx(key, { rate = RATE[key] ?? 1, gain = 1, cut = CUT[key] ?? 0, delay = 0 } = {}) {
      if (key === 'freegame' || key === 'liquid') {
        this.sfx('octopus', { rate: 1.35, gain: 0.95, delay });
        this.sfx('take', { rate: 1.15, gain: 0.8, delay });
        this.liquidDrop(delay);
        return;
      }
      const clip = SOUNDS[key];
      if (!ctx || !prefs.sfx || !clip) return;
      const at = ctx.currentTime + delay / 1000;
      load(clip).then((buffer) => {
        if (!buffer || !prefs.sfx) return;
        const { src, vol } = source(buffer, sfxBus, clip.gain * (MIX[key] ?? 1) * gain);
        src.playbackRate.value = rate;
        // El wav puede empezar con silencio: se saltea, para que el sonido salga
        // cuando se lo pidió y no cuando al archivo se le ocurra.
        const dur = Math.min(cut || clip.secs, clip.secs);
        // Si la descarga tardó más que la espera pedida, sale ahora: llegar tarde es
        // mejor que no salir.
        const when = Math.max(at, ctx.currentTime);
        src.start(when, clip.onset, dur);
        // Cortado a mano, se apaga en 80 ms: un corte seco en medio de un sonido
        // chasquea, y el chasquido se oye más que el sonido.
        if (dur < clip.secs) {
          const ends = when + dur / rate;
          vol.gain.setValueAtTime(vol.gain.value, ends - 0.08);
          vol.gain.linearRampToValueAtTime(0, ends);
        }
      });
    },

    /**
     * Resonancia líquida procedural (gota de agua / burbuja orgánica).
     * Sintetiza una curva sinusoidal suave y armónico brillante conectado al bus de efectos.
     */
    liquidDrop(delay = 0) {
      const at = synthAt(delay);
      if (at === null) return;
      // El cuerpo de la gota, y un armónico brillante encima.
      tone(at, 'sine', [380, 0, 780, 0.09], [0.42, 0.015, 0.16], [0, 0.18]);
      tone(at, 'triangle', [1180, 0.02, 1420, 0.1], [0.18, 0.025, 0.14], [0.01, 0.16]);
    },

    /**
     * El toque de un botón. El kit no trae sonidos de interfaz —son todos golpes y
     * estados—, así que se sintetiza: sale en el acto, sin esperar ninguna descarga, y
     * un botón que suena tarde se siente roto. Es un "toc" de madera de 70 ms: un
     * chasquido agudo que cae y un cuerpo grave debajo. Va bien bajo porque se oye
     * encima de todo lo demás —robar ya tiene su tic, atacar su golpe—.
     *
     * Cada toque sale un pelo más agudo o más grave que el anterior: el mismo sonido
     * clavado diez veces seguidas suena a máquina.
     */
    press() {
      const at = synthAt(0);
      if (at === null) return;
      const k = 1 + (Math.random() - 0.5) * PRESS_DETUNE;
      tone(at, 'sine', [1500 * k, 0, 950 * k, 0.04], [0.16, 0.004, 0.07], [0, 0.08]);
      tone(at, 'triangle', [520 * k, 0, 360 * k, 0.05], [0.12, 0.003, 0.06], [0, 0.07]);
    },

    /**
     * Qué tiene que estar sonando de fondo: `'menu'`, `'battle'`, `'boss'` o `null`
     * (ver `PLAYLISTS`). Pedir lo mismo que ya suena no lo reinicia, así que se puede
     * llamar en cada repintado. Volver a pedir una lista después de otra sí sigue su
     * rueda: la partida siguiente arranca con otro tema.
     */
    music(list) {
      if (wanted === list) return;
      wanted = list;
      if (!ctx || !prefs.music) return;
      if (list) startMusic(list);
      else fadeOut();
    },

    setSfx(on) {
      prefs.sfx = on;
      savePrefs(prefs);
      if (sfxBus) ramp(sfxBus.gain, sfxGain(), 0.15);
    },

    /**
     * La perilla de los efectos, de 0 a 1. Va aparte del interruptor: bajar el volumen
     * a cero y apagarlos no es lo mismo —el que lo bajó lo va a volver a subir, y el
     * que lo apagó dejó dicho que no quiere efectos—, y el interruptor tiene que poder
     * devolver el sonido al volumen que el jugador había elegido.
     */
    setSfxLevel(value) {
      prefs.sfxVol = level(Math.min(1, Math.max(0, value)));
      savePrefs(prefs);
      // Corto: la perilla se arrastra, y un fundido largo va siempre atrás del dedo.
      if (sfxBus) ramp(sfxBus.gain, sfxGain(), 0.05);
    },

    setMusic(on) {
      prefs.music = on;
      savePrefs(prefs);
      if (!ctx) return;
      if (on && wanted) startMusic(wanted);
      else if (!on) fadeOut(0.4);
    },

    /**
     * La perilla de la música. A diferencia de la de los efectos, esta sí se puede
     * mover con el tema sonando y se oye en el acto: el bus es uno solo y las vueltas
     * que ya están programadas cuelgan de él.
     */
    setMusicLevel(value) {
      prefs.musicVol = level(Math.min(1, Math.max(0, value)));
      savePrefs(prefs);
      if (musicBus) ramp(musicBus.gain, musicGain(), 0.05);
    },

    /**
     * La pestaña pasó a segundo plano. Un combate que sigue solo —la CPU juega igual—
     * no tiene por qué seguir sonando en una pestaña que nadie está mirando.
     */
    listen(on) {
      if (master) ramp(master.gain, on ? MASTER : 0, 0.3);
    },
  };
  return api;
}
