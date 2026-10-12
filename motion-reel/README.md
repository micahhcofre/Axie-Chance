# Axie Chance — el tráiler de 58 segundos

Un spot de motion graphics sobre una pelea: Buba contra Puffy en la meseta. El reel
enseña a jugar mientras pelean —robar, encadenar, plantarse, cortarse— y después muestra
cuatro poderes en cuatro peleas cortas, antes del final de "¿una más?". Está hecho con
las piezas del juego: las cartas de nogal, los medallones de clase (redibujados en vector
a partir de los crests), los seis starters de Origins con sus animaciones horneadas, los
fondos de bioma, los amuletos, las texturas y los sonidos del Origins Asset Kit.

Los números son los de verdad: `playCard()` y `scoreChain()` de `src/rules.js` deciden
cada racha, así que el 25 del primer golpe, el cero de Puffy y el 81 del final son
números de las reglas. Los valores de los poderes (5 de la pluma, 6 de veneno, 5 de vida)
son los de `TUNING`.

## Verlo

Con `npm start` corriendo: <http://localhost:8000/motion-reel/index.html> (con sonido;
`?lang=en` para los textos en inglés). Espacio pausa, las flechas saltan de a un segundo y la barra
de abajo rebobina. `?t=20.6` muestra un cuadro quieto; con `&k=8`, con desenfoque de
movimiento.

## Exportarlo

```sh
node motion-reel/tools/render.mjs video                # MP4 1080p60 en motion-reel/out/
node motion-reel/tools/render.mjs video --lang en      # la versión en inglés
node motion-reel/tools/render.mjs stills --t 2,20.6    # fotos fijas en PNG
node motion-reel/tools/render.mjs sheet --n 24         # hoja de contacto de todo el reel
node motion-reel/tools/render.mjs audio                # solo la banda, en WAV
```

Necesita macOS (el codificador es AVFoundation, `tools/encode.swift`, compilado con
`swiftc` la primera vez) y el Chrome sin cabeza que deja puppeteer en `~/.cache/puppeteer`.
No usa ffmpeg ni ninguna dependencia de npm. El video entero tarda unos tres minutos.

## Cómo está hecho

- **Una película, no una página animada.** Cada escena dibuja el instante `t` entero
  sin memoria: cada posición, cada partícula (parábolas con arrastre resueltas en
  fórmula, con el azar sacado de un hash) es una función del segundo. Por eso se puede
  pedir cualquier cuadro suelto y por eso el desenfoque de movimiento es de verdad: cada
  cuadro del video promedia 8 instantes dentro de un obturador de 180°.
- **Dos capas y un revelado.** Canvas 2D pinta la escena y, aparte, una capa emisiva
  (chispas, vigas, destellos). `src/post.js` (WebGL2) las pasa a luz lineal —la emisiva
  por encima de 1, HDR— y hace el bloom en pirámide, las ondas de choque, la aberración
  cromática, el zoom-blur de los golpes, el glitch del corte, las barras de cine, la
  gradación por tramo, la viñeta y el grano.
- **El reloj es la música.** 128 negras por minuto: 58 segundos son 124 tiempos. `CUE`
  en `src/script.js` tiene los tiempos del guion y `src/score.js` los lee para que cada
  golpe de imagen caiga en un golpe de sonido.
- **La banda se sintetiza** con la Web Audio API en un OfflineAudioContext (batería,
  bajo con sidechain, colchones supersaw, braams, risers, latidos, reloj) más los efectos
  del kit alineados por su pico. Son dos pasadas: la música se graba sola y después se la
  reproduce como una cinta, para poder frenarla en el corte (el *tape stop*). Los tramos
  que explican van más bajos, para que se oigan las cartas.

| Archivo | |
|---|---|
| `src/script.js` | El guion: los tiempos (`CUE`), los textos en español e inglés, las cadenas y las cuatro peleas de los poderes |
| `src/duel.js` | La pelea de Buba contra Puffy: cámara, Axies, mazo, cadenas, golpes, vidas y letras |
| `src/powers.js` | El cartel de los doce poderes y las cuatro peleas, cada una con su iris |
| `src/title.js` | Los crests que se juntan, el logo, la frase y la llamada |
| `src/pieces.js` | Lo que comparten: cartas, números con su cuenta, barras de vida, subtítulos, la carta que se rompe, el zarpazo |
| `src/scenes.js` | El montaje (qué escena va cuándo, los empujes entre escenas) y el revelado en el tiempo |

## El guion

| Tiempos | Segundos | |
|---|---|---|
| 0–10 | 0–4,7 | Buba y Puffy caen a la arena. VS. Las barras de vida se llenan |
| 10–32 | 4,7–15 | Turno de Buba, carta por carta: "Robá una carta", "¿Comparte un símbolo?", "¡La cadena crece!", "Más larga, más daño": 1, 4, 9, 16, 25 con su cuenta (5 × 5). "Plantate… ¡y pegá!": Puffy queda en 75 |
| 32–48 | 15–22,5 | Turno de Puffy: 1, 4, 9… "Pero si no comparte ninguno…": la carta no encuentra dónde engancharse, todo se rompe. CERO |
| 48–84 | 22,5–39,4 | 12 poderes. Feather Earring (Momo), Poison Vial (Venoki), Mantis Dagger (Pomodoro) y Leafy Pot (Olek), cada uno en su mundo, con su nombre y lo que hace |
| 84–112 | 39,4–52,5 | Buba en 64 contra los 75 de Puffy: no alcanza. ¿UNA MÁS? La carta gira en cámara lenta: 81. K.O. |
| 112–124 | 52,5–58 | El logo, la frase y a jugar |
