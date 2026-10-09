"""Primitives de pixel art sur des images indexées (numpy uint8, 0 = transparent).

Tout est dessiné en indices de la palette Privatix 32 ; la conversion RGBA
n'a lieu qu'à l'export (alpha binaire 0/255 garanti).
"""
import math

import numpy as np
from PIL import Image

from palette import CHAR, DARK, K, RGBA

DARK_A = np.array(DARK, dtype=np.uint8)

# --------------------------------------------------------------------------
# Création / parsing
# --------------------------------------------------------------------------


def canvas(w, h=None):
    return np.zeros((h if h is not None else w, w), dtype=np.uint8)


def parse(art, cmap=None):
    """Matrice de caractères -> tableau d'indices. Les lignes vides du début/fin
    sont ignorées ; l'indentation commune est retirée ; les lignes sont
    complétées à droite par de la transparence."""
    cmap = cmap or CHAR
    lines = art.split("\n")
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    indent = min((len(l) - len(l.lstrip(" ")) for l in lines if l.strip()), default=0)
    lines = [l[indent:].rstrip() for l in lines]
    w = max(len(l) for l in lines)
    a = np.zeros((len(lines), w), dtype=np.uint8)
    for y, l in enumerate(lines):
        for x, ch in enumerate(l):
            a[y, x] = cmap[ch]
    return a


def recolor(a, mapping):
    """mapping : {indice_source: indice_cible} (lettres acceptées)."""
    out = a.copy()
    for s, d in mapping.items():
        s = CHAR[s] if isinstance(s, str) else s
        d = CHAR[d] if isinstance(d, str) else d
        out[a == s] = d
    return out


def flipx(a):
    return a[:, ::-1].copy()


def flipy(a):
    return a[::-1, :].copy()


def rot90(a, k=1):
    """Rotation de k × 90° dans le sens horaire (à l'écran)."""
    return np.rot90(a, -k).copy()


# --------------------------------------------------------------------------
# Composition
# --------------------------------------------------------------------------


def blit(dst, src, x, y, edge=None, only_on=None, cast=False):
    """Colle src (transparence = 0) dans dst en (x, y) (coin haut-gauche).

    edge : indice de couleur posé sur les pixels déjà opaques de dst qui
    bordent la pièce (séparation interne), ou "selout" : ces pixels prennent
    le ton deux crans plus sombre de leur propre matériau.
    cast : ombre portée de la pièce (lumière haut-gauche) sur dst, décalée
    de (+1, +1), un ton plus sombre (occlusion sous les bras, le menton…).
    """
    h, w = src.shape
    H, W = dst.shape
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(W, x + w), min(H, y + h)
    if x0 >= x1 or y0 >= y1:
        return dst
    sub = src[y0 - y : y1 - y, x0 - x : x1 - x]
    if edge is not None or cast:
        mask = np.zeros_like(dst, dtype=bool)
        mask[y0:y1, x0:x1] = sub > 0
    if cast:
        sh = np.zeros_like(mask)
        sh[1:, 1:] = mask[:-1, :-1]
        sh[1:, :] |= mask[:-1, :]
        ring = sh & ~mask & (dst > 0) & (dst != K)
        dst[ring] = DARK_A[dst[ring]]
    if edge is not None:
        ring = _dilate4(mask) & ~mask & (dst > 0)
        if isinstance(edge, str) and edge == "selout":
            ring &= dst != K
            dst[ring] = DARK_A[DARK_A[dst[ring]]]
        else:
            dst[ring] = edge
    region = dst[y0:y1, x0:x1]
    m = sub > 0
    if only_on is not None:
        m &= region > 0
    region[m] = sub[m]
    return dst


def _dilate4(m):
    d = m.copy()
    d[1:, :] |= m[:-1, :]
    d[:-1, :] |= m[1:, :]
    d[:, 1:] |= m[:, :-1]
    d[:, :-1] |= m[:, 1:]
    return d


def _dilate8(m):
    d = _dilate4(m)
    d[1:, 1:] |= m[:-1, :-1]
    d[1:, :-1] |= m[:-1, 1:]
    d[:-1, 1:] |= m[1:, :-1]
    d[:-1, :-1] |= m[1:, 1:]
    return d


def outline(a, color=K, diag=False):
    """Contour extérieur 1 px (4-voisinage par défaut)."""
    m = a > 0
    ring = (_dilate8(m) if diag else _dilate4(m)) & ~m
    out = a.copy()
    out[ring] = color
    return out


def shift(a, dx, dy):
    out = np.zeros_like(a)
    blit(out, a, dx, dy)
    return out


def bbox(a):
    ys, xs = np.nonzero(a)
    if len(xs) == 0:
        return None
    return xs.min(), ys.min(), xs.max(), ys.max()


# --------------------------------------------------------------------------
# Formes
# --------------------------------------------------------------------------


def px(a, x, y, c):
    if 0 <= y < a.shape[0] and 0 <= x < a.shape[1]:
        a[y, x] = c


def rect(a, x, y, w, h, c):
    H, W = a.shape
    a[max(0, y) : max(0, min(H, y + h)), max(0, x) : max(0, min(W, x + w))] = c


def line(a, x0, y0, x1, y1, c):
    """Bresenham, 1 px."""
    x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        px(a, x0, y0, c)
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy


def thick_line(a, x0, y0, x1, y1, c, w=2):
    for ox in range(w):
        for oy in range(w):
            line(a, x0 + ox - (w - 1) // 2, y0 + oy - (w - 1) // 2, x1 + ox - (w - 1) // 2, y1 + oy - (w - 1) // 2, c)


def ellipse(a, cx, cy, rx, ry, c, fill=True):
    """Ellipse pixel-propre centrée en (cx, cy) (centres demi-entiers autorisés)."""
    H, W = a.shape
    rx2, ry2 = max(rx, 0.5) ** 2, max(ry, 0.5) ** 2
    for y in range(H):
        for x in range(W):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            v = dx * dx / rx2 + dy * dy / ry2
            if fill and v <= 1.0:
                a[y, x] = c
    if not fill:
        m = np.zeros(a.shape, dtype=bool)
        for y in range(H):
            for x in range(W):
                dx, dy = x + 0.5 - cx, y + 0.5 - cy
                m[y, x] = dx * dx / rx2 + dy * dy / ry2 <= 1.0
        edge = m & ~_erode4(m)
        a[edge] = c
    return a


def _erode4(m):
    e = m.copy()
    e[1:, :] &= m[:-1, :]
    e[:-1, :] &= m[1:, :]
    e[:, 1:] &= m[:, :-1]
    e[:, :-1] &= m[:, 1:]
    e[0, :] = e[-1, :] = False
    e[:, 0] = e[:, -1] = False
    return e


def ellipse_mask(shape, cx, cy, rx, ry):
    H, W = shape
    ys, xs = np.mgrid[0:H, 0:W]
    dx, dy = xs + 0.5 - cx, ys + 0.5 - cy
    return dx * dx / max(rx, 0.5) ** 2 + dy * dy / max(ry, 0.5) ** 2 <= 1.0


def ring_mask(shape, cx, cy, r_out, r_in, sy=1.0):
    H, W = shape
    ys, xs = np.mgrid[0:H, 0:W]
    dx, dy = xs + 0.5 - cx, (ys + 0.5 - cy) / sy
    d = np.sqrt(dx * dx + dy * dy)
    return (d <= r_out) & (d > r_in)


def polar(shape, cx, cy):
    H, W = shape
    ys, xs = np.mgrid[0:H, 0:W]
    dx, dy = xs + 0.5 - cx, ys + 0.5 - cy
    return np.sqrt(dx * dx + dy * dy), np.degrees(np.arctan2(dy, dx))


def angle_in(ang, a0, a1):
    """ang (tableau, degrés) dans l'arc a0 -> a1 (sens horaire écran si a1 > a0)."""
    lo, hi = min(a0, a1), max(a0, a1)
    span = hi - lo
    rel = (ang - lo) % 360
    return rel <= span


def checker(shape, phase=0):
    ys, xs = np.mgrid[0 : shape[0], 0 : shape[1]]
    return ((xs + ys + phase) % 2) == 0


def rng(seed):
    return np.random.default_rng(seed)


# --------------------------------------------------------------------------
# Objets rigides tournés (clé, bras-barrières…) : échantillonnage analytique
# --------------------------------------------------------------------------


def snap_angle(deg, step=22.5):
    return round(deg / step) * step


def draw_rotated(a, ox, oy, angle_deg, shapes, light=(-1, -1)):
    """Dessine des rectangles définis dans un repère local (u le long de l'axe,
    v perpendiculaire) tournés de angle_deg autour de (ox, oy).

    shapes : liste de (u0, u1, v0, v1, couleurs) où couleurs = (clair, moyen,
    sombre) : le côté dont la normale regarde la lumière (haut-gauche) reçoit
    le ton clair, l'autre le ton sombre.
    """
    th = math.radians(angle_deg)
    cu, su = math.cos(th), math.sin(th)
    # normale +v en coordonnées écran
    nvx, nvy = -su, cu
    lx, ly = light
    lit_pos_v = (nvx * lx + nvy * ly) > 0  # le côté +v regarde la lumière ?
    H, W = a.shape
    umax = max(abs(s[0]) + abs(s[1]) + abs(s[2]) + abs(s[3]) for s in shapes) + 2
    x0, x1 = int(ox - umax), int(ox + umax) + 1
    y0, y1 = int(oy - umax), int(oy + umax) + 1
    for y in range(max(0, y0), min(H, y1)):
        for x in range(max(0, x0), min(W, x1)):
            dx, dy = x + 0.5 - ox, y + 0.5 - oy
            u = dx * cu + dy * su
            v = -dx * su + dy * cu
            for (u0, u1, v0, v1, cols) in shapes:
                if u0 <= u < u1 and v0 <= v < v1:
                    light_c, mid_c, dark_c = cols
                    vmid = (v0 + v1) / 2
                    width = v1 - v0
                    if width >= 2.5:
                        edge_hi = (v >= v1 - 1) if lit_pos_v else (v < v0 + 1)
                        edge_lo = (v < v0 + 1) if lit_pos_v else (v >= v1 - 1)
                        a[y, x] = light_c if edge_hi else dark_c if edge_lo else mid_c
                    else:
                        hi = (v >= vmid) == lit_pos_v
                        a[y, x] = light_c if hi else dark_c
    return a


# --------------------------------------------------------------------------
# Export
# --------------------------------------------------------------------------

_LUT = np.array(RGBA, dtype=np.uint8)


def to_image(a):
    return Image.fromarray(_LUT[a], "RGBA")


def strip(frames):
    h, w = frames[0].shape
    for f in frames:
        assert f.shape == (h, w), (f.shape, (h, w))
    return np.concatenate(frames, axis=1)


def save(a, path):
    to_image(a).save(path, optimize=True)
