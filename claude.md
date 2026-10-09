# claude.md — Instructions système pour Privatix

Ce fichier est lu par Claude Code au début de chaque intervention sur ce dépôt. Il fait autorité sur **la manière de travailler**. Les documents de `docs/` font autorité sur **ce qu'est le jeu** :

| Document | Fait foi sur |
|---|---|
| `docs/GDD.md` | Règles, chiffres (annexe A → `src/config/balance.ts`), boucle roguelite, ennemis, progression |
| `docs/LORE.md` | Canon narratif, PNJ de l'OCC, répliques, ton (aucune personne ni marque réelle) |
| `docs/ARCHITECTURE.md` | Structure du code, scènes, StateMachine, combat Arcade, sauvegarde, performance ; **§ 15 : migration 3D** (sim / engine / view / ui) |
| `docs/PIXEL_ART_GUIDE.md` | Liste exacte des PNG, dimensions, nommage, palette, achat sur itch.io |

## 1. Le projet en 30 secondes

- **Privatix** : Hack 'n' Slash / Roguelite 2D en vue de dessus. Un cheminot en 3x8, armé d'une **clé à tire-fond**, affronte dans la gare de Mons les consultants et automates de la mégacorporation Privatix, qui veulent **libéraliser et privatiser le rail** (Mons est le lot pilote du plan PHR-2032 ; canon : `docs/LORE.md`, encadré « Révision du scénario »). Chaque run est un **Shift** ; après un échec, on revient à l'**OCC** (Operation Coffee Center) dépenser ses **Points de Syndicalisme** au Tableau des revendications.
- **Stack** : Phaser **4.2.1** (Arcade Physics), TypeScript 5.9 strict, Vite 7, Vitest 4, ESLint 10, Prettier 3, Node 22. Sprites générés par `tools/pixelart/` (Python + Pillow).
- **Migration 3D en cours** (décision du porteur) : **Three.js 0.186.1** (version exacte), entrée `play3d.html`. Le jeu Phaser (`index.html`) reste en production **en sursis jusqu'à la parité** (jalon J9) : on le garde vert, on n'y ajoute plus de fonctionnalité. Toute nouvelle feature se fait côté 3D. Architecture et statut : `docs/ARCHITECTURE.md` § 15 ; plan : `docs/proposals/revue-3d-loot/lead_developer.md`.
- **Direction artistique** : **pixel art moderne**, références **Dead Cells**, **Celeste** et **Hades** (lumière dynamique, bloom, étalonnage, particules, animation fluide, squash & stretch ; de Hades : contrastes dramatiques, encrage des formes, liserés colorés forts, décors sombres en flaques et rais de lumière). Jamais de rendu rétro « plat ». Voir GDD § 1.3.
- **Rendu** : 640×360 logiques, mise à l'échelle entière, tuiles 16 px, `pixelArt: true`, `roundPixels: true`, WebGL.
- **Déploiement** : Docker (build Node → nginx) sur Coolify, `privatix.fs0ciety.org`.
- **Langue** : identifiants en anglais ; commentaires, docs, textes du jeu et messages de commit en français.

## 2. Commandes

```bash
npm ci                           # installation (npm install exige --legacy-peer-deps)
npm run dev                      # http://localhost:5173 (ajouter ?debug pour les corps Arcade, ?cheat pour les raccourcis de test)
                                 # 3D : http://localhost:5173/play3d.html (?q=bas|moyen|haut, ?rm=1, ?safe, ?seed=N)
npm run check                    # typecheck + lint + tests : DOIT être vert avant tout commit
npm run build                    # dist/ : les deux entrées (index.html Phaser, play3d.html Three.js)
npm run assets                   # régénère tilesets, props, VFX, UI depuis tools/pixelart/ (2D)
npm run sprites3d                # rend les personnages depuis tools/render3d/ (3D → pixel, méthode Dead Cells)
```

Raccourcis `?cheat` (dev uniquement, absents du build) : **K** élimine les ennemis, **G** invincibilité, **N** salle suivante (ou un Avantage si la salle n'est pas nettoyée), **B** salle du boss.

## 3. Règle 1 — Arcade Physics et sensation de combat

Le combat est le produit. Chaque coup doit **se sentir**.

**Hitboxes précises**
- Le corps Arcade d'un acteur est sa **hurtbox de déplacement** : un petit cercle aux pieds (héros : rayon 6), jamais la taille du sprite. Il ne sert qu'aux collisions avec le décor.
- Les **hitboxes d'attaque ne sont pas des corps Arcade**. Ce sont des requêtes géométriques (`src/systems/combat/geometry.ts` : arc, rectangle orienté, cercle) testées pendant les **frames actives** contre la hurtbox circulaire des cibles (`Enemy.hurtCircle`). Un `Set` des cibles déjà touchées garantit un impact par coup (`Weapon.begin()` le vide).
- Héros ↔ ennemis : **jamais de `collide`**, seulement des tests logiques (sinon les ennemis bloquent et poussent le joueur). Ennemis entre eux : séparation douce, pas de collider dur.
- Toute attaque ennemie est **télégraphiée en magenta** (`#FF3EA5`) au moins 300 ms avant de blesser (500 ms pour le boss). Si ce n'est pas lisible, ce n'est pas juste.
- Startup / active / recovery de chaque coup viennent de `balance.ts` (GDD § 5), en millisecondes. L'animation est **mise à l'échelle** sur ces durées (`Player.playAnim(name, angle, durationMs)`), jamais l'inverse.

**Game feel** : tout passe par `src/fx/GameFeel.ts`, jamais d'appel direct à `camera.shake` dans une entité.
- **Hitstop** à chaque impact (50 ms pour les coups 1-2, 110 ms pour le coup 3, +10 ms par cible supplémentaire). `GameFeel.hitstop` gèle la physique et les animations ; la scène reçoit un delta de jeu nul.
- **Screenshake** en pixels logiques (intensité = px / 640), combinés au maximum, jamais additionnés.
- **Flash blanc** des cibles touchées (Phaser 4 : `setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)`, puis `clearTint()`).
- **Particules** (étincelles, feuilles de papier, poussière) et **VFX animés** (`world.vfx('vfx-hit', x, y)`).
- **Ralenti** sur le dernier ennemi d'une salle (0,25 pendant 450 ms) et sur le dash parfait (0,6 pendant 200 ms). Arcade : `world.timeScale` est **inversé** (2 = plus lent), `GameFeel` s'en charge.
- Nombres de dégâts, vignette magenta quand le héros est touché, zoom punch sur le coup 3.
- **Squash & stretch** (`GameFeel.squash`) au dash, sur les coups et les impacts ; **traînée rémanente** au dash (`GameFeel.afterimage`).
- Un nouveau type d'impact ? Ajouter sa ligne dans le tableau « Game feel » du GDD, puis l'appeler via `GameFeel`.

**Lumière et post-traitement** (`src/fx/Atmosphere.ts`, une instance par scène de jeu) :
- Tout acteur et tout décor est éclairé : `atmo.lit(sprite)` à la création, `room.layer.setLighting(true)`. Les **émissifs** (VFX, télégraphes, projectiles, écrans, UI) ne le sont pas : ils restent saturés et le bloom les fait briller.
- Lampes et néons de salle via `atmo.lightRoom(room)` ; halo visible via `atmo.addGlow` ; éclair bref sur un impact via `atmo.flash` (déjà branché sur les VFX lumineux de `RunScene.vfx`).
- Bloom, étalonnage et vignette sont des **filtres de caméra Phaser 4** posés par `Atmosphere` : ne pas en empiler d'autres ailleurs. Une nouvelle zone = une entrée dans `LOOKS`.
- `render.maxLights` vaut 32 (`main.ts`) : rester sous cette limite de lumières visibles à l'écran.

## 4. Règle 2 — Architecture modulaire

**Logique pure séparée de Phaser.** `src/systems/` et `src/utils/` **n'importent jamais `phaser`** (règle ESLint). Machine à états, tampon d'entrées, géométrie, timings, Burnout, dash, Mobilisation, vagues, portes, méta-progression et sauvegarde y sont des classes ou fonctions pures, testées dans `tests/`. L'aléatoire est injecté (`createRng(seed)`), donc chaque Shift est reproductible à partir de sa graine.

**Classes de jeu** (adaptateurs Phaser minces, dans `src/entities/`) :

| Classe | Rôle |
|---|---|
| `Player` | `Arcade.Sprite` + `StateMachine<Player, PlayerStates>` (idle, run, attack, dashAttack, dash, charge, special, drink, hurt, dead). Lit une `PlayerIntent` par frame, jamais le clavier directement. |
| `Enemy` | Base abstraite : PV mis à l'échelle de la salle, knockback, étourdissement, jetons d'attaque, états communs (spawn, chase, windup, attack, recover, stagger, dead). Les sous-classes de `entities/enemies/` ne décrivent que leur comportement (`think`, `onWindup`, `updateAttack`). |
| `Weapon` | La clé à tire-fond : balaie la hitbox du coup courant, applique dégâts, critiques et Avantages, casse les projectiles. |
| `Room` | Construit une salle depuis un gabarit (`RoomLayout`) : tilemap, collisions, autotiles, props, portes et cadrage caméra. |
| `Projectile`, `Hazard`, `Pickup` | Projectiles en pool, zones de danger télégraphiées (cercle, anneau, rame, ligne de KPI), récompenses au sol. |

- Les entités ne connaissent **jamais** la scène concrète : elles passent par l'interface `CombatWorld` (`src/entities/CombatWorld.ts`), implémentée par `RunScene` et `HubScene`.
- Une seule `RunScene` pour tout le Shift : elle reconstruit la salle derrière un fondu (`goThrough`).
- **Une donnée de gameplay = une constante de `balance.ts`.** Aucun nombre magique dans une entité ou une scène.
- État partagé entre scènes : `this.registry`, clés de `RegistryKeys`, **toutes initialisées dans `BootScene`** (la création d'une clé émet `setdata` et non `changedata` : un écouteur raterait la première valeur). Le HUD lit un instantané (`HudSnapshot`) publié par `RunScene`.
- `preload()` n'existe que dans `PreloaderScene` (règle ESLint). Pas de variable globale, rien sur `window`.
- Mémoire : ce qui survit à une scène (écouteurs du registry, clavier global) est retiré sur `SHUTDOWN`. Les objets custom surchargent `destroy()`. Pas de création d'objets dans `update()` : pool (projectiles, textes de dégâts) ou création à la construction de la salle.

**Style** : TypeScript strict complet (ne jamais l'assouplir) ; interdits : `any`, `!`, `@ts-ignore`, `eslint-disable` sans justification. `import type` pour les types, alias `@/`, modificateurs d'accès explicites, `override` sur les méthodes Phaser. Prettier fait foi.

## 5. Règle 3 — Animations pixel art via le système d'animation de Phaser

- **Format unique** : bandes horizontales `<entité>_<anim>[_<direction>]_strip<N>.png`, frames carrées, sans marge ni espacement. Clé de texture = nom du fichier sans `.png` ; clé d'animation = `<entité>-<anim>[-<direction>]` (ex. `player-attack3-side`). Voir `docs/PIXEL_ART_GUIDE.md`.
- **Personnages = pipeline 3D → pixel** (`tools/render3d/`, voir son README) : modèles low-poly articulés rendus sans lissage puis convertis en pixel art (rampes à décalage de teinte, liseré, contour, normal maps). Décor, VFX et UI restent produits par le générateur 2D `tools/pixelart/`.
- **Source de vérité** : `tools/render3d/manifest.json` (prioritaire) fusionné avec `tools/pixelart/manifest.json` (fichier, taille de frame, nombre de frames, durées par frame, boucle, pivot, frames actives). `src/config/assets.ts` le lit ; `PreloaderScene` charge chaque feuille et **crée toutes les animations une seule fois** dans le gestionnaire global (`this.anims` est global en Phaser 4).
- **Durées par frame** : en Phaser 4, `frames[i].duration` **remplace** la durée par défaut (elle ne s'y ajoute pas).
- **Directions** : 3 dessinées (`down`, `up`, `side`) ; la gauche est `side` + `flipX`. Choix via `facingFromAngle(angle)`.
- **Un seul point d'appel de `play()` par entité** (`playAnim`), qui gère direction, miroir et vitesse de lecture. Les états de la StateMachine demandent une animation ; ils ne manipulent jamais les frames à la main.
- `AnimationFrame.index` **commence à 1** en Phaser 4 (pas de poussière, événements de frame : `frame.index - 1`).
- Pivot aux pieds : `setOrigin` d'après le manifeste (héros 48×48 : `(0.5, 44/48)`), ombre au sol séparée (`shadow_*`, opacité 0,5 par le moteur). Profondeur = `y` des pieds.
- Jamais de mise à l'échelle non entière **durable** d'un sprite de jeu ; seule exception : le squash & stretch bref de `GameFeel.squash`. `pixelArt` et `roundPixels` restent activés.
- **Normal maps** : chaque feuille de personnage, tileset ou prop peut avoir une `<nom>_n.png` de mêmes dimensions (champ `normalMap` du manifeste), chargée avec la feuille pour l'éclairage dynamique.

## 5 bis. Règle 4 — 3D temps réel (entrée `play3d.html`)

- **Couches** (ESLint) : `src/sim/` est **pur** (ni `three`, ni `phaser`, ni DOM, ni `Math.random`, ni `Date.now`) et testé dans `tests/sim*.test.ts` ; `src/engine/` (boucle, entrées), `src/ui/hud/` (HUD DOM) et `src/ui/menus/` (menus DOM, GSAP) n'importent jamais `three` ; `src/view/` (Three.js) n'importe ni l'UI ni les scènes ; seules `src/scenes3d/` et `src/main3d.ts` assemblent. `src/systems/` et `config/` sont partagés avec la version Phaser.
- **Plan du sol** : la sim travaille en unités de `balance.ts` ; la vue affiche `(x, y)` u en `(x/30, 0, y/30)` m (`sim/units.ts`). Angles logiques `atan2(dy, dx)` ; un modèle tourné vers +Z prend `yawFromAngle(angle)`.
- **Pas fixe 60 Hz** (`sim/clock/FixedClock`) : hitstop et ralenti passent par `TimeControl` (jamais de temps réel dans la sim) ; le hitstop donne **zéro pas**. La vue interpole et ne modifie jamais la sim ; la sim publie des `SimEvent` que la vue consomme.
- **Collisions** : `sim/physics/collision.ts` (cercle ↔ grille, cercle ↔ cercle) remplace Arcade. Les règles 1 (hitboxes géométriques, télégraphes magenta ≥ 300 ms, timings de `balance.ts`, game feel) restent valables mot pour mot.
- **Rendu** : référence visuelle = `prototypes/proto3d/` (validé par le porteur ; ne pas le modifier depuis `src/`). Toute nouvelle option visuelle respecte le preset de qualité (`view/quality.ts`) et la **Réduction des mouvements** (aucun clignotement ni stroboscope).
- **Lumières** : nombre fixe par salle (pas de recompilation de shaders) ; émissifs + bloom pour le reste. Libérer géométries, matériaux et textures propres à un objet à sa destruction (`dispose`).
- **Flux du Shift** : `sim/RunDirector.ts` (port pur de `RunScene`) ; minuteries en temps de sim, fenêtres de choix comme état (`director.choice`) auxquelles l'UI répond. **Personnages** : toujours derrière `view/actors/ActorView` (`createEnemyView`), pour remplacer un modèle procédural par un GLB sans toucher la sim.

## 6. Workflow d'une feature : 1) logique → 2) placeholders → 3) vrais sprites

1. **Logique d'abord.** Relire la section du GDD (la compléter s'il manque une règle : le doc précède le code). Ajouter les constantes dans `balance.ts`, les types et le système pur dans `src/systems/`, **avec ses tests**. `npm run test` vert avant d'ouvrir une scène.
2. **Placeholders ensuite.** Brancher dans l'entité ou la scène. Si le PNG n'existe pas encore, il suffit de le déclarer : `PreloaderScene` génère un placeholder animé **aux mêmes dimensions et au même découpage** (`src/ui/placeholders.ts`). Le jeu doit être jouable et lisible ainsi (couleurs du canon : héros orange `#FF7A1A`, ennemis turquoise `#19C3B1`, danger magenta `#FF3EA5`). Régler hitboxes, timings et game feel à ce stade.
3. **Vrais sprites enfin.** Produire le PNG (générateur `tools/pixelart/`, pack itch.io ou freelance) au nom, à la taille de frame et au nombre de frames prévus ; mettre à jour le manifeste (`npm run assets`) et `CREDITS.md` pour tout asset tiers. Aucun code ne change si le contrat est respecté. Vérifier dans le jeu : pivot, frame active alignée sur la hitbox, lisibilité à ×1.

**Finir proprement** : `npm run check` et `npm run build` verts, test manuel dans `npm run dev` (scénario nominal, mort, retour à l'OCC), doc mise à jour si le comportement change, commit atomique en français à l'impératif.

## 7. Pièges Phaser 4 à connaître

- `setTintFill()` n'existe plus → `setTint(c).setTintMode(Phaser.TintModes.FILL)`.
- `createLayer` renvoie une union : vérifier `instanceof Phaser.Tilemaps.TilemapLayer`.
- Les FX et masques sont des filtres ; `Math.TAU` vaut 2π ; `Struct.Set/Map` sont des `Set`/`Map` natifs.
- Le renderer Canvas est déprécié : `type: Phaser.WEBGL`.
- Doc embarquée : `node_modules/phaser/changelog/v4/4.0/MIGRATION-GUIDE.md`, `node_modules/phaser/docs/`, `node_modules/phaser/skills/`.

## 8. Ce que Claude ne fait pas sans demander

- Changer la stack ou une version majeure, assouplir `tsconfig`/ESLint, ajouter une dépendance runtime (Phaser, Three.js et GSAP sont les seules ; `three` et `gsap` sont épinglés en version exacte, GSAP sert au mouvement des menus DOM).
- Modifier le canon (noms, lieux, fins) ou une formule d'équilibrage sans mettre à jour le GDD.
- Nommer une personne réelle, reproduire un logo ou une marque, intégrer un asset sans licence compatible (CC0, CC-BY avec crédit, licence commerciale du pack).
- Supprimer ou désactiver un test, pousser sur une autre branche que celle demandée, créer une PR non demandée.

## 9. Carte du dépôt

```
src/main.ts                 # Phaser.Game : WebGL, 640×360, pixelArt, physics: { default: 'arcade' }
src/config/                 # constants.ts (scènes, registry, couleurs), balance.ts (fait foi), assets.ts (manifeste)
src/scenes/                 # Boot, Preloader, MainMenu, Hub (OCC), Run (Shift), UI (HUD, tactile, choix), Pause, Results
src/entities/               # Player, Enemy (+ enemies/ : ConsultantJunior, BorneAutomatique, DroneOptimetre, ManagerKpi, Auditeur, TrainingDummy), Weapon, Room, Projectile, Hazard, Pickup, CombatWorld
src/systems/                # PUR : StateMachine, InputBuffer, combat/, procedural/, meta/, save/
src/fx/GameFeel.ts          # hitstop, ralenti, secousses, flash, squash & stretch, traînées, particules, nombres
src/fx/Atmosphere.ts        # éclairage dynamique, halos, bloom, étalonnage, vignette, poussières (DA moderne)
src/ui/                     # Controls (clavier, souris, manette, tactile), placeholders
src/platform/               # seul accès au navigateur hors Phaser (localStorage)
src/utils/                  # rng (graines), math
tests/                      # Vitest : logique pure, gabarits de salles, simulation 3D (sim.test.ts)
play3d.html, src/main3d.ts  # entrée 3D (Three.js) pendant la migration
src/sim/                    # PUR : World, RunDirector (Shift), HeroSim, enemies/ (5 types + boss), Weapon, Projectiles, Hazards, Pickups, WaveDirector, physics/, clock/
src/engine/                 # Loop (rAF), Input (clavier, souris, manette, tactile) : DOM, sans three
src/view/                   # Three.js : GameView, RoomView, actors/ (ActorView, factory), HazardViews, ItemsView, fx/, materials/toon, post/, quality
src/ui/hud/, src/ui/menus/  # HUD et menus DOM de la 3D (titre, pause, options, choix, départs ; GSAP)
src/scenes3d/               # Game3D (titre → Shift → départs, assemble sim + view + engine + ui), demoApi (dev, captures)
tools/render3d/             # personnages : modèles 3D → pixel art (Blender/bpy), manifest.json prioritaire
tools/pixelart/             # décor, props, VFX, UI (générateur 2D) + manifest.json, planches de contrôle
public/assets/              # sprites/{player,enemies,bosses,npcs,vfx,pickups,ui,portraits}, tilesets, audio/{sfx,music}, fonts
docs/                       # GDD, LORE, ARCHITECTURE, PIXEL_ART_GUIDE
```
