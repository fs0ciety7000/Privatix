"""Conversion des passes 3D en pixel art : rampes par matière, encrage BD, liseré néon, contour, normal map.

Direction artistique Dead Cells / Celeste / Hades :
  - quantification contrastée (seuils THRESHOLDS) : ombres profondes, lumières franches, peu de tons moyens ;
  - encrage (Jen Zee) : trait sombre aux lignes intérieures, là où une pièce passe devant une autre
    (saut de profondeur) et à la frontière entre deux matières structurelles ;
  - liseré néon (rim light) de 2 px sur les bords éclairés quand le volume est assez épais ;
  - contour extérieur 1 px #14101A.
"""
from __future__ import annotations

import numpy as np

from palette import OUTLINE_RGB, RIM_RGB, has_rim, is_emissive, ramp

# Seuils de quantification (luminance de la passe « light », blanc mat sous la clé ≈ 1) par longueur de
# rampe. Contraste dramatique : le ton le plus profond est réservé aux ombres franches, les tons moyens
# sont resserrés, les lumières sont larges et franches (moins de tons « plats »).
THRESHOLDS: dict[int, list[float]] = {
    2: [0.45],
    3: [0.26, 0.58],
    4: [0.205, 0.42, 0.7],
    5: [0.2, 0.36, 0.52, 0.74],
    6: [0.195, 0.3, 0.42, 0.56, 0.78],
}
# Saut de profondeur (m) au-delà duquel on encre la ligne intérieure.
INK_DEPTH = 0.07
# Encre des lignes intérieures : None = ton le plus sombre de la matière, sinon une couleur fixe.
INK_RGB: tuple[int, int, int] | None = None


def _neighbors(mask: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    up = np.zeros_like(mask)
    up[1:] = mask[:-1]
    down = np.zeros_like(mask)
    down[:-1] = mask[1:]
    left = np.zeros_like(mask)
    left[:, 1:] = mask[:, :-1]
    right = np.zeros_like(mask)
    right[:, :-1] = mask[:, 1:]
    return up, down, left, right


def denoise_lum(lum: np.ndarray, mid: np.ndarray, mask: np.ndarray) -> np.ndarray:
    """Médian 3×3 de la luminance, restreint aux voisins de même matière : supprime le moucheté du
    rendu Cycles sur les grandes surfaces sans baver d'une pièce à l'autre."""
    h, w = lum.shape
    pad_l = np.pad(lum, 1, mode="edge")
    pad_m = np.pad(np.where(mask, mid, -1), 1, mode="constant", constant_values=-2)
    stack = []
    for dy in (0, 1, 2):
        for dx in (0, 1, 2):
            v = pad_l[dy : dy + h, dx : dx + w]
            same = pad_m[dy : dy + h, dx : dx + w] == mid
            stack.append(np.where(same, v, np.nan))
    with np.errstate(all="ignore"):
        med = np.nanmedian(np.stack(stack), axis=0)
    return np.where(mask & ~np.isnan(med), med, lum)


def quantize(lum: np.ndarray, n: int) -> np.ndarray:
    """Luminance rendue → indice dans une rampe de n tons."""
    th = THRESHOLDS.get(n) or [(k + 1) / n for k in range(n - 1)]
    return np.searchsorted(np.array(th), lum, side="right").astype(np.int32)


def to_pixel_art(passes: dict[str, np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
    """Renvoie (couleur RGBA uint8, normal map RGBA uint8) de mêmes dimensions."""
    idp, lp, npass = passes["id"], passes["light"], passes["normal"]
    depth = passes["depth"][..., 0] if "depth" in passes else None
    h, w, _ = idp.shape
    mask = idp[..., 3] > 0.5
    mid = np.rint(idp[..., 0] * 255.0).astype(np.int32)
    mid[~mask] = 0
    lum = denoise_lum(lp[..., 0], mid, mask)
    normal = npass[..., :3] * 2.0 - 1.0

    out = np.zeros((h, w, 4), dtype=np.uint8)
    level = np.zeros((h, w), dtype=np.int32)
    nlev = np.ones((h, w), dtype=np.int32)
    present = [int(m) for m in np.unique(mid[mask])]
    emissive = np.zeros_like(mask)
    rim_ok = np.zeros_like(mask)
    for m in present:
        r = ramp(m)
        sel = mask & (mid == m)
        if is_emissive(m) or len(r) == 1:
            idx = np.full(sel.sum(), len(r) - 1)
            emissive |= sel
        else:
            idx = quantize(lum[sel], len(r))
        if has_rim(m):
            rim_ok |= sel
        level[sel] = idx
        nlev[sel] = len(r)
        out[sel, :3] = np.array(r)[idx]
        out[sel, 3] = 255

    up, down, left, right = _neighbors(mask)
    edge = mask & ~(up & down & left & right)

    # ── Encrage des lignes intérieures ──────────────────────────────────────────
    ink = np.zeros_like(mask)
    for dy, dx in ((0, 1), (1, 0)):
        a_sl = (slice(0, h - dy), slice(0, w - dx))
        b_sl = (slice(dy, h), slice(dx, w))
        both = mask[a_sl] & mask[b_sl]
        ma, mb = mid[a_sl], mid[b_sl]
        ea, eb = emissive[a_sl], emissive[b_sl]
        if depth is not None:
            da, db = depth[a_sl], depth[b_sl]
            jump = both & (np.abs(da - db) > INK_DEPTH)
            # Le trait va sur la pièce de derrière : la pièce de devant garde sa silhouette entière.
            a_back = jump & (da > db) & ~ea
            b_back = jump & (db >= da) & ~eb
            ink[a_sl] |= a_back
            ink[b_sl] |= b_back
        # Frontière entre deux matières structurelles (liserées) : sur la matière la plus sombre.
        diff = both & (ma != mb) & ~ea & ~eb
        ys, xs = np.nonzero(diff)
        for y, x in zip(ys, xs):
            m1, m2 = int(ma[y, x]), int(mb[y, x])
            if not (has_rim(m1) and has_rim(m2)):
                continue
            r1, r2 = ramp(m1), ramp(m2)
            if sum(r1[len(r1) // 2]) <= sum(r2[len(r2) // 2]):
                ink[y, x] = True
            else:
                ink[y + dy, x + dx] = True
    ink &= mask & ~emissive
    ys, xs = np.nonzero(ink)
    for y, x in zip(ys, xs):
        out[y, x, :3] = INK_RGB if INK_RGB is not None else ramp(int(mid[y, x]))[0]

    # ── Liseré néon : bords tournés vers le haut ou la droite, 2 px si le volume est épais ──
    lit = rim_ok & (level >= 2) & ~ink
    facing = (normal[..., 0] > 0.45) | (normal[..., 1] > 0.7)
    rim1 = edge & lit & facing
    # 2e pixel vers l'intérieur : son voisin extérieur est liseré, et il reste de la matière derrière lui.
    r_out = np.zeros_like(mask)
    r_out[:, :-1] = rim1[:, 1:]  # le voisin de droite est liseré
    u_out = np.zeros_like(mask)
    u_out[1:] = rim1[:-1]  # le voisin du dessus est liseré
    l_in = np.zeros_like(mask)
    l_in[:, 1:] = mask[:, :-1] & ~edge[:, :-1]
    d_in = np.zeros_like(mask)
    d_in[:-1] = mask[1:] & ~edge[1:]
    rim2 = lit & ~edge & ((r_out & l_in & (normal[..., 0] > 0.3)) | (u_out & d_in & (normal[..., 1] > 0.5)))
    rim2 &= mid == np.where(r_out, np.roll(mid, -1, axis=1), np.roll(mid, 1, axis=0))
    out[rim1, :3] = RIM_RGB
    if rim2.any():
        ys, xs = np.nonzero(rim2)
        for y, x in zip(ys, xs):
            top = np.array(ramp(int(mid[y, x]))[-1], dtype=np.float32)
            out[y, x, :3] = np.rint(0.55 * np.array(RIM_RGB, dtype=np.float32) + 0.45 * top).astype(np.uint8)

    # Contour extérieur 1 px (#14101A).
    outline = ~mask & (up | down | left | right)
    out[outline, :3] = OUTLINE_RGB
    out[outline, 3] = 255

    # Normal map (OpenGL : R droite, G haut, B vers la caméra), contour à plat.
    nmap = np.zeros((h, w, 4), dtype=np.uint8)
    nmap[..., 0] = 128
    nmap[..., 1] = 128
    nmap[..., 2] = 255
    n = np.clip(npass[..., :3], 0, 1)
    nmap[mask, :3] = np.rint(n[mask] * 255).astype(np.uint8)
    nmap[..., 3] = out[..., 3]
    return out, nmap
