import type { Circle } from '@/systems/combat/geometry';
import type { TileGrid } from '@/sim/physics/collision';

export interface ProjectileSpec {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly speed: number;
  readonly damage: number;
  readonly lifeMs: number;
  readonly radius: number;
  readonly owner: string;
  /** Hauteur de vol (u au-dessus du sol) : la vue s'en sert, la hitbox reste dans le plan. */
  readonly height?: number;
  /** Taille d'affichage relative (bille du drone : 0,6). */
  readonly scale?: number;
}

/** Projectile ennemi (« ticket d'amende ») : un emplacement du pool, réactivé par `fire`. */
export interface ProjectileSim {
  readonly id: number;
  active: boolean;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  r: number;
  damage: number;
  owner: string;
  lifeLeft: number;
  height: number;
  scale: number;
  angle: number;
}

/** Taille du pool (docs/proposals/revue-3d-loot/lead_developer.md § 4.8). */
export const PROJECTILE_POOL = 96;

/**
 * Projectiles ennemis en pool (port pur de `entities/Projectile.ts` + de la boucle de `RunScene`) :
 * aucune allocation en combat. Détruits par les murs, le coup 3, le sifflet, ou en touchant le héros.
 */
export class Projectiles {
  public readonly pool: ProjectileSim[] = [];

  public constructor(size = PROJECTILE_POOL) {
    for (let i = 0; i < size; i += 1) {
      this.pool.push({
        id: i,
        active: false,
        x: 0,
        y: 0,
        prevX: 0,
        prevY: 0,
        vx: 0,
        vy: 0,
        r: 1,
        damage: 0,
        owner: '',
        lifeLeft: 0,
        height: 12,
        scale: 1,
        angle: 0,
      });
    }
  }

  /** Réactive un emplacement libre (le plus ancien si le pool est plein). */
  public fire(spec: ProjectileSpec): ProjectileSim {
    let p = this.pool.find((q) => !q.active);
    if (!p) {
      p = this.pool.reduce((a, b) => (a.lifeLeft <= b.lifeLeft ? a : b));
    }
    p.active = true;
    p.x = spec.x;
    p.y = spec.y;
    p.prevX = spec.x;
    p.prevY = spec.y;
    p.vx = Math.cos(spec.angle) * spec.speed;
    p.vy = Math.sin(spec.angle) * spec.speed;
    p.r = spec.radius;
    p.damage = spec.damage;
    p.owner = spec.owner;
    p.lifeLeft = spec.lifeMs;
    p.height = spec.height ?? 12;
    p.scale = spec.scale ?? 1;
    p.angle = spec.angle;
    return p;
  }

  public active(): ProjectileSim[] {
    return this.pool.filter((p) => p.active);
  }

  public snapshot(): void {
    for (const p of this.pool) {
      p.prevX = p.x;
      p.prevY = p.y;
    }
  }

  /**
   * Avance les projectiles ; renvoie ceux qui viennent de toucher un mur (la vue y pose des étincelles).
   * Le test contre le héros est fait par le monde (i-frames, dash parfait).
   */
  public step(dtMs: number, grid: TileGrid, onWall: (p: ProjectileSim) => void): void {
    const dt = dtMs / 1000;
    const ts = grid.tileSize;
    for (const p of this.pool) {
      if (!p.active) continue;
      p.lifeLeft -= dtMs;
      if (p.lifeLeft <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (grid.solidAt(Math.floor(p.x / ts), Math.floor(p.y / ts))) {
        p.active = false;
        onWall(p);
      }
    }
  }

  /** Projectiles actifs qui recouvrent `c` (hitbox d'un coup, onde du sifflet). */
  public overlapping(c: Circle): ProjectileSim[] {
    return this.pool.filter((p) => p.active && Math.hypot(p.x - c.x, p.y - c.y) <= p.r + c.r);
  }

  public clear(): void {
    for (const p of this.pool) p.active = false;
  }
}
