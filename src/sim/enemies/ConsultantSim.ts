import { CONSULTANT } from '@/config/balance';
import type { TokenKind } from '@/systems/combat/AttackTokens';
import type { EnemyScale } from '@/systems/combat/damage';
import { circleInArc, distanceToSegment } from '@/systems/combat/geometry';
import type { SimWorld } from '@/sim/SimWorld';
import type { EnemyHit } from '@/sim/enemies/EnemySim';
import { EnemySim } from '@/sim/enemies/EnemySim';

/** Durée des frames actives du « Coup de diaporama » (version Phaser : 120 ms). */
const DIAPORAMA_ACTIVE_MS = 120;
/** Le « Coup de diaporama » part de 8 u au-dessus des pieds (plan du sol, comme la version Phaser). */
const DIAPORAMA_ORIGIN_Y = 8;
/** Demi-largeur de la ruée tolérée autour du corps du héros. */
const QW_HERO_SLACK = 6;
const QW_KNOCKBACK = 32;

export type ConsultantAttack = 'diaporama' | 'quickwin';

/**
 * Consultant Junior (port pur de `entities/enemies/ConsultantJunior.ts`) : il tourne autour du héros,
 * puis frappe au « Coup de diaporama » (arc de 90°) ou se rue en « Quick win » (96 u). Vulnérable pendant
 * la récupération de sa ruée.
 */
export class ConsultantSim extends EnemySim {
  private aggro = false;
  private aliveMs = 0;
  private qwReadyAt = 0;
  private strafeDir = 1;
  private strafeSwitch = 0;
  private rushAngle = 0;
  private rushFrom = { x: 0, y: 0 };
  private rushHit = false;
  private exposedLeft = 0;

  public constructor(world: SimWorld, x: number, y: number, scale: EnemyScale) {
    super(world, 'consultant', x, y, scale);
    this.strafeDir = world.rng() < 0.5 ? -1 : 1;
  }

  /** En récupération de ruée : prend +25 % de dégâts (la vue peut le signaler). */
  public get exposed(): boolean {
    return this.exposedLeft > 0;
  }

  public override tick(dtMs: number): void {
    if (this.exposedLeft > 0) this.exposedLeft = Math.max(0, this.exposedLeft - dtMs);
    super.tick(dtMs);
  }

  protected think(dtMs: number): string | null {
    this.aliveMs += dtMs;
    const d = this.distToHero();
    if (!this.aggro && (d < CONSULTANT.AGGRO_PX || this.aliveMs > CONSULTANT.AGGRO_ALL_AFTER_MS))
      this.aggro = true;
    if (!this.aggro) {
      this.halt();
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
    const a = this.angleToHero();
    const lateral = d > 48 ? 0.6 * this.strafeDir : 0;
    const h = this.world.hero.body;
    this.moveToward(
      h.x + Math.cos(a + Math.PI / 2) * lateral * 40,
      h.y + Math.sin(a + Math.PI / 2) * lateral * 40,
    );
    this.facing = a;
    return null;
  }

  protected tokenFor(): TokenKind {
    return 'melee';
  }

  protected windupMs(attack: string): number {
    return attack === 'quickwin' ? CONSULTANT.QW_TELEGRAPH_MS : CONSULTANT.MELEE_TELEGRAPH_MS;
  }

  protected onWindup(attack: string): void {
    this.facing = this.angleToHero();
    if (attack === 'quickwin') {
      this.rushAngle = this.facing;
      this.telegraph = {
        kind: 'line',
        x: this.body.x,
        y: this.body.y,
        angle: this.rushAngle,
        length: CONSULTANT.QW_DISTANCE,
        width: CONSULTANT.QW_WIDTH,
      };
    } else {
      this.telegraph = {
        kind: 'arc',
        x: this.body.x,
        y: this.body.y - DIAPORAMA_ORIGIN_Y,
        angle: this.facing,
        reach: CONSULTANT.MELEE_REACH,
        arcDeg: CONSULTANT.MELEE_ARC_DEG,
      };
    }
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
    if (attack === 'quickwin') {
      this.rushFrom = { x: this.body.x, y: this.body.y };
      this.rushHit = false;
      this.qwReadyAt = this.world.now() + CONSULTANT.QW_COOLDOWN_MS;
      return;
    }
    const origin = { x: this.body.x, y: this.body.y - DIAPORAMA_ORIGIN_Y };
    if (
      circleInArc(
        origin,
        this.facing,
        CONSULTANT.MELEE_REACH,
        CONSULTANT.MELEE_ARC_DEG,
        this.world.hero.hurtCircle,
      )
    ) {
      this.hitHero(CONSULTANT.MELEE_DAMAGE, CONSULTANT.MELEE_KNOCKBACK);
    }
  }

  protected updateAttack(attack: string, _dt: number, elapsed: number): number | null {
    if (attack === 'diaporama')
      return elapsed >= DIAPORAMA_ACTIVE_MS ? CONSULTANT.MELEE_RECOVERY_MS : null;
    const speed = (CONSULTANT.QW_DISTANCE * 1000) / CONSULTANT.QW_DURATION_MS;
    this.moveAngle(this.rushAngle, speed);
    const h = this.world.hero.body;
    if (
      !this.rushHit &&
      distanceToSegment({ x: h.x, y: h.y }, this.rushFrom, { x: this.body.x, y: this.body.y }) <=
        CONSULTANT.QW_WIDTH / 2 + QW_HERO_SLACK
    ) {
      this.rushHit = true;
      this.hitHero(CONSULTANT.QW_DAMAGE, QW_KNOCKBACK);
    }
    if (elapsed >= CONSULTANT.QW_DURATION_MS || (elapsed > 0 && this.body.blocked)) {
      this.halt();
      this.exposedLeft = CONSULTANT.QW_RECOVERY_MS;
      return CONSULTANT.QW_RECOVERY_MS;
    }
    return null;
  }

  protected override damageTakenMult(hit: EnemyHit): number {
    return super.damageTakenMult(hit) + (this.exposed ? CONSULTANT.QW_RECOVERY_DAMAGE_TAKEN : 0);
  }
}
