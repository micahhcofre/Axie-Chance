// Genera `src/audio-clips.js`: el catálogo de sonidos, medido uno por uno.
//
// Los sonidos salen del Axie Origins Asset Kit —`web-vfx/public/sfx/` son los que el
// kit preparó para la web, `Assets/OriginsKit/Audio/` trae los que ahí faltan, y
// `Assets/OriginsKit/PvE/Music/` la música—. Igual que con los efectos de golpe, acá
// no se guarda el audio: se baja cada wav una sola vez para **medirlo** y lo que queda
// en el repo son los números. El navegador los pide por CDN cuando hacen falta.
//
//   npm run sfx          # regenera src/audio-clips.js
//
// Lo que se mide, y por qué no alcanza con el nombre del archivo:
//
//   `onset`  los wav del kit arrancan con hasta 110 ms de silencio. Reproducidos tal
//            cual, el golpe suena tarde: el efecto ya explotó. Se saltea.
//   `lead`   cuánto tarda el sonido en llegar a su punto más fuerte. Es lo que deja
//            hacer coincidir el pico con el impacto, y no el arranque con el impacto:
//            un `slash` que tarda 240 ms en pegar hay que largarlo 240 ms antes.
//   `secs`   cuánto dura la parte que se oye, para soltarlo cuando terminó.
//   `gain`   todos los archivos vienen normalizados al pico —los 41 dan 1.0—, así que
//            el pico no dice nada sobre el volumen. El que sí dice es el RMS de la
//            parte audible, y ahí hay 7 dB de diferencia entre el más flojo y el más
//            fuerte: sin emparejarlos, el veneno tapa al huevo. Cada uno se corrige a
//            `TARGET_DB`. La mezcla del juego —qué suena más fuerte que qué— es otra
//            cosa y vive en `audio.js`.
//
// La música se mide distinto: son temas con final, no bucles. Terminan con un fundido,
// así que `tail` es cuánto dura ese fundido y el reproductor encima la vuelta siguiente
// justo ahí (ver `audio.js`). El empalme queda tapado por la cola que se está yendo.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'src', 'audio-clips.js');

const REPO = 'axieinfinity/axie-origins-asset-kit';
const REF = 'main';
// jsDelivr sirve el repo entero con CORS y caché, igual que los atlas de los efectos.
const CDN = `https://cdn.jsdelivr.net/gh/${REPO}@${REF}/`;

const WEB = 'web-vfx/public/sfx/';
const UNITY = 'Assets/OriginsKit/Audio/';
const MUSICA = 'Assets/OriginsKit/PvE/Music/';

/** A qué volumen queda cada efecto, en dB RMS de su parte audible. */
const TARGET_DB = -16;
/** Y la música, que va de fondo y no compite con nada. */
const MUSIC_DB = -20;

/**
 * Qué suena en cada momento del juego. La clave es el evento, no el archivo: el que
 * llama pide `attack de la clase aquatic` o `el huevo aguantó`, y qué wav es eso se
 * decide acá.
 *
 * Las seis primeras son el golpe de cada clase, y son el `slash` a propósito: es el
 * mismo ataque que dibuja el efecto de `vfx-clips.js`. Lo que se ve y lo que se oye
 * tienen que ser el mismo golpe.
 */
const PICKS = {
  aquatic: `${WEB}aquatic_slash_attack.wav`,
  beast: `${WEB}beast_slash_attack.wav`,
  bird: `${WEB}bird_slash_attack.wav`,
  bug: `${WEB}bug_slash_attack.wav`,
  plant: `${WEB}plant_slash_attack.wav`,
  reptile: `${WEB}reptile_slash_attack.wav`,
  // El ataque que se desarma: el mismo nombre que el efecto que lo dibuja.
  bust: `${UNITY}disarm.wav`,
  // Cada carta que alarga la cadena. Se reproduce cortado y cada vez más agudo.
  draw: `${WEB}power_gain.wav`,
  // El huevo del rival aguantando, y la cáscara volviéndose contra el que pegó.
  block: `${WEB}shield.wav`,
  thorns: `${WEB}reflect_damage.wav`,
  // Los seis poderes, cuando se aplican.
  strength: `${UNITY}damage_boost.wav`,
  poison: `${UNITY}poison.wav`,
  egg: `${UNITY}buff.wav`,
  pot: `${WEB}heal.wav`,
  snail: `${WEB}weak.wav`,
  octopus: `${WEB}bubble.wav`,
  // El centro: cuando se abre, cuando agarrás una carta y cuando lo renovás.
  open: `${UNITY}summon_on.wav`,
  take: `${WEB}feather.wav`,
  renew: `${WEB}dispel.wav`,
  // El final.
  win: `${WEB}power_awaken.wav`,
  lose: `${UNITY}death_mark.wav`,
};

/**
 * Los dos temas: el del combate y el que entra cuando alguien queda con la vida corta.
 * Son mono a 16 kHz —así los publica el kit— y duran cerca de dos minutos cada uno.
 */
const TRACKS = {
  battle: `${MUSICA}pve_1.wav`,
  boss: `${MUSICA}boss.wav`,
};

/**
 * Lee un WAV PCM de 16 bits y lo devuelve en mono. Se recorren los chunks en vez de
 * asumir que el audio arranca en el byte 44: varios archivos del kit traen un `LIST`
 * con metadatos antes del `data`, y salteando a ciegas se leen esos bytes como audio.
 */
function readWav(buf) {
  let at = 12;
  let fmt = null;
  let data = null;
  while (at + 8 <= buf.length) {
    const id = buf.toString('ascii', at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    if (id === 'fmt ') {
      fmt = {
        channels: buf.readUInt16LE(at + 10),
        rate: buf.readUInt32LE(at + 12),
        bits: buf.readUInt16LE(at + 22),
      };
    }
    if (id === 'data') data = buf.subarray(at + 8, at + 8 + size);
    at += 8 + size + (size % 2); // los chunks impares llevan un byte de relleno
    if (fmt && data) break;
  }
  if (!fmt || !data) throw new Error('no es un WAV con fmt y data');
  if (fmt.bits !== 16) throw new Error(`WAV de ${fmt.bits} bits, se esperaban 16`);

  const frames = Math.floor(data.length / 2 / fmt.channels);
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < fmt.channels; c++) sum += data.readInt16LE((i * fmt.channels + c) * 2);
    mono[i] = sum / fmt.channels / 32768;
  }
  return { rate: fmt.rate, channels: fmt.channels, samples: mono, secs: frames / fmt.rate };
}

/** El sonido resumido en ventanas de 10 ms: pico y RMS de cada una. */
function envelope(wav, step = 0.01) {
  const win = Math.max(1, Math.round(wav.rate * step));
  const out = [];
  for (let i = 0; i < wav.samples.length; i += win) {
    const end = Math.min(i + win, wav.samples.length);
    let peak = 0;
    let sum = 0;
    for (let j = i; j < end; j++) {
      const v = wav.samples[j];
      if (Math.abs(v) > peak) peak = Math.abs(v);
      sum += v * v;
    }
    out.push({ at: i / wav.rate, peak, rms: Math.sqrt(sum / (end - i)) });
  }
  return out;
}

const db = (x) => 20 * Math.log10(Math.max(x, 1e-9));
/** El volumen que hay que ponerle para que quede en `target` dB, sin exagerar. */
const gainFor = (rmsDb, target) =>
  Number(Math.min(Math.max(10 ** ((target - rmsDb) / 20), 0.3), 3).toFixed(2));

async function download(path) {
  const res = await fetch(CDN + path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return readWav(Buffer.from(await res.arrayBuffer()));
}

/** Un efecto: dónde empieza, cuánto dura, cuándo pega y a qué volumen. */
function measureSfx(wav) {
  const env = envelope(wav);
  const peak = Math.max(...env.map((e) => e.peak));
  // 2% del pico, unos −34 dB: por debajo de eso es la cola o el ruido de fondo.
  const floor = peak * 0.02;
  const loud = env.filter((e) => e.peak > floor);
  const onset = loud[0]?.at ?? 0;
  const end = loud[loud.length - 1]?.at ?? wav.secs;
  const rms = Math.sqrt(loud.reduce((s, e) => s + e.rms ** 2, 0) / (loud.length || 1));
  const top = env.reduce((a, b) => (b.peak > a.peak ? b : a));
  return {
    secs: Number((end - onset + 0.01).toFixed(2)),
    onset: Number(onset.toFixed(3)),
    lead: Number((top.at - onset).toFixed(3)),
    gain: gainFor(db(rms), TARGET_DB),
    rmsDb: db(rms),
  };
}

/**
 * Un tema: cuánto dura y cuánto de eso es el fundido final. El fundido se busca desde
 * el final hacia atrás, hasta el primer momento que todavía suena a cuerpo del tema
 * —6 dB por debajo de su nivel medio—. Eso es lo que hay que solapar para que la
 * vuelta siguiente entre sin agujero.
 */
function measureMusic(wav) {
  const env = envelope(wav, 0.1);
  const body = Math.sqrt(env.reduce((s, e) => s + e.rms ** 2, 0) / env.length);
  const full = body / 2; // −6 dB
  let i = env.length - 1;
  while (i > 0 && env[i].rms < full) i--;
  return {
    secs: Number(wav.secs.toFixed(2)),
    tail: Number(Math.min(Math.max(wav.secs - env[i].at, 1), 12).toFixed(2)),
    gain: gainFor(db(body), MUSIC_DB),
    rmsDb: db(body),
  };
}

const line = (name, file, m, extra) =>
  `${name.padEnd(9)} ${file.split('/').pop().replace('.wav', '').padEnd(22)} ` +
  `${m.secs.toFixed(2).padStart(6)}s  ${m.rmsDb.toFixed(1).padStart(5)} dB → ×${m.gain}  ${extra}`;

const sfx = {};
console.log('efecto    archivo                   audible    RMS         arranque / pico');
for (const [key, file] of Object.entries(PICKS)) {
  const m = await download(file);
  const s = measureSfx(m);
  console.log(line(key, file, s, `${(s.onset * 1000).toFixed(0)} ms / ${(s.lead * 1000).toFixed(0)} ms`));
  sfx[key] = { file, secs: s.secs, onset: s.onset, lead: s.lead, gain: s.gain };
}

const music = {};
console.log('\ntema      archivo                    entero    RMS         fundido final');
for (const [key, file] of Object.entries(TRACKS)) {
  const m = await download(file);
  const s = measureMusic(m);
  console.log(line(key, file, s, `${s.tail.toFixed(1)} s`));
  music[key] = { file, secs: s.secs, tail: s.tail, gain: s.gain };
}

const dump = (obj) =>
  Object.entries(obj)
    .map(([key, v]) => `  ${key}: ${JSON.stringify(v)},`)
    .join('\n')
    .replaceAll('"', "'");

writeFileSync(
  OUT,
  `// GENERADO por \`npm run sfx\` desde ${REPO}@${REF} — no editar a mano.
//
// Los sonidos del kit, medidos: \`onset\` es el silencio que hay que saltear al
// arrancar, \`lead\` cuánto tarda en llegar al pico —para que el pico caiga sobre el
// impacto y no después—, \`secs\` cuánto se oye y \`gain\` lo que hay que corregirle
// para que todos suenen parejos. El wav se pide al CDN la primera vez que hace falta.
export const SFX_BASE = '${CDN}';

export const SOUNDS = {
${dump(sfx)}
};

/** Los temas de fondo. \`tail\` es el fundido del final, que es por donde se empalma. */
export const MUSIC = {
${dump(music)}
};

/** La URL de un sonido del catálogo. */
export const soundUrl = (clip) => \`\${SFX_BASE}\${clip.file}\`;
`,
);
console.log(`\n→ ${OUT}`);
