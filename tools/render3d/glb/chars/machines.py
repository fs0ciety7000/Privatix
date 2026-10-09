"""Machines Privatix : la Borne Automatique et le Drone Optimètre, portés de `characters/borne.py` et
`characters/drone.py` (cotes reprises telles quelles, converties du repère Blender Z-haut / face -Y
vers le repère Three Y-haut / face +Z par `o()`, `sz()`, `rz()`).

Écrans, LED et iris sont en « glow » avec masque télégraphe (A = 1) : magenta quand uTelegraph > 0.
"""
from __future__ import annotations

import math

from ..geo import Model
from ..poses import P, Clip, ease_back, ease_in, ease_out, keyed, merge

SHEET, SHEET_DARK, RUBBER, PLASTIC, STEEL = 0x29A898, 0x168A7E, 0x2A2638, 0x45567C, 0xA2B2D0
TICKET, HV, INK, YELLOW, TURQ = 0xEFE8DC, 0xF0FF3C, 0x14101A, 0xFFD84A, 0x19C3B1


def o(x, y, z):
    """Position Blender (x, y, z) → Three (x, z, -y)."""
    return (x, z, -y)


def sz(x, y, z):
    """Dimensions Blender → Three."""
    return (x, z, y)


# ─── Borne ────────────────────────────────────────────────────────────────────

BODY_H = 0.6
HEAD_Z = 0.1 + BODY_H


def borne() -> Model:
    m = Model("borne")
    m.joint("root", None, (0, 0, 0))
    m.joint("body", "root", o(0, 0, 0.1))
    m.joint("head", "body", o(0, 0.02, HEAD_Z - 0.1))
    m.joint("slot", "body", o(0, -0.27, 0.4))
    m.joint("ticket", "slot", (0, 0, 0))
    m.joint("trap_L", "root", o(0.46, -0.02, 0.012))
    m.joint("trap_R", "root", o(-0.46, -0.02, 0.012))
    m.socket("socket_vfx", "head", o(0, -0.3, 0.21))
    m.socket("socket_muzzle", "slot", o(0, -0.1, 0))
    m.meta = {"kind": "enemy", "height": 1.3, "radius": 0.5, "outline": 0x06302C, "rim": 0x6FF3FF}
    m.box("body", RUBBER, o(0, 0, -0.05), sz(0.84, 0.62, 0.1), 0.03)
    for s, sx in (("L", 1), ("R", -1)):
        m.box(f"trap_{s}", RUBBER, o(-0.23 * sx, 0, 0), sz(0.46, 0.8, 0.02), 0.0)
        for k in range(3):
            m.box(f"trap_{s}", HV, o(-0.23 * sx, -0.27 + k * 0.27, 0.012), sz(0.42, 0.09, 0.006), 0.0, rot=(0, 25 * sx, 0), outline=0)
    m.box("body", SHEET, o(0, 0, BODY_H / 2), sz(0.74, 0.54, BODY_H), 0.05)
    m.box("body", INK, o(0, -0.262, 0.3), sz(0.6, 0.02, 0.42), 0.02, outline=0)
    m.box("body", RUBBER, o(0, -0.276, 0.4), sz(0.34, 0.02, 0.06), 0.01, outline=0)
    m.box("body", SHEET_DARK, o(0.17, -0.282, 0.24), sz(0.16, 0.02, 0.14), 0.01, outline=0)
    for r in range(2):
        for c in range(2):
            m.box("body", TICKET, o(0.135 + c * 0.07, -0.294, 0.27 - r * 0.06), sz(0.04, 0.008, 0.03), 0.0, outline=0)
    m.box("body", RUBBER, o(-0.12, -0.282, 0.16), sz(0.24, 0.03, 0.08), 0.01, outline=0)
    for k in range(3):
        for sx in (1, -1):
            m.box("body", RUBBER, o(0.375 * sx, 0.05, 0.18 + k * 0.08), sz(0.01, 0.3, 0.025), 0.0, outline=0)
    # Tête : boîtier écran, visière, gyrophare
    def h(x, y, z):  # repère de la tête (cotes d'origine décalées de 2 cm en y)
        return o(x, y - 0.02, z)

    m.box("head", SHEET, h(0, 0.02, 0.22), sz(0.8, 0.56, 0.44), 0.06)
    m.box("head", RUBBER, h(0, -0.25, 0.21), sz(0.7, 0.04, 0.36), 0.03)
    m.box("head", INK, h(0, -0.22, 0.45), sz(0.86, 0.22, 0.05), 0.02)
    m.cyl("head", PLASTIC, h(0.22, 0.07, 0.47), 0.07, 0.04)
    m.sphere("head", TURQ, h(0.22, 0.07, 0.52), (0.06, 0.065, 0.06), mat="glow", emit=1.0, outline=0, seg=10)
    sy = -0.272
    m.box("head", YELLOW, h(0, sy, 0.21), sz(0.6, 0.006, 0.3), 0.0, mat="glow", emit=1.0, outline=0)
    for k in range(4):
        m.box("head", INK, h(-0.12 + k * 0.08, sy - 0.006, 0.26), sz(0.055, 0.006, 0.05), 0.0, outline=0)
    for k in range(6):
        m.box("head", INK, h(-0.2 + k * 0.08, sy - 0.006, 0.15), sz(0.055, 0.006, 0.05), 0.0, outline=0)
    for k, (x, z, ang, ln) in enumerate(((0.21, 0.31, 35, 0.12), (0.15, 0.24, -20, 0.1), (0.1, 0.19, 50, 0.08))):
        m.box("head", INK, h(x, sy - 0.008, z), sz(ln, 0.004, 0.014), 0.0, rot=(0, 0, -ang), outline=0)
    # Ticket qui dépasse de la fente
    m.box("ticket", TICKET, o(0, -0.02, -0.07), sz(0.16, 0.01, 0.15), 0.0)
    m.box("ticket", 0xFF3EA5, o(0, -0.026, -0.12), sz(0.16, 0.004, 0.025), 0.0, outline=0)
    return m


def borne_idle(t: float) -> dict:
    w = 2 * math.pi / 1.6
    s = math.sin(t * w)
    return P({"head": (2 * s, 3 * math.sin(t * w / 2), 1.5 * s), "ticket": (8 * math.sin(t * w * 2), 0, 0)}, scale=(1 + 0.01 * s, 1 - 0.01 * s, 1))


BORNE_AIM = P({"body": (-8, 0, 0), "head": (-14, 0, 0), "ticket": (30, 0, 0)}, scale=(0.94, 1.08, 0.94))
BORNE_SHOT = P({"body": (10, 0, 0), "head": (8, 0, 0), "ticket": (-40, 0, 0)}, root=(0, 0, -0.06), scale=(1.1, 0.9, 1.1), scl={"ticket": (1, 1.6, 1)})


def borne_clips() -> list[Clip]:
    shut = P({"trap_L": (0, 0, 0), "trap_R": (0, 0, 0)}, root=(0, -1.1, 0))
    opened = P({"trap_L": (0, 0, -100), "trap_R": (0, 0, 100)}, root=(0, -1.1, 0))
    return [
        Clip("idle", 1.6, lambda t: borne_idle(t / 1000), loop=True),
        Clip("spawn", 0.9, lambda t: keyed([(0, shut), (250, opened, ease_out), (600, merge(opened, root=(0, 0.12, 0), scale=(0.9, 1.15, 0.9)), ease_out), (750, merge(borne_idle(0), scale=(1.12, 0.88, 1.12), rot={"trap_L": (0, 0, -100), "trap_R": (0, 0, 100)}), ease_in), (900, merge(borne_idle(0), rot={"trap_L": (0, 0, 0), "trap_R": (0, 0, 0)}), ease_back)], t)),
        Clip("attack", 1.0, lambda t: keyed([(0, borne_idle(0)), (500, BORNE_AIM, ease_out), (600, merge(BORNE_AIM, rot={"head": (-14, 4, 3)})), (660, BORNE_SHOT, ease_in), (1000, borne_idle(0))], t), events={"windup": 0, "active": 660, "recovery": 760}),
        Clip("hurt", 0.25, lambda t: keyed([(0, borne_idle(0)), (60, P({"body": (-8, 0, 6), "head": (-16, 10, 8)}, scale=(1.1, 0.9, 1.1)), ease_out), (250, borne_idle(0))], t)),
        Clip("death", 1.0, lambda t: keyed([(0, borne_idle(0)), (200, P({"head": (-30, 20, 20)}, scale=(1.1, 0.9, 1.1))), (600, P({"body": (16, 0, -10), "head": (60, 40, 60)}, root=(0, -0.05, 0), scale=(1.05, 0.8, 1.05)), ease_in), (1000, P({"body": (18, 0, -12), "head": (70, 40, 70)}, root=(0, -0.08, 0), scale=(1.05, 0.75, 1.05)))], t)),
    ]


# ─── Drone ────────────────────────────────────────────────────────────────────

HOVER = 0.82
ARM = 0.36
PODS = {"FL": (1, -1), "FR": (-1, -1), "BL": (1, 1), "BR": (-1, 1)}


def drone() -> Model:
    m = Model("drone")
    m.joint("root", None, (0, 0, 0))
    m.joint("hover", "root", (0, HOVER, 0))
    m.joint("body", "hover", (0, 0, 0))
    m.joint("eye", "body", o(0, -0.25, 0.0))
    m.joint("tape0", "body", o(0, 0.05, -0.1))
    m.joint("tape1", "tape0", o(0, 0, -0.1))
    for k, (sx, sy) in PODS.items():
        m.joint(f"rotor_{k}", "body", o(ARM * sx, ARM * sy, 0.08))
    m.socket("socket_vfx", "body", (0, 0, 0))
    m.socket("socket_muzzle", "eye", o(0, -0.07, 0))
    m.meta = {"kind": "enemy", "height": 1.2, "radius": 0.45, "outline": 0x06302C, "rim": 0x6FF3FF, "runtime_bones": [f"rotor_{k}" for k in PODS]}
    m.sphere("body", SHEET, o(0, 0, 0.03), sz(0.3, 0.28, 0.16), seg=18)
    m.sphere("body", PLASTIC, o(0, 0, -0.05), sz(0.26, 0.24, 0.1), seg=14)
    m.box("body", TURQ, o(0, 0.02, 0.17), sz(0.09, 0.27, 0.034), 0.01, mat="glow", emit=1.0, outline=0)
    m.cyl("body", STEEL, o(0.13, 0.14, 0.24), 0.014, 0.18, seg=6)
    m.sphere("body", TURQ, o(0.13, 0.14, 0.34), (0.04, 0.04, 0.04), mat="glow", emit=1.0, outline=0, seg=8)
    m.cyl("eye", STEEL, o(0, -0.01, 0), 0.15, 0.08, rot=(90, 0, 0), seg=16)
    m.cyl("eye", 0x26396E, o(0, -0.05, 0), 0.115, 0.02, rot=(90, 0, 0), seg=16, outline=0)
    m.cyl("eye", TURQ, o(0, -0.064, 0), 0.06, 0.014, rot=(90, 0, 0), seg=12, mat="glow", emit=1.0, outline=0)
    m.cyl("eye", INK, o(0, -0.072, 0), 0.024, 0.006, rot=(90, 0, 0), seg=8, outline=0)
    for k, (sx, sy) in PODS.items():
        ang = math.degrees(math.atan2(sy, sx))
        m.box("body", PLASTIC, o(ARM * sx / 2, ARM * sy / 2, 0.03), sz(ARM * 1.25, 0.06, 0.04), 0.015, rot=(0, ang, 0))
        m.cyl(f"rotor_{k}", RUBBER, (0, -0.04, 0), 0.06, 0.09)
        m.cyl(f"rotor_{k}", HV, (0, 0.012, 0), 0.03, 0.03, outline=0)
        m.box(f"rotor_{k}", STEEL, (0, 0.02, 0), (0.4, 0.012, 0.05), 0.0, outline=0.5)
        m.box(f"rotor_{k}", STEEL, (0, 0.02, 0), (0.05, 0.012, 0.34), 0.0, outline=0.5)
    m.box("tape0", HV, o(0, 0, -0.05), sz(0.035, 0.01, 0.11), 0.0)
    m.box("tape1", HV, o(0, 0, -0.05), sz(0.035, 0.01, 0.11), 0.0)
    m.box("tape1", STEEL, o(0, 0, -0.11), sz(0.05, 0.03, 0.03), 0.005)
    return m


def drone_fly(t: float) -> dict:
    w = 2 * math.pi / 1.2
    s = math.sin(t * w)
    return P({"body": (3 * math.sin(t * w * 2), 0, 4 * s), "tape0": (10 * s, 0, 6 * s), "tape1": (14 * math.sin(t * w - 1), 0, 0), "eye": (0, 6 * math.sin(t * w / 2), 0)}, loc={"hover": (0, 0.05 * s, 0)})


DRONE_AIM = P({"body": (-24, 0, 0), "eye": (14, 0, 0), "tape0": (30, 0, 0), "tape1": (20, 0, 0)}, loc={"hover": (0, 0.22, -0.15)})
DRONE_DIVE = P({"body": (38, 0, 0), "eye": (-10, 0, 0), "tape0": (-60, 0, 0), "tape1": (-30, 0, 0)}, loc={"hover": (0, -0.3, 0.5)}, scale=(0.92, 0.92, 1.12))


def drone_clips() -> list[Clip]:
    return [
        Clip("fly", 1.2, lambda t: drone_fly(t / 1000), loop=True),
        Clip("attack", 1.1, lambda t: keyed([(0, drone_fly(0)), (400, DRONE_AIM, ease_out), (500, DRONE_AIM), (700, DRONE_DIVE, ease_in), (800, DRONE_DIVE), (1100, drone_fly(0))], t), events={"windup": 0, "active": 500, "recovery": 800}),
        Clip("hurt", 0.25, lambda t: keyed([(0, drone_fly(0)), (60, P({"body": (-20, 0, 25)}, loc={"hover": (0, 0.08, -0.1)}), ease_out), (250, drone_fly(0))], t)),
        Clip("death", 1.0, lambda t: keyed([(0, drone_fly(0)), (150, P({"body": (-20, 0, 40)}, loc={"hover": (0, 0.1, 0)})), (800, P({"body": (60, 200, 90), "tape0": (90, 0, 0)}, loc={"hover": (0, -0.72, 0.2)}), ease_in), (900, P({"body": (70, 210, 90)}, loc={"hover": (0, -0.66, 0.2)}), ease_out), (1000, P({"body": (70, 210, 90)}, loc={"hover": (0, -0.7, 0.2)}))], t)),
        Clip("spawn", 0.6, lambda t: keyed([(0, merge(drone_fly(0), loc={"hover": (0, 1.5, 0)}, scale=(0.3, 0.3, 0.3))), (450, merge(drone_fly(0), loc={"hover": (0, -0.08, 0)}), ease_out), (600, drone_fly(0), ease_back)], t)),
    ]
