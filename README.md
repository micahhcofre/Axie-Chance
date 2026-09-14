# Axie Chance

Juego de cartas *push-your-luck* para navegador: encadenás símbolos mientras te
animes, y cuanto más larga la cadena, más vale — hasta que se corta y perdés todo.

Sin dependencias ni build: HTML, CSS y JavaScript con módulos ES. Los símbolos son
los crests de `Icons/`, y cada jugador tiene su **Axie** dibujado al costado de la mesa.

## Correrlo

Los módulos ES no cargan desde `file://`, así que hace falta un servidor:

```sh
npm start              # http://localhost:8000
PORT=3000 npm start    # otro puerto
```

El mismo servidor es el de la partida en red: al arrancar imprime la dirección con la
que entra el otro aparato (ver [Contra otro aparato](#contra-otro-aparato)).

`scripts/dev.mjs` sirve el repo con `Cache-Control: no-store` y recarga la pestaña sola
cuando guardás un archivo, así lo que ves siempre es `src/`. Con un servidor estático
común (`python3 -m http.server`) el navegador se queda con los módulos viejos en caché y
los cambios no aparecen hasta un recargado forzado.

```sh
npm test               # reglas, flujo de partida, render y sonido
```

Para tener el juego en un archivo suelto, sin servidor ni dependencias:

```sh
npm run build          # dist/axie-chance.html (~2,4 MB, crests y fondos incluidos)
```

El build lee `src/` y `styles.css`, les saca los `import`/`export`, mete los crests y los
seis fondos como data URI y concatena todo. `src/` sigue siendo la fuente: no se edita el
`dist/`. Lo único que no viaja son los Axies y las once texturas de interfaz, que se
piden al CDN de Sky Mavis.

## La portada

Lo primero que se ve es una pantalla entera con el terreno de fondo, unos cuantos Axies
del roster **paseándose por ahí** y dos botones grandes, uno en cada esquina de abajo.
**Jugar**, a la derecha, abre el menú de contra quién —la máquina, o alguien en otro
aparato— y de ahí sale la partida. **Elegí tu Axie**, a la
izquierda, abre la otra pantalla; debajo del nombre del botón dice con cuál estás
jugando ahora mismo.

**Cómo se juega** no es una tercera puerta: es la letra chica. Va chico y apagado abajo
en el medio, en el único lugar de abajo que no es una esquina. Estaba apilado debajo de
**Jugar**, y ahí hacía dos cosas mal — se leía como media puerta, y levantaba a jugar
del piso lo que mide un botón, así que las dos esquinas de abajo no quedaban a la misma
altura. En una pantalla angosta, donde las dos puertas se reparten el renglón de abajo,
el pie se queda con el renglón de abajo de todo y las dos suben lo que mide.

Son dos puertas y no dos escalones de la misma escalera, que es lo que eran antes. "¿Contra
quién?" se contesta cada vez que te sentás a jugar; "¿con cuál?" se contesta una vez y
queda puesta. Colgada del camino de jugar, la elección volvía a preguntar lo mismo antes
de cada partida —los mismos seis bichos— y encima había que pasar por el menú para ir a
mirarlos. Suelta en la portada es **tu Axie**: la abrís cuando querés y el botón de jugar
arranca sin preguntar nada. Tu Axie viene sorteado desde que se abre el juego, así que
apretar **Jugar** de entrada funciona igual de bien.

Antes esto arrancaba solo: se abría la página y ya había una partida contra la CPU
andando, con los selectores de modo y dificultad perdidos entre los botones de arriba.
Para jugar contra otra persona había que darse cuenta de que ahí había un desplegable,
cambiarlo, y ver cómo la partida que estabas mirando se reiniciaba sola. Eso no es un
juego: es un formulario que además baraja cartas. Ahora la mesa se monta **sin repartir**
—`mount(game, { start: false })`— y la primera partida la arranca la portada cuando ya
sabe con qué ([`src/lobby.js`](src/lobby.js)). Los selectores se fueron de arriba: el modo
lo elige el menú y la dificultad cuelga de la única opción que tiene máquina adentro.

## Elegir Axie

El Axie hizo el mismo viaje que el modo, y por el mismo motivo. Se elegía de un roster
chiquito arriba en la barra, **con la partida ya andando**, y tocarlo la reiniciaba de
cero: la decisión más importante que se toma en todo el juego —elegir un Axie es elegir
el mazo— resuelta con un clic accidental sobre un ícono de 54 píxeles.

Ahora es una pantalla propia, y no un paso más entre dos botones. Ocupa la escena
entera: el bicho grande a la izquierda, respirando, con una flecha de cada lado —seis se
recorren, no se buscan—; su **nombre** y su **clase** debajo; y a la derecha un panel con
**las diez cartas con las que arranca**, dibujadas en el mismo formato en que se van a
ver en la mesa, porque son las mismas cartas.

Que se vean las cartas es todo el punto. Sin eso, elegir un Axie es elegir un dibujo:
los seis mazos tienen exactamente la misma forma —cinco pares del color propio, una
carta con el color propio solo y cuatro cartas ajenas— y lo único que cambia es **de qué
color** son esas repeticiones. Debajo de las cartas eso está dicho en números: la cuenta
de cada símbolo en el mazo, de mayor a menor, con seis del propio arriba de todo y de
tres para abajo el resto. Es la misma cuenta que después decide cada tirada.

A esta pantalla se llega de un solo lado: el botón de la izquierda de la portada. Elegís
**el tuyo**, te lo deja puesto y te devuelve a la tapa sin arrancar nada — la vuelta tiene
los seis, sin restas. Contra la CPU no se pregunta nada más: jugás con el tuyo y el de la
máquina se sortea de otra clase, que es parte de la partida.

En una sala cada uno elige en su propio aparato, y elige **acá**: es la misma pantalla,
abierta encima de la sala con el botón **Tu Axie** mientras se espera al otro. Lo que
elegiste queda anotado en el navegador ([`src/loadout.js`](src/loadout.js)), que es lo
único que cruza la recarga con la que se entra a `?red`, y la pantalla se lo cuenta a la
sala al sentarse: la sala lo guarda y reparte con él cuando los dos dicen que están
listos. Los dos pueden traer **el mismo** Axie y está bien — cada uno lo eligió sin ver
al otro, y decirle a uno que ese no, que lo agarró el otro, sería devolverle una decisión
ya tomada.

Hubo un segundo camino hasta acá, y un segundo cartel: el **Jugador 2** del modo de dos
en el mismo teclado elegía en el medio del camino de jugar —era el único que no tenía
portada propia— y su botón decía **Empezar partida**. Se fue el modo y se fue el camino.

### El (+): un símbolo de más

Debajo de cada una de las diez cartas hay un **(+)**, y eso es la mejora del Axie: le
sumás **un símbolo** a la carta y queda puesto. Cuáles se pueden sumar no lo elige la
pantalla, lo elige la carta ([`boostOptions`](src/data.js)):

- Las **seis cartas de tu clase** —las cinco parejas y la que lleva tu símbolo solo—
  admiten **el tuyo** y ninguno más. Es el único que te sirve de las dos maneras: engorda
  la cadena de tu color, que es la que tu mazo puede seguir seis veces, y no le abre la
  puerta a ningún color nuevo. Con una sola opción no hay nada que preguntar: el botón
  muestra el crest y lo pone de un toque.
- Las **cuatro no favorables** —las que no llevan tu símbolo— admiten **uno de sus dos**,
  el que quieras. Son las cartas que no te representan, así que la mejora es decidir cuál
  de las dos mitades ajenas pesa: un `pez+reptil` mejorado con reptil queda con **dos
  reptiles y un pez**. Ahí el (+) sí pregunta, y abre los dos crests **debajo de su
  carta** y no en un menú flotante — sobre un panel que además scrollea, un menú se abre
  lejos de la carta de la que habla.

El símbolo repetido no es un adorno de la cuenta de abajo. **La racha cuenta cada
aparición**: una carta que trae el reptil dos veces abre su racha en 2 y la adelanta de a
dos, y la racha puntúa al cuadrado ([`timesIn`](src/rules.js)). Abrir con una carta
mejorada y encadenar tres cartas más es 5² = 25 donde antes era 4² = 16.

De ahí que la racha ahora lleve **dos cuentas y no una**. `length` es lo que puntúa
—cuántas veces salió el símbolo— y `cards` cuántas cartas la sostienen. Mientras cada
carta valía uno eran el mismo número, y la mesa se pintaba con el largo: "la racha llega
hasta la carta 3" era "la racha mide 3". Con una carta mejorada de por medio el largo
corre más rápido que las cartas, y pintar con el largo encendería una casilla de una
carta que todavía no salió.

Las mejoras se guardan **por Axie y no por asiento**: son del bicho. Te vas a mirar los
otros cinco, volvés, y tu mazo está como lo dejaste; y si en la mesa los dos se cambian de
lugar, cada mazo mejorado se muda con su dueño ([`pickAxie`](src/game.js)). Viajan a la
partida como `{ clave de la carta: símbolo }` —`{'beast+bird': 'beast'}`—, que es texto y
no un índice que se corre si el mazo cambia de orden, y `buildPersonalDeck` aplica solo lo
que la carta admite: una mejora que llega acompañando a otro mazo no es una mejora.

Lo que **todavía no hay es un precio**. Se pueden mejorar las diez, y mejorarlas todas es
gratis: mientras siga así, la pantalla no ofrece una decisión sino un botón que conviene
apretar diez veces. El lugar donde va a entrar el costo —un cupo, una moneda, mejoras que
se gastan al terminar la partida— es este mismo, y nada de lo de arriba cambia cuando
entre: la mejora ya es un dato guardado aparte del mazo.

El roster chiquito de la barra ya no está en ningún lado. Sobrevivió un tiempo para la
partida **en red** —el único modo sin portada, donde se entra por una sala y la partida
ya está andando cuando la pantalla se engancha— y ahí era exactamente lo que se había
sacado: la decisión más importante del juego, resuelta con un ícono de 54 píxeles arriba
de la mesa. La sala abre la pantalla de elección de verdad, la misma de la portada, y la
barra queda igual jugando solo que acompañado.

## La mesa: jugar y nada más

Sentado a la mesa lo único que se hace es jugar. Todo lo demás vive detrás de un botón de
**tres rayitas** arriba a la derecha: el sonido —los dos interruptores, cada uno con su
perilla de volumen—, las reglas y **Abandonar partida**, que devuelve al menú. Antes eran
seis botones y un roster desparramados sobre el cielo del terreno.

Los interruptores y las perillas son dos preguntas distintas y por eso son dos controles:
apagar no borra el volumen elegido, y al volver a prender el sonido vuelve donde estaba
(ver `setSfxLevel` en [`src/audio.js`](src/audio.js)). La perilla multiplica la mezcla del
juego, no la reemplaza: al 100% suena como está medido, que es como tiene que sonar.

Un detalle que no se ve pero que rompe la pantalla: la barra y la columna del mazo están
las dos clavadas a la ventana, y el menú cuelga de la barra cayendo justo encima de la
columna. Empatadas en `z-index` gana la que viene después en el HTML —la columna—, y el
menú se abriría **detrás** del mazo. La barra está un escalón más arriba a propósito, y
`test/styles.test.js` lo vigila.

El paseo es el punto. Los Axies ya traían las animaciones hechas, así que caminar no
hubo que inventarlo: `npm run poses` hornea también `walk` —el `action/run` del kit,
aflojado— y el clip mueve las patas **en el lugar**. Lo único que falta es mover el
lugar, y eso son dos variables CSS por bicho: dónde está a lo ancho del terreno (`--x`),
a qué profundidad (`--lane`) y en cuánto tiempo llega (`--dur`). De la profundidad sale
todo lo demás —cuánto mide, cuánta luz le llega, a quién tapa—, así que un mismo dibujo
sirve de bicho cercano y de bicho lejano.

Camina el navegador, no un temporizador: se escriben las variables y la transición hace
el resto. Un `setTimeout` cada 16 ms repartiendo píxeles entre cuatro bichos es la
manera más segura de que la portada empiece a tironear. Lo que sí lleva reloj es el
paseo en sí —adónde va cada uno, cuánto se queda parado al llegar—, y esa parte
([`nextStroll`](src/lobby.js)) está separada del DOM justo para poder probarla: mil
viajes seguidos sin que ninguno se salga del terreno ni camine de espaldas al rumbo
([`test/lobby.test.js`](test/lobby.test.js)). Parado, el Axie vuelve a respirar y de ahí
en más se aburre solo, que es de donde salen los rascados y los bostezos — la misma
maquinaria de la mesa (ver [Cómo se mueve](#cómo-se-mueve)).

El terreno y el reparto se sortean al abrir: son seis fondos y seis Axies, y verlos
siempre en el mismo orden hace que el juego parezca más chico de lo que es. Con
`prefers-reduced-motion` nadie se mueve: los bichos se quedan parados donde les tocó.

## La mesa también es una pantalla

La portada era una escena entera —el terreno de borde a borde, los bichos paseándose
encima— y la partida, apenas se apretaba **Jugar**, era otra cosa: una tarjeta redondeada
en el medio de una página azul, con el mismo terreno recortado adentro y el resto pintado
de liso. Se notaba el salto. Parecían dos juegos, y el bueno era el que todavía no había
empezado.

Ahora el combate ocupa la ventana. El terreno llega a los cuatro bordes y lo que antes
era el marco de la página pasa a ser lo que se apoya **encima**: la barra de arriba —el
logo, el marcador y el botón del menú— y la columna de la derecha —el mazo y el
historial—. Las dos flotan sobre el dibujo, con su desenfoque atrás y su propia sombra,
como los carteles de la portada.

Lo único difícil de esto es la línea de suelo, y es lo mismo que ya estaba resuelto: los
seis fondos traen su horizonte pintado a distinta altura (`--horizonte`), y los Axies
apoyan en el borde de abajo de la fila del escenario. Mientras el fondo fue el fondo de
una tarjeta, esa fila era la tarjeta y listo. Con la escena estirada a la ventana entera
había dos maneras de hacerlo, y una es una trampa:

- Clavar el dibujo a la ventana por su cuenta y **calcular** dónde cae la línea. Habría
  que saber cuánto mide la barra, cuánto las cartas y cuánto los botones — tres cosas que
  cambian con el contenido y con el tamaño de la letra. Se rompe sola.
- Dejar el dibujo donde estaba —adentro de la fila del escenario, que es la que sabe
  dónde apoyan las patas— y **estirarlo hacia afuera** con márgenes negativos, que le
  devuelven exactamente lo que el arena reservó para las dos secciones. El borde de abajo
  no se movió ni un pixel: sigue siendo la línea de suelo.

Es la segunda. La cuenta del horizonte no cambió.

### Las patas van a la mitad de la pantalla

Acá estaba el error, y no era de números: era de orden. La línea donde apoyan los Axies
salía de lo que sobraba —la ventana, menos la barra de arriba, menos las cartas de
abajo— y con eso caía a dos tercios de alto. Después se le pedía al dibujo que llenara
todo el cielo que quedaba encima. Y ese pedido es imposible de cumplir bien: el
horizonte de un dibujo apaisado está **a la mitad** de la imagen, así que llevarlo a dos
tercios de la pantalla es agrandarlo un 60%, que es pixelarlo.

Se dio vuelta: ahora la línea de suelo es una **medida elegida** (`--patas`) y lo que
sobra se acomoda alrededor. De la línea para arriba, cielo; de la línea para abajo,
suelo, las cartas y los botones. La grilla del arena tiene una fila vacía entre el
escenario y la mesa que se lleva todo el sobrante: es el pedazo de terreno delante del
bicho —la mitad de lo que lo hace ver apoyado— y es lo que mantiene las cartas contra el
borde de abajo en vez de dejarlas colgadas en el medio.

Parada la pantalla, la línea va a la mitad justa: es donde entra el terreno arriba y la
mesa entera abajo. Apaisada va **un poco más abajo** (56%), porque a la mitad exacta el
bicho queda demasiado arriba y le sobra suelo adelante. Y en una ventana baja no manda
ninguno de los dos: manda la mesa. `--frente` —lo que miden las cartas, los números y
los botones— es el tope, y la línea nunca baja tanto como para dejar una carta fuera del
cuadro.

Ahí, al dibujo no hay que pedirle casi nada: ya viene con esa proporción. Lo único que
tiene que hacer es cruzar la ventana de lado a lado, y eso lo hace **a su tamaño o más
chico**.

### Las cartas se aprietan entre ellas

Todo lo de abajo cuelga de un solo número, `--carta`, que sale del alto de la ventana y
del ancho —en un teléfono el que ata es el ancho—. De ahí salen el símbolo de adentro,
el alto de la mesa y, por lo tanto, dónde apoyan las patas: agrandar las cartas sube la
línea de suelo sin que haya que tocar nada más.

El alto de la mesa está **calculado y no medido**: es el de la carta más alta que puede
tocar —tres símbolos y un poder—, esté esa carta en la mano o no. Si se midiera, la mesa
crecería al salir una carta con poder y la línea del horizonte se movería en medio de
una tirada.

Y las cartas se aprietan entre ellas. Son anchas —se vinieron a ver—, así que una cadena
larga no entra: diez de estas en un teléfono parado se pasan de la pantalla, y antes eso
encendía la barra de scroll y había que arrastrar para ver la cadena propia. Ahora la
cadena entra siempre: cada carta cede un poco de ancho, y lo de adentro la sigue porque
el símbolo y los rellenos están en **porcentaje del ancho útil** y no en píxeles. Una
carta apretada tiene el símbolo más chico, y por lo tanto es también más baja: una
cadena larga ocupa menos a lo ancho y a lo alto, que es justo lo que hace falta cuando
ya no entra. El piso es el 40% del ancho normal; de ahí sí se desplaza, pero para eso
hace falta una cadena que ya no existe — diez cartas entran en un teléfono de 360.

### Los fondos son cuadrados

Con la línea a la mitad, una ventana apaisada ya está resuelta. La que no es un teléfono
parado: ahí el cielo que hay que llenar es la mitad de una pantalla muy alta, y un 16:9
no lo tapa ni de casualidad. Así que se les dio la forma que les faltaba: **los seis
fondos se extendieron hasta 1:1**, agregando cielo arriba
([`scripts/cuadrar.py`](scripts/cuadrar.py)).

El cielo nuevo no se inventó, que no hay con qué: sale del que ya está. Se promedia la
franja de arriba de la foto en una sola línea —que conserva la variación de izquierda a
derecha, y es lo que hace que parezca que el dibujo sigue— y esa línea se estira hacia
arriba, desenfocándose y apagándose contra el color de fondo a medida que se aleja, que
es lo que hace el aire con lo que está lejos.

Lo único con vuelta de tuerca es que esa franja **no siempre es cielo**. En la meseta, el
pico del cerro toca el borde de arriba de la foto, y estirarlo tal cual planta una
columna marrón subiendo al cielo — se vio, y era peor que el problema original. Así que
antes de estirar, la línea se limpia: las columnas que se van lejos de la mediana se
rellenan con la mediana, que es el cielo y nada más que el cielo. Arriba del pico queda
cielo, y el pico se apaga contra él en unas pocas filas, como la calina. El umbral se
mide contra la dispersión de la propia franja y no es un número puesto a mano: en la
jungla, donde la variación *es* el dibujo, sale alto y no se limpia nada.

Las dos cosas juntas dan esto:

| ventana | agrandado | cielo inventado a la vista |
|---|---|---|
| 1440×900 | 0.38× | 0% |
| MacBook 1728×1117 | 0.45× | 0–2% |
| tablet 1024×768 | 0.27× | 0–3% |
| teléfono 390×844 | 0.16× | 12–18% |
| monitor 2560×1440 | 0.67× | 0% |
| 4K 3840×2160 | 1.005× | 0% |

O sea: en cualquier ventana apaisada se ve el dibujo del kit y nada más que el dibujo,
a su tamaño o más chico. El cielo agregado existe para el teléfono parado, que es donde
no hay otra, y aun ahí queda arriba de todo, mitad detrás de la barra. Antes de todo
esto: 1.6–1.8× de agrandado en todas.

Queda además la red de seguridad de siempre: si en alguna ventana rara el dibujo no
llega a tapar todo el cielo, la capa de atrás lo completa con `--cielo` —el color
promedio de la franja de arriba del propio archivo, medido de la imagen— y los primeros
píxeles del dibujo se apagan contra ese mismo color. Es el mismo truco que ya hacía
`--piso` para abajo. **Plano, eso sí**: ahí hubo un degradé que se hundía hacia arriba
para dar profundidad, y era el degradé el que cortaba el fondo — el relleno se oscurecía
contando desde el borde de la pantalla y la imagen se apagaba contra el color puro, así
que donde se encontraban había una línea cruzando el cielo. La profundidad la pone la
viñeta del arena, que pasa por encima de los dos por igual y por eso no puede cortar
nada.

Los archivos, además, se volvieron a exportar desde el original del kit —1600 y 1920 de
ancho en vez de 1400, y con menos compresión—. Al de la meseta no le quedaba original,
así que sigue en 1400. El archivo suelto de `npm run build` pasó de 1.8 a 3.1 MB, que es
lo que cuesta que el fondo se vea.

### Y grandes

La tabla de arriba tiene una fila que la primera versión no miraba: 4K. Una pantalla de
3840 apaisada pide un dibujo de 3859 de alto —el piso de `--alto` es cruzar la ventana
de lado a lado, y no se negocia—, y contra un archivo de 1600 eso son **2,4 aumentos**.
Ahí sí se veían los píxeles: no en el juego, en el archivo.

Así que los seis se llevaron a 3840 ([`scripts/agrandar.py`](scripts/agrandar.py)), que
deja el agrandado de una 4K en 1,005× y el de todo lo demás por debajo de la mitad.
Agrandar no inventa detalle —eso no lo hace nadie—, pero el que ya estaba deja de
repartirse entre dos píxeles y medio, que es lo que dejaba el borde de una hoja hecho
una escalera. El horizonte no se movió ni un punto: `--horizonte` es una fracción del
alto, no un píxel, así que el reencuadre entero sobrevive al cambio de tamaño. Lo único
que se tocó del CSS fue `--nativo`, que es el techo del zoom y ahora son 3840 en los seis.

**Y son AVIF, que es lo que hace que esto entre.** A 3840 los seis en JPEG pesan 4,2 MB
y el archivo suelto se iba a 7; en AVIF pesan 662 KB —*menos* que los de 1600 que había
antes— y el build bajó de 3,1 a 2,4 MB con 2,4 veces la resolución. La letra chica es
que AVIF pide navegador de 2023 para arriba (Safari 16.4, Chrome 85, Firefox 93); en uno
más viejo el fondo no carga y queda el color plano de `--cielo` y `--piso`, que es feo
pero no rompe nada. Los `.jpg` cuadrados se quedan en `Backgrounds/` al lado de los
`.avif`: son la salida de `cuadrar.py` y la entrada de `agrandar.py`, o sea el original
del que se vuelve a generar todo.

### El encuadre de la portada

Lo de arriba deja dos cuentas pendientes, y en la portada se ven las dos.

La primera es el foco. El horizonte caía al 70% de la pantalla y los Axies se paseaban
entre el 72% y el 85%, o sea encima de los botones; arriba, media pantalla de cielo. Lo
mueve **un solo número**: `--suelo` es cuánto terreno queda por debajo del horizonte y
la franja por la que caminan cuelga de él, así que pasarlo de 32vh a 44vh en una ventana
alta baja el horizonte al 56% y sube a los Axies al 59%–78%. De yapa el dibujo se dibuja
**más chico**, porque queda menos cielo que llenar: en una ventana de 725×1014 pasa de
1,40 a 1,12 veces el ancho de la pantalla. Más arriba y más nítido, sin pagar nada.

La segunda es la mancha. Si el 43,75% de arriba del archivo es cielo agregado —una línea
de píxeles promediada, estirada y desenfocada—, ese pedazo **se ve**: en una ventana alta
eran 231 píxeles, el cuarto de arriba de la pantalla. La juntura del dibujo contra
`--cielo` ya existía para disimular su punta, pero llegaba al 21% y se quedaba corta. Va
al 40%, o sea hasta justo antes de la costura: lo que era mancha borrosa pasa a ser el
color plano del cielo del propio terreno. No cuesta un píxel de nitidez, no depende de la
forma de la ventana, y sirve igual en el arena, así que va en el dibujo y no en un
`@media`.

| ventana | horizonte | los Axies | relleno a la vista | agrandado |
|---|---|---|---|---|
| 725×1014 | 70% → **56%** | 72%–85% → **59%–78%** | 231px → **30px** | 0,64× → **0,51×** |
| teléfono 390×844 | 68% → **56%** | 70%–84% → **59%–78%** | 186px → **25px** | 0,51× → **0,42×** |
| 1200×1000 | 70% → **56%** | 72%–85% → **59%–78%** | 274px → **45px** | 0,75× (igual) |
| tablet 1024×768 | 68% (igual) | 70%–84% (igual) | 234px → **39px** | 0,64× (igual) |
| 1440×900 | 68% (igual) | 70%–84% (igual) | 229px → **54px** | 0,90× (igual) |

El corrimiento va en `@media (max-aspect-ratio: 5/4)` y no en `orientation: portrait`
porque el problema no es estar parado, es ser alto: una ventana de 1200×1000 es apaisada
y tenía el horizonte al 70% igual. De 5/4 para arriba el 68% ya cae donde tiene que caer.

Lo que **no** se hace es agrandar el dibujo para empujar el relleno por arriba del borde.
Se probó, y es la respuesta obvia y equivocada: pide 2,7 veces el ancho de la ventana, o
sea 1,23 veces el tamaño natural del archivo, y ahí el terreno se ve pixelado. El tope
del proyecto es 1,3 y la razón de haber extendido los fondos a 1:1 fue justamente dejar
de agrandar; gastarlo acá sería deshacer eso.

### Los botones salen del kit

Los botones eran rectángulos azules con un borde de 1px: la única parte de la pantalla
que no era del Origins. Alrededor había un terreno pintado a mano, seis Axies dibujados
por Sky Mavis y un cartel de resultado que sí venía del kit, y en el medio unos botones
que parecían de otro programa.

El asset kit **no trae botones**, y tampoco trae una tipografía —no hay un solo archivo
de fuente adentro del repo; el "VICTORY" del final del combate es un dibujo de una
palabra, no una letra que se pueda escribir—. Lo que sí trae son las piezas con las que
Sky Mavis arma su HUD, y dos de ellas son un botón si se las mira de costado:

- **las cintas talladas** (`bg_log_blue`, `bg_log_red`, `slider-fill`, `slider-bg`) —
  una plancha de borde redondeado con chevrones grabados, en azul, en rojo, en verde y
  en gris. Es el mismo dibujo que ya usaba el cartel del resultado.
- **el cartel de madera** (`player_name_bg`) — con el que el Origins rotula el nombre
  del que juega.
- **la tabla y su cartel** (`frame_back`, `name_panel`) — el fondo de madera clara de
  los paneles del Origins y el cartel tallado que les cuelga del borde de arriba. Con
  esos dos está hecha la pantalla de las salas (ver más abajo).
- **el aro tallado** (`avatar_frame`) y **la cruz** (`icon_close`) — el marco redondo de
  los avatares, que acá enmarca el número de una sala o de un asiento vacío, y la equis
  de cerrar.

Estiradas al tamaño del botón, las cintas *son* el botón: el redondeo, la textura y el
desgaste vienen pintados adentro y no hay que dibujar ninguno. El azul es el botón de
siempre, el verde el que empieza algo —"Atacar", "Jugar", "Jugar de nuevo"— y el rojo el
que arriesga —"Robar carta"—. Los tres colores salen del kit y no de un gradiente
inventado, que es lo que hace que se lean como el mismo objeto en tres colores.

La madera queda para las tres opciones de "contra quién": elegir contra quién no es
hacer algo, es poner un nombre en un lugar. La diferencia de material dice eso sin una
palabra, y de paso deja que la única cinta verde de la portada siga siendo la de jugar.

Dos cosas que se probaron y no eran:

- **La cinta verde grande** (`bg_log_green_big`, 1465×166) para el botón de jugar. A
  1465 de ancho, el redondeo de las esquinas mide 22 píxeles; estirada a los 300 de un
  botón, ese redondeo queda en cuatro y las esquinas salen cuadradas. La chica
  (`slider-fill`, 862×92) aguanta el redondeo en cualquier tamaño, y es la que quedó. La
  grande sigue en el cartel del resultado, que es lo suficientemente ancho como para que
  el dibujo entre casi a su tamaño.
- **Ponerle cinta a todos**. "Cómo se juega", "Volver" y los interruptores de sonido
  siguen siendo texto que se puede apretar. Si también fueran cintas, la pantalla sería
  una pila de cintas y ninguna diría nada.

La cinta **gris** es la que no empieza nada: la etiqueta de la sala a la que se entra
solo a mirar, y el botón de "Listo" cuando lo que hace es desdecirse. Es el mismo objeto
que el verde con el color apagado, que es exactamente lo que dice.

Los estados tampoco vienen del kit —no hay una versión "apretada" de cada cinta—, así
que se hacen con luz y con espesor: el borde de abajo grueso convierte al botón en una
tecla y apretarlo la hunde, que es lo que ya hacía el botón grande de la portada.

Y como con el resto de las texturas, cada botón lleva **su color debajo** —el promedio
del dibujo, medido del archivo—: el día que el CDN no conteste, el botón se ve peor en
vez de quedarse en un hueco transparente. Es lo que mira
[`test/styles.test.js`](test/styles.test.js).

## Reglas

Es un combate. Elegís uno de los seis Axies —uno por clase— y peleás con su mazo personal
contra la CPU, que usa otro. Los dos arrancan con **100 de vida**.

Se turnan. En tu turno te reparten una carta y vas **cargando el ataque**: cada carta que
robás lo hace más fuerte, pero si la cadena se corta el golpe falla. Al **plantarte** soltás
el ataque y los puntos de la cadena son el **daño** que le sacás al rival. Ahí mismo te
llevás cartas del centro, y recién entonces ataca la CPU. Cuando los dos atacaron, el
intercambio cierra solo y arranca el siguiente: no hay nada que apretar entre ronda y
ronda. Gana el que deja al otro **sin vida**.

**La última chance.** Al que se queda sin vida antes de haber atacado no se lo da por
muerto todavía: juega su turno igual —roba, encadena, se planta— con un halo de luz
alrededor. Si ese golpe deja sin vida al otro también, la partida termina en **empate**.
Solo le puede tocar al que juega segundo: al que abre, cuando lo matan, ya le pasó el
turno. Con el orden fijo, el que cobra la última chance es siempre el segundo asiento
—contra la CPU, siempre la CPU—.

Jugándola, la CPU hace su turno de siempre con una sola regla encima: apenas la cadena
le alcanza para empatar, se planta y lo asegura. Lo que no hace es perseguir el número
cuando todavía le falta —robar hasta llegar a la vida entera del rival es robar hasta
cortarse, y el golpe final salía en 0 casi siempre—.

El daño es el puntaje de siempre, mostrado al revés: `totals[p]` es lo que repartió `p`, y
la vida del otro es 100 menos eso ([`hpOf`](src/game.js)). Las reglas de la cadena no
cambian.

**La cadena.** Cada símbolo de la **primera carta** abre una cadena. Cada carta que
robás tiene que compartir al menos un símbolo con las cadenas todavía **vivas**. Las
cadenas que la carta nueva no contiene se cierran ahí, pero conservan su largo — y
no reviven aunque el símbolo vuelva a aparecer más adelante.

Si la carta nueva no comparte **ningún** símbolo vivo, se corta todo: el ataque se desarma
y hace **0** de daño.

**Puntaje.** Cada cadena vale su largo **al cuadrado**. Solo puntúan los símbolos de
la primera carta.

| carta | símbolos |
|---|---|
| 1ª | <img src="Icons/aquatic-crest.png" width="18" alt="aquatic"> <img src="Icons/bird-crest.png" width="18" alt="bird"> |
| 2ª | <img src="Icons/bird-crest.png" width="18" alt="bird"> <img src="Icons/aquatic-crest.png" width="18" alt="aquatic"> <img src="Icons/beast-crest.png" width="18" alt="beast"> |
| 3ª | <img src="Icons/bird-crest.png" width="18" alt="bird"> <img src="Icons/plant-crest.png" width="18" alt="plant"> |

<img src="Icons/bird-crest.png" width="18" alt="bird"> aparece en 3 cartas → 3² = **9**. <img src="Icons/aquatic-crest.png" width="18" alt="aquatic"> en 2 → 2² = **4**. Total: **13**.
<img src="Icons/beast-crest.png" width="18" alt="beast"> y <img src="Icons/plant-crest.png" width="18" alt="plant"> no estaban en la primera carta, así que no puntúan.

**Tu mazo.** Cada jugador roba de su **propio mazo de 10 cartas**, armado alrededor de
su símbolo. Para <img src="Icons/aquatic-crest.png" width="18" alt="aquatic"> Pez:

| | cartas |
|---|---|
| 5 pares del símbolo propio | <img src="Icons/aquatic-crest.png" width="18" alt="aquatic"><img src="Icons/beast-crest.png" width="18" alt="beast"> <img src="Icons/aquatic-crest.png" width="18" alt="aquatic"><img src="Icons/bird-crest.png" width="18" alt="bird"> <img src="Icons/aquatic-crest.png" width="18" alt="aquatic"><img src="Icons/plant-crest.png" width="18" alt="plant"> <img src="Icons/aquatic-crest.png" width="18" alt="aquatic"><img src="Icons/bug-crest.png" width="18" alt="bug"> <img src="Icons/aquatic-crest.png" width="18" alt="aquatic"><img src="Icons/reptile-crest.png" width="18" alt="reptile"> |
| 1 carta sola | <img src="Icons/aquatic-crest.png" width="18" alt="aquatic"> |
| 4 cartas ajenas | <img src="Icons/beast-crest.png" width="18" alt="beast"><img src="Icons/bird-crest.png" width="18" alt="bird"> <img src="Icons/bird-crest.png" width="18" alt="bird"><img src="Icons/plant-crest.png" width="18" alt="plant"> <img src="Icons/beast-crest.png" width="18" alt="beast"><img src="Icons/plant-crest.png" width="18" alt="plant"> <img src="Icons/bug-crest.png" width="18" alt="bug"><img src="Icons/reptile-crest.png" width="18" alt="reptile"> |

Las ajenas salen de seis pares fijos — <img src="Icons/beast-crest.png" width="18" alt="beast"><img src="Icons/bird-crest.png" width="18" alt="bird"> <img src="Icons/bird-crest.png" width="18" alt="bird"><img src="Icons/plant-crest.png" width="18" alt="plant"> <img src="Icons/beast-crest.png" width="18" alt="beast"><img src="Icons/plant-crest.png" width="18" alt="plant">
y <img src="Icons/bug-crest.png" width="18" alt="bug"><img src="Icons/reptile-crest.png" width="18" alt="reptile"> <img src="Icons/reptile-crest.png" width="18" alt="reptile"><img src="Icons/aquatic-crest.png" width="18" alt="aquatic"> <img src="Icons/aquatic-crest.png" width="18" alt="aquatic"><img src="Icons/bug-crest.png" width="18" alt="bug"> — de los que a cada jugador le
tocan los cuatro que no llevan su símbolo. Son dos triángulos disjuntos, así que cada
símbolo aparece en exactamente dos pares y a todos les sobran justo cuatro.

**No hay descarte.** Al empezar cada ronda el mazo se rebaraja entero —lo que se jugó la
ronda pasada y lo que se sumó del centro—, como una tragamonedas. Dentro de la ronda las
cartas que ya salieron no vuelven, así que contar sirve mientras dura la tirada; de una
ronda a la otra no se arrastra nada.

**El centro.** Hay siempre **6 cartas boca arriba**, sacadas de una reserva de 71
([`buildPool`](src/data.js)): **35 sin poder** —las 15 combinaciones de 2 símbolos y las 20
de 3, una por combinación— y **36 con poder**. Al llevarse una, se repone en el acto desde
la reserva. Apenas termina su turno —antes de que juegue el otro— cada jugador se lleva
cartas del centro según cómo le fue, y sus cartas jugadas vuelven a su mazo primero:

| resultado del turno | se lleva |
|---|---|
| soltaste el ataque | 1 carta **con poder** **o** 2 cartas **sin poder** |
| se te desarmó | 1 carta sin poder |

No se pregunta el modo: **la carta que tocás decide**. El tamaño de la carta no entra en el
reparto —lo que se elige es poder contra cantidad—. Si entre las que podés llevarte
**ninguna tiene tu símbolo**, el centro no ofrece nada que enlace con tu mazo: se **renueva
entero** —las 6 al fondo de la reserva, 6 nuevas a la vista— una sola vez por reparto y por
jugador. Eso cubre también el caso en que las seis traen poder y te toca una sin poder: no
hay nada elegible, y después de renovar solo queda pasar. Las cartas nuevas entran al mazo y
ya pueden salir en el intercambio siguiente. Si la reserva se agota antes de que alguien
caiga, se sigue jugando con el mazo armado.

**Los poderes.** Las 36 cartas con poder llevan, además de sus 3 símbolos, un **séptimo
símbolo** que la cadena no ve: no la abre, no la continúa, no la corta y no puntúa
—[`rules.js`](src/rules.js) ni se entera de que existe—. Solo dispara su efecto **al soltar
el ataque**, con el daño del turno ya contado.

| | poder | efecto |
|---|---|---|
| ⚔️ | fuerza | +1 de daño en este ataque y en todos los que siguen. Acumulable |
| ☠️ | veneno | la mitad de tu daño; muerde al finalizar su turno y después se parte al medio. Con 2 o menos se va. Acumulable |
| 🥚 | huevo | escudo por la mitad del golpe infligido (se reemplaza si se gana de nuevo); aguanta hasta romperse y pasa a ser 8 de daño fijo acumulable al romperse |
| 🪴 | maceta | te curás lo que pegaste, sin pasar de 100 |
| 🐌 | caracol | el próximo ataque del rival sale **partido al medio** (redondeando para arriba). Se gasta solo con un ataque que haya hecho daño. Acumulable: dos caracoles, los dos próximos |
| 🐙 | pulpo | una carta **de más** del centro, la que quieras: no se baraja, abre tu próxima ronda. Hay que haberse plantado. Acumulable |

Cada poder viaja siempre con **su propia clase** entre los 3 símbolos, así que el efecto de
tu color encadena con tu mazo mejor que ningún otro. Los pares que lo acompañan
([`POWER_TRIOS`](src/data.js)) están elegidos para que las seis clases aparezcan exactamente
18 veces entre las 36 cartas: 6 como dueña de su poder y 12 como acompañante. Son 36 cartas
sobre 20 tríos posibles, así que el mismo trío aparece con poderes distintos — encadenan
igual y se eligen por el efecto.

Si **se corta la cadena** el ataque hace 0, y con él se pierde todo: huevo, maceta, veneno,
caracol **y fuerza**. La fuerza era la excepción —no sale del golpe, así que salía igual— y
eso era justo el problema: la carta que menos costaba jugar se pagaba sola aunque el ataque
no saliera. El pulpo es el único que sigue cobrando, y no por el daño sino por la cadena, que
no es lo mismo. Con el caracol de antes la diferencia se veía —dejaba ataques enteros en 0 y
el pulpo cobraba igual, porque al jugador lo había dejado en cero el rival y no su propia
jugada—; el de ahora parte al medio y redondea para arriba, así que ya no puede apagar a
nadie y las dos condiciones dan lo mismo. La regla sigue escrita contra la cadena porque es
la que dice el motivo: el pulpo se paga plantándose. Los mazos iniciales de 10 **no traen
poderes**: los seis salen del centro y hay que ganárselos.

El pulpo es el único que no se cobra en daño. Abre una **etapa aparte** del reparto: una
carta suelta por cada pulpo puesto, sin las reglas del reparto —sirve cualquiera del centro,
también con poder— y de más, no en lugar de la que elegiste. Se guardan aparte
([`state.top`](src/game.js)) y al arrancar la ronda siguiente se apoyan encima del mazo ya
barajado, en el orden en que las tocaste. Como el mazo base son 9 pares y una carta sola, la
apertura que te toca es casi siempre de 2 símbolos: asegurarte un trío abre tres cadenas en
vez de dos, y **solo los símbolos de la primera carta puntúan**.

Rechazar la carta del pulpo la gasta. Es gratis y sirve cualquier carta, así que no tomarla
es una decisión rara; pero si no se gastara, un pulpo sin usar se arrastraría de ronda en
ronda para siempre.

**Balance del mazo base.** Medido sobre 4000 rondas: media ~3.1 puntos, 32% de cortes,
cadenas de 1-2 cartas, y los seis símbolos rinden casi igual (3.04 a 3.21), o sea que
ninguno arranca con ventaja. Es un mazo inicial pobre a propósito: casi la mitad de las
rondas conviene plantarse con la primera carta, y más de la mitad de las decisiones caen
con una probabilidad de continuar entre 35% y 75%.

**Quién abre.** Siempre vos, y contesta la CPU: los turnos van uno y uno toda la partida.
Abrir es el peor asiento por dos motivos, y los dos caen siempre del mismo lado: el que
juega segundo ve cuánto daño le hicieron antes de decidir, y es el único que puede cobrar
la última chance. Si algún día hay que emparejarlo, la palanca es esta línea.

**Balance del ciclo completo** (simulado con las dos partes jugando igual): la partida dura
~19 rondas, el mazo crece de 10 a ~27 cartas, y el puntaje por ronda sube de 3.2 (rondas 1-5)
a ~5.6 (rondas 16+). Medido con quién abría alternándose, el asiento no movía el resultado
(50% cada uno); ahora que el orden es fijo, la ventaja de cerrar queda siempre del lado de
la CPU.

Elegir bien del centro pesa: la heurística de la CPU le gana el 86% a elegir al azar.

**Los poderes no rompieron la simetría.** Con las dos partes usando la misma cabeza, 300
partidas antes y después: 38-55 sin poderes contra 44-54 con los seis. Ningún asiento ganó
ventaja. Lo que sí cambió es el largo — de ~17 rondas a ~14, porque hay más daño dando
vueltas.

**Pero pesan muchísimo.** Una medición simétrica es ciega a esto: si los dos lados agarran
poderes por igual, no dice nada sobre cuánto valen. Atando al jugador a un solo poder contra
la CPU normal, 800 partidas **sembradas** por poder, contra un control que nunca agarra
ninguno:

| escalón | | gana | vs. control |
|---|---|---|---|
| | control (nunca agarra poderes) | 4.4% | — |
| 1 | veneno | 15.8% | +11.4 |
| 1 | pulpo | 14.8% | +10.4 |
| 1 | huevo | 13.4% | +8.9 |
| 1 | fuerza | 12.8% | +8.4 |
| 2 | caracol | 12.1% | +7.7 |
| 2 | maceta | 10.9% | +6.5 |

**Ese orden no se puede leer, los escalones sí.** El ± de la columna "vs. control" es el
error de cada estimación *contra el control*, no el de la diferencia entre dos poderes: dos
pueden estar los dos clarísimo arriba del control y ser indistinguibles entre ellos. El banco
compara además cada poder **pareado contra el líder de su escalón** —no contra el de al lado,
porque una cadena de pasos chicos no medibles puede sumar entre las puntas una diferencia que
sí lo es— y abre uno nuevo cuando cae por debajo con el margen afuera. De ahí salen los pesos
de [`POWER_WORTH`](src/ai.js), que antes eran números de oficio.

Dos escalones, y el más caro vale 1.75 veces el más barato. Cuando se empezó a medir eran
tres escalones y 2.6 veces, con la fuerza sola arriba y el huevo solo abajo.

Los poderes **se empujan entre ellos**: la CPU juega los mismos seis, así que fortalecer uno
baja a los otros cinco. Al ponerle la cáscara al huevo, el pulpo cayó de +13.5 a +10.4 y el
veneno de +13.5 a +11.4 sin que nadie los tocara. Por eso los cambios van de a uno.

> **Estos números son de antes del último cambio de reglas.** La fuerza pasó a exigir un
> ataque que conecte, el veneno pasó de bajar 2 a partirse al medio, la cáscara pasó de un
> tercio del golpe a 5 fijos y el caracol pasó de un mordisco fijo durante 2 ataques a partir
> al medio un ataque. Cuatro de los seis poderes que la tabla mide, y el del caracol es el
> más grande de los cuatro: mordía **la mitad del golpe con que se lo ponían**, así que un
> atacante grande dejaba puesto un −15 que borraba entero el ataque siguiente del otro. Era
> el poder que apagaba, no el que debilitaba. La tabla hay que volver a correrla
> (`npm run balance`) antes de citarla: quedó como el estado anterior, no como el actual.

*Contar cuántas veces la CPU elige cada poder no mide nada de esto*: sale ordenado igual que
`POWER_WORTH`, porque es un reflejo de esos pesos y no del juego.

**Ignorar los poderes gana el 4.3%**, así que "una carta con poder o dos sin poder" casi
nunca es una decisión: el poder es casi siempre correcto. **Es a propósito.** Con los dos
lados usándolos la partida queda pareja, y la decisión interesante no es *si* agarrás un
poder sino *cuál*: son seis efectos que quieren mazos distintos.

### El pulpo, que se midió tres veces

Vale como ejemplo de todo lo que este banco hace bien y mal:

| | vs. control | qué cambió |
|---|---|---|
| reordenaba tu carta | +2.8 ±3.4 | — |
| carta **de más**, con poderes | +3.0 ±3.4 | el diseño |
| ídem, midiéndolo bien | **+17.4** ±4.6 | **el banco**, no el juego |
| ídem, exigiendo plantarse | **+13.5** ±2.9 | el diseño |

El salto de +3.0 a +17.4 no fue un cambio del juego: el banco ata al jugador a un solo poder
para aislarlo, y en la etapa del pulpo lo obligaba a traerse **otro pulpo**. El efecto del
pulpo es conseguir otras cartas; atarlo así lo medía contra una versión de sí mismo que nadie
jugaría, y lo dejaba último cuando era primero.

Casi todo su valor está en que la carta pueda llevar poder: sin poderes da +1.5, o sea 15.9
±4.3 puntos de diferencia. Capar la acumulación casi no mueve nada (−1.8): dos pulpos en la
misma cadena son raros. Exigirle plantarse sí: **−3.9 ±2.4** pareado, y con eso baja al
escalón del veneno sin tocarle nada a la decisión del jugador.

### Dos cosas que se midieron y no eran

**El tope del veneno.** La fuerza y el veneno eran los únicos dos poderes sin techo, así que
la hipótesis era aplicarles a los dos la regla del caracol —acumular en tiempo, no en
cantidad—. Con la fuerza funcionó: bajarla de +2 a +1 la sacó de +13.9 y la dejó en +7.6,
empatada con el caracol (`-5.6 ±2.5` pareado contra el juego anterior). Con el veneno no:
que un veneno nuevo se quede con el máximo en vez de sumarse da `-1.1 ±1.2`, dentro del
ruido. Y no es que el caso no ocurra —instrumentado sobre 200 partidas, el 20.7% de los
venenos caen sobre alguien ya envenenado—: cuando el tope muerde, la partida ya está
decidida. Mecánicamente real, irrelevante para ganar. Queda como variante `venenoMax`.

**La escala de `POWER_WORTH`.** Al recalibrar los pesos los números subieron en todos lados,
y la sospecha era que bajar cinco de seis había vuelto glotona de cartas sin poder a la CPU.
`TUNING.powerBias` multiplica la banda entera; a 0.7x, 1.5x y 2x no se mueve ningún resultado
fuera del ruido sobre 300 partidas. Lo que decide es el **orden relativo** de los pesos, no su
nivel absoluto.

### Volver a medir

```
npm run balance                      # 300 partidas por celda
npm run balance -- --games 800       # menos ruido
npm run balance -- --arms base,fuerza2 --powers all
```

Las partidas van **sembradas** ([`makeRng`](src/data.js), `createGame({ seed })`), y todas
las celdas usan las mismas semillas. Eso es lo que hace comparables dos variantes: la misma
estrategia sobre los mismos repartos, cambiando una constante, se compara de a pares y el
ruido del sorteo se cancela en vez de sumarse. Los números de los poderes viven todos en
[`TUNING`](src/data.js) y el banco los parchea para medir sin editar código.

Sin esto, dos corridas del mismo experimento daban distinto y hacía falta adivinar cuánto de
la diferencia era efecto y cuánto sorteo — que es el error que se cometió antes de que el
script existiera. Al 95% el margen es ±2 errores estándar, que el script imprime al lado de
cada número: lo que entra en ese margen no se puede afirmar, por más que la tabla salga
ordenada.



Atajos: `R` robar, `P` plantarse, `Enter` continuar.

## Los Axies

Hay **seis Axies fijos, uno por clase**, en [`src/axies.js`](src/axies.js): Colmillo
(<img src="Icons/beast-crest.png" width="16" alt="beast"> Bestia), Marea
(<img src="Icons/aquatic-crest.png" width="16" alt="aquatic"> Pez), Racha
(<img src="Icons/bird-crest.png" width="16" alt="bird"> Pájaro), Brote
(<img src="Icons/plant-crest.png" width="16" alt="plant"> Planta), Aguijón
(<img src="Icons/bug-crest.png" width="16" alt="bug"> Bicho) y Escama
(<img src="Icons/reptile-crest.png" width="16" alt="reptile"> Reptil).

Elegir un Axie es elegir con qué mazo jugás: **la clase del Axie es su símbolo**, y de ahí
sale su mazo de 10 cartas. La CPU juega otro, siempre de otra clase.

Cada Axie tiene además sus **seis partes** (`eyes`, `ears`, `mouth`, `horn`, `back`,
`tail`). Hoy las partes solo lo dibujan: no tocan las reglas ni el mazo. El día que sí lo
hagan, el gancho es `deckFor()` en ese mismo archivo — es lo único que el resto del juego
usa para armar una baraja.

### De dónde sale el dibujo

Los Axies se arman con [`@axieinfinity/mixer`](https://www.npmjs.com/package/@axieinfinity/mixer),
que **no** es una dependencia del juego: corre una sola vez, offline, en
[`scripts/axies.mjs`](scripts/axies.mjs).

```sh
npm run axies          # regenera src/axie-avatars.js
```

El script se baja el paquete a `.cache/` (ignorado por git), le pide a la librería el
esqueleto de cada Axie y exporta las capas de un avatar quieto: unas 11 imágenes con su
rectángulo, en fracciones del marco. Eso queda en `src/axie-avatars.js` (~10 KB) junto con
`PART_CATALOG`, las partes válidas de cada clase. En el navegador no hay mixer ni PixiJS:
`axieArt()` apila `<img>` y listo.

**Si cambiás una parte en `src/axies.js`, hay que volver a correr `npm run axies`** — el
navegador no puede recalcular las capas solo. Los tests avisan si el manifiesto quedó
viejo.

Las imágenes se sirven del CDN público de Sky Mavis
(`axiecdn.axieinfinity.com`, ~0,6 MB por Axie, cacheadas 24 h), no del repo: son de ellos.
Si el CDN no responde —o si abrís el `dist/` sin internet—, cada Axie cae al crest de su
clase y el juego sigue igual.

### Cómo se mueve

El mixer trae, además de los PNG, el **esqueleto Spine con 46 animaciones hechas** por Sky
Mavis: caras, patas, colas, el ataque, el golpe recibido, el festejo y cinco maneras de
aburrirse —entre ellas rascarse con la pata de adelante—. El juego no las puede reproducir
tal cual, porque dibuja una pila de PNG y no un esqueleto, así que se hornean offline igual
que las capas:

```sh
npm run poses          # regenera src/axie-poses.js
```

[`scripts/poses.mjs`](scripts/poses.mjs) evalúa el esqueleto cuadro a cuadro y guarda de
cada clip tres cosas:

- **el cuerpo** — cuánto se corre y cuánto gira, en porcentaje del marco. Es la mayor parte
  del movimiento, porque el esqueleto entero cuelga de un pivote.
- **las partes** — lo que hace cada capa *además* de eso. Para casi todas es cero —van de
  paseo con el cuerpo— y se descartan; quedan las patas, la cola, las orejas y el lomo, que
  son las que tienen hueso propio animado.
- **los dibujos** — los ojos y la boca tienen versiones alternativas en el CDN (`eyes-shut`,
  `eyes-angry`, `eyes-happy`, `mouth-open`, `mouth-bite`, `mouth-smile`, y patas `-long` y
  `-stretch`). El clip dice en qué momento cambia cada una.

Las dos últimas van **por dibujo y no por slot**: cada alternativa está en su propio lugar
de reposo —la boca abierta no va donde iba la cerrada—, así que cambiar de dibujo no mueve
nada. Mezclarlas fue un error caro: el salto que hay entre un dibujo y el otro se horneaba
como si fuera movimiento del hueso y después se le aplicaba también al que no había
cambiado, y los ojos se corrían de lugar cada vez que el Axie parpadeaba.

La matemática es la misma que usa la librería para armar la pila quieta —rotar y trasladar,
sin escala—, y el script **verifica que su pose de reposo caiga exactamente sobre
`axie-avatars.js`** antes de escribir nada: si el mixer cambia de cuentas, falla en vez de
producir Axies torcidos.

También mira los PNG: pide los primeros 64 bytes de cada dibujo alternativo y compara el
tamaño que declara el archivo con el que quiere el recorte. El esqueleto y el CDN a veces
dejan de decir lo mismo —Sky Mavis vuelve a exportar un dibujo y no toca el esqueleto—, y
entonces la capa sale estirada sin que nada se queje. Le pasaba a `reptile-04/eyes-shut`,
que el esqueleto cree de 161×97 y el CDN entrega de 161×42: los ojos cerrados salían 2,3
veces más altos de lo que son.

Los ojos del roster están elegidos a mano por eso mismo: hay partes cuyo `eyes-shut` es
casi el mismo dibujo que los ojos abiertos —`aquatic-02` cambia el 4% de los píxeles,
`bug-08` el 2%—, así que el Axie parpadea y no se nota. Los que están puestos cambian de
verdad.

De los 46 clips entran quince: los que un combate de cartas puede llegar a mostrar, más
uno que no es del combate sino de la portada —`walk`, que es el `action/run` del kit
aflojado a un paseo, y con el que los Axies se pasean por el terreno mientras nadie
apretó nada—.
Siete son emotes: los tres `idle/random` que el kit hizo para eso —rascarse, estirar el
cuello, gruñir— más cuatro prestados de situaciones que el juego no juega —recibir un buff,
comer, entrar a la arena—, que fuera de contexto se leen igual de bien: un saltito, masticar,
un tarascón, plantarse. Ninguno mueve al Axie de su lugar ni pide un dibujo que no esté ya
cargado. Salen 145 KB —29 KB comprimidos—, casi todo compartido: las patas de las seis
clases son las mismas.

[`src/axie-motion.js`](src/axie-motion.js) los reproduce con la Web Animations API. Tiene
dos niveles: una **base** que se repite mientras dure la situación —quieto, plantado para
atacar, festejando, desmayado— y **pulsos** que la tapan y se van solos —el ataque, el
golpe, un emote cada 5-11 segundos—. Los dos que pelean arrancan el bucle en
contrafase: con el mismo clip y el mismo reloj, dos muñecos sincronizados se leen como un
solo muñeco repetido.

Se aburre el que está respirando, y eso incluye al que ya se plantó para atacar:
`activity/prepare` es un pulso, y cuando termina abajo queda el mismo bucle de estar
quieto. Mirar solo `idle` dejaba al Axie propio sin hacer un gesto en toda la partida,
porque durante tu turno está plantado y el único que esperaba en `idle` era el de la CPU.
Es lo que mira [`test/motion.test.js`](test/motion.test.js), con reloj de mentira: un
minuto de partida y contar los emotes. Un muñeco más quieto no rompe nada, así que no se
nota desde ningún otro lado.

Los bucles del kit se aflojan (`rate`). Están hechos para verse un rato sueltos, no para
encadenarse toda la partida: el de estar quieto dura 1,33 s y trae un parpadeo adentro, así
que tal cual sale el Axie parpadea cada 1,3 segundos y parece nervioso.

El CSS no anima partes: se ocupa de la **puesta en escena** —dónde está parado el bicho,
adónde salta, adónde sale despedido, cómo se desploma— y del achatarse de los rebotes, que
es lo único que el horno no guarda. Las dos capas no se pisan porque tocan elementos
distintos: la escena va sobre `.axie` y `.axie-rig`, la actuación sobre `.axie-pose` y las
capas de adentro. Sin CDN, sin `animate()` o con `prefers-reduced-motion`, no se reproduce
nada y el juego es el mismo.

## El sonido

El kit trae **297 wav**: los efectos que Sky Mavis preparó para web
(`web-vfx/public/sfx/`), los mismos más unos cuantos que ahí faltan
(`Assets/OriginsKit/Audio/`) y quince temas (`Assets/OriginsKit/PvE/Music/`). Como con
los efectos de golpe, en el repo no queda un solo byte de audio: se baja cada archivo
una vez para **medirlo**, se guardan los números y el navegador pide el wav al CDN
recién cuando ese sonido hace falta.

```sh
npm run sfx            # regenera src/audio-clips.js
```

[`scripts/sfx.mjs`](scripts/sfx.mjs) lee el WAV a mano —recorriendo los chunks, porque
varios traen metadatos antes del audio— y de cada uno saca cuatro números:

- **`onset`** — los archivos arrancan con hasta 110 ms de silencio. Reproducidos tal
  cual, el golpe suena tarde: el efecto ya explotó. Se saltea.
- **`lead`** — cuánto tarda en llegar a su punto más fuerte (200 a 660 ms). Es lo que
  permite que el **pico** caiga sobre el impacto y no el arranque: `playHit` larga el
  sonido esa cantidad **antes** que el efecto.
- **`secs`** — cuánto se oye de verdad, para soltarlo cuando terminó.
- **`gain`** — los 41 archivos vienen normalizados al pico, así que el pico no dice
  nada: los 41 dan 1,0. El que dice es el RMS de la parte audible, y ahí hay **7 dB**
  entre el más flojo y el más fuerte. Sin emparejarlos el veneno tapa al huevo.

Eso es la medición. La mezcla —qué manda sobre qué— es una decisión de juego y vive en
[`src/audio.js`](src/audio.js): el golpe adelante, el tic de cada carta bien atrás
(suena hasta seis veces por turno) y la música al fondo.

| momento | archivo del kit | |
|---|---|---|
| cada carta de la cadena | `power_gain` | cortado a 0,5 s, y 6% más agudo por eslabón |
| **la carta que corta la cadena** | `mech_throw_hit` | un golpe seco de medio segundo, en el momento en que cae |
| el ataque que conecta | `<clase>_slash_attack` | el mismo golpe que dibuja el efecto |
| el huevo que aguanta | `shield` | |
| la cáscara que vuelve | `reflect_damage` | |
| los seis poderes | `damage_boost`, `poison`, `buff`, `heal`, `weak`, `bubble` | en fila, después del impacto |
| el centro que se abre | `summon_on` | |
| una carta que entra al mazo | `mech_projectile_hit` | un clic de 0,25 s |
| renovar el centro | `dispel` | |
| ganar / perder | `power_awaken` / `death_mark` | |

La cadena cortada costó tres intentos y los dos primeros fallaron por lo mismo:
elegir el archivo por el nombre. El obvio era `disarm.wav`, el que le corresponde al
efecto `disarmed` que se dibuja. Medido, es **otro swoosh**: 4644 Hz de centroide
contra los 4575 Hz que promedian los seis golpes de clase, la misma planitud espectral
que un `slash` (0,22) y, como ellos, subiendo. Sonando después de seis tics que también
suben, se perdía adentro de la tirada. El segundo intento —`hex`, tonal y una octava
más abajo— arreglaba el registro pero no el gesto: **tarda 550 ms en llegar a su punto
más fuerte**, o sea que es un swell, y un corte que crece durante medio segundo no es
un corte.

Lo que hacía falta era un impacto, así que se midieron el ataque y la cola de los 45
impactos del kit. `mech_throw_hit` llega a su pico en **165 ms** con el 69% de la
energía de su arranque por debajo de 400 Hz, se corta a los 0,45 s (`CUT` en
`audio.js`) y sale un 10% más grave (`RATE`). De paso es de una clase que este juego no
juega, así que no se puede confundir con el golpe de nadie.

Pero la mitad del problema no era el archivo sino **cuándo sonaba**. El corte se oía
junto con la animación de desarme, que llega 700 ms después: para entonces el jugador
ya había leído en la pantalla que se le había cortado, y el sonido no le contaba nada.
Ahora suena en el momento en que la carta cae —la misma línea que decide el tic, en
[`audio-cues.js`](src/audio-cues.js)— y el desarme que viene después va en silencio. Es
lo que hace la diferencia: no es un ruido más en la escena, es la respuesta a la carta
que acabás de robar.

La carta que entra al mazo tuvo el mismo problema por el mismo motivo. El primer
archivo fue `feather` —una pluma, que para una carta suena obvio— y medido es un pad:
**300 ms de ataque, 1,94 s audible y planitud espectral 0,014**, o sea tonal. El tic de
robar también es tonal, y la carta se agarra medio segundo antes de que abra el turno
siguiente: los dos se fundían en una sola cosa larga. `mech_projectile_hit` es lo
contrario en los tres ejes —75 ms de ataque, ruidoso (0,42), una octava más arriba— y
cortado a 0,25 s es un clic, que es lo que una carta apoyándose tiene que ser.

Las tres veces el error fue el mismo: **elegir por el nombre del archivo**. La pluma
para la carta, el `disarm` para el desarme. Los nombres del kit describen para qué lo
hizo Sky Mavis, no cómo suena al lado de otra cosa, y eso último es lo único que
importa cuando hay veinte sonidos compitiendo por el mismo segundo.

El tic que sube es lo único que no sale del kit tal cual: **cada carta suena un 6% más
arriba que la anterior**, hasta una quinta justa en la cadena más larga que se vio en el
banco de pruebas. Es la tensión de la tirada dicha con el oído — mientras sube, la cosa
va bien.

Los poderes se aplican todos en el mismo instante en que se suelta el ataque, o sea
antes de que el golpe llegue a verse. Sonando ahí serían un acorde: esperan al impacto
—el mismo `hitDelay` con el que se sincroniza el sacudón— y salen de a uno cada 260 ms.

[`src/audio-cues.js`](src/audio-cues.js) decide todo eso **mirando el estado**, como ya
hacía la pantalla con `lastHit`: guarda una foto y la compara con la del repintado
siguiente. Un huevo que subió es un huevo que se acaba de poner. Así las reglas siguen
sin saber que existe el audio: `game.js` no tiene una sola línea de sonido. Lo único
que se cuenta con `ownedBy` y no con el mazo pelado es cuántas cartas tiene cada uno:
el mazo también sube al cerrar el turno, cuando la cadena vuelve adentro, y eso sonaba
a carta nueva del centro.

**La música** son dos temas —`pve_1` para el combate y `boss` cuando alguien baja del
30% de vida—, y ninguno de los dos es un bucle: terminan con un fundido. La vuelta
siguiente se larga encima de ese fundido, así que el empalme queda tapado por la cola
que se está yendo; cuánto solapar sale de medir el fundido de cada tema. El final la
apaga, para que el remate suene solo.

Los efectos vienen prendidos y la música no: son 3,7 MB de wav que el navegador tiene
que bajar, y eso lo decide el que juega. Los dos interruptores están arriba a la
derecha y quedan guardados. Un efecto pesa 250-460 KB y se baja la primera vez que
suena —parecido a los atlas de los golpes, que son 700 KB cada uno—.

Nada de esto es indispensable. Sin `AudioContext`, sin CDN o con la pestaña en segundo
plano no suena nada y el juego es exactamente el mismo, igual que con los efectos.

## Los dos asientos

Adentro no hay "el jugador" y "la máquina": hay dos **asientos**, `p1` y `p2`, y lo único
que distingue un modo del otro es quién los juega ([`isBotSeat`](src/game.js)). El turno
de la máquina se dispara en `beginTurn` solo si el asiento es suyo; si no, el juego se
queda esperando que alguien apriete, que es exactamente lo que ya hacía con el primero. La
pantalla pregunta a quién le está hablando con `acting()` y `drafter()` —el asiento del
turno y el del reparto, si no los juega la máquina— en vez de dar por sentado que es `p1`.

Eso es lo que hace que la partida de las salas sea la misma partida (`mode: 'net'`): las
mismas reglas, el mismo mazo y el mismo centro, con el segundo asiento esperando a una
persona en vez de resolverse solo.

Hubo un tercer modo, **2 jugadores**, con los dos asientos en el mismo teclado. Se fue, y
no porque fallara: no era un modo, era una explicación. El menú tenía que contarle a todo
el que abría el juego que existía la posibilidad de que alguien se sentara al lado, y ese
renglón lo pagaban también los que juegan solos. Jugar con otra persona es una sola cosa y
ahora se pide en un solo lugar: una sala. Lo que quedó de aquel modo es todo lo de arriba
—los dos asientos— que es lo que hoy hace andar las salas.

Lo que cambia con el modo son los textos: contra la CPU el jugador es "vos" y el registro
le habla en segunda persona; en una sala el registro lo escribe el servidor y lo leen los
dos aparatos, así que ninguno de los dos asientos puede ser "vos" y todo va en tercera. Eso
vive en [`VOICE`](src/game.js), y con él la misma línea de código escribe *"Vos sacás 🐟🐦
→ ataque de 4"* o *"Jugador 2 saca 🐟🐦 → ataque de 4"*. La perspectiva la agrega cada
pantalla encima (ver [Cada pantalla es un asiento](#cada-pantalla-es-un-asiento)). Los
colores del registro también cambiaron de criterio: antes decían si la noticia era buena o
mala, y con dos personas jugando "buena" es de quién. Ahora cada línea se pinta del asiento
que la provocó.

**Quién abre se sortea** al empezar cada partida entre dos personas. El que cierra el
intercambio ve el golpe del otro antes de decidir el suyo, y eso es una ventaja: contra la
CPU es fija a propósito —se la lleva el lado que no la necesita, y con ese orden se midió
todo el balance de los poderes—, pero entre dos personas no hay ningún lado que la merezca.
El sorteo es por partida y no por ronda: dentro de una, el que abre abre siempre, porque
alternar hacía que en cada cambio de ronda el mismo bicho jugara dos veces seguidas.

En el roster de la barra, tocar el Axie que ya tiene el otro **cambia los dos de asiento**:
las clases tienen que ser distintas —la clase es el mazo—, y "quiero ese bicho" casi
siempre quiere decir eso.

[`test/versus.test.js`](test/versus.test.js) prueba lo único que puede romperse acá, y lo
prueba contra la partida sola, sin servidor: que el segundo asiento **no se juegue solo**
—se le dejan pasar veinte vueltas del reloj y no roba—, que las mismas funciones lo muevan,
y que una partida entera llegue al final movida solo desde afuera.

## Contra otro aparato

El celular entra a una página y juega contra la computadora que tiene el servidor
prendido. Los dos tienen que estar en la **misma red** — la misma WiFi de la casa—:
`npm start` imprime al arrancar las direcciones que sirven para eso, y son las que hay
que escribir en el celular.

```
Para jugar contra otro aparato de la misma red, los dos entran a:
  http://192.168.1.42:8000/?red
Uno crea la sala, el otro entra, y los dos aprietan Listo.
```

Los dos caen en el **lobby**: la lista de salas que hay, con cuánta gente tiene cada una.
Uno crea la suya de un toque, el otro la ve aparecer en la lista y entra, y adentro cada
uno aprieta **Listo**. Recién ahí empieza.

Adentro de la sala, además de los dos asientos, está **Tu Axie**: con cuál entrás —el que
elegiste en la portada, o el que se sorteó la primera vez que abriste el juego— y un
toque para cambiarlo, que abre la pantalla de elección de siempre encima de la sala. Es
la única pregunta que queda antes de repartir, y se contesta antes: sentado a la mesa lo
único que se hace es jugar.

Ese botón no es un trámite. Antes la partida arrancaba sola al juntarse dos personas en la
única sala que había, y eso tenía dos problemas: entrar a mirar quién estaba te metía en
una partida, y cuando el otro aparato no llegaba la pantalla se quedaba esperando sin decir
a qué. Con la lista se ve quién hay antes de sentarse, y con el botón la partida empieza
cuando los dos dicen que sí.

`localhost` no sirve para esto: desde el celular apunta al celular. Por eso el servidor
busca la IP de la red y la escribe él — buscarla a mano es la parte que hace que no se
pruebe nunca. Desde la computadora se llega igual con la opción **En red** del menú, que
solo se prende cuando la página la sirvió este servidor: abierta como archivo suelto no
hay sala a la que entrar.

### La sala es una pantalla del juego

Era un cartel del navegador: un rectángulo azul oscuro centrado sobre un vidrio
esmerilado, con un rombo por título y la lista de salas hecha de renglones con borde de
un píxel. Al lado de la portada —el terreno pintado, el logo grande, las cintas
talladas— parecía otro programa. Y es peor que en cualquier otra pantalla, porque **es
la primera**: el que entra con el link del otro desde el celular no vio la portada
nunca, así que la única pantalla que no se parecía al juego era justamente la puerta.

Ahora está hecha con las piezas que ya estaban, y cada una hace lo que hace en el resto
del juego:

- **el terreno** de tu Axie atrás, colgado de la misma regla que la mesa y la portada
  (`.arena-art i`): la sala es tuya, así que el fondo es tu casa.
- **el logo** arriba, en la versión con contorno blanco, que es la que se apoya sobre un
  dibujo.
- **la tabla** del Origins (`frame_back`) como panel, con su canto y su espesor, y el
  **cartel de madera** (`name_panel`) colgado del borde de arriba con el nombre de la
  pantalla. Si se corta el cable, ese cartel se pasa a la cinta roja: un cartel de
  madera que dice "Se cortó la conexión" se lee como un título, en rojo se lee como lo
  que es.
- **la madera** (`player_name_bg`), la misma de las tres opciones de "contra quién", para
  cada sala de la lista y cada asiento de la sala. El material vuelve a decir qué es
  cada cosa: la madera es un lugar con un nombre puesto y la cinta es algo que se hace,
  y por eso el único verde de la pantalla es el de entrar.
- **la cruz** (`icon_close`) en la esquina, que es la puerta de salida de la sala. Solo
  existe adentro de una —atrás está la lista, que es a donde vuelve— y sigue puesta con
  el cable cortado, que es justo cuando uno quiere salir.

Y de paso los dos renglones dicen más de lo que decían. Cada sala de la lista lleva su
número en el aro tallado, su código, **un hueco por asiento con el crest del que ya está
sentado** —si hay lugar y contra qué, que es lo que uno quiere saber antes de tocar— y
qué va a pasar si la toca: `Entrar` en verde, o `Mirar` en gris si está llena o ya
jugando, porque con los dos asientos ocupados se entra igual pero a mirar. Adentro, cada
asiento **dibuja su Axie** con el mismo muñeco de la mesa: es la primera vez que se ve al
rival, y verlo es la mitad de lo que se está esperando cuando se espera al otro. El
asiento vacío muestra su número en el mismo aro, que es lo que dice que ahí falta
alguien.

La lista se pide cada segundo y pico, así que se repinta **solo si cambió algo**: ahora
tiene dibujos adentro, y rehacer el marcado con los mismos datos los hace pestañear.

### Dónde vive la partida

En el servidor, y en un solo lugar. `scripts/net.mjs` corre `createGame()` igual que lo
corría el navegador, y los clientes dejan de tener partida: dibujan el estado que les
llega y mandan lo que su dueño aprieta.

No es una decisión de arquitectura sino de confianza. Si cada navegador tuviera su
copia habría que creerle a los dos, y dos copias de una partida con azar adentro se
separan en la primera carta que se reparte. Con una sola copia no hay nada que
sincronizar, y **quién puede hacer qué se comprueba de un solo lado**: cada acción llega
firmada con el asiento de quien la pidió, y `allowed` en `game.js` la deja pasar solo si
es el que está jugando. Esa línea es lo único que impide que el celular juegue el turno
de la computadora.

El canal es SSE para abajo y un POST para arriba. Alcanza de sobra: el juego es por
turnos y son unos pocos mensajes por segundo. Además SSE ya estaba en este servidor para
recargar la página al guardar, así que no entró nada nuevo — un WebSocket habría traído
su propio framing o una dependencia, y no compraba nada.

### Lo que no se puede ver, no viaja

El estado sale recortado (`redact`):

- **La reserva** boca abajo que repone el centro va en blanco, con el largo puesto.
  Mandarla entera sería decirles a los dos qué cinco cartas se van a reponer.
- **Los mazos** van con las mismas cartas pero **barajados de nuevo**. Qué cartas
  tienen es público —se ve cada una que el otro se lleva del centro, y el mazo inicial
  sale de su clase—, pero el orden no lo conoce ni su dueño: es exactamente lo que mide
  el aro de la próxima carta. Mandarlo tal cual lo convertiría en un adorno.

Todo lo demás viaja entero, porque es público por definición: está a la vista de los dos
en la pantalla.

### Cada pantalla es un asiento

Contra la máquina la pantalla es tuya y del turno no hay nada que discutir. En una sala
no: cada aparato es un asiento, y de eso dependen tres cosas.

- **Los botones.** Solo los del turno propio. El del otro no es una espera muerta —se ve
  cómo se le arma la cadena carta por carta en la misma mesa—, pero no hay nada que
  apretar, y el medidor de la próxima carta tampoco se muestra: sale del mazo ajeno.
- **El lado.** Cada uno se ve a sí mismo a la **izquierda**, que es donde uno se busca.
  El lugar en pantalla pasó a colgar de `data-side` en vez del asiento; lo que sigue
  colgando del asiento es el color, que es su identidad y tiene que ser el mismo en las
  dos pantallas.
- **El "vos".** El registro lo escribe el servidor, así que es el mismo para los dos y va
  en tercera persona —"Jugador 2 saca…"—. La perspectiva la agrega la pantalla encima:
  tu chapa dice **Vos** y los carteles te hablan a vos.

El que llega con los dos asientos ocupados entra igual y **mira**. Ese caso es la razón
de que la pantalla marque aparte "esto es en red" (`netPlay`) además del asiento: sin
eso, una pantalla sin asiento se confundiría con la compartida, que sí tiene los botones
de los dos.

Recargar no cuesta el asiento. El navegador guarda un id y el servidor le guarda el
asiento unos segundos, así que un F5 en el celular vuelve al mismo lugar en vez de quedar
mirando desde afuera. La sala también queda en la dirección (`?red&sala=KJ7M`), así que
recargar vuelve a ella y no al lobby — y ese link se le puede pasar al otro ya apuntando
adentro.

### Lo que esto no es

Es la red de una casa, no internet. Las salas no tienen contraseña: el código sirve para
llegar a una, no para cerrarla, así que cualquiera de la misma WiFi puede sentarse en un
asiento libre. Tampoco hay cuentas ni historial — una sala vacía se borra sola al minuto.
Para jugar desde afuera el servidor es el mismo: lo que falta es exponerlo, con un túnel o
subiéndolo a algún lado, y recién ahí las salas necesitarían llave.

[`test/net.test.js`](test/net.test.js) prueba las salas y el servidor de verdad —levanta
`dev.mjs`, crea una sala por HTTP, abre dos streams, los pone listos y juega—, y
[`test/netui.test.js`](test/netui.test.js) prueba la otra mitad: el lobby, la sala, que la
pantalla se enganche con su asiento, que en el turno ajeno no haya botones y que el que
mira no tenga ninguno.

## La CPU

`src/ai.js` evalúa cada decisión con un *lookahead* sobre las cartas que todavía no
se vieron **de su propio mazo**, agrupadas por combinación de símbolos. Tres niveles
cuestan ~6 ms.

| | profundidad | margen sobre plantarse | juega el final |
|---|---|---|---|
| Fácil | 1 | 1.35× (tímida) | no |
| Normal | 2 | 1.0× | sí |
| Duro | 3 | 1.0× | sí |

"Juega el final" es cuando el golpe del humano dejó a la CPU sin vida: la partida termina
en este intercambio, así que plantarse por debajo pierde igual y la CPU sigue robando
aunque el valor esperado diga lo contrario.

Para elegir del centro usa **conectividad** ([`connectivity`](src/ai.js)): por cada símbolo
de la carta, cuántas cartas de su mazo lo llevan. Es la medida directa de lo que puntúa el
juego — una carta sirve en la medida en que puede continuar cadenas que ya podés abrir.
Para el reparto compara las dos ramas en la misma unidad: la conectividad de las dos cartas
sin poder contra la de la carta con poder **más lo que vale su efecto**, convertido a
conectividad con el promedio de lo que estaría resignando ([`POWER_WORTH`](src/ai.js)). Así
la comparación se adapta al mazo — cuando las cartas sin poder enlazan muy bien, el efecto
tiene que valer más para ganarles.

## Estructura

| archivo | |
|---|---|
| `src/data.js` | símbolos, iconos, poderes, mazo personal y reserva común |
| `src/axies.js` | el roster: seis Axies, sus partes, su mazo y su dibujo |
| `src/axie-avatars.js` | generado — capas de cada Axie y catálogo de partes |
| `src/axie-poses.js` | generado — las animaciones del kit, horneadas |
| `src/axie-motion.js` | las reproduce sobre las capas |
| `src/rules.js` | cadenas, cortes, puntaje y probabilidades — funciones puras |
| `src/ai.js` | decisión de la CPU |
| `src/game.js` | máquina de estados: turnos, daño, poderes, centro y reparto, sin DOM |
| `src/audio-clips.js` | generado — los sonidos del kit, medidos |
| `src/audio.js` | el mezclador: los larga, los empareja y encadena la música |
| `src/audio-cues.js` | qué suena en cada momento, mirando el estado |
| `src/ui.js` | render y eventos de la mesa |
| `src/lobby.js` | la portada: el paseo de los Axies, el menú de contra quién y la elección de Axie |
| `src/loadout.js` | con qué Axie jugás, anotado en el navegador: lo único que cruza a la sala |
| `src/net.js` | la partida de allá con la cara de la de acá: stream, POST y sala |
| `scripts/net.mjs` | la sala: una partida en el servidor y dos pantallas mirándola |
| `scripts/axies.mjs` | corre el mixer offline y regenera `src/axie-avatars.js` |
| `scripts/poses.mjs` | hornea las animaciones del kit a `src/axie-poses.js` |
| `scripts/cuadrar.py` | extiende los terrenos del kit hasta 1:1, agregando cielo |
| `scripts/agrandar.py` | agranda esos terrenos a 3840 px y los guarda en AVIF |
| `scripts/sfx.mjs` | mide los sonidos del kit y escribe `src/audio-clips.js` |
| `scripts/build.mjs` | empaqueta todo en un solo `.html` |
| `scripts/balance.mjs` | banco de pruebas: mide cuánto vale cada poder en partidas |
