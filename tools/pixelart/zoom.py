"""zoom.py module filtre [scale] : frames d'une anim à fort grossissement."""
import importlib, os, sys, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib
from PIL import Image
mod = importlib.import_module(sys.argv[1]); key = sys.argv[2]; sc = int(sys.argv[3]) if len(sys.argv) > 3 else 8
got = []
def emit(folder, name, frames, *a, **k):
    if re.search(key, name): got.append(lib.strip(frames))
def emit_image(folder, name, img, *a, **k):
    if re.search(key, name): got.append(img)
if hasattr(mod, "build_images"): mod.build_images(emit_image)
mod.build(emit) if hasattr(mod, "build") else None
W = max(g.shape[1] for g in got); H = sum(g.shape[0] + 2 for g in got)
out = Image.new("RGBA", (W * sc, H * sc), (56, 62, 76, 255)); y = 0
for g in got:
    im = lib.to_image(g); im = im.resize((im.size[0] * sc, im.size[1] * sc), Image.NEAREST)
    out.alpha_composite(im, (0, y)); y += (g.shape[0] + 2) * sc
out.save("preview/zoom.png"); print(out.size, len(got))
