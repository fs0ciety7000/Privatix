// Parcours de bout en bout des trois biomes (Playwright + Chromium SwiftShader, serveur Vite de dev,
// `?cheat&demo`) : un Shift complet — Quais & Voies, La Passerelle (Fluidifieur, Elio Di Rupo),
// Hall & BAG (Discosaure, Gontran Vanderslide) — jusqu'à l'écran des départs, avec captures.
//   node tools/biomes/e2e.mjs [dossier des captures]
// Échec (code 1) si une erreur console apparaît, si un boss n'est pas battu ou si le Shift ne se
// termine pas par une victoire.
import { mkdirSync } from 'node:fs';
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

const out = process.argv[2] ?? 'captures-biomes';
mkdirSync(out, { recursive: true });
const root = fileURLToPath(new URL('../..', import.meta.url));
const server = await createServer({
  root,
  server: { port: 4197, strictPort: false },
  logLevel: 'error',
});
await server.listen();
const url = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await playwright.chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`erreur : ${m.text()}`);
});
page.on('pageerror', (e) => problems.push(`exception : ${e.message}`));
const fail = (msg) => {
  console.error(`ÉCHEC : ${msg}`);
  process.exitCode = 1;
};

const quality = process.env.Q ?? 'haut';
const rm = process.env.RM === '1' ? '&rm=1' : '';
await page.goto(`${url}/play3d.html?cheat&demo&q=${quality}&seed=7${rm}`);
await page.waitForSelector('.px-btn--primary', { timeout: 180000 });
await page.waitForFunction(() => '__privatix3d' in window);

const api = (fn, ...args) => page.evaluate(([f, a]) => window.__privatix3d[f](...a), [fn, args]);
const state = () => api('state');
const advance = (ms) => api('advance', ms);
let shot = 0;
async function capture(name, settle = 450) {
  await page.waitForTimeout(settle);
  shot += 1;
  const file = `${out}/${String(shot).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: file });
  console.log(`capture : ${file}`);
}

// Laisse les GLB des biomes 2 et 3 finir de se charger en arrière-plan.
await page.waitForTimeout(1500);
await api('start');
await advance(400);
await api('cheat', 'G');
await advance(100);
await capture('b1-quai');

// Le Furet putride (élite du biome 1) : nuage de puanteur puis plongée sous le quai.
await api('waves', false);
await api('cheat', 'K');
await advance(300);
const furetId = await api('spawn', 'furet', 70, -70);
await advance(300);
await api('attack', furetId, 'stink');
await advance(700);
await capture('b1-furet-puanteur');
await api('attack', furetId, 'bite');
await advance(450);
await capture('b1-furet-morsure');
await api('waves', true);
await api('cheat', 'K');
await advance(300);

const seen = new Set();
const defeated = new Set();
let guard = 0;
while (guard < 500) {
  guard += 1;
  const s = await state();
  if (s.result) break;
  if (s.phase !== 'run') {
    await advance(200);
    continue;
  }
  if (s.choice) {
    await api('choose', 0);
    await advance(100);
    continue;
  }
  const key = `${s.room}:${s.roomType}`;
  if (!seen.has(key)) {
    seen.add(key);
    if (s.roomType === 'boss') {
      await boss(s.biome);
      continue;
    }
    await advance(900);
    const t = (await state()).roomType;
    if (s.localRoom === 1) await capture(`b${s.biome + 1}-salle-1`);
    if (t === 'repos' && s.biome > 0) await capture(`b${s.biome + 1}-pauses`);
    if (t === 'gardee') await gardee(s.biome);
  }
  if (!s.cleared) {
    await api('cheat', 'K');
    await advance(400);
    // Salles calmes : on utilise l'objet (café, pause) pour ouvrir les portes.
    const t = await state();
    if (!t.cleared && ['tresor', 'repos'].includes(t.roomType)) {
      await api('useProp');
      await advance(200);
    }
    continue;
  }
  await api('cheat', 'N');
  await advance(600);
}

async function gardee(biome) {
  await advance(1600);
  const s = await state();
  const g = s.guardian;
  if (!g) {
    fail(`Salle gardée du biome ${biome + 1} sans ennemi majeur`);
    return;
  }
  const enemies = await api('enemies');
  const me = enemies.find((e) => e.kind === g.kind);
  if (g.kind === 'fluidifieur') {
    await api('attack', me.id, 'slabs');
    await advance(700);
    await capture('b2-fluidifieur-roulement');
    await api('attack', me.id, 'glide');
    await advance(500);
    await capture('b2-fluidifieur-glissade');
  } else if (g.kind === 'discosaure') {
    await capture('b3-discosaure');
    await api('attack', me.id, 'spots');
    await advance(950);
    await capture('b3-discosaure-piste-orbite', 200);
    await advance(700);
    await capture('b3-discosaure-piste-figee', 200);
    await advance(1200);
    await api('hurt', me.id, 0.45);
    await advance(1600);
    await api('attack', me.id, 'lasers');
    await advance(1500);
    await capture('b3-discosaure-lasers');
    await api('attack', me.id, 'charge');
    await advance(600);
    await capture('b3-discosaure-charge');
  }
  defeated.add(g.kind);
  await api('cheat', 'K');
  await advance(500);
  if (g.kind === 'discosaure') await capture('b3-discosaure-paillettes', 150);
}

async function boss(biome) {
  // Le boss entre en scène 600 ms après l'entrée : on capture sa carte d'intro tout de suite.
  await advance(700);
  let s = await state();
  if (!s.boss) {
    fail(`pas de boss dans l'arène du biome ${biome + 1}`);
    return;
  }
  const kind = s.boss.kind;
  await capture(`b${biome + 1}-${kind}-intro`, 60);
  const enemies = await api('enemies');
  const me = enemies.find((e) => e.kind === kind);
  if (kind === 'dirupo') {
    await advance(1600);
    await api('attack', me.id, 'bowtie');
    await advance(1100);
    await capture('b2-dirupo-noeud-papillon');
    await advance(1500);
    await api('attack', me.id, 'promises');
    await advance(900);
    await capture('b2-dirupo-promesses');
    await advance(1400);
    await api('hurt', me.id, 0.5);
    await advance(1800);
    await api('attack', me.id, 'speech');
    await advance(2300);
    await capture('b2-dirupo-discours');
    await advance(2800);
    await api('hurt', me.id, 0.2);
    await advance(2000);
    await capture('b2-dirupo-ruban');
    await api('attack', me.id, 'scissors');
    await advance(700);
    await capture('b2-dirupo-ciseaux');
    await advance(1500);
  } else if (kind === 'vanderslide') {
    await advance(1600);
    await api('attack', me.id, 'bullets');
    await advance(700);
    await capture('b3-vanderslide-bullet-points');
    await advance(1500);
  }
  await api('cheat', 'K');
  await advance(1200);
  await capture(`b${biome + 1}-${kind}-defaite`, 200);
  await advance(2000);
  s = await state();
  if (s.boss && s.boss.hp > 0) fail(`${kind} pas battu`);
  defeated.add(kind);
}

await advance(4000);
await page.waitForTimeout(1500);
const end = await state();
await capture('departs', 800);
if (end.result?.end !== 'victoire') fail(`fin du Shift : ${JSON.stringify(end.result)}`);
for (const k of ['auditeur', 'fluidifieur', 'dirupo', 'discosaure', 'vanderslide'])
  if (!defeated.has(k)) fail(`${k} jamais rencontré`);
for (const p of problems) fail(p);
console.log(
  `salles traversées : ${seen.size} · vaincus : ${[...defeated].join(', ')} · fin : ${end.result?.end ?? '?'}`,
);
await browser.close();
await server.close();
