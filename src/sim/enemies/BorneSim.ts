import { BORNE } from '@/config/balance';
import type { TokenKind } from '@/systems/combat/AttackTokens';
import type { EnemyScale } from '@/systems/combat/damage';
import { angleDiff } from '@/utils/math';
import type { SimWorld } from '@/sim/SimWorld';
import type { EnemyHit } from '@/sim/enemies/EnemySim';
import { EnemySim } from '@/sim/enemies/EnemySim';

/** Hauteur de la bouche de la Borne (u au-dessus des pieds), comme la version Phaser. */
export const BORNE_MUZZLE_Y = 12;
/** Portée affichée du télégraphe de salve (version Phaser : ligne de 160 u). */
const SALVE_TELEGRAPH_REACH = 160;

/**
 * Borne Automatique (port pur de `entities/enemies/BorneAutomatique.ts`) : tourelle qui se déplie,
 * pivote lentement vers le héros (90°/s) et crache des salves de 3 tickets. Blindage frontal (−50 %),
 * panneau arrière exposé (×2). Recule doucement si on la colle.
 */
export class BorneSim extends EnemySim {
  private deployed = false;
  private lastShot = 0;
  /** Temps depuis le déploiement (la vue joue le dépliage). */
  public deployMs = 0;

  public constructor(world: SimWorld, x: number, y: number, scale: EnemyScale) {
    super(world, 'borne', x, y, scale);
  }

  public override tick(dtMs: number): void {
    if (this.deployed) this.deployMs += dtMs;
    super.tick(dtMs);
  }

  protected think(dtMs: number): string | null {
    if (!this.deployed) {
      this.deployed = true;
      this.lastShot = this.world.now() - BORNE.PERIOD_MS + BORNE.DEPLOY_MS;
    }
    // Rotation lente vers le héros.
    const target = this.angleToHero();
    const step = ((BORNE.TURN_DEG_PER_S * Math.PI) / 180) * (dtMs / 1000);
    const diff = angleDiff(this.facing, target);
    this.facing += Math.max(-step, Math.min(step, diff));
    if (this.distToHero() < BORNE.RETREAT_UNDER) this.moveAngle(target + Math.PI, BORNE.speed);
    else this.halt();
    return this.world.now() - this.lastShot >= BORNE.PERIOD_MS ? 'salve' : null;
  }

  protected tokenFor(): TokenKind {
    return 'ranged';
  }

  protected windupMs(): number {
    return BORNE.SALVE_TELEGRAPH_MS;
  }

  protected onWindup(): void {
    this.facing = this.angleToHero();
    // Éventail des trois tickets (± l'écart de salve), à la portée de la ligne de la version Phaser.
    this.telegraph = {
      kind: 'arc',
      x: this.body.x,
      y: this.body.y,
      angle: this.facing,
      reach: SALVE_TELEGRAPH_REACH,
      arcDeg: BORNE.SALVE_SPREAD_DEG * (BORNE.SALVE_COUNT - 1) + 8,
    };
  }

  protected override onAttackStart(attack: string): void {
    this.world.emit({
      type: 'enemyStrike',
      id: this.id,
      attack,
      x: this.body.x,
      y: this.body.y,
      angle: this.facing,
    });
  }

  protected updateAttack(): number {
    this.lastShot = this.world.now();
    const spread = (BORNE.SALVE_SPREAD_DEG * Math.PI) / 180;
    const half = (BORNE.SALVE_COUNT - 1) / 2;
    for (let i = 0; i < BORNE.SALVE_COUNT; i += 1) {
      this.world.spawnProjectile({
        x: this.body.x + Math.cos(this.facing) * 8,
        y: this.body.y + Math.sin(this.facing) * 8,
        angle: this.facing + (i - half) * spread,
        speed: BORNE.PROJECTILE_SPEED,
        damage: Math.round(BORNE.PROJECTILE_DAMAGE * this.damageMult),
        lifeMs: BORNE.PROJECTILE_LIFE_MS,
        radius: BORNE.PROJECTILE_RADIUS,
        owner: this.displayName,
        height: BORNE_MUZZLE_Y,
      });
    }
    return BORNE.RELOAD_MS;
  }

  protected override damageTakenMult(hit: EnemyHit): number {
    // Face = cône de 90° devant la borne.
    const from = Math.atan2(hit.fromY - this.body.y, hit.fromX - this.body.x);
    const off = Math.abs(angleDiff(this.facing, from));
    const side =
      off < Math.PI / 4 ? 1 - BORNE.FRONT_ARMOR : off > (3 * Math.PI) / 4 ? BORNE.BACK_MULT : 1;
    return super.damageTakenMult(hit) * side;
  }

  protected override onDeath(): void {
    this.world.emit({ type: 'explosion', x: this.body.x, y: this.body.y, scale: 1 });
    this.world.emit({ type: 'shake', px: 2, ms: 100 });
  }
}
