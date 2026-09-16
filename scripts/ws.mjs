// Un servidor de WebSocket mínimo, sin dependencias, para `npm start`.
//
// En AWS el WebSocket lo atiende API Gateway (ver `relay/lambda.mjs`). En desarrollo
// hace falta uno igual para que la página hable el mismo idioma en los dos lados, y
// Node trae el cliente pero no el servidor. Esto es lo justo del RFC 6455 para el
// cartero de las salas: el saludo, mensajes de texto (también partidos en pedazos),
// ping/pong y cierre.
import { createHash } from 'node:crypto';

const MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/** Un cuadro del servidor al navegador: sin máscara, siempre entero. */
function frame(opcode, payload) {
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.from([0x80 | opcode, 126, len >> 8, len & 255]);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

/**
 * Atiende el `upgrade` de un pedido HTTP. Devuelve `{ send, close }`, o `null` si el
 * pedido no era un WebSocket.
 */
export function acceptWebSocket(req, socket, head, { onMessage, onClose, maxSize = 1 << 20 }) {
  const key = req.headers['sec-websocket-key'];
  if (!key || String(req.headers.upgrade).toLowerCase() !== 'websocket') {
    socket.destroy();
    return null;
  }
  const accept = createHash('sha1').update(key + MAGIC).digest('base64');
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '', '',
  ].join('\r\n'));
  socket.setNoDelay(true);

  let buffer = head?.length ? Buffer.from(head) : Buffer.alloc(0);
  let parts = [];
  let closed = false;
  let reported = false;

  const ws = {
    send(text) {
      if (!closed) socket.write(frame(1, Buffer.from(text)));
    },
    close() {
      if (closed) return;
      closed = true;
      socket.end(frame(8, Buffer.alloc(0)));
    },
  };

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      if (buffer.length < 2) return;
      const fin = (buffer[0] & 0x80) !== 0;
      const opcode = buffer[0] & 0x0f;
      const masked = (buffer[1] & 0x80) !== 0;
      let len = buffer[1] & 0x7f;
      let offset = 2;
      if (len === 126) {
        if (buffer.length < 4) return;
        len = buffer.readUInt16BE(2);
        offset = 4;
      } else if (len === 127) {
        if (buffer.length < 10) return;
        const big = buffer.readBigUInt64BE(2);
        if (big > BigInt(maxSize)) { socket.destroy(); return; }
        len = Number(big);
        offset = 10;
      }
      if (len > maxSize) { socket.destroy(); return; }
      const start = offset + (masked ? 4 : 0);
      if (buffer.length < start + len) return;
      const payload = Buffer.from(buffer.subarray(start, start + len));
      if (masked) {
        const mask = buffer.subarray(offset, offset + 4);
        for (let i = 0; i < len; i++) payload[i] ^= mask[i & 3];
      }
      buffer = buffer.subarray(start + len);

      if (opcode === 8) { ws.close(); return; }
      if (opcode === 9) { if (!closed) socket.write(frame(10, payload)); continue; }
      if (opcode === 10) continue;
      parts.push(payload);
      if (parts.reduce((n, p) => n + p.length, 0) > maxSize) { socket.destroy(); return; }
      if (fin) {
        const text = Buffer.concat(parts).toString('utf8');
        parts = [];
        onMessage(text);
      }
    }
  });
  const finish = () => {
    closed = true;
    if (reported) return;
    reported = true;
    onClose();
  };
  socket.on('close', finish);
  socket.on('error', () => socket.destroy());
  return ws;
}
