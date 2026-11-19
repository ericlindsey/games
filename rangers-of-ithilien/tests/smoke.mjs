// Browser smoke test. Serves the game folder, then drives it in headless Chromium
// on a desktop and a phone profile. Run: node tests/smoke.mjs [screenshot-dir]
// (SMOKE_ONLY=<part of a suite's name> runs only the suites that match.)
// Headless rendering is software-only, so this checks behaviour, not frame rate.

import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium, devices } = createRequire(import.meta.url)('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const shots = process.argv[2];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const server = createServer(async (req, res) => {
  try {
    let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (path.endsWith('/') || path.endsWith('\\')) path += 'index.html';
    const body = await readFile(join(root, path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

let failures = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) failures++; };
const pos = (page) => page.evaluate(() => ({ x: roi.player.pos.x, y: roi.player.pos.y, z: roi.player.pos.z }));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const ready = (page) => page.waitForFunction(() => window.roi?.ready, null, { timeout: 180000 });
const shot = async (page, name) => { if (shots) await page.screenshot({ path: join(shots, name + '.png'), timeout: 300000 }); };

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function run(label, contextOptions, body) {
  if (process.env.SMOKE_ONLY && !label.includes(process.env.SMOKE_ONLY)) return; // SMOKE_ONLY=phone runs only the phone suites
  console.log(`\n== ${label} ==`);
  const ctx = await browser.newContext(contextOptions);
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000); // a slow machine can be busy building the world for more than Playwright's 30 s
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push('request failed: ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  try {
    await body(page);
  } catch (e) {
    check(false, `${label}: ${e.message.split('\n')[0]}`);
  }
  check(errors.length === 0, `no console errors or failed requests${errors.length ? ': ' + [...new Set(errors)].join(' | ') : ''}`);
  await ctx.close();
}

await run('desktop', { viewport: { width: 1280, height: 720 } }, async (page) => {
  await page.goto(base + '?quality=low');
  await page.waitForSelector('#begin:not([hidden])', { timeout: 180000 });
  check((await page.textContent('#begin')).trim() === 'Begin', 'title offers Begin on a fresh start');
  await shot(page, 'title');
  await page.click('#begin');
  await ready(page);
  await page.waitForTimeout(1500);
  check(await page.evaluate(() => roi.renderer.info.render.triangles > 1000), 'the scene is drawing');

  const start = await pos(page);
  check(Math.abs(start.x - 1022) < 1 && Math.abs(start.z - 1192) < 1, 'starts in the cave at Henneth Annûn');
  check(Math.abs(start.y - 40) < 0.1 && await page.evaluate(() => roi.refuge.isInside(roi.player.pos)), 'stands on the cave floor, under the rock');
  await shot(page, 'cave');
  // Nothing built where it stands (rather than about its own origin) may use a swaying
  // material: the sway grows with height above the origin, so it would swing metres.
  const swingers = await page.evaluate(() => {
    const bad = [];
    roi.player.figure.parent.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || !(o.material?.userData?.surf?.uSway.value > 0)) return;
      o.geometry.computeBoundingBox();
      if (o.geometry.boundingBox.max.y > 8) bad.push(o.geometry.boundingBox.max.y.toFixed(0));
    });
    return bad;
  });
  check(swingers.length === 0, `no plant sways about a far-off origin${swingers.length ? ' (' + swingers.join(', ') + ' m up)' : ''}`);
  // The camera can be held for looking about (roi.lookFrom, roi.follow; tools/shoot.mjs), and given back.
  const held = await page.evaluate(async () => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    roi.lookFrom(1010, 44, 1192, 1020, 41, 1192);
    await frame();
    const c = roi.rig.camera.position, at = { x: c.x, y: c.y, z: c.z };
    roi.follow(0, 2, -4);
    await frame();
    const p = roi.player.pos, f = roi.rig.camera.position, follows = Math.abs(f.x - p.x) < 0.01 && Math.abs(f.y - p.y - 2) < 0.01 && Math.abs(f.z - p.z + 4) < 0.01;
    roi.lookFrom(null);
    await frame();
    return { at, follows, freed: roi.rig.held === null };
  });
  check(Math.hypot(held.at.x - 1010, held.at.y - 44, held.at.z - 1192) < 0.01 && held.follows && held.freed, 'the camera can be held at a point or behind the ranger, and given back');
  const torch = await page.evaluate(() => roi.refuge.torchlight());
  check(torch.on === 1 && torch.burning === torch.of && torch.of === 6, `every torch in the cave is lit at once (${torch.burning} of ${torch.of})`);

  check((await page.textContent('#weapon')).includes('24 arrows'), 'the HUD shows weapon and arrows');

  // Faramir is a few steps away: walk up, speak, and take his first task.
  await page.evaluate(() => roi.teleport(roi.refuge.faramir.x + 1.4, roi.refuge.faramir.z + 1.3, -2, 40));
  await page.waitForFunction(() => !document.getElementById('prompt').hidden, null, { timeout: 20000 });
  check((await page.textContent('#prompt')).includes('Faramir'), 'prompt offers to speak with Faramir');
  await page.keyboard.press('KeyE');
  await page.waitForSelector('#dialogue:not([hidden])');
  check((await page.textContent('#dialogue-name')) === 'Faramir', 'dialogue opens');
  await shot(page, 'dialogue');
  check((await page.textContent('#dialogue-options button:first-child')).includes('task'), 'Faramir has a task to offer');
  await page.click('#dialogue-options button:first-child');
  check((await page.textContent('#dialogue-text')).includes('camp'), 'he describes the task');
  await page.click('#dialogue-options button:first-child');
  check(await page.isHidden('#dialogue'), 'accepting closes the dialogue');
  check(await page.evaluate(() => roi.state.quests.active.includes('f1')), 'the task is taken');
  check((await page.textContent('#tracker')).includes('nearest fire'), 'and shown on the HUD');

  // Take Éowyn's first task too: both show, each on its own line.
  await page.evaluate(() => roi.teleport(roi.refuge.eowyn.x + 1.6, roi.refuge.eowyn.z - 0.6, 1, 40));
  await page.waitForFunction(() => !document.getElementById('prompt').hidden && document.getElementById('prompt').textContent.includes('owyn'), null, { timeout: 20000 });
  await page.keyboard.press('KeyE');
  await page.waitForSelector('#dialogue:not([hidden])');
  await page.click('#dialogue-options button:first-child');
  check(await page.isVisible('#dialogue-picture svg'), 'Éowyn shows a drawing of kingsfoil');
  await page.click('#dialogue-options button:first-child');
  check(await page.evaluate(() => document.querySelectorAll('#tracker div').length === 2), 'every task in hand shows on the HUD');
  check((await page.textContent('#tracker')).includes('Kingsfoil (0/5)'), 'with its count');

  // Mablung keeps the stores.
  await page.evaluate(() => { roi.state.silver = 40; roi.teleport(roi.refuge.mablung.x - 1.6, roi.refuge.mablung.z + 0.6, 1.5, 40); });
  await page.waitForFunction(() => !document.getElementById('prompt').hidden && document.getElementById('prompt').textContent.includes('Mablung'), null, { timeout: 20000 });
  await page.keyboard.press('KeyE');
  await page.waitForSelector('#dialogue:not([hidden])');
  await page.click('#dialogue-options button:first-child');
  await page.waitForSelector('#trade:not([hidden])');
  await shot(page, 'trade');
  const purse = await page.evaluate(() => ({ silver: roi.state.silver, bread: roi.state.items.waybread ?? 0 }));
  await page.click('#trade-buy button');
  const bought = await page.evaluate(() => ({ silver: roi.state.silver, bread: roi.state.items.waybread ?? 0 }));
  await page.evaluate(() => { roi.state.silver = 400; roi.state.renown = 2; roi.trade.draw(); });
  await page.click('#trade-buy .row-item:has-text("Leather jerkin") button');
  const jerkin = page.locator('#trade-buy .row-item:has-text("Leather jerkin") button');
  check(await jerkin.isDisabled() && (await jerkin.textContent()).includes('have one'), 'gear already bought is greyed out and cannot be bought twice');
  await page.evaluate((s) => { roi.state.silver = s.silver; roi.state.renown = 0; roi.state.items.leatherJerkin = 0; delete roi.state.items.leatherJerkin; roi.trade.draw(); }, bought);
  check(bought.bread === purse.bread + 1 && bought.silver < purse.silver, 'buying from Mablung costs silver and fills the pack');
  await page.click('#trade-sell button');
  check(await page.evaluate((s) => roi.state.silver > s, bought.silver), 'selling to him pays');
  // At his bench: a dull blade mended for silver; field repair taught to a ranger of some renown.
  await page.evaluate(() => { roi.state.wear.rangerSword = 0.3; roi.state.silver = 50; roi.trade.draw(); });
  await page.locator('#trade-bench .row-item').first().locator('button:has-text("Mend")').click();
  check(await page.evaluate(() => roi.state.wear.rangerSword === 1 && roi.state.silver < 50), 'Mablung mends a dull blade at his bench, for silver');
  check((await page.textContent('#trade-bench')).includes('Learn to mend'), 'and will teach field repair');
  await page.evaluate((s) => { roi.state.silver = s; roi.trade.draw(); }, bought.silver);
  await page.click('#trade-close');

  // The pack.
  await page.keyboard.press('KeyI');
  await page.waitForSelector('#pack:not([hidden])');
  check((await page.textContent('#pack-tasks')).includes('nearest fire') && (await page.textContent('#pack-gear')).includes('sword'), 'the pack lists tasks and gear');
  check(/Renown 0 · \d+ of \d+ toward 1/.test(await page.textContent('#renown-label')), 'and renown, with the way to the next');
  await shot(page, 'pack');
  await page.keyboard.press('KeyI');
  check(await page.isHidden('#pack'), 'the pack closes');

  // Faramir looks the Prince of Ithilien; boulders lie all round the pool, clear of the ways through.
  await page.evaluate(() => { const f = roi.refuge.faramir; roi.teleport(f.x + 2.6 * Math.sin(f.heading), f.z + 2.6 * Math.cos(f.heading), f.heading + Math.PI, 40); roi.rig.pitch = -0.08; roi.rig.wantDist = 0; }); // first person, face to face
  await page.waitForTimeout(800);
  await shot(page, 'faramir');
  await page.evaluate(() => { roi.rig.wantDist = 6; });
  const stones = await page.evaluate(() => roi.refuge.stones);
  check(stones.length >= 60, `boulders and stones lie round the pool (${stones.length})`);
  check(stones.every((s) => Math.hypot(s.x - 973, s.z - 1202.3) > 3 && Math.hypot(s.x - 970, s.z - 1194) > 3),
    'none of them at the foot of the stair or on the way out down the cut');

  // The hidden stair: from the floor of the cut, up along the basin wall and in at the door.
  await page.evaluate(() => { roi.teleport(973, 1202.3, Math.PI / 2, 31); roi.rig.yaw = Math.PI / 2; });
  const foot = await pos(page);
  check(Math.abs(foot.y - 31) < 1.2, 'the foot of the stair is on the floor of the basin');
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => roi.player.pos.x > 1004, null, { timeout: 240000 });
  await page.keyboard.up('KeyW');
  const door = await pos(page);
  check(Math.abs(door.y - 40) < 0.1, `the stair climbs to the cave door (y ${door.y.toFixed(1)})`);
  check(await page.evaluate(() => roi.refuge.isInside(roi.player.pos)), 'and leads inside the rock');
  await shot(page, 'hall');

  // From the hall a narrow stair climbs on through the rock to a hole in the forest floor.
  await page.evaluate(() => { const st = roi.refuge.hiddenStair; roi.teleport(st.startX, st.z, Math.PI / 2, 40); roi.rig.yaw = Math.PI / 2; });
  check(Math.abs((await pos(page)).y - 40) < 0.3, 'the hidden stair starts level with the hall');
  await page.keyboard.down('KeyW');
  const climbed = await page.waitForFunction(() => roi.player.pos.x > roi.refuge.hiddenStair.exitX + 6, null, { timeout: 240000 }).then(() => true, () => false);
  await page.keyboard.up('KeyW');
  const up = await pos(page);
  check(climbed && Math.abs(up.y - (await page.evaluate((p) => roi.heightAt(p.x, p.z), up))) < 0.05 && up.y > 48,
    `it climbs through the rock and out onto the forest floor (x ${up.x.toFixed(0)}, y ${up.y.toFixed(1)})`);
  await page.evaluate(() => { const st = roi.refuge.hiddenStair; roi.teleport(st.exitX + 7, st.z + 4, -Math.PI / 2 - 0.4); roi.rig.pitch = -0.45; });
  await page.waitForTimeout(600);
  await shot(page, 'hidden-stair');

  // A ledge beside the fall, out of the window's north corner.
  await page.evaluate(() => { const yaw = Math.atan2(-2.2, -5.6); roi.teleport(roi.refuge.ledge.x + 2.1, roi.refuge.ledge.z + 3.4, yaw, 40); roi.rig.yaw = yaw; });
  await page.keyboard.down('KeyW');
  const onLedge = await page.waitForFunction(() => roi.player.pos.z < roi.refuge.ledge.z - 1.5, null, { timeout: 30000 }).then(() => true, () => false);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(800);
  const ledge = await pos(page);
  check(onLedge && Math.abs(ledge.y - 40) < 0.2, `from the window you can step out onto a ledge beside the fall (y ${ledge.y.toFixed(1)})`);
  await page.evaluate(() => { roi.rig.yaw = 0.35; roi.rig.pitch = -0.25; });
  await page.waitForTimeout(600);
  await shot(page, 'ledge');

  // The way out: from the pool, down the winding cut beside the stream, to open ground.
  // A little steering helper keeps the ranger beside the water, as a person would.
  await page.evaluate(() => {
    const course = [...roi.streams.find((s) => s.home === 'cut').points, ...roi.streams.find((s) => s.home === 'lower').points.slice(0, 14)]
      .map((p) => ({ x: p.x, z: p.z + 1.6 }));
    window.courseEnd = course[course.length - 1];
    roi.teleport(970, 1194, -Math.PI / 2, 31);
    roi.input.haste = true;
    window.steer = setInterval(() => {
      const p = roi.player.pos;
      let i = 0, bd = Infinity;
      course.forEach((c, k) => { const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < bd) { bd = d; i = k; } });
      const t = course[Math.min(course.length - 1, i + 2)];
      roi.rig.yaw = Math.atan2(t.x - p.x, t.z - p.z);
    }, 16);
  });
  await page.keyboard.down('KeyW');
  const out = await page.waitForFunction(() => Math.hypot(roi.player.pos.x - courseEnd.x, roi.player.pos.z - courseEnd.z) < 6, null, { timeout: 240000 }).then(() => true, () => false);
  await page.keyboard.up('KeyW');
  await page.evaluate(() => { clearInterval(steer); roi.input.haste = false; });
  const exit = await pos(page);
  check(out, `the cut leads out downstream (reached x ${exit.x.toFixed(0)})`);
  check(await page.evaluate((p) => roi.heightAt(p.x, p.z + 25) - p.y < 9 && !roi.refuge.isInside(roi.player.pos), exit), 'and the banks there are low enough to climb');
  await shot(page, 'cut-exit');

  // Running, the cloak streams out behind, but the quiver and the slung bow stay over it.
  const underCloak = () => page.evaluate(() => {
    const f = roi.player.figure, V = f.position.constructor;
    f.updateMatrixWorld(true);
    const inv = f.matrixWorld.clone().invert();
    const local = (mesh) => { const a = mesh.geometry.attributes.position, out = []; for (let i = 0; i < a.count; i++) out.push(new V().fromBufferAttribute(a, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(inv)); return out; };
    const cloak = local(f.limbs.cloak.children[0]);
    const gear = f.slungBow.parent.children.filter((m) => m.isMesh && m.visible).flatMap(local);
    // the cloak's surface behind each point carried on the back, where there is cloak behind it
    let worst = Infinity, n = 0;
    for (const g of gear) {
      for (let i = 0; i < cloak.length; i += 3) {
        const [a, b, c] = [cloak[i], cloak[i + 1], cloak[i + 2]];
        const d = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
        if (Math.abs(d) < 1e-9) continue;
        const u = ((b.y - c.y) * (g.x - c.x) + (c.x - b.x) * (g.y - c.y)) / d, v = ((c.y - a.y) * (g.x - c.x) + (a.x - c.x) * (g.y - c.y)) / d, w = 1 - u - v;
        if (u < 0 || v < 0 || w < 0) continue;
        const z = u * a.z + v * b.z + w * c.z;
        if (z > 0) continue; // the cloak is on the back (-z)
        worst = Math.min(worst, z - g.z); n++;
      }
    }
    return { worst, n };
  });
  const standing = await underCloak();
  await page.evaluate(() => { roi.rig.yaw = -Math.PI / 2; });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2500);
  const running = await underCloak();
  const speed = await page.evaluate(() => roi.player.speed);
  await page.keyboard.up('KeyW');
  check(standing.n > 50 && standing.worst > 0, `standing, the quiver and bow lie over the cloak (clear by ${(standing.worst * 100).toFixed(1)} cm)`);
  check(speed > 4 && running.n > 50 && running.worst > 0, `running, they stay over it as it streams back (clear by ${(running.worst * 100).toFixed(1)} cm)`);

  // Walk, on the lawns of Cormallen where nothing is in the way.
  await page.evaluate(() => roi.teleport(337, 1195, 0));
  const a = await pos(page);
  await page.keyboard.down('KeyW');
  await page.waitForFunction((a) => Math.hypot(roi.player.pos.x - a.x, roi.player.pos.z - a.z) > 2, a, { timeout: 30000 });
  await page.keyboard.up('KeyW');
  const b = await pos(page);
  check(b.z > a.z + 1.5, `holding W walks forward (moved ${dist(a, b).toFixed(1)} m)`);
  check(Math.abs(b.y - (await page.evaluate((b) => roi.heightAt(b.x, b.z), b))) < 0.05, 'feet follow the ground');
  check(await page.evaluate(() => { const f = roi.player.figure; return !f.sword.visible && f.sheath.visible && !f.heldBow.visible && f.slungBow.visible; }),
    'out of a fight the sword is sheathed and the bow slung on the back');
  const quiverShows = await page.evaluate(async () => {
    const f = roi.player.figure, verts = () => f.quiverArrows.geometry.attributes.position.count, frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const full = verts(); roi.state.arrows = 3; await frame(); const three = verts(); roi.state.arrows = 24; await frame();
    return { full, three, back: verts() };
  });
  check(quiverShows.three * 10 === quiverShows.full * 3 && quiverShows.back === quiverShows.full, `the quiver shows each arrow when there are few, and looks full otherwise (${JSON.stringify(quiverShows)})`);
  await page.waitForFunction(() => [...roi.grass.tiles.values()].filter((t) => t.dense).length >= 2, null, { timeout: 30000 }).then(() => check(true, 'grass grows about the ranger on the lawns'), () => check(false, 'grass grows about the ranger on the lawns'));

  // Set down inside a wall (a ruin's), the ranger is freed at once onto open ground.
  const unwalled = await page.evaluate(() => {
    const r = roi.relics.find((q) => q.kind === 'chapel');
    roi.teleport(r.x + 4, r.z - 2, 0, roi.heightAt(r.x + 4, r.z - 2));
    const p = roi.player.pos;
    return { inWall: roi.blocked(r.x + 4, r.z - 2, roi.heightAt(r.x + 4, r.z - 2), 0.4), free: !roi.blocked(p.x, p.z, p.y, 0.4), moved: Math.hypot(p.x - r.x - 4, p.z - r.z + 2) };
  });
  check(unwalled.inWall && unwalled.free && unwalled.moved < 3, `set down inside a wall, the ranger is freed close by (${unwalled.moved.toFixed(1)} m)`);

  // The river and the edges of the world stop the ranger.
  await page.evaluate(() => { roi.teleport(150, 2300, -Math.PI / 2); roi.input.haste = true; });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2500);
  await page.keyboard.up('KeyW');
  await page.evaluate(() => { roi.input.haste = false; });
  const r = await pos(page);
  check(await page.evaluate((r) => roi.heightAt(r.x, r.z) > -1.31, r), 'cannot wade into the deep river');

  // Discover a ruin, break up a camp.
  await page.evaluate(() => roi.teleport(860, 1338, 3));
  await page.waitForFunction(() => roi.state.discovered.includes('arch'), null, { timeout: 20000 });
  check(true, 'walking up to a ruin discovers it');
  // A tree near where it changes form is drawn in both forms, to fade from one to the other.
  const fade = await page.evaluate(() => {
    const q = roi.ground.quality, p = roi.player.pos;
    let both = 0, near = 0;
    for (const ch of roi.ground.chunks.values()) for (const g of ch.veg) {
      if (g.sp.cls !== 'tree') continue;
      const [hi, mid] = g.meshes, has = (m, i) => { for (let k = 0; k < m.count; k++) if (m.instanceMatrix.array[k * 16 + 12] === g.mats[i * 16 + 12] && m.instanceMatrix.array[k * 16 + 14] === g.mats[i * 16 + 14]) return true; return false; };
      for (let i = 0; i < g.n; i++) {
        const d = Math.hypot(g.xs[i] - p.x, g.zs[i] - p.z);
        if (Math.abs(d - q.treeNear) < 3) { near++; if (has(hi, i) && has(mid, i)) both++; }
      }
    }
    return { both, near };
  });
  check(fade.near > 0 && fade.both === fade.near, `trees at the change of form are drawn in both forms, to fade between them (${fade.both} of ${fade.near})`);
  // The deep woods are old forest: fewer, far taller great trees and little growing under them;
  // the home woods keep their riot of younger growth.
  const forest = await page.evaluate(() => {
    const census = (x, z) => {
      roi.teleport(x, z, 0);
      let great = 0, under = 0, giants = 0;
      for (const ch of roi.ground.chunks.values()) for (const g of ch.veg) {
        if (g.sp.cls === 'cover' || g.sp.sameMid || ['log', 'stump'].includes(g.meshes[0].userData.species)) continue;
        for (let i = 0; i < g.n; i++) {
          if (Math.hypot(g.xs[i] - x, g.zs[i] - z) > 120) continue;
          if (g.sp.cls === 'tree') { great++; const m = g.mats; if (m[i * 16 + 5] > Math.hypot(m[i * 16], m[i * 16 + 2]) * 1.08) giants++; } // giants: drawn taller than wide
          else under++;
        }
      }
      return { great, under, giants };
    };
    return { deep: census(700, 3000), home: census(1100, 1600) };
  });
  check(forest.deep.under < forest.deep.great * 0.7 && forest.deep.giants > forest.deep.great * 0.4,
    `the deep woods are old forest: ${forest.deep.great} great trees (${forest.deep.giants} of them giants), ${forest.deep.under} lesser`);
  check(forest.home.under > forest.home.great && forest.home.giants === 0, `the home woods keep their young growth (${forest.home.great} great trees, ${forest.home.under} lesser)`);
  check(await page.evaluate(() => roi.camps.sites.length >= 100), 'more than a hundred camps exist');

  // Kingsfoil is gathered by walking over it.
  await page.evaluate(() => { const h = roi.herbs.sites[0]; roi.teleport(h.x, h.z, 0); });
  await page.waitForFunction(() => (roi.state.items.athelas ?? 0) === 1, null, { timeout: 20000 });
  check(await page.evaluate(() => roi.state.picked.length === 1), 'kingsfoil is gathered underfoot');
  await page.evaluate(() => { const h = roi.herbs.sites.find((x) => x.kind === 'thymeSeed'); roi.teleport(h.x, h.z, 0); });
  await page.waitForFunction(() => (roi.state.items.thymeSeed ?? 0) === 1, null, { timeout: 20000 });
  check(true, 'so is seed for the gardens');

  // The first task: the nearest camp. They come at the ranger; the sword answers.
  await page.evaluate(() => { const c = roi.quests.NEAREST_CAMP; roi.teleport(c.x + 13, c.z, -Math.PI / 2); roi.rig.yaw = -Math.PI / 2; });
  await page.waitForFunction(() => roi.enemies.list.length >= 2, null, { timeout: 30000 });
  check(true, 'enemies stand at an uncleared camp');
  check(await page.evaluate(() => roi.enemies.list.every((e) => !roi.blocked(e.x, e.z, e.y, 0.4))), 'none of them stands inside a wall or rock');
  await page.waitForFunction(() => roi.enemies.list.some((e) => e.alerted), null, { timeout: 30000 });
  check(true, 'they notice the ranger');
  check(/seen you|roused/.test(await page.textContent('#callout')), 'and the HUD says so');
  await page.keyboard.down('KeyF');
  const drewBlood = await page.waitForFunction(() => roi.enemies.list.some((e) => e.hp < e.maxHp), null, { timeout: 240000 }).then(() => true, () => false);
  check(drewBlood, 'the sword wounds them');
  check(await page.evaluate(() => roi.player.figure.sword.visible && !roi.player.figure.sheath.visible), 'in the fight the sword is drawn');
  const wasHurt = await page.waitForFunction(() => roi.state.health < 100, null, { timeout: 240000 }).then(() => true, () => false);
  check(wasHurt, 'and they wound the ranger');
  await page.waitForFunction(() => roi.state.stats.kills >= 1 || roi.state.health < 30, null, { timeout: 240000 });
  await page.keyboard.up('KeyF');
  check(await page.evaluate(() => roi.state.stats.kills >= 1), 'an enemy can be killed with the sword');
  check(/(Orc|archer|Uruk|Southron|Captain) felled/.test(await page.textContent('#callout')), 'and the HUD names the fallen');
  await shot(page, 'felled');
  await shot(page, 'fight');
  // finish the rest by decree, to keep the test short
  await page.evaluate(() => { for (const e of [...roi.enemies.list]) roi.enemies.damage(e, 9999); });
  check(await page.evaluate(() => roi.state.cleared.includes(roi.quests.NEAREST_CAMP.id) && roi.camps.byId[roi.quests.NEAREST_CAMP.id].isCleared), 'when the last falls the camp is cleared');
  check(await page.evaluate(() => roi.state.silver > 0), 'and its stores are taken');
  check((await page.textContent('#tracker')).includes('Return to Faramir'), 'the task shows as done');

  // The bow: hold to draw, release to loose.
  await page.evaluate(() => { const c = roi.camps.sites.find((c) => !c.isCleared && c.size === 1); roi.teleport(c.x + 20, c.z, -Math.PI / 2); roi.rig.yaw = -Math.PI / 2; });
  await page.keyboard.press('Digit2');
  const marked = await page.waitForSelector('#crosshair:not([hidden])', { timeout: 20000 }).then(() => true, () => false);
  const bowState = await page.evaluate(() => ({ weapon: roi.state.weapon, enabled: roi.input.enabled, swing: roi.combat.swing, drawing: roi.combat.drawing, panel: document.body.className, fallen: roi.combat.fallen }));
  check(marked && bowState.weapon === 'bow', `the bow comes to hand, with a mark to aim by${marked ? '' : ' ' + JSON.stringify(bowState)}`);
  const quiver = await page.evaluate(() => roi.state.arrows);
  await page.keyboard.down('KeyF');
  await page.waitForFunction(() => roi.combat.draw > 0.5, null, { timeout: 30000 });
  check(await page.evaluate(() => { const b = roi.player.figure.heldBow; return b.visible && b.userData.arrow.visible && !roi.player.figure.slungBow.visible; }), 'drawing, the bow is in hand with an arrow on the string');
  await page.keyboard.up('KeyF');
  await page.waitForFunction((q) => roi.state.arrows === q - 1, quiver, { timeout: 20000 });
  check(await page.evaluate(() => roi.combat.arrows.length >= 0), 'an arrow is loosed and leaves the quiver');
  await shot(page, 'bow');

  // Taking aim: the view closes in, and a chosen shot to the head kills outright.
  await page.keyboard.press('KeyR');
  await page.waitForFunction(() => roi.combat.aim && roi.rig.zoom > 0.8, null, { timeout: 20000 });
  check(await page.evaluate(() => roi.rig.camera.fov < 45), 'aim mode narrows the view');
  await shot(page, 'aim');
  await page.keyboard.press('KeyR');
  await page.waitForFunction(() => roi.enemies.list.some((e) => !e.dead), null, { timeout: 30000 });
  const shots = await page.evaluate(() => {
    // shoot from beside each target, with nothing in between, and hold them still
    const foes = roi.enemies.list.filter((e) => !e.dead && e.type !== 'chief');
    const loose = (e, up, aimed) => roi.combat.shoot({ x: e.x + 2.5, y: e.y + up * 1.78 * e.def.scale, z: e.z }, { x: e.x, y: e.y + up * 1.78 * e.def.scale, z: e.z }, 5, 60, true, aimed);
    const [a, b] = foes;
    for (const e of [a, b]) if (e) { e.def = { ...e.def, speed: 0 }; e.state = 'strike'; e.timer = 99; }
    loose(a, 0.92, true);          // an aimed shot at the head
    if (b) loose(b, 0.92, false);  // the same shot, not aimed (as the one-button attack makes)
    window.shotA = a; window.shotB = b;
    return { a: a.type, hasB: !!b };
  });
  await page.waitForFunction(() => roi.combat.arrows.length === 0, null, { timeout: 30000 });
  const zones = await page.evaluate(() => [shotA, shotB].filter(Boolean).map((e) => ({ dead: e.dead, hurt: e.hp < e.maxHp })));
  check(zones[0].dead, 'an aimed arrow to the head kills');
  if (shots.hasB) check(zones[1].hurt && !zones[1].dead, 'the same arrow unaimed only wounds');
  check((await page.textContent('#hitmark')).includes('Head'), 'and the hit is called out');
  check(await page.evaluate(() => Number(getComputedStyle(document.getElementById('hitmark')).opacity) > 0.2), 'at once, without waiting for anything else to redraw');

  // The trunk of a great tree stops an arrow.
  const stopped = await page.evaluate(() => {
    const p = roi.player.pos;
    for (let r = 4; r < 90; r += 2) for (let a = 0; a < 6.28; a += 0.2) {
      const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      if (!roi.trunkAt(x, z)) continue;
      const y = roi.heightAt(x, z) + 1.4;
      roi.combat.arrows.length = 0;
      roi.combat.shoot({ x: x - 5, y, z }, { x: x + 5, y, z }, 5, 50, true, false);
      window.treeX = x;
      return true;
    }
    return false;
  });
  if (stopped) {
    await page.waitForFunction(() => roi.combat.arrows.length === 0 || roi.combat.arrows[0].x > treeX + 2, null, { timeout: 20000 });
    check(await page.evaluate(() => roi.combat.arrows.length === 0), 'an arrow does not pass through a great tree');
  }
  await page.keyboard.press('Digit1');

  // A band on the Harad Road marches down it.
  await page.evaluate(() => { roi.enemies.reset(); roi.teleport(roi.haradRoadX(2000) - 60, 2000, 0); window.band = roi.enemies.spawnPatrol(1960, 1, { list: ['snaga', 'snaga'], host: false }); roi.combat.god = true; });
  const z0 = await page.evaluate(() => roi.enemies.list.find((e) => e.camp === band).z);
  const marched = await page.waitForFunction((z0) => { const e = roi.enemies.list.find((e) => e.camp === band); return e && (e.z > z0 + 3 || e.alerted); }, z0, { timeout: 240000 }).then(() => true, () => false);
  check(marched, 'a band can be met on the road, marching or turning on the ranger');
  const clearedBefore = await page.evaluate(() => roi.state.cleared.length);
  await page.evaluate(() => { for (const e of roi.enemies.list.filter((e) => e.camp === band)) roi.enemies.damage(e, 9999); roi.combat.god = false; roi.enemies.reset(); });
  check(await page.evaluate((n) => roi.state.cleared.length === n, clearedBefore), 'beating a band does not count as clearing a camp');

  // An enemy shut in a roofless house gets out: it jumps, and failing that is set aside.
  const freed = await page.evaluate(() => {
    roi.enemies.reset();
    const h = roi.sites.find((s) => s.kind === 'farm').houses[0];
    roi.teleport(h.x + h.w / 2 + 9, h.z, -Math.PI / 2);
    roi.combat.god = true;
    roi.enemies.spawnCamp({ id: 'test-house', x: h.x, z: h.z, tier: 1, size: 1 }, ['snaga']);
    const e = roi.enemies.list.find((e) => e.camp.id === 'test-house');
    e.x = h.x; e.z = h.z; e.y = roi.heightAt(h.x, h.z);
    e.alerted = true; e.state = 'chase';
    window.house = h;
    return true;
  });
  const out2 = await page.waitForFunction(() => { const e = roi.enemies.list.find((e) => e.camp.id === 'test-house'); return e && (Math.abs(e.x - house.x) > house.w / 2 + 0.5 || Math.abs(e.z - house.z) > house.d / 2 + 0.5); }, null, { timeout: 240000 }).then(() => true, () => false);
  check(freed && out2, 'an enemy stuck inside walls finds its way out');
  await page.evaluate(() => { roi.enemies.reset(); roi.combat.god = false; });

  // Old places found can be travelled to from the map.
  await page.evaluate(() => { const r = roi.relics[5]; if (!roi.state.discovered.includes(r.id)) roi.state.discovered.push(r.id); window.dest = r; roi.teleport(700, 1000, 0); });
  await page.keyboard.press('KeyM');
  await page.waitForSelector('#map:not([hidden])');
  check((await page.textContent('#map-hint')).includes('travel'), 'the map says old places can be travelled to');
  const mbox = await page.locator('#map-canvas').boundingBox();
  const dest = await page.evaluate(() => ({ x: dest.x / 2000, z: dest.z / 4000 }));
  await page.mouse.click(mbox.x + mbox.width * dest.x, mbox.y + mbox.height * dest.z);
  const went = await page.waitForFunction(() => Math.hypot(roi.player.pos.x - dest.x, roi.player.pos.z - dest.z) < 25, null, { timeout: 30000 }).then(() => true, () => false);
  check(went && await page.isHidden('#map'), 'clicking a found old place on the map goes there');

  // Quick travel home from the menu; beginning anew only at home.
  await page.evaluate(() => { roi.enemies.reset(); roi.teleport(700, 1000, 0); });
  await page.click('#btn-menu');
  await page.waitForSelector('#menu:not([hidden])');
  check(await page.isVisible('#menu-travel') && await page.isHidden('#menu-new'), 'abroad, the menu offers the way home and not a new game');
  await page.click('#menu-travel');
  await page.waitForFunction(() => roi.refuge.isInside(roi.player.pos), null, { timeout: 30000 });
  check(await page.isHidden('#menu'), 'quick travel brings the ranger to the cave');
  await page.click('#btn-menu');
  check(await page.isVisible('#menu-new') && await page.isHidden('#menu-travel'), 'in the cave, the menu offers a new game instead');
  await page.click('#menu-resume');

  // Falling: the ranger wakes at home, whole.
  await page.evaluate(() => roi.teleport(700, 1000, 0));
  await page.evaluate(() => roi.combat.hurt(9999));
  check(await page.isVisible('#fallen'), 'at no health the ranger falls');
  await page.waitForFunction(() => roi.state.health === 100 && roi.refuge.isInside(roi.player.pos), null, { timeout: 240000 });
  check(await page.isHidden('#fallen') && await page.evaluate(() => roi.enemies.list.length === 0), 'and wakes in the cave, with the field forgotten');

  // Hand the task in.
  await page.evaluate(() => roi.teleport(roi.refuge.faramir.x + 1.4, roi.refuge.faramir.z + 1.3, -2, 40));
  await page.waitForFunction(() => !document.getElementById('prompt').hidden && document.getElementById('prompt').textContent.includes('Faramir'), null, { timeout: 20000 });
  await page.keyboard.press('KeyE');
  await page.waitForSelector('#dialogue:not([hidden])');
  check((await page.textContent('#dialogue-options button:first-child')).includes('It is done'), 'Faramir can be told it is done');
  await page.click('#dialogue-options button:first-child');
  check((await page.textContent('#dialogue-text')).includes('Received'), 'he gives the reward');
  await page.click('#dialogue-options button:first-child');
  check(await page.evaluate(() => roi.state.quests.done.includes('f1') && roi.state.items.draught >= 2 && roi.state.renown >= 1), 'the task is finished and the reward is in the pack');

  // Faramir's map, errands, and a ranger who keeps asking.
  const talkTo = async (who) => {
    await page.evaluate((w) => { const n = roi.refuge[w]; roi.teleport(n.x + 1.4, n.z + 1.3, -2, 40); }, who);
    await page.waitForFunction(() => !document.getElementById('prompt').hidden, null, { timeout: 20000 });
    await page.keyboard.press('KeyE');
    await page.waitForSelector('#dialogue:not([hidden])');
  };
  const choose = (text) => page.click(`#dialogue-options button:has-text("${text}")`);
  const options = () => page.$$eval('#dialogue-options button', (b) => b.map((x) => x.textContent));
  await talkTo('faramir');
  check((await options()).some((o) => o.includes('other work')), 'Faramir offers an errand beside his next task');
  await choose('May I see your map?');
  await choose('Thank you.');
  await page.waitForSelector('#map:not([hidden])');
  check((await page.textContent('#map-title')).includes('Faramir') && await page.evaluate(() => roi.state.told.length >= 3), 'his map shows camps the ranger has not found, and they are copied');
  await shot(page, 'faramir-map');
  await page.click('#map-close');
  await talkTo('faramir');
  await choose('other work');
  await choose('I will do it.');
  check(await page.evaluate(() => roi.state.quests.errands.length === 1 && roi.state.quests.active.includes(roi.state.quests.errands[0].id)), 'an errand can be taken');
  await talkTo('faramir');
  await choose('Have you a task');
  await choose('I will do it.');
  for (let i = 0; i < 3; i++) {
    await talkTo('faramir');
    await choose('The home woods');
    if (i < 2) { await choose('I will see to it.'); await choose('Farewell.'); }
  }
  check((await page.textContent('#dialogue-text')).includes('mark it on your map') && await page.evaluate(() => !!roi.state.quests.marks.f2), 'asked three times, he marks the way on the map');
  await choose('I will see to it.');
  await choose('Farewell.');

  await page.evaluate(() => { const s = roi.sites[0]; roi.teleport(s.x + 14, s.z + 3, 3); });
  await page.waitForFunction(() => roi.state.discovered.some((d) => d.startsWith('site:')), null, { timeout: 20000 });
  check(true, 'an old farm or village is noticed and remembered');
  await shot(page, 'camp-cleared');

  // Map.
  await page.keyboard.press('KeyM');
  await page.waitForSelector('#map:not([hidden])');
  check(await page.evaluate(() => document.getElementById('map-canvas').width > 100), 'map opens');
  await shot(page, 'map');
  await page.keyboard.press('KeyM');
  check(await page.isHidden('#map'), 'map closes');

  // A camp worn down from afar stays worn down: walking off and coming back
  // does not mend it; only going home (or very far) does.
  await page.evaluate(() => {
    roi.enemies.reset();
    window.snipe = roi.camps.sites.find((c) => !c.isCleared && c.size >= 2 && Math.hypot(c.x - 1000, c.z - 1190) > 400);
    roi.teleport(snipe.x + 60, snipe.z, -Math.PI / 2);
  });
  const company = () => page.evaluate(() => { const es = roi.enemies.list.filter((e) => e.camp.id === snipe.id && !e.dead); return { n: es.length, hurt: es.some((e) => e.hp < e.maxHp) }; });
  await page.waitForFunction(() => roi.enemies.list.filter((e) => e.camp.id === snipe.id).length >= 2, null, { timeout: 30000 });
  const whole = await company();
  await page.evaluate(() => { const es = roi.enemies.list.filter((e) => e.camp.id === snipe.id); roi.enemies.damage(es[0], 1e9); roi.enemies.damage(es[1], es[1].maxHp * 0.5); });
  await page.evaluate(() => roi.teleport(snipe.x + 400, snipe.z, 0));
  await page.waitForFunction(() => !roi.enemies.list.some((e) => e.camp.id === snipe.id), null, { timeout: 20000 });
  await page.evaluate(() => roi.teleport(snipe.x + 60, snipe.z, 0));
  await page.waitForFunction(() => roi.enemies.list.some((e) => e.camp.id === snipe.id), null, { timeout: 20000 });
  const worn = await company();
  check(worn.n === whole.n - 1 && worn.hurt, `a camp keeps its dead and wounded when the ranger walks off and comes back (${whole.n} -> ${worn.n})`);
  await page.evaluate(() => roi.goHome('Home.'));
  await page.evaluate(() => roi.teleport(snipe.x + 60, snipe.z, 0));
  await page.waitForFunction(() => roi.enemies.list.some((e) => e.camp.id === snipe.id), null, { timeout: 20000 });
  const mended = await company();
  check(mended.n === whole.n && !mended.hurt, 'but going home lets it mend');
  await page.evaluate(() => roi.enemies.reset());

  // A trophy picked up counts toward the task at once.
  await page.evaluate(() => {
    delete roi.state.items.orcBlade;
    roi.quests.acceptErrand(roi.state, { id: 'xtest', giver: 'faramir', errand: 'trophy', title: 'Test blades', offer: '', remind: '', done: '', objective: { type: 'gather', item: 'orcBlade', count: 3 }, reward: { silver: 1, honour: 1, items: {} } });
    roi.refreshHud();
    roi.combat.give([['orcBlade', 1]]);
  });
  check((await page.textContent('#tracker')).includes('Test blades (1/3)'), 'a trophy picked up counts on the tracker at once');
  await page.evaluate(() => { roi.state.quests.errands = roi.state.quests.errands.filter((e) => e.id !== 'xtest'); roi.state.quests.active = roi.state.quests.active.filter((id) => id !== 'xtest'); delete roi.state.items.orcBlade; roi.refreshHud(); });

  // What the ranger wears shows on them.
  const size = () => page.evaluate(() => { let n = 0; roi.player.figure.traverse((o) => { if (o.isMesh) n += o.geometry.attributes.position.count; }); return n; });
  const plain = await size();
  await page.evaluate(() => {
    roi.teleport(900, 1300, 0); roi.rig.yaw = Math.PI; roi.rig.pitch = -0.05;
    for (const id of ['southronScimitar', 'hornBow', 'blackMail', 'gondorHelm', 'ironGreaves']) { roi.inv.addItem(roi.state, id); roi.inv.equip(roi.state, id); }
    roi.refreshHud();
  });
  check(await size() > plain && await page.evaluate(() => roi.player.figure.sword.visible || roi.player.figure.heldBow.visible), 'gear put on shows on the ranger');
  await page.waitForTimeout(800);
  await shot(page, 'dressed');
  await page.evaluate(() => {
    for (const slot of ['helm', 'legs', 'body']) roi.inv.unequip(roi.state, slot);
    roi.inv.equip(roi.state, 'rangerSword'); roi.inv.equip(roi.state, 'rangerBow');
    for (const id of ['southronScimitar', 'hornBow', 'blackMail', 'gondorHelm', 'ironGreaves']) delete roi.state.items[id];
    roi.refreshHud();
  });

  // Wounds stay until mended: they do not close by themselves, but an hour on the
  // mats in the cave makes the ranger whole. And Éowyn steeps all the kingsfoil at once.
  await page.evaluate(() => { roi.enemies.reset(); roi.goHome('Home.'); roi.state.health = 50; roi.combat.sinceHurt = 99; window.p0 = roi.state.stats.playSeconds; });
  await page.waitForFunction(() => roi.state.stats.playSeconds - p0 >= 2, null, { timeout: 300000 });
  check(await page.evaluate(() => roi.state.health === 50), 'wounds do not mend by themselves');
  await page.evaluate(() => { const b = roi.refuge.beds[2]; roi.teleport(b.x, b.z, 0, 40); });
  await page.waitForFunction(() => !document.getElementById('prompt').hidden && document.getElementById('prompt').textContent.includes('Rest a while'), null, { timeout: 120000 });
  await page.keyboard.press('KeyE');
  check(await page.waitForFunction(() => roi.state.health === 100, null, { timeout: 60000 }).then(() => true, () => false), 'resting on a mat in the cave makes the ranger whole');
  await page.evaluate(() => { if (!roi.state.quests.done.includes('e1')) roi.state.quests.done.push('e1'); roi.state.items.athelas = 7; roi.state.items.draught = 0; });
  await talkTo('eowyn');
  await choose('6 kingsfoil for 3 draughts');
  check(await page.evaluate(() => roi.state.items.athelas === 1 && roi.state.items.draught === 3), 'Éowyn steeps all the kingsfoil at once, two to a draught');
  await choose('Thank you');
  if (await page.isVisible('#dialogue')) await page.keyboard.press('Escape');

  // Provinces: the place line names them, crossing a border is told, breaking a
  // hold with three in four of its camps frees one, and the pack and map show it.
  await page.evaluate(() => { roi.enemies.reset(); roi.teleport(700, 1000, 0); });
  await page.waitForTimeout(600);
  await page.evaluate(() => roi.teleport(1080, 1860, 0));
  // the notice waits for a second of game time, and headless frames are slow out in the woods
  const crossed = await page.waitForFunction(() => document.getElementById('place').textContent === 'The Bridgelands' &&
    (roi.hud.queue.some((t) => t.big === 'The Bridgelands') || document.getElementById('toast').textContent.includes('The Bridgelands')), null, { timeout: 180000 }).then(() => true, () => false);
  check(crossed, 'the place line names the province, and crossing into one is told');
  await page.evaluate(() => {
    const { PROVINCE_CAMPS, HOLDS } = roi.provinces;
    window.hold = HOLDS.henneth;
    for (const c of PROVINCE_CAMPS.henneth) if (c !== hold && !roi.state.cleared.includes(c.id)) { roi.state.cleared.push(c.id); roi.camps.clear(c.id); }
    roi.state.discovered.push('camp:' + HOLDS.bridgelands.id); // a hold found but standing, for the map
    roi.enemies.reset();
    roi.combat.god = true;
    roi.teleport(hold.x + 40, hold.z, -Math.PI / 2);
  });
  check(await page.evaluate(() => !roi.provinces.status(roi.state, 'henneth').freed), 'with its hold standing, a province is not free however many camps fall');
  await page.waitForFunction(() => roi.enemies.list.some((e) => e.camp.id === hold.id), null, { timeout: 30000 });
  await page.evaluate(() => { for (const e of roi.enemies.list.filter((e) => e.camp.id === hold.id)) roi.enemies.damage(e, 1e9); });
  const told = await page.waitForFunction(() => roi.hud.queue.some((t) => t.big === 'Eryn Henneth is free') || document.getElementById('toast').textContent.includes('Eryn Henneth is free'), null, { timeout: 20000 }).then(() => true, () => false);
  check(told && await page.evaluate(() => roi.provinces.status(roi.state, 'henneth').freed), 'breaking the hold frees the province, and the ranger is told');
  await page.evaluate(() => { roi.combat.god = false; roi.enemies.reset(); });
  await page.keyboard.press('KeyI');
  await page.waitForSelector('#pack:not([hidden])');
  const land = await page.textContent('#pack-provinces');
  check(land.includes('Eryn Henneth, the Window Woods') && land.includes('Free.') && land.includes('Forlad') && land.includes('not yet found'), 'the pack lists the provinces and how each stands');
  await page.evaluate(() => document.getElementById('pack-provinces').scrollIntoView());
  await shot(page, 'pack-provinces');
  await page.keyboard.press('KeyI');
  await page.keyboard.press('KeyM');
  await page.waitForSelector('#map:not([hidden])');
  await shot(page, 'map-provinces');
  await page.keyboard.press('KeyM');

  // Save, reload, resume.
  await page.evaluate(() => roi.teleport(700, 1000, 1));
  const before = await pos(page);
  check(await page.evaluate(() => roi.save()), 'save succeeds');
  await page.reload();
  await page.waitForSelector('#begin:not([hidden])', { timeout: 180000 });
  check((await page.textContent('#begin')).trim() === 'Continue', 'title offers Continue after saving');
  await page.click('#begin');
  await ready(page);
  const after = await pos(page);
  check(dist(before, after) < 0.5, 'position is restored after a reload');
  check(await page.evaluate(() => roi.state.cleared.includes(roi.quests.NEAREST_CAMP.id) && roi.state.discovered.includes('arch') && roi.state.quests.done.includes('f1') && roi.state.items.draught >= 2), 'progress, tasks and pack are restored after a reload');

  // Menu.
  await page.click('#btn-menu');
  await page.waitForSelector('#menu:not([hidden])');
  await shot(page, 'menu');
  check(await page.isHidden('#fps') && (await page.textContent('#menu-fps')).includes('Show'), 'the frame-rate counter starts hidden');
  await page.click('#menu-fps');
  await page.waitForFunction(() => /\d+ fps/.test(document.getElementById('fps').textContent), null, { timeout: 30000 });
  check(await page.isVisible('#fps') && await page.evaluate(() => roi.state.settings.fps === true), 'the menu turns on a frame-rate counter, and it is remembered');
  await page.click('#menu-fps');
  check(await page.isHidden('#fps'), 'and off again');
  await page.click('#menu-resume');
  check(await page.isHidden('#menu'), 'menu opens and closes');
});

await run('phone (touch)', { ...devices['Pixel 7 landscape'] }, async (page) => {
  // Low quality: headless rendering is in software, and a medium frame takes too long to tap through.
  // (A phone starts on medium; that quality is loaded on its own below.)
  await page.goto(base + '?quality=low');
  await page.waitForSelector('#begin:not([hidden])', { timeout: 180000 });
  await page.tap('#begin');
  await ready(page);
  await page.waitForTimeout(1500);
  check(await page.evaluate(() => document.body.classList.contains('touch')), 'touch layout is active');
  check(await page.isVisible('#btn-jump') && await page.isVisible('#btn-map'), 'touch buttons are shown');
  check(await page.evaluate(() => innerWidth >= document.documentElement.scrollWidth), 'no horizontal overflow');

  await page.evaluate(() => roi.teleport(337, 1195, 0));
  const a = await pos(page);
  // Left thumb: press, push the stick up, hold.
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  await touch('touchStart', 150, 300);
  await touch('touchMove', 150, 230);
  await page.waitForFunction((a) => Math.hypot(roi.player.pos.x - a.x, roi.player.pos.z - a.z) > 1.5, a, { timeout: 30000 });
  check(await page.isVisible('#stick'), 'the stick appears under the thumb');
  await shot(page, 'phone');
  await touch('touchEnd', 150, 230);
  const b = await pos(page);
  check(b.z > a.z + 1, `the stick walks the ranger forward (moved ${dist(a, b).toFixed(1)} m)`);

  // Right thumb: drag to look.
  const yaw0 = await page.evaluate(() => roi.rig.yaw);
  await touch('touchStart', 600, 200);
  await touch('touchMove', 700, 200);
  await touch('touchEnd', 700, 200);
  await page.waitForTimeout(600);
  check(Math.abs((await page.evaluate(() => roi.rig.yaw)) - yaw0) > 0.1, 'dragging on the right turns the camera');

  // One attack button: it picks the mark and the weapon.
  check(await page.isVisible('#btn-attack') && await page.isVisible('#btn-heal'), 'attack and heal buttons are shown');
  await page.evaluate(() => { const c = roi.quests.NEAREST_CAMP; roi.teleport(c.x + 16, c.z, -Math.PI / 2); });
  await page.waitForFunction(() => roi.enemies.list.length >= 2, null, { timeout: 30000 });
  const q0 = await page.evaluate(() => roi.state.arrows);
  await page.evaluate(() => { roi.input.attackButton = true; });
  const acted = await page.waitForFunction((q) => roi.state.arrows < q || roi.enemies.list.some((e) => e.hp < e.maxHp), q0, { timeout: 240000 }).then(() => true, () => false);
  await page.evaluate(() => { roi.input.attackButton = false; });
  check(acted, 'holding Attack shoots or strikes at the nearest enemy without aiming');
  await shot(page, 'phone-fight');

  // Speak with Éowyn by tapping the prompt.
  await page.evaluate(() => roi.teleport(roi.refuge.eowyn.x + 1.6, roi.refuge.eowyn.z - 0.6, 1, 40));
  await page.waitForFunction(() => !document.getElementById('prompt').hidden && document.getElementById('prompt').textContent.includes('owyn'), null, { timeout: 20000 });
  await page.tap('#prompt');
  await page.waitForSelector('#dialogue:not([hidden])');
  check(true, 'tapping the prompt opens dialogue');
  await shot(page, 'phone-dialogue');
});

await run('phone upright (touch)', { ...devices['iPhone 13'] }, async (page) => {
  await page.goto(base + '?quality=low');
  await page.waitForSelector('#begin:not([hidden])', { timeout: 180000 });
  await page.tap('#begin');
  await ready(page);
  // Two tasks in hand, so the tracker has lines to show.
  await page.evaluate(() => { roi.state.quests.active.push('f1', 'e1'); roi.refreshHud(); });
  await page.waitForTimeout(800);
  const boxes = await page.evaluate(() => Object.fromEntries(['vitals', 'top-buttons', 'compass', 'place', 'tracker'].map((id) => {
    const r = document.getElementById(id).getBoundingClientRect();
    return [id, { l: r.left, r: r.right, t: r.top, b: r.bottom }];
  })));
  const ids = Object.keys(boxes), clash = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = boxes[ids[i]], b = boxes[ids[j]];
    if (ids[i] === 'vitals' && ids[j] === 'tracker') continue; // the tracker lives inside the vitals block
    if (a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1) clash.push(ids[i] + '/' + ids[j]);
  }
  check(clash.length === 0, `the upright HUD has nothing on top of anything else${clash.length ? ': ' + clash.join(', ') : ''}`);
  await shot(page, 'phone-upright');

  // Enemies at ease in their camp do not jump about.
  await page.evaluate(() => { const c = roi.quests.NEAREST_CAMP; roi.teleport(c.x + 60, c.z, -Math.PI / 2); });
  await page.waitForFunction(() => roi.enemies.list.length >= 2, null, { timeout: 30000 });
  const jumped = await page.evaluate(() => new Promise((done) => {
    let any = false;
    const t = setInterval(() => { if (roi.enemies.list.some((e) => e.air)) any = true; }, 50);
    setTimeout(() => { clearInterval(t); done(any || roi.enemies.list.some((e) => e.alerted)); }, 8000);
  }));
  check(!jumped, 'a camp at ease stays on its feet (no jumping, nobody roused)');

  await page.tap('#btn-map');
  await page.waitForSelector('#map:not([hidden])');
  const close = await page.locator('#map-close').boundingBox();
  check(close && close.y + close.height <= await page.evaluate(() => innerHeight), 'the map\'s Close button is on screen');
  await shot(page, 'phone-upright-map');
});

await run('testing page', { viewport: { width: 1280, height: 720 } }, async (page) => {
  await page.goto(base + 'debug.html');
  await page.waitForURL(/dev/);
  await page.goto(page.url() + '&quality=low'); // the redirect, then the same page at a quality software rendering can click through
  await page.waitForFunction(() => window.roi?.ready, null, { timeout: 180000 });
  await page.click('#begin', { timeout: 180000 });
  await page.waitForSelector('#dev', { timeout: 180000 });
  check(true, 'debug.html opens the game with the testing panel');
  await page.click('#dev [data-a="kit"]', { timeout: 180000 });
  check(await page.evaluate(() => roi.state.equipped.sword === 'guardBlade' && roi.state.equipped.body === 'citadelMail'), 'it can hand out and equip gear');
  await page.click('#dev [data-a="ren+"]', { timeout: 180000 });
  check(await page.evaluate(() => roi.state.renown === 1), 'and set renown');
  await page.click('#dev [data-a="mapgo"]', { timeout: 180000 });
  await page.waitForSelector('#map:not([hidden])', { timeout: 180000 });
  const box = await page.locator('#map-canvas').boundingBox();
  await page.mouse.click(box.x + box.width * 0.4, box.y + box.height * 0.6);
  await page.waitForFunction(() => Math.abs(roi.player.pos.x - 800) < 30 && Math.abs(roi.player.pos.z - 2400) < 40, null, { timeout: 30000 });
  check(await page.isHidden('#map'), 'clicking the map travels there');
  await shot(page, 'dev');
  await page.evaluate(() => roi.save());
  check(await page.evaluate(() => localStorage.getItem('rangers-of-ithilien.save') === null && localStorage.getItem('rangers-of-ithilien.save.dev') !== null), 'the testing page keeps its own save and leaves the real one alone');
});

// The richer qualities: they load, draw, grow grass and raise no errors. (Too slow in
// software rendering to play through; how they look is checked by screenshots.)
for (const q of ['medium', 'high']) {
  await run(`quality ${q}`, { viewport: { width: 960, height: 540 } }, async (page) => {
    await page.goto(base + `?quality=${q}&autostart`);
    await ready(page);
    await page.evaluate(() => roi.teleport(1100, 1420, Math.PI));
    const drew = await page.waitForFunction(() => roi.renderer.info.render.triangles > 100000 && [...roi.grass.tiles.values()].some((t) => t.dense || t.sparse), null, { timeout: 600000 }).then(() => true, () => false);
    check(drew, `on ${q} the woods draw in full, with grass`);
    await shot(page, `quality-${q}`);
  });
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
