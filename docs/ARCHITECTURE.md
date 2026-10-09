# Privatix — Architecture technique

> RPG 2D pixel-art au tour par tour (gare de Mons, lutte contre la privatisation du rail belge).
> Site statique servi par nginx dans un conteneur Docker, déployé par Coolify sur **https://privatix.fs0ciety.org**.
> Ce document décrit le **scaffolding tel qu'il existe** (validé : typecheck, lint, tests, build OK) et la **cible** vers laquelle on le fait évoluer. En cas de doute, le code du dépôt fait foi, puis ce document, puis les dossiers de conception.

---

## 1. Vue d'ensemble

### 1.1 Stack et versions réelles

| Brique | Version (`package.json`) | Pourquoi |
|---|---|---|
| **Phaser** | `^3.90.0` | Dernière v3, gelée et stable : scènes parallèles (exploration + HUD + dialogue), tilemaps Tiled natives, atlas, tweens, audio WebAudio, input clavier/manette/tactile, types TS livrés. Phaser 4 est écarté pour l'instant (écosystème en rattrapage) ; la séparation logique/présentation (§3) rendra une migration peu coûteuse. |
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
│  ├─ config/                 # constants.ts (SceneKeys, RegistryKeys, AssetKeys, Shift), colors.ts
│  ├─ scenes/                 # BootScene, PreloaderScene, MainMenuScene, GameScene, UIScene
│  ├─ entities/               # Player.ts (placeholder Arcade, voir §10)
│  ├─ systems/                # LOGIQUE PURE, sans Phaser : GameState.ts
│  ├─ ui/                     # (vide) composants Container réutilisables
│  ├─ data/                   # (vide) données de jeu typées
│  └─ utils/                  # math.ts (clamp)
├─ tests/                     # GameState.test.ts (src/**/*.test.ts est aussi accepté)
├─ docs/                      # documentation (exclue de l'image Docker)
├─ vite.config.ts  tsconfig.json  eslint.config.js  .prettierrc  .editorconfig
└─ Dockerfile  nginx.conf  .dockerignore  package.json  package-lock.json
```

Cible (ajouts uniquement, l'existant ne bouge pas) :

```
src/
├─ scenes/      + BattleScene, DialogueScene, OccScene, PauseScene, BaseScene (abstraite)
├─ entities/    + Npc.ts ; Player.ts réécrit en sprite piloté par GridMovement
├─ systems/     + combat/CombatEngine.ts, time/TimeService.ts (FatigueClock), inventory/Inventory.ts,
│                 save/{SaveManager,schema,migrations}.ts, movement/GridMovement.ts, MoralMeter.ts,
│                 events/EventBus.ts (implémentation pure, sans Phaser)
├─ ui/          + NineSlicePanel, UIButton, Gauge, DialogueBox, ActionMenu, Clock3x8,
│                 FocusManager, InputManager, VirtualPad, FloatingText, Toast, theme.ts
├─ data/        + balance.ts, enemies.ts, items.ts, skills.ts, maps.ts, strings.ts, dialogues/*.ts
├─ utils/       + rng.ts (RNG seedé), guards.ts (type guards), registry.ts (accès typé)
└─ platform/    + storage.ts (adaptateur localStorage, seul accès navigateur hors Phaser)
```

---

## 2. Architecture des scènes

### 2.1 Scènes existantes et cibles

| Scène (`SceneKeys`) | Statut | Rôle |
|---|---|---|
| `Boot` | existe | Crée le `GameState` initial dans le registry, puis `start(Preloader)`. Aucun asset. |
| `Preloader` | existe | **Seule** scène qui charge : `this.load.pack(AssetKeys.AssetPack, 'assets/asset-pack.json')` + barre de progression en rectangles. Cible : créer aussi les animations globales. |
| `MainMenu` | existe | Titre « PRIVATIX », « Le rail ne se vend pas. », Entrée/toucher → `start(Game)`. Cible : Nouvelle partie / Continuer / Options, style tableau des départs. |
| `Game` | existe | Exploration (placeholder). Lance `UI` en parallèle, la stoppe au `SHUTDOWN`. Échap → menu (cible : ouvre `Pause`). |
| `UI` | existe | Overlay HUD : écoute `registry.events` `CHANGE_DATA` et affiche horloge, pause 3×8, PV, Fatigue. Aucune logique de jeu. |
| `Battle` | cible | Combat au tour par tour ; affichage + input, toute la règle dans `CombatEngine`. |
| `Dialogue` | cible | Overlay `DialogueBox` réutilisable depuis Game, Occ et Battle. |
| `Occ` | cible | Hub clandestin (ancienne lampisterie) : machine à café = sauvegarde + soin + café gratuit 1×/pause, comptoir, équipe. |
| `Pause` | cible | « Classeur de service » : inventaire, équipe, compétences, options, quitter. |

Les clés sont des objets `as const` (pas des `enum` TS) dans `src/config/constants.ts` ; on étend le même objet :

```ts
export const SceneKeys = {
  Boot: 'Boot', Preloader: 'Preloader', MainMenu: 'MainMenu', Game: 'Game', UI: 'UI',
  Battle: 'Battle', Dialogue: 'Dialogue', Occ: 'Occ', Pause: 'Pause', // cibles
} as const;
export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];
```

L'ordre du tableau `scene` de `main.ts` est l'ordre de rendu : les overlays (`UI`, `Dialogue`, `Pause`) sont déclarés **en dernier**.

### 2.2 Flux

```
Boot ─start─▶ Preloader ─start─▶ MainMenu ─start({mode})─▶ Game ═launch═▶ UI (HUD, parallèle)
                                     ▲                       │
                                     └──── start (Quitter) ──┤
   ┌─────────────────────────────────────────────────────────┤
   │ sleep(UI)+sleep(Game)+launch(Battle,{encounterId})      ├──▶ Battle ─stop + wake(UI) + wake(Game, outcome)
   │ pause(Game)+launch(Dialogue,{dialogueId, caller})       ├──▶ Dialogue ─stop + resume(caller)
   │ switch(Occ)  (UI mise en sleep)                         ├──▶ Occ ─switch(Game)
   │ pause(Game)+launch(Pause)                               └──▶ Pause ─stop + resume(Game)
   └ Défaite (« Mise à pied ») : Battle ─stop─▶ wake(Game, {result:'defeat'}) ─▶ switch(Occ)
```

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
| `GameState` (existe) | Agrégat sérialisable : horloge, joueur ; `shiftAt`, `shiftLabel`, `formatClock`. | Boot (création), toutes les scènes (lecture) |
| `TimeService` / `FatigueClock` | Horloge in-game (1 s réelle = 1 min, figée en menu/dialogue/combat), changements de poste 06/14/22 h, fenêtres de pause café, Fatigue passive (+2/+3/+5 par heure selon le poste), paliers. | `GameScene.update(delta)`, `Clock3x8` |
| `CombatEngine` | Initiative, toucher, critique, dégâts, statuts, fuite, IA ennemie, compteur de signature du boss. | `BattleScene` |
| `Inventory` | Quantités, plafonds, consommables, équipement (3 emplacements), Tickets, Grains de café. | Battle, Pause, Occ |
| `GridMovement` | Déplacement case par case (16 px), collisions via un prédicat injecté, orientation. | `Player` |
| `MoralMeter` | Jauge collective 0–100 : crit `floor(Moral/5)`, résistance `min(60, floor(Moral/2))`, fin (≥ 60), phase 3 du boss (< 40). | Battle, dialogues, fins |
| `SaveManager` | localStorage versionné + migrations (§7). | Boot, Occ, Pause |

Seuils de Fatigue (canon) : **Frais 0–39, Fatigué 40–69, Épuisé 70–89, Burn-out 90–99, Effondré 100**. Toutes les constantes d'équilibrage vivent dans `src/data/balance.ts`.

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
// src/systems/time/TimeService.ts
export type FatigueTierId = 'frais' | 'fatigue' | 'epuise' | 'burn-out' | 'effondre';
export interface TimeState { day: number; minuteOfDay: number; fatigue: number; frozen: boolean }
export interface TimeService {          // callbacks onTick/onShiftChange/onFatigueChange relayés vers eventBus par la scène
  readonly state: Readonly<TimeState>;
  advanceReal(deltaMs: number): void;      // exploration seulement
  advanceGame(minutes: number): void;      // coûts fixes : combat +15, zone +10, sieste +120
  addFatigue(delta: number, mult?: number): void;
  setFrozen(frozen: boolean): void;        // menus, dialogues, combats
  isCoffeeBreak(): boolean;                // fenêtre de pause café ouverte
}
export function fatigueTier(f: number): FatigueTierId {
  if (f >= 100) return 'effondre';
  if (f >= 90) return 'burn-out';
  if (f >= 70) return 'epuise';
  if (f >= 40) return 'fatigue';
  return 'frais';
}
```

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
- **Aucune valeur magique dans une scène** : `GAME_WIDTH`, `GAME_HEIGHT`, `TILE_SIZE`, `PLAYER_SPEED` sont dans `src/config/constants.ts` ; à ajouter : `WORLD_ZOOM = 2`, `STEP_DURATION_MS = 150`, `CLOCK_MIN_PER_REAL_SEC = 1`, `SAVE_KEY_PREFIX = 'privatix.save'`. Les constantes d'équilibrage vont dans `src/data/balance.ts`.
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

Le placeholder actuel utilise `KeyCodes.Z/Q/S/D` + flèches. Cible : un `InputManager` (`src/ui/InputManager.ts`) qui lit **`KeyboardEvent.code`** (position physique) : `KeyW KeyA KeyS KeyD` = **ZQSD en AZERTY et WASD en QWERTY**, sans réglage. Il traduit en actions abstraites (`up`, `down`, `left`, `right`, `confirm`, `cancel`, `menu`, `inventory`, `run`, `tabPrev`, `tabNext`, `log`) consommées par les scènes ; remappage et manette s'y branchent.

```ts
const DEFAULT_BINDINGS: Record<InputAction, readonly string[]> = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  confirm: ['Enter', 'Space', 'KeyE'], cancel: ['Escape', 'Backspace', 'KeyX'],
  menu: ['Escape', 'Tab'], inventory: ['KeyI'], run: ['ShiftLeft', 'ShiftRight'],
  tabPrev: ['KeyQ', 'PageUp'], tabNext: ['KeyR', 'PageDown'], log: ['KeyL'],
};
// scene.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.dispatch(e.code)) — retiré au shutdown
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

### 5.6 Résolution et rendu

Résolution logique **960×540**, `pixelArt: true`, `roundPixels: true`, `scale.mode: FIT` + `CENTER_BOTH` (`src/main.ts`), canvas en `image-rendering: pixelated`. Tuiles de 16 px ; en exploration la caméra de `Game` passe en `setZoom(WORLD_ZOOM)` (≈ 30×17 tuiles visibles) avec `startFollow` et `setBounds` ; les overlays restent en zoom 1. Textes positionnés sur des coordonnées entières. Le zoom entier calculé en pixels physiques proposé par l'UX est une évolution possible, FIT reste la règle tant qu'il n'est pas implémenté.

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
      { "type": "image", "key": "tileset-gare", "url": "tilemaps/tileset-gare.png" },
      { "type": "spritesheet", "key": "sheet-leon", "url": "images/characters/leon.png",
        "frameConfig": { "frameWidth": 16, "frameHeight": 24 } },
      { "type": "atlas", "key": "atlas-enemies",
        "textureURL": "images/atlases/enemies.png", "atlasURL": "images/atlases/enemies.json" },
      { "type": "atlas", "key": "atlas-ui",
        "textureURL": "images/atlases/ui.png", "atlasURL": "images/atlases/ui.json" },
      { "type": "tilemapTiledJSON", "key": "map-gare-mons", "url": "tilemaps/gare-mons.json" },
      { "type": "audio", "key": "music-gare-mons",
        "url": ["audio/music/gare-mons.ogg", "audio/music/gare-mons.mp3"] },
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

- Tiled ≥ 1.10, export **JSON**, orthogonal, tuiles 16×16.
- **Tilesets embarqués** dans la carte (Phaser ne lit pas les `.tsx` externes) ; nom du tileset dans Tiled = clé d'image Phaser.
- Tilesets **extrudés** (`tile-extruder`, marge 1, espacement 2) pour éviter les coutures au zoom ×2.
- Calques : `ground`, `decor`, `above` (au-dessus du joueur), `collision` (propriété booléenne `collides`), calque d'objets `objects` : `player-spawn`, `npc` (`npcId`, `dialogueId`), `door` (`targetMap`, `targetSpawn`), `encounter-zone` (`encounterTable`, `shifts`), `trigger` (`flag`, `cutscene`), `save-point`.
- Les propriétés d'objets sont lues par un parseur pur (`src/systems/map/parseObjects.ts`) qui renvoie des types discriminés, testé avec un extrait de JSON.

```ts
const map = this.make.tilemap({ key: AssetKeys.MapGareMons });
const tiles = map.addTilesetImage('tileset-gare', AssetKeys.TilesetGare, 16, 16, 1, 2);
if (!tiles) throw new Error('Tileset introuvable dans la carte');
map.createLayer('ground', tiles);
const collision = map.createLayer('collision', tiles)?.setVisible(false);
const isBlocked: IsBlocked = (tx, ty) =>
  (collision?.getTileAt(tx, ty)?.properties as { collides?: boolean } | undefined)?.collides === true;
```

### 6.3 Nommage

Fichiers en kebab-case ASCII sans accents (`gare-mons.json`, `consultant-junior.png`). Clé = **préfixe de type** + nom : `img-`, `sheet-`, `atlas-`, `tileset-`, `map-`, `music-`, `sfx-`, `font-`. Frames d'atlas `{entite}-{action}-{direction}-{index}` (`leon-walk-down-0`), animations `anim-leon-walk-down` créées une seule fois dans le Preloader.

---

## 7. Sauvegarde

- Emplacements : `privatix.save.slot-1..3` et `privatix.save.auto` ; réglages séparés dans `privatix.settings`.
- Sauvegarde manuelle à la **machine à café de l'OCC** ; autosave à l'entrée de l'OCC et après chaque combat.
- Chaque sauvegarde porte `version` ; au chargement, chaîne de migrations `vN → vN+1` jusqu'à la version courante, puis type guard. Une sauvegarde corrompue n'écrase rien.
- `localStorage` peut lever (navigation privée, quota, stockage bloqué) : tout est en `try/catch` et le stockage est **injecté** (testable en Node).

La v1 est le `GameState` actuel (`version: 1`, `clockMinutes`, `player` avec `energy`). La v2 suit le canon (PE, Moral, Tickets, Grains, position, drapeaux) :

```ts
// src/systems/save/schema.ts
export interface SaveDataV2 {
  version: 2;
  savedAt: string;                                    // ISO 8601
  clock: { day: number; minuteOfDay: number };
  party: { id: CharacterId; name: string; level: number; xp: number; hp: number; maxHp: number;
           pe: number; maxPe: number }[];
  fatigue: number; moral: number; tickets: number; coffeeBeans: number;
  position: { mapId: string; tileX: number; tileY: number; facing: Facing };
  inventory: Record<string, number>;
  flags: Record<string, boolean>;                     // progression (fragments PHR-2030, trahison…)
}
export const CURRENT_SAVE_VERSION = 2; export type SaveData = SaveDataV2; // alias = version courante
```

```ts
// src/systems/save/migrations.ts
type Raw = Record<string, unknown>;
export const MIGRATIONS: Readonly<Record<number, (s: Raw) => Raw>> = {
  1: (s) => {
    const p = isRecord(s['player']) ? s['player'] : {};
    return {
      version: 2, savedAt: new Date(0).toISOString(),
      clock: { day: 1, minuteOfDay: s['clockMinutes'] ?? 360 },
      party: [{ id: 'heros', name: p['name'] ?? 'Léon', level: p['level'] ?? 1, xp: 0,
                hp: p['hp'] ?? 30, maxHp: p['maxHp'] ?? 30, pe: p['energy'] ?? 10, maxPe: p['maxEnergy'] ?? 10 }],
      fatigue: p['fatigue'] ?? 0, moral: 50, tickets: 0, coffeeBeans: 0,
      position: { mapId: 'gare-mons', tileX: 0, tileY: 0, facing: 'down' },  // spawn par défaut
      inventory: {}, flags: {},
    };
  },
};
```

```ts
// src/systems/save/SaveManager.ts
export interface KeyValueStorage {
  getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void;
}
export type SaveSlot = 'slot-1' | 'slot-2' | 'slot-3' | 'auto';
export type LoadResult =
  | { ok: true; data: SaveData }
  | { ok: false; reason: 'empty' | 'corrupted' | 'too-new' | 'storage-unavailable' };

export class SaveManager {
  public constructor(private readonly storage: KeyValueStorage | null, private readonly prefix = 'privatix.save') {}

  public save(slot: SaveSlot, data: Omit<SaveData, 'version' | 'savedAt'>): boolean {
    if (!this.storage) return false;
    const payload: SaveData = { ...data, version: CURRENT_SAVE_VERSION, savedAt: new Date().toISOString() };
    try { this.storage.setItem(`${this.prefix}.${slot}`, JSON.stringify(payload)); return true; }
    catch { return false; }                            // quota / stockage bloqué : l'UI affiche un Toast
  }

  public load(slot: SaveSlot): LoadResult {
    if (!this.storage) return { ok: false, reason: 'storage-unavailable' };
    let raw: string | null;
    try { raw = this.storage.getItem(`${this.prefix}.${slot}`); }
    catch { return { ok: false, reason: 'storage-unavailable' }; }
    if (raw === null) return { ok: false, reason: 'empty' };
    let current: unknown;
    try { current = JSON.parse(raw); } catch { return { ok: false, reason: 'corrupted' }; }
    if (!isRecord(current) || typeof current['version'] !== 'number') return { ok: false, reason: 'corrupted' };
    if (current['version'] > CURRENT_SAVE_VERSION) return { ok: false, reason: 'too-new' };
    while (isRecord(current) && typeof current['version'] === 'number' && current['version'] < CURRENT_SAVE_VERSION) {
      const migrate = MIGRATIONS[current['version']];
      if (!migrate) return { ok: false, reason: 'corrupted' };
      current = migrate(current);
    }
    return isSaveData(current) ? { ok: true, data: current } : { ok: false, reason: 'corrupted' };
  }
}

// src/platform/storage.ts — seul point de contact avec le navigateur, appelé par BootScene
export function browserStorage(): KeyValueStorage | null {
  try { return localStorage; } catch { return null; }  // l'accès lui-même peut lever (SecurityError)
}
```

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
| 1 | **Déplacement** | `Player` = `Rectangle` avec Arcade Physics, déplacement libre à `PLAYER_SPEED` (96 px/s), touches `KeyCodes.Z/Q/S/D` + flèches. `main.ts` active `arcade` avec `debug` en dev. | Migration en 4 étapes : (1) écrire `GridMovement` pur + tests ; (2) réécrire `Player` en `Sprite` qui appelle `step()` et interpole par tween (`STEP_DURATION_MS`), collisions via le calque Tiled `collision` ; (3) brancher l'`InputManager` (`KeyboardEvent.code`) ; (4) retirer `physics` de `main.ts` et `PLAYER_SPEED` des constantes. Chaque pas appelle le `TimeService` (rencontres, déclencheurs). |
| 2 | **Palette** | `src/config/colors.ts` provisoire (`sncbBlue 0x0b2a5b`, `sncbYellow 0xf7c600`, `occBrown 0x3b2418`…), répété dans `index.html` (`#0b2a5b`). | Aligner sur le canon UX : Bleu Nuit `#0B1F3A`, Bleu Institution `#123C73`, Jaune Quai `#FFD200`, Espresso `#2B1A12`, Crème `#F2E6CF`, Ambre `#F2A541`, Rouge Rebelle `#C8323C` ; renommer les clés par thème, mettre à jour `index.html` (fond et `theme-color`), PV rouge / PE cyan / Fatigue violette. |
| 3 | **Pack d'assets vide** | `asset-pack.json` sans fichier ; `AssetKeys.Logo` déclaré mais non chargé ; dossiers `images/ audio/ tilemaps/ fonts/` vides. | Remplir au fil des livraisons (§6), ajouter le test de cohérence pack ↔ `AssetKeys`, créer les animations dans le Preloader. |
| 4 | **Polices** | `fontFamily: 'monospace'` partout. | BitmapFont (Press Start 2P pour titres/chiffres, Pixelify Sans ou m6x11 pour le texte) via `bitmapText` ; en prototype WebFont, attendre `document.fonts.ready` avant la première scène. Corps de texte ≥ 16 px logiques. |
| 5 | **État** | `GameState` v1 minimal (horloge, joueur) ; `UIScene` fait un cast `as GameState`. | Étendre selon §7 (v2 + migration), helpers typés `getGameState`/`updateGameState`, type guard. |
| 6 | **Systèmes** | Seuls `GameState` et `clamp` existent. | `TimeService`, `CombatEngine`, `Inventory`, `MoralMeter`, `SaveManager`, `EventBus`, `rng`. |
| 7 | **Scènes** | Battle, Dialogue, Occ, Pause absentes ; Échap renvoie au menu. | Créer les scènes et `BaseScene` ; Échap ouvre `Pause`. |
| 8 | **UI** | HUD en `Text` et `Rectangle` bruts. | Composants `src/ui` (§5.5), `FocusManager`, `VirtualPad` pour le tactile. |
| 9 | **Outillage** | Pas de CI, pas de `.nvmrc`, lint sans `--max-warnings=0`, pas de couverture. | Workflow §9.3, `.nvmrc` = `22`, `@vitest/coverage-v8` sur `src/systems`, `src/data`, `src/utils`. |
| 10 | **nginx** | `Referrer-Policy` perdu dans les `location` qui redéfinissent `add_header`. | Le répéter dans `/bundle/`, `/assets/` et `= /index.html` ; envisager une CSP stricte (aucun script externe). |
| 11 | **Installation** | `npm install` exige `--legacy-peer-deps` (bug npm 10 avec les peers de vitest 4). | Retirer le flag de la documentation quand npm ou vitest le corrigent ; `npm ci` reste la référence. |
