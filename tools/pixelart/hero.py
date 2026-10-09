"""Le héros : cheminot en 3x8, casque blanc, gilet orange haute visibilité à
bandes réfléchissantes, lourde clé à tire-fond.

Frame 48×48, pivot (24, 44) : les semelles sont sur la ligne 42, le contour sur
la ligne 43. Les pièces (tête, torse, jambes de profil) sont des matrices de
caractères dessinées à la main ; bras et clé sont posés par un mini-squelette
(épaule -> main, main + angle) puis tout est contouré en #14101A.
"""
import numpy as np

import lib
from lib import parse, blit, canvas
from palette import CHAR, K

S = 48
CX = 24  # axe de symétrie entre les colonnes 23 et 24
FOOT = 42  # dernière ligne colorée des semelles

c = CHAR

# --------------------------------------------------------------------------
# Têtes (casque de chantier blanc, moustache)
# --------------------------------------------------------------------------
HEAD = {
    "down": parse(
        """
        ....wwww....
        ..wWWwwwwb..
        .wWwwwwwwbb.
        .wwwwwwwwbb.
        .bwwwwwwbbs.
        bbbbbbbbbsss
        .zhzzzzzzhz.
        .hpKppppKpz.
        .zpphhhhppz.
        ..zppmmppz..
        """
    ),
    "up": parse(
        """
        ....wwww....
        ..wWWwwwwb..
        .wWwwwwwwbb.
        .wwwwwwwwbb.
        .bwwwwwwbbs.
        bbbbbbbbbsss
        .hhhhhhhhhh.
        .mhhhhhhhhh.
        ..zpppppzz..
        ..zzzzzzzz..
        """
    ),
    "side": parse(
        """
        ...wwwww....
        .wWWwwwwwb..
        .WwwwwwwwbbK
        wwwwwwwwwbb.
        bwwwwwwwbbs.
        sbbbbbbbbbbb
        .hhmzzzzz...
        .hmzzpKpp...
        .hhzpphhhp..
        ..hzppppz...
        """
    ),
}
# casque : petite visière avant sur le profil (le K de la ligne 2 est un
# rivet de jugulaire). On la retire, elle crée un pixel parasite.
HEAD["side"][2, 11] = 0

HEAD_HURT = {
    "down": parse(
        """
        ....wwww....
        ..wWWwwwwb..
        .wWwwwwwwbb.
        .wwwwwwwwbb.
        .bwwwwwwbbs.
        bbbbbbbbbsss
        .zhzzzzzzhz.
        .hpKKppKKpz.
        .zpphKKhppz.
        ..zppmmppz..
        """
    ),
    "side": parse(
        """
        ...wwwww....
        .wWWwwwwwb..
        .Wwwwwwwwbb.
        wwwwwwwwwbb.
        bwwwwwwwbbs.
        sbbbbbbbbbbb
        .hhmzzzzz...
        .hmzzpKKp...
        .hhzppKhhp..
        ..hzppppz...
        """
    ),
}
HEAD_HURT["up"] = HEAD["up"]

HEAD_CLOSED = parse(
    """
    ....wwww....
    ..wWWwwwwb..
    .wWwwwwwwbb.
    .wwwwwwwwbb.
    .bwwwwwwbbs.
    bbbbbbbbbsss
    .zhzzzzzzhz.
    .hpzKppKzpz.
    .zpphhhhppz.
    ..zppmmppz..
    """
)

# --------------------------------------------------------------------------
# Torses (gilet orange, bretelles et bande réfléchissantes)
# --------------------------------------------------------------------------
TORSO = {
    "down": parse(
        """
        .oOOiiOOo.
        aOOOiiOOOo
        aOwOiiOwOo
        aOwOOoOwoo
        OOwOOoOwoo
        WwwwwwwwbK
        bbbbbbbbss
        OOOOOoOooo
        oooooooooo
        """
    ),
    "up": parse(
        """
        .oOOOOOOo.
        aOOOOOOOOo
        aOwOOOOwoo
        aOOwOOwOoo
        OOOOwwOOoo
        WwwwwwwwbK
        bbbbbbbbss
        OOOOOOOooo
        oooooooooo
        """
    ),
    "side": parse(
        """
        .oOOOOo.
        aOOOOOOi
        aOwOOOoi
        aOwOOOoi
        OOwOOOoi
        Wwwwwwbb
        bbbbbbss
        OOOOOooo
        oooooooo
        """
    ),
}
for k in TORSO:
    TORSO[k][TORSO[k] == c["K"]] = c["b"]

# --------------------------------------------------------------------------
# Jambes de profil : poses d'une jambe (P pantalon, Q ombre, B botte, S semelle)
# --------------------------------------------------------------------------
LEG_CMAP = {".": 0, " ": 0, "P": 1, "Q": 2, "B": 3, "S": 4}
NEAR = {1: c["i"], 2: c["d"], 3: c["h"], 4: c["e"]}
FAR = {1: c["d"], 2: c["n"], 3: c["e"], 4: c["K"]}

# (matrice, colonne de la hanche) ; la ligne 0 est sous la hanche (y = 37)
SIDE_LEG = {
    "stand": (
        """
        PPQ.
        PPQ.
        PPQ.
        PPQ.
        BBBB
        SSSS
        """,
        0,
    ),
    "fwd": (
        """
        PPQ...
        .PPQ..
        .PPQ..
        ..PPQ.
        ..BBBB
        ..SSSS
        """,
        0,
    ),
    "fwd2": (
        """
        PPQ..
        PPQ..
        .PPQ.
        .PPQ.
        .BBBB
        .SSSS
        """,
        0,
    ),
    "back": (
        """
        ..PPQ
        ..PPQ
        .PPQ.
        PPQ..
        BBB..
        SS...
        """,
        2,
    ),
    "liftback": (
        """
        ..PPQ
        ..PPQ
        .PPQQ
        BBQ..
        SS...
        """,
        2,
    ),
    "pass": (
        """
        PPQ..
        PPPQ.
        .PPQ.
        .BBBB
        .SSSS
        """,
        0,
    ),
    "fwdair": (
        """
        PPQ...
        .PPQ..
        ..PPQ.
        ..BBBB
        ..SSSS
        """,
        0,
    ),
    "kneel": (
        """
        PPPPQ.
        ..PPQ.
        ..PPQ.
        ..BBBB
        ..SSSS
        """,
        0,
    ),
}
SIDE_LEG = {k: (parse(v, LEG_CMAP), ax) for k, (v, ax) in SIDE_LEG.items()}


def _leg_colored(name, near):
    m, ax = SIDE_LEG[name]
    out = np.zeros_like(m)
    for s, d in (NEAR if near else FAR).items():
        out[m == s] = d
    return out, ax


# --------------------------------------------------------------------------
# La clé à tire-fond (repère local : u le long du manche depuis la main)
# --------------------------------------------------------------------------
STEEL = (c["b"], c["s"], c["d"])
DARK = (c["s"], c["d"], c["K"])
GRIP = (c["a"], c["O"], c["o"])


def wrench_shapes(length=13):
    # la clé se tient par le manche : douille au pommeau, grande poignée en T
    # au bout (silhouette de masse, lisible de loin)
    return [
        (-3, -1, -1, 1, DARK),  # douille (pommeau)
        (-1, 2, -1, 1, GRIP),  # ruban de prise orange
        (2, length - 1, -1, 1, STEEL),  # manche
        (length - 2, length + 1, -4, 4, STEEL),  # barre du T
        (length - 2, length + 1, -1, 1, DARK),  # moyeu
    ]


def draw_wrench(a, gx, gy, angle, length=13):
    w = canvas(a.shape[1], a.shape[0])
    lib.draw_rotated(w, gx, gy, angle, wrench_shapes(length))
    # reflet spéculaire sur la douille
    import math

    th = math.radians(angle)
    hx = gx + (length - 0.5) * math.cos(th) + 3.0 * math.sin(th)
    hy = gy + (length - 0.5) * math.sin(th) - 3.0 * math.cos(th)
    if w[int(hy), int(hx)] if 0 <= int(hy) < S and 0 <= int(hx) < S else False:
        lib.px(w, int(hx), int(hy), c["W"])
    return w


def smear(a, cx, cy, a0, a1, r_in, r_out, cols=("W", "a", "O")):
    """Traînée de mouvement de la clé : arc plein, bord extérieur blanc."""
    d, ang = lib.polar(a.shape, cx, cy)
    m = lib.angle_in(ang, a0, a1) & (d <= r_out) & (d > r_in)
    out = canvas(a.shape[1], a.shape[0])
    outer = m & (d > r_out - 1.6)
    mid = m & (d > r_out - 3.2) & ~outer
    inner = m & ~outer & ~mid
    out[outer] = c[cols[0]]
    out[mid] = c[cols[1]]
    out[inner] = c[cols[2]]
    return out


# --------------------------------------------------------------------------
# Bras
# --------------------------------------------------------------------------


def draw_arm(a, sx, sy, hx, hy, far=False, edge=None):
    """Manche bleu (2 px) de l'épaule à la main + main 2×2."""
    arm = canvas(S)
    col = c["d"] if far else c["i"]
    lib.thick_line(arm, sx, sy, hx, hy, col, 2)
    # ombre sous le bras
    hand = c["z"] if far else c["p"]
    lib.rect(arm, hx, hy, 2, 2, hand)
    lib.px(arm, hx + 1, hy + 1, c["z"] if not far else c["m"])
    blit(a, arm, 0, 0, edge=edge)


# --------------------------------------------------------------------------
# Assemblage d'une frame
# --------------------------------------------------------------------------


def frame(view, P):
    """view : 'down' | 'up' | 'side'. P : dictionnaire de pose.

    Clés : bob (décalage vertical du haut du corps), lean (dx du haut du corps),
    head (dx, dy) relatif, legs, hands = ((x, y) main clé, (x, y) autre main),
    wrench = (angle) ou None, wlayer 'front'|'back', smear = (a0, a1),
    face 'normal'|'hurt'|'closed', squash (int : tête enfoncée).
    """
    a = canvas(S)
    bob = P.get("bob", 0)
    lean = P.get("lean", 0)
    hdx, hdy = P.get("head", (0, 0))
    squash = P.get("squash", 0)
    face = P.get("face", "normal")

    top = 17 + bob  # haut du casque
    torso_y = 27 + bob
    head_y = top + hdy + squash
    torso_x = (19 if view != "side" else 20) + lean

    # ---------------- jambes
    legs_layer = canvas(S)
    if view in ("down", "up"):
        lf, rf = P.get("feet", (FOOT, FOOT))
        hip = 36 + P.get("hip", bob)
        lx = P.get("legs_x", (0, 0))
        _legs_front(legs_layer, hip, lf, rf, view, lx)
    else:
        la, lb, hip_dy = P.get("side_legs", ("stand", "stand", 0))
        hip = 37 + hip_dy
        swap = P.get("swap", False)
        hip_x = 22 + P.get("hip_x", 0)
        order = [(lb, not swap), (la, swap)] if not swap else [(la, False), (lb, True)]
        # la jambe A est proche (claire) sauf si swap
        for name, is_near in ([(lb, False), (la, True)] if not swap else [(la, False), (lb, True)]):
            m, ax = _leg_colored(name, is_near)
            dx = 0 if is_near else P.get("far_dx", -1)
            blit(legs_layer, m, hip_x - ax + dx, hip + (6 - m.shape[0]))
        lib.rect(legs_layer, hip_x - 1, hip - 1, 5, 1, c["d"])

    hands = P.get("hands")
    if view == "down":
        sh_w, sh_o = (18 + lean, torso_y + 1), (29 + lean, torso_y + 1)
        dflt = ((16 + lean, torso_y + 6), (30 + lean, torso_y + 6))
    elif view == "up":
        sh_w, sh_o = (29 + lean, torso_y + 1), (18 + lean, torso_y + 1)
        dflt = ((30 + lean, torso_y + 6), (16 + lean, torso_y + 6))
    else:
        sh_w, sh_o = (23 + lean, torso_y + 2), (25 + lean, torso_y + 2)
        dflt = ((25 + lean, torso_y + 6), (22 + lean, torso_y + 6))
    if hands is None:
        hands = dflt
    hw, ho = hands

    wr = None
    if P.get("wrench") is not None:
        wr = draw_wrench(a, hw[0] + 1, hw[1] + 1, P["wrench"], P.get("wlen", 13))
    wlayer = P.get("wlayer", "front")
    sm = None
    if P.get("smear"):
        a0, a1 = P["smear"][:2]
        r_out = P["smear"][2] if len(P["smear"]) > 2 else 16
        cx, cy = P.get("smear_c", (hw[0] + 1, hw[1] + 1))
        sm = smear(a, cx, cy, a0, a1, max(3, r_out - 5), r_out)

    head = (HEAD_HURT if face == "hurt" else HEAD)[view]
    if face == "closed" and view == "down":
        head = HEAD_CLOSED
    head_x = (18 if view != "side" else 18) + lean + hdx

    # ---------------- ordre des calques
    if wr is not None and wlayer == "back":
        blit(a, wr, 0, 0)
    if view == "side":
        # bras lointain derrière le corps
        draw_arm(a, sh_o[0], sh_o[1], ho[0], ho[1], far=True)
    if view == "up":
        draw_arm(a, sh_w[0], sh_w[1], hw[0], hw[1], far=False)
        draw_arm(a, sh_o[0], sh_o[1], ho[0], ho[1], far=False)
    blit(a, legs_layer, 0, 0)
    t = TORSO[view]
    blit(a, t, torso_x, torso_y)
    if wr is not None and wlayer == "mid":
        blit(a, wr, 0, 0, edge=K)
    blit(a, head, head_x, head_y, edge=K if squash else None)
    if wr is not None and wlayer == "front":
        blit(a, wr, 0, 0, edge=K)
    if view == "down":
        draw_arm(a, sh_o[0], sh_o[1], ho[0], ho[1], edge=c["o"])
        draw_arm(a, sh_w[0], sh_w[1], hw[0], hw[1], edge=c["o"])
    elif view == "side":
        draw_arm(a, sh_w[0], sh_w[1], hw[0], hw[1], edge=c["o"])
    if wr is not None and wlayer == "top":
        blit(a, wr, 0, 0, edge=K)
    a = lib.outline(a)
    if sm is not None:
        blit(a, sm, 0, 0, only_on=None) if P.get("smear_over") else _under(a, sm)
    return a


def _under(a, layer):
    m = (a == 0) & (layer > 0)
    a[m] = layer[m]


def _legs_front(a, hip, lf, rf, view, lx=(0, 0)):
    """Jambes vues de face/dos : hanche pleine puis deux jambes de 4 px."""
    pants_l = [c["I"], c["i"], c["i"], c["d"]]
    pants_r = [c["i"], c["i"], c["d"], c["d"]]
    lib.rect(a, 19, hip, 10, 1, c["i"])
    lib.rect(a, 26, hip, 3, 1, c["d"])
    for x0, foot, cols in ((19 + lx[0], lf, pants_l), (25 + lx[1], rf, pants_r)):
        y0 = hip + 1
        for yy in range(y0, foot - 1):
            for i, col in enumerate(cols):
                a[yy, x0 + i] = col
        # botte
        by = max(y0, foot - 1)
        if view == "down":
            boot = [[c["m"], c["h"], c["h"], c["h"]], [c["h"], c["h"], c["h"], c["e"]]]
        else:
            boot = [[c["h"], c["h"], c["h"], c["e"]], [c["e"], c["e"], c["e"], c["e"]]]
        for j, row in enumerate(boot):
            yy = by + j
            if yy <= foot:
                for i, col in enumerate(row):
                    a[yy, x0 + i] = col


# --------------------------------------------------------------------------
# Animations
# --------------------------------------------------------------------------

RUN_DOWN = [  # (hip/bob, pied gauche, pied droit, main libre dy, main clé dy)
    (0, 42, 41, 1, -1),
    (1, 42, 40, 1, 0),
    (0, 42, 39, 0, 0),
    (-1, 41, 41, -1, 1),
    (0, 41, 42, -1, 1),
    (1, 40, 42, -1, 0),
    (0, 39, 42, 0, 0),
    (-1, 41, 41, 1, -1),
]

RUN_SIDE = [  # (jambe A, jambe B, bob, swap)
    ("fwd", "back", 0, False),
    ("fwd2", "liftback", 1, False),
    ("stand", "pass", 0, False),
    ("back", "fwdair", -1, False),
    ("fwd", "back", 0, True),
    ("fwd2", "liftback", 1, True),
    ("stand", "pass", 0, True),
    ("back", "fwdair", -1, True),
]


def idle(view):
    frames = []
    breath = [0, 0, 1, 1, 1, 0]
    rock = [0, 0, 1, 1, 1, 0]
    for i in range(6):
        b = breath[i]
        P = {"bob": b, "hip": 0, "head": (0, 0)}
        if view == "down":
            P["hands"] = ((16, 32 + b), (30, 33 + b))
            P["wrench"] = -90 - 11.25 * rock[i]
            P["wlayer"] = "front"
        elif view == "up":
            P["hands"] = ((30, 32 + b), (16, 33 + b))
            P["wrench"] = -90 + 11.25 * rock[i]
            P["wlayer"] = "back"
        else:
            P["hands"] = ((26, 32 + b), (21, 33 + b))
            P["wrench"] = 67.5 - 11.25 * rock[i]
            P["side_legs"] = ("stand", "stand", 0)
            P["far_dx"] = -2
        frames.append(frame(view, P))
    return frames


def run(view):
    frames = []
    for i in range(8):
        if view in ("down", "up"):
            bob, lf, rf, fdy, wdy = RUN_DOWN[i]
            P = {"bob": bob, "hip": bob, "feet": (lf, rf)}
            if view == "down":
                P["hands"] = ((16, 31 + bob + wdy), (30, 33 + bob + 2 * fdy))
                P["wrench"] = -101.25
            else:
                P["hands"] = ((30, 31 + bob + wdy), (16, 33 + bob - 2 * fdy))
                P["wrench"] = -78.75
                P["wlayer"] = "back"
                P["feet"] = (rf, lf)
        else:
            la, lb, bob, swap = RUN_SIDE[i]
            P = {"bob": bob, "side_legs": (la, lb, max(0, bob)), "swap": swap, "lean": 1}
            sw = 2 if not swap else -2
            if i in (2, 6, 3, 7):
                sw = 0 if i in (2, 6) else -sw
            P["hands"] = ((26, 30 + bob), (22 - sw, 33 + bob))
            P["wrench"] = -146.25
            P["wlayer"] = "back"
        frames.append(frame(view, P))
    return frames


# Attaques : liste de (angle de la clé, main clé (x, y), main libre, bob, lean,
# calque, traînée)
def _attack(view, keys):
    frames = []
    for k in keys:
        P = dict(k)
        frames.append(frame(view, P))
    return frames


def attack1(view):
    # balayage : de l'épaule « clé » vers le côté opposé, en passant devant
    if view == "down":
        ks = [
            {"wrench": -135, "hands": ((15, 29), (29, 33)), "lean": -1, "bob": 0},
            {"wrench": -157.5, "hands": ((14, 30), (28, 32)), "lean": -1, "bob": 1, "head": (-1, 0)},
            {"wrench": 45, "hands": ((27, 34), (25, 34)), "lean": 1, "bob": 1, "smear": (45, 175, 15),
             "smear_c": (24, 32)},
            {"wrench": 22.5, "hands": ((29, 33), (26, 34)), "lean": 1, "bob": 1, "head": (1, 0)},
            {"wrench": 67.5, "hands": ((28, 34), (17, 33)), "lean": 0, "bob": 0},
        ]
        for k in ks:
            k["wlayer"] = "front"
    elif view == "up":
        ks = [
            {"wrench": -45, "hands": ((31, 29), (17, 33)), "lean": 1, "bob": 0, "wlayer": "back"},
            {"wrench": -22.5, "hands": ((32, 30), (18, 32)), "lean": 1, "bob": 1, "wlayer": "back",
             "head": (1, 0)},
            {"wrench": -135, "hands": ((20, 28), (22, 28)), "lean": -1, "bob": 1, "wlayer": "back",
             "smear": (-10, -170, 15), "smear_c": (24, 29)},
            {"wrench": -157.5, "hands": ((17, 30), (20, 30)), "lean": -1, "bob": 1, "wlayer": "back",
             "head": (-1, 0)},
            {"wrench": -112.5, "hands": ((19, 31), (30, 33)), "lean": 0, "bob": 0, "wlayer": "back"},
        ]
    else:
        ks = [
            {"wrench": -112.5, "hands": ((23, 29), (21, 32)), "lean": -1, "bob": 0},
            {"wrench": -135, "hands": ((21, 28), (20, 31)), "lean": -2, "bob": 1, "head": (-1, 0),
             "wlayer": "back"},
            {"wrench": 22.5, "hands": ((29, 32), (27, 33)), "lean": 2, "bob": 1, "head": (1, 0),
             "smear": (-120, 30, 15), "smear_c": (25, 31)},
            {"wrench": 45, "hands": ((29, 33), (27, 34)), "lean": 2, "bob": 1, "head": (1, 0)},
            {"wrench": 67.5, "hands": ((27, 33), (23, 33)), "lean": 1, "bob": 0},
        ]
        for i, k in enumerate(ks):
            k["side_legs"] = ("fwd", "back", 0) if i >= 2 else ("stand", "back", 0)
            k.setdefault("wlayer", "front")
    return _attack(view, ks)


def attack2(view):
    # revers : retour de l'autre côté
    if view == "down":
        ks = [
            {"wrench": 22.5, "hands": ((30, 32), (27, 33)), "lean": 1, "bob": 0},
            {"wrench": -22.5, "hands": ((31, 30), (28, 31)), "lean": 1, "bob": 1, "head": (1, 0)},
            {"wrench": 135, "hands": ((19, 34), (22, 34)), "lean": -1, "bob": 1, "smear": (5, 135, 15),
             "smear_c": (24, 32)},
            {"wrench": 157.5, "hands": ((17, 33), (21, 34)), "lean": -1, "bob": 1, "head": (-1, 0)},
            {"wrench": 112.5, "hands": ((17, 33), (30, 33)), "lean": 0, "bob": 0},
        ]
        for k in ks:
            k["wlayer"] = "front"
    elif view == "up":
        ks = [
            {"wrench": -157.5, "hands": ((17, 30), (20, 30)), "lean": -1, "bob": 0, "wlayer": "back"},
            {"wrench": 180, "hands": ((16, 31), (19, 31)), "lean": -1, "bob": 1, "wlayer": "back"},
            {"wrench": -45, "hands": ((28, 28), (26, 28)), "lean": 1, "bob": 1, "wlayer": "back",
             "smear": (-170, -10, 15), "smear_c": (24, 29)},
            {"wrench": -22.5, "hands": ((31, 30), (27, 30)), "lean": 1, "bob": 1, "wlayer": "back"},
            {"wrench": -67.5, "hands": ((30, 31), (17, 33)), "lean": 0, "bob": 0, "wlayer": "back"},
        ]
    else:
        ks = [
            {"wrench": 67.5, "hands": ((28, 33), (25, 33)), "lean": 1, "bob": 0},
            {"wrench": 90, "hands": ((27, 34), (24, 34)), "lean": 1, "bob": 1},
            {"wrench": -45, "hands": ((28, 27), (26, 28)), "lean": 2, "bob": -1, "head": (1, -1),
             "smear": (60, -60, 15), "smear_c": (26, 31)},
            {"wrench": -67.5, "hands": ((27, 27), (25, 28)), "lean": 1, "bob": -1, "head": (0, -1)},
            {"wrench": -45, "hands": ((26, 31), (22, 33)), "lean": 0, "bob": 0},
        ]
        for i, k in enumerate(ks):
            k["side_legs"] = ("fwd", "back", 0) if i < 4 else ("stand", "back", 0)
            k["wlayer"] = "front"
    return _attack(view, ks)


def attack3(view):
    # coup de tire-fond : armé au-dessus de la tête, frappe au sol
    if view == "down":
        ks = [
            {"wrench": -112.5, "hands": ((21, 27), (25, 27)), "bob": 1, "squash": 1},
            {"wrench": -90, "hands": ((22, 22), (24, 22)), "bob": -1, "head": (0, -1), "wlayer": "back"},
            {"wrench": -90, "hands": ((22, 21), (24, 21)), "bob": -2, "head": (0, -1), "wlayer": "back"},
            {"wrench": 90, "hands": ((22, 33), (24, 33)), "bob": 2, "squash": 1,
             "smear": (-100, 90, 16), "smear_c": (23, 31)},
            {"wrench": 90, "hands": ((22, 34), (24, 34)), "bob": 2, "squash": 1},
            {"wrench": 90, "hands": ((22, 33), (24, 33)), "bob": 1},
            {"wrench": 112.5, "hands": ((20, 33), (29, 33)), "bob": 0},
        ]
        for k in ks:
            k.setdefault("wlayer", "front")
            k["feet"] = (42, 42)
            k["legs_x"] = (-1, 1) if k["bob"] >= 2 else (0, 0)
    elif view == "up":
        ks = [
            {"wrench": 67.5, "hands": ((26, 29), (22, 29)), "bob": 1, "wlayer": "top"},
            {"wrench": 90, "hands": ((23, 21), (25, 21)), "bob": -1, "wlayer": "top"},
            {"wrench": 90, "hands": ((23, 20), (25, 20)), "bob": -2, "wlayer": "top"},
            {"wrench": -90, "hands": ((23, 26), (25, 26)), "bob": 2, "wlayer": "back",
             "smear": (100, -90, 16), "smear_c": (24, 28)},
            {"wrench": -90, "hands": ((23, 27), (25, 27)), "bob": 2, "wlayer": "back"},
            {"wrench": -90, "hands": ((23, 27), (25, 27)), "bob": 1, "wlayer": "back"},
            {"wrench": -67.5, "hands": ((29, 30), (18, 32)), "bob": 0, "wlayer": "back"},
        ]
        for k in ks:
            k["legs_x"] = (-1, 1) if k["bob"] >= 2 else (0, 0)
    else:
        ks = [
            {"wrench": -112.5, "hands": ((23, 29), (21, 30)), "bob": 1, "lean": -1, "squash": 1},
            {"wrench": -157.5, "hands": ((22, 22), (21, 23)), "bob": -1, "lean": -2, "head": (-1, -1),
             "wlayer": "back"},
            {"wrench": 180, "hands": ((22, 21), (21, 22)), "bob": -2, "lean": -2, "head": (-1, -1),
             "wlayer": "back"},
            {"wrench": 45, "hands": ((30, 32), (28, 32)), "bob": 2, "lean": 3, "head": (1, 0), "squash": 1,
             "smear": (-150, 45, 16), "smear_c": (25, 30)},
            {"wrench": 45, "hands": ((30, 33), (28, 33)), "bob": 2, "lean": 3, "head": (1, 0), "squash": 1},
            {"wrench": 45, "hands": ((30, 33), (28, 33)), "bob": 1, "lean": 2, "head": (1, 0)},
            {"wrench": 67.5, "hands": ((27, 33), (23, 33)), "bob": 0, "lean": 1},
        ]
        for i, k in enumerate(ks):
            k["side_legs"] = ("fwd", "back", 1) if k["bob"] >= 2 else ("fwd", "back", 0)
            k.setdefault("wlayer", "front")
    return _attack(view, ks)


def dash(view):
    frames = []
    if view == "down":
        ks = [
            {"bob": 1, "squash": 1, "hands": ((16, 33), (30, 33)), "wrench": -112.5, "feet": (42, 42)},
            {"bob": 2, "squash": 1, "hands": ((17, 30), (30, 30)), "wrench": -135, "feet": (42, 40),
             "head": (0, 1)},
            {"bob": 2, "squash": 1, "hands": ((17, 30), (30, 30)), "wrench": -135, "feet": (41, 40),
             "head": (0, 1)},
            {"bob": 1, "hands": ((16, 31), (30, 32)), "wrench": -123.75, "feet": (42, 41)},
            {"bob": 0, "hands": ((16, 32), (30, 33)), "wrench": -101.25, "feet": (42, 42)},
        ]
        for k in ks:
            k["wlayer"] = "front"
            k["hip"] = k["bob"]
    elif view == "up":
        ks = [
            {"bob": 1, "squash": 1, "hands": ((30, 33), (16, 33)), "wrench": -67.5, "feet": (42, 42)},
            {"bob": -1, "hands": ((30, 33), (17, 34)), "wrench": -45, "feet": (40, 41), "head": (0, -1)},
            {"bob": -1, "hands": ((30, 33), (17, 34)), "wrench": -45, "feet": (41, 40), "head": (0, -1)},
            {"bob": 0, "hands": ((30, 32), (16, 33)), "wrench": -56.25, "feet": (42, 41)},
            {"bob": 0, "hands": ((30, 32), (16, 33)), "wrench": -78.75, "feet": (42, 42)},
        ]
        for k in ks:
            k["wlayer"] = "back"
            k["hip"] = k["bob"]
    else:
        ks = [
            {"bob": 1, "lean": -1, "squash": 1, "side_legs": ("fwd", "back", 1), "hands": ((24, 32), (21, 33)),
             "wrench": -22.5},
            {"bob": 2, "lean": 3, "head": (2, 1), "side_legs": ("fwd", "liftback", 1), "hands": ((29, 33), (25, 34)),
             "wrench": -11.25},
            {"bob": 2, "lean": 3, "head": (2, 1), "side_legs": ("fwdair", "liftback", 1),
             "hands": ((29, 33), (25, 34)), "wrench": -11.25},
            {"bob": 1, "lean": 1, "head": (1, 0), "side_legs": ("fwd", "back", 1), "hands": ((27, 32), (23, 33)),
             "wrench": -33.75},
            {"bob": 0, "lean": 0, "side_legs": ("stand", "back", 0), "hands": ((26, 32), (22, 33)),
             "wrench": -56.25},
        ]
    for i, k in enumerate(ks):
        f = frame(view, k)
        if i in (1, 2):
            f = _speed_lines(f, view)
        frames.append(f)
    return frames


def _speed_lines(f, view):
    """Traînée du dash : lignes de vitesse orange/ambre derrière le corps."""
    out = f.copy()
    m = f > 0
    if view == "side":
        rows = [y for y in range(18, 43) if m[y].any()]
        for j, y in enumerate(rows[2::4]):
            xs = np.nonzero(m[y])[0]
            x0 = xs.min()
            ln = 6 + (j % 2) * 4
            for x in range(max(0, x0 - ln), x0 - 1):
                out[y, x] = c["O"] if x > x0 - ln // 2 - 1 else c["a"]
    else:
        cols = [x for x in range(14, 34) if m[:, x].any()]
        for j, x in enumerate(cols[1::4]):
            ys = np.nonzero(m[:, x])[0]
            y0 = ys.min() if view == "down" else ys.max()
            ln = 4 + (j % 2) * 3
            rng = range(max(0, y0 - ln), y0 - 1) if view == "down" else range(y0 + 2, min(47, y0 + ln))
            for y in rng:
                out[y, x] = c["O"] if abs(y - y0) < ln // 2 + 1 else c["a"]
    return out


def hurt(view):
    frames = []
    for i, (dy, back) in enumerate([(1, 2), (0, 1), (0, 0)]):
        P = {"bob": dy, "face": "hurt" if i < 2 else "normal"}
        if view == "down":
            P.update({"head": (0, -back), "hands": ((15, 30 - back), (31, 30 - back)), "wrench": -123.75,
                      "feet": (42, 42 - (1 if i == 0 else 0))})
            P["bob"] = -back + 1
            P["hip"] = 0
        elif view == "up":
            P.update({"head": (0, back // 2), "hands": ((31, 31), (16, 31)), "wrench": -56.25, "wlayer": "back",
                      "feet": (42, 42)})
            P["hip"] = 0
        else:
            P.update({"lean": -back, "head": (-back, 0), "hands": ((24 - back, 32), (20 - back, 30)),
                      "wrench": 112.5 + 11.25 * back, "side_legs": ("stand", "back", 0) if i < 2 else ("stand", "stand", 0)})
        frames.append(frame(view, P))
    return frames


# ---------------- animations mono-direction (down)

def _seated(stage):
    """Héros assis par terre, vu de face (fin de l'anim de mort)."""
    a = canvas(S)
    # jambes allongées vers la caméra
    legs = parse(
        """
        .iiiiiiiiidd.
        Iiiiid.iiiddd
        mhhhhe.mhhhhe
        heeehe.heeehe
        """
    )
    blit(a, legs, 17, 39)
    return a


def death():
    frames = []
    # 0-2 : vacille, 3-5 : genou à terre, 6-8 : s'assoit, 9-11 : clé posée,
    # thermos renversé, tête baissée
    seq = [
        {"bob": 0, "face": "hurt", "head": (0, -1), "hands": ((15, 29), (31, 30)), "wrench": -123.75},
        {"bob": 1, "face": "hurt", "head": (1, 0), "lean": 1, "hands": ((16, 31), (31, 32)), "wrench": -112.5},
        {"bob": 2, "face": "hurt", "head": (-1, 1), "lean": -1, "hands": ((15, 33), (30, 34)), "wrench": 157.5,
         "feet": (42, 41)},
        {"bob": 3, "face": "closed", "hands": ((15, 34), (30, 35)), "wrench": 135, "feet": (42, 40)},
        {"bob": 4, "face": "closed", "squash": 1, "hands": ((15, 35), (30, 36)), "wrench": 135, "feet": (42, 41)},
        {"bob": 5, "face": "closed", "squash": 1, "hands": ((15, 36), (30, 37)), "wrench": 135, "feet": (42, 42)},
    ]
    for k in seq:
        k["hip"] = k["bob"]
        k.setdefault("feet", (42, 42))
        frames.append(frame("down", k))
    # 6-11 : assis
    for i in range(6):
        drop = min(i, 1)
        a = canvas(S)
        body = frame(
            "down",
            {
                "bob": 4 + drop,
                "face": "closed",
                "squash": 1 if i >= 2 else 0,
                "head": (0, 1 if i >= 3 else 0),
                "hands": ((16, 36 + drop), (30, 36 + drop)),
                "wrench": None,
                "feet": (47, 47),
                "hip": 40,
            },
        )
        # jambes assises
        seat = _seated(0)
        blit(a, seat, 0, 0)
        a = lib.outline(a)
        # corps par-dessus, tronqué au-dessus des jambes
        body_cut = body.copy()
        body_cut[40:, :] = 0
        blit(a, body_cut, 0, 0)
        # clé posée au sol, à droite
        wr = draw_wrench(a, 33, 41, -22.5 if i < 3 else -11.25)
        wr = lib.outline(wr)
        wl = canvas(S)
        blit(wl, wr, 0, 0)
        _under(a, wl) if i < 2 else blit(a, wr, 0, 0)
        # thermos renversé (à gauche), café qui s'écoule
        th = parse(
            """
            .KKKK..
            KiIIiK.
            KaOOoKK
            KiiiiKq
            .KKKK..
            """
        )
        blit(a, th, 8, 38)
        if i >= 3:
            puddle = [(14, 41), (15, 41), (14, 42), (15, 42), (16, 42), (13, 42)][: 2 + i]
            for (x, y) in puddle:
                if a[y, x] == 0:
                    a[y, x] = c["h"]
        frames.append(a)
    return frames


def spawn():
    """Prise de poste : silhouette ambre qui se matérialise, plante la clé (6)."""
    frames = []
    base = frame("down", {"hands": ((22, 23), (25, 23)), "wrench": -90, "wlayer": "top", "bob": 0})
    land = frame("down", {"hands": ((22, 31), (25, 31)), "wrench": 90, "bob": 2, "squash": 1, "hip": 2,
                          "wlayer": "front"})
    planted = frame("down", {"hands": ((22, 32), (25, 32)), "wrench": 90, "bob": 1, "hip": 1})
    rest = idle("down")[0]
    m = base > 0
    for i in range(10):
        if i < 4:
            f = canvas(S)
            if i < 2:
                w = 2 if i == 0 else 4
                lib.rect(f, CX - w - 1, 4, 2 * w + 2, 40, c["a"])
                lib.rect(f, CX - w, 4, 2 * w, 40, c["y"])
                lib.rect(f, CX - 1, 4, 2, 40, c["W"])
            else:
                f[m] = c["a"] if i == 2 else c["W"]
                inner = m & ~(lib.outline(m.astype(np.uint8), 1) > 0) if False else m
                if i == 2:
                    core = np.zeros_like(m)
                    core[:, CX - 2 : CX + 2] = True
                    f[m & core] = c["W"]
                    lib.rect(f, CX - 1, 2, 2, 16, c["a"])
            frames.append(f)
        elif i == 4:
            frames.append(_flash(base.copy(), 0.5))
        elif i == 5:
            frames.append(base)
        elif i == 6:
            frames.append(land)
        elif i in (7, 8):
            frames.append(planted)
        else:
            frames.append(rest)
    return frames


def _flash(f, amount):
    out = f.copy()
    m = (f > 0) & (f != K)
    rr = lib.checker(f.shape)
    out[m & rr] = c["W"]
    return out


def special():
    """Préavis de grève : coup de sifflet + clé plantée -> onde (active 4)."""
    frames = []
    # sifflet : petite pièce ambre à la bouche (main libre)
    seq = [
        {"bob": 1, "squash": 1, "hands": ((17, 30), (26, 29)), "wrench": -112.5},
        {"bob": 1, "squash": 1, "hands": ((19, 27), (26, 28)), "wrench": -90, "wlayer": "back"},
        {"bob": 0, "hands": ((21, 21), (26, 27)), "wrench": -90, "wlayer": "back", "head": (0, -1)},
        {"bob": -2, "hands": ((22, 18), (26, 27)), "wrench": -90, "wlayer": "back", "head": (0, -1)},
        {"bob": 2, "squash": 1, "hands": ((22, 33), (26, 27)), "wrench": 90, "smear": (-100, 90, 16),
         "smear_c": (23, 31)},
        {"bob": 2, "squash": 1, "hands": ((22, 34), (26, 27)), "wrench": 90},
        {"bob": 1, "hands": ((22, 33), (26, 27)), "wrench": 90},
        {"bob": 1, "hands": ((22, 33), (26, 27)), "wrench": 90},
        {"bob": 0, "hands": ((22, 33), (26, 28)), "wrench": 90},
        {"bob": 0, "hands": ((21, 33), (28, 31)), "wrench": 101.25},
        {"bob": 0, "hands": ((19, 33), (30, 33)), "wrench": 112.5},
        {"bob": 0, "hands": ((16, 32), (30, 33)), "wrench": -101.25},
    ]
    for i, k in enumerate(seq):
        k.setdefault("wlayer", "front")
        k["hip"] = max(0, k["bob"])
        k["feet"] = (42, 42)
        f = frame("down", k)
        if 2 <= i <= 8:
            # sifflet ambre à la bouche + petites ondes
            wy = 25 + k["bob"] + k.get("head", (0, 0))[1]
            for (x, y, col) in ((24, wy + 1, "a"), (25, wy + 1, "y"), (26, wy + 1, "a")):
                f[y, x] = c[col]
            if 4 <= i <= 7:
                for j, (x, y) in enumerate(((28, wy - 2), (29, wy - 3), (30, wy - 3), (31, wy - 2), (29, wy + 3),
                                            (30, wy + 4), (31, wy + 4))):
                    if f[y, x] == 0:
                        f[y, x] = c["y"] if j % 2 else c["W"]
        frames.append(f)
    return frames


PIVOT = (24, 44)


def build(emit):
    D3 = ("down", "up", "side")
    for v in D3:
        emit("player", f"player_idle_{v}_strip6", idle(v), [150] * 6, loop=True)
        emit("player", f"player_run_{v}_strip8", run(v), [80] * 8, loop=True,
             events={"footstep": [0, 4]})
        emit("player", f"player_attack1_{v}_strip5", attack1(v), [50, 40, 50, 70, 90], active=[2],
             events={"comboWindow": 3})
        emit("player", f"player_attack2_{v}_strip5", attack2(v), [50, 40, 50, 70, 90], active=[2],
             events={"comboWindow": 3})
        emit("player", f"player_attack3_{v}_strip7", attack3(v), [90, 70, 40, 50, 100, 100, 110], active=[3],
             events={"vfx": {"3": "vfx_slam"}, "shake": {"frame": 3, "px": 2, "ms": 100}, "hitstop": 60})
        emit("player", f"player_dash_{v}_strip5", dash(v), [30, 40, 40, 40, 50],
             events={"invulnerable": [0, 1, 2, 3]})
        emit("player", f"player_hurt_{v}_strip3", hurt(v), [60, 80, 100])
    emit("player", "player_death_strip12", death(), [100] * 11 + [400])
    emit("player", "player_spawn_strip10", spawn(), [80] * 9 + [120], events={"vfx": {"6": "vfx_dust-land"}})
    emit("player", "player_special_strip12", special(),
         [100, 100, 100, 100, 40, 60, 80, 80, 100, 100, 100, 120], active=[4],
         events={"vfx": {"0": "vfx_charge", "4": "vfx_shockwave"}})
