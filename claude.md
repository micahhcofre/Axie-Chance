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
- **Tests**: Corren en Node.js puro usando un DOM shim ultraligero (`test/dom.mjs`), sin frameworks pesados ni dependencias externas (usa `node:assert/strict`).
- **Convención de idiomas**: Código fuente (variables, funciones, clases, identificadores) en **inglés**; UI, comentarios explicativos, textos y documentación en **español**.
- **Infraestructura AWS**: Código de infraestructura como código (IaC) en TypeScript con **AWS CDK v2** bajo la carpeta `infra/`.

---

## Comandos del Proyecto

```sh
npm start              # Servidor dev con live reload + servidor de salas en red (http://localhost:8000)
npm test               # Ejecuta las 14 suites de test unitarios e integración en Node
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

- **`game.js`** es el corazón lógico agnóstico: desconoce la existencia del DOM, Web Audio o WebSockets/SSE.
- La reactividad se maneja mediante el patrón observador: `game.subscribe(fn)` (o `game.on('change', fn)`), notificando a `ui.js`, `audio-cues.js`, etc.

---

## Mapa de Archivos Clave

| Archivo / Carpeta | Propósito y Responsabilidades |
|---|---|
| **`src/data.js`** | Taxonomía canónica, clases, partes anatómicas, saltos, tríadas canónicas, fórmula de supresión de counters, Axie Core (Part Evolution), 12 poderes de clase (`POWERS`), Free Game, `TUNING`, `buildPool()`, `baseDeck()`, `buildPersonalDeck()`, `makeRng(seed)`. |
| **`src/rules.js`** | Funciones matemáticas puras: `scoreChain()`, `survivalOdds()`, `timesIn()`, `emptyChain()`, `playCard()`, `isScoringCell()`, `stackOnCard()` (apilado de Free Game). Sin efectos secundarios. |
| **`src/game.js`** | Máquina de estados: `createGame()`, turnos, robo (`hit`), plantarse (`stand`), draft del mercado (`takeCard`, `skipDraft`), renovación del mercado (`renewMarket`), apilado (`chooseStackTarget`), reloj de turno y draft, abandono (`forfeit`), cálculo de daño (`swingOf`), vida (`hpOf`), última chance (`lastChance`). |
| **`src/ai.js`** | Toma de decisiones de la CPU: `decideDraw()` (expectimax con lookahead 1-3 según dificultad), conectividad de cartas (`connectivity()`), valoración de poderes (`POWER_WORTH`), selección de draft (`planDraft()`, `pickBest()`, `pickBonus()`). |
| **`src/ui.js`** | Renderizado reactivo de la mesa en `#arena`: render de cartas, rachas, HUD, barras de vida, escudos, status badges (veneno, hojas, caracol, etc.), dial de probabilidades (*odds*), controles de acción, selección interactiva de columnas para Free Game. |
| **`src/lobby.js`** | Interfaz principal: portada con paseo de Axies (*strollers*), selector de modo de juego (Aventura, Solo CPU, Red), selector de Axie con asignación de mejoras (+), lanzador de tutorial, modales de reglas y enciclopedia de símbolos. |
| **`src/adventure.js`** | Modo Aventura: campaña secuencial de 6 niveles con dificultad escalonada, desbloqueo progresivo de poderes de clase (2 por nivel hasta 12), pool de mercado escalonado y persistencia en `localStorage` (`axie-chance:adventure`). |
| **`src/tutorial.js`** | Tutorial guiado interactivo de 5 rondas: mazos guionados, overlay dual (*coach banner* y diálogo modal), bloqueo estricto de acciones (*action gating*), aprendizaje de la fórmula $L^2$, corte de cadena, draft de poderes y Última Chance. |
| **`src/net.js`** | Cliente de red para multijugador: conexión SSE (`EventSource`) para recepción de estados y `fetch` (POST) para envío de acciones. Código de sala de 4 letras, reconexión mediante `clientId` en `sessionStorage`. |
| **`src/loadout.js`** | Carga y guardado persistente del Axie seleccionado y sus mejoras de cartas (+) en `localStorage` (`axie-chance:loadout`). |
| **`src/axies.js`** | Roster de los 6 Axies canónicos (Colmillo, Marea, Racha, Brote, Aguijón, Escama), mapeo de clases y partes cosméticas. |
| **`src/axie-motion.js`** | Animaciones de Axies mediante Web Animations API (posturas base, respiración, ataques, impactos, victoria, derrota). |
| **`src/audio.js`** | Motor de sonido con Web Audio API: reproducción de SFX, música de fondo en loop, control de volumen maestro y muteo. |
| **`src/audio-cues.js`** | Orquestador de sonido: inspecciona las diferencias de estado (`lastHit`, cambios de fase, bust) y dispara los SFX adecuados. |
| **`src/vfx.js`** | Animaciones de efectos visuales (golpes, chispas, veneno) basadas en atlas de sprites y `requestAnimationFrame`. |
| **`scripts/dev.mjs`** | Servidor de desarrollo HTTP con live reload vía SSE (`/__dev`) y servidor de salas de juego multijugador. |
| **`scripts/net.mjs`** | Lógica de salas en servidor: ejecuta instancias de `createGame()` y transmite estados redactados (`redact()`) a los clientes. |
| **`scripts/build.mjs`** | Empaquetador a un único archivo `dist/axie-chance.html` con todos los recursos e iconos incrustados como data URIs. |
| **`scripts/balance.mjs`**| Banco de pruebas automatizado: simula miles de partidas con semillas controladas para medir el balance de los poderes. |
| **`infra/`** | Proyecto AWS CDK en TypeScript para desplegar el sitio estático sobre S3 privado con CloudFront (OAC). |
| **`test/`** | Banco completo de 14 suites de pruebas automatizadas ejecutadas directamente con Node.js puro. |

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

| Clase | Poder | ID | Activación y Mecánica Detallada |
|---|---|---|---|
| **Bestia** | **Fuerza** | `strength` | **+1 permanente de daño** en este ataque y todos los futuros. Acumulable. Requiere `swing > 0`. |
| **Bestia** | **Garra Brutal** | `brutal` | Suma **+2 de daño por cada símbolo de tu cadena más larga**. Se activa siempre. Requiere `swing > 0`. |
| **Pez** | **Pulpo** | `octopus` | Otorga **1 pick extra del mercado** por cada pulpo (fase bonus del draft). Requiere no haberse cortado (`!busted`), no requiere daño. |
| **Pez** | **Burbuja de Retorno** | `bubble` | **Redirige tu pick de draft para abrir tu próxima ronda**. Con múltiples burbujas, fusiona cartas del tope de tu mazo en una **carta gigante** multi-símbolo. Requiere `!busted`. |
| **Pájaro** | **Huevo** | `egg` | Otorga un escudo protector de $\lfloor \text{swing} / 2 \rfloor$. **No se acumula** (se reemplaza por uno nuevo). Al romperse, inflige **8 de daño fijo acumulable (`eggBreak`)** de contraataque directo al agresor. Requiere `swing > 0`. |
| **Pájaro** | **Pluma Sagrada** | `feather` | Inflige **5 de daño directo inmediato** al rival **apenas se roba la carta**. No se pierde si la cadena se corta. Ignora escudos y caracoles. |
| **Planta** | **Maceta** | `pot` | **Te curás exactamente lo mismo que pegaste** este turno (hasta el tope de 100 HP). Requiere `swing > 0`. |
| **Planta** | **Hoja (Leaf)** | `leaf` *(alias `oak`)* | Otorga **+2 hojas** al plantarte con éxito (tope 5). Al final de cada uno de tus turnos, **cura 4 HP por hoja y consume 1 hoja**. La curación ocurre incluso si ese turno luego se corta. Requiere `swing > 0` para ganar hojas. |
| **Bicho** | **Caracol** | `snail` | Añade 1 carga de debilidad al rival. El próximo ataque del rival **hace la mitad del daño** ($\lceil \text{hit} / 2 \rceil$). Acumulable en cantidad de ataques. Requiere `swing > 0`. |
| **Bicho** | **Greedy Leech** | `leech` | Al atacar, **roba 6 de vida al rival** (daño + curación). Con 4 o más columnas en mesa, el drenaje se duplica a **12 HP**. Requiere `swing > 0`. |
| **Reptil** | **Veneno** | `poison` | Envenena al rival con $\lfloor \text{swing} / 2 \rfloor$. Al finalizar el turno del jugador envenenado: el veneno muerde (resta vida), se divide a la mitad ($\lfloor v / 2 \rfloor$) y si queda $\le 2$ se disipa. Acumulable. Requiere `swing > 0`. |
| **Reptil** | **Piel de Escamas** | `steelskin` | Establece un **blindaje que limita el próximo golpe rival a un máximo de 12 de daño**. Cada acumulación reduce el tope en -2 (12 $\to$ 10 $\to$ 8) con piso mínimo de 6. Se consume al recibir daño. Requiere `swing > 0`. |
| **Neutral** | **Free Game** | `freegame` | **Comodín apilable (15 cartas en pool)**. Al robarla se corta si no comparte símbolos vivos; al entrar con éxito, tu próximo robo alarga una carta existente sumando sus símbolos. |

---

## Modos de Juego

### 1. Solo vs CPU (`mode: 'cpu'`)
- Partida estándar contra bot con dificultad seleccionable (`facil`, `normal`, `duro`).
- Humano siempre abre (p1); bot siempre cierra (p2).
- Pool completo de 86 cartas (35 sin poder + 36 con poder + 15 Free Game).

### 2. Modo Aventura (`mode: 'adventure'`)
- Campaña individual de **6 niveles** de progresión:
  - **N1: Primeros Pasos** (Brote - Planta, Fácil): Fuerza + Maceta + Free Game (Pool: 62 cartas).
  - **N2: Defensa y Estrategia** (Racha - Pájaro, Fácil): + Huevo + Caracol (Pool: 74 cartas).
  - **N3: El Arte del Mercado** (Marea - Pez, Normal): + Pulpo + Veneno (Pool: 86 cartas, 6 clásicos completos).
  - **N4: Furia de la Naturaleza** (Colmillo - Bestia, Normal): Garra Brutal + Hoja (reemplazan Fuerza y Maceta).
  - **N5: Sombras y Vuelo** (Aguijón - Bicho, Duro): Greedy Leech + Pluma Sagrada (reemplazan Caracol y Huevo).
  - **N6: Duelo de Maestros** (Escama - Reptil, Duro): Burbuja + Piel de Escamas (reemplazan Pulpo y Veneno).
- Persistencia de niveles completados y desbloqueados en `localStorage` (`axie-chance:adventure`).

### 3. Modo Tutorial Guiado (`mode: 'tutorial'`)
- Partida de 5 rondas 100% guionadas con overlay educativo dual (*coach banner* y modal dialog).
- Control estricto de gating (`tutorialAllowed`: `hit`, `stand`, `draft`, etc.): el usuario no puede cometer errores destructivos.
- Enseña paso a paso: Apertura y fórmula $L^2$, riesgo y corte deliberado (*bust*), penalización de draft, obtención de carta con poder (Maceta), ejecución de combo colosal (75 pts) y remate final en Ronda 5 con demostración de la Última Chance.

### 4. Modo Red / Multijugador (`mode: 'net'`)
- Partida online entre dos navegadores/dispositivos vía `?red`.
- Servidor SSE + POST en `scripts/net.mjs` y `scripts/dev.mjs`.
- Salas con código de 4 letras, sorteo de apertura ($50\%$), soporte para espectadores y reconexión por `clientId`.

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
8. `test/net.test.js`: Servidor real en localhost, salas, SSE, POST, sincronización y desconexiones.
9. `test/netui.test.js`: UI multijugador, lobby de salas, vista de espectador y estado Listo.
10. `test/motion.test.js`: Motor de animaciones Web Animations API y variantes de gestos.
11. `test/audio.test.js`: Motor de audio Web Audio API, niveles de volumen y muting.
12. `test/tutorial.test.js`: Gating estricto, flujo de 5 rondas del tutorial, overlays y victoria.
13. `test/adventure.test.js`: Configuración de 6 niveles, pools escalonados, progresión y persistencia.
14. `test/power-demos.test.js`: Demostraciones de poderes por nivel, preferencias guardadas y controlador en DOM.

---

## Infraestructura y Despliegue en AWS

- **CDK Stack (`infra/lib/axie-chance-stack.ts`)**:
  - Bucket **S3 Privado** (`SiteBucket`): Bloqueo total de acceso público, cifrado gestionado, SSL forzado.
  - Distribución **CloudFront** (`SiteDistribution`): Origen S3 vía **Origin Access Control (OAC)**, redirección forzada a HTTPS, política de compresión y caché optimizada, encabezados de seguridad (`SECURITY_HEADERS`).
  - Enrutamiento SPA: Errores HTTP 403 y 404 redirigen a `/index.html` con código 200 y TTL de 1 min.
  - Invocación de despliegue con invalidación automática de caché `/*`.
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
