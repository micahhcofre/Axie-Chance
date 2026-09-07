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

// Y los emotes están horneados para las seis clases, no solo para la que se probó.
const EMOTES = ['scratch', 'peek', 'snarl', 'cheer', 'chew', 'snap', 'stomp'];
for (const [id, clips] of Object.entries(POSES)) {
  for (const name of EMOTES) {
    assert.ok(clips[name], `a ${id} le falta el emote ${name}`);
    assert.ok(clips[name].dur > 0, `el emote ${name} de ${id} dura cero`);
  }
}

console.log(`✓ emotes ok (${EMOTES.length} por Axie)`);
