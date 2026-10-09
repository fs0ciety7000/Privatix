import type { ToolShape } from '@/config/loot';
import type { OutgoingMods } from '@/systems/combat/damage';
import { rollOutgoing } from '@/systems/combat/damage';
import type { Circle } from '@/systems/combat/geometry';
import { circlesOverlap, shapeHits } from '@/systems/combat/geometry';
import type { Vec2 } from '@/utils/math';
import type { EnemySim } from '@/sim/enemies/EnemySim';
import type { SimWorld } from '@/sim/SimWorld';

export interface SwingSpec {
  /**
   * Arc, rectangle orienté, cercle d'Outil (`at` px devant l'origine : Masse, Pelle, Perche), ou
   * disque centré (sifflet, pouvoirs).
   */
  readonly shape: ToolShape | { readonly kind: 'radial'; readonly radius: number };
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
  /** Ralentissement propre au coup (Outil, Dernière Traverse) : fraction de vitesse et durée. */
  readonly slow?: { readonly fraction: number; readonly ms: number };
}

export interface SwingReport {
  readonly targets: number;
  readonly crit: boolean;
  readonly kills: number;
  readonly projectiles: number;
}

/**
 * La clé à tire-fond (port pur de `entities/Weapon.ts`) : hitbox géométrique interrogée pendant les
 * pas actifs. Un ensemble des cibles touchées garantit un seul impact par ennemi et par coup.
 * Le coup 3, le sifflet et l'Avantage de Josiane cassent aussi les projectiles touchés.
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
    const shape = spec.shape;
    // Cercle d'Outil : centré `at` px devant l'origine (0 : autour du héros).
    const center =
      shape.kind === 'circle'
        ? { x: origin.x + Math.cos(angle) * shape.at, y: origin.y + Math.sin(angle) * shape.at }
        : origin;
    const inShape = (c: Circle): boolean =>
      shape.kind === 'radial'
        ? circlesOverlap({ x: origin.x, y: origin.y, r: shape.radius }, c)
        : shape.kind === 'circle'
          ? circlesOverlap({ x: center.x, y: center.y, r: shape.radius }, c)
          : shapeHits(shape, origin, angle, c);
    const radialShape = shape.kind === 'radial' || shape.kind === 'circle';

    let first: EnemySim | null = null;
    for (const enemy of this.world.livingEnemies()) {
      if (this.touched.has(enemy) || !enemy.isHittable()) continue;
      if (!inShape(enemy.hurtCircle)) continue;
      this.touched.add(enemy);
      const roll = rollOutgoing(spec.damage, out, this.world.rng);
      anyCrit ||= roll.crit;
      const away = radialShape
        ? Math.atan2(enemy.body.y - center.y, enemy.body.x - center.x)
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
        slow: Math.max(spec.combo ? mods.slowOnHit : 0, spec.slow?.fraction ?? 0),
        slowMs: Math.max(mods.slowMs, spec.slow?.ms ?? 0),
        vulnerable: spec.finisher ? mods.vulnerableOnFinisher : 0,
        meltdownStun: spec.combo && !spec.finisher && this.world.run.burnout.inMeltdown,
        heavy: spec.finisher || radialShape,
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
    let projectiles = 0;
    if (spec.breaksProjectiles || (spec.combo && mods.comboBreaksProjectiles)) {
      for (const p of this.world.activeProjectiles()) {
        if (!inShape({ x: p.x, y: p.y, r: p.r })) continue;
        this.world.breakProjectile(p);
        projectiles += 1;
      }
    }
    return { targets, crit: anyCrit, kills, projectiles };
  }
}
