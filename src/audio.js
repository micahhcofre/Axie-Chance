// El sonido: los efectos del Axie Origins Asset Kit y sus dos temas de fondo.
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

/** Cuánto tarda un tema en entrar y en irse, en segundos. */
const FADE = 1.5;
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
  /** Qué tema se querría estar escuchando, aunque todavía no haya con qué. */
  let wanted = null;
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  /** El tema sonando: sus pases encadenados y el temporizador del próximo. */
  let playing = null;
  const buffers = new Map();

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

  // ---- música -----------------------------------------------------------------

  /** Larga una vuelta del tema y deja programada la siguiente sobre su fundido. */
  function pass(track, clip, buffer, at, fadeIn) {
    const { src, vol } = source(buffer, musicBus, clip.gain);
    if (fadeIn) {
      vol.gain.setValueAtTime(0, at);
      vol.gain.linearRampToValueAtTime(clip.gain, at + fadeIn);
    }
    src.start(at);
    src.stop(at + clip.secs);
    playing.sources.push({ src, vol });

    const overlap = overlapOf(clip);
    // La cola se apaga mientras la vuelta siguiente ya está sonando: el empalme no se
    // oye ni cuando el tema termina más seco de lo que se midió.
    vol.gain.setValueAtTime(clip.gain, at + clip.secs - overlap);
    vol.gain.linearRampToValueAtTime(0, at + clip.secs);
    playing.timer = setTimeout(() => {
      if (playing?.track !== track) return;
      playing.sources = playing.sources.filter((s) => s.src !== src);
      pass(track, clip, buffer, ctx.currentTime, 0);
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

  function startMusic(track) {
    const clip = MUSIC[track];
    if (!clip) return;
    fadeOut();
    playing = { track, sources: [], timer: 0 };
    load(clip).then((buffer) => {
      // Mientras se bajaba el tema pudo cambiar lo que hay que escuchar.
      if (!buffer || playing?.track !== track) return;
      pass(track, clip, buffer, ctx.currentTime, FADE);
    });
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
      if (!ctx || !prefs.sfx || typeof ctx.createOscillator !== 'function') return;
      try {
        const at = ctx.currentTime + delay / 1000;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(380, at);
        osc.frequency.exponentialRampToValueAtTime(780, at + 0.09);

        gain.gain.setValueAtTime(0.001, at);
        gain.gain.linearRampToValueAtTime(0.42, at + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);

        osc.connect(gain);
        gain.connect(sfxBus);

        osc.start(at);
        osc.stop(at + 0.18);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1180, at + 0.02);
        osc2.frequency.exponentialRampToValueAtTime(1420, at + 0.1);
        gain2.gain.setValueAtTime(0.001, at);
        gain2.gain.linearRampToValueAtTime(0.18, at + 0.025);
        gain2.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);

        osc2.connect(gain2);
        gain2.connect(sfxBus);

        osc2.start(at + 0.01);
        osc2.stop(at + 0.16);
      } catch {
        // En navegadores sin osciladores o mocks, ignora en silencio
      }
    },

    /**
     * Qué tiene que estar sonando de fondo: `'battle'`, `'boss'` o `null`. Pedir lo
     * mismo que ya suena no lo reinicia, así que se puede llamar en cada repintado.
     */
    music(track) {
      if (wanted === track) return;
      wanted = track;
      if (!ctx || !prefs.music) return;
      if (track) startMusic(track);
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
