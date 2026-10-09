"""Le Réorganisateur RH, « le Fluidifieur » (élite majeur du biome 2, LORE § 7.2). Il ne déteste
personne : il **fluidifie**. Gilet matelassé sans manches turquoise sur chemise bleu ciel, chino
beige, mocassins, lanyard violet couvert de badges, houppe châtain impeccable et sourire de
séminaire. Il glisse sur une **chaise de bureau à roulettes** portée par le vent (os `chair`) et
brandit le classeur « Roulements 2027 — PROVISOIRE v14 » (os `binder`, main droite).

Il est assis dans tous les clips (pose de liaison debout). La rotation sur soi (« Mutation
d'office ») passe par l'os `root`. Étiquette du classeur et écran du badge principal : matériau
« glow » à masque télégraphe. Budget visé ≈ 6 k triangles (élite).

Os : 18 du contrat + `chair`, `binder`, `lanyard`. Sockets humanoïdes + `socket_binder` (centre du
classeur : pages qui s'envolent).
"""
from __future__ import annotations

import math

from ..geo import Model
from ..humanoid import Dims, humanoid_skeleton
from ..poses import P, Clip, ease_back, ease_in, ease_out, keyed, linear, merge

VEST, VEST_DARK, SHIRT, CHINO, CHINO_DARK, LOAFER = 0x19C3B1, 0x0F8A80, 0xBFD8F2, 0xD8C49A, 0xB4A078, 0x6A3A24
SKIN, SKIN_DARK, HAIR, HAIR_LIGHT, EYES = 0xF0BC94, 0xD0946C, 0x8A5A32, 0xB07A48, 0x14101A
LANYARD, BINDER, BINDER_DARK, LABEL, CHAIR, CHAIR_DARK, STEEL = 0x7A3CFF, 0x6B3CE0, 0x4A28A0, 0xFFF4D6, 0x2A2638, 0x1A1824, 0xA2B2D0

DIMS = Dims(pelvis_y=0.6, spine=0.1, chest=0.16, neck=0.3, head=0.05, shoulder_w=0.28, shoulder_y=0.19, upper=0.23, fore=0.21, hip_w=0.11, hip_y=-0.02, thigh=0.31, shin=0.3, head_socket_y=0.4, back_z=-0.18, hip_socket_x=0.2)
SEAT_Y = 0.5


def model() -> Model:
    m = Model("fluidifieur")
    humanoid_skeleton(m, DIMS)
    m.joint("chair", "root", (0, 0, 0))
    m.joint("binder", "hand_R", (0, -0.06, 0))
    m.joint("lanyard", "neck", (0, -0.02, 0.1))
    m.socket("socket_binder", "binder", (0, 0.22, 0))
    m.meta = {"kind": "elite", "height": 1.75, "radius": 0.55, "outline": 0x06302C, "rim": 0xFFD84A}

    # ── Chaise de bureau : piètement étoile à 5 branches, roulettes, vérin, assise, dossier ──
    c = "chair"
    for k in range(5):
        a = 72 * k + 18
        r = math.radians(a)
        m.box(c, CHAIR_DARK, (0.17 * math.sin(r), 0.09, 0.17 * math.cos(r)), (0.06, 0.05, 0.36), 0.0, rot=(0, a, 0))
        m.sphere(c, CHAIR, (0.34 * math.sin(r), 0.045, 0.34 * math.cos(r)), (0.05, 0.045, 0.05), seg=8)
    m.cyl(c, STEEL, (0, 0.27, 0), 0.04, 0.34, seg=10)
    m.cyl(c, CHAIR_DARK, (0, 0.17, 0), 0.06, 0.14, seg=10, outline=0.5)
    m.box(c, CHAIR, (0, SEAT_Y - 0.03, 0.02), (0.52, 0.09, 0.5), 0.04, seg=1)
    m.box(c, CHAIR_DARK, (0, SEAT_Y + 0.1, -0.29), (0.06, 0.2, 0.05), 0.0)
    m.box(c, CHAIR, (0, SEAT_Y + 0.42, -0.3), (0.48, 0.5, 0.08), 0.05, seg=1)
    m.box(c, 0x7A3CFF, (0, SEAT_Y + 0.56, -0.255), (0.3, 0.05, 0.01), 0.0, outline=0)  # liseré violet Privatix
    for sx in (1, -1):
        m.box(c, CHAIR_DARK, (0.25 * sx, SEAT_Y + 0.12, 0.0), (0.04, 0.16, 0.04), 0.0)
        m.box(c, CHAIR, (0.25 * sx, SEAT_Y + 0.21, 0.04), (0.07, 0.04, 0.3), 0.0)
    # ── Jambes : chino à revers, mocassins ──────────────────────────────────────────────────
    for s in ("L", "R"):
        m.capsule(f"hip_{s}", CHINO, (0, 0, 0), (0, -0.3, 0), 0.1, 0.09)
        m.capsule(f"knee_{s}", CHINO, (0, 0, 0), (0, -0.25, 0), 0.085, 0.075)
        m.cyl(f"knee_{s}", CHINO_DARK, (0, -0.25, 0), 0.08, 0.04, seg=10, outline=0)  # revers
        m.box(f"foot_{s}", LOAFER, (0, 0.025, 0.05), (0.13, 0.08, 0.28), 0.04, seg=1)
        m.box(f"foot_{s}", 0x3A2014, (0, 0.06, 0.12), (0.1, 0.012, 0.03), 0.0, outline=0)  # barrette
    m.box("pelvis", CHINO, (0, 0, 0), (0.36, 0.17, 0.25), 0.07, seg=1)
    m.box("pelvis", 0x3A2014, (0, 0.07, 0), (0.37, 0.04, 0.26), 0.0, outline=0)  # ceinture
    # ── Torse : chemise + gilet matelassé sans manches (piqûres horizontales) ─────────────
    m.box("spine", SHIRT, (0, 0.03, 0), (0.34, 0.18, 0.23), 0.07, seg=1)
    m.box("spine", VEST, (0, 0.04, 0), (0.38, 0.2, 0.27), 0.08, seg=1)
    m.box("chest", VEST, (0, 0.09, 0), (0.48, 0.36, 0.3), 0.11)
    for k in range(4):  # piqûres du matelassage
        y = -0.1 + k * 0.1
        part, yy = ("chest", y) if y > -0.05 else ("spine", y + DIMS.chest)
        m.box(part, VEST_DARK, (0.13, yy, 0.152 if part == "chest" else 0.138), (0.17, 0.012, 0.006), 0.0, outline=0)
        m.box(part, VEST_DARK, (-0.13, yy, 0.152 if part == "chest" else 0.138), (0.17, 0.012, 0.006), 0.0, outline=0)
    m.box("chest", 0xD8DCE6, (0, 0.06, 0.155), (0.016, 0.36, 0.008), 0.0, outline=0)  # fermeture éclair
    m.box("chest", SHIRT, (0, 0.27, 0.02), (0.26, 0.07, 0.2), 0.0)  # col de chemise ouvert
    m.box("chest", SKIN, (0, 0.24, 0.12), (0.08, 0.08, 0.02), 0.0, outline=0)
    # Logo du gilet (cabinet) : petit losange violet
    m.box("chest", LANYARD, (0.15, 0.2, 0.152), (0.04, 0.04, 0.006), 0.0, rot=(0, 0, 45), outline=0)
    # ── Lanyard couvert de badges ───────────────────────────────────────────────────────────
    for sx in (1, -1):
        m.box("lanyard", LANYARD, (0.055 * sx, -0.1, 0.03), (0.025, 0.24, 0.01), 0.0, rot=(0, 0, -12 * sx), outline=0)
    m.box("lanyard", 0xF2F4FA, (0, -0.27, 0.05), (0.1, 0.13, 0.012), 0.0)
    m.box("lanyard", 0x5FF7E4, (0, -0.25, 0.058), (0.07, 0.05, 0.004), 0.0, mat="glow", outline=0, emit=1.0)  # badge principal
    for k, (x, y, rz, col) in enumerate(((-0.08, -0.22, 20, 0xFFD84A), (0.09, -0.24, -16, 0xFF7AC8), (-0.05, -0.33, -8, 0x3FD46B), (0.07, -0.34, 12, 0xF2F4FA), (0.0, -0.37, 4, 0xFF6A12))):
        m.box("lanyard", col, (x, y, 0.045 - 0.004 * k), (0.07, 0.09, 0.01), 0.0, rot=(0, 0, rz))
    # ── Bras en chemise (manches retroussées) ──────────────────────────────────────────────
    for s, sx in (("L", 1), ("R", -1)):
        m.sphere(f"shoulder_{s}", VEST, (0.0, -0.01, 0), (0.1, 0.09, 0.11), seg=12)
        m.capsule(f"shoulder_{s}", SHIRT, (0, -0.02, 0), (0, -0.23, 0), 0.07, 0.065)
        m.cyl(f"elbow_{s}", SHIRT, (0, -0.01, 0), 0.07, 0.06, seg=10)  # manche retroussée
        m.capsule(f"elbow_{s}", SKIN, (0, -0.03, 0), (0, -0.18, 0), 0.052, 0.048)
        m.sphere(f"hand_{s}", SKIN, (0, -0.035, 0), (0.07, 0.075, 0.068), seg=12)
        m.capsule(f"hand_{s}", SKIN, (0.03 * sx, -0.02, 0.035), (0.05 * sx, -0.06, 0.06), 0.02)
    m.box("elbow_L", 0x14101A, (0, -0.12, 0.0), (0.11, 0.035, 0.11), 0.0, outline=0)  # montre connectée
    m.box("elbow_L", 0x5FF7E4, (0.0, -0.12, 0.056), (0.04, 0.025, 0.004), 0.0, mat="glow", outline=0)
    # ── Tête : houppe, sourire de séminaire ─────────────────────────────────────────────────
    m.cyl("neck", SKIN, (0, 0, 0), 0.07, 0.1, seg=10)
    m.sphere("head", SKIN, (0, 0.16, 0.01), (0.24, 0.25, 0.23), seg=18)
    m.sphere("head", SKIN, (0, 0.07, 0.07), (0.17, 0.11, 0.15), seg=12, outline=0)  # menton
    m.sphere("head", SKIN_DARK, (0, 0.14, 0.24), (0.04, 0.045, 0.04), seg=8, outline=0.6)
    for sx in (1, -1):
        m.sphere("head", SKIN, (0.235 * sx, 0.15, 0.0), (0.045, 0.06, 0.04), seg=8)
        m.sphere("head", EYES, (0.085 * sx, 0.19, 0.215), (0.026, 0.034, 0.018), outline=0, seg=8)
        m.sphere("head", 0xFFFFFF, (0.085 * sx + 0.009, 0.2, 0.229), (0.008, 0.009, 0.004), outline=0, seg=6, emit=0.3)
        m.box("head", HAIR, (0.09 * sx, 0.255, 0.215), (0.09, 0.022, 0.03), 0.0, rot=(0, 0, -16 * sx), outline=0)  # sourcils levés
    smile = [(math.cos(a) * 0.075, -math.sin(a) * 0.04) for a in [math.pi * i / 10 for i in range(11)]]
    m.shape("head", 0x7A2A3A, (0, 0.085, 0.215), smile, 0.015, rot=(-10, 0, 0), outline=0)
    m.box("head", 0xFFFDF6, (0, 0.078, 0.224), (0.12, 0.016, 0.008), 0.0, rot=(-10, 0, 0), outline=0)
    m.sphere("head", HAIR, (0, 0.22, -0.05), (0.24, 0.19, 0.2), seg=16)
    m.sphere("head", HAIR, (0.02, 0.33, 0.07), (0.17, 0.09, 0.15), seg=12, rot=(-24, 0, -6))  # houppe
    m.sphere("head", HAIR_LIGHT, (0.04, 0.39, 0.12), (0.09, 0.04, 0.08), seg=10, rot=(-30, 0, -6), outline=0)
    # ── Classeur « Roulements 2027 — PROVISOIRE v14 » (prise par le dos, en bas) ─────────
    b = "binder"
    m.box(b, BINDER, (0, 0.22, 0), (0.08, 0.44, 0.36), 0.02, seg=1)  # dos + plats (vu de profil : épaisseur X)
    m.box(b, 0xF6F2E6, (0.0, 0.22, 0.0), (0.07, 0.42, 0.345), 0.0)  # pages
    m.box(b, BINDER_DARK, (0.045, 0.22, 0), (0.012, 0.44, 0.36), 0.0, outline=0)
    m.box(b, BINDER_DARK, (-0.045, 0.22, 0), (0.012, 0.44, 0.36), 0.0, outline=0)
    for sx in (1, -1):
        m.box(b, LABEL, (0.053 * sx, 0.3, 0.0), (0.006, 0.12, 0.24), 0.0, mat="glow", outline=0, emit=1.0)  # étiquette
        m.box(b, 0xE0283C, (0.057 * sx, 0.3, 0.0), (0.004, 0.025, 0.2), 0.0, outline=0)  # « PROVISOIRE »
    for k in range(3):  # pages volantes qui dépassent
        m.box(b, 0xF6F2E6, (0.0, 0.3 + 0.05 * k, 0.17 + 0.02 * k), (0.004, 0.08, 0.1), 0.0, rot=(20 * k - 10, 0, 0), outline=0)
    return m


# ─── Poses ────────────────────────────────────────────────────────────────────

SIT = {"hip_L": (-86, 0, 8), "hip_R": (-86, 0, -8), "knee_L": (80, 0, 0), "knee_R": (92, 0, 0), "foot_L": (6, 0, 0), "foot_R": (-6, 0, 0)}


def seated(t: float = 0.0) -> dict:
    """Assis, il lit le classeur levé de la main droite, l'autre main sur l'accoudoir."""
    w = 2 * math.pi / 2.4
    b = math.sin(t * w)
    return P(
        {
            **SIT,
            "spine": (-6 + b, 0, 0), "chest": (-8, 6 * b, 0), "neck": (0, 0, 0), "head": (-6, 16 + 4 * b, 4),
            "shoulder_R": (-110, 0, -14), "elbow_R": (-40 + 6 * b, 0, 0), "hand_R": (-10, 0, 0), "binder": (24, -84, 0),
            "shoulder_L": (-20, 0, 22), "elbow_L": (-60, 0, 0), "hand_L": (0, 0, 0),
            "lanyard": (-6 + 6 * b, 0, 4 * b), "chair": (0, 0, 0),
        },
        root=(0, 0.01 * b, 0),
    )


def glide(t: float) -> dict:
    """Déplacement : le vent pousse la chaise, il se cale en arrière, jambes levées, ravi."""
    w = 2 * math.pi / 0.8
    b = math.sin(t * w)
    p = seated(0)
    return merge(
        p,
        rot={
            "spine": (-16, 0, 4 * b), "chest": (-10, 0, 0), "head": (6, 0, -4 * b),
            "hip_L": (-110, 0, 12), "hip_R": (-104, 0, -12), "knee_L": (50, 0, 0), "knee_R": (64, 0, 0),
            "shoulder_L": (-150, 0, 30), "elbow_L": (-20, 0, 0), "lanyard": (30 + 8 * b, 0, 6 * b),
            "chair": (0, 6 * b, 0),
        },
        root=(0, 0.02 + 0.01 * b, 0),
    )


RAISE = P({**SIT, "spine": (-14, 0, 0), "chest": (-10, 0, 0), "head": (-12, 0, 0), "shoulder_R": (-170, 0, 10), "elbow_R": (-30, 0, 0), "binder": (0, -90, 0),
           "shoulder_L": (-160, 0, -10), "elbow_L": (-40, 0, 0), "lanyard": (20, 0, 0), "hip_L": (-96, 0, 8), "hip_R": (-96, 0, -8)}, root=(0, 0.04, -0.04), scale=(0.96, 1.05, 0.96))
SLAM = P({**SIT, "spine": (34, 0, 0), "chest": (18, 0, 0), "head": (-16, 0, 0), "shoulder_R": (-70, 0, 6), "elbow_R": (-10, 0, 0), "binder": (-60, -90, 0),
          "shoulder_L": (-60, 0, -6), "elbow_L": (-10, 0, 0), "lanyard": (-40, 0, 0), "hip_L": (-70, 0, 10), "hip_R": (-70, 0, -10), "knee_L": (60, 0, 0), "knee_R": (60, 0, 0), "chair": (-8, 0, 0)},
         root=(0, -0.04, 0.16), scale=(1.06, 0.92, 1.06))
SPIN = P({**SIT, "spine": (-4, 0, -10), "chest": (0, 0, -6), "head": (0, 0, 10), "shoulder_R": (-90, 0, -80), "elbow_R": (-6, 0, 0), "binder": (90, 0, 0),
          "shoulder_L": (-30, 0, 70), "elbow_L": (-10, 0, 0), "lanyard": (40, 0, -30), "hip_L": (-100, 0, 20), "hip_R": (-100, 0, -20), "knee_L": (50, 0, 0), "knee_R": (50, 0, 0)}, root=(0, 0.03, 0))
HURT = P({**SIT, "spine": (-24, 0, 8), "chest": (-12, 0, 0), "head": (-20, 0, -10), "shoulder_R": (-60, 0, -60), "elbow_R": (-40, 0, 0), "binder": (20, -30, 0),
          "shoulder_L": (-40, 0, 60), "elbow_L": (-40, 0, 0), "lanyard": (40, 0, 10), "chair": (6, 0, 0), "hip_L": (-110, 0, 14), "hip_R": (-104, 0, -14)}, root=(0, 0.02, -0.12))


def attack_binder(t: float) -> dict:
    return keyed([(0, seated(0)), (450, RAISE, ease_out), (700, RAISE), (800, SLAM, ease_in), (1000, SLAM), (1500, seated(0))], t)


def attack_spin(t: float) -> dict:
    spin = lambda a: merge(SPIN, rot={"root": (0, a, 0)})  # noqa: E731
    return keyed([(0, seated(0)), (350, spin(30), ease_out), (500, spin(-60), linear), (650, spin(-180), linear), (800, spin(-300), linear), (900, spin(-360), ease_out), (1200, seated(0))], t)


def defeat(t: float) -> dict:
    """Il descend de sa chaise, se relève, classeur sous le bras (la chaise roule seule, cf. jeu)."""
    stand = P({"spine": (-2, 0, 0), "head": (6, -14, 0), "shoulder_R": (6, 0, -10), "elbow_R": (-100, 0, 0), "binder": (100, 0, 90), "shoulder_L": (2, 0, 8), "elbow_L": (-10, 0, 0), "lanyard": (-4, 0, 0),
               "hip_L": (-4, 0, 4), "hip_R": (4, 0, -4), "knee_L": (6, 0, 0), "knee_R": (6, 0, 0), "chair": (0, 50, 0)}, root=(0, 0.04, 0.4), loc={"chair": (-0.75, 0, -0.75)})
    sigh = merge(stand, rot={"head": (18, -20, 0), "spine": (6, 0, 0)}, scale=(1.0, 0.98, 1.0))
    return keyed([(0, HURT), (400, merge(seated(0), rot={"head": (14, 0, 0)}), ease_out), (900, merge(seated(0), rot={"spine": (20, 0, 0)}, root=(0, 0, 0.1))), (1300, stand, ease_out), (1700, sigh), (2200, sigh)], t)


def spawn(t: float) -> dict:
    tiny = merge(glide(0), scale=(0.01, 0.01, 0.01))
    big = merge(glide(0), scale=(1.12, 1.12, 1.12))
    return keyed([(0, tiny), (300, big, ease_out), (450, seated(0), ease_back)], t)


def clips() -> list[Clip]:
    return [
        Clip("idle", 2.4, lambda t: seated(t / 1000), loop=True),
        Clip("glide", 0.8, lambda t: glide(t / 1000), loop=True),
        Clip("attack-binder", 1.5, attack_binder, events={"windup": 0, "active": 800, "recovery": 1000}),
        Clip("attack-spin", 1.2, attack_spin, events={"windup": 0, "active": 500, "recovery": 900}),
        Clip("hurt", 0.32, lambda t: keyed([(0, seated(0)), (80, HURT, ease_out), (320, seated(0))], t)),
        Clip("defeat", 2.2, defeat),
        Clip("spawn", 0.45, spawn),
    ]
