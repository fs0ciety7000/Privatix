"""Outils de pose partagés (même logique que hero.py, étendue) : poses image par image, interpolation,
décalages et échelles d'articulations (squash & stretch), pièces à afficher par frame (`show`).

Une pose est un dict :
  rot     : {articulation: (rx, ry, rz)} en degrés
  root    : décalage du personnage (m)
  smear   : pièces « smear » visibles (module.SMEARS)
  show    : pièces « bascule » visibles (module.TOGGLES : écran allumé, étincelles, tickets…)
  offsets : {articulation: (dx, dy, dz)} décalage depuis la position de repos
  scales  : {articulation: (sx, sy, sz)}
"""
from __future__ import annotations

import math

Pose = dict


def pose(rot: dict | None = None, root=(0.0, 0.0, 0.0), smear=None, show=None, offsets=None, scales=None) -> Pose:
    return {"rot": dict(rot or {}), "root": tuple(root), "smear": list(smear or []), "show": list(show or []), "offsets": dict(offsets or {}), "scales": dict(scales or {})}


def merge(p: Pose, rot: dict | None = None, root=None, smear=None, show=None, offsets=None, scales=None, add_show=None) -> Pose:
    out = {
        "rot": {**p["rot"], **(rot or {})},
        "root": tuple(root) if root is not None else p["root"],
        "smear": list(smear) if smear is not None else list(p["smear"]),
        "show": list(show) if show is not None else list(p.get("show", [])),
        "offsets": {**p.get("offsets", {}), **(offsets or {})},
        "scales": {**p.get("scales", {}), **(scales or {})},
    }
    if add_show:
        out["show"] = out["show"] + [s for s in add_show if s not in out["show"]]
    return out


def _lerp3(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def lerp_pose(a: Pose, b: Pose, t: float) -> Pose:
    rot = {k: _lerp3(a["rot"].get(k, (0, 0, 0)), b["rot"].get(k, (0, 0, 0)), t) for k in set(a["rot"]) | set(b["rot"])}
    ao, bo = a.get("offsets", {}), b.get("offsets", {})
    offs = {k: _lerp3(ao.get(k, (0, 0, 0)), bo.get(k, (0, 0, 0)), t) for k in set(ao) | set(bo)}
    asc, bsc = a.get("scales", {}), b.get("scales", {})
    scl = {k: _lerp3(asc.get(k, (1, 1, 1)), bsc.get(k, (1, 1, 1)), t) for k in set(asc) | set(bsc)}
    near = a if t < 0.5 else b
    return {"rot": rot, "root": _lerp3(a["root"], b["root"], t), "smear": list(near["smear"]), "show": list(near.get("show", [])), "offsets": offs, "scales": scl}


def keyed(keys: list[tuple[int, Pose]], i: int, ease: bool = True) -> Pose:
    """Poses clés (frame, pose) ; interpolation lissée (smoothstep) entre deux clés."""
    for (fa, pa), (fb, pb) in zip(keys, keys[1:]):
        if fa <= i <= fb:
            t = 0.0 if fb == fa else (i - fa) / (fb - fa)
            if ease:
                t = t * t * (3 - 2 * t)
            return lerp_pose(pa, pb, t)
    return keys[-1][1]


def wave(t: float, phase: float = 0.0) -> float:
    return math.sin(2 * math.pi * t + phase)
