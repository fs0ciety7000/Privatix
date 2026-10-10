// Musique du trailer « Le Shift » v2 (60 s) générée par Lyria (API Gemini, endpoint `interactions`).
//   node tools/trailer/lyria-music.mjs [--takes 3] [--out dossier] [--force]
// Musique seule : le prompt exclut explicitement bruitages, sifflets, trains, voix et foley.
// Chaque prise est un appel indépendant (pas de seed) ; les MP3 bruts déjà présents sont réutilisés
// (reprise sans regénérer) sauf avec --force. Post-production : OGG Vorbis q5, −14 LUFS, crête −1 dBTP,
// écrits dans docs/audio/ost/trailer-musique-v2_t<n>.ogg.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const TAKES = Number(opt('takes', 3));
const RAW = path.resolve(opt('out', 'trailer-music-v2-raw'));
const DEST = path.resolve('docs/audio/ost');
const FORCE = args.includes('--force');
const KEY = process.env.GEMINI_API_KEY;
const BASE = process.env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta';
const MODEL = 'lyria-3.5';

export const PROMPT = `Instrumental video-game trailer score, exactly 60 seconds, one continuous cinematic piece. Style: neon synthwave meets Belgian brass band and lo-fi jazz, playful but epic.
[0:00 - 0:08] Calm intro: warm Rhodes electric piano, F major 7th chords, 74 BPM, soft brushed drums, cozy night-shift mood.
[0:08 - 0:20] Build-up: switch to D minor, 100 BPM, pulsing analog synth bass, kick drum enters around 0:12, hi-hats around 0:16, rising tension toward a drop.
[0:20 - 0:34] Drop: full energetic combat groove in D minor at 104 BPM, marching snare, driving synth bass, bright neon synth arpeggio, punchy brass riff.
[0:34 - 0:41] Climax: E-flat phrygian, tempo pushing from 112 to 120 BPM, heavy low brass on the downbeats, timpani, biggest moment of the piece, ending on a sharp final hit at 0:41.
[0:41 - 0:45] Near silence: a single sustained low D note, very quiet.
[0:45 - 0:55] Resolution: slow tender Rhodes at 60 BPM, F major 7 resolving to D major, relieved and hopeful.
[0:55 - 1:00] Finale: short warm brass-band chord swelling then a clean held final D major chord, natural ending.
Instrumental music only. No sound effects, no foley, no whistles, no train or railway sounds, no announcements, no voices, no vocals, no lyrics, no spoken word, no crowd, no samples of real-world sounds. Clean professional mix.`;

async function generate() {
  if (!KEY) throw new Error('GEMINI_API_KEY absente');
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(`${BASE}/interactions`, {
      method: 'POST',
      headers: { 'x-goog-api-key': KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, input: PROMPT }),
    }).catch((err) => ({ ok: false, status: 0, text: async () => String(err) }));
    if (res.ok) {
      const data = await res.json();
      const audio = (data.steps ?? [])
        .filter((s) => s.type === 'model_output')
        .flatMap((s) => s.content ?? [])
        .filter((c) => c.type === 'audio' && c.data)
        .at(-1);
      if (!audio) throw new Error(`réponse sans bloc audio (${JSON.stringify(data).slice(0, 300)})`);
      return Buffer.from(audio.data, 'base64');
    }
    const body = await res.text();
    if (![0, 429, 500, 502, 503, 504].includes(res.status) || attempt >= 4)
      throw new Error(`Lyria ${res.status} : ${body.slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
}

// Gain linéaire vers −14 LUFS puis limiteur suréchantillonné (×4) à −2 dBFS, pour une crête vraie
// ≤ −1 dBTP après encodage Vorbis. Le limiteur rogne un peu de sonie : le gain est corrigé sur mesure
// de la sortie (ebur128), au plus trois passes. loudnorm seul retombe ici en mode dynamique et rate la
// cible de 0,5 à 2 dB.
const loudness = (f) => {
  const log = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'])
    .stderr.toString();
  return { i: Number(log.match(/I:\s+(-?[\d.]+) LUFS/g).at(-1).match(/-?[\d.]+/)[0]),
    tp: Number(log.match(/Peak:\s+(-?[\d.]+) dBFS/g).at(-1).match(/-?[\d.]+/)[0]) };
};
function master(src, dst) {
  let gain = -14 - loudness(src).i;
  let out;
  for (let pass = 0; pass < 3; pass += 1) {
    execFileSync('ffmpeg', [
      '-y', '-v', 'error', '-i', src,
      '-af', `volume=${gain.toFixed(2)}dB,aresample=192000,alimiter=limit=0.79:attack=1:release=60:level=false,aresample=48000`,
      '-c:a', 'libvorbis', '-q:a', '5', dst,
    ]);
    out = loudness(dst);
    if (Math.abs(out.i + 14) <= 0.2) break;
    gain += -14 - out.i;
  }
  return out;
}

const duration = (f) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

fs.mkdirSync(RAW, { recursive: true });
const jobs = Array.from({ length: TAKES }, (_, i) => i + 1).map(async (t) => {
  const raw = path.join(RAW, `trailer-musique-v2_t${t}.mp3`);
  if (FORCE || !fs.existsSync(raw)) {
    fs.writeFileSync(raw, await generate());
    console.log(`t${t} : généré`);
  } else console.log(`t${t} : brut existant réutilisé`);
  const ogg = path.join(DEST, `trailer-musique-v2_t${t}.ogg`);
  const { i, tp } = master(raw, ogg);
  console.log(`t${t} : ${path.relative(process.cwd(), ogg)} (${duration(ogg).toFixed(1)} s, ${i} LUFS, ${tp} dBTP)`);
});
const results = await Promise.allSettled(jobs);
for (const r of results) if (r.status === 'rejected') console.error(r.reason.message);
if (results.some((r) => r.status === 'rejected')) process.exitCode = 1;
