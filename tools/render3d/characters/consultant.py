"""Consultant Junior : costume cintré turquoise trop court (chevilles et chaussettes visibles), baskets
blanches, cravate magenta qui flotte (élément secondaire), houppe gominée, laptop sous le bras.
« Coup de diaporama » : il ouvre le laptop, l'écran s'allume magenta (télégraphe), il le lève
au-dessus de la tête et l'abat devant lui (smear magenta)."""
from __future__ import annotations

import math

from rig import Builder, Character

from .common import keyed, merge, pose
from .humanoid import Body, arm_ik, base_pose, build_body

SKIN, EYES, HAIR = 1, 9, 12
SUIT, SHIRT, TIE, SCREEN, SCREEN_IDLE, PLASTIC, SNEAKERS = 20, 21, 22, 23, 24, 25, 26
SMEAR_M, SMEAR_MC, GLASS, SOCKS, SHELL = 27, 28, 33, 51, 52

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
    # Laptop (repère : prise en main à l'origine, panneau vers +Z, face écran/clavier vers -Y),
    # rattaché au buste et placé par décalages ; les mains le suivent par IK.
    b.joint("laptop", "chest", (0, 0, 0))
    b.joint("lid", "laptop", (0, 0, LT_H))

    # Chemise blanche (plastron + col) et poignets qui dépassent des manches trop courtes
    b.box("shirt", "chest", SHIRT, (0, -0.125, 0.12), (0.13, 0.04, 0.16), 0.02)
    b.box("collar", "chest", SHIRT, (0, -0.06, 0.2), (0.24, 0.16, 0.05), 0.02)
    for side in ("L", "R"):
        b.cylinder(f"cuff_{side}", f"hand_{side}", SHIRT, (0, 0, 0.02), 0.068, 0.05)
    b.box("tie_knot", "tie0", TIE, (0, -0.005, 0.03), (0.06, 0.04, 0.05), 0.015)
    b.box("tie_a", "tie0", TIE, (0, 0, -0.06), (0.07, 0.025, 0.13), 0.01)
    b.box("tie_b", "tie1", TIE, (0, 0, -0.06), (0.085, 0.025, 0.13), 0.01)
    # Coiffure : houppe gominée + nuque rasée
    b.sphere("hair_back", "head", HAIR, (0, 0.07, 0.19), (0.225, 0.18, 0.18), 12)
    b.sphere("hair_top", "head", HAIR, (0, -0.02, 0.33), (0.2, 0.19, 0.09), 12)
    b.sphere("quiff", "head", HAIR, (0.03, -0.13, 0.34), (0.13, 0.09, 0.08), 10)
    # Laptop : coque grise épaisse (lisible), écran éteint / allumé magenta, logo, halo
    b.box("lt_base", "laptop", SHELL, (0, 0.016, LT_H / 2), (LT_W, 0.032, LT_H), 0.01)
    b.box("lt_keys", "laptop", GLASS, (0, -0.001, LT_H / 2 + 0.02), (LT_W * 0.84, 0.004, LT_H * 0.6), 0.0)
    b.box("lt_lid", "lid", SHELL, (0, 0.013, LT_H / 2), (LT_W, 0.026, LT_H), 0.01)
    b.box("screen_off", "lid", GLASS, (0, -0.001, LT_H / 2), (LT_W * 0.86, 0.004, LT_H * 0.84), 0.0)
    b.box("screen_on", "lid", SCREEN, (0, -0.002, LT_H / 2), (LT_W * 0.9, 0.006, LT_H * 0.88), 0.0)
    b.box("logo_idle", "lid", SCREEN_IDLE, (0, 0.028, LT_H / 2), (0.07, 0.006, 0.07), 0.0)
    b.box("logo_on", "lid", SCREEN, (0, 0.029, LT_H / 2), (0.1, 0.008, 0.1), 0.0)
    b.box("glow", "lid", SCREEN, (0, 0.013, LT_H / 2), (LT_W + 0.07, 0.014, LT_H + 0.07), 0.0)
    # Smear magenta : ruban épais (lisible de face comme de profil)
    for name, mid, w, a0, a1 in (("smear_v", SMEAR_M, 0.36, 60, 225), ("smear_v_core", SMEAR_MC, 0.14, 72, 214)):
        o = b.arc(name, "fx", mid, 0.72, w, a0, a1, z=0.0, plane="yz")
        o.modifiers["solid"].thickness = 0.08 if name == "smear_v" else 0.1
        o.modifiers["solid"].offset = 0.0
    return b.build()


LT_W, LT_H = 0.38, 0.27
SMEARS = ["smear_v", "smear_v_core"]
TOGGLES = ["screen_off", "screen_on", "logo_idle", "logo_on", "glow"]
OFF = ["screen_off", "logo_idle"]
ON = ["screen_on", "logo_on"]

# ─── Poses ────────────────────────────────────────────────────────────────────


def laptop(p, grip, psi: float, lid: float, rz: float = 0.0, ry: float = 0.0, hands: str = "LR", show=None, swivel: float = 10.0):
    """Place le laptop (prise `grip` dans le repère du buste, inclinaison `psi`, ouverture `lid` :
    0 = à plat, 180 = fermé) et amène les mains dessus par IK."""
    from mathutils import Euler, Vector

    rot = {"laptop": (psi, ry, rz), "lid": (lid, 0, 0)}
    e = Euler((math.radians(psi), math.radians(ry), math.radians(rz)), "XYZ")
    wax = e.to_matrix() @ Vector((1, 0, 0))
    up = e.to_matrix() @ Vector((0, 0, 1))
    g = Vector(grip)
    if "R" in hands:
        rot.update(arm_ik(BODY, "R", tuple(g - wax * (LT_W * 0.36 if "L" in hands else 0.0) + up * 0.03), swivel))
    if "L" in hands:
        rot.update(arm_ik(BODY, "L", tuple(g + wax * LT_W * 0.36 + up * 0.03), swivel))
    return merge(p, rot, offsets={"laptop": tuple(grip)}, show=show if show is not None else OFF)


def carry(p, t: float = 0.0, tight: float = 0.0):
    """Laptop fermé coincé sous le bras droit, tenu par le bas."""
    s = math.sin(2 * math.pi * t)
    q = laptop(p, (-0.36, -0.02 - 0.02 * tight, -0.2 + 0.03 * tight), -6, 180, rz=60, ry=-8, hands="R", swivel=-20)
    return merge(q, {"tie0": (6 + 2 * s, 0, 0), "tie1": (4 + 3 * math.sin(2 * math.pi * t + 1), 0, 0)})


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


def attack(i: int, n: int):
    p = base_pose(0)
    glow = ON + ["glow"]
    k0 = laptop(merge(p, {"spine": (6, 0, 0), "knee_L": (16, 0, 0), "knee_R": (16, 0, 0), "tie0": (10, 0, 0)}, root=(0, 0.02, -0.03)), (0, -0.3, -0.12), -25, 95, show=ON)
    k1 = laptop(merge(p, {"spine": (-2, 0, 0), "head": (-6, 0, 0), "tie0": (14, 0, 0), "tie1": (10, 0, 0)}, root=(0, 0.02, 0.0)), (0, -0.34, -0.02), -8, 12, show=glow)
    k2 = laptop(merge(p, {"spine": (-12, 0, 0), "head": (-10, 0, 0), "hip_L": (-14, 0, 0), "hip_R": (10, 0, 0), "knee_L": (12, 0, 0), "foot_L": (-16, 0, 0), "foot_R": (-16, 0, 0), "tie0": (28, 0, 0), "tie1": (18, 0, 0)}, root=(0, 0.04, 0.03)), (0, -0.02, 0.46), -38, 18, show=glow)
    k3 = laptop(merge(p, {"spine": (-18, 0, 0), "head": (-14, 0, 0), "hip_L": (-16, 0, 0), "hip_R": (12, 0, 0), "knee_L": (14, 0, 0), "foot_L": (-22, 0, 0), "foot_R": (-22, 0, 0), "tie0": (36, 0, 0), "tie1": (24, 0, 0)}, root=(0, 0.06, 0.045)), (0, 0.06, 0.46), -62, 30, show=glow)
    k4 = laptop(merge(p, {"spine": (26, 0, 0), "head": (6, 0, 0), "hip_L": (-42, 0, 0), "hip_R": (22, 0, 0), "knee_L": (48, 0, 0), "knee_R": (30, 0, 0), "tie0": (-70, 0, 0), "tie1": (-30, 0, 0)}, root=(0, -0.14, -0.1)), (0.06, -0.33, -0.1), 112, -12, rz=-14, show=glow)
    k4["smear"] = ["smear_v", "smear_v_core"]
    k4["rot"]["fx"] = (0, 0, 38)
    k5 = laptop(merge(p, {"spine": (30, 0, 0), "head": (10, 0, 0), "hip_L": (-42, 0, 0), "hip_R": (22, 0, 0), "knee_L": (50, 0, 0), "knee_R": (32, 0, 0), "tie0": (-25, 0, 0), "tie1": (-55, 0, 0)}, root=(0, -0.15, -0.11)), (0.08, -0.32, -0.18), 128, 22, rz=-16, show=ON)
    k5["smear"] = ["smear_v"]
    k5["rot"]["fx"] = (0, 0, 42)
    k6 = laptop(merge(p, {"spine": (14, 0, 0), "hip_L": (-20, 0, 0), "knee_L": (24, 0, 0), "knee_R": (16, 0, 0), "tie0": (14, 0, 0), "tie1": (-10, 0, 0)}, root=(0, -0.08, -0.05)), (0, -0.3, -0.2), 55, 120, show=OFF)
    k7 = carry(base_pose(0))
    return keyed([(0, k0), (1, k1), (2, k2), (3, k3), (4, k4), (5, k5), (6, k6), (n - 1, k7)], i, ease=False)


def hurt(i: int, n: int):
    hit = merge(
        carry(base_pose(0)),
        {"spine": (-22, 0, 8), "head": (-24, 0, -10), "shoulder_L": (20, 0, -45), "elbow_L": (-40, 0, 0), "knee_L": (18, 0, 0), "knee_R": (8, 0, 0), "tie0": (40, 0, 20), "tie1": (30, 0, 10)},
        root=(0, 0.06, -0.02),
    )
    back = merge(hit, {"spine": (-10, 0, 4), "head": (-8, 0, -4), "shoulder_L": (0, 0, -20), "tie0": (20, 0, 0), "tie1": (20, 0, 0)}, root=(0, 0.05, -0.01))
    return keyed([(0, hit), (1, back), (n - 1, carry(base_pose(0)))], i, ease=False)


def death(i: int, n: int):
    """S'effondre : choc, genoux qui lâchent, tombe sur le dos (allongé en travers pour la vue de dessus),
    rebond, l'écran du laptop s'éteint."""
    st = carry(base_pose(0))
    hit = merge(st, {"spine": (-20, 0, 10), "head": (-25, 0, 0), "shoulder_L": (10, 0, -60), "knee_L": (20, 0, 0), "tie0": (40, 0, 0), "tie1": (20, 0, 0)}, root=(0, 0.06, -0.02))
    buckle = merge(st, {"spine": (18, 0, -8), "head": (24, 0, 8), "hip_L": (-50, 0, 0), "hip_R": (-40, 0, 0), "knee_L": (95, 0, 0), "knee_R": (85, 0, 0), "foot_L": (-30, 0, 0), "foot_R": (-30, 0, 0), "shoulder_L": (0, 0, -30), "tie0": (-20, 0, 0)}, root=(0, 0.02, -0.24))
    tip = merge(buckle, {"pelvis": (-50, 0, -40), "spine": (-10, 0, 0), "head": (-16, 0, 0), "hip_L": (-80, 0, 0), "hip_R": (-70, 0, 0), "knee_L": (100, 0, 0), "knee_R": (90, 0, 0), "shoulder_L": (-60, 0, -50), "elbow_L": (-30, 0, 0), "tie0": (40, 0, 0), "tie1": (20, 0, 0)}, root=(0.04, 0.04, -0.44))
    lie = merge(st, {"pelvis": (-86, 0, -72), "spine": (-4, 0, 0), "head": (6, 0, 14), "hip_L": (-18, 0, -8), "hip_R": (-4, 0, 6), "knee_L": (26, 0, 0), "knee_R": (8, 0, 0), "foot_L": (20, 0, 0), "foot_R": (10, 0, 0), "shoulder_L": (-150, 0, -30), "elbow_L": (-20, 0, 0), "tie0": (70, 0, 0), "tie1": (10, 0, 0)}, root=(0.1, 0.05, -0.47))
    bounce = merge(lie, {"pelvis": (-80, 0, -72), "head": (-4, 0, 14), "knee_L": (36, 0, 0), "shoulder_L": (-130, 0, -30), "tie0": (40, 0, 0)}, root=(0.1, 0.05, -0.43))
    flat = merge(lie, {}, show=["screen_off", "logo_idle"])
    flick = merge(lie, {}, show=["screen_on"])
    return keyed([(0, hit), (2, buckle), (4, tip), (6, lie), (7, bounce), (8, flick), (n - 1, flat)], i)


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
FRAME = 80
PIVOT = (40, 62)
PX_PER_UNIT = 30.0
