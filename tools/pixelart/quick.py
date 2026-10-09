"""Aperçu rapide d'un module pendant l'itération : python3 quick.py hero [scale]"""
import importlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import contact  # noqa: E402
import lib  # noqa: E402

mod = importlib.import_module(sys.argv[1])
scale = int(sys.argv[2]) if len(sys.argv) > 2 else 4
only = sys.argv[3] if len(sys.argv) > 3 else None
items = []


def emit(folder, name, frames, *a, **k):
    if only and only not in name:
        return
    items.append((folder, name, lib.strip(frames), frames[0].shape[1]))


def emit_image(folder, name, img, *a, **k):
    if only and only not in name:
        return
    items.append((folder, name, img, None))


if hasattr(mod, "build_images"):
    mod.build_images(emit_image)
if hasattr(mod, "build"):
    mod.build(emit)
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "preview", f"quick_{sys.argv[1]}.png")
print(contact.render(items, out, scale=scale), out)
