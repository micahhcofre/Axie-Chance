// El cartero de las salas en red.
//
// La partida no vive acá: vive en el navegador de quien creó la sala (ver
// `src/rooms.js`). Esto solo sabe tres cosas —qué salas hay, quién es el anfitrión de
// cada una y quiénes están enganchados— y lleva mensajes entre ellos sin abrirlos.
// Por eso no necesita estar prendido esperando: en AWS corre como una Lambda que se
// despierta con cada mensaje (ver `lambda.mjs`), y en `npm start` corre adentro del
// servidor de desarrollo con la memoria como almacén (ver `scripts/dev.mjs`).
//
// Lo de afuera escribe siempre como `{ a: 'acción', ... }` y el cartero contesta como
// `{ t: 'tipo', ... }`. Lo que el anfitrión le manda a una pantalla va envuelto en
// `{ t: 'msg', m }` y el cartero no lo mira: son estados comprimidos (ver `src/link.js`).
//
// El almacén (`store`) es asíncrono y guarda dos cosas: salas por código y conexiones
// por id. `post(conexión, texto)` devuelve `false` si esa conexión ya no existe.

/** Sin las letras y números que se confunden al leerlos (O/0, I/1, S/5). */
export const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXYZ2346789';
/** Una sala de la que el anfitrión no da noticias hace tanto, no se lista. */
export const LISTED_FOR = 10 * 60_000;
/** Cuántos pedazos puede traer un mensaje del anfitrión a una pantalla. */
const MAX_PARTS = 40;

export function randomRoomCode() {
  return Array.from({ length: 4 }, () =>
    ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]).join('');
}

/** Texto de afuera que se va a mostrar en otra pantalla: letras, números y poco más. */
const plain = (s, max) => String(s ?? '').replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, max);
const token = (s, max) => String(s ?? '').replace(/[^A-Za-z0-9=+/_-]/g, '').slice(0, max);
const bools = (o) => ({ p1: Boolean(o?.p1), p2: Boolean(o?.p2) });

/** Lo que el anfitrión cuenta de su sala, recortado a lo que la lista muestra. */
function cleanInfo(info) {
  const id = (v) => (typeof v === 'string' && /^[a-z]{1,16}$/.test(v) ? v : null);
  return {
    seats: bools(info?.seats),
    ready: bools(info?.ready),
    axies: { p1: id(info?.axies?.p1), p2: id(info?.axies?.p2) },
    playing: Boolean(info?.playing),
    round: Math.max(0, Math.min(999, Math.floor(Number(info?.round) || 0))),
  };
}

export function createRelay({ store, post, now = Date.now, newCode = randomRoomCode }) {
  const tell = (conn, msg) => post(conn, JSON.stringify(msg));

  /** El anfitrión no contesta: la sala queda sin él y las pantallas se enteran. */
  async function hostGone(room) {
    await store.updateRoom(room.code, { host: null });
    await Promise.all(Object.keys(room.peers ?? {}).map((peer) => tell(peer, { t: 'down' })));
  }

  /** Una pantalla que ya no está: se la saca de la sala y se le avisa al anfitrión. */
  async function peerGone(room, peer) {
    await store.removePeer(room.code, peer);
    await store.deleteConn(peer);
    if (room.host) await tell(room.host, { t: 'leave', peer });
  }

  const ACTIONS = {
    /**
     * Crear una sala, o volver a ser su anfitrión después de un corte. Volver pide la
     * llave con la que se creó: el código lo ve cualquiera, la llave no.
     */
    async host(conn, body) {
      const key = token(body.key, 64);
      if (key.length < 16) return tell(conn, { t: 'gone', code: null });
      if (body.code) {
        const room = await store.getRoom(token(body.code, 8).toUpperCase());
        if (!room || room.key !== key) return tell(conn, { t: 'gone', code: body.code });
        await store.updateRoom(room.code, { host: conn, updated: now() });
        await store.putConn(conn, { code: room.code, role: 'host' });
        await tell(conn, { t: 'hosted', code: room.code, name: room.name });
        // Las pantallas que siguieron enganchadas mientras el anfitrión no estaba.
        for (const [peer, id] of Object.entries(room.peers ?? {})) {
          await tell(conn, { t: 'join', peer, id });
        }
        return undefined;
      }
      const name = plain(body.name, 24);
      for (let i = 0; i < 20; i++) {
        const room = {
          code: newCode(), name, key, host: conn, peers: {}, info: null,
          created: now(), updated: now(),
        };
        if (await store.createRoom(room)) {
          await store.putConn(conn, { code: room.code, role: 'host' });
          return tell(conn, { t: 'hosted', code: room.code, name });
        }
      }
      return tell(conn, { t: 'gone', code: null });
    },

    /** El anfitrión cuenta cómo está su sala: es lo que ve la lista. */
    async info(conn, body) {
      const room = await store.getRoom(token(body.code, 8));
      if (!room || room.host !== conn) return;
      await store.updateRoom(room.code, { info: cleanInfo(body.info), updated: now() });
    },

    async list(conn) {
      const t = now();
      const all = await store.listRooms();
      // Las que quedaron sin anfitrión hace rato no las va a reclamar nadie.
      await Promise.all(all
        .filter((r) => !r.host && t - r.updated >= LISTED_FOR)
        .map((r) => store.deleteRoom(r.code)));
      const rooms = all
        .filter((r) => r.host && r.info && t - r.updated < LISTED_FOR)
        .sort((a, b) => a.created - b.created)
        .map((r) => ({ ...r.info, code: r.code, name: r.name }));
      return tell(conn, { t: 'rooms', rooms });
    },

    /** Una pantalla entra a una sala. El anfitrión decide si se sienta o mira. */
    async join(conn, body) {
      const code = token(body.code, 8).toUpperCase();
      const id = token(body.id, 64);
      const room = code && id ? await store.getRoom(code) : null;
      if (!room) return tell(conn, { t: 'gone', code });
      await store.putConn(conn, { code, role: 'guest' });
      await store.setPeer(code, conn, id);
      if (!room.host) return tell(conn, { t: 'down' });
      if (!(await tell(room.host, { t: 'join', peer: conn, id }))) {
        await hostGone({ ...room, peers: { ...room.peers, [conn]: id } });
      }
      return undefined;
    },

    /** Lo que aprieta una pantalla, para el anfitrión. */
    async act(conn, body) {
      const room = await store.getRoom(token(body.code, 8));
      if (!room?.peers?.[conn]) return;
      const msg = { t: 'act', peer: conn, action: token(body.action, 32), arg: body.arg ?? null };
      if (!room.host) return tell(conn, { t: 'down' });
      if (!(await tell(room.host, msg))) await hostGone(room);
    },

    /** Lo que el anfitrión le manda a una pantalla. No se abre: se entrega. */
    async to(conn, body) {
      const room = await store.getRoom(token(body.code, 8));
      const peer = String(body.peer ?? '');
      if (!room || room.host !== conn || !room.peers?.[peer]) return;
      const m = body.m;
      if (!m || typeof m !== 'object' || !(Number(m.of) >= 1 && Number(m.of) <= MAX_PARTS)) return;
      if (!(await tell(peer, { t: 'msg', m }))) await peerGone(room, peer);
    },

    /** El anfitrión se va: la sala se cierra para todos. */
    async close(conn, body) {
      const room = await store.getRoom(token(body.code, 8));
      if (!room || room.host !== conn) return;
      await store.deleteRoom(room.code);
      await store.deleteConn(conn);
      await Promise.all(Object.keys(room.peers ?? {}).map((peer) => tell(peer, { t: 'closed' })));
    },

    /**
     * Un latido para que el cable no se corte por silencio. El del anfitrión, además,
     * dice que la sala sigue: sin latidos, en un rato deja de listarse.
     */
    async ping(conn, body) {
      if (!body.code) return;
      const room = await store.getRoom(token(body.code, 8));
      if (room?.host === conn) await store.updateRoom(room.code, { updated: now() });
    },
  };

  return {
    /** Un mensaje de una conexión, tal como llegó. */
    async message(conn, text) {
      let body;
      try { body = JSON.parse(text); } catch { return; }
      if (!body || typeof body !== 'object' || !Object.hasOwn(ACTIONS, body.a)) return;
      await ACTIONS[body.a](conn, body);
    },

    /** Se cortó una conexión. */
    async disconnect(conn) {
      const rec = await store.getConn(conn);
      if (!rec) return;
      await store.deleteConn(conn);
      const room = await store.getRoom(rec.code);
      if (!room) return;
      if (rec.role === 'guest') {
        await store.removePeer(room.code, conn);
        if (room.host) await tell(room.host, { t: 'leave', peer: conn });
      } else if (room.host === conn) {
        await hostGone(room);
      }
    },
  };
}

/** El almacén en memoria del servidor de desarrollo, y de los tests. */
export function memoryStore() {
  const rooms = new Map();
  const conns = new Map();
  const copy = (x) => (x ? structuredClone(x) : null);
  return {
    getRoom: async (code) => copy(rooms.get(code)),
    createRoom: async (room) => {
      if (rooms.has(room.code)) return false;
      rooms.set(room.code, copy(room));
      return true;
    },
    updateRoom: async (code, fields) => { if (rooms.has(code)) Object.assign(rooms.get(code), copy(fields)); },
    deleteRoom: async (code) => { rooms.delete(code); },
    setPeer: async (code, conn, id) => { if (rooms.has(code)) rooms.get(code).peers[conn] = id; },
    removePeer: async (code, conn) => { if (rooms.has(code)) delete rooms.get(code).peers[conn]; },
    listRooms: async () => [...rooms.values()].map(copy),
    getConn: async (conn) => copy(conns.get(conn)),
    putConn: async (conn, rec) => { conns.set(conn, copy(rec)); },
    deleteConn: async (conn) => { conns.delete(conn); },
  };
}
