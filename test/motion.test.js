// Test del reproductor de animaciones con un reloj y un DOM de mentira.
//
// Lo que se mira acá no se ve desde ningún otro lado: si un Axie deja de aburrirse,
// la partida sigue funcionando igual y el único síntoma es un muñeco más quieto. Pasó:
// el Axie propio no hacía un solo gesto en toda la partida, porque durante tu turno
// está plantado en `ready` y el aburrimiento solo salía desde `idle`.
import assert from 'node:assert/strict';

const { POSES, TRACKS, MOTIONS } = await import('../src/axie-poses.js');

/**
 * Un reloj de mentira. El aburrimiento sale cada 5 a 11 segundos, así que esperarlo
 * de verdad sería un test de un minuto; acá el tiempo lo adelanta `tick`.
 */
let now = 0;
const pending = [];
globalThis.setTimeout = (fn, ms) => {
  const t = { at: now + (ms || 0), fn };
  pending.push(t);
  return t;
};
globalThis.clearTimeout = (t) => { if (t) t.dead = true; };
function tick(ms) {
  const end = now + ms;
  for (;;) {
    const next = pending
      .filter((t) => !t.dead && !t.done && t.at <= end)
      .sort((a, b) => a.at - b.at)[0];
    if (!next) break;
    now = next.at;
    next.done = true;
    next.fn();
  }
  now = end;
}

const { createMotion } = await import('../src/axie-motion.js');

/**
 * Un Axie de mentira que anota qué clip largó cada vez.
 *
 * El reproductor no dice qué está tocando: le pasa cuadros a `animate()` y listo. El
 * clip se reconoce por su pista de cuerpo, que es única —cada uno tiene la suya en
 * `TRACKS`—, comparando el largo y el primer cuadro que no es el reposo.
 */
function fakeAxie(id) {
  const played = [];
  const anim = { cancel() {}, currentTime: 0 };
  const byRoot = new Map(Object.entries(POSES[id]).map(([name, clip]) => [clip.root, name]));
  const pose = {
    animate(frames) {
      const hit = [...byRoot.keys()].find(
        (root) => TRACKS[root].length === frames.length &&
          TRACKS[root].every((row, i) => frames[i].transform ===
            `translate(${row[0]}%, ${row[1]}%) rotate(${row[2]}deg)`),
      );
      played.push(byRoot.get(hit) ?? '?');
      return anim;
    },
  };
  const layer = { dataset: { part: 'eyes', att: 'eyes' }, classList: { contains: () => false }, animate: () => anim };
  return {
    played,
    node: {
      animate: () => anim,
      querySelector: () => pose,
      querySelectorAll: () => [layer],
    },
  };
}

/** Los emotes que salieron en `ms`, sin contar las bases que se repiten solas. */
function emotesIn(axie, motion, ms) {
  axie.played.length = 0;
  tick(ms);
  return axie.played.filter((name) => !MOTIONS[name]?.loop && name !== 'ready');
}

const MINUTE = 60_000;

// Plantado para atacar —o sea, durante todo tu turno— el Axie se aburre igual.
{
  const axie = fakeAxie('beast');
  const motion = createMotion(axie.node, 0);
  motion.mount('beast');
  motion.stance('ready');
  const emotes = emotesIn(axie, motion, MINUTE);
  assert.ok(emotes.length >= 3, `plantado en \`ready\` salieron ${emotes.length} emotes en un minuto`);
}

// Sin hacer nada, lo mismo.
{
  const axie = fakeAxie('beast');
  const motion = createMotion(axie.node, 0);
  motion.mount('beast');
  const emotes = emotesIn(axie, motion, MINUTE);
  assert.ok(emotes.length >= 3, `quieto salieron ${emotes.length} emotes en un minuto`);
}

// Festejando y desmayado no: esos tienen bucle propio y no hay nada que interrumpir.
for (const stance of ['win', 'ko']) {
  const axie = fakeAxie('beast');
  const motion = createMotion(axie.node, 0);
  motion.mount('beast');
  motion.stance(stance);
  const emotes = emotesIn(axie, motion, MINUTE);
  assert.equal(emotes.length, 0, `en \`${stance}\` no se aburre`);
}

// Festejando se queda en su lugar y lo único que hace es el saltito contento: nada de
// los gestos de aburrirse (un tarascón o un pisotón se leen como atacar al rival).
{
  const axie = fakeAxie('beast');
  const motion = createMotion(axie.node, 0);
  motion.mount('beast');
  motion.stance('celebrate');
  const emotes = emotesIn(axie, motion, MINUTE);
  assert.ok(emotes.length >= 15, `festejando salieron ${emotes.length} saltitos en un minuto`);
  assert.deepEqual([...new Set(emotes)], ['cheer'], 'y son todos contentos');
  assert.ok(!axie.played.includes('win'), 'el clip de la voltereta no se usa');
}

// Y los emotes están horneados para las seis clases, no solo para la que se probó.
const EMOTES = ['scratch', 'peek', 'snarl', 'cheer', 'chew', 'snap', 'stomp'];
for (const [id, clips] of Object.entries(POSES)) {
  for (const name of EMOTES) {
    assert.ok(clips[name], `a ${id} le falta el emote ${name}`);
    assert.ok(clips[name].dur > 0, `el emote ${name} de ${id} dura cero`);
  }
}

console.log(`✓ emotes ok (${EMOTES.length} por Axie)`);

// La cámara de la mesa (`camera.js`). Lo que no se ve desde ningún otro lado es que
// vuelva **exactamente** a su lugar: si se queda un pelo agrandada y cae de golpe en el
// último cuadro, eso es la vibración que se vino a sacar. Y que nunca se aleje de más:
// con la escala por debajo de 1 asoma el borde del dibujo.
{
  const { createCamera } = await import('../src/camera.js');
  const frames = [];
  globalThis.requestAnimationFrame = (fn) => frames.push(fn);
  globalThis.cancelAnimationFrame = () => {};
  Object.defineProperty(globalThis, 'performance', { value: { now: () => now }, configurable: true });
  const vars = {};
  const box = (left, width) => ({ getBoundingClientRect: () => ({ left, width }) });
  const arena = {
    ...box(0, 400), clientWidth: 400, clientHeight: 800,
    style: { setProperty: (k, v) => { vars[k] = parseFloat(v); } },
  };
  const [left, right] = [box(0, 200), box(200, 200)];
  const camera = createCamera(arena);
  const seen = [];
  const run = (ms) => {
    for (let t = 0; t < ms; t += 16) {
      tick(16);
      for (const fn of frames.splice(0)) fn(now);
      seen.push({ ...vars });
    }
  };

  // Una cadena de cuatro cartas, el ataque y el golpe.
  for (let n = 1; n <= 4; n++) {
    camera.frame({ s: 1 + 0.011 * (n + 1), el: left, lean: 0.5, k: 26 });
    camera.thump(0.3);
    run(500);
  }
  assert.ok(vars['--cam-s'] > 1.04, `con cuatro cartas la cámara se acerca (${vars['--cam-s']})`);
  camera.frame({ s: 1, k: 12 });
  camera.punch(right, { at: 50, reach: 300, zoom: 0.08 });
  run(350);
  assert.ok(vars['--cam-s'] > 1.07, `el golpe la tira encima del que lo recibe (${vars['--cam-s']})`);
  camera.hit(1, 12, 1);
  camera.frame({ s: 1 });
  run(3000);

  for (const v of seen) {
    const s = v['--cam-s'];
    assert.ok(s >= 1, `la escala nunca baja de 1 (${s})`);
    // Lo que sobra del dibujo a cada costado tiene que alcanzar para lo que se corre.
    assert.ok(((s - 1) * arena.clientWidth) / 2 >= Math.abs(v['--cam-x']) - 1e-6,
      `el corrimiento no destapa el borde (s=${s}, x=${v['--cam-x']})`);
  }
  // Y vuelve a su lugar de a poco, sin saltos: ningún cuadro del regreso se mueve más
  // de un pelo respecto del anterior.
  const back = seen.slice(-120).map((v) => v['--cam-s']);
  for (let i = 1; i < back.length; i++) {
    assert.ok(Math.abs(back[i] - back[i - 1]) < 0.004, `salto de escala al volver: ${back[i - 1]} → ${back[i]}`);
  }
  assert.deepEqual([vars['--cam-s'], vars['--cam-x'], vars['--cam-y']], [1, 0, 0], 'y termina exactamente en su lugar');
  assert.equal(frames.length, 0, 'quieta, deja de pedir cuadros');

  // Con el sistema pidiendo menos movimiento no se mueve nada.
  globalThis.matchMedia = () => ({ matches: true });
  const still = createCamera(arena);
  still.frame({ s: 1.06, el: left });
  still.punch(right, { zoom: 0.08 });
  still.hit(1, 12, 1);
  run(500);
  assert.deepEqual([vars['--cam-s'], vars['--cam-x']], [1, 0], 'sin movimiento, la escena quieta');
  delete globalThis.matchMedia;
  console.log('✓ cámara ok (se acerca, golpea, vuelve sin saltos y nunca destapa el borde)');
}
