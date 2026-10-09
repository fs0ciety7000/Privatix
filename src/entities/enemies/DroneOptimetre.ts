import { DRONE } from '@/config/balance';
import { Colors } from '@/config/constants';
import type { TokenKind } from '@/systems/combat/AttackTokens';
import type { EnemyScale } from '@/systems/combat/damage';
import { angleDiff } from '@/utils/math';
import type { CombatWorld } from '@/entities/CombatWorld';
import type { EnemyHit } from '@/entities/Enemy';
import { Enemy } from '@/entities/Enemy';

/**
 * Drone Optimètre (distance mobile) : orbite à 96 px, tire des billes, balaie le héros d'un cône de scan
 * (marqué : +25 % de dégâts subis pendant 5 s) et plonge parfois sur lui. Cloué au sol après un piqué.
 */
export class DroneOptimetre extends Enemy {
  protected readonly directional = false;
  protected readonly animPrefix = 'drone';
  private orbitDir = 1;
  private lastShot = 0;
  private nextDive = 0;
  private nextScan = 0;
  private diveAngle = 0;
  private diveHit = false;
  private scanInCone = 0;
  private grounded = false;
  private bob = 0;

  public constructor(world: CombatWorld, x: number, y: number, scale: EnemyScale) {
    super(world, 'drone', x, y, 'drone-fly', scale);
    this.orbitDir = world.rng() < 0.5 ? -1 : 1;
    const now = world.now();
    this.lastShot = now - world.rng() * DRONE.SHOT_PERIOD_MS;
    this.nextDive = now + 2500 + world.rng() * 2000;
    this.nextScan = now + 1500 + world.rng() * 3000;
  }

  public override tick(dtMs: number): void {
    super.tick(dtMs);
    // Vol : léger flottement du sprite au-dessus de son ombre.
    this.bob += dtMs;
    if (!this.grounded && !this.isDead)
      this.setDisplayOrigin(this.pivot.x, this.pivot.y + Math.sin(this.bob / 180) * 1.5);
  }

  protected think(): string | null {
    const now = this.world.now();
    const d = this.distToPlayer();
    const a = this.angleToPlayer();
    this.facing = a;
    this.playAnim('fly');
    if (d < DRONE.FLEE_BELOW) {
      this.moveAngle(a + Math.PI, DRONE.FLEE_SPEED);
    } else {
      // Orbite : composante tangentielle + correction radiale vers 96 px.
      const radial = (d - DRONE.ORBIT_PX) / DRONE.ORBIT_PX;
      const tangent = a + (Math.PI / 2) * this.orbitDir;
      const vx = Math.cos(tangent) * this.speed + Math.cos(a) * radial * this.speed * 1.5;
      const vy = Math.sin(tangent) * this.speed + Math.sin(a) * radial * this.speed * 1.5;
      const v = Math.hypot(vx, vy) || 1;
      this.moveAngle(Math.atan2(vy, vx), Math.min(this.speed, v));
      if (!this.body.blocked.none) this.orbitDir *= -1;
    }
    if (now >= this.nextDive && d < DRONE.DIVE_DISTANCE + 20) return 'dive';
    if (now >= this.nextScan && d < DRONE.SCAN_RANGE + 20) return 'scan';
    if (now - this.lastShot >= DRONE.SHOT_PERIOD_MS) return 'shot';
    return null;
  }

  protected tokenFor(attack: string): TokenKind {
    return attack === 'dive' ? 'melee' : 'ranged';
  }

  protected windupMs(attack: string): number {
    if (attack === 'dive') return DRONE.DIVE_TELEGRAPH_MS;
    if (attack === 'scan') return 200;
    return DRONE.SHOT_TELEGRAPH_MS;
  }

  protected onWindup(attack: string): void {
    this.playAnim('attack', true);
    this.anims.pause(this.anims.currentAnim?.frames[1]);
    const a = this.angleToPlayer();
    this.facing = a;
    if (attack === 'dive') {
      this.diveAngle = a;
      const x1 = this.x + Math.cos(a) * DRONE.DIVE_DISTANCE;
      const y1 = this.y + Math.sin(a) * DRONE.DIVE_DISTANCE;
      this.showTelegraph((g) => {
        g.lineStyle(DRONE.DIVE_RADIUS * 2, Colors.danger, 0.2).lineBetween(this.x, this.y, x1, y1);
        g.lineStyle(1, Colors.danger, 0.9).strokeCircle(x1, y1, DRONE.DIVE_RADIUS);
      });
    } else if (attack === 'shot') {
      this.showTelegraph((g) =>
        g.fillStyle(Colors.danger, 0.9).fillCircle(this.x, this.y - DRONE.hurtOffsetY, 3),
      );
    }
  }

  protected override onAttackStart(attack: string): void {
    this.anims.resume();
    if (attack === 'shot') {
      this.lastShot = this.world.now();
      this.world.spawnProjectile({
        x: this.x,
        y: this.y - DRONE.hurtOffsetY,
        angle: this.angleToPlayer(),
        speed: DRONE.SHOT_SPEED,
        damage: Math.round(DRONE.SHOT_DAMAGE * this.damageMult),
        lifeMs: 2000,
        radius: DRONE.SHOT_RADIUS,
        owner: this.displayName,
        scale: 0.6,
      });
    } else if (attack === 'dive') {
      this.diveHit = false;
      this.nextDive = this.world.now() + DRONE.DIVE_COOLDOWN_MS;
    } else {
      this.scanInCone = 0;
      this.nextScan = this.world.now() + DRONE.SCAN_COOLDOWN_MS;
    }
  }

  protected updateAttack(attack: string, dtMs: number, elapsed: number): number | null {
    if (attack === 'shot') return 300;
    if (attack === 'dive') {
      this.moveAngle(this.diveAngle, (DRONE.DIVE_DISTANCE * 1000) / DRONE.DIVE_DURATION_MS);
      const p = this.world.player;
      if (!this.diveHit && Math.hypot(p.x - this.x, p.y - this.y) <= DRONE.DIVE_RADIUS + 8) {
        this.diveHit = true;
        this.hitPlayer(DRONE.DIVE_DAMAGE, 20);
      }
      if (elapsed >= DRONE.DIVE_DURATION_MS || !this.body.blocked.none) {
        this.halt();
        this.grounded = true;
        this.setDisplayOrigin(this.pivot.x, this.pivot.y - 4);
        this.world.feel.dustAt(this.x, this.y, 5);
        this.scene.time.delayedCall(DRONE.GROUNDED_MS, () => (this.grounded = false));
        return DRONE.GROUNDED_MS;
      }
      return null;
    }
    // Scan : cône qui balaie ; 300 ms dans le cône = héros marqué.
    this.halt();
    const sweep = ((elapsed / DRONE.SCAN_MS) * 2 - 1) * ((DRONE.SCAN_CONE_DEG * Math.PI) / 360);
    const base = this.angleToPlayer();
    const dir = base + sweep * 0.5;
    const half = (DRONE.SCAN_CONE_DEG * Math.PI) / 360;
    this.showTelegraph((g) =>
      g
        .fillStyle(Colors.danger, 0.18)
        .slice(this.x, this.y - DRONE.hurtOffsetY, DRONE.SCAN_RANGE, dir - half, dir + half)
        .fillPath(),
    );
    const p = this.world.player;
    const inCone =
      Math.hypot(p.x - this.x, p.y - this.y) <= DRONE.SCAN_RANGE &&
      Math.abs(angleDiff(dir, Math.atan2(p.y - this.y, p.x - this.x))) <= half;
    this.scanInCone = inCone ? this.scanInCone + dtMs : 0;
    if (this.scanInCone >= DRONE.MARK_AFTER_MS) {
      p.mark(DRONE.MARK_MS, DRONE.MARK_DAMAGE_TAKEN);
      return 400;
    }
    return elapsed >= DRONE.SCAN_MS ? 400 : null;
  }

  protected override damageTakenMult(hit: EnemyHit): number {
    return super.damageTakenMult(hit) + (this.grounded ? DRONE.GROUNDED_DAMAGE_TAKEN : 0);
  }
}
