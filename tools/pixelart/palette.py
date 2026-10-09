"""Palette maître « Privatix 32 » (art_director.md §9.1) et table de caractères.

Une lettre = une couleur de la palette. Les pièces dessinées à la main
(matrices de caractères) utilisent ces lettres ; '.' (ou ' ') = transparent.
L'indice 0 est réservé à la transparence, les indices 1..32 suivent la
numérotation du cahier des charges.
"""

# (numéro, hex, nom, lettre)
PRIVATIX32 = [
    (1, "#14101A", "contour-sombre", "K"),
    (2, "#2A3040", "acier-sombre", "d"),
    (3, "#4E5668", "acier", "s"),
    (4, "#7D828C", "beton-ombre", "g"),
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
]

CHAR = {letter: num for num, _hx, _n, letter in PRIVATIX32}
CHAR["."] = 0
CHAR[" "] = 0

IDX = {name: num for num, _hx, name, _l in PRIVATIX32}


def _rgb(hx):
    hx = hx.lstrip("#")
    return tuple(int(hx[i : i + 2], 16) for i in (0, 2, 4))


# indice -> (r, g, b, a)
RGBA = [(0, 0, 0, 0)] + [(*_rgb(hx), 255) for _n, hx, _na, _l in PRIVATIX32]

# Raccourcis lisibles dans le code
K = CHAR["K"]
TRANSPARENT = 0


def idx(letter):
    return CHAR[letter]


def write_gpl(path):
    """Écrit la palette au format GIMP/Aseprite (.gpl)."""
    lines = ["GIMP Palette", "Name: Privatix 32", "Columns: 8", "#"]
    for num, hx, name, _l in PRIVATIX32:
        r, g, b = _rgb(hx)
        lines.append(f"{r:3d} {g:3d} {b:3d}\t{num:02d} {name}")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
