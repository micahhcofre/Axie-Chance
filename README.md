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

**El centro.** Hay siempre **5 cartas boca arriba**, sacadas de una reserva de 35
([`buildPool`](src/data.js)): las 15 combinaciones de 2 símbolos y las 20 de 3, una por
combinación. Al llevarse una, se repone en el acto desde la reserva. Apenas termina su
turno —antes de que juegue el otro— cada jugador se lleva cartas del centro según cómo le
fue, y sus cartas jugadas vuelven a su mazo primero:

| resultado del turno | se lleva |
|---|---|
| soltaste el ataque | 1 carta de 3 símbolos **o** 2 cartas de 2 símbolos |
| se te desarmó | 1 carta de 2 símbolos |

Si ninguna de las 5 es del tamaño que corresponde, sirve cualquiera. Y si entre las que
podés llevarte **ninguna tiene tu símbolo**, el centro no ofrece nada que enlace con tu
mazo: se **renueva entero** —las 5 al fondo de la reserva, 5 nuevas a la vista— una sola
vez por reparto y por jugador. Las cartas nuevas
entran al mazo y ya pueden salir en el intercambio siguiente. Si la reserva se agota antes
de que alguien caiga, se sigue jugando con el mazo armado.

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

Elegir bien del centro pesa: la heurística de la CPU le gana el 86% a elegir al azar. Pero
la elección **trío vs. pares está desbalanceada** — llevarse el trío gana el 82% contra
llevarse los dos pares, y subir la oferta a 3 o 4 pares no lo arregla (74-79%), porque cada
carta extra diluye el mazo en vez de mejorarlo.

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
Compara trío contra pares **por carta, no por total**: comparar totales la hacía tomar dos
pares demasiado seguido y le costaba un 68-32 contra llevarse siempre el trío.

## Estructura

| archivo | |
|---|---|
| `src/data.js` | símbolos, crests, mazo personal y reserva común |
| `src/axies.js` | el roster: seis Axies, sus partes, su mazo y su dibujo |
| `src/axie-avatars.js` | generado — capas de cada Axie y catálogo de partes |
| `src/rules.js` | cadenas, cortes, puntaje y probabilidades — funciones puras |
| `src/ai.js` | decisión de la CPU |
| `src/game.js` | máquina de estados: turnos, daño, centro y reparto, sin DOM |
| `src/ui.js` | render y eventos |
| `scripts/axies.mjs` | corre el mixer offline y regenera `src/axie-avatars.js` |
| `scripts/build.mjs` | empaqueta todo en un solo `.html` |
