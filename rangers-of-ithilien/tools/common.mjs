// Shared by the tools in this folder: serve a copy of the game, open it in
// headless Chromium, and (for --ref) check out another version of it to
// compare against. Uses the pre-installed Playwright, as tests/smoke.mjs does;
// nothing to install. Headless Chromium renders in software: these tools show
// what is drawn and how much, never how fast a real GPU draws it.

import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join, normalize, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

export const { chromium } = createRequire(import.meta.url)('playwright');
export const GAME = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

/** Command-line flags: `--name value` pairs and bare positional arguments. */
export function args(argv = process.argv.slice(2)) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') || argv[i + 1] === undefined ? true : argv[++i];
    else out._.push(argv[i]);
  }
  return out;
}

/** Serve a game folder on a free port. Returns { url, close }. */
export async function serve(root) {
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
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() };
}

/**
 * Check out another version of the repository (a branch, tag or commit) in a
 * temporary git worktree. Returns { root (its copy of the game), remove }.
 */
export async function checkout(ref) {
  const repo = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: GAME, encoding: 'utf8' }).trim();
  // say exactly what is being compared: a local branch can be far behind its remote
  console.log(`--ref ${ref}: ${execFileSync('git', ['log', '-1', '--format=%h %cs %s', ref], { cwd: repo, encoding: 'utf8' }).trim()}`);
  const dir = await mkdtemp(join(tmpdir(), 'roi-ref-'));
  execFileSync('git', ['worktree', 'add', '--detach', '--force', dir, ref], { cwd: repo, stdio: 'ignore' });
  return {
    root: join(dir, relative(repo, GAME)),
    remove: async () => {
      try { execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: repo, stdio: 'ignore' }); } catch { /* already gone */ }
      await rm(dir, { recursive: true, force: true });
    },
  };
}

export async function launch() {
  return chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}

/**
 * Open the game at a quality, skipping the title, and wait until it is ready.
 * Console errors and failed requests are collected in page.errors.
 */
export async function openGame(browser, url, { quality = 'medium', width = 1100, height = 700 } = {}) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.errors = [];
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('requestfailed', (r) => page.errors.push('request failed: ' + r.url()));
  await page.goto(`${url}?autostart&quality=${quality}`);
  await page.waitForFunction(() => window.roi?.ready, null, { timeout: 180000 });
  return page;
}
