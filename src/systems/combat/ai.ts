import { enemyDef, ENEMY_HEAL_THRESHOLD, isSkillId, skillDef } from '@/data/combat';
import type { SkillId } from '@/data/combat';
import { targetsFor } from '@/systems/combat/actions';
import type { Ctx } from '@/systems/combat/context';
import { getCombatant, living, pauseOf } from '@/systems/combat/context';
import { pick } from '@/utils/rng';

/**
 * IA des ennemis (GDD § 5.5, § 6.3) : pas de PE mais des recharges, et une IA à poids
 * (matin et après-midi : 60 % attaque / 40 % compétence disponible ; nuit : 80 % attaque).
 * Comportements imposés, par priorité : tour perdu (Stagiaire), invocation, ouverture, compétence planifiée.
 */
export type EnemyDecision =
  | { readonly kind: 'idle'; readonly label: string }
  | { readonly kind: 'attack'; readonly targetId: string }
  | { readonly kind: 'skill'; readonly skillId: SkillId; readonly targetId?: string };

function readySkill(id: string | undefined): SkillId | undefined {
  return id !== undefined && isSkillId(id) ? id : undefined;
}

export function decideEnemy(ctx: Ctx, actorId: string): EnemyDecision | null {
  const state = ctx.state;
  const actor = getCombatant(state, actorId);
  if (actor.enemyId === null) throw new Error(`${actorId} n'est pas un ennemi`);
  const def = enemyDef(actor.enemyId);
  const foes = targetsFor(ctx, 'enemy', 'enemy', actorId);

  if (def.idleChance !== undefined && ctx.rng() < def.idleChance) {
    return { kind: 'idle', label: def.idleLabel ?? 'hésite' };
  }

  const summonSkill = readySkill(def.summon?.skill);
  if (
    summonSkill &&
    def.summon &&
    !actor.fx.summonSpent &&
    state.round > def.summon.afterRound
  ) {
    return { kind: 'skill', skillId: summonSkill };
  }

  const opening = readySkill(def.openingSkill);
  if (opening && actor.fx.turnsTaken === 0) return withTarget(ctx, actorId, opening);

  const scheduled = readySkill(def.scheduledSkill?.skill);
  if (scheduled && def.scheduledSkill && state.round % def.scheduledSkill.every === 0) {
    return withTarget(ctx, actorId, scheduled);
  }

  const pool = actor.skills.filter((id) => {
    if ((actor.fx.cooldowns[id] ?? 0) > 0 || id === scheduled || id === summonSkill) return false;
    const skill = skillDef(id);
    if (skill.healPct !== undefined) return woundedAlly(ctx, actorId) !== undefined;
    return true;
  });
  const attack = ctx.rng() < pauseOf(state).aiAttackWeight;
  const chosen = attack ? undefined : pick(ctx.rng, pool);
  if (chosen) return withTarget(ctx, actorId, chosen);

  const target = pick(ctx.rng, foes);
  return target === undefined ? null : { kind: 'attack', targetId: target };
}

/** Allié ennemi le plus entamé, sous le seuil de soin. */
function woundedAlly(ctx: Ctx, actorId: string): string | undefined {
  const actor = getCombatant(ctx.state, actorId);
  const wounded = living(ctx.state, actor.side)
    .filter((c) => c.hp < c.maxHp * ENEMY_HEAL_THRESHOLD)
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
  return wounded[0]?.id;
}

function withTarget(ctx: Ctx, actorId: string, skillId: SkillId): EnemyDecision {
  const skill = skillDef(skillId);
  if (skill.target === 'enemy' && (skill.hits ?? 1) === 1) {
    const target = pick(ctx.rng, targetsFor(ctx, 'enemy', 'enemy', actorId));
    return target === undefined ? { kind: 'skill', skillId } : { kind: 'skill', skillId, targetId: target };
  }
  if (skill.target === 'ally') {
    const target = woundedAlly(ctx, actorId) ?? actorId;
    return { kind: 'skill', skillId, targetId: target };
  }
  return { kind: 'skill', skillId };
}
