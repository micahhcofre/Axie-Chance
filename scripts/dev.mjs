// Servidor de desarrollo: sirve el repo sin caché y recarga el navegador solo cuando
// cambia un archivo. Los módulos ES se piden por HTTP, y con `python -m http.server`
// el navegador se los queda cacheados: al editar `src/` la página seguía mostrando la
// versión vieja. Acá cada respuesta va con `no-store`, así un F5 siempre trae lo último.
//
//   npm start            # http://localhost:8000
//   PORT=3000 npm start
import { createServer } from 'node:http';
import { watch } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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

/** Resuelve la URL a un archivo dentro del repo, o null si se escapa de ROOT. */
function resolve(url) {
  const path = decodeURIComponent(new URL(url, 'http://x').pathname);
  const file = normalize(join(ROOT, path === '/' ? 'index.html' : path));
  return file.startsWith(ROOT) ? file : null;
}

const server = createServer(async (req, res) => {
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
});

server.listen(PORT, () => {
  console.log(`Axie Chance en http://localhost:${PORT} · sin caché, recarga sola al guardar`);
});
