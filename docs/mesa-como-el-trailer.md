# La mesa como el tráiler

Plan para que el juego se vea y se sienta como el tráiler de `motion-reel/`: las cadenas
que se enganchan carta por carta, robar del mazo con la carta que vuela y se da vuelta,
los números que golpean, las letras que entran de a una, las barras de vida de juego de
pelea y el Axie que cruza la arena y le pega al otro.

El tráiler es una película: todo está guionado, dura lo que quiere y nunca espera a nadie.
El juego tiene que verse igual pero **responder al instante**, funcionar en un teléfono
parado, en red y con `prefers-reduced-motion`, y seguir pasando `npm test`. El plan es
sobre eso: qué se trae tal cual, qué se adapta y qué no se trae.

---

## Estado (2026-09-26)

Decisiones de Micah: capa de efectos sobre el DOM (el juego va a sumar efectos), golpe
proyectado en la vida rival **sí**, bloom **en todos lados**, tocar el mazo **abre tus
cartas**, el orden propuesto, las tipografías del tráiler, mejores animaciones de los
Axies y los sonidos del kit.

Hecho:

| Fase | Qué quedó |
|---|---|
| 0 | `src/stage.js` (dos lienzos, reloj que duerme, bloom WebGL2 con respaldo 2D, 30 fps con solo vigas) y `src/stage-kit.js` (lo del tráiler, con nombres `fx*` para el archivo único) |
| 1 | Mazo boca abajo a los pies de cada Axie (`.pile`, abre el panel del mazo); la carta vuela en arco, se da vuelta y cae con polvo, anillo y chispas (`flyCard`); soplido sintetizado |
| 2 | Vigas en vivo por racha, de borde a borde de los medallones, chispazo al engancharse, punta viva marcada apenas (un eco finito y lento con la forma de su ficha, sin bloom); la racha muerta queda apagada; el recorrido del ataque es un brillo que viaja por las vigas; chasquido que sube de tono; la cuenta `4 × 4 = 16` en cada racha |
| 3 | Número de daño en Lilita con degradé del color de la clase, golpe al subir y el número viejo que se va volando; número del golpe que entra golpeando y crece con el daño; carteles `¡K.O.!` y `¡SE CORTÓ!` letra por letra; rótulos en Archivo negra ancha |
| 4 | Barra con estela clara y el golpe proyectado del rival latiendo en rojo (`projectedHit` en `game.js`, con test); late más rápido si es letal |
| 5 | Carga (aura), cruce hasta el rival con agazapada, estirón, pausa del impacto y vuelta de un salto (`lungeAxie`), zarpazo y chispas del color de la clase, empujón que crece con el daño, K.O. panza arriba con estrellitas; el aire de la clase del kit (`dash*`) |
| 6 | La carta que corta cae más grande, con halo rojo, chapita ✕ y sus símbolos a todo color; se queda quieta a la vista y después un haz punteado busca cada símbolo y lo deja rodeado de rojo. Recién a los 1,7 s (`BUST_BREAK`; el motor espera 1,9 s, `BUST_HOLD`) la fila se rompe en pedazos (copias de las cartas recortadas), con glitch corto y vidrio sintetizado; la carta que cortó queda sola en la mesa hasta que abre el centro. Antes se rompía a los 0,84 s con los símbolos grises y no se alcanzaba a leer qué había salido |
| + | Entrada a la arena: los dos caen del cielo al empezar la partida, con golpe grave y polvo. Reacciones: festeja con la cadena larga, mira de reojo con la rueda en rojo, gruñe si le van a sacar media vida |

Queda para después: la gradación por momento de la fase 7 (frío al cortarse, barras de
cine con la chance baja) y probar el latido de "¿una más?" (fuera de este plan).

---

## Qué tenemos y qué falta

| | Tráiler (`motion-reel/`) | Juego hoy |
|---|---|---|
| **Cadena** | Una viga eléctrica une los símbolos iguales **en el momento en que cae cada carta**. Chapita con el número de carta. Lo que no suma se apaga. Debajo del daño, la cuenta: `5 × 5`. | Chips encendidos por racha (`isScoringCell`) y, **recién al atacar**, el recorrido SVG de `traceChain`. Abajo, los chips de racha `×3 9`. |
| **Robar** | Mazo visible. La carta sale, vuela en arco, se da vuelta en el aire, cae con aplastón, polvo y anillo. La fila se recentra. | La carta aparece en la fila con la animación `deal` del CSS y la fila se corre (`glideCards`). No hay mazo en la mesa. |
| **Número de daño** | Golpe con resorte; el número viejo sale volando hacia arriba; brillo; tamaño que crece con la cadena. | `swing-dmg` con `data-up` y tamaño por `--n`. Bien resuelto, sin el golpe. |
| **Letras** | Tipografía cinética letra por letra (`kinetic` + `IN`/`OUT`): VS, ¡LA CADENA CRECE!, CERO., ¿UNA MÁS?, ¡K.O.! | Textos de interfaz fijos y `floatTag` para los números sobre los Axies. |
| **Vida** | Barra de pelea: se vacía hacia afuera, **estela clara** que la sigue, destello al recibir, y en rojo lo que se llevaría el golpe que se está armando. | Chapa con barra, número y escudo (`plateHtml`). La barra baja con transición. |
| **El golpe** | Las cartas se van al número, el número vuela al Axie, el Axie se carga (aura), **cruza la arena**, zarpazo, número rojo, empujón, vuelve de un salto. K.O. panza arriba con estrellitas. | `axie-lunge` del CSS con `LUNGE_REACH` (270 ms), efecto del kit de la clase, número flotante, `camera.punch` y `camera.hit`. Ya existe la base. |
| **El corte** | Un haz busca el símbolo, X roja por símbolo, la cadena se rompe en pedazos (Voronoi), glitch, la música se frena como una cinta, CERO. | `card--bust`, `slump` del Axie y el número en 0. |
| **Luz** | Capa emisiva aparte, revelado WebGL: bloom, ondas de choque, aberración, gradación. | Efectos del kit en un canvas con `plus-lighter` (`vfx.js`). Sin bloom. |

Lo que ya está y conviene **conservar**: la cámara con resortes (`camera.js`), los 12
poderes animados (`power-fx.js`), los clips de los Axies (`axie-motion.js`), el reloj del
motor (`aimMs` en `game.js`) y el aro de chances. El tráiler no reemplaza nada de eso:
lo viste.

---

## La decisión de fondo: una capa de efectos, no reescribir la mesa

**Recomendación: la mesa sigue siendo DOM y encima se suma un escenario de efectos en
canvas.** Todo lo que hay que leer o tocar (cartas, botones, número, vida, mercado) queda
en el DOM; lo que brilla, vuela o se rompe se dibuja en el canvas, a partir de las cajas
que mide el DOM.

Por qué no pasar la mesa entera a canvas como el tráiler:

- El DOM ya resuelve lo difícil: layout vertical y horizontal, `fitField`, i18n con
  `tr()`, accesibilidad, clicks, red, el Free Game que elige columna, el tutorial que
  apunta con la flecha. En canvas habría que rehacer todo eso.
- Los tests corren sobre el DOM (`test/dom.mjs`). Un canvas no se puede testear así; una
  capa de decorado que no hace nada sin canvas, sí.
- Se puede hacer **por partes**: cada fase de abajo se puede publicar sola.

La capa copia la idea que hace funcionar al tráiler: **cada efecto es una función pura
del tiempo** (`t - t0`), con partículas en fórmula y azar por hash. En el juego, `t0` es
el momento del evento (cae una carta, sale el golpe) en vez de un tiempo del guion. Eso da
gratis que un efecto se pueda cortar, adelantar o saltear sin estados colgados.

---

## Lo que el tráiler simplifica y el juego no puede

El tráiler eligió cadenas fáciles. La mesa de verdad tiene que bancar todo esto:

1. **Varias rachas a la vez.** Si la primera carta trae dos símbolos, hay dos rachas; cada
   una lleva su viga, de su color, y la que se muere se queda quieta donde quedó. La cuenta
   de abajo del número pasa a ser por racha: `3 × 3 + 1 × 1`. `traceLanes` ya calcula los
   recorridos por racha: las vigas en vivo salen de ahí.
2. **Cartas mejoradas** (el símbolo dos veces, la racha avanza de a dos): la viga une los
   dos eslabones adentro de la carta antes de cruzar, como ya hace `traceLanes`.
3. **Free Game**: la carta que cae desde el dock y se apila (`dropTetrisCard`). Su viga
   crece hacia arriba, no hacia el costado.
4. **La fila se achica** con 5 o más cartas (`baseZoom`, `fitField`). Todo lo del canvas
   se mide de las cajas reales en cada cuadro, nunca de posiciones fijas.
5. **Teléfono parado.** El tráiler es 16:9. En vertical, el Axie que ataca no cruza la
   pantalla de costado: salta hacia el otro en diagonal y el zarpazo se achica.
6. **Red.** Los efectos salen de las diferencias de estado (como `audio-cues.js` y
   `stageFx`), así las dos pantallas ven lo mismo. Nada del escenario puede mandar sobre
   el motor ni atrasarlo.
7. **Menos movimiento.** Con `prefers-reduced-motion` quedan los cambios de estado (las
   vigas quietas, la vida que baja) y se apagan vuelos, sacudones y partículas.
8. **Los tiempos.** En el tráiler cada carta dura casi dos segundos. En el juego, robar
   tiene que sentirse inmediato: presupuesto de tiempos más abajo.
9. **El archivo único.** `scripts/build.mjs` concatena los módulos sin envolverlos: nada
   de nombres de nivel superior repetidos. Lo que se traiga de `motion-reel/src/` (`E`,
   `lerp`, `hash`, `burst`…) va dentro de un objeto o con nombres propios, y cada módulo
   nuevo entra en `MODULES`.
10. **Textos.** Todo lo que se escriba en pantalla pasa por `tr()` con su entrada en
    `EN_STRINGS`. Los textos del tráiler viven en su propia tabla y no sirven para el juego.

---

## Las fases

Cada fase se publica sola, deja la suite en verde y se verifica con capturas en tanda
(vertical 390×844, escritorio 1366×768 y teléfono acostado 844×390).

### Fase 0: el escenario de efectos

- **Nuevo `src/stage.js`**: un canvas que cubre la arena (el mismo lugar que el de
  `vfx.js`, o ese mismo canvas), un reloj con `requestAnimationFrame` que solo corre
  mientras haya algo vivo, y una lista de efectos `{ t0, dur, draw(ctx, age, boxes) }`.
  Sin canvas 2D, con `prefers-reduced-motion` o en los tests: `play()` no hace nada.
- **Nuevo `src/stage-kit.js`**: lo que sirve del tráiler, adaptado: curvas y resortes
  (`core.js`), `burst`, `shockRing`, `glow`, `beam`, `puff`, `confetti` y `kinetic` (`fx.js`),
  `shatter` y `claws` (`pieces.js`). Todo bajo un solo nombre exportado, para el build.
- **Calidad por aparato**: pocas partículas y sin brillo extra en teléfonos. Un cuadro
  de efectos no puede pasar de ~4 ms en un teléfono medio.
- **Hecho cuando**: una carta que cae dispara un anillo de prueba en su lugar, en vertical
  y horizontal, y `npm test` sigue igual.

### Fase 1: robar del mazo

- Un **mazo en la mesa** para cada jugador, del lado de su Axie (en vertical, abajo de la
  fila). Es DOM: se puede tocar para robar, además del botón.
- La carta robada **sale del mazo, vuela en arco, se da vuelta en el aire y cae** con
  aplastón, polvo y anillo. Se hace sobre la carta real del DOM con Web Animations (FLIP:
  medir destino, arrancar desde el mazo), y el canvas pone el polvo, el anillo y el brillo.
- `glideCards` ya recentra la fila: el vuelo tiene que apuntar al lugar final, no al que
  ocupa la carta mientras la fila se corre.
- Sonido: el `whoosh` y el pico alineado del kit que usa el tráiler (`power_gain`).
- **Hecho cuando** robar se siente igual que en el tráiler, pero en ~400 ms.

### Fase 2: las cadenas en vivo

- **Vigas al caer cada carta**, no solo al atacar: de eslabón a eslabón, del color de la
  racha, con el temblor eléctrico y los pulsos que viajan (`beam`). Una por racha viva; la
  que muere se apaga en el lugar.
- **Chapitas** con el número de carta de la racha más larga, y **los símbolos que no
  suman se apagan** (en el CSS: `.sym` sin `data-on`, menos opacidad y un velo).
- **La cuenta debajo del número**: `4 × 4` con una racha; `3 × 3 + 1 × 1` con dos. Es
  DOM, con `tr()` para el separador si hiciera falta.
- `traceChain` al atacar queda como está, pero parte de las vigas ya dibujadas: en vez de
  dibujar la cadena, **la recorre** con una ola de luz.
- **Hecho cuando** una cadena de dos rachas, una mejorada y una de Free Game se leen sin
  explicarlas.

### Fase 3: números y letras

- **El número de daño golpea**: resorte al subir, el número anterior sale volando hacia
  arriba, brillo del color de la clase. `swing-dmg` ya marca `data-up`; falta el golpe.
- **Números sobre los Axies** (`floatTag`) con la entrada del tráiler: golpe desde grande
  y subida con resorte, rojo para el daño, verde para la cura, violeta para el veneno.
- **Carteles cinéticos** para los momentos grandes, letra por letra y en tipografía de
  título (Lilita One ya está cargada): `¡SE CORTÓ!`, `CERO`, `¡K.O.!` y, en la última
  chance, el aviso que hoy pone `rage`. Pocos y cortos: si aparecen en cada turno dejan
  de decir algo.
- Todo texto nuevo con `tr()` y en `EN_STRINGS`; el tamaño se ajusta al ancho del idioma.

### Fase 4: las barras de vida de juego de pelea

- **Estela clara**: la vida baja de golpe y un tramo claro la sigue medio segundo
  después. **Destello** al recibir.
- **El golpe que se está armando, en rojo sobre la barra del rival**: mientras se roba,
  el tramo que se llevaría el ataque late en rojo. Si alcanza para dejarlo en 0, late
  entera. Esto no es solo decorado: es la información que el jugador necesita para decidir
  si roba otra. Tiene que descontar escudo, huevo, caracol y Gecko Mask igual que
  `swingOf` y `hit()`; conviene que el cálculo salga de una función pura en `rules.js` o
  `game.js`, con tests.
- La chapa (nombre, medallón, escudo, estados) se queda; cambia la barra.

### Fase 5: el golpe

La secuencia del tráiler, apretada al tiempo que ya da el motor (`aimMs`, hasta 1,5 s):

1. **Carga**: las cartas se van hacia el número (o solo la ola de luz, si la fila es
   larga), el número se agranda y vuela al Axie, que se prende con un aura.
2. **El cruce**: el Axie va hasta el rival (hoy `axie-lunge` llega al 44%, `LUNGE_REACH`),
   con anticipación antes de arrancar y el cuerpo estirado en el aire.
3. **El impacto**: zarpazo (o el efecto del kit de la clase, que ya está), un cuadro de
   pausa (*hit stop*), número rojo, empujón y la cámara que se tira encima (`punch`).
4. **La vuelta**: de un salto, y festeja o se enoja según cómo le fue.
5. **K.O.**: el que queda en 0 sin última chance sale volando panza arriba con las
   estrellitas; `¡K.O.!` en letras. Con última chance, la furia de `rage` queda como está.

El orden y los tiempos los sigue mandando el motor: el escenario dibuja lo que el estado
dice que pasó y nunca lo espera.

### Fase 6: el corte

- La carta que no encaja: **un haz sale de cada racha viva, busca su símbolo y no lo
  encuentra**; X roja sobre cada símbolo. Después **toda la cadena se rompe en pedazos**
  (`shatter`, con el dibujo de cada carta capturado en un canvas chico), un glitch corto y
  el número que se parte y cae como 0.
- Sonido: la música se frena como una cinta (`playbackRate` hacia 0,12 en `audio.js`),
  vidrio y el *womp*.
- Es el momento más importante del juego para entender el riesgo: puede durar un poco
  más que el resto (~1 s), el motor ya le da ese tiempo con el `slump`.

### Fase 7: luz y acabado (opcional)

- **Brillo real** (bloom) con una capa emisiva aparte, como `post.js` del tráiler, solo en
  escritorio y con buena GPU. En el resto, el `plus-lighter` de siempre.
- Ondas de choque y aberración cromática en los golpes grandes (20 o más).
- Una gradación por momento: más fría con la cadena cortada, más roja y con barras de cine
  cuando las chances bajan del 40%.

### Fuera de este plan

La tensión de "¿una más?" (latido, reloj, cámara lenta) solo funciona porque el tráiler
sabe qué va a pasar. En el juego se puede probar un latido cuando la chance baja del 40%,
pero es una decisión de diseño aparte, no parte de igualar el tráiler.

---

## Presupuesto de tiempos

El tráiler se toma el tiempo de explicar; el juego no. Referencia para cada evento, a
partir del clic o del estado nuevo:

| Evento | Tráiler | Juego |
|---|---|---|
| Robar (vuelo + caída) | 0,46 s + 1,5 s de pausa | 0,35–0,45 s, se puede volver a robar al caer |
| Viga que se engancha | 0,2 s | 0,15 s |
| Número que sube | 0,3 s | 0,25 s |
| Carga + cruce + impacto | ~1,6 s | lo que dé `aimMs` (0,38–1,5 s) |
| Corte completo | ~2 s | ~2 s (la carta que corta se lee antes de romperse) |
| K.O. | ~2 s | 1,2 s antes de la pantalla del final |

Todo efecto se puede interrumpir: si llega otro estado, el anterior se termina o se
recorta, nunca se encola.

---

## Cómo se verifica

- `npm test` en verde en cada fase. Los tests nuevos van contra lo que no es dibujo: la
  vida proyectada del rival (fase 4), qué efectos dispara cada cambio de estado, y que el
  escenario no hace nada sin canvas.
- Capturas en tanda en los tres tamaños, con el arnés que congela el reloj (ver la memoria
  de capturas): cadena de una racha, de dos, mejorada, Free Game, corte, golpe grande, K.O.
- Medir el cuadro en un teléfono de gama media: si un efecto pasa de ~4 ms, baja de calidad.
- Probar una partida en red: las dos pantallas tienen que ver las mismas vigas y el mismo
  golpe.

---

## Decisiones para Micah

1. **¿Capa de efectos sobre el DOM (recomendado) o la mesa entera en canvas?** Con la capa
   se hace por partes y no se pierde nada de lo que ya funciona.
2. **¿El golpe proyectado en la vida del rival (fase 4)?** Cambia la información que ve el
   jugador: hace el juego más claro, pero también más fácil de calcular.
3. **¿Bloom (fase 7) solo en escritorio, o nada?**
4. **¿El mazo se puede tocar para robar**, además del botón?
5. **¿El orden de las fases?** El propuesto es 0 → 1 → 2 → 4 → 5 → 3 → 6 → 7: primero lo
   que más se ve en cada turno (robar, cadenas, vida), después el golpe y el corte.
