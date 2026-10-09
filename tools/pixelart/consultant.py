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


RUN6 = [(F, F - 1, 0), (F, F - 2, 1), (F - 1, F - 1, -1), (F - 1, F, 0), (F - 2, F, 1), (F - 1, F - 1, -1)]


def run(view):
    out = []
    for i in range(6):
        lf, rf, bob = RUN6[i]
        if view == "side":
            P = {"bob": max(-1, bob - 0), "phase": i / 6, "stride": 3, "lean": 1,
                 "hands": ((18, 17 + bob), (13 + (2 if i < 3 else -1), 18 + bob))}
        else:
            sw = 1 if i < 3 else -1
            P = {"bob": bob, "feet": (lf, rf) if view == "down" else (rf, lf)}
            h = _hold(view, bob)
            P["hands"] = ((h[0][0], h[0][1] - sw), (h[1][0], h[1][1] + sw))
        P["item"] = tablet()
        P["item_layer"] = "back" if view == "up" else "top"
        out.append(BODY.frame(view, P))
    return out


def _slides_trail(a, view, n=3, col=("T", "N")):
    """Traînée de slides turquoise derrière la ruée."""
    for j in range(n):
        if view == "side":
            x, y = 2 + j * 4, 13 + (j % 2) * 4
            lib.rect(a, x, y, 3, 2, c[col[j % 2]])
            lib.px(a, x, y, c["W"])
        elif view == "down":
            x, y = 10 + j * 5, 1 + (j % 2) * 2
            lib.rect(a, x, y, 3, 2, c[col[j % 2]])
            lib.px(a, x, y, c["W"])
        else:
            x, y = 10 + j * 5, 28 - (j % 2) * 2
            lib.rect(a, x, y, 3, 2, c[col[j % 2]])
            lib.px(a, x, y, c["W"])


def attack(view):
    out = []
    if view == "down":
        seq = [
            {"bob": 1, "hands": ((13, 13), (17, 13)), "item": tablet()},  # ajuste la cravate
            {"bob": 1, "hands": ((10, 15), (16, 13)), "item": tablet(), "head": (0, 1)},
            {"bob": 0, "hands": ((9, 13), (20, 17)), "item": tablet(shine=True)},  # reflet
            {"bob": 2, "hands": ((19, 21), (12, 16)), "item": tablet("M", tilt=1), "spread": 1, "lunge": True},
            {"bob": 2, "hands": ((20, 21), (11, 17)), "item": tablet("M", tilt=1), "spread": 1},
            {"bob": 1, "hands": ((10, 19), (20, 19)), "item": tablet(), "head": (0, 1)},
        ]
    elif view == "up":
        seq = [
            {"bob": 1, "hands": ((17, 13), (13, 13)), "item": tablet(), "item_layer": "back"},
            {"bob": 1, "hands": ((20, 15), (14, 13)), "item": tablet(), "item_layer": "back"},
            {"bob": 0, "hands": ((21, 12), (10, 17)), "item": tablet(shine=True), "item_layer": "back"},
            {"bob": -1, "hands": ((11, 9), (19, 16)), "item": tablet("M", tilt=1), "item_layer": "back",
             "lunge": True},
            {"bob": -1, "hands": ((10, 10), (20, 17)), "item": tablet("M", tilt=1), "item_layer": "back"},
            {"bob": 1, "hands": ((20, 19), (10, 19)), "item": tablet(), "item_layer": "back"},
        ]
    else:
        seq = [
            {"bob": 1, "hands": ((16, 13), (14, 14)), "item": tablet(), "lean": -1, "stride": 2},
            {"bob": 1, "hands": ((12, 15), (14, 14)), "item": tablet(), "lean": -1, "stride": 2},
            {"bob": 0, "hands": ((11, 13), (15, 16)), "item": tablet(shine=True), "lean": -1, "stride": 2,
             "item_layer": "back"},
            {"bob": 1, "hands": ((22, 15), (14, 17)), "item": tablet("M"), "lean": 2, "phase": 0.0, "stride": 4,
             "lunge": True},
            {"bob": 1, "hands": ((22, 17), (15, 18)), "item": tablet("M"), "lean": 2, "phase": 0.0, "stride": 4},
            {"bob": 1, "hands": ((18, 19), (13, 19)), "item": tablet(), "lean": 0, "head": (0, 1), "stride": 2},
        ]
    for k in seq:
        k.setdefault("item_layer", "top")
        lunge = k.pop("lunge", False)
        f = BODY.frame(view, k)
        if lunge:
            _slides_trail(f, view)
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
        emit("enemies", f"consultant_run_{v}_strip6", run(v), 90, loop=True)
        emit("enemies", f"consultant_attack_{v}_strip6", attack(v), [120, 120, 120, 40, 60, 100], active=[3],
             events={"telegraph": [0, 1, 2], "warnFlash": 2})
        emit("enemies", f"consultant_hurt_{v}_strip2", hurt(v), 80)
    emit("enemies", "consultant_death_strip8", death(), 80, events={"vfx": {"5": "vfx_poof"}})
