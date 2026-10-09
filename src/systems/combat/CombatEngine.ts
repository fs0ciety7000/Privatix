import { BALANCE } from '@/config/balance';
import {
  ENCOUNTERS,
  enemyDef,
  isEnemyId,
  isItemId,
  isSkillId,
  itemDef,
  ITEMS,
  SKILLS,
  skillDef,
} from '@/data/combat';
import type { ItemId, SkillId, TargetMode } from '@/data/combat';
import {
  createEnemy,
  performAttack,
  performCafe,
  performDefend,
  performItem,
  performSkill,
  targetsFor,
} from '@/systems/combat/actions';
import { decideEnemy } from '@/systems/combat/ai';
import type { Ctx } from '@/systems/combat/context';
import {
  dealDamage,
  effectiveSpeed,
  emit,
  findCombatant,
  getCombatant,
  hasStatus,
  living,
  NO_EFFECTS,
  pauseOf,
  removeStatus,
  restorePe,
  setEngine,
  setFx,
  tierOf,
  updateCombatant,
} from '@/systems/combat/context';
import {
  enemyTickets,
  enemyXp,
  fleeChance,
  initiative,
} from '@/systems/combat/formulas';
import type {
  ActionAvailability,
  BattleAction,
  BattleRewards,
  BattleSetup,
  BattleState,
  BattleStep,
  Combatant,
  PartyMemberId,
  Rng,
} from '@/systems/combat/types';
import { clamp } from '@/utils/math';
import { randInt, rollPercent } from '@/utils/rng';

/**
 * Moteur de combat au tour par tour (GDD § 5). Fonctions pures : l'état reçu n'est jamais modifié,
 * l'aléatoire est injecté. Contrat et déroulement : `src/systems/combat/types.ts`.
 */

/** Garde-fou contre une boucle de tours sans décision du joueur. */
const MAX_AUTO_TURNS = 10_000;

const SUFFIXES = 'ABCDEFGH';

// ---------------------------------------------------------------------------
// Mise en place
// ---------------------------------------------------------------------------

function partyCombatant(member: BattleSetup['party'][number]): Combatant {
  const hp = clamp(member.hp, 0, member.maxHp);
  return {
    id: member.id,
    side: 'party',
    name: member.name,
    sprite: member.sprite,
    enemyId: null,
    tier: 'normal',
    level: member.level,
    hp,
    maxHp: member.maxHp,
    pe: clamp(member.pe, 0, member.maxPe),
    maxPe: member.maxPe,
    force: member.force,
    defense: member.defense,
    speed: member.speed,
    skills: member.skills,
    statuses: [],
    ko: hp <= 0,
    fx: NO_EFFECTS,
  };
}

export function startBattle(setup: BattleSetup, rng: Rng): BattleStep {
  if (setup.party.length < 1 || setup.party.length > 3) {
    throw new Error("L'équipe compte de 1 à 3 membres");
  }
  const encounter = ENCOUNTERS[setup.encounterId];
  const counts = new Map<string, number>();
  encounter.enemies.forEach((e) => counts.set(e.enemy, (counts.get(e.enemy) ?? 0) + 1));
  const seen = new Map<string, number>();
  const enemies = encounter.enemies.map((e, i) => {
    if (!isEnemyId(e.enemy)) throw new Error(`Ennemi inconnu : ${e.enemy}`);
    const rank = seen.get(e.enemy) ?? 0;
    seen.set(e.enemy, rank + 1);
    const suffix = (counts.get(e.enemy) ?? 0) > 1 ? (SUFFIXES[rank] ?? String(rank + 1)) : '';
    return createEnemy(e.enemy, e.level, setup.shift, i + 1, suffix);
  });
  const noFleeTier = enemies.some((e) => e.tier !== 'normal');

  const state: BattleState = {
    encounterId: setup.encounterId,
    round: 0,
    order: [],
    combatants: [...setup.party.map(partyCombatant), ...enemies],
    fatigue: clamp(setup.fatigue, 0, BALANCE.fatigue.MAX),
    moral: setup.moral,
    inventory: { ...setup.inventory },
    gobelets: setup.gobelets,
    outcome: null,
    engine: {
      shift: setup.shift,
      canFlee: encounter.canFlee && !noFleeTier,
      turnIndex: 0,
      fleeAttempted: false,
      partyLosesRound: false,
      collapsed: [],
      spawned: enemies.length,
    },
  };
  const ctx: Ctx = { state, events: [], rng };
  advance(ctx);
  return { state: ctx.state, events: ctx.events };
}

// ---------------------------------------------------------------------------
// Manches et tours
// ---------------------------------------------------------------------------

/** Début de manche : passifs, initiative recalculée (égalité : camp du joueur d'abord), frise. */
function startRound(ctx: Ctx): void {
  const round = ctx.state.round + 1;
  for (const c of living(ctx.state, 'enemy')) {
    const growth = c.enemyId === null ? undefined : enemyDef(c.enemyId).forceGrowth;
    if (growth) setFx(ctx, c.id, { forceBonus: Math.min(growth.cap, (round - 1) * growth.perRound) });
  }
  const tier = tierOf(ctx.state);
  const scored = living(ctx.state).map((c, index) => ({
    c,
    index,
    score: initiative(
      c.speed,
      c.side === 'party' ? tier.init : 1,
      hasStatus(c, 'cafeine'),
      randInt(ctx.rng, 0, BALANCE.combat.INIT_RANDOM),
    ),
  }));
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      Number(a.c.side === 'enemy') - Number(b.c.side === 'enemy') ||
      a.index - b.index,
  );
  const first = scored.filter((s) => !s.c.fx.actsLast).map((s) => s.c.id);
  const last = scored.filter((s) => s.c.fx.actsLast).map((s) => s.c.id);
  last.forEach((id) => { setFx(ctx, id, { actsLast: false }); });
  const order = [...first, ...last];
  ctx.state = {
    ...ctx.state,
    round,
    order,
    engine: { ...ctx.state.engine, turnIndex: 0, fleeAttempted: false, partyLosesRound: false },
  };
  emit(ctx, { kind: 'roundStart', round, order });
}

type TurnStart = 'act' | 'skip' | 'blocked' | 'dead';

/**
 * Début du tour d'un combattant : régénération de PE (doublée après Défendre), recharges et effets
 * décomptés, Burn-out, puis tours sautés (Effondré, Bloqué, Sommeil).
 */
function beginTurn(ctx: Ctx, id: string): TurnStart {
  emit(ctx, { kind: 'turnStart', actorId: id });
  const c = getCombatant(ctx.state, id);
  if (c.side === 'party') {
    restorePe(ctx, id, tierOf(ctx.state).peRegen * (c.fx.defending ? 2 : 1));
  }
  const cooldowns = Object.fromEntries(
    Object.entries(c.fx.cooldowns).map(([k, v]) => [k, Math.max(0, v - 1)]),
  );
  setFx(ctx, id, {
    defending: false,
    cooldowns,
    shieldTurns: Math.max(0, c.fx.shieldTurns - 1),
    tauntTurns: Math.max(0, c.fx.tauntTurns - 1),
  });

  if (hasStatus(c, 'burnout')) {
    const loss = Math.max(1, Math.floor(c.maxHp * BALANCE.status.BURNOUT.hpLossPct));
    emit(ctx, { kind: 'message', text: `${c.name} craque (Burn-out).` });
    dealDamage(ctx, id, loss, false, false);
    if (getCombatant(ctx.state, id).ko) return 'dead';
  }
  updateCombatant(ctx, id, (x) => ({
    ...x,
    statuses: x.statuses.map((s) => ({ ...s, turns: s.turns - 1 })),
  }));

  const now = getCombatant(ctx.state, id);
  const { collapsed } = ctx.state.engine;
  if (now.side === 'party' && collapsed.includes(id)) {
    setEngine(ctx, { collapsed: collapsed.filter((x) => x !== id) });
    emit(ctx, { kind: 'message', text: `${now.name} pique du nez (micro-sieste).` });
    return 'skip';
  }
  if (hasStatus(now, 'bloque')) {
    emit(ctx, { kind: 'skipTurn', actorId: id, reason: 'bloque' });
    setFx(ctx, id, { blockImmunity: BALANCE.status.BLOQUE.immunityTurns });
    return 'blocked';
  }
  if (hasStatus(now, 'sommeil')) {
    emit(ctx, { kind: 'skipTurn', actorId: id, reason: 'sommeil' });
    return 'skip';
  }
  return 'act';
}

/** Fin de tour : statuts expirés retirés, immunité à Bloqué décomptée. */
function endTurn(ctx: Ctx, id: string, acted: boolean, blocked: boolean): void {
  const c = getCombatant(ctx.state, id);
  if (c.ko) return;
  c.statuses.filter((s) => s.turns <= 0).forEach((s) => { removeStatus(ctx, id, s.id); });
  const after = getCombatant(ctx.state, id);
  setFx(ctx, id, {
    blockImmunity: blocked ? after.fx.blockImmunity : Math.max(0, after.fx.blockImmunity - 1),
    turnsTaken: after.fx.turnsTaken + (acted ? 1 : 0),
  });
}

function nextTurn(ctx: Ctx): void {
  setEngine(ctx, { turnIndex: ctx.state.engine.turnIndex + 1 });
}

function runEnemyTurn(ctx: Ctx, id: string): void {
  const decision = decideEnemy(ctx, id);
  if (decision === null) return;
  switch (decision.kind) {
    case 'idle': {
      const c = getCombatant(ctx.state, id);
      emit(ctx, { kind: 'action', actorId: id, label: decision.label });
      emit(ctx, { kind: 'message', text: `${c.name} ${decision.label}.` });
      return;
    }
    case 'attack':
      performAttack(ctx, id, decision.targetId);
      return;
    case 'skill':
      performSkill(ctx, id, decision.skillId, decision.targetId);
      return;
  }
}

/** Lecture non rétrécie par TypeScript : `ctx.state` change au fil des appels. */
function isOver(ctx: Ctx): boolean {
  return ctx.state.outcome !== null;
}

/** Fait jouer les tours (ennemis, tours sautés) jusqu'à la prochaine décision du joueur ou la fin. */
function advance(ctx: Ctx): void {
  for (let step = 0; step < MAX_AUTO_TURNS; step += 1) {
    if (isOver(ctx)) return;
    const { order, engine } = ctx.state;
    if (engine.turnIndex >= order.length) {
      startRound(ctx);
      continue;
    }
    const id = order[engine.turnIndex];
    const c = id === undefined ? undefined : findCombatant(ctx.state, id);
    if (!c || c.ko || (c.side === 'party' && engine.partyLosesRound)) {
      nextTurn(ctx);
      continue;
    }
    const start = beginTurn(ctx, c.id);
    if (isOver(ctx)) return;
    if (start === 'act') {
      if (c.side === 'party') return;
      runEnemyTurn(ctx, c.id);
      if (isOver(ctx)) return;
      endTurn(ctx, c.id, true, false);
    } else if (start !== 'dead') {
      endTurn(ctx, c.id, false, start === 'blocked');
    }
    nextTurn(ctx);
  }
  throw new Error('Combat bloqué : aucune décision possible');
}

// ---------------------------------------------------------------------------
// Lecture pour l'interface
// ---------------------------------------------------------------------------

/** Membre de l'équipe qui doit décider, sinon null (combat terminé). */
export function currentActor(state: BattleState): Combatant | null {
  if (state.outcome !== null) return null;
  const id = state.order[state.engine.turnIndex];
  const c = id === undefined ? undefined : findCombatant(state, id);
  return c?.side === 'party' && !c.ko ? c : null;
}

/** Cibles légales pour le membre dont c'est le tour (ids vivants, provocation prise en compte). */
export function legalTargets(state: BattleState, mode: TargetMode): readonly string[] {
  const actor = currentActor(state);
  return targetsFor({ state }, actor?.side ?? 'party', mode, actor?.id ?? null);
}

export function targetMode(
  _state: BattleState,
  action: BattleAction['kind'],
  id?: SkillId | ItemId,
): TargetMode | 'none' {
  switch (action) {
    case 'attack':
      return 'enemy';
    case 'skill':
      return id !== undefined && isSkillId(id) ? skillDef(id).target : 'none';
    case 'item':
      return id !== undefined && isItemId(id) ? itemDef(id).target : 'none';
    case 'cafe':
    case 'defend':
    case 'flee':
      return 'none';
  }
}

function canFlee(state: BattleState): boolean {
  return state.engine.canFlee && !state.engine.fleeAttempted;
}

export function availableActions(state: BattleState): ActionAvailability {
  const actor = currentActor(state);
  if (!actor) return { skills: [], items: [], cafe: false, flee: false };
  const skills = actor.skills.map((id) => {
    const def = skillDef(id);
    if (actor.pe < def.peCost) return { id, usable: false, reason: 'PE insuffisants' };
    if (legalTargets(state, def.target).length === 0) {
      return { id, usable: false, reason: 'Aucune cible' };
    }
    return { id, usable: true };
  });
  const items = Object.keys(ITEMS)
    .filter(isItemId)
    .map((id) => ({ id, count: state.inventory[id] ?? 0 }))
    .filter((it) => it.count > 0)
    .map((it) => ({
      ...it,
      usable: itemDef(it.id).usableInBattle && legalTargets(state, itemDef(it.id).target).length > 0,
    }));
  return { skills, items, cafe: state.gobelets > 0, flee: canFlee(state) };
}

// ---------------------------------------------------------------------------
// Action du joueur
// ---------------------------------------------------------------------------

function requireTarget(state: BattleState, mode: TargetMode, targetId: string | undefined): void {
  if (mode !== 'enemy' && mode !== 'ally') return;
  if (targetId === undefined || !legalTargets(state, mode).includes(targetId)) {
    throw new Error(`Cible illégale : ${targetId ?? '(aucune)'}`);
  }
}

function performFlee(ctx: Ctx, actorId: string): void {
  setEngine(ctx, { fleeAttempted: true });
  emit(ctx, { kind: 'action', actorId, label: 'Fuir' });
  const chance = fleeChance(
    living(ctx.state, 'party').map(effectiveSpeed),
    living(ctx.state, 'enemy').map(effectiveSpeed),
  );
  const success = rollPercent(ctx.rng, chance);
  emit(ctx, { kind: 'flee', success });
  if (success) {
    ctx.state = { ...ctx.state, outcome: 'fled' };
    emit(ctx, { kind: 'end', outcome: 'fled' });
  } else {
    setEngine(ctx, { partyLosesRound: true });
    emit(ctx, { kind: 'message', text: "Fuite ratée : l'équipe perd le reste de la manche." });
  }
}

/** Exécute l'action du membre dont c'est le tour, puis enchaîne jusqu'à la prochaine décision. */
export function act(state: BattleState, action: BattleAction, rng: Rng): BattleStep {
  const actor = currentActor(state);
  if (!actor) throw new Error("Ce n'est le tour d'aucun membre de l'équipe");
  const ctx: Ctx = { state, events: [], rng };
  switch (action.kind) {
    case 'attack':
      requireTarget(state, 'enemy', action.targetId);
      performAttack(ctx, actor.id, action.targetId);
      break;
    case 'skill': {
      if (!actor.skills.includes(action.skillId)) {
        throw new Error(`${actor.name} ne connaît pas ${action.skillId}`);
      }
      const def = skillDef(action.skillId);
      if (actor.pe < def.peCost) throw new Error('PE insuffisants');
      requireTarget(state, def.target, action.targetId);
      performSkill(ctx, actor.id, action.skillId, action.targetId);
      break;
    }
    case 'item': {
      const def = itemDef(action.itemId);
      if ((state.inventory[action.itemId] ?? 0) <= 0 || !def.usableInBattle) {
        throw new Error(`Objet indisponible : ${action.itemId}`);
      }
      requireTarget(state, def.target, action.targetId);
      performItem(ctx, actor.id, action.itemId, action.targetId);
      break;
    }
    case 'cafe':
      if (state.gobelets <= 0) throw new Error('Plus de Gobelet');
      performCafe(ctx, actor.id);
      break;
    case 'defend':
      performDefend(ctx, actor.id);
      break;
    case 'flee':
      if (!canFlee(state)) throw new Error('Fuite impossible');
      performFlee(ctx, actor.id);
      break;
  }
  if (!isOver(ctx)) {
    endTurn(ctx, actor.id, true, false);
    nextTurn(ctx);
    advance(ctx);
  }
  return { state: ctx.state, events: ctx.events };
}

// ---------------------------------------------------------------------------
// Récompenses et compétences
// ---------------------------------------------------------------------------

/** Récompenses d'une victoire (GDD § 5.7) ; rien après une défaite ou une fuite. */
export function computeRewards(state: BattleState, rng: Rng): BattleRewards {
  if (state.outcome !== 'victory') return { xp: 0, tickets: 0, coffeeBeans: 0 };
  const pause = pauseOf(state);
  const enemies = state.combatants.filter((c) => c.side === 'enemy');
  let xp = 0;
  let tickets = 0;
  for (const e of enemies) {
    xp += enemyXp(e.level, e.tier, pause.xpMult);
    tickets += enemyTickets(e.level, e.tier, pause.ticketMult, randInt(rng, 0, e.level));
  }
  const { BEANS_DROP_CHANCE, BEANS_DROP, ELITE_BEANS } = BALANCE.economy;
  let coffeeBeans = 0;
  if (enemies.some((e) => e.tier !== 'normal')) {
    coffeeBeans = randInt(rng, ELITE_BEANS[0], ELITE_BEANS[1]);
  } else if (rng() < BEANS_DROP_CHANCE) {
    coffeeBeans = randInt(rng, BEANS_DROP[0], BEANS_DROP[1]);
  }
  return { xp, tickets, coffeeBeans };
}

/** Compétences connues d'un membre à un niveau (héros : GDD § 8.3 ; collègues : compétence 1 d'office). */
export function knownSkills(member: PartyMemberId, level: number): readonly SkillId[] {
  return Object.keys(SKILLS)
    .filter(isSkillId)
    .filter((id) => {
      const def = skillDef(id);
      return def.owner === member && (def.learnLevel ?? 1) <= level;
    });
}
