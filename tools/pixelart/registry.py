"""Registre des sorties : écrit les PNG et collecte le manifeste machine."""
import os

import numpy as np

import lib

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PUBLIC = os.path.join(ROOT, "public", "assets")

ENTRIES = []  # dicts du manifeste
PREVIEW = []  # (groupe, nom, tableau strip, taille de frame)


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
    ENTRIES.append(entry)
    if preview:
        PREVIEW.append((group or folder, name, img, None))
    return entry


def emit_raw(folder, filename, pil_image, entry_extra, group=None, preview_arr=None):
    """Pour les fichiers déjà en RGBA (tilesets extrudés)."""
    path = os.path.join(PUBLIC, folder, filename)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pil_image.save(path, optimize=True)
    entry = {"file": _rel(path), "texture": filename[:-4]}
    entry.update(entry_extra)
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
    return bad
