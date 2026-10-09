// Lot TÉMOIN (sans clé d'API) : rend avec le moteur audio du jeu (synthèse Web Audio de src/audio/,
// via src/audio/offline.ts dans Chromium) les extraits du lot d'écoute, réglés selon les fiches de
// docs/audio/AUDIO_BIBLE.md. Ce ne sont PAS des rendus ElevenLabs : ils montrent la direction
// (tempo, tonalité, couches, motifs) en attendant la clé.
//   node tools/elevenlabs/temoins.mjs <dossier>
// Produit : musique_occ-jour_20s.ogg, musique_quais-combat-couches_20s.ogg, sfx_<id>.ogg (4) et
// mesures.json (sonie, crête). Modèle : tools/trailer/audio.mjs.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
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

const OUT = path.resolve(process.argv[2] ?? 'temoins-audio');
fs.mkdirSync(OUT, { recursive: true });
const FFMPEG = fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : 'ffmpeg';
const SR = 48000;

/** Fiche OST n° 2 « OCC — Service de jour » : 74 BPM, Fa maj7 – Mi m7 – Ré m7 – Do maj7, radio, cafetière. */
const OCC_JOUR = {
  seconds: 20,
  sections: [{ from: 0, to: 20, fadeIn: 0.01, fadeOut: 1.2, reverb: 0.18, reverbSeconds: 1.6 }],
  directors: [
    {
      section: 0,
      cues: [{ at: 0, mode: 'hub', resync: true }],
      gain: [
        [0, 0],
        [1.2, 1],
        [18.6, 1],
        [20, 0],
      ],
    },
  ],
  events: [
    { id: 'x:crackle', at: 1.6, section: 0, db: -4, pan: -0.35 },
    { id: 'chime', at: 2.2, section: 0, db: -14 },
    { id: 'x:gurgle', at: 7.5, section: 0, db: 2, pan: 0.2 },
    { id: 'x:radioVoice', at: 11.2, dur: 1.8, section: 0, db: -14, pan: -0.35 },
    { id: 'x:crackle', at: 13.4, section: 0, db: -6, pan: -0.35 },
    { id: 'x:gurgle', at: 16.8, section: 0, db: 0, pan: 0.2 },
  ],
};

/**
 * Fiche OST n° 5 « Quais & Voies — Combat » : 100 BPM, ré mineur, les 4 couches s'ouvrent toutes les
 * 5 s comme en jeu (S1 basse 0–5 s, + S2 grosse caisse, + S3 charleston, + S4 arpège à 15 s).
 */
const QUAIS_COMBAT = {
  seconds: 20,
  sections: [{ from: 0, to: 20, fadeIn: 0.01, fadeOut: 0.8, reverb: 0.2, reverbSeconds: 1.8 }],
  directors: [
    {
      section: 0,
      cues: [
        { at: 0, mode: 'combat', intensity: 0.07, tempo: 1, tau: 0.05, resync: true },
        { at: 4.8, intensity: 0.45 },
        { at: 9.6, intensity: 0.7 },
        { at: 14.4, intensity: 1 },
      ],
      gain: [
        [0, 0.9],
        [14.4, 1.05],
        [20, 1.05],
      ],
    },
  ],
  events: [
    { id: 'whistle', at: 0.05, section: 0, db: -6 },
    { id: 'x:riser', at: 12.4, dur: 2, section: 0, db: -12 },
  ],
};

const SFX = [
  ['slam', { id: 'slam' }, 'Coup 3 sur le rail (BONG), signature de combat'],
  ['coffeeSip', { id: 'coffeeSip' }, 'Gorgée de café (Gobelet)'],
  ['telegraph', { id: 'telegraph', amount: 1 }, 'Télégraphe de boss (bip montant, grave)'],
  ['train', { id: 'train' }, 'Rame qui traverse la voie'],
];

function writeWav(file, L, R) {
  const n = L.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  let o = 44;
  for (let i = 0; i < n; i += 1)
    for (const v of [L[i], R[i]]) {
      buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), o);
      o += 2;
    }
  fs.writeFileSync(file, buf);
}
const sh = (args) =>
  execFileSync('/bin/sh', ['-c', `"${FFMPEG}" ${args.map((x) => `'${x}'`).join(' ')} 2>&1`], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
  });
function measure(file) {
  const t = sh([
    '-hide_banner',
    '-nostats',
    '-i',
    file,
    '-af',
    'loudnorm=print_format=json',
    '-f',
    'null',
    '-',
  ]);
  const j = JSON.parse(t.match(/\{[\s\S]*?\}/)[0]);
  const v = sh(['-hide_banner', '-nostats', '-i', file, '-af', 'volumedetect', '-f', 'null', '-']);
  return {
    lufs: +j.input_i,
    truePeak: +j.input_tp,
    peak: +(v.match(/max_volume:\s*(-?[\d.]+)/)?.[1] ?? 0),
  };
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
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${url}/tools/audio/render.html`);
await page.waitForFunction(() => window.offlineReady === true, null, { timeout: 60000 });

const enc = `(r) => { const n = r.left.length; const f = new Float32Array(n * 2);
  for (let i = 0; i < n; i += 1) { f[2 * i] = r.left[i]; f[2 * i + 1] = r.right[i]; }
  const u = new Uint8Array(f.buffer); let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s); }`;
const dec = (b64) => {
  const f = new Float32Array(new Uint8Array(Buffer.from(b64, 'base64')).buffer);
  const n = f.length / 2;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    L[i] = f[2 * i];
    R[i] = f[2 * i + 1];
  }
  return { L, R };
};

const jobs = [
  [
    'musique_occ-jour_20s',
    'music',
    OCC_JOUR,
    'OST n° 2 « OCC — Service de jour » (74 BPM, Fa maj7 – Mi m7 – Ré m7 – Do maj7)',
  ],
  [
    'musique_quais-combat-couches_20s',
    'music',
    QUAIS_COMBAT,
    'OST n° 5 « Quais & Voies — Combat » (100 BPM, ré mineur, couches S1 → S4 toutes les 4,8 s)',
  ],
  ...SFX.map(([name, spec, label]) => [`sfx_${name}`, 'sfx', spec, label]),
];
const report = [];
for (const [name, kind, spec, label] of jobs) {
  const b64 = await page.evaluate(
    async ({ kind, spec, enc }) => {
      const e = eval(enc);
      const o = window.offline;
      if (kind === 'music') return e(await o.renderMusicTimeline(spec));
      return e(await o.renderSfx(spec.id, { amount: spec.amount ?? 0 }));
    },
    { kind, spec, enc },
  );
  const { L, R } = dec(b64);
  const wav = path.join(OUT, `.${name}.wav`);
  writeWav(wav, L, R);
  const ogg = path.join(OUT, `${name}.ogg`);
  // Musique : −16 LUFS (cible de la bible), gain fixe (pas de normalisation dynamique : on garde la montée des couches). Effets : crête à −3 dBFS pour l'écoute isolée.
  const af =
    kind === 'music'
      ? `volume=${(-16 - measure(wav).lufs).toFixed(2)}dB,alimiter=limit=0.84:level=false,aresample=48000`
      : `volume=${(-3 - measure(wav).peak).toFixed(2)}dB`;
  sh([
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    wav,
    '-af',
    af,
    '-c:a',
    'libvorbis',
    '-q:a',
    '6',
    ogg,
  ]);
  fs.rmSync(wav);
  const m = measure(ogg);
  report.push({ file: `${name}.ogg`, label, seconds: +(L.length / SR).toFixed(2), ...m });
  console.log(`${name}.ogg  ${(L.length / SR).toFixed(1)} s  ${m.lufs} LUFS  crête ${m.peak} dBFS`);
}
await browser.close();
await server.close();
if (errors.length) throw new Error(errors.join(' | '));
fs.writeFileSync(path.join(OUT, 'mesures.json'), `${JSON.stringify(report, null, 2)}\n`);
