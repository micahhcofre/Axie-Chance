# Misiones y pase de temporada

Tareas del día y de la semana que pagan AXP o Moonshards y llenan un **pase de temporada** que paga llaves del Taller y Moonshards. Acordado con el dueño el 2026-10-05; los números son borrador, a medir (ver §7).

**Estado (2026-10-05):** está hecho **el núcleo** —las misiones, el sorteo, lo que cuenta cada partida, el cobro, el pase y las llaves en la bolsa y en el Taller (`missions.js`, `state.stats` en `game.js`, `KEY_ODDS` en `crafting.js`; pruebas en `test/missions.test.js`)—, **el panel sobre el mapa** con la hoja y el pase entero (`missions-view.js`) y **las llaves en el Taller** (`workshop.js`). Falta la línea de misiones en la pantalla del final (ver §6).

---

## 1. Las ideas que mandan

- **Una sola máquina**: las misiones son el motor; cada una paga lo suyo y además puntos del pase. El pase no cuenta nada por su cuenta y las llaves no son un sistema aparte: son tiradas del Taller.
- **Las de la semana son para moler**: metas largas, y cambian todas las semanas (la de clase rota por las seis).
- **Cuenta todo menos el tutorial y la zona de testeo**, también contra la CPU: lo que se puede sacar ya lo topean las misiones mismas. Algunas son solo de multijugador y pagan como las demás.
- **Excepción a "paga el resultado"** ([economy.md §1](economy.md#1-las-ideas-que-mandan)): hay misiones de cadena y de golpe. Pagan por la misión, no por partida.
- **Todo es local**, como la bolsa: la hora es la de la máquina, y el que la adelanta solo se engaña a sí mismo.

---

## 2. Cómo se arma

| | Cuántas | Se renuevan | Puntos | Cada una paga |
|---|---|---|---|---|
| **Del día, fácil** | 1 | a la medianoche local | 10 | 5 Moonshards **o** 10 AXP |
| **Del día, media** | 1 | ídem | 15 | 10 Moonshards **o** 15 AXP |
| **Del día, difícil** | 1 | ídem | 25 | 15 Moonshards **o** 25 AXP |
| **De la semana** | 4 | el lunes | 60 | 30 Moonshards **o** 50 AXP |
| **Desafío de la semana** | 1 | el lunes | 100 | 50 Moonshards **o** 80 AXP |

- Del día: **50 puntos**, un escalón del pase. De la semana: **340**, casi siete.
- Una partida mueve todas las que le tocan a la vez: 3 a 5 batallas cumplen las tres del día.
- **Cambiar una**: una del día por día, por otra del mismo pozo (lo avanzado se pierde; una cumplida no se cambia).
- **El sorteo** (`dailyPicks`, `weeklyPicks`): cada pozo se baraja con el azar del día o de la semana y queda la primera que se pueda hacer, que no esté ya y que no haya salido la vez anterior. Nunca dos de multijugador el mismo día o semana. Lo que todavía no se puede hacer no sale (`missionContext`): las de multijugador sin salas, la del jefe sin un jefe abierto, las del Taller sin con qué crear, fusionar o reciclar sin cartas sueltas.
- **La semana**: dos de pelea, una de **la clase de la semana**, una de colección y un desafío. La clase rota en el orden canónico desde la primera semana: Planta, Bestia, Pez, Pájaro, Bicho, Reptil.
- **La AXP** va al Axie que tenés elegido **cuando la cobrás**.
- **Los puntos del pase entran solos** al cumplirla; lo de la misión se cobra a mano (es el momento de la portada). Lo cumplido sin cobrar se **paga solo** cuando se renueva.
- Un abandono antes de la ronda 4 no cuenta, igual que no paga (`FORFEIT_PAY_ROUND`).

---

## 3. Las misiones

**Del día, fáciles (10 puntos)**

| Misión | Paga | `id` |
|---|---|---|
| Jugá 2 batallas | AXP | `d-play` |
| Ganá una batalla | Moonshards | `d-win` |
| Atacá con una cadena de 3 o más | AXP | `d-chain3` |
| Hacé 60 de daño | Moonshards | `d-damage` |
| Llevate 3 cartas del centro | Moonshards | `d-picks` |
| Robá 2 cartas con poder | AXP | `d-powers` |
| Creá una carta en el Taller | AXP | `d-craft` |

**Del día, medias (15)**

| Misión | Paga | `id` |
|---|---|---|
| Ganá 2 batallas | Moonshards | `d-win2` |
| Atacá con una cadena de 5 o más | AXP | `d-chain5` |
| Pegá un golpe de 30 o más | Moonshards | `d-hit30` |
| Hacé 200 de daño | AXP | `d-damage200` |
| Ganá un nivel de la Aventura (vale repetirlo) | AXP | `d-adventure` |
| Curate 30 de vida | AXP | `d-heal` |
| Apilá 2 Rocket Stamps | Moonshards | `d-stack` |
| Jugá una batalla multijugador | Moonshards | `d-net` |

**Del día, difíciles (25)**

| Misión | Paga | `id` |
|---|---|---|
| Ganá 3 batallas | Moonshards | `d-win3` |
| Ganá por K.O. | Moonshards | `d-ko` |
| Atacá con una cadena de 7 o más | AXP | `d-chain7` |
| Pegá un golpe de 50 o más | AXP | `d-hit50` |
| Ganá con 100 de vida o más | AXP | `d-healthy` |
| Ganá sin cortarte | Moonshards | `d-clean` |
| Ganá una batalla multijugador | Moonshards | `d-netwin` |

**De la semana, pelea (60; salen dos)**

| Misión | Paga | `id` |
|---|---|---|
| Jugá 15 batallas | AXP | `w-play` |
| Ganá 8 batallas | Moonshards | `w-win` |
| Ganá 3 batallas por K.O. | Moonshards | `w-ko` |
| Hacé 1.500 de daño | AXP | `w-damage` |
| Curate 150 de vida | AXP | `w-heal` |
| Atacá 10 veces con una cadena de 5 o más | AXP | `w-chains` |
| Llevate 25 cartas del centro | Moonshards | `w-picks` |
| Robá 15 cartas con poder | AXP | `w-powers` |
| Apilá 8 Rocket Stamps | Moonshards | `w-stack` |
| Jugá 5 batallas multijugador | Moonshards | `w-net` |

**La clase de la semana (60; sale una de las tres de esa clase)**

| Clase | Ganá 5 con un Axie de la clase (AXP) | Robá 10 cartas con su poder (Moonshards) | Lo suyo (Moonshards) |
|---|---|---|---|
| Planta | `k-win-plant` | `k-draw-plant` | Curate 100 de vida |
| Bestia | `k-win-beast` | `k-draw-beast` | Hacé 40 de daño con sangrado |
| Pez | `k-win-aquatic` | `k-draw-aquatic` | Llevate 30 cartas del centro |
| Pájaro | `k-win-bird` | `k-draw-bird` | Hacé 40 de daño directo con plumas y shuriken |
| Bicho | `k-win-bug` | `k-draw-bug` | Robale al rival 30 de vida o escudo |
| Reptil | `k-win-reptile` | `k-draw-reptile` | Hacé 40 de daño con veneno o espinas |

"Lo suyo" (`k-sig-*`) cuenta cualquiera de los cinco poderes de la clase que haga eso.

**De la semana, colección (60)**

| Misión | Paga | `id` |
|---|---|---|
| Creá 10 cartas en el Taller | AXP | `w-craft` |
| Fusioná 2 cartas | Moonshards | `w-fuse` |
| Reciclá 5 cartas | AXP | `w-scrap` |
| Ganá 3 niveles distintos de la Aventura | AXP | `w-levels` |
| Ganá 2 niveles de la Aventura por K.O. | Moonshards | `w-advko` |
| Subí de nivel a un Axie | Moonshards | `w-levelup` |
| Ganá con 3 Axies distintos | AXP | `w-axies` |
| Ganá 3 batallas con cartas de la mochila puestas | Moonshards | `w-extras` |

**Desafío de la semana (100)**

| Misión | Paga | `id` |
|---|---|---|
| Ganá 3 batallas seguidas (perder o empatar la corta) | Moonshards | `c-streak` |
| Pegá un golpe de 70 o más | AXP | `c-hit70` |
| Atacá con una cadena de 9 o más | AXP | `c-chain9` |
| Ganá con 20 de vida o menos | Moonshards | `c-close` |
| Vencé a un jefe de la Aventura | AXP | `c-boss` |
| Hacé un K.O. con ¿UNA MÁS? | Moonshards | `c-onemore` |
| Ganá 3 batallas sin cortarte | AXP | `c-clean` |
| Ganá 2 batallas multijugador por K.O. | Moonshards | `c-netko` |

"Ganar después de tu última chance" no está a propósito: por las reglas, eso solo puede terminar en empate.

---

## 4. El pase de temporada

- **Temporada de 28 días**, que arranca un lunes (la primera, el 5 de octubre de 2026): cuatro tandas de las de la semana justas.
- **40 escalones de 50 puntos** (2.000). Con todo lo que da una temporada (2.760) se llega con el 72 %: haciendo todo, cerca del día 21; el que hace las del día 5 días por semana y tres de la semana, al escalón ~34.
- **Pasado el 40**, una llave cada 100 puntos (unas 7 más, como mucho).
- **Al cerrar la temporada** se paga solo lo alcanzado sin cobrar. Las llaves no vencen.
- Solo gratis: no hay pase pago (nada tiene valor real mientras todo sea local, [economy.md §8](economy.md#8-multijugador-y-confianza)).

### Las llaves

Son tiradas del Taller sin Moonshards (`KEY_ODDS` en `crafting.js`). Hay **dos** (2026-10-05, pedido del dueño; antes había también una de poder, y las que quedaron guardadas pasan a ser de oro en `cleanWallet`).

| | Común | Poco común | Rara | Épica | Legendaria | Mítica | De dónde |
|---|---|---|---|---|---|---|---|
| **Llave común** = crear con Moonshards | 80 % | 15 % | 4 % | 0,85 % | 0,14 % | 0,01 % | el pase |
| **Llave de oro** | — | 15 % | 70 % | 14 % | 0,75 % | 0,25 % | el escalón 40 (una sola), **10 comunes** (`KEY_TRADE`) o **100 Moonshards** (`KEY_COST`) |

Las dos filas son del dueño (2026-10-05).

- **La común es lo mismo que crear con Moonshards**: las mismas chances y cuenta para la carta con poder asegurada cada 50.
- **La de oro vale diez cartas** (diez comunes o 100 Moonshards). Medido con el sorteo de verdad (un millón de cada una, con las dos aseguradas):

  | En promedio | Poco común | Rara | Épica | Legendaria | Mítica | Con poder |
  |---|---|---|---|---|---|---|
  | 10 cartas | 1,47 (+ 7,84 comunes) | 0,39 | **0,28** | 0,014 | 0,001 | **0,30** |
  | 1 llave de oro | 0,15 | **0,69** | 0,14 | **0,027** | **0,0024** | 0,17 |

  Gana en raras (×1,75), en míticas (×2,4) y en legendarias (×2), pero las legendarias solo por su asegurada: por suerte da 0,0075 contra 0,014. **Pierde en épicas a la mitad**, porque las diez cartas adelantan diez pasos la asegurada de poder (0,2 de las 0,28) y la de oro ninguno. Arreglos posibles, sin aplicar: que cada carta de oro cuente diez para la asegurada de poder (quedaría en ~0,31 épicas), o subirle la épica a ~28 % (bajando la rara).
- **Su asegurada** (`GOLD_PITY`, `craft.gold`): cada 50 cartas creadas con llave de oro, una **legendaria** (si el sorteo ya dio una, queda esa).
- En el Taller: crear ×1 y ×10 pagan con llaves comunes si alcanzan para toda la tanda (si no, con Moonshards). Debajo, el botón dorado **Llave de oro** usa una llave de oro o, sin ninguna, cambia diez comunes o, si no hay, cobra 100 Moonshards; debajo, la barra de su legendaria asegurada. Tus llaves se ven arriba, al lado de los Moonshards, y las chances tienen dos columnas: Moonshards o llave común, y llave de oro.

### Los escalones (`tierReward`)

| | 1–10 | 11–20 | 21–30 | 31–40 |
|---|---|---|---|---|
| **x1** | 2 llaves | 1 llave | 1 llave | 1 llave |
| **x2** | 10 Moonshards | 15 | 20 | 25 |
| **x3** | 1 llave | 1 llave | 1 llave | 1 llave |
| **x4** | 10 Moonshards | 15 | 20 | 25 |
| **x5** | 3 llaves | 3 llaves | 3 llaves | 3 llaves |
| **x6** | 10 Moonshards | 15 | 20 | 25 |
| **x7** | 1 llave | 1 llave | 1 llave | 1 llave |
| **x8** | 10 Moonshards | 15 | 20 | 25 |
| **x9** | 1 llave | 1 llave | 1 llave | 1 llave |
| **x10** | 5 llaves + 40 | 5 llaves + 40 | 5 llaves + 40 | **llave de oro + 100** |

En total: **500 Moonshards, 44 llaves y 1 de oro**. La de oro sale solo en el último escalón.

---

## 5. Lo que vale una temporada

Haciendo todo, con la AXP y los Moonshards repartidos más o menos parejo:

| De dónde | Moonshards | AXP | Llaves |
|---|---|---|---|
| Las del día (28 días) | ~420 | ~700 | — |
| Las de la semana (4) | ~340 | ~560 | — |
| El pase | 500 | — | 44 + 1 de oro |
| Pasado el 40 | — | — | ~7 |
| *Jugando nomás ([economy.md §6](economy.md#6-ritmo))* | *~1.760* | *~1.760* | — |

Es **~70 % más** que jugar nomás, para el que hace todo. Un Axie llega al 60 en **~95 días en vez de ~164**. Si es mucho, la mitad de lo que paga cada misión deja ~35 % sin cambiar nada más.

---

## 6. En el código

| Pieza | Dónde |
|---|---|
| Las misiones, el sorteo, contar, cobrar y el pase (puro) | `TASKS`/`MISSIONS`, `dailyPicks`, `weeklyPicks`, `rollMissions`, `trackMissions`, `claimTask`, `claimTier`, `claimBonus`, `swapTask`, `tierReward` en `missions.js` |
| Lo guardado (`axie-chance:missions`) | `readMissions`, `writeMissions`, `cleanMissions`; las de cada acción: `refreshMissions`, `recordMissions`, `recordMatch`, `claimMission`, `claimPassTier`, `claimPassBonus`, `swapMission` |
| Lo que hizo cada uno en la partida | `state.stats` en `game.js` (`emptyStats`: ataques con su racha, cortes, cartas con poder por clase, cartas del centro, Rocket Stamps, K.O. con ¿una más?, daño de sangrado, veneno, espinas y directo, lo robado); lo lee `matchEvent` |
| La partida terminada cuenta una vez | `payFor` en `ui.js`, con la misma llave que el botín; la zona de testeo no (`mount(…, { missions: false })`) |
| El Taller, la fusión, el reciclado | `onCrafted`, `fuse` y `scrap` en `lobby.js` |
| Si hay salas | `refreshMissions({ net })` cuando contesta `netAvailable` en `lobby.js` |
| Las llaves | `wallet.keys` (`KEY_KINDS` en `evolution.js`: `basic`, `gold`); `craftCards(…, { key })`, `rollTier(rng, odds)`, `KEY_ODDS`, `KEY_TRADE`, `tradeKeys`, `KEY_COST`, `buyKeys`, `GOLD_PITY` y `goldPityLeft` en `crafting.js`; el Taller, `payment` en `workshop.js` |

Quien arma una bolsa nueva a partir de otra la copia entera (`{ ...wallet, moonshards }`): armarla con los Moonshards solos le borra las llaves al guardarla (`cleanWallet`).

### El panel (`missions-view.js`)

- **Pantalla ancha**: una tabla de madera a la izquierda, debajo de tu perfil (`#adventure-quests`). Pestañas del día y de la semana con lo que falta para que se renueven, cada misión con lo que paga en un naipe, su texto, su barra, los puntos del pase y, a la derecha, **Cobrar** (cumplida), la tilde (cobrada) o **cambiarla** (una del día por día). Abajo, la tira del pase (escalón, temporada, barra al que sigue), que abre la hoja en el pase. Se pliega con la flecha a un botón (`data-quests` en el mapa; se acuerda en `axie-chance:quests-open`). Se apoya encima del panel del nivel, que `lobby.js` mide con un `ResizeObserver` (`--card-h`); con el detalle del nivel abierto se esconde. En pantallas de ≤ 860 de alto va más apretado.
- **Teléfono** (parado, o acostado y bajo: `QUESTS_COMPACT`): solo el botón del pergamino, debajo de tu perfil, con la chapa de lo que hay para cobrar; abre la hoja (`#quests-modal`) con las del día, las de la semana y **el pase**: el escalón, la barra, tus llaves, los 40 escalones (los alcanzados se cobran tocándolos, con **Cobrar todo**) y las llaves de más pasado el 40.
- La chapa de la pestaña del mapa (`#lobby-quests-count`) cuenta lo que hay para cobrar. Lo cobrado suena (`take`) y sube de su naipe; la bolsa del mapa se repinta.
- Íconos pintados en `index.html`: el pergamino (`#ic-quest`) y la llave (`#ic-key`, de hierro o de oro según `data-key`).
- Mientras se ve se repinta a cada minuto con un timer; con el mapa de fondo, no.
- `npm run layout` mira que el panel o su botón no tapen tu perfil, la bolsa, las estrellas ni el panel del nivel.

### Lo que falta

1. **La pantalla del final**: "Misión cumplida" con lo que se cumplió (`paid.missions` en `ui.js` ya lo tiene).
2. **La zona de testeo**: cumplir una, pasar al día o a la semana siguiente, sumar puntos del pase.

---

## 7. Abierto

- **Medir las metas**: una opción `--missions` en `npm run balance` que cuente cuántas batallas pide cada una contra la CPU, para ajustar "cadena de 7", "golpe de 70" y las demás con números.
- **La energía** ([economy.md §3](economy.md#energía)): cuando exista, las de "jugá N" del día tienen que entrar en 10 de energía, o seguir contando la CPU.
- **Cuánto paga**: ~70 % más que jugar nomás, ver §5.
- **"Robá cartas con poder"** cuenta las cartas que salen de tu mazo, no los poderes que actúan (los de "al atacar" no actúan si te cortás).
