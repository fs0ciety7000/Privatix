import { TILE } from '@/config/constants';
import type { MarkKind, TileKind, RoomLayout } from '@/systems/procedural/RoomLayout';
import { isSolid, spawnableTiles, tileAt } from '@/systems/procedural/RoomLayout';
import type { TileGrid } from '@/sim/physics/collision';
import type { RailBand } from '@/sim/SimWorld';
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
  /** Voies (rangées majoritairement rails ou ballast), où passent les rames du boss. */
  public readonly railBands: readonly RailBand[];

  public constructor(public readonly layout: RoomLayout) {
    this.cols = layout.width;
    this.rows = layout.height;
    this.widthPx = layout.width * TILE;
    this.heightPx = layout.height * TILE;
    this.railBands = findRailBands(layout);
  }

  /** Apparition du boss (pieds au bas de la tuile « B », comme la version Phaser). */
  public get bossSpawn(): Vec2 {
    const s = this.layout.bossSpawn ?? this.layout.playerSpawn;
    return { x: s.tx * TILE + TILE / 2, y: s.ty * TILE + TILE };
  }

  /** Centres des tuiles marquées (machine à café, étals, récompense). */
  public marks(kind: MarkKind): Vec2[] {
    return this.layout.marks
      .filter((m) => m.kind === kind)
      .map((m) => ({ x: m.at.tx * TILE + TILE / 2, y: m.at.ty * TILE + TILE / 2 }));
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

/** Bandes de voie (port de `Room.findRailBands`) : rangées dont la moitié au moins est rail ou ballast. */
export function findRailBands(layout: RoomLayout): RailBand[] {
  const bands: RailBand[] = [];
  let start = -1;
  let x0 = 0;
  let x1 = 0;
  const isTrack = (k: TileKind): boolean => k === 'rail' || k === 'ballast';
  const isTrackRow = (ty: number): boolean => {
    const row = layout.tiles[ty] ?? [];
    return row.filter(isTrack).length >= row.length / 2;
  };
  for (let ty = 0; ty <= layout.height; ty += 1) {
    if (ty < layout.height && isTrackRow(ty)) {
      if (start < 0) {
        start = ty;
        const row = layout.tiles[ty] ?? [];
        x0 = row.findIndex(isTrack) * TILE;
        x1 = (row.length - [...row].reverse().findIndex(isTrack)) * TILE;
      }
    } else if (start >= 0) {
      bands.push({ x0, x1, y: start * TILE, height: (ty - start) * TILE });
      start = -1;
    }
  }
  return bands;
}
