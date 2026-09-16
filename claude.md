# Axie Chance — Contexto y Guía del Proyecto

Juego de cartas *push-your-luck* para navegador, ambientado en el universo de **Axie Infinity Origins**.
Encadenás símbolos mientras te animes: cuanto más larga la racha de símbolos compartidos, más daño inflige el ataque (fórmula cuadrática $L^2$); pero si la carta robada no comparte ningún símbolo con las rachas todavía vivas, la cadena se corta (*bust*) y el ataque de la ronda hace 0.

> Para el reglamento de juego detallado y balance formal, consultar también [rules.md](rules.md).

---

## Stack y Convenciones

- **Vanilla Web**: Sin frameworks (React, Vue, etc.) y sin paso de build para desarrollo local. HTML5 + CSS3 + JavaScript moderno con módulos ES nativos (`type: "module"`).
- **Cero dependencias de runtime**: `package.json` no tiene `dependencies`, solo `devDependencies` para tooling (`aws-cdk`, `aws-cdk-lib`, `typescript`).
- **Assets y CDN**: Texturas de interfaz provenientes del kit gráfico de Origins. Imágenes y animaciones de Axies provistas por el CDN oficial de Sky Mavis (`axiecdn.axieinfinity.com`).
- **Audio Engine**: Efectos de sonido WAV descargados bajo demanda y reproducidos vía Web Audio API nativo con AudioContext *lazy*.
- **Archivos generados (NO editar a mano)**:
  - `src/axie-avatars.js` (catálogo de partes y composición de capas de avatares).
  - `src/axie-poses.js` (variantes de poses y animaciones precalculadas).
  - `src/audio-clips.js` (mediciones y buffers de clips de audio).
  - `src/vfx-clips.js` (metadatos de sprites de efectos visuales).
  - `Axies/<id>/*.png` (dibujos de los starters de Origins cortados del atlas del kit; los escriben `npm run axies` y `npm run poses` vía `scripts/starters.mjs`).
- **Tests**: Corren en Node.js puro usando un DOM shim ultraligero (`test/dom.mjs`), sin frameworks pesados ni dependencias externas (usa `node:assert/strict`).
- **Convención de idiomas**: Código fuente (variables, funciones, clases, identificadores) en **inglés**; UI, comentarios explicativos, textos y documentación en **español**.
- **Infraestructura AWS**: Código de infraestructura como código (IaC) en TypeScript con **AWS CDK v2** bajo la carpeta `infra/`.

---

## Comandos del Proyecto

```sh
npm start              # Servidor dev con live reload + servidor de salas en red (http://localhost:8000)
npm test               # Ejecuta las 13 suites de test unitarios e integración en Node
npm run build          # Empaqueta el juego en dist/axie-chance.html (archivo único con assets inlined)
npm run balance        # Banco de balance: simula partidas sembradas y mide efectividad de poderes
npm run axies          # Regenera src/axie-avatars.js desde el mixer de Axies (offline)
npm run poses          # Regenera src/axie-poses.js (animaciones y poses horneadas)
npm run vfx            # Procesa y regenera el atlas de efectos visuales (src/vfx-clips.js)
npm run sfx            # Regenera src/audio-clips.js (mediciones y duraciones de SFX)
npm run deploy         # Construye y despliega automáticamente a AWS S3 y CloudFront vía CDK
npm run cdk:diff       # Inspecciona diferencias pendientes de infraestructura AWS en perfil dev
npm run cdk:synth      # Sintetiza la plantilla CloudFormation de la infraestructura
```

---

## Arquitectura del Sistema

El proyecto sigue una arquitectura estricta en capas unidireccionales **sin dependencias circulares**:

```
data.js ← rules.js ← ai.js
   ↑          ↑         ↑
   └──────── game.js ───┘  (máquina de estados pura: sin DOM, sin audio, sin red)
                ↑
    ┌───────────┼───────────┬──────────────┬──────────────┐
  ui.js      lobby.js     net.js     adventure.js    tutorial.js
    ↑           ↑           ↑              ↑              ↑
    └───────────┴───── arena / DOM ────────┴──────────────┘
```

- **`game.js`** es el corazón lógico agnóstico: desconoce la existencia del DOM, Web Audio o WebSockets.
- La reactividad se maneja mediante el patrón observador: `game.subscribe(fn)` (o `game.on('change', fn)`), notificando a `ui.js`, `audio-cues.js`, etc.

---

## Mapa de Archivos Clave

| Archivo / Carpeta | Propósito y Responsabilidades |
|---|---|
| **`src/i18n.js`** / **`src/i18n-en.js`** | Infraestructura de internacionalización (i18n): `tr()`, `currentLang()`, `setLang()`, `translateDom()` y diccionario de traducciones en inglés `EN_STRINGS`. Módulo puro compatible con Node y navegador. |
| **`src/data.js`** | Taxonomía canónica, clases, partes anatómicas, saltos, tríadas canónicas, fórmula de supresión de counters, Axie Core (Part Evolution), 12 poderes de clase (`POWERS`), Free Game, `TUNING`, `buildPool()`, `baseDeck()`, `buildPersonalDeck()`, `makeRng(seed)`. |
| **`src/rules.js`** | Funciones matemáticas puras: `scoreChain()`, `survivalOdds()`, `timesIn()`, `emptyChain()`, `playCard()`, `isScoringCell()`, `stackOnCard()` (apilado de Free Game). Sin efectos secundarios. |
| **`src/game.js`** | Máquina de estados: `createGame()`, turnos, robo (`hit`), plantarse (`stand`), draft del mercado (`takeCard`, `skipDraft`), renovación del mercado (`renewMarket`), apilado (`chooseStackTarget`), reloj de turno y draft, abandono (`forfeit`), cálculo de daño (`swingOf`), vida (`hpOf`), última chance (`lastChance`). |
| **`src/ai.js`** | Toma de decisiones de la CPU: `decideDraw()` (expectimax con lookahead 1-3 según dificultad), conectividad de cartas (`connectivity()`), valoración de poderes (`POWER_WORTH`), selección de draft (`planDraft()`, `pickBest()`, `pickBonus()`). |
| **`src/ui.js`** | Renderizado reactivo de la mesa en `#arena`: render de cartas, rachas, HUD, barras de vida, escudos, status badges (veneno, hojas, caracol, etc.), dial de probabilidades (*odds*), controles de acción, selección interactiva de columnas para Free Game. |
| **`src/lobby.js`** | Interfaz principal: portada con paseo de Axies (*strollers*), selector de modo de juego (Aventura, Solo CPU, Red), selector de Axie con asignación de mejoras (+), lanzador de tutorial, modales de reglas y enciclopedia de símbolos. |
| **`src/adventure-levels.js`** | Definición declarativa de la campaña de niveles (`ADVENTURE_CAMPAIGN`): rivales starters, dificultades, nuevos poderes y showcase especial. |
| **`src/adventure.js`** | Lógica del Modo Aventura: compilación y validación (`buildAdventureLevels`), derivación de `id` y `activePowers`, helpers (`isFinalLevel`, `nextLevelId`, `DIFFICULTY_LABELS`) y persistencia en `localStorage` (`axie-chance:adventure`). |
| **`src/tutorial.js`** | Tutorial de 5 rondas que enseña jugando (lineamientos en [docs/tutorial.md](docs/tutorial.md)): mazos guionados, flecha del kit de Origins + burbuja de ≤ 6 palabras, brillo celeste sobre lo que hay que mirar, ayuda escalonada si el jugador se queda quieto y bloqueo de acciones por paso (*action gating*). Sin modales ni fondos oscuros. |
| **`src/net.js`** | Lobby y sala de la partida en red. Crear una sala te hace **anfitrión**: la sala (`rooms.js`) corre en tu navegador y las pantallas de afuera reciben el estado por el relay. Recorta lo que llega de otro navegador (`cleanRoom`), descarta envíos viejos por número (`seen`), muestra el QR de invitación (`roomLink()`) y lee dónde está el relay en `net.json` (`netAvailable()`, `relayUrl()`). |
| **`src/rooms.js`** | La sala: `createRoom()` con asientos, listo, loadout, espectadores, gracia de reconexión (`SEAT_GRACE`) y estado redactado (`redact()`: sin pool ni orden de mazos). Corre en el navegador del anfitrión. |
| **`src/link.js`** | Cable al relay por WebSocket con reconexión sola, latido y `packMessage()`: estados comprimidos (gzip + base64) y en pedazos para no pasar los 32 KB de API Gateway. |
| **`src/qr.js`** | Generador de códigos QR sin dependencias (modo byte, corrección M, versiones 1-40): `qrMatrix(text)` y `qrSvg(text)`. |
| **`src/loadout.js`** | Carga y guardado persistente del Axie seleccionado y sus mejoras de cartas (+) en `localStorage` (`axie-chance:loadout`). |
| **`src/axies.js`** | Roster de los 6 Axies canónicos (Colmillo, Marea, Racha, Brote, Aguijón, Escama), mapeo de clases y partes cosméticas; `STARTERS` (Olek, Momo, Puffy, Buba, Pomodoro, Venoki), los rivales de la Aventura. |
| **`scripts/starters.mjs`** | Baja los starters del Origins Asset Kit (Spine 3.8), corta su atlas en `Axies/<id>/` y deja el esqueleto listo para `npm run axies` y `npm run poses`. |
| **`src/axie-motion.js`** | Animaciones de Axies mediante Web Animations API (posturas base, respiración, ataques, impactos, victoria, derrota). |
| **`src/audio.js`** | Motor de sonido con Web Audio API: reproducción de SFX, música de fondo en loop, control de volumen maestro y muteo. |
| **`src/audio-cues.js`** | Orquestador de sonido: inspecciona las diferencias de estado (`lastHit`, cambios de fase, bust) y dispara los SFX adecuados. |
| **`src/vfx.js`** | Animaciones de efectos visuales (golpes, chispas, veneno) basadas en atlas de sprites y `requestAnimationFrame`. |
| **`scripts/dev.mjs`** | Servidor de desarrollo HTTP con live reload vía SSE (`/__dev`), `net.json` y el relay de salas por WebSocket en `/net/ws` (con `scripts/ws.mjs`, servidor WebSocket mínimo sin dependencias). |
| **`relay/core.mjs`** | Relay de salas (el "cartero"): crea salas con código y llave de anfitrión, lista, conecta pantallas con el anfitrión y reenvía mensajes sin abrirlos. Almacén intercambiable: `memoryStore()` en dev, DynamoDB en AWS. |
| **`relay/lambda.mjs`** | El relay en AWS Lambda detrás de API Gateway WebSocket, con DynamoDB (TTL `expires`). Usa el AWS SDK que trae el runtime: no se empaqueta nada. |
| **`scripts/build.mjs`** | Empaquetador a un único archivo `dist/axie-chance.html` con todos los recursos e iconos incrustados como data URIs. |
| **`scripts/balance.mjs`**| Banco de pruebas automatizado: simula miles de partidas con semillas controladas para medir el balance de los poderes. |
| **`infra/`** | Proyecto AWS CDK en TypeScript para desplegar el sitio estático sobre S3 privado con CloudFront (OAC). |
| **`test/`** | Banco completo de 13 suites de pruebas automatizadas ejecutadas directamente con Node.js puro. |

---

## Taxonomía Canónica y Axie Core

El juego implementa formalmente la taxonomía oficial de Axie Infinity:

1. **Orden Cíclico Canónico**:
   $$\text{Planta (0)} \to \text{Bestia (1)} \to \text{Pez (2)} \to \text{Pájaro (3)} \to \text{Bicho (4)} \to \text{Reptil (5)}$$
2. **Partes Anatómicas y Saltos Fijos**:
   - `tail` (Cola): Salto 0 $\to$ Mono-símbolo puro ($[C_i]$).
   - `mouth` (Boca): Salto +1 $\to$ $[C_i, C_{(i+1)\%6}]$.
   - `eyes` (Ojos): Salto +2 $\to$ $[C_i, C_{(i+2)\%6}]$.
   - `ears` (Orejas): Salto +3 $\to$ $[C_i, C_{(i+3)\%6}]$.
   - `horn` (Cuerno): Salto +4 $\to$ $[C_i, C_{(i+4)\%6}]$.
   - `back` (Espalda): Salto +5 $\to$ $[C_i, C_{(i+5)\%6}]$.
3. **Tríadas Canónicas (Piedra, Papel o Tijera)**:
   - **Roca**: Planta y Reptil.
   - **Papel**: Bestia y Bicho.
   - **Tijera**: Pájaro y Pez.
   - *Regla*: Papel vence a Roca; Tijera vence a Papel; Roca vence a Tijera.
4. **Fórmula de Supresión de Counters (Cartas Desfavorables)**:
   Para cada clase base, sus 4 cartas ajenas en el mazo inicial se derivan matemáticamente:
   - $A$: Aliado (la otra clase de su misma tríada).
   - $P_1, P_2$: Presas (las dos clases de la tríada a la que vence).
   - $C_1, C_2$: Counters (las dos clases de la tríada que la vence).
   - **Carta 1**: $[A, P_1]$ (Alianza Presa 1).
   - **Carta 2**: $[A, P_2]$ (Alianza Presa 2).
   - **Carta 3**: $[P_1, P_2]$ (Doble Presa).
   - **Carta 4**: $[C_1, C_2]$ (Confinamiento de amenaza counter).
   *Propiedad demostrada*: Presas y Aliado aparecen 2 veces cada una; los Counters aparecen exactamente 1 vez.
5. **Axie Core — Part Evolution**:
   Las cartas favorables evolucionadas (`isEvolved: true`) incorporan el símbolo de la clase de la parte, expandiéndose a 3 símbolos (o 2 en la cola).

---

## Mecánicas del Juego y Reglas Fundamentales

1. **Objetivo y Vida**: Cada jugador comienza con **100 HP** (`TARGET`). La vida se deriva:
   $$\text{HP} = \max(100 - \text{daño total recibido} + \text{curación total}, 0)$$
2. **El Turno**:
   - Robás la primera carta de tu mazo (o carta atrapada por Burbuja).
   - Cada símbolo de la primera carta abre una racha (*run*).
   - Cada robo sucesivo: si contiene un símbolo vivo, alarga esa racha. Las rachas que no coincidan quedan congeladas. Si una carta no coincide con **ninguna** racha viva, se produce **corte de cadena (bust)** y el ataque vale 0.
   - **Plantarse**: Ejecuta el ataque. El daño base es el puntaje de la cadena ($\sum \text{largo}^2$).
3. **Fórmula de Daño (`swingOf`)**:
   $$\text{Ataque} = (\text{Puntaje Cadena} + \text{Fuerza} + \text{Bonus Brutal}) \times \text{Modificador Caracol} - \text{Escudo Huevo}$$
   - Si la cadena se cortó ($\text{base} = 0$), el daño total es 0 (no aplican fuerza ni modificadores).
   - Si el rival tiene **Piel de Escamas**, el daño entrante se topea al límite establecido.
4. **Mercado Central (Draft)**:
   - Hay **6 cartas visibles** sacadas del pool común.
   - Si te plantaste: podés llevarte **1 carta con poder** O **2 cartas sin poder**.
   - Si se cortó la cadena: podés llevarte **1 carta sin poder**.
   - **Elegibilidad**: Solo podés elegir cartas que contengan tu símbolo de clase (o Free Game neutral).
   - **Renovación**: Si ninguna de las 6 cartas tiene tu símbolo, se puede renovar el centro entero una vez por draft (`renewMarket()`).
5. **Reloj de Turno (`CLOCK`)**:
   - 30 segundos para decidir robar o plantarse (si se agota, se corta la cadena automáticamente).
   - 10 segundos por pick de draft (si se agota, se saltea el pick).
6. **Última Chance**:
   - Si el segundo jugador en el orden de la ronda recibe daño letal antes de atacar, se le otorga la **Última Chance**.
   - Juega su turno con halo dorado: si logra dejar al rival en 0 HP también, la partida termina en **Empate** (*Draw*).
7. **Abandono (`forfeit`)**:
   - Si se abandona antes de la ronda 5 (`FORFEIT_ROUNDS`), la partida se declara **nula** (`'void'`) para evitar *dodging*.
   - A partir de la ronda 5, quien abandona pierde y el oponente gana.

---

## Los 12 Poderes de Clase + Free Game

En cada partida estándar se sortea **un poder activo por clase** (6 en total), más las 15 cartas de **Free Game**.

| Clase | Poder (Origins) | ID | Amuleto (`amuletos/`) | Activación y Mecánica Detallada |
|---|---|---|---|---|
| **Bestia** | **Charm of Power** | `strength` | `ecard_beast_4001.png` | **+1 permanente de daño** en este ataque y todos los futuros. Acumulable. Requiere `swing > 0`. |
| **Bestia** | **Energy Drink M** | `brutal` | `ecard_beast_5003.png` | Suma **+2 de daño por cada símbolo de tu cadena más larga**. Se activa siempre. Requiere `swing > 0`. |
| **Pez** | **Sticky Octopus** | `octopus` | `ecard_aquatic_5004.png` | Otorga **1 pick extra del mercado** por cada pulpo (fase bonus del draft). Requiere no haberse cortado (`!busted`), no requiere daño. |
| **Pez** | **Bubble Paste** | `bubble` | `ecard_aquatic_4003.png` | **Redirige tu pick de draft para abrir tu próxima ronda**. Con múltiples burbujas, fusiona cartas del tope de tu mazo en una **carta gigante** multi-símbolo. Requiere `!busted`. |
| **Pájaro** | **Secret Egg** | `egg` | `ecard_bird_5003.png` | Otorga un escudo protector de $\lfloor \text{swing} / 2 \rfloor$. **No se acumula** (se reemplaza por uno nuevo). Al romperse, inflige **8 de daño fijo acumulable (`eggBreak`)** de contraataque directo al agresor. Requiere `swing > 0`. |
| **Pájaro** | **Feather Earring** | `feather` | `ecard_bird_momo_1.png` | Inflige **5 de daño directo inmediato** al rival **apenas se roba la carta**. No se pierde si la cadena se corta. Ignora escudos y caracoles. |
| **Planta** | **Leafy Pot** | `pot` | `ecard_plant_4003.png` | **Te curás exactamente lo mismo que pegaste** este turno (hasta el tope de 100 HP). Requiere `swing > 0`. |
| **Planta** | **Spring Leaf** | `leaf` *(alias `oak`)* | `ecard_plant_ena_1.png` | Otorga **+2 hojas** al plantarte con éxito (tope 5). Al final de cada uno de tus turnos, **cura 4 HP por hoja y consume 1 hoja**. La curación ocurre incluso si ese turno luego se corta. Requiere `swing > 0` para ganar hojas. |
| **Bicho** | **Lazy Snail** | `snail` | `ecard_bug_5005.png` | Añade 1 carga de debilidad al rival. El próximo ataque del rival **hace la mitad del daño** ($\lceil \text{hit} / 2 \rceil$). Acumulable en cantidad de ataques. Requiere `swing > 0`. |
| **Bicho** | **Mantis Dagger** | `leech` | `ecard_mantis_dagger.png` | Al atacar, **roba 6 de vida al rival** (daño + curación). Con 4 o más columnas en mesa, el drenaje se duplica a **12 HP**. Requiere `swing > 0`. |
| **Reptil** | **Poison Vial** | `poison` | `ecard_reptile_venoki_1.png` | Envenena al rival con $\lfloor \text{swing} / 2 \rfloor$. Al finalizar el turno del jugador envenenado: el veneno muerde (resta vida), se divide a la mitad ($\lfloor v / 2 \rfloor$) y si queda $\le 2$ se disipa. Acumulable. Requiere `swing > 0`. |
| **Reptil** | **Gecko Mask** | `steelskin` | `ecard_reptile_4003.png` | Establece un **blindaje que limita el próximo golpe rival a un máximo de 12 de daño**. Cada acumulación reduce el tope en -2 (12 $\to$ 10 $\to$ 8) con piso mínimo de 6. Se consume al recibir daño. Requiere `swing > 0`. |
| **Neutral** | **Rocket Stamp** | `freegame` | `ecard_neutral_5001.png` | **Comodín apilable (15 cartas en pool)**. Al robarla se corta si no comparte símbolos vivos; al entrar con éxito, tu próximo robo alarga una carta existente sumando sus símbolos. |

> Todos los símbolos especiales se obtienen **exclusivamente de la carpeta `simbolos especiales/amuletos/`**. Para resincronizar tras cambios: `npm run amuletos`.

---

## Modos de Juego

### 1. Solo vs CPU (`mode: 'cpu'`)
- Partida estándar contra bot con dificultad seleccionable (`facil`, `normal`, `duro`).
- Humano siempre abre (p1); bot siempre cierra (p2).
- Pool completo de 86 cartas (35 sin poder + 36 con poder + 15 Free Game).

### 2. Modo Aventura (`mode: 'adventure'`)
- Campaña individual modular de progresión por niveles. Consultar arquitectura detallada y receta para agregar niveles en [docs/aventura.md](docs/aventura.md).
- El rival de cada nivel es un **starter de Origins** de la clase del nivel (`STARTERS` en `src/axies.js`: cuerpos fijos de Spine del kit, fuera del roster elegible), y la ficha del nivel lo muestra vivo haciendo gestos:
  - **N1: Primeros Pasos** (Olek - Planta, Fácil): Fuerza + Maceta + Free Game (Pool: 62 cartas).
  - **N2: Defensa y Estrategia** (Momo - Pájaro, Fácil): + Huevo + Caracol (Pool: 74 cartas).
  - **N3: El Arte del Mercado** (Puffy - Pez, Normal): + Pulpo + Veneno (Pool: 86 cartas, 6 clásicos completos).
  - **N4: Furia de la Naturaleza** (Buba - Bestia, Normal): Garra Brutal + Hoja (reemplazan Fuerza y Maceta).
  - **N5: Sombras y Vuelo** (Pomodoro - Bicho, Duro): Greedy Leech + Pluma Sagrada (reemplazan Caracol y Huevo).
  - **N6: Duelo de Maestros** (Venoki - Reptil, Duro): Burbuja + Piel de Escamas (reemplazan Pulpo y Veneno).
- Persistencia de niveles completados y desbloqueados en `localStorage` (`axie-chance:adventure`) con desbloqueo hacia adelante al incorporar nuevos niveles.

### 3. Modo Tutorial Guiado (`mode: 'tutorial'`)
- Partida de 5 rondas guionadas que se aprende jugando: poco texto, una flecha y un brillo celeste. Lineamientos, decisiones y recorrido en [docs/tutorial.md](docs/tutorial.md).
- Una idea por ronda: **objetivo** (bajarle la vida al rival), **cadena** (más larga, más fuerte; la CPU se corta en cámara lenta), **corte** (la rueda de chances de verde a rojo) y el **centro** (tu color), el **Rocket Stamp** que sale del centro y el Rocket **salvando la cadena** para el remate.
- Gating por paso (`tutorialAllowed`, `tutorialPlainOnly`, `tutorialAllowedCard`) y ganchos del motor: `tutorialSkipDraft` (centro solo en las rondas 3 y 4) y `tutorialBotStandAt` (cuántas cartas roba la CPU). Termina en "¡TUTORIAL COMPLETADO!" con Ir a modo Aventura / Menú principal.

### 4. Modo Red / Multijugador (`mode: 'net'`)
- Partida online entre dos navegadores/dispositivos vía `?red`, desde cualquier país.
- **Sin servidor prendido**: la partida corre en el navegador de quien crea la sala (`src/rooms.js`); un relay por WebSocket (`relay/core.mjs`) solo lleva mensajes. En `npm start` el relay vive en `scripts/dev.mjs`; publicado, en Lambda + API Gateway + DynamoDB (pago por uso, sin costo fijo). **Decisión del dueño: no sumar recursos con costo fijo.**
- Si el anfitrión cierra la pestaña, la sala se cierra para todos; si se le corta el cable, vuelve con su llave y recupera a las pantallas.
- Salas con código de 4 letras, QR de invitación, sorteo de apertura ($50\%$), espectadores y reconexión por `clientId`.

---

## Motor de Inteligencia Artificial (CPU)

- **Algoritmo**: *Expectimax* con optimización de perfil de mazo (`deckProfile`) que reduce $96$ cartas a $\sim 41$ combinaciones de símbolos.
- **Dificultades (`STYLE`)**:
  - `facil`: Profundidad 1, margen 1.35 (juega conservadora/tímida), no persigue final.
  - `normal`: Profundidad 2, margen 1.0, juega el final (arriesga en última chance).
  - `duro`: Profundidad 3, margen 1.0, lookahead profundo de $\sim 70.000$ evaluaciones en 5 ms.
- **Valoración de Draft**:
  - Evalúa la **conectividad** de las cartas con el mazo propio.
  - Compara la rama de 2 cartas sin poder contra 1 carta con poder mediante la tabla `POWER_WORTH`:
    - `poison`: 1.70, `octopus`: 1.55, `bubble`: 1.55, `leech`: 1.45, `egg`: 1.30, `feather`: 1.30, `steelskin`: 1.30, `strength`: 1.25, `brutal`: 1.25, `leaf`/`oak`: 1.20, `freegame`: 1.20, `snail`: 1.15, `pot`: 0.95.

---

## Banco de Pruebas Automatizado (Tests)

Se ejecutan con `npm test` en Node.js puro usando `test/dom.mjs` como shim mínimo:

1. `test/rules.test.js`: Cadenas, puntaje cuadrático, dial de supervivencia, Free Game stack.
2. `test/styles.test.js`: Reglas CSS críticas, visibilidad de atributos `hidden`, paleta y texturas.
3. `test/match.test.js`: Flujo de partida completa vs bot en todas las dificultades y Última Chance.
4. `test/powers.test.js`: Los 12 poderes de clase + Free Game apilable + compatibilidad con Oak.
5. `test/ui.test.js`: Montaje en DOM, botones de control, escudos, status badges, perspectivas p1/p2.
6. `test/lobby.test.js`: Portada, paseo continuo de 1000 iteraciones, selector de Axies y mejoras (+).
7. `test/versus.test.js`: Partida local 2P en una sola pantalla sin conexión de red.
8. `test/net.test.js`: Sala (`rooms.js`), relay con almacén en memoria (crear, listar, entrar, reenviar, cortes, llave, cierre), empaquetado de estados y cable real contra `npm start` con WebSocket.
9. `test/netui.test.js`: UI multijugador de los dos lados (pantalla que entra y anfitrión), envíos desordenados, reconexión, vista de espectador, estado Listo y QR de invitación.
   - `test/qr.test.js`: estructura del QR (versión, ojos, líneas de tiempo, formato BCH) y el link de la sala según dónde corre el juego.
10. `test/motion.test.js`: Motor de animaciones Web Animations API y variantes de gestos.
11. `test/audio.test.js`: Motor de audio Web Audio API, niveles de volumen y muting.
12. `test/tutorial.test.js`: Presupuesto de texto (≤ 6 palabras, ≤ 2 burbujas por ronda, sin modales), mazos guionados (rueda, corte, Rocket) y partida guiada de punta a punta hasta la victoria.
13. `test/adventure.test.js`: Configuración de 6 niveles, pools escalonados, progresión y persistencia.
---

## Infraestructura y Despliegue en AWS

- **CDK Stack (`infra/lib/axie-chance-stack.ts`)**:
  - Bucket **S3 Privado** (`SiteBucket`): Bloqueo total de acceso público, cifrado gestionado, SSL forzado.
  - Distribución **CloudFront** (`SiteDistribution`): Origen S3 vía **Origin Access Control (OAC)**, redirección forzada a HTTPS, política de compresión y caché optimizada, encabezados de seguridad (`SECURITY_HEADERS`).
  - Enrutamiento SPA: Errores HTTP 403 y 404 redirigen a `/index.html` con código 200 y TTL de 1 min.
  - Invocación de despliegue con invalidación automática de caché `/*`.
  - Relay de salas: tabla DynamoDB on-demand con TTL, Lambda Node 22 ARM (`relay/`), API Gateway WebSocket (stage `net`, throttle 50 rps / ráfaga 100) con una integración por ruta (compartirla deja permiso solo para `$connect`). El deploy escribe `net.json` con la URL `wss://` del relay.
- **Comando de Deploy**:
  ```sh
  npm run deploy
  ```
  Empaqueta con `npm run build` y ejecuta `cd infra && npx cdk deploy --require-approval never --profile dev`.

---

## Reglas Críticas para Desarrolladores y Agentes

1. **No editar archivos generados**: `src/axie-avatars.js`, `src/axie-poses.js`, `src/audio-clips.js`, `src/vfx-clips.js`. Si se alteran avatares o sonidos, usar sus scripts de `npm run`.
2. **`game.js` debe permanecer libre de efectos**: No importar `document`, `window`, AudioContext ni librerías de red en `game.js` ni en `rules.js`.
3. **Perspectiva de Asientos**: El motor habla de asientos `p1` y `p2`, nunca de "humano y máquina". Quién controla cada asiento lo define el modo de juego (`isBotSeat`).
4. **Semillas y Determinismo**: Usar siempre `makeRng(seed)` cuando se requiera reproducibilidad en tests o simulaciones.
5. **Cero dependencias externas en runtime**: Mantener la pureza del stack web sin frameworks.
6. **Build de un solo archivo**: `scripts/build.mjs` concatena los módulos sin envolverlos. Todo módulo nuevo de `src/` va en `MODULES` (en orden de dependencias) y ningún nombre de nivel superior puede repetirse entre archivos: si no, `dist/` sale roto aunque `npm test` pase.
7. **Internacionalización (i18n)**: Todo texto visible nuevo pasa por `tr()` y lleva su entrada en `EN_STRINGS` (`src/i18n-en.js`). El texto en español es la clave de traducción y fallback por defecto.

<!-- BEGIN AWS Agent Toolkit rules -->
# AWS Guidance

- Where these AWS rules conflict with the project's own instructions, the
  project's instructions take precedence.
- Prefer the AWS MCP Server for AWS interactions — it provides sandboxed
  execution, observability, and audit logging. If unavailable, use the
  AWS CLI directly.
- Before starting a task, check whether a relevant AWS skill is available.
  Load the skill with `retrieve_skill` and prefer its guidance over
  general knowledge.
- When uncertain about specific AWS details (API parameters, permissions,
  limits, error codes), verify against documentation rather than guessing.
  State uncertainty explicitly if you cannot confirm.
- When creating infrastructure, prefer infrastructure-as-code (AWS CDK or
  CloudFormation) over direct CLI commands.
- When working with infrastructure, follow AWS Well-Architected Framework
  principles.
- Do not use em dashes in AWS resource names or descriptions. Use
  hyphens instead.

## Secret Safety

- MUST load the `aws-secrets-manager` skill first for any secret,
  credential, API key, token, or password task. MUST NOT call
  `secretsmanager get-secret-value` or `batch-get-secret-value`, and MUST
  NOT hit the Secrets Manager Agent daemon directly. MUST use
  `{{resolve:secretsmanager:secret-id:SecretString:json-key}}` with
  `asm-exec` so the secret resolves at runtime without entering context.
<!-- END AWS Agent Toolkit rules -->
