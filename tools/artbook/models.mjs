// Rendus des model sheets : turnarounds (face, 3/4, profil, dos), poses clés et tenues de rareté,
// sur fond transparent, depuis la visionneuse toon de tools/render3d/viewer (mode `?shot&portrait`).
//   node tools/artbook/models.mjs [--only hero,furet] [--size 900]
// Sortie : tools/artbook/.cache/models/<id>/turn-<i>.png, pose-<i>.png ; .cache/models/tenues/…
import fs from 'node:fs';
import path from 'node:path';
import { CACHE, CHROMIUM_ARGS, ROOT, cli, playwright, vite } from './lib.mjs';

const { opt, only } = cli();
const size = +opt('--size', 1000);
const spec = JSON.parse(fs.readFileSync(new URL('./characters.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/models/manifest.json'), 'utf8'));
const out = path.join(CACHE, 'models');

/** Vues du turnaround : lacet ajouté à la caméra « front » (élévation 6°, cadrage constant). */
export const TURN = [
  ['Face', 0],
  ['3/4', 40],
  ['Profil', 90],
  ['Dos', 180],
];

/** Moment clé d'un clip quand la spec ne le donne pas (événements du manifeste). */
function keyTime(model, clip) {
  const c = manifest.characters[model].clips[clip];
  if (!c) throw new Error(`${model} : clip inconnu ${clip}`);
  const ev = c.events ?? {};
  if (ev.active != null) return Math.min(c.duration - 0.01, (ev.active + 40) / 1000);
  if (/death|defeat/.test(clip)) return c.duration - 0.02;
  if (clip === 'spawn') return ev.land != null ? ev.land / 1000 + 0.05 : c.duration * 0.7;
  return c.duration * 0.5;
}

const viewerRoot = path.join(ROOT, 'tools/render3d/viewer');
const { createServer } = await vite();
const server = await createServer({ root: viewerRoot, configFile: path.join(viewerRoot, 'vite.config.js'), server: { port: 4196, strictPort: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
const browser = await playwright().chromium.launch({ args: CHROMIUM_ARGS });
const page = await browser.newPage({ viewport: { width: size, height: size } });
page.on('pageerror', (e) => console.error('[page]', e.message));
await page.goto(`${url}?shot&portrait&w=${size}&h=${size}&ow=${(size / 520).toFixed(2)}`);
await page.waitForFunction(() => window.viewerReady === true, null, { timeout: 180000 });
await page.addStyleTag({ content: 'html, body, #app { background: transparent !important; }' });

async function shot(file, clip, t, yaw, cam, tele, zoom) {
  await page.evaluate(([c, tt, y, cm, te, z]) => window.viewer.pose(c, tt, y, cm, te, z, null), [clip, t, yaw, cam, tele, zoom]);
  await page.locator('canvas').screenshot({ path: file, omitBackground: true });
}

const restClip = (m) => (manifest.characters[m].clips.idle ? 'idle' : Object.keys(manifest.characters[m].clips)[0]);

for (const c of spec.characters) {
  if (only.length && !only.includes(c.id)) continue;
  const dir = path.join(out, c.id);
  fs.mkdirSync(dir, { recursive: true });
  await page.evaluate(([m, e]) => window.viewer.model(m, e), [c.model, c.equip ?? null]);
  await page.evaluate((o) => window.viewer.stage(o), c.stage ?? {});
  const rest = restClip(c.model);
  for (const [i, [, yaw]] of TURN.entries()) await shot(path.join(dir, `turn-${i}.png`), rest, 0, yaw, 'front', 0, c.turnZoom ?? 0.8);
  const enemy = !['hero', 'npc'].includes(c.role);
  for (const [i, [label, clip, t]] of c.poses.entries()) {
    const tt = t ?? keyTime(c.model, clip);
    const tele = enemy && /attack|charge|stomp|tickets|stamp|bowtie|swipe|smile|binder|spin|bite|report|chrono/.test(clip) && !/Idle/.test(label) ? 1 : 0;
    await shot(path.join(dir, `pose-${i}.png`), clip, tt, c.poseYaw ?? -25, 'threequarter', tele, c.poseZoom ?? 0.66);
  }
  console.log(`${c.id} : ${TURN.length} vues, ${c.poses.length} poses`);
}

if (!only.length || only.includes('tenues')) {
  const dir = path.join(out, 'tenues');
  fs.mkdirSync(dir, { recursive: true });
  await page.evaluate(() => window.viewer.model('hero', null));
  for (const t of spec.tenues) {
    await page.evaluate((e) => window.viewer.equip(e), t.equip);
    await page.evaluate((o) => window.viewer.stage(o), { rimA: t.color, rimB: '#6ff3ff' });
    for (const [i, [, yaw]] of TURN.entries()) await shot(path.join(dir, `rar-${t.rar}-${i}.png`), 'idle', 0, yaw, 'front', 0, 0.48);
    await shot(path.join(dir, `rar-${t.rar}-hero.png`), 'attack2', 0.08, -40, 'portrait', 0, 0.52);
    console.log(`tenue ${t.name}`);
  }
}

await browser.close();
await server.close();
