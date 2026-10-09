"""Borne Automatique : borne de vente trapue en tôle turquoise, grand écran fissuré sous une visière,
fente qui crache des tickets, gyrophare. Elle sort d'une trappe au sol (wake), affiche « HORS SERVICE »
en clignotant (idle), passe en magenta et fronce ses « sourcils » d'écran avant de tirer un ticket (attack).
Une seule direction (vue de face)."""
from __future__ import annotations

import math

from rig import Builder, Character

from .common import keyed, merge, pose

EYES, SCREEN_M, SCREEN_T, PLASTIC, DARK = 9, 23, 24, 25, 36
SMEAR_M, SMEAR_MC, SCREEN_Y, TICKET, SHEET, SPARK, GLASS, LED, RUBBER, HV = 27, 28, 29, 30, 31, 32, 33, 37, 50, 45

BODY_H = 0.6
HEAD_Z = 0.1 + BODY_H


def build() -> Character:
    b = Builder("borne")
    b.joint("body", None, (0, 0, 0.1))
    b.joint("head", None, (0, 0.02, HEAD_Z))
    b.joint("slot", "body", (0, -0.27, 0.4))
    b.joint("ticket", "slot", (0, 0, 0))
    b.joint("trapL", None, (0.46, -0.02, 0.012))
    b.joint("trapR", None, (-0.46, -0.02, 0.012))
    b.joint("fx", None, (0, 0, 0))

    # Socle et trappe au sol (hachures jaune/noir)
    b.box("plinth", "body", RUBBER, (0, 0, -0.05), (0.84, 0.62, 0.1), 0.03)
    for side, sx in (("L", 1), ("R", -1)):
        j = f"trap{side}"
        b.box(f"trap_{side}", j, RUBBER, (-0.23 * sx, 0, 0), (0.46, 0.8, 0.02), 0.0)
        for k in range(3):
            b.box(f"trap_{side}_hv{k}", j, HV, (-0.23 * sx, -0.27 + k * 0.27, 0.012), (0.42, 0.09, 0.006), 0.0, rot=(0, 0, 25 * sx))
    # Corps : caisse en tôle, panneau avant, clavier, bac à tickets, aérations
    b.box("cabinet", "body", SHEET, (0, 0, BODY_H / 2), (0.74, 0.54, BODY_H), 0.05)
    b.box("front", "body", DARK, (0, -0.262, 0.3), (0.6, 0.02, 0.42), 0.02)
    b.box("slot_lip", "body", RUBBER, (0, -0.276, 0.4), (0.34, 0.02, 0.06), 0.01)
    b.box("keypad", "body", SHEET, (0.17, -0.282, 0.24), (0.16, 0.02, 0.14), 0.01)
    for r in range(2):
        for c in range(2):
            b.box(f"key_{r}{c}", "body", TICKET, (0.135 + c * 0.07, -0.294, 0.27 - r * 0.06), (0.04, 0.008, 0.03), 0.0)
    b.box("tray", "body", RUBBER, (-0.12, -0.282, 0.16), (0.24, 0.03, 0.08), 0.01)
    for k in range(3):
        b.box(f"vent_{k}", "body", RUBBER, (0.375, 0.05, 0.18 + k * 0.08), (0.01, 0.3, 0.025), 0.0)
        b.box(f"ventR_{k}", "body", RUBBER, (-0.375, 0.05, 0.18 + k * 0.08), (0.01, 0.3, 0.025), 0.0)
    # Tête : boîtier écran (incliné vers le haut pour la caméra), visière, gyrophare
    b.box("head_box", "head", SHEET, (0, 0, 0.22), (0.8, 0.56, 0.44), 0.06)
    b.box("bezel", "head", RUBBER, (0, -0.27, 0.21), (0.7, 0.04, 0.36), 0.03)
    b.box("visor", "head", DARK, (0, -0.24, 0.45), (0.86, 0.22, 0.05), 0.02)
    b.cylinder("beacon_base", "head", PLASTIC, (0.22, 0.05, 0.47), 0.07, 0.04)
    b.sphere("beacon_t", "head", LED, (0.22, 0.05, 0.52), (0.055, 0.055, 0.06), 10)
    b.sphere("beacon_m", "head", SCREEN_M, (0.22, 0.05, 0.52), (0.065, 0.065, 0.07), 10)
    sy = -0.292
    for name, mid in (("scr_t", LED), ("scr_y", SCREEN_Y), ("scr_m", SCREEN_M), ("scr_off", GLASS)):
        b.box(name, "head", mid, (0, sy, 0.21), (0.6, 0.006, 0.3), 0.0)
    # « HORS SERVICE » : deux lignes de pavés sombres
    for k in range(4):
        b.box(f"txt_a{k}", "head", EYES, (-0.12 + k * 0.08, sy - 0.006, 0.26), (0.055, 0.006, 0.05), 0.0)
    for k in range(6):
        b.box(f"txt_b{k}", "head", EYES, (-0.2 + k * 0.08, sy - 0.006, 0.15), (0.055, 0.006, 0.05), 0.0)
    # Visage colérique (attaque) : sourcils obliques + bouche
    b.box("brow_L", "head", EYES, (0.12, sy - 0.007, 0.27), (0.16, 0.006, 0.045), 0.0, rot=(0, 22, 0))
    b.box("brow_R", "head", EYES, (-0.12, sy - 0.007, 0.27), (0.16, 0.006, 0.045), 0.0, rot=(0, -22, 0))
    b.box("eye_L", "head", EYES, (0.12, sy - 0.007, 0.2), (0.06, 0.006, 0.06), 0.0)
    b.box("eye_R", "head", EYES, (-0.12, sy - 0.007, 0.2), (0.06, 0.006, 0.06), 0.0)
    b.box("mouth", "head", EYES, (0, sy - 0.007, 0.11), (0.22, 0.006, 0.035), 0.0)
    # Fissure de l'écran (toujours visible)
    for k, (x, z, ang, ln) in enumerate(((0.21, 0.31, 35, 0.12), (0.15, 0.24, -20, 0.1), (0.1, 0.19, 50, 0.08))):
        b.box(f"crack_{k}", "head", EYES, (x, sy - 0.008, z), (ln, 0.004, 0.014), 0.0, rot=(0, ang, 0))
    # Ticket qui dépasse de la fente (élément secondaire) + ticket éjecté et éclair de tir
    b.box("ticket_p", "ticket", TICKET, (0, -0.02, -0.07), (0.16, 0.01, 0.15), 0.0)
    b.box("ticket_band", "ticket", SCREEN_M, (0, -0.026, -0.12), (0.16, 0.004, 0.025), 0.0)
    b.sphere("flash", "slot", SMEAR_M, (0, -0.12, 0.0), (0.24, 0.1, 0.1), 10)
    b.sphere("flash_core", "slot", SMEAR_MC, (0, -0.14, 0.0), (0.14, 0.07, 0.06), 10)
    # Étincelles (mort) et débris (épave)
    for k, (x, y, z, rot) in enumerate(((0.3, -0.3, 0.95, 30), (-0.32, -0.25, 0.75, -40), (0.1, -0.35, 0.55, 70), (-0.15, -0.3, 1.05, -15), (0.38, -0.1, 0.6, 55))):
        b.box(f"spark_{k}", "fx", SPARK, (x, y, z), (0.09, 0.02, 0.025), 0.0, rot=(0, rot, 0))
        b.box(f"sparkx_{k}", "fx", SPARK, (x, y, z), (0.025, 0.02, 0.09), 0.0, rot=(0, rot, 0))
    b.box("debris_0", "fx", TICKET, (0.44, -0.34, 0.01), (0.16, 0.11, 0.01), 0.0, rot=(0, 0, 25))
    b.box("debris_1", "fx", TICKET, (-0.4, -0.38, 0.01), (0.15, 0.1, 0.01), 0.0, rot=(0, 0, -40))
    b.box("debris_2", "fx", PLASTIC, (0.08, -0.42, 0.02), (0.2, 0.08, 0.03), 0.01, rot=(0, 0, 10))
    b.box("hole", "fx", RUBBER, (0, -0.02, 0.003), (0.86, 0.74, 0.006), 0.0)
    _ground_holdout(b)
    return b.build()


def _ground_holdout(b: Builder) -> None:
    """Volume invisible sous le sol (holdout) : masque tout ce qui passe sous z = 0 (sortie de trappe)."""
    import bpy

    bpy.ops.mesh.primitive_cube_add(size=1.0)
    g = bpy.context.active_object
    g.name = "ground_holdout"
    g.scale = (4.0, 4.0, 2.0)
    g.location = (0, 0, -1.0)
    g.is_holdout = True
    g.visible_shadow = False


SMEARS: list[str] = []
SPARKS = [f"spark_{k}" for k in range(5)] + [f"sparkx_{k}" for k in range(5)]
TEXT = [f"txt_a{k}" for k in range(4)] + [f"txt_b{k}" for k in range(6)]
FACE = ["brow_L", "brow_R", "eye_L", "eye_R", "mouth"]
TRAP = ["trap_L", "trap_R"] + [f"trap_{s}_hv{k}" for s in "LR" for k in range(3)]
TOGGLES = ["hole", "scr_t", "scr_y", "scr_m", "scr_off", "beacon_t", "beacon_m", "flash", "flash_core", "ticket_p", "ticket_band", "debris_0", "debris_1", "debris_2"] + SPARKS + TEXT + FACE + TRAP

IDLE_T = ["scr_t", "beacon_t", "ticket_p"] + TEXT
IDLE_Y = ["scr_y", "beacon_t", "ticket_p"] + TEXT
ANGRY = ["scr_m", "beacon_m", "ticket_p", "ticket_band"] + FACE

# ─── Poses ────────────────────────────────────────────────────────────────────


def stand(show=None, head=(-14, 0, 0), body=(0, 0, 0), hz=1.0, bs=(1, 1, 1), root=(0, 0, 0), ticket=(10, 0, 0), toff=(0, 0, 0), rise=0.0, trap=0.0):
    """`hz` : hauteur relative du corps ; `bs` : squash & stretch ; `rise` : enfoncement sous le sol (m,
    négatif = sous la trappe) ; `trap` : ouverture des portes de trappe (degrés)."""
    return pose(
        {"head": head, "body": body, "ticket": ticket, "trapL": (0, trap, 0), "trapR": (0, -trap, 0)},
        root=root,
        show=show if show is not None else IDLE_T,
        offsets={"head": (0, 0, BODY_H * (bs[2] * hz - 1.0) + rise), "body": (0, 0, rise), "ticket": toff},
        scales={"body": (bs[0], bs[1], bs[2] * hz)},
    )


def idle(i: int, n: int):
    seq = [IDLE_Y, IDLE_Y, IDLE_T, IDLE_Y, IDLE_T, IDLE_T]
    t = i / n
    hum = math.sin(2 * math.pi * t)
    return stand(show=seq[i % len(seq)], head=(-14 + 1.5 * hum, 0, 1.0 * math.sin(4 * math.pi * t)), ticket=(10 + 14 * math.sin(2 * math.pi * t + 1), 0, 4 * hum), bs=(1, 1, 1 + 0.01 * hum))


def wake(i: int, n: int):
    """Se déplie depuis une trappe au sol : la trappe s'ouvre, la tête pointe, le corps jaillit avec
    dépassement (stretch), retombe (squash) et l'écran s'allume."""
    trap = TRAP + ["hole"]
    k0 = stand(show=TRAP, rise=-1.4, head=(0, 0, 0), trap=0)
    k1 = stand(show=trap + ["scr_off"], rise=-0.92, head=(-4, 0, 0), trap=105)
    k2 = stand(show=trap + ["scr_off", "beacon_t"], rise=-0.5, head=(-10, 0, 0), bs=(0.9, 0.9, 1.08), trap=125)
    k3 = stand(show=trap + ["scr_t", "beacon_t"], rise=0.1, head=(-22, 0, 0), bs=(0.88, 0.88, 1.12), trap=150, ticket=(-40, 0, 0))
    k4 = stand(show=["scr_y", "beacon_t", "ticket_p"] + TEXT, rise=0.0, head=(-4, 0, 0), bs=(1.1, 1.1, 0.86), ticket=(40, 0, 0))
    k5 = stand(show=IDLE_Y, head=(-16, 0, 0), bs=(1.0, 1.0, 1.0), ticket=(0, 0, 0))
    return [k0, k1, k2, k3, k4, k5][min(i, 5)]


def attack(i: int, n: int):
    """Écran magenta dès la frame 0 (télégraphe), charge (tassement), tir frame 4, recul."""
    k0 = stand(show=ANGRY, head=(-10, 0, 0), bs=(1.02, 1.02, 0.98))
    k1 = stand(show=ANGRY, head=(-4, 0, 0), bs=(1.05, 1.05, 0.94), root=(0, 0.02, 0), ticket=(-10, 0, 0))
    k2 = stand(show=ANGRY, head=(2, 0, 0), bs=(1.08, 1.08, 0.9), root=(0, 0.03, 0), ticket=(-20, 0, 0))
    k3 = stand(show=ANGRY, head=(4, 0, 0), bs=(1.1, 1.1, 0.88), root=(0, 0.04, 0), ticket=(-25, 0, 0), toff=(0, 0.04, 0))
    fire = [s for s in ANGRY if s not in ("ticket_p", "ticket_band")] + ["flash", "flash_core"]
    k4 = stand(show=fire, head=(-26, 0, 0), body=(-6, 0, 0), bs=(0.94, 0.94, 1.1), root=(0, 0.09, 0))
    k5 = stand(show=["scr_m", "beacon_m"] + FACE, head=(-18, 0, 0), body=(-2, 0, 0), bs=(1.0, 1.0, 1.0), root=(0, 0.05, 0))
    return keyed([(0, k0), (1, k1), (2, k2), (3, k3), (4, k4), (5, k5)], i, ease=False)


def hurt(i: int, n: int):
    hit = stand(show=["scr_y", "beacon_t", "ticket_p", "txt_a1", "txt_a2", "txt_b0", "txt_b4"], head=(-30, 0, 8), body=(-5, 3, 0), bs=(0.94, 0.94, 1.06), root=(0, 0.06, 0), ticket=(-40, 0, 20))
    back = stand(show=IDLE_T, head=(-8, 0, -3), body=(-1, 0, 0), bs=(1.04, 1.04, 0.96), root=(0, 0.03, 0), ticket=(30, 0, -10))
    return [hit, back][min(i, 1)]


def death(i: int, n: int):
    """Se tasse en crépitant : l'écran grésille puis s'éteint, la tête bascule, étincelles."""
    dead = ["scr_off"]
    k0 = stand(show=["scr_m", "ticket_p"] + SPARKS[:2] + ["sparkx_0", "sparkx_1"], head=(-32, 0, 10), body=(-4, 4, 0), bs=(0.95, 0.95, 1.05), root=(0, 0.05, 0), ticket=(-40, 0, 0))
    k1 = stand(show=["scr_y", "ticket_p", "txt_a0", "txt_b3"] + ["spark_2", "sparkx_3", "spark_3"], head=(-4, 0, -12), body=(3, -6, 0), bs=(1.06, 1.06, 0.86), root=(0, 0.03, 0), ticket=(40, 0, 0))
    k2 = stand(show=dead + ["ticket_p", "spark_4", "sparkx_4", "spark_0"], head=(8, 0, 16), body=(4, 8, 0), bs=(1.1, 1.1, 0.74), ticket=(60, 0, 0))
    k3 = stand(show=["scr_t", "ticket_p", "spark_1", "sparkx_2", "spark_3", "sparkx_3"], head=(14, -10, 14), body=(6, 10, 0), bs=(1.14, 1.14, 0.66), ticket=(70, 0, 0))
    k4 = stand(show=dead + ["ticket_p", "spark_2", "sparkx_0"], head=(20, -14, 18), body=(7, 11, 0), bs=(1.16, 1.16, 0.62), ticket=(80, 0, 0))
    k5 = wreck(0, 1)
    return [k0, k1, k2, k3, k4, k5][min(i, 5)]


def wreck(i: int, n: int):
    return stand(show=["scr_off", "debris_0", "debris_1", "debris_2"], head=(22, -16, 20), body=(7, 12, 0), bs=(1.16, 1.16, 0.6), ticket=(80, 0, 0))


# nom → (frames, durées (ms), boucle, directionnel, pose, frames actives, événements)
ANIMS = {
    "idle": (6, [220, 160, 200, 140, 200, 160], True, False, idle, [], None),
    "wake": (6, [90, 80, 80, 70, 80, 120], False, False, wake, [], {"invulnerable": [0, 1, 2, 3, 4, 5]}),
    "attack": (6, [110, 100, 100, 90, 60, 140], False, False, attack, [4], {"telegraph": [0, 1, 2, 3], "shoot": 4, "projectile": "proj-ticket"}),
    "hurt": (2, [80, 90], False, False, hurt, [], None),
    "death": (6, [70, 70, 80, 70, 90, 140], False, False, death, [], {"vfx": {"4": "vfx_explosion"}}),
    "wreck": (1, [1000], False, False, wreck, [], None),
}

ENTITY = "borne"
CATEGORY = "enemies"
FRAME = 64
PIVOT = (32, 52)
PX_PER_UNIT = 30.0
