// How much the game draws at a few places: triangles and draw calls for the
// frame, and what they are spent on (plants by form, grass, ground, the rest),
// both in the camera's view and in the sun's shadow map.
//
//   node tools/perf.mjs [--quality low|medium|high] [--spots "x,z;x,z"] [--ref <git ref>] [--top 8]
//
// --ref also measures that version (a branch, tag or commit, e.g. origin/main;
// a local branch may be behind it) from a
// temporary git worktree and prints the two side by side. Counts are of
// geometry, not time: headless Chromium has no GPU, so this cannot say how
// fast anything runs, only how much there is to draw. (The renderer's own frame
// count leaves out the shadow pass, which is why that is counted separately.)

import { args, serve, checkout, launch, openGame, GAME } from './common.mjs';

const a = args();
const quality = a.quality ?? 'medium';
const SPOTS = a.spots
  ? String(a.spots).split(';').map((s, i) => { const [x, z] = s.split(',').map(Number); return [`${x},${z}`, x, z]; })
  : [['home woods', 1100, 1600], ['deep woods', 700, 3000], ['deep woods (east)', 900, 2700], ['Henneth Annûn, the pool', 975, 1196]];
const TOP = Number(a.top ?? 8);

/** Runs in the page: what is drawn, grouped, in view and into the shadow map. */
function measure(TOP) {
  const scene = roi.player.figure.parent;
  let sun = null;
  scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) sun = o; });
  const planesOf = (cam) => {
    const m = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse), e = m.elements;
    return [[3, 0, -1], [3, 0, 1], [3, 1, 1], [3, 1, -1], [3, 2, -1], [3, 2, 1]].map(([w, k, s]) =>
      [e[w] + s * e[k], e[w + 4] + s * e[k + 4], e[w + 8] + s * e[k + 8], e[w + 12] + s * e[k + 12]]);
  };
  // What each mesh is, from the game's own structures (so it works on older versions too)
  const kinds = new Map();
  for (const ch of roi.ground.chunks.values()) {
    for (const g of ch.veg) g.meshes.forEach((m, k) => kinds.set(m, 'plants: ' + (g.sp.cls === 'cover' ? 'ground cover' : g.sp.sameMid && k === 0 ? 'stone, near and middle' : ['near', 'middle', 'far'][k])));
    ch.group?.traverse((o) => { if (o.isMesh && !o.isInstancedMesh) kinds.set(o, 'ground'); });
  }
  for (const t of roi.grass.tiles.values()) { if (t.dense) kinds.set(t.dense, 'grass'); if (t.sparse) kinds.set(t.sparse, 'grass (far clumps)'); }
  kinds.set(roi.ground.backdrop, 'far ground');
  kinds.set(roi.ground.canopy, 'far forest roof');
  const named = (o) => { for (let p = o; p; p = p.parent) if (p.name) return p.name; return null; };
  const group = (o) => kinds.get(o) ?? named(o) ?? (o.isInstancedMesh ? 'other instanced' : 'other');
  const label = (o) => o.userData.species ?? group(o);
  const tally = (cam, onlyCasters) => {
    const planes = planesOf(cam), by = {}, top = [];
    let total = 0;
    scene.traverse((o) => {
      if (!o.isMesh || (onlyCasters && !o.castShadow)) return;
      for (let p = o; p; p = p.parent) if (!p.visible) return;
      const n = o.isInstancedMesh ? o.count : 1;
      if (!n) return;
      const sph = o.isInstancedMesh && o.boundingSphere ? o.boundingSphere : (o.geometry.boundingSphere ?? (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere));
      if (o.frustumCulled && sph) {
        const c = sph.center.clone().applyMatrix4(o.matrixWorld), r = sph.radius * o.matrixWorld.getMaxScaleOnAxis();
        if (planes.some(([x, y, z, w]) => (x * c.x + y * c.y + z * c.z + w) / Math.hypot(x, y, z) < -r)) return;
      }
      const g = o.geometry, tris = n * (g.index ? g.index.count : g.attributes.position.count) / 3;
      const k = group(o);
      by[k] = (by[k] ?? 0) + tris; total += tris;
      top.push([label(o), tris]);
    });
    const merged = {};
    for (const [l, t] of top) merged[l] = (merged[l] ?? 0) + t;
    return { total, by, top: Object.entries(merged).sort((p, q) => q[1] - p[1]).slice(0, TOP) };
  };
  const info = roi.renderer.info.render;
  return {
    frame: { triangles: info.triangles, calls: info.calls },
    view: tally(roi.rig.camera, false),
    shadow: sun ? tally(sun.shadow.camera, true) : null,
  };
}

async function run(root) {
  const server = await serve(root), browser = await launch();
  try {
    const page = await openGame(browser, server.url, { quality });
    const res = {};
    for (const [name, x, z] of SPOTS) {
      await page.evaluate(([x, z]) => { roi.teleport(x, z, 0); roi.rig.hold?.(null); }, [x, z]);
      await page.waitForTimeout(2500);
      res[name] = await page.evaluate(measure, TOP);
    }
    if (page.errors.length) console.log('errors:\n  ' + [...new Set(page.errors)].join('\n  '));
    return res;
  } finally {
    await browser.close();
    server.close();
  }
}

const k = (n) => (n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'k' : String(Math.round(n)));
const delta = (now, then) => (then === undefined ? '' : `   (${a.ref}: ${k(then)}, ${now >= then ? '+' : ''}${(((now - then) / Math.max(1, then)) * 100).toFixed(0)} %)`);

const now = await run(GAME);
let then = null;
if (a.ref) { const ref = await checkout(String(a.ref)); try { then = await run(ref.root); } finally { await ref.remove(); } }

console.log(`\nquality ${quality}${a.ref ? `, compared with ${a.ref}` : ''}. Triangles are counted, not timed.\n`);
for (const [name] of SPOTS) {
  const r = now[name], p = then?.[name];
  console.log(`== ${name} ==`);
  console.log(`frame (main pass):   ${k(r.frame.triangles)} triangles, ${r.frame.calls} draw calls${p ? `   (${a.ref}: ${k(p.frame.triangles)}, ${p.frame.calls} calls)` : ''}`);
  for (const [what, key] of [['in view', 'view'], ['into the shadow map', 'shadow']]) {
    if (!r[key]) continue;
    console.log(`${what}: ${k(r[key].total)}${delta(r[key].total, p?.[key]?.total)}`);
    const groups = new Set([...Object.keys(r[key].by), ...Object.keys(p?.[key]?.by ?? {})]);
    for (const g of [...groups].sort((x, y) => (r[key].by[y] ?? 0) - (r[key].by[x] ?? 0))) {
      console.log(`  ${g.padEnd(28)} ${k(r[key].by[g] ?? 0).padStart(6)}${delta(r[key].by[g] ?? 0, p ? p[key].by[g] ?? 0 : undefined)}`);
    }
  }
  console.log(`  biggest in view: ${r.view.top.map(([l, t]) => `${l} ${k(t)}`).join(', ')}\n`);
}
