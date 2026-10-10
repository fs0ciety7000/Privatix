// Vérifie l'OST et les dialogues enregistrés dans le vrai jeu (Playwright + Chromium, serveur Vite) :
// fichiers requis par le réseau, morceaux joués par contexte, voix, silence du coup final de Lurcke,
// aucune erreur console.
//   node tools/audio/samples-check.mjs
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

const root = fileURLToPath(new URL('../..', import.meta.url));
const server = await createServer({ root, server: { port: 4198, strictPort: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await playwright.chromium.launch({
  args: [
    '--use-gl=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const problems = [];
const audioRequests = [];
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`erreur : ${m.text()}`);
  if (m.type() === 'warning' && m.text().includes('[audio]')) problems.push(`audio : ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`exception : ${e.message}`));
page.on('response', (r) => {
  const u = new URL(r.url());
  if (u.pathname.startsWith('/audio/')) audioRequests.push(`${String(r.status())} ${u.pathname}`);
});
let failed = false;
const fail = (msg) => {
  console.error(`ÉCHEC : ${msg}`);
  failed = true;
};

await page.goto(`${url}/play3d.html?demo&cheat&fixed&seed=1&q=bas`);
await page.waitForSelector('.px-btn--primary', { timeout: 180000 });
await page.waitForFunction(() => '__privatix3d' in window);
const api = (fn, ...args) => page.evaluate(([f, a]) => window.__privatix3d[f](...a), [fn, args]);
const audio = () => api('audio');
async function waitAudio(pred, label, ms = 20000) {
  const t0 = Date.now();
  let s = await audio();
  while (!pred(s)) {
    if (Date.now() - t0 > ms) {
      fail(`${label} : ${JSON.stringify(s)}`);
      return s;
    }
    await page.waitForTimeout(250);
    s = await audio();
  }
  console.log(`ok : ${label} → ${s.context} / ${String(s.track)}`);
  return s;
}

// Premier geste : déverrouille l'audio (écran titre).
await page.mouse.click(5, 5);
await waitAudio((s) => s.running, 'contexte audio déverrouillé');
await waitAudio((s) => s.track === 'ost.01-prise-de-poste', 'écran titre');

// Shift : biome 1 (exploration puis combat).
await api('start');
await api('cheat', 'G');
await waitAudio(
  (s) => s.track === 'ost.04-quais-exploration' || s.track === 'ost.05-quais-combat',
  'biome 1',
);
// Voix chargées (Léon, Yasmina) : un coup de clé fait entendre l'effort de Léon.
await page.waitForTimeout(3000);
await api('press', 'attack');
await api('advance', 200);
await page.waitForTimeout(400);
const afterSwing = await audio();
console.log(`voix après un coup : ${afterSwing.voices.join(', ')}`);
if (!afterSwing.voices.some((v) => v.startsWith('vo.leon.') || v.startsWith('vo.yasmina.')))
  fail('aucune voix de Léon ou de Yasmina');

// Boss du biome 1.
await api('cheat', 'B');
await waitAudio((s) => s.track === 'ost.08-boss-auditeur', 'boss Auditeur');

// Biome 3 (Hall & BAG) puis Lurcke, coup final.
await api('waves', false);
await api('cheat', 'K');
await api('biome', 2);
await waitAudio((s) => s.track === 'ost.07-hall-bag', 'Hall & BAG', 30000);
await api('waves', true);
await api('cheat', 'B');
await api('advance', 900);
await waitAudio((s) => s.track === 'ost.11-boss-lurcke', 'boss Lurcke', 30000);
await page.waitForTimeout(3000);
const lurcke = (await api('enemies')).find((e) => e.kind === 'lurcke');
if (lurcke) {
  await api('hurt', lurcke.id, 0.2);
  await api('advance', 2500);
  await api('hurt', lurcke.id, 0.04);
  await waitAudio((s) => s.context === 'silence' && s.track === null, 'silence du coup final');
  await page.waitForTimeout(1500);
  const s = await audio();
  console.log(`voix au coup final : ${s.voices.slice(-3).join(', ')}`);
  if (s.context !== 'silence') fail(`le silence n'a pas tenu : ${s.context}`);
  // Victoire : écran des départs.
  await api('cheat', 'K');
  await api('advance', 8000);
  await waitAudio((st) => st.track === 'ost.12-departs-victoire', 'écran des départs (victoire)', 30000);
} else fail('Lurcke absent');

await page.waitForTimeout(500);
const music = audioRequests.filter((r) => r.includes('/audio/music/'));
const vo = audioRequests.filter((r) => r.includes('/audio/vo/'));
console.log(`réseau : ${String(music.length)} morceaux, ${String(vo.length)} répliques`);
for (const r of music) console.log(`  ${r}`);
if (audioRequests.some((r) => !r.startsWith('200') && !r.startsWith('304')))
  fail(`requêtes en échec : ${audioRequests.filter((r) => !r.startsWith('20')).join(', ')}`);
if (music.length === 0 || vo.length === 0) fail('aucun fichier audio requis');
for (const p of problems) fail(p);

// ?procedural : synthèse seule, aucun fichier audio demandé.
await page.close();
const procRequests = [];
const page2 = await browser.newPage({ viewport: { width: 960, height: 540 } });
page2.on('response', (r) => {
  if (new URL(r.url()).pathname.startsWith('/audio/')) procRequests.push(r.url());
});
await page2.goto(`${url}/play3d.html?demo&procedural&seed=1&q=bas`);
await page2.waitForSelector('.px-btn--primary', { timeout: 180000 });
await page2.waitForFunction(() => '__privatix3d' in window);
await page2.mouse.click(5, 5);
await page2.waitForTimeout(3000);
const proc = await page2.evaluate(() => window.__privatix3d.audio());
if (procRequests.length > 0) fail(`?procedural : fichiers demandés : ${procRequests.join(', ')}`);
else if (proc.running && proc.track === null && !proc.synthMuted)
  console.log('ok : ?procedural → synthèse seule, aucun fichier demandé');
else fail(`?procedural : ${JSON.stringify(proc)}`);
await browser.close();
await server.close();
if (failed) process.exit(1);
console.log('Audio enregistré : OK');
