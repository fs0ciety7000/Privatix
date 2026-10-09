# claude.md — Instructions système pour Privatix

Ce fichier est lu par Claude Code au début de chaque intervention sur ce dépôt. Il fait autorité sur la manière de travailler ici. Les documents de conception (`docs/`) font autorité sur *ce qu'est* le jeu.

## 1. Le projet en 30 secondes

- **Privatix** : RPG 2D pixel-art au tour par tour. Un·e agent·e SNCB en horaires 3x8 à la gare de Mons rejoint l'OCC (Operation Coffee Center) pour empêcher la privatisation du rail par « Privatix Rail Solutions ». Gameplay sérieux, lore satirique.
- **Stack** : Phaser **4.2** (API de scènes héritée de Phaser 3, nouveau renderer WebGL), TypeScript 5.9 strict, Vite 7, Vitest 4, ESLint 10, Prettier 3. Node 22.
- **Résolution logique** : 960×540, tuiles 16 px, `pixelArt: true`, `Scale.FIT`.
- **Déploiement** : image Docker (build Node → nginx) sur Coolify, domaine `privatix.fs0ciety.org`. Le `Dockerfile`, `nginx.conf` et `.dockerignore` à la racine sont la vérité du déploiement.
- **Langue** : code et identifiants en anglais, commentaires, docs, textes de jeu et messages de commit en français.

Lire avant toute feature : `docs/GDD.md` (règles), `docs/STORY_AND_LORE.md` (canon narratif), `docs/ARCHITECTURE.md` (structure technique), `docs/ASSETS_GUIDE.md` (assets et nommage).

## 2. Commandes

```bash
npm install --legacy-peer-deps   # première installation (bug npm 10 avec les peers de vitest 4) ; npm ci fonctionne sans flag
npm run dev                      # serveur Vite sur http://localhost:5173
npm run check                    # typecheck + lint + tests : DOIT être vert avant tout commit
npm run build                    # tsc --noEmit puis vite build → dist/
npm run preview                  # sert dist/ sur :4173
npm run format                   # prettier
docker build -t privatix . && docker run -p 8080:80 privatix   # test du conteneur de prod
```

Avant de déclarer une tâche terminée : `npm run check` **et** `npm run build` passent. Si un test échoue, le dire avec la sortie, ne pas le désactiver.

## 3. Règles de style de code

### TypeScript strict
- `tsconfig.json` est en mode strict complet (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax`). Ne jamais assouplir ces options pour faire passer un fichier.
- **Interdit** : `any`, `as unknown as X`, `!` (non-null assertion), `// @ts-ignore`, `eslint-disable` sans justification écrite sur la ligne.
- Typer les retours de fonctions publiques. Préférer `interface` pour les formes de données, `type` pour les unions. Les enums sont remplacés par des objets `as const` + type dérivé (voir `SceneKeys` dans `src/config/constants.ts`).
- `import type` pour tout ce qui n'est utilisé qu'en type. Chemins via l'alias `@/` (`@/scenes/...`), jamais de `../../`.
- Modificateurs d'accès explicites (`public`/`private`/`protected`) sur chaque membre de classe. `override` obligatoire quand on surcharge Phaser (`update`, `destroy`, `preUpdate`).
- Pas de `console.log` (seuls `warn`, `error`, `info` sont tolérés, et retirés avant commit).

### Modules ES6
- `"type": "module"` : uniquement `import`/`export`, jamais `require`. Un fichier = une responsabilité ; une classe exportée par fichier, nom du fichier = nom de la classe (`BattleScene.ts`, `Player.ts`, `CombatEngine.ts`).
- Pas d'export par défaut (sauf fichiers de config Vite/ESLint). Pas de barrel `index.ts` qui ré-exporte tout : importer la source.
- Les constantes magiques vivent dans `src/config/constants.ts` (dimensions, vitesses, clés) et `src/config/balance.ts` (équilibrage). Aucun nombre magique dans une scène.

### Formatage
- Prettier (`.prettierrc`) est la seule autorité de formatage : single quotes, point-virgules, largeur 100, virgules finales. Ne pas débattre du style, lancer `npm run format`.

## 4. Règles spécifiques à Phaser (v4, API héritée de Phaser 3)

### Scene Manager, pas de bricolage
- Toute scène hérite de `Phaser.Scene`, prend sa clé depuis `SceneKeys` et vit dans `src/scenes/`. Elle est enregistrée dans le tableau `scene` de `src/main.ts`.
- Transitions : `scene.start(key, data)` pour remplacer, `scene.launch` pour superposer (UI, Dialogue), `scene.pause/resume` pour un overlay modal, `scene.sleep/wake` pour mettre l'exploration en veille pendant un combat, `scene.stop` pour libérer. Le tableau des cas est dans `docs/ARCHITECTURE.md`. Ne jamais instancier une scène à la main ni appeler `create()` soi-même.
- Les données passées à une scène le sont via le paramètre `data` de `init(data)` avec une interface typée (`BattleSceneData`), jamais via une propriété statique.
- **`preload()` n'existe que dans `PreloaderScene`**, qui charge `public/assets/asset-pack.json` via `this.load.pack`. ESLint refuse un `preload` ailleurs. Un nouvel asset = une entrée dans `asset-pack.json` + une clé dans `AssetKeys` + une ligne dans `CREDITS.md`.

### Pas de variables globales
- Rien sur `window`, `globalThis` ou en module-level mutable. ESLint bloque `window`. L'état partagé passe par **un seul** objet `GameState` dans `this.registry` (clé `RegistryKeys.GameState`), toujours modifié de façon immuable (`registry.set(key, {...state, ...})`) pour que l'événement `changedata` déclenche la mise à jour de l'UI.
- Lire et écrire le GameState uniquement via `getGameState` / `updateGameState` (`src/utils/registry.ts`), jamais par `registry.get(...) as GameState`.
- La communication entre scènes passe par le registry (l'événement `changedata` fournit l'ancienne et la nouvelle valeur), jamais par `this.scene.get('X').someProperty`. Un EventBus typé n'est pas encore en place : ne pas en créer un sous forme de singleton de module sans décision.
- Les transitions de jeu (horloge, Fatigue, combat…) sont des fonctions pures qui renvoient `{ state, events }` (modèle : `src/systems/time/FatigueClock.ts`). La scène applique l'état en une seule écriture registry, puis réagit aux événements.
- Une seule instance `Phaser.Game`, créée dans `src/main.ts` et jamais exportée.

### Logique pure séparée de Phaser
- `src/systems/`, `src/data/`, `src/utils/` **n'importent jamais `phaser`** (règle ESLint). Combat, horloge/fatigue, inventaire, sauvegarde, déplacement sur grille sont des fonctions ou classes pures, testées avec Vitest dans `tests/`. L'aléatoire est injecté (`rng: () => number`) pour des tests déterministes.
- Les scènes et `src/ui/` ne font que : lire l'état, appeler un système, afficher le résultat, jouer les tweens/sons.
- Les données de jeu (ennemis, objets, compétences, dialogues) sont des fichiers typés dans `src/data/`, jamais des littéraux dans une scène.

### Gestion propre de la mémoire (garbage collector)
- Tout ce qu'une scène crée hors de sa display list doit être libéré dans un handler de `Phaser.Scenes.Events.SHUTDOWN` : `off()` sur les écouteurs clavier, registry, EventBus ; `remove()` des timers ; `tweens.killTweensOf()` ; `scene.stop()` des scènes lancées en parallèle (voir `GameScene.onShutdown`).
- Toujours passer le contexte à `on(event, handler, this)` et le même triplet à `off`. Les écouteurs posés avec `once` sur `this.events` sont acceptables ; ceux posés sur des émetteurs qui survivent à la scène (`this.registry.events`, `this.input.keyboard`, `this.game.events`, EventBus) **doivent** être retirés.
- Les objets custom (`Player`, composants UI) surchargent `destroy()` pour couper leurs propres références (clés, tweens, timers) avant `super.destroy()`.
- Pas de création d'objets dans `update()` (texte, graphics, tableaux temporaires) : préparer dans `create()`, réutiliser, ou utiliser un `Group` avec pooling. Pas de closures capturant la scène dans un `setInterval` : utiliser `this.time.addEvent`.
- Vérifier manuellement qu'un aller-retour (Game → Battle → Game, ×3) ne double pas les écouteurs ni les textes du HUD.

### Divers Phaser
- Entrées clavier via `KeyboardEvent.code` (ZQSD et WASD fonctionnent sans réglage) ; prévoir le tactile pour chaque action (voir `docs/GDD.md` § contrôles).
- Positions et tailles entières (`roundPixels`), textes en police pixel, jamais de scale non entier sur un sprite.
- Version : **Phaser 4** (`^4.2.1`), décidée par le porteur du projet. Le paquet embarque sa doc de migration et ses guides : `node_modules/phaser/changelog/v4/4.0/MIGRATION-GUIDE.md`, `node_modules/phaser/docs/` et `node_modules/phaser/skills/`. Les consulter avant d'utiliser une API dont le comportement a pu changer depuis la v3.
- Pièges v4 à connaître : `setTintFill()` n'existe plus (utiliser `setTint(c).setTintMode(Phaser.TintModes.FILL)`), `Geom.Point` est remplacé par `Math.Vector2`, les FX et masques deviennent des filtres, `Math.TAU` vaut désormais 2π, `Struct.Set/Map` sont des `Set`/`Map` natifs, le renderer Canvas est déprécié (WebGL partout), pas d'appel WebGL direct.
- Pixel-art : la config est sous `render: { pixelArt: true, roundPixels: true }` (`roundPixels` vaut `false` par défaut en v4). L'arrondi des sommets ne s'applique qu'aux objets ni zoomés ni tournés : avec une caméra zoomée, régler `vertexRoundMode` au besoin (voir le guide pixel-art du paquet).

## 5. Workflow de développement d'une feature

Ordre imposé : **1) interface, 2) logique, 3) intégration.** Ne pas commencer par le code de scène.

1. **Comprendre et cadrer**
   - Relire la section concernée du `docs/GDD.md` (ou `STORY_AND_LORE.md`). Si la règle n'y est pas, la proposer d'abord dans le doc (un paragraphe) : le doc est la source de vérité, le code la suit.
   - Lister les fichiers touchés et les critères d'acceptation en 3-5 lignes avant d'écrire du code.

2. **Interface d'abord (contrats)**
   - Définir les types et signatures : interfaces de données dans `src/data/types.ts`, API publique du système (`class CombatEngine { resolveTurn(...): TurnResult }`), événements de l'EventBus, forme des `SceneData`.
   - Ajouter les constantes dans `balance.ts`/`constants.ts`. Compiler (`npm run typecheck`) : le compilateur liste tout ce qu'il faudra brancher.

3. **Logique pure ensuite (testée)**
   - Implémenter dans `src/systems/` sans Phaser. Écrire les tests Vitest dans `tests/` en même temps : cas nominal, limites (0, max, overflow de minuit, fatigue 100), aléatoire seedé. `npm run test` vert.

4. **Intégration Phaser enfin**
   - Brancher dans la scène ou le composant `src/ui/` : entrée joueur → appel du système → mise à jour du registry → rendu/tweens/sons. Ajouter les assets dans `asset-pack.json` + `AssetKeys` + `CREDITS.md`.
   - Gérer le cycle de vie (shutdown/destroy). Tester à la main dans `npm run dev` : le scénario nominal, une sortie de scène, un retour. Raccourcis de développement en jeu : `T` (+1 h), `N` (acte suivant), absents du build de production (`import.meta.env.DEV`).

5. **Finir proprement**
   - `npm run check` et `npm run build` verts. Mettre à jour la doc si le comportement a changé. Commit atomique en français à l'impératif (`feat: ajoute la jauge de fatigue au HUD`), un sujet par commit.
   - Ne pas élargir le périmètre : une feature = une branche/un commit. Signaler les idées annexes dans la réponse, pas dans le code.

## 6. Ce que Claude ne fait pas sans demander

- Changer la stack ou une version majeure, assouplir `tsconfig`/ESLint, ajouter une dépendance runtime (Phaser est la seule aujourd'hui).
- Modifier le canon narratif (noms, lieux, fins) ou les formules d'équilibrage sans mettre à jour le doc correspondant.
- Nommer une personne réelle, reproduire un logo ou une marque réelle, intégrer un asset sans licence compatible (CC0 / CC-BY avec crédit).
- Supprimer ou désactiver un test, pousser sur une autre branche que celle demandée, créer une PR non demandée.

## 7. Carte du dépôt

```
src/main.ts              # config Phaser, liste des scènes (unique new Phaser.Game)
src/config/              # constants.ts (SceneKeys, AssetKeys, dimensions), colors.ts (palette SNCB/OCC), balance.ts (équilibrage, fait foi)
src/scenes/              # Boot, Preloader, MainMenu, Game, UI (+ Battle, Dialogue, OCC, Pause à venir)
src/entities/            # objets de jeu Phaser (Player, NPC, Enemy)
src/systems/             # logique pure sans Phaser : GameState, time/FatigueClock (+ à venir CombatEngine, Inventory, SaveManager, GridMovement)
src/ui/                  # composants Phaser réutilisables : Gauge, Clock3x8 (+ à venir NineSlicePanel, UIButton, DialogueBox, ActionMenu)
src/data/                # données typées (ennemis, objets, compétences, dialogues)
src/utils/               # helpers purs : math (clamp), registry (getGameState / updateGameState)
tests/                   # tests Vitest de la logique pure
public/assets/           # asset-pack.json, images/, audio/, tilemaps/, fonts/
docs/                    # GDD, STORY_AND_LORE, ARCHITECTURE, ASSETS_GUIDE
Dockerfile, nginx.conf   # déploiement Coolify
```
