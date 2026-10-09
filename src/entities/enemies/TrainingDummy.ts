import type { TokenKind } from '@/systems/combat/AttackTokens';
import type { CombatWorld } from '@/entities/CombatWorld';
import type { EnemyHit, HitResult } from '@/entities/Enemy';
import { Enemy } from '@/entities/Enemy';

/** Mannequin de formation sécurité (OCC) : encaisse, affiche les dégâts, ne riposte jamais. */
export class TrainingDummy extends Enemy {
  protected readonly directional = true;
  protected readonly animPrefix = 'consultant';

  public constructor(world: CombatWorld, x: number, y: number) {
    super(
      world,
      'consultant',
      x,
      y,
      'consultant_idle_down_strip4',
      { hp: 1000, damage: 0, speed: 0 },
      32,
    );
    this.setTint(0xff9a3a);
  }

  public override get displayName(): string {
    return 'Mannequin de formation';
  }

  public override takeHit(hit: EnemyHit): HitResult {
    const result = super.takeHit({ ...hit, knockbackPx: hit.knockbackPx * 0.2 });
    this.hp = this.maxHp;
    return result;
  }

  protected override restoreTint(): void {
    this.setTint(0xff9a3a);
  }

  protected think(): null {
    this.halt();
    this.playAnim('idle');
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
