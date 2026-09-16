import { createGame } from './game.js';
import { mount } from './ui.js';
import { createLobby } from './lobby.js';
import { connect } from './net.js';
import { currentLang, translateDom } from './i18n.js';

// Establece el idioma del documento y traduce el HTML estático antes de montar la UI.
document.documentElement.lang = currentLang();
translateDom(document.body);

// `?red` es la partida contra otro aparato; sin eso, la de siempre acá adentro. Es la
// URL y no un botón porque es lo que se escribe en el celular, y porque las dos son
// pantallas distintas: una tiene la partida y la otra la mira por un cable.
if (new URLSearchParams(location.search).has('red')) {
  // La portada se arma igual, guardada: de sus tres pantallas la sala usa una, la
  // elección de Axie, y la abre encima cuando se toca "Tu Axie" (ver `net.js`).
  //
  // Es **la misma** pantalla que la de la portada y no un roster aparte, que es
  // exactamente lo que había antes arriba de la mesa: con qué Axie jugás se pregunta
  // en un solo lugar del juego, y sentado a la mesa lo único que se hace es jugar.
  let sala = null;
  const lobby = createLobby(null, { net: true, onPick: () => sala?.axieChanged() });
  sala = connect({ chooseAxie: () => lobby.open('choose') });
} else {
  // La mesa se monta pero no reparte: la partida arranca cuando la portada sabe contra
  // quién se juega (ver `lobby.js`). Hasta entonces la mesa está vacía atrás, y no se
  // ve, porque la portada la tapa entera.
  createLobby(mount(createGame(), { start: false }));
}
