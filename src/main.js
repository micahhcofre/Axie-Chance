import { createGame } from './game.js';
import { mount } from './ui.js';
import { createLobby } from './lobby.js';
import { connect } from './net.js';
import { currentLang, translateDom } from './i18n.js';
import { FREE_PLAY, withFree } from './loadout.js';

// Establece el idioma del documento y traduce el HTML estático antes de montar la UI.
document.documentElement.lang = currentLang();
translateDom(document.body);

// Los dibujos no se arrastran (ver `-webkit-user-drag` en `styles.css`); Firefox no
// conoce esa propiedad, así que acá se frena el arrastre de imágenes y de texto. Lo que
// sí se escribe o se copia (campos de texto, el link de la sala) sigue igual.
document.addEventListener('dragstart', (e) => {
  if (!e.target.closest?.('input, textarea, [contenteditable], .netbox-link')) e.preventDefault();
});

// Una sola página para todo: la portada, sus menús, la mesa y las salas de la red.
// Antes `?red` era otra página y pasar del menú a las salas recargaba: la música del
// menú se cortaba, y como el navegador no deja sonar nada hasta que el jugador toca
// algo, en la sala no volvía hasta el primer clic. Ahora las salas se abren encima de
// la misma mesa (ver `swap` en `ui.js`) y el tema del menú sigue de una pantalla a otra.
//
// La mesa se monta pero no reparte: la partida arranca cuando la portada sabe contra
// quién se juega (ver `lobby.js`). Hasta entonces la mesa está vacía atrás, y no se
// ve, porque la portada la tapa entera.
//
// El mezclador es uno solo y lo tiene la mesa: los toques de la portada y de la sala
// son los que lo encienden, y cuando la partida empieza ya está andando.
// `?testeo` es la zona de testeo (ver `sandbox.js`): la misma mesa, sin reloj, con un
// panel para fabricar la carta que sigue. Se carga aparte y solo ahí: no es del juego.
const testing = new URLSearchParams(location.search).has('testeo');
const local = createGame(testing ? { clock: null } : {});
// En la zona de testeo las partidas no cuentan para las misiones: ahí la carta que sale
// se elige a mano.
const ui = mount(local, { start: false, missions: !testing });

// La mesa, para la sala: se sienta frente a la partida de la sala —con su asiento— y
// al irse vuelve a la de acá.
const table = {
  attach: (game, opts) => ui.swap(game, opts),
  detach: () => ui.swap(local),
};

let sala = null;
const lobby = createLobby(ui, {
  onPick: () => sala?.axieChanged(),
  openNet: () => {
    if (!new URLSearchParams(location.search).has('red')) {
      history.replaceState(null, '', `${location.pathname}${withFree('?red')}`);
    }
    if (sala) sala.show();
    else {
      sala = connect({
        chooseAxie: () => lobby.open('choose'),
        audio: ui.audio,
        table,
        onExit: () => lobby.leaveNet(),
      });
    }
  },
});

// `?red` —el link de la sala, o el QR— entra derecho a las salas. La portada queda
// armada atrás: "Volver" lleva a su menú sin recargar.
if (new URLSearchParams(location.search).has('red')) lobby.toNet({ instant: true });

if (testing) {
  import('./sandbox.js').then(({ openSandbox }) => openSandbox({ game: local, ui, lobby }));
} else if (FREE_PLAY) {
  // `?libre` es el juego entero con todo abierto (ver `FREE_PLAY` en `loadout.js`); sus
  // herramientas, como la zona de testeo, se cargan aparte y solo ahí.
  import('./free-play.js').then(({ openFreePlay }) => openFreePlay());
}
