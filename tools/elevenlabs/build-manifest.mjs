// Construit tools/elevenlabs/manifest.json et les listes de docs/audio/AUDIO_BIBLE.md (sections entre
// les marqueurs <!-- AUTO:nom --> … <!-- /AUTO:nom -->) à partir du catalogue (tools/elevenlabs/catalogue/),
// source unique. À relancer après toute modification du catalogue :
//   node tools/elevenlabs/build-manifest.mjs [--check]
// --check : n'écrit rien, échoue si manifest.json ou la bible ne sont pas à jour, ou si le catalogue
// des bruitages ne couvre pas exactement les `SfxId` de src/audio/sfx.ts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VOICES } from './catalogue/voices.mjs';
import { LINES } from './catalogue/lines.mjs';
import { SFX_FAMILIES, AMBIENCES, AMBIENT_ONESHOTS } from './catalogue/sfx.mjs';
import { MUSIC, MUSIC_SAMPLE_SECONDS } from './catalogue/music.mjs';
import { TRAILER_MUSIC, TRAILER_SFX, TRAILER_GAME_SFX } from './catalogue/trailer.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const MANIFEST = path.join(HERE, 'manifest.json');
const BIBLE = path.join(ROOT, 'docs/audio/AUDIO_BIBLE.md');
const CHECK = process.argv.includes('--check');

/** Vérification des endpoints et modèles sur la doc officielle (elevenlabs.io/docs, fichiers .md). */
const VERIFIED_AT = '2026-10-09';

const TTS_MODEL = 'eleven_v3';
const errors = [];

// ─── Voix ────────────────────────────────────────────────────────────────────
const voiceById = new Map(VOICES.map((v) => [v.id, v]));
const realVoice = (id) => {
  const v = voiceById.get(id);
  if (!v) throw new Error(`Voix inconnue : ${id}`);
  return v.alias ? voiceById.get(v.alias) : v;
};

const voiceAssets = VOICES.filter((v) => !v.alias).map((v, i) => {
  if (v.preview.length < 100 || v.preview.length > 1000)
    errors.push(`Aperçu de ${v.id} : ${v.preview.length} caractères (100 à 1000 exigés).`);
  if (v.design.length > 1000)
    errors.push(`Description de ${v.id} trop longue (${v.design.length}).`);
  return {
    id: `voice.${v.id}`,
    type: 'voice-design',
    sample: Boolean(v.key),
    voice: v.id,
    name: `Privatix — ${v.name}`,
    out: `voices/${v.id}/apercu`,
    params: {
      voice_description: v.design,
      model_id: 'eleven_ttv_v3',
      text: v.preview,
      loudness: 0.5,
      guidance_scale: 5,
      seed: 7100 + i,
    },
    labels: {
      projet: 'privatix',
      personnage: v.id,
      ...(v.fictive ? { satire: 'caricature-autorisee' } : {}),
    },
    select: 0,
    ...(v.saved
      ? { status: 'sauvegardée', voiceId: v.saved.voiceId, workspaceName: v.saved.workspaceName }
      : {}),
    ...(v.pending
      ? {
          status: 'en attente',
          generatedVoiceId: v.pending.generatedVoiceId,
          reason: v.pending.reason,
        }
      : {}),
    post: { loudnorm: -18 },
  };
});

// ─── Dialogues ───────────────────────────────────────────────────────────────
/** Stabilité eleven_v3 : 0 « Creative » (efforts, cris), 0,5 « Natural », 1 « Robust » (annonces). */
function stabilityFor(l) {
  if (l.voice === 'gare') return 1;
  if (/^\[(short effort|effort|strained|quick exhale|pained|shouting|panicking)/.test(l.text))
    return 0;
  return 0.5;
}

const ttsAssets = LINES.map((l) => {
  const v = realVoice(l.voice);
  const post = { ...(v.post ?? {}), trim: true, ...(l.radio ? { radio: true } : {}) };
  const blocked = v.pending
    ? { status: 'bloquée', reason: `voix en attente : ${v.pending.reason}` }
    : {};
  return {
    id: `vo.${l.id}`,
    type: 'tts',
    sample: Boolean(l.sample),
    voice: v.id,
    out: `dialogues/${v.id}/${l.id}`,
    takes: l.takes ?? 2,
    sampleTakes: 1,
    ...blocked,
    ...(l.validated ? { status: 'validé' } : {}),
    params: {
      text: l.text,
      model_id: TTS_MODEL,
      language_code: 'fr',
      voice_settings: {
        stability: stabilityFor(l),
        similarity_boost: 0.75,
        use_speaker_boost: true,
      },
      seed: 4200,
    },
    post,
    meta: {
      ctx: l.ctx,
      emo: l.emo,
      src: l.src,
      ...(l.fictive ? { fictive: true } : {}),
      ...(l.trailer ? { trailer: true } : {}),
    },
  };
});

// ─── Bruitages ───────────────────────────────────────────────────────────────
const sfxAssets = [];
for (const fam of SFX_FAMILIES)
  for (const [id, intent, prompt, seconds, takes, treatment, opts = {}] of fam.items)
    sfxAssets.push({
      id: `sfx.${id}`,
      type: 'sfx',
      sample: Boolean(opts.sample),
      out: `sfx/${fam.id}/${id}`,
      takes,
      sampleTakes: 2,
      params: {
        text: prompt,
        duration_seconds: seconds,
        prompt_influence: opts.influence ?? 0.3,
        model_id: 'eleven_text_to_sound_v2',
      },
      post: { ...fam.default.post, trim: true },
      ...(opts.validated ? { status: 'validé', validated: opts.validated } : {}),
      meta: { family: fam.id, intent, treatment, keep: opts.keep ?? 'replace', sfxId: id },
    });

const ambAssets = [
  ...AMBIENCES.map(([id, intent, prompt, seconds, takes]) => ({
    id,
    type: 'sfx',
    sample: false,
    out: `ambiances/${id.replace('amb.', '')}`,
    takes,
    params: {
      text: prompt,
      duration_seconds: seconds,
      prompt_influence: 0.35,
      loop: true,
      model_id: 'eleven_text_to_sound_v2',
    },
    post: { hp: 30, lp: 9000, loudnorm: -30, loop: true },
    meta: { family: 'ambiance', intent },
  })),
  ...AMBIENT_ONESHOTS.map(([id, intent, prompt, seconds, takes]) => ({
    id,
    type: 'sfx',
    sample: false,
    out: `ambiances/ponctuels/${id.replace('amb1.', '')}`,
    takes,
    params: {
      text: `${prompt}, single isolated sound effect, no music, no voice`,
      duration_seconds: seconds,
      prompt_influence: 0.4,
      model_id: 'eleven_text_to_sound_v2',
    },
    post: { hp: 40, lp: 9000, peak: -12, trim: true },
    meta: { family: 'ambiance-ponctuel', intent },
  })),
];

// ─── Musique ─────────────────────────────────────────────────────────────────
const musicAssets = [];
for (const m of MUSIC) {
  const instrumental = !m.vocals;
  const base = {
    type: 'music',
    params: {
      prompt: m.prompt,
      model_id: 'music_v2',
      ...(instrumental ? { force_instrumental: true } : {}),
      seed: 1212,
    },
    post: { loudnorm: -16, music: true },
    meta: { title: m.title, use: m.use, bpm: m.bpm, key: m.key, loop: m.loop },
  };
  musicAssets.push({
    ...base,
    id: m.id,
    sample: false,
    out: `musique/${m.id.replace('ost.', '')}`,
    takes: 2,
    params: { ...base.params, music_length_ms: m.seconds * 1000 },
  });
  if (m.sample)
    musicAssets.push({
      ...base,
      id: `${m.id}.extrait`,
      sample: true,
      out: `musique/extraits/${m.id.replace('ost.', '')}_20s`,
      takes: 1,
      params: { ...base.params, music_length_ms: MUSIC_SAMPLE_SECONDS * 1000 },
    });
  if (m.layers)
    musicAssets.push({
      id: `${m.id}.stems`,
      type: 'stem-split',
      sample: false,
      from: m.id,
      fromTake: 1,
      out: `musique/stems/${m.id.replace('ost.', '')}`,
      takes: 1,
      params: {},
      meta: { layers: m.layers, title: m.title },
    });
}

// ─── Trailer ─────────────────────────────────────────────────────────────────
const trailerAssets = [
  {
    id: TRAILER_MUSIC.id,
    type: 'music',
    sample: false,
    out: 'trailer/musique-60s',
    takes: 3,
    params: {
      model_id: 'music_v2',
      composition_plan: {
        chunks: TRAILER_MUSIC.plan.map(
          ({ text, duration_ms, positive_styles, negative_styles }) => ({
            text,
            duration_ms,
            positive_styles,
            negative_styles,
          }),
        ),
      },
      seed: 712,
    },
    // Repli (hypothèse B) si le plan v2 est refusé : prompt simple de 60 s, modèle music_v1.
    fallback: {
      model_id: 'music_v1',
      music_length_ms: 60000,
      force_instrumental: true,
      prompt:
        'One-minute game trailer score: cozy lo-fi Rhodes intro (8 s), railway whistle then building D minor combat groove at 100 BPM (12 s), big drop with brass riff and arpeggio (14 s), E-flat phrygian boss climax with low brass ending in an abrupt stop at 41 seconds, low drone (4 s), tender slow Rhodes resolving to D major (10 s), short warm brass fanfare and held final chord (5 s). Instrumental only.',
    },
    post: { loudnorm: -14, music: true },
    meta: { title: TRAILER_MUSIC.title, plan: TRAILER_MUSIC.plan.map((p) => p.at) },
  },
  ...TRAILER_SFX.map(([id, at, intent, prompt, seconds, takes]) => ({
    id,
    type: 'sfx',
    sample: false,
    out: `trailer/sfx/${id.replace('trailer.', '')}`,
    takes,
    params: {
      text: `${prompt}, single isolated sound effect, no music, no voice`,
      duration_seconds: seconds,
      prompt_influence: 0.5,
      model_id: 'eleven_text_to_sound_v2',
    },
    post: { hp: 30, lp: 12000, peak: -3, trim: true },
    meta: { family: 'trailer', at, intent },
  })),
];

const assets = [
  ...voiceAssets,
  ...ttsAssets,
  ...sfxAssets,
  ...ambAssets,
  ...musicAssets,
  ...trailerAssets,
];

// ─── Contrôles ───────────────────────────────────────────────────────────────
const ids = new Set();
for (const a of assets) {
  if (ids.has(a.id)) errors.push(`Identifiant en double : ${a.id}`);
  ids.add(a.id);
  if (a.type === 'sfx' && (a.params.duration_seconds < 0.5 || a.params.duration_seconds > 30))
    errors.push(`${a.id} : durée hors de [0,5 ; 30] s`);
  if (a.type === 'tts' && a.params.text.length > 5000) errors.push(`${a.id} : texte trop long`);
}
const sfxSrc = fs.readFileSync(path.join(ROOT, 'src/audio/sfx.ts'), 'utf8');
const gameIds = [...sfxSrc.matchAll(/^ {2}([a-zA-Z0-9]+): \{/gm)].map((m) => m[1]);
const catIds = sfxAssets.map((a) => a.meta.sfxId);
const missing = gameIds.filter((x) => !catIds.includes(x));
const extra = catIds.filter((x) => !gameIds.includes(x));
if (missing.length) errors.push(`SfxId sans prompt : ${missing.join(', ')}`);
if (extra.length) errors.push(`Prompts sans SfxId : ${extra.join(', ')}`);
for (const id of TRAILER_GAME_SFX)
  if (!catIds.includes(id)) errors.push(`Trailer : SFX inconnu ${id}`);
for (const v of VOICES.filter((x) => x.key && !x.alias)) {
  const n = ttsAssets.filter((a) => a.voice === v.id && a.sample).length;
  if (n !== 2) errors.push(`Voix clé ${v.id} : ${n} répliques d'écoute (2 attendues).`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const manifest = {
  $comment:
    'Généré par tools/elevenlabs/build-manifest.mjs depuis tools/elevenlabs/catalogue/ : ne pas éditer à la main. Schéma : tools/elevenlabs/README.md.',
  version: 1,
  verifiedAt: VERIFIED_AT,
  api: {
    base: 'https://api.elevenlabs.io',
    auth: 'en-tête xi-api-key (variable ELEVENLABS_API_KEY)',
    endpoints: {
      tts: 'POST /v1/text-to-speech/{voice_id}?output_format=…',
      sfx: 'POST /v1/sound-generation?output_format=…',
      music: 'POST /v1/music?output_format=…',
      voiceDesign: 'POST /v1/text-to-voice/design',
      voiceCreate: 'POST /v1/text-to-voice',
      stemSplit: 'POST /v1/music/stem-separation (multipart, réponse ZIP)',
    },
    models: {
      tts: [
        'eleven_v3 (défaut : balises d’émotion, 5 000 caractères)',
        'eleven_v4 (le plus récent ; stability + similarity seulement)',
        'eleven_multilingual_v2 (sans balises)',
      ],
      voiceDesign: ['eleven_ttv_v3', 'eleven_multilingual_ttv_v2'],
      sfx: ['eleven_text_to_sound_v2 (0,5 à 30 s, loop)'],
      music: [
        'music_v2 (défaut ici)',
        'music_v1 (défaut de l’API pendant la transition)',
        'music_v2_5',
      ],
    },
  },
  defaults: { output_format: 'mp3_44100_128', music_output_format: 'mp3_44100_128' },
  rates: {
    $comment:
      'Tarifs « pay as you go » de l’API relevés sur elevenlabs.io/pricing/api le 2026-10-09 (hors promotions). Crédits : 1 caractère TTS = 1 crédit, effet sonore à durée fixée = 40 crédits/s (doc Sound effects).',
    ttsUsdPer1kChars: 0.08,
    sfxUsdPerMinute: 0.12,
    musicUsdPerMinute: 0.15,
    sfxCreditsPerSecond: 40,
    ttsCreditsPerChar: 1,
    voiceDesignNote: 'non publié : estimé comme le texte d’aperçu (3 aperçus par appel), hypothèse',
  },
  counts: Object.fromEntries(
    ['voice-design', 'tts', 'sfx', 'music', 'stem-split'].map((t) => [
      t,
      assets.filter((a) => a.type === t).length,
    ]),
  ),
  assets,
};

// ─── Listes de la bible ──────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const sections = {};

sections.sfx = SFX_FAMILIES.map((fam) => {
  const rows = fam.items.map(([id, intent, prompt, seconds, takes, treatment, opts = {}]) => {
    const flags = [
      opts.sample ? '**écoute**' : '',
      opts.validated ? `**validé** (generation_id \`${opts.validated.generationId}\`)` : '',
      opts.keep === 'synth' ? 'synthèse prioritaire' : '',
      opts.keep === 'layer' ? 'couche sur la synthèse' : '',
    ]
      .filter(Boolean)
      .join(', ');
    return `| \`${id}\` | ${esc(intent)} | ${esc(prompt.split(', single isolated')[0])} | ${seconds} s | ${takes} | ${esc(treatment)}${flags ? ` · ${flags}` : ''} |`;
  });
  return [
    `#### ${fam.name}`,
    '',
    `Traitement commun : ${fam.default.treatment}.`,
    '',
    '| Événement | Intention | Prompt (EN) | Durée | Prises | Traitement |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}).join('\n');

sections.voices = VOICES.map((v) => {
  const f = v.fiche;
  const lines = LINES.filter((l) =>
    v.alias
      ? l.voice === v.id || (l.trailer && v.id === 'narration')
      : l.voice === v.id && !l.trailer,
  );
  const table = lines.length
    ? [
        '',
        '| Réf. | Contexte | Texte (balises eleven_v3) | Émotion | Source |',
        '|---|---|---|---|---|',
        ...lines.map(
          (l) =>
            `| \`${l.id}\`${l.sample ? ' **écoute**' : ''}${l.validated ? ' **validée**' : ''} | ${esc(l.ctx)} | ${esc(l.text)}${l.fictive ? ' *(réplique fictive)*' : ''} | ${esc(l.emo)} | ${l.src}${l.radio ? ', radio' : ''} |`,
        ),
      ].join('\n')
    : '';
  return [
    `#### ${v.name}${v.key ? ' — voix clé' : ''}`,
    '',
    v.saved
      ? v.saved.library
        ? `- **État** : **arrêtée** : voix de bibliothèque (\`voice_id\` \`${v.saved.voiceId}\`, « ${v.saved.workspaceName} ») ; le prompt Voice Design ci-dessous reste la référence de jeu, il n’est pas à produire.`
        : `- **État** : **validée et sauvegardée** (\`voice_id\` \`${v.saved.voiceId}\`, nom actuel dans le workspace « ${v.saved.workspaceName} », à renommer « Privatix — … »).`
      : v.pending
        ? `- **État** : **aperçu validé, en attente** (\`generated_voice_id\` \`${v.pending.generatedVoiceId}\`) : ${v.pending.reason}. Aucune réplique produite tant que la voix n’est pas sauvegardée.`
        : v.alias
          ? ''
          : '- **État** : à concevoir (Voice Design), en attente d’un emplacement de voix libre.',
    `- **Âge** : ${f.age} · **Timbre** : ${f.timbre} · **Accent** : ${f.accent} · **Débit** : ${f.debit} · **Émotion** : ${f.emotion}`,
    `- **Direction** : ${f.direction}`,
    v.design
      ? `- **Prompt Voice Design** (\`eleven_ttv_v3\`) : « ${v.design} »`
      : `- **Voix** : reprend \`${v.alias}\`.`,
    v.preview ? `- **Texte d’aperçu** : « ${v.preview} »` : '',
    table,
    '',
  ]
    .filter((x) => x !== '')
    .join('\n');
}).join('\n');

sections.music = [
  '| # | Titre | Usage | Durée | Tempo | Tonalité | Instrumentation | Courbe d’intensité | Boucle |',
  '|---|---|---|---|---|---|---|---|---|',
  ...MUSIC.map(
    (m, i) =>
      `| ${i + 1} | **${esc(m.title)}**${m.sample ? ' (extrait d’écoute 20 s)' : ''} | ${esc(m.use)} | ${Math.floor(m.seconds / 60)}:${String(m.seconds % 60).padStart(2, '0')} | ${m.bpm} | ${esc(m.key)} | ${esc(m.instruments)} | ${esc(m.curve)} | ${esc(m.loop)} |`,
  ),
  '',
  '**Stems des morceaux à couches** (mix complet généré, puis séparé par `POST /v1/music/stem-separation`) :',
  '',
  ...MUSIC.filter((m) => m.layers).map((m) => `- ${m.title} : ${m.layers.join(' · ')}`),
  '',
  '**Prompts (EN)** :',
  '',
  ...MUSIC.map((m) => `- \`${m.id}\` : ${esc(m.prompt)}${m.note ? ` *${esc(m.note)}*` : ''}`),
  '',
].join('\n');

sections.ambiances = [
  '| Réf. | Lieu | Prompt (EN) | Durée | Prises |',
  '|---|---|---|---|---|',
  ...AMBIENCES.map(
    ([id, intent, prompt, s, t]) =>
      `| \`${id}\` | ${esc(intent)} | ${esc(prompt)} | ${s} s, boucle | ${t} |`,
  ),
  '',
  '**Ponctuels d’ambiance** (déclenchés au hasard, comme `ambientEvents` et `hubEvents` de `music.ts`) :',
  '',
  '| Réf. | Son | Prompt (EN) | Durée | Prises |',
  '|---|---|---|---|---|',
  ...AMBIENT_ONESHOTS.map(
    ([id, intent, prompt, s, t]) =>
      `| \`${id}\` | ${esc(intent)} | ${esc(prompt)} | ${s} s | ${t} |`,
  ),
  '',
].join('\n');

sections.trailer = [
  '**Musique 60 s** (`trailer.musique-60s`, plan de composition `music_v2`, 3 prises) :',
  '',
  '| TC | Section | Styles (EN) |',
  '|---|---|---|',
  ...TRAILER_MUSIC.plan.map(
    (p) =>
      `| ${p.at} | ${esc(p.text)} | ${esc(p.positive_styles.join(', '))} ; sans : ${esc(p.negative_styles.join(', '))} |`,
  ),
  '',
  '**Effets propres au trailer** :',
  '',
  '| Réf. | TC | Intention | Prompt (EN) | Durée | Prises |',
  '|---|---|---|---|---|---|',
  ...TRAILER_SFX.map(
    ([id, at, intent, prompt, s, t]) =>
      `| \`${id}\` | ${at} | ${esc(intent)} | ${esc(prompt)} | ${s} s | ${t} |`,
  ),
  '',
  `**Effets du jeu à régénérer en priorité pour le trailer** : ${TRAILER_GAME_SFX.map((x) => `\`${x}\``).join(', ')}.`,
  '',
].join('\n');

const byType = (t) => assets.filter((a) => a.type === t);
sections.counts = [
  '| Type | Assets | dont lot d’écoute |',
  '|---|---|---|',
  ...['voice-design', 'tts', 'sfx', 'music', 'stem-split'].map(
    (t) => `| ${t} | ${byType(t).length} | ${byType(t).filter((a) => a.sample).length} |`,
  ),
  `| **Total** | **${assets.length}** | **${assets.filter((a) => a.sample).length}** |`,
  '',
].join('\n');

function fillBible(text) {
  let out = text;
  for (const [name, body] of Object.entries(sections)) {
    const re = new RegExp(`(<!-- AUTO:${name} -->)[\\s\\S]*?(<!-- /AUTO:${name} -->)`);
    if (!re.test(out)) {
      console.error(`Marqueur AUTO:${name} absent de la bible.`);
      process.exit(1);
    }
    out = out.replace(re, `$1\n\n${body}\n$2`);
  }
  return out;
}

const json = `${JSON.stringify(manifest, null, 2)}\n`;
const bibleIn = fs.readFileSync(BIBLE, 'utf8');
const bibleOut = fillBible(bibleIn);
if (CHECK) {
  const stale = [];
  if (!fs.existsSync(MANIFEST) || fs.readFileSync(MANIFEST, 'utf8') !== json)
    stale.push('manifest.json');
  if (bibleIn !== bibleOut) stale.push('AUDIO_BIBLE.md');
  if (stale.length) {
    console.error(`Pas à jour : ${stale.join(', ')} (relancer build-manifest.mjs).`);
    process.exit(1);
  }
  console.log('Manifeste et bible à jour.');
} else {
  fs.writeFileSync(MANIFEST, json);
  fs.writeFileSync(BIBLE, bibleOut);
  console.log(
    `manifest.json : ${assets.length} assets (${Object.entries(manifest.counts)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}) ; bible mise à jour.`,
  );
}
