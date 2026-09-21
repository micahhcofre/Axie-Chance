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

## 3. La flecha

Usar la flecha del propio kit de Origins, la misma familia visual que el remate
naranja de la barra de vida:

```
https://cdn.jsdelivr.net/gh/axieinfinity/axie-origins-asset-kit@main/Assets/OriginsKit/Textures/TargetPointer/arrow_target.png
```

- 259×260, **apunta a la izquierda** en su orientación original (rotar según el lado
  desde el que llega).
- **De un solo color:** se usa como máscara (`mask`) y se pinta entera de naranja
  (`#ff9a1a`). El relleno gris del dibujo es para teñir en Unity y en la web se ve raro.
- `arrow.png` (misma carpeta) es la versión gris sin contorno, por si hace falta
  una variante apagada.

Cómo se comporta:

- **Una por objetivo**: si el selector del paso marca varias cosas (las cartas Pez del
  centro), cada una lleva la suya, todas del mismo lado si se puede (hasta
  `MAX_ARROWS`). Ancladas con `getBoundingClientRect()` y reubicadas al redimensionar
  o re-renderizar la mesa.
- **Rebote suave** hacia el objetivo (8–10 px, ~1 s). Con
  `prefers-reduced-motion`, quieta.
- Llega por el lado que menos tapa lo que hay que ver (Axies, vidas, rueda, daño,
  botones) y el lado se decide una vez por objetivo, para que no salte.
- Se va apenas el jugador hace la acción, sin esperar a la siguiente.
- Tamaño en pantalla ~40–56 px; en celular no más chica que el dedo.
- Puede llevar una burbuja corta pegada (≤ 6 palabras), nunca un párrafo.

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

**Lo que la flecha y la burbuja nunca tapan** (`ALWAYS_CLEAR` en `tutorial.js`): la barra
de arriba con la salida y el menú de configuración, el menú si está abierto, las dos
barras de vida, los dos instrumentos (daño y rueda) y los carteles.

La flecha y la burbuja calculan su posición con un evaluador de candidatos (`layout`):
tapar un objetivo descalifica, tapar un cartel o una vida pesa ocho veces más que tapar un
símbolo, y la madera vacía de una carta casi no cuenta (una flecha sobre el borde de una
carta no esconde nada). Las flechas van todas del mismo lado salvo la que ahí tape algo, y
el lado que fija el guión se respeta solo si no tapa nada (en un teléfono el centro ocupa
casi toda la pantalla y el lado escrito ya no sirve). La burbuja va pegada a alguna
flecha: lejos de ellas no se sabe de qué habla. Esa cuenta mide cada símbolo de la mesa,
así que `place` solo la rehace cuando los objetivos, la pantalla, la burbuja o la
cantidad de cosas en la mesa cambiaron; los demás cuadros solo miden los objetivos.

El brillo de las cartas del centro no pasa de 18 px (`tuto-pulse-tight`): `.market-row`
se desplaza, así que recorta todo lo que se salga de su colchón de 18 px.

## 4. Ayuda escalonada

Cada paso tiene tres niveles, y solo se sube de nivel si el jugador no avanza:

| Tiempo sin actuar | Qué aparece |
|---|---|
| 0 s | Nada extra: solo el pulso suave en lo que se puede tocar. |
| ~3 s | La flecha sobre el objetivo. |
| ~7 s | La burbuja de ≤ 6 palabras. |

- El **primer paso** del tutorial muestra la flecha de entrada (todavía no sabe
  dónde mirar).
- Las acciones no permitidas se ven **deshabilitadas**, no se explican. Si toca
  algo bloqueado, se adelanta la flecha al objetivo correcto.
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
- [x] **Final:** el Rocket sale en la 3ª carta y se coloca en la 2ª columna para **revivir
      la racha de Planta**, pegando un golpe de 13 que deja al rival en 0 (Last Chance).
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
revivir la cadena con el Rocket para el remate en Last Chance**.

El guión **no inventa cartas**: el mazo de cada ronda es el mazo de verdad —las diez de
fábrica del Axie más lo que se llevó del centro— ordenado para que salgan primero las que
pide `SCRIPT`, y el resto queda abajo sin salir (`arrange()` en
[src/tutorial.js](../src/tutorial.js)). Así todo lo que se roba en la mesa está en el mazo
que se abre tocando el Axie, los dos números del panel cierran y la rueda de chances mide
el mazo que de verdad queda. Los golpes salen de esas cartas: **10 · 35 · 0 · 46 · 13**,
que es justo la vida del rival, y él pega **5 · 0 · 5 · 5 · 0**.

| Ronda | Idea | Qué pasa en la mesa | Brilla | Burbujas |
|---|---|---|---|---|
| 1 | **Cadena y centro** | Apertura con cadenas vivas; roba dos cartas más para alargar la cadena y ataca (10 de daño). Al atacar se abre el centro: draftea 2 cartas de su color (las ajenas se ven apagadas). Después el rival ataca. | cadenas vivas · el daño · cartas de su color | "Cadenas vivas" · "Cadenas largas hacen más daño" · "Buscá tu color" |
| 2 | **Corte del rival** | Al abrir, tu Axie brilla y la mesa espera: tocándolo se abre el mazo, con las dos cartas que se llevó del centro adentro. Después arma racha de 5 cartas —las dos del centro adelante— y ataca (35 de daño). La CPU roba de más y se corta **en cámara lenta**. | tu Axie · el número de daño | "Tocá tu Axie: es tu mazo" · "¡Cadena rota! No comparte símbolos" |
| 3 | **Corte propio** | La racha va por **Bestia**, que en el mazo son tres cartas y nada más: con las tres afuera la rueda marca **0%** y la 4ª carta corta de verdad (you busted). | la rueda de chances | "Chances de seguir la cadena" · "¡Cadena rota! No comparte símbolos" |
| 4 | **Práctica + Rocket** | Seis cartas que encajan todas: pega 46, dejando al rival en 9. Del centro solo se puede llevar el Rocket Stamp. Con el Rocket comprado, la mesa vuelve a esperar hasta que toca su Axie y lo ve en el mazo. | el Rocket en el centro · tu Axie | "Llevate el cohete" · "Tocá tu Axie: sumaste el cohete" |
| 5 | **Rocket Stamp** | El Rocket sale tercero; la 4ª carta (Confinamiento, que trae Planta) se coloca en la 2ª columna para **revivir la racha de Planta**, alcanzando 13 de daño y dejando al rival en 0 (Last Chance). El rival se corta en su turno. Remate, "¡TUTORIAL COMPLETADO!". | el Rocket · la 2ª columna · el daño | "Montala en la 2ª carta" · "¡Rematalo!" |

El centro se saltea en las rondas 2, 3 y 5 (`tutorialSkipDraft`). Cuántas cartas
roba la CPU lo dice `BOT_STAND_AT` (sin tope en las rondas 2 y 5: se corta). En la
ronda 5 el rival se corta también en su Última Chance, así que el final es siempre
victoria, sin tocarle la vida a nadie a mitad de partida.

Detalle técnico del Rocket Stamp: con el Rocket en la mesa la pantalla roba sola; esa
carta queda en `state.pendingStack` y se resuelve con `game.chooseStackTarget(col)`.
En la ronda 5 solo se permite apilar en la 2ª columna (`colIndex: 1`) para revivir la planta.

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
