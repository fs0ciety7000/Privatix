// Rendu hors ligne des sons clés en WAV + mesures (crête, RMS, écrêtage), puisqu'on ne peut pas les
// écouter. Chromium (Playwright) exécute src/audio/offline.ts via le serveur Vite : même code de
// synthèse et même chaîne de mixage (compresseur + limiteur) que le jeu.
//   node tools/audio/render.mjs [dossier] [--only id1,id2]
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
const out = path.resolve(args.find((a) => !a.startsWith('--')) ?? 'audio-renders');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1].split(',') : null;
fs.mkdirSync(out, { recursive: true });

/** Sons rendus : [nom de fichier, type, paramètres]. */
const JOBS = [
  ['swing1', 'sfx', { id: 'swing1' }],
  ['swing2', 'sfx', { id: 'swing2' }],
  ['swing3', 'sfx', { id: 'swing3' }],
  ['slam', 'sfx', { id: 'slam' }],
  ['impact_heavy', 'sfx', { id: 'impact', amount: 1 }],
  ['hitPaper', 'sfx', { id: 'hitPaper' }],
  ['hitLaptop', 'sfx', { id: 'hitLaptop' }],
  ['crit', 'sfx', { id: 'crit' }],
  ['dash', 'sfx', { id: 'dash' }],
  ['whistle', 'sfx', { id: 'whistle' }],
  ['preavis', 'sfx', { id: 'preavis' }],
  ['coffeeSip', 'sfx', { id: 'coffeeSip' }],
  ['hurt', 'sfx', { id: 'hurt' }],
  ['burnoutUp', 'sfx', { id: 'burnoutUp' }],
  ['meltdown', 'sfx', { id: 'meltdown' }],
  ['telegraph', 'sfx', { id: 'telegraph' }],
  ['ticketFire', 'sfx', { id: 'ticketFire' }],
  ['chrono', 'sfx', { id: 'chrono' }],
  ['bossBarrier', 'sfx', { id: 'bossBarrier' }],
  ['bossStamp', 'sfx', { id: 'bossStamp' }],
  ['train', 'sfx', { id: 'train' }],
  ['explosion_big', 'sfx', { id: 'explosion', amount: 1 }],
  ['chime', 'sfx', { id: 'chime' }],
  ['doorUnlock', 'sfx', { id: 'doorUnlock' }],
  ['loot0_reforme', 'sfx', { id: 'loot0' }],
  ['loot2_homologue', 'sfx', { id: 'loot2' }],
  ['loot4_patrimoine', 'sfx', { id: 'loot4' }],
  ['death', 'sfx', { id: 'death' }],
  ['victory', 'sfx', { id: 'victory' }],
  ['uiClick', 'sfx', { id: 'uiClick' }],
  // Pire cas : 6 impacts lourds en rafale (le limiteur doit tenir).
  ['stress_impacts_x6', 'sfx', { id: 'impact', amount: 1, repeat: 6, spacing: 0.03 }],
  ['music_quai', 'music', { mode: 'quai', seconds: 12, intensity: 0 }],
  ['music_combat_low', 'music', { mode: 'combat', seconds: 12, intensity: 0.35 }],
  ['music_combat_high', 'music', { mode: 'combat', seconds: 12, intensity: 1 }],
  ['music_boss', 'music', { mode: 'boss', seconds: 12, intensity: 1, phase: 3 }],
  ['music_hub', 'music', { mode: 'hub', seconds: 14, intensity: 0 }],
];

function wav(left, right, sr) {
  const n = left.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i += 1) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
  }
  return buf;
}

const db = (v) => (v <= 1e-9 ? -Infinity : 20 * Math.log10(v));

function analyse(left, right, sr) {
  let peak = 0;
  let clipped = 0;
  let sum = 0;
  // RMS global et RMS de la fenêtre de 50 ms la plus forte.
  const win = Math.floor(sr * 0.05);
  let wsum = 0;
  let wmax = 0;
  let dsum = 0;
  for (let i = 0; i < left.length; i += 1) {
    if (i > 0) {
      const d = (left[i] - left[i - 1] + right[i] - right[i - 1]) / 2;
      dsum += d * d;
    }
    const l = left[i];
    const r = right[i];
    const a = Math.max(Math.abs(l), Math.abs(r));
    if (a > peak) peak = a;
    if (a >= 0.999) clipped += 1;
    const sq = (l * l + r * r) / 2;
    sum += sq;
    wsum += sq;
    if ((i + 1) % win === 0) {
      wmax = Math.max(wmax, Math.sqrt(wsum / win));
      wsum = 0;
    }
  }
  // Centroïde approché : pour un sinus de fréquence f, rms(dérivée discrète) / rms = 2 sin(πf / sr).
  const ratio = sum > 0 ? Math.sqrt(dsum / sum) : 0;
  const centroid = (sr / Math.PI) * Math.asin(Math.min(1, ratio / 2));
  return { peak, rms: Math.sqrt(sum / left.length), rmsMax: wmax, clipped, centroid };
}

const root = fileURLToPath(new URL('../..', import.meta.url));
const server = await createServer({
  root,
  server: { port: 4198, strictPort: false },
  logLevel: 'error',
});
await server.listen();
const url = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await playwright.chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${url}/tools/audio/render.html`);
await page.waitForFunction(() => window.offlineReady === true, null, { timeout: 60000 });

const rows = [];
for (const [name, kind, p] of JOBS) {
  if (only && !only.includes(name)) continue;
  const res = await page.evaluate(
    async ({ kind, p }) => {
      const o = window.offline;
      return kind === 'music'
        ? await o.renderMusic(p.mode, p.seconds, p.intensity, p.phase ?? 1)
        : await o.renderSfx(p.id, { amount: p.amount, repeat: p.repeat, spacing: p.spacing });
    },
    { kind, p },
  );
  fs.writeFileSync(path.join(out, `${name}.wav`), wav(res.left, res.right, res.sampleRate));
  const a = analyse(res.left, res.right, res.sampleRate);
  rows.push({
    name,
    seconds: +(res.left.length / res.sampleRate).toFixed(2),
    peakDb: +db(a.peak).toFixed(1),
    rmsDb: +db(a.rms).toFixed(1),
    rmsMax50msDb: +db(a.rmsMax).toFixed(1),
    rawPeakDb: res.rawPeak ? +db(res.rawPeak).toFixed(1) : null,
    centroidHz: Math.round(a.centroid),
    clippedSamples: a.clipped,
  });
}
await browser.close();
await server.close();

console.table(rows);
fs.writeFileSync(path.join(out, 'levels.json'), JSON.stringify(rows, null, 2));
if (errors.length) {
  console.error('Erreurs de la page :', errors);
  process.exitCode = 1;
}
if (rows.some((r) => r.clippedSamples > 0 || r.peakDb > -0.5)) {
  console.error('Écrêtage détecté.');
  process.exitCode = 1;
}
