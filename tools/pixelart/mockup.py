"""Maquette d'écran 640×360 (relecture « en situation ») -> preview/mock_scene.png (×2).

Scène de combat sur les quais, dans le style « pixel art moderne » : les
tuiles et les acteurs sont éclairés par des lumières ponctuelles à travers
leurs normal maps (simulation simplifiée de l'éclairage Phaser 4), les
émissifs (néons, écrans, VFX, télégraphes) restent à pleine intensité et
nourrissent un bloom. preview/mock_scene_flat.png : la même scène sans
éclairage (couleurs brutes des feuilles).
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import boss  # noqa: E402
import consultant  # noqa: E402
import hero  # noqa: E402
import lib  # noqa: E402
import machines  # noqa: E402
import manager  # noqa: E402
import modern  # noqa: E402
import props  # noqa: E402
import tiles  # noqa: E402
import ui  # noqa: E402
import vfx  # noqa: E402
from palette import CHAR, EMISSIVE, RGBA  # noqa: E402

c = CHAR
W, H = 640, 368
LUT = np.array(RGBA, dtype=np.float32)


def build_floor():
    q = tiles.build_quais()
    T = 16
    N = q.names

    def tile_of(name):
        i = N[name]
        r, cc = divmod(i, 16)
        return q.a[r * T : (r + 1) * T, cc * T : (cc + 1) * T]

    scene = lib.canvas(W, H)
    rows = H // T
    walls = ["wall-midA", "wall-midB", "facade-privatix", "wall-midC", "facade-horaires", "wall-midA",
             "facade-greve", "wall-midC", "wall-midB", "facade-vitrine"]
    for ty in range(rows):
        for tx in range(W // T):
            if ty == 0:
                t = tile_of("walltop-" + "11111111")
            elif ty in (1, 2):
                t = tile_of(walls[tx % len(walls)] + ("-top" if ty == 1 else "-bot"))
            elif ty == 12:
                t = tile_of("edge-S")
            elif ty == 13:
                t = tile_of("ballast-%d" % (tx % 4))
            elif ty == 14:
                t = tile_of("track-H-top")
            elif ty == 15:
                t = tile_of("track-H-bot")
            elif ty == 16:
                t = tile_of("ballast-%d" % ((tx + 1) % 4))
            elif ty == 17:
                t = tile_of("edge-N")
            elif ty == 11:
                t = tile_of("quai-podo-line")
            else:
                k = (tx * 7 + ty * 3) % 13
                names = ["quai-0", "quai-1", "quai-2", "quai-3", "quai-0", "quai-1", "quai-2", "quai-3",
                         "quai-crack", "quai-0", "quai-stain", "quai-2", "quai-gum"]
                t = tile_of(names[k])
                if (tx, ty) in ((9, 8), (30, 20)):
                    t = tile_of("anim-puddle-1")
                if (tx, ty) == (26, 5):
                    t = tile_of("quai-drain")
            scene[ty * T : (ty + 1) * T, tx * T : (tx + 1) * T] = t
    return scene


def main():
    scene = build_floor()
    albedo = LUT[scene][:, :, :3].copy()
    normal = modern.normal_map(scene, cell=(16, 16), mode="surface").astype(np.float32)
    emis = np.isin(scene, list(EMISSIVE))

    sprites = []

    def put(img, x, y, shadow=None, oy=None, lit=True):
        """x, y = position du pivot (pieds)."""
        sprites.append((y, img, x, y, shadow, oy, lit))

    put(props.banc_h(), 120, 80)
    put(props.pilier(), 300, 92)
    put(props.distributeur(), 520, 84)
    put(props.poubelle(), 140, 150)
    put(props.panneau_quai(2), 400, 300)
    put(props.cone(), 60, 180)
    put(props.portique(5), 600, 300)

    # combat : le héros enchaîne (coup 1, frame active avec smear) face à un
    # Consultant en pleine ruée, la Borne tire, le Drone vise, le Manager
    # protège ses troupes ; le Boss arrive sur le quai d'en face.
    put(hero.attack1("side")[2], 262, 166, shadow="m")
    put(lib.flipx(consultant.attack("side")[4]), 326, 170, shadow="s")
    put(consultant.run("down")[2], 392, 112, shadow="s")
    put(machines.borne_attack()[3], 500, 128, shadow="m")
    put(machines.drone_attack()[2], 190, 120, shadow="s")
    put(manager.shield("down")[5], 446, 178, shadow="l")
    put(hero.idle("down")[3], 112, 300, shadow="m")
    put(boss.idle()[0], 540, 352, shadow="xl")
    shadows = {"s": vfx.shadow(16, 8), "m": vfx.shadow(24, 8), "l": vfx.shadow(48, 16), "xl": vfx.shadow(80, 24)}

    # calques acteurs : albedo, normale, émissif (au-dessus du sol)
    def comp_indexed(img, x0, y0, lit=True):
        h, w = img.shape
        nm = modern.normal_map(img).astype(np.float32)
        for yy in range(h):
            Y = y0 + yy
            if not 0 <= Y < H:
                continue
            for xx in range(w):
                X = x0 + xx
                v = img[yy, xx]
                if v and 0 <= X < W:
                    albedo[Y, X] = LUT[v][:3]
                    normal[Y, X] = nm[yy, xx] if lit else (128, 128, 255, 255)
                    emis[Y, X] = (v in EMISSIVE) or not lit

    def shade_shadow(img, x0, y0, a=0.5):
        h, w = img.shape
        for yy in range(h):
            for xx in range(w):
                X, Y = x0 + xx, y0 + yy
                if img[yy, xx] and 0 <= X < W and 0 <= Y < H:
                    albedo[Y, X] = albedo[Y, X] * (1 - a) + LUT[img[yy, xx]][:3] * a

    for (_, img, x, y, sh, oy, lit) in sorted(sprites, key=lambda s: s[0]):
        h, w = img.shape
        if sh:
            s = shadows[sh]
            shade_shadow(s, x - s.shape[1] // 2, y - s.shape[0] // 2 - 1)
        oy = oy if oy is not None else (44 if h == 48 else 28 if h == 32 else 88 if h == 96 else h)
        comp_indexed(img, x - w // 2, y - oy, lit)

    # VFX (non éclairés, émissifs)
    comp_indexed(vfx.slash(0)[2], 276 - 32 + 10, 152 - 32, lit=False)
    comp_indexed(vfx.hit(32)[1], 300 - 16, 146 - 16, lit=False)
    comp_indexed(vfx.sparks()[1], 306 - 8, 142 - 8, lit=False)
    for k, (px_, py_) in enumerate(((462, 118), (420, 128), (372, 138))):
        comp_indexed(vfx.ticket_spin()[k % 4], px_ - 8, py_ - 8, lit=False)
    comp_indexed(vfx.explosion(64, 10)[3], 590 - 32, 150 - 32, lit=False)
    comp_indexed(vfx.telegraph(32)[1], 190 - 16, 168 - 16, lit=False)
    comp_indexed(vfx.dust(16)[1], 246 - 8, 162 - 8, lit=False)

    flat = albedo.copy()

    # ------------------------------------------------ éclairage (Phaser 4 Lighting, simplifié)
    lights = [  # x, y, rayon, couleur, intensité
        (48, 30, 150, (0.45, 0.85, 1.0), 0.9), (240, 30, 150, (0.45, 0.85, 1.0), 0.9),
        (430, 30, 150, (0.45, 0.85, 1.0), 0.9), (610, 30, 150, (0.45, 0.85, 1.0), 0.8),
        (262, 146, 120, (1.0, 0.62, 0.25), 1.25),  # le héros et son coup
        (500, 106, 90, (1.0, 0.3, 0.65), 0.9),  # écran de la Borne
        (590, 150, 140, (0.6, 1.0, 0.95), 1.0),  # explosion
        (120, 290, 110, (1.0, 0.75, 0.4), 0.9),  # lampe sodium sur le quai d'en face
        (520, 300, 130, (0.45, 0.85, 1.0), 0.7),
    ]
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    n = normal[:, :, :3] / 127.5 - 1.0
    n[:, :, 1] *= -1  # OpenGL -> repère écran (y vers le bas)
    acc = np.zeros((H, W, 3), dtype=np.float32) + np.array([0.30, 0.33, 0.48], dtype=np.float32)
    for (lx, ly, r, col, inten) in lights:
        dx, dy, dz = lx - xs, ly - ys, np.full_like(xs, 36.0)
        d = np.sqrt(dx * dx + dy * dy + dz * dz)
        ndl = np.clip((n[:, :, 0] * dx + n[:, :, 1] * dy + n[:, :, 2] * dz) / d, 0, 1)
        att = np.clip(1 - np.sqrt(dx * dx + dy * dy) / r, 0, 1) ** 2
        acc += (ndl * att * inten)[:, :, None] * np.array(col, dtype=np.float32)
    lit = albedo * acc
    lit[emis] = albedo[emis]
    # bloom des émissifs
    glow = np.zeros_like(albedo)
    glow[emis] = albedo[emis]
    gi = Image.fromarray(np.clip(glow, 0, 255).astype(np.uint8), "RGB")
    g1 = np.asarray(gi.filter(ImageFilter.GaussianBlur(3)), dtype=np.float32)
    g2 = np.asarray(gi.filter(ImageFilter.GaussianBlur(9)), dtype=np.float32)
    out = np.clip(lit + g1 * 0.55 + g2 * 0.45, 0, 255)

    # HUD (non éclairé)
    def hud(img, x0, y0):
        h, w = img.shape
        for yy in range(h):
            for xx in range(w):
                v = img[yy, xx]
                if v:
                    out[y0 + yy, x0 + xx] = LUT[v][:3]
                    flat[y0 + yy, x0 + xx] = LUT[v][:3]

    hud(ui.bar_frame(104, 12, "O"), 8, 8)
    hud(ui.bar_fill(70, 8, "x", "O", "R"), 10, 10)
    hud(ui.bar_frame(76, 8, "V"), 8, 22)
    hud(ui.bar_fill(30, 4, "V", "W", "d"), 10, 24)
    for i, st in enumerate((0, 0, 2)):
        hud(ui.dash_pips()[st], 116 + i * 10, 10)
    hud(ui.icon("gobelet"), 8, 32)
    hud(ui.cursor(1), 330, 150)

    for arr, name in ((out, "mock_scene.png"), (flat, "mock_scene_flat.png")):
        im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").resize((W * 2, H * 2), Image.NEAREST)
        path = os.path.join(HERE, "preview", name)
        im.save(path)
        print(path)


if __name__ == "__main__":
    main()
