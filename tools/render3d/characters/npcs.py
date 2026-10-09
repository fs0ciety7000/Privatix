"""PNJ de l'OCC (hub) : huit personnages, une direction (`down`), anim `idle` (respiration + geste
caractéristique). Silhouettes et couleurs volontairement distinctes, aucune dominante turquoise
(réservée aux ennemis) ni magenta (réservé au danger).

  marcel   conducteur retraité : casquette de conduite, moustache blanche, gilet beige, canne
  fatou    prévention : chignon, gilet vert, fiole verte lumineuse qu'elle agite
  yasmina  régulatrice : casque audio + micro, veste bleue, queue de cheval
  kevin    technicien caténaires : casque blanc, gilet jaune HV, grosse pince
  bene     guichetière : gilet violet, lunettes, tampon qu'elle abat
  josiane  accompagnatrice : uniforme rouge, calot, carré blond, sifflet
  rudy     chef de quai : casquette à haut bandeau rouge, manteau marine, palette de départ verte
  jeanmi   barista : bonnet, barbe, tablier marron, tasse fumante
"""
from __future__ import annotations

import math
from types import SimpleNamespace

from rig import Builder, Character

from .common import keyed, merge, pose
from .humanoid import Body, arm_ik, base_pose, build_body, point_hand

SKIN, HELMET, VEST, STRIPE, NAVY, BOOTS, STEEL, RED, EYES, PUFF, HAIR = 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12
SHIRT, PAPER, GLASS, RED2, GOLD, VIAL, WHITE_HAIR, DARK_SKIN, MATE_SKIN = 21, 30, 33, 34, 38, 39, 40, 41, 42
GREEN, BLUE, HIVIS, VIOLET, BROWN, BEIGE, GREY, RUBBER = 43, 44, 45, 46, 47, 48, 49, 50

FRAME = 64
PIVOT = (32, 56)
PX_PER_UNIT = 30.0
CATEGORY = "npcs"
DUR = [240, 180, 160, 160, 180, 260]


def _body(**kw) -> Body:
    base = dict(
        pelvis_z=0.6, spine=0.1, chest=0.15, neck=0.26, shoulder_w=0.26, shoulder_z=0.15, upper=0.2, fore=0.18,
        hip_w=0.1, thigh=0.28, shin=0.27, head_r=(0.235, 0.215, 0.235), chest_box=(0.46, 0.29, 0.34),
        belly_box=(0.36, 0.24, 0.16), hips_box=(0.36, 0.23, 0.16), arm_r=0.072, fore_r=0.066, hand_r=0.08,
        thigh_r=0.09, shin_r=0.078, shoe=(0.15, 0.25, 0.11),
    )
    base.update(kw)
    return Body(**base)


def _hair_cap(b: Builder, mid: int, front: float = -0.02, back: float = 0.07):
    """Cheveux : calotte haute (laisse le front et les yeux visibles depuis la caméra à 40°)."""
    b.sphere("hair_back", "head", mid, (0, back, 0.18), (0.235, 0.18, 0.19), 12)
    b.sphere("hair_top", "head", mid, (0, front, 0.33), (0.215, 0.2, 0.1), 12)


def _breath(t: float, extra: dict | None = None):
    p = base_pose(t, 1.0, extra)
    hx, hy, hz = p["rot"]["head"]
    p["rot"]["head"] = (hx - 7, hy, hz)  # regard relevé vers le joueur : visage lisible
    return p


def _gesture(keys: list[tuple[int, dict]], i: int, n: int):
    """Poses clés du geste (rotations ajoutées sur la respiration)."""
    t = i / n
    p = _breath(t)
    for (fa, ra), (fb, rb) in zip(keys, keys[1:]):
        if fa <= i <= fb:
            u = 0.0 if fb == fa else (i - fa) / (fb - fa)
            u = u * u * (3 - 2 * u)
            rot = {k: tuple(x + (y - x) * u for x, y in zip(ra.get(k, p["rot"].get(k, (0, 0, 0))), rb.get(k, p["rot"].get(k, (0, 0, 0))))) for k in set(ra) | set(rb)}
            return _relhead(merge(p, rot), p)
    return _relhead(merge(p, keys[-1][1]), p)


def _relhead(q, p):
    """Les gestes donnent la tête sans le regard relevé : on le réapplique (−7° en X)."""
    hx, hy, hz = q["rot"]["head"]
    if (hx, hy, hz) != p["rot"]["head"]:
        q["rot"]["head"] = (hx - 7, hy, hz)
    return q


# ─── Marcel ───────────────────────────────────────────────────────────────────
M_BODY = _body(top=BEIGE, pants=GREY, shoes=BOOTS, belly_box=(0.4, 0.27, 0.17), chest_box=(0.46, 0.3, 0.33))


def build_marcel() -> Character:
    b = Builder("marcel")
    build_body(b, M_BODY)
    b.box("shirt", "chest", SHIRT, (0, -0.135, 0.16), (0.12, 0.04, 0.12), 0.02)
    for k in range(3):
        b.sphere(f"btn_{k}", "chest", BROWN, (0, -0.15, 0.08 - k * 0.08), (0.018, 0.012, 0.018), 6)
    b.sphere("side_L", "head", WHITE_HAIR, (0.2, 0.05, 0.14), (0.07, 0.13, 0.09), 8)
    b.sphere("side_R", "head", WHITE_HAIR, (-0.2, 0.05, 0.14), (0.07, 0.13, 0.09), 8)
    b.sphere("hair_back", "head", WHITE_HAIR, (0, 0.1, 0.13), (0.2, 0.12, 0.12), 10)
    # Grosse moustache blanche en guidon
    b.sphere("must_L", "head", WHITE_HAIR, (0.065, -0.205, 0.07), (0.08, 0.04, 0.035), 8)
    b.sphere("must_R", "head", WHITE_HAIR, (-0.065, -0.205, 0.07), (0.08, 0.04, 0.035), 8)
    # Casquette de conducteur : bandeau, calotte plate, visière, insigne doré
    b.cylinder("cap_band", "head", NAVY, (0, 0.02, 0.33), 0.235, 0.08)
    b.cylinder("cap_top", "head", NAVY, (0, 0.05, 0.39), 0.27, 0.06)
    b.box("cap_visor", "head", RUBBER, (0, -0.22, 0.31), (0.28, 0.1, 0.022), 0.01, rot=(-24, 0, 0))
    b.box("cap_badge", "head", GOLD, (0, -0.22, 0.36), (0.07, 0.02, 0.05), 0.01)
    # Canne (main gauche)
    b.cylinder("cane", "hand_L", BROWN, (0.0, -0.02, -0.28), 0.02, 0.5)
    b.cylinder("cane_grip", "hand_L", BROWN, (0, -0.06, -0.02), 0.022, 0.12, rot=(90, 0, 0))
    return b.build()


def idle_marcel(i: int, n: int):
    stoop = {"spine": (6, 0, 0), "head": (-12, 0, 0), "shoulder_L": (-14, 0, -6), "elbow_L": (-20, 0, 0), "hand_L": (14, 0, 0)}
    rest = {**stoop, **arm_ik(M_BODY, "R", (-0.2, -0.08, -0.25), 10)}
    must = {**stoop, "head": (-16, 0, 6), **arm_ik(M_BODY, "R", (-0.04, -0.32, 0.42), 30)}
    twirl = {**stoop, "head": (-18, 0, 10), **arm_ik(M_BODY, "R", (-0.08, -0.33, 0.44), 40)}
    return _gesture([(0, rest), (1, rest), (2, must), (3, twirl), (4, must), (5, rest)], i, n)


# ─── Fatou ────────────────────────────────────────────────────────────────────
F_BODY = _body(skin=DARK_SKIN, top=GREEN, sleeves=SHIRT, pants=NAVY, shoes=BOOTS, chest_box=(0.44, 0.28, 0.33), shoulder_w=0.25)


def build_fatou() -> Character:
    b = Builder("fatou")
    build_body(b, F_BODY)
    b.box("tee", "chest", SHIRT, (0, -0.13, 0.16), (0.16, 0.04, 0.12), 0.02)
    b.box("vest_stripe", "chest", STRIPE, (0, 0, 0.0), (0.47, 0.3, 0.03), 0.01)
    b.box("cross", "chest", SHIRT, (0.12, -0.15, 0.12), (0.06, 0.012, 0.02), 0.0)
    b.box("cross2", "chest", SHIRT, (0.12, -0.15, 0.12), (0.02, 0.012, 0.06), 0.0)
    _hair_cap(b, HAIR, front=-0.02)
    b.sphere("bun", "head", HAIR, (0, 0.08, 0.45), (0.14, 0.13, 0.12), 12)
    b.box("hairband", "head", GREEN, (0, 0.06, 0.37), (0.16, 0.12, 0.04), 0.01)
    # Fiole (main droite) : verre + liquide vert lumineux + bouchon
    b.sphere("vial_liquid", "hand_R", VIAL, (0, -0.03, -0.15), (0.065, 0.065, 0.075), 10)
    b.cylinder("vial_neck", "hand_R", GLASS, (0, -0.03, -0.06), 0.03, 0.08)
    b.cylinder("vial_cork", "hand_R", BROWN, (0, -0.03, -0.01), 0.032, 0.04)
    return b.build()


def idle_fatou(i: int, n: int):
    hip = {"shoulder_L": (-10, 0, -8), "elbow_L": (-60, 0, 0), "hand_L": (0, 0, 0), "spine": (-4, 0, 4)}
    def held(target, tilt):
        r = arm_ik(F_BODY, "R", target, 20)
        return {**r, **point_hand(r, "R", (math.sin(math.radians(tilt)), -0.25, math.cos(math.radians(tilt))))}

    hold = {**hip, **held((-0.16, -0.3, 0.1), 0)}
    look = {**hip, "head": (-3, 0, -14), **held((-0.18, -0.34, 0.36), 0)}
    shake = {**hip, "head": (-5, 0, -16), **held((-0.24, -0.34, 0.37), 30)}
    shake2 = {**hip, "head": (-5, 0, -16), **held((-0.12, -0.34, 0.39), -30)}
    return _gesture([(0, hold), (1, look), (2, shake), (3, shake2), (4, look), (5, hold)], i, n)


# ─── Yasmina ──────────────────────────────────────────────────────────────────
Y_BODY = _body(skin=MATE_SKIN, top=BLUE, pants=GREY, shoes=BOOTS, chest_box=(0.44, 0.28, 0.34), shoulder_w=0.25)


def build_yasmina() -> Character:
    b = Builder("yasmina")
    build_body(b, Y_BODY)
    b.joint("tail0", "head", (0, 0.2, 0.26))
    b.joint("tail1", "tail0", (0, 0.0, -0.14))
    b.box("collar", "chest", SHIRT, (0, -0.1, 0.21), (0.22, 0.14, 0.05), 0.02)
    b.box("badge", "chest", SHIRT, (0.12, -0.15, 0.08), (0.07, 0.012, 0.09), 0.0)
    b.box("zip", "chest", BLUE, (0, -0.15, 0.06), (0.02, 0.012, 0.3), 0.0)
    _hair_cap(b, HAIR, front=-0.03)
    b.sphere("tail_a", "tail0", HAIR, (0, 0.03, -0.05), (0.08, 0.08, 0.1), 8)
    b.sphere("tail_b", "tail1", HAIR, (0, 0.02, -0.08), (0.065, 0.065, 0.12), 8)
    # Casque audio (arceau + coques) et micro
    b.box("hs_band", "head", RUBBER, (0, 0.0, 0.36), (0.5, 0.06, 0.05), 0.02)
    for sx in (1, -1):
        b.box(f"hs_post_{sx}", "head", RUBBER, (0.245 * sx, 0, 0.27), (0.04, 0.05, 0.16), 0.01)
        b.cylinder(f"hs_cup_{sx}", "head", RUBBER, (0.245 * sx, 0, 0.15), 0.08, 0.07, rot=(0, 90, 0))
        b.cylinder(f"hs_pad_{sx}", "head", HELMET, (0.285 * sx, 0, 0.15), 0.04, 0.02, rot=(0, 90, 0))
    b.box("mic_arm", "head", RUBBER, (0.19, -0.12, 0.09), (0.025, 0.2, 0.025), 0.0, rot=(0, 0, 25))
    b.sphere("mic", "head", RUBBER, (0.12, -0.23, 0.07), (0.035, 0.035, 0.035), 6)
    return b.build()


def idle_yasmina(i: int, n: int):
    t = i / n
    sw = math.sin(2 * math.pi * t)
    base = {"tail0": (30 + 6 * sw, 0, 10 * sw), "tail1": (10 + 10 * math.sin(2 * math.pi * t + 1), 0, 8 * sw), "shoulder_R": (-6, 0, 0), "elbow_R": (-30, 0, 0)}
    listen = {**base, **arm_ik(Y_BODY, "L", (0.3, -0.06, 0.38), -10), "head": (0, -8, 0)}
    talk = {**base, **arm_ik(Y_BODY, "L", (0.3, -0.06, 0.38), -10), "head": (-4, -10, 8), **arm_ik(Y_BODY, "R", (-0.1, -0.36, 0.16), 20)}
    point = {**base, **arm_ik(Y_BODY, "L", (0.3, -0.06, 0.38), -10), "head": (-2, -6, -10), "shoulder_R": (-80, 0, 30), "elbow_R": (-10, 0, 0)}
    return _gesture([(0, listen), (1, talk), (2, point), (3, point), (4, talk), (5, listen)], i, n)


# ─── Kevin ────────────────────────────────────────────────────────────────────
K_BODY = _body(top=HIVIS, sleeves=NAVY, pants=NAVY, shoes=BOOTS, chest_box=(0.52, 0.32, 0.35), shoulder_w=0.29, arm_r=0.08, fore_r=0.074, hand_r=0.088, hands=BOOTS, shoulder_pad=0.11, pad=HIVIS)


def build_kevin() -> Character:
    b = Builder("kevin")
    build_body(b, K_BODY)
    b.box("stripe_lo", "chest", STRIPE, (0, 0, -0.02), (0.53, 0.33, 0.03), 0.01)
    b.box("stripe_hi", "chest", STRIPE, (0, 0, 0.1), (0.53, 0.33, 0.03), 0.01)
    b.box("tool_belt", "spine", BROWN, (0, 0, -0.02), (0.4, 0.27, 0.06), 0.02)
    b.box("pouch", "spine", BROWN, (0.17, -0.12, -0.06), (0.09, 0.06, 0.1), 0.02)
    # Casque blanc à visière + barbe de trois jours
    for part in (
        b.sphere("helmet", "head", SHIRT, (0, 0.02, 0.3), (0.25, 0.26, 0.15), 18),
        b.cylinder("brim", "head", SHIRT, (0, -0.02, 0.3), 0.265, 0.03),
        b.box("ridge", "head", SHIRT, (0, 0.02, 0.41), (0.06, 0.34, 0.06), 0.02),
    ):
        part["no_shadow"] = True
    b.sphere("stubble", "head", HAIR, (0, -0.09, 0.05), (0.19, 0.14, 0.09), 10)
    # Grosse pince (main droite) : mâchoires acier, manches rouges
    b.joint("jaw", "hand_R", (0, -0.02, -0.08))
    b.box("plier_h1", "hand_R", RED2, (0.02, -0.02, 0.06), (0.035, 0.035, 0.18), 0.01)
    b.box("plier_h2", "hand_R", RED2, (-0.02, -0.02, 0.06), (0.035, 0.035, 0.18), 0.01)
    b.box("plier_j1", "jaw", STEEL, (0.025, 0, -0.07), (0.04, 0.04, 0.15), 0.01, rot=(0, -6, 0))
    b.box("plier_j2", "hand_R", STEEL, (-0.025, -0.02, -0.15), (0.04, 0.04, 0.15), 0.01, rot=(0, 6, 0))
    return b.build()


def idle_kevin(i: int, n: int):
    wide = {"hip_L": (-3, 0, -6), "hip_R": (3, 0, 6), "foot_L": (-3, 0, -8), "foot_R": (-9, 0, 8), "shoulder_L": (-10, 0, -10), "elbow_L": (-70, 0, 0)}
    low = {**wide, **arm_ik(K_BODY, "R", (-0.3, -0.12, -0.2), 10), "hand_R": (0, 0, 0), "jaw": (0, 0, 0)}
    up = {**wide, **arm_ik(K_BODY, "R", (-0.22, -0.3, 0.3), 20), "hand_R": (40, 0, 0), "jaw": (0, -25, 0), "head": (-4, 0, -8)}
    snap = {**wide, **arm_ik(K_BODY, "R", (-0.22, -0.32, 0.32), 20), "hand_R": (40, 0, 0), "jaw": (0, 0, 0), "head": (-4, 0, -8)}
    return _gesture([(0, low), (1, up), (2, snap), (3, up), (4, snap), (5, low)], i, n)


# ─── Béné ─────────────────────────────────────────────────────────────────────
B_BODY = _body(skin=MATE_SKIN, top=VIOLET, sleeves=SHIRT, pants=GREY, shoes=BOOTS, belly_box=(0.44, 0.3, 0.18), hips_box=(0.42, 0.27, 0.17), chest_box=(0.47, 0.31, 0.33))


def build_bene() -> Character:
    b = Builder("bene")
    build_body(b, B_BODY)
    b.box("blouse", "chest", SHIRT, (0, -0.14, 0.15), (0.14, 0.04, 0.14), 0.02)
    b.box("nametag", "chest", GOLD, (-0.12, -0.16, 0.09), (0.08, 0.012, 0.03), 0.0)
    # Cheveux courts bouclés (boules) + lunettes et chaînette
    b.sphere("hair_back", "head", BROWN, (0, 0.07, 0.18), (0.24, 0.18, 0.19), 12)
    for k, (x, y, z) in enumerate(((0.12, -0.06, 0.36), (-0.12, -0.06, 0.36), (0.0, -0.1, 0.39), (0.2, 0.02, 0.27), (-0.2, 0.02, 0.27), (0, 0.06, 0.4))):
        b.sphere(f"curl_{k}", "head", BROWN, (x, y, z), (0.11, 0.1, 0.09), 8)
    b.box("glasses", "head", EYES, (0, -0.215, 0.17), (0.3, 0.02, 0.02), 0.0)
    for sx in (1, -1):
        b.box(f"lens_{sx}", "head", EYES, (0.08 * sx, -0.212, 0.155), (0.1, 0.014, 0.05), 0.01)
    # Tampon encreur (main droite) : manche bois, semelle caoutchouc
    b.cylinder("stamp_handle", "hand_R", BROWN, (0, -0.02, -0.04), 0.035, 0.12)
    b.sphere("stamp_knob", "hand_R", BROWN, (0, -0.02, 0.04), (0.05, 0.05, 0.045), 8)
    b.box("stamp_base", "hand_R", RUBBER, (0, -0.02, -0.13), (0.13, 0.1, 0.05), 0.01)
    b.box("stamp_ink", "hand_R", VIOLET, (0, -0.02, -0.16), (0.12, 0.09, 0.012), 0.0)
    # Ticket posé sur la paume gauche
    b.box("ticket", "hand_L", PAPER, (0, -0.04, -0.06), (0.16, 0.12, 0.012), 0.0)
    return b.build()


def idle_bene(i: int, n: int):
    tray = {**arm_ik(B_BODY, "L", (0.12, -0.32, -0.02), 0), "hand_L": (90, 0, 0)}
    def stamp(target, sw=25):
        r = arm_ik(B_BODY, "R", target, sw)
        return {**r, **point_hand(r, "R", (0, -0.15, -1))}

    up = {**tray, **stamp((-0.1, -0.3, 0.32)), "head": (2, 0, 0)}
    high = {**tray, **stamp((-0.06, -0.3, 0.42)), "head": (-2, 0, 0), "spine": (-4, 0, 0)}
    bam = {**tray, **stamp((0.08, -0.34, 0.14)), "head": (8, 0, 0), "spine": (8, 0, 0)}
    rest = {**tray, **stamp((-0.22, -0.14, -0.1), 10), "head": (0, 0, 0)}
    return _gesture([(0, rest), (1, up), (2, high), (3, bam), (4, up), (5, rest)], i, n)


# ─── Josiane ──────────────────────────────────────────────────────────────────
J_BODY = _body(top=RED, pants=NAVY, shoes=BOOTS, chest_box=(0.44, 0.28, 0.34), shoulder_w=0.25, shoulder_pad=0.09)


def build_josiane() -> Character:
    b = Builder("josiane")
    build_body(b, J_BODY)
    b.box("collar", "chest", SHIRT, (0, -0.1, 0.21), (0.22, 0.14, 0.05), 0.02)
    b.box("scarf", "chest", NAVY, (0, -0.15, 0.17), (0.08, 0.03, 0.08), 0.01)
    for k in range(2):
        b.sphere(f"btn_{k}", "chest", GOLD, (0.08, -0.15, 0.08 - k * 0.1), (0.02, 0.012, 0.02), 6)
    # Carré blond + calot rouge
    b.sphere("hair_back", "head", GOLD, (0, 0.06, 0.12), (0.26, 0.2, 0.22), 12)
    b.sphere("hair_top", "head", GOLD, (0, -0.01, 0.31), (0.235, 0.21, 0.11), 12)
    b.sphere("fringe", "head", GOLD, (0.05, -0.15, 0.3), (0.16, 0.06, 0.05), 10)
    b.box("calot", "head", RED, (0.04, 0.02, 0.4), (0.3, 0.13, 0.08), 0.03, rot=(0, -10, 0))
    b.box("calot_band", "head", GOLD, (0.04, -0.06, 0.38), (0.24, 0.012, 0.02), 0.0, rot=(0, -10, 0))
    # Sifflet au bout d'un cordon
    b.joint("whistle", "chest", (0.0, -0.16, 0.2))
    b.box("cord", "whistle", SHIRT, (0, 0, -0.06), (0.012, 0.012, 0.12), 0.0)
    b.box("whistle_body", "whistle", STEEL, (0, -0.02, -0.13), (0.07, 0.04, 0.04), 0.01)
    return b.build()


def idle_josiane(i: int, n: int):
    behind = {"shoulder_L": (12, 0, -6), "elbow_L": (-30, 0, 0)}
    rest = {**behind, **arm_ik(J_BODY, "R", (-0.2, -0.1, -0.2), 10), "whistle": (0, 0, 0)}
    lift = {**behind, **arm_ik(J_BODY, "R", (-0.06, -0.3, 0.3), 30), "whistle": (-60, 0, 0), "head": (-4, 0, 0)}
    blow = {**behind, **arm_ik(J_BODY, "R", (-0.04, -0.3, 0.38), 30), "whistle": (-100, 0, 0), "head": (-10, 0, 0), "spine": (-6, 0, 0)}
    return _gesture([(0, rest), (1, lift), (2, blow), (3, blow), (4, lift), (5, rest)], i, n)


# ─── Rudy ─────────────────────────────────────────────────────────────────────
R_BODY = _body(skin=DARK_SKIN, top=NAVY, pants=NAVY, shoes=BOOTS, pelvis_z=0.64, thigh=0.3, shin=0.29, chest_box=(0.48, 0.3, 0.36), shoulder_w=0.27)


def build_rudy() -> Character:
    b = Builder("rudy")
    build_body(b, R_BODY)
    b.box("collar", "chest", SHIRT, (0, -0.1, 0.21), (0.22, 0.14, 0.05), 0.02)
    b.box("tie", "chest", RED, (0, -0.155, 0.13), (0.05, 0.02, 0.14), 0.01)
    for k in range(3):
        b.sphere(f"btn_{k}", "chest", GOLD, (0.0, -0.155, 0.02 - k * 0.07), (0.02, 0.012, 0.02), 6)
    b.sphere("hair_back", "head", HAIR, (0, 0.08, 0.15), (0.22, 0.16, 0.16), 10)
    b.sphere("beard", "head", HAIR, (0, -0.12, 0.04), (0.17, 0.11, 0.08), 10)
    # Casquette de chef de quai : haut bandeau rouge, calotte marine, visière, liseré doré
    b.cylinder("cap_band", "head", RED, (0, 0.02, 0.35), 0.235, 0.12)
    b.cylinder("cap_top", "head", NAVY, (0, 0.05, 0.43), 0.28, 0.06)
    b.cylinder("cap_gold", "head", GOLD, (0, 0.02, 0.3), 0.24, 0.02)
    b.box("cap_visor", "head", RUBBER, (0, -0.22, 0.3), (0.28, 0.1, 0.022), 0.01, rot=(-24, 0, 0))
    # Palette de départ (main droite) : disque vert cerclé de blanc sur un manche
    b.cylinder("paddle_stick", "hand_R", RUBBER, (0, -0.02, -0.12), 0.02, 0.24)
    b.cylinder("paddle_rim", "hand_R", SHIRT, (0, -0.02, -0.34), 0.15, 0.025, rot=(90, 0, 0), vertices=18)
    b.cylinder("paddle_disc", "hand_R", GREEN, (0, -0.04, -0.34), 0.125, 0.02, rot=(90, 0, 0), vertices=18)
    b.cylinder("paddle_disc_b", "hand_R", GREEN, (0, 0.0, -0.34), 0.125, 0.02, rot=(90, 0, 0), vertices=18)
    return b.build()


def idle_rudy(i: int, n: int):
    proud = {"spine": (-6, 0, 0), "head": (-4, 0, 0), "shoulder_L": (-4, 0, 0), "elbow_L": (-10, 0, 0)}
    def paddle(r, d):
        return {**r, **point_hand(r, "R", d)}

    low = {**proud, **paddle(arm_ik(R_BODY, "R", (-0.3, -0.1, -0.24), 10), (-0.1, -0.2, -1))}
    raise1 = {**proud, **paddle({"shoulder_R": (-120, 0, 20), "elbow_R": (-30, 0, 0)}, (-0.4, -0.3, 1)), "head": (-12, 0, -6)}
    high = {**proud, **paddle({"shoulder_R": (-168, 0, 14), "elbow_R": (-6, 0, 0)}, (-0.25, -0.15, 1)), "head": (-14, 0, -8), "spine": (-8, 0, 0)}
    return _gesture([(0, low), (1, raise1), (2, high), (3, high), (4, raise1), (5, low)], i, n)


# ─── Jean-Mi ──────────────────────────────────────────────────────────────────
JM_BODY = _body(skin=MATE_SKIN, top=SHIRT, belly=BROWN, pants=GREY, shoes=BOOTS, belly_box=(0.42, 0.28, 0.17), chest_box=(0.47, 0.3, 0.34))


def build_jeanmi() -> Character:
    b = Builder("jeanmi")
    build_body(b, JM_BODY)
    b.box("apron", "chest", BROWN, (0, -0.14, 0.04), (0.36, 0.04, 0.3), 0.02)
    b.box("apron_low", "pelvis", BROWN, (0, -0.13, -0.08), (0.36, 0.04, 0.26), 0.02)
    b.box("strap_L", "chest", BROWN, (0.12, -0.12, 0.22), (0.04, 0.12, 0.08), 0.0)
    b.box("strap_R", "chest", BROWN, (-0.12, -0.12, 0.22), (0.04, 0.12, 0.08), 0.0)
    b.box("pocket", "chest", BEIGE, (0, -0.165, 0.0), (0.16, 0.01, 0.08), 0.0)
    b.sphere("beard", "head", HAIR, (0, -0.1, 0.03), (0.2, 0.14, 0.12), 10)
    b.sphere("hair_back", "head", HAIR, (0, 0.08, 0.15), (0.22, 0.16, 0.16), 10)
    # Bonnet orange à revers
    b.sphere("beanie", "head", VEST, (0, 0.04, 0.33), (0.24, 0.23, 0.17), 14)
    b.cylinder("beanie_cuff", "head", VEST, (0, 0.02, 0.3), 0.248, 0.07)
    # Tasse (main droite) + vapeur
    b.cylinder("cup", "hand_R", SHIRT, (0, -0.08, -0.02), 0.06, 0.1)
    b.cylinder("coffee", "hand_R", BROWN, (0, -0.08, 0.035), 0.05, 0.01)
    b.box("cup_handle", "hand_R", SHIRT, (0.07, -0.08, -0.02), (0.03, 0.02, 0.06), 0.01)
    b.joint("steam", "hand_R", (0, -0.08, 0.06))
    for k in range(3):
        b.sphere(f"steam_{k}", "steam", PUFF, (0.02 * (k % 2 * 2 - 1), 0, 0.06 + k * 0.07), (0.03, 0.03, 0.03), 6)
    return b.build()


def idle_jeanmi(i: int, n: int):
    lean = {"spine": (-4, 0, -3), "hip_L": (-3, 0, -6), "foot_L": (-3, 0, -10), "shoulder_L": (-6, 0, -10), "elbow_L": (-50, 0, 0)}
    def cup(target, tilt=0.0):
        r = arm_ik(JM_BODY, "R", target, 20)
        return {**r, **point_hand(r, "R", (0, math.sin(math.radians(tilt)), -math.cos(math.radians(tilt))))}

    hold = {**lean, **cup((-0.12, -0.3, 0.06))}
    sip = {**lean, **cup((-0.04, -0.27, 0.36), 35), "head": (-12, 0, 0)}
    ah = {**lean, **cup((-0.1, -0.32, 0.16)), "head": (-4, 0, 6)}
    p = _gesture([(0, hold), (1, hold), (2, sip), (3, sip), (4, ah), (5, hold)], i, n)
    p["show"] = [f"steam_{k}" for k in range(3) if (i + k) % 3 != 0] if i not in (2, 3) else []
    p["rot"]["steam"] = (0, 8 * math.sin(i), 0)
    return p


def _entity(name, build, idle, toggles=()):
    return SimpleNamespace(
        ENTITY=name, CATEGORY=CATEGORY, FRAME=FRAME, PIVOT=PIVOT, PX_PER_UNIT=PX_PER_UNIT, build=build,
        SMEARS=[], TOGGLES=list(toggles),
        ANIMS={"idle": (6, DUR, True, False, idle, [], None)},
    )


ENTITIES = [
    _entity("marcel", build_marcel, idle_marcel),
    _entity("fatou", build_fatou, idle_fatou),
    _entity("yasmina", build_yasmina, idle_yasmina),
    _entity("kevin", build_kevin, idle_kevin),
    _entity("bene", build_bene, idle_bene),
    _entity("josiane", build_josiane, idle_josiane),
    _entity("rudy", build_rudy, idle_rudy),
    _entity("jeanmi", build_jeanmi, idle_jeanmi, [f"steam_{k}" for k in range(3)]),
]
