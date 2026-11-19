// Screenshots of the game from a list of views, for looking at visual changes.
//
//   node tools/shoot.mjs <views.json> [--quality low|medium|high] [--out <dir>]
//                        [--only name,name] [--size 1100x700] [--ref <git ref>]
//
// With --ref (a branch, tag or commit, e.g. origin/main;
// a local branch may be behind it) every view is also shot on
// that version of the game, from a temporary git worktree, and the two are set
// side by side in <name>.compare.png (the ref on the left). Fails if the game
// logs an error. Shots go to --out (default: roi-shots in the system temp dir).
//
// A views file is a JSON array; each view has a `name` and any of:
//   ranger: [x, z, yaw]          put the ranger there first (roi.teleport)
//   from: [x, y, z], at: [x, y, z]   hold the camera at `from`, looking at `at`
//   follow: [dx, dy, dz]         hold the camera at that offset from the ranger, looking at them
//                                (neither: the game's own camera behind the ranger)
//   fov: degrees                 (default 62)
//   hold: "KeyW"                 keep a key down while waiting (W: run forward)
//   eval: "js"                   run in the page first (roi is the game's console API)
//   wait: ms                     how long to let it settle (default 2500)
// See tools/views/ for examples. In software rendering a frame can take a second
// or more, so a view with `hold` sees only a few steps of motion.

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { args, serve, checkout, launch, openGame, GAME } from './common.mjs';

const a = args();
if (!a._[0]) { console.log('usage: node tools/shoot.mjs <views.json> [--quality medium] [--out dir] [--only a,b] [--size WxH] [--ref main]'); process.exit(1); }
let views = JSON.parse(await readFile(resolve(a._[0]), 'utf8'));
if (a.only) { const only = new Set(String(a.only).split(',')); views = views.filter((v) => only.has(v.name)); }
const out = resolve(a.out ?? join(tmpdir(), 'roi-shots'));
const [width, height] = String(a.size ?? '1100x700').split('x').map(Number);
const quality = a.quality ?? 'medium';
await mkdir(out, { recursive: true });

/** Shoot every view on one copy of the game; returns false if it logged errors. */
async function shootAll(root, suffix) {
  const server = await serve(root), browser = await launch();
  try {
    const page = await openGame(browser, server.url, { quality, width, height });
    for (const v of views) {
      const t0 = Date.now();
      await page.evaluate((v) => {
        if (v.ranger) roi.teleport(v.ranger[0], v.ranger[1], v.ranger[2] ?? 0);
        if (v.eval) (0, eval)(v.eval);
        const held = v.from ? { from: v.from, at: v.at, fov: v.fov } : v.follow ? { offset: v.follow, fov: v.fov } : null;
        if (roi.rig.hold) { roi.rig.hold(held); return; }
        // an older version of the game, before the camera could be held: stand in for it
        const rig = roi.rig;
        rig._own ??= rig.update;
        rig.update = !held ? rig._own : function (dt, input, player) {
          const c = this.camera, p = player.pos;
          if (held.offset) { c.position.set(p.x + held.offset[0], p.y + held.offset[1], p.z + held.offset[2]); c.lookAt(p.x, p.y + 1.1, p.z); }
          else { c.position.set(...held.from); c.lookAt(...held.at); }
          c.fov = held.fov ?? 62; c.updateProjectionMatrix();
        };
      }, v);
      if (v.hold) await page.keyboard.down(v.hold);
      await page.waitForTimeout(v.wait ?? 2500);
      const file = join(out, `${v.name}${suffix}.png`);
      await page.screenshot({ path: file, timeout: 300000 });
      if (v.hold) await page.keyboard.up(v.hold);
      console.log(`${file}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
    if (page.errors.length) console.log(`errors${suffix}:\n  ` + [...new Set(page.errors)].join('\n  '));
    return page.errors.length === 0;
  } finally {
    await browser.close();
    server.close();
  }
}

let ok = await shootAll(GAME, '');
if (a.ref) {
  const ref = await checkout(String(a.ref));
  try { ok = (await shootAll(ref.root, '.ref')) && ok; } finally { await ref.remove(); }
  // side by side: the ref on the left, this version on the right
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: width * 2 + 12, height: height + 30 } });
    for (const v of views) {
      const img = async (s) => 'data:image/png;base64,' + (await readFile(join(out, `${v.name}${s}.png`))).toString('base64');
      const cell = (src, label) => `<figure style="margin:0"><figcaption style="font:13px sans-serif;height:24px">${label}</figcaption><img src="${src}" width="${width}" height="${height}"></figure>`;
      await page.setContent(`<body style="margin:0;display:flex;gap:12px;background:#fff">${cell(await img('.ref'), String(a.ref))}${cell(await img(''), 'this version')}</body>`);
      const file = join(out, `${v.name}.compare.png`);
      await page.screenshot({ path: file });
      console.log(file);
    }
  } finally { await browser.close(); }
}
await writeFile(join(out, 'views.json'), JSON.stringify(views, null, 1));
process.exit(ok ? 0 : 1);
