// Sky, sun, fog. The mood shifts toward a sickly haze where blight lies on
// the land and clears as camps are broken up.

import * as THREE from 'three';

const hex = (h) => new THREE.Color(h);
const CLEAR = {
  top: hex(0x4a8ad4), horizon: hex(0xcbd9d8), sun: hex(0xfff0d2), sunPower: 2.7,
  hemiSky: hex(0xd4e4ff), hemiGround: hex(0x7d7a52), hemiPower: 1.15, fogNear: 90, fogFar: 1,
};
const BLIGHT = {
  top: hex(0x66757a), horizon: hex(0x9ea08a), sun: hex(0xcfd0b0), sunPower: 1.1,
  hemiSky: hex(0xa9b0a8), hemiGround: hex(0x5b5c4c), hemiPower: 0.95, fogNear: 15, fogFar: 0.3,
};

/** Unit vector pointing at the sun: low in the west, so it shines into the cave. */
export const SUN_DIR = new THREE.Vector3(-0.86, 0.42, 0.28).normalize();

export class Atmosphere {
  constructor(scene, quality) {
    this.quality = quality;
    this.blight = 0;

    this.sun = new THREE.DirectionalLight(CLEAR.sun, CLEAR.sunPower);
    this.sun.shadow.mapSize.set(2048, 2048);
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
      sunDir: { value: SUN_DIR }, sunCol: { value: CLEAR.sun.clone() }, sunAmt: { value: 1 },
    };
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(5000, 24, 12),
      new THREE.ShaderMaterial({
        uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
        vertexShader: `varying vec3 vDir;
          void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunAmt;
          varying vec3 vDir;
          void main() {
            vec3 d = normalize(vDir);
            vec3 c = mix(horizon, top, smoothstep(0.0, 0.55, d.y));
            float s = max(dot(d, sunDir), 0.0);
            c += sunCol * sunAmt * (pow(s, 5.0) * 0.22 + pow(s, 80.0) * 0.5 + smoothstep(0.9990, 0.9994, s) * 3.0);
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    );
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    scene.add(this.sky);
    this.setQuality(quality);
  }

  setQuality(quality) {
    this.quality = quality;
    this.sun.castShadow = quality.shadows;
  }

  /** @param {number} blight 0..1 at the player's position */
  update(camera, focus, blight, dt) {
    this.blight += (blight - this.blight) * Math.min(1, dt * 0.8);
    const t = this.blight;
    const u = this.uniforms;
    u.top.value.lerpColors(CLEAR.top, BLIGHT.top, t);
    u.horizon.value.lerpColors(CLEAR.horizon, BLIGHT.horizon, t);
    u.sunAmt.value = 1 - 0.8 * t;
    this.fog.color.copy(u.horizon.value);
    this.fog.near = THREE.MathUtils.lerp(CLEAR.fogNear, BLIGHT.fogNear, t);
    this.fog.far = this.quality.fogFar * THREE.MathUtils.lerp(CLEAR.fogFar, BLIGHT.fogFar, t);
    this.sun.color.lerpColors(CLEAR.sun, BLIGHT.sun, t);
    this.sun.intensity = THREE.MathUtils.lerp(CLEAR.sunPower, BLIGHT.sunPower, t);
    this.hemi.color.lerpColors(CLEAR.hemiSky, BLIGHT.hemiSky, t);
    this.hemi.groundColor.lerpColors(CLEAR.hemiGround, BLIGHT.hemiGround, t);
    this.hemi.intensity = THREE.MathUtils.lerp(CLEAR.hemiPower, BLIGHT.hemiPower, t);

    this.sky.position.copy(camera.position);
    // Snap the shadow frustum to whole metres so shadows do not shimmer.
    const fx = Math.round(focus.x), fy = Math.round(focus.y), fz = Math.round(focus.z);
    this.sun.target.position.set(fx, fy, fz);
    this.sun.position.set(fx, fy, fz).addScaledVector(SUN_DIR, 350);
  }
}
