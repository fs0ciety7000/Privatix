# Pipeline 3D → pixel art (méthode Dead Cells, DA Dead Cells / Celeste / Hades)

Les personnages de Privatix (héros, ennemis, boss, PNJ) sont des **modèles 3D low-poly articulés**, rendus
directement à la taille du sprite, **sans lissage**, puis convertis en pixel art. C'est la technique de
Dead Cells : une animation très fluide (autant de frames qu'on veut), des volumes cohérents et des
**normal maps** exactes pour l'éclairage dynamique du jeu.

```bash
npm run sprites3d:setup          # une fois : Blender 5.2 en module Python (bpy) dans tools/render3d/.venv
npm run sprites3d                # rend tous les personnages
cd tools/render3d && .venv/bin/python build.py hero --anims idle,run --dirs side --preview   # itérer sur un perso
cd tools/render3d && .venv/bin/python build.py npcs:marcel,fatou --preview                 # entités d'un module multi-entités
cd tools/render3d && .venv/bin/python build.py --recap                                     # tout + planche preview/recap.png
```

## Comment ça marche

1. **Modèle** (`characters/<perso>.py`, outils dans `rig.py`) : pièces simples (sphères, capsules, boîtes
   arrondies) accrochées à des articulations (Empties). Pas de skinning : à 50 px de haut, c'est invisible.
2. **Poses** : une fonction par animation renvoie la pose de la frame `i` sur `n` (rotations d'articulations,
   décalage du corps, smears visibles). `_keyed` interpole des poses clés avec un adoucissement :
   anticipation, action, follow-through. L'écharpe et les éléments secondaires suivent avec du retard.
3. **Rendu** (`render.py`, Cycles CPU, caméra orthographique à 40° comme la vue du jeu, échelle commune
   `PX_PER_UNIT = 30`) : quatre passes par frame en EXR flottant :
   - **matières** : chaque matière émet un identifiant exact (1 échantillon, filtre minimal → bords nets) ;
   - **lumière** : tout en blanc mat sous une lumière clé haut-gauche et un contre-jour ;
   - **normales** : en espace caméra (convention OpenGL : R droite, G haut, B vers la caméra) ;
   - **profondeur** : distance le long de l'axe de vue, pour l'encrage des lignes intérieures.
4. **Pixel art** (`post.py`, palette dans `palette.py`) — réglages « Hades » (contraste dramatique, encrage BD) :
   - **débruitage** : médian 3×3 de la passe lumière, restreint à une même matière (pas de moucheté) ;
   - **quantification contrastée** : seuils explicites `THRESHOLDS` par longueur de rampe (ex. 5 tons :
     0,20 / 0,36 / 0,52 / 0,74) : le ton le plus profond est réservé aux ombres franches, les tons moyens
     sont resserrés, les lumières sont larges ; la lumière est remplacée par la **rampe à décalage de teinte**
     de la matière (ombre bleu nuit / violet presque noir, jamais `#000` ; lumières franches et saturées) ;
   - **encrage (Jen Zee)** : trait sombre (ton le plus profond de la matière, ou `INK_RGB`) là où une pièce
     passe devant une autre (saut de profondeur > `INK_DEPTH` = 7 cm, le trait va sur la pièce de derrière)
     et à la frontière entre deux matières structurelles (liserées) ; décors fins (bandes, chemise, cravate,
     écrans) non encrés pour rester lisibles ;
   - **liseré néon** `#6FF3FF` (cyan des quais) sur les bords tournés vers le haut/la droite, **élargi à 2 px**
     quand le volume est assez épais (2ᵉ pixel = mélange liseré / ton le plus clair) ;
   - contour extérieur 1 px `#14101A`. Les émissifs (smears, écrans, LED) ne sont jamais ombrés ni encrés.
5. **Sortie** : `public/assets/sprites/<catégorie>/<entité>_<anim>[_<dir>]_strip<N>.png` + `_n.png`, et
   `tools/render3d/manifest.json`. Le jeu fusionne ce manifeste avec celui du générateur 2D
   (`tools/pixelart/`) : **à clé d'animation égale, la 3D gagne**, et le générateur 2D n'écrase plus ces PNG.

## Personnages

| Module | Entité(s) | Cadre / pivot | Anims |
|---|---|---|---|
| `hero.py` | `player` | 80 / (40, 66) | idle, run, attack1-3, dash, hurt, death, spawn, special |
| `consultant.py` | `consultant` (directionnel) | 80 / (40, 62) | idle 6, run 8, attack 8 (télégraphe 0-3, actif 4), hurt 3, death 10 |
| `borne.py` | `borne` | 64 / (32, 52) | idle 6, wake 6, attack 6 (télégraphe 0-3, tir 4), hurt 2, death 6, wreck 1 |
| `drone.py` | `drone` | 80 / (40, 60) | fly 4, attack 8 (visée 0-3, piqué 4-7), hurt 2, death 6 |
| `manager.py` | `manager-kpi` (directionnel, élite) | 112 / (56, 88) | idle 6, walk 8, attack 8 (télégraphe 1-3, actif 5), shield 8 (actif 3), hurt 2, death 8 |
| `auditeur.py` | `auditeur` (boss) | 208 / (104, 156) | intro 14, idle 6, move 8, attack-sweep 12, attack-barrage 8, attack-stamp 14, phase 12, idle-p2 6, move-p2 8, hurt 2, death 20 |
| `npcs.py` | `marcel`, `fatou`, `yasmina`, `kevin`, `bene`, `josiane`, `rudy`, `jeanmi` | 64 / (32, 56) | idle 6 |

Couleurs de lecture : ennemis à dominante **turquoise `#19C3B1`**, tout ce qui blesse ou télégraphie en
**magenta `#FF3EA5` émissif** (écran du laptop, tablette, LED du drone, barrières, onde de choc, smears).
Les PNJ n'utilisent ni l'un ni l'autre.

## Ajouter ou retoucher un personnage

- Copier la structure de `characters/hero.py` : `build()`, fonctions de pose, `ANIMS`, `ENTITY`, `FRAME`,
  `PIVOT` (pieds), `PX_PER_UNIT = 30` (ne jamais changer l'échelle d'un perso à l'autre), `CATEGORY`.
  Toutes les anims d'une entité partagent `FRAME` et `PIVOT` (le jeu fixe l'origine d'après l'idle).
- Outils partagés : `characters/common.py` (poses, `merge`, `lerp_pose`, `keyed` avec décalages et échelles
  d'articulations pour le squash & stretch), `characters/humanoid.py` (corps humanoïde paramétrable,
  respiration, **IK de bras** `arm_ik`, objet tenu à deux mains `hold_prop`, orientation de la main `point_hand`).
- `SMEARS` : pièces visibles seulement si la pose les liste dans `smear` ; `TOGGLES` : pièces visibles
  seulement si la pose les liste dans `show` (écran allumé/éteint, étincelles, tickets, blindage…).
- Un module peut exposer plusieurs entités : liste `ENTITIES` d'objets ayant les mêmes attributs (`npcs.py`).
- Sortie de trappe / sous le sol : un volume **holdout** sous z = 0 masque proprement ce qui est enterré (`borne.py`).
- Une nouvelle matière = une entrée dans `palette.py` (id, rampe de 4 à 6 tons, émissif, liseré).
- Les clés d'animation (`consultant-attack-side`…) sont celles que le code du jeu joue : ne pas les renommer.
- Juger à ×8 sur des frames isolées, pas seulement sur la planche (`preview/recap.png`).

## Pièges connus

- `use_persistent_data` doit rester **désactivé** : sinon Cycles garde des shaders d'une passe à l'autre
  (pixels noirs aléatoires dans la passe matières).
- Les objets marqués `obj["no_shadow"] = True` (casque) ne portent pas d'ombre (visage lisible).
- Caméra à 40° : une visière ou une frange sous ~0,28 m au-dessus du crâne masque les yeux. Garder casquettes,
  bonnets et cheveux hauts, et relever légèrement la tête des PNJ.
- Un smear dans un plan vertical est invisible de face : l'incliner (coup en diagonale) ou lui donner de l'épaisseur.
- Un modeleur peut remplacer n'importe quelle pièce par un vrai mesh (`.blend`/`.glb` importé dans `build()`) :
  la suite du pipeline ne change pas.
