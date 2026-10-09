"""Boss 1 « L'Auditeur des Quais » aux commandes de la Borne Totale 3000 (LORE § 7.1, ancien
`characters/auditeur.py`) : mécha-borne massive sur deux jambes trapues, grand écran de façade
(« AUDIT EN COURS »), deux **bras-barrières** de portique rayés rouge et blanc qui se lèvent et
s'abaissent comme un passage à niveau, fentes à tickets, blindage boulonné (arraché en phase 2 :
os `plate_L/R` à l'échelle 0, cœur rouge exposé). Le **petit auditeur** en costume gris, cravate
violette et lunettes pilote depuis un cockpit ouvert sur le toit, tablette en main ; son
chronomètre doré s'arrêtera sur 7:12.

Écran de façade, feux des barrières, antenne et tablette du pilote : matériau « glow » à masque
télégraphe (magenta quand `uTelegraph` > 0). Budget visé ≈ 9 k triangles (boss).

Os (non humanoïde, 20) : `root`, `pelvis`, `chest` (caisse), `hip/knee/foot_L/R` (jambes),
`arm_L/R` (carter d'épaule : balayage autour de Y), `boom_L/R` (barrière : levée autour de Z),
`plate_L/R` (blindage), `cockpit`, `pilot`, `pilot_head`, `parm_L/R` (bras du pilote).
Sockets : `socket_vfx` (centre de la caisse), `socket_screen` (écran), `socket_tip_L/R` (bout des
barrières : traînée et hitbox), `socket_slot_L/R` (fentes à tickets : projectiles), `socket_pilot`
(tête du pilote : bulles), `socket_foot_L/R` (onde de choc du tampon).
"""
from __future__ import annotations

import math

from ..geo import Model
from ..poses import P, Clip, ease_back, ease_in, ease_out, keyed, merge

SHEET, SHEET_DARK, DARK, RUBBER, HV, STEEL = 0x29A898, 0x167E74, 0x1E2A3A, 0x2A2638, 0xF0FF3C, 0xA2B2D0
RED, WHITE, GOLD, TICKET, SCREEN, INK = 0xE0283C, 0xF2F0EA, 0xF2B93A, 0xEFE8DC, 0x0F3A48, 0x14101A
GREY, GREY_DARK, SHIRT, TIE, SKIN, HAIR, PLASTIC, CORE = 0x7C8494, 0x5A6070, 0xF2F4FA, 0x6B3CE0, 0xF0BC94, 0x3A2A22, 0x45567C, 0xFF3A4A

TW, TD, TH = 1.6, 1.0, 1.36  # caisse
BOOM_X0, BOOM_L = 0.34, 1.7


def model() -> Model:
    m = Model("auditeur")
    m.joint("root", None, (0, 0, 0))
    m.joint("pelvis", "root", (0, 1.05, 0))
    m.joint("chest", "pelvis", (0, 0.1, 0))
    for s, sx in (("L", 1), ("R", -1)):
        m.joint(f"hip_{s}", "pelvis", (0.46 * sx, -0.04, 0))
        m.joint(f"knee_{s}", f"hip_{s}", (0, -0.52, 0.04))
        m.joint(f"foot_{s}", f"knee_{s}", (0, -0.42, -0.04))
        m.joint(f"arm_{s}", "chest", (0.86 * sx, 1.08, 0))
        m.joint(f"boom_{s}", f"arm_{s}", (BOOM_X0 * sx, 0, 0))
        m.joint(f"plate_{s}", "chest", (0.5 * sx, 0.98, 0.52))
    m.joint("cockpit", "chest", (0, TH, -0.04))
    m.joint("pilot", "cockpit", (0, 0.1, -0.04))
    m.joint("pilot_head", "pilot", (0, 0.36, 0.02))
    for s, sx in (("L", 1), ("R", -1)):
        m.joint(f"parm_{s}", "pilot", (0.15 * sx, 0.3, 0))
    m.socket("socket_vfx", "chest", (0, 0.7, 0))
    m.socket("socket_screen", "chest", (0, 0.66, 0.54))
    m.socket("socket_pilot", "pilot_head", (0, 0.32, 0))
    for s, sx in (("L", 1), ("R", -1)):
        m.socket(f"socket_tip_{s}", f"boom_{s}", ((BOOM_L + 0.06) * sx, 0, 0))
        m.socket(f"socket_slot_{s}", "chest", (0.5 * sx, 0.3, 0.56))
        m.socket(f"socket_foot_{s}", f"foot_{s}", (0, 0, 0.1))
    m.meta = {"kind": "boss", "height": 3.15, "radius": 1.1, "outline": 0x06302C, "rim": 0xFF7AC8}

    # ── Jambes de mécha : cuisses-vérins, genoux à rotule, tibias blindés, gros pieds ─────────
    for s, sx in (("L", 1), ("R", -1)):
        m.capsule(f"hip_{s}", PLASTIC, (0, 0, 0), (0, -0.5, 0.04), 0.17, 0.15)
        m.cyl(f"hip_{s}", STEEL, (0.0, -0.26, 0.17), 0.04, 0.4, seg=8, outline=0.5)  # vérin
        m.sphere(f"knee_{s}", RUBBER, (0, 0, 0), (0.18, 0.18, 0.18), seg=12)
        m.box(f"knee_{s}", SHEET, (0, -0.2, 0.02), (0.38, 0.4, 0.42), 0.06)
        m.box(f"knee_{s}", HV, (0, -0.28, 0.235), (0.32, 0.07, 0.01), 0.0, outline=0)
        for k in range(3):
            m.box(f"knee_{s}", INK, (-0.11 + k * 0.11, -0.28, 0.242), (0.045, 0.072, 0.006), 0.0, rot=(0, 0, 35), outline=0)
        m.box(f"knee_{s}", SHEET_DARK, (0, 0.02, 0.2), (0.3, 0.08, 0.2), 0.03, seg=1)  # genouillère
        m.box(f"foot_{s}", DARK, (0, -0.03, 0.1), (0.5, 0.16, 0.72), 0.06)
        m.box(f"foot_{s}", RUBBER, (0, -0.06, 0.47), (0.46, 0.1, 0.12), 0.0)
        m.sphere(f"foot_{s}", GOLD, (0.0, 0.06, 0.28), (0.04, 0.02, 0.04), outline=0, seg=8, emit=0.2)
    m.box("pelvis", DARK, (0, 0.0, 0), (1.1, 0.26, 0.8), 0.08, seg=1)

    # ── Caisse : tôle turquoise, bandeau sombre, écran de façade, fentes à tickets ───────────
    m.box("chest", SHEET, (0, TH / 2, 0), (TW, TH, TD), 0.12)
    m.box("chest", DARK, (0, TH - 0.02, 0), (TW + 0.06, 0.1, TD + 0.06), 0.0)
    m.box("chest", DARK, (0, 0.14, 0), (TW + 0.04, 0.18, TD + 0.02), 0.0)
    for sx in (1, -1):  # aérations latérales
        for k in range(4):
            m.box("chest", SHEET_DARK, (0.805 * sx, 0.5 + k * 0.1, -0.15), (0.01, 0.04, 0.5), 0.0, outline=0)
    # Écran de façade (glow, télégraphe) dans un cadre caoutchouc
    m.box("chest", RUBBER, (0, 0.66, 0.5), (1.14, 0.7, 0.06), 0.03, seg=1)
    m.box("chest", SCREEN, (0, 0.66, 0.535), (1.0, 0.56, 0.01), 0.0, mat="glow", outline=0, emit=1.0)
    # pictos : liste de contrôle cochée, bandeau « AUDIT »
    for k in range(3):
        y = 0.82 - k * 0.15
        m.box("chest", 0x5FF7E4, (-0.36, y, 0.542), (0.08, 0.08, 0.004), 0.0, mat="glow", outline=0)
        m.box("chest", 0x5FF7E4, (0.07, y, 0.542), (0.6 - 0.12 * (k % 2), 0.035, 0.004), 0.0, mat="glow", outline=0)
    m.box("chest", HV, (0, 0.44, 0.542), (0.9, 0.07, 0.004), 0.0, mat="glow", outline=0)
    for k in range(5):
        m.box("chest", INK, (-0.32 + k * 0.16, 0.44, 0.546), (0.07, 0.074, 0.004), 0.0, rot=(0, 0, 35), outline=0)
    for s, sx in (("L", 1), ("R", -1)):
        m.box("chest", RUBBER, (0.5 * sx, 0.3, 0.505), (0.36, 0.08, 0.04), 0.0)  # fente à tickets
        m.box("chest", TICKET, (0.5 * sx, 0.23, 0.52), (0.16, 0.14, 0.01), 0.0)
        m.box("chest", RED, (0.5 * sx, 0.18, 0.524), (0.16, 0.025, 0.004), 0.0, outline=0)
        m.cyl("chest", HV, (0.66 * sx, TH + 0.1, 0.36), 0.07, 0.1, seg=10, mat="glow", outline=0.6)  # gyrophares
        # Cœur exposé (visible quand le blindage saute) : grilles rouges
        for k in range(3):
            m.box("chest", CORE, (0.5 * sx, 1.1 - k * 0.13, 0.505), (0.26, 0.05, 0.02), 0.0, mat="glow", outline=0)
        # Blindage de poitrine boulonné (os plate_*)
        m.box(f"plate_{s}", SHEET_DARK, (0, 0, 0.0), (0.34, 0.46, 0.08), 0.04, seg=1)
        for dy in (0.15, -0.15):
            m.sphere(f"plate_{s}", GOLD, (0.1 * sx, dy, 0.045), (0.035, 0.035, 0.02), outline=0, seg=8, emit=0.2)
    # ── Bras-barrières : carter, moyeu, barrière rayée, feu en bout ─────────────────────────
    for s, sx in (("L", 1), ("R", -1)):
        a = f"arm_{s}"
        m.box(a, DARK, (0.04 * sx, 0, 0), (0.42, 0.54, 0.58), 0.08)
        m.box(a, HV, (0.04 * sx, 0.18, 0.295), (0.36, 0.06, 0.01), 0.0, outline=0)
        m.cyl(a, STEEL, (0.25 * sx, 0, 0), 0.14, 0.12, rot=(0, 0, 90), seg=14)
        b = f"boom_{s}"
        m.box(b, WHITE, ((BOOM_L / 2) * sx, 0, 0), (BOOM_L, 0.14, 0.12), 0.03, seg=1)
        for k in range(4):
            x = (0.12 + k * 0.42 + 0.1) * sx
            m.box(b, RED, (x, 0, 0), (0.21, 0.148, 0.128), 0.0, outline=0)
        m.sphere(b, RED, ((BOOM_L + 0.04) * sx, 0, 0), (0.09, 0.09, 0.09), mat="glow", outline=0.6, seg=10)
        m.box(b, DARK, ((BOOM_L * 0.55) * sx, -0.11, 0), (0.025, 0.12, 0.025), 0.0, outline=0)  # pendeloque
    # ── Cockpit ouvert : baquet, pare-brise, arceau, antenne, leviers ─────────────────────────
    c = "cockpit"
    m.box(c, DARK, (0, 0.12, 0), (0.86, 0.26, 0.62), 0.06)
    m.box(c, 0xBFEFFF, (0, 0.3, 0.3), (0.72, 0.14, 0.03), 0.02, rot=(-20, 0, 0), mat="glass", outline=0, emit=1.0)
    m.box(c, STEEL, (0, 0.44, -0.28), (0.78, 0.06, 0.06), 0.0)
    for sx in (1, -1):
        m.box(c, STEEL, (0.37 * sx, 0.28, -0.28), (0.06, 0.32, 0.06), 0.0)
        m.cyl(c, STEEL, (0.2 * sx, 0.32, 0.2), 0.018, 0.2, seg=6, outline=0)
        m.sphere(c, RED, (0.2 * sx, 0.43, 0.2), (0.04, 0.04, 0.04), outline=0, seg=8)
    m.cyl(c, STEEL, (-0.36, 0.66, -0.28), 0.015, 0.4, seg=6, outline=0)
    m.sphere(c, 0xFFD84A, (-0.36, 0.88, -0.28), (0.05, 0.05, 0.05), mat="glow", outline=0, seg=8, emit=1.0)
    # ── Le petit auditeur : costume gris, cravate violette, lunettes, raie sur le côté ───────
    p = "pilot"
    m.box(p, GREY, (0, 0.16, 0), (0.32, 0.32, 0.22), 0.07)
    m.box(p, SHIRT, (0, 0.24, 0.105), (0.1, 0.14, 0.02), 0.0, outline=0)
    m.box(p, TIE, (0, 0.2, 0.118), (0.045, 0.14, 0.01), 0.0, outline=0)
    m.cyl(p, GOLD, (0.0, 0.1, 0.13), 0.05, 0.02, rot=(90, 0, 0), seg=12, outline=0.5, emit=0.25)  # chronomètre
    m.cyl(p, 0xFFF4D6, (0.0, 0.1, 0.142), 0.04, 0.004, rot=(90, 0, 0), seg=12, outline=0)
    h = "pilot_head"
    K = 1.3  # tête du pilote agrandie (lisibilité à 32 m de caméra)

    def k3(v):
        return tuple(x * K for x in v)

    m.cyl(h, SKIN, (0, -0.02, 0), 0.05, 0.06, seg=8, outline=0)
    m.sphere(h, SKIN, k3((0, 0.13, 0.0)), k3((0.16, 0.16, 0.15)), seg=16)
    m.sphere(h, HAIR, k3((0.0, 0.19, -0.03)), k3((0.165, 0.12, 0.15)), seg=12)
    m.sphere(h, HAIR, k3((0.05, 0.25, 0.04)), k3((0.12, 0.05, 0.1)), seg=10, rot=(0, 0, -10))
    for sx in (1, -1):
        m.sphere(h, SKIN, k3((0.155 * sx, 0.12, 0.0)), k3((0.03, 0.045, 0.03)), seg=8)
        m.sphere(h, INK, k3((0.055 * sx, 0.14, 0.14)), k3((0.018, 0.022, 0.012)), outline=0, seg=8)
        for dy in (0.024, -0.024):
            m.box(h, INK, k3((0.055 * sx, 0.14 + dy, 0.155)), k3((0.085, 0.01, 0.01)), 0.0, outline=0)
        m.box(h, INK, k3((0.055 * sx + 0.04 * sx, 0.14, 0.155)), k3((0.01, 0.055, 0.01)), 0.0, outline=0)
        m.box(h, INK, k3((0.06 * sx, 0.19, 0.15)), k3((0.07, 0.015, 0.02)), 0.0, rot=(0, 0, -12 * sx), outline=0)  # sourcils
    m.sphere(h, 0xD8946C, k3((0, 0.1, 0.155)), k3((0.03, 0.03, 0.03)), outline=0, seg=8)
    m.box(h, 0x7A3A3A, k3((0, 0.05, 0.14)), k3((0.07, 0.014, 0.02)), 0.0, outline=0)
    for s, sx in (("L", 1), ("R", -1)):
        a = f"parm_{s}"
        m.capsule(a, GREY, (0, 0, 0), (0, -0.2, 0.0), 0.05)
        m.sphere(a, SKIN, (0, -0.24, 0.0), (0.05, 0.05, 0.05), seg=8)
    # tablette du pilote (main gauche) : il commande les rames depuis là
    m.box("parm_L", PLASTIC, (0.0, -0.26, 0.06), (0.22, 0.02, 0.16), 0.0)
    m.box("parm_L", SCREEN, (0.0, -0.248, 0.06), (0.19, 0.006, 0.13), 0.0, mat="glow", outline=0, emit=1.0)
    return m


# ─── Poses ────────────────────────────────────────────────────────────────────


def mech(lift: float = 55.0, sweep: float = 0.0, lift_r: float | None = None, sweep_r: float | None = None, crouch: float = 0.0, torso=(0, 0, 0), pilot=(0, 0, 0), head=(0, 0, 0), root=(0, 0, 0), extra: dict | None = None, scl: dict | None = None, scale=(1, 1, 1)) -> dict:
    """Pose de base : barrières levées de `lift`° (gauche, droite en miroir), balayage autour de Y,
    accroupissement 0..1 (genoux pliés, bassin bas), rotation de la caisse."""
    lr = lift if lift_r is None else lift_r
    sr = sweep if sweep_r is None else sweep_r
    k = crouch
    rot = {
        "chest": torso,
        "arm_L": (0, -sweep, 0), "arm_R": (0, sr, 0),
        "boom_L": (0, 0, lift), "boom_R": (0, 0, -lr),
        "hip_L": (-24 * k, 0, 2), "knee_L": (44 * k, 0, 0), "foot_L": (-20 * k, 0, 0),
        "hip_R": (-24 * k, 0, -2), "knee_R": (44 * k, 0, 0), "foot_R": (-20 * k, 0, 0),
        "pilot": pilot, "pilot_head": head,
        "parm_L": (-60, 0, 10), "parm_R": (-50, 0, -10),
        **(extra or {}),
    }
    return P(rot, root=(root[0], root[1] - 0.16 * k, root[2]), scl=scl, scale=scale)


def idle(t: float) -> dict:
    w = 2 * math.pi / 2.0
    s = math.sin(t * w)
    return mech(lift=55 + 4 * s, sweep=4 * s, crouch=0.08 + 0.04 * s, torso=(2 * s, 0, 0), pilot=(0, 6 * math.cos(t * w), 0), head=(-6, -10 * math.cos(t * w), 0),
                extra={"parm_R": (-70 - 10 * max(0, s), 0, -10)})


def walk(ph: float) -> dict:
    s, c = math.sin(ph), math.cos(ph)
    a = 22 * s
    p = mech(lift=50 + 6 * abs(c), sweep=6 * s, crouch=0.1, torso=(3, 6 * s, 3 * s), pilot=(0, -4 * s, 3 * s), root=(0, 0.05 * abs(c) - 0.03, 0))
    p["rot"].update({"hip_L": (-a - 6, 0, 2), "knee_L": (14 + 40 * max(0, c), 0, 0), "foot_L": (a * 0.4, 0, 0), "hip_R": (a - 6, 0, -2), "knee_R": (14 + 40 * max(0, -c), 0, 0), "foot_R": (-a * 0.4, 0, 0)})
    return p


# Balayage de barrières : il abaisse les deux barrières à l'horizontale, arme la caisse, puis pivote.
SWEEP_ARM = mech(lift=4, sweep=-40, lift_r=4, sweep_r=40, crouch=0.35, torso=(-4, 34, 0), pilot=(0, 20, 0), head=(-10, -20, 0), extra={"parm_R": (-100, 0, -10)})
SWEEP_HIT = mech(lift=-2, sweep=50, lift_r=-2, sweep_r=-50, crouch=0.45, torso=(6, -40, 0), pilot=(0, -24, 0), head=(4, 26, 0), root=(0, 0, 0.12), extra={"parm_R": (-140, 0, -20), "parm_L": (-40, 0, 20)})

# Tampon : il saute et retombe à pieds joints (onde de choc), barrières dressées.
STAMP_UP = mech(lift=86, crouch=0.0, torso=(-10, 0, 0), pilot=(-10, 0, 0), head=(-20, 0, 0), root=(0, 0.55, 0), scale=(0.95, 1.06, 0.95), extra={"hip_L": (-30, 0, 4), "knee_L": (60, 0, 0), "hip_R": (-30, 0, -4), "knee_R": (60, 0, 0), "parm_R": (-160, 0, -20), "parm_L": (-160, 0, 20)})
STAMP_DOWN = mech(lift=30, crouch=0.9, torso=(14, 0, 0), pilot=(16, 0, 0), head=(14, 0, 0), scale=(1.08, 0.9, 1.08), extra={"parm_R": (-30, 0, -40), "parm_L": (-30, 0, 40)})

# Rafale de tickets : caisse penchée en avant, fentes vers le héros.
TICKETS = mech(lift=70, crouch=0.3, torso=(18, 0, 0), pilot=(-14, 0, 0), head=(-10, 0, 0), extra={"parm_R": (-120, 0, -30), "parm_L": (-60, 0, 10)})

HURT = mech(lift=40, sweep=-10, crouch=0.2, torso=(-12, 6, 6), pilot=(-20, 0, 10), head=(-20, 0, 0), root=(0, 0, -0.1), extra={"parm_R": (-20, 0, -60), "parm_L": (-20, 0, 60)})

PLATES_OFF = {"plate_L": (0.001, 0.001, 0.001), "plate_R": (0.001, 0.001, 0.001)}


def intro(t: float) -> dict:
    off = mech(lift=0, lift_r=0, crouch=0.5, torso=(16, 0, 0), pilot=(20, 0, 0), head=(20, 0, 0))
    boot = mech(lift=90, crouch=0.0, torso=(-6, 0, 0), pilot=(-6, 0, 0), head=(-14, 0, 0), extra={"parm_R": (-150, 0, -10)})
    return keyed([(0, off), (600, off), (1100, boot, ease_back), (1500, boot), (1900, idle(0))], t)


def sweep(t: float) -> dict:
    return keyed([(0, idle(0)), (700, SWEEP_ARM, ease_out), (1000, SWEEP_ARM), (1200, SWEEP_HIT, ease_in), (1500, SWEEP_HIT), (2000, idle(0))], t)


def stamp(t: float) -> dict:
    return keyed([(0, idle(0)), (300, mech(lift=70, crouch=0.6, torso=(10, 0, 0))), (700, STAMP_UP, ease_out), (900, STAMP_UP), (1000, STAMP_DOWN, ease_in), (1400, STAMP_DOWN), (1800, idle(0))], t)


def tickets(t: float) -> dict:
    kick = lambda k: merge(TICKETS, root=(0, 0, -0.05 * k), rot={"chest": (18 - 6 * k, 0, 0)})  # noqa: E731
    return keyed([(0, idle(0)), (500, TICKETS, ease_out), (650, kick(1), ease_out), (750, TICKETS), (850, kick(1), ease_out), (950, TICKETS), (1050, kick(1), ease_out), (1150, TICKETS), (1500, idle(0))], t)


def phase2(t: float) -> dict:
    shake = lambda a, b: mech(lift=30 + a, crouch=0.4, torso=(a, b, 2 * b), pilot=(-10, b * 2, 0), head=(-20, -b * 3, 0))  # noqa: E731
    off = merge(shake(0, 0), scl=PLATES_OFF)
    roar = merge(mech(lift=88, crouch=0.1, torso=(-12, 0, 0), pilot=(-12, 0, 0), head=(-24, 0, 0), extra={"parm_R": (-170, 0, -30), "parm_L": (-170, 0, 30)}), scl=PLATES_OFF)
    return keyed([(0, idle(0)), (150, shake(6, 4)), (300, shake(-4, -5)), (450, shake(6, 5)), (600, shake(-6, -4)), (700, off), (1200, roar, ease_back), (1600, roar)], t)


def stagger(t: float) -> dict:
    w = 2 * math.pi / 1.2
    s = math.sin(t * w)
    return mech(lift=-30 + 10 * s, lift_r=-30 - 10 * s, crouch=0.55, torso=(16, 8 * s, 6 * s), pilot=(-16, 10 * s, 0), head=(-10, 20 * s, 0), extra={"parm_R": (-20, 0, -40), "parm_L": (-20, 0, 40)})


def defeat(t: float) -> dict:
    """Le mécha s'agenouille, barrières baissées ; le pilote regarde enfin son chronomètre (7:12)."""
    kneel = mech(lift=-60, lift_r=-60, crouch=0.0, torso=(22, 0, 0), extra={"hip_L": (-90, 0, 4), "knee_L": (100, 0, 0), "foot_L": (-10, 0, 0), "hip_R": (-30, 0, -4), "knee_R": (120, 0, 0), "foot_R": (-90, 0, 0)}, root=(0, -0.6, 0))
    look = merge(kneel, rot={"pilot": (-20, 0, 0), "pilot_head": (40, 0, 0), "parm_R": (-80, 0, 20), "parm_L": (-20, 0, 20)})
    return keyed([(0, HURT), (500, merge(kneel, root=(0, -0.5, 0)), ease_in), (650, kneel, ease_out), (1200, kneel), (1700, look, ease_out), (2600, look)], t)


def clips() -> list[Clip]:
    return [
        Clip("intro", 1.9, intro, events={"windup": 600}),
        Clip("idle", 2.0, lambda t: idle(t / 1000), loop=True),
        Clip("walk", 1.0, lambda t: walk(2 * math.pi * t / 1000), loop=True),
        Clip("attack-sweep", 2.0, sweep, events={"windup": 0, "active": 1100, "recovery": 1500}),
        Clip("attack-stamp", 1.8, stamp, events={"windup": 0, "active": 1000, "recovery": 1400}),
        Clip("attack-tickets", 1.5, tickets, events={"windup": 0, "active": 650, "recovery": 1150}),
        Clip("phase2", 1.6, phase2, events={"plates": 700}),
        Clip("hurt", 0.35, lambda t: keyed([(0, idle(0)), (90, HURT, ease_out), (350, idle(0))], t)),
        Clip("stagger", 1.2, lambda t: stagger(t / 1000), loop=True),
        Clip("defeat", 2.6, defeat),
    ]
