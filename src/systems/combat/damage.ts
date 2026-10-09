import type { Rng } from '@/utils/rng';

export interface DamageRoll {
  readonly amount: number;
  readonly crit: boolean;
}

export interface OutgoingMods {
  /** Bonus additif de dégâts (0,25 = +25 %). */
  readonly damageBonus: number;
  readonly critChance: number;
  readonly critMult: number;
}

/** Dégâts infligés par le héros : base × (1 + bonus), critique éventuel, arrondi entier ≥ 1. */
export function rollOutgoing(base: number, mods: OutgoingMods, rng: Rng): DamageRoll {
  const crit = rng() < mods.critChance;
  const raw = base * (1 + mods.damageBonus) * (crit ? mods.critMult : 1);
  return { amount: Math.max(1, Math.round(raw)), crit };
}

/** Dégâts reçus : base × (1 + bonus de dégâts subis), arrondi entier ≥ 1. */
export function incoming(base: number, takenBonus: number): number {
  return Math.max(1, Math.round(base * (1 + takenBonus)));
}

/** Facteurs de difficulté d'un ennemi pour la salle `room` (1-indexée). */
export interface EnemyScale {
  readonly hp: number;
  readonly damage: number;
  readonly speed: number;
}

export function enemyScale(
  room: number,
  shift: { readonly hpMult: number; readonly damageMult: number; readonly speedMult: number },
  rates: {
    readonly HP_PER_ROOM: number;
    readonly DAMAGE_PER_ROOM: number;
    readonly SPEED_PER_ROOM: number;
    readonly SPEED_CAP: number;
  },
): EnemyScale {
  const r = Math.max(0, room - 1);
  const speed = Math.min(rates.SPEED_CAP, 1 + rates.SPEED_PER_ROOM * r);
  return {
    hp: (1 + rates.HP_PER_ROOM * r) * shift.hpMult,
    damage: (1 + rates.DAMAGE_PER_ROOM * r) * shift.damageMult,
    speed: speed * shift.speedMult,
  };
}
