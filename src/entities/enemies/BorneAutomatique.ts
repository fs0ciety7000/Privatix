import { BORNE } from '@/config/balance';
import { Colors } from '@/config/constants';
import type { TokenKind } from '@/systems/combat/AttackTokens';
import type { EnemyScale } from '@/systems/combat/damage';
import { angleDiff } from '@/utils/math';
import type { CombatWorld } from '@/entities/CombatWorld';
import type { EnemyHit } from '@/entities/Enemy';
import { Enemy } from '@/entities/Enemy';

/**
 * Borne Automatique (tourelle) : se déplie, pivote lentement vers le héros et crache des salves de 3 tickets.
 * Blindage frontal (−50 %), panneau arrière exposé (×2). Recule doucement si on la colle.
 */
export class BorneAutomatique extends Enemy {
  protected readonly directional = false;
  protected readonly animPrefix = 'borne';
  private deployed = false;
  private lastShot = 0;

  public constructor(world: CombatWorld, x: number, y: number, scale: EnemyScale) {
    super(world, 'borne', x, y, 'borne-idle', scale);
    this.body.setImmovable(true);
  }

  protected think(dtMs: number): string | null {
    if (!this.deployed) {
      this.deployed = true;
      this.playAnim('wake', true);
      this.lastShot = this.world.now() - BORNE.PERIOD_MS + BORNE.DEPLOY_MS;
    }
    // Rotation lente (90°/s) vers le héros.
    const target = this.angleToPlayer();
    const step = ((BORNE.TURN_DEG_PER_S * Math.PI) / 180) * (dtMs / 1000);
    const diff = angleDiff(this.facing, target);
    this.facing += Math.max(-step, Math.min(step, diff));
    if (this.distToPlayer() < BORNE.RETREAT_UNDER) this.moveAngle(target + Math.PI, BORNE.speed);
    else this.halt();
    if (!this.anims.isPlaying || this.anims.currentAnim?.key === 'borne-idle')
      this.playAnim('idle');
    return this.world.now() - this.lastShot >= BORNE.PERIOD_MS ? 'salve' : null;
  }

  protected tokenFor(): TokenKind {
    return 'ranged';
  }

  protected windupMs(): number {
    return BORNE.SALVE_TELEGRAPH_MS;
  }

  protected onWindup(): void {
    this.playAnim('attack', true);
    const a = this.angleToPlayer();
    this.facing = a;
    this.showTelegraph((g) =>
      g
        .lineStyle(1, Colors.danger, 0.8)
        .lineBetween(
          this.x,
          this.y - 12,
          this.x + Math.cos(a) * 160,
          this.y - 12 + Math.sin(a) * 160,
        ),
    );
  }

  protected updateAttack(): number {
    this.lastShot = this.world.now();
    const spread = (BORNE.SALVE_SPREAD_DEG * Math.PI) / 180;
    const half = (BORNE.SALVE_COUNT - 1) / 2;
    for (let i = 0; i < BORNE.SALVE_COUNT; i += 1) {
      this.world.spawnProjectile({
        x: this.x + Math.cos(this.facing) * 8,
        y: this.y - 12 + Math.sin(this.facing) * 8,
        angle: this.facing + (i - half) * spread,
        speed: BORNE.PROJECTILE_SPEED,
        damage: Math.round(BORNE.PROJECTILE_DAMAGE * this.damageMult),
        lifeMs: BORNE.PROJECTILE_LIFE_MS,
        radius: BORNE.PROJECTILE_RADIUS,
        owner: this.displayName,
      });
    }
    return BORNE.RELOAD_MS;
  }

  protected override damageTakenMult(hit: EnemyHit): number {
    // Face = cône de 90° devant l'écran.
    const from = Math.atan2(hit.fromY - this.y, hit.fromX - this.x);
    const off = Math.abs(angleDiff(this.facing, from));
    const side =
      off < Math.PI / 4 ? 1 - BORNE.FRONT_ARMOR : off > (3 * Math.PI) / 4 ? BORNE.BACK_MULT : 1;
    return super.damageTakenMult(hit) * side;
  }

  protected override onDeath(): void {
    this.world.vfx('vfx-explosion', this.x, this.y - 12, { depth: this.y + 2 });
    this.world.feel.shake(2, 100);
  }
}
