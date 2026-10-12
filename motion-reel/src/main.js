// El reproductor del reel y, con `?render=`, su propia sala de exportación.
//
//   (sin parámetros)      el reel en vivo, con la banda de sonido
//   ?t=20.6               un cuadro quieto (con ?k=8, con desenfoque de movimiento)
//   ?render=stills&t=...  fotos fijas en PNG, posteadas al servidor de `tools/render.mjs`
//   ?render=sheet         una hoja de contacto de todo el reel
//   ?render=video         cuadros crudos BGRA para el codificador
//   ?render=audio         la banda de sonido en WAV
//   ?lang=en              los textos en inglés
//   ?comp=loop            la pelea en loop de la portada del juego (ver `loop.js`), sin
//                         textos; con ?size=1080x1920, el corte parado
import { W, H, DURATION as REEL_DURATION } from './core.js';
import { loadAll } from './assets.js';
import { createPost, POST_DEFAULTS } from './post.js';
import { frame as reelFrame, postAt as reelPost } from './scenes.js';
import { frameLoop, postLoop, LOOP } from './loop.js';
import { renderScore, toWav } from './score.js';

const q = new URLSearchParams(location.search);
const mode = q.get('render');
const lang = q.get('lang') === 'en' ? 'en' : 'es';
const loopComp = q.get('comp') === 'loop';
const DURATION = loopComp ? LOOP : REEL_DURATION;
const frame = loopComp ? (B, G, t) => frameLoop(B, G, t) : reelFrame;
const postAt = loopComp ? postLoop : reelPost;
const $ = (id) => document.getElementById(id);

const base = document.createElement('canvas');
base.width = W; base.height = H;
const glowCv = document.createElement('canvas');
glowCv.width = W; glowCv.height = H;
const B = base.getContext('2d');
const G = glowCv.getContext('2d');
const out = $('screen');
// El lienzo de salida mide lo que el cuadro: el corte parado del loop es 1080×1920.
out.width = W; out.height = H;
const post = createPost(out, W, H);

const sink = (name, body, params = '') => fetch(`/sink/${name}${params}`, { method: 'POST', body });
const log = (msg) => (mode ? sink('log', String(msg)) : console.log(msg));

/**
 * Un cuadro revelado. Con `k` > 1 se promedian `k` instantes dentro de un obturador de
 * 180° (medio cuadro): el desenfoque de movimiento de una cámara de cine.
 */
function render(t, k = 1, fps = 60, toScreen = true) {
  post.begin();
  const shutter = 0.5 / fps;
  for (let i = 0; i < k; i++) {
    const ts = k === 1 ? t : t + ((i + 0.5) / k - 0.5) * shutter;
    frame(B, G, ts, lang);
    post.add(base, glowCv, 1 / k, POST_DEFAULTS.glowGain);
  }
  post.finish(postAt(t, POST_DEFAULTS), t, toScreen);
}

async function toBlob(cv) {
  return new Promise((resolve) => cv.toBlob(resolve, 'image/png'));
}

async function stills() {
  const k = Number(q.get('k') ?? 8);
  const times = (q.get('t') ?? '0').split(',').map(Number);
  for (const t of times) {
    render(t, k);
    await sink('png', await toBlob(out), `?name=${lang}-${t.toFixed(2).padStart(5, '0')}`);
  }
}

async function sheet() {
  const from = Number(q.get('from') ?? 0);
  const to = Number(q.get('to') ?? DURATION);
  const n = Number(q.get('n') ?? 24);
  const cols = Number(q.get('cols') ?? 4);
  const k = Number(q.get('k') ?? 1);
  const tw = 480;
  const th = 270;
  const rows = Math.ceil(n / cols);
  const sh = document.createElement('canvas');
  sh.width = cols * tw;
  sh.height = rows * th;
  const x = sh.getContext('2d');
  for (let i = 0; i < n; i++) {
    const t = from + ((to - from) * i) / Math.max(1, n - 1);
    render(t, k);
    const cx = (i % cols) * tw;
    const cy = Math.floor(i / cols) * th;
    x.drawImage(out, cx, cy, tw, th);
    x.fillStyle = 'rgba(0,0,0,0.6)';
    x.fillRect(cx, cy, 64, 22);
    x.fillStyle = '#fff';
    x.font = '600 15px sans-serif';
    x.fillText(t.toFixed(2), cx + 6, cy + 16);
  }
  await sink('png', await toBlob(sh), `?name=sheet-${lang}-${from}-${to}`);
}

async function video() {
  const fps = Number(q.get('fps') ?? 60);
  const k = Number(q.get('k') ?? 8);
  const from = Number(q.get('from') ?? 0);
  const to = Number(q.get('to') ?? DURATION);
  const total = Math.round((to - from) * fps);
  const px = new Uint8Array(W * H * 4);
  const started = performance.now();
  for (let f = 0; f < total; f++) {
    render(from + f / fps, k, fps, false);
    post.read(px);
    await sink('frame', px, `?i=${f}`);
    if (f % 60 === 0) log(`cuadro ${f}/${total} · ${((performance.now() - started) / 1000).toFixed(1)} s`);
  }
}

async function audio() {
  const t0 = performance.now();
  const buf = await renderScore(48000, lang);
  log(`audio en ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  await sink('wav', toWav(buf));
}

// ---- el reproductor ----

function player() {
  const hud = $('hud');
  const fill = $('fill');
  const bar = $('bar');
  const start = $('start');
  let ctx = null;
  let buffer = null;
  let source = null;
  let playing = false;
  let origin = 0; // performance.now() o ctx.currentTime del segundo 0
  let paused = 0;
  let muted = false;
  const gain = { node: null };

  // El reloj manda el audio cuando el audio corre; si el navegador lo tiene suspendido
  // (sin un toque de verdad, por ejemplo), la imagen sigue con el reloj del sistema y se
  // vuelve a enganchar al audio apenas arranca.
  let audioClock = false;
  const now = () => (audioClock ? ctx.currentTime - origin : (performance.now() / 1000) - origin);

  function play(from = 0) {
    stopAudio();
    playing = true;
    audioClock = Boolean(ctx && buffer && !muted && ctx.state === 'running');
    if (ctx && buffer && !muted) {
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gain.node);
      source.start(ctx.currentTime + 0.05, from);
    }
    origin = audioClock ? ctx.currentTime + 0.05 - from : performance.now() / 1000 - from;
  }
  function stopAudio() {
    try { source?.stop(); } catch { /* ya estaba parado */ }
    source = null;
  }
  function pause() {
    paused = Math.max(0, now());
    playing = false;
    stopAudio();
  }
  function tick() {
    const t = playing ? now() : paused;
    if (playing && t >= DURATION) {
      playing = false;
      paused = DURATION - 1e-3;
      stopAudio();
    }
    render(Math.min(t, DURATION - 1e-3), 1);
    fill.style.width = `${(Math.min(t, DURATION) / DURATION) * 100}%`;
    requestAnimationFrame(tick);
  }

  $('play').addEventListener('click', async () => {
    start.dataset.state = 'loading';
    ctx = new AudioContext();
    gain.node = ctx.createGain();
    gain.node.connect(ctx.destination);
    ctx.resume?.().catch(() => {});
    ctx.addEventListener('statechange', () => {
      if (ctx.state === 'running' && playing && !audioClock) play(now());
    });
    try {
      // la banda ya exportada (la deja `tools/render.mjs video`); si no está, se sintetiza acá
      const res = await fetch(`assets/audio/reel-${lang}.m4a`);
      if (!res.ok) throw new Error(String(res.status));
      buffer = await ctx.decodeAudioData(await res.arrayBuffer());
    } catch {
      try {
        buffer = await renderScore(ctx.sampleRate, lang);
      } catch (err) {
        console.warn('sin banda de sonido', err);
      }
    }
    start.hidden = true;
    hud.hidden = false;
    play(0);
  });
  $('replay').addEventListener('click', () => play(0));
  $('toggle').addEventListener('click', () => (playing ? pause() : play(paused)));
  $('mute').addEventListener('click', () => {
    const t = playing ? now() : paused;
    muted = !muted;
    $('mute').setAttribute('aria-pressed', String(!muted));
    if (playing) play(t); else paused = t;
  });
  bar.addEventListener('pointerdown', (e) => {
    const r = bar.getBoundingClientRect();
    const t = ((e.clientX - r.left) / r.width) * DURATION;
    if (playing) play(t); else paused = t;
  });
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); if (start.hidden) (playing ? pause() : play(paused)); }
    if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
      const t = Math.max(0, Math.min(DURATION, (playing ? now() : paused) + (e.code === 'ArrowRight' ? 1 : -1)));
      if (playing) play(t); else paused = t;
    }
  });
  requestAnimationFrame(tick);
}

/** El reproductor de verdad, apretado por un robot: ¿carga el audio y corre el reloj? */
async function selftest() {
  $('start').hidden = false;
  player();
  $('play').click();
  const t0 = performance.now();
  while (!$('start').hidden && performance.now() - t0 < 20000) await new Promise((r) => setTimeout(r, 100));
  const a = parseFloat($('fill').style.width) || 0;
  await new Promise((r) => setTimeout(r, 1500));
  const c = parseFloat($('fill').style.width) || 0;
  await log(`player: tapa ${$('start').hidden ? 'cerrada' : 'ABIERTA'} en ${((performance.now() - t0) / 1000).toFixed(1)} s, barra ${a.toFixed(2)}% → ${c.toFixed(2)}%`);
}

function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  out.style.width = `${W * s}px`;
  out.style.height = `${H * s}px`;
}

async function main() {
  fit();
  addEventListener('resize', fit);
  const bar = $('load');
  await loadAll((p) => { if (bar) bar.style.width = `${p * 100}%`; });
  document.body.dataset.ready = 'true';
  try {
    if (mode === 'stills') await stills();
    else if (mode === 'sheet') await sheet();
    else if (mode === 'video') await video();
    else if (mode === 'audio') await audio();
    else if (mode === 'player') await selftest();
    else if (q.has('t')) render(Number(q.get('t')), Number(q.get('k') ?? 1));
    else player();
  } catch (err) {
    await log(`ERROR ${err?.stack ?? err}`);
  }
  if (mode) await sink('done', 'ok');
}

addEventListener('error', (e) => log(`ERROR ${e.message} @ ${e.filename}:${e.lineno}`));
addEventListener('unhandledrejection', (e) => log(`ERROR ${e.reason?.stack ?? e.reason}`));
main();
