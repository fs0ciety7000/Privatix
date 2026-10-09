# tools/pixelart — générateur des sprites Privatix

Pixel art original généré par code (Python 3 + Pillow + numpy) : les pièces
(têtes, torses, jambes, props, icônes…) sont des matrices de caractères
dessinées à la main (une lettre = une couleur de la palette Privatix 32, voir
`palette.py`), assemblées frame par frame (cycles de marche, bob, squash &
stretch, arc de la clé, recul, chute), puis contourées en `#14101A`.

## Relancer

```bash
npm run assets            # = python3 tools/pixelart/build.py
python3 tools/pixelart/mockup.py   # maquette d'écran 640×360 (preview/mock_scene.png)
```

Sorties :

- `public/assets/sprites/{player,enemies,bosses,npcs,vfx,pickups,ui,portraits}/` et
  `public/assets/tilesets/` (tilesets extrudés marge 1 / espacement 2, props, atlas JSON, trains, lumières),
  `public/assets/fonts/font_dmg.png` ;
- `tools/pixelart/manifest.json` (copie : `public/assets/sprites/manifest.json`) ;
- `tools/pixelart/preview/contact_sheet.png` (+ `contact_<catégorie>.png`) : toutes les bandes ×4 ;
- `tools/pixelart/privatix32.gpl` (palette Aseprite/GIMP).

Le build échoue si un PNG contient de l'alpha partiel.

## Manifeste

`animations[]` : `file` (chemin à charger depuis `public/`), `texture` (clé de
texture), `anim` (clé d'animation Phaser `<entité>-<anim>[-<dir>]`),
`frameWidth`/`frameHeight`, `frames`, `durations` (ms par frame), `fps`,
`loop`, `pivot` (px) et `origin` (pour `setOrigin`), `active` (frames de
hitbox/tir), `events` (pas, fenêtre de combo, VFX à déclencher…).
`images[]` : images fixes, atlas de props (`atlas` = JSON Phaser Hash),
ombres (`alpha` à appliquer), lumières (`blend: ADD`).
`tilesets[]` : `tileWidth`, `margin`, `spacing`, `tiles` (nom -> index, pour les
gabarits ASCII), `animations` (tuiles animées Tiled).

## Retoucher

- Une pièce : modifier sa matrice dans le module (`hero.py`, `consultant.py`,
  `machines.py`, `manager.py`, `boss.py`, `npcs.py`, `props.py`, `tiles.py`,
  `vfx.py`, `ui.py`) puis relancer.
- Itérer vite : `python3 tools/pixelart/zoom.py hero "attack1_side" 8` (fort
  grossissement d'une anim) ou `python3 tools/pixelart/quick.py vfx 4`.

## Remplacer par des assets itch.io

1. Vérifier la licence (CC0, CC-BY, OFL ou licence commerciale explicite) et
   l'ajouter à `CREDITS.md` dans le même commit.
2. Recolorer par valeur vers `privatix32.gpl`, contour `#14101A`, alpha binaire
   (art_director.md §10.3).
3. Exporter en bande au **même nom et même format** (`<entité>_<anim>[_<dir>]_strip<N>.png`,
   frames carrées, pivot identique) dans le même dossier, puis retirer l'appel
   `emit(...)` correspondant dans le module (sinon le build l'écrase) et
   reporter les durées/frames actives dans le manifeste (ou garder l'entrée
   générée si le nombre de frames est identique).
