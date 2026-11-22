// Runs the game in the machine's own Google Chrome, headless but on the real GPU,
// and evaluates code in it over the DevTools protocol (no packages needed: Node's
// own WebSocket). For timing on this machine, which software rendering cannot do.
//
//   node tools/chrome.mjs [--quality high] [--size 1024x768] [--dpr 2] [--url-extra "&x"] [--eval "js"] [--eval-file tools/calls.js] [--shot out.png] [--bench] [--cpu 5]
//
// --bench runs the frame-rate test (src/bench.js) and prints its table. Needs a
// server on --port (default 8765) serving this folder, or pass --serve to start one.
// --cpu 5 slows the page's main thread five times once the game has loaded (DevTools'
// CPU throttling), to stand in roughly for a phone when timing work done on it.

import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { args, serve, GAME } from './common.mjs';

const a = args();
const CHROME = a.chrome ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [W, H] = String(a.size ?? '1024x768').split('x').map(Number);
const DPR = Number(a.dpr ?? 2);

export async function openChrome(url) {
  const dir = await mkdtemp(join(tmpdir(), 'roi-chrome-'));
  const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`, '--no-first-run', '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-frame-rate-limit',
    `--window-size=${W},${H}`, `--force-device-scale-factor=${DPR}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((res, rej) => {
    let buf = '';
    proc.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) res(m[1]); });
    proc.on('exit', () => rej(new Error('chrome exited: ' + buf)));
  });
  const port = new URL(wsUrl).port;
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const pending = new Map(), logs = [];
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') logs.push('exception: ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('console.error: ' + m.params.args.map((x) => x.value ?? x.description).join(' '));
  });
  const send = (method, params = {}) => new Promise((r) => { const k = ++id; pending.set(k, r); ws.send(JSON.stringify({ id: k, method, params })); });
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: false });
  await send('Page.navigate', { url });
  const evaluate = async (expr, timeout = 600000) => {
    const m = await Promise.race([send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeout))]);
    if (m.result?.exceptionDetails) throw new Error(m.result.exceptionDetails.exception?.description ?? m.result.exceptionDetails.text);
    return m.result?.result?.value;
  };
  /** Save a PNG of the page. */
  const shot = async (path) => {
    const m = await send('Page.captureScreenshot', { format: 'png' });
    (await import('node:fs')).writeFileSync(path, Buffer.from(m.result.data, 'base64'));
  };
  const close = async () => { try { ws.close(); } catch { /* gone */ } proc.kill('SIGKILL'); await new Promise((r) => setTimeout(r, 300)); await rm(dir, { recursive: true, force: true }).catch(() => {}); };
  return { evaluate, close, logs, shot, send };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = a.serve ? await serve(GAME) : null;
  const base = server ? server.url : `http://127.0.0.1:${a.port ?? 8765}/`;
  const c = await openChrome(`${base}?autostart&quality=${a.quality ?? 'high'}${a['url-extra'] ?? ''}`);
  try {
    for (let i = 0; ; i++) {
      const s = await c.evaluate(`window.roi?.ready ? 'ready' : document.getElementById('loading')?.textContent ?? ''`, 10000).catch((e) => 'no answer: ' + e.message);
      if (s === 'ready') break;
      if (i > 90) throw new Error('the game did not load: ' + s + '\n' + c.logs.join('\n'));
      await new Promise((r) => setTimeout(r, 1000));
    }
    console.log(await c.evaluate(`(() => { const gl = roi.renderer.getContext(), e = gl.getExtension('WEBGL_debug_renderer_info'); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; })()`));
    if (a.cpu) await c.send('Emulation.setCPUThrottlingRate', { rate: Number(a.cpu) });
    if (a.eval) console.log(JSON.stringify(await c.evaluate(a.eval), null, 1));
    if (a['eval-file']) { const v = await c.evaluate((await import('node:fs')).readFileSync(a['eval-file'], 'utf8')); console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 1)); }
    if (a.shot) await c.shot(a.shot);
    if (a.bench) console.log((await c.evaluate(`roi.bench({ show: false${a.secs ? ', secs: ' + a.secs : ''} }).then((b) => b.lines.join('\\n'))`)));
    if (c.logs.length) console.log(c.logs.join('\n'));
  } finally {
    await c.close();
    server?.close();
  }
  process.exit(0);
}
