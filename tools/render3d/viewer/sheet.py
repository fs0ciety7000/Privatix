"""Planche contact des captures : python sheet.py <dossier> <motif> <sortie.png> [colonnes]"""
import glob
import sys

from PIL import Image, ImageDraw

d, pat, out = sys.argv[1], sys.argv[2], sys.argv[3]
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 4
files = sorted(glob.glob(f"{d}/{pat}"))
ims = [Image.open(f).convert("RGB") for f in files]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * w, rows * h), (10, 8, 24))
dr = ImageDraw.Draw(sheet)
for i, (f, im) in enumerate(zip(files, ims)):
    x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(im, (x, y))
    dr.text((x + 8, y + 6), f.split("/")[-1][:-4], fill=(255, 220, 150))
sheet.save(out)
print(out, sheet.size)
