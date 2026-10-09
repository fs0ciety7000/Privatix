"""Manager KPI « Le Tableur » (élite) : grand, costaud, épaules carrées. Costume trois-pièces turquoise
foncé (gilet turquoise vif, boutons dorés), cravate magenta, lunettes rectangulaires, tempes grises,
chronomètre doré au cou (élément secondaire qui balance), tablette-graphique.
Attaque : il brandit la tablette (écran magenta = télégraphe) et l'abat (smear magenta).
Bouclier : mains jointes, il déclenche son chronomètre (magenta) → anneaux de protection."""
from __future__ import annotations

import math

from rig import Builder, Character

from .common import keyed, merge, pose
from .humanoid import Body, base_pose, build_body, hold_prop

SKIN, STEEL, EYES, HAIR = 1, 7, 9, 12
SUIT_LIGHT, SHIRT, TIE, SCREEN_M, SMEAR_M, SMEAR_MC = 20, 21, 22, 23, 27, 28
DARK_SUIT, LED, GOLD, GREY_HAIR, SHOES, SHELL = 36, 37, 38, 40, 6, 52

BODY = Body(
    pelvis_z=0.72,
    spine=0.12,
    chest=0.17,
    neck=0.33,
    shoulder_w=0.37,
    shoulder_z=0.22,
    upper=0.25,
    fore=0.22,
    hip_w=0.14,
    thigh=0.34,
    shin=0.32,
    head_r=(0.25, 0.235, 0.255),
    chest_box=(0.72, 0.42, 0.46),
    belly_box=(0.54, 0.36, 0.2),
    hips_box=(0.5, 0.32, 0.2),
    arm_r=0.105,
    fore_r=0.095,
    hand_r=0.105,
    thigh_r=0.13,
    shin_r=0.11,
    shoe=(0.2, 0.31, 0.13),
    shoulder_pad=0.17,
    top=DARK_SUIT,
    pants=DARK_SUIT,
    shoes=SHOES,
)
TAB_W, TAB_H = 0.46, 0.34


def build() -> Character:
    b = Builder("manager")
    build_body(b, BODY)
    b.joint("watch", "chest", (0, -0.2, 0.26))
    b.joint("tab", "chest", (0, 0, 0))
    # Gilet turquoise vif + boutons dorés, plastron, cravate
    b.box("waistcoat", "chest", SUIT_LIGHT, (0, -0.19, 0.06), (0.3, 0.06, 0.34), 0.03)
    for k in range(3):
        b.sphere(f"button_{k}", "chest", GOLD, (0, -0.225, 0.13 - k * 0.08), (0.02, 0.015, 0.02), 6)
    b.box("shirt", "chest", SHIRT, (0, -0.2, 0.26), (0.16, 0.05, 0.1), 0.02)
    b.box("collar", "chest", SHIRT, (0, -0.1, 0.33), (0.3, 0.2, 0.06), 0.02)
    b.box("tie_knot", "chest", TIE, (0, -0.225, 0.3), (0.07, 0.04, 0.05), 0.015)
    b.box("tie", "chest", TIE, (0, -0.225, 0.22), (0.08, 0.025, 0.14), 0.01)
    # Tête : mâchoire carrée, tempes grises, cheveux plaqués, lunettes, sourcils épais
    b.sphere("jaw", "head", SKIN, (0, -0.05, 0.05), (0.2, 0.17, 0.12), 12)
    b.sphere("hair_top", "head", HAIR, (0, 0.08, 0.22), (0.262, 0.22, 0.2), 14)
    b.sphere("hair_part", "head", HAIR, (0.05, -0.06, 0.34), (0.18, 0.15, 0.08), 10)
    b.sphere("temple_L", "head", GREY_HAIR, (0.215, 0.0, 0.15), (0.06, 0.12, 0.085), 8)
    b.sphere("temple_R", "head", GREY_HAIR, (-0.215, 0.0, 0.15), (0.06, 0.12, 0.085), 8)
    b.box("glasses", "head", EYES, (0, -0.228, 0.165), (0.36, 0.02, 0.02), 0.0)
    for sx, side in ((1, "L"), (-1, "R")):
        b.box(f"lens_{side}", "head", EYES, (0.09 * sx, -0.226, 0.15), (0.12, 0.012, 0.06), 0.01)
        b.box(f"brow_{side}", "head", EYES, (0.09 * sx, -0.21, 0.225), (0.13, 0.03, 0.035), 0.0, rot=(0, -12 * sx, 0))
    # Chronomètre doré au bout d'une chaîne (balance avec retard)
    b.box("chain_L", "chest", GOLD, (0.07, -0.19, 0.3), (0.015, 0.015, 0.1), 0.0, rot=(0, 30, 0))
    b.box("chain_R", "chest", GOLD, (-0.07, -0.19, 0.3), (0.015, 0.015, 0.1), 0.0, rot=(0, -30, 0))
    b.cylinder("watch_case", "watch", GOLD, (0, -0.06, -0.1), 0.08, 0.035, rot=(90, 0, 0), vertices=14)
    b.sphere("watch_knob", "watch", GOLD, (0, -0.06, -0.01), (0.025, 0.025, 0.03), 6)
    b.cylinder("watch_face", "watch", SHIRT, (0, -0.08, -0.1), 0.06, 0.006, rot=(90, 0, 0), vertices=12)
    b.cylinder("watch_glow", "watch", SCREEN_M, (0, -0.082, -0.1), 0.07, 0.008, rot=(90, 0, 0), vertices=12)
    b.box("watch_hand", "watch", EYES, (0.0, -0.086, -0.08), (0.012, 0.004, 0.045), 0.0)
    # Tablette-graphique (prise à l'origine, panneau vers +Z, écran vers -Y)
    b.box("tab_body", "tab", SHELL, (0, 0.016, TAB_H / 2), (TAB_W, 0.032, TAB_H), 0.015)
    b.box("tab_scr", "tab", LED, (0, -0.002, TAB_H / 2), (TAB_W * 0.86, 0.006, TAB_H * 0.82), 0.0)
    b.box("tab_scr_m", "tab", SCREEN_M, (0, -0.003, TAB_H / 2), (TAB_W * 0.88, 0.008, TAB_H * 0.84), 0.0)
    b.box("tab_glow", "tab", SCREEN_M, (0, 0.016, TAB_H / 2), (TAB_W + 0.08, 0.02, TAB_H + 0.08), 0.0)
    for k, hgt in enumerate((0.08, 0.13, 0.1, 0.2)):
        b.box(f"bar_{k}", "tab", EYES, (-0.13 + k * 0.085, -0.008, 0.06 + hgt / 2), (0.05, 0.006, hgt), 0.0)
    b.box("trend", "tab", EYES, (0.02, -0.009, 0.24), (0.32, 0.006, 0.02), 0.0, rot=(0, -18, 0))
    # Smear magenta (abattage en diagonale) et anneaux de bouclier
    for name, mid, w, a0, a1, th in (("smear_v", SMEAR_M, 0.44, 55, 228, 0.1), ("smear_v_core", SMEAR_MC, 0.18, 68, 218, 0.12)):
        o = b.arc(name, "fx", mid, 0.92, w, a0, a1, z=0.0, plane="yz")
        o.modifiers["solid"].thickness = th
        o.modifiers["solid"].offset = 0.0
    b.joint("shield", None, (0, 0, 0))
    b.arc("ring_lo", "shield", LED, 0.72, 0.1, -180, 180, z=0.12, thickness=0.06, taper=False)
    b.arc("ring_hi", "shield", LED, 0.6, 0.08, -180, 180, z=1.05, thickness=0.05, taper=False)
    b.arc("ring_mid", "shield", LED, 0.7, 0.06, -180, 180, z=0.6, thickness=0.05, taper=False)
    b.arc("pulse", "shield", SCREEN_M, 0.95, 0.16, -180, 180, z=0.05, thickness=0.04, taper=False)
    b.arc("pulse_core", "shield", SMEAR_MC, 0.95, 0.06, -180, 180, z=0.07, thickness=0.04, taper=False)
    return b.build()


SMEARS = ["smear_v", "smear_v_core"]
TOGGLES = ["tab_scr", "tab_scr_m", "tab_glow", "watch_glow", "ring_lo", "ring_hi", "ring_mid", "pulse", "pulse_core"]
CALM = ["tab_scr"]
RED = ["tab_scr_m"]

# ─── Poses ────────────────────────────────────────────────────────────────────


def with_tab(p, grip, rot, hands="LR", show=None, swivel=12.0, half=TAB_W * 0.4):
    r, o = hold_prop(BODY, "tab", grip, rot, half, hands, swivel)
    return merge(p, r, offsets=o, show=show if show is not None else CALM)


def stance(t: float = 0.0, breath: float = 1.0):
    """Repos : tablette tenue contre le flanc gauche, écran (graphique) tourné vers l'extérieur."""
    s = math.sin(2 * math.pi * t)
    p = base_pose(t, breath, {"spine": (-5 + 1.5 * s, 0, 0), "head": (-2 - s, 0, 0), "hip_L": (-2, 0, -6), "hip_R": (2, 0, 6), "foot_L": (-2, 0, -8), "foot_R": (-6, 0, 8), "shoulder_R": (-6 + 2 * s, 8, 0), "elbow_R": (-22, 0, 0)})
    p = with_tab(p, (0.3, -0.24, -0.06), (-12, 0, -30), hands="L", swivel=-10)
    p["rot"]["watch"] = (4 * s, 0, 2 * math.sin(2 * math.pi * t + 1))
    return p


def idle(i: int, n: int):
    t = i / n
    p = stance(t)
    # Geste : il tapote l'écran de la tablette (index droit) une fois par cycle
    tap = [0.0, 0.6, 1.0, 0.4, 0.0, 0.0][i % 6]
    if tap > 0:
        from .humanoid import arm_ik

        p = merge(p, arm_ik(BODY, "R", (0.16 - 0.04 * tap, -0.36, 0.02 + 0.03 * tap), 20))
    return p


def walk(i: int, n: int):
    ph = 2 * math.pi * i / n
    s, c = math.sin(ph), math.cos(ph)
    a = 26 * s
    p = stance(0, 0)
    knee_l = 8 + 40 * max(0.0, -math.sin(ph - 0.5))
    knee_r = 8 + 40 * max(0.0, math.sin(ph - 0.5))
    return merge(
        p,
        {
            "spine": (2, 0, -5 * s),
            "chest": (0, 0, 7 * s),
            "head": (-4, 0, -4 * s),
            "hip_L": (-a, 0, -4),
            "hip_R": (a, 0, 4),
            "knee_L": (knee_l, 0, 0),
            "knee_R": (knee_r, 0, 0),
            "foot_L": (-6 + 0.3 * a, 0, -6),
            "foot_R": (-6 - 0.3 * a, 0, 6),
            "shoulder_R": (a * 1.1, 10, 0),
            "elbow_R": (-28 - 8 * max(0.0, s), 0, 0),
            "watch": (-6 + 8 * math.sin(2 * ph), 0, 10 * s),
        },
        root=(0, 0, 0.03 * abs(c) - 0.02),
    )


def attack(i: int, n: int):
    """Brandit la tablette (télégraphe magenta 1-3), l'abat devant lui (active 5), follow-through."""
    p = base_pose(0)
    glow = RED + ["tab_glow"]
    k0 = with_tab(merge(p, {"spine": (4, 0, 0), "knee_L": (14, 0, 0), "knee_R": (14, 0, 0), "watch": (10, 0, 0)}, root=(0, 0.02, -0.03)), (0, -0.36, -0.12), (-15, 0, 0))
    k1 = with_tab(merge(p, {"spine": (-4, 0, 0), "head": (-6, 0, 0), "watch": (16, 0, 0)}, root=(0, 0.03, 0.0)), (0, -0.4, 0.06), (-6, 0, 0), show=glow)
    k2 = with_tab(merge(p, {"spine": (-14, 0, 0), "head": (-12, 0, 0), "hip_L": (-14, 0, 0), "hip_R": (10, 0, 0), "knee_L": (12, 0, 0), "foot_L": (-14, 0, 0), "foot_R": (-14, 0, 0), "watch": (30, 0, 0)}, root=(0, 0.05, 0.03)), (0, -0.02, 0.6), (-40, 0, 0), show=glow)
    k3 = with_tab(merge(p, {"spine": (-20, 0, 0), "head": (-16, 0, 0), "hip_L": (-18, 0, 0), "hip_R": (12, 0, 0), "knee_L": (16, 0, 0), "foot_L": (-20, 0, 0), "foot_R": (-20, 0, 0), "watch": (38, 0, 0)}, root=(0, 0.07, 0.045)), (0, 0.08, 0.6), (-68, 0, 0), show=glow)
    k4 = with_tab(merge(p, {"spine": (10, 0, 0), "head": (2, 0, 0), "hip_L": (-30, 0, 0), "hip_R": (16, 0, 0), "knee_L": (30, 0, 0), "knee_R": (20, 0, 0), "watch": (-10, 0, 0)}, root=(0, -0.08, -0.04)), (0.04, -0.34, 0.36), (40, 0, -8), show=glow)
    k4["smear"] = ["smear_v"]
    k4["rot"]["fx"] = (0, 0, 36)
    k5 = with_tab(merge(p, {"spine": (28, 0, 0), "head": (8, 0, 0), "hip_L": (-44, 0, 0), "hip_R": (24, 0, 0), "knee_L": (52, 0, 0), "knee_R": (32, 0, 0), "watch": (-60, 0, 0)}, root=(0, -0.16, -0.12)), (0.06, -0.4, -0.12), (112, 0, -14), show=glow)
    k5["smear"] = ["smear_v", "smear_v_core"]
    k5["rot"]["fx"] = (0, 0, 38)
    k6 = with_tab(merge(p, {"spine": (32, 0, 0), "head": (12, 0, 0), "hip_L": (-44, 0, 0), "hip_R": (24, 0, 0), "knee_L": (54, 0, 0), "knee_R": (34, 0, 0), "watch": (-20, 0, 0)}, root=(0, -0.17, -0.13)), (0.08, -0.38, -0.22), (126, 0, -16), show=RED)
    k6["smear"] = ["smear_v"]
    k6["rot"]["fx"] = (0, 0, 42)
    k7 = stance(0)
    return keyed([(0, k0), (1, k1), (2, k2), (3, k3), (4, k4), (5, k5), (6, k6), (n - 1, k7)], i, ease=False)


def shield(i: int, n: int):
    """Mains jointes sur le chronomètre (télégraphe magenta 0-2), déclenchement frame 3 : impulsion
    magenta au sol + anneaux de protection turquoise qui tiennent jusqu'à la frame 6."""
    from .humanoid import arm_ik

    def joined(p, target, show, sw=25):
        q = merge(p, {**arm_ik(BODY, "L", (target[0] + 0.05, target[1], target[2]), sw), **arm_ik(BODY, "R", (target[0] - 0.05, target[1], target[2]), sw)})
        q = with_tab(q, (0.36, 0.02, -0.25), (-4, 0, 70), hands="", show=show)
        return q

    p = base_pose(0)
    tele = CALM + ["watch_glow"]
    k0 = joined(merge(p, {"spine": (2, 0, 0), "watch": (20, 0, 0)}), (0, -0.3, 0.1), tele)
    k1 = joined(merge(p, {"spine": (-6, 0, 0), "head": (-10, 0, 0), "watch": (28, 0, 0)}, root=(0, 0.01, 0.02)), (0, -0.28, 0.3), tele)
    k2 = joined(merge(p, {"spine": (8, 0, 0), "head": (8, 0, 0), "knee_L": (24, 0, 0), "knee_R": (24, 0, 0), "hip_L": (-14, 0, 0), "hip_R": (-14, 0, 0), "watch": (30, 0, 0)}, root=(0, 0.0, -0.06)), (0, -0.3, 0.16), tele)
    spread = {"spine": (-10, 0, 0), "head": (-8, 0, 0), "shoulder_L": (-30, 0, -100), "elbow_L": (-10, 0, 0), "shoulder_R": (-30, 0, 100), "elbow_R": (-10, 0, 0), "knee_L": (10, 0, 0), "knee_R": (10, 0, 0), "watch": (-30, 0, 0)}
    k3 = with_tab(merge(p, spread, root=(0, 0, 0.03), show=CALM + ["watch_glow", "pulse", "pulse_core", "ring_lo", "ring_mid", "ring_hi"]), (0.36, 0.02, -0.25), (-4, 0, 70), hands="", show=CALM + ["watch_glow", "pulse", "pulse_core", "ring_lo", "ring_mid", "ring_hi"])
    k3["scales"]["shield"] = (1.08, 1.08, 1.0)
    rings = CALM + ["ring_lo", "ring_mid", "ring_hi"]
    k4 = with_tab(merge(p, {**spread, "shoulder_L": (-20, 0, -70), "shoulder_R": (-20, 0, 70), "watch": (-10, 0, 0)}), (0.36, 0.02, -0.25), (-4, 0, 70), hands="", show=rings)
    k5 = merge(k4, {"shoulder_L": (-10, 0, -45), "shoulder_R": (-10, 0, 45), "watch": (8, 0, 0)}, show=rings)
    k5["scales"]["shield"] = (0.96, 0.96, 1.0)
    k6 = merge(k5, {"shoulder_L": (-6, 0, -25), "shoulder_R": (-6, 0, 25)}, show=["tab_scr", "ring_lo", "ring_mid"])
    k6["scales"]["shield"] = (0.9, 0.9, 1.0)
    k7 = stance(0)
    return [k0, k1, k2, k3, k4, k5, k6, k7][min(i, 7)]


def hurt(i: int, n: int):
    st = stance(0)
    hit = merge(st, {"spine": (-18, 0, 8), "head": (-20, 0, -8), "shoulder_R": (20, 30, 0), "elbow_R": (-50, 0, 0), "knee_L": (16, 0, 0), "watch": (40, 0, 20)}, root=(0, 0.06, -0.02))
    back = merge(st, {"spine": (-8, 0, 4), "head": (-6, 0, -3), "watch": (-20, 0, -10)}, root=(0, 0.04, -0.01))
    return [hit, back][min(i, 1)]


def death(i: int, n: int):
    """Vacille, tombe à genoux, puis s'écroule sur le dos (en travers pour la vue de dessus)."""
    st = stance(0)
    hit = merge(st, {"spine": (-18, 0, 10), "head": (-22, 0, 0), "shoulder_R": (20, 40, 0), "knee_L": (18, 0, 0), "watch": (40, 0, 0)}, root=(0, 0.06, -0.02))
    knees = merge(st, {"spine": (16, 0, -6), "head": (18, 0, 6), "hip_L": (-20, 0, 0), "hip_R": (-14, 0, 0), "knee_L": (100, 0, 0), "knee_R": (96, 0, 0), "foot_L": (-40, 0, 0), "foot_R": (-40, 0, 0), "shoulder_R": (10, 20, 0), "watch": (-30, 0, 0)}, root=(0, 0.04, -0.36))
    sway = merge(knees, {"spine": (-12, 0, 10), "head": (-20, 0, -10), "watch": (30, 0, 10)}, root=(0, 0.06, -0.37))
    tip = merge(knees, {"pelvis": (-46, 0, -38), "spine": (-12, 0, 0), "head": (-14, 0, 0), "hip_L": (-70, 0, 0), "hip_R": (-60, 0, 0), "knee_L": (100, 0, 0), "knee_R": (90, 0, 0), "shoulder_R": (-70, 50, 0), "watch": (60, 0, 0)}, root=(0.04, 0.06, -0.5))
    lie = merge(st, {"pelvis": (-86, 0, -72), "spine": (-4, 0, 0), "head": (6, 0, 14), "hip_L": (-14, 0, -8), "hip_R": (-4, 0, 6), "knee_L": (24, 0, 0), "knee_R": (8, 0, 0), "foot_L": (20, 0, 0), "foot_R": (10, 0, 0), "shoulder_R": (-140, 40, 0), "elbow_R": (-20, 0, 0), "watch": (80, 0, 0)}, root=(0.12, 0.06, -0.56))
    bounce = merge(lie, {"pelvis": (-80, 0, -72), "knee_L": (34, 0, 0), "watch": (40, 0, 0)}, root=(0.12, 0.06, -0.52))
    flat = merge(lie, {}, show=[])
    return keyed([(0, hit), (2, knees), (3, sway), (4, tip), (5, lie), (6, bounce), (n - 1, flat)], i)


# nom → (frames, durées (ms), boucle, directionnel, pose, frames actives, événements)
ANIMS = {
    "idle": (6, [160] * 6, True, True, idle, [], None),
    "walk": (8, [95] * 8, True, True, walk, [], {"footstep": [0, 4]}),
    "attack": (8, [120, 120, 150, 150, 60, 80, 120, 150], False, True, attack, [5], {"telegraph": [1, 2, 3]}),
    "shield": (8, [110] * 8, False, True, shield, [3], {"telegraph": [0, 1, 2]}),
    "hurt": (2, [80, 90], False, True, hurt, [], None),
    "death": (8, [100, 100, 100, 110, 100, 100, 120, 600], False, False, death, [], {"vfx": {"6": "vfx_poof"}}),
}

ENTITY = "manager-kpi"
CATEGORY = "enemies"
FRAME = 112
PIVOT = (56, 88)
PX_PER_UNIT = 30.0
