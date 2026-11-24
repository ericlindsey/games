// Screenshots of the station for checking visual changes, and a console-error check.
//
//   node tools/shoot.mjs [--out dir] [--size 1200x750] [--only name,name] [--wait ms] [--views views.json]
//
// Serves this folder, opens each view below in headless Chromium (software
// WebGL), waits, saves <name>.png, and exits non-zero if the page logged an
// error or a shader failed to compile. Shots go to --out (default: the system
// temp dir, station-shots/).
//
// A view is a URL hash (the same one the page writes as you move sliders) plus
// optional `eval` run in the page (window.station is the console handle).

import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join, resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const SUNNY = "station.spin = station.spinForHighest('sun') - 0.6";
export const VIEWS = [
  { name: 'default', hash: '#warp=0', eval: SUNNY },
  { name: 'moon', hash: '#warp=0', eval: "station.spin = station.spinForHighest('moon'); station.aim('moon')" },
  { name: 'earth', hash: '#warp=0', eval: "station.spin = station.spinForHighest('earth') + 0.25; station.aim('earth'); station.params.fov = 10" },
  { name: 'outside', hash: '#view=outside&warp=0', eval: 'station.spin = 1' },
  { name: 'big-ring', hash: '#diameter=1800&width=120&deck=25&warp=0', eval: SUNNY + '; station.player.pitch = 0.35' },
  { name: 'small-ring', hash: '#diameter=40&width=10&deck=4&gravity=0.3&warp=0', eval: SUNNY },
];

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));
const out = resolve(args.out ?? join(tmpdir(), 'station-shots'));
const [width, height] = String(args.size ?? '1200x750').split('x').map(Number);
const wait = Number(args.wait ?? 2500);
let views = args.views ? JSON.parse(await readFile(resolve(String(args.views)), 'utf8')) : VIEWS;
if (args.only) { const only = new Set(String(args.only).split(',')); views = views.filter((v) => only.has(v.name)); }
await mkdir(out, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = join(ROOT, path.endsWith('/') ? path + 'index.html' : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
try {
  for (const v of views) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('console', (m) => { if (m.type() === 'error' || /error|warning/i.test(m.text()) && /shader|webgl|program/i.test(m.text())) errors.push(`${v.name}: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`${v.name}: ${e.message}`));
    await page.goto(base + 'index.html' + v.hash);
    await page.waitForFunction(() => window.station, null, { timeout: 30000 });
    if (v.eval) await page.evaluate(v.eval);
    await page.waitForTimeout(wait);
    await page.screenshot({ path: join(out, `${v.name}.png`) });
    console.log(`${v.name}.png`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(`shots in ${out}`);
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
