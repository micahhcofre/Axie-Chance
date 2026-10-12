// Banco de rendimiento: abre el juego en un Chrome sin cabeza y mide tres momentos.
//
//   carga    cuánto tarda el código en estar listo con 80 ms de latencia (una red de
//            teléfono, o CloudFront lejos): ahí se ve la cascada de imports.
//   reposo   la mesa con el turno tuyo y nadie tocando nada, que es la mayor parte de
//            una partida. Lo ideal es que la página no haga nada: cuadros del hilo
//            principal por segundo, cuánto trabaja y cuánto repinta.
//   partida  diez segundos de partida contra la CPU con una semilla fija: cuadros por
//            segundo, el costo de cada repintado de la mesa (`onState`) y el estilo y
//            layout que se van. Sin GPU el hilo principal sale siempre lleno —Chrome
//            dibuja tan rápido como puede—: ahí lo que cuenta son los cuadros.
//
// Sin dependencias: sirve el repo con su propio servidor, cambia `src/main.js` por el
// arnés de abajo y maneja Chrome por DevTools Protocol con el WebSocket de Node. Usa
// el `chrome-headless-shell` que deja puppeteer en `~/.cache`, o el de `CHROME`.
//
//   npm run perf                      los tres, con la placa de video
//   npm run perf -- --throttle 4      con el procesador 4 veces más lento (un teléfono)
//   npm run perf -- --no-gpu          WebGL y pintado por software
//   npm run perf -- --only reposo
//
// Los números absolutos dependen de la máquina; sirven para comparar antes y después
// de un cambio en la misma máquina. Lo que vigila `test/perf.test.js` salió de acá.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const GPU = !flag('no-gpu');
const THROTTLE = Number(option('throttle', 1));
const ONLY = option('only', null);
const SEED = Number(option('seed', 7));

function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const cache = join(homedir(), '.cache/puppeteer/chrome-headless-shell');
  if (existsSync(cache)) {
    for (const version of readdirSync(cache).sort().reverse()) {
      for (const sub of ['chrome-headless-shell-mac-arm64', 'chrome-headless-shell-mac-x64', 'chrome-headless-shell-linux64']) {
        const bin = join(cache, version, sub, 'chrome-headless-shell');
        if (existsSync(bin)) return bin;
      }
    }
  }
  throw new Error('No encontré Chrome: `npx @puppeteer/browsers install chrome-headless-shell@stable` o CHROME=/ruta/al/binario');
}

// ---- el arnés que corre adentro de la página -------------------------------------
// Toma el lugar de `src/main.js`. Monta la mesa sin portada, juega y deja el resultado
// en `#perf-out` con el título en DONE. En reposo avisa con MEASURE cuándo empezar a
// grabar, para que la traza no cuente la carga.
const HARNESS = `
const q = new URLSearchParams(location.search);
const mode = q.get('mode');
const out = {};
const done = () => {
  const pre = document.createElement('pre');
  pre.id = 'perf-out';
  pre.textContent = JSON.stringify(out);
  document.body.append(pre);
  document.title = 'DONE';
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
if (mode === 'carga') {
  await import('./src/main.js');
  out.ready = Math.round(performance.now());
  done();
} else {
  const { createGame } = await import('./src/game.js');
  const { mount } = await import('./src/ui.js');
  document.getElementById('lobby').hidden = true;
  const game = createGame({ seed: ${SEED}, pace: mode === 'reposo' ? 1 : 0.3 });
  const renders = [];
  const subscribe = game.subscribe.bind(game);
  game.subscribe = (fn) => subscribe((s) => { const t = performance.now(); fn(s); renders.push(performance.now() - t); });
  mount(game, { start: false });
  game.newMatch({ mode: 'cpu', difficulty: 'duro', axie: 'aquatic' });
  if (mode === 'reposo') {
    const callers = {};
    const raf = window.requestAnimationFrame.bind(window);
    await wait(4000);
    window.requestAnimationFrame = (fn) => {
      const at = (new Error().stack.split('\\n')[2] || '').trim().replace(location.origin, '');
      callers[at] = (callers[at] || 0) + 1;
      return raf(fn);
    };
    document.title = 'MEASURE';
    await wait(5000);
    out.raf = callers;
    out.animations = document.getAnimations().filter((a) => a.playState === 'running').length;
  } else {
    let busy = false;
    const drive = setInterval(async () => {
      const s = game.state;
      if (!s || busy) return;
      busy = true;
      try {
        if (s.phase === 'turn' && s.turn === 'p1') await (s.chains.p1.cards.length < 3 ? game.hit() : game.stand());
        else if (s.phase === 'draft' && game.drafter() === 'p1') await game.skipDraft();
      } finally { busy = false; }
    }, 60);
    await wait(10000);
    clearInterval(drive);
    const sorted = [...renders].sort((a, b) => a - b);
    const at = (p) => +(sorted[Math.floor(p * (sorted.length - 1))] ?? 0).toFixed(1);
    out.renders = { n: renders.length, p50: at(0.5), p90: at(0.9), max: at(1) };
    out.round = game.state?.round;
  }
  done();
}
`;

// ---- servidor del repo -----------------------------------------------------------
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.avif': 'image/avif', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.webp': 'image/webp',
};
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    let body;
    if (path === '/__perf.js') body = HARNESS;
    else if (path === '/' || path === '/index.html') {
      body = (await readFile(join(root, 'index.html'), 'utf8'))
        .replace(/<script type="module" src="src\/main.js"><\/script>/, '<script type="module" src="__perf.js"></script>');
    } else body = await readFile(join(root, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

// ---- Chrome por DevTools Protocol ------------------------------------------------
async function open(url, { latency = 0, trace = null } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'axie-perf-'));
  const chrome = spawn(findChrome(), [
    '--headless', '--no-sandbox', '--window-size=1366,768', `--user-data-dir=${profile}`,
    '--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1:1', '--remote-debugging-port=0',
    ...(GPU ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--disable-gpu']),
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  try {
    const ws0 = await new Promise((resolve, reject) => {
      let buf = '';
      chrome.stderr.on('data', (d) => {
        buf += d;
        const m = buf.match(/DevTools listening on (ws:\S+)/);
        if (m) resolve(m[1]);
      });
      chrome.on('exit', () => reject(new Error(`Chrome se cerró:\n${buf.slice(-800)}`)));
    });
    const pages = await (await fetch(`http://127.0.0.1:${new URL(ws0).port}/json`)).json();
    const ws = new WebSocket(pages.find((p) => p.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let id = 0;
    const pending = new Map();
    const events = [];
    let traced = null;
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) {
        pending.get(m.id)(m.result);
        pending.delete(m.id);
      } else if (m.method === 'Tracing.dataCollected') {
        for (const ev of m.params.value) if (ev.ph === 'M' || trace.test(ev.name)) events.push(ev);
      } else if (m.method === 'Tracing.tracingComplete') traced?.();
      else if (m.method === 'Runtime.exceptionThrown') {
        console.error('  error en la página:', m.params.exceptionDetails.exception?.description?.split('\n')[0]);
      }
    });
    const send = (method, params = {}) => new Promise((r) => {
      const i = ++id;
      pending.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
    await send('Runtime.enable');
    await send('Network.enable');
    await send('Network.setCacheDisabled', { cacheDisabled: true });
    if (latency) await send('Network.emulateNetworkConditions', { offline: false, latency, downloadThroughput: 20e6 / 8, uploadThroughput: 5e6 / 8 });
    if (THROTTLE > 1) await send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    const startTrace = () => send('Tracing.start', {
      transferMode: 'ReportEvents',
      traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'toplevel', 'blink', 'cc'] },
    });
    let tracing = false;
    if (trace && !url.includes('mode=reposo')) {
      tracing = true;
      await startTrace();
    }
    await send('Page.navigate', { url });
    const started = Date.now();
    for (;;) {
      if (Date.now() - started > 90_000) throw new Error(`la página no terminó: ${url}`);
      const r = await send('Runtime.evaluate', { expression: "[document.title, document.getElementById('perf-out')?.textContent]", returnByValue: true });
      const [title, text] = r?.result?.value ?? [];
      if (trace && !tracing && title === 'MEASURE') {
        tracing = true;
        await startTrace();
      }
      if (title === 'DONE') {
        if (tracing) {
          const complete = new Promise((r2) => { traced = r2; });
          await send('Tracing.end');
          await complete;
        }
        return { out: JSON.parse(text), events };
      }
      await new Promise((r2) => setTimeout(r2, 200));
    }
  } finally {
    const exited = new Promise((r) => chrome.once('exit', r));
    chrome.kill();
    await exited;
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

/** Los totales de la traza para el hilo principal de la página. */
function mainThread(events) {
  const names = new Map();
  for (const e of events) if (e.ph === 'M' && e.name === 'thread_name') names.set(`${e.pid}:${e.tid}`, e.args.name);
  const main = events.filter((e) => e.ph === 'X' && names.get(`${e.pid}:${e.tid}`) === 'CrRendererMain');
  const ms = (name) => main.filter((e) => e.name === name).reduce((sum, e) => sum + e.dur / 1000, 0);
  const count = (name) => main.filter((e) => e.name === name).length;
  const long = main.filter((e) => e.name === 'RunTask' && e.dur > 50_000).length;
  return {
    busy: ms('ThreadControllerImpl::RunTask'), style: ms('LocalFrameView::UpdateStyleAndLayout'),
    paints: count('Paint'), frames: count('ProxyMain::BeginMainFrame'), long,
  };
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const TRACE = /^(ThreadControllerImpl::RunTask|RunTask|LocalFrameView::UpdateStyleAndLayout|Paint|ProxyMain::BeginMainFrame)$/;

console.log(`Axie Chance · perf · ${GPU ? 'con GPU' : 'sin GPU'}${THROTTLE > 1 ? ` · CPU x${THROTTLE} más lenta` : ''} · semilla ${SEED}\n`);
try {
  if (!ONLY || ONLY === 'carga') {
    const runs = [];
    for (let i = 0; i < 3; i++) runs.push((await open(`${origin}/?mode=carga`, { latency: 80 })).out.ready);
    console.log(`carga    código listo con 80 ms de latencia: ${median(runs)} ms (mediana de ${runs.map((r) => r).join(', ')})`);
  }
  if (!ONLY || ONLY === 'reposo') {
    const { out, events } = await open(`${origin}/?mode=reposo`, { trace: TRACE });
    const m = mainThread(events);
    console.log(`reposo   por segundo: ${(m.frames / 5).toFixed(0)} cuadros del hilo principal, ${(m.busy / 5).toFixed(0)} ms de trabajo, ` +
      `${(m.style / 5).toFixed(0)} ms de estilo y layout, ${(m.paints / 5).toFixed(0)} repintados · ${out.animations} animaciones vivas`);
    const loops = Object.entries(out.raf).sort((a, b) => b[1] - a[1]);
    for (const [at, n] of loops) console.log(`         requestAnimationFrame ${(n / 5).toFixed(0)}/s ${at}`);
  }
  if (!ONLY || ONLY === 'partida') {
    const { out, events } = await open(`${origin}/?mode=partida`, { trace: TRACE });
    const m = mainThread(events);
    console.log(`partida  10 s, ronda ${out.round}: ${(m.frames / 10).toFixed(0)} cuadros/s, hilo principal ${m.busy.toFixed(0)} ms, estilo y layout ${m.style.toFixed(0)} ms, ` +
      `${m.long} tareas de más de 50 ms · repintado de la mesa p50 ${out.renders.p50} ms, p90 ${out.renders.p90} ms, máx ${out.renders.max} ms (${out.renders.n})`);
  }
} finally {
  server.close();
}
