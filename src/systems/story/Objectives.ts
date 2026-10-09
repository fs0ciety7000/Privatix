import type { ObjectiveDef } from '@/data/types';
import type { ConditionContext } from '@/systems/story/Conditions';
import { evaluateCondition } from '@/systems/story/Conditions';

/** Premier objectif non atteint de la liste, ou `null` si tout est fait. */
export function currentObjective(
  objectives: readonly ObjectiveDef[],
  ctx: ConditionContext,
): ObjectiveDef | null {
  return objectives.find((o) => !evaluateCondition(o.doneWhen, ctx)) ?? null;
}
