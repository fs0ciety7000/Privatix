import type { EnemyKind } from '@/config/balance';
import { BORNE, ENEMY_STATS, SCALING } from '@/config/balance';
import type { Rng } from '@/utils/rng';

/** Une vague : liste d'ennemis à faire apparaître ensemble. */
export type Wave = readonly EnemyKind[];

export interface WaveContext {
  /** Indice de salle comptée `r` (GDD § 3.2). */
  readonly r: number;
  readonly elite: boolean;
  /** Multiplicateur de budget du roulement (Nuit : 0,85). */
  readonly budgetMult: number;
  /** Drones ajoutés à chaque vague à partir de r = 2 (Matin : brouillard, +1). */
  readonly extraDronesPerWave: number;
}

/** Budget de menace (GDD § 3.6). */
export function budgetFor(ctx: WaveContext): number {
  const type = ctx.r <= 1 ? SCALING.FIRST_ROOM_BUDGET : ctx.elite ? SCALING.ELITE_BUDGET : 1;
  return Math.round(
    (SCALING.BUDGET_BASE + SCALING.BUDGET_PER_ROOM * ctx.r) * type * ctx.budgetMult,
  );
}

function fillWave(budget: number, ctx: WaveContext, rng: Rng): EnemyKind[] {
  const out: EnemyKind[] = [];
  let left = budget;
  let bornes = 0;
  if (ctx.r >= 2) for (let i = 0; i < ctx.extraDronesPerWave; i += 1) out.push('drone');
  for (let guard = 0; left >= ENEMY_STATS.consultant.cost && guard < 64; guard += 1) {
    const roll = rng();
    let kind: EnemyKind = 'consultant';
    if (roll < SCALING.SHARE_DRONE) kind = 'drone';
    else if (
      roll < SCALING.SHARE_DRONE + SCALING.SHARE_BORNE &&
      ctx.r >= BORNE.MIN_ROOM &&
      bornes < BORNE.MAX_PER_WAVE
    )
      kind = 'borne';
    if (ENEMY_STATS[kind].cost > left) kind = 'consultant';
    if (kind === 'borne') bornes += 1;
    left -= ENEMY_STATS[kind].cost;
    out.push(kind);
  }
  return out;
}

/**
 * Vagues d'une salle de combat : 2 vagues (55/45 %) jusqu'à r = 5, puis 3 (40/35/25 %).
 * Salle Élite : le Manager KPI ouvre la vague 2, son coût est pris sur le budget de cette vague.
 */
export function wavesFor(ctx: WaveContext, rng: Rng): Wave[] {
  let budget = budgetFor(ctx);
  const split = ctx.r <= SCALING.TWO_WAVES_UNTIL_ROOM ? SCALING.WAVE_SPLIT_2 : SCALING.WAVE_SPLIT_3;
  if (ctx.elite) budget -= ENEMY_STATS.manager.cost;
  const waves = split.map((share) => fillWave(Math.max(1, Math.round(budget * share)), ctx, rng));
  if (ctx.elite) {
    const second = waves[1] ?? [];
    second.unshift('manager');
    waves[1] = second;
  }
  return waves;
}

/** La vague suivante doit-elle partir ? (≤ 2 ennemis vivants, ou 70 % de la vague éliminée) */
export function shouldSendNextWave(alive: number, waveSize: number, killedInWave: number): boolean {
  if (alive <= SCALING.NEXT_WAVE_WHEN_ALIVE_AT_MOST) return true;
  return waveSize > 0 && killedInWave / waveSize >= SCALING.NEXT_WAVE_KILLED_FRACTION;
}
