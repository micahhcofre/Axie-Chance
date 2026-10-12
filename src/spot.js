// El spot de 30 segundos: Axie Chance contado en diseño en movimiento.
//
// El tráiler de al lado (`trailer.js`) actúa una partida —los Axies piensan, se pegan y
// se cagan de risa—. Éste no actúa nada: son cartas, símbolos, números y letras cortados
// contra un pulso de 120 golpes por minuto, que es la otra manera de contar el mismo
// chiste. El chiste es el de siempre y es el del juego entero:
//
//     la cadena paga al cuadrado, así que siempre conviene robar **una más**, hasta que
//     no; y cuando no, no te llevás menos: te llevás cero.
//
// Siete actos, treinta segundos clavados:
//
//   0.0  la apertura   un punto que estalla en seis clases y detona en la primera carta
//   1.5  la cadena     cinco cartas, las vigas que unen los símbolos vivos, 2 → 26
//   4.0  la regla      «L²» a pantalla completa y las seis barras 1 4 9 16 25 36
//   6.5  la escalada   cinco cartas más, 37 → 101, la rueda de chances y «¿UNA MÁS?»
//  12.0  el corte      fogonazo, silencio, el 101 partido al medio y el cero
//  15.3  el arsenal    las trece armas en corte duro, una cada 380 milésimas
//  20.6  el remate     la misma cadena, esta vez la carta entra: 122
//  22.4  el título
//
// ---------------------------------------------------------------------------------
// LO QUE HACE QUE ESTO SEA UNA PELÍCULA Y NO UNA PÁGINA ANIMADA
//
// No hay una sola `animation` ni `transition` de CSS adentro del cuadro (`spot.css` las
// apaga de raíz). Todo lo que se mueve es una **función pura del segundo en el que
// está**: `seek(t)` recibe un número y escribe el cuadro entero, sin memoria y sin
// estado. Hasta las chispas, que suelen ser un integrador con partículas vivas, son acá
// una parábola resuelta —`p(τ) = p₀ + v·τ + ½·g·τ²`— con sus azares sacados de un hash
// del índice. El mismo `t` da siempre el mismo cuadro.
//
// Eso, que suena a capricho, es lo que hace posible:
//   · frenar en cualquier instante y que lo que se ve sea exacto;
//   · arrastrar la barra para atrás, que es lo primero que uno quiere hacer;
//   · abrir `spot.html?at=12.04` y ver **ese** cuadro, el del fogonazo, quieto;
//   · y sacarle los 900 cuadros de punta a punta a un navegador sin cabeza para
//     exportar el video de verdad, sin grabar la pantalla ni rezar por el framerate.
//
// El sonido va por otro reloj —el del audio, que es el único que no se puede empujar— y
// se engancha con adelanto: cada cuadro programa los golpes que entran en el próximo
// medio segundo, en el tiempo absoluto del `AudioContext`. Así la batería no cojea
// aunque el hilo principal se trabe, que es exactamente lo que le pasa a un spot cuando
// se corta a una carta cada media negra.
//
// Y las cuentas son las del juego: `playCard()` decide si la carta entra o corta,
// `scoreChain()` pone el número y `survivalOdds()` la rueda. Un spot que dibujara sus
// propios números estaría vendiendo otro juego.
import { tr, translateDom } from './i18n.js';
import { SYMBOLS, POWERS, iconUrl, makeCard, buildPool, makeRng } from './data.js';
import { emptyChain, playCard, scoreChain, isScoringCell, survivalOdds } from './rules.js';
import { createAudio } from './audio.js';

const $ = (id) => document.getElementById(id);

/** Menos movimiento: el spot se cuenta igual, pero sin sacudones ni cortes al hueso. */
const quiet = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

// ---- el sistema de movimiento -------------------------------------------------
//
// Cinco funciones y una tabla de curvas. Todo el spot está escrito con esto, y que sea
// tan poco es a propósito: una película que necesita treinta primitivas distintas para
// moverse no tiene una voz, tiene un acento por escena.

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, p) => a + (b - a) * p;
/** El tramo `a`→`b` visto desde `t`, de 0 a 1. Es la única forma de medir tiempo acá. */
const span = (t, a, b) => clamp((t - a) / (b - a || 1e-6));

/**
 * Las curvas. Son las de siempre y están todas acá porque una curva es una decisión de
 * tono: `outExpo` sale disparado y se asienta (todo lo que **entra**), `inCubic` arranca
 * quieto y se va de golpe (todo lo que **se va**), `outBack` se pasa de largo y vuelve
 * (lo que **golpea**), y `inOut` es la cámara, que no chasquea nunca.
 */
const E = {
  lin: (p) => p,
  inQuad: (p) => p * p,
  outQuad: (p) => 1 - (1 - p) ** 2,
  inCubic: (p) => p ** 3,
  outCubic: (p) => 1 - (1 - p) ** 3,
  inOutCubic: (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2),
  outQuart: (p) => 1 - (1 - p) ** 4,
  outQuint: (p) => 1 - (1 - p) ** 5,
  inExpo: (p) => (p <= 0 ? 0 : 2 ** (10 * p - 10)),
  outExpo: (p) => (p >= 1 ? 1 : 1 - 2 ** (-11 * p)),
  inOutExpo: (p) => (p <= 0 ? 0 : p >= 1 ? 1
    : p < 0.5 ? 2 ** (20 * p - 10) / 2 : (2 - 2 ** (-20 * p + 10)) / 2),
  outBack: (p) => 1 + 2.9 * (p - 1) ** 3 + 1.9 * (p - 1) ** 2,
  outElastic: (p) => (p <= 0 ? 0 : p >= 1 ? 1
    : 2 ** (-9 * p) * Math.sin((p * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
  // El rebote de algo que cae y se queda: sirve para el número y para las cartas.
  outBounce: (p) => {
    const n = 7.5625, d = 2.75;
    if (p < 1 / d) return n * p * p;
    if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
    if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
    return n * (p -= 2.625 / d) * p + 0.984375;
  },
};

/**
 * La gráfica de valor de toda la vida: una lista de `[segundo, valor]` y, opcional, la
 * curva con la que se llega a cada uno. Fuera de los extremos se queda quieta.
 *
 *     track(t, [[1.5, 0], [1.7, 1, E.outBack], [3.9, 1], [4.0, 0, E.inCubic]])
 *
 * Es literalmente lo que uno pone en una línea de tiempo, y por eso el guion de más
 * abajo se lee como un guion y no como una cuenta de senos.
 */
function track(t, keys, ease = E.outCubic) {
  if (t <= keys[0][0]) return keys[0][1];
  const end = keys[keys.length - 1];
  if (t >= end[0]) return end[1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1, e] = keys[i];
      return lerp(v0, v1, (e ?? ease)(span(t, t0, t1)));
    }
  }
  return end[1];
}

/** Azar determinista: el mismo par `(a, b)` da siempre el mismo número entre 0 y 1. */
function hash(a, b = 0) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x165667b1, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2545f491); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** Ruido suave y continuo, para el pulso de la cámara en mano. Tres senos y listo. */
const wobble = (t, seed = 0) =>
  Math.sin(t * 1.73 + seed * 2.1) * 0.5 + Math.sin(t * 4.11 + seed * 5.7) * 0.32
  + Math.sin(t * 9.3 + seed * 11.3) * 0.18;

/**
 * El sacudón de un impacto: fuerte y corto, y siempre el mismo porque hace falta que lo
 * sea. Devuelve píxeles, ya apagándose.
 */
function shake(t, t0, amp, dur = 0.42, seed = 0) {
  if (t < t0 || t > t0 + dur) return 0;
  const p = (t - t0) / dur;
  return Math.sin((t - t0) * 92 + seed * 3.3) * amp * (1 - p) ** 2;
}

/**
 * El aplastado de lo que aterriza: se achata y vuelve. Devuelve `[escalaX, escalaY]`.
 * Es el truco más viejo del dibujo animado y sigue siendo el que hace que un golpe se
 * sienta en el cuerpo en vez de verse en la pantalla.
 */
function squash(t, t0, dur = 0.26, k = 0.2) {
  if (t < t0 || t > t0 + dur) return [1, 1];
  const p = span(t, t0, t0 + dur);
  const d = Math.sin(p * Math.PI) * (1 - p) * k * 2;
  return [1 + d, 1 - d];
}

// ---- la banda de sonido --------------------------------------------------------
//
// Treinta segundos escritos, no sorteados. El juego trae los temas del kit (`PLAYLISTS`
// en `audio.js`) y son buenos, pero son canciones: entran, suenan y salen. Un spot
// necesita lo contrario —que el sonido haga los cortes— y eso no se le pide a una rueda
// de temas: se sintetiza. Son doce voces de osciladores y ruido, nada que bajar.
//
// La gracia está en el silencio del segundo 11,3: es el único momento en que no suena
// absolutamente nada, dura siete décimas y es lo que hace que el fogonazo del 12,0
// pegue. Un spot que suena parejo los treinta segundos no tiene clímax, tiene volumen.

/** Notas, por nombre, porque `146.83` no se lee. */
const N = {
  D1: 36.71, F1: 43.65, G1: 49.00, A1: 55.00, C2: 65.41, D2: 73.42, F2: 87.31,
  G2: 98.00, A2: 110.00, C3: 130.81, D3: 146.83, F3: 174.61, G3: 196.00, A3: 220.00,
  Bb3: 233.08, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, Fs3: 185.00, A4: 440.00,
};

function createScore(wants) {
  const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  let ctx = null;
  let bus = null;
  let noise = null;
  let live = [];        // lo que está sonando, para poder cortarlo en seco
  let origin = 0;       // en qué `currentTime` del audio arranca el segundo 0 de la película
  let cursor = 0;       // hasta qué golpe de la lista ya se programó

  function ready() {
    if (!Ctx || !wants()) return null;
    if (!ctx) {
      ctx = new Ctx();
      bus = ctx.createGain();
      bus.gain.value = 0.62;
      bus.connect(ctx.destination);
      // Dos segundos de ruido blanco, hechos una sola vez: de acá salen el redoblante,
      // los charles, el barrido y el golpe. Sale más barato que un oscilador por voz.
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume?.();
    return ctx;
  }

  /** Anota un nodo como vivo y lo suelta cuando termina. Cortar el spot lo corta a él. */
  function own(node, ...rest) {
    live.push(node, ...rest);
    node.onended = () => {
      for (const n of [node, ...rest]) { try { n.disconnect(); } catch { /* ya estaba */ } }
      live = live.filter((n) => n !== node && !rest.includes(n));
    };
  }

  const env = (at, gain, a, d, hold = 0) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(gain, at + a);
    if (hold) g.gain.setValueAtTime(gain, at + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, at + a + hold + d);
    return g;
  };

  const src = (at, dur) => {
    const s = ctx.createBufferSource();
    s.buffer = noise; s.loop = true;
    s.start(at); s.stop(at + dur);
    return s;
  };

  // ---- las voces ----

  /** El bombo: un seno que cae de 165 a 45 en un suspiro. Es el pulso del spot entero. */
  function kick(at, gain = 0.9) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(165, at);
    o.frequency.exponentialRampToValueAtTime(45, at + 0.11);
    const g = env(at, 0.5 * gain, 0.004, 0.27);
    o.connect(g); g.connect(bus); own(o, g);
    o.start(at); o.stop(at + 0.32);
  }

  /** El bajo de abajo de todo: es lo que hace que el pecho sepa en qué acto está. */
  function sub(at, f, dur = 0.5, gain = 0.5) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, at);
    const g = env(at, 0.34 * gain, 0.02, dur * 0.7, dur * 0.3);
    o.connect(g); g.connect(bus); own(o, g);
    o.start(at); o.stop(at + dur + 0.4);
  }

  /** Redoblante: ruido pasado por banda más un golpe de tono. */
  function snare(at, gain = 0.8) {
    const s = src(at, 0.24);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.7;
    const g = env(at, 0.21 * gain, 0.003, 0.17);
    s.connect(bp); bp.connect(g); g.connect(bus); own(s, bp, g);
    const o = ctx.createOscillator();
    o.type = 'triangle'; o.frequency.setValueAtTime(190, at);
    const og = env(at, 0.11 * gain, 0.002, 0.1);
    o.connect(og); og.connect(bus); own(o, og);
    o.start(at); o.stop(at + 0.14);
  }

  /** Charles. Cortos casi siempre; el abierto sirve para avisar que viene un corte. */
  function hat(at, gain = 0.5, open = false) {
    const dur = open ? 0.19 : 0.045;
    const s = src(at, dur + 0.02);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 7200;
    const g = env(at, 0.075 * gain, 0.001, dur);
    s.connect(hp); hp.connect(g); g.connect(bus); own(s, hp, g);
  }

  /** El pinchazo de sierra que marca cada carta y cada arma del arsenal. */
  function stab(at, f, dur = 0.16, gain = 0.8) {
    const o = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f, at);
    lp.type = 'lowpass'; lp.Q.value = 6;
    lp.frequency.setValueAtTime(f * 9, at);
    lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.5), at + dur);
    const g = env(at, 0.13 * gain, 0.005, dur);
    o.connect(lp); lp.connect(g); g.connect(bus); own(o, lp, g);
    o.start(at); o.stop(at + dur + 0.05);
  }

  /** La campanita de las barras y de los renglones del final. */
  function ding(at, f, gain = 0.6) {
    const o = ctx.createOscillator();
    o.type = 'triangle'; o.frequency.setValueAtTime(f, at);
    const g = env(at, 0.1 * gain, 0.006, 0.9);
    o.connect(g); g.connect(bus); own(o, g);
    o.start(at); o.stop(at + 1.0);
  }

  /** El tono que sube y avisa que algo va a pasar. Sierra y ruido, juntos. */
  function riser(at, dur = 1.9, gain = 1) {
    const o = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(64, at);
    o.frequency.exponentialRampToValueAtTime(760, at + dur);
    lp.type = 'lowpass'; lp.Q.value = 10;
    lp.frequency.setValueAtTime(240, at);
    lp.frequency.exponentialRampToValueAtTime(3200, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.13 * gain, at + dur * 0.94);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(lp); lp.connect(g); g.connect(bus); own(o, lp, g);
    o.start(at); o.stop(at + dur + 0.05);

    const s = src(at, dur);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(400, at);
    hp.frequency.exponentialRampToValueAtTime(9000, at + dur);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, at);
    sg.gain.exponentialRampToValueAtTime(0.06 * gain, at + dur * 0.94);
    sg.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(hp); hp.connect(sg); sg.connect(bus); own(s, hp, sg);
  }

  /** El impacto: ruido que se abre de golpe y un sub que se cae por un pozo. */
  function impact(at, gain = 1) {
    const s = src(at, 0.9);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(9000, at);
    lp.frequency.exponentialRampToValueAtTime(320, at + 0.55);
    const g = env(at, 0.3 * gain, 0.002, 0.8);
    s.connect(lp); lp.connect(g); g.connect(bus); own(s, lp, g);

    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, at);
    o.frequency.exponentialRampToValueAtTime(26, at + 0.5);
    const og = env(at, 0.42 * gain, 0.004, 1.0);
    o.connect(og); og.connect(bus); own(o, og);
    o.start(at); o.stop(at + 1.1);
  }

  /** El golpe hueco con el que cae el cero: grave, seco y sin brillo. Es una puerta. */
  function thud(at, gain = 1) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(78, at);
    o.frequency.exponentialRampToValueAtTime(30, at + 0.34);
    const g = env(at, 0.46 * gain, 0.003, 0.9);
    o.connect(g); g.connect(bus); own(o, g);
    o.start(at); o.stop(at + 1.0);
    const s = src(at, 0.12);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900;
    const sg = env(at, 0.12 * gain, 0.001, 0.1);
    s.connect(lp); lp.connect(sg); sg.connect(bus); own(s, lp, sg);
  }

  /** Una nota de metal: el trombón. El chiste no es la nota, es el doblez. */
  function brass(at, from, to, dur, gain) {
    const o = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(from, at);
    if (to !== from) o.frequency.exponentialRampToValueAtTime(to, at + dur * 0.9);
    lp.type = 'lowpass'; lp.Q.value = 7;
    lp.frequency.setValueAtTime(from * 6, at);
    lp.frequency.exponentialRampToValueAtTime(Math.max(180, from * 1.6), at + dur);
    const g = env(at, gain, 0.055, dur * 0.3, dur * 0.55);
    o.connect(lp); lp.connect(g); g.connect(bus); own(o, lp, g);
    o.start(at); o.stop(at + dur + 0.05);
  }

  /** El acorde del título: cinco voces desafinadas entre sí que se abren despacio. */
  function chord(at, freqs, dur = 6) {
    freqs.forEach((f, i) => {
      for (const detune of [-5, 5]) {
        const o = ctx.createOscillator();
        o.type = i === 0 ? 'sine' : 'sawtooth';
        o.frequency.value = f;
        o.detune.value = detune;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 2400;
        const g = env(at, (i === 0 ? 0.13 : 0.045), 0.7 + i * 0.12, dur * 0.7, dur * 0.2);
        o.connect(lp); lp.connect(g); g.connect(bus); own(o, lp, g);
        o.start(at); o.stop(at + dur + 0.4);
      }
    });
  }

  const VOICES = { kick, sub, snare, hat, stab, ding, riser, impact, thud, brass, chord };

  return {
    /** Prepara el audio con un toque del usuario y clava el origen del reloj. */
    arm(filmT = 0) {
      if (!ready()) return;
      origin = ctx.currentTime + 0.08 - filmT;
      cursor = 0;
    },
    /** Vuelve a alinear el reloj del audio con el de la película (rebobinar, repetir). */
    rewind(filmT) {
      if (!ctx) return;
      this.cut();
      origin = ctx.currentTime + 0.05 - filmT;
      cursor = CUES.findIndex((c) => c.t >= filmT);
      if (cursor < 0) cursor = CUES.length;
    },
    /**
     * Programa lo que entra en el próximo medio segundo. Se llama una vez por cuadro y
     * es lo único que el guion le pide al sonido: mirar adelante, no llegar tarde.
     */
    pump(filmT) {
      if (!ctx || !wants()) return;
      const until = filmT + 0.5;
      while (cursor < CUES.length && CUES[cursor].t < until) {
        const cue = CUES[cursor++];
        const at = origin + cue.t;
        if (at < ctx.currentTime - 0.05) continue; // ya pasó: se saltea, no se atropella
        VOICES[cue.v]?.(at, ...cue.a);
      }
    },
    /** Silencio inmediato: lo programado se desconecta sin esperar su cola. */
    cut() {
      for (const n of live) { try { n.stop?.(); } catch { /* no era una fuente */ } try { n.disconnect(); } catch { /* ya estaba */ } }
      live = [];
    },
    stop() { this.cut(); ctx?.close?.(); ctx = null; bus = null; noise = null; },
  };
}

// ---- la partitura --------------------------------------------------------------
//
// Escrita compás por compás. 120 golpes por minuto: la negra es media décima justa, el
// compás son dos segundos, y los treinta segundos son quince compases redondos. Que los
// cortes de imagen caigan en la negra no es prolijidad: es lo que hace que un montaje
// de trece placas en cinco segundos se lea como una frase y no como un parpadeo.
const CUES = (() => {
  const c = [];
  const put = (t, v, ...a) => { c.push({ t, v, a }); };
  /** Una tanda pareja de golpes entre `a` y `b`, cada `step`. */
  const every = (a, b, step, fn) => { for (let t = a, i = 0; t < b - 1e-6; t += step, i++) fn(t, i); };

  // acto 0 — la apertura
  put(0.50, 'kick', 1.0); put(0.50, 'impact', 0.45); put(0.50, 'hat', 0.8, true);
  put(1.00, 'kick', 0.6); put(1.00, 'stab', N.D3, 0.14, 0.6);
  put(1.50, 'kick', 1.0); put(1.50, 'impact', 0.7); put(1.50, 'sub', N.D1, 1.6, 0.9);

  // acto 1 — la cadena: el groove entra y no se va hasta el corte
  every(1.50, 4.00, 0.25, (t, i) => put(t, 'hat', i % 2 ? 0.34 : 0.62));
  for (const t of [2.50, 3.50]) put(t, 'kick', 0.85);
  for (const t of [2.00, 3.00]) put(t, 'snare', 0.7);
  put(2.50, 'sub', N.D1, 0.9, 0.7); put(3.50, 'sub', N.F1, 0.9, 0.7);
  [N.D3, N.F3, N.A3, N.C4, N.D4].forEach((f, i) => put(1.50 + i * 0.5, 'stab', f, 0.17, 0.75));

  // acto 2 — la regla: corta el groove, queda el aire y las seis barras suben
  put(4.00, 'impact', 0.55); put(4.00, 'sub', N.D2, 2.2, 0.8);
  every(4.00, 6.50, 0.25, (t, i) => put(t, 'hat', i % 2 ? 0.22 : 0.4));
  [N.D4, N.E4, N.F4, N.A4, N.C4 * 2, N.D4 * 2].forEach((f, i) => put(4.60 + i * 0.13, 'ding', f, 0.5));
  put(5.60, 'ding', N.D4 * 2, 0.45);
  put(6.10, 'riser', 0.42, 0.7);
  put(6.50, 'kick', 1.0); put(6.50, 'sub', N.D1, 1.0, 0.8);

  // acto 3 — la escalada: el bombo se acelera de negra a semicorchea
  every(6.50, 8.00, 0.50, (t) => put(t, 'kick', 0.85));
  every(8.00, 9.50, 0.375, (t) => put(t, 'kick', 0.9));
  every(9.50, 10.60, 0.28, (t) => put(t, 'kick', 0.95));
  every(10.60, 11.30, 0.20, (t, i) => put(t, 'kick', 0.8 + i * 0.05));
  every(6.50, 11.30, 0.125, (t, i) => put(t, 'hat', i % 4 === 0 ? 0.5 : 0.2));
  for (const t of [7.00, 8.00, 9.00, 10.00]) put(t, 'snare', 0.75);
  [N.A3, N.C4, N.D4, N.F4, N.A4].forEach((f, i) => put(7.00 + i * 0.5, 'stab', f, 0.2, 0.9));
  [N.D1, N.D1, N.F1, N.G1, N.A1].forEach((f, i) => put(7.00 + i * 0.5, 'sub', f, 0.5, 0.85));
  put(9.40, 'riser', 1.90, 1.0);

  // el silencio. Siete décimas sin una sola nota: no hay nada entre 11,30 y 12,00.

  // acto 4 — el corte
  put(12.00, 'impact', 1.0);
  put(12.06, 'sub', 30, 1.8, 0.7);          // la cola, que es lo único que queda sonando
  put(13.00, 'thud', 1.0);
  [[N.Bb3, N.Bb3, 0.20], [N.A3, N.A3, 0.20], [207.65, 207.65, 0.20]]
    .forEach(([f, to, d], i) => put(13.35 + i * 0.24, 'brass', f, to, d, 0.17));
  put(14.07, 'brass', N.G3, N.C3, 0.95, 0.20);
  put(14.35, 'snare', 0.9); put(14.35, 'kick', 0.7);

  // acto 5 — el arsenal: trece cortes, uno cada 380 milésimas
  for (let i = 0; i < 13; i++) {
    const t = 15.35 + i * 0.38;
    put(t, 'kick', 0.95);
    put(t, 'stab', N.D3 * 2 ** (i / 12), 0.2, 0.85);
    if (i % 4 === 3) put(t, 'snare', 0.8);
    put(t, 'sub', N.D1 * 2 ** ((i % 4) / 12), 0.36, 0.8);
  }
  every(15.35, 20.30, 0.125, (t, i) => put(t, 'hat', i % 2 ? 0.22 : 0.48));
  put(20.29, 'impact', 0.6); put(20.29, 'hat', 0.9, true);

  // acto 6 — el remate
  put(20.60, 'riser', 1.05, 0.9);
  every(20.60, 21.60, 0.125, (t, i) => put(t, 'hat', 0.2 + i * 0.05));
  put(20.90, 'kick', 1.0);
  [N.D4, N.F4, N.A4, N.D4 * 2].forEach((f, i) => put(20.95 + i * 0.14, 'stab', f, 0.18, 0.7));
  put(21.75, 'impact', 1.0); put(21.75, 'kick', 1.0); put(21.75, 'sub', N.D1, 2.2, 1.0);

  // acto 7 — el título
  put(22.45, 'chord', [N.D2, N.A2, N.D3, N.Fs3, N.A3], 6.4);
  put(23.40, 'ding', N.D4 * 2, 0.5);
  put(24.60, 'ding', N.A3 * 2, 0.5);
  put(25.80, 'ding', N.Fs3 * 2, 0.45);
  put(26.40, 'sub', N.D1, 2.4, 0.7);

  return c.sort((a, b) => a.t - b.t);
})();

// ---- el reparto ----------------------------------------------------------------
//
// Once cartas y una cadena de verdad. La primera abre dos rachas —bestia y pez—; de ahí
// en adelante cada carta trae bestia y una clase distinta, así que la racha ámbar se
// alarga y la de al lado se apaga en el acto. Eso es la regla entera dibujada sin una
// palabra: **la que sigue la racha la alarga, la que no, muere**.
//
// Los números salen de `scoreChain()` y son 2, 5, 10, 17, 26, 37, 50, 65, 82 y 101. No
// están elegidos: son lo que da la cuenta. Que el último sea 101 —uno más que la vida
// entera de un jugador— es una casualidad del cuadrado que le viene bárbaro al chiste.

const RUN = 'beast';
const DECK = [
  makeCard([RUN, 'aquatic']), makeCard([RUN, 'plant']), makeCard([RUN, 'bird']),
  makeCard([RUN, 'bug']), makeCard([RUN, 'reptile']), makeCard([RUN, 'aquatic']),
  makeCard([RUN, 'plant']), makeCard([RUN, 'bird']), makeCard([RUN, 'bug']),
  makeCard([RUN, 'reptile']),
];
/** La que corta: no trae bestia, y eso es todo lo que hace falta para perder 101. */
const BUST_CARD = makeCard(['plant', 'bird']);
/** La misma jugada del remate, pero esta vez entra. */
const SAVE_CARD = makeCard([RUN, 'bug']);

/** `CHAINS[n]` es la cadena con `n` cartas puestas. Se calculan una vez y no se tocan. */
const CHAINS = DECK.reduce((all, card) => [...all, playCard(all[all.length - 1], card)], [emptyChain()]);
const CHAIN_BUST = playCard(CHAINS[10], BUST_CARD);
const CHAIN_SAVE = playCard(CHAINS[10], SAVE_CARD);
const SCORE = CHAINS.map((c) => scoreChain(c).total);

/**
 * La cuenta escrita: `9² + 1² = 82`. Es la letra chica del contrato y es la de verdad
 * —sale del mismo desglose que la mesa usa para pintar el marcador—.
 */
function mathOf(chain) {
  const { total, breakdown } = scoreChain(chain);
  if (chain.busted || !breakdown.length) return '';
  return `${breakdown.map((r) => `${r.length}²`).join(' + ')} = ${total}`;
}

/**
 * La rueda de chances: qué fracción del pool común le sigue la cadena a esto. Es la misma
 * función que lee la mesa (`survivalOdds`) contra el mismo pool de 86 cartas, así que el
 * número que se ve es el que el juego le mostraría al jugador: con dos rachas vivas te
 * sirve media baraja, con una sola te sirve un tercio. La rueda no baja porque el spot
 * quiera dar miedo; baja porque cuando una racha muere, se te cierra medio mazo.
 */
const POOL = buildPool(null, makeRng(11));
const ODDS = CHAINS.map((c) => (c.cards.length ? survivalOdds(c, POOL).p : 1));

/** Cuándo aterriza cada carta. Todo cae en la negra: 120 golpes por minuto. */
const CARD_T = [1.50, 2.00, 2.50, 3.00, 3.50, 7.00, 7.50, 8.00, 8.50, 9.00];
const BUST_T = 12.00;   // la que corta
const SAVE_T = 20.90;   // la que entra
const DUR = 30.0;       // el spot, clavado

/** Las trece armas, ordenadas por color: dos por clase y el cohete neutral al final. */
const ARSENAL = ['strength', 'brutal', 'egg', 'feather', 'octopus', 'bubble',
  'pot', 'leaf', 'snail', 'leech', 'poison', 'steelskin', 'freegame'];
const REEL_T0 = 15.35;    // cuándo entra la primera
const REEL_STEP = 0.38;   // y cada cuánto corta a la siguiente

/** El orden canónico de las clases: es el que dibuja el anillo y el de las seis barras. */
const CYCLE = ['plant', 'beast', 'aquatic', 'bird', 'bug', 'reptile'];
/** 1, 4, 9, 16, 25, 36: la regla, sin cadena de por medio. */
const SQUARES = [1, 4, 9, 16, 25, 36];

/** Los renglones. `*así*` marca la palabra que se pinta. */
const LINES = [
  { id: 'cadena', tone: 'label', y: 888, text: 'CADENA', in: 1.80, out: 3.88 },
  { id: 'rule', tone: 'rule', y: 468, text: 'L²', in: 4.06, out: 4.58 },
  { id: 'ruleSub', tone: 'label', y: 700, text: 'LA CADENA PAGA AL CUADRADO', in: 4.30, out: 4.60 },
  { id: 'mas', tone: 'plate', y: 866, text: '¿UNA MÁS?', in: 7.55, out: 11.96 },
  { id: 'onada', tone: 'plate', y: 792, text: 'O NADA.', in: 14.35, out: 14.94 },
  { id: 'armas', tone: 'label', y: 214, text: 'TRECE ARMAS', in: 15.42, out: 20.24 },
  { id: 'tag1', tone: 'tag', y: 700, text: 'TODO LO QUE ENCADENÁS, *AL CUADRADO*.', in: 23.40, out: 29.30 },
  { id: 'tag2', tone: 'tag', y: 782, text: 'TODO LO QUE ARRIESGÁS, *A CERO*.', in: 24.60, out: 29.30 },
  { id: 'url', tone: 'url', y: 886, text: 'sindados.com.ar', in: 25.80, out: 29.30 },
];

// ---- el decorado ---------------------------------------------------------------
//
// Se arma una sola vez y después nadie vuelve a tocar la estructura del DOM: el director
// de más abajo solo escribe `transform`, `opacity` y variables de CSS. Crear o borrar
// nodos a mitad de una película es pedirle al navegador que rearme el layout justo en el
// cuadro que hay que entregar.

function buildSet() {
  const el = {
    frame: $('sp-frame'), comp: $('sp-comp'), sky: $('sp-sky'), rays: $('sp-rays'),
    world: $('sp-world'), floor: $('sp-floor'), stage: $('sp-stage'), ring: $('sp-ring'),
    chain: $('sp-chain'), bars: $('sp-bars'), reel: $('sp-reel'), logo: $('sp-logo'),
    under: $('sp-under'), over: $('sp-over'), score: $('sp-score'), num: $('sp-num'),
    math: $('sp-math'), dial: $('sp-dial'), arc: $('sp-dial-arc'), pct: $('sp-dial-pct'),
    type: $('sp-type'), grain: $('sp-grain'), vig: $('sp-vig'), flash: $('sp-flash'),
    lb: $('sp-lb'), track: $('sp-track-fill'),
  };
  const audio = createAudio();
  const score = createScore(() => audio.sfxOn || audio.musicOn);
  const calm = quiet();

  // ---- el dibujo de una carta, igual al de la mesa ----

  /** El mismo HTML que reparte `cardHtml()` en `ui.js`: nogal, símbolos y su estado. */
  function cardHtml(card, index, chain) {
    return card.symbols.map((s) => {
      const on = chain ? isScoringCell(chain, index, s) : false;
      return `<span class="sym" data-sym="${s}" data-on="${on}" style="--c:${SYMBOLS[s].color}">`
        + `<img class="crest" src="${SYMBOLS[s].crest}" alt=""></span>`;
    }).join('');
  }

  // ---- armado del decorado (una sola vez, y después nadie toca el DOM de estructura) ----

  const cards = [...DECK, BUST_CARD, SAVE_CARD].map((card, i) => {
    const node = document.createElement('div');
    node.className = 'card';
    node.innerHTML = cardHtml(card, Math.min(i, 10), null);
    node.style.display = 'none';
    el.chain.append(node);
    return node;
  });
  const BUST_I = 10;
  const SAVE_I = 11;

  const crests = CYCLE.map((id) => {
    const node = document.createElement('div');
    node.className = 'sp-crest';
    node.style.setProperty('--c', SYMBOLS[id].color);
    node.innerHTML = `<img src="${SYMBOLS[id].crest}" alt="">`;
    el.ring.append(node);
    return node;
  });

  const bars = SQUARES.map((v, i) => {
    const node = document.createElement('div');
    node.className = 'sp-bar';
    node.style.setProperty('--c', SYMBOLS[CYCLE[i]].color);
    node.style.left = `${960 + (i - 2.5) * 186}px`;
    node.style.height = `${(v / 36) * 430}px`;
    node.innerHTML = `<i></i><b>${v}</b>`;
    el.bars.append(node);
    return node;
  });

  const plates = ARSENAL.map((id) => {
    const p = POWERS[id];
    const c = SYMBOLS[p.symbol]?.color ?? '#f5c542';
    const kind = p.symbol ? SYMBOLS[p.symbol].name : tr('Neutral');
    const node = document.createElement('div');
    node.className = 'sp-card';
    node.style.setProperty('--c', c);
    node.innerHTML = `<div class="sp-card-bg"></div>`
      + `<img class="sp-card-ico" src="${iconUrl(`power-${id}.png`)}" alt="">`
      + `<div class="sp-card-name">${p.name}</div>`
      + `<div class="sp-card-kind">${kind}</div>`;
    el.reel.append(node);
    return { node, ico: node.querySelector('.sp-card-ico'), color: c };
  });

  /** Un renglón: cada palabra adentro de su propia máscara, para que entre subiendo. */
  const lines = LINES.map((spec) => {
    const node = document.createElement('div');
    node.className = 'sp-line';
    node.dataset.tone = spec.tone;
    node.style.top = `${spec.y}px`;
    node.innerHTML = tr(spec.text).split(' ').map((word) => {
      const hot = word.startsWith('*') || word.includes('*');
      const clean = word.replaceAll('*', '');
      return `<span class="sp-mask"><span>${hot ? `<em>${clean}</em>` : clean}</span></span>`;
    }).join('');
    el.type.append(node);
    return { ...spec, node, words: [...node.querySelectorAll('.sp-mask > span')] };
  });
  const byId = Object.fromEntries(lines.map((l) => [l.id, l]));

  /** Las dos mitades en las que se parte el número cuando la cadena se corta. */
  const shards = [0, 1].map((half) => {
    const node = document.createElement('b');
    node.className = 'sp-num';
    node.style.cssText = 'position:absolute;left:0;right:0;top:0;opacity:0;'
      + `clip-path:inset(${half ? '52% 0 0 0' : '0 0 48% 0'});`;
    el.score.prepend(node);
    return node;
  });

  // ---- las medidas ----
  //
  // Una sola lectura del navegador en toda la película. Después de esto nadie pregunta
  // por un `getBoundingClientRect`: las posiciones se calculan con la misma cuenta que
  // hace el `flex` —`i * (ancho + hueco)`, centrado— y por eso la capa de dibujo puede
  // poner una viga exactamente atrás de un símbolo sin tocar el layout ni una vez.
  const GAP = 20;
  let CW = 186, CH = 240, SYM_DY = [-52, 52];
  function measure() {
    cards[0].style.display = '';
    const card = cards[0].getBoundingClientRect();
    const fit = parseFloat(getComputedStyle(el.comp).getPropertyValue('--fit')) || 1;
    CW = card.width / fit; CH = card.height / fit;
    SYM_DY = [...cards[0].querySelectorAll('.sym')].map((s) => {
      const r = s.getBoundingClientRect();
      return (r.top + r.height / 2 - (card.top + card.height / 2)) / fit;
    });
    cards[0].style.display = 'none';
  }

  const rowW = (n) => n * CW + (n - 1) * GAP;
  /** La fila nunca pasa de 1560 px de ancho: cuanto más te llevás, más lejos te parás. */
  const fitFor = (n) => (n <= 1 ? 1 : Math.min(1, 1560 / rowW(n)));
  const ROW_Y = 620;

  /** El centro de la carta `i` cuando hay `n` puestas, en píxeles de película. */
  const homeX = (i, n, s) => 960 + (i * (CW + GAP) + CW / 2 - rowW(n) / 2) * s;

  /** Cuántas cartas hay puestas en el segundo `t`. */
  function cardsAt(t) {
    if (t >= SAVE_T) return 11;
    if (t >= BUST_T) return 11;
    let n = 0;
    for (const T of CARD_T) if (t >= T) n++;
    return n;
  }

  /** La escala de la fila, que se reacomoda sola con cada carta. */
  const ROW_S = (() => {
    const keys = [[0, 1]];
    CARD_T.forEach((T, i) => { keys.push([T, fitFor(i || 1)], [T + 0.26, fitFor(i + 1), E.outExpo]); });
    keys.push([BUST_T, fitFor(10)], [BUST_T + 0.2, fitFor(11), E.outExpo]);
    return keys;
  })();

  return { el, audio, score, calm, cards, crests, bars, plates, lines, byId, shards,
    measure, cardsAt, homeX, rowW, fitFor, ROW_S, ROW_Y, GAP, BUST_I, SAVE_I,
    geom: () => ({ CW, CH, SYM_DY }) };
}

// ---- el director ---------------------------------------------------------------
//
// Acá está el guion entero, y se lee de arriba abajo como un guion: primero la cámara,
// después el fondo, después lo que pasa en la mesa, después lo que se lee, y al final el
// revelado. `seek(t)` es una función sin memoria: entra un segundo y sale un cuadro.

function createSpot() {
  const set = buildSet();
  const { el, audio, score, calm, cards, crests, bars, plates, lines, byId, shards } = set;
  const { cardsAt, homeX, ROW_S, ROW_Y, BUST_I, SAVE_I } = set;

  const Q = Math.min(2, globalThis.devicePixelRatio || 1);
  const cu = el.under.getContext('2d');
  const co = el.over.getContext('2d');
  for (const c of [el.under, el.over]) { c.width = 1920 * Q; c.height = 1080 * Q; }
  cu.scale(Q, Q); co.scale(Q, Q);

  const BEAM_C = SYMBOLS[RUN].color;

  /** Los segundos en los que la mesa existe. Afuera de estos tramos no hay fila. */
  const rowAlive = (t) => (t >= 1.24 && t < 4.00) || (t >= 6.50 && t < 13.60)
    || (t >= 20.60 && t < 22.10);

  /** El aterrizaje de cada carta, incluidas la que corta y la que salva. */
  const landOf = (i) => (i === BUST_I ? BUST_T : i === SAVE_I ? SAVE_T : CARD_T[i]);

  // ---- la cámara ----
  //
  // Un solo acercamiento largo durante la escalada —de 1 a 1,16 en cinco segundos, que
  // no se ve mientras pasa y se siente todo el tiempo—, el tirón del corte, y el puñetazo
  // del remate. Nada más. Una cámara que se mueve en cada plano no tiene intención.
  const CAM_S = [[0, 1], [6.50, 1], [11.30, 1.16, E.inOutCubic], [11.96, 1.20],
    [12.00, 1.36, E.outExpo], [13.60, 1.0, E.inOutCubic], [21.58, 1.0],
    [21.66, 0.94, E.outQuad], [21.75, 1.62, E.outExpo], [22.10, 1.0, E.inCubic], [30, 1]];
  const CAM_HAND = [[0, 0], [6.50, 2], [9.00, 7], [11.30, 13], [12.00, 0], [30, 0]];
  const CAM_SAT = [[0, 1], [8.50, 1], [11.30, 0.62], [12.00, 0.5], [12.10, 0.1],
    [15.00, 0.1], [20.60, 1], [30, 1]];

  /** Todos los golpes de cámara del spot, sumados. Cada carta pega un poco más fuerte. */
  function quake(t) {
    let k = 0;
    CARD_T.forEach((T, i) => { k += shake(t, T, 5 + i * 1.6, 0.34, i); });
    k += shake(t, 1.50, 16, 0.5, 21);
    k += shake(t, 4.00, 12, 0.4, 22);
    k += shake(t, 12.00, 46, 0.75, 23);
    k += shake(t, 13.00, 26, 0.6, 24);
    k += shake(t, 14.35, 14, 0.35, 25);
    k += shake(t, SAVE_T, 18, 0.4, 26);
    k += shake(t, 21.75, 54, 0.9, 27);
    for (let i = 0; i < 13; i++) k += shake(t, REEL_T0 + i * REEL_STEP, 6, 0.16, 30 + i);
    return calm ? 0 : k;
  }

  // ---- el fondo ----
  //
  // El color del cielo cambia en el corte y no de a poco: los actos de este spot están
  // cortados, no fundidos, y un fondo que se disuelve delata que atrás no pasó nada.
  const SKY = [
    [0.00, '#151d46', '#2e1450'], [1.50, '#2a3a8c', '#6a1f5c'], [4.00, '#16276e', '#2b1060'],
    [6.50, '#2f2a7a', '#5c1a4a'], [9.00, '#5c1330', '#6b1a12'], [12.00, '#0a0a12', '#0a0a12'],
    [15.35, '#0a0a12', '#0a0a12'], [20.60, '#6b4a12', '#8c2a1f'], [22.40, '#1d2a6e', '#4a1c68'],
  ];
  /** El último valor cuyo segundo ya pasó. Para lo que cambia de golpe y no se interpola. */
  const pick = (t, keys) => {
    let v = keys[0];
    for (const k of keys) if (t >= k[0]) v = k;
    return v;
  };

  // ---- la capa de dibujo ----

  /** La viga de la racha: una sola barra ámbar que corre por detrás de toda la cadena. */
  function drawBeam(t, n, s) {
    if (n < 2) return;
    const { SYM_DY } = set.geom();
    const y = ROW_Y + SYM_DY[0] * s;
    const x0 = homeX(0, n, s);
    // Hasta dónde llegó: la punta viaja a la carta nueva en dos décimas y ahí se queda.
    const last = Math.min(n, 11) - 1;
    const T = landOf(last);
    const grow = E.outExpo(span(t, T, T + 0.2));
    const x1 = lerp(homeX(Math.max(0, last - 1), n, s), homeX(last, n, s), grow);
    const w = 22 * s;

    cu.save();
    cu.lineCap = 'round';
    cu.strokeStyle = BEAM_C;
    cu.shadowColor = BEAM_C;
    cu.shadowBlur = 42 * s;
    cu.globalAlpha = 0.9;
    cu.lineWidth = w;
    cu.beginPath(); cu.moveTo(x0, y); cu.lineTo(x1, y); cu.stroke();
    // El brillo de adentro, que es lo que la hace parecer encendida y no pintada.
    cu.globalAlpha = 0.85;
    cu.strokeStyle = '#fff6df';
    cu.lineWidth = w * 0.3;
    cu.beginPath(); cu.moveTo(x0, y); cu.lineTo(x1, y); cu.stroke();
    // La punta, mientras viaja.
    if (grow < 1) {
      cu.globalAlpha = 1;
      cu.fillStyle = '#fff';
      cu.beginPath(); cu.arc(x1, y, w * 0.8, 0, Math.PI * 2); cu.fill();
    }
    cu.restore();
  }

  /** Chispas: una parábola resuelta por partícula, sin un solo estado vivo. */
  function burst(t, t0, x, y, { n = 26, spread = Math.PI * 2, a0 = 0, speed = 900,
    g = 2200, life = 0.75, size = 5, color = '#ffd88a' } = {}) {
    const τ = t - t0;
    if (τ < 0 || τ > life) return;
    co.save();
    co.fillStyle = color;
    co.shadowColor = color;
    co.shadowBlur = 18;
    for (let i = 0; i < n; i++) {
      const a = a0 + (hash(Math.round(t0 * 1000), i) - 0.5) * spread;
      const sp = speed * (0.35 + hash(Math.round(t0 * 1000), i + 401) * 1.1);
      const px = x + Math.cos(a) * sp * τ;
      const py = y + Math.sin(a) * sp * τ + 0.5 * g * τ * τ;
      const k = 1 - τ / life;
      co.globalAlpha = k * k;
      co.beginPath(); co.arc(px, py, size * k + 1, 0, Math.PI * 2); co.fill();
    }
    co.restore();
  }

  /** La onda del impacto: un aro que se abre y se afina. */
  function ring(t, t0, x, y, { r0 = 20, r1 = 330, life = 0.5, color = '#fff', w = 9 } = {}) {
    const τ = t - t0;
    if (τ < 0 || τ > life) return;
    const p = τ / life;
    co.save();
    co.globalAlpha = (1 - p) ** 2;
    co.strokeStyle = color;
    co.lineWidth = w * (1 - p) + 1;
    co.shadowColor = color; co.shadowBlur = 20;
    co.beginPath(); co.arc(x, y, lerp(r0, r1, E.outQuart(p)), 0, Math.PI * 2); co.stroke();
    co.restore();
  }

  /** Las líneas de velocidad: el cuadro entero tirando hacia el centro. */
  function speedlines(t, t0, life, { n = 60, color = '#fff', alpha = 0.5 } = {}) {
    const τ = t - t0;
    if (τ < 0 || τ > life) return;
    const p = τ / life;
    co.save();
    co.strokeStyle = color;
    co.globalAlpha = (1 - p) * alpha;
    co.lineWidth = 3;
    for (let i = 0; i < n; i++) {
      const a = hash(i, 7) * Math.PI * 2;
      const r0 = 300 + hash(i, 11) * 900 - p * 420;
      const len = 120 + hash(i, 13) * 300;
      co.beginPath();
      co.moveTo(960 + Math.cos(a) * r0, 540 + Math.sin(a) * r0);
      co.lineTo(960 + Math.cos(a) * (r0 + len), 540 + Math.sin(a) * (r0 + len));
      co.stroke();
    }
    co.restore();
  }

  /** El polvo del aire: no se mira, se extraña cuando no está. */
  function dust(t, alpha) {
    if (alpha <= 0.002 || calm) return;
    co.save();
    co.fillStyle = '#ffeccd';
    for (let i = 0; i < 70; i++) {
      const sp = 14 + hash(i, 3) * 26;
      const x = (hash(i, 1) * 2100 + t * sp) % 2100 - 90;
      const y = (hash(i, 2) * 1200 + Math.sin(t * 0.6 + i) * 30 + 1200) % 1200 - 60;
      co.globalAlpha = alpha * (0.2 + hash(i, 4) * 0.8);
      co.beginPath(); co.arc(x, y, 1 + hash(i, 5) * 2.6, 0, Math.PI * 2); co.fill();
    }
    co.restore();
  }

  /** La curva de la regla, dibujándose sobre las puntas de las seis barras. */
  function curve(t) {
    const p = E.outCubic(span(t, 5.60, 6.05));
    if (p <= 0 || t > 6.20) return;
    cu.save();
    cu.strokeStyle = '#fff';
    cu.shadowColor = '#fff'; cu.shadowBlur = 24;
    cu.lineWidth = 6; cu.lineCap = 'round';
    cu.globalAlpha = 0.9 * (1 - span(t, 6.10, 6.20));
    cu.beginPath();
    const N = 80;
    for (let i = 0; i <= N * p; i++) {
      const u = i / N;                       // 0..1 sobre las seis barras
      const x = 960 + (u * 5 - 2.5) * 186;
      const v = (u * 5 + 1) ** 2;            // el cuadrado, que es de lo que habla la placa
      const y = 1080 - 300 - (v / 36) * 430;
      i ? cu.lineTo(x, y) : cu.moveTo(x, y);
    }
    cu.stroke();
    cu.restore();
  }

  function paint(t, n, s) {
    cu.clearRect(0, 0, 1920, 1080);
    co.clearRect(0, 0, 1920, 1080);

    dust(t, track(t, [[0, 0], [1.5, 0.25], [11.3, 0.5], [12.1, 0], [20.6, 0.2], [22.2, 0], [30, 0]]));

    if (rowAlive(t) && t < 12.06) drawBeam(t, n, s);
    curve(t);

    // El golpe de cada carta: aro, chispas y un puñado de tierra.
    const upto = t >= SAVE_T ? [...CARD_T, SAVE_T] : t >= BUST_T ? [...CARD_T, BUST_T] : CARD_T;
    upto.forEach((T, i) => {
      if (t < T || t > T + 0.8) return;
      const x = homeX(i, n, s);
      const y = ROW_Y + set.geom().CH * s * 0.5;
      ring(t, T, x, y, { r1: 200 + i * 22, color: i === 10 && t >= BUST_T && t < SAVE_T ? '#ff6a5c' : BEAM_C });
      burst(t, T, x, y, { n: 16 + i * 2, a0: -Math.PI / 2, spread: Math.PI * 1.2,
        speed: 520 + i * 60, life: 0.6, color: BEAM_C, size: 4 });
    });

    // El corte: todo para afuera, en blanco, y después nada.
    if (t >= 12.00 && t < 13.10) {
      ring(t, 12.00, 960, ROW_Y, { r0: 40, r1: 1500, life: 0.8, color: '#fff', w: 26 });
      burst(t, 12.00, 960, ROW_Y, { n: 90, speed: 2000, g: 2400, life: 1.0, size: 8, color: '#ffffff' });
      speedlines(t, 12.00, 0.45, { n: 90, alpha: 0.75 });
    }
    // El cero cayendo.
    if (t >= 13.00 && t < 13.70) {
      ring(t, 13.00, 960, 470, { r0: 30, r1: 760, life: 0.6, color: '#ff6a5c', w: 16 });
      burst(t, 13.00, 960, 470, { n: 40, speed: 1100, g: 2600, life: 0.7, size: 6, color: '#ff8b7e' });
    }
    // El arsenal: un tirón de líneas por arma.
    for (let i = 0; i < 13; i++) {
      const T = REEL_T0 + i * REEL_STEP;
      if (t >= T && t < T + 0.14) speedlines(t, T, 0.14, { n: 44, color: plates[i].color, alpha: 0.8 });
    }
    // El remate.
    if (t >= 21.75 && t < 22.60) {
      ring(t, 21.75, 960, 470, { r0: 60, r1: 1900, life: 0.7, color: '#fff', w: 34 });
      burst(t, 21.75, 960, 470, { n: 120, speed: 2400, g: 1200, life: 0.85, size: 10, color: '#ffe6a8' });
      speedlines(t, 21.75, 0.5, { n: 110, alpha: 0.9 });
    }
  }
