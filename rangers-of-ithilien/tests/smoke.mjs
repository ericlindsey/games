// Browser smoke test. Serves the game folder, then drives it in headless Chromium
// on a desktop and a phone profile. Run: node tests/smoke.mjs [screenshot-dir]
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
const shot = async (page, name) => { if (shots) await page.screenshot({ path: join(shots, name + '.png') }); };

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function run(label, contextOptions, body) {
  console.log(`\n== ${label} ==`);
  const ctx = await browser.newContext(contextOptions);
  const page = await ctx.newPage();
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

  // Faramir is a few steps away: walk up and speak.
  await page.evaluate(() => roi.teleport(roi.refuge.faramir.x + 1.4, roi.refuge.faramir.z + 1.3, -2, 40));
  await page.waitForFunction(() => !document.getElementById('prompt').hidden, null, { timeout: 20000 });
  check((await page.textContent('#prompt')).includes('Faramir'), 'prompt offers to speak with Faramir');
  await page.keyboard.press('KeyE');
  await page.waitForSelector('#dialogue:not([hidden])');
  check((await page.textContent('#dialogue-name')) === 'Faramir', 'dialogue opens');
  await shot(page, 'dialogue');
  await page.click('#dialogue-options button:first-child');
  check((await page.textContent('#dialogue-text')).includes('Black Gate'), 'choosing a topic changes the text');
  await page.click('#dialogue-options button:last-child');
  check(await page.isHidden('#dialogue'), 'dialogue closes');

  // The hidden stair: from the floor of the cut, up along the basin wall and in at the door.
  await page.evaluate(() => { roi.teleport(973, 1202.3, Math.PI / 2, 31); roi.rig.yaw = Math.PI / 2; });
  const foot = await pos(page);
  check(Math.abs(foot.y - 31) < 1.2, 'the foot of the stair is on the floor of the basin');
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => roi.player.pos.x > 1004, null, { timeout: 90000 });
  await page.keyboard.up('KeyW');
  const door = await pos(page);
  check(Math.abs(door.y - 40) < 0.1, `the stair climbs to the cave door (y ${door.y.toFixed(1)})`);
  check(await page.evaluate(() => roi.refuge.isInside(roi.player.pos)), 'and leads inside the rock');
  await shot(page, 'hall');

  // The way out: from the pool, down the cut, to open ground in the woods.
  await page.evaluate(() => { roi.teleport(970, 1193, -Math.PI / 2, 31); roi.rig.yaw = -Math.PI / 2; roi.input.haste = true; });
  await page.keyboard.down('KeyW');
  const out = await page.waitForFunction(() => roi.player.pos.x < 610, null, { timeout: 60000 }).then(() => true, () => false);
  await page.keyboard.up('KeyW');
  await page.evaluate(() => { roi.input.haste = false; });
  const exit = await pos(page);
  check(out, `the cut leads out downstream (reached x ${exit.x.toFixed(0)})`);
  check(await page.evaluate((p) => roi.heightAt(p.x, p.z + 25) - p.y < 6 && !roi.refuge.isInside(roi.player.pos), exit), 'and the banks there are low enough to climb');
  await shot(page, 'cut-exit');

  // Walk, on the lawns of Cormallen where nothing is in the way.
  await page.evaluate(() => roi.teleport(337, 1195, 0));
  const a = await pos(page);
  await page.keyboard.down('KeyW');
  await page.waitForFunction((a) => Math.hypot(roi.player.pos.x - a.x, roi.player.pos.z - a.z) > 2, a, { timeout: 30000 });
  await page.keyboard.up('KeyW');
  const b = await pos(page);
  check(b.z > a.z + 1.5, `holding W walks forward (moved ${dist(a, b).toFixed(1)} m)`);
  check(Math.abs(b.y - (await page.evaluate((b) => roi.heightAt(b.x, b.z), b))) < 0.05, 'feet follow the ground');

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
  check(await page.evaluate(() => roi.camps.sites.length >= 100), 'more than a hundred camps exist');
  await page.evaluate(() => { const c = roi.camps.byId.c1; roi.teleport(c.x + 0.5, c.z + 1.6, 3); });
  await page.waitForFunction(() => document.getElementById('prompt').textContent.includes('camp'), null, { timeout: 20000 });
  await page.keyboard.press('KeyE');
  check(await page.evaluate(() => roi.state.cleared.includes('c1') && roi.camps.byId.c1.isCleared), 'a camp can be broken up');
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
  check(await page.evaluate(() => roi.state.cleared.includes('c1') && roi.state.discovered.includes('arch')), 'progress is restored after a reload');

  // Menu.
  await page.click('#btn-menu');
  await page.waitForSelector('#menu:not([hidden])');
  await shot(page, 'menu');
  await page.click('#menu-resume');
  check(await page.isHidden('#menu'), 'menu opens and closes');
});

await run('phone (touch)', { ...devices['Pixel 7 landscape'] }, async (page) => {
  await page.goto(base);
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

  // Speak with Éowyn by tapping the prompt.
  await page.evaluate(() => roi.teleport(roi.refuge.eowyn.x + 1.6, roi.refuge.eowyn.z - 0.6, 1, 40));
  await page.waitForFunction(() => document.getElementById('prompt').textContent.includes('owyn'), null, { timeout: 20000 });
  await page.tap('#prompt');
  await page.waitForSelector('#dialogue:not([hidden])');
  check(true, 'tapping the prompt opens dialogue');
  await shot(page, 'phone-dialogue');
});

await browser.close();
server.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
