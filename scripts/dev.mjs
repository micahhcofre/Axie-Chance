// Servidor de desarrollo: sirve el repo sin caché y recarga el navegador solo cuando
// cambia un archivo. Los módulos ES se piden por HTTP, y con `python -m http.server`
// el navegador se los queda cacheados: al editar `src/` la página seguía mostrando la
// versión vieja. Acá cada respuesta va con `no-store`, así un F5 siempre trae lo último.
//
// También es el cartero de la partida en red: la partida la corre el navegador de
// quien crea la sala (ver `src/rooms.js`), y este proceso lleva los mensajes por
// WebSocket con la misma lógica que corre en AWS (ver `relay/core.mjs`). Desde otro
// aparato de la misma red se llega con la dirección que imprime al arrancar.
//
//   npm start            # http://localhost:8000
//   PORT=3000 npm start
import { createServer } from 'node:http';
import { watch, readdirSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRelay, memoryStore } from '../relay/core.mjs';
import { acceptWebSocket } from './ws.mjs';

const ROOT = normalize(join(fileURLToPath(import.meta.url), '..', '..'));
const PORT = Number(process.env.PORT ?? 8000);
// Ni el build ni el historial hacen falta para jugar, y vigilarlos dispara recargas de más.
const IGNORED = ['dist', '.git', 'node_modules'];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

// Se inyecta al final del HTML: escucha el canal SSE y recarga cuando el server avisa.
const LIVE_RELOAD = `
<script>
  (() => {
    const es = new EventSource('/__dev');
    es.onmessage = (e) => { if (e.data === 'reload') location.reload(); };
    // Si el server se cae, reintenta solo: al volver a levantarlo la página se refresca.
    es.onerror = () => {};
  })();
</script>`;

/** Clientes SSE conectados. Se les avisa a todos en cada cambio. */
const clients = new Set();

/** Las conexiones abiertas al cartero, por id. */
const sockets = new Map();
let socketCount = 0;
const relay = createRelay({
  store: memoryStore(),
  async post(conn, text) {
    const ws = sockets.get(conn);
    if (!ws) return false;
    ws.send(text);
    return true;
  },
});

/**
 * Las direcciones por las que se llega a este servidor desde otro aparato. `localhost`
 * no sirve para eso —desde el celular apunta al celular—, así que hay que darle la IP
 * de la red, y buscarla a mano es la parte que hace que nadie lo pruebe.
 */
function lanUrls() {
  const out = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) out.push(`http://${net.address}:${PORT}`);
    }
  }
  return out;
}

function serverUrls(req) {
  if (process.env.PUBLIC_URL) return [process.env.PUBLIC_URL];
  const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
  if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
    const proto = req?.headers?.['x-forwarded-proto'] || 'http';
    return [`${proto}://${host}`];
  }
  return lanUrls();
}

let pending = null;
function notify() {
  // Guardar un archivo dispara varios eventos; se juntan en una sola recarga.
  clearTimeout(pending);
  pending = setTimeout(() => {
    for (const res of clients) res.write('data: reload\n\n');
  }, 80);
}

function startWatching() {
  const onFileChange = (_event, name) => {
    if (!name) return;
    const [top] = name.split(sep);
    if (IGNORED.includes(top) || name.startsWith('.')) return;
    console.log(`  ~ ${name}`);
    notify();
  };

  try {
    watch(ROOT, { recursive: true }, onFileChange);
  } catch (err) {
    if (err?.code === 'ERR_FEATURE_UNAVAILABLE_ON_PLATFORM') {
      const watchDir = (d) => {
        try {
          watch(d, (_ev, filename) => {
            const rel = d === ROOT ? filename : join(d.slice(ROOT.length + 1), filename ?? '');
            onFileChange(_ev, rel);
          });
        } catch {}
      };
      watchDir(ROOT);
      const walk = (d) => {
        try {
          for (const entry of readdirSync(d, { withFileTypes: true })) {
            if (entry.isDirectory() && !IGNORED.includes(entry.name) && !entry.name.startsWith('.')) {
              const sub = join(d, entry.name);
              watchDir(sub);
              walk(sub);
            }
          }
        } catch {}
      };
      walk(ROOT);
    } else {
      throw err;
    }
  }
}

startWatching();

const sendJson = (res, code, body) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

/**
 * Resuelve la URL a un archivo dentro del repo, o null si se escapa de ROOT o si no
 * se puede leer. Un pedido malformado —`//`, un `%` suelto— hacía explotar `new URL`
 * y con eso se caía el servidor entero: acá se trata como "no existe" y listo.
 */
function resolve(url) {
  let path;
  try {
    path = decodeURIComponent(new URL(url, 'http://x').pathname);
  } catch {
    return null;
  }
  const file = normalize(join(ROOT, path === '/' ? 'index.html' : path));
  return file.startsWith(ROOT) ? file : null;
}

const server = createServer(async (req, res) => {
  // Una excepción suelta acá tumbaba el servidor y había que levantarlo a mano en
  // mitad de una sesión de trabajo. Ningún pedido vale eso.
  try {
    await handle(req, res);
  } catch (err) {
    console.error(`  ! ${req.method} ${req.url}: ${err.message}`);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Error del servidor de desarrollo');
  }
});

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');

  // ---- la partida en red -----------------------------------------------------
  // La página pregunta por acá dónde está el cartero. Publicado, `net.json` es un
  // archivo que escribe el deploy; acá se contesta en el momento, con las direcciones
  // de la red para el QR (ver `roomLink` en `net.js`).
  if (url.pathname === '/net.json') {
    return sendJson(res, 200, { ws: '/net/ws', urls: serverUrls(req) });
  }

  if (req.url === '/__dev') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    });
    res.write('retry: 500\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  const file = resolve(req.url);
  const send = (code, body, type = 'text/plain; charset=utf-8') => {
    res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(body);
  };

  if (!file) return send(403, 'Fuera del repo');
  try {
    const info = await stat(file);
    if (info.isDirectory()) return send(404, 'No encontrado');
    const type = TYPES[extname(file)] ?? 'application/octet-stream';
    const body = await readFile(file);
    send(200, type.startsWith('text/html') ? body + LIVE_RELOAD : body, type);
  } catch {
    send(404, `No encontrado: ${req.url}`);
  }
}

// El WebSocket del cartero. Cada conexión tiene su id, como en API Gateway.
server.on('upgrade', (req, socket, head) => {
  if (new URL(req.url, 'http://x').pathname !== '/net/ws') {
    socket.destroy();
    return;
  }
  const conn = `c${++socketCount}${Math.random().toString(36).slice(2, 8)}`;
  const report = (err) => console.error(`  ! sala: ${err.message}`);
  const ws = acceptWebSocket(req, socket, head, {
    onMessage: (text) => relay.message(conn, text).catch(report),
    onClose: () => {
      sockets.delete(conn);
      relay.disconnect(conn).catch(report);
    },
  });
  if (ws) sockets.set(conn, ws);
});

server.listen(PORT, () => {
  console.log(`Axie Chance en http://localhost:${PORT} · sin caché, recarga sola al guardar`);
  const urls = lanUrls();
  if (urls.length) {
    console.log('\nPara jugar contra otro aparato de la misma red, los dos entran a:');
    for (const u of urls) console.log(`  ${u}/?red`);
    console.log('Uno crea la sala, el otro entra, y los dos aprietan Listo.');
  } else {
    console.log('\nSin red: la partida en red solo llega hasta esta misma máquina.');
  }
});
