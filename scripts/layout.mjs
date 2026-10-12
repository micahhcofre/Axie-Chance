// Banco de pantallas: abre el juego en un Chrome sin cabeza en varios tamaños y
// comprueba que lo que se aprieta quede adentro de la ventana.
//
//   npm run layout
//   npm run layout -- --only 844x390
//
// Existe porque `npm test` corre sin navegador y no ve el CSS: los botones del turno
// quedaron debajo del borde en un teléfono acostado (844x390) con la suite en verde.
// Acá cada tamaño juega un turno contra la CPU y mide con `getBoundingClientRect`:
//
//   turno    los dos botones (robar y atacar) y el aro
//   centro   el panel del reparto, sus botones (saltar, confirmar) y el medidor de
//            compatibilidad con una carta marcada
//   mapa     pelear, las pestañas y las misiones (el panel o su botón), que no tapen
//            tu perfil, la bolsa, las estrellas ni el panel del nivel
//
// Usa el `chrome-headless-shell` que deja puppeteer en `~/.cache`, o el de `CHROME`,
// igual que `scripts/perf.mjs`. Sin dependencias.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

/** Los tamaños que se miden: teléfonos parados y acostados, y dos escritorios. */
const SIZES = [
  { name: '390x844', w: 390, h: 844, mobile: true },
  { name: '360x740', w: 360, h: 740, mobile: true },
  { name: '844x390', w: 844, h: 390, mobile: true },
  { name: '667x375', w: 667, h: 375, mobile: true },
  { name: '1366x768', w: 1366, h: 768, mobile: false },
  { name: '1920x1080', w: 1920, h: 1080, mobile: false },
].filter((s) => !only || s.name === only);

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

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.avif': 'image/avif', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.webp': 'image/webp',
};
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  try {
    const body = await readFile(join(root, path === '/' ? 'index.html' : path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Lo que se mide en la página: cada caja que tiene que quedar adentro, con su nombre.
 * Devuelve la lista de las que se salen (con cuánto) y las que no aparecieron.
 */
const MEASURE = (names) => `(() => {
  const W = innerWidth, H = innerHeight, out = [];
  for (const [name, sel] of ${JSON.stringify(names)}) {
    const el = document.querySelector(sel);
    if (!el) { out.push(name + ': no está'); continue; }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const off = [r.left < -1 && 'izq ' + Math.round(-r.left), r.top < -1 && 'arriba ' + Math.round(-r.top),
      r.right > W + 1 && 'der ' + Math.round(r.right - W), r.bottom > H + 1 && 'abajo ' + Math.round(r.bottom - H)].filter(Boolean);
    if (off.length) out.push(name + ' se sale: ' + off.join(', ') + 'px');
  }
  return JSON.stringify(out);
})()`;

/**
 * Que las misiones del mapa (el panel o, plegado o en un teléfono, su botón) no tapen lo
 * de arriba ni el panel del nivel. Devuelve los choques.
 */
const CLEAR = `(() => {
  const out = [];
  const box = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return r.width && r.height ? r : null; };
  const quests = box('#adventure-quests') || box('#adventure-quests-btn');
  if (!quests) return JSON.stringify(['misiones: no se ven']);
  const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
  for (const [name, sel] of [['perfil', '#adventure-profile'], ['bolsa', '#adventure-purse'], ['estrellas', '#adventure-progress'], ['panel del nivel', '#adventure-card']]) {
    const r = box(sel);
    if (r && hit(quests, r)) out.push('las misiones tapan ' + name + ' (' + Math.round(Math.min(quests.bottom, r.bottom) - Math.max(quests.top, r.top)) + 'px)');
  }
  return JSON.stringify(out);
})()`;

async function check({ name, w, h, mobile }) {
  const profile = mkdtempSync(join(tmpdir(), 'axie-layout-'));
  const chrome = spawn(findChrome(), [
    '--headless', '--no-sandbox', '--disable-gpu', `--window-size=${w},${h}`, `--user-data-dir=${profile}`,
    '--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1:1', '--remote-debugging-port=0', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  try {
    const wsUrl = await new Promise((resolve, reject) => {
      let buf = '';
      chrome.stderr.on('data', (d) => {
        buf += d;
        const m = buf.match(/DevTools listening on (ws:\S+)/);
        if (m) resolve(m[1]);
      });
      chrome.on('exit', () => reject(new Error(`Chrome se cerró:\n${buf.slice(-800)}`)));
    });
    const pages = await (await fetch(`http://127.0.0.1:${new URL(wsUrl).port}/json`)).json();
    const ws = new WebSocket(pages.find((p) => p.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let id = 0;
    const pending = new Map();
    const errors = [];
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) {
        pending.get(m.id)(m.result);
        pending.delete(m.id);
      } else if (m.method === 'Runtime.exceptionThrown') {
        errors.push(m.params.exceptionDetails.exception?.description?.split('\n')[0] ?? m.params.exceptionDetails.text);
      }
    });
    const send = (method, params = {}) => new Promise((r) => {
      const i = ++id;
      pending.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
    const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }))?.result?.value;
    const until = async (expression, ms = 12_000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        if (await ev(expression)) return true;
        await wait(250);
      }
      return false;
    };

    await send('Runtime.enable');
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
    // Sin la marca del tutorial, la primera pelea es el tutorial (ver `lobby.js`).
    await send('Page.addScriptToEvaluateOnNewDocument', { source: "localStorage.setItem('axie-chance:tutorial', '1')" });
    await send('Page.navigate', { url: `${origin}/` });

    const problems = [];
    if (!(await until("!!document.querySelector('#lobby-nav [data-tab=\"duel\"]') && !document.getElementById('lobby').hidden"))) {
      problems.push('la portada no cargó');
      return { name, problems, errors };
    }
    await wait(1500);
    // La portada abre en el mapa: los botones de pelear y de las pestañas, adentro.
    problems.push(...JSON.parse(await ev(MEASURE([
      ['pelear', '#lobby-adventure-play'],
      ['pestaña del mapa', '#lobby-nav [data-tab="adventure"]'],
      ['pestaña del taller', '#lobby-nav [data-tab="craft"]'],
      ['misiones', '#adventure-quests'],
      ['botón de las misiones', '#adventure-quests-btn'],
    ]))));
    problems.push(...JSON.parse(await ev(CLEAR)));
    await ev("document.querySelector('#lobby-nav [data-tab=\"duel\"]').click()");
    await wait(900);
    await ev("document.querySelector('[data-play=\"cpu\"]').click()");

    // El turno: los dos botones habilitados.
    if (!(await until("!!document.querySelector('[data-action=\"hit\"]:not([disabled])')"))) {
      problems.push('no llegó el turno');
    } else {
      await ev("document.querySelector('[data-action=\"hit\"]').click()");
      await wait(1800);
      if (await ev("!!document.querySelector('[data-action=\"stand\"]:not([disabled])')")) {
        await wait(600);
        problems.push(...JSON.parse(await ev(MEASURE([
          ['robar', '[data-action="hit"]'],
          ['atacar', '[data-action="stand"]'],
          ['aro', '.odds-dial'],
        ]))));
        await ev("document.querySelector('[data-action=\"stand\"]').click()");
      }
      // El centro: se abre después del ataque (o del corte).
      if (!(await until("!!document.querySelector('#market:not([hidden]) [data-action=\"skip\"]')", 15_000))) {
        problems.push('no se abrió el centro');
      } else {
        await wait(900);
        // Con una carta marcada: el medidor de compatibilidad se llena.
        await ev("document.querySelector('#market .market-card:not([disabled])')?.click()");
        await wait(700);
        problems.push(...JSON.parse(await ev(MEASURE([
          ['saltar', '#market [data-action="skip"]'],
          ['confirmar', '#market [data-action="confirm"]'],
          ['compatibilidad', '#market .market-fit'],
        ]))));
      }
    }
    return { name, problems, errors };
  } finally {
    const exited = new Promise((r) => chrome.once('exit', r));
    chrome.kill();
    await exited;
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

let failed = 0;
for (const size of SIZES) {
  const { name, problems, errors } = await check(size);
  if (problems.length) failed++;
  console.log(`${problems.length ? '✗' : '✓'} ${name}${problems.length ? `\n    ${problems.join('\n    ')}` : ''}`);
  if (errors.length) console.log(`    errores de la página: ${[...new Set(errors)].join(' | ')}`);
}
server.close();
process.exit(failed ? 1 : 0);
