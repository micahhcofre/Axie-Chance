// Servidor de desarrollo: sirve el repo sin caché y recarga el navegador solo cuando
// cambia un archivo. Los módulos ES se piden por HTTP, y con `python -m http.server`
// el navegador se los queda cacheados: al editar `src/` la página seguía mostrando la
// versión vieja. Acá cada respuesta va con `no-store`, así un F5 siempre trae lo último.
//
// También es el servidor de la partida en red: la sala vive acá adentro (ver
// `net.mjs`) y se llega desde otro aparato de la misma red con la dirección que este
// mismo proceso imprime al arrancar.
//
//   npm start            # http://localhost:8000
//   PORT=3000 npm start
import { createServer } from 'node:http';
import { watch } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLobby } from './net.mjs';

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

/** Las salas. Las crea quien las necesita desde la pantalla. */
const lobby = createLobby();

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

/** El cuerpo de un POST, con un tope: nadie tiene por qué mandar más que una acción. */
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4096) throw new Error('cuerpo demasiado grande');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

let pending = null;
function notify() {
  // Guardar un archivo dispara varios eventos; se juntan en una sola recarga.
  clearTimeout(pending);
  pending = setTimeout(() => {
    for (const res of clients) res.write('data: reload\n\n');
  }, 80);
}

watch(ROOT, { recursive: true }, (_event, name) => {
  if (!name) return;
  const [top] = name.split(sep);
  if (IGNORED.includes(top) || name.startsWith('.')) return;
  console.log(`  ~ ${name}`);
  notify();
});

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
  // La página pregunta por acá si el servidor que la sirvió sabe de partidas en red:
  // abierta como archivo suelto o con un servidor estático cualquiera, no contesta y
  // el botón de jugar en red no aparece.
  if (url.pathname === '/net/hello') {
    return sendJson(res, 200, { net: true, urls: lanUrls() });
  }

  // La lista de salas, y crear una. Se pide de a ratos mientras se mira el lobby: son
  // cuatro datos por sala y cambian poco, así que no vale un stream propio.
  if (url.pathname === '/net/rooms') {
    if (req.method === 'POST') {
      const room = lobby.create();
      return sendJson(res, 200, { room: room.info() });
    }
    return sendJson(res, 200, { rooms: lobby.list(), urls: lanUrls() });
  }

  if (url.pathname === '/net/stream') {
    const id = url.searchParams.get('id');
    const room = lobby.get(url.searchParams.get('sala'));
    if (!id) return sendJson(res, 400, { why: 'falta el id' });
    if (!room) return sendJson(res, 404, { why: 'esa sala ya no está' });
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    });
    res.write('retry: 1000\n\n');
    const leave = room.attach(id, res);
    req.on('close', leave);
    return undefined;
  }

  if (url.pathname === '/net/act') {
    if (req.method !== 'POST') return sendJson(res, 405, { why: 'usá POST' });
    let msg;
    try {
      msg = JSON.parse(await readBody(req));
    } catch {
      return sendJson(res, 400, { why: 'no se entiende' });
    }
    const room = lobby.get(msg.sala);
    if (!room) return sendJson(res, 404, { sent: false, why: 'esa sala ya no está' });
    const done = room.act(msg.id, msg.action, msg.arg);
    return sendJson(res, done.sent ? 200 : 409, done);
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
