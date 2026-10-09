import type { AttackStep } from '@/config/balance';
import { COMBO_RULES } from '@/config/balance';

export type AttackPhase = 'startup' | 'active' | 'recovery' | 'done';

/** Durées d'un coup accélérées par la vitesse d'attaque (+0,25 = durées ÷ 1,25). */
export interface StepTiming {
  readonly startupMs: number;
  readonly activeMs: number;
  readonly recoveryMs: number;
  readonly totalMs: number;
}

export function timingOf(
  step: Pick<AttackStep, 'startupMs' | 'activeMs' | 'recoveryMs'>,
  attackSpeedBonus = 0,
): StepTiming {
  const k = 1 / (1 + Math.max(0, attackSpeedBonus));
  const startupMs = step.startupMs * k;
  const activeMs = step.activeMs * k;
  const recoveryMs = step.recoveryMs * k;
  return { startupMs, activeMs, recoveryMs, totalMs: startupMs + activeMs + recoveryMs };
}

export function phaseAt(t: StepTiming, elapsedMs: number): AttackPhase {
  if (elapsedMs < t.startupMs) return 'startup';
  if (elapsedMs < t.startupMs + t.activeMs) return 'active';
  if (elapsedMs < t.totalMs) return 'recovery';
  return 'done';
}

/** Le coup suivant du combo peut-il partir maintenant ? (point d'enchaînement dans la recovery) */
export function canChain(t: StepTiming, elapsedMs: number): boolean {
  const chainAt = Math.min(t.recoveryMs, COMBO_RULES.CHAIN_FROM_RECOVERY_MS);
  return elapsedMs >= t.startupMs + t.activeMs + chainAt;
}

/**
 * Le dash peut-il annuler le coup ? Jamais pendant l'active ; toujours pendant la recovery ;
 * pendant le startup des coups 1-2, et seulement au tout début de celui du coup 3.
 */
export function canDashCancel(t: StepTiming, comboIndex: number, elapsedMs: number): boolean {
  const phase = phaseAt(t, elapsedMs);
  if (phase === 'active') return false;
  if (phase === 'startup' && comboIndex === 2)
    return elapsedMs < COMBO_RULES.FINISHER_DASH_CANCEL_MS;
  return true;
}

/** Hitstop d'un coup selon le nombre de cibles touchées et le critique. */
export function hitstopFor(
  step: Pick<AttackStep, 'hitstopMs'>,
  targets: number,
  crit: boolean,
): number {
  if (targets <= 0) return 0;
  const extra = Math.min(
    COMBO_RULES.HITSTOP_EXTRA_CAP_MS,
    (targets - 1) * COMBO_RULES.HITSTOP_PER_EXTRA_TARGET_MS,
  );
  return step.hitstopMs + extra + (crit ? COMBO_RULES.CRIT_HITSTOP_BONUS_MS : 0);
}
