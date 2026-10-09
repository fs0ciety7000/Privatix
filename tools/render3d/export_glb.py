"""Export GLB des personnages 3D toon (armature + maillage skinné rigide par os + clips + sockets).

    cd tools/render3d
    .venv/bin/python export_glb.py                      # tout : personnages + équipement
    .venv/bin/python export_glb.py hero consultant      # quelques entités
    .venv/bin/python export_glb.py items                # seulement l'équipement du héros
    .venv/bin/python export_glb.py --raw                # sans compression meshopt
    .venv/bin/python export_glb.py --list               # liste les entités

Sorties : public/models/<entité>.glb, public/models/items/<objet>.glb, public/models/manifest.json.
Voir SKELETON.md (contrat) et README.md (poids, limites).
"""
from __future__ import annotations

import argparse
import importlib
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))

import bpy  # noqa: E402

from glb import blend  # noqa: E402
from glb.geo import Model  # noqa: E402

OUT = ROOT / "public" / "models"
VIEWER = HERE / "viewer"

# entité → (module glb/chars/<module>.py, fonction du modèle, fonction des clips).
# Ordre = ordre de priorité de production.
CHARS = {
    "hero": ("hero", "model", "clips"),
    "consultant": ("consultant", "model", "clips"),
    "discosaure": ("discosaure", "model", "clips"),
    "furet": ("furet", "model", "clips"),
    "dirupo": ("dirupo", "model", "clips"),
    "borne": ("machines", "borne", "borne_clips"),
    "drone": ("machines", "drone", "drone_clips"),
    "manager": ("manager", "model", "clips"),
    "auditeur": ("auditeur", "model", "clips"),
    "fluidifieur": ("fluidifieur", "model", "clips"),
    "josiane": ("npcs", "josiane", "josiane_clips"),
    "bene": ("npcs", "bene", "bene_clips"),
    "kevin": ("npcs", "kevin", "kevin_clips"),
}


def _mod(name: str):
    return importlib.import_module(f"glb.chars.{CHARS[name][0]}")


def export_character(name: str) -> dict:
    mod = _mod(name)
    blend.reset_scene()
    model: Model = getattr(mod, CHARS[name][1])()
    arm = blend.build_armature(model)
    mesh = blend.build_mesh(model, f"{name}_mesh", arm=arm)
    clips = getattr(mod, CHARS[name][2])()
    runtime = list(model.meta.get("runtime_bones") or getattr(mod, "RUNTIME_BONES", ()))
    blend.bake_clips(arm, clips, skip_rot=set(runtime))
    path = OUT / f"{name}.glb"
    blend.export(path)
    del mesh
    sockets = [b for b, v in model.bones.items() if not v.deform]
    return {
        "file": f"models/{name}.glb",
        "kind": model.meta.get("kind", "enemy"),
        "height": model.meta.get("height"),
        "radius": model.meta.get("radius"),
        "outline": f"#{model.meta.get('outline', 0x14101A):06X}",
        "rim": f"#{model.meta.get('rim', 0x6FF3FF):06X}",
        "bones": len(model.bones) - len(sockets),
        "sockets": sockets,
        "runtimeBones": runtime,
        "triangles": model.tri_count(),
        "clips": {c.name: {"duration": round(c.duration, 4), "loop": c.loop, **({"events": c.events} if c.events else {})} for c in clips},
        "equipment": model.meta.get("equipment", {}),
    }


def export_item(item: Model) -> dict:
    blend.reset_scene()
    skinned = bool(item.meta.get("skinned"))
    if skinned:
        arm = blend.build_armature(item)
        blend.build_mesh(item, f"{item.name}_mesh", arm=arm)
    else:
        obj = blend.build_mesh(item, f"{item.name}_mesh")
        tip = item.meta.get("tip")
        if tip:
            e = bpy.data.objects.new("tip", None)
            bpy.context.scene.collection.objects.link(e)
            e.parent = obj
            e.location = blend.to_b(tip)
    path = OUT / "items" / f"{item.name}.glb"
    blend.export(path, animations=False)
    meta = {k: v for k, v in item.meta.items() if k != "tip"}
    if "tip" in item.meta:
        meta["tip"] = list(item.meta["tip"])
    return {"file": f"models/items/{item.name}.glb", "triangles": item.tri_count(), **meta}


def compress(paths: list[Path]) -> str:
    """meshopt (quantification + compression EXT_meshopt_compression) via gltf-transform."""
    script = VIEWER / "compress.mjs"
    if (VIEWER / "node_modules" / "@gltf-transform" / "core").exists() and shutil.which("node"):
        cmd = ["node", str(script), *map(str, paths)]
    elif shutil.which("npx"):
        cmd = None
        for p in paths:
            r = subprocess.run(["npx", "--yes", "@gltf-transform/cli@4.2.1", "meshopt", str(p), str(p)], capture_output=True, text=True)
            if r.returncode != 0:
                return f"brut (npx gltf-transform a échoué : {r.stderr.strip()[:200]})"
        return "meshopt (npx)"
    else:
        return "brut (node/npx introuvable)"
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        return f"brut (compression échouée : {r.stderr.strip()[:300]})"
    return "meshopt"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("names", nargs="*", help="entités (hero, consultant, discosaure, furet, dirupo, items) ; vide = tout")
    ap.add_argument("--raw", action="store_true", help="ne pas compresser (meshopt)")
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()
    if args.list:
        print("\n".join([*CHARS, "items"]))
        return
    names = args.names or [*CHARS, "items"]
    OUT.mkdir(parents=True, exist_ok=True)
    man_path = OUT / "manifest.json"
    manifest = json.loads(man_path.read_text()) if man_path.exists() else {"version": 1, "characters": {}, "items": {}}
    manifest.setdefault("characters", {})
    manifest.setdefault("items", {})
    written: list[Path] = []
    for n in names:
        t0 = time.time()
        if n == "items":
            for it in _mod("hero").items():
                info = export_item(it)
                manifest["items"][it.name] = info
                written.append(ROOT / "public" / info["file"])
                print(f"  item {it.name:22s} {info['triangles']:6d} tris")
            continue
        if n not in CHARS:
            raise SystemExit(f"entité inconnue : {n} (voir --list)")
        info = export_character(n)
        manifest["characters"][n] = info
        written.append(ROOT / "public" / info["file"])
        print(f"{n:12s} {info['triangles']:6d} tris  {info['bones']} os  {len(info['clips'])} clips  ({time.time() - t0:.1f} s)")
    mode = "brut"
    raw_sizes = {str(p): p.stat().st_size for p in written}
    if not args.raw:
        mode = compress(written)
    for p in written:
        rel = str(p.relative_to(ROOT / "public"))
        size = p.stat().st_size
        for sec in ("characters", "items"):
            for info in manifest[sec].values():
                if info["file"] == rel:
                    info["bytes"] = size
                    info["bytesRaw"] = raw_sizes[str(p)]
                    info["compression"] = mode
        print(f"  {rel:40s} {raw_sizes[str(p)] / 1024:7.1f} Kio brut → {size / 1024:7.1f} Kio ({mode})")
    manifest["skeletonContract"] = "tools/render3d/SKELETON.md"
    man_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"manifeste : {man_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
