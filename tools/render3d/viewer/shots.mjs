// Captures de la visionneuse (Playwright + Chromium SwiftShader, sans GPU).
//   node shots.mjs [dossier] [--only hero,consultant] [--size 640] [--spec shots.json]
// Sans --spec : pour chaque personnage, une vue trois-quarts par clip (au moment clé : événement
// « active » ou milieu du clip), + vue de jeu et face pour idle. Fichiers : <perso>_<clip>_<cam>.png
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
const out = path.resolve(args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--'))) ?? 'shots');
const only = opt('--only', '')?.split(',').filter(Boolean);
const size = +opt('--size', 640);
const specFile = opt('--spec', null);
fs.mkdirSync(out, { recursive: true });

const root = fileURLToPath(new URL('.', import.meta.url));
const server = await createServer({ root, configFile: path.join(root, 'vite.config.js'), server: { port: 4199, strictPort: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];

const browser = await playwright.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: size, height: size } });
page.on('console', (m) => m.type() === 'error' && console.error('[page]', m.text()));
page.on('pageerror', (e) => console.error('[page]', e.message));
await page.goto(`${url}?shot&w=${size}&h=${size}`);
await page.waitForFunction(() => window.viewerReady === true, null, { timeout: 120000 });
const manifest = await page.evaluate(() => window.viewer.manifest());

let shots;
if (specFile) shots = JSON.parse(fs.readFileSync(specFile, 'utf8'));
else {
  shots = [];
  for (const [name, info] of Object.entries(manifest.characters)) {
    if (only?.length && !only.includes(name)) continue;
    const equip = info.kind === 'hero' ? { casque: 'casque_chantier', gilet: 'gilet_hv', outil: 'cle_tire_fond' } : null;
    shots.push({ model: name, equip, clip: 'idle' in info.clips ? 'idle' : Object.keys(info.clips)[0], t: 0.3, cam: 'game', file: `${name}_idle_game` });
    shots.push({ model: name, equip, clip: 'idle' in info.clips ? 'idle' : Object.keys(info.clips)[0], t: 0.3, cam: 'front', file: `${name}_idle_front` });
    for (const [clip, c] of Object.entries(info.clips)) {
      const ev = c.events ?? {};
      const t = ev.active != null ? (ev.active + 30) / 1000 : c.loop ? c.duration * 0.25 : c.duration * 0.6;
      shots.push({ model: name, equip, clip, t, cam: 'threequarter', file: `${name}_${clip}` , tele: ev.active != null && info.kind !== 'hero' ? 0.8 : 0 });
    }
  }
}

let current = null;
for (const s of shots) {
  const key = `${s.model}|${JSON.stringify(s.equip ?? null)}`;
  if (key !== current) {
    await page.evaluate(([m, e]) => window.viewer.model(m, e), [s.model, s.equip ?? null]);
    current = key;
  }
  if (s.equipOnly) await page.evaluate((e) => window.viewer.equip(e), s.equip);
  await page.evaluate(([c, t, y, cam, tele, z, ty]) => window.viewer.pose(c, t, y, cam, tele, z, ty), [s.clip, s.t ?? 0, s.yaw ?? 0, s.cam ?? 'threequarter', s.tele ?? 0, s.zoom ?? 1, s.ty ?? null]);
  const file = path.join(out, `${s.file ?? `${s.model}_${s.clip}`}.png`);
  await page.locator('canvas').screenshot({ path: file });
  console.log(file);
}
const info = await page.evaluate(() => window.viewer.info());
console.log(`dernier modèle : ${info.renderCalls} appels de rendu, ${info.triangles} triangles affichés`);
await browser.close();
await server.close();
