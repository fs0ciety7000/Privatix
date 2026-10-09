"""Rampes de couleurs à décalage de teinte (ombres froides → lumières chaudes), une par matière.

Chaque matière du modèle 3D porte un identifiant ; post.py remplace la lumière rendue par un ton
de sa rampe. C'est ce qui donne le rendu « Celeste » : peu de tons, très maîtrisés, saturés.
"""
from __future__ import annotations

OUTLINE = "#14101a"
RIM = "#7ef0ff"


def _hex(c: str) -> tuple[int, int, int]:
    c = c.lstrip("#")
    return int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)


# id → (nom, rampe du plus sombre au plus clair, émissif ?, liseré ?)
MATERIALS: dict[int, tuple[str, list[str], bool, bool]] = {
    1: ("peau", ["#4a2330", "#86443e", "#c4735a", "#e89c78", "#f6c49e"], False, True),
    2: ("casque", ["#4b2a1a", "#9c5c12", "#e0a10c", "#ffd200", "#fff3a6"], False, True),
    3: ("gilet", ["#3e1424", "#8f2e1c", "#d4501a", "#ff7a1a", "#ff9e3d"], False, True),
    4: ("bande", ["#5f6f8c", "#b9c9dc", "#f4f8ff", "#ffffff"], False, False),
    5: ("tenue", ["#0e1229", "#18213f", "#253563", "#38508c", "#5d7cba"], False, True),
    6: ("bottes", ["#0d0a10", "#221a22", "#3d3238", "#5f5050"], False, True),
    7: ("acier", ["#161a2b", "#323a55", "#5f6b8a", "#9eabc3", "#e5edf8"], False, True),
    8: ("écharpe", ["#2e0b1f", "#6c1230", "#b8223b", "#eb4646", "#ff8f7d"], False, True),
    9: ("yeux", ["#14101a"], False, False),
    10: ("smear-cœur", ["#fffbe8"], True, False),
    11: ("smear-bord", ["#ffd08a"], True, False),
    12: ("cheveux", ["#1a1018", "#3b2420", "#5e3a2a", "#80543a"], False, True),
    # Ennemis (Privatix : turquoise de lecture #19C3B1).
    20: ("costume", ["#0a1a24", "#0f3340", "#16575e", "#19c3b1", "#7af0dc"], False, True),
    21: ("chemise", ["#3a4660", "#8a98b5", "#d6deea", "#ffffff"], False, False),
    22: ("cravate", ["#3a0828", "#8f1252", "#ff3ea5", "#ff9ad0"], False, False),
    23: ("écran", ["#ff3ea5"], True, False),
    24: ("écran-repos", ["#19c3b1"], True, False),
    25: ("plastique", ["#141a2c", "#2a3550", "#4a5a7c", "#7d8eb0", "#c3cfe4"], False, True),
    26: ("baskets", ["#6a7488", "#c9d1de", "#ffffff"], False, True),
    # Télégraphes / coups ennemis (magenta émissif) et effets
    27: ("smear-magenta", ["#ff3ea5"], True, False),
    28: ("smear-magenta-cœur", ["#ffd3ec"], True, False),
    29: ("écran-jaune", ["#ffd84a"], True, False),
    30: ("ticket", ["#5a5470", "#b7b0c4", "#efe8dc", "#fffdf4"], False, False),
    31: ("tôle-borne", ["#0b1620", "#123a44", "#1b6b6e", "#2fa79b", "#8ff2df"], False, True),
    32: ("étincelle", ["#fff1a0"], True, False),
    33: ("verre", ["#07080f", "#141b33", "#28396a", "#5677b8", "#a9c8ff"], False, False),
    34: ("rouge-barrière", ["#2a0812", "#6e1020", "#c2202e", "#ff4a4a", "#ff9a8a"], False, True),
    35: ("écran-rouge", ["#ff3b3b"], True, False),
    36: ("costume-foncé", ["#071219", "#0b2830", "#11474d", "#16867c", "#4fd6c3"], False, True),
    37: ("led-turquoise", ["#5ff7e4"], True, False),
    38: ("or", ["#3a1e0a", "#8a5012", "#d39a1e", "#ffd75a", "#fff2b0"], False, True),
    39: ("fiole", ["#6dffb0"], True, False),
    40: ("cheveux-blancs", ["#4e5266", "#9aa0b2", "#d9dde6", "#ffffff"], False, True),
    41: ("peau-foncée", ["#22100f", "#4a261f", "#764330", "#a46648", "#c98c66"], False, True),
    42: ("peau-mate", ["#3a1c20", "#6c382e", "#a5634a", "#cf8b65", "#ebb38a"], False, True),
    43: ("vert-prévention", ["#0a2214", "#145c2c", "#22a046", "#5fd46a", "#b8f59a"], False, True),
    44: ("bleu-régulation", ["#0c1640", "#1a3088", "#2f5bd0", "#5b8def", "#a9c8ff"], False, True),
    45: ("jaune-hv", ["#33300a", "#7f7a10", "#cfd31a", "#efff3c", "#fbffb0"], False, True),
    46: ("violet", ["#1e0c30", "#45186a", "#7a2eb0", "#a95ae0", "#d9a6ff"], False, True),
    47: ("marron", ["#1e0e08", "#4a2614", "#7e4824", "#b0723c", "#dca46a"], False, True),
    48: ("beige", ["#2c2018", "#5e4a36", "#98805c", "#c8b088", "#efe0be"], False, True),
    49: ("gris-manteau", ["#141820", "#2a3240", "#4a5668", "#76869a", "#b4c2d0"], False, True),
    50: ("caoutchouc", ["#0c0a10", "#1f1a24", "#37303e", "#57505e"], False, True),
    51: ("chaussettes", ["#2a2236", "#5a4c6e", "#8c7ca6"], False, False),
}


def ramp(mid: int) -> list[tuple[int, int, int]]:
    return [_hex(c) for c in MATERIALS[mid][1]]


def is_emissive(mid: int) -> bool:
    return MATERIALS[mid][2]


def has_rim(mid: int) -> bool:
    return MATERIALS[mid][3]


OUTLINE_RGB = _hex(OUTLINE)
RIM_RGB = _hex(RIM)
