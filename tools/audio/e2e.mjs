// Test de bout en bout de l'audio (Playwright + Chromium SwiftShader, serveur Vite de dev) :
//   1. aucun AudioContext avant le premier geste (pas d'avertissement d'autoplay) ;
//   2. après un clic sur « Prendre son service », le contexte tourne et des sons sont planifiés ;
//   3. quelques secondes de jeu (coups, dash, sifflet) : aucune erreur ni avertissement audio en console ;
//   4. les options affichent la section Son (3 curseurs, couper le son).
//   node tools/audio/e2e.mjs
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
const server = await createServer({
  root,
  server: { port: 4196, strictPort: false },
  logLevel: 'error',
});
await server.listen();
const url = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await playwright.chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const problems = [];
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error') problems.push(`erreur : ${t}`);
  else if (m.type() === 'warning' && /audio|autoplay/i.test(t)) problems.push(`avertissement : ${t}`);
});
page.on('pageerror', (e) => problems.push(`exception : ${e.message}`));

// Compte les contextes et les nœuds sources créés, sans toucher au jeu.
await page.addInitScript(() => {
  const Native = window.AudioContext;
  window.__audio = { contexts: [], sources: 0 };
  window.AudioContext = class extends Native {
    constructor(...a) {
      super(...a);
      window.__audio.contexts.push(this);
    }
    createOscillator() {
      window.__audio.sources += 1;
      return super.createOscillator();
    }
    createBufferSource() {
      window.__audio.sources += 1;
      return super.createBufferSource();
    }
  };
});

const fail = (msg) => {
  console.error(`ÉCHEC : ${msg}`);
  process.exitCode = 1;
};

await page.goto(`${url}/play3d.html?q=bas&seed=7`);
await page.waitForSelector('.px-btn--primary', { timeout: 120000 });
await page.waitForTimeout(500);
const before = await page.evaluate(() => window.__audio.contexts.length);
if (before !== 0) fail(`${before} AudioContext créé(s) avant tout geste`);

// Options : la section Son existe.
await page.click('text=Options');
const sliders = await page.locator('.px-range input[type=range]').count();
const mute = await page.locator('text=Couper le son').count();
if (sliders !== 3 || mute !== 1) fail(`options du son incomplètes (${sliders} curseurs, ${mute} coupure)`);
const state1 = await page.evaluate(() => window.__audio.contexts[0]?.state ?? 'aucun');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

await page.click('text=Prendre son service');
await page.waitForTimeout(800);
const after = await page.evaluate(() => ({
  n: window.__audio.contexts.length,
  state: window.__audio.contexts[0]?.state ?? 'aucun',
  sources: window.__audio.sources,
}));
if (after.n !== 1) fail(`attendu 1 AudioContext après le clic, obtenu ${after.n}`);
if (after.state !== 'running') fail(`AudioContext dans l'état « ${after.state} » après le clic`);

// Un peu de jeu : coups, dash, sifflet.
for (let i = 0; i < 6; i += 1) {
  await page.keyboard.press('KeyJ');
  await page.waitForTimeout(220);
}
await page.keyboard.press('Space');
await page.waitForTimeout(300);
await page.keyboard.press('KeyF');
await page.waitForTimeout(1200);
const played = await page.evaluate(() => window.__audio.sources);
if (played <= after.sources) fail('aucun son planifié pendant le jeu');

// Pause (Échap) puis reprise : pas d'erreur.
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);

await browser.close();
await server.close();

console.info(
  JSON.stringify(
    {
      contextsAvantGeste: before,
      etatApresOptions: state1,
      etatApresClic: after.state,
      sourcesApresClic: after.sources,
      sourcesApresJeu: played,
      problemes: problems,
    },
    null,
    2,
  ),
);
if (problems.length) fail('erreurs en console');
if (!process.exitCode) console.info('OK : audio déverrouillé au clic, aucune erreur console.');
