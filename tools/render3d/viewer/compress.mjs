// Compression des GLB exportés par export_glb.py : déduplication, quantification, meshopt
// (EXT_meshopt_compression + KHR_mesh_quantization). Côté Three.js : GLTFLoader.setMeshoptDecoder.
// Usage : node compress.mjs a.glb b.glb …  (fichiers réécrits en place)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, resample } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

for (const file of process.argv.slice(2)) {
  const doc = await io.read(file);
  await doc.transform(
    dedup(),
    prune({ keepAttributes: true, keepLeaves: true }),
    resample({ tolerance: 1e-4 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  await io.write(file, doc);
}
