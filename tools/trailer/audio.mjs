// Bande-son du trailer « Le Shift » (60 s), entièrement synthétisée par le moteur audio du jeu.
//   node tools/trailer/audio.mjs [dossier] [--endcard-only]
// Produit dans le dossier : music.wav, sfx.wav (pistes séparées, non masterisées), mix.wav et
// mix.ogg (masterisés : −14 LUFS intégrés, crête vraie ≤ −1 dBTP), endcard.wav (55–60 s, pour
// re-muxer la carte de fin seule), cues.json (événements et grille de temps pour le monteur),
// analysis.json, spectrogram.png, waveform.png et intensity.png (courbe obtenue contre le script).
// Chromium (Playwright) exécute src/audio/offline.ts via le serveur Vite : même code de synthèse
// que le jeu (`MusicDirector`, `SFX`), aucun fichier audio externe.
// Référence : SCRIPT.md du trailer, § 5 (bande-son) et § 3.3 (plans).
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

const args = process.argv.slice(2);
const OUT = path.resolve(args.find((a) => !a.startsWith('--')) ?? 'trailer-audio');
const ENDCARD_ONLY = args.includes('--endcard-only');
fs.mkdirSync(OUT, { recursive: true });

const SR = 48000;
const SECONDS = 60;
const FFMPEG = fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : 'ffmpeg';

// ─── Repères du script ──────────────────────────────────────────────────────
const SILENCE = [40.4, 41.4];
const IMPACT = 41.4;
/** Actes (pour les mesures). */
const ACTS = [
  ['I. Prise de poste', 0, 8],
  ['II. Premier train supprimé', 8, 20],
  ['III. Le Shift déborde', 20, 40.4],
  ['', 40.4, 41.4],
  ['III. Coup final', 41.4, 45],
  ['IV. Fin de service', 45, 55],
  ['V. Carte de fin', 55, 60],
];
/** Courbe d'intensité du script (§ 5.1), 0 à 10 : points [temps, valeur]. */
const TARGET = [
  [0, 1],
  [8, 2],
  [8.01, 3],
  [12, 4],
  [16, 5],
  [20, 6],
  [20.01, 7],
  [31, 8],
  [34, 9],
  [39.4, 10],
  [40.39, 10],
  [40.4, 0],
  [41.39, 0],
  [41.4, 3],
  [45, 2],
  [55, 1],
  [57, 3],
  [59.9, 2],
  [60, 0],
];

/**
 * Carte de fin : texte à l'écran et temps d'entrée (le son ne dépend pas du texte ; changer ce
 * texte ne demande que `--endcard-only`, qui réécrit cues.json et endcard.wav sans re-rendre).
 */
const ENDCARD = {
  title: { at: 55.0, text: 'PRIVATIX' },
  line1: { at: 55.6, text: 'Ils veulent privatiser le rail. Toi, t’as une clé à tire-fond.' },
  line2: { at: 56.5, text: 'Le rail n’est pas à vendre.' },
  cta: { at: 57.0, text: 'Jouer dans le navigateur · privatix.fs0ciety.org' },
  logo: { at: 58.0, text: 'OCC Interactive · une division de CARDOR Media' },
  end: { at: 60.0, text: '(noir)' },
};

// ─── Musique : quatre directeurs du jeu, pilotés dans le temps ─────────────
// Tempos : hub 74 BPM (jeu) ; combat 100 (acte II) → 104 (acte III) → Discosaure 110 ;
// boss 112 → 116 → 120 (+4 par phase, comme en jeu) ; hub final ralenti à 60 BPM.
const HUB_END_CHORDS = [
  [53, 57, 60, 64], // Fa maj7 (accord du jeu)
  [50, 54, 57, 62], // Ré majeur : résolution sous C6 (0:49)
  [53, 57, 60, 64],
  [50, 54, 57, 62, 64], // Ré majeur (9) : fanfare sur le bouton (0:57)
];
const SECTIONS = [
  // A : tout jusqu'au silence (queues de réverbération comprises) ; B : du coup final à la fin.
  { from: 0, to: SILENCE[0], fadeIn: 0.005, fadeOut: 0.06, reverb: 0.22, reverbSeconds: 1.8 },
  { from: SILENCE[1], to: SECONDS, fadeIn: 0.002, fadeOut: 0.015, reverb: 0.2, reverbSeconds: 2.2 },
];

const DIRECTORS = [
  {
    // Acte I : OCC, piano électrique et radio du jeu ; coupé net sur le sifflet.
    name: 'hub I',
    section: 0,
    cues: [{ at: 0, mode: 'hub', resync: true }],
    gain: [
      [0, 0],
      [0.8, 0.75],
      [7.0, 1],
      [7.94, 1],
      [8.0, 0],
    ],
  },
  {
    // Actes II–III : quai, combat, Discosaure, boss.
    name: 'combat',
    section: 0,
    cues: [
      { at: 6.6, mode: 'quai', intensity: 0 }, // le couloir froid derrière la porte
      { at: 8.0, mode: 'combat', intensity: 0.12, tempo: 1, resync: true },
      { at: 12.0, intensity: 0.45 }, // + grosse caisse
      { at: 16.0, intensity: 0.7 }, // + charleston
      { at: 18.8, intensity: 0.74 },
      { at: 20.0, intensity: 1, tempo: 1.04, tau: 0.02, resync: true }, // drop : toutes les couches
      { at: 20.6, tau: 0.6 },
      { at: 30.4, tempo: 1.1, resync: true }, // Discosaure : la caisse sur chaque noire
      { at: 34.2, mode: 'boss', intensity: 1, phase: 1, tempo: 1, resync: true },
      { at: 37.2, phase: 2, resync: true },
      { at: 38.6, phase: 3, resync: true },
      { at: 40.45, mode: 'off' },
    ],
    gain: [
      [6.6, 0],
      [7.9, 0.35],
      [8.0, 1.0],
      [19.6, 1.0],
      [19.96, 0.3],
      [20.0, 1.15],
      [33.56, 1.15],
      [33.62, 0.05],
      [34.16, 0.05],
      [34.2, 1.25],
      [40.4, 1.3],
    ],
  },
  {
    // Après le coup : le bourdon du quai, seul, qui s'efface sous l'écran des départs.
    name: 'quai',
    section: 1,
    cues: [
      { at: SILENCE[1], mode: 'quai', intensity: 0 },
      { at: 47, mode: 'off' },
    ],
    gain: [
      [41.4, 2.2],
      [44.4, 2.0],
      [46.4, 0],
    ],
  },
  {
    // Actes IV–V : le hub, plus lent, réharmonisé vers ré majeur.
    name: 'hub II',
    section: 1,
    cues: [
      { at: 45.0, mode: 'hub', tempo: 60 / 74, hubChords: HUB_END_CHORDS, resync: true },
      { at: 57.3, mode: 'off' }, // dernier accord à 57,0 : il sonne jusqu'à la coupe
    ],
    gain: [
      [44.9, 0],
      [45.0, 0],
      [46.0, 1.1],
      [49.0, 1.2],
      [54.5, 0.95],
      [56.8, 0.95],
      [57.0, 1.2],
      [60, 1.2],
    ],
  },
];

/** Éléments musicaux propres au trailer (même synthèse que le jeu) : montée, note tenue finale. */
const MUSIC_EVENTS = [
  { id: 'x:riser', at: 17.6, dur: 2.4, section: 0, db: -8 },
  { id: 'x:held', at: 45.4, dur: 11.4, notes: [45], section: 1, db: -2 }, // nappe de la (Fa maj7 / Ré)
  { id: 'x:held', at: 57.0, dur: 2.6, notes: [50, 57], section: 1, db: 9 },
];

// ─── Effets placés (§ 5.2 + gestes de jeu des plans) ───────────────────────
// key : effet clé du § 5.2 (à caler par le monteur) ; flash : flash blanc autorisé (§ 6.2).
const SFX_EVENTS = [
  // Acte I
  {
    id: 'x:radioVoice',
    at: 0.8,
    dur: 2.0,
    db: -10,
    pan: -0.35,
    label: 'Radio grésillante sous C1',
  },
  { id: 'x:crackle', at: 2.9, db: -6, pan: -0.35 },
  { id: 'x:gurgle', at: 3.0, db: 6, pan: 0.15, key: true, label: 'Gargouillis de la Vieille Dame' },
  { id: 'coffeeCup', at: 3.9, db: -6, pan: 0.1 },
  { id: 'coffeeSip', at: 4.6, db: 0, key: true, label: '« Slurp » + soupir' },
  { id: 'x:crackle', at: 6.1, db: -8, pan: -0.4 },
  { id: 'doorUnlock', at: 7.3, db: -6, label: 'Porte de départ' },
  // Acte II
  {
    id: 'whistle',
    at: 8.0,
    db: 2,
    key: true,
    label: 'Sifflet du chef de gare (attaque de l’acte II)',
  },
  { id: 'spawn', at: 8.55, db: -2, pan: -0.3 },
  { id: 'spawn', at: 8.63, db: -2, pan: 0 },
  { id: 'spawn', at: 8.71, db: -2, pan: 0.3 },
  { id: 'swing1', at: 10.0, label: 'Premier « clang » (coupe)', key: true },
  { id: 'hitPaper', at: 10.05 },
  { id: 'swing2', at: 10.8 },
  { id: 'hitPaper', at: 10.85, pan: 0.05 },
  { id: 'swing3', at: 11.52 },
  { id: 'slam', at: 11.6, db: 2, key: true, flash: true, label: 'BONG métal sur rail (coup 3)' },
  { id: 'kill', at: 11.66, db: -3 },
  { id: 'ticketFire', at: 11.9, db: -2, label: 'Salve de la Borne' },
  { id: 'swing3', at: 12.45 },
  { id: 'ticketTear', at: 12.5, db: -1, pan: -0.15 },
  { id: 'ticketTear', at: 12.56, db: -1, pan: 0.15 },
  { id: 'hurt', at: 13.35, db: -5, pan: 0.15 },
  { id: 'coffeeSip', at: 13.7, db: -1, label: 'Café en plein combat' },
  { id: 'droneDive', at: 14.8, db: -3, pan: 0.15 },
  { id: 'dash', at: 15.28 },
  { id: 'perfectDash', at: 15.4, db: 1, key: true, label: 'Carillon du dash parfait (+15 min)' },
  {
    id: 'whistle',
    at: 16.4,
    rate: 1.05,
    db: 2,
    key: true,
    label: 'Coup de sifflet (onde de choc)',
  },
  { id: 'ringPulse', at: 16.45, db: -4 },
  { id: 'swing3', at: 17.95 },
  {
    id: 'lastKill',
    at: 18.2,
    db: 1,
    key: true,
    flash: true,
    label: 'Carillon « ding-dong » du dernier kill',
  },
  { id: 'kill', at: 18.22, db: -4 },
  // Acte III
  { id: 'loot4', at: 20.0, db: 3, key: true, label: 'Drop de Patrimoine (carillon cuivré)' },
  { id: 'x:subDrop', at: 20.0, db: -9 },
  { id: 'lootEquip', at: 21.75, db: -1 },
  { id: 'swing3', at: 22.25 },
  { id: 'hitPaper', at: 22.3 },
  { id: 'hazardThud', at: 22.85, db: -2, label: 'Plaque d’égout soulevée' },
  { id: 'stinkPuff', at: 23.05, db: -1, pan: -0.1 },
  { id: 'stinkPuff', at: 23.7, db: -3, pan: 0.2 },
  { id: 'dash', at: 24.5 },
  { id: 'swingDash', at: 24.62 },
  { id: 'hitPaper', at: 24.66, db: 1, label: 'Attaque de correspondance' },
  {
    id: 'x:larsen',
    at: 25.6,
    db: -2,
    key: true,
    label: 'Larsen de micro (intro de l’Invité d’honneur)',
  },
  { id: 'telegraph', at: 27.75, db: -4 },
  { id: 'dash', at: 28.05, pan: -0.1 },
  { id: 'ribbonSnip', at: 28.2, db: 1, key: true, label: '« Snip » des ciseaux' },
  { id: 'ticketTear', at: 29.15, db: -6, pan: -0.2, label: 'Confettis (défaite digne)' },
  { id: 'ticketTear', at: 29.25, db: -6, pan: 0.2 },
  {
    id: 'discoShimmer',
    at: 30.4,
    db: 1,
    key: true,
    label: 'Scintillement disco (1er temps du Discosaure)',
  },
  { id: 'hazardThud', at: 30.4, db: -1, label: 'Piétinement sur le temps' },
  { id: 'ringPulse', at: 30.42, db: -6 },
  { id: 'hazardThud', at: 31.491, db: -1, label: 'Piétinement sur le temps' },
  { id: 'ringPulse', at: 31.51, db: -6 },
  { id: 'kpiZap', at: 32.0, db: -2, pan: -0.4, label: 'Lasers' },
  { id: 'kpiZap', at: 32.2, db: -2, pan: 0.4 },
  { id: 'dash', at: 32.25, pan: -0.15 },
  { id: 'dash', at: 32.47, pan: 0.15 },
  { id: 'discoShimmer', at: 32.582, db: -1, cutAt: 33.6 },
  { id: 'hazardThud', at: 32.582, db: -1 },
  { id: 'swing3', at: 33.4 },
  { id: 'hitMetal', at: 33.45 },
  {
    id: 'explosion',
    at: 33.6,
    amount: 1,
    lowpass: 650,
    db: 1,
    key: true,
    flash: false,
    label: 'Boule cassée, la salle s’éteint',
  },
  { id: 'bossStamp', at: 34.2, db: -1, key: true, label: 'Entrée de Jean-Cul Lurcke (bandeau)' },
  { id: 'ticketFire', at: 34.75, db: -4, pan: -0.3, label: 'Bullet points' },
  { id: 'ticketFire', at: 35.0, db: -4, pan: 0 },
  { id: 'ticketFire', at: 35.25, db: -4, pan: 0.3 },
  { id: 'spawn', at: 36.4, pan: -0.25, label: '« Je vous mets en copie »' },
  { id: 'spawn', at: 36.47, pan: 0.25 },
  { id: 'swing3', at: 36.78 },
  { id: 'slam', at: 36.85, db: 0, label: 'Coup 3 sur les deux consultants' },
  { id: 'kill', at: 36.9, pan: -0.2, db: -4 },
  { id: 'kill', at: 36.93, pan: 0.2, db: -4 },
  {
    id: 'bossPhase',
    at: 37.2,
    db: 2,
    key: true,
    flash: true,
    label: 'Phase 2 : annonce de quai distordue',
  },
  { id: 'preavis', at: 37.9, db: 1, key: true, label: 'Trompette + mégaphone du Préavis' },
  { id: 'dash', at: 38.9 },
  { id: 'swingDash', at: 39.0 },
  // Silence 40,4–41,4 : rien. Puis le coup final, seul son au-dessus de −6 dBFS.
  {
    id: 'hitBoss',
    at: IMPACT,
    db: 6,
    section: 1,
    reverb: 0.5,
    reverbSeconds: 2.2,
    key: true,
    flash: true,
    label: 'IMPACT FINAL (critique)',
  },
  { id: 'crit', at: IMPACT, db: 6, section: 1, reverb: 0.5, reverbSeconds: 2.2 },
  { id: 'slam', at: IMPACT, db: 6, section: 1, reverb: 0.6, reverbSeconds: 2.2 },
  { id: 'x:subDrop', at: IMPACT, db: 2, section: 1 },
  { id: 'hazardThud', at: 42.75, db: -10, section: 1, label: 'Lurcke à genoux' },
  // Actes IV–V
  {
    id: 'chime',
    at: 45.0,
    db: -3,
    section: 1,
    key: true,
    label: 'Carillon d’annonce (écran des départs)',
  },
  { id: 'x:gurgle', at: 52.0, db: 2, pan: 0.15, section: 1, label: 'Cafetière, dernier café' },
  { id: 'coffeeSip', at: 53.2, db: -6, section: 1 },
  { id: 'chime', at: 54.4, db: -10, section: 1, key: true, label: 'Carillon doux (fondu au noir)' },
  { id: 'x:crackle', at: 55.0, db: -4, section: 1, label: 'Néon PRIVATIX qui s’allume' },
  { id: 'x:crackle', at: 55.14, db: -6, section: 1 },
  { id: 'x:crackle', at: 55.28, db: -6, section: 1 },
  {
    id: 'fanfare',
    at: 57.0,
    rate: 2 ** (2 / 12),
    db: 0,
    section: 1,
    key: true,
    label: 'Fanfare courte sur le bouton (en ré)',
  },
].map((e) => ({ section: 0, ...e }));

// ─── Mixage ─────────────────────────────────────────────────────────────────
// § 5.4 : effets devant la musique dans l'acte II, à égalité dans l'acte III, musique devant dans
// l'acte IV. Gains (dB) par point de temps, interpolés linéairement.
const MUSIC_DB = [
  [0, 3],
  [7.9, 3],
  [8.0, -2],
  [19.9, -2],
  [20.0, 0],
  [40.4, 0],
  [41.4, 0],
  [45, 2],
  [60, 2],
];
const SFX_DB = [
  [0, 0],
  [7.9, 0],
  [8.0, 1],
  [19.9, 1],
  [20.0, -1],
  [40.4, -1],
  [41.4, 0],
  [42.5, 0],
  [45, -3],
  [60, -3],
];
/**
 * Dynamique du film (dB, avant le compresseur) : c'est elle qui dessine la courbe d'intensité du
 * script (§ 1 et § 5.1) ; sans elle le compresseur et le limiteur aplatiraient tout le film.
 */
const DYN_DB = [
  [0, -15],
  [7.95, -12.5],
  [8.0, -10],
  [12, -8.5],
  [16, -6.5],
  [19.9, -5.5],
  [20.0, -2.5],
  [30.4, -1.5],
  [33.6, -1],
  [34.2, 0],
  [37.2, 1],
  [40.4, 2.5],
  [41.4, 0],
  [43, -4],
  [45, -8],
  [50, -9],
  [55, -10],
  [57, -7],
  [59.9, -8],
  [60, -8],
];
/** Plafond hors impact. Le script demande ≤ −6 dBFS, ce qui est incompatible avec −14 LUFS et une
 * courbe dynamique (tout finirait écrasé) : −3 dBFS garde l'impact comme crête la plus forte. */
const REST_CEIL = Number(process.env.REST_CEIL ?? -3);
/** Plafond du limiteur (crête vraie) : −1,5 dBFS sur le coup final, le son le plus fort du film. */
const CEIL_DB = (t) => (t >= IMPACT - 0.01 && t < IMPACT + 1.2 ? -1.5 : REST_CEIL);
const TARGET_LUFS = -14;

// ─── Outils ─────────────────────────────────────────────────────────────────
const db = (v) => (v <= 1e-12 ? -Infinity : 20 * Math.log10(v));
const fromDb = (d) => 10 ** (d / 20);
function interp(pts, t) {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i += 1) {
    const [t1, v1] = pts[i];
    const [t0, v0] = pts[i - 1];
    if (t <= t1) return t1 === t0 ? v1 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  }
  return pts[pts.length - 1][1];
}

function writeWav(file, L, R, bits = 24) {
  const n = L.length;
  const bps = bits / 8;
  const buf = Buffer.alloc(44 + n * 2 * bps);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2 * bps, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2 * bps, 28);
  buf.writeUInt16LE(2 * bps, 32);
  buf.writeUInt16LE(bits, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2 * bps, 40);
  const max = 2 ** (bits - 1) - 1;
  let o = 44;
  for (let i = 0; i < n; i += 1) {
    for (const v of [L[i], R[i]]) {
      const s = Math.round(Math.max(-1, Math.min(1, v)) * max);
      if (bits === 24) buf.writeIntLE(s, o, 3);
      else buf.writeInt16LE(s, o);
      o += bps;
    }
  }
  fs.writeFileSync(file, buf);
}

function readWav(file) {
  const b = fs.readFileSync(file);
  const bits = b.readUInt16LE(34);
  const bps = bits / 8;
  let p = 12;
  while (b.toString('ascii', p, p + 4) !== 'data') p += 8 + b.readUInt32LE(p + 4);
  const n = b.readUInt32LE(p + 4) / (2 * bps);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const max = 2 ** (bits - 1);
  let o = p + 8;
  for (let i = 0; i < n; i += 1) {
    L[i] = (bits === 24 ? b.readIntLE(o, 3) : b.readInt16LE(o)) / max;
    R[i] = (bits === 24 ? b.readIntLE(o + bps, 3) : b.readInt16LE(o + bps)) / max;
    o += 2 * bps;
  }
  return { L, R };
}

function loudnormJson(file) {
  const r = spawnText([
    '-hide_banner',
    '-nostats',
    '-i',
    file,
    '-af',
    'loudnorm=I=-14:TP=-1:print_format=json',
    '-f',
    'null',
    '-',
  ]);
  const m = r.match(/\{[\s\S]*?\}/g);
  const j = JSON.parse(m[m.length - 1]);
  return { I: +j.input_i, TP: +j.input_tp, LRA: +j.input_lra, thresh: +j.input_thresh };
}
function spawnText(a) {
  // ffmpeg écrit ses mesures sur stderr : on fusionne les deux sorties.
  return execFileSync('/bin/sh', ['-c', `"${FFMPEG}" ${a.map((x) => `'${x}'`).join(' ')} 2>&1`], {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  });
}
/** Sonie à court terme (fenêtre 3 s) toutes les 100 ms, via le filtre ebur128 de ffmpeg. */
function shortTerm(file) {
  const txt = spawnText([
    '-hide_banner',
    '-nostats',
    '-i',
    file,
    '-af',
    'ebur128=metadata=1,ametadata=print:key=lavfi.r128.M',
    '-f',
    'null',
    '-',
  ]);
  const out = [];
  let t = null;
  for (const line of txt.split('\n')) {
    const mt = line.match(/pts_time:([\d.]+)/);
    if (mt) t = +mt[1];
    const mv = line.match(/lavfi\.r128\.M=(-?[\d.]+|-inf)/);
    if (mv && t !== null) out.push([t, mv[1] === '-inf' ? -120 : +mv[1]]);
  }
  return out;
}

// ─── Mastering ──────────────────────────────────────────────────────────────
/** Compresseur de bus stéréo lié (détecteur RMS), courbe à genou doux. */
function compress(
  L,
  R,
  { threshold = -20, ratio = 2.5, knee = 6, attack = 0.008, release = 0.15 } = {},
) {
  const a = Math.exp(-1 / (attack * SR));
  const r = Math.exp(-1 / (release * SR));
  const rmsA = Math.exp(-1 / (0.01 * SR));
  let ms = 0;
  let gr = 0;
  for (let i = 0; i < L.length; i += 1) {
    const x = (L[i] * L[i] + R[i] * R[i]) / 2;
    ms = rmsA * ms + (1 - rmsA) * x;
    const lvl = 10 * Math.log10(ms + 1e-20);
    const over = lvl - threshold;
    let want = 0;
    if (over > knee / 2) want = over * (1 - 1 / ratio);
    else if (over > -knee / 2) want = ((1 - 1 / ratio) * (over + knee / 2) ** 2) / (2 * knee);
    gr = want > gr ? a * gr + (1 - a) * want : r * gr + (1 - r) * want;
    const g = fromDb(-gr);
    L[i] *= g;
    R[i] *= g;
  }
}

/** Passe-haut biquad (Butterworth, 2e ordre) : retire l'infra-grave qui mange la marge du limiteur. */
function highpass(X, freq) {
  const w = (2 * Math.PI * freq) / SR;
  const al = Math.sin(w) / (2 * Math.SQRT1_2);
  const c = Math.cos(w);
  const a0 = 1 + al;
  const b0 = (1 + c) / 2 / a0;
  const b1 = -(1 + c) / a0;
  const a1 = (-2 * c) / a0;
  const a2 = (1 - al) / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < X.length; i += 1) {
    const x = X[i];
    const y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    X[i] = y;
  }
}

/** Crête « vraie » approchée : sur-échantillonnage ×4 (sinc fenêtré, 16 points). */
const OS = 4;
const TAPS = 16;
const KERNEL = (() => {
  const k = [];
  for (let p = 1; p < OS; p += 1) {
    const row = [];
    for (let j = -TAPS / 2 + 1; j <= TAPS / 2; j += 1) {
      const x = j - p / OS;
      const s = Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
      const w = 0.5 + 0.5 * Math.cos((Math.PI * x) / (TAPS / 2 + 1));
      row.push(s * w);
    }
    k.push(row);
  }
  return k;
})();
function truePeakEnv(X) {
  const n = X.length;
  const env = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    let m = Math.abs(X[i]);
    for (const row of KERNEL) {
      let s = 0;
      for (let j = 0; j < TAPS; j += 1) {
        const idx = i + j - TAPS / 2 + 1;
        if (idx >= 0 && idx < n) s += X[idx] * row[j];
      }
      if (Math.abs(s) > m) m = Math.abs(s);
    }
    env[i] = m;
  }
  return env;
}

/**
 * Limiteur à anticipation (5 ms) sur la crête vraie, plafond variable dans le temps. Le gain ne
 * descend jamais en retard : on prend le minimum du gain requis sur la fenêtre d'anticipation, puis
 * on le lisse (attaque immédiate sur ce minimum, relâchement 80 ms).
 */
function limit(L, R, ceilDb) {
  const n = L.length;
  const eL = truePeakEnv(L);
  const eR = truePeakEnv(R);
  const need = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const c = fromDb(ceilDb(i / SR));
    const p = Math.max(eL[i], eR[i]);
    need[i] = p > c ? c / p : 1;
  }
  const look = Math.floor(0.005 * SR);
  // Minimum glissant (file monotone) sur [i, i + look].
  const minAhead = new Float32Array(n);
  const dq = [];
  let head = 0;
  for (let i = n - 1; i >= 0; i -= 1) {
    while (dq.length > head && need[dq[dq.length - 1]] >= need[i]) dq.pop();
    dq.push(i);
    while (dq[head] > i + look) head += 1;
    minAhead[i] = need[dq[head]];
  }
  // Relâchement 80 ms (attaque instantanée sur le minimum anticipé), puis moyenne glissante sur la
  // fenêtre d'anticipation : chaque valeur moyennée couvre l'échantillon courant, donc reste sous son
  // gain requis (aucun dépassement), et le gain n'a jamais de marche (aucun clic).
  const rel = Math.exp(-1 / (0.08 * SR));
  const r = new Float32Array(n);
  let g = 1;
  for (let i = 0; i < n; i += 1) {
    const target = minAhead[i];
    g = target < g ? target : rel * g + (1 - rel) * target;
    r[i] = g;
  }
  const gains = new Float32Array(n);
  let acc = 0;
  for (let i = 0; i < n; i += 1) {
    acc += r[i];
    if (i > look) acc -= r[i - look - 1];
    gains[i] = acc / Math.min(i + 1, look + 1);
  }
  for (let i = 0; i < n; i += 1) {
    L[i] *= gains[i];
    R[i] *= gains[i];
  }
  return gains;
}

function zeroSilence(L, R) {
  const a = Math.round(SILENCE[0] * SR);
  const b = Math.round(SILENCE[1] * SR);
  for (let i = a; i < b; i += 1) {
    L[i] = 0;
    R[i] = 0;
  }
}

function stats(L, R, from, to) {
  const a = Math.max(0, Math.round(from * SR));
  const b = Math.min(L.length, Math.round(to * SR));
  let peak = 0;
  let sum = 0;
  let clipped = 0;
  for (let i = a; i < b; i += 1) {
    const p = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    if (p > peak) peak = p;
    if (p >= 0.9999) clipped += 1;
    sum += (L[i] * L[i] + R[i] * R[i]) / 2;
  }
  return {
    peakDb: +db(peak).toFixed(1),
    rmsDb: +db(Math.sqrt(sum / Math.max(1, b - a))).toFixed(1),
    clipped,
  };
}

// ─── Rendu dans Chromium ────────────────────────────────────────────────────
async function renderStems() {
  const root = fileURLToPath(new URL('../..', import.meta.url));
  const server = await createServer({
    root,
    server: { port: 4199, strictPort: false },
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
  const strip = (e) =>
    Object.fromEntries(Object.entries(e).filter(([k]) => !['label', 'key', 'flash'].includes(k)));
  const spec = {
    seconds: SECONDS,
    sections: SECTIONS,
    directors: DIRECTORS.map(({ name, ...d }) => d),
    musicEvents: MUSIC_EVENTS,
    sfxEvents: SFX_EVENTS.map(strip),
  };
  const res = await page.evaluate(async (spec) => {
    const o = window.offline;
    const enc = (r) => {
      const n = r.left.length;
      const f = new Float32Array(n * 2);
      for (let i = 0; i < n; i += 1) {
        f[2 * i] = r.left[i];
        f[2 * i + 1] = r.right[i];
      }
      const u = new Uint8Array(f.buffer);
      let s = '';
      for (let i = 0; i < u.length; i += 0x8000)
        s += String.fromCharCode(...u.subarray(i, i + 0x8000));
      return btoa(s);
    };
    const base = { seconds: spec.seconds, sections: spec.sections };
    const music = await o.renderMusicTimeline({
      ...base,
      directors: spec.directors,
      events: spec.musicEvents,
    });
    const sfx = await o.renderSfxTimeline({ ...base, events: spec.sfxEvents });
    return { music: enc(music), sfx: enc(sfx) };
  }, spec);
  await browser.close();
  await server.close();
  if (errors.length) throw new Error(`Erreurs de la page : ${errors.join(' | ')}`);
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
  return { music: dec(res.music), sfx: dec(res.sfx) };
}

/** Graphiques PNG (courbe d'intensité contre le script) dessinés dans Chromium. */
async function drawIntensity(file, st, mixStats) {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 560 } });
  await page.setContent('<canvas id="c" width="1400" height="560"></canvas>');
  await page.evaluate(
    ({ st, target, acts, silence }) => {
      const c = document.getElementById('c');
      const g = c.getContext('2d');
      g.fillStyle = '#100b1e';
      g.fillRect(0, 0, 1400, 560);
      const X = (t) => 60 + (t / 60) * 1300;
      const Yl = (l) => 500 - ((Math.max(-50, l) + 50) / 50) * 440; // −50..0 LUFS
      const Yt = (v) => 500 - (v / 10) * 440;
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fillRect(X(silence[0]), 60, X(silence[1]) - X(silence[0]), 440);
      g.strokeStyle = 'rgba(255,255,255,0.15)';
      g.fillStyle = '#ccc';
      g.font = '13px sans-serif';
      for (let t = 0; t <= 60; t += 5) {
        g.beginPath();
        g.moveTo(X(t), 60);
        g.lineTo(X(t), 500);
        g.stroke();
        g.fillText(`${t}s`, X(t) - 8, 520);
      }
      for (let l = -50; l <= 0; l += 10) g.fillText(`${l} LUFS`, 2, Yl(l) + 4);
      acts.forEach(([n, a]) => g.fillText(n, X(a) + 4, 50));
      g.strokeStyle = '#FF8C2B';
      g.lineWidth = 2;
      g.beginPath();
      target.forEach(([t, v], i) => (i ? g.lineTo(X(t), Yt(v)) : g.moveTo(X(t), Yt(v))));
      g.stroke();
      g.strokeStyle = '#3ee0d0';
      g.beginPath();
      st.forEach(([t, l], i) => (i ? g.lineTo(X(t), Yl(l)) : g.moveTo(X(t), Yl(l))));
      g.stroke();
      g.fillStyle = '#FF8C2B';
      g.fillText('script § 5.1 : intensité 0–10 (0 en bas, 10 en haut)', 900, 20);
      g.fillStyle = '#3ee0d0';
      g.fillText('mix.wav : sonie momentanée (400 ms), LUFS', 900, 38);
    },
    { st, target: TARGET, acts: ACTS, silence: SILENCE },
  );
  await page.locator('#c').screenshot({ path: file });
  await browser.close();
}

// ─── Programme ──────────────────────────────────────────────────────────────
function writeCues(extra = {}) {
  const beats = [];
  const grid = [
    // [début, fin, BPM, mode] : temps forts de mesure (4 temps).
    [0, 8, 74, 'hub'],
    [8, 20, 100, 'combat'],
    [20, 30.4, 104, 'combat'],
    [30.4, 34.2, 110, 'disco'],
    [34.2, 37.2, 112, 'boss 1'],
    [37.2, 38.6, 116, 'boss 2'],
    [38.6, 40.4, 120, 'boss 3'],
    [45, 60, 60, 'hub'],
  ];
  for (const [a, b, bpm, mode] of grid) {
    const beat = 60 / bpm;
    for (let k = 0, t = a; t < b - 1e-6; k += 1, t = a + k * beat)
      beats.push({ t: +t.toFixed(3), downbeat: k % 4 === 0, bpm, mode });
  }
  const cues = {
    version: 1,
    duration: SECONDS,
    sampleRate: SR,
    note: 'Temps en secondes depuis le début de mix.wav. key = effets du § 5.2 ; flash = impacts où un flash blanc (≤ 3 images) est autorisé. beats = grille musicale (downbeat = 1er temps de mesure) pour couper sur les temps.',
    silence: {
      from: SILENCE[0],
      to: SILENCE[1],
      note: 'Silence numérique total (0 échantillon non nul).',
    },
    flashes: SFX_EVENTS.filter((e) => e.flash).map((e) => ({ t: e.at, label: e.label })),
    events: SFX_EVENTS.map((e) => ({
      t: e.at,
      sfx: e.id,
      ...(e.label ? { label: e.label } : {}),
      ...(e.key ? { key: true } : {}),
      ...(e.flash ? { flash: true } : {}),
      ...(e.pan ? { pan: e.pan } : {}),
    })),
    music: [
      { t: 0, label: 'Hub (OCC) : piano électrique, radio, 74 BPM' },
      { t: 6.6, label: 'Bourdon de quai qui monte sous la porte' },
      { t: 8.0, label: 'Combat ré mineur 100 BPM, basse' },
      { t: 12.0, label: '+ grosse caisse' },
      { t: 16.0, label: '+ charleston' },
      { t: 17.6, label: 'Montée (1 mesure) vers le drop' },
      { t: 20.0, label: 'DROP : toutes les couches, 104 BPM' },
      { t: 30.4, label: 'Discosaure : caisse sur chaque noire, 110 BPM' },
      { t: 33.6, label: 'Micro-silence (boule cassée) jusqu’à 34,2' },
      { t: 34.2, label: 'Boss mi♭ phrygien phase 1, 112 BPM' },
      { t: 37.2, label: 'Boss phase 2, 116 BPM' },
      { t: 38.6, label: 'Boss phase 3, 120 BPM' },
      { t: 40.4, label: 'SILENCE TOTAL' },
      { t: 41.4, label: 'Impact final + bourdon de quai seul' },
      { t: 45.0, label: 'Hub ralenti 60 BPM (Fa maj7)' },
      { t: 49.0, label: 'Résolution en ré majeur (sous C6)' },
      { t: 57.0, label: 'Ré majeur + fanfare + note tenue' },
      { t: 60.0, label: 'Coupe nette' },
    ],
    beats,
    endcard: ENDCARD,
    ...extra,
  };
  fs.writeFileSync(path.join(OUT, 'cues.json'), JSON.stringify(cues, null, 2));
}

function writeEndcard() {
  // 55–60 s du mix final, pour re-muxer la carte de fin seule (le son ne dépend pas du texte).
  execFileSync(FFMPEG, [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    path.join(OUT, 'mix.wav'),
    '-ss',
    '55',
    '-t',
    '5',
    '-c:a',
    'pcm_s24le',
    path.join(OUT, 'endcard.wav'),
  ]);
}

if (ENDCARD_ONLY) {
  if (!fs.existsSync(path.join(OUT, 'mix.wav')))
    throw new Error('mix.wav absent : lancer le rendu complet.');
  const prev = JSON.parse(fs.readFileSync(path.join(OUT, 'cues.json'), 'utf8'));
  writeCues({ loudness: prev.loudness });
  writeEndcard();
  console.log('Carte de fin : cues.json et endcard.wav réécrits.');
  process.exit(0);
}

console.log('Rendu des pistes (Chromium, OfflineAudioContext)…');
const { music, sfx } = await renderStems();
writeWav(path.join(OUT, 'music.wav'), music.L, music.R);
writeWav(path.join(OUT, 'sfx.wav'), sfx.L, sfx.R);

// Mélange avec l'automation de bus, puis compresseur de bus.
const n = Math.min(music.L.length, sfx.L.length);
const pre = { L: new Float32Array(n), R: new Float32Array(n) };
for (let i = 0; i < n; i += 1) {
  const t = i / SR;
  const gm = fromDb(interp(MUSIC_DB, t));
  const gs = fromDb(interp(SFX_DB, t));
  pre.L[i] = music.L[i] * gm + sfx.L[i] * gs;
  pre.R[i] = music.R[i] * gm + sfx.R[i] * gs;
}

highpass(pre.L, 40);
highpass(pre.R, 40);

// Le gain d'entrée est cherché par itérations : sonie intégrée mesurée par ffmpeg (EBU R128).
const dynAt = Float32Array.from({ length: n }, (_, i) => interp(DYN_DB, i / SR));
let inGainDb = 16;
const tries = [];
let meas = null;
let mix = null;
const tmp = path.join(OUT, 'mix.wav');
for (let pass = 0; pass < 8; pass += 1) {
  const L = Float32Array.from(pre.L, (v) => v * fromDb(inGainDb));
  const R = Float32Array.from(pre.R, (v) => v * fromDb(inGainDb));
  compress(L, R, { threshold: -20, ratio: 2.5, knee: 8, attack: 0.01, release: 0.18 });
  // La dynamique du film s'applique après le compresseur (qui la réduirait), avant le limiteur.
  for (let i = 0; i < L.length; i += 1) {
    const g = fromDb(dynAt[i]);
    L[i] *= g;
    R[i] *= g;
  }
  limit(L, R, CEIL_DB);
  zeroSilence(L, R);
  writeWav(tmp, L, R);
  meas = loudnormJson(tmp);
  mix = { L, R };
  console.log(
    `passe ${pass + 1} : gain d'entrée ${inGainDb.toFixed(2)} dB → ${meas.I} LUFS, ${meas.TP} dBTP`,
  );
  if (Math.abs(meas.I - TARGET_LUFS) < 0.1) break;
  tries.push([inGainDb, meas.I]);
  // Sécante sur (gain d'entrée → sonie) : le limiteur rend la relation très peu linéaire.
  const [p0, p1] = tries.slice(-2);
  const slope = p0 && p1 && p1[1] !== p0[1] ? (p1[0] - p0[0]) / (p1[1] - p0[1]) : 1;
  inGainDb += Math.max(-12, Math.min(12, (TARGET_LUFS - meas.I) * Math.max(1, Math.min(8, slope))));
}

// OGG (Vorbis q7) pour la prévisualisation et le web.
execFileSync(FFMPEG, [
  '-y',
  '-hide_banner',
  '-loglevel',
  'error',
  '-i',
  tmp,
  '-c:a',
  'libvorbis',
  '-q:a',
  '7',
  path.join(OUT, 'mix.ogg'),
]);
const oggMeas = loudnormJson(path.join(OUT, 'mix.ogg'));
writeEndcard();

// ─── Analyses ───────────────────────────────────────────────────────────────
const st = shortTerm(tmp);
const actRows = ACTS.map(([name, a, b]) => {
  const vals = st.filter(([t]) => t >= a + 0.4 && t <= b).map(([, l]) => l);
  const meanLufs = vals.length
    ? 10 * Math.log10(vals.reduce((s, l) => s + 10 ** (l / 10), 0) / vals.length)
    : -120;
  return {
    act: name,
    from: a,
    to: b,
    mix: stats(mix.L, mix.R, a, b),
    music: stats(music.L, music.R, a, b),
    sfx: stats(sfx.L, sfx.R, a, b),
    meanMomentaryLufs: +meanLufs.toFixed(1),
  };
});
// Silence : nombre d'échantillons non nuls entre 40,4 et 41,4.
let nonZero = 0;
for (let i = Math.round(SILENCE[0] * SR); i < Math.round(SILENCE[1] * SR); i += 1)
  if (mix.L[i] !== 0 || mix.R[i] !== 0) nonZero += 1;
// Corrélation sonie momentanée (par seconde) ↔ courbe du script, hors silence.
const perSec = [];
for (let s = 0; s < 60; s += 1) {
  const vals = st.filter(([t]) => t > s + 0.4 && t <= s + 1.0).map(([, l]) => l);
  if (!vals.length) continue;
  const l = 10 * Math.log10(vals.reduce((a, v) => a + 10 ** (v / 10), 0) / vals.length);
  perSec.push({ s, lufs: +l.toFixed(1), target: interp(TARGET, s + 0.5) });
}
const pts = perSec.filter((p) => p.lufs > -70);
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const mx = mean(pts.map((p) => p.lufs));
const my = mean(pts.map((p) => p.target));
const cov = mean(pts.map((p) => (p.lufs - mx) * (p.target - my)));
const sx = Math.sqrt(mean(pts.map((p) => (p.lufs - mx) ** 2)));
const sy = Math.sqrt(mean(pts.map((p) => (p.target - my) ** 2)));
const corr = cov / (sx * sy);
const loudest = (() => {
  // Crête la plus forte hors impact.
  const s1 = stats(mix.L, mix.R, 0, IMPACT - 0.01);
  const s2 = stats(mix.L, mix.R, IMPACT + 1.2, 60);
  return Math.max(s1.peakDb, s2.peakDb);
})();
const analysis = {
  loudness: {
    integratedLufs: meas.I,
    truePeakDbtp: meas.TP,
    lra: meas.LRA,
    ogg: { integratedLufs: oggMeas.I, truePeakDbtp: oggMeas.TP },
    impactPeakDb: stats(mix.L, mix.R, IMPACT, IMPACT + 1.2).peakDb,
    loudestOtherPeakDb: loudest,
    clippedSamples: stats(mix.L, mix.R, 0, 60).clipped,
    silenceNonZeroSamples: nonZero,
    inputGainDb: +inGainDb.toFixed(2),
  },
  intensityCorrelation: +corr.toFixed(3),
  acts: actRows,
  perSecond: perSec,
};
fs.writeFileSync(path.join(OUT, 'analysis.json'), JSON.stringify(analysis, null, 2));
writeCues({ loudness: analysis.loudness });

// Images : spectrogramme, forme d'onde, courbe d'intensité.
execFileSync(FFMPEG, [
  '-y',
  '-hide_banner',
  '-loglevel',
  'error',
  '-i',
  tmp,
  '-lavfi',
  'showspectrumpic=s=1600x600:legend=1:scale=log:fscale=log:color=intensity',
  path.join(OUT, 'spectrogram.png'),
]);
execFileSync(FFMPEG, [
  '-y',
  '-hide_banner',
  '-loglevel',
  'error',
  '-i',
  tmp,
  '-lavfi',
  'showwavespic=s=1600x300:split_channels=1:colors=0x3ee0d0|0xFF8C2B',
  path.join(OUT, 'waveform.png'),
]);
await drawIntensity(path.join(OUT, 'intensity.png'), st, analysis.loudness);

console.table(
  actRows.map((r) => ({
    acte: r.act,
    crête: r.mix.peakDb,
    rms: r.mix.rmsDb,
    lufsM: r.meanMomentaryLufs,
    musique: r.music.rmsDb,
    effets: r.sfx.rmsDb,
  })),
);
console.log(analysis.loudness, 'corrélation intensité :', analysis.intensityCorrelation);
if (analysis.loudness.clippedSamples || nonZero || meas.TP > -1 || oggMeas.TP > -1)
  process.exitCode = 1;
