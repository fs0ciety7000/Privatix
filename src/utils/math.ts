/** Borne une valeur dans [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export function vec(x: number, y: number): Vec2 {
  return { x, y };
}

export function length(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}

/** Vecteur unitaire (ou nul si `v` est nul). */
export function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}

export function fromAngle(rad: number, len = 1): Vec2 {
  return { x: Math.cos(rad) * len, y: Math.sin(rad) * len };
}

export function angleTo(from: Vec2, to: Vec2): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Écart signé entre deux angles, ramené dans ]-π, π]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Rapproche `current` de `target` d'au plus `maxDelta`. */
export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(target, current + maxDelta);
  return Math.max(target, current - maxDelta);
}

export type Facing = 'down' | 'up' | 'side';

/** Direction d'animation (3 dessinées + miroir) d'après un angle ; `flip` = regarde vers la gauche. */
export function facingFromAngle(rad: number): { readonly facing: Facing; readonly flip: boolean } {
  const x = Math.cos(rad);
  const y = Math.sin(rad);
  if (Math.abs(x) >= Math.abs(y) * 0.9) return { facing: 'side', flip: x < 0 };
  return { facing: y > 0 ? 'down' : 'up', flip: false };
}
