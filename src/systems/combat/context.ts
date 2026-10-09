import { BALANCE } from '@/config/balance';
import type { FatigueTier } from '@/config/balance';
import { enemyDef, SHIFT_ENEMY_STATUS_BONUS } from '@/data/combat';
import type { StatusId } from '@/data/types';
import type {
  BattleEngineData,
  BattleEvent,
  BattleState,
  Combatant,
  CombatantEffects,
  Rng,
  Side,
  StatusInstance,
} from '@/systems/combat/types';
import { partyResistance, statusChance } from '@/systems/combat/formulas';
import { fatigueTier } from '@/systems/time/FatigueClock';
import { clamp } from '@/utils/math';
import { pick, rollPercent } from '@/utils/rng';

/**
 * Mutations élémentaires d'un combat. Un `Ctx` porte l'état courant d'une étape (`act`, `startBattle`) :
 * chaque fonction REMPLACE `ctx.state` par un nouvel objet (jamais de mutation de l'état reçu) et ajoute
 * ses événements à `ctx.events`.
 */
export interface Ctx {
  state: BattleState;
  readonly events: BattleEvent[];
  readonly rng: Rng;
}

const S = BALANCE.status;

export const NO_EFFECTS: CombatantEffects = {
  defending: false,
  shieldTurns: 0,
  tauntTurns: 0,
  guardMult: 1,
  blockImmunity: 0,
  cooldowns: {},
  forceBonus: 0,
  actsLast: false,
  turnsTaken: 0,
  summonSpent: false,
  dodge: 0,
  resistance: 0,
};

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export function emit(ctx: Ctx, event: BattleEvent): void {
  ctx.events.push(event);
}

export function findCombatant(state: BattleState, id: string): Combatant | undefined {
  return state.combatants.find((c) => c.id === id);
}

export function getCombatant(state: BattleState, id: string): Combatant {
  const c = findCombatant(state, id);
  if (!c) throw new Error(`Combattant inconnu : ${id}`);
  return c;
}

export function hasStatus(c: Combatant, status: StatusId): boolean {
  return c.statuses.some((s) => s.id === status);
}

export function opposite(side: Side): Side {
  return side === 'party' ? 'enemy' : 'party';
}

export function living(state: BattleState, side?: Side): readonly Combatant[] {
  return state.combatants.filter((c) => !c.ko && (side === undefined || c.side === side));
}

export function tierOf(state: BattleState): FatigueTier {
  return fatigueTier(state.fatigue);
}

export function pauseOf(state: BattleState): (typeof BALANCE.pause)[keyof typeof BALANCE.pause] {
  return BALANCE.pause[state.engine.shift];
}

/** Vitesse effective (Caféiné ×1,25). */
export function effectiveSpeed(c: Combatant): number {
  return Math.floor(c.speed * (hasStatus(c, 'cafeine') ? S.CAFEINE.speedMult : 1));
}

/** Force effective (passif du Manager KPI). */
export function effectiveForce(c: Combatant): number {
  return c.force * (1 + c.fx.forceBonus);
}

/** Défense effective : Syndiqué ×1,3 ; bonus de pause du héros (« Endurance » ×1,1) pour l'équipe. */
export function effectiveDefense(state: BattleState, c: Combatant): number {
  const syndique = hasStatus(c, 'syndique') ? S.SYNDIQUE.defMult : 1;
  const pause = c.side === 'party' ? pauseOf(state).defMult : 1;
  return c.defense * syndique * pause;
}

/** Résistance aux statuts : Moral / 2 (plafonné) et palier pour l'équipe, type pour les ennemis. */
export function resistanceOf(state: BattleState, c: Combatant): number {
  if (c.side === 'enemy') return c.fx.resistance;
  return partyResistance(state.moral, hasStatus(c, 'demotive'), tierOf(state).statusRes);
}

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

export function updateCombatant(ctx: Ctx, id: string, fn: (c: Combatant) => Combatant): void {
  getCombatant(ctx.state, id);
  ctx.state = {
    ...ctx.state,
    combatants: ctx.state.combatants.map((c) => (c.id === id ? fn(c) : c)),
  };
}

export function setFx(ctx: Ctx, id: string, patch: Partial<CombatantEffects>): void {
  updateCombatant(ctx, id, (c) => ({ ...c, fx: { ...c.fx, ...patch } }));
}

export function setEngine(ctx: Ctx, patch: Partial<BattleEngineData>): void {
  ctx.state = { ...ctx.state, engine: { ...ctx.state.engine, ...patch } };
}

/** Vérifie la fin du combat (une seule fois). */
export function checkOutcome(ctx: Ctx): void {
  if (ctx.state.outcome !== null) return;
  if (living(ctx.state, 'enemy').length === 0) {
    ctx.state = { ...ctx.state, outcome: 'victory' };
    emit(ctx, { kind: 'end', outcome: 'victory' });
  } else if (living(ctx.state, 'party').length === 0) {
    ctx.state = { ...ctx.state, outcome: 'defeat' };
    emit(ctx, { kind: 'end', outcome: 'defeat' });
  }
}

/** Fatigue d'équipe (bornée) ; à 100, l'équipe s'effondre : chacun saute sa prochaine action, puis 90. */
export function addFatigue(ctx: Ctx, delta: number): void {
  const before = ctx.state.fatigue;
  const after = clamp(before + delta, 0, BALANCE.fatigue.MAX);
  ctx.state = { ...ctx.state, fatigue: after };
  emit(ctx, { kind: 'fatigue', delta: after - before, value: after });
  if (before < BALANCE.fatigue.MAX && after >= BALANCE.fatigue.MAX) {
    const ids = living(ctx.state, 'party').map((c) => c.id);
    setEngine(ctx, { collapsed: ids });
    emit(ctx, { kind: 'message', text: "L'équipe s'effondre : micro-sieste générale !" });
    const reset = BALANCE.fatigue.COLLAPSE_RESET;
    ctx.state = { ...ctx.state, fatigue: reset };
    emit(ctx, { kind: 'fatigue', delta: reset - after, value: reset });
  }
}

/** Retire un statut (événement `statusEnd`). Caféiné qui se termine coûte +5 de Fatigue. */
export function removeStatus(ctx: Ctx, id: string, status: StatusId): void {
  const c = getCombatant(ctx.state, id);
  if (!hasStatus(c, status)) return;
  updateCombatant(ctx, id, (x) => ({ ...x, statuses: x.statuses.filter((s) => s.id !== status) }));
  emit(ctx, { kind: 'statusEnd', targetId: id, status });
  if (status === 'cafeine' && c.side === 'party' && !c.ko) {
    addFatigue(ctx, BALANCE.fatigue.CAFFEINE_CRASH);
  }
}

/** Durée d'un statut à l'application (Burn-out +1 au palier Épuisé ou pire, pour l'équipe). */
function statusDuration(state: BattleState, target: Combatant, status: StatusId): number {
  switch (status) {
    case 'cafeine':
      return S.CAFEINE.turns;
    case 'syndique':
      return S.SYNDIQUE.turns;
    case 'demotive':
      return S.DEMOTIVE.turns;
    case 'bloque':
      return S.BLOQUE.turns;
    case 'burnout':
      return S.BURNOUT.turns + (target.side === 'party' ? tierOf(state).burnoutExtra : 0);
    case 'confusion':
      return S.CONFUSION.turns;
    case 'sommeil':
      return S.SOMMEIL.maxTurns;
  }
}

const SYNDIQUE_IMMUNE: readonly StatusId[] = ['demotive', 'bloque', 'confusion'];

/** Le statut ne peut pas prendre sur cette cible (immunités, sans jet). */
function isImmune(c: Combatant, status: StatusId): boolean {
  if (status === 'sommeil' && hasStatus(c, 'cafeine')) return true;
  if (status === 'bloque' && c.fx.blockImmunity > 0) return true;
  return SYNDIQUE_IMMUNE.includes(status) && hasStatus(c, 'syndique');
}

/**
 * Tente d'appliquer un statut. `baseChance` nul = appliqué d'office (bonus, soutien) ; sinon
 * STATUT % = clamp(base − résistance, 5, 95), avec le bonus de pause des ennemis (matin : Bloqué +15).
 * Pas de cumul : réappliquer remet la durée à neuf. Renvoie vrai si le statut est posé.
 */
export function applyStatus(
  ctx: Ctx,
  targetId: string,
  status: StatusId,
  baseChance: number | null,
  sourceSide: Side,
): boolean {
  const target = getCombatant(ctx.state, targetId);
  if (target.ko) return false;
  let ok = !isImmune(target, status);
  if (ok && baseChance !== null) {
    const bonus =
      sourceSide === 'enemy' ? (SHIFT_ENEMY_STATUS_BONUS[ctx.state.engine.shift][status] ?? 0) : 0;
    ok = rollPercent(ctx.rng, statusChance(baseChance + bonus, resistanceOf(ctx.state, target)));
  }
  if (!ok) {
    emit(ctx, { kind: 'status', targetId, status, applied: false });
    return false;
  }
  const instance: StatusInstance = {
    id: status,
    turns: statusDuration(ctx.state, target, status),
  };
  updateCombatant(ctx, targetId, (c) => ({
    ...c,
    statuses: [...c.statuses.filter((s) => s.id !== status), instance],
  }));
  emit(ctx, { kind: 'status', targetId, status, applied: true });
  if (status === 'cafeine') removeStatus(ctx, targetId, 'sommeil');
  if (status === 'syndique') SYNDIQUE_IMMUNE.forEach((s) => { removeStatus(ctx, targetId, s); });
  return true;
}

/** Soin (borné aux PV max). Renvoie le montant réellement rendu. */
export function heal(ctx: Ctx, targetId: string, amount: number): number {
  const target = getCombatant(ctx.state, targetId);
  if (target.ko) return 0;
  const healed = Math.max(0, Math.min(amount, target.maxHp - target.hp));
  updateCombatant(ctx, targetId, (c) => ({ ...c, hp: c.hp + healed }));
  emit(ctx, { kind: 'heal', targetId, amount: healed });
  return healed;
}

/** PE rendus (bornés aux PE max). */
export function restorePe(ctx: Ctx, targetId: string, amount: number): void {
  const target = getCombatant(ctx.state, targetId);
  if (target.ko || target.maxPe === 0) return;
  const gained = Math.max(0, Math.min(amount, target.maxPe - target.pe));
  if (gained === 0) return;
  updateCombatant(ctx, targetId, (c) => ({ ...c, pe: c.pe + gained }));
  emit(ctx, { kind: 'pe', targetId, amount: gained });
}

/** Inflige des dégâts : réveille un dormeur, met K.O. à 0 PV (« En arrêt maladie »). */
export function dealDamage(
  ctx: Ctx,
  targetId: string,
  amount: number,
  critical: boolean,
  weakness: boolean,
): void {
  const target = getCombatant(ctx.state, targetId);
  if (target.ko) return;
  const hp = Math.max(0, target.hp - amount);
  updateCombatant(ctx, targetId, (c) => ({ ...c, hp }));
  emit(ctx, { kind: 'damage', targetId, amount, critical, weakness });
  if (hp === 0) {
    knockOut(ctx, targetId);
  } else if (hasStatus(target, 'sommeil')) {
    removeStatus(ctx, targetId, 'sommeil');
  }
}

function knockOut(ctx: Ctx, id: string): void {
  const before = getCombatant(ctx.state, id);
  updateCombatant(ctx, id, (c) => ({
    ...c,
    hp: 0,
    ko: true,
    statuses: [],
    fx: { ...c.fx, defending: false, shieldTurns: 0, tauntTurns: 0, guardMult: 1, actsLast: false },
  }));
  emit(ctx, { kind: 'ko', targetId: id });
  if (before.side === 'party') {
    emit(ctx, { kind: 'message', text: `${before.name} est en arrêt maladie.` });
  }
  const onDeath = before.enemyId === null ? undefined : enemyDef(before.enemyId).onDeath;
  if (onDeath) {
    const victim = pick(ctx.rng, living(ctx.state, 'party'));
    if (victim) {
      emit(ctx, { kind: 'message', text: `${before.name} ${onDeath.label} !` });
      applyStatus(ctx, victim.id, onDeath.status, onDeath.chance, 'enemy');
    }
  }
  checkOutcome(ctx);
}
