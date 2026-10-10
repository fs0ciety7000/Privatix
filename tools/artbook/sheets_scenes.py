"""Planches tirées des captures du jeu (`game.mjs stills`) : décors (biomes, hub, arènes), loot et UI,
VFX et télégraphes, fiche de travail du boss final. Chaque planche est décrite par une spec :
une grande image, des images secondaires, des détails recadrés (fractions de l'image source).

    python3 tools/artbook/sheets_scenes.py [--only decor-quais,vfx-boss]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from draw import (
    DANGER, ENEMY, GOLD, HERO, RIM, SODIUM, SOFT, TUNGSTEN, VIOLET_HI, Image, background, caption,
    font, footer, framed, header, hexrgb, label, paragraph, save,
)

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
STILLS = HERE / ".cache" / "game" / "stills"
MODELS = HERE / ".cache" / "models"
OUT = ROOT / "site" / "public" / "artbook" / "planches"
W = 2400


def src(name: str) -> Image.Image:
    return Image.open(STILLS / f"{name}.png").convert("RGBA")


def crop(name: str, box) -> Image.Image:
    """Détail : `box` en fractions (x0, y0, x1, y1) de l'image source."""
    im = src(name)
    x0, y0, x1, y1 = box
    return im.crop((round(x0 * im.width), round(y0 * im.height), round(x1 * im.width), round(y1 * im.height)))


def shot(item) -> Image.Image:
    return crop(item["src"], item["crop"]) if "crop" in item else src(item["src"])


def grid(img, items, box, cols: int, aspect: float = 9 / 16, rim=RIM, gap: int = 28, cap_h: int = 112) -> int:
    x0, y0, x1, _ = box
    cw = (x1 - x0 - gap * (cols - 1)) / cols
    ch = cw * aspect
    y = y0
    for i, it in enumerate(items):
        c, r = i % cols, i // cols
        x = round(x0 + c * (cw + gap))
        yy = round(y0 + r * (ch + cap_h + gap))
        framed(img, shot(it), (x, yy, round(x + cw), round(yy + ch)), rim=hexrgb(it["rim"]) if "rim" in it else rim, focus=it.get("focus", (0.5, 0.5)))
        caption(img, (x + 4, round(yy + ch + 18)), it["title"], it.get("sub"), width=round(cw - 8))
        y = yy + ch + cap_h
    return round(y)


def layout_feature(img, spec, top: int, accent) -> int:
    """Grande image à gauche, deux secondaires à droite, rangée de détails en dessous."""
    main = spec["main"]
    mw = 1560
    mh = round(mw * 9 / 16)
    framed(img, shot(main), (64, top, 64 + mw, top + mh), rim=accent, focus=main.get("focus", (0.5, 0.5)))
    caption(img, (68, top + mh + 18), main["title"], main.get("sub"), width=mw - 8)
    side = spec.get("side", [])
    sx = 64 + mw + 32
    sw = W - 64 - sx
    sh = round(sw * 9 / 16)
    yy = top
    for it in side:
        framed(img, shot(it), (sx, yy, sx + sw, yy + sh), rim=hexrgb(it["rim"]) if "rim" in it else accent, focus=it.get("focus", (0.5, 0.5)))
        caption(img, (sx + 4, yy + sh + 14), it["title"], it.get("sub"), width=sw - 8)
        yy += sh + 150
    y = max(top + mh + 150, yy) + 20
    det = spec.get("details", [])
    if det:
        label(img, (64, y), spec.get("details_title", "Détails"), accent, 22)
        y = grid(img, det, (64, y + 44, W - 64, 0), len(det), aspect=spec.get("details_aspect", 9 / 16), rim=accent)
    return y


def layout_grid(img, spec, top: int, accent) -> int:
    y = top
    for block in spec["blocks"]:
        if block.get("title"):
            label(img, (64, y), block["title"], accent, 22)
            y += 44
        y = grid(img, block["items"], (64, y, W - 64, 0), block.get("cols", 3), aspect=block.get("aspect", 9 / 16), rim=accent) + 30
    return y


def build(spec) -> Image.Image:
    accent = hexrgb(spec.get("accent", "#6FF3FF"))
    # hauteur : on compose sur une grande toile puis on recadre
    img = background(W, 4200, accent)
    y = header(img, spec["title"], spec["eyebrow"], spec.get("subtitle"), accent)
    if spec.get("intro"):
        y = paragraph(img, (64, y + 4), spec["intro"], font("text", 26), 2200, SOFT) + 20
    y += 24
    y = layout_feature(img, spec, y, accent) if spec["layout"] == "feature" else layout_grid(img, spec, y, accent)
    hgt = y + 130
    out = background(W, hgt, accent)
    out.alpha_composite(img.crop((0, 0, W, hgt - 100)))
    footer(out, spec.get("footer", "captures du jeu 3D (play3d.html) · temps virtuel à 30 i/s · preset haut"))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    a = ap.parse_args()
    only = [s for s in a.only.split(",") if s]
    specs = json.loads((HERE / "scenes.json").read_text())["planches"]
    for spec in specs:
        if only and spec["id"] not in only:
            continue
        missing = [n for n in json.dumps(spec).split('"src": "')[1:] if not (STILLS / f"{n.split(chr(34))[0]}.png").exists()]
        if missing:
            print(f"{spec['id']} : captures manquantes ({', '.join(m.split(chr(34))[0] for m in missing)}), planche ignorée")
            continue
        for p in save(build(spec), OUT, spec["id"]):
            print(p.relative_to(ROOT), f"{p.stat().st_size / 1024:.0f} Kio")


if __name__ == "__main__":
    main()
