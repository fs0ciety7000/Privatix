# tools/pixelart — générateur des sprites Privatix

Pixel art original généré par code (Python 3 + Pillow + NumPy), direction
artistique **« pixel art moderne »** (références : **Dead Cells** pour le
volume, le rim light, les smears et les VFX généreux ; **Celeste** pour la
palette saturée à décalage de teinte, le squash & stretch et l'élément
secondaire qui traîne). Les pièces (têtes, torses, jambes, props, icônes…)
sont des matrices de caractères dessinées à la main (une lettre = une couleur
de la palette « Privatix Moderne 57 », voir `palette.py`), assemblées frame par
frame (cycles de marche, bob, squash & stretch, arc de la clé, smear, recul,
chute), contourées en `#14101A`, puis passées dans la **passe moderne**
(`modern.py`). Chaque feuille de personnage, tileset et prop reçoit sa
**normal map**.

## Relancer

```bash
npm run assets            # = python3 tools/pixelart/build.py
python3 tools/pixelart/mockup.py   # maquette d'écran 640×360 éclairée (preview/mock_scene.png)
```

Sorties :

- `public/assets/sprites/{player,enemies,bosses,npcs,vfx,pickups,ui,portraits}/` et
  `public/assets/tilesets/` (tilesets extrudés marge 1 / espacement 2, props, atlas JSON, trains, lumières),
  `public/assets/fonts/font_dmg.png` ;
- les **normal maps** `<nom>_n.png` à côté des PNG de personnages, tilesets et props ;
- `tools/pixelart/manifest.json` (copie : `public/assets/sprites/manifest.json`) ;
- `tools/pixelart/preview/contact_sheet.png` (+ `contact_<catégorie>.png`) : toutes les bandes ×4 ;
- `tools/pixelart/privatix32.gpl` (palette Aseprite/GIMP ; nom historique, 57 couleurs).

Le build échoue si un PNG (ou sa normal map) contient de l'alpha partiel ou si
l'alpha d'une normal map diffère de celui de son sprite. Il **signale** (sans
les supprimer) les PNG de `public/assets/` que le manifeste ne référence plus,
p. ex. une ancienne bande `_strip6` après passage à `_strip8` : à supprimer à la
main après vérification.

## Style « pixel art moderne »

| Élément | Où | Ce qui est fait |
|---|---|---|
| Palette | `palette.py` | 32 couleurs historiques (lettres et couleurs de lecture inchangées) + 25 tons de rampe = 57 couleurs ; `RAMPS` (4 à 8 tons par matériau, ombres froides, lumières chaudes), `DARK` / `LIGHT` (ton voisin), `EMISSIVE` (jamais assombris), `RIM` (`#6FD6FF`). |
| Volume, rim, sel-out, AO, AA | `modern.py` → `shade()` | Carte de hauteur « bombée » tirée de la silhouette → normale → lumière haut-gauche : arêtes éclairées +1 ton, arêtes opposées −1 ton ; rim light néon sur le bord droit extérieur (≥ 3 px de large, pas sur la peau ni les semelles) ; lignes internes noires → sel-out coloré ; rangée de contact au sol −1 ton ; anti-aliasing interne aux marches d'escalier. Appliquée aux acteurs (`hero.py`, `humanoid.py`, `machines.py`, `boss.py`) et, sans rim, aux props (`props.finish`). |
| Ombres portées | `lib.blit(..., cast=True)` | Chaque pièce posée sur une autre (bras, tête, torse, arme) assombrit d'un ton le dessous, décalé bas-droite. `edge="selout"` : séparation au ton −2 du matériau. |
| Héros | `hero.py` | idle 8, run 10, attack1/2 7 (smear sur l'active 2 + follow-through), attack3 9 (anticipation marquée, smear sur l'active 4), dash 6 (étirement), hurt 4 ; squash & stretch (`stretch()`, autour des pieds) ; **écharpe syndicale rouge** simulée (`simulate_scarf` : chaîne verlet de 4 segments accrochée au cou, vent relatif par frame, boucles simulées jusqu'au régime stable → retard naturel d'1–2 frames). |
| Ennemis | `consultant.py` (run 8, attack 8 avec smear du « diaporama »), `humanoid.py` (`stretch`) | mêmes principes à l'échelle 32 px. |
| VFX | `vfx.py` | slash à cœur blanc et bords colorés + étincelles, impact « étoile » avec halo, gerbe d'étincelles, explosion flash → boule de feu → fumée qui se dissout, onde de choc lumineuse. Sans contour, sans normal map. |
| Pickups | `vfx._pickup_finish` | volume éclairé (sans rim), reflet d'1 px qui glisse sur l'arête haut-gauche, étincelle à 4 branches sur une frame de la boucle. |
| UI | `ui.py` | barres en rampe verticale (rehaut chaud, ombre froide, liseré spéculaire, reflets obliques), cadres biseautés à réservoir creusé, panneaux 9-slice et carte biseautés (centre uni), icônes modelées par `modern.shade`. |
| Décor | `tiles.py`, `props.py` | sol des quais en valeur moyenne (rampe 52–56 : biseaux, micro-variations, grain, reflets humides), ballast et murs sombres avec matière, bords de quai (ligne jaune à rehaut, nez en granit, chute dans l'ombre), affiches éclairées, vitrine à reflets, néons et tableau des départs émissifs, trains à toit cylindrique ; OCC en brique chaude (rampe 50·20·51) éclairée par des lanternes. |

## Normal maps

- Nom : `<nom>_n.png` à côté de `<nom>.png` (ex. `player_run_side_strip10_n.png`,
  `tiles_quais_n.png`, `props/prop_banc-h_n.png`) ; mêmes dimensions, même alpha.
- Concernées : `sprites/{player,enemies,bosses,npcs}/` et tout `tilesets/` sauf
  `light_*` (règle dans `registry.wants_normal`). Pas de normal map pour les VFX,
  pickups, UI, portraits, polices, ombres.
- Encodage : RGB = (n + 1) / 2 × 255, **convention OpenGL** (X droite, **Y haut =
  vert**, Z vers la caméra) ; pixels transparents `(128, 128, 255, 0)`.
- Calcul (`modern.normal_map`) : hauteur = bombé de la silhouette (distance au
  bord) + luminance du matériau, légèrement lissée, gradient → normale. Chaque
  frame (et chaque tuile 18×18 des tilesets extrudés) est traitée seule. Tuiles :
  luminance seule (`mode="surface"`).
- Manifeste : champ `"normalMap": "assets/…_n.png"` sur chaque entrée concernée
  (`animations[]`, `images[]`, `tilesets[]`). Chargement Phaser 4 :
  `load.spritesheet(key, [file, normalMap], frameConfig)`,
  `load.image(key, [file, normalMap])`, `load.atlas({ key, textureURL, atlasURL, normalMap })`,
  puis `setLighting(true)`.

## Manifeste

`animations[]` : `file` (chemin à charger depuis `public/`), `texture` (clé de
texture), `anim` (clé d'animation Phaser `<entité>-<anim>[-<dir>]`),
`frameWidth`/`frameHeight`, `frames`, `durations` (ms par frame), `fps`,
`loop`, `pivot` (px) et `origin` (pour `setOrigin`), `active` (frames de
hitbox/tir), `events` (pas, fenêtre de combo, smear, VFX à déclencher…),
`normalMap`.
`images[]` : images fixes, atlas de props (`atlas` = JSON Phaser Hash),
ombres (`alpha` à appliquer), lumières (`blend: ADD`), `normalMap` (props, trains).
`tilesets[]` : `tileWidth`, `margin`, `spacing`, `tiles` (nom -> index, pour les
gabarits ASCII), `animations` (tuiles animées Tiled), `normalMap`.

## Retoucher

- Une pièce : modifier sa matrice dans le module (`hero.py`, `consultant.py`,
  `machines.py`, `manager.py`, `boss.py`, `npcs.py`, `props.py`, `tiles.py`,
  `vfx.py`, `ui.py`) puis relancer.
- Le rendu « moderne » se règle dans `modern.shade` (seuils de lumière, rim) et
  dans les rampes de `palette.py` ; une frame peut l'éviter avec `P["raw"] = True`.
- Itérer vite : `python3 tools/pixelart/zoomf.py hero "attack1_side" 8 0,2,3`
  (frames choisies à fort grossissement sur fond de quai → `preview/zoomf.png`),
  `python3 tools/pixelart/zoom.py hero "attack1_side" 8` ou
  `python3 tools/pixelart/quick.py vfx 4`.

## Remplacer par des assets itch.io

1. Vérifier la licence (CC0, CC-BY, OFL ou licence commerciale explicite) et
   l'ajouter à `CREDITS.md` dans le même commit.
2. Recolorer par valeur vers `privatix32.gpl` (57 couleurs), contour `#14101A`,
   alpha binaire (art_director.md §10.3), rim `#6FD6FF` sur le bord droit.
3. Exporter en bande au **même nom et même format** (`<entité>_<anim>[_<dir>]_strip<N>.png`,
   frames carrées, pivot identique) dans le même dossier, avec sa normal map
   `_n.png` (dessinée ou générée par `modern.normal_map`), puis retirer l'appel
   `emit(...)` correspondant dans le module (sinon le build l'écrase) et
   reporter les durées/frames actives dans le manifeste (ou garder l'entrée
   générée si le nombre de frames est identique).
