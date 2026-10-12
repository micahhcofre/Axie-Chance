// El escenario de efectos: lo que brilla, vuela o se rompe arriba de la mesa.
//
// La mesa sigue siendo HTML —las cartas, los botones, la vida, el número—; esto es una
// capa de decorado encima, como la del tráiler (`motion-reel/`). Son dos lienzos:
//
//   `#stage`       lo que tapa: pedazos de carta, polvo, letras grandes. Se mezcla normal.
//   `#stage-glow`  la luz: chispas, vigas, anillos, destellos. Se pinta sobre negro y
//                  se suma a la página (`plus-lighter`). Con WebGL2 pasa antes por un
//                  bloom en pirámide —el halo que hace que una chispa parezca una
//                  chispa y no un punto—; sin WebGL2 se suma tal cual.
//
// Cada efecto es una función de su edad en segundos (`draw(B, G, age, stage)`), así que
// no guarda estado: se puede cortar en cualquier momento. Los que tienen que quedarse
// mientras dure algo —las vigas de la cadena— se cuelgan con `keep` y se sacan con
// `drop`. El reloj corre solo mientras haya algo que dibujar.
//
// Es decorado: sin canvas, sin `requestAnimationFrame` (los tests) o con el sistema
// pidiendo menos movimiento, `add` y `keep` no hacen nada y el juego sigue igual.

const MAX_EFFECTS = 64;

const VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

// Bajar: 13 tomas, el filtro de Call of Duty; en el primer paso además se linealiza.
const DOWN = `#version 300 es
precision mediump float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uFirst;
// El lienzo sube con la fila de arriba primero: en el primer paso se lo da vuelta, así
// el halo queda donde está la luz y no reflejado.
vec3 T(vec2 d) {
  vec2 uv = uFirst > 0.5 ? vec2(vUv.x, 1.0 - vUv.y) : vUv;
  vec3 c = texture(uTex, uv + d * uTexel).rgb;
  return uFirst > 0.5 ? c * c : c;
}
void main() {
  vec3 a = T(vec2(-2,-2)), b = T(vec2(0,-2)), c = T(vec2(2,-2));
  vec3 d = T(vec2(-1,-1)), e = T(vec2(1,-1));
  vec3 f = T(vec2(-2,0)), g = T(vec2(0,0)), h = T(vec2(2,0));
  vec3 i = T(vec2(-1,1)), j = T(vec2(1,1));
  vec3 k = T(vec2(-2,2)), l = T(vec2(0,2)), m = T(vec2(2,2));
  o = vec4((d + e + i + j) * 0.125 + (a + b + f + g) * 0.03125 + (b + c + g + h) * 0.03125
    + (f + g + k + l) * 0.03125 + (g + h + l + m) * 0.03125, 1.0);
}`;

// Subir: una tienda de 9 tomas, sumando sobre el nivel de arriba.
const UP = `#version 300 es
precision mediump float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel;
vec3 T(vec2 d) { return texture(uTex, vUv + d * uTexel).rgb; }
void main() {
  vec3 c = T(vec2(-1,-1)) + 2.0 * T(vec2(0,-1)) + T(vec2(1,-1))
         + 2.0 * T(vec2(-1,0)) + 4.0 * T(vec2(0,0)) + 2.0 * T(vec2(1,0))
         + T(vec2(-1,1)) + 2.0 * T(vec2(0,1)) + T(vec2(1,1));
  o = vec4(c / 16.0, 1.0);
}`;

// Juntar: la luz tal cual más el halo, de vuelta a la curva de la pantalla.
const OUT = `#version 300 es
precision mediump float;
in vec2 vUv; out vec4 o;
uniform sampler2D uGlow; uniform sampler2D uBloom; uniform float uAmount;
void main() {
  vec3 g = texture(uGlow, vec2(vUv.x, 1.0 - vUv.y)).rgb;
  vec3 b = texture(uBloom, vUv).rgb;
  vec3 c = g * g + b * uAmount;
  c = c / (1.0 + max(c - 1.0, 0.0));
  o = vec4(sqrt(c), 1.0);
}`;

/**
 * El bloom sobre WebGL2. `null` si el aparato no lo tiene. Solo se arma con placa de
 * video (ver `glKind`): con WebGL emulado cada cuadro del bloom se lee de vuelta píxel a
 * píxel y el hilo principal se quedaba 3 de cada 4 cuadros esperándolo; el lienzo 2D
 * hace lo mismo sin el halo y sin esa espera.
 */
function createBloom(canvas) {
  const gl = canvas.getContext?.('webgl2', {
    alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false,
    failIfMajorPerformanceCaveat: true, powerPreference: 'low-power',
  });
  if (!gl) return null;
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const program = (fs) => {
    const v = compile(gl.VERTEX_SHADER, VS);
    const f = compile(gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    const p = gl.createProgram();
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
  };
  const progs = { down: program(DOWN), up: program(UP), out: program(OUT) };
  if (!progs.down || !progs.up || !progs.out) return null;
  // Las direcciones de los uniforms se piden una vez: preguntarlas en cada pasada son
  // una docena de idas y vueltas al driver por cuadro.
  const where = new Map();
  const uniform = (prog, name) => {
    const key = `${name}@${prog === progs.down ? 'd' : prog === progs.up ? 'u' : 'o'}`;
    if (!where.has(key)) where.set(key, gl.getUniformLocation(prog, name));
    return where.get(key);
  };
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const tex = (w, h) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (w) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  };
  const source = tex();
  let levels = [];
  let size = [0, 0];
  const LEVELS = 5;

  function resize(w, h) {
    if (size[0] === w && size[1] === h) return;
    size = [w, h];
    for (const l of levels) { gl.deleteTexture(l.tex); gl.deleteFramebuffer(l.fb); }
    levels = [];
    let lw = w;
    let lh = h;
    for (let i = 0; i < LEVELS; i++) {
      lw = Math.max(1, Math.floor(lw / 2));
      lh = Math.max(1, Math.floor(lh / 2));
      const t = tex(lw, lh);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      levels.push({ tex: t, fb, w: lw, h: lh });
    }
  }

  function pass(prog, input, texel, target, w, h, extra) {
    gl.useProgram(prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(0, 0, w, h);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, input);
    gl.uniform1i(uniform(prog, 'uTex'), 0);
    gl.uniform2f(uniform(prog, 'uTexel'), texel[0], texel[1]);
    extra?.();
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  return {
    /** Pinta `glow` (un lienzo 2D sobre negro) más su halo. */
    render(glow, amount) {
      const w = canvas.width;
      const h = canvas.height;
      resize(w, h);
      gl.disable(gl.BLEND);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, source);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, glow);
      // bajar
      let input = source;
      let iw = w;
      let ih = h;
      levels.forEach((l, i) => {
        pass(progs.down, input, [1 / iw, 1 / ih], l.fb, l.w, l.h, () => {
          gl.uniform1f(uniform(progs.down, 'uFirst'), i === 0 ? 1 : 0);
        });
        input = l.tex;
        iw = l.w;
        ih = l.h;
      });
      // subir, sumando
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      for (let i = levels.length - 1; i > 0; i--) {
        const from = levels[i];
        const to = levels[i - 1];
        pass(progs.up, from.tex, [1 / from.w, 1 / from.h], to.fb, to.w, to.h);
      }
      gl.disable(gl.BLEND);
      // juntar
      gl.useProgram(progs.out);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, source);
      gl.uniform1i(uniform(progs.out, 'uGlow'), 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, levels[0].tex);
      gl.uniform1i(uniform(progs.out, 'uBloom'), 1);
      gl.uniform1f(uniform(progs.out, 'uAmount'), amount);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
    clear() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
  };
}

/** Cuánto aguanta el aparato: menos píxeles y menos partículas en los chicos. */
function qualityOf() {
  const cores = globalThis.navigator?.hardwareConcurrency ?? 4;
  const small = Math.min(globalThis.innerWidth ?? 1000, globalThis.innerHeight ?? 800) < 600;
  const low = cores <= 4 || small;
  return { low, dpr: Math.min(globalThis.devicePixelRatio ?? 1, low ? 1.5 : 2), bloom: low ? 0.24 : 0.3 };
}

const IDLE = {
  on: false, add() {}, keep() {}, drop() {}, clear() {}, now: () => 0, box: () => null, unit: () => 1, quality: { low: true },
};

/**
 * Con qué dibuja el aparato: `'gpu'`, `'software'` (WebGL emulado en el procesador:
 * SwiftShader, llvmpipe, placas bloqueadas, muchas Chromebooks y máquinas virtuales) o
 * `'none'`. `failIfMajorPerformanceCaveat` no alcanza —Chrome sin placa igual entrega
 * el contexto emulado—, así que se mira además el nombre del que dibuja. Se pregunta en
 * un lienzo descartable: uno que ya tomó WebGL no puede volver a ser 2D.
 */
function glKind() {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    if (!gl) return document.createElement('canvas').getContext('webgl2') ? 'software' : 'none';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name) ? 'software' : 'gpu';
  } catch {
    return 'none';
  }
}

export function createStage(arena, baseCanvas, glowCanvas) {
  const quiet = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  if (!arena || !baseCanvas?.getContext || !glowCanvas || quiet || !globalThis.requestAnimationFrame) return IDLE;

  const quality = qualityOf();
  // La luz: con WebGL2 se dibuja en un lienzo aparte y el bloom la pasa al de la
  // página; sin WebGL2, el de la página es un lienzo 2D y se dibuja ahí mismo.
  let bloom = null;
  let glowSrc = null;
  let G = null;
  const gl = glKind();
  if (gl === 'gpu') {
    try { bloom = createBloom(glowCanvas); } catch { bloom = null; }
  }
  // Sin placa de video el navegador igual acelera los lienzos 2D con el WebGL emulado,
  // y como la página se compone por software, cada cuadro de cada lienzo se lee de
  // vuelta: era la mitad del hilo principal durante toda la cadena. En memoria común
  // (`willReadFrequently`) se dibujan directo donde se componen. Con placa de video
  // sería al revés —más lento—, por eso es solo acá.
  const opts = gl === 'software' ? { willReadFrequently: true } : undefined;
  const B = baseCanvas.getContext('2d', opts);
  if (!B) return IDLE;
  if (bloom) {
    glowSrc = document.createElement('canvas');
    G = glowSrc.getContext('2d');
  } else {
    G = glowCanvas.getContext?.('2d', opts);
    glowSrc = glowCanvas;
  }
  if (!G) return IDLE;
  glowCanvas.dataset.bloom = String(Boolean(bloom));

  const effects = [];
  const keepers = new Map();
  let raf = 0;
  let size = { w: 0, h: 0, dpr: 1 };
  let dirty = false;
  const now = () => performance.now() / 1000;

  // El tamaño del arena lo avisa el navegador cuando cambia. Leer `clientWidth` en cada
  // cuadro obligaba a recalcular el layout de la página entera si algo lo había
  // ensuciado —la mesa se repinta a cada carta, justo cuando más efectos hay—.
  let seen = null;
  if (typeof ResizeObserver === 'function') {
    // Adentro del aviso el layout ya está hecho: leer las medidas acá no fuerza nada.
    new ResizeObserver(() => {
      seen = { w: arena.clientWidth || 1, h: arena.clientHeight || 1 };
    }).observe(arena);
  }
  function fit() {
    const w = seen?.w ?? (arena.clientWidth || 1);
    const h = seen?.h ?? (arena.clientHeight || 1);
    const dpr = quality.dpr;
    if (w === size.w && h === size.h && dpr === size.dpr) return;
    size = { w, h, dpr };
    for (const c of [baseCanvas, glowSrc, bloom ? glowCanvas : null]) {
      if (!c) continue;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
  }

  // Dónde está el lienzo en la pantalla. Dentro de un cuadro no se mueve, así que se
  // mide una vez por cuadro y no una por cada medallón que se ilumina (ver `frame`).
  let origin = null;
  /** La caja de un nodo, en píxeles del escenario (el rincón de arriba del arena es 0,0). */
  function box(el) {
    const r = el?.getBoundingClientRect?.();
    const a = origin ?? baseCanvas.getBoundingClientRect?.();
    if (!r || !a || !r.width) return null;
    return { x: r.left - a.left, y: r.top - a.top, w: r.width, h: r.height, cx: r.left - a.left + r.width / 2, cy: r.top - a.top + r.height / 2 };
  }

  // Con solo lo que queda puesto (las vigas) y nada estallando, alcanza con 30 cuadros
  // por segundo: el teléfono no tiene por qué gastar batería en una cadena quieta. El
  // cuadro de por medio se espera con un timer y no pidiendo `requestAnimationFrame` y
  // salteándolo: cada pedido despierta la página entera —estilo, layout, todas las
  // animaciones— aunque después no se dibuje nada, y la cadena queda puesta todo el
  // rato que el jugador piensa.
  const SLOW_MS = 1000 / 30 - 4;
  let slow = 0;
  function frame() {
    raf = 0;
    fit();
    origin = baseCanvas.getBoundingClientRect?.() ?? null;
    const t = now();
    const { dpr } = size;
    B.setTransform(1, 0, 0, 1, 0, 0);
    B.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
    G.setTransform(1, 0, 0, 1, 0, 0);
    G.globalCompositeOperation = 'source-over';
    G.fillStyle = '#000';
    G.fillRect(0, 0, glowSrc.width, glowSrc.height);
    B.setTransform(dpr, 0, 0, dpr, 0, 0);
    G.setTransform(dpr, 0, 0, dpr, 0, 0);
    G.globalCompositeOperation = 'lighter';
    for (const draw of keepers.values()) {
      try { draw(B, G, t, api); } catch (err) { console.warn('stage', err); }
    }
    for (let i = effects.length - 1; i >= 0; i--) {
      const fx = effects[i];
      const age = t - fx.t0;
      if (age > fx.dur) { effects.splice(i, 1); continue; }
      if (age < 0) continue;
      B.save(); G.save();
      try { fx.draw(B, G, age, api); } catch (err) { console.warn('stage', err); effects.splice(i, 1); }
      B.restore(); G.restore();
    }
    B.globalAlpha = 1;
    G.globalAlpha = 1;
    origin = null;
    if (bloom) bloom.render(glowSrc, quality.bloom);
    const alive = effects.length > 0 || keepers.size > 0;
    if (alive) {
      dirty = true;
      if (effects.length > 0) raf = requestAnimationFrame(frame);
      else slow = setTimeout(() => { slow = 0; wake(); }, SLOW_MS);
    } else if (dirty) {
      // un último cuadro en limpio y a dormir
      dirty = false;
      B.setTransform(1, 0, 0, 1, 0, 0);
      B.clearRect(0, 0, baseCanvas.width, baseCanvas.height);
      if (bloom) bloom.clear();
      else {
        G.setTransform(1, 0, 0, 1, 0, 0);
        G.fillStyle = '#000';
        G.fillRect(0, 0, glowSrc.width, glowSrc.height);
      }
    }
  }
  const wake = () => {
    if (slow) {
      clearTimeout(slow);
      slow = 0;
    }
    if (!raf) raf = requestAnimationFrame(frame);
  };

  const api = {
    on: true,
    quality,
    now,
    box,
    /** La unidad de tamaño: 1 en una mesa de escritorio, menos en un teléfono. */
    unit: () => Math.max(0.5, Math.min(1.25, (seen?.w ?? (arena.clientWidth || 1000)) / 1100)),
    /**
     * Un efecto de `dur` segundos que arranca dentro de `delay` segundos.
     * `draw(B, G, age, stage)` dibuja con la edad en segundos.
     */
    add(draw, dur, delay = 0) {
      if (effects.length >= MAX_EFFECTS) effects.shift();
      effects.push({ draw, dur, t0: now() + delay });
      wake();
    },
    /** Algo que se dibuja en cada cuadro hasta que se lo saque con `drop(key)`. */
    keep(key, draw) {
      keepers.set(key, draw);
      wake();
    },
    drop(key) {
      keepers.delete(key);
      wake();
    },
    /** Saca todo (una partida nueva). */
    clear() {
      effects.length = 0;
      keepers.clear();
      wake();
    },
  };
  return api;
}
