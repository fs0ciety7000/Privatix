"""Le Discosaure (élite) : port de `prototypes/proto3d/src/discosaure.ts`. T-rex trapu, énorme boule
à facettes vissée sur le dos, chaîne en or, bras minuscules, queue à épines.

Écarts assumés avec le prototype, pour la grammaire de couleurs « Néon & Ballast » (art_director §7.1) :
épines turquoise (le magenta est réservé aux télégraphes), ventre crème au lieu de rose.
La boule (os `disco_ball`) est un matériau séparé `mirror` : facettes plates, identifiant de facette
dans COLOR_0.r. Sa rotation n'est PAS dans les clips : le jeu la fait tourner (`RUNTIME_BONES`).
"""
from __future__ import annotations

import math

import numpy as np

from ..geo import Model
from ..poses import P, Clip, ease_back, ease_in, ease_out, keyed, lerp_pose, merge

RUNTIME_BONES = ("disco_ball",)
STOMP_WINDUP, STOMP_ACTIVE, STOMP_RECOVER = 1050, 160, 900
CHARGE_WINDUP = 950

HIDE, HIDE_DARK, BELLY, GOLD, SPIKE = 0x7A2FD8, 0x4A1A9A, 0xF5D9B0, 0xFFC83A, 0x19C3B1
BALL_R = 1.08


def _ball_tiles(cols: int = 30, rows: int = 16, r: float = BALL_R, inset: float = 0.14):
    """Carreaux plats d'une sphère latitude/longitude, rétrécis vers leur centre (joints sombres)."""
    V, F = [], []

    def pt(i, j):
        th = math.pi * j / rows  # 0 = pôle haut
        ph = 2 * math.pi * i / cols
        return np.array([r * math.sin(th) * math.sin(ph), r * math.cos(th), r * math.sin(th) * math.cos(ph)])

    for j in range(rows):
        for i in range(cols):
            if j == 0:
                corners = [pt(i, 0), pt(i, 1), pt(i + 1, 1)]
            elif j == rows - 1:
                corners = [pt(i, j), pt(i, j + 1), pt(i + 1, j)]
            else:
                corners = [pt(i, j), pt(i, j + 1), pt(i + 1, j + 1), pt(i + 1, j)]
            c = np.mean(corners, axis=0)
            s = len(V)
            for p in corners:
                q = c + (p - c) * (1 - inset)
                V.append(q)
            f = tuple(range(s, s + len(corners)))
            # orientation sortante
            p0, p1, p2 = (np.array(V[k]) for k in f[:3])
            if np.dot(np.cross(p1 - p0, p2 - p0), c) < 0:
                f = tuple(reversed(f))
            F.append(f)
    return np.array(V), F


def model() -> Model:
    m = Model("discosaure")
    m.joint("root", None, (0, 0, 0))
    m.joint("pelvis", "root", (0, 2.0, 0))
    m.joint("chest", "pelvis", (0, 0.45, 1.3))
    m.joint("neck", "chest", (0, 0.4, 0.75))
    m.joint("head", "neck", (0, 0.35, 0.45))
    m.joint("jaw", "head", (0, -0.05, 0.25))
    for s, sx in (("L", 1), ("R", -1)):
        m.joint(f"hip_{s}", "pelvis", (0.8 * sx, -0.05, 0.05))
        m.joint(f"knee_{s}", f"hip_{s}", (0, -0.95, 0.4))
        m.joint(f"ankle_{s}", f"knee_{s}", (0, -0.78, -0.42))
        m.joint(f"toe_{s}", f"ankle_{s}", (0, -0.1, 0.55))
        m.joint(f"arm_{s}", "chest", (0.62 * sx, -0.3, 0.5))
        m.joint(f"fore_{s}", f"arm_{s}", (0, -0.32, 0.05))
    m.joint("tail0", "pelvis", (0, 0.15, -0.95))
    m.joint("tail1", "tail0", (0, -0.05, -0.85))
    m.joint("tail2", "tail1", (0, -0.03, -0.75))
    m.joint("tail3", "tail2", (0, -0.02, -0.6))
    m.joint("tail4", "tail3", (0, -0.01, -0.45))
    m.joint("disco_ball", "pelvis", (0, 1.5, 0.35))
    m.socket("socket_vfx", "pelvis", (0, 1.5, 0.35))
    m.socket("socket_head", "head", (0, 0.6, 0.3))
    m.socket("socket_jaw", "jaw", (0, -0.1, 1.2))
    m.meta = {"kind": "elite", "height": 3.6, "radius": 1.35, "outline": 0x06302C, "rim": 0x6FF3FF}

    # Corps : gros tonneau violet, ventre crème
    m.sphere("pelvis", HIDE, (0, 0.2, 0.25), (1.15, 1.05, 1.45), seg=22)
    m.sphere("pelvis", BELLY, (0, -0.2, 0.55), (0.95, 0.8, 1.15), seg=20)
    m.sphere("chest", HIDE, (0, 0.0, 0.1), (0.95, 0.9, 0.95), seg=20)
    m.sphere("chest", BELLY, (0, -0.25, 0.35), (0.75, 0.65, 0.65), seg=18)
    m.sphere("neck", HIDE, (0, 0.05, 0.1), (0.62, 0.62, 0.7), seg=18)
    # bandes du ventre (lecture des volumes)
    for i in range(4):
        m.torus("pelvis", 0xE2BE8E, (0, -0.32 + i * 0.02, 0.2 + i * 0.32), 0.62 - abs(i - 1.5) * 0.08, 0.035, rot=(90 + 30, 0, 0), radial=6, tubular=24, outline=0)
    # rayures sombres sur les flancs
    for i in range(4):
        for sx in (1, -1):
            m.box("pelvis", HIDE_DARK, (sx * (1.02 - abs(i - 1.5) * 0.06), 0.45, -0.55 + i * 0.42), (0.12, 0.5, 0.16), 0.05, rot=(0, 0, -sx * 25), outline=0)
    # Tête : crâne, museau, mâchoire, yeux lumineux, arcades
    m.sphere("head", HIDE, (0, 0.22, 0.15), (0.74, 0.62, 0.78), seg=18)
    m.box("head", HIDE, (0, 0.1, 1.0), (0.9, 0.48, 1.35), 0.22)
    m.box("head", HIDE_DARK, (0, 0.38, 0.5), (0.95, 0.18, 0.42), 0.08)  # arcades
    for i in range(3):
        m.box("head", HIDE_DARK, (0, 0.36 - i * 0.02, 0.95 + i * 0.3), (0.5 - i * 0.08, 0.06, 0.14), 0.03, outline=0)
    m.box("jaw", BELLY, (0, -0.15, 0.7), (0.82, 0.26, 1.3), 0.12)
    m.box("jaw", 0x3A0820, (0, -0.03, 0.7), (0.7, 0.06, 1.18), 0.03, outline=0)
    for i in range(5):
        for sx in (1, -1):
            z = 0.45 + i * 0.22
            m.cone("head", 0xFFF6E8, (sx * 0.37, -0.13, z), 0.05, 0.14, rot=(180, 0, 0), seg=6, outline=0.6)
            m.cone("jaw", 0xFFF6E8, (sx * 0.32, 0.02, z + 0.1), 0.045, 0.12, seg=6, outline=0.6)
    for sx in (1, -1):
        m.sphere("head", 0x6FF3FF, (0.43 * sx, 0.36, 0.6), (0.077, 0.11, 0.088), mat="glow", outline=0, seg=12)
        m.sphere("head", 0x14101A, (0.47 * sx, 0.37, 0.62), (0.03, 0.06, 0.04), outline=0, seg=8)
        m.sphere("head", HIDE_DARK, (0.2 * sx, 0.3, 1.6), (0.07, 0.05, 0.06), outline=0, seg=8)  # narines
    # Chaîne en or au cou + médaille
    m.torus("neck", GOLD, (0, -0.12, 0.1), 0.66, 0.06, rot=(math.degrees(math.pi / 2 - 0.5), 0, 0), radial=8, tubular=28, emit=0.25)
    m.cyl("neck", GOLD, (0, -0.55, 0.62), 0.17, 0.05, rot=(90, 0, 0), seg=16, emit=0.25)
    m.shape("neck", 0xFFF2B0, (0, -0.55, 0.65), [(math.cos(a) * r, math.sin(a) * r) for k in range(10) for a, r in [(math.pi / 2 + k * math.pi / 5, 0.11 if k % 2 == 0 else 0.05)]], 0.02, outline=0, emit=0.5)
    # Petits bras griffus (gag)
    for s in ("L", "R"):
        m.capsule(f"arm_{s}", HIDE, (0, 0, 0), (0, -0.32, 0.05), 0.14)
        m.capsule(f"fore_{s}", HIDE, (0, 0, 0), (0, -0.05, 0.3), 0.11)
        for dx in (-0.06, 0.06):
            m.cone(f"fore_{s}", GOLD, (dx, -0.05, 0.42), 0.035, 0.14, rot=(90, 0, 0), seg=6, emit=0.2)
    # Pattes puissantes
    for s in ("L", "R"):
        m.sphere(f"hip_{s}", HIDE, (0, -0.35, 0.15), (0.5, 0.75, 0.62), seg=18)
        m.capsule(f"knee_{s}", HIDE, (0, 0, 0), (0, -0.78, -0.42), 0.24)
        m.box(f"ankle_{s}", HIDE_DARK, (0, -0.08, 0.2), (0.55, 0.28, 0.7), 0.12)
        m.box(f"toe_{s}", HIDE_DARK, (0, 0.02, 0.05), (0.52, 0.2, 0.42), 0.09)
        for dx in (-0.17, 0, 0.17):
            m.cone(f"toe_{s}", GOLD, (dx, -0.02, 0.33), 0.075, 0.26, rot=(90, 0, 0), seg=6, emit=0.2)
    # Queue avec épines turquoise
    tail_r = [0.5, 0.38, 0.26, 0.17, 0.1]
    tail_l = [0.85, 0.75, 0.6, 0.45, 0.35]
    for i in range(5):
        L = tail_l[i]
        m.capsule(f"tail{i}", HIDE, (0, 0, 0), (0, -0.03, -L), tail_r[i], tail_r[i + 1] if i < 4 else 0.06)
        m.cone(f"tail{i}", SPIKE, (0, tail_r[i] + 0.05, -L * 0.5), 0.11 * (1 - i * 0.16), 0.32 * (1 - i * 0.14), rot=(-23, 0, 0), seg=6, emit=0.35)
    for i in range(3):
        m.cone("chest", SPIKE, (0, 0.78, -0.25 + i * 0.36), 0.13, 0.4, rot=(20, 0, 0), seg=6, emit=0.35)
    # Socle doré de la boule (fixe, sur le bassin)
    m.torus("pelvis", GOLD, (0, 1.5 - 0.82, 0.35), 0.62, 0.11, rot=(90, 0, 0), radial=10, tubular=28, emit=0.25)
    m.cyl("pelvis", GOLD, (0, 1.5 - 0.98, 0.35), 0.4, 0.35, rb=0.6, seg=18, emit=0.25)
    # Boule à facettes : âme sombre (joints) + carreaux miroirs plats
    m.sphere("disco_ball", 0x0C0A14, (0, 0, 0), (BALL_R * 0.985,) * 3, seg=20)
    V, F = _ball_tiles()
    m.custom("disco_ball", 0xFFFFFF, V, F, mat="mirror", outline=0, flat=True, facet_ids=True)
    return m


# ─── Poses (port du prototype) ──────────────────────────────────────────────────

IDLE_T = 4.0


def idle(t: float) -> dict:
    w = 2 * math.pi / IDLE_T
    b = math.sin(t * w * 1.5)
    sway = math.sin(t * w)
    return P(
        {
            "pelvis": (4 + b * 1.5, 0, 0), "chest": (2, 0, 0),
            "neck": (-8 - b * 3, sway * 8, 0), "head": (6 + b * 2, sway * 6, 0),
            "jaw": (6 + max(0, math.sin(t * w * 2)) * 8, 0, 0),
            "arm_L": (30 + b * 6, 0, 10), "arm_R": (30 - b * 6, 0, -10), "fore_L": (-20, 0, 0), "fore_R": (-20, 0, 0),
            "hip_L": (-8, 0, 4), "hip_R": (6, 0, -4), "knee_L": (-4, 0, 0), "ankle_L": (12, 0, 0), "ankle_R": (-6, 0, 0),
            "tail0": (8 + b * 2, sway * 6, 0), "tail1": (4, sway * 10, 0), "tail2": (-4, sway * 14, 0), "tail3": (-8, sway * 18, 0), "tail4": (-6, sway * 20, 0),
        },
        root=(0, -0.04 + b * 0.03, 0),
        scale=(1 + b * 0.015, 1 - b * 0.012, 1 + b * 0.015),
    )


def walk(ph: float) -> dict:
    s, c = math.sin(ph), math.cos(ph)
    return P(
        {
            "pelvis": (8, 6 * s, 4 * s), "chest": (0, -6 * s, 0), "neck": (-6, 4 * s, 0), "head": (4, 4 * s, 0), "jaw": (8, 0, 0),
            "arm_L": (30 + 14 * s, 0, 10), "arm_R": (30 - 14 * s, 0, -10), "fore_L": (-24, 0, 0), "fore_R": (-24, 0, 0),
            "hip_L": (-26 * s, 0, 3), "knee_L": (10 * max(0, c), 0, 0), "ankle_L": (26 * s - 10 * max(0, c), 0, 0), "toe_L": (-12 * max(0, -s), 0, 0),
            "hip_R": (26 * s, 0, -3), "knee_R": (10 * max(0, -c), 0, 0), "ankle_R": (-26 * s - 10 * max(0, -c), 0, 0), "toe_R": (-12 * max(0, s), 0, 0),
            "tail0": (10, -10 * s, 0), "tail1": (4, -8 * s, 0), "tail2": (-4, -6 * s, 0), "tail3": (-6, -4 * s, 0), "tail4": (-4, -4 * s, 0),
        },
        root=(0, -0.06 + 0.12 * abs(c), 0),
    )


def run(ph: float) -> dict:
    s, c = math.sin(ph), math.cos(ph)
    return P(
        {
            "pelvis": (20, 4 * s, 0), "chest": (8, 0, 0), "neck": (16, 0, 0), "head": (10, 0, 0), "jaw": (26, 0, 0),
            "arm_L": (70, 0, 10), "arm_R": (70, 0, -10),
            "hip_L": (-44 * s, 0, 3), "knee_L": (20 * max(0, c), 0, 0), "ankle_L": (40 * s, 0, 0),
            "hip_R": (44 * s, 0, -3), "knee_R": (20 * max(0, -c), 0, 0), "ankle_R": (-40 * s, 0, 0),
            "tail0": (-6, 0, 0), "tail1": (-4, 0, 0), "tail2": (-2, 0, 0), "tail3": (0, 0, 0),
        },
        root=(0, -0.12 + 0.2 * abs(c), 0),
        scale=(0.95, 1, 1.08),
    )


def rear(k: float) -> dict:
    return P(
        {
            "pelvis": (-26 - 4 * k, 0, 0), "chest": (-10, 0, 0), "neck": (-28, 0, 0), "head": (-16, 0, 0), "jaw": (42, 0, 0),
            "arm_L": (-50, 0, 30), "arm_R": (-50, 0, -30), "fore_L": (-40, 0, 0), "fore_R": (-40, 0, 0),
            "hip_L": (10, 0, 6), "knee_L": (10, 0, 0), "ankle_L": (6, 0, 0),
            "hip_R": (-70, 0, -6), "knee_R": (-20, 0, 0), "ankle_R": (60, 0, 0),
            "tail0": (26, 0, 0), "tail1": (12, 0, 0), "tail2": (4, 0, 0), "tail3": (0, 0, 0),
        },
        root=(0, 0.25 + 0.05 * k, -0.3),
        scale=(0.96, 1.06, 0.96),
    )


STOMP = P(
    {
        "pelvis": (16, 0, 0), "chest": (6, 0, 0), "neck": (14, 0, 0), "head": (12, 0, 0), "jaw": (30, 0, 0),
        "arm_L": (60, 0, 20), "arm_R": (60, 0, -20),
        "hip_L": (10, 0, 8), "knee_L": (10, 0, 0), "ankle_L": (-10, 0, 0),
        "hip_R": (-26, 0, -8), "knee_R": (16, 0, 0), "ankle_R": (10, 0, 0),
        "tail0": (-10, 0, 0), "tail1": (-6, 0, 0),
    },
    root=(0, -0.32, 0.25),
    scale=(1.12, 0.86, 1.12),
)


def paw(t: float, k: float) -> dict:
    s = math.sin(t * 16)
    return P(
        {
            "pelvis": (18 + k * 6, 0, 0), "chest": (6, 0, 0), "neck": (22, 0, 0), "head": (12, 0, 0), "jaw": (12 + k * 18, 0, 0),
            "arm_L": (50, 0, 14), "arm_R": (50, 0, -14),
            "hip_L": (-20, 0, 4), "knee_L": (16, 0, 0), "hip_R": (10 + s * 18, 0, -4), "knee_R": (10, 0, 0), "ankle_R": (-s * 20, 0, 0),
            "tail0": (-14, 0, 0), "tail1": (-8, 0, 0),
        },
        root=(0, -0.2, -0.3 * k),
        scale=(1.04, 0.95, 1.04),
    )


def dizzy(t: float) -> dict:
    w = 2 * math.pi / 1.2
    return P(
        {
            "pelvis": (-6, 0, math.sin(t * w) * 5), "neck": (-10, math.sin(t * w * 2) * 20, math.sin(t * w) * 10),
            "head": (-6, math.sin(t * w * 2 + 1) * 14, 0), "jaw": (24, 0, 0),
            "arm_L": (10, 0, 30), "arm_R": (10, 0, -30), "hip_L": (-10, 0, 8), "hip_R": (10, 0, -8), "tail0": (4, 0, 0),
        },
        root=(0, -0.15, 0),
    )


DEAD = P(
    {
        "root": (0, 0, 84), "neck": (-30, 0, 20), "head": (-20, 0, 10), "jaw": (50, 0, 0),
        "arm_L": (-60, 0, 50), "arm_R": (-60, 0, -50), "hip_L": (-40, 0, 30), "hip_R": (-10, 0, -10), "knee_L": (30, 0, 0),
        "tail0": (20, 0, 0), "tail1": (10, 0, 0),
    },
    root=(1.7, 0.85, 0),
    scale=(1.08, 0.9, 1.0),
)


def stomp(t: float) -> dict:
    W, A, R = STOMP_WINDUP, STOMP_ACTIVE, STOMP_RECOVER
    return keyed([(0, idle(0)), (W * 0.45, rear(0), ease_out), (W, rear(1)), (W + A * 0.5, STOMP, ease_in), (W + A + R * 0.4, merge(STOMP, root=(0, -0.28, 0.25))), (W + A + R, idle(0))], t)


def death(t: float) -> dict:
    wobble = merge(dizzy(0.3), scale=(1.05, 0.95, 1.05))
    return keyed([(0, idle(0)), (300, wobble, ease_out), (700, merge(DEAD, root=(1.7, 1.2, 0)), ease_in), (820, merge(DEAD, scale=(1.18, 0.8, 1.08)), ease_out), (1000, DEAD), (1600, merge(DEAD, scale=(1.12, 0.72, 1.06)))], t)


def spawn(t: float) -> dict:
    curled = merge(STOMP, rot={"neck": (40, 0, 0), "head": (30, 0, 0), "tail0": (30, 0, 0), "tail1": (30, 0, 0), "tail2": (30, 0, 0)}, root=(0, -0.6, 0), scale=(0.8, 0.6, 0.8))
    return keyed([(0, curled), (500, curled), (900, rear(1), ease_out), (1150, STOMP, ease_in), (1500, idle(0), ease_back)], t)


def clips() -> list[Clip]:
    return [
        Clip("idle", IDLE_T, lambda t: idle(t / 1000), loop=True),
        Clip("walk", 1.2, lambda t: walk(2 * math.pi * t / 1200), loop=True),
        Clip("attack-stomp", (STOMP_WINDUP + STOMP_ACTIVE + STOMP_RECOVER) / 1000, stomp, events={"windup": 0, "active": STOMP_WINDUP, "recovery": STOMP_WINDUP + STOMP_ACTIVE}),
        Clip("charge-windup", CHARGE_WINDUP / 1000, lambda t: lerp_pose(idle(0), paw(t / 1000, min(1, t / CHARGE_WINDUP)), min(1, t / 200)), events={"windup": 0, "active": CHARGE_WINDUP}),
        Clip("charge", 0.6, lambda t: run(2 * math.pi * t / 600), loop=True),
        Clip("stagger", 1.2, lambda t: dizzy(t / 1000), loop=True),
        Clip("hurt", 0.35, lambda t: keyed([(0, idle(0)), (90, merge(rear(0), scale=(1.06, 0.94, 1.06)), ease_out), (350, idle(0))], t)),
        Clip("death", 1.6, death),
        Clip("spawn", 1.5, spawn, events={"land": 1150}),
    ]
