"""VFX, projectiles, pickups, ombres et lumières.

Règles (art_director §7) : VFX sans contour, noyau blanc + 2 teintes ; joueur =
blanc / jaune / ambre / orange ; ennemis = magenta / turquoise. Pickups et
projectiles ont un contour 1 px #14101A. Alpha binaire partout.
"""
import math

import numpy as np

import lib
import modern
from font3x5 import draw_text
from lib import canvas, blit, parse
from palette import CHAR, K

c = CHAR
PLAYER = ("W", "y", "a", "O")
ENEMY = ("W", "N", "T", "M")


def _paint(a, mask, col):
    a[mask] = c[col]


# --------------------------------------------------------------------------
# Arcs de slash (dessinés vers l'est / le sud-est)
# --------------------------------------------------------------------------

def slash(rot=0.0, S=64):
    """Croissant façon Dead Cells : cœur blanc, bords colorés (éclat chaud à
    l'extérieur, orange à l'intérieur), tête plus large et plus claire,
    dissipation en stries et en étincelles."""
    frames = []
    cx = cy = S / 2
    d, ang = lib.polar((S, S), cx, cy)
    ang = (ang - rot + 540) % 360 - 180  # repère local : 0° = direction du coup
    # (début, fin de l'arc en degrés locaux, épaisseur max, rayon ext)
    keys = [(-85, -45, 5, 24), (-85, 15, 10, 27), (-80, 80, 12, 29), (-45, 85, 9, 29), (10, 88, 5, 28)]
    g = lib.rng(11)
    for i, (a0, a1, th, ro) in enumerate(keys):
        f = canvas(S)
        span = a1 - a0
        t = np.clip((ang - a0) / max(1, span), 0, 1)
        inside = (ang >= a0) & (ang <= a1)
        prof = np.sin(np.pi * np.clip(t, 0, 1) ** 0.8) ** 0.6
        thick = th * prof
        m = inside & (d <= ro) & (d > ro - thick)
        rel = (ro - d) / np.maximum(thick, 0.01)
        hot = i <= 2
        _paint(f, m, "O")
        _paint(f, m & (rel < 0.85), "a" if not hot else "y")
        _paint(f, m & (rel < 0.68), "Z" if hot else "y")
        _paint(f, m & (rel < 0.52) & (rel >= 0.12), "W" if hot else "Z")
        _paint(f, m & (rel < 0.12), "j")
        if hot:
            # tête du coup : noyau blanc élargi
            _paint(f, m & (t > 0.55) & (t < 0.9) & (rel > 0.1) & (rel < 0.7), "W")
        if i >= 3:
            # dissipation en stries
            cut = inside & (((ang // 7).astype(int) + i) % 3 == 0)
            f[cut] = 0
        # étincelles qui s'échappent de l'arc
        if i >= 2:
            for k in range(5 + i):
                aa = math.radians(a0 + g.random() * span + rot)
                rr = ro + 1 + g.random() * (2 + i * 2)
                x, y = int(cx + math.cos(aa) * rr), int(cy + math.sin(aa) * rr)
                lib.px(f, x, y, c["W" if k % 3 == 0 else "Z" if k % 3 == 1 else "y"])
                if i == 2 and k % 2 == 0:
                    lib.px(f, x + 1, y, c["y"])
        frames.append(f)
    return frames


# --------------------------------------------------------------------------
# Impacts
# --------------------------------------------------------------------------

def star(S, r, rays=8, inner=0.35, rot=0.0):
    d, ang = lib.polar((S, S), S / 2, S / 2)
    k = np.abs(np.cos(np.radians((ang - rot) * rays / 2)))
    edge = r * (inner + (1 - inner) * k ** 6)
    return d <= edge


def hit(S=32, big=False):
    """Impact « étoile » : flash blanc, étoile à 8 branches (cœur blanc ->
    jaune -> orange), halo en anneau qui s'ouvre, éclats."""
    frames = []
    n = 6 if big else 5
    R = S / 2 - 1
    cx = cy = S / 2
    for i in range(n):
        f = canvas(S)
        t = i / (n - 1)
        if i == 0:
            _paint(f, lib.ellipse_mask((S, S), cx, cy, R * 0.55, R * 0.55), "Z")
            _paint(f, lib.ellipse_mask((S, S), cx, cy, R * 0.42, R * 0.42), "W")
            _paint(f, star(S, R * 0.95, rays=4, inner=0.12), "W")
        else:
            # halo
            rh = R * (0.45 + 0.55 * t)
            ring = lib.ring_mask((S, S), cx, cy, rh, rh - 1)
            _d, _a = lib.polar((S, S), cx, cy)
            ring &= ((_a // 30).astype(int) % 2 == i % 2) | (i == 1)
            _paint(f, ring, "a" if i > 2 else "y")
            if i < n - 1:
                r = R * (0.9 - 0.25 * t)
                m = star(S, r, rays=8, inner=0.14 + 0.08 * t, rot=22.5 * (i % 2))
                hole = lib.ellipse_mask((S, S), cx, cy, r * 0.3 * t, r * 0.3 * t) if t > 0.6 else np.zeros((S, S), bool)
                _paint(f, m & ~hole, "O" if t > 0.6 else "f")
                _paint(f, star(S, r * 0.75, rays=8, inner=0.18, rot=22.5 * (i % 2)) & ~hole, "y")
                _paint(f, star(S, r * 0.5, rays=4, inner=0.25) & ~hole, "Z")
                _paint(f, star(S, r * 0.32, rays=4, inner=0.3) & ~hole, "W")
        # éclats
        if 0 < i < n - 1:
            for k in range(8 if big else 6):
                a_ = k * (2 * math.pi / (8 if big else 6)) + 0.4
                dist = R * (0.35 + t * 0.7)
                x, y = int(cx + math.cos(a_) * dist), int(cy + math.sin(a_) * dist)
                lib.px(f, x, y, c["W" if k % 2 else "Z"])
                if big:
                    lib.px(f, x + (1 if math.cos(a_) > 0 else -1), y, c["y"])
        frames.append(f)
    return frames


def slam(S=64):
    """Coup de tire-fond : flash, fissures radiales, gravats, anneau de poussière."""
    frames = []
    cx, cy = S / 2, S / 2 + 6
    g = lib.rng(3)
    cracks = []
    for k in range(7):
        a0 = k * (360 / 7) + g.random() * 20
        pts = [(cx, cy)]
        r = 0
        for s in range(5):
            r += 4 + g.random() * 2
            aa = math.radians(a0 + (g.random() - 0.5) * 30)
            pts.append((cx + math.cos(aa) * r, cy + math.sin(aa) * r * 0.55))
        cracks.append(pts)
    rocks = [(math.radians(k * 51 + 10), 3 + g.random() * 3) for k in range(7)]
    for i in range(7):
        f = canvas(S)
        # anneau de poussière
        if i >= 1:
            ro = 8 + i * 4
            m = lib.ring_mask((S, S), cx, cy, ro, ro - (4 if i < 5 else 2), sy=0.55)
            m &= ~(lib.checker((S, S)) & (i >= 5))
            _paint(f, m, "q" if i < 4 else "b")
        # fissures
        seg = min(5, 1 + i)
        for pts in cracks:
            for (x0, y0), (x1, y1) in zip(pts[:seg], pts[1:seg + 1]):
                lib.line(f, x0, y0, x1, y1, c["K"] if i < 5 else c["e"])
        # flash central
        if i <= 2:
            r = (8, 10, 5)[i]
            _paint(f, lib.ellipse_mask((S, S), cx, cy, r * 1.6, r * 0.9), "a" if i else "Z")
            _paint(f, lib.ellipse_mask((S, S), cx, cy, r * 1.3, r * 0.72), "y" if i else "W")
            _paint(f, lib.ellipse_mask((S, S), cx, cy, r * 0.8, r * 0.45), "W")
            if i == 0:
                _paint(f, star(S, 22, rays=4, inner=0.06) & lib.ellipse_mask((S, S), cx, cy, 30, 16), "W")
        # gravats
        if 1 <= i <= 5:
            for k, (aa, sp) in enumerate(rocks):
                d = sp * i * 1.6
                x = cx + math.cos(aa) * d
                y = cy + math.sin(aa) * d * 0.55 - (i * 4 - i * i * 0.7) * 1.4
                lib.rect(f, int(x), int(y), 2, 2, c["s"])
                lib.px(f, int(x), int(y), c["b"])
        frames.append(f)
    return frames


def dash_puff(S=32):
    frames = []
    for i in range(5):
        f = canvas(S)
        # bouffée vers l'ouest (le dash part vers l'est)
        for k in range(3):
            r = 2 + i * 1.2 - k * 0.6
            x = 14 - k * 4 - i * 1.5
            y = 16 + (k - 1) * 3
            if r > 0.6:
                _paint(f, lib.ellipse_mask((S, S), x, y, r * 1.2, r), "q" if i < 3 else "b")
                if i < 2:
                    _paint(f, lib.ellipse_mask((S, S), x + 0.5, y - 0.5, r * 0.5, r * 0.4), "W")
        # lignes de vitesse
        for k in range(3):
            y = 12 + k * 4
            x1 = 22 - i * 2
            ln = max(0, 8 - i * 2)
            if ln:
                lib.rect(f, x1 - ln, y, ln, 1, c["O" if k == 1 else "a"])
        frames.append(f)
    return frames


def dust(S=16, n=5, big=False):
    frames = []
    for i in range(n):
        f = canvas(S)
        t = i / (n - 1)
        if big:
            for k in range(6):
                aa = math.pi + k * math.pi / 5
                d = 4 + t * 10
                x, y = S / 2 + math.cos(aa) * d, S / 2 + 6 + math.sin(aa) * d * 0.45 - t * 2
                r = max(0.0, 3 - t * 2.4)
                if r > 0.5:
                    _paint(f, lib.ellipse_mask((S, S), x, y, r + 0.5, r), "b" if t < 0.5 else "g")
                    _paint(f, lib.ellipse_mask((S, S), x - 0.6, y - 0.6, (r + 0.5) * 0.6, r * 0.6),
                           "q" if t < 0.4 else "7")
            for k in range(2):
                x = S / 2 + (k * 2 - 1) * (6 + t * 8)
                r = max(0.0, 2.5 - t * 2)
                if r > 0.5:
                    _paint(f, lib.ellipse_mask((S, S), x, S / 2 + 7, r + 1, r), "b")
        else:
            for k in (-1, 1):
                x = S / 2 + k * (2 + t * 4)
                y = S / 2 + 3 - t * 3
                r = max(0.0, 2.6 - t * 2.2)
                if r > 0.5:
                    _paint(f, lib.ellipse_mask((S, S), x, y, r + 0.4, r), "b" if t < 0.5 else "g")
                    _paint(f, lib.ellipse_mask((S, S), x - 0.5, y - 0.5, (r + 0.4) * 0.55, r * 0.55),
                           "q" if t < 0.4 else "7")
        frames.append(f)
    return frames


def sparks(S=16):
    """Gerbe d'étincelles : têtes blanches, traînes jaune -> ambre, gravité."""
    frames = []
    g = lib.rng(21)
    dirs = [(math.cos(a_), math.sin(a_)) for a_ in np.linspace(-2.6, -0.5, 7)] + [(1, 0.3), (-1, 0.2)]
    sp = [0.8 + g.random() * 0.6 for _ in dirs]
    for i in range(4):
        f = canvas(S)
        if i == 0:
            _paint(f, lib.ellipse_mask((S, S), S / 2, S / 2 + 2, 2.5, 2.5), "Z")
            _paint(f, lib.ellipse_mask((S, S), S / 2, S / 2 + 2, 1.5, 1.5), "W")
        for k, ((dx, dy), v) in enumerate(zip(dirs, sp)):
            d = (2 + i * 2.2) * v
            x0, y0 = S / 2 + dx * d, S / 2 + 2 + dy * d + 0.45 * i * i
            x1, y1 = x0 - dx * (2.5 - i * 0.5), y0 - dy * (2.5 - i * 0.5) - 0.4 * i
            lib.line(f, x1, y1, x0, y0, c["a" if i >= 2 else "y"])
            lib.px(f, int(round(x0)), int(round(y0)), c["W" if i < 3 else "Z"])
        frames.append(f)
    return frames


def particles():
    pats = [
        "........\n........\n........\n...WW...\n...WW...\n........\n........\n........",
        "........\n...W....\n...W....\n.WWWWW..\n...W....\n...W....\n........\n........",
        "........\n........\n...aa...\n..ayOa..\n..aOOa..\n...aa...\n........\n........",
        "........\n.....W..\n....vW..\n...vv...\n..vv....\n..v.....\n........\n........",
        "........\n........\n.wwwww..\n.wMwMw..\n.wwwww..\n........\n........\n........",
        "........\n...h....\n..hmh...\n..hmh...\n...h....\n........\n........\n........",
        "........\n..bb....\n.bqqb...\n.bqqbb..\n..bbqb..\n...bb...\n........\n........",
        "........\n...hh...\n..hmzh..\n..hmeh..\n..hmzh..\n...hh...\n........\n........",
    ]
    return [parse(p) for p in pats]


# --------------------------------------------------------------------------
# Projectiles
# --------------------------------------------------------------------------

TICKET = parse(
    """
    wwwwwww
    wMMMMMw
    wwwwwww
    wMwMwMw
    """
)


def _ticket_rot(k, S=16):
    f = canvas(S)
    t = TICKET.copy()
    if k == 0:
        blit(f, t, 5, 6)
    elif k == 2:
        blit(f, lib.rot90(t), 6, 5)
    else:
        # diagonale dessinée à la main
        d = parse(
            """
            ...ww
            ..wMw
            .wMww
            wMww.
            wMw..
            ww...
            """
        )
        if k == 3:
            d = lib.flipx(d)
        blit(f, d, 5, 5)
    f = lib.outline(f)
    # halo magenta (menace)
    halo = lib.outline((f > 0).astype(np.uint8) * 1, c["M"])
    m = (halo == c["M"]) & (f == 0)
    f[m] = c["M"]
    # second halo plus clair, en pointillés (le bloom le fait vibrer)
    halo2 = lib.outline((f > 0).astype(np.uint8) * 1, c["k"])
    m2 = (halo2 == c["k"]) & (f == 0) & lib.checker(f.shape)
    f[m2] = c["k"]
    return f


def ticket_spin():
    return [_ticket_rot(k) for k in range(4)]


def ticket_pop():
    frames = []
    for i in range(4):
        f = canvas(16)
        if i == 0:
            f = _ticket_rot(0)
            f[(f > 0) & (f != K)] = c["W"]
        else:
            for k in range(4):
                aa = k * math.pi / 2 + math.pi / 4
                d = 2 + i * 2
                x, y = int(8 + math.cos(aa) * d), int(8 + math.sin(aa) * d)
                lib.rect(f, x - 1, y, 2, 1, c["w" if i < 3 else "M"])
                lib.px(f, x, y - 1, c["M"])
        frames.append(f)
    return frames


def amende_spin():
    frames = []
    base = canvas(32)
    lib.rect(base, 4, 9, 24, 14, c["w"])
    lib.rect(base, 4, 9, 24, 3, c["M"])
    draw_text(base, "AMENDE", 5, 13, c["M"]) if False else None
    from font3x5 import text_mask
    m = text_mask("AMENDE")
    sub = base[14:19, 5:5 + m.shape[1]]
    sub[m[:, : sub.shape[1]]] = c["K"]
    lib.rect(base, 6, 20, 20, 1, c["b"])
    for x in range(5, 27, 3):
        lib.px(base, x, 22, c["b"])
    base = lib.outline(base)
    for k in range(4):
        if k == 0:
            f = base.copy()
        elif k == 2:
            f = lib.flipy(lib.flipx(base))
        else:
            # vue de tranche (rotation en Y) : compressé horizontalement
            f = canvas(32)
            core = base[:, 4:28][:, ::3]
            blit(f, core, 16 - core.shape[1] // 2, 0)
        halo = lib.outline((f > 0).astype(np.uint8), c["M"])
        f[(halo == c["M"]) & (f == 0)] = c["M"]
        frames.append(f)
    return frames


# --------------------------------------------------------------------------
# Explosions, ondes, charges, apparitions
# --------------------------------------------------------------------------

def explosion(S=64, n=10, seed=1):
    """Flash blanc, boule de feu (blanc -> néon -> turquoise -> magenta : c'est
    une machine Privatix qui saute), onde, puis fumée froide qui monte et se
    dissout par grains, débris (boulons, tickets)."""
    frames = []
    g = lib.rng(seed)
    debris = [(g.random() * 2 * math.pi, 0.6 + g.random() * 0.8, g.integers(0, 3)) for _ in range(12)]
    noise = np.kron(lib.rng(seed + 9).random((S // 2 + 1, S // 2 + 1)), np.ones((2, 2)))[:S, :S]
    R = S / 2 - 3
    cx, cy = S / 2, S / 2 + 2
    for i in range(n):
        f = canvas(S)
        t = i / (n - 1)
        if i == 0:
            _paint(f, lib.ellipse_mask((S, S), cx, cy, R * 0.55, R * 0.55), "Z")
            _paint(f, lib.ellipse_mask((S, S), cx, cy, R * 0.45, R * 0.45), "W")
            _paint(f, star(S, R * 0.95, rays=4, inner=0.1), "W")
        elif i == 1:
            _paint(f, lib.ellipse_mask((S, S), cx, cy, R * 0.75, R * 0.7), "N")
            _paint(f, lib.ellipse_mask((S, S), cx, cy, R * 0.62, R * 0.58), "X")
            _paint(f, lib.ellipse_mask((S, S), cx - 1, cy - 1, R * 0.5, R * 0.46), "W")
        elif i < n * 0.5:
            r = R * (0.45 + t * 1.0)
            blob = np.zeros((S, S), dtype=bool)
            for k in range(6):
                aa = k * 1.05 + i
                bx, by = cx + math.cos(aa) * r * 0.38, cy + math.sin(aa) * r * 0.32
                blob |= lib.ellipse_mask((S, S), bx, by, r * 0.55, r * 0.5)
            _paint(f, blob, "J")
            _paint(f, blob & lib.ellipse_mask((S, S), cx - 1, cy - 1, r * 0.82, r * 0.75), "M")
            _paint(f, lib.ellipse_mask((S, S), cx - 1, cy - 1, r * 0.62, r * 0.56) & blob, "T")
            _paint(f, lib.ellipse_mask((S, S), cx - 2, cy - 2, r * 0.42, r * 0.38), "N")
            _paint(f, lib.ellipse_mask((S, S), cx - 2, cy - 3, r * 0.22, r * 0.2), "W")
            # anneau de souffle
            ro = R * (0.5 + t * 1.3)
            _paint(f, lib.ring_mask((S, S), cx, cy, ro, ro - 1.5, sy=0.8) & (f == 0), "k")
        else:
            # fumée froide qui monte et se dissout par grains
            k_ = (t - 0.5) / 0.5
            r = R * (0.85 - k_ * 0.35)
            smoke = np.zeros((S, S), dtype=bool)
            for k in range(6):
                aa = k * 1.05
                bx = cx + math.cos(aa) * R * 0.42
                by = cy + math.sin(aa) * R * 0.28 - k_ * 14
                smoke |= lib.ellipse_mask((S, S), bx, by, r * 0.45, r * 0.4)
            smoke &= noise > k_ * 0.85
            _paint(f, smoke, "s")
            _paint(f, smoke & lib.ellipse_mask((S, S), cx - 3, cy - 4 - k_ * 14, r * 0.7, r * 0.5), "g")
            _paint(f, smoke & lib.ellipse_mask((S, S), cx - 5, cy - 7 - k_ * 14, r * 0.4, r * 0.28), "b")
            if i == int(n * 0.5):
                _paint(f, smoke & lib.ellipse_mask((S, S), cx, cy, r * 0.3, r * 0.25), "M")
        # débris : boulons, tickets, braises
        if 1 <= i <= n - 2:
            for aa, sp, kind in debris:
                d = R * sp * t * 1.25
                x = int(cx + math.cos(aa) * d)
                y = int(cy + math.sin(aa) * d - 7 * math.sin(math.pi * t))
                if kind == 0:
                    lib.rect(f, x, y, 3, 2, c["w"])
                    lib.px(f, x, y + 1, c["M"])
                elif kind == 1:
                    lib.rect(f, x, y, 2, 2, c["s"])
                    lib.px(f, x, y, c["7"])
                else:
                    lib.px(f, x, y, c["Z" if i < n * 0.6 else "y"])
        frames.append(f)
    return frames


def shockwave(S=128):
    """Onde de choc lumineuse : front blanc épais, dégradé jaune -> ambre ->
    orange vers l'intérieur, lueur intérieure, poussière soulevée."""
    frames = []
    cx, cy = S / 2, S / 2
    for i in range(8):
        f = canvas(S)
        t = i / 7
        r = 8 + t * 54
        th = max(3, 10 - i * 1.0)
        sy = 0.75
        for frac, col in ((1.0, "O"), (0.75, "a"), (0.5, "y"), (0.3, "Z")):
            _paint(f, lib.ring_mask((S, S), cx, cy, r, r - th * frac, sy=sy), col)
        _paint(f, lib.ring_mask((S, S), cx, cy, r, r - 1.6, sy=sy), "W" if i < 5 else "Z")
        # lueur intérieure tramée (paliers nets, pas de dégradé)
        if 1 <= i <= 4:
            glow = lib.ring_mask((S, S), cx, cy, r - th - 1, r - th - 4, sy=sy) & lib.checker((S, S), i)
            _paint(f, glow, "a")
        if i >= 5:
            f[lib.checker((S, S), i) & (f > 0) & ~lib.ring_mask((S, S), cx, cy, r, r - 1.6, sy=sy)] = 0
        if i <= 1:
            _paint(f, lib.ellipse_mask((S, S), cx, cy, 9 - i * 3, 7 - i * 2), "Z")
            _paint(f, lib.ellipse_mask((S, S), cx, cy, 6 - i * 2, 4.5 - i * 1.5), "W")
        # poussière soulevée
        for k in range(12):
            aa = k * 2 * math.pi / 12 + 0.3
            x = cx + math.cos(aa) * (r + 2)
            y = cy + math.sin(aa) * (r + 2) * sy - 2
            if i >= 2:
                lib.rect(f, int(x), int(y), 2, 1, c["q" if k % 2 else "7"])
        frames.append(f)
    return frames


def charge(S=48):
    frames = []
    for i in range(6):
        f = canvas(S)
        for k in range(8):
            aa = k * math.pi / 4 + i * 0.35
            d = 20 - ((i * 3 + k * 2) % 14)
            x, y = S / 2 + math.cos(aa) * d, S / 2 + math.sin(aa) * d * 0.8
            x1, y1 = S / 2 + math.cos(aa) * (d + 3), S / 2 + math.sin(aa) * (d + 3) * 0.8
            lib.line(f, x, y, x1, y1, c["y" if k % 2 else "a"])
            lib.px(f, int(x), int(y), c["W"])
        r = 6 + (i % 3)
        m = lib.ring_mask((S, S), S / 2, S / 2, r, r - 1, sy=0.8)
        _paint(f, m & lib.checker((S, S), i), "O")
        _paint(f, lib.ellipse_mask((S, S), S / 2, S / 2, 2.5 + (i % 2), 2 + (i % 2)), "Z")
        _paint(f, lib.ellipse_mask((S, S), S / 2, S / 2, 1.2, 1.2), "W")
        frames.append(f)
    return frames


def spawn_column(S=64, cols=("W", "y", "a", "O"), corporate=False):
    frames = []
    for i in range(8):
        f = canvas(S)
        t = i / 7
        w = [2, 6, 12, 14, 12, 8, 4, 1][i]
        top = [40, 8, 0, 0, 0, 0, 10, 30][i]
        x0 = S // 2 - w // 2
        if w:
            lib.rect(f, x0, top, w, 56 - top, c[cols[3]])
            lib.rect(f, x0 + 1, top, max(1, w - 2), 56 - top, c[cols[2]])
            lib.rect(f, S // 2 - max(1, w // 4), top, max(2, w // 2), 56 - top, c[cols[1]])
            lib.rect(f, S // 2 - 1, top, 2, 56 - top, c[cols[0]])
        # disque au sol
        if 1 <= i <= 6:
            r = 6 + i * 2
            _paint(f, lib.ring_mask((S, S), S / 2, 56, r, r - 2, sy=0.4), cols[2])
        if corporate:
            g = lib.rng(70 + i)
            for k in range(6):
                x = int(S / 2 + (g.random() - 0.5) * 30)
                y = int(56 - g.random() * 50 * (0.3 + t))
                lib.rect(f, x, y, 3, 2, c[cols[1]])
                lib.px(f, x, y, c["W"])
        else:
            g = lib.rng(90 + i)
            for k in range(5):
                x = int(S / 2 + (g.random() - 0.5) * 24)
                y = int(54 - g.random() * 40 - t * 6)
                lib.px(f, x, y, c["y"])
        frames.append(f)
    return frames


def poof(S=32):
    frames = []
    g = lib.rng(5)
    slides = [(g.random() * 2 * math.pi, 0.5 + g.random()) for _ in range(9)]
    for i in range(7):
        f = canvas(S)
        t = i / 6
        if i <= 1:
            _paint(f, lib.ellipse_mask((S, S), 16, 18, 7 + i * 3, 8 + i * 3), "T" if i == 0 else "t")
            _paint(f, lib.ellipse_mask((S, S), 16, 18, 5 + i * 2.5, 6 + i * 2.5), "N")
            _paint(f, lib.ellipse_mask((S, S), 16, 18, 3 + i * 2, 4 + i * 2), "X" if i else "W")
            if i == 0:
                _paint(f, lib.ellipse_mask((S, S), 16, 18, 2, 2.5), "W")
        for aa, sp in slides:
            d = 4 + t * 12 * sp
            x = int(16 + math.cos(aa) * d)
            y = int(18 + math.sin(aa) * d * 0.7 - t * 8)
            if i >= 1 and not (i >= 5 and (x + y) % 2):
                lib.rect(f, x, y, 4, 3, c["T"])
                lib.rect(f, x, y, 4, 1, c["N"])
                lib.px(f, x, y, c["X"])
                lib.px(f, x + 3, y + 2, c["t"])
                lib.px(f, x + 1, y + 2, c["W"])
        frames.append(f)
    return frames


def telegraph(S):
    frames = []
    for i in range(4):
        f = canvas(S)
        r = S / 2 - 1
        ring = lib.ring_mask((S, S), S / 2, S / 2, r, r - (2 if S > 40 else 1), sy=1.0)
        d, ang = lib.polar((S, S), S / 2, S / 2)
        dashes = (((ang + i * 10) // 15).astype(int) % 2) == 0
        _paint(f, ring & dashes, "M")
        _paint(f, ring & ~dashes & (i % 2 == 0), "M")
        # croix centrale et remplissage tramé qui pulse
        fill = lib.ellipse_mask((S, S), S / 2, S / 2, r * (0.3 + 0.2 * i), r * (0.3 + 0.2 * i))
        _paint(f, fill & lib.checker((S, S)) & ~lib.ellipse_mask((S, S), S / 2, S / 2, r * (0.3 + 0.2 * i) - 1.2,
                                                                       r * (0.3 + 0.2 * i) - 1.2), "M")
        # quatre repères blancs qui tournent sur l'anneau (lecture « danger imminent »)
        for k in range(4):
            aa = math.radians(k * 90 + i * 22.5)
            x, y = S / 2 + math.cos(aa) * (r - 0.5), S / 2 + math.sin(aa) * (r - 0.5)
            lib.px(f, int(x), int(y), c["W"])
            lib.px(f, int(S / 2 + math.cos(aa) * (r - 1.6)), int(S / 2 + math.sin(aa) * (r - 1.6)), c["k"])
        lib.rect(f, S // 2 - 2, S // 2, 4, 1, c["W"])
        lib.rect(f, S // 2, S // 2 - 2, 1, 4, c["W"])
        frames.append(f)
    return frames


def reward(S=48):
    frames = []
    for i in range(8):
        f = canvas(S)
        t = i / 7
        if i < 4:
            m = star(S, 6 + i * 5, rays=8, inner=0.15, rot=i * 11)
            _paint(f, m, "a")
            _paint(f, star(S, 5 + i * 4, rays=8, inner=0.18, rot=i * 11), "y")
            _paint(f, star(S, 4 + i * 3, rays=4, inner=0.25), "Z")
            _paint(f, lib.ellipse_mask((S, S), S / 2, S / 2, 3 + i, 3 + i), "W")
        if 1 <= i <= 5:
            rr = 6 + i * 3.5
            _paint(f, lib.ring_mask((S, S), S / 2, S / 2, rr, rr - 1) & (lib.checker((S, S), i) | (i < 3)),
                   "Z" if i < 3 else "a")
        for k in range(8):
            aa = k * math.pi / 4 + 0.2
            d = 6 + t * 16
            x, y = int(S / 2 + math.cos(aa) * d), int(S / 2 + math.sin(aa) * d - math.sin(math.pi * t) * 6)
            if i >= 2:
                # grains de café
                lib.rect(f, x, y, 2, 3, c["h"])
                lib.px(f, x, y + 1, c["m"])
        frames.append(f)
    return frames


# --------------------------------------------------------------------------
# Coffre « machine à café de chantier » et pickups (avec contour)
# --------------------------------------------------------------------------

CHEST = parse(
    """
    ..bbbbbbbbbbbbbbbbb..
    .bwwbbbbbbbbbbbbbbgg.
    .gggggggggggggggggsd.
    .gsaaaaaaaaaaaaaasdd.
    .gsamhhmhhmhhmhhasdd.
    .gssssssssssssssssdd.
    .gssbbbssssssKxKLKdd.
    .gsbwwbbsssssssssdd.
    .gssbbbssssssssssssd.
    .gssssssssdddsssssdd.
    .gsssssssssbssssssdd.
    .gssssdKKKKbKKdssssd.
    .gssssdKhhhhhKdssssd.
    .gssssdKKKKKKKdssssd.
    .gsssssssssssssssssd.
    .ddddddddddddddddddd.
    ..dd.............dd..
    """
)


def chest_frame(steam=0, lid=0, glow=False, cup=False):
    f = canvas(32)
    body = CHEST.copy()
    if lid:
        # le couvercle (2 rangées du haut) se soulève et bascule
        top = body[:5].copy()
        body[:5] = 0
        blit(f, body, 5, 11)
        blit(f, top, 5, 11 - lid)
        if lid >= 3:
            lib.rect(f, 7, 15, 17, 1, c["a"])
    else:
        blit(f, body, 5, 11)
    if cup:
        # gobelet sur la grille
        g = parse(
            """
            qwwq
            .qq.
            """
        )
        blit(f, g, 13, 23)
    f = lib.outline(f)
    # vapeur (sans contour)
    for k in range(3):
        y = 9 - ((steam + k * 2) % 6)
        x = 21 + ((k + steam) % 2)
        if f[y, x] == 0:
            f[y, x] = c["q"] if k % 2 else c["w"]
    if glow:
        for (x, y) in ((8, 7), (24, 6), (16, 3), (12, 5), (20, 4)):
            f[y, x] = c["y"]
    return f


def chest_idle():
    return [chest_frame(steam=i) for i in range(6)]


def chest_open():
    out = []
    for i in range(8):
        lid = (0, 1, 3, 5, 6, 6, 6, 6)[i]
        out.append(chest_frame(steam=i, lid=lid, glow=i >= 3, cup=i >= 4))
    return out


GRAIN = parse(
    """
    .hh.
    hmzh
    hmeh
    hmzh
    .hh.
    """
)


def grain_spin():
    out = []
    for i in range(6):
        f = canvas(8)
        g = GRAIN.copy()
        if i in (1, 4):
            g = g[:, 1:3]
        elif i in (2, 5):
            g = parse(".h.\nhmh\nhmh\nhmh\n.h.")[:, 1:2]
        blit(f, g, 4 - g.shape[1] // 2, 1 + (1 if i in (2, 3) else 0))
        f = lib.outline(f)
        out.append(f)
    return out


CUP = parse(
    """
    .qqqqqq.
    qhhhhhhw
    qwwwwwwq
    .wqqqqw.
    .wxxxxw.
    .wxRRxw.
    .wqqqqw.
    ..wqqw..
    """
)


def cafe_idle():
    out = []
    for i in range(4):
        f = canvas(16)
        dy = (0, -1, -1, 0)[i]
        blit(f, CUP, 4, 6 + dy)
        f = lib.outline(f)
        for k in range(2):
            y = 4 + dy - ((i + k * 2) % 4)
            x = 6 + k * 3 + (i % 2)
            if 0 <= y and f[y, x] == 0:
                f[y, x] = c["w"]
        out.append(f)
    return out


TRACT = parse(
    """
    qqqqqqq
    qxxxxxq
    qqqqqqq
    qhhhhqq
    qqqqqqq
    qhhhqqq
    qqqqqqz
    """
)


def tract_idle():
    out = []
    for i in range(6):
        f = canvas(16)
        dy = (0, -1, -2, -2, -1, 0)[i]
        t = TRACT if i not in (2, 3) else lib.flipx(TRACT)
        blit(f, t, 4, 4 + dy)
        f = lib.outline(f)
        out.append(f)
    return out


TICKET_PICK = parse(
    """
    qqqqqqqqq
    qaaaaaaaq
    qqqqqqqqq
    qhqhhqhqz
    qqqqqqqzz
    """
)


def ticket_pick_idle():
    out = []
    for i in range(4):
        f = canvas(16)
        dy = (0, -1, -1, 0)[i]
        blit(f, TICKET_PICK, 3, 6 + dy)
        f = lib.outline(f)
        if i == 1:
            f[7 + dy, 4] = c["W"]
        out.append(f)
    return out


PS = parse(
    """
    ...xx...
    ..xyyx..
    .xxyyxx.
    xyyyyyyx
    .xyyyyx.
    .xyRRyx.
    xyR..Ryx
    xR....Rx
    """
)


def ps_idle():
    """Point de Syndicalisme : étoile rouge rebelle au cœur jaune, qui pulse."""
    out = []
    for i in range(6):
        f = canvas(16)
        dy = (0, -1, -2, -2, -1, 0)[i]
        star_ = PS.copy()
        if i in (2, 3):
            star_[star_ == c["y"]] = c["W"] if i == 2 else c["y"]
        blit(f, star_, 4, 4 + dy)
        f = lib.outline(f)
        out.append(f)
    return out


# --------------------------------------------------------------------------
# Ombres et lumières (images fixes)
# --------------------------------------------------------------------------

def shadow(w, h):
    a = canvas(w, h)
    _paint(a, lib.ellipse_mask((h, w), w / 2, h / 2, w / 2, h / 2), "K")
    return a


def light_round(S):
    a = canvas(S)
    for r, col in ((S / 2, "g"), (S * 0.36, "b"), (S * 0.22, "w"), (S * 0.1, "W")):
        _paint(a, lib.ellipse_mask((S, S), S / 2, S / 2, r, r), col)
    # tramage 50 % à la transition extérieure
    edge = lib.ellipse_mask((S, S), S / 2, S / 2, S / 2, S / 2) & ~lib.ellipse_mask((S, S), S / 2, S / 2, S * 0.43,
                                                                                    S * 0.43)
    a[edge & lib.checker((S, S))] = 0
    return a


def light_cone(S=64):
    a = canvas(S)
    d, ang = lib.polar((S, S), S / 2, 2)
    for r, col in ((S - 4, "g"), (S * 0.7, "b"), (S * 0.45, "w"), (S * 0.2, "W")):
        m = (d <= r) & (np.abs(ang - 90) <= 28)
        _paint(a, m, col)
    edge = (np.abs(ang - 90) > 22) & (a > 0)
    a[edge & lib.checker((S, S))] = 0
    return a


def _pickup_finish(frames, sparkle=None):
    """Pickups « modernes » : volume éclairé (sans rim), reflet clair d'1 px
    qui glisse le long de l'arête haut-gauche, étincelle à 4 branches sur une
    frame (objet interactif lisible, cf. guide §7.4-5)."""
    n = len(frames)
    out = []
    for i, f in enumerate(frames):
        f = modern.shade(f, rim=False)
        body = (f > 0) & (f != K)
        up = np.zeros_like(body)
        up[1:, :] = body[1:, :] & ~body[:-1, :]
        left = np.zeros_like(body)
        left[:, 1:] = body[:, 1:] & ~body[:, :-1]
        edge = np.argwhere(up | left)
        if len(edge):
            edge = edge[np.lexsort((edge[:, 0], edge[:, 1]))]
            y, x = edge[(i * len(edge)) // n]
            if not modern.EMIT[f[y, x]]:
                f[y, x] = c["W"]
        if sparkle is not None and i == sparkle % n:
            ys, xs = np.nonzero(f)
            if len(xs):
                sx, sy = min(f.shape[1] - 2, xs.max() + 1), max(1, ys.min())
                for (dx, dy, col) in ((0, 0, "W"), (1, 0, "Z"), (-1, 0, "Z"), (0, 1, "Z"), (0, -1, "Z")):
                    xx, yy = sx + dx, sy + dy
                    if 0 <= xx < f.shape[1] and 0 <= yy < f.shape[0] and f[yy, xx] == 0:
                        f[yy, xx] = c[col]
        out.append(f)
    return out


def build(emit):
    v = "sprites/vfx"
    emit(v, "vfx_slash-e_strip5", slash(0), 33)
    emit(v, "vfx_slash-se_strip5", slash(45), 33)
    emit(v, "vfx_slam_strip7", slam(), 40)
    emit(v, "vfx_hit_strip5", hit(32), 33)
    emit(v, "vfx_hit-big_strip6", hit(48, big=True), 40)
    emit(v, "vfx_dash_strip5", dash_puff(), 40)
    emit(v, "vfx_dust_strip5", dust(16), 60)
    emit(v, "vfx_dust-land_strip6", dust(32, 6, big=True), 60)
    emit(v, "vfx_sparks_strip4", sparks(), 40)
    emit(v, "vfx_particles_strip8", particles(), 100, notes="0 pixel, 1 étincelle, 2 braise, 3 verre, 4 ticket, "
                                                          "5 goutte de café, 6 fumée, 7 grain")
    emit(v, "proj-ticket_spin_strip4", ticket_spin(), 60, loop=True)
    emit(v, "proj-ticket_pop_strip4", ticket_pop(), 40)
    emit(v, "proj-amende_spin_strip4", amende_spin(), 60, loop=True)
    emit(v, "vfx_explosion_strip10", explosion(64, 10), 50)
    emit(v, "vfx_explosion-big_strip12", explosion(128, 12, seed=4), 60)
    emit(v, "vfx_shockwave_strip8", shockwave(), 40)
    emit(v, "vfx_charge_strip6", charge(), 60, loop=True)
    emit(v, "vfx_spawn-player_strip8", spawn_column(), 60)
    emit(v, "vfx_spawn-privatix_strip8", spawn_column(cols=("W", "N", "T", "u"), corporate=True), 60)
    emit(v, "vfx_poof_strip7", poof(), 50)
    emit(v, "vfx_telegraph-32_strip4", telegraph(32), 100, loop=True)
    emit(v, "vfx_telegraph-96_strip4", telegraph(96), 100, loop=True)
    emit(v, "vfx_reward_strip8", reward(), 50)
    p = "sprites/pickups"
    emit(p, "chest-cafe_idle_strip6", _pickup_finish(chest_idle(), sparkle=2), 150, loop=True)
    emit(p, "chest-cafe_open_strip8", _pickup_finish(chest_open()), 70, events={"vfx": {"3": "vfx_reward"}})
    emit(p, "pickup-grain_spin_strip6", _pickup_finish(grain_spin()), 80, loop=True)
    emit(p, "pickup-cafe_idle_strip4", _pickup_finish(cafe_idle(), sparkle=1), 150, loop=True)
    emit(p, "pickup-tract_idle_strip6", _pickup_finish(tract_idle(), sparkle=3), 100, loop=True)
    emit(p, "pickup-ticket_idle_strip4", _pickup_finish(ticket_pick_idle(), sparkle=2), 150, loop=True)
    emit(p, "pickup-ps_idle_strip6", _pickup_finish(ps_idle(), sparkle=2), 100, loop=True)


def build_images(emit_image):
    v = "sprites/vfx"
    for name, (w, h) in (("s", (16, 8)), ("m", (24, 8)), ("l", (48, 16)), ("xl", (80, 24))):
        emit_image(v, f"shadow_{name}", shadow(w, h), pivot=(w // 2, h // 2),
                   extra={"alpha": 0.5, "note": "opacité appliquée par le moteur"})
    t = "tilesets"
    emit_image(t, "light_round-64", light_round(64), extra={"blend": "ADD", "alpha": [0.3, 0.6]})
    emit_image(t, "light_round-128", light_round(128), extra={"blend": "ADD", "alpha": [0.3, 0.6]})
    emit_image(t, "light_cone-64", light_cone(64), extra={"blend": "ADD", "alpha": [0.3, 0.6]})
