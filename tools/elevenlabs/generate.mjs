#!/usr/bin/env node
// Génération des assets audio de Privatix avec l'API REST v1 d'ElevenLabs, pilotée par manifest.json.
// Node ≥ 22, ESM, aucune dépendance (fetch, FormData et Blob natifs). Mode d'emploi : README.md.
//
//   ELEVENLABS_API_KEY=… node tools/elevenlabs/generate.mjs [options]
//
//   --dry-run            estime le coût (caractères, secondes, crédits, dollars) et s'arrête
//   --samples            ne traite que les assets `sample: true` (lot d'écoute)
//   --only a,b           ne traite que ces identifiants (ou préfixes terminés par « * » : vo.marcel.*)
//   --type t1,t2         ne traite que ces types (voice-design, tts, sfx, music, stem-split)
//   --out dossier        dossier de sortie (défaut : tools/elevenlabs/out)
//   --format ogg|webm|both   format final (défaut : ogg ; le MP3 brut est gardé dans raw/)
//   --takes n            plafonne le nombre de prises par asset
//   --concurrency n      requêtes simultanées (défaut 2)
//   --interval ms        écart minimal entre deux départs de requête (défaut 600)
//   --tts-model id       force le modèle TTS (eleven_v3 par défaut ; eleven_v4, eleven_multilingual_v2…)
//   --music-model id     force le modèle de musique (music_v2 par défaut ; avec Lyria : lyria-3-clip-preview
//                        pour ≤ 30 s, lyria-3.5 au-delà)
//   --music-backend b    elevenlabs (défaut) ou lyria (API Gemini, clé GEMINI_API_KEY) pour le type music ;
//                        la séparation en stems reste une opération ElevenLabs
//   --pick voix=n,…      aperçu de Voice Design retenu (1 à 3) avant création de la voix
//   --create-voices      crée les voix choisies (POST /v1/text-to-voice) ; sans cette option, Voice
//                        Design ne produit que les aperçus (le workspace est plein : 3/3 voix)
//   --include-validated  inclut les assets déjà validés (`status: validé`) ou bloqués
//   --force              régénère même si le fichier final existe
//   --yes                ne marque pas la pause de 5 s avant de dépenser des crédits
//
// Reprise : un fichier final déjà présent n'est jamais régénéré (sauf --force) ; un MP3 brut présent
// est seulement reconverti. Les voix créées sont mémorisées dans <out>/state/voices.json ; une voix
// peut aussi être fournie par l'environnement : ELEVENLABS_VOICE_MARCEL=<voice_id>.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d;
};

const DRY = flag('dry-run');
const SAMPLES = flag('samples');
const FORCE = flag('force');
const YES = flag('yes');
const CREATE_VOICES = flag('create-voices');
const INCLUDE_VALIDATED = flag('include-validated');
const OUT = path.resolve(opt('out', path.join(HERE, 'out')));
const FORMAT = opt('format', 'ogg');
const MAX_TAKES = Number(opt('takes', Infinity));
const CONCURRENCY = Math.max(1, Number(opt('concurrency', 2)));
const INTERVAL = Math.max(0, Number(opt('interval', 600)));
const TTS_MODEL = opt('tts-model', null);
const MUSIC_MODEL = opt('music-model', null);
const MUSIC_BACKEND = opt('music-backend', process.env.MUSIC_BACKEND ?? 'elevenlabs');
if (!['elevenlabs', 'lyria'].includes(MUSIC_BACKEND))
  throw new Error(`--music-backend inconnu : ${MUSIC_BACKEND} (elevenlabs | lyria)`);
const LYRIA = MUSIC_BACKEND === 'lyria';
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const LYRIA_BASE = process.env.LYRIA_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta';
// Tarifs de l'API Gemini relevés sur ai.google.dev/gemini-api/docs/pricing le 2026-10-09 (par requête).
const LYRIA_USD = { 'lyria-3-clip-preview': 0.04, 'lyria-3-pro-preview': 0.08, 'lyria-3.5': 0.08 };
const ONLY = opt('only', null)?.split(',').filter(Boolean) ?? null;
const TYPES = opt('type', null)?.split(',').filter(Boolean) ?? null;
const PICKS = Object.fromEntries(
  (opt('pick', '') || '')
    .split(',')
    .filter(Boolean)
    .map((p) => p.split('='))
    .map(([k, v]) => [k, Number(v)]),
);
const FFMPEG = fs.existsSync('/usr/bin/ffmpeg') ? '/usr/bin/ffmpeg' : 'ffmpeg';
const MANIFEST = JSON.parse(fs.readFileSync(path.join(HERE, 'manifest.json'), 'utf8'));
const BASE = process.env.ELEVENLABS_BASE_URL ?? MANIFEST.api.base;
const KEY = process.env.ELEVENLABS_API_KEY;
const ORDER = ['voice-design', 'tts', 'sfx', 'music', 'stem-split'];

// ─── Sélection ───────────────────────────────────────────────────────────────
const matches = (id) =>
  !ONLY || ONLY.some((o) => (o.endsWith('*') ? id.startsWith(o.slice(0, -1)) : id === o));
const SKIP_STATUS = ['validé', 'bloquée'];
const candidates = MANIFEST.assets.filter(
  (a) => (!SAMPLES || a.sample) && matches(a.id) && (!TYPES || TYPES.includes(a.type)),
);
const skippedStatus = candidates.filter(
  (a) => !INCLUDE_VALIDATED && SKIP_STATUS.includes(a.status),
);
const selected = candidates
  .filter((a) => !skippedStatus.includes(a))
  .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
const takesOf = (a, samples = SAMPLES) =>
  Math.max(1, Math.min(MAX_TAKES, samples ? (a.sampleTakes ?? a.takes ?? 1) : (a.takes ?? 1)));

// ─── Estimation ──────────────────────────────────────────────────────────────
const stripTags = (t) => t.replace(/\[[^\]]*\]\s*/g, '').trim();
function ttsText(a) {
  const model = TTS_MODEL ?? a.params.model_id;
  // Les balises d'émotion ne sont comprises que par eleven_v3 / eleven_v4 ; ailleurs on les retire.
  return /^eleven_v[34]/.test(model) ? a.params.text : stripTags(a.params.text);
}
function musicSeconds(a) {
  const ms =
    a.params.music_length_ms ??
    (a.params.composition_plan?.chunks ?? []).reduce((s, c) => s + c.duration_ms, 0);
  return ms / 1000;
}
const lyriaModel = (a) =>
  MUSIC_MODEL ?? (musicSeconds(a) <= 30 ? 'lyria-3-clip-preview' : 'lyria-3.5');
function estimate(list, samples = SAMPLES) {
  const r = MANIFEST.rates;
  const e = { calls: 0, ttsChars: 0, designChars: 0, sfxSeconds: 0, musicSeconds: 0, stems: 0 };
  for (const a of list) {
    const n = a.type === 'voice-design' ? 1 : takesOf(a, samples);
    e.calls += n;
    if (a.type === 'tts') e.ttsChars += ttsText(a).length * n;
    if (a.type === 'voice-design') e.designChars += (a.params.text?.length ?? 0) * 3;
    if (a.type === 'sfx') e.sfxSeconds += a.params.duration_seconds * n;
    if (a.type === 'music') {
      e.musicSeconds += musicSeconds(a) * n;
      if (LYRIA) e.lyriaUsd = (e.lyriaUsd ?? 0) + (LYRIA_USD[lyriaModel(a)] ?? 0.08) * n;
    }
    if (a.type === 'stem-split') e.stems += 1;
  }
  e.credits = Math.round(
    (e.ttsChars + e.designChars) * r.ttsCreditsPerChar + e.sfxSeconds * r.sfxCreditsPerSecond,
  );
  e.usd =
    ((e.ttsChars + e.designChars) / 1000) * r.ttsUsdPer1kChars +
    (e.sfxSeconds / 60) * r.sfxUsdPerMinute +
    (LYRIA ? (e.lyriaUsd ?? 0) : (e.musicSeconds / 60) * r.musicUsdPerMinute);
  return e;
}
function printEstimate(list, label, samples = SAMPLES) {
  const by = Object.fromEntries(ORDER.map((t) => [t, list.filter((a) => a.type === t).length]));
  const e = estimate(list, samples);
  console.log(`\n${label} : ${list.length} assets, ${e.calls} appels`);
  console.log(`  par type      : ${ORDER.map((t) => `${t} ${by[t]}`).join(' · ')}`);
  console.log(
    `  TTS           : ${e.ttsChars.toLocaleString('fr-BE')} caractères (prises comprises)`,
  );
  console.log(
    `  Voice Design  : ${e.designChars.toLocaleString('fr-BE')} caractères d'aperçu (hypothèse de coût)`,
  );
  console.log(
    `  Bruitages     : ${e.sfxSeconds.toFixed(1)} s (${(e.sfxSeconds * MANIFEST.rates.sfxCreditsPerSecond).toLocaleString('fr-BE')} crédits)`,
  );
  console.log(
    `  Musique       : ${e.musicSeconds.toFixed(0)} s (${(e.musicSeconds / 60).toFixed(1)} min)${LYRIA ? ` · Lyria ≈ ${(e.lyriaUsd ?? 0).toFixed(2)} $` : ''}`,
  );
  console.log(`  Stems         : ${e.stems} séparations (coût non publié)`);
  console.log(
    `  ≈ ${e.credits.toLocaleString('fr-BE')} crédits hors musique · ≈ ${e.usd.toFixed(2)} $ au tarif « pay as you go »`,
  );
  return e;
}

// ─── Fichiers ────────────────────────────────────────────────────────────────
const exts = FORMAT === 'both' ? ['ogg', 'webm'] : [FORMAT];
const rawPath = (a, t) =>
  path.join(OUT, 'raw', `${a.out}${a.takes > 1 || t > 1 ? `_t${t}` : ''}.mp3`);
const finalPath = (a, t, ext) =>
  path.join(
    OUT,
    FORMAT === 'both' ? ext : '',
    `${a.out}${a.takes > 1 || t > 1 ? `_t${t}` : ''}.${ext}`,
  );
const done = (a, t) => exts.every((x) => fs.existsSync(finalPath(a, t, x)));
const mkdirFor = (f) => fs.mkdirSync(path.dirname(f), { recursive: true });

const STATE = path.join(OUT, 'state', 'voices.json');
const voices = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
const saveVoices = () => {
  mkdirFor(STATE);
  fs.writeFileSync(STATE, `${JSON.stringify(voices, null, 2)}\n`);
};
/** Voix arrêtées par le porteur du projet (manifeste : `voiceId` des assets voice-design). */
const MANIFEST_VOICES = Object.fromEntries(
  MANIFEST.assets
    .filter((a) => a.type === 'voice-design' && a.voiceId)
    .map((a) => [a.voice, a.voiceId]),
);
function voiceIdFor(v) {
  return (
    process.env[`ELEVENLABS_VOICE_${v.toUpperCase()}`] ??
    MANIFEST_VOICES[v] ??
    voices[v]?.voice_id ??
    null
  );
}

// ─── Post-production (ffmpeg) ────────────────────────────────────────────────
function filterChain(post = {}) {
  const f = [];
  if (post.trim)
    f.push(
      'silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.01',
      'areverse',
      'silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.05',
      'areverse',
    );
  if (post.pitch) {
    const r = 2 ** (post.pitch / 12);
    f.push(
      `asetrate=44100*${r.toFixed(5)}`,
      'aresample=48000',
      `atempo=${(1 / r).toFixed(5)}`,
      'chorus=0.6:0.9:40:0.3:0.25:2',
    );
  }
  if (post.hp) f.push(`highpass=f=${post.hp}`);
  if (post.lp) f.push(`lowpass=f=${post.lp}`);
  if (post.radio)
    f.push(
      'highpass=f=300',
      'lowpass=f=3400',
      'acompressor=threshold=-20dB:ratio=4:attack=5:release=80',
      'asoftclip=type=tanh',
      'volume=-1dB',
    );
  if (post.visio) f.push('highpass=f=200', 'lowpass=f=4000', 'acompressor=threshold=-22dB:ratio=3');
  if (post.pa) f.push('highpass=f=250', 'lowpass=f=5000', 'aecho=0.8:0.6:90|180:0.35|0.2');
  if (post.room === 'wagon') f.push('aecho=0.8:0.5:25|45:0.25|0.15');
  if (post.room === 'podium') f.push('aecho=0.8:0.55:70|140:0.3|0.18');
  if (post.loudnorm) f.push(`loudnorm=I=${post.loudnorm}:TP=-1.5:LRA=11`);
  return f;
}
function ffmpeg(args) {
  return execFileSync(FFMPEG, ['-hide_banner', '-nostats', '-loglevel', 'error', ...args], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
  });
}
function peakDb(file) {
  const out = execFileSync(
    '/bin/sh',
    ['-c', `"${FFMPEG}" -hide_banner -nostats -i "${file}" -af volumedetect -f null - 2>&1`],
    {
      encoding: 'utf8',
    },
  );
  const m = out.match(/max_volume:\s*(-?[\d.]+) dB/);
  return m ? Number(m[1]) : 0;
}
function convert(a, t) {
  const raw = rawPath(a, t);
  const post = a.post ?? {};
  const chain = filterChain(post);
  // Normalisation en crête (bruitages) : mesure après filtres, puis gain.
  let gain = 0;
  if (post.peak !== undefined) {
    const tmp = path.join(OUT, 'raw', '.peak.wav');
    ffmpeg(['-y', '-i', raw, ...(chain.length ? ['-af', chain.join(',')] : []), tmp]);
    gain = post.peak - peakDb(tmp);
    fs.rmSync(tmp, { force: true });
  }
  const tail = [...chain];
  if (gain) tail.push(`volume=${gain.toFixed(2)}dB`);
  if (!post.loop && !post.music)
    tail.push('afade=t=in:d=0.003', 'areverse', 'afade=t=in:d=0.01', 'areverse');
  tail.push('aresample=48000');
  for (const ext of exts) {
    const f = finalPath(a, t, ext);
    mkdirFor(f);
    const codec =
      ext === 'ogg' ? ['-c:a', 'libvorbis', '-q:a', '5'] : ['-c:a', 'libopus', '-b:a', '96k'];
    ffmpeg(['-y', '-i', raw, '-af', tail.join(','), ...codec, f]);
  }
}

// ─── HTTP : file d'attente, débit, reprises ──────────────────────────────────
let lastStart = 0;
let active = 0;
const waiters = [];
async function slot() {
  while (active >= CONCURRENCY) await new Promise((r) => waiters.push(r));
  active += 1;
  const wait = lastStart + INTERVAL - Date.now();
  lastStart = Math.max(Date.now(), lastStart + INTERVAL);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}
function release() {
  active -= 1;
  waiters.shift()?.();
}
async function api(method, url, { json, form, accept = 'audio/mpeg' } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    await slot();
    let res;
    try {
      res = await fetch(`${BASE}${url}`, {
        method,
        headers: {
          'xi-api-key': KEY,
          accept,
          ...(json ? { 'content-type': 'application/json' } : {}),
        },
        body: json ? JSON.stringify(json) : form,
      });
    } catch (err) {
      res = {
        ok: false,
        status: 0,
        statusText: String(err),
        headers: new Headers(),
        text: async () => '',
      };
    } finally {
      release();
    }
    if (res.ok) return res;
    const retriable = [0, 409, 429, 500, 502, 503, 504].includes(res.status);
    const body = await res.text();
    if (!retriable || attempt >= 5)
      throw new Error(`${method} ${url} → ${res.status} ${res.statusText} ${body.slice(0, 400)}`);
    const after = Number(res.headers.get('retry-after')) * 1000 || 1500 * 2 ** (attempt - 1);
    console.warn(`  … ${res.status} sur ${url}, nouvel essai dans ${(after / 1000).toFixed(1)} s`);
    await new Promise((r) => setTimeout(r, after));
  }
}
async function saveAudio(res, file) {
  mkdirFor(file);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

// ─── Générateurs par type ────────────────────────────────────────────────────
const fmt = (a) =>
  `?output_format=${a.type === 'music' ? MANIFEST.defaults.music_output_format : MANIFEST.defaults.output_format}`;

async function voiceDesign(a) {
  const dir = path.join(OUT, path.dirname(a.out));
  const previews = [1, 2, 3].map((i) => path.join(dir, `apercu_${i}.mp3`));
  let ids = voices[a.voice]?.previews;
  if (FORCE || !ids || !previews.every((p) => fs.existsSync(p))) {
    const res = await api('POST', '/v1/text-to-voice/design', {
      json: a.params,
      accept: 'application/json',
    });
    const data = await res.json();
    ids = data.previews.map((p) => p.generated_voice_id);
    data.previews.forEach((p, i) => {
      const f = path.join(dir, `apercu_${i + 1}.mp3`);
      mkdirFor(f);
      fs.writeFileSync(f, Buffer.from(p.audio_base_64, 'base64'));
    });
    voices[a.voice] = {
      ...(voices[a.voice] ?? {}),
      previews: ids,
      voice_id: FORCE ? undefined : voices[a.voice]?.voice_id,
    };
    saveVoices();
    console.log(`  ${a.id} : ${ids.length} aperçus → ${path.relative(OUT, dir)}/`);
  }
  if (!CREATE_VOICES || voiceIdFor(a.voice)) return;
  const pick = Math.min(ids.length, Math.max(1, PICKS[a.voice] ?? a.select + 1));
  const res = await api('POST', '/v1/text-to-voice', {
    json: {
      voice_name: a.name,
      voice_description: a.params.voice_description,
      generated_voice_id: ids[pick - 1],
      labels: a.labels,
      played_not_selected_voice_ids: ids.filter((_, i) => i !== pick - 1),
    },
    accept: 'application/json',
  });
  const data = await res.json();
  voices[a.voice] = { ...voices[a.voice], voice_id: data.voice_id, picked: pick };
  saveVoices();
  console.log(`  ${a.id} : voix créée (aperçu ${pick}) → ${data.voice_id}`);
}

async function tts(a, t) {
  const voiceId = voiceIdFor(a.voice);
  if (!voiceId)
    throw new Error(
      `${a.id} : aucune voix pour « ${a.voice} » (lancer d'abord voice-design ou définir ELEVENLABS_VOICE_${a.voice.toUpperCase()})`,
    );
  const model = TTS_MODEL ?? a.params.model_id;
  const vs = { ...a.params.voice_settings };
  if (model.startsWith('eleven_v4')) {
    delete vs.style;
    delete vs.speed;
  }
  const body = {
    ...a.params,
    model_id: model,
    text: ttsText(a),
    voice_settings: vs,
    seed: (a.params.seed ?? 0) + t,
  };
  if (model === 'eleven_multilingual_v2') delete body.language_code;
  const res = await api('POST', `/v1/text-to-speech/${voiceId}${fmt(a)}`, { json: body });
  await saveAudio(res, rawPath(a, t));
}

async function sfx(a) {
  const res = await api('POST', `/v1/sound-generation${fmt(a)}`, { json: a.params });
  return res;
}

// Lyria (API Gemini, endpoint Interactions) : un prompt texte, pas de seed ni de durée exacte. Le clip
// fait toujours 30 s ; lyria-3.5 suit la durée demandée dans le prompt. Le plan de composition
// d'ElevenLabs est réécrit en sections horodatées « [m:ss - m:ss] », format que Lyria comprend.
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
function lyriaPrompt(a) {
  const secs = Math.round(musicSeconds(a));
  const chunks = a.params.composition_plan?.chunks;
  let body = a.params.prompt ?? '';
  if (chunks?.length) {
    let t0 = 0;
    body = chunks
      .map((c) => {
        const t1 = t0 + c.duration_ms / 1000;
        const line = `[${clock(t0)} - ${clock(t1)}] ${c.text.replace(/[[\]{}]/g, '')}: ${c.positive_styles.join(', ')}${c.negative_styles?.length ? `; avoid ${c.negative_styles.join(', ')}` : ''}.`;
        t0 = t1;
        return line;
      })
      .join('\n');
  }
  const len =
    lyriaModel(a) === 'lyria-3-clip-preview' ? '' : `Total duration: about ${secs} seconds. `;
  return `${body}\n${len}Instrumental only, no vocals, no lyrics.`;
}
async function lyriaMusic(a) {
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY absente (backend lyria)');
  const model = lyriaModel(a);
  for (let attempt = 1; ; attempt += 1) {
    await slot();
    let res;
    try {
      res = await fetch(`${LYRIA_BASE}/interactions`, {
        method: 'POST',
        headers: { 'x-goog-api-key': GEMINI_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ model, input: lyriaPrompt(a) }),
      });
    } catch (err) {
      res = {
        ok: false,
        status: 0,
        statusText: String(err),
        headers: new Headers(),
        text: async () => '',
      };
    } finally {
      release();
    }
    if (res.ok) {
      const data = await res.json();
      const audio = (data.steps ?? [])
        .filter((s) => s.type === 'model_output')
        .flatMap((s) => s.content ?? [])
        .filter((c) => c.type === 'audio' && c.data)
        .at(-1);
      if (!audio)
        throw new Error(
          `${a.id} : réponse Lyria sans bloc audio (${JSON.stringify(data).slice(0, 300)})`,
        );
      return new Response(Buffer.from(audio.data, 'base64'));
    }
    const body = await res.text();
    const retriable = [0, 429, 500, 502, 503, 504].includes(res.status);
    if (!retriable || attempt >= 5)
      throw new Error(`Lyria ${model} → ${res.status} ${res.statusText} ${body.slice(0, 400)}`);
    const after = Number(res.headers.get('retry-after')) * 1000 || 2000 * 2 ** (attempt - 1);
    console.warn(`  … Lyria ${res.status}, nouvel essai dans ${(after / 1000).toFixed(1)} s`);
    await new Promise((r) => setTimeout(r, after));
  }
}

async function music(a, t) {
  if (LYRIA) return lyriaMusic(a);
  const seed = (a.params.seed ?? 0) + t;
  const body = { ...a.params, seed };
  if (MUSIC_MODEL) body.model_id = MUSIC_MODEL;
  // L'API refuse `seed` avec `prompt` (422 « `seed` cannot be used with `prompt` », vérifié le 9 octobre 2026).
  if (body.prompt) delete body.seed;
  try {
    return await api('POST', `/v1/music${fmt(a)}`, { json: body });
  } catch (err) {
    if (!a.fallback) throw err;
    console.warn(
      `  ${a.id} : plan refusé (${String(err.message).slice(0, 120)}), repli « ${a.fallback.model_id} » + prompt`,
    );
    const fb = { ...a.fallback, seed };
    if (fb.prompt) delete fb.seed;
    return api('POST', `/v1/music${fmt(a)}`, { json: fb });
  }
}

async function stemSplit(a) {
  const src = MANIFEST.assets.find((x) => x.id === a.from);
  const file = src && rawPath(src, a.fromTake ?? 1);
  if (!file || !fs.existsSync(file))
    throw new Error(`${a.id} : source absente (${a.from}), générer d'abord la musique`);
  const dir = path.join(OUT, a.out);
  if (!FORCE && fs.existsSync(dir) && fs.readdirSync(dir).length) return;
  const form = new FormData();
  form.append(
    'file',
    new Blob([fs.readFileSync(file)], { type: 'audio/mpeg' }),
    path.basename(file),
  );
  const res = await api('POST', `/v1/music/stem-separation${fmt(a)}`, {
    form,
    accept: 'application/zip',
  });
  const zip = path.join(OUT, 'raw', `${a.out}.zip`);
  await saveAudio(res, zip);
  fs.mkdirSync(dir, { recursive: true });
  execFileSync('unzip', ['-o', '-q', zip, '-d', dir]);
  console.log(
    `  ${a.id} : stems → ${path.relative(OUT, dir)}/ (${fs.readdirSync(dir).join(', ')})`,
  );
}

async function run(a) {
  if (a.type === 'voice-design') return voiceDesign(a);
  if (a.type === 'stem-split') return stemSplit(a);
  const jobs = [];
  for (let t = 1; t <= takesOf(a); t += 1) {
    if (!FORCE && done(a, t)) continue;
    jobs.push(
      (async () => {
        if (FORCE || !fs.existsSync(rawPath(a, t))) {
          if (a.type === 'tts') await tts(a, t);
          else await saveAudio(a.type === 'sfx' ? await sfx(a) : await music(a, t), rawPath(a, t));
        }
        convert(a, t);
        console.log(`  ${a.id} prise ${t} → ${path.relative(OUT, finalPath(a, t, exts[0]))}`);
      })(),
    );
  }
  await Promise.all(jobs);
}

// ─── Programme ───────────────────────────────────────────────────────────────
console.log(
  `Manifeste v${MANIFEST.version} (API vérifiée le ${MANIFEST.verifiedAt}) · sortie : ${OUT}`,
);
const noVoice = [];
function pending(a) {
  if (a.type === 'voice-design')
    return !voiceIdFor(a.voice) && (FORCE || CREATE_VOICES || !voices[a.voice]?.previews);
  if (a.type === 'tts' && !voiceIdFor(a.voice) && !CREATE_VOICES) {
    noVoice.push(a);
    return false;
  }
  if (FORCE) return true;
  if (a.type === 'stem-split') {
    const dir = path.join(OUT, a.out);
    return !fs.existsSync(dir) || fs.readdirSync(dir).length === 0;
  }
  return Array.from({ length: takesOf(a) }, (_, i) => i + 1).some((t) => !done(a, t));
}
const todo = selected.filter(pending);
if (skippedStatus.length)
  console.log(
    `Exclus (déjà validés ou bloqués, --include-validated pour les reprendre) : ${skippedStatus.map((a) => a.id).join(', ')}`,
  );
if (noVoice.length)
  console.log(
    `Sans voix arrêtée (répliques ignorées) : ${[...new Set(noVoice.map((a) => a.voice))].join(', ')} (${noVoice.length} répliques)`,
  );
printEstimate(selected, SAMPLES ? 'Lot d’écoute (sélection)' : 'Sélection');
if (todo.length !== selected.length) printEstimate(todo, 'Reste à générer');
if (DRY) {
  if (!SAMPLES && !ONLY && !TYPES)
    printEstimate(
      MANIFEST.assets.filter((a) => a.sample),
      'Pour mémoire, lot d’écoute (--samples)',
      true,
    );
  process.exit(0);
}
const needsEleven = todo.some((a) => !(LYRIA && a.type === 'music'));
if (needsEleven && !KEY) {
  console.error(
    '\nELEVENLABS_API_KEY absente : rien n’est généré (utiliser --dry-run pour estimer).',
  );
  process.exit(2);
}
if (LYRIA && todo.some((a) => a.type === 'music') && !GEMINI_KEY) {
  console.error('\nGEMINI_API_KEY absente : la musique Lyria n’est pas générée.');
  process.exit(2);
}
if (!YES) {
  console.log('\nGénération dans 5 s (Ctrl+C pour annuler, --yes pour ne pas attendre)…');
  await new Promise((r) => setTimeout(r, 5000));
}
let failed = 0;
for (const type of ORDER) {
  const batch = todo.filter((a) => a.type === type);
  if (!batch.length) continue;
  console.log(`\n── ${type} (${batch.length}) ──`);
  // Les voix d'abord et une à une (la création dépend des aperçus) ; le reste en parallèle borné.
  const results = [];
  if (type === 'voice-design')
    for (const a of batch)
      results.push(
        await run(a).then(
          (v) => ({ status: 'fulfilled', value: v }),
          (reason) => ({ status: 'rejected', reason }),
        ),
      );
  else results.push(...(await Promise.allSettled(batch.map(run))));
  for (const r of results)
    if (r.status === 'rejected') {
      failed += 1;
      console.error(`  ÉCHEC : ${r.reason.message}`);
    }
}
console.log(
  failed
    ? `\nTerminé avec ${failed} échec(s) : relancer reprend là où ça s'est arrêté.`
    : '\nTerminé.',
);
process.exit(failed ? 1 : 0);
