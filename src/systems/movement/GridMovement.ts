import type { Facing } from '@/data/types';

export interface GridPos {
  readonly tileX: number;
  readonly tileY: number;
  readonly facing: Facing;
}

export type IsBlocked = (tileX: number, tileY: number) => boolean;

const DELTA: Readonly<Record<Facing, readonly [number, number]>> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/** Case voisine dans une direction. */
export function neighbor(
  tileX: number,
  tileY: number,
  dir: Facing,
): { tileX: number; tileY: number } {
  const [dx, dy] = DELTA[dir];
  return { tileX: tileX + dx, tileY: tileY + dy };
}

/** Tourne toujours vers `dir` ; avance d'une case seulement si la case visée est libre. */
export function step(pos: GridPos, dir: Facing, isBlocked: IsBlocked): GridPos {
  const target = neighbor(pos.tileX, pos.tileY, dir);
  return isBlocked(target.tileX, target.tileY)
    ? { ...pos, facing: dir }
    : { ...target, facing: dir };
}

/** Case « en face » du personnage : c'est elle que vise l'action Interagir. */
export function facingTile(pos: GridPos): { tileX: number; tileY: number } {
  return neighbor(pos.tileX, pos.tileY, pos.facing);
}
