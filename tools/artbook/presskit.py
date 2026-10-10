"""Press kit : logotype néon (PNG transparent et sur fond nuit, aperçu WebP), quatre captures clés
(JPG 1920×1080 et WebP 960), textes de présentation et fiche technique (Markdown). L'archive ZIP est
assemblée au build du site par site/scripts/presskit.mjs à partir de ce dossier.

    python3 tools/artbook/presskit.py
"""
from __future__ import annotations

import json
from pathlib import Path

from draw import DANGER, NIGHT, NIGHT2, Image, ImageDraw, ImageFilter, font, glow, text

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
STILLS = HERE / ".cache" / "game" / "stills"
OUT = ROOT / "site" / "public" / "artbook" / "presskit"
CAT = json.loads((HERE / "catalog.json").read_text())

PRESENTATION = """# Privatix — press kit

> Un cheminot en 3x8, une clé à tire-fond, une cafetière de 1987 et des collègues à la radio contre une armée de consultants qui veulent libéraliser et privatiser le rail !

## Présentation courte

Un cheminot en 3x8, une clé à tire-fond, une cafetière de 1987 et des collègues à la radio contre une armée de consultants qui veulent libéraliser et privatiser le rail ! Privatix est un hack 'n' slash roguelite satirique en 3D, gratuit, jouable dans le navigateur et sur Windows, macOS et Linux.

## Présentation longue

Mons, 4 h 47, quai 2. L'écran des départs annonce que le train de 7 h 12 est supprimé. Motif : « Optimisation ». Le consortium Privatix Rail Solutions et son cabinet de conseil, Synergia Partners, veulent libéraliser et privatiser le rail : ouvrir le réseau à la concurrence, le découper en lots et les céder un par un. Mons est le lot n° 1.

Léon, ou Léa, agent·e polyvalent·e en 3x8, prend la clé à tire-fond de son grand-père et remonte la gare à contre-courant : les Quais & Voies, la Passerelle « Calatrava », puis le Hall & BAG, jusqu'au bureau où Jean-Cul Lurcke tient le stylo. Chaque tentative est un Shift ; quand le héros tombe, les collègues le ramènent à l'OCC, le centre opérationnel rebaptisé « Operation Coffee Center ».

Combat nerveux et lisible (tout ce qui blesse est magenta et télégraphié), Burnout qui rend plus fort et plus fragile, butin qui se voit sur le héros, rendu 3D toon « Néon & Ballast ». Satirique dans les noms, sérieux dans les règles.

## Fiche technique

| | |
|---|---|
| Titre | Privatix |
| Genre | Hack 'n' slash roguelite, vue de dessus |
| Plateformes | Web (navigateur, desktop et mobile en paysage) ; desktop Windows, macOS, Linux |
| Moteur | Three.js 0.186 (3D temps réel, rendu toon), TypeScript, Vite ; version de bureau Electron |
| Studio | OCC MONS Studios |
| Langue | Français (Belgique) |
| Prix | Gratuit |
| Site | https://privatix.fs0ciety.org/ |
| Artbook | https://privatix.fs0ciety.org/artbook.html |

## Contenu de l'archive

- `privatix-logo.png` (transparent) et `privatix-logo-fond.png` (fond nuit), 2400 × 800
- `privatix-capture-1.jpg` à `privatix-capture-4.jpg`, 1920 × 1080
- `occ-mons-studios.webp`, logo du studio
- `animations/` : GIF tirés du jeu (combo, Discosaure, drop de Patrimoine)

Privatix est une œuvre de fiction satirique. Personnages, entreprises et répliques sont inventés, hors exceptions autorisées par le porteur du projet (SNCB, « Calatrava », caricature bon enfant d'Elio Di Rupo, sans citation réelle).
"""


def logo(w: int = 2400, h: int = 800, bg: bool = False) -> Image.Image:
    img = Image.new("RGBA", (w, h), (*NIGHT, 255) if bg else (0, 0, 0, 0))
    if bg:
        g = Image.new("RGB", (1, 256))
        for y in range(256):
            t = y / 255
            g.putpixel((0, y), tuple(int(a + (b - a) * t) for a, b in zip(NIGHT2, NIGHT)))
        img = g.resize((w, h), Image.BILINEAR).convert("RGBA")
        img.alpha_composite(glow((w, h), (w / 2, h / 2), (w * 0.42, h * 0.38), DANGER, 70, w * 0.06))
    f = font("display", int(h * 0.36))
    s = "PRIVATIX"
    tracking = h * 0.045
    layer = Image.new("RGBA", (w, h), (*DANGER, 0))
    text(layer, (w / 2, h / 2), s, f, (*DANGER, 255), tracking=tracking, anchor="mm")
    # halo néon (plusieurs flous), tube clair par-dessus, ombre dure en dessous
    fat = layer.copy()
    fat.putalpha(layer.getchannel("A").filter(ImageFilter.MaxFilter(int(h * 0.008) | 1)))
    for blur, gain in ((h * 0.13, 0.75), (h * 0.045, 1.0), (h * 0.012, 1.2)):
        g = fat.filter(ImageFilter.GaussianBlur(blur))
        g.putalpha(g.getchannel("A").point(lambda v, k=gain: min(255, int(v * k))))
        img.alpha_composite(g)
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    text(shadow, (w / 2, h / 2 + h * 0.012), s, f, (0, 0, 0, 255), tracking=tracking, anchor="mm")
    img.alpha_composite(shadow)
    text(img, (w / 2, h / 2), s, f, (255, 214, 238, 255), tracking=tracking, anchor="mm")
    core = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    text(core, (w / 2, h / 2), s, f, (255, 255, 255, 255), tracking=tracking, anchor="mm")
    core = core.filter(ImageFilter.GaussianBlur(h * 0.004))
    core.putalpha(core.getchannel("A").point(lambda v: int(v * 0.6)))
    img.alpha_composite(core)
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    lt = logo()
    lt.save(OUT / "privatix-logo.png", optimize=True)
    lb = logo(bg=True)
    lb.convert("RGB").save(OUT / "privatix-logo-fond.png", optimize=True)
    lb.convert("RGB").resize((1200, 400), Image.LANCZOS).save(OUT / "privatix-logo-1200.webp", "WEBP", quality=86, method=6)
    for i, p in enumerate(CAT["presskit"], 1):
        im = Image.open(STILLS / f"{p['src']}.png").convert("RGB")
        im.save(OUT / f"privatix-capture-{i}.jpg", "JPEG", quality=88, optimize=True, progressive=True)
        im.resize((960, 540), Image.LANCZOS).save(OUT / f"privatix-capture-{i}-960.webp", "WEBP", quality=80, method=6)
    (OUT / "presentation.md").write_text(PRESENTATION)
    for f in sorted(OUT.iterdir()):
        print(f.relative_to(ROOT), f"{f.stat().st_size / 1024:.0f} Kio")


if __name__ == "__main__":
    main()
