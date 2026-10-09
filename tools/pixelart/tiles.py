"""Tilesets 16×16 : biome 1 « Quais & Voies » (nuit), hub OCC, commun.

Feuille source 256×256 (16×16 tuiles), livrée extrudée (marge 1, espacement 2)
en 288×288 pour éviter les coutures. Le manifeste liste le nom -> index de
chaque tuile pour les gabarits ASCII. Décor : pas de contour noir, sel-out
uniquement, couleurs désaturées, lumière haut-gauche.
"""
import math

import numpy as np
from PIL import Image

import lib
from font3x5 import draw_text
from lib import canvas, blit, parse
from palette import CHAR, LIGHT, RGBA

LIGHT_A = LIGHT

c = CHAR
T = 16


class Sheet:
    def __init__(self, cols=16, rows=16):
        self.cols, self.rows = cols, rows
        self.a = canvas(cols * T, rows * T)
        self.names = {}
        self.anims = {}

    def put(self, col, row, tile, name=None):
        assert tile.shape == (T, T), tile.shape
        self.a[row * T : (row + 1) * T, col * T : (col + 1) * T] = tile
        if name:
            self.names[name] = row * self.cols + col

    def extruded(self, margin=1, spacing=2):
        """Chaque tuile entourée de ses pixels de bord dupliqués."""
        W = self.cols * T + 2 * margin + (self.cols - 1) * spacing
        H = self.rows * T + 2 * margin + (self.rows - 1) * spacing
        out = np.zeros((H, W), dtype=np.uint8)
        for r in range(self.rows):
            for cc in range(self.cols):
                t = self.a[r * T : (r + 1) * T, cc * T : (cc + 1) * T]
                big = np.pad(t, 1, mode="edge")
                x = margin + cc * (T + spacing) - 1
                y = margin + r * (T + spacing) - 1
                out[y : y + T + 2, x : x + T + 2] = big
        return out


def tile(fill=None):
    t = canvas(T)
    if fill:
        t[:] = c[fill]
    return t


def speckle(t, seed, n, cols, region=None):
    g = lib.rng(seed)
    for _ in range(n):
        x, y = int(g.integers(0, T)), int(g.integers(0, T))
        if region is not None and not region[y, x]:
            continue
        t[y, x] = c[cols[int(g.integers(0, len(cols)))]]
    return t


# ==========================================================================
# QUAIS
# ==========================================================================

FLOOR_MAP = {"s": "4", "d": "2", "n": "1", "g": "5"}


def quai_floor(seed, detail=None):
    """Dalle de béton de quai, nuit bleue : valeur moyenne (le sol se lit
    entre les murs sombres et les acteurs), biseau éclairé haut-gauche,
    micro-variations, grain, reflets humides du néon."""
    t = _quai_floor_old(seed, detail)
    out = t.copy()
    for a_, b_ in FLOOR_MAP.items():
        out[t == c[a_]] = c[b_]
    t = out
    g = lib.rng(seed * 7 + 3)
    base = t == c["4"]
    # micro-variations (taches de béton plus sombres, usure plus claire)
    for _ in range(2):
        x, y = int(g.integers(2, 12)), int(g.integers(3, 13))
        w, h = int(g.integers(2, 5)), int(g.integers(1, 3))
        reg = np.zeros_like(base)
        reg[y : y + h, x : x + w] = True
        t[reg & base & ~lib.checker((T, T), seed)] = c["3"]
    # biseau : bas et droite de la dalle dans l'ombre
    t[T - 1, 1:][t[T - 1, 1:] == c["4"]] = c["3"]
    t[1:, T - 1][t[1:, T - 1] == c["4"]] = c["3"]
    # grain
    for _ in range(5):
        x, y = int(g.integers(1, T)), int(g.integers(1, T))
        if t[y, x] == c["4"]:
            t[y, x] = c["3"] if g.random() < 0.7 else c["5"]
    # reflet humide (néon froid) sur une dalle sur trois
    if detail is None and seed % 3 == 0:
        y = int(g.integers(5, 13))
        x = int(g.integers(3, 9))
        t[y, x : x + 4] = c["5"]
        t[y, x + 1] = c["c"]
    return t


def _quai_floor_old(seed, detail=None):
    t = tile("s")
    # joints discrets : ligne sombre en haut/gauche, rehaut ponctuel au coin
    t[0, :] = c["d"]
    t[:, 0] = c["d"]
    t[1, 1:4] = c["g"]
    t[1:3, 1] = c["g"]
    if seed % 2:
        t[1:, 8] = c["d"]
        t[1, 9:11] = c["g"]
    speckle(t, seed, 4, "dd")
    speckle(t, seed + 100, 2, "g")
    if detail == "crack":
        for (x, y) in ((4, 5), (5, 6), (5, 7), (6, 8), (7, 8), (8, 9), (8, 10), (9, 11), (6, 9)):
            t[y, x] = c["d"]
    elif detail == "stain":
        m = lib.ellipse_mask((T, T), 9, 10, 4, 2.5)
        t[m] = c["d"]
        t[lib.ellipse_mask((T, T), 8.5, 9.5, 2, 1)] = c["n"]
    elif detail == "gum":
        for (x, y) in ((4, 4), (11, 7), (7, 12), (13, 13)):
            t[y, x] = c["b"]
            t[y + 1, x] = c["g"]
    elif detail == "drain":
        lib.rect(t, 4, 5, 8, 6, c["d"])
        for k in range(5, 11, 2):
            lib.rect(t, 5, k, 6, 1, c["n"])
        lib.rect(t, 4, 5, 8, 1, c["g"])
    elif detail == "podo":
        # dalles podotactiles (guidage) : plots en relief
        for y in range(3, 15, 3):
            for x in range(3, 15, 3):
                t[y, x] = c["b"]
                t[y + 1, x] = c["d"]
    elif detail == "podo-line":
        for x in range(2, 15, 1):
            for y in (4, 8, 12):
                t[y, x] = c["b"] if x % 2 else c["g"]
                t[y + 1, x] = c["d"]
    elif detail == "grille":
        lib.rect(t, 2, 2, 12, 12, c["d"])
        for k in range(3, 14, 2):
            lib.rect(t, k, 3, 1, 10, c["n"])
        lib.rect(t, 2, 2, 12, 1, c["b"])
        lib.rect(t, 2, 2, 1, 12, c["g"])
    elif detail == "regard":
        m = lib.ellipse_mask((T, T), 8, 8, 6, 6)
        t[m] = c["d"]
        t[lib.ellipse_mask((T, T), 8, 8, 5, 5)] = c["s"]
        for k in range(4, 13, 2):
            t[k, 4:12][t[k, 4:12] == c["s"]] = c["g"]
        t[lib.ellipse_mask((T, T), 7, 7, 6, 6) & ~lib.ellipse_mask((T, T), 7.5, 7.5, 5.5, 5.5) & m] = c["b"]
    return t


def ballast(seed):
    """Ballast : pierres anguleuses gris / rouille, valeurs sombres."""
    t = tile("1")
    g = lib.rng(seed)
    # fond : graviers sombres en petites taches (pas de damier)
    for _ in range(18):
        x, y = int(g.integers(0, T)), int(g.integers(0, T))
        t[y, x] = c["2"]
        if x + 1 < T:
            t[y, x + 1] = c["2"]
    # pierres anguleuses 2×2 : arête éclairée haut-gauche, ombre propre bas-droite
    for _ in range(16):
        x, y = int(g.integers(0, T - 1)), int(g.integers(0, T - 1))
        col = ("s", "3", "s", "m", "g", "3")[int(g.integers(0, 6))]
        hi = {"s": "g", "3": "4", "m": "z", "g": "b"}[col]
        t[y, x] = c[hi]
        t[y, x + 1] = c[col]
        t[y + 1, x] = c[col]
        t[y + 1, x + 1] = c["D"]
    speckle(t, seed + 3, 2, "7")
    return t


def corner_tile(mask, inside_fn, outside_fn, seed=0):
    """Wang « corner » : mask = (NW, NE, SW, SE) à True = matériau intérieur (quai)."""
    a = inside_fn(seed)
    b = outside_fn(seed + 50)
    t = b.copy()
    q = np.zeros((T, T), dtype=bool)
    nw, ne, sw, se = mask
    h = T // 2
    if nw:
        q[:h, :h] = True
    if ne:
        q[:h, h:] = True
    if sw:
        q[h:, :h] = True
    if se:
        q[h:, h:] = True
    # adoucir les coins pleins en arrondis (pas d'angle de 90° visible)
    t[q] = a[q]
    # bord : ombre portée côté ballast (2 px, bas-droite plus marquée),
    # nez de dalle éclairé côté quai
    edge_out = lib._dilate4(q) & ~q
    t[edge_out] = c["1"]
    edge_out2 = lib._dilate4(edge_out | q) & ~q & ~edge_out
    t[edge_out2 & lib.checker((T, T))] = c["D"]
    edge_in = q & ~lib._erode4(np.pad(q, 1, constant_values=True))[1:-1, 1:-1]
    t[edge_in & q] = c["5"]
    return t


BLOB_ORDER = None


def blob_masks():
    """Les 47 configurations canoniques (8 voisins : N NE E SE S SW W NW)."""
    out = set()
    for m in range(256):
        n, ne, e, se, s, sw, w, nw = [(m >> i) & 1 for i in range(8)]
        ne &= n & e
        se &= s & e
        sw &= s & w
        nw &= n & w
        out.add((n, ne, e, se, s, sw, w, nw))
    return sorted(out, key=lambda k: (sum(k), k))


def wall_top(mask, base="d", rim_hi="g", rim_lo="n", inner="s"):
    """Dessus de mur (chaperon) : bords clairs en haut/gauche, sombres en bas/droite."""
    n, ne, e, se, s, sw, w, nw = mask
    t = tile(base)
    # motif : dalles de chaperon
    for x in range(0, T, 8):
        t[:, x] = c[rim_lo] if False else t[:, x]
    t[7, :] = c[inner]
    if not n:
        t[0, :] = c[rim_lo]
        t[1, :] = c[rim_hi]
    if not s:
        t[T - 1, :] = c[rim_lo]
        t[T - 2, :] = c[inner]
    if not w:
        t[:, 0] = c[rim_lo]
        t[:, 1] = c[rim_hi]
    if not e:
        t[:, T - 1] = c[rim_lo]
        t[:, T - 2] = c[inner]
    # matière : grain et éclats sur le chaperon
    g = lib.rng(sum(v << k for k, v in enumerate(mask)) + 7)
    for _ in range(6):
        x, y = int(g.integers(2, T - 2)), int(g.integers(2, T - 2))
        if t[y, x] == c[base]:
            t[y, x] = c[inner] if g.random() < 0.6 else c[rim_hi]
    # coins intérieurs
    if n and w and not nw:
        t[0, 0] = c[rim_lo]
        t[0:2, 0:2] = c[rim_hi]
        t[0, 0] = c[rim_lo]
    if n and e and not ne:
        t[0, T - 1] = c[rim_lo]
        t[1, T - 2] = c[inner]
    if s and w and not sw:
        t[T - 1, 0] = c[rim_lo]
        t[T - 2, 1] = c[rim_hi]
    if s and e and not se:
        t[T - 1, T - 1] = c[rim_lo]
        t[T - 2, T - 2] = c[inner]
    return t


def wall_face(kind, lower, pal):
    """Façade de mur (2 tuiles de haut). pal : (fond, joint, rehaut, ombre, plinthe)."""
    base, grout, hi, sh, plinth = pal[:5]
    t = tile(base)
    # carreaux émaillés 4×4 (style métro) ou briques selon pal
    if pal[5] == "tiles":
        for y in range(0, T, 4):
            t[y, :] = c[grout]
        for x in range(0, T, 8):
            for y in range(0, T, 4):
                off = 0 if (y // 4) % 2 == 0 else 4
                t[y : y + 4, (x + off) % T] = c[grout]
        for y in range(1, T, 4):
            for x in range(1, T, 8):
                t[y, x : x + 2] = c[hi]
                t[y + 1, x] = c[hi]
        # reflet spéculaire du carrelage émaillé (néon froid)
        t[5, 2] = c["c"]
        t[13, 10] = c["c"]
        if lower:
            # salissures qui coulent au-dessus de la plinthe
            for x in (3, 4, 9, 13):
                t[T - 6 : T - 4 + (x % 2), x] = c[sh]
    else:  # briques
        for y in range(0, T, 4):
            t[y, :] = c[grout]
            off = 0 if (y // 4) % 2 == 0 else 4
            for x in range(off, T, 8):
                t[y : y + 4, x] = c[grout]
            for x in range(off + 1, T, 8):
                t[y + 1, x : x + 3] = c[hi]
    if lower:
        lib.rect(t, 0, T - 4, T, 4, c[plinth])
        lib.rect(t, 0, T - 4, T, 1, c[hi])
        lib.rect(t, 0, T - 1, T, 1, c[sh])
    else:
        lib.rect(t, 0, 0, T, 1, c[sh])  # ombre sous le chaperon
    if kind == "left":
        t[:, 0] = c[hi]
        t[:, 1] = c[hi] if not lower else t[:, 1]
    elif kind == "right":
        t[:, T - 1] = c[sh]
        t[:, T - 2] = c[sh]
    elif kind in ("doorL", "doorR"):
        x0 = 4 if kind == "doorL" else 0
        x1 = T if kind == "doorL" else T - 4
        lib.rect(t, x0, 0 if lower else 3, x1 - x0, T, c["n"] if pal[5] == "tiles" else c["e"])
        frame_x = x0 if kind == "doorL" else x1 - 1
        t[:, frame_x] = c[hi]
        if not lower:
            lib.rect(t, x0, 3, x1 - x0, 1, c[hi])
    elif kind == "plinth":
        lib.rect(t, 0, T - 6, T, 6, c[plinth])
        lib.rect(t, 0, T - 6, T, 1, c[hi])
    elif kind == "midB":
        if not lower:
            t[5:7, 3:5] = c[sh]
    elif kind == "midC":
        if lower:
            t[6, 9:14] = c[sh]
        elif pal[5] == "tiles":
            # tube néon froid (émissif) et son halo sur le carrelage
            lib.rect(t, 1, 6, 14, 1, c["c"])
            lib.rect(t, 1, 10, 14, 1, c["c"])
            lib.rect(t, 1, 7, 14, 3, c["D"])
            lib.rect(t, 2, 8, 12, 1, c["6"])
            lib.rect(t, 3, 8, 8, 1, c["w"])
            t[7, 1] = t[7, 14] = c["s"]
    return t


def quai_edge(kind):
    """Bord de quai (vu de dessus 3/4) : béton, ligne jaune de sécurité (rehaut
    chaud, usure), nez de quai en granit éclairé, face de chute dans l'ombre."""
    t = quai_floor(5)

    def yellow_h(y):
        lib.rect(t, 0, y, T, 1, c["y"])
        lib.rect(t, 0, y + 1, T, 1, c["a"])
        t[y, ::5] = c["Z"]
        t[y + 1, 2::6] = c["U"]

    def yellow_v(x):
        lib.rect(t, x, 0, 1, T, c["y"])
        lib.rect(t, x + 1, 0, 1, T, c["a"])
        t[::5, x] = c["Z"]
        t[2::6, x + 1] = c["U"]

    if kind == "S":  # le vide (voie) est au sud
        yellow_h(3)
        lib.rect(t, 0, 9, T, 1, c["7"])
        lib.rect(t, 0, 10, T, 1, c["b"])
        lib.rect(t, 0, 11, T, 1, c["g"])
        lib.rect(t, 0, 12, T, 2, c["2"])
        lib.rect(t, 0, 14, T, 2, c["1"])
        t[12, ::5] = c["s"]
        t[14, ::4] = c["D"]
    elif kind == "N":  # voie au nord : on voit seulement le nez du quai
        lib.rect(t, 0, 0, T, 2, c["1"])
        lib.rect(t, 0, 2, T, 1, c["7"])
        lib.rect(t, 0, 3, T, 1, c["g"])
        yellow_h(10)
    elif kind == "E":
        yellow_v(9)
        lib.rect(t, 13, 0, 1, T, c["b"])
        lib.rect(t, 14, 0, 2, T, c["1"])
    elif kind == "W":
        yellow_v(5)
        lib.rect(t, 2, 0, 1, T, c["7"])
        lib.rect(t, 0, 0, 2, T, c["1"])
    return t


def edge_corner(a, b):
    """Coins : combinaison de deux bords (intersection des zones de chute)."""
    ta, tb = quai_edge(a), quai_edge(b)
    base = quai_floor(5)
    t = base.copy()
    for src in (ta, tb):
        m = src != base
        t[m] = src[m]
    return t


def edge_inner(a, b):
    t = quai_floor(5)
    # petit coin de vide dans l'angle
    xs = slice(12, 16) if "E" in (a, b) else slice(0, 4)
    ys = slice(12, 16) if "S" in (a, b) else slice(0, 4)
    t[ys, xs] = c["1"]
    return t


def edge_end(kind):
    t = quai_floor(5)
    y = 3 if kind in ("Sl", "Sr") else 10
    x0 = 0 if kind in ("Sr", "Nr") else 4
    lib.rect(t, x0, y, 12, 1, c["y"])
    lib.rect(t, x0, y + 1, 12, 1, c["a"])
    t[y, x0 : x0 + 12 : 5] = c["Z"]
    return t


def track(kind, seed=0):
    """Voie : traverses en bois sur ballast + rails acier. Voie = 2 tuiles."""
    t = ballast(seed)
    if kind in ("H-top", "H-bot", "H-full"):
        # traverses verticales tous les 4 px
        y0, y1 = (6, 16) if kind == "H-top" else (0, 10) if kind == "H-bot" else (2, 14)
        for x in range(1, T, 5):
            lib.rect(t, x, y0, 3, y1 - y0, c["m"])
            lib.rect(t, x, y0, 1, y1 - y0, c["z"])
            lib.rect(t, x + 2, y0, 1, y1 - y0, c["h"])
            t[(y0 + y1) // 2 + (x % 3) - 1, x + 1] = c["h"]  # fente du bois
            if y1 < T:
                lib.rect(t, x + 1, y1, 3, 1, c["D"])  # ombre portée
        ry = 9 if kind == "H-top" else 6 if kind == "H-bot" else 7
        lib.rect(t, 0, ry, T, 2, c["g"])
        lib.rect(t, 0, ry, T, 1, c["7"])
        t[ry, (seed * 5) % 12 : (seed * 5) % 12 + 3] = c["v"]  # éclat de néon sur le rail
        lib.rect(t, 0, ry + 2, T, 1, c["D"])
    elif kind in ("V-left", "V-right"):
        x0, x1 = (6, 16) if kind == "V-left" else (0, 10)
        for y in range(1, T, 5):
            lib.rect(t, x0, y, x1 - x0, 3, c["m"])
            lib.rect(t, x0, y, x1 - x0, 1, c["z"])
            lib.rect(t, x0, y + 2, x1 - x0, 1, c["h"])
        rx = 9 if kind == "V-left" else 5
        lib.rect(t, rx, 0, 2, T, c["g"])
        lib.rect(t, rx, 0, 1, T, c["7"])
        lib.rect(t, rx + 2, 0, 1, T, c["D"])
    elif kind == "sleepers":
        for x in range(1, T, 5):
            lib.rect(t, x, 2, 3, 12, c["m"])
            lib.rect(t, x, 2, 1, 12, c["z"])
    elif kind == "cross":
        t = track("H-full", seed)
        lib.rect(t, 7, 0, 2, T, c["s"])
        lib.rect(t, 7, 0, 1, T, c["b"])
    elif kind == "buffer":
        t = track("H-full", seed)
        lib.rect(t, 9, 1, 6, 14, c["x"])
        lib.rect(t, 9, 1, 6, 1, c["y"])
        lib.rect(t, 14, 1, 1, 14, c["R"])
        for y in range(3, 14, 4):
            lib.rect(t, 10, y, 4, 2, c["y"])
        lib.rect(t, 7, 4, 2, 2, c["b"])
        lib.rect(t, 7, 10, 2, 2, c["b"])
    return t


def switch_tiles():
    """Aiguillage 4×2 : une voie qui diverge vers le haut-droite."""
    W, H = 4 * T, 2 * T
    a = canvas(W, H)
    for i in range(4):
        for j in range(2):
            a[j * T : (j + 1) * T, i * T : (i + 1) * T] = ballast(300 + i + j * 4)
    for x in range(1, W, 5):
        lib.rect(a, x, 18, 3, 12, c["m"])
        lib.rect(a, x, 18, 1, 12, c["z"])
    for y_ in (23, 25):
        lib.rect(a, 0, y_, W, 1, c["b"])
    # branche déviée
    for k in range(W):
        y = int(23 - (k / W) ** 1.6 * 18)
        if k > 10:
            a[y, k] = c["b"]
            a[y + 1, k] = c["s"]
    return [a[j * T : (j + 1) * T, i * T : (i + 1) * T] for j in range(2) for i in range(4)]


def floor_marks(kind, seed=0):
    t = quai_floor(seed)
    if kind == "arrow":
        for k in range(5):
            t[8 - k // 2 if False else 8, 4 + k] = c["y"]
        for k in range(3):
            t[8 - k - 1, 7 + k] = c["y"]
            t[8 + k + 1, 7 + k] = c["y"]
    elif kind == "voie":
        draw_text(t, "V1", 3, 5, c["b"])
    elif kind == "hatch":
        for k in range(-T, T, 4):
            lib.line(t, k, T - 1, k + T - 1, 0, c["y"])
            lib.line(t, k + 1, T - 1, k + T, 0, c["d"])
    elif kind == "vent":
        lib.rect(t, 3, 3, 10, 10, c["d"])
        for k in range(4, 13, 2):
            lib.rect(t, 4, k, 8, 1, c["n"])
        lib.rect(t, 3, 3, 10, 1, c["b"])
    elif kind == "trash":
        lib.rect(t, 5, 9, 3, 2, c["b"])
        t[9, 5] = c["g"]
        lib.rect(t, 10, 5, 2, 1, c["g"])
        t[12, 11] = c["x"]
        t[12, 12] = c["R"]
    elif kind == "puddle":
        m = lib.ellipse_mask((T, T), 8, 9, 6, 3)
        t[m] = c["n"]
        t[lib.ellipse_mask((T, T), 6, 8, 2, 1)] = c["i"]
    elif kind == "leaf":
        for (x, y) in ((4, 6), (5, 6), (5, 7), (11, 11), (12, 11)):
            t[y, x] = c["m"]
    elif kind == "chalk":
        lib.line(t, 3, 4, 12, 4, c["b"])
        lib.line(t, 3, 4, 3, 11, c["b"])
        draw_text(t, "X", 7, 7, c["b"])
    return t


def void(kind):
    if kind == "black":
        return tile("K")
    if kind == "night":
        t = tile("n")
        t[lib.checker((T, T))] = c["K"]
        return t
    if kind == "drop":  # voies en contrebas, assombries
        t = track("H-full", 9)
        t[t != c["K"]] = np.where(t[t != c["K"]] == c["b"], c["s"], c["d"])
        t[lib.checker((T, T))] = c["n"]
        return t
    if kind == "drop-ballast":
        t = ballast(17)
        t[lib.checker((T, T))] = c["n"]
        return t
    return tile("K")


def verriere_shadow(phase):
    """Ombre portée de la verrière (motif de grille, posé sur le calque shadows)."""
    t = canvas(T)
    m = np.zeros((T, T), dtype=bool)
    m[:, (phase * 4) % T : (phase * 4) % T + 2] = True
    m[(phase * 4) % T : (phase * 4) % T + 2, :] = True
    t[m] = c["n"]
    return t


def neon(frame):
    t = canvas(T)
    t[:] = c["2"]
    lib.rect(t, 1, 6, 14, 4, c["D"])
    on = frame in (0, 1, 3)
    if on:
        lib.rect(t, 0, 5, T, 1, c["c"])
        lib.rect(t, 0, 10, T, 1, c["c"])
    lib.rect(t, 2, 7, 12, 2, c["6"] if on else c["s"])
    if on:
        lib.rect(t, 3, 7, 10, 1, c["w"])
    if frame == 2:
        t[7, 6] = c["v"]
    lib.rect(t, 1, 11, 14, 1, c["1"])
    return t


def puddle_anim(frame):
    t = quai_floor(11)
    m = lib.ellipse_mask((T, T), 8, 9, 6, 3)
    t[m] = c["2"]
    t[lib.ellipse_mask((T, T), 8, 9.5, 5, 2.2)] = c["1"]
    x = 4 + frame * 2
    t[8, x : x + 3] = c["6"]
    t[8, x + 1] = c["w"]
    t[10, x - 1 : x + 1] = c["c"]
    return t


def signal(frame):
    t = ballast(400)
    lib.rect(t, 6, 1, 5, 12, c["K"])
    lib.rect(t, 7, 2, 3, 3, c["R"])
    lib.rect(t, 7, 7, 3, 3, c["G"])
    if frame < 2:
        lib.rect(t, 7, 2, 3, 3, c["x"])
        t[2, 7] = c["w"] if frame == 0 else c["x"]
    else:
        lib.rect(t, 7, 7, 3, 3, c["L"])
        t[7, 7] = c["w"] if frame == 2 else c["L"]
    lib.rect(t, 8, 13, 1, 3, c["s"])
    return t


def build_quais():
    sh = Sheet()
    # ---- rangée 0 : sols
    for i in range(4):
        sh.put(i, 0, quai_floor(i + 1), f"quai-{i}")
    for i, d in enumerate(("crack", "stain", "gum", "drain")):
        sh.put(4 + i, 0, quai_floor(20 + i, d), f"quai-{d}")
    for i, d in enumerate(("podo", "podo-line", "grille", "regard")):
        sh.put(8 + i, 0, quai_floor(30 + i, d), f"quai-{d}")
    for i in range(4):
        sh.put(12 + i, 0, ballast(40 + i), f"ballast-{i}")
    # ---- rangée 1 : Wang corner quai/ballast (index = NW*8 + NE*4 + SW*2 + SE)
    for m in range(16):
        mask = (bool(m & 8), bool(m & 4), bool(m & 2), bool(m & 1))
        sh.put(m, 1, corner_tile(mask, quai_floor, ballast, seed=60 + m), f"wang-quai-ballast-{m}")
    # ---- rangées 2-4 : dessus de mur blob 47
    masks = blob_masks()
    for i, mk in enumerate(masks):
        sh.put(i % 16, 2 + i // 16, wall_top(mk, base="2", rim_hi="3", rim_lo="D", inner="1"),
               "walltop-" + "".join(map(str, mk)))
    sh.put(15, 4, quai_floor(99), "blob-spare")
    # ---- rangées 5-6 : façades (carreaux émaillés bleus) + façades spéciales
    pal = ("i", "n", "I", "n", "2", "tiles")
    kinds = ["left", "midA", "midB", "midC", "right", "doorL", "doorR", "plinth"]
    for i, k in enumerate(kinds):
        sh.put(i, 5, wall_face(k, False, pal), f"wall-{k}-top")
        sh.put(i, 6, wall_face(k, True, pal), f"wall-{k}-bot")
    for i, (name, fn) in enumerate(_facades_quais()):
        top, bot = fn()
        sh.put(8 + i, 5, top, f"facade-{name}-top")
        sh.put(8 + i, 6, bot, f"facade-{name}-bot")
    # ---- rangée 7 : bords de quai
    for i, k in enumerate("SNEW"):
        sh.put(i, 7, quai_edge(k), f"edge-{k}")
    for i, (a_, b_) in enumerate((("S", "E"), ("S", "W"), ("N", "E"), ("N", "W"))):
        sh.put(4 + i, 7, edge_corner(a_, b_), f"edge-outer-{a_}{b_}")
        sh.put(8 + i, 7, edge_inner(a_, b_), f"edge-inner-{a_}{b_}")
    for i, k in enumerate(("Sl", "Sr", "Nl", "Nr")):
        sh.put(12 + i, 7, edge_end(k), f"edge-end-{k}")
    # ---- rangées 8-10 : voies
    for i, k in enumerate(("H-top", "H-bot", "H-full", "V-left", "V-right", "sleepers", "cross", "buffer")):
        sh.put(i, 8, track(k, 70 + i), f"track-{k}")
    for i, t in enumerate(switch_tiles()):
        sh.put(8 + i % 4, 8 + i // 4, t, f"switch-{i}")
    for i in range(8):
        sh.put(i, 9, track("H-top" if i % 2 == 0 else "H-bot", 80 + i), f"track-H-var{i}")
    # câbles et caniveaux (éléments linéaires)
    for i in range(4):
        t = ballast(90 + i)
        lib.rect(t, 0, 7, T, 2, c["n"])
        lib.rect(t, 0, 7, T, 1, c["h"] if i % 2 else c["R"])
        sh.put(12 + i, 8, t, f"cable-{i}")
    for i in range(4):
        t = quai_floor(95 + i)
        lib.rect(t, 0, 6, T, 4, c["d"])
        for x in range(1, T, 3):
            t[7:9, x] = c["n"]
        sh.put(12 + i, 9, t, f"gutter-{i}")
    for i in range(16):
        sh.put(i, 10, ballast(120 + i) if i < 8 else track("H-full", 140 + i), None)
    # ---- rangées 11-12 : détails au sol
    for i, k in enumerate(("arrow", "voie", "hatch", "vent", "trash", "puddle", "leaf", "chalk")):
        sh.put(i, 11, floor_marks(k, 200 + i), f"mark-{k}")
        sh.put(8 + i, 11, quai_floor(210 + i, ("crack", "stain", "gum", "drain")[i % 4]), None)
    for i in range(16):
        sh.put(i, 12, verriere_shadow(i % 4) if i < 4 else quai_floor(220 + i), f"verriere-shadow-{i}" if i < 4 else None)
    # ---- rangée 13 : vide / chute
    for i, k in enumerate(("black", "night", "drop", "drop-ballast")):
        sh.put(i, 13, void(k), f"void-{k}")
    # ---- rangées 14-15 : tuiles animées
    for f in range(4):
        sh.put(f, 14, neon(f), f"anim-neon-{f}")
        sh.put(4 + f, 14, puddle_anim(f), f"anim-puddle-{f}")
        sh.put(8 + f, 14, signal(f), f"anim-signal-{f}")
    sh.anims = {
        "anim-neon": {"tiles": [sh.names[f"anim-neon-{f}"] for f in range(4)], "durations": [200, 150, 60, 250]},
        "anim-puddle": {"tiles": [sh.names[f"anim-puddle-{f}"] for f in range(4)], "durations": [250] * 4},
        "anim-signal": {"tiles": [sh.names[f"anim-signal-{f}"] for f in range(4)], "durations": [250] * 4},
    }
    return sh


def _facades_quais():
    def poster(txt, col):
        def fn():
            top = wall_face("midA", False, ("i", "n", "I", "n", "2", "tiles"))
            bot = wall_face("midA", True, ("i", "n", "I", "n", "2", "tiles"))
            # affiche éclairée : papier crème, rehaut haut-gauche, ombre froide
            # bas-droite, coin corné, scotch
            lib.rect(top, 2, 3, 12, 13, c["q"])
            lib.rect(top, 2, 3, 12, 3, c[col])
            lib.rect(top, 2, 3, 12, 1, LIGHT_A[c[col]])
            lib.rect(top, 2, 6, 1, 10, c["w"])
            lib.rect(top, 13, 6, 1, 10, c["b"])
            draw_text(top, txt[:3], 2, 8, c["d"])
            lib.px(top, 3, 3, c["v"])
            lib.px(top, 12, 3, c["v"])
            lib.rect(bot, 2, 0, 12, 7, c["q"])
            lib.rect(bot, 2, 0, 1, 7, c["w"])
            lib.rect(bot, 13, 0, 1, 6, c["b"])
            lib.rect(bot, 2, 6, 12, 1, c["b"])
            lib.rect(bot, 3, 2, 10, 1, c["g"])
            lib.rect(bot, 3, 4, 7, 1, c["g"])
            bot[5, 13] = bot[6, 13] = bot[6, 12] = c["n"]  # coin corné
            return top, bot
        return fn

    def vitrine():
        top = wall_face("midA", False, ("i", "n", "I", "n", "2", "tiles"))
        bot = wall_face("midA", True, ("i", "n", "I", "n", "2", "tiles"))
        # vitrine : verre bleuté plus sombre en bas, reflets obliques du néon
        lib.rect(top, 1, 4, 14, 12, c["v"])
        lib.rect(top, 1, 10, 14, 6, c["c"])
        lib.rect(top, 1, 4, 14, 1, c["g"])
        lib.line(top, 3, 6, 7, 10, c["w"])
        lib.line(top, 4, 6, 8, 10, c["7"])
        lib.line(top, 10, 5, 12, 7, c["w"])
        lib.rect(bot, 1, 0, 14, 9, c["c"])
        lib.rect(bot, 1, 8, 14, 1, c["s"])
        bot[3:6, 4:12] = c["I"]
        bot[3, 4:12] = c["v"]
        return top, bot

    def guichet():
        top = wall_face("midA", False, ("i", "n", "I", "n", "2", "tiles"))
        bot = wall_face("midA", True, ("i", "n", "I", "n", "2", "tiles"))
        lib.rect(top, 1, 3, 14, 4, c["q"])
        draw_text(top, "FERM", -1, 3, c["x"]) if False else draw_text(top, "HS", 4, 3, c["x"])
        lib.rect(top, 1, 8, 14, 8, c["n"])
        lib.rect(bot, 1, 0, 14, 6, c["n"])
        lib.rect(bot, 0, 6, T, 2, c["g"])
        lib.rect(bot, 0, 6, T, 1, c["b"])
        return top, bot

    def horaires():
        top = wall_face("midA", False, ("i", "n", "I", "n", "2", "tiles"))
        bot = wall_face("midA", True, ("i", "n", "I", "n", "2", "tiles"))
        # tableau des départs à LED (émissif : le bloom du moteur le fait briller)
        lib.rect(top, 1, 2, 14, 14, c["s"])
        lib.rect(top, 2, 3, 12, 13, c["D"])
        lib.rect(top, 3, 4, 10, 1, c["y"])
        for y in range(6, 16, 2):
            lib.rect(top, 3, y, 3, 1, c["a"])
            lib.rect(top, 7, y, 6 - (y % 4), 1, c["Z"] if y % 4 else c["a"])
        lib.rect(bot, 1, 0, 14, 8, c["s"])
        lib.rect(bot, 2, 0, 12, 7, c["D"])
        for y in range(1, 7, 2):
            lib.rect(bot, 3, y, 3, 1, c["a"])
            lib.rect(bot, 7, y, 5, 1, c["Z"])
        return top, bot

    def extincteur():
        top = wall_face("midB", False, ("i", "n", "I", "n", "2", "tiles"))
        bot = wall_face("midB", True, ("i", "n", "I", "n", "2", "tiles"))
        lib.rect(top, 6, 8, 4, 8, c["x"])
        lib.rect(top, 6, 8, 1, 8, c["R"] if False else c["x"])
        lib.rect(top, 9, 8, 1, 8, c["R"])
        lib.rect(top, 6, 6, 3, 2, c["d"])
        lib.rect(bot, 6, 0, 4, 6, c["x"])
        lib.rect(bot, 9, 0, 1, 6, c["R"])
        return top, bot

    return [("privatix", poster("PRV", "c")), ("greve", poster("OCC", "x")), ("vitrine", vitrine),
            ("guichet", guichet), ("horaires", horaires), ("extincteur", extincteur),
            ("affiche-7h12", poster("712", "y")), ("plan", poster("MAP", "I"))]


# ==========================================================================
# OCC (hub souterrain) : briques voûtées, béton + traverses, chaleur ambre
# ==========================================================================

def occ_floor(seed, kind="beton"):
    if kind == "beton":
        t = tile("m")
        g = lib.rng(seed + 31)
        for _ in range(2):
            x, y = int(g.integers(2, 12)), int(g.integers(3, 13))
            reg = np.zeros((T, T), bool)
            reg[y : y + int(g.integers(1, 3)), x : x + int(g.integers(2, 5))] = True
            t[reg & ~lib.checker((T, T), seed)] = c["r"]
        t[0, :] = c["h"]
        t[:, 0] = c["h"]
        t[1, 1:7] = c["z"]
        t[1:5, 1] = c["z"]
        t[T - 1, 1:] = c["B"]
        t[1:, T - 1] = c["B"]
        speckle(t, seed, 7, "hhB")
        speckle(t, seed + 1, 3, "zp")
        return t
    if kind == "planche":  # traverses de bois réemployées
        t = tile("z")
        for y in (0, 5, 10, 15):
            t[y, :] = c["h"]
        for y in (1, 6, 11):
            t[y, :] = c["p"]
        for y in (4, 9, 14):
            t[y, :] = c["m"]
        g = lib.rng(seed)
        for y0 in (2, 7, 12):
            x = int(g.integers(2, 14))
            t[y0 + 1, x] = c["h"]
            t[y0 + 1, x + 1] = c["h"]
            t[y0, (x + 7) % T] = c["e"]
        return t
    if kind == "tapis":
        t = tile("R")
        t[0, :] = c["e"]
        t[T - 1, :] = c["e"]
        for x in range(2, T, 4):
            t[2:T - 2, x] = c["x"]
        t[2, :] = c["a"]
        t[T - 3, :] = c["a"]
        return t
    if kind == "carrelage":
        t = tile("q")
        for k in range(0, T, 4):
            t[k, :] = c["z"]
            t[:, k] = c["z"]
        for y in range(0, T, 8):
            for x in range(0, T, 8):
                t[y + 1 : y + 4, x + 1 : x + 4] = c["p"] if (x + y) % 16 == 0 else c["q"]
        return t
    return tile("h")


def build_occ():
    sh = Sheet()
    for i in range(4):
        sh.put(i, 0, occ_floor(i, "beton"), f"occ-beton-{i}")
    for i in range(4):
        sh.put(4 + i, 0, occ_floor(10 + i, "planche"), f"occ-planche-{i}")
    for i, k in enumerate(("tapis", "tapis", "carrelage", "carrelage")):
        t = occ_floor(20 + i, k)
        if i % 2:
            t = lib.flipx(t)
        sh.put(8 + i, 0, t, f"occ-{k}-{i % 2}")
    for i in range(4):
        t = occ_floor(30 + i, "beton")
        d = ("stain", "crack", "drain", "rails")[i]
        if d == "stain":
            t[lib.ellipse_mask((T, T), 8, 9, 4, 2)] = c["e"]
        elif d == "crack":
            for (x, y) in ((3, 4), (4, 5), (5, 5), (6, 6), (7, 7), (7, 8), (8, 9)):
                t[y, x] = c["e"]
        elif d == "drain":
            lib.rect(t, 4, 4, 8, 8, c["e"])
            for k in range(5, 12, 2):
                lib.rect(t, 5, k, 6, 1, c["K"])
        else:
            lib.rect(t, 0, 5, T, 1, c["s"])
            lib.rect(t, 0, 10, T, 1, c["s"])
            t[5, :] = c["g"]
        sh.put(12 + i, 0, t, f"occ-detail-{d}")
    # Wang beton/planche
    for m in range(16):
        mask = (bool(m & 8), bool(m & 4), bool(m & 2), bool(m & 1))
        t = corner_tile(mask, lambda s: occ_floor(s, "planche"), lambda s: occ_floor(s, "beton"), seed=40 + m)
        t[t == c["1"]] = c["e"]
        t[t == c["D"]] = c["h"]
        t[t == c["5"]] = c["p"]
        sh.put(m, 1, t, f"wang-planche-beton-{m}")
    masks = blob_masks()
    for i, mk in enumerate(masks):
        sh.put(i % 16, 2 + i // 16, wall_top(mk, base="h", rim_hi="m", rim_lo="e", inner="B"),
               "walltop-" + "".join(map(str, mk)))
    sh.put(15, 4, occ_floor(99), "blob-spare")
    pal = ("r", "B", "S", "B", "h", "bricks")
    kinds = ["left", "midA", "midB", "midC", "right", "doorL", "doorR", "plinth"]
    for i, k in enumerate(kinds):
        sh.put(i, 5, wall_face(k, False, pal), f"wall-{k}-top")
        sh.put(i, 6, wall_face(k, True, pal), f"wall-{k}-bot")
    # façades spéciales OCC : voûte, photo jaunie, plaque des 7 commandements,
    # étagère de lanternes, tableau à palettes, casiers, tableau de liège, horloge
    specials = _facades_occ(pal)
    for i, (name, (top, bot)) in enumerate(specials):
        sh.put(8 + i, 5, top, f"facade-{name}-top")
        sh.put(8 + i, 6, bot, f"facade-{name}-bot")
    # comptoir (bords, 4 côtés + coins) en rangée 7
    for i, t in enumerate(_counter_tiles()):
        sh.put(i, 7, t[1], f"counter-{t[0]}")
    # voûte : arcs de briques (rangées 8-9)
    for i in range(8):
        top, bot = _vault(i)
        sh.put(i, 8, top, f"vault-{i}-top")
        sh.put(i, 9, bot, f"vault-{i}-bot")
    # rails de l'ancienne sous-station encastrés dans le sol (rangée 10)
    for i in range(4):
        t = occ_floor(70 + i)
        lib.rect(t, 0, 6, T, 4, c["e"])
        lib.rect(t, 0, 6, T, 1, c["g"])
        lib.rect(t, 0, 9, T, 1, c["g"])
        sh.put(i, 10, t, f"occ-rail-{i}")
    # détails (rangée 11) : tasses, grains, câble, tache de café, flaque
    for i in range(8):
        t = occ_floor(80 + i, "beton" if i < 4 else "planche")
        if i % 4 == 0:
            lib.rect(t, 6, 7, 3, 3, c["q"])
            t[8, 7] = c["e"]
        elif i % 4 == 1:
            for (x, y) in ((4, 5), (9, 9), (12, 4)):
                lib.rect(t, x, y, 2, 2, c["e"])
                t[y, x] = c["m"]
        elif i % 4 == 2:
            lib.line(t, 0, 10, 15, 6, c["K"])
        else:
            t[lib.ellipse_mask((T, T), 8, 8, 4, 2.5)] = c["e"]
        sh.put(i, 11, t, f"occ-mark-{i}")
    # ombres d'arches (rangée 12)
    for i in range(4):
        t = canvas(T)
        m = lib.ellipse_mask((T, T), 8 + (i - 1.5) * 8, 16, 10, 10)
        t[m] = c["e"]
        sh.put(i, 12, t, f"occ-arch-shadow-{i}")
    sh.put(0, 13, tile("K"), "void-black")
    t = tile("e")
    t[lib.checker((T, T))] = c["K"]
    sh.put(1, 13, t, "void-dark")
    # animées : lanterne murale, vapeur
    for f in range(4):
        t = wall_face("midA", False, pal)
        # halo chaud sur les briques autour de la lanterne
        glow = lib.ellipse_mask((T, T), 8, 9, 7.5, 7.5)
        t[glow & (t == c["r"])] = c["S"]
        t[glow & (t == c["S"]) & lib.ellipse_mask((T, T), 8, 9, 5, 5)] = c["z"]
        lib.rect(t, 6, 4, 4, 2, c["d"])
        lib.rect(t, 5, 6, 6, 6, c["h"])
        lib.rect(t, 6, 7, 4, 4, c[("a", "y", "a", "Z")[f]])
        lib.rect(t, 7, 8, 2, 2, c["Z"] if f != 2 else c["y"])
        t[8, 7] = c["w"] if f == 1 else c["Z"]
        lib.rect(t, 5, 12, 6, 1, c["d"])
        sh.put(f, 14, t, f"anim-lantern-{f}")
        st = occ_floor(90)
        for k in range(3):
            y = 12 - ((f * 3 + k * 4) % 12)
            x = 6 + k * 2 + (f % 2)
            st[y, x] = c["q"]
            st[y - 1, x] = c["q"] if k == 1 else st[y - 1, x]
        sh.put(4 + f, 14, st, f"anim-steam-{f}")
    sh.anims = {
        "anim-lantern": {"tiles": [sh.names[f"anim-lantern-{f}"] for f in range(4)], "durations": [200, 150, 200, 250]},
        "anim-steam": {"tiles": [sh.names[f"anim-steam-{f}"] for f in range(4)], "durations": [200] * 4},
    }
    return sh


def _facades_occ(pal):
    out = []

    def base():
        return wall_face("midA", False, pal), wall_face("midA", True, pal)

    top, bot = base()
    lib.rect(top, 3, 4, 10, 8, c["q"])
    lib.rect(top, 4, 5, 8, 6, c["z"])
    lib.rect(top, 5, 7, 2, 3, c["h"])
    lib.rect(top, 9, 6, 2, 4, c["h"])
    out.append(("photo", (top, bot)))
    top, bot = base()
    lib.rect(top, 2, 3, 12, 13, c["a"])
    lib.rect(top, 3, 4, 10, 11, c["z"])
    for y in range(5, 15, 2):
        lib.rect(top, 4, y, 8, 1, c["m"])
    lib.rect(bot, 2, 0, 12, 4, c["a"])
    lib.rect(bot, 3, 0, 10, 3, c["z"])
    out.append(("commandements", (top, bot)))
    top, bot = base()
    for y in (4, 10):
        lib.rect(top, 1, y + 4, 14, 1, c["m"])
        for x in (2, 7, 11):
            lib.rect(top, x, y, 3, 4, c["h"])
            lib.rect(top, x, y + 1, 3, 2, c["a"])
    lib.rect(bot, 1, 0, 14, 1, c["m"])
    out.append(("lanternes", (top, bot)))
    top, bot = base()
    lib.rect(top, 1, 2, 14, 14, c["K"])
    for y in range(4, 16, 3):
        for x in range(2, 14, 3):
            lib.rect(top, x, y, 2, 2, c["a"] if (x + y) % 2 else c["q"])
    lib.rect(bot, 1, 0, 14, 5, c["K"])
    out.append(("palettes", (top, bot)))
    top, bot = base()
    lib.rect(top, 1, 2, 14, 14, c["z"])
    lib.rect(top, 1, 2, 14, 1, c["m"])
    for (x, y, col) in ((3, 5, "q"), (9, 4, "q"), (6, 10, "x"), (11, 11, "q")):
        lib.rect(top, x, y, 3, 3, c[col])
    lib.line(top, 4, 6, 10, 5, c["x"])
    lib.line(top, 10, 5, 7, 11, c["x"])
    lib.rect(bot, 1, 0, 14, 6, c["z"])
    out.append(("liege", (top, bot)))
    top, bot = base()
    lib.rect(top, 1, 3, 14, 13, c["s"])
    for x in (1, 8):
        lib.rect(top, x, 3, 7, 13, c["s"])
        lib.rect(top, x + 1, 4, 5, 11, c["g"])
        lib.rect(top, x + 4, 9, 1, 2, c["b"])
    lib.rect(bot, 1, 0, 14, 10, c["s"])
    for x in (1, 8):
        lib.rect(bot, x + 1, 0, 5, 9, c["g"])
    out.append(("casiers", (top, bot)))
    top, bot = base()
    t_m = lib.ellipse_mask((T, T), 8, 9, 6, 6)
    top[t_m] = c["q"]
    top[lib.ellipse_mask((T, T), 8, 9, 6, 6) & ~lib.ellipse_mask((T, T), 8, 9, 5, 5)] = c["h"]
    lib.line(top, 8, 9, 8, 5, c["K"])
    lib.line(top, 8, 9, 10, 9, c["K"])
    out.append(("horloge-712", (top, bot)))
    top, bot = base()
    draw_text(top, "OCC", 2, 6, c["a"], shadow=c["e"])
    out.append(("enseigne", (top, bot)))
    return out


def _counter_tiles():
    out = []
    for name in ("top-left", "top", "top-right", "front-left", "front", "front-right", "end-left", "end-right"):
        t = canvas(T)
        if name.startswith("top"):
            t[:] = c["z"]
            t[0, :] = c["p"]
            t[1, :] = c["z"]
            for y in (5, 10):
                t[y, :] = c["m"]
            if "left" in name:
                t[:, 0] = c["p"]
            if "right" in name:
                t[:, T - 1] = c["m"]
        elif name.startswith("front"):
            t[:] = c["m"]
            t[0:2, :] = c["z"]
            t[2, :] = c["h"]
            for x in range(3, T, 6):
                t[4:14, x] = c["h"]
            t[T - 2 :, :] = c["e"]
            if "left" in name:
                t[:, 0] = c["z"]
            if "right" in name:
                t[:, T - 1] = c["e"]
        else:
            t[:] = c["m"]
            t[:, 0 if "left" in name else T - 1] = c["e"]
            t[0, :] = c["z"]
        out.append((name, t))
    return out


def _vault(i):
    """Arche de briques (2 tuiles de haut), 8 colonnes formant 2 arches."""
    W, H = 4 * T, 2 * T
    a = canvas(W, H)
    pal = ("r", "B", "S", "B", "h", "bricks")
    for x in range(4):
        a[:T, x * T : (x + 1) * T] = wall_face("midA", False, pal)
        a[T:, x * T : (x + 1) * T] = wall_face("midA", True, pal)
    m = lib.ellipse_mask((H, W), W / 2, H + 2, W / 2 - 6, H - 4)
    a[m] = c["K"]
    ring = lib.ellipse_mask((H, W), W / 2, H + 2, W / 2 - 3, H - 1) & ~m
    a[ring] = c["z"]
    a[lib.ellipse_mask((H, W), W / 2, H + 2, W / 2 - 4, H - 2) & ~m & ring] = c["r"]
    j = i % 4
    return a[:T, j * T : (j + 1) * T], a[T:, j * T : (j + 1) * T]


# ==========================================================================
# COMMUN : ombres portées décor, vide, debug collision (128×128)
# ==========================================================================

def build_commun():
    sh = Sheet(8, 8)
    n = c["n"]
    shapes = []
    # 16 formes d'ombre (décalées bas-droite)
    for k in range(16):
        t = canvas(T)
        if k == 0:
            t[:6, :] = n  # bas de mur
        elif k == 1:
            t[:, :6] = n  # côté
        elif k == 2:
            t[:6, :] = n
            t[:, :6] = n
        elif k == 3:
            t[:6, :6] = n  # coin
        elif k == 4:
            t[lib.ellipse_mask((T, T), 10, 10, 6, 4)] = n  # pilier
        elif k == 5:
            t[lib.ellipse_mask((T, T), 8, 8, 7, 4)] = n
        elif k == 6:
            t[:3, :] = n
        elif k == 7:
            t[:, :3] = n
        elif k == 8:
            for y in range(T):
                t[y, : max(0, 12 - y)] = n  # diagonale
        elif k == 9:
            t[:10, :] = n
        elif k == 10:
            t[:, :10] = n
        elif k == 11:
            t[:] = n
        elif k == 12:
            t[lib.checker((T, T))] = n
        elif k == 13:
            t[:6, 6:] = n
        elif k == 14:
            t[6:, :6] = n
        else:
            t[lib.ellipse_mask((T, T), 8, 8, 4, 3)] = n
        sh.put(k % 8, k // 8, t, f"shadow-{k}")
    sh.put(0, 2, tile("K"), "void-black")
    t = tile("n")
    t[lib.checker((T, T))] = c["K"]
    sh.put(1, 2, t, "void-night")
    for i, (name, col) in enumerate((("solid", "M"), ("hazard", "y"), ("void", "c"), ("trigger", "L"))):
        t = canvas(T)
        t[:] = c[col]
        t[1:-1, 1:-1][lib.checker((T - 2, T - 2))] = 0
        draw_text(t, name[0].upper(), 6, 5, c["K"])
        sh.put(i, 3, t, f"debug-{name}")
    return sh


def to_rgba_image(a):
    lut = np.array(RGBA, dtype=np.uint8)
    return Image.fromarray(lut[a], "RGBA")


def build_tiles(emit_raw):
    for name, sheet in (("tiles_quais", build_quais()), ("tiles_occ", build_occ()), ("tiles_commun", build_commun())):
        ext = sheet.extruded()
        emit_raw("tilesets", f"{name}.png", to_rgba_image(ext), {
            "type": "tileset", "tileWidth": T, "tileHeight": T, "margin": 1, "spacing": 2,
            "columns": sheet.cols, "rows": sheet.rows, "width": ext.shape[1], "height": ext.shape[0],
            "tiles": sheet.names, "animations": sheet.anims,
        }, preview_arr=sheet.a, normal_src=ext, normal_cell=(T + 2, T + 2))
