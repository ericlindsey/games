// Browser smoke test. Serves the game folder, then drives it in headless Chromium
// on a desktop and a phone profile. Run: node tests/smoke.mjs [screenshot-dir]
// (SMOKE_ONLY=<part of a suite's name> runs only the suites that match.)
// Headless rendering is software-only, so this checks behaviour, not frame rate.

import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAMPS } from '../src/world/campSites.js';

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
// (since v0.8.1) every check says how far into its suite it came, and each suite how long it took, for finding the slow parts
const t0 = performance.now(), times = [];
let suiteStart = t0;
const clock = (ms) => { const sec = Math.round(ms / 1000); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; };
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} [${clock(performance.now() - suiteStart).padStart(5)}] ${what}`); if (!ok) failures++; };
const pos = (page) => page.evaluate(() => ({ x: roi.player.pos.x, y: roi.player.pos.y, z: roi.player.pos.z }));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const ready = (page) => page.waitForFunction(() => window.roi?.ready, null, { timeout: 180000 });
const shot = async (page, name) => { if (shots) await page.screenshot({ path: join(shots, name + '.png'), timeout: 300000 }); };

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function run(label, contextOptions, body) {
  if (process.env.SMOKE_ONLY && !label.includes(process.env.SMOKE_ONLY)) return; // SMOKE_ONLY=phone runs only the phone suites
  console.log(`\n== ${label} ==`);
  suiteStart = performance.now();
  const failedBefore = failures;
  const ctx = await browser.newContext(contextOptions);
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000); // a slow machine can be busy building the world for more than Playwright's 30 s
  // (since v0.8.1) a wait that times out says what it was waiting for, and who was about
  const wait = page.waitForFunction.bind(page);
  page.waitForFunction = (fn, arg, opts) => wait(fn, arg, opts).catch(async (e) => {
    const about = await page.evaluate(() => window.roi && JSON.stringify({ companies: [...roi.enemies.camps.keys()], alerted: roi.enemies.list.filter((e) => e.alerted && !e.dead).map((e) => e.camp.id), aim: roi.combat.aim, shaken: roi.combat.shaken, arrows: roi.combat.arrows.length })).catch(() => '');
    throw new Error(`${e.message.split('\n')[0]} waiting for ${String(fn).replace(/\s+/g, ' ').slice(0, 160)} ${about ?? ''}`);
  });
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
  const took = performance.now() - suiteStart;
  times.push({ label, took, failed: failures - failedBefore });
  console.log(`-- ${label}: ${clock(took)}`);
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
  // The browser builds the very same world as Node (a hundred camps, each where Node puts it).
  const campsHere = await page.evaluate(() => roi.camps.sites.map((c) => `${c.id}:${c.x},${c.z},${c.size}`).join(' '));
  check(campsHere === CAMPS.map((c) => `${c.id}:${c.x},${c.z},${c.size}`).join(' ') && CAMPS.length === 100, `the browser makes the same hundred camps as Node (${campsHere.split(' ').length})`);

  const start = await pos(page);
  const HA = await page.evaluate(() => roi.HA);
  check(Math.abs(start.x - HA.spawn.x) < 1 && Math.abs(start.z - HA.spawn.z) < 1, 'starts in the cave at Henneth Annûn');
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
    roi.lookFrom(roi.HA.x + 10, 44, roi.HA.z + 2, roi.HA.x + 20, 41, roi.HA.z + 2);
    await frame();
    const c = roi.rig.camera.position, at = { x: c.x, y: c.y, z: c.z };
    roi.follow(0, 2, -4);
    await frame();
    const p = roi.player.pos, f = roi.rig.camera.position, follows = Math.abs(f.x - p.x) < 0.01 && Math.abs(f.y - p.y - 2) < 0.01 && Math.abs(f.z - p.z + 4) < 0.01;
    roi.lookFrom(null);
    await frame();
    return { at, follows, freed: roi.rig.held === null };
  });
  check(Math.hypot(held.at.x - HA.x - 10, held.at.y - 44, held.at.z - HA.z - 2) < 0.01 && held.follows && held.freed, 'the camera can be held at a point or behind the ranger, and given back');
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
  check(stones.every((s) => Math.hypot(s.x - (HA.x - 27), s.z - (HA.z + 12.3)) > 3 && Math.hypot(s.x - (HA.x - 30), s.z - (HA.z + 4)) > 3),
    'none of them at the foot of the stair or on the way out down the cut');

  // The hidden stair: from the floor of the cut, up along the basin wall and in at the door.
  await page.evaluate(() => { roi.teleport(roi.HA.x - 27, roi.HA.z + 12.3, Math.PI / 2, 31); roi.rig.yaw = Math.PI / 2; });
  const foot = await pos(page);
  check(Math.abs(foot.y - 31) < 1.2, 'the foot of the stair is on the floor of the basin');
  await page.keyboard.down('KeyW');
  // (a walk of 31 m: software rendering at this size can manage under a frame a second, and a frame moves at most 0.05 s)
  await page.waitForFunction(() => roi.player.pos.x > roi.HA.x + 4, null, { timeout: 600000 });
  await page.keyboard.up('KeyW');
  const door = await pos(page);
  check(Math.abs(door.y - 40) < 0.1, `the stair climbs to the cave door (y ${door.y.toFixed(1)})`);
  check(await page.evaluate(() => roi.refuge.isInside(roi.player.pos)), 'and leads inside the rock');
  await shot(page, 'hall');

  // From the hall a narrow stair climbs on through the rock to a hole in the forest floor.
  await page.evaluate(() => { const st = roi.refuge.hiddenStair; roi.teleport(st.startX, st.z, Math.PI / 2, 40); roi.rig.yaw = Math.PI / 2; });
  check(Math.abs((await pos(page)).y - 40) < 0.3, 'the hidden stair starts level with the hall');
  await page.keyboard.down('KeyW');
  const climbed = await page.waitForFunction(() => roi.player.pos.x > roi.refuge.hiddenStair.exitX + 6, null, { timeout: 600000 }).then(() => true, () => false);
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
    roi.teleport(roi.HA.x - 30, roi.HA.z + 4, -Math.PI / 2, 31);
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
  // (a long walk in game time: on a slow machine software rendering can take minutes over it)
  const out = await page.waitForFunction(() => Math.hypot(roi.player.pos.x - courseEnd.x, roi.player.pos.z - courseEnd.z) < 6, null, { timeout: 600000 }).then(() => true, () => false);
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
  await page.evaluate(() => roi.teleport(roi.landmarks.find((l) => l.id === 'cormallen').x, roi.landmarks.find((l) => l.id === 'cormallen').z, 0));
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
  await page.evaluate(() => { roi.teleport(115, 1580, -Math.PI / 2); roi.input.haste = true; });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2500);
  await page.keyboard.up('KeyW');
  await page.evaluate(() => { roi.input.haste = false; });
  const r = await pos(page);
  check(await page.evaluate((r) => roi.heightAt(r.x, r.z) > -1.31, r), 'cannot wade into the deep river');

  // Discover a ruin, break up a camp.
  await page.evaluate(() => { const a = roi.landmarks.find((l) => l.id === 'arch'); roi.teleport(a.x, a.z + 8, 3); });
  await page.waitForFunction(() => roi.state.discovered.includes('arch'), null, { timeout: 20000 });
  check(true, 'walking up to a ruin discovers it');
  // A tree near where it changes form is drawn in both forms, to fade from one to the other.
  const fade = await page.evaluate(() => {
    roi.teleport(825, 1200, 0); // in the home woods, with trees all round
    const q = roi.ground.quality, p = roi.player.pos, field = roi.ground.field, cam = field.camera;
    field.camera = null; field.fill(p.x, p.z); // every plant, whichever way the camera looks
    let both = 0, near = 0;
    for (const ch of roi.ground.chunks.values()) for (const g of ch.veg) {
      if (g.sp.cls !== 'tree') continue;
      for (let i = 0; i < g.n; i++) {
        const d = Math.hypot(g.xs[i] - p.x, g.zs[i] - p.z);
        if (Math.abs(d - q.treeNear) < 3) { near++; const f = field.formsAt(g.name, g.mats[i * 16 + 12], g.mats[i * 16 + 14]); if (f[0] && f[1]) both++; }
      }
    }
    field.camera = cam; field.dirty = true;
    return { both, near };
  });
  check(fade.near > 0 && fade.both === fade.near, `trees at the change of form are drawn in both forms, to fade between them (${fade.both} of ${fade.near})`);
  // Plants are drawn one mesh per species and form for the whole land, culled plant by plant:
  // those behind the camera are left out of the view, but still cast their shadows.
  const cull = await page.evaluate(async () => {
    roi.teleport(825, 1200, 0); roi.rig.yaw = 0; roi.rig.pitch = -0.1;
    for (let i = 0; i < 4; i++) await new Promise((r) => requestAnimationFrame(r));
    const field = roi.ground.field, p = roi.player.pos;
    field.fill(p.x, p.z);
    const cam = field.camera.position, fwd = { x: Math.sin(roi.rig.yaw), z: Math.cos(roi.rig.yaw) };
    let ahead = 0, aheadIn = 0, behind = 0, behindIn = 0, behindShade = 0;
    for (const ch of roi.ground.chunks.values()) for (const g of ch.veg) {
      if (g.sp.cls === 'cover' || g.sp.sameMid) continue;
      const set = field.sets.get(g.name);
      for (let i = 0; i < g.n; i++) {
        const x = g.xs[i], z = g.zs[i], dx = x - cam.x, dz = z - cam.z, d = Math.hypot(dx, dz);
        if (d < 18 || d > 150) continue;
        const dot = (dx * fwd.x + dz * fwd.z) / d, inView = field.formsAt(g.name, x, z).some((f) => f);
        let shaded = false;
        for (const [k, m] of set.shade.entries()) if (m) for (let j = 0; j < set.ns[k]; j++) if (m.instanceMatrix.array[j * 16 + 12] === x && m.instanceMatrix.array[j * 16 + 14] === z) { shaded = true; break; }
        if (dot > 0.8) { ahead++; if (inView) aheadIn++; }
        if (dot < -0.8 && d > 22) { behind++; if (inView) behindIn++; if (shaded && d < 100) behindShade++; }
      }
    }
    return { ahead, aheadIn, behind, behindIn, behindShade, shadows: !!roi.ground.quality.shadows };
  });
  check(cull.ahead > 0 && cull.aheadIn === cull.ahead, `every tree and bush ahead of the camera is drawn (${cull.aheadIn} of ${cull.ahead})`);
  check(cull.behind > 0 && cull.behindIn === 0 && (!cull.shadows || cull.behindShade > 0), `those well behind it are not (${cull.behindIn} of ${cull.behind})${cull.shadows ? `, but still cast shadows (${cull.behindShade})` : ''}`);
  // The deep woods are old forest: fewer, far taller great trees and little growing under them;
  // the home woods keep their riot of younger growth.
  const forest = await page.evaluate(() => {
    const census = (x, z) => {
      roi.teleport(x, z, 0);
      let great = 0, under = 0, giants = 0;
      for (const ch of roi.ground.chunks.values()) for (const g of ch.veg) {
        if (g.sp.cls === 'cover' || g.sp.sameMid || ['log', 'stump'].includes(g.name)) continue;
        for (let i = 0; i < g.n; i++) {
          if (Math.hypot(g.xs[i] - x, g.zs[i] - z) > 120) continue;
          if (g.sp.cls === 'tree') { great++; const m = g.mats; if (m[i * 16 + 5] > Math.hypot(m[i * 16], m[i * 16 + 2]) * 1.08) giants++; } // giants: drawn taller than wide
          else under++;
        }
      }
      return { great, under, giants };
    };
    return { deep: census(300, 2350), home: census(825, 1200) };
  });
  check(forest.deep.under < forest.deep.great * 0.7 && forest.deep.giants > forest.deep.great * 0.4,
    `the deep woods are old forest: ${forest.deep.great} great trees (${forest.deep.giants} of them giants), ${forest.deep.under} lesser`);
  check(forest.home.under > forest.home.great && forest.home.giants === 0, `the home woods keep their young growth (${forest.home.great} great trees, ${forest.home.under} lesser)`);
  // Land coming into range as the ranger moves is built a little each frame, and fills in.
  const stream = await page.evaluate(async () => {
    roi.teleport(825, 1200, 0);
    roi.player.place(825, 1420, 0); // on 220 m, without building anything at once
    const g = roi.grass, T = 24;
    const all = () => {
      const p = roi.player.pos;
      if (!roi.ground.wanted(p.x, p.z).every((w) => roi.ground.chunks.has(w.cx + ',' + w.cz))) return false;
      for (let tz = Math.floor((p.z - g.nearR) / T); tz <= Math.floor((p.z + g.nearR) / T); tz++) {
        for (let tx = Math.floor((p.x - g.nearR) / T); tx <= Math.floor((p.x + g.nearR) / T); tx++) {
          const d = Math.hypot(Math.max(tx * T - p.x, 0, p.x - (tx + 1) * T), Math.max(tz * T - p.z, 0, p.z - (tz + 1) * T));
          if (d < g.nearR - 1 && !g.tiles.get(tx + ',' + tz)?.hasdense) return false;
        }
      }
      return true;
    };
    const before = all(), t0 = performance.now();
    let frames = 0;
    while (!all() && performance.now() - t0 < 300000) { await new Promise((r) => requestAnimationFrame(r)); frames++; }
    return { before, after: all(), frames };
  });
  check(!stream.before && stream.after && stream.frames > 1, `land coming into range is built over a few frames, and fills in (${stream.frames} frames)`);
  check(await page.evaluate(() => roi.camps.sites.length === 100), 'a hundred camps exist');

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
  check(await page.evaluate(() => roi.hud.recent.some((t) => /seen you|roused/.test(t))), 'and the HUD says so');
  await page.keyboard.down('KeyF');
  const drewBlood = await page.waitForFunction(() => roi.enemies.list.some((e) => e.hp < e.maxHp), null, { timeout: 240000 }).then(() => true, () => false);
  check(drewBlood, 'the sword wounds them');
  check(await page.evaluate(() => roi.player.figure.sword.visible && !roi.player.figure.sheath.visible), 'in the fight the sword is drawn');
  const wasHurt = await page.waitForFunction(() => roi.state.health < 100, null, { timeout: 240000 }).then(() => true, () => false);
  check(wasHurt, 'and they wound the ranger');
  await page.waitForFunction(() => roi.state.stats.kills >= 1 || roi.state.health < 30, null, { timeout: 240000 });
  await page.keyboard.up('KeyF');
  check(await page.evaluate(() => roi.state.stats.kills >= 1), 'an enemy can be killed with the sword');
  check(await page.evaluate(() => roi.hud.recent.some((t) => /(Orc|archer|Uruk|Southron|Captain) felled/.test(t))), 'and the HUD names the fallen');
  await shot(page, 'felled');
  await shot(page, 'fight');
  // finish the rest by decree, to keep the test short
  await page.evaluate(() => { for (const e of [...roi.enemies.list]) roi.enemies.damage(e, 9999); });
  check(await page.evaluate(() => roi.state.cleared.includes(roi.quests.NEAREST_CAMP.id) && roi.camps.byId[roi.quests.NEAREST_CAMP.id].isCleared), 'when the last falls the camp is cleared');
  // (since v0.8 the camp stands until the ranger breaks it up, and only then are its stores taken)
  check(await page.evaluate(() => !roi.state.broken.includes(roi.quests.NEAREST_CAMP.id) && roi.camps.byId[roi.quests.NEAREST_CAMP.id].strength === 1), 'it stands, blighted, until it is broken up');
  await page.evaluate(() => { const c = roi.camps.byId[roi.quests.NEAREST_CAMP.id]; roi.teleport(c.fire.x + 4, c.fire.z, -Math.PI / 2); });
  await page.waitForFunction(() => !document.getElementById('prompt').hidden && document.getElementById('prompt').textContent.includes('Break up'), null, { timeout: 60000 });
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => roi.state.broken.includes(roi.quests.NEAREST_CAMP.id), null, { timeout: 20000 });
  check(await page.evaluate(() => roi.state.silver > 0 && roi.hud.recent.some((t) => /From their stores/.test(t))), 'broken up, its stores are taken');
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
  // Hold the camp still first: a blow now would (rightly) knock the ranger out of the aim.
  await page.evaluate(() => { for (const e of roi.enemies.list) if (!e.dead) { e.def = { ...e.def, speed: 0 }; e.state = 'strike'; e.timer = 99; } });
  await page.waitForFunction(() => roi.combat.arrows.length === 0, null, { timeout: 240000 });
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
  await page.waitForFunction(() => roi.combat.arrows.length === 0, null, { timeout: 240000 });
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
  await page.evaluate(() => { roi.enemies.reset(); roi.teleport(roi.haradRoadX(2360) - 60, 2360, 0); window.band = roi.enemies.spawnPatrol(2320, 1, { list: ['snaga', 'snaga'], host: false }); roi.combat.god = true; });
  const z0 = await page.evaluate(() => roi.enemies.list.find((e) => e.camp === band).z);
  const marched = await page.waitForFunction((z0) => { const e = roi.enemies.list.find((e) => e.camp === band); return e && (e.z > z0 + 3 || e.alerted); }, z0, { timeout: 240000 }).then(() => true, () => false);
  check(marched, 'a band can be met on the road, marching or turning on the ranger');
  const clearedBefore = await page.evaluate(() => roi.state.cleared.length);
  await page.evaluate(() => { for (const e of roi.enemies.list.filter((e) => e.camp === band)) roi.enemies.damage(e, 9999); roi.combat.god = false; roi.enemies.reset(); });
  check(await page.evaluate((n) => roi.state.cleared.length === n, clearedBefore), 'beating a band does not count as clearing a camp');

  // An enemy shut in a roofless house gets out: it jumps, and failing that is set aside.
  const freed = await page.evaluate(() => {
    roi.enemies.reset();
    // a farmhouse with no camp near, so only the one enemy is about, and well away from the falls (where they give up a chase)
    const h = roi.sites.filter((s) => s.kind === 'farm').map((s) => s.houses[0])
      .find((h) => Math.hypot(h.x - roi.HA.x, h.z - roi.HA.z) > 300 && roi.camps.sites.every((c) => Math.hypot(c.x - h.x, c.z - h.z) > 150));
    roi.teleport(h.x + h.w / 2 + 9, h.z, -Math.PI / 2);
    roi.combat.god = true;
    roi.enemies.spawnCamp({ id: 'test-house', x: h.x, z: h.z, tier: 1, size: 1 }, ['snaga']);
    const e = roi.enemies.list.find((e) => e.camp.id === 'test-house');
    e.x = h.x; e.z = h.z; e.y = roi.heightAt(h.x, h.z);
    e.alerted = true; e.state = 'chase';
    window.house = h;
    return true;
  });
  const out2 = await page.waitForFunction(() => { const e = roi.enemies.list.find((e) => e.camp.id === 'test-house'); return e && (Math.abs(e.x - house.x) > house.w / 2 + 0.5 || Math.abs(e.z - house.z) > house.d / 2 + 0.5); }, null, { timeout: 480000 }).then(() => true, () => false);
  check(freed && out2, 'an enemy stuck inside walls finds its way out');
  await page.evaluate(() => { roi.enemies.reset(); roi.combat.god = false; });

  // A chase is not given up for being far from home, and those on it rouse others they pass.
  const chase = await page.evaluate(() => {
    roi.enemies.reset();
    const h = window.house, x = h.x + 40, z = h.z;
    roi.teleport(x + 6, z, -Math.PI / 2);
    roi.combat.god = true;
    roi.enemies.spawnCamp({ id: 'test-far', x: x - 110, z, tier: 1, size: 1 }, ['snaga']);
    roi.enemies.spawnCamp({ id: 'test-near', x: x - 20, z: z + 18, tier: 1, size: 1 }, ['snaga']);
    const e = roi.enemies.list.find((e) => e.camp.id === 'test-far');
    e.x = x; e.z = z; e.y = roi.heightAt(x, z);
    e.alerted = true; e.state = 'chase';
    const o = roi.enemies.list.find((e) => e.camp.id === 'test-near'); // out of the ranger's sight (27 m), within the chaser's call (35 m)
    o.x = o.home.x = x - 20; o.z = o.home.z = z + 18; o.y = roi.heightAt(o.x, o.z);
    return Math.hypot(o.x - x - 6, o.z - z) > 30;
  });
  const rousedNear = await page.waitForFunction(() => roi.enemies.list.find((e) => e.camp.id === 'test-near')?.alerted, null, { timeout: 60000 }).then(() => true, () => false);
  const stillOn = await page.evaluate(() => roi.enemies.list.find((e) => e.camp.id === 'test-far')?.alerted === true);
  check(chase && stillOn, 'a roused enemy keeps up the chase 110 m from its camp');
  check(rousedNear, 'and rouses a camp it passes near');
  await page.evaluate(() => { roi.enemies.reset(); roi.combat.god = false; });

  // Old places found can be travelled to from the map.
  await page.evaluate(() => { const r = roi.relics[5]; if (!roi.state.discovered.includes(r.id)) roi.state.discovered.push(r.id); window.dest = r; roi.teleport(775, 1200, 0); });
  await page.keyboard.press('KeyM');
  await page.waitForSelector('#map:not([hidden])');
  check((await page.textContent('#map-hint')).includes('travel'), 'the map says old places can be travelled to');
  // (since v0.8.2 the map opens zoomed in on the ranger, and is dragged about: look at the place first)
  const at = await page.evaluate(() => { roi.map.centre(dest.x, dest.z); return roi.map.screenAt(dest.x, dest.z); });
  await page.waitForTimeout(300);
  await page.mouse.click(at.x, at.y);
  const went = await page.waitForFunction(() => Math.hypot(roi.player.pos.x - dest.x, roi.player.pos.z - dest.z) < 25, null, { timeout: 30000 }).then(() => true, () => false);
  check(went && await page.isHidden('#map'), 'clicking a found old place on the map goes there');

  // Quick travel home from the menu; beginning anew only at home.
  await page.evaluate(() => { roi.enemies.reset(); roi.teleport(775, 1200, 0); });
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
  await page.evaluate(() => roi.teleport(775, 1200, 0));
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
    const name = who === 'eowyn' ? 'Éowyn' : who[0].toUpperCase() + who.slice(1); // (the prompt may still name whoever was spoken to last, for a moment)
    await page.waitForFunction((nm) => !document.getElementById('prompt').hidden && document.getElementById('prompt').textContent.includes(nm), name, { timeout: 20000 });
    await page.keyboard.press('KeyE');
    await page.waitForSelector('#dialogue:not([hidden])');
  };
  const choose = (text) => page.click(`#dialogue-options button:has-text("${text}")`);
  const options = () => page.$$eval('#dialogue-options button', (b) => b.map((x) => x.textContent));
  await talkTo('faramir');
  check(!(await options()).some((o) => o.includes('other work')), 'while he has a told task to offer, Faramir offers no errand beside it (the story first)');
  await choose('May I see your map?');
  await choose('Thank you.');
  await page.waitForSelector('#map:not([hidden])');
  check((await page.textContent('#map-title')).includes('Faramir') && await page.evaluate(() => roi.state.told.length >= 3), 'his map shows camps the ranger has not found, and they are copied');
  await shot(page, 'faramir-map');
  await page.click('#map-close');
  await talkTo('faramir');
  await choose('Have you a task');
  await choose('I will do it.');
  check(await page.evaluate(() => roi.state.quests.active.includes('f2')), 'his next task is taken');
  await talkTo('faramir');
  await choose('Have you a task');
  await choose('I will do it.');
  check(await page.evaluate(() => roi.state.quests.errands.length === 1 && roi.state.quests.active.includes(roi.state.quests.errands[0].id)), 'then an errand can be taken');
  await talkTo('faramir');
  await choose('How goes the clearing?');
  check((await page.textContent('#dialogue-text')).includes('Eryn Henneth'), 'asked how the clearing goes, he speaks of the provinces');
  await choose('Good.');
  for (let i = 0; i < 3; i++) {
    await talkTo('faramir');
    await choose('Who leads them');
    if (i < 2) { await choose('I will see to it.'); await choose('Farewell.'); }
  }
  check((await page.textContent('#dialogue-text')).includes('mark it on your map') && await page.evaluate(() => !!roi.state.quests.marks.f2), 'asked three times, he marks the way on the map');
  await choose('I will see to it.');
  await choose('Farewell.');

  await talkTo('eowyn');
  await choose('How goes the settling?');
  check(/Faramir frees it/.test(await page.textContent('#dialogue-text')), 'Éowyn tells how a province is settled');
  await choose('Thank you.');
  await choose('Farewell.');

  await page.evaluate(() => { const s = roi.sites[0]; roi.teleport(s.x + 14, s.z + 3, 3); });
  await page.waitForFunction(() => roi.state.discovered.some((d) => d.startsWith('site:')), null, { timeout: 20000 });
  check(true, 'an old farm or village is noticed and remembered');
  await shot(page, 'camp-cleared');

  // Map.
  await page.keyboard.press('KeyM');
  await page.waitForSelector('#map:not([hidden])');
  check(await page.evaluate(() => document.getElementById('map-canvas').width > 100), 'map opens');
  const opened = await page.evaluate(() => {
    const m = roi.map, r = m.canvas.getBoundingClientRect(), p = m.screenAt(roi.player.pos.x, roi.player.pos.z);
    return { scale: m.scale, fit: m.fitScale, off: Math.hypot(p.x - (r.left + r.width / 2), p.y - (r.top + r.height / 2)), inView: p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom };
  });
  check(opened.scale >= 0.6 && opened.scale > opened.fit * 1.5 && opened.inView, `the map opens zoomed in (${opened.scale.toFixed(2)} px a metre; the whole land is ${opened.fit.toFixed(2)}) with the ranger in view (${opened.off.toFixed(0)} px from the middle)`);
  await shot(page, 'map');
  await page.click('#map-in');
  const zin = await page.evaluate(() => roi.map.scale);
  await page.click('#map-out'); await page.click('#map-out');
  const zout = await page.evaluate(() => roi.map.scale);
  check(Math.abs(zin / opened.scale - 1.5) < 0.01 && zout < opened.scale, `the + and \u2212 buttons zoom in and out (${opened.scale.toFixed(2)} -> ${zin.toFixed(2)} -> ${zout.toFixed(2)})`);
  // (each click is half a minute in software rendering: the rest of the way out is asked of the panel itself)
  check(await page.evaluate(() => { roi.map.zoomTo(0.01); return Math.abs(roi.map.scale - roi.map.fitScale) < 1e-6 && document.getElementById('map-out').disabled; }), 'zoomed right out, the whole land is in view, and \u2212 goes no further');
  await shot(page, 'map-whole');
  await page.keyboard.press('KeyM');
  check(await page.isHidden('#map'), 'map closes');

  // A camp worn down from afar stays worn down: walking off and coming back
  // does not mend it; only going home (or very far) does.
  await page.evaluate(() => {
    roi.enemies.reset();
    window.snipe = roi.camps.sites.find((c) => !c.isCleared && c.size >= 2 && Math.hypot(c.x - roi.HA.x, c.z - roi.HA.z) > 300);
    roi.teleport(snipe.x + 60, snipe.z, -Math.PI / 2);
  });
  const company = () => page.evaluate(() => { const es = roi.enemies.list.filter((e) => e.camp.id === snipe.id && !e.dead); return { n: es.length, hurt: es.some((e) => e.hp < e.maxHp) }; });
  await page.waitForFunction(() => roi.enemies.list.filter((e) => e.camp.id === snipe.id).length >= 2, null, { timeout: 120000 });
  const whole = await company();
  await page.evaluate(() => { const es = roi.enemies.list.filter((e) => e.camp.id === snipe.id); roi.enemies.damage(es[0], 1e9); roi.enemies.damage(es[1], es[1].maxHp * 0.5); });
  await page.evaluate(() => roi.teleport(snipe.x + (snipe.x > roi.WORLD.width / 2 ? -400 : 400), snipe.z, 0)); // out of its reach, still in the land
  await page.waitForFunction(() => !roi.enemies.list.some((e) => e.camp.id === snipe.id), null, { timeout: 120000 });
  await page.evaluate(() => roi.teleport(snipe.x + 60, snipe.z, 0));
  await page.waitForFunction(() => roi.enemies.list.some((e) => e.camp.id === snipe.id), null, { timeout: 120000 });
  const worn = await company();
  check(worn.n === whole.n - 1 && worn.hurt, `a camp keeps its dead and wounded when the ranger walks off and comes back (${whole.n} -> ${worn.n})`);
  await page.evaluate(() => roi.goHome('Home.'));
  await page.evaluate(() => roi.teleport(snipe.x + 60, snipe.z, 0));
  await page.waitForFunction(() => roi.enemies.list.some((e) => e.camp.id === snipe.id), null, { timeout: 120000 });
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
    roi.teleport(675, 975, 0); roi.rig.yaw = Math.PI; roi.rig.pitch = -0.05;
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
  check(await page.waitForFunction(() => document.getElementById('sleep').classList.contains('dark'), null, { timeout: 20000 }).then(() => true, () => false), 'resting fades the screen to black');
  check(await page.waitForFunction(() => roi.state.health === 100, null, { timeout: 60000 }).then(() => true, () => false), 'resting on a mat in the cave makes the ranger whole');
  check(await page.waitForFunction(() => !document.getElementById('sleep').classList.contains('dark'), null, { timeout: 20000 }).then(() => true, () => false), 'and the light comes back');
  // a burst of notices shows together, stacked, no more than ten at once
  await page.evaluate(() => { for (let i = 1; i <= 14; i++) roi.hud.toast('', `Notice ${i}`); });
  const stacked = await page.waitForFunction(() => document.querySelectorAll('#toast .note:not(.out)').length >= 3, null, { timeout: 30000 }).then(() => true, () => false);
  let most = 0;
  for (let i = 0; i < 10; i++) { most = Math.max(most, await page.evaluate(() => document.querySelectorAll('#toast .note:not(.out)').length)); await page.waitForTimeout(300); }
  check(stacked && most <= 10, `notices stack, at most ten at once (${most})`);
  // a blow knocks the ranger out of the aim
  const knocked = await page.evaluate(() => {
    roi.state.arrows = Math.max(roi.state.arrows, 5);
    roi.combat.setAim(true);
    const was = roi.combat.aim;
    roi.combat.hurt(4);
    const out = !roi.combat.aim && !roi.combat.drawing && roi.combat.draw === 0;
    roi.state.health = 100; roi.hud.setHealth(100);
    return was && out;
  });
  check(knocked, 'being struck knocks the ranger out of aiming');
  await page.evaluate(() => { if (!roi.state.quests.done.includes('e1')) roi.state.quests.done.push('e1'); roi.state.items.athelas = 7; roi.state.items.draught = 0; });
  await talkTo('eowyn');
  await choose('6 kingsfoil for 3 draughts');
  check(await page.evaluate(() => roi.state.items.athelas === 1 && roi.state.items.draught === 3), 'Éowyn steeps all the kingsfoil at once, two to a draught');
  await choose('Thank you');
  if (await page.isVisible('#dialogue')) await page.keyboard.press('Escape');

  // Provinces: the place line names them, crossing a border is told, breaking a
  // hold with three in four of its camps frees one, and the pack and map show it.
  await page.evaluate(() => { roi.enemies.reset(); roi.teleport(775, 1200, 0); });
  await page.waitForTimeout(600);
  await page.evaluate(() => { const b = roi.provinces.PROVINCES.find((p) => p.id === 'bridgelands').label; roi.teleport(b.x, b.z, 0); });
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
  await page.evaluate(() => roi.teleport(775, 1200, 1));
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

  await page.evaluate(() => roi.teleport(roi.landmarks.find((l) => l.id === 'cormallen').x, roi.landmarks.find((l) => l.id === 'cormallen').z, 0));
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

  // (since v0.8.2) the map, on a phone on its side: large, opened on the ranger, zoomed by its buttons, dragged by a finger
  await page.tap('#btn-map');
  await page.waitForSelector('#map:not([hidden])');
  const pm = await page.evaluate(() => { const r = roi.map.view.getBoundingClientRect(); return { h: r.height, w: r.width, ih: innerHeight, scale: roi.map.scale, cx: r.left + r.width / 2, cy: r.top + r.height / 2,
    sx: roi.player.pos.x < roi.WORLD.width / 2 ? -1 : 1, sz: roi.player.pos.z < roi.WORLD.length / 2 ? -1 : 1 }; }); // (dragged toward the middle of the land, which is never against an edge)
  check(pm.h > pm.ih * 0.7 && pm.scale >= 0.6, `the map fills the screen (${pm.w.toFixed(0)} by ${pm.h.toFixed(0)} of ${pm.ih} high), zoomed in (${pm.scale.toFixed(2)} px a metre)`);
  await shot(page, 'phone-map');
  const zb = await page.locator('#map-in').boundingBox(), cb = await page.locator('#map-close').boundingBox();
  check(zb && cb && zb.y + zb.height <= pm.ih && cb.y + cb.height <= pm.ih, 'its zoom and Close buttons are on screen, below it');
  await page.tap('#map-in');
  check(Math.abs(await page.evaluate(() => roi.map.scale) / pm.scale - 1.5) < 0.01, 'tapping + zooms in');
  await page.tap('#map-out');
  const o0 = await page.evaluate(() => ({ x: roi.map.ox, z: roi.map.oz }));
  await touch('touchStart', pm.cx, pm.cy);
  for (let k = 1; k <= 4; k++) await touch('touchMove', pm.cx + pm.sx * k * 20, pm.cy + pm.sz * k * 15);
  await touch('touchEnd', pm.cx + pm.sx * 80, pm.cy + pm.sz * 60);
  await page.waitForTimeout(300);
  const o1 = await page.evaluate(() => ({ x: roi.map.ox, z: roi.map.oz }));
  check(Math.hypot(o1.x - o0.x, o1.z - o0.z) > 20 && (await page.isVisible('#map')), `a finger drags the map about (${Math.hypot(o1.x - o0.x, o1.z - o0.z).toFixed(0)} m), and a drag is not a tap`);
  await page.tap('#map-close');
  check(await page.isHidden('#map'), 'and it closes');

  // (since v0.8.3) the menu links back to the page of all the games (not followed: this server serves the game's folder alone)
  await page.tap('#btn-menu');
  await page.waitForSelector('#menu:not([hidden])');
  const games = await page.evaluate(() => { const a = document.getElementById('menu-games'), r = a.getBoundingClientRect(); return { href: a.href, text: a.textContent, shown: r.height > 0 && r.bottom <= innerHeight + 1 || a.closest('.menu-panel').scrollHeight > a.closest('.menu-panel').clientHeight }; });
  check(games.href === new URL('../index.html', page.url()).href && /games/i.test(games.text) && games.shown, `the menu has a link back to all the games (${games.href})`);
  await shot(page, 'phone-menu');
  await page.tap('#menu-resume');

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

  // Aiming the bow upright, the bow is just inside the edge of the picture (it used to be off it).
  await page.evaluate(() => { roi.teleport(266, 898, 1.57); roi.combat.swap('bow'); });
  await page.waitForTimeout(800);
  await page.evaluate(() => roi.combat.setAim(true));
  await page.waitForTimeout(3000);
  const ndc = await page.evaluate(() => {
    const b = roi.player.figure.heldBow, v = b.getWorldPosition(new (b.position.constructor)());
    v.project(roi.rig.camera);
    return v.x;
  });
  check(ndc > -1 && ndc < -0.6, `aiming upright, the bow shows at the left edge (at ${ndc.toFixed(2)} across)`);
  await shot(page, 'phone-upright-aim');
  await page.evaluate(() => roi.combat.setAim(false));

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
  const zoom = await page.locator('#map-in').boundingBox();
  check(zoom && zoom.y + zoom.height <= await page.evaluate(() => innerHeight), 'and its zoom buttons');
  await shot(page, 'phone-upright-map');
  await page.tap('#map-close');

  // (since v0.8.3) opened from the home screen of an iPhone held upright, iOS may report a window
  // short of the screen by the status bar: the picture still reaches the foot of the screen, and the
  // HUD keeps below the status bar. (?standalone=47 pretends to be that app; the real iPhone is not tried here.)
  await page.goto(base + '?quality=low&autostart&standalone=47');
  await ready(page);
  const app = await page.evaluate(() => ({ app: document.documentElement.classList.contains('app'), ih: innerHeight,
    view: document.getElementById('view').getBoundingClientRect().height, buf: roi.renderer.domElement.height / roi.renderer.getPixelRatio(),
    vitals: document.getElementById('vitals').getBoundingClientRect().top, buttons: document.getElementById('top-buttons').getBoundingClientRect().top }));
  check(app.app && Math.abs(app.view - (app.ih + 47)) < 1 && Math.abs(app.buf - app.view) < 2, `as a home-screen app the picture reaches the foot of the screen (${app.view.toFixed(0)} px, the window says ${app.ih})`);
  check(app.vitals >= 47 + 36 && app.buttons >= 47 + 36, `and the health bar and buttons keep below the status bar and the band iOS blurs under it (at ${app.vitals.toFixed(0)} and ${app.buttons.toFixed(0)} px)`);
  await shot(page, 'phone-upright-app');
  // (since v0.8.4) turned from its side to upright, the picture is not left stretched: iOS gives the new size
  // late, and the page's measure of the screen (--app-h) settles after the window's resize; the game follows
  // the canvas's own size. Here the measure is changed with no resize at all, as iOS does.
  const sharp = () => page.evaluate(() => { const c = roi.renderer.domElement, r = c.getBoundingClientRect(); return { css: r.width / r.height, buf: c.width / c.height }; });
  // (an emulated phone's window cannot be turned here, so the measure is set as a turn leaves it: the landscape height first, then upright)
  await page.evaluate(() => { roi.holdResolution(true); document.documentElement.style.setProperty('--app-h', '390px'); }); // (held, or the frame rate's own resizing would hide it)
  await page.waitForTimeout(800);
  await page.evaluate(() => document.documentElement.style.setProperty('--app-h', (innerHeight + 20) + 'px')); // (not the height it began at)
  await page.waitForTimeout(800);
  const late = await sharp();
  await page.evaluate(() => roi.holdResolution(false));
  check(Math.abs(late.css / late.buf - 1) < 0.02, `with the page's measure of the screen settling after a turn, the picture keeps its shape (drawn ${late.buf.toFixed(3)} wide to high, shown ${late.css.toFixed(3)})`);
  // the menu's "Update the game": the same release says so; a newer one is opened under a fresh address
  await page.tap('#btn-menu');
  await page.waitForSelector('#menu:not([hidden])');
  await page.evaluate(() => document.getElementById('menu-update').click()); // (it may be scrolled out of the menu's view)
  await page.waitForFunction(() => /newest|reached/.test(document.getElementById('menu-status').textContent), null, { timeout: 60000 });
  check(/newest version, v0\.8/.test(await page.textContent('#menu-status')), `on the newest release, Update the game says so ("${await page.textContent('#menu-status')}")`);
  await page.route(/index\.html\?check=/, async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: (await r.text()).replace(/class="version">v[0-9.]+</, 'class="version">v9.9.9<') }); });
  const went = page.waitForURL(/fresh=/, { timeout: 60000 }).then(() => true, () => false);
  await page.evaluate(() => document.getElementById('menu-update').click());
  check(await went, 'with a newer release on the server, it saves and opens the game again under a fresh address');
  await ready(page);
  check(!page.url().includes('fresh='), 'and tidies the address once loaded');
});

// The settlers (since v0.7): a freed, mapped province's people are led home from
// their boat, ask for help, and their place grows; the barrow can be climbed;
// notices are all one size.
await run('settlers', { viewport: { width: 1100, height: 700 } }, async (page) => {
  await page.goto(base + '?quality=low&autostart');
  await ready(page);
  await page.evaluate(() => {
    const s = roi.state;
    for (const c of roi.provinces.PROVINCE_CAMPS.southwood) s.cleared.push(c.id);
    s.quests.done.push('m-southwood');
    roi.quests.accept(s, 's-southwood');
    roi.settle(); roi.refreshHud();
    const st = roi.settlements.find((x) => x.province === 'southwood');
    roi.teleport(st.landing.x + 3, st.landing.z, -Math.PI / 2);
  });
  await page.waitForFunction(() => roi.state.escort?.following, null, { timeout: 60000 });
  check(true, 'the settlers wait at their boat, and follow when the ranger comes to them');
  await shot(page, 'settlers-boat');
  const home = await page.evaluate(async () => {
    const s = roi.state, st = roi.settlements.find((x) => x.province === 'southwood');
    const step = () => new Promise((r) => requestAnimationFrame(r));
    const who = roi.villages.escort.people, cart0 = roi.villages.escort.cart, bags = who.filter((q) => q.fig.props.sack.visible).length; // (counted on the way: at home they put them down)
    let gap = Infinity;
    for (let n = 0; n < 4000 && !s.settled.includes(st.site); n++) {
      const p = roi.player.pos, dx = st.x - p.x, dz = st.z - p.z, d = Math.hypot(dx, dz);
      if (d > 1) roi.player.place(p.x + (dx / d) * 0.3, p.z + (dz / d) * 0.3, Math.atan2(dx, dz));
      if (n > 60) for (let i = 0; i < who.length; i++) for (let j = i + 1; j < who.length; j++) gap = Math.min(gap, Math.hypot(who[i].x - who[j].x, who[i].z - who[j].z));
      await step();
    }
    const pl = roi.villages.places.get(st.site);
    return { settled: s.settled.includes(st.site), built: !!pl, done: roi.quests.isComplete(roi.quests.byId['s-southwood'], s), many: who.length, bags, gap,
      building: !!pl && (!!pl.build || pl.queue.length > 0) && pl.done.size === 0, travel: roi.travelPlaces().some((t) => t.id === 'site:' + st.site),
      handed: !!pl && pl.people.filter((q) => who.some((w) => w.fig === q.fig)).length === who.length && pl.cart === cart0 };
  });
  check(home.many === 7 && home.bags >= 4, `the family (${home.many}) carry their bags (${home.bags}), and one pushes a cart`);
  check(home.gap > 0.9, `on the way they keep a step apart (closest ${home.gap.toFixed(2)} m)`);
  check(home.settled && home.built && home.done, 'led home, they settle in, and the farm is lived in');
  check(home.building, 'on arriving they set to work, and the house goes up while they build it, not all at once');
  check(home.handed, 'the same people who walked home are the ones who live there, with their cart (nobody jumps or changes)');
  check(home.travel, 'a settlement whose people are home can be travelled to');
  await page.evaluate(() => { roi.villages.pace = 6; }); // (the rest of their settling in, hurried along for the test)
  await page.waitForFunction(() => roi.villages.places.get('farm3').done.size >= 1, null, { timeout: 240000 });
  check(true, 'after a while the house stands');
  const yard = await page.evaluate(() => {
    const hs = roi.sites.find((x) => x.id === 'farm3').houses[0], y = roi.heightAt(hs.x, hs.z);
    // no plant in the yard about the house (a metre or two out from its walls)
    let plants = 0;
    for (const ch of roi.ground.chunks.values()) for (const g of ch.veg ?? []) for (let i = 0; i < g.n; i++) {
      const dx = Math.abs(g.xs[i] - hs.x) - hs.w / 2, dz = Math.abs(g.zs[i] - hs.z) - hs.d / 2;
      if (Math.max(dx, dz) > 0.5 && Math.max(dx, dz) < 3) plants++;
    }
    return { solid: roi.blocked(hs.x, hs.z, y + 0.1, 0.4), plants };
  });
  check(yard.solid, 'a mended house is solid: no walking in through its door');
  check(yard.plants === 0, `nothing grows in the trodden yard about it (${yard.plants} plants)`);
  check(/family are home|settlers are home/.test(await page.textContent('#toast')), 'and the ranger is told so');
  // their own task: seed for the first field
  // (she walks to her place by the door first; then she will talk)
  await page.waitForFunction(() => { const q = roi.villages.places.get('farm3').people.find((o) => o.role === 'reeve'); return Math.hypot(q.x - q.post.x, q.z - q.post.z) < 0.5; }, null, { timeout: 240000 });
  await page.evaluate(() => { const p = roi.villages.places.get('farm3').people.find((q) => q.role === 'reeve'); roi.teleport(p.x + 2, p.z + 0.5, Math.atan2(-2, -0.5)); });
  await page.waitForFunction(() => document.getElementById('prompt').textContent.includes('Imrith'), null, { timeout: 20000 });
  await page.keyboard.press('KeyE');
  await page.waitForSelector('#dialogue:not([hidden])');
  await page.click('#dialogue-options button:has-text("What is there here for a ranger?")');
  check(/Garan/.test(await page.textContent('#dialogue-text')) && /bed/.test(await page.textContent('#dialogue-text')), 'she tells of their storekeeper and the bed they keep for a ranger');
  await page.click('#dialogue-options button:has-text("Thank you.")');
  await page.click('#dialogue-options button:has-text("Farewell.")');
  await page.keyboard.press('KeyE');
  await page.waitForSelector('#dialogue:not([hidden])');
  await page.click('#dialogue-options button:has-text("Can I help?")');
  await page.click('#dialogue-options button:has-text("I will do it.")');
  const want = await page.evaluate(() => { const e = roi.state.quests.errands.find((x) => x.giver === 'farm3'); roi.state.items[e.objective.item] = e.objective.count; roi.refreshHud(); return e.objective.item; });
  await page.waitForFunction(() => !document.getElementById('prompt').hidden, null, { timeout: 30000 });
  await page.keyboard.press('KeyE');
  await page.waitForSelector('#dialogue:not([hidden])');
  await page.click('#dialogue-options button:has-text("It is done")');
  await page.click('#dialogue-options button:has-text("Thank you.")');
  check(await page.evaluate(() => roi.villages.places.get('farm3').plots.length === 1 && roi.state.quests.count.farm3 === 1), 'their first task done, a field is cleared and sown');
  await page.waitForFunction(() => !document.getElementById('prompt').hidden && document.getElementById('prompt').textContent.includes('Imrith'), null, { timeout: 30000 });
  await page.keyboard.press('KeyE');
  await page.waitForSelector('#dialogue:not([hidden])');
  await page.click('#dialogue-options button:has-text("seed to sell")');
  await page.evaluate(() => { roi.state.silver = 20; });
  await page.click('#dialogue-options button:first-child');
  check(await page.evaluate((w) => roi.state.silver === 16 && roi.state.items[w] >= 2, want), 'and they sell the seed of what they have sown');
  await page.click('#dialogue-options button:has-text("That is all.")');
  await page.click('#dialogue-options button:has-text("Farewell.")');
  await page.evaluate(() => { const p = roi.villages.places.get('farm3').plots[0]; roi.lookFrom(p.x - 20, roi.heightAt(p.x, p.z) + 9, p.z + 22, p.x, roi.heightAt(p.x, p.z), p.z); });
  await page.waitForTimeout(1500);
  await shot(page, 'settlers-field');
  await page.evaluate(() => roi.lookFrom(null));

  // the storekeeper sells and buys plain things; the bed at the farm mends the ranger
  await page.waitForFunction(() => { const q = roi.villages.places.get('farm3').people.find((o) => o.role === 'trader'); return Math.hypot(q.x - q.post.x, q.z - q.post.z) < 0.5; }, null, { timeout: 240000 });
  await page.evaluate(() => { const q = roi.villages.places.get('farm3').people.find((o) => o.role === 'trader'); roi.teleport(q.x + 1.5, q.z + 1.5, 0); roi.state.silver = 50; roi.state.items.orcTrinket = 2; });
  await page.waitForFunction(() => document.getElementById('prompt').textContent.includes('Garan'), null, { timeout: 20000 });
  await page.keyboard.press('KeyE');
  await page.waitForSelector('#dialogue:not([hidden])');
  await page.click('#dialogue-options button:has-text("Show me what you have.")');
  await page.waitForSelector('#trade:not([hidden])');
  const shop = await page.evaluate(() => ({ title: document.getElementById('trade-title').textContent, smithHidden: [...document.querySelectorAll('#trade .smith')].every((e) => e.hidden), rows: document.getElementById('trade-buy').textContent, sells: document.getElementById('trade-sell').textContent }));
  check(/Garan/.test(shop.title) && shop.smithHidden && /Waybread/.test(shop.rows) && !/Mail|sword/i.test(shop.rows) && /Orc trinkets/.test(shop.sells), 'the storekeeper sells bread and the like, no gear, and buys plain things');
  await page.click('#trade-close');
  await page.evaluate(() => { const p = roi.villages.places.get('farm3'); roi.state.health = 40; roi.teleport(p.innDoor.x, p.innDoor.z, 0); });
  await page.waitForFunction(() => /Rest/.test(document.getElementById('prompt').textContent), null, { timeout: 120000 });
  await page.keyboard.press('KeyE');
  check(await page.waitForFunction(() => roi.state.health === 100, null, { timeout: 60000 }).then(() => true, () => false), 'at the farmhouse door the ranger may rest, and rises whole');
  // the heal button out of a fight: one thing at a time, the humblest first
  const ate = await page.evaluate(() => { const s = roi.state; s.health = 50; s.items.orcBread = 3; roi.combat.heal(true); return { bread: s.items.orcBread, health: s.health }; });
  check(ate.bread === 2 && ate.health === 60, 'out of a fight, the heal button eats one orc bread a touch, not as many as the wound needs');

  // (since v0.8.2) a family promised a farm comes over the River too, and is led in from its own boat:
  // the farm in the Moonwood nearest the shore, its province freed, and Éowyn with no told task to offer
  const fam = await page.evaluate(() => {
    const s = roi.state, Q = roi.quests;
    for (const c of roi.provinces.PROVINCE_CAMPS.ithil) if (!s.cleared.includes(c.id)) s.cleared.push(c.id);
    for (const q of Object.values(Q.byId)) if (q.giver === 'eowyn' && !s.quests.done.includes(q.id)) { s.quests.done.push(q.id); s.quests.active = s.quests.active.filter((a) => a !== q.id); }
    s.quests.errands = s.quests.errands.filter((e) => e.giver !== 'eowyn');
    s.homesteads.push('farm1');
    const e = Q.errandFrom('eowyn', s);
    if (e?.errand !== 'family') return { kind: e?.errand ?? null };
    Q.acceptErrand(s, e);
    roi.settle(); roi.refreshHud();
    return { kind: e.errand, offer: e.offer, boat: roi.villages.boats.has('farm1'), lived: roi.villages.places.has('farm1') };
  });
  check(fam.kind === 'family' && /boat/.test(fam.offer ?? ''), `with the province free, \u00c9owyn sends the ranger to bring the family in (${fam.kind})`);
  check(fam.boat && !fam.lived, 'their boat is at the shore, and the farm stands empty until they come');
  await page.evaluate(() => { const h = roi.homesteads.farm1; roi.teleport(h.landing.x + 3, h.landing.z, -Math.PI / 2); });
  await page.waitForFunction(() => roi.state.escort?.site === 'farm1' && roi.state.escort.following, null, { timeout: 60000 });
  await shot(page, 'family-boat');
  const farm = await page.evaluate(async () => {
    const s = roi.state, h = roi.homesteads.farm1;
    const step = () => new Promise((r) => requestAnimationFrame(r));
    const who = roi.villages.escort.people, many = who.length, small = who.filter((q) => q.small).length, cart = !!roi.villages.escort.cart;
    for (let n = 0; n < 2500 && !s.settled.includes('farm1'); n++) {
      const p = roi.player.pos, dx = h.x - p.x, dz = h.z - p.z, d = Math.hypot(dx, dz);
      if (d > 1) roi.player.place(p.x + (dx / d) * 0.3, p.z + (dz / d) * 0.3, Math.atan2(dx, dz));
      await step();
    }
    const pl = roi.villages.places.get('farm1');
    const e = s.quests.errands.find((x) => x.objective.site === 'farm1');
    return { many, small, cart, settled: s.settled.includes('farm1'), handed: !!pl && pl.people.length === many && pl.people.every((q) => who.some((w) => w.fig === q.fig)),
      done: !!e && roi.quests.isComplete(e, s), travel: roi.travelPlaces().some((t) => t.id === 'site:farm1') };
  });
  check(farm.many === 5 && farm.small === 2 && farm.cart, `the family are five (${farm.many}), two of them children, with a handcart`);
  check(farm.settled && farm.handed && farm.done, 'led to their farm they settle in, the same five who walked there, and the task is done');
  check(farm.travel, 'and their farm can be travelled to');

  const barrow = await page.evaluate(async () => {
    const r = roi.relics.find((x) => x.kind === 'barrow');
    roi.teleport(r.x, r.z - 1, 0);
    for (let i = 0; i < 10; i++) await new Promise((res) => requestAnimationFrame(res));
    const top = roi.player.pos.y - roi.heightAt(r.x, r.z - 1);
    roi.teleport(r.x, r.z + 5, 0);
    for (let i = 0; i < 10; i++) await new Promise((res) => requestAnimationFrame(res));
    return { top, door: roi.player.pos.y - roi.heightAt(r.x, r.z + 5) };
  });
  check(barrow.top > 2.5 && barrow.door < 0.3, `the ranger stands on top of the barrow (${barrow.top.toFixed(1)} m up), and at ground level before its door (${barrow.door.toFixed(2)} m)`);

  // notices: one size, whatever their kind
  await page.evaluate(() => { roi.hud.toast('The camp is broken', 'Give it a little while.'); roi.hud.toast('', 'Kingsfoil gathered (3).'); roi.hud.callout('Orc felled', 'felled'); });
  await page.waitForTimeout(1500);
  const sizes = await page.$$eval('#toast .note span', (els) => [...new Set(els.map((e) => getComputedStyle(e).fontSize))]);
  check(sizes.length === 1, `every notice is the same size (${sizes.join(', ')})`);

  // and after a reload the settlement is still there
  await page.evaluate(() => roi.save());
  await page.reload();
  await ready(page);
  check(await page.evaluate(() => roi.state.settled.includes('farm3') && roi.villages.places.has('farm3') && roi.villages.places.get('farm3').plots.length === 1), 'after a reload the farm is lived in still, its field sown');
});

// (v0.8) Camps broken up after their company falls; tents that stop people and fold
// away; the Marshal; bands met ahead on the road; scouts between camps, and a
// courier's map; every farmstead told of.
// Footing (since v0.8.3): the ranger used now and then to stand stuck before an unseen
// rough spot until he jumped: kinks a few centimetres across where the ground's shapings
// meet, and ledges where two streams' valleys met. Driven straight through the ranger's
// own movement (no frames drawn, so it is quick even in software rendering).
await run('footing', { viewport: { width: 400, height: 300 } }, async (page) => {
  await page.goto(base + '?quality=low&autostart');
  await ready(page);
  const r = await page.evaluate(() => {
    const P = roi.player, input = { move: { x: 0, y: 1 }, walk: false, haste: false, jumpHeld: false };
    const run = (x, z, yaw, seconds) => { // run forward without jumping; how far did he get?
      P.place(x, z, yaw); P.speed = 7.5;
      for (let f = 0; f < seconds * 60; f++) P.update(1 / 60, f / 60, input, yaw);
      return Math.hypot(P.pos.x - x, P.pos.z - z);
    };
    // where he stuck before (found by running him over the land), each run at from 3 m back
    const spots = [[1231.3, 1300.3, 1.6], [511.3, 2602.2, 2.74], [963.5, 2691.4, 1.11], [926.6, 2478.7, 2.16], [717.9, 1715.8, 2.21],
      [654.5, 1757.8, 1.05], [1257.8, 1594.6, 1.99], [1195.4, 1677.8, 2.17]];
    const stuck = spots.filter(([x, z, yaw]) => run(x - Math.sin(yaw) * 3, z - Math.cos(yaw) * 3, yaw, 2) < 8).map((s) => s.slice(0, 2).join(','));
    // home up the cut at Henneth Annûn, over the old step in its bed
    const cut = run(505, 894, Math.PI / 2, 3);
    // a few hundred runs about the land, in the woods west of the mountains: none stops on ground gentle over a metre
    let seed = 5; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const kinks = [];
    for (let w = 0; w < 300; w++) {
      const x = 200 + rand() * 1100, z = 80 + rand() * 2840, yaw = rand() * 6.283;
      P.place(x, z, yaw); P.speed = 7.5;
      let lx = x, lz = z;
      for (let f = 1; f <= 300; f++) {
        P.update(1 / 60, f / 60, input, yaw);
        if (f % 30) continue;
        if (Math.hypot(P.pos.x - lx, P.pos.z - lz) < 0.5) {
          const h = roi.heightAt, p = P.pos, ahead = (h(p.x + Math.sin(yaw), p.z + Math.cos(yaw)) - h(p.x, p.z));
          if (ahead < 0.6 && !roi.blocked(p.x + Math.sin(yaw) * 0.3, p.z + Math.cos(yaw) * 0.3, p.y, 0.4)) kinks.push([p.x.toFixed(1), p.z.toFixed(1), yaw.toFixed(2), ahead.toFixed(2)].join(','));
          break;
        }
        lx = P.pos.x; lz = P.pos.z;
      }
    }
    return { stuck, cut, kinks };
  });
  check(!r.stuck.length, `he runs on over every spot where he used to stick (${r.stuck.length ? 'stuck at ' + r.stuck.join('; ') : 'all 8 passed'})`);
  check(r.cut > 20, `he runs home up the bed of the cut at Henneth Ann\u00fbn without a jump (${r.cut.toFixed(1)} m in 3 s)`);
  // (a stop with gentle ground ahead and nothing solid may still be a tree or a rock in the way; say where, if any)
  check(r.kinks.length <= 3, `running about the land he stops on no unseen rough ground (${r.kinks.length} stops on gentle ground${r.kinks.length ? ': ' + r.kinks.join('; ') : ''})`);
});

await run('camps and scouts', { viewport: { width: 800, height: 500 } }, async (page) => {
  await page.goto(base + '?quality=low&autostart');
  await ready(page);
  const war = await page.evaluate(() => { const c = roi.camps.sites.find((c) => c.size === 4); roi.combat.god = true; roi.teleport(c.x + 30, c.z, -Math.PI / 2); return c.id; });
  await page.waitForFunction((id) => roi.enemies.list.some((e) => e.camp.id === id), war, { timeout: 60000 });
  const t = await page.evaluate((id) => { // a shelter stops the ranger: set down in one, the first step puts them out
    const t = roi.camps.byId[id].pitched[0].circles[0];
    roi.enemies.reset(); roi.player.place(t[0], t[1], 0); roi.rig.yaw = 0;
    return t;
  }, war);
  const first = page.evaluate(async (t) => { // where the ranger is the first frame they move: out past the shelter's edge, not a step into it
    for (let k = 0; k < 6000; k++) {
      await new Promise((r) => requestAnimationFrame(r));
      const d = Math.hypot(roi.player.pos.x - t[0], roi.player.pos.z - t[1]);
      if (d > 0.01) return d;
    }
    return 0;
  }, t);
  await page.keyboard.down('KeyW');
  const pushed = await first;
  await page.keyboard.up('KeyW');
  check(pushed > t[2], `a shelter is solid: the first step puts the ranger out of it (${pushed.toFixed(1)} m, its edge ${t[2].toFixed(1)} m)`);
  check(await page.evaluate((id) => roi.camps.byId[id].pitched.length >= 8 && roi.camps.byId[id].flames.children.length > 2, war), 'a war-camp has many shelters and a great fire');
  await page.evaluate((id) => { const c = roi.camps.byId[id]; roi.teleport(c.x + 30, c.z, -Math.PI / 2); }, war);
  await page.waitForFunction((id) => roi.enemies.list.some((e) => e.camp.id === id), war, { timeout: 60000 });
  await page.evaluate((id) => { for (const e of [...roi.enemies.list]) if (e.camp.id === id) roi.enemies.damage(e, 1e9); }, war);
  check(await page.evaluate((id) => roi.state.cleared.includes(id) && !roi.state.broken.includes(id) && roi.camps.byId[id].occupied.visible, war), 'the last of a war-camp down, it is taken but still stands');
  check(await page.evaluate(() => roi.hud.recent.some((t) => /war-camp is taken/.test(t) && /Break the war-camp up/.test(t))), 'and the ranger is told to break it up');
  await page.evaluate((id) => { roi.enemies.reset(); const c = roi.camps.byId[id]; roi.teleport(c.fire.x + 5, c.fire.z + 1, -Math.PI / 2); }, war);
  await page.waitForFunction(() => !document.getElementById('prompt').hidden && document.getElementById('prompt').textContent.includes('Break up the war-camp'), null, { timeout: 60000 });
  const silver = await page.evaluate(() => roi.state.silver);
  await page.keyboard.press('KeyE');
  await page.waitForFunction((id) => roi.state.broken.includes(id), war, { timeout: 20000 });
  check(await page.evaluate((s) => roi.state.silver > s, silver), 'breaking it up takes its stores');
  check(await page.evaluate((id) => !roi.camps.byId[id].flames.visible, war), 'and puts out the fire');
  await page.waitForFunction((id) => !roi.camps.byId[id].occupied.visible && roi.camps.byId[id].cleared.visible, war, { timeout: 600000 });
  check(true, 'the shelters fold away, and the ranger\u2019s marker stands');
  await page.waitForFunction((id) => roi.camps.byId[id].strength < 0.9, war, { timeout: 600000 });
  check(true, 'and the land begins to heal');
  await shot(page, 'war-camp-broken');

  // the Marshal: a giant
  check(await page.evaluate(() => { roi.enemies.reset(); roi.enemies.spawnCamp({ id: 'look', x: roi.player.pos.x + 30, z: roi.player.pos.z, tier: 4, size: 2 }, ['marshal', 'chief']);
    const [m, c] = roi.enemies.list; const big = m.fig.scale.x > c.fig.scale.x * 1.35; roi.enemies.reset(); return big; }), 'the Marshal stands head and shoulders over a captain');

  // a band on the road is set down ahead of the ranger going north, and marches south
  const band = await page.evaluate(async () => {
    roi.enemies.reset();
    const z = 2000; roi.teleport(roi.haradRoadX(z) - 20, z, Math.PI);
    roi.player.place(roi.haradRoadX(z - 10) - 20, z - 10, Math.PI); // (a step north, so they know which way the ranger goes)
    roi.enemies.patrolIn = 0;
    for (let t = 0; t < 1200 && ![...roi.enemies.camps.values()].some((c) => c.camp.patrol); t++) await new Promise((r) => setTimeout(r, 100));
    const c = [...roi.enemies.camps.values()].find((c) => c.camp.patrol);
    return c ? { z: c.camp.z, dir: c.camp.patrol.dir, rz: roi.player.pos.z } : null;
  });
  check(band && band.dir === 1 && band.z < band.rz - 100, `a band comes down the road to meet the ranger going north${band ? '' : ' (none came)'}`);
  const packs = await page.evaluate(() => { const s = roi.state.silver; for (const e of [...roi.enemies.list]) if (e.camp.patrol) roi.enemies.damage(e, 1e9); return roi.state.silver > s && roi.hud.recent.some((t) => /From their packs|baggage/.test(t)); });
  check(packs, 'beaten, a band gives up what it carried');

  // scouts: in a province not yet free, a party is set down out of sight and walks its way
  const scouts = await page.evaluate(async () => {
    roi.enemies.reset();
    const camps = roi.provinces.PROVINCE_CAMPS.henneth, a = camps[0], b = camps[camps.length - 1];
    roi.teleport((a.x + b.x) / 2, (a.z + b.z) / 2, 0);
    roi.enemies.scoutIn = 0;
    for (let t = 0; t < 1200 && ![...roi.enemies.camps.values()].some((c) => c.camp.scout); t++) await new Promise((r) => setTimeout(r, 100));
    const c = [...roi.enemies.camps.values()].find((c) => c.camp.scout);
    if (!c) return null;
    const lead = roi.enemies.list.find((e) => e.camp === c.camp), x0 = lead.x, z0 = lead.z, d0 = Math.hypot(x0 - roi.player.pos.x, z0 - roi.player.pos.z);
    const t0 = roi.state.stats.playSeconds;
    for (let t = 0; t < 3000 && roi.state.stats.playSeconds - t0 < 6; t++) await new Promise((r) => setTimeout(r, 100));
    return { d0, moved: Math.hypot(lead.x - x0, lead.z - z0), n: roi.enemies.list.filter((e) => e.camp === c.camp).length };
  });
  check(scouts && scouts.d0 > 120 && scouts.n >= 1 && scouts.n <= 3, `a scouting party of one to three is set down out of sight${scouts ? ` (${scouts.d0.toFixed(0)} m)` : ' (none came)'}`);
  check(scouts && scouts.moved > 5, 'and walks on its way');
  const map = await page.evaluate(() => {
    roi.enemies.reset();
    const to = roi.provinces.HOLDS.forlad, p = roi.player.pos;
    const camp = roi.enemies.spawnScouts([{ x: p.x + 40, z: p.z }, { x: to.x, z: to.z }], { x: p.x + 40, z: p.z, leg: 1 }, ['snaga'], to.id);
    for (const e of [...roi.enemies.list]) if (e.camp === camp) roi.enemies.damage(e, 1e9);
    return roi.state.told.includes(to.id) && roi.provinces.status(roi.state, 'forlad').holdKnown && roi.hud.recent.some((t) => /scout\u2019s map/.test(t));
  });
  check(map, 'a courier killed gives up his map, and the hold he was bound for is marked');

  // every old farmstead found is told of, not only the first
  const farms = await page.evaluate(async () => {
    roi.enemies.reset();
    const told = [], count = () => roi.hud.recent.filter((t) => t.startsWith('An old farmstead')).length;
    for (const f of roi.sites.filter((s) => s.kind === 'farm' && !roi.state.discovered.includes('site:' + s.id)).slice(0, 2)) {
      const before = count();
      roi.teleport(f.x + 5, f.z + 5, 0);
      for (let t = 0; t < 1200 && !roi.state.discovered.includes('site:' + f.id); t++) await new Promise((r) => setTimeout(r, 100));
      told.push(count() > before);
    }
    return told;
  });
  check(farms.length === 2 && farms.every(Boolean), 'each old farmstead found is told of');
});

// The testing panel folds away by a tap on a phone (it would not before v0.8)
await run('testing page on a phone', { ...devices['iPhone 13'] }, async (page) => {
  await page.goto(base + '?dev&quality=low&autostart');
  await ready(page);
  await page.waitForSelector('#dev header');
  const tall = await page.evaluate(() => document.getElementById('dev').getBoundingClientRect().height);
  await page.tap('#dev header');
  await page.waitForTimeout(300);
  const short = await page.evaluate(() => document.getElementById('dev').getBoundingClientRect().height);
  check(tall > 100 && short < 40, `the testing panel folds at a tap (${tall.toFixed(0)} to ${short.toFixed(0)} px)`);
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
  // (since v0.8.2 the map shows part of the land: pick the spot 0.4 across and 0.6 down the land, brought into view)
  const spot = await page.evaluate(() => { const x = 0.4 * roi.WORLD.width, z = 0.6 * roi.WORLD.length; roi.map.centre(x, z); return roi.map.screenAt(x, z); });
  await page.waitForTimeout(300);
  await page.mouse.click(spot.x, spot.y);
  await page.waitForFunction(() => Math.abs(roi.player.pos.x - 0.4 * roi.WORLD.width) < 30 && Math.abs(roi.player.pos.z - 0.6 * roi.WORLD.length) < 40, null, { timeout: 30000 });
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
console.log('\nTimes:');
for (const t of times) console.log(`  ${clock(t.took).padStart(6)}  ${t.label}${t.failed ? ` (${t.failed} failed)` : ''}`);
console.log(`  ${clock(performance.now() - t0).padStart(6)}  in all`);
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
