import type { HitShape } from '@/config/balance';
import type { OutgoingMods } from '@/systems/combat/damage';
import { rollOutgoing } from '@/systems/combat/damage';
import type { Circle } from '@/systems/combat/geometry';
import { circlesOverlap, shapeHits } from '@/systems/combat/geometry';
import type { Vec2 } from '@/utils/math';
import type { EnemySim } from '@/sim/enemies/EnemySim';
import type { SimWorld } from '@/sim/SimWorld';

export interface SwingSpec {
  readonly shape: HitShape | { readonly kind: 'radial'; readonly radius: number };
  readonly damage: number;
  readonly knockbackPx: number;
  readonly knockbackMs: number;
  readonly stunMs: number;
  readonly eliteStunMs?: number;
  readonly breaksProjectiles: boolean;
  /** Coup 3 : effets « finisher » (Vulnérable, arc électrique). */
  readonly finisher: boolean;
  /** Coups du combo : ralentissement des Avantages de Béné. */
  readonly combo: boolean;
}

export interface SwingReport {
  readonly targets: number;
  readonly crit: boolean;
  readonly kills: number;
}

/**
 * La clé à tire-fond (port pur de `entities/Weapon.ts`) : hitbox géométrique interrogée pendant les
 * pas actifs. Un ensemble des cibles touchées garantit un seul impact par ennemi et par coup.
 * Les projectiles arriveront avec la Borne (J2 suite) : `breaksProjectiles` est déjà porté par la spec.
 */
export class Weapon {
  private readonly touched = new Set<EnemySim>();

  public constructor(private readonly world: SimWorld) {}

  /** Début des frames actives d'un coup. */
  public begin(): void {
    this.touched.clear();
  }

  public sweep(origin: Vec2, angle: number, spec: SwingSpec, out: OutgoingMods): SwingReport {
    const mods = this.world.run.mods;
    let targets = 0;
    let kills = 0;
    let anyCrit = false;
    const inShape = (c: Circle): boolean =>
      spec.shape.kind === 'radial'
        ? circlesOverlap({ x: origin.x, y: origin.y, r: spec.shape.radius }, c)
        : shapeHits(spec.shape, origin, angle, c);

    let first: EnemySim | null = null;
    for (const enemy of this.world.livingEnemies()) {
      if (this.touched.has(enemy) || !enemy.isHittable()) continue;
      if (!inShape(enemy.hurtCircle)) continue;
      this.touched.add(enemy);
      const roll = rollOutgoing(spec.damage, out, this.world.rng);
      anyCrit ||= roll.crit;
      const away =
        spec.shape.kind === 'radial'
          ? Math.atan2(enemy.body.y - origin.y, enemy.body.x - origin.x)
          : angle;
      const result = enemy.takeHit({
        amount: roll.amount,
        crit: roll.crit,
        fromX: origin.x,
        fromY: origin.y,
        knockbackAngle: away,
        knockbackPx: spec.knockbackPx * mods.knockbackMult,
        knockbackMs: spec.knockbackMs,
        stunMs: enemy.isHeavy ? (spec.eliteStunMs ?? spec.stunMs) : spec.stunMs,
        slow: spec.combo ? mods.slowOnHit : 0,
        slowMs: mods.slowMs,
        vulnerable: spec.finisher ? mods.vulnerableOnFinisher : 0,
        meltdownStun: spec.combo && !spec.finisher && this.world.run.burnout.inMeltdown,
        heavy: spec.finisher || spec.shape.kind === 'radial',
      });
      targets += 1;
      if (result.killed) kills += 1;
      first ??= enemy;
    }

    // Arc électrique (Avantage de Kevin) : rebondit sur les ennemis proches de la première cible.
    if (spec.finisher && first && mods.chainTargets > 0 && mods.chainDamage > 0) {
      const src = first;
      const others = this.world
        .livingEnemies()
        .filter(
          (e) =>
            e !== src &&
            e.isHittable() &&
            Math.hypot(e.body.x - src.body.x, e.body.y - src.body.y) < 96,
        )
        .slice(0, mods.chainTargets);
      for (const e of others) {
        const r = e.takeHit({
          amount: Math.round(mods.chainDamage),
          crit: false,
          fromX: src.body.x,
          fromY: src.body.y,
          knockbackAngle: Math.atan2(e.body.y - src.body.y, e.body.x - src.body.x),
          knockbackPx: 0,
          knockbackMs: 0,
          stunMs: 150,
          slow: 0,
          slowMs: 0,
          vulnerable: 0,
          meltdownStun: false,
          heavy: false,
        });
        if (r.killed) kills += 1;
      }
    }
    return { targets, crit: anyCrit, kills };
  }
}
