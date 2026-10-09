#!/usr/bin/env python3
"""Privatix — génération de tous les assets pixel art.

    python3 tools/pixelart/build.py          (ou : npm run assets)

Écrit les PNG dans public/assets/{sprites,tilesets,fonts}/..., le manifeste
machine tools/pixelart/manifest.json (copié dans public/assets/sprites/
manifest.json pour le chargement à l'exécution), la palette .gpl et la planche
de contrôle tools/pixelart/preview/contact_sheet.png.
"""
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import boss  # noqa: E402
import consultant  # noqa: E402
import contact  # noqa: E402
import hero  # noqa: E402
import machines  # noqa: E402
import manager  # noqa: E402
import npcs  # noqa: E402
import palette  # noqa: E402
import props  # noqa: E402
import registry  # noqa: E402
import tiles  # noqa: E402
import ui  # noqa: E402
import vfx  # noqa: E402

FOLDERS = {"player": "sprites/player", "enemies": "sprites/enemies", "bosses": "sprites/bosses"}


def default_pivot(folder, size):
    if folder.startswith("sprites/player") or size == 48 and "enemies" in folder:
        return (24, 44)
    if folder.startswith(("sprites/enemies", "sprites/npcs")) and size == 32:
        return (16, 28)
    if folder.startswith("sprites/bosses"):
        return (size // 2, size - 8)
    if folder.startswith("tilesets/props"):
        return (size // 2, size)
    return (size // 2, size // 2)


def emit(folder, name, frames, durations=None, loop=False, pivot=None, active=None, events=None, notes=None):
    folder = FOLDERS.get(folder, folder)
    size = frames[0].shape[0]
    pivot = pivot or default_pivot(folder, size)
    return registry.emit_strip(folder, name, frames, durations, loop=loop, pivot=pivot, active=active,
                               events=events, notes=notes, group=folder)


def emit_image(folder, name, img, kind="image", group=None, pivot=None, extra=None, preview=True):
    folder = FOLDERS.get(folder, folder)
    return registry.emit_image(folder, name, img, kind=kind, group=group or folder, pivot=pivot, extra=extra,
                               preview=preview)


def write_json(rel, data):
    path = os.path.join(registry.PUBLIC, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)


def _report_orphans(entries):
    """Signale (sans les supprimer : un asset acheté peut y vivre) les PNG de
    public/assets que le manifeste ne référence pas, p. ex. une ancienne bande
    _strip<N> après un changement du nombre de frames."""
    ref = set()
    for e in entries:
        ref.add(e["file"])
        if e.get("normalMap"):
            ref.add(e["normalMap"])
    orphans = []
    for root, _d, files in os.walk(registry.PUBLIC):
        for f in files:
            if f.endswith(".png"):
                rel = os.path.relpath(os.path.join(root, f), os.path.join(registry.ROOT, "public")).replace(os.sep, "/")
                if rel not in ref:
                    orphans.append(rel)
    if orphans:
        print(f"ATTENTION : {len(orphans)} PNG non référencés par le manifeste (anciens fichiers ?) :")
        for o in sorted(orphans):
            print("   ", o)


def main():
    t0 = time.time()
    hero.build(emit)
    consultant.build(emit)
    machines.build(emit)
    manager.build(emit)
    boss.build(emit)
    npcs.build(emit)
    vfx.build(emit)
    vfx.build_images(emit_image)
    ui.build(emit)
    ui.build_images(emit_image)
    props.build(emit)
    props.build_images(emit_image, write_json)
    tiles.build_tiles(registry.emit_raw)

    bad = registry.check_binary_alpha()
    if bad:
        raise SystemExit(f"alpha non binaire : {bad}")

    entries = registry.ENTRIES
    manifest = {
        "generator": "tools/pixelart/build.py",
        "palette": "Privatix Moderne 57 (tools/pixelart/privatix32.gpl)",
        "conventions": {
            "naming": "<entite>_<anim>[_<dir>]_strip<N>.png ; clé de texture = nom sans .png ; clé d'animation "
                      "Phaser = champ 'anim' (<entite>-<anim>[-<dir>])",
            "strips": "bandes horizontales, frames carrées, marge 0, espacement 0, pas de trim, alpha binaire",
            "directions": "down, up, side (dessiné vers la droite ; gauche = flipX)",
            "durations": "ms par frame (Phaser : frames[i].duration)",
            "pivot": "pixels dans la frame ; origin = pivot / taille (setOrigin)",
            "active": "indices (base 0) des frames où la hitbox / le tir est actif",
            "normalMap": "chemin (depuis public/) de la normal map <nom>_n.png, même taille et même alpha que "
                         "le PNG ; RGB = normale (convention OpenGL : X droite, Y haut = vert, Z vers la caméra) ; "
                         "personnages, tilesets et props uniquement (pas les VFX, l'UI ni les lumières)",
        },
        "animations": [e for e in entries if e.get("type") == "spritesheet"],
        "images": [e for e in entries if e.get("type") in ("image", "atlas")],
        "tilesets": [e for e in entries if e.get("type") == "tileset"],
    }
    with open(os.path.join(HERE, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    write_json("sprites/manifest.json", manifest)
    palette.write_gpl(os.path.join(HERE, "privatix32.gpl"))

    os.makedirs(os.path.join(HERE, "preview"), exist_ok=True)
    size = contact.render(registry.PREVIEW, os.path.join(HERE, "preview", "contact_sheet.png"), scale=4,
                          max_width=3072)
    # planches par catégorie (plus faciles à relire)
    groups = {}
    for p in registry.PREVIEW:
        groups.setdefault(p[0].split("/")[-1], []).append(p)
    for g, items in groups.items():
        contact.render(items, os.path.join(HERE, "preview", f"contact_{g}.png"), scale=4, max_width=2400,
                       title=f"Privatix — {g}")
    _report_orphans(entries)
    n_png = sum(1 for e in entries if e["file"].endswith(".png"))
    n_nm = sum(1 for e in entries if e.get("normalMap"))
    n_frames = sum(e.get("frames", 1) for e in manifest["animations"])
    print(f"{n_png} PNG (+ {n_nm} normal maps), {len(manifest['animations'])} animations / {n_frames} frames, "
          f"planche {size[0]}×{size[1]} en {time.time() - t0:.1f} s")


if __name__ == "__main__":
    main()
