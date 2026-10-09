import type { TokenKind } from '@/systems/combat/AttackTokens';
import type { EnemyHit, HitResult } from '@/sim/enemies/EnemySim';
import { EnemySim } from '@/sim/enemies/EnemySim';
import type { SimWorld } from '@/sim/SimWorld';

/** Fenêtre glissante du DPS affiché au-dessus du mannequin (ms). */
const DPS_WINDOW_MS = 4000;
/** Le mannequin recule à peine : on veut lire les dégâts, pas le poursuivre. */
const KNOCKBACK_FACTOR = 0.15;
/** Retour sur la palette après un recul (u/s) et tolérance (u). */
const RETURN_SPEED = 40;
const RETURN_EPS = 2;

/**
 * Mannequin de formation sécurité (Cour intérieure, station de Josiane) : encaisse, affiche les dégâts
 * et le DPS, ne riposte jamais et ne meurt jamais (port de `entities/enemies/TrainingDummy`).
 * Corps de Consultant Junior côté règles (hurtbox, masse), vue dédiée côté rendu.
 */
export class TrainingDummySim extends EnemySim {
  private readonly hits: { t: number; amount: number }[] = [];
  /** Total encaissé depuis l'arrivée dans la Cour. */
  public total = 0;

  private readonly homeX: number;
  private readonly homeY: number;

  public constructor(world: SimWorld, x: number, y: number) {
    super(world, 'consultant', x, y, { hp: 100, damage: 0, speed: 0 });
    this.facing = Math.PI / 2;
    this.homeX = x;
    this.homeY = y;
  }

  public override get displayName(): string {
    return 'Mannequin de formation';
  }

  /** Dégâts par seconde sur la fenêtre glissante (0 si l'on ne frappe plus). */
  public get dps(): number {
    const now = this.world.now();
    const recent = this.hits.filter((h) => now - h.t <= DPS_WINDOW_MS);
    if (recent.length === 0) return 0;
    const first = recent[0]?.t ?? now;
    const span = Math.max(1000, now - first);
    return (recent.reduce((s, h) => s + h.amount, 0) * 1000) / span;
  }

  public override takeHit(hit: EnemyHit): HitResult {
    const result = super.takeHit({ ...hit, knockbackPx: hit.knockbackPx * KNOCKBACK_FACTOR });
    this.hp = this.maxHp;
    if (result.dealt > 0) {
      const now = this.world.now();
      this.hits.push({ t: now, amount: result.dealt });
      while ((this.hits[0]?.t ?? now) < now - DPS_WINDOW_MS) this.hits.shift();
      this.total += result.dealt;
    }
    return { dealt: result.dealt, killed: false };
  }

  /** Revient lentement sur sa palette après un recul, puis attend, face au héros. */
  protected think(): null {
    if (Math.hypot(this.body.x - this.homeX, this.body.y - this.homeY) > RETURN_EPS) {
      this.moveToward(this.homeX, this.homeY, RETURN_SPEED);
    } else this.halt();
    this.facing = this.angleToHero();
    return null;
  }

  protected windupMs(): number {
    return 0;
  }

  protected tokenFor(): TokenKind | null {
    return null;
  }

  protected onWindup(): void {
    // Jamais.
  }

  protected updateAttack(): number {
    return 0;
  }
}
