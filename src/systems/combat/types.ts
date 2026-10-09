/**
 * CONTRAT du moteur de combat (GDD § 5). Logique pure, sans Phaser, immuable, aléatoire injecté.
 * Implémentation : `CombatEngine.ts` (et modules voisins). Consommateurs : BattleScene, `src/systems/party/Party.ts`.
 *
 * Déroulement : `startBattle` calcule la manche 1 et fait jouer les ennemis jusqu'au premier tour d'un membre
 * de l'équipe ; ensuite chaque `act` exécute l'action de ce membre puis enchaîne les tours ennemis
 * (et les tours sautés : Bloqué, Sommeil, K.O.) jusqu'à la prochaine décision du joueur ou la fin du combat.
 * Les `events` décrivent, dans l'ordre, tout ce qui s'est passé : la scène les rejoue pour l'animation et le journal.
 */
import type { Shift } from '@/config/constants';
import type { CombatTier, EnemyId, ItemId, SkillId, TargetMode } from '@/data/combat';
import type { AllyId, CharacterId, EncounterId, StatusId } from '@/data/types';

/** Générateur aléatoire dans [0, 1[ (Math.random en jeu, générateur seedé en test). */
export type Rng = () => number;

export type Side = 'party' | 'enemy';
export type PartyMemberId = 'heros' | AllyId;

export interface StatusInstance {
  readonly id: StatusId;
  /** Tours restants (décomptés au début du tour du porteur). */
  readonly turns: number;
}

export interface Combatant {
  /** Équipe : 'heros' | AllyId. Ennemis : identifiant unique (ex. 'consultant#1'). */
  readonly id: string;
  readonly side: Side;
  readonly name: string;
  readonly sprite: CharacterId;
  readonly enemyId: EnemyId | null;
  readonly tier: CombatTier;
  readonly level: number;
  readonly hp: number;
  readonly maxHp: number;
  /** Les ennemis n'ont pas de PE (0/0) : ils ont des temps de recharge. */
  readonly pe: number;
  readonly maxPe: number;
  readonly force: number;
  readonly defense: number;
  readonly speed: number;
  readonly skills: readonly SkillId[];
  readonly statuses: readonly StatusInstance[];
  readonly ko: boolean;
  /** Effets internes au moteur (ajout M2) : la scène peut les lire (icônes bouclier, provocation…). */
  readonly fx: CombatantEffects;
}

/**
 * Effets de combat hors statuts (ajout M2, interne au moteur). Les durées se décomptent, comme les statuts,
 * au début du tour du porteur.
 */
export interface CombatantEffects {
  /** « Défendre » : dégâts reçus ×0,5 jusqu'à son prochain tour, régénération de PE doublée à ce tour. */
  readonly defending: boolean;
  /** Bouclier (« Réunion d'alignement ») : dégâts reçus ×0,5. 0 = aucun. */
  readonly shieldTurns: number;
  /** Provocation (« Contrôle des titres ») : les attaques à cible unique adverses le visent. 0 = aucune. */
  readonly tauntTurns: number;
  /** Multiplicateur de dégâts reçus pendant la provocation (Josiane ×0,8). */
  readonly guardMult: number;
  /** Immunité à Bloqué après un tour sauté (tours restants). */
  readonly blockImmunity: number;
  /** Recharges des compétences ennemies (tours restants). */
  readonly cooldowns: Readonly<Partial<Record<SkillId, number>>>;
  /** Bonus de Force en fraction (passif du Manager KPI : +0,05 par manche). */
  readonly forceBonus: number;
  /** « File d'attente » : joue en dernier (manche en cours ou suivante). */
  readonly actsLast: boolean;
  /** Tours effectivement joués (ouverture du Manager KPI). */
  readonly turnsTaken: number;
  /** Invocation déjà faite, ou annulée par une faiblesse (« Question concrète »). */
  readonly summonSpent: boolean;
  /** Esquive (points de pourcentage). */
  readonly dodge: number;
  /** Résistance aux statuts des ennemis (le héros la calcule depuis le Moral). */
  readonly resistance: number;
}

/** Membre de l'équipe tel que le jeu le fournit au début du combat (stats déjà calculées). */
export interface PartyMemberSetup {
  readonly id: PartyMemberId;
  readonly name: string;
  readonly sprite: CharacterId;
  readonly level: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly pe: number;
  readonly maxPe: number;
  readonly force: number;
  readonly defense: number;
  readonly speed: number;
  readonly skills: readonly SkillId[];
}

export interface BattleSetup {
  readonly encounterId: EncounterId;
  /** 1 à 3 membres ; le premier est le héros. */
  readonly party: readonly PartyMemberSetup[];
  /** Fatigue d'équipe au début du combat (paliers GDD § 4.3). */
  readonly fatigue: number;
  /** Moral collectif (critique et résistance, GDD § 7.3). */
  readonly moral: number;
  /** Pause en cours (multiplicateurs GDD § 4.4). */
  readonly shift: Shift;
  readonly inventory: Readonly<Partial<Record<ItemId, number>>>;
  /** Gobelets de l'OCC disponibles (action « Café »). */
  readonly gobelets: number;
}

export type BattleOutcome = 'victory' | 'defeat' | 'fled';

/**
 * État complet d'un combat. Les champs ci-dessous sont garantis ; l'implémentation peut en ajouter d'autres
 * (boucliers, provocation, recharges, défense…), que les consommateurs ignorent.
 */
export interface BattleState {
  readonly encounterId: EncounterId;
  readonly round: number;
  /** Ordre d'initiative de la manche en cours (ids). */
  readonly order: readonly string[];
  readonly combatants: readonly Combatant[];
  readonly fatigue: number;
  readonly moral: number;
  readonly inventory: Readonly<Partial<Record<ItemId, number>>>;
  readonly gobelets: number;
  /** Non nul quand le combat est terminé. */
  readonly outcome: BattleOutcome | null;
  /** Données de déroulement internes au moteur (ajout M2). */
  readonly engine: BattleEngineData;
}

/** Déroulement interne d'un combat (ajout M2) : les consommateurs n'ont pas à le lire. */
export interface BattleEngineData {
  readonly shift: Shift;
  readonly canFlee: boolean;
  /** Index dans `order` du combattant dont c'est le tour. */
  readonly turnIndex: number;
  /** Une tentative de fuite a déjà eu lieu pendant la manche. */
  readonly fleeAttempted: boolean;
  /** Fuite ratée : l'équipe perd le reste de la manche. */
  readonly partyLosesRound: boolean;
  /** Membres qui sautent leur prochaine action (Fatigue « Effondré » en combat). */
  readonly collapsed: readonly string[];
  /** Compteur d'invocations, pour des ids uniques. */
  readonly spawned: number;
}

export type BattleAction =
  | { readonly kind: 'attack'; readonly targetId: string }
  | { readonly kind: 'skill'; readonly skillId: SkillId; readonly targetId?: string }
  | { readonly kind: 'item'; readonly itemId: ItemId; readonly targetId?: string }
  /** Boit un Gobelet de l'OCC : Fatigue −20 et Caféiné. */
  | { readonly kind: 'cafe' }
  | { readonly kind: 'defend' }
  | { readonly kind: 'flee' };

export type BattleEvent =
  | { readonly kind: 'roundStart'; readonly round: number; readonly order: readonly string[] }
  | { readonly kind: 'turnStart'; readonly actorId: string }
  | { readonly kind: 'skipTurn'; readonly actorId: string; readonly reason: 'bloque' | 'sommeil' }
  /** Annonce d'une action : « Léa utilise Question concrète ». */
  | { readonly kind: 'action'; readonly actorId: string; readonly label: string }
  | { readonly kind: 'miss'; readonly actorId: string; readonly targetId: string }
  | {
      readonly kind: 'damage';
      readonly targetId: string;
      readonly amount: number;
      readonly critical: boolean;
      readonly weakness: boolean;
    }
  | { readonly kind: 'heal'; readonly targetId: string; readonly amount: number }
  | { readonly kind: 'pe'; readonly targetId: string; readonly amount: number }
  | {
      readonly kind: 'status';
      readonly targetId: string;
      readonly status: StatusId;
      readonly applied: boolean;
    }
  | { readonly kind: 'statusEnd'; readonly targetId: string; readonly status: StatusId }
  | { readonly kind: 'ko'; readonly targetId: string }
  | { readonly kind: 'fatigue'; readonly delta: number; readonly value: number }
  | { readonly kind: 'summon'; readonly combatantId: string }
  | { readonly kind: 'flee'; readonly success: boolean }
  /** Texte libre pour le journal (bouclier levé, invocation annulée…). */
  | { readonly kind: 'message'; readonly text: string }
  | { readonly kind: 'end'; readonly outcome: BattleOutcome };

export interface BattleStep {
  readonly state: BattleState;
  readonly events: readonly BattleEvent[];
}

/** Ce que le membre de l'équipe dont c'est le tour peut faire (pour griser le menu). */
export interface ActionAvailability {
  readonly skills: readonly {
    readonly id: SkillId;
    readonly usable: boolean;
    readonly reason?: string;
  }[];
  readonly items: readonly {
    readonly id: ItemId;
    readonly count: number;
    readonly usable: boolean;
  }[];
  readonly cafe: boolean;
  readonly flee: boolean;
}

export interface BattleRewards {
  readonly xp: number;
  readonly tickets: number;
  readonly coffeeBeans: number;
}

/**
 * API publique attendue de `CombatEngine.ts` (signatures exactes) :
 *
 *   startBattle(setup: BattleSetup, rng: Rng): BattleStep
 *   currentActor(state: BattleState): Combatant | null        // membre de l'équipe qui doit décider, sinon null
 *   availableActions(state: BattleState): ActionAvailability
 *   targetMode(state: BattleState, action: BattleAction['kind'], id?: SkillId | ItemId): TargetMode | 'none'
 *   legalTargets(state: BattleState, mode: TargetMode): readonly string[]   // ids vivants (provocation prise en compte)
 *   act(state: BattleState, action: BattleAction, rng: Rng): BattleStep    // lève une erreur si l'action est illégale
 *   computeRewards(state: BattleState, rng: Rng): BattleRewards            // après une victoire (GDD § 5.7)
 *   knownSkills(member: PartyMemberId, level: number): readonly SkillId[]   // compétences apprises à ce niveau
 */
export type { TargetMode };
