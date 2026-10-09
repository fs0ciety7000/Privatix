"""PNJ du Centre Opérationnel (OCC, LORE § 4) : Josiane (DPD), Béné (PACO) et Kevin (RTS).

Même squelette humanoïde que le héros (les clips s'échangent), contour sombre `#14101A` des PNJ et des
silhouettes lisibles à 20 m de caméra : un accessoire signature par personnage.

- **Josiane Delhaye** : accompagnatrice de train, 28 ans de maison. Képi, veste d'uniforme bleu nuit à
  liseré rouge, écharpe tricotée, chignon gris, **thermos** (son Souvenir) et sifflet.
- **Bénédicte « Béné » Wautier** : guichetière. Cardigan prune, lunettes en demi-lune au bout d'une
  chaîne, chignon haut, **classeur « Le Règlement »** sous le bras et **tampon** « Numéro suivant ».
- **Kevin « Kéké » Lambot** : technicien caténaires de l'Infra. Grand et rond, veste haute visibilité
  jaune (l'autre maison), casque blanc, barbe, ceinture à outils, **pince à caténaire**.

Budget visé ≈ 4 à 5 k triangles chacun. Os : 18 du contrat + `prop` (accessoire en main droite) et
`prop_L` (main gauche). Clips : idle, walk, talk, wave.
"""
from __future__ import annotations

import math

from ..geo import Model
from ..humanoid import Dims, humanoid_skeleton
from ..poses import P, Clip, ease_back, ease_out, keyed, merge

INK = 0x14101A
CAT = 0xFFFFFF


def _base(name: str, d: Dims, height: float, rim: int) -> Model:
    m = Model(name)
    humanoid_skeleton(m, d)
    m.joint("prop", "hand_R", (0, -0.06, 0))
    m.joint("prop_L", "hand_L", (0, -0.06, 0))
    m.meta = {"kind": "npc", "height": height, "radius": 0.4, "outline": 0x14101A, "rim": rim}
    return m


def _face(m: Model, skin: int, skin_dark: int, brow: int, r=(0.25, 0.26, 0.24), y: float = 0.17, smile: float = 1.0) -> None:
    m.cyl("neck", skin, (0, 0, 0), 0.075, 0.1, seg=10)
    m.sphere("head", skin, (0, y, 0.01), r, seg=18)
    m.sphere("head", skin_dark, (0, y - 0.03, r[2] + 0.005), (0.045, 0.05, 0.045), seg=8, outline=0.6)
    for sx in (1, -1):
        m.sphere("head", skin, (r[0] * 0.98 * sx, y - 0.02, 0.0), (0.045, 0.062, 0.04), seg=8)
        m.sphere("head", INK, (0.088 * sx, y + 0.02, r[2] * 0.9), (0.028, 0.036, 0.018), outline=0, seg=8)
        m.sphere("head", CAT, (0.088 * sx + 0.009, y + 0.032, r[2] * 0.9 + 0.014), (0.008, 0.009, 0.004), outline=0, seg=6, emit=0.3)
        m.box("head", brow, (0.09 * sx, y + 0.085, r[2] * 0.88), (0.085, 0.022, 0.03), 0.0, rot=(0, 0, 8 * sx), outline=0)
        m.sphere("head", 0xF08A80, (0.13 * sx, y - 0.04, r[2] * 0.78), (0.04, 0.025, 0.015), outline=0, seg=8)  # joues
    pts = [(math.cos(a) * 0.065 * smile, -math.sin(a) * 0.03 * smile) for a in [math.pi * i / 8 for i in range(9)]]
    m.shape("head", 0x7A2A3A, (0, y - 0.09, r[2] * 0.86), pts, 0.015, rot=(-10, 0, 0), outline=0)


def _arms(m: Model, sleeve: int, skin: int, upper: float, fore: float, r: float = 0.075, cuff: int | None = None) -> None:
    for s, sx in (("L", 1), ("R", -1)):
        m.sphere(f"shoulder_{s}", sleeve, (0, -0.01, 0), (r * 1.4, r * 1.3, r * 1.45), seg=12)
        m.capsule(f"shoulder_{s}", sleeve, (0, -0.02, 0), (0, -upper, 0), r, r * 0.92)
        m.capsule(f"elbow_{s}", sleeve, (0, 0, 0), (0, -fore * 0.75, 0), r * 0.92, r * 0.85)
        if cuff is not None:
            m.cyl(f"hand_{s}", cuff, (0, 0.04, 0), r * 0.95, 0.04, seg=10, outline=0)
        m.sphere(f"hand_{s}", skin, (0, -0.035, 0), (r * 1.0, r * 1.05, r * 0.95), seg=12)
        m.capsule(f"hand_{s}", skin, (0.03 * sx, -0.02, 0.035), (0.05 * sx, -0.06, 0.06), r * 0.3)


# ─── Josiane ──────────────────────────────────────────────────────────────────

J_DIMS = Dims(pelvis_y=0.6, spine=0.1, chest=0.15, neck=0.29, head=0.05, shoulder_w=0.26, shoulder_y=0.17, upper=0.22, fore=0.2, hip_w=0.11, hip_y=-0.02, thigh=0.29, shin=0.28, head_socket_y=0.4, back_z=-0.17, hip_socket_x=0.2)


def josiane() -> Model:
    m = _base("josiane", J_DIMS, 1.75, 0xFFD84A)
    NAVY, NAVY_D, RED, SHIRT, SKIN, SKIN_D, HAIR, SCARF, SCARF2 = 0x1F2E55, 0x141A33, 0xD8283C, 0xC8DCF2, 0xF0BC94, 0xD0946C, 0xC8C4CC, 0xE07A2A, 0xFFD84A
    for s in ("L", "R"):
        m.capsule(f"hip_{s}", NAVY, (0, 0, 0), (0, -0.28, 0), 0.1, 0.085)
        m.capsule(f"knee_{s}", NAVY, (0, 0, 0), (0, -0.24, 0), 0.08, 0.07)
        m.box(f"foot_{s}", INK, (0, 0.03, 0.04), (0.13, 0.09, 0.26), 0.04, seg=1)
    m.box("pelvis", NAVY, (0, 0, 0), (0.38, 0.18, 0.27), 0.08, seg=1)
    m.box("spine", NAVY, (0, 0.03, 0), (0.38, 0.2, 0.27), 0.08, seg=1)
    m.box("spine", NAVY, (0, -0.12, 0), (0.42, 0.18, 0.3), 0.07, seg=1)  # basques de la veste
    m.box("chest", NAVY, (0, 0.08, 0), (0.48, 0.34, 0.3), 0.11)
    m.box("chest", SHIRT, (0, 0.15, 0.142), (0.12, 0.2, 0.02), 0.0, outline=0)
    for sx in (1, -1):
        m.box("chest", NAVY_D, (0.08 * sx, 0.13, 0.15), (0.07, 0.26, 0.02), 0.0, rot=(0, 0, 18 * sx), outline=0)
        m.box("chest", RED, (0.25 * sx, 0.18, 0.0), (0.012, 0.2, 0.26), 0.0, outline=0)  # liseré d'épaule
    for k in range(3):
        m.sphere("chest", 0xE8C040, (0.06, 0.05 - k * 0.08, 0.152), (0.016, 0.016, 0.01), outline=0, seg=6, emit=0.2)
    m.box("chest", 0xE8C040, (-0.13, 0.17, 0.152), (0.07, 0.025, 0.006), 0.0, outline=0, emit=0.2)  # badge
    # Écharpe tricotée orange à rayures (elle tricote pendant les pauses)
    m.torus("neck", SCARF, (0, -0.02, 0.0), 0.12, 0.05, rot=(90, 0, 0), radial=6, tubular=14)
    m.box("chest", SCARF, (0.08, 0.12, 0.17), (0.09, 0.26, 0.04), 0.02, rot=(0, 0, -6), seg=1)
    for k in range(3):
        m.box("chest", SCARF2, (0.08, 0.2 - k * 0.08, 0.193), (0.092, 0.02, 0.004), 0.0, rot=(0, 0, -6), outline=0)
    _arms(m, NAVY, SKIN, 0.21, 0.2, cuff=RED)
    _face(m, SKIN, SKIN_D, 0x8A8490, smile=0.8)
    # Cheveux gris en chignon bas, mèches sur le front ; képi bleu nuit à bandeau rouge
    m.sphere("head", HAIR, (0, 0.2, -0.05), (0.255, 0.22, 0.22), seg=16)
    m.sphere("head", HAIR, (0, 0.13, -0.24), (0.11, 0.1, 0.08), seg=10)
    for sx in (1, -1):
        m.sphere("head", HAIR, (0.2 * sx, 0.14, 0.02), (0.07, 0.11, 0.1), seg=10)
    m.cyl("head", NAVY, (0, 0.38, -0.01), 0.235, 0.14, rb=0.25, seg=18)
    m.cyl("head", RED, (0, 0.33, -0.01), 0.256, 0.04, seg=18, outline=0)
    m.box("head", INK, (0, 0.31, 0.22), (0.3, 0.025, 0.14), 0.0, rot=(-12, 0, 0))  # visière vernie
    m.cyl("head", 0xE8C040, (0, 0.39, 0.24), 0.03, 0.01, rot=(90, 0, 0), seg=10, outline=0, emit=0.3)  # insigne
    # Thermos (main gauche) et sifflet au cou
    p = "prop_L"
    m.cyl(p, 0xC8D0E0, (0, -0.06, 0.0), 0.06, 0.28, seg=12)
    m.cyl(p, RED, (0, 0.1, 0.0), 0.062, 0.06, seg=12)
    m.box(p, 0x8A96B0, (0, -0.06, 0.062), (0.05, 0.14, 0.01), 0.0, outline=0)
    m.box("chest", 0xC8D0E0, (-0.1, 0.06, 0.16), (0.04, 0.03, 0.05), 0.0)  # sifflet
    return m


def _npc_idle(t: float, period: float, extra: dict | None = None, sway: float = 1.0) -> dict:
    w = 2 * math.pi / period
    b = math.sin(t * w)
    rot = {
        "spine": (-2 + b * sway, 0, 0), "chest": (-3 - b * sway, 4 * b, 0), "head": (-4 + b, -6 * b, 2),
        "shoulder_L": (4, 0, 8), "elbow_L": (-20, 0, 0), "shoulder_R": (4, 0, -8), "elbow_R": (-20, 0, 0),
        "hip_L": (-2, 0, 4), "hip_R": (2, 0, -4), "knee_L": (4, 0, 0), "knee_R": (4, 0, 0), "foot_L": (-2, 0, -4), "foot_R": (-2, 0, 4),
        **(extra or {}),
    }
    return P(rot, root=(0, 0.006 * b, 0))


def _npc_walk(ph: float, base: dict, arm: float = 1.0) -> dict:
    s, c = math.sin(ph), math.cos(ph)
    a = 26 * s
    rot = {**base, "pelvis": (0, 6 * s, 2 * s), "spine": (2, -4 * s, 0), "chest": (-2, -6 * s, 0),
           "hip_L": (-a, 0, 2), "knee_L": (8 + 50 * max(0, c), 0, 0), "foot_L": (-4 * s, 0, 0),
           "hip_R": (a, 0, -2), "knee_R": (8 + 50 * max(0, -c), 0, 0), "foot_R": (4 * s, 0, 0)}
    if arm:
        rot["shoulder_R"] = (-a * 0.8 * arm, 0, -6)
    return P(rot, root=(0, -0.02 + 0.04 * abs(c), 0))


def _talk(base_fn, gesture: dict, t: float) -> dict:
    g = merge(base_fn(0), rot=gesture)
    g2 = merge(g, rot={"head": (6, 10, -4)})
    return keyed([(0, base_fn(0)), (300, g, ease_out), (700, g2), (1100, g), (1500, base_fn(0))], t)


def _wave(base_fn, side: str, t: float) -> dict:
    sx = 1 if side == "L" else -1
    up = lambda z: merge(base_fn(0), rot={f"shoulder_{side}": (-20, 0, 150 * sx), f"elbow_{side}": (0, 0, z * sx), "head": (-8, 10 * sx, 0)})  # noqa: E731
    return keyed([(0, base_fn(0)), (250, up(-20), ease_back), (450, up(20)), (650, up(-20)), (850, up(20)), (1050, up(-10)), (1300, base_fn(0))], t)


J_REST = {"shoulder_L": (-30, 0, 10), "elbow_L": (-70, 0, 0), "prop_L": (70, 0, 0), "shoulder_R": (6, 0, -10), "elbow_R": (-30, 0, 0)}


def j_idle(t: float) -> dict:
    return _npc_idle(t, 2.8, J_REST)


def josiane_clips() -> list[Clip]:
    return [
        Clip("idle", 2.8, lambda t: j_idle(t / 1000), loop=True),
        Clip("walk", 0.6, lambda t: _npc_walk(2 * math.pi * t / 600, J_REST), loop=True),
        Clip("talk", 1.5, lambda t: _talk(j_idle, {"shoulder_R": (-50, 0, -30), "elbow_R": (-60, 0, 0), "hand_R": (-20, 0, 0)}, t)),
        Clip("wave", 1.3, lambda t: _wave(j_idle, "R", t)),
    ]


# ─── Béné ─────────────────────────────────────────────────────────────────────

B_DIMS = Dims(pelvis_y=0.58, spine=0.1, chest=0.15, neck=0.28, head=0.05, shoulder_w=0.25, shoulder_y=0.17, upper=0.21, fore=0.2, hip_w=0.1, hip_y=-0.02, thigh=0.28, shin=0.27, head_socket_y=0.46, back_z=-0.17, hip_socket_x=0.19)


def bene() -> Model:
    m = _base("bene", B_DIMS, 1.78, 0x6FF3FF)
    PRUNE, PRUNE_D, BLOUSE, SKIRT, SKIN, SKIN_D, HAIR, HAIR_L = 0x8A3A6A, 0x6A2850, 0xF2E8D8, 0x2A3050, 0xE8B08A, 0xC88E6A, 0x5A3020, 0x7A4430
    for s in ("L", "R"):
        m.capsule(f"hip_{s}", SKIRT, (0, 0, 0), (0, -0.2, 0), 0.1, 0.09)
        m.capsule(f"knee_{s}", 0xB89A80, (0, 0, 0), (0, -0.24, 0), 0.06, 0.055)  # collants
        m.box(f"foot_{s}", 0x4A2A20, (0, 0.03, 0.04), (0.12, 0.08, 0.24), 0.035, seg=1)
    # Jupe droite mi-longue
    m.lathe("pelvis", SKIRT, (0, 0, 0), [(0.2, -0.38), (0.19, -0.2), (0.18, 0.0), (0.17, 0.08)], seg=16, scale=(1.0, 1.0, 0.78))
    m.box("spine", BLOUSE, (0, 0.03, 0), (0.34, 0.2, 0.24), 0.08, seg=1)
    # Cardigan prune ouvert sur la blouse
    m.box("spine", PRUNE, (0, -0.02, -0.01), (0.38, 0.2, 0.26), 0.08, seg=1)
    m.box("chest", PRUNE, (0, 0.08, -0.01), (0.46, 0.34, 0.28), 0.11)
    m.box("chest", BLOUSE, (0, 0.1, 0.13), (0.14, 0.3, 0.03), 0.0, outline=0)
    m.box("spine", BLOUSE, (0, 0.02, 0.13), (0.12, 0.22, 0.02), 0.0, outline=0)
    for sx in (1, -1):
        m.box("chest", PRUNE_D, (0.085 * sx, 0.06, 0.142), (0.03, 0.36, 0.012), 0.0, outline=0)
    for k in range(3):
        m.sphere("chest", 0xE8C040, (0.11, 0.12 - k * 0.09, 0.15), (0.014, 0.014, 0.008), outline=0, seg=6, emit=0.2)
    m.torus("chest", BLOUSE, (0, 0.26, 0.04), 0.09, 0.025, rot=(80, 0, 0), radial=6, tubular=14, outline=0)  # col Claudine
    _arms(m, PRUNE, SKIN, 0.2, 0.2, r=0.07)
    _face(m, SKIN, SKIN_D, HAIR, smile=0.35)
    # Lunettes en demi-lune au bout d'une chaîne
    for sx in (1, -1):
        m.box("head", INK, (0.088 * sx, 0.155, 0.235), (0.1, 0.012, 0.012), 0.0, outline=0)
        m.box("head", 0xDDEBFF, (0.088 * sx, 0.17, 0.238), (0.09, 0.03, 0.004), 0.0, mat="glass", outline=0, emit=1.0)
        m.box("head", 0xE8C040, (0.2 * sx, 0.04, 0.08), (0.006, 0.24, 0.006), 0.0, rot=(30, 0, 0), outline=0)
    m.box("head", INK, (0, 0.165, 0.24), (0.03, 0.012, 0.012), 0.0, outline=0)
    # Chignon haut, très net
    m.sphere("head", HAIR, (0, 0.22, -0.04), (0.255, 0.22, 0.23), seg=16)
    m.sphere("head", HAIR, (0, 0.47, -0.06), (0.13, 0.11, 0.12), seg=12)
    m.torus("head", HAIR_L, (0, 0.41, -0.05), 0.1, 0.022, rot=(90, 0, 0), radial=5, tubular=12, outline=0)
    m.box("head", 0xE8C040, (0.06, 0.48, -0.06), (0.012, 0.012, 0.22), 0.0, rot=(0, 30, 20), outline=0)  # crayon planté
    # Classeur « Le Règlement » (main gauche, sous le bras) : vert administratif, étiquette crème
    p = "prop_L"
    m.box(p, 0x2E6A4A, (0, 0.04, 0.12), (0.1, 0.42, 0.34), 0.015, seg=1)
    m.box(p, 0xF6F2E6, (0, 0.04, 0.12), (0.09, 0.4, 0.33), 0.0)
    m.box(p, 0xF2E6C8, (0.053, 0.1, 0.12), (0.006, 0.12, 0.2), 0.0, outline=0)
    m.box(p, INK, (0.057, 0.1, 0.12), (0.004, 0.02, 0.15), 0.0, outline=0)
    for k in range(4):  # marque-pages colorés
        m.box(p, (0xFF7AC8, 0xFFD84A, 0x5FF7E4, 0xFF6A12)[k], (0.0, 0.26, 0.0 + 0.07 * k), (0.06, 0.04, 0.03), 0.0, outline=0)
    # Tampon « Numéro suivant » (main droite)
    p = "prop"
    m.cyl(p, 0x6A3A24, (0, 0.04, 0.0), 0.03, 0.12, seg=10)
    m.sphere(p, 0x6A3A24, (0, 0.11, 0.0), (0.045, 0.04, 0.045), seg=8)
    m.box(p, 0x2A2638, (0, -0.04, 0.0), (0.12, 0.05, 0.08), 0.0)
    m.box(p, 0xD8283C, (0, -0.068, 0.0), (0.11, 0.008, 0.07), 0.0, outline=0)
    return m


B_REST = {"shoulder_L": (-10, 0, 10), "elbow_L": (-95, 0, 0), "prop_L": (100, 0, 0), "shoulder_R": (-10, 0, -8), "elbow_R": (-40, 0, 0)}


def b_idle(t: float) -> dict:
    return _npc_idle(t, 3.2, B_REST, sway=0.5)


def b_stamp(t: float) -> dict:
    """« Numéro suivant ! » : elle lève le tampon et l'abat sur le classeur."""
    up = merge(b_idle(0), rot={"shoulder_R": (-120, 0, -20), "elbow_R": (-60, 0, 0), "head": (-6, 10, 0)})
    down = merge(b_idle(0), rot={"shoulder_R": (-40, 30, -10), "elbow_R": (-70, 0, 0), "chest": (6, 10, 0), "head": (10, 10, 0)})
    return keyed([(0, b_idle(0)), (350, up, ease_out), (550, up), (650, down), (900, down), (1300, b_idle(0))], t)


def bene_clips() -> list[Clip]:
    return [
        Clip("idle", 3.2, lambda t: b_idle(t / 1000), loop=True),
        Clip("walk", 0.6, lambda t: _npc_walk(2 * math.pi * t / 600, B_REST), loop=True),
        Clip("talk", 1.3, b_stamp, events={"active": 650}),
        Clip("wave", 1.3, lambda t: _wave(b_idle, "R", t)),
    ]


# ─── Kevin ────────────────────────────────────────────────────────────────────

K_DIMS = Dims(pelvis_y=0.7, spine=0.12, chest=0.18, neck=0.33, head=0.05, shoulder_w=0.36, shoulder_y=0.2, upper=0.25, fore=0.22, hip_w=0.14, hip_y=-0.03, thigh=0.34, shin=0.33, head_socket_y=0.27, back_z=-0.24, hip_socket_x=0.26)


def kevin() -> Model:
    m = _base("kevin", K_DIMS, 2.0, 0x6FF3FF)
    HV, HV_D, STRIPE, PANTS, SKIN, SKIN_D, BEARD, HELMET = 0xF0E020, 0xC8B818, 0xE8EEFF, 0x3A3E4A, 0xE8A47E, 0xC8845E, 0x6A3A1E, 0xF4F1E8
    for s in ("L", "R"):
        m.capsule(f"hip_{s}", PANTS, (0, 0, 0), (0, -0.33, 0), 0.13, 0.11)
        m.capsule(f"knee_{s}", PANTS, (0, 0, 0), (0, -0.25, 0), 0.105, 0.095)
        m.box(f"knee_{s}", HV, (0, -0.16, 0.0), (0.22, 0.04, 0.22), 0.0, outline=0)  # bande réfléchissante
        m.box(f"foot_{s}", 0x3A2C38, (0, 0.04, 0.05), (0.2, 0.15, 0.32), 0.06, seg=1)
    m.box("pelvis", PANTS, (0, 0, 0), (0.48, 0.22, 0.34), 0.09, seg=1)
    # Ceinture à outils : poches, mètre, tournevis
    m.box("pelvis", 0x5A3A24, (0, 0.06, 0), (0.5, 0.07, 0.36), 0.0)
    for sx in (1, -1):
        m.box("pelvis", 0x6A4A2E, (0.2 * sx, -0.02, 0.1), (0.1, 0.14, 0.12), 0.02, seg=1)
    m.cyl("pelvis", 0xFFD84A, (-0.25, 0.0, -0.05), 0.05, 0.05, rot=(0, 0, 90), seg=10, outline=0.5)
    m.box("pelvis", 0xD8283C, (0.2, 0.08, 0.12), (0.02, 0.12, 0.02), 0.0, outline=0)
    # Ventre rond sous la veste HV jaune (l'Infra), bandes grises réfléchissantes
    m.sphere("spine", HV, (0, 0.04, 0.03), (0.3, 0.2, 0.26), seg=16)
    m.box("chest", HV, (0, 0.1, 0), (0.66, 0.42, 0.36), 0.14)
    m.box("chest", STRIPE, (0, 0.0, 0.0), (0.67, 0.05, 0.37), 0.0, outline=0, emit=0.2)
    m.cyl("spine", STRIPE, (0, 0.0, 0.03), 0.302, 0.045, seg=16, outline=0, emit=0.2)  # bande sur le ventre
    for sx in (1, -1):
        m.box("chest", STRIPE, (0.14 * sx, 0.14, 0.18), (0.05, 0.3, 0.012), 0.0, outline=0, emit=0.2)
    m.box("chest", HV_D, (0, 0.1, 0.182), (0.012, 0.4, 0.006), 0.0, outline=0)  # fermeture
    m.box("chest", 0x2A2638, (0, 0.33, 0.02), (0.36, 0.07, 0.26), 0.0)  # col polaire
    m.box("chest", 0x2A2638, (-0.17, 0.2, 0.183), (0.1, 0.06, 0.006), 0.0, outline=0)  # écusson « Infra »
    m.box("chest", 0xF2F4FA, (-0.17, 0.2, 0.187), (0.07, 0.015, 0.004), 0.0, outline=0)
    # Rapport de trois pages qui dépasse de la poche
    m.box("chest", 0xF6F2E6, (0.17, 0.25, 0.17), (0.09, 0.12, 0.012), 0.0, rot=(0, 0, 8))
    _arms(m, HV, SKIN, 0.24, 0.22, r=0.095, cuff=0x2A2638)
    for s in ("L", "R"):
        m.box(f"shoulder_{s}", STRIPE, (0, -0.15, 0.0), (0.2, 0.04, 0.2), 0.0, outline=0, emit=0.2)
    _face(m, SKIN, SKIN_D, BEARD, r=(0.27, 0.27, 0.25), y=0.17, smile=1.2)
    # Barbe ronde, cheveux courts, casque blanc de l'Infra
    m.sphere("head", BEARD, (0, 0.06, 0.06), (0.25, 0.16, 0.2), seg=14)
    m.box("head", BEARD, (0, 0.11, 0.245), (0.16, 0.035, 0.03), 0.0, outline=0)  # moustache
    m.hemi("head", HELMET, (0, 0.27, -0.01), (0.29, 0.22, 0.3), seg=18)
    m.cyl("head", HELMET, (0, 0.27, 0.0), 0.31, 0.03, seg=18)
    m.box("head", HELMET, (0, 0.28, 0.3), (0.3, 0.03, 0.12), 0.0)
    m.box("head", HV, (0, 0.38, 0.26), (0.18, 0.04, 0.012), 0.0, rot=(-40, 0, 0), outline=0, emit=0.2)
    # Pince à caténaire (main droite) : deux mâchoires, manches isolés jaunes
    p = "prop"
    for sx in (1, -1):
        m.box(p, 0xFFD84A, (0.025 * sx, 0.0, 0.0), (0.035, 0.2, 0.04), 0.0, rot=(0, 0, 6 * sx))
        m.box(p, 0x9AAAD0, (0.03 * sx, -0.18, 0.0), (0.03, 0.16, 0.035), 0.0, rot=(0, 0, -10 * sx))
    m.cyl(p, 0x4A5878, (0, -0.1, 0), 0.03, 0.06, rot=(90, 0, 0), seg=8, outline=0)
    return m


K_REST = {"shoulder_L": (2, 0, 10), "elbow_L": (-14, 0, 0), "shoulder_R": (-20, 0, -12), "elbow_R": (-60, 0, 0), "prop": (0, 0, 0), "hand_R": (-20, 0, 0)}


def k_idle(t: float) -> dict:
    return _npc_idle(t, 2.4, K_REST, sway=1.4)


def kevin_clips() -> list[Clip]:
    return [
        Clip("idle", 2.4, lambda t: k_idle(t / 1000), loop=True),
        Clip("walk", 0.65, lambda t: _npc_walk(2 * math.pi * t / 650, K_REST, arm=0.0), loop=True),
        Clip("talk", 1.5, lambda t: _talk(k_idle, {"shoulder_R": (-90, 0, -30), "elbow_R": (-50, 0, 0), "shoulder_L": (-30, 0, 30), "elbow_L": (-60, 0, 0)}, t)),
        Clip("wave", 1.3, lambda t: _wave(k_idle, "L", t)),
    ]
