# Privatix — Architecture technique (Hack 'n' Slash / Roguelite top-down)

> **Statut** : document de référence du Lead Developer pour le pivot action-roguelite. Il **remplace entièrement** l'architecture du RPG au tour par tour (conservée dans l'historique git, voir § 14).
> **Ordre de foi** : le code du dépôt, puis le canon de direction (arbitrages GD / narrative / art), puis ce document. Les **valeurs** de gameplay (dégâts, timings, PV) ne sont recopiées ici qu'à titre d'exemple : la source unique est `src/config/balance.ts`, alimentée par le GDD.
> **Site** : statique, Docker + nginx, déployé par Coolify sur **https://privatix.fs0ciety.org** (inchangé).
> Toutes les API Phaser citées ont été vérifiées dans `node_modules/phaser` 4.2.1 (types, guide de migration v4 et code source quand la doc ne suffisait pas).

## 1. Stack, configuration et déploiement
### 1.1 Versions
| Brique | Version (`package.json`) | Rôle et justification |
|---|---|---|
| **Phaser** | `^4.2.1` | Moteur (décision du porteur du projet). Arcade Physics, tilemaps Tiled, animations, particules, caméras, filtres (remplacent les FX v3). Renderer **WebGL** (Canvas est déprécié en v4). |
| **TypeScript** | `^5.9.3`, strict maximal | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`. On n'assouplit jamais. |
| **Vite** | `^7.3.7` | Dev server + HMR, build Rollup, `public/` copié tel quel, alias `@/` → `src/`. |
| **Vitest** | `^4.1.11` | Tests de la logique pure en Node (`environment: 'node'`), sans Phaser ni DOM. |
| **ESLint** | `^10` + `typescript-eslint ^8.71` | `strictTypeChecked` + **garde-fous d'architecture** (§ 2.3). |
| **Node** | 22 LTS | Même version en local, en CI et dans l'image Docker (`node:22-alpine`). |

Aucune dépendance runtime en plus de `phaser`. Toute nouvelle dépendance (runtime ou dev) se discute en revue.

### 1.2 Configuration Phaser 4 (`src/main.ts`)
```ts
// src/main.ts — instance unique, jamais exportée (pas de singleton global accessible ailleurs).
import Phaser from 'phaser';
// + imports de GAME_WIDTH/GAME_HEIGHT (config/constants) et des 8 scènes (@/scenes/*)
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,                 // filtres caméra et tint modes = WebGL
  parent: 'game', width: GAME_WIDTH, height: GAME_HEIGHT,   // 640×360 = résolution de l'art
  backgroundColor: '#0b0e17',
  pixelArt: true,                     // antialias off + roundPixels on (raccourci)
  roundPixels: true,                  // explicite : vaut false par défaut en v4
  render: { powerPreference: 'high-performance' },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: {
    default: 'arcade',
    arcade: {                                                 // vue de dessus, pas fixe : knockbacks reproductibles
      gravity: { x: 0, y: 0 }, fps: 60, fixedStep: true,
      debug: import.meta.env.DEV && import.meta.env.VITE_ARCADE_DEBUG === '1',
    },
  },
  input: { activePointers: 3, gamepad: true },   // stick virtuel + 2 boutons tactiles ; manette
  fps: { target: 60, smoothStep: true },
  scene: [BootScene, PreloaderScene, MainMenuScene, HubScene, RunScene, UIScene, PauseScene, ResultsScene],
  // BossIntroScene s'ajoutera à cette liste quand le boss 1 sera intégré.
};
new Phaser.Game(config);
```
Points d'attention Arcade :
- `fixedStep: true, fps: 60` : simulation déterministe. Sur écran **120 Hz**, la physique avance une frame d'affichage sur deux (micro-saccade possible avec la caméra qui suit) : si c'est visible en test, passer à `fps: 120` (2 pas par frame à 60 Hz, coût négligeable sous 100 corps) plutôt que `fixedStep: false`.
- **`physics.world.timeScale` a une sémantique inversée** (`msPerFrame = frameTime × timeScale`) : `2` = deux fois **plus lent**. À l'inverse, `this.time.timeScale`, `this.tweens.timeScale` et `this.anims.globalTimeScale` : `2` = plus rapide. Toujours passer par `GameFeel` (§ 8), jamais directement.
- `Phaser.Physics.Arcade.Sprite#body` est typé `Body | StaticBody | null` : dans nos sous-classes, `declare public body: Phaser.Physics.Arcade.Body;`. Les callbacks de collider reçoivent des unions larges : **type guards** (`instanceof`, `isHurtable`), jamais de cast aveugle.

### 1.3 Résolution 640×360 et mise à l'échelle entière
640×360 est un diviseur **entier** de tous les formats 16:9 courants : 1280×720 → ×2, 1920×1080 → ×3, 2560×1440 → ×4, 3840×2160 → ×6. Il donne ≈ 40×22 tuiles de 16 px visibles, assez de recul pour lire les télégraphes (critique sur mobile). **1 texel = 1 px logique**, dans le monde comme dans l'UI. La caméra du monde reste en **zoom 1** : la résolution logique *est* la résolution de l'art (l'ancien `WORLD_ZOOM = 2` du RPG disparaît, il empêchait l'arrondi des sommets).

**Le piège vérifié dans `ScaleManager#updateScale`** : en mode `FIT`, l'option `scale.zoom` n'agit **pas** sur la taille d'affichage. Le canvas 640×360 est étiré en CSS pour remplir le parent en gardant le ratio, donc à un facteur **pas forcément entier** (1366×768 → ×2,13 : quelques colonnes de pixels plus larges que d'autres). Phaser pose déjà `image-rendering: pixelated` quand l'antialias est coupé.

| Mode | Config | Rendu | Usage |
|---|---|---|---|
| **`FIT` (défaut)** | `mode: FIT, autoCenter: CENTER_BOTH` | Remplit l'écran au ratio près ; facteur parfois fractionnaire (irrégularité invisible à ×3 et plus) | **Mobile et défaut desktop** : on ne gaspille pas d'écran. |
| **« Pixel parfait »** (réglage) | `mode: NONE, zoom: MAX_ZOOM` | `getMaxZoom()` = plus grand **entier** qui tient dans le parent, bandes noires autour | Option desktop dans Réglages ; rappeler `this.scale.setMaxZoom()` sur `resize`. |

```ts
// Appliqué au démarrage (BootScene) et quand le réglage change (MainMenu / Pause).
export function applyScaleMode(game: Phaser.Game, pixelPerfect: boolean): void {
  const scale = game.scale;
  scale.scaleMode = pixelPerfect ? Phaser.Scale.NONE : Phaser.Scale.FIT;
  if (pixelPerfect) scale.setMaxZoom(); else scale.setZoom(1);
  scale.refresh();
}
```
Le `FIT` reste le défaut parce que l'option `NONE + MAX_ZOOM` laisse jusqu'à 30 % de l'écran en bandes noires sur certains formats (1366×768 → ×2 seulement) ; elle est proposée, pas imposée, et doit être validée en navigateur avant d'être exposée.

### 1.4 Pièges Phaser 4 qui concernent ce projet
| Piège (vérifié) | Règle |
|---|---|
| `roundPixels` vaut `false` par défaut ; l'arrondi `safeAuto` ne s'applique qu'aux objets **ni tournés ni mis à l'échelle**, caméra **non zoomée** | Caméra en zoom 1, sprites en échelle 1. Les objets tournés (slash VFX, projectile orienté) ne sont pas arrondis : acceptable. Ne jamais activer `smoothPixelArt` (exclusif de `pixelArt`). |
| `setTintFill()` n'existe plus (méthode vide) | `sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)` ; `clearTint()` remet aussi le mode `MULTIPLY`. |
| FX (preFX/postFX) → **filtres** | `camera.filters.external.addVignette()`, `addColorMatrix()` ; **filtres caméra uniquement** (chaque filtre par sprite coûte des draw calls). |
| `Phaser.Struct.Set/Map` → `Set`/`Map` natifs | `group.children.each()` n'existe plus : `for (const go of group.getChildren())`. |
| `map.createLayer()` renvoie `TilemapLayer \| TilemapGPULayer` | Narrowing `instanceof Phaser.Tilemaps.TilemapLayer` avant `setCollision`. |
| **`AnimationFrame.index` est 1-based** | Index 0-based dans nos données ; conversion `frame.index - 1` à un seul endroit (§ 5.8). |
| **`AnimationFrame.duration` remplace** la durée par défaut (`nextTick = frame.duration \|\| msPerFrame`, `Animation.js`) | Nos durées par frame sont **absolues** (ms), pas additives. |
| `this.anims` est le gestionnaire **global** du jeu | `this.anims.pauseAll()` gèle aussi l'UI : on ne l'utilise pas pour le hitstop (§ 8). |

### 1.5 Commandes npm
- `npm ci` (CI, Docker ; en local, 1re installation : `npm install --legacy-peer-deps` à cause des peers de Vitest 4 avec npm 10).
- `npm run dev` : Vite sur `http://localhost:5173` (`--host` : testable depuis un téléphone du réseau local) ; `VITE_ARCADE_DEBUG=1 npm run dev` affiche les corps Arcade.
- `npm run typecheck` (`tsc --noEmit`), `npm run lint` / `lint:fix`, `npm run test` / `test:watch`, `npm run format` / `format:check`.
- **`npm run check`** = typecheck + lint + test : obligatoire avant tout commit.
- `npm run build` = `tsc --noEmit && vite build` → `dist/` (bundles hashés dans `dist/bundle/`, assets non hashés dans `dist/assets/`) ; `npm run preview` sert `dist/` sur `:4173`.

### 1.6 Déploiement (inchangé)
- **Dockerfile** multi-étapes : `node:22-alpine` (`npm ci` puis `npm run build`, donc le typecheck casse le build en cas d'erreur) → `nginx:stable-alpine` qui sert `dist/` sur le port 80, avec `HEALTHCHECK` sur `/healthz`.
- **nginx.conf** : `/bundle/` immuable (cache 1 an, noms hashés) ; `/assets/` cache 1 jour + revalidation ETag, **sans fallback SPA** (un PNG manquant doit renvoyer 404, pas du HTML que le loader Phaser essaierait de décoder) ; `index.html` en `no-cache` ; gzip pour JS/JSON.
- **Vite** : `base: './'` (chemins relatifs), Phaser isolé dans son propre chunk (`manualChunks`) pour profiter du cache navigateur entre deux déploiements.
- **Coolify** : build de l'image à chaque push sur la branche de production, health check Docker. Rien à changer pour le pivot ; les nouveaux dossiers `public/assets/{sprites,tilesets,audio,fonts}` sont couverts par la règle `/assets/`.

## 2. Structure du code
### 2.1 Arborescence (imposée)
```
src/main.ts                       # Phaser.Game : pixelArt: true, physics: { default: 'arcade' }, 640×360
src/config/                       # constants.ts (dimensions, SceneKeys, clés d'events), balance.ts (équilibrage du GDD), assets.ts (manifeste des sprites et animations)
src/scenes/                       # BootScene, PreloaderScene, MainMenuScene, HubScene, RunScene, UIScene, PauseScene, ResultsScene (BossIntro plus tard)
src/entities/                     # Player.ts, Enemy.ts (+ enemies/ConsultantJunior.ts, BorneAutomatique.ts, DroneOptimetre.ts), Weapon.ts (la clé à tire-fond), Projectile.ts, Room.ts
src/systems/                      # LOGIQUE PURE sans Phaser : StateMachine.ts, InputBuffer.ts, combat/ (dégâts, burnout, mobilisation), procedural/ (graphe de Shift, RoomTemplate, vagues), meta/ (progression OCC), save/SaveManager.ts
src/fx/                           # GameFeel.ts (screenshake, hitstop, flash, particules, nombres de dégâts poolés)
src/ui/                           # composants HUD (barres Énergie/Burnout/Mobilisation, charges de dash, Gobelets)
src/utils/                        # rng.ts (seedé), math.ts
tests/                            # Vitest (logique pure)
public/assets/sprites/{player,enemies,bosses,npcs,vfx,pickups,ui,portraits}/
public/assets/tilesets/           # tilesets de biomes, props, trains, lumières
public/assets/audio/{sfx,music}/
public/assets/fonts/
tools/pixelart/                   # générateur Python des sprites originaux (régénérables)
```
### 2.2 Rôle de chaque module
| Module | Couche | Contenu et responsabilités |
|---|---|---|
| `src/main.ts` | Phaser | Config du jeu (§ 1.2) et liste des scènes. Rien d'autre. |
| `config/constants.ts` | **pur** | `GAME_WIDTH/HEIGHT`, `TILE = 16`, `SceneKeys`, `RegistryKeys`, clés et types des événements (`RunEvents`), profondeurs (`Depth`). |
| `config/balance.ts` | **pur** | Toutes les valeurs du GDD : stats du héros, `AttackDef` du combo, dash, sifflet/préavis, Burnout (paliers, plancher), Mobilisation, Gobelets, stats des ennemis, scaling par salle `r`, multiplicateurs du 3x8, budgets de vagues. **Aucun nombre magique ailleurs.** |
| `config/assets.ts` | **pur** | Manifeste des bandes `*_stripN.png` (chemin, taille de frame, durées par frame, boucle) et des images statiques, tilesets, sons, polices (§ 7.2). |
| `scenes/` | Phaser | Orchestration : chargement, navigation, câblage des entités et systèmes. Une scène ne contient pas de règle de jeu. |
| `entities/Player.ts` | Phaser | `Phaser.Physics.Arcade.Sprite` qui **implémente** `PlayerCtx` (interface pure) et possède sa `StateMachine`, son `InputBuffer` et sa `Weapon`. Créé une fois par Shift. |
| `entities/Enemy.ts` + `enemies/*` | Phaser | Base **poolable** (`spawn`/`despawn`) ; une sous-classe = une table d'états + une attaque. |
| `entities/Weapon.ts`, `Projectile.ts` | Phaser | La **clé à tire-fond** : applique les `AttackDef` (combo, estoc de dash, sifflet) au monde : requêtes de hitbox, set « déjà touchés », Montages/Réglages en modificateurs. `Projectile` : `Arcade.Image` poolé (`fire()` / `kill()`). |
| `entities/Room.ts` | Phaser | Salle construite depuis un `RoomTemplate` : tilemap, calques de collision, portes, slots, progression des vagues. `build()` à l'entrée, `destroy()` à la sortie. |
| `systems/StateMachine.ts` | **pur** | Machine d'états générique typée (§ 5.2). Les tables d'états (`playerStates.ts`, `enemyStates.ts`) vivent à côté, dans `systems/`. |
| `systems/InputBuffer.ts` | **pur** | Buffer 150 ms des actions (§ 5.5). |
| `systems/combat/` | **pur** | `damage.ts` (`resolveHit`, critiques, knockback), `Burnout.ts` (paliers, plancher, pétage de plombs), `Mobilisation.ts`, `geometry.ts` (arc, rectangle orienté, cercle), `AttackTokens.ts` (jetons d'attaque des ennemis), `DashCharges.ts`, `attackTiming.ts` (timings du GDD → frames). |
| `systems/procedural/` | **pur** | `ShiftPlan.ts` (graphe d'un biome et du Shift), `RoomLayout.ts` (interface `RoomTemplate`, parse ASCII puis Tiled, remplissage des slots), `roomTemplates.ts` (gabarits ASCII), `Waves.ts`. |
| `systems/meta/` | **pur** | `MetaState.ts`, `RunState.ts` (`applyRunResult`), `Avantages.ts`, coûts du Tableau des revendications, Montages, Tasses de Relève. |
| `systems/save/SaveManager.ts` | **pur** | `SaveManager<T>` versionné avec migrations ; le stockage est **injecté** (§ 9). L'accès au navigateur reste dans `src/platform/` (`storage.ts`, `save.ts`). |
| `fx/GameFeel.ts` | Phaser | Hitstop, screenshake, flash, ralentis, particules, nombres de dégâts poolés (§ 8). La création des animations (§ 7.3) est dans `PreloaderScene`, et sortira dans `fx/AnimationFactory.ts` si elle grossit. |
| `ui/` | Phaser | HUD : barres Énergie/Burnout/Mobilisation, charges de dash, Gobelets, barre de boss, stick virtuel tactile. Ne lit que le registry et le bus d'événements. |
| `utils/` | **pur** | `rng.ts` (mulberry32 + flux dérivés + graine lisible), `math.ts` (`Vec2`, `clamp`, angles), `TypedEvents.ts` (bus typé). |
| `tests/` | Node | Vitest sur tout ce qui est pur (§ 11). |
| `tools/pixelart/` | Python (hors bundle) | Génère les sprites originaux au format exact du manifeste (§ 13). |

**Principe d'adaptateur** : toute décision de gameplay (quel état, combien de dégâts, quelle salle, quel ennemi) est prise par du code pur, testé en Node. Les classes Phaser implémentent une interface de contexte (`PlayerCtx`, `EnemyCtx`) et **appliquent** le résultat (vitesse, animation, son, particules).

### 2.3 Règles de dépendance (imposées par ESLint)
Sens autorisé : `scenes` → `entities`, `fx`, `ui` → `systems` → `utils` ; `config` est lu par tous et n'importe que `utils`.

1. `src/systems/**` et `src/utils/**` **n'importent jamais `phaser`** (ni `import type`). On y ajoute `src/config/**` : constantes, équilibrage et manifeste sont des données, lisibles par les tests.
2. `systems/` n'importe ni `scenes/`, ni `entities/`, ni `fx/`, ni `ui/`.
3. Seule `PreloaderScene` déclare `preload()` (règle existante).
4. Aucune variable mutable de module (pas de singleton) : les services sont créés par la scène et passés en paramètre.

```js
// eslint.config.js — extrait à mettre à jour (les dossiers data/ et platform/ du RPG disparaissent)
{
  files: ['src/systems/**/*.ts', 'src/utils/**/*.ts', 'src/config/**/*.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [{ name: 'phaser', message: 'Logique pure : pas de Phaser ici (ARCHITECTURE § 2.3).' }],
      patterns: [{ group: ['@/scenes/*', '@/entities/*', '@/fx/*', '@/ui/*'],
                   message: 'La logique pure ne dépend pas des couches Phaser.' }],
    }],
  },
},
```
### 2.4 Conventions transverses
- **Temps de jeu** : les machines d'états, le comportement des ennemis, les cooldowns et le buffer reçoivent un **delta de jeu** (mis à 0 pour une entité en hitstop, multiplié pendant un ralenti) et lisent l'horloge du Shift `nowMs` (somme des deltas de jeu), jamais `Date.now()`.
- **Aléatoire** : tout tirage de gameplay passe par un `Rng` seedé injecté (§ 4.2). `Math.random` est réservé au cosmétique (particules, pitch des sons).
- **Fonctions pures** au patron `(state, input) → { state, events }` : la scène applique `state` et joue `events` (sons, VFX).
- **Nommage** : classes en PascalCase (un fichier par classe), fonctions et fichiers utilitaires en camelCase, clés Phaser en kebab-case (`player-run-down`).

## 3. Gestionnaire de scènes
### 3.1 Les scènes
| Clé (`SceneKeys`) | Rôle | Lancée par | Données d'entrée (`init(data)` typé) |
|---|---|---|---|
| `Boot` | Réglages minimaux (mode d'échelle depuis la sauvegarde), police pixel et barre de chargement | auto (1re de la liste) | — |
| `Preloader` | **Seul** `preload()` du jeu : manifeste `config/assets.ts` (bandes, tilesets, sons, polices). `create()` : bandes de secours pour les PNG manquants, création des animations, lecture de la sauvegarde → `MetaState` dans le registry | `start` | — |
| `MainMenu` | Continuer / Nouveau Shift / Réglages (screenshake, hitstop, flashs, nombres de dégâts, pixel parfait) / saisie de graine | `start` | — |
| `Hub` (OCC) | Salle explorable, même `Player` sans combat (sauf mannequin de Josiane) : Marcel (Tableau des revendications), la Vieille Dame (Tasses de Relève), l'établi de Kevin (Montages), Béné, Yasmina (Plan d'Économies, roulement 3x8) | `start` | `{ lastResult?: RunResult }` (fait avancer les dialogues) |
| `Run` | **La** scène de jeu d'un Shift : reconstruit les salles sur place, possède joueur, pools, `GameFeel`, bus d'événements | `start` (une fois par Shift) | `RunSceneData` (graine, roulement, Tasse, Montage, Plan d'Économies, instantané éventuel) |
| `UI` | HUD en overlay : Énergie, Burnout, Mobilisation, charges de dash, Gobelets, Tickets, horloge du Shift, mini-carte, barre de boss | `launch` par `Run` | `{ bus: TypedEvents<RunEvents> }` |
| `Pause` | Overlay modal : reprendre, réglages, carte du Shift, abandonner ; affiche la graine lisible | `Run` : `scene.pause()` + `launch` | `{ seedLabel: string }` |
| `BossIntro` *(plus tard)* | Carton titre du boss (≈ 2 s : nom + sous-titre satirique) au-dessus de `Run` | `launch` par `Run` | `{ bossId: BossId }` |
| `Results` | Fin de Shift : victoire/échec, salles, temps, « Retard cumulé », PS/Grains gagnés → `applyRunResult` + sauvegarde | `start` (arrête `Run` et `UI`) | `RunResult` |

**Le boss n'est pas une scène** : c'est un type de salle (`kind: 'boss'`) dans `Run`, avec les mêmes systèmes (dégâts, hitstop, pools, HUD). Seuls le carton `BossIntro` et la barre de vie (dans `UI`, événement `boss-hp`) lui sont propres. Une `BossScene` dupliquerait joueur, pools et colliders.

### 3.2 Flux
```
Boot ──► Preloader ──► MainMenu ──► Hub (OCC) ◄──────────────────────────────┐
                                      │  tableau des roulements : start(Run)   │
                                      ▼                                        │
                                     Run ──┬── launch UI        (overlay, vit tant que Run vit)
                                      │    ├── pause Run + launch Pause ──► resume Run / abandon
                                      │    ├── sleep UI + launch BossIntro ──► wake UI (salle de boss)
                                      │    └── salle suivante : fondu, Room.destroy(), Room.build()
                                      │
                                      └── start(Results) ── mort, abandon, victoire ──► start(Hub, { lastResult })
```
Perte de focus (`Phaser.Core.Events.BLUR` et `HIDDEN` sur `this.game.events`) pendant un Shift → `Pause` s'ouvre automatiquement. Les écouteurs sont retirés au `SHUTDOWN` de `Run`.

### 3.3 `start`, `launch`, `pause`, `sleep` : quand utiliser quoi
| Appel | Effet Phaser | Usage dans Privatix |
|---|---|---|
| `this.scene.start(key, data)` | Arrête la scène courante (`SHUTDOWN`), démarre `key` (`init` → `preload` → `create`) | Changement d'écran plein : Boot → Preloader → MainMenu → Hub → Run → Results → Hub. Une **nouvelle graine = un nouveau `start(Run)`** (ardoise propre). |
| `this.scene.launch(key, data)` | Démarre `key` **en parallèle**, la scène courante continue | Overlays : `UI`, `Pause`, `BossIntro`. |
| `this.scene.pause(key?)` / `resume` | Plus d'`update`, le rendu continue | `Run` derrière `Pause` (le monde reste visible, figé). |
| `this.scene.sleep(key)` / `wake` | Ni `update` ni rendu, l'état est conservé | `UI` pendant `BossIntro` et pendant le fondu de mort (écran épuré). |
| `this.scene.stop(key)` | `SHUTDOWN` de `key` | `Run` arrête `UI` (et `Pause` si ouverte) dans son propre `SHUTDOWN`. |
| `this.scene.restart(data)` | `SHUTDOWN` + `init` de la même scène | **Interdit pour changer de salle** (§ 3.4). Toléré pour « Recommencer avec la même graine » depuis `Results`. |
| `this.scene.bringToTop(key)` | Ordre d'affichage | `Pause` au-dessus de `UI`. |

Les appels `start/stop/launch` sont mis en file et exécutés au début de la frame suivante : ne jamais lire l'état d'une scène juste après l'avoir lancée.

Les lancements passent par `scenes/SceneNav.ts` : `startScene(from, key, data)` et `launchScene(...)`, typés par une table `SceneDataMap` (clé de scène → type de `data`), si bien qu'une donnée manquante ou mal formée est une erreur de compilation.

### 3.4 `RunScene` : reconstruire la salle sur place, derrière un fondu
`scene.restart()` à chaque salle recréerait joueur, pools, émetteurs et textes poolés (GC, reconfiguration), forcerait à redéclarer les écouteurs de `UI` et du registry (risque de doublons) et à tout repasser par `init(data)`. La reconstruction sur place ne refait que tilemap et colliders ; en contrepartie, les fuites ne sont plus masquées par le shutdown : on les surveille (compteurs, § 10).

```ts
// src/scenes/RunScene.ts — porte franchie : fondu → démontage → construction → fondu
private goTo(nextId: number, entrySide: DoorSide): void {
  if (this.transitioning) return;
  this.transitioning = true;                          // entrées ignorées, joueur invulnérable
  this.player.freezeForTransition();
  const cam = this.cameras.main;
  cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    this.teardownRoom();                              // room.destroy(), ennemis/tirs rendus au pool, tweens de salle tués
    this.run = advanceRoom(this.run, nextId);         // pur : horloge +30 min, plancher de Burnout, r + 1
    this.registry.set(RegistryKeys.Run, this.run);
    this.enterRoom(nextId, entrySide);                // Room.build(), joueur à la porte opposée, vagues planifiées
    this.saveSnapshot();                              // reprise possible d'un Shift interrompu (mobile)
    cam.fadeIn(160);
    this.transitioning = false;
    this.bus.emit('room-entered', { roomId: nextId, r: this.run.roomRank });
  });
  cam.fadeOut(160, 0, 0, 0);
}
```
Ordre de `teardownRoom()` : (1) `room.destroy()` qui détruit ses colliders, ses zones de porte et la tilemap (`map.destroy()` détruit ses calques) ; (2) `enemies`/`projectiles`/`pickups` actifs rendus au pool (`despawn`/`kill`, jamais `destroy`) ; (3) tweens et `delayedCall` taggés « salle » tués ; (4) ramassables non pris convertis (Tickets) ou perdus. Le joueur, les pools, `GameFeel` et le bus **survivent**.

### 3.5 Passage de données : trois canaux, chacun son usage
1. **`init(data)` typé** pour ce qui est propre au lancement (`RunSceneData`, `RunResult`). Tous les champs d'instance sont **remis à zéro dans `init()`**, jamais seulement dans le constructeur (une scène relancée ne repasse pas par le constructeur).
2. **Registry** pour l'état observable et durable : `RegistryKeys.Meta` (persistant) et `RegistryKeys.Run` (le HUD réagit à `changedata-run`). Écritures **immuables** via des helpers (`updateRun(registry, (r) => ({ ...r, tickets: r.tickets + 5 }))`). Le registry n'est **pas** la source des positions et vitesses (elles restent dans les corps Arcade).
3. **Bus d'événements typé, une instance par Shift** pour les événements ponctuels (coup porté, salle nettoyée, boss touché) : créé par `Run`, passé à `UI` via `launch`, vidé au `SHUTDOWN`. Pas d'`EventEmitter` global de module.

```ts
// src/utils/TypedEvents.ts — pur, sans cast
export class TypedEvents<E extends Record<string, unknown>> {
  private handlers: { [K in keyof E]?: Set<(payload: E[K]) => void> } = {};
  public on<K extends keyof E>(event: K, fn: (payload: E[K]) => void): () => void {
    const set = this.handlers[event] ?? new Set<(payload: E[K]) => void>();
    this.handlers[event] = set;
    set.add(fn);
    return () => { set.delete(fn); };            // l'abonné garde ce désabonnement et l'appelle au SHUTDOWN
  }
  public emit<K extends keyof E>(event: K, payload: E[K]): void {
    this.handlers[event]?.forEach((fn) => { fn(payload); });
  }
  public clear(): void { this.handlers = {}; }
}
```
```ts
// src/config/constants.ts — extrait
export const GAME_WIDTH = 640, GAME_HEIGHT = 360, TILE = 16;
export const SceneKeys = {
  Boot: 'Boot', Preloader: 'Preloader', MainMenu: 'MainMenu', Hub: 'Hub', Run: 'Run',
  UI: 'UI', Pause: 'Pause', BossIntro: 'BossIntro', Results: 'Results',
} as const;
export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];
export const RegistryKeys = { Meta: 'meta', Run: 'run', Settings: 'settings' } as const;
/** Événements ponctuels d'un Shift (bus typé créé par RunScene). */
export type RunEvents = {
  'room-entered': { readonly roomId: number; readonly r: number };
  'room-cleared': { readonly roomId: number };
  'enemy-hit': { readonly x: number; readonly y: number; readonly damage: number; readonly crit: boolean; readonly killed: boolean };
  'player-hit': { readonly damage: number };
  'dash': { readonly charges: number; readonly perfect: boolean };
  'meltdown': { readonly active: boolean };          // Pétage de plombs
  'boss-hp': { readonly ratio: number };
  'shift-over': { readonly victory: boolean };
};
/** Profondeurs : sol < dangers < ombres < acteurs triés par y < décor haut < VFX < textes de monde. */
export const Depth = { Floor: 0, Hazards: 5, Shadows: 10, ActorsBase: 1000, DecoHaute: 4000, Vfx: 5000, WorldText: 6000 } as const;
```
Les **nombres de dégâts** vivent dans le monde (ils suivent la caméra) : ils appartiennent à `Run` (via `GameFeel`), pas à `UI`.

### 3.6 Cycle de vie et nettoyage
| Moment | `Run` doit… |
|---|---|
| `init(data)` | Remettre à zéro tous les champs (`transitioning`, `room`, compteurs), stocker `data`. |
| `create()` | Créer une fois : `bus`, `GameFeel`, pools (ennemis par archétype, projectiles, ramassables), `Player`, colliders permanents ; `launchScene(UI, { bus })` ; entrer dans la 1re salle. S'abonner à `SHUTDOWN` **une seule fois** : `this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this)`. |
| `update(time, delta)` | `const dt = this.feel.update(delta)` (delta de jeu), puis joueur, ennemis, salle, avec ce `dt`. Jamais d'allocation sur le chemin chaud. |
| Changement de salle | `teardownRoom()` + `enterRoom()` (§ 3.4). |
| `SHUTDOWN` | `feel.dispose()` (reprend tout ce qui était figé ou ralenti), `bus.clear()`, retrait des écouteurs posés sur des émetteurs qui **survivent** à la scène (`this.input.keyboard`, `this.registry.events`, `this.game.events`), `scene.stop(UI)` et `scene.stop(Pause)`. Les objets de la scène (sprites, groupes, tweens, timers) sont détruits par Phaser. |

Règle générale : tout `on()` posé sur un émetteur **extérieur** à la scène a son `off()` dans le `SHUTDOWN` ; un `on()` posé sur un objet de la scène meurt avec lui. Critère d'acceptation : trois Shifts consécutifs (Hub → Run → Results → Hub) sans doublon de HUD ni d'écouteur (compteurs F3, § 10).

## 4. Génération procédurale basique
### 4.1 Modèle d'un Shift
Un **Shift** = OCC → Tasse de Relève → **Couloir technique** (sas) → trois biomes enchaînés :

**Biome 1 Quais & Voies** (8 couches à choix + Salle des pauses + L'Auditeur des Quais, 96×96) → **Biome 2 La Passerelle** (8 + repos + Le Réorganisateur RH, post-MVP) → **Biome 3 Hall & BAG** (9 + Palier + Gontran Vanderslide, post-MVP). Cible : 25 à 30 min par Shift complet.

- Le **rang** `r` d'une salle (1 à 28 sur un Shift complet : 25 salles à choix + 3 boss ; les repos ne comptent pas) pilote le scaling : PV × (1 + 0,08 (r − 1)), dégâts × (1 + 0,05 (r − 1)).
- L'**horloge du Shift** avance de **30 min par salle** franchie ; elle fixe le plancher de Burnout (§ 6.3). Le roulement (Matin, Après-midi, Nuit) fixe lumière, effets narratifs et multiplicateur de PS (×1 / ×1,15 / ×1,35).
- Types de salle : `combat`, `elite`, `cafe` (café / trésor), `shop` (Friterie de Raymonde, variante rare Wagon-Bar fantôme), `event`, `rest`, `boss` (+ `entry` pour le sas et les arrivées de biome). Chaque porte **annonce** le type et la récompense (portrait du collègue pour un Avantage, pictogramme de ressource, cornet de frites, tasse fumante…).
- MVP : seul le biome 1 est jouable de bout en bout ; le code génère déjà les trois (les biomes 2 et 3 réutilisent les gabarits du 1 tant que les leurs n'existent pas).

### 4.2 RNG seedé et flux dérivés
- Graine de Shift sur 32 bits, **affichée** au format lisible `XX-XXX-XX` (base 32 Crockford, sans I/L/O/U) dans `Pause` et `Results`, **saisissable** au menu.
- **Un flux par usage** : changer la table de loot ne change pas la carte, rejouer une salle redonne les mêmes vagues. Générateur : `createRng` (mulberry32) de `utils/rng.ts`, conservé du RPG.
- L'aléatoire cosmétique (particules, pitch) n'utilise **jamais** ces flux.

```ts
// src/utils/rng.ts — ajouts (pur)
/** FNV-1a 32 bits : sous-graine indépendante dérivée d'une graine et d'une étiquette. */
export function deriveSeed(seed: number, label: string): number {
  let h = (0x811c9dc5 ^ (seed >>> 0)) >>> 0;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
export const rngStream = (seed: number, label: string): Rng => createRng(deriveSeed(seed, label));
// + formatSeed(seed) → « 0V-QF9-JC » et parseSeed(texte) → number | null (base 32 Crockford, aller-retour testé)
```

Flux utilisés : `graph:<biome>` (largeurs, arêtes, types), `reward:<biome>` (récompenses annoncées), `template:<biome>` (gabarits, sac sans remise), `room:<biome>:<id>` (**graine de la salle** : slots, vagues, décor), `shop:<biome>:<id>` et `event:<biome>:<id>` (Friterie, événement), `retry:<n>` (régénération si une contrainte échoue).

### 4.3 Graphe d'un biome : couches, embranchements, contraintes
Contraintes (narrative + GDD), vérifiées **sur chaque chemin possible**, pas seulement sur le graphe :

| # | Contrainte | Mise en œuvre |
|---|---|---|
| C1 | Linéaire avec embranchements, sans retour : 2 ou 3 portes par salle | Graphe orienté en couches ; chaque nœud a `min(2, largeur suivante)` à 3 sorties |
| C2 | Couche 1 = combat facile qui donne une récompense de collègue (Avantage) | Couche 1 imposée : `combat` + `avantage`, budget de vague réduit |
| C3 | Boutique garantie en position 3 à 6, et au moins une avant la salle 6 | Une couche `S ∈ [3, 5]` de **largeur 1** (goulot) : tout chemin passe par la Friterie |
| C4 | Élite garantie en position 5 à 7, 2 au maximum par chemin, jamais 2 d'affilée | Une couche `E ∈ [5, 7]`, `E ≠ S`, entièrement `elite` (récompenses distinctes : PS ×2, Preuve, Grains) ; élites optionnelles ailleurs, validées par programmation dynamique |
| C5 | Au moins 1 Café/trésor (1 ou 2 par biome) | Validation : minimum de `cafe` sur les chemins ≥ 1 |
| C6 | Jamais 3 combats d'affilée qui ne rapportent que des ressources | Validation : longueur maximale de ces séries ≤ 2 |
| C7 | Repos fixe juste avant le boss | Couches finales `[rest]` puis `[boss]`, largeur 1 |
| C8 | 1 ou 2 Événements par biome | Tirage pondéré, plafonné à 2 sur chaque chemin |

Algorithme (pseudo-code) :
```
générerBiome(graine, biome, D):                       # D = 8 ou 9 couches à choix
  pour essai = 0..15:
    rng ← flux(graine', "graph:"+biome)  avec graine' = essai == 0 ? graine : deriveSeed(graine, "retry:"+essai)
    S ← entier dans [3, 5] ; E ← entier dans [5, 7] avec E ≠ S
    largeurs ← [1 (entrée)] + [l(k) pour k = 1..D] + [1 (repos), 1 (boss)]
        où l(S) = 1, sinon l(k) ∈ [2, 3]
    pour chaque paire de couches (A, B) : relier(A, B)  # intervalles contigus, chaque nœud de B a ≥ 1 parent
    assigner les types : couche 1 = combat/avantage, S = shop, E = elite, repos, boss,
        ailleurs tirage pondéré {combat 55, cafe 15, event 12, elite 8} sans élite après une élite
    tirer les récompenses (pas deux fois la même parmi des portes sœurs)
    si valider(graphe) : retourner graphe + gabarits + graines de salle
  retourner grapheDeSecours(D)                         # écrit à la main, valide par construction
```
Arêtes « en intervalles » : le nœud `i` de la couche A (taille `a`) vise le centre `c = round(i·(b−1)/(a−1))` de la couche B (taille `b`) et prend l'intervalle contigu de 2 ou 3 nœuds centré sur `c` (borné à `[0, b−1]`) ; les orphelins de B sont rattachés au parent le plus proche. Les intervalles étant monotones, la mini-carte reste lisible (pas de croisement à longue portée).

Validation par **programmation dynamique** sur les couches (aucune énumération de chemins : quelques dizaines de nœuds, coût linéaire) :
```ts
// src/systems/procedural/ShiftPlan.ts — validation des contraintes de chemin (pur, testé sur 500 graines)
interface PathStats { readonly minCafe: number; readonly maxElite: number; readonly maxEvent: number; readonly maxResourceRun: number }
export function validateBiome(g: BiomeGraph): readonly string[] {
  const errors: string[] = [];
  const stats = new Map<number, PathStats>();
  for (const node of g.nodesInLayerOrder) {
    const parents = g.parentsOf(node.id).map((p) => stats.get(p)).filter((s) => s !== undefined);
    const agg = (f: (s: PathStats) => number, pick: (...n: number[]) => number): number => (parents.length ? pick(...parents.map(f)) : 0);
    const base: PathStats = { minCafe: agg((s) => s.minCafe, Math.min), maxElite: agg((s) => s.maxElite, Math.max),
                              maxEvent: agg((s) => s.maxEvent, Math.max), maxResourceRun: agg((s) => s.maxResourceRun, Math.max) };
    const resourceCombat = node.kind === 'combat' && isResourceReward(node.reward);
    stats.set(node.id, {
      minCafe: base.minCafe + (node.kind === 'cafe' ? 1 : 0),
      maxElite: base.maxElite + (node.kind === 'elite' ? 1 : 0),
      maxEvent: base.maxEvent + (node.kind === 'event' ? 1 : 0),
      maxResourceRun: resourceCombat ? base.maxResourceRun + 1 : 0,
    });
    if (resourceCombat && base.maxResourceRun + 1 > 2) errors.push(`C6: 3 combats « ressources » d'affilée jusqu'à ${node.id}`);
    if (node.kind === 'elite' && g.parentsOf(node.id).some((p) => g.node(p).kind === 'elite')) errors.push(`C4: élites consécutives (${node.id})`);
    if (node.kind !== 'boss' && g.exitsOf(node.id).length === 0) errors.push(`impasse ${node.id}`);
  }
  const end = stats.get(g.bossId);
  if (!end) return [...errors, 'boss inatteignable'];
  if (end.minCafe < 1) errors.push('C5: un chemin sans Café/trésor');
  if (end.maxElite > 2) errors.push('C4: plus de 2 élites sur un chemin');
  if (end.maxEvent > 2) errors.push('C8: plus de 2 événements sur un chemin');
  return errors;
}
```
Le graphe du Shift est la concaténation des trois graphes de biome : le boss du biome k a pour sorties la couche 1 du biome k+1 (2 ou 3 portes dans l'arène vaincue). Le joueur voit la **carte du Shift** (Tab) : nœuds visités, couche courante, types annoncés ; les récompenses ne sont connues qu'à travers les portes, comme dans Hades.

### 4.4 `RoomTemplate` : ASCII d'abord, Tiled ensuite, même interface
```ts
// src/systems/procedural/RoomLayout.ts — interface commune (pur)
export const Tile = { Void: 0, Floor: 1, Wall: 2, Block: 3, Pit: 4, Track: 5 } as const;
export type TileId = (typeof Tile)[keyof typeof Tile];
export type DoorSide = 'N' | 'E' | 'S' | 'O';
export interface Cell { readonly x: number; readonly y: number }            // en tuiles
export interface RoomTemplate {
  readonly id: string; readonly biome: BiomeId; readonly kinds: readonly RoomKind[];
  readonly width: number; readonly height: number;
  readonly tiles: readonly (readonly TileId[])[];   // calques « sol », « murs », « dangers » fusionnés logiquement
  readonly doors: readonly (Cell & { readonly side: DoorSide })[];
  readonly slots: {
    readonly spawn: readonly Cell[];        // apparitions de base (diégétiques : train, escalator, trappe)
    readonly elite: readonly Cell[];
    readonly trap: readonly Cell[];         // emplacements de pièges (remplis ou non)
    readonly cover: readonly Cell[];        // couvertures destructibles possibles
    readonly decor: readonly Cell[];        // décor variable
    readonly reward: Cell | null;           // socle de récompense / PNJ de boutique
  };
}
```
**Phase MVP : gabarits ASCII** dans `src/systems/procedural/roomTemplates.ts` (un fichier par biome quand il grossira), testables sans Phaser (le savoir-faire des cartes ASCII du RPG est réutilisé) :
```ts
// Légende : '#' mur · '.' sol · ' ' hors salle · '~' vide (chute) · '=' voie (rames) · 'b' bloc/obstacle
//           'N' 'E' 'S' 'O' porte (sur le bord uniquement, sinon erreur de parse)
//           'e' slot spawn · 'X' slot élite · 't' slot piège · 'c' slot couverture · 'd' slot décor · 'r' socle de récompense
export const QUAIS_COMBAT_01: AsciiRoomDef = {
  id: 'quais-combat-01', biome: 'quais', kinds: ['combat', 'elite'],
  rows: [
    '#################N#################',
    '#e.......c.............c.........e#',
    '#..bb..........d..........d...bb..#',
    '#.................................#',
    '#=================================#',
    '#.....t.........X.........t.......#',
    'O.................r...............E',
    '#..bb.......c.........c.......bb..#',
    '#e...............................e#',
    '#################S#################',
  ],
};
```
`parseAsciiRoom(def)` vérifie : largeur constante (erreur explicite sinon), portes sur le bord, marqueurs posés sur du sol ; `unreachableCells(t)` (flood-fill depuis la 1re porte, à travers le sol et les voies, qui se traversent à pied ; les vides et les blocs arrêtent) doit renvoyer `[]` pour **chaque** gabarit (test, § 11).

**Phase 3 : Tiled JSON** (habillage final). Calques imposés par le level design : `sol`, `murs`, `dangers` (vides et voies : **pas** des murs, pour qu'on puisse y projeter des ennemis), `deco_haute` (rendu au-dessus du joueur), `objets` (portes N/E/S/O, slots, zones de piège, déclencheurs). Un convertisseur **pur** `fromTiledJson(json): RoomTemplate` (le format Tiled est un JSON ouvert, parsable sans Phaser) garde générateur et tests identiques. Rappels : un tileset par image (pas de « collection of images »), tilesets **intégrés** à l'export, noms de calques et de tilesets identiques entre Tiled et le code. Emplacement proposé : `public/assets/tilesets/rooms/<biome>/*.json`, chargés par le Preloader.

Tailles de gabarits (tuiles de 16 px, à 640×360) : **S** 40×22 (un écran), **M** 48×28, **L** 60×34, **couloir** 64×16, **arène de boss** jusqu'à 64×36. Au-delà d'un écran, la caméra suit (`startFollow(player, true, 0.12, 0.12)`, deadzone 32×24, `setBounds` sur la salle, décalage de 24 px vers la visée).

### 4.5 Remplissage des slots
À l'entrée d'une salle, `fillSlots(template, rng(room), ctx)` (pur) décide, avec la graine de la salle :

(1) **pièges** : `k` slots `trap` activés parmi `n` selon `r` et le Plan d'Économies (aucun en couche 1) ; (2) **couvertures** : 40 à 70 % des slots `cover` reçoivent une caisse ou une poubelle destructible ; (3) **décor variable** : un prop par slot `decor`, tiré dans la table du biome ; (4) **récompense** posée sur `reward` après nettoyage (combat, élite) ou dès l'entrée (café, boutique, repos) ; (5) **apparitions** limitées aux slots `spawn` situés à **6 tuiles ou plus** de la porte d'entrée.

Le résultat est une **liste d'ordres** (`{ kind: 'cover', cell, propId }`, …) que `Room.build()` applique ; aucun appel Phaser dans la décision.

### 4.6 Vagues
- **Budget de menace** = `base + pente × r` (× 1,6 en élite ; + 1 Borne par vague l'Après-midi, réglages de Nuit selon le GDD). Chaque archétype a un `cost` et un `minRank` (Consultant Junior 2, Borne Automatique 3, Drone Optimètre 3, Manager KPI 6).
- 2 ou 3 vagues par salle de combat ; tirage parmi les archétypes abordables jusqu'à épuiser le budget ; apparitions décalées de 150 ms dans une vague.
- Chaque apparition est **télégraphiée** (cercle au sol 600 ms, ennemi invulnérable puis inactif 400 ms).

`planWaves(rng, budget, rank, roster, spawns, entry)` (pur, `systems/procedural/Waves.ts`) renvoie un `WavePlan` (`SpawnOrder[][]` : archétype, case, délai) ; même graine de salle → mêmes vagues.

### 4.7 Portes verrouillées et progression de la salle
- À l'entrée : portes **fermées** (feu rouge sur le mini-écran des départs, portique abaissé), un collider statique bloque chaque porte.
- **Vague suivante** quand `enemies.countActive(true) === 0` et que les apparitions en attente sont épuisées.
- Après la dernière vague : salle nettoyée → `bus.emit('room-cleared')`, colliders de verrouillage détruits, portes ouvertes (feu vert, « ding-dong »), récompense annoncée posée sur le socle, Burnout −10, ralenti de fin de salle (§ 8).
- Franchir une porte ouverte (`overlap` avec sa zone + interaction) → `goTo(nextId, side)`.

```ts
// src/entities/Room.ts — progression des vagues (appelée par RunScene.update avec le delta de jeu)
public update(): void {
  if (this.cleared || this.pendingSpawns > 0 || this.deps.enemies.countActive(true) > 0) return;
  this.waveIndex += 1;
  const wave = this.plan[this.waveIndex];
  if (wave) {
    this.pendingSpawns = wave.length;
    this.deps.spawnWave(wave, () => { this.pendingSpawns -= 1; });   // télégraphe puis group.get() + enemy.spawn()
    return;
  }
  this.cleared = true;
  this.openDoors();
  this.deps.onCleared(this);
}
```
## 5. Machine d'états (State Machine)
### 5.1 Principes
- **Générique et typée** : `StateMachine<TCtx, M>` où `TCtx` est l'interface de contexte (ce que les états voient de l'entité) et `M` associe chaque état à sa **charge utile** (`attack: { combo }`, `hurt: { knockback }`, `undefined` sinon). `{ to: 'attack', payload: { combo: 1 } }` est vérifié par le compilateur. **Pure** (`src/systems/StateMachine.ts`) : `Player` et `Enemy` implémentent le contexte ; un faux objet suffit en test.
- **Un état ne se change pas lui-même** : `update()` **renvoie** une transition ou `null`. Les transitions externes (coup reçu → `hurt`, mort) passent par `request()`, filtrées par `canEnter` (dash sans charge, rien après `dead`). **Pas de ré-entrance** : une transition demandée pendant `enter`/`exit` est mise en file ; au plus 8 enchaînements par appel.
- **Une table d'états par entité** (fabrique `createPlayerStates()`) : les closures gardent l'état local (coup en cours) sans variable de module. Transitions **pré-construites** (`const IDLE = { to: 'idle', payload: undefined } as const`) : zéro allocation par frame.
- **Temps de jeu** : la machine reçoit le delta de jeu de l'entité (0 pendant **son** hitstop) ; buffer, cooldowns et i-frames lisent l'horloge du Shift.

### 5.2 Code complet
```ts
// src/systems/StateMachine.ts — AUCUN import Phaser : testable en Node (Vitest).
export type StateKey<M> = Extract<keyof M, string>;
/** Transition typée : la charge utile correspond à l'état visé. */
export type Transition<M> = { [K in StateKey<M>]: { readonly to: K; readonly payload: M[K] } }[StateKey<M>];
export interface StateDef<TCtx, M, K extends StateKey<M>> {
  /** Garde : refuse l'entrée (ex. Dash sans charge). Défaut : accepté. */
  canEnter?(ctx: TCtx, from: StateKey<M>): boolean;
  enter?(ctx: TCtx, payload: M[K], from: StateKey<M> | null): void;
  /** `elapsedMs` = temps passé dans l'état AVANT cette frame. */
  update?(ctx: TCtx, dtMs: number, elapsedMs: number): Transition<M> | null;
  exit?(ctx: TCtx, to: StateKey<M>): void;
}
export type StateTable<TCtx, M> = { readonly [K in StateKey<M>]: StateDef<TCtx, M, K> };
export type StateChangeListener<M> = (from: StateKey<M> | null, to: StateKey<M>) => void;
const MAX_CHAINED_TRANSITIONS = 8;
export class StateMachine<TCtx, M extends Record<string, unknown>> {
  private currentKey: StateKey<M> | null = null;
  private elapsedMs = 0;
  private transitioning = false;
  private readonly queue: Transition<M>[] = [];
  public constructor(
    private readonly ctx: TCtx, private readonly states: StateTable<TCtx, M>, private readonly onChange?: StateChangeListener<M>,
  ) {}
  public get current(): StateKey<M> | null { return this.currentKey; }
  public get timeInState(): number { return this.elapsedMs; }
  public is(key: StateKey<M>): boolean { return this.currentKey === key; }
  /** Démarre (ou redémarre, pour une entité sortie d'un pool) la machine. */
  public start(initial: Transition<M>): void {
    this.currentKey = null;
    this.queue.length = 0;
    this.request(initial);
  }
  /** Transition externe. Renvoie false si refusée par `canEnter`. */
  public request(t: Transition<M>): boolean {
    if (this.transitioning) { this.queue.push(t); return true; }   // demandée pendant enter/exit : mise en file
    const accepted = this.apply(t);
    this.drain();
    return accepted;
  }
  public update(dtMs: number): void {
    const key = this.currentKey;
    if (key === null) return;
    const next = this.states[key].update?.(this.ctx, dtMs, this.elapsedMs) ?? null;
    this.elapsedMs += dtMs;
    if (next) this.request(next);
  }
  private drain(): void {
    for (let guard = 0, next = this.queue.shift(); next && guard < MAX_CHAINED_TRANSITIONS; guard++, next = this.queue.shift()) {
      this.apply(next);
    }
    this.queue.length = 0;                       // au-delà de 8 enchaînements, le reste est abandonné
  }
  private apply<K extends StateKey<M>>(t: { readonly to: K; readonly payload: M[K] }): boolean {
    const from = this.currentKey;
    const target: StateDef<TCtx, M, K> = this.states[t.to];
    if (from !== null && target.canEnter && !target.canEnter(this.ctx, from)) return false;
    this.transitioning = true;
    try {
      if (from !== null) this.states[from].exit?.(this.ctx, t.to);
      this.currentKey = t.to;
      this.elapsedMs = 0;
      target.enter?.(this.ctx, t.payload, from);
    } finally {
      this.transitioning = false;
    }
    this.onChange?.(from, t.to);          // overlay de debug, télémétrie
    return true;
  }
}
```
`apply<K>` corrèle `t.to` et `t.payload` sans aucun cast (indexation d'un type mappé par un `K` générique).

### 5.3 États du joueur
| État | Charge utile | Entrée | Sorties | Anim |
|---|---|---|---|---|
| `idle` | — | vitesse → 0 (décélération 2 400 px/s²) | priorité **Dash > Spécial > Attaque > Café** (buffer) ; déplacement → `run` | `player-idle-{dir}` |
| `run` | — | | mêmes priorités ; plus d'entrée → `idle` | `player-run-{dir}` (relancée si la direction change) |
| `attack` | `{ combo: 0\|1\|2, fromDash }` | visée **verrouillée**, avance à 25 % pendant startup/active, `weapon.begin()` | dash-cancel (§ 5.4) → `dash` ; attaque bufferisée après `chainFrame` → `attack{combo+1}` ; `ANIMATION_COMPLETE` → `idle` | `player-attack{1,2,3}-{dir}` ; estoc de dash : anim dérivée de `attack2` (§ 7.2) |
| `dash` | — | consomme une charge, i-frames 0–120 ms, 514 px/s dans la direction du déplacement | fin (140 ms) → attaque bufferisée = **Attaque de correspondance** (`attack{fromDash}`), sinon `run`/`idle` | `player-dash-{dir}` |
| `special` | — | coût Mobilisation ; tap = **Coup de sifflet** (50), maintien 600 ms = **Préavis de grève** (100) | fin d'anim → `idle` ; dash possible pendant la recovery | `player-whistle` / `player-special` (1 dir) |
| `drink` | — | consomme un **Gobelet**, déplacement à 50 % | 600 ms → effets (soin 30 % de l'Énergie max modulé par le palier, +20 Burnout, Caféine) → `idle` ; **dash = interruption, Gobelet perdu** | `player-drink` (1 dir, post-MVP : placeholder) |
| `hurt` | `{ knockback: Vec2 }` | vide le buffer, recul 24 px | fin d'anim (240 ms) → `idle` | `player-hurt-{dir}` |
| `dead` | — | corps désactivé, `onDeath()` | **terminal** (`canEnter` de tous les autres états refuse `from === 'dead'`) | `player-death` (1 dir) |

Optionnel : `spawn` (« Prise de poste », anim `player-spawn`) à l'entrée du Shift, invulnérable, sans entrée joueur.

```
            ┌──────── déplacement ────────┐
            ▼                             │
  ┌────► idle ◄──────────────────────► run ◄────────────────────┐
  │        │ dash / spécial / attaque / café (buffer, priorités)  │
  │        ▼                                                      │
  │   attack{0} ──chainFrame──► attack{1} ──chainFrame──► attack{2}
  │        │  ▲ dash-cancel (startup ou recovery, jamais l'active)│
  │        ▼  │                                                   │
  │      dash ──attaque bufferisée──► attack{fromDash} ─► combo reprend au coup 2
  │        │                                                      │
  │    special / drink ──fin──────────────────────────────────────┘
  │
  └── hurt ◄── coup reçu (request, hors i-frames) ── depuis tout état sauf dead
       dead ◄── Énergie à 0 (request) ── terminal → Results
```
### 5.4 Le contexte et l'état `attack`
```ts
// src/systems/playerStates.ts (pur) — extraits
export type PlayerStates = {
  idle: undefined; run: undefined; dash: undefined; special: undefined; drink: undefined; dead: undefined;
  attack: { readonly combo: number; readonly fromDash: boolean };
  hurt: { readonly knockback: Vec2 };
};
/** Ce que les états voient du joueur. `Player` (Phaser) l'implémente ; un faux objet suffit en test. */
export interface PlayerCtx {
  readonly nowMs: number;                                   // horloge du Shift
  readonly move: Vec2;                                      // entrée normalisée (clavier, stick, tactile)
  readonly aimInput: Vec2;                                  // souris / stick droit / auto-cible
  readonly buffer: InputBuffer<PlayerAction>;
  readonly stats: PlayerStats;                              // balance.ts + Avantages + palier de Burnout
  readonly anim: { readonly frame: number; readonly done: boolean };   // retour de l'anim Phaser, 0-based
  readonly dash: DashCharges;                               // pur : 2 charges, 750 ms, délai 200 ms
  aim: Vec2;                                                // visée verrouillée du coup en cours
  facing: Facing; flip: boolean;                            // 'down' | 'up' | 'side' + miroir (gauche)
  invulnerableUntil: number; comboWindowUntil: number; nextCombo: number;   // fenêtre de combo : 150 ms après la recovery
  playAnim(action: string): void;                           // → `player-${action}-${dir}` + flipX
  setVelocity(x: number, y: number): void;
  weapon: { begin(a: AttackDef): void; tick(a: AttackDef): void; end(): void };
  onDeath(): void;
}
export function createPlayerStates(): StateTable<PlayerCtx, PlayerStates> {
  let swing: { readonly def: AttackDef; readonly combo: number } | null = null;
  const attack: StateDef<PlayerCtx, PlayerStates, 'attack'> = {
    canEnter: notDead,
    enter: (ctx, { combo, fromDash }) => {
      const def = fromDash ? ctx.stats.weapon.dashStrike : ctx.stats.weapon.combo[combo];
      if (!def) return;
      swing = { def, combo: fromDash ? 0 : combo };         // après l'estoc, le combo reprend au coup 2
      ctx.aim = normalizeOr(ctx.aimInput, facingVector(ctx.facing, ctx.flip));   // verrouillée au début du startup
      ({ facing: ctx.facing, flip: ctx.flip } = facingFromAngle(Math.atan2(ctx.aim.y, ctx.aim.x)));
      ctx.playAnim(def.anim);
      ctx.weapon.begin(def);                                // nouveau set « déjà touchés » pour CE coup
    },
    update: (ctx, _dt, elapsed) => {
      if (!swing) return IDLE;
      const { def, combo } = swing;
      const f = ctx.anim.frame;
      const [a0, a1] = def.activeFrames;
      const step = f <= a1 ? def.stepSpeed * 0.25 : 0;      // avance à 25 % en startup/active, 0 en recovery
      ctx.setVelocity(ctx.aim.x * step, ctx.aim.y * step);
      if (f >= a0 && f <= a1) ctx.weapon.tick(def);         // plage, jamais `f === n` (frames sautées en cas de lag)
      const canDash = f > a1 || (f < a0 && elapsed < def.dashCancelStartupMs);
      if (canDash && ctx.dash.ready(ctx.nowMs) && ctx.buffer.consume('dash', ctx.nowMs)) return DASH;
      const hasNext = combo + 1 < ctx.stats.weapon.combo.length;
      if (hasNext && f >= def.chainFrame && ctx.buffer.consume('attack', ctx.nowMs)) return attackT(combo + 1);
      if (ctx.anim.done || elapsed > MAX_ATTACK_MS) return IDLE;      // filet de sécurité si l'anim manque
      return null;
    },
    exit: (ctx) => {
      if (swing) { ctx.nextCombo = (swing.combo + 1) % 3; ctx.comboWindowUntil = ctx.nowMs + COMBO_GRACE_MS; }
      ctx.weapon.end();
      swing = null;
    },
  };
  // … idle, run, dash, special, drink, hurt, dead sur le même modèle …
  return { idle, run, attack, dash, special, drink, hurt, dead };
}
```
`AttackDef` (dans `balance.ts`) porte **à la fois** les timings du GDD et leur traduction en frames : `{ anim, damage, knockbackPx, knockbackMs, hitstopMs, shakePx, shape, activeFrames: [a0, a1], chainFrame, dashCancelStartupMs, stepSpeed }`. Les durées par frame du manifeste sont **calculées** pour que startup/active/recovery tombent pile (§ 7.2), et un test vérifie la cohérence (somme des durées des frames `< a0` = startup du GDD, etc.).

| Coup (GDD) | Startup / Active / Recovery | Frames (bande) | Durées par frame (ms) | `activeFrames` | `chainFrame` | Dash-cancel du startup |
|---|---|---|---|---|---|---|
| 1 Serrage (12 dég.) | 90 / 60 / 160 | 5 | 45, 45, **60**, 80, 80 | [2, 2] | 4 (80 ms dans la recovery) | oui (tout le startup) |
| 2 Desserrage (12) | 80 / 60 / 170 | 5 | 40, 40, **60**, 85, 85 | [2, 2] | 4 | oui |
| 3 Tire-fond (30) | 200 / 80 / 320 | 7 | 70, 70, 60, **80**, 100, 100, 120 | [3, 3] | 5 | 120 premières ms seulement |

### 5.5 Buffer d'inputs et priorités
Les appuis **attaque / dash / spécial / café** sont capturés par événement (`pointerdown`, `keydown`, boutons manette et tactiles), horodatés avec l'horloge du Shift et valables **150 ms** ; l'état qui peut les exploiter les **consomme**. Seul le dernier appui de chaque action est gardé. Un clic pendant la fin d'un coup enchaîne le suivant dès `chainFrame` ; un appui pendant un hitstop est servi juste après. `hurt` vide le buffer (pas d'attaque fantôme après un coup reçu).

```ts
// src/systems/InputBuffer.ts (pur, générique sur le type d'action)
export class InputBuffer<A extends string> {
  private readonly pressedAt = new Map<A, number>();
  public constructor(private readonly windowMs: number) {}                 // 150 ms (balance.ts)
  public press(action: A, now: number): void { this.pressedAt.set(action, now); }
  public peek(action: A, now: number): boolean {
    const at = this.pressedAt.get(action); return at !== undefined && now - at <= this.windowMs;
  }
  /** Comme `peek`, mais retire l'action (consommation unique). */
  public consume(action: A, now: number): boolean {
    const ok = this.peek(action, now);
    this.pressedAt.delete(action);
    return ok;
  }
  public clear(): void { this.pressedAt.clear(); }
}
// Joueur : type PlayerAction = 'attack' | 'dash' | 'special' | 'drink' ;
// idle/run consultent ['dash', 'special', 'attack', 'drink'] dans cet ordre (Dash > Spécial > Attaque > Café).
```
Lecture des entrées (`entities/PlayerInput.ts`, Phaser) : touches lues par **`KeyboardEvent.code`** (position physique : `KeyW/KeyA/KeyS/KeyD` = ZQSD en AZERTY belge, WASD en QWERTY), flèches toujours actives ; clic gauche attaque (maintien = combo auto), clic droit/F spécial, Espace dash, R café, E interagir ; manette (deadzone 0,20, visée au stick droit > 0,35, aide à la visée ±20° / 120 px) ; tactile (`ui/VirtualStick.ts`, auto-cible ≤ 140 px). Elle produit `move`, `aimInput` et des `press()` dans le buffer : les états ne connaissent aucun périphérique.

### 5.6 I-frames
Une seule source de vérité : `invulnerableUntil` (horloge du Shift), lue par `resolveHit` (§ 6.3).

Sources : **dash** (0–120 ms ; les 20 dernières ms sont vulnérables ; images rémanentes), **coup reçu** (600 ms, clignotement `alpha` toutes les 60 ms), **startup du Coup de sifflet** (150 ms), **transition de salle, `spawn`, cinématiques** (toute la durée).

Le **dash parfait** est détecté pendant les 80 premières ms : une hitbox ennemie qui chevauche le joueur **pendant ses i-frames** appelle `onPerfectDodge()` au lieu d'être ignorée (ralenti 0,6 pendant 200 ms, +0,5 charge, −6 Burnout, +5 Mobilisation, LED « +15 min »).

### 5.7 Ennemis
`EnemyStates = spawn | idle | chase | windup | attack | recover | stagger{knockback} | stun{ms} | dead`. Le trio **windup → attack → recover** est la grammaire de lisibilité : `windup` télégraphie (flash, ligne de visée, cercle au sol), `recover` est la fenêtre de punition. `stagger` ne survient que si la **poise** de l'archétype est épuisée (le Manager KPI n'est pas interrompu par les coups 1 et 2) ; `stun` vient du Coup de sifflet (« En grève », 1,2 s) et du Préavis (2,5 s). **Jetons d'attaque** (`systems/combat/AttackTokens.ts`) : au plus 2 ennemis de mêlée et 2 tireurs en `windup`/`attack` simultanément ; un ennemi sans jeton tourne autour du joueur à distance.

| Archétype (`entities/enemies/`) | Taille | Comportement | Spécificités d'états |
|---|---|---|---|
| `ConsultantJunior` | 32×32, 3 dir | mêlée rapide, fente « Coup de diaporama » (arc 90°, 28 px) | `windup` 450 ms (reflet blanc), attaque à la frame active 3 |
| `BorneAutomatique` | 32×32, 1 dir | tourelle, tickets en projectiles (140 px/s, 2,5 s) | pas de `chase` : `idle` → `wake` → `windup` (ligne de visée 600 ms) → tir à la frame 4 ; `wreck` (épave persistante) à la mort |
| `DroneOptimetre` | 32×32, 1 dir | distance mobile, marquage, plongeon | `attack` en deux phases (visée puis plongeon, frames actives 4–7 bouclées pendant le déplacement), ombre détachée |
| `ManagerKpi` (élite) | 48×48 | tank, posture « Costume trois-pièces » | casse après 40 dégâts en 3 s → `stun` 1,5 s, +25 % de dégâts reçus |

Chaque sous-classe (`ConsultantJunior`, `BorneAutomatique`, `DroneOptimetre`, puis `ManagerKpi`) fournit `buildStates()` : elle étend les états communs de la base (`spawn`, `idle`, `stagger`, `stun`, `dead`) avec ses `chase`/`windup`/`attack`/`recover`, et `performAttack()` (forme de coup ou projectile). Dans `attack`, un booléen `struck` garantit **un seul déclenchement** par cycle, même si la frame active dure plusieurs ticks ; `chase` ne passe en `windup` que si `tokens.acquire()` réussit, `recover` rend le jeton.

`buildStates()` est appelée par le constructeur de la base, **avant** l'initialisation des champs de la sous-classe : les closures lisent les champs à l'exécution, jamais à la construction. Le jeton est aussi rendu dans `exit` de `stagger`/`stun`/`dead`. Pas de pathfinding au MVP (salles ouvertes, poursuite directe + séparation douce de 200 px/s²) ; si nécessaire plus tard, un BFS pur sur la grille du gabarit.

### 5.8 Liaison stricte avec les animations Phaser
- **Une clé par état et par direction** : `player-<anim>-<dir>` avec `dir ∈ {down, up, side}` ; **gauche = `side` + `setFlipX(true)`**. Les anims mono-direction (`death`, `spawn`, `special`, `drink`) n'ont pas de suffixe : `player-death`.
- `playAnim()` est le **seul** endroit qui appelle `sprite.play()`, et il n'est appelé que depuis `enter()` (ou depuis `run` quand la direction change).
- **Retour d'anim vers l'état** : `ANIMATION_UPDATE` → `anim.frame = frame.index - 1` (**`AnimationFrame.index` est 1-based**), `ANIMATION_COMPLETE` → `anim.done = true`. Écouteurs posés une fois dans le constructeur, retirés dans `destroy()`.
- Les boucles (`repeat: -1`) n'émettent jamais `ANIMATION_COMPLETE` : seuls les états non bouclés en dépendent, avec un filet de sécurité temporel (`MAX_ATTACK_MS`).
- `skipMissedFrames: true` (défaut) : en cas de lag, plusieurs frames passent dans le même tick (`ANIMATION_UPDATE` est émis pour chacune) ; nos états testent toujours des **plages**.
- La vitesse d'attaque (Caféine +15 %, Pétage de plombs +25 %) passe par `sprite.anims.timeScale` : les fenêtres étant lues sur les frames, elles suivent automatiquement.

```ts
// src/entities/Player.ts — extraits
export class Player extends Phaser.Physics.Arcade.Sprite implements PlayerCtx, Hurtable {
  declare public body: Phaser.Physics.Arcade.Body;
  public readonly anim = { frame: 0, done: false };
  private readonly fsm: StateMachine<PlayerCtx, PlayerStates>;
  public constructor(scene: Phaser.Scene, x: number, y: number, private readonly deps: PlayerDeps) {
    super(scene, x, y, 'player_idle_down_strip6', 0);
    scene.add.existing(this); scene.physics.add.existing(this);
    this.setOrigin(0.5, 44 / 48);                           // pivot aux pieds (ligne y = 44 de la frame 48×48)
    this.body.setCircle(6, 18, 34);                          // collision au sol : cercle de 6 px centré sur les pieds
    this.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.onAnimUpdate, this);
    this.on(Phaser.Animations.Events.ANIMATION_COMPLETE, this.onAnimComplete, this);
    this.fsm = new StateMachine<PlayerCtx, PlayerStates>(this, createPlayerStates());
    this.fsm.start({ to: 'idle', payload: undefined });
  }
  public tick(dtMs: number): void {                          // delta de jeu fourni par RunScene/GameFeel
    this.fsm.update(dtMs);
    this.setDepth(Depth.ActorsBase + this.y);               // tri en y par les pieds
  }
  public playAnim(action: string): void {
    this.anim.frame = 0; this.anim.done = false;
    this.setFlipX(this.flip);
    this.play(animKey('player', action, MONO_DIR_ANIMS.has(action) ? undefined : this.facing));
  }
  private onAnimUpdate(_a: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame): void {
    this.anim.frame = frame.index - 1;                       // 1-based côté Phaser → 0-based chez nous
  }
  private onAnimComplete(): void { this.anim.done = true; }
  public override destroy(fromScene?: boolean): void {
    this.off(Phaser.Animations.Events.ANIMATION_UPDATE, this.onAnimUpdate, this);
    this.off(Phaser.Animations.Events.ANIMATION_COMPLETE, this.onAnimComplete, this);
    super.destroy(fromScene);
  }
}
```
## 6. Combat et physique Arcade
### 6.1 Corps, groupes et collisions
| Paire | Type | Raison |
|---|---|---|
| Acteurs ↔ calque `murs` | `collider` | Murs (collision sur 1 tuile, façade dessinée sur 2). |
| Joueur ↔ vides du calque `dangers` | `collider` avec `processCallback` | Bloque la marche (les **voies**, elles, se traversent à pied) ; **désactivé pendant le dash** (franchit les trous ≤ 64 px) et le knockback. Pieds au-dessus d'un vide à la fin du dash ou d'un recul → chute : −10 % d'Énergie, réapparition au dernier sol sûr. |
| Ennemis ↔ `dangers` | `collider` avec `processCallback` | Bloque les déplacements ennemis (vides et voies) ; **désactivé en `stagger`** : un ennemi non élite projeté dans un vide est éliminé ; sur une voie, il reste exposé aux rames. |
| Joueur ↔ ennemis | **`overlap`**, jamais `collide` | Dégâts de contact sans se faire coincer ; le dash traverse. |
| Ennemis ↔ ennemis | aucun collider | Séparation douce (200 px/s²) calculée par le comportement ennemi : fluide au-delà de 30 ennemis. |
| Tirs ennemis ↔ joueur | `overlap` | `resolveHit`, puis `kill()` du tir. |
| Tirs ↔ `murs` | `collider` → `kill()` | |
| Joueur ↔ zones de porte, ramassables | `overlap` | Sortie (salle nettoyée), Tickets, Gobelets. |
| Rames qui passent (biome 1) | `overlap` sur une zone mobile | Élimine tout ennemi non élite, 40 % de l'Énergie max au joueur, après un triple télégraphe. |

Les **corps** sont des cercles aux pieds, de taille **fixe** (jamais synchronisée sur la frame) : joueur 6 px, ennemi 32×32 `setCircle(5, 11, 18)`. Les **hurtbox** sont des cercles logiques au torse (joueur r = 9, Consultant 8, Borne 8, Manager KPI 13) testés par nos requêtes géométriques. Corps créés une fois par pool, réactivés par `enableBody(true, x, y, true, true)`.

### 6.2 Hitboxes d'attaque : requête spatiale + test géométrique pur
Arcade n'a que des AABB et des cercles ; le GDD demande des **arcs** (coups 1 et 2), un **rectangle orienté + cercle** (coup 3), des cercles (sifflet, préavis) et des rectangles orientés (estoc de dash, charge du Manager). Pas de corps d'attaque : à chaque frame **active**, `Weapon.tick()` fait :

1. **Phase large** : `physics.overlapCirc(cx, cy, portée + rayonMaxCible, true, false)` (RTree, synchrone, aucune frame de latence) ;
2. **Phase fine** : test pur de la forme contre le cercle de hurtbox de chaque candidat (`systems/combat/geometry.ts`) ;
3. **Anti double hit** : `Set<entityId>` « déjà touchés » vidé à chaque `begin()` (un coup = un swing). Un projectile traversant garde son propre set.

Origine de la hitbox : centre du corps du héros, **10 px au-dessus des pieds**. Une `Zone` physique temporaire est écartée (à créer/positionner/détruire à chaque frame, une frame de latence, cycle de vie à gérer).

```ts
// src/systems/combat/geometry.ts (pur)
export type HitShape =
  | { readonly kind: 'arc'; readonly radius: number; readonly spreadDeg: number }
  | { readonly kind: 'rect'; readonly from: number; readonly to: number; readonly width: number }   // le long de la visée
  | { readonly kind: 'circle'; readonly offset: number; readonly radius: number };
/** La cible (cercle de hurtbox) est-elle dans la forme ? `aim` est normalisé. */
export function hits(shape: HitShape, origin: Vec2, aim: Vec2, target: Vec2, r: number): boolean {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const fwd = dx * aim.x + dy * aim.y;                      // coordonnées dans le repère du coup
  const side = -dx * aim.y + dy * aim.x;
  switch (shape.kind) {
    case 'arc': {
      const dist = Math.hypot(dx, dy);
      if (dist > shape.radius + r) return false;
      const half = (shape.spreadDeg * Math.PI) / 360 + Math.atan2(r, Math.max(dist, 1e-6));
      return Math.abs(Math.atan2(side, fwd)) <= half;
    }
    case 'rect':
      return fwd >= shape.from - r && fwd <= shape.to + r && Math.abs(side) <= shape.width / 2 + r;
    case 'circle':
      return Math.hypot(fwd - shape.offset, side) <= shape.radius + r;
  }
}
```
```ts
// src/entities/Weapon.ts — la clé à tire-fond (extrait)
public tick(attack: AttackDef): void {
  const o = this.owner.hitOrigin();                        // pieds − 10 px
  for (const shape of attack.shapes) {
    for (const body of this.physics.overlapCirc(o.x, o.y, reachOf(shape) + MAX_HURT_RADIUS, true, false)) {
      const target: unknown = body.gameObject;
      if (!isHurtable(target) || target.team === 'player' || this.hitThisSwing.has(target.entityId)) continue;
      if (!hits(shape, o, this.owner.aim, target.hurtCenter(), target.hurtRadius)) continue;
      this.hitThisSwing.add(target.entityId);
      this.onHit(target, attack, this.hitThisSwing.size);   // la taille sert au hitstop multi-cibles
    }
  }
}
```
### 6.3 Résolution d'un coup (pur)
```ts
// src/systems/combat/damage.ts (pur)
export function resolveHit(target: Health, hit: HitEvent, mods: DamageModifiers, rng: Rng, nowMs: number): HitOutcome {
  if (nowMs < target.invulnerableUntil || target.hp <= 0) return { kind: 'ignored' };
  const crit = rng() < mods.critChance;                     // « Prime de nuit » : 5 % de base, ×1,75
  const raw = hit.baseDamage * mods.outgoingMult * (crit ? mods.critMult : 1) * mods.incomingMult;
  const damage = Math.max(1, Math.round(raw - target.armor));
  const hp = Math.max(0, target.hp - damage);
  const dir = normalizeOr({ x: hit.to.x - hit.from.x, y: hit.to.y - hit.from.y }, { x: 0, y: 1 });
  const v0 = (2 * hit.knockbackPx) / (hit.knockbackMs / 1000) * target.knockbackTaken;   // v0 = 2d/t
  return {
    kind: hp === 0 ? 'killed' : 'hit', damage, crit,
    health: { ...target, hp, invulnerableUntil: nowMs + mods.iframesMs },
    knockback: { vx: dir.x * v0, vy: dir.y * v0, decel: v0 / (hit.knockbackMs / 1000) },   // décélération linéaire
  };
}
```
- **Burnout** (`combat/Burnout.ts`) : `tierOf(burnout)` renvoie le palier (Frais, Sous pression, Au bord, Au bout du rouleau) et ses multiplicateurs (dégâts infligés/subis, vitesse, critique, soin du Gobelet) ; `burnoutFloor(hoursElapsed, roster)` (5 × heures, 7,5 la Nuit ; plafond à arbitrer par le GD car un Shift complet compte jusqu'à 28 salles) ; `applyBurnoutEvent(state, event)` (coup reçu +0,6 × dégâts, dash +2, Gobelet +20, kill −1, salle −10, récupération −3/s après 3 s calmes) ; à 100, **Pétage de plombs** 8 s puis « Arrêt maladie » (Burnout = max(plancher, 30), −8 Énergie max pour le Shift, jamais sous 50).
- **Mobilisation** (`combat/Mobilisation.ts`) : +1 par tranche de 4 dégâts, +6 par kill, +10 par coup encaissé, +5 par dash parfait ; conservée entre les salles ; coût 50 (sifflet) / 100 (préavis).
- Tout est au format `(state, event) → { state, events }` : les `events` (`'meltdown-start'`, `'tier-changed'`…) déclenchent sons, teinte rouge et HUD.

Orchestration côté `RunScene.onPlayerHit()` : `resolveHit` → appliquer santé et `stagger`/`stun` → **hitstop** local (§ 8) → **shake** → **flash** de la cible → étincelles → nombre de dégâts → son. **Plaqué contre le quai** : si une cible repoussée touche un mur à plus de 150 px/s (`body.blocked` pendant `stagger`), +5 dégâts et stun 300 ms.

### 6.4 Projectiles poolés
```ts
// src/entities/Projectile.ts — Arcade.Image poolé ; RunScene crée le groupe une fois par Shift
public fire(x: number, y: number, dir: Vec2, speed: number, damage: number, lifeMs: number): void {
  this.enableBody(true, x, y, true, true);                   // réactive corps + visibilité
  this.body.setVelocity(dir.x * speed, dir.y * speed);
  this.setRotation(Math.atan2(dir.y, dir.x));
  this.damage = damage;
  this.lifeMs = lifeMs;                                      // décrémenté par tick(dt de jeu), puis kill()
}
public kill(): void { this.disableBody(true, true); }        // retour au pool, jamais destroy()
// RunScene.create() : this.enemyShots = this.physics.add.group({ classType: Projectile, maxSize: 96 });
//                     this.physics.add.overlap(this.enemyShots, this.player, this.onShotHitsPlayer, undefined, this);
// Room.build()      : collider(enemyShots, calque murs, (shot) => { if (shot instanceof Projectile) shot.kill(); })
```
`group.get(x, y)` renvoie `null` quand le pool est plein : le tir est simplement ignoré (jamais de `new` en combat). Le Coup de sifflet, le coup 3 et certains Avantages **détruisent** les tickets dans leur zone (requête `overlapCirc` sur les tirs actifs).

### 6.5 Debug
`VITE_ARCADE_DEBUG=1` affiche les corps ; **F2** (dev) dessine les formes actives et les hurtbox (`Graphics` partagé, effacé chaque frame) ; **F4** passe les anims à 0,25× (`anims.globalTimeScale`) pour caler `activeFrames` avec l'animateur.

## 7. Animations
### 7.1 Conventions (contrat avec l'art)
- **Fichier** : `public/assets/sprites/<catégorie>/<entité>_<anim>[_<dir>]_strip<N>.png` ; à l'intérieur d'un champ, `-` (ex. `manager_attack_side_strip8.png`, `vfx_slash-e_strip5.png`). Regex : `^([a-z0-9-]+)_([a-z0-9-]+)(?:_(down|up|side))?_strip(\d+)\.png$`.
- **Géométrie** : bande horizontale, frames **carrées** sans marge ni espacement (largeur = N × hauteur), PNG 32 bits, alpha binaire, pas de trim. Héros **48×48**, ennemis et PNJ **32×32**, élites **48×48**, boss **96×96** (B1, B2) et **128×128** (boss final), tuiles **16×16**.
- **Clés** : clé de texture = nom du fichier sans `.png` (`player_run_down_strip8`) ; clé d'animation = `<entité>-<anim>[-<dir>]` en kebab-case (`player-run-down`, `consultant-attack-side`, `player-death`). Une seule fonction construit les clés d'animation : `animKey(entity, name, dir?)`.
- **Directions** : 4 directions logiques, 3 dessinées (`down`, `up`, `side` dessiné vers la droite) ; gauche = `side` + `flipX`. Les anims cinématiques (`death`, `spawn`, `special`) et les ennemis symétriques (Borne, Drone, boss mécaniques) sont mono-direction.

```ts
// src/utils/math.ts — direction quantifiée : 3 directions dessinées + miroir, seuil diagonal favorisant l'horizontale
export type Facing = 'down' | 'up' | 'side';
export function facingFromAngle(rad: number): { readonly facing: Facing; readonly flip: boolean } {
  const x = Math.cos(rad);
  const y = Math.sin(rad);
  if (Math.abs(x) >= Math.abs(y) * 0.9) return { facing: 'side', flip: x < 0 };   // flip = regarde à gauche
  return { facing: y > 0 ? 'down' : 'up', flip: false };
}
```
### 7.2 Manifeste `config/assets.ts`
```ts
// src/config/assets.ts (pur) — source unique : chargement, création des anims, placeholders, tests de cohérence
export type Direction = 'down' | 'up' | 'side';
export const DIRECTIONS: readonly Direction[] = ['down', 'up', 'side'];
export interface SheetDef {                      // une bande PNG = une texture
  readonly key: string; readonly path: string;   // 'player_run_down_strip8', 'assets/sprites/player/player_run_down_strip8.png'
  readonly frameWidth: number; readonly frameHeight: number; readonly frames: number;
  readonly tint: number; readonly category: SpriteCategory;    // couleur du placeholder, sous-dossier de sprites/
}
export interface AnimDef {                       // une animation = une bande + des durées ABSOLUES par frame (ms)
  readonly key: string; readonly sheet: string; readonly durations: readonly number[]; readonly repeat: number;
}
/** Déclare une animation et sa (ses) bande(s) ; `dirs` vide = mono-direction (pas de suffixe). */
function anim(category: SpriteCategory, entity: string, name: string, size: number, durations: readonly number[],
              repeat: number, tint: number, dirs: readonly Direction[] = []): void {
  for (const dir of dirs.length === 0 ? [null] : dirs) {
    const key = `${entity}_${name}${dir ? `_${dir}` : ''}_strip${String(durations.length)}`;
    SHEETS.push({ key, path: `assets/sprites/${category}/${key}.png`, frameWidth: size, frameHeight: size,
                  frames: durations.length, tint, category });
    ANIMS.push({ key: animKey(entity, name, dir ?? undefined), sheet: key, durations, repeat });
  }
}
anim('player', 'player', 'idle', 48, rep(6, 150), -1, HERO, DIRECTIONS);
anim('player', 'player', 'run', 48, rep(8, 80), -1, HERO, DIRECTIONS);
anim('player', 'player', 'attack1', 48, ATTACK_FRAMES.frappe1, 0, HERO, DIRECTIONS);   // durées issues des timings du GDD (§ 5.4)
anim('player', 'player', 'dash', 48, [20, 30, 30, 30, 30], 0, HERO, DIRECTIONS);      // 140 ms = durée du dash
anim('player', 'player', 'death', 48, [...rep(11, 100), 400], 0, HERO);                // mono-direction : 'player-death'
anim('enemies', 'consultant', 'attack', 32, [90, 90, 90, 60, 80, 120], 0, ENEMY, DIRECTIONS);
anim('bosses', 'auditeur', 'attack-stamp', 96, [...rep(8, 100), 40, 60, ...rep(4, 100)], 0, BOSS);
// Anims DÉRIVÉES (aucun PNG en plus) : même `sheet`, autre découpe ou autres durées, ex.
// 'player-whistle' (Coup de sifflet) sur la bande 'player_special_strip12', frames 2 à 7 ;
// 'player-dashstrike-<dir>' (estoc) sur 'player_attack2_<dir>_strip5' avec les durées de l'estoc (60 / 80 / 200 ms).
export function animKey(entity: string, name: string, dir?: Direction): string {
  return dir ? `${entity}-${name}-${dir}` : `${entity}-${name}`;
}
```
Le manifeste liste aussi les images statiques (`ui_*.png`, `shadow_*.png`), les tilesets (`public/assets/tilesets/`), les sons (`public/assets/audio/sfx|music/`, formats `ogg` + `m4a` pour Safari) et les polices bitmap (`public/assets/fonts/`). L'ancien `asset-pack.json` du RPG n'est plus la source de vérité.

### 7.3 Chargement et création des animations
```ts
// src/scenes/PreloaderScene.ts — seul preload() du jeu (règle ESLint)
public preload(): void {
  for (const s of SPRITE_SHEETS) {
    this.load.spritesheet(s.key, s.path, { frameWidth: s.frameWidth, frameHeight: s.frameHeight, endFrame: s.frames - 1 });
  }
  for (const img of IMAGES) this.load.image(img.key, img.path);
  for (const t of TILESETS) this.load.image(t.key, t.path);
}
public create(): void {
  for (const s of SPRITE_SHEETS) if (!this.textures.exists(s.key)) createPlaceholderSheet(this, s);   // ui/placeholders.ts
  for (const a of ANIMATIONS) {                     // animations GLOBALES au jeu : créées une seule fois, idempotent
    if (this.anims.exists(a.key)) continue;
    this.anims.create({
      key: a.key, repeat: a.repeat,
      frames: a.durations.map((duration, frame) => ({ key: a.sheet, frame, duration })),   // durée ABSOLUE (Phaser 4.2.1)
    });
  }
  // … lecture de la sauvegarde → registry, puis this.scene.start(SceneKeys.MainMenu)
}
```
Un PNG absent (404) est remplacé par une **bande de secours** de mêmes dimensions (`createPlaceholderSheet`, `Graphics#generateTexture`) : le jeu tourne avec ou sans les vrais sprites, et la console de dev liste les manquants. Contrôle de dev : `textures.get(key).frameTotal − 1` (qui inclut `__BASE`) doit valoir `frames`, sinon la bande est tronquée ou mal nommée ; en production la liste des manquants doit être vide (test de cohérence en CI, § 11). Si cette logique grossit (atlas, anims dérivées), elle sort dans `fx/AnimationFactory.ts` ; empaqueter plus tard les bandes d'un personnage en **atlas** ne change que cette étape (`generateFrameNames`), pas les états.

### 7.4 Miroir, pivot, ombre et profondeur
- **Miroir** : `setFlipX(flip)` dans `playAnim()` uniquement. Contraintes de dessin : pas de texte sur le profil, la clé change de main en miroir (accepté).
- **Pivot aux pieds** : `setOrigin(0.5, (H − 4) / H)` pour les frames 48 (y = 44) et `(0.5, 28 / 32)` pour les 32, `(0.5, (H − 8) / H)` pour les boss ; `x` et `y` de l'entité **sont** la position des pieds. Cellules paires : pas de demi-pixel.
- **Ombre** : `shadow_s/m/l/xl.png` (ellipse pleine), image séparée suivant l'entité, opacité 0,5 appliquée par le moteur, `Depth.Shadows`. Le Drone garde son ombre au sol (8 px sous lui).
- **Tri en y (y-sort)** : acteurs et props hauts à `Depth.ActorsBase + y` (pieds) chaque frame ; calques `sol` (0), `dangers` (5), ombres (10) dessous ; `deco_haute` à `Depth.DecoHaute` au-dessus de tout acteur ; VFX et nombres de dégâts encore au-dessus.

## 8. Game feel
### 8.1 Effets et implémentation Phaser 4
| Effet | Implémentation | Valeurs (GDD) |
|---|---|---|
| **Hitstop local** | Le GDD l'impose : il gèle **le héros et les cibles touchées seulement**, le reste du monde continue. Par entité : `anims.pause()`, `body.moves = false` (vitesse conservée), delta de jeu = 0 pour sa machine d'états ; reprise par un minuteur en **temps réel** | 50 ms (coups 1-2), 110 (coup 3), +30 (critique), 80 (héros touché), +10 ms par cible au-delà de la 1re (max +30) ; prolongé, jamais cumulé |
| **Screenshake** | `cameras.main.shake(ms, px / 640, true)` ; les secousses se combinent **au maximum**, pas en somme | coup 1-2 : 1 px / 60 ms ; coup 3 : 3 px / 120 ms ; héros touché : 4 px / 180 ms ; sifflet 5 px ; préavis 7 px |
| **Flash** | `setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)` puis `clearTint()` (remet `MULTIPLY`) | 60–80 ms |
| **Ralenti** | dernier kill de la salle : ×0,25 pendant 450 ms (temps réel) puis retour en 250 ms ; dash parfait : ×0,6 pendant 200 ms. Appliqué à la fois à `physics.world.timeScale = 1 / s` (**inversé**), `anims.globalTimeScale = s`, `tweens.timeScale = s` et au delta de jeu | |
| **Zoom punch** | tween de `cameras.main.zoom` 1 → 1,02 → 1 (100 ms) ; seule exception au zoom 1 (l'arrondi est suspendu le temps du tween) | coup 3 : ×1,02 ; fin de salle : ×1,06 |
| **Particules** | un émetteur par type, créé une fois (`emitting: false`), `emitter.explode(n, x, y)` | étincelles 4 / 8, papiers 12 au kill, poussière de dash |
| **Nombres de dégâts** | anneau de `BitmapText` poolés (§ 8.3) | 8 px, +16 px en 500 ms, fusion des coups sur 150 ms |
| **Filtres caméra** | `cameras.main.filters.external.addVignette(...)` (héros touché, Énergie basse), `addColorMatrix()` (désaturation à la mort) | jamais de filtre par sprite |
| **Pétage de plombs** | teinte rouge 15 % (vignette rouge), musique +10 % (`sound.rate`) | 8 s |

### 8.2 `GameFeel`
```ts
// src/fx/GameFeel.ts — extraits ; toutes les minuteries internes sont en temps RÉEL (delta brut)
export class GameFeel {
  private readonly frozen = new Map<Freezable, number>();   // entité → fin de son hitstop
  private realNow = 0; private shakeUntil = 0; private shakePx = 0; private slowScale = 1;
  public constructor(private readonly scene: Phaser.Scene, private readonly settings: FeelSettings) {}
  /** En tête de RunScene.update : libère les hitstops échus et renvoie le delta de JEU global. */
  public update(rawDelta: number): number {
    this.realNow += rawDelta;
    for (const [e, until] of this.frozen) if (this.realNow >= until) { e.unfreeze(); this.frozen.delete(e); }
    this.updateSlowMotion();                                 // courbe hold puis retour, en temps réel
    return Math.min(rawDelta, 50) * this.slowScale;          // borne : retour d'onglet, gros lag
  }
  /** Delta propre à une entité : 0 pendant SON hitstop. */
  public deltaFor(e: Freezable, gameDelta: number): number { return this.frozen.has(e) ? 0 : gameDelta; }
  public hitstop(ms: number, ...targets: Freezable[]): void {
    if (!this.settings.hitstop) return;
    for (const t of targets) {
      if (!this.frozen.has(t)) t.freeze();                   // anims.pause() + body.moves = false
      this.frozen.set(t, Math.max(this.frozen.get(t) ?? 0, this.realNow + ms));   // prolonge, ne cumule pas
    }
  }
  public shake(px: number, ms: number): void {
    const p = px * this.settings.shakeScale;                 // réglage 0 – 100 %
    if (p <= 0 || (this.realNow < this.shakeUntil && p <= this.shakePx)) return;   // combinaison au MAXIMUM
    this.shakePx = p;
    this.shakeUntil = this.realNow + ms;
    this.scene.cameras.main.shake(ms, p / GAME_WIDTH, true);
  }
  public flash(target: Phaser.GameObjects.Sprite, ms = 70): void {
    if (!this.settings.flashes) return;
    target.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(ms, () => { if (target.active) target.clearTint(); });   // clearTint remet MULTIPLY
  }
  private applyTimeScale(s: number): void {
    this.slowScale = s;
    this.scene.physics.world.timeScale = 1 / s;              // sémantique INVERSÉE côté Arcade
    this.scene.anims.globalTimeScale = s;
    this.scene.tweens.timeScale = s;
  }
  /** Au SHUTDOWN : ne jamais laisser une entité figée ni le monde ralenti. */
  public dispose(): void {
    for (const e of this.frozen.keys()) e.unfreeze();
    this.frozen.clear();
    this.applyTimeScale(1);
  }
}
```
Le hitstop « global » (`physics.world.pause()` + `tweens.pauseAll()`) est réservé au coup fatal d'un boss et à la mort du héros, où figer toute la scène est voulu.

### 8.3 Particules et nombres de dégâts
```ts
// Émetteurs Phaser 4, créés une fois par Shift (GameFeel.create)
this.sparks = scene.add.particles(0, 0, 'vfx-pixel', {
  emitting: false,
  lifespan: { min: 120, max: 260 }, speed: { min: 60, max: 160 }, angle: { min: 0, max: 360 },
  scale: { start: 2, end: 1 },                              // échelles entières : pas de scintillement
  tint: [0xffffff, 0xffd23f, 0xff7a1a], maxParticles: 96,
}).setDepth(Depth.Vfx);
// …
public hitSparks(x: number, y: number, strong: boolean): void { this.sparks.explode(strong ? 8 : 4, x, y); }
```
Nombres de dégâts : anneau de 64 `BitmapText` (police pixel 8 px à contour, `public/assets/fonts/`) ; le plus ancien est recyclé ; `tweens.killTweensOf(t)` avant réutilisation ; positions arrondies ; décalage horizontal ±6 px (aléatoire cosmétique) ; couleurs : blanc normal, jaune critique (« ! »), rouge dégâts subis, vert soin, gris « RÉSISTÉ ». Les coups sur une même cible dans une fenêtre de **150 ms** fusionnent : on réutilise le texte en cours et on additionne. `BitmapText` plutôt que `Text` : un `Text` possède son propre canvas, coûteux à mettre à jour en rafale.

### 8.4 Lumière et post-traitement : `Atmosphere` (DA pixel art moderne)
La direction artistique est du **pixel art moderne** à la Dead Cells / Celeste (GDD § 1.3). Côté moteur, tout passe par `src/fx/Atmosphere.ts`, une instance par scène de jeu (`RunScene`, `HubScene`) :

| Brique | API Phaser 4 | Rôle |
|---|---|---|
| Éclairage dynamique | `scene.lights.enable()`, `setAmbientColor`, `lights.addLight(x, y, r, color, i, z)`, `obj.setLighting(true)` | Lampes de salle (`lightRoom`), néons le long des voies, lampe frontale du héros (`attachHero`), éclairs d'impact (`flash`). `render.maxLights = 32`. |
| Normal maps | `_n.png` déclarées dans le manifeste (`normalMap`), chargées avec la feuille | Volume des sprites et du décor sous les lampes. Sans normal map, l'éclairage reste plat mais fonctionne. |
| Halos visibles | `scene.add.pointlight(...)` (additif) | La lumière se voit dans l'air (`addGlow`). |
| Bloom | `cam.filters.internal.addParallelFilters()` : `top.addThreshold` + `top.addBlur`, blend ADD | Les émissifs (VFX, télégraphes, écrans) débordent de lumière. |
| Étalonnage | `cam.filters.internal.addColorMatrix()` (`saturate`, `contrast`) | Ambiance par zone (`LOOKS` : `quais`, `boss`, `occ`). |
| Vignette | `cam.filters.external.addVignette(...)` | Cadre et concentration sur l'action. |
| Poussières | émetteur de particules additif sur toute la salle | Vie de l'air dans les faisceaux. |

Règles : acteurs et décor **éclairés** (`atmo.lit`), émissifs **non éclairés**. L'UI (`UIScene`) a sa propre caméra, sans filtre. Les filtres de caméra coûtent un rendu plein écran : pas d'autre filtre de caméra hors `Atmosphere`. `GameFeel` ajoute le **squash & stretch** (`squash`) et les **traînées rémanentes** du dash (`afterimage`).

### 8.5 Accessibilité (Réglages, sauvegardés dans `MetaState.settings`)
**Secousses** 0 / 50 / 100 % (`shakeScale` ; 0 coupe aussi le zoom punch) ; **hitstop** on/off ; **flashs** on/off (flash blanc remplacé par un contour, flash plein écran du Préavis supprimé) ; **nombres de dégâts** on/off ; **attaque auto** en tactile (maintien = combo en boucle) ; **pixel parfait** (§ 1.3) ; **remappage** par `KeyboardEvent.code`, libellés via `navigator.keyboard.getLayoutMap()` quand l'API existe.

Les télégraphes ne reposent jamais sur la couleur seule (forme + durée), et tout ce qui blesse le joueur reste magenta `#FF3EA5`.

## 9. État et sauvegarde
### 9.1 `RunState` (jetable) vs `MetaState` (persistant)
```ts
// src/systems/meta/MetaState.ts et RunState.ts (pur)
export interface RunState {                    // un Shift ; perdu à la mort (sauf conversions)
  readonly seed: number; readonly roster: 'matin' | 'apres-midi' | 'nuit'; readonly biome: BiomeId;
  readonly roomId: number; readonly roomRank: number; readonly clockMin: number;   // r : 1 à 28 ; horloge +30 min par salle
  readonly energy: number; readonly energyMax: number; readonly burnout: number; readonly mobilisation: number;
  readonly gobelets: number; readonly tickets: number;                             // Gobelets : 2 au départ, 4 max
  readonly avantages: readonly string[]; readonly motions: readonly string[]; readonly reglages: readonly string[];
  readonly preuvesEnMain: readonly string[]; readonly psEarned: number; readonly grainsEarned: number;
  readonly delayMinutes: number;                                                   // « Retard cumulé » (stat de fin)
}
export interface MetaState {                   // SaveManager<MetaState>, versionné
  readonly version: 1;
  readonly ps: number; readonly grains: number;              // PS → Tableau des revendications ; Grains → Vieille Dame, OCC
  readonly tasses: number; readonly piecesDetachees: number; readonly revendications: readonly string[];
  readonly montages: readonly string[]; readonly relations: Readonly<Record<NpcId, number>>;
  readonly preuvesArchivees: readonly string[]; readonly notesDeService: readonly string[];
  readonly story: { readonly runs: number; readonly victories: number; readonly flags: readonly string[] };
  readonly settings: Settings;
}
/** Fin de Shift → méta (pur, testé) : multiplicateur du roulement, pertes à la mort, records. */
export function applyRunResult(meta: MetaState, result: RunResult): MetaState { /* … */ }
```
- `MetaState` vit dans le registry (`RegistryKeys.Meta`), modifié **immuablement** (`updateMeta(registry, fn)`) et sauvegardé à chaque retour au Hub et à chaque achat.
- `RunState` vit dans le registry (`RegistryKeys.Run`) pour le HUD ; un **instantané** est sauvegardé à l'entrée de chaque salle (clé séparée) : la graine reconstruit graphe et salle à l'identique, ce qui permet de reprendre un Shift interrompu sur mobile.

### 9.2 `SaveManager<T>` versionné
```ts
// src/systems/save/SaveManager.ts (pur) — le stockage est injecté : un Map suffit en test
export interface KeyValueStorage { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
export interface SaveData<T> { readonly savedAt: string; readonly state: T }
export type LoadResult<T> = { readonly ok: true; readonly data: SaveData<T> }
  | { readonly ok: false; readonly reason: 'empty' | 'corrupted' | 'too-new' | 'storage-unavailable' };
type Raw = Record<string, unknown>;
export interface SaveSchema<T> {
  readonly version: number;                                            // champ `version` de l'état sauvegardé
  readonly migrations: Readonly<Record<number, (state: Raw) => Raw>>;  // vN → vN+1, appliquées dans l'ordre
  readonly validate: (value: unknown) => value is T;
}
export class SaveManager<T> {
  public constructor(
    private readonly storage: KeyValueStorage | null, private readonly schema: SaveSchema<T>,
    private readonly key = 'privatix.meta', private readonly now: () => Date = () => new Date(),
  ) {}
  /** Ne lève jamais : stockage absent, plein ou bloqué → false, l'UI affiche l'échec. */
  public save(state: T): boolean {
    if (!this.storage) return false;
    try { this.storage.setItem(this.key, JSON.stringify({ savedAt: this.now().toISOString(), state })); return true; }
    catch { return false; }
  }
  public load(): LoadResult<T> {
    if (!this.storage) return { ok: false, reason: 'storage-unavailable' };
    let raw: string | null;
    try { raw = this.storage.getItem(this.key); } catch { return { ok: false, reason: 'storage-unavailable' }; }
    if (raw === null) return { ok: false, reason: 'empty' };
    try {
      const payload: unknown = JSON.parse(raw);
      if (!isRecord(payload) || !isRecord(payload.state) || typeof payload.state.version !== 'number') return { ok: false, reason: 'corrupted' };
      if (payload.state.version > this.schema.version) return { ok: false, reason: 'too-new' };
      let state: Raw = payload.state;
      for (let v = payload.state.version; v < this.schema.version; v++) {
        const migrate = this.schema.migrations[v];
        if (!migrate) return { ok: false, reason: 'corrupted' };
        state = migrate(state);
      }
      if (!this.schema.validate(state)) return { ok: false, reason: 'corrupted' };
      return { ok: true, data: { savedAt: typeof payload.savedAt === 'string' ? payload.savedAt : '', state } };
    } catch { return { ok: false, reason: 'corrupted' }; }
  }
}
```
L'adaptateur navigateur `browserStorage()` (`src/platform/storage.ts`, seul point de contact avec le stockage du navigateur, hors `systems/`) teste `localStorage` dans un `try/catch` (navigation privée, stockage bloqué) et renvoie `null` en cas d'échec ; `src/platform/save.ts` instancie `SaveManager<MetaState>` (`loadMeta()` retombe sur `newMeta()`). Une sauvegarde au format du RPG échoue à `validate` et est traitée comme corrompue (pas de migration depuis le RPG). Toute modification incompatible d'un état sauvegardé incrémente `version` et ajoute une migration **et** son test.

## 10. Performance (cible : 60 fps sur mobile milieu de gamme)
| Objet | Pool | Taille |
|---|---|---|
| Ennemis | un `physics.add.group({ classType, maxSize })` par archétype ; `get()` → `spawn()`, `despawn()` → `disableBody(true, true)` | 40 / archétype |
| Projectiles | groupe Arcade `classType: Projectile` | 96 |
| Particules | un émetteur par type, `maxParticles` | 48–96 |
| Nombres de dégâts | anneau de `BitmapText` | 64 |
| Ramassables, télégraphes au sol | groupes poolés | 32 chacun |
| Salle | **non poolée** : tilemap, colliders, portes créés/détruits à chaque salle (rare, masqué par le fondu) | — |

- **Rien n'est créé ni détruit pendant un combat** ; pas d'allocation dans `update()` (transitions pré-construites, `Vec2` réutilisés si le profileur montre du GC).
- Canvas 640×360 mis à l'échelle en CSS : très faible fill-rate, même sur écrans haute densité.
- Une texture par bande au MVP, puis **atlas** par personnage et par biome (moins de ruptures de batch). Sol décoratif en `TilemapGPULayer` (un seul quad, un seul tileset) si le profileur le demande.
- Halo de la Nuit (160 px) : une seule image d'obscurité percée qui suit le joueur, pas de lumière dynamique par objet ; filtres caméra uniquement et ponctuels ; `arcade.debug` jamais en production ; RTree conservé (< 200 corps).
- **Compteurs F3** (dev) : fps, `children.length`, `physics.world.bodies.size`, `physics.world.colliders.length`, ennemis actifs/pool, tweens actifs. Critère : **stables après 30 transitions de salle**.
- Mesure : Chrome DevTools (Performance, Memory) en débogage distant sur un Android milieu de gamme, et Safari iOS ; écran 120 Hz (§ 1.2). Pause automatique sur `BLUR`/`HIDDEN`.

## 11. Tests
### 11.1 Vitest (Node, sans Phaser) : là où vit le gameplay
| Module | Ce qu'on vérifie |
|---|---|
| `StateMachine` | ordre `exit` → `enter` → `onChange` ; `canEnter` refusé (false, état inchangé) ; file pendant `enter` ; limite de 8 enchaînements ; `timeInState` remis à 0 |
| `playerStates` (faux `PlayerCtx`) | combo 1→2→3 seulement après `chainFrame` et dans la fenêtre du buffer ; `tick` seulement sur `activeFrames` ; dash-cancel (jamais en active, 120 ms max au coup 3) ; dash refusé sans charge ; estoc après dash puis combo au coup 2 ; `drink` interrompu = Gobelet perdu ; `hurt` vide le buffer ; `dead` terminal |
| États ennemis | `spawn` invulnérable ; `windup` ≥ télégraphe ; une seule attaque par cycle ; jetons (≤ 2 mêlée, ≤ 2 distance) ; `stagger` seulement si poise épuisée |
| `InputBuffer` | fenêtre incluse/exclue, consommation unique, priorités |
| `combat/` | `hits()` (arc aux bords, rectangle orienté, cercle) ; `resolveHit` (plancher 1, critique, i-frames, `killed`, v0 = 2d/t) ; paliers et plancher de Burnout, Pétage de plombs et séquelle ; Mobilisation |
| `procedural/` | déterminisme sur 500 graines ; C1–C8 ; graphe de secours valide ; `formatSeed`/`parseSeed` aller-retour ; **chaque** gabarit (largeur constante, portes au bord, flood-fill sans case inaccessible, spawns suffisants) ; vagues (budget, distance à l'entrée, déterminisme) |
| `meta/` et `save/` | `applyRunResult` (roulement, mort), coûts du Tableau des revendications ; migrations, sauvegarde corrompue, trop récente, stockage indisponible |
| **Cohérence des données** | durées des frames = timings du GDD ; `activeFrames` < nombre de frames ; chaque état a une anim par direction dessinée ; **chaque fichier du manifeste existe** avec `largeur = N × taille` (lecture de l'en-tête PNG IHDR en Node) ; noms conformes à la regex |

### 11.2 En navigateur (checklist de PR)
Ressenti (hitstop, shake, télégraphes, latence clavier/manette/tactile) ; alignement hitbox ↔ frame active (F2 + F4) ; netteté pixel en FIT et en pixel parfait ; 60 fps Android et iPhone ; 30 salles enchaînées et 3 Shifts consécutifs sans fuite (F3) ; perte de focus → pause ; une graine saisie redonne exactement le même Shift. Plus tard (nouvelle dépendance de dev, à décider) : Playwright pour un *smoke test* (le jeu démarre, une salle se nettoie avec un bot qui spamme l'attaque, aucune erreur console).

## 12. Qualité
- **Scripts** : `npm run check` (typecheck + lint + test) avant tout commit ; `npm run build` avant toute PR qui touche la config ou les assets.
- **Garde-fous ESLint** : pas de `phaser` dans `systems/`, `utils/`, `config/` ; pas d'import des couches Phaser depuis la logique pure ; `preload()` seulement dans `PreloaderScene` ; `no-explicit-any`, `no-non-null-assertion`, `consistent-type-imports`, visibilité explicite des membres, `eqeqeq`, `window`/`globalThis` interdits (passer par les adaptateurs).
- **Revue** : toute valeur de gameplay vient de `balance.ts` ; toute nouvelle anim passe par le manifeste ; tout `on()` sur un émetteur extérieur a son `off()` au `SHUTDOWN`.
- **CI proposée** (GitHub Actions, en plus du build Docker de Coolify qui reste le contrôle final) :
```yaml
# .github/workflows/ci.yml (proposition)
name: ci
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run check          # typecheck + lint + tests (dont cohérence manifeste ↔ PNG)
      - run: npm run build
```
## 13. Workflow : logique → placeholders → vrais sprites
1. **Logique pure + tests** : `StateMachine`, `InputBuffer`, états du joueur et des ennemis, `combat/`, `procedural/`, `meta/`, `SaveManager<T>`. `npm run check` vert avant toute scène.
2. **Placeholders jouables** : les sprites générés par `tools/pixelart/` (format final exact : noms, tailles, nombre de frames, pivot) ou, à défaut, les bandes de secours en mémoire (frame d'impact en rouge). Objectif : **une salle qui se joue bien avec des formes simples** ; si le combat n'est pas bon ainsi, il ne le sera pas avec du bel art. Puis graphe, portes, récompenses, Hub minimal, `Results`.
3. **Vrais sprites** : livrés selon la convention `*_stripN.png` ; on met à jour `durations` dans le manifeste, les tests de cohérence et le contrôle de dev du Preloader signalent tout écart ; on recale `activeFrames` avec l'animateur (F2 + F4). Gabarits Tiled pour l'habillage final.

**Générateur `tools/pixelart/`** : script Python hors bundle qui produit les sprites **originaux** du projet dans `public/assets/sprites/…` et `public/assets/tilesets/` au format du manifeste. Les PNG générés sont commités (le build Docker n'exécute pas Python) et régénérables à l'identique ; on ne les retouche jamais à la main (on modifie le générateur).

**Remplacer un sprite généré par un asset itch.io** :
1. Vérifier la licence (usage commercial, modification autorisée) et l'inscrire dans `CREDITS.md` (auteur, lien, licence). Recolorer vers la palette du projet (héros orange `#FF7A1A`, ennemis turquoise `#19C3B1`, dangers magenta `#FF3EA5`), alpha binaire, sans anti-crénelage.
2. Redécouper en bandes horizontales à la **taille de frame du canon** (48, 32, 96…), pieds sur la ligne de pivot, nommer selon la regex (§ 7.1) ; un pack en grille ou en atlas se convertit en bandes (à défaut, le Preloader charge l'atlas, mais la clé d'animation reste `entité-anim-dir`).
3. Ajuster `durations` (le nombre de frames est déduit du nom), vérifier `activeFrames`, lancer `npm run check`, puis exclure le fichier du générateur (liste d'exclusions de `tools/pixelart/`) pour qu'une régénération ne l'écrase pas.

## 14. Note de migration
Le RPG au tour par tour (moteur de combat, dialogues, déplacement sur grille, cartes ASCII du monde, horloge de fatigue) est **conservé dans l'historique git** : commit `11e9f0e` (« jalon M2 du RPG au tour par tour terminé »), à étiqueter `rpg-final`. Rien n'est perdu ; rien de ce code n'est maintenu dans la branche du pivot.

| Conservé | Adapté | Supprimé |
|---|---|---|
| `vite.config.ts`, `tsconfig.json` strict, `Dockerfile`, `nginx.conf`, Prettier, `utils/rng.ts` (mulberry32) | `eslint.config.js` (dossiers § 2.3), `SaveManager` → `SaveManager<T>` générique, `constants.ts` (640×360, plus de `WORLD_ZOOM`), `balance.ts` (valeurs du GDD), `VirtualPad` → stick + 3 boutons, `Gauge` → barres du HUD | combat au tour par tour, dialogues/objectifs/story, groupe et distributeur, `GridMovement`, `WorldMap`, `FatigueClock` (remplacée par le Burnout), `BattleScene`, `DialogueScene`, `GameScene`, `data/*` du RPG et leurs tests |

Le savoir-faire des cartes ASCII (parse + test d'accessibilité) est réutilisé pour les gabarits de salles ; le patron « fonction pure qui renvoie `{ state, events }` » reste la norme. `GDD.md`, `ASSETS_GUIDE.md` et les consignes du dépôt sont à mettre à jour séparément pour refléter le pivot.

## Décisions clés
1. Phaser 4.2.1 + Arcade, WebGL, `pixelArt` + `roundPixels`, **640×360** (×2/×3/×4/×6 exacts), caméra en zoom 1 ; `FIT` par défaut, « pixel parfait » = `NONE` + `MAX_ZOOM` (en `FIT`, `zoom` est ignoré).
2. Une seule `RunScene` par Shift qui **reconstruit la salle sur place** derrière un fondu ; `UI`/`Pause`/`BossIntro` en overlay ; le boss est un type de salle.
3. Toute la logique (FSM, buffer, dégâts, Burnout, Mobilisation, graphe, gabarits, vagues, méta, sauvegarde) est **pure** dans `systems/`, imposée par ESLint et testée en Vitest.
4. `StateMachine<TCtx, M>` typée par charge utile ; anims `entité-anim-dir` (gauche = `side` + `flipX`), frames actives 0-based (`AnimationFrame.index` est 1-based), durées par frame absolues calculées depuis le GDD, buffer 150 ms.
5. Corps Arcade = cercle aux pieds ; hitbox = `overlapCirc` + test pur (arc, rectangle orienté, cercle) sur les frames actives, `Set` d'ids par swing ; joueur ↔ ennemis en `overlap`.
6. Game feel : hitstop **local**, shake combiné au maximum, flash `setTintMode(FILL)`, ralentis en temps réel, émetteurs et `BitmapText` poolés, tout réglable.
7. Procgen seedée par flux (`deriveSeed`), couches avec goulots (boutique, repos, boss), contraintes validées par programmation dynamique, gabarits ASCII puis Tiled derrière `RoomTemplate`.
8. Workflow logique → placeholders générés → vrais sprites ; le RPG reste dans `11e9f0e`.
