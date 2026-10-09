# Privatix — Guide Pixel Art (cahier des charges des assets)

> **Rôle** : Direction artistique pixel art · **Statut** : cahier des charges **contractuel** pour toute commande, tout achat et toute intégration d'asset graphique.
> **Jeu** : Hack 'n' Slash / Roguelite top-down, Phaser 4.2.1 + TypeScript + Vite, Arcade Physics, `pixelArt: true`, `roundPixels: true`.
> **Références visuelles** : **pixel art moderne — Dead Cells** (volumes éclairés, rim light, smears, animation fluide à anticipation / follow-through, VFX généreux) **et Celeste** (palette saturée à rampes à décalage de teinte, squash & stretch, élément secondaire qui traîne : l'écharpe du héros comme les cheveux de Madeline). Pour la lecture du combat : Hades (télégraphes), Hyper Light Drifter (couleurs franches), Enter the Gungeon (projectiles saturés).
> **Usage** : le porteur du projet s'en sert pour **commander ou télécharger** les bons assets (itch.io ou freelance). Un fichier qui ne respecte pas ce guide **n'entre pas** dans `public/`.

Vocabulaire : **doit** = obligatoire (refus en revue sinon) ; **recommandé** = préférence de la direction artistique ; « P0/P1/P2 » = priorité de production (§10).

> **Références de direction artistique** : **Dead Cells**, **Celeste** et **Hades** (contrastes dramatiques, encrage des formes, liserés colorés forts, décors sombres en flaques de lumière).
>
> **Production des personnages** : depuis la décision « pixel art moderne, qualité Dead Cells / Celeste », héros, ennemis, boss et PNJ sont produits par le **pipeline 3D → pixel** de `tools/render3d/` (voir son README). Les noms de fichiers, la convention des bandes, les clés d'animation et les normal maps décrits ici restent le contrat : un artiste ou un pack itch.io peut remplacer n'importe quelle bande à l'identique. Les tailles de frame des personnages rendus en 3D sont lues dans `tools/render3d/manifest.json` (héros 72×72, pivot (36, 64)), qui prime sur les tailles indiquées plus bas.

## Sommaire

1. Résolution, échelle et classes de sprites
2. Règles de format (non négociables)
3. Héros
4. Ennemis, élite et boss (MVP) — annexe post-MVP
5. Tilesets, props, trains et couches de décor
6. VFX, projectiles, pickups, ombres, lumières, UI, polices, portraits
7. Palette « Privatix Moderne 57 » et lisibilité
8. Guide d'achat itch.io (et commande à un freelance)
9. Assets originaux du dépôt (générateur `tools/pixelart/`)
10. Liste exhaustive du MVP et récapitulatif chiffré

---

## 1. Résolution, échelle et classes de sprites

### 1.1 Résolution logique : 640×360, mise à l'échelle entière

| Écran | Facteur | Remarque |
|---|---|---|
| 1280×720 | **×2** | entier |
| 1920×1080 | **×3** | entier |
| 2560×1440 | **×4** | entier |
| 3840×2160 | **×6** | entier |
| Champ de vision | 40×22,5 tuiles de 16 px | arène confortable pour esquiver les tirs |

- **1 texel = 1 pixel logique** pour **tout** : monde, UI, polices, portraits. Aucun asset n'est dessiné « ×2 » (pas de mixels), aucun asset n'est mis à l'échelle par le moteur.
- Caméra en zoom 1, sprites en échelle 1. Seuls les VFX et projectiles peuvent être **tournés** (règles §6.1).

### 1.2 Classes de sprites (taille de frame = canvas, toujours carré)

| Catégorie | Frame | Silhouette utile max | Pivot (x, y) en px dans la frame | Origine Phaser | Ombre au sol |
|---|---|---|---|---|---|
| **Héros** | **48×48** | 18×28 (zone x 15–32, y 16–43) ; la clé et le dash débordent dans la marge | **(24, 44)** | `(0.5, 0.9167)` | `shadow_m` |
| **Ennemis standard** | **32×32** | 22×26 (y 2–27) | **(16, 28)** | `(0.5, 0.875)` | `shadow_s` |
| **Élites** | **48×48** | 30×38 (y 6–43) | **(24, 44)** | `(0.5, 0.9167)` | `shadow_l` |
| **Boss 1 et 2** | **96×96** | 72×84 (y 4–87) | **(48, 88)** | `(0.5, 0.9167)` | `shadow_xl` |
| **Boss final** | **128×128** | 104×112 (y 8–119) | **(64, 120)** | `(0.5, 0.9375)` | `shadow_xxl` |
| PNJ du hub | 32×32 | 20×26 | (16, 28) | `(0.5, 0.875)` | `shadow_s` |
| Mini-ennemi (Pense-bête Vivant, post-MVP) | 16×16 | 12×12 | (8, 14) | `(0.5, 0.875)` | — |
| Pickups 16 / 8 | 16×16 / 8×8 | 12×12 / 6×6 | (8, 14) / (4, 7) | `(0.5, 0.875)` | `shadow_s` (16) |
| Projectiles, VFX | variable | — | **centre** (W/2, H/2) sauf mention | `(0.5, 0.5)` | — |
| Props (décor) | multiples de 16 | — | **bas-centre** (W/2, H) | `(0.5, 1)` | dans le calque `ombres` |
| Tuiles | **16×16** | — | — | — | — |

Règles de pivot :

- Le pivot est la **ligne des pieds**. Sur **toutes** les frames de **tous** les fichiers d'une entité, les pieds au repos touchent exactement la rangée de pixels `y` du pivot, centrés sur `x`. Le personnage ne « flotte » jamais d'une frame à l'autre (exceptions dessinées : saut, chute, vol).
- Les **4 rangées sous le pivot** (héros, élites, ennemis : y = 44–47 ou 28–31) restent **vides** (réservées à la poussière et aux pieds qui dépassent d'un pixel au plus).
- Le **drone** (volant) garde le pivot (16, 28) au sol ; son corps est dessiné **au moins 8 px au-dessus** de la ligne du pivot (ombre posée par le moteur au pivot).
- Corps physiques Arcade (indicatifs, validés par le Lead Dev) : héros `setSize(12, 8)` + `setOffset(18, 36)` ; ennemi 32 `setSize(12, 8)` + `setOffset(10, 20)` ; élite `setSize(16, 10)` + `setOffset(16, 34)` ; boss 96 `setSize(40, 16)` + `setOffset(28, 72)`. Le centre des hitboxes d'attaque du héros est **10 px au-dessus des pieds** (soit (24, 34) dans la frame).

### 1.3 Directions : 4 directions, 3 dessinées

| Direction logique | Fichier utilisé | Rendu |
|---|---|---|
| bas | `_down` | tel quel |
| haut | `_up` | tel quel |
| droite | `_side` | tel quel (**dessiné tourné vers la droite**) |
| gauche | `_side` | `setFlipX(true)` |

- Déplacement et visée continus (souris, stick) ; le **corps** prend la direction quantifiée en 4 secteurs (seuil diagonal favorable à l'horizontale). Les **slashs** sont orientés en 8 directions par rotation (§6.1).
- Conséquences du miroir : **aucun texte ni logo** sur une vue `side` ; gilet symétrique ; la clé change de main en miroir (accepté). Texte autorisé seulement de dos (`up`), par ex. « OCC » au pochoir sur le gilet.
- Animations **mono-direction** (pas de suffixe de direction) : cinématiques (spawn, death, special, whistle), ennemis symétriques (Borne, Drone), boss 96/128 (face caméra).
- Pas de diagonales dessinées, ni pour le héros ni pour les ennemis.

### 1.4 Direction artistique : pixel art **moderne** (Dead Cells, Celeste)

Le pixel art reste **net** (1 texel = 1 pixel, alpha binaire, contour extérieur sans anti-aliasing), mais il n'est plus « rétro plat » :

| Pilier | Ce qu'on attend dans chaque feuille |
|---|---|
| **Palette** | Rampes de **4 à 8 tons par matériau** à **décalage de teinte** : ombres vers le bleu / violet froid, lumières vers le jaune / orange chaud ; saturation franche ; aucun noir pur (contour `#14101A`, lignes internes en sel-out coloré). Palette « Privatix Moderne 57 » (§7.1). |
| **Volume et lumière** | Lumière **haut-gauche** ; arêtes tournées vers la lumière un ton plus clair, arêtes opposées un ton plus sombre ; **rim light** `#6FD6FF` (néon froid des quais) sur le **bord droit** de la silhouette des acteurs ; **ombre portée / AO** d'un ton sous les bras, le menton, le torse et au contact du sol ; **anti-aliasing manuel sélectif à l'intérieur** des formes uniquement. |
| **Animation** | Plus de frames sur les actions clés (§3.1) ; **anticipation → action → follow-through** ; **smear** (traînée pleine de l'arme, cœur blanc, bords colorés, stries de vitesse) sur la frame active ; **squash & stretch** dessiné (écrasé à l'appui / à l'impact, étiré au départ du dash et en suspension) ; **élément secondaire** : l'écharpe syndicale rouge du héros, simulée, en retard d'1–2 frames. |
| **Lisibilité** | Couleurs de lecture inchangées : héros orange `#FF7A1A`, ennemis turquoise `#19C3B1`, ce qui blesse magenta `#FF3EA5`. **Émissifs** (écrans, LED, néons, télégraphes, VFX) très saturés et clairs : ils ne sont jamais assombris et alimentent le bloom du moteur. |
| **VFX** | Plus lumineux et plus généreux : slash à cœur blanc et bords colorés, étincelles, impacts « étoile » avec halo, explosion flash blanc → boule de feu → fumée, onde de choc lumineuse. Toujours sans contour. |
| **Pickups et UI** | Pickups modelés avec un **reflet qui glisse** et une étincelle sur la boucle ; barres de vie / jauges en **rampe verticale** avec liseré spéculaire et reflets obliques ; cadres et panneaux biseautés (lumière haut-gauche), centre uni pour le 9-slice. |
| **Décor** | Sol en **valeur moyenne** (micro-variations, biseaux, grain, reflets humides), murs **sombres** avec matière ; néons et écrans émissifs ; quais en **bleu nuit profond**, OCC en **brique chaude** éclairée par des lanternes. |
| **Éclairage dynamique** | Chaque feuille de personnage, tileset et prop est livrée avec sa **normal map** `<nom>_n.png` (§2.6) pour l'éclairage Phaser 4. |

---

## 2. Règles de format (non négociables)

### 2.1 Bandes horizontales : format de livraison unique

| N° | Règle |
|---|---|
| R1 | **Nom** : `<entité>_<anim>[_<dir>]_strip<N>.png`, minuscules ASCII, **sans accent ni espace**. `_` sépare les champs ; **à l'intérieur d'un champ, `-`** (ex. `manager-kpi_walk_side_strip6.png`, `auditeur_attack-bars_strip12.png`, `vfx_slash-e_strip5.png`). |
| R2 | **Regex de validation** : `^([a-z0-9-]+)_([a-z0-9-]+)(?:_(down\|up\|side))?_strip([1-9][0-9]*)\.png$` |
| R3 | `<N>` = **nombre exact de frames** de la bande. |
| R4 | **Frames carrées** alignées de gauche à droite : largeur = N × H, hauteur = H = taille de frame. **padding 0, spacing 0, margin 0.** |
| R5 | **Pas de trim** : chaque frame garde le canvas complet de sa classe (§1.2), même vide. |
| R6 | **PNG 32 bits RGBA** (non indexé à la livraison, non entrelacé), fond transparent, profil couleur sRGB ou aucun ; pas de métadonnées de gamma exotiques. |
| R7 | **Alpha binaire** : chaque pixel a un alpha de **0 ou 255**. Aucun anti-crénelage, aucun flou, aucun pixel semi-transparent. Exceptions **limitatives** au §2.3. |
| R8 | **Largeur max 2 048 px** par fichier. Au-delà : réduire le nombre de frames ou découper en deux animations (`death-a`, `death-b`). |
| R9 | **Pivot aux pieds** aux coordonnées exactes du §1.2, identiques sur toutes les frames et tous les fichiers de l'entité. |
| R10 | **Frame d'impact** (§2.4) : à l'index indiqué dans les tableaux de ce guide, ni avant ni après. |
| R11 | **Couleurs** : uniquement celles de la palette Privatix Moderne 57 (§7), contours compris. |
| R12 | **Fichiers statiques** (une seule image, non animée) : `<catégorie>_<nom>.png` (ex. `shadow_m.png`, `ui_energy-frame.png`, `tiles_quais.png`, `train_motrice.png`). Ils peuvent être non carrés. |
| R13 | **Bandes d'icônes / d'états** (non animées mais indexées) : même format qu'une animation ; l'ordre des frames est celui listé dans ce guide. |
| R14 | **Normal map** : `<nom du PNG sans .png>_n.png`, à côté du PNG, mêmes dimensions, même alpha (§2.6). Ce suffixe est la seule exception à la regex R2. |

**Clés Phaser** : clé de texture = nom de fichier sans `.png` ; clé d'animation = champs joints par `-` sans `strip<N>` (ex. `player_run_down_strip10.png` → `player-run-down`). Les durées par frame, frames actives et boucles vivent dans la table de données du code (recopiée des tableaux de ce guide), **jamais** dans le PNG. Le parseur de noms du code doit accepter le `-` à l'intérieur des champs (R1).

### 2.2 Dossiers imposés

| Contenu | Dossier |
|---|---|
| Héros | `public/assets/sprites/player/` |
| Ennemis standard et élites | `public/assets/sprites/enemies/` |
| Boss (et leurs entités annexes) | `public/assets/sprites/bosses/` |
| PNJ du hub et de run | `public/assets/sprites/npcs/` |
| VFX, projectiles (`proj-*`), ombres au sol (`shadow_*`) | `public/assets/sprites/vfx/` |
| Pickups, coffres | `public/assets/sprites/pickups/` |
| Interface | `public/assets/sprites/ui/` |
| Portraits de dialogue | `public/assets/sprites/portraits/` |
| Tilesets, props (atlas et bandes), trains, lumières (`light_*`) | `public/assets/tilesets/` |
| Polices bitmap (PNG + XML) | `public/assets/fonts/` |
| Sons et musiques (hors de ce guide) | `public/assets/audio/sfx/`, `public/assets/audio/music/` |

Sources éditables (`.aseprite`, `.tmx` de travail, calques) : `art/src/<catégorie>/`, **jamais** dans `public/`. Packs bruts achetés : `art/vendor/` (**exclu de git**, voir §8.6).

### 2.3 Exceptions à l'alpha binaire (liste fermée)

| Fichier | Alpha autorisé | Règle |
|---|---|---|
| `shadow_s/m/l/xl/xxl.png` | **0 ou 255** (recommandé) **ou 0 ou 128** | Livraison recommandée en `#14101A` opaque, opacité **0,5 appliquée par le moteur**. Une ombre précuite doit être à **128 exactement** partout. |
| `light_*.png` | **0, 64, 128, 192, 255** (paliers) | Halos **en paliers à bords nets** (3 ou 4 anneaux), jamais en dégradé lisse ; blanc ou gris neutre, teinte par `setTint`, mode additif. |
| `tiles_commun.png`, rangée 0 (ombres portées du décor) | 0 ou 255 | Ombres opaques `#0B1F3A` ; l'opacité du calque (0,4) est appliquée par le moteur. |

Tout autre fichier contenant une valeur d'alpha hors {0, 255} est **refusé**.

### 2.4 Frame d'impact et télégraphe

- La **frame d'impact** (« active ») est celle où le moteur crée la hitbox. Elle montre l'arme ou le coup **à extension maximale**, avec traînée (smear) en blanc `#FFFFFF`/`#F4F6F8` dessinée dans la frame. Aucune pose d'anticipation sur cette frame.
- Avant l'impact : **au moins 1 frame d'anticipation lisible** (arme armée en arrière, corps ramassé). Après : au moins 2 frames de récupération.
- **Ennemis** : la ou les frames précédant l'impact portent le **télégraphe magenta** `#FF3EA5` (LED, écran, reflet, contour de l'arme). Durée minimale du télégraphe : **300 ms** pour un ennemi standard, **700 ms** pour une élite, **500 ms** (et 800–1 200 ms recommandé) pour un boss.
- Dans la source Aseprite : calque `hitbox` (magenta, masqué à l'export) dessinant la zone active, et tag ou données utilisateur `active=<index>`. Dans les bandes de remplacement du code (placeholders), la frame active apparaît en rouge.
- Flash de coup (blanc 60 ms par `setTintFill(0xFFFFFF)`), clignotement d'invulnérabilité (toutes les 60 ms pendant 600 ms) et images rémanentes du dash sont **produits par le moteur** : **ne pas les dessiner**.

### 2.5 Option atlas Aseprite (JSON Hash, mêmes noms)

La bande reste le format de livraison et de relecture. Une entité peut **en plus** être exportée en atlas pour réduire les changements de texture, **si le Lead Dev l'active** pour cette entité (jamais les deux chargés en même temps).

- Un `.aseprite` par entité ; **tags nommés `<anim>_<dir>`** (ex. `run_down`, `death`), durées saisies dans Aseprite.
- Export des bandes depuis la source (une commande par tag) :
  `aseprite -b art/src/player/player.aseprite --tag run_down --sheet-type horizontal --sheet public/assets/sprites/player/player_run_down_strip10.png`
- Export atlas (sans `--trim`, sans `--split-layers`) :
  `aseprite -b art/src/player/player.aseprite --sheet public/assets/sprites/player/player.png --data public/assets/sprites/player/player.json --format json-hash --sheet-type packed --list-tags --filename-format '{title}_{tag}_{tagframe}' --shape-padding 2 --inner-padding 0`
- Noms de frames de l'atlas : `<entité>_<anim>_<dir>_<index>` (ex. `player_run_down_3`), c'est-à-dire **le nom de la bande sans `_strip<N>`** suivi de l'index. Chargement : `this.load.aseprite(...)` ou `this.load.atlas(...)` + `generateFrameNames`.
- L'atlas est un **artefact généré**, jamais retouché à la main ; un `.json` d'atlas ne doit contenir aucun `trimmed: true`.

### 2.6 Normal maps (éclairage dynamique Phaser 4)

| Règle | Valeur |
|---|---|
| Fichiers concernés | **toutes** les feuilles de `sprites/player`, `sprites/enemies`, `sprites/bosses`, `sprites/npcs` et **tout** `tilesets/` (tilesets extrudés, props, atlas de props, trains, bandes animées de props). **Pas** de normal map pour les VFX, projectiles, pickups, UI, portraits, polices, ombres ni lumières `light_*`. |
| Nom | `<nom>_n.png` à côté de `<nom>.png` (ex. `player_run_side_strip10_n.png`, `tiles_quais_n.png`, `props/prop_banc-h_n.png`). |
| Format | PNG RGBA, **mêmes dimensions** que le PNG, **même alpha** (binaire, identique pixel à pixel) ; pixels transparents = `(128, 128, 255, 0)`. |
| Encodage | R = X (droite), **G = Y vers le haut (vert = haut, convention OpenGL)**, B = Z vers la caméra ; `composante = (n + 1) / 2 × 255`. |
| Calcul (générateur) | Hauteur = **bombé de la silhouette** (distance au bord) + **luminance du matériau** ; gradient → normale. Chaque frame (ou tuile de 18×18 dans un tileset extrudé) est traitée seule : aucune pente entre deux frames ou deux tuiles. Tuiles : luminance seule (sol plat en relief). |
| Manifeste | champ **`"normalMap": "assets/…_n.png"`** sur chaque entrée concernée (`animations[]`, `images[]`, `tilesets[]`). Chargement Phaser 4 : `load.spritesheet(key, [file, normalMap], frameConfig)` ou `load.spritesheet({ key, url: file, normalMap, frameConfig })` ; `load.image(key, [file, normalMap])` pour les images et tilesets ; `load.atlas({ key, textureURL, atlasURL, normalMap })` pour les atlas de props ; puis `setLighting(true)` (WebGL). |
| Asset acheté | livrer sa normal map au même nom (dessinée, ou générée avec `tools/pixelart/modern.py` → `normal_map`) ; à défaut, le moteur éclaire à plat. |

---

## 3. Héros

**Le cheminot en 3x8** : gilet orange haute visibilité (seul porteur de l'orange `#FF7A1A`), pantalon bleu institution, casque ou bonnet de chantier, bandes réfléchissantes, **clé à tire-fond** (arme unique) et **écharpe syndicale rouge** (élément secondaire animé, §3.2). Silhouette lisible en noir plein. Dossier : `public/assets/sprites/player/`. Frame **48×48**, pivot **(24, 44)**.

### 3.1 Animations du MVP

Durées **par frame** en ms. « Active » = index (base 0) de la frame d'impact. « Dir » = 3 → trois fichiers `_down`, `_up`, `_side` ; 1 → un fichier sans direction (dessiné face caméra).

| Anim | Action de jeu | Dir | Frames | Durées (ms) | Total | FPS nominal | Boucle | Active / événements | Fichier(s) exact(s) | Feuille |
|---|---|---|---|---|---|---|---|---|---|---|
| `idle` | repos | 3 | **8** | 140 ×8 | 1 120 | 7,1 | oui | respiration (léger écrasement frames 4–5), clé qui bascule sur l'épaule, écharpe qui ondule | `player_idle_{down,up,side}_strip8.png` | 384×48 |
| `run` | course | 3 | **10** | 64 ×10 | 640 | 15,6 | oui | cycle contact / appui (écrasé) / passage / poussée / suspension (étiré) ; contacts au sol frames **0 et 5** (`events.footstep`) → `vfx_dust` + son de pas ; écharpe au vent | `player_run_{down,up,side}_strip10.png` | 480×48 |
| `attack1` | Frappe, coup 1 (balayage) : startup 90, active 60, recovery 160 | 3 | **7** | 40, 50, **60**, 40, 40, 40, 40 | 310 | 22,6 | non | 0 armé, 1 anticipation max (écrasé) ; **active 2 = smear** (traînée pleine, corps étiré) ; 3 follow-through (fin de smear) ; 4–6 retour ; enchaînement dès la frame 4 | `player_attack1_{down,up,side}_strip7.png` | 336×48 |
| `attack2` | Frappe, coup 2 (revers) : 80 / 60 / 170 | 3 | **7** | 40, 40, **60**, 40, 40, 40, 50 | 310 | 22,6 | non | **active 2 = smear** ; 3 follow-through ; enchaînement dès la frame 4 | `player_attack2_{down,up,side}_strip7.png` | 336×48 |
| `attack3` | Frappe, coup 3 (tire-fond au sol) : 200 / 80 / 320 | 3 | **9** | 60, 50, 50, 40, **80**, 100, 90, 70, 60 | 600 | 15 | non | anticipation marquée : 0 accroupi (écrasé), 1–3 clé levée au maximum, corps étiré ; **active 4 = smear** → `vfx_slam-*`, hitstop 110 ms ; 5 impact (écrasé) + fin de smear ; 6–8 relevé ; dash interdit après 120 ms de startup | `player_attack3_{down,up,side}_strip9.png` | 432×48 |
| `dash` | Dash : 72 px en 140 ms | 3 | **6** | 20, 25, 25, 25, 25, 20 | 140 | 42,9 | non | 0 anticipation (écrasé), 1–3 **étirement** dans l'axe + lignes de vitesse, 4 freinage (écrasé), 5 retour ; **invulnérable frames 0–4** (0–120 ms) ; `vfx_dash` frame 0 | `player_dash_{down,up,side}_strip6.png` | 288×48 |
| `dash-attack` | Attaque de correspondance (estoc) : 60 / 80 / 200 | 3 | 5 | 30, 30, **80**, 100, 100 | 340 | 14,7 | non | **active 2** → `vfx_thrust-*` | `player_dash-attack_{down,up,side}_strip5.png` | 240×48 |
| `drink` | Café : boire un Gobelet (600 ms, déplacement 50 %) | 3 | 6 | 100 ×6 | 600 | 10 | non | soin appliqué frame **4** → `vfx_heal` | `player_drink_{down,up,side}_strip6.png` | 288×48 |
| `hurt` | coup reçu | 3 | **4** | 50, 60, 60, 70 | 240 | 16,7 | non | 0 impact (écrasé), 1 recul max (étiré), 2–3 retour ; flash blanc par le moteur | `player_hurt_{down,up,side}_strip4.png` | 192×48 |
| `whistle` | Coup de sifflet (tap) : 150 / 100 / 250 | 1 | 8 | 50, 50, 50, **50**, **50**, 80, 80, 90 | 500 | 16 | non | invulnérable 0–2 ; **actives 3–4** → `vfx_shockwave` (rayon 72) | `player_whistle_strip8.png` | 384×48 |
| `special` | Préavis de grève (maintien 600 ms) : 600 / 120 / 400 | 1 | 12 | 150 ×4, **120**, 50, 50, 50, 60, 60, 60, 70 | 1 120 | 10,7 | non | frames 0–3 = maintien (+ `vfx_charge` en boucle) ; **active 4** → `vfx_shockwave-big` (rayon 120) | `player_special_strip12.png` | 576×48 |
| `rage` | entrée en Pétage de plombs | 1 | 8 | 60 ×8 | 480 | 16,7 | non | vapeur du casque frame 3 → `vfx_steam` en boucle ensuite | `player_rage_strip8.png` | 384×48 |
| `spawn` | Prise de poste (entrée de salle) | 1 | 10 | 80 ×9, 120 | 840 | 12 | non | dans `vfx_spawn-player` ; clé plantée frame **6** → `vfx_dust-land` | `player_spawn_strip10.png` | 480×48 |
| `death` | fin de Shift | 1 | 12 | 100 ×11, 400 | 1 500 | 8 | non | dernière frame tenue : assis, clé posée, thermos renversé | `player_death_strip12.png` | 576×48 |

**Total héros MVP : 32 fichiers, 236 frames** (62 frames × 3 directions + 50 frames mono-direction). Les durées du tableau sont des valeurs de départ : le moteur recale chaque coup sur les timings du GDD (startup / active / recovery) en lisant le manifeste.

### 3.2 Règles d'animation propres au héros

- Combo : tampon d'entrée 150 ms ; `attack1 → attack2 → attack3` ; retour au coup 1 si aucune entrée 150 ms après la fin de la recovery. Le dash annule toute recovery et le startup des coups 1 et 2, jamais une frame active.
- `attack1` et `attack2` doivent se lire comme **un aller-retour** (balayage puis revers) : la clé termine `attack1` du côté où `attack2` commence.
- `attack3` : le héros lève la clé à deux mains (frames 0–2), frappe le sol (3), reste courbé (4–5), se redresse (6). Pas en avant de 12 px géré par le moteur, **pas dessiné**.
- `dash` : corps penché, clé tenue en arrière, pieds hors sol frames 1–3 (seule exception au pivot). Les images rémanentes **orange** (`setTintFill(0xFF7A1A)`, 3 copies espacées de 45 ms, effacées en 180 ms) sont générées par le moteur.
- `drink` : le gobelet (blanc 06, café 14) est tenu de la main libre ; les jambes restent en pose neutre (le moteur fait glisser à 50 %).
- Pendant le Pétage de plombs, le moteur teinte le héros en rouge à 15 % : aucune variante dessinée.
- **Écharpe syndicale rouge** (élément secondaire « à la Madeline ») : nœud au col sur toutes les directions (+ court pan sur la poitrine de face), queue de 4 segments (rouge rebelle, dessous rouge sombre, liseré blanc et frange au bout) qui **traîne derrière le mouvement avec 1–2 frames de retard** (chaîne simulée sur toute l'animation : elle flotte en course, fouette au moment du coup, retombe en follow-through). De face elle passe dans le dos (visible sur les côtés), de dos elle couvre le gilet, de profil elle part vers l'arrière.
- **Smear** : sur la frame active de chaque coup, la tête de la clé laisse une **traînée pleine** en croissant (fine à la queue, large à la tête), **cœur blanc**, bords jaune / orange, stries de vitesse dans la queue ; la frame suivante garde la fin de la traînée en tons chauds (follow-through). Le smear fait partie du sprite ; le slash `vfx_slash-*` (§6) se superpose par le moteur.
- **Squash & stretch** : écrasé à l'appui de course, à l'armé et à l'impact (≈ ×1,1 / ×0,9), étiré au départ du dash et pendant la suspension (jusqu'à ×1,2 dans l'axe du mouvement), toujours autour du pivot (les pieds ne bougent pas).

### 3.3 Héros post-MVP (annexe, mêmes règles)

| Anim | Dir | Frames | Usage | Fichier(s) |
|---|---|---|---|---|
| `charge` | 3 | 9 (active 6) | Serrage, attaque chargée | `player_charge_{down,up,side}_strip9.png` |
| `throw` | 3 | 6 (lancer frame 3) | Lanterne (projectile `proj-lanterne_spin_strip4.png`, 16) | `player_throw_{down,up,side}_strip6.png` |
| `radio` | 1 | 10 (événement frame 6) | Appel radio (super du collègue favori) | `player_radio_strip10.png` |
| `parry` | 3 | 4 (active 1) | parade, Montage « Clé du Wagon-Bar » | `player_parry_{down,up,side}_strip4.png` |
| `interact` | 1 | 4 | interaction au hub | `player_interact_strip4.png` |

---

## 4. Ennemis, élite et boss

Règles communes :

- Tout ennemi Privatix porte la **turquoise `#19C3B1`** (et/ou `#8FF5E4`) sur **au moins 15 % des pixels** de sa silhouette (cravate, lanyard, écran, LED) ; **aucune nuance d'orange**.
- Le télégraphe de chaque attaque est **magenta `#FF3EA5`** avec noyau blanc (LED, écran, reflet) sur les frames listées.
- Mort : anim de mort propre **puis** `vfx_poof` (dissolution en slides turquoise) déclenché par le moteur sur la dernière frame.
- Étourdissement « En grève » (sifflet) : pas d'anim dédiée ; le moteur fige l'ennemi sur sa frame `hurt` 1 et affiche `vfx_strike-sign` au-dessus de la tête.
- Apparition : télégraphe au sol `vfx_spawn-privatix` (600 ms) puis anim d'entrée si elle existe (Borne `wake`, Drone `drop`), sinon `idle`.

### 4.1 Consultant Junior « Slide-Ninja » (MVP) — mêlée rapide, ruée « Quick win »

Petit et fin, costume cintré trop court, baskets blanches, laptop sous le bras, cravate turquoise. Frame **32×32**, pivot **(16, 28)**, dossier `public/assets/sprites/enemies/`.

| Anim | Comportement | Dir | Frames | Durées (ms) | Boucle | Active / télégraphe | Fichier(s) | Feuille |
|---|---|---|---|---|---|---|---|---|
| `idle` | Errance (arrêt) | 3 | 4 | 150 ×4 | oui | — | `consultant_idle_{down,up,side}_strip4.png` | 128×32 |
| `run` | Errance, Approche (strafe en arc) | 3 | **8** | 68 ×8 | oui | contact / appui / passage / suspension ; pas frames 0 et 4 | `consultant_run_{down,up,side}_strip8.png` | 256×32 |
| `attack` | Préparation (450 ms) + ruée « Quick win » (6 tuiles) | 3 | **8** | 120, 120, 120, 90, **40**, 60, 80, 100 | non | frames 0–2 : ajuste sa cravate, reflet (frame 2) ; 3 anticipation (armé, écrasé, écran **magenta**) ; **active 4 = smear du « diaporama »** (traînée magenta à cœur blanc, slides turquoise qui s'en détachent, corps étiré) ; 5 follow-through ; 6–7 freinage | `consultant_attack_{down,up,side}_strip8.png` | 256×32 |
| `hurt` | coup reçu | 3 | 2 | 80, 80 | non | — | `consultant_hurt_{down,up,side}_strip2.png` | 64×32 |
| `death` | mort | 1 | 8 | 80 ×8 | non | finit laptop au sol ; `vfx_poof` frame 5 | `consultant_death_strip8.png` | 256×32 |
| `recover` *(P2, optionnel)* | Récupération (800 ms, essoufflé, dos tourné) | 3 | 4 | 200 ×4 | non | à défaut, le moteur tient la frame 5 d'`attack` | `consultant_recover_{down,up,side}_strip4.png` | 128×32 |

→ **13 fichiers, 74 frames** (+ 3 fichiers / 12 frames optionnels).

### 4.2 Borne Automatique (MVP) — tourelle, salves de tickets, ruban-laser

Borne de vente trapue, écran fissuré (« HORS SERVICE »), fente à pièces lumineuse turquoise. Sort d'une trappe au sol. **1 direction** (face caméra) : l'orientation du tir est portée par la ligne de visée et le projectile. Frame **32×32**, pivot **(16, 28)**.

| Anim | Comportement | Frames | Durées (ms) | Boucle | Active / télégraphe | Fichier | Feuille |
|---|---|---|---|---|---|---|---|
| `idle` | Visée | 4 | 200 ×4 | oui | écran qui clignote | `borne_idle_strip4.png` | 128×32 |
| `wake` | Déploiement (800 ms, invulnérable) | 6 | 130, 130, 130, 130, 140, 140 | non | trappe qui s'ouvre (0–2), borne qui monte (3–5) | `borne_wake_strip6.png` | 192×32 |
| `attack` | Préparation (500 ms) + Salve | 6 | 125 ×4, **60**, 120 | non | frames 0–3 écran « IMPRESSION… » et fente **magenta** ; **tir frame 4** (frame 4 tenue 1,5 s pour le ruban-laser) | `borne_attack_strip6.png` | 192×32 |
| `hurt` | coup reçu | 2 | 80, 80 | non | — | `borne_hurt_strip2.png` | 64×32 |
| `death` | mort | 4 | 80 ×4 | non | `vfx_explosion` frame 3 | `borne_death_strip4.png` | 128×32 |
| `wreck` | épave persistante | 1 | — | — | — | `borne_wreck_strip1.png` | 32×32 |
| `reload` *(P2)* | Rechargement (1,2 s) | 4 | 300 ×4 | non | à défaut : `idle` | `borne_reload_strip4.png` | 128×32 |
| `stun` *(P2)* | « HORS SERVICE » (2 s) | 4 | 250 ×4 | oui | à défaut : frame 1 de `hurt` tenue | `borne_stun_strip4.png` | 128×32 |

→ **6 fichiers, 23 frames** (+ 2 fichiers / 8 frames optionnels).

### 4.3 Drone Optimètre (MVP) — volant, marquage, rafale de billes

Quadrirotor compact, œil-objectif, antenne KPI ; coque acier, rotors et LED **turquoise** (le violet des notes narratives est remplacé par le turquoise canon). Ne touche jamais le sol : corps dessiné ≥ 8 px au-dessus du pivot (16, 28) ; ombre `shadow_s` posée par le moteur. Frame **32×32**, **1 direction**.

| Anim | Comportement | Frames | Durées (ms) | Boucle | Active / télégraphe | Fichier | Feuille |
|---|---|---|---|---|---|---|---|
| `fly` | Survol, Fuite | 4 | 60 ×4 | oui | — | `drone_fly_strip4.png` | 128×32 |
| `attack` | Évaluation : rafale de 3 billes | 8 | 120 ×4, **60**, **60**, **60**, 120 | non | antenne **magenta** frames 0–3 (480 ms) ; **tirs frames 4, 5, 6** ; 7 recul | `drone_attack_strip8.png` | 256×32 |
| `scan` | Scan-marquage (cône 1 s) | 6 | 160 ×4, 180, 180 | non | objectif **magenta** ; `vfx_scan-cone` en parallèle | `drone_scan_strip6.png` | 192×32 |
| `hurt` | coup reçu | 2 | 80, 80 | non | — | `drone_hurt_strip2.png` | 64×32 |
| `death` | chute en vrille | 6 | 80 ×6 | non | touche le sol frame 5 → `vfx_poof` | `drone_death_strip6.png` | 192×32 |
| `drop` *(P2)* | apparition (tombe du plafond) | 6 | 80 ×6 | non | à défaut : `fly` + `vfx_spawn-privatix` | `drone_drop_strip6.png` | 192×32 |

→ **5 fichiers, 26 frames** (+ 1 fichier / 6 frames optionnels).

### 4.4 Élite : Manager KPI « Le Tableur » (MVP) — soutien tank

Grand, chemise rentrée, **chronomètre géant** autour du cou, tablette brandie comme un sceptre, petits graphiques turquoise qui flottent autour de lui (dans le sprite). Frame **48×48**, pivot **(24, 44)**, dossier `public/assets/sprites/enemies/`. Aura d'élite : `vfx_elite-aura` (moteur, derrière le sprite).

| Anim | Action | Dir | Frames | Durées (ms) | Boucle | Active / télégraphe | Fichier(s) | Feuille |
|---|---|---|---|---|---|---|---|---|
| `idle` | Positionnement | 3 | 4 | 150 ×4 | oui | — | `manager-kpi_idle_{down,up,side}_strip4.png` | 192×48 |
| `walk` | déplacement | 3 | 6 | 100 ×6 | oui | — | `manager-kpi_walk_{down,up,side}_strip6.png` | 288×48 |
| `attack` | Chronométrage (cercle sous le joueur) ; Reporting hebdo (anneau de barres) | 3 | 8 | 120, 200, 200, 200, 60, **80**, 120, 150 | non | tablette et cadran **magenta** frames 1–3 ; **active 5** → `vfx_chrono-zone` ou anneau de `vfx_bars` ; pour le Reporting, le moteur tient la frame 3 +500 ms (télégraphe 1,2 s) | `manager-kpi_attack_{down,up,side}_strip8.png` | 384×48 |
| `shield` | Réunion d'alignement (boucliers alliés) | 3 | 8 | 300, 300, 300, **110**, 110, 110, 110, 110 | non | mains jointes **magenta** frames 0–2 (900 ms, vulnérable : un coup reçu annule tous les boucliers) ; **active 3** → `vfx_shield` sur les alliés | `manager-kpi_shield_{down,up,side}_strip8.png` | 384×48 |
| `hurt` | coup reçu | 3 | 2 | 80, 80 | non | — | `manager-kpi_hurt_{down,up,side}_strip2.png` | 96×48 |
| `death` | mort | 1 | 8 | 100 ×8 | non | le chrono roule au sol ; `vfx_poof` frame 6 | `manager-kpi_death_strip8.png` | 384×48 |
| `stun` *(P2)* | bouclier brisé | 1 | 6 | 150 ×6 | oui | à défaut : frame 1 de `hurt` tenue | `manager-kpi_stun_strip6.png` | 288×48 |

→ **16 fichiers, 92 frames** (+ 1 fichier / 6 frames optionnels).

### 4.5 Boss 1 : L'Auditeur des Quais (MVP) — 96×96, 1 direction

« Manager KPI suprême » : silhouette haute en costume trois-pièces anthracite, **horloge de quai** en pendentif (chronomètre géant), tablette-sceptre, debout sur une **estrade d'audit à chenilles** munie d'une télécommande d'aiguillage (il **commande les trains**). Écrans et cravate turquoise. Frame **96×96**, pivot **(48, 88)**, dossier `public/assets/sprites/bosses/`. Télégraphes ≥ 500 ms. La phase 3 (« Objectif non atteint ») réutilise les anims de phase 2 avec des durées ×0,8 (moteur) : aucun fichier de plus.

| Anim | Phase / pattern | Frames | Durées (ms) | Boucle | Active / télégraphe | Fichier | Feuille |
|---|---|---|---|---|---|---|---|
| `intro` | « Je le note » (chronomètre le héros) | 14 | 100 ×14 | non | le chrono démarre frame 10 | `auditeur_intro_strip14.png` | 1344×96 |
| `idle` | phase 1 | 6 | 120 ×6 | oui | sous `vfx_shield-boss` pendant le Bouclier d'alignement | `auditeur_idle_strip6.png` | 576×96 |
| `move` | phase 1 | 8 | 90 ×8 | oui | secousse caméra frames 0 et 4 | `auditeur_move_strip8.png` | 768×96 |
| `attack-sweep` | Graphique en barres (3 lignes en éventail) | 12 | 140 ×5, **40**, **40**, 100 ×5 | non | frames 0–4 (700 ms) tablette **magenta** ; **actives 5–6** → lignes de `vfx_bars` | `auditeur_attack-sweep_strip12.png` | 1152×96 |
| `attack-barrage` | Chronométrage (3 cercles en séquence) | 8 | 100 ×8 | oui (1,5 cycle) | cadran **magenta** ; **poses frames 2 et 6** → `vfx_chrono-zone` (déclenché 800 ms après) | `auditeur_attack-barrage_strip8.png` | 768×96 |
| `attack-stamp` | Reporting hebdo géant (frappe au sol) | 14 | 100 ×8, **40**, 60, 100 ×4 | non | frames 0–7 (800 ms) + `vfx_telegraph-96` ; **active 8** → anneau de `vfx_bars` | `auditeur_attack-stamp_strip14.png` | 1344×96 |
| `phase` | passage en phase 2 « Plan de transport optimisé » | 12 | 100 ×12 | non | écrans qui passent au magenta, télécommande sortie | `auditeur_phase_strip12.png` | 1152×96 |
| `idle-p2` | phases 2 et 3 | 6 | 100 ×6 | oui | — | `auditeur_idle-p2_strip6.png` | 576×96 |
| `move-p2` | phases 2 et 3 | 8 | 75 ×8 | oui | — | `auditeur_move-p2_strip8.png` | 768×96 |
| `command` | Commande des rames | 10 | 100 ×10 | non | **ordre frame 6** (le grand écran des départs lance le compte à rebours 3 s) | `auditeur_command_strip10.png` | 960×96 |
| `dash` | dash quai à quai (phase 3) | 6 | 130 ×4, **60**, **60** | frames 4–5 en boucle pendant le dash | chenilles **magenta** frames 0–3 (520 ms) ; **actives 4–5** ; laisse `vfx_kpi-trail` | `auditeur_dash_strip6.png` | 576×96 |
| `hurt` | coup reçu | 2 | 80, 80 | non | — | `auditeur_hurt_strip2.png` | 192×96 |
| `death` | défaite : le chrono s'arrête sur **7:12** | 20 | 100 ×19, 600 | non | dernière frame tenue ; `vfx_explosion-big` frame 12 | `auditeur_death_strip20.png` | 1920×96 |
| `stun` *(P2)* | bouclier brisé (chariot projeté, rame) | 6 | 150 ×6 | oui | à défaut : frame 1 de `hurt` tenue | `auditeur_stun_strip6.png` | 576×96 |

→ **13 fichiers, 126 frames** (+ 1 fichier / 6 frames optionnels). Effets du boss : `vfx_chrono-zone`, `vfx_bars`, `vfx_shield-boss`, `vfx_kpi-trail`, `vfx_telegraph-96` (§6). Les rames sont des props (§5.5).

**Anims optionnelles (P2)** : marquées *(P2)* ci-dessus ; le code utilise le repli indiqué tant qu'elles n'existent pas. Elles font partie du MVP (§10) mais ne bloquent pas une livraison.

### 4.6 Annexe post-MVP : ennemis, élite, boss 2 et boss final

Mêmes règles (§2), mêmes dossiers. Durées détaillées à fixer au lancement de chaque lot, à partir des timings du Game Design.

| Entité (fichiers `<entité>_*`) | Frame / pivot | Dir | Animations (frames ; **active**) |
|---|---|---|---|
| **Agent de Sécurité Externalisé** `securite` (tank, bouclier-badge) | 32 / (16, 28) | 3 (sauf death) | `idle` 4 · `walk` 6 · `prep` 4 (700 ms, badge **magenta**) · `charge` 4 (boucle, **actives 0–3**) · `open` 4 (bouclier baissé 1 s) · `block` 3 · `hurt` 2 · `death` 8 (1 dir) |
| **Pense-bête Vivant** `postit` (essaim invoqué) | **16** / (8, 14) | 1 | `spawn` 4 · `run` 4 · `stick` 4 (collé au héros) · `death` 4 |
| **Coach Agile « Le Facilitateur »** `coach` (élite) | 48 / (24, 44) | 3 (sauf mention) | `idle` 4 · `run` 6 · `summon` 10 (1 dir, invocation frame **7**) · `team` 12 (1 dir, télégraphe 1 s, **active 8**) · `retro` 8 (1 dir, boucle, canalisation 2 s) · `hurt` 2 · `death` 10 (1 dir) |
| **Boss 2 : Le Réorganisateur RH « le Fluidifieur »** `reorganisateur` | **96** / (48, 88) | 1 (sauf mention) | `intro` 12 · `idle` 6 · `move` 4 (3 dir, chaise à roulettes) · `charge` 6 (3 dir, **actives 3–5**) · `throw` 8 (classeur, lancer frame **5** → `proj-classeur_spin_strip4.png` 16) · `postit` 10 (damier, frame **6**) · `organigramme` 10 · `mutation` 12 (échange de positions, frame **9**) · `stun` 6 (« Article 47 ») · `phase` 12 · `hurt` 2 · `death` 18 |
| **Boss final : Jean-Cul Lurcke** `lurcke` | **128** / (64, 120) | 1 | P1 « Méga-Deck 2032 » : `idle` 6 · `ride` 6 (trottinette) · `attack-slides` 10 · `teleport` 8 (balayage d'écran) · `summon` 8 · `hurt` 2 — transition `phase2` 16 — P2 « Conseil d'Administration en visio » : `idle-p2` 8 · `attack-social` 14 (Plan social, zone) · `attack-mute` 10 · `hurt-p2` 2 — transition `phase3` 16 — P3 « L'Optimiseur Absolu » : `idle-p3` 6 · `attack-copy` 10 · `attack-jam` 12 · `hurt-p3` 2 · `final` 8 (coup final « Mais concrètement, sur le terrain, ça donne quoi ? ») · `death` 16 |
| **Clause-tentacule** `clause` (P2, 200 PV, 4 instances) | 48 / (24, 44) | 1 | `rise` 6 · `idle` 4 · `attack` 8 (**active 5**) · `death` 6 ; chaque Clause a sa couleur : 4 jeux de fichiers `clause-a` à `clause-d` (pas de `setTint`, qui sortirait de la palette) |

Contraintes : à 128 px, **16 frames au plus** par bande (2 048 px) ; à 96 px, 21 au plus. La « photocopie du joueur » (P3) réutilise les sprites du héros teintés par le moteur : aucun asset.

---

## 5. Tilesets, props, trains et couches de décor

### 5.1 Règles générales

- **Vue de dessus 3/4** (type HLD) : sols vus à plat ; murs = **dessus** (autotile) + **face de 2 tuiles (32 px)**. Portes de salle : 48 px de large × 48 px de haut. Refuser l'isométrique et la vue de profil.
- Tuiles **16×16**. Une feuille de biome = **256×256** (16 × 16 tuiles = 256 tuiles), **margin 0, spacing 0**. Si des coutures apparaissent au défilement, la variante extrudée est **générée** (`tile-extruder`, extrusion 1 → 288×288, `margin 1`, `spacing 2`, nom `<nom>-ext.png`), jamais dessinée à la main.
- **Lumière haut-gauche** ; ombres portées du décor décalées vers le **bas-droite**. Décor **sans contour noir** (sel-out uniquement, §7.3).
- **16 couleurs maximum par tileset**, prises dans la sous-palette du biome (§7.2).
- Variantes : 4 sols de base + 4 détails par biome ; un détail ne couvre jamais plus d'une tuile sur 6.
- **Aucun logo réel**, aucune police de signalétique ferroviaire réelle, aucun décalque de photo de gare réelle ; satire maison autorisée (« HORS SERVICE », « PROVISOIRE v14 », « Mons 2032 : une gare, zéro guichet »).

### 5.2 Autotiles : blob 47 (dessus de murs) et Wang 16 (transitions de sols)

**Wang « corner » 16** (rangée 1 de chaque feuille) : la tuile de la colonne `i` (0 à 15) a pour masque `i = NO×1 + NE×2 + SO×4 + SE×8`, où un bit à 1 signifie « ce coin est du **terrain secondaire** » (ballast pour les quais, traverses pour l'OCC). Colonne 0 = tout terrain principal, colonne 15 = tout terrain secondaire.

**Blob 47** (rangées 2 à 4) : voisins notés N=1, NE=2, E=4, SE=8, S=16, SO=32, O=64, NO=128 (bit à 1 = voisin de même type) ; un coin ne compte que si ses deux côtés adjacents sont à 1. Les 47 masques réduits sont rangés **dans l'ordre croissant**, de gauche à droite, rangée 2 puis 3 puis 4 (16 + 16 + 15), la 48e case reste **vide** :

`0, 1, 4, 5, 7, 16, 17, 20, 21, 23, 28, 29, 31, 64, 65, 68, 69, 71, 80, 81, 84, 85, 87, 92, 93, 95, 112, 113, 116, 117, 119, 124, 125, 127, 193, 197, 199, 209, 213, 215, 221, 223, 241, 245, 247, 253, 255`

(ex. rangée 2, colonne 0 = masque 0, îlot isolé ; rangée 4, colonne 14 = masque 255, plein.) Un pack au format « RPG Maker A2/A4 » ou « 3×3 + coins » doit être **réordonné** dans cet ordre avant livraison.

### 5.3 Organisation imposée d'une feuille de biome (256×256, rangées de 16 tuiles)

| Rangées | Contenu | Détail |
|---|---|---|
| 0 | sols | col. 0–3 : 4 bases ; 4–7 : 4 détails ; 8–11 : 4 sols spéciaux ; 12–15 : 4 sols secondaires |
| 1 | transitions | Wang corner 16 (§5.2) |
| 2–4 | dessus de murs | blob 47 + 1 case vide (§5.2) |
| 5–6 | faces de murs | col. 0–7 : gauche, milieu A, milieu B, milieu C, droite, porte gauche, porte droite, plinthe (rangée 5 = haut de la face, rangée 6 = bas) ; col. 8–15 : 16 tuiles de façade propres au biome |
| 7 | bords | col. 0–3 : côtés N, E, S, O ; 4–7 : coins extérieurs NO, NE, SE, SO ; 8–11 : coins intérieurs NO, NE, SE, SO ; 12–15 : terminaisons N, E, S, O |
| 8–10 | éléments linéaires | voies, câbles, joints (détail par biome ci-dessous) |
| 11–12 | détails au sol | fissures, taches, marquages, bouches d'aération, déchets |
| 13 | vide / contrebas | ce qui est hors arène (voie en tranchée, obscurité, bords de vide) |
| 14–15 | tuiles animées | **8 tuiles animées × 4 frames**, frames consécutives dans la rangée (col. 0–3, 4–7, 8–11, 12–15), 150 à 250 ms par frame |

### 5.4 Biome 1 : Quais & Voies (MVP) — `public/assets/tilesets/tiles_quais.png` (256×256)

Nuit, 4h47 à l'aube : béton, bleus nuit, rouille, néons froids, lampes sodium ponctuelles. Le danger vient de la voie : **les trains**.

| Rangées | Contenu exact |
|---|---|
| 0 | béton de quai ×4 ; détails (fissure, tache, plaque d'égout, chewing-gums) ×4 ; **dalles podotactiles** ×4 ; carrelage du passage sous voies ×4 |
| 1 | Wang quai (principal) ↔ ballast (secondaire) |
| 2–4 | dessus de murs : murets de quai, cloisons de l'abri, murs du souterrain (blob 47) |
| 5–6 | faces : béton peint, carrelage du souterrain ; façade : affiches satiriques ×4, vitrine d'abri ×2, guichet bâché ×2, porte de service ×2, distributeur encastré ×2, horloge murale ×2, plan du réseau ×2 |
| 7 | **bord de quai** avec **ligne de sécurité jaune `#FFD200`** (côtés, coins, terminaisons) |
| 8–10, col. 0–3 | rangée 8 : ballast ×4 ; rangées 9–10 : traverses seules ×2, caniveau ×2, câbles au sol ×4 |
| 8–10, col. 4–5 | **voie horizontale** (variantes A, B) : rangée 8 = haut de la bande, 9 = milieu, 10 = bas |
| 8–10, col. 6–8 | **voie verticale** (colonnes G, M, D) : rangée 8 = variante A, rangée 9 = variante B ; rangée 10 = heurtoir de voie verticale |
| 8–10, col. 9–11 | **croisement** 3×3 |
| 8–10, col. 12–15 | rangée 8 : **passage planchéié** horizontal (bout G, milieu A, milieu B, bout D) ; rangée 9 : passage vertical (bout N, milieu A, milieu B, bout S) ; rangée 10 : heurtoir de voie horizontale (haut, milieu, bas) + caténaire tombée au repos |
| 11–12 | marquages au sol « 1 » à « 4 », flèches de sortie, mégots, gobelets écrasés, journaux, tickets, taches d'huile, bouches d'aération, flaques sèches |
| 13 | voie en tranchée sombre, bords de vide, obscurité `#0B1F3A` |
| 14–15 | animées : néon qui grésille ; flaque à reflet ; **rails qui vibrent** (télégraphe de rame) ; brouillard bas ; lampe sodium qui clignote ; écran publicitaire ; ventilation ; eau qui goutte |

**Géométrie d'une voie** : bande de **3 tuiles (48 px)** de ballast ; rails aux lignes y = 10 et y = 37 de la bande (horizontale) ou x = 10 et x = 37 (verticale) ; traverses tous les 8 px. Une rame (48 px de large) couvre exactement la bande. Aiguillages et voies diagonales (salle « Faisceau / triage ») : post-MVP, feuille complémentaire `tiles_quais-b.png` au même format.

### 5.5 Trains vus de dessus et props interactifs du biome 1 (MVP)

Dossier `public/assets/tilesets/`. Les trains sont des **images statiques** déplacées par le moteur (rame à quai = mur mobile ; rame qui passe = danger mortel pour les ennemis non élites, 40 % des PV du joueur).

| Fichier | Dimensions | Frames | Durées | Contenu |
|---|---|---|---|---|
| `train_motrice.png` | 192×48 | 1 | — | toit, pantographe, climatisation, **cabine à droite** (sens est ; ouest = `flipX`) ; livrée générique **sans logo** |
| `train_voiture.png` | 192×48 | 1 | — | voiture intermédiaire, 2 portes par côté (portes du côté bas visibles) |
| `train-porte_open_strip4.png` | 128×32 | 4 | 80 ×4 | porte latérale qui s'ouvre (les consultants descendent) |
| `porte-quai_idle_strip2.png` | 96×48 | 2 | 400 ×2 | portique de sortie fermé, mini-écran des départs, **feu rouge** qui clignote |
| `porte-quai_open_strip6.png` | 288×48 | 6 | 80 ×6 | feu vert, barrière qui s'ouvre (« ding-dong ») ; texte du mini-écran ajouté par `font_led` |
| `signal_state_strip3.png` | 96×32 | 3 | (états) | signal lumineux 16×32 dans une frame 32 : 0 vert, 1 orange, 2 rouge (pas de magenta : c'est un décor ; le danger est porté par `rails qui vibrent`) |
| `catenaire_arc_strip6.png` | 192×32 | 6 | 60 ×6 | fil à terre : 0–1 repos, 2–5 arc électrique **magenta + blanc** (danger) |
| `chariot_roll_strip4.png` | 128×32 | 4 | 60 ×4 | chariot à bagages projeté (roues, valises qui tremblent) |
| `portique_idle_strip4.png` | 128×32 | 4 | 150 ×4 | tourniquet « de rentabilité » Privatix, LED turquoise |
| `portique_break_strip6.png` | 192×32 | 6 | 70 ×6 | tourniquet cassé |
| `abri_break_strip6.png` | 288×48 | 6 | 70 ×6 | abri de quai vitré détruit (couverture destructible) |
| `poubelle_break_strip5.png` | 160×32 | 5 | 70 ×5 | poubelle renversée |
| `distributeur_break_strip6.png` | 288×48 | 6 | 70 ×6 | distributeur de boissons fracassé |
| `friterie_idle_strip4.png` | 256×64 | 4 | 200 ×4 | **Friterie de Raymonde** (boutique en run), fumée, cornet géant |
| `ecran-departs.png` | 96×32 | 1 | — | grand écran des départs de l'arène du boss (texte par `font_led`) |

**Atlas de props statiques** `props_quais.png` 256×256 + `props_quais.json` (Phaser **JSON Hash**, padding 2, sans trim, noms = `<prop>` en kebab-case, pivot bas-centre) : banc 32×16 et 16×32 ; banc de Marcel 32×16 ; poubelle 16×16 ; distributeur 32×48 ; borne de compostage 16×32 ; panneau « Voie 1…4 » 32×16 ; horloge de quai 16×32 ; pilier 32×48 ; extincteur 16×16 ; cône 16×16 ; barrière de travaux 32×16 ; valise ×2 16×16 ; chariot à bagages 32×16 ; poteau de caténaire 16×48 ; abri de quai 48×48 ; panneau Privatix « Mons 2032 » 32×32 ; trappe au sol 32×16 ; sac de sable 16×16.

### 5.6 Hub : l'OCC (MVP) — `public/assets/tilesets/tiles_occ.png` (256×256)

Ancienne sous-station sous la passerelle : voûte de briques, néons tièdes, bois, cuivre, ambre ; sécurité et chaleur (seul lieu à dominante chaude).

| Rangées | Contenu exact |
|---|---|
| 0 | béton ×4 ; détails ×4 ; **traverses de bois** au sol ×4 ; carrelage du coin café ×4 |
| 1 | Wang béton (principal) ↔ traverses (secondaire) |
| 2–4 | dessus de murs : **voûte de briques** (blob 47) |
| 5–6 | faces : briques montoises ; façade : photos jaunies de cheminots ×4, **plaque des 7 commandements** (2 tuiles), carte du réseau (2), tableau de liège à fils rouges (2), porte blindée « 7-1-2 » (2), casiers (2), étagère à lanternes (2) |
| 7 | rebord de l'ancien quai de service (marches, côtés, coins, terminaisons) |
| 8–10 | rails désaffectés noyés dans le sol, tuyaux et câbles muraux, guirlandes (rénovations), tapis long |
| 11–12 | taches de café, sciure, tickets, outils, câbles enroulés, flaques d'huile |
| 13 | obscurité `#2B1A12`, fond de voûte |
| 14–15 | animées : lanterne, vapeur, néon tiède, ampoule qui oscille, feu de poêle, horloge, goutte, guirlande |

**Props interactifs du hub** (`public/assets/tilesets/`) : `lanterne_idle_strip4.png` 64×16 (4 × 16, 150 ms) ; `mannequin_hit_strip4.png` 128×32 (mannequin de formation de Josiane, 4 × 60 ms) ; `porte-occ_open_strip6.png` 288×48 (porte de départ du Shift, 6 × 80 ms).

**Atlas** `props_occ.png` 256×256 + `props_occ.json` : comptoir café 48×32 ; canapé de Fatou 48×32 ; table + tasses 32×32 ; étagère de lanternes 32×48 ; casiers 32×48 ; **Tableau de Lutte** (liège géant de Marcel) 64×48 ; tableau des roulements de Yasmina 48×32 ; établi de Kevin 48×32 ; guichet de Béné 48×32 ; écran des départs de Rudy 48×32 ; radio 16×16 ; poêle 32×32 ; caisses 16×16 et 32×32.

### 5.7 Tuiles communes (MVP) — `public/assets/tilesets/tiles_commun.png` (128×128, 8 × 8 tuiles)

| Rangées | Contenu |
|---|---|
| 0–1 | **16 formes d'ombre portée** du décor (bas de mur, coins, pied de pilier, ombre de banc, de train…), `#0B1F3A` opaque, décalées vers le bas-droite |
| 2 | vide noir, vide bleu nuit, vide espresso, 5 réservées |
| 3 | tuiles de debug (collision, danger, spawn, sortie) : **jamais affichées en jeu** |
| 4–7 | réservées (transparentes) |

### 5.8 Couches de décor (Tiled ; même ordre pour les gabarits ASCII du MVP)

| Calque (nom exact) | Type | Rôle | Rendu |
|---|---|---|---|
| `sol` | tuiles | sols, transitions | depth 0 |
| `sol_details` | tuiles | détails, marquages | depth 1 |
| `dangers` | tuiles | voies, vides, tranchées (propriété `danger` : `voie` ou `vide`) ; ce ne sont pas des murs | depth 1 |
| `ombres` | tuiles (`tiles_commun`) | ombres portées du décor | depth 2, opacité 0,4 (OCC : 0,45 en `#2B1A12`) |
| `murs` | tuiles | dessus et faces de murs, bords ; propriété `collides: true` | depth 10 ; acteurs et props hauts triés par Y des pieds |
| `objets` | objets | `spawn`, `enemy-spawn`, `porte-n/e/s/o`, `prop`, `light`, `piege`, `declencheur`, `train` | lu par le code |
| `deco_haute` | tuiles | hauts de murs du premier plan, auvents, arcs (biome 2) | depth 1 000 |
| (moteur) lumières | sprites `light_*` | halos additifs | `ADD`, alpha 0,3 à 0,6 |
| (moteur) ambiance | rectangle plein écran | teinte du roulement (Matin, Après-midi, Nuit) | `MULTIPLY` |

### 5.9 Annexe post-MVP : biomes 2 et 3

| Fichier(s) | Biome | Contenu spécifique (même organisation §5.3) |
|---|---|---|
| `tiles_passerelle.png` + `props_passerelle.png/.json` | **La Passerelle** (aube, blanc et acier, vent) | résine blanche de passerelle, joints ; **garde-corps vitrés** (bords = vide) ; vide sur les voies en contrebas, assombri (rangée 13) ; pieds des **grands arcs blancs** (dessus des arcs dans `deco_haute`) ; ombres d'arcs et de verrière en grille (`ombres`) ; animées : **dalle de verrière qui se fissure** (4 frames), **escalators** (2 sens), lignes de vent au sol, papiers qui volent ; props : panneaux Privatix destructibles, ascenseur vitré, bancs, poubelles, pigeon « Matricule 4412 » (`pigeon_idle_strip4.png` 16, dans `sprites/npcs/`) |
| `tiles_hall-bag.png` + `props_hall-bag.png/.json` | **Hall & BAG** (clinique, néons blancs) | bois clair du hall historique (salles 1–2), **moquette grise**, marbre, **cloisons vitrées** (blob 47), portiques à badge (laser **magenta** animé), sols d'open-space, salle « Synergie » ; animées : écran de KPI, néon, laser de portique, **cloison mobile** (flèches lumineuses) ; props : îlots de bureaux 64×32, chaises à roulettes (projectiles), **photocopieuses** (tourelles), plantes en plastique, écrans de visio, rayonnages d'archives, ascenseurs |

Aucun élément ne doit permettre d'identifier un bâtiment réel ou son architecte : proportions réinventées, pas de décalque.

---

## 6. VFX, projectiles, pickups, ombres, lumières, UI, polices, portraits et PNJ

### 6.1 Règles des VFX et projectiles

- **Pas de contour** sur les VFX, **pas de normal map**. **Noyau blanc `#FFFFFF` + une rampe de 3–4 teintes** de la même famille (ex. joueur : 40 jaune éclat → 23 → 19 → 22 ; menace : 45 → 29 → 44). Style Dead Cells : généreux et lumineux (flash blanc sur la 1re frame d'un impact ou d'une explosion, halo en anneau, étincelles à tête blanche, fumée froide qui se dissout par grains), paliers nets, jamais de dégradé lisse.
- VFX du **joueur** : blanc, orange 22, ambre 19, jaune 23. Ce qui **blesse le joueur** : **magenta 29 + blanc**. Effets ennemis non offensifs (apparition, mort, bouclier, aura) : turquoise 25/26.
- **Rotations** : uniquement par multiples de 90° et miroirs (sans perte), autour du pivot indiqué. Rotation libre tolérée seulement pour les projectiles ≤ 16 px et les particules.
- Durée par frame des impacts : 33 à 60 ms (nerveux mais lisible). Toutes les durées ci-dessous sont des valeurs de départ, ajustables en jeu sans redessiner.
- Les **cercles de télégraphe de rayon variable** (Coup de sifflet, zones des élites) sont tracés par le moteur (anneau 1 px magenta + remplissage tramé) ; seuls les tailles fixes ci-dessous sont des PNG.

### 6.2 VFX et projectiles du MVP — `public/assets/sprites/vfx/`

| Fichier | Frame | N | Durées (ms) | Pivot | Usage |
|---|---|---|---|---|---|
| `vfx_slash-e_strip5.png` | 80 | 5 | 33 ×5 | (16, 40) = centre du héros | coups 1 et 2, arc de rayon 40 dessiné vers l'**est** ; N, O, S par rotation de 90° ; coup 2 = miroir vertical |
| `vfx_slash-se_strip5.png` | 80 | 5 | 33 ×5 | (20, 20) | arc diagonal (sud-est) ; NE, NO, SO par rotation et miroir → 8 directions avec 2 dessins |
| `vfx_slam-e_strip7.png` | 96 | 7 | 40 ×7 | (8, 48) | coup 3 : bande 56×28 devant le héros + cratère de rayon 20 à +56 px, gravats |
| `vfx_slam-se_strip7.png` | 96 | 7 | 40 ×7 | (12, 12) | coup 3 en diagonale |
| `vfx_thrust-e_strip4.png` | 80 | 4 | 40 ×4 | (8, 40) | estoc du dash-attaque, bande 64×20 |
| `vfx_thrust-se_strip4.png` | 80 | 4 | 40 ×4 | (12, 12) | estoc en diagonale |
| `vfx_hit_strip5.png` | 32 | 5 | 33 ×5 | centre | impact standard (étoile blanche, éclats orange) |
| `vfx_hit-big_strip6.png` | 48 | 6 | 40 ×6 | centre | impact du coup 3 et des critiques |
| `vfx_dash_strip5.png` | 32 | 5 | 40 ×5 | centre | bouffée de départ du dash (dessinée vers l'est) |
| `vfx_dust_strip5.png` | 16 | 5 | 60 ×5 | (8, 15) | pas de course, freinages |
| `vfx_dust-land_strip6.png` | 32 | 6 | 60 ×6 | (16, 31) | atterrissage, spawn, pas lourds du boss |
| `vfx_sparks_strip4.png` | 16 | 4 | 40 ×4 | centre | clé contre métal (Borne, Drone, estrade du boss) |
| `vfx_particles_strip12.png` | 8 | 12 | (textures) | centre | 0 pixel 2×2, 1 étincelle, 2 braise, 3 éclat de verre, 4 confetti de ticket, 5 goutte de café, 6 fumée, 7 grain de café, 8 feuille de papier, 9 boulon, 10 slide turquoise, 11 pense-bête |
| `vfx_explosion_strip10.png` | 64 | 10 | 50 ×10 | centre | explosion d'automate (pièces, tickets, fumée) |
| `vfx_explosion-big_strip12.png` | 128 | 12 | 60 ×12 | centre | mort du boss |
| `vfx_shockwave_strip8.png` | 160 | 8 | 40 ×8 | centre | **Coup de sifflet** : anneau blanc/ambre, rayon 8 → 72 px, poussière |
| `vfx_shockwave-big_strip8.png` | 256 | 8 | 45 ×8 | centre | **Préavis de grève** : rayon 8 → 120 px, mégaphone stylisé au centre |
| `vfx_charge_strip6.png` | 48 | 6 | 60 ×6 (boucle) | centre | maintien du Préavis (cercle ambre qui se resserre) |
| `vfx_spawn-player_strip8.png` | 64 | 8 | 60 ×8 | (32, 60) | colonne de lumière ambre (Prise de poste) |
| `vfx_spawn-privatix_strip8.png` | 64 | 8 | 75 ×8 | (32, 60) | « téléportation corporate » turquoise des ennemis (600 ms) |
| `vfx_poof_strip7.png` | 32 | 7 | 50 ×7 | centre | mort d'ennemi : dissolution en slides turquoise |
| `vfx_telegraph-32_strip4.png` | 32 | 4 | 100 ×4 (boucle) | centre | zone d'attaque ennemie (anneau magenta) |
| `vfx_telegraph-96_strip4.png` | 96 | 4 | 100 ×4 (boucle) | centre | zone d'impact du boss |
| `vfx_telegraph-line_strip4.png` | 16 | 4 | 80 ×4 (boucle) | (0, 8) | segment de ligne de visée ou de charge, répété en TileSprite |
| `vfx_reward_strip8.png` | 48 | 8 | 50 ×8 | centre | ouverture de récompense (éclat ambre + grains) |
| `vfx_heal_strip6.png` | 32 | 6 | 60 ×6 | (16, 28) | Gobelet bu : éclats verts 32 + blancs |
| `vfx_steam_strip6.png` | 16 | 6 | 80 ×6 (boucle) | (8, 15) | Pétage de plombs : vapeur qui sort du casque |
| `vfx_strike-sign_strip4.png` | 16 | 4 | 150 ×4 (boucle) | (8, 15) | ennemi étourdi « En grève » : pancarte au poing levé (sans texte) |
| `vfx_mark_strip4.png` | 16 | 4 | 120 ×4 (boucle) | (8, 15) | héros marqué par le Drone : viseur magenta au-dessus de la tête |
| `vfx_scan-cone_strip4.png` | 64 | 4 | 100 ×4 (boucle) | (32, 0) = sommet du cône | cône de scan du Drone, dessiné vers le **sud**, trame 50 % magenta |
| `vfx_shield_strip6.png` | 48 | 6 | 100 ×6 (boucle) | centre | bulle « Réunion d'alignement » sur un ennemi (turquoise néon) |
| `vfx_shield-break_strip5.png` | 48 | 5 | 50 ×5 | centre | bulle brisée |
| `vfx_shield-boss_strip6.png` | 128 | 6 | 100 ×6 (boucle) | centre | bulle du boss |
| `vfx_chrono-zone_strip4.png` | 64 | 4 | 200 ×4 (boucle) | centre | cercle-chronomètre au sol (cadran + aiguille magenta) |
| `vfx_bars_strip8.png` | 32 | 8 | 50 ×8 | (16, 31) | barre de graphique qui jaillit du sol (magenta + blanc) ; anneaux et lignes composés par le moteur |
| `vfx_kpi-trail_strip4.png` | 16 | 4 | 100 ×4 (boucle) | centre | segment de traînée de KPI au sol (TileSprite, 3 s) |
| `vfx_elite-aura_strip6.png` | 64 | 6 | 100 ×6 (boucle) | (32, 60) | aura d'élite : contour pulsant turquoise néon |
| `proj-ticket_spin_strip4.png` | 16 | 4 | 60 ×4 (boucle) | centre | ticket de la Borne : **magenta** saturé, noyau blanc |
| `proj-ticket_pop_strip4.png` | 16 | 4 | 40 ×4 | centre | ticket détruit (confettis) |
| `proj-ribbon_strip4.png` | 16 | 4 | 50 ×4 (boucle) | (0, 8) | segment du **ruban de caisse** tendu (ruban-laser de la Borne, TileSprite) |
| `proj-bille_spin_strip4.png` | 8 | 4 | 60 ×4 (boucle) | centre | bille du Drone |
| `proj-bille_pop_strip4.png` | 16 | 4 | 40 ×4 | centre | bille détruite |

Effets **non dessinés** (moteur) : flash blanc de coup, clignotement d'invulnérabilité, images rémanentes du dash, afficheur « +5 min » / « +15 min » (texte `font_led`), nombres de dégâts (`font_dmg`), secousses, ralentis, teinte rouge du Pétage de plombs.

### 6.3 Ombres au sol — `public/assets/sprites/vfx/` (images statiques)

| Fichier | Dimensions | Utilisé par |
|---|---|---|
| `shadow_s.png` | 16×6 | ennemis 32, PNJ, Drone, pickups 16 |
| `shadow_m.png` | 24×8 | héros |
| `shadow_l.png` | 32×10 | élites |
| `shadow_xl.png` | 64×16 | boss 96 |
| `shadow_xxl.png` | 96×24 | boss 128 (post-MVP) |

Ellipse **pleine** `#14101A`, pixel art (pas d'ellipse lissée), opacité 0,5 par le moteur (§2.3), centrée sur le pivot, non directionnelle.

### 6.4 Lumières — `public/assets/tilesets/` (images statiques, exception d'alpha §2.3)

| Fichier | Dimensions | Usage |
|---|---|---|
| `light_round-64.png` | 64×64 | lampes, lanternes, néons |
| `light_round-128.png` | 128×128 | lampadaires, lampes sodium, hub |
| `light_cone-64.png` | 64×64 | phares de rame, lampes orientées (cône vers le sud, pivot (32, 0)) |
| `light_halo-320.png` | 320×320 | halo de 160 px autour du héros (roulement de Nuit) |

Blanc → gris neutre en **3 ou 4 paliers concentriques à bords nets** (tramage 50 % autorisé à la transition), teinte par `setTint`, mode additif.

### 6.5 Pickups et coffres — `public/assets/sprites/pickups/`

| Fichier | Frame | N | Durées (ms) | Objet |
|---|---|---|---|---|
| `pickup-ticket_spin_strip6.png` | 16 | 6 | 80 ×6 | **Tickets** (monnaie de run) |
| `pickup-grain_spin_strip6.png` | 8 | 6 | 80 ×6 | **Grains de café** (méta) |
| `pickup-gobelet_idle_strip4.png` | 16 | 4 | 150 ×4 | **Gobelet** de café (soin), vapeur |
| `pickup-piece_idle_strip4.png` | 16 | 4 | 150 ×4 | **Pièces détachées** (boulon et engrenage) |
| `pickup-preuve_idle_strip6.png` | 16 | 6 | 100 ×6 | **Preuve** (dossier « PHR-2032 ») |
| `pickup-tasse_idle_strip4.png` | 16 | 4 | 150 ×4 | **Tasse** (relations) |
| `pickup-ps_idle_strip6.png` | 16 | 6 | 100 ×6 | **Points de Syndicalisme** (badge syndical) |
| `pickup-reglage_idle_strip6.png` | 16 | 6 | 100 ×6 | **Réglage de clé** (clé à molette ambre) |
| `pickup-radio_idle_strip6.png` | 32 | 6 | 100 ×6 | **Avantage acquis** : talkie-walkie qui grésille sur socle (emblème de famille affiché par l'UI) |
| `chest-cafe_idle_strip6.png` | 32 | 6 | 150 ×6 | machine à café abandonnée (salle Café), vapeur |
| `chest-cafe_open_strip8.png` | 32 | 8 | 70 ×8 | ouverture → `vfx_reward` |
| `consigne_open_strip6.png` | 32 | 6 | 70 ×6 | consigne à bagages qui s'ouvre (salle trésor) |

Récompenses en ambre 19, crème 18 et vert 32 ; reflet clair 1 px ; rebond de 2 px fait par le moteur (non dessiné).

### 6.6 Interface — `public/assets/sprites/ui/` (1 texel = 1 px)

| Fichier | Dimensions / frames | Ordre des frames et notes |
|---|---|---|
| `ui_energy-frame.png` / `ui_energy-fill.png` / `ui_energy-ghost.png` | 104×12 / 100×8 / 100×8 | **Énergie** (vie) : remplissage rouge 28 liseré orange ; « fantôme » crème qui rattrape la perte (`setCrop`) |
| `ui_burnout-frame.png` / `ui_burnout-fill.png` | 104×10 / 100×6 | **Burnout** violet 30, repères gravés à 30, 60 et 90 |
| `ui_burnout-crit.png` | 16×6 | motif rayé défilant (TileSprite) au-delà de 90 |
| `ui_burnout-tiers_strip5.png` | 5 × 16 = 80×16 | 0 Frais, 1 Sous pression, 2 Au bord, 3 Au bout du rouleau, 4 Pétage de plombs |
| `ui_mobil-frame.png` / `ui_mobil-fill.png` | 76×8 / 72×4 | **Mobilisation** (ambre), repère à 50 |
| `ui_dash-pip_strip3.png` | 3 × 8 = 24×8 | 0 plein, 1 vide, 2 en recharge |
| `ui_gobelet_strip3.png` | 3 × 16 = 48×16 | 0 plein, 1 vide, 2 verrouillé (Pétage de plombs) |
| `ui_boss-frame.png` / `ui_boss-fill.png` / `ui_boss-mark.png` | 320×14 / 316×6 / 2×10 | barre de boss, repères de phase ; nom au-dessus en `font_title` |
| `ui_clock.png` | 56×16 | cadran de l'**horloge du Shift** (chiffres en `font_led`) |
| `ui_shift_strip3.png` | 3 × 16 = 48×16 | 0 Matin, 1 Après-midi, 2 Nuit |
| `ui_avantages_strip21.png` | 21 × 16 = 336×16 | Avantages acquis : 3 par famille, dans l'ordre des familles ci-dessous |
| `ui_families_strip7.png` | 7 × 16 = 112×16 | 0 Contrôle des titres (Josiane), 1 Coup de sifflet (Rudy), 2 Guichet (Béné), 3 Régulation (Yasmina), 4 Caténaire (Kevin), 5 Prévention (Fatou), 6 D'antan (Marcel) |
| `ui_reglages_strip8.png` | 8 × 16 = 128×16 | Réglages de clé : dégâts, vitesse, portée, critique, recul, étourdissement, électricité, café |
| `ui_rarity_strip4.png` | 4 × 20 = 80×20 | cadres : 0 Standard (acier), 1 Ancienneté (bleu signal), 2 Statutaire (violet 30), 3 Acquis historique (ambre + rouge 28) |
| `ui_res_strip10.png` | 10 × 8 = 80×8 | 0 Tickets, 1 Grains, 2 PS, 3 Pièces, 4 Tasse, 5 Preuve, 6 Gobelet, 7 Énergie, 8 Burnout, 9 horloge |
| `ui_door-reward_strip12.png` | 12 × 16 = 192×16 | récompense annoncée sur la porte : 0 Avantage, 1 Réglage, 2 Gobelet, 3 Tickets, 4 Grains, 5 Pièces, 6 Preuve, 7 Élite, 8 Boutique (cornet de frites), 9 Événement, 10 Repos (banc + thermos), 11 Boss |
| `ui_cursor_strip4.png` | 4 × 16 = 64×16 | curseur de visée **jaune 23** + contour sombre : 0 repos, 1 ennemi survolé, 2–3 recul au coup |
| `ui_prompt_strip4.png` | 4 × 16 = 64×16 | invite d'interaction : 0 touche E, 1 bouton A, 2 clic, 3 toucher |
| `ui_panel-occ.png` / `ui_panel-privatix.png` | 24×24 | 9-slice, bords 8 px (dialogues OCC chaleureux / écrans Privatix froids) |
| `ui_card.png` | 32×32 | 9-slice, bords 10 px (cartes de choix 112×144) |
| `ui_button_strip3.png` | 3 × 24 = 72×24 | 9-slice bords 8 px : 0 normal, 1 survol, 2 pressé |
| `ui_logo.png` | 256×96 | logo du jeu (menu principal), marque fictive uniquement |

### 6.7 Polices bitmap — `public/assets/fonts/`

| Fichier | Format | Contenu | Source recommandée |
|---|---|---|---|
| `font_body.png` + `font_body.xml` | BMFont XML, PNG ≤ 256×128 | texte courant, glyphes ~5×7 à 6×11, interligne 11 px ; Latin-1 + `’ « » … € œ Œ` | m5x7 ou m6x11 (Daniel Linssen, crédit demandé : relire la page) |
| `font_title.png` + `font_title.xml` | BMFont XML, PNG ≤ 256×256 | titres, noms de boss, glyphes **natifs** de 12 à 16 px de haut (jamais une police 8 px agrandie ×2) | police pixel native 16 px sous licence OFL ou CC0 |
| `font_dmg.png` | RetroFont, 84×9 | 12 cellules 7×9 avec contour 1 px : `0123456789-!` | dessin maison ou dérivé d'une police OFL |
| `font_led.png` + `font_led.xml` | BMFont XML, PNG ≤ 256×64 | afficheur de quai à points 5×7, **majuscules** A–Z, 0–9, `+ - : . ' / → É È À Ç`, minuscules `h m i n` | dessin maison (« Palettes ») |

Export **en blanc**, sans anticrénelage ; couleur par `setTint` (critiques jaune 23, dégâts subis rouge 28, soin vert 32). Conversion TTF → BMFont : SnowB BMF, Hiero ou BMFont avec le lissage **désactivé**.

### 6.8 Portraits de dialogue — `public/assets/sprites/portraits/`

`portrait_<nom>_strip3.png`, **3 frames de 64×64 = 192×64** : 0 neutre, 1 sourire / ironie, 2 colère / inquiétude. Buste de trois quarts tourné vers la droite (miroir autorisé : pas de texte), contour 1 px `#14101A`, 16 couleurs au plus, fond transparent ; affiché à 1× dans un cadre 9-slice de 72×72.

MVP (11) : `player`, `marcel`, `jean-mi`, `josiane`, `rudy`, `fatou`, `kevin`, `bene`, `yasmina`, `raymonde`, `auditeur`. Post-MVP : `jean-mi-taupe`, `fantome`, `reorganisateur`, `lurcke`, `hubert` (silhouette de visio, caméra éteinte).

### 6.9 PNJ du hub et de run — `public/assets/sprites/npcs/`

Frame 32×32, pivot (16, 28), **1 direction** (`down`), deux bandes par PNJ : `<pnj>_idle_strip4.png` (128×32, 200 ms, boucle) et `<pnj>_talk_strip4.png` (128×32, 120 ms, boucle).

| PNJ (nom de fichier) | Station | Signe distinctif |
|---|---|---|
| `marcel` | Tableau de Lutte | « Pépé Rail », casquette, pipe éteinte |
| `jean-mi` | comptoir café | barista, tablier, badge (vert après la révélation : post-MVP) |
| `josiane` | mannequin de formation | accompagnatrice, sacoche, thermos |
| `rudy` | écran des départs | chef de quai, sifflet, palette de départ |
| `fatou` | infirmerie / canapé | prévention, trousse, gilet de secours |
| `kevin` | établi | « technicien de l'Infra », casque à lampe, câbles |
| `bene` | guichet | guichetière, lunettes, tampon |
| `yasmina` | tableau des roulements / radio | casque radio, planning |
| `raymonde` | Friterie (en run) | tablier, épuisette à frites |

Plus `vieille-dame_idle_strip4.png` (128×32, 200 ms) : **la Vieille Dame**, cafetière de 1987 animée (vapeur, voyant). Post-MVP : `fantome_{idle,talk}_strip4.png` (Fantôme du Wagon-Bar, bleu ciel 11 et crème 18, sans turquoise), `pigeon_{idle,fly}_strip4.png` (frame **16**, « Matricule 4412 »).

---

## 7. Palette « Privatix Moderne 57 » et lisibilité

### 7.1 Palette maître (fichier de référence `tools/pixelart/privatix32.gpl`, nom historique conservé ; à défaut, ce tableau fait foi)

57 couleurs : les **32 couleurs historiques** (n° 01–32, rôles de lecture inchangés) et **25 tons de rampe** (n° 33–57) qui donnent à chaque matériau 4 à 8 tons à **décalage de teinte**. Le générateur (`tools/pixelart/palette.py`) associe à chaque couleur une lettre et une rampe ; ses voisins « plus sombre » / « plus clair » servent à l'éclairage, au sel-out et à l'occlusion.

| # | Hex | Nom | Rôle |
|---|---|---|---|
| 01 | `#14101A` | Contour sombre | contours des acteurs, ombres au sol (jamais `#000000`) |
| 02 | `#2A3040` | Acier sombre | ombre de la clé, costumes, rails |
| 03 | `#4E5668` | Acier | clé, rails, mobilier métallique |
| 04 | `#7D828C` | Béton ombre | sols, costumes gris |
| 05 | `#9FB0C6` | Gris ballast | béton clair, ombre des bandes réfléchissantes |
| 06 | `#F4F6F8` | Blanc affiche | chemises, arcs, bandes réfléchissantes |
| 07 | `#FFFFFF` | Blanc pur | **acteurs et VFX uniquement** : flash, noyaux d'impact, spéculaire |
| 08 | `#0B1F3A` | Bleu nuit quai | fonds de nuit, ombres portées du décor |
| 09 | `#123C73` | Bleu institution | pantalon du héros, signalétique |
| 10 | `#1F5AA6` | Bleu signal | signalétique, rareté Ancienneté |
| 11 | `#5FA8E8` | Bleu ciel caténaire | reflets, néons froids |
| 12 | `#9CC7D9` | Verre / verrière | vitrages, écrans du décor |
| 13 | `#2B1A12` | Espresso | ombres de l'OCC |
| 14 | `#4A2E1F` | Café torréfié | bois sombre, cheveux |
| 15 | `#7A4E33` | Moka | traverses, peau (ombre) |
| 16 | `#A8734A` | Noisette | bois clair, peau |
| 17 | `#E3A982` | Peau claire / cuivre | peau, cuivre des lanternes |
| 18 | `#F2E6CF` | Crème | papier, mousse, texte de l'OCC |
| 19 | `#F2A541` | Ambre lampe | lampes sodium, lumières de l'OCC, VFX du joueur, récompenses |
| 20 | `#8A3B2E` | Brique montoise | briques, rouille |
| 21 | `#B8470F` | Gilet ombre | ombre du gilet du héros |
| 22 | `#FF7A1A` | **Gilet orange** | **réservé au héros**, à ses VFX et aux alliés |
| 23 | `#FFD200` | Jaune quai | ligne de sécurité, curseur, critiques |
| 24 | `#0A4F4C` | Turquoise profond | ombre turquoise ; seule teinte turquoise permise au décor |
| 25 | `#19C3B1` | **Turquoise Disruption** | **signature des ennemis Privatix** |
| 26 | `#8FF5E4` | Turquoise néon | LED, écrans ennemis, aura d'élite |
| 27 | `#8E1F28` | Rouge sombre | ombres rouges, moquette de direction |
| 28 | `#C8323C` | Rouge rebelle | OCC, Énergie, dégâts subis, signal rouge |
| 29 | `#FF3EA5` | **Magenta menace** | **tout ce qui blesse le joueur** : projectiles, télégraphes, LED d'attaque |
| 30 | `#B48CFF` | Violet burnout | jauge de Burnout, rareté Statutaire |
| 31 | `#1E5B3A` | Vert signal sombre | plantes, ombre des signaux |
| 32 | `#5BD17A` | Vert soin / feu vert | soins, feu vert |
| 33 | `#1C1A2E` | Abysse violet | ombre la plus profonde de l'acier (jamais du noir pur) |
| 34 | `#D3DEEA` | Acier reflet | rehaut froid de l'acier, de la clé, des rails |
| 35 | `#6E1F33` | Gilet creux | ombre profonde du gilet (orange → bordeaux) |
| 36 | `#FFA244` | Gilet lumière | gilet éclairé |
| 37 | `#FFD98C` | Gilet éclat | rehaut chaud du gilet, bord du smear |
| 38 | `#FBD3A6` | Peau éclat | rehaut de peau, bois clair |
| 39 | `#9C4A1C` | Ambre creux | ombre de l'ambre / du jaune |
| 40 | `#FFF3A8` | Jaune éclat | cœur chaud des VFX, LED d'affichage |
| 41 | `#10877F` | Turquoise moyen | ombre de la turquoise ennemie |
| 42 | `#DFFFF8` | Turquoise éclat | cœur des émissifs ennemis |
| 43 | `#5E1242` | Magenta creux | ombre du magenta |
| 44 | `#B81E7E` | Magenta moyen | bord de traînée / d'explosion menaçante |
| 45 | `#FF99D2` | Magenta éclat | halo du magenta (avec noyau blanc) |
| 46 | `#4A1427` | Rouge creux | ombre profonde du rouge |
| 47 | `#F2675E` | Rouge éclat | rehaut de l'écharpe, des rouges |
| 48 | `#2F9A5C` | Vert moyen | ton intermédiaire des verts |
| 49 | `#4A3388` | Violet creux | ombre du violet |
| 50 | `#4A1D22` | Brique creux | joints et ombres des briques de l'OCC |
| 51 | `#B65A3A` | Brique lumière | briques éclairées par les lanternes |
| 52 | `#131C33` | Quai creux | ballast, ombres du sol de nuit |
| 53 | `#222F4D` | Quai ombre | joints, dessus de murs des quais |
| 54 | `#33446A` | Quai base | ombre propre des dalles |
| 55 | `#475C87` | Quai lumière | **valeur moyenne du sol des quais** |
| 56 | `#6B84B0` | Quai reflet | biseau éclairé, reflets humides |
| 57 | `#6FD6FF` | Néon rim | **rim light des acteurs**, tubes néon du décor (émissif) |

Rampes (sombre → clair) : acier 33·02·03·04·05·34·06·07 ; bleu 08·09·10·11·12 ; sol des quais 52·53·54·55·56 ; chaud (bois, café, peau) 13·14·15·16·17·38 ; gilet 35·21·22·36·37 ; ambre 39·19·23·40 ; turquoise 24·41·25·26·42 ; magenta 43·44·29·45 ; rouge 46·27·28·47 ; vert 31·48·32 ; violet 49·30 ; brique 50·20·51. Raccords : l'ombre de la crème 18 est le gris bleuté 05 (ombre froide), l'éclat de chaque rampe chaude tend vers le jaune.

Couleur modifiée : la 04 passe de `#7D828C` (gris neutre) à `#737E98` (acier clair bleuté) pour que l'ombre ne soit jamais grise neutre.

Les teintes indicatives des notes de narration (violet Privatix `#7B5CFF`, ciels d'aube, moquettes) **ne sont pas** dans la palette : elles sont remappées sur les couleurs ci-dessus (turquoise pour ce qui appartient à l'ennemi, magenta pour ce qui blesse, 04/05/12 pour les moquettes et verres).

### 7.2 Sous-palettes (recommandé : 24 couleurs max par tileset ; 24 max par personnage, contour, rim et émissifs compris)

| Usage | Couleurs (n°) | Dominante |
|---|---|---|
| **Quais & Voies** (nuit) | 01, 02, 03, 04, 05, 08, 09, 10, 11, 13, 14, 15, 19, 20, 23, 28 | bleus nuit, béton, rouille, néons froids, sodium ponctuel |
| **Hub OCC** | 01, 13, 14, 15, 16, 17, 18, 19, 20, 27, 28, 31, 32 | espresso → ambre : sécurité et chaleur |
| **La Passerelle** (aube, post-MVP) | 01, 02, 03, 04, 05, 06, 08, 09, 10, 11, 12, 19, 23 | blancs et bleus, ombres bleutées (jamais grises neutres) |
| **Hall & BAG** (post-MVP) | 01, 02, 03, 04, 05, 06, 09, 12, 16, 18, 24, 27, 31 | gris clinique, verre, bois clair du hall ; turquoise **profond** seulement |
| **Héros** | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 13–17, 21, 22, 27, 28, 33–38, 47, 57 | orange gilet sur bleu institution, écharpe rouge, rim néon |
| **Ennemis Privatix** | 01–04, 06–10, 15–17 (peaux), 24, 25, 26, 29, 33, 34, 41–45 (attaque), 57 | costumes froids + turquoise, rim néon |

### 7.3 Ombrage et contours (pixel art moderne)

- **Lumière haut-gauche** partout : rehauts sur les arêtes haut et gauche, ombres propres en bas-droite.
- Acteurs : **4 à 6 tons par matériau**, **décalage de teinte** (ombres vers le bleu/violet, lumières vers le jaune), modelé **par le volume** de la silhouette (pas de « pillow shading » : le bord droit est plus sombre que le bord gauche), **pas de tramage sur les acteurs**.
- **Rim light** : liseré 1 px `#6FD6FF` (57) sur le **bord droit extérieur** de la silhouette des acteurs (lumière d'ambiance des néons, opposée à la lumière principale), continu (≥ 2 px), jamais sur la peau, les semelles ni les pièces de 1–2 px de large. Pas de rim sur le décor.
- **Ombre portée / AO** : un ton plus sombre sous chaque pièce posée sur une autre (bras sur le torse, tête sur le col, torse sur les hanches, arme sur le corps), décalée bas-droite ; un ton plus sombre sur la rangée de contact au sol.
- **Anti-aliasing manuel** : seulement **à l'intérieur** des formes (ton intermédiaire au coin d'une marche d'escalier entre deux tons d'une même rampe) ; **jamais** sur le contour extérieur.
- **Émissifs** (07, 23, 25, 26, 29, 40, 42, 45, 57 : écrans, LED, néons, télégraphes, VFX) : jamais assombris par l'ombrage, toujours au plus clair ; ce sont eux que le bloom du moteur fait briller.
- Décor : tramage 50 % (damier) autorisé seulement sur les grandes surfaces et les lumières.
- **Contours** : acteurs, pickups, projectiles et icônes = **contour extérieur 1 px `#14101A`** + lignes internes en **sel-out** (teinte sombre du matériau). Décor = sel-out uniquement, **pas de contour noir**. VFX = pas de contour.
- Pas de pixels orphelins, pas de « jaggies » (escaliers irréguliers) sur les courbes ; lignes de 1 px d'épaisseur constante.

### 7.4 Lisibilité (règles bloquantes en revue)

1. **Héros orange `#FF7A1A`** : seul porteur de la couleur 22 ; identifiable en **silhouette noire** et sur **capture désaturée** dans chaque biome (test obligatoire à chaque livraison).
2. **Ennemis turquoise `#19C3B1`** : costumes froids + touche turquoise 25/26 sur ≥ 15 % de la silhouette ; **aucune nuance d'orange**.
3. **Danger magenta `#FF3EA5`** : très saturé + noyau blanc ; jamais utilisé pour le joueur ni pour le décor.
4. **Décor** en valeurs moyennes (sol) et sombres (murs) : couleurs 07, 22, 25, 26, 29 (et leurs éclats 36, 37, 41, 42, 44, 45) **interdites** au décor ; 32 seulement pour un feu de signal ponctuel ; turquoise du décor limité à 24. Les néons et écrans du décor utilisent 57, 11, 12, 19, 23, 40 (émissifs autorisés).
5. Récompenses = ambre 19, crème 18, vert 32 ; objets interactifs = reflet clair 1 px + animation de 2 frames minimum.
6. Télégraphes : ≥ 300 ms (ennemi standard), ≥ 700 ms (élite), ≥ 500 ms (boss ; 800–1 200 ms recommandé), portés par une frame magenta et/ou un `vfx_telegraph-*`.
7. **Rim et lisibilité** : le rim 57 ne remplace jamais une couleur de lecture ; un héros doit rester lisible si l'on retire le rim (test sur capture désaturée).

---

## 8. Guide d'achat itch.io (et commande à un freelance)

### 8.1 Où chercher

- Point d'entrée : `https://itch.io/game-assets/tag-pixel-art/tag-top-down`, puis affiner avec les tags `sprites`, `tileset`, `16x16`, `32x32`, `48x48`, `animated`, `characters`, `effects`, `user-interface`, `fonts` ; filtres « Free » ou « Paid » ; tri « Top rated » puis « Most recent ».
- Toujours ouvrir la page du pack : **aperçu de la feuille brute** (pas seulement le GIF), **taille de frame**, **liste des animations**, **licence**.

### 8.2 Mots-clés de recherche par besoin

| Besoin (fichiers du guide) | Mots-clés à taper |
|---|---|
| Héros 48×48 (`player_*`) | `top down 48x48 character pixel`, `top down character attack animation 4 directions`, `hack and slash pixel character sprite sheet`, `top down worker character pixel`, `top down melee hammer character` |
| Ennemis 32×32 (`consultant_*`) | `top down 32x32 enemy pixel`, `office worker pixel sprite top down`, `businessman pixel art 32x32`, `modern city npc top down 32x32` |
| Tourelle, drone (`borne_*`, `drone_*`) | `turret enemy pixel 32x32`, `vending machine pixel art`, `drone enemy sprite pixel top down`, `robot enemy pixel 32x32` |
| Élite 48×48, boss 96×96 (`manager-kpi_*`, `auditeur_*`) | `top down 48x48 boss pixel`, `96x96 boss sprite pixel art`, `mech boss top down pixel`, `large boss animation pixel` |
| Biome 1 (`tiles_quais`, `props_quais`) | `16x16 tileset train station`, `subway tileset 16x16 top down`, `railway tracks tileset 16x16`, `modern city tileset 16x16 top down`, `metro station pixel art tileset` |
| Trains (`train_*`) | `top down train sprite pixel`, `train wagon top view pixel art`, `tram top down pixel` |
| Hub OCC (`tiles_occ`, `props_occ`) | `16x16 brick interior tileset`, `underground bunker tileset 16x16`, `cozy cafe interior 16x16 top down`, `workshop tileset 16x16` |
| Biomes 2–3 (post-MVP) | `office tileset 16x16 top down`, `modern interior 16x16`, `glass bridge tileset`, `sci-fi lab tileset 16x16` |
| Autotiles | `autotile 47 blob tileset 16x16`, `wang tileset 16x16` |
| VFX (`vfx_*`, `proj-*`) | `pixel slash effect`, `hit effect pixel art 32x32`, `pixel explosion 64x64`, `shockwave pixel effect`, `pixel vfx pack top down`, `bullet projectile pixel 16x16` |
| UI et pickups (`ui_*`, `pickup-*`) | `pixel ui pack 16x16 icons`, `pixel health bar ui`, `rpg icons 16x16`, `9 slice pixel ui panel`, `pixel coin pickup animated` |
| Polices (`font_*`) | `bitmap pixel font`, `pixel font 5x7`, `led dot matrix pixel font`, `m5x7`, `m6x11` |
| Portraits (`portrait_*`) | `pixel portrait 64x64`, `character portrait pixel art pack`, `dialogue portrait pixel` |

### 8.3 Critères d'acceptation d'un pack

| Critère | Accepté | Refusé |
|---|---|---|
| Taille de frame | 48×48 (héros, élites), 32×32 (ennemis), 96×96 ou 128×128 (boss), 16×16 (tuiles) ; ou plus petit **avec la même silhouette** recadrable sans redessin | frames non carrées non recadrables, silhouettes trop grandes (> 28 px de haut pour un héros) |
| Densité | 1 texel = 1 pixel | pixels doublés (sauf réduction ×½ exacte et vérifiée), anticrénelage, haute définition |
| Perspective | vue de dessus 3/4 | isométrique, profil (plateforme), vue strictement zénithale pour des personnages |
| Directions | ≥ 3 dessinées (bas, haut, côté) ; attaques **par direction** pour le héros | 1 seule direction pour un personnage mobile |
| Animations | au moins idle, run, attack, hurt, death ; frames comptées ≥ celles du guide ou complétables | animations à 2 frames pour une course |
| Palette | recolorable (rampes claires, peu de couleurs) | dégradés, centaines de couleurs |
| **Licence** | **CC0** ; **CC-BY** (crédit) ; **OFL** (polices) ; licence d'auteur autorisant explicitement **l'usage commercial et la modification** dans un jeu | **NC** (non commercial), **ND** (pas de modification), « personal use only », licence absente ou ambiguë ; CC-BY-SA / GPL : au cas par cas avec le porteur du projet |
| Crédit | texte d'attribution fourni par l'auteur, recopié dans `CREDITS.md` | — |
| Contenu | décor ou personnages génériques | logos, marques, uniformes ou bâtiments réels identifiables |

### 8.4 Adapter un pack au guide

1. **Copier le pack brut** dans `art/vendor/<auteur>-<pack>/` (exclu de git) ; conserver la page de licence (capture ou fichier `LICENSE`).
2. **Recadrer** chaque frame dans le canvas de sa classe (§1.2) **sans redimensionner** : Aseprite, `Sprite > Canvas Size`, ancrage bas-centre, puis aligner les pieds sur la ligne du pivot (y = 44 pour 48×48, y = 28 pour 32×32). En lot, si les pieds de la source sont sur sa dernière rangée : `magick frame.png -background none -gravity south -extent 48x45 -gravity north -extent 48x48 out.png`.
3. **Découper / réassembler** en bandes : `magick sheet.png -crop 32x32 +repage +adjoin f_%02d.png` puis `magick f_00.png f_01.png … +append consultant_run_side_strip6.png`. Garder **uniquement** les directions `down`, `up` et `side` (vers la **droite**) ; supprimer les diagonales et la gauche.
4. **Ajuster le nombre de frames** à celui du guide (dupliquer une frame tenue plutôt que d'interpoler ; supprimer les frames en trop de la récupération), puis placer la frame d'impact à l'index exigé.
5. **Recolorer sur Privatix Moderne 57** : Aseprite, charger `privatix32.gpl` (57 couleurs, nom de fichier historique), `Sprite > Color Mode > Indexed` **sans tramage**, puis corriger à la main ; en lot : `magick in.png +dither -remap privatix57.png out.png` (`privatix57.png` = image 57×1 des couleurs, tirée du `.gpl`). Ajouter le rim 57 et générer la normal map (§2.6). **Remapper par valeur, pas par teinte** (chaque rampe sombre → clair vers la rampe Privatix de même rôle). Remplacer les contours noirs par `#14101A` (acteurs) ou les supprimer (décor). Respecter les rôles : orange → héros, turquoise → ennemis, magenta → menaces.
6. **Alpha binaire** : `magick in.png -channel A -threshold 50% +channel out.png` ; repasser en RGBA 32 bits (`PNG32:out.png`).
7. **Renommer** selon R1 et déposer dans le dossier du §2.2 ; ajouter l'entrée `CREDITS.md` (titre, auteur, URL, licence et version, modifications) **dans le même commit**.
8. Au plus **2 packs externes par biome**, unifiés par des détails maison (signalétique satirique, Privatix Moderne 57).

### 8.5 Checklist de validation avant intégration

- [ ] Nom conforme à la regex R2, dossier conforme au §2.2.
- [ ] Largeur = N × hauteur ; hauteur = taille de frame de la classe ; largeur ≤ 2 048.
- [ ] PNG RGBA 32 bits ; alpha ∈ {0, 255} (hors exceptions §2.3).
- [ ] Toutes les couleurs ∈ Privatix Moderne 57 ; ≤ 24 couleurs par personnage ou tileset ; normal map `_n.png` livrée (personnages, tilesets, props).
- [ ] Pivot : pieds sur la bonne rangée sur **toutes** les frames (superposer les frames en pelure d'oignon).
- [ ] Frame d'impact à l'index du guide ; télégraphe magenta sur les frames précédentes (ennemis).
- [ ] Héros testé en silhouette noire et en capture désaturée sur chaque biome.
- [ ] Aucune marque, aucun logo, aucun texte sur une vue `side`.
- [ ] Licence vérifiée, `CREDITS.md` à jour, pack brut hors de git.
- [ ] Testé en jeu à ×2 et ×3 : pas de flou, pas de couture de tuiles, animation au bon rythme.

Vérification automatique (Python + Pillow) à lancer sur un dossier avant le commit :

```python
import re, sys, pathlib
from PIL import Image
PAL = {int(h, 16) for h in "14101A 2A3040 4E5668 7D828C 9FB0C6 F4F6F8 FFFFFF 0B1F3A 123C73 1F5AA6 5FA8E8 9CC7D9 2B1A12 4A2E1F 7A4E33 A8734A E3A982 F2E6CF F2A541 8A3B2E B8470F FF7A1A FFD200 0A4F4C 19C3B1 8FF5E4 8E1F28 C8323C FF3EA5 B48CFF 1E5B3A 5BD17A".split()}
RX = re.compile(r"^([a-z0-9-]+)_([a-z0-9-]+)(?:_(down|up|side))?_strip([1-9][0-9]*)\.png$")
for f in pathlib.Path(sys.argv[1]).rglob("*.png"):
    im, err = Image.open(f), []
    exc = f.name.startswith(("shadow_", "light_"))  # exceptions du §2.3
    if im.mode != "RGBA": err.append(f"mode {im.mode}")
    raw = im.convert("RGBA").tobytes(); px = [tuple(raw[i:i + 4]) for i in range(0, len(raw), 4)]
    if not exc and any(a not in (0, 255) for *_, a in px): err.append("alpha partiel")
    if not exc and any(a and (r << 16 | g << 8 | b) not in PAL for r, g, b, a in px): err.append("couleur hors palette")
    m = RX.match(f.name)
    if m and im.width != int(m[4]) * im.height: err.append(f"largeur {im.width} != {m[4]}x{im.height}")
    if im.width > 2048: err.append("largeur > 2048")
    if err: print(f, "->", ", ".join(err))
```

### 8.6 Quels packs pour quels fichiers

| Type de pack (exemples à vérifier sur la page au moment de l'achat) | Fichiers du guide couverts | Travail d'adaptation |
|---|---|---|
| Base de personnage top-down 4 directions avec attaques (ex. bases de type *Mana Seed*, licence payante) | `player_*` (idle, run, attack1–3, dash, hurt, death) | recadrage 48×48, gilet orange, clé à tire-fond redessinée, frames d'impact |
| Pack de personnages modernes / bureau 32×32 | `consultant_*`, `manager-kpi_*` (agrandi par redessin, jamais par mise à l'échelle), PNJ `npcs/*` | turquoise sur ≥ 15 %, télégraphes magenta, prep/recover à dessiner |
| Robots, tourelles, drones 32×32 | `borne_*`, `drone_*` | écran « HORS SERVICE », trappe de `deploy` à dessiner |
| Boss mécanique 96×96 | base de l'estrade d'`auditeur_*` | le personnage de l'Auditeur et le chronomètre restent à dessiner |
| Tilesets ville / gare / métro 16×16 (ex. *Modern Exteriors* / *Modern Interiors* de LimeZu, licence payante : relire les droits de redistribution) | `tiles_quais`, `props_quais`, `train_*`, `tiles_occ`, `props_occ` | réordonner en blob 47 / Wang 16, rangées §5.3, sous-palette de biome |
| Packs VFX pixel (slash, impact, explosion, onde de choc) | `vfx_slash-*`, `vfx_hit*`, `vfx_explosion*`, `vfx_shockwave*`, `vfx_dust*` | recoloration joueur / menace, recadrage aux frames du §6.2 |
| Packs CC0 généralistes (Kenney ; *Ninja Adventure*) | `ui_*` (bases), `vfx_particles`, `pickup-*`, prototypes | recoloration, contour `#14101A` |
| Polices m5x7 / m6x11 (Daniel Linssen) ; polices OFL | `font_body`, `font_title` | conversion BMFont sans lissage, export blanc |
| Packs de portraits 64×64 | `portrait_*` | 3 expressions, palette, aucune ressemblance avec une personne réelle |
| **Aucun pack** (identité du jeu) | Vieille Dame, Borne « HORS SERVICE », Auditeur, Manager KPI, Friterie, `font_led`, `ui_logo`, satire Privatix | générateur du dépôt (§9) ou commande à un freelance |

**Dépôt public** : un fichier issu d'un pack payant « sans redistribution » ne doit pas être publié tel quel dans un dépôt git public, même modifié. Vérifier la visibilité du dépôt avant de commiter ; en cas de doute, garder ces fichiers hors de git et les injecter au moment du build, ou obtenir l'accord écrit de l'auteur.

### 8.7 Commander à un freelance

Joindre à la commande : ce guide (sections concernées), la **liste exacte des fichiers** (extrait du §10), `privatix32.gpl`, une capture du jeu en 640×360 et les fichiers générés du dépôt comme gabarits de silhouette et de timing. Exiger : bandes conformes au §2, sources `.aseprite` avec calques et tags, **cession des droits d'exploitation commerciale** (ou licence exclusive) écrite, aucun élément repris d'un pack tiers sans le déclarer, livraison par lots (héros d'abord), et une révision incluse après test en jeu.

---

## 9. Assets originaux du dépôt (générateur `tools/pixelart/`)

- Le dépôt contient un générateur **`tools/pixelart/`** (Python 3 + Pillow + NumPy) qui produit des **sprites originaux** (propriété du projet, aucun crédit tiers) **conformes à ce guide** : mêmes chemins et noms de fichiers, mêmes tailles de frame, nombres de frames, pivots, frames d'impact, palette Privatix Moderne 57 et alpha binaire. Sa passe « moderne » (`modern.py` : volume, rim light, sel-out, AO, anti-aliasing interne) et son générateur de **normal maps** appliquent automatiquement les règles des §1.4, §2.6 et §7.3 ; l'écharpe, les smears et le squash & stretch du héros sont dans `hero.py`.
- **`npm run assets`** régénère l'ensemble de ces fichiers dans `public/assets/`. Ce sont de vrais assets jouables et cohérents entre eux, pas de simples rectangles de remplacement.
- **Règle de remplacement** : tout asset acheté ou commandé qui respecte **le nom, les dimensions et le nombre de frames** du guide **remplace le fichier généré sans toucher au code** (le code charge les mêmes chemins). Si le nombre de frames change (ex. `_strip6` → `_strip8`), ce n'est plus un remplacement : la table d'animations du code doit être mise à jour par le Lead Dev.
- **Protéger un asset remplacé** : avant de relancer `npm run assets`, vérifier le mécanisme d'exclusion prévu par le générateur (voir son README) ; à défaut, relancer puis restaurer l'asset acheté avec `git checkout -- <fichier>` (ou depuis `art/vendor/` s'il est hors de git) et contrôler avec `git status`.
- Les fichiers générés servent aussi de **gabarits** pour une commande ou une adaptation : silhouette, pivot, rythme et position de la frame d'impact y sont déjà justes ; un fichier acheté doit pouvoir se superposer au fichier généré en pelure d'oignon.
- Priorité d'utilisation : 1) asset commandé ou acheté validé (§8.5), 2) asset généré par `tools/pixelart/`. Un asset tiers non conforme ne remplace jamais un asset généré conforme.

---

## 10. Liste exhaustive du MVP

Chemins relatifs à `public/assets/`. `{down,up,side}` = 3 fichiers. « Frame » = taille de frame carrée (« — » pour une image statique). Priorités : **P0** = tranche jouable (une salle de quai avec héros, Consultant et Borne) ; **P1** = MVP complet (Drone, élite, boss, hub, boucle de récompenses) ; **P2** = finition du MVP.

| Chemin | Feuille(s) | Frame | Frames | Fichiers PNG | Prio |
|---|---|---|---|---|---|
| `sprites/player/player_{idle,run}_{down,up,side}_strip{8,10}.png` (+ `_n.png`) | 384×48 · 480×48 | 48 | 54 | 6 | P0 |
| `sprites/player/player_{attack1,attack2,attack3}_{down,up,side}_strip{7,7,9}.png` (+ `_n.png`) | 336×48 · 336×48 · 432×48 | 48 | 69 | 9 | P0 |
| `sprites/player/player_{dash,hurt}_{down,up,side}_strip{6,4}.png` (+ `_n.png`) | 288×48 · 192×48 | 48 | 30 | 6 | P0 |
| `sprites/player/player_death_strip12.png` | 576×48 | 48 | 12 | 1 | P0 |
| `sprites/player/player_{dash-attack,drink}_{down,up,side}_strip{5,6}.png` | 240×48 · 288×48 | 48 | 33 | 6 | P1 |
| `sprites/player/player_{whistle_strip8,special_strip12,spawn_strip10}.png` | 384×48 · 576×48 · 480×48 | 48 | 30 | 3 | P1 |
| `sprites/player/player_rage_strip8.png` | 384×48 | 48 | 8 | 1 | P2 |
| `sprites/enemies/consultant_{idle,run,attack,hurt}_{down,up,side}_strip{4,8,8,2}.png` (+ `_n.png`) | 128 · 256 · 256 · 64 ×32 | 32 | 66 | 12 | P0 |
| `sprites/enemies/consultant_death_strip8.png` | 256×32 | 32 | 8 | 1 | P0 |
| `sprites/enemies/borne_{idle_strip4,wake_strip6,attack_strip6,hurt_strip2,death_strip4,wreck_strip1}.png` | 128 · 192 · 192 · 64 · 128 · 32 ×32 | 32 | 23 | 6 | P0 |
| `sprites/enemies/drone_{fly_strip4,attack_strip8,scan_strip6,hurt_strip2,death_strip6}.png` | 128 · 256 · 192 · 64 · 192 ×32 | 32 | 26 | 5 | P1 |
| `sprites/enemies/consultant_recover_{down,up,side}_strip4.png · borne_{reload,stun}_strip4.png · drone_drop_strip6.png` | 128 · 128 · 128 · 192 ×32 | 32 | 26 | 6 | P2 |
| `sprites/enemies/manager-kpi_{idle,walk,attack,shield,hurt}_{down,up,side}_strip{4,6,8,8,2}.png + manager-kpi_death_strip8.png` | 192 · 288 · 384 · 384 · 96 · 384 ×48 | 48 | 92 | 16 | P1 |
| `sprites/enemies/manager-kpi_stun_strip6.png` | 288×48 | 48 | 6 | 1 | P2 |
| `sprites/bosses/auditeur_{intro_strip14,idle_strip6,move_strip8,attack-sweep_strip12,attack-barrage_strip8,attack-stamp_strip14}.png` | 1344 · 576 · 768 · 1152 · 768 · 1344 ×96 | 96 | 62 | 6 | P1 |
| `sprites/bosses/auditeur_{phase_strip12,idle-p2_strip6,move-p2_strip8,command_strip10,dash_strip6,hurt_strip2,death_strip20}.png` | 1152 · 576 · 768 · 960 · 576 · 192 · 1920 ×96 | 96 | 64 | 7 | P1 |
| `sprites/bosses/auditeur_stun_strip6.png` | 576×96 | 96 | 6 | 1 | P2 |
| `sprites/npcs/{marcel,jean-mi}_{idle,talk}_strip4.png + vieille-dame_idle_strip4.png` | 128×32 | 32 | 20 | 5 | P1 |
| `sprites/npcs/{josiane,rudy,fatou,kevin,bene,yasmina,raymonde}_{idle,talk}_strip4.png` | 128×32 | 32 | 56 | 14 | P1 |
| `sprites/vfx/vfx_{slash-e,slash-se}_strip5.png` | 400×80 | 80 | 10 | 2 | P0 |
| `sprites/vfx/vfx_{slam-e,slam-se}_strip7.png` | 672×96 | 96 | 14 | 2 | P0 |
| `sprites/vfx/vfx_{hit_strip5,hit-big_strip6}.png` | 160×32 · 288×48 | 32 · 48 | 11 | 2 | P0 |
| `sprites/vfx/vfx_{dash_strip5,dust_strip5,dust-land_strip6,sparks_strip4}.png` | 160×32 · 80×16 · 192×32 · 64×16 | 32 · 16 · 32 · 16 | 20 | 4 | P0 |
| `sprites/vfx/vfx_{particles_strip12,explosion_strip10}.png` | 96×8 · 640×64 | 8 · 64 | 22 | 2 | P0 |
| `sprites/vfx/vfx_{spawn-privatix_strip8,poof_strip7,telegraph-32_strip4,telegraph-line_strip4}.png` | 512×64 · 224×32 · 128×32 · 64×16 | 64 · 32 · 32 · 16 | 23 | 4 | P0 |
| `sprites/vfx/proj-ticket_{spin,pop}_strip4.png + proj-ribbon_strip4.png` | 64×16 | 16 | 12 | 3 | P0 |
| `sprites/vfx/shadow_{s,m}.png` | 16×6 · 24×8 | — | statique | 2 | P0 |
| `sprites/vfx/vfx_{thrust-e,thrust-se}_strip4.png` | 320×80 | 80 | 8 | 2 | P1 |
| `sprites/vfx/vfx_{shockwave_strip8,shockwave-big_strip8,charge_strip6}.png` | 1280×160 · 2048×256 · 288×48 | 160 · 256 · 48 | 22 | 3 | P1 |
| `sprites/vfx/vfx_{spawn-player_strip8,reward_strip8,heal_strip6}.png` | 512×64 · 384×48 · 192×32 | 64 · 48 · 32 | 22 | 3 | P1 |
| `sprites/vfx/vfx_{strike-sign_strip4,mark_strip4,scan-cone_strip4}.png` | 64×16 · 64×16 · 256×64 | 16 · 16 · 64 | 12 | 3 | P1 |
| `sprites/vfx/vfx_{shield_strip6,shield-break_strip5,chrono-zone_strip4,bars_strip8,elite-aura_strip6}.png` | 288×48 · 240×48 · 256×64 · 256×32 · 384×64 | 48 · 48 · 64 · 32 · 64 | 29 | 5 | P1 |
| `sprites/vfx/vfx_{shield-boss_strip6,telegraph-96_strip4,kpi-trail_strip4,explosion-big_strip12}.png` | 768×128 · 384×96 · 64×16 · 1536×128 | 128 · 96 · 16 · 128 | 26 | 4 | P1 |
| `sprites/vfx/proj-bille_{spin_strip4,pop_strip4}.png` | 32×8 · 64×16 | 8 · 16 | 8 | 2 | P1 |
| `sprites/vfx/shadow_{l,xl}.png` | 32×10 · 64×16 | — | statique | 2 | P1 |
| `sprites/vfx/vfx_steam_strip6.png` | 96×16 | 16 | 6 | 1 | P2 |
| `sprites/pickups/pickup-ticket_spin_strip6.png` | 96×16 | 16 | 6 | 1 | P0 |
| `sprites/pickups/{pickup-gobelet_idle_strip4,pickup-radio_idle_strip6,pickup-reglage_idle_strip6,chest-cafe_idle_strip6,chest-cafe_open_strip8}.png` | 64×16 · 192×32 · 96×16 · 192×32 · 256×32 | 16 · 32 · 16 · 32 · 32 | 30 | 5 | P1 |
| `sprites/pickups/{pickup-grain_spin_strip6,pickup-piece_idle_strip4,pickup-preuve_idle_strip6,pickup-tasse_idle_strip4,pickup-ps_idle_strip6,consigne_open_strip6}.png` | 48×8 · 64×16 · 96×16 · 64×16 · 96×16 · 192×32 | 8 · 16 · 16 · 16 · 16 · 32 | 32 | 6 | P1 |
| `tilesets/tiles_quais.png · tilesets/tiles_commun.png` | 256×256 · 128×128 | 16 (tuiles) | statique | 2 | P0 |
| `tilesets/porte-quai_{idle_strip2,open_strip6}.png` | 96×48 · 288×48 | 48 | 8 | 2 | P0 |
| `tilesets/props_quais.png (+ props_quais.json) · train_motrice.png · train_voiture.png · ecran-departs.png` | 256×256 · 192×48 · 192×48 · 96×32 | atlas / — | statique | 4 | P1 |
| `tilesets/{train-porte_open_strip4,signal_state_strip3,catenaire_arc_strip6,chariot_roll_strip4,portique_idle_strip4,portique_break_strip6}.png` | 128 · 96 · 192 · 128 · 128 · 192 ×32 | 32 | 27 | 6 | P1 |
| `tilesets/{abri_break_strip6,poubelle_break_strip5,distributeur_break_strip6,friterie_idle_strip4}.png` | 288×48 · 160×32 · 288×48 · 256×64 | 48 · 32 · 48 · 64 | 21 | 4 | P1 |
| `tilesets/tiles_occ.png · tilesets/props_occ.png (+ props_occ.json)` | 256×256 · 256×256 | 16 / atlas | statique | 2 | P1 |
| `tilesets/{lanterne_idle_strip4,mannequin_hit_strip4,porte-occ_open_strip6}.png` | 64×16 · 128×32 · 288×48 | 16 · 32 · 48 | 14 | 3 | P1 |
| `tilesets/light_{round-64,round-128,cone-64}.png` | 64×64 · 128×128 · 64×64 | — | statique | 3 | P1 |
| `tilesets/light_halo-320.png` | 320×320 | — | statique | 1 | P2 |
| `sprites/ui/ui_{energy-frame,energy-fill,energy-ghost,burnout-frame,burnout-fill,burnout-crit,mobil-frame,mobil-fill}.png` | 104×12 · 100×8 · 100×8 · 104×10 · 100×6 · 16×6 · 76×8 · 72×4 | — | statique | 8 | P0 |
| `sprites/ui/ui_{dash-pip_strip3,gobelet_strip3,cursor_strip4}.png` | 24×8 · 48×16 · 64×16 | 8 · 16 · 16 | 10 | 3 | P0 |
| `sprites/ui/ui_{burnout-tiers_strip5,prompt_strip4,res_strip10,door-reward_strip12}.png` | 80×16 · 64×16 · 80×8 · 192×16 | 16 · 16 · 8 · 16 | 31 | 4 | P1 |
| `sprites/ui/ui_{avantages_strip21,families_strip7,reglages_strip8,rarity_strip4,button_strip3}.png` | 336×16 · 112×16 · 128×16 · 80×20 · 72×24 | 16 · 16 · 16 · 20 · 24 | 43 | 5 | P1 |
| `sprites/ui/ui_{boss-frame,boss-fill,boss-mark,clock,panel-occ,panel-privatix,card}.png` | 320×14 · 316×6 · 2×10 · 56×16 · 24×24 · 24×24 · 32×32 | — | statique | 7 | P1 |
| `sprites/ui/ui_shift_strip3.png · ui_logo.png` | 48×16 · 256×96 | 16 · — | 3 + 1 statique | 2 | P2 |
| `fonts/font_body.png (+ .xml) · fonts/font_dmg.png` | ≤ 256×128 · 84×9 | glyphes | statique | 2 | P0 |
| `fonts/font_title.png (+ .xml) · fonts/font_led.png (+ .xml)` | ≤ 256×256 · ≤ 256×64 | glyphes | statique | 2 | P1 |
| `sprites/portraits/portrait_{player,marcel,jean-mi,auditeur}_strip3.png` | 192×64 | 64 | 12 | 4 | P1 |
| `sprites/portraits/portrait_{josiane,rudy,fatou,kevin,bene,yasmina,raymonde}_strip3.png` | 192×64 | 64 | 21 | 7 | P2 |

### Récapitulatif chiffré du MVP

| Lot | Fichiers PNG | Frames animées | dont P0 | dont P1 | dont P2 |
|---|---|---|---|---|---|
| Héros | 32 | 236 | 22 | 9 | 1 |
| Ennemis | 30 | 149 | 19 | 5 | 6 |
| Élite | 17 | 98 | 0 | 16 | 1 |
| Boss 1 | 14 | 132 | 0 | 13 | 1 |
| PNJ | 19 | 76 | 0 | 19 | 0 |
| VFX | 46 | 245 | 21 | 24 | 1 |
| Pickups | 12 | 68 | 1 | 11 | 0 |
| Tilesets | 27 | 70 | 4 | 22 | 1 |
| UI | 29 | 87 | 11 | 16 | 2 |
| Polices | 4 | 0 | 2 | 2 | 0 |
| Portraits | 11 | 33 | 0 | 4 | 7 |
| **Total** | **241 PNG** | **1194** | **80** | **141** | **20** |

Par priorité : **P0 = 80 PNG / 398 frames** (tranche jouable), **P1 = 141 PNG / 720 frames**, **P2 = 20 PNG / 76 frames** (dont les anims optionnelles *(P2)* du §4, qui ont un repli dans le code). Chaque PNG de personnage, de tileset et de prop est accompagné de sa **normal map** `_n.png` (§2.6), non comptée ici. S'y ajoutent **5 fichiers de données** (`props_quais.json`, `props_occ.json`, `font_body.xml`, `font_title.xml`, `font_led.xml`) et **576 tuiles** (256 Quais & Voies + 256 OCC + 64 communes). Hors MVP (annexes §3.3, §4.6, §5.9) : actions post-MVP du héros, Agent de sécurité, Pense-bête Vivant, Coach Agile, Réorganisateur RH, Jean-Cul Lurcke et ses Clauses, biomes 2 et 3, `shadow_xxl`, portraits et PNJ supplémentaires.
