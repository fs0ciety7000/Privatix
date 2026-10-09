"""Le cheminot (héros) : port fidèle de `prototypes/proto3d/src/hero.ts` (modèle + poses), sur le
squelette du contrat. Le corps est exporté SANS casque, gilet ni outil : ce sont des GLB séparés
(`items()`), accrochés aux sockets à l'exécution (gilet : maillage skinné lié au squelette du héros).
"""
from __future__ import annotations

import math

from ..geo import Model
from ..humanoid import Dims, humanoid_skeleton
from ..poses import P, Clip, ease_back, ease_in, ease_out, keyed, lerp_pose, linear, merge

C = {
    "skin": 0xEB9A72,
    "helmet": 0xFFA419,
    "vest": 0xFF6A12,
    "stripe": 0xE8EEFF,
    "cloth": 0x27345E,
    "clothDark": 0x1B2244,
    "boots": 0x3A2C38,
    "glove": 0x4B3B46,
    "steel": 0x9AAAD0,
    "steelDark": 0x4A5878,
    "scarf": 0xE0283C,
    "hair": 0x4A2C22,
    "eyes": 0x14101A,
    "sole": 0xFF7A1A,
    "belt": 0x3A241C,
}

DIMS = Dims()


def skeleton(name: str = "hero") -> Model:
    m = Model(name)
    humanoid_skeleton(m, DIMS)
    m.joint("scarf0", "neck", (0.13, 0.0, -0.12))
    m.joint("scarf1", "scarf0", (0, 0, -0.15))
    m.joint("scarf2", "scarf1", (0, 0, -0.15))
    m.joint("scarf3", "scarf2", (0, 0, -0.13))
    return m


def model() -> Model:
    m = skeleton()
    m.meta = {"kind": "hero", "height": 2.0, "radius": 0.42, "outline": 0x14101A, "rim": 0x6FF3FF}
    # Jambes et bottes de sécurité
    for s in ("L", "R"):
        m.capsule(f"hip_{s}", C["cloth"], (0, 0, 0), (0, -0.3, 0), 0.112)
        m.capsule(f"knee_{s}", C["cloth"], (0, 0, 0), (0, -0.22, 0), 0.096)
        m.box(f"knee_{s}", C["clothDark"], (0, 0, 0.07), (0.17, 0.14, 0.06), 0.03)  # genouillère
        m.box(f"foot_{s}", C["boots"], (0, 0.035, 0.05), (0.21, 0.17, 0.34), 0.07)
        m.box(f"foot_{s}", C["sole"], (0, -0.035, 0.05), (0.22, 0.035, 0.35), 0.012, outline=0)
        m.box(f"foot_{s}", C["steelDark"], (0, 0.06, 0.19), (0.19, 0.08, 0.07), 0.03, outline=0)  # coque acier
    m.box("pelvis", C["cloth"], (0, 0, 0), (0.42, 0.2, 0.28), 0.08)
    m.box("pelvis", C["belt"], (0, 0.08, 0), (0.44, 0.06, 0.3), 0.025, outline=0)
    m.box("pelvis", 0xC8A040, (0, 0.08, 0.15), (0.07, 0.05, 0.02), 0.008, outline=0)  # boucle
    m.box("spine", C["clothDark"], (0, 0.04, 0), (0.4, 0.2, 0.27), 0.09)
    # Torse en t-shirt (couvert par le gilet quand il est équipé)
    m.box("chest", C["clothDark"], (0, 0.1, 0), (0.6, 0.42, 0.34), 0.13)
    m.box("chest", C["clothDark"], (0, 0.33, 0.0), (0.3, 0.06, 0.24), 0.03)  # col
    # Bras
    for s in ("L", "R"):
        m.sphere(f"shoulder_{s}", C["cloth"], (0, -0.01, 0), (0.14, 0.13, 0.145))
        m.capsule(f"shoulder_{s}", C["cloth"], (0, -0.04, 0), (0, -0.23, 0), 0.088)
        m.capsule(f"elbow_{s}", C["cloth"], (0, 0, 0), (0, -0.17, 0), 0.08)
        m.sphere(f"hand_{s}", C["glove"], (0, -0.04, 0), (0.105, 0.105, 0.105))
        m.cyl(f"hand_{s}", C["glove"], (0, 0.03, 0), 0.085, 0.06, rb=0.09, outline=0)  # manchette
    # Tête : gros visage lisible, moustache, oreilles
    m.cyl("neck", C["skin"], (0, 0, 0), 0.085, 0.12)
    m.sphere("head", C["skin"], (0, 0.17, 0.01), (0.29, 0.28, 0.27), seg=26)
    m.sphere("head", C["hair"], (0, 0.2, -0.08), (0.28, 0.22, 0.22), seg=22)
    for sx in (1, -1):
        m.sphere("head", C["skin"], (0.285 * sx, 0.15, 0.0), (0.055, 0.075, 0.05))
        m.sphere("head", C["eyes"], (0.1 * sx, 0.2, 0.25), (0.038, 0.058, 0.03), outline=0, seg=10)
        m.sphere("head", 0xFFFFFF, (0.1 * sx + 0.012, 0.222, 0.272), (0.012, 0.014, 0.008), outline=0, seg=8, emit=0.3)
        m.box("head", C["hair"], (0.11 * sx, 0.285, 0.255), (0.12, 0.035, 0.04), 0.012, rot=(0, 0, -12 * sx), outline=0)
    m.sphere("head", C["skin"], (0, 0.13, 0.275), (0.055, 0.05, 0.05), outline=0)
    m.box("head", C["hair"], (0, 0.075, 0.255), (0.24, 0.055, 0.07), 0.025, outline=0)  # moustache
    # Écharpe syndicale
    m.cyl("neck", C["scarf"], (0, -0.03, 0), 0.175, 0.13, seg=18)
    m.box("scarf0", C["scarf"], (0, 0, -0.07), (0.17, 0.055, 0.17), 0.02)
    m.box("scarf1", C["scarf"], (0, 0, -0.07), (0.155, 0.05, 0.17), 0.02)
    m.box("scarf2", C["scarf"], (0, 0, -0.07), (0.14, 0.045, 0.16), 0.02)
    m.box("scarf3", C["scarf"], (0, 0, -0.05), (0.13, 0.04, 0.12), 0.02)
    m.box("scarf3", 0xFFD84A, (0, 0, -0.105), (0.13, 0.042, 0.02), 0.005, outline=0)  # liseré
    return m


# ─── Équipement ────────────────────────────────────────────────────────────────
# Chaque objet est un Model dont l'origine est le socket (repère du socket = repère du perso au repos).

HEAD_Y = DIMS.head_socket_y


def _helmet_base(m: Model, shell: int, k: float = 1.0, rib: bool = True) -> None:
    y = -HEAD_Y
    m.hemi("root", shell, (0, 0.25 + y, -0.01), (0.315 * k, 0.25 * k, 0.335 * k), seg=24)
    m.cyl("root", shell, (0, 0.255 + y, 0.0), 0.33 * k, 0.035, seg=24)
    m.box("root", shell, (0, 0.26 + y, 0.33 * k), (0.34, 0.035, 0.14), 0.015)  # visière
    if rib:
        m.box("root", shell, (0, 0.47 + y, -0.01), (0.07, 0.07, 0.48), 0.03)  # nervure


def _lamp(m: Model, color: int = 0xFFF0C0) -> None:
    y = -HEAD_Y
    m.box("root", 0x2A2234, (0, 0.36 + y, 0.29), (0.14, 0.09, 0.07), 0.02)
    m.cyl("root", color, (0, 0.36 + y, 0.32), 0.04, 0.05, rb=0.05, rot=(90, 0, 0), seg=12, mat="glow", outline=0)


def helmet_chantier() -> Model:
    m = Model("casque_chantier")
    m.joint("root", None, (0, 0, 0))
    _helmet_base(m, C["helmet"])
    _lamp(m)
    m.meta = {"slot": "casque", "socket": "socket_head", "rarity": 1}
    return m


def helmet_antibruit() -> Model:
    m = Model("casque_antibruit")
    m.joint("root", None, (0, 0, 0))
    y = -HEAD_Y
    _helmet_base(m, 0xF4F1E8, 1.0, rib=False)
    m.box("root", 0x3FD46B, (0, 0.47 + y, -0.01), (0.07, 0.07, 0.48), 0.03)  # nervure verte (Réglementaire)
    # Arceau et coquilles antibruit, larges : la tête devient un « H » en silhouette
    arc = [(0.33 * math.cos(a), 0.14 + y + 0.36 * math.sin(a), -0.02) for a in [math.pi * k / 12 for k in range(13)]]
    m.tube("root", 0x2A2234, arc, [0.028] * 13, seg=8)  # arceau par-dessus le casque
    for sx in (1, -1):
        m.cyl("root", 0xE0302A, (0.335 * sx, 0.14 + y, 0.0), 0.12, 0.09, rot=(0, 0, 90), seg=18)
        m.cyl("root", 0x2A2234, (0.39 * sx, 0.14 + y, 0.0), 0.085, 0.03, rot=(0, 0, 90), seg=16, outline=0)
        m.box("root", 0xFFD84A, (0.383 * sx, 0.14 + y, 0.0), (0.012, 0.05, 0.13), 0.004, outline=0, emit=0.2)
    _lamp(m, 0xD8FFE8)
    m.meta = {"slot": "casque", "socket": "socket_head", "rarity": 2}
    return m


def helmet_legendaire() -> Model:
    """Casque « Acquis historique » du prototype : coque dorée, bandeau rouge, crête, roue ailée."""
    m = Model("casque_legendaire")
    m.joint("root", None, (0, 0, 0))
    y = -HEAD_Y
    gold = 0xF0C040
    _helmet_base(m, 0xE8A81C, 1.06, rib=False)
    for p in m.parts:
        p.emit = 0.12
    m.cyl("root", 0x7A1424, (0, 0.3 + y, 0), 0.318, 0.06, seg=24)  # bandeau rouge
    m.box("root", gold, (0, 0.5 + y, -0.02), (0.07, 0.15, 0.56), 0.03, emit=0.3)  # crête
    m.box("root", 0xD8203A, (0, 0.6 + y, -0.12), (0.05, 0.12, 0.36), 0.025)
    m.torus("root", gold, (0, 0.34 + y, 0.33), 0.07, 0.022, radial=8, tubular=18, emit=0.3)
    for sx in (1, -1):
        m.box("root", gold, (0.13 * sx, 0.36 + y, 0.31), (0.13, 0.04, 0.03), 0.012, rot=(0, -20 * sx, 18 * sx), emit=0.3)
        m.box("root", gold, (0.13 * sx, 0.31 + y, 0.31), (0.1, 0.035, 0.03), 0.012, rot=(0, -20 * sx, 5 * sx), emit=0.3)
    m.box("root", 0x2A2234, (0, 0.36 + y, 0.29), (0.14, 0.09, 0.07), 0.02)
    m.cyl("root", 0xFFE9A0, (0, 0.36 + y, 0.32), 0.04, 0.05, rb=0.05, rot=(90, 0, 0), seg=12, mat="glow", outline=0)
    m.meta = {"slot": "casque", "socket": "socket_head", "rarity": 5}
    return m


def _vest_common(m: Model, body: int, stripe: int, stripe_emit: float) -> None:
    m.box("chest", body, (0, 0.1, 0), (0.64, 0.44, 0.37), 0.13)
    m.box("chest", stripe, (0, 0.02, 0), (0.655, 0.05, 0.385), 0.02, outline=0, emit=stripe_emit)
    m.box("chest", stripe, (0, 0.15, 0), (0.655, 0.05, 0.385), 0.02, outline=0, emit=stripe_emit)
    m.box("chest", stripe, (0.15, 0.14, 0), (0.065, 0.28, 0.39), 0.02, outline=0, emit=stripe_emit)
    m.box("chest", stripe, (-0.15, 0.14, 0), (0.065, 0.28, 0.39), 0.02, outline=0, emit=stripe_emit)
    for s in ("L", "R"):
        m.sphere(f"shoulder_{s}", body, (0, -0.01, 0), (0.155, 0.145, 0.16))


def vest_hv() -> Model:
    m = skeleton("gilet_hv")
    _vest_common(m, C["vest"], C["stripe"], 0.22)
    m.meta = {"slot": "gilet", "skinned": True, "rarity": 1}
    return m


def vest_porte_outils() -> Model:
    """Gilet porte-outils « Renforcé » : jaune fluo, bandes à lueur cyan, poches, radio de service."""
    m = skeleton("gilet_porte_outils")
    body = 0xC8FF2A
    _vest_common(m, body, 0xD8F6FF, 0.9)
    # poches et radio
    for sx in (1, -1):
        m.box("chest", 0x3A4A1A, (0.17 * sx, -0.04, 0.19), (0.16, 0.13, 0.05), 0.025)
        m.box("chest", 0x5A6A2A, (0.17 * sx, 0.015, 0.215), (0.165, 0.035, 0.02), 0.01, outline=0)
    m.box("chest", 0x22202C, (0.2, 0.2, 0.2), (0.09, 0.15, 0.05), 0.02)  # radio
    m.cyl("chest", 0x22202C, (0.23, 0.32, 0.2), 0.012, 0.12, seg=6)  # antenne
    m.sphere("chest", 0x3FD46B, (0.18, 0.25, 0.228), (0.016, 0.016, 0.01), mat="glow", outline=0, seg=8)
    m.box("chest", 0xE0302A, (-0.12, 0.22, 0.2), (0.02, 0.1, 0.02), 0.006, outline=0)  # stylo
    # épaulettes renforcées
    for s, sx in (("L", 1), ("R", -1)):
        m.box(f"shoulder_{s}", 0x3A4A1A, (0.02 * sx, 0.06, 0), (0.2, 0.06, 0.22), 0.03)
    m.meta = {"slot": "gilet", "skinned": True, "rarity": 3}
    return m


def wrench(epic: bool = False) -> Model:
    """Clé à tire-fond : le manche part vers l'avant de la main (+Z), poignée en T au poing."""
    m = Model("cle_tire_fond_epique" if epic else "cle_tire_fond")
    m.joint("root", None, (0, 0, 0))
    steel = 0xB6A8FF if epic else C["steel"]
    dark = 0x3A2A7A if epic else C["steelDark"]
    grip = 0x9A3CFF if epic else 0xD02A2A
    L = 1.12 if epic else 0.98
    m.cyl("root", steel, (0, 0, L / 2 - 0.12), 0.038, L, rot=(90, 0, 0), seg=10)
    m.cyl("root", dark, (0, 0, -0.12), 0.034, 0.42, rot=(0, 0, 90), seg=10)
    for sx in (1, -1):
        m.cyl("root", grip, (0.16 * sx, 0, -0.12), 0.048, 0.12, rot=(0, 0, 90), seg=12)
    m.cyl("root", dark, (0, 0, L - 0.08), 0.12 if epic else 0.095, 0.22, rot=(90, 0, 0), seg=6)  # douille hexagonale
    m.cyl("root", steel, (0, 0, L + 0.04), 0.13 if epic else 0.105, 0.05, rot=(90, 0, 0), seg=16)
    if epic:
        for z in (L - 0.14, L + 0.06):
            m.torus("root", 0x6FF3FF, (0, 0, z), 0.13, 0.025, radial=8, tubular=20, mat="glow", outline=0)
        for i in range(3):
            m.cyl("root", 0xB05CFF, (0, 0, 0.2 + i * 0.18), 0.045, 0.04, rot=(90, 0, 0), mat="glow", outline=0, seg=10)
    m.meta = {"slot": "outil", "socket": "socket_weapon_R", "tip": (0, 0, L + 0.06), "rarity": 4 if epic else 1}
    return m


def sledgehammer() -> Model:
    """Masse de voie : long manche en frêne, tête d'acier perpendiculaire (frappe verticale)."""
    m = Model("masse_de_voie")
    m.joint("root", None, (0, 0, 0))
    L = 1.05
    m.cyl("root", 0x9A6A3A, (0, 0, L / 2 - 0.14), 0.036, L, rot=(90, 0, 0), seg=10)
    m.cyl("root", 0x2A2234, (0, 0, -0.08), 0.045, 0.2, rot=(90, 0, 0), seg=10)  # grip
    m.cyl("root", 0xFFD84A, (0, 0, 0.06), 0.042, 0.03, rot=(90, 0, 0), seg=10, outline=0)
    # tête : bloc d'acier biseauté, plus large que haut (lisible de dessus)
    m.box("root", C["steel"], (0, 0, L - 0.12), (0.44, 0.15, 0.16), 0.04)
    m.box("root", C["steelDark"], (0, 0, L - 0.12), (0.18, 0.165, 0.175), 0.03)
    for sx in (1, -1):
        m.box("root", 0xE6ECFF, (0.23 * sx, 0, L - 0.12), (0.035, 0.13, 0.14), 0.02, outline=0)
    m.meta = {"slot": "outil", "socket": "socket_weapon_R", "tip": (0, 0, L - 0.12), "rarity": 2}
    return m


def catenary_pliers() -> Model:
    """Pince à caténaire : perche isolante annelée jaune et noir, mâchoires de cuivre."""
    m = Model("pince_catenaire")
    m.joint("root", None, (0, 0, 0))
    L = 1.2
    m.cyl("root", 0xFFC83A, (0, 0, L / 2 - 0.2), 0.03, L, rot=(90, 0, 0), seg=10)
    for i in range(5):
        m.cyl("root", 0x22202C, (0, 0, 0.12 + i * 0.17), 0.033, 0.05, rot=(90, 0, 0), seg=10, outline=0)
    for i in range(3):  # cloches isolantes
        m.cyl("root", 0xE0302A, (0, 0, L - 0.42 + i * 0.07), 0.06, 0.03, rb=0.035, rot=(90, 0, 0), seg=12)
    m.box("root", 0x4A5878, (0, 0, L - 0.2), (0.09, 0.09, 0.08), 0.02)
    for sx in (1, -1):
        m.box("root", 0xD07A3A, (0.05 * sx, 0, L - 0.08), (0.04, 0.06, 0.2), 0.015, rot=(0, -12 * sx, 0))
        m.box("root", 0xD07A3A, (0.085 * sx, 0, L + 0.03), (0.05, 0.06, 0.06), 0.015, rot=(0, 35 * sx, 0))
    m.sphere("root", 0x6FF3FF, (0, 0, L + 0.04), (0.03, 0.03, 0.03), mat="glow", outline=0, seg=8)
    m.meta = {"slot": "outil", "socket": "socket_weapon_R", "tip": (0, 0, L + 0.04), "rarity": 3}
    return m


def items() -> list[Model]:
    return [helmet_chantier(), helmet_antibruit(), helmet_legendaire(), vest_hv(), vest_porte_outils(), wrench(False), wrench(True), sledgehammer(), catenary_pliers()]


# ─── Poses (port de hero.ts) ───────────────────────────────────────────────────


def idle_pose(t: float) -> dict:
    b = math.sin(t * 2 * math.pi / 2.6)
    return P(
        {
            "spine": (7 + b * 1.4, 0, 0),
            "chest": (-3 - b * 2, 0, 0),
            "head": (-3 + b * 1.2, 0, 0),
            "shoulder_L": (-6 + b * 2, 0, 13 + b * 2.5),
            "elbow_L": (-32, 0, 0),
            "shoulder_R": (-20 + b * 2, 0, -16 - b * 2),
            "elbow_R": (-42, 0, 0),
            "hand_R": (58, 8, 0),
            "hip_L": (-7, 0, 8),
            "knee_L": (16, 0, 0),
            "foot_L": (-9, 0, -8),
            "hip_R": (9, 0, -8),
            "knee_R": (13, 0, 0),
            "foot_R": (-22, 0, 8),
        },
        root=(0, -0.025 + b * 0.012, 0),
        scale=(1 + b * 0.012, 1 - b * 0.008, 1 + b * 0.012),
    )


def run_pose(ph: float) -> dict:
    s, c = math.sin(ph), math.cos(ph)
    a = 40 * s
    kl = 18 + 78 * max(0, c)
    kr = 18 + 78 * max(0, -c)
    return P(
        {
            "pelvis": (0, 9 * s, 0),
            "spine": (17, -5 * s, 0),
            "chest": (-2, -14 * s, 0),
            "head": (-12, 7 * s, 0),
            "shoulder_L": (a * 0.95, 0, 12),
            "elbow_L": (-72 + 18 * s, 0, 0),
            "shoulder_R": (-a * 0.45 + 8, 0, -16),
            "elbow_R": (-80, 0, 0),
            "hand_R": (30, 0, 0),
            "hip_L": (-a - 8, 0, 4),
            "knee_L": (kl, 0, 0),
            "foot_L": (-(-a - 8 + kl) * 0.45, 0, 0),
            "hip_R": (a - 8, 0, -4),
            "knee_R": (kr, 0, 0),
            "foot_R": (-(a - 8 + kr) * 0.45, 0, 0),
        },
        root=(0, -0.05 + 0.08 * abs(c), 0),
        scale=(1, 1 + 0.04 * abs(c) - 0.02, 1),
    )


DASH = P(
    {
        "spine": (34, 0, 0),
        "chest": (8, 0, 0),
        "head": (-24, 0, 0),
        "shoulder_L": (58, 0, 28),
        "elbow_L": (-24, 0, 0),
        "shoulder_R": (52, 0, -28),
        "elbow_R": (-26, 0, 0),
        "hand_R": (100, 0, 0),
        "hip_L": (-62, 0, 4),
        "knee_L": (88, 0, 0),
        "foot_L": (-10, 0, 0),
        "hip_R": (38, 0, -4),
        "knee_R": (34, 0, 0),
        "foot_R": (-20, 0, 0),
    },
    root=(0, 0.14, 0),
    scale=(0.86, 0.92, 1.28),
)


def hurt_pose(t: float) -> dict:
    k = min(1.0, t / 80)
    return P(
        {
            "spine": (-20 * k, 0, 6),
            "chest": (-10 * k, 0, 0),
            "head": (-24 * k, 0, 0),
            "shoulder_L": (-30, 0, 48),
            "elbow_L": (-40, 0, 0),
            "shoulder_R": (-26, 0, -50),
            "elbow_R": (-40, 0, 0),
            "hand_R": (70, 0, 0),
            "hip_L": (-24, 0, 8),
            "knee_L": (30, 0, 0),
            "hip_R": (16, 0, -8),
            "knee_R": (26, 0, 0),
            "foot_R": (-40, 0, 0),
        },
        root=(0, -0.06, -0.12 * k),
    )


def sw(yaw: float, arm: float = -88, lean: float = 10, lunge: float = 0) -> dict:
    """Pose de coup horizontal : `yaw` = direction du bras (0 = devant, + = vers sa gauche)."""
    return P(
        {
            "pelvis": (0, yaw * 0.15, 0),
            "spine": (lean, yaw * 0.2, 0),
            "chest": (0, yaw * 0.3, 0),
            "head": (-lean * 0.6, -yaw * 0.4, 0),
            "shoulder_R": (arm, yaw * 0.4, -8),
            "elbow_R": (-10, 0, 0),
            "hand_R": (84, 0, 0),
            "shoulder_L": (-30, -yaw * 0.2, 42),
            "elbow_L": (-78, 0, 0),
            "hip_L": (-30 - lunge, 0, 7),
            "knee_L": (32 + lunge, 0, 0),
            "foot_L": (-2, 0, -6),
            "hip_R": (24, 0, -7),
            "knee_R": (24, 0, 0),
            "foot_R": (-46, 0, 6),
        },
        root=(0, -0.1 - lunge * 0.004, 0.04 + lunge * 0.006),
    )


def overhead(extra: float) -> dict:
    return P(
        {
            "spine": (-14 - extra * 0.4, 0, 0),
            "chest": (-10 - extra * 0.3, 0, 0),
            "head": (8, 0, 0),
            "shoulder_R": (-172 - extra, 0, 14),
            "elbow_R": (-34, 0, 0),
            "hand_R": (72, 0, 0),
            "shoulder_L": (-166 - extra, 0, -26),
            "elbow_L": (-46, 0, 0),
            "hip_L": (-22, 0, 8),
            "knee_L": (38, 0, 0),
            "foot_L": (-16, 0, 0),
            "hip_R": (10, 0, -8),
            "knee_R": (32, 0, 0),
            "foot_R": (-42, 0, 0),
        },
        root=(0, 0.04 + extra * 0.006, -0.06),
        scale=(0.95, 1.06 + extra * 0.003, 0.95),
    )


SLAM = P(
    {
        "spine": (40, 0, 0),
        "chest": (12, 0, 0),
        "head": (-26, 0, 0),
        "shoulder_R": (-98, 0, 10),
        "elbow_R": (-6, 0, 0),
        "hand_R": (106, 0, 0),
        "shoulder_L": (-96, 0, -16),
        "elbow_L": (-12, 0, 0),
        "hip_L": (-56, 0, 8),
        "knee_L": (76, 0, 0),
        "foot_L": (-20, 0, 0),
        "hip_R": (34, 0, -8),
        "knee_R": (52, 0, 0),
        "foot_R": (-80, 0, 0),
    },
    root=(0, -0.26, 0.22),
    scale=(1.1, 0.86, 1.06),
)


def attack_pose(idx: int, t: float) -> dict:
    if idx == 0:
        return keyed([(0, sw(-50, -70, 6)), (90, sw(-118, -84, 4), ease_out), (150, sw(78, -88, 16, 12), ease_in), (215, sw(104, -80, 14, 12), ease_out), (310, sw(70, -55, 8))], t)
    if idx == 1:
        return keyed([(0, sw(70, -60, 6)), (80, sw(112, -80, 4), ease_out), (140, sw(-82, -92, 16, 12), ease_in), (205, sw(-108, -84, 14, 12), ease_out), (310, sw(-60, -55, 8))], t)
    return keyed(
        [
            (0, sw(0, -60, 4)),
            (120, overhead(0), ease_out),
            (200, overhead(14), ease_out),
            (250, SLAM, ease_in),
            (420, merge(SLAM, root=(0, -0.24, 0.22), scale=(1.02, 0.96, 1.02))),
            (600, sw(0, -50, 8)),
        ],
        t,
    )


def scarf(pose: dict, t_s: float, sv: float, omega: float) -> dict:
    """Écharpe : flotte derrière selon la vitesse `sv` (0 repos → 1,3 dash)."""
    def w(ph, a):
        return math.sin(t_s * omega + ph) * a * (0.4 + sv)

    pose["rot"]["scarf0"] = (-68 + sv * 52 + w(0, 6), 14 - sv * 10 + w(0.5, 8), 0)
    pose["rot"]["scarf1"] = (-12 + sv * 8 + w(1.2, 12), w(1.6, 10), 0)
    pose["rot"]["scarf2"] = (-6 + w(2.4, 16), w(2.8, 12), 0)
    pose["rot"]["scarf3"] = (-4 + w(3.6, 20), w(3.9, 14), 0)
    return pose


def _with_scarf(fn, sv, period):
    omega = 2 * math.pi / period

    def f(t):
        return scarf(fn(t), t / 1000, sv, omega)

    return f


DEAD = P(
    {
        "root": (-88, 0, 0),
        "spine": (-6, 0, 4),
        "chest": (-4, 0, 0),
        "head": (-10, 26, 8),
        "shoulder_L": (-120, 0, 70),
        "elbow_L": (-30, 0, 0),
        "shoulder_R": (-110, 0, -64),
        "elbow_R": (-40, 0, 0),
        "hand_R": (40, 0, 0),
        "hip_L": (-34, 0, 14),
        "knee_L": (52, 0, 0),
        "hip_R": (-4, 0, -12),
        "knee_R": (10, 0, 0),
        "foot_L": (20, 0, 0),
        "foot_R": (30, 0, 0),
    },
    root=(0, 0.17, 0.0),
)


def death_pose(t: float) -> dict:
    stagger = merge(hurt_pose(80), rot={"knee_L": (60, 0, 0), "knee_R": (50, 0, 0), "spine": (16, 0, 10), "head": (20, 0, 0)}, root=(0, -0.22, -0.05), scale=(1.05, 0.92, 1.05))
    bounce = merge(DEAD, root=(0, 0.26, -0.02))
    return keyed(
        [
            (0, hurt_pose(0)),
            (110, hurt_pose(80), ease_out),
            (380, stagger, ease_in_out_),
            (720, DEAD, ease_in),
            (840, bounce, ease_out),
            (980, DEAD, ease_in),
            (1300, merge(DEAD, rot={"head": (-14, 30, 10)})),
        ],
        t,
    )


def ease_in_out_(t: float) -> float:
    return t * t * (3 - 2 * t)


def spawn_pose(t: float) -> dict:
    """Arrivée : il tombe du ciel (descente de la rame), réception accroupie, se redresse."""
    air = merge(DASH, rot={"spine": (-6, 0, 0), "shoulder_L": (-150, 0, 40), "shoulder_R": (-150, 0, -40), "hip_L": (-50, 0, 6), "knee_L": (80, 0, 0), "hip_R": (-20, 0, -6), "knee_R": (60, 0, 0)}, root=(0, 2.6, 0), scale=(0.9, 1.15, 0.9))
    land = merge(SLAM, rot={"shoulder_R": (-40, 0, -50), "shoulder_L": (-40, 0, 50), "hand_R": (40, 0, 0), "hip_L": (-70, 0, 14), "hip_R": (-50, 0, -14), "knee_L": (100, 0, 0), "knee_R": (95, 0, 0), "foot_L": (-30, 0, 0), "foot_R": (-40, 0, 0)}, root=(0, -0.3, 0.0), scale=(1.25, 0.76, 1.25))
    return keyed([(0, air), (260, merge(air, root=(0, 0.0, 0)), ease_in), (300, land, linear), (520, merge(idle_pose(0), scale=(0.94, 1.08, 0.94)), ease_back), (800, idle_pose(0))], t)


def clips() -> list[Clip]:
    return [
        Clip("idle", 2.6, _with_scarf(lambda t: idle_pose(t / 1000), 0.0, 2.6 / 3), loop=True),
        Clip("run", 0.5, _with_scarf(lambda t: run_pose(2 * math.pi * t / 500), 1.0, 0.5), loop=True),
        Clip("attack1", 0.31, _with_scarf(lambda t: attack_pose(0, t), 0.7, 0.31), events={"active": 90, "recovery": 150}),
        Clip("attack2", 0.31, _with_scarf(lambda t: attack_pose(1, t), 0.7, 0.31), events={"active": 80, "recovery": 140}),
        Clip("attack3", 0.6, _with_scarf(lambda t: attack_pose(2, t), 0.7, 0.3), events={"active": 200, "recovery": 280}),
        Clip("dash", 0.16, _with_scarf(lambda t: keyed([(0, lerp_pose(idle_pose(0), DASH, 0.5)), (60, DASH, ease_out), (160, DASH)], t), 1.3, 0.16), events={"iframes_end": 135}),
        Clip("hurt", 0.28, _with_scarf(lambda t: keyed([(0, idle_pose(0)), (80, hurt_pose(80), ease_out), (200, hurt_pose(80)), (280, lerp_pose(hurt_pose(80), idle_pose(0), 0.6))], t), 1.0, 0.28)),
        Clip("death", 1.3, _with_scarf(death_pose, 0.6, 0.65)),
        Clip("spawn", 0.8, _with_scarf(spawn_pose, 0.8, 0.4), events={"land": 300}),
    ]
