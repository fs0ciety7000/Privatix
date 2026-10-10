#!/usr/bin/env python3
"""Sources du système de logo (docs/marketing/officiel/logo/), étape 1 sur 2.

  python3 tools/marketing/logo/prepare.py

1. Emblème couleur : détoure par incrustation le redessin 2K de l'emblème du logo A1
   (docs/marketing/officiel/refs/embleme-a1-2k.jpg, fond vert #00FF00, cf. jobs.json),
   supprime le débord vert sur les bords et écrit embleme.png (RGBA, 2048 px de large).
2. Emblème monochrome : vectorise (potrace) les aplats clairs de l'emblème ; les traits
   encrés deviennent des jours. Écrit tools/marketing/logo/embleme-mono.json.
3. Wordmark : met en forme « PRIVATIX » en Archivo Black (OFL, l'équivalent libre de
   l'Arial Black du logotype du site) avec HarfBuzz (crénage GPOS) et une approche de
   0,1 em, comme le néon du site, puis écrit les contours dans wordmark.json.

Dépendances : pip install numpy scipy opencv-python-headless potracer fonttools uharfbuzz
L'étape 2 (tools/marketing/logo/build.mjs) compose les SVG et PNG à partir de ces sources.
"""
import json
from pathlib import Path

import cv2
import numpy as np
import potrace
import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
SRC = ROOT / 'docs/marketing/officiel/refs/embleme-a1-2k.jpg'
OUT = ROOT / 'docs/marketing/officiel/logo'
FONT = ROOT / 'tools/marketing/compose/fonts/ArchivoBlack-Regular.ttf'
TRACKING = 0.1  # em, comme `.hero__title` du site et les compositions


def key_emblem():
    im = cv2.imread(str(SRC))[:, :, ::-1].astype(np.float32)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    green = g - np.maximum(r, b)
    alpha = np.clip((140 - green) / 100, 0, 1)
    hard = alpha > 0.5
    lab, n = ndi.label(hard)
    sizes = ndi.sum(hard, lab, range(1, n + 1))
    keep = ndi.binary_fill_holes(lab == np.argmax(sizes) + 1)
    near = ndi.binary_dilation(keep, iterations=3)
    alpha = alpha * near
    alpha[ndi.binary_erosion(keep, iterations=2)] = 1
    # débord vert : sur la bordure, le vert ne dépasse plus le max(R, B)
    edge = near & ~ndi.binary_erosion(keep, iterations=4)
    g = np.where(edge, np.minimum(g, np.maximum(r, b) + 8), g)
    rgba = np.dstack([r, g, b, alpha * 255]).clip(0, 255).astype(np.uint8)
    ys, xs = np.where(alpha > 0.02)
    pad = 8
    rgba = rgba[ys.min() - pad : ys.max() + pad + 1, xs.min() - pad : xs.max() + pad + 1]
    h, w = rgba.shape[:2]
    big = cv2.resize(rgba, (2048, round(h * 2048 / w)), interpolation=cv2.INTER_LANCZOS4)
    OUT.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(OUT / 'embleme.png'), big[:, :, [2, 1, 0, 3]])
    print(f'embleme.png : 2048 × {big.shape[0]} (source {w} × {h})')
    return rgba


def trace_mono(rgba):
    r, g, b, a = [rgba[..., i].astype(np.float32) for i in range(4)]
    lum = cv2.medianBlur((0.2126 * r + 0.7152 * g + 0.0722 * b).astype(np.uint8), 5)
    fill = (a > 128) & (lum > 40)
    fill = cv2.morphologyEx(fill.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
    path = potrace.Bitmap(~fill).trace(turdsize=40, alphamax=1.0, opticurve=True, opttolerance=0.4)
    h, w = fill.shape
    parts = []
    for c in path.curves:
        s = [f'M{c.start_point.x:.0f} {c.start_point.y:.0f}']
        for seg in c.segments:
            if seg.is_corner:
                s.append(f'L{seg.c.x:.0f} {seg.c.y:.0f}L{seg.end_point.x:.0f} {seg.end_point.y:.0f}')
            else:
                s.append(
                    f'C{seg.c1.x:.0f} {seg.c1.y:.0f} {seg.c2.x:.0f} {seg.c2.y:.0f} '
                    f'{seg.end_point.x:.0f} {seg.end_point.y:.0f}'
                )
        parts.append(''.join(s) + 'Z')
    # potracer trace les pixels à False : on lui passe le négatif, les aplats ressortent pleins
    d = ''.join(parts)
    (HERE / 'embleme-mono.json').write_text(json.dumps({'width': w, 'height': h, 'd': d}) + '\n')
    print(f'embleme-mono.json : {w} × {h}, {len(d)} caractères')


def wordmark():
    font = TTFont(str(FONT))
    upm = font['head'].unitsPerEm
    blob = hb.Blob.from_file_path(str(FONT))
    hbfont = hb.Font(hb.Face(blob))
    buf = hb.Buffer()
    buf.add_str('PRIVATIX')
    buf.guess_segment_properties()
    hb.shape(hbfont, buf, {'kern': True})
    gs = font.getGlyphSet()
    order = font.getGlyphOrder()
    x = 0
    parts = []
    track = TRACKING * upm
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        pen = SVGPathPen(gs)
        # repère SVG : y vers le bas, ligne de base à y = 0
        gs[name].draw(TransformPen(pen, (1, 0, 0, -1, x + pos.x_offset, -pos.y_offset)))
        parts.append(pen.getCommands())
        x += pos.x_advance + track
    width = x - track  # l'approche finale ne compte pas
    cap = font['OS/2'].sCapHeight
    data = {'upm': upm, 'width': round(width), 'capHeight': cap, 'tracking': TRACKING, 'd': ' '.join(parts)}
    (HERE / 'wordmark.json').write_text(json.dumps(data) + '\n')
    print(f'wordmark.json : {round(width)} × {cap} unités (em = {upm})')


if __name__ == '__main__':
    trace_mono(key_emblem())
    wordmark()
