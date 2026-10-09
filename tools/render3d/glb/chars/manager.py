"""Manager KPI « Le Tableur » (élite, LORE § 6.4) : grand, carrure large en triangle inversé. Costume
trois-pièces turquoise foncé, gilet turquoise vif à boutons dorés, cravate violette Privatix,
lunettes rectangulaires, cheveux plaqués aux tempes grises, mâchoire carrée. Un **chronomètre doré**
pend à son cou (os `chrono`, qui balance avec retard) et il brandit une **tablette-graphique** (os
`tablet`, sous la main gauche) comme un sceptre.

Écran de la tablette et cadran du chronomètre : matériau « glow » à masque télégraphe (A = 1), ils
passent au magenta quand le jeu pousse `uTelegraph` (Reporting hebdo, Chronométrage).
Budget visé ≈ 6 k triangles (élite : au-dessus d'un ennemi de base, sous le héros équipé).

Os : 18 du contrat + `tie0`, `chrono`, `tablet`, `glasses`. Sockets humanoïdes + `socket_chrono`
(centre du cadran : zone de Ralenti) et `socket_tablet` (centre de l'écran : vague de graphiques).
"""
from __future__ import annotations

import math

from ..geo import Model
from ..humanoid import Dims, humanoid_skeleton
from ..poses import P, Clip, ease_back, ease_in, ease_out, keyed, merge

SUIT, SUIT_DARK, VEST, VEST_DARK, GOLD, GOLD_DARK = 0x0E5E5C, 0x094241, 0x1FD6C2, 0x12A897, 0xF2B93A, 0xB07A1C
SHIRT, TIE, TIE_LIGHT, SKIN, SKIN_DARK = 0xF2F4FA, 0x6B3CE0, 0x9A72FF, 0xE8AE86, 0xC98A66
HAIR, GREY, EYES, SHOE, SHELL, SCREEN = 0x2A2230, 0xC2C8D6, 0x14101A, 0x1A1620, 0x2C3350, 0x123A48

DIMS = Dims(pelvis_y=0.8, spine=0.12, chest=0.19, neck=0.37, head=0.05, shoulder_w=0.38, shoulder_y=0.22, upper=0.27, fore=0.24, hip_w=0.13, hip_y=-0.03, thigh=0.39, shin=0.37, head_socket_y=0.42, back_z=-0.22, hip_socket_x=0.24)

TAB_W, TAB_H = 0.5, 0.36


def model() -> Model:
    m = Model("manager")
    humanoid_skeleton(m, DIMS)
    m.joint("tie0", "chest", (0, 0.26, 0.19))
    m.joint("chrono", "neck", (0, 0.0, 0.16))
    m.joint("tablet", "hand_L", (0, -0.07, 0))
    m.joint("glasses", "head", (0, 0.2, 0.26))
    m.socket("socket_chrono", "chrono", (0, -0.3, 0.06))
    m.socket("socket_tablet", "tablet", (0, 0.2, 0.04))
    m.meta = {"kind": "elite", "height": 2.05, "radius": 0.55, "outline": 0x06302C, "rim": 0xFFD84A}

    # Jambes : pantalon à pli, chaussures vernies
    for s in ("L", "R"):
        m.capsule(f"hip_{s}", SUIT, (0, 0, 0), (0, -0.38, 0), 0.125, 0.11)
        m.capsule(f"knee_{s}", SUIT, (0, 0, 0), (0, -0.31, 0), 0.105, 0.095)
        m.box(f"knee_{s}", SUIT_DARK, (0, -0.16, 0.1), (0.012, 0.28, 0.01), 0.0, outline=0)
        m.box(f"foot_{s}", SHOE, (0, 0.04, 0.06), (0.2, 0.13, 0.36), 0.06, seg=1)
        m.sphere(f"foot_{s}", 0x6A6488, (0.02, 0.09, 0.17), (0.04, 0.012, 0.06), outline=0, seg=8, emit=0.3)
    # Bassin, gilet (ventre), veste ouverte
    m.box("pelvis", SUIT, (0, 0, 0), (0.48, 0.22, 0.32), 0.09, seg=1)
    m.box("spine", VEST, (0, 0.04, 0.0), (0.46, 0.26, 0.33), 0.1, seg=1)
    for sx in (1, -1):  # pointes du gilet
        m.box("spine", VEST, (0.07 * sx, -0.1, 0.14), (0.13, 0.1, 0.05), 0.0, rot=(0, 0, 30 * sx), outline=0)
    m.box("chest", SUIT, (0, 0.1, -0.02), (0.76, 0.46, 0.36), 0.14)  # veste : épaules carrées
    m.box("chest", VEST, (0, 0.06, 0.15), (0.3, 0.34, 0.06), 0.03, outline=0)  # gilet visible
    for k in range(4):
        y = 0.16 - k * 0.1
        part = "chest" if k < 2 else "spine"
        yy = y if k < 2 else y + DIMS.chest
        m.sphere(part, GOLD, (0, yy, 0.185 if k < 2 else 0.17), (0.026, 0.026, 0.018), outline=0, seg=8, emit=0.25)
    for sx in (1, -1):  # revers larges de la veste
        m.box("chest", SUIT_DARK, (0.15 * sx, 0.12, 0.165), (0.09, 0.38, 0.03), 0.0, rot=(0, 0, 18 * sx), outline=0)
        m.box("chest", VEST_DARK, (0.1 * sx, 0.04, 0.18), (0.012, 0.22, 0.01), 0.0, outline=0)  # couture du gilet
    m.box("chest", SHIRT, (0, 0.27, 0.16), (0.12, 0.12, 0.03), 0.0, outline=0)
    m.box("chest", SHIRT, (0, 0.31, 0.02), (0.3, 0.07, 0.24), 0.03, seg=1)  # col
    m.box("chest", TIE_LIGHT, (0.24, 0.19, 0.17), (0.08, 0.035, 0.012), 0.0, rot=(0, 0, 8), outline=0)  # pochette
    # Cravate violette
    m.box("tie0", TIE, (0, 0, 0), (0.07, 0.05, 0.05), 0.0, outline=0)
    m.box("tie0", TIE, (0, -0.1, 0.005), (0.085, 0.17, 0.02), 0.01, seg=1)
    # Bras : épaulettes carrées, manchettes, boutons de manchette dorés
    for s, sx in (("L", 1), ("R", -1)):
        m.box(f"shoulder_{s}", SUIT, (0.03 * sx, 0.0, 0), (0.22, 0.16, 0.28), 0.07, seg=1)
        m.capsule(f"shoulder_{s}", SUIT, (0, -0.03, 0), (0, -0.27, 0), 0.105, 0.095)
        m.capsule(f"elbow_{s}", SUIT, (0, 0, 0), (0, -0.19, 0), 0.092, 0.085)
        m.cyl(f"hand_{s}", SHIRT, (0, 0.045, 0), 0.08, 0.05, seg=12)
        m.cyl(f"hand_{s}", GOLD, (0, 0.045, 0.08), 0.016, 0.02, rot=(90, 0, 0), seg=8, outline=0, emit=0.2)
        m.sphere(f"hand_{s}", SKIN, (0, -0.04, 0), (0.1, 0.1, 0.095))
        m.capsule(f"hand_{s}", SKIN, (0.045 * sx, -0.02, 0.05), (0.075 * sx, -0.08, 0.08), 0.03)  # pouce
    # Cou épais, tête à mâchoire carrée
    m.cyl("neck", SKIN, (0, 0.0, 0), 0.105, 0.14)
    m.sphere("head", SKIN, (0, 0.2, 0.0), (0.26, 0.27, 0.25), seg=18)
    m.box("head", SKIN, (0, 0.06, 0.04), (0.42, 0.16, 0.36), 0.08, seg=1)  # mâchoire carrée
    m.sphere("head", SKIN_DARK, (0, 0.15, 0.27), (0.05, 0.06, 0.05), seg=10, outline=0.6)  # nez
    for sx in (1, -1):
        m.sphere("head", SKIN, (0.255 * sx, 0.17, 0.0), (0.05, 0.07, 0.045), seg=10)  # oreilles
        m.sphere("head", EYES, (0.095 * sx, 0.2, 0.243), (0.032, 0.036, 0.02), outline=0, seg=8)
        m.sphere("head", 0xFFFFFF, (0.095 * sx + 0.01, 0.212, 0.258), (0.009, 0.01, 0.005), outline=0, seg=6, emit=0.3)
        # sourcils épais, froncés vers le nez (sévère)
        m.box("head", HAIR, (0.1 * sx, 0.27, 0.25), (0.13, 0.038, 0.04), 0.0, rot=(0, 0, 14 * sx), outline=0)
    m.box("head", 0x7A3A3A, (0.02, 0.06, 0.22), (0.13, 0.02, 0.03), 0.0, rot=(0, 0, -5), outline=0)  # sourire en coin
    # Cheveux plaqués, raie sur le côté, tempes grises
    m.sphere("head", HAIR, (0, 0.27, -0.04), (0.27, 0.2, 0.25), seg=16)
    m.sphere("head", HAIR, (0.05, 0.37, 0.06), (0.21, 0.08, 0.18), seg=14, rot=(-8, 0, -6))
    m.box("head", SKIN, (0.1, 0.43, 0.08), (0.02, 0.012, 0.18), 0.0, rot=(0, 8, 0), outline=0)  # raie
    for sx in (1, -1):
        m.sphere("head", GREY, (0.235 * sx, 0.22, -0.03), (0.05, 0.1, 0.13), seg=10)
    # Lunettes rectangulaires à monture sombre
    for sx in (1, -1):
        for dy in (0.038, -0.038):
            m.box("glasses", EYES, (0.1 * sx, dy, 0), (0.15, 0.016, 0.02), 0.0, outline=0)
        for dx in (0.067, -0.067):
            m.box("glasses", EYES, (0.1 * sx + dx, 0, 0), (0.016, 0.09, 0.02), 0.0, outline=0)
        m.box("glasses", 0xDDEBFF, (0.1 * sx, 0, 0.0), (0.12, 0.06, 0.006), 0.0, mat="glass", outline=0, emit=1.0)
        m.box("glasses", EYES, (0.19 * sx, 0.01, -0.13), (0.012, 0.014, 0.26), 0.0, outline=0)
    m.box("glasses", EYES, (0, 0.012, 0.0), (0.06, 0.016, 0.016), 0.0, outline=0)
    # Chronomètre doré au bout d'une chaîne (os `chrono`, attaché au cou)
    for sx in (1, -1):
        m.box("chrono", GOLD_DARK, (0.07 * sx, -0.1, 0.0), (0.018, 0.2, 0.018), 0.0, rot=(0, 0, -16 * sx), outline=0)
    m.cyl("chrono", GOLD, (0, -0.3, 0.03), 0.12, 0.05, rot=(90, 0, 0), seg=16)
    m.torus("chrono", GOLD_DARK, (0, -0.3, 0.055), 0.115, 0.014, radial=6, tubular=20, outline=0)
    m.cyl("chrono", 0xFFF4D6, (0, -0.3, 0.058), 0.1, 0.006, rot=(90, 0, 0), seg=20, mat="glow", outline=0, emit=1.0)  # cadran
    m.box("chrono", EYES, (0, -0.26, 0.064), (0.014, 0.08, 0.006), 0.0, outline=0)  # aiguille
    m.box("chrono", 0xE0302A, (0.03, -0.31, 0.064), (0.06, 0.01, 0.006), 0.0, rot=(0, 0, 30), outline=0)  # trotteuse
    m.cyl("chrono", GOLD, (0, -0.16, 0.03), 0.025, 0.05, seg=10, outline=0.6)  # remontoir
    m.cyl("chrono", GOLD, (0, -0.13, 0.03), 0.04, 0.02, seg=10, outline=0)
    # Tablette-graphique : prise par le bas, écran vers +Z, panneau dans le plan XY
    m.box("tablet", SHELL, (0, TAB_H / 2, 0), (TAB_W, TAB_H, 0.035), 0.018, seg=1)
    m.box("tablet", SCREEN, (0, TAB_H / 2, 0.019), (TAB_W * 0.88, TAB_H * 0.82, 0.004), 0.0, mat="glow", outline=0, emit=1.0)
    for k, h in enumerate((0.08, 0.14, 0.11, 0.22)):
        m.box("tablet", (0x5FF7E4, 0x5FF7E4, 0xFFD84A, 0x5FF7E4)[k], (-0.15 + k * 0.1, 0.06 + h / 2, 0.023), (0.06, h, 0.004), 0.0, mat="glow", outline=0)
    m.box("tablet", 0xFFFFFF, (0.0, 0.25, 0.024), (0.38, 0.014, 0.004), 0.0, rot=(0, 0, 18), mat="glow", outline=0)  # courbe
    m.box("tablet", 0x5FF7E4, (0.2, 0.31, 0.024), (0.04, 0.04, 0.004), 0.0, rot=(0, 0, 45), mat="glow", outline=0)  # flèche
    return m


# ─── Poses ────────────────────────────────────────────────────────────────────

# La tablette suit la main gauche : on compense la rotation cumulée du bras pour garder l'écran droit.
REST = {"hip_L": (-2, 0, 4), "hip_R": (2, 0, -4), "knee_L": (4, 0, 0), "knee_R": (4, 0, 0), "foot_L": (-2, 0, -4), "foot_R": (-2, 0, 4)}


def stance(t: float = 0.0) -> dict:
    """Repos : tablette brandie à hauteur de poitrine (écran vers l'avant), index droit sur le graphique."""
    w = 2 * math.pi / 2.6
    b = math.sin(t * w)
    tap = max(0.0, math.sin(t * w * 2)) ** 4
    return P(
        {
            **REST,
            "spine": (-3 + b, 0, 0), "chest": (-5 - b, 8, 0), "neck": (2, 0, 0), "head": (-6 + b, -10, 2),
            "shoulder_L": (-30, 10, 18), "elbow_L": (-62, 0, 0), "hand_L": (0, 0, 0), "tablet": (92, -24, -6),
            "shoulder_R": (-26, -20, -16), "elbow_R": (-70 - 8 * tap, 0, 0), "hand_R": (-10, 0, 0),
            "chrono": (-6 + 4 * b, 0, 3 * math.sin(t * w + 1)),
        },
        root=(0, 0.006 * b, 0),
    )


def walk(ph: float) -> dict:
    s, c = math.sin(ph), math.cos(ph)
    a = 24 * s
    p = stance(0)
    return merge(
        p,
        rot={
            "pelvis": (0, 6 * s, 2 * s), "spine": (2, -4 * s, 0), "chest": (-4, 8 - 6 * s, 0), "head": (-6, -10 + 5 * s, 0),
            "shoulder_R": (a * 0.8, 0, -8), "elbow_R": (-24, 0, 0),
            "hip_L": (-a, 0, 3), "knee_L": (8 + 46 * max(0, c), 0, 0), "foot_L": (-4 * s, 0, 0),
            "hip_R": (a, 0, -3), "knee_R": (8 + 46 * max(0, -c), 0, 0), "foot_R": (4 * s, 0, 0),
            "chrono": (-8 + 10 * abs(c), 0, 12 * s),
        },
        root=(0, -0.02 + 0.04 * abs(c), 0),
    )


# Reporting hebdo : il lève la tablette à deux mains au-dessus de la tête (écran magenta), puis l'abat.
RAISE = P(
    {
        **REST, "spine": (-14, 0, 0), "chest": (-12, 0, 0), "head": (-14, 0, 0),
        "shoulder_L": (-168, 0, -14), "elbow_L": (-18, 0, 0), "hand_L": (0, 0, 0), "tablet": (16, 0, -10),
        "shoulder_R": (-168, 0, 14), "elbow_R": (-20, 0, 0), "hand_R": (0, 0, 0),
        "hip_L": (-16, 0, 6), "knee_L": (20, 0, 0), "foot_L": (-6, 0, 0), "hip_R": (10, 0, -6), "knee_R": (14, 0, 0), "foot_R": (-24, 0, 0),
        "chrono": (24, 0, 0),
    },
    root=(0, 0.04, -0.06),
    scale=(0.96, 1.05, 0.96),
)
SLAM = P(
    {
        **REST, "spine": (34, 0, 0), "chest": (16, 0, 0), "head": (-18, 0, 0),
        "shoulder_L": (-82, 0, -14), "elbow_L": (-8, 0, 0), "tablet": (-70, 0, -10),
        "shoulder_R": (-82, 0, 14), "elbow_R": (-8, 0, 0),
        "hip_L": (-46, 0, 6), "knee_L": (60, 0, 0), "foot_L": (-14, 0, 0), "hip_R": (24, 0, -6), "knee_R": (40, 0, 0), "foot_R": (-60, 0, 0),
        "chrono": (-50, 0, 0),
    },
    root=(0, -0.2, 0.2),
    scale=(1.08, 0.9, 1.08),
)

# Chronométrage : il brandit le chronomètre à bout de bras, l'autre main pointée (zone de Ralenti).
CLOCK = P(
    {
        **REST, "spine": (-6, -20, 0), "chest": (-8, -16, 0), "head": (-10, 20, 0),
        "shoulder_L": (-40, 10, 20), "elbow_L": (-70, 0, 0), "tablet": (96, -20, 0),
        "shoulder_R": (-70, -30, -6), "elbow_R": (-60, 0, 0), "hand_R": (-20, 0, 0),
        "hip_L": (-10, 0, 8), "hip_R": (8, 0, -10), "knee_L": (12, 0, 0), "knee_R": (6, 0, 0),
        "chrono": (-62, 0, 0),
    },
    root=(0, 0.02, 0.04),
)

# Réunion d'alignement : bras écartés, tablette tenue haut, il « aligne » ses troupes (boucliers).
ALIGN = P(
    {
        **REST, "spine": (-8, 0, 0), "chest": (-10, 0, 0), "head": (-12, 0, 0),
        "shoulder_L": (-120, 0, 40), "elbow_L": (-20, 0, 0), "tablet": (40, 0, -20),
        "shoulder_R": (-20, 0, -80), "elbow_R": (-10, 0, 0), "hand_R": (0, 0, -20),
        "hip_L": (-4, 0, 12), "hip_R": (4, 0, -12), "knee_L": (8, 0, 0), "knee_R": (8, 0, 0),
        "chrono": (10, 0, 0),
    },
    root=(0, 0.02, 0),
    scale=(1.03, 1.03, 1.03),
)

HURT = P(
    {
        **REST, "spine": (-20, 0, 8), "chest": (-12, 0, 0), "head": (-22, 0, -10),
        "shoulder_L": (-50, 0, 50), "elbow_L": (-50, 0, 0), "tablet": (80, 0, 30),
        "shoulder_R": (-40, 0, -50), "elbow_R": (-40, 0, 0), "glasses": (0, 0, 10),
        "hip_L": (-18, 0, 6), "knee_L": (22, 0, 0), "hip_R": (12, 0, -6), "knee_R": (18, 0, 0), "foot_R": (-30, 0, 0),
        "chrono": (50, 0, 20),
    },
    root=(0, -0.04, -0.12),
)

KNEES = P(
    {
        "spine": (18, 0, -6), "chest": (6, 0, 0), "head": (24, 0, 6), "hip_L": (-20, 0, 6), "hip_R": (-14, 0, -6),
        "knee_L": (100, 0, 0), "knee_R": (96, 0, 0), "foot_L": (-40, 0, 0), "foot_R": (-40, 0, 0),
        "shoulder_L": (-20, 0, 20), "elbow_L": (-40, 0, 0), "tablet": (40, 0, 0), "shoulder_R": (-10, 0, -20), "elbow_R": (-20, 0, 0),
        "chrono": (-20, 0, 0), "glasses": (0, 0, 12),
    },
    root=(0, -0.42, -0.1),
)
DEAD = P(
    {
        "root": (-84, 0, 0), "spine": (-6, 0, 0), "head": (-20, 24, 0),
        "shoulder_L": (-150, 0, 50), "elbow_L": (-20, 0, 0), "tablet": (0, 0, 0), "shoulder_R": (-140, 0, -60), "elbow_R": (-20, 0, 0),
        "hip_L": (-30, 0, 14), "knee_L": (40, 0, 0), "hip_R": (-10, 0, -10), "knee_R": (20, 0, 0), "chrono": (60, 0, 0), "glasses": (0, 0, 20),
    },
    root=(0, 0.18, -0.2),
)


def tie(pose: dict, t_s: float, tv: float) -> dict:
    pose["rot"]["tie0"] = (-6 - tv * 26 + math.sin(t_s * 2 * math.pi / 0.8) * 6 * tv, 0, math.sin(t_s * 6) * 6 * tv)
    return pose


def _t(fn, tv):
    return lambda t: tie(fn(t), t / 1000, tv)


WINDUP, ACTIVE, RECOVER = 800, 140, 700


def attack_report(t: float) -> dict:
    return keyed(
        [
            (0, stance(0)),
            (WINDUP * 0.5, merge(RAISE, scale=(1, 1, 1)), ease_out),
            (WINDUP, RAISE),
            (WINDUP + ACTIVE * 0.6, SLAM, ease_in),
            (WINDUP + ACTIVE, SLAM),
            (WINDUP + ACTIVE + RECOVER * 0.5, merge(SLAM, rot={"chrono": (-20, 0, 0)})),
            (WINDUP + ACTIVE + RECOVER, stance(0)),
        ],
        t,
    )


def attack_clock(t: float) -> dict:
    return keyed([(0, stance(0)), (400, CLOCK, ease_out), (650, merge(CLOCK, rot={"chrono": (-70, 0, 6)})), (900, CLOCK), (1300, stance(0))], t)


def shield(t: float) -> dict:
    return keyed([(0, stance(0)), (350, ALIGN, ease_back), (900, ALIGN), (1200, stance(0))], t)


def death(t: float) -> dict:
    return keyed([(0, HURT), (300, KNEES, ease_out), (650, KNEES), (950, DEAD, ease_in), (1050, merge(DEAD, root=(0, 0.26, -0.2)), ease_out), (1200, DEAD, ease_in), (1500, DEAD)], t)


def spawn(t: float) -> dict:
    tiny = merge(stance(0), scale=(0.01, 0.01, 0.01))
    big = merge(stance(0), scale=(1.12, 1.12, 1.12))
    return keyed([(0, tiny), (330, big, ease_out), (480, stance(0), ease_back)], t)


def clips() -> list[Clip]:
    return [
        Clip("idle", 2.6, _t(lambda t: stance(t / 1000), 0.0), loop=True),
        Clip("walk", 0.6, _t(lambda t: walk(2 * math.pi * t / 600), 1.0), loop=True),
        Clip("attack-report", (WINDUP + ACTIVE + RECOVER) / 1000, _t(attack_report, 0.6), events={"windup": 0, "active": WINDUP, "recovery": WINDUP + ACTIVE}),
        Clip("attack-chrono", 1.3, _t(attack_clock, 0.3), events={"windup": 0, "active": 650, "recovery": 900}),
        Clip("shield", 1.2, _t(shield, 0.4), events={"windup": 0, "active": 350, "recovery": 900}),
        Clip("hurt", 0.32, _t(lambda t: keyed([(0, stance(0)), (80, HURT, ease_out), (320, HURT)], t), 1.2)),
        Clip("death", 1.5, _t(death, 1.0)),
        Clip("spawn", 0.48, _t(spawn, 0.3)),
    ]
