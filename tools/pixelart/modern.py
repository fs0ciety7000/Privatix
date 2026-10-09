"""Passe « pixel art moderne » (Dead Cells / Celeste) et normal maps.

Toutes les fonctions travaillent sur des images indexées (numpy uint8,
0 = transparent, indices de `palette.PRIVATIX`). Rien n'est flouté : chaque
retouche remplace un indice par le ton voisin de la même rampe
(`palette.DARK` / `palette.LIGHT`), l'alpha reste binaire.

`shade(a)` (acteurs : héros, ennemis, boss, PNJ), appliquée juste après le
contour extérieur :

1. **Volume** : une carte de hauteur « bombée » est dérivée de la silhouette
   (distance au bord), son gradient donne une normale par pixel ; éclairage
   haut-gauche -> les arêtes tournées vers la lumière montent d'un ton, celles
   à l'opposé descendent d'un ton (décalage de teinte porté par les rampes).
2. **Rim light** : liseré `#6FD6FF` (néon froid des quais) sur le bord droit,
   opposé à la lumière, seulement là où la forme fait au moins 2 px de large.
3. **Sel-out** : les lignes internes noires (séparations de pièces) prennent
   la teinte très sombre du matériau voisin ; le contour extérieur reste
   `#14101A`, sans anti-aliasing.
4. **AO** : rangée de contact au sol assombrie d'un ton.
5. **Anti-aliasing interne sélectif** : marche d'escalier entre deux tons de
   la même rampe distants de 2 crans -> ton intermédiaire au coin.

`normal_map(a, ...)` : hauteur = bombé de la silhouette + luminance du
matériau, gradient -> normale encodée RGB (convention OpenGL : X droite,
Y haut = vert, Z vers la caméra), alpha identique au sprite.
"""
import numpy as np

from palette import DARK, EMISSIVE, K, LIGHT, RGBA, RIM

DARK_A = np.array(DARK, dtype=np.uint8)
LIGHT_A = np.array(LIGHT, dtype=np.uint8)
_LUT = np.array(RGBA, dtype=np.float32)
LUM = (0.2126 * _LUT[:, 0] + 0.7152 * _LUT[:, 1] + 0.0722 * _LUT[:, 2]) / 255.0
LUM[0] = 0.0
EMIT = np.zeros(len(RGBA), dtype=bool)
for _e in EMISSIVE:
    EMIT[_e] = True
EMIT[K] = True  # le noir n'est jamais éclairé

# lumière haut-gauche, légèrement de face
_L = np.array([-0.55, -0.65, 0.52], dtype=np.float32)
_L /= np.linalg.norm(_L)


# --------------------------------------------------------------------------
# outils morphologiques
# --------------------------------------------------------------------------

def _nb(m, dx, dy, fill=False):
    """m décalé : out[y, x] = m[y + dy, x + dx] (hors image = fill)."""
    H, W = m.shape
    out = np.full_like(m, fill)
    ys = slice(max(0, -dy), min(H, H - dy))
    xs = slice(max(0, -dx), min(W, W - dx))
    ys2 = slice(max(0, dy), min(H, H + dy))
    xs2 = slice(max(0, dx), min(W, W + dx))
    out[ys, xs] = m[ys2, xs2]
    return out


def distance(mask, cap=8):
    """Distance (8-connexe, en pas) au bord de la silhouette, plafonnée."""
    d = np.zeros(mask.shape, dtype=np.float32)
    cur = mask.copy()
    for k in range(1, cap + 1):
        d[cur] = k
        er = cur.copy()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)):
            er &= _nb(cur, dx, dy)
        cur = er
        if not cur.any():
            break
    return d


def _blur(h, r=1):
    out = np.zeros_like(h)
    n = 0
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out += _nb(h, dx, dy, 0.0)
            n += 1
    return out / n


def _normals(h, k):
    gx = (_nb(h, 1, 0, 0.0) - _nb(h, -1, 0, 0.0)) * 0.5
    gy = (_nb(h, 0, 1, 0.0) - _nb(h, 0, -1, 0.0)) * 0.5
    nx, ny, nz = -gx * k, -gy * k, np.ones_like(h)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    return nx / ln, ny / ln, nz / ln  # repère écran : y vers le bas


def bulge(mask, R=4.0):
    d = np.minimum(distance(mask, int(R) + 1), R) / R
    return np.sqrt(np.clip(1.0 - (1.0 - d) ** 2, 0, 1)) * mask


# --------------------------------------------------------------------------
# passe acteurs
# --------------------------------------------------------------------------

def _components(m):
    """Étiquetage 4-connexe (petites images)."""
    lab = np.zeros(m.shape, dtype=np.int32)
    n = 0
    H, W = m.shape
    for y0, x0 in zip(*np.nonzero(m)):
        if lab[y0, x0]:
            continue
        n += 1
        stack = [(y0, x0)]
        lab[y0, x0] = n
        while stack:
            y, x = stack.pop()
            for yy, xx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= yy < H and 0 <= xx < W and m[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = n
                    stack.append((yy, xx))
    return lab, n


def selout(a):
    """Lignes internes noires -> teinte très sombre du matériau voisin."""
    mask = a > 0
    trans = ~mask
    outer = (a == K) & (_nb(trans, 1, 0, True) | _nb(trans, -1, 0, True) | _nb(trans, 0, 1, True)
                        | _nb(trans, 0, -1, True))
    inner_k = (a == K) & ~outer
    if not inner_k.any():
        return a
    out = a.copy()
    lab, n = _components(inner_k)
    for i in range(1, n + 1):
        comp = lab == i
        if comp.sum() < 3:
            continue  # yeux, rivets : restent noirs
        ring = np.zeros_like(comp)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ring |= _nb(comp, dx, dy)
        ring &= ~comp & mask & (a != K)
        cols = a[ring]
        if len(cols) == 0 or EMIT[cols].any() and (cols == 7).sum() + EMIT[cols].sum() > len(cols) // 3:
            continue  # cadre d'écran / de LED : on garde le noir
        vals, cnt = np.unique(cols, return_counts=True)
        base = vals[np.argmax(cnt)]
        so = DARK_A[DARK_A[base]]
        if so == base:
            continue
        out[comp] = so
    return out


def shade(a, rim=True, ground=None, light=1.0, rim_color=RIM, aa=True):
    """Passe complète sur une frame d'acteur déjà contourée."""
    a = selout(a)
    mask = a > 0
    trans = ~mask
    outer = (a == K) & (_nb(trans, 1, 0, True) | _nb(trans, -1, 0, True) | _nb(trans, 0, 1, True)
                        | _nb(trans, 0, -1, True))
    body = mask & ~outer
    h = _blur(bulge(body, 3.5), 1) * body
    nx, ny, nz = _normals(h, 2.6)
    lit = nx * _L[0] + ny * _L[1] + nz * _L[2] - _L[2]
    fixed = EMIT[a]
    out = a.copy()
    up = body & ~fixed & (lit > 0.20 / light)
    dn = body & ~fixed & (lit < -0.30 / light)
    out[up] = LIGHT_A[a[up]]
    out[dn] = DARK_A[a[dn]]
    # AO : contact au sol
    if ground is not None:
        g = np.zeros_like(body)
        g[max(0, ground - 1) : ground + 1, :] = True
        g &= body & ~fixed
        out[g] = DARK_A[out[g]]
    # anti-aliasing interne sélectif (coins d'escalier entre 2 tons d'une rampe)
    if aa:
        out = _inner_aa(out, body)
    # rim light : bord droit (opposé à la lumière)
    if rim:
        r = body & _nb(outer, 1, 0) & _nb(body, -1, 0) & (nx > 0.25)
        r &= ~(out == K)
        ys = np.nonzero(body.any(axis=1))[0]
        if len(ys):
            r[max(0, ys.max() - 2) :, :] = False  # pas sur les semelles
            r[: ys.min() + 1, :] = False
        # garder les liserés continus (au moins 2 px)
        keep = r & (_nb(r, 0, 1) | _nb(r, 0, -1) | _nb(r, 1, 1) | _nb(r, -1, -1) | _nb(r, 1, -1) | _nb(r, -1, 1))
        emis = EMIT[out]
        out[keep & ~emis] = rim_color
    return out


def _inner_aa(a, body):
    out = a.copy()
    lv = np.zeros(a.shape, dtype=np.int16)
    from palette import LEVEL, RAMP_OF

    ramp = np.full(a.shape, -1, dtype=np.int16)
    names = {n: i for i, n in enumerate(sorted(set(RAMP_OF.values())))}
    rid = np.full(len(DARK), -1, dtype=np.int16)
    lvl = np.zeros(len(DARK), dtype=np.int16)
    for ix, rn in RAMP_OF.items():
        rid[ix] = names[rn]
        lvl[ix] = LEVEL[ix]
    ramp = rid[a]
    lv = lvl[a]
    for (dx1, dy1), (dx2, dy2) in (((1, 0), (0, 1)), ((-1, 0), (0, 1)), ((1, 0), (0, -1)), ((-1, 0), (0, -1))):
        r1, r2 = _nb(ramp, dx1, dy1, -1), _nb(ramp, dx2, dy2, -1)
        l1, l2 = _nb(lv, dx1, dy1, 0), _nb(lv, dx2, dy2, 0)
        c1 = _nb(a, dx1, dy1, 0)
        diag = _nb(a, dx1 + dx2, dy1 + dy2, 0)
        cond = body & (ramp >= 0) & (r1 == ramp) & (r2 == ramp) & (l1 == l2) & (np.abs(l1 - lv) == 2)
        cond &= _nb(body, dx1, dy1) & _nb(body, dx2, dy2) & (diag == c1)
        cond &= ~EMIT[a]
        tgt = np.where(l1 > lv, LIGHT_A[a], DARK_A[a])
        out[cond] = tgt[cond]
    return out


def flash_rim(a, color=RIM):
    """Variante sans éclairage : seulement le rim (objets fins, écrans)."""
    return shade(a, rim=True, light=0.01, aa=False, rim_color=color)


# --------------------------------------------------------------------------
# normal maps
# --------------------------------------------------------------------------

def normal_map(a, cell=None, mode="sprite", strength=None):
    """a : image indexée (0 = transparent). cell = (w, h) d'une frame / tuile :
    chaque cellule est traitée séparément (pas de pente entre deux frames).
    mode 'sprite' : bombé de silhouette + luminance ; 'surface' : luminance
    seule (tuiles opaques). Retourne un tableau RGBA uint8."""
    H, W = a.shape
    cw, ch = cell if cell else (W, H)
    out = np.zeros((H, W, 4), dtype=np.uint8)
    out[:, :, 0] = 128
    out[:, :, 1] = 128
    out[:, :, 2] = 255
    for y0 in range(0, H, ch):
        for x0 in range(0, W, cw):
            sub = a[y0 : y0 + ch, x0 : x0 + cw]
            m = sub > 0
            if not m.any():
                continue
            lum = LUM[sub].astype(np.float32)
            if mode == "sprite":
                h = 0.8 * bulge(m, 4.0) + 0.35 * lum
                h = _blur(h * m, 1) * m + h * 0.0
                k = strength or 3.2
            else:
                h = _blur(lum, 1)
                k = strength or 2.4
            nx, ny, nz = _normals(h.astype(np.float32), k)
            enc = np.stack([(nx + 1) * 127.5, (-ny + 1) * 127.5, (nz + 1) * 127.5], axis=-1)
            blk = out[y0 : y0 + ch, x0 : x0 + cw]
            blk[m, :3] = np.clip(np.round(enc[m]), 0, 255).astype(np.uint8)
            blk[m, 3] = 255
    return out
