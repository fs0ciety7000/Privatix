"""Planche de contrôle : chaque bande agrandie (×4 par défaut) avec son nom."""
import numpy as np
from PIL import Image, ImageDraw, ImageFont

import lib

BG1 = (52, 58, 72, 255)
BG2 = (60, 67, 82, 255)
GRID = (90, 98, 116, 255)
LABEL = (242, 230, 207, 255)
HEAD = (255, 122, 26, 255)


def _font(size=12):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
              "/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf"):
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            pass
    return ImageFont.load_default()


def _tile(arr, frame, scale):
    img = lib.to_image(arr)
    w, h = img.size
    big = img.resize((w * scale, h * scale), Image.NEAREST)
    bg = Image.new("RGBA", big.size, BG1)
    d = ImageDraw.Draw(bg)
    cs = 4 * scale
    for y in range(0, big.size[1], cs):
        for x in range(0, big.size[0], cs):
            if (x // cs + y // cs) % 2:
                d.rectangle([x, y, x + cs - 1, y + cs - 1], fill=BG2)
    if frame:
        for x in range(0, big.size[0] + 1, frame * scale):
            d.line([x, 0, x, big.size[1]], fill=GRID)
        for y in range(0, big.size[1] + 1, frame * scale):
            d.line([0, y, big.size[0], y], fill=GRID)
    bg.alpha_composite(big)
    return bg


def render(entries, path, scale=4, max_width=2400, title="Privatix — planche de contrôle"):
    font, hfont = _font(13), _font(18)
    blocks = []
    group = None
    for (g, name, arr, frame) in entries:
        sc = scale
        if frame and arr.shape[1] * sc > max_width - 20:
            # bande trop large : on replie les frames sur plusieurs rangées
            per = max(1, (max_width - 20) // (frame * sc))
            n = arr.shape[1] // frame
            rows_ = []
            for r0 in range(0, n, per):
                chunk = arr[:, r0 * frame : min(n, r0 + per) * frame]
                pad = np.zeros((arr.shape[0], per * frame), dtype=arr.dtype)
                pad[:, : chunk.shape[1]] = chunk
                rows_.append(pad)
            arr = np.concatenate(rows_, axis=0)
        while arr.shape[1] * sc > max_width - 20 and sc > 1:
            sc -= 1
        if g != group:
            blocks.append(("head", g, None))
            group = g
        blocks.append(("img", f"{name}  (x{sc})", _tile(arr, frame, sc)))
    # mise en page : rangées qui s'enchaînent tant que ça tient en largeur
    pad = 10
    rows, cur, cur_w = [], [], pad
    for b in blocks:
        if b[0] == "head":
            if cur:
                rows.append(cur)
            rows.append([b])
            cur, cur_w = [], pad
            continue
        w = max(b[2].size[0], 8 * len(b[1])) + pad
        if cur and cur_w + w > max_width:
            rows.append(cur)
            cur, cur_w = [], pad
        cur.append(b)
        cur_w += w
    if cur:
        rows.append(cur)
    heights = []
    for r in rows:
        if r[0][0] == "head":
            heights.append(30)
        else:
            heights.append(max(b[2].size[1] for b in r) + 22 + pad)
    H = sum(heights) + 50
    sheet = Image.new("RGBA", (max_width, H), (20, 16, 26, 255))
    d = ImageDraw.Draw(sheet)
    d.text((pad, 10), title, fill=HEAD, font=hfont)
    y = 46
    for r, h in zip(rows, heights):
        if r[0][0] == "head":
            d.text((pad, y + 6), r[0][1].upper(), fill=HEAD, font=hfont)
            d.line([pad, y + 28, max_width - pad, y + 28], fill=HEAD)
        else:
            x = pad
            for (_k, label, im) in r:
                d.text((x, y), label, fill=LABEL, font=font)
                sheet.alpha_composite(im, (x, y + 18))
                x += max(im.size[0], 8 * len(label)) + pad
        y += h
    sheet.save(path, optimize=True)
    return sheet.size
