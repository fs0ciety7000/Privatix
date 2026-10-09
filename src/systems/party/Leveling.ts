import { BALANCE } from '@/config/balance';
import type { AllyId } from '@/data/types';

/**
 * Niveaux et stats (GDD § 8.1) : `stat(L) = floor(base + croissance × (L − 1)) × coefAllié`.
 * Les collègues ont le niveau du héros (XP partagée) et leurs propres coefficients.
 */
export type PartyMemberId = 'heros' | AllyId;

export interface MemberStats {
  readonly maxHp: number;
  readonly maxPe: number;
  readonly force: number;
  readonly defense: number;
  readonly speed: number;
}

/** XP pour passer du niveau `level` au suivant : round(40 × L^1,5). */
export function xpToNext(level: number): number {
  return Math.round(BALANCE.progression.XP_BASE * level ** BALANCE.progression.XP_EXP);
}

/** Ajoute de l'XP ; gère plusieurs montées de niveau d'un coup, plafonne au niveau 20. */
export function gainXp(
  level: number,
  xp: number,
  gained: number,
): { level: number; xp: number; levelsGained: number } {
  let l = level;
  let x = xp + Math.max(0, gained);
  while (l < BALANCE.progression.MAX_LEVEL && x >= xpToNext(l)) {
    x -= xpToNext(l);
    l += 1;
  }
  if (l >= BALANCE.progression.MAX_LEVEL) x = 0;
  return { level: l, xp: x, levelsGained: l - level };
}

const COEF_KEYS = { hp: 0, force: 1, def: 2, speed: 3 } as const;

/** Stats de base d'un membre de l'équipe au niveau donné (sans équipement). */
export function statsAt(member: PartyMemberId, level: number): MemberStats {
  const { HERO, ALLY_COEF } = BALANCE.progression;
  const coef: readonly number[] = member === 'heros' ? [1, 1, 1, 1] : ALLY_COEF[member];
  const at = ([base, growth]: readonly [number, number], k: keyof typeof COEF_KEYS): number =>
    Math.floor(Math.floor(base + growth * (level - 1)) * (coef[COEF_KEYS[k]] ?? 1));
  return {
    maxHp: at(HERO.hp, 'hp'),
    maxPe: Math.floor(HERO.pe[0] + HERO.pe[1] * (level - 1)),
    force: at(HERO.force, 'force'),
    defense: at(HERO.def, 'def'),
    speed: at(HERO.speed, 'speed'),
  };
}
