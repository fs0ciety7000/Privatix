// Capture des cartons du trailer (tools/trailer/cards.html) image par image, sur fond transparent.
//   node tools/trailer/cards.mjs --out dossier [--formats 16x9,3x2,1x1,9x16] [--cards C1,…,END] [--force]
// Sortie : <out>/<format>/<carton>/00000.png… (PNG RGBA, 60 i/s).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
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
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const out = opt('out', 'trailer-cards');
const formats = opt('formats', '16x9,3x2,1x1,9x16').split(',');
const cards = opt('cards', 'C1,C2,C3,C4,C5,C6,END').split(',');
const SIZES = { '16x9': [1920, 1080], '9x16': [1080, 1920], '1x1': [1080, 1080], '3x2': [1620, 1080] };

const root = fileURLToPath(new URL('../..', import.meta.url));
const server = await createServer({
  root,
  server: { port: 4240, strictPort: false, hmr: false },
  logLevel: 'error',
});
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await playwright.chromium.launch();
for (const format of formats) {
  const [w, h] = SIZES[format];
  for (const card of cards) {
    const dir = `${out}/${format}/${card}`;
    if (existsSync(`${dir}/done`) && !args.includes('--force')) continue;
    mkdirSync(dir, { recursive: true });
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => console.error(`${card} ${format} : ${e.message}`));
    await page.goto(`${base}/tools/trailer/cards.html?format=${format}&card=${card}`);
    await page.waitForFunction(() => window.cards !== undefined, null, { timeout: 60000 });
    const frames = await page.evaluate(() => window.cards.frames);
    const only = opt('frame', null);
    for (let i = 0; i < frames; i += 1) {
      if (only !== null && i !== Number(only)) continue;
      await page.evaluate((k) => window.cards.seek(k), i);
      await page.screenshot({ path: `${dir}/${String(i).padStart(5, '0')}.png`, omitBackground: true });
    }
    if (only === null) writeFileSync(`${dir}/done`, `${String(frames)}\n`);
    console.log(`${format} ${card} : ${String(frames)} images`);
    await page.close();
  }
}
await browser.close();
await server.close();
