"""Primitives de mise en page des planches de l'artbook (Pillow) : fond nuit, panneaux encrés au
liseré coloré (design system « Néon & Ballast », docs/DESIGN_SYSTEM.md), typographie, découpes.

Toutes les cotes sont en pixels de la planche 2x (2400 px de large)."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

# ─── Tokens (site/src/styles/tokens.css) ─────────────────────────────────────────────────────
INK = (20, 16, 26)
NIGHT = (10, 8, 24)
NIGHT2 = (18, 13, 36)
PANEL = (22, 16, 42)
PANEL2 = (28, 20, 52)
SHADOW_VIOLET = (42, 33, 72)
TEXT = (255, 255, 255)
SOFT = (220, 216, 239)
MUTE = (169, 163, 200)
LABEL = (255, 217, 184)
HERO = (255, 122, 26)
ENEMY = (25, 195, 177)
DANGER = (255, 62, 165)
VIOLET = (107, 63, 160)
VIOLET_HI = (176, 92, 255)
RIM = (111, 243, 255)
GOLD = (255, 210, 0)
SODIUM = (255, 179, 71)
TUNGSTEN = (255, 194, 122)
ROLE = {"hero": HERO, "enemy": ENEMY, "elite": VIOLET_HI, "boss": DANGER, "npc": TUNGSTEN}

FONT_DIRS = ["/usr/share/fonts/opentype/inter", "/usr/share/fonts/truetype/dejavu", "/usr/share/fonts/truetype/liberation"]
FONTS = {
    "display": ["Inter-Black.otf", "DejaVuSans-Bold.ttf", "LiberationSans-Bold.ttf"],
    "bold": ["Inter-Bold.otf", "DejaVuSans-Bold.ttf", "LiberationSans-Bold.ttf"],
    "semi": ["Inter-SemiBold.otf", "DejaVuSans-Bold.ttf", "LiberationSans-Bold.ttf"],
    "text": ["Inter-Regular.otf", "DejaVuSans.ttf", "LiberationSans-Regular.ttf"],
    "medium": ["Inter-Medium.otf", "DejaVuSans.ttf", "LiberationSans-Regular.ttf"],
    "mono": ["DejaVuSansMono.ttf", "LiberationMono-Regular.ttf"],
    "monob": ["DejaVuSansMono-Bold.ttf", "LiberationMono-Bold.ttf"],
}


@lru_cache(maxsize=None)
def font(kind: str, size: int) -> ImageFont.FreeTypeFont:
    for name in FONTS[kind]:
        for d in FONT_DIRS:
            p = Path(d) / name
            if p.exists():
                return ImageFont.truetype(str(p), size)
    return ImageFont.load_default(size)


def hexrgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def rgbhex(c) -> str:
    return "#%02X%02X%02X" % tuple(c[:3])


def lum(c) -> float:
    r, g, b = (v / 255 for v in c[:3])
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


# ─── Fonds et panneaux ────────────────────────────────────────────────────────────────────────


def background(w: int, h: int, accent=VIOLET, grid: int = 48) -> Image.Image:
    """Nuit violette (jamais de noir pur), grille de calque très discrète, halo d'accent, vignette."""
    g = Image.new("RGB", (1, 256))
    for y in range(256):
        t = y / 255
        g.putpixel((0, y), tuple(int(a + (b - a) * t) for a, b in zip(NIGHT2, NIGHT)))
    img = g.resize((w, h), Image.BILINEAR).convert("RGBA")
    lines = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(lines)
    for x in range(0, w, grid):
        d.line([(x, 0), (x, h)], fill=(255, 255, 255, 7), width=1)
    for y in range(0, h, grid):
        d.line([(0, y), (w, y)], fill=(255, 255, 255, 7), width=1)
    img.alpha_composite(lines)
    img.alpha_composite(glow((w, h), (w * 0.82, h * 0.05), (w * 0.45, h * 0.35), accent, 70, w * 0.08))
    img.alpha_composite(glow((w, h), (w * 0.1, h * 0.95), (w * 0.4, h * 0.3), VIOLET, 60, w * 0.08))
    return img


def glow(size, center, radius, color, alpha: int, blur: float) -> Image.Image:
    w, h = size
    layer = Image.new("RGBA", (w, h), (*color[:3], 0))
    d = ImageDraw.Draw(layer)
    cx, cy = center
    rx, ry = radius
    d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=(*color[:3], alpha))
    return layer.filter(ImageFilter.GaussianBlur(blur))


def panel(img: Image.Image, box, rim=RIM, fill=PANEL, inset: int = 8, radius: int = 14, shadow: int = 10) -> None:
    """Panneau « figurine » : ombre portée dure, contour encré de 4 px, liseré coloré rentré."""
    x0, y0, x1, y1 = box
    d = ImageDraw.Draw(img)
    if shadow:
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).rounded_rectangle((x0, y0 + shadow, x1, y1 + shadow), radius, fill=(0, 0, 0, 115))
        img.alpha_composite(sh)
    d.rounded_rectangle(box, radius, fill=(*fill, 255) if len(fill) == 3 else fill, outline=INK, width=4)
    if rim is not None:
        ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(ov).rounded_rectangle(
            (x0 + inset, y0 + inset, x1 - inset, y1 - inset), max(2, radius - inset // 2), outline=(*rim[:3], 120), width=2
        )
        img.alpha_composite(ov)


def text(img: Image.Image, xy, s: str, f, fill=TEXT, tracking: float = 0, anchor: str = "la", shadow: bool = False) -> int:
    """Texte avec interlettrage (en px) ; renvoie la largeur dessinée."""
    d = ImageDraw.Draw(img)
    x, y = xy
    if tracking == 0:
        if shadow:
            d.text((x, y + 3), s, font=f, fill=(0, 0, 0), anchor=anchor)
        d.text((x, y), s, font=f, fill=fill, anchor=anchor)
        return int(d.textlength(s, font=f))
    width = sum(d.textlength(c, font=f) for c in s) + tracking * (len(s) - 1)
    if anchor[0] == "m":
        x -= width / 2
    elif anchor[0] == "r":
        x -= width
    a = "l" + anchor[1]
    for c in s:
        if shadow:
            d.text((x, y + 3), c, font=f, fill=(0, 0, 0), anchor=a)
        d.text((x, y), c, font=f, fill=fill, anchor=a)
        x += d.textlength(c, font=f) + tracking
    return int(width)


def wrap(s: str, f, width: int) -> list[str]:
    d = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    out: list[str] = []
    for para in s.split("\n"):
        line = ""
        for word in para.split(" "):
            t = f"{line} {word}".strip()
            if d.textlength(t, font=f) <= width:
                line = t
            else:
                if line:
                    out.append(line)
                line = word
        out.append(line)
    return out


def paragraph(img, xy, s: str, f, width: int, fill=SOFT, leading: float = 1.45) -> int:
    x, y = xy
    lh = int(f.size * leading)
    for line in wrap(s, f, width):
        text(img, (x, y), line, f, fill)
        y += lh
    return y


def label(img, xy, s: str, color=MUTE, size: int = 22, anchor="la") -> int:
    """Libellé de HUD : petites capitales espacées (mono)."""
    return text(img, xy, s.upper(), font("monob", size), color, tracking=size * 0.18, anchor=anchor)


def pill(img, xy, s: str, bg, fg=INK, size: int = 24, pad=(18, 8)) -> tuple[int, int]:
    f = font("bold", size)
    d = ImageDraw.Draw(img)
    w = d.textlength(s.upper(), font=f) + len(s) * size * 0.08
    x, y = xy
    box = (x, y, x + w + pad[0] * 2, y + size + pad[1] * 2)
    d.rounded_rectangle(box, (box[3] - box[1]) // 2, fill=bg, outline=INK, width=3)
    text(img, (x + pad[0], y + pad[1] + size * 0.02), s.upper(), f, fg, tracking=size * 0.08)
    return int(box[2] - box[0]), int(box[3] - box[1])


# ─── Images ───────────────────────────────────────────────────────────────────────────────────


def load(p: Path) -> Image.Image:
    return Image.open(p).convert("RGBA")


def clean(im: Image.Image, keep: int = 13) -> Image.Image:
    """Retire l'ombre portée loin de la figurine (on garde un liseré d'ombre au contact)."""
    a = im.getchannel("A")
    solid = a.point(lambda v: 255 if v > 200 else 0)
    near = solid.filter(ImageFilter.MaxFilter(keep)).filter(ImageFilter.GaussianBlur(keep / 3))
    out = im.copy()
    out.putalpha(ImageChops.multiply(a, near))
    return out


def solid_bbox(im: Image.Image, thr: int = 200):
    return im.getchannel("A").point(lambda v: 255 if v > thr else 0).getbbox()


def union(boxes):
    boxes = [b for b in boxes if b]
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))


def fit_scale(bw: int, bh: int, cw: int, ch: int) -> float:
    return min(cw / bw, ch / bh)


def paste_scaled(img: Image.Image, src: Image.Image, crop, scale: float, anchor_xy, align="bottom-center") -> tuple[int, int, int, int]:
    """Colle `src` découpée par `crop`, mise à l'échelle, pieds (bas) sur `anchor_xy`."""
    part = src.crop(crop)
    w, h = max(1, round(part.width * scale)), max(1, round(part.height * scale))
    part = part.resize((w, h), Image.LANCZOS)
    ax, ay = anchor_xy
    if align == "bottom-center":
        x, y = round(ax - w / 2), round(ay - h)
    elif align == "center":
        x, y = round(ax - w / 2), round(ay - h / 2)
    else:
        x, y = ax, ay
    img.alpha_composite(part, (x, y))
    return x, y, x + w, y + h


def silhouette(src: Image.Image, color=INK, thr: int = 200) -> Image.Image:
    a = src.getchannel("A").point(lambda v: 255 if v > thr else 0)
    out = Image.new("RGBA", src.size, (*color[:3], 0))
    out.putalpha(a)
    return out


def cover(src: Image.Image, w: int, h: int, focus=(0.5, 0.5)) -> Image.Image:
    """Recadre `src` pour remplir w×h (comme object-fit: cover), centré sur `focus`."""
    k = max(w / src.width, h / src.height)
    rw, rh = round(src.width * k), round(src.height * k)
    big = src.resize((rw, rh), Image.LANCZOS)
    x = min(max(0, round(focus[0] * rw - w / 2)), rw - w)
    y = min(max(0, round(focus[1] * rh - h / 2)), rh - h)
    return big.crop((x, y, x + w, y + h))


def framed(img: Image.Image, src: Image.Image, box, rim=RIM, focus=(0.5, 0.5), radius: int = 14) -> None:
    """Image (capture du jeu) dans un panneau encré à coins arrondis."""
    x0, y0, x1, y1 = box
    panel(img, box, rim=None, fill=INK, radius=radius)
    inner = (x0 + 4, y0 + 4, x1 - 4, y1 - 4)
    w, h = inner[2] - inner[0], inner[3] - inner[1]
    pic = cover(src.convert("RGBA"), w, h, focus)
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w - 1, h - 1), radius - 4, fill=255)
    img.paste(pic, inner[:2], mask)
    ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(ov).rounded_rectangle((x0 + 8, y0 + 8, x1 - 8, y1 - 8), radius - 4, outline=(*rim[:3], 150), width=2)
    img.alpha_composite(ov)


def caption(img, xy, title: str, sub: str | None = None, color=RIM, width: int | None = None) -> int:
    """Légende sous une image : libellé de couleur + texte doux."""
    x, y = xy
    text(img, (x, y), title, font("bold", 28), TEXT)
    y += 40
    if sub:
        if width:
            y = paragraph(img, (x, y), sub, font("text", 22), width, MUTE, 1.4)
        else:
            text(img, (x, y), sub, font("text", 22), MUTE)
            y += 32
    return y


def save(img: Image.Image, out_dir: Path, name: str, quality: int = 84) -> list[Path]:
    """Planche 2x (pleine) + 1x (moitié) en WebP."""
    out_dir.mkdir(parents=True, exist_ok=True)
    rgb = img.convert("RGB")
    p2 = out_dir / f"{name}.webp"
    p1 = out_dir / f"{name}-1200.webp"
    rgb.save(p2, "WEBP", quality=quality, method=6)
    rgb.resize((rgb.width // 2, rgb.height // 2), Image.LANCZOS).save(p1, "WEBP", quality=quality + 2, method=6)
    return [p2, p1]


def header(img, title: str, eyebrow: str, sub: str | None, accent, x: int = 64, y: int = 56) -> int:
    label(img, (x, y), eyebrow, accent, 22)
    text(img, (x, y + 40), title, font("display", 84), TEXT, shadow=True)
    yy = y + 40 + 104
    if sub:
        text(img, (x, yy), sub, font("medium", 32), SOFT)
        yy += 48
    return yy


def footer(img, left: str, right: str = "PRIVATIX · ARTBOOK · NÉON & BALLAST · OCC INTERACTIVE") -> None:
    w, h = img.size
    d = ImageDraw.Draw(img)
    d.line([(64, h - 72), (w - 64, h - 72)], fill=(255, 255, 255, 30), width=2)
    label(img, (64, h - 50), left, MUTE, 18)
    label(img, (w - 64, h - 50), right, MUTE, 18, anchor="ra")


def recolor(src: Image.Image, color, alpha_scale: float = 1.0) -> Image.Image:
    a = src.getchannel("A")
    if alpha_scale != 1:
        a = a.point(lambda v: int(v * alpha_scale))
    out = Image.new("RGBA", src.size, (*color[:3], 255))
    out.putalpha(a)
    return out


def edge_glow(src_alpha: Image.Image, color, blur: float, strength: float = 0.6) -> Image.Image:
    sil = src_alpha.point(lambda v: 255 if v > 200 else 0)
    layer = Image.new("RGBA", src_alpha.size, (*color[:3], 0))
    layer.putalpha(sil.filter(ImageFilter.GaussianBlur(blur)).point(lambda v: int(v * strength)))
    return layer


__all__ = [n for n in dir() if not n.startswith("_")] + ["ImageChops", "ImageDraw", "ImageFilter", "Image"]
