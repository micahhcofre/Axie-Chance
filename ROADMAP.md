# Hoja de ruta: hosting y partida en red sin trampas

Estado al 2026-09-18. Este documento junta lo decidido en la sesión de hosting y
seguridad para seguir en una sesión nueva. Reglamento y arquitectura: ver [claude.md](claude.md).

## Decisiones tomadas

1. **Sin EC2.** Se publica con el stack serverless que ya existe en
   [infra/lib/axie-chance-stack.ts](infra/lib/axie-chance-stack.ts): S3 + CloudFront
   para el sitio, Lambda + API Gateway WebSocket + DynamoDB para el relay. Todo se
   paga por uso; se mantiene la decisión del dueño de **no sumar recursos con costo fijo**.
2. **Primero se publica lo que hay** (la partida corre en el navegador del anfitrión).
3. **Después, la versión "segura"**: la partida corre en la Lambda y los dos jugadores
   son pantallas. Es la única forma de que el anfitrión no pueda hacer trampa; ningún
   truco del lado del cliente alcanza (ver "Lo que no vamos a hacer").
4. Casi nada de lo publicado ahora se tira: cambia el código de la Lambda y la rama de
   anfitrión de `net.js`. Es un deploy del mismo stack, no una migración.

## Medidas que respaldan la decisión (2026-09-17, local)

| Medida | Resultado |
|---|---|
| Sitio desplegado | 27 MB (19 MB son `simbolos especiales/`). Audio, VFX y arte de Axies vienen de jsDelivr y axiecdn, no del bucket |
| Partida en red, una pantalla remota (bot ingenuo, 48 rondas, cota superior) | ~750 mensajes anfitrión→pantalla, 2,1 MB en el cable, gzip 4,9x, estado máximo 14,7 KB crudo / 2,9 KB empaquetado, nunca en pedazos |
| Relay en proceso, 10 salas | ~210.000 msg/s |
| Relay por WebSocket real, 20 conexiones | ~38.000 msg/s, latencia p50 3 ms, p99 19 ms |

Una partida viva manda ~1 mensaje por segundo por pantalla. Con 20 CCU (10 partidas)
son ~20 msg/s en el pico. Costo estimado con el stack actual: bastante menos de un
centavo por partida; con 50 partidas por día, unos pocos dólares al mes, casi todo
dentro de la capa gratuita. La latencia anfitrión→pantalla pasando por Lambda será de
100 a 200 ms: invisible con relojes de 30 s por turno.

## Orden de trabajo

Primero se hostea la versión actual, que funciona. Nada de la Fase 1 se toca hasta que
la Fase 0 esté publicada y corriendo. Las notas de la Fase 1 son para no perder lo
conversado, no para empezar ya.

## Fase 0: publicar lo que hay (ahora)

- [x] Publicar en la **cuenta nueva** del dueño (la de pruebas se borró el 2026-09-18). **Publicado el 2026-09-18.**
      Código listo: tests, build y `cdk synth` pasan; el sitio pesa 34 MB sin `dist/`;
      no quedan IDs de cuenta ni de zona en el código. Lambda 256 MB ARM y throttle
      50 rps / ráfaga 100 quedan como están (el throttle es el tope de la factura: no
      sacarlo). Pasos, en orden:
  - [x] Perfil `axie-chance` en `~/.aws` (cuenta 169089623823, usuario IAM `martin`) (`aws configure sso --profile axie-chance` o
        `aws configure --profile axie-chance`, región `us-east-1`). Los perfiles
        `saml` y `default` son del trabajo y no se tocan. Otro nombre:
        `AWS_PROFILE=<perfil> npm run ...`.
  - [x] `npm run cdk:bootstrap` (una vez por cuenta). Hecho el 2026-09-18.
  - [x] `npm run deploy:dns`: zona `Z023244932OY50VPTGYE` creada el 2026-09-18. NS:
        ns-529.awsdns-02.net, ns-491.awsdns-61.com, ns-1095.awsdns-08.org,
        ns-1560.awsdns-03.co.uk.
  - [x] Delegar `sindados.com.ar` en NIC.ar a esos cuatro servidores. Resolvió el
        2026-09-18 a la madrugada.
  - [x] `npm run deploy`: sitio, relay, presupuesto y `net.json` desplegados el
        2026-09-18. **Vivo en https://d1wcdl75o2gqbv.cloudfront.net** (distribución
        `E2YENKPI4GAWXF`, relay `wss://5dv4g8d78k.execute-api.us-east-1.amazonaws.com/net`).
        Probado: portada, `net.json`, módulos, assets con espacios, fallback SPA,
        cabeceras; relay real: crear sala, listar, entrar, acción al anfitrión y
        mensaje del anfitrión a la pantalla.
  - [x] **Dominio** (2026-09-18): CloudFront rechazó `sindados.com.ar` y `www`
        (`CNAMEAlreadyExists`): seguían asociados a la distribución de la cuenta vieja,
        cerrada. Se resolvió con el camino documentado: desplegar con
        `-c attachDomain=false` (certificado puesto, sin nombres), los TXT de propiedad
        `_.sindados.com.ar` y `_www.sindados.com.ar` → `d1wcdl75o2gqbv.cloudfront.net`,
        `aws cloudfront associate-alias` por cada nombre, y `npm run deploy` final.
        **https://sindados.com.ar y https://www.sindados.com.ar responden con el juego**
        (HTTPS, redirección desde HTTP, `net.json`). La bandera y los TXT quedan en el
        stack por si hay que volver a mover el dominio.
- [x] **Alarma de presupuesto** (AWS Budgets, 10 USD/mes, `MonthlyBudget` en el stack:
      mail al 80% real y al 100% proyectado de toda la cuenta). Es el único seguro que
      necesita un stack pago por uso; el relay no tiene autenticación y `list` es un
      Scan de DynamoDB.
- [ ] **Arreglos baratos de la evaluación de trampas** (se conservan en la Fase 1):
  - [ ] `newMatch` solo con `phase === 'matchEnd'` ([src/rooms.js](src/rooms.js),
        acción `newMatch`). Hoy un invitado que va perdiendo reinicia la partida con un
        mensaje desde la consola.
  - [ ] `chooseStackTarget`: rechazar `colIndex` que no sea entero
        (`Number.isInteger`) en [src/game.js](src/game.js) y [src/rules.js](src/rules.js).
        Con `NaN` pasa las dos comparaciones y la carta Rocket desaparece.
  - [ ] Sanear el `{t:'state'}` que llega del anfitrión en `receive` de
        [src/net.js](src/net.js), o pasar `state.log` a tokens estructurados que se
        dibujen sin `innerHTML` ([src/ui.js](src/ui.js), `logHtml`). Hoy un anfitrión
        malicioso ejecuta JavaScript en el navegador de las otras pantallas.
- [ ] Opcional: sala privada (contraseña en el link/QR que el relay exige en `join`) o
      bandera "privada" que la saque de `list`. Hoy cualquiera puede entrar primero y
      quedarse con el asiento, o mirar.

## Fase 1: la partida en la Lambda (versión segura)

### Diseño

- Los dos jugadores son pantallas del relay; desaparece la rama de anfitrión de
  `net.js`. La sala vive en DynamoDB como un ítem `match#<código>` con el estado de la
  partida (~15 KB crudo; el tope de DynamoDB es 400 KB).
- Cada acción (`hit`, `stand`, `takeCard`, ...) despierta la Lambda: lee el estado,
  lo carga en `createGame`, aplica la acción, lo escribe con **chequeo de versión**
  (escritura condicional) para que dos acciones no se pisen, y manda el estado
  recortado (`redact`) a las dos pantallas y a los espectadores.
- Se reusa la lógica de `rooms.js` (ya corre en Node en los tests) y el motor puro
  (`game.js`, `rules.js`, `data.js`, `ai.js`) sin tocar sus reglas.
- `packMessage` y los números de envío (`n`) siguen sirviendo: Lambda→pantalla también
  puede ir comprimido y en pedazos.
- Conviene meterla detrás de una **bandera**: una sala es "en el navegador" o "en el
  servidor" y se cambia sin día de corte.

### Inquietudes a resolver (en orden)

1. **Estado serializable.** `createGame` guarda el estado en un closure y el `rng` es
   una función. Hace falta `load(state)` / exportar el estado, y un `rng` que no viaje
   (en el servidor, `crypto.randomInt`). Verificado: hoy el estado en el cable **no**
   lleva semilla ni rng; que siga así.
2. **Relojes.** El reloj de turno y de draft usan `setTimeout` dentro del motor
   (`armClock` / `timeUp` en [src/game.js](src/game.js)): a los 30 s te plantás solo,
   a los 20 s se pasa el pick. Funciona porque el navegador del anfitrión sigue vivo;
   una invocación de Lambda termina apenas atiende la acción y nadie está para
   disparar el timer. Lo que sobrevive es la marca de tiempo: `state.clock.ends` ya
   está en el estado y `redact` ya manda el "tiempo que queda". Plan, sin scheduler:
   - Guardar `clock.ends` en el ítem.
   - Al recibir **cualquier** mensaje de la sala, primero aplicar `timeUp` si
     `now > ends`, y recién después la acción nueva. Así un `hit` tardío se rechaza
     porque el turno ya se plantó solo.
   - Las pantallas, que ya cuentan hacia atrás, mandan un `tick` al llegar a cero; la
     Lambda lo verifica contra su propia hora y aplica `timeUp`. Despierta la sala
     aunque el jugador lento no haga nada. No se puede abusar: el servidor solo lo
     aplica si su reloj coincide.
   - Consecuencia aceptada (2026-09-18): si el jugador activo se desconecta y la otra
     pantalla también se fue, nadie manda el `tick` y la sala queda en pausa hasta que
     alguien vuelva. Con una pantalla abierta se comporta igual que hoy, más los
     100-200 ms de latencia.
   - Si el `tick` resultara poco confiable, la alternativa es una entrada de
     EventBridge Scheduler por reloj armado (sigue siendo pago por uso, pero es una
     pieza más). Probar primero con el `tick`.
   - Las salas vacías **no** son un problema de timers: el TTL de DynamoDB (`expires`
     en [relay/lambda.mjs](relay/lambda.mjs)) ya las borra solo.
3. **Ritmo y animaciones.** Con `pace: 1` el motor emite estados intermedios (momentos
   de poderes, `POWER_BEAT`, `aimMs`) que las pantallas animan. En el servidor corre
   con `pace: 0` y sale **un estado por acción**: la pantalla tiene que reponer los
   momentos a partir del diff (`state.powerFx`, `lastHit`, `poured`). Es la parte de
   diseño más delicada; medir antes cuánto de `ui.js`/`power-fx.js` depende de los
   estados intermedios.
4. **Textos del registro.** `game.js` importa `tr()` y arma `state.log` con HTML
   (`crest()`). En el servidor el idioma quedaría fijo. Pasar el registro a tokens
   `{kind, parts}` y traducir/dibujar en la pantalla. Resuelve también el hallazgo de
   XSS de la Fase 0 de forma definitiva.
5. **Concurrencia y orden.** Escritura condicional por versión; si falla, releer y
   reintentar una vez. Las pantallas ya descartan envíos viejos por `n`.
6. **Bot.** En red no hay bot (`isBotSeat` es falso en `net`), pero `game.js` importa
   `ai.js`: va en el paquete y no se usa.
7. **Costo.** Por acción: una lectura y una escritura de ~15-40 KB en DynamoDB y dos
   mensajes de API Gateway. Estimación: 1 a 3 centavos por partida. Confirmar con la
   factura del primer mes.
8. **Paquete de la Lambda.** Hoy `relay/` no empaqueta nada. El motor vive en `src/`
   como ES modules: decidir si se copia en el asset del CDK o se genera un bundle
   (`scripts/build.mjs` ya concatena módulos).
9. **Reconexión y gracia de asiento.** `SEAT_GRACE` (15 s) hoy es un `setTimeout` en
   el navegador del anfitrión ([src/rooms.js](src/rooms.js), `detach`); en el servidor
   pasa a ser una marca de tiempo en el ítem que se evalúa con el próximo mensaje. El
   asiento se libera "cuando alguien pregunta", no exactamente a los 15 s; el próximo
   `join` o `list` lo ve libre igual.
10. **Tests.** `test/net.test.js` y `test/netui.test.js` suponen anfitrión en el
    navegador; sumar una suite que corra el motor contra `memoryStore` como si fuera
    la Lambda. Cubrir en especial el borde de los relojes: las dos pantallas se van,
    vuelve una, y el reloj vencido se resuelve en ese primer mensaje **antes** de
    aplicar la acción nueva. Es el único caso donde el comportamiento difiere de hoy.

### Estimación

- Lambda + DynamoDB: 3 a 5 días.
- Alternativa descartada: proceso Node siempre prendido (t4g.nano / Lightsail): ~1 día
  de trabajo pero ~4 USD/mes fijos, una máquina que mantener y todas las partidas se
  caen si se cae. Solo si hiciera falta esta semana.

## Lo que no vamos a hacer

- **Commit-reveal de la semilla.** El anfitrión igual conoce el orden del mazo después
  de revelar y puede mentir en todo lo demás.
- **Motor en lockstep en los dos navegadores.** Le da a un cliente modificado el orden
  del mazo, que en un push-your-luck es la peor trampa posible.
- **EC2** para el sitio o el relay: costo fijo y operación sin beneficio a 20 CCU.

## Hallazgos de la evaluación de trampas (2026-09-18)

Verificados sobre el código y ejecutando el motor. Lo que **aguanta**: el estado en el
cable no lleva semilla ni rng y los mazos van rebarajados (un invitado no puede
reconstruir el orden); nadie juega por el otro asiento ni fuera de turno (`allowed`);
las cartas del centro se validan del lado del anfitrión; los loadouts se revalidan
(`buildPersonalDeck`); la llave del anfitrión nunca sale del relay; los espectadores no
ven nada oculto; no hay tabla de posiciones ni premios del lado del servidor.

| # | Gravedad | Hallazgo | Cierra |
|---|---|---|---|
| 1 | Alta (por diseño) | El anfitrión ve el mazo real, puede reordenarlo, falsear vida y reloj, ignorar acciones | Fase 1 |
| 2 | Alta | Un invitado reinicia una partida viva con `newMatch` | Fase 0 |
| 3 | Alta | Un anfitrión malicioso inyecta HTML/JS vía `state.log` | Fase 0 (parche) / Fase 1 (definitivo) |
| 4 | Media | `list` es un Scan sin autenticación; creación de salas sin tope | Fase 0 (alarma); GSI por `kind` solo si suena |
| 5 | Media | No hay salas privadas: cualquiera entra primero o mira | Opcional Fase 0 |
| 6 | Baja | `NaN` pasa la guarda de `chooseStackTarget` | Fase 0 |
| 7 | Baja | `bubbleCard` del rival viaja en el cable (la UI no lo muestra) | Fase 1 (`redact` por destinatario) |
| 8 | Baja | Sin tope de pantallas por sala: amplifica trabajo del anfitrión | Fase 1 |

Aviso: con `npm start` por HTTP plano en LAN, la llave del anfitrión cae al camino
`Math.random`. Publicado es HTTPS, así que no aplica en producción.

## Preguntas abiertas

- ¿Amigos o desconocidos? Para amigos, la Fase 0 alcanza. La Fase 1 es el precio de
  jugar contra gente que no se conoce.
- ¿Tabla de posiciones / temporadas? (`src/i18n-en.js` ya nombra leaderboards). Requiere
  la Fase 1 antes de lanzarlo.
