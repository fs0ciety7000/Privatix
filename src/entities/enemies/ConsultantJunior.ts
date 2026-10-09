import { CONSULTANT } from '@/config/balance';
import { Colors } from '@/config/constants';
import type { TokenKind } from '@/systems/combat/AttackTokens';
import type { EnemyScale } from '@/systems/combat/damage';
import { circleInArc, distanceToSegment } from '@/systems/combat/geometry';
import type { CombatWorld } from '@/entities/CombatWorld';
import type { EnemyHit } from '@/entities/Enemy';
import { Enemy } from '@/entities/Enemy';

/**
 * Consultant Junior (mêlée rapide) : il tourne autour du héros, puis frappe au « Coup de diaporama »
 * (arc de 90°) ou se rue en « Quick win » (96 px). Vulnérable pendant la récupération de sa ruée.
 */
export class ConsultantJunior extends Enemy {
  protected readonly directional = true;
  protected readonly animPrefix = 'consultant';
  private aggro = false;
  private aliveMs = 0;
  private qwReadyAt = 0;
  private strafeDir = 1;
  private strafeSwitch = 0;
  private rushAngle = 0;
  private rushFrom = { x: 0, y: 0 };
  private rushHit = false;
  private exposed = false;

  public constructor(world: CombatWorld, x: number, y: number, scale: EnemyScale) {
    super(world, 'consultant', x, y, 'consultant_idle_down_strip4', scale, 32);
    this.strafeDir = world.rng() < 0.5 ? -1 : 1;
  }

  protected think(dtMs: number): string | null {
    this.aliveMs += dtMs;
    const d = this.distToPlayer();
    if (!this.aggro && (d < CONSULTANT.AGGRO_PX || this.aliveMs > CONSULTANT.AGGRO_ALL_AFTER_MS))
      this.aggro = true;
    if (!this.aggro) {
      this.halt();
      this.playAnim('idle');
      return null;
    }
    const now = this.world.now();
    if (d <= CONSULTANT.MELEE_RANGE) return 'diaporama';
    if (d >= CONSULTANT.QW_MIN && d <= CONSULTANT.QW_MAX && now >= this.qwReadyAt)
      return 'quickwin';
    // Approche en arc (strafe), jamais en ligne droite.
    this.strafeSwitch -= dtMs;
    if (this.strafeSwitch <= 0) {
      this.strafeSwitch = 1200 + this.world.rng() * 1200;
      if (this.world.rng() < 0.35) this.strafeDir *= -1;
    }
    const a = this.angleToPlayer();
    const lateral = d > 48 ? 0.6 * this.strafeDir : 0;
    const p = this.world.player;
    this.moveToward(
      p.x + Math.cos(a + Math.PI / 2) * lateral * 40,
      p.y + Math.sin(a + Math.PI / 2) * lateral * 40,
    );
    this.facing = a;
    this.playAnim('run');
    return null;
  }

  protected tokenFor(): TokenKind {
    return 'melee';
  }

  protected windupMs(attack: string): number {
    return attack === 'quickwin' ? CONSULTANT.QW_TELEGRAPH_MS : CONSULTANT.MELEE_TELEGRAPH_MS;
  }

  protected onWindup(attack: string): void {
    this.facing = this.angleToPlayer();
    this.playAnim('attack', true);
    this.anims.pause();
    this.setTint(Colors.danger);
    if (attack === 'quickwin') {
      this.rushAngle = this.facing;
      const x1 = this.x + Math.cos(this.rushAngle) * CONSULTANT.QW_DISTANCE;
      const y1 = this.y + Math.sin(this.rushAngle) * CONSULTANT.QW_DISTANCE;
      this.showTelegraph((g) =>
        g
          .lineStyle(CONSULTANT.QW_WIDTH, Colors.danger, 0.25)
          .lineBetween(this.x, this.y - 6, x1, y1 - 6),
      );
    } else {
      const half = (CONSULTANT.MELEE_ARC_DEG * Math.PI) / 360;
      this.showTelegraph((g) =>
        g
          .fillStyle(Colors.danger, 0.25)
          .slice(
            this.x,
            this.y - 8,
            CONSULTANT.MELEE_REACH + 4,
            this.facing - half,
            this.facing + half,
          )
          .fillPath(),
      );
    }
  }

  protected override restoreTint(): void {
    if (this.aiState === 'windup') this.setTint(Colors.danger);
    else this.clearTint();
  }

  protected override onAttackStart(attack: string): void {
    this.clearTint();
    this.anims.resume();
    if (attack === 'quickwin') {
      this.rushFrom = { x: this.x, y: this.y };
      this.rushHit = false;
      this.qwReadyAt = this.world.now() + CONSULTANT.QW_COOLDOWN_MS;
    } else {
      const origin = { x: this.x, y: this.y - 8 };
      const p = this.world.player;
      if (
        circleInArc(origin, this.facing, CONSULTANT.MELEE_REACH, CONSULTANT.MELEE_ARC_DEG, {
          x: p.x,
          y: p.y - 10,
          r: 8,
        })
      ) {
        this.hitPlayer(CONSULTANT.MELEE_DAMAGE, CONSULTANT.MELEE_KNOCKBACK);
      }
      this.world.vfx(
        'vfx-slash-e',
        this.x + Math.cos(this.facing) * 14,
        this.y - 8 + Math.sin(this.facing) * 14,
        {
          rotation: this.facing,
          scale: 0.5,
        },
      );
    }
  }

  protected updateAttack(attack: string, _dt: number, elapsed: number): number | null {
    if (attack === 'diaporama') return elapsed >= 120 ? CONSULTANT.MELEE_RECOVERY_MS : null;
    const speed = (CONSULTANT.QW_DISTANCE * 1000) / CONSULTANT.QW_DURATION_MS;
    this.moveAngle(this.rushAngle, speed);
    const p = this.world.player;
    if (
      !this.rushHit &&
      distanceToSegment({ x: p.x, y: p.y }, this.rushFrom, { x: this.x, y: this.y }) <=
        CONSULTANT.QW_WIDTH / 2 + 6
    ) {
      this.rushHit = true;
      this.hitPlayer(CONSULTANT.QW_DAMAGE, 32);
    }
    if (elapsed >= CONSULTANT.QW_DURATION_MS || !this.body.blocked.none) {
      this.halt();
      this.exposed = true;
      this.scene.time.delayedCall(CONSULTANT.QW_RECOVERY_MS, () => (this.exposed = false));
      return CONSULTANT.QW_RECOVERY_MS;
    }
    return null;
  }

  protected override damageTakenMult(hit: EnemyHit): number {
    return super.damageTakenMult(hit) + (this.exposed ? CONSULTANT.QW_RECOVERY_DAMAGE_TAKEN : 0);
  }
}
