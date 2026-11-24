// HDR rendering with bloom, then tone mapping to the screen.
//
// The scene draws into a half-float target (with stencil, for the sky trick, and
// optionally multisampled). Bloom is the usual mip chain: downsample with a
// 13-tap filter, upsample with a tent filter adding each level into the one
// above. The final pass mixes a little bloom in and applies the renderer's tone
// mapping and sRGB output (materials skip both while drawing into a target).

import * as THREE from 'three';

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const DOWN_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uFirst;
varying vec2 vUv;
vec3 s(vec2 o) { return texture2D(uSrc, vUv + o * uTexel).rgb; }
// Karis average on the first level tames single blazing pixels (the sun)
float w(vec3 c) { return uFirst > 0.5 ? 1.0 / (1.0 + max(c.r, max(c.g, c.b)) * 0.25) : 1.0; }
void main() {
  vec3 a = s(vec2(-2, -2)), b = s(vec2(0, -2)), c = s(vec2(2, -2));
  vec3 d = s(vec2(-1, -1)), e = s(vec2(1, -1));
  vec3 f = s(vec2(-2, 0)), g = s(vec2(0, 0)), h = s(vec2(2, 0));
  vec3 i = s(vec2(-1, 1)), j = s(vec2(1, 1));
  vec3 k = s(vec2(-2, 2)), l = s(vec2(0, 2)), m = s(vec2(2, 2));
  vec3 g0 = (d + e + i + j) * 0.25, g1 = (a + b + f + g) * 0.25, g2 = (b + c + g + h) * 0.25, g3 = (f + g + k + l) * 0.25, g4 = (g + h + l + m) * 0.25;
  float w0 = w(g0) * 0.5, w1 = w(g1) * 0.125, w2 = w(g2) * 0.125, w3 = w(g3) * 0.125, w4 = w(g4) * 0.125;
  gl_FragColor = vec4((g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4), 1.0);
}
`;

const UP_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uSrc; uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 c = vec3(0.0);
  c += texture2D(uSrc, vUv + vec2(-1, -1) * uTexel).rgb;
  c += texture2D(uSrc, vUv + vec2(0, -1) * uTexel).rgb * 2.0;
  c += texture2D(uSrc, vUv + vec2(1, -1) * uTexel).rgb;
  c += texture2D(uSrc, vUv + vec2(-1, 0) * uTexel).rgb * 2.0;
  c += texture2D(uSrc, vUv).rgb * 4.0;
  c += texture2D(uSrc, vUv + vec2(1, 0) * uTexel).rgb * 2.0;
  c += texture2D(uSrc, vUv + vec2(-1, 1) * uTexel).rgb;
  c += texture2D(uSrc, vUv + vec2(0, 1) * uTexel).rgb * 2.0;
  c += texture2D(uSrc, vUv + vec2(1, 1) * uTexel).rgb;
  gl_FragColor = vec4(c / 16.0, 1.0);
}
`;

const FINAL_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uScene; uniform sampler2D uBloom; uniform float uStrength;
varying vec2 vUv;
void main() {
  vec3 c = mix(texture2D(uScene, vUv).rgb, texture2D(uBloom, vUv).rgb, uStrength);
  // a whisper of vignette, as a lens would
  vec2 q = vUv - 0.5;
  c *= 1.0 - 0.18 * dot(q, q) * 2.0;
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export class Post {
  constructor(renderer) {
    this.renderer = renderer;
    this.samples = 0;
    this.levels = [];
    this.target = null;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    const mat = (frag, uniforms, extra = {}) => new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, ...extra,
    });
    this.down = mat(DOWN_FRAG, { uSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uFirst: { value: 0 } }, { toneMapped: false });
    this.up = mat(UP_FRAG, { uSrc: { value: null }, uTexel: { value: new THREE.Vector2() } },
      { toneMapped: false, blending: THREE.AdditiveBlending, transparent: true });
    this.final = mat(FINAL_FRAG, { uScene: { value: null }, uBloom: { value: null }, uStrength: { value: 0.05 } });
  }

  /** (Re)allocate targets for a drawing-buffer size; samples 0 or 4. */
  setSize(w, h, samples) {
    w = Math.max(1, Math.floor(w)); h = Math.max(1, Math.floor(h));
    if (this.target && this.w === w && this.h === h && this.samples === samples) return;
    this.dispose();
    this.w = w; this.h = h; this.samples = samples;
    this.target = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType, depthBuffer: true, stencilBuffer: true, samples,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    });
    let lw = w, lh = h;
    for (let i = 0; i < 6; i++) {
      lw = Math.max(1, lw >> 1); lh = Math.max(1, lh >> 1);
      this.levels.push(new THREE.WebGLRenderTarget(lw, lh, {
        type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      }));
      if (lw < 8 || lh < 8) break;
    }
  }

  dispose() {
    this.target?.dispose();
    for (const l of this.levels) l.dispose();
    this.levels = [];
    this.target = null;
  }

  begin() { this.renderer.setRenderTarget(this.target); }

  pass(material, out) {
    this.quad.material = material;
    this.renderer.setRenderTarget(out);
    this.renderer.render(this.scene, this.camera);
  }

  end(strength) {
    const r = this.renderer;
    const autoClear = r.autoClear;
    r.autoClear = false;
    let src = this.target;
    this.levels.forEach((dst, i) => {
      this.down.uniforms.uSrc.value = src.texture;
      this.down.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this.down.uniforms.uFirst.value = i === 0 ? 1 : 0;
      r.setRenderTarget(dst); r.clear(true, false, false);
      this.pass(this.down, dst);
      src = dst;
    });
    for (let i = this.levels.length - 1; i > 0; i--) {
      const from = this.levels[i], to = this.levels[i - 1];
      this.up.uniforms.uSrc.value = from.texture;
      this.up.uniforms.uTexel.value.set(1 / from.width, 1 / from.height);
      this.pass(this.up, to);
    }
    this.final.uniforms.uScene.value = this.target.texture;
    this.final.uniforms.uBloom.value = this.levels[0].texture;
    this.final.uniforms.uStrength.value = strength;
    this.pass(this.final, null);
    r.autoClear = autoClear;
  }
}
