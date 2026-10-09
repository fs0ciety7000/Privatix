import type { HitShape } from '@/config/balance';
import type { Vec2 } from '@/utils/math';
import { angleDiff } from '@/utils/math';

/**
 * Hitboxes géométriques (Arcade n'a que des AABB et des cercles) : les attaques du héros sont des arcs
 * et des rectangles orientés testés contre les hurtboxes circulaires des ennemis.
 */

export interface Circle {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

export function circlesOverlap(a: Circle, b: Circle): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const rr = a.r + b.r;
  return dx * dx + dy * dy <= rr * rr;
}

/** Le cercle `target` touche-t-il l'arc (secteur) de rayon `radius` et d'ouverture `angleDeg` ? */
export function circleInArc(
  origin: Vec2,
  facingRad: number,
  radius: number,
  angleDeg: number,
  target: Circle,
): boolean {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dist = Math.hypot(dx, dy);
  if (dist > radius + target.r) return false;
  if (dist <= target.r) return true;
  const half = (angleDeg * Math.PI) / 360;
  const off = Math.abs(angleDiff(facingRad, Math.atan2(dy, dx)));
  // Tolérance angulaire : le rayon de la cible élargit l'arc vu depuis l'origine.
  const slack = Math.asin(Math.min(1, target.r / dist));
  return off <= half + slack;
}

/**
 * Le cercle touche-t-il le rectangle orienté qui part de `from` px devant `origin`,
 * long de `length` et large de `width`, dans la direction `facingRad` ?
 */
export function circleInOrientedRect(
  origin: Vec2,
  facingRad: number,
  from: number,
  length: number,
  width: number,
  target: Circle,
): boolean {
  const cos = Math.cos(facingRad);
  const sin = Math.sin(facingRad);
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  // Coordonnées locales : u le long de l'attaque, v en travers.
  const u = dx * cos + dy * sin;
  const v = -dx * sin + dy * cos;
  const cu = Math.max(from, Math.min(from + length, u));
  const cv = Math.max(-width / 2, Math.min(width / 2, v));
  const du = u - cu;
  const dv = v - cv;
  return du * du + dv * dv <= target.r * target.r;
}

/** Test générique d'une forme d'attaque du héros (HitShape de balance.ts). */
export function shapeHits(
  shape: HitShape,
  origin: Vec2,
  facingRad: number,
  target: Circle,
): boolean {
  if (shape.kind === 'arc') {
    return circleInArc(origin, facingRad, shape.radius, shape.angleDeg, target);
  }
  if (circleInOrientedRect(origin, facingRad, shape.from, shape.length, shape.width, target)) {
    return true;
  }
  if (shape.tipRadius <= 0) return false;
  const tip = {
    x: origin.x + Math.cos(facingRad) * shape.tipAt,
    y: origin.y + Math.sin(facingRad) * shape.tipAt,
    r: shape.tipRadius,
  };
  return circlesOverlap(tip, target);
}

/** Distance entre un point et un segment (rames, charges en ligne). */
export function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  const t =
    len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}
