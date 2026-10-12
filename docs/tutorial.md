# Tutorial — Lineamientos

Cómo tiene que sentirse y construirse el tutorial de Axie Chance. Sirve para rehacer
el actual ([src/tutorial.js](../src/tutorial.js)) y para cualquier guía nueva (por
ejemplo, el primer encuentro con un poder en la Aventura).

> **La regla madre:** el jugador aprende jugando, no leyendo. Si algo se puede
> mostrar con la mesa, no se escribe.

---

## 1. Principios

1. **Hacer antes que leer.** A los 3 segundos de abrir el tutorial el jugador ya
   tiene que estar tocando algo. Nada de pantalla de bienvenida.
2. **Un concepto por ronda.** Cada ronda enseña una sola idea nueva. Si hacen falta
   dos, son dos rondas.
3. **Que lo intuya.** Primero se deja al jugador probar. La ayuda (flecha, texto)
   aparece solo si se queda quieto o se equivoca, no por adelantado.
4. **El juego enseña, el tutorial acomoda.** Los mazos guionados están para que la
   consecuencia se *vea*: la cadena crece y el número de daño crece con ella. El
   texto no tiene que explicar lo que la animación ya muestra.
5. **Cero fórmulas.** No se habla de L², de puntos por racha ni de sumas. La idea
   que tiene que quedar es una sola: **cadena más larga, golpe más fuerte**.
6. **La mesa no se apaga.** Nada de capas oscuras ni blur: lo que hay que mirar
   brilla y lo que se toca late. La burbuja y la flecha se colocan en espacios libres y
   nunca pisan el objetivo ni los carteles, la barra o los instrumentos.
7. **Un solo foco a la vez.** Una idea por paso. Si la idea abarca varias cosas (las
   cartas de tu color en el centro), cada una lleva su flecha; si se resaltan cinco
   ideas juntas, no se resalta ninguna.

---

## 2. Presupuesto de texto

| Pieza | Límite |
|---|---|
| Burbuja de indicación | **≤ 6 palabras**, un verbo al principio ("Robá otra", "¡Atacá!") |
| Burbujas por ronda | **≤ 2** (hasta 3 en ronda 1: cadenas vivas, daño y color) |
| Títulos, número de ronda, etiqueta "Tutorial" | no van (el HUD ya dice la ronda) |
| Números en el texto | solo si se ven en pantalla en ese momento (ej. la vida del rival) |
| Modales | **ninguno** durante la partida |

Si una idea no entra en 6 palabras, probablemente hay que mostrarla con la mesa.

Todo texto pasa por `tr()` y lleva su entrada en `EN_STRINGS`, como el resto del juego.

---

## 3. La mira, el toque y el cartel

Hasta el 2026-09-27 era una flecha naranja del kit (`TargetPointer/arrow_target.png`) y
una burbuja suelta. La flecha solo apuntaba en cuatro direcciones y caía en el hueco
que le quedara —pegada al aro, entre dos carteles—, y la burbuja flotaba sin decir de
qué hablaba. Se reemplazó por tres piezas (`createOverlay` en
[src/tutorial.js](../src/tutorial.js)):

- **La mira**: cuatro esquinas doradas que abrazan cada objetivo con su forma (el
  radio de su borde, más 7 px). Al aparecer se cierra sobre él como una mira que
  engancha y después las esquinas respiran. Una por objetivo (hasta `MAX_ARROWS`);
  varias se leen como un grupo. No apunta desde un costado, así que no hay lado que
  elegir mal.
- **El toque**: dos anillos que se abren desde el centro de lo que se aprieta —un botón
  o la columna del Rocket (`TAPPABLE`)—. Anillos y no un punto, así no tapan el rótulo.
  Las cartas del centro y tu Axie no los llevan: ya brillan, y un punto les tapaba un
  símbolo o la cara.
- **El cartel**: la tabla roja de las cintas de los títulos (`player_name_bg` del kit,
  la de `.o-banner`) con letra crema y una cola del color del canto que señala el
  centro del objetivo. Antes era la madera beige de los paneles y se perdía justo sobre
  el panel del centro. Se prueba arriba, abajo y a los costados del objetivo y, si son
  varios, del grupo entero; en un renglón y, si es largo, en dos. Gana el lugar que menos
  tapa (ver §3c); arriba/abajo y un renglón se prefieren. Entra desde el lado del
  objetivo, después respira hacia él (`tuto-callout-nudge`) y al cambiar de paso se va
  achicándose en vez de apagarse de golpe (`dismissCallout`).

Cómo se mueve:

- **Sigue al objetivo deslizándose.** Mira y cartel vuelven a medir cada `FOLLOW_MS`
  (100 ms, con un timer: medir la mesa en cada cuadro despertaba la página entera) y lo
  que ya estaba a la vista se desliza hasta el lugar nuevo (`data-glide`). Lo que recién
  aparece no, para no entrar volando desde la esquina.
- **Una carta que vuela no se señala.** La carta robada viaja del mazo a la mesa
  (`is-flying`); el cartel espera a que aterrice y recién ahí entra. Antes aparecía
  junto al mazo del rival y cruzaba la pantalla.
- **La mira no se sale de la pantalla**: un botón pegado al borde la dejaba con dos
  esquinas afuera.
- **El corte se alcanza a leer.** En el tutorial el cierre de la ronda dura 2,6 s
  (`TUTORIAL_ROUND_PAUSE`, 1,1 s en el juego): "¡Cadena rota!" queda unos 4 s en
  pantalla, y antes se iba en menos de uno.

Todo se anima con `transform` y `opacity`; con `prefers-reduced-motion` queda quieto (un
anillo fijo en lugar de las ondas, sin deslizarse ni respirar).

---

## 3b. El brillo celeste

Lo que hay que **mirar** (no tocar) brilla en celeste, el mismo difuminado del resto
del juego: la vida del rival, el número de daño, la rueda, las cartas del centro, las
columnas del Rocket. Cada cosa brilla a su manera (halo en las cartas, difuminado sobre
las cifras, aro en la rueda); nunca un recuadro. Lo que se **toca** late con
`.tuto-allowed` y lo señala la flecha.

---

## 3c. Sin scrim

Hubo un scrim que apagaba la mesa salvo el objetivo: primero una capa con
`backdrop-filter` (Chrome no le aplicaba la máscara y difuminaba la pantalla entera) y
después un SVG con recortes desenfocados que se rehacía en cada cuadro. Se sacó: no se
entendía qué quedaba encendido, tapaba lecturas y repintaba la pantalla completa 60
veces por segundo. `test/styles.test.js` vigila que no vuelva.

**Lo que el cartel nunca tapa** (`ALWAYS_CLEAR` en `tutorial.js`): la barra
de arriba con la salida y el menú de configuración, el menú si está abierto, las dos
barras de vida, los dos instrumentos (daño y rueda) y los carteles.

El cartel calcula su posición con un evaluador de candidatos (`layout`):
tapar un objetivo descalifica, tapar un cartel o una vida pesa ocho veces más que tapar un
símbolo, y la madera vacía de una carta casi no cuenta (una flecha sobre el borde de una
carta no esconde nada). Las flechas van todas del mismo lado salvo la que ahí tape algo, y
el lado que fija el guión se respeta solo si no tapa nada (en un teléfono el centro ocupa
casi toda la pantalla y el lado escrito ya no sirve). La burbuja va pegada a alguna
flecha: lejos de ellas no se sabe de qué habla. Esa cuenta mide cada símbolo de la mesa,
así que `place` solo la rehace cuando los objetivos, la pantalla, la burbuja o la
cantidad de cosas en la mesa cambiaron; las demás vueltas solo miden los objetivos.

El brillo de las cartas del centro no pasa de 18 px (`tuto-pulse-tight`): `.market-row`
se desplaza, así que recorta todo lo que se salga de su colchón de 18 px.

## 4. Ayuda escalonada

Cada paso tiene tres niveles, y solo se sube de nivel si el jugador no avanza:

| Tiempo sin actuar | Qué aparece |
|---|---|
| 0 s | Nada extra: solo el pulso suave en lo que se puede tocar. |
| ~3 s | La mira (y el toque, si es un botón) sobre el objetivo. |
| ~7 s | El cartel de ≤ 6 palabras. |

- El **primer paso** del tutorial muestra la mira de entrada (todavía no sabe
  dónde mirar).
- Las acciones no permitidas se ven **deshabilitadas**, no se explican. Si toca
  algo bloqueado, se adelantan la mira y el cartel al objetivo correcto.
- El reloj de turno queda apagado durante el tutorial.

---

## 5. Enseñar con la mesa (reemplazos concretos)

| Hoy (texto o modal) | Mejor (UI) |
|---|---|
| Modal "Golpe conectado… 2² = 4…" | El número de daño sale grande del rival y la barra de vida baja. Nada más. |
| "Pez largo 3 = 9 pts" | La racha viva brilla y el número de ataque se infla a cada robo. |
| Modal "¡Se cortó la cadena!" | La carta que no encaja tiembla, sus símbolos se tachan y el número de ataque cae a 0 con un golpe seco. |
| "Mirá el dial de odds" | El dial late cuando baja de verde a rojo; se aprende solo con la repetición. |
| "Solo podés llevarte 1 carta sin poder" | Las cartas no elegibles del centro se ven apagadas. |
| Modal "Maceta: te curás lo que pegás" | Al atacar, la vida propia sube a la vez que baja la del rival, con el ícono de la Maceta volando a la barra. |
| Modal "Última Chance…" | Halo dorado en el rival + una burbuja: "¡Última chance del rival!" |
| Modal de victoria con lista de lo aprendido | Pantalla de victoria normal del juego + un botón "Jugar de verdad". |

---

## 6. Qué se evita

- Fondo negro o semitransparente sobre toda la pantalla.
- Encabezados con título + descripción + acción en el mismo cartel.
- Narrar cada robo ("¡5 cartas seguidas!", "¡6 cartas!…").
- Botones "Entendido →" / "Continuar →" para seguir.
- Explicar algo que el jugador todavía no vio.
- Resaltar botón, cadena, dial y cartas al mismo tiempo.

---

## 7. Cómo se mide que funciona

- **Duración:** el tutorial completo en ≤ 3 minutos.
- **Lectura:** ≤ ~40 palabras en todo el tutorial (hoy son varios cientos).
- **Intuición:** en una prueba con alguien que no conoce el juego, cuántas veces
  hizo falta que apareciera la flecha. Menos es mejor.
- **Sin atascos:** ningún paso puede quedar sin salida (probado en
  `test/tutorial.test.js`, igual que hoy).

---

## 8. Decisiones

- [x] **Contenido:** cuatro ideas y nada más: **objetivo, cadena, corte, Rocket
      Stamp**. Fuera la Maceta, la Última Chance y la fórmula.
- [x] **Flecha:** aparece tras ~3 s sin actuar (la primera acción la muestra de
      entrada). Ver §4.
- [x] **Texto:** burbuja de ≤ 6 palabras pegada a la flecha, máximo 2 por ronda.
      Chau banner superior.
- [x] **Corte:** el jugador aprende a leer la **rueda de chances** antes de que se le
      corte a él. Además lo ve pasar en el **rival**, en cámara lenta: la carta que no
      encaja se queda un momento en el aire antes de caer, para que no se pierda.
- [x] **Centro:** se abre por primera vez al final de la ronda 1: dos cartas sin poder
      **de su color** —las otras se ven pero no se pueden llevar (`tutorialOwnColor`), y
      tampoco se puede dejar pasar el reparto—, porque son las que alargan la cadena de
      las rondas que siguen. En la ronda 4 da el Rocket Stamp.
- [x] **Final:** la racha de Planta muere en la 2ª carta. El Rocket (Planta + Bestia) sale
      en la 3ª y, como es gratis, no entra en la cadena: puesto sobre la 2ª columna **revive
      Planta**, y la 4ª carta —que sin él cortaba— la alarga a 3. Golpe de 13 que deja al
      rival en 0 (Last Chance).
      El rival se corta en su última oportunidad. La victoria muestra **"¡TUTORIAL
      COMPLETADO!"** con dos botones: **Ir a modo Aventura** y **Menú principal**.
      Sin lista de lo aprendido.
- [x] **Mazo:** no se cuenta, se abre. Sin ronda propia: dos veces el guión frena la mesa
      —los dos botones apagados— hasta que el jugador **toca su Axie** y ve sus cartas. Al
      empezar la ronda 2, con las dos que se llevó del centro ya adentro, y con el Rocket
      recién comprado, que aparece ahí mismo.
- [x] **Personaje:** sin narrador. **El Axie propio reacciona** a lo que pasa (ver §10).

---

## 9. Recorrido

Una idea por ronda: **cadena y centro → corte del rival → corte propio → Rocket Stamp del centro →
el Rocket reviviendo una racha para el remate en Last Chance**.

El guión **no inventa cartas**: el mazo de cada ronda es el mazo de verdad —las ocho de
fábrica del Axie más lo que se llevó del centro— ordenado para que salgan primero las que
pide `SCRIPT`, y el resto queda abajo sin salir (`arrange()` en
[src/tutorial.js](../src/tutorial.js)). Así todo lo que se roba en la mesa está en el mazo
que se abre tocando el Axie, los dos números del panel cierran y la rueda de chances mide
el mazo que de verdad queda. Los golpes salen de esas cartas: **10 · 35 · 0 · 46 · 13**,
cuatro más que la vida del rival, y él pega **5 · 0 · 5 · 5 · 0**.

| Ronda | Idea | Qué pasa en la mesa | Brilla | Burbujas |
|---|---|---|---|---|
| 1 | **Cadena y centro** | Apertura con cadenas vivas; roba dos cartas más para alargar la cadena y ataca (10 de daño). Al atacar se abre el centro: draftea 2 cartas de su color (las ajenas se ven apagadas). Después el rival ataca. | cadenas vivas · el daño · cartas de su color | "Cadenas vivas" · "Cadenas largas hacen más daño" · "Buscá tu color" |
| 2 | **Corte del rival** | Al abrir, tu Axie brilla y la mesa espera: tocándolo se abre el mazo, con las dos cartas que se llevó del centro adentro. Después arma racha de 5 cartas —las dos del centro adelante— y ataca (35 de daño). La CPU roba de más —cuatro de Planta, con la rueda ya en amarillo— y se corta **en cámara lenta**. | tu Axie · el número de daño | "Tocá tu Axie: es tu mazo" · "¡Cadena rota! No comparte símbolos" |
| 3 | **Corte propio** | La racha va por **Bestia**, que en el mazo son dos cartas y nada más: con las dos afuera la rueda marca **0%** y la 3ª carta corta de verdad (you busted). | la rueda de chances | "Chances de seguir la cadena" · "¡Cadena rota! No comparte símbolos" |
| 4 | **Práctica + Rocket** | Seis cartas que encajan todas: pega 46, dejando al rival en 9. Del centro solo se puede llevar el Rocket Stamp. Con el Rocket comprado, la mesa vuelve a esperar hasta que toca su Axie y lo ve en el mazo. | el Rocket en el centro · tu Axie | "Llevate el cohete" · "Tocá tu Axie: sumaste el cohete" |
| 5 | **Rocket Stamp** | La racha de Planta muere en la 2ª carta. El Rocket (Planta + Bestia) sale tercero y es gratis: no entra en la cadena ni la corta, espera columna. Puesto en la 2ª, **revive Planta**; la 4ª carta (Planta + Reptil), que sin él cortaba, la alarga a 3: 13 de daño, y el rival queda en 0 (Last Chance). El rival se corta en su turno. Remate, "¡TUTORIAL COMPLETADO!". | la 2ª columna · la carta revivida · el daño | "Reviví la cadena: 2ª carta" · "¡Rematalo!" |

El centro se saltea en las rondas 2, 3 y 5 (`tutorialSkipDraft`). Cuántas cartas
roba la CPU lo dice `BOT_STAND_AT` (sin tope en las rondas 2 y 5: se corta). En la
ronda 5 el rival se corta también en su Última Chance, así que el final es siempre
victoria, sin tocarle la vida a nadie a mitad de partida.

Detalle técnico del Rocket Stamp: al robarlo con la cadena abierta queda en
`state.pendingStack` y se resuelve con `game.chooseStackTarget(col)`. En la ronda 5 solo
se permite ponerlo en la 2ª columna (`colIndex: 1`), donde murió Planta.

---

## 10. Reacciones del Axie

El Axie propio dice con el cuerpo lo que antes decía un párrafo. Se usan los clips
que ya tiene `createMotion()` ([src/axie-motion.js](../src/axie-motion.js), vía
`stance(name)`): `cheer`, `peek`, `scratch`, `snarl`, `stomp`, más los de ataque,
golpe, victoria y derrota.

| Momento | Reacción |
|---|---|
| La cadena crece | `cheer` (saltito) |
| La rueda de chances pasa a rojo | `peek` / `scratch` (nervioso) |
| Se corta la cadena | pose de golpe recibido, cabizbajo |
| Golpe final | ataque → victoria |

Las reacciones no bloquean nada: si el navegador no anima, el tutorial funciona igual.

---

## 11. Pantalla final

Reutiliza la pantalla del final (la escena de victoria de `src/result.js`) con el texto
**"¡TUTORIAL COMPLETADO!"**, y abajo dos botones: **Ir a modo Aventura** (el
mismo destino que `data-action="adv-map"`) y **Menú principal**. Se marca
`tutorialDone` en `localStorage` como hoy.
