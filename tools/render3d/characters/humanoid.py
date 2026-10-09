"""Corps humanoïde paramétrable (même squelette que le héros : pelvis, spine, chest, neck, head, épaules,
coudes, mains, hanches, genoux, pieds). Proportions trapues à la Celeste / Dead Cells : grosse tête,
grosses mains, jambes courtes. Chaque personnage ajoute ensuite ses accessoires sur les articulations.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from rig import Builder

from .common import Pose, pose

SKIN, EYES = 1, 9


@dataclass
class Body:
    # Squelette (m)
    pelvis_z: float = 0.62
    spine: float = 0.10
    chest: float = 0.16
    neck: float = 0.27
    head: float = 0.05
    shoulder_w: float = 0.29
    shoulder_z: float = 0.17
    upper: float = 0.21
    fore: float = 0.19
    hip_w: float = 0.12
    thigh: float = 0.29
    shin: float = 0.28
    # Volumes
    head_r: tuple = (0.24, 0.22, 0.23)
    chest_box: tuple = (0.5, 0.31, 0.36)
    belly_box: tuple = (0.37, 0.25, 0.17)
    hips_box: tuple = (0.38, 0.24, 0.17)
    arm_r: float = 0.082
    fore_r: float = 0.074
    hand_r: float = 0.085
    thigh_r: float = 0.105
    shin_r: float = 0.088
    shoe: tuple = (0.17, 0.26, 0.13)
    shoulder_pad: float = 0.0  # 0 = pas d'épaulette
    pant_gap: float = 0.0  # pantalon trop court : laisse voir les chaussettes
    socks: int | None = None
    # Matières
    skin: int = SKIN
    top: int = 5
    belly: int | None = None
    pants: int = 5
    sleeves: int | None = None
    hands: int | None = None
    shoes: int = 6
    pad: int | None = None
    eyes: int = EYES


def build_body(b: Builder, body: Body) -> None:
    bd = body
    b.joint("pelvis", None, (0, 0, bd.pelvis_z))
    b.joint("spine", "pelvis", (0, 0, bd.spine))
    b.joint("chest", "spine", (0, 0, bd.chest))
    b.joint("neck", "chest", (0, 0, bd.neck))
    b.joint("head", "neck", (0, 0, bd.head))
    for side, sx in (("L", 1), ("R", -1)):
        b.joint(f"shoulder_{side}", "chest", (bd.shoulder_w * sx, 0, bd.shoulder_z))
        b.joint(f"elbow_{side}", f"shoulder_{side}", (0, 0, -bd.upper))
        b.joint(f"hand_{side}", f"elbow_{side}", (0, 0, -bd.fore))
        b.joint(f"hip_{side}", "pelvis", (bd.hip_w * sx, 0, -0.02))
        b.joint(f"knee_{side}", f"hip_{side}", (0, 0, -bd.thigh))
        b.joint(f"foot_{side}", f"knee_{side}", (0, 0, -bd.shin))
    b.joint("fx", None, (0, 0, 0.8))

    sleeves = bd.sleeves if bd.sleeves is not None else bd.top
    hands = bd.hands if bd.hands is not None else bd.skin
    belly = bd.belly if bd.belly is not None else bd.top
    for side in ("L", "R"):
        b.capsule(f"thigh_{side}", f"hip_{side}", bd.pants, (0, 0, 0), (0, 0, -bd.thigh), bd.thigh_r, bd.thigh_r * 0.86)
        b.capsule(f"shin_{side}", f"knee_{side}", bd.pants, (0, 0, 0), (0, 0, -bd.shin + 0.04 + bd.pant_gap), bd.shin_r, bd.shin_r * 0.9)
        if bd.socks is not None and bd.pant_gap > 0:
            b.capsule(f"sock_{side}", f"knee_{side}", bd.socks, (0, 0, -bd.shin + 0.04 + bd.pant_gap), (0, 0, -bd.shin + 0.06), bd.shin_r * 0.7)
        b.box(f"shoe_{side}", f"foot_{side}", bd.shoes, (0, -0.05, 0.04), bd.shoe, 0.05)
    b.box("hips", "pelvis", bd.pants, (0, 0, 0.0), bd.hips_box, 0.07)
    b.box("belly", "spine", belly, (0, 0, 0.03), bd.belly_box, 0.08)
    b.box("torso", "chest", bd.top, (0, 0, bd.chest_box[2] / 2 - 0.1), bd.chest_box, 0.1)
    for side in ("L", "R"):
        if bd.shoulder_pad > 0:
            r = bd.shoulder_pad
            b.sphere(f"shoulderpad_{side}", f"shoulder_{side}", bd.pad if bd.pad is not None else bd.top, (0, 0, -0.01), (r, r, r * 0.92), 12)
        b.capsule(f"upperarm_{side}", f"shoulder_{side}", sleeves, (0, 0, -0.02), (0, 0, -bd.upper), bd.arm_r, bd.arm_r * 0.92)
        b.capsule(f"forearm_{side}", f"elbow_{side}", sleeves, (0, 0, 0), (0, 0, -bd.fore + 0.03), bd.fore_r, bd.fore_r * 0.95)
        b.sphere(f"hand_{side}", f"hand_{side}", hands, (0, 0, -0.03), (bd.hand_r, bd.hand_r, bd.hand_r * 1.06), 10)
    hx, hy, hz = bd.head_r
    b.cylinder("neckpart", "neck", bd.skin, (0, 0, 0.0), 0.08, 0.1)
    b.sphere("skull", "head", bd.skin, (0, 0, 0.15), (hx, hy, hz), 18)
    b.sphere("nose", "head", bd.skin, (0, -hy * 0.95, 0.12), (0.045, 0.04, 0.045), 8)
    for sx, side in ((1, "L"), (-1, "R")):
        b.sphere(f"eye_{side}", "head", bd.eyes, (0.09 * sx * hx / 0.24, -hy * 0.91, 0.17), (0.03, 0.02, 0.05), 8)
        b.sphere(f"ear_{side}", "head", bd.skin, (hx * 0.97 * sx, 0.0, 0.14), (0.04, 0.05, 0.06), 8)


def base_pose(t: float = 0.0, breath: float = 1.0, extra: dict | None = None) -> Pose:
    """Repos neutre : légère flexion, respiration (`t` ∈ [0, 1[)."""
    s = math.sin(t * 2 * math.pi)
    rot = {
        "spine": (-3 + s * 1.5 * breath, 0, 0),
        "chest": (0, 0, 0),
        "head": (2 - s * 1.5 * breath, 0, 0),
        "shoulder_L": (-4 + s * 2 * breath, 0, 0),
        "elbow_L": (-18, 0, 0),
        "shoulder_R": (-4 + s * 2 * breath, 0, 0),
        "elbow_R": (-18, 0, 0),
        "hip_L": (-3, 0, -2),
        "hip_R": (3, 0, 2),
        "knee_L": (6, 0, 0),
        "knee_R": (6, 0, 0),
        "foot_L": (-3, 0, 0),
        "foot_R": (-9, 0, 0),
    }
    rot.update(extra or {})
    return pose(rot, root=(0, 0, -0.01 + 0.01 * s * breath))


def arm_ik(body: Body, side: str, target: tuple[float, float, float], swivel: float = 0.0) -> dict:
    """IK à deux os : rotations d'épaule (XYZ) et de coude (X) pour amener la main `side` sur `target`
    (repère du buste / articulation chest). `swivel` (degrés) fait tourner le coude autour de l'axe
    épaule → main (positif = coude vers l'extérieur)."""
    from mathutils import Quaternion, Vector

    sx = 1 if side == "L" else -1
    s = Vector((body.shoulder_w * sx, 0.0, body.shoulder_z))
    t = Vector(target) - s
    a, b = body.upper, body.fore
    d = max(1e-4, min(t.length, (a + b) * 0.999))
    t = t.normalized() * d
    # Angle intérieur au coude (loi des cosinus) → flexion vers l'avant
    cos_in = (a * a + b * b - d * d) / (2 * a * b)
    beta = math.pi - math.acos(max(-1.0, min(1.0, cos_in)))
    local = Vector((0.0, -b * math.sin(beta), -a - b * math.cos(beta)))
    q = local.rotation_difference(t)
    if swivel:
        q = Quaternion(t.normalized(), math.radians(swivel * sx)) @ q
    e = q.to_euler("XYZ")
    return {
        f"shoulder_{side}": (math.degrees(e.x), math.degrees(e.y), math.degrees(e.z)),
        f"elbow_{side}": (-math.degrees(beta), 0.0, 0.0),
    }
