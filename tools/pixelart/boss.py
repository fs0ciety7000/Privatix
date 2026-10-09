"""Boss 1 — « L'Auditeur des Quais » aux commandes de la Borne Totale 3000.

96×96, 1 direction (mécha symétrique face caméra), pivot (48, 88).
Châssis = borne géante (écran des départs, fente à tickets, livrée
turquoise), jambes-vérins, bras-barrières de portique rayés rouge/blanc,
l'Auditeur (lunettes, sifflet, chronomètre) dans l'écoutille du dessus.
"""
import math

import numpy as np

import lib
from font3x5 import draw_text, text_mask
from humanoid import dissolve, flash_white
from lib import canvas, blit, parse
from palette import CHAR, K

c = CHAR
S = 96
FOOT = 86

PILOT_HEAD = parse(
    """
    ....dddddd....
    ..ddsssddddd..
    .dssbsddddddd.
    .dsbppppppppd.
    ddppqpppppppzd
    dpKKKKppKKKKzd
    dpKNNKzzKNNKzd
    dppKKzppzKKpzd
    .zppppmmppppz.
    .zppbwwwwbpz..
    ..zpppbbppz...
    ...zzzzzzz....
    """
)
PILOT_HEAD_P2 = PILOT_HEAD.copy()
PILOT_HEAD_P2[6, 3:5] = c["M"]
PILOT_HEAD_P2[6, 9:11] = c["M"]

PILOT_TORSO = parse(
    """
    ....iiiwwTTwwiii....
    ..IiiiiwwTTwwiiiin..
    .Iiiiiiiwbbwiiiiinn.
    Iiiiiiiwbwwbwiiiiinn
    IiiiiiiwbwKbwiiiiinn
    IiiiiiiwbKwbwiiiinnn
    IIiiiiiwwbbwwiiiinnn
    IIiiiiiiwTTwiiiiinnn
    IIiiiiiiwTTwiiiinnnn
    """
)


def _boom(length=30, tip="T"):
    shapes = []
    seg = 4
    for i, u in enumerate(range(2, length, seg)):
        col = (c["W"], c["w"], c["b"]) if i % 2 == 0 else (c["x"], c["x"], c["R"])
        shapes.append((u, min(u + seg, length), -2, 2, col))
    shapes.append((0, 2, -2, 2, (c["b"], c["s"], c["d"])))
    shapes.append((length, length + 3, -2, 2, (c["N"], c[tip], c["u"])))
    return shapes


def frame(P):
    """Paramètres : bx, by (châssis), lf, rf (levée des pieds), la, ra (angles
    des bras-barrières), screen (texte), scr_col, slot ('K'|'M'|'W'), p2,
    pilot_dy, pilot_arm ('levers'|'chrono'|'point'), tip ('T'|'M'),
    open_hatch (0..1 : sortie du pilote), legs_ext (allongement des vérins)."""
    a = canvas(S)
    bx, by = P.get("bx", 0), P.get("by", 0)
    lf, rf = P.get("lf", 0), P.get("rf", 0)
    p2 = P.get("p2", False)
    ext = P.get("legs_ext", 0)

    # ------------------------------------------------ jambes (vérins) et pieds
    legs = canvas(S)
    for side, (hip_x, lift) in enumerate(((34, lf), (62, rf))):
        hx, hy = hip_x + bx, 62 + by
        fy = FOOT - lift
        fx = hip_x + (-2 if side == 0 else 2)
        # pied
        foot = canvas(S)
        lib.rect(foot, fx - 9, fy - 5, 18, 6, c["d"])
        lib.rect(foot, fx - 9, fy - 5, 18, 2, c["s"])
        lib.rect(foot, fx - 9, fy - 5, 18, 1, c["g"])
        lib.rect(foot, fx - 9, fy, 18, 1, c["K"])
        for k in range(3):
            lib.rect(foot, fx - 7 + k * 6, fy - 2, 3, 1, c["T"] if k == 1 else c["n"])
        # tige (chrome) du pied au cylindre
        knee_y = hy + 10
        lib.rect(legs, fx - 2, knee_y, 4, max(1, fy - 5 - knee_y), c["b"])
        lib.rect(legs, fx - 2, knee_y, 1, max(1, fy - 5 - knee_y), c["w"])
        lib.rect(legs, fx + 1, knee_y, 1, max(1, fy - 5 - knee_y), c["g"])
        # cylindre
        lib.rect(legs, hx - 5, hy - 2, 10, knee_y - hy + 4 + ext, c["s"])
        lib.rect(legs, hx - 5, hy - 2, 2, knee_y - hy + 4 + ext, c["g"])
        lib.rect(legs, hx + 3, hy - 2, 2, knee_y - hy + 4 + ext, c["d"])
        lib.rect(legs, hx - 5, knee_y + 1 + ext, 10, 1, c["d"])
        lib.rect(legs, hx - 1, hy + 2, 2, 2, c["T"] if not p2 else c["x"])
        blit(legs, foot, 0, 0)
    blit(a, legs, 0, 0)

    # ------------------------------------------------ pilote
    pilot = canvas(S)
    pdy = P.get("pilot_dy", 0)
    px0, py0 = 38 + bx, 12 + by + pdy
    torso_y = py0 + 11
    blit(pilot, PILOT_TORSO, px0, torso_y)
    arm = P.get("pilot_arm", "levers")
    if arm == "chrono":
        # bras levé tenant le chronomètre
        lib.thick_line(pilot, px0 + 18, torso_y + 2, px0 + 23, torso_y - 6, c["i"], 3)
        ch = canvas(9, 9)
        lib.ellipse(ch, 4.5, 4.5, 4.5, 4.5, c["b"])
        lib.ellipse(ch, 4.5, 4.5, 3.5, 3.5, c["w"])
        lib.line(ch, 4, 4, 4, 1, c["K"])
        lib.line(ch, 4, 4, 6, 5, c["M"] if p2 else c["K"])
        lib.rect(ch, 4, 0, 1, 1, c["s"])
        blit(pilot, ch, px0 + 20, torso_y - 14)
    elif arm == "point":
        lib.thick_line(pilot, px0 + 1, torso_y + 2, px0 - 6, torso_y - 4, c["i"], 3)
        lib.rect(pilot, px0 - 8, torso_y - 7, 3, 3, c["p"])
    head = PILOT_HEAD_P2 if p2 else PILOT_HEAD
    blit(pilot, head, px0 + 3, py0)
    # le pilote est rentré dans l'écoutille : on coupe sous le rebord
    hatch_y = 34 + by
    pilot[hatch_y:, :] = 0
    blit(a, pilot, 0, 0)

    # ------------------------------------------------ châssis
    x0, y0, w = 22 + bx, 30 + by, 52
    ch = canvas(S)
    # dessus
    lib.rect(ch, x0 + 2, y0, w - 4, 1, c["b"])
    lib.rect(ch, x0 + 1, y0 + 1, w - 2, 5, c["b"])
    lib.rect(ch, x0 + 2, y0 + 1, 10, 1, c["w"])
    lib.rect(ch, x0 + 1, y0 + 2, 3, 2, c["w"])
    lib.rect(ch, x0 + w - 8, y0 + 1, 7, 5, c["g"])
    # écoutille (trou sombre derrière le pilote)
    hole = lib.ellipse_mask(ch.shape, 48 + bx, y0 + 3.5, 13, 3.2)
    ch[hole & (ch > 0)] = c["K"]
    # façade
    lib.rect(ch, x0, y0 + 6, w, 28, c["s"])
    lib.rect(ch, x0, y0 + 6, 2, 28, c["g"])
    lib.rect(ch, x0 + w - 2, y0 + 6, 2, 28, c["d"])
    lib.rect(ch, x0, y0 + 32, w, 2, c["d"])
    lib.rect(ch, x0, y0 + 6, w, 1, c["g"])
    # livrée turquoise
    if not p2:
        lib.rect(ch, x0 + 2, y0 + 7, w - 4, 2, c["T"])
        lib.rect(ch, x0 + 2, y0 + 7, 8, 1, c["N"])
        lib.rect(ch, x0 + 2, y0 + 29, w - 4, 2, c["T"])
        lib.rect(ch, x0 + w - 6, y0 + 29, 4, 2, c["u"])
    else:
        # blindage arraché : câbles et châssis à nu
        lib.rect(ch, x0 + 2, y0 + 7, w - 4, 2, c["d"])
        for k in range(0, w - 4, 3):
            lib.px(ch, x0 + 2 + k, y0 + 7 + (k // 3) % 2, c["x"] if k % 2 else c["T"])
        lib.rect(ch, x0 + 2, y0 + 29, w - 4, 2, c["u"])
        for k in range(5, w - 6, 9):
            lib.line(ch, x0 + k, y0 + 24, x0 + k + 2, y0 + 31, c["x"])
    # rivets
    for (rx, ry) in ((x0 + 3, y0 + 11), (x0 + w - 4, y0 + 11), (x0 + 3, y0 + 26), (x0 + w - 4, y0 + 26)):
        lib.px(ch, rx, ry, c["b"])
    # écran des départs
    sx, sy, sw, sh = x0 + 8, y0 + 11, 36, 12
    lib.rect(ch, sx - 1, sy - 1, sw + 2, sh + 2, c["K"])
    scr = canvas(sw, sh)
    scr[:] = c["n"] if not p2 else c["R"]
    txt = P.get("screen", "7:12")
    col = c[P.get("scr_col", "N" if not p2 else "M")]
    if txt:
        m = text_mask(txt)
        tw = m.shape[1]
        if txt.startswith("~"):  # bandeau défilant
            m = text_mask(txt[1:])
            off = P.get("scroll", 0)
            tw = m.shape[1]
            for x in range(sw - 2):
                col_idx = (x + off) % (tw + 6)
                if col_idx < tw:
                    scr[2:7, 1 + x][m[:, col_idx]] = col
        else:
            draw_text(scr, txt, (sw - tw) // 2, 2 if not P.get("line2") else 1, col)
        if P.get("line2"):
            m2 = text_mask(P["line2"])
            draw_text(scr, P["line2"], (sw - m2.shape[1]) // 2, 7, col)
    if not P.get("line2"):
        for k in range(1, sw - 1, 2):
            scr[9, k] = c["u"] if not p2 else c["x"]
    if P.get("screen_crack"):
        for (xx, yy) in ((20, 0), (21, 1), (21, 2), (22, 3), (23, 4), (19, 3), (18, 4), (24, 2)):
            scr[yy, xx] = c["W"]
    blit(ch, scr, sx, sy)
    # reflet de l'écran
    lib.px(ch, sx, sy, c["v"] if not p2 else c["M"])
    # fente à tickets
    slot = P.get("slot", "K")
    lib.rect(ch, x0 + 14, y0 + 26, 24, 2, c[slot])
    lib.rect(ch, x0 + 14, y0 + 25, 24, 1, c["d"])
    # grilles latérales
    for k in range(3):
        lib.rect(ch, x0 + 3, y0 + 14 + k * 3, 3, 1, c["d"])
        lib.rect(ch, x0 + w - 6, y0 + 14 + k * 3, 3, 1, c["K"])
    blit(a, ch, 0, 0)
    # rebord avant de l'écoutille par-dessus le pilote
    lip = canvas(S)
    lib.rect(lip, 36 + bx, y0 + 5, 24, 1, c["g"])
    blit(a, lip, 0, 0)

    # ------------------------------------------------ épaules et bras-barrières
    tip = P.get("tip", "T")
    for side, ang in ((0, P.get("la", 112.5)), (1, P.get("ra", 67.5))):
        shx = (x0 - 2) if side == 0 else (x0 + w + 1)
        shy = y0 + 13
        boom = canvas(S)
        lib.draw_rotated(boom, shx + 0.5, shy + 0.5, ang, _boom(28, tip))
        blit(a, boom, 0, 0, edge=K)
        j = canvas(S)
        lib.ellipse(j, shx + 0.5, shy + 0.5, 5, 5, c["s"])
        lib.ellipse(j, shx - 0.5, shy - 0.5, 3, 3, c["g"])
        lib.ellipse(j, shx + 0.5, shy + 0.5, 1.5, 1.5, c["T"] if not p2 else c["M"])
        blit(a, j, 0, 0, edge=K)

    a = lib.outline(a)
    for ov in P.get("overlays", []):
        ov(a)
    if P.get("flash"):
        a = flash_white(a)
    return a


# --------------------------------------------------------------------------
# Superpositions (VFX intégrés au sprite, sans contour)
# --------------------------------------------------------------------------

def sparks(seed, n=6, cx=48, cy=48, r=26, cols=("y", "W")):
    def ov(a):
        g = lib.rng(seed)
        for i in range(n):
            ang = g.random() * 2 * math.pi
            d = g.random() * r
            x, y = int(cx + math.cos(ang) * d), int(cy + math.sin(ang) * d * 0.7)
            for k in range(2):
                lib.px(a, x + k, y - k, c[cols[k % 2]])
    return ov


def puffs(seed, n=4, cy=80, spread=30, size=2, cols=("b", "g")):
    def ov(a):
        g = lib.rng(seed)
        for i in range(n):
            x = int(48 + (g.random() - 0.5) * 2 * spread)
            y = int(cy + (g.random() - 0.5) * 4)
            m = lib.ellipse_mask(a.shape, x, y, size + 1, size)
            a[m & (a == 0)] = c[cols[i % 2]]
    return ov


def blasts(seed, n=3, cols=("W", "y", "M")):
    def ov(a):
        g = lib.rng(seed)
        for i in range(n):
            x, y = int(24 + g.random() * 48), int(20 + g.random() * 50)
            r = 2 + g.random() * 4
            for rr, col in ((r, cols[2]), (r * 0.66, cols[1]), (r * 0.33, cols[0])):
                m = lib.ellipse_mask(a.shape, x, y, rr, rr)
                a[m] = c[col]
    return ov


def tickets_out(t, cols=("w", "M")):
    def ov(a):
        for i, (dx, dy) in enumerate(((-10, 0), (0, 2), (10, 0))):
            x = 48 + dx + int(dx * t * 0.6)
            y = 58 + dy + int(t * 4)
            lib.rect(a, x - 2, y, 5, 3, c[cols[0]])
            lib.rect(a, x - 2, y + 2, 5, 1, c[cols[1]])
            lib.px(a, x - 2, y, c["W"])
    return ov


def smear_arc(cx, cy, a0, a1, r_out, r_in):
    def ov(a):
        d, ang = lib.polar(a.shape, cx, cy)
        m = lib.angle_in(ang, a0, a1) & (d <= r_out) & (d > r_in) & (a == 0)
        outer = m & (d > r_out - 2)
        a[m] = c["M"]
        a[outer] = c["W"]
    return ov


# --------------------------------------------------------------------------
# Animations
# --------------------------------------------------------------------------

def idle(p2=False):
    out = []
    for i in range(6):
        b = (0, 0, 1, 1, 1, 0)[i]
        out.append(frame({"by": b, "screen": "~CONTROLE EN COURS" if not p2 else "!! 7:12 !!",
                          "scroll": i * 4, "p2": p2, "pilot_dy": (0, 0, 0, 1, 1, 0)[i],
                          "la": 112.5 - (5.625 if b else 0), "ra": 67.5 + (5.625 if b else 0),
                          "tip": "T" if i % 3 else "N"}))
    return out


def move(p2=False):
    out = []
    # (by, lf, rf, bx)
    seq = [(1, 0, 0, 0), (0, 4, 0, 1), (-1, 6, 0, 1), (0, 3, 0, 1), (1, 0, 0, 0), (0, 0, 4, -1), (-1, 0, 6, -1),
           (0, 0, 3, -1)]
    for i, (by, lf, rf, bx) in enumerate(seq):
        P = {"by": by, "lf": lf, "rf": rf, "bx": bx, "p2": p2, "screen": "~CONTROLE EN COURS" if not p2 else "!!!",
             "scroll": i * 3, "la": 112.5 + (11.25 if lf else 0), "ra": 67.5 - (11.25 if rf else 0)}
        if i in (0, 4):
            P["overlays"] = [puffs(i, 3, cy=85, spread=26, size=1)]
        out.append(frame(P))
    return out


def attack_sweep():
    out = []
    keys = [  # (la, ra, by, tip, pilot_arm)
        (112.5, 67.5, 0, "T"), (157.5, 22.5, -1, "M"), (202.5, -22.5, -2, "M"), (225, -45, -2, "M"),
        (225, -45, -3, "M"), (45, 135, 2, "M"), (22.5, 157.5, 2, "M"), (22.5, 157.5, 1, "M"),
        (45, 135, 1, "T"), (67.5, 112.5, 0, "T"), (90, 90, 0, "T"), (112.5, 67.5, 0, "T"),
    ]
    for i, (la, ra, by, tip) in enumerate(keys):
        P = {"la": la, "ra": ra, "by": by, "tip": tip, "screen": "BARRIERE" if i < 5 else "STOP",
             "scr_col": "M" if 1 <= i <= 6 else "N", "pilot_arm": "point" if 1 <= i <= 4 else "levers"}
        if i == 5:
            P["overlays"] = [smear_arc(19, 43 + by, 45, 225, 32, 24), smear_arc(77, 43 + by, -45, 135, 32, 24)]
        if i == 6:
            P["overlays"] = [smear_arc(19, 43 + by, 22.5, 60, 32, 26), smear_arc(77, 43 + by, 120, 157.5, 32, 26)]
        out.append(frame(P))
    return out


def attack_barrage():
    out = []
    for i in range(8):
        fire = i in (2, 6)
        P = {"slot": "M" if i % 4 in (1, 2) else ("W" if fire else "R"), "screen": "TICKETS", "scr_col": "M",
             "by": 1 if fire else 0, "la": 112.5, "ra": 67.5, "tip": "M"}
        if fire:
            P["overlays"] = [tickets_out(0)]
        elif i in (3, 7):
            P["overlays"] = [tickets_out(2)]
        out.append(frame(P))
    return out


def attack_stamp():
    out = []
    # 0-1 accroupi, 2-7 saut (le mécha sort par le haut du cadre), 8 impact
    seq = [
        {"by": 3, "legs_ext": -2, "screen": "CONTROLE", "scr_col": "M", "la": 135, "ra": 45},
        {"by": 5, "legs_ext": -3, "screen": "CONTROLE", "scr_col": "M", "la": 146.25, "ra": 33.75},
        {"by": -6, "lf": 6, "rf": 6, "screen": "CONTROLE", "scr_col": "M", "la": 90, "ra": 90},
        {"by": -10, "lf": 18, "rf": 18, "screen": "!", "scr_col": "M", "la": 67.5, "ra": 112.5},
        {"by": -11, "lf": 22, "rf": 22, "screen": "!", "scr_col": "M", "la": 67.5, "ra": 112.5},
        {"by": -11, "lf": 24, "rf": 24, "screen": "!", "scr_col": "M", "la": 56.25, "ra": 123.75},
        {"by": -11, "lf": 22, "rf": 22, "screen": "!", "scr_col": "M", "la": 45, "ra": 135},
        {"by": -6, "lf": 10, "rf": 10, "screen": "!", "scr_col": "M", "la": 33.75, "ra": 146.25},
        {"by": 5, "legs_ext": -3, "screen": "CONTROLE", "scr_col": "W", "la": 22.5, "ra": 157.5,
         "overlays": [puffs(80, 8, cy=84, spread=40, size=3), sparks(81, 6, cy=84, r=40)]},
        {"by": 4, "legs_ext": -2, "screen": "CONTROLE", "scr_col": "M", "la": 33.75, "ra": 146.25,
         "overlays": [puffs(82, 6, cy=83, spread=44, size=2)]},
        {"by": 2, "screen": "CONTROLE", "la": 56.25, "ra": 123.75, "overlays": [puffs(83, 4, cy=82, spread=46)]},
        {"by": 1, "screen": "7:12", "la": 90, "ra": 90},
        {"by": 0, "screen": "7:12", "la": 101.25, "ra": 78.75},
        {"by": 0, "screen": "7:12", "la": 112.5, "ra": 67.5},
    ]
    for k in seq:
        k.setdefault("tip", "M")
        out.append(frame(k))
    return out


def intro():
    out = []
    for i in range(14):
        P = {"la": 112.5, "ra": 67.5}
        if i < 4:
            P.update({"screen": "", "pilot_dy": 14, "tip": "u" if i < 2 else "T", "by": 1})
            if i >= 2:
                P["screen"] = "." * (i - 1)
        elif i < 8:
            P.update({"screen": "PRIVATIX", "pilot_dy": 14 - (i - 3) * 4 if i < 7 else 0})
        elif i < 11:
            P.update({"screen": "4:12", "pilot_arm": "chrono", "scr_col": "N" if i % 2 else "W"})
        else:
            P.update({"screen": "CONTROLE", "la": 112.5 - (i - 10) * 22.5, "ra": 67.5 + (i - 10) * 22.5,
                      "tip": "M" if i == 12 else "T", "by": -1 if i == 12 else 0})
        out.append(frame(P))
    return out


def phase():
    out = []
    for i in range(12):
        p2 = i >= 5
        P = {"p2": p2, "screen": "ERREUR" if i < 8 else "!! 7:12 !!", "scr_col": "M" if i % 2 else "W",
             "bx": (1 if i % 2 else -1) if 2 <= i <= 8 else 0, "by": 1 if i in (4, 5) else 0,
             "la": 112.5 + (22.5 if i in (5, 6) else 0), "ra": 67.5 - (22.5 if i in (5, 6) else 0),
             "screen_crack": i >= 3}
        ovs = []
        if 2 <= i <= 9:
            ovs.append(sparks(100 + i, 8, cy=44, r=30))
        if i in (5, 6, 7):
            # plaques de blindage qui volent
            def plates(a, t=i):
                for k, (x, y) in enumerate(((20, 30), (70, 28), (30, 18), (64, 20))):
                    xx = x + (k % 2 * 2 - 1) * (t - 4) * 4
                    yy = y - (t - 4) * 5 + (t - 4) ** 2
                    m = canvas(S)
                    lib.rect(m, xx, yy, 8, 4, c["s"])
                    lib.rect(m, xx, yy, 8, 1, c["b"])
                    lib.rect(m, xx, yy + 1, 8, 1, c["T"])
                    m = lib.outline(m)
                    blit(a, m, 0, 0)
            ovs.append(plates)
        if i == 5:
            ovs.append(blasts(110, 3))
        P["overlays"] = ovs
        out.append(frame(P))
    return out


def hurt():
    return [frame({"flash": True, "screen": "7:12", "by": 1}), frame({"screen": "7:12", "bx": 1, "screen_crack": True})]


def death():
    out = []
    for i in range(20):
        P = {"p2": True, "screen": "7:12", "scr_col": "W" if i % 2 else "M", "screen_crack": True}
        if i < 8:
            P.update({"bx": (1 if i % 2 else -1), "la": 112.5 + i * 4, "ra": 67.5 - i * 4,
                      "overlays": [sparks(200 + i, 8, r=34), blasts(220 + i, 1 + i % 3)]})
        elif i < 14:
            k = i - 8
            P.update({"by": min(16, k * 3), "legs_ext": -min(10, k * 2), "la": 135 + k * 4, "ra": 45 - k * 4,
                      "pilot_dy": min(6, k), "overlays": [blasts(240 + i, 2), puffs(260 + i, 4, cy=60 - k, spread=24, size=3,
                                                                                   cols=("g", "s"))]})
        else:
            k = i - 14
            P.update({"by": 18, "legs_ext": -10, "la": 135, "ra": 45, "pilot_dy": 7, "screen": "7:12",
                      "scr_col": "N", "tip": "u",
                      "overlays": [puffs(300 + i, 5 - k // 2, cy=46 - k * 3, spread=20, size=2 + k // 2,
                                         cols=("b", "g"))] if k < 5 else []})
        f = frame(P)
        if i >= 17:
            f[f == c["T"]] = c["u"]
        out.append(f)
    return out


PIVOT = (48, 88)


def build(emit):
    e = lambda name, frames, dur, **k: emit("bosses", name, frames, dur, pivot=PIVOT, **k)  # noqa: E731
    e("auditeur_intro_strip14", intro(), 100)
    e("auditeur_idle_strip6", idle(), 120, loop=True)
    e("auditeur_move_strip8", move(), 90, loop=True, events={"shake": [0, 4]})
    e("auditeur_attack-sweep_strip12", attack_sweep(), [100] * 5 + [40, 40] + [100] * 5, active=[5, 6],
      events={"telegraph": [1, 2, 3, 4]})
    e("auditeur_attack-barrage_strip8", attack_barrage(), 80, loop=True, active=[2, 6],
      events={"shoot": [2, 6], "projectile": "proj-ticket"})
    e("auditeur_attack-stamp_strip14", attack_stamp(), [100] * 8 + [40, 60] + [100] * 4, active=[8],
      events={"telegraph": "vfx_telegraph-96", "vfx": {"8": "vfx_dust-land"}})
    e("auditeur_phase_strip12", phase(), 100)
    e("auditeur_idle-p2_strip6", idle(True), 100, loop=True)
    e("auditeur_move-p2_strip8", move(True), 75, loop=True, events={"shake": [0, 4]})
    e("auditeur_hurt_strip2", hurt(), 80)
    e("auditeur_death_strip20", death(), 100, events={"vfx": {"19": "vfx_explosion-big"}})
