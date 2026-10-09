# Pipeline 3D toon → GLB (Three.js)

Les personnages de Privatix sont des modèles **3D toon temps réel**, au style validé du prototype
`prototypes/proto3d` (cel-shading 4 bandes, liseré coloré, contour en coque inversée, DA « Néon & Ballast »).
Ils sont **générés par code** dans Blender (`bpy` 5.2, sans interface) et exportés en **GLB** : armature, un
maillage skinné « rigide par os », clips d'animation et sockets d'équipement. Le contrat que le jeu peut
supposer (repère, os, sockets, matériaux, clips) est dans **[SKELETON.md](SKELETON.md)**.

```bash
npm run sprites3d:setup                              # une fois : bpy 5.2 dans tools/render3d/.venv
cd tools/render3d/viewer && npm install              # une fois : viewer + gltf-transform (compression)
cd tools/render3d && .venv/bin/python export_glb.py               # tout (≈ 15 s) → public/models/
cd tools/render3d && .venv/bin/python export_glb.py hero items     # quelques entités
cd tools/render3d && .venv/bin/python export_glb.py --raw dirupo   # sans compression meshopt
cd tools/render3d/viewer && npm run dev                            # visionneuse : http://localhost:4180
cd tools/render3d/viewer && node shots.mjs <dossier> [--only hero] [--spec specs/closeups.json]  # captures
cd tools/render3d/viewer && npm run lod                            # variantes allégées (preset bas), après chaque export
cd tools/render3d/viewer && node inspect.mjs ../../../public/models/hero.glb   # nœuds, primitives, attributs, clips
```

**Script npm racine proposé** (non ajouté au `package.json` racine, à valider par le lead dev) :

```json
"models3d": "cd tools/render3d && .venv/bin/python export_glb.py",
"models3d:viewer": "npm --prefix tools/render3d/viewer install && npm --prefix tools/render3d/viewer run dev",
"models3d:shots": "npm --prefix tools/render3d/viewer run shots -- /tmp/privatix-glb"
```

## Organisation

| Fichier | Rôle |
|---|---|
| `export_glb.py` | CLI : construit chaque entité, l'exporte, compresse (meshopt), écrit `public/models/manifest.json` |
| `glb/geo.py` | Géométrie procédurale **numpy pur**, dans le repère Three.js (Y haut, +Z avant) : sphère, demi-sphère, boîte arrondie, capsule, cylindre, cône, tore, tour (lathe), prisme, tube Catmull-Rom à poids répartis. `Model` = squelette + pièces |
| `glb/poses.py` | Poses et clips (port de `rig.ts` : `keyed`, easings, `merge`, `lerp_pose`) |
| `glb/blend.py` | bpy : armature (os à repère identité), maillage fusionné + groupes de sommets, couleurs de sommet, attribut `_OUTLINE`, actions → pistes NLA, export glTF |
| `glb/humanoid.py` | Squelette humanoïde du contrat (18 os) + 11 sockets |
| `glb/chars/hero.py` | Héros (port fidèle de `hero.ts`, modèle et poses) + **équipement** : 3 casques, 2 gilets, 4 outils |
| `glb/chars/consultant.py` | Consultant Junior (port de `consultant.ts`) |
| `glb/chars/discosaure.py` | Discosaure (port de `discosaure.ts`), boule à facettes en matériau `mirror` |
| `glb/chars/furet.py` | Furet putride (fiche art_director § 7.2) |
| `glb/chars/dirupo.py` | Boss caricature d'Elio Di Rupo (fiche § 7.3), 100 % procédural, aucune photo |
| `glb/chars/lurcke.py` | Boss final Jean-Cul Lurcke (LORE § 7.3), 100 % procédural, aucune photo ; traits du visage en décalques épousant les ellipsoïdes de la tête |
| `glb/chars/machines.py` | Borne et drone (portés de `characters/borne.py` et `drone.py`) |
| `viewer/` | Visionneuse Vite + three 0.186.1 autonome (hors build du jeu) : shader toon proche du prototype, clips, équipement, télégraphe, captures Playwright (`shots.mjs`, `specs/`), planche contact (`sheet.py`) |

Méthode d'un personnage : des **articulations** (`m.joint`) et des **pièces** accrochées (`m.sphere`, `m.box`,
`m.capsule`…), écrites avec les mêmes coordonnées que le prototype TS ; puis des **fonctions de pose**
`t_ms → pose` assemblées en `Clip`. `blend.py` fusionne tout en un maillage (un poids de 1 par sommet sur l'os
de sa pièce), échantillonne chaque clip à 30 i/s et exporte.

## Poids et budgets (meshopt, export du 09/10/2026)

| Entité | Triangles | Os | Clips | GLB |
|---|---|---|---|---|
| `hero` (corps nu) | 9 316 | 22 + 11 sockets | 9 : idle, run, attack1-3, dash, hurt, death, spawn | 280 Kio (590 brut) |
| `consultant` | 8 376 | 22 | 6 : idle, walk, attack, hurt, death, spawn | 203 Kio (482 brut) |
| `discosaure` | 14 320 | 24 | 9 : idle, walk, attack-stomp, charge-windup, charge, stagger, hurt, death, spawn | 324 Kio (904 brut) |
| `furet` | 9 050 | 31 | 9 : idle, run, attack-bite, attack-spray, war-dance, hurt, death, spawn, burrow | 306 Kio (641 brut) |
| `dirupo` | 14 950 | 26 | 10 : intro, idle, walk, attack-bowtie, attack-inauguration, hair-swipe, smile-flash, hurt, stagger, defeat | 362 Kio (879 brut) |
| `lurcke` (boss final) | 13 154 | 27 | 11 : intro, idle, walk, attack-slide, attack-sign, attack-cc, attack-tie, phase2, hurt, stagger, defeat | 382 Kio (907 brut) |
| `borne` | 2 536 | 7 | 5 : idle, spawn, attack, hurt, death | 58 Kio |
| `drone` | 3 012 | 10 | 5 : fly, attack, hurt, death, spawn | 69 Kio |
| `manager` (élite) | 7 372 | 22 | 8 : idle, walk, attack-report, attack-chrono, shield, hurt, death, spawn | 247 Kio |
| `auditeur` (boss 1) | 8 664 | 20 | 10 : intro, idle, walk, attack-sweep, attack-stamp, attack-tickets, phase2, hurt, stagger, defeat | 277 Kio |
| `fluidifieur` (élite majeur) | 6 620 | 21 | 7 : idle, glide, attack-binder, attack-spin, hurt, defeat, spawn | 208 Kio |
| `josiane` / `bene` / `kevin` (PNJ) | 6 112 / 5 900 / 5 884 | 20 | 4 : idle, walk, talk, wave | 122 Kio |

| Objet | Slot | Triangles | GLB |
|---|---|---|---|
| `casque_chantier` / `casque_antibruit` / `casque_legendaire` | casque | 1 236 / 2 220 / 2 352 | 16 / 26 / 28 Kio |
| `gilet_hv` / `gilet_porte_outils` (skinnés) | gilet | 1 372 / 3 140 | 18 / 36 Kio |
| `cle_tire_fond` / `cle_tire_fond_epique` / `masse_de_voie` / `pince_catenaire` | outil | 264 / 1 024 / 936 / 1 420 | 6 / 13 / 11 / 18 Kio |

Total : **≈ 1,7 Mio** pour 7 personnages et 9 objets. Les **animations** pèsent environ 60 % de chaque GLB
(toutes les rotations d'os échantillonnées à 30 i/s, cf. limites). Appels de rendu : 2 (héros nu : toon +
contour) à 4 par personnage, +2 par pièce d'équipement.

## Variantes allégées (LOD, preset « bas »)

`viewer/lod.mjs` simplifie chaque primitive avec meshoptimizer (`dequantize` → `weld` → `simplify` à bords
verrouillés, ratio 0,5, erreur 0,4 %) puis recompresse en meshopt. Les pièces rigides gardent leur silhouette ;
couleurs de sommet, `_OUTLINE`, squelette et clips sont conservés. Sortie : `public/models/lod/<nom>.glb` et
`public/models/lod/manifest.json` (**à part** du manifeste principal, que `export_glb.py` réécrit). Sans
argument, il traite les personnages au-dessus du budget de leur catégorie ; `--items` traite les objets ;
`--ratio 0.4 hero` cible un modèle. Le jeu charge ces fichiers quand le preset de qualité est « bas »
(`src/view/models/ModelLibrary.ts`) et retombe sur le GLB complet s'il n'y a pas de variante.

| Entité | Complet → LOD (triangles) |
|---|---|
| héros / consultant | 9 316 → 4 658 / 8 376 → 4 240 |
| borne / drone | 2 536 → 1 326 / 3 012 → 1 588 |
| manager / Auditeur | 7 372 → 4 038 / 8 664 → 4 332 |
| Discosaure / furet / Di Rupo / Lurcke | 14 320 → 7 724 / 9 050 → 4 524 / 14 950 → 7 486 / 13 154 → 6 600 |
| Fluidifieur / PNJ | 6 620 → 4 224 / ≈ 5 900 → ≈ 3 700 |
| casque antibruit / légendaire / gilet porte-outils | 2 220 → 1 346 / 2 352 → 1 426 / 3 140 → 1 928 |

## Limites connues

- **Triangles au-dessus des budgets de la DA** (art_director § 2.10 et § 7) : héros équipé ≈ 12 k (budget
  8 à 10 k), Discosaure 14 k (≈ 8 k), furet 9 k (≈ 4,5 k), Di Rupo 15 k (≈ 9 k). Leviers : décimer les grosses
  sphères (segments), fusionner des pièces sous le même os, LOD simplifié (`gltf-transform simplify`).
- **Animations lourdes** : toutes les pistes de rotation sont gardées pour éviter qu'un os reste figé quand
  on change de clip (`AnimationMixer`). Gain possible : 20 i/s, ou `resample` plus agressif.
- **Morph targets non faits** (expressions de Di Rupo) : sourire, discours et surprise passent par l'os `jaw`
  et les os `brow_*`. Les décalques d'yeux par atlas ne sont pas faits non plus.
- **Contour « dentelé » du furet**, **reflet en bande des cheveux** de Di Rupo, **taches de lumière** de la
  boule à facettes et **traînées d'arme** : effets de shader ou de VFX côté jeu, non inclus dans les GLB
  (le viewer ne fait qu'une version simple du miroir et du verre).
- Les **ressorts** (écharpe, cravate, mèche, queue) sont cuits dans les clips ; une chaîne à ressort à
  l'exécution peut s'y superposer.
- Portés : manager KPI, Auditeur, Fluidifieur, Josiane, Béné, Kevin, Lurcke. Restent à faire : autres PNJ (Marcel,
  Fatou, Yasmina, Rudy…), Agent de sécurité, Coach Agile.
- **Portraits du site** : `viewer/portraits.mjs` (mode `?portrait` : fond transparent, contre-jours) puis
  `viewer/portraits.py` (fond néon, cadrage auto, WebP 960/480) d'après `viewer/specs/portraits.json` →
  `site/public/bestiaire/`.
- Écarts assumés avec le prototype pour le Discosaure : épines turquoise (au lieu de magenta, réservé aux
  télégraphes) et ventre crème (fiche § 7.1).
- La compression utilise `viewer/node_modules` (`npm install` dans `viewer/`), sinon `npx @gltf-transform/cli`,
  sinon le GLB reste brut. Draco et meshopt ne sont pas inclus dans le module `bpy` pip.

---

# (Abandonné) Pipeline 3D → pixel art

> Le rendu en sprites pixel art ci-dessous est **abandonné** au profit de la 3D toon temps réel (section
> précédente). `build.py`, `render.py`, `post.py` et `characters/` restent fonctionnels mais ne sont plus
> maintenus ; les poses de `characters/*.py` restent une source d'inspiration.

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
