// El cable de la partida en red, del lado del navegador: un WebSocket al cartero de
// las salas (ver `relay/core.mjs`) que se vuelve a conectar solo si se corta.
//
// Dos cosas del camino obligan a envolver lo que el anfitrión le manda a cada pantalla:
//
// - **El tamaño.** API Gateway no deja pasar mensajes de más de 32 KB, y un estado de
//   la partida pesa eso al arrancar y crece con el registro. Comprimido pesa un
//   séptimo; si igual no entra, va en pedazos.
// - **El orden.** En AWS cada mensaje despierta su propia Lambda, y dos que salen
//   seguidos pueden llegar al revés. Cada envío lleva su número (`n`) y quien lo recibe
//   descarta lo que llegue más viejo que lo último que ya dibujó (ver `net.js`).

/** Cada cuánto un latido: API Gateway corta la conexión tras 10 minutos de silencio. */
const LINK_BEAT = 4 * 60_000;
/** Cuánto entra en cada pedazo, dejando lugar al sobre: base64 es ASCII, JSON no. */
const PART_ZIP = 24_000;
const PART_TEXT = 8_000;

async function gzipBase64(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

async function gunzipBase64(b64) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

/**
 * Un mensaje para otra pantalla, listo para el cable: comprimido si vale la pena y en
 * los pedazos que hagan falta. Cada pedazo es `{ i, of, z }` (comprimido) o
 * `{ i, of, j }` (texto); el número de envío (`n`) lo pone quien lo manda.
 */
export async function packMessage(msg) {
  const json = JSON.stringify(msg);
  const zip = json.length > 1024 && typeof CompressionStream === 'function';
  const data = zip ? await gzipBase64(json) : json;
  const size = zip ? PART_ZIP : PART_TEXT;
  const of = Math.max(1, Math.ceil(data.length / size));
  return Array.from({ length: of }, (_, i) => ({
    i, of, [zip ? 'z' : 'j']: data.slice(i * size, (i + 1) * size),
  }));
}

/**
 * Abre el cable. `onMessage(msg, n)` recibe lo que manda el cartero (`n` sin definir)
 * y lo que manda el anfitrión, ya armado y con su número de envío.
 */
export function openLink(url, { onOpen, onClose, onMessage }) {
  let ws = null;
  let open = false;
  let stopped = false;
  let wait = 800;
  let retry = null;
  /** Los envíos que llegan en pedazos, por número. */
  const pieces = new Map();

  async function assemble(m) {
    const n = Number(m.n);
    const of = Number(m.of);
    const i = Number(m.i);
    if (!Number.isInteger(n) || !(of >= 1 && of <= 40) || !(i >= 0 && i < of)) return;
    const got = pieces.get(n) ?? { parts: new Array(of), count: 0 };
    if (got.parts[i] === undefined) got.count++;
    got.parts[i] = m;
    pieces.set(n, got);
    if (got.count < of) return;
    pieces.delete(n);
    // Pedazos de envíos que no se completaron nunca: se tiran para no juntar basura.
    for (const k of pieces.keys()) if (k < n - 50) pieces.delete(k);
    try {
      const text = got.parts.every((p) => typeof p.z === 'string')
        ? await gunzipBase64(got.parts.map((p) => p.z).join(''))
        : got.parts.map((p) => p.j ?? '').join('');
      onMessage(JSON.parse(text), n);
    } catch {
      // Un envío que no se entiende se tira: el próximo estado lo reemplaza entero.
    }
  }

  function start() {
    if (stopped) return;
    let sock;
    try {
      sock = new WebSocket(url);
    } catch {
      retry = setTimeout(start, wait);
      return;
    }
    ws = sock;
    // Lo que diga un socket que ya fue reemplazado no cuenta.
    sock.onopen = () => {
      if (ws !== sock) return;
      open = true;
      wait = 800;
      onOpen?.();
    };
    sock.onmessage = (e) => {
      if (ws !== sock) return;
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg?.t === 'msg' && msg.m) assemble(msg.m);
      else if (msg) onMessage(msg);
    };
    sock.onerror = () => {};
    sock.onclose = () => {
      if (ws !== sock) return;
      const was = open;
      open = false;
      ws = null;
      if (stopped) return;
      onClose?.(was);
      retry = setTimeout(start, wait);
      wait = Math.min(wait * 2, 8000);
    };
  }

  const beat = setInterval(() => link.onBeat?.(), LINK_BEAT);
  beat.unref?.();

  const link = {
    get open() { return open; },
    /** Manda si hay cable. Sin cable no se encola: al volver se rehace todo. */
    send(body) {
      if (!open) return false;
      ws.send(JSON.stringify(body));
      return true;
    },
    /** Espera a que lo mandado salga del navegador, con un tope. Sirve antes de irse. */
    async flushed(limit = 1500) {
      const until = Date.now() + limit;
      while (open && ws?.bufferedAmount > 0 && Date.now() < until) {
        await new Promise((r) => setTimeout(r, 30));
      }
    },
    /** Lo que se hace en cada latido; lo pone quien abrió el cable. */
    onBeat: null,
    close() {
      stopped = true;
      clearTimeout(retry);
      clearInterval(beat);
      ws?.close();
    },
  };
  start();
  return link;
}
