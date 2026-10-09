"""Consultant Junior : costume cintré turquoise trop court (chevilles et chaussettes visibles), baskets
blanches, cravate magenta qui flotte (élément secondaire), houppe gominée, laptop sous le bras.
« Coup de diaporama » : il ouvre le laptop, l'écran s'allume magenta (télégraphe), il le lève
au-dessus de la tête et l'abat devant lui (smear magenta)."""
from __future__ import annotations

import math

from rig import Builder, Character

from .common import keyed, merge, pose
from .humanoid import Body, base_pose, build_body

SKIN, EYES, HAIR = 1, 9, 12
SUIT, SHIRT, TIE, SCREEN, SCREEN_IDLE, PLASTIC, SNEAKERS = 20, 21, 22, 23, 24, 25, 26
SMEAR_M, SMEAR_MC, GLASS, SOCKS = 27, 28, 33, 51

BODY = Body(
    pelvis_z=0.6,
    spine=0.1,
    chest=0.15,
    neck=0.26,
    shoulder_w=0.25,
    shoulder_z=0.15,
    upper=0.2,
    fore=0.18,
    hip_w=0.1,
    thigh=0.28,
    shin=0.28,
    head_r=(0.235, 0.215, 0.235),
    chest_box=(0.42, 0.27, 0.34),
    belly_box=(0.33, 0.22, 0.16),
    hips_box=(0.33, 0.22, 0.16),
    arm_r=0.068,
    fore_r=0.062,
    hand_r=0.078,
    thigh_r=0.085,
    shin_r=0.07,
    shoe=(0.15, 0.27, 0.12),
    top=SUIT,
    pants=SUIT,
    shoes=SNEAKERS,
    pant_gap=0.07,
    socks=SOCKS,
)


def build() -> Character:
    b = Builder("consultant")
    build_body(b, BODY)
    # Cravate magenta : nœud + deux segments qui flottent
    b.joint("tie0", "chest", (0, -0.14, 0.13))
    b.joint("tie1", "tie0", (0, 0, -0.13))
    # Laptop tenu dans la main droite ; le couvercle s'ouvre autour de la charnière
    b.joint("laptop", "hand_R", (0.0, 0.0, -0.05))
    b.joint("lid", "laptop", (0, 0, 0))

    # Chemise blanche (plastron + col) et poignets qui dépassent des manches trop courtes
    b.box("shirt", "chest", SHIRT, (0, -0.125, 0.12), (0.13, 0.04, 0.16), 0.02)
    b.box("collar", "chest", SHIRT, (0, -0.06, 0.2), (0.24, 0.16, 0.05), 0.02)
    for side in ("L", "R"):
        b.cylinder(f"cuff_{side}", f"hand_{side}", SHIRT, (0, 0, 0.02), 0.068, 0.05)
    # Revers du veston (un ton plus sombre grâce au sel-out)
    b.box("lapel_L", "chest", SUIT, (0.085, -0.13, 0.11), (0.06, 0.03, 0.2), 0.01, rot=(0, -12, 0))
    b.box("lapel_R", "chest", SUIT, (-0.085, -0.13, 0.11), (0.06, 0.03, 0.2), 0.01, rot=(0, 12, 0))
    b.box("tie_knot", "tie0", TIE, (0, -0.005, 0.03), (0.06, 0.04, 0.05), 0.015)
    b.box("tie_a", "tie0", TIE, (0, 0, -0.06), (0.07, 0.025, 0.13), 0.01)
    b.box("tie_b", "tie1", TIE, (0, 0, -0.06), (0.085, 0.025, 0.13), 0.01)
    # Coiffure : houppe gominée + nuque rasée
    b.sphere("hair_back", "head", HAIR, (0, 0.07, 0.19), (0.225, 0.18, 0.18), 12)
    b.sphere("hair_top", "head", HAIR, (0, -0.02, 0.33), (0.2, 0.19, 0.09), 12)
    b.sphere("quiff", "head", HAIR, (0.03, -0.13, 0.34), (0.13, 0.09, 0.08), 10)
    # Laptop (fermé : coque grise ; ouvert : écran)
    b.box("lt_base", "laptop", PLASTIC, (0, -0.13, -0.012), (0.36, 0.26, 0.024), 0.008)
    b.box("lt_lid", "lid", PLASTIC, (0, -0.13, 0.014), (0.36, 0.26, 0.02), 0.008)
    b.box("screen_off", "lid", GLASS, (0, -0.13, 0.002), (0.31, 0.21, 0.006), 0.0)
    b.box("screen_on", "lid", SCREEN, (0, -0.13, 0.001), (0.32, 0.22, 0.008), 0.0)
    b.box("logo_idle", "lid", SCREEN_IDLE, (0, -0.13, 0.026), (0.07, 0.07, 0.006), 0.0)
    b.box("logo_on", "lid", SCREEN, (0, -0.13, 0.026), (0.09, 0.09, 0.008), 0.0)
    # Halo magenta autour du couvercle quand l'écran est allumé (lisible de dos)
    b.box("glow", "lid", SCREEN, (0, -0.13, 0.014), (0.4, 0.3, 0.012), 0.0)
    # Smear magenta (coup vertical devant lui)
    b.arc("smear_v", "fx", SMEAR_M, 0.58, 0.34, 70, 215, z=0.0, plane="yz")
    b.arc("smear_v_core", "fx", SMEAR_MC, 0.58, 0.14, 78, 208, z=0.012, plane="yz")
    return b.build()


SMEARS = ["smear_v", "smear_v_core"]
TOGGLES = ["screen_off", "screen_on", "logo_idle", "logo_on", "glow"]
OFF = ["screen_off", "logo_idle"]
ON = ["screen_on", "logo_on"]

# ─── Poses ────────────────────────────────────────────────────────────────────


def carry(p, t: float = 0.0, tight: float = 0.0):
    """Laptop fermé coincé sous le bras droit."""
    s = math.sin(2 * math.pi * t)
    return merge(
        p,
        {
            "shoulder_R": (-12 - tight * 6, 0, 0),
            "elbow_R": (-62 - tight * 8, 0, 0),
            "hand_R": (0, 0, 0),
            "laptop": (-90, 0, 70),
            "lid": (0, 0, 0),
            "tie0": (6 + 2 * s, 0, 0),
            "tie1": (4 + 3 * math.sin(2 * math.pi * t + 1), 0, 0),
        },
        show=OFF,
    )


def idle(i: int, n: int):
    t = i / n
    s = math.sin(2 * math.pi * t)
    p = carry(base_pose(t, 1.2), t)
    # Nerveux : rebond sur la pointe des pieds, regard qui jette des coups d'œil
    return merge(p, {"head": (2 - 2 * s, 0, 8 * math.sin(2 * math.pi * t + 0.8)), "shoulder_L": (-6 + 4 * s, 0, 0), "elbow_L": (-30 + 6 * s, 0, 0), "foot_L": (-3 - 6 * max(0.0, s), 0, 0)}, root=(0, 0, 0.012 * max(0.0, s) - 0.006))


def run(i: int, n: int):
    ph = 2 * math.pi * i / n
    s, c = math.sin(ph), math.cos(ph)
    a = 40 * s
    knee_l = 14 + 75 * max(0.0, -math.sin(ph - 0.6))
    knee_r = 14 + 75 * max(0.0, math.sin(ph - 0.6))
    p = carry(base_pose(0), 0, tight=1.0)
    return merge(
        p,
        {
            "spine": (20, 0, -5 * s),
            "chest": (4, 0, 7 * s),
            "head": (-14, 0, 3 * s),
            "hip_L": (-a, 0, 0),
            "hip_R": (a, 0, 0),
            "knee_L": (knee_l, 0, 0),
            "knee_R": (knee_r, 0, 0),
            "foot_L": (-8 + 0.3 * a, 0, 0),
            "foot_R": (-8 - 0.3 * a, 0, 0),
            "shoulder_L": (a * 1.1, 0, -6),
            "elbow_L": (-70, 0, 0),
            "tie0": (-40 + 10 * math.sin(2 * ph), 0, 10 * s),
            "tie1": (-25 + 18 * math.sin(2 * ph + 1.5), 0, 12 * s),
        },
        root=(0, 0, 0.04 * abs(c) - 0.03),
    )


def _hold(p, sh: float, el: float, hand: float, lid: float, show, lean: float = 0.0, extra: dict | None = None, root=(0, 0, 0)):
    """Laptop tenu à deux mains devant lui (main gauche accompagne la droite)."""
    rot = {
        "spine": (lean, 0, 0),
        "shoulder_R": (sh, 0, 14),
        "elbow_R": (el, 0, 0),
        "hand_R": (hand, 0, 0),
        "shoulder_L": (sh, 0, -14),
        "elbow_L": (el, 0, 0),
        "laptop": (0, 0, 0),
        "lid": (lid, 0, 0),
    }
    rot.update(extra or {})
    return merge(p, rot, show=show, root=root)


def attack(i: int, n: int):
    p = base_pose(0)
    k0 = _hold(p, -40, -60, -20, -70, ON, lean=4, extra={"knee_L": (16, 0, 0), "knee_R": (16, 0, 0), "tie0": (10, 0, 0)}, root=(0, 0.02, -0.03))
    k1 = _hold(p, -85, -40, 10, -105, ON + ["glow"], lean=-4, extra={"head": (-6, 0, 0), "tie0": (14, 0, 0), "tie1": (10, 0, 0)}, root=(0, 0.02, 0.0))
    k2 = _hold(p, -165, -35, 10, -110, ON + ["glow"], lean=-16, extra={"head": (-12, 0, 0), "hip_L": (-14, 0, 0), "hip_R": (10, 0, 0), "knee_L": (12, 0, 0), "foot_L": (-20, 0, 0), "foot_R": (-20, 0, 0), "tie0": (30, 0, 0), "tie1": (20, 0, 0)}, root=(0, 0.04, 0.03))
    k3 = _hold(p, -172, -42, 14, -112, ON + ["glow"], lean=-20, extra={"head": (-14, 0, 0), "hip_L": (-16, 0, 0), "hip_R": (12, 0, 0), "knee_L": (14, 0, 0), "foot_L": (-24, 0, 0), "foot_R": (-24, 0, 0), "tie0": (36, 0, 0), "tie1": (24, 0, 0)}, root=(0, 0.05, 0.04))
    k4 = _hold(p, -55, -5, -30, -100, ON, lean=34, extra={"head": (8, 0, 0), "hip_L": (-40, 0, 0), "hip_R": (22, 0, 0), "knee_L": (46, 0, 0), "knee_R": (30, 0, 0), "tie0": (-60, 0, 0), "tie1": (-30, 0, 0)}, root=(0, -0.12, -0.1))
    k4["smear"] = ["smear_v", "smear_v_core"]
    k5 = _hold(p, -35, -10, -40, -70, ON, lean=38, extra={"head": (12, 0, 0), "hip_L": (-40, 0, 0), "hip_R": (22, 0, 0), "knee_L": (48, 0, 0), "knee_R": (32, 0, 0), "tie0": (-20, 0, 0), "tie1": (-50, 0, 0)}, root=(0, -0.13, -0.11))
    k5["smear"] = ["smear_v"]
    k6 = _hold(p, -30, -30, -20, -40, OFF, lean=18, extra={"hip_L": (-20, 0, 0), "knee_L": (24, 0, 0), "knee_R": (16, 0, 0), "tie0": (14, 0, 0), "tie1": (-10, 0, 0)}, root=(0, -0.06, -0.05))
    k7 = carry(base_pose(0))
    return keyed([(0, k0), (1, k1), (2, k2), (3, k3), (4, k4), (5, k5), (6, k6), (n - 1, k7)], i, ease=False)


def hurt(i: int, n: int):
    hit = merge(
        carry(base_pose(0)),
        {"spine": (-22, 0, 8), "head": (-24, 0, -10), "shoulder_L": (20, 0, -45), "elbow_L": (-40, 0, 0), "knee_L": (18, 0, 0), "knee_R": (8, 0, 0), "laptop": (-70, 20, 80), "tie0": (40, 0, 20), "tie1": (30, 0, 10)},
        root=(0, 0.06, -0.02),
    )
    back = merge(hit, {"spine": (-10, 0, 4), "head": (-8, 0, -4), "shoulder_L": (0, 0, -20), "tie0": (20, 0, 0), "tie1": (20, 0, 0)}, root=(0, 0.05, -0.01))
    return keyed([(0, hit), (1, back), (n - 1, carry(base_pose(0)))], i, ease=False)


def death(i: int, n: int):
    st = carry(base_pose(0))
    hit = merge(st, {"spine": (-20, 0, 10), "head": (-25, 0, 0), "shoulder_L": (10, 0, -60), "knee_L": (20, 0, 0), "laptop": (-60, 20, 80), "tie0": (40, 0, 0)}, root=(0, 0.06, -0.02))
    buckle = merge(st, {"pelvis": (0, 0, 0), "spine": (14, 0, -6), "head": (20, 0, 8), "hip_L": (-50, 0, 0), "hip_R": (-40, 0, 0), "knee_L": (90, 0, 0), "knee_R": (80, 0, 0), "shoulder_L": (0, 0, -30), "shoulder_R": (10, 0, 30), "elbow_R": (-20, 0, 0), "laptop": (-30, 0, 70), "tie0": (-20, 0, 0)}, root=(0, 0.02, -0.22))
    sit = merge(buckle, {"pelvis": (-30, 0, 0), "spine": (-20, 0, 0), "head": (-10, 0, 0), "hip_L": (-70, 0, 0), "hip_R": (-60, 0, 0), "knee_L": (60, 0, 0), "knee_R": (50, 0, 0), "shoulder_L": (-30, 0, -40), "shoulder_R": (-30, 0, 40), "tie0": (30, 0, 0)}, root=(0, 0.06, -0.4))
    lie = merge(st, {"pelvis": (-82, 0, 0), "spine": (-6, 0, 0), "head": (10, 0, 10), "hip_L": (-14, 0, -6), "hip_R": (-6, 0, 6), "knee_L": (20, 0, 0), "knee_R": (8, 0, 0), "shoulder_L": (-150, 0, -40), "shoulder_R": (-120, 0, 50), "elbow_L": (-20, 0, 0), "elbow_R": (-10, 0, 0), "laptop": (-80, 0, 60), "tie0": (60, 0, 0), "tie1": (10, 0, 0)}, root=(0, 0.1, -0.5))
    bounce = merge(lie, {"pelvis": (-78, 0, 0), "head": (2, 0, 10), "knee_L": (30, 0, 0), "shoulder_L": (-140, 0, -40)}, root=(0, 0.1, -0.47))
    flat = merge(lie, {}, show=["screen_off", "logo_idle"])
    return keyed([(0, hit), (2, buckle), (4, sit), (6, lie), (7, bounce), (8, lie), (n - 1, flat)], i)


# nom → (frames, durées (ms), boucle, directionnel, pose, frames actives, événements)
ANIMS = {
    "idle": (6, [150] * 6, True, True, idle, [], None),
    "run": (8, [68] * 8, True, True, run, [], {"footstep": [0, 4]}),
    "attack": (8, [120, 120, 120, 90, 40, 60, 80, 100], False, True, attack, [4], {"telegraph": [0, 1, 2, 3], "warnFlash": 2, "smear": [4, 5]}),
    "hurt": (3, [60, 80, 90], False, True, hurt, [], None),
    "death": (10, [80, 80, 80, 80, 80, 80, 90, 90, 120, 600], False, False, death, [], {"vfx": {"8": "vfx_poof"}}),
}

ENTITY = "consultant"
CATEGORY = "enemies"
FRAME = 72
PIVOT = (36, 64)
PX_PER_UNIT = 30.0
