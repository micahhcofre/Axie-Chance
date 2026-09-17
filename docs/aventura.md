# Modo Aventura: Arquitectura, Extensión y Guía del Sistema

Este documento describe la arquitectura técnica del **Modo Aventura** de *Axie Chance*, las reglas de derivación y validación de niveles, la persistencia del progreso y la receta paso a paso para que cualquier desarrollador o agente de IA pueda incorporar nuevos niveles sin tener que leer ni modificar el código de interfaz o motor de juego.

---

## 1. Arquitectura y Responsabilidad de Módulos

El Modo Aventura está desacoplado siguiendo el principio de separación entre **datos declarativos**, **lógica de dominio**, **motor de estados** e **interfaces**:

```
src/adventure-levels.js (Datos puros de campaña)
          ↓
src/adventure.js (Derivación, validación, helpers y progreso)
     ↓             ↓                 ↓
src/lobby.js   src/game.js       src/ui.js
(Ficha/Lobby)  (Pool/Rival CPU)  (HUD/Victoria)
```

### Mapa de responsabilidades:

- **`src/adventure-levels.js`**:
  - Contiene **únicamente** la definición declarativa de la campaña (`ADVENTURE_CAMPAIGN`).
  - No contiene lógica ejecutable ni dependencias del DOM o motor.
  - Cada nivel se declara con sus datos mínimos propios (sin `id` ni `activePowers` redundantes).
- **`src/adventure.js`**:
  - Compila y valida la campaña mediante `buildAdventureLevels(campaign)`.
  - Deriva los `id` (1-based) y los `activePowers` (acumulación con sustitución por clase).
  - Gestiona la persistencia en `localStorage` con la clave `axie-chance:adventure` (`ADVENTURE_KEY`).
  - Provee funciones de consulta y navegación: `isFinalLevel(id)`, `nextLevelId(id)`, `isLevelUnlocked(id)`, `getAdventureLevel(id)`, `markLevelCompleted(id)`, `resetAdventureProgress()`.
  - Exporta constantes de presentación: `DIFFICULTY_LABELS`.
- **`src/game.js`**:
  - Configura la partida en `newMatch({ mode: 'adventure', adventureLevel })`.
  - Asigna el rival starter correspondiente (`STARTERS[advCfg.rival]`) y construye la reserva común de cartas con `buildPool(advCfg.activePowers)`.
- **`src/lobby.js`**:
  - Renderiza los botones de niveles y la ficha informativa (`paintAdventure`).
  - Consulta `DIFFICULTY_LABELS` para la etiqueta de dificultad.
  - Genera la grilla de poderes con `powersToShow` (incluyendo los de `showcase`, como Free Game) y el título dinámico según la cantidad real de poderes introducidos.
- **`src/ui.js`**:
  - Gestiona el final del combate (`matchEnd`). Si el jugador ganó en modo aventura, llama a `markLevelCompleted(state.adventure.level)`.
  - Determina si el nivel superado es el último mediante `isFinalLevel(levelId)`.
  - Permite avanzar al siguiente nivel usando `nextLevelId(levelId)` tanto en el botón de UI como con la tecla `Enter`.

---

## 2. Flujo Completo de Ejecución

1. **Selección en Lobby**:
   El usuario abre la pestaña del Modo Aventura en `src/lobby.js`. La vista consulta `getAdventureProgress()` y `ADVENTURE_LEVELS`. Cada nivel se dibuja como completado (★), desbloqueado o bloqueado. Al hacer clic en "Comenzar Nivel", se dispara `ui.restart({ mode: 'adventure', adventureLevel: lvlId, axie, boosts })`.
2. **Inicialización de la Batalla**:
   `game.newMatch` recibe `{ mode: 'adventure', adventureLevel }` y carga la configuración con `getAdventureLevel(adventureLevel)`. Se crea el rival desde `STARTERS[advCfg.rival]` y se genera el mazo de mercado con `buildPool(advCfg.activePowers)`.
3. **Desarrollo del Combate**:
   `src/ui.js` renderiza la mesa de juego con las reglas estándar y los poderes activos del nivel.
4. **Finalización y Registro**:
   Al terminar la partida (`state.phase === 'matchEnd'`) y habiendo ganado el jugador:
   - `ui.js` ejecuta `markLevelCompleted(state.adventure.level)`.
   - Sale la pantalla del final (`src/result.js`) con el nombre del nivel arriba de la tela.
   - Si `isFinalLevel(state.adventure.level)` es verdadero, la tela dice `¡Aventura Completada!` y el botón principal dice `Ver Aventura`.
   - Si no es el nivel final, dice `¡Nivel superado!` y ofrece el botón `Siguiente Nivel`, que invoca `nextLevelId(state.adventure.level)`.

---

## 3. Esquema Completo de un Nivel

Cada elemento del array `ADVENTURE_CAMPAIGN` en `src/adventure-levels.js` es un objeto con las siguientes propiedades:

```javascript
{
  name: 'Nivel 1: Primeros Pasos',
  description: 'Aprendé lo básico: sumá fuerza, curate con la maceta y montá cartas con Free Game. Si te dejan en 0, te queda un último golpe, pero ahí ya no te podés curar.',
  rival: 'olek',
  difficulty: 'facil',
  newPowers: ['strength', 'pot'],
  showcase: ['freegame'], // Opcional
  activePowers: ['strength', 'pot'], // Opcional (override explícito)
}
```

### Detalle de Campos:

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `name` | `string` | **Sí** | Nombre visible del nivel en botones, cabeceras y carteles de victoria. |
| `description` | `string` | **Sí** | Explicación del nivel, consejos tácticos o mecánicas introducidas. |
| `rival` | `string` | **Sí** | ID del rival starter en `STARTERS` (`src/axies.js`). Valores existentes: `'olek'`, `'momo'`, `'puffy'`, `'buba'`, `'pomodoro'`, `'venoki'`. |
| `difficulty` | `string` | **Sí** | Dificultad del rival: `'facil'`, `'normal'` o `'duro'`. |
| `newPowers` | `string[]` | **Sí** | IDs de poderes de `POWERS` (`src/data.js`) que este nivel incorpora al pool. |
| `showcase` | `string[]` | *No* | Poderes o cartas especiales adicionales que la ficha del lobby exhibe (ej. `['freegame']`). |
| `activePowers`| `string[]` | *No* | Sobrescritura manual de los poderes activos. Si se omite, se calcula automáticamente por acumulación. |

### Propiedades Derivadas Automáticamente:

- **`id`** (`number`): Se calcula como `índice + 1` (1-based). **Nunca debe escribirse a mano**.
- **`activePowers`** (`string[]`): Lista de poderes activos en la partida para ese nivel.

---

## 4. Reglas de Derivación y Validación

### Derivación de `activePowers`:
- La acumulación de poderes es secuencial nivel a nivel.
- Cada poder nuevo en `newPowers` pertenece a una clase de Axie (`POWERS[p].symbol`).
- Si en la lista acumulada ya existe un poder de esa misma clase, el nuevo poder **lo sustituye exactamente en su misma posición (índice)**.
- Si es una clase no presente previamente, se agrega al final.
- Esta preservación de posiciones garantiza que el orden del array de poderes coincida de forma idéntica con el orden de la reserva de cartas (`buildPool` en `src/data.js`).
- Si un nivel declara `activePowers` de forma explícita, ese array tiene prioridad absoluta sobre la acumulación.

### Validación al cargar el módulo (`buildAdventureLevels`):
Al importar `src/adventure.js`, se valida la campaña completa. Si se detecta un error de configuración, se lanza un `Error` descriptivo en español inmediatamente:
- Campaña que no sea un array o niveles que no sean objetos.
- `name` o `description` vacíos o ausentes.
- `difficulty` distinta de `'facil'`, `'normal'` o `'duro'`.
- `rival` que no exista en el diccionario `STARTERS` de `src/axies.js`.
- Poderes en `newPowers`, `showcase` o `activePowers` que no existan en `POWERS` de `src/data.js`.
- Dos poderes de la misma clase presentes a la vez en `newPowers` o en los `activePowers` resultantes.

Esto asegura que un nivel mal configurado rompa inmediatamente los tests (`npm test`) antes de llegar a producción.

---

## 5. Persistencia y Compatibilidad hacia Adelante

El progreso se almacena en `localStorage` bajo la clave `axie-chance:adventure`:

```json
{
  "unlockedLevel": 3,
  "completedLevels": [1, 2]
}
```

### Compatibilidad al expandir la campaña:
Si un usuario completó el nivel 6 cuando la campaña tenía 6 niveles, su guardado registra `unlockedLevel: 6` y `completedLevels: [1, 2, 3, 4, 5, 6]`.
Si un desarrollador agrega un **Nivel 7** a `ADVENTURE_CAMPAIGN`:
- Al iniciar el juego, `getAdventureProgress()` detecta que el nivel 6 está completado y que existe un nivel siguiente disponible en `ADVENTURE_LEVELS`.
- `getAdventureProgress()` promueve automáticamente `unlockedLevel` a 7.
- El jugador puede jugar inmediatamente el nuevo nivel sin tener que reiniciar su partida ni borrar su progreso.

---

## 6. Receta Paso a Paso: Cómo Agregar un Nivel

Para agregar un nivel nuevo a la campaña:

### Caso A: Usando un Rival Starter existente
*(Roster actual: `olek`, `momo`, `puffy`, `buba`, `pomodoro`, `venoki`)*

1. Abrí `src/adventure-levels.js`.
2. Al final del array `ADVENTURE_CAMPAIGN`, agregá el nuevo objeto de nivel:
   ```javascript
   {
     name: 'Nivel 7: Prueba Titánica',
     description: 'Enfrentate a un nuevo desafío con combinaciones avanzadas de poderes.',
     rival: 'buba',
     difficulty: 'duro',
     newPowers: ['strength'], // Reemplazará a brutal (misma clase bestia)
   },
   ```
3. **No toques ningún otro archivo** (`ui.js`, `lobby.js`, `game.js`, `adventure.js` ni tests de integración). Todo se adapta dinámicamente.
4. Corré los tests para verificar que la configuración sea válida:
   ```sh
   npm test
   ```

---

### Caso B: Usando un Nuevo Rival Starter
Si el nivel requiere un starter de Origins que no existe actualmente en el proyecto:

1. **Registrar el starter en `src/axies.js`** (primero, porque los scripts lo leen de acá):
   - Agregá la entrada en `STARTERS`. `kit` es el número de carpeta del starter en
     `Assets/OriginsKit/PvE/Starters/<kit>/` del repo `axieinfinity/axie-origins-asset-kit`:
     ```javascript
     export const STARTERS = {
       ...
       nuevo_starter: { id: 'nuevo_starter', class: 'plant', name: 'NuevoNombre', kit: 99 },
     };
     ```
2. **Generar sus dibujos y animaciones**:
   ```sh
   npm run axies   # baja el esqueleto del kit (cache en .cache/starters/), corta el atlas en Axies/<id>/ y regenera src/axie-avatars.js
   npm run poses   # hornea sus animaciones en src/axie-poses.js
   ```
   `scripts/starters.mjs` no se ejecuta a mano: es el módulo que usan esos dos comandos.
   No edites a mano `src/axie-avatars.js`, `src/axie-poses.js` ni `Axies/<id>/*.png`.
3. **Declarar el nivel**:
   - En `src/adventure-levels.js`, usá `'nuevo_starter'` como valor del campo `rival`.
4. **Verificar**:
   - Corré `npm test` y `npm run build`, y comprobá visualmente la ficha del rival en el lobby.
