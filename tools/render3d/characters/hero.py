"""Le cheminot : casque de chantier, gilet orange haute visibilité à bandes, écharpe syndicale rouge,
clé à tire-fond. Modèle 3D low-poly + poses image par image (anticipation, action, follow-through)."""
from __future__ import annotations

import math

from rig import Builder, Character

# Matières (palette.py)
SKIN, HELMET, VEST, STRIPE, CLOTH, BOOTS, STEEL, SCARF, EYES, SMEAR_CORE, SMEAR_EDGE, HAIR = 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12


def build() -> Character:
    """Proportions trapues et lisibles (tête et mains généreuses, jambes courtes), à la Celeste / Dead Cells ;
    épaules larges et buste en V (silhouette héroïque à la Hades)."""
    b = Builder("hero")
    b.joint("pelvis", None, (0, 0, 0.62))
    b.joint("spine", "pelvis", (0, 0, 0.10))
    b.joint("chest", "spine", (0, 0, 0.16))
    b.joint("neck", "chest", (0, 0, 0.27))
    b.joint("head", "neck", (0, 0, 0.05))
    for side, sx in (("L", 1), ("R", -1)):
        b.joint(f"shoulder_{side}", "chest", (0.33 * sx, 0, 0.17))
        b.joint(f"elbow_{side}", f"shoulder_{side}", (0, 0, -0.21))
        b.joint(f"hand_{side}", f"elbow_{side}", (0, 0, -0.19))
        b.joint(f"hip_{side}", "pelvis", (0.12 * sx, 0, -0.02))
        b.joint(f"knee_{side}", f"hip_{side}", (0, 0, -0.29))
        b.joint(f"foot_{side}", f"knee_{side}", (0, 0, -0.28))
    b.joint("scarf0", "neck", (0, 0.12, -0.01))
    b.joint("scarf1", "scarf0", (0, 0.15, 0))
    b.joint("scarf2", "scarf1", (0, 0.15, 0))
    b.joint("scarf3", "scarf2", (0, 0.13, 0))
    b.joint("fx", None, (0, 0, 0.8))

    # Jambes et bottes de sécurité (grosses, lisibles)
    for side in ("L", "R"):
        b.capsule(f"thigh_{side}", f"hip_{side}", CLOTH, (0, 0, 0), (0, 0, -0.29), 0.105, 0.09)
        b.capsule(f"shin_{side}", f"knee_{side}", CLOTH, (0, 0, 0), (0, 0, -0.24), 0.088, 0.08)
        b.box(f"boot_{side}", f"foot_{side}", BOOTS, (0, -0.05, 0.04), (0.17, 0.26, 0.13), 0.05)
    b.box("hips", "pelvis", CLOTH, (0, 0, 0.0), (0.38, 0.24, 0.17), 0.07)
    # Torse : t-shirt sous un gilet orange haute visibilité, deux bandes fines
    b.box("belly", "spine", CLOTH, (0, 0, 0.03), (0.37, 0.25, 0.17), 0.08)
    b.box("vest", "chest", VEST, (0, 0, 0.08), (0.58, 0.33, 0.37), 0.1)
    b.box("stripe_lo", "chest", STRIPE, (0, 0, -0.01), (0.59, 0.34, 0.028), 0.01)
    b.box("stripe_hi", "chest", STRIPE, (0, 0, 0.11), (0.59, 0.34, 0.028), 0.01)
    # Bras (manches) et grosses mains gantées
    for side in ("L", "R"):
        b.sphere(f"shoulderpad_{side}", f"shoulder_{side}", VEST, (0, 0, -0.01), (0.14, 0.14, 0.125), 12)
        b.capsule(f"upperarm_{side}", f"shoulder_{side}", CLOTH, (0, 0, -0.02), (0, 0, -0.21), 0.09, 0.08)
        b.capsule(f"forearm_{side}", f"elbow_{side}", CLOTH, (0, 0, 0), (0, 0, -0.16), 0.074, 0.07)
        b.sphere(f"hand_{side}", f"hand_{side}", BOOTS, (0, 0, -0.03), (0.085, 0.085, 0.09), 10)
    # Tête : visage bien visible sous un casque relevé
    b.cylinder("neckpart", "neck", SKIN, (0, 0, 0.0), 0.08, 0.1)
    b.sphere("skull", "head", SKIN, (0, 0, 0.15), (0.24, 0.22, 0.23), 18)
    b.sphere("hair_back", "head", HAIR, (0, 0.07, 0.17), (0.23, 0.18, 0.18), 12)
    b.sphere("nose", "head", SKIN, (0, -0.21, 0.12), (0.045, 0.04, 0.045), 8)
    for sx in (1, -1):
        b.sphere(f"eye_{'L' if sx > 0 else 'R'}", "head", EYES, (0.09 * sx, -0.2, 0.17), (0.03, 0.02, 0.05), 8)
    for part in (
        b.sphere("helmet", "head", HELMET, (0, 0.02, 0.3), (0.25, 0.26, 0.15), 18),
        b.cylinder("brim", "head", HELMET, (0, -0.01, 0.3), 0.265, 0.03),
        b.box("helmet_ridge", "head", HELMET, (0, 0.02, 0.41), (0.06, 0.34, 0.06), 0.02),
    ):
        part["no_shadow"] = True
    # Écharpe syndicale rouge : tour de cou épais + 4 pans qui flottent (élément secondaire)
    b.cylinder("scarf_wrap", "neck", SCARF, (0, 0, 0.0), 0.15, 0.1)
    b.box("scarf_t0", "scarf0", SCARF, (0, 0.07, -0.02), (0.15, 0.17, 0.05), 0.02)
    b.box("scarf_t1", "scarf1", SCARF, (0, 0.07, 0), (0.14, 0.17, 0.045), 0.02)
    b.box("scarf_t2", "scarf2", SCARF, (0, 0.07, 0), (0.13, 0.16, 0.04), 0.02)
    b.box("scarf_t3", "scarf3", SCARF, (0, 0.05, 0), (0.12, 0.12, 0.035), 0.02)
    # Clé à tire-fond (main droite) : manche épais, douille, poignée en T
    b.cylinder("wrench_shaft", "hand_R", STEEL, (0, 0, -0.3), 0.034, 0.52)
    b.cylinder("wrench_socket", "hand_R", STEEL, (0, 0, -0.58), 0.07, 0.12)
    b.cylinder("wrench_grip", "hand_R", STEEL, (0, 0, -0.02), 0.028, 0.26, rot=(0, 90, 0))
    # Smears (traînées des coups), visibles seulement sur les frames actives
    b.arc("smear_h", "fx", SMEAR_EDGE, 0.66, 0.38, -175, -5, z=0.0)
    b.arc("smear_h_core", "fx", SMEAR_CORE, 0.66, 0.18, -170, -10, z=0.012)
    b.arc("smear_v", "fx", SMEAR_EDGE, 0.62, 0.36, 70, 215, z=0.0, plane="yz")
    b.arc("smear_v_core", "fx", SMEAR_CORE, 0.62, 0.16, 75, 210, z=0.012, plane="yz")
    return b.build()


SMEARS = ["smear_h", "smear_h_core", "smear_v", "smear_v_core"]

# ─── Poses ────────────────────────────────────────────────────────────────────

Pose = dict


def base(t: float = 0.0) -> Pose:
    """Garde au repos : clé tenue vers l'avant-bas, légère flexion."""
    s = math.sin(t * 2 * math.pi)
    return {
        "rot": {
            "spine": (-4 + s * 1.5, 0, 0),
            "chest": (0, 0, 0),
            "head": (2 - s * 1.5, 0, 0),
            "shoulder_L": (-8 + s * 3, 0, -6),
            "elbow_L": (-25, 0, 0),
            "shoulder_R": (-6 + s * 2, 0, 10),
            "elbow_R": (-20, 0, 0),
            "hand_R": (30, 0, 0),
            "hip_L": (-4, 0, -3),
            "hip_R": (4, 0, 3),
            "knee_L": (8, 0, 0),
            "knee_R": (8, 0, 0),
            "foot_L": (-4, 0, 0),
            "foot_R": (-12, 0, 0),
            "scarf0": (-62 + s * 4, 0, 0),
            "scarf1": (-14 + math.sin(t * 2 * math.pi + 1) * 5, 0, 0),
            "scarf2": (-8 + math.sin(t * 2 * math.pi + 2) * 7, 0, 0),
            "scarf3": (-6 + math.sin(t * 2 * math.pi + 3) * 9, 0, 0),
        },
        "root": (0, 0, -0.012 + 0.012 * s),
        "smear": [],
    }


def merge(p: Pose, rot: dict, root: tuple[float, float, float] | None = None, smear: list[str] | None = None, scales: dict | None = None) -> Pose:
    out = {"rot": {**p["rot"], **rot}, "root": root if root is not None else p["root"], "smear": smear if smear is not None else p["smear"]}
    if scales:
        out["scales"] = scales
    return out


def lerp_pose(a: Pose, b: Pose, t: float) -> Pose:
    keys = set(a["rot"]) | set(b["rot"])
    rot = {}
    for k in keys:
        ra = a["rot"].get(k, (0, 0, 0))
        rb = b["rot"].get(k, (0, 0, 0))
        rot[k] = tuple(x + (y - x) * t for x, y in zip(ra, rb))
    root = tuple(x + (y - x) * t for x, y in zip(a["root"], b["root"]))
    return {"rot": rot, "root": root, "smear": a["smear"] if t < 0.5 else b["smear"]}


def idle(i: int, n: int) -> Pose:
    return base(i / n)


def run(i: int, n: int) -> Pose:
    ph = 2 * math.pi * i / n
    s, c = math.sin(ph), math.cos(ph)
    a = 42 * s
    knee_l = 12 + 70 * max(0.0, -math.sin(ph - 0.6))
    knee_r = 12 + 70 * max(0.0, math.sin(ph - 0.6))
    p = base(0)
    return merge(
        p,
        {
            "spine": (-14, 0, -6 * s),
            "chest": (0, 0, 8 * s),
            "head": (8, 0, 4 * s),
            "hip_L": (-a, 0, 0),
            "hip_R": (a, 0, 0),
            "knee_L": (knee_l, 0, 0),
            "knee_R": (knee_r, 0, 0),
            "foot_L": (-10 + 0.3 * a, 0, 0),
            "foot_R": (-10 - 0.3 * a, 0, 0),
            "shoulder_L": (a * 0.9, 0, -10),
            "elbow_L": (-55, 0, 0),
            "shoulder_R": (-a * 0.5 + 10, 0, 12),
            "elbow_R": (-60, 0, 0),
            "hand_R": (40, 0, 0),
            "scarf0": (-22 + 6 * math.sin(2 * ph), 0, 6 * s),
            "scarf1": (6 + 14 * math.sin(2 * ph + 1.2), 0, 8 * s),
            "scarf2": (8 + 18 * math.sin(2 * ph + 2.4), 0, 10 * s),
            "scarf3": (8 + 22 * math.sin(2 * ph + 3.6), 0, 12 * s),
        },
        root=(0, 0, 0.035 * abs(math.sin(ph)) - 0.02),
    )


def _keyed(keys: list[tuple[int, Pose]], i: int) -> Pose:
    for (fa, pa), (fb, pb) in zip(keys, keys[1:]):
        if fa <= i <= fb:
            t = 0.0 if fb == fa else (i - fa) / (fb - fa)
            t = t * t * (3 - 2 * t)
            return lerp_pose(pa, pb, t)
    return keys[-1][1]


def _swing(twist_from: float, twist_to: float, arm_x: float, arm_z: float, elbow: float, smear: list[str] | None = None, lean: float = -8) -> Pose:
    return merge(
        base(0),
        {
            "spine": (lean, 0, twist_from * 0.4),
            "chest": (0, 0, twist_to),
            "shoulder_R": (arm_x, 0, arm_z),
            "elbow_R": (elbow, 0, 0),
            "hand_R": (-70, 0, 0),
            "shoulder_L": (-30, 0, -30),
            "elbow_L": (-60, 0, 0),
            "hip_L": (-18, 0, 0),
            "hip_R": (14, 0, 0),
            "knee_L": (14, 0, 0),
            "knee_R": (20, 0, 0),
            "scarf0": (-30, 0, -twist_to * 0.6),
            "scarf1": (10, 0, -twist_to * 0.4),
            "scarf2": (14, 0, -twist_to * 0.3),
        },
        smear=smear or [],
    )


def attack1(i: int, n: int) -> Pose:
    # Revers horizontal de droite à gauche (frame active 2, avec smear).
    keys = [
        (0, _swing(0, -35, -60, 80, -50)),
        (1, _swing(-10, -55, -50, 100, -35)),
        (2, merge(_swing(20, 50, -85, -10, -5, ["smear_h", "smear_h_core"]), {}, root=(0, -0.04, -0.02))),
        (3, _swing(25, 62, -70, -35, -10)),
        (5, _swing(10, 25, -40, 10, -30)),
        (n - 1, base(0)),
    ]
    return _keyed(keys, i)


def attack2(i: int, n: int) -> Pose:
    # Coup retour de gauche à droite.
    keys = [
        (0, _swing(15, 45, -70, -20, -30)),
        (1, _swing(25, 60, -60, -40, -40)),
        (2, merge(_swing(-20, -50, -85, 95, -5, ["smear_h", "smear_h_core"]), {}, root=(0, -0.04, -0.02))),
        (3, _swing(-25, -60, -70, 110, -10)),
        (5, _swing(-10, -20, -40, 40, -30)),
        (n - 1, base(0)),
    ]
    return _keyed(keys, i)


def attack3(i: int, n: int) -> Pose:
    # Coup de tire-fond : grande anticipation, clé levée à deux mains, frappe au sol (frame active 4).
    up = merge(
        base(0),
        {
            "spine": (12, 0, 0),
            "head": (-10, 0, 0),
            "shoulder_R": (-165, 0, 20),
            "elbow_R": (-30, 0, 0),
            "hand_R": (-20, 0, 0),
            "shoulder_L": (-165, 0, -20),
            "elbow_L": (-30, 0, 0),
            "knee_L": (20, 0, 0),
            "knee_R": (20, 0, 0),
            "scarf0": (-70, 0, 0),
        },
        root=(0, 0.02, 0.03),
    )
    slam = merge(
        base(0),
        {
            "spine": (-38, 0, 0),
            "head": (18, 0, 0),
            "shoulder_R": (-70, 0, 12),
            "elbow_R": (-5, 0, 0),
            "hand_R": (-80, 0, 0),
            "shoulder_L": (-70, 0, -12),
            "elbow_L": (-10, 0, 0),
            "hip_L": (-30, 0, 0),
            "hip_R": (20, 0, 0),
            "knee_L": (45, 0, 0),
            "knee_R": (40, 0, 0),
            "scarf0": (-5, 0, 0),
            "scarf1": (25, 0, 0),
        },
        root=(0, -0.06, -0.09),
        smear=["smear_v", "smear_v_core"],
    )
    crouch = merge(up, {"knee_L": (35, 0, 0), "knee_R": (35, 0, 0), "spine": (20, 0, 0)}, root=(0, 0.04, -0.04))
    keys = [(0, base(0)), (2, up), (3, crouch), (4, slam), (6, merge(slam, {}, smear=[])), (n - 1, base(0))]
    return _keyed(keys, i)


def dash(i: int, n: int) -> Pose:
    t = i / max(1, n - 1)
    lean = merge(
        base(0),
        {
            "spine": (-38, 0, 0),
            "head": (22, 0, 0),
            "shoulder_L": (55, 0, -20),
            "shoulder_R": (55, 0, 20),
            "elbow_L": (-20, 0, 0),
            "elbow_R": (-20, 0, 0),
            "hand_R": (60, 0, 0),
            "hip_L": (-55, 0, 0),
            "hip_R": (35, 0, 0),
            "knee_L": (60, 0, 0),
            "knee_R": (40, 0, 0),
            "scarf0": (-2, 0, 0),
            "scarf1": (6, 0, 0),
            "scarf2": (4, 0, 0),
            "scarf3": (4, 0, 0),
        },
        root=(0, -0.05, 0.02),
    )
    return lerp_pose(lean, base(0), max(0.0, t - 0.6) / 0.4)


def hurt(i: int, n: int) -> Pose:
    hit = merge(
        base(0),
        {
            "spine": (24, 0, 8),
            "head": (22, 0, -10),
            "shoulder_L": (30, 0, -50),
            "shoulder_R": (30, 0, 50),
            "elbow_L": (-60, 0, 0),
            "knee_L": (20, 0, 0),
            "scarf0": (-80, 0, 0),
            "scarf1": (-20, 0, 0),
        },
        root=(0, 0.05, -0.02),
    )
    return _keyed([(0, hit), (1, hit), (n - 1, base(0))], i)


def death(i: int, n: int) -> Pose:
    """Touché, tombe à genoux, bascule et s'effondre sur le dos en travers (lisible en vue de dessus),
    petit rebond ; l'écharpe retombe après le corps."""
    hit = merge(base(0), {"spine": (24, 0, 8), "head": (22, 0, -10), "shoulder_L": (30, 0, -50), "shoulder_R": (30, 0, 50), "knee_L": (20, 0, 0), "scarf0": (-80, 0, 0)}, root=(0, 0.05, -0.02))
    kneel = merge(
        base(0),
        {"spine": (18, 0, -6), "head": (20, 0, 6), "hip_L": (-20, 0, 0), "hip_R": (-14, 0, 0), "knee_L": (100, 0, 0), "knee_R": (96, 0, 0), "foot_L": (-40, 0, 0), "foot_R": (-40, 0, 0), "shoulder_L": (-10, 0, -10), "shoulder_R": (-10, 0, 10), "hand_R": (0, 0, 0), "scarf0": (-40, 0, 0)},
        root=(0, 0.03, -0.3),
    )
    tip = merge(kneel, {"pelvis": (-46, 0, -38), "spine": (-12, 0, 0), "head": (-14, 0, 0), "hip_L": (-70, 0, 0), "hip_R": (-60, 0, 0), "knee_L": (100, 0, 0), "knee_R": (90, 0, 0), "shoulder_L": (-60, 0, -50), "shoulder_R": (-40, 0, 40), "scarf0": (-80, 0, 0), "scarf1": (-20, 0, 0)}, root=(0.04, 0.05, -0.42))
    lie = merge(
        base(0),
        {"pelvis": (-86, 0, -72), "spine": (-4, 0, 0), "head": (6, 0, 14), "hip_L": (-16, 0, -8), "hip_R": (-4, 0, 6), "knee_L": (26, 0, 0), "knee_R": (8, 0, 0), "foot_L": (20, 0, 0), "foot_R": (10, 0, 0), "shoulder_L": (-150, 0, -30), "elbow_L": (-20, 0, 0), "shoulder_R": (-20, 0, 40), "hand_R": (0, 0, 0), "scarf0": (-10, 0, 0), "scarf1": (10, 0, 0), "scarf2": (10, 0, 0), "scarf3": (10, 0, 0)},
        root=(0.1, 0.05, -0.49),
    )
    bounce = merge(lie, {"pelvis": (-80, 0, -72), "head": (-4, 0, 14), "knee_L": (36, 0, 0), "shoulder_L": (-130, 0, -30), "scarf0": (-50, 0, 0), "scarf1": (-20, 0, 0)}, root=(0.1, 0.05, -0.45))
    return _keyed([(0, hit), (3, kneel), (5, tip), (7, lie), (8, bounce), (9, lie), (n - 1, lie)], i)


def spawn(i: int, n: int) -> Pose:
    crouch = merge(base(0), {"spine": (-25, 0, 0), "hip_L": (-70, 0, 0), "hip_R": (-70, 0, 0), "knee_L": (110, 0, 0), "knee_R": (110, 0, 0), "shoulder_R": (-80, 0, 10), "hand_R": (-10, 0, 0)}, root=(0, 0, -0.32))
    plant = merge(base(0), {"shoulder_R": (-60, 0, 15), "elbow_R": (-20, 0, 0), "hand_R": (-30, 0, 0)})
    return _keyed([(0, crouch), (5, crouch), (7, plant), (n - 1, base(0))], i)


def special(i: int, n: int) -> Pose:
    whistle = merge(base(0), {"shoulder_L": (-120, 0, -35), "elbow_L": (-120, 0, 0), "head": (-8, 0, 0), "spine": (6, 0, 0)}, root=(0, 0.02, 0.01))
    blast = merge(base(0), {"spine": (12, 0, 0), "head": (-14, 0, 0), "shoulder_L": (-60, 0, -95), "shoulder_R": (-60, 0, 95), "elbow_L": (0, 0, 0), "elbow_R": (0, 0, 0), "hand_R": (-90, 0, 0), "knee_L": (25, 0, 0), "knee_R": (25, 0, 0), "scarf0": (-10, 0, 0), "scarf1": (25, 0, 0)}, root=(0, 0, -0.05))
    return _keyed([(0, base(0)), (2, whistle), (3, whistle), (4, blast), (6, blast), (n - 1, base(0))], i)


# nom → (frames, durées (ms), boucle, directions, fonction de pose, frames actives, événements)
ANIMS = {
    "idle": (8, [140] * 8, True, True, idle, [], None),
    "run": (10, [70] * 10, True, True, run, [], {"footstep": [0, 5]}),
    "attack1": (7, [60, 50, 40, 60, 70, 80, 90], False, True, attack1, [2], None),
    "attack2": (7, [60, 50, 40, 60, 70, 80, 90], False, True, attack2, [2], None),
    "attack3": (9, [90, 90, 80, 60, 40, 90, 100, 100, 110], False, True, attack3, [4], None),
    "dash": (6, [25, 25, 25, 30, 35, 40], False, True, dash, [], None),
    "hurt": (4, [60, 70, 80, 100], False, True, hurt, [], None),
    "death": (12, [90] * 11 + [600], False, False, death, [], None),
    "spawn": (10, [80] * 9 + [120], False, False, spawn, [], None),
    "special": (12, [100, 100, 100, 100, 40, 60, 80, 80, 100, 100, 100, 120], False, False, special, [4], None),
}

ENTITY = "player"
FRAME = 80
PIVOT = (40, 66)
PX_PER_UNIT = 30.0
CATEGORY = "player"
