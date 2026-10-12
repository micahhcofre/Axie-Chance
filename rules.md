# Axie Chance — Reglas del juego

## Qué es

Un combate de cartas *push-your-luck*. Elegís uno de los seis Axies —uno por clase— y
peleás con su mazo personal. Cada turno cargás un ataque robando cartas: cuanto más
larga la cadena, más fuerte el golpe, pero si la cadena se corta perdés todo. Gana el
que deja al otro sin vida.

---

## Preparación

- Cada jugador elige un Axie. La clase del Axie determina su mazo.
- Los dos arrancan con **150 de vida** (`TARGET`). El tutorial, con 100 (`TUTORIAL_TARGET`): su guión está contado para esa vida.
- Se sortean los **poderes activos** de la partida: uno por clase, de entre los
  disponibles para esa clase. En la Aventura no se sortea: cada nivel trae su
  combinación fija (ver [Modo Aventura](#modo-aventura)).
- Se arma el **mercado central** (pool de 86 cartas en partida estándar): 35 sin poder + 36 con poder (6 por cada poder activo) + 15 cartas comodín neutrales Free Game. En el Modo Aventura, la reserva lleva los poderes del nivel (68 cartas en el Nivel 1: tres amuletos neutrales). De ahí salen 6 cartas boca arriba al centro.

---

## El turno

Se turnan. En tu turno:

1. Te reparten **una carta** de tu mazo (o la carta atrapada por una Burbuja, si la
   tenés).
2. Decidís: **robar** otra carta, o **plantarte**.
3. Si robás, la carta nueva debe compartir al menos un símbolo con las cadenas
   todavía **vivas**. Si no comparte ninguno, se corta todo y el ataque hace **0**.
4. Podés seguir robando mientras no se corte.
5. Al **plantarte**, soltás el ataque: el daño es el puntaje de la cadena.

En red, si se te acaba el **reloj** (30 segundos), te plantás solo: el ataque sale con las cartas que llegaste a robar.

---

## La cadena

Cada símbolo de la **primera carta** abre una cadena (run). Cada carta siguiente:

- **Continúa** las cadenas cuyos símbolos trae → esas cadenas crecen.
- **Mata** las cadenas cuyos símbolos no trae → quedan congeladas con su largo.
- Si no continúa **ninguna** cadena viva → **se corta todo** (bust): ataque = 0.

Las cadenas muertas conservan su largo pero no reviven aunque el símbolo vuelva a
aparecer.

### Puntaje

Cada cadena vale su largo **al cuadrado**. Solo puntúan los símbolos que estaban en
la primera carta.

**Ejemplo:**

| carta | símbolos |
|---|---|
| 1ª | 🐟 🐦 |
| 2ª | 🐦 🐟 🐻 |
| 3ª | 🐦 🌱 |

- 🐦 aparece en 3 cartas → 3² = **9**
- 🐟 aparece en 2 cartas → 2² = **4**
- **Total: 13**
- 🐻 y 🌱 no estaban en la primera carta, no puntúan.

### Largo vs. cartas

La cadena lleva **dos cuentas**: `length` (cuántas veces salió el símbolo, es lo que
puntúa) y `cards` (cuántas cartas físicas la sostienen). Con cartas mejoradas los dos
números dejan de ser el mismo.

### Cartas mejoradas (boosts)

Una carta puede tener un símbolo extra (puesto desde la pantalla de elección de Axie).
La cadena cuenta **cada aparición**: si una carta trae el símbolo dos veces, avanza
la cadena de a dos. Una carta mejorada con 2× reptil abre su cadena en 2.

---

## El mazo personal

Cada jugador roba de su propio mazo de **8 cartas**, armado alrededor de su símbolo
(`baseDeck()`):

- **6 cartas favorables**, una por parte del Axie, con un salto fijo en el orden
  cíclico Planta → Bestia → Pez → Pájaro → Bicho → Reptil:
  - Cola (salto 0): el símbolo propio solo.
  - Boca (+1), Ojos (+2), Orejas (+3), Cuerno (+4), Espalda (+5): el propio con el de
    esa distancia. Entre las cinco aparecen los otros cinco símbolos.
- **2 cartas no favorables** (sin tu símbolo), por la fórmula de supresión de counters
  de las tríadas (Roca: Planta y Reptil · Papel: Bestia y Bicho · Tijera: Pájaro y Pez;
  Papel vence a Roca, Tijera a Papel, Roca a Tijera). Una por cada tríada rival:
  - **Doble Presa**: Presa 1 + Presa 2, la tríada que vencés.
  - **Confinamiento**: Counter 1 + Counter 2, la tríada que te vence.
  - El Aliado (la otra clase de tu tríada) no entra: ya está en una de tus favorables.
  - Las dos no comparten ningún símbolo. Por eso no hay cadena asegurada: aunque un
    mismo símbolo ajeno esté en las seis favorables (Part Evolution), siempre queda una
    no favorable que no lo lleva y corta.
  - Ejemplo, Pez: [Bestia, Bicho] y [Planta, Reptil].
- **Part Evolution**: una parte evolucionada (`isEvolved`) suma el símbolo de **la
  clase de esa parte** a su carta (3 símbolos, o 2 en la cola). Los rivales de la
  Aventura evolucionan solos; los tuyos, desde su vista previa (ver más abajo).

Los mazos iniciales **no tienen poderes**. Los poderes se ganan del centro.

**Sin descarte.** Al empezar cada ronda el mazo se rebaraja entero — lo que se jugó y
lo que se sumó del centro. Si el mazo se vacía en medio del turno, lo que ya salió
esa ronda se rebaraja y se sigue robando de ahí.

Contra la CPU, el Axie de la máquina se sortea al empezar y no lleva mejoras ni cartas
de la mochila. En red cada uno trae el suyo, y los dos pueden elegir el mismo.

---

## Daño y vida

La vida no se almacena directamente: se **deriva**.

$$\text{vida} = \max(150 - \text{daño recibido total} + \text{curación total},\; 0)$$

### Fórmula del ataque (`swingOf`)

1. **Base** = puntaje de la cadena (0 si se cortó). Con **debilidad** (Lazy Snail), sus
   mejores rachas no cuentan.
2. Si base = 0, el ataque hace 0 (no se aplican modificadores).
3. **+ 10 por pluma** del Feather Fan y **+ 2 por punto de Rage** (+10 más en Furia).
4. Si el rival tiene **escudo** (lo sumen quienes lo sumen, tope 20): el escudo absorbe
   primero.
5. Si el rival tiene **almohada** (Mít's Comfy Pillow): a lo que pasó el escudo se le
   **restan 10**.

Para los poderes del que pegó el ataque vale lo que salió **menos lo que frenó la
almohada**; lo que se comió el escudo sí cuenta.

El daño que no es de ataque no pasa por la almohada. Van directo a la vida, sin pasar
por el escudo: Feather Earring, sangrado, veneno y espinas. Pasan por el escudo (lo
gastan primero y llega a la vida lo que sobra): la bomba del Bubble Maker, el Storm
Shuriken y la Mantis Dagger.

---

## El centro (mercado)

Hay siempre **6 cartas boca arriba**, sacadas de la reserva. Al llevarse una, se
repone al instante desde la reserva.

### Después de tu turno — el reparto (draft)

| resultado del turno | te llevás |
|---|---|
| te plantaste | 1 carta **con poder** **o** 2 cartas **sin poder** |
| se te cortó | 1 carta **sin poder** |

La carta que tocás decide el modo: tocar una con poder la toma (y cierra la opción
de 2 sin poder). Tocar una sin poder empieza el camino de 2.

Podés llevarte **cualquier** carta que te toque según la tabla, lleve o no tu
símbolo (solo el tutorial limita el centro a tu color). Podés cortar el reparto antes
y quedarte con lo que ya agarraste.

**Renovar el centro**: si **ninguna** de las cartas que podés llevarte tiene tu
símbolo, podés **renovarlo entero** (las 6 al fondo de la reserva, 6 nuevas a la
vista). Es opcional (botón "Renovar el centro") y hay una sola por reparto. La CPU en
Fácil no la usa.

Si la reserva se agota, se sigue jugando con el mazo armado. Con el centro vacío no
hay reparto.

**Sin reparto con alguien en cero**: si después de un turno algún jugador quedó sin
vida, no se elige del centro; se pasa directo a la última chance o al final.

**Reloj del draft**: 20 segundos. Si se agota, el reparto se cierra con lo que ya
agarraste. Si se renueva el centro, el reloj vuelve a 20 segundos. Las cartas extra
del pulpo traen su propio reloj.

---

## Los poderes

Las cartas con poder llevan, además de sus símbolos, un **poder** que la cadena no
ve: no abre cadena, no la continúa, no la corta y no puntúa.

Cada poder pertenece a una **clase** y siempre viaja con su símbolo entre los 3 de la
carta, así el efecto de tu color encadena con tu mazo mejor que con ningún otro. Cada
clase tiene su **especialidad**, y todos sus poderes la comparten:

| clase | especialidad | poderes |
|---|---|---|
| 🐦 Pájaro | nunca vuelve con las manos vacías: actúa al robarla o al cortarte | Secret Egg, Feather Earring, Storm Shuriken, Feather Fan, Flamingo Hammer |
| 🐟 Pez | el centro y el mazo del rival | Sticky Octopus, Bubble Paste, Bubble Maker, Paralyzing Jellyfish, Red Bubble |
| 🐻 Bestia | el sangrado (cada carta que roba el rival le cuesta vida) y la Rage | Charm of Power, Energy Drink M, Hidden Razor, Raging Dagger, Mask of Frenzy |
| 🌱 Planta | cura, escudo y limpiar lo que te pusieron | Leafy Pot, Spring Leaf, Sleepy Guard, Red Sage, Mít's Comfy Pillow |
| 🐛 Bicho | robarle al rival: vida, escudo o cartas | Mantis Dagger, Lazy Snail, Cocoon Whistle, Metal Scanner, Trickster's Card |
| 🦎 Reptil | el turno del rival: veneno al terminarlo, espinas cuando te pega | Poison Vial, Gecko Mask, Viper's Venom, Gloves of Infection, Sharp Edge |

Al principio de cada partida se sortea **un poder activo por clase** (seis en total).
En la Aventura no: cada nivel pelea con su combinación fija, que puede llevar también
[amuletos neutrales](#los-amuletos-neutrales-aventura) (ver abajo).

### Reglas generales

- **Números fijos.** Ningún poder mira el golpe, el largo de la racha ni cuántas
  cartas salieron: así el Rocket, que alarga rachas, no los agranda.
- **Cada copia suma lo suyo.** Dos cartas del mismo poder en la misma mano valen el
  doble: dos Poison Vial ponen 10 de veneno. Las cartas montadas (Rocket, carta gigante
  de la burbuja) cuentan como copias.
- **Cuándo actúan.** Tres momentos, que son las tres formas en que puede seguir tu
  turno. Cada poder lleva el suyo como **etiqueta** (un ícono y su nombre) en su
  explicación —el cartel al tocar la carta, el panel de la Aventura, Símbolos
  especiales—, nunca adentro de la carta, así sabés qué esperar de cada decisión:
  - **Al robar**: apenas sale del mazo, aunque después te cortes (incluso si
    es la carta que corta);
  - **Al atacar** (al plantarte): plantado sin cortarse. Plantarse es atacar, aunque el
    golpe haga 0 (por ejemplo, porque el caracol te apagó todas las rachas): lo que
    suma números fijos (plumas, Rage, Furia) suma igual, y las garras sangran igual;
  - **Al cortarte**: solo con la cadena cortada (Secret Egg, Storm Shuriken y Flamingo
    Hammer).

  La explicación de cada poder no repite su momento: lo dice la etiqueta de al lado.
- **Topes** de lo que queda puesto, que dejan entrar dos copias enteras: escudo 20,
  veneno 15, espinas 28, turnos de brote o de capullo 9, plumas 3, garras 5, Rage 5.
  El sangrado no tiene tope.
- **Efectos que te ponen**: veneno, sangrado, herida abierta, debilidad (caracol),
  bloqueo de cura y sin poderes. Cada **Limpiador** (Sleepy Guard) cancela una
  aplicación entera (una Energy Drink es una: sangrado y herida juntos; una Paralyzing
  Jellyfish también: sus dos medusas); la **Red Sage** los saca todos. Las medusas que
  ya están en tu mazo no son un efecto: son cartas, y la Red Sage no las saca.

### El sangrado

El sangrado **cuenta cartas**: mientras tengas sangrado, **cada carta que robes te saca
2 de vida** y el sangrado **baja 1**. Con 7 de sangrado, tus próximas 7 cartas te sacan
14. No pasa por el escudo, no tiene tope y no se va solo: queda hasta que se roba
entero; lo único que elige el que sangra es qué tan rápido lo paga. La primera carta
del turno (también la que abre desde la burbuja) y el Rocket también cuentan.

La **herida abierta** (Energy Drink M): durante el turno siguiente del que sangra, cada
carta que paga sangrando **le cura 2 al que le abrió la herida** (por bebida); se cierra
al terminar ese turno.

### El veneno

Muerde al **final del turno del envenenado**: le saca tanta vida como veneno tenga,
sin pasar por el escudo ni la almohada, y después **baja 1**. Un frasco de 5 saca
5 + 4 + 3 + 2 + 1 = 15. El turno en que robás los **Gloves of Infection**, tu veneno
**te cura** en vez de morderte (y baja 1 igual).

---

### 🐦 Pájaro

- **Secret Egg** — *segunda chance.* Si te cortás con un huevo sano en la mesa, el huevo
  se rompe en vez de tu cadena: **la carta que te cortó vuelve a tu mazo** (barajada,
  puede volver a salir) y el turno sigue. Vos decidís si robás otra o te plantás, y te
  podés volver a cortar. Cada huevo es una chance más en esa mano. En la mesa se ve el
  corte primero: la carta cae y corta (daño en cero, "¡SE CORTÓ!"), el huevo se rompe
  sobre su carta —que queda rajada el resto del turno— y la carta vuelve volando al mazo.
  El reloj del turno se frena mientras tanto.
- **Feather Earring** — al robarla, **8 de daño directo** al rival (sin escudo).
- **Storm Shuriken** — si te cortás con el shuriken en la mano, **15 de daño** al rival.
  Su escudo lo frena primero.
- **Feather Fan** — al robarla, **+1 pluma** (hasta 3), aunque te cortes. Tu próximo
  ataque las gasta: **+10 de daño por pluma** (son parte del golpe: el escudo del rival
  lo frena).
- **Flamingo Hammer** — si te cortás con el martillo en la mano, el rival **pierde todo
  su escudo**. Si en la misma mano está el Storm Shuriken, el martillo va primero.

### 🐟 Pez

- **Sticky Octopus** — al plantarte, **1 carta extra** del centro por pulpo, la que
  quieras (con poder o sin), después del reparto normal.
- **Bubble Paste** — al plantarte, tu pick del reparto va a `bubbleCard` y **abre tu
  próxima ronda**. Con varias burbujas, al abrir se le funden las primeras cartas de tu
  mazo en una **carta gigante**.
- **Bubble Maker** — al robarla, **+1 burbuja** (aunque te cortes). Con **3 burbujas
  estalla una bomba de 32** contra el rival; el escudo la frena.
- **Paralyzing Jellyfish** — al plantarte, **le mezclás 2 medusas en el mazo** al rival,
  cada una en un lugar al azar. Una medusa **no tiene símbolos**: si la roba con la
  cadena abierta no comparte nada y **se corta**; si abre el turno con ella, no abre
  ninguna racha y cualquier carta que robe después lo corta (lo lógico es plantarse en
  0). **Se rompe apenas sale**: nunca vuelve al mazo, tampoco si un Secret Egg salva el
  corte. Su rueda de chances la cuenta como carta que corta, y su chapa dice cuántas
  tiene.
- **Red Bubble** — al plantarte, el rival **no puede llevarse cartas con poder** del
  centro (ni la del pulpo) **hasta que se lleve 3 sin poder**. Cada burbuja, 3 más.
  Saltear el reparto no la saca.

### 🐻 Bestia

- **Charm of Power** — al robarla, **+1 garra para toda la partida** (hasta 5). Desde
  ahí, **cada ataque tuyo le pone +2 de sangrado por garra** al rival, esté o
  no la carta en la mesa.
- **Hidden Razor** — al plantarte, **+7 de sangrado** al rival (14 de vida en 7 cartas).
- **Raging Dagger** — al robarla, **+5 de sangrado** al rival, aunque te cortes.
- **Energy Drink M** — al plantarte, **+4 de sangrado** y **herida abierta**: en el
  próximo turno del rival, **cada carta que pague sangrando te cura 2**.
- **Mask of Frenzy** — *Rage.* Al robarla, **+1 de Rage** (hasta 5), aunque te cortes.
  **Cada punto suma +2 al daño** de tus golpes, para toda la partida; no se gasta al
  pegar. **Con 5 entrás en Furia:** tu próximo ataque suma **+10 más** y la
  Rage vuelve a 0.

### 🌱 Planta

- **Leafy Pot** — al plantarte, **te curás 15**.
- **Spring Leaf** — al plantarte, **+3 turnos de brote** (hasta 9): al empezar cada turno
  tuyo, antes de robar, **te curás 8** y se gasta uno (24 en total: más que la maceta,
  porque llega de a poco). Valen aunque ese turno te cortes.
- **Sleepy Guard** — al plantarte, **+10 de escudo y 1 Limpiador**: cancela el próximo
  efecto que te ponga el rival.
- **Red Sage** — al plantarte, **te saca todos los efectos** que te pusieron y **te
  cura 12**.
- **Mít's Comfy Pillow** — al plantarte, durante los **próximos 2 turnos del rival**,
  **cada ataque suyo te saca 10 menos** (después del escudo). Cada almohada más suma 2
  turnos. Cada turno del rival gasta uno, pegue o se corte. Solo frena ataques: veneno,
  sangrado, espinas y poderes pasan enteros.

### 🐛 Bicho

- **Mantis Dagger** — al plantarte, **le pegás 7** al rival (su escudo frena primero) y
  **te curás lo que le llegó a la vida**.
- **Lazy Snail** — al plantarte, **debilidad**: en el próximo ataque del rival que no se
  corte, **su mejor racha no cuenta**; con dos caracoles, tampoco la segunda. Se gasta
  toda en ese ataque. Contra una cadena de una sola racha, el ataque sale en 0.
- **Cocoon Whistle** — al plantarte, **+3 turnos de capullo** (hasta 9): al empezar cada
  turno tuyo **ganás 8 de escudo** y se gasta uno.
- **Metal Scanner** — al robarla, **le sacás todo el escudo** al rival y pasa a ser tuyo
  (hasta tu tope de 20); si no tiene, **ganás 5**.
- **Trickster's Card** — al plantarte, antes del centro **elegís una carta con poder del
  mazo del rival** (o la de su burbuja), **Rocket incluido**, y **te la robás**: pasa a tu
  mazo por el resto de la partida. Cada copia, una carta más. Un Limpiador del rival lo
  cancela. La CPU roba la de más peso (`POWER_WORTH`).

### 🦎 Reptil

- **Poison Vial** — al plantarte, **+5 de veneno** al rival (hasta 15).
- **Gecko Mask** — al plantarte, **+14 espinas** (hasta 28): **el próximo golpe del rival que
  conecte se las lleva** como daño directo, un momento después del golpe. Si el rival se
  corta, las espinas siguen.
- **Viper's Venom** — al plantarte, **el próximo turno en que el rival se cure, no le entra
  ninguna cura de ese turno** (la maceta, las hojas, la daga, la bebida…; el escudo sí
  entra). Cada copia, un turno más.
- **Gloves of Infection** — al robarlos, **+5 de veneno para los dos**: el rival se lo lleva
  (su Limpiador lo puede frenar) y vos también, pero **al final de este turno tu veneno te
  cura** en vez de morderte. Desde tu turno siguiente muerde como siempre.
- **Sharp Edge** — al robarla, **+8 espinas**, aunque te cortes.

### Los amuletos neutrales (Aventura)

Doce poderes **sin clase**, que por ahora salen solo en la Aventura y son los primeros
que se estrenan. Sus seis cartas son de **dos símbolos**, y cada clase aparece dos veces
entre ellas, así que encadenan con cualquiera. Los números están en `TUNING`.

| Amuleto | Momento | Qué hace |
|---|---|---|
| **Charm of Focus** | Al robar | +1 foco para toda la partida (hasta 3): cada ataque tuyo suma **+3 por foco**. No se gasta. |
| **Novice Spell** | Al robar | **Elegís** uno: te curás 8, ganás 8 de escudo o le pegás 8 al rival (directo a la vida). Si no elegís (robás, atacás o te cortás), sale el golpe. La CPU se cura si está baja; si no, pega. |
| **Lens of Revelation** | Al robar | Ves las **2 cartas de arriba** de tu mazo, en el orden en que salen. Se borran al cerrar tu turno o si el mazo se rebaraja. La CPU también las mira: si la de arriba corta y no tiene con qué salvarse, se planta. |
| **Last Gift** | Al cortarte | Guardás un regalo: tu **próximo ataque suma +15** (hasta 30). |
| **Papa Bear** | Al atacar | En **ronda par** tu golpe suma +12; en **ronda impar** ganás 10 de escudo. |
| **Earth Stamp** | Al cortarte | Te llevás **una carta del centro de regalo**, la que quieras (con poder también), aparte de lo que te toque. Se elige después de la carta del corte. |
| **Mama Bear** | Al atacar | En **ronda impar** te curás 10; en **ronda par** le ponés +6 de sangrado al rival. |
| **Red Mirror** | Al robar | **Copia los símbolos de la carta anterior** de tu cadena: engancha siempre. Si abre la ronda, va con los suyos. Al mazo vuelve con sus símbolos de siempre. |
| **Bloodpact** | Al atacar | Tu golpe suma **+15**, pero vos quedás con **+3 de sangrado** (el Limpiador no lo frena: es tuyo). |
| **Scotch Tape** | Al cortarte | La cadena queda **pegada hasta la última cinta**: en vez de cero, atacás con lo que tenías hasta esa carta (lo que salió después y la carta que cortó vuelven al mazo). Pegada **no te llevás nada del centro**, salvo la carta de regalo de la Earth Stamp. Los poderes de "al atacar" de las cartas pegadas valen; los de "al cortarte" también (te cortaste), menos el pulpo. Si hay un Secret Egg sano, el huevo va primero. |
| **Energy Drink S** | Al atacar | **Los puntos de tu cadena valen el doble** en ese ataque (una sola vez, aunque tengas dos), y la bebida **se rompe**: sale de tu mazo para siempre. Si te cortás no se usa y vuelve al mazo. |
| **Black Sage** | Al atacar | Antes de tu golpe le sacás al rival todo lo que tiene encima: **escudo, espinas, plumas, Rage, almohada y regalo**. |

La Energy Drink S es el único poder que multiplica: dobla los **puntos de la cadena**
(después del caracol), no lo que suman plumas, Rage, focos ni regalos.

---

## Free Game (cartas apilables)

El pool incluye 15 cartas neutrales llamadas Free Game (presentes en todos los modos
y activas desde el **Nivel 1 del Modo Aventura**). Tienen 2 símbolos y funcionan de la siguiente manera:

- **Es gratis**: al salir del mazo con la cadena abierta **no se encadena ni corta**,
  compartan o no sus símbolos con las rachas vivas. Queda esperando y vos elegís sobre
  qué columna de la mesa ponerlo (`chooseStackTarget`).
- **Alargar carta**: Sus símbolos se suman a esa columna, pudiendo extender cadenas vivas
  (un símbolo que la columna ya lleva cuenta dos veces para su racha).
- Si se monta sobre la 1ª columna, puede **abrir nuevas cadenas puntuables**.
- No añade una nueva columna a la mesa (conserva el número de columnas).
- No arma nada para después: el robo siguiente es un robo normal.
- Si sale como primera carta de la ronda no hay dónde ponerlo: abre la cadena como
  cualquier otra.
- Si te plantás (o se acaba el reloj) con el Rocket todavía sin columna, se pone en la
  que más puntos da. La CPU elige la misma.
- La rueda de chances lo cuenta como carta segura.
- Los poderes de las cartas montadas cuentan igual que los de la cadena.

---

## Flujo completo de una ronda

1. **Inicio de ronda**: se barajan los mazos enteros (la carta de la burbuja espera
   aparte y abre).
2. **Turno del primer jugador**: primero curan sus hojas y escuda su capullo; después
   roba (pagando su sangrado), encadena, se planta o se corta.
3. **Resolución del turno**: daño, poderes aplicados, las espinas del rival (si le
   pegó) y el mordisco de veneno si el jugador actual estaba envenenado.
4. **Trickster**: si lo jugó, le roba las cartas al rival antes de elegir del centro.
5. **Draft del primer jugador**: elige del centro (sin poderes, si se lo pusieron). Bonus del pulpo si lo tiene. (Sin draft si alguien quedó en cero.)
6. **Si el rival sigue vivo** (o tiene última chance y no hubo overkill): turno del segundo jugador (con la misma resolución y veneno propio si estaba envenenado).
7. **Draft del segundo jugador**.
8. **Cierre de ronda**: se anuncia quién pegó más fuerte (solo informativo) y se
   chequea si alguien quedó sin vida.
8. Si no terminó, la ronda siguiente arranca sola en un momento (`Enter` la adelanta).

---

## La última chance

Si te quedás sin vida, no morís todavía: te queda **un golpe más**. Jugás tu turno
igual (robás, encadenás, te plantás) con un halo de fuego.

- Si tu golpe deja sin vida al otro también → **empate**.
- Si no alcanzás → perdés.
- **Le toca a los dos jugadores**:
  - Al que cierra, si lo matan antes de atacar, la juega en el mismo intercambio.
  - Al que abre (o a quien cae después de haber atacado: espinas, veneno) la juega
    abriendo la ronda siguiente, solo: el otro no vuelve a jugar.
- **Overkill**: si el daño que recibís pasado el cero supera **30** (`TUNING.overkill`),
  no hay última chance y la partida termina en el acto. Cuenta todo lo que te cae
  mientras esperás tu golpe, no solo el que te tumbó.
- **Sin cura**: en la última chance no te podés curar (maceta, hojas y la vida de la
  daga no hacen nada; las hojas esperan).
- Si los dos quedan sin vida a la vez → empate, sin más turnos.

**K.O. o última chance, en pantalla** (`wonByKo` en `game.js`): el **K.O.** es tumbarlo
sin que llegue a jugar su última chance (overkill), y se ve en la pelea: el golpe lo da
vuelta con el cartel **¡K.O.!** (si lo terminó el veneno, la cáscara o la pluma, el
ganador le da un golpe más solo de animación, el *remate*). Si en cambio cayó con última
chance y su golpe no alcanzó, no hay K.O.: se desploma solo y se canta la victoria.

La CPU en última chance calcula cuánto necesita para empatar y si la cadena le
alcanza, se planta y lo asegura.

## ¿Una más?

El chiste del tráiler hecho momento (`oneMoreOf` en `game.js`). No cambia ninguna regla:
es la apuesta del **K.O. directo por overkill** anunciada antes de que salga la carta.
Cuando apretás **Robar** y se dan las tres cosas:

- el ataque que tenés armado **no es K.O. directo** (no lo tumba, o lo tumba pero le
  deja la última chance porque no pasa 30 del cero),
- **alguna carta de tu mazo lo haría K.O. directo** si engancha (contando su escudo y su
  almohada; el Rocket Stamp cuenta montado donde más suma),
- y **alguna otra te corta la cadena**,

antes de que salga la carta la mesa se apaga, la música baja, sube un tono y golpea el
cartel **¿UNA MÁS?** (1,5 s, `ONE_MORE_MS`; el reloj del turno se frena mientras tanto).
Después la carta sale **en cámara lenta**: sube del mazo de espaldas hasta el medio de
la pantalla, se queda temblando con la luz creciendo detrás, se da vuelta de golpe
(estalla dorada si engancha, roja si corta) y recién ahí cae a su lugar
(`ONE_MORE_FLIP` 1,15 s, `ONE_MORE_LAND` 1,55 s; el motor espera que caiga). Hasta que
se da vuelta la mesa no cuenta cómo salió: el daño, el aro y las vigas siguen como antes.

- **Engancha y pasa el overkill** → atacás solo en el acto: K.O. directo, sin última
  chance para el rival (la regla del overkill de siempre).
- **Corta** → cero de daño, como cualquier corte, y suena el trombón triste
  (wah-wah-wah-waaah) mientras el otro se ríe.
- **Engancha pero no llega** → el turno sigue normal.

No pasa en el tutorial (no tiene overkill) ni con alguien en su última chance (ahí
dejarlo en cero es el empate). Le toca a los dos asientos: la CPU también se la juega.

### La cuenta atrás del K.O.

**K.O.** es tumbarlo **sin última chance**: dejarlo más de 30 abajo del cero (overkill).
Arriba del número de daño (a su izquierda con la pantalla parada) aparece **"A N DEL
K.O."** cuando te faltan **10 cartas o menos** (`KO_COUNTDOWN`) para el K.O. (`koInOf`
en `game.js`).

- **Cómo cuenta**: cuántas cartas que sigan tu **racha más larga** (un eslabón más por
  carta) te faltan para que el golpe pase el overkill, contando escudo y almohada como
  la barra roja (`koProjection`). No mira tu mazo: es la cuenta que se hace mirando la
  cadena.
- **Aviso de última chance**: si plantarte ahora lo deja en 0 pero sin pasar el
  overkill, arriba de la cuenta dice **"QUEDA CON ÚLTIMA CHANCE"** (`leavesLastChance`):
  atacar ahí no es el K.O., se levanta para un golpe más.
- **Se recalcula con cada carta que engancha**: si la carta suma dos símbolos (alarga
  dos rachas), salta más de uno.
- **Nunca va para atrás**: cada carta que engancha la baja por lo menos uno
  (`state.koCount`), y no baja de 1 hasta que el golpe de verdad lo tumba.

De 3 para abajo se pone roja y late; con 1 dice **"¡A UNA DEL K.O.!"**. No sale si ya
es K.O., fuera de tu turno, con alguien en su última chance ni en el tutorial.

---

## Quién abre

- **Contra la CPU**: siempre vos (p1). El orden es fijo toda la partida.
- **En red**: se sortea al empezar (`rng() < 0.5`). Fijo toda la partida (no alterna
  entre rondas, porque eso causaba que el mismo jugador jugara dos veces seguidas).
- Abrir es desventaja: el que cierra ve el daño del otro antes de decidir.

---

## Reloj

| fase | tiempo |
|---|---|
| Turno | 30 segundos |
| Draft (cada pick) | 20 segundos |

- Si se agota en el turno: te plantás solo y atacás con la cadena que tenías.
- Si se agota en el draft: el reparto se cierra con lo que ya agarraste.
- El reloj corre **solo en red** (multijugador), para no hacer esperar a la otra persona. Contra la CPU —Vs CPU, la Aventura y el tutorial— no hay reloj: pensás lo que quieras.

---

## Abandono (forfeit)

- Disponible en cualquier momento de la partida en red.
- La partida deja de correr en el acto: el que abandona pierde y **gana el que se queda**,
  en la ronda que sea.
- Esa victoria **paga** (ver [lo que se gana jugando](#lo-que-se-gana-jugando)) solo si la
  partida llegó a la **ronda 4** (`FORFEIT_PAY_ROUND`): abrir una sala y abandonarla
  enseguida no puede ser una forma de cobrar. Un abandono nunca es K.O.
- Contra la CPU, en la Aventura o en el tutorial, volver al menú no es abandonar: la
  partida se descarta sin ganador.

---

## Mejoras del Axie (+)

> Los botones (+) están apagados en la pantalla; las mejoras que ya estaban guardadas
> siguen valiendo y se ven en el inventario del Axie (borde verde).

Cada carta se puede mejorar con un símbolo extra:

- Las **6 cartas de tu clase** (las que llevan tu símbolo) admiten solo **el tuyo**.
  Con una sola opción, el botón lo pone de un toque.
- Las **2 no favorables** (sin tu símbolo) admiten **uno de sus dos**, el que elijas.

El símbolo repetido no es adorno: la cadena cuenta cada aparición, y la cadena
puntúa al cuadrado. Abrir con una carta mejorada y encadenar tres cartas más es
5² = 25 donde antes era 4² = 16.

Las mejoras se guardan **por Axie** y viajan a la partida como
`{ clave_carta: símbolo }`.

---

## La mochila y el inventario del Axie

En la colección los Axies se ven sin clase (dibujo y nombre, sobre el mismo prado);
al tocar uno, la vista previa muestra su clase, su nivel (**LVL**, ver la evolución más
abajo) y tres puertas: **Inventario**, **Evolucionar** (con un punto verde cuando hay una
evolución abierta y alcanzan los Moonshards) y elegirlo. En el inventario, las cartas
evolucionadas llevan el borde dorado (las mejoradas con (+), el verde).

El **inventario** muestra las 8 cartas base, la rueda de símbolos del mazo entero y
**4 espacios** (`EXTRA_SLOTS`) para cartas de la **mochila**:

- La mochila (`axie-chance:backpack`) guarda cartas sueltas: 1 a 3 símbolos (se pueden
  repetir: dos Planta en la misma carta) y, opcionalmente, un poder. Arranca con un
  paquete de bienvenida (`STARTER_PACK`): tres cartas de 2 símbolos, dos de 3 y un
  Rocket Stamp. Se llena con el **Taller** (ver más abajo); `addToBackpack` es la
  puerta, también para el botín de las partidas.
- **Cada carta es una sola**: puesta en un Axie deja de estar suelta; la × del espacio
  la devuelve.
- Las cartas puestas **se suman al mazo** del Axie en la partida (`extras` en
  `newMatch`, 8 + hasta 4) y se rebarajan con el resto como cualquier carta. Viajan en
  el loadout (también a una sala, limpias por `cleanExtras`). El tutorial no las usa.

La **mochila** (su pestaña) es una **colección**: las cartas iguales van en una sola
**pila**, de la más rara a la más común. Cada pila lleva la **gema** de su rareza (y el
marco de su color), cuántas copias hay (×N), el Axie que la tiene puesta asomado en la
esquina, y debajo **tres casilleros** que se llenan con sus copias sueltas: con tres, la
barra se pone verde con una flecha (lista para fusionar). La mítica no lleva barra. Las
recién creadas o fusionadas llevan un destello hasta que se mira la mochila. Arriba, el
filtro: todas, las **listas para fusionar** y cada rareza por su gema. Tocar una pila abre
su **ficha** abajo: su nombre (el del poder, o la rareza), sus símbolos, lo que hace su
poder, quién la tiene puesta, la barra de la fusión (con tres sueltas, el botón
**Fusionar**) y **Reciclar** una copia suelta.

- **Reciclar**: una carta suelta se rompe y devuelve el **10 % de lo que vale su
  rareza** en Moonshards (`CARD_VALUE`, `scrapValue` y `scrapCards` en `crafting.js`).
  Siempre pide confirmación y no se deshace.

  | Rareza | Vale | Reciclarla devuelve |
  |---|---|---|
  | Común | 10 | 1 |
  | Poco común | 30 | 3 |
  | Rara | 80 | 8 |
  | Épica | 250 | 25 |
  | Legendaria | 800 | 80 |
  | Mítica | 3.000 | 300 |

  El Rocket Stamp del paquete de bienvenida cuenta como poco común (dos símbolos, y su
  poder no es de clase). El **reciclado rápido** (sin filtro) recicla de una vez todo
  lo que no tiene puesto ningún Axie, y avisa cuántas de esas cartas tienen poder; con
  una rareza filtrada, el mismo botón recicla solo las sueltas de esa rareza. La carta que tiene puesta un Axie no se recicla: primero se la saca desde su
  inventario.
- **Fusionar**: **tres cartas sueltas iguales** —los mismos símbolos, contando los
  repetidos, y el mismo poder— se vuelven **una de la rareza siguiente**
  (`mergeGroups`, `mergeResult` y `mergeCards` en `crafting.js`). No cuesta nada.

  | Se juntan tres | Sale | Qué tiene la nueva |
  |---|---|---|
  | Comunes (1 símbolo) | Poco común | su símbolo + uno al azar |
  | Poco comunes (2) | Rara | sus dos símbolos + uno al azar |
  | Raras (3) | Épica | **uno de sus tres símbolos**, al azar, + **un poder de esa clase**, al azar |
  | Épicas (1 + poder) | Legendaria | su símbolo y su poder + un símbolo al azar |
  | Legendarias (2 + poder) | Mítica | sus dos símbolos y su poder + un símbolo al azar |

  El símbolo al azar es cualquiera de las seis clases y puede repetir uno que la carta
  ya tiene. De rara a épica, un símbolo repetido tiene más chances de quedar (una
  Bestia·Planta·Planta queda Planta dos de cada tres veces), y el poder es uno de los
  cinco de esa clase. La mítica no se fusiona, ni el Rocket Stamp del paquete (su poder
  no es de clase). Solo cuentan las sueltas: la que tiene puesta un Axie es de su mazo.

  **Fusionar**: tocar una pila lista abre el **altar** de una, en una ficha grande que
  también dice lo que hace su poder y deja reciclar una copia: las tres copias en triángulo alrededor de la que va a salir, que se ve en
  contorno con lo que mantiene y un "?" donde va a caer lo que se sortea, y abajo los
  tres naipes → la rareza que sale. Al apretar, la fusión ya queda guardada y se anima
  (`card-scene.js`): las tres tiemblan y caen de a una sobre la que sale, destello, el
  contorno se vuelve carta con el "?" todavía puesto, y una **ruleta** con los
  candidatos gira alrededor de la carta hasta frenar en lo que salió (el símbolo nuevo
  entre las seis clases; de rara a épica, el que queda entre sus tres y después su
  poder entre los cinco de su clase). La ficha que ganó vuela al "?" y lo llena.
  Termina con la rareza en grande y **Fusionar otra** si quedan tres.
  Un toque salta al final.

---

## El nivel del Axie y la evolución

El diseño entero está en [docs/economy.md](docs/economy.md). Lo que ya está en el juego:

- **Nivel**: cada Axie del roster tiene su nivel, del **1 al 60**, con su propia
  experiencia (**AXP**). Pasar del nivel `L` al siguiente pide `30 + 5·(L−1)` AXP, y
  cada subida da **5 Moonshards** (`evolution.js`).
- **Moonshards**: la moneda, una sola bolsa para todos los Axies (`axie-chance:wallet`).
- **Se ganan jugando**: ver [lo que se gana jugando](#lo-que-se-gana-jugando). Para
  probar sin jugar, la zona de testeo (`?testeo`) sube niveles y da Moonshards.
- **Evolución**: cada **10 niveles** se abre una (son seis, hasta el 60), y se paga:
  **300 · 600 · 900 · 1.200 · 1.500 · 2.000** Moonshards, en ese orden.
- **Dónde**: en la vista previa del Axie, la puerta **Evolucionar**. Arriba él con su
  nivel, su experiencia y las seis evoluciones, y la rueda de símbolos de su mazo
  entero (con las cartas de la mochila); al lado sus seis cartas favorables. Al tocar
  una, la rueda muestra el mazo **como quedaría**, con cuántos puntos sube o baja cada
  símbolo, y la carta dice el porcentaje de su símbolo antes y después
  (`Bestia en tu mazo: 38% → 41%`).
- **Se elige la carta**: cualquiera de las **6 favorables** que no haya evolucionado.
  Evoluciona la **parte del cuerpo** de esa carta, y la carta suma el símbolo de **la
  clase de esa parte**, que no siempre es la del Axie:
  - Los seis del mixer (Colmillo, Marea, Racha, Brote, Aguijón, Escama) son puros:
    suman siempre su propio símbolo.
  - Los starters tienen sus partes de verdad, del catálogo del kit de Origins: Buba
    tiene el cuerno y la espalda de planta, Olek las orejas de reptil, Puffy la boca
    de bestia y la espalda de reptil, Venoki la espalda de planta y la cola de bicho,
    Momo las orejas de bicho, Pomodoro los ojos de pájaro y la boca de bestia.
  - Las partes **Mech, Dawn y Dusk** (el cuerno de Olek, el cuerno y la espalda de
    Pomodoro) suman la clase del propio Axie, por ahora.
- Las **2 no favorables no evolucionan nunca**: con las seis evolucionadas, el Axie
  sigue pudiendo cortarse.
- **El dibujo cambia**: los del mixer, con el arte `-lv2` de cada parte; los starters,
  con su cuerpo despierto del kit cuando evoluciona la parte que despierta (el cuerno
  de Buba, Olek, Venoki y Pomodoro, las orejas de Puffy, la espalda de Momo). Cada
  evolución se ve en grande (el Axie se carga con el clip `evolve` del kit, cambia, y
  la carta se da vuelta con el símbolo nuevo), aunque el dibujo no cambie.
- **Viaja a la partida**: el Axie juega con sus cartas evolucionadas en todos los
  modos —también en una sala, con la regla de siempre: lo que trae cada uno lo limpia
  el anfitrión—. El id lleva las partes (`'buba~horn.tail'`), como los rivales.
- **Balance medido** (contra la CPU normal, 300 partidas): un Axie puro con las seis
  evolucionadas gana ~73% (de ~40%); un starter, ~51%. Aceptado: los puros quedan más
  fuertes que los híbridos.

### Lo que se gana jugando

Al terminar la partida, la pantalla del final muestra el **resumen** de la pelea (daño
hecho, mejor golpe, cadena más larga y rondas) y el **botín**: los Moonshards que entran
a la bolsa y la AXP que gana el Axie con que jugaste, con su barra que se llena y su
nivel. **Paga el resultado**, nunca el largo de la cadena ni el daño (`payout.js`):

| Dónde | Ganás | Ganás por K.O. | Empate | Perdés |
|---|---|---|---|---|
| **Multijugador** | 10 | **20** | 0 | 0 |
| **Aventura**, primera victoria del nivel | 10 | **20** | 0 | 0 |
| Aventura, la estrella de un nivel ya ganado sin K.O. | — | +10 (lo que faltaba) | | |
| Aventura, volver a ganar un nivel con estrella | 0 | 0 | 0 | 0 |
| Aventura, **jefe** (cada diez niveles) | el doble: 20 | el doble: **40** | 0 | 0 |
| **Contra la CPU** y **tutorial** | 0 | 0 | 0 | 0 |

- **Moonshards y AXP salen juntos y con el mismo número**: una victoria por K.O. da 20
  Moonshards y 20 de AXP. Si el Axie sube de nivel, la subida suma sus **5 Moonshards**
  y la pantalla lo festeja (y avisa si el nivel nuevo abre una evolución).
- El K.O. es el de la estrella: ganar con el rival en 0 sin que haya jugado su última
  chance (`wonByKo`). Un abandono no es K.O., y antes de la ronda 4 no paga.
- **Contra la CPU se practica**: no se gana nada, y la pantalla del final lo dice.
- En una sala **cobra cada pantalla lo suyo**, por su asiento, en su propio aparato; el
  que mira no cobra. Cada partida paga **una sola vez**, aunque la pantalla del final
  se vuelva a pintar.

---

## El Taller: crear cartas

La pestaña del yunque es la **forja**: cartas nuevas para la mochila, a la suerte
(`crafting.js`, `workshop.js`). Las que se repiten se **fusionan** en la mochila (ver
[la mochila](#la-mochila-y-el-inventario-del-axie)).

- **Cuesta** 10 Moonshards por carta (`CRAFT_COST`, borrador). Se crea de a una o de a
  diez (100); no hay descuento por la tanda.
- **La rareza** sale primero, con estas chances, que están siempre a la vista en el
  Taller:

  | Rareza | La carta | Chance | Con llave de oro |
  |---|---|---|---|
  | Común | 1 símbolo | 80 % | — |
  | Poco común | 2 símbolos | 15 % | 15 % |
  | Rara | 3 símbolos | 4 % | 70 % |
  | Épica | 1 símbolo + un poder de clase | 0,85 % | 14 % |
  | Legendaria | 2 símbolos + un poder de clase | 0,14 % | 0,75 % |
  | Mítica | 3 símbolos + un poder de clase | 0,01 % | 0,25 % |

- **Los símbolos** son cualquiera de las seis clases, cada uno por separado: se pueden
  repetir (dos Planta en la misma carta adelantan la racha de a dos, como una carta
  evolucionada). El poder es cualquiera de los **30 de clase**, sin mirar los símbolos;
  el Rocket Stamp no sale.
- **Carta con poder asegurada**: la creada número 50, 100, 150… trae poder sí o sí. Si
  el sorteo ya le dio una con poder (hasta una Mítica), queda esa; si no, es una
  **Épica**. La cuenta es fija (`axie-chance:craft`): no se reinicia cuando sale un
  poder por suerte. Una barra en el Taller dice cuántas faltan.
- Lo que sale va **suelto a la mochila**, y de ahí se le pone a un Axie desde su
  inventario como cualquier otra (hasta 4 por Axie). Crear es un momento en grande
  (`card-scene.js`) que **crece con la mejor carta de la tanda**: un cofre cae y se
  sacude una vez por escalón de rareza (una la común, seis la mítica), cada vez más
  fuerte; de rara en adelante se le escapa luz por la tapa. Al abrirse sale una columna
  de luz y una lluvia de chispas de su color (de épica en adelante, el estallido y la
  pantalla que tiembla), y las cartas saltan de adentro de espaldas a su lugar (todos
  los dorsos iguales), las raras en adelante **avisan** antes
  de darse vuelta —el dorso se enciende de su color y las épicas tiemblan—, se dan vuelta
  de a una (una rara se hace esperar y estalla; una legendaria o mítica se adelanta sola,
  tiembla y estalla) y la mejor sale en grande. Desde ahí:
  crear otra tanda igual, ver en la mochila o seguir. Un toque salta al final.
- Los Moonshards se ganan jugando (ver [lo que se gana jugando](#lo-que-se-gana-jugando));
  para probar el Taller sin juntarlos, la zona de testeo (`?testeo` → Evolución → +1.000
  Moonshards → Abrir el Taller). Para probar la fusión, la carta que se fabrica en la
  zona de testeo va a la mochila de a tres (**Mochila ×3**) y Evolución → **Abrir la
  mochila**.
- **Con llaves** (del [pase de temporada](#misiones-y-pase-de-temporada)): la **común**
  es lo mismo que crear con 10 Moonshards (las mismas chances, y cuenta para la
  asegurada); crear ×1 y ×10 la usan si tenés para toda la tanda. La **de oro** tiene
  las chances de la última columna de la tabla —nunca una común, casi siempre una rara,
  y la mejor chance de mítica— y vale lo mismo que diez cartas: **10 llaves comunes o
  100 Moonshards** (su botón usa una tuya, o hace el cambio o la compra). Tiene su propia
  asegurada: cada 50 cartas creadas con ella, una **legendaria**.

---

## Misiones y pase de temporada

Se ven y se cobran en el **panel de las misiones** del mapa: a la izquierda en una
pantalla ancha (se pliega), o en el botón del pergamino debajo de tu perfil en un
teléfono, que abre la hoja con las del día, las de la semana y el pase entero. Todo el
detalle, con la lista de misiones, en [docs/missions.md](docs/missions.md).

- **Del día**: tres —una fácil, una media, una difícil— que se renuevan a la medianoche.
  Pagan 5, 10 o 15 Moonshards, o 10, 15 o 25 de AXP, según la misión, y 10, 15 y 25
  puntos del pase. Una por día se puede cambiar por otra.
- **De la semana**: cinco que se renuevan el lunes —dos de pelea, una de **la clase de
  la semana** (Planta, Bestia, Pez, Pájaro, Bicho, Reptil, en rueda), una de colección
  y un desafío—. Pagan 30 Moonshards o 50 de AXP y 60 puntos; el desafío, 50 o 80 y 100
  puntos.
- Cuenta toda partida terminada **menos el tutorial y la zona de testeo**, también
  contra la CPU; un abandono antes de la ronda 4 no cuenta. Las de multijugador solo
  salen si hay salas. La AXP va al Axie que tenés elegido al cobrarla.
- **El pase**: temporadas de 28 días, de lunes a lunes. Cada misión cumplida suma sus
  puntos; cada 50, un escalón (40 en total) con llaves o Moonshards: en toda la
  temporada, 500 Moonshards, 44 llaves y la de oro, una sola, en el último. Pasado el
  40, una llave cada 100 puntos. Lo alcanzado sin cobrar se paga solo al renovarse (las
  misiones) o al cerrar la temporada (el pase).

---

## Atajos de teclado

| tecla | acción |
|---|---|
| `R` | Robar carta (con un Rocket Stamp esperando columna, lo pone donde más suma) |
| `P` | Plantarse |
| `Enter` | Adelantar la ronda siguiente / en el final, jugar otra (o el nivel siguiente de la Aventura) |
| `Escape` | Cerrar paneles y carteles |

Con un panel abierto (mazo, historial, reglas) las teclas no llegan a la mesa.

---

## La CPU

Usa *expectimax* con lookahead sobre las cartas no vistas de su propio mazo. Tres
niveles de dificultad:

| | profundidad | margen | juega el final | mide el ataque por | elige del centro |
|---|---|---|---|---|---|
| Fácil | 1 | 1.35× (tímida) | no | puntos | al azar la mitad de las veces, sin renovar |
| Normal | 1 | 1.0× | sí | puntos | conectividad |
| Duro | 3 | — | sí | la partida | conectividad |

**Duro** no maximiza puntos sino la partida:
- Pega contra la vida que hay: el escudo del rival se come la punta, la almohada le
  resta y lo que se pase de la vida no suma, salvo que le borre la última chance. Las
  espinas del rival le restan.
- Dejar al rival sin vida vale mucho más que el daño: si plantarse ya lo tumba, se planta.
- Cortarse cuesta más que el golpe: pierde los poderes de la mesa (un veneno, una
  navaja, una maceta) y medio centro. Con un poder en la mesa se planta antes. Lo que dio
  al robarse (pluma, garra, daga…), el martillo y el shuriken sí los cobra aunque se corte.
- Todas las dificultades cuentan los **huevos sanos** de su mesa: con uno, un corte
  no la corta, así que roba más.
- Si el próximo golpe del rival lo deja sin vida, lo que rinde después no importa: va a todo.
- En su última chance solo cuenta empatar: si con lo que tiene no alcanza, sigue robando.

Contra un mismo jugador simulado (`npm run balance -- --difficulties`) la CPU gana
~28% en Fácil, ~68% en Normal y ~76% en Duro (200 partidas, con los 30 poderes, el mazo de
8 y 150 de vida; antes de esos cambios era ~39 / ~55 / ~63%, y todavía no se separó cuánto
de la diferencia es de cada cambio).

Para elegir del centro usa **conectividad**: por cada símbolo de la carta, cuántas
cartas de su mazo lo llevan. Compara las dos ramas (2 sin poder vs. 1 con poder)
convirtiendo el valor del efecto a la misma unidad con `POWER_WORTH`.

"Juega el final" = en su última chance, si con lo que ya tiene alcanza para empatar,
se planta y lo asegura.

---

## Modo Aventura

El Modo Aventura es una campaña individual de **200 niveles en veinte capítulos de
diez**, uno por tierra, con un jefe en el décimo: el Valle, la Costa, el Bosque Nevado, la
Guarida, el Coliseo, el Bosque de Otoño, la Jungla, la Laguna, la Isla del Verano, la
Meseta, el Cañón Rojo, el Cielo, la Caverna, el Desierto, el Ocaso, el Bosque Nocturno, el
Salón de Invierno, los Engranajes, el Mar Violeta y el Amanecer. Va **de menos a más en tres
tramos**: fácil hasta el 60, medio hasta el 130 y difícil hasta el 200. Se juega con cualquier Axie del roster (los seis starters de Origins —Olek,
Momo, Puffy, Buba, Pomodoro, Venoki— o los seis del mixer), contra **rivales propios de
la Aventura** armados con el mixer de Axie Infinity.

- **Poderes nuevos hasta el nivel 175, de a poco.** Primero los **doce amuletos
  neutrales**: tres en el nivel 1 (Charm of Focus, Novice Spell y Lens of Revelation) y
  uno cada tres niveles hasta el 28. Después los **treinta de clase**, repartidos parejo
  del 33 al 175 (uno cada cuatro o cinco niveles), uno de cada clase por vuelta. Del 176
  al 200 no se estrena nada: lo nuevo es el rival. El orden está en `UNLOCK_ORDER` y el
  nivel de cada uno en `UNLOCK_LEVELS` (`src/adventure.js`).
- **Cada nivel, su combinación fija y única.** No hay sorteo: cada nivel pelea siempre
  con los mismos poderes (`levelPowers`), hasta seis y a lo sumo uno por clase. El que
  estrena el nivel entra siempre; el resto son los ya desbloqueados que hace más que no
  salen, así todo lo que abriste vuelve a aparecer en pocos niveles (nunca más de diez).
  **Ningún nivel repite la combinación de otro.** Los primeros niveles traen menos
  (lo que hay abierto), y desde el 13 son seis. El Rocket Stamp está siempre. El panel
  del nivel muestra la combinación antes de entrar.
- **La CPU**: fácil en el Valle y la Costa (los poderes clásicos se aprenden sin apuro),
  normal hasta el 130 y **dura** en todo el tramo difícil (del Desierto al Amanecer).
- **La vida del rival** sube por tramos: 150 en los dos primeros capítulos, 130 en el
  Bosque Nevado (donde empieza la CPU normal), 140 en la Guarida, 150 hasta el 60, 160 en
  lo medio, 170 desde el 101, 180 en lo difícil y 190 en los últimos cuatro capítulos. El
  panel del nivel la muestra cuando no es la de siempre. Los jefes traen la suya.
- **El rival crece de a poco.** Lo que trae de más sigue una escalera, de lo más fácil
  de conseguir para un jugador a lo más difícil, y **nunca trae algo que vos no puedas
  tener a esa altura del mapa**:
  - **Cartas de mochila**, como las tuyas y con el **mismo tope: cuatro**. Desde el
    nivel 3, una común de su clase (un símbolo, lo más barato del Taller); dos desde el
    7, tres desde el 13 y cuatro desde el 17.
  - Después **se fusionan**, como hacés vos en la mochila: una poco común (dos símbolos)
    desde el 23 y las cuatro para el 39; una rara (tres símbolos) desde el 43 y las
    cuatro para el 61. El símbolo que suma cada fusión es de otra clase, al azar.
  - **Épicas** (un símbolo de su clase y un poder de su clase, como la que asegura el
    Taller cada 50 cartas; nunca el Secret Egg, que con varios en el mazo deja a la CPU
    sin cortarse): una desde el 81, dos desde el 101, tres desde el 131 y las
    cuatro desde el 141. **Legendarias** (dos símbolos y un poder): una desde el 171, dos
    desde el 181 y tres desde el 191. La **mítica**, solo el jefe final.
  - **Partes evolucionadas**: una desde el **31**, dos desde el 71, tres desde el 121 y
    cuatro desde el 161 —las mismas que vas juntando vos con tu Axie—; seis, solo el jefe
    final. Part Evolution de siempre: la carta de esa parte suma el símbolo de la clase de
    la parte y se dibuja con el arte evolucionado del mixer. Del Coliseo en adelante los
    rivales son **híbridos** y evolucionan primero sus partes de otra clase (un símbolo
    nuevo para encadenar, no una racha el doble de larga).
  - **Partes coleccionables**: del capítulo 7 en adelante los rivales suman partes
    místicas y de evento (Japón, Navidad, verano, Agamo) de su clase: una en lo medio, dos
    desde la Meseta, tres en lo difícil y cuatro en los últimos capítulos, y desde el
    Desierto alguna **Shiny** (las de verano tornasoladas). Se ven distinto pero juegan
    igual: su carta es la de su clase.
  - El panel del nivel muestra la mochila del rival con la gema de cada carta, y en la
    mesa se ve su mazo entero tocándolo.
- **Jefes.** El décimo nivel de cada capítulo es un jefe —veinte en total—, que pelea
  **un escalón de la escalera más arriba** que su nivel: con **más vida** que vos (de 160
  a 260; el final, el que más), cuerpo y partes **coleccionables** casi enteros (Japón,
  Agamo, verano, Navidad con cuerpo de escarcha, pesadilla, místico, y Shiny en lo
  difícil) y **amuletos**: las cartas de sus partes especiales llevan poderes de la
  combinación de su nivel, **siempre los mismos** (`adventureCharms`): el que estrena el
  nivel en la primera parte y los demás en orden. El panel los muestra. Más amuletos a medida que avanza: una o dos partes en
  lo fácil, dos o tres en lo medio y en lo difícil. Contra un jefe suena la música de jefe desde la
  primera carta, y ganarle **paga el doble**.
- **Estrellas.** Ganarle al rival pasa el nivel y abre el siguiente. **La estrella es
  solo por K.O.**: tumbarlo sin dejarle la última chance (más de 30 pasado el cero). Si
  cae con última chance y su golpe no alcanza, el nivel queda superado **sin
  estrella**; se puede volver a jugar para ganarla (ganarlo otra vez sin K.O. no la
  saca). La pantalla del final dice si te la llevaste, y arriba del mapa se cuentan
  las estrellas (`★ n/200`). Lo ganado antes de que hubiera estrellas cuenta con estrella.
- **Lo ganado antes de los capítulos de diez** sigue ganado: cada nivel de la campaña de
  30 pasó a su lugar en el capítulo nuevo (el 7 de antes es el 11), con su estrella, y
  los niveles nuevos que quedaron atrás se pueden jugar cuando quieras.
- **Premio.** La primera victoria de cada nivel paga 10 Moonshards y 10 de AXP (20 y 20
  por K.O.); la estrella que faltaba, los 10 de diferencia. Un jefe, el doble. Volver a
  ganar un nivel ya hecho no paga. Ver [lo que se gana jugando](#lo-que-se-gana-jugando).

El **mapa** es el viaje entero, a pantalla completa: un solo mundo pintado como los
fondos de pelea de Origins que cruza las veinte tierras, cada una con el hito de su jefe
detrás —los tótems del Valle, el barco pirata de la Costa, el árbol sagrado del Bosque
Nevado, la calabaza gigante de la Guarida, el Coliseo, la puerta de piedra del Bosque de
Otoño, el templo de la Jungla, el loto gigante de la Laguna, el faro de la Isla, el arco
de roca de la Meseta, el termitero del Cañón, el nido gigante del Cielo, el cristal de la
Caverna, la carpa del Desierto, el volcán del Ocaso, el hongo luminoso del Bosque
Nocturno, el árbol de Navidad del Salón de Invierno, la torre del reloj de los
Engranajes, el portal del Mar Violeta y la puerta del sol del Amanecer, donde termina el
camino—. El camino sale de la casa del comienzo y pasa por los 200
niveles, de oro hasta donde llegaste; las tierras que faltan están bajo las nubes. Cada
nivel es un botón sobre el camino, con su estrella si lo ganaste (dorada por K.O.,
apagada si no). Los rivales de los niveles abiertos esperan **parados al costado de su
nivel, cortando el camino**, y vivos: respiran y hacen gestos. **Un toque** elige el
nivel —tu Axie camina a saltitos hasta el otro costado, frente al rival, y el panel de
abajo dice contra quién es y qué estrena, o la mochila del rival si no estrena poder— y
**otro toque** sobre el mismo nivel lo juega (o el botón de pelear). En un teléfono
parado el viaje va de abajo para arriba.

**Entrar a un nivel** (desde el mapa, o con "Siguiente Nivel" o "Reintentar Nivel" al
terminar una pelea) reparte un muro de cartas boca abajo que tapa la pantalla. Encima
sale la previa: el nivel, tu Axie y su rival frente a frente, y una cadena con los seis
símbolos que se enciende de a uno mientras se carga la pelea. Con todo listo, las cartas
se dan vuelta y arranca la partida: el reloj del turno recién corre ahí.

La curva se mide con `npm run balance -- --adventure`: un jugador simulado que juega
como la CPU "normal" y lleva lo que tiene alguien a esa altura del mapa (nada en el
primer capítulo; las cartas de su color del paquete de bienvenida desde el 11; su
primera evolución desde el 31; raras, épicas y legendarias de su color y hasta cuatro
evoluciones después), contra el rival de cada nivel. Con 80 partidas por nivel, el rival
le gana ~25% en los dos primeros capítulos, ~55-60% en los comunes de lo medio y ~63-67%
en los de lo difícil; los jefes, de 36 y 54% en los dos primeros a 72-84% del tercero en
adelante. Ese jugador pierde el ~68% contra la CPU "normal" en una partida suelta: es
una vara, no un humano.

### Los 200 niveles

| Nivel | Nombre | Rival (Clase) | Escenario | Dificultad | Poder que estrena | Poderes del nivel | El rival trae |
|---|---|---|---|---|---|---|---|
| **1** | Primeros Pasos | Retoño (Planta) | Plaza | Fácil | Charm of Focus, Novice Spell, Lens of Revelation *(y el Rocket Stamp)* | Charm of Focus, Novice Spell, Lens of Revelation | — |
| **2** | Pluma Veloz | Pichón (Pájaro) | Plaza | Fácil | — | Charm of Focus, Novice Spell | — |
| **3** | Una Carta de Más | Renacuajo (Pez) | Plaza | Fácil | — | Charm of Focus, Lens of Revelation | mochila: 1 común |
| **4** | Primera Sangre | Zarpa (Bestia) | Valle de otoño | Fácil | Last Gift | Charm of Focus, Novice Spell, Lens of Revelation, Last Gift | mochila: 1 común |
| **5** | Hojas Secas | Bellota (Planta) | Valle de otoño | Fácil | — | Charm of Focus, Novice Spell, Last Gift | mochila: 1 común |
| **6** | Robo de Vida | Polilla (Bicho) | Valle de otoño | Fácil | — | Charm of Focus, Lens of Revelation, Last Gift | mochila: 1 común |
| **7** | Dos de Más | Gorrión (Pájaro) | Valle de otoño | Fácil | Papa Bear | Charm of Focus, Novice Spell, Lens of Revelation, Last Gift, Papa Bear | mochila: 2 comunes |
| **8** | Veneno Lento | Víbora (Reptil) | Valle de otoño | Fácil | — | Charm of Focus, Novice Spell, Lens of Revelation, Papa Bear | mochila: 2 comunes |
| **9** | Antes del Shogun | Cachorro (Bestia) | Valle de otoño | Fácil | — | Charm of Focus, Novice Spell, Last Gift, Papa Bear | mochila: 2 comunes |
| **10** | **Jefe: El Shogun del Valle** | Shogun (Pez) | Valle de otoño | Fácil | Earth Stamp | Charm of Focus, Novice Spell, Lens of Revelation, Last Gift, Papa Bear, Earth Stamp | 180 de vida · partes Japan y Agamo · amuleto: Earth Stamp · mochila: 3 comunes |
| **11** | Segunda Chance | Gaviota (Pájaro) | Playa | Fácil | — | Charm of Focus, Novice Spell, Lens of Revelation, Last Gift, Earth Stamp | mochila: 2 comunes |
| **12** | Marea de Burbujas | Burbuja (Pez) | Playa | Fácil | — | Charm of Focus, Novice Spell, Lens of Revelation, Papa Bear, Earth Stamp | mochila: 2 comunes |
| **13** | Pinzas | Cangrejo (Bicho) | Playa | Fácil | Mama Bear | Charm of Focus, Novice Spell, Lens of Revelation, Last Gift, Papa Bear, Mama Bear | mochila: 3 comunes |
| **14** | Brotes de Primavera | Musgo (Planta) | Playa | Fácil | — | Charm of Focus, Novice Spell, Lens of Revelation, Last Gift, Earth Stamp, Mama Bear | mochila: 3 comunes |
| **15** | Pico Grande | Pelícano (Pájaro) | Playa | Fácil | — | Charm of Focus, Novice Spell, Lens of Revelation, Papa Bear, Earth Stamp, Mama Bear | mochila: 3 comunes |
| **16** | Paso de Caracol | Ermitaño (Bicho) | Bahía pirata | Fácil | Red Mirror | Charm of Focus, Novice Spell, Lens of Revelation, Last Gift, Papa Bear, Red Mirror | mochila: 3 comunes |
| **17** | Tinta | Calamar (Pez) | Bahía pirata | Fácil | — | Charm of Focus, Novice Spell, Lens of Revelation, Earth Stamp, Mama Bear, Red Mirror | mochila: 4 comunes |
| **18** | Caparazón de Espinas | Tortuga (Reptil) | Bahía pirata | Fácil | — | Charm of Focus, Novice Spell, Last Gift, Papa Bear, Earth Stamp, Mama Bear | mochila: 4 comunes |
| **19** | Marea Baja | Alga (Planta) | Bahía pirata | Fácil | Bloodpact | Charm of Focus, Novice Spell, Lens of Revelation, Last Gift, Red Mirror, Bloodpact | mochila: 4 comunes |
| **20** | **Jefe: Solazo, Rey de la Playa** | Solazo (Bestia) | Bahía pirata | Fácil | — | Charm of Focus, Novice Spell, Papa Bear, Earth Stamp, Mama Bear, Red Mirror | 160 de vida · cuerpo y partes de verano · amuletos: Charm of Focus, Novice Spell · mochila: 1 poco común + 3 comunes |
| **21** | Guardia de Invierno | Pino (Planta) | Bosque nevado | Normal | — | Charm of Focus, Novice Spell, Lens of Revelation, Last Gift, Papa Bear, Bloodpact | 130 de vida · mochila: 4 comunes |
| **22** | Bomba de Hielo | Témpano (Pez) | Bosque nevado | Normal | Scotch Tape | Charm of Focus, Novice Spell, Earth Stamp, Mama Bear, Red Mirror, Scotch Tape | 130 de vida · mochila: 4 comunes |
| **23** | Ojos en la Noche | Búho (Pájaro) | Bosque nevado | Normal | — | Charm of Focus, Lens of Revelation, Last Gift, Papa Bear, Earth Stamp, Bloodpact | 130 de vida · mochila: 1 poco común + 3 comunes |
| **24** | Colmillo Helado | Ventisca (Bestia) | Bosque nevado | Normal | — | Charm of Focus, Novice Spell, Lens of Revelation, Mama Bear, Red Mirror, Scotch Tape | 130 de vida · mochila: 1 poco común + 3 comunes |
| **25** | Hielo Fino | Foca (Pez) | Bosque nevado | Normal | Energy Drink S | Charm of Focus, Last Gift, Papa Bear, Earth Stamp, Bloodpact, Energy Drink S | 130 de vida · mochila: 1 poco común + 3 comunes |
| **26** | Escáner de Escarcha | Escarcha (Bicho) | Bosque nevado | Normal | — | Novice Spell, Lens of Revelation, Last Gift, Mama Bear, Red Mirror, Scotch Tape | 130 de vida · mochila: 1 poco común + 3 comunes |
| **27** | Cuernos de Escarcha | Reno (Bestia) | Bosque nevado | Normal | — | Charm of Focus, Novice Spell, Papa Bear, Earth Stamp, Bloodpact, Energy Drink S | 130 de vida · mochila: 2 poco comunes + 2 comunes |
| **28** | Filo de Carámbano | Carámbano (Reptil) | Bosque nevado | Normal | Black Sage | Lens of Revelation, Last Gift, Mama Bear, Red Mirror, Scotch Tape, Black Sage | 130 de vida · mochila: 2 poco comunes + 2 comunes |
| **29** | Bayas Rojas | Acebo (Planta) | Bosque nevado | Normal | — | Charm of Focus, Novice Spell, Lens of Revelation, Papa Bear, Earth Stamp, Bloodpact | 130 de vida · mochila: 2 poco comunes + 2 comunes |
| **30** | **Jefe: Nevisca, la Tormenta Blanca** | Nevisca (Pájaro) | Bosque nevado | Normal | — | Last Gift, Mama Bear, Red Mirror, Scotch Tape, Energy Drink S, Black Sage | 155 de vida · cuerpo de escarcha y partes Xmas · amuleto: Last Gift · 1 parte evolucionada · mochila: 1 poco común + 3 comunes |
| **31** | Plumas Negras | Cuervo (Pájaro) | Guarida | Normal | — | Charm of Focus, Novice Spell, Lens of Revelation, Papa Bear, Earth Stamp, Red Mirror | 140 de vida · 1 parte evolucionada · mochila: 2 poco comunes + 2 comunes |
| **32** | Hiedra Roja | Hiedra (Planta) | Guarida | Normal | — | Last Gift, Mama Bear, Bloodpact, Scotch Tape, Energy Drink S, Black Sage | 140 de vida · 1 parte evolucionada · mochila: 2 poco comunes + 2 comunes |
| **33** | Telaraña | Araña (Bicho) | Guarida | Normal | Leafy Pot | Charm of Focus, Novice Spell, Lens of Revelation, Papa Bear, Earth Stamp, Leafy Pot | 140 de vida · 1 parte evolucionada · mochila: 2 poco comunes + 2 comunes |
| **34** | Aguas Profundas | Abisal (Pez) | Guarida | Normal | — | Last Gift, Mama Bear, Red Mirror, Bloodpact, Scotch Tape, Energy Drink S | 140 de vida · 1 parte evolucionada · mochila: 2 poco comunes + 2 comunes |
| **35** | Alas de Cuero | Murciélago (Pájaro) | Guarida | Normal | — | Charm of Focus, Novice Spell, Lens of Revelation, Papa Bear, Earth Stamp, Black Sage | 140 de vida · 1 parte evolucionada · mochila: 3 poco comunes + 1 común |
| **36** | Aullido | Lobo (Bestia) | Guarida | Normal | — | Last Gift, Mama Bear, Red Mirror, Bloodpact, Scotch Tape, Leafy Pot | 140 de vida · 1 parte evolucionada · mochila: 3 poco comunes + 1 común |
| **37** | Esporas | Hongo (Planta) | Guarida | Normal | — | Charm of Focus, Novice Spell, Lens of Revelation, Papa Bear, Earth Stamp, Energy Drink S | 140 de vida · 1 parte evolucionada · mochila: 3 poco comunes + 1 común |
| **38** | Guantes Venenosos | Mamba (Reptil) | Guarida | Normal | Feather Earring | Last Gift, Mama Bear, Red Mirror, Bloodpact, Black Sage, Feather Earring | 140 de vida · 1 parte evolucionada · mochila: 3 poco comunes + 1 común |
| **39** | Descarga | Anguila (Pez) | Guarida | Normal | — | Charm of Focus, Novice Spell, Lens of Revelation, Papa Bear, Scotch Tape, Leafy Pot | 140 de vida · 1 parte evolucionada · mochila: 4 poco comunes |
| **40** | **Jefe: Umbra, la Pesadilla** | Umbra (Bicho) | Guarida | Normal | — | Last Gift, Earth Stamp, Mama Bear, Red Mirror, Bloodpact, Energy Drink S | 160 de vida · cuerpo de pesadilla, partes Japan y Agamo · amuletos: Last Gift, Earth Stamp · 1 parte evolucionada · mochila: 1 rara + 3 poco comunes |
| **41** | Martillo del Cielo | Halcón (Pájaro) | Coliseo | Normal | — | Charm of Focus, Novice Spell, Lens of Revelation, Papa Bear, Black Sage, Feather Earring | 1 parte evolucionada · mochila: 4 poco comunes |
| **42** | Flor de Loto | Loto (Planta) | Coliseo | Normal | — | Last Gift, Earth Stamp, Mama Bear, Red Mirror, Scotch Tape, Leafy Pot | 1 parte evolucionada · mochila: 4 poco comunes |
| **43** | Aguijón | Escorpión (Bicho) | Coliseo | Normal | Hidden Razor | Charm of Focus, Novice Spell, Lens of Revelation, Bloodpact, Energy Drink S, Hidden Razor | 1 parte evolucionada · mochila: 1 rara + 3 poco comunes |
| **44** | El Kraken | Kraken (Pez) | Coliseo | Normal | — | Last Gift, Papa Bear, Earth Stamp, Mama Bear, Black Sage, Feather Earring | 1 parte evolucionada · mochila: 1 rara + 3 poco comunes |
| **45** | Ojos de Serpiente | Cobra (Reptil) | Coliseo | Normal | — | Charm of Focus, Novice Spell, Lens of Revelation, Red Mirror, Scotch Tape, Leafy Pot | 1 parte evolucionada · mochila: 1 rara + 3 poco comunes |
| **46** | Furia Desatada | Furia (Bestia) | Coliseo | Normal | — | Last Gift, Papa Bear, Earth Stamp, Bloodpact, Energy Drink S, Hidden Razor | 1 parte evolucionada · mochila: 1 rara + 3 poco comunes |
| **47** | Garras del Cielo | Grifo (Pájaro) | Coliseo | Normal | — | Charm of Focus, Novice Spell, Lens of Revelation, Mama Bear, Black Sage, Feather Earring | 1 parte evolucionada · mochila: 2 raras + 2 poco comunes |
| **48** | El Truco de la Mantis | Mantis (Bicho) | Coliseo | Normal | Mantis Dagger | Last Gift, Papa Bear, Red Mirror, Scotch Tape, Leafy Pot, Mantis Dagger | 1 parte evolucionada · mochila: 2 raras + 2 poco comunes |
| **49** | Espinas del Desierto | Cactus (Planta) | Coliseo | Normal | — | Charm of Focus, Novice Spell, Earth Stamp, Bloodpact, Energy Drink S, Hidden Razor | 1 parte evolucionada · mochila: 2 raras + 2 poco comunes |
| **50** | **Jefe: Basilisco Místico** | Basilisco (Reptil) | Coliseo | Normal | — | Lens of Revelation, Last Gift, Papa Bear, Mama Bear, Black Sage, Feather Earring | 190 de vida · cuerpo y partes místicas · amuletos: Lens of Revelation, Last Gift, Papa Bear · 1 parte evolucionada · mochila: 3 raras + 1 poco común |
| **51** | Más Allá del Coliseo | Ciervo (Bestia) | Bosque de otoño | Normal | — | Charm of Focus, Novice Spell, Red Mirror, Scotch Tape, Leafy Pot, Mantis Dagger | 1 parte evolucionada · mochila: 3 raras + 1 poco común |
| **52** | Hojas que Crujen | Hojarasca (Planta) | Bosque de otoño | Normal | — | Lens of Revelation, Last Gift, Earth Stamp, Bloodpact, Energy Drink S, Hidden Razor | 1 parte evolucionada · mochila: 3 raras + 1 poco común |
| **53** | Caparazón Dorado | Escarabajo (Bicho) | Bosque de otoño | Normal | Poison Vial | Charm of Focus, Papa Bear, Mama Bear, Black Sage, Feather Earring, Poison Vial | 1 parte evolucionada · mochila: 3 raras + 1 poco común |
| **54** | Ojos de Lechuza | Lechuza (Pájaro) | Bosque de otoño | Normal | — | Novice Spell, Lens of Revelation, Red Mirror, Scotch Tape, Leafy Pot, Mantis Dagger | 1 parte evolucionada · mochila: 3 raras + 1 poco común |
| **55** | Charco de Lluvia | Rana (Pez) | Bosque de otoño | Normal | — | Charm of Focus, Last Gift, Earth Stamp, Bloodpact, Energy Drink S, Hidden Razor | 1 parte evolucionada · mochila: 3 raras + 1 poco común |
| **56** | Cola de Fuego | Salamandra (Reptil) | Bosque de otoño | Normal | — | Novice Spell, Papa Bear, Mama Bear, Black Sage, Feather Earring, Poison Vial | 1 parte evolucionada · mochila: 3 raras + 1 poco común |
| **57** | Embestida | Jabalí (Bestia) | Bosque de otoño | Normal | Sticky Octopus | Lens of Revelation, Red Mirror, Scotch Tape, Leafy Pot, Mantis Dagger, Sticky Octopus | 1 parte evolucionada · mochila: 3 raras + 1 poco común |
| **58** | Luz Entre los Árboles | Luciérnaga (Bicho) | Bosque de otoño | Normal | — | Charm of Focus, Novice Spell, Last Gift, Earth Stamp, Bloodpact, Energy Drink S | 1 parte evolucionada · mochila: 3 raras + 1 poco común |
| **59** | Antes del Guardián | Petirrojo (Pájaro) | Bosque de otoño | Normal | — | Papa Bear, Mama Bear, Black Sage, Feather Earring, Hidden Razor, Poison Vial | 1 parte evolucionada · mochila: 3 raras + 1 poco común |
| **60** | **Jefe: Kodama, el Guardián del Bosque** | Kodama (Planta) | Bosque de otoño | Normal | — | Charm of Focus, Lens of Revelation, Red Mirror, Scotch Tape, Leafy Pot, Mantis Dagger | 190 de vida · 3 partes coleccionables · amuletos: Charm of Focus, Lens of Revelation · 1 parte evolucionada · mochila: 4 raras |
| **61** | Pico de Colores | Tucán (Pájaro) | Jungla | Normal | — | Novice Spell, Last Gift, Earth Stamp, Bloodpact, Energy Drink S, Sticky Octopus | 160 de vida · 1 parte coleccionable · 1 parte evolucionada · mochila: 4 raras |
| **62** | Flor Venenosa | Orquídea (Planta) | Jungla | Normal | Secret Egg | Papa Bear, Mama Bear, Black Sage, Hidden Razor, Poison Vial, Secret Egg | 160 de vida · 1 parte coleccionable · 1 parte evolucionada · mochila: 4 raras |
| **63** | Garras en la Sombra | Jaguar (Bestia) | Jungla | Normal | — | Charm of Focus, Lens of Revelation, Red Mirror, Scotch Tape, Leafy Pot, Feather Earring | 160 de vida · 1 parte coleccionable · 1 parte evolucionada · mochila: 4 raras |
| **64** | Aguas Rápidas | Piraña (Pez) | Jungla | Normal | — | Novice Spell, Last Gift, Earth Stamp, Bloodpact, Energy Drink S, Mantis Dagger | 160 de vida · 1 parte coleccionable · 1 parte evolucionada · mochila: 4 raras |
| **65** | Cambio de Color | Camaleón (Reptil) | Jungla | Normal | — | Papa Bear, Mama Bear, Black Sage, Hidden Razor, Poison Vial, Sticky Octopus | 160 de vida · 1 parte coleccionable · 1 parte evolucionada · mochila: 4 raras |
| **66** | Fila de Hormigas | Hormiga (Bicho) | Jungla | Normal | — | Charm of Focus, Lens of Revelation, Red Mirror, Scotch Tape, Leafy Pot, Secret Egg | 160 de vida · 1 parte coleccionable · 1 parte evolucionada · mochila: 4 raras |
| **67** | Entre Lianas | Liana (Planta) | Jungla | Normal | Bubble Paste | Novice Spell, Last Gift, Earth Stamp, Bloodpact, Feather Earring, Bubble Paste | 160 de vida · 1 parte coleccionable · 1 parte evolucionada · mochila: 4 raras |
| **68** | Grito de la Selva | Guacamayo (Pájaro) | Jungla | Normal | — | Papa Bear, Mama Bear, Energy Drink S, Black Sage, Hidden Razor, Mantis Dagger | 160 de vida · 1 parte coleccionable · 1 parte evolucionada · mochila: 4 raras |
| **69** | Antes de la Reina | Tapir (Bestia) | Jungla | Normal | — | Charm of Focus, Lens of Revelation, Red Mirror, Scotch Tape, Poison Vial, Sticky Octopus | 160 de vida · 1 parte coleccionable · 1 parte evolucionada · mochila: 4 raras |
| **70** | **Jefe: Mantodea, Reina de la Jungla** | Mantodea (Bicho) | Jungla | Normal | — | Novice Spell, Last Gift, Earth Stamp, Bloodpact, Leafy Pot, Secret Egg | 240 de vida · 5 partes coleccionables · amuletos: Novice Spell, Last Gift · 2 partes evolucionadas · mochila: 4 raras |
| **71** | Patas Largas | Garza (Pájaro) | Laguna | Normal | — | Papa Bear, Mama Bear, Energy Drink S, Black Sage, Feather Earring, Bubble Paste | 160 de vida · 1 parte coleccionable · 2 partes evolucionadas · mochila: 4 raras |
| **72** | Juego en el Agua | Nutria (Bestia) | Laguna | Normal | Spring Leaf | Charm of Focus, Lens of Revelation, Red Mirror, Hidden Razor, Mantis Dagger, Spring Leaf | 160 de vida · 1 parte coleccionable · 2 partes evolucionadas · mochila: 4 raras |
| **73** | Vuelo Rasante | Libélula (Bicho) | Laguna | Normal | — | Novice Spell, Last Gift, Earth Stamp, Scotch Tape, Poison Vial, Sticky Octopus | 160 de vida · 1 parte coleccionable · 2 partes evolucionadas · mochila: 4 raras |
| **74** | Orilla de Juncos | Junco (Planta) | Laguna | Normal | — | Papa Bear, Mama Bear, Bloodpact, Energy Drink S, Leafy Pot, Secret Egg | 160 de vida · 1 parte coleccionable · 2 partes evolucionadas · mochila: 4 raras |
| **75** | Sol en la Roca | Galápago (Reptil) | Laguna | Normal | — | Charm of Focus, Lens of Revelation, Red Mirror, Black Sage, Feather Earring, Bubble Paste | 160 de vida · 1 parte coleccionable · 2 partes evolucionadas · mochila: 4 raras |
| **76** | Escamas de Oro | Carpa (Pez) | Laguna | Normal | — | Novice Spell, Last Gift, Earth Stamp, Hidden Razor, Mantis Dagger, Spring Leaf | 160 de vida · 1 parte coleccionable · 2 partes evolucionadas · mochila: 4 raras |
| **77** | Canto de Noche | Sapo (Pez) | Laguna | Normal | Lazy Snail | Papa Bear, Mama Bear, Scotch Tape, Poison Vial, Sticky Octopus, Lazy Snail | 160 de vida · 1 parte coleccionable · 2 partes evolucionadas · mochila: 4 raras |
| **78** | Zumbido | Mosquito (Bicho) | Laguna | Normal | — | Charm of Focus, Lens of Revelation, Bloodpact, Energy Drink S, Leafy Pot, Secret Egg | 160 de vida · 1 parte coleccionable · 2 partes evolucionadas · mochila: 4 raras |
| **79** | Antes de la Dama | Martín (Pájaro) | Laguna | Normal | — | Novice Spell, Last Gift, Red Mirror, Black Sage, Feather Earring, Bubble Paste | 160 de vida · 1 parte coleccionable · 2 partes evolucionadas · mochila: 4 raras |
| **80** | **Jefe: Nenúfar, la Dama del Lago** | Nenúfar (Pez) | Laguna | Normal | — | Papa Bear, Earth Stamp, Mama Bear, Hidden Razor, Mantis Dagger, Spring Leaf | 200 de vida · cuerpo místico, 6 partes coleccionables · amuletos: Papa Bear, Earth Stamp · 2 partes evolucionadas · mochila: 1 épica + 3 raras |
| **81** | Salto del Delfín | Delfín (Pez) | Isla del verano | Normal | — | Charm of Focus, Lens of Revelation, Scotch Tape, Poison Vial, Sticky Octopus, Lazy Snail | 165 de vida · 1 parte coleccionable · 2 partes evolucionadas · mochila: 1 épica + 3 raras |
| **82** | Cáscara Dura | Coco (Planta) | Isla del verano | Normal | Gecko Mask | Novice Spell, Bloodpact, Energy Drink S, Leafy Pot, Secret Egg, Gecko Mask | 165 de vida · 1 parte coleccionable · 2 partes evolucionadas · mochila: 1 épica + 3 raras |
| **83** | Siesta al Sol | Lagartija (Reptil) | Isla del verano | Normal | — | Last Gift, Papa Bear, Red Mirror, Black Sage, Feather Earring, Bubble Paste | 165 de vida · 1 parte coleccionable · 2 partes evolucionadas · mochila: 1 épica + 3 raras |
| **84** | Alas Largas | Albatros (Pájaro) | Isla del verano | Normal | — | Charm of Focus, Earth Stamp, Mama Bear, Hidden Razor, Mantis Dagger, Spring Leaf | 165 de vida · 1 parte coleccionable · 2 partes evolucionadas · mochila: 1 épica + 3 raras |
| **85** | Travesuras | Mono (Bestia) | Isla del verano | Normal | — | Novice Spell, Lens of Revelation, Scotch Tape, Poison Vial, Sticky Octopus, Lazy Snail | 165 de vida · 1 parte coleccionable · 2 partes evolucionadas · mochila: 1 épica + 3 raras |
| **86** | Picadura | Medusa (Pez) | Isla del verano | Normal | — | Last Gift, Bloodpact, Energy Drink S, Leafy Pot, Secret Egg, Gecko Mask | 165 de vida · 1 parte coleccionable · 2 partes evolucionadas · mochila: 1 épica + 3 raras |
| **87** | Flor de Playa | Hibisco (Planta) | Isla del verano | Normal | Charm of Power | Papa Bear, Red Mirror, Black Sage, Feather Earring, Bubble Paste, Charm of Power | 165 de vida · 1 parte coleccionable · 2 partes evolucionadas · mochila: 1 épica + 3 raras |
| **88** | Nido de Avispas | Avispa (Bicho) | Isla del verano | Normal | — | Charm of Focus, Novice Spell, Earth Stamp, Mama Bear, Hidden Razor, Mantis Dagger | 165 de vida · 1 parte coleccionable · 2 partes evolucionadas · mochila: 1 épica + 3 raras |
| **89** | Antes del Verano | Iguana (Reptil) | Isla del verano | Normal | — | Lens of Revelation, Scotch Tape, Poison Vial, Sticky Octopus, Spring Leaf, Lazy Snail | 165 de vida · 1 parte coleccionable · 2 partes evolucionadas · mochila: 1 épica + 3 raras |
| **90** | **Jefe: Verano, el Sol de la Isla** | Verano (Bestia) | Isla del verano | Normal | — | Last Gift, Papa Bear, Bloodpact, Energy Drink S, Leafy Pot, Secret Egg | 205 de vida · cuerpo de verano, 3 partes coleccionables · amuleto: Last Gift · 2 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **91** | Rey de la Meseta | León (Bestia) | Meseta | Normal | — | Red Mirror, Black Sage, Feather Earring, Bubble Paste, Gecko Mask, Charm of Power | 165 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 1 épica + 3 raras |
| **92** | Círculos en el Cielo | Buitre (Pájaro) | Meseta | Normal | Sleepy Guard | Charm of Focus, Novice Spell, Earth Stamp, Mama Bear, Hidden Razor, Sleepy Guard | 165 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 1 épica + 3 raras |
| **93** | Centinela | Suricata (Bestia) | Meseta | Normal | — | Lens of Revelation, Scotch Tape, Mantis Dagger, Poison Vial, Sticky Octopus, Spring Leaf | 165 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 1 épica + 3 raras |
| **94** | Árbol Viejo | Baobab (Planta) | Meseta | Normal | — | Last Gift, Papa Bear, Bloodpact, Energy Drink S, Leafy Pot, Lazy Snail | 165 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 1 épica + 3 raras |
| **95** | Bajo la Tierra | Termita (Bicho) | Meseta | Normal | — | Red Mirror, Black Sage, Secret Egg, Bubble Paste, Gecko Mask, Charm of Power | 165 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 1 épica + 3 raras |
| **96** | Carrera | Avestruz (Pájaro) | Meseta | Normal | — | Charm of Focus, Novice Spell, Earth Stamp, Mama Bear, Feather Earring, Hidden Razor | 165 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 1 épica + 3 raras |
| **97** | Salto Largo | Gacela (Bestia) | Meseta | Normal | Bubble Maker | Lens of Revelation, Scotch Tape, Mantis Dagger, Poison Vial, Sleepy Guard, Bubble Maker | 165 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 1 épica + 3 raras |
| **98** | Orilla del Río | Cocodrilo (Reptil) | Meseta | Normal | — | Last Gift, Papa Bear, Bloodpact, Energy Drink S, Sticky Octopus, Spring Leaf | 165 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 1 épica + 3 raras |
| **99** | Antes de Sauria | Hipopótamo (Pez) | Meseta | Normal | — | Red Mirror, Black Sage, Leafy Pot, Secret Egg, Bubble Paste, Lazy Snail | 165 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 1 épica + 3 raras |
| **100** | **Jefe: Sauria, la Escama del Sol** | Sauria (Reptil) | Meseta | Normal | — | Charm of Focus, Novice Spell, Earth Stamp, Mama Bear, Gecko Mask, Charm of Power | 235 de vida · cuerpo de verano, 6 partes coleccionables · amuletos: Charm of Focus, Novice Spell · 2 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **101** | Aullido Rojo | Coyote (Bestia) | Cañón | Normal | — | Lens of Revelation, Scotch Tape, Feather Earring, Hidden Razor, Mantis Dagger, Poison Vial | 170 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **102** | Polvo en el Camino | Correcaminos (Pájaro) | Cañón | Normal | Raging Dagger | Last Gift, Papa Bear, Bloodpact, Sleepy Guard, Bubble Maker, Raging Dagger | 170 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **103** | Cien Patas | Ciempiés (Bicho) | Cañón | Normal | — | Red Mirror, Energy Drink S, Black Sage, Sticky Octopus, Secret Egg, Spring Leaf | 170 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **104** | Flor de Espinas | Cardo (Planta) | Cañón | Normal | — | Charm of Focus, Novice Spell, Earth Stamp, Leafy Pot, Bubble Paste, Lazy Snail | 170 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **105** | Mordida Lenta | Gila (Reptil) | Cañón | Normal | — | Lens of Revelation, Mama Bear, Scotch Tape, Feather Earring, Gecko Mask, Charm of Power | 170 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **106** | Pozo Escondido | Ajolote (Pez) | Cañón | Normal | Metal Scanner | Last Gift, Papa Bear, Bloodpact, Hidden Razor, Poison Vial, Metal Scanner | 170 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **107** | Salto desde la Roca | Puma (Bestia) | Cañón | Normal | — | Red Mirror, Energy Drink S, Mantis Dagger, Sleepy Guard, Bubble Maker, Raging Dagger | 170 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **108** | Cola Levantada | Alacrán (Bicho) | Cañón | Normal | — | Charm of Focus, Novice Spell, Black Sage, Sticky Octopus, Secret Egg, Spring Leaf | 170 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **109** | Antes del Cóndor | Cernícalo (Pájaro) | Cañón | Normal | — | Lens of Revelation, Earth Stamp, Mama Bear, Leafy Pot, Bubble Paste, Lazy Snail | 170 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **110** | **Jefe: Carmín, el Cóndor Rojo** | Carmín (Pájaro) | Cañón | Normal | — | Last Gift, Papa Bear, Scotch Tape, Feather Earring, Gecko Mask, Charm of Power | 215 de vida · cuerpo místico, 6 partes coleccionables · amuletos: Last Gift, Papa Bear · 2 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **111** | Sobre las Nubes | Colibrí (Pájaro) | Cielo | Normal | Sharp Edge | Red Mirror, Bloodpact, Energy Drink S, Hidden Razor, Metal Scanner, Sharp Edge | 170 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **112** | Semillas al Viento | Algodón (Planta) | Cielo | Normal | — | Charm of Focus, Mantis Dagger, Poison Vial, Sleepy Guard, Bubble Maker, Raging Dagger | 170 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **113** | Alas de Papel | Mariposa (Bicho) | Cielo | Normal | — | Novice Spell, Lens of Revelation, Black Sage, Sticky Octopus, Secret Egg, Spring Leaf | 170 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **114** | Galope Celeste | Potrillo (Bestia) | Cielo | Normal | — | Last Gift, Earth Stamp, Mama Bear, Leafy Pot, Bubble Paste, Lazy Snail | 170 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **115** | Nube de Lluvia | Nimbo (Pez) | Cielo | Normal | — | Papa Bear, Red Mirror, Scotch Tape, Feather Earring, Gecko Mask, Charm of Power | 170 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **116** | Cola de Luz | Cometa (Pájaro) | Cielo | Normal | Storm Shuriken | Bloodpact, Energy Drink S, Hidden Razor, Metal Scanner, Sharp Edge, Storm Shuriken | 170 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **117** | Primer Vuelo | Dragoncito (Reptil) | Cielo | Normal | — | Charm of Focus, Novice Spell, Mantis Dagger, Poison Vial, Sleepy Guard, Bubble Maker | 170 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **118** | Panal en las Nubes | Abeja (Bicho) | Cielo | Normal | — | Lens of Revelation, Black Sage, Sticky Octopus, Secret Egg, Spring Leaf, Raging Dagger | 170 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **119** | Antes de la Flor | Brisa (Planta) | Cielo | Normal | — | Last Gift, Papa Bear, Earth Stamp, Mama Bear, Leafy Pot, Bubble Paste | 170 de vida · 2 partes coleccionables · 2 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **120** | **Jefe: Celeste, la Flor del Cielo** | Celeste (Planta) | Cielo | Normal | — | Red Mirror, Scotch Tape, Feather Earring, Lazy Snail, Gecko Mask, Charm of Power | 235 de vida · cuerpo místico, 6 partes coleccionables · amuletos: Red Mirror, Scotch Tape · 3 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **121** | Túneles | Topo (Bestia) | Caverna | Normal | Feather Fan | Bloodpact, Energy Drink S, Hidden Razor, Metal Scanner, Sharp Edge, Feather Fan | 175 de vida · 2 partes coleccionables · 3 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **122** | Tierra Blanda | Gusano (Bicho) | Caverna | Normal | — | Charm of Focus, Novice Spell, Mantis Dagger, Poison Vial, Sleepy Guard, Storm Shuriken | 175 de vida · 2 partes coleccionables · 3 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **123** | Pez sin Ojos | Cristalino (Pez) | Caverna | Normal | — | Lens of Revelation, Black Sage, Secret Egg, Spring Leaf, Bubble Maker, Raging Dagger | 175 de vida · 2 partes coleccionables · 3 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **124** | Bajo Tierra | Trufa (Planta) | Caverna | Normal | — | Last Gift, Papa Bear, Earth Stamp, Mama Bear, Leafy Pot, Sticky Octopus | 175 de vida · 2 partes coleccionables · 3 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **125** | Pegado al Techo | Geco (Reptil) | Caverna | Normal | — | Red Mirror, Scotch Tape, Feather Earring, Bubble Paste, Lazy Snail, Gecko Mask | 175 de vida · 2 partes coleccionables · 3 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **126** | Telas en la Cueva | Tarántula (Bicho) | Caverna | Normal | Red Sage | Bloodpact, Energy Drink S, Charm of Power, Metal Scanner, Sharp Edge, Red Sage | 175 de vida · 2 partes coleccionables · 3 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **127** | Hibernación | Oso (Bestia) | Caverna | Normal | — | Charm of Focus, Novice Spell, Hidden Razor, Mantis Dagger, Poison Vial, Feather Fan | 175 de vida · 2 partes coleccionables · 3 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **128** | Musgo Brillante | Liquen (Planta) | Caverna | Normal | — | Lens of Revelation, Black Sage, Sleepy Guard, Bubble Maker, Raging Dagger, Storm Shuriken | 175 de vida · 2 partes coleccionables · 3 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **129** | Antes del Ojo | Vencejo (Pájaro) | Caverna | Normal | — | Last Gift, Papa Bear, Earth Stamp, Mama Bear, Secret Egg, Spring Leaf | 175 de vida · 2 partes coleccionables · 3 partes evolucionadas · mochila: 2 épicas + 2 raras |
| **130** | **Jefe: Óculo, el Ojo de la Caverna** | Óculo (Bicho) | Caverna | Normal | — | Red Mirror, Scotch Tape, Leafy Pot, Feather Earring, Sticky Octopus, Lazy Snail | 245 de vida · cuerpo de pesadilla, 6 partes coleccionables · amuletos: Red Mirror, Scotch Tape, Leafy Pot · 3 partes evolucionadas · mochila: 3 épicas + 1 rara |
| **131** | La CPU Despierta | Camello (Bestia) | Desierto | Dura | Paralyzing Jellyfish | Bloodpact, Energy Drink S, Gecko Mask, Charm of Power, Metal Scanner, Paralyzing Jellyfish | 180 de vida · 3 partes coleccionables · 3 partes evolucionadas · mochila: 3 épicas + 1 rara |
| **132** | Vista de Arriba | Gavilán (Pájaro) | Desierto | Dura | — | Charm of Focus, Novice Spell, Hidden Razor, Bubble Paste, Sharp Edge, Red Sage | 180 de vida · 3 partes coleccionables · 3 partes evolucionadas · mochila: 3 épicas + 1 rara |
| **133** | Bola de Arena | Escarabeo (Bicho) | Desierto | Dura | — | Lens of Revelation, Black Sage, Mantis Dagger, Poison Vial, Sleepy Guard, Feather Fan | 180 de vida · 3 partes coleccionables · 3 partes evolucionadas · mochila: 3 épicas + 1 rara |
| **134** | Gigante Espinoso | Saguaro (Planta) | Desierto | Dura | — | Last Gift, Papa Bear, Earth Stamp, Bubble Maker, Raging Dagger, Storm Shuriken | 180 de vida · 3 partes coleccionables · 3 partes evolucionadas · mochila: 3 épicas + 1 rara |
| **135** | Aviso de Cola | Cascabel (Reptil) | Desierto | Dura | — | Mama Bear, Red Mirror, Scotch Tape, Sticky Octopus, Secret Egg, Spring Leaf | 180 de vida · 3 partes coleccionables (una Shiny) · 3 partes evolucionadas · mochila: 3 épicas + 1 rara |
| **136** | Orejas Grandes | Fénec (Bestia) | Desierto | Dura | Energy Drink M | Bloodpact, Energy Drink S, Leafy Pot, Feather Earring, Lazy Snail, Energy Drink M | 180 de vida · 3 partes coleccionables (una Shiny) · 3 partes evolucionadas · mochila: 3 épicas + 1 rara |
| **137** | Agua que No Está | Espejismo (Pez) | Desierto | Dura | — | Charm of Focus, Novice Spell, Gecko Mask, Charm of Power, Metal Scanner, Paralyzing Jellyfish | 180 de vida · 3 partes coleccionables · 3 partes evolucionadas · mochila: 3 épicas + 1 rara |
| **138** | Plaga | Chapulín (Bicho) | Desierto | Dura | — | Lens of Revelation, Black Sage, Hidden Razor, Bubble Paste, Sharp Edge, Red Sage | 180 de vida · 3 partes coleccionables · 3 partes evolucionadas · mochila: 3 épicas + 1 rara |
| **139** | Antes del Faraón | Agave (Planta) | Desierto | Dura | — | Last Gift, Papa Bear, Mantis Dagger, Poison Vial, Sleepy Guard, Feather Fan | 180 de vida · 3 partes coleccionables · 3 partes evolucionadas · mochila: 3 épicas + 1 rara |
| **140** | **Jefe: Faraón, el Escamado** | Faraón (Reptil) | Desierto | Dura | — | Earth Stamp, Mama Bear, Red Mirror, Bubble Maker, Raging Dagger, Storm Shuriken | 230 de vida · cuerpo de verano, 6 partes coleccionables · amuletos: Earth Stamp, Mama Bear, Red Mirror · 3 partes evolucionadas · mochila: 4 épicas |
| **141** | Río de Lava | Magma (Reptil) | Ocaso | Dura | Gloves of Infection | Bloodpact, Scotch Tape, Sticky Octopus, Secret Egg, Spring Leaf, Gloves of Infection | 180 de vida · 3 partes coleccionables (una Shiny) · 3 partes evolucionadas · mochila: 4 épicas |
| **142** | Renacer | Fénix (Pájaro) | Ocaso | Dura | — | Charm of Focus, Energy Drink S, Leafy Pot, Feather Earring, Lazy Snail, Energy Drink M | 180 de vida · 3 partes coleccionables · 3 partes evolucionadas · mochila: 4 épicas |
| **143** | Chispas | Brasa (Bicho) | Ocaso | Dura | — | Novice Spell, Lens of Revelation, Gecko Mask, Charm of Power, Metal Scanner, Paralyzing Jellyfish | 180 de vida · 3 partes coleccionables · 3 partes evolucionadas · mochila: 4 épicas |
| **144** | Después del Fuego | Ceniza (Planta) | Ocaso | Dura | — | Last Gift, Black Sage, Hidden Razor, Bubble Paste, Sharp Edge, Red Sage | 180 de vida · 3 partes coleccionables · 3 partes evolucionadas · mochila: 4 épicas |
| **145** | Cueva Caliente | Tejón (Bestia) | Ocaso | Dura | — | Papa Bear, Earth Stamp, Mantis Dagger, Poison Vial, Sleepy Guard, Feather Fan | 180 de vida · 3 partes coleccionables · 3 partes evolucionadas · mochila: 4 épicas |
| **146** | Niebla Roja | Vapor (Pez) | Ocaso | Dura | Cocoon Whistle | Mama Bear, Red Mirror, Bubble Maker, Raging Dagger, Storm Shuriken, Cocoon Whistle | 180 de vida · 3 partes coleccionables (una Shiny) · 3 partes evolucionadas · mochila: 4 épicas |
| **147** | Piedra Negra | Obsidiana (Reptil) | Ocaso | Dura | — | Charm of Focus, Bloodpact, Scotch Tape, Sticky Octopus, Secret Egg, Spring Leaf | 180 de vida · 3 partes coleccionables · 3 partes evolucionadas · mochila: 4 épicas |
| **148** | Canto del Ocaso | Mirlo (Pájaro) | Ocaso | Dura | — | Energy Drink S, Leafy Pot, Feather Earring, Lazy Snail, Energy Drink M, Gloves of Infection | 180 de vida · 3 partes coleccionables · 3 partes evolucionadas · mochila: 4 épicas |
| **149** | Antes de Behemot | Espina (Planta) | Ocaso | Dura | — | Novice Spell, Lens of Revelation, Last Gift, Gecko Mask, Charm of Power, Metal Scanner | 180 de vida · 3 partes coleccionables · 3 partes evolucionadas · mochila: 4 épicas |
| **150** | **Jefe: Behemot del Ocaso** | Behemot (Bestia) | Ocaso | Dura | — | Papa Bear, Black Sage, Hidden Razor, Sharp Edge, Red Sage, Paralyzing Jellyfish | 235 de vida · cuerpo de pesadilla, 6 partes coleccionables (1 Shiny) · amuletos: Papa Bear, Black Sage · 4 partes evolucionadas · mochila: 4 épicas |
| **151** | Bajo la Luna | Zorro (Bestia) | Bosque nocturno | Dura | Flamingo Hammer | Earth Stamp, Mantis Dagger, Poison Vial, Bubble Paste, Sleepy Guard, Flamingo Hammer | 180 de vida · 3 partes coleccionables (una Shiny) · 3 partes evolucionadas · mochila: 4 épicas |
| **152** | Silencio | Mochuelo (Pájaro) | Bosque nocturno | Dura | — | Mama Bear, Red Mirror, Bubble Maker, Raging Dagger, Feather Fan, Cocoon Whistle | 180 de vida · 3 partes coleccionables · 3 partes evolucionadas · mochila: 4 épicas |
| **153** | Polilla de la Noche | Esfinge (Bicho) | Bosque nocturno | Dura | — | Charm of Focus, Bloodpact, Scotch Tape, Sticky Octopus, Spring Leaf, Storm Shuriken | 180 de vida · 3 partes coleccionables · 3 partes evolucionadas · mochila: 4 épicas |
| **154** | Flor Oscura | Belladona (Planta) | Bosque nocturno | Dura | — | Energy Drink S, Leafy Pot, Secret Egg, Lazy Snail, Energy Drink M, Gloves of Infection | 180 de vida · 3 partes coleccionables · 3 partes evolucionadas · mochila: 4 épicas |
| **155** | Lago de Estrellas | Tritón (Pez) | Bosque nocturno | Dura | Mít's Comfy Pillow | Novice Spell, Lens of Revelation, Last Gift, Feather Earring, Gecko Mask, Mít's Comfy Pillow | 180 de vida · 3 partes coleccionables · 3 partes evolucionadas · mochila: 4 épicas |
| **156** | Abrazo | Boa (Reptil) | Bosque nocturno | Dura | — | Papa Bear, Black Sage, Charm of Power, Metal Scanner, Sharp Edge, Red Sage | 180 de vida · 3 partes coleccionables · 3 partes evolucionadas · mochila: 4 épicas |
| **157** | Ojos en la Rama | Lince (Bestia) | Bosque nocturno | Dura | — | Earth Stamp, Hidden Razor, Mantis Dagger, Poison Vial, Sleepy Guard, Paralyzing Jellyfish | 180 de vida · 3 partes coleccionables · 3 partes evolucionadas · mochila: 4 épicas |
| **158** | Faro Verde | Cocuyo (Bicho) | Bosque nocturno | Dura | — | Mama Bear, Red Mirror, Bubble Paste, Raging Dagger, Cocoon Whistle, Flamingo Hammer | 180 de vida · 3 partes coleccionables · 3 partes evolucionadas · mochila: 4 épicas |
| **159** | Antes del Leviatán | Mandrágora (Planta) | Bosque nocturno | Dura | — | Charm of Focus, Bloodpact, Scotch Tape, Spring Leaf, Bubble Maker, Feather Fan | 180 de vida · 3 partes coleccionables · 3 partes evolucionadas · mochila: 4 épicas |
| **160** | **Jefe: Leviatán de la Noche** | Leviatán (Pez) | Bosque nocturno | Dura | Red Bubble | Energy Drink S, Leafy Pot, Lazy Snail, Storm Shuriken, Energy Drink M, Red Bubble | 240 de vida · cuerpo místico, 6 partes coleccionables (1 Shiny) · amuletos: Red Bubble, Energy Drink S · 4 partes evolucionadas · mochila: 4 épicas |
| **161** | La Primera Legendaria | Polar (Bestia) | Salón de invierno | Dura | — | Novice Spell, Lens of Revelation, Last Gift, Sticky Octopus, Secret Egg, Gloves of Infection | 190 de vida · 4 partes coleccionables (una Shiny) · 4 partes evolucionadas · mochila: 4 épicas |
| **162** | Deslizarse | Pingüino (Pájaro) | Salón de invierno | Dura | — | Papa Bear, Black Sage, Feather Earring, Gecko Mask, Charm of Power, Mít's Comfy Pillow | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 4 épicas |
| **163** | Bajo el Muérdago | Muérdago (Planta) | Salón de invierno | Dura | — | Earth Stamp, Hidden Razor, Metal Scanner, Sharp Edge, Red Sage, Paralyzing Jellyfish | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 4 épicas |
| **164** | Colmillos de Hielo | Morsa (Pez) | Salón de invierno | Dura | — | Mama Bear, Red Mirror, Mantis Dagger, Poison Vial, Bubble Paste, Sleepy Guard | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 4 épicas |
| **165** | Bolita | Cochinilla (Bicho) | Salón de invierno | Dura | Mask of Frenzy | Charm of Focus, Bloodpact, Scotch Tape, Cocoon Whistle, Flamingo Hammer, Mask of Frenzy | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 4 épicas |
| **166** | Aliento Frío | Escarcho (Reptil) | Salón de invierno | Dura | — | Energy Drink S, Spring Leaf, Lazy Snail, Bubble Maker, Raging Dagger, Feather Fan | 190 de vida · 4 partes coleccionables (una Shiny) · 4 partes evolucionadas · mochila: 4 épicas |
| **167** | Cornamenta | Alce (Bestia) | Salón de invierno | Dura | — | Novice Spell, Lens of Revelation, Leafy Pot, Storm Shuriken, Energy Drink M, Red Bubble | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 4 épicas |
| **168** | Adornos | Abeto (Planta) | Salón de invierno | Dura | — | Last Gift, Papa Bear, Black Sage, Sticky Octopus, Secret Egg, Gloves of Infection | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 4 épicas |
| **169** | Antes de la Estrella | Cardenal (Pájaro) | Salón de invierno | Dura | — | Earth Stamp, Feather Earring, Gecko Mask, Charm of Power, Metal Scanner, Mít's Comfy Pillow | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 4 épicas |
| **170** | **Jefe: Estrella, el Ave de Navidad** | Estrella (Pájaro) | Salón de invierno | Dura | Trickster's Card | Mama Bear, Hidden Razor, Sharp Edge, Red Sage, Paralyzing Jellyfish, Trickster's Card | 245 de vida · cuerpo de escarcha, 6 partes coleccionables · amuletos: Trickster's Card, Mama Bear · 4 partes evolucionadas · mochila: 1 legendaria + 3 épicas |
| **171** | Ajuste Fino | Tuerca (Bicho) | Engranajes | Dura | — | Charm of Focus, Red Mirror, Mantis Dagger, Poison Vial, Bubble Paste, Sleepy Guard | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 1 legendaria + 3 épicas |
| **172** | Rebote | Resorte (Bestia) | Engranajes | Dura | — | Bloodpact, Scotch Tape, Energy Drink S, Cocoon Whistle, Flamingo Hammer, Mask of Frenzy | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 1 legendaria + 3 épicas |
| **173** | Viento de Metal | Veleta (Pájaro) | Engranajes | Dura | — | Novice Spell, Spring Leaf, Lazy Snail, Bubble Maker, Raging Dagger, Feather Fan | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 1 legendaria + 3 épicas |
| **174** | Paciencia | Bonsái (Planta) | Engranajes | Dura | — | Lens of Revelation, Last Gift, Leafy Pot, Storm Shuriken, Energy Drink M, Red Bubble | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 1 legendaria + 3 épicas |
| **175** | Bajo Presión | Escafandra (Pez) | Engranajes | Dura | Viper's Venom | Papa Bear, Earth Stamp, Black Sage, Sticky Octopus, Secret Egg, Viper's Venom | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 1 legendaria + 3 épicas |
| **176** | Rosca | Tornillo (Reptil) | Engranajes | Dura | — | Mama Bear, Feather Earring, Charm of Power, Metal Scanner, Gloves of Infection, Mít's Comfy Pillow | 190 de vida · 4 partes coleccionables (una Shiny) · 4 partes evolucionadas · mochila: 1 legendaria + 3 épicas |
| **177** | Golpe Hidráulico | Pistón (Bestia) | Engranajes | Dura | — | Charm of Focus, Hidden Razor, Gecko Mask, Red Sage, Paralyzing Jellyfish, Trickster's Card | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 1 legendaria + 3 épicas |
| **178** | Ruido de Fábrica | Cigarra (Bicho) | Engranajes | Dura | — | Red Mirror, Bloodpact, Mantis Dagger, Bubble Paste, Sleepy Guard, Sharp Edge | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 1 legendaria + 3 épicas |
| **179** | Antes del Autómata | Cuco (Pájaro) | Engranajes | Dura | — | Scotch Tape, Energy Drink S, Poison Vial, Cocoon Whistle, Flamingo Hammer, Mask of Frenzy | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 1 legendaria + 3 épicas |
| **180** | **Jefe: Autómata, el Corazón de Acero** | Autómata (Bicho) | Engranajes | Dura | — | Novice Spell, Lens of Revelation, Spring Leaf, Lazy Snail, Bubble Maker, Raging Dagger | 270 de vida · cuerpo místico, 6 partes coleccionables · amuletos: Novice Spell, Lens of Revelation, Spring Leaf · 4 partes evolucionadas · mochila: 2 legendarias + 2 épicas |
| **181** | Alas de Agua | Manta (Pez) | Mar violeta | Dura | — | Last Gift, Papa Bear, Leafy Pot, Feather Fan, Energy Drink M, Red Bubble | 190 de vida · 4 partes coleccionables (una Shiny) · 4 partes evolucionadas · mochila: 2 legendarias + 2 épicas |
| **182** | Arrecife | Coral (Planta) | Mar violeta | Dura | — | Earth Stamp, Mama Bear, Black Sage, Sticky Octopus, Storm Shuriken, Viper's Venom | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 2 legendarias + 2 épicas |
| **183** | Eco del Mar | Caracola (Bicho) | Mar violeta | Dura | — | Charm of Focus, Secret Egg, Charm of Power, Metal Scanner, Gloves of Infection, Mít's Comfy Pillow | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 2 legendarias + 2 épicas |
| **184** | Ocho Brazos | Pulpo (Pez) | Mar violeta | Dura | — | Feather Earring, Hidden Razor, Gecko Mask, Red Sage, Paralyzing Jellyfish, Trickster's Card | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 2 legendarias + 2 épicas |
| **185** | Grieta | Morena (Reptil) | Mar violeta | Dura | — | Red Mirror, Bloodpact, Scotch Tape, Mantis Dagger, Bubble Paste, Sleepy Guard | 190 de vida · 4 partes coleccionables (una Shiny) · 4 partes evolucionadas · mochila: 2 legendarias + 2 épicas |
| **186** | Pico Rápido | Gaviotín (Pájaro) | Mar violeta | Dura | — | Novice Spell, Energy Drink S, Sharp Edge, Cocoon Whistle, Flamingo Hammer, Mask of Frenzy | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 2 legendarias + 2 épicas |
| **187** | Roca del Puerto | Lobo Marino (Bestia) | Mar violeta | Dura | — | Lens of Revelation, Poison Vial, Spring Leaf, Lazy Snail, Bubble Maker, Raging Dagger | 190 de vida · 4 partes coleccionables (una Shiny) · 4 partes evolucionadas · mochila: 2 legendarias + 2 épicas |
| **188** | Tentáculos | Anémona (Planta) | Mar violeta | Dura | — | Last Gift, Papa Bear, Earth Stamp, Leafy Pot, Feather Fan, Energy Drink M | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 2 legendarias + 2 épicas |
| **189** | Antes de Nácar | Ostra (Bicho) | Mar violeta | Dura | — | Charm of Focus, Mama Bear, Black Sage, Storm Shuriken, Red Bubble, Viper's Venom | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 2 legendarias + 2 épicas |
| **190** | **Jefe: Nácar, la Orquídea Abisal** | Nácar (Planta) | Mar violeta | Dura | — | Sticky Octopus, Secret Egg, Charm of Power, Metal Scanner, Gloves of Infection, Mít's Comfy Pillow | 255 de vida · cuerpo místico, 6 partes coleccionables · amuletos: Sticky Octopus, Charm of Power, Metal Scanner · 4 partes evolucionadas · mochila: 3 legendarias + 1 épica |
| **191** | Primera Luz | Alba (Pájaro) | Amanecer | Dura | — | Red Mirror, Feather Earring, Hidden Razor, Gecko Mask, Red Sage, Paralyzing Jellyfish | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 3 legendarias + 1 épica |
| **192** | Gotas de la Mañana | Rocío (Planta) | Amanecer | Dura | — | Novice Spell, Bloodpact, Scotch Tape, Bubble Paste, Sleepy Guard, Trickster's Card | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 3 legendarias + 1 épica |
| **193** | Rayo | Centella (Bestia) | Amanecer | Dura | — | Lens of Revelation, Energy Drink S, Mantis Dagger, Sharp Edge, Flamingo Hammer, Mask of Frenzy | 190 de vida · 4 partes coleccionables (una Shiny) · 4 partes evolucionadas · mochila: 3 legendarias + 1 épica |
| **194** | Estrella de la Mañana | Lucero (Bicho) | Amanecer | Dura | — | Last Gift, Poison Vial, Spring Leaf, Bubble Maker, Raging Dagger, Cocoon Whistle | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 3 legendarias + 1 épica |
| **195** | Línea del Mar | Horizonte (Pez) | Amanecer | Dura | — | Papa Bear, Earth Stamp, Leafy Pot, Lazy Snail, Feather Fan, Energy Drink M | 190 de vida · 4 partes coleccionables (una Shiny) · 4 partes evolucionadas · mochila: 3 legendarias + 1 épica |
| **196** | Tres Cabezas | Quimera (Reptil) | Amanecer | Dura | — | Charm of Focus, Mama Bear, Black Sage, Charm of Power, Storm Shuriken, Red Bubble | 190 de vida · 4 partes coleccionables (una Shiny) · 4 partes evolucionadas · mochila: 3 legendarias + 1 épica |
| **197** | Escudo de Luz | Paladín (Bestia) | Amanecer | Dura | — | Red Mirror, Sticky Octopus, Secret Egg, Metal Scanner, Mít's Comfy Pillow, Viper's Venom | 190 de vida · 4 partes coleccionables (una Shiny) · 4 partes evolucionadas · mochila: 3 legendarias + 1 épica |
| **198** | Seis Alas | Serafín (Pájaro) | Amanecer | Dura | — | Novice Spell, Feather Earring, Hidden Razor, Red Sage, Paralyzing Jellyfish, Gloves of Infection | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 3 legendarias + 1 épica |
| **199** | La Puerta | Guardián (Planta) | Amanecer | Dura | — | Bloodpact, Scotch Tape, Bubble Paste, Gecko Mask, Sleepy Guard, Trickster's Card | 190 de vida · 4 partes coleccionables · 4 partes evolucionadas · mochila: 3 legendarias + 1 épica |
| **200** | **Jefe Final: Aurora, la Última Escama** | Aurora (Reptil) | Amanecer | Dura | — | Lens of Revelation, Last Gift, Energy Drink S, Mantis Dagger, Sharp Edge, Flamingo Hammer | 260 de vida · cuerpo místico, 6 partes coleccionables (2 Shiny) · amuletos: Lens of Revelation, Last Gift, Energy Drink S · 6 partes evolucionadas · mochila: 1 mítica + 3 legendarias |

### Escenarios

Cada partida se pelea en un **escenario** de las batallas de eventos de Origins: plaza, coliseo, bahía pirata, playa, bosque nevado, valle de otoño, guarida, bosque de otoño, isla del verano, salón de invierno, desierto, ocaso, mar violeta, y los fondos de clase y de Dusk, Mech y Dawn (jungla, laguna, meseta, cañón, cielo, caverna, bosque nocturno, engranajes y amanecer): veintidós. En la Aventura cada capítulo pelea en el de su tierra; el tutorial va en la plaza; contra la CPU y en red se sortea en cada partida (en red, las dos pantallas ven el mismo). Es solo el lugar: **no cambia ninguna regla**. El escenario reacciona a la partida: se tensa con la cadena del que juega, se apaga con el corte y se enciende con un golpe grande. La portada y la sala siguen con el fondo de tu clase.

### Free Game en el Nivel 1

Desde el **Nivel 1: Primeros Pasos**, la reserva central de cartas no solo contiene los tres primeros amuletos neutrales (**Charm of Focus**, **Novice Spell** y **Lens of Revelation**): **también incluye las 15 cartas comodín neutrales Free Game**.

- **Composición del pool en Nivel 1 (68 cartas en total):**
  - **35 cartas sin poder** (15 pares de 2 símbolos + 20 tríos de 3 símbolos).
  - **18 cartas con poder** (seis de cada amuleto, de dos símbolos).
  - **15 cartas Free Game** (comodines apilables neutrales sin símbolo de clase fijo).
- **Mecánica del Free Game en el combate:**
  - **Carta gratis:** Al salir de tu mazo no se encadena ni te corta, aunque no comparta ningún símbolo vivo.
  - **Elegís la columna:** Lo ponés sobre la columna de la mesa que quieras (`chooseStackTarget`).
  - **Rescate y extensión de cadenas:** Sus símbolos se agregan a esa columna, permitiendo alargar rachas vivas o abrir nuevas si se monta en apertura.


---

## Modo Tutorial

Una partida guionada de **5 rondas** contra la CPU (detalle en
[docs/tutorial.md](docs/tutorial.md)). Las reglas son las mismas, con estas
diferencias:

- Los mazos salen en el orden del guión (siempre cartas que están en el mazo).
- Sin reloj, y la CPU roba las cartas que diga el guión.
- El centro solo se abre en las rondas 3 y 4; en la que enseña el color ofrece solo
  cartas con tu símbolo.
- La CPU nunca te deja por debajo de 20 de vida: llegás entero a la ronda 5.
- La partida no termina antes de la ronda 5, y el remate usa la última chance del
  rival sin overkill que la borre.
