"""Le Furet putride (ennemi de harcèlement), fiche art_director §7.2.

Furet géant (≈ 2,6 m de long, 0,9 m au garrot), corps en saucisse souple, masque sombre, queue en
plumeau (40 % de la longueur), touffes ébouriffées sur le dos, harnais turquoise à plaque Privatix.
Silhouette en ombre : un S allongé et bas terminé par un plumeau.

Exception documentée au « rigide par os » : le corps et le cou sont des tubes à poids répartis entre
vertèbres voisines (ondulation lisse). Tout le reste (tête, pattes, queue, touffes) est rigide.
Os (31) : root, spine0..6 (7 vertèbres, des hanches vers les épaules), neck0..1, head, jaw, ear_L/R,
tail0..4, et pour chaque patte (FL, FR, BL, BR) : <patte>0 (épaule/hanche), <patte>1, paw_<patte>.
"""
from __future__ import annotations

import math

import numpy as np

from ..geo import Model
from ..poses import P, Clip, ease_back, ease_in, ease_out, keyed, lerp_pose, merge

FUR, FUR_DARK, MASK, HARNESS, PLATE = 0xC9B48A, 0xA8925E, 0x3B3128, 0x19C3B1, 0x6B3FA0
STAIN, NOSE, EYE, BELLY = 0xD8C25A, 0x9A5A55, 0xC8F04A, 0xE6D6AE
SPINE_Y = 0.56
SPINE_Z0 = -0.62
SEG = 0.19
LEGS = {"FL": (1, 5), "FR": (-1, 5), "BL": (1, 0), "BR": (-1, 0)}  # côté, vertèbre porteuse
BITE_WINDUP, BITE_ACTIVE, SPRAY_WINDUP = 450, 140, 550


def model() -> Model:
    m = Model("furet")
    m.joint("root", None, (0, 0, 0))
    m.joint("spine0", "root", (0, SPINE_Y, SPINE_Z0))
    for i in range(1, 7):
        m.joint(f"spine{i}", f"spine{i - 1}", (0, 0.0, SEG))
    m.joint("neck0", "spine6", (0, 0.06, 0.2))
    m.joint("neck1", "neck0", (0, 0.07, 0.16))
    m.joint("head", "neck1", (0, 0.05, 0.14))
    m.joint("jaw", "head", (0, -0.06, 0.06))
    for s, sx in (("L", 1), ("R", -1)):
        m.joint(f"ear_{s}", "head", (0.12 * sx, 0.12, -0.04))
    m.joint("tail0", "spine0", (0, 0.02, -0.18))
    for i in range(1, 5):
        m.joint(f"tail{i}", f"tail{i - 1}", (0, 0.0, -0.21))
    for leg, (sx, sp) in LEGS.items():
        m.joint(f"{leg}0", f"spine{sp}", (0.15 * sx, -0.12, 0.0))
        m.joint(f"{leg}1", f"{leg}0", (0, -0.22, 0.02 if leg[0] == "F" else -0.03))
        m.joint(f"paw_{leg}", f"{leg}1", (0, -0.19, 0.0))
    m.socket("socket_vfx", "spine3", (0, 0.25, 0))
    m.socket("socket_head", "head", (0, 0.1, 0.05))
    m.socket("socket_tail", "tail4", (0, 0.05, -0.15))
    m.socket("socket_back", "spine3", (0, 0.24, 0))
    m.meta = {"kind": "enemy", "height": 0.9, "radius": 0.5, "outline": 0x06302C, "rim": 0x6FF3FF}

    # Corps : tube souple le long des vertèbres (poids répartis)
    W = [m.world(f"spine{i}") for i in range(7)]
    pts = [W[0] + np.array([0, 0.0, -0.18])] + W + [W[6] + np.array([0, 0.03, 0.14])]
    radii = [0.17, 0.23, 0.245, 0.24, 0.225, 0.22, 0.235, 0.245, 0.19]
    n = len(pts) - 1
    bones = [(f"spine{i}", (i + 1) / n) for i in range(7)]
    m.tube("root", FUR, pts, radii, seg=14, bones=bones)
    # ventre plus clair (bande inférieure légèrement rentrée)
    bp = [p + np.array([0, -0.07, 0]) for p in pts[1:-1]]
    m.tube("root", BELLY, bp, [r * 0.8 for r in radii[1:-1]], seg=12, bones=[(f"spine{i}", i / 6) for i in range(7)], outline=0)
    # Cou
    N = [m.world("spine6"), m.world("neck0"), m.world("neck1"), m.world("head")]
    m.tube("root", FUR, N, [0.2, 0.17, 0.15, 0.14], seg=12, bones=[("spine6", 0.0), ("neck0", 0.35), ("neck1", 0.7), ("head", 1.0)])
    # Tête en coin : crâne, museau clair, masque sombre autour des yeux
    m.sphere("head", FUR, (0, 0.03, 0.0), (0.17, 0.14, 0.17), seg=16)
    m.sphere("head", BELLY, (0, -0.01, 0.15), (0.1, 0.085, 0.13), seg=14)
    m.sphere("head", NOSE, (0, 0.01, 0.27), (0.04, 0.032, 0.03), seg=10, outline=0.6)
    for sx in (1, -1):
        m.sphere("head", MASK, (0.08 * sx, 0.06, 0.09), (0.085, 0.05, 0.075), rot=(0, 18 * sx, -14 * sx), seg=12, outline=0)
        m.sphere("head", EYE, (0.085 * sx, 0.075, 0.135), (0.028, 0.024, 0.02), mat="glow", outline=0, seg=8)
        m.sphere("head", 0x14101A, (0.09 * sx, 0.076, 0.15), (0.012, 0.016, 0.008), outline=0, seg=6)
        m.box("head", MASK, (0.07 * sx, 0.115, 0.1), (0.07, 0.02, 0.03), 0.008, rot=(0, 0, 20 * sx), outline=0)  # sourcil grincheux
        m.sphere("head", BELLY, (0.04 * sx, -0.045, 0.2), (0.04, 0.03, 0.04), outline=0, seg=8)  # babines
    m.box("jaw", BELLY, (0, -0.02, 0.1), (0.12, 0.04, 0.14), 0.018)
    for sx in (1, -1):
        m.cone("jaw", 0xFFF6E8, (0.035 * sx, 0.02, 0.15), 0.012, 0.035, seg=5, outline=0)
        m.cone("head", 0xFFF6E8, (0.035 * sx, -0.07, 0.22), 0.012, 0.035, rot=(180, 0, 0), seg=5, outline=0)
    for s, sx in (("L", 1), ("R", -1)):
        m.sphere(f"ear_{s}", FUR, (0, 0.02, 0), (0.06, 0.065, 0.03), seg=10)
        m.sphere(f"ear_{s}", MASK, (0, 0.015, 0.012), (0.035, 0.04, 0.02), seg=8, outline=0)
    # Pattes courtes et sombres, griffes
    for leg in LEGS:
        m.capsule(f"{leg}0", MASK, (0, 0.04, 0), (0, -0.22, 0), 0.075, 0.06)
        m.capsule(f"{leg}1", MASK, (0, 0, 0), (0, -0.18, 0), 0.055, 0.05)
        m.box(f"paw_{leg}", MASK, (0, -0.01, 0.04), (0.11, 0.06, 0.15), 0.03)
        for dx in (-0.03, 0, 0.03):
            m.cone(f"paw_{leg}", 0xE8E0D0, (dx, -0.02, 0.125), 0.012, 0.04, rot=(90, 0, 0), seg=5, outline=0)
    # Queue en plumeau : chapelet de sphères écrasées + touffes
    tr = [0.13, 0.18, 0.21, 0.2, 0.15]
    for i in range(5):
        m.sphere(f"tail{i}", FUR if i % 2 == 0 else FUR_DARK, (0, 0, -0.1), (tr[i], tr[i] * 0.95, 0.16), seg=14)
        for k in range(5):
            a = 2 * math.pi * k / 5 + i * 0.7
            m.cone(f"tail{i}", FUR_DARK if i % 2 == 0 else FUR, (math.cos(a) * tr[i] * 0.85, math.sin(a) * tr[i] * 0.85, -0.12), 0.05, 0.13, rot=(-90 + math.degrees(math.sin(a)) * 0.6, 0, -math.degrees(a) + 90), seg=5, outline=0.7)
    m.cone("tail4", FUR_DARK, (0, 0.0, -0.27), 0.09, 0.2, rot=(-90, 0, 0), seg=7)
    # Touffes ébouriffées sur le dos (lisibles en ombre) + taches jaunâtres
    for i in range(1, 7):
        for k, dx in enumerate((-0.06, 0.06) if i % 2 else (0.0,)):
            m.cone(f"spine{i}", FUR_DARK, (dx, 0.22, -0.02), 0.055, 0.16, rot=(-40 - 10 * k, 0, dx * 200), seg=5, outline=0.8)
    m.sphere("spine2", STAIN, (0.17, 0.12, 0.0), (0.09, 0.07, 0.11), outline=0, seg=10)
    m.sphere("spine4", STAIN, (-0.15, 0.15, 0.05), (0.08, 0.06, 0.1), outline=0, seg=10)
    # Harnais turquoise et plaque Privatix (marque « ennemi »)
    m.torus("spine5", HARNESS, (0, 0.0, -0.02), 0.24, 0.025, radial=6, tubular=24)
    m.torus("spine2", HARNESS, (0, 0.0, 0.0), 0.245, 0.025, radial=6, tubular=24)
    m.box("spine3", HARNESS, (0, 0.235, 0.0), (0.05, 0.02, 0.62), 0.008)
    m.box("spine3", PLATE, (0, 0.25, 0.0), (0.16, 0.025, 0.12), 0.01)
    m.sphere("spine3", 0x6FF3FF, (0, 0.265, 0.03), (0.022, 0.012, 0.022), mat="glow", outline=0, seg=8)
    return m


# ─── Poses ────────────────────────────────────────────────────────────────────

LEG_REST = {"FL0": (6, 0, 4), "FR0": (6, 0, -4), "BL0": (-8, 0, 4), "BR0": (-8, 0, -4), "FL1": (-10, 0, 0), "FR1": (-10, 0, 0), "BL1": (16, 0, 0), "BR1": (16, 0, 0), "paw_BL": (-8, 0, 0), "paw_BR": (-8, 0, 0)}


def body_wave(rot: dict, ph: float, lat: float, arch: float = 0.0, arch_ph: float = 0.0) -> dict:
    """Ondulation en S (lacet) et cambrure (tangage) le long des vertèbres."""
    for i in range(7):
        y = lat * math.sin(ph - i * 0.9)
        x = arch * math.sin(arch_ph + i * 0.5)
        r = rot.get(f"spine{i}", (0, 0, 0))
        rot[f"spine{i}"] = (r[0] + x, r[1] + y, r[2])
    return rot


def tail_wave(rot: dict, ph: float, lat: float, lift: float = 8.0) -> dict:
    for i in range(5):
        r = rot.get(f"tail{i}", (0, 0, 0))
        rot[f"tail{i}"] = (r[0] - lift, r[1] + lat * math.sin(ph - i * 0.8), r[2])
    return rot


def idle(t: float) -> dict:
    w = 2 * math.pi / 2.0
    b = math.sin(t * w)
    sniff = max(0.0, math.sin(t * w * 4)) * (0.5 + 0.5 * math.sin(t * w))
    rot = dict(LEG_REST)
    body_wave(rot, t * w, 3.5)
    tail_wave(rot, t * w, 9, 6 + 2 * b)
    rot.update({"neck0": (-10 + b * 2, math.sin(t * w) * 8, 0), "neck1": (-6, 0, 0), "head": (6 + sniff * 6, math.sin(t * w) * 10, math.sin(t * w * 2) * 4), "jaw": (sniff * 6, 0, 0), "ear_L": (0, 0, 8 * sniff), "ear_R": (0, 0, -8 * sniff)})
    return P(rot, root=(0, b * 0.008, 0), scale=(1 + b * 0.015, 1 - b * 0.01, 1))


def run(ph: float) -> dict:
    """Galop bondissant en S : les deux pattes avant ensemble, puis les deux arrière (bond de furet)."""
    s, c = math.sin(ph), math.cos(ph)
    rot = {
        "FL0": (-50 * s, 0, 4), "FR0": (-50 * s + 6, 0, -4), "FL1": (-30 * max(0, -s), 0, 0), "FR1": (-30 * max(0, -s), 0, 0),
        "BL0": (50 * s, 0, 4), "BR0": (50 * s - 6, 0, -4), "BL1": (40 * max(0, s), 0, 0), "BR1": (40 * max(0, s), 0, 0),
        "paw_FL": (30 * s, 0, 0), "paw_FR": (30 * s, 0, 0), "paw_BL": (-30 * s, 0, 0), "paw_BR": (-30 * s, 0, 0),
        "neck0": (-14 - 8 * c, 0, 0), "head": (14 + 8 * c, 0, 0), "jaw": (6, 0, 0), "ear_L": (-20, 0, 10), "ear_R": (-20, 0, -10),
    }
    body_wave(rot, ph, 5, 3.2, ph + math.pi / 2)
    tail_wave(rot, ph, 12, -4 + 10 * c)
    return P(rot, root=(0, 0.02 + 0.09 * max(0, c), 0), scale=(1, 1 + 0.05 * c, 1 - 0.04 * c))


CROUCH = P(
    {**LEG_REST, "FL0": (-30, 0, 14), "FR0": (-30, 0, -14), "FL1": (40, 0, 0), "FR1": (40, 0, 0), "BL0": (-40, 0, 10), "BR0": (-40, 0, -10), "BL1": (70, 0, 0), "BR1": (70, 0, 0),
     "spine0": (-6, 0, 0), "spine3": (4, 0, 0), "spine6": (6, 0, 0), "neck0": (10, 0, 0), "neck1": (6, 0, 0), "head": (-14, 0, 0), "jaw": (10, 0, 0),
     "ear_L": (-40, 0, 20), "ear_R": (-40, 0, -20), "tail0": (-14, 0, 0), "tail1": (-10, 0, 0), "tail2": (-8, 0, 0)},
    root=(0, -0.17, -0.12),
    scale=(1.08, 0.88, 0.96),
)
LUNGE = P(
    {"FL0": (-80, 0, 6), "FR0": (-74, 0, -6), "FL1": (-10, 0, 0), "FR1": (-10, 0, 0), "BL0": (60, 0, 4), "BR0": (66, 0, -4), "BL1": (10, 0, 0), "BR1": (10, 0, 0),
     "spine0": (-4, 0, 0), "spine6": (-6, 0, 0), "neck0": (-14, 0, 0), "neck1": (-10, 0, 0), "head": (16, 0, 0), "jaw": (46, 0, 0),
     "ear_L": (-50, 0, 10), "ear_R": (-50, 0, -10), "tail0": (10, 0, 0), "tail1": (6, 0, 0), "tail2": (6, 0, 0)},
    root=(0, 0.16, 0.35),
    scale=(0.92, 0.96, 1.22),
)


def bite(t: float) -> dict:
    W, A = BITE_WINDUP, BITE_ACTIVE
    jitter = merge(CROUCH, rot={"spine3": (4, 3, 0), "tail1": (-10, 10, 0)})
    return keyed([(0, idle(0)), (W * 0.5, CROUCH, ease_out), (W * 0.8, jitter), (W, CROUCH), (W + A * 0.6, LUNGE, ease_out), (W + A, merge(LUNGE, rot={"jaw": (0, 0, 0)})), (W + A + 380, idle(0))], t)


def spray(t: float) -> dict:
    """Bouffée putride : il s'arrête, lève la queue (os de queue × 1,3, poils hérissés) et tremble."""
    up = P({**LEG_REST, "BL0": (-20, 0, 12), "BR0": (-20, 0, -12), "BL1": (30, 0, 0), "BR1": (30, 0, 0), "FL0": (10, 0, 6), "FR0": (10, 0, -6),
            "spine0": (-10, 0, 0), "spine1": (-4, 0, 0), "spine6": (8, 0, 0), "neck0": (6, 0, 0), "head": (-20, 30, 0), "ear_L": (-30, 0, 20), "ear_R": (-30, 0, -20),
            "tail0": (-62, 0, 0), "tail1": (-24, 0, 0), "tail2": (-10, 0, 0), "tail3": (20, 0, 0), "tail4": (24, 0, 0)},
           root=(0, -0.04, 0), scl={"tail0": (1.3, 1.3, 1.3)})
    shake = lambda k: merge(up, rot={"tail2": (-10, 8 * math.sin(k * 40), 0), "tail3": (20, -10 * math.sin(k * 40), 0)})  # noqa: E731
    puff = merge(up, rot={"tail0": (-70, 0, 0), "spine0": (-16, 0, 0)}, scale=(1.06, 0.94, 1.08), scl={"tail0": (1.4, 1.4, 1.3)})
    return keyed([(0, idle(0)), (220, up, ease_out), (SPRAY_WINDUP - 60, shake(0.3)), (SPRAY_WINDUP, puff, ease_out), (SPRAY_WINDUP + 300, puff), (SPRAY_WINDUP + 700, idle(0))], t)


def war_dance(t: float) -> dict:
    """Danse de guerre du furet : sautillements latéraux, dos arqué (fenêtre de punition)."""
    w = 2 * math.pi / 0.6
    s = math.sin(t * w)
    rot = {**LEG_REST, "spine1": (-4, 0, 0), "spine3": (-8, 0, 0), "spine5": (-4, 0, 0), "spine6": (10, 0, 0), "neck0": (8, 0, 0), "head": (-10, 20 * s, 0), "jaw": (30, 0, 0),
           "FL0": (-10, 0, 10 + 10 * s), "FR0": (-10, 0, -10 + 10 * s), "BL0": (-10, 0, 10 + 10 * s), "BR0": (-10, 0, -10 + 10 * s)}
    tail_wave(rot, t * w, 16, -20)
    return P(rot, root=(0.16 * s, 0.03 + 0.12 * abs(math.cos(t * w)), 0), scale=(1, 1.03, 1))


def hurt(t: float) -> dict:
    hit = merge(CROUCH, rot={"spine6": (-14, 0, 0), "head": (-30, 0, 0), "jaw": (30, 0, 0), "tail0": (20, 0, 0)}, root=(0, -0.05, -0.18), scale=(1.12, 0.85, 1.0))
    return keyed([(0, idle(0)), (70, hit, ease_out), (320, idle(0))], t)


DEAD = P(
    {"root": (0, 0, 178), "FL0": (-30, 0, -20), "FR0": (-50, 0, 20), "BL0": (20, 0, -20), "BR0": (40, 0, 20), "FL1": (-50, 0, 0), "FR1": (-30, 0, 0), "BL1": (40, 0, 0), "BR1": (60, 0, 0),
     "neck0": (-10, 30, 0), "head": (0, 30, 0), "jaw": (40, 0, 0), "tail0": (20, 0, 0), "tail1": (10, 20, 0), "tail2": (10, 20, 0)},
    root=(0, 0.82, 0),
)


def death(t: float) -> dict:
    flip = merge(DEAD, rot={"root": (0, 0, 90)}, root=(0.2, 0.9, 0))
    twitch = merge(DEAD, rot={"FL1": (-80, 0, 0), "BR1": (90, 0, 0)})
    return keyed([(0, idle(0)), (120, hurt(70), ease_out), (380, flip, ease_out), (560, DEAD, ease_in), (640, merge(DEAD, root=(0, 0.9, 0)), ease_out), (760, DEAD, ease_in), (1000, twitch), (1150, DEAD), (1400, DEAD)], t)


def spawn(t: float) -> dict:
    """Il sort d'une bouche d'égout / d'une poubelle : jaillit d'en dessous, s'ébroue."""
    under = merge(LUNGE, rot={"spine0": (40, 0, 0), "spine3": (20, 0, 0), "neck0": (-30, 0, 0)}, root=(0, -0.9, -0.3), scale=(0.7, 1.2, 0.7))
    shake = merge(idle(0), rot={"spine6": (0, 20, 0), "head": (0, -30, 20), "tail2": (-20, 30, 0)})
    return keyed([(0, under), (280, merge(LUNGE, root=(0, 0.25, 0.2)), ease_out), (460, merge(CROUCH, root=(0, -0.1, 0.25)), ease_in), (640, shake, ease_out), (800, idle(0), ease_back)], t, )


def burrow(t: float) -> dict:
    down = merge(LUNGE, rot={"spine6": (50, 0, 0), "neck0": (40, 0, 0), "spine3": (20, 0, 0), "tail0": (-40, 0, 0)}, root=(0, -1.0, 0.4), scale=(0.7, 1.1, 0.8))
    return keyed([(0, idle(0)), (150, CROUCH, ease_out), (400, down, ease_in)], t)


def clips() -> list[Clip]:
    return [
        Clip("idle", 2.0, lambda t: idle(t / 1000), loop=True),
        Clip("run", 0.45, lambda t: run(2 * math.pi * t / 450), loop=True),
        Clip("attack-bite", (BITE_WINDUP + BITE_ACTIVE + 380) / 1000, bite, events={"windup": 0, "active": BITE_WINDUP, "recovery": BITE_WINDUP + BITE_ACTIVE}),
        Clip("attack-spray", (SPRAY_WINDUP + 700) / 1000, spray, events={"windup": 0, "active": SPRAY_WINDUP, "recovery": SPRAY_WINDUP + 300}),
        Clip("war-dance", 0.6, lambda t: war_dance(t / 1000), loop=True),
        Clip("hurt", 0.32, hurt),
        Clip("death", 1.4, death),
        Clip("spawn", 0.8, spawn),
        Clip("burrow", 0.4, burrow, events={"hidden": 400}),
    ]
