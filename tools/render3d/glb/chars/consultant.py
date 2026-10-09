"""Consultant Junior : port de `prototypes/proto3d/src/consultant.ts`. Costume turquoise trop court,
chaussettes, baskets blanches, cravate magenta qui flotte, houppe gominée, oreillette, laptop.
L'écran et le logo du laptop sont en matériau « glow » avec masque télégraphe (A = 1) : ils passent
au magenta quand le jeu pousse `uTelegraph` (coup de diaporama).
"""
from __future__ import annotations

import math

from ..geo import Model
from ..humanoid import Dims, humanoid_skeleton
from ..poses import P, Clip, ease_back, ease_in, ease_out, keyed, merge

WINDUP, ACTIVE, RECOVER = 700, 120, 750

DIMS = Dims(pelvis_y=0.62, spine=0.10, chest=0.15, neck=0.28, head=0.05, shoulder_w=0.27, shoulder_y=0.18, upper=0.21, fore=0.20, hip_w=0.10, hip_y=-0.02, thigh=0.29, shin=0.28, head_socket_y=0.24, back_z=-0.17, hip_socket_x=0.2)


def model() -> Model:
    m = Model("consultant")
    humanoid_skeleton(m, DIMS)
    m.joint("tie0", "chest", (0, 0.22, 0.15))
    m.joint("tie1", "tie0", (0, -0.14, 0))
    m.joint("laptop", "hand_R", (0, -0.05, 0))
    m.joint("lid", "laptop", (0, 0.016, -0.14))
    m.meta = {"kind": "enemy", "height": 1.75, "radius": 0.45, "outline": 0x06302C, "rim": 0xFF7AC8}
    suit, suit_dark, shirt, tie = 0x19C3B1, 0x0F7F7A, 0xF2F4FA, 0xFF3EA5
    skin, hair, socks, sneaker, shell, eyes = 0xF2BC90, 0x24161C, 0x8C6CA6, 0xF4F6FF, 0x4C5C88, 0x14101A
    for s in ("L", "R"):
        m.capsule(f"hip_{s}", suit, (0, 0, 0), (0, -0.29, 0), 0.088)
        m.capsule(f"knee_{s}", suit, (0, 0, 0), (0, -0.14, 0), 0.076)
        m.capsule(f"knee_{s}", socks, (0, -0.16, 0), (0, -0.24, 0), 0.058)
        m.box(f"foot_{s}", sneaker, (0, 0.035, 0.05), (0.16, 0.13, 0.3), 0.055)
        m.box(f"foot_{s}", tie, (0, -0.025, 0.05), (0.165, 0.03, 0.305), 0.01, outline=0)
        m.box(f"foot_{s}", 0x19C3B1, (0.083, 0.04, 0.02), (0.01, 0.05, 0.14), 0.004, outline=0)  # virgule
    m.box("pelvis", suit, (0, 0, 0), (0.36, 0.17, 0.24), 0.07)
    m.box("spine", suit, (0, 0.03, 0), (0.37, 0.18, 0.25), 0.08)
    # Veste cintrée + revers + chemise + col
    m.box("chest", suit, (0, 0.09, 0), (0.48, 0.38, 0.29), 0.1)
    m.box("chest", shirt, (0, 0.14, 0.135), (0.15, 0.24, 0.04), 0.015, outline=0)
    for sx in (1, -1):
        m.box("chest", suit_dark, (0.09 * sx, 0.15, 0.142), (0.07, 0.26, 0.03), 0.012, rot=(0, 0, 16 * sx), outline=0)
    m.box("chest", shirt, (0, 0.27, 0.02), (0.27, 0.06, 0.2), 0.025)
    # Badge (cordon magenta, carte turquoise)
    m.box("chest", tie, (0.12, 0.12, 0.148), (0.018, 0.2, 0.01), 0.004, outline=0, rot=(0, 0, 10))
    m.box("chest", 0x5FF7E4, (0.14, 0.01, 0.15), (0.07, 0.09, 0.012), 0.008, outline=0, emit=0.4)
    # Cravate
    m.box("tie0", tie, (0, 0, 0), (0.07, 0.05, 0.05), 0.015, outline=0, emit=0.25)
    m.box("tie0", tie, (0, -0.08, 0), (0.075, 0.14, 0.025), 0.01, emit=0.25)
    m.box("tie1", tie, (0, -0.07, 0), (0.095, 0.15, 0.025), 0.01, emit=0.25)
    # Bras (manches trop courtes, poignets blancs)
    for s in ("L", "R"):
        m.sphere(f"shoulder_{s}", suit, (0, -0.01, 0), (0.105, 0.1, 0.11))
        m.capsule(f"shoulder_{s}", suit, (0, -0.02, 0), (0, -0.21, 0), 0.07)
        m.capsule(f"elbow_{s}", suit, (0, 0, 0), (0, -0.13, 0), 0.064)
        m.cyl(f"hand_{s}", shirt, (0, 0.05, 0), 0.062, 0.05)
        m.sphere(f"hand_{s}", skin, (0, -0.02, 0), (0.078, 0.082, 0.078))
    # Tête : houppe gominée, oreillette magenta, sourire satisfait
    m.cyl("neck", skin, (0, 0, 0), 0.075, 0.1)
    m.sphere("head", skin, (0, 0.15, 0.0), (0.25, 0.24, 0.235), seg=26)
    m.sphere("head", hair, (0, 0.2, -0.06), (0.245, 0.2, 0.2))
    m.sphere("head", hair, (0, 0.31, -0.01), (0.22, 0.1, 0.21))
    m.sphere("head", hair, (0.04, 0.34, 0.13), (0.15, 0.1, 0.11), rot=(-20, 0, -8))
    for sx in (1, -1):
        m.sphere("head", eyes, (0.085 * sx, 0.17, 0.215), (0.03, 0.04, 0.025), outline=0, seg=10)
        m.box("head", hair, (0.09 * sx, 0.235, 0.22), (0.09, 0.025, 0.03), 0.01, rot=(0, 0, 14 * sx), outline=0)
        m.sphere("head", skin, (0.245 * sx, 0.14, 0), (0.045, 0.06, 0.045))
    m.box("head", 0x8A0F52, (0, 0.08, 0.215), (0.11, 0.022, 0.03), 0.01, rot=(0, 0, 6), outline=0)
    m.sphere("head", tie, (-0.27, 0.14, 0.03), (0.035, 0.035, 0.035), mat="glow", outline=0, seg=8)
    # Laptop : socle à plat (XZ), charnière à l'arrière (z = -0.14)
    m.box("laptop", shell, (0, 0, 0), (0.42, 0.03, 0.28), 0.012)
    m.box("laptop", 0x1A2140, (0, 0.016, 0.01), (0.36, 0.006, 0.18), 0.0, outline=0)
    m.box("lid", shell, (0, 0.014, 0.14), (0.42, 0.026, 0.28), 0.012)
    m.box("lid", 0x2A3A6A, (0, -0.001, 0.14), (0.38, 0.004, 0.24), 0.0, mat="glow", outline=0, emit=1.0)  # écran
    m.cyl("lid", 0x19C3B1, (0, 0.028, 0.14), 0.05, 0.004, seg=16, mat="glow", outline=0, emit=1.0)  # logo
    return m


LAPTOP_CARRY = (0, 90, 90)


def idle(t: float) -> dict:
    b = math.sin(t * 2 * math.pi / 2.8)
    return P(
        {
            "spine": (-3 + b, 0, 0), "chest": (-4 - b * 1.5, 0, 0), "head": (-8 + b, 0, 4),
            "shoulder_L": (8, 0, 22), "elbow_L": (-95, 0, 10), "hand_L": (0, 0, 0),
            "shoulder_R": (4 + b * 2, 0, -8), "elbow_R": (-8, 0, 0), "laptop": LAPTOP_CARRY, "lid": (0, 0, 0),
            "hip_L": (-4, 0, 6), "knee_L": (6, 0, 0), "foot_L": (-2, 0, 0),
            "hip_R": (4, 0, -6), "knee_R": (6, 0, 0), "foot_R": (-10, 0, 0),
        },
        root=(0, -0.008 + b * 0.01, 0),
    )


def walk(ph: float, sp: float = 1.0) -> dict:
    s, c = math.sin(ph), math.cos(ph)
    a = 30 * s * (0.5 + sp * 0.5)
    return P(
        {
            "pelvis": (0, 6 * s, 3 * s), "spine": (6, -4 * s, 0), "chest": (-4, -8 * s, 0), "head": (-8, 5 * s, 0),
            "shoulder_L": (a * 0.8, 0, 12), "elbow_L": (-40, 0, 0), "shoulder_R": (-a * 0.3, 0, -8), "elbow_R": (-10, 0, 0),
            "laptop": LAPTOP_CARRY, "lid": (0, 0, 0),
            "hip_L": (-a - 4, 0, 4), "knee_L": (10 + 55 * max(0, c), 0, 0), "foot_L": (0, 0, 0),
            "hip_R": (a - 4, 0, -4), "knee_R": (10 + 55 * max(0, -c), 0, 0), "foot_R": (0, 0, 0),
        },
        root=(0, -0.03 + 0.05 * abs(c), 0),
    )


def raise_(k: float) -> dict:
    return P(
        {
            "spine": (-12 - 8 * k, 0, 0), "chest": (-10 - 6 * k, 0, 0), "head": (6, 0, 0),
            "shoulder_R": (-160 - 12 * k, 0, 22), "elbow_R": (-40, 0, 0), "hand_R": (0, 0, 0),
            "shoulder_L": (-160 - 12 * k, 0, -22), "elbow_L": (-40, 0, 0),
            "laptop": (-90 - 20 * k, 0, 0), "lid": (-110, 0, 0),
            "hip_L": (-14, 0, 6), "knee_L": (20, 0, 0), "foot_L": (-6, 0, 0),
            "hip_R": (10, 0, -6), "knee_R": (18, 0, 0), "foot_R": (-28, 0, 0),
        },
        root=(0, 0.02 + 0.04 * k, -0.06),
        scale=(0.96, 1.05, 0.96),
    )


SLAM = P(
    {
        "spine": (38, 0, 0), "chest": (14, 0, 0), "head": (-20, 0, 0),
        "shoulder_R": (-80, 0, 16), "elbow_R": (-10, 0, 0), "shoulder_L": (-80, 0, -16), "elbow_L": (-10, 0, 0),
        "laptop": (-170, 0, 0), "lid": (-100, 0, 0),
        "hip_L": (-44, 0, 6), "knee_L": (60, 0, 0), "foot_L": (-16, 0, 0),
        "hip_R": (26, 0, -6), "knee_R": (40, 0, 0), "foot_R": (-66, 0, 0),
    },
    root=(0, -0.2, 0.18),
    scale=(1.08, 0.9, 1.08),
)

HURT = P(
    {
        "spine": (-22, 0, 8), "chest": (-12, 0, 0), "head": (-26, 0, 10),
        "shoulder_L": (-50, 0, 60), "elbow_L": (-30, 0, 0), "shoulder_R": (-40, 0, -50), "elbow_R": (-30, 0, 0),
        "laptop": LAPTOP_CARRY, "hip_L": (-20, 0, 6), "knee_L": (24, 0, 0), "hip_R": (14, 0, -6), "knee_R": (20, 0, 0), "foot_R": (-34, 0, 0),
    },
    root=(0, -0.05, -0.12),
)

DEAD = P(
    {
        "root": (-86, 0, 0), "spine": (-10, 0, 0), "head": (-30, 20, 0),
        "shoulder_L": (-150, 0, 50), "elbow_L": (-20, 0, 0), "shoulder_R": (-140, 0, -60), "elbow_R": (-20, 0, 0),
        "laptop": (0, 0, 0), "lid": (-130, 0, 0),
        "hip_L": (-40, 0, 14), "knee_L": (50, 0, 0), "hip_R": (-10, 0, -10), "knee_R": (20, 0, 0),
    },
    root=(0, 0.15, 0),
)


def tie(pose: dict, t_s: float, tv: float) -> dict:
    w = 2 * math.pi / 0.7
    pose["rot"]["tie0"] = (-8 - tv * 30 + math.sin(t_s * w) * 6 * tv, 0, math.sin(t_s * w * 0.75) * 8 * tv)
    pose["rot"]["tie1"] = (-6 - tv * 30 + math.sin(t_s * w * 1.25 + 1) * 10 * tv, 0, 0)
    return pose


def _t(fn, tv):
    return lambda t: tie(fn(t), t / 1000, tv)


def attack(t: float) -> dict:
    return keyed(
        [
            (0, idle(0)),
            (WINDUP * 0.45, raise_(0), ease_out),
            (WINDUP, raise_(1)),
            (WINDUP + ACTIVE * 0.6, SLAM, ease_in),
            (WINDUP + ACTIVE, SLAM),
            (WINDUP + ACTIVE + RECOVER * 0.55, SLAM),
            (WINDUP + ACTIVE + RECOVER, idle(0)),
        ],
        t,
    )


def death(t: float) -> dict:
    fly = merge(HURT, rot={"root": (-40, 0, 0)}, root=(0, 0.7, -0.4))
    return keyed([(0, HURT), (250, fly, ease_out), (520, DEAD, ease_in), (620, merge(DEAD, root=(0, 0.26, 0)), ease_out), (760, DEAD, ease_in), (1100, DEAD)], t)


def spawn(t: float) -> dict:
    tiny = merge(idle(0), scale=(0.01, 0.01, 0.01))
    big = merge(idle(0), scale=(1.15, 1.15, 1.15))
    return keyed([(0, tiny), (315, big, ease_out), (450, idle(0), ease_back)], t)


def clips() -> list[Clip]:
    return [
        Clip("idle", 2.8, _t(lambda t: idle(t / 1000), 0.0), loop=True),
        Clip("walk", 0.5, _t(lambda t: walk(2 * math.pi * t / 500), 1.0), loop=True),
        Clip("attack", (WINDUP + ACTIVE + RECOVER) / 1000, _t(attack, 0.5), events={"windup": 0, "active": WINDUP, "recovery": WINDUP + ACTIVE}),
        Clip("hurt", 0.3, _t(lambda t: keyed([(0, idle(0)), (70, HURT, ease_out), (300, HURT)], t), 1.4)),
        Clip("death", 1.1, _t(death, 1.4)),
        Clip("spawn", 0.45, _t(spawn, 0.3)),
    ]
