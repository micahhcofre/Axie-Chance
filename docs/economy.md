# Economía y Taller: Moonshards, AXP, energía y evolución

El diseño de la economía del juego y del **Taller** (la pestaña `craft` de la portada). Acordado con el dueño el 2026-10-01.

**Estado (2026-10-01):** está hecha **la evolución** —el nivel y la AXP de cada Axie, los Moonshards guardados, la pantalla de evolucionar (que se abre desde la elección de Axies), la escena, el arte evolucionado y el mazo evolucionado en todas las partidas, también en red (`evolution.js`, `evolve-view.js`, `evolve-scene.js`; reglas en [rules.md](../rules.md#el-nivel-del-axie-y-la-evolución))— y **el crafteo del Taller** (§12: `crafting.js`, `workshop.js`; reglas en [rules.md](../rules.md#el-taller-crear-cartas)). También está **el botín** de la §3: al terminar cada partida se cobran Moonshards y AXP según el resultado y el modo, y la pantalla del final los muestra con el resumen de la pelea (`payout.js`, `result.js`; reglas en [rules.md](../rules.md#lo-que-se-gana-jugando)). También **la fusión** (§12, 2026-10-05): tres cartas sueltas iguales hacen una de la rareza siguiente, desde la mochila. Y **las misiones y el pase de temporada** (2026-10-05, [missions.md](missions.md)): pagan AXP, Moonshards y **llaves** del Taller; el núcleo está hecho y falta el panel sobre el mapa. **Falta la energía**.

---

## 1. Las ideas que mandan

- **Paga el resultado, no la cadena.** Lo que se cobra sale de ganar, perder o ganar por K.O. (`wonByKo` en `game.js`). El largo de las rachas, el daño y las marcas (`records`) no pagan nada.
- **Empujar al multijugador.** El multijugador es la fuente principal; la Aventura paga una sola vez por nivel; contra la CPU se practica gratis y no se cobra.
- **El Axie que jugás es el que crece.** La experiencia (AXP) es de cada Axie: jugar mucho con uno lo hace mejor a *ese*.
- **Siempre hay una chance.** Un Axie evolucionado entero sigue teniendo sus dos cartas desfavorables, que no comparten símbolo entre sí: puede cortarse igual (ver la fórmula de supresión de counters en [claude.md](../claude.md)).

---

## 2. Las tres cosas que se juntan

| Qué | De quién | Para qué |
|---|---|---|
| **Moonshards** | de la cuenta (una sola bolsa) | pagar las evoluciones y crear cartas en el Taller (§12) |
| **AXP** | de cada Axie | subirle el nivel (1 a 60), que abre sus evoluciones |
| **Energía** | de la cuenta | entrar a pelear al multijugador o a la Aventura |
| **Llaves** | de la cuenta (en la bolsa) | crear una carta en el Taller sin Moonshards. Dos: la común (lo mismo que crear con Moonshards) y la de oro (casi siempre rara, la mejor chance de mítica, legendaria asegurada cada 50). Salen del pase de temporada ([missions.md](missions.md)); la de oro, solo en el último escalón, o por 10 comunes o 100 Moonshards |

El ícono del Moonshard **no está en el kit de Origins** (se revisó su árbol entero en GitHub: lo más parecido es `tool-energycoin-02-00.png`). Va pintado en código como los íconos de la barra de pestañas y el mapa: mate, luz cálida arriba a la izquierda, sombra fría, borde oscuro solo en la silueta, sin aro ni marco. Un cristal en forma de medialuna. El de la energía, igual.

---

## 3. De dónde sale

### Moonshards y AXP

Las dos se ganan juntas y con la misma tabla. El AXP va al Axie con el que jugaste.

| Dónde | Ganás | Ganás por K.O. | Empate | Perdés |
|---|---|---|---|---|
| **Multijugador** | 10 | **20** | 0 (ninguno de los dos) | 0 |
| **Aventura**, primera victoria de cada nivel | 10 | **20** | — | — |
| Aventura, la estrella en un nivel ya ganado sin K.O. | +10 (lo que faltaba del K.O.) | | | |
| Aventura, un **jefe** (uno cada diez niveles: `BOSS_PAY`) | el doble: 20 | el doble: **40** | — | — |
| Aventura, volver a ganar un nivel | 0 | 0 | — | — |
| **Contra la CPU** | 0 | 0 | 0 | 0 |
| **Tutorial** | 0 | 0 | — | — |

- **Sin multiplicadores**: ni por dificultad ni por capítulo.
- **Subir de nivel paga**: cada vez que un Axie sube un nivel, **+5 Moonshards** (de 1 a 60 son 59 subidas: 295 por Axie).
- El K.O. es el de siempre: ganar con el rival en 0 sin que haya jugado su última chance. Contra la CPU normal, **~27% de las victorias son K.O.** y ~7% de las partidas terminan empatadas (medido, ver §7).
- La Aventura paga cuando el nivel entra por primera vez en `completedLevels` o en `starredLevels` (ver `adventure.js`). Así no paga dos veces, igual que el perfil (`profile.js`) no da experiencia dos veces.

### Energía

- **10 de energía, que se llena una vez por día.** Sin reloj de recarga: es más simple de explicar y es una razón para volver mañana.
- **Cada batalla de multijugador o de Aventura cuesta 1, ganes o pierdas.** Los dos jugadores de una sala pagan; el espectador no.
- La CPU y el tutorial no gastan energía.

---

## 4. El nivel del Axie

- Cada Axie arranca en **nivel 1** y llega hasta el **60**. Hoy `levelOf` (en `backpack.js`) devuelve siempre 1: es el que va a leer el AXP guardado.
- Pasar del nivel `L` al `L+1` pide **`30 + 5·(L−1)` AXP**: 30 el primero, 320 el último.
- El nivel del jugador (`profile.js`, el de arriba del mapa) **es otra cosa** y no se toca: sale del progreso de la Aventura.

---

## 5. La evolución

Cada **10 niveles** del Axie (10, 20, 30, 40, 50 y 60) se abre una evolución, que se paga en Moonshards:

| Evolución | Nivel | Precio |
|---|---|---|
| 1ª | 10 | 300 |
| 2ª | 20 | 600 |
| 3ª | 30 | 900 |
| 4ª | 40 | 1.200 |
| 5ª | 50 | 1.500 |
| 6ª | 60 | 2.000 |

### Qué evoluciona

- **El jugador elige la carta.** Cada una de las 6 cartas favorables se evoluciona una sola vez; en el 60 están las seis. Las 2 desfavorables no evolucionan nunca.
- Lo que evoluciona es **la parte del cuerpo de esa carta** (`associatedPart`), y la carta suma **el símbolo de la clase de esa parte**. No el de la clase del Axie: el de la parte. Es la Part Evolution que ya hace el motor (`isEvolved` en `baseDeck`, `data.js`).
- Una parte Mech, Dawn o Dusk suma la clase del propio Axie, como ya hace `partClass` (`axies.js`) con las partes de evento. **Por ahora**: se puede revisar.

### Las partes de cada Axie

**Los seis del mixer** (Colmillo, Marea, Racha, Brote, Aguijón, Escama) son puros: todas sus partes son de su clase, así que cada evolución le suma **su propio símbolo** a la carta (la racha de su color avanza de a dos).

**Los seis starters de Origins** no usan partes NFT: sus partes reales están en el catálogo del kit (`Assets/OriginsKit/Catalogs/pve-starters.json`). Hoy el juego arma su mazo solo con la clase; para evolucionar necesita conocer de qué clase es cada parte:

| Starter | Clase | Ojos | Orejas | Boca | Cuerno | Espalda | Cola |
|---|---|---|---|---|---|---|---|
| Buba | Bestia | Bestia | Bestia | Bestia | **Planta** | **Planta** | Bestia |
| Olek | Planta | Planta | **Reptil** | Planta | Mech → Planta | Planta | Planta |
| Puffy | Pez | Pez | Pez | **Bestia** | Pez | **Reptil** | Pez |
| Venoki | Reptil | Reptil | Reptil | Reptil | Reptil | **Planta** | **Bicho** |
| Momo | Pájaro | Pájaro | **Bicho** | Pájaro | Pájaro | Pájaro | Pájaro |
| Pomodoro | Bicho | **Pájaro** | Bicho | **Bestia** | Mech → Bicho | Mech → Bicho | Bicho |

Ejemplo: el cuerno de Buba (salto +4) es `Bestia + Reptil`; evolucionado, `Bestia + Reptil + Planta`. Su cola (`Bestia`) evolucionada queda `Bestia + Bestia`.

### Cómo se ve

- **Cada evolución tiene su animación**: el clip `activity/evolve`, que traen tanto los esqueletos de los starters del kit como las animaciones del mixer. Suena y se ve **siempre**, aunque el dibujo no cambie. Se hornea con las demás poses: una entrada `evolve: { from: 'activity/evolve' }` en `scripts/poses.mjs`.
- **Los del mixer cambian el dibujo de la parte**: cada una de sus 36 partes tiene su arte `-lv2` en el mixer (verificado), el mismo camino que usan los rivales evolucionados (`scripts/mixed.mjs`).
- **Los starters cambian el dibujo una vez.** El kit trae dos etapas de cada uno: `PvE/Starters/N/` y `N-1/`, "body stage 1 (awakened)". La despierta cambia **una sola parte**, la firma de cada uno; todo lo demás es idéntico píxel a píxel (verificado). Cuando esa parte evoluciona, el starter pasa al cuerpo despierto:

| Starter | Kit | Parte que cambia al despertar |
|---|---|---|
| Buba | 1 → 1-1 | cuerno |
| Olek | 2 → 2-1 | cuerno |
| Puffy | 3 → 3-1 | orejas |
| Venoki | 7 → 7-1 | cuerno |
| Momo | 12 → 12-1 | espalda |
| Pomodoro | 17 → 17-1 | cuerno |

  Las otras cinco partes de cada starter no tienen arte evolucionado ni en el kit ni en el mixer: evolucionan con la animación y en la carta.

- **La cantidad de dibujos.** Como se elige la carta, un Axie del mixer puede tener cualquier combinación de partes evolucionadas: 64. No se hornea cada una: se hornea **una pila con las dos versiones de cada parte** en un marco que envuelve a las dos (`EVOLVED` en `axie-avatars.js`, ver `scripts/evolved.mjs`), y `axieArt` enciende la que toca. Sus poses (`<id>@evo` en `axie-poses.js`) guardan solo lo que cambia —el cuerpo medido en ese marco y las pistas de las partes `@2`— y `axie-motion.js` hereda el resto. Con alguna parte evolucionada el Axie se dibuja entre 1 y 15% más chico en su caja (las partes evolucionadas sobresalen, sobre todo arriba), parado en la misma línea de piso. Costo: `axie-poses.js` pasó de 955 a 1.108 KB.

---

## 6. Ritmo

Supuestos: 10 batallas por día, la mitad ganadas, ~27% de las victorias por K.O. Eso da **~63 Moonshards y ~63 AXP por día** (12,7 por victoria), jugando siempre con el mismo Axie.

| Nivel | Días con un Axie | Evolución que abre |
|---|---|---|
| 10 | 7 | 1ª (300) |
| 20 | 22 | 2ª (600) |
| 30 | 46 | 3ª (900) |
| 40 | 77 | 4ª (1.200) |
| 50 | 116 | 5ª (1.500) |
| 60 | 163 (~5 meses y medio) | 6ª (2.000) |

Hasta el 60 se juntan ~10.600 Moonshards (incluidos los 295 de subir de nivel) y las seis evoluciones cuestan 6.500: quedan ~4.100 para el Taller, unas 410 cartas creadas (ver §12). El que ahorra puede pagar cada evolución más o menos cuando llega a su nivel; el que gasta en otra cosa, espera. Los Moonshards son de la cuenta y el AXP es de cada Axie: subir un segundo Axie reparte la misma plata entre dos.

---

## 7. Balance medido

Partidas sembradas (300 por fila, las mismas semillas en todas): un jugador simulado que juega como la CPU normal (el mismo criterio que `npm run balance -- --difficulties`) contra la CPU normal, rotando los seis starters y con los poderes sorteados. Las evoluciones, en el orden ojos, orejas, boca, cuerno, espalda, cola.

| | Evoluciones | Gana | K.O. | vs sin evolucionar |
|---|---|---|---|---|
| Sin evolucionar | 0 | 40,5% | 7,0% | — |
| **Puro** (cada evolución suma el propio símbolo: los seis del mixer) | 3 | 59,3% | 20,7% | +18,8 ±5,5 |
| | 6 | **72,7%** | 31,7% | +32,2 ±5,6 |
| **Starters** (la clase real de cada parte) | 3 | 50,3% | 17,3% | +9,8 ±6,3 |
| | 6 | **51,2%** | 18,7% | +10,7 ±6,6 |

- **Los puros quedan más fuertes que los starters. Aceptado** por el dueño: es la diferencia entre un Axie puro y uno híbrido.
- **El rico se hace más rico**: el K.O. paga el doble y un Axie evolucionado hace más K.O. Uno puro en el 60 cobra ~2,2 veces más por partida que uno nuevo (10,4 contra 4,8 Moonshards contra la CPU normal).
- En los starters, las evoluciones 4 a 6 casi no movieron nada en esta prueba: el cuerno, la espalda y la cola son las que más partes de otra clase tienen, y un símbolo nuevo en la carta conecta más pero no adelanta tu racha principal.
- Al implementar, sumarle a `scripts/balance.mjs` una opción para medir Axies evolucionados (hoy `newMatch` no recibe evoluciones del jugador) y volver a medir con los precios y el orden reales.

---

## 8. Multijugador y confianza

- **En la sala se ven los niveles de los dos Axies antes de darle a Listo.** Un Axie puro en el 60 contra uno nuevo anda cerca de 73 a 27 (medido contra la CPU normal, ver §7; un starter en el 60, cerca de 51 a 49): hay chance, pero se tiene que saber antes de entrar. El emparejamiento por nivel queda para cuando haya emparejamiento.
- Las evoluciones viajan en el loadout como las cartas de la mochila: `cleanLoadout` (`loadout.js`) las limpia y el anfitrión las revalida al armar el mazo.
- **Todo es local**: monedero, energía y AXP viven en `localStorage`, no se pueden intercambiar y no valen nada fuera del juego. La partida en red corre en el navegador del anfitrión, así que un cliente modificado puede darse lo que quiera: solo se engaña a sí mismo. La energía topea lo que rinde jugar contra uno mismo en dos pestañas.
- **Nada con valor real** (tabla de posiciones, AXP en cadena) hasta que la partida corra en el servidor: ver la Fase 1 de [ROADMAP.md](../ROADMAP.md).

---

## 9. Lo que ya existe en el código

| Pieza | Dónde | Qué falta |
|---|---|---|
| El botín en la pantalla final, con su entrada y su sonido | `payoutOf` y `claimPayout` en `payout.js`, `payFor` en `ui.js`, `payHtml` y `climb` en `result.js` | — (hecho: Moonshards y AXP; los objetos sueltos siguen en `state.rewards[asiento]`, sin uso) |
| El K.O. | `wonByKo` en `game.js` | — |
| La evolución de una carta | `isEvolved` en `baseDeck` (`data.js`) y `deckFor` (`axies.js`) | — (hecho: `kitParts` de los starters y el id `'buba~horn'`) |
| La clase de una parte rara | `partClass` (`axies.js`) | — |
| El nivel del Axie, ya dibujado (LVL) | `levelInfo` en `evolution.js` | — (hecho) |
| La evolución de las cartas | `#lobby-evolve` en `index.html`, `evolve-view.js` (se abre desde la vista previa del Axie) | — (hecho) |
| La pestaña del Taller: crear cartas | `#lobby-craft` en `index.html`, `crafting.js`, `workshop.js` | — (hecho) |
| La fusión | `mergeGroups`, `mergeResult`, `mergeCards` en `crafting.js`; `paintMerge` en `lobby.js` (dentro de la mochila) | — (hecho; faltan las mejoras) |
| Las mejoras (+) | `boosts`, `boostOptions`, `buildPersonalDeck` (`data.js`) | **las reemplaza la evolución**: retirarlas cuando entre |

Guardado: `axie-chance:wallet` (`moonshards`; falta `energy` y el día de la última recarga) y `axie-chance:axies` (por Axie: `axp` y las partes evolucionadas), los dos en `evolution.js`. Lo que calcula cuánto paga un resultado va en un módulo puro, como `profile.js`: sin DOM ni almacenamiento, probado en Node. Si es un módulo nuevo de `src/` que carga `main.js`, va en `MODULES` de `scripts/build.mjs` y con su `modulepreload` en `index.html`; todo texto nuevo, por `tr()` con su entrada en `EN_STRINGS`.

---

## 10. Orden de trabajo sugerido

1. ~~**El nivel del Axie**: la curva, los +5 al subir y el LVL de verdad en la ficha.~~ Hecho.
2. ~~**El Taller, evolución**: elegir la carta, pagar, la animación `evolve`, y la carta evolucionada en el mazo de la partida (y por el cable).~~ Hecho.
3. ~~**El arte**: el cuerpo despierto de los starters (`scripts/starters.mjs` corta la carpeta `N-1`) y las partes `-lv2` de los del mixer.~~ Hecho.
4. ~~**El botín**: el pago de AXP y Moonshards al final de cada partida, con la subida de nivel.~~ Hecho (`payout.js`; la pantalla del final cuenta el resumen y el botín).
5. **La energía**: guardada, gastada al entrar a una sala o a un nivel.
6. ~~**El Taller, crear cartas**: el sorteo con sus chances y la carta asegurada cada 50 (§12).~~ Hecho.
7. **El Taller, mejoras y fusión**: qué hacer con las comunes que sobran (§12). La fusión, hecha; faltan las mejoras.
8. Lo que quede abierto (abajo).

---

## 11. Abierto

- **Amuletos** como otra cosa que comprar con Moonshards. Los amuletos con vencimiento son los de la visión del producto (un poder puesto en una carta de tus partes por unas partidas, como los `charms` de los jefes). Precio de borrador, sin acordar: amuleto 30 (3 partidas). Las cartas de la mochila ya no se compran sueltas: se crean en el Taller (§12).
- **El precio de crear una carta** (10 Moonshards) es un borrador: ver §12.
- **Con 0 de energía**: ¿no se entra, o se juega sin cobrar? Pesa en las salas entre amigos.
- **El abandono**: se implementó la propuesta, sin confirmar con el dueño: el que se queda cobra la victoria (nunca como K.O.) solo si la partida llegó a la ronda 4 (`FORFEIT_PAY_ROUND`), para que abrir una sala y abandonarla no pague.
- **Lo ya ganado antes de la economía**: hoy no paga. Los niveles que ya estaban en `completedLevels` cuentan como ganados, y solo pagan la estrella que les falte.
- **Mech, Dawn y Dusk**: hoy suman la clase del Axie; revisar si conviene otra regla.
- **Emparejamiento por nivel**, cuando exista emparejamiento.

---

## 12. El Taller: crear cartas

Acordado con el dueño el 2026-10-01. La pestaña del yunque deja de ser la evolución (que pasó a la elección de Axies, donde se mira al Axie que se evoluciona) y pasa a ser **la forja**: cartas sueltas para la mochila, sacadas a la suerte. Más adelante, ahí mismo, **mejoras y fusión**.

### Las chances

Primero se sortea la rareza, después lo de adentro.

| Rareza | La carta | Chance | En diez mil (`CRAFT_TIERS`) |
|---|---|---|---|
| Común | 1 símbolo | 80 % | 8.000 |
| Poco común | 2 símbolos | 15 % | 1.500 |
| Rara | 3 símbolos | 4 % | 400 |
| Épica | 1 símbolo + un poder de clase | 0,85 % | 85 |
| Legendaria | 2 símbolos + un poder de clase | 0,14 % | 14 |
| Mítica | 3 símbolos + un poder de clase | 0,01 % | 1 |

Las chances son las del dueño del 2026-10-05 (antes, 70 / 20 / 8 / 1,5 / 0,45 / 0,05).

- **Los símbolos no son fijos**: cada uno es cualquiera de las seis clases, por separado, así que se repiten (dos Planta en la misma carta). El motor ya lo sabe jugar: una carta cuenta cada vez que trae el símbolo (`timesIn` en `rules.js`), igual que la cola evolucionada.
- **El poder** es cualquiera de los 30 de clase (`CLASS_POWER_IDS`), sin mirar los símbolos de la carta. El Rocket Stamp no sale (no es de clase).
- **La carta con poder asegurada**: la creada número 50, 100, 150… trae poder sí o sí. Si el sorteo ya le dio una con poder, queda esa (puede ser una mítica); si no, es una épica (un símbolo y un poder). La cuenta es fija (`axie-chance:craft`, `crafted`): no se reinicia cuando sale un poder por suerte, así la barra de "te faltan N" del Taller nunca miente.
- Las chances están **siempre a la vista** en el Taller, con las de la llave de oro al lado.
- **Las llaves** (2026-10-05): la común es lo mismo que crear; la de oro (poco común 15 %, rara 70 %, épica 14 %, legendaria 0,75 %, mítica 0,25 %) vale diez cartas —10 comunes o 100 Moonshards— y tiene una legendaria asegurada cada 50. Por qué esos números: [missions.md, Las llaves](missions.md#las-llaves).

### Precio y ritmo

- **10 Moonshards por carta** (`CRAFT_COST`, borrador para acordar), de a una o de a diez (100, sin descuento).
- Cada 50 cartas (500 Moonshards, ~8 días al ritmo de la §6) salen en promedio 40 comunes, 7,5 poco comunes, 2 raras y **~1,5 con poder** (el 1 % de las 49 por suerte más la asegurada): una carta con poder cada ~340 Moonshards. La asegurada es dos tercios de los poderes.
- Con lo que sobra hasta el nivel 60 (~4.100, §6) son ~410 cartas y ~12 con poder.

### Lo que sale

- Va **suelto a la mochila** (`addToBackpack`), y de ahí a un Axie desde su inventario como cualquier otra: hasta 4 por Axie (`EXTRA_SLOTS`). La carta no guarda su rareza: sale de lo que trae (`tierOf`).
- La mochila no tiene tope: las comunes se van a juntar. Lo resuelve **la fusión** (abajo): tres iguales en una de más símbolos.

### Reciclar (2026-10-04)

Pedido del dueño: una carta suelta de la mochila se puede romper por el **10 % de lo que vale su rareza** (`SCRAP_RATE`). Lo que vale cada rareza (`CARD_VALUE`) es un borrador: la común vale lo que cuesta crearla (10) y de ahí sube, pero muy por debajo de lo que cuesta sacarla del sorteo (una mítica sale cada ~10.000 cartas, 100.000 Moonshards).

| Rareza | Vale | Devuelve |
|---|---|---|
| Común | 10 | 1 |
| Poco común | 30 | 3 |
| Rara | 80 | 8 |
| Épica | 250 | 25 |
| Legendaria | 800 | 80 |
| Mítica | 3.000 | 300 |

Una tanda de crear-y-reciclar devuelve en promedio **~1,9 por cada 10** gastados (0,8·1 + 0,15·3 + 0,04·8 + 0,0085·25 + 0,0014·80 + 0,0001·300): reciclar abarata el Taller un ~19 % para el que recicla todo, pero nunca da ganancia. Solo las sueltas (la puesta en un Axie es parte de su mazo), con confirmación, y de a una, todas las sueltas de una rareza o, con el **reciclado rápido**, todo lo que no tiene puesto ningún Axie.

### Fusionar (2026-10-05)

Pedido del dueño: en la mochila, **tres cartas iguales** (los mismos símbolos, contando los repetidos, y el mismo poder) se fusionan en **una de la rareza siguiente**. Se implementó **gratis**: el pedido no habla de precio y lo que cuesta es juntar las tres.

| Se juntan tres | Sale | Qué tiene |
|---|---|---|
| Comunes | Poco común | su símbolo + uno al azar |
| Poco comunes | Rara | sus dos símbolos + uno al azar |
| Raras | Épica | uno de sus tres símbolos, al azar, + un poder de esa clase, al azar |
| Épicas | Legendaria | su símbolo y su poder + un símbolo al azar |
| Legendarias | Mítica | sus dos símbolos y su poder + un símbolo al azar |

- El símbolo al azar es cualquiera de las seis clases y puede repetir uno que ya tiene (igual que en el Taller). De rara a épica, uno repetido tiene más chances de quedar, y el poder es uno de los cinco de esa clase: a diferencia del Taller, **la épica de una fusión trae un poder de la clase de su símbolo**.
- Solo las sueltas (la puesta en un Axie es de su mazo). La mítica no se fusiona, ni el Rocket Stamp del paquete (su poder no es de clase).
- **Lo que frena la fusión es que sean iguales**, no el precio. Hay 6 comunes distintas, 21 poco comunes (15 pares y 6 dobles), 56 raras y 180 épicas del Taller (6 símbolos × 30 poderes): juntar tres comunes iguales es rápido (cada 50 cartas creadas salen ~35 comunes, unas 6 de cada símbolo), tres poco comunes iguales ya cuesta, y de ahí para arriba es casi siempre de a una fusión por vez. Fusionar y después reciclar casi no cambia lo que se recupera: tres comunes devuelven 3, igual que la poco común; tres raras, 24, y la épica, 25; tres legendarias, 240, y la mítica, 300 (la diferencia es chica al lado de lo que cuesta juntarlas).
- En pantalla (rehecho el 2026-10-05, pedido del dueño: "no es gráfico"): la mochila es una **colección** —una pila por carta distinta, con la gema de su rareza, cuántas hay y tres casilleros que se llenan hacia la fusión, verdes con una flecha cuando están las tres— y la fusión es un **momento en grande** (`card-scene.js`): el altar con las tres copias alrededor de la que sale, la carga, el estallido y una tragamonedas que muestra qué se sorteó. Crear en el Taller tiene el suyo (rehecho el 2026-10-06: "aburrido"): un cofre que se sacude más cuanto mejor es lo de adentro, se abre con luz y chispas y suelta las cartas de espaldas, las raras que avisan antes de darse vuelta.

### Abierto

- **Las mejoras**: qué se le hace a una carta además de fusionarla, y si cuesta Moonshards.
- **¿La fusión cuesta?** Hoy es gratis (ver arriba). Si las comunes se fusionan demasiado rápido, un precio chico por escalón (por ejemplo, lo que vale la carta que sale × 10 %) la frena sin cambiar la regla.
- **Lo que vale cada rareza** al reciclar (`CARD_VALUE`): borrador, ver arriba.
- **El precio** de crear: 10 es un borrador. Medir cuánto cambia el balance una carta con poder en la mochila antes de abaratarlo.
- **¿Una carta con poder de clase ajena al Axie vale igual?** Hoy sí: el poder funciona en cualquier mazo, como en el centro.

