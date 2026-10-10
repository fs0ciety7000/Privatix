// Mesure la mémoire du jeu avec l'OST (Playwright + Chromium, serveur Vite) : même parcours (titre,
// hub, biome 1, boss Auditeur, départs), puis RSS des processus Chromium (rendu, audio, total),
// tas JS et `performance.measureUserAgentSpecificMemory` si disponible.
//   node tools/audio/memory-check.mjs [--procedural]
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require('/opt/node22/lib/node_modules/playwright');
}

const procedural = process.argv.includes('--procedural');
const root = fileURLToPath(new URL('../..', import.meta.url));
const server = await createServer({ root, server: { port: 4199, strictPort: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await playwright.chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-precise-memory-info'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${url}/play3d.html?demo&cheat&fixed&seed=1&q=bas${procedural ? '&procedural' : ''}`);
await page.waitForSelector('.px-btn--primary', { timeout: 180000 });
await page.waitForFunction(() => '__privatix3d' in window);
const api = (fn, ...args) => page.evaluate(([f, a]) => window.__privatix3d[f](...a), [fn, args]);
await page.mouse.click(5, 5);
await page.waitForTimeout(8000);
await api('start');
await api('cheat', 'G');
await page.waitForTimeout(10000);
await api('cheat', 'B');
await page.waitForTimeout(15000);

/** RSS (Mo) des processus Chromium lancés par Playwright, par type. */
function chromiumRss() {
  const out = { renderer: 0, audio: 0, gpu: 0, total: 0 };
  for (const pid of readdirSync('/proc').filter((d) => /^\d+$/.test(d))) {
    let cmd = '';
    let status = '';
    try {
      cmd = readFileSync(`/proc/${pid}/cmdline`, 'utf8');
      status = readFileSync(`/proc/${pid}/status`, 'utf8');
    } catch {
      continue;
    }
    if (!cmd.includes('ms-playwright') && !cmd.includes('chrom')) continue;
    if (!cmd.includes('--type=') && !cmd.includes('headless')) continue;
    const m = /VmRSS:\s+(\d+) kB/.exec(status);
    if (!m) continue;
    const mb = Number(m[1]) / 1024;
    out.total += mb;
    if (cmd.includes('--type=renderer')) out.renderer += mb;
    else if (cmd.includes('audio.mojom') || cmd.includes('AudioService')) out.audio += mb;
    else if (cmd.includes('--type=gpu-process')) out.gpu += mb;
  }
  for (const k of Object.keys(out)) out[k] = Math.round(out[k]);
  return out;
}

const js = await page.evaluate(async () => {
  const perf = performance;
  const heap = perf.memory ? Math.round(perf.memory.usedJSHeapSize / 1048576) : null;
  let uasm = null;
  if (typeof perf.measureUserAgentSpecificMemory === 'function' && crossOriginIsolated) {
    try {
      uasm = Math.round((await perf.measureUserAgentSpecificMemory()).bytes / 1048576);
    } catch {
      uasm = null;
    }
  }
  return { heap, uasm, isolated: crossOriginIsolated };
});
const audio = await api('audio').catch(() => null);
console.log(
  JSON.stringify(
    {
      mode: procedural ? 'procedural' : 'enregistré',
      track: audio?.track ?? null,
      pcmMo: audio?.pcmMo ?? null,
      streams: audio?.streams ?? null,
      rssMo: chromiumRss(),
      jsHeapMo: js.heap,
      measureUserAgentSpecificMemoryMo: js.uasm,
      crossOriginIsolated: js.isolated,
    },
    null,
    1,
  ),
);
await browser.close();
await server.close();
