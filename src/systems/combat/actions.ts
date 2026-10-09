import { BALANCE } from '@/config/balance';
import { enemyDef, isEnemyId, isSkillId, itemDef, MAX_ENEMIES, skillDef } from '@/data/combat';
import type { EnemyId, ItemId, SkillDef, SkillId, TargetMode } from '@/data/combat';
import type { Combatant, Side } from '@/systems/combat/types';
import type { Ctx } from '@/systems/combat/context';
import {
  addFatigue,
  applyStatus,
  dealDamage,
  effectiveDefense,
  effectiveForce,
  effectiveSpeed,
  emit,
  getCombatant,
  hasStatus,
  heal,
  living,
  NO_EFFECTS,
  opposite,
  pauseOf,
  restorePe,
  setEngine,
  setFx,
  tierOf,
  updateCombatant,
} from '@/systems/combat/context';
import {
  computeDamage,
  ENEMY_CRIT_CHANCE,
  enemyStats,
  healAmount,
  heroCritChance,
  hitChance,
  variance,
} from '@/systems/combat/formulas';
import { pick, rollPercent } from '@/utils/rng';

/**
 * Résolution des actions (un seul résolveur générique pour les compétences, GDD § 8.3), communes
 * à l'équipe et aux ennemis. Les cibles sont relatives à l'utilisateur : `enemy` = le camp d'en face.
 */

const C = BALANCE.combat;

/** Puissance de l'attaque de base. */
export const ATTACK_POWER = 100;

// ---------------------------------------------------------------------------
// Ciblage
// ---------------------------------------------------------------------------

/** Cibles légales d'un mode pour un combattant d'un camp (provocation prise en compte). */
export function targetsFor(
  ctx: Pick<Ctx, 'state'>,
  side: Side,
  mode: TargetMode,
  selfId: string | null,
): readonly string[] {
  const state = ctx.state;
  switch (mode) {
    case 'enemy': {
      const foes = living(state, opposite(side));
      const taunters = foes.filter((c) => c.fx.tauntTurns > 0);
      return (taunters.length > 0 ? taunters : foes).map((c) => c.id);
    }
    case 'all-enemies':
      return living(state, opposite(side)).map((c) => c.id);
    case 'ally':
    case 'all-allies':
      return living(state, side).map((c) => c.id);
    case 'self':
      return selfId === null ? [] : [selfId];
  }
}

/** Confusion : 40 % de chance qu'une action à cible unique vise n'importe quel combattant debout. */
function confusedTarget(ctx: Ctx, actor: Combatant, intended: string): string {
  if (!hasStatus(actor, 'confusion')) return intended;
  if (!(ctx.rng() < BALANCE.status.CONFUSION.misdirectChance)) return intended;
  const random = pick(ctx.rng, living(ctx.state));
  if (!random || random.id === intended) return intended;
  emit(ctx, {
    kind: 'message',
    text: `${actor.name} est confus·e et vise ${random.name} !`,
  });
  return random.id;
}

// ---------------------------------------------------------------------------
// Frappe
// ---------------------------------------------------------------------------

interface StrikeSpec {
  readonly power: number;
  readonly ignoreDef?: number;
  readonly alwaysHit?: boolean;
  readonly skillId?: SkillId;
  readonly weakMult?: number;
}

function isWeakTo(target: Combatant, skillId: SkillId | undefined): boolean {
  if (skillId === undefined || target.enemyId === null) return false;
  return (enemyDef(target.enemyId).weakTo ?? []).includes(skillId);
}

/**
 * Un coup (attaque ou compétence offensive) : jets de précision, de critique puis de variance, dans cet ordre.
 * Renvoie vrai si le coup a touché.
 */
function strike(ctx: Ctx, actorId: string, targetId: string, spec: StrikeSpec): boolean {
  const state = ctx.state;
  const actor = getCombatant(state, actorId);
  const target = getCombatant(state, targetId);
  const isParty = actor.side === 'party';
  const tier = tierOf(state);
  const pause = pauseOf(state);

  if (!spec.alwaysHit) {
    const chance = hitChance({
      attackerSpeed: effectiveSpeed(actor),
      defenderSpeed: effectiveSpeed(target),
      tierAcc: isParty ? tier.acc : 0,
      pauseAcc: isParty ? pause.accBonus : 0,
      statusAcc: hasStatus(actor, 'cafeine') ? BALANCE.status.CAFEINE.acc : 0,
      dodge: target.fx.dodge,
    });
    if (!rollPercent(ctx.rng, chance)) {
      emit(ctx, { kind: 'miss', actorId, targetId });
      return false;
    }
  }

  const critPct = isParty
    ? heroCritChance({
        moral: state.moral,
        demotivated: hasStatus(actor, 'demotive'),
        tierCrit: tier.crit,
        pauseCrit: pause.critBonus,
      })
    : ENEMY_CRIT_CHANCE;
  const critical = rollPercent(ctx.rng, critPct);
  const weak = isWeakTo(target, spec.skillId);
  const amount = computeDamage({
    force: effectiveForce(actor),
    power: spec.power,
    defense: effectiveDefense(state, target),
    ignoreDef: spec.ignoreDef ?? 0,
    variance: variance(ctx.rng()),
    critical,
    tierMult: isParty ? tier.dmg : 1,
    demotivated: hasStatus(actor, 'demotive'),
    defending: target.fx.defending,
    shielded: target.fx.shieldTurns > 0,
    weaknessMult: weak ? (spec.weakMult ?? C.WEAKNESS_MULT) : 1,
    extraMult: target.fx.tauntTurns > 0 ? target.fx.guardMult : 1,
  });
  dealDamage(ctx, targetId, amount, critical, weak);
  return true;
}

/** Attaquer : puissance 100 sur une cible. */
export function performAttack(ctx: Ctx, actorId: string, targetId: string): void {
  const actor = getCombatant(ctx.state, actorId);
  emit(ctx, { kind: 'action', actorId, label: 'Attaque' });
  strike(ctx, actorId, confusedTarget(ctx, actor, targetId), { power: ATTACK_POWER });
}

// ---------------------------------------------------------------------------
// Compétences
// ---------------------------------------------------------------------------

function offensiveHit(ctx: Ctx, actorId: string, targetId: string, id: SkillId, def: SkillDef) {
  const target = getCombatant(ctx.state, targetId);
  if (target.ko) return;
  if (def.breaksShield && target.fx.shieldTurns > 0) {
    setFx(ctx, targetId, { shieldTurns: 0 });
    emit(ctx, { kind: 'message', text: `Le bouclier de ${target.name} vole en éclats !` });
  }
  const actor = getCombatant(ctx.state, actorId);
  const allies = living(ctx.state, actor.side).length;
  const power = (def.power ?? 0) + (def.powerPerAlly ?? 0) * allies;
  const hit = strike(ctx, actorId, targetId, {
    power,
    skillId: id,
    ...(def.ignoreDef === undefined ? {} : { ignoreDef: def.ignoreDef }),
    ...(def.alwaysHit === undefined ? {} : { alwaysHit: def.alwaysHit }),
    ...(def.weakMult === undefined ? {} : { weakMult: def.weakMult }),
  });
  if (!hit) return;
  const after = getCombatant(ctx.state, targetId);
  if (def.cancelsSummon && isWeakTo(after, id) && !after.fx.summonSpent) {
    const summon = after.enemyId === null ? undefined : enemyDef(after.enemyId).summon;
    setFx(ctx, targetId, { summonSpent: true });
    if (summon && !after.ko) {
      emit(ctx, { kind: 'message', text: `${after.name} n'a pas de réponse : invocation annulée.` });
    }
  }
  if (def.status !== undefined && !after.ko) {
    applyStatus(ctx, targetId, def.status, def.statusChance ?? null, actor.side);
  }
}

function supportEffect(ctx: Ctx, actorId: string, targetId: string, def: SkillDef): void {
  const actor = getCombatant(ctx.state, actorId);
  const target = getCombatant(ctx.state, targetId);
  if (target.ko) return;
  if (def.healPct !== undefined) heal(ctx, targetId, healAmount(target.maxHp, def.healPct));
  if (def.actsLast) sendToBack(ctx, targetId);
  if (def.status !== undefined) {
    applyStatus(ctx, targetId, def.status, def.statusChance ?? null, actor.side);
  }
}

/** « File d'attente » : la cible joue en dernier dans la manche (ou la suivante si elle a déjà joué). */
function sendToBack(ctx: Ctx, targetId: string): void {
  const { order, engine } = ctx.state;
  const pos = order.indexOf(targetId);
  const target = getCombatant(ctx.state, targetId);
  if (pos > engine.turnIndex) {
    ctx.state = { ...ctx.state, order: [...order.filter((id) => id !== targetId), targetId] };
  } else {
    setFx(ctx, targetId, { actsLast: true });
  }
  emit(ctx, { kind: 'message', text: `${target.name} passe en fin de file.` });
}

/** Invocation (« Je loop un junior ») : un renfort du même niveau, sans invocation propre. */
function summon(ctx: Ctx, actorId: string): void {
  const actor = getCombatant(ctx.state, actorId);
  setFx(ctx, actorId, { summonSpent: true });
  const spec = actor.enemyId === null ? undefined : enemyDef(actor.enemyId).summon;
  if (!spec || living(ctx.state, 'enemy').length >= MAX_ENEMIES) {
    emit(ctx, { kind: 'message', text: 'Personne ne répond à la convocation.' });
    return;
  }
  const enemyId = spec.enemy;
  if (!isEnemyId(enemyId)) throw new Error(`Invocation inconnue : ${enemyId}`);
  const spawned = ctx.state.engine.spawned + 1;
  const combatant = createEnemy(enemyId, actor.level, ctx.state.engine.shift, spawned, '');
  setEngine(ctx, { spawned });
  ctx.state = {
    ...ctx.state,
    combatants: [...ctx.state.combatants, { ...combatant, fx: { ...combatant.fx, summonSpent: true } }],
  };
  emit(ctx, { kind: 'summon', combatantId: combatant.id });
}

/** Crée un ennemi à son niveau, avec le multiplicateur de stats de la pause. */
export function createEnemy(
  enemyId: EnemyId,
  level: number,
  shift: keyof typeof BALANCE.pause,
  serial: number,
  suffix: string,
): Combatant {
  const def = enemyDef(enemyId);
  const stats = enemyStats(def, level, BALANCE.pause[shift].enemyStatMult);
  return {
    id: `${enemyId}#${String(serial)}`,
    side: 'enemy',
    name: suffix === '' ? def.name : `${def.name} ${suffix}`,
    sprite: def.sprite,
    enemyId,
    tier: def.tier,
    level,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    pe: 0,
    maxPe: 0,
    force: stats.force,
    defense: stats.defense,
    speed: stats.speed,
    skills: def.skills.filter(isSkillId),
    statuses: [],
    ko: false,
    fx: { ...NO_EFFECTS, dodge: def.dodge ?? 0, resistance: def.resistance },
  };
}

/**
 * Compétence : coût, annonce, effets sur soi et sur son camp, puis effet par cible.
 * `targetId` est requis pour les modes à cible unique (validé par l'appelant).
 */
export function performSkill(
  ctx: Ctx,
  actorId: string,
  id: SkillId,
  targetId: string | undefined,
): void {
  const def = skillDef(id);
  const actor = getCombatant(ctx.state, actorId);
  if (actor.side === 'party') {
    updateCombatant(ctx, actorId, (c) => ({ ...c, pe: c.pe - def.peCost }));
    if (def.fatigueCost !== undefined) addFatigue(ctx, def.fatigueCost);
  } else if (def.cooldown !== undefined) {
    setFx(ctx, actorId, { cooldowns: { ...actor.fx.cooldowns, [id]: def.cooldown } });
  }
  emit(ctx, { kind: 'action', actorId, label: def.name });

  if (def.taunt !== undefined) {
    setFx(ctx, actorId, { tauntTurns: def.taunt, guardMult: def.guardMult ?? 1 });
    emit(ctx, { kind: 'message', text: `${actor.name} attire tous les regards.` });
  }
  if (def.shieldTurns !== undefined) {
    for (const ally of living(ctx.state, actor.side)) {
      setFx(ctx, ally.id, { shieldTurns: def.shieldTurns });
    }
    emit(ctx, { kind: 'message', text: 'Un bouclier de slides protège le camp adverse.' });
  }
  if (def.summon) {
    summon(ctx, actorId);
    return;
  }

  const offensive = def.power !== undefined;
  const hits = def.hits ?? 1;
  const single = def.target === 'enemy' || def.target === 'ally';
  for (let i = 0; i < hits; i += 1) {
    let targets: readonly string[];
    if (hits > 1) {
      const random = pick(ctx.rng, targetsFor(ctx, actor.side, def.target, actorId));
      targets = random === undefined ? [] : [random];
    } else if (single) {
      targets = targetId === undefined ? [] : [confusedTarget(ctx, actor, targetId)];
    } else {
      targets = targetsFor(ctx, actor.side, def.target, actorId);
    }
    for (const t of targets) {
      if (offensive) offensiveHit(ctx, actorId, t, id, def);
      else supportEffect(ctx, actorId, t, def);
      if (ctx.state.outcome !== null) return;
    }
  }
}

// ---------------------------------------------------------------------------
// Objets, Café, Défendre
// ---------------------------------------------------------------------------

export function performItem(
  ctx: Ctx,
  actorId: string,
  id: ItemId,
  targetId: string | undefined,
): void {
  const def = itemDef(id);
  const actor = getCombatant(ctx.state, actorId);
  const count = ctx.state.inventory[id] ?? 0;
  ctx.state = { ...ctx.state, inventory: { ...ctx.state.inventory, [id]: count - 1 } };
  emit(ctx, { kind: 'action', actorId, label: def.name });
  const single = def.target === 'enemy' || def.target === 'ally';
  const targets =
    single && targetId !== undefined
      ? [confusedTarget(ctx, actor, targetId)]
      : targetsFor(ctx, actor.side, def.target, actorId);
  if (def.fatigue !== undefined) addFatigue(ctx, def.fatigue);
  for (const t of targets) {
    if (def.healHp !== undefined) heal(ctx, t, def.healHp);
    if (def.pe !== undefined) restorePe(ctx, t, def.pe);
    if (def.status !== undefined) {
      applyStatus(ctx, t, def.status, def.statusChance ?? null, actor.side);
    }
  }
}

/** Café : un Gobelet de l'OCC, Fatigue −20 et Caféiné sur le buveur. */
export function performCafe(ctx: Ctx, actorId: string): void {
  ctx.state = { ...ctx.state, gobelets: ctx.state.gobelets - 1 };
  emit(ctx, { kind: 'action', actorId, label: 'Café' });
  addFatigue(ctx, -BALANCE.fatigue.recovery.GOBELET);
  applyStatus(ctx, actorId, 'cafeine', null, 'party');
}

export function performDefend(ctx: Ctx, actorId: string): void {
  setFx(ctx, actorId, { defending: true });
  emit(ctx, { kind: 'action', actorId, label: 'Défendre' });
}
