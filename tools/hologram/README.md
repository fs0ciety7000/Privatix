# tools/hologram — Hologramme du héros

Rend la boucle animée du héros affichée « en hologramme » sur le site vitrine (section `#heros`).

```bash
node tools/hologram/render.mjs                 # rendu (≈ 2 min en SwiftShader) + encodage
node tools/hologram/render.mjs --encode-only   # réencode depuis le cache, sans relancer le rendu
node tools/hologram/render.mjs --webm          # ajoute un WebM VP9 avec alpha (non servi par le site)
```

- **Page** : `index.html` + `holo.js`, servis par Vite (`public/` du jeu comme dossier public). `hero.glb` équipé de sa dotation de base (casque de chantier, gilet HV, clé à tire-fond), matériaux toon et contours de la visionneuse (`tools/render3d/viewer/src/toon.js`), lumières du mode portrait sans ombres, **fond transparent**.
- **Animation** : `idle` (deux cycles) pendant que le héros fait un tour complet sur lui-même, départ en 3/4 face ; caméra fixe 3/4 plongeante (14°). 120 images à 25 i/s = 4,8 s, boucle sans saut (l'image 120 serait l'image 0).
- **Capture déterministe** : pas de temps réel ; chaque image est posée par `mixer.setTime()` et dessinée une fois, puis lue en PNG (`toDataURL`). Rendu ×2 (1344 × 960, contour ×2), recadré sur l'union des silhouettes de la boucle (centré sur l'axe de rotation) et réduit en lanczos.
- **Encodage** (`encode.py`, Pillow) : WebP animé avec alpha (qualité 60, alpha 50 avec perte : ffmpeg n'encode l'alpha WebP que sans perte, ≈ 40 % plus lourd) et affiche fixe (image 0).
- **Sorties** : `site/public/hologram/hero-holo.webp` (724 × 480, ≈ 1,4 Mo) et `hero-holo-poster.webp`. Les images brutes restent dans le cache (`$TMPDIR/privatix-hologram`, `--cache` pour le changer), hors dépôt.
- **Couleurs naturelles** : la teinte cyan, les lignes de balayage, le socle et le cône de lumière sont en CSS (`.holo` dans `site/src/styles/site.css`) ; en `prefers-reduced-motion: reduce`, le `<picture>` sert l'affiche fixe.
- Prérequis : Node 22, Playwright + Chromium (aucune installation : chemin global repris de `tools/artbook/lib.mjs`), Vite et three (dépendances du dépôt), Python 3 + Pillow, ffmpeg (pour `--webm`).
