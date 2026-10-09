import { circlesOverlap, distanceToSegment } from '@/systems/combat/geometry';
import type { HitSource } from '@/sim/SimWorld';

/**
 * Zones de danger au sol (port pur de `entities/Hazard.ts`), toujours télégraphiées en magenta avant de
 * blesser (claude.md, lisibilité) : cercle (Chronométrage, Contrôle !), anneau qui s'étend (Reporting),
 * bande (rame qui passe), ligne de KPI. La vue lit `phase`, `progress` et la géométrie.
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
      readonly onPass?: (front: number) => void;
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

/** Longueur de la rame (u). */
export const TRAIN_LENGTH = 240;
/** Fondu blanc après l'impact d'un cercle sans persistance (ms). */
const CIRCLE_FADE_MS = 120;

/** Ce dont une zone a besoin du monde (héros, dégâts, effets). */
export interface HazardHost {
  readonly heroFeet: { readonly x: number; readonly y: number };
  damageHero(amount: number, source: HitSource): boolean;
  slowHero(factor: number, ms: number): void;
  emit(e: {
    readonly type: 'hazardImpact';
    readonly kind: HazardSpec['kind'];
    readonly x: number;
    readonly y: number;
    readonly radius: number;
  }): void;
  shake(px: number, ms: number): void;
}

let nextHazardId = 1;

export class HazardSim {
  public readonly id = nextHazardId++;
  public done = false;
  public elapsed = 0;
  private struck = false;
  private tickAcc = 0;
  /** Bord gauche de la rame (bande), en u. */
  public trainX = 0;
  private trainLaunched = false;

  public constructor(public readonly spec: HazardSpec) {}

  /** Télégraphe en cours (rien ne blesse encore). */
  public get telegraphing(): boolean {
    return this.elapsed < this.spec.telegraphMs;
  }

  /** Progression du télégraphe (0..1). */
  public get progress(): number {
    return this.spec.telegraphMs <= 0 ? 1 : Math.min(1, this.elapsed / this.spec.telegraphMs);
  }

  /** Temps écoulé depuis la fin du télégraphe (ms). */
  public get after(): number {
    return Math.max(0, this.elapsed - this.spec.telegraphMs);
  }

  /** Rayon courant d'un anneau (u). */
  public get ringRadius(): number {
    const s = this.spec;
    if (s.kind !== 'ring') return 0;
    return s.maxRadius * Math.min(1, this.after / Math.max(1, s.expandMs));
  }

  public get trainActive(): boolean {
    return this.trainLaunched && !this.done;
  }

  /** Le héros (cercle des pieds) est-il dans la zone ? */
  private heroInside(host: HazardHost): boolean {
    const p = host.heroFeet;
    const c = { x: p.x, y: p.y - 6, r: 6 };
    const s = this.spec;
    switch (s.kind) {
      case 'circle':
        return circlesOverlap({ x: s.x, y: s.y, r: s.radius }, c);
      case 'ring': {
        const d = Math.hypot(c.x - s.x, c.y - s.y);
        return Math.abs(d - this.ringRadius) <= s.thickness / 2 + c.r;
      }
      case 'band':
        return c.y >= s.y - c.r && c.y <= s.y + s.height + c.r;
      case 'line':
        return (
          distanceToSegment(c, { x: s.x0, y: s.y0 }, { x: s.x1, y: s.y1 }) <= s.width / 2 + c.r
        );
    }
  }

  public update(dtMs: number, host: HazardHost): void {
    if (this.done) return;
    this.elapsed += dtMs;
    const s = this.spec;
    if (this.elapsed < s.telegraphMs) return;

    switch (s.kind) {
      case 'circle': {
        if (!this.struck) {
          this.struck = true;
          s.onImpact?.();
          host.emit({ type: 'hazardImpact', kind: 'circle', x: s.x, y: s.y, radius: s.radius });
          if (s.damage > 0 && this.heroInside(host))
            host.damageHero(s.damage, { x: s.x, y: s.y, name: s.owner });
        }
        const linger = s.lingerMs ?? 0;
        if (this.after < linger) {
          if (this.heroInside(host)) {
            if (s.slow) host.slowHero(s.slow, 100);
            this.tickAcc += dtMs;
            if (s.tickMs && s.tickDamage && this.tickAcc >= s.tickMs) {
              this.tickAcc = 0;
              host.damageHero(s.tickDamage, { x: s.x, y: s.y, name: s.owner });
            }
          }
        } else if (this.after > linger + CIRCLE_FADE_MS) this.finish();
        return;
      }
      case 'ring': {
        if (!this.struck && this.heroInside(host)) {
          this.struck = true;
          host.damageHero(s.damage, { x: s.x, y: s.y, name: s.owner, knockbackPx: 24 });
        }
        if (this.after >= s.expandMs) this.finish();
        return;
      }
      case 'band': {
        if (!this.trainLaunched) {
          this.trainLaunched = true;
          this.trainX = s.x0 - TRAIN_LENGTH;
          host.shake(3, 400);
          host.emit({ type: 'hazardImpact', kind: 'band', x: s.x0, y: s.y, radius: s.height });
        }
        this.trainX += (s.speed * dtMs) / 1000;
        const front = this.trainX + TRAIN_LENGTH;
        const p = host.heroFeet;
        if (!this.struck && p.x >= this.trainX && p.x <= front && this.heroInside(host)) {
          this.struck = true;
          host.damageHero(s.damage, {
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
      case 'line': {
        this.tickAcc += dtMs;
        if (this.tickAcc >= s.tickMs && this.heroInside(host)) {
          this.tickAcc = 0;
          host.damageHero(s.damage, { x: s.x0, y: s.y0, name: s.owner });
        }
        if (this.after >= s.lingerMs) this.finish();
        return;
      }
    }
  }

  public finish(): void {
    this.done = true;
  }
}
