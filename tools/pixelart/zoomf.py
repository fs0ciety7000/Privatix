"""zoomf.py module regex [scale] [frames] : frames choisies à fort grossissement, sur fond de quai."""
import importlib, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
import lib
mod = importlib.import_module(sys.argv[1]); key = sys.argv[2]
sc = int(sys.argv[3]) if len(sys.argv) > 3 else 8
sel = [int(x) for x in sys.argv[4].split(",")] if len(sys.argv) > 4 else None
rows = []
def emit(folder, name, frames, *a, **k):
    if re.search(key, name):
        fr = [frames[i] for i in sel if i < len(frames)] if sel else frames
        rows.append(lib.strip(fr))
def emit_image(*a, **k):
    pass
if hasattr(mod, "build"):
    mod.build(emit)
W = max(r.shape[1] for r in rows); H = sum(r.shape[0] + 2 for r in rows)
out = Image.new("RGBA", (W * sc, H * sc), (52, 68, 106, 255)); y = 0
for r in rows:
    im = lib.to_image(r).resize((r.shape[1] * sc, r.shape[0] * sc), Image.NEAREST)
    out.alpha_composite(im, (0, y)); y += (r.shape[0] + 2) * sc
p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "preview", "zoomf.png")
out.save(p); print(out.size)
