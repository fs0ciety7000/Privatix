import type Phaser from 'phaser';
import { Colors, Depth } from '@/config/constants';
import { circlesOverlap, distanceToSegment } from '@/systems/combat/geometry';
import type { CombatWorld } from '@/entities/CombatWorld';

/**
 * Zones de danger au sol, toujours télégraphiées en magenta avant de blesser (claude.md, lisibilité) :
 * cercle (Chronométrage, Contrôle !), anneau qui s'étend (Reporting), bande (rame qui passe), ligne de KPI.
 */
export type HazardSpec =
  | {
      readonly kind: 'circle';
      readonly x: number;
      readonly y: number;
      readonly radius: number;
      readonly telegraphMs: number;
      readonly damage: number;
      readonly owner: string;
      /** Durée de la zone après l'impact (0 = un seul coup). */
      readonly lingerMs?: number;
      /** Ralentissement du héros dans la zone pendant `lingerMs`. */
      readonly slow?: number;
      readonly tickMs?: number;
      readonly tickDamage?: number;
      readonly onImpact?: () => void;
    }
  | {
      readonly kind: 'ring';
      readonly x: number;
      readonly y: number;
      readonly maxRadius: number;
      readonly thickness: number;
      readonly telegraphMs: number;
      readonly expandMs: number;
      readonly damage: number;
      readonly owner: string;
    }
  | {
      readonly kind: 'band';
      readonly y: number;
      readonly height: number;
      readonly x0: number;
      readonly x1: number;
      readonly telegraphMs: number;
      readonly damage: number;
      readonly owner: string;
      /** Rame : traverse la bande de gauche à droite après le télégraphe. */
      readonly speed: number;
      readonly onPass?: (x: number) => void;
    }
  | {
      readonly kind: 'line';
      readonly x0: number;
      readonly y0: number;
      readonly x1: number;
      readonly y1: number;
      readonly width: number;
      readonly telegraphMs: number;
      readonly lingerMs: number;
      readonly tickMs: number;
      readonly damage: number;
      readonly owner: string;
    };

export class Hazard {
  public done = false;
  private elapsed = 0;
  private struck = false;
  private tickAcc = 0;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private train: Phaser.GameObjects.Rectangle | null = null;
  private trainX = 0;

  public constructor(
    private readonly world: CombatWorld,
    public readonly spec: HazardSpec,
  ) {
    this.gfx = world.stage.add
      .graphics()
      .setDepth(spec.kind === 'band' ? Depth.Above - 1 : Depth.Decal);
  }

  /** Le héros est-il dans la zone (cercle des pieds) ? */
  private playerInside(): boolean {
    const p = this.world.player;
    const c = { x: p.x, y: p.y - 6, r: 6 };
    const s = this.spec;
    switch (s.kind) {
      case 'circle':
        return circlesOverlap({ x: s.x, y: s.y, r: s.radius }, c);
      case 'ring': {
        const t = Math.min(1, (this.elapsed - s.telegraphMs) / s.expandMs);
        const r = s.maxRadius * t;
        const d = Math.hypot(c.x - s.x, c.y - s.y);
        return Math.abs(d - r) <= s.thickness / 2 + c.r;
      }
      case 'band':
        return c.y >= s.y - c.r && c.y <= s.y + s.height + c.r;
      case 'line':
        return (
          distanceToSegment(c, { x: s.x0, y: s.y0 }, { x: s.x1, y: s.y1 }) <= s.width / 2 + c.r
        );
    }
  }

  public update(dtMs: number): void {
    if (this.done) return;
    this.elapsed += dtMs;
    const s = this.spec;
    const g = this.gfx;
    g.clear();
    const tele = Math.min(1, this.elapsed / s.telegraphMs);
    const blink = Math.floor(this.elapsed / 80) % 2 === 0 ? 0.55 : 0.35;

    if (s.kind === 'circle') {
      if (this.elapsed < s.telegraphMs) {
        g.lineStyle(1, Colors.danger, 0.9).strokeCircle(s.x, s.y, s.radius);
        g.fillStyle(Colors.danger, 0.25).fillCircle(s.x, s.y, s.radius * tele);
        return;
      }
      if (!this.struck) {
        this.struck = true;
        s.onImpact?.();
        if (s.damage > 0 && this.playerInside())
          this.world.damagePlayer(s.damage, { x: s.x, y: s.y, name: s.owner });
      }
      const linger = s.lingerMs ?? 0;
      const after = this.elapsed - s.telegraphMs;
      if (after < linger) {
        g.fillStyle(Colors.danger, 0.22).fillCircle(s.x, s.y, s.radius);
        g.lineStyle(1, Colors.danger, 0.7).strokeCircle(s.x, s.y, s.radius);
        if (this.playerInside()) {
          if (s.slow) this.world.player.applySlow(s.slow, 100);
          this.tickAcc += dtMs;
          if (s.tickMs && s.tickDamage && this.tickAcc >= s.tickMs) {
            this.tickAcc = 0;
            this.world.damagePlayer(s.tickDamage, { x: s.x, y: s.y, name: s.owner });
          }
        }
      } else if (after > 120) this.finish();
      else g.fillStyle(0xffffff, 0.5 * (1 - after / 120)).fillCircle(s.x, s.y, s.radius);
      return;
    }

    if (s.kind === 'ring') {
      if (this.elapsed < s.telegraphMs) {
        g.lineStyle(1, Colors.danger, blink).strokeCircle(s.x, s.y, s.maxRadius);
        return;
      }
      const t = Math.min(1, (this.elapsed - s.telegraphMs) / s.expandMs);
      g.lineStyle(s.thickness, Colors.danger, 0.75).strokeCircle(
        s.x,
        s.y,
        Math.max(1, s.maxRadius * t),
      );
      if (!this.struck && this.playerInside()) {
        this.struck = true;
        this.world.damagePlayer(s.damage, { x: s.x, y: s.y, name: s.owner, knockbackPx: 24 });
      }
      if (t >= 1) this.finish();
      return;
    }

    if (s.kind === 'band') {
      if (this.elapsed < s.telegraphMs) {
        g.fillStyle(Colors.danger, 0.1 + 0.15 * blink).fillRect(s.x0, s.y, s.x1 - s.x0, s.height);
        g.lineStyle(1, Colors.danger, 0.9).strokeRect(s.x0, s.y, s.x1 - s.x0, s.height);
        return;
      }
      if (!this.train) {
        this.trainX = s.x0 - 240;
        this.train = this.world.stage.add
          .rectangle(this.trainX, s.y + s.height / 2, 240, s.height - 4, 0xd8dde3)
          .setStrokeStyle(2, Colors.outline)
          .setOrigin(0, 0.5)
          .setDepth(Depth.Above);
        this.world.feel.shake(3, 400);
      }
      this.trainX += (s.speed * dtMs) / 1000;
      this.train.setX(this.trainX);
      const front = this.trainX + 240;
      const p = this.world.player;
      if (!this.struck && p.x >= this.trainX && p.x <= front && this.playerInside()) {
        this.struck = true;
        this.world.damagePlayer(s.damage, {
          x: p.x,
          y: s.y + s.height / 2,
          name: 'Une rame',
          knockbackPx: 48,
        });
      }
      s.onPass?.(front);
      if (this.trainX > s.x1 + 20) this.finish();
      return;
    }

    // Ligne de KPI : télégraphe, puis traînée qui pique.
    if (this.elapsed < s.telegraphMs) {
      g.lineStyle(1, Colors.danger, blink).lineBetween(s.x0, s.y0, s.x1, s.y1);
      return;
    }
    const after = this.elapsed - s.telegraphMs;
    g.lineStyle(s.width, Colors.danger, 0.45 * (1 - after / s.lingerMs) + 0.15).lineBetween(
      s.x0,
      s.y0,
      s.x1,
      s.y1,
    );
    this.tickAcc += dtMs;
    if (this.tickAcc >= s.tickMs && this.playerInside()) {
      this.tickAcc = 0;
      this.world.damagePlayer(s.damage, { x: s.x0, y: s.y0, name: s.owner });
    }
    if (after >= s.lingerMs) this.finish();
  }

  public finish(): void {
    if (this.done) return;
    this.done = true;
    this.gfx.destroy();
    this.train?.destroy();
  }
}
