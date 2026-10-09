/**
 * Contrats des données de jeu (cartes, dialogues, progression).
 * Données pures, sans Phaser. Les fichiers de données (`maps.ts`, `dialogues.ts`, `objectives.ts`…)
 * les respectent ; `tests/data.test.ts` vérifie leur cohérence (références, accessibilité des cartes).
 */
import type { ActNumber } from '@/config/balance';

// ---------------------------------------------------------------------------
// Identifiants
// ---------------------------------------------------------------------------

export type Facing = 'up' | 'down' | 'left' | 'right';

export type MapId = 'gare-mons' | 'gare-salle-pauses' | 'gare-couloir-technique' | 'occ';

export type CharacterId =
  | 'heros'
  | 'marcel'
  | 'josiane'
  | 'rudy'
  | 'bene'
  | 'jean-mi'
  | 'fatou'
  | 'voyageur'
  | 'consultant'
  | 'manager-kpi'
  | 'borne'
  | 'post-it'
  | 'stagiaire'
  | 'annonce'
  | 'distributeur'
  | 'systeme';

/**
 * Rencontres de l'Acte I : 4 scénarisées (déclenchées par un dialogue) et 4 groupes visibles sur les cartes,
 * qui réapparaissent (voir le marqueur `encounter`). Composition et stats : `src/data/combat.ts`.
 */
export type EncounterId =
  | 'borne-rebelle'
  | 'consultant-junior'
  | 'post-it-vivant'
  | 'audit-manager-kpi'
  | 'patrouille-bornes'
  | 'consultants-hall'
  | 'post-its-couloir'
  | 'manager-kpi-quai';

/** Collègues combattants de l'Acte I (GDD § 7.2), dans l'ordre de priorité pour l'équipe. */
export type AllyId = 'josiane' | 'rudy' | 'bene';
export const ALLY_ORDER: readonly AllyId[] = ['josiane', 'rudy', 'bene'];

/** Statuts de combat (GDD § 5.6). */
export type StatusId =
  'cafeine' | 'syndique' | 'demotive' | 'bloque' | 'burnout' | 'confusion' | 'sommeil';

/** Boissons de la Tasse de Relève (GDD § 4.5). */
export type DrinkId = 'ristretto' | 'lungo' | 'cappuccino' | 'chocolat';

/**
 * Drapeaux de progression de l'histoire. Absent = faux.
 * Ajouter un drapeau ici quand une nouvelle étape de scénario en a besoin.
 */
export type StoryFlag =
  // Acte I, fil principal
  | 'intro-vue'
  | 'borne-vaincue'
  | 'dossier-trouve'
  | 'consultant-vaincu'
  | 'occ-decouverte'
  | 'code-occ-connu'
  | 'tasse-releve-vue'
  | 'quete-trois-tasses'
  | 'audit-annonce'
  | 'audit-vaincu'
  // Trois tasses, trois collègues
  | 'thermos-retrouve'
  | 'josiane-recrutee'
  | 'sifflet-recupere'
  | 'rudy-recrute'
  | 'voyageur-1-renseigne'
  | 'voyageur-2-renseigne'
  | 'voyageur-3-renseigne'
  | 'bene-recrutee';

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

/** Condition sur l'état : tous les drapeaux listés doivent avoir la valeur indiquée (absent = faux). */
export interface Condition {
  readonly flags?: Readonly<Partial<Record<StoryFlag, boolean>>>;
  readonly act?: ActNumber;
}

/** Interaction conditionnelle : la première dont la condition est vraie est jouée. */
export interface Interaction {
  readonly when?: Condition;
  readonly dialogue: string;
}

// ---------------------------------------------------------------------------
// Cartes (placeholder ASCII, en attendant les cartes Tiled)
// ---------------------------------------------------------------------------

/**
 * Terrains. Chaque caractère de `TERRAIN_CHARS` est un terrain ; tout autre caractère est un marqueur.
 * Les couleurs placeholder sont dans `src/ui/PlaceholderTextures.ts`.
 */
export type TerrainId =
  | 'wall'
  | 'floor'
  | 'platform'
  | 'track'
  | 'footbridge'
  | 'hall'
  | 'office'
  | 'occ-floor'
  | 'occ-wall'
  | 'counter'
  | 'escalator'
  | 'void';

export const TERRAIN_CHARS: Readonly<Record<string, TerrainId>> = {
  '#': 'wall',
  '.': 'floor',
  _: 'platform',
  '=': 'track',
  ':': 'footbridge',
  ',': 'hall',
  ';': 'office',
  '+': 'occ-floor',
  '%': 'occ-wall',
  '&': 'counter',
  '^': 'escalator',
  ' ': 'void',
};

/** Terrains infranchissables. */
export const BLOCKING_TERRAINS: ReadonlySet<TerrainId> = new Set<TerrainId>([
  'wall',
  'track',
  'occ-wall',
  'counter',
  'void',
]);

export type MarkerDef =
  /** Point d'arrivée nommé (nouvelle partie, portail, téléportation). */
  | { readonly kind: 'spawn'; readonly id: string; readonly facing?: Facing }
  /** Case de sortie : y marcher charge `to` au point `spawn` (+5 min d'horloge). */
  | { readonly kind: 'portal'; readonly to: MapId; readonly spawn: string }
  /** Personnage (case bloquante). */
  | {
      readonly kind: 'npc';
      readonly character: CharacterId;
      readonly facing?: Facing;
      readonly visibleWhen?: Condition;
      readonly interactions: readonly Interaction[];
    }
  /** Objet interactif (machine, écran, imprimante…). */
  | {
      readonly kind: 'prop';
      readonly id: string;
      readonly label: string;
      readonly blocking: boolean;
      readonly visibleWhen?: Condition;
      readonly interactions: readonly Interaction[];
    }
  /** Déclencheur invisible quand le héros marche dessus (ne bloque pas). */
  | { readonly kind: 'trigger'; readonly interactions: readonly Interaction[] }
  /**
   * Groupe d'ennemis visible (case bloquante) : le combat se lance quand le héros lui fonce dessus ou
   * interagit avec lui. Vaincu, il disparaît puis réapparaît `respawnMinutes` minutes in-game plus tard.
   */
  | {
      readonly kind: 'encounter';
      readonly encounter: EncounterId;
      /** Sprite affiché sur la carte (le premier ennemi du groupe). */
      readonly character: CharacterId;
      readonly label: string;
      readonly respawnMinutes?: number;
      readonly visibleWhen?: Condition;
    };

export interface MapDefinition {
  readonly id: MapId;
  /** Nom affiché à l'arrivée (« Gare de Mons — Quais »). */
  readonly name: string;
  readonly theme: 'sncb' | 'occ';
  /** Terrain posé sous chaque marqueur. */
  readonly floor: TerrainId;
  /** Grille : toutes les lignes ont la même longueur. */
  readonly rows: readonly string[];
  /** Un caractère (lettre ou chiffre) → marqueur. Un marqueur `portal` peut apparaître plusieurs fois. */
  readonly markers: Readonly<Record<string, MarkerDef>>;
  /** Dialogues joués à l'arrivée sur la carte (première condition vraie). */
  readonly onEnter?: readonly Interaction[];
}

// ---------------------------------------------------------------------------
// Dialogues
// ---------------------------------------------------------------------------

export type DialogueEffect =
  /** Pose (ou retire, avec `value: false`) un drapeau. */
  | { readonly kind: 'flag'; readonly flag: StoryFlag; readonly value?: boolean }
  | { readonly kind: 'moral'; readonly delta: number }
  | { readonly kind: 'tickets'; readonly delta: number }
  | { readonly kind: 'fatigue'; readonly delta: number }
  | { readonly kind: 'time'; readonly minutes: number }
  /** Repos de l'OCC (1 fois par pause chacun) ; un refus affiche un message. */
  | { readonly kind: 'rest'; readonly rest: 'coffee' | 'nap' | 'sleep' }
  /** Choix de la Tasse de Relève pour la pause en cours. */
  | { readonly kind: 'drink'; readonly drink: DrinkId }
  /** PV et PE au maximum (héros et collègues). */
  | { readonly kind: 'heal' }
  /** Remplit les Gobelets de l'OCC (1, 2 ou 3 selon la machine), une fois par pause. */
  | { readonly kind: 'gobelets' }
  /** Sauvegarde manuelle (Vieille Dame). */
  | { readonly kind: 'save' }
  /** Combat. Jalon M1 : victoire automatique (coûts de temps et de Fatigue appliqués). */
  | { readonly kind: 'battle'; readonly encounter: EncounterId }
  | { readonly kind: 'teleport'; readonly map: MapId; readonly spawn: string }
  /** Fin d'acte : relève (14h00 ou 22h00) et récupération de Fatigue. */
  | { readonly kind: 'nextAct' }
  /** Ouvre le clavier du distributeur « HORS SERVICE » (code de l'OCC). */
  | { readonly kind: 'keypad' };

export interface DialogueChoice {
  readonly label: string;
  /** Nœud suivant ; absent = fin du dialogue. */
  readonly next?: string;
  readonly effects?: readonly DialogueEffect[];
  /** Choix proposé seulement si la condition est vraie. */
  readonly when?: Condition;
}

/**
 * Nœud de dialogue. `text` accepte les jetons {prenom}, {objectif}, {heure}, {pause}, {fatigue}, {moral}, {tickets}, {gobelets}.
 * Les `effects` du nœud s'appliquent à son affichage.
 */
export interface DialogueNode {
  readonly speaker: CharacterId;
  readonly text: string;
  readonly next?: string;
  readonly choices?: readonly DialogueChoice[];
  readonly effects?: readonly DialogueEffect[];
}

export interface DialogueDef {
  readonly start: string;
  readonly nodes: Readonly<Record<string, DialogueNode>>;
}

// ---------------------------------------------------------------------------
// Objectifs (écran des départs)
// ---------------------------------------------------------------------------

export interface ObjectiveDef {
  /** Quête du GDD (P1, P2…) pour le suivi. */
  readonly quest: string;
  readonly text: string;
  /** L'objectif est atteint quand cette condition est vraie ; l'objectif courant est le premier non atteint. */
  readonly doneWhen: Condition;
}
