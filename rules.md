# Axie Chance — Reglas del juego

## Qué es

Un combate de cartas *push-your-luck*. Elegís uno de los seis Axies —uno por clase— y
peleás con su mazo personal. Cada turno cargás un ataque robando cartas: cuanto más
larga la cadena, más fuerte el golpe, pero si la cadena se corta perdés todo. Gana el
que deja al otro sin vida.

---

## Preparación

- Cada jugador elige un Axie. La clase del Axie determina su mazo.
- Los dos arrancan con **100 de vida** (`TARGET`).
- Se sortean los **poderes activos** de la partida: uno por clase, de entre los
  disponibles para esa clase.
- Se arma el **mercado central** (pool de 86 cartas en partida estándar): 35 sin poder + 36 con poder (6 por cada poder activo) + 15 cartas comodín neutrales Free Game. En el Modo Aventura, la reserva escala por nivel (por ejemplo, 62 cartas en el Nivel 1). De ahí salen 6 cartas boca arriba al centro.

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

Si se te acaba el **reloj** (30 segundos), se te corta la cadena automáticamente.

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

Cada jugador roba de su propio mazo de **10 cartas**, armado alrededor de su símbolo:

- **5 pares** del símbolo propio con cada uno de los otros cinco.
- **1 carta sola** con el símbolo propio.
- **4 cartas ajenas** (las "no favorables" que no llevan tu símbolo).

Los mazos iniciales **no tienen poderes**. Los poderes se ganan del centro.

**Sin descarte.** Al empezar cada ronda el mazo se rebaraja entero — lo que se jugó y
lo que se sumó del centro. Dentro de la ronda las cartas que salieron no vuelven.

---

## Daño y vida

La vida no se almacena directamente: se **deriva**.

$$\text{vida} = \max(100 - \text{daño recibido total} + \text{curación total},\; 0)$$

### Fórmula del ataque (`swingOf`)

1. **Base** = puntaje de la cadena (0 si se cortó).
2. Si base = 0, el ataque hace 0 (no se aplican modificadores).
3. **+ fuerza** acumulada (`state.strength`).
4. **+ bonus brutal** (ver poder Garra Brutal).
5. Si el rival tiene **caracol**: se divide por 2, redondeando arriba.
6. Si el rival tiene **huevo** (escudo): el escudo absorbe primero; si se rompe, le
   devuelve 5 fijos al atacante.

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

**Elegibilidad**: solo podés llevarte cartas que contengan al menos un símbolo de tu
clase. Si **ninguna** de las 6 tiene tu símbolo, el centro se **renueva entero** una
vez (las 6 al fondo de la reserva, 6 nuevas a la vista). Máximo una renovación por
draft por jugador.

Si la reserva se agota, se sigue jugando con el mazo armado.

**Reloj del draft**: 10 segundos por pick. Si se agota, se saltea automáticamente.

---

## Los poderes

Las cartas con poder llevan, además de sus símbolos, un **poder** que la cadena no
ve: no abre cadena, no la continúa, no la corta y no puntúa. Solo dispara su efecto
al **soltar el ataque** (salvo excepciones marcadas).

Cada poder pertenece a una **clase** y siempre viaja con su símbolo entre los 3 de la
carta, así el efecto de tu color encadena con tu mazo mejor que con ningún otro.

Al principio de cada partida se sortea **un poder activo por clase**:

| clase | poderes posibles |
|---|---|
| Bestia | Fuerza, Garra Brutal |
| Pez | Pulpo, Burbuja de Retorno |
| Pájaro | Huevo, Pluma Sagrada |
| Planta | Maceta, Hoja (Leaf) |
| Bicho | Caracol, Greedy Leech |
| Reptil | Veneno, Piel de Escamas |

**Regla general**: todos los poderes (salvo Pluma y Pulpo/Burbuja) requieren que el
ataque haya hecho daño (`swing > 0`) para activarse. Si se corta la cadena, no se
activa nada.

---

### ⚔️ Fuerza (Bestia)

**+1 de daño en este ataque y en todos los que siguen.** Permanente y acumulable.

- Cada carta de Fuerza en la cadena suma `+1` a `state.strength`.
- Se aplica en cada ataque futuro como parte de `swingOf`.
- **Requiere** `swing > 0`. Si se corta la cadena o el daño es 0, no se gana
  fuerza. La fuerza acumulada de turnos anteriores se conserva.

---

### 🐻 Garra Brutal (Bestia)

**+2 de daño por cada símbolo de tu cadena más larga.** Se activa siempre que conectes el ataque.

- Fórmula: $\text{brutalCount} \times 2 \times \text{maxRun.length}$
- Cuenta los símbolos de tu racha más extendida (de cualquier clase).
- Se suma encima del score + fuerza, antes del caracol.
- **Si se corta**: bonus = 0.

---

### 🥚 Huevo (Pájaro)

**Escudo de medio golpe.** Aguanta hasta que lo rompan; al romperse el efecto pasa
a ser 8 de daño fijo acumulable de vuelta al atacante.

- Escudo = $\lfloor\text{swing} / 2\rfloor$ (mitad del golpe infligido, redondeando abajo).
- El escudo dura hasta que se rompa (absorbe daño entrante; el sobrante pasa).
- **El escudo NO se acumula**: se reemplaza cuando se gana nuevamente.
- El efecto del huevo pasa a ser daño cuando se te rompe el escudo: 8 de daño fijo de vuelta al atacante (`eggBreak`).
- **Daño acumulable**: cada huevo obtenido acumula +8 de daño fijo para cuando se rompa el escudo.
- **Requiere** `swing > 0`.

---

### 🪶 Pluma Sagrada (Pájaro)

**5 de daño inmediato al rival apenas sale la carta.**

- Se dispara al **robar la carta**, no al plantarse.
- **No se pierde si la cadena se corta.** El daño ya fue aplicado.
- **Ignora** huevo (escudo), fuerza, caracol — es daño directo puro.
- Puede matar al rival en medio del turno.
- Es el **único poder que funciona aunque te cortes**.
- En una carta gigante (burbuja apilada), cuenta cada pluma del stack.

---

### 🐙 Pulpo (Pez)

**Una carta de más del centro para tu mazo, la que quieras.**

- Requiere **no haberse cortado** (`!chain.busted`). No requiere `swing > 0`.
- Acumulable: cada pulpo en la cadena da 1 pick extra (fase `'bonus'` del draft).
- La carta elegida puede tener poder.
- La carta va al mazo normal (barajada).
- Rechazar el pick lo gasta.
- **Si se corta**: no hay pick.

---

### 🫧 Burbuja de Retorno (Pez)

**Tu pick del draft abre tu próxima ronda.**

- Requiere **no haberse cortado** (`!chain.busted`). No requiere `swing > 0`.
- **No da picks extra**: intercepta tu pick normal del draft y lo desvía a
  `state.bubbleCard` en vez del mazo.
- La carta atrapada se pone **encima del mazo** → es la primera que sale la
  ronda siguiente.
- Con múltiples burbujas (`count > 1`): al abrir la ronda, se sacan `count - 1`
  cartas extra **de tu propio mazo** y se fusionan en una **carta gigante** con
  todos los símbolos combinados.
- **Si se corta**: no se activa.

**Diferencia clave con el Pulpo**: el Pulpo da picks *extra*; la Burbuja *redirige*
tu pick normal para que abra tu próxima ronda.

---

### 🪴 Maceta (Planta)

**Te curás lo mismo que pegaste**, sin pasar de 100.

- Recuperás vida igual al daño que hiciste este turno (`swing`).
- La curación no puede superar el máximo (100 de vida).
- **Requiere** `swing > 0`.

---

### 🍃 Hoja / Leaf (Planta)

**+2 hojas por carta (acumulables hasta 5). Al final de tu turno, cada hoja cura 4 de vida y luego se consume una hoja.**

- Aplica el efecto canónico de Axie Origins: al plantarte con éxito (`swing > 0`), la carta te otorga 2 hojas.
- Las hojas se acumulan hasta un máximo de 5.
- Al final de cada uno de tus turnos, te curas 4 de vida por cada hoja activa (`hojas × 4`) y luego se consume 1 hoja (`hojas - 1`).
- La curación y consumo de hojas suceden al final del turno, incluso si ese turno luego se corta.
- **Requiere** `swing > 0` para obtener nuevas hojas.

---

### 🐌 Caracol (Bicho)

**El próximo ataque del rival pega la mitad** (redondeando arriba). Acumulable.

- Cada caracol en la cadena añade 1 cargo de debilidad (`weak`) al rival.
- Se consume un cargo solo cuando el rival hace un ataque con daño > 0.
- Dos caracoles → los dos próximos ataques del rival salen al medio.
- Un caracol nunca deja un ataque en 0 (redondea arriba: `Math.ceil(hit / 2)`).
- **Requiere** `swing > 0`.

---

### 🩸 Greedy Leech (Bicho)

**Roba 6 de vida al rival (se duplica a 12 con 4+ columnas en mesa).**

- Al plantarte con daño, le resta 6 de vida al oponente y te los cura a vos.
- Con 4 o más columnas de cartas jugadas en tu mesa, el drenaje se duplica a 12 HP.
- Las cartas Free Game apiladas sobre una columna existente no suman como columna nueva.
- **Requiere** `swing > 0`.

---

### ☠️ Veneno (Reptil)

**Daño continuo: la mitad de tu golpe.** Muerde al finalizar el turno del rival y se parte
al medio.

- Al plantarte: envenenás al rival con $\lfloor\text{swing} / 2\rfloor$.
- Acumulable: nuevo veneno se suma al existente (`poisonStacks: true`).
- **Al finalizar su turno** (el turno de quien lo tiene encima):
  1. El veneno muerde (resta vida).
  2. Se parte al medio: $\lfloor\text{veneno} / 2\rfloor$.
  3. Si queda ≤ 2, se va del todo.
- **Requiere** `swing > 0`.

---

### 🛡️ Piel de Escamas (Reptil)

**Tope defensivo: limita el próximo ataque rival a máximo 12 de daño.**

- Blindaje que mitiga todo el daño de un golpe rival por encima de 12 puntos.
- Acumulable: cada piel adicional reduce el tope en -2 (12 → 10 → 8), hasta un piso mínimo inquebrantable de 6.
- Se gasta solo cuando el rival conecta un ataque con daño.
- **Requiere** `swing > 0`.

---

## Free Game (cartas apilables)

El pool incluye 15 cartas neutrales llamadas Free Game (presentes en todos los modos
y activas desde el **Nivel 1 del Modo Aventura**). Tienen 2 símbolos y funcionan de la siguiente manera:

- **Al salir del mazo**: Debe compartir al menos un símbolo vivo con tus rachas activas; **si no coincide, se corta como cualquier carta**.
- **Al entrar en mesa con éxito**: Activa el comodín. Tu próximo robo no corta y te permite elegir sobre qué columna existente montarlo (`'stack'`) para alargarla.
- **Alargar carta**: Sus símbolos se suman a esa columna, pudiendo extender cadenas vivas.
- Si se monta sobre la 1ª columna, puede **abrir nuevas cadenas puntuables**.
- No añade una nueva columna a la mesa (conserva el número de columnas).

---

## Flujo completo de una ronda

1. **Inicio de ronda**: se barajan los mazos enteros + cartas del top (burbuja).
2. **Turno del primer jugador**: roba, encadena, se planta o se corta.
3. **Resolución del turno**: daño, poderes aplicados, espinas de cáscara y mordisco de veneno si el jugador actual estaba envenenado.
4. **Draft del primer jugador**: elige del centro. Bonus del pulpo si lo tiene.
5. **Si el rival sigue vivo** (o tiene última chance): turno del segundo jugador (con la misma resolución y veneno propio si estaba envenenado).
6. **Draft del segundo jugador**.
7. **Cierre de ronda**: se determina ganador de la ronda y se chequea si alguien murió.
8. Si no terminó, empieza la ronda siguiente.

---

## La última chance

Si te quedás sin vida **antes de haber atacado** en este intercambio, no morís
todavía: jugás tu turno igual (robás, encadenás, te plantás) con un halo de luz.

- Si tu golpe deja sin vida al otro también → **empate**.
- Si no alcanzás → perdés.
- Solo le puede tocar al **segundo** en el orden de turnos (el que todavía no
  puntuó esta ronda: `roundScores[p] === null && hpOf(state, p) <= 0`).
- Contra la CPU: la CPU siempre cierra, así que siempre tiene última chance.
- En red: el orden se sortea, así que la última chance es aleatoria.

La CPU en última chance calcula cuánto necesita para empatar y si la cadena le
alcanza, se planta y lo asegura.

---

## Quién abre

- **Contra la CPU**: siempre vos (p1). El orden es fijo toda la partida.
- **En red**: se sortea al empezar (`rng() < 0.5`). Fijo toda la partida (no alterna
  entre rondas, porque eso causaba que el mismo jugador jugara dos veces seguidas).
- Abrir es desventaja: el que cierra ve el daño del otro antes de decidir, y es el
  único que puede cobrar la última chance.

---

## Reloj

| fase | tiempo |
|---|---|
| Turno | 30 segundos |
| Draft (cada pick) | 10 segundos |

- Si se agota en el turno: se corta la cadena (bust), ataque = 0.
- Si se agota en el draft: se saltea el pick.
- Los bots no tienen reloj.

---

## Abandono (forfeit)

- Disponible en cualquier momento de la partida (pensado para red).
- Si se completaron **5 o más rondas**: el que abandona pierde, el otro gana.
- Si se completaron **menos de 5 rondas**: la partida se declara **nula** (`'void'`)
  para prevenir dodging en rondas tempranas.

---

## Mejoras del Axie (+)

Desde la pantalla de elección de Axie, cada carta se puede mejorar con un símbolo
extra:

- Las **6 cartas de tu clase** (las que llevan tu símbolo) admiten solo **el tuyo**.
  Con una sola opción, el botón lo pone de un toque.
- Las **4 no favorables** (sin tu símbolo) admiten **uno de sus dos**, el que elijas.

El símbolo repetido no es adorno: la cadena cuenta cada aparición, y la cadena
puntúa al cuadrado. Abrir con una carta mejorada y encadenar tres cartas más es
5² = 25 donde antes era 4² = 16.

Las mejoras se guardan **por Axie** y viajan a la partida como
`{ clave_carta: símbolo }`.

---

## Atajos de teclado

| tecla | acción |
|---|---|
| `R` | Robar carta |
| `P` | Plantarse |
| `Enter` | Continuar |

---

## La CPU

Usa *expectimax* con lookahead sobre las cartas no vistas de su propio mazo. Tres
niveles de dificultad:

| | profundidad | margen | juega el final |
|---|---|---|---|
| Fácil | 1 | 1.35× (tímida) | no |
| Normal | 2 | 1.0× | sí |
| Duro | 3 | 1.0× | sí |

Para elegir del centro usa **conectividad**: por cada símbolo de la carta, cuántas
cartas de su mazo lo llevan. Compara las dos ramas (2 sin poder vs. 1 con poder)
convirtiendo el valor del efecto a la misma unidad con `POWER_WORTH`.

"Juega el final" = cuando el golpe del humano la dejó sin vida, sigue robando en vez
de plantarse con poco, porque plantarse por debajo pierde igual.

---

## Modo Aventura

El Modo Aventura es una campaña de progresión individual a través de **6 niveles** contra Axies rivales de dificultad creciente. En cada nivel se desbloquean **2 nuevos poderes de clase**. Al igual que en las reglas generales, **cada clase tiene como máximo un único poder activo a la vez** (por ejemplo, en Planta es Maceta u Hoja, nunca ambos en simultáneo). En los niveles 4, 5 y 6, los nuevos poderes sustituyen a los clásicos de su respectiva clase.

### Los 6 niveles

| Nivel | Nombre | Rival (Clase) | Dificultad | Nuevos poderes | Poderes activos |
|---|---|---|---|---|---|
| **1** | **Primeros Pasos** | Brote (Planta) | Fácil | Fuerza + Maceta *(¡y Free Game!)* | 2 poderes (Fuerza, Maceta) + Free Game |
| **2** | Defensa y Estrategia | Racha (Pájaro) | Fácil | Huevo + Caracol | 4 poderes (Fuerza, Maceta, Huevo, Caracol) + Free Game |
| **3** | El Arte del Mercado | Marea (Pez) | Normal | Pulpo + Veneno | 6 poderes clásicos (1 por clase) + Free Game |
| **4** | Furia de la Naturaleza | Colmillo (Bestia) | Normal | Garra Brutal + Hoja | 6 poderes (Garra Brutal y Hoja sustituyen a Fuerza y Maceta) + Free Game |
| **5** | Sombras y Vuelo | Aguijón (Bicho) | Duro | Greedy Leech + Pluma Sagrada | 6 poderes (Greedy Leech y Pluma sustituyen a Caracol y Huevo) + Free Game |
| **6** | Duelo de Maestros | Escama (Reptil) | Duro | Burbuja + Piel de Escamas | 6 poderes avanzados (Burbuja y Piel de Escamas sustituyen a Pulpo y Veneno) + Free Game |

### Free Game en el Nivel 1

Desde el **Nivel 1: Primeros Pasos**, la reserva central de cartas no solo contiene los dos poderes de clase iniciales (**Fuerza** de Bestia y **Maceta** de Planta): **también incluye las 15 cartas comodín neutrales Free Game**.

- **Composición del pool en Nivel 1 (62 cartas en total):**
  - **35 cartas sin poder** (15 pares de 2 símbolos + 20 tríos de 3 símbolos).
  - **12 cartas con poder** (6 de Fuerza + 6 de Maceta).
  - **15 cartas Free Game** (comodines apilables neutrales sin símbolo de clase fijo).
- **Mecánica del Free Game en el combate:**
  - **Robo con coincidencia:** Al salir de tu mazo debe conectar con tus cadenas vivas como cualquier carta normal.
  - **Fase de apilado (`stack`):** Al entrar con éxito a la mesa, tu siguiente robo te permite elegir sobre qué columna existente montarlo para alargarla.
  - **Rescate y extensión de cadenas:** Sus símbolos se agregan a esa columna, permitiendo alargar rachas vivas o abrir nuevas si se monta en apertura.

