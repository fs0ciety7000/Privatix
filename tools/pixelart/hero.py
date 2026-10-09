"""Le héros : cheminot en 3x8, casque blanc, gilet orange haute visibilité à
bandes réfléchissantes, lourde clé à tire-fond.

Frame 48×48, pivot (24, 44) : les semelles sont sur la ligne 42, le contour sur
la ligne 43. Les pièces (tête, torse, jambes de profil) sont des matrices de
caractères dessinées à la main ; bras et clé sont posés par un mini-squelette
(épaule -> main, main + angle) puis tout est contouré en #14101A.
"""
import numpy as np

import lib
import modern
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
STEEL = (c["7"], c["g"], c["s"])
DARK = (c["g"], c["s"], c["D"])
GRIP = (c["f"], c["O"], c["o"])


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
    import math

    w = canvas(a.shape[1], a.shape[0])
    lib.draw_rotated(w, gx, gy, angle, wrench_shapes(length))
    # reflet spéculaire sur la barre du T
    th = math.radians(angle)
    hx = gx + (length - 0.5) * math.cos(th) + 3.0 * math.sin(th)
    hy = gy + (length - 0.5) * math.sin(th) - 3.0 * math.cos(th)
    if 0 <= int(hy) < S and 0 <= int(hx) < S and w[int(hy), int(hx)]:
        lib.px(w, int(hx), int(hy), c["W"])
    return w


def smear(cx, cy, a_from, a_to, direction, r_out=16, width=7, fade=0.0, hot=True, size=S):
    """Traînée (smear) de la clé, façon Dead Cells : croissant plein, fin à la
    queue (a_from) et large à la tête (a_to), cœur blanc, bords colorés,
    stries de vitesse dans la queue. direction = +1 (angle croissant, sens
    horaire à l'écran) ou -1. fade > 0 : seule la partie avant subsiste
    (frame de follow-through)."""
    d, ang = lib.polar((size, size), cx, cy)
    rel = ((ang - a_from) * direction) % 360
    span = ((a_to - a_from) * direction) % 360 or 360
    t = rel / span
    inside = rel <= span
    if fade:
        inside &= t >= fade
        t = np.clip((t - fade) / max(0.01, 1 - fade), 0, 1)
    thick = width * (0.3 + 0.7 * t ** 0.8)
    band = inside & (d <= r_out) & (d > r_out - thick)
    rr = (r_out - d) / np.maximum(thick, 0.01)
    out = canvas(size)
    if hot:
        cols = (("j", 0.0), ("W", 0.18), ("Z", 0.55), ("y", 0.72), ("O", 0.88))
    else:
        cols = (("y", 0.0), ("a", 0.3), ("O", 0.6), ("o", 0.85))
    for col, lo in cols:
        out[band & (rr >= lo)] = c[col]
    # tête du coup : noyau blanc élargi
    if hot:
        out[band & (t > 0.82) & (rr < 0.7)] = c["W"]
    # stries de vitesse dans la queue
    streak = band & (t < 0.45) & (((d * 1.0).astype(int) + (rel / 9).astype(int)) % 3 == 0)
    out[streak] = 0
    return out


# --------------------------------------------------------------------------
# Écharpe syndicale rouge (élément secondaire, retard d'1–2 frames)
# --------------------------------------------------------------------------
SCARF_NODES = 4
SCARF_SEG = 3.0


def simulate_scarf(anchors, winds, loop=True, nodes=SCARF_NODES, seg=SCARF_SEG, g=0.55, sub=3, damp=0.72):
    """Chaîne verlet accrochée au cou. anchors : (x, y) par frame ; winds :
    accélération (vent relatif, élan du coup) par frame. Les boucles sont
    simulées 3 fois pour atteindre un régime stable : la queue suit le corps
    avec le retard naturel de la chaîne (follow-through)."""
    n = len(anchors)
    ax, ay = anchors[0]
    pos = [[ax, ay + seg * (k + 1)] for k in range(nodes)]
    prev = [p[:] for p in pos]

    def step(anchor, wind):
        for k in range(nodes):
            vx = (pos[k][0] - prev[k][0]) * damp
            vy = (pos[k][1] - prev[k][1]) * damp
            prev[k] = pos[k][:]
            # le bout de l'écharpe prend plus le vent
            f = 0.6 + 0.4 * (k + 1) / nodes
            pos[k][0] += vx + wind[0] * f
            pos[k][1] += vy + wind[1] * f + g
        for _ in range(3):
            px_, py_ = anchor
            for k in range(nodes):
                dx, dy = pos[k][0] - px_, pos[k][1] - py_
                dist = max(1e-3, (dx * dx + dy * dy) ** 0.5)
                pos[k][0] = px_ + dx / dist * seg
                pos[k][1] = py_ + dy / dist * seg
                px_, py_ = pos[k]

    for _ in range(12):
        step(anchors[0], winds[0])
    out = None
    for _p in range(3 if loop else 1):
        out = []
        for i in range(n):
            a0 = anchors[i - 1] if (i > 0 or loop) else anchors[0]
            a1 = anchors[i]
            for s in range(sub):
                t = (s + 1) / sub
                step((a0[0] + (a1[0] - a0[0]) * t, a0[1] + (a1[1] - a0[1]) * t), winds[i])
            out.append([tuple(p) for p in pos])
    return out


def draw_scarf_tail(layer, anchor, pts, wide=False):
    """Queue de l'écharpe : bande de 2 px (dessus rouge, dessous ombré) qui
    s'affine à 1 px, liseré blanc et frange au bout."""
    chain = [anchor] + list(pts)
    nseg = len(chain) - 1
    for k, (p0, p1) in enumerate(zip(chain[:-1], chain[1:])):
        if wide and k < nseg - 1:
            lib.line(layer, p0[0] + 1, p0[1], p1[0] + 1, p1[1], c["R"])
        elif k < nseg - 1:
            lib.line(layer, p0[0], p0[1] + 1, p1[0], p1[1] + 1, c["R"])
        lib.line(layer, p0[0], p0[1], p1[0], p1[1], c["x"] if k else c["l"])
    bx, by = chain[-2]
    lib.px(layer, int(round(bx)), int(round(by)), c["w"])
    (x0, y0), (x1, y1) = chain[-2], chain[-1]
    dx, dy = x1 - x0, y1 - y0
    ln = max(1e-3, (dx * dx + dy * dy) ** 0.5)
    lib.px(layer, int(round(x1 + dx / ln * 1.2)), int(round(y1 + dy / ln * 1.2)), c["R"])


def neck_anchor(view, P):
    bob = P.get("bob", 0)
    lean = P.get("lean", 0)
    torso_y = 27 + bob
    if view == "side":
        return (20.5 + lean, torso_y - 0.5)
    if view == "up":
        return (24 + lean, torso_y + 0.5)
    return (25.5 + lean, torso_y + 0.0)


# --------------------------------------------------------------------------
# Bras
# --------------------------------------------------------------------------


def draw_arm(a, sx, sy, hx, hy, far=False, edge=None, cast=False):
    """Manche bleu (2 px) de l'épaule à la main + main 2×2."""
    arm = canvas(S)
    col = c["n"] if far else c["i"]
    lib.thick_line(arm, sx, sy, hx, hy, col, 2)
    # rehaut du haut de manche
    if not far:
        lib.px(arm, sx, sy, c["I"])
    hand = c["z"] if far else c["p"]
    lib.rect(arm, hx, hy, 2, 2, hand)
    lib.px(arm, hx + 1, hy + 1, c["z"] if not far else c["m"])
    blit(a, arm, 0, 0, edge=edge, cast=cast)


# --------------------------------------------------------------------------
# Squash & stretch (rééchantillonnage au plus proche autour des pieds)
# --------------------------------------------------------------------------


def stretch(a, sx, sy, cx=24.0, cy=43.0):
    if abs(sx - 1) < 1e-3 and abs(sy - 1) < 1e-3:
        return a
    H, W = a.shape
    ys, xs = np.mgrid[0:H, 0:W]
    srcx = np.floor(cx + (xs + 0.5 - cx) / sx).astype(int)
    srcy = np.floor(cy + (ys + 0.5 - cy) / sy).astype(int)
    ok = (srcx >= 0) & (srcx < W) & (srcy >= 0) & (srcy < H)
    out = np.zeros_like(a)
    out[ok] = a[srcy[ok], srcx[ok]]
    return out


# --------------------------------------------------------------------------
# Assemblage d'une frame
# --------------------------------------------------------------------------


def frame(view, P):
    """view : 'down' | 'up' | 'side'. P : dictionnaire de pose.

    Clés : bob (décalage vertical du haut du corps), lean (dx du haut du corps),
    head (dx, dy) relatif, legs, hands = ((x, y) main clé, (x, y) autre main),
    wrench = (angle) ou None, wlayer 'front'|'back'|'mid'|'top',
    smear = dict(a_from, a_to, dir, r, width, fade, c), face 'normal'|'hurt'|'closed',
    squash (int : tête enfoncée), stretch (sx, sy), scarf (points de la queue,
    calculés par simulate_scarf), raw (pas de passe d'éclairage).
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
        for name, is_near in ([(lb, False), (la, True)] if not swap else [(la, False), (lb, True)]):
            m, ax = _leg_colored(name, is_near)
            dx = 0 if is_near else P.get("far_dx", -1)
            blit(legs_layer, m, hip_x - ax + dx, hip + (6 - m.shape[0]), cast=is_near)
        lib.rect(legs_layer, hip_x - 1, hip - 1, 5, 1, c["n"])

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

    head = (HEAD_HURT if face == "hurt" else HEAD)[view]
    if face == "closed" and view == "down":
        head = HEAD_CLOSED
    head_x = 18 + lean + hdx

    # ---------------- écharpe
    anchor = neck_anchor(view, P)
    tail = canvas(S)
    pts = P.get("scarf")
    if pts is None:
        pts = simulate_scarf([anchor], [(0.0, 0.0)], loop=False)[0]
    if pts:
        draw_scarf_tail(tail, anchor, pts, wide=(view == "up"))
    knot = _scarf_knot(view, torso_x, torso_y)

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
    blit(a, t, torso_x, torso_y, cast=True)
    if view != "up":
        blit(a, knot, 0, 0, edge="selout", cast=True)
    if wr is not None and wlayer == "mid":
        blit(a, wr, 0, 0, edge="selout")
    blit(a, head, head_x, head_y, edge="selout" if squash else None, cast=True)
    if view == "up":
        blit(a, knot, 0, 0, edge="selout")
        blit(a, tail, 0, 0, cast=True)
    if wr is not None and wlayer == "front":
        blit(a, wr, 0, 0, edge="selout", cast=True)
    if view == "down":
        draw_arm(a, sh_o[0], sh_o[1], ho[0], ho[1], edge=c["o"], cast=True)
        draw_arm(a, sh_w[0], sh_w[1], hw[0], hw[1], edge=c["o"], cast=True)
    elif view == "side":
        draw_arm(a, sh_w[0], sh_w[1], hw[0], hw[1], edge="selout", cast=True)
    if wr is not None and wlayer == "top":
        blit(a, wr, 0, 0, edge="selout", cast=True)
    if view == "down":
        tail[torso_y + 4 :, :] = 0  # la queue passe dans le dos, jamais entre les jambes
        tail[: torso_y - 1, :] = 0  # ni en antenne au-dessus du casque
    if view == "up":
        tail[torso_y + 10 :, :] = 0
    if view != "up":
        _under(a, tail)
    sx, sy = P.get("stretch", (1.0, 1.0))
    a = stretch(a, sx, sy)
    a = lib.outline(a)
    if not P.get("raw"):
        a = modern.shade(a, ground=FOOT if not P.get("airborne") else None)
    sm = P.get("smear")
    if sm:
        cx, cy = sm.get("c", (hw[0] + 1, hw[1] + 1))
        layer = smear(cx, cy, sm["a_from"], sm["a_to"], sm.get("dir", 1), sm.get("r", 16), sm.get("width", 7),
                      sm.get("fade", 0.0), sm.get("hot", True))
        if sm.get("over"):
            blit(a, layer, 0, 0)
        else:
            _under(a, layer)
    return a


def _scarf_knot(view, torso_x, torso_y):
    """Nœud de l'écharpe autour du col (+ court pan devant sur la vue de face)."""
    k = canvas(S)
    if view == "down":
        lib.rect(k, torso_x + 2, torso_y, 6, 1, c["x"])
        lib.rect(k, torso_x + 2, torso_y, 2, 1, c["l"])
        # pan avant qui pend sur la poitrine
        lib.rect(k, torso_x + 7, torso_y, 1, 4, c["x"])
        lib.px(k, torso_x + 7, torso_y + 3, c["R"])
    elif view == "up":
        lib.rect(k, torso_x + 1, torso_y, 8, 2, c["x"])
        lib.rect(k, torso_x + 1, torso_y + 1, 8, 1, c["R"])
        lib.rect(k, torso_x + 2, torso_y, 2, 1, c["l"])
    else:
        lib.rect(k, torso_x + 0, torso_y, 4, 1, c["x"])
        lib.rect(k, torso_x + 1, torso_y + 1, 3, 1, c["R"])
        lib.rect(k, torso_x + 0, torso_y, 2, 1, c["l"])
        lib.px(k, torso_x - 1, torso_y, c["x"])
    return k


def _under(a, layer):
    m = (a == 0) & (layer > 0)
    a[m] = layer[m]


def _legs_front(a, hip, lf, rf, view, lx=(0, 0)):
    """Jambes vues de face/dos : hanche pleine puis deux jambes de 4 px."""
    pants_l = [c["I"], c["i"], c["i"], c["n"]]
    pants_r = [c["i"], c["i"], c["n"], c["n"]]
    lib.rect(a, 19, hip, 10, 1, c["i"])
    lib.rect(a, 26, hip, 3, 1, c["n"])
    for x0, foot, cols in ((19 + lx[0], lf, pants_l), (25 + lx[1], rf, pants_r)):
        y0 = hip + 1
        for yy in range(y0, foot - 1):
            for i, col in enumerate(cols):
                a[yy, x0 + i] = col
        # genouillère / pli du pantalon
        if foot - 1 - y0 > 3:
            a[y0 + 2, x0 + 1] = c["I"] if cols is pants_l else c["i"]
        # botte
        by = max(y0, foot - 1)
        if view == "down":
            boot = [[c["z"], c["m"], c["h"], c["h"]], [c["h"], c["h"], c["e"], c["e"]]]
        else:
            boot = [[c["m"], c["h"], c["h"], c["e"]], [c["e"], c["e"], c["e"], c["e"]]]
        for j, row in enumerate(boot):
            yy = by + j
            if yy <= foot:
                for i, col in enumerate(row):
                    a[yy, x0 + i] = col


# --------------------------------------------------------------------------
# Rendu d'une animation : écharpe simulée sur toute la séquence
# --------------------------------------------------------------------------


def render(view, Ps, winds, loop=False, post=None):
    anchors = [neck_anchor(view, P) for P in Ps]
    if isinstance(winds, tuple):
        winds = [winds] * len(Ps)
    tails = simulate_scarf(anchors, winds, loop=loop)
    out = []
    for i, (P, pts) in enumerate(zip(Ps, tails)):
        P = dict(P)
        P["scarf"] = pts
        f = frame(view, P)
        if post:
            f = post(i, f)
        out.append(f)
    return out


def _wind(view, strength, lift=0.0):
    """Vent relatif quand le héros avance dans `view` (la queue part à l'opposé)."""
    if view == "side":
        return (-strength, -lift - 0.4 * strength)
    if view == "down":
        return (0.15 * strength, -strength)
    return (0.5 * strength, strength * 0.5)


# --------------------------------------------------------------------------
# Animations
# --------------------------------------------------------------------------

RUN_SIDE = [  # (jambe A, jambe B, bob, swap, tête dy) : contact, appui, passage, poussée, vol
    ("fwd", "back", 0, False, 0),
    ("fwd2", "liftback", 1, False, 1),
    ("stand", "pass", 0, False, 0),
    ("back", "pass", -1, False, -1),
    ("back", "fwdair", -1, False, -1),
    ("fwd", "back", 0, True, 0),
    ("fwd2", "liftback", 1, True, 1),
    ("stand", "pass", 0, True, 0),
    ("back", "pass", -1, True, -1),
    ("back", "fwdair", -1, True, -1),
]


def idle(view):
    import math

    Ps, winds = [], []
    breath = [0, 0, 0, 1, 1, 1, 1, 0]
    rock = [0, 0, 0.5, 1, 1, 1, 0.5, 0]
    for i in range(8):
        b = breath[i]
        sway = math.sin(2 * math.pi * i / 8)
        P = {"bob": b, "hip": 0, "head": (0, 0), "squash": 1 if i in (4, 5) else 0}
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
        Ps.append(P)
        winds.append((-0.25 + 0.2 * sway, -0.1) if view == "side" else (0.3 * sway, 0.0))
    return render(view, Ps, winds, loop=True)


def run(view):
    import math

    Ps, winds = [], []
    n = 10
    for i in range(n):
        p = i / n
        if view in ("down", "up"):
            lift_l = int(round(3 * max(0.0, math.sin(2 * math.pi * p))))
            lift_r = int(round(3 * max(0.0, math.sin(2 * math.pi * (p + 0.5)))))
            bob = [0, 1, 0, -1, 0][i % 5]
            sw = math.cos(2 * math.pi * p)
            P = {"bob": bob, "hip": bob, "feet": (FOOT - lift_l, FOOT - lift_r), "squash": 1 if bob == 1 else 0}
            if bob == -1:
                P["head"] = (0, -1)
            if view == "down":
                P["hands"] = ((16, 31 + bob + int(round(-sw))), (30, 33 + bob + int(round(2 * sw))))
                P["wrench"] = -101.25
            else:
                P["hands"] = ((30, 31 + bob + int(round(-sw))), (16, 33 + bob - int(round(2 * sw))))
                P["wrench"] = -78.75
                P["wlayer"] = "back"
                P["feet"] = (FOOT - lift_r, FOOT - lift_l)
        else:
            la, lb, bob, swap, hdy = RUN_SIDE[i]
            P = {"bob": bob, "side_legs": (la, lb, max(0, bob)), "swap": swap, "lean": 1, "head": (0, hdy),
                 "squash": 1 if bob == 1 else 0}
            sw = math.cos(2 * math.pi * p)
            P["hands"] = ((26, 30 + bob), (22 - int(round(2 * sw)), 33 + bob))
            P["wrench"] = -146.25
            P["wlayer"] = "back"
            if bob == -1:
                P["airborne"] = True
        Ps.append(P)
        flap = 0.35 * math.sin(2 * math.pi * p * 2)
        w = _wind(view, 1.25)
        winds.append((w[0] + (flap if view != "side" else 0), w[1] + (flap if view == "side" else 0)))
    return render(view, Ps, winds, loop=True)


# ----- attaques : (clé, mains, posture) ; smear = traînée sur la frame active

def _sm(a_from, a_to, d, c_=None, r=16, width=7, fade=0.0, hot=True):
    s = {"a_from": a_from, "a_to": a_to, "dir": d, "r": r, "width": width, "fade": fade, "hot": hot}
    if c_:
        s["c"] = c_
    return s


def attack1(view):
    # balayage : de l'épaule « clé » vers le côté opposé, en passant devant
    if view == "down":
        ks = [
            {"wrench": -120, "hands": ((16, 30), (29, 33)), "lean": 0, "bob": 0},
            {"wrench": -157.5, "hands": ((14, 29), (28, 32)), "lean": -1, "bob": 1, "squash": 1, "head": (-1, 0),
             "stretch": (1.06, 0.95)},
            {"wrench": 45, "hands": ((27, 34), (25, 34)), "lean": 1, "bob": 0, "head": (1, 0), "stretch": (1.08, 0.97),
             "smear": _sm(202.5, 45, -1, (24, 31), 17, 8)},
            {"wrench": 22.5, "hands": ((29, 33), (26, 34)), "lean": 2, "bob": 1, "head": (1, 0),
             "smear": _sm(202.5, 30, -1, (24, 31), 17, 5, fade=0.62, hot=False)},
            {"wrench": 5, "hands": ((30, 32), (26, 34)), "lean": 1, "bob": 1},
            {"wrench": 45, "hands": ((28, 33), (22, 34)), "lean": 1, "bob": 0},
            {"wrench": 67.5, "hands": ((28, 34), (17, 33)), "lean": 0, "bob": 0},
        ]
        for k in ks:
            k["wlayer"] = "front"
        winds = [(0.3, 0), (0.6, -0.2), (-1.4, 0.4), (-1.0, 0.2), (-0.4, 0), (0, 0), (0, 0)]
    elif view == "up":
        ks = [
            {"wrench": -60, "hands": ((30, 30), (17, 33)), "lean": 0, "bob": 0},
            {"wrench": -22.5, "hands": ((32, 30), (18, 32)), "lean": 1, "bob": 1, "squash": 1, "head": (1, 0),
             "stretch": (1.06, 0.95)},
            {"wrench": -135, "hands": ((20, 28), (22, 28)), "lean": -1, "bob": 0, "stretch": (1.08, 0.97),
             "smear": _sm(-22.5, -135, -1, (24, 29), 17, 8)},
            {"wrench": -157.5, "hands": ((17, 30), (20, 30)), "lean": -1, "bob": 1, "head": (-1, 0),
             "smear": _sm(-22.5, -150, -1, (24, 29), 17, 5, fade=0.62, hot=False)},
            {"wrench": -170, "hands": ((16, 31), (19, 31)), "lean": -1, "bob": 1},
            {"wrench": -135, "hands": ((18, 31), (26, 32)), "lean": 0, "bob": 0},
            {"wrench": -112.5, "hands": ((19, 31), (30, 33)), "lean": 0, "bob": 0},
        ]
        for k in ks:
            k["wlayer"] = "back"
        winds = [(-0.3, 0.3), (-0.6, 0.4), (1.4, 0.6), (1.0, 0.4), (0.4, 0.2), (0, 0.1), (0, 0)]
    else:
        ks = [
            {"wrench": -112.5, "hands": ((22, 29), (21, 32)), "lean": -1, "bob": 0, "wlayer": "back"},
            {"wrench": -150, "hands": ((21, 28), (20, 31)), "lean": -2, "bob": 1, "squash": 1, "head": (-1, 0),
             "wlayer": "back", "stretch": (0.96, 1.0)},
            {"wrench": 22.5, "hands": ((29, 32), (27, 33)), "lean": 2, "bob": 0, "head": (1, 0),
             "stretch": (1.1, 0.96), "smear": _sm(-150, 22.5, 1, (25, 31), 17, 8)},
            {"wrench": 45, "hands": ((29, 33), (27, 34)), "lean": 2, "bob": 1, "head": (1, 0),
             "smear": _sm(-150, 40, 1, (25, 31), 17, 5, fade=0.62, hot=False)},
            {"wrench": 56, "hands": ((29, 34), (26, 34)), "lean": 2, "bob": 1},
            {"wrench": 67.5, "hands": ((28, 33), (24, 33)), "lean": 1, "bob": 0},
            {"wrench": 67.5, "hands": ((27, 33), (23, 33)), "lean": 0, "bob": 0},
        ]
        for i, k in enumerate(ks):
            k["side_legs"] = ("fwd", "back", 0) if i >= 2 else ("stand", "back", 0)
            k.setdefault("wlayer", "front")
        winds = [(0.4, 0), (0.8, -0.1), (-1.8, -0.5), (-1.3, -0.2), (-0.6, 0), (-0.2, 0), (-0.2, 0)]
    return render(view, ks, winds)


def attack2(view):
    # revers : retour de l'autre côté
    if view == "down":
        ks = [
            {"wrench": 22.5, "hands": ((30, 32), (27, 33)), "lean": 1, "bob": 0},
            {"wrench": -22.5, "hands": ((31, 30), (28, 31)), "lean": 1, "bob": 1, "squash": 1, "head": (1, 0),
             "stretch": (1.06, 0.95)},
            {"wrench": 135, "hands": ((19, 34), (22, 34)), "lean": -1, "bob": 0, "stretch": (1.08, 0.97),
             "smear": _sm(-22.5, 135, 1, (24, 31), 17, 8)},
            {"wrench": 157.5, "hands": ((17, 33), (21, 34)), "lean": -1, "bob": 1, "head": (-1, 0),
             "smear": _sm(-22.5, 150, 1, (24, 31), 17, 5, fade=0.62, hot=False)},
            {"wrench": 170, "hands": ((16, 33), (21, 34)), "lean": -1, "bob": 1},
            {"wrench": 135, "hands": ((17, 33), (26, 33)), "lean": 0, "bob": 0},
            {"wrench": 112.5, "hands": ((17, 33), (30, 33)), "lean": 0, "bob": 0},
        ]
        for k in ks:
            k["wlayer"] = "front"
        winds = [(-0.3, 0), (-0.6, -0.2), (1.4, 0.4), (1.0, 0.2), (0.4, 0), (0, 0), (0, 0)]
    elif view == "up":
        ks = [
            {"wrench": -157.5, "hands": ((17, 30), (20, 30)), "lean": -1, "bob": 0},
            {"wrench": 180, "hands": ((16, 31), (19, 31)), "lean": -1, "bob": 1, "squash": 1,
             "stretch": (1.06, 0.95)},
            {"wrench": -45, "hands": ((28, 28), (26, 28)), "lean": 1, "bob": 0, "stretch": (1.08, 0.97),
             "smear": _sm(180, 315, 1, (24, 29), 17, 8)},
            {"wrench": -22.5, "hands": ((31, 30), (27, 30)), "lean": 1, "bob": 1,
             "smear": _sm(180, 330, 1, (24, 29), 17, 5, fade=0.62, hot=False)},
            {"wrench": -10, "hands": ((32, 30), (28, 31)), "lean": 1, "bob": 1},
            {"wrench": -45, "hands": ((30, 30), (22, 32)), "lean": 0, "bob": 0},
            {"wrench": -67.5, "hands": ((30, 31), (17, 33)), "lean": 0, "bob": 0},
        ]
        for k in ks:
            k["wlayer"] = "back"
        winds = [(0.3, 0.3), (0.6, 0.4), (-1.4, 0.6), (-1.0, 0.4), (-0.4, 0.2), (0, 0.1), (0, 0)]
    else:
        ks = [
            {"wrench": 67.5, "hands": ((28, 33), (25, 33)), "lean": 1, "bob": 0},
            {"wrench": 101.25, "hands": ((27, 34), (24, 34)), "lean": 0, "bob": 1, "squash": 1,
             "stretch": (1.04, 0.95)},
            {"wrench": -45, "hands": ((28, 27), (26, 28)), "lean": 2, "bob": -1, "head": (1, -1),
             "stretch": (0.96, 1.07), "airborne": True, "smear": _sm(101.25, -45, -1, (26, 31), 17, 8)},
            {"wrench": -67.5, "hands": ((27, 27), (25, 28)), "lean": 1, "bob": -1, "head": (0, -1),
             "smear": _sm(101.25, -60, -1, (26, 31), 17, 5, fade=0.62, hot=False)},
            {"wrench": -78.75, "hands": ((27, 27), (25, 28)), "lean": 1, "bob": -1},
            {"wrench": -56.25, "hands": ((26, 30), (23, 32)), "lean": 0, "bob": 0},
            {"wrench": -45, "hands": ((26, 31), (22, 33)), "lean": 0, "bob": 0},
        ]
        for i, k in enumerate(ks):
            k["side_legs"] = ("fwd", "back", 0) if i < 5 else ("stand", "back", 0)
            k["wlayer"] = "front"
        winds = [(-0.4, 0), (-0.6, 0.3), (-1.2, 1.2), (-1.0, 0.8), (-0.6, 0.3), (-0.2, 0), (-0.2, 0)]
    return render(view, ks, winds)


def attack3(view):
    # coup de tire-fond : anticipation marquée (accroupi, puis clé levée au
    # maximum, corps étiré), frappe au sol avec smear, écrasement, relevé
    if view == "down":
        ks = [
            {"wrench": -112.5, "hands": ((20, 29), (26, 29)), "bob": 1, "squash": 1, "stretch": (1.06, 0.94)},
            {"wrench": -100, "hands": ((21, 26), (25, 26)), "bob": 1, "squash": 1},
            {"wrench": -90, "hands": ((22, 22), (24, 22)), "bob": -1, "head": (0, -1), "wlayer": "back",
             "stretch": (0.95, 1.05)},
            {"wrench": -90, "hands": ((22, 20), (24, 20)), "bob": -2, "head": (0, -1), "wlayer": "back",
             "stretch": (0.93, 1.07)},
            {"wrench": 90, "hands": ((22, 33), (24, 33)), "bob": 2, "squash": 1, "stretch": (1.08, 0.94),
             "smear": _sm(-100, 90, 1, (23, 31), 17, 9)},
            {"wrench": 90, "hands": ((22, 34), (24, 34)), "bob": 2, "squash": 1, "stretch": (1.12, 0.9),
             "smear": _sm(-100, 90, 1, (23, 31), 17, 5, fade=0.7, hot=False)},
            {"wrench": 90, "hands": ((22, 34), (24, 34)), "bob": 2, "squash": 1},
            {"wrench": 90, "hands": ((22, 33), (24, 33)), "bob": 1},
            {"wrench": 112.5, "hands": ((20, 33), (29, 33)), "bob": 0},
        ]
        for k in ks:
            k.setdefault("wlayer", "front")
            k["feet"] = (42, 42)
            k["legs_x"] = (-1, 1) if k["bob"] >= 2 else (0, 0)
        winds = [(0.2, 0.2), (0.2, 0.4), (0, 1.0), (0, 1.2), (0.3, -2.0), (0.2, -1.2), (0, -0.4), (0, 0), (0, 0)]
    elif view == "up":
        ks = [
            {"wrench": 67.5, "hands": ((26, 30), (22, 30)), "bob": 1, "squash": 1, "wlayer": "top",
             "stretch": (1.06, 0.94)},
            {"wrench": 80, "hands": ((24, 25), (25, 25)), "bob": 0, "wlayer": "top"},
            {"wrench": 90, "hands": ((23, 21), (25, 21)), "bob": -1, "wlayer": "top", "stretch": (0.95, 1.05)},
            {"wrench": 90, "hands": ((23, 20), (25, 20)), "bob": -2, "wlayer": "top", "stretch": (0.93, 1.07)},
            {"wrench": -90, "hands": ((23, 26), (25, 26)), "bob": 2, "squash": 1, "wlayer": "back",
             "stretch": (1.08, 0.94), "smear": _sm(100, -90, -1, (24, 28), 17, 9)},
            {"wrench": -90, "hands": ((23, 27), (25, 27)), "bob": 2, "squash": 1, "wlayer": "back",
             "stretch": (1.12, 0.9), "smear": _sm(100, -90, -1, (24, 28), 17, 5, fade=0.7, hot=False)},
            {"wrench": -90, "hands": ((23, 27), (25, 27)), "bob": 2, "squash": 1, "wlayer": "back"},
            {"wrench": -90, "hands": ((23, 27), (25, 27)), "bob": 1, "wlayer": "back"},
            {"wrench": -67.5, "hands": ((29, 30), (18, 32)), "bob": 0, "wlayer": "back"},
        ]
        for k in ks:
            k["legs_x"] = (-1, 1) if k["bob"] >= 2 else (0, 0)
        winds = [(0.2, 0.2), (0.2, -0.2), (0, -0.8), (0, -1.0), (0.3, 2.0), (0.2, 1.2), (0, 0.5), (0, 0.2), (0, 0)]
    else:
        ks = [
            {"wrench": -112.5, "hands": ((22, 30), (21, 31)), "bob": 1, "lean": -1, "squash": 1,
             "stretch": (1.05, 0.95), "wlayer": "back"},
            {"wrench": -135, "hands": ((22, 26), (21, 27)), "bob": 0, "lean": -1, "wlayer": "back"},
            {"wrench": -157.5, "hands": ((22, 22), (21, 23)), "bob": -1, "lean": -2, "head": (-1, -1),
             "wlayer": "back", "stretch": (0.95, 1.05)},
            {"wrench": 180, "hands": ((22, 21), (21, 22)), "bob": -2, "lean": -3, "head": (-1, -1),
             "wlayer": "back", "stretch": (0.93, 1.07)},
            {"wrench": 45, "hands": ((30, 32), (28, 32)), "bob": 2, "lean": 3, "head": (1, 0), "squash": 1,
             "stretch": (1.1, 0.93), "smear": _sm(180, 45, 1, (25, 30), 17, 9)},
            {"wrench": 45, "hands": ((30, 33), (28, 33)), "bob": 2, "lean": 3, "head": (1, 0), "squash": 1,
             "stretch": (1.12, 0.9), "smear": _sm(180, 45, 1, (25, 30), 17, 5, fade=0.7, hot=False)},
            {"wrench": 45, "hands": ((30, 33), (28, 33)), "bob": 2, "lean": 3, "head": (1, 0), "squash": 1},
            {"wrench": 45, "hands": ((30, 33), (28, 33)), "bob": 1, "lean": 2, "head": (1, 0)},
            {"wrench": 67.5, "hands": ((27, 33), (23, 33)), "bob": 0, "lean": 1},
        ]
        for k in ks:
            k["side_legs"] = ("fwd", "back", 1) if k["bob"] >= 2 else ("fwd", "back", 0)
            k.setdefault("wlayer", "front")
        winds = [(0.3, 0), (0.6, 0.3), (0.9, 0.6), (1.0, 0.8), (-2.0, -1.0), (-1.4, -0.6), (-0.6, 0), (-0.3, 0),
                 (-0.2, 0)]
    return render(view, ks, winds)


def dash(view):
    if view == "down":
        ks = [
            {"bob": 1, "squash": 1, "hands": ((16, 33), (30, 33)), "wrench": -112.5, "feet": (42, 42),
             "stretch": (1.1, 0.92)},
            {"bob": 2, "squash": 1, "hands": ((17, 30), (30, 30)), "wrench": -135, "feet": (42, 40),
             "head": (0, 1), "stretch": (0.88, 1.14), "airborne": True},
            {"bob": 2, "squash": 1, "hands": ((17, 30), (30, 30)), "wrench": -135, "feet": (41, 40),
             "head": (0, 1), "stretch": (0.9, 1.12), "airborne": True},
            {"bob": 2, "squash": 1, "hands": ((17, 30), (30, 31)), "wrench": -128, "feet": (41, 41),
             "head": (0, 1), "stretch": (0.93, 1.08), "airborne": True},
            {"bob": 1, "hands": ((16, 31), (30, 32)), "wrench": -123.75, "feet": (42, 41), "stretch": (1.08, 0.94)},
            {"bob": 0, "hands": ((16, 32), (30, 33)), "wrench": -101.25, "feet": (42, 42)},
        ]
        for k in ks:
            k["wlayer"] = "front"
            k["hip"] = k["bob"]
    elif view == "up":
        ks = [
            {"bob": 1, "squash": 1, "hands": ((30, 33), (16, 33)), "wrench": -67.5, "feet": (42, 42),
             "stretch": (1.1, 0.92)},
            {"bob": -1, "hands": ((30, 33), (17, 34)), "wrench": -45, "feet": (40, 41), "head": (0, -1),
             "stretch": (0.88, 1.14), "airborne": True},
            {"bob": -1, "hands": ((30, 33), (17, 34)), "wrench": -45, "feet": (41, 40), "head": (0, -1),
             "stretch": (0.9, 1.12), "airborne": True},
            {"bob": -1, "hands": ((30, 33), (17, 34)), "wrench": -50, "feet": (41, 41), "head": (0, -1),
             "stretch": (0.93, 1.08), "airborne": True},
            {"bob": 0, "hands": ((30, 32), (16, 33)), "wrench": -56.25, "feet": (42, 41), "stretch": (1.08, 0.94)},
            {"bob": 0, "hands": ((30, 32), (16, 33)), "wrench": -78.75, "feet": (42, 42)},
        ]
        for k in ks:
            k["wlayer"] = "back"
            k["hip"] = k["bob"]
    else:
        ks = [
            {"bob": 1, "lean": -1, "squash": 1, "side_legs": ("fwd", "back", 1), "hands": ((24, 32), (21, 33)),
             "wrench": -22.5, "stretch": (0.94, 1.02)},
            {"bob": 2, "lean": 3, "head": (2, 1), "side_legs": ("fwd", "liftback", 1), "hands": ((29, 33), (25, 34)),
             "wrench": -11.25, "stretch": (1.18, 0.92), "airborne": True},
            {"bob": 2, "lean": 3, "head": (2, 1), "side_legs": ("fwdair", "liftback", 1),
             "hands": ((29, 33), (25, 34)), "wrench": -11.25, "stretch": (1.2, 0.9), "airborne": True},
            {"bob": 2, "lean": 3, "head": (2, 1), "side_legs": ("fwdair", "liftback", 1),
             "hands": ((29, 33), (25, 34)), "wrench": -15, "stretch": (1.12, 0.94), "airborne": True},
            {"bob": 1, "lean": 1, "head": (1, 0), "side_legs": ("fwd", "back", 1), "hands": ((27, 32), (23, 33)),
             "wrench": -33.75, "stretch": (0.95, 1.03)},
            {"bob": 0, "lean": 0, "side_legs": ("stand", "back", 0), "hands": ((26, 32), (22, 33)),
             "wrench": -56.25},
        ]
    w = _wind(view, 1.0)
    winds = [(w[0] * k, w[1] * k) for k in (0.3, 2.6, 2.8, 2.4, 0.8, 0.3)]

    def post(i, f):
        return _speed_lines(f, view) if i in (1, 2, 3) else f

    return render(view, ks, winds, post=post)


def _speed_lines(f, view):
    """Traînée du dash : lignes de vitesse blanc -> ambre -> orange derrière le corps."""
    out = f.copy()
    m = f > 0
    cols = ("W", "Z", "y", "a", "O")
    if view == "side":
        rows = [y for y in range(18, 43) if m[y].any()]
        for j, y in enumerate(rows[1::3]):
            xs = np.nonzero(m[y])[0]
            x0 = xs.min()
            ln = 6 + (j % 3) * 3
            for x in range(max(0, x0 - ln), x0 - 1):
                k = int((x0 - 1 - x) / max(1, ln) * len(cols))
                out[y, x] = c[cols[min(len(cols) - 1, k)]]
    else:
        xs_ = [x for x in range(14, 34) if m[:, x].any()]
        for j, x in enumerate(xs_[1::3]):
            ys = np.nonzero(m[:, x])[0]
            y0 = ys.min() if view == "down" else ys.max()
            ln = 4 + (j % 3) * 2
            rng_ = range(max(0, y0 - ln), y0 - 1) if view == "down" else range(y0 + 2, min(47, y0 + ln))
            for y in rng_:
                k = int(abs(y - y0) / max(1, ln) * len(cols))
                out[y, x] = c[cols[min(len(cols) - 1, k)]]
    return out


def hurt(view):
    # impact (écrasé), recul max (étiré), retour, stabilisation
    seq = [(1, 2, (1.08, 0.92)), (0, 2, (0.95, 1.05)), (0, 1, (1.0, 1.0)), (0, 0, (1.0, 1.0))]
    Ps = []
    for i, (dy, back, st) in enumerate(seq):
        P = {"bob": dy, "face": "hurt" if i < 3 else "normal", "stretch": st}
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
                      "wrench": 112.5 + 11.25 * back,
                      "side_legs": ("stand", "back", 0) if i < 3 else ("stand", "stand", 0)})
        Ps.append(P)
    w = {"side": (1.6, -0.4), "down": (0, -1.4), "up": (0, 1.4)}[view]
    winds = [(w[0] * k, w[1] * k) for k in (1.0, 0.8, 0.3, 0.0)]
    return render(view, Ps, winds)


# ---------------- animations mono-direction (down)

def _seated(stage):
    """Héros assis par terre, vu de face (fin de l'anim de mort)."""
    a = canvas(S)
    # jambes allongées vers la caméra
    legs = parse(
        """
        .iiiiiiiiinn.
        Iiiiin.iiinnn
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
    frames += render("down", seq, [(0.2, 0.0)] * 6)
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
                "raw": True,
            },
        )
        seat = _seated(0)
        blit(a, seat, 0, 0)
        a = lib.outline(a)
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
            KfOOoKK
            KiiiiKq
            .KKKK..
            """
        )
        blit(a, th, 8, 38)
        a = modern.shade(a, ground=FOOT)
        if i >= 3:
            puddle = [(14, 41), (15, 41), (14, 42), (15, 42), (16, 42), (13, 42)][: 2 + i]
            for (x, y) in puddle:
                if a[y, x] == 0:
                    a[y, x] = c["h"]
        frames.append(a)
    return frames


def spawn():
    """Prise de poste : colonne de lumière, silhouette ambre qui se matérialise,
    clé plantée (6)."""
    frames = []
    base = frame("down", {"hands": ((22, 23), (25, 23)), "wrench": -90, "wlayer": "top", "bob": 0})
    land = frame("down", {"hands": ((22, 31), (25, 31)), "wrench": 90, "bob": 2, "squash": 1, "hip": 2,
                          "wlayer": "front", "stretch": (1.12, 0.9)})
    planted = frame("down", {"hands": ((22, 32), (25, 32)), "wrench": 90, "bob": 1, "hip": 1})
    rest = idle("down")[0]
    m = base > 0
    for i in range(10):
        if i < 4:
            f = canvas(S)
            if i < 2:
                w = 2 if i == 0 else 4
                lib.rect(f, CX - w - 2, 2, 2 * w + 4, 42, c["O"])
                lib.rect(f, CX - w - 1, 2, 2 * w + 2, 42, c["a"])
                lib.rect(f, CX - w, 2, 2 * w, 42, c["y"])
                lib.rect(f, CX - 1, 2, 2, 42, c["W"])
            else:
                f[m] = c["a"] if i == 2 else c["Z"]
                core = np.zeros_like(m)
                core[:, CX - 3 : CX + 3] = True
                f[m & core] = c["W"]
                if i == 2:
                    lib.rect(f, CX - 1, 0, 2, 18, c["y"])
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
    out[m & ~rr] = c["Z"]
    return out


def special():
    """Préavis de grève : coup de sifflet + clé plantée -> onde (active 4)."""
    seq = [
        {"bob": 1, "squash": 1, "hands": ((17, 30), (26, 29)), "wrench": -112.5, "stretch": (1.05, 0.95)},
        {"bob": 1, "squash": 1, "hands": ((19, 27), (26, 28)), "wrench": -90, "wlayer": "back"},
        {"bob": 0, "hands": ((21, 21), (26, 27)), "wrench": -90, "wlayer": "back", "head": (0, -1),
         "stretch": (0.96, 1.04)},
        {"bob": -2, "hands": ((22, 18), (26, 27)), "wrench": -90, "wlayer": "back", "head": (0, -1),
         "stretch": (0.93, 1.07)},
        {"bob": 2, "squash": 1, "hands": ((22, 33), (26, 27)), "wrench": 90, "stretch": (1.1, 0.92),
         "smear": _sm(-100, 90, 1, (23, 31), 17, 9)},
        {"bob": 2, "squash": 1, "hands": ((22, 34), (26, 27)), "wrench": 90, "stretch": (1.12, 0.9)},
        {"bob": 1, "hands": ((22, 33), (26, 27)), "wrench": 90},
        {"bob": 1, "hands": ((22, 33), (26, 27)), "wrench": 90},
        {"bob": 0, "hands": ((22, 33), (26, 28)), "wrench": 90},
        {"bob": 0, "hands": ((21, 33), (28, 31)), "wrench": 101.25},
        {"bob": 0, "hands": ((19, 33), (30, 33)), "wrench": 112.5},
        {"bob": 0, "hands": ((16, 32), (30, 33)), "wrench": -101.25},
    ]
    for k in seq:
        k.setdefault("wlayer", "front")
        k["hip"] = max(0, k["bob"])
        k["feet"] = (42, 42)
    winds = [(0.2, 0.3), (0.2, 0.5), (0, 0.8), (0, 1.0), (0.4, -2.2), (0.3, -1.6), (0.2, -1.0), (0.1, -0.6),
             (0, -0.3), (0, 0), (0, 0), (0, 0)]

    def post(i, f):
        if 2 <= i <= 8:
            k = seq[i]
            wy = 25 + k["bob"] + k.get("head", (0, 0))[1]
            for (x, y, col) in ((24, wy + 1, "a"), (25, wy + 1, "y"), (26, wy + 1, "a")):
                f[y, x] = c[col]
            if 4 <= i <= 7:
                for j, (x, y) in enumerate(((28, wy - 2), (29, wy - 3), (30, wy - 3), (31, wy - 2), (29, wy + 3),
                                            (30, wy + 4), (31, wy + 4))):
                    if f[y, x] == 0:
                        f[y, x] = c["y"] if j % 2 else c["W"]
        return f

    return render("down", seq, winds, post=post)


PIVOT = (24, 44)


def build(emit):
    D3 = ("down", "up", "side")
    for v in D3:
        emit("player", f"player_idle_{v}_strip8", idle(v), [140] * 8, loop=True)
        emit("player", f"player_run_{v}_strip10", run(v), [64] * 10, loop=True,
             events={"footstep": [0, 5]})
        # startup 90 / active 60 / recovery 160 (le moteur recale sur le GDD)
        emit("player", f"player_attack1_{v}_strip7", attack1(v), [40, 50, 60, 40, 40, 40, 40], active=[2],
             events={"comboWindow": 4, "smear": [2, 3]})
        emit("player", f"player_attack2_{v}_strip7", attack2(v), [40, 40, 60, 40, 40, 40, 50], active=[2],
             events={"comboWindow": 4, "smear": [2, 3]})
        # startup 200 / active 80 / recovery 320
        emit("player", f"player_attack3_{v}_strip9", attack3(v), [60, 50, 50, 40, 80, 100, 90, 70, 60], active=[4],
             events={"vfx": {"4": "vfx_slam"}, "shake": {"frame": 4, "px": 2, "ms": 100}, "hitstop": 60,
                     "smear": [4, 5]})
        emit("player", f"player_dash_{v}_strip6", dash(v), [20, 25, 25, 25, 25, 20],
             events={"invulnerable": [0, 1, 2, 3, 4]})
        emit("player", f"player_hurt_{v}_strip4", hurt(v), [50, 60, 60, 70])
    emit("player", "player_death_strip12", death(), [100] * 11 + [400])
    emit("player", "player_spawn_strip10", spawn(), [80] * 9 + [120], events={"vfx": {"6": "vfx_dust-land"}})
    emit("player", "player_special_strip12", special(),
         [100, 100, 100, 100, 40, 60, 80, 80, 100, 100, 100, 120], active=[4],
         events={"vfx": {"0": "vfx_charge", "4": "vfx_shockwave"}})
