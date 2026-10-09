"""Borne Automatique Rebelle et Drone Optimètre (32×32, 1 direction)."""
import math

import numpy as np

import lib
from font3x5 import draw_text
from humanoid import dissolve, flash_white
from lib import parse, canvas, blit
from palette import CHAR, K

c = CHAR
S = 32

# --------------------------------------------------------------------------
# Borne automatique : vue 3/4, dessus clair, façade acier, livrée turquoise
# --------------------------------------------------------------------------
BORNE = parse(
    """
    ...bbbbbbbbbbbbbb...
    ..bwwbbbbbbbbbbbgg..
    .bwbbbbbbbbbbbbbbgg.
    .gggggggggggggggggs.
    .gTTTTTTTTTTTTTTTus.
    .gNTTTTTTTTTTTTTTus.
    .gdddddddddddddddds.
    .gd..............ds.
    .gd..............ds.
    .gd..............ds.
    .gd..............ds.
    .gd..............ds.
    .gd..............ds.
    .gddddddddddddddddd.
    .gsssssssssssssssds.
    .gsbsbsbssssdKKdsds.
    .gsssssssssssNNssds.
    .gsbsbsbssssssssssd.
    .gssssssssssssssdsd.
    .gsdKKKKKKKKKKdssds.
    .gssssssssssssssdsd.
    .guTTTTTTTTTTTTTuud.
    .gsssssssssssssssdd.
    ddddddddddddddddddds
    .dd..............dd.
    """
)
BX, BY = 6, 2  # coin haut-gauche (bas de la borne : ligne 26)
SCREEN = (BX + 3, BY + 7, 14, 6)  # x, y, w, h (intérieur de l'écran)


def borne_frame(screen="hs", blink=0, slot=None, ticket=0, crack=False, dy=0, dx=0, flash=False):
    a = canvas(S)
    body = BORNE.copy()
    sx, sy, sw, sh = SCREEN
    blit(a, body, BX + dx, BY + dy)
    scr = canvas(sw, sh)
    if screen == "hs":
        scr[:] = c["n"]
        if blink:
            draw_text(scr, "HS", 2, 1, c["T"])
            lib.rect(scr, 10, 2, 2, 2, c["N"])
        else:
            lib.rect(scr, 1, 4, 12, 1, c["u"])
    elif screen == "on":
        scr[:] = c["u"]
        draw_text(scr, "PRIV", -1, 0, c["N"])
        lib.rect(scr, 1, 5, 12, 1, c["T"])
    elif screen == "boot":
        scr[:] = c["n"]
        lib.rect(scr, 1, 2, blink, 2, c["T"])
    elif screen == "print":
        scr[:] = c["R"] if blink % 2 == 0 else c["M"]
        draw_text(scr, "!!!", 3, 0, c["W"] if blink % 2 else c["M"])
        lib.rect(scr, 1, 5, 12, 1, c["W"] if blink % 2 else c["M"])
    elif screen == "dead":
        scr[:] = c["K"]
        for (x, y) in ((3, 1), (4, 2), (5, 2), (6, 3), (9, 1), (8, 2)):
            lib.px(scr, x, y, c["s"])
    elif screen == "hurt":
        scr[:] = c["W"]
        lib.rect(scr, 0, 2, 14, 1, c["T"])
    if crack:
        for (x, y) in ((8, 0), (8, 1), (9, 2), (9, 3), (10, 4), (7, 3), (6, 4), (11, 2)):
            lib.px(scr, x, y, c["W"] if screen != "dead" else c["g"])
    blit(a, scr, sx + dx, sy + dy)
    # fente à tickets
    if slot:
        lib.rect(a, BX + 4 + dx, BY + 19 + dy, 10, 1, c[slot])
    if ticket:
        # ticket qui sort de la fente
        t = canvas(S)
        lib.rect(t, BX + 7 + dx, BY + 19 + dy, 4, ticket, c["w"])
        lib.rect(t, BX + 7 + dx, BY + 19 + dy + ticket - 1, 4, 1, c["M"])
        blit(a, t, 0, 0)
    a = lib.outline(a)
    if flash:
        a = flash_white(a)
    return a


def borne_idle():
    return [borne_frame("hs", blink=b) for b in (1, 1, 0, 0)]


def borne_wake():
    """Se déplie d'une trappe au sol."""
    out = []
    full = borne_frame("boot", blink=0)
    for i, h in enumerate((4, 9, 15, 21, 25, 26)):
        f = canvas(S)
        # trappe
        hatch = canvas(S)
        lib.rect(hatch, 4, 24, 24, 4, c["d"])
        lib.rect(hatch, 5, 25, 22, 2, c["K"])
        lib.rect(hatch, 4, 24, 24, 1, c["s"])
        if i < 5:
            blit(f, hatch, 0, 0)
        part = full.copy()
        if i == 5:
            part = borne_frame("on")
        top_cut = 28 - h
        sub = canvas(S)
        # la borne monte : on affiche les h lignes du haut, décalées en bas
        rows = part[2 : 2 + h + 1, :]
        blit(sub, rows, 0, 27 - rows.shape[0] + 1)
        blit(f, sub, 0, 0)
        if 1 <= i <= 3:
            for (x, y) in ((3, 25), (28, 24), (2, 23), (29, 26)):
                lib.px(f, x + (i % 2), y - i, c["b"])
        out.append(f)
    return out


def borne_attack():
    # écran rouge-magenta dès la frame 0 (télégraphe), tir frame 4
    return [
        borne_frame("print", blink=0, slot="R"),
        borne_frame("print", blink=1, slot="M"),
        borne_frame("print", blink=0, slot="M", dy=1),
        borne_frame("print", blink=1, slot="W", dy=1),
        borne_frame("print", blink=1, slot="W", ticket=5, dy=-1),
        borne_frame("on", slot="R", dy=0),
    ]


def borne_hurt():
    return [borne_frame("hurt", dx=-1, crack=True, flash=False), borne_frame("hs", blink=1, dx=1, crack=True)]


def borne_death():
    out = []
    for i in range(4):
        f = borne_frame("dead" if i else "hurt", crack=True, dx=(1 if i % 2 else -1), dy=i // 2)
        # étincelles et fumée
        for j in range(3 + i):
            ang = j * 2.1 + i
            x = 16 + int(math.cos(ang) * (6 + i * 2))
            y = 12 + int(math.sin(ang) * (4 + i))
            lib.px(f, x, y, c["y"] if j % 2 else c["W"])
        if i >= 2:
            f = dissolve(f, 0.08 * i, seed=i)
        out.append(f)
    return out


def borne_wreck():
    """Épave persistante : écran noir fêlé, carcasse affaissée, pas de turquoise vif."""
    f = borne_frame("dead", crack=True, dy=2)
    f[f == c["T"]] = c["u"]
    f[f == c["N"]] = c["u"]
    # tôle froissée en haut
    f[:6, :] = np.where(f[:6, :] > 0, f[:6, :], 0)
    for (x, y) in ((9, 4), (10, 5), (11, 4), (20, 5), (21, 4)):
        lib.px(f, x, y, c["d"])
    # tickets épars au sol
    for (x, y) in ((3, 27), (27, 26), (28, 27)):
        lib.rect(f, x, y, 2, 1, c["w"])
    return f


# --------------------------------------------------------------------------
# Drone Optimètre : quadrirotor, œil-caméra, antenne KPI
# --------------------------------------------------------------------------
DRONE_BODY = parse(
    """
    ...uTTTTu...
    .uTNNTTTTTu.
    uTNTTTTTTTTu
    uTTsssssssTu
    usssddddddsu
    ussd....dssu
    ussd....dssu
    .usdddddddu.
    ..uuuuuuuu..
    """
)
# l'œil (ouverture 4×2 au centre) est dessiné dynamiquement


def _rotor(a, cx, cy, phase, col_blade=("w", "b")):
    """Moyeu + pales qui tournent (4 phases)."""
    lib.ellipse(a, cx, cy, 3.6, 1.6, c["d"])
    # disque flou des pales
    pts = {
        0: [(-3, 0), (-2, 0), (2, 0), (3, 0)],
        1: [(-3, -1), (-2, -1), (2, 1), (3, 1)],
        2: [(-1, -1), (0, -1), (0, 1), (1, 1)],
        3: [(-3, 1), (-2, 1), (2, -1), (3, -1)],
    }[phase % 4]
    lib.ellipse(a, cx, cy, 3.6, 1.6, c["s"])
    for (dx, dy) in pts:
        lib.px(a, int(cx + dx - 0.5), int(cy + dy - 0.5), c[col_blade[0]])
    lib.px(a, int(cx - 0.5), int(cy - 0.5), c["K"])


def drone_frame(phase=0, dy=0, eye="N", led=None, tilt=0, flash=False, antenna=True, dx=0, rotors=True):
    a = canvas(S)
    cx, cy = 16 + dx, 13 + dy
    # bras
    arms = canvas(S)
    for (ox, oy) in ((-8, -4), (8, -4), (-8, 3), (8, 3)):
        lib.thick_line(arms, cx - 0.5, cy, cx + ox - 0.5, cy + oy + tilt * (1 if oy < 0 else -1) // 2, c["d"], 2)
    blit(a, arms, 0, 0)
    if rotors:
        for i, (ox, oy) in enumerate(((-9, -5), (9, -5), (-9, 3), (9, 3))):
            _rotor(a, cx + ox, cy + oy + (tilt if oy > 0 else 0), phase + i)
    body = DRONE_BODY.copy()
    bx, by = cx - 6, cy - 4
    blit(a, body, bx, by)
    # œil-caméra
    eye_m = canvas(S)
    lib.rect(eye_m, bx + 4, by + 5, 4, 2, c["K"])
    lib.rect(eye_m, bx + 5, by + 5, 2, 2, c[eye])
    lib.px(eye_m, bx + 5, by + 5, c["W"])
    blit(a, eye_m, 0, 0)
    if antenna:
        lib.line(a, cx + 3, by - 1, cx + 4, by - 3, c["s"])
        lib.px(a, cx + 4, by - 4, c[led or "T"])
    a = lib.outline(a)
    if led == "M":
        for (x, y) in ((cx + 4, by - 6), (cx + 6, by - 4), (cx + 2, by - 5)):
            lib.px(a, x, y, c["M"])
    if flash:
        a = flash_white(a)
    return a


def drone_fly():
    return [drone_frame(phase=i, dy=(0, -1, -1, 0)[i]) for i in range(4)]


def drone_attack():
    out = []
    # 0-3 visée : LED magenta, œil qui se resserre, recul
    for i in range(4):
        f = drone_frame(phase=i, dy=-1 - (i // 2), eye="M" if i >= 1 else "N", led="M" if i % 2 else "N")
        if i >= 2:
            # viseur magenta autour de l'œil
            for (x, y) in ((13, 18 - i // 2), (18, 18 - i // 2)):
                lib.px(f, x, y, c["M"])
        out.append(f)
    # 4-7 plongeon : corps incliné, traînée magenta/turquoise
    for i in range(4):
        f = drone_frame(phase=i, dy=2 + (i % 2), eye="M", led="M", tilt=1)
        trail = canvas(S)
        for j in range(3):
            y = 3 + j * 2 - (i % 2)
            lib.rect(trail, 13 + j, y, 1 + (2 - j), 1, c["M"] if j == 0 else c["T"])
            lib.px(trail, 19 - j, y, c["M"] if j == 0 else c["N"])
        m = (f == 0) & (trail > 0)
        f[m] = trail[m]
        out.append(f)
    return out


def drone_hurt():
    return [drone_frame(phase=0, dy=-1, dx=-1, flash=True), drone_frame(phase=2, dy=0, dx=1, eye="W")]


def drone_death():
    out = []
    base = drone_frame(phase=0, eye="K", led="K", rotors=True)
    for i in range(6):
        f = canvas(S)
        rot = lib.rot90(base, i % 4)
        y = min(i * 3, 12)
        blit(f, rot, 0, y - 0)
        if i >= 4:
            f = dissolve(f, 0.25 * (i - 3), seed=i + 3, into=c["T"])
        # fumée
        for j in range(i):
            lib.px(f, 15 + (j % 3) - 1, max(0, y + 4 - j * 2), c["g"] if j % 2 else c["b"])
        out.append(f)
    return out


def build(emit):
    emit("enemies", "borne_idle_strip4", borne_idle(), 200, loop=True)
    emit("enemies", "borne_wake_strip6", borne_wake(), 80, events={"invulnerable": [0, 1, 2, 3, 4, 5]})
    emit("enemies", "borne_attack_strip6", borne_attack(), [100, 100, 100, 80, 60, 120], active=[4],
         events={"telegraph": [0, 1, 2, 3], "shoot": 4, "projectile": "proj-ticket"})
    emit("enemies", "borne_hurt_strip2", borne_hurt(), 80)
    emit("enemies", "borne_death_strip4", borne_death(), 80, events={"vfx": {"3": "vfx_explosion"}})
    emit("enemies", "borne_wreck_strip1", [borne_wreck()], 1000)
    emit("enemies", "drone_fly_strip4", drone_fly(), 60, loop=True, notes="ombre shadow_s 8 px sous le drone")
    emit("enemies", "drone_attack_strip8", drone_attack(), [120] * 4 + [60] * 4, active=[4, 5, 6, 7],
         events={"telegraph": [0, 1, 2, 3], "loopFrames": [4, 7]})
    emit("enemies", "drone_hurt_strip2", drone_hurt(), 80)
    emit("enemies", "drone_death_strip6", drone_death(), 80, events={"vfx": {"5": "vfx_poof"}})
