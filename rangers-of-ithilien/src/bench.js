// The frame-rate test (?bench, or roi.bench() in the console): a fixed tour of
// views, each held a few seconds while the frames are timed, so a change can be
// measured on a real device before and after. For each view it reports the frame
// time the player sees (median and the slowest 5 %, held to the display's rate)
// and the cost of drawing one frame flat out (each frame waited for, so a fast
// machine shows how much room it has left), with draw calls and triangles.
// Then it runs the ranger along two stretches at a run, as new land comes into
// range, and reports the slow frames that building it costs (the hitches seen
// while walking, which a still view never shows).
// The picture is held at its sharpest while it runs.

import { PLAYER } from './config.js';

export const TOUR = [
  // name, x, z, yaw, pitch
  ['home woods, north', 825, 1200, Math.PI, 0.05],
  ['home woods, east', 825, 1200, Math.PI / 2, 0.05],
  ['glades by the cave', 727, 860, -Math.PI / 2, 0.08],
  ['deep woods, south', 300, 2350, 0, 0.05],
  ['deep woods, east', 1000, 2325, -Math.PI / 2, 0.05],
  ['heath', 1250, 1500, Math.PI * 0.75, 0.05],
  ['old fields', 560, 1650, Math.PI * 0.25, 0.05],
];

export const RUNS = [
  // name, x, z, yaw (the way run), seconds
  ['running, deep woods', 300, 2350, Math.PI / 2, 15],
  ['running, old fields', 560, 1650, Math.PI * 0.25, 15],
];

const frame = () => new Promise((r) => requestAnimationFrame(r));
const wait = (s) => new Promise((r) => setTimeout(r, s * 1000));
const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];

/** Time drawing the frame `n` times over, each waited for; the median of a few tries, in ms. */
export function drawCost(renderer, scene, camera, n = 6, tries = 5) {
  const gl = renderer.getContext(), px = new Uint8Array(4);
  const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  renderer.render(scene, camera); sync();
  const calls = renderer.info.render.calls, tris = renderer.info.render.triangles;
  const ts = [];
  for (let t = 0; t < tries; t++) {
    const t0 = performance.now();
    for (let i = 0; i < n; i++) { renderer.render(scene, camera); sync(); }
    ts.push((performance.now() - t0) / n);
  }
  ts.sort((a, b) => a - b);
  return { ms: ts[tries >> 1], calls, tris };
}

export async function runBench(api, { secs = 3, views = TOUR, runs = RUNS, show = true } = {}) {
  const { renderer, rig, ground, grass } = api;
  const scene = api.player.figure.parent, camera = rig.camera;
  const box = document.createElement('pre');
  box.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;margin:0;padding:8px 10px;background:rgba(0,0,0,.72);color:#e8e2c8;font:11px/1.35 ui-monospace,monospace;white-space:pre-wrap;user-select:text;-webkit-user-select:text';
  if (show) document.body.appendChild(box);
  const lines = [`quality ${api.qualityName}  ${renderer.domElement.width}x${renderer.domElement.height} (x${renderer.getPixelRatio()})  ${navigator.userAgent.match(/(iPhone|iPad|Android|Mac OS X|Windows|Linux)[^;)]*/)?.[0] ?? ''}`];
  const say = (s) => { if (s) lines.push(s); box.textContent = lines.join('\n') + '\n'; };
  say('view                      frame ms (median / slowest 5%)   draw ms   calls  tris');
  api.holdResolution(true);
  const rows = [];
  for (const [name, x, z, yaw, pitch] of views) {
    api.teleport(x, z, yaw);
    rig.yaw = yaw; rig.pitch = pitch;
    for (let i = 0; i < 40 && (ground.update(x, z, 4) > 0); i++) await frame();
    grass.update(x, z, 1e3);
    for (let i = 0; i < 30; i++) { rig.yaw = yaw; rig.pitch = pitch; await frame(); } // settle: shaders, uploads
    await wait(0.5);
    const times = [];
    let last = performance.now();
    const end = last + secs * 1000;
    while (performance.now() < end) { rig.yaw = yaw; rig.pitch = pitch; await frame(); const now = performance.now(); times.push(now - last); last = now; }
    times.sort((a, b) => a - b);
    const d = drawCost(renderer, scene, camera);
    const row = { name, median: pct(times, 0.5), p95: pct(times, 0.95), draw: d.ms, calls: d.calls, tris: d.tris };
    rows.push(row);
    say(`${name.padEnd(26)}${row.median.toFixed(1).padStart(6)} / ${row.p95.toFixed(1).padEnd(22)}${row.draw.toFixed(1).padStart(7)}${String(row.calls).padStart(8)}${(Math.round(row.tris / 1000) + 'k').padStart(7)}`);
  }
  const mean = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
  if (rows.length) say(`${'mean'.padEnd(26)}${mean('median').toFixed(1).padStart(6)} / ${mean('p95').toFixed(1).padEnd(22)}${mean('draw').toFixed(1).padStart(7)}${String(Math.round(mean('calls'))).padStart(8)}${(Math.round(mean('tris') / 1000) + 'k').padStart(7)}`);

  // At a run: the ranger is carried along a line (the game builds what comes into
  // range as it would), and every frame is timed.
  const walks = [];
  if (runs.length) say('\nrun                       frame ms (median / slowest 5% / 1%)  slowest  over 25 / 33 ms  built');
  for (const [name, x0, z0, yaw, s] of runs) {
    api.teleport(x0, z0, yaw);
    rig.pitch = 0.05;
    for (let i = 0; i < 30; i++) { rig.yaw = yaw; await frame(); }
    await wait(0.5);
    let chunks = 0, tiles = 0;
    const commit = ground.commit, put = grass.put;
    ground.commit = function (...a) { chunks++; return commit.apply(this, a); };
    grass.put = function (...a) { tiles++; return put.apply(this, a); };
    const fx = Math.sin(yaw), fz = Math.cos(yaw), times = [];
    const t0 = performance.now();
    let last = t0;
    while (last - t0 < s * 1000) {
      const d = PLAYER.runSpeed * (last - t0) / 1000;
      api.player.place(x0 + fx * d, z0 + fz * d, yaw);
      rig.yaw = yaw; rig.pitch = 0.05;
      await frame();
      const now = performance.now(); times.push(now - last); last = now;
    }
    delete ground.commit; delete grass.put; // (back to the class's own)
    const sorted = [...times].sort((a, b) => a - b);
    const w = { name, median: pct(sorted, 0.5), p95: pct(sorted, 0.95), p99: pct(sorted, 0.99), max: sorted[sorted.length - 1], over25: times.filter((t) => t > 25).length, over33: times.filter((t) => t > 33.4).length, frames: times.length, chunks, tiles };
    walks.push(w);
    say(`${name.padEnd(26)}${w.median.toFixed(1).padStart(6)} / ${w.p95.toFixed(1)} / ${w.p99.toFixed(1).padEnd(17)}${w.max.toFixed(0).padStart(7)}${String(w.over25).padStart(9)} / ${String(w.over33).padEnd(6)}${chunks} chunks, ${tiles} grass`);
  }
  api.holdResolution(false);
  say('(tap to close)');
  box.onclick = () => box.remove();
  return { lines, rows, walks };
}
