"""Pipeline 3D → pixel art (méthode Dead Cells).

Usage :
  .venv/bin/python build.py                      # tous les personnages
  .venv/bin/python build.py hero --anims idle,run --dirs side --preview
  .venv/bin/python build.py npcs:marcel,fatou --preview   # entités choisies d'un module multi-entités
  .venv/bin/python build.py --recap                       # + planche preview/recap.png de tout le manifeste

Écrit les bandes `<entité>_<anim>[_<dir>]_strip<N>.png` et leurs normal maps `_n.png` dans
public/assets/sprites/<catégorie>/, et met à jour tools/render3d/manifest.json (lu par le jeu,
prioritaire sur le manifeste du générateur 2D pour les mêmes clés d'animation).
"""
from __future__ import annotations

import argparse
import importlib
import json
import os
import sys
import time

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import render  # noqa: E402
from post import to_pixel_art  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
PUBLIC = os.path.join(ROOT, "public")
MANIFEST = os.path.join(HERE, "manifest.json")
PREVIEW = os.path.join(HERE, "preview")
CHARACTERS = ["hero", "consultant", "borne", "drone", "manager", "auditeur", "npcs"]
FACING = {"down": 0.0, "up": 180.0, "side": 90.0}


def entities_of(name: str) -> list:
    """Un module de personnage expose un seul ENTITY, ou une liste ENTITIES (ex. npcs.py) d'objets ayant
    les mêmes attributs (ENTITY, CATEGORY, FRAME, PIVOT, PX_PER_UNIT, build, ANIMS, SMEARS, TOGGLES).
    `npcs:marcel,fatou` ne rend que ces entités."""
    modname, _, only = name.partition(":")
    mod = importlib.import_module(f"characters.{modname}")
    ents = list(getattr(mod, "ENTITIES", [mod]))
    if only:
        wanted = only.split(",")
        ents = [e for e in ents if e.ENTITY in wanted]
    return ents


def render_character(name: str, only_anims: list[str] | None, only_dirs: list[str] | None) -> list[dict]:
    entries = []
    for ent in entities_of(name):
        entries += render_entity(ent, only_anims, only_dirs)
    return entries


def render_entity(mod, only_anims: list[str] | None, only_dirs: list[str] | None) -> list[dict]:
    print(f"  · {mod.ENTITY}", flush=True)
    sc = render.reset_scene()
    render.setup_camera(sc, mod.FRAME, mod.PX_PER_UNIT, mod.PIVOT)
    char = mod.build()
    pr = render.PassRenderer(sc, char.parts)
    entries = []
    for anim, (n, durations, loop, directional, fn, active, events) in mod.ANIMS.items():
        if only_anims and anim not in only_anims:
            continue
        dirs = ["down", "up", "side"] if directional else ["down"]
        for d in dirs:
            if only_dirs and d not in only_dirs and directional:
                continue
            strip = np.zeros((mod.FRAME, mod.FRAME * n, 4), dtype=np.uint8)
            nstrip = np.zeros_like(strip)
            nstrip[..., 0] = 128
            nstrip[..., 1] = 128
            nstrip[..., 2] = 255
            for i in range(n):
                pose = fn(i, n)
                char.pose(pose["rot"], pose["root"], FACING[d], offsets=pose.get("offsets"), scales=pose.get("scales"))
                smears, toggles = getattr(mod, "SMEARS", []), getattr(mod, "TOGGLES", [])
                for obj, _ in char.parts:
                    base = obj.name.split(".")[0]
                    if base in smears:
                        obj.hide_render = base not in pose["smear"]
                    elif base in toggles:
                        obj.hide_render = base not in pose.get("show", [])
                color, nmap = to_pixel_art(pr.render())
                strip[:, i * mod.FRAME : (i + 1) * mod.FRAME] = color
                nstrip[:, i * mod.FRAME : (i + 1) * mod.FRAME] = nmap
            suffix = f"_{d}" if directional else ""
            key = f"{mod.ENTITY}_{anim}{suffix}_strip{n}"
            rel = f"assets/sprites/{mod.CATEGORY}/{key}.png"
            reln = f"assets/sprites/{mod.CATEGORY}/{key}_n.png"
            os.makedirs(os.path.join(PUBLIC, os.path.dirname(rel)), exist_ok=True)
            Image.fromarray(strip, "RGBA").save(os.path.join(PUBLIC, rel))
            Image.fromarray(nstrip, "RGBA").save(os.path.join(PUBLIC, reln))
            entry = {
                "file": rel,
                "texture": key,
                "anim": f"{mod.ENTITY}-{anim}" + (f"-{d}" if directional else ""),
                "type": "spritesheet",
                "frameWidth": mod.FRAME,
                "frameHeight": mod.FRAME,
                "frames": n,
                "durations": durations,
                "loop": loop,
                "pivot": {"x": mod.PIVOT[0], "y": mod.PIVOT[1]},
                "origin": {"x": round(mod.PIVOT[0] / mod.FRAME, 4), "y": round(mod.PIVOT[1] / mod.FRAME, 4)},
                "active": active,
                "events": events,
                "normalMap": reln,
                "source": "render3d",
            }
            entries.append(entry)
            print(f"  {key}", flush=True)
    return entries


def _sheet(strips: list[tuple[Image.Image, int]], out: str, max_w: int = 2560, small_scale: int = 3) -> None:
    """Planche lisible : ×`small_scale` pour les petits cadres, ×1 au-delà de 112 px ; les bandes trop
    longues reviennent à la ligne ; damier discret pour distinguer les frames."""
    rows = []
    for im, fw in strips:
        sc = small_scale if fw <= 112 else 1
        per = max(1, max_w // (fw * sc))
        n = im.width // fw
        for s0 in range(0, n, per):
            part = im.crop((s0 * fw, 0, min(n, s0 + per) * fw, im.height))
            rows.append((part.resize((part.width * sc, part.height * sc), Image.NEAREST), fw * sc))
    gap = 2
    w = max(r.width for r, _ in rows)
    h = sum(r.height + gap for r, _ in rows)
    sheet = Image.new("RGBA", (w, h), (40, 46, 70, 255))
    y = 0
    for r, fw in rows:
        for k in range(r.width // fw):
            if k % 2:
                sheet.paste((46, 53, 80, 255), (k * fw, y, (k + 1) * fw, y + r.height))
        sheet.alpha_composite(r, (0, y))
        y += r.height + gap
    sheet.save(out)


def contact_sheet(entries: list[dict], out: str, scale: int = 3) -> None:
    _sheet([(Image.open(os.path.join(PUBLIC, e["file"])), e["frameWidth"]) for e in entries], out, small_scale=scale)


def recap_sheet(out: str, categories: tuple[str, ...] = ("enemies", "bosses", "npcs", "player"), scale: int = 2) -> None:
    """Planche récapitulative de toutes les bandes render3d du manifeste (regroupées par catégorie)."""
    with open(MANIFEST) as f:
        anims = [a for a in json.load(f)["animations"] if a["file"].split("/")[2] in categories]
    order = {c: i for i, c in enumerate(categories)}
    anims.sort(key=lambda a: (order[a["file"].split("/")[2]], a["anim"]))
    _sheet([(Image.open(os.path.join(PUBLIC, a["file"])), a["frameWidth"]) for a in anims], out, small_scale=scale)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("characters", nargs="*", default=CHARACTERS)
    ap.add_argument("--anims")
    ap.add_argument("--dirs")
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--recap", action="store_true", help="planche récapitulative de tout le manifeste (preview/recap.png)")
    args = ap.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:])
    only_anims = args.anims.split(",") if args.anims else None
    only_dirs = args.dirs.split(",") if args.dirs else None
    manifest = {"animations": []}
    if os.path.exists(MANIFEST):
        with open(MANIFEST) as f:
            manifest = json.load(f)
    t0 = time.time()
    all_entries = []
    for name in args.characters:
        print(f"[render3d] {name}", flush=True)
        entries = render_character(name, only_anims, only_dirs)
        all_entries += entries
        new_keys = {e["anim"] for e in entries}
        manifest["animations"] = [a for a in manifest["animations"] if a["anim"] not in new_keys] + entries
    manifest["animations"].sort(key=lambda a: a["anim"])
    with open(MANIFEST, "w") as f:
        json.dump(manifest, f, indent=1, ensure_ascii=False)
    if args.preview and all_entries:
        os.makedirs(PREVIEW, exist_ok=True)
        contact_sheet(all_entries, os.path.join(PREVIEW, "contact_preview.png"))
    if args.recap:
        os.makedirs(PREVIEW, exist_ok=True)
        recap_sheet(os.path.join(PREVIEW, "recap.png"))
    print(f"[render3d] {len(all_entries)} bandes en {time.time() - t0:.1f} s")


if __name__ == "__main__":
    main()
