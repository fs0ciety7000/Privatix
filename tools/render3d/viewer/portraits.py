"""Composition des portraits du site vitrine : rendu transparent de `portraits.mjs` → fond sombre néon
(dégradé nuit, halo de la couleur du rôle, flaque de lumière au sol, vignette), cadrage automatique
sur la silhouette, export WebP 2x (960 px) et 1x (480 px).

    python3 portraits.py <dossier des PNG bruts> <dossier de sortie> [--only manager,auditeur]

Nécessite Pillow. Les couleurs viennent des tokens du site (site/src/styles/tokens.css).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

NIGHT_TOP, NIGHT_BOTTOM = (22, 14, 46), (8, 6, 18)
# rôle → (halo, flaque au sol, liseré du sol)
ROLES = {
    "hero": ((255, 179, 71), (255, 122, 26), (255, 176, 74)),
    "enemy": ((107, 63, 160), (25, 195, 177), (111, 243, 255)),
    "elite": ((176, 92, 255), (107, 63, 160), (176, 92, 255)),
    "boss": ((255, 62, 165), (107, 63, 160), (255, 62, 165)),
    "npc": ((255, 194, 122), (255, 179, 71), (255, 194, 122)),
    # raretés d'équipement (tokens --rar-*)
    "rar1": ((138, 146, 154), (90, 96, 104), (138, 146, 154)),
    "rar2": ((242, 238, 227), (150, 146, 140), (242, 238, 227)),
    "rar3": ((63, 140, 255), (40, 90, 200), (63, 140, 255)),
    "rar4": ((168, 107, 255), (107, 63, 160), (168, 107, 255)),
    "rar5": ((255, 140, 43), (255, 210, 0), (255, 140, 43)),
}


def gradient(size: int) -> Image.Image:
    g = Image.new("RGB", (1, 256))
    for y in range(256):
        t = y / 255
        g.putpixel((0, y), tuple(int(a + (b - a) * t) for a, b in zip(NIGHT_TOP, NIGHT_BOTTOM)))
    return g.resize((size, size), Image.BILINEAR)


def glow(size: int, center: tuple[float, float], radius: tuple[float, float], color, alpha: int, blur: float) -> Image.Image:
    layer = Image.new("RGBA", (size, size), (*color, 0))
    d = ImageDraw.Draw(layer)
    cx, cy = center
    rx, ry = radius
    d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=(*color, alpha))
    return layer.filter(ImageFilter.GaussianBlur(blur))


def compose(raw: Image.Image, role: str, size: int = 960, fill: float = 0.8, foot: float = 0.88, wide: float = 0.86) -> Image.Image:
    halo, pool, ring = ROLES[role]
    raw = raw.convert("RGBA")
    a = raw.getchannel("A")
    solid = a.point(lambda v: 255 if v > 200 else 0)
    bbox = solid.getbbox()
    if not bbox:
        raise SystemExit("rendu vide")
    x0, y0, x1, y1 = bbox
    w, h = x1 - x0, y1 - y0
    k = min(fill * size / h, wide * size / w)
    # cadrage : silhouette centrée, pieds sur la ligne `foot`
    big = raw.resize((round(raw.width * k), round(raw.height * k)), Image.LANCZOS)
    ox = round(size / 2 - (x0 + w / 2) * k)
    oy = round(foot * size - y1 * k)
    fig = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    fig.alpha_composite(big, (max(0, ox), max(0, oy)), (max(0, -ox), max(0, -oy)))
    cx = size / 2
    feet_y = foot * size
    # ombre portée : on l'estompe loin des pieds (la carte d'ombre de la visionneuse est bornée)
    fa = fig.getchannel("A")
    keep = fa.point(lambda v: 255 if v > 200 else 0).filter(ImageFilter.MaxFilter(9))
    pool_m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(pool_m).ellipse((cx - size * 0.36, feet_y - size * 0.1, cx + size * 0.36, feet_y + size * 0.07), fill=255)
    pool_m = pool_m.filter(ImageFilter.GaussianBlur(size * 0.05))
    mask = ImageChops.lighter(keep, pool_m)
    fig.putalpha(ImageChops.multiply(fa, mask))
    bg = gradient(size).convert("RGBA")
    bg.alpha_composite(glow(size, (cx, feet_y - h * k * 0.55), (size * 0.36, size * 0.42), halo, 120, size * 0.09))
    bg.alpha_composite(glow(size, (cx, feet_y), (size * 0.42, size * 0.07), pool, 150, size * 0.035))
    ring_l = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(ring_l)
    d.ellipse((cx - size * 0.4, feet_y - size * 0.055, cx + size * 0.4, feet_y + size * 0.055), outline=(*ring, 170), width=max(2, size // 240))
    bg.alpha_composite(ring_l.filter(ImageFilter.GaussianBlur(size / 900)))
    bg.alpha_composite(glow(size, (cx, feet_y), (size * 0.4, size * 0.055), ring, 40, size * 0.012))
    # contre-jour : halo coloré qui épouse la silhouette (alpha flouté, teinté)
    sil = fig.getchannel("A").point(lambda v: 255 if v > 200 else 0)
    edge = Image.new("RGBA", (size, size), (*halo, 0))
    edge.putalpha(sil.filter(ImageFilter.GaussianBlur(size / 90)).point(lambda v: int(v * 0.55)))
    bg.alpha_composite(edge)
    bg.alpha_composite(fig)
    # vignette
    vig = Image.new("L", (size, size), 0)
    ImageDraw.Draw(vig).ellipse((-size * 0.25, -size * 0.2, size * 1.25, size * 1.25), fill=255)
    vig = vig.filter(ImageFilter.GaussianBlur(size * 0.12))
    dark = Image.new("RGBA", (size, size), (6, 4, 14, 255))
    out = Image.composite(bg, dark, vig)
    return out.convert("RGB")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("raw")
    ap.add_argument("out")
    ap.add_argument("--spec", default=str(Path(__file__).parent / "specs" / "portraits.json"))
    ap.add_argument("--only", default="")
    ap.add_argument("--quality", type=int, default=80)
    args = ap.parse_args()
    only = [s for s in args.only.split(",") if s]
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    for s in json.loads(Path(args.spec).read_text()):
        if only and s["file"] not in only:
            continue
        raw = Image.open(Path(args.raw) / f"{s['file']}.png")
        frame = s.get("frame", {})
        img = compose(raw, s.get("role", "enemy"), 960, frame.get("fill", 0.8), frame.get("foot", 0.88), frame.get("wide", 0.86))
        p2 = out / f"{s['file']}.webp"
        p1 = out / f"{s['file']}-480.webp"
        img.save(p2, "WEBP", quality=args.quality, method=6)
        img.resize((480, 480), Image.LANCZOS).save(p1, "WEBP", quality=args.quality + 2, method=6)
        print(f"{p2.name:22s} {p2.stat().st_size / 1024:6.1f} Kio   {p1.name:26s} {p1.stat().st_size / 1024:6.1f} Kio")


if __name__ == "__main__":
    main()
