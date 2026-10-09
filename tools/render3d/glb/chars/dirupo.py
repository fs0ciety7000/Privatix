"""Boss satirique : caricature d'Elio Di Rupo (art_director §7.3), autorisée par le porteur du projet.

Entièrement modélisée en primitives procédurales : AUCUNE photo, aucune texture. Ton bon enfant :
l'orateur élégant des inaugurations, sympathique et reconnaissable, jamais enlaidi.
Repères de silhouette (ombre noire à 96 px) : grosse chevelure brune en champignon arrondi avec la
vague-mèche qui déborde vers l'avant, nœud papillon bordeaux surdimensionné (0,7 m), corps mince en
costume bleu marine. 2,6 m, tête ≈ 1/3 de la hauteur.

Os : 18 du contrat humanoïde + jaw, hair_front0..2 (mèche en chaîne), brow_L/R, bowtie (détachable :
projectile boomerang, échelle 0 quand il vole), glasses (de travers en « stagger »).
Le nœud et les lunettes ont leurs sockets (`socket_bowtie`, `socket_glasses`) pour les VFX (éclat).
"""
from __future__ import annotations

import math

import numpy as np

from ..geo import Model
from ..humanoid import Dims, humanoid_skeleton
from ..poses import P, Clip, ease_back, ease_in, ease_out, keyed, linear, merge

NAVY, NAVY_DARK, SHIRT, BOW, BOW_LIGHT = 0x1F2E55, 0x141A33, 0xECE8E2, 0x7A1E2C, 0xB23A4E
SKIN, SKIN_DARK, HAIR, HAIR_LIGHT, HAIR_DARK = 0xF0B48E, 0xD8906C, 0x5A3A24, 0x8A5E3C, 0x3E2618
BROW, SHOE, SILVER = 0x2E1C1A, 0x1A1620, 0xC8D0E0

DIMS = Dims(pelvis_y=0.98, spine=0.14, chest=0.22, neck=0.40, head=0.06, shoulder_w=0.29, shoulder_y=0.27, upper=0.33, fore=0.29, hip_w=0.12, hip_y=-0.03, thigh=0.47, shin=0.45, head_socket_y=0.72, back_z=-0.2, hip_socket_x=0.2)
HEAD_C = np.array([0.0, 0.28, 0.0])  # centre du crâne dans le repère de `head`


def _strand(m: Model, lat: float, u0: float, u1: float, r0: float, r1: float, color: int, bulge: float = 1.0) -> None:
    """Mèche-tube posée sur la calotte : méridien incliné de `lat` (rad) de u0 (arrière) à u1 (avant)."""
    c = np.array([0.0, 0.47, -0.1])
    R = np.array([0.37, 0.29, 0.37]) * 1.02 * bulge
    pts, rr = [], []
    n = 7
    for i in range(n):
        t = i / (n - 1)
        u = u0 + (u1 - u0) * t
        d = np.array([-math.sin(lat) * math.cos(u), math.cos(lat) * math.cos(u), math.sin(u)])
        pts.append(c + d * R)
        rr.append(r0 + (r1 - r0) * t + 0.03 * math.sin(math.pi * t))
    m.tube("head", color, pts, rr, seg=9)


def model() -> Model:
    m = Model("dirupo")
    humanoid_skeleton(m, DIMS)
    m.joint("jaw", "head", (0, 0.13, 0.17))
    m.joint("hair_front0", "head", (-0.12, 0.66, 0.2))
    m.joint("hair_front1", "hair_front0", (0.17, 0.0, 0.12))
    m.joint("hair_front2", "hair_front1", (0.14, -0.1, 0.03))
    for s, sx in (("L", 1), ("R", -1)):
        m.joint(f"brow_{s}", "head", (0.1 * sx, 0.39, 0.29))
    m.joint("glasses", "head", (0, 0.31, 0.31))
    m.joint("bowtie", "neck", (0, 0.03, 0.15))
    m.socket("socket_bowtie", "bowtie", (0, 0, 0.06))
    m.socket("socket_glasses", "glasses", (0.1, 0.0, 0.03))
    m.meta = {"kind": "boss", "height": 2.6, "radius": 0.7, "outline": 0x06302C, "rim": 0x6FF3FF}

    # Jambes : pantalon marine à pli, chaussures vernies
    for s in ("L", "R"):
        m.capsule(f"hip_{s}", NAVY, (0, 0, 0), (0, -0.46, 0), 0.105, 0.095)
        m.capsule(f"knee_{s}", NAVY, (0, 0, 0), (0, -0.4, 0), 0.09, 0.085)
        m.box(f"knee_{s}", NAVY_DARK, (0, -0.2, 0.085), (0.012, 0.36, 0.01), 0.004, outline=0)  # pli
        m.box(f"foot_{s}", SHOE, (0, 0.03, 0.06), (0.15, 0.1, 0.32), 0.05)
        m.sphere(f"foot_{s}", 0x6A6488, (0.02, 0.07, 0.17), (0.035, 0.012, 0.05), outline=0, seg=8, emit=0.3)  # reflet verni
    # Bassin, taille, veste cintrée à basques
    m.box("pelvis", NAVY, (0, 0, 0), (0.38, 0.2, 0.26), 0.08)
    m.box("spine", NAVY, (0, 0.04, 0), (0.36, 0.2, 0.25), 0.08)
    m.box("spine", NAVY, (0, -0.12, 0.0), (0.42, 0.22, 0.29), 0.08)  # basques de la veste
    m.box("spine", NAVY_DARK, (0, -0.12, 0.15), (0.02, 0.21, 0.01), 0.004, outline=0)  # fente avant
    m.box("chest", NAVY, (0, 0.11, 0), (0.56, 0.44, 0.3), 0.12)
    # plastron : chemise en V, revers biseautés, pochette
    m.box("chest", SHIRT, (0, 0.2, 0.142), (0.16, 0.3, 0.03), 0.012, outline=0)
    for sx in (1, -1):
        m.box("chest", NAVY_DARK, (0.085 * sx, 0.17, 0.152), (0.08, 0.34, 0.025), 0.01, rot=(0, 0, 20 * sx), outline=0)
    m.box("chest", SHIRT, (0.17, 0.2, 0.155), (0.07, 0.03, 0.012), 0.005, rot=(0, 0, 8), outline=0)  # pochette
    for i in range(2):
        m.cyl("spine", 0x0E1428, (0, 0.06 - i * 0.1, 0.13), 0.016, 0.012, rot=(90, 0, 0), seg=8, outline=0)
    m.box("chest", SHIRT, (0, 0.36, 0.03), (0.22, 0.07, 0.2), 0.03)  # col
    # Bras : épaules de veste nettes, manchettes blanches, mains
    for s, sx in (("L", 1), ("R", -1)):
        m.box(f"shoulder_{s}", NAVY, (0.02 * sx, 0.0, 0), (0.17, 0.12, 0.22), 0.05)
        m.capsule(f"shoulder_{s}", NAVY, (0, -0.02, 0), (0, -0.33, 0), 0.08, 0.075)
        m.capsule(f"elbow_{s}", NAVY, (0, 0, 0), (0, -0.24, 0), 0.072, 0.068)
        m.cyl(f"hand_{s}", SHIRT, (0, 0.04, 0), 0.07, 0.05, seg=12)
        m.cyl(f"hand_{s}", 0xD8B060, (0, 0.04, 0.07), 0.015, 0.02, rot=(90, 0, 0), seg=8, outline=0)  # bouton de manchette
        m.sphere(f"hand_{s}", SKIN, (0, -0.04, 0), (0.08, 0.09, 0.07))
        m.capsule(f"hand_{s}", SKIN, (0.035 * sx, -0.02, 0.04), (0.06 * sx, -0.07, 0.07), 0.025)  # pouce
    # Cou, tête ronde et sympathique
    m.cyl("neck", SKIN, (0, -0.02, 0), 0.085, 0.14)
    m.sphere("head", SKIN, tuple(HEAD_C), (0.3, 0.33, 0.29), seg=26)
    for sx in (1, -1):
        m.sphere("head", SKIN, (0.15 * sx, 0.17, 0.16), (0.11, 0.1, 0.1), outline=0, seg=12)  # joues rieuses
        m.sphere("head", 0xF08A80, (0.17 * sx, 0.2, 0.22), (0.05, 0.03, 0.02), outline=0, seg=8, emit=0.05)  # pommettes
    m.sphere("head", SKIN, (0, 0.06, 0.12), (0.13, 0.08, 0.13), seg=12, outline=0)  # menton léger
    m.sphere("head", SKIN_DARK, (0, 0.255, 0.29), (0.055, 0.058, 0.05), seg=12, outline=0.6)  # nez
    # Yeux rieurs (derrière les lunettes)
    for sx in (1, -1):
        m.sphere("head", 0x2A1A18, (0.1 * sx, 0.315, 0.282), (0.034, 0.038, 0.02), outline=0, seg=10)
        m.sphere("head", 0xFFFFFF, (0.1 * sx + 0.01, 0.327, 0.298), (0.01, 0.011, 0.005), outline=0, seg=6, emit=0.3)
    # Grand sourire franc : bouche en demi-lune, rangée de dents
    smile = [(math.cos(a) * 0.12, -math.sin(a) * 0.07) for a in np.linspace(0, math.pi, 13)]
    m.shape("jaw", 0x5A1E2A, (0, 0.0, 0.11), smile, 0.02, rot=(-12, 0, 0), outline=0)
    m.box("jaw", 0xFFFDF6, (0, -0.012, 0.122), (0.2, 0.03, 0.012), 0.006, rot=(-12, 0, 0), outline=0)
    m.sphere("jaw", 0xE07070, (0, -0.05, 0.11), (0.05, 0.015, 0.01), outline=0, seg=8)  # langue
    for sx in (1, -1):
        m.box("head", SKIN_DARK, (0.135 * sx, 0.14, 0.255), (0.012, 0.05, 0.012), 0.004, rot=(0, 0, 25 * sx), outline=0)  # fossettes
    # Sourcils sombres, épais, droits
    for s in ("L", "R"):
        m.box(f"brow_{s}", BROW, (0, 0, 0), (0.12, 0.035, 0.035), 0.012)
    # Lunettes sans monture : verres rectangulaires (matériau « glass »), pont et branches argentés
    for sx in (1, -1):
        m.box("glasses", 0xDDEBFF, (0.1 * sx, 0, 0), (0.12, 0.085, 0.006), 0.012, mat="glass", outline=0, emit=1.0)
        m.cyl("glasses", SILVER, (0.24 * sx, 0.015, -0.13), 0.006, 0.26, rot=(90, 0, 0), seg=5, outline=0)
        m.cyl("glasses", SILVER, (0.17 * sx, 0.015, -0.005), 0.006, 0.03, rot=(0, 0, 90), seg=5, outline=0)
    m.cyl("glasses", SILVER, (0, 0.018, 0.0), 0.006, 0.08, rot=(0, 0, 90), seg=5, outline=0)
    # Chevelure volumineuse : calotte, côtés couvrant les oreilles, nuque, mèches-tubes, vague-mèche
    m.sphere("head", HAIR, (0, 0.47, -0.1), (0.37, 0.29, 0.37), seg=24)
    for sx in (1, -1):
        m.sphere("head", HAIR, (0.27 * sx, 0.33, -0.06), (0.12, 0.2, 0.22), seg=14)
    m.sphere("head", HAIR, (0, 0.3, -0.16), (0.32, 0.3, 0.24), seg=16)
    for k in range(-4, 5):
        col = HAIR_LIGHT if k in (-1, 2) else (HAIR_DARK if k in (-4, 4) else HAIR)
        _strand(m, k * 0.27, -1.7, 0.62 if k > -3 else 0.35, 0.05, 0.035, col)
    # vague-mèche avant (os en chaîne) : balaie le front de sa droite vers sa gauche et déborde
    p0 = m.world("hair_front0")
    pts = [p0 + np.array(v) for v in [(-0.12, 0.02, -0.12), (0.0, 0.0, 0.0), (0.17, 0.0, 0.12), (0.31, -0.1, 0.15), (0.36, -0.2, 0.1)]]
    m.tube("root", HAIR, pts, [0.1, 0.13, 0.12, 0.08, 0.035], seg=12, bones=[("head", 0.0), ("hair_front0", 0.25), ("hair_front1", 0.55), ("hair_front2", 0.85)])
    pts2 = [p + np.array([0.0, 0.055, 0.0]) for p in pts[1:4]]
    m.tube("root", HAIR_LIGHT, pts2, [0.05, 0.06, 0.03], seg=8, bones=[("hair_front0", 0.0), ("hair_front1", 0.5), ("hair_front2", 1.0)], outline=0)
    # Nœud papillon surdimensionné (0,7 m) : deux ailes en fuseau aplati + nœud central satiné
    wing = [(0.03, 0.0), (0.1, 0.06), (0.15, 0.17), (0.16, 0.27), (0.12, 0.33), (0.0, 0.345)]
    for sx in (1, -1):
        m.lathe("bowtie", BOW, (0.03 * sx, 0, 0), wing, rot=(0, 0, -90 * sx), seg=14, scale=(1.0, 1.0, 0.42), emit=0.08)
        m.box("bowtie", BOW_LIGHT, (0.2 * sx, 0.07, 0.065), (0.16, 0.025, 0.01), 0.008, rot=(0, 0, 18 * sx), outline=0, emit=0.15)  # reflet satin
    m.sphere("bowtie", BOW, (0, 0, 0.01), (0.07, 0.08, 0.065), seg=12)
    m.box("bowtie", BOW_LIGHT, (0, 0.03, 0.065), (0.05, 0.015, 0.01), 0.005, outline=0, emit=0.2)
    return m


# ─── Poses ────────────────────────────────────────────────────────────────────

REST = {"hip_L": (-2, 0, 3), "hip_R": (2, 0, -3), "knee_L": (4, 0, 0), "knee_R": (4, 0, 0), "foot_L": (-2, 0, -6), "foot_R": (-2, 0, 6), "elbow_L": (-14, 0, 0), "elbow_R": (-14, 0, 0), "shoulder_L": (0, 0, 6), "shoulder_R": (0, 0, -6)}


def idle(t: float) -> dict:
    """Orateur : main droite levée qui ponctue le discours, gauche sur le cœur, sourire."""
    w = 2 * math.pi / 2.4
    b = math.sin(t * w)
    beat = max(0.0, math.sin(t * w * 2)) ** 2
    rot = {
        **REST,
        "spine": (-2 + b, 0, 0), "chest": (-4, 6 * b, 0), "neck": (2, 0, 0), "head": (-4 + 3 * beat, -8 * b, 3 * b),
        "shoulder_R": (-60 - 12 * beat, 0, -24), "elbow_R": (-70 + 10 * beat, 0, 0), "hand_R": (-20, 0, 10),
        "shoulder_L": (-24, 0, 12), "elbow_L": (-100, 0, 0), "hand_L": (0, 0, -30),
        "jaw": (6 + 8 * beat, 0, 0), "brow_L": (0, 0, 0), "brow_R": (0, 0, 0),
        "hair_front0": (2 * b, 0, 0), "hair_front1": (3 * b, 0, 0), "hair_front2": (5 * b, 0, 0),
    }
    return P(rot, root=(0, 0.008 * b, 0), loc={"brow_L": (0, 0.012 * beat, 0), "brow_R": (0, 0.012 * beat, 0)})


def walk(ph: float) -> dict:
    """Pas assuré, menton haut, bras qui balancent avec élégance."""
    s, c = math.sin(ph), math.cos(ph)
    a = 26 * s
    rot = {
        "pelvis": (0, 7 * s, 2 * s), "spine": (-4, -4 * s, 0), "chest": (-2, -8 * s, 0), "head": (-6, 5 * s, 0),
        "shoulder_L": (a * 0.7, 0, 6), "elbow_L": (-20, 0, 0), "shoulder_R": (-a * 0.7, 0, -6), "elbow_R": (-20, 0, 0),
        "hip_L": (-a, 0, 2), "knee_L": (8 + 50 * max(0, c), 0, 0), "foot_L": (-6 * s, 0, 0),
        "hip_R": (a, 0, -2), "knee_R": (8 + 50 * max(0, -c), 0, 0), "foot_R": (6 * s, 0, 0),
        "jaw": (4, 0, 0), "hair_front1": (6 * c, 0, 0), "hair_front2": (10 * c, 0, 0),
    }
    return P(rot, root=(0, -0.02 + 0.04 * abs(c), 0))


ADJUST = P({**REST, "chest": (-4, 0, 0), "head": (-8, 0, 0), "shoulder_R": (-70, 0, 20), "elbow_R": (-110, 0, 0), "hand_R": (0, 0, 40), "shoulder_L": (-70, 0, -20), "elbow_L": (-110, 0, 0), "hand_L": (0, 0, -40), "jaw": (2, 0, 0)}, loc={"brow_L": (0, 0.02, 0), "brow_R": (0, 0.02, 0)})
SMILE = P({**REST, "head": (-10, 0, 6), "shoulder_R": (-20, 0, -14), "shoulder_L": (-20, 0, 14), "jaw": (16, 0, 0), "chest": (-6, 0, 0)}, loc={"brow_L": (0, 0.03, 0), "brow_R": (0, 0.03, 0)}, scale=(0.97, 1.04, 0.97))


def intro(t: float) -> dict:
    back = merge(idle(0), rot={"root": (0, 180, 0), "head": (0, 0, 0)})
    turn = merge(idle(0), rot={"root": (0, 30, 0)})
    return keyed([(0, back), (500, back), (900, turn, ease_out), (1050, merge(ADJUST, rot={"root": (0, 0, 0)}), ease_out), (1450, ADJUST), (1700, SMILE, ease_back), (2100, SMILE)], t)


def bowtie_throw(t: float) -> dict:
    """Ajuste son nœud (éclat des lunettes), arme le bras et lance le nœud en boomerang (échelle 0)."""
    wind = P({**REST, "spine": (-6, 30, 0), "chest": (-4, 24, 0), "head": (0, -30, 0), "shoulder_R": (-40, 30, -70), "elbow_R": (-60, 0, 0), "hand_R": (0, 0, 0), "shoulder_L": (-50, 0, 30), "elbow_L": (-40, 0, 0), "hip_L": (-14, 0, 6), "hip_R": (10, 0, -6), "knee_L": (14, 0, 0), "jaw": (6, 0, 0)},
             loc={"bowtie": (-0.22, -0.28, 0.25)}, root=(0, -0.04, -0.04))
    throw = P({**REST, "spine": (8, -36, 0), "chest": (6, -30, 0), "head": (4, 20, 0), "shoulder_R": (-95, -30, 20), "elbow_R": (-6, 0, 0), "shoulder_L": (-20, 0, 50), "elbow_L": (-40, 0, 0), "hip_L": (-24, 0, 6), "knee_L": (24, 0, 0), "hip_R": (16, 0, -6), "jaw": (18, 0, 0)},
              root=(0, -0.06, 0.12), scl={"bowtie": (0.001, 0.001, 0.001)})
    gone = merge(idle(0), scl={"bowtie": (0.001, 0.001, 0.001)})
    return keyed([(0, idle(0)), (250, ADJUST, ease_out), (420, ADJUST), (620, wind, ease_out), (700, merge(wind, scl={"bowtie": (1, 1, 1)})), (760, throw, ease_in), (1000, merge(throw, rot={"jaw": (14, 0, 0)})), (1300, gone)], t)


def inauguration(t: float) -> dict:
    """Tend le ruban géant à bout de bras, puis coup de ciseaux (main droite)."""
    hold = P({**REST, "spine": (-6, 0, 0), "chest": (-8, 0, 0), "head": (-10, 0, 0), "shoulder_L": (-80, 0, 70), "elbow_L": (-6, 0, 0), "shoulder_R": (-80, 0, -70), "elbow_R": (-6, 0, 0), "hip_L": (-6, 0, 10), "hip_R": (6, 0, -10), "jaw": (14, 0, 0)},
             loc={"brow_L": (0, 0.03, 0), "brow_R": (0, 0.03, 0)}, scale=(1.0, 1.02, 1.0))
    snip_open = merge(hold, rot={"shoulder_R": (-90, -30, -30), "elbow_R": (-50, 0, 0), "hand_R": (0, 0, 40), "chest": (-4, 14, 0)})
    snip = merge(hold, rot={"shoulder_R": (-86, 30, -20), "elbow_R": (-30, 0, 0), "hand_R": (0, 0, -20), "chest": (0, -14, 0), "head": (4, -10, 0), "jaw": (24, 0, 0)}, scale=(1.04, 0.96, 1.04))
    return keyed([(0, idle(0)), (400, hold, ease_out), (850, snip_open, ease_out), (1000, snip, ease_in), (1150, snip), (1600, idle(0))], t)


def hair_swipe(t: float) -> dict:
    """Coup de mèche : il se retourne vivement, la mèche balaie un arc de 120°."""
    spin = lambda y, f0, f1: merge(idle(0), rot={"root": (0, y, 0), "head": (6, -y * 0.2, 0), "hair_front0": (f0, 0, 0), "hair_front1": (f1, -30, 0), "hair_front2": (f1, -40, 0)})  # noqa: E731
    return keyed([(0, idle(0)), (300, spin(40, -10, -10), ease_out), (430, spin(-140, 20, 30), ease_in), (520, spin(-200, 10, 40), linear), (700, spin(-360, -6, -10), ease_out), (800, idle(0))], t)


def smile_flash(t: float) -> dict:
    big = merge(SMILE, rot={"head": (-16, 0, 0), "jaw": (24, 0, 0), "shoulder_R": (-150, 0, -30), "elbow_R": (-20, 0, 0), "hand_R": (0, 0, 0)}, scale=(0.95, 1.08, 0.95))
    return keyed([(0, idle(0)), (500, merge(SMILE, rot={"shoulder_R": (-120, 0, -30)}), ease_out), (800, big, ease_back), (1100, big), (1400, idle(0))], t)


HURT = P({**REST, "spine": (-14, 0, 6), "chest": (-10, 0, 0), "head": (-20, 0, 10), "shoulder_L": (-40, 0, 50), "shoulder_R": (-40, 0, -50), "elbow_L": (-40, 0, 0), "elbow_R": (-40, 0, 0), "jaw": (20, 0, 0), "glasses": (0, 0, 8), "hair_front1": (-20, 0, 0), "hair_front2": (-30, 0, 0)}, root=(0, -0.04, -0.12))


def stagger(t: float) -> dict:
    """Étourdi : lunettes de travers, mèche qui retombe, il titube."""
    w = 2 * math.pi / 1.0
    s = math.sin(t * w)
    rot = {**REST, "spine": (4, 0, 8 * s), "chest": (6, 0, 6 * s), "head": (10, 12 * s, -10 * s), "glasses": (0, 0, 16), "jaw": (10, 0, 0),
           "shoulder_L": (-10, 0, 30), "shoulder_R": (-10, 0, -30), "elbow_L": (-30, 0, 0), "elbow_R": (-30, 0, 0),
           "hair_front0": (20, 0, 0), "hair_front1": (30, 0, 0), "hair_front2": (40, 0, 0), "hip_L": (-6, 0, 8 + 4 * s), "hip_R": (6, 0, -8 + 4 * s), "knee_L": (14, 0, 0), "knee_R": (14, 0, 0)}
    return P(rot, root=(0.05 * s, -0.04, 0), loc={"glasses": (0.02, -0.03, 0.0)})


def defeat(t: float) -> dict:
    """Défaite digne : il s'assoit, redresse son nœud papillon et salue le joueur."""
    sit = P({"pelvis": (0, 0, 0), "spine": (6, 0, 0), "chest": (4, 0, 0), "head": (6, 0, 0), "hip_L": (-84, 0, 14), "hip_R": (-84, 0, -14), "knee_L": (24, 0, 0), "knee_R": (30, 0, 0), "foot_L": (-20, 0, 0), "foot_R": (-20, 0, 0),
             "shoulder_L": (-20, 0, 16), "shoulder_R": (-20, 0, -16), "elbow_L": (-60, 0, 0), "elbow_R": (-60, 0, 0), "glasses": (0, 0, 10), "jaw": (4, 0, 0)}, root=(0, -0.84, -0.12))
    fix = merge(sit, rot={"shoulder_R": (-70, 0, 20), "elbow_R": (-110, 0, 0), "hand_R": (0, 0, 40), "shoulder_L": (-70, 0, -20), "elbow_L": (-110, 0, 0), "hand_L": (0, 0, -40), "head": (-6, 0, 0), "glasses": (0, 0, 0)})
    salute = merge(sit, rot={"shoulder_R": (-160, 0, -20), "elbow_R": (-60, 0, 0), "hand_R": (0, 0, 0), "head": (-8, 0, 6), "jaw": (16, 0, 0), "glasses": (0, 0, 0)}, loc={"brow_L": (0, 0.03, 0), "brow_R": (0, 0.03, 0)})
    return keyed([(0, HURT), (500, merge(sit, root=(0, -0.76, -0.12)), ease_in), (650, sit, ease_out), (1100, fix, ease_out), (1500, fix), (1900, salute, ease_back), (2400, salute)], t)


def clips() -> list[Clip]:
    return [
        Clip("intro", 2.1, intro, events={"glint": 1700}),
        Clip("idle", 2.4, lambda t: idle(t / 1000), loop=True),
        Clip("walk", 0.9, lambda t: walk(2 * math.pi * t / 900), loop=True),
        Clip("attack-bowtie", 1.3, bowtie_throw, events={"windup": 0, "glint": 250, "active": 700, "recovery": 1000}),
        Clip("attack-inauguration", 1.6, inauguration, events={"windup": 0, "active": 1000, "recovery": 1150}),
        Clip("hair-swipe", 0.8, hair_swipe, events={"windup": 0, "active": 430, "recovery": 700}),
        Clip("smile-flash", 1.4, smile_flash, events={"windup": 0, "active": 800, "recovery": 1100}),
        Clip("hurt", 0.35, lambda t: keyed([(0, idle(0)), (80, HURT, ease_out), (350, idle(0))], t)),
        Clip("stagger", 1.0, lambda t: stagger(t / 1000), loop=True),
        Clip("defeat", 2.4, defeat),
    ]
