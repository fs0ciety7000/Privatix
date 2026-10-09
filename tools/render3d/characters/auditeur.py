"""Boss « L'Auditeur des Quais » aux commandes de la Borne Totale 3000 : mécha-borne massive (~3 m) sur
deux jambes trapues, grand écran de façade, deux bras-barrières de portique rayés rouge/blanc, fentes à
tickets, blindage boulonné (arraché en phase 2 : cœur et écrans rouges). Le petit auditeur en cravate et
lunettes pilote depuis un cockpit ouvert sur le toit. Une seule direction (vue de face)."""
from __future__ import annotations

import math

from rig import Builder, Character

from .common import keyed, lerp_pose, merge, pose

SKIN, STRIPE, BOOTS, STEEL, EYES, HAIR = 1, 4, 6, 7, 9, 12
SHIRT, TIE, SCREEN_M, PLASTIC = 21, 22, 23, 25
SMEAR_M, SMEAR_MC, SCREEN_Y, TICKET, SHEET, SPARK, GLASS, RED, SCREEN_R = 27, 28, 29, 30, 31, 32, 33, 34, 35
DARK, LED, GOLD, GREY, RUBBER, HV = 36, 37, 38, 49, 50, 45

TORSO_W, TORSO_D, TORSO_H = 1.6, 1.0, 1.36
BOOM_SEG, BOOM_N = 0.2, 8
PILOT_S = 1.35


def build() -> Character:
    b = Builder("auditeur")
    b.joint("hips", None, (0, 0, 1.05))
    b.joint("torso", "hips", (0, 0, 0.1))
    b.joint("cockpit", "torso", (0, 0.08, TORSO_H))
    b.joint("pilot", "cockpit", (0, 0.06, 0.06))
    b.joint("phead", "pilot", (0, 0, 0.3))
    for side, sx in (("L", 1), ("R", -1)):
        b.joint(f"parm_{side}", "pilot", (0.14 * sx, -0.02, 0.24))
        b.joint(f"arm_{side}", "torso", (0.9 * sx, 0.0, 1.08))
        b.joint(f"leg_{side}", "hips", (0.46 * sx, 0, -0.04))
        b.joint(f"knee_{side}", f"leg_{side}", (0, 0, -0.52))
        b.joint(f"foot_{side}", f"knee_{side}", (0, 0, -0.42))
        b.joint(f"plate_sh_{side}", f"arm_{side}", (0, 0, 0.26))
        b.joint(f"plate_ch_{side}", "torso", (0.6 * sx, -0.52, 0.95))
        b.joint(f"plate_kn_{side}", f"knee_{side}", (0, -0.2, -0.05))
        b.joint(f"smear_{side}", "torso", (0.9 * sx, 0.0, 1.08))
    b.joint("fx", None, (0, 0, 0))
    b.joint("chute", "pilot", (0, 0, 0.5))

    # ── Jambes de mécha : cuisses en vérin, tibias blindés, gros pieds ─────────────
    for side, sx in (("L", 1), ("R", -1)):
        b.capsule(f"thigh_{side}", f"leg_{side}", PLASTIC, (0, 0, 0), (0, 0, -0.52), 0.17, 0.15)
        b.sphere(f"kneeball_{side}", f"knee_{side}", RUBBER, (0, 0, 0), (0.17, 0.17, 0.17), 12)
        b.box(f"shin_{side}", f"knee_{side}", SHEET, (0, 0, -0.22), (0.36, 0.4, 0.42), 0.06)
        b.box(f"shin_stripe_{side}", f"knee_{side}", HV, (0, -0.205, -0.3), (0.3, 0.02, 0.06), 0.0)
        b.box(f"foot_{side}", f"foot_{side}", DARK, (0, -0.1, 0.08), (0.5, 0.7, 0.16), 0.06)
        b.box(f"toe_{side}", f"foot_{side}", RUBBER, (0, -0.42, 0.05), (0.46, 0.12, 0.1), 0.03)
        b.box(f"plate_kn_{side}_p", f"plate_kn_{side}", SHEET, (0, 0, 0), (0.3, 0.08, 0.22), 0.04)
        b.sphere(f"plate_kn_{side}_bolt", f"plate_kn_{side}", GOLD, (0, -0.045, 0.0), (0.04, 0.02, 0.04), 6)
    b.box("pelvis", "hips", DARK, (0, 0, 0.0), (1.1, 0.8, 0.26), 0.08)

    # ── Caisse : tôle turquoise, bandeau sombre, écran de façade, fentes à tickets ─
    b.box("hull", "torso", SHEET, (0, 0, TORSO_H / 2), (TORSO_W, TORSO_D, TORSO_H), 0.12)
    b.box("hull_top", "torso", DARK, (0, 0, TORSO_H - 0.02), (TORSO_W + 0.06, TORSO_D + 0.06, 0.1), 0.04)
    b.box("hull_band", "torso", DARK, (0, -0.02, 0.16), (TORSO_W + 0.04, TORSO_D + 0.02, 0.18), 0.05)
    b.box("bezel", "torso", RUBBER, (0, -0.5, 0.78), (1.12, 0.06, 0.68), 0.04)
    sy = -0.535
    for name, mid in (("scr_t", LED), ("scr_m", SCREEN_M), ("scr_r", SCREEN_R), ("scr_off", GLASS)):
        b.box(name, "torso", mid, (0, sy, 0.78), (0.98, 0.01, 0.54), 0.0)
    # Pictos d'écran : liste de contrôle (repos), « ! » (attaque), croix (phase 2)
    for k in range(3):
        b.box(f"chk_box{k}", "torso", EYES, (-0.34, sy - 0.008, 0.95 - k * 0.16), (0.08, 0.008, 0.08), 0.0)
        b.box(f"chk_line{k}", "torso", EYES, (0.06 + 0.04 * (k % 2), sy - 0.008, 0.95 - k * 0.16), (0.56 - 0.08 * (k % 2), 0.008, 0.04), 0.0)
    b.box("bang", "torso", EYES, (0, sy - 0.008, 0.86), (0.1, 0.008, 0.28), 0.0)
    b.box("bang_dot", "torso", EYES, (0, sy - 0.008, 0.6), (0.1, 0.008, 0.08), 0.0)
    b.box("cross_a", "torso", EYES, (0, sy - 0.008, 0.78), (0.6, 0.008, 0.1), 0.0, rot=(0, 30, 0))
    b.box("cross_b", "torso", EYES, (0, sy - 0.008, 0.78), (0.6, 0.008, 0.1), 0.0, rot=(0, -30, 0))
    for side, sx in (("L", 1), ("R", -1)):
        b.box(f"slot_{side}", "torso", RUBBER, (0.5 * sx, -0.51, 0.3), (0.4, 0.04, 0.09), 0.02)
        b.box(f"tix_{side}", "torso", TICKET, (0.5 * sx, -0.53, 0.22), (0.18, 0.012, 0.14), 0.0)
        b.sphere(f"flash_{side}", "torso", SMEAR_M, (0.5 * sx, -0.75, 0.3), (0.34, 0.2, 0.16), 10)
        b.sphere(f"flash_core_{side}", "torso", SMEAR_MC, (0.5 * sx, -0.8, 0.3), (0.2, 0.12, 0.09), 10)
        b.box(f"lamp_{side}", "torso", HV, (0.72 * sx, -0.3, TORSO_H + 0.08), (0.1, 0.1, 0.1), 0.02)
        # Blindage de poitrine (boulonné) — arraché en phase 2
        b.box(f"plate_ch_{side}_p", f"plate_ch_{side}", PLASTIC, (0, 0, 0), (0.32, 0.08, 0.5), 0.04)
        for k in range(2):
            b.sphere(f"plate_ch_{side}_bolt{k}", f"plate_ch_{side}", GOLD, (0.08 * sx * (1 - 2 * k), -0.045, 0.16 - 0.32 * k), (0.035, 0.02, 0.035), 6)
        # Cœur exposé (phase 2) : grilles rouges lumineuses sous le blindage
        for k in range(3):
            b.box(f"core_{side}{k}", "torso", SCREEN_R, (0.6 * sx, -0.505, 1.1 - k * 0.16), (0.26, 0.02, 0.05), 0.0)
    # ── Bras-barrières de portique (rayés rouge/blanc), carter d'épaule, feu en bout ─
    for side, sx in (("L", 1), ("R", -1)):
        j = f"arm_{side}"
        b.box(f"housing_{side}", j, DARK, (0.06 * sx, 0, 0), (0.42, 0.52, 0.56), 0.08)
        b.cylinder(f"hub_{side}", j, STEEL, (0.3 * sx, 0, 0), 0.13, 0.1, rot=(0, 90, 0))
        for k in range(BOOM_N):
            x = (0.36 + BOOM_SEG * (k + 0.5)) * sx
            b.box(f"boom_{side}{k}", j, RED if k % 2 == 0 else STRIPE, (x, 0, 0), (BOOM_SEG + 0.004, 0.14, 0.12), 0.015)
        tip = (0.36 + BOOM_SEG * BOOM_N + 0.04) * sx
        b.sphere(f"tip_t_{side}", j, LED, (tip, 0, 0.0), (0.08, 0.08, 0.08), 10)
        b.sphere(f"tip_m_{side}", j, SCREEN_M, (tip, 0, 0.0), (0.1, 0.1, 0.1), 10)
        b.box(f"plate_sh_{side}_p", f"plate_sh_{side}", SHEET, (0.06 * sx, 0, 0.04), (0.5, 0.6, 0.12), 0.05)
        b.sphere(f"plate_sh_{side}_bolt", f"plate_sh_{side}", GOLD, (0.06 * sx, -0.2, 0.1), (0.04, 0.04, 0.03), 6)
        # Smears de balayage (horizontaux, au niveau des bras) : deux étapes
        a0, a1 = (25, -62) if sx > 0 else (155, 242)
        b0, b1 = (-25, -98) if sx > 0 else (205, 278)
        b.arc(f"sw_a_{side}", f"smear_{side}", SMEAR_M, 1.4, 0.9, a0, a1, z=0.0, thickness=0.05)
        b.arc(f"sw_ac_{side}", f"smear_{side}", SMEAR_MC, 1.4, 0.38, a0 + (8 if sx > 0 else -8) * -1, a1, z=0.03, thickness=0.05)
        b.arc(f"sw_b_{side}", f"smear_{side}", SMEAR_M, 1.4, 0.9, b0, b1, z=0.0, thickness=0.05)
        b.arc(f"sw_bc_{side}", f"smear_{side}", SMEAR_MC, 1.4, 0.38, b0, b1, z=0.03, thickness=0.05)
    # ── Cockpit ouvert : baquet, pare-brise bas, arceau, leviers ──────────────────
    b.box("tub", "cockpit", DARK, (0, 0, 0.12), (0.86, 0.62, 0.26), 0.06)
    b.box("windshield", "cockpit", GLASS, (0, -0.33, 0.2), (0.7, 0.04, 0.08), 0.02, rot=(-20, 0, 0))
    b.box("rollbar", "cockpit", STEEL, (0, 0.28, 0.42), (0.78, 0.06, 0.06), 0.02)
    for sx in (1, -1):
        b.box(f"rollpost_{sx}", "cockpit", STEEL, (0.37 * sx, 0.28, 0.27), (0.06, 0.06, 0.32), 0.02)
    b.cylinder("antenna", "cockpit", STEEL, (-0.36, 0.28, 0.62), 0.015, 0.4)
    b.sphere("antenna_t", "cockpit", LED, (-0.36, 0.28, 0.84), (0.05, 0.05, 0.05), 8)
    b.sphere("antenna_m", "cockpit", SCREEN_M, (-0.36, 0.28, 0.84), (0.06, 0.06, 0.06), 8)
    b.sphere("antenna_r", "cockpit", SCREEN_R, (-0.36, 0.28, 0.84), (0.06, 0.06, 0.06), 8)
    # ── Le petit auditeur : costume gris, chemise, cravate magenta, lunettes, raie sur le côté ─
    b.box("p_torso", "pilot", GREY, (0, 0, 0.14), (0.3, 0.2, 0.28), 0.06)
    b.box("p_shirt", "pilot", SHIRT, (0, -0.1, 0.2), (0.09, 0.03, 0.14), 0.01)
    b.box("p_tie", "pilot", TIE, (0, -0.115, 0.18), (0.04, 0.02, 0.13), 0.005)
    b.sphere("p_skull", "phead", SKIN, (0, 0, 0.1), (0.15, 0.14, 0.15), 14)
    b.sphere("p_hair", "phead", HAIR, (0.02, 0.04, 0.17), (0.15, 0.13, 0.1), 10)
    b.box("p_glasses", "phead", EYES, (0, -0.14, 0.11), (0.22, 0.015, 0.03), 0.0)
    b.sphere("p_nose", "phead", SKIN, (0, -0.145, 0.07), (0.03, 0.03, 0.03), 6)
    b.box("p_mouth", "phead", EYES, (0, -0.135, 0.02), (0.07, 0.01, 0.05), 0.0)
    for side, sx in (("L", 1), ("R", -1)):
        b.capsule(f"p_arm_{side}", f"parm_{side}", GREY, (0, 0, 0), (0, -0.04, -0.18), 0.045)
        b.sphere(f"p_hand_{side}", f"parm_{side}", SKIN, (0, -0.05, -0.21), (0.05, 0.05, 0.05), 8)
        b.cylinder(f"lever_{side}", "cockpit", STEEL, (0.2 * sx, -0.22, 0.3), 0.018, 0.2)
        b.sphere(f"lever_knob_{side}", "cockpit", RED, (0.2 * sx, -0.22, 0.41), (0.035, 0.035, 0.035), 6)
    # Parachute d'éjection (mort)
    b.sphere("chute_dome", "chute", RED, (0, 0, 0.55), (0.55, 0.55, 0.17), 14)
    b.sphere("chute_band", "chute", STRIPE, (0, 0, 0.53), (0.56, 0.56, 0.1), 14)
    for sx in (1, -1):
        b.box(f"chute_line_{sx}", "chute", STRIPE, (0.2 * sx, 0, 0.25), (0.012, 0.012, 0.5), 0.0, rot=(0, -38 * sx, 0))
    # ── Effets au sol : onde de choc du tampon, poussière ; étincelles ─────────────
    b.arc("shock", "fx", SCREEN_M, 1.5, 0.3, -180, 180, z=0.02, thickness=0.03, taper=False)
    b.arc("shock_core", "fx", SMEAR_MC, 1.5, 0.1, -180, 180, z=0.04, thickness=0.03, taper=False)
    b.arc("shock2", "fx", SCREEN_M, 2.1, 0.16, -180, 180, z=0.02, thickness=0.03, taper=False)
    b.arc("stamp_mark", "fx", RUBBER, 0.85, 0.5, -180, 180, z=0.004, thickness=0.006, taper=False)
    for k, (x, y, z) in enumerate(((0.9, -0.6, 2.0), (-0.85, -0.55, 1.6), (0.35, -0.65, 2.5), (-0.4, -0.6, 1.2), (0.7, -0.5, 0.9), (-0.2, -0.7, 2.2))):
        b.box(f"spark_{k}", "fx", SPARK, (x, y, z), (0.18, 0.03, 0.04), 0.0, rot=(0, 30 + 40 * k, 0))
        b.box(f"sparkx_{k}", "fx", SPARK, (x, y, z), (0.04, 0.03, 0.18), 0.0, rot=(0, 30 + 40 * k, 0))
    return b.build()


SMEARS = [f"sw_{s}_{side}" for s in ("a", "ac", "b", "bc") for side in "LR"]
SPARKS = [f"spark_{k}" for k in range(6)] + [f"sparkx_{k}" for k in range(6)]
CHECK = [f"chk_box{k}" for k in range(3)] + [f"chk_line{k}" for k in range(3)]
BANG = ["bang", "bang_dot"]
CROSS = ["cross_a", "cross_b"]
ARMOR = [f"plate_{p}_{s}_p" for p in ("ch", "sh", "kn") for s in "LR"] + [f"plate_ch_{s}_bolt{k}" for s in "LR" for k in range(2)] + [f"plate_{p}_{s}_bolt" for p in ("sh", "kn") for s in "LR"]
CORE = [f"core_{s}{k}" for s in "LR" for k in range(3)]
TOGGLES = (
    ["scr_t", "scr_m", "scr_r", "scr_off", "tip_t_L", "tip_t_R", "tip_m_L", "tip_m_R", "antenna_t", "antenna_m", "antenna_r", "p_mouth"]
    + ["tix_L", "tix_R", "flash_L", "flash_R", "flash_core_L", "flash_core_R", "shock", "shock_core", "shock2", "stamp_mark"]
    + ["chute_dome", "chute_band", "chute_line_1", "chute_line_-1"]
    + SPARKS + CHECK + BANG + CROSS + ARMOR + CORE
)
TIPS_T = ["tip_t_L", "tip_t_R", "antenna_t"]
TIPS_M = ["tip_m_L", "tip_m_R", "antenna_m"]
TIX = ["tix_L", "tix_R"]
CALM1 = ["scr_t"] + CHECK + TIPS_T + TIX + ARMOR
ANGRY1 = ["scr_m"] + BANG + TIPS_M + TIX + ARMOR + ["p_mouth"]
CALM2 = ["scr_r"] + CROSS + ["tip_m_L", "tip_m_R", "antenna_r"] + TIX + CORE
ANGRY2 = ["scr_m"] + BANG + TIPS_M + TIX + CORE + ["p_mouth"]

# ─── Poses ────────────────────────────────────────────────────────────────────


def arms(lift_l: float, sweep_l: float, lift_r: float | None = None, sweep_r: float | None = None) -> dict:
    """Bras-barrières : `lift` > 0 relève, `sweep` > 0 rabat vers l'avant (degrés)."""
    lift_r = lift_l if lift_r is None else lift_r
    sweep_r = sweep_l if sweep_r is None else sweep_r
    return {"arm_L": (0, -lift_l, -sweep_l), "arm_R": (0, lift_r, sweep_r)}


def legs(l_hip: float = 0, l_knee: float = 0, r_hip: float = 0, r_knee: float = 0) -> dict:
    return {
        "leg_L": (l_hip, 0, 0), "knee_L": (l_knee, 0, 0), "foot_L": (-(l_hip + l_knee), 0, 0),
        "leg_R": (r_hip, 0, 0), "knee_R": (r_knee, 0, 0), "foot_R": (-(r_hip + r_knee), 0, 0),
    }


def mech(show, lift=55.0, sweep=-10.0, crouch=0.0, torso=(0, 0, 0), hips_z=0.0, root=(0, 0, 0), pilot=None, extra=None, scales=None, offsets=None):
    """Pose de base du mécha. `crouch` (0..1) plie les genoux et abaisse le bassin."""
    k = crouch
    rot = {**arms(lift, sweep), **legs(-28 * k, 56 * k, -28 * k, 56 * k), "torso": torso}
    rot.update(pilot or {"pilot": (0, 0, 0), "phead": (0, 0, 0), "parm_L": (-40, 0, 0), "parm_R": (-40, 0, 0)})
    rot.update(extra or {})
    offs = {"hips": (0, 0, -0.17 * k + hips_z)}
    offs.update(offsets or {})
    return pose(rot, root=root, show=show, offsets=offs, scales={"pilot": (PILOT_S, PILOT_S, PILOT_S), **(scales or {})})


def with_show(p, show):
    q = merge(p, {})
    q["show"] = list(show)
    return q


def idle_cycle(i: int, n: int, show, speed: float = 1.0, sparks: bool = False):
    t = i / n
    s = math.sin(2 * math.pi * t)
    c = math.cos(2 * math.pi * t)
    look = 18 * math.sin(2 * math.pi * t + 0.8)
    extra_show = [SPARKS[(i * 5) % 6], SPARKS[6 + (i * 5) % 6]] if sparks and i % 3 == 1 else []
    return mech(
        show + extra_show,
        lift=55 + 5 * s * speed,
        sweep=-10 + 4 * c,
        crouch=0.08 + 0.06 * (0.5 + 0.5 * s),
        torso=(2 * s, 0, 1.5 * c),
        pilot={"pilot": (0, 0, 0), "phead": (4 * s, 0, look), "parm_L": (-40 + 6 * s, 0, 0), "parm_R": (-40 - 6 * s, 0, 0)},
    )


def idle(i: int, n: int):
    return idle_cycle(i, n, CALM1)


def idle_p2(i: int, n: int):
    p = idle_cycle(i, n, CALM2, speed=1.6, sparks=True)
    # Plus nerveux : tremblement, bras plus hauts
    p["rot"].update(arms(70 + 6 * math.sin(2 * math.pi * i / n * 2), -16))
    p["root"] = (0.02 * ((i % 2) * 2 - 1), 0, 0)
    return p


def walk_cycle(i: int, n: int, show, heavy: float = 1.0, sparks: bool = False):
    """Marche lourde : grand pas (pied levé haut), report de poids latéral, le corps s'écrase à
    chaque appui (frames 0 et n/2), barrières qui balancent en opposition."""
    ph = 2 * math.pi * i / n
    s, c = math.sin(ph), math.cos(ph)
    up_l = max(0.0, s)
    up_r = max(0.0, -s)
    p = mech(show + ([SPARKS[i % 6]] if sparks and i % 2 == 0 else []), crouch=0.12)
    p["rot"].update(legs(-55 * up_l + 18 * c, 85 * up_l + 12, -55 * up_r - 18 * c, 85 * up_r + 12))
    p["rot"].update(arms(48 + 8 * c, -6 + 16 * s, 48 - 8 * c, -6 - 16 * s))
    p["offsets"]["hips"] = (0.06 * s, 0, -0.04 - 0.12 * heavy * (1 - abs(s)) + 0.05 * abs(s))
    p["rot"]["torso"] = (6 + 4 * (1 - abs(s)), -6 * s, 7 * s)
    p["rot"]["pilot"] = (8 * (1 - abs(s)), 6 * s, -5 * s)
    p["rot"]["phead"] = (-4, 0, 6 * s)
    p["root"] = (0.04 * s, 0, 0)
    return p


def move(i: int, n: int):
    return walk_cycle(i, n, CALM1)


def move_p2(i: int, n: int):
    p = walk_cycle(i, n, CALM2, heavy=1.3, sparks=True)
    p["rot"].update(arms(68, -20 + 18 * math.sin(2 * math.pi * i / n)))
    return p


def intro(i: int, n: int):
    """Mise sous tension : affaissé et éteint, le pilote tire les leviers, l'écran grésille puis
    s'allume, les barrières se lèvent, il se redresse et tape du pied."""
    off = ["scr_off"] + TIX + ARMOR
    pil_slump = {"pilot": (20, 0, 0), "phead": (25, 0, 0), "parm_L": (-20, 0, 0), "parm_R": (-20, 0, 0)}
    pil_pull = {"pilot": (-6, 0, 0), "phead": (-10, 0, 0), "parm_L": (-70, 0, 0), "parm_R": (-70, 0, 0)}
    pil_yank = {"pilot": (-14, 0, 0), "phead": (-16, 0, 0), "parm_L": (-10, 0, 0), "parm_R": (-10, 0, 0)}
    k0 = mech(off, lift=-60, sweep=10, crouch=0.75, torso=(16, 0, 0), pilot=pil_slump)
    k2 = mech(off, lift=-60, sweep=10, crouch=0.75, torso=(16, 0, 0), pilot=pil_pull)
    k4 = mech(off + ["antenna_t"], lift=-55, sweep=10, crouch=0.72, torso=(14, 0, 0), pilot=pil_yank)
    k5 = mech(["scr_y"] if False else ["scr_t"] + TIX + ARMOR + ["antenna_t"], lift=-50, sweep=8, crouch=0.7, torso=(10, 0, 0), pilot=pil_yank)
    k6 = mech(off + ["antenna_t"], lift=-45, sweep=6, crouch=0.66, torso=(8, 0, 0), pilot=pil_yank)
    k7 = mech(CALM1, lift=-30, sweep=0, crouch=0.6, torso=(6, 0, 0), pilot=pil_yank)
    k9 = mech(CALM1, lift=40, sweep=-20, crouch=0.35, torso=(-4, 0, 0), pilot=pil_yank)
    k10 = mech(CALM1, lift=80, sweep=-25, crouch=0.0, torso=(-10, 0, 0), hips_z=0.06, pilot={"pilot": (-10, 0, 0), "phead": (-14, 0, 0), "parm_L": (-150, 0, -20), "parm_R": (-150, 0, 20)})
    k11 = mech(CALM1, lift=78, sweep=-25, crouch=0.0, torso=(-8, 0, 0), hips_z=0.04, extra=legs(-50, 70, 0, 0), pilot={"pilot": (-10, 0, 0), "phead": (-14, 0, 0), "parm_L": (-150, 0, -20), "parm_R": (-150, 0, 20)})
    k12 = mech(CALM1 + ["shock2"], lift=62, sweep=-15, crouch=0.3, torso=(6, 0, 0), extra=legs(-10, 30, 0, 0), pilot={"pilot": (8, 0, 0), "phead": (6, 0, 0), "parm_L": (-60, 0, -10), "parm_R": (-60, 0, 10)})
    k13 = idle_cycle(0, 6, CALM1)
    keys = [(0, k0), (1, k0), (2, k2), (3, k2), (4, k4), (5, k5), (6, k6), (7, k7), (9, k9), (10, k10), (11, k11), (12, k12), (13, k13)]
    return keyed(keys, i, ease=False)


def attack_sweep(i: int, n: int):
    """Télégraphe 1-4 : barrières à l'horizontale, armées vers l'arrière, feux magenta ; balayage
    vers l'avant frames 5-6 (smears), puis récupération."""
    pil = {"pilot": (-6, 0, 0), "phead": (-8, 0, 0), "parm_L": (-80, 0, 0), "parm_R": (-80, 0, 0)}
    k0 = idle_cycle(0, 6, CALM1)
    k1 = mech(ANGRY1, lift=30, sweep=-20, crouch=0.15, torso=(-2, 0, 0), pilot=pil)
    k2 = mech(ANGRY1, lift=6, sweep=-34, crouch=0.25, torso=(-4, 0, 0), pilot=pil)
    k3 = mech(ANGRY1, lift=0, sweep=-44, crouch=0.32, torso=(-6, 0, 0), root=(0, 0.04, 0), pilot=pil)
    k4 = mech(ANGRY1, lift=0, sweep=-48, crouch=0.36, torso=(-8, 0, 0), root=(0, 0.06, 0), pilot=pil)
    hit_pil = {"pilot": (12, 0, 0), "phead": (10, 0, 0), "parm_L": (-20, 0, 0), "parm_R": (-20, 0, 0)}
    k5 = mech(ANGRY1, lift=-4, sweep=58, crouch=0.3, torso=(12, 0, 0), root=(0, -0.08, 0), pilot=hit_pil)
    k5["smear"] = ["sw_a_L", "sw_a_R", "sw_ac_L", "sw_ac_R"]
    k6 = mech(ANGRY1, lift=-6, sweep=95, crouch=0.34, torso=(16, 0, 0), root=(0, -0.1, 0), pilot=hit_pil)
    k6["smear"] = ["sw_b_L", "sw_b_R", "sw_bc_L", "sw_bc_R"]
    k7 = mech(ANGRY1, lift=-4, sweep=100, crouch=0.3, torso=(14, 0, 0), root=(0, -0.1, 0), pilot=hit_pil)
    k7["smear"] = ["sw_b_L", "sw_b_R"]
    k8 = mech(CALM1, lift=4, sweep=80, crouch=0.24, torso=(8, 0, 0), root=(0, -0.06, 0))
    k11 = idle_cycle(0, 6, CALM1)
    keys = [(0, k0), (1, k1), (2, k2), (3, k3), (4, k4), (5, k5), (6, k6), (7, k7), (8, k8), (n - 1, k11)]
    return keyed(keys, i, ease=False)


def attack_barrage(i: int, n: int):
    """Rafale de tickets : tir gauche frame 2, droit frame 6 (recul à chaque tir). Bouclable."""
    pil = lambda s: {"pilot": (0, 0, 8 * s), "phead": (-6, 0, 10 * s), "parm_L": (-90 + 30 * max(0, s), 0, 0), "parm_R": (-90 + 30 * max(0, -s), 0, 0)}
    frames = []
    for k in range(8):
        side = 1 if k < 4 else -1
        phase = k % 4
        recoil = {0: 0.0, 1: 0.4, 2: 1.0, 3: 0.5}[phase]
        show = [s for s in ANGRY1 if s not in ("tix_L", "tix_R")]
        show += ["tix_R"] if side > 0 else ["tix_L"]
        if phase == 2:
            show += ["flash_L", "flash_core_L"] if side > 0 else ["flash_R", "flash_core_R"]
        elif phase != 2:
            show += ["tix_L"] if side > 0 else ["tix_R"]
        p = mech(show, lift=62 + 8 * recoil, sweep=-14, crouch=0.2 + 0.08 * recoil, torso=(-6 * recoil, 0, 8 * side * recoil), root=(0, 0.05 * recoil, 0), pilot=pil(side))
        frames.append(p)
    return frames[i % 8]


def attack_stamp(i: int, n: int):
    """« Contrôle ! » : s'accroupit (0-3), bondit (4-6), retombe (7) et écrase le sol frame 8
    (onde de choc magenta), reste tassé puis se relève."""
    shout = {"pilot": (-12, 0, 0), "phead": (-20, 0, 0), "parm_L": (-160, 0, -25), "parm_R": (-160, 0, 25)}
    hold = {"pilot": (10, 0, 0), "phead": (6, 0, 0), "parm_L": (-40, 0, 0), "parm_R": (-40, 0, 0)}
    k0 = idle_cycle(0, 6, CALM1)
    k1 = mech(ANGRY1, lift=70, sweep=-20, crouch=0.4, torso=(8, 0, 0), pilot=hold)
    k3 = mech(ANGRY1, lift=80, sweep=-28, crouch=0.8, torso=(14, 0, 0), pilot=hold, scales={"torso": (1.05, 1.05, 0.95)})
    k4 = mech(ANGRY1, lift=85, sweep=-10, crouch=0.0, torso=(-8, 0, 0), root=(0, 0, 0.55), pilot=shout, scales={"torso": (0.95, 0.95, 1.08)})
    k5 = mech(ANGRY1, lift=88, sweep=0, crouch=0.35, torso=(-4, 0, 0), root=(0, -0.05, 1.1), pilot=shout)
    k6 = mech(ANGRY1, lift=80, sweep=5, crouch=0.4, torso=(4, 0, 0), root=(0, -0.08, 1.05), pilot=shout)
    k7 = mech(ANGRY1, lift=50, sweep=20, crouch=0.0, torso=(10, 0, 0), root=(0, -0.1, 0.4), pilot=shout, scales={"torso": (0.94, 0.94, 1.08)})
    k8 = mech(ANGRY1 + ["shock", "shock_core", "stamp_mark"], lift=-10, sweep=30, crouch=0.95, torso=(18, 0, 0), root=(0, -0.1, 0), pilot=hold, scales={"torso": (1.1, 1.1, 0.88)})
    k9 = mech(ANGRY1 + ["shock2", "stamp_mark"], lift=-5, sweep=25, crouch=0.85, torso=(14, 0, 0), root=(0, -0.1, 0), pilot=hold, scales={"torso": (1.05, 1.05, 0.94)})
    k10 = mech(CALM1 + ["stamp_mark"], lift=10, sweep=15, crouch=0.7, torso=(10, 0, 0), root=(0, -0.1, 0), pilot=hold)
    k13 = merge(idle_cycle(0, 6, CALM1), {}, root=(0, -0.1, 0))
    keys = [(0, k0), (1, k1), (3, k3), (4, k4), (5, k5), (6, k6), (7, k7), (8, k8), (9, k9), (10, k10), (13, k13)]
    p = keyed(keys, i, ease=False)
    return p


def phase(i: int, n: int):
    """Passage en phase 2 : secousses, le blindage saute (plaques projetées), écrans qui virent au
    rouge, rugissement barrières levées."""
    mad = {"pilot": (-10, 0, 0), "phead": (-18, 0, 0), "parm_L": (-160, 0, -30), "parm_R": (-160, 0, 30)}
    shake = lambda k: (0.04 * (1 if k % 2 else -1), 0, 0)
    out = []
    fly = {
        0: (0, 0, 0), 1: (0, 0, 0), 2: (0, 0, 0),
        3: (0.12, -0.15, 0.1), 4: (0.35, -0.4, 0.25), 5: (0.6, -0.6, 0.2), 6: (0.85, -0.75, -0.1), 7: (1.0, -0.85, -0.5),
    }
    for k in range(12):
        if k <= 2:
            show = (["scr_m"] if k % 2 else ["scr_r"]) + TIPS_M + TIX + ARMOR + SPARKS[k * 2: k * 2 + 3] + ["p_mouth"]
            p = mech(show, lift=20 - 10 * k, sweep=10, crouch=0.4 + 0.1 * k, torso=(10, 0, 6 * (1 if k % 2 else -1)), root=shake(k), pilot={"pilot": (14, 0, 0), "phead": (16, 0, 0), "parm_L": (-60, 0, 0), "parm_R": (-60, 0, 0)})
        elif k <= 7:
            show = (["scr_r"] if k % 2 else ["scr_off"]) + TIPS_M + TIX + CORE + SPARKS[(k * 3) % 6: (k * 3) % 6 + 2] + [SPARKS[6 + k % 6]] + ["p_mouth"]
            if k <= 6:
                show += ARMOR
            p = mech(show, lift=40 + 8 * (k - 3), sweep=-10, crouch=0.5 - 0.08 * (k - 3), torso=(-6, 0, 4 * (1 if k % 2 else -1)), root=shake(k), pilot=mad)
            fx, fy, fz = fly[k]
            for side, sx in (("L", 1), ("R", -1)):
                p["offsets"][f"plate_ch_{side}"] = (fx * sx, fy, fz)
                p["offsets"][f"plate_sh_{side}"] = (fx * sx * 0.6, fy * 0.5, fz + 0.4 * fx)
                p["offsets"][f"plate_kn_{side}"] = (fx * sx * 0.7, fy, -0.2 * fx)
                p["rot"][f"plate_ch_{side}"] = (-120 * fx, 0, 90 * fx * sx)
                p["rot"][f"plate_sh_{side}"] = (0, -160 * fx * sx, 0)
                p["rot"][f"plate_kn_{side}"] = (-200 * fx, 0, 0)
        else:
            show = CALM2 + ["p_mouth"] + ([SPARKS[k % 6]] if k % 2 else [])
            roar = 1.0 if k < 11 else 0.4
            p = mech(show, lift=70 + 15 * roar, sweep=-25, crouch=0.1, torso=(-10 * roar, 0, 0), hips_z=0.04 * roar, pilot=mad)
        out.append(p)
    return out[min(i, 11)]


def hurt(i: int, n: int):
    hit = mech(["scr_off"] + TIPS_T + TIX + ARMOR + SPARKS[:2], lift=40, sweep=10, crouch=0.25, torso=(-12, 6, 6), root=(0.03, 0.08, 0), pilot={"pilot": (-20, 0, 10), "phead": (-24, 0, 0), "parm_L": (-10, 0, -30), "parm_R": (-10, 0, 30)})
    back = mech(CALM1, lift=52, sweep=-6, crouch=0.15, torso=(-4, 0, -2), root=(0, 0.04, 0))
    return [hit, back][min(i, 1)]


def death(i: int, n: int):
    """Courts-circuits (étincelles, écran qui grésille), les barrières retombent, il s'affaisse à genoux ;
    le pilote s'éjecte en parachute (frame 11) et redescend pendant que la carcasse s'écroule."""
    keys = []
    for k in range(20):
        sp = [SPARKS[(k * 4) % 6], SPARKS[6 + (k * 5) % 6], SPARKS[(k * 4 + 3) % 6]] if k < 16 else ([SPARKS[k % 6]] if k % 2 else [])
        scr = ["scr_r", "scr_off", "scr_m", "scr_off"][k % 4] if k < 10 else "scr_off"
        show = [scr] + TIX + CORE[: max(0, 6 - k // 2)] + sp
        t = min(1.0, k / 12)
        lift = 60 - 120 * min(1.0, k / 9)
        crouch = min(1.0, max(0.0, (k - 5) / 6))
        torso = (8 + 22 * max(0.0, (k - 9) / 10), 0, 6 * math.sin(k * 1.7) * (1 - t))
        root = (0.03 * math.sin(k * 2.3) * (1 - t), 0, -0.25 * max(0.0, (k - 10) / 9))
        if k < 11:
            pil = {"pilot": (-10, 0, 8 * math.sin(k)), "phead": (-14, 0, 20 * math.sin(k * 1.3)), "parm_L": (-150, 0, -30), "parm_R": (-150, 0, 30)}
            p = mech(show + ["p_mouth"], lift=lift, sweep=20 * t, crouch=crouch, torso=torso, root=root, pilot=pil)
        else:
            # Éjection : le pilote monte puis redescend sous son parachute, sur le côté
            e = k - 11
            up = [0.6, 1.0, 1.15, 1.1, 1.0, 0.85, 0.7, 0.55, 0.4][e]
            side = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1.0, 1.1, 1.2][e]
            show += ["chute_dome", "chute_band", "chute_line_1", "chute_line_-1"] if e >= 1 else []
            pil = {"pilot": (0, 0, 0), "phead": (-10, 0, 0), "parm_L": (-170, 0, -10), "parm_R": (-170, 0, 10)}
            p = mech(show, lift=lift, sweep=20, crouch=crouch, torso=torso, root=root, pilot=pil)
            p["offsets"]["pilot"] = (side, -0.1, up)
            p["scales"]["chute"] = (1.0, 1.0, 0.6 + 0.4 * min(1.0, e / 2))
        keys.append(p)
    return keys[min(i, 19)]


# nom → (frames, durées (ms), boucle, directionnel, pose, frames actives, événements)
ANIMS = {
    "intro": (14, [160, 120, 100, 100, 90, 70, 70, 100, 100, 100, 120, 100, 80, 160], False, False, intro, [], {"shake": [12]}),
    "idle": (6, [120] * 6, True, False, idle, [], None),
    "move": (8, [90] * 8, True, False, move, [], {"shake": [0, 4]}),
    "attack-sweep": (12, [100, 100, 100, 100, 100, 40, 40, 100, 100, 100, 100, 100], False, False, attack_sweep, [5, 6], {"telegraph": [1, 2, 3, 4]}),
    "attack-barrage": (8, [80] * 8, True, False, attack_barrage, [2, 6], {"shoot": [2, 6], "projectile": "proj-ticket"}),
    "attack-stamp": (14, [100, 100, 100, 100, 100, 100, 100, 100, 40, 60, 100, 100, 100, 100], False, False, attack_stamp, [8], {"telegraph": "vfx_telegraph-96", "vfx": {"8": "vfx_dust-land"}}),
    "phase": (12, [100] * 12, False, False, phase, [], {"shake": [3, 4, 5, 6, 7]}),
    "idle-p2": (6, [100] * 6, True, False, idle_p2, [], None),
    "move-p2": (8, [75] * 8, True, False, move_p2, [], {"shake": [0, 4]}),
    "hurt": (2, [80, 90], False, False, hurt, [], None),
    "death": (20, [100] * 19 + [400], False, False, death, [], {"vfx": {"19": "vfx_explosion-big"}}),
}

ENTITY = "auditeur"
CATEGORY = "bosses"
FRAME = 208
PIVOT = (104, 156)
PX_PER_UNIT = 30.0
