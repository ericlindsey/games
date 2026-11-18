// Sky, sun, fog. The mood shifts toward a sickly haze where blight lies on
// the land and clears as camps are broken up.

import * as THREE from 'three';
import { surfaceUniforms } from './surface.js';

const hex = (h) => new THREE.Color(h);
const CLEAR = {
  top: hex(0x4a8ad4), horizon: hex(0xcbd9d8), sun: hex(0xfff0d2), sunPower: 2.7,
  hemiSky: hex(0xd4e4ff), hemiGround: hex(0x7d7a52), hemiPower: 1.15, fogNear: 90, fogFar: 1,
};
const BLIGHT = {
  top: hex(0x66757a), horizon: hex(0x9ea08a), sun: hex(0xcfd0b0), sunPower: 1.1,
  hemiSky: hex(0xa9b0a8), hemiGround: hex(0x5b5c4c), hemiPower: 0.95, fogNear: 15, fogFar: 0.3,
};

// Under a closed canopy: green-gold dimness, and the haze draws in.
const SHADE = { fog: hex(0xa9c08e), sun: 0.45, hemi: 0.8, hemiSky: hex(0xb9d69a), fogFar: 0.3, fogNear: 25 };

/** Unit vector pointing at the sun: low in the west, so it shines into the cave. */
export const SUN_DIR = new THREE.Vector3(-0.86, 0.42, 0.28).normalize();

export class Atmosphere {
  constructor(scene, quality) {
    this.quality = quality;
    this.blight = 0;

    this.sun = new THREE.DirectionalLight(CLEAR.sun, CLEAR.sunPower);
    this.sun.shadow.mapSize.set(quality.shadowMap || 1024, quality.shadowMap || 1024);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -110; sc.right = sc.top = 110; sc.near = 10; sc.far = 700;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight(CLEAR.hemiSky, CLEAR.hemiGround, CLEAR.hemiPower);
    scene.add(this.hemi);

    this.fog = new THREE.Fog(CLEAR.horizon.clone(), CLEAR.fogNear, quality.fogFar);
    scene.fog = this.fog;

    this.uniforms = {
      top: { value: CLEAR.top.clone() }, horizon: { value: CLEAR.horizon.clone() },
      sunDir: { value: SUN_DIR }, sunCol: { value: CLEAR.sun.clone() }, sunAmt: { value: 1 }, time: { value: 0 }, cloudAmt: { value: 1 },
    };
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(5000, 24, 12),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
        vertexShader: `varying vec3 vDir;
          void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunAmt; uniform float time; uniform float cloudAmt;
          varying vec3 vDir;
          float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
          float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += vn(p) * a; p = p * 2.03 + 7.1; a *= 0.5; } return s; }
          void main() {
            vec3 d = normalize(vDir);
            vec3 c = mix(horizon, top, smoothstep(0.0, 0.55, d.y));
            float s = max(dot(d, sunDir), 0.0);
            // high, soft fair-weather cloud, thinning toward the horizon and drifting east
            if (d.y > 0.0) {
              vec2 uv = d.xz / (d.y + 0.12) * 1.6 + vec2(time * 0.004, time * 0.0015);
              float n = fbm(uv);
              float cl = smoothstep(0.5, 0.78, n) * smoothstep(0.0, 0.28, d.y) * cloudAmt;
              vec3 lit = mix(horizon * 1.05, vec3(1.0, 0.97, 0.92), 0.6) + sunCol * pow(s, 6.0) * 0.5;
              c = mix(c, lit * (0.85 + 0.25 * (n - 0.5)), cl * 0.85);
            }
            c += sunCol * sunAmt * (pow(s, 5.0) * 0.22 + pow(s, 80.0) * 0.5 + smoothstep(0.9990, 0.9994, s) * 3.0);
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    );
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    scene.add(this.sky);
    surfaceUniforms.uSunDir.value.copy(SUN_DIR);
    this.setQuality(quality);
  }

  setQuality(quality) {
    this.quality = quality;
    this.sun.castShadow = quality.shadows;
  }

  /**
   * @param {number} blight 0..1 at the player's position
   * @param {number} shade 0..1: how closed the forest roof is overhead
   * @param {boolean} indoors true inside the cave
   */
  update(camera, focus, blight, dt, shade = 0, indoors = false) {
    const ease = Math.min(1, dt * 0.8);
    this.blight += (blight - this.blight) * ease;
    this.shade = (this.shade ?? 0) + (shade - (this.shade ?? 0)) * Math.min(1, dt * 0.6);
    this.indoors = (this.indoors ?? 0) + ((indoors ? 1 : 0) - (this.indoors ?? 0)) * Math.min(1, dt * 2.5);
    const t = this.blight, sh = this.shade * (1 - t), dim = 1 - 0.72 * this.indoors;
    const L = THREE.MathUtils.lerp;
    const u = this.uniforms;
    u.top.value.lerpColors(CLEAR.top, BLIGHT.top, t);
    u.horizon.value.lerpColors(CLEAR.horizon, BLIGHT.horizon, t);
    u.sunAmt.value = 1 - 0.8 * t;
    u.time.value += dt;
    u.cloudAmt.value = 1 - 0.5 * t;
    this.fog.color.copy(u.horizon.value).lerp(SHADE.fog, sh * 0.75);
    this.fog.near = L(L(CLEAR.fogNear, BLIGHT.fogNear, t), SHADE.fogNear, sh);
    this.fog.far = this.quality.fogFar * L(L(CLEAR.fogFar, BLIGHT.fogFar, t), SHADE.fogFar, sh);
    this.sun.color.lerpColors(CLEAR.sun, BLIGHT.sun, t);
    surfaceUniforms.uSkyColor.value.copy(u.horizon.value).lerp(u.top.value, 0.25).multiplyScalar(dim);
    surfaceUniforms.uSunGlow.value.copy(this.sun.color).multiplyScalar((1 - 0.6 * t) * dim);
    // With real shadows the trees already block the sun; without them, dim it by hand.
    this.sun.intensity = L(CLEAR.sunPower, BLIGHT.sunPower, t) * dim * (this.quality.shadows ? 1 - 0.15 * sh : L(1, SHADE.sun, sh));
    this.hemi.color.lerpColors(CLEAR.hemiSky, BLIGHT.hemiSky, t).lerp(SHADE.hemiSky, sh * 0.6);
    this.hemi.groundColor.lerpColors(CLEAR.hemiGround, BLIGHT.hemiGround, t);
    this.hemi.intensity = L(CLEAR.hemiPower, BLIGHT.hemiPower, t) * L(1, SHADE.hemi, sh) * dim;

    this.sky.position.copy(camera.position);
    // Snap the shadow frustum to whole metres so shadows do not shimmer.
    const fx = Math.round(focus.x), fy = Math.round(focus.y), fz = Math.round(focus.z);
    this.sun.target.position.set(fx, fy, fz);
    this.sun.position.set(fx, fy, fz).addScaledVector(SUN_DIR, 350);
  }
}
