"""Press kit : quatre captures clés (JPG 1920×1080 et WebP 960), textes de présentation et fiche
technique (Markdown). L'archive ZIP est assemblée au build du site par site/scripts/presskit.mjs à
partir de ce dossier.

Le logo, l'affiche, la bannière et la couverture viennent des visuels officiels
(docs/marketing/officiel/), recopiés ici par `node tools/marketing/sync-site.mjs`. Les anciens
privatix-logo.png / -fond.png / -1200.webp ne sont plus produits ni liés par le site : ils restent
dans le dépôt comme références des lots 1 et 2 (docs/marketing/lot*/jobs.json).

    python3 tools/artbook/presskit.py
"""
from __future__ import annotations

import json
from pathlib import Path

from draw import Image

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

- `privatix-presskit-couverture.pdf` (A4) et `.jpg` (2480 × 3508), couverture du press kit
- `logo/` : logo officiel en PNG 2048 px transparents (`privatix-logo-vertical.png`, `privatix-logo-horizontal.png`, versions `-fond-clair`), `privatix-wordmark.svg`, logos monochromes `privatix-logo-mono-blanc.svg` et `-mono-noir.svg`, icône `privatix-icone-1024.png`
- `privatix-affiche.jpg` (affiche officielle, 2560 × 3840) et `privatix-affiche-sans-texte.jpg` (key art seul)
- `privatix-banniere.jpg`, bannière officielle 2560 × 1440
- `privatix-capture-1.jpg` à `privatix-capture-4.jpg`, 1920 × 1080
- `occ-mons-studios.webp`, logo du studio
- `animations/` : GIF tirés du jeu (combo, Discosaure, drop de Patrimoine)

Privatix est une œuvre de fiction satirique. Personnages, entreprises et répliques sont inventés, hors exceptions autorisées par le porteur du projet (SNCB, « Calatrava », caricature bon enfant d'Elio Di Rupo, sans citation réelle).
"""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for i, p in enumerate(CAT["presskit"], 1):
        im = Image.open(STILLS / f"{p['src']}.png").convert("RGB")
        im.save(OUT / f"privatix-capture-{i}.jpg", "JPEG", quality=88, optimize=True, progressive=True)
        im.resize((960, 540), Image.LANCZOS).save(OUT / f"privatix-capture-{i}-960.webp", "WEBP", quality=80, method=6)
    (OUT / "presentation.md").write_text(PRESENTATION)
    for f in sorted(OUT.iterdir()):
        print(f.relative_to(ROOT), f"{f.stat().st_size / 1024:.0f} Kio")


if __name__ == "__main__":
    main()
