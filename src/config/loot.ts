/**
 * Données du loot et de l'équipement (docs/GDD.md § 9 bis ; détail : docs/proposals/revue-3d-loot/
 * game_designer.md §§ 2 à 5). Données pures, sans logique : le système vit dans `src/systems/loot/`.
 *
 * Conventions d'unités (identiques à `balance.ts`) :
 * - pourcentages en fraction (0,05 = +5 %), points de critique en fraction (0,02 = +2 pts) ;
 * - distances en px logiques, durées en ms, récupérations en points par seconde.
 * - Les « réductions » (dégâts subis, recharge du dash, plancher de Burnout…) sont stockées en
 *   valeurs positives : 0,07 = −7 %.
 */
import type { AttackStep, EnemyKind, HitShape, ShiftId } from '@/config/balance';
import { COMBO, DASH_ATTACK } from '@/config/balance';
import type { FamilyId } from '@/systems/meta/Avantages';

// ─── Identifiants ─────────────────────────────────────────────────────────────

export type SlotId = 'outil' | 'casque' | 'gilet' | 'gants' | 'chaussures' | 'insigne';
export type ItemRarity = 'reforme' | 'reglementaire' | 'homologue' | 'hors-serie' | 'patrimoine';
export type WeaponType = 'cle' | 'masse' | 'pied-de-biche' | 'lanterne' | 'pelle' | 'perche';
export type DropSource =
  | 'ennemi'
  | 'caisse'
  | 'dotation'
  | 'casier'
  | 'elite'
  | 'gardee'
  | 'boss'
  | 'boss-premier'
  | 'friterie'
  | 'wagon-bar'
  | 'evenement';
export type AffixTag =
  | 'frappe'
  | 'coup-final'
  | 'dash'
  | 'sifflet'
  | 'cafe'
  | 'burnout'
  | 'mobilisation'
  | 'defense'
  | 'mobilite'
  | 'elec'
  | 'controle'
  | 'nuit'
  | 'economie';
export type TierIndex = 0 | 1 | 2;

/** Ordre fixe des emplacements (UI, sac mélangé, sérialisation). */
export const SLOTS: readonly SlotId[] = [
  'outil',
  'casque',
  'gilet',
  'gants',
  'chaussures',
  'insigne',
];

export const SLOT_LABELS: Readonly<Record<SlotId, string>> = {
  outil: 'Outil',
  casque: 'Casque',
  gilet: 'Gilet haute visibilité',
  gants: 'Gants',
  chaussures: 'Chaussures de sécurité',
  insigne: 'Insigne',
};

// ─── Raretés ──────────────────────────────────────────────────────────────────

export interface RarityDef {
  readonly id: ItemRarity;
  readonly label: string;
  /** Faisceau et nom. Jamais magenta, turquoise ni jaune danger (GDD § 9 bis.3). */
  readonly color: string;
  /** Nombre d'affixes aléatoires. */
  readonly affixes: number;
  /** Ferraille au démontage (avant le bonus d'ilvl). */
  readonly scrap: number;
  /** Hauteur du faisceau au sol (px), 0 = contour seulement. */
  readonly beamPx: number;
}

/** Ordre croissant : l'indice sert aux comparaisons « au moins Homologué ». */
export const RARITY_ORDER: readonly ItemRarity[] = [
  'reforme',
  'reglementaire',
  'homologue',
  'hors-serie',
  'patrimoine',
];

export const ITEM_RARITIES: Readonly<Record<ItemRarity, RarityDef>> = {
  reforme: { id: 'reforme', label: 'Réforme', color: '#8A929A', affixes: 1, scrap: 1, beamPx: 0 },
  reglementaire: {
    id: 'reglementaire',
    label: 'Réglementaire',
    color: '#F2EEE3',
    affixes: 2,
    scrap: 3,
    beamPx: 24,
  },
  homologue: {
    id: 'homologue',
    label: 'Homologué',
    color: '#3F8CFF',
    affixes: 3,
    scrap: 6,
    beamPx: 48,
  },
  'hors-serie': {
    id: 'hors-serie',
    label: 'Hors-série',
    color: '#A86BFF',
    affixes: 4,
    scrap: 15,
    beamPx: 72,
  },
  patrimoine: {
    id: 'patrimoine',
    label: 'Patrimoine',
    color: '#FF8C2B',
    affixes: 3,
    scrap: 40,
    beamPx: 128,
  },
};

// ─── Stats de l'équipement ────────────────────────────────────────────────────

/** Stats additives que l'équipement peut modifier (sommées puis plafonnées, voir `GEAR_CAPS`). */
export type GearStat =
  // Frappe
  | 'damage'
  | 'attackSpeed'
  | 'finisherDamage'
  | 'critChance'
  | 'critMult'
  | 'burnoutDamage'
  | 'dashAttackDamage'
  | 'knockback'
  | 'wallSlamDamage'
  | 'arcDamage'
  | 'fineChance'
  | 'electricDamage'
  | 'nightDamage'
  | 'perfectDashNextHit'
  // Tenue
  | 'maxEnergy'
  | 'damageTakenReduction'
  | 'damageTakenIncrease'
  | 'energyOnRoomClear'
  | 'slowResist'
  // Burnout
  | 'burnoutOnHitReduction'
  | 'burnoutDecay'
  | 'burnoutFloorReduction'
  | 'meltdownPenaltyReduction'
  | 'meltdownMs'
  // Mobilité et dash
  | 'speed'
  | 'dashRechargeReduction'
  | 'dashDistance'
  | 'perfectDashWindowMs'
  | 'dashCharges'
  | 'dashTrailDamage'
  // Mobilisation et Sifflet
  | 'mobilisationGain'
  | 'mobilisationOnRoomEnter'
  | 'mobilisationOnHitTaken'
  | 'whistleRadius'
  | 'whistleDamage'
  // Café
  | 'coffeeHeal'
  | 'coffeeBurnoutReduction'
  | 'caffeineMs'
  | 'caffeineAttackSpeed'
  | 'maxGobelets'
  // Divers
  | 'lightRadius'
  | 'tickets';

export type StatFormat = 'pct' | 'pts' | 'flat' | 'px' | 'ms' | 'perS';

export interface GearStatInfo {
  readonly label: string;
  readonly format: StatFormat;
  /** Sens favorable au joueur (flèches ▲▼ de la carte de comparaison). */
  readonly better: 'higher' | 'lower';
  /** Résumé de la carte : « Frappe » (offensif) ou « Tenue » (survie, utilitaire). */
  readonly group: 'frappe' | 'tenue';
}

export const GEAR_STATS: Readonly<Record<GearStat, GearStatInfo>> = {
  damage: { label: 'Dégâts de Frappe', format: 'pct', better: 'higher', group: 'frappe' },
  attackSpeed: { label: "Vitesse d'attaque", format: 'pct', better: 'higher', group: 'frappe' },
  finisherDamage: {
    label: 'Dégâts du coup final',
    format: 'pct',
    better: 'higher',
    group: 'frappe',
  },
  critChance: { label: 'Critique', format: 'pts', better: 'higher', group: 'frappe' },
  critMult: { label: 'Dégâts critiques', format: 'pct', better: 'higher', group: 'frappe' },
  burnoutDamage: {
    label: 'Dégâts par tranche de 10 Burnout',
    format: 'pct',
    better: 'higher',
    group: 'frappe',
  },
  dashAttackDamage: {
    label: 'Dégâts de la dash-attaque',
    format: 'pct',
    better: 'higher',
    group: 'frappe',
  },
  knockback: { label: 'Knockback', format: 'pct', better: 'higher', group: 'frappe' },
  wallSlamDamage: {
    label: 'Plaqué contre le quai',
    format: 'flat',
    better: 'higher',
    group: 'frappe',
  },
  arcDamage: {
    label: 'Arc électrique (coup final)',
    format: 'flat',
    better: 'higher',
    group: 'frappe',
  },
  fineChance: { label: "Chance d'Amende", format: 'pct', better: 'higher', group: 'frappe' },
  electricDamage: { label: 'Dégâts électriques', format: 'pct', better: 'higher', group: 'frappe' },
  nightDamage: { label: 'Dégâts la Nuit', format: 'pct', better: 'higher', group: 'frappe' },
  perfectDashNextHit: {
    label: 'Coup après un dash parfait',
    format: 'pct',
    better: 'higher',
    group: 'frappe',
  },
  maxEnergy: { label: 'Énergie max', format: 'flat', better: 'higher', group: 'tenue' },
  damageTakenReduction: { label: 'Dégâts subis', format: 'pct', better: 'higher', group: 'tenue' },
  damageTakenIncrease: {
    label: 'Dégâts subis (malus)',
    format: 'pct',
    better: 'lower',
    group: 'tenue',
  },
  energyOnRoomClear: {
    label: 'Énergie par salle nettoyée',
    format: 'flat',
    better: 'higher',
    group: 'tenue',
  },
  slowResist: {
    label: 'Ralentis et étourdissements subis',
    format: 'pct',
    better: 'higher',
    group: 'tenue',
  },
  burnoutOnHitReduction: {
    label: 'Burnout en encaissant',
    format: 'pct',
    better: 'higher',
    group: 'tenue',
  },
  burnoutDecay: {
    label: 'Récupération du Burnout',
    format: 'perS',
    better: 'higher',
    group: 'tenue',
  },
  burnoutFloorReduction: {
    label: 'Plancher de Burnout',
    format: 'pct',
    better: 'higher',
    group: 'tenue',
  },
  meltdownPenaltyReduction: {
    label: 'Séquelle du Pétage de plombs',
    format: 'flat',
    better: 'higher',
    group: 'tenue',
  },
  meltdownMs: {
    label: 'Durée du Pétage de plombs',
    format: 'ms',
    better: 'higher',
    group: 'frappe',
  },
  speed: { label: 'Vitesse de déplacement', format: 'pct', better: 'higher', group: 'tenue' },
  dashRechargeReduction: {
    label: 'Recharge du dash',
    format: 'pct',
    better: 'higher',
    group: 'tenue',
  },
  dashDistance: { label: 'Distance du dash', format: 'px', better: 'higher', group: 'tenue' },
  perfectDashWindowMs: {
    label: 'Fenêtre du dash parfait',
    format: 'ms',
    better: 'higher',
    group: 'tenue',
  },
  dashCharges: { label: 'Charges de dash', format: 'flat', better: 'higher', group: 'tenue' },
  dashTrailDamage: {
    label: 'Traînée électrique du dash',
    format: 'flat',
    better: 'higher',
    group: 'frappe',
  },
  mobilisationGain: {
    label: 'Mobilisation gagnée',
    format: 'pct',
    better: 'higher',
    group: 'tenue',
  },
  mobilisationOnRoomEnter: {
    label: "Mobilisation à l'entrée d'une salle",
    format: 'flat',
    better: 'higher',
    group: 'tenue',
  },
  mobilisationOnHitTaken: {
    label: 'Mobilisation par coup encaissé',
    format: 'flat',
    better: 'higher',
    group: 'tenue',
  },
  whistleRadius: { label: 'Rayon du Sifflet', format: 'px', better: 'higher', group: 'frappe' },
  whistleDamage: { label: 'Dégâts du Sifflet', format: 'pct', better: 'higher', group: 'frappe' },
  coffeeHeal: { label: 'Soin du Gobelet', format: 'pts', better: 'higher', group: 'tenue' },
  coffeeBurnoutReduction: {
    label: "Burnout d'un Gobelet",
    format: 'flat',
    better: 'higher',
    group: 'tenue',
  },
  caffeineMs: { label: 'Durée de la Caféine', format: 'ms', better: 'higher', group: 'frappe' },
  caffeineAttackSpeed: {
    label: "Vitesse d'attaque sous Caféine",
    format: 'pct',
    better: 'higher',
    group: 'frappe',
  },
  maxGobelets: { label: 'Gobelets max', format: 'flat', better: 'higher', group: 'tenue' },
  lightRadius: { label: 'Halo de Nuit', format: 'px', better: 'higher', group: 'tenue' },
  tickets: { label: 'Tickets ramassés', format: 'pct', better: 'higher', group: 'tenue' },
};

/**
 * Plafonds de la part « équipement » (GDD § 9 bis.8 ; proposition § 3.6), appliqués en dernier.
 * `critChance` vaut pour toutes les sources : la sim doit aussi plafonner le total.
 */
export const GEAR_CAPS: Readonly<Partial<Record<GearStat, number>>> = {
  damageTakenReduction: 0.3,
  critChance: 0.5,
  attackSpeed: 0.25,
  speed: 0.2,
  dashRechargeReduction: 0.35,
  mobilisationGain: 0.5,
  burnoutFloorReduction: 0.4,
  /** Un Gobelet donne toujours au moins +15 Burnout (20 − 5). */
  coffeeBurnoutReduction: 5,
  whistleRadius: 24,
  dashDistance: 24,
  perfectDashWindowMs: 40,
  /** Séquelle du Pétage : −8 → −5 au mieux. */
  meltdownPenaltyReduction: 3,
  /** Pétage : 8 s → 9,5 s au plus. */
  meltdownMs: 1500,
};

/**
 * Garde-fou de power creep (GDD § 9 bis.8, proposition § 8.3) : le DPS mono-cible estimé de la
 * meilleure tenue ne dépasse jamais ×1,65 celui du héros sans équipement. Les tables d'affixes
 * de la proposition permettent ≈ ×3 en théorie (Calibre ×1,35 × vitesse +25 % × critique) :
 * au-delà du plafond, `equipmentModifiers` réduit les dégâts de base (`damage.powerCapScale`).
 */
export const GEAR_POWER_CAP = 1.65;

// ─── Affixes ──────────────────────────────────────────────────────────────────

export interface AffixTier {
  readonly min: number;
  readonly max: number;
}

export type AffixTiers = readonly [AffixTier, AffixTier, AffixTier];

export interface AffixDef {
  readonly id: string;
  readonly code: string;
  readonly kind: 'prefix' | 'suffix';
  /** « affûté », « de la Relève » (nom de l'objet : `[Base] [préfixe] [suffixe]`). */
  readonly label: string;
  /** Exclusivité : deux affixes du même groupe ne cohabitent jamais sur un objet. */
  readonly group: string;
  readonly slots: readonly SlotId[];
  readonly tags: readonly AffixTag[];
  readonly weight: number;
  /** `familyMult` : S15 « de Solidarité », la famille d'Avantages est tirée avec l'affixe. */
  readonly stat: GearStat | 'familyMult';
  readonly tiers: AffixTiers;
  /** Pas d'arrondi de la valeur (0,01 pour les %, 1 pour les px et l'Énergie). */
  readonly step: number;
  /** Seconde stat portée par le même affixe (même qualité `q`). */
  readonly secondary?: {
    readonly stat: GearStat;
    readonly tiers: AffixTiers;
    readonly step: number;
  };
  /** Lot Loot 1 (20 affixes du MVP). */
  readonly mvp: boolean;
}

const t = (a: number, b: number, c: number, d: number, e: number, f: number): AffixTiers => [
  { min: a, max: b },
  { min: c, max: d },
  { min: e, max: f },
];
/** Paliers à valeur fixe. */
const tf = (a: number, b: number, c: number): AffixTiers => t(a, a, b, b, c, c);

/** 16 préfixes (P1 à P16) et 18 suffixes (S1 à S18) : proposition §§ 3.4 et 3.5. */
export const AFFIXES: readonly AffixDef[] = [
  // ── Préfixes ──
  {
    id: 'affute',
    code: 'P1',
    kind: 'prefix',
    label: 'affûté',
    group: 'affute',
    slots: ['outil', 'gants'],
    tags: ['frappe'],
    weight: 10,
    stat: 'damage',
    tiers: t(0.03, 0.05, 0.06, 0.08, 0.09, 0.12),
    step: 0.01,
    mvp: true,
  },
  {
    id: 'equilibre',
    code: 'P2',
    kind: 'prefix',
    label: 'équilibré',
    group: 'equilibre',
    slots: ['outil', 'gants'],
    tags: ['frappe'],
    weight: 10,
    stat: 'attackSpeed',
    tiers: t(0.03, 0.04, 0.05, 0.06, 0.07, 0.09),
    step: 0.01,
    mvp: true,
  },
  {
    id: 'bien-serre',
    code: 'P3',
    kind: 'prefix',
    label: 'bien serré',
    group: 'bien-serre',
    slots: ['outil'],
    tags: ['coup-final'],
    weight: 10,
    stat: 'finisherDamage',
    tiers: t(0.08, 0.12, 0.13, 0.18, 0.19, 0.25),
    step: 0.01,
    mvp: true,
  },
  {
    id: 'meticuleux',
    code: 'P4',
    kind: 'prefix',
    label: 'méticuleux',
    group: 'meticuleux',
    slots: ['outil', 'gants', 'casque'],
    tags: ['frappe'],
    weight: 10,
    stat: 'critChance',
    tiers: t(0.02, 0.03, 0.04, 0.05, 0.06, 0.07),
    step: 0.01,
    mvp: true,
  },
  {
    id: 'lourd',
    code: 'P5',
    kind: 'prefix',
    label: 'lourd',
    group: 'lourd',
    slots: ['outil', 'gants'],
    tags: ['frappe'],
    weight: 10,
    stat: 'critMult',
    tiers: t(0.1, 0.15, 0.16, 0.25, 0.26, 0.35),
    step: 0.01,
    mvp: true,
  },
  {
    id: 'sous-tension',
    code: 'P6',
    kind: 'prefix',
    label: 'sous tension',
    group: 'sous-tension',
    slots: ['gants', 'gilet'],
    tags: ['burnout'],
    weight: 10,
    stat: 'burnoutDamage',
    tiers: t(0.006, 0.008, 0.009, 0.012, 0.013, 0.016),
    step: 0.001,
    mvp: true,
  },
  {
    id: 'militant',
    code: 'P7',
    kind: 'prefix',
    label: 'militant',
    group: 'militant',
    slots: ['insigne', 'outil'],
    tags: ['mobilisation'],
    weight: 10,
    stat: 'mobilisationGain',
    tiers: t(0.08, 0.12, 0.13, 0.18, 0.19, 0.25),
    step: 0.01,
    mvp: true,
  },
  {
    id: 'en-correspondance',
    code: 'P8',
    kind: 'prefix',
    label: 'en correspondance',
    group: 'en-correspondance',
    slots: ['chaussures', 'outil'],
    tags: ['dash'],
    weight: 10,
    stat: 'dashAttackDamage',
    tiers: t(0.15, 0.2, 0.21, 0.3, 0.31, 0.4),
    step: 0.01,
    mvp: true,
  },
  {
    id: 'percutant',
    code: 'P9',
    kind: 'prefix',
    label: 'percutant',
    group: 'percutant',
    slots: ['outil', 'gants'],
    tags: ['controle'],
    weight: 10,
    stat: 'knockback',
    tiers: t(0.1, 0.15, 0.16, 0.25, 0.26, 0.35),
    step: 0.01,
    secondary: { stat: 'wallSlamDamage', tiers: t(3, 4, 5, 7, 8, 10), step: 1 },
    mvp: false,
  },
  {
    id: 'electrifie',
    code: 'P10',
    kind: 'prefix',
    label: 'électrifié',
    group: 'electrifie',
    slots: ['outil', 'gants'],
    tags: ['elec'],
    weight: 10,
    stat: 'arcDamage',
    tiers: t(6, 8, 9, 12, 13, 16),
    step: 1,
    mvp: false,
  },
  {
    id: 'verbalisant',
    code: 'P11',
    kind: 'prefix',
    label: 'verbalisant',
    group: 'verbalisant',
    slots: ['outil'],
    tags: ['controle'],
    weight: 10,
    stat: 'fineChance',
    tiers: t(0.1, 0.15, 0.16, 0.22, 0.23, 0.3),
    step: 0.01,
    mvp: false,
  },
  {
    id: 'strident',
    code: 'P12',
    kind: 'prefix',
    label: 'strident',
    group: 'strident',
    slots: ['insigne', 'casque'],
    tags: ['sifflet'],
    weight: 10,
    stat: 'whistleRadius',
    tiers: t(6, 8, 9, 12, 13, 16),
    step: 1,
    mvp: true,
  },
  {
    id: 'retentissant',
    code: 'P13',
    kind: 'prefix',
    label: 'retentissant',
    group: 'retentissant',
    slots: ['insigne'],
    tags: ['sifflet'],
    weight: 10,
    stat: 'whistleDamage',
    tiers: t(0.15, 0.2, 0.21, 0.3, 0.31, 0.4),
    step: 0.01,
    mvp: true,
  },
  {
    id: 'corse',
    code: 'P14',
    kind: 'prefix',
    label: 'corsé',
    group: 'corse',
    slots: ['insigne', 'gilet'],
    tags: ['cafe'],
    weight: 10,
    stat: 'coffeeHeal',
    tiers: t(0.03, 0.04, 0.05, 0.06, 0.07, 0.08),
    step: 0.01,
    mvp: true,
  },
  {
    id: 'decafeine',
    code: 'P15',
    kind: 'prefix',
    label: 'décaféiné',
    group: 'decafeine',
    slots: ['insigne'],
    tags: ['cafe', 'burnout'],
    weight: 10,
    stat: 'coffeeBurnoutReduction',
    tiers: tf(3, 4, 5),
    step: 1,
    mvp: false,
  },
  {
    id: 'serre',
    code: 'P16',
    kind: 'prefix',
    label: 'serré',
    group: 'serre',
    slots: ['insigne', 'gants'],
    tags: ['cafe'],
    weight: 10,
    stat: 'caffeineMs',
    tiers: tf(1000, 1500, 2000),
    step: 1,
    secondary: { stat: 'caffeineAttackSpeed', tiers: tf(0.02, 0.03, 0.04), step: 0.01 },
    mvp: false,
  },
  // ── Suffixes ──
  {
    id: 'du-depot',
    code: 'S1',
    kind: 'suffix',
    label: 'du Dépôt',
    group: 'du-depot',
    slots: ['gilet', 'casque'],
    tags: ['defense'],
    weight: 10,
    stat: 'maxEnergy',
    tiers: t(4, 6, 7, 10, 11, 15),
    step: 1,
    mvp: true,
  },
  {
    id: 'du-quai',
    code: 'S2',
    kind: 'suffix',
    label: 'du Quai',
    group: 'du-quai',
    slots: ['casque', 'gilet'],
    tags: ['defense'],
    weight: 10,
    stat: 'damageTakenReduction',
    tiers: t(0.02, 0.03, 0.04, 0.05, 0.06, 0.07),
    step: 0.01,
    mvp: true,
  },
  {
    id: 'de-sang-froid',
    code: 'S3',
    kind: 'suffix',
    label: 'de Sang-froid',
    group: 'de-sang-froid',
    slots: ['casque', 'gilet'],
    tags: ['burnout'],
    weight: 10,
    stat: 'burnoutOnHitReduction',
    tiers: t(0.06, 0.08, 0.09, 0.12, 0.13, 0.16),
    step: 0.01,
    mvp: true,
  },
  {
    id: 'de-la-releve',
    code: 'S4',
    kind: 'suffix',
    label: 'de la Relève',
    group: 'de-la-releve',
    slots: ['gilet', 'casque'],
    tags: ['burnout'],
    weight: 10,
    stat: 'burnoutDecay',
    tiers: t(0.2, 0.3, 0.4, 0.5, 0.6, 0.8),
    step: 0.1,
    mvp: true,
  },
  {
    id: 'd-anciennete',
    code: 'S5',
    kind: 'suffix',
    label: "d'Ancienneté",
    group: 'd-anciennete',
    slots: ['gilet', 'casque'],
    tags: ['burnout'],
    weight: 10,
    stat: 'burnoutFloorReduction',
    tiers: t(0.05, 0.08, 0.09, 0.12, 0.13, 0.16),
    step: 0.01,
    mvp: true,
  },
  {
    id: 'de-l-arret-maladie',
    code: 'S6',
    kind: 'suffix',
    label: "de l'Arrêt maladie",
    group: 'de-l-arret-maladie',
    slots: ['gilet'],
    tags: ['burnout'],
    weight: 10,
    stat: 'meltdownPenaltyReduction',
    tiers: tf(1, 2, 3),
    step: 1,
    mvp: false,
  },
  {
    id: 'du-coup-de-sang',
    code: 'S7',
    kind: 'suffix',
    label: 'du Coup de sang',
    group: 'du-coup-de-sang',
    slots: ['gants', 'casque'],
    tags: ['burnout'],
    weight: 10,
    stat: 'meltdownMs',
    tiers: tf(500, 1000, 1500),
    step: 1,
    mvp: false,
  },
  {
    id: 'de-l-aiguilleur',
    code: 'S8',
    kind: 'suffix',
    label: "de l'Aiguilleur",
    group: 'de-l-aiguilleur',
    slots: ['chaussures'],
    tags: ['mobilite'],
    weight: 10,
    stat: 'speed',
    tiers: t(0.02, 0.03, 0.04, 0.05, 0.06, 0.07),
    step: 0.01,
    mvp: true,
  },
  {
    id: 'de-correspondance',
    code: 'S9',
    kind: 'suffix',
    label: 'de Correspondance',
    group: 'de-correspondance',
    slots: ['chaussures'],
    tags: ['dash'],
    weight: 10,
    stat: 'dashRechargeReduction',
    tiers: t(0.05, 0.07, 0.08, 0.1, 0.11, 0.14),
    step: 0.01,
    mvp: true,
  },
  {
    id: 'du-ballast',
    code: 'S10',
    kind: 'suffix',
    label: 'du Ballast',
    group: 'du-ballast',
    slots: ['chaussures'],
    tags: ['dash'],
    weight: 10,
    stat: 'dashDistance',
    tiers: t(4, 6, 7, 9, 10, 12),
    step: 1,
    mvp: false,
  },
  {
    id: 'de-ponctualite',
    code: 'S11',
    kind: 'suffix',
    label: 'de Ponctualité',
    group: 'de-ponctualite',
    slots: ['chaussures', 'casque'],
    tags: ['dash'],
    weight: 10,
    stat: 'perfectDashWindowMs',
    tiers: t(10, 15, 16, 20, 21, 30),
    step: 1,
    mvp: true,
  },
  {
    id: 'du-contre-pied',
    code: 'S12',
    kind: 'suffix',
    label: 'du Contre-pied',
    group: 'du-contre-pied',
    slots: ['chaussures'],
    tags: ['dash'],
    weight: 10,
    stat: 'perfectDashNextHit',
    tiers: tf(0.2, 0.3, 0.4),
    step: 0.01,
    mvp: false,
  },
  {
    id: 'du-piquet',
    code: 'S13',
    kind: 'suffix',
    label: 'du Piquet',
    group: 'du-piquet',
    slots: ['insigne'],
    tags: ['mobilisation'],
    weight: 10,
    stat: 'mobilisationOnRoomEnter',
    tiers: tf(5, 8, 12),
    step: 1,
    mvp: true,
  },
  {
    id: 'de-la-colere',
    code: 'S14',
    kind: 'suffix',
    label: 'de la Colère',
    group: 'de-la-colere',
    slots: ['gilet', 'casque'],
    tags: ['mobilisation'],
    weight: 10,
    stat: 'mobilisationOnHitTaken',
    tiers: tf(2, 3, 4),
    step: 1,
    mvp: false,
  },
  {
    id: 'de-solidarite',
    code: 'S15',
    kind: 'suffix',
    label: 'de Solidarité',
    group: 'de-solidarite',
    slots: ['insigne'],
    tags: [],
    weight: 10,
    stat: 'familyMult',
    tiers: t(0.08, 0.1, 0.11, 0.14, 0.15, 0.18),
    step: 0.01,
    mvp: false,
  },
  {
    id: 'de-nuit',
    code: 'S16',
    kind: 'suffix',
    label: 'de Nuit',
    group: 'de-nuit',
    slots: ['casque'],
    tags: ['nuit'],
    weight: 10,
    stat: 'nightDamage',
    tiers: t(0.04, 0.06, 0.07, 0.09, 0.1, 0.12),
    step: 0.01,
    secondary: { stat: 'lightRadius', tiers: tf(16, 24, 32), step: 1 },
    mvp: false,
  },
  {
    id: 'de-fin-de-service',
    code: 'S17',
    kind: 'suffix',
    label: 'de Fin de service',
    group: 'de-fin-de-service',
    slots: ['gilet'],
    tags: ['defense'],
    weight: 10,
    stat: 'energyOnRoomClear',
    tiers: tf(1, 2, 3),
    step: 1,
    mvp: false,
  },
  {
    id: 'du-delegue',
    code: 'S18',
    kind: 'suffix',
    label: 'du Délégué',
    group: 'du-delegue',
    slots: ['insigne', 'gilet'],
    tags: ['economie'],
    weight: 10,
    stat: 'tickets',
    tiers: t(0.08, 0.12, 0.13, 0.18, 0.19, 0.25),
    step: 0.01,
    mvp: false,
  },
];

export const AFFIXES_BY_ID: ReadonlyMap<string, AffixDef> = new Map(AFFIXES.map((a) => [a.id, a]));

/** S15 « de Solidarité » : nom de la variante par famille (« de Josiane », « de Rudy »…). */
export const SOLIDARITE_LABELS: Readonly<Record<FamilyId, string>> = {
  josiane: 'de Josiane',
  rudy: 'de Rudy',
  bene: 'de Béné',
  yasmina: 'de Yasmina',
  kevin: 'de Kevin',
  fatou: 'de Fatou',
  marcel: 'de Marcel',
};

/** Loot ciblé par la radio (§ 5.6) : tags favorisés par chaque famille d'Avantages possédée. */
export const FAMILY_TAGS: Readonly<Record<FamilyId, readonly AffixTag[]>> = {
  josiane: ['defense'],
  rudy: ['sifflet', 'controle'],
  bene: ['controle', 'economie'],
  yasmina: ['dash', 'mobilite'],
  kevin: ['elec'],
  fatou: ['cafe', 'defense'],
  marcel: ['frappe', 'coup-final'],
};

// ─── Outils (armes) ───────────────────────────────────────────────────────────

/** Forme d'un coup d'Outil : celles de `HitShape`, plus un cercle (`at` = 0 : centré sur le héros). */
export type ToolShape =
  HitShape | { readonly kind: 'circle'; readonly radius: number; readonly at: number };

/** Coup d'Outil : même contrat que `AttackStep` (balance.ts), avec quelques effets en plus. */
export interface ToolStep extends Omit<AttackStep, 'shape'> {
  readonly shape: ToolShape;
  /** Ralentit la cible de cette fraction pendant `slowMs`. */
  readonly slow?: { readonly fraction: number; readonly ms: number };
  readonly electric?: boolean;
  /** Le coup ignore le blindage frontal (Borne) : Pied-de-biche, coup 4. */
  readonly ignoresFrontArmor?: boolean;
}

export type WeaponTrait =
  | 'casse-projectiles'
  | 'anti-blindage'
  | 'posture-x1.5'
  | 'armure-final'
  | 'halo-nuit'
  | 'electrique'
  | 'knockback-x1.25'
  | 'flaque-cafe';

export interface ToolDef {
  readonly type: WeaponType;
  readonly label: string;
  /** 2 à 4 coups. */
  readonly combo: readonly ToolStep[];
  /** Coup final : cible de « Bien serré », « Électrifié », Coupure de caténaire… */
  readonly finisherIndex: number;
  /** Coup rapide : cible des Réglages d'outil. */
  readonly quickIndex: number;
  readonly dashAttack: ToolStep;
  /** Chance de critique de base de l'Outil (remplace `HERO.CRIT_CHANCE`). */
  readonly baseCrit?: number;
  /** Vitesse de déplacement pendant l'attaque (remplace `COMBO_RULES.MOVE_FACTOR`). */
  readonly moveFactor?: number;
  readonly traits: readonly WeaponTrait[];
  /** Paramètres chiffrés des traits (halo, flaque…), lus par la sim. */
  readonly traitParams?: Readonly<Record<string, number>>;
}

type StepInput = Pick<
  ToolStep,
  'startupMs' | 'activeMs' | 'recoveryMs' | 'shape' | 'damage' | 'knockbackPx'
> &
  Partial<ToolStep>;

/** Coup avec le ressenti par défaut du GDD (hitstop 50 / 110 ms, secousses, fente). */
function step(s: StepInput, finisher = false): ToolStep {
  return {
    knockbackMs: finisher ? 160 : 100,
    stunMs: 0,
    hitstopMs: finisher ? 110 : 50,
    lungePx: finisher ? 12 : 6,
    breaksProjectiles: false,
    shakePx: finisher ? 3 : 1,
    shakeMs: finisher ? 120 : 60,
    ...s,
  };
}

const arc = (radius: number, angleDeg: number): ToolShape => ({ kind: 'arc', radius, angleDeg });
const rect = (
  from: number,
  length: number,
  width: number,
  tipRadius = 0,
  tipAt = 0,
): ToolShape => ({
  kind: 'rect',
  from,
  length,
  width,
  tipRadius,
  tipAt,
});

const CLE: ToolDef = {
  type: 'cle',
  label: 'Clé à tire-fond',
  combo: COMBO,
  finisherIndex: 2,
  quickIndex: 0,
  dashAttack: DASH_ATTACK,
  traits: ['casse-projectiles'],
};

/** Movesets des 6 types d'Outil (proposition § 4.2) et des 2 bases de Clé de la DPD (GDD § 10.4). */
export const TOOLS: Readonly<Record<string, ToolDef>> = {
  'cle-tire-fond': CLE,
  'cle-cliquet': {
    type: 'cle',
    label: 'Clé à cliquet',
    combo: [
      step({
        startupMs: 72,
        activeMs: 60,
        recoveryMs: 160,
        shape: arc(34, 100),
        damage: 10,
        knockbackPx: 14,
      }),
      step({
        startupMs: 64,
        activeMs: 60,
        recoveryMs: 160,
        shape: arc(36, 120),
        damage: 10,
        knockbackPx: 14,
      }),
      step({
        startupMs: 72,
        activeMs: 60,
        recoveryMs: 160,
        shape: arc(34, 100),
        damage: 10,
        knockbackPx: 14,
      }),
      step(
        {
          startupMs: 160,
          activeMs: 80,
          recoveryMs: 320,
          shape: rect(8, 56, 28, 20, 56),
          damage: 24,
          knockbackPx: 64,
          stunMs: 250,
          breaksProjectiles: true,
        },
        true,
      ),
    ],
    finisherIndex: 3,
    quickIndex: 0,
    dashAttack: DASH_ATTACK,
    traits: ['casse-projectiles'],
  },
  'cle-releve': {
    ...CLE,
    label: 'Clé de Relève',
    traits: ['casse-projectiles', 'flaque-cafe'],
    traitParams: {
      puddleRadius: 24,
      puddleMs: 3000,
      puddleTickMs: 500,
      puddleEnemyDamage: 4,
      puddleHeroHeal: 1,
    },
  },
  'masse-voie': {
    type: 'masse',
    label: 'Masse de voie',
    combo: [
      step({
        startupMs: 180,
        activeMs: 80,
        recoveryMs: 260,
        shape: arc(46, 150),
        damage: 20,
        knockbackPx: 36,
      }),
      step(
        {
          startupMs: 340,
          activeMs: 100,
          recoveryMs: 420,
          shape: { kind: 'circle', radius: 44, at: 34 },
          damage: 42,
          knockbackPx: 72,
          stunMs: 400,
        },
        true,
      ),
    ],
    finisherIndex: 1,
    quickIndex: 0,
    dashAttack: step({
      startupMs: 80,
      activeMs: 80,
      recoveryMs: 280,
      shape: rect(0, 48, 28),
      damage: 26,
      knockbackPx: 40,
      lungePx: 20,
    }),
    moveFactor: 0.15,
    traits: ['posture-x1.5', 'armure-final'],
    traitParams: { poiseMult: 1.5 },
  },
  'pied-de-biche': {
    type: 'pied-de-biche',
    label: 'Pied-de-biche',
    combo: [
      step({
        startupMs: 60,
        activeMs: 40,
        recoveryMs: 120,
        shape: arc(32, 80),
        damage: 8,
        knockbackPx: 10,
      }),
      step({
        startupMs: 60,
        activeMs: 40,
        recoveryMs: 120,
        shape: arc(32, 80),
        damage: 8,
        knockbackPx: 10,
      }),
      step({
        startupMs: 60,
        activeMs: 40,
        recoveryMs: 120,
        shape: arc(32, 80),
        damage: 9,
        knockbackPx: 10,
      }),
      step(
        {
          startupMs: 140,
          activeMs: 60,
          recoveryMs: 260,
          shape: rect(0, 44, 16),
          damage: 20,
          knockbackPx: -24,
          stunMs: 200,
          ignoresFrontArmor: true,
        },
        true,
      ),
    ],
    finisherIndex: 3,
    quickIndex: 0,
    dashAttack: step({
      startupMs: 50,
      activeMs: 80,
      recoveryMs: 200,
      shape: rect(0, 56, 14),
      damage: 14,
      knockbackPx: 16,
      lungePx: 20,
    }),
    baseCrit: 0.12,
    traits: ['anti-blindage'],
  },
  'lanterne-signalisation': {
    type: 'lanterne',
    label: 'Lanterne de signalisation',
    combo: [
      step({
        startupMs: 70,
        activeMs: 50,
        recoveryMs: 150,
        shape: arc(34, 100),
        damage: 10,
        knockbackPx: 14,
      }),
      step({
        startupMs: 70,
        activeMs: 50,
        recoveryMs: 150,
        shape: arc(34, 100),
        damage: 10,
        knockbackPx: 14,
      }),
      step(
        {
          startupMs: 220,
          activeMs: 80,
          recoveryMs: 300,
          shape: arc(112, 30),
          damage: 24,
          knockbackPx: 16,
          slow: { fraction: 0.4, ms: 1200 },
        },
        true,
      ),
    ],
    finisherIndex: 2,
    quickIndex: 0,
    dashAttack: step({
      startupMs: 60,
      activeMs: 80,
      recoveryMs: 200,
      shape: arc(64, 60),
      damage: 16,
      knockbackPx: 20,
      lungePx: 20,
    }),
    traits: ['halo-nuit'],
    traitParams: { lightRadius: 60, revealMs: 3000, droneGroundedMs: 1200 },
  },
  'pelle-ballast': {
    type: 'pelle',
    label: 'Pelle à ballast',
    combo: [
      step({
        startupMs: 100,
        activeMs: 70,
        recoveryMs: 200,
        shape: arc(42, 160),
        damage: 14,
        knockbackPx: 24,
      }),
      step({
        startupMs: 100,
        activeMs: 70,
        recoveryMs: 200,
        shape: arc(42, 160),
        damage: 14,
        knockbackPx: 24,
      }),
      step(
        {
          startupMs: 180,
          activeMs: 80,
          recoveryMs: 320,
          shape: arc(88, 50),
          damage: 20,
          knockbackPx: 40,
          slow: { fraction: 0.3, ms: 2000 },
        },
        true,
      ),
    ],
    finisherIndex: 2,
    quickIndex: 0,
    dashAttack: step({
      startupMs: 70,
      activeMs: 80,
      recoveryMs: 220,
      shape: { kind: 'circle', radius: 28, at: 24 },
      damage: 16,
      knockbackPx: 30,
      lungePx: 16,
    }),
    traits: ['knockback-x1.25'],
    traitParams: { knockbackMult: 1.25 },
  },
  'perche-isolante': {
    type: 'perche',
    label: 'Perche isolante',
    combo: [
      step({
        startupMs: 110,
        activeMs: 60,
        recoveryMs: 180,
        shape: rect(8, 64, 12),
        damage: 13,
        knockbackPx: 20,
      }),
      step({
        startupMs: 110,
        activeMs: 60,
        recoveryMs: 180,
        shape: rect(8, 64, 12),
        damage: 13,
        knockbackPx: 20,
      }),
      step(
        {
          startupMs: 240,
          activeMs: 90,
          recoveryMs: 360,
          shape: { kind: 'circle', radius: 56, at: 0 },
          damage: 27,
          knockbackPx: 32,
          stunMs: 200,
          electric: true,
        },
        true,
      ),
    ],
    finisherIndex: 2,
    quickIndex: 0,
    dashAttack: step({
      startupMs: 70,
      activeMs: 80,
      recoveryMs: 220,
      shape: rect(0, 80, 10),
      damage: 16,
      knockbackPx: 20,
      lungePx: 20,
    }),
    traits: ['electrique'],
    traitParams: { electricDamageBonus: 0.15, arcBounces: 1 },
  },
};

/** Outil de départ et de repli (aucun Outil équipé). */
export const DEFAULT_TOOL_ID = 'cle-tire-fond';

/** Dotations d'outil de la DPD (GDD § 10.4) : coût en Pièces et prérequis. */
export interface ToolUnlockDef {
  readonly toolId: string;
  readonly pieces: number;
  readonly boss1Kills?: number;
  readonly boss2Kills?: number;
  readonly quest?: string;
}

export const TOOL_UNLOCKS: readonly ToolUnlockDef[] = [
  { toolId: 'cle-tire-fond', pieces: 0 },
  { toolId: 'masse-voie', pieces: 2, boss1Kills: 1 },
  { toolId: 'cle-cliquet', pieces: 2, boss1Kills: 1 },
  { toolId: 'pied-de-biche', pieces: 3 },
  { toolId: 'lanterne-signalisation', pieces: 3, boss2Kills: 1 },
  { toolId: 'cle-releve', pieces: 3, boss2Kills: 1 },
  { toolId: 'pelle-ballast', pieces: 4 },
  { toolId: 'perche-isolante', pieces: 4, quest: 'dpd-perche' },
];

// ─── Bases d'objets ───────────────────────────────────────────────────────────

/** Implicite : `calibre` (Outils) ou une stat par palier. */
export type ImplicitDef =
  | { readonly kind: 'calibre' }
  | { readonly kind: 'stat'; readonly stat: GearStat; readonly tiers: AffixTiers };

export type ItemFlag = 'ballast-immune';

export interface ItemDef {
  readonly id: string;
  readonly slot: SlotId;
  readonly name: string;
  /** Ligne de saveur (docs/proposals/revue-3d-loot/narrative_level.md quand elle existe). */
  readonly flavor: string;
  readonly implicit: ImplicitDef;
  readonly flags?: readonly ItemFlag[];
  /** Outils seulement : clé de `TOOLS`. */
  readonly tool?: string;
  readonly dropWeight: number;
  readonly minIlvl: number;
  /** Référence du modèle 3D (tech-art). */
  readonly meshId: string;
}

const stat = (s: GearStat, a: number, b: number, c: number): ImplicitDef => ({
  kind: 'stat',
  stat: s,
  tiers: tf(a, b, c),
});

export const ITEMS: readonly ItemDef[] = [
  // Outils : un par Dotation d'outil.
  {
    id: 'cle-tire-fond',
    slot: 'outil',
    name: 'Clé à tire-fond',
    flavor: 'Même modèle que celle du grand-père. En moins honnête.',
    implicit: { kind: 'calibre' },
    tool: 'cle-tire-fond',
    dropWeight: 10,
    minIlvl: 1,
    meshId: 'outil-cle',
  },
  {
    id: 'cle-cliquet',
    slot: 'outil',
    name: 'Clé à cliquet',
    flavor: 'Quatre crans, zéro hésitation. Le cliquet ne revient jamais en arrière.',
    implicit: { kind: 'calibre' },
    tool: 'cle-cliquet',
    dropWeight: 10,
    minIlvl: 1,
    meshId: 'outil-cle-cliquet',
  },
  {
    id: 'cle-releve',
    slot: 'outil',
    name: 'Clé de Relève',
    flavor: 'Le manche sent le café. Le café, lui, sent la relève.',
    implicit: { kind: 'calibre' },
    tool: 'cle-releve',
    dropWeight: 10,
    minIlvl: 1,
    meshId: 'outil-cle-releve',
  },
  {
    id: 'masse-voie',
    slot: 'outil',
    name: 'Masse de voie',
    flavor: 'Lente, lourde, définitive. Comme une décision prise sur le terrain.',
    implicit: { kind: 'calibre' },
    tool: 'masse-voie',
    dropWeight: 10,
    minIlvl: 1,
    meshId: 'outil-masse',
  },
  {
    id: 'pied-de-biche',
    slot: 'outil',
    name: 'Pied-de-biche',
    flavor: 'Ouvre les caisses, les capots et, à l’occasion, les discussions.',
    implicit: { kind: 'calibre' },
    tool: 'pied-de-biche',
    dropWeight: 10,
    minIlvl: 1,
    meshId: 'outil-pied-de-biche',
  },
  {
    id: 'lanterne-signalisation',
    slot: 'outil',
    name: 'Lanterne de signalisation',
    flavor: 'Agitée correctement, elle arrête un train. Agitée très fort, un consultant.',
    implicit: { kind: 'calibre' },
    tool: 'lanterne-signalisation',
    dropWeight: 10,
    minIlvl: 1,
    meshId: 'outil-lanterne',
  },
  {
    id: 'pelle-ballast',
    slot: 'outil',
    name: 'Pelle à ballast',
    flavor: 'Le ballast se remet toujours en place. Les consultants, moins.',
    implicit: { kind: 'calibre' },
    tool: 'pelle-ballast',
    dropWeight: 10,
    minIlvl: 1,
    meshId: 'outil-pelle',
  },
  {
    id: 'perche-isolante',
    slot: 'outil',
    name: 'Perche isolante',
    flavor: 'Trois mètres d’allonge. Personne n’a osé la reprendre depuis le pot de départ.',
    implicit: { kind: 'calibre' },
    tool: 'perche-isolante',
    dropWeight: 10,
    minIlvl: 1,
    meshId: 'outil-perche',
  },
  // Casques
  {
    id: 'casque-chantier',
    slot: 'casque',
    name: 'Casque de chantier',
    flavor: 'Fendu en 2014, réformé en 2023, porté depuis par principe.',
    implicit: stat('damageTakenReduction', 0.03, 0.05, 0.07),
    dropWeight: 10,
    minIlvl: 1,
    meshId: 'casque-chantier',
  },
  {
    id: 'casque-antibruit',
    slot: 'casque',
    name: 'Casque antibruit',
    flavor: 'Coupe trente décibels d’annonces et cent pour cent des « on s’aligne ».',
    implicit: stat('slowResist', 0.15, 0.2, 0.25),
    dropWeight: 10,
    minIlvl: 1,
    meshId: 'casque-antibruit',
  },
  {
    id: 'casque-lampe',
    slot: 'casque',
    name: 'Casque à lampe frontale',
    flavor: 'Éclaire là où les néons ne vont jamais : sous les quais.',
    implicit: stat('lightRadius', 24, 32, 40),
    dropWeight: 10,
    minIlvl: 1,
    meshId: 'casque-lampe',
  },
  // Gilets
  {
    id: 'gilet-classe2',
    slot: 'gilet',
    name: 'Gilet classe 2',
    flavor: 'Haute visibilité, basse reconnaissance.',
    implicit: stat('maxEnergy', 5, 10, 15),
    dropWeight: 10,
    minIlvl: 1,
    meshId: 'gilet-classe2',
  },
  {
    id: 'gilet-signaleur',
    slot: 'gilet',
    name: 'Gilet de signaleur',
    flavor: 'Sept poches, sept sifflets de rechange. Rudy nie.',
    implicit: stat('mobilisationOnHitTaken', 2, 3, 4),
    dropWeight: 10,
    minIlvl: 1,
    meshId: 'gilet-signaleur',
  },
  {
    id: 'parka-nuit',
    slot: 'gilet',
    name: 'Parka de nuit',
    flavor:
      'Le col sent encore le café de 4 h. Son conducteur est parti ; la parka, elle, roule toujours.',
    implicit: stat('burnoutFloorReduction', 0.05, 0.08, 0.12),
    dropWeight: 10,
    minIlvl: 1,
    meshId: 'gilet-parka',
  },
  // Gants
  {
    id: 'gants-manutention',
    slot: 'gants',
    name: 'Gants de manutention',
    flavor: 'Le trou du pouce est d’origine. Le reste aussi, à peu près.',
    implicit: stat('attackSpeed', 0.03, 0.05, 0.07),
    dropWeight: 10,
    minIlvl: 1,
    meshId: 'gants-manutention',
  },
  {
    id: 'gants-isolants',
    slot: 'gants',
    name: 'Gants isolants',
    flavor: 'Testés à mille volts, puis à deux heures du matin, ce qui est pire.',
    implicit: stat('electricDamage', 0.1, 0.15, 0.2),
    dropWeight: 10,
    minIlvl: 1,
    meshId: 'gants-isolants',
  },
  {
    id: 'mitaines-quai',
    slot: 'gants',
    name: 'Mitaines de quai',
    flavor: 'Pour taper un billet dans un guichet sans chauffage. Béné a reconnu la maille.',
    implicit: stat('critChance', 0.02, 0.03, 0.04),
    dropWeight: 10,
    minIlvl: 1,
    meshId: 'gants-mitaines',
  },
  // Chaussures
  {
    id: 'chaussures-coquees',
    slot: 'chaussures',
    name: 'Chaussures coquées',
    flavor: 'Ressemelées trois fois. Le cuir est d’époque, la semelle est de la semaine.',
    implicit: stat('speed', 0.03, 0.05, 0.07),
    dropWeight: 10,
    minIlvl: 1,
    meshId: 'chaussures-coquees',
  },
  {
    id: 'bottes-voie',
    slot: 'chaussures',
    name: 'Bottes de voie',
    flavor: 'Ignorent le ballast. Pas le mal de dos.',
    implicit: stat('speed', 0.02, 0.03, 0.04),
    flags: ['ballast-immune'],
    dropWeight: 10,
    minIlvl: 1,
    meshId: 'chaussures-bottes',
  },
  {
    id: 'baskets-securite',
    slot: 'chaussures',
    name: 'Baskets de sécurité',
    flavor: 'Pour le quai 3 quand il drache. Il drache toujours sur le quai 3.',
    implicit: stat('dashRechargeReduction', 0.04, 0.06, 0.08),
    dropWeight: 10,
    minIlvl: 1,
    meshId: 'chaussures-baskets',
  },
  // Insignes
  {
    id: 'badge-syndical',
    slot: 'insigne',
    name: 'Badge syndical',
    flavor: 'Remis dans une enveloppe kraft, sans discours. Le discours, c’est toi.',
    implicit: stat('mobilisationGain', 0.05, 0.08, 0.12),
    dropWeight: 10,
    minIlvl: 1,
    meshId: 'insigne-badge',
  },
  {
    id: 'sifflet-laiton',
    slot: 'insigne',
    name: 'Sifflet en laiton',
    flavor: 'Il a arrêté plus de trains que de discussions. Pour l’instant.',
    implicit: stat('whistleRadius', 4, 6, 8),
    dropWeight: 10,
    minIlvl: 1,
    meshId: 'insigne-sifflet',
  },
  {
    id: 'thermos-cabosse',
    slot: 'insigne',
    name: 'Thermos cabossé',
    flavor: 'Chaque bosse est une nuit de service. Le café, lui, est resté chaud.',
    implicit: stat('coffeeHeal', 0.02, 0.03, 0.04),
    dropWeight: 10,
    minIlvl: 1,
    meshId: 'insigne-thermos',
  },
  {
    id: 'montre-service',
    slot: 'insigne',
    name: 'Montre de service',
    flavor: 'Elle avance de quatre minutes. Exprès.',
    implicit: stat('caffeineMs', 500, 1000, 1500),
    dropWeight: 10,
    minIlvl: 1,
    meshId: 'insigne-montre',
  },
];

export const ITEMS_BY_ID: ReadonlyMap<string, ItemDef> = new Map(ITEMS.map((i) => [i.id, i]));

// ─── Légendaires « Patrimoine » ───────────────────────────────────────────────

export type LegendaryPowerId =
  | 'cliquet-perpetuel'
  | 'parade-wagon-bar'
  | 'derniere-traverse'
  | 'demonte-tout'
  | 'feu-rouge'
  | 'cocotte-minute'
  | 'comite-de-greve'
  | 'dernier-train'
  | 'thermos-inepuisable'
  | 'carnet-revendications'
  | 'haute-visibilite'
  | 'boule-a-facettes'
  | 'ruban-inaugural';

export interface LegendaryDef {
  readonly id: string;
  readonly code: string;
  readonly baseId: string;
  readonly name: string;
  readonly power: LegendaryPowerId;
  readonly powerText: string;
  readonly drawbackText: string;
  /** Contrepartie exprimable en stats (ajoutée à l'agrégat, avant les plafonds). */
  readonly drawback: Readonly<Partial<Record<GearStat, number>>>;
  /** Chiffres du pouvoir et de la contrepartie, lus par la sim (aucun nombre magique ailleurs). */
  readonly params: Readonly<Record<string, number>>;
  /** Affixes interdits sur cet objet (le pouvoir les rend sans effet). */
  readonly excludes?: readonly string[];
  /** Ne tombe qu'une fois son Plan archivé (offert au 1er kill du boss qui le porte). */
  readonly requiresPlan?: boolean;
  /** Jamais tiré au hasard (récompense de quête). */
  readonly questOnly?: boolean;
  readonly flavor: string;
}

/** 13 Patrimoines : L1 à L11 de la proposition, L12 (Discosaure) et L13 (Boss 2, GDD § 9 bis.4). */
export const LEGENDARIES: readonly LegendaryDef[] = [
  {
    id: 'cle-cliquet-perpetuel',
    code: 'L1',
    baseId: 'cle-tire-fond',
    name: 'Clé à cliquet perpétuel',
    power: 'cliquet-perpetuel',
    powerText:
      'Le combo ne se réinitialise plus ; chaque boucle complète sans être touché donne +6 % de dégâts (5 cumuls), perdus au premier coup reçu.',
    drawbackText: 'Enchaînement plus tardif : 80 → 100 ms.',
    drawback: {},
    params: { stackDamage: 0.06, maxStacks: 5, chainFromRecoveryMs: 100 },
    flavor: 'Elle tourne dans un seul sens. Comme les revendications.',
  },
  {
    id: 'cle-wagon-bar',
    code: 'L2',
    baseId: 'cle-tire-fond',
    name: 'Clé du Wagon-Bar',
    power: 'parade-wagon-bar',
    powerText:
      'Le startup du coup 1 devient une parade de 200 ms : projectiles renvoyés ×1,5, mêlée étourdie 600 ms, +10 Mobilisation.',
    drawbackText: 'Coup 1 : −25 % de dégâts.',
    drawback: {},
    params: {
      parryMs: 200,
      reflectMult: 1.5,
      stunMs: 600,
      mobilisation: 10,
      firstHitDamageMult: 0.75,
    },
    questOnly: true,
    flavor: 'Elle a servi des croque-monsieur à trois générations de cheminots.',
  },
  {
    id: 'derniere-traverse',
    code: 'L3',
    baseId: 'masse-voie',
    name: 'La Dernière Traverse',
    power: 'derniere-traverse',
    powerText:
      'Le coup final laisse une faille (120×14 px) qui éclate 500 ms plus tard pour 60 % des dégâts du coup et ralentit de 40 % pendant 1,5 s.',
    drawbackText: "Vitesse d'attaque −10 %.",
    drawback: { attackSpeed: -0.1 },
    params: {
      riftLength: 120,
      riftWidth: 14,
      riftDelayMs: 500,
      riftDamageMult: 0.6,
      slow: 0.4,
      slowMs: 1500,
    },
    flavor: 'Posée en 1932, arrachée en 2032. Elle n’a pas dit son dernier mot.',
  },
  {
    id: 'demonte-tout',
    code: 'L4',
    baseId: 'pied-de-biche',
    name: 'Le Démonte-tout',
    power: 'demonte-tout',
    powerText:
      'Le coup 4 démonte : Borne hors service 3 s et sans blindage, Drone au sol 2 s, posture d’élite cassée, boss +50 %.',
    drawbackText: 'Coups 1 à 3 : −10 % de dégâts.',
    drawback: {},
    params: {
      borneOffMs: 3000,
      droneGroundedMs: 2000,
      eliteCooldownMs: 10000,
      bossBonus: 0.5,
      quickHitsDamageMult: 0.9,
    },
    flavor: 'Tout ce qui a été monté sans concertation peut être démonté.',
  },
  {
    id: 'feu-rouge',
    code: 'L5',
    baseId: 'lanterne-signalisation',
    name: 'Feu rouge',
    power: 'feu-rouge',
    powerText:
      'Les ennemis pris dans le faisceau du coup 3 sont « à l’arrêt » : aucun nouveau télégraphe pendant 1,5 s (élites 0,5 s ; boss +25 % de dégâts subis).',
    drawbackText: 'Halo de Nuit −40 px.',
    drawback: { lightRadius: -40 },
    params: { stopMs: 1500, eliteStopMs: 500, bossDamageTaken: 0.25 },
    flavor: 'La dernière lanterne de la lampisterie. Elle brûle depuis 1987, par habitude.',
  },
  {
    id: 'casque-cocotte-minute',
    code: 'L6',
    baseId: 'casque-chantier',
    name: 'Casque Cocotte-minute',
    power: 'cocotte-minute',
    powerText:
      'Le Pétage de plombs ne se déclenche plus : Burnout bloqué à 99. Au-dessus de 90, une soupape part toutes les 2 s (onde de 48 px, 15 dégâts × Calibre).',
    drawbackText:
      'Récupération passive du Burnout −50 % ; « Au bout du rouleau » : dégâts subis +25 → +35 %.',
    drawback: {},
    params: {
      burnoutCap: 99,
      valveFrom: 90,
      valveEveryMs: 2000,
      valveRadius: 48,
      valveDamage: 15,
      valveKnockback: 24,
      decayMult: 0.5,
      edgeDamageTaken: 0.35,
    },
    excludes: ['du-coup-de-sang', 'de-l-arret-maladie'],
    flavor: 'Siffle quand ça monte. Ne saute jamais. Enfin, presque.',
  },
  {
    id: 'gilet-comite-de-greve',
    code: 'L7',
    baseId: 'gilet-signaleur',
    name: 'Gilet du Comité de grève',
    power: 'comite-de-greve',
    powerText:
      'Mobilisation 0–200 : au-dessus de 100, deux Préavis enchaînés ; à 200, Grève générale (rayon 160 px, stun 3 s, Piquet 6 s).',
    drawbackText: 'Mobilisation gagnée −20 %.',
    drawback: { mobilisationGain: -0.2 },
    params: {
      mobilisationMax: 200,
      doublePreavisFrom: 100,
      strikeRadius: 160,
      strikeStunMs: 3000,
      strikeEliteStunMs: 1000,
      piquetMs: 6000,
    },
    flavor: 'Brodé à la main, voté à main levée.',
  },
  {
    id: 'bottes-dernier-train',
    code: 'L8',
    baseId: 'bottes-voie',
    name: 'Bottes du Dernier Train',
    power: 'dernier-train',
    powerText:
      'Le dash devient une glissade sur rail : 144 px en 220 ms, i-frames complètes, 20 dégâts × Calibre aux ennemis traversés ; un dash parfait rend la charge et place le combo sur le coup final.',
    drawbackText: '1 seule charge de dash, sans bonus de charges ; recharge 1 200 ms.',
    drawback: {},
    params: {
      distancePx: 144,
      durationMs: 220,
      damage: 20,
      widthPx: 16,
      rechargeMs: 1200,
      charges: 1,
    },
    excludes: ['de-correspondance', 'du-ballast'],
    flavor: 'Elles ont raté le dernier train une seule fois. Plus jamais depuis.',
  },
  {
    id: 'thermos-inepuisable',
    code: 'L9',
    baseId: 'thermos-cabosse',
    name: 'Thermos inépuisable',
    power: 'thermos-inepuisable',
    powerText:
      'Chaque Gobelet devient 25 gorgées ; maintenir R boit en continu (1 gorgée / 100 ms : 1 % d’Énergie max, +0,6 Burnout) en se déplaçant à 70 %.',
    drawbackText: 'Impossible de boire pendant 1 s après un coup reçu.',
    drawback: {},
    params: {
      sipsPerGobelet: 25,
      sipEveryMs: 100,
      sipHeal: 0.01,
      sipBurnout: 0.6,
      moveFactor: 0.7,
      caffeineAfterMs: 3000,
      lockoutAfterHitMs: 1000,
    },
    excludes: ['decafeine'],
    flavor: 'Rempli une fois en 1987. Jamais vidé depuis, d’après Marcel.',
  },
  {
    id: 'carnet-revendications',
    code: 'L10',
    baseId: 'badge-syndical',
    name: 'Carnet de revendications',
    power: 'carnet-revendications',
    powerText:
      'Chaque salle nettoyée sans boire donne une Revendication : +4 % de dégâts (8 cumuls) ; boire consomme tout et soigne +2 % par cumul.',
    drawbackText: 'Les cumuls disparaissent aussi au Pétage de plombs.',
    drawback: {},
    params: { stackDamage: 0.04, maxStacks: 8, healPerStack: 0.02 },
    flavor: 'Toutes les pages sont remplies. Il en reste toujours une.',
  },
  {
    id: 'gilet-haute-visibilite',
    code: 'L11',
    baseId: 'gilet-classe2',
    name: 'Gilet Haute visibilité absolue',
    power: 'haute-visibilite',
    powerText: 'Fenêtre de dash parfait ×2 ; un dash parfait rend une charge entière.',
    drawbackText: 'Toujours « Signalé » : +10 % de dégâts subis, les Bornes tirent 25 % plus vite.',
    drawback: { damageTakenIncrease: 0.1 },
    params: { perfectWindowMult: 2, chargeRefund: 1, borneFireRateMult: 1.25 },
    flavor: 'On le voit de Quévy. On le voit même de Bruxelles, quand il fait beau.',
  },
  {
    id: 'boule-a-facettes',
    code: 'L12',
    baseId: 'montre-service',
    name: 'Boule à facettes de poche',
    power: 'boule-a-facettes',
    powerText:
      'Chaque dash parfait pose 3 taches de lumière orange pendant 4 s, qui infligent 6 dégâts toutes les 0,5 s aux ennemis.',
    drawbackText: 'Mobilisation gagnée par les dégâts −15 %.',
    drawback: {},
    params: {
      spots: 3,
      spotMs: 4000,
      spotTickMs: 500,
      spotDamage: 6,
      mobilisationFromDamageMult: 0.85,
    },
    requiresPlan: true,
    flavor: 'La musique ne s’arrête jamais. Le Discosaure non plus, en principe.',
  },
  {
    id: 'ruban-inaugural',
    code: 'L13',
    baseId: 'badge-syndical',
    name: 'Ruban inaugural',
    power: 'ruban-inaugural',
    powerText:
      'Au début de chaque salle de combat, une Promesse absorbe un coup ; si elle n’a pas servi à la fin de la salle : « promesse tenue », +15 Mobilisation.',
    drawbackText: 'Énergie max −10.',
    drawback: { maxEnergy: -10 },
    params: { shieldsPerRoom: 1, keptMobilisation: 15 },
    requiresPlan: true,
    flavor: 'Coupé, recousu, épinglé. Inauguré… provisoirement.',
  },
];

export const LEGENDARIES_BY_ID: ReadonlyMap<string, LegendaryDef> = new Map(
  LEGENDARIES.map((l) => [l.id, l]),
);

// ─── Attelages (sets) ─────────────────────────────────────────────────────────

export type SetSpecialId =
  'plancher-nuit' | 'attaque-surprise' | 'preavis-80' | 'arcs-rebond-ralenti' | 'pause-legale';

export interface SetBonusDef {
  readonly count: number;
  readonly text: string;
  readonly stats: Readonly<Partial<Record<GearStat, number>>>;
  readonly special?: SetSpecialId;
  readonly params?: Readonly<Record<string, number>>;
}

export interface SetDef {
  readonly id: string;
  readonly name: string;
  /** Ids de bases (`ITEMS`). */
  readonly pieces: readonly string[];
  readonly bonuses: readonly SetBonusDef[];
}

export const SETS: readonly SetDef[] = [
  {
    id: 'tenue-de-nuit',
    name: 'Tenue de Nuit',
    pieces: ['casque-lampe', 'parka-nuit', 'bottes-voie', 'mitaines-quai'],
    bonuses: [
      {
        count: 2,
        text: 'Halo +40 px ; +5 % de dégâts la Nuit',
        stats: { lightRadius: 40, nightDamage: 0.05 },
      },
      {
        count: 3,
        text: 'Plancher de Nuit ×1,5 → ×1,25',
        stats: {},
        special: 'plancher-nuit',
        params: { nightFloorMult: 1.25 },
      },
      {
        count: 4,
        text: 'Ennemis hors du halo : +25 % de dégâts subis',
        stats: {},
        special: 'attaque-surprise',
        params: { damageTaken: 0.25 },
      },
    ],
  },
  {
    id: 'paquetage-delegue',
    name: 'Paquetage du Délégué',
    pieces: ['badge-syndical', 'gilet-signaleur', 'casque-antibruit'],
    bonuses: [
      {
        count: 2,
        text: "+15 Mobilisation à l'entrée de chaque salle",
        stats: { mobilisationOnRoomEnter: 15 },
      },
      {
        count: 3,
        text: 'Le Préavis coûte 80',
        stats: {},
        special: 'preavis-80',
        params: { preavisCost: 80 },
      },
    ],
  },
  {
    id: 'equipement-catenaire',
    name: 'Équipement de caténaire',
    pieces: ['perche-isolante', 'gants-isolants', 'baskets-securite'],
    bonuses: [
      {
        count: 2,
        text: 'Le dash laisse une traînée électrique (4 dégâts / 0,5 s)',
        stats: { dashTrailDamage: 4 },
      },
      {
        count: 3,
        text: 'Arcs électriques : +1 rebond, ralentissent de 20 % pendant 1 s',
        stats: {},
        special: 'arcs-rebond-ralenti',
        params: { bounces: 1, slow: 0.2, slowMs: 1000 },
      },
    ],
  },
  {
    id: 'bleu-de-travail',
    name: 'Bleu de travail du Dépôt',
    pieces: ['casque-chantier', 'gilet-classe2', 'gants-manutention', 'chaussures-coquees'],
    bonuses: [
      { count: 2, text: 'Dégâts subis −5 %', stats: { damageTakenReduction: 0.05 } },
      { count: 3, text: '+1 Gobelet maximum', stats: { maxGobelets: 1 } },
      {
        count: 4,
        text: 'Bouclier « Pause légale » toutes les 45 s',
        stats: {},
        special: 'pause-legale',
        params: { shieldEveryMs: 45000 },
      },
    ],
  },
];

export const SETS_BY_ID: ReadonlyMap<string, SetDef> = new Map(SETS.map((s) => [s.id, s]));

// ─── Tirage : item level, raretés, sources ────────────────────────────────────

export const LOOT_RULES = {
  ILVL_MIN: 1,
  ILVL_MAX: 30,
  /** Premier ilvl de chaque palier (I, II, III). */
  TIER_FROM: [1, 10, 19] as const,
  /** Paquetage du Vestiaire : ilvl effectif = min(ilvl, r + 3). */
  EFFECTIVE_ILVL_SLACK: 3,
  /** Implicite des Outils : dégâts de base ×(1 + 0,012 × (ilvl − 1)). */
  CALIBRE_PER_ILVL: 0.012,
  /** Patrimoine plafonné à 6 % par objet (hors garanties et pitié). */
  PATRIMOINE_CAP: 0.06,
  /** Avancement : points par r au-delà de 1, pris sur la rareté la plus basse disponible. */
  SHIFT_PER_ROOM: { homologue: 0.2, 'hors-serie': 0.08, patrimoine: 0.02 },
  /** Roulement de Nuit. */
  SHIFT_NIGHT: { homologue: 2, 'hors-serie': 0.8, patrimoine: 0.2 },
  /** Plan d'Économies : +0,3 pt de Hors-série par point (28 points au plus). */
  PLAN_HORS_SERIE_PER_POINT: 0.3,
  PLAN_MAX_POINTS: 28,
  /** Réclamation : après 5 objets d'affilée sous Homologué, le suivant est au moins Homologué. */
  RECLAMATION_AFTER: 5,
  /** Ancienneté du butin (méta) : +0,15 pt de Patrimoine par objet, plafond 8. */
  PITY_STEP: 0.15,
  PITY_CAP: 8,
  /** Prime de bienvenue : Patrimoine garanti à ce kill du Boss 1 si aucun n'est tombé. */
  WELCOME_BOSS1_KILL: 3,
  /** Pièce d'Attelage : chance qu'un Hors-série d'une base d'Attelage en soit une. */
  SET_PIECE_CHANCE: 0.35,
  /** Affixes aléatoires d'une pièce d'Attelage (en plus de l'affixe fixe d'Attelage). */
  SET_PIECE_AFFIXES: 3,
  /** Aimant d'attelage : poids des autres pièces d'un Attelage déjà porté. */
  SET_MAGNET: 3,
  /** Loot ciblé : poids des affixes dont un tag correspond à une famille possédée. */
  TAG_BIAS: 1.5,
  /** Préfixes et suffixes au plus par objet (relâché si l'emplacement n'a pas assez d'affixes d'un type). */
  MAX_PER_KIND: 2,
  /** Sac de service pendant le Shift. */
  BAG_SIZE: 4,
} as const;

/** Bonus d'ilvl par source (§ 5.1). */
export const ILVL_SOURCE_BONUS: Readonly<Record<DropSource, number>> = {
  ennemi: 0,
  caisse: 0,
  dotation: 1,
  casier: 1,
  evenement: 1,
  elite: 2,
  gardee: 2,
  boss: 3,
  'boss-premier': 3,
  friterie: 1,
  'wagon-bar': 1,
};

/** Bonus d'ilvl par roulement (§ 5.1). */
export const ILVL_SHIFT_BONUS: Readonly<Record<ShiftId, number>> = {
  matin: 0,
  'apres-midi': 1,
  nuit: 2,
};

type RarityWeights = Readonly<Record<ItemRarity, number>>;

/** Poids de rareté par source, base r = 1, Matin (§ 5.3). */
export const RARITY_WEIGHTS: Readonly<Record<DropSource, RarityWeights>> = {
  ennemi: { reforme: 60, reglementaire: 30, homologue: 8.5, 'hors-serie': 1.3, patrimoine: 0.2 },
  caisse: { reforme: 50, reglementaire: 35, homologue: 12, 'hors-serie': 2.6, patrimoine: 0.4 },
  dotation: { reforme: 0, reglementaire: 62, homologue: 30, 'hors-serie': 7, patrimoine: 1 },
  casier: { reforme: 0, reglementaire: 55, homologue: 33, 'hors-serie': 10, patrimoine: 2 },
  evenement: { reforme: 0, reglementaire: 55, homologue: 33, 'hors-serie': 10, patrimoine: 2 },
  elite: { reforme: 0, reglementaire: 45, homologue: 40, 'hors-serie': 12.5, patrimoine: 2.5 },
  gardee: { reforme: 0, reglementaire: 45, homologue: 40, 'hors-serie': 12.5, patrimoine: 2.5 },
  boss: { reforme: 0, reglementaire: 0, homologue: 70, 'hors-serie': 25, patrimoine: 5 },
  'boss-premier': { reforme: 0, reglementaire: 0, homologue: 0, 'hors-serie': 90, patrimoine: 10 },
  friterie: { reforme: 0, reglementaire: 0, homologue: 100, 'hors-serie': 0, patrimoine: 0 },
  'wagon-bar': { reforme: 0, reglementaire: 0, homologue: 0, 'hors-serie': 0, patrimoine: 100 },
};

/** Sources dont la rareté est garantie : ni plafond Patrimoine, ni décalages (§ 5.3). */
export const FIXED_RARITY_SOURCES: readonly DropSource[] = [
  'boss-premier',
  'friterie',
  'wagon-bar',
];

/** Ennemis tués : chance de lâcher un objet (§ 5.2). `securite` : Agent de sécurité (biome 3). */
export type LootEnemyKind = EnemyKind | 'securite';

export const KILL_DROP_CHANCE: Readonly<Record<LootEnemyKind, number>> = {
  consultant: 0.03,
  drone: 0.03,
  borne: 0.05,
  securite: 0.06,
  /** Élites et boss : butin par `dropsForSource('elite' | 'boss')`, pas par cette table. */
  manager: 0,
  auditeur: 0,
  furet: 0,
  fluidifieur: 0,
  discosaure: 0,
  dirupo: 0,
  vanderslide: 0,
};

/** Nombre d'objets par source (§ 5.2 et GDD § 9 bis.5). */
export const DROP_COUNTS = {
  ELITE: 1,
  ELITE_SECOND_CHANCE: 0.25,
  GARDEE: 2,
  /** Boss 1 / Boss 2 / final. */
  BOSS: [2, 3, 3] as const,
  DOTATION_OPTIONS: 2,
} as const;

// ─── Ferraille, DPD, PACO, Vestiaire ──────────────────────────────────────────

export const SCRAP = {
  /** Bonus d'ilvl : +floor(ilvl / 10). */
  ILVL_DIVISOR: 10,
  /** Objet laissé au sol en quittant une salle : 50 %. */
  GROUND_RATIO: 0.5,
  /** PACO (Béné) : réaffûtage, 12 + 6 par relance déjà faite. */
  REFORGE_BASE: 12,
  REFORGE_STEP: 6,
  REFORGE_OPTIONS: 3,
  /** DPD (Josiane) : polissage, q + 0,10. */
  POLISH_COST: 8,
  POLISH_STEP: 0.1,
  /** DPD : remise à niveau, ilvl +3 (30 au plus), 15 + 1 par niveau visé. */
  RAISE_BASE: 15,
  RAISE_STEP: 3,
  /** DPD : 25 Ferraille → 1 Pièce, une fois par Shift. */
  PIECE_RATE: 25,
} as const;

export const VESTIAIRE = {
  CAPACITY: 24,
  CAPACITY_PER_RANK: 12,
  PAQUETAGE: 1,
  PAQUETAGE_PER_RANK: 1,
  CONSIGN_DEATH: 1,
  CONSIGN_VICTORY: 2,
  CONSIGN_PER_RANK: 1,
} as const;
