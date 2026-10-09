import type { HitShape } from '@/config/balance';
import type { Circle } from '@/systems/combat/geometry';
import { circlesOverlap, shapeHits } from '@/systems/combat/geometry';
import { rollOutgoing } from '@/systems/combat/damage';
import type { Vec2 } from '@/utils/math';
import type { CombatWorld } from '@/entities/CombatWorld';
import type { Enemy } from '@/entities/Enemy';

export interface SwingSpec {
  readonly shape: HitShape | { readonly kind: 'radial'; readonly radius: number };
  readonly damage: number;
  readonly knockbackPx: number;
  readonly knockbackMs: number;
  readonly stunMs: number;
  readonly eliteStunMs?: number;
  readonly breaksProjectiles: boolean;
  /** Coup 3 : déclenche les effets « finisher » (Vulnérable, arc électrique). */
  readonly finisher: boolean;
  /** Coups du combo : ralentissement des Avantages de Béné. */
  readonly combo: boolean;
}

export interface SwingReport {
  readonly targets: number;
  readonly crit: boolean;
  readonly kills: number;
  readonly projectiles: number;
}

/**
 * La clé à tire-fond : hitbox géométrique interrogée pendant les frames actives (pas de corps Arcade).
 * Un ensemble des cibles touchées garantit un seul impact par ennemi et par coup.
 */
export class Weapon {
  private readonly touched = new Set<Enemy>();

  public constructor(private readonly world: CombatWorld) {}

  /** Début des frames actives d'un coup. */
  public begin(): void {
    this.touched.clear();
  }

  /** Interroge la hitbox ; à appeler à chaque frame active. */
  public sweep(origin: Vec2, angle: number, spec: SwingSpec): SwingReport {
    const player = this.world.player;
    const mods = this.world.run.mods;
    const out = player.outgoingMods();
    let targets = 0;
    let kills = 0;
    let anyCrit = false;
    const inShape = (c: Circle): boolean =>
      spec.shape.kind === 'radial'
        ? circlesOverlap({ x: origin.x, y: origin.y, r: spec.shape.radius }, c)
        : shapeHits(spec.shape, origin, angle, c);

    const struck: Enemy[] = [];
    for (const enemy of this.world.livingEnemies()) {
      if (this.touched.has(enemy) || !enemy.isHittable()) continue;
      if (!inShape(enemy.hurtCircle)) continue;
      this.touched.add(enemy);
      const roll = rollOutgoing(spec.damage, out, this.world.rng);
      anyCrit ||= roll.crit;
      const away =
        spec.shape.kind === 'radial' ? Math.atan2(enemy.y - origin.y, enemy.x - origin.x) : angle;
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
      });
      targets += 1;
      if (result.killed) kills += 1;
      struck.push(enemy);
    }

    // Arc électrique (Avantage de Kevin) : rebondit sur les ennemis proches de la première cible.
    const first = struck[0];
    if (spec.finisher && first && mods.chainTargets > 0 && mods.chainDamage > 0) {
      const others = this.world
        .livingEnemies()
        .filter(
          (e) => e !== first && e.isHittable() && Math.hypot(e.x - first.x, e.y - first.y) < 96,
        )
        .slice(0, mods.chainTargets);
      for (const e of others) {
        this.world.feel.sparksAt(e.x, e.y - 18, 4);
        const r = e.takeHit({
          amount: Math.round(mods.chainDamage),
          crit: false,
          fromX: first.x,
          fromY: first.y,
          knockbackAngle: Math.atan2(e.y - first.y, e.x - first.x),
          knockbackPx: 0,
          knockbackMs: 0,
          stunMs: 150,
          slow: 0,
          slowMs: 0,
          vulnerable: 0,
          meltdownStun: false,
        });
        if (r.killed) kills += 1;
      }
    }

    let projectiles = 0;
    if (spec.breaksProjectiles || (spec.combo && mods.comboBreaksProjectiles)) {
      for (const p of this.world.activeProjectiles()) {
        if (!inShape(p.hitCircle)) continue;
        this.world.feel.sparksAt(p.x, p.y, 3);
        p.kill();
        projectiles += 1;
      }
    }
    return { targets, crit: anyCrit, kills, projectiles };
  }
}
