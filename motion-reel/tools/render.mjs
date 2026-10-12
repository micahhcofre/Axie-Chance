// Exporta el reel con Chrome sin cabeza (GPU de verdad, por Metal) y AVFoundation.
//
//   node motion-reel/tools/render.mjs video  [--fps 60] [--k 8] [--mbps 28] [--lang es] [--out x.mp4]
//   node motion-reel/tools/render.mjs stills --t 2,20.6,44 [--k 8] [--lang es] [--dir carpeta]
//   node motion-reel/tools/render.mjs sheet  [--from 0] [--to 30] [--n 24] [--k 1] [--dir carpeta]
//   node motion-reel/tools/render.mjs audio  [--out x.wav]
//
// `--comp loop` exporta la pelea en loop de la portada del juego en vez del reel (sin
// audio) y `--size 1080x1920` la saca parada.
//
// La página hace todo el trabajo (`?render=` en `src/main.js`): dibuja cada cuadro y lo
// postea acá. Los cuadros de video van directo al codificador (`encode.swift`) por su
// entrada estándar, sin tocar el disco; el audio se renderiza aparte, se pasa a AAC con
// `afconvert` y al final se junta todo sin volver a codificar.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from './serve.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const reel = path.resolve(here, '..');
const root = path.resolve(reel, '..');
const CHROME = path.join(os.homedir(), '.cache/puppeteer/chrome-headless-shell/mac_arm-152.0.7977.75/chrome-headless-shell-mac-arm64/chrome-headless-shell');

const [cmd = 'sheet', ...rest] = process.argv.slice(2);
const opt = {};
for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1];
const lang = opt.lang ?? 'es';
const comp = opt.comp ?? '';
const [VW, VH] = (opt.size ?? '1920x1080').split('x').map(Number);
const extra = `${comp ? `&comp=${comp}` : ''}${opt.size ? `&size=${opt.size}` : ''}`;
const tmp = opt.tmp ?? path.join(os.tmpdir(), 'axie-reel');
fs.mkdirSync(tmp, { recursive: true });

/** El codificador se compila una vez y se vuelve a compilar si cambia la fuente. */
function encoder() {
  const src = path.join(here, 'encode.swift');
  const bin = path.join(tmp, 'encode');
  if (!fs.existsSync(bin) || fs.statSync(bin).mtimeMs < fs.statSync(src).mtimeMs) {
    console.log('compilando encode.swift…');
    const r = spawnSync('swiftc', ['-O', '-o', bin, src], { stdio: ['ignore', 'ignore', 'pipe'] });
    if (r.status !== 0) throw new Error(`swiftc: ${r.stderr}`);
  }
  return bin;
}

function run(page, sinks, timeoutMs) {
  return new Promise(async (resolve, reject) => {
    let chrome;
    let finished = false;
    const server = await serve({
      root,
      sinks: {
        ...sinks,
        log: (b) => console.log('[reel]', b.toString()),
        done: () => {
          finished = true;
          setTimeout(() => { chrome.kill(); server.close(); clearTimeout(timer); resolve(); }, 30);
        },
      },
    });
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/motion-reel/index.html?${page}${extra}`;
    chrome = spawn(CHROME, [
      '--no-sandbox', '--hide-scrollbars', `--window-size=${VW},${VH}`, '--force-device-scale-factor=1',
      '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
      '--autoplay-policy=no-user-gesture-required',
      `--user-data-dir=${path.join(tmp, `profile-${process.pid}`)}`, url,
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    chrome.stderr.on('data', (d) => {
      const s = d.toString();
      if (/ERROR:|FATAL/.test(s) && !/(dbus|GCM|registration|DEPRECATED|gpu_process_host|viz_main)/i.test(s)) process.stderr.write(s.slice(0, 300));
    });
    chrome.on('exit', () => { if (!finished) { server.close(); clearTimeout(timer); reject(new Error('Chrome terminó antes de tiempo')); } });
    const timer = setTimeout(() => { chrome.kill(); server.close(); reject(new Error('se pasó del tiempo')); }, timeoutMs);
  });
}

async function stills() {
  const dir = opt.dir ?? path.join(tmp, 'stills');
  fs.mkdirSync(dir, { recursive: true });
  const saved = [];
  await run(`render=stills&t=${opt.t ?? '0'}&k=${opt.k ?? 8}&lang=${lang}`, {
    png: (b, q) => { const f = path.join(dir, `${q.get('name')}.png`); fs.writeFileSync(f, b); saved.push(f); },
  }, 240000);
  saved.forEach((f) => console.log(f));
}

async function sheet() {
  const dir = opt.dir ?? path.join(tmp, 'stills');
  fs.mkdirSync(dir, { recursive: true });
  await run(`render=sheet&from=${opt.from ?? 0}&to=${opt.to ?? 30}&n=${opt.n ?? 24}&cols=${opt.cols ?? 4}&k=${opt.k ?? 1}&lang=${lang}`, {
    png: (b, q) => { const f = path.join(dir, `${q.get('name')}.png`); fs.writeFileSync(f, b); console.log(f); },
  }, 300000);
}

async function audio(outFile) {
  const file = outFile ?? opt.out ?? path.join(tmp, `reel-${lang}.wav`);
  await run(`render=audio&lang=${lang}`, { wav: (b) => fs.writeFileSync(file, b) }, 240000);
  console.log(file);
  return file;
}

async function video() {
  const fps = Number(opt.fps ?? 60);
  const k = Number(opt.k ?? 8);
  const mbps = Number(opt.mbps ?? 28);
  const outDir = path.join(reel, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.resolve(opt.out ?? path.join(outDir, comp ? `${comp}-${VW}x${VH}.mp4` : `axie-chance-reel-${lang}.mp4`));
  const silent = path.join(tmp, `video-${lang}.mp4`);
  const enc = spawn(encoder(), ['video', silent, String(VW), String(VH), String(fps), String(mbps)], { stdio: ['pipe', 'inherit', 'inherit'] });
  const encDone = new Promise((resolve, reject) => enc.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`encode salió con ${c}`)))));
  const t0 = Date.now();
  let frames = 0;
  await run(`render=video&fps=${fps}&k=${k}&lang=${lang}${opt.from ? `&from=${opt.from}` : ''}${opt.to ? `&to=${opt.to}` : ''}`, {
    frame: (b) => new Promise((resolve) => {
      frames++;
      if (enc.stdin.write(b)) resolve(); else enc.stdin.once('drain', resolve);
    }),
  }, 3600000);
  enc.stdin.end();
  await encDone;
  console.log(`${frames} cuadros en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (opt.audio === 'no' || comp) { fs.copyFileSync(silent, outFile); console.log(outFile); return; }
  const wav = await audio(path.join(tmp, `reel-${lang}.wav`));
  const m4a = path.join(tmp, `reel-${lang}.m4a`);
  const r = spawnSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '256000', '-q', '127', wav, m4a], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('afconvert falló');
  // la misma banda queda para el reproductor en vivo, que así no la sintetiza al abrir
  const live = path.join(reel, 'assets', 'audio');
  fs.mkdirSync(live, { recursive: true });
  fs.copyFileSync(m4a, path.join(live, `reel-${lang}.m4a`));
  const m = spawnSync(encoder(), ['mux', silent, m4a, outFile], { stdio: 'inherit' });
  if (m.status !== 0) throw new Error('mux falló');
  console.log(outFile);
}

/** Prueba el reproductor en vivo: tapa, audio y reloj. */
async function player() {
  await run(`render=player&lang=${lang}`, {}, 60000);
}

const jobs = { stills, sheet, audio: () => audio(), video, player };
if (!jobs[cmd]) {
  console.error(`modo desconocido: ${cmd}`);
  process.exit(1);
}
jobs[cmd]().then(() => process.exit(0), (err) => { console.error(err); process.exit(1); });
