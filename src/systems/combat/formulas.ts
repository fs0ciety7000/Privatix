import { BALANCE } from '@/config/balance';
import type { CombatTier, EnemyDef } from '@/data/combat';
import { clamp } from '@/utils/math';

/**
 * Formules du combat (GDD § 5.3, § 5.7, § 6.1), sans état ni aléatoire : les jets sont passés en paramètre.
 * Ce sont elles que vérifient les exemples chiffrés du GDD § 5.4 (tests/combat.test.ts).
 */

const C = BALANCE.combat;

/** INITIATIVE = floor(Vit × multInitPalier × 1,25 si Caféiné) + randInt(0, 5). */
export function initiative(
  speed: number,
  initMult: number,
  caffeinated: boolean,
  roll: number,
): number {
  const caf = caffeinated ? BALANCE.status.CAFEINE.speedMult : 1;
  return Math.floor(speed * initMult * caf) + roll;
}

export interface HitParams {
  readonly attackerSpeed: number;
  readonly defenderSpeed: number;
  /** Précision du palier de Fatigue (camp du joueur uniquement). */
  readonly tierAcc?: number;
  /** Bonus de pause du héros (« Vigilance »). */
  readonly pauseAcc?: number;
  /** Statuts de l'attaquant (Caféiné +10). */
  readonly statusAcc?: number;
  readonly dodge?: number;
}

/** TOUCHER % = clamp(90 + (Vit_att − Vit_déf) + précisions − esquive, 30, 99). */
export function hitChance(p: HitParams): number {
  const raw =
    C.BASE_HIT +
    (p.attackerSpeed - p.defenderSpeed) +
    (p.tierAcc ?? 0) +
    (p.pauseAcc ?? 0) +
    (p.statusAcc ?? 0) -
    (p.dodge ?? 0);
  return clamp(raw, C.HIT_MIN, C.HIT_MAX);
}

/** MoralEffectif = Moral − 30 si Démotivé (plancher 0). */
export function effectiveMoral(moral: number, demotivated: boolean): number {
  return Math.max(0, moral - (demotivated ? BALANCE.status.DEMOTIVE.moralPenalty : 0));
}

export interface CritParams {
  readonly moral: number;
  readonly demotivated?: boolean;
  readonly tierCrit?: number;
  readonly pauseCrit?: number;
  readonly equipCrit?: number;
}

/** CRITIQUE % (héros) = min(50, 5 + floor(MoralEffectif / 10) + palier + pause + équipement). */
export function heroCritChance(p: CritParams): number {
  const moral = effectiveMoral(p.moral, p.demotivated ?? false);
  return Math.min(
    C.CRIT_CAP,
    C.CRIT_BASE +
      Math.floor(moral / C.CRIT_PER_MORAL) +
      (p.tierCrit ?? 0) +
      (p.pauseCrit ?? 0) +
      (p.equipCrit ?? 0),
  );
}

/** CRITIQUE % des ennemis. */
export const ENEMY_CRIT_CHANCE: number = C.CRIT_BASE;

export interface DamageParams {
  readonly force: number;
  readonly power: number;
  readonly defense: number;
  readonly ignoreDef?: number;
  /** 0,9 à 1,1. */
  readonly variance: number;
  readonly critical?: boolean;
  /** Multiplicateur du palier de Fatigue (camp du joueur uniquement). */
  readonly tierMult?: number;
  readonly demotivated?: boolean;
  readonly defending?: boolean;
  readonly shielded?: boolean;
  /** Faiblesse : ×2 (ou multiplicateur propre à la compétence). 1 sinon. */
  readonly weaknessMult?: number;
  /** Autres multiplicateurs de dégâts reçus (provocation de Josiane ×0,8). */
  readonly extraMult?: number;
}

/** Dégâts bruts = Force × 2 × (puissance / 100) − Déf × 1 × (1 − ignoreDéf). */
export function rawDamage(force: number, power: number, defense: number, ignoreDef = 0): number {
  return force * C.ATK_MULT * (power / 100) - defense * C.DEF_MULT * (1 - ignoreDef);
}

/** DÉGÂTS = max(1, floor(max(1, brut) × variance × crit × palier × Démotivé × Défendre × Bouclier × Faiblesse)). */
export function computeDamage(p: DamageParams): number {
  const raw = Math.max(1, rawDamage(p.force, p.power, p.defense, p.ignoreDef ?? 0));
  const mult =
    p.variance *
    (p.critical ? C.CRIT_MULT : 1) *
    (p.tierMult ?? 1) *
    (p.demotivated ? BALANCE.status.DEMOTIVE.dmgMult : 1) *
    (p.defending ? C.DEFEND_MULT : 1) *
    (p.shielded ? C.SHIELD_MULT : 1) *
    (p.weaknessMult ?? 1) *
    (p.extraMult ?? 1);
  return Math.max(1, Math.floor(raw * mult));
}

/** Variance des dégâts à partir d'un tirage dans [0, 1[ : 0,9 + r × 0,2. */
export function variance(roll: number): number {
  return C.VARIANCE_MIN + roll * C.VARIANCE_RANGE;
}

/** SOIN = floor(PVmax × pourcentage). */
export function healAmount(maxHp: number, pct: number): number {
  return Math.floor(maxHp * pct);
}

/** STATUT % = clamp(chanceBase − résistance, 5, 95). */
export function statusChance(base: number, resistance: number): number {
  return clamp(base - resistance, C.STATUS_CHANCE_MIN, C.STATUS_CHANCE_MAX);
}

/** Résistance du héros et des collègues = min(50, floor(MoralEffectif / 2)) + équipement + palier (−20 en Burn-out). */
export function partyResistance(
  moral: number,
  demotivated: boolean,
  tierStatusRes: number,
  equipRes = 0,
): number {
  return (
    Math.min(C.HERO_RES_CAP, Math.floor(effectiveMoral(moral, demotivated) / 2)) +
    equipRes +
    tierStatusRes
  );
}

/** Résistance des ennemis selon leur type (normal 10, élite 30, boss 50). */
export function enemyResistance(tier: CombatTier): number {
  return C.ENEMY_RES[tier];
}

const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

/** FUITE % = clamp(50 + (Vit_moy_équipe − Vit_moy_ennemis) × 3, 10, 90). */
export function fleeChance(partySpeeds: readonly number[], enemySpeeds: readonly number[]): number {
  return clamp(
    C.FLEE_BASE + (average(partySpeeds) - average(enemySpeeds)) * C.FLEE_PER_SPEED,
    C.FLEE_MIN,
    C.FLEE_MAX,
  );
}

export interface EnemyStats {
  readonly maxHp: number;
  readonly force: number;
  readonly defense: number;
  readonly speed: number;
}

/** Stats d'un ennemi (GDD § 6.1) : formule × coefficient × variante × pause, arrondi inférieur. */
export function enemyStats(def: EnemyDef, level: number, pauseMult: number): EnemyStats {
  const { hp, force, def: defense, speed } = BALANCE.enemies.STAT_FORMULA;
  const mult = (def.statMult ?? 1) * pauseMult;
  const at = ([base, growth]: readonly [number, number], coef: number): number =>
    Math.floor((base + growth * level) * coef * mult);
  return {
    maxHp: Math.max(1, at(hp, def.coef[0])),
    force: at(force, def.coef[1]),
    defense: at(defense, def.coef[2]),
    speed: at(speed, def.coef[3]),
  };
}

/** XP d'un ennemi = round(round(6 × niv^1,5 + 10) × multType × multPauseXP). */
export function enemyXp(level: number, tier: CombatTier, pauseXpMult: number): number {
  const { base, coef, exp, typeMult } = BALANCE.enemies.XP;
  return Math.round(Math.round(coef * level ** exp + base) * typeMult[tier] * pauseXpMult);
}

/** Tickets d'un ennemi = round((3 × niv + randInt(0, niv)) × multTypeT × multPauseT). */
export function enemyTickets(
  level: number,
  tier: CombatTier,
  pauseTicketMult: number,
  bonusRoll: number,
): number {
  const { perLevel, eliteMult } = BALANCE.enemies.TICKETS;
  const typeMult = tier === 'normal' ? 1 : eliteMult;
  return Math.round((perLevel * level + bonusRoll) * typeMult * pauseTicketMult);
}
