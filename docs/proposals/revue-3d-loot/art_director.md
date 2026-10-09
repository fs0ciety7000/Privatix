# Privatix — Nouvelle direction artistique (proposition du Directeur artistique)

> Statut : **proposition**, à valider par le porteur du projet avant toute modification du repo.
> Aucun fichier du dépôt n'a été modifié. Les docs `GDD.md` § 1.2-1.3, `claude.md` § 1 et § 5,
> `PIXEL_ART_GUIDE.md` et `tools/render3d/README.md` devront être réécrits si la direction est retenue.

---

## 0. Diagnostic : pourquoi le rendu actuel ne convainc pas

J'ai regardé `smoke/v/hub.png`, `r1.png`, `b1.png` et la planche `tools/render3d/preview/recap.png`.

| Constat | Cause |
|---|---|
| **Personnages minuscules** : le héros fait environ 28 px de haut sur 360, soit 7,8 % de l'écran. Les PNJ du hub sont des taches de 20 px. | Le cadre 640×360 avec des tuiles de 16 px et des salles de 40×24 tuiles impose ce ratio. Aucun shader ne compense une silhouette de 18×28 px. |
| **Tout est sombre** : les salles de quai sont bleu nuit à 15-30 % de valeur, et les ennemis turquoise sombre s'y fondent. | Les acteurs ont des rampes à 4 ou 5 tons dont 2 tons d'ombre, sous une lumière dynamique faible, avec une vignette. Les acteurs et le décor ont des valeurs trop proches. |
| **Détails illisibles** : le laptop, la cravate, la tablette et les visages se réduisent à 1 ou 2 pixels. | La réduction depuis la 3D garde le volume mais pas l'intention. À 50 px, « méthode Dead Cells » veut dire environ 8 px de tête. |
| **Rendu « prototype »** : beaucoup de grilles, aucune profondeur réelle, des piliers en sprites plats. | Le décor 2D procédural est en tuiles répétées sans vrai volume. Le pixel art sans artiste plafonne vite. |
| **Le loot visible est impossible** | Chaque pièce d'équipement multiplie les feuilles de sprites : variantes × animations × directions × raretés. |

**Conclusion** : il ne suffit pas de régler le pipeline 3D → pixel. Le format 640×360 en pixel art travaille contre nos deux contraintes : pas d'artiste humain, et un équipement visible sur le héros. Il faut changer de format.

---

## 1. Les quatre directions comparées

Notes sur 5 (5 = le meilleur). La colonne « Procédural » mesure la qualité qu'on peut atteindre sans artiste humain.

| | (a) 3D toon / cel-shading + contours | (b) Low-poly flat-shaded, couleurs fortes | (c) 3D « peinte » / textures dessinées | (d) 2D HD rendue depuis la 3D (méthode Hades) |
|---|---|---|---|---|
| Références de style | *Death's Door*, *Tunic*, *Ravenswatch*, *Hi-Fi Rush* (pour le plafond de qualité du cel-shading), *Sable* (lignes) | *Unrailed!* (le rail en low-poly !), *Overland*, *Islanders*, packs Kenney / KayKit | *Torchlight II*, *Darksiders*, *World of Warcraft*, *Kena* | *Hades* (personnages modélisés en 3D puis rendus en sprites 2D encrés), *Diablo II* (sprites pré-rendus), *Bastion* |
| Procédural | **4/5** : le toon pardonne la géométrie simple, et une rampe, un contour et un rim light donnent une finition « voulue » | **5/5** : c'est le style natif de bpy et des packs CC0 | **2/5** : sans pinceau humain on obtient de la boue (bruit et AO cuits). Le filtre Kuwahara « peint » floute la lecture. | **3/5** : on réutilise le pipeline actuel en rendu 4× avec lignes Freestyle, mais l'éclairage en jeu reste du bricolage par normal maps |
| Qualité visuelle atteignable | Bonne à très bonne, avec une identité forte | Correcte mais générique : risque de jeu « fait avec des assets gratuits » | Moyenne : l'écart avec la référence se voit tout de suite | Bonne en image fixe, raide en mouvement (8 directions figées) |
| Coût | Moyen à élevé : changement de moteur (Phaser 4 n'a pas de 3D), environ 2 à 3 semaines-agent pour le moteur et 3 à 4 pour le jalon d'art | **Faible** (moteur), faible (art) | Élevé : textures uniques par objet, rien n'est réutilisable entre les raretés | Moyen pour le moteur (on garde Phaser), **explosif pour le contenu** |
| Risques | Migration du rendu ; budget mobile du post-process et des contours ; « uncanny » des visages procéduraux (évité par le style) | Fadeur, manque de dramaturgie « Hades » ; le style ne protège pas de la banalité | Résultat boueux, textures lourdes sur mobile, mauvaise lecture en combat | Mémoire de textures (sprites de 200 px × 8 directions × 12 anims × N frames), **combinatoire de l'équipement** (paper-doll : chaque slot rendu pour chaque frame), visée à 360° snappée sur 8 directions |
| Lisibilité en combat | **5/5** : le contour isole les acteurs, la rampe contrôle les valeurs et les télégraphes sont des décalques non éclairés | 4/5 : bonne si la palette est tenue, mais pas de contour, donc les acteurs se fondent dans un décor de même style | 2/5 : le détail de texture fait du bruit et concurrence les télégraphes | 4/5 en HD, mais un sprite ne peut pas se tourner vers la visée exacte |
| Tenue sur mobile | 4/5 : ombrage très bon marché ; le contour double les draw calls des acteurs ; un seul passage de post-process | **5/5** | 2/5 : beaucoup de mémoire de textures | 3/5 : atlas énormes, risque de dépassement de mémoire sur iOS Safari |
| Équipement visible | **5/5** : on attache des meshes à des os, et un matériau par rareté | 5/5 | 3/5 : il faut une texture peinte par variante | **1/5** |
| Continuité avec l'existant | Garde la logique pure (`src/systems/`), les poses Python (cuites en actions d'armature), les canons de couleur et le game feel | Idem (a) | Idem (a) | Garde Phaser et `tools/render3d` |

**Élimination** :
- **(c)** est hors de portée sans artiste, et c'est la pire en lisibilité.
- **(d)** s'oppose directement à la demande : l'utilisateur veut « de la 3D » et du loot visible, et (d) est la direction où l'équipement visible coûte le plus cher.
- **(b)** est le plancher de sécurité, mais seule elle donne un jeu générique, sans la dramaturgie demandée (contrastes, encrage, néons).

---

## 2. Recommandation : **(a) 3D toon temps réel, sur une discipline de formes (b)**

### Nom de travail : « **Néon & Ballast** », un cel-shading ferroviaire nocturne

**En une phrase** : des figurines low-poly à grosses têtes et à silhouettes franches, ombrées en 3 tons à décalage de teinte, cernées d'un contour sombre, détourées d'un liseré néon, dans des gares sombres où la lumière forme des flaques. Tout ce qui blesse brille en magenta.

**Pourquoi celle-là** :
1. **Elle répond à la demande** : de la vraie 3D, et des équipements qui se voient sur le héros.
2. **Elle est produisible par du code** : toutes les surfaces sont des aplats de rampes. Une palette en atlas de gradients (la technique de KayKit) remplace les textures peintes. Les formes viennent de bpy (bevel, lathe/screw, skin modifier, arrays) et de packs CC0 recolorés.
3. **Elle sert le pilier n° 2, « Lire, esquiver, punir »** : les contours séparent acteurs et décor ; l'éclairage toon donne un contrôle total sur les valeurs ; les télégraphes sont des décalques au sol non éclairés, au-dessus de tout.
4. **Elle garde l'identité déjà écrite** : orange héros, turquoise ennemis, magenta danger, violet Privatix, cyan des quais, lumière chaude du Centre Opérationnel (OCC), écharpe syndicale rouge. On ne jette ni la palette ni le canon.
5. **Elle tient sur mobile** : ombrage par lookup de rampe, lumière majoritairement cuite, un seul passage de post-process fusionné.

### 2.1 Moteur (à valider avec le lead technique)

- **Three.js** (licence MIT, version 0.186 sur npm au 09/10/2026) avec `WebGLRenderer` en WebGL2. WebGPU viendra plus tard, avec un repli WebGL2 obligatoire pour l'Android milieu de gamme.
- **pmndrs `postprocessing`** (licence Zlib, 6.39) : il fusionne bloom, vignette, LUT et aberration dans **un seul passage plein écran**, ce qui est crucial sur mobile.
- **Phaser 4 n'a pas de rendu 3D.** Le rendu doit donc migrer. On garde tout `src/systems/` (logique pure, déjà isolée par la règle ESLint), `balance.ts`, les tests et la sauvegarde. Le gameplay reste **2D sur le plan XZ** : géométrie d'arcs, cercles de hurtbox et collisions cercle-contre-grille. Il n'y a pas besoin de moteur physique 3D.
- **Conversion d'unités** : **1 tuile du GDD (16 px) = 0,75 m**, soit `PX_TO_M = 0.046875`. Les chiffres de `balance.ts` restent en px et le rendu convertit. Le héros à 150 px/s court à 7 m/s, ce qui est nerveux, comme dans Hades.
- **Interface** : DOM et CSS (ou SVG) superposés au canvas. Le texte est net à toute résolution, les cadres ornés « à la Hades » se font en SVG généré, et le tactile est natif.
- ⚠️ `claude.md` § 8 interdit d'ajouter une dépendance runtime sans demander. **Cette migration est une décision du porteur du projet.**

### 2.2 Caméra

| Paramètre | Valeur | Raison |
|---|---|---|
| Projection | **Perspective à FOV étroit : 30° vertical** | Presque orthographique pour la lecture des distances, avec juste assez de parallaxe pour que les piliers, les caténaires et les trains aient du volume |
| Orientation | **Inclinaison de 52° sous l'horizontale, sans lacet** : on regarde « vers le nord », les voies sont horizontales à l'écran | Les quais et les voies, horizontaux, lisent comme des couloirs ; les commandes haut, bas, gauche et droite collent à l'écran. On ne tourne pas à 45° en isométrique (une erreur classique pour un jeu de rails). |
| Distance (combat par défaut) | **24 m** de la cible (point à 1 m au-dessus des pieds du héros) | Champ visible d'environ 23 × 16 m au sol (≈ 31 × 22 tuiles). Le héros fait environ **100 px de haut en 1080p** (9,5 % de l'écran), contre 84 px aujourd'hui en ×3, et surtout avec des détails 4 fois plus lisibles. |
| Zoom dynamique | Hub : **20 m** (héros ≈ 115 px). Dézoom automatique jusqu'à **29 m** quand une menace est hors champ. Boss : **32 m**. Interpolation sur 0,6 s. | Garder les Bornes et les rames dans le champ. Flèches magenta au bord de l'écran pour toute menace qui reste hors champ. |
| Mobile | Distance **×0,9** par défaut (personnages plus grands sur un petit écran) | Lisibilité à 40 cm de l'œil |
| Suivi | Lerp 0,12, zone morte 1,5 × 1 m, décalage vers la visée de 1,1 m (conversion des valeurs du GDD) | Continuité avec le game feel actuel |
| Secousses | Translation **et** petite rotation en roulis (≤ 0,6°) ; zoom punch de 4 % sur le coup 3 | Le roulis vend l'impact en 3D |

**Conséquences à signaler au game designer** : avec un champ de 31 × 22 tuiles, les salles de 40 × 24 défilent un peu en horizontal. C'est voulu (comme Hades), mais les portées des tireurs (Borne : tickets sur 350 px) doivent être relues en playtest.

### 2.3 Palette et valeurs

**Règle des 3 étages de valeur (luminance)** : c'est la règle qui corrige le défaut principal d'aujourd'hui.

| Étage | Luminance | Qui |
|---|---|---|
| Décor | **10 à 45 %**, saturation modérée | Quais, voies, murs, mobilier. Désaturé hors des flaques de lumière. |
| Acteurs | **45 à 85 %**, saturation forte | Héros, ennemis, PNJ, loot. **Jamais plus sombre que le sol éclairé derrière eux** : le rim light et l'ambiant de la rampe le garantissent. |
| Émissifs | **> 100 % (HDR)**, donc bloom | Télégraphes et attaques ennemies (magenta), écrans, néons, lueur légendaire, VFX du héros |

Test automatique : une capture en niveaux de gris doit montrer chaque acteur détaché du sol. Un script peut le vérifier par contraste local autour des positions des acteurs.

**Couleurs canoniques (conservées)** : héros orange `#FF7A1A`, ennemis turquoise `#19C3B1`, danger magenta `#FF3EA5` (réservé), violet Privatix `#6B3FA0`, liseré cyan des quais `#6FF3FF`, contour `#14101A`, écharpe syndicale `#E0302A`.

**Ombres** : jamais noires. Elles sont décalées vers le violet nuit (`#2A2148`) dans les quais et vers le brun prune (`#3A1E22`) à l'OCC.

| Zone | Ambiance | Lumières |
|---|---|---|
| **Quais, Matin** | Bleu-gris froid, brouillard bas en dégradé de hauteur | Lampes à sodium `#FFB347` en flaques au sol, néons Privatix violets et turquoise, aube cyan au fond |
| **Quais, Après-midi** | Ambre à travers les arcs | Rais de lumière obliques (cônes additifs), poussières dans la lumière |
| **Quais, Nuit** | Bleu profond `#0E1430` | Halo du héros (lampe frontale du casque : une vraie spot light), arcs électriques des caténaires (flashs cyan) |
| **Arène du boss** | Alarme rouge pulsée, écran des départs géant | Écrans magenta, gyrophares |
| **OCC (hub) : Centre Opérationnel** | Salle de supervision tamisée, bleu ardoise. Îlots chauds en tungstène `#FFC27A` sur les pupitres. Cour intérieure en lumière naturelle. | Le **mur synoptique** est la source principale, émissif cyan et vert : voies, cantons, trains en temps réel. Lampes de pupitre, néon blanc froid de la Salle photocopieuse, ciel de la Cour intérieure qui suit le roulement (aube, jour, nuit). Voir § 2.11. |

### 2.4 Shaders

1. **Toon ramp à décalage de teinte** : à partir de `MeshToonMaterial` étendu par `onBeforeCompile` (ou un `ShaderMaterial` maison).
   - `NdotL` est échantillonné dans une rampe 1D de **3 tons** (ombre, médium, lumière) avec des bords nets et un lissage de 1 à 2 px.
   - Le ton d'ombre n'est pas « couleur × 0,5 » : c'est un **mélange vers la couleur d'ombre de la zone**, d'où le décalage de teinte façon Celeste.
   - Les couleurs de base viennent d'un **atlas de palette** de 256 × 256 : chaque matière est une case, et l'UV pointe dans la case. Changer de palette par zone, par rareté ou par roulement revient à changer de case ou de texture, sans aucune texture peinte.
2. **Contour** :
   - **Acteurs et loot** : **coque inversée** (rendu des faces arrière, extrudées le long de normales lissées stockées dans un attribut `outlineNormal` calculé à l'export). L'épaisseur est **constante en pixels écran** : 2 px en 1080p, 1,5 px sur mobile.
     - Couleur `#14101A` pour le héros et les PNJ, **turquoise très sombre `#06302C`** pour les ennemis (le contour dit déjà « ennemi »), **magenta** pendant leurs télégraphes.
   - **Décor** : lignes d'encrage **cuites** à la génération (arêtes vives marquées par des sommets plus sombres, AO cuit dans les couleurs de sommet). En qualité « Haute » sur desktop, on ajoute une détection de contours profondeur + normales en post-process.
3. **Rim light** : fresnel × masque « face au contre-jour ». Couleur par zone : cyan `#6FF3FF` aux quais, ambre à l'OCC, rouge dans l'arène. On le pousse sur les acteurs (×1,0) et presque pas sur le décor (×0,15). C'est l'héritage direct du « liseré coloré » Hades déjà écrit dans le GDD.
4. **Flash d'impact** : uniforme `uHit` (0 à 1) qui pousse la couleur au blanc, l'équivalent de l'actuel `setTint` FILL. **Uniforme `uDissolve`** pour les morts : dissolution par bruit, avec des bords turquoise ou magenta émissifs.
5. **Matériaux de décor triplanaires** : brique, béton, ballast, rouille et carrelage sont des motifs procéduraux dans le shader, en coordonnées monde. On n'a aucun dépliage UV à faire pour le décor généré. Sur mobile, on les cuit en textures de 512 px.
6. **Décalques de télégraphe** : voir § 2.8.

### 2.5 Post-process (un seul passage fusionné)

| Effet | Réglage | Mobile |
|---|---|---|
| Tone mapping | **AgX** (ou ACES) : il garde la saturation des néons | oui |
| Bloom | Seuil HDR > 1,0 (seuls les émissifs brillent), intensité 0,8, mip-blur | À demi-résolution |
| Étalonnage | **LUT 3D par zone et par roulement**, `.cube` générées par un script Python (courbes, split-toning ombres violettes, lumières chaudes) | oui (une texture 3D de 32³) |
| Vignette | 0,25 ; passe au **magenta** quand le héros est touché (existe déjà dans le game feel) | oui |
| Aberration chromatique | Seulement en impulsion sur les gros impacts et au Pétage de plombs | oui |
| Grain, brouillard | Grain léger desktop seulement ; brouillard de hauteur dans le shader des matériaux (pas de passe) | grain : non |
| SSAO | **Non** : AO cuit à la génération | — |

### 2.6 Proportions des personnages

- **Échelle** : héros de **2,0 m casque compris** (« héroïque »), tête et casque = **1/4 de la hauteur** (au lieu de 1/7 au réel). Mains et pieds ×1,3, épaules larges, taille marquée.
- **Visage** : simple. Deux yeux en décalques (petites textures générées par PIL, sourcils inclinables pour l'expression), pas de bouche modélisée (un décalque si besoin). Pas de réalisme, donc pas de « vallée de l'étrange ».
- **Test de silhouette** : chaque archétype doit se reconnaître **en noir plein à 64 px**. Cette planche est générée automatiquement dans Blender (Workbench, aplat noir) et sert de critère d'acceptation.
  - Héros : casque rond et jaune, gilet évasé, **écharpe rouge qui flotte**.
  - Consultant : mince et vertical, laptop rectangulaire.
  - Borne : bloc trapu, écran en façade.
  - Drone : croix et disque.
  - Manager : grand, triangle inversé, tablette levée.
  - Auditeur : masse énorme avec ses bras-barrières.
- **Animation** : poses très marquées (anticipation de 2 frames, contact, follow-through). On garde le principe actuel : **l'animation est mise à l'échelle sur les durées du GDD** (`AnimationMixer.timeScale` par clip). Squash & stretch par mise à l'échelle de l'os racine, et écharpe animée par une chaîne d'os à ressort (spring bones, 5 os, intégration de Verlet en TS pur, testable).

### 2.7 VFX et juice

| Effet | Technique |
|---|---|
| **Smears et traînées d'arme** | Ruban généré en temps réel derrière l'empty `tip` de l'arme (16 derniers échantillons, Catmull-Rom), dégradé blanc vers orange, additif et émissif. Bien plus fluide que les smears dessinés, et c'est gratuit pour chaque arme. |
| **Impact** | Étoile en SDF dans le shader (aucune texture), anneau d'onde, 6 à 12 étincelles en instancing GPU, flash de lumière ponctuelle de 80 ms (un pool de 4 lumières) |
| **Hitstop** | On gèle `mixer.update` et la simulation (même règle qu'aujourd'hui : `GameFeel` donne un delta nul), mais **on continue de faire trembler le mesh touché** de ±3 cm (le tremblement « à la Hades ») |
| **Dash** | Images rémanentes : 3 copies du mesh posé en aplat cyan, qui s'éteignent en 200 ms ; en or sur un dash parfait |
| **Mort ennemie** | Dissolution turquoise plus éclatement de « slides » (petits quads instanciés) |
| **Ambiance** | Poussières dans les cônes de lumière, papier qui vole, gouttes de pluie la Nuit, étincelles des caténaires |
| **Décompte de rame** | Les rails vibrent (décalage de sommets), le feu passe au vert, puis orange, puis rouge, et le phare de la rame éclaire la voie avant l'arrivée |

### 2.8 Lisibilité des télégraphes (pilier n° 2)

- Ce sont des **décalques projetés au sol** (un mesh plan qui épouse le quai, ou un box-projector pour les voies) avec un **shader non éclairé** magenta HDR. Ils sont rendus **après** le décor, testent la profondeur contre le sol seulement et passent au-dessus des acteurs grâce à un ordre de rendu dédié.
- **Grammaire** : à t0 le contour de la zone apparaît en entier (1,5 px écran, pulsé). Pendant le windup, il **se remplit** depuis l'origine vers l'extérieur : radial pour les cercles, balayage pour les arcs, progression pour les lignes. Au remplissage complet, flash blanc, puis coup.
  - Le joueur lit donc le **quand** (le remplissage) en plus du **où**.
- La lumière, le brouillard et la LUT de Nuit ne les assombrissent jamais : ils sont non éclairés et exclus de la LUT. En roulement Nuit, ils restent visibles hors du halo, ce que demande déjà le GDD.
- **Le corps de l'ennemi** passe aussi au magenta : contour magenta et pièce émissive (écran du laptop, fente de la Borne, LED du drone). On lit ainsi qui va frapper.
- **Projectiles** : meshes émissifs magenta avec une traînée courte et un petit point lumineux au sol (sous le projectile) pour lire la hauteur.
- **Hors champ** : chevron magenta au bord de l'écran, dont la taille dépend du temps restant avant l'impact.
- Accessibilité (GDD § 12) : on peut choisir une autre couleur de danger (jaune) et épaissir les contours.

### 2.9 Décors (kit modulaire)

Grille de **0,75 m** (une tuile). Les pièces sont générées par bpy, avec des couleurs de sommet et l'atlas de palette, et **instanciées** (`InstancedMesh`) pour tout ce qui se répète.

- **Quai** : dalles, bordure avec **ligne de sécurité jaune** et bande podotactile, ballast (shader triplanaire et cailloux instanciés en bord de voie), rails et traverses (instanciés, suivent une spline), heurtoir.
- **Caténaires** : poteaux en treillis (bpy, array et bevel) ; les fils sont de **vraies courbes de chaînette** calculées dans le script, avec une lueur cyan qui grésille la Nuit.
- **Mobilier** : abri de quai, banc (le banc de Marcel, avec sa plaque), poubelle de tri à trois bacs, chariot à bagages (objet physique du boss), lampadaires à sodium, piliers, escalier vers le souterrain.
- **Écrans** : écrans des départs et mini-écrans des portes. Leur contenu est un `CanvasTexture` dessiné en temps réel (`IC 0712 → AVANTAGE : JOSIANE — À L'HEURE`), émissif. **C'est le meilleur endroit pour l'humour du jeu**, et c'est 100 % du code.
- **Trains** : une rame de notre invention (livrée « Privatix » violet et turquoise, et une livrée « service public » délavée de notre invention, livrée de l'opérateur réel seulement si les droits annoncés par l'utilisateur sont confirmés par écrit ; sinon une livrée stylisée de notre invention). Base en bpy (caisse extrudée, baies vitrées éclairées de l'intérieur, bogies), ou départ du **Quaternius Modular Train** ou du **Kenney Train Kit** (CC0) recoloré. Le passage d'une rame est un mur mobile avec un phare et un souffle de particules.
- **Fond** : les salles s'ouvrent sur un vide noir-bleu avec les silhouettes lointaines de la gare (cartes de profondeur simples). Pas d'horizon à modéliser.
- **Flaques de lumière** : décalques additifs au sol, cuits, qui ne coûtent pas de lumière dynamique. Au plus **6 lumières ponctuelles dynamiques** par salle sur mobile (lampe du héros, impacts, lanterne de boss) ; le reste est émissif ou cuit.

### 2.10 Budgets techniques

| Poste | Desktop | Mobile milieu de gamme |
|---|---|---|
| Draw calls | ≤ 250 | ≤ 120 (instancing, matériaux partagés via l'atlas) |
| Triangles visibles | ≤ 600 k | ≤ 250 k |
| Héros équipé | 8 à 10 k tris, 1 atlas de palette + 1 masque | idem (LOD inutile à cette distance) |
| Ennemi de base | 2 à 4 k tris | idem |
| Ombre | Carte de 2048, **acteurs uniquement** (décor : AO et ombres cuits) | 1024, ou disque d'ombre au sol en qualité « Basse » |
| Résolution | DPR natif | DPR plafonné à 1,5, résolution dynamique (90 à 70 %) si < 55 fps |
| Assets | glTF `.glb` + **meshopt** (gltfpack, MIT) ; textures **KTX2/Basis** | idem |

### 2.11 Le hub en 3D : l'OCC, Centre Opérationnel

L'OCC est le **Centre Opérationnel** de la gare. On y suit la circulation **en temps réel**. Ce n'est ni un atelier ni une lampisterie : le hub doit se lire comme une salle de supervision vivante, l'endroit où « ceux qui savent » tiennent le réseau. Il est explorable à pied, à 20 m de caméra (héros ≈ 115 px).

| Lieu | Lecture visuelle | Production |
|---|---|---|
| **Salle de supervision** (cœur du hub) | Pénombre bleu ardoise. **Mur synoptique** géant au nord : les voies en traits cyan, les cantons occupés en vert, les trains comme points mobiles, les retards clignotant en ambre. Deux rangées de pupitres à 3 écrans, lampes de pupitre chaudes, fauteuils, casques-micros. C'est la **source de lumière principale** de la scène. | Mur : `CanvasTexture` redessinée à 10 Hz depuis l'état du jeu (Shift en cours, dernier train « supprimé » = cause de la mort, historique des Shifts). Pupitres : B, kit de 4 pièces. Écrans : S émissifs. |
| **BAG** (bureaux attenants) | Cloisons vitrées, stores, classeurs, tableau des roulements. Plus clair et plus « administratif ». | B (cloisons extrudées, vitrage en fresnel) + C0 (mobilier de bureau recoloré) |
| **Salle photocopieuse** | Néon blanc froid qui grésille, photocopieuse imposante (un clin d'œil au boss final), ramettes en piles, affiches punaisées | B (photocopieuse en boîtes biseautées, piles de papier instanciées), affiches générées en P |
| **Cour intérieure du BAG** | Le seul extérieur du hub : une cour en U de briques jaunes années 1950, sous un **ciel qui suit le roulement**. C'est la respiration visuelle entre deux Shifts, et la **zone d'entraînement**. | Voir § 2.12, établi d'après la photo de référence |
| *Autres lieux* | À compléter par le lore (le coin café peut survivre comme un **îlot** dans la salle de supervision) | — |

- **Interactions** : chaque PNJ a son poste (pupitre, bureau du BAG, photocopieuse, banc de la cour) éclairé par une flaque de lumière chaude qui le signale. L'icône d'interaction est un décalque au sol qui se remplit, comme les télégraphes mais en **blanc et or**, jamais en magenta.
- **Palette** : bleu ardoise `#1E2A3C` (ombres), cyan et vert du synoptique, tungstène `#FFC27A` (pupitres), blanc froid `#DDE8F0` (photocopieuse), lumière naturelle de la cour suivant la LUT du roulement.

### 2.12 Cour intérieure du BAG (référence photo)

La photo de l'utilisateur sert de **référence d'architecture et d'ambiance**. Elle ne sert jamais de texture : tout est reconstruit en modules procéduraux dans le style toon.

**Relevé**
- **Volume** : cour en **U**. Trois ailes de **5 niveaux** (un soubassement et 4 étages), environ 17 m de haut. Le fond (nord) porte une **cage d'escalier vitrée** verticale, décentrée à gauche. L'aile droite est plus avancée et porte une **grosse gaine de ventilation en tôle** et un caisson.
- **Façades** : brique **jaune-beige** posée en panneresse, avec un léger changement de teinte tous les 8 à 10 rangs. **Fenêtres à petits carreaux** en grille régulière (2 ou 3 colonnes × 3 rangs de carreaux, châssis gris foncé), appuis de pierre, descentes d'eau verticales, corniche fine. Unités de climatisation accrochées çà et là.
- **Soubassement** : béton ou pierre gris clair, **strié de coulures** sombres et blanchâtres sous les grilles d'aération, soupiraux vitrés, une porte vitrée au pied de la cage d'escalier.
- **Sol** : **pavé autobloquant** gris (motif ondulé emboîté), **mousse verte dans les joints**, plaque d'égout, **traces de peinture rouge et bleue**, herbes folles le long des murs.
- **Objets** : palettes en bois, **petits panneaux bleus sur piquets**, quelques voitures garées.
- **Ciel** : **gris couvert**. Le vitrage de la cage d'escalier le reflète.

**Échelle de jeu**
- Environ **30 × 21 m**, soit **40 × 28 tuiles** de 0,75 m. C'est exactement la taille du hub dans le GDD § 11.
- La caméra (vue vers le nord, inclinaison de 52°) regarde **dans le U** : le côté ouvert est côté caméra, le fond et la cage vitrée en face, les ailes sur les bords. Seuls le soubassement et 1 à 2 étages sont dans le champ.
- Les étages supérieurs sont tout de même modélisés, pour la parallaxe verticale et le cadrage du zoom d'intro. Les ailes latérales passent en **fondu de proximité** (dithering) quand le héros longe leur pied.

**Production procédurale (bpy → GLB, plus shaders)**

| Élément | Méthode |
|---|---|
| **Modules de façade** | Grille de 3,6 m (travée) × 3,4 m (niveau). Kit de 6 modules : `bay_window`, `bay_blind` (aveugle, descente d'eau), `corner`, `plinth` (soubassement + soupirail), `cornice`, `stair_curtain` (cage vitrée). Un script assemble les 3 ailes depuis une description (nombre de travées par aile, aile droite avancée). |
| **Fenêtres** | **`InstancedMesh`** : châssis, croisillons et verre sont 3 instances partagées. Il y a environ 150 fenêtres, soit **3 draw calls**. Attributs par instance : état du store (0 à 1), teinte du reflet, **allumée ou éteinte la nuit**, graine de scintillement. |
| **Brique** | **Shader triplanaire** en coordonnées monde : appareil en panneresse généré (rangs de 6,5 cm, joints clairs), variation de valeur ±5 % par brique par hash, bandes de teinte tous les 9 rangs. **Contraste volontairement faible**, pour ne pas faire de bruit derrière le combat. Couleurs : brique `#D8C48F`, ombre décalée vers l'ocre-gris `#8C7A5A`, joints `#E8DDC0`. |
| **Coulures** | **Décalques projetés** sous chaque soupirail, appui et unité de climatisation. Textures de coulures **générées en P** (gradients verticaux, bruit allongé, 8 variantes dans un atlas), sombres sur le béton, blanchâtres d'efflorescence sur le soubassement. Placement par script sous chaque ouverture. |
| **Cage d'escalier vitrée** | Mur-rideau : meneaux instanciés. Verre fresnel qui reflète la **cubemap du ciel du roulement**, avec, derrière, la **silhouette en zigzag des volées d'escalier** (géométrie simple, teinte sombre). La nuit, elle s'allume et devient une **lanterne verticale**. |
| **Pavé autobloquant** | Shader de sol : motif emboîté ondulé en **SDF répétée**. Masque de joints → **mousse verte** modulée par un bruit (plus dense près des murs et dans les coins). Plaque d'égout en décalque. |
| **Peinture au sol** | Décalques rouges et bleus (taches et marquages générés en P). **Réutilisés comme marquage de la zone d'entraînement** (voir plus bas). |
| **Herbes folles** | Touffes toon en quads croisés instanciées, placées par script le long du pied des murs et dans les fissures. Balancement par shader. |
| **Climatiseurs, gaine** | Climatiseurs : boîtes biseautées et grille circulaire avec **ventilateur qui tourne**. Gaine : courbe bpy biseautée à section carrée, avec anneaux de jonction en array et coudes, en tôle toon à spéculaire en bande. |
| **Palettes, panneaux bleus** | Palettes en array de planches (B). Panneaux : plaque bleue sur piquet, texte générique en `CanvasTexture`. |
| **Voitures** | **Silhouettes génériques uniquement** : carrosserie biseautée en B, vitres sombres, teintes neutres (gris, noir, blanc cassé). **Jamais de plaque, de calandre identifiable, de logo ni de forme d'un modèle réel.** |

**Ambiance selon le roulement** (le même décor, change une LUT, un ciel et un état de fenêtres)
- **Matin, gris couvert** : lumière diffuse et plate, comme sur la photo. Le risque en toon est de perdre le volume. Parade : une lumière clé douce haut-gauche à faible contraste, un **rim light fort venu du ciel** sur les acteurs, un **pavé mouillé** (flaques en décalques spéculaires qui reflètent le ciel) et une légère brume au pied des murs. LUT froide et désaturée ; les acteurs restent les seules taches saturées.
- **Après-midi** : trouée dans les nuages. **Soleil rasant de l'ouest** qui entre dans le U : l'aile gauche projette une **grande ombre portée** sur le pavé (cuite en variante), la brique vire au **doré-orangé**, poussières dans la lumière, vitres de l'aile est en reflets chauds.
- **Nuit** : ciel bleu marine. **Fenêtres allumées au hasard** (environ 30 %, tungstène chaud ou néon froid, parfois une qui s'éteint), cage d'escalier en lanterne, appliques au sodium au-dessus des portes, flaques qui reflètent les fenêtres, voitures en silhouettes avec un reflet de toit.

**Rôle de jeu (d'après le canon du hub, GDD § 11 et LORE § 3.2)**
- **Zone d'entraînement** (station « mannequin de formation » de Josiane) :
  - les traces de peinture rouge et bleue deviennent un **anneau d'exercice peint au sol** ;
  - le mannequin en gilet orange est posé sur une palette ;
  - les dégâts et le DPS s'affichent au-dessus ;
  - on y essaie les Montages **et l'équipement fraîchement équipé** (on voit le loot sur le héros, en mouvement, avant le Shift).
- **Casiers** (casier des Souvenirs, casiers des membres avec leurs objets de lore) : une rangée de casiers métalliques contre le soubassement, sous l'abri de la cage d'escalier. On les ouvre ; un casier = un objet.
- **Obstacles d'essai** : voitures, palettes et climatiseurs servent de couvert pour tester le dash et le knockback (sans dégâts).
- **Transitions** : la porte vitrée au pied de la cage d'escalier ramène vers la salle de supervision (§ 2.11). Le portail du côté ouvert (côté caméra) peut servir de **départ du Shift** ; c'est au game designer de trancher.
- **Petits détails** : les panneaux bleus portent les consignes de la zone (texte de notre invention), et un pigeon s'envole quand on dashe près de lui.

### 2.13 Antre du Furet putride : coin poubelles du BAG (2e référence photo)

Cette photo est, elle aussi, une **référence d'ambiance et de composition**, jamais une texture. **Aucune marque ni aucun logo réel** : les étiquettes de tri et les inscriptions du gestionnaire de déchets visibles sur la photo sont remplacées par des pictogrammes génériques.

**Relevé**
- **Fond** : un **pignon en vieille brique sombre** (brun-gris, joints creusés) avec une **fenêtre murée** (briques plus claires et linteau de pierre). La **toiture est abîmée** : bâche grise déchirée qui pend, **chevrons qui dépassent** en silhouette sur le ciel, panneaux **OSB** rapiécés.
- **Muret** en **brique jaune clair** (la même que la cour, § 2.12), couronné d'une bande de pierre bleue sombre.
- À droite, l'angle d'une aile en brique jaune avec une porte de garage grise et un arbuste.
- **6 conteneurs verts à couvercle jaune** : 4 grands de 1 100 L sur roues et 2 petits de 240 L. Étiquettes de tri colorées (vert, bleu, brun, orange). Des **couvercles qui débordent**, entrouverts sur des sacs.
- **Gros tas de sacs poubelle bleus** devant, en éboulis.
- Sol : le **pavé autobloquant** de la cour, très lisible ici (motif ondulé emboîté), **mousse verte** dans tous les joints, herbes folles, un **détritus orange**.

**Reproduction en 3D toon procédurale**

| Élément | Méthode |
|---|---|
| **Conteneurs** | 2 modèles B (grand 1 100 L et petit 240 L) : cuve à dépouille biseautée, nervures, poignées, roues. **Couvercle séparé sur un os-charnière**. **`InstancedMesh`** (cuve, couvercle et roues en 3 instances partagées), avec par instance l'angle du couvercle, l'usure et l'**étiquette**. Vert `#3E6B3A` (ombre `#1F3A2A`), couvercle jaune `#F2C230`. |
| **Étiquettes de tri** | Atlas **généré en P** : arche ou rectangle coloré avec un **pictogramme générique** dessiné par code (bouteille, papier, sac, pomme). Aucun texte d'entreprise ni logo. |
| **Sacs bleus** | **Blobs déformés** : icosphère subdivisée et déformée par bruit (aplatie à la base, pincée et nouée au sommet). **6 variantes** générées, instanciées avec rotation et échelle aléatoires. Bleu `#2F7FD8`, ombre `#1A3E7A`, **reflet spéculaire en bande** (plastique brillant), plis en décalque. Le tas d'environ 40 sacs est empilé par un script de gravité simple dans bpy (on lâche les sacs, on fige). |
| **Physique légère des sacs** | Pas de moteur physique. Chaque sac de gameplay est un **cercle 2D** (logique pure dans `src/systems`, testable) avec impulsion, frottement et petit rebond quand on le frappe. Le visuel ajoute un **ballottement** par ressort sur l'échelle (squash & stretch) et une **ondulation de sommets** dans le shader. Au 2e coup, le sac **éclate** : bouffée de nuage vert inoffensif, confettis de détritus instanciés, le mesh se dégonfle. |
| **Pignon et toiture** | Module de mur B. Brique sombre en shader triplanaire (même shader que la cour, palette `#4A3E38` / `#2A2226`), patch de fenêtre murée en décalque de teinte. Chevrons en array de poutres débordantes, bâche en plan subdivisé déchiré (découpes par bruit) qui **flotte** par shader de vent. OSB : texture de copeaux générée en P. |
| **Sol** | Même shader de pavé que la cour, avec un **masque de mousse plus dense** et des **flaques de jus** sombres en décalques (spéculaire toon). Herbes folles instanciées. Détritus orange et canettes génériques en petits props B. |

**L'arène du Furet**
- **Taille** : environ 24 × 16 m, un cul-de-sac dans l'angle nord-ouest de la cour. Les conteneurs sont alignés contre le muret, le tas de sacs au centre-gauche.
- **Réseau des conteneurs** : le Furet **circule sous et à travers les conteneurs** (sa « plongée » du § 7.2 se fait ici dans les bacs au lieu des égouts).
  - Quand il passe sous un conteneur, le **couvercle se soulève et retombe** (os-charnière piloté par la logique), et un petit nuage vert s'échappe. C'est un **indice de position** lisible, pas un dégât.
  - Le couvercle du bac de sortie **claque** et un **cercle magenta** se remplit au sol devant, 400 ms avant la sortie.
- **Sacs-cachettes** : il peut **s'enfouir dans le tas** ; le tas **gonfle et respire**, des mouches tournent au-dessus, ses yeux jaune-vert luisent entre deux sacs.
  - Frapper les sacs le **débusque** (stagger court) et les **disperse** : le tas se réduit au fil du combat, ce qui change l'arène.
- **Obstacles destructibles** : les sacs isolés bloquent le dash et les projectiles et cassent en 2 coups. Les conteneurs sont **indestructibles** mais **poussables** : un coup 3 les fait rouler sur leurs roues, et un conteneur projeté sur le Furet l'étourdit (écho des chariots à bagages du boss 1).
- **Nuages et mouches** : nuages verdâtres en sillage et au-dessus des bacs (décoratifs). Les zones de dégâts sont bordées de **magenta**, selon la règle du § 7.2. Essaims de mouches instanciés sur le tas et autour du Furet, plus denses quand il est caché : un autre indice.
- **Couverture** : derrière le tas, le contour du héros reste visible (silhouette de *x-ray* en cyan) pour ne jamais perdre le joueur.

**Ambiance**
- **Matin gris** (comme la photo) : lumière plate. La LUT de la zone tire vers le **vert-jaune malade** dans un volume local autour des bacs (brume verte basse), tandis que le reste de la cour reste neutre. Le pignon sombre écrase la scène, et les chevrons et la bâche font une silhouette « décharge » sur le ciel blanc.
- **Après-midi** : soleil rasant qui accroche le jaune des couvercles et le plastique bleu des sacs (spéculaires), moucherons dorés dans la lumière, odeur rendue par des lignes ondulées de BD.
- **Nuit** : une seule applique au-dessus du muret, qui grésille. Les **yeux du Furet** luisent dans le tas, avec des reflets bleus sur les sacs mouillés. La bâche claque dans le noir.
- **Palette dominante** : vert bac, jaune couvercle, bleu sac, brique sombre. Le turquoise du harnais et le magenta des dangers restent les **seules couleurs saturées au premier plan**. Si le bleu des sacs concurrence le turquoise de l'ennemi en playtest, on le désature de 20 %.

---

## 3. Équipement visible sur le héros

### 3.1 Slots (proposition à faire valider par le game designer, car le GDD n'a pas encore de loot d'équipement)

| Slot | Os d'attache (socket) | Méthode d'attache | Exemples (canon ferroviaire) |
|---|---|---|---|
| **Casque** | `head` → empty `socket_head` | Rigide (100 % sur l'os de la tête) | Casque de chantier, casque à lampe frontale, casque antibruit, casquette de conducteur (legs de Marcel) |
| **Gilet** | Torse | **Skinné** sur le même squelette (voir § 3.2) | Gilet haute visibilité, gilet porte-outils, gilet pare-coups (Josiane), parka de nuit |
| **Gants / brassards** | `forearm_L/R` | Rigide | Gants isolants, manchettes de soudeur, brassard syndical |
| **Chaussures** | `foot_L/R` | Rigide (deux demi-meshes) | Chaussures de sécurité, bottes de ballast, bottes isolantes |
| **Dos / ceinture** | `spine_upper` → `socket_back`, `hips` → `socket_belt` | Rigide | Radio de service, thermos, lanterne de signalisation, sifflet |
| **Arme** | `hand_R` → `socket_grip` (main gauche par IK si arme à deux mains) | Rigide, avec un empty `tip` pour les traînées et la hitbox visuelle | Clé à tire-fond, masse de voie, pince à caténaire |
| *(cosmétique)* Écharpe syndicale | `neck` | Chaîne à ressort | Toujours présente : c'est la signature du héros |

**Conventions d'export** : chaque objet d'équipement est un `.glb` avec un empty `attach` à son origine. Le jeu fait `socket.add(itemScene)` et la pièce suit l'os. Les noms d'os sont figés dans un **contrat de squelette** (`skeleton_v1.json`), comme aujourd'hui pour les clés d'animation.

### 3.2 Modélisation procédurale (bpy)

- **Corps du héros** : **Skin modifier** de Blender sur un squelette de sommets avec rayons (torse, membres), puis Subdivision niveau 1, Decimate et **poids automatiques** sur l'armature. On obtient un corps organique, entièrement à partir du code.
  - Variante sûre : pièces rigides comme aujourd'hui (chaque pièce pondérée à 100 % sur son os), avec des sphères aux articulations pour cacher les coutures. Ça donne un style « figurine » qui tient très bien à cette distance.
- **Pièces rigides** (casque, gants, chaussures, arme, dos) : primitives et modificateurs (bevel, solidify, mirror, **screw/lathe** pour le casque et le thermos, boolean simple), paramétrés par un dictionnaire. On décrit **3 à 4 variantes de forme par slot** (ex. casque : `brim`, `lamp`, `ear_muffs`, `visor`), chacune de 300 à 1 500 tris.
- **Gilet (pièce skinnée)** : on duplique la région du torse du corps (groupe de sommets), on applique **Solidify et Displace** (+2 cm), puis on recopie les poids du corps avec un **Data Transfer modifier**. Les bandes réfléchissantes sont des cases de l'atlas (1, 2 ou 3 bandes selon la rareté). Le gilet suit donc l'animation sans retouche.
- **Masquage** : quand un gilet ou un casque est équipé, des groupes de faces du corps sont masqués (pas de traversée de géométrie).

### 3.3 Raretés : variantes de matériaux (même mesh)

Thème : les **feux de lanterne de signalisation**, un canon déjà présent à l'OCC.

| Rareté | Nom en jeu | Couleur de liseré et faisceau de loot | Traitement du matériau |
|---|---|---|---|
| 1 | **Standard** | Blanc `#E8E6E1` | Couleurs de base, usure forte (case « usée » de l'atlas), aucun émissif |
| 2 | **Réglementaire** | Vert signal `#3FD46B` | Usure moyenne, 1 bande ou filet de couleur |
| 3 | **Renforcé** | Bleu `#4A8CFF` | Propre, 2 bandes, reflet spéculaire toon plus net |
| 4 | **Syndical** | Rouge `#E0302A` | 3 bandes, rim light ×1,3, petit écusson (décalque) |
| 5 | **Acquis historique** (légendaire) | Or `#FFC94A` | **Liseré émissif HDR** (bloom), fresnel doré pulsé, particules (vapeur, étincelles ou feuilles d'or selon l'objet), **un ajout de forme unique** (ex. lanterne ancienne sur le casque) |

- On n'utilise **jamais** le magenta (danger), le turquoise (ennemis) ou le violet (Privatix) pour une rareté.
- **Implémentation** : un seul `ShaderMaterial` d'équipement avec les uniformes `uRarity` (décalage de case dans l'atlas), `uWear`, `uTrimEmissive` et `uGlow`. Toutes les variantes partagent shader et texture, ce qui permet de grouper les draw calls.
- **Au sol** : l'objet lâché tourne sur lui-même à 0,4 m du sol, avec un **faisceau vertical** de la couleur de rareté (cylindre additif, visible à travers le décor) et un « ding » dont la hauteur dépend de la rareté.
- **Affixes visibles** : un affixe élémentaire (électrique, café brûlant) ajoute un émissif ou des particules sur l'objet, et une teinte au ruban de traînée de l'arme.

---

## 4. Assets du premier jalon jouable

Légende des méthodes :
- **B** = bpy procédural (nouveau dossier proposé : `tools/model3d/`, export `.glb`) ;
- **C0** = asset CC0 recoloré ou adapté ;
- **S** = shader ou code runtime ;
- **P** = image générée par Python/PIL/numpy.

| # | Asset | Méthode | Détail | Effort |
|---|---|---|---|---|
| 1 | **Squelette contrat v1** (20 os et sockets) | B | Armature générée, noms figés, `skeleton_v1.json` | S |
| 2 | **Héros (Léon)** : corps, tête, écharpe | B + S | Skin modifier ; tête et yeux en décalques P ; écharpe en spring bones (S) | M |
| 3 | **Animations du héros** : idle, run, dash, attack1-3, hurt, death, spawn, special | B (+ C0 en référence) | Les fonctions de pose de `characters/hero.py` sont **cuites en actions d'armature** (on garde les poses clés existantes). Locomotion et mort recalées sur la **Universal Animation Library de Quaternius (CC0)**, retargetée par mapping des noms d'os. | L |
| 4 | **Consultant Junior** : corps, costume, laptop à écran émissif | B | Même générateur humanoïde, paramètres plus minces ; anims idle, run, attack (télégraphe), rush, hurt, death | M |
| 5 | **Borne Automatique** | B | Surfaces dures (bevel boxes), trappe, écran `CanvasTexture`, épave ; anims par os (déploiement, visée, tir) | S-M |
| 6 | **Salle de quai** (kit d'environ 15 pièces et 1 gabarit) | B + C0 + S | Dalles, bordure, rails et traverses instanciés (B, ou rails du **Kenney Train Kit**, CC0), ballast (S triplanaire), caténaires (B), abri, banc, lampadaire, poubelle, chariot, portique de porte, écran des départs (S), **rame** (B, ou **Quaternius Modular Train**, CC0, recolorée) | L |
| 7 | **Hub OCC : Centre Opérationnel** (§ 2.11) | B + C0 + S | Salle de supervision : **mur synoptique** (S, `CanvasTexture` animée en temps réel par l'état du jeu), pupitres de régulation à 3 écrans (B), fauteuils, armoires techniques. **BAG** (bureaux, B). **Salle photocopieuse** (photocopieuse B, piles de papier instanciées). **Cour intérieure** (pavés en S triplanaire, banc, ciel par roulement). Mobilier tiré de **Kenney Furniture Kit** ou **Quaternius Ultimate Furniture** (CC0) et recoloré. 3 PNJ (générateur humanoïde). | L |
| 8 | **Arme 1 : clé à tire-fond** (d'origine) | B | Surfaces dures, empties `grip` et `tip` | S |
| 9 | **Arme 2 : masse de voie** (lente, lourde) | B | Cylindre et tête biseautée | S |
| 10 | **Arme 3 : pince à caténaire** (rapide, électrique) | B | Mirror et bevel, émissif cyan sur les mâchoires | S |
| 11 | **Équipement 1 : casque** (3 formes) | B | Lathe, bord, lampe frontale (+ vraie spot light la Nuit) | S |
| 12 | **Équipement 2 : gilet** (2 formes) | B | Torse extrait, Solidify, Data Transfer des poids, bandes en atlas | M |
| 13 | **Équipement 3 : gants** | B | Rigides, avant-bras | S |
| 14 | **Équipement 4 : chaussures de sécurité** | B | Rigides, pieds | S |
| 15 | **Équipement 5 : radio de service** (dos) | B | Boîte biseautée, antenne, LED émissive | S |
| 16 | **Raretés** (5 niveaux) | S + P | Shader d'équipement unique ; atlas de palette généré en P (cases par matière × usure × rareté) | S |
| 17 | **Shaders cœur** : toon ramp, contour en coque inversée, rim light, flash, dissolution, triplanaire | S | Bibliothèque `src/render/materials/` | M |
| 18 | **Post-process et LUT** | S + P | Pile pmndrs ; LUT `.cube` générées par script (Quais Matin, Nuit, Boss, OCC) | S |
| 19 | **Kit VFX** : ruban de traînée, impact SDF, étincelles, poussières, images rémanentes, faisceau de loot | S | Instancing GPU, aucune texture peinte (bruit généré en P si besoin) | M |
| 20 | **Télégraphes** (cercle, arc, ligne, anneau) | S | Décalques non éclairés avec remplissage temporel | S |
| 21 | **UI** : HUD, fiches d'objet comparées, cadres ornés | S (DOM/CSS/SVG) | Cadres SVG générés, icônes d'objet = **rendus 3D runtime** des meshes (une caméra hors écran, un portrait par objet) | M |
| 22 | **Planches de contrôle automatiques** | B + S | Silhouettes noires à 64 px, turntable de chaque objet × 5 raretés, capture en niveaux de gris du jeu (test des valeurs) | S |

Effort : S = moins de 2 jours-agent, M = 2 à 5 jours, L = 1 à 2 semaines. **Total du jalon, environ 6 à 8 semaines-agent**, dont environ 2 à 3 pour la migration du rendu.

### Sources CC0 vérifiées (le 09/10/2026, sur les pages officielles)

| Source | Licence constatée | Utilisation prévue |
|---|---|---|
| **Kenney** : Train Kit (45 modèles, rails pour splines), Furniture Kit | **CC0** (« Creative Commons CC0 » sur kenney.nl/assets/train-kit ; page support : domaine public, attribution facultative, **ne pas utiliser le logo Kenney**) | Rails, wagons de base, mobilier |
| **Quaternius** : Modular Train, Public Transport, Ultimate Modular Characters, Universal Animation Library, Cyberpunk Game Kit, Modular Streets | **CC0**, constaté sur chaque page `quaternius.com/packs/*.html`. Attention : tous les packs ne sont pas forcément CC0, donc on vérifie **pack par pack**. | Rame de base, animations de référence pour le retargeting, accessoires |
| **KayKit** (Kay Lousberg) : Adventurers, Character Animations | **CC0** (« no attribution required (CC0 Licensed) » sur itch.io ; demande de courtoisie : ne pas revendre tel quel) | **Référence de technique** (atlas de gradients, proportions), éventuellement des animations |
| **Poly Haven** | **CC0** (FAQ officielle) | HDRI d'éclairage de référence pour les planches, pas en jeu |
| **ambientCG** | CC0 selon des sources tierces : **à revérifier** sur le site avant usage | Éventuels motifs à cuire (béton, ballast) |
| **Poly Pizza** | **Licence par modèle** : un mélange de CC0 et de CC-BY (héritage de Google Poly) | Seulement les modèles **CC0** ; tout CC-BY va dans `CREDITS.md` avec auteur, licence et lien |
| Three.js / pmndrs `postprocessing` / gltfpack | MIT / Zlib / MIT | Moteur et outils |

Règle : chaque asset tiers est inscrit dans `CREDITS.md`, avec le fichier `License.txt` de l'archive conservé dans `tools/model3d/third_party/<pack>/`. Aucun logo ni livrée réelle.

---

## 5. Risques et parades

| Risque | Parade |
|---|---|
| Migration du moteur : gros chantier, risque de casser le game feel | La logique `src/systems/` est déjà pure et testée. On commence par un **spike de 3 jours** : salle de quai, héros en capsule, toon, contour et télégraphe, mesuré sur un Android milieu de gamme. **Point d'arrêt** si < 50 fps. |
| Personnages procéduraux « génériques » | Proportions exagérées, accessoires surdimensionnés (laptop, tablette, chronomètre géant), écharpe animée et planche de silhouettes comme critère d'acceptation |
| Fill-rate mobile (post-process et transparences) | Un seul passage fusionné, bloom à demi-résolution, peu de particules transparentes (additives et triées), résolution dynamique |
| Incohérence entre assets CC0 et procéduraux | Tout passe par **le même shader toon et le même atlas de palette** : les assets CC0 sont **re-matérialisés** à l'import (script bpy qui remappe les UV vers nos cases) |
| Lisibilité en foule (24 ennemis) | Contour d'ennemi teinté, hauteur et taille par archétype, télégraphes au-dessus de tout, jetons d'attaque (déjà dans le GDD) |
| Le canon écrit dit « pixel art » et « pas la 3D isométrique » (GDD § 1.2) | Mise à jour des docs dans le même lot que la décision |

**Canon (correction de l'utilisateur)** : « SNCB » et « Calatrava » restent : l'utilisateur déclare en avoir les droits. L'**OCC est le Centre Opérationnel** (fonctions temps réel), pas un atelier ni une lampisterie. La description du hub en 3D est au § 2.11. **Docs à aligner** :
- LORE § 3 (Operation Coffee Center, lampisterie, voûte de brique) ;
- GDD § 11 (établi) ;
- le BAG, aujourd'hui nommé comme biome 3 « Hall & BAG ».

Il faut aussi lever la règle « aucune personne réelle » de `claude.md` § 8 et du GDD § 1, à cause du boss du § 7.3, et archiver hors du dépôt public la preuve écrite des droits.

---

## 6. Prochaines étapes proposées

1. **Décision** du porteur du projet : direction (a), migration vers Three.js, ajout de dépendances, slots d'équipement.
2. **Spike technique (3 jours)** : quai, héros en capsule, toon, contour, télégraphe, bloom, et mesure des fps sur mobile.
3. **Vertical slice d'art** : le héros équipé (5 slots × 5 raretés) sur un turntable, puis dans une salle de quai. Validation sur captures : silhouettes, valeurs, lisibilité à 1080p et sur téléphone.
4. Jalon complet selon le tableau du § 4.

---

## 7. Fiches visuelles des nouveaux ennemis

Règles communes, héritées du § 2 :
- corps à dominante **turquoise** ou accents turquoise (ennemi) et contour turquoise sombre `#06302C` ;
- tout ce qui blesse est **magenta `#FF3EA5`** non éclairé, avec un télégraphe qui se remplit ;
- export bpy → `.glb` (meshopt), animations en actions d'armature, conformes au contrat de squelette ;
- test de silhouette en noir plein à 64 px (pour les boss, à 96 px).

Les rôles (ennemi, élite, boss) et les chiffres sont des **propositions au game designer**.

### 7.1 Le Discosaure (élite ou mini-boss proposé)

**Silhouette et proportions**
- Théropode bipède **trapu** d'environ 3,6 m de haut et 5,5 m de long (environ 1,8 fois le héros).
- Le **tronc entier est une boule à facettes** de 2,4 m de diamètre, portée entre deux grosses pattes.
- Petite tête à grande mâchoire au bout d'un cou court, **bras minuscules** (gag), queue épaisse et horizontale en contrepoids.
- **Critère en ombre noire** : un **disque parfait** entre deux pattes, avec un « bec » de mâchoire devant et une queue en pointe derrière. Il doit se distinguer en un coup d'œil d'un rocher ou d'une Borne. Si la boule ne se lit pas comme un cercle à 64 px, on grossit la boule, pas le dinosaure.

**Palette et matériaux toon**

| Matière | Rendu |
|---|---|
| Peau | Turquoise `#19C3B1` (ennemi), ombre violette `#2A2148`, rayures et écailles du dos violet Privatix `#6B3FA0` en cases de l'atlas, ventre crème |
| **Boule à facettes** | Facettes **miroir** : chaque quad reçoit un identifiant aléatoire en couleur de sommet. Dans le shader, la normale de la facette est **légèrement perturbée** par ce hash, puis elle réfléchit une **petite cubemap procédurale** (fond sombre semé de points de lumière ; on ne capture pas la scène, c'est trop cher). Résultat en 3 tons : gris acier, argent, blanc. Une facette dont le reflet pointe vers la caméra **scintille** : étoile SDF additive de 120 ms. Joints sombres entre les facettes, obtenus par *inset* des faces. |
| Yeux | Petits, jaunes, émissifs doux (on lit le regard de loin) |

**Taches de lumière projetées**
- Calculées **dans le shader du sol et des murs**, pas avec de vraies lumières :
  - chaque fragment prend sa direction depuis le centre de la boule (uniforme `uDiscoPos`) ;
  - cette direction tourne avec la boule (`uDiscoRot`) et est découpée en cellules ;
  - un hash par cellule allume une **tache ronde** additive.
- Coût fixe, quel que soit le nombre de taches. Ça marche sur mobile.
- **Couleurs au repos** : blanc chaud, or, bleu ciel, vert menthe. **Jamais de magenta au repos**, qui reste réservé aux télégraphes.

**Production procédurale (bpy → GLB)**
- **Boule** : UV sphere de 28 × 14, faces insérées individuellement (*inset* de 1,5 cm, profondeur −1 cm) et attribut `facetId`. Environ 1,6 k quads, soit environ 3,5 k tris.
- **Corps** : skin modifier sur un squelette de sommets (cou, pattes, queue) + Subdivision 1 + Decimate.
- **Tête** : cube biseauté et subdivisé, mâchoire séparée, dents en array de cônes.
- **Total** : environ 8 k tris.
- **Os : 28** (racine, bassin, 3 vertèbres, `disco_ball` qui tourne indépendamment, 2 de cou, tête, mâchoire, 6 de queue, 2 × 4 pour les pattes, 2 × 2 pour les bras).

**VFX signature**
- **Rotation permanente de la boule**, avec taches lumineuses qui balaient la salle et scintillements.
- Chaque coup reçu **arrache 2 à 4 facettes** (quads miroirs instanciés qui tombent et rebondissent). La boule garde les trous, ce qui montre l'état de santé sans barre de vie.

**Télégraphes**
- **« Piste de danse »** (signature, 900 ms) : la boule accélère et ses taches **virent au magenta**. Elles se figent au sol, leur contour se remplit, puis elles explosent en colonnes de lumière. Le joueur lit des **zones rondes à éviter**, qui sont l'effet visuel lui-même.
- **Stomp** (700 ms) : la patte se lève, puis un anneau qui se remplit autour de lui. Onde de choc à l'impact.
- **Coup de queue** (600 ms) : arc de 180° **derrière** lui, rempli en balayage. Il punit le joueur qui cherche le dos.
- **Ruée disco** (800 ms) : ligne magenta. Il glisse sur le ventre-boule comme une boule de bowling.

**Animations** : spawn (la boule s'allume, roulement de tambour, il se déplie), idle (balancement dansé, la boule tourne), walk (lourd, secousse de caméra au pas), stomp, tail-sweep, dance-floor (pose « bras en l'air », 1,2 s), rush (glissade sur la boule), hurt, stagger (étourdi, la boule clignote), death (la boule **éclate** en pluie de facettes et de confettis-tickets, le corps s'effondre comme un gonflable).

### 7.2 Le Furet putride (ennemi de base ou de harcèlement)

**Silhouette et proportions**
- Furet **géant** : environ 2,6 m de long, 0,9 m au garrot, vu de dessus. Corps en **saucisse en S** très souple, tête en coin avec le **masque sombre** caractéristique autour des yeux, petites oreilles rondes.
- **Queue touffue** démesurée (40 % de la longueur), poils ébouriffés en touffes sur le dos.
- **Critère en ombre noire** : un **S allongé et bas** terminé par un plumeau. C'est le seul ennemi horizontal et sinueux du bestiaire, donc il ne se confond ni avec les humanoïdes ni avec les machines. Les touffes du dos doivent rester visibles en ombre à 64 px.
- Danger de lecture : collé au sol, il peut disparaître sur le ballast. D'où un **pelage clair** et un **harnais turquoise**.

**Palette et matériaux toon**

| Matière | Rendu |
|---|---|
| Pelage | Sable sale `#C9B48A`. **Ombre décalée vers le vert olive** `#4E5A2A` : le décalage de teinte rend la bête « malade » sans texture. Taches jaunâtres en cases d'atlas. |
| Masque, pattes | Brun-gris `#3B3128` |
| Harnais | **Turquoise** `#19C3B1` avec une plaque Privatix violette (« animal de détection » de la société, à confirmer par le lore) : c'est la marque « ennemi » |
| Yeux | Jaune-vert émissif léger |
| Truffe | Rose-brun `#9A5A55` (pas de magenta) |
| Contour | Coque inversée **dentelée** (bruit sur l'extrusion) pour suggérer le poil sans fourrure réelle |

**Production procédurale (bpy → GLB)**
- **Corps** : **skin modifier sur une courbe** (la colonne en S, rayons variables), le cas d'usage idéal pour un mustélidé. Subdivision 1.
- **Touffes** : cônes biseautés dispersés sur le dos (*geometry nodes* ou script).
- **Queue** : chapelet de 6 sphères écrasées fusionnées.
- **Tête** : sphère déformée par une lattice.
- **Total** : environ 4,5 k tris.
- **Os : 30** (racine, **7 vertèbres** pour l'ondulation, 2 de cou, tête, mâchoire, 2 oreilles, 5 de queue, 4 × 3 pour les pattes). L'ondulation du corps est une **onde procédurale** ajoutée aux vertèbres à l'exécution, qui se superpose aux clips.

**VFX signature**
- **Nuages verdâtres** : des billboards *soft particles* (bruit fbm dans le shader, fondu de profondeur au contact du sol), vert `#9BD43A` à olive.
  - En sillage permanent derrière lui, discrets.
  - Lignes d'odeur ondulées de BD (rubans en sinus dans le shader) au-dessus du dos, et 3 à 5 mouches (points noirs instanciés en orbite).
  - Au plus 40 particules par furet, 120 à l'écran, à demi-résolution sur mobile.
- **Règle de lecture** : le **vert = l'odeur**, décoratif et inoffensif. **Seules les zones bordées de magenta blessent.** Le nuage toxique qui inflige des dégâts a donc un anneau magenta au sol et un cœur vert. On garde l'image demandée sans casser la grammaire « magenta = danger ».

**Télégraphes**
- **Bouffée putride** (signature, 550 ms) : il s'arrête, **lève la queue** (os de queue ×1,3, poils hérissés), un cône magenta se remplit derrière lui. Jet, puis une **zone persistante** de 3 s (anneau magenta et nuage vert) qui ralentit.
- **Morsure bondissante** (450 ms) : il s'aplatit, puis une ligne magenta courte, puis un bond.
- **Plongée** (400 ms) : il disparaît dans une bouche d'égout ou sous le quai et ressort ailleurs. Cercle magenta à l'endroit de la sortie, 400 ms avant.

**Animations** : spawn (il sort d'une poubelle de tri ou d'une bouche d'égout), idle (renifle, se gratte), run (galop bondissant en S), bite-lunge, tail-raise et spray, burrow et emerge, « danse de guerre » du furet (sautillement latéral quand il est en recul : signal de fenêtre de punition), hurt, death (sur le dos, pattes en l'air, le nuage se dissipe en dernier : comique, pas gore).

### 7.3 Boss satirique : caricature d'Elio Di Rupo

> **Cadre** : personnalité politique réelle. L'utilisateur déclare détenir les droits. La photo de référence fournie a servi **uniquement** à relever des traits. **Elle n'est jamais utilisée comme texture ni comme asset**, ni pour de la photogrammétrie ou une génération de visage à partir de la photo. La caricature est **entièrement modélisée et stylisée** dans le style toon du jeu.
>
> **Garde-fous de ton** (bon enfant) :
> - la satire vise le **personnage public** : l'orateur élégant, les inaugurations, les discours ;
> - **jamais** la vie privée, l'orientation, les origines, l'âge ou le corps ;
> - aucune réplique présentée comme une **vraie citation** ni aucune position politique inventée qu'on pourrait prendre pour réelle ;
> - pas d'enlaidissement : il doit rester **sympathique et reconnaissable**, et sa défaite est digne (il redresse son nœud papillon et salue).

**Traits relevés sur la référence**
- Chevelure **brune, très volumineuse**, en casque arrondi, raie sur le côté. Une grande **mèche balaie le front** en vague et les côtés couvrent les oreilles.
- **Sourcils sombres et épais**, droits.
- **Lunettes rectangulaires sans monture** : verres seuls, pont et branches fins et argentés.
- **Grand sourire** franc, dents visibles.
- **Nœud papillon bordeaux** en soie brillante.
- Chemise blanche, **costume bleu marine**.

**Silhouette et proportions (caricature)**
- 2,6 m (boss, ×1,3 le héros), **tête = 1/3 de la hauteur**.
- Chevelure **exagérée en volume** : c'est le premier repère, une masse arrondie avec une **vague-mèche** qui déborde vers l'avant.
- **Nœud papillon surdimensionné** : 0,7 m d'envergure, deuxième repère.
- Corps mince et élégant, épaules de veste nettes, gestes d'orateur.
- **Critère en ombre noire à 96 px** : grosse tête-chevelure en champignon arrondi avec la vague de mèche, puis le **nœud papillon en « papillon »** horizontal sous le menton, puis un corps fin en costume. Si le nœud ne se lit pas en ombre, on l'agrandit.

**Palette et matériaux toon**

| Matière | Couleur | Shader |
|---|---|---|
| Cheveux | Brun `#5A3A24`, lumière `#8A5E3C`, ombre `#2E1C1A` | Rampe à 3 tons et **reflet spéculaire en bande** (l'« anneau d'ange » des cheveux toon), qui donne le volume brillant |
| Costume | Bleu marine `#1F2E55`, ombre `#141A33`, rim light cyan | Toon mat |
| Nœud papillon | Bordeaux `#7A1E2C`, lumière `#B23A4E` | Spéculaire satiné (bande nette) : la soie se lit |
| Chemise | Blanc cassé `#ECE8E2` | Toon |
| Peau | Teint chaud naturel, ombre rosée | Toon doux, aucune texture de peau |
| **Lunettes** | Verres quasi invisibles | Plans transparents fresnel teintés à 8 % ; **un reflet blanc en diagonale** sur chaque verre (sinon ils disparaissent dans le style toon). Pont et branches : cylindres argentés fins. |

Le bordeaux du nœud reste distinct du **rouge Syndical** (rareté 4) et du **magenta** du danger : plus sombre et plus brun.

**Production procédurale (bpy → GLB)**
- **Corps** : générateur humanoïde du héros, avec paramètres « élancé, costume » ; veste par extrusion et Solidify, revers biseautés.
- **Tête** : sphère déformée par une **lattice** de caricature (front et joues, menton léger).
- **Chevelure** : 8 à 12 **mèches-tubes** (courbes de Bézier biseautées et effilées, à la façon des cheveux d'anime toon), fusionnées et lissées. La grande mèche avant est sur ses propres os.
- **Sourcils** : 2 boîtes biseautées.
- **Expressions** : **morph targets** de bouche (sourire, grand sourire, discours, surprise) et décalques d'yeux par atlas (P).
- **Nœud papillon** : deux « ailes » en lathe aplati et un nœud central, sur un os détachable (il sert de projectile).
- **Total** : environ 9 k tris.
- **Os : 28** (20 du contrat humanoïde, mâchoire, 3 de mèche en chaîne à ressort, sourcils ×2, `bowtie` détachable, `glasses`).

**VFX signature**
- **Éclat des lunettes** : une étoile SDF blanche sur un verre au début de chaque attaque. Elle passe au magenta quand l'attaque est armée. C'est le « tic » visuel qui annonce tout.
- **Ruban et ciseaux d'inauguration** géants, confettis aux couleurs neutres.
- **Bulles de discours** en meshes (« … », points d'exclamation, guillemets) qui servent de projectiles.

**Télégraphes**
- **Nœud papillon boomerang** (700 ms) : il ajuste son nœud, l'éclat des lunettes s'allume, une trajectoire courbe aller-retour se trace en pointillé magenta, puis le nœud tournoie (traînée bordeaux, contour magenta).
- **Inauguration** (signature, 1 000 ms) : il tend un **ruban géant** en travers de l'arène. Le ruban *est* la ligne de télégraphe magenta, qui se remplit d'un bout à l'autre. Coup de ciseaux, puis onde le long de la ligne. Confettis à la fin.
- **Discours fleuve** (900 ms) : il monte sur un pupitre (prop B), un cercle magenta se remplit, puis une spirale de bulles-projectiles.
- **Coup de mèche** (500 ms) : il se retourne vivement et la mèche balaie un arc de 120° (traînée).
- **Sourire éclatant** (phase 3, 800 ms) : un cône magenta se remplit, puis un flash blanc (court aveuglement visuel, sans dégâts, réglable dans l'accessibilité).

**Animations** : intro (dos tourné, il se retourne, ajuste son nœud, sourire et éclat des lunettes), idle (gestes d'orateur, main levée), walk (pas assuré), bowtie-throw et catch, inauguration (tendre le ruban, couper), speech (pupitre), hair-swipe, smile-flash, phase (la chevelure gagne du volume, la mèche s'agite : comique, pas dégradant), hurt, stagger (lunettes de travers), defeat (il s'assoit, redresse son nœud, salue le joueur), victory (salut à la foule).

### 7.4 Effort supplémentaire

| Asset | Méthode | Effort |
|---|---|---|
| Discosaure (modèle, 10 anims, shader boule et taches, facettes) | B + S | L |
| Furet putride (modèle, 9 anims, nuages et mouches, onde de colonne) | B + S | M |
| Boss caricature (modèle, morphs, 12 anims, ruban, ciseaux, pupitre, bulles) | B + S + P | L |

Ces trois fiches s'ajoutent au jalon du § 4 (environ +3 à 4 semaines-agent) ou entrent au jalon suivant.
