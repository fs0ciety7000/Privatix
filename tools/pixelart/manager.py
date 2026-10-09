"""Manager KPI « Le Tableur » (élite 48×48, pivot (24, 44)) : grand, chemise
blanche rentrée, cravate turquoise, lunettes, chronomètre géant au cou,
tablette brandie comme un sceptre, hologramme de graphiques."""
import numpy as np

import lib
from humanoid import Humanoid, dissolve
from lib import parse, canvas, blit
from palette import CHAR

c = CHAR
S = 48
F = 42

HEADS = {
    "down": parse(
        """
        ...zppppz...
        ..pqqppppz..
        .gpqpppppzg.
        .gppppppzzg.
        gpppppppppzg
        gpKKKppKKKzg
        gpNNKzpKNNzg
        .ppKKzzKKpz.
        .zppppppppz.
        ..zpmmmmpz..
        ...zzzzzz...
        """
    ),
    "up": parse(
        """
        ...zppppz...
        ..pqqppppz..
        .gpqpppppzg.
        .gppppppzzg.
        ggpppppppzgg
        ggppppppzzgg
        zggpppppzggz
        zgggppzzgggz
        .gggggggggg.
        ..gggggggg..
        ...zzzzzz...
        """
    ),
    "side": parse(
        """
        ..zpppppz...
        .pqqppppp...
        gpqppppppz..
        gpppppppppz.
        ggpppppppppz
        ggpppzKKKKp.
        ggzppKNNNKp.
        .gzppzKKKpp.
        .gzppppppzp.
        ..zzppmmpz..
        ...zzzzzz...
        """
    ),
}
TORSOS = {
    "down": parse(
        """
        ..bwwwTTwwwb..
        .bwwwwTTwwwwbg
        bwwwwTuuTwwwwg
        bwwwTbbbbTwwbg
        bwwwbwWwwbwwbg
        bwwwbwKwwbwwbg
        bwwwbwwKKbwbbg
        bwwwwbbbbwwbbg
        bwwwwwTTwwwbbg
        bwwwwwTTwwwbbg
        bwwwwwTuwwbbgg
        KdKKKKNKKKKKKd
        .ggggggggggss.
        """
    ),
    "up": parse(
        """
        ..bwwwwwwwwb..
        .bwwwwwwwwwwbg
        bwwwwTwwTwwwbg
        bwwwwwTTwwwbbg
        bwwwwwwwwwwbbg
        bwwwwwwwwwwbbg
        bwwwwwwwwwbbbg
        bwwwwwwwwwbbbg
        bwwwwwwwwwbbgg
        bwwwwwwwwbbbgg
        bwwwwwwwwbbggg
        KdKKKKKKKKKKKd
        .ggggggggggss.
        """
    ),
    "side": parse(
        """
        .bwwwwwT.
        bwwwwwwTT
        bwwwwwbbbb
        bwwwwbwWwb
        bwwwwbwKwb
        bwwwwbwwKb
        bwwwwwbbbb
        bwwwwwwwTT
        bwwwwwwwTT
        bwwwwwwbTu
        bwwwwwbbbg
        KdKKKKKKKd
        .ggggggss.
        """
    ),
}
BODY = Humanoid(S, F, HEADS, TORSOS, leg_len=13, leg_w=5, gap=2, pants=("g", "s", "d"), shoes=("s", "d", "K"),
                sleeve=("w", "b"), hand=("p", "z"), neck=2, arm_w=3, hand_size=3)


def tablet(screen="T", shine=False):
    def draw(layer, hand, P):
        x, y = hand
        t = canvas(9, 7)
        lib.rect(t, 0, 0, 9, 7, c["d"])
        lib.rect(t, 1, 1, 7, 5, c["u"])
        for i, h in enumerate((2, 4, 3, 5)):
            lib.rect(t, 1 + i * 2, 6 - h, 1, h, c[screen] if screen != "T" else c["N" if i == 3 else "T"])
        if shine:
            lib.rect(t, 1, 1, 7, 5, c["W"])
        blit(layer, t, x - 3, y - 6)
    return draw


def hologram(a, x, y, t, col=("T", "N")):
    """Graphique en barres holographique flottant (sans contour)."""
    hs = [3 + (t + i * 2) % 4 for i in range(4)]
    for i, h in enumerate(hs):
        for yy in range(y - h, y):
            if 0 <= yy < S and a[yy, x + i * 2] == 0:
                a[yy, x + i * 2] = c[col[0]]
        if a[y - h - 1, x + i * 2] == 0:
            a[y - h - 1, x + i * 2] = c[col[1]]
    for i in range(8):
        if a[y, x + i] == 0:
            a[y, x + i] = c["u"]


def _hold(view, b=0):
    if view == "down":
        return ((14, 33 + b), (32, 33 + b))
    if view == "up":
        return ((32, 33 + b), (14, 33 + b))
    return ((26, 32 + b), (21, 33 + b))


def _holo(view, t, dy=0):
    def ov(a, g):
        if view == "down":
            hologram(a, 33, 17 + dy, t)
        elif view == "up":
            hologram(a, 8, 17 + dy, t)
        else:
            hologram(a, 32, 18 + dy, t)
    return ov


def idle(view):
    out = []
    for i, b in enumerate((0, 0, 1, 1)):
        P = {"bob": b, "hands": _hold(view, b), "item": tablet(), "overlay": _holo(view, i, b),
             "item_layer": "back" if view == "up" else "top", "stride": 1}
        out.append(BODY.frame(view, P))
    return out


WALK6 = [(F, F - 1, 0), (F, F - 2, 1), (F - 1, F - 1, 0), (F - 1, F, 0), (F - 2, F, 1), (F - 1, F - 1, 0)]


def walk(view):
    out = []
    for i in range(6):
        lf, rf, b = WALK6[i]
        sw = 1 if i < 3 else -1
        h = _hold(view, b)
        if view == "side":
            P = {"bob": b, "phase": i / 6, "stride": 4, "hands": (h[0], (h[1][0] - 2 * sw, h[1][1]))}
        else:
            P = {"bob": b, "feet": (lf, rf) if view == "down" else (rf, lf),
                 "hands": ((h[0][0], h[0][1] - sw), (h[1][0], h[1][1] + sw))}
        P.update({"item": tablet(), "overlay": _holo(view, i, b), "item_layer": "back" if view == "up" else "top"})
        out.append(BODY.frame(view, P))
    return out


def attack(view):
    """Reporting hebdo : brandit la tablette (0-3), frappe (4), barres (5 actif)."""
    out = []
    up_h = {"down": ((14, 14), (31, 26)), "up": ((32, 14), (14, 26)), "side": ((25, 14), (21, 28))}[view]
    low_h = {"down": ((21, 37), (27, 37)), "up": ((27, 37), (19, 37)), "side": ((30, 36), (24, 36))}[view]
    seq = [
        {"bob": 1, "hands": _hold(view, 1), "item": tablet()},
        {"bob": 0, "hands": up_h, "item": tablet(), "head": (0, -1)},
        {"bob": -1, "hands": up_h, "item": tablet("M"), "head": (0, -1)},
        {"bob": -1, "hands": up_h, "item": tablet("M", shine=True), "head": (0, -1)},
        {"bob": 2, "hands": low_h, "item": tablet("M"), "spread": 1},
        {"bob": 2, "hands": low_h, "item": tablet("M"), "spread": 1, "burst": True},
        {"bob": 1, "hands": low_h, "item": tablet(), "burst": True},
        {"bob": 0, "hands": _hold(view, 0), "item": tablet()},
    ]
    for i, k in enumerate(seq):
        k["item_layer"] = "back" if view == "up" else "top"
        k["stride"] = 2
        burst = k.pop("burst", False)
        f = BODY.frame(view, k)
        if burst:
            # barres qui jaillissent du sol (magenta = danger)
            for j, x in enumerate((4, 9, 37, 42)):
                h = (6, 9, 9, 6)[j] - (2 if i == 6 else 0)
                for yy in range(F - h, F + 1):
                    if f[yy, x] == 0:
                        f[yy, x] = c["M"]
                        f[yy, x + 1] = c["M"] if f[yy, x + 1] == 0 else f[yy, x + 1]
                f[F - h - 1, x] = c["W"]
        out.append(f)
    return out


def shield(view):
    """Réunion d'alignement : claque des mains, anneau turquoise qui se remplit."""
    out = []
    clap = {"down": ((21, 27), (25, 27)), "up": ((25, 27), (21, 27)), "side": ((25, 26), (24, 27))}[view]
    open_ = {"down": ((12, 27), (34, 27)), "up": ((34, 27), (12, 27)), "side": ((28, 26), (19, 28))}[view]
    for i in range(8):
        hands = open_ if i in (0, 1, 4) else clap
        P = {"bob": 1 if i in (2, 3, 5) else 0, "hands": hands, "item": None, "stride": 1}
        f = BODY.frame(view, P)
        if i >= 2:
            r = 10 + (i - 2) * 2
            m = lib.ring_mask(f.shape, 24, 36, r + 1, r, sy=0.45)
            f[m & (f == 0)] = c["T" if i % 2 else "N"]
            if i in (2, 3):
                for (x, y) in ((22, 22), (26, 22), (24, 21)):
                    if f[y, x] == 0:
                        f[y, x] = c["W"]
        out.append(f)
    return out


def hurt(view):
    out = []
    for i in range(2):
        P = {"bob": 1 - i, "head": (0, -1 + i), "hands": _hold(view, 0), "item": tablet(),
             "lean": (-1 if view == "side" else 0), "item_layer": "back" if view == "up" else "top", "stride": 1}
        out.append(BODY.frame(view, P))
    return out


def death():
    out = []
    side = BODY.frame("side", {"item": None, "stride": 1})
    lying = lib.shift(lib.rot90(side, -1), 0, 14)
    for i in range(8):
        if i < 3:
            P = {"bob": i * 2, "head": (0, -1 if i == 0 else 1), "hands": ((13, 30 + i * 3), (33, 32 + i * 3)),
                 "item": tablet("d") if i < 2 else None}
            f = BODY.frame("down", P)
        else:
            f = canvas(S)
            blit(f, lying, 0, 0 if i > 3 else -4)
            if i >= 5:
                f = dissolve(f, 0.25 * (i - 4), seed=40 + i, into=c["T"])
        # chronomètre tombé au sol, arrêté
        if i >= 2:
            ch = canvas(9, 7)
            lib.ellipse(ch, 4.5, 3.5, 4.5, 3.5, c["b"])
            lib.ellipse(ch, 4.5, 3.5, 3.5, 2.5, c["w"])
            lib.line(ch, 4, 3, 4, 1, c["K"])
            lib.line(ch, 4, 3, 6, 3, c["K"])
            ch = lib.outline(np.pad(ch, 1))
            blit(f, ch, 34, 36)
        out.append(f)
    return out


def build(emit):
    for v in ("down", "up", "side"):
        emit("enemies", f"manager-kpi_idle_{v}_strip4", idle(v), 150, loop=True)
        emit("enemies", f"manager-kpi_walk_{v}_strip6", walk(v), 100, loop=True)
        emit("enemies", f"manager-kpi_attack_{v}_strip8", attack(v), [120, 120, 150, 150, 60, 80, 120, 150],
             active=[5], events={"telegraph": [1, 2, 3]})
        emit("enemies", f"manager-kpi_shield_{v}_strip8", shield(v), 110, active=[3],
             events={"telegraph": [0, 1, 2]})
        emit("enemies", f"manager-kpi_hurt_{v}_strip2", hurt(v), 80)
    emit("enemies", "manager-kpi_death_strip8", death(), 100, events={"vfx": {"6": "vfx_poof"}})
