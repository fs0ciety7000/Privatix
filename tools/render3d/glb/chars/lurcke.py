"""Boss final : Jean-Cul Lurcke, Directeur de la Transformation et de l'Excellence Opérationnelle (LORE § 7.3).

Caricature bon enfant d'une personnalité réelle, autorisée par le porteur du projet. Entièrement
modélisée en primitives procédurales : AUCUNE photo, aucune texture, aucune UV. Le dirigeant sûr de lui,
souriant, jamais enlaidi. Repères de silhouette (ombre noire à 96 px) : **crâne chauve rond et brillant**,
**épaules massives**, **cravate bleu clair à pois blancs**, et le **stylo plume doré** surdimensionné
(« il tient le stylo » du Contrat-cadre). 2,8 m, tête ≈ 1/3 de la hauteur, carrure trapue.

Visage : yeux rieurs plissés (pattes d'oie), **lunettes octogonales à fine monture dorée** (verres en
matériau « glass »), joues rondes, grand sourire à pleines dents. Les traits du visage sont des
**décalques en relief** (`_patch`, `_strip`) posés sur les ellipsoïdes du crâne et du bas du visage :
ils épousent la courbure sans flotter. Le reflet du crâne est un décalque émissif, comme le reflet
verni des chaussures de Di Rupo. Détails du LORE : oreillette permanente (os `earpiece`, LED cyan),
baskets blanches « pour faire startup », classeur violet « Contrat-cadre » dans la main gauche.

Os : 18 du contrat humanoïde + `jaw` (bouche : l'échelle ouvre ou arrondit le sourire), `brow_L/R`,
`glasses` (de travers en « stagger »), `earpiece`, `tie0..1` (cravate en chaîne, l'échelle de `tie1`
l'allonge en fouet), `pen` (main droite), `binder` (main gauche).
Sockets humanoïdes + `socket_glasses` (éclat), `socket_pen` (bec du stylo : traînée, signature),
`socket_tie` (bout de la cravate : fouet), `socket_binder`.
Le bec du stylo est en « glow » à masque télégraphe : il passe au magenta pendant l'armé.
"""
from __future__ import annotations

import math

import numpy as np

from ..geo import Model
from ..humanoid import Dims, humanoid_skeleton
from ..poses import P, Clip, ease_back, ease_in, ease_out, keyed, linear, merge

NAVY, NAVY_DARK, NAVY_LIGHT, SHIRT = 0x1B2950, 0x111A35, 0x2E4478, 0xF2F4FA
TIE, TIE_DARK, DOT = 0x49A8E0, 0x2C7DB8, 0xFFFFFF
SKIN, SKIN_DARK, SKIN_LIGHT, BLUSH, SHINE = 0xF8C0A2, 0xDC8E74, 0xFCD9C2, 0xF08878, 0xFFF8F0
GOLD, GOLD_DARK, GOLD_LIGHT = 0xF2C14A, 0xB0841C, 0xFFE59A
EYE, BROW, LIP, TEETH = 0x1C2340, 0xC89A72, 0x7A2430, 0xFFFDF6
SNEAKER, SOLE, BINDER, BINDER_DARK = 0xF6F6F2, 0xC9CEDA, 0x6B3CE0, 0x4A28A8
INK = 0x14101A

DIMS = Dims(pelvis_y=1.0, spine=0.17, chest=0.27, neck=0.45, head=0.04, shoulder_w=0.5, shoulder_y=0.26, upper=0.36, fore=0.32, hip_w=0.18, hip_y=-0.04, thigh=0.46, shin=0.44, head_socket_y=0.9, back_z=-0.28, hip_socket_x=0.3)

# Ellipsoïdes de la tête (repère de l'os `head`) : crâne et bas du visage (bajoues souriantes)
SKULL_C, SKULL_R = np.array([0.0, 0.44, 0.0]), np.array([0.42, 0.46, 0.40])
MUZZLE_C, MUZZLE_R = np.array([0.0, 0.22, 0.08]), np.array([0.36, 0.24, 0.33])
JAW = np.array([0.0, 0.2, 0.409])  # centre de la bouche, sur le bas du visage
GLASSES = np.array([0.0, 0.42, 0.43])


def _on(C: np.ndarray, R: np.ndarray, lon: float, lat: float, lift: float) -> np.ndarray:
    """Point de l'ellipsoïde (C, R) à la longitude `lon` (depuis +Z vers +X) et latitude `lat`, relevé de `lift`."""
    d = np.array([math.sin(lon) * math.cos(lat), math.sin(lat), math.cos(lon) * math.cos(lat)])
    n = d / R
    return C + R * d + n / np.linalg.norm(n) * lift


def _decal(m: Model, joint: str, color: int, V: list, F: list, origin, C, R, **kw) -> None:
    V = np.array(V, dtype=float)
    # orientation vers l'extérieur de l'ellipsoïde
    a, b, c = (V[i] for i in F[0][:3])
    if np.dot(np.cross(b - a, c - a), (a - C) / R**2) < 0:
        F = [tuple(reversed(f)) for f in F]
    m.custom(joint, color, V, F, pos=tuple(-np.asarray(origin, dtype=float)), outline=0, **kw)


def _patch(m: Model, joint: str, color: int, C, R, lon0: float, lat0: float, poly, lift: float = 0.005, rings: int = 3, origin=(0, 0, 0), **kw) -> None:
    """Décalque en étoile (polygone (dlon, dlat) en radians) épousant l'ellipsoïde (C, R)."""
    poly = np.array(poly, dtype=float)
    n = len(poly)
    c = poly.mean(axis=0)
    uv = [c] + [c + (poly[i] - c) * k / rings for k in range(1, rings + 1) for i in range(n)]
    V = [_on(C, R, lon0 + u, lat0 + v, lift) for u, v in uv]
    idx = lambda k, i: 1 + (k - 1) * n + (i % n)  # noqa: E731
    F = [(0, idx(1, i), idx(1, i + 1)) for i in range(n)]
    for k in range(1, rings):
        F += [(idx(k, i), idx(k + 1, i), idx(k + 1, i + 1), idx(k, i + 1)) for i in range(n)]
    _decal(m, joint, color, V, F, origin, C, R, **kw)


def _strip(m: Model, joint: str, color: int, C, R, lon0: float, lat0: float, top, bot, lift: float = 0.005, rows: int = 2, origin=(0, 0, 0), **kw) -> None:
    """Bande entre deux courbes (dlon, dlat) de même longueur : bouche, dents, paupières, rides."""
    top, bot = np.array(top, dtype=float), np.array(bot, dtype=float)
    n = len(top)
    V = [_on(C, R, lon0 + p[0], lat0 + p[1], lift) for r in range(rows + 1) for p in top + (bot - top) * r / rows]
    F = [(r * n + i, r * n + i + 1, (r + 1) * n + i + 1, (r + 1) * n + i) for r in range(rows) for i in range(n - 1)]
    _decal(m, joint, color, V, F, origin, C, R, **kw)


def _ellipse(a: float, b: float, n: int = 12) -> list:
    return [(a * math.cos(2 * math.pi * i / n), b * math.sin(2 * math.pi * i / n)) for i in range(n)]


def _octagon(r: float) -> list:
    return [(r * math.cos(math.radians(22.5 + 45 * k)), r * math.sin(math.radians(22.5 + 45 * k))) for k in range(8)]


def _skull_angles(x: float, y: float) -> tuple[float, float]:
    lat = math.asin((y - SKULL_C[1]) / SKULL_R[1])
    lon = math.asin(max(-1.0, min(1.0, x / (SKULL_R[0] * math.cos(lat)))))
    return lon, lat


def _face(m: Model) -> None:
    S = (SKULL_C, SKULL_R)
    Mz = (MUZZLE_C, MUZZLE_R)
    # Crâne chauve, bas du visage plein, joues rondes, oreilles
    m.sphere("head", SKIN, tuple(SKULL_C), tuple(SKULL_R), seg=30)
    m.sphere("head", SKIN, tuple(MUZZLE_C), tuple(MUZZLE_R), seg=22)
    for sx in (1, -1):
        m.sphere("head", SKIN, (0.22 * sx, 0.32, 0.25), (0.13, 0.11, 0.12), outline=0, seg=14)  # joues
        m.sphere("head", BLUSH, (0.24 * sx, 0.31, 0.358), (0.06, 0.035, 0.012), outline=0, seg=10, emit=0.05)  # pommettes rosées
        m.sphere("head", SKIN, (0.415 * sx, 0.39, -0.02), (0.06, 0.12, 0.085), rot=(0, 0, -8 * sx), seg=12)  # oreilles
        m.sphere("head", SKIN_DARK, (0.44 * sx, 0.39, -0.005), (0.03, 0.07, 0.045), rot=(0, 0, -8 * sx), outline=0, seg=8)
    # Reflet du crâne (spéculaire toon) : halo clair + bande vive + point, émissifs
    _patch(m, "head", SKIN_LIGHT, *S, -0.18, 0.92, _ellipse(0.75, 0.24, 14), lift=0.003, emit=0.15)
    _patch(m, "head", SHINE, *S, -0.24, 0.98, _ellipse(0.5, 0.1, 12), lift=0.005, emit=0.65)
    _patch(m, "head", SHINE, *S, 0.42, 0.78, _ellipse(0.1, 0.05, 8), lift=0.005, emit=0.65)
    # Nez rond
    m.sphere("head", SKIN, (0, 0.33, 0.405), (0.07, 0.065, 0.065), seg=12, outline=0.6)
    for sx in (1, -1):
        m.sphere("head", SKIN_DARK, (0.05 * sx, 0.3, 0.42), (0.035, 0.028, 0.03), outline=0, seg=8)
    # Plis du sourire (nez → coins de la bouche)
    for sx in (1, -1):
        top = [(sx * (0.24 + 0.42 * t + 0.05 * math.sin(math.pi * t)), 0.42 - 0.6 * t) for t in np.linspace(0, 1, 7)]
        bot = [(u + sx * 0.022, v) for u, v in top]
        _strip(m, "head", SKIN_DARK, *Mz, 0.0, 0.0, top, bot, rows=1, lift=0.004)
    # Yeux rieurs plissés (amande cintrée en haut), reflet, paupière et pattes d'oie
    for sx in (1, -1):
        lon, lat = _skull_angles(0.13 * sx, 0.42)
        us = np.linspace(-0.1, 0.1, 9)
        top = [(u, 0.075 * (1 - (u / 0.1) ** 2) + 0.012) for u in us]
        bot = [(u, -0.018 * (1 - (u / 0.1) ** 2) + 0.012) for u in us]
        _strip(m, "head", EYE, *S, lon, lat, top, bot, rows=2, lift=0.005)
        _patch(m, "head", 0xFFFFFF, *S, lon + 0.025 * sx, lat + 0.05, _ellipse(0.016, 0.016, 6), lift=0.008, emit=0.4)
        lid = [(u, 0.11 * (1 - (u / 0.12) ** 2) + 0.012) for u in np.linspace(-0.12, 0.12, 9)]
        _strip(m, "head", SKIN_DARK, *S, lon, lat, lid, [(u, v - 0.02) for u, v in lid], rows=1, lift=0.004)
        for k, a in enumerate((-28, 0, 28)):
            ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
            line = [(sx * (0.13 + 0.09 * t * ca), 0.01 + 0.09 * t * sa / 0.92) for t in np.linspace(0, 1, 4)]
            _strip(m, "head", SKIN_DARK, *S, lon, lat, line, [(u, v - 0.014) for u, v in line], rows=1, lift=0.004)
    # Sourcils clairs, fins, haussés (os pour l'expression)
    for s, sx in (("L", 1), ("R", -1)):
        lon, lat = _skull_angles(0.14 * sx, 0.55)
        arc = [(u, 0.035 * (1 - (u / 0.13) ** 2)) for u in np.linspace(-0.13, 0.13, 7)]
        _strip(m, f"brow_{s}", BROW, *S, lon, lat, arc, [(u, v - 0.035) for u, v in arc], rows=1, lift=0.006, origin=m.bones[f"brow_{s}"].offset)
    # Grand sourire à pleines dents (os `jaw` : centre de la bouche)
    lat0 = math.asin((JAW[1] - MUZZLE_C[1]) / MUZZLE_R[1])
    U = 0.5
    us = np.linspace(-U, U, 13)
    top = [(u, 0.06 + 0.16 * (u / U) ** 2) for u in us]
    bot = [(u, 0.06 + 0.16 * (u / U) ** 2 - 0.42 * (1 - (u / U) ** 2)) for u in us]
    _strip(m, "jaw", LIP, *Mz, 0.0, lat0, top, bot, rows=3, lift=0.006, origin=JAW)
    ut = np.linspace(-0.82 * U, 0.82 * U, 11)
    tt = [(u, 0.06 + 0.16 * (u / U) ** 2 - 0.02) for u in ut]
    tb = [(u, v - 0.17 * (1 - (u / (0.9 * U)) ** 2) - 0.02) for u, v in tt]
    _strip(m, "jaw", TEETH, *Mz, 0.0, lat0, tt, tb, rows=2, lift=0.011, origin=JAW, emit=0.15)
    for u in np.linspace(-0.6 * U, 0.6 * U, 6):  # séparations des dents
        v = 0.06 + 0.16 * (u / U) ** 2 - 0.02
        _strip(m, "jaw", 0xD8D0C8, *Mz, 0.0, lat0, [(u - 0.006, v), (u + 0.006, v)], [(u - 0.006, v - 0.11), (u + 0.006, v - 0.11)], rows=1, lift=0.013, origin=JAW)
    lb = [(u, 0.06 + 0.16 * (u / U) ** 2 - 0.42 * (1 - (u / U) ** 2) + 0.12 * (1 - (u / U) ** 2)) for u in ut * 0.7]
    _strip(m, "jaw", 0xE07070, *Mz, 0.0, lat0, lb, [(u, v - 0.06 * (1 - (u / (0.6 * U)) ** 2)) for u, v in lb], rows=1, lift=0.009, origin=JAW)  # langue


def _glasses(m: Model) -> None:
    """Lunettes octogonales, fine monture dorée à double pont, branches jusqu'aux oreilles."""
    for sx in (1, -1):
        rot = (0, 10 * sx, 0)
        m.torus("glasses", GOLD, (0.13 * sx, 0, 0.0), 0.088, 0.009, rot=(0, 10 * sx, 22.5), radial=5, tubular=8, outline=0.5, emit=0.12)
        m.shape("glasses", 0xDDEBFF, (0.13 * sx, 0, -0.004), _octagon(0.084), 0.004, rot=rot, mat="glass", outline=0, emit=1.0)
        m.capsule("glasses", GOLD, (0.215 * sx, 0.02, -0.02), (0.42 * sx, 0.0, -0.42), 0.007, outline=0)
        m.capsule("glasses", GOLD, (0.205 * sx, 0.03, -0.015), (0.222 * sx, 0.024, -0.03), 0.012, outline=0)  # charnière
    m.capsule("glasses", GOLD, (-0.045, 0.012, 0.012), (0.045, 0.012, 0.012), 0.008, outline=0)
    m.capsule("glasses", GOLD, (-0.075, 0.07, 0.005), (0.075, 0.07, 0.005), 0.007, outline=0)  # pont supérieur
    for sx in (1, -1):  # plaquettes
        m.sphere("glasses", GOLD_LIGHT, (0.055 * sx, -0.03, -0.01), (0.012, 0.018, 0.008), outline=0, seg=6)


def model() -> Model:
    m = Model("lurcke")
    humanoid_skeleton(m, DIMS)
    m.joint("jaw", "head", tuple(JAW))
    for s, sx in (("L", 1), ("R", -1)):
        m.joint(f"brow_{s}", "head", (0.14 * sx, 0.55, 0.37))
    m.joint("glasses", "head", tuple(GLASSES))
    m.joint("earpiece", "head", (-0.45, 0.4, 0.02))
    m.joint("tie0", "chest", (0, 0.36, 0.262))
    m.joint("tie1", "tie0", (0, -0.34, 0.035))
    m.joint("pen", "hand_R", (0, -0.07, 0.02))
    m.joint("binder", "hand_L", (0, -0.1, 0))
    m.socket("socket_glasses", "glasses", (0.13, 0.04, 0.02))
    m.socket("socket_pen", "pen", (0, 0, 0.84))
    m.socket("socket_tie", "tie1", (0, -0.34, 0.02))
    m.socket("socket_binder", "binder", (0.06, -0.12, 0))
    m.meta = {"kind": "boss", "height": 2.8, "radius": 0.75, "outline": 0x06302C, "rim": 0xFFD84A}

    # Jambes : pantalon marine à pli, baskets blanches « pour faire startup »
    for s in ("L", "R"):
        m.capsule(f"hip_{s}", NAVY, (0, 0.02, 0), (0, -0.45, 0), 0.165, 0.14)
        m.capsule(f"knee_{s}", NAVY, (0, 0, 0), (0, -0.38, 0), 0.135, 0.12)
        m.box(f"knee_{s}", NAVY_DARK, (0, -0.2, 0.13), (0.014, 0.32, 0.01), 0.004, outline=0)  # pli
        m.box(f"foot_{s}", SOLE, (0, -0.0, 0.07), (0.25, 0.07, 0.44), 0.03, seg=1)
        m.box(f"foot_{s}", SNEAKER, (0, 0.07, 0.05), (0.23, 0.14, 0.38), 0.06)
        m.sphere(f"foot_{s}", SNEAKER, (0, 0.07, 0.2), (0.115, 0.075, 0.1), seg=10)
        m.box(f"foot_{s}", BINDER, (0.118 * (1 if s == "L" else -1), 0.07, 0.04), (0.006, 0.04, 0.2), 0.0, rot=(-14, 0, 0), outline=0, emit=0.1)  # bande violette
    # Bassin, ventre rond, veste cintrée fermée d'un bouton
    m.box("pelvis", NAVY, (0, 0.0, 0), (0.6, 0.26, 0.46), 0.12)
    m.box("pelvis", NAVY, (0, 0.06, 0.0), (0.74, 0.28, 0.54), 0.14)  # basques
    m.box("pelvis", NAVY_DARK, (0, 0.05, 0.268), (0.018, 0.24, 0.01), 0.004, outline=0)  # fente avant
    m.box("spine", NAVY, (0, 0.06, 0.02), (0.84, 0.42, 0.56), 0.2)  # ventre rond
    m.cyl("spine", INK, (0, 0.04, 0.3), 0.024, 0.014, rot=(90, 0, 0), seg=10, outline=0)  # bouton
    m.box("chest", NAVY, (0, 0.12, 0), (0.94, 0.6, 0.52), 0.21)
    # plastron : chemise en V, revers biseautés, pochette blanche
    m.box("chest", SHIRT, (0, 0.24, 0.255), (0.2, 0.36, 0.03), 0.012, outline=0)
    for sx in (1, -1):
        m.box("chest", NAVY_DARK, (0.115 * sx, 0.16, 0.262), (0.11, 0.5, 0.03), 0.012, rot=(0, 0, 17 * sx), outline=0)
        m.box("chest", NAVY_LIGHT, (0.15 * sx, 0.3, 0.275), (0.012, 0.22, 0.008), 0.003, rot=(0, 0, 22 * sx), outline=0)  # liseré du revers
    m.box("chest", SHIRT, (0.27, 0.22, 0.25), (0.09, 0.035, 0.014), 0.006, rot=(0, 0, 8), outline=0)  # pochette
    # Col blanc, cou épais
    m.cyl("neck", SKIN, (0, -0.02, 0.01), 0.21, 0.22, seg=16)
    m.cyl("neck", SHIRT, (0, -0.01, 0.0), 0.235, 0.12, rb=0.25, seg=16)
    for sx in (1, -1):
        m.box("neck", SHIRT, (0.07 * sx, -0.03, 0.22), (0.12, 0.08, 0.04), 0.015, rot=(0, 0, -30 * sx))
    # Bras puissants : épaules de veste, manchettes, grosses mains
    for s, sx in (("L", 1), ("R", -1)):
        m.box(f"shoulder_{s}", NAVY, (0.0, 0.0, 0), (0.28, 0.2, 0.34), 0.09)
        m.capsule(f"shoulder_{s}", NAVY, (0, -0.02, 0), (0, -0.36, 0), 0.14, 0.12)
        m.capsule(f"elbow_{s}", NAVY, (0, 0, 0), (0, -0.27, 0), 0.12, 0.105)
        m.cyl(f"hand_{s}", SHIRT, (0, 0.04, 0), 0.1, 0.06, seg=12)
        m.cyl(f"hand_{s}", GOLD, (0.0, 0.04, 0.1), 0.018, 0.02, rot=(90, 0, 0), seg=8, outline=0, emit=0.2)  # bouton de manchette
        m.sphere(f"hand_{s}", SKIN, (0, -0.05, 0), (0.11, 0.12, 0.1))
        m.capsule(f"hand_{s}", SKIN, (0.05 * sx, -0.03, 0.05), (0.08 * sx, -0.09, 0.09), 0.035)  # pouce
    _face(m)
    _glasses(m)
    # Oreillette permanente (oreille droite) : coque sombre, LED cyan
    m.sphere("earpiece", 0x2A2E3A, (0, 0, 0), (0.035, 0.045, 0.04), seg=8)
    m.capsule("earpiece", 0x2A2E3A, (0, -0.02, 0.01), (0.0, -0.1, 0.07), 0.012, outline=0)
    m.sphere("earpiece", 0x6FF3FF, (-0.03, 0.01, 0.0), (0.012, 0.012, 0.012), mat="glow", outline=0, seg=6)
    # Cravate bleu clair à pois blancs : nœud, pan haut (tie0), pan bas en pointe (tie1)
    m.shape("tie0", TIE, (0, 0, 0.012), [(-0.065, 0.05), (0.065, 0.05), (0.045, -0.06), (-0.045, -0.06)], 0.06, emit=0.05)
    m.shape("tie0", TIE, (0, -0.2, 0.0), [(-0.05, 0.15), (0.05, 0.15), (0.085, -0.16), (-0.085, -0.16)], 0.028, emit=0.05)
    m.shape("tie1", TIE, (0, -0.16, 0.0), [(-0.088, 0.17), (0.088, 0.17), (0.095, -0.1), (0.0, -0.19), (-0.095, -0.1)], 0.028, emit=0.05)
    m.box("tie1", TIE_DARK, (0, -0.02, 0.0), (0.18, 0.012, 0.03), 0.0, outline=0)  # pli entre les pans
    m.cyl("tie0", DOT, (0, 0, 0.044), 0.012, 0.004, rot=(90, 0, 0), seg=6, outline=0, emit=0.2)  # pois du nœud
    for y, row in ((-0.08, (-0.03, 0.03)), (-0.16, (0.0,)), (-0.24, (-0.045, 0.045)), (-0.32, (0.0,))):
        for x in row:
            m.cyl("tie0", DOT, (x, y, 0.016), 0.012, 0.004, rot=(90, 0, 0), seg=6, outline=0, emit=0.2)
    for y, row in ((-0.06, (-0.05, 0.0, 0.05)), (-0.14, (-0.025, 0.025)), (-0.22, (-0.05, 0.0, 0.05)), (-0.29, (0.0,))):
        for x in row:
            m.cyl("tie1", DOT, (x, y, 0.016), 0.012, 0.004, rot=(90, 0, 0), seg=6, outline=0, emit=0.2)
    # Stylo plume doré surdimensionné (main droite), le long de +Z ; bec « glow » (télégraphe)
    k = 1.3
    m.cyl("pen", INK, (0, 0, -0.17 * k), 0.05 * k, 0.06 * k, rot=(90, 0, 0), seg=12)  # culot
    m.cyl("pen", GOLD, (0, 0, 0.12 * k), 0.048 * k, 0.52 * k, rot=(90, 0, 0), seg=12, emit=0.1)
    m.box("pen", GOLD_DARK, (0.0, 0.05 * k, 0.0), (0.016, 0.012, 0.3 * k), 0.004, outline=0)  # agrafe
    for z in (-0.12, 0.36):
        m.cyl("pen", GOLD_LIGHT, (0, 0, z * k), 0.053 * k, 0.02 * k, rot=(90, 0, 0), seg=12, outline=0, emit=0.3)  # bagues
    m.cyl("pen", INK, (0, 0, 0.43 * k), 0.044 * k, 0.12 * k, rb=0.036 * k, rot=(90, 0, 0), seg=12)  # section
    m.shape("pen", GOLD_LIGHT, (0, 0, 0.53 * k), [(-0.034 * k, -0.03 * k), (0.034 * k, -0.03 * k), (0.0, 0.11 * k)], 0.012 * k, rot=(90, 0, 0), mat="glow", outline=0, emit=1.0)  # bec
    m.cyl("pen", GOLD, (0, 0.0, 0.52 * k), 0.036 * k, 0.04 * k, rb=0.03 * k, rot=(90, 0, 0), seg=10, outline=0)
    # Classeur « Contrat-cadre » (main gauche) : couverture violette, étiquette, sceau doré
    m.box("binder", BINDER, (0.02, -0.16, 0.0), (0.09, 0.5, 0.38), 0.025)
    m.box("binder", BINDER_DARK, (0.02, -0.16, -0.19), (0.1, 0.5, 0.03), 0.01, outline=0)  # dos
    m.box("binder", SHIRT, (0.068, -0.08, 0.0), (0.006, 0.2, 0.26), 0.0, outline=0)  # étiquette
    for k in range(3):
        m.box("binder", 0x8A8FA8, (0.072, -0.03 - k * 0.045, 0.0), (0.004, 0.012, 0.2 - 0.05 * k), 0.0, outline=0)
    m.cyl("binder", GOLD, (0.07, -0.3, 0.08), 0.045, 0.01, rot=(0, 0, 90), seg=10, outline=0, emit=0.3)  # sceau
    return m


# ─── Poses ────────────────────────────────────────────────────────────────────

REST = {"hip_L": (-2, 0, 4), "hip_R": (2, 0, -4), "knee_L": (4, 0, 0), "knee_R": (4, 0, 0), "foot_L": (-2, 0, -6), "foot_R": (-2, 0, 6),
        "shoulder_L": (-8, 0, 14), "elbow_L": (-20, 0, 0), "shoulder_R": (-26, 0, -12), "elbow_R": (-72, 0, 0), "hand_R": (30, 0, 0)}
GRIN = {"jaw": (1.0, 1.0, 1.0)}


def idle(t: float) -> dict:
    """Sûr de lui : stylo levé qui ponctue, classeur au flanc, hochements satisfaits, ventre qui respire."""
    w = 2 * math.pi / 2.4
    b = math.sin(t * w)
    beat = max(0.0, math.sin(t * w * 2)) ** 2
    rot = {
        **REST,
        "spine": (-3 + b, 0, 0), "chest": (-4, 5 * b, 0), "neck": (0, 0, 0), "head": (-4 + 4 * beat, -6 * b, 2 * b),
        "shoulder_R": (-30 - 8 * beat, 0, -12), "elbow_R": (-74 + 6 * beat, 0, 0), "hand_R": (30 + 10 * beat, 0, 0),
        "tie0": (-3 * b, 0, 0), "tie1": (2 * b, 0, 0),
    }
    return P(rot, root=(0, 0.01 * b, 0), loc={"brow_L": (0, 0.01 * beat, 0), "brow_R": (0, 0.01 * beat, 0)},
             scl={"jaw": (1.0, 1.0 + 0.12 * beat, 1.0)}, scale=(1.0 + 0.006 * b, 1.0, 1.0 + 0.01 * b))


def walk(ph: float) -> dict:
    """Pas lourd et assuré, épaules qui roulent, stylo en main."""
    s, c = math.sin(ph), math.cos(ph)
    a = 22 * s
    rot = {
        "pelvis": (0, 8 * s, 3 * s), "spine": (-4, -4 * s, 0), "chest": (-2, -10 * s, -3 * s), "head": (-6, 6 * s, 0),
        "shoulder_L": (a * 0.6 - 6, 0, 14), "elbow_L": (-22, 0, 0),
        "shoulder_R": (-26 - a * 0.4, 0, -12), "elbow_R": (-70, 0, 0), "hand_R": (30, 0, 0),
        "hip_L": (-a, 0, 4), "knee_L": (8 + 46 * max(0, c), 0, 0), "foot_L": (-6 * s, 0, 0),
        "hip_R": (a, 0, -4), "knee_R": (8 + 46 * max(0, -c), 0, 0), "foot_R": (6 * s, 0, 0),
        "tie0": (-4 * abs(c), 0, 3 * s), "tie1": (6 * c, 0, 0),
    }
    return P(rot, root=(0.02 * s, -0.025 + 0.045 * abs(c), 0))


SMILE = P({**REST, "head": (-10, 0, 5), "chest": (-6, 0, 0), "shoulder_R": (-150, 0, -14), "elbow_R": (-20, 0, 0), "hand_R": (70, 0, 0)},
          loc={"brow_L": (0, 0.03, 0), "brow_R": (0, 0.03, 0)}, scl={"jaw": (1.05, 1.25, 1.0)}, scale=(0.97, 1.04, 0.97))
CALL = P({**REST, "head": (6, 0, -14), "chest": (-2, -10, 0), "shoulder_R": (-50, 0, -95), "elbow_R": (-120, 0, 0), "hand_R": (0, 0, 40)},
         loc={"brow_L": (0, 0.02, 0)}, scl={"jaw": (0.8, 1.1, 1.0)})


def intro(t: float) -> dict:
    """De dos, au téléphone (oreillette) ; il se retourne, lève le stylo, sourire éclatant (éclat des lunettes)."""
    back = merge(CALL, root=(0, 0, 0), rot={"root": (0, 180, 0)})
    turn = merge(CALL, rot={"root": (0, 40, 0), "head": (0, 0, 0)})
    return keyed([(0, back), (450, merge(back, rot={"head": (8, 0, -18)})), (900, turn, ease_out), (1150, merge(idle(0), rot={"root": (0, 0, 0)}), ease_out), (1650, SMILE, ease_back), (2200, SMILE)], t)


def slide(t: float) -> dict:
    """« Slide 1 sur 412 » : le stylo en pointeur balaie toute la salle (bullet points), de sa droite à sa gauche."""
    aim = lambda y, ch: P({**REST, "chest": (-4, ch, 0), "spine": (-2, ch * 0.5, 0), "head": (-6, ch * 0.8, 0), "shoulder_R": (-88, y, 0), "elbow_R": (-4, 0, 0), "hand_R": (90, 0, 0),  # noqa: E731
                           "shoulder_L": (-30, 0, 30), "elbow_L": (-60, 0, 0), "hip_L": (-8, 0, 8), "hip_R": (6, 0, -8)},
                          loc={"brow_L": (0, 0.025, 0), "brow_R": (0, 0.025, 0)}, scl={"jaw": (1.0, 1.3, 1.0)})
    wind = merge(aim(-70, -24), root=(0, -0.03, -0.04), rot={"chest": (-8, -30, 0)})
    sweep = merge(aim(55, 26), root=(0, 0, 0.08))
    return keyed([(0, idle(0)), (450, wind, ease_out), (700, wind), (950, sweep, ease_in), (1150, merge(sweep, rot={"shoulder_R": (-84, 60, 0)})), (1500, idle(0))], t)


def sign(t: float) -> dict:
    """Signature : classeur ouvert devant lui, stylo levé au-dessus de la tête, puis paraphe planté au sol (piliers-graphiques)."""
    up = P({**REST, "spine": (-8, 10, 0), "chest": (-10, 14, 0), "head": (-14, 0, 0), "shoulder_R": (-168, 0, -20), "elbow_R": (-40, 0, 0), "hand_R": (-60, 0, 0),
            "shoulder_L": (-70, 0, 20), "elbow_L": (-40, 0, 0), "binder": (0, 0, -70), "hip_L": (-6, 0, 8), "hip_R": (8, 0, -8)},
           loc={"brow_L": (0, 0.03, 0), "brow_R": (0, 0.03, 0)}, scl={"jaw": (0.9, 1.3, 1.0)}, root=(0, 0.04, -0.06), scale=(0.97, 1.05, 0.97))
    stab = P({**REST, "spine": (18, -6, 0), "chest": (16, -10, 0), "head": (6, 0, 0), "shoulder_R": (-62, 10, -10), "elbow_R": (-26, 0, 0), "hand_R": (-182, 0, 0),
              "shoulder_L": (-50, 0, 30), "elbow_L": (-50, 0, 0), "binder": (0, 0, -40), "hip_L": (-30, 0, 8), "knee_L": (34, 0, 0), "hip_R": (14, 0, -8), "knee_R": (10, 0, 0)},
             scl={"jaw": (1.1, 1.4, 1.0)}, root=(0, -0.12, 0.2), scale=(1.05, 0.94, 1.05))
    return keyed([(0, idle(0)), (300, merge(idle(0), rot={"shoulder_L": (-70, 0, 20), "elbow_L": (-40, 0, 0), "binder": (0, 0, -70)}), ease_out), (750, up, ease_out), (850, up), (950, stab, ease_in), (1250, stab), (1600, idle(0))], t)


def cc(t: float) -> dict:
    """« Je vous mets en copie. Et vous. Et vous. » : trois coups de stylo pointés, sourire commercial."""
    point = lambda y: P({**REST, "chest": (-4, y * 0.4, 0), "head": (-4, y * 0.6, 0), "shoulder_R": (-92, y, 0), "elbow_R": (-10, 0, 0), "hand_R": (95, 0, 0),  # noqa: E731
                         "shoulder_L": (-40, 0, 24), "elbow_L": (-70, 0, 0)}, loc={"brow_L": (0, 0.03, 0), "brow_R": (0, 0.03, 0)}, scl={"jaw": (1.05, 1.3, 1.0)})
    cock = merge(point(-10), rot={"shoulder_R": (-120, -10, -20), "elbow_R": (-70, 0, 0), "hand_R": (40, 0, 0)}, root=(0, 0, -0.05))
    return keyed([(0, idle(0)), (400, cock, ease_out), (600, point(-35), ease_in), (800, merge(point(-35), rot={"hand_R": (75, 0, 0)})), (900, point(0), ease_in),
                  (1080, merge(point(0), rot={"hand_R": (75, 0, 0)})), (1180, point(35), ease_in), (1400, point(35)), (1700, idle(0))], t)


def tie_whip(t: float) -> dict:
    """Reporting du Conseil : il saisit sa cravate, la déroule en fouet et pivote sur lui-même (onde circulaire)."""
    grab = P({**REST, "chest": (-6, 0, 0), "head": (-8, 0, 0), "shoulder_L": (-50, 0, -10), "elbow_L": (-90, 0, 0), "hand_L": (0, 0, 0),
              "tie0": (-30, 0, 0), "tie1": (-20, 0, 0), "shoulder_R": (-60, 0, -40), "elbow_R": (-60, 0, 0)},
             scl={"jaw": (1.0, 1.25, 1.0)}, loc={"brow_L": (0, 0.03, 0), "brow_R": (0, 0.03, 0)}, root=(0, -0.05, 0), scale=(1.04, 0.95, 1.04))

    def spin(y: float) -> dict:
        return P({**REST, "root": (0, y, 0), "chest": (-4, 0, 0), "head": (-4, 0, 0), "spine": (-6, 0, 0), "tie0": (-95, 0, 0), "tie1": (-6, 0, 0),
                  "shoulder_L": (-20, 0, 70), "elbow_L": (-10, 0, 0), "shoulder_R": (-20, 0, -70), "elbow_R": (-10, 0, 0), "hand_R": (40, 0, 0)},
                 scl={"tie1": (1.2, 2.6, 1.2), "jaw": (1.0, 1.35, 1.0)}, loc={"brow_L": (0, 0.03, 0), "brow_R": (0, 0.03, 0)})

    return keyed([(0, idle(0)), (450, grab, ease_out), (600, spin(-60), ease_in), (950, spin(-240), linear), (1300, spin(-420), linear), (1600, spin(-540), ease_out),
                  (1900, merge(idle(0), rot={"root": (0, -720, 0)}), ease_out)], t)


def phase2(t: float) -> dict:
    """« Mesdames et messieurs du Conseil, vous m'entendez ? » : il tapote son oreillette, regarde autour de lui."""
    look = lambda y: merge(CALL, rot={"head": (2, y, -14), "chest": (-2, y * 0.3, 0)})  # noqa: E731
    tap = merge(CALL, rot={"hand_R": (0, 0, 60)}, loc={"earpiece": (0.01, 0.0, 0.0)})
    return keyed([(0, idle(0)), (250, CALL, ease_out), (400, tap), (550, CALL), (700, tap), (850, look(-30), ease_out), (1150, look(30)), (1350, CALL), (1500, idle(0))], t)


HURT = P({**REST, "spine": (-14, 0, 6), "chest": (-12, 0, 0), "head": (-18, 0, 10), "shoulder_L": (-30, 0, 50), "shoulder_R": (-40, 0, -50), "elbow_L": (-40, 0, 0), "elbow_R": (-50, 0, 0),
          "glasses": (0, 0, 7), "tie0": (20, 0, 0), "tie1": (16, 0, 0)}, root=(0, -0.04, -0.12), scl={"jaw": (0.8, 1.3, 1.0)})


def stagger(t: float) -> dict:
    """« … Concrètement ? » Sans voix : bouche en O, lunettes de travers, il se gratte le crâne avec le stylo."""
    w = 2 * math.pi / 1.2
    s = math.sin(t * w)
    scratch = math.sin(t * w * 4)
    rot = {**REST, "spine": (4, 0, 6 * s), "chest": (4, 0, 5 * s), "head": (8, 10 * s, -8 * s), "glasses": (0, 0, 14), "earpiece": (0, 0, 25),
           "shoulder_R": (-130, 0, -60), "elbow_R": (-110 + 8 * scratch, 0, 0), "hand_R": (-20, 0, 0),
           "shoulder_L": (-10, 0, 26), "elbow_L": (-30, 0, 0), "tie0": (4, 0, 6 * s), "tie1": (6, 0, 0),
           "hip_L": (-6, 0, 8 + 3 * s), "hip_R": (6, 0, -8 + 3 * s), "knee_L": (12, 0, 0), "knee_R": (12, 0, 0)}
    return P(rot, root=(0.04 * s, -0.04, 0), loc={"glasses": (0.02, -0.035, 0.0), "brow_L": (0, 0.04, 0), "brow_R": (0, 0.02, 0)}, scl={"jaw": (0.45, 1.25, 1.0)})


def defeat(t: float) -> dict:
    """À genoux, oreillette de travers : « Bon. Soyons adultes. Une phase pilote. Une seule ligne. » (index levé)."""
    kneel = P({"pelvis": (0, 0, 0), "spine": (10, 0, 0), "chest": (8, 0, 0), "head": (10, 0, 0), "hip_L": (-90, 0, 10), "knee_L": (90, 0, 0), "foot_L": (0, 0, 0),
               "hip_R": (-10, 0, -8), "knee_R": (100, 0, 0), "foot_R": (-30, 0, 0), "shoulder_L": (-20, 0, 18), "elbow_L": (-30, 0, 0), "shoulder_R": (-20, 0, -18), "elbow_R": (-40, 0, 0),
               "glasses": (0, 0, 12), "earpiece": (30, 0, 30), "tie0": (14, 0, 0), "tie1": (10, 0, 0)},
              root=(0, -0.46, 0.0), loc={"glasses": (0.015, -0.03, 0.0), "earpiece": (0.0, -0.06, 0.04)}, scl={"jaw": (0.6, 1.1, 1.0)})
    pilot = merge(kneel, rot={"head": (-6, 0, 6), "chest": (-2, 0, 0), "shoulder_L": (-150, 0, 6), "elbow_L": (-20, 0, 0), "shoulder_R": (-40, 0, -20), "elbow_R": (-70, 0, 0), "hand_R": (40, 0, 0)},
                  loc={"glasses": (0.015, -0.03, 0.0), "earpiece": (0.0, -0.06, 0.04), "brow_L": (0, 0.03, 0), "brow_R": (0, 0.03, 0)}, scl={"jaw": (0.85, 1.0, 1.0)})
    return keyed([(0, HURT), (450, merge(kneel, root=(0, -0.36, 0.0)), ease_in), (650, kneel, ease_out), (1300, kneel), (1750, pilot, ease_back), (2600, pilot)], t)


def clips() -> list[Clip]:
    return [
        Clip("intro", 2.2, intro, events={"glint": 1650}),
        Clip("idle", 2.4, lambda t: idle(t / 1000), loop=True),
        Clip("walk", 1.0, lambda t: walk(2 * math.pi * t / 1000), loop=True),
        Clip("attack-slide", 1.5, slide, events={"windup": 0, "active": 700, "recovery": 1150}),
        Clip("attack-sign", 1.6, sign, events={"windup": 0, "glint": 750, "active": 950, "recovery": 1250}),
        Clip("attack-cc", 1.7, cc, events={"windup": 0, "active": 600, "recovery": 1400}),
        Clip("attack-tie", 1.9, tie_whip, events={"windup": 0, "active": 600, "recovery": 1600}),
        Clip("phase2", 1.5, phase2),
        Clip("hurt", 0.35, lambda t: keyed([(0, idle(0)), (80, HURT, ease_out), (350, idle(0))], t)),
        Clip("stagger", 1.2, lambda t: stagger(t / 1000), loop=True),
        Clip("defeat", 2.6, defeat),
    ]
