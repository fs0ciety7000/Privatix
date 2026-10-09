"""UI (1 texel = 1 px à 640×360) : barres, icônes, curseur, panneaux, portraits."""
import math

import numpy as np

import lib
from font3x5 import draw_text
from lib import canvas, blit, parse
from palette import CHAR, K

c = CHAR


def bar_frame(w, h, accent, notch=True):
    """Cadre de barre : contour sombre, biseau acier, coins en accent."""
    a = canvas(w, h)
    a[:] = c["K"]
    lib.rect(a, 1, 1, w - 2, h - 2, c["d"])
    lib.rect(a, 1, 1, w - 2, 1, c["s"])
    lib.rect(a, 1, h - 2, w - 2, 1, c["n"])
    lib.rect(a, 2, 2, w - 4, h - 4, c["K"])  # fond du réservoir
    for x in (1, w - 2):
        lib.rect(a, x, 1, 1, h - 2, c[accent])
    if notch and w > 40:
        for x in range(w // 4, w - 4, w // 4):
            lib.px(a, x, h - 2, c["s"])
    a[0, 0] = a[0, w - 1] = a[h - 1, 0] = a[h - 1, w - 1] = 0
    return a


def bar_fill(w, h, mid, hi, sh):
    a = canvas(w, h)
    a[:] = c[mid]
    lib.rect(a, 0, 0, w, 1, c[hi])
    if h > 2:
        lib.rect(a, 0, h - 1, w, 1, c[sh])
    for x in range(3, w, 6):
        lib.px(a, x, 0, c["W"] if hi != "W" else c["w"])
    return a


def stripes(w, h, c1, c2):
    a = canvas(w, h)
    for y in range(h):
        for x in range(w):
            a[y, x] = c[c1] if ((x + y) // 2) % 2 == 0 else c[c2]
    return a


def dash_pips():
    out = []
    for state in range(3):
        a = canvas(8)
        lib.ellipse(a, 4, 4, 3.5, 3.5, c["K"])
        if state == 0:
            lib.ellipse(a, 4, 4, 2.5, 2.5, c["O"])
            lib.px(a, 3, 2, c["y"])
            lib.px(a, 2, 3, c["a"])
        elif state == 1:
            lib.ellipse(a, 4, 4, 2.5, 2.5, c["d"])
        else:
            lib.ellipse(a, 4, 4, 2.5, 2.5, c["d"])
            lib.rect(a, 2, 4, 4, 2, c["o"])
        out.append(a)
    return out


# ----------------------------------------------------------------- icônes 16×16
ICONS = {
    "dash": """
        O...O.....
        aO..aO....
        .aO..aO...
        ..yO..yO..
        .aO..aO...
        aO..aO....
        O...O.....
        """,
    "gobelet": """
        .qqqqqqq.
        qhhhhhhhw
        qwwwwwwwq
        .wqqqqqw.
        .wxxxxxw.
        .wxRRRxw.
        .wqqqqqw.
        ..wqqqw..
        """,
    "ticket": """
        qqqqqqqqqq
        qaaaaaaaaq
        qqqqqqqqqq
        qhqhhqhqqz
        qqqqqqqqzz
        """,
    "ps": """
        ....xx....
        ...xyyx...
        xxxxyyxxxx
        .xyyyyyyx.
        ..xyyyyx..
        ..xyRRyx..
        .xyR..Ryx.
        .xR....Rx.
        """,
    "grain": """
        .hhhh.
        hmmzhh
        hmeehh
        hmmzhh
        hmeehh
        .hhhh.
        """,
    "energie": """
        .xx.xx.
        xWxxxxR
        xxxxxxR
        xxxxxRR
        .xxxRR.
        ..xRR..
        ...R...
        """,
    "burnout": """
        ...V...
        ..VV...
        ..VVV.V
        .VVWVVV
        VVVWWVV
        VVWWWVV
        .VVWVV.
        """,
    "mobilisation": """
        ......bb.
        .bbbbbbbb
        bwwwwwbb.
        bwbbbbb..
        bwbb.....
        .bb......
        """,
    "cle": """
        .bbbbbb.
        ...ss...
        ...ss...
        ...ss...
        ...OO...
        ...OO...
        ...dd...
        """,
    "horloge": """
        ..bbbb..
        .bwwwwb.
        bwwKwwwb
        bwwKwwwb
        bwwKKKwb
        bwwwwwwb
        .bwwwwb.
        ..bbbb..
        """,
    "crane": """
        .wwwww.
        wwwwwww
        wKKwKKw
        wKKwKKw
        wwwKwww
        .wwwww.
        .wKwKw.
        """,
    "train": """
        .bbbbbbbb.
        bwwwwwwwwb
        bcvbbbvcbb
        bbbbbbbbbb
        bIIIIIIIIb
        byyyyyyyyb
        .dd....dd.
        """,
    "radio": """
        ......s
        .....s.
        dddddd.
        dssssd.
        dsyysd.
        dssssd.
        dsKKsd.
        dddddd.
        """,
    "lanterne": """
        ..dd..
        .hhhh.
        haaaah
        hayyah
        hayyah
        haaaah
        .dddd.
        """,
    "poing": """
        .pppp..
        ppppppz
        pzpzpzz
        pppppzz
        .ppppz.
        .xxxxx.
        .xxxxR.
        """,
    "megaphone": """
        .......x.
        ......xx.
        bb..xxxx.
        bbwxxxxx.
        bbwxxxxx.
        bb..xxxx.
        .s....xx.
        .s.....x.
        """,
    "tract": """
        qqqqqq
        qxxxxq
        qqqqqq
        qhhhqq
        qqqqqq
        qhhqqq
        qqqqqz
        """,
    "rail": """
        b.b.b.b.
        sssssssss
        m.m.m.m.
        m.m.m.m.
        sssssssss
        b.b.b.b.
        """,
    "botte": """
        .hhh....
        .hhh....
        .hhh....
        .hhmm...
        .hhhhhh.
        eeeeeee.
        """,
    "casque": """
        ..wwww..
        .wWwwwb.
        wWwwwwbb
        wwwwwwbb
        bbbbbbbs
        """,
    "bouclier": """
        TTTTTTT
        TNNTTTu
        TNTTTTu
        TTTTTTu
        .TTTTu.
        ..TTu..
        ...u...
        """,
    "eclair": """
        ...yy
        ..yy.
        .yyy.
        yyyyy
        ..yy.
        .yy..
        .y...
        """,
    "etoile": """
        ...a...
        ..aya..
        aayyyaa
        .ayyya.
        .ayaya.
        aa...aa
        """,
    "thermos": """
        .ss.
        iIIi
        iIii
        iaai
        iIii
        iIii
        iiii
        """,
}

UPGRADE_ORDER = ["cle", "gobelet", "mobilisation", "lanterne", "radio", "poing", "horloge", "bouclier",
                 "eclair", "energie", "etoile", "train", "ticket", "rail", "botte", "casque", "megaphone", "tract",
                 "burnout", "ps", "grain", "thermos", "dash", "crane"]


def icon(name, S=16):
    a = canvas(S)
    m = parse(ICONS[name])
    h, w = m.shape
    blit(a, m, (S - w) // 2, (S - h) // 2)
    return lib.outline(a)


def icon8(name):
    """Version 8×8 (ressources) : réduction 2:1 par sélection des pixels."""
    m = parse(ICONS[name])
    h, w = m.shape
    if h > 6 or w > 6:
        m = m[::2, ::2] if max(h, w) > 8 else m[: min(h, 6), : min(w, 6)]
    a = canvas(8)
    h, w = m.shape
    blit(a, m, (8 - w) // 2, (8 - h) // 2)
    return lib.outline(a)


def rarity(kind):
    a = canvas(20)
    cols = {"commun": ("b", "s", "d"), "rare": ("c", "I", "i"), "epique": ("W", "V", "d"), "syndical": ("y", "a", "x")}[
        kind]
    a[:] = c[cols[1]]
    lib.rect(a, 0, 0, 20, 1, c[cols[0]])
    lib.rect(a, 0, 0, 1, 20, c[cols[0]])
    lib.rect(a, 19, 0, 1, 20, c[cols[2]])
    lib.rect(a, 0, 19, 20, 1, c[cols[2]])
    lib.rect(a, 2, 2, 16, 16, 0)
    lib.rect(a, 2, 2, 16, 1, c["K"])
    lib.rect(a, 2, 2, 1, 16, c["K"])
    for (x, y) in ((0, 0), (19, 0), (0, 19), (19, 19)):
        a[y, x] = c["K"]
    if kind == "syndical":
        for (x, y) in ((1, 1), (18, 1), (1, 18), (18, 18)):
            a[y, x] = c["x"]
    return a


def cursor(state):
    a = canvas(16)
    col = c["y"] if state != 1 else c["M"]
    gap = 2 + (1 if state >= 2 else 0) + (1 if state == 3 else 0)
    for d in range(gap, gap + 4):
        for (x, y) in ((8 + d, 8), (7 - d, 8), (8, 8 + d), (8, 7 - d)):
            lib.px(a, x, y - 0, col)
            lib.px(a, x, y, col)
    for (x, y) in ((8 + gap, 7), (7 - gap, 7)):
        pass
    lib.rect(a, 7, 7, 2, 2, c["W"] if state == 0 else col)
    if state == 1:
        for (x, y) in ((3, 3), (12, 3), (3, 12), (12, 12)):
            lib.px(a, x, y, c["M"])
    return lib.outline(a, c["K"])


def prompt(kind):
    a = canvas(16)
    if kind in ("E", "A"):
        lib.rect(a, 2, 2, 12, 11, c["b"])
        lib.rect(a, 2, 2, 12, 1, c["w"])
        lib.rect(a, 2, 13, 12, 2, c["s"])
        if kind == "A":
            a[:] = 0
            lib.ellipse(a, 8, 8, 6.5, 6.5, c["s"])
            lib.ellipse(a, 8, 7.5, 6, 6, c["L"])
        draw_text(a, kind, 7 - 1, 5, c["d"])
    elif kind == "clic":
        lib.rect(a, 4, 2, 8, 12, c["b"])
        lib.rect(a, 4, 2, 4, 5, c["y"])
        lib.rect(a, 8, 2, 1, 5, c["s"])
        lib.rect(a, 4, 7, 8, 1, c["s"])
    else:
        lib.rect(a, 6, 2, 3, 9, c["p"])
        lib.rect(a, 4, 8, 7, 6, c["p"])
        lib.px(a, 6, 2, c["q"])
        lib.ellipse(a, 7, 3, 4, 2, c["y"], fill=False)
    return lib.outline(a)


def panel(kind):
    a = canvas(24)
    if kind == "occ":
        a[:] = c["e"]
        lib.rect(a, 0, 0, 24, 24, c["K"])
        lib.rect(a, 1, 1, 22, 22, c["m"])
        lib.rect(a, 2, 2, 20, 20, c["h"])
        lib.rect(a, 3, 3, 18, 18, c["e"])
        lib.rect(a, 1, 1, 22, 1, c["z"])
        for (x, y) in ((2, 2), (21, 2), (2, 21), (21, 21)):
            lib.px(a, x, y, c["a"])
    elif kind == "privatix":
        a[:] = c["K"]
        lib.rect(a, 1, 1, 22, 22, c["T"])
        lib.rect(a, 2, 2, 20, 20, c["n"])
        lib.rect(a, 1, 1, 22, 1, c["N"])
        lib.rect(a, 3, 3, 18, 1, c["u"])
    return a


def card():
    a = canvas(32)
    a[:] = c["K"]
    lib.rect(a, 1, 1, 30, 30, c["s"])
    lib.rect(a, 2, 2, 28, 28, c["d"])
    lib.rect(a, 3, 3, 26, 26, c["n"])
    lib.rect(a, 1, 1, 30, 1, c["b"])
    lib.rect(a, 1, 1, 1, 30, c["g"])
    for (x, y) in ((0, 0), (31, 0), (0, 31), (31, 31)):
        a[y, x] = 0
    return a


DIGITS = {
    "0": "111101101101101101111", "1": "010110010010010010111", "2": "111001001111100100111",
    "3": "111001001111001001111", "4": "101101101111001001001", "5": "111100100111001001111",
    "6": "111100100111101101111", "7": "111001001010010010010", "8": "111101101111101101111",
    "9": "111101101111001001111", "-": "000000000111000000000", "!": "010010010010010000010",
}


def font_dmg():
    """RetroFont 84×9 : 0-9 - ! en cellules 7×9, glyphes 5×7 blancs contourés."""
    a = canvas(84, 9)
    for i, ch in enumerate("0123456789-!"):
        cell = canvas(7, 9)
        bits = np.array([int(b) for b in DIGITS[ch]], dtype=bool).reshape(7, 3)
        g = np.zeros((7, 5), dtype=bool)
        for y in range(7):
            for x in range(3):
                if bits[y, x]:
                    g[y, x * 2 : x * 2 + 2 if x < 2 else 5] = True if x != 1 else g[y, x * 2 : x * 2 + 2]
        # glyphe 5 px : colonnes 0, 1-3 (centre), 4
        g = np.zeros((7, 5), dtype=bool)
        for y in range(7):
            g[y, 0] = bits[y, 0]
            g[y, 1:4] = bits[y, 1] or (bits[y, 0] and bits[y, 2] and y in (0, 3, 6)) or False
            if not bits[y, 1]:
                g[y, 1:4] = False
            g[y, 4] = bits[y, 2]
        cell[1:8, 1:6][g] = c["W"]
        cell = lib.outline(cell)
        blit(a, cell, i * 7, 0)
    return a


# ----------------------------------------------------------------- portraits 64×64

def portrait(name, mood):
    """Buste 64×64 : tête grande, 3 humeurs (0 neutre, 1 ironique, 2 fâché)."""
    a = canvas(64)
    P = {
        "player": dict(skin=("p", "z", "m"), hair="h", hat="casque", clothes=("O", "o", "a"), stache="h",
                       bg="e", eyes="K"),
        "josiane": dict(skin=("p", "z", "m"), hair="q", hat=None, clothes=("x", "R", "x"), stache=None, bg="e",
                        glasses="s", eyes="K"),
        "marcel": dict(skin=("p", "z", "m"), hair="b", hat="casquette", clothes=("z", "m", "q"), stache="w", bg="e",
                       eyes="K"),
        "auditeur": dict(skin=("p", "z", "m"), hair="d", hat=None, clothes=("i", "n", "w"), stache=None, bg="n",
                         glasses="T", eyes="K", tie="T"),
    }[name]
    sk, sh, dk = P["skin"]
    # fond
    a[:] = c[P["bg"]]
    for y in range(0, 64, 4):
        lib.rect(a, 0, y, 64, 1, c["K"] if P["bg"] == "n" else c["h"])
    # épaules / vêtements
    cl, cls, clh = P["clothes"]
    lib.ellipse(a, 32, 66, 30, 16, c[cls])
    lib.ellipse(a, 30, 66, 27, 14, c[cl])
    if name == "player":
        # bandes réfléchissantes
        lib.rect(a, 10, 56, 44, 3, c["w"])
        lib.rect(a, 10, 58, 44, 1, c["b"])
        lib.rect(a, 18, 50, 3, 14, c["w"])
        lib.rect(a, 43, 50, 3, 14, c["w"])
        lib.rect(a, 26, 50, 12, 14, c["i"])
    if P.get("tie"):
        lib.rect(a, 27, 50, 10, 14, c["w"])
        lib.rect(a, 30, 51, 4, 13, c[P["tie"]])
        lib.rect(a, 30, 51, 4, 1, c["N"])
    # cou
    lib.rect(a, 26, 42, 12, 10, c[sh])
    # tête
    lib.ellipse(a, 32, 30, 15, 17, c[sh])
    lib.ellipse(a, 31, 29, 14, 16, c[sk])
    lib.ellipse(a, 27, 24, 6, 5, c["q"] if sk == "p" else c[sk]) if False else None
    lib.px(a, 22, 22, c["q"])
    lib.px(a, 23, 21, c["q"])
    # oreilles
    lib.ellipse(a, 17, 32, 3, 4, c[sh])
    lib.ellipse(a, 47, 32, 3, 4, c[sh])
    # cheveux / chapeau
    hair = c[P["hair"]]
    if P["hat"] == "casque":
        lib.ellipse(a, 32, 18, 18, 11, c["b"])
        lib.ellipse(a, 31, 17, 17, 10, c["w"])
        lib.ellipse(a, 26, 13, 6, 3, c["W"])
        lib.rect(a, 12, 20, 40, 3, c["b"])
        lib.rect(a, 12, 22, 40, 1, c["s"])
        a[23:30, 16:19] = hair
        a[23:30, 45:48] = hair
    elif P["hat"] == "casquette":
        lib.ellipse(a, 32, 16, 17, 8, c["i"])
        lib.ellipse(a, 30, 15, 15, 6, c["I"])
        lib.rect(a, 13, 19, 38, 4, c["n"])
        lib.rect(a, 28, 13, 8, 4, c["a"])
        a[23:32, 16:19] = hair
        a[23:32, 45:48] = hair
    else:
        lib.ellipse(a, 32, 18, 16, 9, hair)
        if name == "josiane":
            lib.ellipse(a, 32, 22, 18, 14, hair)
            lib.ellipse(a, 31, 31, 13, 13, c[sk])
            lib.rect(a, 14, 22, 5, 18, hair)
            lib.rect(a, 45, 22, 5, 18, hair)
            lib.ellipse(a, 26, 16, 6, 3, c["w"])
        else:
            lib.rect(a, 16, 18, 4, 10, hair)
            lib.rect(a, 44, 18, 4, 8, hair)
            lib.line(a, 20, 16, 40, 13, c["s"])
            lib.line(a, 22, 18, 42, 15, c["s"])
    # yeux et sourcils selon l'humeur
    ey = 31
    for side, ex in ((0, 25), (1, 38)):
        lib.rect(a, ex, ey, 4, 3, c["w"])
        lib.rect(a, ex + (1 if side == 0 else 1), ey, 2, 3, c[P["eyes"]])
        lib.px(a, ex + 1, ey, c["W"])
        if mood == 0:
            lib.rect(a, ex - 1, ey - 3, 6, 1, hair if P["hair"] not in ("b", "q") else c["g"])
        elif mood == 1:
            dy = -4 if side == 1 else -3
            lib.rect(a, ex - 1, ey + dy, 6, 1, hair if P["hair"] not in ("b", "q") else c["g"])
            if side == 0:
                lib.rect(a, ex, ey, 4, 1, c[sh])
        else:
            for k in range(6):
                yy = ey - 2 - (k if side == 1 else 5 - k) // 2
                lib.px(a, ex - 1 + k, yy, hair if P["hair"] not in ("b", "q") else c["g"])
    if P.get("glasses"):
        g = c[P["glasses"]]
        for ex in (24, 37):
            lib.rect(a, ex, ey - 1, 6, 1, g)
            lib.rect(a, ex, ey + 3, 6, 1, g)
            lib.rect(a, ex, ey - 1, 1, 5, g)
            lib.rect(a, ex + 5, ey - 1, 1, 5, g)
        lib.rect(a, 30, ey, 7, 1, g)
    # nez
    lib.rect(a, 31, ey + 4, 3, 4, c[sh])
    lib.px(a, 31, ey + 4, c[sk])
    # bouche + moustache
    my = ey + 11
    if mood == 0:
        lib.rect(a, 28, my, 8, 1, c[dk])
    elif mood == 1:
        lib.rect(a, 28, my, 7, 1, c[dk])
        lib.px(a, 35, my - 1, c[dk])
    else:
        lib.rect(a, 28, my, 8, 2, c["K"])
        lib.rect(a, 29, my, 6, 1, c["w"])
    if P["stache"]:
        s = c[P["stache"]]
        lib.rect(a, 25, my - 3, 14, 3, s)
        lib.px(a, 24, my - 1, s)
        lib.px(a, 39, my - 1, s)
    if name == "auditeur":
        # sifflet
        lib.rect(a, 36, my - 1, 6, 3, c["b"])
        lib.px(a, 41, my - 1, c["w"])
    # cadre extérieur
    a = lib.outline(a[1:-1, 1:-1].copy() if False else a)
    a[0, :] = a[-1, :] = c["K"]
    a[:, 0] = a[:, -1] = c["K"]
    return a


def build(emit):
    u = "sprites/ui"
    emit(u, "ui_dash-pip_strip3", dash_pips(), 100)
    emit(u, "ui_upgrades_strip24", [icon(n) for n in UPGRADE_ORDER], 100, notes=", ".join(UPGRADE_ORDER))
    emit(u, "ui_icons_strip8", [icon(n) for n in ("dash", "gobelet", "ticket", "ps", "grain", "energie", "burnout",
                                                   "mobilisation")], 100,
         notes="0 charge de dash, 1 Gobelet, 2 Tickets, 3 Points de Syndicalisme, 4 grains, 5 Énergie, 6 Burnout, "
               "7 Mobilisation")
    emit(u, "ui_rarity_strip4", [rarity(k) for k in ("commun", "rare", "epique", "syndical")], 100)
    emit(u, "ui_res_strip8", [icon8(n) for n in ("grain", "ticket", "energie", "burnout", "cle", "crane", "horloge",
                                                  "gobelet")], 100)
    emit(u, "ui_door-reward_strip8", [icon(n) for n in ("gobelet", "tract", "grain", "ticket", "etoile", "crane",
                                                         "lanterne", "radio")], 100,
         notes="café, tract, grains, boutique, élite, boss, hub, mystère")
    emit(u, "ui_cursor_strip4", [cursor(i) for i in range(4)], [100, 100, 40, 60])
    emit(u, "ui_prompt_strip4", [prompt(k) for k in ("E", "A", "clic", "touch")], 100)
    p = "sprites/portraits"
    for name in ("player", "josiane", "marcel", "auditeur"):
        emit(p, f"portrait_{name}_strip3", [portrait(name, m) for m in range(3)], 100,
             notes="0 neutre, 1 ironique, 2 fâché")


def build_images(emit_image):
    u = "sprites/ui"
    emit_image(u, "ui_hp-frame", bar_frame(104, 12, "O"))
    emit_image(u, "ui_hp-fill", bar_fill(100, 8, "x", "O", "R"))
    emit_image(u, "ui_hp-ghost", bar_fill(100, 8, "q", "W", "p"))
    emit_image(u, "ui_burnout-frame", bar_frame(76, 8, "V"))
    emit_image(u, "ui_burnout-fill", bar_fill(72, 4, "V", "W", "d"))
    emit_image(u, "ui_burnout-crit", stripes(80, 4, "V", "M"), extra={"tileSprite": True})
    emit_image(u, "ui_mobilisation-frame", bar_frame(76, 8, "a"))
    emit_image(u, "ui_mobilisation-fill", bar_fill(72, 4, "a", "y", "o"))
    emit_image(u, "ui_boss-frame", bar_frame(320, 14, "T"))
    emit_image(u, "ui_boss-fill", bar_fill(316, 6, "M", "W", "R"))
    emit_image(u, "ui_panel-occ", panel("occ"), extra={"nineSlice": 8})
    emit_image(u, "ui_panel-privatix", panel("privatix"), extra={"nineSlice": 8})
    emit_image(u, "ui_card", card(), extra={"nineSlice": 10})
    emit_image("fonts", "font_dmg", font_dmg(),
               extra={"retroFont": {"chars": "0123456789-!", "width": 7, "height": 9, "charsPerRow": 12}})
