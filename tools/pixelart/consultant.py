"""Consultant Junior « Slide-Ninja » : costume slim bleu trop court, cheveux
gominés, cravate et badge turquoise, baskets blanches, tablette. 32×32,
pivot (16, 28)."""
import numpy as np

import lib
from humanoid import Humanoid, dissolve
from lib import parse, canvas, blit
from palette import CHAR

c = CHAR
S = 32
F = 26

HEADS = {
    "down": parse(
        """
        ..dddd..
        .dssdddd
        dsssdddd
        ddsppppd
        dpKppKpd
        .ppppzz.
        ..zmmz..
        """
    ),
    "up": parse(
        """
        ..dddd..
        .dssdddd
        dsssdddd
        dssddddd
        ddddddKd
        .ddddddd.
        ..zzzz..
        """
    ),
    "side": parse(
        """
        .dddd...
        dssdddd.
        dssdddd.
        ddddppp.
        ddzpKpp.
        .dzpppzp
        ..zzmz..
        """
    ),
}
TORSOS = {
    "down": parse(
        """
        .IiwwiI.
        IiiwTwiin
        IiiwTwii
        IiiwTwin
        IiiiTiin
        IIiwwwin
        .ssss.ss
        """
    ),
    "up": parse(
        """
        .IiiiiI.
        Iiiiiiin
        Iiiiiiin
        Iiiiiinn
        Iiiiiinn
        IIiiiinn
        .ssss.ss
        """
    ),
    "side": parse(
        """
        .Iiii.
        IiiiwT
        IiiiwT
        IiiiwT
        Iiiiin
        IIiiwn
        .sss.s
        """
    ),
}
for k in TORSOS:
    t = TORSOS[k]
    if t.shape[1] > 8:
        TORSOS[k] = t[:, :8]

BODY = Humanoid(S, F, HEADS, TORSOS, leg_len=8, leg_w=3, gap=2, pants=("I", "i", "n"),
                shoes=("W", "w", "b"), sleeve=("i", "n"), hand=("p", "z"), neck=1, side_torso_dx=0)


def tablet(screen="T", shine=False, tilt=0):
    def draw(layer, hand, P):
        x, y = hand
        t = canvas(7, 5)
        lib.rect(t, 0, 0, 6, 5, c["d"])
        lib.rect(t, 1, 1, 4, 3, c[screen])
        if screen == "T":
            lib.px(t, 1, 1, c["N"])
        if shine:
            lib.rect(t, 1, 1, 4, 3, c["W"])
            lib.px(t, 4, 3, c["N"])
        if tilt:
            t = lib.rot90(t, tilt)
        blit(layer, t, x - 2, y)
    return draw


def _hold(view, bob=0):
    if view == "down":
        return ((10, 18 + bob), (20, 18 + bob))
    if view == "up":
        return ((20, 18 + bob), (10, 18 + bob))
    return ((17, 18 + bob), (13, 18 + bob))


def idle(view):
    out = []
    for i, b in enumerate([0, 0, 1, 1]):
        P = {"bob": b, "hands": _hold(view, b), "item": tablet(), "item_layer": "back" if view == "up" else "top"}
        if view == "side":
            P["stride"] = 1
        out.append(BODY.frame(view, P))
    return out


def run(view):
    """Course 8 frames : contact, appui (écrasé), passage, suspension (étiré)."""
    import math

    out = []
    n = 8
    for i in range(n):
        p = i / n
        bob = [0, 1, 0, -1][i % 4]
        sw = math.cos(2 * math.pi * p)
        if view == "side":
            P = {"bob": bob, "phase": p, "stride": 3, "lean": 1,
                 "hands": ((18, 17 + bob), (13 + int(round(2 * sw)), 18 + bob))}
            if bob == -1:
                P["head"] = (0, -1)
        else:
            lift_l = int(round(2 * max(0.0, math.sin(2 * math.pi * p))))
            lift_r = int(round(2 * max(0.0, math.sin(2 * math.pi * (p + 0.5)))))
            P = {"bob": bob, "feet": (F - lift_l, F - lift_r) if view == "down" else (F - lift_r, F - lift_l)}
            h = _hold(view, bob)
            d = int(round(sw))
            P["hands"] = ((h[0][0], h[0][1] - d), (h[1][0], h[1][1] + d))
            if bob == -1:
                P["head"] = (0, -1)
        P["item"] = tablet()
        P["item_layer"] = "back" if view == "up" else "top"
        out.append(BODY.frame(view, P))
    return out


def _deck_smear(view, fade=0.0):
    """Smear du « diaporama » : la tablette laisse une traînée en croissant,
    magenta (ça blesse) à cœur blanc, avec des slides turquoise qui s'en
    détachent. fade > 0 : seule la tête de la traînée subsiste."""
    if view == "side":
        cx, cy, a0, a1, d, r, w = 12, 17, 200, 350, 1, 11, 5
    elif view == "down":
        cx, cy, a0, a1, d, r, w = 15, 17, -150, 60, 1, 12, 5
    else:
        cx, cy, a0, a1, d, r, w = 16, 14, 10, -190, -1, 11, 5
    dist, ang = lib.polar((S, S), cx, cy)
    rel = ((ang - a0) * d) % 360
    span = ((a1 - a0) * d) % 360
    t = rel / span
    inside = (rel <= span) & (t >= fade)
    tt = np.clip((t - fade) / max(0.01, 1 - fade), 0, 1)
    thick = w * (0.3 + 0.7 * tt)
    band = inside & (dist <= r) & (dist > r - thick)
    rr = (r - dist) / np.maximum(thick, 0.01)
    sm = canvas(S)
    for col, lo in (("k", 0.0), ("W", 0.2), ("M", 0.55), ("J", 0.8)):
        sm[band & (rr >= lo)] = c[col]
    sm[band & (tt < 0.4) & (((dist.astype(int) + (rel / 10).astype(int)) % 3) == 0)] = 0
    # slides qui se détachent de la traînée
    import math

    for j, f in enumerate((0.2, 0.5, 0.8)):
        if f < fade:
            continue
        aa = math.radians(a0 + d * span * f)
        rad = r + 2 + (j % 2) * 2
        x, y = int(cx + math.cos(aa) * rad) - 2, int(cy + math.sin(aa) * rad) - 1
        lib.rect(sm, x, y, 4, 3, c["T"])
        lib.rect(sm, x, y, 4, 1, c["N"])
        lib.px(sm, x, y, c["W"])
        lib.px(sm, x + 3, y + 2, c["t"])
    return sm


def _under(a, layer):
    m = (a == 0) & (layer > 0)
    a[m] = layer[m]


def attack(view):
    """Préparation (cravate, reflet, armé : télégraphe magenta), ruée avec
    smear du diaporama (active 4), follow-through, freinage, retour."""
    out = []
    if view == "down":
        seq = [
            {"bob": 1, "hands": ((13, 13), (17, 13)), "item": tablet()},  # ajuste la cravate
            {"bob": 1, "hands": ((10, 15), (16, 13)), "item": tablet(), "head": (0, 1)},
            {"bob": 0, "hands": ((9, 13), (20, 17)), "item": tablet(shine=True)},  # reflet
            {"bob": 2, "hands": ((9, 11), (20, 17)), "item": tablet("M"), "head": (0, 1), "st": (1.08, 0.92)},
            {"bob": 1, "hands": ((19, 21), (12, 16)), "item": tablet("M", tilt=1), "spread": 1, "smear": 0.0,
             "st": (0.92, 1.12)},
            {"bob": 2, "hands": ((20, 21), (11, 17)), "item": tablet("M", tilt=1), "spread": 1, "smear": 0.55},
            {"bob": 2, "hands": ((19, 20), (11, 18)), "item": tablet(tilt=1), "spread": 1, "st": (1.06, 0.94)},
            {"bob": 1, "hands": ((10, 19), (20, 19)), "item": tablet(), "head": (0, 1)},
        ]
    elif view == "up":
        seq = [
            {"bob": 1, "hands": ((17, 13), (13, 13)), "item": tablet(), "item_layer": "back"},
            {"bob": 1, "hands": ((20, 15), (14, 13)), "item": tablet(), "item_layer": "back"},
            {"bob": 0, "hands": ((21, 12), (10, 17)), "item": tablet(shine=True), "item_layer": "back"},
            {"bob": 2, "hands": ((21, 14), (10, 17)), "item": tablet("M"), "item_layer": "back",
             "st": (1.08, 0.92)},
            {"bob": -1, "hands": ((11, 9), (19, 16)), "item": tablet("M", tilt=1), "item_layer": "back",
             "smear": 0.0, "st": (0.92, 1.12)},
            {"bob": -1, "hands": ((10, 10), (20, 17)), "item": tablet("M", tilt=1), "item_layer": "back",
             "smear": 0.55},
            {"bob": 0, "hands": ((12, 12), (20, 18)), "item": tablet(tilt=1), "item_layer": "back",
             "st": (1.06, 0.94)},
            {"bob": 1, "hands": ((20, 19), (10, 19)), "item": tablet(), "item_layer": "back"},
        ]
    else:
        seq = [
            {"bob": 1, "hands": ((16, 13), (14, 14)), "item": tablet(), "lean": -1, "stride": 2},
            {"bob": 1, "hands": ((12, 15), (14, 14)), "item": tablet(), "lean": -1, "stride": 2},
            {"bob": 0, "hands": ((11, 13), (15, 16)), "item": tablet(shine=True), "lean": -1, "stride": 2,
             "item_layer": "back"},
            {"bob": 2, "hands": ((10, 14), (14, 17)), "item": tablet("M"), "lean": -2, "stride": 2,
             "item_layer": "back", "st": (0.9, 1.0)},
            {"bob": 1, "hands": ((22, 15), (14, 17)), "item": tablet("M"), "lean": 2, "phase": 0.0, "stride": 4,
             "smear": 0.0, "st": (1.16, 0.94)},
            {"bob": 1, "hands": ((22, 17), (15, 18)), "item": tablet("M"), "lean": 2, "phase": 0.0, "stride": 4,
             "smear": 0.5},
            {"bob": 2, "hands": ((21, 18), (14, 18)), "item": tablet(), "lean": 1, "phase": 0.0, "stride": 3,
             "st": (0.94, 1.0)},
            {"bob": 1, "hands": ((18, 19), (13, 19)), "item": tablet(), "lean": 0, "head": (0, 1), "stride": 2},
        ]
    for k in seq:
        k.setdefault("item_layer", "top")
        sm = k.pop("smear", None)
        st = k.pop("st", None)
        if st:
            k["stretch"] = st
        f = BODY.frame(view, k)
        if sm is not None:
            _under(f, _deck_smear(view, sm))
        out.append(f)
    return out


def hurt(view):
    out = []
    for i in range(2):
        P = {"bob": 1 - i, "head": ((-1 if view == "side" else 0), -1 + i), "hands": None,
             "item": tablet(), "lean": -1 if view == "side" else 0,
             "item_layer": "back" if view == "up" else "top"}
        if view != "up":
            P["head_art"] = _dizzy(view) if i == 0 else HEADS[view]
        out.append(BODY.frame(view, P))
    return out


def _dizzy(view):
    h = HEADS[view].copy()
    if view == "down":
        h[4, 2] = c["p"]
        h[4, 5] = c["p"]
        h[3:5, 2] = c["K"]
        h[3:5, 5] = c["K"]
        h[6, 3:5] = c["K"]
    else:
        h[4, 4] = c["p"]
        h[3:5, 4] = c["K"]
    return h


def death():
    """Recule, tombe sur le dos, se dissout en slides : la tablette reste au sol."""
    out = []
    side = BODY.frame("side", {"item": None, "stride": 1, "head_art": _dizzy("side")})
    lying = lib.rot90(side, -1)  # tête à gauche
    lying = lib.shift(lying, 0, 10)
    tab = canvas(S)
    tablet("d")(tab, (21, 25), {})
    tab = lib.outline(tab)
    tab_cracked = tab.copy()
    for (x, y) in ((21, 25), (22, 26), (23, 25)):
        tab_cracked[y, x] = c["T"]
    seq = []
    seq.append(BODY.frame("down", {"bob": 0, "head": (0, -1), "head_art": _dizzy("down"), "item": tablet(),
                                   "hands": ((9, 14), (21, 14))}))
    seq.append(BODY.frame("down", {"bob": 1, "head": (1, -1), "lean": 1, "head_art": _dizzy("down"),
                                   "item": tablet(tilt=1), "hands": ((8, 12), (22, 13)), "feet": (F, F - 1)}))
    f = BODY.frame("down", {"bob": 3, "head": (0, 1), "head_art": _dizzy("down"), "hands": ((10, 20), (21, 20)),
                            "feet": (F, F)})
    f2 = f.copy()
    blit(f2, tab, 0, 0)
    seq.append(f2)
    # chute
    mid = lib.shift(lib.rot90(side, -1), 0, 6)
    mid = np.where(mid > 0, mid, 0).astype(np.uint8)
    f3 = canvas(S)
    blit(f3, lib.shift(lying, 0, -3), 0, 0)
    blit(f3, tab_cracked, 0, 0)
    seq.append(f3)
    f4 = canvas(S)
    blit(f4, lying, 0, 0)
    blit(f4, tab_cracked, 0, 0)
    seq.append(f4)
    for i, amt in enumerate((0.25, 0.55, 0.85)):
        d = dissolve(lying, amt, seed=7 + i, into=c["T"])
        # les slides montent
        sl = canvas(S)
        for j in range(3 + i):
            x, y = 6 + j * 5 + i, 18 - i * 3 - (j % 2) * 2
            lib.rect(sl, x, y, 3, 2, c["T" if j % 2 else "N"])
            lib.px(sl, x, y, c["W"])
        f = canvas(S)
        blit(f, d, 0, 0)
        blit(f, tab_cracked, 0, 0)
        blit(f, sl, 0, 0)
        seq.append(f)
    return seq


def build(emit):
    for v in ("down", "up", "side"):
        emit("enemies", f"consultant_idle_{v}_strip4", idle(v), 150, loop=True)
        emit("enemies", f"consultant_run_{v}_strip8", run(v), 68, loop=True, events={"footstep": [0, 4]})
        emit("enemies", f"consultant_attack_{v}_strip8", attack(v), [120, 120, 120, 90, 40, 60, 80, 100], active=[4],
             events={"telegraph": [0, 1, 2, 3], "warnFlash": 2, "smear": [4, 5]})
        emit("enemies", f"consultant_hurt_{v}_strip2", hurt(v), 80)
    emit("enemies", "consultant_death_strip8", death(), 80, events={"vfx": {"5": "vfx_poof"}})
