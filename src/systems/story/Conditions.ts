import type { ActNumber } from '@/config/balance';
import type { Condition, Interaction, StoryFlag } from '@/data/types';

/** Ce dont une condition a besoin pour être évaluée (sous-ensemble du GameState). */
export interface ConditionContext {
  readonly flags: Readonly<Partial<Record<StoryFlag, boolean>>>;
  readonly act: ActNumber;
  /** Minute in-game courante (réapparition des groupes d'ennemis). Absente = groupes toujours présents. */
  readonly now?: number;
  /** Groupes d'ennemis vaincus : clé de marqueur → minute de la victoire. */
  readonly defeated?: Readonly<Record<string, number>>;
}

export function hasFlag(flags: ConditionContext['flags'], flag: StoryFlag): boolean {
  return flags[flag] === true;
}

/** Vrai si la condition est absente ou si tous ses critères sont remplis. */
export function evaluateCondition(
  condition: Condition | undefined,
  ctx: ConditionContext,
): boolean {
  if (!condition) return true;
  if (condition.act !== undefined && condition.act !== ctx.act) return false;
  const expected = condition.flags ?? {};
  return (Object.keys(expected) as StoryFlag[]).every(
    (flag) => hasFlag(ctx.flags, flag) === expected[flag],
  );
}

/** Première interaction dont la condition est vraie, ou `null`. */
export function firstMatching(
  interactions: readonly Interaction[] | undefined,
  ctx: ConditionContext,
): Interaction | null {
  return (interactions ?? []).find((i) => evaluateCondition(i.when, ctx)) ?? null;
}
