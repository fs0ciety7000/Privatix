"""Encodage de l'hologramme (appelé par render.mjs) : recadre et réduit les images brutes (lanczos),
puis écrit le WebP animé (alpha, boucle infinie) et l'affiche fixe.

Pillow plutôt que ffmpeg pour le WebP : ffmpeg (libwebp_anim) encode l'alpha sans perte, ce qui
double le poids ; Pillow expose `alpha_quality` (alpha avec perte légère, invisible une fois le
filtre hologramme appliqué) et `minimize_size`.

    python3 encode.py <dossier> <x> <y> <w> <h> <hauteur> <ips> <qualité> <qualité_alpha> <webp> <affiche>
"""
import glob
import os
import sys

from PIL import Image

src, x, y, w, h, height, fps, q, aq, out, poster = sys.argv[1:12]
x, y, w, h, height, fps, q, aq = (int(v) for v in (x, y, w, h, height, fps, q, aq))
files = sorted(glob.glob(os.path.join(src, 'f*.png')))
if not files:
    sys.exit(f'aucune image dans {src}')
width = round(w * height / h / 2) * 2


def load(path: str) -> Image.Image:
    return Image.open(path).convert('RGBA').crop((x, y, x + w, y + h)).resize((width, height), Image.LANCZOS)


frames = [load(f) for f in files]
frames[0].save(out, save_all=True, append_images=frames[1:], duration=round(1000 / fps), loop=0,
               quality=q, alpha_quality=aq, method=6, minimize_size=True)
frames[0].save(poster, quality=85, alpha_quality=90, method=6)
print(f'{len(frames)} images {width}×{height}')
