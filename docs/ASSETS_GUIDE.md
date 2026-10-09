# Privatix — Guide des assets (direction artistique & pipeline)

> **Auteur** : Art Director / Technical Artist · **Statut** : référence de production
> **Cible** : Phaser 3.90 + TypeScript + Vite · résolution logique **960×540** · tuiles **16 px** · zoom entier
> **Fait foi** : le canon créatif (`CANON`) pour les noms, zones, personnages et ennemis ; la palette UX (`src/config/colors.ts`) pour les couleurs d'interface.
> **Dossiers réels** : `public/assets/{images,audio,tilemaps,fonts}` · pack : `public/assets/asset-pack.json` chargé par `PreloaderScene` via `this.load.pack(AssetKeys.AssetPack, 'assets/asset-pack.json')`.

---

## 1. Direction artistique

### 1.1 Intentions

- **Pixel-art 16 px honnête** : tuiles 16×16, personnages 16×24, aucun anti-aliasing, aucune rotation ni mise à l'échelle non entière.
- **Deux mondes, un système** : le monde institutionnel (bleu nuit, jaune quai, acier blanc, néons) s'oppose à l'**OCC** (espresso, crème, ambre de lampe, rouge rebelle).
- **Le management est « lisse »** : les ennemis Privatix sont propres, saturés, brillants (baskets blanches, écrans, Post-it fluo) et détonnent sur le décor usé de la gare.
- **Satire par le détail** : distributeur « HORS SERVICE », classeur « PROVISOIRE v14 », tasse « World's Best Disruptor » ; jamais au prix de la lisibilité.

### 1.2 Densité de pixel (règle unique)

- **Monde et combat** : 1 texel = **2 px logiques** (caméra d'exploration en `zoom = 2` → 30×17 tuiles visibles ; sprites de combat et fonds affichés `setScale(2)`). À valider avec le Lead Dev ; c'est la règle par défaut de ce guide.
- **UI** : texte et icônes à 1 texel = 1 px logique autorisés (texte ≥ 16 px, cf. UX). Le mélange de densités (« mixels ») est toléré **entre** la couche UI et la couche monde, **jamais** au sein d'une même couche.
- Phaser : `pixelArt: true`, `roundPixels: true`, positions entières (`Math.round`).

### 1.3 Palette

**Interface — thème SNCB** (froid, institutionnel) et **thème OCC** (chaud, clandestin), définis dans `src/config/colors.ts` :

| Thème | Couleurs (nom `hex` → usage graphique) |
|---|---|
| **SNCB** | Bleu Nuit Quai `#0B1F3A` → fonds, letterbox, contours de nuit · Bleu Institution `#123C73` → panneaux, uniformes, signalétique · Bleu Signal `#1F5AA6` → bordures, sélection · Bleu Ciel Caténaire `#5FA8E8` → reflets du verre, biseaux, néons · Blanc Affiche `#F4F6F8` → texte, acier blanc de la passerelle · Gris Ballast `#9FB0C6` → béton, ballast · **Jaune Quai `#FFD200`** → ligne de sécurité, curseur, n° de voie, tableau des départs · Jaune Quai Ombre `#C9A200` |
| **OCC** | **Espresso `#2B1A12`** → fond, ombres de la lampisterie · Café Torréfié `#4A2E1F` → panneaux, bois sombre · Moka `#7A4E33` → comptoir, traverses · Noisette `#A8734A` → biseaux, bois clair · **Crème `#F2E6CF`** → texte, mousse, papier · Latte `#C9A882` → carton, texte secondaire · **Ambre Lampe `#F2A541`** → lanternes, lueurs, focus · **Rouge Rebelle `#C8323C`** → tampons, bannières, fils rouges · Rouge Rebelle Sombre `#8E1F28` |

**Jauges et sémantique** (rappel) : PV `#E04848` (critique `#FF8080`), PE `#3FB8E8`, Fatigue `#B48CFF` → `#D65DB1` (70–89) → `#FF4D6D` (90–100, motif rayé), Succès `#5BD17A`, Avertissement `#F5A524`, Danger `#E8505B`. Postes 3x8 : Matin `#F6C453`, Après-midi `#F08A4B`, Nuit `#6A7BD1`.

**Couleurs de décor complémentaires** (palette maître du monde, à ajouter dans `art/palette/privatix.gpl`) :

| Nom | Hex | Usage |
|---|---|---|
| Brique montoise | `#8A3B2E` | Façades de la ville, voûtes de l'OCC |
| Pavé | `#6B6A70` | Grand-Place, rue de la Gare |
| Rail rouillé | `#7C4A2C` | Rails, ferraille, escaliers techniques |
| Verre BAG | `#9CC7D9` | Façades vitrées du BAG |
| Moquette corporate | `#7D828C` | Sols du BAG |
| Plante en plastique | `#4FA35A` | Décor BAG, Passage du Centre |
| Gilet orange | `#FF7A1A` | Gilets haute visibilité, chasubles, cônes |
| Turquoise Disruption | `#19C3B1` | **Couleur signature Privatix** : badges, lanyards, bâches, écrans KPI (tous les ennemis en portent une touche) |
| Contour sombre | `#14101A` | Contour 1 px des personnages (jamais `#000000` pur) |

Règle : **32 couleurs maximum par tileset**, 16 maximum par personnage (contour compris). Lumière venant du **haut-gauche**, ombres portées à 45° vers le bas-droite, en `#0B1F3A` à 40 %.

### 1.4 Ambiance par zone

| Zone (canon) | Matières dominantes | Lumière | Palette clé | Repères visuels |
|---|---|---|---|---|
| **Gare de Mons & Calatrava** (hub) | Acier blanc, verre, béton, granito du hall | Néons froids, grandes verrières | Blanc Affiche, Gris Ballast, Bleu Institution, Jaune Quai | Arcs blancs de la passerelle, ligne jaune des quais, écrans des départs, trains à l'arrêt servant de murs |
| Salle des pauses · couloir technique | Formica, frigo collectif · tuyaux, câbles, peinture écaillée | Néon verdâtre qui tremble · faible, hublots grillagés | Gris, Crème · Bleu Nuit, Rail rouillé | Micro-ondes « sacré », tableau des roulements · porte « Réservé au personnel », distributeur « HORS SERVICE » |
| **OCC** (lampisterie) | Briques voûtées, bois de traverse, cuivre | Lanternes de signalisation rouge/vert/blanc + ambre | Espresso → Ambre, Rouge Rebelle | La Vieille Dame (cafetière sacrée), tableau à palettes, casiers, tableau de liège à fils rouges |
| **Passage du Centre & Grand-Place** | Pavés, briques, galerie couverte vitrée | Lumière naturelle, vitrines | Brique, Pavé, Crème, Gilet orange (barrières) | Friterie de Raymonde, vitrines « À louer », Beffroi au loin, barrières du Doudou, banderoles |
| **BAG** (4 étages) | Marbre, moquette grise, verre, inox | Blanc clinique → luxe doré en montant | Verre BAG, Moquette, Turquoise Disruption | Écrans KPI, plantes en plastique, portiques à badge, photocopieuse, vue sur Mons |

### 1.5 Ambiances des pauses 3x8 (overlays de couleur)

Un seul jeu de tuiles par zone ; la pause est rendue par un **overlay plein écran** (rectangle `setScrollFactor(0)` à la profondeur juste sous l'UI, ou `camera.postFX` en WebGL) + des **sprites de lumière** additifs.

| Pause | Heures | Overlay principal | Mode de fusion | Alpha | Complément |
|---|---|---|---|---|---|
| **Matin** (Acte I) | 06:00–14:00 | `#CFE3FF` (bleu froid) | `MULTIPLY` | 0,25 | Lueur d'aube `#F6C453` en `ADD` à 0,06 sur les verrières |
| **Après-midi** (Acte II) | 14:00–22:00 | `#FFC08A` (orangé) | `MULTIPLY` | 0,30 | Ombres allongées (sprites d'ombre décalés) |
| **Nuit** (Acte III) | 22:00–06:00 | `#3A4A9A` (bleu nuit) | `MULTIPLY` | 0,55 | Halos de lampadaires et d'écrans `#FFE9A8` en `ADD` 0,35 ; fenêtres allumées |
| **Aube du boss** (5h00) | fin de nuit | `#6A7BD1` → `#F6C453` (fondu 10 tours) | `MULTIPLY` | 0,45 → 0,15 | Synchronisé avec le compteur de signature |
| **OCC** | toutes | aucun | — | — | Ambiance fixe (souterrain) ; seules les lanternes clignotent |

Transition de pause : interpolation de l'overlay sur 1,5 s + bandeau « Relève : poste Après-midi » + carillon. Option « Réduire les effets » : changement instantané.

### 1.6 Lisibilité

- Silhouette identifiable en **noir plein à 16×24** : chaque personnage a un attribut unique (sifflet de Rudy, thermos de Josiane, casque Infrabel de Kevin, oreillette de Vanderslide, chaise à roulettes du Réorganisateur).
- Personnages : contour 1 px `#14101A` ; décors : **pas de contour noir**, contraste par valeurs. Les éléments interactifs (PNJ, coffres, portes, distributeur) ont un **reflet clair** de 1 px et une légère animation (2 frames) pour se détacher.
- Collisions lisibles : ce qui bloque a une **base sombre** ; ce qui est franchissable n'a pas d'ombre portée.
- Ennemis toujours marqués par la **Turquoise Disruption** ; alliés de l'OCC par une touche d'**Ambre** ou de **Rouge Rebelle** (brassard, tasse, badge OCC).
- Jamais d'information portée par la couleur seule (cf. UX) : icône + forme + libellé.

### 1.7 À éviter absolument

| Interdit | Alternative autorisée |
|---|---|
| Logo SNCB réel, logo Infrabel, NMBS, flèches officielles | **Ovale générique** blanc sur bleu ; « B » ou « P » stylisé **dessiné par nous**, non superposable au logo réel |
| Polices propriétaires de la signalétique ferroviaire réelle | Press Start 2P, Pixelify Sans, m6x11 (licences libres) |
| Marques réelles (boissons, cafés, cabinets de conseil, logiciels, trottinettes, briques de construction) | Marques fictives : « Privatix Rail Solutions », « Synergia », « Café Corporate » |
| Visages ou silhouettes de personnes réelles (dirigeants, élus, architectes) | Personnages fictifs du canon |
| Décalque de photos de la gare de Mons ou du BAG | Inspiration libre, croquis de mémoire, proportions réinventées |
| Annonce sonore réelle de gare, jingle réel, voix d'un·e annonceur·se identifiable | Carillon 3 tons **original**, voix synthétique (cf. §3.7) |
| Logos et visuels officiels de la Ville ou du Doudou | Dragon gonflable fictif « sponsorisé Privatix » |
| Assets sous licence NC (non commercial) ou ND (pas de modification) | CC0, CC-BY, OFL |

---

## 2. Sources libres et outils

### 2.1 Kenney.nl (CC0 — usage libre, crédit apprécié)

**Téléchargement** : `https://kenney.nl/assets/<nom-du-pack>` → bouton « Download » (le don est facultatif) → archive `.zip`. Décompresser dans `art/vendor/kenney/<pack>/` (hors de `public/`), puis **ne copier dans `public/assets/` que les fichiers retravaillés**. Les noms exacts des packs évoluent : rechercher le titre sur le site si un lien ne répond pas.

| Pack Kenney | Usage dans Privatix | Fichiers à prendre |
|---|---|---|
| **Tiny Town** (16×16) | Ville : pavés, façades, toits, végétation, clôtures | `Tilemap/tilemap_packed.png` (sans marge) ou tuiles individuelles `Tiles/tile_XXXX.png` |
| **Tiny Dungeon** (16×16) | OCC (briques voûtées, coffres, tonneaux), personnages de base pour placeholders | `Tilemap/tilemap_packed.png` |
| **Roguelike/RPG pack** (16×16, marge 1 px) | Mobilier, portes, escaliers, objets divers | `Spritesheet/roguelikeSheet_transparent.png` (marge 1 px à respecter au découpage) |
| **RPG Urban Pack** (16×16) | Gare et ville : routes, trottoirs, véhicules, bancs, lampadaires | `Tilemap/tilemap_packed.png` |
| **Roguelike Modern City** / **Roguelike Indoors** (16×16) | BAG, salle des pauses : bureaux, chaises, écrans, plantes, frigo | feuilles `*_transparent.png` |
| **Roguelike Characters** (16×16) | Bases de PNJ voyageurs (à recadrer en 16×24) | `Spritesheet/roguelikeChar_transparent.png` |
| **UI Pack** + **UI Pack (Pixel Adventure)** | Bases de panneaux 9-slice, boutons, flèches, curseurs | `PNG/` (styles « Blue » et « Brown » → recolorés SNCB / OCC) |
| **Input Prompts** (version Pixel 16×) | Touches clavier, croix de manette, gestes tactiles | `Tilemap/` ou PNG `Keyboard & Mouse`, `Touch` |
| **Game Icons** | Icônes systèmes : réglages, son, plein écran, pause | `PNG/White/1x/` |
| **Interface Sounds** + **Impact Sounds** | Clics, validation, erreur ; coups, chutes, métal, pas | `Audio/*.ogg` (familles `footstep_concrete`, `impactMetal`, `impactPlate`) |
| **RPG Audio**, **UI Audio**, **Music Jingles**, **Particle Pack** | Portes, pièces, cliquetis ; jingles 8-bit victoire/défaite/level-up ; étincelles et fumée (à réduire en pixel-art) | `Audio/*.ogg`, `Audio/8-bit jingles/`, `PNG (Transparent)/` |

**Recoloration aux teintes SNCB/OCC** :

1. **Aseprite** (payant, ou compilé depuis les sources) : `Fichier > Ouvrir` → `Sprite > Mode couleur > Indexé` → dans la palette, `Options > Charger la palette` (`art/palette/privatix.gpl`) → `Édition > Remplacer la couleur` (Maj+R) couleur par couleur, ou `Sprite > Mode couleur > Indexé` avec « Palette actuelle » pour un remappage automatique, puis vérifier à la main.
2. **LibreSprite** (gratuit, fork libre) : mêmes menus (`Sprite > Color Mode > Indexed`, `Edit > Replace Color`).
3. **Piskel** (navigateur, gratuit) : importer le PNG → outil seau **« Paint all pixels of the same color »** (Maj+clic) pour remplacer une teinte partout → export PNG.
4. Correspondances type : bleu Kenney → `#123C73` / `#1F5AA6` ; jaunes → `#FFD200` ; bruns → `#4A2E1F` / `#7A4E33` / `#A8734A` ; blancs → `#F4F6F8` (SNCB) ou `#F2E6CF` (OCC). Toujours **ajouter un détail original** (signalétique, objet satirique) pour donner une identité propre au jeu.

### 2.2 OpenGameArt.org (licences variables — vérifier chaque fichier)

**Recherche** : `https://opengameart.org` → `Browse` → `Art Type` (2D Art, Music, Sound Effect) → filtre **License** : cocher **CC0**, **CC-BY 3.0/4.0**, **OGA-BY 3.0** ; mots-clés : `16x16`, `tileset`, `urban`, `city`, `industrial`, `office`, `train`, `station`, `subway`, `chiptune`, `8-bit`, `jingle`, `footsteps`, `ui click`.

Exemples de packs à viser : **tilesets urbains / industriels 16×16** (`16x16 city`, `industrial tileset`, `modern interior 16x16` → gare, couloir technique, BAG) ; **trains et rails vus de dessus** (`train top down`, `railway tileset` → quais, wagons-murs) ; **chiptune** (`chiptune loop`, `8-bit rpg`, `jazz lofi` → BGM provisoires) ; **SFX** (`steam`, `coffee`, `whistle`, `door creak`, `paper` → café, sifflet, porte de l'OCC, Post-it).

**Vérification obligatoire avant import** :

1. Lire la licence **sur la page de l'asset** (une collection peut mélanger plusieurs licences ; prendre la plus contraignante).
2. Refuser **NC**, **ND**, et par défaut **CC-BY-SA / GPL** (partage à l'identique contraignant : à valider avec la production au cas par cas).
3. Relever : titre exact, auteur (pseudo + nom si fourni), URL, licence et version, modifications apportées.
4. Respecter le **texte d'attribution demandé** par l'auteur, puis reporter immédiatement l'entrée dans `CREDITS.md` (cf. §7) **dans le même commit** que l'asset.

Autres sources compatibles : **Freesound.org** (filtrer « Creative Commons 0 » ; refuser tout enregistrement d'annonce réelle de gare), **itch.io** (packs gratuits : lire la licence de chaque page).

### 2.3 Polices

| Police | Rôle | Source | Licence | Remarques |
|---|---|---|---|---|
| **Press Start 2P** | Titres, chiffres, horloge, n° de voie, dégâts | Google Fonts | SIL OFL 1.1 | Pixel-perfect en multiples de 8 px |
| **Pixelify Sans** | Corps de texte (prototype et repli) | Google Fonts | SIL OFL 1.1 | Rendu net à 16 px |
| **m6x11** (Daniel Linssen) | Corps de texte (production, recommandé) | itch.io de l'auteur | Libre, crédit demandé (vérifier la page) | Taille pixel-perfect indiquée par l'auteur |
| Afficheur maison « Palettes » | Afficheur de quai / tableau des départs (v1) | Création interne | Propriété du projet | Glyphes 8×12, style volets |

**Conversion en BitmapFont** (Phaser lit `.png` + `.xml` au format BMFont XML) :

- **snowb.org** (SnowB BMF, navigateur) : importer le `.ttf`, taille 16 (ou 8 pour Press Start 2P), **désactiver l'anticrénelage / « smooth »**, padding 1, jeu de caractères Latin-1 + `’ « » … € œ Œ`, export **BMFont XML** → renommer en `.xml`.
- **Hiero** (libGDX, Java) : « Rendering : Java », décocher « Smooth », effet couleur blanc, `File > Save BMFont` (format texte → convertir en XML).
- **BMFont** (AngelCode, Windows) : `Export options > Font descriptor : XML`, textures PNG 32 bits, « Render from TrueType outline » décoché + « Font smoothing » décoché.
- Exporter en **blanc** : la couleur est appliquée par `setTint()` selon le thème.

### 2.4 Outils recommandés

Pixel-art : Aseprite (payant), LibreSprite, Piskel · Cartes : **Tiled** ≥ 1.10 · Extrusion : `tile-extruder` (npm) · Atlas : free-tex-packer, TexturePacker (version gratuite) · SFX rétro : jsfxr, ChipTone, Bfxr · Musique : BeepBox, FamiStudio, LMMS · Audio : Audacity, `ffmpeg` · Voix : eSpeak NG (synthèse par formants).

---

## 3. Liste exhaustive des assets

**Légende** — Chemins relatifs à `public/assets/` (URL du pack = `assets/` + chemin). Priorités : **MVP** (jouable de bout en bout en gris), **v1** (version publique), **v2** (bonus). Sources : **K** = Kenney recoloré, **OGA** = OpenGameArt, **I** = création interne, **G** = généré (sfxr, eSpeak, BeepBox).

### 3.1 Tilesets (images extrudées, 16×16, marge 1, espacement 2)

| Fichier | Clé `AssetKeys` | Type | Dimensions (avant extrusion) | Prio | Source |
|---|---|---|---|---|---|
| `images/tilesets/tiles-gare.png` | `tiles-gare` | `image` | 256×256 (16×16 tuiles) : quais, ligne jaune, rails, ballast, passerelle (arcs, garde-corps), hall (granito, guichets, vitrines), escalators | MVP | K (RPG Urban, Modern City) + I |
| `images/tilesets/tiles-gare-interieur.png` | `tiles-gare-interieur` | `image` | 256×192 : salle des pauses (formica, frigo, micro-ondes, tableau des roulements), couloir technique (tuyaux, câbles, portes) | MVP | K (Roguelike Indoors) + I |
| `images/tilesets/tiles-occ.png` | `tiles-occ` | `image` | 256×192 : briques voûtées, traverses, casiers, lanternes, tableau à palettes, canapé, comptoir | MVP | K (Tiny Dungeon) + I |
| `images/tilesets/tiles-ville.png` | `tiles-ville` | `image` | 256×320 : pavés, trottoirs, façades briques, galerie vitrée du Passage du Centre, friterie, terrasses, Beffroi (fond), barrières du Doudou | v1 | K (Tiny Town, RPG Urban) + I |
| `images/tilesets/tiles-bag.png` | `tiles-bag` | `image` | 256×320 : marbre, moquette, cloisons vitrées, open-space, table ovale « Synergie », bureau du Directeur, baie vitrée | v1 | K (Modern City, Indoors) + I |
| `images/tilesets/tiles-commun.png` | `tiles-commun` | `image` | 128×128 : collisions invisibles, eau, ombres, transitions | MVP | I |

### 3.2 Objets de décor interactifs et animés (clé `atlas-props`, type `atlas`, JSON Hash, padding 2)

| Frame (dans `images/atlas/props.png` + `props.json`) | Taille | Frames | Prio | Source |
|---|---|---|---|---|
| `distributeur-hors-service-idle-0..1` (écran qui clignote « HORS SERVICE ») | 16×32 | 2 | MVP | I |
| `distributeur-hors-service-pivot-0..5` (le mur pivote, code 7-1-2) | 32×32 | 6 | MVP | I |
| `vieille-dame-0..3` (cafetière sacrée de l'OCC, vapeur ; point de sauvegarde) | 32×32 | 4 | MVP | I |
| `machine-cafe-premium-0..1` (BAG, « Détartrage nécessaire ») | 16×32 | 2 | v1 | I |
| `photocopieuse-0..3` (BAG, voyant + flash de copie) | 32×32 | 4 | v1 | K + I |
| `borne-billets-0..1`, `portique-quai-0..2` (vert/rouge) | 16×32 | 2–3 | MVP | I |
| `valise-0..3` (4 variantes), `chariot-bagages` (poussable) | 16×16 | 1 | MVP | K |
| `panneau-quai-1..4`, `ecran-departs-0..3` (défilement) | 32×16 / 48×16 | 1 / 4 | MVP | I |
| `chaise-roulettes`, `plante-plastique`, `ecran-kpi-0..3`, `camera-surveillance-0..3` (BAG) | 16×16 / 16×32 | 1–4 | v1 | K + I |
| `micro-ondes-sacre`, `frigo-collectif`, `tableau-roulements` | 16×16 / 16×32 | 1 | MVP | K + I |
| `barriere-travaux-infrabel`, `barriere-doudou`, `trottinette`, `friterie-enseigne-0..1`, `singe-porte-bonheur` (v2) | 16×16 / 32×16 / 48×16 | 1–2 | v1 | I |
| `coffre-casier-0..1` (casier de vestiaire), `boite-aux-lettres` (Notes de service) | 16×16 | 2 / 1 | MVP / v1 | K + I |
| `porte-reserve-personnel-0..3`, `porte-badge-0..3`, `ascenseur-maintenance` | 16×32 | 4 / 1 | MVP / v1 | K + I |

### 3.3 Tilemaps Tiled (`tilemapTiledJSON`)

| Fichier | Clé | Taille (tuiles) | Tilesets intégrés | Prio |
|---|---|---|---|---|
| `tilemaps/gare-mons.json` | `map-gare-mons` | 80×50 (quais 1–4, passerelle, hall/passage commercial) | tiles-gare, tiles-commun | MVP |
| `tilemaps/gare-salle-pauses.json` | `map-gare-salle-pauses` | 20×15 | tiles-gare-interieur, tiles-commun | MVP |
| `tilemaps/gare-couloir-technique.json` | `map-gare-couloir-technique` | 30×12 | tiles-gare-interieur, tiles-commun | MVP |
| `tilemaps/occ.json` | `map-occ` | 24×16 | tiles-occ, tiles-commun | MVP |
| `tilemaps/ville-mons.json` | `map-ville-mons` | 100×70 (rue de la Gare → Passage du Centre → Grand-Place) | tiles-ville, tiles-commun | v1 |
| `tilemaps/ville-friterie.json` | `map-ville-friterie` | 12×10 | tiles-ville, tiles-commun | v1 |
| `tilemaps/bag-accueil.json` | `map-bag-accueil` | 40×30 | tiles-bag, tiles-commun | v1 |
| `tilemaps/bag-open-space.json` | `map-bag-open-space` | 40×30 | tiles-bag, tiles-commun | v1 |
| `tilemaps/bag-salle-synergie.json` | `map-bag-salle-synergie` | 40×30 | tiles-bag, tiles-commun | v1 |
| `tilemaps/bag-bureau-directeur.json` | `map-bag-bureau-directeur` | 40×30 | tiles-bag, tiles-commun | v1 |
| `tilemaps/bag-salle-conseil.json` | `map-bag-salle-conseil` | 30×20 | tiles-bag, tiles-commun | v1 |

**Calques standardisés** (noms exacts, dans cet ordre, du bas vers le haut) :

| Calque | Type Tiled | Rôle | Rendu Phaser |
|---|---|---|---|
| `ground` | Tuiles | Sol, rails, pavés | depth 0 |
| `decor` | Tuiles | Murs, mobilier bas, éléments sous le joueur | depth 10 |
| `collision` | Tuiles | Tuiles avec propriété booléenne `collides: true` | invisible |
| `objects` | Objets | Points d'intérêt (cf. ci-dessous) | lu par un parseur pur |
| `above` | Tuiles | Hauts de murs, arcs de la passerelle, feuillage, auvents | depth 100 (au-dessus du joueur) |

**Objets du calque `objects`** (champ `type`/« Class » de Tiled + propriétés personnalisées typées) :

| `type` | Forme | Propriétés obligatoires | Propriétés optionnelles |
|---|---|---|---|
| `spawn` | Point | `id: string` (ex. `default`, `from-occ`), `facing: string` (`down|up|left|right`) | — |
| `portal` | Rectangle | `targetMap: string` (clé de carte), `targetSpawn: string` | `requiresFlag: string`, `requiresItem: string`, `code: string` (ex. `7-1-2`), `transition: string` (`fade|door`) |
| `npc` | Point | `npcId: string`, `dialogueId: string`, `facing: string` | `shifts: string` (`morning,afternoon,night`), `movement: string` (`static|wander|patrol`), `requiresFlag: string` |
| `chest` | Point | `chestId: string`, `itemId: string`, `qty: int` | `requiresItem: string`, `kind: string` (`casier|boite-aux-lettres|carton`) |
| `trigger` | Rectangle | `eventId: string`, `once: bool` | `shifts: string`, `requiresFlag: string`, `setFlag: string` |
| `encounter` | Rectangle | `tableId: string`, `rate: float` (0–1) | `shifts: string` |
| `savepoint` | Point | `saveId: string` | `healFull: bool`, `freeCoffee: bool` (machine de l'OCC) |

### 3.4 Personnages d'exploration (spritesheets 16×24)

Disposition standard : **5 colonnes × 4 lignes** = 80×96 px. Lignes : `down`, `left`, `right`, `up` ; colonne 0 = idle, colonnes 1–4 = marche. Animations : `anim-<entite>-walk-<dir>` (8 fps), `anim-<entite>-idle-<dir>`.

| Fichier `images/characters/world/…` | Clé | Type | Frames | Prio | Source |
|---|---|---|---|---|---|
| `hero-leon.png` / `hero-lea.png` | `ss-hero-leon` / `ss-hero-lea` | `spritesheet` 16×24 | 20 | MVP | I (base K Roguelike Characters) |
| `npc-marcel.png`, `npc-josiane.png`, `npc-rudy.png`, `npc-bene.png` | `ss-npc-marcel`… | `spritesheet` 16×24 | 20 | MVP | I |
| `npc-yasmina.png`, `npc-kevin.png`, `npc-fatou.png` | `ss-npc-yasmina`… | `spritesheet` 16×24 | 20 | v1 | I |
| `npc-fantome-wagon-bar.png` (semi-transparent, flottant) | `ss-npc-fantome-wagon-bar` | `spritesheet` 16×24 | 20 | v2 | I |
| `npc-jean-mi.png` | `ss-npc-jean-mi` | `spritesheet` 16×24 | 20 | MVP | I |
| `npc-raymonde.png`, `npc-papy-roger.png` | `ss-npc-raymonde`, `ss-npc-papy-roger` | `spritesheet` 16×24 | 20 | v1 | I |
| `npc-voyageur-1..5.png` (navetteur pressé, étudiante sac à dos, mamie au cabas, touriste à valise, agent d'entretien) | `ss-npc-voyageur-1..5` | `spritesheet` 16×24 | 20 | MVP (2) / v1 (5) | K recoloré |
| `enemy-consultant.png`, `enemy-manager-kpi.png`, `enemy-coach-agile.png` | `ss-enemy-…` | `spritesheet` 16×24 | 20 | MVP / MVP / v1 | I |
| `enemy-reorganisateur-rh.png` (glisse sur chaise) | `ss-enemy-reorganisateur-rh` | `spritesheet` 16×24 | 20 | v1 | I |
| `enemy-securite.png`, `enemy-hotesse-holo.png`, `enemy-borne.png` | `ss-enemy-…` | `spritesheet` 16×24 | 20 / 4 / 4 | v1 | I |
| `boss-vanderslide.png` (trottinette, cinématiques) | `ss-boss-vanderslide-world` | `spritesheet` 16×24 | 20 | v1 | I |

### 3.5 Portraits de dialogue (64×64, affichés ×2)

Une feuille par personnage, **4 expressions** en ligne (`neutre`, `ironique`, `agace`, `choque`) = 256×64. PNJ mineurs : 2 expressions (128×64). La `DialogueBox` doit réserver un cadre **128×128** (au lieu de 112×112 dans la maquette UX).

| Fichier `images/characters/portraits/…` | Clé | Frames | Prio |
|---|---|---|---|
| `portrait-leon.png`, `portrait-lea.png` | `ss-portrait-leon`, `ss-portrait-lea` | 4 | MVP |
| `portrait-marcel.png`, `portrait-josiane.png`, `portrait-rudy.png`, `portrait-bene.png`, `portrait-jean-mi.png` | `ss-portrait-<nom>` | 4 | MVP |
| `portrait-yasmina.png`, `portrait-kevin.png`, `portrait-fatou.png`, `portrait-raymonde.png`, `portrait-papy-roger.png` | `ss-portrait-<nom>` | 4 | v1 |
| `portrait-voyageur-1..5.png`, `portrait-grand-mere.png` (2 expr.) ; `portrait-fantome-wagon-bar.png` | `ss-portrait-…` | 2 / 4 | v1 / v2 |
| `portrait-consultant.png`, `portrait-manager-kpi.png`, `portrait-coach-agile.png`, `portrait-reorganisateur-rh.png` | `ss-portrait-…` | 4 | MVP (2) / v1 |
| `portrait-vanderslide.png` ; `portrait-rentabilis-visio.png` (carré noir « caméra éteinte », initiales HR, onde sonore animée) | `ss-portrait-vanderslide`, `ss-portrait-rentabilis-visio` | 4 | v1 |
| `portrait-annonce-gare.png` (haut-parleur stylisé) | `ss-portrait-annonce-gare` | 2 | MVP |

Toutes les feuilles de portraits sont regroupées en v1 dans un atlas `atlas-portraits` (frames `portrait-<nom>-<expression>`).

### 3.6 Combat

**Sprites de combat** (vue de côté ; héros tournés vers la **gauche**, ennemis vers la **droite** ; affichés ×2). Grille : 4 colonnes × 5 lignes ; lignes `idle` (4), `attack` (4), `skill` (4), `hit` (2), `ko`/`victory` (1+2).

| Fichier `images/battle/…` | Clé | Type | Frame / feuille | Prio | Source |
|---|---|---|---|---|---|
| `heroes/battle-leon.png`, `battle-lea.png` (clé de tirefond) | `ss-battle-leon`, `ss-battle-lea` | `spritesheet` | 48×48 / 192×240 | MVP | I |
| `heroes/battle-<nom>.png` : `marcel`, `josiane`, `rudy`, `bene`, `yasmina`, `kevin`, `fatou`, `jean-mi` | `ss-battle-<nom>` | `spritesheet` | 48×48 / 192×240 | MVP (Josiane) / v1 | I |
| `heroes/battle-fantome-wagon-bar.png` (invocation « Service à la place ») | `ss-battle-fantome-wagon-bar` | `spritesheet` | 48×48 / 192×96 | v2 | I |
| `enemies/battle-consultant.png` (variantes Senior et Stagiaire = palette alternative ou `setTint`) | `ss-battle-consultant` | `spritesheet` | 48×48 / 192×240 | MVP | I |
| `enemies/battle-manager-kpi.png` (hologramme de camemberts) | `ss-battle-manager-kpi` | `spritesheet` | 64×64 / 256×320 | MVP | I |
| `enemies/battle-coach-agile.png` | `ss-battle-coach-agile` | `spritesheet` | 64×64 / 256×320 | v1 | I |
| `enemies/battle-reorganisateur-rh.png` (classeur « PROVISOIRE v14 », chaise) | `ss-battle-reorganisateur-rh` | `spritesheet` | 64×64 / 256×320 | v1 | I |
| `enemies/battle-borne.png`, `battle-securite.png`, `battle-hotesse-holo.png`, `battle-postit-vivant.png`, `battle-photocopieuse.png` | `ss-battle-<nom>` | `spritesheet` | 48×48 / 192×240 | MVP (borne) / v1 | I + K |
| `enemies/battle-dragon-gonflable.png` (Doudou, sponsorisé Privatix) | `ss-battle-dragon-gonflable` | `spritesheet` | 96×96 / 384×480 | v1 | I |
| `bosses/vanderslide-p1.png` « Méga-Deck 2030 » | `ss-boss-vanderslide-p1` | `spritesheet` | 96×96 / 384×480 | v1 | I |
| `bosses/vanderslide-p2.png` « Conseil d'Administration en visio » (clauses-tentacules) | `ss-boss-vanderslide-p2` | `spritesheet` | 128×128 / 512×640 | v1 | I |
| `bosses/vanderslide-p3.png` « L'Optimiseur Absolu » (fusion photocopieuse) | `ss-boss-vanderslide-p3` | `spritesheet` | 128×128 / 512×640 | v2 | I |
| `bosses/conseil-visio.png` (carrés noirs à initiales, 6 variantes) | `ss-boss-conseil-visio` | `spritesheet` | 32×32 / 192×64 | v1 | I |


**Effets de combat** (atlas `atlas-fx`, `images/atlas/fx.png` + `fx.json`, affichés ×2) :

| Frames | Taille | Nb | Prio |
|---|---|---|---|
| `fx-slash-0..5` (coup de clé de tirefond) | 32×32 | 6 | MVP |
| `fx-postit-0..7` (Tempête de Post-it, papiers fluo) | 32×32 | 8 | MVP |
| `fx-bouclier-0..5` (Réunion d'alignement, bulle turquoise) | 64×64 | 6 | MVP |
| `fx-sommeil-0..3` (Zzz), `fx-confusion-0..3` (?!) · `fx-cafe-0..5` (vapeur, Caféiné) | 16×16 · 32×32 | 4 · 6 | MVP |
| `fx-etincelles-catenaire-0..7` (Kevin) | 64×32 | 8 | v1 |
| `fx-sifflet-0..3` (Rudy), `fx-tampon-bloque-0..3` (Formulaire) | 32×32 | 4 | v1 |
| `fx-soin-0..5` (Fatou, croix verte), `fx-critique-0..3` (éclat jaune) | 32×32 | 6 / 4 | MVP |
| `fx-preuve-0..7` (fragment PHR-2030 qui déchire le contrat), `fx-tentacule-clause-0..5`, `fx-photocopie-flash-0..3` | 64×64 | 8 / 6 / 4 | v1 / v1 / v2 |
| `fx-compteur-signature-0..10` (stylo et contrat, 11 états) | 48×16 | 11 | v1 |

**Fonds de combat** (`image`, **480×270** affichés ×2 ; zone utile en haut, l'UI couvre le bas) :

| Fichier `images/battle/backgrounds/…` (clé = `img-` + nom) | Prio | Remarque |
|---|---|---|
| `bg-quai.png` | MVP | Overlay de pause appliqué (matin / après-midi / nuit) |
| `bg-quai-nuit.png`, `bg-hall.png`, `bg-salle-pauses.png` | v1 | Variante de nuit peinte (lampadaires, écrans) |
| `bg-occ.png` (raid sur le QG) | v1 | Sans overlay |
| `bg-passage-centre.png`, `bg-grand-place-doudou.png` | v1 | Foule en parallax |
| `bg-bag-accueil.png`, `bg-bag-open-space.png`, `bg-bag-synergie.png` | v1 | Blanc clinique → luxe |
| `bg-bag-conseil-aube.png` | v1 | Vue sur Mons, aube progressive (5h00) |

### 3.7 Interface (atlas `atlas-ui` : `images/atlas/ui.png` + `ui.json`)

| Frame(s) | Taille | Prio | Source |
|---|---|---|---|
| `panel-sncb`, `panel-occ`, `panel-board` (tableau des départs), `panel-danger`, `panel-rebel` | 24×24, coins 8 px (9-slice) | MVP | K (UI Pack) recoloré |
| `button-sncb-normal/hover/pressed/disabled`, idem `button-occ-*` | 24×24 9-slice | MVP | K + I |
| `cursor-0..1` (flèche de quai), `cursor-target-0..3` (▼ ciblage) | 8×8 / 16×16 | MVP | I |
| `icon-pv` (cœur), `icon-pe` (éclair), `icon-fatigue` (lune), `icon-cafe` (tasse), `icon-ticket`, `icon-grain`, `icon-horloge`, `icon-cadenas`, `icon-moral` , `icon-shift-matin` (soleil levant), `icon-shift-aprem` (soleil), `icon-shift-nuit` (lune) | 16×16 | MVP | K (Game Icons) + I |
| `status-cafeine`, `status-syndique`, `status-demotive`, `status-bloque`, `status-burnout`, `status-confusion`, `status-sommeil`, `status-bouclier` | 12×12 | MVP | I |
| `gauge-frame`, `gauge-fill`, `gauge-stripes` (motif burn-out) | 8×8 9-slice / 8×8 | MVP | I |
| `clock-afficheur` (cadre d'afficheur de quai), `clock-digits-0..9`, `clock-colon-0..1`, `clock-bar-3x8` | 200×80 / 8×12 / 192×8 | MVP (cadre) / v1 (chiffres à palettes) | I |
| `dpad-base`, `dpad-arrow-up/down/left/right`, `btn-a`, `btn-b`, `btn-menu` | 80×80 (×2) / 40×40 / 26×26 | MVP | K (Input Prompts) + I |
| `key-<nom>` (prompts clavier/manette), `stamp-confidentiel`, `banner-occ` | 16×16 / 64×24 / 9-slice | v1 | K (Input Prompts) + I |

| Fichier | Clé | Type | Dimensions | Prio |
|---|---|---|---|---|
| `images/ui/logo.png` (ovale générique + « P » stylisé original + « PRIVATIX ») | `img-logo` (déjà déclarée : `AssetKeys.Logo`) | `image` | 256×96 | MVP |
| `images/ui/title-bg.png` (gare de nuit, arches, parallax 3 plans) | `img-title-bg` | `image` | 480×270 ×3 calques | v1 |
| `images/ui/rotate-device.png` (« Tournez votre téléphone ») | `img-rotate-device` | `image` | 64×64 | v1 |

**Icônes d'objets** (atlas `atlas-items`, `images/atlas/items.png` + `items.json`, 16×16, affichées ×2 en liste et ×4 en détail) :

| Catégorie | Frames (`item-<id>`) | Prio |
|---|---|---|
| Consommables (GDD) | `expresso`, `double-lungo`, `cafe-occ`, `gaufre-liege`, `cornet-frites`, `formulaire-triple`, `tract-syndical` | MVP |
| Friterie de Raymonde | `fricadelle`, `cornet`, `sauce-andalouse` | v1 |
| Équipements | `gilet-orange`, `cle-manoeuvre`, `thermos-occ`, `montre-chef-gare`, `cle-tirefond-1`, `cle-tirefond-2`, `cle-tirefond-3` | MVP (clé 1) / v1 |
| Objets clés | `reglement`, `fragment-phr-1`, `fragment-phr-2`, `fragment-phr-3`, `badge-agent`, `badge-visiteur-bag`, `brassard-benevole`, `crin-porte-bonheur`, `cle-usb-confidentiel`, `tasse-releve` | MVP (badge, fragments) / v1 |
| Butin et monnaies | `ticket`, `grain-cafe`, `post-it`, `agrafeuse` | MVP |
| Collection et quêtes | `note-service` (12 variantes `note-service-01..12`), `carte-vins-1994`, `tablier-wagon-bar` | v1 / v2 |

### 3.8 Audio (`audio`, chaque entrée en **OGG + MP3**)

Déclaration : `"url": ["assets/audio/bgm/bgm-menu.ogg", "assets/audio/bgm/bgm-menu.mp3"]`.

| Fichier `audio/bgm/…` | Clé | Durée / boucle | Prio | Source |
|---|---|---|---|---|
| `bgm-menu` | `bgm-menu` | 1:30, boucle | MVP | G (BeepBox) / OGA |
| `bgm-gare-matin`, `bgm-gare-apres-midi`, `bgm-gare-nuit` (même thème, 3 arrangements, leitmotiv « ding-dong ») | `bgm-gare-…` | 2:00, boucle | MVP (matin) / v1 | I |
| `bgm-ville` | `bgm-ville` | 2:00, boucle | v1 | I |
| `bgm-doudou` (fanfare originale « à la manière de », pas de reprise d'enregistrement existant) | `bgm-doudou` | 1:30, boucle | v1 | I |
| `bgm-occ` (lo-fi jazz feutré) | `bgm-occ` | 2:00, boucle | MVP | I / OGA |
| `bgm-bag` (ambient corporate qui se corrompt ; 4 couches activables par étage) | `bgm-bag` | 2:00, boucle | v1 | I |
| `bgm-combat` | `bgm-combat` | 1:30, boucle | MVP | I / OGA |
| `bgm-boss-p1`, `bgm-boss-p2`, `bgm-boss-p3` | `bgm-boss-p…` | 1:30, boucle | v1 / v1 / v2 | I |
| `bgm-victoire`, `bgm-defaite` | `bgm-victoire`, `bgm-defaite` | 0:05, jingle | MVP | K (Music Jingles) |
| `bgm-fin-bonne` (« Le 7h12 est à l'heure »), `bgm-fin-mitigee` (« Phase pilote ») | `bgm-fin-…` | 2:30 | v1 | I |

| Fichier `audio/sfx/…` | Clé | Prio | Source |
|---|---|---|---|
| `sfx-pas-beton`, `sfx-pas-pave`, `sfx-pas-moquette` | `sfx-pas-…` | MVP / v1 | K (Impact Sounds) |
| `sfx-porte`, `sfx-porte-occ` (pivot du mur + grincement), `sfx-porte-badge-ok`, `sfx-porte-badge-ko` | `sfx-porte-…` | MVP | K + G |
| `sfx-annonce-jingle` (carillon 3 tons **original**) | `sfx-annonce-jingle` | MVP | G |
| `sfx-cafe-coule`, `sfx-machine-cafe` (percolateur), `sfx-distributeur-touche` (code 7-1-2) | `sfx-…` | MVP | OGA / G |
| `sfx-ui-move`, `sfx-ui-confirm` (« clac » de composteur), `sfx-ui-cancel`, `sfx-ui-error`, `sfx-dialogue-blip` | `sfx-ui-…` | MVP | K (Interface Sounds) |
| `sfx-coup`, `sfx-coup-metal`, `sfx-critique`, `sfx-esquive`, `sfx-ko` | `sfx-…` | MVP | K (Impact Sounds) |
| `sfx-postit` (froissements multiples), `sfx-bouclier`, `sfx-sommeil`, `sfx-soin`, `sfx-etincelles` | `sfx-…` | MVP / v1 | G (jsfxr) |
| `sfx-level-up`, `sfx-objet-obtenu`, `sfx-ticket`, `sfx-carillon-pause` (changement de pause), `sfx-pointeuse` | `sfx-…` | MVP | K (Music Jingles) / G |
| `sfx-photocopieuse`, `sfx-tampon`, `sfx-stylo-signature`, `sfx-sifflet`, `sfx-train-passage`, `sfx-freins` | `sfx-…` | v1 | OGA / Freesound CC0 / G |
| `sfx-ambiance-hall`, `sfx-ambiance-occ`, `sfx-ambiance-ville` (boucles 30 s) | `sfx-ambiance-…` | v1 | Freesound CC0 (sans voix identifiable) |

**Voix synthétique de gare** (`audio/voice/…`, clés `sfx-voix-<id>`, v1) : textes **originaux** générés avec **eSpeak NG** (voix `fr`, débit 140, hauteur 40), puis filtre passe-bande 300–3400 Hz + réverbération de hall dans Audacity, précédés de `sfx-annonce-jingle`. Aucune voix réelle, aucun enregistrement d'annonce existante. Lignes à produire : « Le train de 7h12 est supprimé. Raison : optimisation. », « Le train à destination de… est supprimé. Nous vous prions de nous excuser pour… », « Boisson indisponible pour raison de circulation. », « Relève : poste du matin / de l'après-midi / de nuit. », « Le train de 7h12 est à l'heure. » (fin). Variante gag : charabia « bla-bla » (blips filtrés) pour les annonces non porteuses d'information, toujours sous-titrées.

**Normalisation** : musique −18 LUFS intégrés, SFX −16 LUFS, crête −1 dBTP. Conversion :

```bash
ffmpeg -i in.wav -af loudnorm=I=-18:TP=-1 -c:a libvorbis -q:a 4 bgm-menu.ogg   # musique ≈ 128 kbps
ffmpeg -i in.wav -af loudnorm=I=-18:TP=-1 -c:a libmp3lame -b:a 128k bgm-menu.mp3
ffmpeg -i in.wav -af loudnorm=I=-16:TP=-1 -ac 1 -c:a libvorbis -q:a 2 sfx-coup.ogg  # SFX mono ≈ 96 kbps
```

### 3.9 Polices (`bitmapFont`, PNG blanc + XML BMFont)

| Fichiers `fonts/…` | Clé | Base | Usage | Prio | Source |
|---|---|---|---|---|---|
| `font-titre.png` + `font-titre.xml` | `font-titre` | Press Start 2P 8 px (affichée ×2, ×3, ×4) | Titres, h1/h2, horloge, n° de voie | MVP | Google Fonts → snowb.org |
| `font-texte.png` + `font-texte.xml` | `font-texte` | m6x11 (ou Pixelify Sans 16 px) | Dialogues, menus, journal | MVP | itch.io / Google Fonts → snowb.org |
| `font-chiffres.png` + `font-chiffres.xml` | `font-chiffres` | Press Start 2P, chiffres + `+ - % : /` contour 1 px | Dégâts flottants, valeurs de jauges | MVP | Google Fonts → snowb.org |
| `font-afficheur.png` + `font-afficheur.xml` | `font-afficheur` | Maison 8×12, style volets | Tableau des départs, afficheur de quai | v1 | I |

Prototype sans BitmapFont : WebFonts dans `index.html` + `document.fonts.ready` avant la première scène (cf. UX).

---

## 4. Conventions de nommage et pipeline

### 4.1 Nommage

- Fichiers et clés en **kebab-case**, minuscules, **ASCII sans accents** (`bene`, `reorganisateur-rh`, `apres-midi`).
- **Clé = préfixe de type + nom du fichier sans extension** (sauf tilesets/cartes/atlas, cf. tableau).
- Propriété TypeScript = clé en **PascalCase** : `'ss-hero-leon'` → `AssetKeys.SsHeroLeon`.

| Préfixe | Type de chargement | Exemple de clé | Exemple de fichier |
|---|---|---|---|
| `img-` | `image` | `img-logo`, `img-bg-quai` | `images/ui/logo.png` |
| `ss-` | `spritesheet` | `ss-hero-leon` | `images/characters/world/hero-leon.png` |
| `atlas-` | `atlas` | `atlas-ui` | `images/atlas/ui.png` + `ui.json` |
| `tiles-` | `image` (tileset extrudé) | `tiles-gare` | `images/tilesets/tiles-gare.png` |
| `map-` | `tilemapTiledJSON` | `map-gare-mons` | `tilemaps/gare-mons.json` |
| `bgm-` | `audio` (musique) | `bgm-occ` | `audio/bgm/bgm-occ.ogg` + `.mp3` |
| `sfx-` | `audio` (effet, voix) | `sfx-ui-confirm` | `audio/sfx/sfx-ui-confirm.ogg` + `.mp3` |
| `font-` | `bitmapFont` | `font-texte` | `fonts/font-texte.png` + `.xml` |
| `anim-` | animation (créée en code) | `anim-hero-leon-walk-down` | — |

Frames d'atlas : `{entite}-{action}-{direction}-{index}` (ex. `consultant-walk-down-0`) ou `{famille}-{nom}` pour l'UI (`icon-pv`, `item-fricadelle`).

### 4.2 Arborescence

```
public/assets/
├── asset-pack.json
├── images/
│   ├── tilesets/            tiles-*.png (extrudés)
│   ├── atlas/               ui, items, props, fx, portraits (.png + .json)
│   ├── characters/world/    hero-*, npc-*, enemy-*, boss-*
│   ├── characters/portraits/portrait-*.png
│   ├── battle/{heroes,enemies,bosses,backgrounds}/
│   └── ui/                  logo, fonds de titre, écrans isolés
├── tilemaps/                *.json (tilesets intégrés)
├── audio/{bgm,sfx,voice}/   *.ogg + *.mp3
└── fonts/                   font-*.png + font-*.xml
art/                         (racine du dépôt, NON publié)
├── palette/privatix.gpl
├── aseprite/                sources .aseprite
├── tiled/                   projet Tiled, .tmx/.tsx de travail
└── vendor/                  archives Kenney/OGA d'origine (non modifiées)
```

### 4.3 Tailles standard (natif → affichage)

Tuile 16×16 → ×2 · personnage d'exploration 16×24 (pieds en bas, origine `0.5, 1`) → ×2 · portrait 64×64 → ×2 · combat héros et ennemis communs 48×48, managers et élites 64×64, boss et dragon 96×96 à 128×128 → ×2 · fond de combat / titre 480×270 → ×2 · icônes UI et objets 16×16, statuts 12×12 → ×1 à ×4 · panneau 9-slice 24×24 (coins 8) étiré. Feuilles en multiples de la frame ; atlas ≤ **2048×2048** (mobile).

### 4.4 Pipeline par type

**Tilesets** — Dessiner sans marge (grille 16×16), puis extruder :

```bash
npx tile-extruder --tileWidth 16 --tileHeight 16 --margin 0 --spacing 0 \
  --input art/export/tiles-gare.png --output public/assets/images/tilesets/tiles-gare.png
# Résultat : marge 1, espacement 2 → map.addTilesetImage('tiles-gare', 'tiles-gare', 16, 16, 1, 2)
```

Dans Tiled, le tileset doit pointer vers l'image **extrudée** (marge 1, espacement 2) ; son **nom** = clé Phaser (`tiles-gare`).

**Tiled → JSON** — Tiled ≥ 1.10, orthogonal, 16×16 ; `Carte > Propriétés` : format de calque « CSV » ; tilesets **intégrés** (`Intégrer le tileset` — Phaser ne lit pas les `.tsx` externes) ; `Fichier > Exporter sous… > JSON` vers `public/assets/tilemaps/` ; option « Résoudre les types et propriétés d'objet » cochée. Les classes d'objets (`spawn`, `portal`…) sont définies dans l'éditeur de types personnalisés du projet Tiled partagé (`art/tiled/privatix.tiled-project`).

**Aseprite → spritesheet** — une balise (tag) par animation, une couche par élément :

```bash
aseprite -b art/aseprite/hero-leon.aseprite --sheet public/assets/images/characters/world/hero-leon.png \
  --sheet-type rows --sheet-columns 5          # grille régulière pour type "spritesheet"
aseprite -b art/aseprite/fx/*.aseprite --sheet art/export/fx.png --data art/export/fx.json \
  --format json-hash --sheet-pack --split-tags --filename-format "{title}-{frame}"
```

**Atlas** (UI, objets, props, effets, portraits) — free-tex-packer ou TexturePacker : format **JSON Hash (Phaser 3)**, padding **2 px**, **pas de rotation**, **pas de trim** pour les animations en grille (trim autorisé pour les icônes), extrusion 1 px, taille max 2048, PNG 32 bits.

**Configuration du pack** (`public/assets/asset-pack.json`, sections chargées par le Preloader) :

```json
{
  "main": { "files": [
    { "type": "image", "key": "tiles-gare", "url": "assets/images/tilesets/tiles-gare.png" },
    { "type": "tilemapTiledJSON", "key": "map-gare-mons", "url": "assets/tilemaps/gare-mons.json" },
    { "type": "spritesheet", "key": "ss-hero-leon", "url": "assets/images/characters/world/hero-leon.png", "frameConfig": { "frameWidth": 16, "frameHeight": 24 } },
    { "type": "atlas", "key": "atlas-ui", "textureURL": "assets/images/atlas/ui.png", "atlasURL": "assets/images/atlas/ui.json" },
    { "type": "bitmapFont", "key": "font-texte", "textureURL": "assets/fonts/font-texte.png", "fontDataURL": "assets/fonts/font-texte.xml" },
    { "type": "audio", "key": "bgm-occ", "url": ["assets/audio/bgm/bgm-occ.ogg", "assets/audio/bgm/bgm-occ.mp3"] }
  ] },
  "meta": { "app": "Privatix", "version": "1" }
}
```

Quand le poids augmentera, découper en sections `boot`, `world`, `battle`, `bag` et charger chaque section à la demande (`this.load.pack(key, url, 'battle')`).

**Clés côté code** (`src/config/constants.ts`, à compléter au fil de l'eau) :

```ts
export const AssetKeys = {
  AssetPack: 'asset-pack', Logo: 'img-logo', TilesGare: 'tiles-gare', MapGareMons: 'map-gare-mons',
  SsHeroLeon: 'ss-hero-leon', AtlasUi: 'atlas-ui', FontTexte: 'font-texte', BgmOcc: 'bgm-occ', SfxUiConfirm: 'sfx-ui-confirm',
} as const;
```

### 4.5 Checklist avant d'ajouter un asset

- [ ] Licence vérifiée (CC0, CC-BY, OFL ou interne) ; aucune marque, aucun logo réel, aucun visage réel.
- [ ] Palette respectée (`privatix.gpl`), contour `#14101A` pour les personnages, pas d'anticrénelage.
- [ ] Nom en kebab-case ASCII, dans le bon dossier, dimensions multiples de la frame.
- [ ] Tileset extrudé (marge 1, espacement 2) ; carte exportée en JSON avec tilesets intégrés et calques standard.
- [ ] Audio en **OGG + MP3**, normalisé, boucle sans clic (vérifiée dans Audacity).
- [ ] Entrée ajoutée dans **`public/assets/asset-pack.json`** et clé dans **`AssetKeys`** (`src/config/constants.ts`) ; aucune chaîne littérale dans les scènes.
- [ ] Ligne ajoutée dans **`CREDITS.md`** (même pour un asset interne : « Équipe Privatix »).
- [ ] Placeholder correspondant supprimé (même clé) ; test visuel à ×1, ×2 et ×3 ; `npm run build` sans erreur de chargement.
- [ ] Source (`.aseprite`, `.tmx`, projet BeepBox) commitée dans `art/`.

---

## 5. Placeholders (développer sans attendre les graphismes)

Principe : générer au démarrage des textures **portant exactement les clés finales**. Quand l'asset réel est déclaré dans le pack, il remplace le placeholder sans changer une ligne de gameplay. Un module `src/assets/placeholders.ts` (à créer par l'équipe dev) n'enregistre une texture que si la clé n'existe pas déjà (`scene.textures.exists(key)`), et s'appelle **après** le chargement du pack.

| Catégorie | Placeholder (couleur) |
|---|---|
| Sol / mur / collision | Carré 16×16 plein ou bordé (`#9FB0C6` / `#123C73` / `#E8505B` à 50 %) |
| Héros / alliés OCC / ennemis | Rectangle 16×24 ou 48×48 + marque de direction (`#FFD200` / `#F2A541` / `#19C3B1`) |
| Portraits, objets, icônes | Carré 64×64 ou 16×16 + initiales ou lettre (couleur du camp, `#F2E6CF`) |
| Fonds de combat | Bandes 480×270 dans la couleur de la pause |
| Sons | Un bip `jsfxr` exporté une fois (`sfx-placeholder`) |

```ts
// Mêmes clés que les assets finaux ; une texture simple se fait de même avec fillRect + generateTexture.
/** Spritesheet 5×4 (idle + 4 frames de marche × 4 directions) avec frames numérotées comme une vraie feuille. */
export function makeCharacterSheet(scene: Phaser.Scene, key: string, fill: number): void {
  if (scene.textures.exists(key)) return;
  const fw = 16, fh = 24, cols = 5, rows = 4;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * fw, y = r * fh;
      g.fillStyle(fill, 1).fillRect(x + 2, y + 2 + (c % 2), fw - 4, fh - 4); // rebond de marche
      g.fillStyle(0x14101a, 1).fillRect(x + 6 + (r === 1 ? -3 : r === 2 ? 3 : 0), y + 6, 4, 2); // « regard »
    }
  }
  g.generateTexture(key, fw * cols, fh * rows);
  g.destroy();
  const tex = scene.textures.get(key);
  let i = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tex.add(i++, 0, c * fw, r * fh, fw, fh);
}
```

Tilemaps de prototype : dessiner les cartes MVP dans Tiled avec un tileset placeholder `tiles-commun` (carrés colorés numérotés, 16×16) ; les remplacer tuile par tuile ensuite grâce aux index identiques. Pour l'audio, un `AudioManager` doit ignorer silencieusement une clé absente (`scene.cache.audio.exists(key)`) en développement.

---

## 6. Plan de production par milestone

| Milestone | Objectif jouable | Assets à livrer | Critère de sortie |
|---|---|---|---|
| **M1 — MVP exploration gare** | Se déplacer sur les quais, la passerelle, le hall, la salle des pauses et le couloir technique ; ouvrir l'OCC (code 7-1-2) ; parler à Marcel, Josiane, Rudy, Béné, Jean-Mi ; sauvegarder à la Vieille Dame | `tiles-gare`, `tiles-gare-interieur`, `tiles-occ`, `tiles-commun` ; `map-gare-mons`, `map-gare-salle-pauses`, `map-gare-couloir-technique`, `map-occ` ; `ss-hero-leon/lea`, 5 PNJ + 2 voyageurs ; portraits MVP ; `atlas-props` (distributeur, Vieille Dame, portiques, panneaux) ; `atlas-ui` (panneaux, curseur, icônes, jauges, afficheur, D-pad) ; `img-logo` ; `font-titre`, `font-texte` ; `bgm-menu`, `bgm-gare-matin`, `bgm-occ` ; SFX UI, pas, portes, jingle, café ; overlay de pause | Parcours complet de l'Acte I hors combats, sur desktop et mobile, sans placeholder visible dans la gare |
| **M2 — Combat** | Combats contre Consultant (Slide-Ninja), Borne Automatique Rebelle et mini-boss Manager KPI ; équipe Léon/Léa + Josiane | `ss-battle-leon/lea/josiane`, `ss-battle-consultant/manager-kpi/borne` ; `atlas-fx` MVP (slash, Post-it, bouclier, sommeil, café, soin, critique) ; `img-bg-quai` ; `font-chiffres` ; statuts ; `atlas-items` MVP ; `bgm-combat`, `bgm-victoire`, `bgm-defaite` ; SFX de combat, level-up | Fin de l'Acte I jouable ; lisibilité validée à ×2 sur téléphone |
| **M3 — Ville** | Passage du Centre, Grand-Place, friterie de Raymonde, Papy Roger, Doudou, Coach Agile, Réorganisateur RH, ralliement des alliés | `tiles-ville`, `map-ville-mons`, `map-ville-friterie` ; PNJ Yasmina, Kevin, Fatou, Raymonde, Papy Roger, 5 voyageurs ; combats des 7 alliés ; `ss-battle-coach-agile`, `reorganisateur-rh`, `dragon-gonflable`, `securite`, `postit-vivant` ; fonds ville + OCC (raid) ; `bgm-ville`, `bgm-doudou`, `bgm-gare-apres-midi` ; objets de la friterie, fragments PHR-2030, Règlement | Acte II complet, trahison de Jean-Mi comprise |
| **M4 — BAG** | Accueil, Open-Space, Salle « Synergie », Bureau du Directeur, Salle du Conseil ; boss Vanderslide | `tiles-bag`, 5 cartes BAG ; `machine-cafe-premium`, `photocopieuse`, caméras, portes à badge ; `ss-battle-hotesse-holo`, `photocopieuse` ; `ss-boss-vanderslide-p1/p2`, `ss-boss-conseil-visio` ; portraits Vanderslide et Rentabilis (visio) ; `fx-preuve`, `fx-tentacule-clause`, `fx-compteur-signature` ; fonds BAG + `bg-bag-conseil-aube` ; `bgm-bag`, `bgm-boss-p1/p2`, `bgm-gare-nuit` ; voix de gare | Jeu terminable, 2 fins atteignables |
| **M5 — Polish** | Finitions et contenu bonus | Phase 3 « L'Optimiseur Absolu » + `bgm-boss-p3` ; Fantôme du Wagon-Bar ; 12 Notes de service ; `font-afficheur` et tableau des départs à palettes ; fonds de nuit peints ; fond de titre en parallax ; ambiances sonores ; `bgm-fin-bonne`, `bgm-fin-mitigee` ; prompts clavier/manette ; passe d'harmonisation des palettes et audit `CREDITS.md` | Zéro placeholder, audit licences signé, poids total < 40 Mo |

Ordre de travail recommandé par milestone : **(1)** placeholders + cartes en gris, **(2)** gameplay validé, **(3)** remplacement par Kenney recoloré, **(4)** pièces maîtresses internes (personnages, boss, OCC), **(5)** passe de cohérence palette/lumière.

---

## 7. Annexe : modèle `CREDITS.md`

Fichier **obligatoire** à la racine du dépôt (et affiché dans l'écran « Crédits » du jeu). Une ligne par asset ou par pack ; mise à jour **dans le même commit** que l'ajout de l'asset.

```markdown
# Crédits — Privatix

Privatix est une œuvre de fiction satirique. Les personnages, entreprises et documents sont fictifs.
Aucun logo ni aucune marque réelle n'est utilisé.

Création originale (pixel-art, musique, programmation) : Équipe Privatix.

## Graphismes tiers
| Asset (fichier du jeu) | Œuvre d'origine | Auteur | Licence | Lien | Modifications |
|---|---|---|---|---|---|
| images/tilesets/tiles-ville.png | Tiny Town | Kenney (kenney.nl) | CC0 1.0 | https://kenney.nl/assets/tiny-town | Recoloré (palette Privatix), tuiles ajoutées |
| images/atlas/ui.png (panneaux) | UI Pack | Kenney (kenney.nl) | CC0 1.0 | https://kenney.nl/assets/ui-pack | Recoloré SNCB/OCC, redimensionné |
| … | … | … | … | … | … |

## Audio tiers
| Asset | Œuvre d'origine | Auteur | Licence | Lien | Modifications |
|---|---|---|---|---|---|
| audio/sfx/sfx-ui-confirm.* | Interface Sounds | Kenney (kenney.nl) | CC0 1.0 | https://kenney.nl/assets/interface-sounds | Normalisé, converti OGG/MP3 |
| audio/bgm/… | « Titre exact » | Pseudo (Nom) | CC-BY 4.0 | https://opengameart.org/content/… | Bouclé, normalisé |

## Polices
| Police | Auteur | Licence | Lien |
|---|---|---|---|
| Press Start 2P | CodeMan38 | SIL OFL 1.1 | https://fonts.google.com/specimen/Press+Start+2P |
| Pixelify Sans | Stefie Justprince | SIL OFL 1.1 | https://fonts.google.com/specimen/Pixelify+Sans |
| m6x11 | Daniel Linssen | Libre, crédit demandé | https://managore.itch.io/m6x11 |

## Outils
Tiled, Aseprite / LibreSprite, free-tex-packer, tile-extruder, BeepBox, jsfxr, eSpeak NG, Audacity, ffmpeg.
```

Règles : pour une licence CC-BY, reproduire le **nom de l'auteur**, le **titre**, le **lien vers l'œuvre**, le **lien vers la licence** et la mention des modifications ; conserver une copie du texte de licence des polices OFL dans `public/assets/fonts/LICENSES/`.
