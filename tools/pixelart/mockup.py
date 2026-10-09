"""Maquette d'écran 640×360 (relecture « en situation ») -> preview/mock_scene.png (×2)."""
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import boss  # noqa: E402
import consultant  # noqa: E402
import hero  # noqa: E402
import lib  # noqa: E402
import machines  # noqa: E402
import props  # noqa: E402
import tiles  # noqa: E402
import ui  # noqa: E402
import vfx  # noqa: E402
from palette import CHAR  # noqa: E402

c = CHAR
W, H = 640, 368


def main():
    q = tiles.build_quais()
    T = 16
    N = q.names

    def tile_of(name):
        i = N[name]
        r, cc = divmod(i, 16)
        return q.a[r * T : (r + 1) * T, cc * T : (cc + 1) * T]

    scene = lib.canvas(W, H)
    rows = H // T
    for ty in range(rows):
        for tx in range(W // T):
            if ty == 0:
                t = tile_of("walltop-" + "11111111")
            elif ty == 1:
                t = tile_of(["wall-midA-top", "wall-midB-top", "facade-privatix-top", "wall-midC-top",
                             "facade-horaires-top", "wall-midA-top"][tx % 6])
            elif ty == 2:
                t = tile_of(["wall-midA-bot", "wall-midB-bot", "facade-privatix-bot", "wall-midC-bot",
                             "facade-horaires-bot", "wall-midA-bot"][tx % 6])
            elif ty in (12,):
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
            else:
                k = (tx * 7 + ty * 3) % 11
                t = tile_of(["quai-0", "quai-1", "quai-2", "quai-3", "quai-0", "quai-1", "quai-stain" if k == 6 and tx % 3 == 0 else "quai-2",
                             "quai-2", "quai-3", "quai-1", "quai-0"][k])
                if ty == 11:
                    t = tile_of("quai-podo-line")
            scene[ty * T : (ty + 1) * T, tx * T : (tx + 1) * T] = t
    sprites = []

    def put(img, x, y, shadow=None):
        """x, y = position du pivot (pieds)."""
        sprites.append((y, img, x, y, shadow))

    put(props.banc_h(), 120, 80)
    put(props.pilier(), 300, 92)
    put(props.distributeur(), 520, 84)
    put(props.poubelle(), 260, 168)
    put(props.panneau_quai(2), 400, 300)
    put(props.cone(), 60, 180)
    put(props.portique(5), 600, 300)

    h_idle = hero.attack1("side")[2]
    put(h_idle, 250, 150 + 44 - 44, shadow="m")
    cons = consultant.run("side")[2]
    put(lib.flipx(cons), 330, 158, shadow="s")
    put(consultant.attack("down")[0], 360, 120, shadow="s")
    put(machines.borne_attack()[1], 470, 140, shadow="m")
    put(machines.drone_fly()[0], 200, 112, shadow="s")
    put(hero.idle("down")[0], 120, 300, shadow="m")
    put(boss.idle()[0], 520, 352, shadow="xl")
    shadows = {"s": vfx.shadow(16, 8), "m": vfx.shadow(24, 8), "xl": vfx.shadow(80, 24)}

    rgba = np.array(lib.to_image(scene)).astype(np.float32)

    def comp(img, x0, y0, alpha=1.0):
        im = np.array(lib.to_image(img)).astype(np.float32)
        h, w = img.shape
        for yy in range(h):
            for xx in range(w):
                X, Y = x0 + xx, y0 + yy
                if 0 <= X < W and 0 <= Y < H and im[yy, xx, 3] > 0:
                    rgba[Y, X, :3] = rgba[Y, X, :3] * (1 - alpha) + im[yy, xx, :3] * alpha

    for (_, img, x, y, sh) in sorted(sprites, key=lambda s: s[0]):
        h, w = img.shape
        if sh:
            s = shadows[sh]
            comp(s, x - s.shape[1] // 2, y - s.shape[0] // 2 - 1, 0.5)
        oy = 44 if h == 48 else 28 if h == 32 else 88 if h == 96 else h
        comp(img, x - w // 2, y - oy)
    # slash du héros
    sl = vfx.slash(0)[2]
    comp(sl, 262 - 32 + 10, 132 - 32)
    # HUD
    comp(ui.bar_frame(104, 12, "O"), 8, 8)
    comp(ui.bar_fill(70, 8, "x", "O", "R"), 10, 10)
    comp(ui.bar_frame(76, 8, "V"), 8, 22)
    comp(ui.bar_fill(30, 4, "V", "W", "d"), 10, 24)
    for i, st in enumerate((0, 0, 2)):
        comp(ui.dash_pips()[st], 116 + i * 10, 10)
    comp(ui.icon("gobelet"), 8, 32)
    comp(ui.cursor(1), 462, 112)
    out = Image.fromarray(rgba.astype(np.uint8), "RGBA").resize((W * 2, H * 2), Image.NEAREST)
    path = os.path.join(HERE, "preview", "mock_scene.png")
    out.save(path)
    print(path)


if __name__ == "__main__":
    main()
