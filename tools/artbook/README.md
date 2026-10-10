# tools/artbook — Artbook & Press kit

Génère les planches, animations et fichiers du press kit de Privatix, servis par `site/artbook.html` et listés dans `docs/artbook/README.md`.

```bash
node tools/artbook/build.mjs                  # tout (≈ 1 h 30 en rendu logiciel SwiftShader)
node tools/artbook/build.mjs sheets page      # recompose les planches et la page depuis le cache
node tools/artbook/build.mjs stills --only lurcke,hall
```

| Étape | Script | Sortie |
|---|---|---|
| `models` | `models.mjs` (visionneuse `tools/render3d/viewer`, `?shot&portrait`) | `.cache/models/<id>/turn-*.png`, `pose-*.png`, tenues |
| `stills` | `game.mjs stills` (`play3d.html?demo&cheat`, 1920×1080) | `.cache/game/stills/*.png` |
| `clips` | `game.mjs clips` (960×540, 30 i/s) | `.cache/game/clips/<id>/f*.png` |
| `sheets` | `sheets_characters.py`, `sheets_scenes.py` (spec : `scenes.json`), `sheets_da.py` | `site/public/artbook/planches/*.webp` (2400 px et `-1200`) |
| `anim` | `anim.mjs` (ffmpeg) | `site/public/artbook/anim/*.gif|webm|mp4`, affiches |
| `presskit` | `presskit.py` | `site/public/artbook/presskit/` (logo, captures, textes) |
| `page` | `page.py` (sommaire : `catalog.json`) | galeries de `site/artbook.html`, `docs/artbook/README.md` |

- **Temps virtuel** (`gamelib.mjs`) : `performance.now` et `requestAnimationFrame` sont remplacés dans la page ; chaque image du jeu est calculée à pas fixe de 1000/30 ms, quelle que soit la lenteur du rendu logiciel. `advance(ms)` de l'API de démo fait avancer la simulation sans dessiner (mise en place).
- **Éclairage de présentation** (`__artbookLamps`, par le crochet `__THREE_DEVTOOLS__` de Three.js, sans toucher au jeu) : dans les Shifts, l'énergie des lampes de salle est ramenée au budget du preset bas et le néon Privatix est adouci. Le preset haut tel quel surexpose quais et hall (6 flaques additives, bloom au seuil 0,96).
- **Personnages** : un personnage = une entrée de `characters.json` (modèle, poses `[libellé, clip, temps]`, zoom). Le boss final Jean-Cul Lurcke a sa model sheet comme les autres boss (`public/models/lurcke.glb`).
- Prérequis : Node 22, Playwright + Chromium, Python 3 + Pillow, ffmpeg (libvpx-vp9, libx264), dépendances de `tools/render3d/viewer` (`npm ci`).
