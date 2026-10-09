"""Palette maître « Privatix Moderne 57 » et table de caractères.

Direction artistique « pixel art moderne » (références : Dead Cells, Celeste) :
les 32 couleurs historiques (indices 1..32, lettres inchangées, couleurs de
lecture du canon intactes : contour #14101A, gilet #FF7A1A, turquoise
#19C3B1, magenta #FF3EA5) sont complétées par 25 tons (indices 33..57) qui
transforment chaque matériau en **rampe à décalage de teinte** de 4 à 8 tons :
les ombres tirent vers le bleu / violet froid, les lumières vers le jaune /
orange chaud.

Une lettre = une couleur de la palette. Les pièces dessinées à la main
(matrices de caractères) utilisent ces lettres ; '.' (ou ' ') = transparent.
L'indice 0 est réservé à la transparence.

`RAMPS` décrit les rampes (sombre -> clair) ; `DARK` / `LIGHT` donnent, pour
chaque indice, le ton voisin plus sombre / plus clair de son matériau (utilisés
par l'éclairage, le sel-out, l'occlusion et l'anti-aliasing interne de
`modern.py`).
"""

# (numéro, hex, nom, lettre)
PRIVATIX = [
    # ---------------------------------------------- 32 couleurs historiques
    (1, "#14101A", "contour-sombre", "K"),
    (2, "#2A3040", "acier-sombre", "d"),
    (3, "#4E5668", "acier", "s"),
    (4, "#737E98", "acier-clair", "g"),
    (5, "#9FB0C6", "gris-ballast", "b"),
    (6, "#F4F6F8", "blanc-affiche", "w"),
    (7, "#FFFFFF", "blanc-pur", "W"),
    (8, "#0B1F3A", "bleu-nuit-quai", "n"),
    (9, "#123C73", "bleu-institution", "i"),
    (10, "#1F5AA6", "bleu-signal", "I"),
    (11, "#5FA8E8", "bleu-ciel-catenaire", "c"),
    (12, "#9CC7D9", "verre-verriere", "v"),
    (13, "#2B1A12", "espresso", "e"),
    (14, "#4A2E1F", "cafe-torrefie", "h"),
    (15, "#7A4E33", "moka", "m"),
    (16, "#A8734A", "noisette", "z"),
    (17, "#E3A982", "peau-claire", "p"),
    (18, "#F2E6CF", "creme", "q"),
    (19, "#F2A541", "ambre-lampe", "a"),
    (20, "#8A3B2E", "brique-montoise", "r"),
    (21, "#B8470F", "gilet-ombre", "o"),
    (22, "#FF7A1A", "gilet-orange", "O"),
    (23, "#FFD200", "jaune-quai", "y"),
    (24, "#0A4F4C", "turquoise-profond", "u"),
    (25, "#19C3B1", "turquoise-disruption", "T"),
    (26, "#8FF5E4", "turquoise-neon", "N"),
    (27, "#8E1F28", "rouge-sombre", "R"),
    (28, "#C8323C", "rouge-rebelle", "x"),
    (29, "#FF3EA5", "magenta-menace", "M"),
    (30, "#B48CFF", "violet-burnout", "V"),
    (31, "#1E5B3A", "vert-signal-sombre", "G"),
    (32, "#5BD17A", "vert-soin", "L"),
    # ---------------------------------------------- 25 tons des rampes modernes
    (33, "#1C1A2E", "abysse-violet", "D"),
    (34, "#D3DEEA", "acier-reflet", "7"),
    (35, "#6E1F33", "gilet-creux", "F"),
    (36, "#FFA244", "gilet-lumiere", "f"),
    (37, "#FFD98C", "gilet-eclat", "j"),
    (38, "#FBD3A6", "peau-eclat", "E"),
    (39, "#9C4A1C", "ambre-creux", "U"),
    (40, "#FFF3A8", "jaune-eclat", "Z"),
    (41, "#10877F", "turquoise-moyen", "t"),
    (42, "#DFFFF8", "turquoise-eclat", "X"),
    (43, "#5E1242", "magenta-creux", "H"),
    (44, "#B81E7E", "magenta-moyen", "J"),
    (45, "#FF99D2", "magenta-eclat", "k"),
    (46, "#4A1427", "rouge-creux", "C"),
    (47, "#F2675E", "rouge-eclat", "l"),
    (48, "#2F9A5C", "vert-moyen", "0"),
    (49, "#4A3388", "violet-creux", "9"),
    (50, "#4A1D22", "brique-creux", "B"),
    (51, "#B65A3A", "brique-lumiere", "S"),
    (52, "#131C33", "quai-creux", "1"),
    (53, "#222F4D", "quai-ombre", "2"),
    (54, "#33446A", "quai-base", "3"),
    (55, "#475C87", "quai-lumiere", "4"),
    (56, "#6B84B0", "quai-reflet", "5"),
    (57, "#6FD6FF", "neon-rim", "6"),
]
# compatibilité : ancien nom
PRIVATIX32 = PRIVATIX

CHAR = {letter: num for num, _hx, _n, letter in PRIVATIX}
CHAR["."] = 0
CHAR[" "] = 0

IDX = {name: num for num, _hx, name, _l in PRIVATIX}


def _rgb(hx):
    hx = hx.lstrip("#")
    return tuple(int(hx[i : i + 2], 16) for i in (0, 2, 4))


# indice -> (r, g, b, a)
RGBA = [(0, 0, 0, 0)] + [(*_rgb(hx), 255) for _n, hx, _na, _l in PRIVATIX]
N_COLORS = len(PRIVATIX)

# Raccourcis lisibles dans le code
K = CHAR["K"]
TRANSPARENT = 0
RIM = CHAR["6"]

# --------------------------------------------------------------------------
# Rampes de matériaux (sombre -> clair), décalage de teinte
# --------------------------------------------------------------------------
RAMPS = {
    "acier": "Ddsgb7wW",
    "bleu": "niIcv",
    "quai": "12345",
    "chaud": "ehmzpE",  # bois, café, peau
    "gilet": "FoOfj",
    "ambre": "UayZ",
    "turquoise": "utTNX",
    "magenta": "HJMk",
    "rouge": "CRxl",
    "vert": "G0L",
    "violet": "9V",
    "brique": "BrS",
}
RAMPS = {k: [CHAR[ch] for ch in v] for k, v in RAMPS.items()}

RAMP_OF = {}
LEVEL = {}
for _name, _r in RAMPS.items():
    for _i, _ix in enumerate(_r):
        RAMP_OF[_ix] = _name
        LEVEL[_ix] = _i

DARK = list(range(N_COLORS + 1))
LIGHT = list(range(N_COLORS + 1))
for _r in RAMPS.values():
    for _i, _ix in enumerate(_r):
        DARK[_ix] = _r[max(0, _i - 1)]
        LIGHT[_ix] = _r[min(len(_r) - 1, _i + 1)]
# raccords entre rampes (décalage de teinte : ombres froides, lumières chaudes)
for _src, _dk, _lt in (
    ("q", "b", "W"),  # papier / crème : ombre bleutée
    ("n", "D", "i"),
    ("v", "c", "7"),
    ("E", "p", "q"),
    ("j", "f", "Z"),
    ("Z", "y", "W"),
    ("X", "N", "W"),
    ("k", "M", "W"),
    ("l", "x", "j"),
    ("L", "0", "Z"),
    ("V", "9", "w"),
    ("S", "r", "z"),
    ("B", "e", "r"),
    ("5", "4", "v"),
    ("1", "D", "2"),
    ("e", "D", "h"),
):
    DARK[CHAR[_src]] = CHAR[_dk]
    LIGHT[CHAR[_src]] = CHAR[_lt]
DARK[K] = K
LIGHT[K] = K
DARK[0] = LIGHT[0] = 0
DARK[RIM] = CHAR["c"]
LIGHT[RIM] = CHAR["X"]

# Couleurs émissives (écrans, LED, néons, télégraphes, flash) : jamais
# assombries par l'éclairage, conservées par le rim light.
EMISSIVE = {CHAR[ch] for ch in "WNTXMkyZ6"}


def idx(letter):
    return CHAR[letter]


def write_gpl(path):
    """Écrit la palette au format GIMP/Aseprite (.gpl)."""
    lines = ["GIMP Palette", "Name: Privatix Moderne 57", "Columns: 8", "#",
             "# 01-32 : couleurs historiques (canon de lecture) ; 33-57 : tons des rampes modernes", "#"]
    for num, hx, name, _l in PRIVATIX:
        r, g, b = _rgb(hx)
        lines.append(f"{r:3d} {g:3d} {b:3d}\t{num:02d} {name}")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
