import { MANAGER } from '@/config/balance';
import { Colors, Css } from '@/config/constants';
import type { TokenKind } from '@/systems/combat/AttackTokens';
import type { EnemyScale } from '@/systems/combat/damage';
import { circleInArc } from '@/systems/combat/geometry';
import type { CombatWorld } from '@/entities/CombatWorld';
import type { EnemyHit } from '@/entities/Enemy';
import { Enemy } from '@/entities/Enemy';

/**
 * Élite « Le Tableur » : garde ses distances, pose des Chronomètres (zones qui ralentissent) sous le héros,
 * lance un Reporting (anneau qui s'étend) et frappe à la tablette au contact.
 * Posture « Costume trois-pièces » : insensible aux coups 1-2, elle casse après 50 dégâts en 3 s.
 */
export class ManagerKpi extends Enemy {
  protected readonly directional = true;
  protected readonly animPrefix = 'manager-kpi';
  private nextChrono = 0;
  private nextReport = 0;
  private nextTablet = 0;
  private readonly recentDamage: { at: number; amount: number }[] = [];
  private broken = false;

  public constructor(world: CombatWorld, x: number, y: number, scale: EnemyScale) {
    super(world, 'manager', x, y, 'manager-kpi-idle-down', scale);
    const now = world.now();
    this.nextChrono = now + 2500;
    this.nextReport = now + MANAGER.REPORT_FIRST_AT_MS;
  }

  protected think(): string | null {
    const now = this.world.now();
    const d = this.distToPlayer();
    const a = this.angleToPlayer();
    this.facing = a;
    if (d <= MANAGER.TABLET_RANGE && now >= this.nextTablet) return 'tablet';
    if (now >= this.nextReport) return 'report';
    if (now >= this.nextChrono) return 'chrono';
    if (d < MANAGER.KEEP_MIN) this.moveAngle(a + Math.PI, this.speed);
    else if (d > MANAGER.KEEP_MAX) this.moveToward(this.world.player.x, this.world.player.y);
    else this.moveAngle(a + Math.PI / 2, this.speed * 0.5);
    this.facing = a;
    this.playAnim('walk');
    return null;
  }

  protected tokenFor(attack: string): TokenKind | null {
    return attack === 'tablet' ? 'melee' : null;
  }

  protected windupMs(attack: string): number {
    if (attack === 'tablet') return MANAGER.TABLET_TELEGRAPH_MS;
    if (attack === 'report') return 400;
    return 300;
  }

  protected onWindup(attack: string): void {
    this.facing = this.angleToPlayer();
    this.playAnim('attack', true);
    if (attack === 'tablet') {
      this.setTint(Colors.danger);
      const half = (MANAGER.TABLET_ARC_DEG * Math.PI) / 360;
      this.showTelegraph((g) =>
        g
          .fillStyle(Colors.danger, 0.25)
          .slice(this.x, this.y - 12, MANAGER.TABLET_REACH, this.facing - half, this.facing + half)
          .fillPath(),
      );
    }
  }

  protected override restoreTint(): void {
    if (this.aiState === 'windup' && this.windupAttack === 'tablet') this.setTint(Colors.danger);
    else this.clearTint();
  }

  protected override onAttackStart(attack: string): void {
    this.clearTint();
    const now = this.world.now();
    const p = this.world.player;
    if (attack === 'tablet') {
      this.nextTablet = now + MANAGER.TABLET_COOLDOWN_MS;
      if (
        circleInArc(
          { x: this.x, y: this.y - 12 },
          this.facing,
          MANAGER.TABLET_REACH,
          MANAGER.TABLET_ARC_DEG,
          { x: p.x, y: p.y - 10, r: 8 },
        )
      ) {
        this.hitPlayer(MANAGER.TABLET_DAMAGE, MANAGER.TABLET_KNOCKBACK);
      }
    } else if (attack === 'chrono') {
      this.nextChrono = now + MANAGER.CHRONO_PERIOD_MS;
      this.world.spawnHazard({
        kind: 'circle',
        x: p.x,
        y: p.y,
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
      this.world.feel.floatText(this.x, this.y - 44, 'REPORTING HEBDO', Css.danger, 1200);
      this.world.spawnHazard({
        kind: 'ring',
        x: this.x,
        y: this.y,
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

  protected override onHurt(amount: number, hit: EnemyHit): void {
    const now = this.world.now();
    this.recentDamage.push({ at: now, amount });
    while ((this.recentDamage[0]?.at ?? now) < now - MANAGER.POISE_WINDOW_MS)
      this.recentDamage.shift();
    const total = this.recentDamage.reduce((s, d) => s + d.amount, 0);
    if (!this.broken && total >= MANAGER.POISE_DAMAGE) {
      this.broken = true;
      this.recentDamage.length = 0;
      this.world.feel.floatText(this.x, this.y - 44, 'BURN-OUT DU MANAGER', Css.quaiYellow, 1200);
      this.world.feel.shake(2, 120);
      this.fsm.request({ to: 'stagger', payload: { ms: MANAGER.BREAK_MS } });
      this.scene.time.delayedCall(MANAGER.BREAK_MS, () => (this.broken = false));
    }
    if (hit.stunMs > 0 || this.broken) this.playAnim('hurt', true);
  }

  protected override damageTakenMult(hit: EnemyHit): number {
    return super.damageTakenMult(hit) + (this.broken ? MANAGER.BREAK_DAMAGE_TAKEN : 0);
  }
}
