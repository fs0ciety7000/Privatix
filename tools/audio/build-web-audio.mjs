// Prépare la musique (OST, prises retenues t1) et les dialogues pour le jeu web :
//   - musique : WebM/Opus 96 kb/s stéréo, silences de tête et de queue retirés → public/audio/music/
//   - voix    : WebM/Opus 64 kb/s mono → public/audio/vo/<voix>/
//   - index   : src/audio/assetIndex.ts (durées, point de bouclage, sous-titres, répliques manquantes)
//
//   node tools/audio/build-web-audio.mjs            (encode les fichiers absents, réécrit l'index)
//   node tools/audio/build-web-audio.mjs --force    (réencode tout)
//   node tools/audio/build-web-audio.mjs --index    (réécrit seulement l'index depuis les fichiers web)
//
// Pas de doublon OGG : Chromium, Firefox, Electron et Safari ≥ 17 décodent WebM/Opus ; ailleurs, le
// décodage échoue et le jeu garde la musique synthétisée (repli prévu par src/audio/samples.ts).
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const OST = path.join(root, 'docs/audio/ost');
const DIALOGUES = path.join(root, 'docs/audio/dialogues');
const OUT_MUSIC = path.join(root, 'public/audio/music');
const OUT_VO = path.join(root, 'public/audio/vo');
const INDEX = path.join(root, 'src/audio/assetIndex.ts');
const VOICES = ['leon', 'yasmina', 'invite', 'lurcke', 'marcel', 'josiane', 'bene'];
const indexOnly = process.argv.includes('--index');
const force = process.argv.includes('--force');
const encode = (dst) => !indexOnly && (force || !fs.existsSync(dst));

/** Morceaux du jeu (la musique du trailer reste hors du jeu). */
const MUSIC = [
  'ost-01-prise-de-poste',
  'ost-02-occ-jour',
  'ost-03-occ-nuit',
  'ost-04-quais-exploration',
  'ost-05-quais-combat',
  'ost-06-passerelle',
  'ost-07-hall-bag',
  'ost-08-boss-auditeur',
  'ost-09-boss-invite',
  'ost-10-boss-discosaure',
  'ost-11-boss-lurcke',
  'ost-12-departs-victoire',
  'ost-13-departs-supprime',
  'ost-14-le-7h12',
];

const TRIM =
  'silenceremove=start_periods=1:start_threshold=-60dB:start_silence=0.05,' +
  'areverse,silenceremove=start_periods=1:start_threshold=-60dB:start_silence=0.3,areverse';

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`ffmpeg : ${r.stderr}`);
}

function duration(file) {
  const out = execFileSync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'csv=p=0',
    file,
  ]);
  return Number(out.toString().trim());
}

/**
 * Point de bouclage : fin du dernier passage « plein » (sonie momentanée à moins de 10 LU de la sonie
 * intégrée). La queue du morceau (fondu, résonance) est couverte par le fondu enchaîné du jeu.
 */
function loopEnd(file, dur) {
  const r = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=framelog=info', '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const lines = r.stderr.split('\n');
  const integ = /I:\s+(-?[\d.]+) LUFS/.exec(r.stderr.split('Summary:')[1] ?? '');
  const I = integ ? Number(integ[1]) : -16;
  let last = dur;
  for (const l of lines) {
    const m = /t:\s*([\d.]+)\s+.*M:\s*(-?[\d.]+|-inf)/.exec(l);
    if (!m) continue;
    const t = Number(m[1]);
    const M = m[2] === '-inf' ? -120 : Number(m[2]);
    if (M > I - 10) last = t;
  }
  return Math.min(dur, Math.round(last * 100) / 100);
}

const music = [];
fs.mkdirSync(OUT_MUSIC, { recursive: true });
for (const slug of MUSIC) {
  const src = path.join(OST, `${slug}_t1.ogg`);
  const name = slug.replace(/^ost-/, '');
  const dst = path.join(OUT_MUSIC, `${name}.webm`);
  if (encode(dst)) {
    ffmpeg([
      '-i',
      src,
      '-map_metadata',
      '-1',
      '-af',
      TRIM,
      '-c:a',
      'libopus',
      '-b:a',
      '96k',
      '-vbr',
      'on',
      '-application',
      'audio',
      '-f',
      'webm',
      dst,
    ]);
  }
  const dur = duration(dst);
  music.push({
    id: `ost.${slug.replace(/^ost-/, '')}`,
    file: `music/${name}.webm`,
    duration: Math.round(dur * 100) / 100,
    loopEnd: loopEnd(dst, dur),
    bytes: fs.statSync(dst).size,
  });
  console.log(`musique : ${name} (${dur.toFixed(1)} s, ${(fs.statSync(dst).size / 1e6).toFixed(2)} Mo)`);
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'tools/elevenlabs/manifest.json'), 'utf8'),
);
const lines = [];
for (const a of manifest.assets) {
  const m = new RegExp(`^vo\\.(${VOICES.join('|')})\\.(.+)$`).exec(a.id);
  if (!m || a.meta?.trailer) continue;
  const [, voice, rest] = m;
  const base = `${voice}.${rest}`;
  const src = path.join(DIALOGUES, voice, `${base}_t1.ogg`);
  const dst = path.join(OUT_VO, voice, `${base}.webm`);
  let file = null;
  let bytes = 0;
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    if (encode(dst)) {
      ffmpeg([
        '-i',
        src,
        '-map_metadata',
        '-1',
        '-ac',
        '1',
        '-c:a',
        'libopus',
        '-b:a',
        '64k',
        '-vbr',
        'on',
        '-application',
        'audio',
        '-f',
        'webm',
        dst,
      ]);
    }
    file = `vo/${voice}/${base}.webm`;
    bytes = fs.statSync(dst).size;
  }
  const text = String(a.params?.text ?? '');
  const subtitle = text
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  lines.push({
    id: a.id,
    voice,
    file,
    subtitle,
    fictive: a.meta?.fictive === true,
    bytes,
  });
}
const missing = lines.filter((l) => !l.file).map((l) => l.id);
console.log(`voix : ${String(lines.length - missing.length)} / ${String(lines.length)} répliques`);
if (missing.length) console.log(`manquantes (texte seul) : ${missing.join(', ')}`);

const totalMusic = music.reduce((s, m) => s + m.bytes, 0);
const totalVo = lines.reduce((s, l) => s + l.bytes, 0);
console.log(
  `poids : musique ${(totalMusic / 1e6).toFixed(2)} Mo, voix ${(totalVo / 1e6).toFixed(2)} Mo, total ${((totalMusic + totalVo) / 1e6).toFixed(2)} Mo`,
);

const q = (s) => JSON.stringify(s);
const ts = `/**
 * Index des fichiers audio du jeu (public/audio). FICHIER GÉNÉRÉ par
 * \`node tools/audio/build-web-audio.mjs\` : ne pas modifier à la main.
 *
 * - Musique : OST, prise retenue t1, WebM/Opus 96 kb/s, silences de tête et de queue retirés.
 *   \`loopEnd\` : fin du dernier passage plein (s), le fondu enchaîné de la boucle se termine là.
 * - Voix : WebM/Opus 64 kb/s mono. \`file: null\` : réplique pas encore enregistrée (sous-titre seul).
 * Poids : musique ${(totalMusic / 1e6).toFixed(2)} Mo, voix ${(totalVo / 1e6).toFixed(2)} Mo.
 */

export interface MusicFile {
  readonly file: string;
  readonly duration: number;
  readonly loopEnd: number;
  readonly bytes: number;
}

export interface VoiceLineFile {
  readonly id: string;
  readonly voice: ${VOICES.map((v) => `'${v}'`).join(' | ')};
  readonly file: string | null;
  /** Texte du catalogue sans les balises d'émotion. */
  readonly subtitle: string;
  /** Réplique inventée (l'Invité d'honneur) : l'UI affiche « réplique fictive ». */
  readonly fictive: boolean;
}

export const MUSIC_FILES = {
${music.map((m) => `  ${q(m.id)}: { file: ${q(m.file)}, duration: ${String(m.duration)}, loopEnd: ${String(m.loopEnd)}, bytes: ${String(m.bytes)} },`).join('\n')}
} as const satisfies Record<string, MusicFile>;

export type MusicFileId = keyof typeof MUSIC_FILES;

export const VOICE_FILES: readonly VoiceLineFile[] = [
${lines.map((l) => `  { id: ${q(l.id)}, voice: ${q(l.voice)}, file: ${l.file ? q(l.file) : 'null'}, subtitle: ${q(l.subtitle)}, fictive: ${String(l.fictive)} },`).join('\n')}
];
`;
fs.writeFileSync(INDEX, ts);
spawnSync('npx', ['prettier', '--write', INDEX], { cwd: root, stdio: 'inherit' });
console.log(`index : ${path.relative(root, INDEX)}`);
