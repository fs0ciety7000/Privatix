"""Rampes de couleurs à décalage de teinte (ombres froides → lumières chaudes), une par matière.

Chaque matière du modèle 3D porte un identifiant ; post.py remplace la lumière rendue par un ton
de sa rampe. C'est ce qui donne le rendu « Celeste » : peu de tons, très maîtrisés, saturés.
Contraste « Hades » : le ton le plus sombre est très profond (bleu nuit / violet presque noir, jamais
#000), il sert aussi d'encre aux lignes intérieures ; les lumières sont franches et saturées.
"""
from __future__ import annotations

OUTLINE = "#14101a"
RIM = "#6ff3ff"


def _hex(c: str) -> tuple[int, int, int]:
    c = c.lstrip("#")
    return int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)


# id → (nom, rampe du plus sombre au plus clair, émissif ?, liseré ?)
MATERIALS: dict[int, tuple[str, list[str], bool, bool]] = {
    1: ("peau", ["#1e0f22", "#6b2f3c", "#b85e4e", "#eb9a72", "#ffd0a6"], False, True),
    2: ("casque", ["#261222", "#8a4a12", "#e09a0c", "#ffd400", "#fff6b0"], False, True),
    3: ("gilet", ["#240c1e", "#8a2618", "#d9481a", "#ff7a1a", "#ffb04a"], False, True),
    4: ("bande", ["#3d4868", "#b9c9dc", "#f4f8ff", "#ffffff"], False, False),
    5: ("tenue", ["#090a1a", "#141c3c", "#223467", "#3a56a0", "#6c8fd6"], False, True),
    6: ("bottes", ["#08060c", "#1c1420", "#3a2c38", "#62505a"], False, True),
    7: ("acier", ["#0c0e1e", "#2a3352", "#5a6890", "#a2b2d0", "#f0f6ff"], False, True),
    8: ("écharpe", ["#1c0716", "#62102e", "#b81e3a", "#f2443f", "#ff9a80"], False, True),
    9: ("yeux", ["#14101a"], False, False),
    10: ("smear-cœur", ["#fffbe8"], True, False),
    11: ("smear-bord", ["#ffd08a"], True, False),
    12: ("cheveux", ["#0e0810", "#2e1a1c", "#5a3626", "#8a5a3a"], False, True),
    # Ennemis (Privatix : turquoise de lecture #19C3B1).
    20: ("costume", ["#061220", "#0b3044", "#11636a", "#19c3b1", "#8affe6"], False, True),
    21: ("chemise", ["#2c3452", "#8a98b5", "#dfe6f2", "#ffffff"], False, False),
    22: ("cravate", ["#240420", "#8a0f52", "#ff3ea5", "#ffa6d6"], False, False),
    23: ("écran", ["#ff3ea5"], True, False),
    24: ("écran-repos", ["#19c3b1"], True, False),
    25: ("plastique", ["#0b0f1e", "#222c48", "#45567c", "#7f92b8", "#cfdcf0"], False, True),
    26: ("baskets", ["#2e3048", "#8a94ac", "#dfe6f0", "#ffffff"], False, True),
    # Télégraphes / coups ennemis (magenta émissif) et effets
    27: ("smear-magenta", ["#ff3ea5"], True, False),
    28: ("smear-magenta-cœur", ["#ffd3ec"], True, False),
    29: ("écran-jaune", ["#ffd84a"], True, False),
    30: ("ticket", ["#3a3450", "#b7b0c4", "#efe8dc", "#fffdf4"], False, False),
    31: ("tôle-borne", ["#06121c", "#0e3440", "#17686c", "#29a898", "#93f5e0"], False, True),
    32: ("étincelle", ["#fff1a0"], True, False),
    33: ("verre", ["#05060e", "#121a34", "#26396e", "#5677c0", "#b0d0ff"], False, False),
    34: ("rouge-barrière", ["#1c0614", "#6a0e22", "#c81e30", "#ff4a4a", "#ffa292"], False, True),
    35: ("écran-rouge", ["#ff3b3b"], True, False),
    36: ("costume-foncé", ["#040b14", "#082430", "#0f4a50", "#168a7e", "#55dcc6"], False, True),
    37: ("led-turquoise", ["#5ff7e4"], True, False),
    38: ("or", ["#24100e", "#7a4210", "#d0961c", "#ffd65a", "#fff4b8"], False, True),
    39: ("fiole", ["#6dffb0"], True, False),
    40: ("cheveux-blancs", ["#2e3048", "#8a90a8", "#d4d9e4", "#ffffff"], False, True),
    41: ("peau-foncée", ["#1a0d18", "#55291f", "#8a5034", "#b8774f", "#dca274"], False, True),
    42: ("peau-mate", ["#1c0e1c", "#5e2e2c", "#a0604a", "#d48c64", "#f2bc90"], False, True),
    43: ("vert-prévention", ["#06141a", "#0f4c2a", "#1e9a44", "#5ad868", "#c0ff9e"], False, True),
    44: ("bleu-régulation", ["#080c2a", "#162a80", "#2c58d0", "#5c90f4", "#b0d0ff"], False, True),
    45: ("jaune-hv", ["#1e1c10", "#6e6a10", "#c8cc18", "#f0ff3c", "#fcffb8"], False, True),
    46: ("violet", ["#12081e", "#3e1462", "#7a2cb4", "#ac5ce6", "#e0b0ff"], False, True),
    47: ("marron", ["#140a0c", "#401e14", "#7c4424", "#b4743c", "#e6ae72"], False, True),
    48: ("beige", ["#1a1218", "#56402e", "#98805a", "#ceb488", "#f6e8c4"], False, True),
    49: ("gris-manteau", ["#0c0e18", "#262e40", "#4a5670", "#7a8ca4", "#bccbdc"], False, True),
    50: ("caoutchouc", ["#060509", "#1c1622", "#38303e", "#5a5262"], False, True),
    52: ("coque-laptop", ["#0a0c1a", "#1a2140", "#2e3a60", "#4c5c88", "#7a8cb8"], False, True),
    51: ("chaussettes", ["#1a1426", "#5a4c6e", "#8c7ca6"], False, False),
}


def ramp(mid: int) -> list[tuple[int, int, int]]:
    return [_hex(c) for c in MATERIALS[mid][1]]


def is_emissive(mid: int) -> bool:
    return MATERIALS[mid][2]


def has_rim(mid: int) -> bool:
    return MATERIALS[mid][3]


OUTLINE_RGB = _hex(OUTLINE)
RIM_RGB = _hex(RIM)
