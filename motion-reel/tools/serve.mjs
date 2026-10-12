// Servidor del render: sirve el repo (el reel usa los assets del juego por ruta
// relativa) y recibe lo que la página le manda —cuadros, fotos fijas, el audio—.
//
// No hay CDP ni puppeteer: la página se maneja sola. Chrome sin cabeza la abre, ella
// dibuja cada cuadro y lo postea acá, y cuando termina avisa en `/sink/done`.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

/**
 * `root` es la carpeta que se sirve. `sinks` son los manejadores de cada POST, por
 * nombre (`/sink/<nombre>`): reciben el cuerpo entero como Buffer y la query.
 */
export function serve({ root, port = 0, sinks = {} }) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'POST' && url.pathname.startsWith('/sink/')) {
      const name = url.pathname.slice(6);
      const chunks = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', async () => {
        try {
          const out = await sinks[name]?.(Buffer.concat(chunks), url.searchParams);
          res.writeHead(200, { 'content-type': 'text/plain' });
          res.end(out ?? 'ok');
        } catch (err) {
          console.error(`sink ${name}:`, err);
          res.writeHead(500); res.end(String(err));
        }
      });
      return;
    }
    const file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404); res.end('404'); return; }
      res.writeHead(200, {
        'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
        'content-length': st.size,
        'cache-control': 'no-store',
      });
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}
