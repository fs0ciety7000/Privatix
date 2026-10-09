"""Gabarit générique de personnage humanoïde (ennemis, élite, PNJ).

Tête et torse sont des matrices dessinées à la main par direction ; jambes et
bras sont posés par un squelette minimal (hanche -> genou -> pied, épaule ->
main) et colorés en tons proche / lointain. Tout est contouré en #14101A.
"""
import numpy as np

import lib
from lib import blit, canvas
from palette import CHAR, K

c = CHAR


class Humanoid:
    def __init__(self, size, foot, heads, torsos, leg_len, leg_w=3, gap=2,
                 pants=("i", "d", "n"), shoes=("w", "b", "s"), sleeve=("i", "d"), hand=("p", "z"),
                 neck=1, torso_dx=0, side_torso_dx=0, shoulder_dy=1, arm_w=2, hand_size=2, hip_color=None):
        self.S = size
        self.F = foot  # dernière ligne colorée (semelles)
        self.heads = heads
        self.torsos = torsos
        self.L = leg_len
        self.lw = leg_w
        self.gap = gap
        self.pants = [c[x] for x in pants]
        self.shoes = [c[x] for x in shoes]
        self.sleeve = [c[x] for x in sleeve]
        self.hand = [c[x] for x in hand]
        self.neck = neck
        self.side_torso_dx = side_torso_dx
        self.shoulder_dy = shoulder_dy
        self.arm_w = arm_w
        self.hand_size = hand_size
        self.hip_color = hip_color

    # ---------------------------------------------------------------- géométrie
    def layout(self, view, bob=0):
        S = self.S
        cx = S // 2
        t = self.torsos[view]
        h = self.heads[view]
        hip_y = self.F - self.L + 1 + bob
        torso_y = hip_y - t.shape[0] + 1
        head_y = torso_y - h.shape[0] + self.neck
        tx = cx - t.shape[1] // 2 + (self.side_torso_dx if view == "side" else 0)
        hx = cx - h.shape[1] // 2
        return dict(cx=cx, hip_y=hip_y, torso_y=torso_y, head_y=head_y, tx=tx, hx=hx,
                    tw=t.shape[1], th=t.shape[0])

    def default_hands(self, view, bob=0):
        g = self.layout(view, bob)
        y = g["torso_y"] + g["th"] - 2
        if view == "side":
            return (g["cx"] + 1, y), (g["cx"] - 3, y)
        return (g["tx"] - self.arm_w, y), (g["tx"] + g["tw"], y)

    def shoulders(self, view, g, lean=0):
        y = g["torso_y"] + self.shoulder_dy
        if view == "side":
            return (g["cx"] - 1 + lean, y), (g["cx"] + lean, y)
        return (g["tx"] - self.arm_w + 1 + lean, y), (g["tx"] + g["tw"] - 1 + lean, y)

    # ---------------------------------------------------------------- jambes
    def legs_front(self, a, g, feet, view, spread=0):
        lw, gap = self.lw, self.gap
        cx = g["cx"]
        hip = g["hip_y"]
        x_l = cx - gap // 2 - lw - spread
        x_r = cx + (gap + 1) // 2 + spread
        p_hi, p_mid, p_sh = self.pants
        lib.rect(a, x_l, hip, x_r + lw - x_l, 1, self.hip_color or p_mid)
        for x0, foot, left in ((x_l, feet[0], True), (x_r, feet[1], False)):
            for yy in range(hip + 1, foot):
                for i in range(lw):
                    col = p_mid
                    if left and i == 0:
                        col = p_hi
                    if i == lw - 1:
                        col = p_sh
                    a[yy, x0 + i] = col
            s_hi, s_mid, s_sh = self.shoes
            for i in range(lw + (1 if view == "down" else 0)):
                xx = x0 + i - (1 if (view == "down" and left) else 0)
                a[foot, xx] = s_sh if i == lw else (s_hi if view == "down" else s_mid)
                if view == "down" and foot - 1 > hip:
                    a[foot - 1, x0 + min(i, lw - 1)] = s_hi if i < lw - 1 else s_mid
            if view == "up":
                for i in range(lw):
                    a[foot, x0 + i] = s_sh

    def leg_side(self, a, hip, foot, knee, near):
        p_hi, p_mid, p_sh = self.pants
        col = p_mid if near else p_sh
        sh = p_sh if near else c["K"]
        hx, hy = hip
        fx, fy = foot
        kx, ky = knee
        w = self.lw - 1 if self.lw > 2 else 2
        lib.thick_line(a, hx, hy, kx, ky, col, w)
        lib.thick_line(a, kx, ky, fx, fy - 1, col, w)
        lib.line(a, hx + w - 1, hy, kx + w - 1, ky, sh)
        s_hi, s_mid, s_sh = self.shoes
        sc = s_hi if near else s_mid
        lib.rect(a, fx - 1, fy - 1, w + 2, 2, sc)
        lib.rect(a, fx - 1, fy, w + 2, 1, s_mid if near else s_sh)

    def legs_side(self, a, g, phase, near_first=True, stride=None):
        """phase : 0..1 du cycle de course (0 = contact jambe proche devant)."""
        import math

        cx = g["cx"]
        hip = g["hip_y"]
        st = stride if stride is not None else max(2, self.L // 2)
        order = []
        for leg, off in (("near", 0.0), ("far", 0.5)):
            p = (phase + off) % 1.0
            # pied : avance pendant l'appui (0 -> 0.5), revient en l'air (0.5 -> 1)
            ang = 2 * math.pi * p
            fx = cx - 1 + int(round(st * math.cos(ang)))
            lift = max(0.0, -math.sin(ang))
            fy = self.F - int(round(lift * max(1, self.L // 3)))
            kx = (cx - 1 + fx) // 2 + (1 if lift > 0.2 else 0)
            ky = (hip + fy) // 2 - (1 if lift > 0.2 else 0)
            order.append((leg, (cx - 1, hip + 1), (fx, fy), (kx, ky)))
        order.sort(key=lambda o: 0 if o[0] == "far" else 1)
        for leg, hp, ft, kn in order:
            self.leg_side(a, hp, ft, kn, near=(leg == "near"))

    # ---------------------------------------------------------------- bras
    def arm(self, a, sh, hand, far=False, edge=None):
        layer = canvas(self.S)
        col = self.sleeve[1] if far else self.sleeve[0]
        lib.thick_line(layer, sh[0], sh[1], hand[0], hand[1], col, self.arm_w)
        hs = self.hand_size
        lib.rect(layer, hand[0], hand[1], hs, hs, self.hand[1] if far else self.hand[0])
        if hs > 1:
            lib.px(layer, hand[0] + hs - 1, hand[1] + hs - 1, self.hand[1])
        blit(a, layer, 0, 0, edge=edge)

    # ---------------------------------------------------------------- frame
    def frame(self, view, P):
        """P : bob, lean, head (dx, dy), feet (gauche, droite) ou phase (profil),
        hands ((x, y) main d'objet, (x, y) autre), item (fonction(layer, main, P)),
        item_layer 'front'|'back', head_art / torso_art (remplacements),
        overlay (fonction(a, g) après contour), arms False pour les masquer."""
        S = self.S
        a = canvas(S)
        bob = P.get("bob", 0)
        lean = P.get("lean", 0)
        hdx, hdy = P.get("head", (0, 0))
        g = self.layout(view, bob)
        legs = canvas(S)
        if P.get("legs", True):
            if view in ("down", "up"):
                self.legs_front(legs, g, P.get("feet", (self.F, self.F)), view, P.get("spread", 0))
            else:
                if "phase" in P:
                    self.legs_side(legs, g, P["phase"], stride=P.get("stride"))
                else:
                    self.legs_side(legs, g, 0.25, stride=P.get("stride", 1))
        hands = P.get("hands") or self.default_hands(view, bob)
        h_item, h_other = hands
        sh_item, sh_other = self.shoulders(view, g, lean)
        if view == "up":
            sh_item, sh_other = sh_other, sh_item
        item = canvas(S)
        if P.get("item"):
            P["item"](item, h_item, P)
        il = P.get("item_layer", "front")
        torso = P.get("torso_art", self.torsos[view])
        head = P.get("head_art", self.heads[view])
        arms = P.get("arms", True)

        if il == "back":
            blit(a, item, 0, 0)
        if arms and view == "side":
            self.arm(a, sh_other, h_other, far=True)
        if arms and view == "up":
            self.arm(a, sh_item, h_item)
            self.arm(a, sh_other, h_other)
        blit(a, legs, 0, 0)
        blit(a, torso, g["tx"] + lean, g["torso_y"])
        if il == "mid":
            blit(a, item, 0, 0, edge=K)
        blit(a, head, g["hx"] + lean + hdx, g["head_y"] + hdy)
        if il == "front":
            blit(a, item, 0, 0, edge=K)
        if arms and view == "down":
            self.arm(a, sh_other, h_other, edge=P.get("arm_edge"))
            self.arm(a, sh_item, h_item, edge=P.get("arm_edge"))
        elif arms and view == "side":
            self.arm(a, sh_item, h_item, edge=P.get("arm_edge"))
        if il == "top":
            blit(a, item, 0, 0, edge=K)
        if P.get("pre_outline"):
            P["pre_outline"](a, g)
        a = lib.outline(a)
        if P.get("overlay"):
            P["overlay"](a, g)
        return a


def flash_white(f):
    out = f.copy()
    out[(f > 0) & (f != K)] = c["W"]
    return out


def dissolve(f, amount, seed=0, into=None):
    """Désintègre une frame : retire une fraction des pixels (motif ordonné)."""
    r = lib.rng(seed).random(f.shape)
    out = f.copy()
    out[r < amount] = 0
    if into is not None:
        edge = (out > 0) & (r < amount + 0.12)
        out[edge] = into
    return out
