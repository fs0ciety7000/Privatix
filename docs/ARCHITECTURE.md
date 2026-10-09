# Privatix — Architecture technique

> RPG 2D pixel-art au tour par tour (gare de Mons, lutte contre la privatisation du rail belge).
> Site statique servi par nginx dans un conteneur Docker, déployé par Coolify sur **https://privatix.fs0ciety.org**.
> Ce document décrit le **scaffolding tel qu'il existe** (validé : typecheck, lint, tests, build OK) et la **cible** vers laquelle on le fait évoluer. En cas de doute, le code du dépôt fait foi, puis ce document, puis les dossiers de conception.

---

## 1. Vue d'ensemble

### 1.1 Stack et versions réelles

| Brique | Version (`package.json`) | Pourquoi |
|---|---|---|
| **Phaser** | `^4.2.1` | Phaser 4 retenu par le porteur du projet (migration depuis 3.90 faite au démarrage, aucun code à réécrire). Même API de scènes, tilemaps Tiled, atlas, tweens, audio et input que la v3, avec un nouveau renderer WebGL (render nodes) et des filtres à la place des FX. Types TS livrés. Le paquet embarque `changelog/v4/4.0/MIGRATION-GUIDE.md`, `docs/` (guide pixel-art) et `skills/` : à consulter avant d'utiliser une API qui a pu changer. |
| **Vite** | `^7.3.7` | Serveur de dev instantané, HMR, build Rollup, `public/` copié tel quel (idéal pour les assets du jeu). |
| **TypeScript** | `^5.9.3` (strict maximal) | Un RPG est fait de données structurées (ennemis, objets, dialogues, sauvegardes) : le compilateur attrape les clés et schémas invalides. |
| **Vitest** | `^4.1.11` | Réutilise la config Vite (alias `@/`), teste la logique pure **sans Phaser ni DOM** (`environment: 'node'`). |
| **ESLint** | `^10` + `@eslint/js ^10.0.1` + `typescript-eslint ^8.71` | Flat config typée (`strictTypeChecked`) et **garde-fous d'architecture** (§9.2). |
| **Prettier** | `^3.9` | Formatage sans débat (`.prettierrc` : quotes simples, virgules finales, 100 colonnes, LF). |
| **Node** | 22 (`"engines": { "node": ">=22" }`) | LTS ; même version en local, en CI et dans l'image Docker (`node:22-alpine`). |

Points notables de `tsconfig.json` : `strict`, `noUncheckedIndexedAccess` (`arr[i]` est `T | undefined`), `exactOptionalPropertyTypes`, `noImplicitOverride` (`override update()` obligatoire), `verbatimModuleSyntax` (imports de types explicites `import type`), alias `@/*` → `src/*`. Le `include` couvre `src`, `tests` et `vite.config.ts`.

### 1.2 Mise en route

```bash
npm install --legacy-peer-deps   # 1re installation (bug npm 10 avec les peers de vitest 4)
npm ci                           # avec le lockfile (CI, Docker) : aucun flag nécessaire
npm run dev                      # http://localhost:5173 ; puis npm run check / build / preview (:4173)
```

| Script | Commande | Usage |
|---|---|---|
| `dev` / `preview` | `vite --host` / `vite preview --host --port 4173` | Dev avec HMR (port 5173 strict) / vérifier `dist/`. |
| `build` | `tsc --noEmit && vite build` | Build de production (le typecheck bloque le build). |
| `typecheck`, `lint`, `lint:fix` | `tsc --noEmit`, `eslint src tests [--fix]` | Types, qualité et garde-fous d'architecture. |
| `format`, `format:check` | `prettier --write/--check` | `src`, `tests` (et `docs` en écriture). |
| `test`, `test:watch` | `vitest run`, `vitest` | Tests unitaires de la logique pure. |
| `check` | `typecheck && lint && test` | Porte d'entrée unique avant PR. |

### 1.3 Structure des dossiers

```
Privatix/
├─ index.html                 # <div id="game">, canvas en image-rendering: pixelated
├─ public/assets/             # copié tel quel dans dist/assets (NON hashé)
│  ├─ asset-pack.json         # manifeste unique chargé par le Preloader (vide pour l'instant)
│  ├─ images/  audio/  tilemaps/  fonts/
├─ src/
│  ├─ main.ts                 # seule instanciation de Phaser.Game
│  ├─ vite-env.d.ts
│  ├─ config/                 # constants.ts (SceneKeys, RegistryKeys, AssetKeys, Shift, zoom, pas), colors.ts, balance.ts
│  ├─ scenes/                 # BootScene, PreloaderScene, MainMenuScene, GameScene, UIScene, DialogueScene
│  ├─ entities/               # Player.ts (héros sur grille), MapView.ts (affichage d'une WorldMap)
│  ├─ systems/                # LOGIQUE PURE, sans Phaser :
│  │  ├─ GameState.ts         #   état global + validation
│  │  ├─ time/                #   FatigueClock (horloge 3x8, Fatigue, repos)
│  │  ├─ world/               #   WorldMap (cartes ASCII → grille, blocage, interactions)
│  │  ├─ movement/            #   GridMovement
│  │  ├─ story/               #   Conditions, DialogueRunner, Effects, Objectives, TextTokens, Layoff
│  │  ├─ vending/             #   VendingCode (distributeur de l'OCC)
│  │  └─ save/                #   SaveManager (versions, migrations)
│  ├─ platform/               # storage.ts : seul accès à localStorage
│  ├─ ui/                     # Gauge, Clock3x8, VirtualPad, PlaceholderTextures
│  ├─ data/                   # types.ts (contrats), maps, dialogues, objectives, characters, encounters, story
│  └─ utils/                  # math.ts (clamp), registry.ts (GameState typé, bandeaux)
├─ tests/                     # un fichier par système + data.test.ts (cohérence du contenu)
├─ docs/                      # documentation (exclue de l'image Docker)
├─ vite.config.ts  tsconfig.json  eslint.config.js  .prettierrc  .editorconfig
└─ Dockerfile  nginx.conf  .dockerignore  package.json  package-lock.json
```

Cible (ajouts uniquement, l'existant ne bouge pas) :

```
src/
├─ scenes/      + BattleScene, DialogueScene, OccScene, PauseScene, BaseScene (abstraite)
├─ entities/    + Npc.ts ; Player.ts réécrit en sprite piloté par GridMovement
├─ systems/     + combat/CombatEngine.ts, inventory/Inventory.ts,
│                 save/{SaveManager,schema,migrations}.ts, movement/GridMovement.ts, MoralMeter.ts,
│                 events/EventBus.ts (implémentation pure, sans Phaser)
├─ ui/          + NineSlicePanel, UIButton, DialogueBox, ActionMenu,
│                 FocusManager, InputManager, VirtualPad, FloatingText, Toast, theme.ts
├─ data/        + enemies.ts, items.ts, skills.ts, maps.ts, strings.ts, dialogues/*.ts
├─ utils/       + rng.ts (RNG seedé), guards.ts (type guards)
└─ platform/    + storage.ts (adaptateur localStorage, seul accès navigateur hors Phaser)
```

---

## 2. Architecture des scènes

### 2.1 Scènes existantes et cibles

| Scène (`SceneKeys`) | Statut | Rôle |
|---|---|---|
| `Boot` | existe | Crée le `GameState` initial dans le registry, puis `start(Preloader)`. Aucun asset. |
| `Preloader` | existe | **Seule** scène qui charge : `this.load.pack(AssetKeys.AssetPack, 'assets/asset-pack.json')` + barre de progression en rectangles. Cible : créer aussi les animations globales. |
| `MainMenu` | existe | Nouvelle partie (choix Léon / Léa, GameState neuf) ou Continuer (sauvegarde la plus récente). Cible : Options, style tableau des départs. |
| `Game` | existe | Exploration case par case de la carte du GameState : portails, déclencheurs, interactions, dialogues d'arrivée, horloge, Mise à pied, sauvegarde auto à l'entrée de l'OCC. Lance `UI`. Échap → menu (cible : ouvre `Pause`). |
| `UI` | existe | Overlay HUD : statut PV/PE/Fatigue/Moral, horloge 3×8, invite d'interaction, bandeaux, pad tactile. Aucune logique de jeu. |
| `Dialogue` | existe | Overlay lancé par Game (qui se met en pause) : texte lettre par lettre, choix, effets via `DialogueRunner`, sauvegarde, clavier du distributeur de l'OCC. |
| `Battle` | existe (M2) | Combat au tour par tour, vue de côté : rejoue les événements de `CombatEngine`, menu d'actions 2×3, sous-menus, choix de cible (clavier, souris, tactile), écran de victoire/défaite. Applique le résultat au GameState (`Party.applyBattleReport`) puis reprend la scène appelante avec `{ battleOutcome }`. |
| `Occ` | abandonnée | **Décision M1** : l'OCC est une carte (`occ`) explorée par `Game`, pas une scène. Ses services (Vieille Dame, canapé, lit de camp…) sont des objets dont les dialogues appliquent les effets `save`, `heal`, `rest`. |
| `Pause` | cible | « Classeur de service » : inventaire, équipe, compétences, options, quitter. |

Les clés sont des objets `as const` (pas des `enum` TS) dans `src/config/constants.ts` ; on étend le même objet :

```ts
export const SceneKeys = {
  Boot: 'Boot', Preloader: 'Preloader', MainMenu: 'MainMenu', Game: 'Game', UI: 'UI',
  Dialogue: 'Dialogue', Battle: 'Battle', // existent
  Pause: 'Pause',                          // cible
} as const;
export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];
```

L'ordre du tableau `scene` de `main.ts` est l'ordre de rendu : les overlays (`UI`, `Dialogue`, `Pause`) sont déclarés **en dernier**.

### 2.2 Flux

```
Boot ─start─▶ Preloader ─start─▶ MainMenu ─start─▶ Game ═launch═▶ UI (HUD, parallèle)
              (textures            ▲  (GameState     │
               placeholder)        │   dans le       │ pause(Game) + launch(Dialogue, { dialogueId })
                                   │   registry)     ├──▶ Dialogue ─ resume(Game) + stop ─▶ Game.onResume :
                                   │                 │      téléportation, visibilité des PNJ, Mise à pied
                                   └── start (Échap) ┘
                                   │                 │ pause(Game) + launch(Battle, { encounterId, caller: Game, markerKey })
                                   │                 ├──▶ Battle (groupe visible sur la carte)
Dialogue ─ pause(Dialogue) + launch(Battle, { encounterId, caller: Dialogue }) ─▶ Battle
Battle ─ applyBattleReport ─ stop + resume(caller, { battleOutcome }) :
   victoire / fuite → la scène appelante continue ; défaite → Mise à pied (Dialogue se ferme, Game joue « mise-a-pied »)
Cible : Pause (pause Game).
```

### 2.2.2 Combat (jalon M2)

- **Déclenchement.** Sur la carte, foncer sur un groupe d'ennemis visible (marqueur `encounter`) ou interagir avec lui lance le combat. Dans un dialogue, l'effet `battle` est une *action de scène* : le combat part quand le joueur valide le nœud qui l'annonce, et le dialogue reprend au nœud suivant après une victoire.
- **Préparation.** `Party.buildBattleSetup` compose l'équipe (héros + les deux premiers collègues recrutés, dans l'ordre Josiane, Rudy, Béné), calcule leurs stats au niveau du héros (`Leveling.statsAt`), reprend PV/PE conservés, Fatigue, Moral, pause, inventaire et Gobelets.
- **Règles.** Entièrement dans `src/systems/combat/` (pur, aléatoire injecté). La scène ne fait que rejouer les `BattleEvent` et demander une action au membre dont c'est le tour.
- **Résultat.** `Party.reportFromBattle` + `applyBattleReport` : XP et niveaux (PV max relevés), Tickets, Grains, PV conservés (K.O. → 1 PV), Fatigue du combat puis coûts (+2, +1 par 3 manches, +10 min), Moral −1 si le héros finit Démotivé, groupe visible marqué vaincu (il réapparaît 2 h in-game plus tard). Défaite : Mise à pied, équipe soignée.
- **Gobelets de l'OCC.** Remplis à la Vieille Dame (effet `gobelets`, 1 fois par pause, 1/2/3 selon la machine) ; bus en combat avec l'action Café.

### 2.2.1 Boucle d'exploration (jalon M1)

1. `Game.loadCurrentMap` lit `state.position`, construit la `WorldMap` (`src/systems/world/WorldMap.ts`) et la `MapView`, place le héros, annonce le nom de la zone (au premier chargement, c'est `UI` qui l'annonce à sa création, car elle n'écoute pas encore), joue l'`onEnter` de la carte s'il y en a un.
2. `update` : l'horloge avance (1 min / 8 s, boisson de relève comprise) ; si une direction est tenue (clavier ou D-pad), `Player.tryStep` fait un pas via `GridMovement.step` et `isBlocked` (terrain, PNJ et objets visibles).
3. À l'arrivée sur une case : position écrite dans le GameState, puis portail (`travel` : +5 min, nouvelle carte) ou déclencheur (dialogue).
4. E / Espace / Entrée ou bouton A : interaction avec le PNJ ou l'objet **en face** (première `Interaction` dont la condition est vraie).
5. `Dialogue` applique chaque étape du `DialogueRunner` au GameState (drapeaux, Moral, repos, combat simulé, téléportation…) et exécute les actions de scène (sauvegarde, clavier). Au retour, `Game.onResume` recharge la carte si la position a changé de carte, replace le héros, met à jour les PNJ visibles et déclenche la Mise à pied si la Fatigue vaut 100.

### 2.3 Quelle transition pour quel cas

| API | Effet | Cas Privatix |
|---|---|---|
| `scene.start(key, data)` | Shutdown de la scène courante, démarre `key`. | Chaîne Boot → Preloader → MainMenu → Game ; Quitter → MainMenu. |
| `scene.launch(key, data)` | Démarre `key` en parallèle, la courante continue. | Game lance UI ; ouverture de Battle, Dialogue, Pause. |
| `scene.pause(key)` / `resume(key, data)` | Plus d'`update`, **toujours rendue**. | Game figée mais visible derrière Dialogue et Pause. |
| `scene.sleep(key)` / `wake(key, data)` | Ni `update` ni rendu, état conservé. | Game + UI cachés pendant Battle (position, PNJ, carte intacts). |
| `scene.switch(key)` | `sleep` de la courante + `start`/`wake` de la cible. | Game ↔ Occ. |
| `scene.stop(key)` | Shutdown : display list vidée, `SHUTDOWN` émis. | Fin de Battle, Dialogue, Pause ; UI quand Game s'arrête (déjà en place). |

Règles : une scène instanciée est **réutilisée** entre deux `start` ; les initialiseurs de champs ne s'exécutent qu'une fois, donc l'état de scène est (ré)initialisé dans `init(data)` ou `create()`. Les écouteurs `WAKE`/`RESUME` sont enregistrés une fois dans `create()` et retirés au `SHUTDOWN`.

### 2.4 Flux de données : trois canaux

1. **`data` des transitions** (ponctuel) : quelle rencontre, quel dialogue, résultat du combat. Typé par scène.
2. **Registry → un unique `GameState`** (persistant pendant la session, sérialisé en sauvegarde). Déjà en place : `BootScene` fait `registry.set(RegistryKeys.GameState, createInitialGameState())` et `UIScene` réagit à `CHANGE_DATA`. On remplace l'objet (immutabilité) pour que l'événement parte.
3. **EventBus typé** (notifications découplées : `fatigue:changed`, `clock:shiftChange`, `battle:ended`…).

```ts
// src/config/scene-data.ts — contrat de chaque transition
export interface SceneDataMap {
  [SceneKeys.Game]: { mode: 'new' | 'continue'; spawn?: string };
  [SceneKeys.Battle]: { encounterId: EncounterId; returnTo: SceneKey };
  [SceneKeys.Dialogue]: { dialogueId: DialogueId; caller: SceneKey };
  [SceneKeys.Occ]: { from: MapId };
}
export type BattleOutcome = { result: 'victory' | 'defeat' | 'fled'; rounds: number };

// src/scenes/transitions.ts — wrappers typés : jamais de start(key, objetQuelconque)
export function startScene<K extends keyof SceneDataMap>(
  from: Phaser.Scene, key: K, data: SceneDataMap[K],
): void {
  from.scene.start(key, data);
}
export function openDialogue(from: Phaser.Scene, dialogueId: DialogueId): void {
  from.scene.pause();
  from.scene.launch(SceneKeys.Dialogue, { dialogueId, caller: from.scene.key as SceneKey });
}
```

```ts
// src/utils/registry.ts — accès typé (évite les `as GameState` dispersés comme dans UIScene)
type DataManager = { get(key: string): unknown; set(key: string, value: unknown): unknown }; // le registry Phaser s'y conforme
export function getGameState(registry: DataManager): GameState {
  const value = registry.get(RegistryKeys.GameState);
  if (!isGameState(value)) throw new Error('GameState absent du registry (Boot non exécuté ?)');
  return value;
}
export function updateGameState(registry: DataManager, fn: (s: GameState) => GameState): void {
  registry.set(RegistryKeys.GameState, fn(getGameState(registry)));
}
```

```ts
// src/systems/events/EventBus.ts — PUR (ESLint interdit phaser dans src/systems), donc testable
export interface GameEvents {
  'fatigue:changed': [value: number, tier: FatigueTierId];
  'clock:tick': [minuteOfDay: number];
  'clock:shiftChange': [shift: Shift];
  'clock:pauseStart': []; 'clock:pauseEnd': []; 'moral:changed': [value: number];
  'inventory:changed': [itemId: ItemId, quantity: number];
  'battle:ended': [outcome: BattleOutcome];
  'notify': [message: string];
}
type Handler<A extends unknown[]> = (...args: A) => void;

export class TypedEventBus<E extends { [K in keyof E]: unknown[] }> {
  private readonly handlers = new Map<keyof E, Set<{ fn: Handler<never[]>; ctx: unknown }>>();

  public on<K extends keyof E>(event: K, fn: Handler<E[K]>, ctx?: unknown): () => void {
    const entry = { fn: fn as Handler<never[]>, ctx };
    const set = this.handlers.get(event) ?? new Set();
    set.add(entry);
    this.handlers.set(event, set);
    return () => set.delete(entry); // désabonnement à confier à addDisposer()
  }

  public emit<K extends keyof E>(event: K, ...args: E[K]): void {
    for (const { fn, ctx } of [...(this.handlers.get(event) ?? [])]) {
      (fn as Handler<E[K]>).apply(ctx, args);
    }
  }
}
export const eventBus = new TypedEventBus<GameEvents>(); // singleton de module, jamais sur window
```

---

## 3. Logique pure / présentation

**Règle d'or** : `src/systems`, `src/data`, `src/utils` n'importent jamais `phaser` (règle ESLint active). Les scènes **orchestrent** : input → appel d'un système → mise à jour du `GameState` → animation. Toute règle du GDD est une fonction ou une classe pure, testée avec Vitest.

### 3.1 Systèmes cibles

| Système | Responsabilité | Branché par |
|---|---|---|
| `GameState` (existe) | Agrégat sérialisable : `time` (état du `FatigueClock`), `player` ; garde `isGameState`. | Boot (création), toutes les scènes (lecture via `utils/registry.ts`) |
| `FatigueClock` (existe, `systems/time/`) | Horloge 3x8 (1 min in-game toutes les 8 s réelles, figée hors exploration), butées et heures sup', relèves d'acte, Fatigue passive (+2/+3/+5 par heure) et ponctuelle, paliers, repos de l'OCC (café, sieste, dormir, 1 fois par pause chacun), fin de combat. | `GameScene.update(delta)` écrit, `UIScene` + `Clock3x8` + `Gauge` lisent |
| `CombatEngine` | Initiative, toucher, critique, dégâts, statuts, fuite, IA ennemie, compteur de signature du boss. | `BattleScene` |
| `Inventory` | Quantités, plafonds, consommables, équipement (3 emplacements), Tickets, Grains de café. | Battle, Pause, Occ |
| `GridMovement` | Déplacement case par case (16 px), collisions via un prédicat injecté, orientation. | `Player` |
| `MoralMeter` | Jauge collective 0–100 : crit `floor(Moral/5)`, résistance `min(60, floor(Moral/2))`, fin (≥ 60), phase 3 du boss (< 40). | Battle, dialogues, fins |
| `SaveManager` | localStorage versionné + migrations (§7). | Boot, Occ, Pause |

Seuils de Fatigue (canon) : **Frais 0–39, Fatigué 40–69, Épuisé 70–89, Burn-out 90–99, Effondré 100**. Toutes les constantes d'équilibrage vivent dans `src/config/balance.ts`.

### 3.2 Interfaces principales

```ts
// src/utils/rng.ts — RNG injectable (mulberry32) : jamais Math.random() dans un système
export type Rng = () => number; // [0, 1)
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

```ts
// src/systems/movement/GridMovement.ts
export type Facing = 'up' | 'down' | 'left' | 'right';
export interface GridPos { readonly tileX: number; readonly tileY: number; readonly facing: Facing }
export type IsBlocked = (tileX: number, tileY: number) => boolean;

const DELTA: Record<Facing, readonly [number, number]> = {
  up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
};
/** Tourne toujours ; avance d'une case seulement si la cible est libre. */
export function step(pos: GridPos, dir: Facing, isBlocked: IsBlocked): GridPos {
  const [dx, dy] = DELTA[dir];
  const nx = pos.tileX + dx, ny = pos.tileY + dy;
  return isBlocked(nx, ny) ? { ...pos, facing: dir } : { tileX: nx, tileY: ny, facing: dir };
}
// facingTile(pos) renvoie la case « en face » : c'est elle que vise l'action Interagir.
```

```ts
// src/systems/time/FatigueClock.ts (extrait de l'API réelle)
// Fonctions pures et immuables : chaque appel renvoie un NOUVEL état + les événements produits.
export interface FatigueClockState {
  readonly totalMinutes: number;   // minutes depuis lundi 00:00 (jour 0) ; mardi 05:00 = 1740
  readonly act: ActNumber;         // 1 | 2 | 3
  readonly fatigue: number;        // 0–100, décimales arrondies au millionième
  readonly overtime: boolean;      // horloge bloquée à la butée de relève (« HEURES SUP' »)
  readonly restShiftIndex: number; // pause pour laquelle restUsed est valable
  readonly restUsed: RestUsage;    // { coffee, nap, sleep } : 1 fois par pause chacun
}
export type ClockEvent =
  | { type: 'shiftChanged'; from: Shift; to: Shift } | { type: 'overtimeStarted' }
  | { type: 'actStarted'; act: ActNumber } | { type: 'tierChanged'; from: FatigueTierId; to: FatigueTierId }
  | { type: 'collapsed' };
export interface ClockResult { readonly state: FatigueClockState; readonly events: readonly ClockEvent[] }

realMsToGameMinutes(elapsedMs): { minutes; carryMs }          // la scène garde le reliquat (< 8 s)
advanceTime(state, minutes, { accrueFatigue?, timeMultipliers? }): ClockResult
addFatigue(state, delta): ClockResult                          // combat, objets, compétences
finishCombat(state, { rounds, fled }): ClockResult             // +2 (+1/3 manches) ou +5, puis +10 min
startNextAct(state): ClockResult                               // saut à 14:00 (−30) ou 22:00 (−50)
drinkOccCoffee(state, machineLevel) / takeNap(state) / sleepUntilCap(state): RestResult
fatigueTier(fatigue): FatigueTier                              // seule lecture autorisée des effets
```

Branchement : `GameScene.update(delta)` convertit le temps réel en minutes et n'écrit dans le registry qu'une fois par minute in-game (toutes les 8 s). Comme `update` ne tourne pas quand la scène est en pause ou en veille, l'horloge est figée d'office pendant les dialogues et les combats. `UIScene` reçoit l'ancien et le nouveau `GameState` via `changedata` : elle compare les pauses pour faire clignoter `Clock3x8` à la relève, sans EventBus. En développement, `T` avance d'une heure et `N` passe à l'acte suivant (retirés du build de production).

> Écart avec le plan initial : le `TimeService` mutable avec `setFrozen` est remplacé par ces fonctions pures. Le gel découle du cycle de vie des scènes et l'immutabilité colle au registry. L'EventBus singleton de module (§2.4) reste à trancher : il contredit la règle « pas d'état mutable au niveau module » de `claude.md`. Le `FatigueClock` n'en a pas besoin.

```ts
// src/systems/combat/CombatEngine.ts (extrait de l'API)
export interface Combatant {
  readonly id: string; readonly side: 'party' | 'enemy';
  hp: number; pe: number; readonly maxHp: number; readonly maxPe: number;
  readonly force: number; readonly defense: number; readonly vitesse: number;
  statuses: StatusInstance[];
}
export type CombatAction =
  | { kind: 'attack'; actorId: string; targetId: string }
  | { kind: 'skill'; actorId: string; skillId: SkillId; targetIds: readonly string[] }
  | { kind: 'item'; actorId: string; itemId: ItemId; targetId: string }
  | { kind: 'defend'; actorId: string }
  | { kind: 'flee'; actorId: string };
export type CombatEvent =
  | { kind: 'damage'; targetId: string; amount: number; critical: boolean; missed: boolean }
  | { kind: 'heal'; targetId: string; amount: number }
  | { kind: 'status'; targetId: string; status: StatusId; applied: boolean }
  | { kind: 'ko'; targetId: string } | { kind: 'fled'; success: boolean }
  | { kind: 'phase'; phase: 1 | 2 | 3 } | { kind: 'signature'; turnsLeft: number }; // boss Vanderslide

export interface CombatContext { fatigue: number; moral: number; shift: Shift }

export class CombatEngine {
  public constructor(units: readonly Combatant[], ctx: CombatContext, rng: Rng) { /* … */ }
  public turnOrder(): readonly string[] { /* initiative = floor(Vit × mults) + randInt(0, 5) */ }
  public resolve(action: CombatAction): readonly CombatEvent[] { /* … */ }
  public status(): 'ongoing' | 'victory' | 'defeat' | 'fled' { /* … */ }
}
// La BattleScene rejoue les CombatEvent un par un (tweens, FloatingText, log) : la vue ne calcule rien.
```

```ts
// src/systems/MoralMeter.ts
export const MORAL_GOOD_ENDING = 60; export const MORAL_BOSS_PHASE3 = 40; // dans balance.ts à terme
export const moralCritBonus = (moral: number): number => Math.floor(moral / 5);
export const moralResistance = (moral: number): number => Math.min(60, Math.floor(moral / 2));
export const applyMoral = (moral: number, delta: number): number => clamp(moral + delta, 0, 100);
```

### 3.3 Tests Vitest

Les tests vivent dans `tests/` (convention actuelle) ; `src/**/*.test.ts` est aussi accepté par `vite.config.ts`. RNG seedé ou stub pour les cas aléatoires.

En place (M1) : un fichier par système (`FatigueClock`, `balance`, `world`, `story`, `SaveManager`, `registry`) ; `data.test.ts` pour la cohérence du contenu ; `act1.test.ts` qui rejoue tout l'Acte I sans Phaser. Ce dernier s'appuie sur `tests/support/simulate.ts`, un simulateur fidèle à `GameScene`/`DialogueScene` : `talkTo` (se placer devant un PNJ ou un objet **accessible à pied dans l'état courant**, puis jouer son dialogue), `walkTo` (portail accessible, +5 min, dialogue d'arrivée), `playDialogue` (choix par politique, clavier du distributeur, téléportation, Mise à pied). Il sert aussi à fabriquer des sauvegardes de test pour vérifier une scène précise dans le navigateur.

```ts
// tests/GridMovement.test.ts
import { describe, expect, it } from 'vitest';
import { step } from '@/systems/movement/GridMovement';

describe('GridMovement.step', () => {
  const start = { tileX: 5, tileY: 5, facing: 'down' } as const;
  it('avance si la case est libre', () => {
    expect(step(start, 'right', () => false)).toEqual({ tileX: 6, tileY: 5, facing: 'right' });
  });
  it('tourne sans avancer contre un mur', () => {
    expect(step(start, 'up', () => true)).toEqual({ tileX: 5, tileY: 5, facing: 'up' });
  });
});
```

```ts
// tests/damage.test.ts — cas de référence du GDD
import { computeDamage } from '@/systems/combat/damage';
const noVariance = () => 0.5; // variance = 0.9 + 0.5 × 0.2 = 1.0
it('attaque simple : Force 10, puissance 100, DEF 5 → 15', () => {
  expect(computeDamage({ force: 10 }, { defense: 5 }, 100, { fatigue: 0, critical: false }, noVariance)).toBe(15);
});
```

---

## 4. Données typées (`src/data`)

Les données de gameplay sont écrites **en TypeScript** (`as const satisfies`) : vérifiées à la compilation, bundlées, sans `fetch`. Seules les cartes Tiled restent en JSON (produites par l'outil) dans `public/assets/tilemaps`. Chaque fichier exporte un type d'identifiant (`EnemyId`, `ItemId`…) dérivé des clés.

```ts
// src/data/enemies.ts
export interface EnemyDef {
  readonly name: string; readonly level: number; readonly maxHp: number; readonly force: number; readonly defense: number; readonly vitesse: number;
  readonly resistance: number;                          // 0–40, boss 50
  readonly skills: readonly { id: SkillId; weight: number; cooldown: number }[];
  readonly weakness?: SkillId | ItemId;
  readonly loot: readonly { itemId: ItemId; chance: number }[];
  readonly frame: string;                               // frame de l'atlas 'atlas-enemies'
}
export const ENEMIES = {
  'consultant-junior': { name: 'Consultant Junior « Slide-Ninja »', level: 2, maxHp: 22, force: 6,
    defense: 2, vitesse: 12, resistance: 10, weakness: 'question-concrete', frame: 'consultant-junior-idle-0',
    skills: [{ id: 'tempete-de-post-it', weight: 40, cooldown: 2 }, { id: 'synergie', weight: 20, cooldown: 3 }],
    loot: [{ itemId: 'expresso', chance: 0.25 }] },
  // 'manager-kpi' (Le Tableur), 'coach-agile' (Le Facilitateur), 'reorganisateur-rh' (élite,
  // faiblesse 'le-reglement'), 'gontran-vanderslide' (boss : 3 phases, compteur de signature 10 tours)…
} as const satisfies Record<string, EnemyDef>;
export type EnemyId = keyof typeof ENEMIES;
```

```ts
// src/data/items.ts
export type ItemEffect =
  | { kind: 'fatigue'; delta: number } | { kind: 'heal'; percent: number }
  | { kind: 'status'; status: StatusId; turns: number } | { kind: 'proof' };   // fragments du PHR-2030
export interface ItemDef {
  readonly name: string; readonly price: number;        // en Tickets (T)
  readonly category: 'consumable' | 'tenue' | 'outil' | 'accessoire' | 'key';
  readonly effects: readonly ItemEffect[]; readonly usableInBattle: boolean;
}
export const ITEMS = {
  'double-lungo': { name: 'Double lungo', price: 40, category: 'consumable', usableInBattle: true,
    effects: [{ kind: 'fatigue', delta: -30 }, { kind: 'status', status: 'cafeine', turns: 3 }] },
  'le-reglement': { name: 'Le Règlement', price: 0, category: 'key', usableInBattle: true,
    effects: [{ kind: 'status', status: 'bloque', turns: 2 }] },
  'fragment-phr-2030-1': { name: 'PHR-2030 — fragment 1', price: 0, category: 'key',
    usableInBattle: true, effects: [{ kind: 'proof' }] },
} as const satisfies Record<string, ItemDef>;
export type ItemId = keyof typeof ITEMS;
```

`src/data/skills.ts` suit le même modèle (`SkillDef` : `peCost`, `fatigueCost?`, `power?`, `ignoreDef?`, `target`, `effects?`, `usesPerBattle?`), par exemple `question-concrete` (×2 contre les consultants, annule l'invocation) ou `ponctualite-reelle` (brise le bouclier).

```ts
// src/data/dialogues/marcel-intro.ts — graphe de nœuds
export interface DialogueNode {
  readonly id: string; readonly speaker: CharacterId; readonly expression?: string;
  readonly text: string;                                  // clé de strings.ts à terme (i18n FR/NL/EN)
  readonly choices?: readonly { id: string; label: string; next: string; effects?: readonly DialogueEffect[] }[];
  readonly next?: string; readonly effects?: readonly DialogueEffect[];
}
export type DialogueEffect =
  | { kind: 'flag'; flag: string; value: boolean } | { kind: 'moral'; delta: number }
  | { kind: 'give'; itemId: ItemId; qty: number } | { kind: 'startBattle'; encounterId: EncounterId };
```

`src/data/maps.ts` ne contient que des métadonnées (`MapId` → `{ tilemapKey, music, zone }`) : `gare-mons`, `ville-centre`, `bag-mons-1` à `bag-mons-4`, `occ` ; le contenu des cartes est dans le JSON Tiled.

Un test de cohérence parcourt les données : chaque `next` de dialogue pointe vers un nœud existant, chaque `itemId`/`skillId` référencé existe, chaque `weakness` est valide.

---

## 5. Patterns et conventions

### 5.1 Nommage et constantes

- Classes et scènes en **PascalCase** (`BattleScene.ts`), fonctions et variables en camelCase, constantes en `UPPER_SNAKE_CASE`, fichiers d'assets et clés en **kebab-case**.
- Accessibilité explicite obligatoire (`public`/`private`/`protected`, règle ESLint), `override` sur les méthodes héritées de `Phaser.Scene`.
- **Aucune valeur magique dans une scène** : `GAME_WIDTH`, `GAME_HEIGHT`, `TILE_SIZE`, `PLAYER_SPEED` sont dans `src/config/constants.ts` ; à ajouter : `WORLD_ZOOM = 2`, `STEP_DURATION_MS = 150`, `CLOCK_MIN_PER_REAL_SEC = 0.125` (1 min in-game toutes les 8 s réelles, cf. GDD § 4), `SAVE_KEY_PREFIX = 'privatix.save'`. Les constantes d'équilibrage vont dans `src/config/balance.ts`.
- Clés : `SceneKeys`, `RegistryKeys`, `AssetKeys`, `Shift` sont des objets `as const` + type dérivé, jamais de chaîne littérale dans le code (`this.scene.start('Game')` est interdit en revue).
- Pas de `any`, pas de `!` (non-null assertion) : les données externes sont `unknown` puis affinées par des type guards (`src/utils/guards.ts`).

### 5.2 Pas de globales

ESLint interdit `window` et `globalThis`. Le `Phaser.Game` n'est jamais exposé ; l'état vit dans le registry, les notifications dans `eventBus` (singleton de module). Seule exception contrôlée : l'accès à `localStorage` (identifiant global nu, autorisé), encapsulé dans un unique adaptateur injecté au `SaveManager` (§7).

### 5.3 Cycle de vie et mémoire

Ce qui appartient à la scène (display list, `this.time`, `this.tweens`, input de scène) est nettoyé par Phaser au shutdown. Tout ce qui est attaché à un objet **qui survit à la scène** (registry, `eventBus`, `game.events`, autres scènes, DOM) doit être détaché explicitement. `GameScene` et `UIScene` le font déjà à la main (`off` dans un `once(SHUTDOWN)`). La cible factorise ce pattern :

```ts
// src/scenes/BaseScene.ts
export abstract class BaseScene extends Phaser.Scene {
  private readonly disposers: (() => void)[] = [];

  protected addDisposer(fn: () => void): void { this.disposers.push(fn); }

  protected listen<K extends keyof GameEvents>(event: K, fn: (...a: GameEvents[K]) => void): void {
    this.addDisposer(eventBus.on(event, fn, this));
  }

  protected registerLifecycle(): void { // à appeler en tête de create()
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.dispose, this);
  }

  private dispose(): void {
    this.tweens.killAll();          // pas de callback sur un objet détruit
    this.time.removeAllEvents();
    while (this.disposers.length > 0) this.disposers.pop()?.();
  }
}
```

Règles : `registry.events.on(...)` → `addDisposer(() => registry.events.off(..., this))` ; jamais `removeAllListeners()` sur un émetteur partagé ; objets éphémères (chiffres de dégâts, particules) détruits dans `onComplete` ou recyclés via un `Group` ; sons longs `sound.add()` → `destroy()` en sortie. Test manuel obligatoire : entrer/sortir trois fois d'un combat sans doublon d'événement.

### 5.4 Entrées

En place (M1) : `GameScene` enregistre les deux dispositions par `KeyCodes` : **Z ou W** (haut), **S** (bas), **Q ou A** (gauche), **D** (droite), plus les flèches ; Maj pour courir ; E / Espace / Entrée pour interagir ; Échap pour le menu. Les dialogues acceptent les mêmes touches de validation, haut/bas et 1 à 4 pour les choix ; le clavier du distributeur prend 1/2/3, Retour arrière, Entrée et Échap. Sur tactile, `VirtualPad` (D-pad + A) écrit dans le registry (`VirtualDir`, `VirtualAction`) et `GameScene` le lit comme le clavier. Chaque scène ignore la validation pendant `INPUT_GRACE_MS` après son ouverture ou sa reprise, pour qu'une même touche ne ferme pas un dialogue et n'en rouvre pas un autre.

Cible : un `InputManager` (`src/ui/InputManager.ts`) qui lit **`KeyboardEvent.code`** (position physique) et traduit en actions abstraites (`up`, `down`, `left`, `right`, `confirm`, `cancel`, `menu`, `inventory`, `run`…), avec remappage et manette.

```ts
const DEFAULT_BINDINGS: Record<InputAction, readonly string[]> = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  confirm: ['Enter', 'Space', 'KeyE'], cancel: ['Escape', 'Backspace', 'KeyX'],
  menu: ['Escape', 'Tab'], inventory: ['KeyI'], run: ['ShiftLeft', 'ShiftRight'],
};
```

### 5.5 UI (`src/ui`)

Tous les composants héritent de `Phaser.GameObjects.Container`, reçoivent un `theme: 'sncb' | 'occ'`, s'enregistrent auprès du `FocusManager` et ne contiennent **aucune règle de jeu** (ils lisent un modèle et émettent des intentions).

| Classe | Rôle |
|---|---|
| `NineSlicePanel` | Panneau extensible (`scene.add.nineslice`), variantes `default`/`board`/`danger`/`rebel`, base de tous les autres. |
| `UIButton` | États normal/survol/focus/pressé/désactivé, cible tactile ≥ 52×52 px logiques. |
| `Gauge` | Jauge animée avec barre fantôme ; préréglages `hp`, `pe`, `fatigue` (seuils 40/70/90). |
| `DialogueBox` | Portrait, nom, texte lettre à lettre, pagination, `play(lines): Promise<string \| void>`. |
| `ActionMenu` | Liste/grille navigable (wrap, coûts PE/Fatigue/minutes, éléments désactivés avec raison). |
| `Clock3x8` | Vue de l'horloge et du cycle 3×8 ; lit un `TimeService`, n'en modifie jamais l'état. |

Soutien : `FocusManager`, `InputManager`, `VirtualPad`, `FloatingText`, `Toast`, `theme.ts` (palette et typographie).

État M1 : `Gauge`, `Clock3x8`, `VirtualPad` et `PlaceholderTextures` existent. La boîte de dialogue, les choix et les bandeaux sont encore codés dans `DialogueScene` et `UIScene` : à extraire en `DialogueBox`, `ActionMenu` et `Toast` quand une deuxième scène en aura besoin (Battle).

### 5.6 Résolution et rendu

Résolution logique **960×540**, `render: { pixelArt: true, roundPixels: true }` (emplacement Phaser 4 ; `roundPixels` vaut `false` par défaut en v4), `scale.mode: FIT` + `CENTER_BOTH` (`src/main.ts`), canvas en `image-rendering: pixelated`. Tuiles de 16 px ; en exploration la caméra de `Game` passe en `setZoom(WORLD_ZOOM)` (≈ 30×17 tuiles visibles) avec `startFollow` et `setBounds` ; les overlays restent en zoom 1. Textes positionnés sur des coordonnées entières. Le zoom entier calculé en pixels physiques proposé par l'UX est une évolution possible, FIT reste la règle tant qu'il n'est pas implémenté. Point d'attention Phaser 4 : l'arrondi des sommets (`vertexRoundMode: 'safeAuto'` par défaut) est ignoré quand la caméra est zoomée ; si des coutures ou un scintillement apparaissent au `WORLD_ZOOM` ×2, passer les sprites du monde en `vertexRoundMode = 'fullAuto'` (voir `node_modules/phaser/docs/Phaser 4 Pixel Art Guide`).

---

## 6. Gestion des assets

### 6.1 `asset-pack.json`

Un manifeste unique, `public/assets/asset-pack.json`, chargé par `PreloaderScene` via `this.load.pack(AssetKeys.AssetPack, 'assets/asset-pack.json')`. Il est **vide** aujourd'hui (`"main": { "files": [] }`) avec une section `meta` ignorée par le loader. On peut le découper en sections (`main`, `battle`, `bag`) si le poids augmente. Format cible :

```json
{
  "main": {
    "path": "assets/",
    "files": [
      { "type": "image", "key": "img-logo", "url": "images/ui/logo.png" },
      { "type": "image", "key": "tiles-gare", "url": "images/tilesets/tiles-gare.png" },
      { "type": "spritesheet", "key": "ss-hero-leon", "url": "images/characters/hero-leon.png",
        "frameConfig": { "frameWidth": 16, "frameHeight": 24 } },
      { "type": "atlas", "key": "atlas-enemies",
        "textureURL": "images/atlases/enemies.png", "atlasURL": "images/atlases/enemies.json" },
      { "type": "atlas", "key": "atlas-ui",
        "textureURL": "images/atlases/ui.png", "atlasURL": "images/atlases/ui.json" },
      { "type": "tilemapTiledJSON", "key": "map-gare-mons", "url": "tilemaps/gare-mons.json" },
      { "type": "audio", "key": "bgm-gare-mons",
        "url": ["audio/bgm/bgm-gare-mons.ogg", "audio/bgm/bgm-gare-mons.mp3"] },
      { "type": "audio", "key": "sfx-composteur",
        "url": ["audio/sfx/composteur.ogg", "audio/sfx/composteur.mp3"] },
      { "type": "bitmapFont", "key": "font-pixel-body",
        "textureURL": "fonts/pixel-body.png", "fontDataURL": "fonts/pixel-body.xml" }
    ]
  },
  "meta": { "app": "Privatix", "version": "1" }
}
```

Toute clé du pack a son entrée dans `AssetKeys` (`src/config/constants.ts`, déjà `AssetPack: 'asset-pack'` et `Logo: 'img-logo'`). Un test Vitest lit le JSON et vérifie la correspondance dans les deux sens. Audio en OGG + MP3 (Safari), atlas au format JSON Hash (padding 2 px, sans rotation). Le loader journalise les erreurs (`FILE_LOAD_ERROR` → `console.error`). Détails de production : `docs/ASSETS_GUIDE.md`.

### 6.2 Tilemaps Tiled

> **État M1 : cartes ASCII placeholder.** En attendant les cartes Tiled, `src/data/maps.ts` décrit chaque carte en ASCII : un caractère de `TERRAIN_CHARS` par terrain, une lettre par marqueur (point d'arrivée, portail, PNJ, objet, déclencheur, voir `src/data/types.ts`). `buildWorldMap` en fait une `WorldMap` et `MapView` l'affiche avec un tileset généré (`tiles-placeholder`). `tests/data.test.ts` vérifie chaque carte : marqueurs, portails, et accessibilité de chaque PNJ, objet et portail depuis chaque point d'arrivée. Pour passer à Tiled : écrire un adaptateur pur Tiled JSON → `WorldMap` (même interface), et faire dessiner les calques Tiled par `MapView`. `GameScene` et les tests de praticabilité ne changent pas.

- Tiled ≥ 1.10, export **JSON**, orthogonal, tuiles 16×16.
- **Tilesets embarqués** dans la carte (Phaser ne lit pas les `.tsx` externes) ; nom du tileset dans Tiled = clé d'image Phaser.
- Tilesets **extrudés** (`tile-extruder`, marge 1, espacement 2) pour éviter les coutures au zoom ×2.
- Calques : `ground`, `decor`, `above` (au-dessus du joueur), `collision` (propriété booléenne `collides`), calque d'objets `objects` : `player-spawn`, `npc` (`npcId`, `dialogueId`), `door` (`targetMap`, `targetSpawn`), `encounter-zone` (`encounterTable`, `shifts`), `trigger` (`flag`, `cutscene`), `save-point`.
- Les propriétés d'objets sont lues par un parseur pur (`src/systems/map/parseObjects.ts`) qui renvoie des types discriminés, testé avec un extrait de JSON.

```ts
const map = this.make.tilemap({ key: AssetKeys.MapGareMons });
const tiles = map.addTilesetImage('tiles-gare', AssetKeys.TilesetGare, 16, 16, 1, 2);
if (!tiles) throw new Error('Tileset introuvable dans la carte');
map.createLayer('ground', tiles);
const collision = map.createLayer('collision', tiles)?.setVisible(false);
const isBlocked: IsBlocked = (tx, ty) =>
  (collision?.getTileAt(tx, ty)?.properties as { collides?: boolean } | undefined)?.collides === true;
```

### 6.3 Nommage

Fichiers en kebab-case ASCII sans accents (`gare-mons.json`, `consultant-junior.png`). Clé = **préfixe de type** + nom : `img-`, `ss-`, `atlas-`, `tiles-`, `map-`, `bgm-`, `sfx-`, `font-` (référence : docs/ASSETS_GUIDE.md § 4). Frames d'atlas `{entite}-{action}-{direction}-{index}` (`leon-walk-down-0`), animations `anim-leon-walk-down` créées une seule fois dans le Preloader.

---

## 7. Sauvegarde

- Emplacements : `privatix.save.slot-1..3` et `privatix.save.auto` ; réglages séparés dans `privatix.settings`.
- Sauvegarde manuelle à la **machine à café de l'OCC** ; autosave à l'entrée de l'OCC et après chaque combat.
- Chaque sauvegarde porte `version` ; au chargement, chaîne de migrations `vN → vN+1` jusqu'à la version courante, puis type guard. Une sauvegarde corrompue n'écrase rien.
- `localStorage` peut lever (navigation privée, quota, stockage bloqué) : tout est en `try/catch` et le stockage est **injecté** (testable en Node).

**Format en place (v2, jalon M2).** La v2 ajoute au GameState l'XP du héros, les PV/PE conservés des collègues, l'inventaire commun, les Gobelets, les Grains et les groupes d'ennemis vaincus ; `MIGRATIONS[1]` convertit une sauvegarde v1 (valeurs par défaut, inventaire de départ). Historique : aucune sauvegarde n'ayant existé avant M1, la v1 était directement le GameState complet : `{ savedAt, state }`, où `state` contient l'horloge et la Fatigue, le joueur, la position, les drapeaux, le Moral, les Tickets, la boisson de relève et le niveau de la machine. Emplacements : `privatix.save.slot-1` (Vieille Dame) et `privatix.save.auto` (entrée de l'OCC) ; « Continuer » charge le plus récent. `SaveManager` (`src/systems/save/`) ne lève jamais, valide avec `isGameState`, refuse une version future, et applique `MIGRATIONS` (vide aujourd'hui) pour les versions antérieures. `src/platform/storage.ts` est le seul accès à `localStorage`. Le schéma v2 « aplati » envisagé avant M1 est abandonné : on incrémente `GameState.version` et on ajoute une migration à la première modification incompatible.

Tests : aller-retour save/load avec un `Map` en mémoire, migration v1 → v2 à partir de `createInitialGameState()`, JSON invalide, version future, stockage qui lève, `storage === null`.

---

## 8. Déploiement Coolify

### 8.1 Build de production

`vite build` (base `'./'`, chemins relatifs) produit :
- `dist/index.html` ;
- `dist/bundle/` : bundles **hashés** (`assetsDir: 'bundle'`), Phaser isolé dans son propre chunk (`manualChunks`) pour rester en cache entre deux déploiements ;
- `dist/assets/` : copie **non hashée** de `public/assets` (pack, images, cartes, audio, polices).

Séparer `bundle/` et `assets/` permet deux politiques de cache distinctes dans nginx.

### 8.2 `Dockerfile` (multi-stage)

1. **build** — `node:22-alpine` : copie `package.json` + `package-lock.json` seuls, `npm ci --no-audit --no-fund` (couche en cache tant que le lockfile ne change pas ; pas besoin de `--legacy-peer-deps`), puis copie des sources et `npm run build` (typecheck inclus : un code qui ne compile pas ne se déploie pas).
2. **runtime** — `nginx:stable-alpine` : `nginx.conf` → `/etc/nginx/conf.d/default.conf`, `dist/` → `/usr/share/nginx/html`, `EXPOSE 80`, `HEALTHCHECK` qui interroge `http://127.0.0.1/healthz` avec `wget` toutes les 30 s. Image finale sans Node.

### 8.3 `nginx.conf` expliqué

| Bloc | Comportement | Raison |
|---|---|---|
| `gzip` | JS, CSS, JSON, XML, SVG (≥ 1 Ko) | Cartes Tiled et atlas JSON très compressibles ; PNG/OGG déjà compressés. |
| `X-Content-Type-Options`, `Referrer-Policy` | En-têtes de sécurité | `add_header` dans un `location` annule ceux du `server`, d'où la répétition de `nosniff`. |
| `location = /healthz` | `200 ok`, sans log | Healthcheck Docker et Coolify sans dépendre du jeu. |
| `location /bundle/` | `max-age=31536000, immutable` | Fichiers hashés : un nouveau build = nouveaux noms. |
| `location /assets/` | `max-age=86400, must-revalidate` + `try_files $uri =404` | Assets non hashés revalidés par ETag ; **pas de fallback SPA** : un asset manquant doit renvoyer 404, sinon Phaser recevrait du HTML au lieu d'un JSON/PNG. |
| `location = /index.html` | `no-cache` | Toujours revalidé pour pointer vers les nouveaux bundles après déploiement. |
| `location /` | `try_files $uri $uri/ /index.html` | Fallback SPA. |

**`.dockerignore`** exclut `node_modules`, `dist`, `coverage`, `.vite` (reconstruits dans l'image), `.git`, `.github`, éditeurs, logs, **`.env*`** (aucun secret dans l'image), `Dockerfile`, `docs`, `*.md` et `assets-src` (sources des graphistes : `.aseprite`, `.tmx` de travail, `.wav`). Seul `public/assets` est livré.

### 8.4 Procédure Coolify

1. **New Resource → Application** depuis le dépôt Git (GitHub App ou clé de déploiement), branche `main`.
2. **Build Pack : Dockerfile** (à la racine), aucun argument de build ni variable d'environnement nécessaire.
3. **Ports Exposes : `80`** (pas de mapping de port public : le proxy de Coolify route).
4. **Domains : `https://privatix.fs0ciety.org`** ; certificat TLS Let's Encrypt géré par le proxy de Coolify (enregistrement DNS A/AAAA vers le serveur au préalable).
5. **Health Check** : activé, chemin `/healthz`, port 80, code attendu 200 (le `HEALTHCHECK` du Dockerfile sert aussi).
6. **Auto Deploy** : activé sur push de `main` (webhook). Les PR peuvent avoir des déploiements de prévisualisation si besoin.

### 8.5 Vérification post-déploiement

```bash
curl -fsS https://privatix.fs0ciety.org/healthz                    # -> ok
curl -sI https://privatix.fs0ciety.org/ | grep -i cache-control     # -> no-cache
curl -sI https://privatix.fs0ciety.org/assets/asset-pack.json       # -> 200, max-age=86400
curl -sI https://privatix.fs0ciety.org/assets/inexistant.png        # -> 404 (pas d'index.html)
```

Puis test fumée dans un navigateur : chargement, menu, entrée en jeu, HUD, aucune erreur console, onglet Réseau sans 404. Retour arrière : redéployer le commit précédent depuis Coolify.

---

## 9. Qualité

### 9.1 Scripts

`npm run check` (typecheck + lint + tests) en local avant chaque push ; `npm run format:check` et `npm run build` en CI. Le lint affiche des avertissements (`no-unnecessary-condition`, `no-console`) sans échouer ; la CI ajoute `--max-warnings=0`.

### 9.2 Règles ESLint « garde-fous » (déjà actives)

| Règle | Portée | But |
|---|---|---|
| `no-restricted-imports` (`phaser`) | `src/systems`, `src/data`, `src/utils` | Logique pure, testable en Node. |
| `no-restricted-syntax` sur `MethodDefinition[key.name='preload']` | `src/scenes/**` sauf `PreloaderScene.ts` | Un seul point de chargement : le pack. |
| `no-restricted-globals` (`window`, `globalThis`) | partout | Pas d'état global ni de fuite du `Game`. |
| `no-explicit-any`, `no-non-null-assertion` | partout | Typage honnête. |
| `consistent-type-imports` | partout | Compatible `verbatimModuleSyntax`. |
| `explicit-member-accessibility` | partout | `public`/`private` explicites. |
| `unbound-method` **désactivée** | partout | Pattern Phaser `emitter.on(event, this.handler, this)` : le contexte est passé explicitement. |
| `eqeqeq`, `prefer-const`, `restrict-template-expressions` (nombres permis) | partout | Hygiène. |

Base : `js.configs.recommended` + `tseslint.configs.strictTypeChecked` + `stylisticTypeChecked`, `projectService: true` ; `vite.config.ts` et `eslint.config.js` sans règles typées.

### 9.3 CI GitHub Actions proposée

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npx eslint src tests --max-warnings=0
      - run: npm run format:check
      - run: npm test
      - run: npm run build
  docker:
    needs: check
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t privatix:ci .
      - run: docker run -d -p 8080:80 privatix:ci && sleep 3 && curl -fsS http://localhost:8080/healthz
```

### 9.4 Ajouter une feature : interface → logique → intégration

1. **Issue** : règle de jeu + critères d'acceptation (ex. « le Double lungo retire 30 de Fatigue et donne Caféiné 3 tours »).
2. **Branche** `feat/<sujet>` depuis `main`.
3. **Interface et données** : types dans `src/systems/...` et entrée dans `src/data/` ; le compilateur signale tous les usages.
4. **Logique pure + tests** dans `src/systems/` et `tests/` ; RNG seedé ; cas de référence du GDD.
5. **Intégration** : scène ou composant `src/ui` (input → système → `GameState` → animation/EventBus) ; assets dans `public/assets` + `asset-pack.json` + `AssetKeys`.
6. **Nettoyage** : abonnements via `listen()`/`addDisposer()`, aller-retour de scène ×3 sans doublon.
7. `npm run check`, PR, CI verte, une approbation, merge squash → Coolify redéploie → test fumée.

### 9.5 Checklist de PR

- [ ] `npm run check` et `npm run build` passent ; aucun nouvel avertissement ESLint.
- [ ] Aucune chaîne littérale de scène, registry ou asset : tout passe par `SceneKeys` / `RegistryKeys` / `AssetKeys`.
- [ ] Aucune règle de jeu dans une scène ou un composant UI ; nouvelle logique couverte par des tests.
- [ ] Pas de `Math.random()` dans `src/systems` (RNG injecté).
- [ ] Tout listener sur un émetteur partagé est retiré au `SHUTDOWN` ; tweens/timers arrêtés.
- [ ] Nouvel asset : kebab-case, préfixe de type, déclaré dans le pack et `AssetKeys`, source dans `assets-src`.
- [ ] Changement du format de sauvegarde : `CURRENT_SAVE_VERSION` incrémentée + migration + test.
- [ ] Textes FR dans `src/data/strings.ts` ; seuils et valeurs conformes au canon (Fatigue 40/70/90/100, Moral 40/60).
- [ ] Testé au clavier (AZERTY et QWERTY) et au tactile si la feature a de l'UI.

---

## 10. Dette connue / TODO

| # | Sujet | État actuel | Cible / action |
|---|---|---|---|
| 1 | **Déplacement** | Fait (M1) : `GridMovement` pur + `Player` sprite sur grille (tween, course), physique Arcade retirée. | `InputManager` (`KeyboardEvent.code`, remappage, manette). |
| 2 | **Palette** | Fait : `src/config/colors.ts` suit la palette UX par thème (`sncb`, `occ`, `gauge`, `shift`), `index.html` aligné. | — |
| 3 | **Pack d'assets vide** | `asset-pack.json` sans fichier ; `AssetKeys.Logo` déclaré mais non chargé ; dossiers `images/ audio/ tilemaps/ fonts/` vides. | Remplir au fil des livraisons (§6), ajouter le test de cohérence pack ↔ `AssetKeys`, créer les animations dans le Preloader. |
| 4 | **Polices** | `fontFamily: 'monospace'` partout. | BitmapFont (Press Start 2P pour titres/chiffres, Pixelify Sans ou m6x11 pour le texte) via `bitmapText` ; en prototype WebFont, attendre `document.fonts.ready` avant la première scène. Corps de texte ≥ 16 px logiques. |
| 5 | **État** | Fait (M1) : GameState complet (position, drapeaux, Moral, Tickets, boisson, machine), Nouvelle partie repart d'un état neuf. | — |
| 5b | **Effondrement** | Fait hors combat : Fatigue 100 → Mise à pied (GDD § 5.8). Défaite en combat → Mise à pied. | Acte III : retour à la dernière sauvegarde du BAG. |
| 6 | **Systèmes** | `GameState`, `FatigueClock`, `WorldMap`, `GridMovement`, `Conditions`, `DialogueRunner`/`Effects`, `Objectives`, `Layoff`, `VendingCode`, `SaveManager`. | `CombatEngine` (M2, consommera `fatigueTier` et `finishCombat`), `Inventory` (Thermos, Gobelets), `rng` ; décider du sort de l'EventBus. |
| 7 | **Scènes** | `Dialogue` et `Battle` existent ; l'OCC est une carte (pas de scène `Occ`). Pause absente ; Échap renvoie au menu. | Pause « Classeur de service » (inventaire, équipe, compétences) ; Échap ouvre `Pause`. |
| 8 | **UI** | HUD complet (statut, horloge, invite, bandeaux), `VirtualPad`. Boîte de dialogue et bandeaux codés dans les scènes ; pas de portrait. | Extraire `DialogueBox`, `ActionMenu`, `Toast` ; portraits ; `NineSlicePanel` quand les assets UI arrivent. |
| 9 | **Outillage** | Pas de CI, pas de `.nvmrc`, lint sans `--max-warnings=0`, pas de couverture. | Workflow §9.3, `.nvmrc` = `22`, `@vitest/coverage-v8` sur `src/systems`, `src/data`, `src/utils`. |
| 10 | **nginx** | Fait : `Referrer-Policy` répété dans chaque `location`. | Envisager une CSP stricte (aucun script externe). |
| 12 | **Cartes** | Cartes ASCII placeholder (§6.2). | Cartes Tiled + adaptateur Tiled → `WorldMap`. |
| 13 | **Combats** | Fait (M2) : moteur pur, BattleScene, 4 combats scénarisés et 4 groupes visibles de l'Acte I. | Choix de l'équipe à l'OCC (aujourd'hui : les deux premiers recrutés), boutique, équipement, Décalage et boss final (Actes II-III). |
| 14 | **Contenu Acte I hors M1** | Fil principal et « Trois tasses, trois collègues » jouables. | Notes de service, pigeon Matricule 4412, quête du Wagon-Bar, boutique de Béné, Gobelets de l'OCC, pointeuse. |
| 11 | **Installation** | `npm install` exige `--legacy-peer-deps` (bug npm 10 avec les peers de vitest 4). | Retirer le flag de la documentation quand npm ou vitest le corrigent ; `npm ci` reste la référence. |
