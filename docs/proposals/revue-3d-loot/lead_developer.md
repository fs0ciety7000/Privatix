# Privatix : passer à la 3D temps réel (proposition du Lead Developer)

> Statut : proposition technique, à arbitrer par l'utilisateur. Aucun fichier du repo n'a été modifié.
> Toutes les mesures ci-dessous ont été faites le 2026-10-09 dans le scratchpad (`team2/bundle`, `team2/glbtest`).

## 0. Résumé

- **Moteur recommandé : Three.js r186** (WebGL2, `WebGLRenderer`), **sans ECS externe**. La simulation
  reste en TypeScript pur, à pas fixe, dans le plan du sol. Three.js ne sert qu'au rendu. **L'UI passe en DOM**
  (HUD, inventaire, menus, contrôles tactiles). Phaser est retiré à la fin de la migration.
- **Physique maison** : cercle contre grille de tuiles, plus cercle contre cercle. Arcade ne fait rien de plus
  aujourd'hui. Rapier pèse 885 Ko gzip pour un besoin que 150 lignes couvrent.
- **Ce qu'on garde : environ 2 900 lignes**, soit `src/systems` (2 052), `utils`, `platform`, `balance.ts`, et les
  683 lignes de tests, sans modification. **Ce qu'on réécrit : environ 7 000 lignes**, soit les entités, les scènes,
  `fx`, `ui` et le préchargement. La logique des états du héros et des ennemis est **déplacée** vers un module pur
  `src/sim/`, pas réinventée.
- **Pipeline d'assets validé** : avec le bpy 5.2.2 du venv, l'export GLB contient l'armature, un mesh skinné,
  une pièce rigide attachée à un os, un socket et 2 animations (fichier de 83 912 octets). Three.js le relit en Node :
  2 clips, 1 SkinnedMesh, et le socket se déplace avec l'animation.
- **Migration en parallèle**, sur une seconde entrée Vite. Le jeu Phaser reste en production jusqu'à la parité.
  Il y a 10 jalons, environ 34 points relatifs, plus 5 points pour le loot d'équipement.

---

## 1. Comparatif des moteurs web

### 1.1 Mesures de poids (bundle minimal réel, esbuild `--minify`, gzip -9)

Pour chaque moteur, la scène minimale contient : un renderer, une caméra, 2 lumières, un chargeur glTF,
une animation squelettique et un bloom (sauf pour Phaser).

| Bundle | Version npm | min | gzip |
|---|---|---|---|
| **Three.js** (+ GLTFLoader, AnimationMixer, MeshToonMaterial, EffectComposer, UnrealBloomPass) | 0.186.1 | 635 Ko | **159 Ko** |
| PlayCanvas (Application, anim, render, light, container) | 2.23.1 | 1 966 Ko | 504 Ko |
| Babylon.js ES6 tree-shaké (+ loaders glTF, DefaultRenderingPipeline) | 9.30.0 | 3 454 Ko | 794 Ko |
| Phaser seul (référence actuelle) | 4.2.1 | 1 361 Ko | 360 Ko |
| Rapier 2D (`-compat`, wasm en base64) | 0.21.0 | 3 325 Ko | 1 257 Ko |
| Rapier 2D (fichier `.wasm` seul) | 0.21.0 | 2 348 Ko | 885 Ko |

Three.js complet avec le post-process pèse **2,3 fois moins que Phaser seul**. La bascule allège donc le
téléchargement initial.

### 1.2 Grille de critères

| Critère | Three.js (+ sim maison) | Babylon.js | PlayCanvas (moteur) | Hybride Three + Phaser UI |
|---|---|---|---|---|
| Perf mobile | Très bonne si on tient le budget (forward, peu de lumières, instancing manuel) | Bonne, mais le moteur est lourd et le coût CPU par frame plus élevé | **Excellente** : conçu pour le mobile web | Mauvaise : 2 contextes WebGL ou partage fragile, double boucle |
| Poids | **159 Ko** | 794 Ko | 504 Ko | 159 + 360 Ko |
| Skinning glTF : mixer, blending | `AnimationMixer`, `crossFadeTo`, poids, clips additifs (`AnimationUtils.makeClipAdditive`) | `AnimationGroup`, blending et poids intégrés | Graphe d'états d'animation, couches, blend trees (le plus complet) | = Three |
| Root motion | Manuel (retirer la piste de translation de la racine, appliquer le delta) | Manuel | Partiel | = Three |
| Toon et contours | `MeshToonMaterial` + `onBeforeCompile` ; contour par coque inversée ou passe Sobel ; énormément d'exemples | `CellMaterial` (lib materials), `renderOutline` intégré, Node Material Editor | Shader chunks à surcharger ; moins d'exemples | = Three |
| Bloom et post-process | `UnrealBloomPass` (examples) ou lib `postprocessing` (pmndrs, bloom sélectif performant) | `DefaultRenderingPipeline` clés en main (bloom, grading, FXAA) | Post-effets de l'éditeur, bloom fourni | = Three |
| Physique top-down | Aucune : on écrit cercle/grille (déjà notre modèle Arcade) | Havok (wasm, lourd) ou maison | Ammo (lourd) ou maison | = Three |
| TypeScript | `@types/three` (DefinitelyTyped, très suivi), API stable | **Écrit en TS**, types natifs | Types fournis, API orientée éditeur | Mixte |
| Testabilité | **Le cœur tourne en Node** : vérifié (`GLTFLoader.parse` + `AnimationMixer` sous Node, sans DOM) | `NullEngine` pour les tests | Possible, peu documenté hors éditeur | Mixte |
| Écosystème | Le plus large (exemples, shaders, réponses) | Large, bonne doc, inspecteur intégré excellent | Plus petit, centré sur l'éditeur en ligne | — |
| Lock-in | Faible (bibliothèque de rendu) | Moyen (framework complet) | Fort (pensé pour l'éditeur) | — |

### 1.3 Recommandation : Three.js, simulation pure, UI en DOM

1. **Le jeu est déjà architecturé « logique pure + adaptateur mince »**. Three.js est une bibliothèque de
   rendu, pas un framework : il se branche comme une **vue** sur notre simulation sans imposer de modèle d'entités.
   Babylon et PlayCanvas apportent une scène, un cycle de vie, une physique et une UI dont on n'a pas besoin.
   On paierait ce poids sans en tirer de bénéfice.
2. **Poids et démarrage mobile** : 159 Ko gzip contre 504 et 794 Ko.
3. **Testabilité** : la sim ne dépend pas de Three.js, et même Three.js (chargeur, mixer) tourne sous Vitest en Node.
4. **Toon, contours et bloom** : c'est le moteur qui a le plus de références sur ce rendu stylisé (Hades-like).
5. **Pas d'ECS externe** (bitecs, miniplex) : on a moins de 100 entités actives, et le modèle « classe + StateMachine »
   fonctionne et est testé. Un ECS serait une réécriture gratuite.

**Le choix hybride Phaser + Three est écarté.** Garder Phaser pour l'UI coûte 360 Ko et un second contexte WebGL
pour afficher du texte et des barres. Le DOM fait mieux pour un inventaire : texte net, survol, glisser-déposer,
accessibilité, responsive.

**Plan B** : si le spike J0 montre que Three.js ne tient pas 60 fps sur mobile milieu de gamme avec notre budget,
PlayCanvas est le repli. Seules les couches `view/` et `engine/` changeraient : la sim et l'UI DOM restent.

**Dépendances runtime à faire valider** (claude.md § 8 l'exige) : `three`. En option : `postprocessing`
(environ 60 Ko gzip), si le bloom maison est insuffisant, et `preact` + `@preact/signals` (environ 8 Ko) pour
l'inventaire et les menus. Dépendances de dev : `@types/three`, `@gltf-transform/cli`.

---

## 2. Réutilisation de l'existant

Principe : **la logique de jeu reste en 2D dans le plan du sol**. Une position logique `(x, y)`, exprimée dans
l'unité actuelle (le « pixel logique », renommé `u`), est affichée en `(x / 30, 0, y / 30)` dans Three.js, en mètres.

- Le facteur **30** est exactement le `PX_PER_UNIT = 30` de `tools/render3d`. Les personnages Blender actuels,
  modélisés en mètres, ont donc déjà la bonne taille par rapport aux hitboxes : le héros fait environ 1,5 m, son
  rayon de pieds 6 u = 0,2 m, sa vitesse 150 u/s = 5 m/s, et une tuile de 16 u = 0,53 m.
- Le `y` logique (vers le bas de l'écran) devient `+z` (vers la caméra), et `x` reste `x`. Les angles
  `atan2(dy, dx)` sont conservés tels quels. Seule la vue convertit : `model.rotation.y = π/2 − angle`
  (le modèle glTF regarde vers `+z`).
- `balance.ts` ne change pas.

### 2.1 Modules qui passent tels quels

| Module | Lignes | Verdict | Remarque |
|---|---|---|---|
| `systems/StateMachine.ts` | 103 | **Tel quel** | Cœur des états du héros et des ennemis dans `sim/` |
| `systems/InputBuffer.ts` | 30 | **Tel quel** | Horloge injectée = temps de sim |
| `systems/combat/geometry.ts` | 99 | **Tel quel** | Arcs, rectangles orientés et cercles dans le plan du sol |
| `systems/combat/damage.ts`, `attackTiming.ts` | 106 | **Tel quel** | Startup / active / recovery inchangés |
| `systems/combat/Burnout.ts`, `DashCharges.ts`, `Mobilisation.ts`, `AttackTokens.ts` | 242 | **Tel quel** | |
| `systems/procedural/ShiftPlan.ts`, `Waves.ts` | 209 | **Tel quel** | |
| `systems/procedural/RoomLayout.ts`, `roomTemplates.ts` | 356 | **Tel quel (données)** | L'ASCII décrit une grille de `TileKind` ; la vue 3D la traduit en pièces de kit modulaire au lieu de tuiles |
| `systems/meta/*` (Avantages, MetaState, RunState, session) | 809 | **Tel quel** | `HeroMods` sera étendu par l'équipement |
| `systems/save/SaveManager.ts` | 98 | **Tel quel** | Migration v→v+1 pour l'inventaire |
| `utils/rng.ts`, `utils/math.ts`, `platform/*` | 131 | **Tel quel** | `facingFromAngle` devient inutile (rotation continue en 3D) |
| `config/balance.ts` | 761 | **Tel quel** | Unités `u` ; `HURT_OFFSET_Y` et `ATTACK_ORIGIN_Y` gardés pour la parité, puis à remettre à 0 si la caméra 3D rend ce décalage illisible |
| `tests/*.ts` | 683 | **Tel quel** | Restent verts ; on y ajoute les tests de `sim/` et de la physique |

Total réutilisé sans changement : **environ 2 900 lignes sur 10 400**, et surtout tout ce qui est équilibré et testé.

### 2.2 Modules à réécrire ou à déplacer

| Module | Lignes | Verdict |
|---|---|---|
| `entities/Player.ts` | 882 | **Déplacé** vers `sim/hero/HeroSim.ts`, en pur. La table d'états est conservée presque mot pour mot. `setVelocity`, `body` et `playAnim` deviennent un `SimBody` (position, vitesse, rayon) et une **requête d'animation** publiée (`anim: { name, durationMs }`). La vue `view/actors/HeroView.ts` affiche. |
| `entities/Enemy.ts` + `enemies/*` | 1 564 | Même traitement. `think`, `onWindup` et `updateAttack` sont déjà de la logique : environ 70 % passe tel quel dans `sim/enemies/`. |
| `entities/Weapon.ts` | 125 | **Presque tel quel** (0 référence Phaser), vers `sim/Weapon.ts` |
| `entities/Projectile`, `Hazard`, `Pickup` | 373 | Logique vers `sim/` ; rendu (pools de meshes, décalques au sol) vers `view/` |
| `entities/Room.ts` | 440 | **Réécrit**. Logique dans `sim/RoomSim.ts` (grille de collision, portes) ; rendu dans `view/RoomView.ts` (kit modulaire instancié) |
| `entities/CombatWorld.ts` | 55 | Réécrit sans `Phaser.Scene` : `stage` disparaît, `vfx()` devient un événement de sim |
| `scenes/*` | 2 419 | **Réécrit**. La logique de flux de `RunScene` (salles, portes, vagues, récompenses) est **extraite** dans `sim/RunDirector.ts`, en pur et testé |
| `fx/GameFeel.ts` | 299 | **Coupé en deux**. Hitstop, ralenti et timeScale vont dans `systems/time/TimeControl.ts` (pur) ; secousses, flash, squash, particules et nombres vont dans `view/fx/Feel3D.ts` |
| `fx/Atmosphere.ts` | 318 | **Réécrit** (lumières 3D, post-process). Les `LOOKS` par zone sont conservés comme données |
| `ui/Controls.ts` | 214 | **Réécrit** en DOM (KeyboardEvent.code, Pointer Events, Gamepad API). L'aide à la visée et la zone morte vont dans `systems/input/aim.ts` (pur) |
| `ui/placeholders.ts`, `scenes/PreloaderScene.ts`, `config/assets.ts` | 785 | **Jetés**, remplacés par `engine/AssetCache.ts`, `config/assets3d.ts` et des placeholders 3D (capsules colorées aux couleurs canon) |
| `scenes/UIScene.ts` (HUD, choix, tactile) | 498 | **Réécrit en DOM** (`ui/hud`, `ui/touch`, `ui/choices`) ; il lit toujours un `HudSnapshot` |

---

## 3. Pipeline d'assets : vérification concrète et évolution de `tools/render3d`

### 3.1 Test réalisé (fichiers dans le scratchpad, aucun fichier du repo touché)

Script : `scratchpad/team2/glbtest/export_test.py`. Il construit :
- une armature `root > spine > arm_R > hand_R > socket_weapon_R`, le socket étant un os sans déformation ;
- un mesh skinné (groupe de sommets `spine`, modificateur Armature) ;
- une **pièce rigide parentée à un os** (`parent_type = 'BONE'`, c'est notre méthode actuelle) ;
- un matériau ;
- 2 actions (`idle`, `attack1`) sur des pistes NLA, exportées avec `export_animation_mode="ACTIONS"`.

Commande exacte :

```bash
cd /tmp/claude-0/-home-user-Privatix/c2cb6f35-4898-55e5-9d17-86bd85230e9d/scratchpad/team2/glbtest
/home/user/Privatix/tools/render3d/.venv/bin/python export_test.py "$PWD/hero_test.glb"
```

Résultat (bpy `5.2.2 LTS`, Python 3.13.16) :

```
RESULT magic=glTF version=2 bytes=83912
RESULT animations=2 -> ['attack1', 'idle']
RESULT skins=1 joints=['root', 'spine', 'arm_R', 'hand_R', 'socket_weapon_R']
RESULT nodes=['socket_weapon_R', 'hand_R', 'Arm_R_rigid', 'arm_R', 'spine', 'root', 'Body', 'HeroRig']
RESULT meshes=2 materials=1
RESULT anim attack1 channels=15
RESULT anim idle channels=15
```

Le fichier `hero_test.glb` fait **83 912 octets** et contient **2 animations**, 1 skin de 5 joints, et la pièce
rigide comme enfant de l'os `arm_R`.

Relecture côté jeu, sous Node, avec le `GLTFLoader` de three 0.186.1 (`scratchpad/team2/bundle/readglb.mjs`) :

```
clips: attack1(0.60s, 15 pistes), idle(1.00s, 15 pistes)
skinnedMeshes: 1 | socket trouvé: true | socket monde t=0: [-0.30, 0.62, 0.00] t=0.3s: [-0.44, 0.91, -0.48]
```

Le socket suit l'animation : on peut y accrocher une arme à l'exécution.

Points d'attention relevés :
- **Draco et MeshOptimizer ne sont pas disponibles dans le bpy pip** : `libbf_intern_draco_bridge.so` et
  `libbf_intern_meshopt_bridge.so` sont introuvables. La compression se fera donc **après l'export**, avec
  `gltf-transform optimize --compress meshopt` (dépendance de dev npm).
- `Material.use_nodes` est déprécié (il disparaîtra dans Blender 6.0) : ne plus l'appeler.
- Sans optimisation, chaque os a 3 canaux (T, R, S). Il faudra `export_optimize_animation_size=True` et retirer
  les canaux de scale constants.

### 3.2 Faire évoluer `rig.py` et `humanoid.py` vers des GLB skinnés « rigides par os »

Aujourd'hui, un personnage est un ensemble d'Empties (articulations) auxquels sont parentées environ 40 pièces
(sphères, capsules, boîtes). Une pose est un dict de rotations en degrés. Évolution proposée, par étapes :

1. **`rig.py` : Empties → os.** `Builder.joint(name, parent, loc)` crée un `EditBone` de même nom. L'astuce clé :
   chaque os a sa **queue le long de +Y** (`tail = head + (0, 0.1, 0)`) et un `roll` à 0. La matrice de repos de
   l'os est alors l'identité, comme celle d'un Empty. **Les rotations Euler XYZ existantes en degrés restent
   valables telles quelles** : `pose_bone.rotation_euler` remplace `joint.rotation_euler`, `pose_bone.location`
   remplace les `offsets`, `pose_bone.scale` remplace les `scales`. `humanoid.py`, `common.py` et les fonctions
   de pose des 7 modules de personnages **ne changent pas**.
2. **Skinning rigide par os, en un seul mesh.** Au lieu de parenter chaque pièce (40 meshes = 40 draw calls par
   personnage), on fusionne toutes les pièces en **un mesh** dont chaque sommet a un poids de 1 sur l'os de sa
   pièce (groupe de sommets = nom de l'articulation). Le rendu est identique à aujourd'hui (pas de déformation
   molle, c'est notre style), pour **1 draw call par personnage, plus 1 pour le contour**. On pourra ensuite lisser
   les coudes et les genoux en mélangeant les poids sur les pièces de vêtements, sans changer le reste.
3. **Matériaux → palette.** L'id de matière de `palette.py` est écrit dans une **couleur de sommet** (`COLOR_0`).
   Le shader toon du jeu lit la rampe à décalage de teinte correspondante dans une petite `DataTexture` générée
   depuis `palette.py` (exportée en `palette.json`). On a ainsi un seul matériau par personnage, et les rampes
   « Hades » (ombres violettes, lumières saturées, liseré `#6FF3FF`) sont conservées.
4. **Actions.** `build.py --glb` échantillonne chaque fonction de pose `fn(i, n)` à 30 i/s et pose une clé par
   frame sur les os : une action par animation, mise sur une piste NLA, exportée en mode `ACTIONS`.
   - **Plus de directions** : `down`, `up` et `side` disparaissent, car la vue tourne le modèle. `facing_deg` est
     ignoré. Il y a donc 3 fois moins d'animations à produire.
   - **Animations sur place** : la translation horizontale de `root` n'est pas exportée. La sim fait foi pour les
     déplacements (dash 72 u, ruées). Le rebond vertical est conservé.
   - **Durées** : le clip a une durée nominale. Le jeu la **remet à l'échelle** sur les durées de `balance.ts`
     (`action.timeScale = clip.duration * 1000 / durationMs`). La règle actuelle « l'animation suit les timings,
     jamais l'inverse » est préservée.
   - **Smears** : ils deviennent des **traînées d'arme générées à l'exécution** (ruban qui suit `socket_weapon_R`),
     plus fluides qu'un mesh clé. Les **bascules** (écran du laptop, LED) passent par un os de bascule dont l'échelle
     est clé à 0 ou 1 : c'est l'astuce standard, car glTF n'anime pas la visibilité.
5. **Sockets d'équipement.** Ce sont des os `use_deform = False`, ajoutés par `humanoid.py` :
   `socket_weapon_R` (main droite), `socket_weapon_L`, `socket_head` (casque), `socket_back` (sac, radio),
   `socket_hip_L` (gobelet), et `fx_*` (ancres de VFX ; l'articulation `fx` actuelle en devient une).
   Côté jeu, `hero.getObjectByName('socket_head').add(helmetMesh)`.
6. **Équipement.** Nouveau dossier `tools/render3d/items/*.py` (variantes de clé à tire-fond, casques, gilets,
   badges). Les objets **rigides** (armes, casques) sont des GLB autonomes dont l'origine est le point de prise,
   accrochés à un socket. Les vêtements **déformés** sont exportés skinnés sur **le même squelette nommé** et liés
   à l'exécution avec `SkinnedMesh.bind(hero.skeleton)`. La rareté est affichée par un émissif et un liseré.
7. **Décor.** `tools/render3d/kit/*.py` produit le kit modulaire de la gare (dalle de quai, ligne jaune,
   segment de rail et ballast, pilier, banc, mur, porte, distributeur) dans un seul GLB `kit_quais.glb`.
   `RoomView` l'instancie d'après la grille de `RoomLayout`.
8. **Sortie.** `public/assets/models/<entité>.glb`, puis `gltf-transform optimize --compress meshopt`
   (et `--texture-compress ktx2` si on ajoute des textures). Le manifeste `assets3d.json` donne, par entité :
   le fichier, les clips et leur durée, les sockets, le rayon de collision, la hauteur et le tier de LOD.
   Il remplace `manifest.json`.

Ce qui devient obsolète dans `tools/render3d` : `render.py` (passes Cycles), `post.py` (conversion pixel art) et
`hero_passes.pkl`. Ce qu'on garde : `palette.py`, `characters/*`, `common.py`, `humanoid.py`, et `rig.py` (adapté).
`tools/pixelart` est jeté, sauf les icônes et textures de particules réutilisables pour l'UI et les VFX.

---

## 4. Architecture cible

### 4.1 Arborescence

```
src/
  main.ts                 # bootstrap : renderer, Loop, SceneManager, UI root
  config/
    balance.ts            # INCHANGÉ (fait foi), unités u
    constants.ts          # couleurs canon, clés de scène, qualité
    assets3d.ts           # lit assets3d.json (modèles, clips, sockets)
  systems/                # INCHANGÉ + nouveaux modules purs
    physics/              # cercle↔grille, cercle↔cercle, raycast de grille (ligne de vue, dash)
    time/TimeControl.ts   # hitstop, ralenti, ease (extrait de GameFeel)
    input/aim.ts          # aide à la visée, zones mortes (extrait de Controls)
    loot/                 # objets, affixes, tables de loot seedées (spéc. game design)
  sim/                    # PUR (ni three, ni DOM) : les « entités » d'aujourd'hui
    World.ts              # possède entités, rng, tokens, file d'événements SimEvent
    hero/HeroSim.ts       # table d'états du Player, déplacée
    enemies/*.ts          # Consultant, Borne, Drone, Manager, Auditeur, Dummy
    Weapon.ts, Projectiles.ts, Hazards.ts, Pickups.ts
    RoomSim.ts            # grille de collision, portes, vagues
    RunDirector.ts        # flux du Shift (ex-RunScene), récompenses, transitions
  engine/                 # plomberie navigateur, sans gameplay
    Loop.ts               # pas fixe + interpolation
    SceneManager.ts       # Boot → Menu → Hub ⇄ Run → Results ; Pause = overlay
    AssetCache.ts         # GLTFLoader + MeshoptDecoder (+ KTX2), clonage SkeletonUtils
    Input.ts              # clavier (code), souris, Gamepad API, tactile → PlayerIntent
    Audio.ts              # WebAudio
    ResourceTracker.ts    # dispose() de tout ce qu'une scène a créé
  view/                   # three uniquement
    Renderer.ts           # WebGLRenderer, DPR plafonné, résolution dynamique, perte de contexte
    CameraRig.ts          # caméra 3/4, suivi, cadrage salle, secousse
    RoomView.ts           # kit instancié, lumières de salle, décalques
    actors/ActorView.ts   # modèle + AnimationController + sockets + flash + squash
    fx/Feel3D.ts          # particules, traînées, nombres de dégâts, télégraphes magenta
    materials/            # toon (rampes palette), contour coque inversée, émissif, télégraphe
    post/Post.ts          # bloom demi-résolution + étalonnage + vignette en 1 passe de composition
  scenes/                 # minces : relient sim + view + ui
    MenuScene.ts, HubScene.ts, RunScene.ts, ResultsScene.ts
  ui/                     # DOM + CSS (jamais three)
    hud/, inventory/, choices/, dialogue/, menus/, touch/, styles.css
  platform/               # INCHANGÉ (+ haptique, visibilité)
```

Règles ESLint (`no-restricted-imports`) :
- `systems/` et `sim/` n'importent ni `three` ni le DOM ;
- `ui/` n'importe pas `three` ;
- `view/` n'importe pas `ui/` ;
- seuls `scenes/` et `main.ts` assemblent les couches.

### 4.2 Boucle de jeu à pas fixe

La simulation avance à **60 Hz fixes** (`SIM_DT = 1000/60` ms), quelle que soit la fréquence de l'écran
(60, 90 ou 120 Hz). Le rendu interpole entre les deux derniers états.

```ts
// engine/Loop.ts (esquisse)
const SIM_DT = 1000 / 60;
const MAX_STEPS = 5; // pas de « spirale de la mort » après un onglet en arrière-plan
let acc = 0;
let last = performance.now();
function frame(now: number): void {
  const realDt = Math.min(now - last, 250);
  last = now;
  acc += realDt * time.scale(realDt);   // TimeControl : 0 pendant le hitstop, 0,25 au ralenti…
  let steps = 0;
  while (acc >= SIM_DT && steps < MAX_STEPS) {
    world.prevSnapshot();               // copie position/angle pour l'interpolation
    world.step(SIM_DT);                 // StateMachine.update, physique, hitboxes, IA
    acc -= SIM_DT;
    steps += 1;
  }
  view.sync(world, acc / SIM_DT, realDt); // interpolation, mixers (dt de jeu), caméra et UI (dt réel)
  view.render();
  requestAnimationFrame(frame);
}
```

- **Hitstop** : `TimeControl` renvoie un facteur 0. La sim ne progresse plus, les mixers de la vue reçoivent un
  dt de jeu nul, mais la secousse caméra, l'UI et les particules « réelles » continuent. On retrouve exactement le
  comportement actuel (« la scène reçoit un delta de jeu nul »).
- **Déterminisme** : pas fixe + `createRng(seed)`. Un Shift est rejouable à partir de la graine et des intentions
  enregistrées, ce qui permet des tests de replay dans Vitest.
- **Événements** : la sim publie des `SimEvent` (`hit`, `kill`, `telegraph`, `vfx`, `sfx`, `anim`, `shake`) dans
  une file vidée par la vue à chaque frame. La sim ne connaît jamais la vue.

### 4.3 Caméra

- `PerspectiveCamera`, FOV d'environ 30° (faible pour limiter la déformation), tangage d'environ 55°
  (vue 3/4 à la Hades), hauteur réglée pour cadrer à peu près 22 × 12 m. Une option orthographique est à tester
  au spike : la lisibilité des télégraphes est parfaite, mais il y a moins de relief.
- Suivi amorti du héros, avec une légère avance dans la direction de visée, et borné aux limites de la salle
  (la logique de cadrage actuelle de `Room`). Secousse en translation et en roulis, avec un « zoom punch » sur le
  coup 3 (FOV −2°).
- **Occlusion** : les piliers et murs entre la caméra et le héros passent en transparence (raycast ou tests dans
  la grille). La silhouette du héros reste visible derrière les obstacles (seconde passe `depthFunc = Greater`).
- **Visée souris** : rayon du pointeur intersecté avec le plan `y = 0`, converti en `(x, y)` logique, puis
  `atan2`. C'est un calcul pur une fois les matrices de la caméra connues.

### 4.4 Entrées

- `KeyboardEvent.code` (positions physiques) : `KeyW`, `KeyA`, `KeyS`, `KeyD` couvrent ZQSD sur AZERTY sans
  double jeu de touches.
- Gamepad API interrogée à chaque frame.
- Pointer Events sur une couche DOM dédiée pour le tactile, avec `touch-action: none` : joystick virtuel à gauche,
  boutons à droite (attaque, dash, spécial, café).
- Le tout produit la même `PlayerIntent` qu'aujourd'hui (type inchangé), consommée par la sim à chaque pas.
  L'appui est mémorisé jusqu'au prochain pas de sim pour ne rien perdre entre deux pas.

### 4.5 Scènes

- `SceneManager` maison. Chaque scène implémente `enter(data)`, `exit()`, `update(realDt)` et `render(alpha)`.
  Il y a un seul `WebGLRenderer` pour toute l'application, et **un `THREE.Scene` par scène de jeu**.
- `Pause` n'est pas une scène : c'est un overlay DOM avec `TimeControl.paused = true`.
- Le `Run` reste **une seule scène pour tout le Shift**, comme aujourd'hui. `RunDirector` (sim) décide de la salle
  suivante, puis `RoomView` reconstruit le décor derrière un fondu DOM. Pendant ce fondu, on précompile les
  shaders (`renderer.compileAsync`).
- Chaque scène possède un `ResourceTracker`. À `exit()`, on libère géométries, matériaux, textures et mixers.
  Le critère actuel « stable après 30 transitions » est conservé, vérifié avec `renderer.info.memory`.

### 4.6 Chargement des assets

- `AssetCache` : `GLTFLoader` + `MeshoptDecoder` (+ `KTX2Loader` si on ajoute des textures). Chaque GLB est
  chargé **une fois**. On instancie un acteur avec `SkeletonUtils.clone` (squelette propre, géométrie et matériau
  partagés).
- Lots de chargement : `core` (héros, UI, kit de quais, ennemis du biome 1), `hub` (PNJ, décor de l'OCC) et
  `boss` (Auditeur, arène), ce dernier préchargé en tâche de fond pendant le Shift.
- **Placeholders 3D** : une entité déclarée sans GLB est rendue par une capsule aux couleurs canon (héros orange,
  ennemis turquoise, danger magenta), avec un « clip » factice qui fait pulser l'échelle. Le workflow
  « logique → placeholders → vrais assets » de claude.md § 6 est préservé.

### 4.7 UI (DOM)

- **HUD** : énergie, Burnout, Mobilisation, charges de dash et gobelets en éléments DOM positionnés en CSS
  au-dessus du canvas. La mise à jour est **événementielle**, en comparant le `HudSnapshot` actuel et le précédent,
  et n'écrit que les valeurs qui changent. Les animations n'utilisent que `transform` et `opacity`.
- **Inventaire et équipement** (nouveau) : panneau DOM avec emplacements (arme, tête, torse, accessoire x2),
  infobulles de comparaison et rareté colorée. Il fonctionne au tap sur mobile et au clic ou glisser-déposer sur
  desktop. Il ouvre la pause du Shift. Il est rendu avec Preact + signals (environ 8 Ko) ou en DOM vanilla si l'on
  refuse la dépendance.
- **Aperçu 3D du héros équipé** : un second rendu du même `WebGLRenderer` dans un petit viewport (scissor),
  sans second contexte.
- **Nombres de dégâts** : en WebGL (quads instanciés d'un atlas de chiffres, pool de 64), pour qu'ils suivent le
  monde et le hitstop sans coût DOM.
- **Choix d'Avantages, dialogues PNJ, Tableau des revendications, menus** : DOM, avec le texte du jeu en
  français et une police nette à toutes les résolutions.

### 4.8 Budget de performance mobile (Android milieu de gamme, 60 fps)

| Poste | Mobile (tier bas / moyen) | Desktop |
|---|---|---|
| Draw calls par frame | **≤ 120** | ≤ 300 |
| Triangles visibles | ≤ 150 k | ≤ 500 k |
| Héros / ennemi / boss | 4 k / 2 k / 8 k triangles, ≤ 40 os, 1 matériau (+ contour) | idem |
| Personnages skinnés simultanés | ≤ 20 | ≤ 40 |
| Lumière directionnelle | 1 (clé), **ombre 1024², frustum serré sur la salle**, seuls les acteurs projettent ; tier bas : ombres en blob | 2048², PCF soft |
| Lumières ponctuelles | **4 au maximum**, en nombre **fixe par salle** (pool ; intensité à 0 si inutilisée). Un changement du nombre de lumières recompile tous les shaders dans Three.js | 8 |
| Autres « lumières » | Émissif + bloom, halos en sprites additifs, éclairage du décor cuit en couleurs de sommet | idem |
| Post-process | Bloom à **demi-résolution** (3 niveaux de mip), étalonnage et vignette fusionnés dans la passe de composition ; tier bas : bloom coupé | Bloom complet |
| Résolution | `devicePixelRatio` plafonné à 1,5 ; **résolution dynamique** (0,6 à 1,0) pilotée par le temps de frame | DPR ≤ 2 |
| Contours | Coque inversée sur les acteurs (+1 draw par acteur) ; aucun contour sur le décor (encrage cuit) | idem, plus Sobel profondeur/normales en option |
| Décor | Kit **instancié** (`InstancedMesh` par pièce) et sol fusionné par matériau : environ 15 à 30 draw calls par salle | idem |
| Allocation | Aucune allocation dans `step()` ni `render()` (vecteurs réutilisés, pools : projectiles 96, VFX 64, nombres 64) | idem |
| Mémoire GPU | ≤ 150 Mo ; textures KTX2 | — |

- **Tiers de qualité** (bas, moyen, haut) choisis automatiquement par la mesure du temps de frame pendant les
  3 premières secondes, et modifiables dans les réglages.
- **Compteurs F3** : fps, `renderer.info.render.calls`, triangles, géométries et textures en mémoire, entités actives.

---

## 5. Plan de migration par jalons

**Stratégie** : migration **en parallèle, sans big bang**. On ajoute une seconde entrée Vite (`play3d.html`,
`src/main3d.ts`) qui importe les mêmes `systems/`. Le jeu Phaser reste en production sur `privatix.fs0ciety.org`
jusqu'au jalon J9. Phaser est supprimé au moment de la bascule.

Effort en **points relatifs**. J1 vaut 3 points, et sert de référence d'étalonnage : une fois J1 livré, on
recalcule le reste avec la vitesse mesurée.

| # | Jalon | Contenu | Livrable jouable / critère | Effort |
|---|---|---|---|---|
| **J0** | Spike de décision | Scène Three nue : 1 salle en boîtes, 20 capsules skinnées (GLB de test), shader toon, contour, bloom demi-résolution. Mesure sur un Android milieu de gamme et sur Safari iOS | ≥ 55 fps et ≤ 120 draw calls, sinon plan B PlayCanvas. **Go / no-go de l'utilisateur** sur la dépendance `three` | 1 |
| **J1** | **Prototype « Quai »** | Entrée Vite 3D, `Loop` à pas fixe, `systems/physics` (cercle/grille, avec tests), `quai-1` construit depuis l'ASCII (murs, piliers, rails en primitives), héros capsule → GLB, idle / run / attack1-3, caméra 3/4, clavier et souris (visée par raycast sol), combo avec `geometry.ts` contre le `TrainingDummy`, hitstop et secousse | **Le héros se déplace et frappe dans une salle de quai** ; tests verts | 3 |
| **J2** | Combat complet | `HeroSim` (tous les états : dash, dashAttack, charge, special, drink, hurt, dead), Weapon, Burnout, Mobilisation, DashCharges, Consultant + Borne, AttackTokens, télégraphes magenta en décalques au sol, projectiles en pool, nombres de dégâts, `Feel3D` complet (flash, squash, traînées, ralenti) | Une salle de combat qui « se sent » comme aujourd'hui (comparaison côte à côte) | 5 |
| **J3** | Pipeline GLB (en parallèle de J2) | `rig.py` passe aux os, skinning rigide en 1 mesh, couleurs de sommet → palette, `build.py --glb`, sockets, `assets3d.json`, `gltf-transform`, test Vitest de chargement des GLB (sous Node, comme validé) | Héros et 5 ennemis en GLB avec leurs clips | 3 |
| **J4** | Boucle de Shift | `RunDirector` (extrait de RunScene), tous les gabarits de salle, portes annonçant la récompense, vagues, choix d'Avantages (DOM), café, Friterie, Trésor, fondu de transition, écran de résultats | Un Shift complet de bout en bout | 4 |
| **J5** | UI et tactile | HUD DOM, pause, menus, réglages et accessibilité, joystick et boutons tactiles, manette, aide à la visée | Jouable sur téléphone | 3 |
| **J6** | Hub OCC | Scène Hub, PNJ en GLB (idle), dialogues, Tableau des revendications, méta, sauvegarde | Boucle roguelite complète (mort → OCC → nouveau Shift) | 3 |
| **J7** | Ennemis restants et boss | Drone, Manager KPI (bouclier), Auditeur à 3 phases, toutes les zones de danger (anneau, rame, ligne de KPI) | Parité de contenu | 5 |
| **J8** | Direction artistique 3D | Kit de décor modélisé (quais, voies, piliers, OCC), `LOOKS` par zone (Quais bleu nuit, arène rouge, OCC brique), lumières de salle, rais de lumière, poussières | Parité visuelle et au-delà | 4 |
| **J9** | Perf et bascule | Tiers de qualité, profilage sur appareils réels, 30 transitions sans fuite, iOS, perte de contexte. **Bascule** : `index.html` → 3D, suppression de Phaser, mise à jour de claude.md, ARCHITECTURE.md et du README | **Parité, en production** | 3 |
| J10 | Loot d'équipement (nouveau) | `systems/loot` (spécifié par le game design), inventaire DOM, sockets, objets GLB, `HeroMods` étendu, sauvegarde v+1 | Nouvelle fonctionnalité demandée par l'utilisateur | 5 |

**Total jusqu'à la parité : environ 34 points ; loot compris : environ 39.** Le chemin critique est
J0 → J1 → J2 → J4 → J7. J3 et J8 avancent en parallèle côté outils et art.

**Ce qu'on jette au moment de la bascule (J9)** :
- la dépendance `phaser` et `src/scenes/*` (version Phaser) ;
- `src/entities/*`, une fois leur logique déplacée dans `sim/` ;
- `src/fx/Atmosphere.ts`, `src/ui/placeholders.ts`, `src/config/assets.ts` et `PreloaderScene` ;
- tous les sprites et tilesets PNG (`public/assets/sprites`, `tilesets` : 3,7 Mo), y compris les normal maps ;
- `tools/pixelart/` (sauf les icônes et particules réutilisées), `tools/render3d/render.py`, `post.py` et
  `hero_passes.pkl` ;
- `docs/PIXEL_ART_GUIDE.md` et claude.md § 5 (règles des animations pixel art). Ce sont des **règles d'autorité**
  à réécrire pour la 3D, sans les assouplir. Les règles 1 (sensation de combat) et 2 (architecture modulaire)
  restent valables presque mot pour mot.

---

## 6. Risques et parades

| # | Risque | Probabilité / impact | Parade |
|---|---|---|---|
| 1 | **Perf mobile** insuffisante (skinning + contours + bloom + ombres) | Moyenne / fort | Le spike J0 mesure sur de vrais appareils **avant** d'engager ; budget chiffré (§ 4.8) ; tiers de qualité ; résolution dynamique ; plan B PlayCanvas (seules `view/` et `engine/` changent) |
| 2 | **Saccades de compilation de shaders** (première apparition d'un matériau ou d'une lumière) | Haute / moyen | Nombre de lumières fixe par salle ; `renderer.compileAsync` pendant les fondus ; variantes de matériaux limitées (1 toon, 1 contour, 1 émissif, 1 télégraphe) |
| 3 | **Perte de lisibilité** du combat en 3D (télégraphes, profondeur, occlusion) | Moyenne / fort | Caméra haute ; télégraphes en décalques magenta émissifs **au sol** qui reprennent exactement la forme géométrique logique ; silhouette du héros derrière les obstacles ; obstacles en fondu ; option orthographique testée en J0 |
| 4 | **Perte du game feel** (hitstop, timings, frames actives) | Moyenne / fort | La sim reste l'autorité (frames actives = `attackTiming`) ; animations remises à l'échelle sur `balance.ts` ; mixer à dt nul pendant le hitstop ; comparaison côte à côte avec la build Phaser à J2 |
| 5 | **Volume de production 3D** (décor + personnages + équipements) | Haute / fort | Personnages : réutiliser les 7 modules procéduraux existants (seule la sortie change) ; décor en kit modulaire procédural Blender ; un style low-poly toon qui pardonne ; kits CC0 (Kenney, Quaternius) uniquement comme placeholders, crédités dans CREDITS.md |
| 6 | **Big bang qui n'aboutit pas** | Moyenne / fort | Entrée Vite parallèle ; chaque jalon est jouable ; production Phaser intacte jusqu'à J9 ; `systems/` partagé, donc pas de divergence d'équilibrage |
| 7 | **Fuites mémoire GPU** (Three.js ne libère rien tout seul) | Haute / moyen | `ResourceTracker` par scène ; compteurs `renderer.info` en F3 ; test « 30 transitions » à chaque jalon |
| 8 | **Export Blender fragile** (actions à slots de Blender 5.x, NLA, absence de Draco et meshopt) | Faible / moyen | Déjà validé (§ 3.1) ; compression par `gltf-transform` ; test Vitest qui charge chaque GLB sous Node et vérifie clips et sockets d'après `assets3d.json` ; `gltf-validator` en CI |
| 9 | **Tactile et DOM** (conflits de pointeurs, zoom et défilement iOS, encoche) | Moyenne / moyen | Couche d'entrée dédiée, `touch-action: none`, `env(safe-area-inset-*)`, tests sur iOS Safari dès J5 |
| 10 | **Perte de contexte WebGL** (iOS, onglet en arrière-plan) | Moyenne / moyen | Gestion de `webglcontextlost` et `restored` (rechargement depuis `AssetCache`) ; pause automatique sur `visibilitychange` |
| 11 | **Dérive du déterminisme** (pas variable, `Math.random`) | Faible / moyen | Pas fixe ; ESLint interdit `Math.random` et `performance.now` dans `sim/` ; tests de replay seedés |
| 12 | **Règles du projet en décalage** (claude.md impose Phaser comme seule dépendance runtime) | Certaine / faible | Validation explicite de l'utilisateur à J0 ; réécriture de claude.md et ARCHITECTURE.md à la bascule (J9), les règles restant aussi strictes |
| 13 | **Taille des téléchargements** | Faible / moyen | Three.js à 159 Ko gzip (moins que Phaser) ; GLB meshopt ; chargement par lots (boss en différé) ; cache HTTP immuable (nginx) |

---

## Annexe : commandes et fichiers de la vérification

```bash
# Export GLB avec le bpy du projet (scratchpad uniquement)
cd /tmp/claude-0/-home-user-Privatix/c2cb6f35-4898-55e5-9d17-86bd85230e9d/scratchpad/team2/glbtest
/home/user/Privatix/tools/render3d/.venv/bin/python export_test.py "$PWD/hero_test.glb"
# → hero_test.glb, 83 912 octets, 2 animations (attack1, idle), 1 skin à 5 joints, socket_weapon_R présent

# Relecture côté jeu (three 0.186.1, Node 22)
cd ../bundle && node readglb.mjs ../glbtest/hero_test.glb

# Poids des moteurs : bundle minimal par moteur
npx esbuild three.js --bundle --minify --format=esm --outfile=out/three.min.js   # (idem babylon, playcanvas, phaser, rapier)
```
