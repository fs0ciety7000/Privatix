"""Squelette humanoïde du contrat (SKELETON.md) : 18 os standard + sockets d'équipement.

Mêmes noms d'articulations que le prototype et que `characters/humanoid.py` : les poses s'échangent
d'un humanoïde à l'autre (héros, consultant, manager, PNJ, boss).
"""
from __future__ import annotations

from dataclasses import dataclass

from .geo import Model

HUMANOID_BONES = [
    "root", "pelvis", "spine", "chest", "neck", "head",
    "shoulder_L", "elbow_L", "hand_L", "shoulder_R", "elbow_R", "hand_R",
    "hip_L", "knee_L", "foot_L", "hip_R", "knee_R", "foot_R",
]

SOCKETS = [
    "socket_head", "socket_weapon_R", "socket_weapon_L", "socket_back", "socket_hip", "socket_chest",
    "socket_vfx", "socket_glove_L", "socket_glove_R", "socket_foot_L", "socket_foot_R",
]


@dataclass
class Dims:
    pelvis_y: float = 0.66
    spine: float = 0.10
    chest: float = 0.17
    neck: float = 0.30
    head: float = 0.05
    shoulder_w: float = 0.34
    shoulder_y: float = 0.20
    upper: float = 0.24
    fore: float = 0.21
    hip_w: float = 0.13
    hip_y: float = -0.03
    thigh: float = 0.30
    shin: float = 0.28
    # sockets
    head_socket_y: float = 0.25  # bord du casque, au-dessus de l'articulation de la tête
    back_z: float = -0.22
    hip_socket_x: float = 0.24


def humanoid_skeleton(m: Model, d: Dims) -> Model:
    m.joint("root", None, (0, 0, 0))
    m.joint("pelvis", "root", (0, d.pelvis_y, 0))
    m.joint("spine", "pelvis", (0, d.spine, 0))
    m.joint("chest", "spine", (0, d.chest, 0))
    m.joint("neck", "chest", (0, d.neck, 0))
    m.joint("head", "neck", (0, d.head, 0))
    for s, sx in (("L", 1), ("R", -1)):
        m.joint(f"shoulder_{s}", "chest", (d.shoulder_w * sx, d.shoulder_y, 0))
        m.joint(f"elbow_{s}", f"shoulder_{s}", (0, -d.upper, 0))
        m.joint(f"hand_{s}", f"elbow_{s}", (0, -d.fore, 0))
        m.joint(f"hip_{s}", "pelvis", (d.hip_w * sx, d.hip_y, 0))
        m.joint(f"knee_{s}", f"hip_{s}", (0, -d.thigh, 0))
        m.joint(f"foot_{s}", f"knee_{s}", (0, -d.shin, 0))
    # Sockets (os sans déformation, orientation de repos = celle du personnage)
    m.socket("socket_head", "head", (0, d.head_socket_y, 0))
    m.socket("socket_weapon_R", "hand_R", (0, 0, 0))
    m.socket("socket_weapon_L", "hand_L", (0, 0, 0))
    m.socket("socket_back", "chest", (0, 0.12, d.back_z))
    m.socket("socket_hip", "pelvis", (-d.hip_socket_x, 0.0, 0.02))
    m.socket("socket_chest", "chest", (0, 0.12, 0.2))
    m.socket("socket_vfx", "chest", (0, 0.05, 0))
    for s in ("L", "R"):
        m.socket(f"socket_glove_{s}", f"hand_{s}", (0, -0.04, 0))
        m.socket(f"socket_foot_{s}", f"foot_{s}", (0, 0.0, 0.0))
    return m
