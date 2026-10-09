"""Géométrie procédurale des modèles GLB (numpy pur, sans bpy).

Tout est écrit dans le repère de Three.js / glTF, comme le prototype `prototypes/proto3d` :
Y vers le haut, le personnage regarde vers +Z, sa droite est en -X, 1 unité = 1 m, pieds à l'origine.
La conversion vers Blender (Z vers le haut) est faite au moment de créer les objets (`blend.py`).

Un `Model` = un squelette (os, sockets) + des pièces. Chaque pièce est rigide : tous ses sommets
sont pondérés à 100 % sur un os (sauf pièces « tube » à poids répartis, cf. `Model.tube`).
Les rotations de pièces sont des Euler XYZ en degrés (ordre par défaut de `Object3D.rotation`),
pour recopier les pièces du prototype telles quelles.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

D2R = math.pi / 180

# ─── Couleurs ──────────────────────────────────────────────────────────────────


def hex_rgb(c: int) -> tuple[float, float, float]:
    """0xRRGGBB → (r, g, b) sRGB en [0, 1]."""
    return ((c >> 16) & 255) / 255.0, ((c >> 8) & 255) / 255.0, (c & 255) / 255.0


def srgb_to_linear(c: np.ndarray) -> np.ndarray:
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


# ─── Matrices ──────────────────────────────────────────────────────────────────


def rot_x(a: float) -> np.ndarray:
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]], dtype=float)


def rot_y(a: float) -> np.ndarray:
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]], dtype=float)


def rot_z(a: float) -> np.ndarray:
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]], dtype=float)


def euler_xyz(r: tuple[float, float, float] | None) -> np.ndarray:
    """Euler XYZ (degrés) de Three.js : M = Rx · Ry · Rz."""
    if not r:
        return np.eye(3)
    return rot_x(r[0] * D2R) @ rot_y(r[1] * D2R) @ rot_z(r[2] * D2R)


def align_y(d: np.ndarray) -> np.ndarray:
    """Rotation qui amène +Y sur la direction `d` (Quaternion.setFromUnitVectors)."""
    d = d / (np.linalg.norm(d) + 1e-12)
    y = np.array([0.0, 1.0, 0.0])
    v = np.cross(y, d)
    c = float(np.dot(y, d))
    if c < -0.999999:
        return np.diag([1.0, -1.0, -1.0])
    k = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + k + k @ k * (1.0 / (1.0 + c))


# ─── Primitives (unitaires ou dimensionnées) ───────────────────────────────────
# Chaque générateur renvoie (V: (n,3) float, F: list[tuple[int, ...]]) ; les faces sont orientées
# vers l'extérieur (ordre anti-horaire vu de l'extérieur). Les arêtes vives sont obtenues en NE soudant
# PAS les sommets (bouchons de cylindre, faces de boîte), le lissage se fait donc partout.


def lathe(profile: list[tuple[float, float]], seg: int, close_bottom: bool = True, close_top: bool = True) -> tuple[np.ndarray, list]:
    """Révolution autour de Y d'un profil (rayon, y) du bas vers le haut. Les rayons nuls deviennent
    des pôles soudés."""
    V: list = []
    F: list = []
    rings: list[list[int]] = []
    for r, y in profile:
        if r <= 1e-6:
            V.append((0.0, y, 0.0))
            rings.append([len(V) - 1] * seg)
        else:
            start = len(V)
            for i in range(seg):
                a = 2 * math.pi * i / seg
                V.append((r * math.sin(a), y, r * math.cos(a)))
            rings.append(list(range(start, start + seg)))
    for k in range(len(rings) - 1):
        a, b = rings[k], rings[k + 1]
        for i in range(seg):
            j = (i + 1) % seg
            if a[i] == a[j]:  # pôle bas
                F.append((a[i], b[i], b[j]))
            elif b[i] == b[j]:  # pôle haut
                F.append((a[i], b[i], a[j]))
            else:
                F.append((a[i], b[i], b[j], a[j]))
    # Orientation : on veut des normales sortantes. Vérifiée sur un triangle de flanc.
    V = np.array(V, dtype=float)
    F = _fix_winding(V, F)
    if close_bottom and profile[0][0] > 1e-6:
        V, F = _cap(V, F, rings[0], profile[0][1], down=True)
    if close_top and profile[-1][0] > 1e-6:
        V, F = _cap(V, F, rings[-1], profile[-1][1], down=False)
    return V, F


def _fix_winding(V: np.ndarray, F: list) -> list:
    """Retourne les faces si la majorité pointe vers l'axe Y (profil de révolution)."""
    score = 0.0
    for f in F[:: max(1, len(F) // 40)]:
        p = V[list(f)]
        n = np.cross(p[1] - p[0], p[2] - p[0])
        c = p.mean(axis=0)
        radial = np.array([c[0], 0.0, c[2]])
        score += float(np.dot(n, radial))
    if score < 0:
        return [tuple(reversed(f)) for f in F]
    return F


def _cap(V: np.ndarray, F: list, ring: list[int], y: float, down: bool) -> tuple[np.ndarray, list]:
    """Bouchon plat (sommets dupliqués : arête vive)."""
    pts = V[ring]
    base = len(V)
    center = np.array([[0.0, y, 0.0]])
    V = np.vstack([V, pts, center])
    c = base + len(ring)
    n = len(ring)
    for i in range(n):
        j = (i + 1) % n
        F.append((base + i, base + j, c) if down else (base + j, base + i, c))
    # vérifie l'orientation
    p = V[list(F[-1])]
    nrm = np.cross(p[1] - p[0], p[2] - p[0])
    if (nrm[1] > 0) == down:
        for k in range(n):
            F[-1 - k] = tuple(reversed(F[-1 - k]))
    return V, F


def sphere(seg: int = 18, rows: int | None = None) -> tuple[np.ndarray, list]:
    rows = rows or max(8, round(seg * 0.7))
    prof = [(math.sin(math.pi * i / rows), -math.cos(math.pi * i / rows)) for i in range(rows + 1)]
    return lathe(prof, seg, False, False)


def hemi(seg: int = 20, rows: int = 8) -> tuple[np.ndarray, list]:
    """Demi-sphère supérieure, fermée en dessous (fond plat)."""
    prof = [(math.cos(0.5 * math.pi * i / rows), math.sin(0.5 * math.pi * i / rows)) for i in range(rows + 1)]
    return lathe(prof, seg, True, False)


def cylinder(rt: float, rb: float, h: float, seg: int = 14, caps: bool = True) -> tuple[np.ndarray, list]:
    return lathe([(rb, -h / 2), (rt, h / 2)], seg, caps, caps)


def capsule(r: float, length: float, cap_seg: int = 4, radial: int = 12, r2: float | None = None) -> tuple[np.ndarray, list]:
    """Capsule le long de Y, centrée (comme CapsuleGeometry), rayon bas r, haut r2."""
    r2 = r if r2 is None else r2
    h = max(0.001, length) / 2
    prof = []
    for i in range(cap_seg + 1):
        a = -math.pi / 2 + (math.pi / 2) * i / cap_seg
        prof.append((r * math.cos(a), -h + r * math.sin(a)))
    for i in range(cap_seg + 1):
        a = (math.pi / 2) * i / cap_seg
        prof.append((r2 * math.cos(a), h + r2 * math.sin(a)))
    return lathe(prof, radial, False, False)


def cone(r: float, h: float, seg: int = 8) -> tuple[np.ndarray, list]:
    return lathe([(r, -h / 2), (0.0, h / 2)], seg, True, False)


def torus(R: float, r: float, radial: int = 8, tubular: int = 24) -> tuple[np.ndarray, list]:
    """Tore dans le plan XY (axe Z), comme TorusGeometry."""
    V, F = [], []
    for j in range(radial):
        v = 2 * math.pi * j / radial
        for i in range(tubular):
            u = 2 * math.pi * i / tubular
            V.append(((R + r * math.cos(v)) * math.cos(u), (R + r * math.cos(v)) * math.sin(u), r * math.sin(v)))
    for j in range(radial):
        for i in range(tubular):
            a = j * tubular + i
            b = j * tubular + (i + 1) % tubular
            c = ((j + 1) % radial) * tubular + (i + 1) % tubular
            d = ((j + 1) % radial) * tubular + i
            F.append((a, b, c, d))
    V = np.array(V, dtype=float)
    # orientation : normale sortante du tube
    p = V[list(F[0])]
    n = np.cross(p[1] - p[0], p[2] - p[0])
    cu = np.array([R, 0, 0])
    if np.dot(n, p.mean(axis=0) - cu) < 0:
        F = [tuple(reversed(f)) for f in F]
    return V, F


def rbox(w: float, h: float, d: float, r: float, seg: int = 2) -> tuple[np.ndarray, list]:
    """Boîte arrondie (somme de Minkowski boîte intérieure + sphère de rayon r), centrée."""
    r = min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)
    if r <= 0.004:
        return box(w, h, d)
    half = np.array([w / 2 - r, h / 2 - r, d / 2 - r])
    # coordonnées de grille sur une face du cube [-1, 1] : zone d'arrondi en `seg` pas, plat en 1 pas
    t = 0.5
    arc = [math.sin(0.5 * math.pi * k / seg) for k in range(seg + 1)]  # 0..1
    L = sorted({-(1 - t) - t * a for a in arc} | {(1 - t) + t * a for a in arc})
    V, F = [], []
    for axis in range(3):
        for sign in (-1.0, 1.0):
            u_ax, v_ax = [a for a in range(3) if a != axis]
            start = len(V)
            m = len(L)
            for iu in range(m):
                for iv in range(m):
                    p = [0.0, 0.0, 0.0]
                    p[axis] = sign
                    p[u_ax] = L[iu]
                    p[v_ax] = L[iv]
                    p = np.array(p)
                    inner = np.clip(p, -(1 - t), 1 - t)
                    o = p - inner
                    n = o / (np.linalg.norm(o) + 1e-12)
                    V.append(inner / (1 - t) * half + n * r)
            for iu in range(m - 1):
                for iv in range(m - 1):
                    a = start + iu * m + iv
                    b = start + (iu + 1) * m + iv
                    c = start + (iu + 1) * m + iv + 1
                    dd = start + iu * m + iv + 1
                    F.append((a, b, c, dd))
    V = np.array(V, dtype=float)
    V, F = weld(V, F)
    F = _orient_out(V, F)
    return V, F


def box(w: float, h: float, d: float) -> tuple[np.ndarray, list]:
    x, y, z = w / 2, h / 2, d / 2
    V, F = [], []
    faces = [
        ((1, 0, 0), [(x, -y, -z), (x, y, -z), (x, y, z), (x, -y, z)]),
        ((-1, 0, 0), [(-x, -y, z), (-x, y, z), (-x, y, -z), (-x, -y, -z)]),
        ((0, 1, 0), [(-x, y, -z), (-x, y, z), (x, y, z), (x, y, -z)]),
        ((0, -1, 0), [(-x, -y, z), (-x, -y, -z), (x, -y, -z), (x, -y, z)]),
        ((0, 0, 1), [(-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)]),
        ((0, 0, -1), [(x, -y, -z), (-x, -y, -z), (-x, y, -z), (x, y, -z)]),
    ]
    for _, quad in faces:
        s = len(V)
        V.extend(quad)
        F.append((s, s + 1, s + 2, s + 3))
    V = np.array(V, dtype=float)
    return V, _orient_out(V, F)


def _orient_out(V: np.ndarray, F: list) -> list:
    """Oriente chaque face vers l'extérieur d'une forme convexe centrée à l'origine."""
    out = []
    for f in F:
        p = V[list(f)]
        n = np.cross(p[1] - p[0], p[2] - p[0])
        if np.linalg.norm(n) < 1e-14 and len(f) == 4:
            n = np.cross(p[2] - p[1], p[3] - p[1])
        out.append(f if np.dot(n, p.mean(axis=0)) >= 0 else tuple(reversed(f)))
    return out


def weld(V: np.ndarray, F: list, eps: float = 1e-6) -> tuple[np.ndarray, list]:
    key = np.round(V / eps).astype(np.int64)
    _, idx, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    inv = inv.reshape(-1)
    V2 = V[idx]
    F2 = []
    for f in F:
        g = [int(inv[i]) for i in f]
        # supprime les sommets répétés (faces dégénérées aux pôles)
        h = [g[0]]
        for i in g[1:]:
            if i != h[-1]:
                h.append(i)
        if len(h) > 1 and h[-1] == h[0]:
            h.pop()
        if len(h) >= 3:
            F2.append(tuple(h))
    return V2, F2


def _catmull(points: np.ndarray, radii: list, sub: int) -> tuple[np.ndarray, list]:
    """Suréchantillonne une polyligne (Catmull-Rom) et ses rayons : anneaux serrés, courbe lisse."""
    P = np.array(points, dtype=float)
    n = len(P)
    out, rr = [], []
    for i in range(n - 1):
        p0, p1, p2, p3 = P[max(0, i - 1)], P[i], P[i + 1], P[min(n - 1, i + 2)]
        for k in range(sub):
            t = k / sub
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
            rr.append(radii[i] + (radii[i + 1] - radii[i]) * (t * t * (3 - 2 * t)))
    out.append(P[-1])
    rr.append(radii[-1])
    return np.array(out), rr


def tube(points: list, radii: list, seg: int = 10, cap: bool = True, cap_rings: int = 3, sub: int = 3) -> tuple[np.ndarray, list, np.ndarray]:
    """Tube lissé le long d'une polyligne (repères à transport parallèle), bouts arrondis.
    Renvoie aussi, pour chaque sommet, son abscisse curviligne normalisée (0..1) le long du tube."""
    P, R = _catmull(np.array(points, dtype=float), list(radii), sub) if sub > 1 else (np.array(points, dtype=float), list(radii))
    n = len(P)
    T = np.zeros_like(P)
    for i in range(n):
        a = P[max(0, i - 1)]
        b = P[min(n - 1, i + 1)]
        d = b - a
        T[i] = d / (np.linalg.norm(d) + 1e-12)
    # repère initial
    up = np.array([0.0, 1.0, 0.0]) if abs(T[0][1]) < 0.9 else np.array([1.0, 0.0, 0.0])
    N = np.cross(T[0], up)
    N /= np.linalg.norm(N)
    frames = []
    for i in range(n):
        if i > 0:
            # transport parallèle
            v = np.cross(T[i - 1], T[i])
            s = np.linalg.norm(v)
            if s > 1e-8:
                v /= s
                ang = math.atan2(s, float(np.dot(T[i - 1], T[i])))
                N = _rodrigues(N, v, ang)
        B = np.cross(T[i], N)
        frames.append((N.copy(), B.copy()))
    seglen = np.concatenate([[0.0], np.cumsum(np.linalg.norm(np.diff(P, axis=0), axis=1))])
    total = seglen[-1] if seglen[-1] > 0 else 1.0
    V, F, S = [], [], []
    rings = []

    def ring(c, Nf, Bf, r, s):
        st = len(V)
        for k in range(seg):
            a = 2 * math.pi * k / seg
            V.append(c + (math.cos(a) * Nf + math.sin(a) * Bf) * r)
            S.append(s)
        rings.append(list(range(st, st + seg)))

    if cap:  # bout arrondi au départ
        for k in range(cap_rings, 0, -1):
            a = 0.5 * math.pi * k / (cap_rings + 1)
            ring(P[0] - T[0] * R[0] * math.sin(a), frames[0][0], frames[0][1], R[0] * math.cos(a), 0.0)
    for i in range(n):
        ring(P[i], frames[i][0], frames[i][1], R[i], seglen[i] / total)
    if cap:
        for k in range(1, cap_rings + 1):
            a = 0.5 * math.pi * k / (cap_rings + 1)
            ring(P[-1] + T[-1] * R[-1] * math.sin(a), frames[-1][0], frames[-1][1], R[-1] * math.cos(a), 1.0)
    for k in range(len(rings) - 1):
        a, b = rings[k], rings[k + 1]
        for i in range(seg):
            j = (i + 1) % seg
            F.append((a[i], a[j], b[j], b[i]))
    # pôles
    if cap:
        V.append(P[0] - T[0] * R[0])
        S.append(0.0)
        c0 = len(V) - 1
        V.append(P[-1] + T[-1] * R[-1])
        S.append(1.0)
        c1 = len(V) - 1
        a, b = rings[0], rings[-1]
        for i in range(seg):
            j = (i + 1) % seg
            F.append((a[j], a[i], c0))
            F.append((b[i], b[j], c1))
    V = np.array(V, dtype=float)
    S = np.array(S, dtype=float)
    # orientation : normale sortante (comparée à la direction centre → sommet sur un anneau médian)
    mid = rings[len(rings) // 2]
    p = V[[mid[0], mid[1]]]
    f0 = F[(len(rings) // 2) * seg] if (len(rings) // 2) * seg < len(F) else F[0]
    q = V[list(f0)]
    nrm = np.cross(q[1] - q[0], q[2] - q[0])
    ci = len(rings) // 2 - (cap_rings if cap else 0)
    ci = min(max(ci, 0), n - 1)
    if np.dot(nrm, q.mean(axis=0) - P[ci]) < 0:
        F = [tuple(reversed(f)) for f in F]
    del p
    return V, F, S


def _rodrigues(v: np.ndarray, k: np.ndarray, a: float) -> np.ndarray:
    return v * math.cos(a) + np.cross(k, v) * math.sin(a) + k * np.dot(k, v) * (1 - math.cos(a))


def extrude_shape(shape: list[tuple[float, float]], depth: float, bevel: float = 0.0) -> tuple[np.ndarray, list]:
    """Prisme : polygone convexe ou étoilé (x, y) extrudé le long de Z, centré. Faces latérales dures."""
    pts = np.array(shape, dtype=float)
    n = len(pts)
    z0, z1 = -depth / 2, depth / 2
    V, F = [], []
    # faces avant / arrière (éventail depuis le centroïde)
    c = pts.mean(axis=0)
    for z, front in ((z1, True), (z0, False)):
        st = len(V)
        for p in pts:
            V.append((p[0], p[1], z))
        V.append((c[0], c[1], z))
        ci = len(V) - 1
        for i in range(n):
            j = (i + 1) % n
            F.append((st + i, st + j, ci) if front else (st + j, st + i, ci))
    for i in range(n):
        j = (i + 1) % n
        st = len(V)
        V.extend([(pts[i][0], pts[i][1], z0), (pts[j][0], pts[j][1], z0), (pts[j][0], pts[j][1], z1), (pts[i][0], pts[i][1], z1)])
        F.append((st, st + 1, st + 2, st + 3))
    V = np.array(V, dtype=float)
    # oriente : contrôle sur la face avant
    q = V[list(F[0])]
    if np.cross(q[1] - q[0], q[2] - q[0])[2] < 0:
        F = [tuple(reversed(f)) for f in F]
    return V, F


# ─── Normales ──────────────────────────────────────────────────────────────────


def smooth_normals(V: np.ndarray, F: list, by_position: bool = True) -> np.ndarray:
    """Normales lissées pondérées par l'aire ; `by_position` moyenne aussi les sommets confondus
    (normales de contour sans trou aux arêtes vives)."""
    N = np.zeros_like(V)
    for f in F:
        p = V[list(f)]
        for k in range(1, len(f) - 1):
            n = np.cross(p[k] - p[0], p[k + 1] - p[0])
            for i in (f[0], f[k], f[k + 1]):
                N[i] += n
    if by_position:
        key = np.round(V / 1e-5).astype(np.int64)
        _, inv = np.unique(key, axis=0, return_inverse=True)
        inv = inv.reshape(-1)
        acc = np.zeros((inv.max() + 1, 3))
        np.add.at(acc, inv, N)
        N = acc[inv]
    L = np.linalg.norm(N, axis=1, keepdims=True)
    return N / np.maximum(L, 1e-12)


# ─── Modèle ────────────────────────────────────────────────────────────────────

MATS = ("toon", "glow", "mirror", "glass")


@dataclass
class Part:
    bone: str
    V: np.ndarray
    F: list
    color: tuple[float, float, float]
    emit: float = 0.0
    mat: str = "toon"
    outline: float = 1.0
    flat: bool = False
    weights: list | None = None  # [(bone, poids par sommet (n,))] pour les pièces à poids répartis
    facet_ids: bool = False  # boule à facettes : une couleur pseudo-aléatoire par face


@dataclass
class Bone:
    name: str
    parent: str | None
    offset: np.ndarray
    deform: bool = True


@dataclass
class Model:
    name: str
    bones: dict[str, Bone] = field(default_factory=dict)
    parts: list[Part] = field(default_factory=list)
    meta: dict = field(default_factory=dict)

    # Squelette ------------------------------------------------------------------
    def joint(self, name: str, parent: str | None, pos, deform: bool = True) -> "Model":
        if parent is None and name != "root":
            parent = "root" if "root" in self.bones else None
        self.bones[name] = Bone(name, parent, np.array(pos, dtype=float), deform)
        return self

    def socket(self, name: str, parent: str, pos=(0, 0, 0)) -> "Model":
        return self.joint(name, parent, pos, deform=False)

    def world(self, name: str) -> np.ndarray:
        b = self.bones[name]
        p = b.offset.copy()
        while b.parent is not None:
            b = self.bones[b.parent]
            p = p + b.offset
        return p

    # Pièces ---------------------------------------------------------------------
    def _add(self, joint: str, VF, color: int, pos, rot=None, scale=None, R: np.ndarray | None = None, **kw) -> Part:
        V, F = VF[0], VF[1]
        V = np.array(V, dtype=float)
        if scale is not None:
            V = V * np.array(scale, dtype=float)
        M = R if R is not None else euler_xyz(rot)
        V = V @ M.T + np.array(pos, dtype=float) + self.world(joint)
        part = Part(joint, V, list(F), hex_rgb(color), **kw)
        self.parts.append(part)
        return part

    def sphere(self, joint, color, pos, scale, rot=None, seg=16, **kw) -> Part:
        # densité automatique : les petites sphères (yeux, boutons, embouts) n'ont pas besoin de 16 segments
        big = max(abs(v) for v in scale)
        if big < 0.05:
            seg = min(seg, 8)
        elif big < 0.12:
            seg = min(seg, 12)
        return self._add(joint, sphere(seg), color, pos, rot, scale, **kw)

    def hemi(self, joint, color, pos, scale, rot=None, seg=20, **kw) -> Part:
        return self._add(joint, hemi(seg), color, pos, rot, scale, **kw)

    def box(self, joint, color, pos, size, radius=0.0, rot=None, seg=2, **kw) -> Part:
        # petites boîtes et décors sans contour : un seul pas d'arrondi suffit (108 tris au lieu de 300)
        if max(size) < 0.16 or kw.get("outline", 1.0) == 0:
            seg = 1
        return self._add(joint, rbox(size[0], size[1], size[2], radius, seg), color, pos, rot, None, **kw)

    def cyl(self, joint, color, pos, r, h, rb=None, rot=None, seg=14, caps=True, **kw) -> Part:
        return self._add(joint, cylinder(r, r if rb is None else rb, h, seg, caps), color, pos, rot, None, **kw)

    def cone(self, joint, color, pos, r, h, rot=None, seg=8, **kw) -> Part:
        return self._add(joint, cone(r, h, seg), color, pos, rot, None, **kw)

    def torus(self, joint, color, pos, R, r, rot=None, radial=8, tubular=24, **kw) -> Part:
        return self._add(joint, torus(R, r, radial, tubular), color, pos, rot, None, **kw)

    def lathe(self, joint, color, pos, profile, rot=None, seg=16, scale=None, **kw) -> Part:
        return self._add(joint, lathe(profile, seg), color, pos, rot, scale, **kw)

    def shape(self, joint, color, pos, pts, depth, rot=None, scale=None, **kw) -> Part:
        return self._add(joint, extrude_shape(pts, depth), color, pos, rot, scale, **kw)

    def capsule(self, joint, color, a, b, r, r2=None, **kw) -> Part:
        """Capsule de `a` à `b` (repère de l'articulation), rayon r (puis r2 au bout)."""
        a = np.array(a, dtype=float)
        b = np.array(b, dtype=float)
        L = float(np.linalg.norm(b - a))
        VF = capsule(r, L, cap_seg=3 if r < 0.1 else 4, radial=10 if r < 0.1 else 12, r2=r2)
        R = align_y(b - a) if L > 1e-6 else np.eye(3)
        return self._add(joint, VF, color, (a + b) / 2, R=R, **kw)

    def tube(self, joint, color, points, radii, seg=10, bones: list[tuple[str, float]] | None = None, pos=(0, 0, 0), rot=None, **kw) -> Part:
        """Tube le long d'une polyligne (repère de `joint`). `bones` = [(os, abscisse 0..1)] : poids
        linéaires entre os voisins le long du tube (corps souple du furet, mèches)."""
        V, F, S = tube(points, radii, seg)
        part = self._add(joint, (V, F), color, pos, rot, None, **kw)
        if bones:
            names = [b for b, _ in bones]
            xs = np.array([s for _, s in bones])
            W = {b: np.zeros(len(S)) for b in names}
            for vi, s in enumerate(S):
                if s <= xs[0]:
                    W[names[0]][vi] = 1.0
                elif s >= xs[-1]:
                    W[names[-1]][vi] = 1.0
                else:
                    k = int(np.searchsorted(xs, s) - 1)
                    t = (s - xs[k]) / max(1e-9, xs[k + 1] - xs[k])
                    t = t * t * (3 - 2 * t)
                    W[names[k]][vi] += 1 - t
                    W[names[k + 1]][vi] += t
            part.weights = [(b, w) for b, w in W.items()]
        return part

    def custom(self, joint, color, V, F, pos=(0, 0, 0), rot=None, scale=None, **kw) -> Part:
        return self._add(joint, (V, F), color, pos, rot, scale, **kw)

    def mirror_x(self, part: Part, joint: str | None = None) -> Part:
        """Copie miroir (X → -X) d'une pièce, sur `joint` (par défaut le même os)."""
        V = part.V.copy()
        V[:, 0] *= -1
        F = [tuple(reversed(f)) for f in part.F]
        p = Part(joint or part.bone, V, F, part.color, part.emit, part.mat, part.outline, part.flat)
        self.parts.append(p)
        return p

    # Statistiques ---------------------------------------------------------------
    def tri_count(self) -> int:
        return sum(sum(len(f) - 2 for f in p.F) for p in self.parts)
