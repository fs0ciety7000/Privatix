"""Planches « Personnages » : model sheets (turnaround, silhouette, palette, taille relative, poses
clés), tenues de rareté du héros, gamme des tailles. Entrées : rendus de `models.mjs`.

    python3 tools/artbook/sheets_characters.py [--only hero,furet]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from draw import (
    clean,
    DANGER, ENEMY, GOLD, HERO, INK, MUTE, PANEL2, RIM, ROLE, SOFT, TEXT, Image, ImageDraw, background,
    edge_glow, font, footer, glow, header, hexrgb, label, load, lum, panel, paragraph, paste_scaled, pill,
    recolor, rgbhex, save, silhouette, solid_bbox, text, union,
)

_raw_load = load


def load(p: Path) -> Image.Image:  # noqa: F811 — rendus sans ombre lointaine
    return clean(_raw_load(p))


HERE = Path(__file__).parent
ROOT = HERE.parent.parent
CACHE = HERE / ".cache" / "models"
OUT = ROOT / "site" / "public" / "artbook" / "planches"
SPEC = json.loads((HERE / "characters.json").read_text())
MANIFEST = json.loads((ROOT / "public" / "models" / "manifest.json").read_text())
TURN = ["Face", "3/4", "Profil", "Dos"]
W, H = 2400, 1720


def fr(v: float, d: int = 2) -> str:
    return f"{v:.{d}f}".replace(".", ",")


def palette(images: list[Image.Image], n: int = 8, outline=None) -> list[tuple[tuple[int, int, int], float]]:
    """Couleurs dominantes des pixels opaques (hors contour encré), par fréquence."""
    px = []
    for im in images:
        small = im.resize((im.width // 3, im.height // 3), Image.NEAREST)
        for r, g, b, a in small.get_flattened_data() if hasattr(small, 'get_flattened_data') else small.getdata():
            if a > 250:
                px.append((r, g, b))
    if outline:
        ol = outline
        px = [p for p in px if sum(abs(a - b) for a, b in zip(p, ol)) > 40]
    px = [p for p in px if lum(p) > 0.03]
    strip = Image.new("RGB", (len(px), 1))
    strip.putdata(px)
    q = strip.quantize(colors=n + 4, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()[: (n + 4) * 3]
    counts = sorted(q.getcolors(), reverse=True)
    out: list[tuple[tuple[int, int, int], float]] = []
    total = len(px)
    for cnt, idx in counts:
        c = tuple(pal[idx * 3 : idx * 3 + 3])
        if any(sum(abs(a - b) for a, b in zip(c, o)) < 36 for o, _ in out):
            continue
        out.append((c, cnt / total))
        if len(out) == n:
            break
    return out


def strip(img, ims, labels, subs, box, rim, top_pad: int, bottom_pad: int, sep: bool = False):
    """Rangée de figurines à la même échelle, largeur des cases proportionnelle à chaque silhouette,
    pieds alignés sur un sol commun. Renvoie (échelle, sol, haut, bas, boîtes)."""
    x0, y0, x1, y1 = box
    bbs = [solid_bbox(v, 40) for v in ims]
    top = min(b[1] for b in bbs)
    bot = max(b[3] for b in bbs)
    gap = 56
    pad = 16
    widths = [b[2] - b[0] + 2 * pad for b in bbs]
    avail = x1 - x0 - 120 - gap * (len(ims) - 1)
    ch = y1 - y0 - top_pad - bottom_pad
    k = min(ch / (bot - top), avail / sum(widths))
    used = sum(w * k for w in widths) + gap * (len(ims) - 1)
    x = x0 + 90 + (x1 - x0 - 120 - used) / 2
    ground = y1 - bottom_pad
    d = ImageDraw.Draw(img)
    for i, (v, b) in enumerate(zip(ims, bbs)):
        w = widths[i] * k
        cx = x + w / 2
        if sep and i:
            xs = x - gap / 2
            d.line([(xs, y0 + 70), (xs, y1 - 30)], fill=(255, 255, 255, 22), width=2)
        img.alpha_composite(glow(img.size, (cx, ground - 4), (w * 0.42 + 10, 14), rim, 70, 10))
        paste_scaled(img, v, (b[0] - pad, top, b[2] + pad, bot), k, (cx, ground))
        text(img, (cx, ground + 26), labels[i], font("bold", 24), TEXT, anchor="ma")
        if subs:
            text(img, (cx, ground + 58), subs[i], font("mono", 18), MUTE, anchor="ma")
        x += w + gap
    return k, ground, top, bot, bbs


def turnaround(img, c, box, rim) -> None:
    """Quatre vues à l'échelle commune, pieds alignés, règle de hauteur (manifeste)."""
    x0, y0, x1, y1 = box
    panel(img, box, rim=rim)
    label(img, (x0 + 28, y0 + 26), "Turnaround", rim, 20)
    views = [load(CACHE / c["id"] / f"turn-{i}.png") for i in range(4)]
    k, ground, top, bot, bbs = strip(img, views, [t.upper() for t in TURN], None, box, rim, 120, 90)
    d = ImageDraw.Draw(img)
    d.line([(x0 + 70, ground), (x1 - 30, ground)], fill=(*rim, 140), width=3)
    hm = MANIFEST["characters"][c["model"]]["height"]
    rest = bbs[0]
    ppm = (rest[3] - rest[1]) * k / hm
    gf = ground - (bot - rest[3]) * k
    rx = x0 + 52
    d.line([(rx, gf), (rx, gf - hm * ppm)], fill=(*MUTE, 255), width=2)
    step = 0.5 if hm <= 2.6 else 1.0
    v = 0.0
    while v <= hm + 1e-6:
        yy = gf - v * ppm
        d.line([(rx - 10, yy), (rx + 10, yy)], fill=(*MUTE, 255), width=2)
        text(img, (rx - 16, yy), fr(v, 1), font("mono", 18), MUTE, anchor="rm")
        v += step
    topy = gf - hm * ppm
    for xx in range(int(x0 + 80), int(x1 - 30), 18):
        d.line([(xx, topy), (xx + 9, topy)], fill=(*rim, 110), width=2)
    text(img, (x1 - 36, topy - 10), f"{fr(hm)} m", font("monob", 22), rim, anchor="rb")


def poses(img, c, box, rim) -> None:
    x0, y0, x1, y1 = box
    panel(img, box, rim=rim)
    label(img, (x0 + 28, y0 + 26), "Poses clés", rim, 20)
    n = len(c["poses"])
    ims = [load(CACHE / c["id"] / f"pose-{i}.png") for i in range(n)]
    strip(img, ims, [p[0] for p in c["poses"]], [p[1] for p in c["poses"]], (x0 - 40, y0, x1 + 10, y1), rim, 80, 100, sep=True)


def silhouettes(img, c, box) -> None:
    """Test de lisibilité : la silhouette noire seule doit suffire à reconnaître le personnage."""
    x0, y0, x1, y1 = box
    panel(img, box, rim=None, fill=(226, 221, 244))
    label(img, (x0 + 28, y0 + 26), "Silhouette", INK, 20)
    a = load(CACHE / c["id"] / "turn-1.png")
    # pose d'action la plus parlante : la 3e (attaque) si elle existe
    pi = 2 if len(c["poses"]) > 2 else len(c["poses"]) - 1
    b = load(CACHE / c["id"] / f"pose-{pi}.png")
    items = [silhouette(a), silhouette(b)]
    bbs = [solid_bbox(i, 200) for i in items]
    cw = (x1 - x0 - 60) / 2
    ch = y1 - y0 - 100
    for i, (it, bb) in enumerate(zip(items, bbs)):
        k = min(ch / (bb[3] - bb[1]), (cw - 20) / (bb[2] - bb[0]))
        cx = x0 + 30 + cw * i + cw / 2
        paste_scaled(img, it, bb, k, (cx, y1 - 34))


def sizes(img, c, box, rim) -> None:
    """Taille relative au héros (hauteurs du manifeste), silhouettes de face."""
    x0, y0, x1, y1 = box
    panel(img, box, rim=rim)
    label(img, (x0 + 28, y0 + 26), "Taille relative", rim, 20)
    cast = [("hero", "Héros")]
    if c["id"] == "hero":
        cast += [("consultant", "Consultant"), ("discosaure", "Discosaure")]
    else:
        cast += [(c["id"], c["name"].split(" «")[0])]
    hmax = max(MANIFEST["characters"][next(x for x in SPEC["characters"] if x["id"] == i)["model"]]["height"] for i, _ in cast)
    ground = y1 - 84
    avail = ground - (y0 + 90)
    ppm = avail / max(hmax, 2.0)
    d = ImageDraw.Draw(img)
    d.line([(x0 + 30, ground), (x1 - 30, ground)], fill=(*MUTE, 200), width=2)
    for m in range(0, int(max(hmax, 2.0)) + 1):
        yy = ground - m * ppm
        for xx in range(x0 + 70, x1 - 30, 14):
            d.line([(xx, yy), (xx + 6, yy)], fill=(255, 255, 255, 40), width=1)
        text(img, (x0 + 56, yy), f"{m} m", font("mono", 18), MUTE, anchor="rm")
    cw = (x1 - x0 - 90) / len(cast)
    for i, (cid, name) in enumerate(cast):
        spec = next(x for x in SPEC["characters"] if x["id"] == cid)
        hm = MANIFEST["characters"][spec["model"]]["height"]
        im = load(CACHE / cid / "turn-0.png")
        bb = solid_bbox(im, 200)
        k = hm * ppm / (bb[3] - bb[1])
        cx = x0 + 80 + cw * i + cw / 2
        color = ROLE[spec["role"]] if cid != "hero" or c["id"] == "hero" else (120, 110, 160)
        if cid == "hero" and c["id"] != "hero":
            color = (110, 100, 150)
        paste_scaled(img, recolor(silhouette(im), color), bb, k, (cx, ground))
        text(img, (cx, ground + 18), name, font("semi", 20), SOFT, anchor="ma")
        text(img, (cx, ground + 46), f"{fr(hm)} m", font("mono", 18), MUTE, anchor="ma")


def swatches(img, c, box, rim) -> None:
    x0, y0, x1, y1 = box
    panel(img, box, rim=rim)
    label(img, (x0 + 28, y0 + 26), "Palette extraite", rim, 20)
    info = MANIFEST["characters"][c["model"]]
    outline = hexrgb(info.get("outline", "#14101A"))
    ims = [load(CACHE / c["id"] / f"turn-{i}.png") for i in (0, 1, 3)]
    pal = palette(ims, 8, outline)
    pal = sorted(pal, key=lambda p: -p[1])
    entries = [(col, f"{round(share * 100)} %") for col, share in pal]
    entries += [(outline, "contour"), (hexrgb(info.get("rim", "#6FF3FF")), "liseré")]
    cols = 2
    rows = (len(entries) + 1) // 2
    cw = (x1 - x0 - 60) / cols
    rh = (y1 - y0 - 90) / rows
    d = ImageDraw.Draw(img)
    for i, (col, note) in enumerate(entries):
        cx = x0 + 30 + (i % cols) * cw
        cy = y0 + 76 + (i // cols) * rh
        sw = min(rh - 14, 56)
        d.rounded_rectangle((cx, cy, cx + sw * 1.4, cy + sw), 6, fill=col, outline=INK, width=3)
        text(img, (cx + sw * 1.4 + 18, cy + sw * 0.08), rgbhex(col), font("monob", 22), TEXT)
        text(img, (cx + sw * 1.4 + 18, cy + sw * 0.56), note, font("mono", 18), MUTE)


def model_sheet(c: dict, idx: int, total: int) -> Image.Image:
    rim = ROLE[c["role"]]
    img = background(W, H, rim)
    info = MANIFEST["characters"][c["model"]]
    y = header(img, c["name"], f"Model sheet · {idx:02d} / {total:02d} · {c['kind']}", c["title"], rim)
    paragraph(img, (64, y + 4), c["desc"], font("text", 26), 1500, SOFT, 1.45)
    # fiche technique (droite)
    rx = W - 64
    pw, _ = pill(img, (0, 0), c["kind"], rim) if False else (0, 0)
    stats = [
        ("Hauteur", f"{fr(info['height'])} m"),
        ("Triangles", f"{info['triangles']:,}".replace(",", " ")),
        ("Os", str(info["bones"])),
        ("Clips", str(len(info["clips"]))),
        ("GLB", f"{info['bytes'] / 1024:.0f} Kio".replace(".", ",")),
    ]
    sy = 70
    for k_, v in stats:
        label(img, (rx - 230, sy + 6), k_, MUTE, 18, anchor="ra")
        text(img, (rx, sy), v, font("monob", 28), TEXT, anchor="ra")
        sy += 46
    top = 360
    turnaround(img, c, (64, top, 1640, top + 700), rim)
    silhouettes(img, c, (1680, top, W - 64, top + 340))
    sizes(img, c, (1680, top + 360, W - 64, top + 700), rim)
    poses(img, c, (64, top + 730, 1640, H - 110), rim)
    swatches(img, c, (1680, top + 730, W - 64, H - 110), rim)
    footer(img, f"public/models/{c['model']}.glb · {len(info['clips'])} clips · {len(info['sockets'])} sockets")
    return img


def tenues() -> Image.Image:
    h = 1560
    img = background(W, h, HERO)
    y = header(img, "Les cinq tenues", "Personnages · Héros · Raretés d'équipement", "De la Réforme au Patrimoine : chaque pièce ramassée se voit sur le héros", HERO)
    paragraph(img, (64, y + 4), "Même figurine, mêmes os : casque et outil s'accrochent aux sockets (socket_head, socket_weapon_R), le gilet est lié au squelette. La couleur de rareté n'apparaît que sur le butin (faisceau, carte, liseré), jamais sur les ennemis.", font("text", 26), 2200, SOFT)
    top = 370
    n = len(SPEC["tenues"])
    gap = 24
    cw = (W - 128 - gap * (n - 1)) / n
    for i, t in enumerate(SPEC["tenues"]):
        col = hexrgb(t["color"])
        x0 = 64 + i * (cw + gap)
        box = (round(x0), top, round(x0 + cw), h - 110)
        panel(img, box, rim=col)
        hero = load(CACHE / "tenues" / f"rar-{t['rar']}-hero.png")
        bb = solid_bbox(hero, 40)
        big_h = 560
        k = min(big_h / (bb[3] - bb[1]), (cw - 60) / (bb[2] - bb[0]))
        cx = x0 + cw / 2
        img.alpha_composite(glow(img.size, (cx, top + 80 + big_h * 0.55), (cw * 0.42, big_h * 0.45), col, 70, 60))
        paste_scaled(img, hero, bb, k, (cx, top + 70 + big_h))
        pill(img, (round(x0 + 24), top + 24), t["name"], col, INK if lum(col) > 0.35 else TEXT, 22)
        text(img, (round(x0 + cw - 24), top + 30), f"R{t['rar']}", font("monob", 26), col, anchor="ra")
        # quatre vues
        views = [load(CACHE / "tenues" / f"rar-{t['rar']}-{j}.png") for j in range(4)]
        ub = union([solid_bbox(v, 40) for v in views])
        vw = (cw - 40) / 4
        vh = 300
        kk = min(vh / (ub[3] - ub[1]), (vw - 4) / max((solid_bbox(v, 40)[2] - solid_bbox(v, 40)[0]) for v in views))
        gy = top + 70 + big_h + 40 + vh
        ImageDraw.Draw(img).line([(x0 + 20, gy), (x0 + cw - 20, gy)], fill=(*col, 120), width=2)
        for j, v in enumerate(views):
            b = solid_bbox(v, 40)
            paste_scaled(img, v, (b[0], ub[1], b[2], ub[3]), kk, (x0 + 20 + vw * j + vw / 2, gy))
            label(img, (x0 + 20 + vw * j + vw / 2, gy + 12), TURN[j], MUTE, 14, anchor="ma")
        paragraph(img, (round(x0 + 24), gy + 52), t["items"], font("medium", 22), int(cw - 48), SOFT, 1.4)
    footer(img, "hero.glb + items/*.glb · socket_head, socket_weapon_R, gilet skinné")
    return img


def lineup() -> Image.Image:
    chars = sorted(SPEC["characters"], key=lambda c: MANIFEST["characters"][c["model"]]["height"])
    hmax = max(MANIFEST["characters"][c["model"]]["height"] for c in chars)
    span = W - 330
    gap = 34
    items = []
    for c in chars:
        im = load(CACHE / c["id"] / "turn-1.png")
        bb = solid_bbox(im, 40)
        sb = solid_bbox(im, 200)
        hm = MANIFEST["characters"][c["model"]]["height"]
        items.append((c, im, bb, hm / (sb[3] - sb[1]), bb[2] - bb[0]))
    # px par mètre : limité par la hauteur du panneau et par la largeur totale du casting
    total_m = sum(w * kpm for *_, kpm, w in items)
    ppm = min(900 / hmax, (span - gap * (len(items) - 1)) / total_m)
    top = 290
    ground = top + 80 + int(hmax * ppm)
    h = ground + 250
    img = background(W, h, ENEMY)
    header(img, "Gamme des tailles", "Personnages · Casting à l'échelle", "Hauteurs du manifeste des modèles (public/models/manifest.json), héros = 2,00 m", ENEMY)
    panel(img, (64, top, W - 64, h - 110), rim=RIM)
    d = ImageDraw.Draw(img)
    for m in range(0, int(hmax) + 1):
        yy = ground - m * ppm
        for xx in range(170, W - 100, 16):
            d.line([(xx, yy), (xx + 7, yy)], fill=(255, 255, 255, 36), width=1)
        text(img, (150, yy), f"{m} m", font("mono", 20), MUTE, anchor="rm")
    d.line([(110, ground), (W - 100, ground)], fill=(*RIM, 150), width=3)
    used = sum(w * kpm * ppm for *_, kpm, w in items) + gap * (len(items) - 1)
    x = 190 + (span - used) / 2
    last_cx = -1e9
    row = 0
    for c, im, bb, kpm, w in items:
        k = kpm * ppm
        w2 = w * k
        cx = x + w2 / 2
        col = ROLE[c["role"]]
        img.alpha_composite(glow(img.size, (cx, ground), (w2 * 0.6 + 20, 14), col, 90, 10))
        paste_scaled(img, im, bb, k, (cx, ground))
        row = 1 - row if cx - last_cx < 170 else 0
        ly = ground + 20 + row * 62
        nm = c["name"].split(" «")[0]
        for pre in ("Le ", "L'"):
            if nm.startswith(pre):
                nm = nm[len(pre):]
        nm = nm[0].upper() + nm[1:]
        text(img, (cx, ly), nm, font("semi", 20), SOFT, anchor="ma")
        text(img, (cx, ly + 28), f"{fr(MANIFEST['characters'][c['model']]['height'])} m", font("mono", 17), col, anchor="ma")
        last_cx = cx
        x += w2 + gap
    footer(img, "rendus 3/4 au repos · même échelle pour tout le casting")
    return img


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    a = ap.parse_args()
    only = [s for s in a.only.split(",") if s]
    chars = SPEC["characters"]
    for i, c in enumerate(chars, 1):
        if only and c["id"] not in only:
            continue
        for p in save(model_sheet(c, i, len(chars)), OUT, f"perso-{c['id']}"):
            print(p.relative_to(ROOT), f"{p.stat().st_size / 1024:.0f} Kio")
    if not only or "tenues" in only:
        for p in save(tenues(), OUT, "perso-tenues"):
            print(p.relative_to(ROOT), f"{p.stat().st_size / 1024:.0f} Kio")
    if not only or "lineup" in only:
        for p in save(lineup(), OUT, "perso-gamme-tailles"):
            print(p.relative_to(ROOT), f"{p.stat().st_size / 1024:.0f} Kio")


if __name__ == "__main__":
    main()
