import type { Vec2 } from '@/utils/math';

/**
 * Aide à la visée (tactile, et manette sans stick droit) : l'ennemi vivant le plus proche dans
 * `range` u, sinon `null` (on garde alors l'orientation courante). Pur.
 */
export function autoAimTarget(
  from: Vec2,
  targets: readonly { readonly x: number; readonly y: number; readonly hittable: boolean }[],
  range: number,
): Vec2 | null {
  let best: Vec2 | null = null;
  let bestD = range;
  for (const t of targets) {
    if (!t.hittable) continue;
    const d = Math.hypot(t.x - from.x, t.y - from.y);
    if (d < bestD) {
      bestD = d;
      best = { x: t.x, y: t.y };
    }
  }
  return best;
}
