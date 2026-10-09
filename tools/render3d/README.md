# Pipeline 3D → pixel art (méthode Dead Cells)

Les personnages de Privatix (héros, ennemis, boss, PNJ) sont des **modèles 3D low-poly articulés**, rendus
directement à la taille du sprite, **sans lissage**, puis convertis en pixel art. C'est la technique de
Dead Cells : une animation très fluide (autant de frames qu'on veut), des volumes cohérents et des
**normal maps** exactes pour l'éclairage dynamique du jeu.

```bash
npm run sprites3d:setup          # une fois : Blender 5.2 en module Python (bpy) dans tools/render3d/.venv
npm run sprites3d                # rend tous les personnages
cd tools/render3d && .venv/bin/python build.py hero --anims idle,run --dirs side --preview   # itérer sur un perso
```

## Comment ça marche

1. **Modèle** (`characters/<perso>.py`, outils dans `rig.py`) : pièces simples (sphères, capsules, boîtes
   arrondies) accrochées à des articulations (Empties). Pas de skinning : à 50 px de haut, c'est invisible.
2. **Poses** : une fonction par animation renvoie la pose de la frame `i` sur `n` (rotations d'articulations,
   décalage du corps, smears visibles). `_keyed` interpole des poses clés avec un adoucissement :
   anticipation, action, follow-through. L'écharpe et les éléments secondaires suivent avec du retard.
3. **Rendu** (`render.py`, Cycles CPU, caméra orthographique à 35° comme la vue du jeu, échelle commune
   `PX_PER_UNIT = 30`) : trois passes par frame en EXR flottant :
   - **matières** : chaque matière émet un identifiant exact (1 échantillon, filtre minimal → bords nets) ;
   - **lumière** : tout en blanc mat sous une lumière clé haut-gauche et un contre-jour ;
   - **normales** : en espace caméra (convention OpenGL : R droite, G haut, B vers la caméra).
4. **Pixel art** (`post.py`, palette dans `palette.py`) : la lumière est quantifiée en bandes et remplacée par la
   **rampe de couleurs à décalage de teinte** de la matière (ombres froides, lumières chaudes), puis liseré néon
   sur les bords éclairés, sel-out entre matières, contour extérieur `#14101A`. Les émissifs (smears, écrans)
   ne sont jamais ombrés.
5. **Sortie** : `public/assets/sprites/<catégorie>/<entité>_<anim>[_<dir>]_strip<N>.png` + `_n.png`, et
   `tools/render3d/manifest.json`. Le jeu fusionne ce manifeste avec celui du générateur 2D
   (`tools/pixelart/`) : **à clé d'animation égale, la 3D gagne**, et le générateur 2D n'écrase plus ces PNG.

## Ajouter ou retoucher un personnage

- Copier la structure de `characters/hero.py` : `build()`, fonctions de pose, `ANIMS`, `ENTITY`, `FRAME`,
  `PIVOT` (pieds), `PX_PER_UNIT = 30` (ne jamais changer l'échelle d'un perso à l'autre), `CATEGORY`.
- Une nouvelle matière = une entrée dans `palette.py` (id, rampe de 4 à 6 tons, émissif, liseré).
- Les clés d'animation (`consultant-attack-side`…) sont celles que le code du jeu joue : ne pas les renommer.
- Juger à ×8 sur des frames isolées, pas seulement sur la planche.

## Pièges connus

- `use_persistent_data` doit rester **désactivé** : sinon Cycles garde des shaders d'une passe à l'autre
  (pixels noirs aléatoires dans la passe matières).
- Les objets marqués `obj["no_shadow"] = True` (casque) ne portent pas d'ombre (visage lisible).
- Un modeleur peut remplacer n'importe quelle pièce par un vrai mesh (`.blend`/`.glb` importé dans `build()`) :
  la suite du pipeline ne change pas.
