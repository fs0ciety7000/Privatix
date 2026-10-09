// Variantes allégées (LOD) des GLB pour le preset de qualité « bas » : simplification meshoptimizer
// de chaque primitive (bords verrouillés : les pièces rigides par os gardent leur silhouette, couleurs
// de sommet et attribut `_OUTLINE` conservés), puis recompression meshopt. Écrit
// `public/models/lod/<nom>.glb` et les référence dans `public/models/lod/manifest.json` (fichier à part :
// export_glb.py réécrit le manifeste principal) ; le jeu les charge quand le preset est « bas »
// (src/view/models/ModelLibrary.ts). Relancer après chaque nouvel export des GLB.
//
// Usage (depuis tools/render3d/viewer) :
//   node lod.mjs                 tous les personnages au-dessus du budget, ratio 0,5
//   node lod.mjs --ratio 0.4 hero consultant
//   node lod.mjs --items         idem pour les pièces d'équipement
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, meshopt, prune, simplify, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(here, '../../../public');
const MANIFEST = join(PUBLIC, 'models/manifest.json');
const LOD_MANIFEST = join(PUBLIC, 'models/lod/manifest.json');

/** Budgets de triangles (docs/proposals/revue-3d-loot/lead_developer.md § 4.8). */
const BUDGET = { hero: 4000, enemy: 2000, elite: 4000, boss: 8000, npc: 3000 };

const args = process.argv.slice(2);
let ratio = 0.5;
let doItems = false;
const names = [];
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--ratio') ratio = Number(args[++i]);
  else if (args[i] === '--items') doItems = true;
  else names.push(args[i]);
}

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
let lods = { characters: {}, items: {} };
try {
  lods = { ...lods, ...JSON.parse(readFileSync(LOD_MANIFEST, 'utf8')) };
} catch {
  // Premier passage.
}

function triangles(doc) {
  let n = 0;
  for (const m of doc.getRoot().listMeshes())
    for (const p of m.listPrimitives()) n += (p.getIndices()?.getCount() ?? 0) / 3;
  return n;
}

async function lod(entry, name, table) {
  const src = join(PUBLIC, entry.file);
  const doc = await io.read(src);
  const before = triangles(doc);
  await doc.transform(
    dequantize(),
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.004, lockBorder: true }),
    prune({ keepAttributes: true, keepLeaves: true }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  const after = triangles(doc);
  const file = `models/lod/${name}.glb`;
  const out = join(PUBLIC, file);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, await io.writeBinary(doc));
  table[name] = { file, triangles: after, bytes: statSync(out).size, source: entry.triangles };
  console.log(`${name.padEnd(22)} ${String(before).padStart(6)} → ${String(after).padStart(6)} triangles`);
}

if (doItems) {
  for (const [name, it] of Object.entries(manifest.items))
    if (names.length === 0 || names.includes(name)) await lod(it, name, lods.items);
} else {
  for (const [name, c] of Object.entries(manifest.characters)) {
    const over = c.triangles > (BUDGET[c.kind] ?? 4000);
    if (names.length > 0 ? names.includes(name) : over) await lod(c, name, lods.characters);
  }
}
writeFileSync(LOD_MANIFEST, `${JSON.stringify(lods, null, 2)}\n`);
