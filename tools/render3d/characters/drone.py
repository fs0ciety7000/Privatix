"""Drone Optimètre : quadrirotor compact à coque turquoise, gros œil-objectif cerclé d'acier, LED
turquoise, antenne et mètre-ruban qui pend (élément secondaire). Il vole (corps à ~0,8 m du sol).
Attaque : il se cabre et vise (LED et faisceau magenta), puis pique en avant (traînée magenta)."""
from __future__ import annotations

import math

from rig import Builder, Character

from .common import keyed, merge, pose

EYES, STEEL, SCREEN_M, PLASTIC = 9, 7, 23, 25
SMEAR_M, SMEAR_MC, HV, SHEET, SPARK, GLASS, LED, RUBBER = 27, 28, 45, 31, 32, 33, 37, 50

HOVER_Z = 0.82
ARM = 0.36


def build() -> Character:
    b = Builder("drone")
    b.joint("hover", None, (0, 0, HOVER_Z))
    b.joint("body", "hover", (0, 0, 0))
    b.joint("eye", "body", (0, -0.25, 0.0))
    b.joint("tape0", "body", (0, 0.05, -0.1))
    b.joint("tape1", "tape0", (0, 0, -0.1))
    b.joint("fx", None, (0, 0, 0))
    pods = {"FL": (1, -1), "FR": (-1, -1), "BL": (1, 1), "BR": (-1, 1)}
    for k, (sx, sy) in pods.items():
        b.joint(f"rotor_{k}", "body", (ARM * sx, ARM * sy, 0.08))

    # Coque : galet arrondi turquoise, ventre sombre, LED en bandeau
    b.sphere("shell", "body", SHEET, (0, 0, 0.03), (0.3, 0.28, 0.16), 16)
    b.sphere("belly", "body", PLASTIC, (0, 0, -0.05), (0.26, 0.24, 0.1), 14)
    b.box("led_strip", "body", LED, (0, 0.02, 0.17), (0.08, 0.26, 0.03), 0.01)
    b.box("led_strip_m", "body", SCREEN_M, (0, 0.02, 0.172), (0.09, 0.27, 0.034), 0.01)
    b.cylinder("antenna", "body", STEEL, (0.13, 0.14, 0.24), 0.014, 0.18)
    b.sphere("antenna_tip", "body", LED, (0.13, 0.14, 0.34), (0.035, 0.035, 0.035), 8)
    b.sphere("antenna_tip_m", "body", SCREEN_M, (0.13, 0.14, 0.34), (0.042, 0.042, 0.042), 8)
    # Œil-objectif : bague acier, verre, iris LED (turquoise / magenta)
    b.cylinder("eye_ring", "eye", STEEL, (0, -0.01, 0), 0.15, 0.08, rot=(90, 0, 0), vertices=16)
    b.cylinder("eye_glass", "eye", GLASS, (0, -0.05, 0), 0.115, 0.02, rot=(90, 0, 0), vertices=16)
    b.cylinder("iris_t", "eye", LED, (0, -0.062, 0), 0.055, 0.012, rot=(90, 0, 0), vertices=12)
    b.cylinder("iris_m", "eye", SCREEN_M, (0, -0.064, 0), 0.07, 0.014, rot=(90, 0, 0), vertices=12)
    b.cylinder("pupil", "eye", EYES, (0, -0.07, 0), 0.024, 0.006, rot=(90, 0, 0), vertices=8)
    # Bras et nacelles moteur, pales (2 par rotor) + liseré de flou
    for k, (sx, sy) in pods.items():
        ang = math.degrees(math.atan2(sy, sx))
        b.box(f"arm_{k}", "body", PLASTIC, (ARM * sx / 2, ARM * sy / 2, 0.03), (ARM * 1.25, 0.06, 0.04), 0.015, rot=(0, 0, ang))
        b.cylinder(f"pod_{k}", f"rotor_{k}", RUBBER, (0, 0, -0.04), 0.06, 0.09)
        b.cylinder(f"hub_{k}", f"rotor_{k}", HV, (0, 0, 0.012), 0.03, 0.03)
        b.box(f"blade_{k}", f"rotor_{k}", STEEL, (0, 0, 0.02), (0.4, 0.05, 0.012), 0.0)
        b.box(f"blade2_{k}", f"rotor_{k}", STEEL, (0, 0, 0.02), (0.05, 0.34, 0.012), 0.0)
    # Mètre-ruban qui pend sous le ventre (traîne derrière dans les mouvements)
    b.box("tape_a", "tape0", HV, (0, 0, -0.05), (0.035, 0.01, 0.11), 0.0)
    b.box("tape_b", "tape1", HV, (0, 0, -0.05), (0.035, 0.01, 0.11), 0.0)
    b.box("tape_end", "tape1", STEEL, (0, 0, -0.11), (0.05, 0.03, 0.03), 0.005)
    # Faisceau de visée (attaque) et traînée de piqué
    b.joint("beam", "eye", (0, -0.06, 0))
    b.cylinder("beam_ray", "beam", SCREEN_M, (0, -0.47, 0), 0.028, 0.94, rot=(90, 0, 0), vertices=6)
    b.sphere("beam_dot", "fx", SMEAR_MC, (0, -0.5, 0.01), (0.08, 0.06, 0.01), 10)
    b.sphere("beam_ring", "fx", SCREEN_M, (0, -0.5, 0.005), (0.15, 0.1, 0.005), 12)
    b.joint("trail", "hover", (0, 0, 0))
    # Lignes de vitesse effilées (cônes couchés) derrière et au-dessus du drone
    for k, (x, z, ln, r, mid) in enumerate(((0.0, 0.12, 0.8, 0.12, SMEAR_M), (0.0, 0.14, 0.62, 0.06, SMEAR_MC), (0.34, 0.06, 0.55, 0.06, SMEAR_M), (-0.34, 0.06, 0.55, 0.06, SMEAR_M))):
        bpy_cone(b, f"trail_{k}", "trail", mid, (x, 0.22 + ln / 2, z), r, ln)
    # Étincelles (mort)
    for k, (x, y, z, rot) in enumerate(((0.25, -0.2, 0.15, 30), (-0.25, -0.1, 0.05, -40), (0.05, -0.3, -0.05, 70), (-0.1, 0.1, 0.2, -15))):
        b.box(f"spark_{k}", "body", SPARK, (x, y, z), (0.09, 0.02, 0.025), 0.0, rot=(0, rot, 0))
        b.box(f"sparkx_{k}", "body", SPARK, (x, y, z), (0.025, 0.02, 0.09), 0.0, rot=(0, rot, 0))
    return b.build()


def bpy_cone(b: Builder, name: str, joint: str, mid: int, loc, r: float, ln: float):
    """Cône couché le long de +Y (base vers le drone, pointe vers l'arrière) : traînée effilée."""
    import bpy

    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=r, radius2=0.0, depth=ln)
    obj = b._new_mesh_obj(name)
    obj.location = loc
    obj.rotation_euler = (math.radians(-90), 0, 0)
    return b._attach(obj, joint, mid)


SMEARS = ["trail_0", "trail_1", "trail_2", "trail_3"]
SPARKS = [f"spark_{k}" for k in range(4)] + [f"sparkx_{k}" for k in range(4)]
TOGGLES = ["led_strip", "led_strip_m", "antenna_tip", "antenna_tip_m", "iris_t", "iris_m", "beam_ray", "beam_dot", "beam_ring"] + SPARKS
CALM = ["led_strip", "antenna_tip", "iris_t"]
AIM = ["led_strip_m", "antenna_tip_m", "iris_m"]
ROTORS = ["FL", "FR", "BL", "BR"]

# ─── Poses ────────────────────────────────────────────────────────────────────


def fly_pose(t: float, z: float = 0.0, tilt=(0, 0, 0), spin: float = 0.0, show=None, y: float = 0.0, x: float = 0.0, tape=(0.0, 0.0), rotor_speed: float = 1.0) -> dict:
    """`t` : phase des rotors (0..1) ; pales à 2 branches → symétrie 180°, 4 frames = 45° par frame."""
    rot = {"body": tilt, "hover": (0, 0, spin), "tape0": (tape[0], 0, 0), "tape1": (tape[1], 0, 0)}
    for k, name in enumerate(ROTORS):
        sgn = 1 if k in (0, 3) else -1
        rot[f"rotor_{name}"] = (0, 0, sgn * (t * 180 * rotor_speed + 22 * k))
    return pose(rot, root=(x, y, z), show=show if show is not None else CALM)


def fly(i: int, n: int):
    t = i / n
    bob = math.sin(2 * math.pi * t)
    return fly_pose(t, z=0.035 * bob, tilt=(3 * math.cos(2 * math.pi * t), 2 * bob, 0), tape=(8 * math.cos(2 * math.pi * t), 10 * math.sin(2 * math.pi * t + 1)))


def attack(i: int, n: int):
    t = i / 4
    if i <= 3:
        # Visée : se cabre (nez vers le haut puis vers la cible), monte un peu, LED magenta, faisceau.
        rear = [(-6, 0.04), (-16, 0.1), (-22, 0.13), (-24, 0.14)][i]
        show = AIM + (["beam_ray", "beam_dot", "beam_ring"] if i >= 2 else [])
        p = fly_pose(t, z=rear[1], tilt=(rear[0], 0, 0), y=0.06 * i / 3, show=show, tape=(20 + 8 * i, 25), rotor_speed=1.0 + 0.3 * i)
        p["rot"]["eye"] = (14 + 6 * i, 0, 0)
        p["rot"]["beam"] = (62 - (14 + 6 * i) - rear[0], 0, 0)  # faisceau à 62° sous l'horizon
        return p
    # Piqué : nez en avant, chute et avancée, traînée magenta ; 4-7 bouclables (même pose, pales qui tournent).
    j = i - 4
    dive = [(46, -0.28, -0.22), (52, -0.38, -0.28), (52, -0.41, -0.3), (50, -0.42, -0.31)][j]
    p = fly_pose(t + 0.125, z=dive[1], tilt=(dive[0], 0, 0), y=dive[2], show=AIM, tape=(-55, -30), rotor_speed=1.6)
    p["smear"] = SMEARS if j < 3 else ["trail_0", "trail_2", "trail_3"]
    p["rot"]["trail"] = (0, 0, 0)
    return p


def hurt(i: int, n: int):
    hit = fly_pose(0.3, z=0.06, tilt=(-28, 22, 0), y=0.08, x=0.03, spin=12, show=["led_strip_m", "antenna_tip", "iris_m"], tape=(50, 40))
    back = fly_pose(0.6, z=0.02, tilt=(-8, 6, 0), y=0.04, spin=4, tape=(-10, 30))
    return [hit, back][min(i, 1)]


def death(i: int, n: int):
    """Chute en vrille : perd l'assiette, tourne sur lui-même, tombe, s'écrase (rebond), étincelles."""
    keys = [
        (-30, 25, 40, 0.02, ["iris_m"] + SPARKS[:2] + ["sparkx_0"]),
        (35, -40, 120, -0.18, ["iris_t", "spark_2", "sparkx_3"]),
        (-55, 60, 210, -0.42, ["spark_1", "sparkx_1"]),
        (70, -20, 300, -0.6, ["spark_3", "sparkx_2", "spark_0"]),
        (18, 8, 350, -0.66, ["spark_2", "sparkx_0"]),
        (10, 4, 360, -0.68, []),
    ]
    tx, ty, sp, z, show = keys[min(i, 5)]
    p = fly_pose(i * 0.37, z=z, tilt=(tx, ty, 0), spin=sp, show=show, tape=(60 - 20 * i, -40 + 15 * i), rotor_speed=max(0.0, 1 - i / 5))
    if i >= 5:
        for name in ROTORS:
            p["rot"][f"rotor_{name}"] = (0, 0, 30)
    return p


# nom → (frames, durées (ms), boucle, directionnel, pose, frames actives, événements)
ANIMS = {
    "fly": (4, [60] * 4, True, False, fly, [], None),
    "attack": (8, [120, 120, 120, 120, 60, 60, 60, 60], False, False, attack, [4, 5, 6, 7], {"telegraph": [0, 1, 2, 3], "loopFrames": [4, 7]}),
    "hurt": (2, [80, 90], False, False, hurt, [], None),
    "death": (6, [70, 70, 70, 70, 90, 200], False, False, death, [], {"vfx": {"5": "vfx_poof"}}),
}

ENTITY = "drone"
CATEGORY = "enemies"
FRAME = 80
PIVOT = (40, 60)
PX_PER_UNIT = 30.0
