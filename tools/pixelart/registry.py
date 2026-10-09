"""Registre des sorties : écrit les PNG et collecte le manifeste machine."""
import os

import numpy as np

import lib
import modern
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PUBLIC = os.path.join(ROOT, "public", "assets")

ENTRIES = []  # dicts du manifeste
PREVIEW = []  # (groupe, nom, tableau strip, taille de frame)


NORMAL_FOLDERS = ("sprites/player", "sprites/enemies", "sprites/bosses", "sprites/npcs", "tilesets")


def wants_normal(folder, name):
    """Normal map pour les personnages, tilesets et props (pas les VFX, l'UI, les lumières)."""
    return folder.startswith(NORMAL_FOLDERS) and not name.startswith("light_")


def write_normal(arr, path_png, cell=None, mode="sprite"):
    """Écrit <nom>_n.png à côté de <nom>.png et renvoie son chemin relatif à public/."""
    nm = modern.normal_map(arr, cell=cell, mode=mode)
    npath = path_png[:-4] + "_n.png"
    Image.fromarray(nm, "RGBA").save(npath, optimize=True)
    return _rel(npath)


def _rel(path):
    return os.path.relpath(path, os.path.join(ROOT, "public")).replace(os.sep, "/")


def emit_strip(folder, name, frames, durations=None, loop=False, pivot=None, active=None,
               events=None, group=None, notes=None, fps=None):
    """Écrit `public/assets/<folder>/<name>.png` (bande horizontale) et l'enregistre.

    name : nom de fichier sans extension, doit finir par _strip<N>.
    durations : liste de durées par frame (ms) ou entier.
    pivot : (x, y) en pixels dans la frame (défaut : centre / ligne des pieds).
    active : liste d'indices de frames actives (hitbox, tir…).
    """
    n = len(frames)
    assert name.endswith(f"_strip{n}"), (name, n)
    h, w = frames[0].shape
    assert h == w, f"{name}: frame non carrée {w}x{h}"
    a = lib.strip(frames)
    assert a.shape[1] <= 2048, f"{name}: bande trop large"
    path = os.path.join(PUBLIC, folder, name + ".png")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lib.save(a, path)
    if durations is None:
        durations = [100] * n
    elif isinstance(durations, int):
        durations = [durations] * n
    assert len(durations) == n, (name, len(durations), n)
    key = name[: name.rindex("_strip")]
    if pivot is None:
        pivot = (w // 2, h)
    entry = {
        "file": _rel(path),
        "texture": name,
        "anim": key.replace("_", "-"),
        "type": "spritesheet",
        "frameWidth": w,
        "frameHeight": h,
        "frames": n,
        "durations": durations,
        "fps": round(1000 * n / max(1, sum(durations)), 2) if fps is None else fps,
        "loop": loop,
        "pivot": {"x": pivot[0], "y": pivot[1]},
        "origin": {"x": round(pivot[0] / w, 4), "y": round(pivot[1] / h, 4)},
        "active": active or [],
    }
    if events:
        entry["events"] = events
    if notes:
        entry["notes"] = notes
    if wants_normal(folder, name):
        entry["normalMap"] = write_normal(a, path, cell=(w, h))
    ENTRIES.append(entry)
    PREVIEW.append((group or folder, name, a, w))
    return entry


def emit_image(folder, name, img, kind="image", group=None, pivot=None, extra=None, preview=True):
    path = os.path.join(PUBLIC, folder, name + ".png")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    lib.save(img, path)
    h, w = img.shape
    entry = {"file": _rel(path), "texture": name, "type": kind, "width": w, "height": h}
    if pivot is not None:
        entry["pivot"] = {"x": pivot[0], "y": pivot[1]}
        entry["origin"] = {"x": round(pivot[0] / w, 4), "y": round(pivot[1] / h, 4)}
    if extra:
        entry.update(extra)
    if wants_normal(folder, name):
        entry["normalMap"] = write_normal(img, path)
    ENTRIES.append(entry)
    if preview:
        PREVIEW.append((group or folder, name, img, None))
    return entry


def emit_raw(folder, filename, pil_image, entry_extra, group=None, preview_arr=None, normal_src=None,
             normal_cell=None):
    """Pour les fichiers déjà en RGBA (tilesets extrudés). normal_src : image
    indexée de même taille d'où dériver la normal map (par cellule)."""
    path = os.path.join(PUBLIC, folder, filename)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pil_image.save(path, optimize=True)
    entry = {"file": _rel(path), "texture": filename[:-4]}
    entry.update(entry_extra)
    if normal_src is not None and wants_normal(folder, filename):
        entry["normalMap"] = write_normal(normal_src, path, cell=normal_cell, mode="surface")
    ENTRIES.append(entry)
    if preview_arr is not None:
        PREVIEW.append((group or folder, filename[:-4], preview_arr, None))
    return entry


def check_binary_alpha():
    """Vérifie l'alpha binaire et la palette de tous les PNG écrits."""
    from PIL import Image

    bad = []
    for e in ENTRIES:
        if not e["file"].endswith(".png"):
            continue
        im = Image.open(os.path.join(ROOT, "public", e["file"])).convert("RGBA")
        al = np.asarray(im)[:, :, 3]
        if not np.all((al == 0) | (al == 255)):
            bad.append(e["file"])
        if e.get("normalMap"):
            nm = np.asarray(Image.open(os.path.join(ROOT, "public", e["normalMap"])).convert("RGBA"))
            if nm.shape[:2] != al.shape or not np.array_equal(nm[:, :, 3], al):
                bad.append(e["normalMap"])
    return bad
