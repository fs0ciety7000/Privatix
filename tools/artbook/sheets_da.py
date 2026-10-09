"""Planche « Palette & DA » : couleurs canoniques et leurs rôles, fonds, raretés, recette de lumière,
rampe toon à 3 tons, étages de valeur, typographie. Sources : site/src/styles/tokens.css,
docs/DESIGN_SYSTEM.md, docs/proposals/revue-3d-loot/art_director.md (§ 2.3 à 2.5).

    python3 tools/artbook/sheets_da.py
"""
from __future__ import annotations

import math
from pathlib import Path

from draw import (
    DANGER, INK, MUTE, RIM, SOFT, TEXT, VIOLET, Image, ImageDraw, ImageFilter, background, font, footer, glow,
    header, hexrgb, label, lum, panel, paragraph, save, text,
)

ROOT = Path(__file__).parent.parent.parent
OUT = ROOT / "site" / "public" / "artbook" / "planches"
W, H = 2400, 1930

CANON = [
    ("#FF7A1A", "Orange héros", "L'action du joueur : gilet HV, bouton principal"),
    ("#19C3B1", "Turquoise", "Privatix et ses ennemis"),
    ("#FF3EA5", "Magenta danger", "Néons Privatix et télégraphes, jamais positif"),
    ("#6FF3FF", "Cyan liseré", "Quais, focus, dash, information"),
    ("#6B3FA0", "Violet Privatix", "Marque, autocollants, élites"),
    ("#FFD200", "Or", "Mobilisation, Coup de sifflet"),
    ("#E0302A", "Écharpe", "Écharpe syndicale du héros"),
    ("#14101A", "Encre", "Contour des figurines, bordures"),
]
LIGHTS = [
    ("#FFB347", "Sodium", "Flaques des lampes de quai"),
    ("#FFC27A", "Tungstène", "Îlots chauds de l'OCC"),
    ("#A8B8FF", "Lune froide", "Clé d'ombres des quais"),
    ("#5A5AD0", "Ciel violet", "Ambiance hémisphérique"),
]
NIGHTS = [("#0A0818", "Nuit"), ("#120D24", "Nuit 2"), ("#2A2148", "Ombre violette"), ("#3A1E22", "Ombre prune"), ("#1E2A3C", "Ardoise OCC")]
RARITIES = [("#8A929A", "Réforme"), ("#F2EEE3", "Réglementaire"), ("#3F8CFF", "Homologué"), ("#A86BFF", "Hors-série"), ("#FF8C2B", "Patrimoine")]


def swatch(img, x, y, w, h, hx, name, role=None) -> None:
    c = hexrgb(hx)
    d = ImageDraw.Draw(img)
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((x, y + 8, x + w, y + h + 8), 12, fill=(0, 0, 0, 120))
    img.alpha_composite(sh)
    d.rounded_rectangle((x, y, x + w, y + h), 12, fill=c, outline=INK, width=4)
    fg = INK if lum(c) > 0.45 else TEXT
    text(img, (x + 20, y + h - 52), hx.upper(), font("monob", 24), fg)
    text(img, (x + 20, y + 18), name, font("bold", 28), fg)
    if role:
        paragraph(img, (x, y + h + 18), role, font("text", 21), w, MUTE, 1.35)


def toon_ball(size: int, base, shade, light_dir=(-0.55, -0.65), outline=INK, rim=RIM) -> Image.Image:
    """Sphère en rampe toon 3 tons à décalage de teinte (ombre mélangée vers le violet nuit),
    contour encré et liseré de contre-jour, comme les figurines du jeu."""
    s = size
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    px = img.load()
    r = s * 0.42
    cx = cy = s / 2
    lx, ly = light_dir
    lz = math.sqrt(max(0.0, 1 - lx * lx - ly * ly))
    b = hexrgb(base)
    sh = hexrgb(shade)
    mid = tuple(int(a * 0.6 + c * 0.4) for a, c in zip(b, sh))
    hi = tuple(min(255, int(a * 1.0 + 40)) for a in b)
    for y in range(s):
        for x in range(s):
            nx, ny = (x - cx) / r, (y - cy) / r
            d2 = nx * nx + ny * ny
            if d2 > 1:
                continue
            nz = math.sqrt(1 - d2)
            ndl = nx * lx + ny * ly + nz * lz
            col = sh if ndl < 0.05 else mid if ndl < 0.55 else b
            if ndl > 0.93:
                col = hi
            # liseré : fresnel côté opposé à la lumière
            fres = (1 - nz) ** 3
            back = max(0.0, -(nx * lx + ny * ly))
            if fres * back > 0.18:
                col = tuple(int(a * 0.3 + c * 0.7) for a, c in zip(col, hexrgb("#6FF3FF")))
            px[x, y] = (*col, 255)
    a = img.getchannel("A")
    ring = a.filter(ImageFilter.MaxFilter(9))
    out = Image.new("RGBA", (s, s), (*outline, 0))
    out.putalpha(ring)
    out.alpha_composite(img)
    return out


def main() -> None:
    img = background(W, H, VIOLET)
    y = header(img, "Néon & Ballast", "Palette & direction artistique", "Un cel-shading ferroviaire nocturne : figurines encrées, gares sombres où la lumière forme des flaques", DANGER)
    # ─── couleurs canoniques
    top = y + 40
    panel(img, (64, top, W - 64, top + 490), rim=RIM)
    label(img, (92, top + 28), "Couleurs canoniques · chaque couleur a un rôle", RIM, 20)
    n = len(CANON)
    gap = 26
    sw = (W - 128 - 56 - gap * (n - 1)) / n
    for i, (hx, nm, role) in enumerate(CANON):
        swatch(img, round(92 + i * (sw + gap)), top + 80, round(sw), 300, hx, nm, role)
    # ─── fonds / lumières / raretés
    top2 = top + 530
    third = (W - 128 - 48) / 3
    boxes = [(64 + i * (third + 24), top2, 64 + i * (third + 24) + third, top2 + 470) for i in range(3)]
    titles = ["Fonds : la nuit, jamais le noir", "Lumières de zone", "Raretés : uniquement le butin"]
    sets = [NIGHTS, [(h, n) for h, n, _ in LIGHTS], RARITIES]
    for (x0, y0, x1, y1), t, items in zip(boxes, titles, sets):
        x0, x1 = round(x0), round(x1)
        panel(img, (x0, y0, x1, y1), rim=RIM)
        label(img, (x0 + 28, y0 + 28), t, RIM, 20)
        rows = len(items)
        rh = (y1 - y0 - 100) / rows
        d = ImageDraw.Draw(img)
        for j, (hx, nm) in enumerate(items):
            yy = round(y0 + 80 + j * rh)
            c = hexrgb(hx)
            if t.startswith("Lumières"):
                img.alpha_composite(glow(img.size, (x0 + 80, yy + rh / 2 - 8), (40, 26), c, 230, 14))
                d.ellipse((x0 + 62, yy + rh / 2 - 26, x0 + 98, yy + rh / 2 + 10), fill=c, outline=INK, width=3)
            else:
                d.rounded_rectangle((x0 + 36, yy, x0 + 150, yy + rh - 18), 8, fill=c, outline=INK, width=3)
            text(img, (x0 + 180, yy + 4), nm, font("bold", 26), TEXT)
            sub = hx.upper()
            if t.startswith("Lumières"):
                sub += " · " + next(r for h, n_, r in LIGHTS if h == hx)
            text(img, (x0 + 180, yy + 40), sub, font("mono", 20), MUTE)
    # ─── rampe toon / étages de valeur / typographie
    top3 = top2 + 510
    boxes = [(64, top3, 860, H - 110), (884, top3, 1600, H - 110), (1624, top3, W - 64, H - 110)]
    x0, y0, x1, y1 = boxes[0]
    panel(img, boxes[0], rim=RIM)
    label(img, (x0 + 28, y0 + 28), "Rampe toon · 3 tons à décalage de teinte", RIM, 20)
    balls = [("#FF7A1A", "#3A1E22", "Héros"), ("#19C3B1", "#2A2148", "Ennemi"), ("#B05CFF", "#2A2148", "Élite")]
    for i, (b, sh, nm) in enumerate(balls):
        ball = toon_ball(220, b, sh)
        cx = x0 + 60 + i * 250
        img.alpha_composite(ball, (cx, y0 + 80))
        text(img, (cx + 110, y0 + 312), nm, font("semi", 22), SOFT, anchor="ma")
    paragraph(img, (x0 + 32, y0 + 360), "Ombre mélangée vers la couleur de zone (violet nuit aux quais, prune à l'OCC), contour encré à épaisseur constante, liseré cyan de contre-jour.", font("text", 21), x1 - x0 - 64, MUTE, 1.4)
    x0, y0, x1, y1 = boxes[1]
    panel(img, boxes[1], rim=RIM)
    label(img, (x0 + 28, y0 + 28), "Trois étages de valeur", RIM, 20)
    tiers = [("Émissifs", "> 100 % (HDR, bloom)", "Télégraphes, néons, écrans, VFX", DANGER), ("Acteurs", "45 à 85 %, saturés", "Héros, ennemis, PNJ, butin", hexrgb("#FF7A1A")), ("Décor", "10 à 45 %, désaturé", "Quais, voies, murs, mobilier", hexrgb("#2A2148"))]
    d = ImageDraw.Draw(img)
    for i, (nm, v, who, c) in enumerate(tiers):
        yy = y0 + 84 + i * 130
        d.rounded_rectangle((x0 + 32, yy, x0 + 64, yy + 104), 6, fill=c, outline=INK, width=3)
        text(img, (x0 + 90, yy + 2), nm, font("bold", 30), TEXT)
        text(img, (x0 + 90, yy + 44), v, font("monob", 21), SOFT)
        text(img, (x0 + 90, yy + 76), who, font("text", 21), MUTE)
    x0, y0, x1, y1 = boxes[2]
    panel(img, boxes[2], rim=RIM)
    label(img, (x0 + 28, y0 + 28), "Typographie · polices système", RIM, 20)
    neon = Image.new("RGBA", img.size, (*DANGER, 0))
    text(neon, (x0 + 36, y0 + 84), "PRIVATIX", font("display", 96), (*DANGER, 255), tracking=14)
    img.alpha_composite(neon.filter(ImageFilter.GaussianBlur(14)))
    img.alpha_composite(neon.filter(ImageFilter.GaussianBlur(3)))
    text(img, (x0 + 36, y0 + 84), "PRIVATIX", font("display", 96), (255, 214, 238), tracking=14)
    text(img, (x0 + 36, y0 + 214), "Titres : Arial Black, graisse 900", font("bold", 26), TEXT)
    text(img, (x0 + 36, y0 + 256), "Texte : Segoe UI, system-ui, Roboto", font("text", 24), SOFT)
    label(img, (x0 + 36, y0 + 306), "Libellés HUD : capitales espacées", hexrgb("#FFD9B8"), 20)
    text(img, (x0 + 36, y0 + 350), "Nombres : ui-monospace 12 345", font("mono", 24), MUTE)
    footer(img, "tokens : site/src/styles/tokens.css · règles : docs/DESIGN_SYSTEM.md · DA : art_director.md § 2")
    for p in save(img, OUT, "da-palette"):
        print(p.relative_to(ROOT), f"{p.stat().st_size / 1024:.0f} Kio")


if __name__ == "__main__":
    main()
