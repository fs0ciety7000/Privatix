import { TILE } from '@/config/constants';
import type { TileKind, RoomLayout } from '@/systems/procedural/RoomLayout';
import { isSolid, spawnableTiles, tileAt } from '@/systems/procedural/RoomLayout';
import type { TileGrid } from '@/sim/physics/collision';
import type { Vec2 } from '@/utils/math';

/**
 * Salle côté simulation (ex-`entities/Room.ts` sans Phaser) : grille de collision tirée du gabarit
 * ASCII, sol lent, points d'apparition. La vue 3D construit son décor à partir du même `RoomLayout`.
 */
export class Arena implements TileGrid {
  public readonly cols: number;
  public readonly rows: number;
  public readonly tileSize = TILE;
  public readonly widthPx: number;
  public readonly heightPx: number;

  public constructor(public readonly layout: RoomLayout) {
    this.cols = layout.width;
    this.rows = layout.height;
    this.widthPx = layout.width * TILE;
    this.heightPx = layout.height * TILE;
  }

  public solidAt(tx: number, ty: number): boolean {
    return isSolid(tileAt(this.layout, tx, ty));
  }

  public kindAt(x: number, y: number): TileKind {
    return tileAt(this.layout, Math.floor(x / TILE), Math.floor(y / TILE));
  }

  /** Ballast : −15 % de vitesse (GDD). */
  public isSlowGround(x: number, y: number): boolean {
    return this.kindAt(x, y) === 'ballast';
  }

  public get playerSpawn(): Vec2 {
    const s = this.layout.playerSpawn;
    return { x: s.tx * TILE + TILE / 2, y: s.ty * TILE + TILE / 2 };
  }

  /** Centres des tuiles où un ennemi peut apparaître, à au moins `minPx` de `from`. */
  public spawnPoints(from: Vec2, minPx: number): Vec2[] {
    const tile = { tx: Math.floor(from.x / TILE), ty: Math.floor(from.y / TILE) };
    return spawnableTiles(this.layout, tile, minPx / TILE).map((t) => ({
      x: t.tx * TILE + TILE / 2,
      y: t.ty * TILE + TILE / 2,
    }));
  }
}
