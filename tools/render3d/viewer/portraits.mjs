// Portraits des personnages pour le site vitrine (mode « portrait » de la visionneuse) :
// fond transparent, ombres au sol, contre-jours colorés. Le fond néon et la conversion WebP sont
// faits ensuite par `portraits.py`.
//   node portraits.mjs <dossier> --spec specs/portraits.json [--size 1920] [--only manager,auditeur]
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require('playwright');
} catch {
  playwright = require('/opt/node22/lib/node_modules/playwright');
}

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const out = path.resolve(args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--'))) ?? 'portraits');
const size = +opt('--size', 1920);
const ow = +opt('--ow', size / 520);
const only = opt('--only', '')?.split(',').filter(Boolean);
const shots = JSON.parse(fs.readFileSync(opt('--spec', 'specs/portraits.json'), 'utf8')).filter((s) => !only?.length || only.includes(s.file));
fs.mkdirSync(out, { recursive: true });

const root = fileURLToPath(new URL('.', import.meta.url));
const server = await createServer({ root, configFile: path.join(root, 'vite.config.js'), server: { port: 4198, strictPort: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await playwright.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: size, height: size } });
page.on('pageerror', (e) => console.error('[page]', e.message));
await page.goto(`${url}?shot&portrait&w=${size}&h=${size}&ow=${ow}`);
await page.waitForFunction(() => window.viewerReady === true, null, { timeout: 120000 });
await page.addStyleTag({ content: 'html, body, #app { background: transparent !important; }' });

for (const s of shots) {
  await page.evaluate(([m, e]) => window.viewer.model(m, e), [s.model, s.equip ?? null]);
  await page.evaluate((o) => window.viewer.stage(o), s.stage ?? {});
  await page.evaluate(([c, t, y, tele, z, ty]) => window.viewer.pose(c, t, y, 'portrait', tele, z, ty), [s.clip, s.t ?? 0, s.yaw ?? 0, s.tele ?? 0, s.zoom ?? 1, s.ty ?? null]);
  const file = path.join(out, `${s.file}.png`);
  await page.locator('canvas').screenshot({ path: file, omitBackground: true });
  console.log(file);
}
await browser.close();
await server.close();
