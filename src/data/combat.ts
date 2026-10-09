import { BALANCE } from '@/config/balance';
import type { Shift } from '@/config/constants';
import type { AllyId, CharacterId, EncounterId, StatusId } from '@/data/types';

/**
 * Données de combat de l'Acte I (GDD § 5 à § 9) : ennemis, compétences, objets, rencontres.
 * Les champs marqués « UI » sont lus par BattleScene et le menu ; les autres par le moteur (src/systems/combat).
 * Les constantes générales (formules, statuts, paliers) restent dans `src/config/balance.ts` ;
 * ici ne vivent que les chiffres propres à une compétence, un objet ou un ennemi.
 */

/** Qui une compétence ou un objet peut viser (relatif à l'utilisateur : `enemy` = le camp d'en face). */
export type TargetMode = 'enemy' | 'all-enemies' | 'ally' | 'all-allies' | 'self';

export type CombatTier = 'normal' | 'elite' | 'boss';

export interface SkillDef {
  /** UI */
  readonly name: string;
  /** UI : une ligne, effet chiffré (« Puissance 110, ×2 sur les Consultants »). */
  readonly description: string;
  /** Qui possède la compétence : le héros, un collègue, ou un ennemi. */
  readonly owner: 'heros' | AllyId | 'enemy';
  /** Niveau d'apprentissage (héros et collègues). */
  readonly learnLevel?: number;
  /** UI */
  readonly peCost: number;
  readonly fatigueCost?: number;
  /** UI */
  readonly target: TargetMode;
  readonly power?: number;
  readonly ignoreDef?: number;
  readonly healPct?: number;
  readonly status?: StatusId;
  /** Chance de base du statut (points) ; absente = appliqué d'office (bonus, soutien). */
  readonly statusChance?: number;
  /** Recharge en tours (ennemis). */
  readonly cooldown?: number;
  /** Nombre de coups ; chaque coup vise une cible aléatoire du camp d'en face (« Tempête de Post-it »). */
  readonly hits?: number;
  /** Touche toujours (pas de jet de précision). */
  readonly alwaysHit?: boolean;
  /** Puissance supplémentaire par combattant debout du camp de l'utilisateur (« Tableau croisé dynamique »). */
  readonly powerPerAlly?: number;
  /** Multiplicateur appliqué aux cibles qui y sont faibles (défaut : `BALANCE.combat.WEAKNESS_MULT`). */
  readonly weakMult?: number;
  /** Brise le bouclier de la cible avant de frapper. */
  readonly breaksShield?: boolean;
  /** Sur une cible faible : annule définitivement son invocation. */
  readonly cancelsSummon?: boolean;
  /** Provocation sur soi (tours). */
  readonly taunt?: number;
  /** Dégâts reçus pendant la provocation. */
  readonly guardMult?: number;
  /** Bouclier sur tout le camp de l'utilisateur (tours). */
  readonly shieldTurns?: number;
  /** La cible joue en dernier. */
  readonly actsLast?: boolean;
  /** Invoque un renfort (voir `EnemyDef.summon`). */
  readonly summon?: boolean;
}

export interface ItemDef {
  /** UI */
  readonly name: string;
  /** UI */
  readonly description: string;
  /** UI */
  readonly target: TargetMode;
  readonly usableInBattle: boolean;
  readonly healHp?: number;
  /** Variation de Fatigue d'équipe (négatif = repos). */
  readonly fatigue?: number;
  readonly pe?: number;
  readonly status?: StatusId;
  /** Chance de base du statut (points) ; absente = appliqué d'office. */
  readonly statusChance?: number;
}

export interface EnemyDef {
  /** UI */
  readonly name: string;
  /** UI : sprite placeholder. */
  readonly sprite: CharacterId;
  readonly tier: CombatTier;
  /** Coefficients [PV, Force, Déf, Vit] appliqués aux formules du GDD § 6.1. */
  readonly coef: readonly [number, number, number, number];
  readonly resistance: number;
  readonly dodge?: number;
  readonly skills: readonly string[];
  /** Compétences du héros qui lui infligent ×2 (faiblesse). */
  readonly weakTo?: readonly string[];
  /** Multiplicateur global des stats (variante « Stagiaire » : ×0,6). */
  readonly statMult?: number;
  /** Compétence jouée d'office à son premier tour. */
  readonly openingSkill?: string;
  /** Compétence jouée d'office toutes les `every` manches (manches 3, 6, 9…). */
  readonly scheduledSkill?: { readonly skill: string; readonly every: number };
  /** Invocation unique (compétence `summon`) quand il est encore debout après `afterRound` manches. */
  readonly summon?: { readonly skill: string; readonly enemy: string; readonly afterRound: number };
  /** Chance (0–1) de passer son tour (« cherche le Wi-Fi »). */
  readonly idleChance?: number;
  /** UI : texte du tour passé (`idleChance`). */
  readonly idleLabel?: string;
  /** Statut tenté sur un membre de l'équipe au hasard à sa mort. */
  readonly onDeath?: { readonly status: StatusId; readonly chance: number; readonly label: string };
  /** Passif : Force +x par manche, plafonnée. */
  readonly forceGrowth?: { readonly perRound: number; readonly cap: number };
}

export interface EncounterDef {
  /** UI : bandeau d'ouverture et de victoire. */
  readonly name: string;
  readonly enemies: readonly { readonly enemy: string; readonly level: number }[];
  /** Fuite autorisée (jamais contre élites ni boss, ni dans les combats scénarisés). */
  readonly canFlee: boolean;
}

// ---------------------------------------------------------------------------
// Compétences (héros GDD § 8.3, collègues § 7.2, ennemis § 6.3 et § 6.5)
// ---------------------------------------------------------------------------

export const SKILLS = {
  // --- Héros (Acte I) ---
  'question-concrete': {
    name: 'Question concrète',
    description: 'Puissance 110 ; ×2 sur les Consultants et annule leur invocation',
    owner: 'heros',
    learnLevel: 2,
    peCost: 5,
    target: 'enemy',
    power: 110,
    cancelsSummon: true,
  },
  'ponctualite-reelle': {
    name: 'Ponctualité réelle',
    description: 'Puissance 100 ; brise les boucliers, ×1,5 sur un Manager KPI',
    owner: 'heros',
    learnLevel: 4,
    peCost: 8,
    target: 'enemy',
    power: 100,
    breaksShield: true,
    weakMult: 1.5,
  },
  'pause-syndicale': {
    name: 'Pause syndicale',
    description: "Soigne 30 % des PV max d'un allié",
    owner: 'heros',
    learnLevel: 6,
    peCost: 8,
    target: 'ally',
    healPct: 0.3,
  },
  // --- Collègues (compétence 1, apprise d'office) ---
  'controle-des-titres': {
    name: 'Contrôle des titres',
    description: 'Provocation 2 tours ; dégâts reçus ×0,8',
    owner: 'josiane',
    learnLevel: 1,
    peCost: 6,
    target: 'self',
    taunt: 2,
    guardMult: 0.8,
  },
  'fermeture-des-portes': {
    name: 'Fermeture des portes',
    description: 'Puissance 80 ; Bloqué 50 %',
    owner: 'rudy',
    learnLevel: 1,
    peCost: 7,
    target: 'enemy',
    power: 80,
    status: 'bloque',
    statusChance: 50,
  },
  'file-d-attente': {
    name: "File d'attente",
    description: 'La cible joue en dernier ; Bloqué 35 %',
    owner: 'bene',
    learnLevel: 1,
    peCost: 8,
    target: 'enemy',
    actsLast: true,
    status: 'bloque',
    statusChance: 35,
  },
  // --- Borne Automatique Rebelle ---
  'paiement-refuse': {
    name: 'Paiement refusé',
    description: 'Puissance 60 ; Bloqué 40 %',
    owner: 'enemy',
    peCost: 0,
    target: 'enemy',
    power: 60,
    status: 'bloque',
    statusChance: 40,
    cooldown: 3,
  },
  // --- Consultant Junior « Slide-Ninja » (et Stagiaire) ---
  'tempete-post-it': {
    name: 'Tempête de Post-it',
    description: '3 coups de puissance 35 au hasard ; Confusion 35 %',
    owner: 'enemy',
    peCost: 0,
    target: 'enemy',
    power: 35,
    hits: 3,
    status: 'confusion',
    statusChance: 35,
    cooldown: 3,
  },
  synergie: {
    name: 'Synergie',
    description: "Soigne 25 % des PV max d'un ennemi",
    owner: 'enemy',
    peCost: 0,
    target: 'ally',
    healPct: 0.25,
    cooldown: 3,
  },
  'je-loop-un-junior': {
    name: 'Je loop un junior sur le sujet',
    description: 'Invoque un Consultant Junior (1×)',
    owner: 'enemy',
    peCost: 0,
    target: 'self',
    summon: true,
  },
  // --- Post-it Vivant ---
  collage: {
    name: 'Collage',
    description: 'Puissance 50 ; Bloqué 20 %',
    owner: 'enemy',
    peCost: 0,
    target: 'enemy',
    power: 50,
    status: 'bloque',
    statusChance: 20,
    cooldown: 3,
  },
  // --- Manager KPI « Le Tableur » ---
  'reunion-alignement': {
    name: "Réunion d'alignement",
    description: 'Bouclier ennemi 2 tours ; Sommeil de zone 80 % (sauf Caféinés)',
    owner: 'enemy',
    peCost: 0,
    target: 'all-enemies',
    status: 'sommeil',
    statusChance: 80,
    shieldTurns: 2,
    cooldown: 5,
  },
  'tableau-croise': {
    name: 'Tableau croisé dynamique',
    description: 'Puissance 60 + 15 par ennemi debout',
    owner: 'enemy',
    peCost: 0,
    target: 'enemy',
    power: 60,
    powerPerAlly: 15,
  },
  'reporting-hebdo': {
    name: 'Reporting hebdo',
    description: "Puissance 140 sur l'équipe, touche toujours ; Burn-out 25 %",
    owner: 'enemy',
    peCost: 0,
    target: 'all-enemies',
    power: 140,
    alwaysHit: true,
    status: 'burnout',
    statusChance: 25,
  },
  // --- Manager KPI « Auditeur des quais » (mini-boss : mêmes capacités, renforcées) ---
  'reunion-audit': {
    name: "Réunion d'alignement (audit)",
    description: 'Bouclier ennemi 2 tours ; Sommeil de zone 90 % (sauf Caféinés)',
    owner: 'enemy',
    peCost: 0,
    target: 'all-enemies',
    status: 'sommeil',
    statusChance: 90,
    shieldTurns: 2,
    cooldown: 5,
  },
  'tableau-audit': {
    name: 'Tableau croisé dynamique consolidé',
    description: 'Puissance 75 + 15 par ennemi debout',
    owner: 'enemy',
    peCost: 0,
    target: 'enemy',
    power: 75,
    powerPerAlly: 15,
  },
  'reporting-audit': {
    name: 'Reporting hebdo certifié',
    description: "Puissance 150 sur l'équipe, touche toujours ; Burn-out 35 %",
    owner: 'enemy',
    peCost: 0,
    target: 'all-enemies',
    power: 150,
    alwaysHit: true,
    status: 'burnout',
    statusChance: 35,
  },
} as const satisfies Record<string, SkillDef>;
export type SkillId = keyof typeof SKILLS;

// ---------------------------------------------------------------------------
// Objets consommables de l'Acte I (GDD § 9.2)
// ---------------------------------------------------------------------------

export const ITEMS = {
  expresso: {
    name: 'Expresso',
    description: 'Fatigue −15, PE +5',
    target: 'ally',
    usableInBattle: true,
    fatigue: -15,
    pe: 5,
  },
  gaufre: {
    name: 'Gaufre de Liège',
    description: '+40 PV à un allié',
    target: 'ally',
    usableInBattle: true,
    healHp: 40,
  },
  'double-lungo': {
    name: 'Double lungo',
    description: 'Fatigue −30 + Caféiné',
    target: 'ally',
    usableInBattle: true,
    fatigue: -30,
    status: 'cafeine',
  },
  formulaire: {
    name: 'Formulaire en triple exemplaire',
    description: 'Bloqué sur un ennemi (60 %)',
    target: 'enemy',
    usableInBattle: true,
    status: 'bloque',
    statusChance: 60,
  },
} as const satisfies Record<string, ItemDef>;
export type ItemId = keyof typeof ITEMS;

// ---------------------------------------------------------------------------
// Ennemis (GDD § 6.1 à § 6.5)
// ---------------------------------------------------------------------------

const { ARCHETYPES, CONSULTANT_SUMMON_ROUND, REPORTING_EVERY } = BALANCE.enemies;
const { ENEMY_RES, DODGE } = BALANCE.combat;
const MANAGER_GROWTH = {
  perRound: BALANCE.enemies.MANAGER_FORCE_PER_ROUND,
  cap: BALANCE.enemies.MANAGER_FORCE_CAP,
} as const;

export const ENEMIES = {
  borne: {
    name: 'Borne Automatique Rebelle',
    sprite: 'borne',
    tier: 'normal',
    coef: [0.9, 0.8, 0.9, 0.8],
    resistance: ENEMY_RES.normal,
    skills: ['paiement-refuse'],
  },
  consultant: {
    name: 'Consultant Junior',
    sprite: 'consultant',
    tier: 'normal',
    coef: ARCHETYPES.consultant,
    resistance: ENEMY_RES.normal,
    dodge: DODGE.consultant,
    skills: ['tempete-post-it', 'synergie'],
    weakTo: ['question-concrete'],
    summon: { skill: 'je-loop-un-junior', enemy: 'consultant', afterRound: CONSULTANT_SUMMON_ROUND },
  },
  stagiaire: {
    name: 'Stagiaire en Stratégie',
    sprite: 'stagiaire',
    tier: 'normal',
    coef: ARCHETYPES.consultant,
    statMult: 0.6,
    resistance: ENEMY_RES.normal,
    dodge: DODGE.consultant,
    skills: ['tempete-post-it'],
    weakTo: ['question-concrete'],
    idleChance: 0.3,
    idleLabel: 'cherche le Wi-Fi',
  },
  'post-it': {
    name: 'Post-it Vivant',
    sprite: 'post-it',
    tier: 'normal',
    // Rapide et fragile : ≈ 20 PV au niveau 2 (« 20 PV × acte »).
    coef: [0.45, 0.8, 0.6, 1.5],
    resistance: ENEMY_RES.normal,
    skills: ['collage'],
    onDeath: { status: 'confusion', chance: 20, label: 'explose en confettis' },
  },
  'manager-kpi': {
    name: 'Manager KPI',
    sprite: 'manager-kpi',
    tier: 'normal',
    coef: ARCHETYPES.managerKpi,
    resistance: ENEMY_RES.normal,
    skills: ['tableau-croise', 'reunion-alignement'],
    weakTo: ['ponctualite-reelle'],
    openingSkill: 'reunion-alignement',
    scheduledSkill: { skill: 'reporting-hebdo', every: REPORTING_EVERY },
    forceGrowth: MANAGER_GROWTH,
  },
  /**
   * Mini-boss de fin d'Acte I. Coefficients calés sur la ligne du GDD § 6.2 (niv. 7 : PV 291, Force 19,
   * Déf 18, Vit 12). Équilibrage vérifié par tests/combatBalance.test.ts.
   */
  'auditeur-quais': {
    name: 'Manager KPI « Auditeur des quais »',
    sprite: 'manager-kpi',
    tier: 'elite',
    coef: [2.8, 0.95, 1.4, 0.8],
    resistance: ENEMY_RES.elite,
    skills: ['tableau-audit', 'reunion-audit'],
    weakTo: ['ponctualite-reelle'],
    openingSkill: 'reunion-audit',
    scheduledSkill: { skill: 'reporting-audit', every: REPORTING_EVERY },
    forceGrowth: MANAGER_GROWTH,
  },
} as const satisfies Record<string, EnemyDef>;
export type EnemyId = keyof typeof ENEMIES;

/**
 * Comportement des ennemis selon la pause (GDD § 4.4, ligne « Comportement ») : bonus de chance de base
 * des statuts infligés par les ennemis. Matin : Bloqué +15 ; après-midi (« Réunionite ») : Démotivé +10.
 */
export const SHIFT_ENEMY_STATUS_BONUS: Readonly<
  Record<Shift, Readonly<Partial<Record<StatusId, number>>>>
> = {
  morning: { bloque: 15 },
  afternoon: { demotive: 10 },
  night: {},
};

/** IA de « Synergie » : soigne un allié seulement sous cette fraction de ses PV max. */
export const ENEMY_HEAL_THRESHOLD = 0.75;

/** Nombre maximal d'ennemis sur le terrain (GDD § 5.1 : 1 à 4) ; une invocation au-delà échoue. */
export const MAX_ENEMIES = 4;

// ---------------------------------------------------------------------------
// Rencontres de l'Acte I
// ---------------------------------------------------------------------------

export const ENCOUNTERS: Readonly<Record<EncounterId, EncounterDef>> = {
  // Scénarisées (fuite impossible)
  'borne-rebelle': {
    name: 'Borne Automatique Rebelle',
    enemies: [{ enemy: 'borne', level: 1 }],
    canFlee: false,
  },
  'consultant-junior': {
    name: 'Consultant Junior « Slide-Ninja »',
    enemies: [{ enemy: 'consultant', level: 2 }],
    canFlee: false,
  },
  'post-it-vivant': {
    name: 'Post-it Vivants',
    enemies: [
      { enemy: 'post-it', level: 2 },
      { enemy: 'post-it', level: 2 },
    ],
    canFlee: false,
  },
  'audit-manager-kpi': {
    name: '« Auditeur des quais »',
    enemies: [{ enemy: 'auditeur-quais', level: 7 }],
    canFlee: false,
  },
  // Groupes visibles qui réapparaissent
  'patrouille-bornes': {
    name: 'Patrouille de Bornes',
    enemies: [
      { enemy: 'borne', level: 2 },
      { enemy: 'borne', level: 2 },
    ],
    canFlee: true,
  },
  'post-its-couloir': {
    name: 'Essaim de Post-it',
    enemies: [
      { enemy: 'post-it', level: 3 },
      { enemy: 'post-it', level: 3 },
      { enemy: 'post-it', level: 3 },
    ],
    canFlee: true,
  },
  'consultants-hall': {
    name: 'Mission de conseil',
    enemies: [
      { enemy: 'consultant', level: 3 },
      { enemy: 'stagiaire', level: 3 },
    ],
    canFlee: true,
  },
  'manager-kpi-quai': {
    name: 'Comité de pilotage',
    enemies: [
      { enemy: 'manager-kpi', level: 4 },
      { enemy: 'consultant', level: 3 },
    ],
    canFlee: true,
  },
};

/** Inventaire de départ (casier du héros). */
export const STARTING_INVENTORY: Readonly<Partial<Record<ItemId, number>>> = {
  gaufre: 3,
  expresso: 2,
};

// ---------------------------------------------------------------------------
// Gardes de type (les références entre tables sont des chaînes, vérifiées par les tests)
// ---------------------------------------------------------------------------

export function isSkillId(id: string): id is SkillId {
  return Object.hasOwn(SKILLS, id);
}

export function isEnemyId(id: string): id is EnemyId {
  return Object.hasOwn(ENEMIES, id);
}

export function isItemId(id: string): id is ItemId {
  return Object.hasOwn(ITEMS, id);
}

/** Définitions élargies à leur interface (accès uniforme aux champs optionnels). */
export function skillDef(id: SkillId): SkillDef {
  return SKILLS[id];
}

export function itemDef(id: ItemId): ItemDef {
  return ITEMS[id];
}

export function enemyDef(id: EnemyId): EnemyDef {
  return ENEMIES[id];
}
