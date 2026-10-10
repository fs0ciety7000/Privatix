#!/usr/bin/env node
// Génération des visuels marketing avec Nano Banana (images Gemini, API Interactions).
// Aucune dépendance npm : Node 18+ (fetch natif). ImageMagick (`convert`) est
// facultatif et ne sert qu'à produire l'aperçu WebP.
//
//   GEMINI_API_KEY=… node tools/marketing/nanobanana.mjs docs/marketing/lot1/jobs.json
//   node tools/marketing/nanobanana.mjs <jobs.json> --dry-run      # n'appelle pas l'API
//   node tools/marketing/nanobanana.mjs <jobs.json> --only logo-a  # un seul job (ids séparés par des virgules)
//   node tools/marketing/nanobanana.mjs <jobs.json> --force        # régénère même si l'image existe
//
// Fichier de jobs :
//   { "outDir": "docs/marketing/lot1", "defaults": { "model", "aspect_ratio", "image_size" },
//     "jobs": [ { "id", "model"?, "aspect_ratio"?, "image_size"?, "prompt", "refs": ["chemin", …] } ] }
// Les chemins (outDir, refs) sont relatifs à la racine du dépôt (dossier courant).
// Chaque job réussi produit <id>.jpg (l'original livré par l'API, qui ne sort que du
// JPEG), <id>-1600.webp et une entrée dans log.json (modèle, références, usage).
// Un job dont l'original existe déjà est sauté (reprise).

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { extname, join } from 'node:path';

const API = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const MAX_REFS = 14;

const args = process.argv.slice(2);
const jobsFile = args.find((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? new Set(args[onlyIdx + 1].split(',')) : null;

if (!jobsFile) {
  console.error('Usage : node tools/marketing/nanobanana.mjs <jobs.json> [--dry-run] [--only id1,id2] [--force]');
  process.exit(2);
}

const exists = (p) => access(p).then(() => true, () => false);
const run = (cmd, argv) =>
  new Promise((resolve, reject) => execFile(cmd, argv, (err) => (err ? reject(err) : resolve())));

async function encodeRef(path) {
  const mime = MIME[extname(path).toLowerCase()];
  if (!mime) throw new Error(`Référence de type inconnu : ${path}`);
  return { type: 'image', mime_type: mime, data: (await readFile(path)).toString('base64') };
}

// Dernier bloc image de la dernière sortie du modèle.
function extractImage(body) {
  let found = null;
  for (const step of body.steps ?? []) {
    if (step.type !== 'model_output') continue;
    for (const c of step.content ?? []) if (c.type === 'image' && c.data) found = c;
  }
  return found;
}

function extractText(body) {
  const out = [];
  for (const step of body.steps ?? [])
    for (const c of step.content ?? []) if (c.type === 'text' && c.text) out.push(c.text);
  return out.join('\n').trim();
}

async function callApi(payload, key) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (res.ok) return JSON.parse(text);
    // 429 / 5xx : on réessaie (3 fois, attente croissante) ; le reste est une erreur franche.
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const wait = 2000 * 2 ** attempt;
      console.warn(`  HTTP ${res.status}, nouvel essai dans ${wait / 1000} s`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`HTTP ${res.status} : ${text.slice(0, 800)}`);
  }
}

const spec = JSON.parse(await readFile(jobsFile, 'utf8'));
const outDir = spec.outDir;
const defaults = spec.defaults ?? {};
const logPath = join(outDir, 'log.json');
const log = (await exists(logPath)) ? JSON.parse(await readFile(logPath, 'utf8')) : {};
const key = process.env.GEMINI_API_KEY;
if (!dryRun && !key) {
  console.error('GEMINI_API_KEY manquante.');
  process.exit(2);
}
await mkdir(outDir, { recursive: true });

let failures = 0;
for (const job of spec.jobs) {
  if (only && !only.has(job.id)) continue;
  const model = job.model ?? defaults.model;
  const refs = job.refs ?? [];
  const master = join(outDir, `${job.id}.jpg`);
  if (refs.length > MAX_REFS) throw new Error(`${job.id} : ${refs.length} références (max ${MAX_REFS})`);
  for (const r of refs) if (!(await exists(r))) throw new Error(`${job.id} : référence introuvable ${r}`);

  const response_format = {
    type: 'image',
    mime_type: 'image/jpeg',
    aspect_ratio: job.aspect_ratio ?? defaults.aspect_ratio ?? '1:1',
    image_size: job.image_size ?? defaults.image_size ?? '2K',
  };
  console.log(`• ${job.id} — ${model}, ${response_format.aspect_ratio} ${response_format.image_size}, ${refs.length} réf.`);

  if (!force && (await exists(master))) {
    console.log('  déjà généré, sauté');
    continue;
  }
  if (dryRun) {
    console.log(`  [dry-run] ${job.prompt.length} caractères de prompt ; réf. : ${refs.join(', ') || 'aucune'}`);
    continue;
  }

  const input = [{ type: 'text', text: job.prompt }, ...(await Promise.all(refs.map(encodeRef)))];
  try {
    const body = await callApi({ model, input, response_format }, key);
    const img = extractImage(body);
    if (!img) {
      const reason = extractText(body) || JSON.stringify(body).slice(0, 600);
      throw new Error(`aucune image renvoyée (refus du filtre ?) : ${reason}`);
    }
    if (img.mime_type && img.mime_type !== 'image/jpeg') console.warn(`  image renvoyée en ${img.mime_type}`);
    await writeFile(master, Buffer.from(img.data, 'base64'));
    const webp = join(outDir, `${job.id}-1600.webp`);
    try {
      await run('convert', [master, '-resize', '1600x1600>', '-quality', '86', webp]);
    } catch {
      console.warn('  ImageMagick absent : pas d\'aperçu WebP');
    }
    log[job.id] = {
      model,
      ...response_format,
      refs,
      usage: body.usage ?? null,
      note: extractText(body) || undefined,
      date: new Date().toISOString(),
    };
    await writeFile(logPath, JSON.stringify(log, null, 2) + '\n');
    console.log(`  ✓ ${master}`);
  } catch (err) {
    failures++;
    log[job.id] = { model, refs, error: String(err.message ?? err), date: new Date().toISOString() };
    await writeFile(logPath, JSON.stringify(log, null, 2) + '\n');
    console.error(`  ✗ ${err.message ?? err}`);
  }
}
process.exit(failures ? 1 : 0);
