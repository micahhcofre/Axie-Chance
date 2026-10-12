// El revelado: la parte que convierte dibujos de Canvas 2D en cine.
//
// Cada cuadro llega en dos lienzos: la escena y una capa emisiva (chispas, vigas,
// destellos) pintada sobre negro. En WebGL2 las dos pasan a luz lineal, la emisiva
// multiplicada por encima de 1 —HDR de verdad: un núcleo de chispa vale 3 y no 1—, y
// se acumulan en un buffer de media precisión. Varios instantes del obturador sumados
// dan el desenfoque de movimiento real; después vienen el bloom en pirámide (13 tomas
// para bajar, tienda para subir), las ondas de choque, la aberración cromática, el
// glitch, la gradación, la viñeta y el grano.

const VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const ACCUM = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uBase; uniform sampler2D uGlow;
uniform float uWeight; uniform float uGlowGain;
void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  vec3 base = pow(texture(uBase, uv).rgb, vec3(2.2));
  vec3 glow = pow(texture(uGlow, uv).rgb, vec3(2.2));
  o = vec4((base + glow * uGlowGain) * uWeight, 1.0);
}`;

const DOWN = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel;
uniform float uPrefilter; uniform float uThreshold; uniform float uKnee;
vec3 T(vec2 d) { return texture(uTex, vUv + d * uTexel).rgb; }
void main() {
  vec3 a = T(vec2(-2,-2)), b = T(vec2(0,-2)), c = T(vec2(2,-2));
  vec3 d = T(vec2(-1,-1)), e = T(vec2(1,-1));
  vec3 f = T(vec2(-2,0)), g = T(vec2(0,0)), h = T(vec2(2,0));
  vec3 i = T(vec2(-1,1)), j = T(vec2(1,1));
  vec3 k = T(vec2(-2,2)), l = T(vec2(0,2)), m = T(vec2(2,2));
  vec3 col = (d + e + i + j) * 0.125 + (a + b + f + g) * 0.03125 + (b + c + g + h) * 0.03125
           + (f + g + k + l) * 0.03125 + (g + h + l + m) * 0.03125;
  if (uPrefilter > 0.5) {
    float br = max(col.r, max(col.g, col.b));
    float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
    soft = soft * soft / (4.0 * uKnee + 1e-5);
    col *= max(soft, br - uThreshold) / max(br, 1e-5);
  }
  o = vec4(col, 1.0);
}`;

const UP = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uScale;
vec3 T(vec2 d) { return texture(uTex, vUv + d * uTexel).rgb; }
void main() {
  vec3 c = T(vec2(-1,-1)) + 2.0 * T(vec2(0,-1)) + T(vec2(1,-1))
         + 2.0 * T(vec2(-1,0)) + 4.0 * T(vec2(0,0)) + 2.0 * T(vec2(1,0))
         + T(vec2(-1,1)) + 2.0 * T(vec2(0,1)) + T(vec2(1,1));
  o = vec4(c / 16.0 * uScale, 1.0);
}`;

const COMPOSITE = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uScene; uniform sampler2D uBloom;
uniform vec2 uRes; uniform float uTime; uniform float uFlip;
uniform float uBloomAmt; uniform float uExposure; uniform float uContrast; uniform float uSat;
uniform vec3 uLift; uniform vec3 uGain; uniform float uGamma; uniform vec3 uTint;
uniform float uVignette; uniform float uCA; uniform float uZoomBlur; uniform vec2 uZoomCenter;
uniform float uGlitch; uniform vec4 uFlash; uniform float uFade; uniform float uGrain;
uniform vec4 uShock[4]; uniform float uLetterbox;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

vec3 sampleCA(vec2 uv, vec2 ca) {
  return vec3(texture(uScene, uv + ca).r, texture(uScene, uv).g, texture(uScene, uv - ca).b);
}

vec3 softClip(vec3 c) {
  vec3 k = max(c - 0.82, 0.0);
  return min(c, 0.82) + 0.18 * (1.0 - exp(-k / 0.18));
}

void main() {
  vec2 uv = vUv;
  if (uFlip > 0.5) uv.y = 1.0 - uv.y;
  vec2 px = uv * uRes;
  vec2 off = vec2(0.0);
  for (int i = 0; i < 4; i++) {
    vec4 s = uShock[i];
    if (s.w == 0.0) continue;
    vec2 d = px - s.xy;
    float dist = length(d);
    float w = 38.0 + s.z * 0.12;
    float x = (dist - s.z) / w;
    off += (d / max(dist, 1e-3)) * (-x * exp(-x * x * 1.6)) * s.w;
  }
  if (uGlitch > 0.001) {
    float frame = floor(uTime * 24.0);
    float band = floor(uv.y * 18.0 + hash(vec2(frame, 3.0)) * 6.0);
    float r = hash(vec2(band, frame));
    if (r < uGlitch * 0.7) off.x += (hash(vec2(band + 7.0, frame)) - 0.5) * 220.0 * uGlitch;
    float fine = floor(uv.y * 140.0);
    if (hash(vec2(fine, frame + 1.0)) < uGlitch * 0.25) off.x += (hash(vec2(fine, frame)) - 0.5) * 60.0;
  }
  vec2 suv = (px + off) / uRes;
  vec2 dir = suv - 0.5;
  vec2 ca = dir * (uCA / uRes.x) * (0.5 + 2.0 * dot(dir, dir)) + vec2(uGlitch * 9.0 / uRes.x, 0.0);
  vec3 col;
  if (uZoomBlur > 0.001) {
    vec3 acc = vec3(0.0);
    for (int k = 0; k < 16; k++) {
      float f = float(k) / 15.0;
      vec2 u2 = uZoomCenter + (suv - uZoomCenter) * (1.0 - uZoomBlur * f);
      acc += sampleCA(u2, ca);
    }
    col = acc / 16.0;
  } else {
    col = sampleCA(suv, ca);
  }
  col += texture(uBloom, suv).rgb * uBloomAmt;
  col *= uExposure;
  col += uFlash.rgb * uFlash.a;
  col = softClip(col);
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  col = col * uGain + uLift * (1.0 - col);
  col = pow(max(col, 0.0), vec3(1.0 / uGamma));
  col *= uTint;
  col = (col - 0.5) * uContrast + 0.5;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSat);
  vec2 q = vUv - 0.5;
  q.x *= uRes.x / uRes.y;
  col *= 1.0 - smoothstep(0.42, 1.12, length(q)) * uVignette;
  if (uv.y < uLetterbox || uv.y > 1.0 - uLetterbox) col = vec3(0.0);
  col *= 1.0 - uFade;
  float n = hash(px + fract(uTime * 7.31) * vec2(311.7, 183.3)) - 0.5;
  col += n * uGrain * (0.55 + 0.45 * (1.0 - l));
  col += (hash(px * 1.37 + 17.0) - 0.5) / 255.0;
  col = clamp(col, 0.0, 1.0);
  o = uFlip > 0.5 ? vec4(col.bgr, 1.0) : vec4(col, 1.0);
}`;

export const POST_DEFAULTS = {
  bloom: 0.55, threshold: 0.92, knee: 0.3, exposure: 1, contrast: 1.04, sat: 1.08,
  lift: [0, 0, 0], gain: [1, 1, 1], gamma: 1, tint: [1, 1, 1], vignette: 0.55,
  ca: 1.5, zoomBlur: 0, zoomCenter: [0.5, 0.5], glitch: 0, flash: [1, 1, 1, 0],
  fade: 0, grain: 0.035, shocks: [], letterbox: 0, glowGain: 2.2,
};

export function createPost(glCanvas, W, H) {
  const gl = glCanvas.getContext('webgl2', {
    antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true,
  });
  if (!gl) throw new Error('sin WebGL2');
  if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('sin EXT_color_buffer_float');
  gl.getExtension('OES_texture_float_linear');

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, VS);
  const program = (fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const name = info.name.replace('[0]', '');
      u[name] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  };
  const P = {
    accum: program(ACCUM), down: program(DOWN), up: program(UP), comp: program(COMPOSITE),
  };

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const texture = (w, h, internal, format, type) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (internal) gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    return t;
  };
  const target = (w, h, internal = gl.RGBA16F, format = gl.RGBA, type = gl.HALF_FLOAT) => {
    const t = texture(w, h, internal, format, type);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, fb, w, h };
  };

  const baseTex = texture(W, H);
  const glowTex = texture(W, H);
  const accum = target(W, H);
  const mips = [];
  for (let i = 1, w = W, h = H; i <= 6; i++) {
    w = Math.max(1, Math.round(w / 2));
    h = Math.max(1, Math.round(h / 2));
    mips.push(target(w, h));
  }
  const out8 = target(W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
  const draw = () => gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  const upload = (t, source) => {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  };

  return {
    gl,
    /** Empieza un cuadro: vacía el acumulador. */
    begin() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, accum.fb);
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    },
    /** Suma un instante del obturador con su peso. */
    add(baseCanvas, glowCanvas, weight, glowGain) {
      upload(baseTex, baseCanvas);
      upload(glowTex, glowCanvas);
      gl.bindFramebuffer(gl.FRAMEBUFFER, accum.fb);
      gl.viewport(0, 0, W, H);
      gl.useProgram(P.accum.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, baseTex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, glowTex);
      gl.uniform1i(P.accum.u.uBase, 0);
      gl.uniform1i(P.accum.u.uGlow, 1);
      gl.uniform1f(P.accum.u.uWeight, weight);
      gl.uniform1f(P.accum.u.uGlowGain, glowGain);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      draw();
      gl.disable(gl.BLEND);
    },
    /** Revela el cuadro: al lienzo (`toScreen`) o al buffer de lectura, dado vuelta y en BGRA. */
    finish(fx, time, toScreen = true) {
      // bloom: bajar
      gl.useProgram(P.down.p);
      let src = accum;
      mips.forEach((m, i) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, m.fb);
        gl.viewport(0, 0, m.w, m.h);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, src.t);
        gl.uniform1i(P.down.u.uTex, 0);
        gl.uniform2f(P.down.u.uTexel, 1 / src.w, 1 / src.h);
        gl.uniform1f(P.down.u.uPrefilter, i === 0 ? 1 : 0);
        gl.uniform1f(P.down.u.uThreshold, fx.threshold);
        gl.uniform1f(P.down.u.uKnee, fx.knee);
        draw();
        src = m;
      });
      // bloom: subir sumando
      gl.useProgram(P.up.p);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      for (let i = mips.length - 2; i >= 0; i--) {
        const dst = mips[i];
        const from = mips[i + 1];
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
        gl.viewport(0, 0, dst.w, dst.h);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, from.t);
        gl.uniform1i(P.up.u.uTex, 0);
        gl.uniform2f(P.up.u.uTexel, 1 / from.w, 1 / from.h);
        gl.uniform1f(P.up.u.uScale, 1);
        draw();
      }
      gl.disable(gl.BLEND);
      // composición
      gl.bindFramebuffer(gl.FRAMEBUFFER, toScreen ? null : out8.fb);
      gl.viewport(0, 0, W, H);
      const c = P.comp;
      gl.useProgram(c.p);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, accum.t);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, mips[0].t);
      gl.uniform1i(c.u.uScene, 0);
      gl.uniform1i(c.u.uBloom, 1);
      gl.uniform2f(c.u.uRes, W, H);
      gl.uniform1f(c.u.uTime, time);
      gl.uniform1f(c.u.uFlip, toScreen ? 0 : 1);
      gl.uniform1f(c.u.uBloomAmt, fx.bloom);
      gl.uniform1f(c.u.uExposure, fx.exposure);
      gl.uniform1f(c.u.uContrast, fx.contrast);
      gl.uniform1f(c.u.uSat, fx.sat);
      gl.uniform3fv(c.u.uLift, fx.lift);
      gl.uniform3fv(c.u.uGain, fx.gain);
      gl.uniform1f(c.u.uGamma, fx.gamma);
      gl.uniform3fv(c.u.uTint, fx.tint);
      gl.uniform1f(c.u.uVignette, fx.vignette);
      gl.uniform1f(c.u.uCA, fx.ca);
      gl.uniform1f(c.u.uZoomBlur, fx.zoomBlur);
      gl.uniform2fv(c.u.uZoomCenter, fx.zoomCenter);
      gl.uniform1f(c.u.uGlitch, fx.glitch);
      gl.uniform4fv(c.u.uFlash, fx.flash);
      gl.uniform1f(c.u.uFade, fx.fade);
      gl.uniform1f(c.u.uGrain, fx.grain);
      gl.uniform1f(c.u.uLetterbox, fx.letterbox);
      const shocks = new Float32Array(16);
      fx.shocks.slice(0, 4).forEach((s, i) => shocks.set(s, i * 4));
      gl.uniform4fv(c.u.uShock, shocks);
      draw();
    },
    /** Lee el cuadro revelado con `finish(..., false)`: BGRA, de arriba abajo. */
    read(into) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, out8.fb);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, into);
      return into;
    },
  };
}
