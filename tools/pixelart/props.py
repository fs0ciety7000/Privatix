"""Props (décor) des quais et de l'OCC, props animés, trains vus de dessus.

Décor : pas de contour noir — contour « sel-out » teinté (bleu nuit sur les
quais, espresso à l'OCC), lumière haut-gauche, pivot = milieu du bas.
"""
import json
import os

import numpy as np

import lib
import modern
from font3x5 import draw_text, text_mask
from lib import canvas, blit, parse
from palette import CHAR

c = CHAR
QO = c["n"]  # contour décor quais
OO = c["e"]  # contour décor OCC


def box(a, x, y, w, h, top, front, side=None, top_h=3, hi=None):
    """Volume en 3/4 : dessus (top_h px) + façade, arête gauche éclairée."""
    lib.rect(a, x, y, w, top_h, c[top])
    lib.rect(a, x, y + top_h, w, h - top_h, c[front])
    if hi:
        lib.rect(a, x, y, w, 1, c[hi])
        lib.rect(a, x, y, 1, h, c[hi])
    if side:
        lib.rect(a, x + w - 1, y + top_h, 1, h - top_h, c[side])


def finish(a, col):
    """Contour sel-out teinté puis passe de volume « moderne » (sans rim :
    le liseré néon est réservé aux acteurs)."""
    return modern.shade(lib.outline(a, col), rim=False, outline=col)


def mk(w, h):
    return canvas(w, h)


# --------------------------------------------------------------------------
# QUAIS
# --------------------------------------------------------------------------

def banc_h():
    a = mk(32, 16)
    # assise à lattes vue de dessus + pieds
    for i, y in enumerate((2, 5)):
        lib.rect(a, 1, y, 30, 2, c["z"] if i == 0 else c["m"])
        lib.rect(a, 1, y, 30, 1, c["p"] if i == 0 else c["z"])
    lib.rect(a, 1, 8, 30, 3, c["s"])
    lib.rect(a, 1, 8, 30, 1, c["g"])
    for x in (3, 26):
        lib.rect(a, x, 11, 3, 4, c["d"])
        lib.rect(a, x, 11, 1, 4, c["s"])
    return finish(a, QO)


def banc_v():
    a = mk(16, 32)
    for i, x in enumerate((3, 6, 9)):
        lib.rect(a, x, 1, 2, 27, c["z"] if i < 2 else c["m"])
        lib.rect(a, x, 1, 1, 27, c["p"] if i == 0 else c["z"])
    lib.rect(a, 2, 28, 10, 3, c["d"])
    lib.rect(a, 2, 1, 1, 27, c["s"])
    return finish(a, QO)


def poubelle(state=0):
    a = mk(16, 16)
    if state < 3:
        lib.ellipse(a, 8, 4, 5.5, 2.5, c["g"])
        lib.ellipse(a, 8, 4, 4, 1.5, c["d"])
        lib.rect(a, 3, 4, 10, 10, c["G"])
        lib.rect(a, 3, 4, 2, 10, c["s"] if False else c["G"])
        lib.rect(a, 3, 4, 1, 10, c["b"])
        lib.rect(a, 12, 4, 1, 10, c["n"])
        lib.rect(a, 4, 7, 8, 1, c["d"])
        lib.rect(a, 4, 11, 8, 1, c["d"])
        if state >= 1:
            lib.line(a, 6, 5, 9, 9, c["d"])
        if state >= 2:
            a = lib.shift(a, 1, 1)
    else:
        lib.rect(a, 2, 10, 12, 4, c["G"])
        lib.rect(a, 2, 10, 12, 1, c["b"])
        lib.rect(a, 4, 9, 3, 1, c["d"])
    return finish(a, QO)


def distributeur(broken=0):
    a = mk(32, 32)
    box(a, 4, 1, 24, 30, "g", "s", "d", top_h=4, hi="b")
    lib.rect(a, 7, 7, 13, 16, c["n"])
    for y in range(8, 22, 4):
        for x in range(8, 19, 4):
            col = ("x", "y", "c", "L")[(x + y) % 4] if (x + y) % 4 != 3 else "c"
            lib.rect(a, x, y, 2, 3, c[col] if col != "L" else c["G"])
        lib.rect(a, 7, y + 3, 13, 1, c["d"])
    lib.rect(a, 22, 8, 4, 6, c["d"])
    lib.rect(a, 23, 9, 2, 1, c["x"])
    lib.rect(a, 23, 11, 2, 1, c["v"] if not broken else c["d"])
    lib.rect(a, 8, 25, 12, 3, c["K"])
    lib.rect(a, 4, 5, 24, 1, c["x"])
    if broken:
        for (x, y) in ((10, 9), (11, 10), (12, 12), (13, 13), (11, 14), (15, 11), (16, 10)):
            lib.px(a, x, y, c["w"])
        if broken >= 2:
            lib.rect(a, 7, 7, 13, 16, c["d"])
            lib.line(a, 8, 8, 18, 21, c["s"])
    return finish(a, QO)


def compostage():
    a = mk(16, 32)
    lib.rect(a, 6, 14, 4, 16, c["s"])
    lib.rect(a, 6, 14, 1, 16, c["g"])
    box(a, 3, 3, 10, 12, "b", "y", "a", top_h=2)
    lib.rect(a, 5, 7, 6, 2, c["K"])
    lib.rect(a, 5, 11, 6, 1, c["d"])
    lib.rect(a, 4, 30, 8, 1, c["d"])
    return finish(a, QO)


def panneau_quai(n=1):
    a = mk(32, 16)
    lib.rect(a, 1, 2, 30, 10, c["I"])
    lib.rect(a, 1, 2, 30, 1, c["c"])
    lib.rect(a, 1, 11, 30, 1, c["i"])
    draw_text(a, f"VOIE {n}", 4, 5, c["w"])
    for x in (6, 24):
        lib.rect(a, x, 12, 2, 3, c["s"])
    return finish(a, QO)


def horloge():
    a = mk(16, 32)
    lib.rect(a, 7, 14, 2, 17, c["s"])
    lib.rect(a, 7, 14, 1, 17, c["g"])
    lib.ellipse(a, 8, 8, 6.5, 6.5, c["d"])
    lib.ellipse(a, 8, 8, 5.5, 5.5, c["w"])
    lib.line(a, 8, 8, 8, 4, c["K"])
    lib.line(a, 8, 8, 10, 9, c["K"])
    lib.px(a, 5, 5, c["W"]) if False else lib.px(a, 5, 5, c["b"])
    return finish(a, QO)


def ecran_departs():
    a = mk(48, 32)
    lib.rect(a, 23, 22, 2, 9, c["s"])
    box(a, 1, 2, 46, 20, "g", "d", None, top_h=2, hi="s")
    lib.rect(a, 3, 5, 42, 15, c["n"])
    rows = ["0712 MONS", "0724 SUPPR", "0731 RET+5"]
    for i, t in enumerate(rows):
        draw_text(a, t[:10], 4, 6 + i * 5 - (1 if i else 0), c["y"] if i != 1 else c["x"]) if False else None
    for i, t in enumerate(("0712 ...", "SUPPRIME")):
        draw_text(a, t, 5, 7 + i * 6, c["y"] if i == 0 else c["x"])
    return finish(a, QO)


def pilier():
    a = mk(32, 48)
    lib.rect(a, 6, 0, 20, 44, c["g"])
    lib.rect(a, 6, 0, 4, 44, c["b"])
    lib.rect(a, 22, 0, 4, 44, c["s"])
    lib.rect(a, 4, 40, 24, 7, c["s"])
    lib.rect(a, 4, 40, 24, 1, c["b"])
    lib.rect(a, 6, 14, 20, 6, c["I"])
    lib.rect(a, 6, 14, 20, 1, c["c"])
    draw_text(a, "2", 14, 15, c["w"])
    return finish(a, QO)


def extincteur():
    a = mk(16, 16)
    lib.rect(a, 5, 4, 5, 11, c["x"])
    lib.rect(a, 5, 4, 1, 11, c["w"]) if False else lib.rect(a, 5, 4, 1, 11, c["x"])
    lib.rect(a, 9, 4, 1, 11, c["R"])
    lib.rect(a, 5, 2, 4, 2, c["d"])
    lib.line(a, 9, 2, 12, 5, c["d"])
    lib.px(a, 6, 5, c["w"])
    return finish(a, QO)


def cone():
    a = mk(16, 16)
    lib.rect(a, 2, 12, 12, 3, c["d"])
    for y in range(2, 12):
        w = 1 + (y - 2) // 2
        lib.rect(a, 8 - w, y, 2 * w, 1, c["x"] if y not in (6, 7) else c["w"])
    lib.px(a, 7, 3, c["w"])
    return finish(a, QO)


def barriere():
    a = mk(32, 16)
    lib.rect(a, 1, 3, 30, 4, c["w"])
    for x in range(1, 31, 6):
        lib.rect(a, x, 3, 3, 4, c["x"])
    lib.rect(a, 1, 3, 30, 1, c["W"]) if False else None
    for x in (3, 26):
        lib.rect(a, x, 7, 2, 7, c["s"])
        lib.rect(a, x - 1, 13, 4, 2, c["d"])
    return finish(a, QO)


def valise(v=0):
    a = mk(16, 16)
    col, hi, sh = (("I", "c", "i"), ("R", "x", "R"))[v]
    lib.rect(a, 3, 5, 10, 9, c[col])
    lib.rect(a, 3, 5, 10, 1, c[hi])
    lib.rect(a, 12, 5, 1, 9, c[sh] if v else c["n"])
    lib.rect(a, 6, 3, 4, 2, c["d"])
    lib.rect(a, 7, 4, 2, 1, 0)
    lib.rect(a, 3, 9, 10, 1, c["d"])
    return finish(a, QO)


def chariot():
    a = mk(32, 16)
    lib.rect(a, 2, 4, 26, 6, c["s"])
    lib.rect(a, 2, 4, 26, 1, c["b"])
    for x in range(4, 26, 4):
        lib.rect(a, x, 5, 1, 4, c["d"])
    lib.rect(a, 28, 1, 2, 9, c["g"])
    lib.rect(a, 6, 6, 8, 3, c["m"])
    lib.rect(a, 15, 5, 7, 4, c["I"])
    for x in (5, 23):
        lib.ellipse(a, x + 1, 12, 2, 2, c["K"])
    return finish(a, QO)


def catenaire():
    a = mk(16, 48)
    lib.rect(a, 6, 4, 4, 42, c["s"])
    lib.rect(a, 6, 4, 1, 42, c["g"])
    for y in range(8, 44, 6):
        lib.line(a, 6, y, 9, y + 3, c["d"])
    lib.rect(a, 1, 3, 14, 2, c["d"])
    lib.rect(a, 1, 3, 14, 1, c["g"])
    lib.rect(a, 2, 5, 2, 2, c["b"])
    lib.rect(a, 12, 5, 2, 2, c["b"])
    lib.rect(a, 5, 45, 6, 2, c["d"])
    return finish(a, QO)


def signal_prop(green=False):
    a = mk(16, 32)
    lib.rect(a, 7, 14, 2, 17, c["s"])
    lib.rect(a, 4, 1, 8, 14, c["K"])
    lib.rect(a, 4, 1, 8, 1, c["d"])
    lib.rect(a, 6, 3, 4, 4, c["x"] if not green else c["C"])
    lib.rect(a, 6, 9, 4, 4, c["L"] if green else c["G"])
    # feu allumé : cœur clair et visière (émissif, nourrit le bloom)
    y = 3 if not green else 9
    lib.rect(a, 7, y + 1, 2, 2, c["l"] if not green else c["Z"])
    lib.px(a, 7, y + 1, c["W"])
    lib.rect(a, 5, y - 1, 6, 1, c["s"])
    return finish(a, QO)


def portique(open_=0):
    """Portique de quai (sortie de salle), avec mini-écran des départs."""
    a = mk(48, 48)
    for x in (3, 39):
        lib.rect(a, x, 8, 6, 38, c["s"])
        lib.rect(a, x, 8, 2, 38, c["g"])
        lib.rect(a, x + 5, 8, 1, 38, c["d"])
    lib.rect(a, 3, 4, 42, 8, c["d"])
    lib.rect(a, 3, 4, 42, 1, c["g"])
    lib.rect(a, 12, 5, 24, 6, c["n"])
    feu = c["x"] if open_ < 2 else c["L"]
    lib.rect(a, 6, 6, 3, 3, feu)
    lib.rect(a, 39, 6, 3, 3, feu)
    draw_text(a, "IC 0712" if open_ < 3 else "OK 0712", 13, 6, c["y"] if open_ < 3 else c["L"])
    # tourniquet / barrière qui s'ouvre
    ang = [0, 0, 20, 45, 70, 90][open_]
    lib.draw_rotated(a, 9.5, 30.5, ang, [(0, 15, -1, 1, (c["w"], c["x"], c["R"]))])
    lib.draw_rotated(a, 38.5, 30.5, 180 - ang, [(0, 15, -1, 1, (c["w"], c["x"], c["R"]))])
    return finish(a, QO)


# --------------------------------------------------------------------------
# OCC
# --------------------------------------------------------------------------

def comptoir():
    a = mk(48, 32)
    box(a, 1, 6, 46, 24, "z", "m", "h", top_h=6, hi="p")
    for x in range(5, 46, 8):
        lib.rect(a, x, 14, 1, 14, c["h"])
    lib.rect(a, 1, 28, 46, 2, c["e"])
    lib.rect(a, 6, 2, 6, 5, c["q"])
    lib.rect(a, 7, 3, 4, 1, c["h"])
    lib.rect(a, 30, 3, 10, 4, c["s"])
    lib.rect(a, 31, 4, 3, 1, c["a"])
    return finish(a, OO)


def canape(new=False):
    a = mk(48, 32)
    col, hi, sh = ("R", "x", "e") if not new else ("G", "L", "e")
    lib.rect(a, 2, 4, 44, 10, c[col])
    lib.rect(a, 2, 4, 44, 2, c[hi])
    lib.rect(a, 2, 14, 44, 12, c[col])
    lib.rect(a, 4, 14, 19, 8, c[hi])
    lib.rect(a, 25, 14, 19, 8, c[hi])
    lib.rect(a, 23, 14, 2, 10, c[sh])
    lib.rect(a, 2, 4, 4, 22, c[col])
    lib.rect(a, 42, 4, 4, 22, c[sh] if False else c[col])
    lib.rect(a, 2, 26, 44, 2, c["e"])
    lib.rect(a, 4, 28, 2, 3, c["h"])
    lib.rect(a, 42, 28, 2, 3, c["h"])
    if not new:
        lib.rect(a, 30, 17, 3, 2, c["q"])  # rustine
    return finish(a, OO)


def table_tasses():
    a = mk(32, 32)
    lib.ellipse(a, 16, 12, 13, 8, c["z"])
    lib.ellipse(a, 16, 11, 12, 7, c["p"] if False else c["z"])
    lib.ellipse(a, 15, 10, 9, 4, c["p"])
    lib.rect(a, 14, 19, 4, 11, c["m"])
    lib.rect(a, 10, 29, 12, 2, c["h"])
    for (x, y) in ((9, 9), (20, 8), (16, 13)):
        lib.rect(a, x, y, 4, 3, c["q"])
        lib.rect(a, x + 1, y, 2, 1, c["h"])
    return finish(a, OO)


def etagere_lanternes():
    a = mk(32, 48)
    lib.rect(a, 2, 2, 28, 44, c["h"])
    lib.rect(a, 2, 2, 28, 2, c["z"])
    for y in (14, 28, 42):
        lib.rect(a, 2, y, 28, 2, c["z"])
        for x in (5, 13, 21):
            lib.rect(a, x, y - 9, 6, 9, c["d"])
            lib.rect(a, x + 1, y - 7, 4, 6, c["a"] if (x + y) % 3 else c["q"])
            lib.rect(a, x + 2, y - 11, 2, 2, c["s"])
    return finish(a, OO)


def casiers():
    a = mk(32, 48)
    for x in (1, 11, 21):
        box(a, x, 2, 10, 44, "b", "g", "s", top_h=2, hi="b")
        lib.rect(a, x + 2, 8, 6, 2, c["d"])
        lib.rect(a, x + 2, 11, 6, 1, c["d"])
        lib.rect(a, x + 7, 24, 1, 3, c["w"])
    lib.rect(a, 12, 30, 7, 4, c["q"])  # un tract scotché
    lib.rect(a, 13, 31, 5, 1, c["x"])
    return finish(a, OO)


def tableau_palettes():
    a = mk(48, 32)
    lib.rect(a, 1, 1, 46, 28, c["K"])
    lib.rect(a, 1, 1, 46, 1, c["d"])
    for i, t in enumerate(("SHIFT", "MATIN", "NUIT")):
        draw_text(a, t, 4, 4 + i * 8, c["a"])
        draw_text(a, ("37", "OK", "SUPP")[i], 30, 4 + i * 8, c["q"] if i < 2 else c["x"])
    lib.rect(a, 10, 29, 2, 2, c["h"])
    lib.rect(a, 36, 29, 2, 2, c["h"])
    return finish(a, OO)


def tableau_liege():
    a = mk(32, 32)
    lib.rect(a, 1, 1, 30, 28, c["z"])
    lib.rect(a, 1, 1, 30, 2, c["m"])
    for (x, y, col) in ((4, 5, "q"), (16, 4, "q"), (9, 15, "w"), (21, 16, "q"), (4, 22, "a")):
        lib.rect(a, x, y, 7, 6, c[col])
        lib.rect(a, x + 1, y + 2, 5, 1, c["g"])
        lib.px(a, x + 3, y, c["x"])
    lib.line(a, 7, 6, 19, 5, c["x"])
    lib.line(a, 19, 5, 12, 16, c["x"])
    lib.line(a, 12, 16, 24, 17, c["x"])
    return finish(a, OO)


def etabli():
    a = mk(48, 32)
    box(a, 1, 6, 46, 10, "z", "m", "h", top_h=4, hi="p")
    for x in (3, 42):
        lib.rect(a, x, 16, 3, 14, c["h"])
    lib.rect(a, 5, 22, 38, 2, c["h"])
    lib.rect(a, 8, 4, 10, 3, c["s"])  # étau
    lib.rect(a, 8, 4, 10, 1, c["b"])
    lib.draw_rotated(a, 26.5, 7.5, -10, [(0, 14, -1, 1, (c["b"], c["s"], c["d"])), (12, 15, -3, 3, (c["b"], c["s"], c["d"]))])
    lib.rect(a, 36, 3, 4, 4, c["a"])
    return finish(a, OO)


def porte_service():
    a = mk(32, 48)
    lib.rect(a, 2, 2, 28, 44, c["d"])
    lib.rect(a, 4, 4, 24, 42, c["s"])
    lib.rect(a, 4, 4, 2, 42, c["g"])
    lib.rect(a, 8, 10, 16, 8, c["d"])
    draw_text(a, "712", 10, 12, c["a"])
    lib.rect(a, 24, 26, 2, 4, c["a"])
    lib.rect(a, 6, 40, 20, 2, c["d"])
    return finish(a, OO)


def vieille_dame(f=0):
    """La Vieille Dame : cafetière à piston de 1987, chrome et ambre, vapeur."""
    a = mk(32, 32)
    lib.rect(a, 6, 22, 20, 8, c["h"])
    lib.rect(a, 6, 22, 20, 1, c["z"])
    lib.rect(a, 9, 6, 14, 16, c["b"])
    lib.rect(a, 9, 6, 3, 16, c["w"])
    lib.rect(a, 20, 6, 3, 16, c["g"])
    lib.ellipse(a, 16, 6, 8, 3, c["s"])
    lib.ellipse(a, 15, 5, 6, 2, c["b"])
    lib.rect(a, 15, 0, 3, 4, c["a"])
    lib.rect(a, 12, 11, 8, 6, c["a"])
    lib.rect(a, 13, 12, 6, 4, c["y"] if f % 2 else c["a"])
    draw_text(a, "87", 13, 12, c["h"])
    lib.rect(a, 23, 12, 5, 2, c["s"])
    lib.rect(a, 26, 14, 2, 4, c["s"])
    lib.rect(a, 25, 18, 3, 1, c["h"])
    lib.rect(a, 10, 23, 3, 3, c["q"])
    a = finish(a, OO)
    for k in range(3):
        y = 2 - ((f + k) % 3)
        x = 18 + k * 2
        if 0 <= y and a[y + 1, x] == 0:
            a[y + 1, x] = c["q"]
    return a


def lanterne(f=0):
    a = mk(16, 16)
    lib.rect(a, 6, 1, 4, 2, c["d"])
    lib.rect(a, 4, 3, 8, 10, c["h"])
    lib.rect(a, 5, 4, 6, 8, c[("a", "y", "a", "y")[f]])
    lib.rect(a, 6, 5, 4, 6, c[("y", "Z", "y", "Z")[f]])
    lib.rect(a, 7, 6, 2, 3, c["W"] if f in (1, 3) else c["Z"])
    lib.rect(a, 4, 13, 8, 2, c["d"])
    lib.rect(a, 4, 3, 1, 10, c["z"])
    return finish(a, OO)


# --------------------------------------------------------------------------
# Trains (vus de dessus, 192×48, livrée générique)
# --------------------------------------------------------------------------

def train(motrice):
    """Rame vue de dessus : toit cylindrique en bandes (rehaut froid en haut,
    ombre en bas), salissures, livrée bleue / jaune, vitrages sombres à
    reflet, phare émissif sur la motrice."""
    a = mk(192, 48)
    bands = ["w", "7", "7", "b", "b", "b", "b", "b", "b", "b", "b", "b", "b", "b", "b", "b", "b", "g", "g", "g", "g",
             "g", "s"]
    for k, col in enumerate(bands):
        lib.rect(a, 2, 6 + k, 188, 1, c[col])
    g = lib.rng(7 if motrice else 8)
    for _ in range(60):  # salissures du toit
        x, y = int(g.integers(4, 186)), int(g.integers(9, 26))
        if a[y, x] == c["b"]:
            a[y, x] = c["g"]
    # flanc : vitrages + livrée
    lib.rect(a, 2, 29, 188, 1, c["s"])
    lib.rect(a, 2, 30, 188, 4, c["I"])
    lib.rect(a, 2, 30, 188, 1, c["c"])
    lib.rect(a, 2, 34, 188, 2, c["y"])
    lib.rect(a, 2, 34, 188, 1, c["Z"])
    lib.rect(a, 2, 36, 188, 3, c["s"])
    lib.rect(a, 2, 39, 188, 3, c["D"])
    lib.rect(a, 2, 39, 188, 1, c["d"])
    # toit : blocs de climatisation (volume éclairé haut-gauche), aérations
    for x in range(20, 170, 50):
        lib.rect(a, x + 1, 13, 24, 12, c["s"])  # ombre portée
        lib.rect(a, x, 12, 24, 12, c["g"])
        lib.rect(a, x, 12, 24, 1, c["7"])
        lib.rect(a, x, 12, 1, 12, c["b"])
        for k in range(x + 2, x + 22, 3):
            lib.rect(a, k, 14, 1, 8, c["d"])
            lib.px(a, k, 14, c["s"])
    if motrice:
        # nez profilé et pantographe
        lib.rect(a, 172, 8, 18, 32, c["g"])
        lib.rect(a, 172, 8, 18, 1, c["7"])
        lib.rect(a, 182, 10, 8, 28, c["n"])
        lib.rect(a, 183, 11, 3, 26, c["c"])
        lib.rect(a, 183, 11, 1, 26, c["v"])
        lib.line(a, 100, 18, 130, 12, c["d"])
        lib.line(a, 100, 18, 130, 24, c["d"])
        lib.line(a, 130, 12, 130, 24, c["7"])
        lib.rect(a, 98, 16, 4, 4, c["d"])
        lib.rect(a, 186, 30, 3, 3, c["Z"])
        lib.px(a, 187, 31, c["W"])
    else:
        for x in range(8, 186, 12):
            lib.rect(a, x, 27, 8, 2, c["n"])
            lib.px(a, x, 27, c["v"])
    lib.rect(a, 0, 20, 2, 8, c["d"])
    lib.rect(a, 190, 20, 2, 8, c["d"])
    return finish(a, QO)


# --------------------------------------------------------------------------
# Atlas
# --------------------------------------------------------------------------

def pack(items, size=256, pad=2):
    """Rangement en étagères ; renvoie (image, frames dict Phaser JSON Hash)."""
    atlas = canvas(size, size)
    frames = {}
    x = y = 0
    shelf = 0
    for name, img in sorted(items, key=lambda kv: -kv[1].shape[0]):
        h, w = img.shape
        if x + w > size:
            x = 0
            y += shelf + pad
            shelf = 0
        assert y + h <= size, f"atlas plein ({name})"
        blit(atlas, img, x, y)
        frames[name] = {"frame": {"x": x, "y": y, "w": w, "h": h}, "rotated": False, "trimmed": False,
                        "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h}, "sourceSize": {"w": w, "h": h},
                        "pivot": {"x": 0.5, "y": 1.0}}
        x += w + pad
        shelf = max(shelf, h)
    return atlas, frames


QUAIS = lambda: [  # noqa: E731
    ("banc-h", banc_h()), ("banc-v", banc_v()), ("poubelle", poubelle()), ("distributeur", distributeur()),
    ("compostage", compostage()), ("panneau-voie1", panneau_quai(1)), ("panneau-voie2", panneau_quai(2)),
    ("horloge", horloge()), ("ecran-departs", ecran_departs()), ("pilier", pilier()), ("extincteur", extincteur()),
    ("cone", cone()), ("barriere", barriere()), ("valise-a", valise(0)), ("valise-b", valise(1)),
    ("chariot", chariot()), ("catenaire", catenaire()), ("signal-rouge", signal_prop(False)),
    ("signal-vert", signal_prop(True)), ("portique", portique(0)),
]
OCC = lambda: [  # noqa: E731
    ("comptoir", comptoir()), ("canape", canape()), ("canape-neuf", canape(True)), ("table-tasses", table_tasses()),
    ("etagere-lanternes", etagere_lanternes()), ("casiers", casiers()), ("tableau-palettes", tableau_palettes()),
    ("tableau-liege", tableau_liege()), ("etabli", etabli()), ("porte-service", porte_service()),
    ("vieille-dame", vieille_dame(0)), ("lanterne", lanterne(0)),
]


def build(emit):
    p = "tilesets/props"
    emit(p, "poubelle_break_strip5", [_pad(poubelle(s), 32) for s in (0, 1, 2, 3, 3)], 60)
    emit(p, "distributeur_break_strip6", [_pad(distributeur(b), 48) for b in (0, 1, 1, 2, 2, 2)], 70)
    emit(p, "sortie-portique_open_strip6", [portique(i) for i in range(6)], 90)
    emit(p, "vieille-dame_idle_strip4", [vieille_dame(i) for i in range(4)], 200, loop=True)
    emit(p, "lanterne_idle_strip4", [lanterne(i) for i in range(4)], 200, loop=True)


def _pad(img, S):
    out = canvas(S)
    h, w = img.shape
    blit(out, img, (S - w) // 2, S - h)
    return out


def build_images(emit_image, write_json):
    p = "tilesets/props"
    for group, items in (("quais", QUAIS()), ("occ", OCC())):
        for name, img in items:
            h, w = img.shape
            emit_image(p, f"prop_{name}", img, pivot=(w // 2, h), group="tilesets/props")
        atlas, frames = pack(items)
        e = emit_image("tilesets", f"props_{group}", atlas, kind="atlas", preview=False,
                       extra={"atlas": f"assets/tilesets/props_{group}.json"})
        write_json(f"tilesets/props_{group}.json", {
            "frames": frames,
            "meta": {"app": "Privatix tools/pixelart", "image": f"props_{group}.png", "format": "RGBA8888",
                     "size": {"w": atlas.shape[1], "h": atlas.shape[0]}, "scale": "1"}})
    emit_image("tilesets", "train_motrice", train(True), pivot=(96, 24))
    emit_image("tilesets", "train_voiture", train(False), pivot=(96, 24))
