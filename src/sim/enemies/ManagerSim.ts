import { MANAGER } from '@/config/balance';
import type { TokenKind } from '@/systems/combat/AttackTokens';
import type { EnemyScale } from '@/systems/combat/damage';
import { circleInArc } from '@/systems/combat/geometry';
import type { SimWorld } from '@/sim/SimWorld';
import type { EnemyHit } from '@/sim/enemies/EnemySim';
import { EnemySim } from '@/sim/enemies/EnemySim';

/** La tablette part de 12 u au-dessus des pieds (version Phaser). */
const TABLET_ORIGIN_Y = 12;
const REPORT_WINDUP_MS = 400;
const CHRONO_WINDUP_MS = 300;

/**
 * Élite « Le Tableur » (port pur de `entities/enemies/ManagerKpi.ts`) : garde ses distances, pose des
 * Chronomètres (zones qui ralentissent) sous le héros, lance un Reporting (anneau qui s'étend) et frappe
 * à la tablette au contact. Posture « Costume trois-pièces » : insensible aux coups 1-2, elle casse
 * après 50 dégâts en 3 s (étourdi 1,5 s, +25 % de dégâts subis).
 */
export class ManagerSim extends EnemySim {
  private nextChrono = 0;
  private nextReport = 0;
  private nextTablet = 0;
  private readonly recentDamage: { at: number; amount: number }[] = [];
  private brokenLeft = 0;

  public constructor(world: SimWorld, x: number, y: number, scale: EnemyScale) {
    super(world, 'manager', x, y, scale);
    const now = world.now();
    this.nextChrono = now + 2500;
    this.nextReport = now + MANAGER.REPORT_FIRST_AT_MS;
  }

  public override tick(dtMs: number): void {
    if (this.brokenLeft > 0) {
      this.brokenLeft = Math.max(0, this.brokenLeft - dtMs);
      if (this.brokenLeft === 0) this.broken = false;
    }
    super.tick(dtMs);
  }

  protected think(): string | null {
    const now = this.world.now();
    const d = this.distToHero();
    const a = this.angleToHero();
    this.facing = a;
    if (d <= MANAGER.TABLET_RANGE && now >= this.nextTablet) return 'tablet';
    if (now >= this.nextReport) return 'report';
    if (now >= this.nextChrono) return 'chrono';
    const h = this.world.hero.body;
    if (d < MANAGER.KEEP_MIN) this.moveAngle(a + Math.PI, this.speed);
    else if (d > MANAGER.KEEP_MAX) this.moveToward(h.x, h.y);
    else this.moveAngle(a + Math.PI / 2, this.speed * 0.5);
    this.facing = a;
    return null;
  }

  protected tokenFor(attack: string): TokenKind | null {
    return attack === 'tablet' ? 'melee' : null;
  }

  protected windupMs(attack: string): number {
    if (attack === 'tablet') return MANAGER.TABLET_TELEGRAPH_MS;
    if (attack === 'report') return REPORT_WINDUP_MS;
    return CHRONO_WINDUP_MS;
  }

  protected onWindup(attack: string): void {
    this.facing = this.angleToHero();
    if (attack === 'tablet') {
      this.telegraph = {
        kind: 'arc',
        x: this.body.x,
        y: this.body.y - TABLET_ORIGIN_Y,
        angle: this.facing,
        reach: MANAGER.TABLET_REACH,
        arcDeg: MANAGER.TABLET_ARC_DEG,
      };
    }
  }

  protected override onAttackStart(attack: string): void {
    const now = this.world.now();
    const h = this.world.hero;
    this.world.emit({
      type: 'enemyStrike',
      id: this.id,
      attack,
      x: this.body.x,
      y: this.body.y,
      angle: this.facing,
    });
    if (attack === 'tablet') {
      this.nextTablet = now + MANAGER.TABLET_COOLDOWN_MS;
      if (
        circleInArc(
          { x: this.body.x, y: this.body.y - TABLET_ORIGIN_Y },
          this.facing,
          MANAGER.TABLET_REACH,
          MANAGER.TABLET_ARC_DEG,
          h.hurtCircle,
        )
      ) {
        this.hitHero(MANAGER.TABLET_DAMAGE, MANAGER.TABLET_KNOCKBACK);
      }
    } else if (attack === 'chrono') {
      this.nextChrono = now + MANAGER.CHRONO_PERIOD_MS;
      this.world.spawnHazard({
        kind: 'circle',
        x: h.body.x,
        y: h.body.y,
        radius: MANAGER.CHRONO_RADIUS,
        telegraphMs: MANAGER.CHRONO_TELEGRAPH_MS,
        damage: Math.round(MANAGER.CHRONO_DAMAGE * this.damageMult),
        owner: this.displayName,
        lingerMs: MANAGER.CHRONO_ZONE_MS,
        slow: MANAGER.CHRONO_SLOW,
        tickMs: 1000,
        tickDamage: Math.round(MANAGER.CHRONO_DAMAGE * this.damageMult),
      });
    } else {
      this.nextReport = now + MANAGER.REPORT_PERIOD_MS;
      this.world.emit({
        type: 'text',
        x: this.body.x,
        y: this.body.y,
        text: 'REPORTING HEBDO',
        tone: 'danger',
      });
      this.world.spawnHazard({
        kind: 'ring',
        x: this.body.x,
        y: this.body.y,
        maxRadius: MANAGER.REPORT_RADIUS,
        thickness: MANAGER.REPORT_THICKNESS,
        telegraphMs: MANAGER.REPORT_TELEGRAPH_MS,
        expandMs: MANAGER.REPORT_EXPAND_MS,
        damage: Math.round(MANAGER.REPORT_DAMAGE * this.damageMult),
        owner: this.displayName,
      });
    }
  }

  protected updateAttack(attack: string, _dt: number, elapsed: number): number | null {
    if (attack === 'report') return elapsed >= MANAGER.REPORT_TELEGRAPH_MS ? 400 : null;
    return elapsed >= 200 ? 500 : null;
  }

  protected override interruptible(): boolean {
    return this.broken;
  }

  protected override onHurt(amount: number): void {
    const now = this.world.now();
    this.recentDamage.push({ at: now, amount });
    while ((this.recentDamage[0]?.at ?? now) < now - MANAGER.POISE_WINDOW_MS)
      this.recentDamage.shift();
    const total = this.recentDamage.reduce((s, d) => s + d.amount, 0);
    if (!this.broken && total >= MANAGER.POISE_DAMAGE) {
      this.broken = true;
      this.brokenLeft = MANAGER.BREAK_MS;
      this.recentDamage.length = 0;
      this.world.emit({
        type: 'text',
        x: this.body.x,
        y: this.body.y,
        text: 'BURN-OUT DU MANAGER',
        tone: 'gold',
      });
      this.world.emit({ type: 'shake', px: 2, ms: 120 });
      this.fsm.request({ to: 'stagger', payload: { ms: MANAGER.BREAK_MS } });
    }
  }

  protected override damageTakenMult(hit: EnemyHit): number {
    return super.damageTakenMult(hit) + (this.broken ? MANAGER.BREAK_DAMAGE_TAKEN : 0);
  }
}
