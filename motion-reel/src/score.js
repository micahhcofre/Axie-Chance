// La banda de sonido del reel: música y efectos, escritos contra la imagen.
//
// Se sintetiza entera con la Web Audio API en un OfflineAudioContext (y los efectos
// del Origins Asset Kit, que se decodifican y se alinean por su pico). Nada se sortea:
// cada golpe cae en el tiempo exacto de `CUE`, el mismo reloj que usa la imagen.
//
// Son dos pasadas. La primera graba solo la música; la segunda la reproduce como una
// cinta —así se la puede frenar como a una cinta en el corte de Puffy (el "tape stop",
// que baja de tono hasta pararse)— y le suma los efectos y el master.
//
// La música: 128 negras por minuto, en re menor.
//   t 0-10    un colchón oscuro, dos caídas y el VS: entra el pulso
//   t 10-26   el turno que enseña: Dm | B♭ | F | C, liviano, una nota por carta
//   t 26-32   el redoble, el golpe y la vuelta
//   t 32-41   Puffy: medio tiempo, más flaco
//   t 41      el corte: la cinta se frena, vidrio, glitch. Silencio. Womp, womp.
//   t 48-84   los poderes: todo arriba, F | C | Dm | B♭ | F | C | Gm | A
//   t 84-92   el final arranca: Dm | B♭ y la escalera de las ocho cartas
//   t 92-103  no alcanza: latido, reloj, braams, riser y, a t 102, nada
//   t 103-112 el drop: Dm | B♭ | Gm con la melodía
//   t 112-124 el título: B♭ | C | Re MAYOR (la cadencia de héroe: ♭VI - ♭VII - I)
import { BEAT, DURATION, rng } from './core.js';
import { CUE, V_HIT, V_SECOND } from './script.js';

const T = (beat) => beat * BEAT;
const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
/** 'D4' → 293.66 Hz. */
const hz = (name) => {
  const m = name.match(/^([A-G][b#]?)(-?\d)$/);
  return 440 * 2 ** ((12 * (Number(m[2]) + 1) + NOTE[m[1]] - 69) / 12);
};

const CHORDS = {
  Dm: ['A3', 'D4', 'F4', 'A4', 'D5'],
  Bb: ['F3', 'Bb3', 'D4', 'F4', 'Bb4'],
  F: ['A3', 'C4', 'F4', 'A4', 'C5'],
  C: ['G3', 'C4', 'E4', 'G4', 'C5'],
  Gm: ['G3', 'Bb3', 'D4', 'G4', 'Bb4'],
  A: ['A3', 'C#4', 'E4', 'A4', 'C#5'],
  D: ['A3', 'D4', 'F#4', 'A4', 'D5'],
};

// ---------------------------------------------------------------------
// herramientas
// ---------------------------------------------------------------------

function makeTools(ctx, seed = 7) {
  const R = rng(seed);
  const sr = ctx.sampleRate;
  // ruido blanco sembrado, dos segundos, para todo lo que suena a aire
  const noise = ctx.createBuffer(2, sr * 2, sr);
  for (let c = 0; c < 2; c++) {
    const d = noise.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1;
  }
  // la sala: una respuesta al impulso que se oscurece a medida que se apaga
  const irLen = Math.floor(sr * 2.6);
  const ir = ctx.createBuffer(2, irLen, sr);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < irLen; i++) {
      const t = i / sr;
      const pre = t < 0.012 ? 0 : 1;
      const env = Math.exp(-t / 0.42) * pre;
      const k = 0.9 - 0.8 * Math.min(1, t / 2.2);
      lp += k * ((R() * 2 - 1) - lp);
      d[i] = lp * env;
    }
  }
  const verb = ctx.createConvolver();
  verb.buffer = ir;
  const verbIn = ctx.createGain();
  verbIn.gain.value = 1;
  verbIn.connect(verb);

  const node = (type, props = {}) => {
    const n = type === 'gain' ? ctx.createGain()
      : type === 'filter' ? ctx.createBiquadFilter()
        : type === 'pan' ? ctx.createStereoPanner()
          : type === 'shaper' ? ctx.createWaveShaper() : null;
    for (const [k, v] of Object.entries(props)) {
      if (n[k] instanceof AudioParam) n[k].value = v; else n[k] = v;
    }
    return n;
  };
  const curve = (k) => {
    const c = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      c[i] = Math.tanh(k * x) / Math.tanh(k);
    }
    return c;
  };
  const noiseSrc = (t, dur, rate = 1) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    s.loop = true;
    s.playbackRate.value = rate;
    s.start(t, R() * 1.5);
    s.stop(t + dur + 0.05);
    return s;
  };
  /** Una envolvente: sube en `a`, se sostiene `h` y se apaga con constante `r`. */
  const env = (g, t, peak, a, h, r, from = 0) => {
    g.gain.setValueAtTime(from, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    if (h > 0) g.gain.setValueAtTime(peak, t + a + h);
    g.gain.setTargetAtTime(0, t + a + h, r);
  };
  return { ctx, R, noise, verb, verbIn, node, curve, noiseSrc, env };
}

/** Manda una señal a la salida seca y a la sala. */
function out(tl, src, dest, { send = 0, pan = 0, gain = 1 } = {}) {
  const g = tl.node('gain', { gain });
  const p = tl.node('pan', { pan });
  src.connect(g).connect(p).connect(dest);
  if (send > 0) {
    const s = tl.node('gain', { gain: send });
    p.connect(s).connect(tl.verbIn);
  }
  return g;
}

// ---------------------------------------------------------------------
// las voces
// ---------------------------------------------------------------------

function kick(tl, dest, t, g = 1) {
  const { ctx } = tl;
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(170, t);
  o.frequency.exponentialRampToValueAtTime(55, t + 0.055);
  o.frequency.exponentialRampToValueAtTime(43, t + 0.35);
  const a = tl.node('gain');
  tl.env(a, t, 0.85 * g, 0.002, 0.03, 0.08);
  const sh = tl.node('shaper', { curve: tl.curve(1.8) });
  o.connect(a).connect(sh).connect(dest);
  o.start(t); o.stop(t + 0.7);
  const n = tl.noiseSrc(t, 0.03);
  const hp = tl.node('filter', { type: 'highpass', frequency: 3000 });
  const ng = tl.node('gain');
  tl.env(ng, t, 0.22 * g, 0.001, 0, 0.006);
  n.connect(hp).connect(ng).connect(dest);
}

function clap(tl, dest, t, g = 1) {
  for (let i = 0; i < 4; i++) {
    const d = t + i * 0.009;
    const n = tl.noiseSrc(d, 0.3);
    const bp = tl.node('filter', { type: 'bandpass', frequency: 1350, Q: 0.9 });
    const e = tl.node('gain');
    tl.env(e, d, (i === 3 ? 0.55 : 0.35) * g, 0.001, 0, i === 3 ? 0.07 : 0.008);
    out(tl, n.connect(bp).connect(e), dest, { send: 0.25 });
  }
}

function snare(tl, dest, t, g = 1) {
  const n = tl.noiseSrc(t, 0.3);
  const bp = tl.node('filter', { type: 'bandpass', frequency: 2200, Q: 0.6 });
  const e = tl.node('gain');
  tl.env(e, t, 0.45 * g, 0.001, 0, 0.055);
  out(tl, n.connect(bp).connect(e), dest, { send: 0.15 });
  const o = tl.ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(230, t);
  o.frequency.exponentialRampToValueAtTime(170, t + 0.06);
  const oe = tl.node('gain');
  tl.env(oe, t, 0.3 * g, 0.001, 0, 0.035);
  o.connect(oe).connect(dest);
  o.start(t); o.stop(t + 0.25);
}

function hat(tl, dest, t, g = 1, open = false) {
  const n = tl.noiseSrc(t, open ? 0.5 : 0.1);
  const hp = tl.node('filter', { type: 'highpass', frequency: 7500 });
  const pk = tl.node('filter', { type: 'peaking', frequency: 10500, gain: 6, Q: 1 });
  const e = tl.node('gain');
  tl.env(e, t, 0.3 * g, 0.001, 0, open ? 0.09 : 0.016);
  out(tl, n.connect(hp).connect(pk).connect(e), dest, { pan: 0.18, send: 0.05 });
}

function crash(tl, dest, t, g = 1) {
  const n = tl.noiseSrc(t, 2.5);
  const hp = tl.node('filter', { type: 'highpass', frequency: 4200 });
  const e = tl.node('gain');
  tl.env(e, t, 0.32 * g, 0.002, 0.02, 0.55);
  out(tl, n.connect(hp).connect(e), dest, { send: 0.3, pan: -0.1 });
}

function tom(tl, dest, t, f = 120, g = 1) {
  const o = tl.ctx.createOscillator();
  o.frequency.setValueAtTime(f * 1.6, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
  const e = tl.node('gain');
  tl.env(e, t, 0.5 * g, 0.002, 0, 0.12);
  out(tl, o.connect(e), dest, { send: 0.2 });
  o.start(t); o.stop(t + 0.7);
}

/** El sub: un seno, por nota. */
function sub(tl, dest, t, note, dur, g = 1) {
  const o = tl.ctx.createOscillator();
  o.frequency.value = hz(note);
  const e = tl.node('gain');
  tl.env(e, t, 0.17 * g, 0.006, Math.max(0, dur - 0.05), 0.04);
  o.connect(e).connect(dest);
  o.start(t); o.stop(t + dur + 0.3);
}

/** El bajo con cuerpo: dos sierras desafinadas, filtradas, con un poco de saturación. */
function reese(tl, dest, t, note, dur, g = 1, cutoff = 900) {
  const f = hz(note);
  const lp = tl.node('filter', { type: 'lowpass', Q: 2 });
  lp.frequency.setValueAtTime(cutoff * 2.2, t);
  lp.frequency.exponentialRampToValueAtTime(cutoff * 0.6, t + Math.min(dur, 0.25));
  const sh = tl.node('shaper', { curve: tl.curve(1.6) });
  const e = tl.node('gain');
  tl.env(e, t, 0.09 * g, 0.004, Math.max(0, dur - 0.04), 0.035);
  for (const det of [-9, 9]) {
    const o = tl.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.detune.value = det;
    o.connect(lp);
    o.start(t); o.stop(t + dur + 0.25);
  }
  lp.connect(sh).connect(e).connect(dest);
  sub(tl, dest, t, note, dur, 0.7 * g);
}

/** Un pluck: la nota de cada carta y los arpegios. */
function pluck(tl, dest, t, note, g = 1, { dur = 0.35, bright = 1, send = 0.3, pan = 0, type = 'sawtooth' } = {}) {
  const f = hz(note);
  const lp = tl.node('filter', { type: 'lowpass', Q: 4 });
  lp.frequency.setValueAtTime(Math.min(16000, f * 14 * bright), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.6), t + dur * 0.6);
  const e = tl.node('gain');
  tl.env(e, t, 0.2 * g, 0.002, 0, dur * 0.35);
  for (const [det, ty] of [[-6, type], [6, 'square']]) {
    const o = tl.ctx.createOscillator();
    o.type = ty;
    o.frequency.value = f;
    o.detune.value = det;
    o.connect(lp);
    o.start(t); o.stop(t + dur + 0.4);
  }
  out(tl, lp.connect(e), dest, { send, pan });
}

/** Una campanita: senos inarmónicos, para baldosas y brillos. */
function bell(tl, dest, t, note, g = 1, pan = 0) {
  const f = hz(note);
  const e = tl.node('gain');
  tl.env(e, t, 0.12 * g, 0.001, 0, 0.14);
  const mix = tl.node('gain', { gain: 1 });
  [[1, 1], [2.76, 0.35], [5.4, 0.12]].forEach(([k, a]) => {
    const o = tl.ctx.createOscillator();
    o.frequency.value = f * k;
    const og = tl.node('gain', { gain: a });
    o.connect(og).connect(mix);
    o.start(t); o.stop(t + 0.8);
  });
  out(tl, mix.connect(e), dest, { send: 0.35, pan });
}

/** El colchón: siete sierras desafinadas por nota, abiertas despacio. */
function pad(tl, dest, t, chord, dur, g = 1, { cutoff = 2400, attack = 0.25, release = 0.35, open = null } = {}) {
  const lp = tl.node('filter', { type: 'lowpass', Q: 0.7 });
  lp.frequency.setValueAtTime(open ? open[0] : cutoff, t);
  if (open) lp.frequency.exponentialRampToValueAtTime(open[1], t + dur);
  const e = tl.node('gain');
  tl.env(e, t, 0.024 * g, attack, Math.max(0, dur - attack), release);
  const left = tl.node('pan', { pan: -0.45 });
  const right = tl.node('pan', { pan: 0.45 });
  CHORDS[chord].forEach((note, ni) => {
    const f = hz(note);
    for (let k = 0; k < 5; k++) {
      const o = tl.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = (k - 2) * 11 + (ni % 2 ? 3 : -3);
      o.connect(k % 2 ? left : right);
      o.start(t); o.stop(t + dur + release * 5);
    }
  });
  const sum = tl.node('gain', { gain: 1 });
  left.connect(sum);
  right.connect(sum);
  out(tl, sum.connect(lp).connect(e), dest, { send: 0.35 });
}

/** Un acorde golpeado: lo mismo que el colchón, corto y brillante. */
function stab(tl, dest, t, chord, g = 1, bright = 1) {
  const lp = tl.node('filter', { type: 'lowpass', Q: 1.2 });
  lp.frequency.setValueAtTime(6500 * bright, t);
  lp.frequency.exponentialRampToValueAtTime(900, t + 0.28);
  const e = tl.node('gain');
  tl.env(e, t, 0.045 * g, 0.003, 0.03, 0.11);
  CHORDS[chord].forEach((note, ni) => {
    for (const det of [-12, 0, 12]) {
      const o = tl.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(note);
      o.detune.value = det + ni;
      o.connect(lp);
      o.start(t); o.stop(t + 0.9);
    }
  });
  out(tl, lp.connect(e), dest, { send: 0.4 });
}

/** El braam: bronce grave y sucio que se abre de golpe. */
function braam(tl, dest, t, notes, dur = 1.6, g = 1) {
  const lp = tl.node('filter', { type: 'lowpass', Q: 3 });
  lp.frequency.setValueAtTime(180, t);
  lp.frequency.exponentialRampToValueAtTime(2600, t + 0.12);
  lp.frequency.exponentialRampToValueAtTime(500, t + dur);
  const sh = tl.node('shaper', { curve: tl.curve(3) });
  const e = tl.node('gain');
  tl.env(e, t, 0.14 * g, 0.03, dur * 0.4, dur * 0.35);
  notes.forEach((note) => {
    for (const det of [-14, -4, 6, 15]) {
      const o = tl.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(note);
      o.detune.value = det;
      o.connect(lp);
      o.start(t); o.stop(t + dur * 2.2);
    }
  });
  out(tl, lp.connect(sh).connect(e), dest, { send: 0.45 });
}

/** La melodía del drop: una sierra con vibrato y un poco de portamento. */
function lead(tl, dest, t, note, dur, g = 1) {
  const f = hz(note);
  const lp = tl.node('filter', { type: 'lowpass', Q: 2 });
  lp.frequency.setValueAtTime(f * 10, t);
  lp.frequency.exponentialRampToValueAtTime(f * 4, t + 0.2);
  const e = tl.node('gain');
  tl.env(e, t, 0.1 * g, 0.006, Math.max(0, dur - 0.06), 0.06);
  const vib = tl.ctx.createOscillator();
  vib.frequency.value = 5.5;
  const vg = tl.node('gain', { gain: 0 });
  vg.gain.setValueAtTime(0, t);
  vg.gain.linearRampToValueAtTime(dur > 0.4 ? 14 : 4, t + Math.min(dur, 0.5));
  vib.connect(vg);
  for (const [ty, det] of [['sawtooth', -7], ['square', 7], ['sawtooth', 1200]]) {
    const o = tl.ctx.createOscillator();
    o.type = ty;
    o.frequency.value = f;
    o.detune.value = det;
    vg.connect(o.detune);
    const og = tl.node('gain', { gain: det === 1200 ? 0.25 : 1 });
    o.connect(og).connect(lp);
    o.start(t); o.stop(t + dur + 0.5);
  }
  vib.start(t); vib.stop(t + dur + 0.5);
  out(tl, lp.connect(e), dest, { send: 0.3 });
}

// ---- efectos sintetizados ----

/** El golpe grande: un seno que se cae por un pozo, ruido que se cierra y sala. */
function impact(tl, dest, t, g = 1, { low = 58, dur = 1.2 } = {}) {
  const o = tl.ctx.createOscillator();
  o.frequency.setValueAtTime(low * 3, t);
  o.frequency.exponentialRampToValueAtTime(low, t + 0.09);
  o.frequency.exponentialRampToValueAtTime(low * 0.85, t + dur);
  const e = tl.node('gain');
  tl.env(e, t, 0.5 * g, 0.003, 0.06, dur * 0.2);
  const sh = tl.node('shaper', { curve: tl.curve(2.2) });
  out(tl, o.connect(e).connect(sh), dest, { send: 0.2 });
  o.start(t); o.stop(t + dur + 1);
  const n = tl.noiseSrc(t, dur);
  const lp = tl.node('filter', { type: 'lowpass', Q: 0.8 });
  lp.frequency.setValueAtTime(9000, t);
  lp.frequency.exponentialRampToValueAtTime(260, t + dur * 0.5);
  const ne = tl.node('gain');
  tl.env(ne, t, 0.4 * g, 0.002, 0.02, dur * 0.16);
  out(tl, n.connect(lp).connect(ne), dest, { send: 0.55 });
}

/** El platillo al revés: una ola de aire que crece hasta el golpe. */
function swell(tl, dest, t1, dur, g = 1, bright = 1) {
  const t0 = t1 - dur;
  const n = tl.noiseSrc(t0, dur);
  const hp = tl.node('filter', { type: 'highpass', frequency: 2500 * bright });
  const bp = tl.node('filter', { type: 'lowpass' });
  bp.frequency.setValueAtTime(3000, t0);
  bp.frequency.exponentialRampToValueAtTime(14000, t1);
  const e = tl.node('gain');
  e.gain.setValueAtTime(0.0001, t0);
  e.gain.exponentialRampToValueAtTime(0.35 * g, t1 - 0.01);
  e.gain.linearRampToValueAtTime(0, t1);
  out(tl, n.connect(hp).connect(bp).connect(e), dest, { send: 0.3 });
}

/** El riser: ruido que sube y una sierra que sube dos octavas. */
function riser(tl, dest, t0, t1, g = 1) {
  const dur = t1 - t0;
  const n = tl.noiseSrc(t0, dur);
  const bp = tl.node('filter', { type: 'bandpass', Q: 1.5 });
  bp.frequency.setValueAtTime(300, t0);
  bp.frequency.exponentialRampToValueAtTime(9000, t1);
  const e = tl.node('gain');
  e.gain.setValueAtTime(0.0001, t0);
  e.gain.exponentialRampToValueAtTime(0.28 * g, t1 - 0.02);
  e.gain.linearRampToValueAtTime(0, t1);
  out(tl, n.connect(bp).connect(e), dest, { send: 0.35 });
  const o = tl.ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(110, t0);
  o.frequency.exponentialRampToValueAtTime(880, t1);
  const lp = tl.node('filter', { type: 'lowpass', Q: 5 });
  lp.frequency.setValueAtTime(400, t0);
  lp.frequency.exponentialRampToValueAtTime(5000, t1);
  const oe = tl.node('gain');
  oe.gain.setValueAtTime(0.0001, t0);
  oe.gain.exponentialRampToValueAtTime(0.07 * g, t1 - 0.02);
  oe.gain.linearRampToValueAtTime(0, t1);
  out(tl, o.connect(lp).connect(oe), dest, { send: 0.3 });
  o.start(t0); o.stop(t1 + 0.05);
}

/** Un zumbido de aire que pasa: para cartas que vuelan y cortes de cámara. */
function whoosh(tl, dest, t, dur = 0.3, g = 1, { from = 500, to = 4000, pan = 0 } = {}) {
  const n = tl.noiseSrc(t, dur);
  const bp = tl.node('filter', { type: 'bandpass', Q: 2.2 });
  bp.frequency.setValueAtTime(from, t);
  bp.frequency.exponentialRampToValueAtTime(to, t + dur);
  const e = tl.node('gain');
  e.gain.setValueAtTime(0.0001, t);
  e.gain.exponentialRampToValueAtTime(0.3 * g, t + dur * 0.7);
  e.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const p = tl.node('pan');
  p.pan.setValueAtTime(-pan, t);
  p.pan.linearRampToValueAtTime(pan, t + dur);
  n.connect(bp).connect(e).connect(p).connect(dest);
  const s = tl.node('gain', { gain: 0.2 });
  p.connect(s).connect(tl.verbIn);
}

function heartbeat(tl, dest, t, g = 1) {
  [[0, 62, 1], [0.17, 52, 0.7]].forEach(([d, f, a]) => {
    const o = tl.ctx.createOscillator();
    o.frequency.setValueAtTime(f * 1.8, t + d);
    o.frequency.exponentialRampToValueAtTime(f, t + d + 0.04);
    const e = tl.node('gain');
    tl.env(e, t + d, 0.45 * g * a, 0.004, 0.02, 0.06);
    const lp = tl.node('filter', { type: 'lowpass', frequency: 180 });
    o.connect(lp).connect(e).connect(dest);
    o.start(t + d); o.stop(t + d + 0.5);
  });
}

function tick(tl, dest, t, g = 1, high = true) {
  const o = tl.ctx.createOscillator();
  o.frequency.value = high ? 2400 : 1600;
  const e = tl.node('gain');
  tl.env(e, t, 0.08 * g, 0.0005, 0, 0.008);
  out(tl, o.connect(e), dest, { pan: high ? 0.25 : -0.25, send: 0.1 });
  o.start(t); o.stop(t + 0.08);
}

/** Vidrio que se rompe: un golpe de ruido y veinte astillas resonantes. */
function shatterSfx(tl, dest, t, g = 1) {
  const n = tl.noiseSrc(t, 0.8);
  const hp = tl.node('filter', { type: 'highpass', frequency: 2500 });
  const e = tl.node('gain');
  tl.env(e, t, 0.45 * g, 0.001, 0.01, 0.12);
  out(tl, n.connect(hp).connect(e), dest, { send: 0.3 });
  for (let i = 0; i < 26; i++) {
    const d = t + tl.R() * 0.5 * tl.R();
    const s = tl.noiseSrc(d, 0.3);
    const bp = tl.node('filter', { type: 'bandpass', frequency: 3000 + tl.R() * 7000, Q: 25 });
    const se = tl.node('gain');
    tl.env(se, d, 0.9 * g * (0.4 + tl.R() * 0.6), 0.0005, 0, 0.02 + tl.R() * 0.06);
    out(tl, s.connect(bp).connect(se), dest, { pan: tl.R() * 1.6 - 0.8, send: 0.25 });
  }
}

/** El glitch del corte: ráfagas cortadas a golpes de compuerta. */
function glitch(tl, dest, t0, dur, g = 1) {
  const steps = Math.floor(dur / 0.028);
  for (let i = 0; i < steps; i++) {
    if (tl.R() < 0.35) continue;
    const d = t0 + i * 0.028;
    const o = tl.ctx.createOscillator();
    o.type = tl.R() < 0.5 ? 'square' : 'sawtooth';
    o.frequency.value = 80 * 2 ** (tl.R() * 5);
    const e = tl.node('gain');
    tl.env(e, d, 0.07 * g, 0.001, 0.015, 0.004);
    const sh = tl.node('shaper', { curve: tl.curve(6) });
    out(tl, o.connect(sh).connect(e), dest, { pan: tl.R() * 1.4 - 0.7 });
    o.start(d); o.stop(d + 0.05);
  }
}

/** Un "boing": el salto de un Axie. */
function boing(tl, dest, t, g = 1, base = 300) {
  const o = tl.ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(base, t);
  o.frequency.exponentialRampToValueAtTime(base * 2.6, t + 0.09);
  o.frequency.exponentialRampToValueAtTime(base * 1.4, t + 0.22);
  const e = tl.node('gain');
  tl.env(e, t, 0.14 * g, 0.004, 0.05, 0.06);
  out(tl, o.connect(e), dest, { send: 0.2 });
  o.start(t); o.stop(t + 0.5);
}

/** El "womp" del que se cortó: bronce que se cae. */
function womp(tl, dest, t, from, to, dur, g = 1) {
  const lp = tl.node('filter', { type: 'lowpass', Q: 6 });
  lp.frequency.setValueAtTime(300, t);
  lp.frequency.exponentialRampToValueAtTime(1500, t + 0.1);
  lp.frequency.exponentialRampToValueAtTime(260, t + dur);
  const e = tl.node('gain');
  tl.env(e, t, 0.2 * g, 0.03, dur * 0.6, dur * 0.2);
  const vib = tl.ctx.createOscillator();
  vib.frequency.value = 6;
  const vg = tl.node('gain', { gain: 0 });
  vg.gain.setValueAtTime(0, t);
  vg.gain.linearRampToValueAtTime(30, t + dur);
  vib.connect(vg);
  for (const det of [-8, 8]) {
    const o = tl.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(hz(from), t);
    o.frequency.exponentialRampToValueAtTime(hz(to), t + dur * 0.9);
    o.detune.value = det;
    vg.connect(o.detune);
    o.connect(lp);
    o.start(t); o.stop(t + dur + 0.6);
  }
  vib.start(t); vib.stop(t + dur + 0.6);
  out(tl, lp.connect(e), dest, { send: 0.3 });
}

/** Un bip que busca (el haz de Puffy) y la chicharra del "no". */
function scanBleep(tl, dest, t, g = 1) {
  const o = tl.ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(700, t);
  o.frequency.exponentialRampToValueAtTime(1400, t + 0.3);
  const lfo = tl.ctx.createOscillator();
  lfo.frequency.value = 24;
  const lg = tl.node('gain', { gain: 60 });
  lfo.connect(lg).connect(o.frequency);
  const e = tl.node('gain');
  tl.env(e, t, 0.07 * g, 0.01, 0.25, 0.04);
  out(tl, o.connect(e), dest, { send: 0.2 });
  o.start(t); lfo.start(t); o.stop(t + 0.5); lfo.stop(t + 0.5);
}
function buzzer(tl, dest, t, g = 1) {
  for (const f of [110, 116.5]) {
    const o = tl.ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = f;
    const lp = tl.node('filter', { type: 'lowpass', frequency: 1400 });
    const e = tl.node('gain');
    tl.env(e, t, 0.07 * g, 0.004, 0.2, 0.03);
    out(tl, o.connect(lp).connect(e), dest, { send: 0.1 });
    o.start(t); o.stop(t + 0.5);
  }
}

/** El chasquido eléctrico de una viga que se engancha. */
function zap(tl, dest, t, g = 1, pan = 0) {
  const n = tl.noiseSrc(t, 0.2);
  const bp = tl.node('filter', { type: 'bandpass', Q: 3 });
  bp.frequency.setValueAtTime(5200, t);
  bp.frequency.exponentialRampToValueAtTime(1800, t + 0.12);
  const e = tl.node('gain');
  tl.env(e, t, 0.22 * g, 0.002, 0.03, 0.04);
  out(tl, n.connect(bp).connect(e), dest, { pan, send: 0.15 });
  const o = tl.ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(1600, t);
  o.frequency.exponentialRampToValueAtTime(420, t + 0.14);
  const oe = tl.node('gain');
  tl.env(oe, t, 0.04 * g, 0.002, 0.04, 0.03);
  const sh = tl.node('shaper', { curve: tl.curve(4) });
  out(tl, o.connect(sh).connect(oe), dest, { pan, send: 0.1 });
  o.start(t); o.stop(t + 0.3);
}

// ---------------------------------------------------------------------
// la música (primera pasada)
// ---------------------------------------------------------------------

const ROOT = {
  Dm: ['D2', 'D3'], Bb: ['Bb1', 'Bb2'], F: ['F2', 'F3'], C: ['C2', 'C3'], Gm: ['G1', 'G2'], A: ['A1', 'A2'], D: ['D2', 'D3'],
};
const ARP = {
  F: ['F4', 'A4', 'C5', 'F5', 'A5', 'C6', 'A5', 'F5'],
  C: ['C5', 'E5', 'G5', 'C6', 'E6', 'G5', 'E5', 'C5'],
  Dm: ['D5', 'F5', 'A5', 'D6', 'F6', 'A5', 'F5', 'D5'],
  Bb: ['Bb4', 'D5', 'F5', 'Bb5', 'D6', 'F5', 'D5', 'Bb4'],
  Gm: ['G4', 'Bb4', 'D5', 'G5', 'Bb5', 'D5', 'Bb4', 'G4'],
  A: ['A4', 'C#5', 'E5', 'A5', 'C#6', 'E5', 'C#5', 'A4'],
};

function buildMusic(tl, dest) {
  const { ctx } = tl;
  // el bus de la música con bombeo (sidechain) y un filtro para la cámara lenta
  const duck = tl.node('gain', { gain: 1 });
  const slowLp = tl.node('filter', { type: 'lowpass', frequency: 20000, Q: 0.7 });
  duck.connect(slowLp).connect(dest);
  const verbHp = tl.node('filter', { type: 'highpass', frequency: 220 });
  const verbOut = tl.node('gain', { gain: 0.9 });
  tl.verb.connect(verbHp).connect(verbOut).connect(slowLp);
  const drums = tl.node('gain', { gain: 1 });
  drums.connect(slowLp);
  const M = duck; // lo tonal pasa por el bombeo
  const padBus = tl.node('filter', { type: 'highpass', frequency: 170, Q: 0.6 });
  padBus.connect(duck);
  const topBus = tl.node('filter', { type: 'highpass', frequency: 240, Q: 0.6 });
  topBus.connect(duck);

  const kicks = [];
  const K = (beat, g = 1) => { kicks.push(T(beat)); kick(tl, drums, T(beat), g); };
  const range = (a, c, step = 1) => { const r = []; for (let x = a; x < c - 1e-9; x += step) r.push(x); return r; };
  /** El bajo en corcheas sobre una lista de acordes [[tiempo, acorde], ...] hasta `end`. */
  const bass = (chords, end, g = 0.9, cut = 800) => chords.forEach(([bt, ch], k) => {
    const next = chords[k + 1]?.[0] ?? end;
    range(bt, next, 0.5).forEach((x, i) => reese(tl, M, T(x), ROOT[ch][i % 2], BEAT * 0.42, g, cut));
  });
  const pads = (chords, end, g = 1, o = {}) => chords.forEach(([bt, ch], k) => {
    const next = chords[k + 1]?.[0] ?? end;
    pad(tl, padBus, T(bt), ch, T(next - bt) * 0.98, g, o);
  });
  /** La batería de siempre: bombo en negras, palmas en 2 y 4, platillos en semicorcheas. */
  const groove = (a, c, { kg = 1, cg = 1, hg = 1 } = {}) => {
    range(a, c).forEach((bt) => K(bt, kg));
    range(a + 1, c, 2).forEach((bt) => clap(tl, drums, T(bt), cg));
    range(a, c, 0.25).forEach((bt, i) => hat(tl, drums, T(bt), [0.3, 0.2, 0.75, 0.2][i % 4] * hg, i % 4 === 2));
  };

  // ---- 0-10: cara a cara ----
  pad(tl, padBus, T(0.2), 'Dm', T(5.6), 0.65, { attack: 1.2, open: [300, 1500] });
  sub(tl, M, T(0.3), 'D2', T(1.6), 0.4);
  range(2, 6, 0.5).forEach((bt, i) => reese(tl, M, T(bt), i % 2 ? 'D3' : 'D2', BEAT * 0.4, 0.45 + i * 0.05, 500 + i * 50));
  range(2.5, 6, 0.5).forEach((bt) => hat(tl, drums, T(bt), 0.25));
  [5, 5.25, 5.5, 5.625, 5.75, 5.875].forEach((bt, i) => tom(tl, drums, T(bt), 170 - i * 14, 0.5 + i * 0.07));
  groove(6, 10);
  crash(tl, drums, T(6), 1.2);
  pads([[6, 'Dm'], [8, 'Bb']], 10, 1, { cutoff: 2600 });
  bass([[6, 'Dm'], [8, 'Bb']], 10, 0.95, 900);
  stab(tl, padBus, T(6), 'Dm', 1.4, 1.3);

  // ---- 10-26: el turno que enseña (liviano: le deja lugar a las cartas) ----
  const teach = [[10, 'Dm'], [14, 'Bb'], [18, 'F'], [22, 'C']];
  range(10, 26).forEach((bt) => K(bt, 0.75));
  range(11, 26, 2).forEach((bt) => clap(tl, drums, T(bt), 0.6));
  range(10, 26, 0.5).forEach((bt) => hat(tl, drums, T(bt), bt % 1 ? 0.55 : 0.2, bt % 1 !== 0));
  pads(teach, 26, 0.8, { cutoff: 1900 });
  bass(teach, 26, 0.7, 600);
  // la escalera: una nota por carta, siempre más arriba
  const ladder = ['D5', 'F5', 'A5', 'C6', 'D6'];
  CUE.a.forEach((bt, i) => pluck(tl, topBus, T(bt), ladder[i], 1.15, { dur: 0.55, send: 0.45 }));

  // ---- 26-32: el redoble, el golpe y la vuelta ----
  pad(tl, padBus, T(26), 'A', T(2), 0.9, { open: [800, 4000], release: 0.08 });
  sub(tl, M, T(26), 'A1', T(2) * 0.95, 0.8);
  [...range(26, 27, 0.5), ...range(27, 27.5, 0.25), ...range(27.5, 28, 0.125)].forEach((bt, i, all) => snare(tl, drums, T(bt), 0.2 + (i / all.length) * 0.7));
  groove(28, 31);
  crash(tl, drums, T(28), 1.2);
  pads([[28, 'Dm'], [30, 'Bb']], 32, 1.1, { cutoff: 3000, attack: 0.02 });
  bass([[28, 'Dm'], [30, 'Bb']], 31.5, 1, 1000);
  [31, 31.25, 31.5, 31.75].forEach((bt, i) => tom(tl, drums, T(bt), 150 - i * 20, 0.6));

  // ---- 32-41: Puffy (medio tiempo, más flaco) ----
  [32, 33.5, 34, 36, 37.5, 38, 40].forEach((bt) => K(bt, 0.75));
  [34, 38].forEach((bt) => clap(tl, drums, T(bt), 0.7));
  range(32, 41, 0.5).forEach((bt) => hat(tl, drums, T(bt), 0.22));
  pad(tl, padBus, T(32), 'Dm', T(4), 0.7, { cutoff: 1200, release: 0.2 });
  pad(tl, padBus, T(36), 'Bb', T(4.9), 0.75, { cutoff: 1400, release: 0.2 });
  range(32, 41).forEach((bt) => sub(tl, M, T(bt), bt < 36 ? 'D2' : 'Bb1', BEAT * 0.8, 0.7));
  const pOst = ['A4', 'D5', 'F5', 'D5'];
  range(32, 40.5, 0.5).forEach((bt, i) => pluck(tl, topBus, T(bt), pOst[i % 4], 0.35, { dur: 0.25, bright: 0.5, send: 0.3 }));
  ['A5', 'C6', 'E6'].forEach((note, i) => pluck(tl, topBus, T(CUE.b[i]), note, 1, { dur: 0.45, send: 0.45 }));

  // ---- 44-48: después del corte, un colchón triste y el barrido ----
  pad(tl, padBus, T(44.5), 'Dm', T(3.3), 0.55, { cutoff: 900, attack: 0.4 });
  sub(tl, M, T(44.5), 'D2', T(3), 0.5);

  // ---- 48-84: los poderes ----
  groove(48, 83);
  crash(tl, drums, T(48), 1.2);
  pad(tl, padBus, T(48), 'Bb', T(4), 1.1, { cutoff: 3200, attack: 0.02 });
  bass([[48, 'Bb']], 52, 1, 900);
  stab(tl, padBus, T(48) + 0.3, 'Bb', 1.4, 1.3);
  const vChords = [['F', 'C'], ['Dm', 'Bb'], ['F', 'C'], ['Gm', 'A']];
  CUE.v.forEach((v0, i) => {
    const [c1, c2] = vChords[i];
    pads([[v0, c1], [v0 + 4, c2]], v0 + 8, 1.05, { cutoff: 3000 });
    bass([[v0, c1], [v0 + 4, c2]], i === 3 ? 83.5 : v0 + 8, 0.95, 900);
    stab(tl, padBus, T(v0), c1, 1.2, 1.2);
    crash(tl, drums, T(v0), 0.7);
    // arpegio de semicorcheas que se abre
    range(v0, v0 + 8, 0.25).forEach((bt, k) => {
      const ch = bt < v0 + 4 ? c1 : c2;
      pluck(tl, topBus, T(bt), ARP[ch][k % 8], 0.38, { dur: 0.18, bright: 0.55 + (k % 16) / 40, send: 0.2, pan: k % 2 ? 0.3 : -0.3 });
    });
  });
  [83, 83.25, 83.5, 83.625, 83.75, 83.875].forEach((bt, i) => tom(tl, drums, T(bt), 190 - i * 18, 0.7));

  // ---- 84-92: el final arranca ----
  groove(84, 92, { kg: 1, cg: 0.9 });
  crash(tl, drums, T(84), 1.1);
  pads([[84, 'Dm'], [88, 'Bb']], 92, 1, { cutoff: 2800 });
  bass([[84, 'Dm'], [88, 'Bb']], 92, 1, 950);
  const ladder2 = ['D5', 'E5', 'F5', 'G5', 'A5', 'C6', 'D6', 'F6'];
  CUE.c.forEach((bt, i) => pluck(tl, topBus, T(bt), ladder2[i], i < 6 ? 0.9 : 1.2, { dur: i < 6 ? 0.3 : 0.55, send: 0.4 }));

  // ---- 92-103: no alcanza ----
  sub(tl, M, T(92), 'D2', T(4), 0.8);
  sub(tl, M, T(96), 'D2', T(4), 0.8);
  sub(tl, M, T(100), 'A1', T(3), 0.9);
  pad(tl, padBus, T(92), 'Dm', T(4), 0.8, { open: [500, 1500], attack: 0.1 });
  pad(tl, padBus, T(96), 'Bb', T(4), 0.9, { open: [700, 2200] });
  pad(tl, padBus, T(100), 'A', T(3), 1, { open: [900, 5000], release: 0.06 });
  // trémolo de cuerdas: el colchón cortado en semicorcheas
  range(93, 102, 0.25).forEach((bt) => {
    const ch = bt < 96 ? 'Dm' : bt < 100 ? 'Bb' : 'A';
    const e = tl.node('gain');
    const t = T(bt);
    tl.env(e, t, 0.018 + (bt - 93) * 0.0025, 0.01, 0.04, 0.03);
    const lp = tl.node('filter', { type: 'lowpass', frequency: 1200 + (bt - 93) * 200 });
    CHORDS[ch].slice(2).forEach((note) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(note) * 2;
      o.connect(lp);
      o.start(t); o.stop(t + 0.2);
    });
    out(tl, lp.connect(e), padBus, { send: 0.3 });
  });
  range(94, 102).forEach((bt) => heartbeat(tl, drums, T(bt), 0.85 + (bt - 94) * 0.04));
  heartbeat(tl, drums, T(102), 1.2);
  range(93.5, 102.5, 0.5).forEach((bt) => tick(tl, drums, T(bt), 0.6 + (bt - 93.5) * 0.06, bt % 1 === 0));
  braam(tl, M, T(CUE.una), ['F2', 'Bb2', 'D3'], 1.1, 1.1);
  braam(tl, M, T(CUE.mas), ['A2', 'D3', 'F3'], 1.4, 1.2);
  [...range(99, 100, 0.5), ...range(100, 101, 0.25), ...range(101, 101.5, 0.125), ...range(101.5, 102, 0.0625)]
    .forEach((bt, i, all) => snare(tl, drums, T(bt), 0.15 + (i / all.length) * 0.7));
  // la cámara lenta: todo se va al fondo del agua justo antes del drop
  slowLp.frequency.setValueAtTime(20000, T(100.5));
  slowLp.frequency.exponentialRampToValueAtTime(420, T(102.3));
  slowLp.frequency.setValueAtTime(20000, T(102.98));

  // ---- 103-112: el drop ----
  range(103, 111).forEach((bt) => K(bt, 1.05));
  [104, 106, 108, 110].forEach((bt) => clap(tl, drums, T(bt), 1.1));
  range(103, 111, 0.25).forEach((bt, i) => hat(tl, drums, T(bt), [0.35, 0.22, 0.85, 0.22][i % 4], i % 4 === 2));
  crash(tl, drums, T(103), 1.3);
  crash(tl, drums, T(107), 1);
  crash(tl, drums, T(111), 0.8);
  braam(tl, M, T(103), ['D2', 'A2', 'D3', 'F3'], 1.8, 1.3);
  pads([[103, 'Dm'], [107, 'Bb'], [111, 'Gm']], 112, 1.4, { cutoff: 4200, attack: 0.02 });
  bass([[103, 'Dm'], [107, 'Bb'], [111, 'Gm']], 112, 1.1, 1100);
  range(103.5, 111, 1).forEach((bt) => stab(tl, padBus, T(bt), bt < 107 ? 'Dm' : 'Bb', 0.7, 0.8));
  const MEL = [
    [103, 'A4', 0.5], [103.5, 'D5', 0.5], [104, 'F5', 0.5], [104.5, 'E5', 0.25], [104.75, 'D5', 0.25],
    [105, 'E5', 0.5], [105.5, 'F5', 0.5], [106, 'A5', 1],
    [107, 'G5', 0.5], [107.5, 'F5', 0.5], [108, 'D5', 0.5], [108.5, 'F5', 0.5], [109, 'F5', 0.75], [109.75, 'D5', 0.25],
    [110, 'C5', 0.5], [110.5, 'D5', 0.5], [111, 'G5', 1],
  ];
  MEL.forEach(([bt, note, d]) => lead(tl, topBus, T(bt), note, T(d) * 0.92, 1));
  riser(tl, M, T(110.5), T(112), 0.8);

  // ---- 112-124: el título ----
  K(112, 1.1); K(114, 0.9); K(116, 0.9); K(118, 1.2);
  [113, 115, 117].forEach((bt) => clap(tl, drums, T(bt), 0.8));
  range(112, 118, 0.5).forEach((bt) => hat(tl, drums, T(bt), bt % 1 ? 0.5 : 0.25, bt % 1 !== 0));
  crash(tl, drums, T(112), 1.4);
  crash(tl, drums, T(118), 1.2);
  braam(tl, M, T(112), ['F2', 'Bb2', 'D3'], 1.6, 1.1);
  pad(tl, padBus, T(112), 'Bb', T(2), 1.5, { cutoff: 5000, attack: 0.02 });
  pad(tl, padBus, T(114), 'C', T(4), 1.4, { cutoff: 5000, attack: 0.05 });
  pad(tl, padBus, T(118), 'D', T(4.6), 1.6, { cutoff: 4500, attack: 0.02, release: 0.6 });
  reese(tl, M, T(112), 'Bb1', T(2) * 0.95, 1, 900);
  reese(tl, M, T(114), 'C2', T(4) * 0.95, 1, 900);
  reese(tl, M, T(118), 'D2', T(3.6), 1.1, 900);
  stab(tl, padBus, T(CUE.tag), 'C', 0.8, 1.2);
  const fin = ['D5', 'F#5', 'A5', 'D6', 'F#6', 'A6'];
  fin.forEach((note, i) => pluck(tl, topBus, T(118) + i * 0.06, note, 0.7, { dur: 1.2, send: 0.6 }));
  lead(tl, topBus, T(118), 'A5', T(3.4), 0.9);

  // el bombeo: cada bombo le saca aire a lo tonal
  for (const t of kicks) {
    duck.gain.setTargetAtTime(0.45, t, 0.004);
    duck.gain.setTargetAtTime(1, t + 0.04, 0.07);
  }
}

// ---------------------------------------------------------------------
// la mezcla (segunda pasada): la cinta de la música, los efectos y el master
// ---------------------------------------------------------------------

const KIT = [
  'summon_on', 'power_gain', 'doubt', 'beast_slash_attack', 'beast_throw_hit', 'beast_smash_attack', 'aquatic_projectile_hit',
  'power_awaken', 'morph_aura_burst', 'stunned', 'secret', 'shield', 'feather', 'leaf', 'poison', 'bubble',
  'damage_boost', 'buff', 'bird_fly', 'beast_fly', 'aquatic_fly', 'plant_fly', 'dispel', 'heal', 'weak', 'drain', 'taunt',
];

async function loadKit(ctx) {
  const kit = {};
  await Promise.all(KIT.map(async (name) => {
    try {
      const res = await fetch(`assets/sfx/${name}.wav`);
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      // dónde está el pico: se larga antes para que el pico caiga en el golpe
      const d = buf.getChannelData(0);
      const win = Math.floor(buf.sampleRate * 0.01);
      let best = 0;
      let at = 0;
      for (let i = 0; i < d.length; i += win) {
        let s = 0;
        for (let j = i; j < Math.min(d.length, i + win); j++) s = Math.max(s, Math.abs(d[j]));
        if (s > best) { best = s; at = i; }
      }
      kit[name] = { buf, lead: at / buf.sampleRate, peak: best };
    } catch {
      // sin el archivo, ese efecto no suena y el resto sigue
    }
  }));
  return kit;
}

function buildMix(tl, dest, music, kit) {
  const { ctx } = tl;
  const sfx = tl.node('gain', { gain: 1 });
  sfx.connect(dest);
  const verbHp = tl.node('filter', { type: 'highpass', frequency: 200 });
  const verbOut = tl.node('gain', { gain: 0.8 });
  tl.verb.connect(verbHp).connect(verbOut).connect(dest);
  // el silencio antes del drop: también se apaga la sala
  verbOut.gain.setValueAtTime(0.8, T(101.95));
  verbOut.gain.linearRampToValueAtTime(0.02, T(102.12));
  verbOut.gain.setValueAtTime(0.02, T(102.97));
  verbOut.gain.linearRampToValueAtTime(0.8, T(103));

  // la música como cinta: hasta el corte (y ahí se frena), y de nuevo desde el 44
  const tb = T(CUE.bust);
  const tapeA = ctx.createBufferSource();
  tapeA.buffer = music;
  const gA = tl.node('gain', { gain: 1 });
  tapeA.connect(gA).connect(dest);
  tapeA.start(0, 0);
  // el turno que enseña y el de Puffy van más bajos: ahí mandan las cartas
  gA.gain.setValueAtTime(1, T(10));
  gA.gain.linearRampToValueAtTime(0.6, T(10.4));
  gA.gain.setValueAtTime(0.6, T(25.8));
  gA.gain.linearRampToValueAtTime(1, T(26.2));
  gA.gain.setValueAtTime(1, T(31.8));
  gA.gain.linearRampToValueAtTime(0.72, T(32.2));
  tapeA.playbackRate.setValueAtTime(1, tb);
  tapeA.playbackRate.linearRampToValueAtTime(0.12, tb + 0.5);
  gA.gain.setValueAtTime(1, tb + 0.3);
  gA.gain.linearRampToValueAtTime(0, tb + 0.55);
  tapeA.stop(tb + 0.6);
  const tapeB = ctx.createBufferSource();
  tapeB.buffer = music;
  const gB = tl.node('gain', { gain: 1 });
  tapeB.connect(gB).connect(dest);
  tapeB.start(T(44.3), T(44.3));
  gB.gain.setValueAtTime(0.85, T(48));
  gB.gain.setValueAtTime(0.85, T(91.8));
  gB.gain.linearRampToValueAtTime(1, T(92.2));
  gB.gain.setValueAtTime(1, T(101.95));
  gB.gain.linearRampToValueAtTime(0.02, T(102.12));
  gB.gain.setValueAtTime(0.03, T(102.97));
  gB.gain.linearRampToValueAtTime(1, T(103));

  const play = (name, hit, { gain = 1, rate = 1, pan = 0, send = 0.15, offset = 0, until = 0, trim = 0 } = {}) => {
    const k = kit[name];
    if (!k) return;
    // `trim`: se saltea la subida del efecto y arranca a `trim` segundos de su pico
    if (trim) offset = Math.max(offset, k.lead - trim);
    const s = ctx.createBufferSource();
    s.buffer = k.buf;
    s.playbackRate.value = rate;
    const start = Math.max(0, hit - (k.lead - offset) / rate);
    const g = 0.55 * gain / Math.max(0.3, k.peak);
    const gn = out(tl, s, sfx, { gain: g, pan, send });
    s.start(start, offset);
    if (until) {
      gn.gain.setValueAtTime(g, until - 0.12);
      gn.gain.linearRampToValueAtTime(0, until);
      s.stop(until + 0.01);
    }
  };
  /** La vida que se vacía: una onda cuadrada que baja. */
  const drain = (t, pan = 0.4) => {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.4);
    const e = tl.node('gain');
    tl.env(e, t, 0.03, 0.005, 0.35, 0.03);
    const lp = tl.node('filter', { type: 'lowpass', frequency: 2500 });
    out(tl, o.connect(lp).connect(e), sfx, { pan });
    o.start(t); o.stop(t + 0.6);
  };
  /** Una carta que sale del mazo y cae en la fila. */
  const cardFx = (land, i, dur, rate = 1, pan = 0) => {
    whoosh(tl, sfx, land - dur, dur, 0.55, { from: 700, to: 4500, pan });
    play('power_gain', land, { gain: 0.55, rate: rate + i * 0.06 });
    if (i > 0) zap(tl, sfx, land + 0.02, 0.8, pan);
  };
  const soft = (t) => whoosh(tl, sfx, t, 0.22, 0.28, { from: 2500, to: 700 });

  // ---- 0-10: cara a cara ----
  swell(tl, sfx, T(2), T(1.8), 0.9);
  whoosh(tl, sfx, T(CUE.bubaIn) - 0.4, 0.4, 0.8, { from: 300, to: 2500, pan: -0.5 });
  impact(tl, sfx, T(CUE.bubaIn), 1, { low: 55, dur: 1 });
  play('summon_on', T(CUE.bubaIn), { gain: 0.7, pan: -0.4 });
  whoosh(tl, sfx, T(CUE.puffyIn) - 0.4, 0.4, 0.8, { from: 300, to: 2500, pan: 0.5 });
  impact(tl, sfx, T(CUE.puffyIn), 0.9, { low: 60, dur: 0.9 });
  play('summon_on', T(CUE.puffyIn), { gain: 0.6, pan: 0.4, rate: 1.12 });
  swell(tl, sfx, T(CUE.vs), T(1), 0.7);
  impact(tl, sfx, T(CUE.vs), 1.2, { low: 50, dur: 1.4 });
  play('power_awaken', T(CUE.vs), { gain: 0.7 });
  // las barras se llenan
  whoosh(tl, sfx, T(CUE.hud), 0.3, 0.4, { from: 3000, to: 800 });
  for (let i = 0; i < 10; i++) bell(tl, sfx, T(CUE.hud + 0.3) + i * 0.055, ['D5', 'E5', 'F5', 'G5', 'A5', 'C6', 'D6', 'E6', 'F6', 'A6'][i], 0.35, i / 5 - 1);

  // ---- 10-32: el turno de Buba ----
  bell(tl, sfx, T(CUE.turnA), 'A6', 0.6);
  whoosh(tl, sfx, T(CUE.turnA), 0.35, 0.4, { from: 600, to: 3000, pan: -0.6 });
  [CUE.capDraw, CUE.capShare, CUE.capGrow, CUE.capMore, CUE.capStand].forEach((bt) => soft(T(bt)));
  CUE.a.forEach((bt, i) => cardFx(T(bt), i, 0.46, 1));
  // el ataque: las cartas se van al número, el número a Buba, Buba a Puffy
  swell(tl, sfx, T(CUE.fly), T(CUE.fly - CUE.charge), 0.6, 1.3);
  for (let i = 0; i < 5; i++) tick(tl, sfx, T(CUE.charge) + 0.3 + i * 0.025, 0.7, i % 2 === 0);
  play('damage_boost', T(CUE.fly), { gain: 0.6 });
  whoosh(tl, sfx, T(CUE.fly), 0.25, 0.6, { from: 1500, to: 5000, pan: -0.5 });
  whoosh(tl, sfx, T(CUE.lunge), T(CUE.hitA - CUE.lunge), 0.9, { from: 400, to: 6000, pan: 0.6 });
  play('beast_slash_attack', T(CUE.hitA), { gain: 1 });
  play('beast_throw_hit', T(CUE.hitA), { gain: 0.9 });
  impact(tl, sfx, T(CUE.hitA), 1.1, { low: 55, dur: 1 });
  drain(T(CUE.hitA) + 0.08);
  boing(tl, sfx, T(CUE.homeA) - 0.3, 0.5, 280);
  tom(tl, sfx, T(CUE.homeA), 90, 0.5);

  // ---- 32-48: el turno de Puffy ----
  bell(tl, sfx, T(CUE.turnB), 'E6', 0.6);
  whoosh(tl, sfx, T(CUE.turnB) - 0.2, 0.35, 0.4, { from: 600, to: 3000, pan: 0.6 });
  CUE.b.forEach((bt, i) => cardFx(T(bt), i, 0.4, 0.9, 0.2));
  soft(T(CUE.capBut));
  whoosh(tl, sfx, T(CUE.pDraw), T(CUE.pFlip - CUE.pDraw), 0.6, { from: 300, to: 1800, pan: 0.2 });
  play('power_gain', T(CUE.pFlip) + 0.05, { gain: 0.45, rate: 0.8 });
  whoosh(tl, sfx, T(CUE.pFlip), 0.15, 0.5, { from: 2500, to: 6000 });
  scanBleep(tl, sfx, T(CUE.scan), 1);
  buzzer(tl, sfx, T(CUE.scan) + 0.13, 0.8);
  buzzer(tl, sfx, T(CUE.scan) + 0.28, 1);
  play('doubt', tb, { gain: 1.1 });
  shatterSfx(tl, sfx, tb, 1);
  glitch(tl, sfx, tb, 0.5, 1);
  impact(tl, sfx, tb, 0.6, { low: 55, dur: 1 });
  whoosh(tl, sfx, T(CUE.zero), 0.25, 0.4, { from: 3000, to: 400 });
  [0.26, 0.42, 0.5].forEach((d, i) => tom(tl, sfx, T(CUE.zero) + d, 90 - i * 10, 0.6 - i * 0.15));
  impact(tl, sfx, T(CUE.cero), 0.55, { low: 52, dur: 0.9 });
  play('taunt', T(CUE.laugh) + 0.1, { gain: 0.45, pan: -0.5 });
  womp(tl, sfx, T(43), 'A2', 'G#2', 0.42, 0.65);
  womp(tl, sfx, T(43.9), 'G2', 'D2', 0.95, 0.7);
  riser(tl, sfx, T(46), T(CUE.push1[1]), 0.6);
  whoosh(tl, sfx, T(CUE.push1[0]), T(CUE.push1[1] - CUE.push1[0]), 1, { from: 300, to: 8000, pan: -0.8 });

  // ---- 48-84: los poderes ----
  impact(tl, sfx, T(CUE.powers) + 0.3, 0.8, { low: 60, dur: 1 });
  for (let k = 0; k < 12; k++) bell(tl, sfx, T(CUE.powers) + 0.12 + k * 0.045 + 0.5, ['D6', 'F6', 'A6', 'C7', 'D7', 'E7'][k % 6], 0.35, (k % 4) / 1.5 - 1);
  whoosh(tl, sfx, T(CUE.v[0]) - 0.5, 0.55, 0.7, { from: 400, to: 5000 });
  const flies = ['bird_fly', 'aquatic_fly', 'beast_fly', 'plant_fly'];
  CUE.v.forEach((v0, i) => {
    const at = (x) => T(v0 + x);
    whoosh(tl, sfx, at(0) - 0.12, 0.3, 0.6, { from: 1500, to: 7000 });
    play(flies[i], at(0) + 0.05, { gain: 0.3, rate: 1.1 });
    whoosh(tl, sfx, at(0.3), T(0.25), 0.5, { from: 600, to: 4000 });
    play('power_gain', at(0.55), { gain: 0.6, rate: 1.1 });
    impact(tl, sfx, at(0.85), 0.35, { low: 80, dur: 0.5 });
  });
  {
    // Feather Earring: la pluma se va, cae meciéndose y corta
    const v0 = CUE.v[0];
    const at = (x) => T(v0 + x);
    play('feather', at(2.4), { gain: 0.6 });
    whoosh(tl, sfx, at(2.4), T(0.6), 0.5, { from: 800, to: 6000 });
    whoosh(tl, sfx, at(3), T(V_HIT.feather - 3), 0.5, { from: 3000, to: 900, pan: 0.5 });
    play('bird_fly', at(3.2), { gain: 0.4, pan: 0.5 });
    play('beast_slash_attack', at(V_HIT.feather), { gain: 0.7, rate: 1.3, pan: 0.5 });
    play('feather', at(V_HIT.feather), { gain: 0.6, pan: 0.5 });
    impact(tl, sfx, at(V_HIT.feather), 0.7, { low: 65, dur: 0.8 });
    drain(at(V_HIT.feather) + 0.08);
  }
  {
    // Poison Vial: el escudo, el frasco que lo atraviesa y se rompe
    const v0 = CUE.v[1];
    const at = (x) => T(v0 + x);
    play('shield', at(1.6), { gain: 0.5, pan: 0.5 });
    whoosh(tl, sfx, at(2.5), T(V_HIT.poison - 2.5), 0.6, { from: 500, to: 3000, pan: 0.4 });
    bell(tl, sfx, at(V_HIT.poison - 0.35), 'E6', 0.5, 0.4);
    shatterSfx(tl, sfx, at(V_HIT.poison), 0.45);
    play('poison', at(V_HIT.poison), { gain: 0.9, pan: 0.5 });
    impact(tl, sfx, at(V_HIT.poison), 0.55, { low: 70, dur: 0.7 });
    drain(at(V_HIT.poison) + 0.08);
  }
  {
    // Mantis Dagger: el puñal, el tajo y la vida que vuelve
    const v0 = CUE.v[2];
    const at = (x) => T(v0 + x);
    whoosh(tl, sfx, at(2.4), T(V_HIT.leech - 2.4), 0.7, { from: 800, to: 7000, pan: 0.5 });
    play('beast_slash_attack', at(V_HIT.leech), { gain: 0.8, rate: 1.15, pan: 0.5 });
    impact(tl, sfx, at(V_HIT.leech), 0.6, { low: 70, dur: 0.7 });
    drain(at(V_HIT.leech) + 0.08);
    play('drain', at(V_HIT.leech + 0.4), { gain: 0.7 });
    play('heal', at(V_SECOND.leech), { gain: 0.7, pan: -0.5 });
  }
  {
    // Leafy Pot: el golpe, la maceta que cae y las hojas
    const v0 = CUE.v[3];
    const at = (x) => T(v0 + x);
    whoosh(tl, sfx, at(2.4), T(V_HIT.pot - 2.4), 0.8, { from: 400, to: 6000, pan: 0.5 });
    play('beast_smash_attack', at(V_HIT.pot), { gain: 0.8, pan: 0.5 });
    impact(tl, sfx, at(V_HIT.pot), 0.7, { low: 60, dur: 0.8 });
    drain(at(V_HIT.pot) + 0.08);
    whoosh(tl, sfx, at(3.6), T(0.5), 0.4, { from: 2500, to: 600, pan: -0.5 });
    boing(tl, sfx, at(4.1), 0.6, 240);
    play('leaf', at(4.15), { gain: 0.7, pan: -0.5 });
    play('heal', at(V_SECOND.pot), { gain: 0.7, pan: -0.5 });
  }

  // ---- 84-112: el final ----
  whoosh(tl, sfx, T(CUE.push2[0]), T(CUE.push2[1] - CUE.push2[0]), 1, { from: 8000, to: 400, pan: 0.8 });
  impact(tl, sfx, T(CUE.push2[1]), 0.6, { low: 60, dur: 0.8 });
  bell(tl, sfx, T(CUE.turnC) + 0.3, 'A6', 0.6);
  CUE.c.forEach((bt, i) => cardFx(T(bt), i, 0.3, 1 + (i < 6 ? 0 : 0.1)));
  // no alcanza
  impact(tl, sfx, T(CUE.short), 0.5, { low: 48, dur: 1.2 });
  play('weak', T(CUE.short) + 0.1, { gain: 0.5, pan: 0.5 });
  whoosh(tl, sfx, T(CUE.short), 0.4, 0.4, { from: 800, to: 3000, pan: 0.6 });
  tick(tl, sfx, T(CUE.dial) + 0.1, 1);
  impact(tl, sfx, T(CUE.una), 0.6, { low: 55, dur: 0.9 });
  impact(tl, sfx, T(CUE.mas), 0.7, { low: 52, dur: 1 });
  whoosh(tl, sfx, T(CUE.una), 0.6, 0.35, { from: 200, to: 900 });
  riser(tl, sfx, T(97), T(102), 1.1);
  play('secret', T(CUE.lift) + 0.3, { gain: 0.6, until: T(101.95) });
  whoosh(tl, sfx, T(CUE.float), 0.9, 0.4, { from: 300, to: 1200 });
  whoosh(tl, sfx, T(101), T(1), 0.5, { from: 150, to: 700 });
  swell(tl, sfx, T(CUE.drop), 0.13, 0.7, 0.6);
  // el drop
  impact(tl, sfx, T(CUE.drop), 1.4, { low: 55, dur: 1.6 });
  play('morph_aura_burst', T(CUE.drop), { gain: 0.8, trim: 0.04 });
  play('power_awaken', T(CUE.drop) + 0.05, { gain: 0.7, trim: 0.04 });
  impact(tl, sfx, T(CUE.number), 0.6, { low: 70, dur: 0.7 });
  for (let i = 0; i < 14; i++) bell(tl, sfx, T(CUE.number) + 0.05 + i * 0.05 + tl.R() * 0.03, ['D6', 'F6', 'A6', 'C7', 'D7', 'E7'][i % 6], 0.55, tl.R() * 1.4 - 0.7);
  swell(tl, sfx, T(CUE.fly2), T(CUE.fly2 - CUE.charge2), 0.6, 1.3);
  for (let i = 0; i < 9; i++) tick(tl, sfx, T(CUE.charge2) + 0.3 + i * 0.025, 0.7, i % 2 === 0);
  play('damage_boost', T(CUE.fly2), { gain: 0.7 });
  whoosh(tl, sfx, T(CUE.fly2), 0.22, 0.6, { from: 1500, to: 5000, pan: -0.5 });
  whoosh(tl, sfx, T(CUE.attack), T(CUE.hit - CUE.attack), 0.9, { from: 400, to: 6000, pan: 0.6 });
  play('beast_slash_attack', T(CUE.hit), { gain: 1 });
  play('beast_throw_hit', T(CUE.hit), { gain: 0.9 });
  impact(tl, sfx, T(CUE.hit), 1.2, { low: 55, dur: 1.1 });
  drain(T(CUE.hit) + 0.1);
  whoosh(tl, sfx, T(CUE.ko) - 0.1, 0.5, 0.8, { from: 600, to: 3000, pan: 0.7 });
  impact(tl, sfx, T(CUE.ko), 0.7, { low: 60, dur: 0.8 });
  tom(tl, sfx, T(CUE.ko) + 0.42, 70, 0.8);
  play('stunned', T(CUE.ko) + 0.5, { gain: 0.6, pan: 0.5 });
  for (let i = 0; i < 18; i++) bell(tl, sfx, T(CUE.ko) + 0.3 + i * 0.13 + tl.R() * 0.06, ['A6', 'D7', 'F6', 'C7', 'E7', 'D6'][i % 6], 0.3, tl.R() * 1.6 - 0.8);
  riser(tl, sfx, T(CUE.converge), T(CUE.logo), 0.7);
  swell(tl, sfx, T(CUE.logo), T(1.5), 1);

  // ---- 112-124: el título ----
  impact(tl, sfx, T(CUE.logo), 1.3, { low: 55, dur: 1.8 });
  play('power_awaken', T(CUE.logo), { gain: 0.8 });
  for (let i = 0; i < 10; i++) bell(tl, sfx, T(CUE.tag) + i * 0.04, ['D6', 'F6', 'A6', 'D7', 'F7'][i % 5], 0.35, i / 5 - 1);
  bell(tl, sfx, T(CUE.cta), 'A6', 0.8);
  bell(tl, sfx, T(CUE.cta) + 0.08, 'D7', 0.8);
  for (let i = 0; i < 6; i++) boing(tl, sfx, T(CUE.axies) + i * 0.09, 0.45, 300 + i * 40);
  impact(tl, sfx, T(CUE.final), 1, { low: 55, dur: 2.2 });
  play('buff', T(CUE.final) + 0.02, { gain: 0.5 });
}

// ---------------------------------------------------------------------
// render
// ---------------------------------------------------------------------

async function pass(sr, build) {
  const len = Math.ceil((DURATION + 0.6) * sr);
  const ctx = new OfflineAudioContext(2, len, sr);
  const tl = makeTools(ctx, 11);
  const bus = ctx.createGain();
  await build(tl, bus, ctx);
  return { ctx, tl, bus };
}

/** Renderiza la banda entera (es la misma en los dos idiomas). Devuelve un AudioBuffer estéreo. */
export async function renderScore(sampleRate = 48000) {
  // primera pasada: la música sola
  const A = await pass(sampleRate, (tl, bus) => buildMusic(tl, bus));
  A.bus.connect(A.ctx.destination);
  const music = await A.ctx.startRendering();

  // segunda pasada: la cinta, los efectos y el master
  const M = await pass(sampleRate, async (tl, bus, ctx) => {
    const kit = await loadKit(ctx);
    buildMix(tl, bus, music, kit);
  });
  const { ctx, bus } = M;
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -20; glue.knee.value = 10; glue.ratio.value = 2.2; glue.attack.value = 0.012; glue.release.value = 0.25;
  const drive = ctx.createGain();
  drive.gain.value = 0.8;
  const limit = ctx.createDynamicsCompressor();
  limit.threshold.value = -3; limit.knee.value = 2; limit.ratio.value = 20; limit.attack.value = 0.002; limit.release.value = 0.1;
  // el final se apaga con la imagen
  const fade = ctx.createGain();
  fade.gain.setValueAtTime(1, DURATION - 0.6);
  fade.gain.linearRampToValueAtTime(0, DURATION + 0.1);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 35; hp.Q.value = 0.7;
  const lowShelf = ctx.createBiquadFilter();
  lowShelf.type = 'lowshelf'; lowShelf.frequency.value = 90; lowShelf.gain.value = -3;
  const air = ctx.createBiquadFilter();
  air.type = 'highshelf'; air.frequency.value = 7000; air.gain.value = 3;
  bus.connect(hp).connect(lowShelf).connect(air).connect(glue).connect(drive).connect(limit).connect(fade).connect(ctx.destination);
  const mix = await ctx.startRendering();

  // normalizado a -1 dBFS de pico
  let peak = 0;
  for (let c = 0; c < mix.numberOfChannels; c++) {
    const d = mix.getChannelData(c);
    for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  }
  const k = peak > 0 ? 0.891 / peak : 1;
  for (let c = 0; c < mix.numberOfChannels; c++) {
    const d = mix.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] *= k;
  }
  return mix;
}

/** Un AudioBuffer a WAV PCM de 16 bits (con un poco de dither). */
export function toWav(buf) {
  const ch = buf.numberOfChannels;
  const n = buf.length;
  const outv = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o, s) => [...s].forEach((c, i) => outv.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); outv.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  outv.setUint32(16, 16, true); outv.setUint16(20, 1, true); outv.setUint16(22, ch, true);
  outv.setUint32(24, buf.sampleRate, true); outv.setUint32(28, buf.sampleRate * ch * 2, true);
  outv.setUint16(32, ch * 2, true); outv.setUint16(34, 16, true); str(36, 'data'); outv.setUint32(40, n * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  const R = rng(99);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, data[c][i] + (R() - R()) / 65536));
      outv.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([outv.buffer], { type: 'audio/wav' });
}
