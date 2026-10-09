// Inspection d'un GLB (nœuds, primitives, attributs, clips) : node inspect.mjs a.glb b.glb …
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

for (const file of process.argv.slice(2)) {
  const root = (await io.read(file)).getRoot();
  console.log(`== ${file}`);
  for (const n of root.listNodes())
    if (n.getMesh() || n.getSkin())
      console.log(`  nœud ${n.getName()} → ${n.getMesh()?.getName()} skin=${!!n.getSkin()}`);
  let tris = 0;
  for (const m of root.listMeshes())
    for (const p of m.listPrimitives()) {
      const sem = p
        .listSemantics()
        .map((s) => {
          const a = p.getAttribute(s);
          return `${s}:${a.getComponentType()}×${a.getElementSize()}${a.getNormalized() ? 'n' : ''}`;
        })
        .join(' ');
      const t = (p.getIndices()?.getCount() ?? 0) / 3;
      tris += t;
      console.log(`  primitive ${p.getMaterial()?.getName()} ${t} tri : ${sem}`);
    }
  console.log(`  triangles ${tris}`);
  console.log(`  clips ${root.listAnimations().map((a) => a.getName()).join(', ')}`);
}
