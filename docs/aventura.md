# Modo Aventura: Arquitectura, Extensión y Guía del Sistema

Cómo está armado el **Modo Aventura** de *Axie Chance*: la campaña, cómo se derivan los niveles, los rivales y lo que traen, los jefes, el mapa, el progreso guardado y la receta para agregar niveles o rivales. Las reglas para el jugador (la tabla de los niveles) están en [rules.md](../rules.md#modo-aventura). El plan para llegar a 200 niveles está en la §8.

---

## 1. La campaña en una línea por idea

- **200 niveles en 20 capítulos de 10**, uno por tierra del mapa, con el jefe en el 10: el Valle (plaza y otoño), la Costa (playa y bahía pirata), el Bosque Nevado, la Guarida, el Coliseo, el Bosque de Otoño, la Jungla, la Laguna, la Isla del Verano, la Meseta, el Cañón Rojo, el Cielo, la Caverna, el Desierto, el Ocaso, el Bosque Nocturno, el Salón de Invierno, los Engranajes, el Mar Violeta y el Amanecer. Del sexto en adelante, cada capítulo pelea en su propio escenario.
- **Tres tramos, de menos a más**: fácil hasta el 60, medio hasta el 130, difícil hasta el 200. La CPU es fácil en los capítulos 1 y 2, normal hasta el 130 y dura de ahí al final, y la vida de los rivales comunes sube por tramos (`RIVAL_HP`).
- **Poderes nuevos hasta el 175, de a poco**: primero los 12 amuletos neutrales (tres en el nivel 1, uno cada tres niveles hasta el 28) y después los 30 de clase, parejos del 33 al 175 (`UNLOCK_ORDER`, `UNLOCK_LEVELS` en `src/adventure.js`). Del 176 al 200 lo nuevo es el rival.
- **Cada nivel, su combinación fija y única** (`levelPowers`): sin sorteo, el que estrena siempre, hasta seis y uno por clase, rotando los que hace más que no salen. Ningún nivel repite la de otro, y nada abierto pasa más de diez niveles sin salir.
- **Lo desbloqueado vuelve**: en cada partida se sortea un poder por clase entre los ya desbloqueados de esa clase, y el del nivel entra siempre (`adventurePowers`).
- **La escalera del rival** (`RIVAL_LADDER`): lo que trae de más crece de a poco, de lo más barato de conseguir para un jugador a lo más caro: cartas de mochila comunes de su clase (desde el 3), que después se fusionan en poco comunes (desde el 23) y raras (desde el 43), y partes evolucionadas (desde el 31). **Nunca más de 4 cartas de mochila, el mismo tope que el tuyo**, y nunca algo que el jugador no pueda tener a esa altura (§5).
- **Jefes**: el nivel 10 de cada capítulo —veinte—, **un escalón de la escalera más arriba** que su nivel, casi enteros de partes coleccionables (místicas, de Japón, de Navidad, de verano, de Agamo y Shiny) y con cuerpos especiales. Pagan el doble (`BOSS_PAY` en `payout.js`). Más vida (`hp`), cuerpo o partes de evento/místicas, y amuletos (`charms`) cuyo poder se **sortea en cada partida** de un pozo propio (`charmPowers`): un jefe no pelea siempre igual.
- **Se juega con el roster**: los seis starters de Origins y los seis del mixer. Los starters ya no son rivales.

---

## 2. Arquitectura y responsabilidad de módulos

```
src/axies.js            RIVALS (los 30 rivales), axie('lobo+2'), deckFor(id, …, { charm })
src/adventure-levels.js ADVENTURE_CHAPTERS + ADVENTURE_CAMPAIGN (datos puros)
          ↓
src/adventure.js        buildAdventureLevels, adventurePowers, evolvedAt, adventureChapters,
                        progreso en localStorage
     ↓             ↓                 ↓
src/lobby.js   src/game.js       src/ui.js / result.js
(mapa, ficha)  (rival, mazo,     (final y "Siguiente nivel")
               poderes, vida)
```

- **`src/axies.js`**
  - `RIVALS`: cada rival con su clase, color, partes del mixer y, si hace falta, `body`/`skin` (cuerpo de evento y su paleta), `evolve` (orden en que evolucionan sus partes), `boss` y `charms` (las partes con amuleto).
  - `axie(id)` entiende ids con evoluciones: `'lobo+2'` es Lobo con sus dos primeras partes de `evolve` evolucionadas, con ese id completo y `evolved: ['tail', 'eyes']`. Así el dibujo, el nombre y el mazo viajan juntos en `state.axies`.
  - `deckFor(id, boosts, nftState, { charm })`: el mazo del Axie. Las partes evolucionadas usan Part Evolution (la carta suma el símbolo de la clase de la parte, `partClass`); con `charm` —un poder, o uno por parte (`{ horn: 'poison' }`)—, las cartas de las partes de `charms` llevan ese poder.
  - `partClass(key, owner)`: la clase de una parte para evolucionar. Las de evento (`japan-02`, `agamo-00`, `summer-a`, `xmas-01`) cuentan como de la clase del que las lleva; `npm run axies` verifica contra la tabla de genes del mixer que de verdad lo sean.
- **`src/adventure-levels.js`**: solo datos. `ADVENTURE_CHAPTERS` (nombre y tamaño de cada capítulo) y `ADVENTURE_CAMPAIGN`.
- **`src/adventure.js`**
  - `buildAdventureLevels(campaign)` valida y deriva: `id`, `base` (el rival declarado), `rival` (con evoluciones), `evolved`, `boss`, `newPowers` (lo del calendario), `unlocked` (todo lo estrenado hasta ahí), `activePowers` (la combinación fija), `extras` (las cartas de mochila del rival) y `charmPowers` (los amuletos de un jefe: los de su combinación).
  - `RIVAL_LADDER`, `rivalKitAt(id, { boss })` (lo que trae el rival a esa altura: rarezas de sus cartas y partes evolucionadas; el jefe, un escalón más), `evolvedAt(id)` y `rivalExtras(tiers, { id, cls, unlocked })` (las rarezas hechas cartas: la común es un símbolo de su clase y cada rareza más es esa carta fusionada; el azar sale del número de nivel, así el panel las muestra antes de pelear).
  - `RIVAL_HP`, `rivalHpAt(id)`: la vida de los rivales comunes por tramo (los jefes dicen la suya). Va en `hp` del nivel cuando no es 150, y el panel la muestra.
  - `adventurePowers(level, rng)`: los poderes de una partida. `adventureCharms(level, rng)`: el poder de cada parte con amuleto de un jefe, sorteado de su pozo (con un pozo de uno no gasta el azar).
  - `levelKicker(level)` ("Nivel 7", "Jefe", "Jefe Final") y `levelTitle(level)`: el número sale del id, no del nombre.
  - `adventureChapters()`.
  - Progreso: `getAdventureProgress`, `markLevelCompleted`, `isLevelUnlocked`, `nextLevelId`, `isFinalLevel`, `resetAdventureProgress` (clave `axie-chance:adventure`, versión `PROGRESS_VERSION`, ver §6).
- **`src/game.js`** (`newMatch({ mode: 'adventure', adventureLevel })`): el rival es `advCfg.rival` y lleva **las cartas de mochila de su nivel** (`advCfg.extras`, sumadas a su mazo como las tuyas), los poderes salen de `adventurePowers(advCfg, rng)`, el mazo del jefe lleva los amuletos de `adventureCharms(advCfg, rng)`, y `state.maxHp.p2 = advCfg.hp`. La vida se lee siempre con `maxHpOf(state, player)`. `state.adventure` lleva `boss`, `evolved` y el nombre entero (`levelTitle`); con un jefe suena la música de jefe desde el principio (ver `audio-cues.js`).
- **`src/adventure-map.js`**: el mundo (sección 4): los lugares, el camino, los niveles, tu Axie y su salto. Se pinta de a una tierra (`zoneContent`, `landDefsHtml`; ver §4).
- **`src/rival-poses.js`**: las poses de los rivales de a un capítulo (ver §4.2).
- **`src/lobby.js`**: maneja el mapa (nivel elegido, scroll, arrastre, el detalle) y pinta el panel del nivel. En el naipe va lo que estrena el nivel (`Nuevo`) o, si no estrena poder, **la mochila del rival** (`Rival`): sus cartas como en la mesa, con la gema de su rareza. En el detalle, además, la mochila del rival, los demás poderes de la combinación del nivel y los amuletos de un jefe.

---

## 3. Esquema de un nivel

```javascript
{
  name: tr('Umbra, la Pesadilla'), // solo el título: "Nivel 40" o "Jefe" lo pone levelKicker
  description: tr('…'),
  rival: 'umbra',          // id de RIVALS
  stage: 'guarida',        // id de STAGES
  difficulty: 'normal',    // 'facil' | 'normal' | 'duro'
  newPowers: ['cocoon'],   // opcional: pisa lo que estrena según el calendario (la campaña no lo usa)
  charmPowers: ['cocoon', 'leech'], // opcional: los amuletos de un jefe, en orden (si no, los de su combinación)
  hp: 160,                 // opcional: la vida del rival (los jefes)
  showcase: ['freegame'],  // opcional: algo más para mostrar en la ficha
  activePowers: [...],     // opcional: pisa la combinación fija del nivel
  evolved: 2,              // opcional: pisa la evolución de la escalera
  extras: [{ symbols: ['bug', 'plant'] }], // opcional: pisa las cartas de mochila de la escalera
}
```

Validación (`npm test` rompe si algo está mal): nombre y descripción, dificultad, rival de `RIVALS`, escenario de `STAGES`, poderes existentes y **no repetidos entre niveles**, un solo poder por clase en `newPowers` y en `activePowers`, `hp` entero positivo, cartas de mochila válidas y **no más de `EXTRA_SLOTS` (4)**, y un pozo de amuletos solo en un rival con partes con amuleto y solo con poderes ya desbloqueados.

### El esquema de un rival

```javascript
umbra: {
  id: 'umbra', class: 'bug', name: 'Umbra', color: 4, boss: true,
  body: 'body-nightmare', skin: 3,         // cuerpo de evento: 1 escarcha, 2 verano, 3 pesadilla
  parts: { eyes: 'bug-02', ears: 'aquatic-12', mouth: 'japan-03', horn: 'agamo-01', back: 'beast-10', tail: 'japan-01' },
  evolve: ['ears', 'back', 'horn', 'mouth', 'tail', 'eyes'],  // opcional; si no, PART_TYPES
  charms: ['horn', 'tail'],                // solo jefes
},
```

Las partes comunes salen de `PART_CATALOG` (en `axie-avatars.js`). Las de evento y místicas son las que el mixer trae en la tabla de genes: se listan con el script de exploración del mixer (ver `scripts/axies.mjs`), y tienen que ser de la clase del rival.

---

## 4. El mapa

La pantalla entera es **un solo mundo dibujado en código**, que se arma por módulos. Lo que manda son los niveles: el camino se genera pasando por ellos, así camino y niveles son una sola cosa (nada se calca de un dibujo). Tres archivos, en capas:

- **`src/map-world.js`: qué hay y dónde** (puro, sin DOM). Cada capítulo es una **tierra** de `WORLD_LANDS`, un módulo que dice su paleta (suelo, manchas, camino, losa de los niveles), su **kit** de piezas (qué crece ahí, con qué peso, de qué tamaño y a qué distancia del camino: cerca, a media distancia o lejos), su agua (el arroyo del Valle, la bahía de la Costa, el lago helado, el río de la Guarida, el oasis del Coliseo), el hito de su jefe y su `pattern`: dónde cae cada uno de sus diez niveles a lo ancho de la franja del camino. Cada capítulo mide lo que piden sus niveles (`chapterLength`: la entrada, un `gap` por nivel y la salida), y el mundo guarda dónde empieza cada uno (`world.starts`). `WORLD_ORDER` encadena las tierras. `buildWorld(chapters, orient)` arma los datos: los niveles cada `gap` a lo largo de su capítulo; el camino, una curva Catmull-Rom que sale de la puerta de la casa del comienzo (hacia adelante, y dobla al costado del cartel antes de seguir: la fogata queda del otro lado y ni la casa ni el fuego quedan debajo del sendero), pasa por cada nivel (con un punto de curva entre dos niveles y dos entre capítulos) y termina en la puerta del Coliseo; el agua con sus puentes donde cruza el camino y el muelle de la Costa; el hito de cada jefe parado detrás de él; los carteles; y el **decorado** con azar sembrado (`makeRng`): denso lejos del camino, ralo cerca, y nunca encima del camino, del agua, de un nivel (con lugar para su rival), de un hito, de un cartel o de la casa. En las costuras las tierras se mezclan (`seam`; parado, más larga, porque el teléfono ve todo el ancho del mundo y la mezcla ocupaba poca pantalla): el suelo y el camino en degradé, el suelo de cada tierra se mete en la de al lado a manchones, los charcos, las pinceladas, las marcas y los bordes oscuros pasan la costura apagándose (de cada tierra, la mitad en la costura y nada `seam` más allá), y las piezas de una y otra se sortean según la distancia. Nada se recorta en seco en el borde de una tierra. `worldArt(world)` lo dibuja en un SVG, como un fondo de pelea visto de arriba: el suelo de cada tierra con charcos suaves de sombra fría hacia los bordes y de luz cálida sobre el camino, pinceladas secas inclinadas y las marcas de su suelo; el agua mate con pinceladas más claras en vez de espuma; el camino (un halo frío, la huella clara y pinceladas a lo largo); los puentes; las piezas y los hitos por `<use>`, ordenados de atrás para adelante; los bordes oscuros y sin foco, como el primer plano de los fondos de pelea; y un grano parejo arriba de todo.
- **`src/map-art.js`: cómo se dibuja cada pieza.** Fábricas SVG pintadas como los fondos de pelea de Origins (`Backgrounds/stage-*`, la misma paleta de cada tierra): mate, **sin contornos y sin brillos**. La luz no es un punto blanco sino un plano entero y cálido, con el borde en racimos como una pincelada (las copas se arman con `artCanopy`: la sombra fría abajo, el tono medio, el golpe de luz arriba a la izquierda y unas pinceladas secas encima); la sombra no es el mismo color más oscuro sino otro, frío (lavanda en el Valle, azul en la Costa, celeste en la nieve, índigo en la Guarida, malva en el Coliseo), y la que tiran las piezas al piso es un degradé suave de ese color. Las mismas fábricas dan las piezas de cada tierra con otra paleta. Los hitos de los jefes salen de su fondo de pelea: los tótems tallados del Valle, el barco pirata en la bahía, el árbol sagrado con su soga y su hueco de luz turquesa, la calabaza gigante de la Guarida (una linterna de calabaza encendida por dentro, con la cara tallada de `Fear_Face` del kit, el tallo con su hoja, las guías por el suelo y calabacitas alrededor; los gajos se arman con `artGourd`), y el Coliseo; y la casa de techo de hongo del comienzo. Las luces (farolitos, faroles de papel, braseros, velas, ventanas, el hueco del árbol, la cara de la calabaza) van en la misma pieza que las emite.
- **`src/adventure-map.js`: el mapa en la pantalla.** El mundo se arma una vez por orientación (`worldFor`) y encima va lo que cambia con el progreso: el **sendero de oro** desde la casa hasta el nivel abierto más lejano, y un velo con una **pared de nubes** desde la primera tierra cerrada. Encima, lo que se toca: los niveles, los carteles de capítulo, el clima de cada tierra y tu Axie.

**Dos orientaciones.** Todo se genera en coordenadas del viaje (`u` a lo largo, `v` a lo ancho) y se pasa a la pantalla al final: de costado (`h`, pantallas apaisadas) el viaje va de izquierda a derecha y el mapa mide el alto de la pantalla; en un teléfono parado (`v`, la misma regla que pone el panel a todo el ancho) va de abajo para arriba y mide el ancho. Las piezas se paran siempre derechas. `WORLD_ORIENT` dice el ancho del mundo en cada una, la franja del camino (de costado, entre la barra y el panel), lo que se deja libre alrededor de cada nivel y cuánto lugar tiene el comienzo. Al girar el teléfono el mundo se rearma parado en el mismo nivel.

- **Los niveles** son los íconos de etapa del kit (`PvE/UI/Chapter/icon_stage_{normal,elite,boss}.png`: común, rival evolucionado, jefe), del mismo tamaño en todas partes (`--node`), parados sobre una losa del color de su tierra, con el número en la tabla de madera de los botones del juego. Ganado: la estrella del kit, **dorada si fue por K.O. y apagada si no** (`starredLevels`, ver §6). Cerrado: sin color. El próximo lleva la flecha del kit (`TargetPointer/arrow.png`). El elegido se para sobre el aro del kit (`BattleUis/base.png`, el mismo del que juega en la mesa).
- **Un toque elige, otro juega.** Tocar un nivel lo elige y muestra su panel; tocar otra vez el elegido arranca la partida (igual que el botón de pelear).
- **Los rivales y el cara a cara.** El rival de cada nivel abierto —los ganados y el que toca pasar— está **parado en el piso al costado de su nivel**, del lado del camino que sigue, cortándolo; los de los niveles cerrados todavía no llegaron (no hay ni su dibujo). Están **vivos**: respiran y cada tanto hacen un gesto, cada uno a su ritmo (`watchRivals` en `lobby.js`, con los dibujos alternativos que necesitan los gestos); un `IntersectionObserver` anima solo los que están cerca de la pantalla y deja quietos los demás. Así nada aparece de golpe al tocar un nivel. El que toca pasar llega cayendo al abrir el mapa. Tu Axie (también vivo) se para del otro lado del nivel elegido, en la misma línea, mirando a su rival; nadie flota arriba del nivel. De costado el camino sigue siempre a la derecha; parado, `levelSpot` mira para dónde dobla el camino después del nivel (`ahead`) y el rival va de ese lado. `buildWorld` deja libre de decorado la franja de los dos costados de cada nivel (`WORLD_ORIENT.duel`, más ancha en los jefes). Al elegir otro nivel, tu Axie **camina por el camino a saltitos** hasta allá, también de una tierra a otra (`walkHero`: un FLIP medido que sale de donde se lo ve, aunque esté a mitad de otra caminata, sigue el tramo de camino entre los dos niveles sin pasar por encima de sus íconos y hace el viaje más largo en dos segundos y medio); el mundo se corre hasta dejar el elegido en el medio de lo que se ve.
- **El cartel de cada capítulo** es la cinta de madera de los títulos (`.o-banner`) a la entrada de su tierra: clavado en un poste al costado del camino de costado, colgado sobre el camino parado. Si todavía no se llega, dice a qué jefe hay que vencer.
- **Arriba**, **tu perfil** en vez de un título (`src/profile.js`, pintado por `paintProfile` en `lobby.js`): tu Axie en el aro tallado del kit (`avatar_frame`), la chapita con tu nivel y la barra de experiencia (se llena con `scaleX`). La experiencia sale del progreso guardado —cada nivel superado da `PROFILE_XP.level` y cada estrella `PROFILE_XP.star`— y cada nivel del perfil pide 50 más que el anterior (`profileNeed`); así no hay nada más que guardar ni se desfasa del mapa. A la derecha, las estrellas. **Abajo**, el panel del nivel (`.o-panel`): el número del nivel en grande (sin el ícono de etapa, que ya está en el camino), el nombre, contra quién, la dificultad en tres marcas y la vida de un jefe; el poder que estrena en un naipe de nogal con la etiqueta «Nuevo»; la estrella del K.O. (dorada si ya es tuya) y **un solo botón de pelear**. El rival no se dibuja en el panel: ya está vivo en el mapa, al lado de su nivel. Tocar el naipe abre para arriba la historia, cada poder entero y los demás poderes del nivel.
- **Recorrerlo**: con el dedo, el scroll de siempre; con el mouse, la rueda (de costado la rueda corre el mundo) y el arrastre (un arrastre no elige el nivel de abajo); con el teclado, las flechas eligen el nivel anterior o el siguiente y Escape cierra el detalle.
- **Lo que se mueve** lo declara cada módulo y `worldLife` solo lo reparte, así una tierra o un hito nuevo trae su propio movimiento: en el `kit`, `sway` (cuánto se mece con el viento, y `share`, qué parte de esas piezas), `light` (dónde está su fuego y de qué color) y `low` (bajita: no tapa lo que se mece detrás); en la tierra, `life.wind` (ráfagas de aire en el Valle y la Costa, polvo de nieve en el Bosque, niebla que se arrastra en la Guarida, arena en el Coliseo) y `life.tumble` (las matas secas que ruedan por el desierto); en `WORLD_MARKS`, `afloat` (va en el agua y se mece: el barco) y `life` (luces que titilan o laten despacio y fuegos fatuos o luciérnagas: los ojos de los tótems, el hueco del árbol sagrado, la cara de la calabaza); la casa, en `WORLD_CAMP_LIFE`. Las nubes de las tierras cerradas también se mueven (`cloudHtml` en `adventure-map.js`): el velo es quieto, y encima cada copo de la pared y de las nubes sueltas respira y se corre de un lado a otro, y por el cielo de cada tierra cerrada cruzan nubes enteras; HTML dentro del `.adv-zone` de su tierra, así corre solo en la que se ve. El agua se mueve según su clase: los ríos y arroyos corren (rayitas giradas como el cauce, nunca sobre un puente), las lagunas abren anillos, el mar trae olas a la orilla, y todo brilla. Encima, las sombras de las nubes, la bandada y el clima de cada tierra (hojas, destellos, nieve, brasas, papelitos).
- **Movimiento y costo**: una curva (`--adv-ease`) y dos duraciones (`--adv-fast`, `--adv-mid`); solo `transform` y `opacity`. El dibujo es quieto (unas 2300 piezas en un SVG de ~300 KB, armado en ~25 ms la primera vez y guardado); el clima corre solo en la tierra que se ve (`data-inview`) y con `prefers-reduced-motion` no hay clima, ni caminata, ni scroll suave.

**De a una tierra.** Con veinte tierras el mundo son ~8000 piezas y ~1,8 MB de SVG, más doscientos rivales vivos: pintarlo entero trababa el teléfono. Así que se arma en dos partes. `buildWorld` arma el esqueleto de todo el viaje —niveles, camino, agua, hitos, carteles, decorado— y es barato (~90 ms para las veinte, con grillas espaciales donde antes se comparaba todo contra todo). El dibujo, en cambio, va por tierra: `worldZoneArt(world, c)` da las cuatro capas de la tierra `c` (lo pintado en el suelo, que pasa la costura; el agua, el camino y los puentes, recortados a su tierra; las piezas y los hitos, que se salen un poco; los bordes, que también pasan la costura, y el grano), sobre el suelo del mundo entero de una sola pieza (`worldGroundCss`, el fondo de `.adv-map`: con un suelo por tierra, cada costura dejaba una raya de un píxel), `worldBaseDefs` lo que comparten todas (los degradés del viaje, el camino, el grano, las luces) y `worldLandDefs` las piezas de cada tierra. En la pantalla (`worldHtml({ lazy: true })`) cada capa tiene un lugar vacío por tierra, y `lobby.js` (`watchArt`, `mountZone`, `unmountZone`) llena las que están a menos de una pantalla de lo que se ve y vacía las que se alejan: el dibujo, lo que se mueve, el clima, las nubes y los rivales de sus niveles abiertos (después de traer las poses de su capítulo). Parado, las piezas de las tierras de más arriba van detrás. Sin `IntersectionObserver` (los tests) sale todo pintado, y `worldArt` sigue dando el mundo entero en un solo SVG.

## 4.1. La entrada a un nivel

Entrar a un nivel —desde el mapa (el botón de pelear o el segundo toque sobre el nivel) o desde la pantalla final ("Siguiente Nivel", "Reintentar Nivel", o Enter)— pasa por `ui.enter`, que juega la transición de `src/loading.js`:

1. **El reparto.** Un muro de cartas boca abajo —el dorso de las cartas del juego: la madera con el rombo celeste de Axie— sale del nivel o del botón que se tocó, chiquito y girado, y cubre la pantalla carta por carta (de 3 a 7 cartas según la proporción de la pantalla). Suena el soplido y el robo de cartas. Cuando el muro tapa todo, la portada se cierra sin que se vea (`onCovered`).
2. **La previa, en bucle hasta que carga.** Encima del muro, apagado: el logo, el capítulo y el nivel, tu Axie y su rival frente a frente y vivos (con el VS de la sala, y la vida si es jefe), y una cadena con los seis símbolos que se enciende de a uno y vuelve a empezar. Mientras tanto `levelAssets` baja lo que la pelea necesita para verse entera desde el primer cuadro: el escenario (se le pregunta al CSS con una sonda `.arena[data-stage]`, así en `dist/` es el data URI), los dibujos de los dos (los mismos de la previa), el golpe de cada clase (`preloadVfx`), el primer tema de la música (`audio.prepare`, la de jefe en los jefes) y la letra del VS. La previa dura por lo menos `LOADING_BEAT.hold` y como mucho `LOADING_BEAT.max`: un dibujo que no llega no deja a nadie mirando cartas.
3. **La salida.** La cadena se prende entera ("¡A pelear!"), la previa se va, **recién ahí arranca la partida** (`restart`) —antes el reloj del turno correría detrás del muro— y, con la mesa ya pintada, las cartas se dan vuelta de a una, de izquierda a derecha, y dejan ver la arena mientras los dos caen en ella.

Todo lo que se mueve es `transform` y `opacity`. Con menos movimiento pedido no vuelan cartas pero igual se espera la carga; sin navegador que anime (los tests) la partida arranca en el acto. Un doble toque no reparte dos muros.

## 4.2. Las poses de los rivales, de a un capítulo

Cada rival con sus partes evolucionadas son ~20 KB de poses horneadas (sus pistas, sus dibujos alternativos). Doscientos rivales en `axie-poses.js` eran casi 4 MB en la carga inicial. Así que `npm run poses` deja en `axie-poses.js` el roster y los rivales del capítulo 1, y los de cada capítulo siguiente en `src/poses/rivales-NN.js`. `rival-poses.js` los pide cuando hacen falta —al montarse la tierra del capítulo en el mapa (`loadRivalPoses`) y en la previa del nivel (`loadPosesFor`, en `loading.js`)— y cada archivo se registra solo: suma sus pistas al final de `TRACKS` (las que ya estaban en la base las nombra por su número; las suyas, con números negativos) y sus poses y dibujos a `POSES` y `VARIANTS`. Sin las poses, un rival se dibuja quieto: no rompe nada. En `dist/` van todos los capítulos y se registran al cargar (`CHAPTER_POSES` en `scripts/build.mjs`).

**Partes que no se pueden hornear**: los ojos de verano (`summer-a`, `summer-as`) traen una capa de brillo y las orejas de verano una burbuja que el horno no sabe ubicar, y el cuerpo místico peludo tampoco. `npm run poses` junta todos los que fallan y los dice al final.

## 5. Balance

```sh
npm run balance -- --adventure               # 300 partidas por nivel
npm run balance -- --adventure --games 60 --levels 10,30,50
npm run balance -- --adventure --bare        # con un Axie pelado, para comparar
```

Un jugador simulado (juega como la CPU "normal") contra el rival de cada nivel. Lo que se lee es cuánto gana el rival y cuántas rondas dura. Sirve para el orden y los saltos, no como la dificultad que siente una persona: ese jugador pierde ~68% contra la CPU "normal" en partida suelta.

**El jugador esperado.** El jugador simulado no juega pelado: lleva lo que tiene alguien que llegó a esa altura del mapa (`EXPECTED` en `scripts/balance.mjs`), y la escalera del rival está pensada para no pasarse de eso. Los supuestos, con un Axie principal, ~5 niveles por día en lo fácil, 3 en lo medio y 2 en lo difícil, más las misiones (la curva de nivel del Axie y los precios en [economy.md](economy.md)):

| Nivel | ~Días | Nivel del Axie | Evoluciones | Mochila |
|---|---|---|---|---|
| 1–10 | 0–2 | 1–5 | 0 | nada (el que empieza no sabe de la mochila) |
| 11–60 | 2–12 | 5–18 | 1 desde el 31 | las del paquete de bienvenida que llevan su color |
| 61–100 | 12–25 | 18–25 | 2 desde el 66 | raras y poco comunes de su color; una épica desde el 81 |
| 101–160 | 25–55 | 25–38 | 3 desde el 116 | épicas y raras |
| 161–200 | 55–70 | 38–42 | 4 desde el 166 | épicas, una legendaria desde el 181 |

**La vida por tramo.** Como el rival crece igual que el jugador esperado, sin nada más cada tramo se sentiría igual que el anterior (medido: el rival ganaba ~55% de punta a punta). Lo que hace subir la curva es la vida de los rivales comunes (`RIVAL_HP`): +40 son unos 12 puntos. La CPU dura, en cambio, casi no movió el número contra este jugador.

**La curva de hoy** (80 partidas por nivel, 2026-10-06), cuánto gana el rival:

| Capítulos | Comunes | Jefes |
|---|---|---|
| 1–2 (CPU fácil) | 25–27% | 36 y 54% |
| 3–6 | 54–60% | 73–79% |
| 7–13 | 55–62% | 72–82% |
| 14–20 (CPU dura) | 63–67% | 76–84% |

Lo que se aprendió calibrándola:
- **La escalera sola da una curva plana.** El rival crece al ritmo del jugador esperado, así que cada tramo se sentía igual (~55%). Lo que la hace subir es la vida de los comunes (`RIVAL_HP`): +40 de vida son unos 12 puntos.
- **La CPU dura no mueve el número** contra este jugador (59 contra 58 en el 65); queda en lo difícil porque juega distinto, no porque gane más. La fácil sí: unos 35 puntos menos.
- **A los jefes los define la ráfaga, no la vida.** Bajarle 30 de vida a Nevisca la movió 3 puntos. Los que se pasaban (85-92%) ganaban en 5-6 rondas: plumas, shuriken y, sobre todo, **huevos**. Con varios Secret Egg la CPU casi no se corta: un jefe que los juntaba en sus amuletos ganaba 92%, y un rival con dos en la mochila 87% entre vecinos de 65%. Por eso el huevo no va en la mochila de los rivales (`RIVAL_NO_POWER`) y los pozos de amuletos no lo llevan.
- **Los símbolos repetidos hacen picos.** Con la fusión del rival sumando cualquier clase, los que sacaban dos de su clase en una carta saltaban 10 puntos sobre sus vecinos. Por eso el símbolo que suma es siempre de otra clase y no se repite (`rivalExtras`).
- **Al jugador simulado no hay que ponerle cartas sin su color.** Con las cuatro "mejores" del paquete de bienvenida (una sin su color), perdía más que pelado: una carta sin su símbolo es una carta que corta.

Lo que se aprendió ajustándolo:
- La **evolución** es la palanca más fuerte. Una parte de la clase del rival, evolucionada, suma su propio símbolo: la racha crece de a dos. Con las seis así, el rival gana ~90% aunque sea "normal". Por eso los rivales de la Guarida y el Coliseo son **híbridos** y evolucionan primero las partes de otras clases (un símbolo nuevo con el que encadenar, no una racha el doble de larga): así la regla de "una parte cada dos niveles" se cumple entera y la curva sube sin volverse una pared.
- La dificultad de la CPU mueve menos que la evolución y la vida. De la Guarida en adelante todos van en "normal".
- Los amuletos de los jefes mueven poco; la vida mueve bastante.

---

## 6. Progreso guardado

```json
{ "v": 2, "unlockedLevel": 3, "completedLevels": [1, 2], "starredLevels": [1] }
```

**La versión.** `v` es `PROGRESS_VERSION`. Un progreso sin `v` es de la campaña de 30 niveles en capítulos de 6: al leerlo, cada nivel pasa a su lugar de ahora (`fromV1`: los seis de cada capítulo viejo van a los lugares 1, 2, 4, 6, 8 y 10 del nuevo, así el 7 de antes es el 11), con sus estrellas, y el más lejano abierto también. Los niveles nuevos que quedan atrás se pueden jugar cuando se quiera. Al guardar queda en la versión nueva y no se migra dos veces.

**Pasar y estrella son dos cosas.** Ganar pasa el nivel (`completedLevels`) y abre el siguiente. La estrella (`starredLevels`) es solo por **K.O.**: el rival cayó sin llegar a jugar su última chance (`wonByKo` en `game.js`, que mira `lastChanceUsed` del derrotado). `ui.js` llama a `markLevelCompleted(level, { star: wonByKo(state) })`; ganarlo otra vez sin K.O. no saca una estrella ya ganada. Un progreso guardado antes de que existieran las estrellas no trae `starredLevels`, y lo ganado entonces cuenta con estrella. La pantalla del final (`resultView(...).star`) y el panel del nivel dicen si se la llevó y, si no, cómo ganarla.

Si la campaña crece y el jugador ya había ganado el último nivel de antes, `getAdventureProgress()` le desbloquea el siguiente solo. Un nivel agregado después del último capítulo declarado va en un capítulo aparte, sin nombre (`adventureChapters`).

---

## 7. Receta: agregar un nivel

1. Si hace falta un rival nuevo, agregalo a `RIVALS` en `src/axies.js` y regenerá el arte (sus poses van al archivo de su capítulo, ver §4.2; ojo con las partes que no se hornean):
   ```sh
   npm run axies   # capas del mixer (con las partes evolucionadas de cada nivel) y verificación de partes de evento
   npm run poses   # animaciones horneadas
   ```
   Si `poses` dice que un dibujo sale estirado (el esqueleto y el CDN no coinciden), cambiá esa parte: pasa con algunas (`reptile-04` ojos, `bug-02` boca evolucionada, `bird-02` boca evolucionada).
2. Agregá el nivel a `ADVENTURE_CAMPAIGN`, y a `ADVENTURE_CHAPTERS` si abre un capítulo. Los poderes salen solos del calendario y de `levelPowers`; un poder nuevo se suma al final de `UNLOCK_ORDER` (y se corre `LAST_UNLOCK` si hace falta). Lo que trae el rival sale de la escalera; si el nivel abre un escalón nuevo, va en `RIVAL_LADDER`.
3. Si el nivel abre un capítulo nuevo, el mundo se alarga solo con la tierra que sigue en `WORLD_ORDER` (`src/map-world.js`). Para una tierra nueva, sumala a `WORLD_LANDS` con su paleta, su `kit` (las piezas salen de las fábricas de `src/map-art.js`, o de una nueva), su agua, su hito y su `pattern`, ponela en `WORLD_ORDER`, y mirá cómo queda con capturas en las tres medidas (apaisado, parado y teléfono acostado).
4. Traducí nombre y descripción en `src/i18n-en.js`.
5. `npm test`, `npm run balance -- --adventure --levels <n>`, `npm run layout` y `npm run build`.

---

## 8. Los 200 niveles

Decidido con el dueño (2026-10-05) y hecho el mismo día: **20 capítulos de 10 niveles, 20 jefes**, de fácil a difícil. Lo que sigue es cómo quedó y lo que se decidió en el camino.

- **Tramos.** Fácil hasta el 60, medio del 61 al 130, difícil del 131 al 200. La CPU pasa de fácil (capítulo 1) a normal y a dura en lo difícil.
- **La escalera sigue igual de abajo para arriba**: después de las raras, las épicas (una carta con un poder de su clase), las legendarias y una mítica al final; las evoluciones llegan a 3 cerca del 130 y a 4–6 al final, primero las de otra clase. Siempre con tope de 4 cartas y por debajo del jugador esperado de su altura (§5).
- **Los jefes** van de 170 a ~260 de vida, con más partes con amuleto y un pozo más grande a medida que avanza (1 parte en lo fácil, 2 en lo medio, 3 en lo difícil), siempre ganables por el jugador esperado de su altura.
- **Partes coleccionables y Shiny** (todas las del mixer traen su arte evolucionado): 36 místicas (las seis partes de cada clase), 18 de Japón, 12 de Navidad, 12 de verano más 4 variantes, 6 **Shiny** (`summer-as`, tornasoladas: orejas y cola de bestia, ojos de bicho, boca de pez, espalda y cuerno de reptil) y 3 Agamo; cuerpos místico (normal y peludo), escarcha, verano, pesadilla y Agamo. Una parte de evento solo va en un rival de su clase (lo verifica `npm run axies`). Los jefes las llevan enteras; los rivales comunes suman 1–2 en lo medio y 3 o más en lo difícil, y las Shiny quedan para lo difícil y el final.
- **El mapa**: una tierra nueva por capítulo (15 más), pintada en código como las de hoy, con su paleta sacada de su fondo de pelea y el hito de su jefe; se dibuja de a una tierra (§4).
- **Los escenarios**: nueve fondos nuevos del kit y de Dusk, Mech y Dawn, pasados por `cuadrar.py` y `agrandar.py` (el bosque de otoño, la isla del verano, el salón de Navidad, el desierto de la tienda, el ocaso, el mar violeta, el bosque nocturno, los engranajes y el amanecer), y los seis fondos de clase (jungla, laguna, meseta, cañón, cielo, caverna). Uno nuevo de aire: luciérnagas.
- **Los rivales**: los 135 comunes de los capítulos 6 a 20 salen de un generador sembrado (sus partes de otra clase, sus coleccionables según el tramo y el orden en que evolucionan); los 15 jefes, diseñados a mano. Los nombres y los textos, a mano.
- **El peso de los rivales**: las poses van por capítulo (§4.2).
- **El pago**: el de siempre, y los jefes el doble (`BOSS_PAY`).
