import { DRONE } from '@/config/balance';
import type { TokenKind } from '@/systems/combat/AttackTokens';
import type { EnemyScale } from '@/systems/combat/damage';
import { angleDiff } from '@/utils/math';
import type { SimWorld } from '@/sim/SimWorld';
import type { EnemyHit } from '@/sim/enemies/EnemySim';
import { EnemySim } from '@/sim/enemies/EnemySim';

/** Durée du télégraphe du scan (version Phaser : 200 ms, puis le cône balaie pendant 1 s). */
const SCAN_WINDUP_MS = 200;
/** Le télégraphe du tir : ligne de visée fine vers le héros (u). */
const SHOT_TELEGRAPH_LENGTH = 110;
const SHOT_TELEGRAPH_WIDTH = 5;

/**
 * Drone Optimètre (port pur de `entities/enemies/DroneOptimetre.ts`) : orbite à 96 u, tire des billes,
 * balaie le héros d'un cône de scan (marqué : +25 % de dégâts subis pendant 5 s) et plonge parfois sur
 * lui. Cloué au sol après un piqué (+50 % de dégâts subis).
 */
export class DroneSim extends EnemySim {
  private orbitDir = 1;
  private lastShot = 0;
  private nextDive = 0;
  private nextScan = 0;
  private diveAngle = 0;
  private diveHit = false;
  private scanInCone = 0;
  private groundedLeft = 0;
  /** Direction courante du cône de scan (la vue l'affiche pendant le balayage). */
  public scanDir = 0;

  public constructor(world: SimWorld, x: number, y: number, scale: EnemyScale) {
    super(world, 'drone', x, y, scale);
    this.orbitDir = world.rng() < 0.5 ? -1 : 1;
    const now = world.now();
    this.lastShot = now - world.rng() * DRONE.SHOT_PERIOD_MS;
    this.nextDive = now + 2500 + world.rng() * 2000;
    this.nextScan = now + 1500 + world.rng() * 3000;
  }

  public override tick(dtMs: number): void {
    if (this.groundedLeft > 0) {
      this.groundedLeft = Math.max(0, this.groundedLeft - dtMs);
      this.grounded = this.groundedLeft > 0;
    }
    super.tick(dtMs);
  }

  protected think(): string | null {
    const now = this.world.now();
    const d = this.distToHero();
    const a = this.angleToHero();
    this.facing = a;
    if (d < DRONE.FLEE_BELOW) {
      this.moveAngle(a + Math.PI, DRONE.FLEE_SPEED);
    } else {
      // Orbite : composante tangentielle + correction radiale vers 96 u.
      const radial = (d - DRONE.ORBIT_PX) / DRONE.ORBIT_PX;
      const tangent = a + (Math.PI / 2) * this.orbitDir;
      const vx = Math.cos(tangent) * this.speed + Math.cos(a) * radial * this.speed * 1.5;
      const vy = Math.sin(tangent) * this.speed + Math.sin(a) * radial * this.speed * 1.5;
      const v = Math.hypot(vx, vy) || 1;
      this.moveAngle(Math.atan2(vy, vx), Math.min(this.speed, v));
      if (this.body.blocked) this.orbitDir *= -1;
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
    if (attack === 'scan') return SCAN_WINDUP_MS;
    return DRONE.SHOT_TELEGRAPH_MS;
  }

  protected onWindup(attack: string): void {
    const a = this.angleToHero();
    this.facing = a;
    if (attack === 'dive') {
      this.diveAngle = a;
      this.telegraph = {
        kind: 'line',
        x: this.body.x,
        y: this.body.y,
        angle: a,
        length: DRONE.DIVE_DISTANCE + DRONE.DIVE_RADIUS,
        width: DRONE.DIVE_RADIUS * 2,
      };
    } else if (attack === 'shot') {
      this.telegraph = {
        kind: 'line',
        x: this.body.x,
        y: this.body.y,
        angle: a,
        length: SHOT_TELEGRAPH_LENGTH,
        width: SHOT_TELEGRAPH_WIDTH,
      };
    } else {
      this.scanDir = a;
      this.telegraph = {
        kind: 'arc',
        x: this.body.x,
        y: this.body.y,
        angle: a,
        reach: DRONE.SCAN_RANGE,
        arcDeg: DRONE.SCAN_CONE_DEG,
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
    if (attack === 'shot') {
      this.lastShot = this.world.now();
      this.world.spawnProjectile({
        x: this.body.x,
        y: this.body.y,
        angle: this.angleToHero(),
        speed: DRONE.SHOT_SPEED,
        damage: Math.round(DRONE.SHOT_DAMAGE * this.damageMult),
        lifeMs: 2000,
        radius: DRONE.SHOT_RADIUS,
        owner: this.displayName,
        height: DRONE.hurtOffsetY,
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
      const h = this.world.hero.body;
      if (
        !this.diveHit &&
        Math.hypot(h.x - this.body.x, h.y - this.body.y) <= DRONE.DIVE_RADIUS + 8
      ) {
        this.diveHit = true;
        this.hitHero(DRONE.DIVE_DAMAGE, 20);
      }
      if (elapsed >= DRONE.DIVE_DURATION_MS || (elapsed > 0 && this.body.blocked)) {
        this.halt();
        this.grounded = true;
        this.groundedLeft = DRONE.GROUNDED_MS;
        this.world.emit({ type: 'dust', x: this.body.x, y: this.body.y, count: 5 });
        return DRONE.GROUNDED_MS;
      }
      return null;
    }
    // Scan : cône qui balaie ; 300 ms dans le cône = héros marqué.
    this.halt();
    const half = (DRONE.SCAN_CONE_DEG * Math.PI) / 360;
    const sweep = ((elapsed / DRONE.SCAN_MS) * 2 - 1) * half;
    const dir = this.angleToHero() + sweep * 0.5;
    this.scanDir = dir;
    this.telegraph = {
      kind: 'arc',
      x: this.body.x,
      y: this.body.y,
      angle: dir,
      reach: DRONE.SCAN_RANGE,
      arcDeg: DRONE.SCAN_CONE_DEG,
    };
    const h = this.world.hero.body;
    const inCone =
      Math.hypot(h.x - this.body.x, h.y - this.body.y) <= DRONE.SCAN_RANGE &&
      Math.abs(angleDiff(dir, Math.atan2(h.y - this.body.y, h.x - this.body.x))) <= half;
    this.scanInCone = inCone ? this.scanInCone + dtMs : 0;
    if (this.scanInCone >= DRONE.MARK_AFTER_MS) {
      this.world.hero.mark(DRONE.MARK_MS, DRONE.MARK_DAMAGE_TAKEN);
      return 400;
    }
    return elapsed >= DRONE.SCAN_MS ? 400 : null;
  }

  protected override damageTakenMult(hit: EnemyHit): number {
    return super.damageTakenMult(hit) + (this.grounded ? DRONE.GROUNDED_DAMAGE_TAKEN : 0);
  }
}
