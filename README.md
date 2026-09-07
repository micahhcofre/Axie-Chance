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

`scripts/dev.mjs` sirve el repo con `Cache-Control: no-store` y recarga la pestaña sola
cuando guardás un archivo, así lo que ves siempre es `src/`. Con un servidor estático
común (`python3 -m http.server`) el navegador se queda con los módulos viejos en caché y
los cambios no aparecen hasta un recargado forzado.

```sh
npm test               # reglas, flujo de partida y render
```

Para tener el juego en un archivo suelto, sin servidor ni dependencias:

```sh
npm run build          # dist/axie-chance.html (~267 KB, crests incluidos)
```

El build lee `src/` y `styles.css`, les saca los `import`/`export`, mete los crests
como data URI y concatena todo. `src/` sigue siendo la fuente: no se edita el `dist/`.

## Reglas

Es un combate. Elegís uno de los seis Axies —uno por clase— y peleás con su mazo personal
contra la CPU, que usa otro. Los dos arrancan con **100 de vida**.

Se turnan. En tu turno te reparten una carta y vas **cargando el ataque**: cada carta que
robás lo hace más fuerte, pero si la cadena se corta el golpe falla. Al **plantarte** soltás
el ataque y los puntos de la cadena son el **daño** que le sacás al rival. Ahí mismo te
llevás cartas del centro, y recién entonces ataca la CPU. Cuando los dos atacaron, el
intercambio cierra. Gana el que deja al otro **sin vida**; el rival alcanza a devolver
el golpe.

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

**El centro.** Hay siempre **5 cartas boca arriba**, sacadas de una reserva de 71
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
entero** —las 5 al fondo de la reserva, 5 nuevas a la vista— una sola vez por reparto y por
jugador. Eso cubre también el caso en que las cinco traen poder y te toca una sin poder: no
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
| ☠️ | veneno | la mitad de tu daño; muerde al cerrar cada intercambio y después baja 2. Acumulable |
| 🥚 | huevo | escudo de la mitad de tu daño; aguanta golpes hasta gastarse |
| 🪴 | maceta | te curás lo que pegaste, sin pasar de 100 |
| 🐌 | caracol | los próximos 2 ataques del rival pegan la mitad de tu daño menos. Acumula ataques y se queda con el mordisco más grande |
| 🐙 | pulpo | la carta que agarres del centro no se baraja: abre tu próxima ronda. Acumulable |

Cada poder viaja siempre con **su propia clase** entre los 3 símbolos, así que el efecto de
tu color encadena con tu mazo mejor que ningún otro. Los pares que lo acompañan
([`POWER_TRIOS`](src/data.js)) están elegidos para que las seis clases aparezcan exactamente
18 veces entre las 36 cartas: 6 como dueña de su poder y 12 como acompañante. Son 36 cartas
sobre 20 tríos posibles, así que el mismo trío aparece con poderes distintos — encadenan
igual y se eligen por el efecto.

Si **se corta la cadena** el ataque hace 0, y con él se pierde todo lo que se mide contra el
daño: huevo, maceta, veneno y caracol. La fuerza y el pulpo salen igual, porque no salen del
golpe. Los mazos iniciales de 10 **no traen poderes**: los seis salen del centro y hay que
ganárselos.

El pulpo es el único que no se cobra en daño: marca las próximas cartas que agarres del
centro para que **no entren al barajado**. Se guardan aparte ([`state.top`](src/game.js)) y
al arrancar la ronda siguiente se apoyan encima del mazo ya barajado, en el orden en que las
tocaste. Como el mazo base son 9 pares y una carta sola, la apertura que te toca es casi
siempre de 2 símbolos: asegurarte un trío abre tres cadenas en vez de dos, y **solo los
símbolos de la primera carta puntúan**.

**Balance del mazo base.** Medido sobre 4000 rondas: media ~3.1 puntos, 32% de cortes,
cadenas de 1-2 cartas, y los seis símbolos rinden casi igual (3.04 a 3.21), o sea que
ninguno arranca con ventaja. Es un mazo inicial pobre a propósito: casi la mitad de las
rondas conviene plantarse con la primera carta, y más de la mitad de las decisiones caen
con una probabilidad de continuar entre 35% y 75%.

**Quién abre.** Se alterna cada ronda. El que juega segundo ve cuánto daño le hicieron y
con cuánta vida quedó.

**Balance del ciclo completo** (simulado con las dos partes jugando igual): la partida dura
~19 rondas, el mazo crece de 10 a ~27 cartas, y el puntaje por ronda sube de 3.2 (rondas 1-5)
a ~5.6 (rondas 16+). Quien abre la partida gana el 50%, así que no hay ventaja de orden.

Elegir bien del centro pesa: la heurística de la CPU le gana el 86% a elegir al azar.

**Los poderes no rompieron la simetría.** Con las dos partes usando la misma cabeza, 300
partidas antes y después: 38-55 sin poderes contra 44-54 con los seis. Ningún asiento ganó
ventaja. Lo que sí cambió es el largo — de ~17 rondas a ~14, porque hay más daño dando
vueltas.

**Pero pesan muchísimo.** Una medición simétrica es ciega a esto: si los dos lados agarran
poderes por igual, no dice nada sobre cuánto valen. Atando al jugador a un solo poder contra
la CPU normal, 400 partidas **sembradas** por poder, contra un control que nunca agarra
ninguno:

| escalón | | gana | vs. control |
|---|---|---|---|
| | control (nunca agarra poderes) | 4.6% | — |
| 1 | veneno | 15.8% | +11.1 |
| 1 | fuerza | 12.3% | +7.6 |
| 1 | caracol | 12.1% | +7.5 |
| 2 | huevo | 10.6% | +6.0 |
| 2 | maceta | 9.6% | +5.0 |
| 2 | pulpo | 7.4% | +2.8 |

**Ese orden no se puede leer, los escalones sí.** El ± de la columna "vs. control" es el
error de cada estimación *contra el control*, no el de la diferencia entre dos poderes: dos
pueden estar los dos clarísimo arriba del control y ser indistinguibles entre ellos. El banco
compara además cada poder **pareado contra el líder de su escalón** —no contra el de al lado,
porque una cadena de pasos chicos no medibles puede sumar entre las puntas una diferencia que
sí lo es— y abre uno nuevo cuando cae por debajo con el margen afuera. Salen dos escalones, y
eso es todo lo que estos datos sostienen. De ahí salen los pesos de
[`POWER_WORTH`](src/ai.js), que antes eran números de oficio.

*Contar cuántas veces la CPU elige cada poder no mide nada de esto*: sale ordenado igual que
`POWER_WORTH`, porque es un reflejo de esos pesos y no del juego.

**Ignorar los poderes gana el 4.6%**, así que "una carta con poder o dos sin poder" casi
nunca es una decisión: el poder es casi siempre correcto. **Es a propósito.** Con los dos
lados usándolos la partida queda pareja, y la decisión interesante no es *si* agarrás un
poder sino *cuál*: son seis efectos que quieren mazos distintos.

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
  paseo con el cuerpo— y se descartan; quedan las patas, la cola, las orejas y la cara.
- **los dibujos** — los ojos y la boca tienen versiones alternativas en el CDN (`eyes-shut`,
  `eyes-angry`, `eyes-happy`, `mouth-open`, `mouth-bite`, `mouth-smile`, y patas `-long` y
  `-stretch`). El clip dice en qué momento cambia cada una.

La matemática es la misma que usa la librería para armar la pila quieta —rotar y trasladar,
sin escala—, y el script **verifica que su pose de reposo caiga exactamente sobre
`axie-avatars.js`** antes de escribir nada: si el mixer cambia de cuentas, falla en vez de
producir Axies torcidos.

De los 46 clips entran diez, los que un combate de cartas puede llegar a mostrar. Salen
82 KB, casi todo compartido: las patas de las seis clases son las mismas.

[`src/axie-motion.js`](src/axie-motion.js) los reproduce con la Web Animations API. Tiene
dos niveles: una **base** que se repite mientras dure la situación —quieto, plantado para
atacar, festejando, desmayado— y **pulsos** que la tapan y se van solos —el ataque, el
golpe, un aburrimiento cada 5-11 segundos—.

El CSS no anima partes: se ocupa de la **puesta en escena** —dónde está parado el bicho,
adónde salta, adónde sale despedido, cómo se desploma— y del achatarse de los rebotes, que
es lo único que el horno no guarda. Las dos capas no se pisan porque tocan elementos
distintos: la escena va sobre `.axie` y `.axie-rig`, la actuación sobre `.axie-pose` y las
capas de adentro. Sin CDN, sin `animate()` o con `prefers-reduced-motion`, no se reproduce
nada y el juego es el mismo.

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
| `src/ui.js` | render y eventos |
| `scripts/axies.mjs` | corre el mixer offline y regenera `src/axie-avatars.js` |
| `scripts/poses.mjs` | hornea las animaciones del kit a `src/axie-poses.js` |
| `scripts/build.mjs` | empaqueta todo en un solo `.html` |
| `scripts/balance.mjs` | banco de pruebas: mide cuánto vale cada poder en partidas |
