// Pasted into the page by tools/chrome.mjs --eval-file: draw calls and triangles by
// what they are, in the camera's view and in the sun's shadow pass, at a few views.
(async () => {
  const views = (window.__views ?? [['home woods, north', 825, 1200, Math.PI], ['old fields', 560, 1650, Math.PI * 0.25]]);
  const scene = roi.player.figure.parent, cam = roi.rig.camera, R = roi.renderer;
  let sun; scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) sun = o; });
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  const kinds = () => {
    const k = new Map();
    for (const ch of roi.ground.chunks.values()) ch.group?.traverse((o) => { if (o.isMesh) k.set(o, 'ground'); });
    for (const m of roi.ground.field.meshes()) k.set(m, 'plants ' + m.userData.form);
    for (const t of roi.grass.tiles.values()) { if (t.dense) k.set(t.dense, 'grass'); if (t.sparse) k.set(t.sparse, 'grass far'); }
    k.set(roi.ground.backdrop, 'far ground'); k.set(roi.ground.canopy, 'far roof');
    return k;
  };
  const named = (o) => { for (let p = o; p; p = p.parent) if (p.name) return p.name; return 'other'; };
  const out = {};
  for (const [name, x, z, yaw] of views) {
    roi.teleport(x, z, yaw); roi.rig.yaw = yaw; roi.rig.pitch = -0.12;
    for (let i = 0; i < 20; i++) await frame();
    const k = kinds(), by = {};
    const add = (key, pass, tris) => { by[key] ??= { view: [0, 0], shadow: [0, 0] }; by[key][pass][0]++; by[key][pass][1] += tris; };
    // count real draws: hook the renderer
    const orig = R.renderBufferDirect.bind(R);
    let pass = 'view';
    R.renderBufferDirect = function (camera, sc, geometry, material, object, group) {
      const n = object.isInstancedMesh ? object.count : 1;
      const idx = geometry.index ? geometry.index.count : geometry.attributes.position.count;
      const drawn = group ? Math.min(group.count, idx) : idx;
      add(k.get(object) ?? named(object), camera.isOrthographicCamera ? 'shadow' : 'view', n * drawn / 3);
      return orig(camera, sc, geometry, material, object, group);
    };
    R.render(scene, cam);
    R.renderBufferDirect = orig;
    const rows = Object.entries(by).map(([key, v]) => [key, v.view[0], Math.round(v.view[1] / 1000), v.shadow[0], Math.round(v.shadow[1] / 1000)]).sort((a, b) => (b[1] + b[3]) - (a[1] + a[3]));
    const tot = rows.reduce((t, r) => [t[0] + r[1], t[1] + r[2], t[2] + r[3], t[3] + r[4]], [0, 0, 0, 0]);
    out[name] = [`${'what'.padEnd(28)} view calls  ktris   shadow calls  ktris`, ...rows.map((r) => `${r[0].padEnd(28)}${String(r[1]).padStart(10)}${String(r[2]).padStart(7)}${String(r[3]).padStart(15)}${String(r[4]).padStart(7)}`), `${'total'.padEnd(28)}${String(tot[0]).padStart(10)}${String(tot[1]).padStart(7)}${String(tot[2]).padStart(15)}${String(tot[3]).padStart(7)}`].join('\n');
  }
  return Object.entries(out).map(([k, v]) => `== ${k}\n${v}`).join('\n');
})()
