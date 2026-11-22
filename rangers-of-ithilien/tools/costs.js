// Pasted into the page by tools/chrome.mjs --eval-file: how much of the time to draw a
// frame each kind of thing takes (drawn flat out with it hidden, against all of it).
(async () => {
  const { drawCost } = await import('./src/bench.js');
  const views = (window.__views ?? [['home woods, north', 825, 1200, Math.PI], ['old fields', 560, 1650, Math.PI * 0.25]]);
  const scene = roi.player.figure.parent, cam = roi.rig.camera, R = roi.renderer;
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  const named = (o) => { for (let p = o; p; p = p.parent) if (p.name) return p.name; return 'other'; };
  const kindOf = () => {
    const k = new Map();
    for (const ch of roi.ground.chunks.values()) ch.group?.traverse((o) => { if (o.isMesh) k.set(o, 'ground'); });
    for (const m of roi.ground.field.meshes()) k.set(m, 'plants ' + m.userData.form + (m.userData.shade ? ' (shadow)' : ''));
    for (const t of roi.grass.tiles.values()) { if (t.dense) k.set(t.dense, 'grass'); if (t.sparse) k.set(t.sparse, 'grass far'); }
    k.set(roi.ground.backdrop, 'far ground'); k.set(roi.ground.canopy, 'far roof');
    return k;
  };
  const out = [];
  for (const [name, x, z, yaw] of views) {
    roi.teleport(x, z, yaw); roi.rig.yaw = yaw; roi.rig.pitch = -0.12;
    for (let i = 0; i < 30; i++) await frame();
    await new Promise((r) => setTimeout(r, 1600)); // camps sort what is near
    for (let i = 0; i < 5; i++) await frame();
    const k = kindOf(), groups = new Map();
    scene.traverse((o) => { if (!o.isMesh && !o.isPoints) return; const g = k.get(o) ?? named(o); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(o); });
    const all = drawCost(R, scene, cam, 8, 7).ms;
    const rows = [];
    const shadowsOff = () => { const was = R.shadowMap.autoUpdate; R.shadowMap.autoUpdate = false; R.shadowMap.needsUpdate = false; const ms = drawCost(R, scene, cam, 8, 7).ms; R.shadowMap.autoUpdate = was; return ms; };
    rows.push(['the shadow pass', all - shadowsOff()]);
    const pr = R.getPixelRatio(); R.setPixelRatio(pr / 2); rows.push(['3/4 of the pixels', all - drawCost(R, scene, cam, 8, 7).ms]); R.setPixelRatio(pr);
    for (const [g, list] of groups) {
      if (g.includes('(shadow)')) continue;
      const was = list.map((o) => o.visible); list.forEach((o) => { o.visible = false; });
      // a plant form's shadow casters go with it
      const sh = g.startsWith('plants') ? (groups.get(g + ' (shadow)') ?? []) : [];
      const show = roi.ground.field.shadowPass; if (sh.length) roi.ground.field.shadowPass = () => {};
      rows.push([g, all - drawCost(R, scene, cam, 8, 7).ms]);
      roi.ground.field.shadowPass = show;
      list.forEach((o, i) => { o.visible = was[i]; });
    }
    rows.sort((a, b) => b[1] - a[1]);
    out.push(`== ${name}: ${all.toFixed(2)} ms\n` + rows.map(([g, ms]) => `${g.padEnd(30)}${ms.toFixed(2).padStart(7)}`).join('\n'));
  }
  return out.join('\n');
})()
