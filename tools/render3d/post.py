"""Conversion des passes 3D en pixel art : rampes par matière, liseré néon, sel-out, contour, normal map."""
from __future__ import annotations

import numpy as np

from palette import OUTLINE_RGB, RIM_RGB, has_rim, is_emissive, ramp

# Luminance de référence de la passe « light » (blanc mat sous la lumière clé).
L_REF = 1.0


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


def to_pixel_art(passes: dict[str, np.ndarray]) -> tuple[np.ndarray, np.ndarray]:
    """Renvoie (couleur RGBA uint8, normal map RGBA uint8) de mêmes dimensions."""
    idp, lp, npass = passes["id"], passes["light"], passes["normal"]
    h, w, _ = idp.shape
    mask = idp[..., 3] > 0.5
    mid = np.rint(idp[..., 0] * 255.0).astype(np.int32)
    mid[~mask] = 0
    lum = np.clip(lp[..., 0] / L_REF, 0.0, 0.999)
    normal = npass[..., :3] * 2.0 - 1.0

    out = np.zeros((h, w, 4), dtype=np.uint8)
    level = np.zeros((h, w), dtype=np.int32)
    for m in np.unique(mid[mask]):
        r = ramp(int(m))
        sel = mask & (mid == m)
        if is_emissive(int(m)) or len(r) == 1:
            idx = np.full(sel.sum(), len(r) - 1)
        else:
            # Bandes nettes ; légère courbe pour garder les ombres lisibles.
            idx = np.floor(np.power(lum[sel], 0.85) * len(r)).astype(np.int32)
            idx = np.clip(idx, 0, len(r) - 1)
        level[sel] = idx
        out[sel, :3] = np.array(r)[idx]
        out[sel, 3] = 255

    up, down, left, right = _neighbors(mask)
    edge = mask & ~(up & down & left & right)

    # Liseré néon (rim light) : bords du contour tournés vers le haut ou la droite.
    rim_ok = np.zeros_like(mask)
    for m in np.unique(mid[mask]):
        if has_rim(int(m)):
            rim_ok |= mid == m
    # Liseré seulement sur le bord droit et le haut des volumes éclairés (pas partout).
    rim = edge & rim_ok & ((normal[..., 0] > 0.5) | (normal[..., 1] > 0.75)) & (level >= 2)
    out[rim, :3] = RIM_RGB

    # Sel-out : frontière entre deux matières → ton le plus sombre de la matière la plus sombre.
    for dy, dx in ((0, 1), (1, 0)):
        a = mid[: h - dy, : w - dx]
        b = mid[dy:, dx:]
        boundary = (a != b) & (a > 0) & (b > 0)
        ys, xs = np.nonzero(boundary)
        for y, x in zip(ys, xs):
            ma, mb = int(a[y, x]), int(b[y, x])
            if is_emissive(ma) or is_emissive(mb) or not (has_rim(ma) and has_rim(mb)):
                continue
            ra, rb = ramp(ma), ramp(mb)
            # Le pixel de la matière la plus sombre (base) reçoit son ton le plus sombre.
            if sum(ra[len(ra) // 2]) <= sum(rb[len(rb) // 2]):
                out[y, x, :3] = ra[0]
            else:
                out[y + dy, x + dx, :3] = rb[0]

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
