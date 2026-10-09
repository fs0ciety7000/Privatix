"""Poses et clips (port Python des outils de `prototypes/proto3d/src/rig.ts`).

Une pose est un dict :
  rot   : {os: (x, y, z)} en degrés, Euler **YXZ** dans le repère Three.js (Y haut, +Z avant) ;
          membres pendants : x < 0 porte vers l'avant, z > 0 écarte vers +X (gauche du perso) ;
          tronc / tête : x > 0 penche vers l'avant, y = rotation sur soi (vers sa gauche).
  root  : décalage du corps (os `root`, aux pieds), en m.
  scale : échelle du corps (os `root`) : squash & stretch autour des pieds.
  loc   : {os: (dx, dy, dz)} décalage depuis la position de repos.
  scl   : {os: (sx, sy, sz)} échelle d'un os (bascules de visibilité : 0 ou 1).

Un clip = Clip(nom, durée en s, fonction t_ms → pose, boucle, événements).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Callable

ZERO = (0.0, 0.0, 0.0)
ONE = (1.0, 1.0, 1.0)


def P(rot: dict | None = None, root=ZERO, scale=ONE, loc: dict | None = None, scl: dict | None = None) -> dict:
    return {"rot": dict(rot or {}), "root": tuple(root), "scale": tuple(scale), "loc": dict(loc or {}), "scl": dict(scl or {})}


def merge(a: dict, rot: dict | None = None, root=None, scale=None, loc=None, scl=None) -> dict:
    return {
        "rot": {**a["rot"], **(rot or {})},
        "root": tuple(root) if root is not None else a["root"],
        "scale": tuple(scale) if scale is not None else a["scale"],
        "loc": {**a.get("loc", {}), **(loc or {})},
        "scl": {**a.get("scl", {}), **(scl or {})},
    }


def _l3(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)


def lerp_pose(a: dict, b: dict, t: float) -> dict:
    keys = set(a["rot"]) | set(b["rot"])
    rot = {k: _l3(a["rot"].get(k, ZERO), b["rot"].get(k, ZERO), t) for k in keys}
    la, lb = a.get("loc", {}), b.get("loc", {})
    loc = {k: _l3(la.get(k, ZERO), lb.get(k, ZERO), t) for k in set(la) | set(lb)}
    sa, sb = a.get("scl", {}), b.get("scl", {})
    scl = {k: _l3(sa.get(k, ONE), sb.get(k, ONE), t) for k in set(sa) | set(sb)}
    return {"rot": rot, "root": _l3(a["root"], b["root"], t), "scale": _l3(a["scale"], b["scale"], t), "loc": loc, "scl": scl}


def ease_in_out(t: float) -> float:
    return t * t * (3 - 2 * t)


def ease_out(t: float) -> float:
    return 1 - (1 - t) ** 3


def ease_in(t: float) -> float:
    return t * t * t


def ease_back(t: float) -> float:
    """Dépasse puis revient (rebond d'arrivée)."""
    c1, c3 = 1.70158, 2.70158
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2


def linear(t: float) -> float:
    return t


def keyed(keys: list, t_ms: float) -> dict:
    """Poses clés [(t_ms, pose, easing?)] ; l'easing d'une clé s'applique au segment qui y arrive."""
    if t_ms <= keys[0][0]:
        return keys[0][1]
    for i in range(len(keys) - 1):
        ta, pa = keys[i][0], keys[i][1]
        tb, pb = keys[i + 1][0], keys[i + 1][1]
        e = keys[i + 1][2] if len(keys[i + 1]) > 2 else ease_in_out
        if t_ms <= tb:
            u = 1.0 if tb == ta else (t_ms - ta) / (tb - ta)
            return lerp_pose(pa, pb, e(u))
    return keys[-1][1]


def wave(t: float, period: float, phase: float = 0.0) -> float:
    """Sinus de période `period` (s) : boucle parfaite si la durée du clip en est un multiple."""
    return math.sin(2 * math.pi * t / period + phase)


@dataclass
class Clip:
    name: str
    duration: float  # s
    fn: Callable[[float], dict]  # t en ms → pose
    loop: bool = False
    events: dict = field(default_factory=dict)  # {nom: t_ms} (début actif, impact…)
    channels: tuple = ()  # os animés en plus des rotations : laissé vide = auto
