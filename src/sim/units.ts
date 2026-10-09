/**
 * Conversion entre le plan logique de la simulation et le monde 3D.
 *
 * La simulation reste en 2D dans le plan du sol, dans l'unité de `balance.ts` (le « pixel logique »,
 * noté u). La vue affiche un point `(x, y)` en `(x / 30, 0, y / 30)` mètres : le `y` logique (vers le
 * bas de l'écran) devient `+z` (vers la caméra). 30 est le `PX_PER_UNIT` de `tools/render3d`, donc les
 * personnages modélisés en mètres ont déjà la bonne taille par rapport aux hitboxes.
 */

/** Pixels logiques par mètre. */
export const PX_PER_M = 30;

export interface GroundPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Point logique (u) → point du monde 3D (m), au sol. */
export function toWorld(x: number, y: number): GroundPoint {
  return { x: x / PX_PER_M, y: 0, z: y / PX_PER_M };
}

/** Distance logique (u) → mètres. */
export function pxToM(px: number): number {
  return px / PX_PER_M;
}

/** Mètres → distance logique (u). */
export function mToPx(m: number): number {
  return m * PX_PER_M;
}

/**
 * Rotation autour de Y d'un modèle qui regarde vers +Z pour qu'il regarde dans la direction logique
 * `angle` (atan2(dy, dx) de la simulation) : la direction 3D est (cos a, 0, sin a).
 */
export function yawFromAngle(angle: number): number {
  return Math.PI / 2 - angle;
}

/** Angle logique d'une direction du monde 3D (dx, dz). */
export function angleFromWorld(dx: number, dz: number): number {
  return Math.atan2(dz, dx);
}
