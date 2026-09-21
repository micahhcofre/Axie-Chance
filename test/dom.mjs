// Un DOM de mentira, lo mínimo que `ui.js` toca.
//
// Lo usan el test de render y el del cliente de red, y por eso vive aparte: los dos
// montan la misma pantalla, y una lista de ids escrita dos veces se desincroniza en
// cuanto alguien agrega un nodo.
export const IDS = [
  'scoreboard', 'clock', 'arena', 'fighter-p1', 'fighter-p2', 'plate-p1', 'plate-p2',
  'axie-p1', 'axie-p2', 'field', 'controls', 'swing', 'odds', 'result',
  // Los dos paneles que se abren desde la mesa: el mazo, tocando un Axie, y el
  // historial, desde el menú de las tres rayitas.
  'peek-p1', 'peek-p2', 'deck-modal', 'deck', 'deck-label', 'deck-sheet',
  'log-btn', 'log-modal', 'log',
  'rules-btn', 'rules-modal',
  'symbols-btn', 'symbols-modal',
  'market', 'vfx', 'chainfx',
  // El menú de las tres rayitas: el sonido con sus dos perillas, y lo que abre otra
  // pantalla. `menu-btn` lo prende la portada, o la sala en una partida en red, que
  // antes de abandonar pregunta en `quit-modal`.
  'hud-btn', 'hud-menu', 'hud-close', 'lobby-settings-btn', 'lang-btn', 'sfx-btn', 'music-btn',
  'sfx-vol', 'music-vol', 'sfx-pct', 'music-pct', 'menu-btn', 'quit-modal', 'quit-note',
  // Las salas de la red (ver `net.js`). No las toca `ui.js`, pero el DOM es uno solo.
  'net', 'net-title', 'net-note', 'net-urls', 'net-list',
  'net-lobby', 'net-room', 'net-rooms', 'net-seats', 'net-create', 'net-close', 'net-ready',
  // Con qué Axie entrás a la sala. El botón abre la pantalla de elección de la
  // portada, que es la única del juego donde se elige (ver `main.js`).
  'net-axie', 'net-axie-now', 'net-axie-art',
  // Las dos puertas de la barra —volver a la portada o salir de la sala— y el código.
  'net-home', 'net-code',
  // La invitación: el QR y el link de la sala, mientras falte alguien.
  'net-invite', 'net-qr', 'net-link',
];

/** Monta el DOM falso en los globales y devuelve los nodos por id. */
export function fakeDom() {
  const nodes = Object.fromEntries(
    IDS.map((id) => [id, {
      id, innerHTML: '', textContent: '', dataset: {}, value: '',
      hidden: false, handlers: {},
      addEventListener(type, fn) { this.handlers[type] = fn; },
      showModal() { this.open = true; },
      setAttribute(name, value) { this[name] = value; },
      // El color de la clase, que se cuelga del peleador para el aro del turno.
      style: { props: {}, setProperty(name, value) { this.props[name] = value; } },
      // Lo mínimo que necesita el número de daño flotante (ver `playHit` en ui.js).
      insertAdjacentHTML(_pos, html) { this.innerHTML += html; },
      querySelector() { return null; },
    }]),
  );

  const makeNode = (tag = 'div', id = '') => {
    const node = {
      tagName: tag.toUpperCase(),
      id,
      innerHTML: '',
      textContent: '',
      dataset: {},
      classList: {
        _set: new Set(),
        add(c) { this._set.add(c); },
        remove(c) { this._set.delete(c); },
        toggle(c, force) { if (force !== undefined) { if (force) this.add(c); else this.remove(c); } else { if (this._set.has(c)) this.remove(c); else this.add(c); } },
        contains(c) { return this._set.has(c); },
      },
      value: '',
      hidden: false,
      handlers: {},
      children: [],
      addEventListener(type, fn) { this.handlers[type] = fn; },
      showModal() { this.open = true; },
      setAttribute(name, value) { this[name] = value; },
      getAttribute(name) { return this[name] ?? null; },
      style: { props: {}, setProperty(name, value) { this.props[name] = value; } },
      insertAdjacentHTML(_pos, html) { this.innerHTML += html; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
      },
      removeChild(child) {
        this.children = this.children.filter((c) => c !== child);
        child.parentNode = null;
        return child;
      },
      remove() { this.parentNode?.removeChild?.(this); },
    };
    return node;
  };

  const body = makeNode('body', 'body');
  globalThis.document = {
    body,
    getElementById: (id) => nodes[id] ?? null,
    createElement: (tag) => makeNode(tag),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
  };
  // Los dos almacenamientos, que no son lo mismo y por eso están los dos: el
  // `localStorage` es del navegador entero —ahí se fija el mezclador si el jugador dejó
  // el sonido prendido (ver `audio.js`)— y el `sessionStorage` es de esta pantalla, que
  // es donde vive el id con el que se pide asiento en una sala (ver `net.js`).
  const bag = () => {
    const store = new Map();
    return {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    };
  };
  globalThis.localStorage = bag();
  globalThis.sessionStorage = bag();
  return nodes;
}
