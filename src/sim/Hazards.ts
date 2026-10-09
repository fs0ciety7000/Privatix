import { circlesOverlap, distanceToSegment } from '@/systems/combat/geometry';
import type { HitSource } from '@/sim/SimWorld';

/**
 * Zones de danger au sol (port pur de `entities/Hazard.ts`), toujours télégraphiées en magenta avant de
 * blesser (claude.md, lisibilité) : cercle (Chronométrage, Contrôle !, taches de la Piste de danse,
 * promesses, bulletins), dalle carrée (changement de roulement), anneau qui s'étend (Reporting, discours),
 * bande (rame, cloison mobile), ligne (KPI, motions, ciseaux, bullet points), faisceaux tournants
 * (lasers) et nuage de puanteur (vert : ne blesse pas, fait monter le Burnout). La vue lit `phase`,
 * `progress`, `x`/`y` (centre courant) et la géométrie.
 */

/** Habillage d'une zone pour la vue (la forme et les règles ne changent pas). */
export type HazardSkin =
  | 'default'
  | 'spot'
  | 'promise'
  | 'ballot'
  | 'stone'
  | 'slab'
  | 'emerge'
  | 'chart'
  | 'train'
  | 'cloison'
  | 'motion'
  | 'scissors'
  | 'bullet'
  | 'speech'
  | 'stomp';

/** Orbite d'un cercle pendant le début de son télégraphe (taches de la boule à facettes). */
export interface HazardOrbit {
  readonly cx: number;
  readonly cy: number;
  readonly radius: number;
  /** Angle de départ (rad) et vitesse (degrés par seconde). */
  readonly angle0: number;
  readonly degPerS: number;
  /** Durée de l'orbite (ms) : ensuite la tache se fige et se remplit. */
  readonly ms: number;
}

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
      readonly orbit?: HazardOrbit;
      /** Frappée par le héros pendant le télégraphe, la zone disparaît sans blesser (promesse tenue). */
      readonly poppable?: boolean;
      readonly onPop?: () => void;
      /** Pendant `lingerMs`, la zone est un trou : le héros qui s'y trouve tombe. */
      readonly voidFall?: boolean;
      readonly skin?: HazardSkin;
    }
  | {
      readonly kind: 'square';
      readonly x: number;
      readonly y: number;
      /** Demi-côté (u). */
      readonly half: number;
      readonly telegraphMs: number;
      readonly damage: number;
      readonly owner: string;
      readonly lingerMs: number;
      readonly voidFall?: boolean;
      readonly skin?: HazardSkin;
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
      /** Brèche (« pause pour applaudissements ») : ouverture en degrés, angle de départ, rotation. */
      readonly gapDeg?: number;
      readonly gapAngle?: number;
      readonly gapTurnDegPerS?: number;
      readonly skin?: HazardSkin;
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
      /** Rame (ou cloison) : traverse la bande de gauche à droite après le télégraphe. */
      readonly speed: number;
      readonly onPass?: (front: number) => void;
      readonly skin?: HazardSkin;
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
      /** Un seul coup à la fin du télégraphe (motions, ciseaux, bullet points). */
      readonly once?: boolean;
      /** Trou dans la ligne (bullet points) : de `gapFrom` à `gapTo` (fractions 0..1). */
      readonly gapFrom?: number;
      readonly gapTo?: number;
      readonly skin?: HazardSkin;
    }
  | {
      readonly kind: 'beams';
      readonly x: number;
      readonly y: number;
      readonly count: number;
      readonly length: number;
      readonly width: number;
      readonly angle0: number;
      readonly degPerS: number;
      readonly telegraphMs: number;
      readonly durationMs: number;
      readonly damage: number;
      readonly tickMs: number;
      readonly owner: string;
    }
  | {
      readonly kind: 'cloud';
      readonly x: number;
      readonly y: number;
      readonly radius: number;
      /** Le nuage gonfle (aucun effet avant la fin). */
      readonly telegraphMs: number;
      readonly lifeMs: number;
      readonly driftAngle: number;
      readonly drift: number;
      readonly burnoutPerS: number;
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
  /** Burnout ajouté par une zone (bloque aussi la récupération passive). */
  addBurnout(points: number): void;
  /** Le héros tombe dans un trou (dalle ouverte). */
  fallHero(): void;
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
  /** Centre courant (orbite, dérive). */
  public x: number;
  public y: number;
  /** Rotation courante des faisceaux, brèche courante d'un anneau (rad). */
  public angle = 0;
  /** Promesse tenue : frappée avant d'éclater. */
  public popped = false;
  private struck = false;
  private tickAcc = 0;
  private frozenMs = 0;
  /** Bord gauche de la rame (bande), en u. */
  public trainX = 0;
  private trainLaunched = false;

  public constructor(public readonly spec: HazardSpec) {
    const s = spec;
    switch (s.kind) {
      case 'band':
        this.x = s.x0;
        this.y = s.y;
        break;
      case 'line':
        this.x = s.x0;
        this.y = s.y0;
        break;
      default:
        this.x = s.x;
        this.y = s.y;
    }
    if (s.kind === 'beams') this.angle = s.angle0;
    if (s.kind === 'ring') this.angle = s.gapAngle ?? 0;
    if (s.kind === 'circle' && s.orbit) this.place(0);
  }

  /** Télégraphe en cours (rien ne blesse encore). */
  public get telegraphing(): boolean {
    return this.elapsed < this.spec.telegraphMs;
  }

  /** Progression du télégraphe (0..1) ; une tache en orbite ne se remplit qu'une fois figée. */
  public get progress(): number {
    const s = this.spec;
    if (s.telegraphMs <= 0) return 1;
    const from = s.kind === 'circle' && s.orbit ? s.orbit.ms : 0;
    return Math.max(0, Math.min(1, (this.elapsed - from) / Math.max(1, s.telegraphMs - from)));
  }

  /** Temps écoulé depuis la fin du télégraphe (ms). */
  public get after(): number {
    return Math.max(0, this.elapsed - this.spec.telegraphMs);
  }

  /** Figée (Sifflet sur la Piste de danse). */
  public get frozen(): boolean {
    return this.frozenMs > 0;
  }

  /** Rayon courant d'un anneau (u). */
  public get ringRadius(): number {
    const s = this.spec;
    if (s.kind !== 'ring') return 0;
    return s.maxRadius * Math.min(1, this.after / Math.max(1, s.expandMs));
  }

  /** Rayon courant d'un nuage (u) : il gonfle pendant son télégraphe. */
  public get cloudRadius(): number {
    const s = this.spec;
    if (s.kind !== 'cloud') return 0;
    return s.radius * (0.35 + 0.65 * Math.min(1, this.elapsed / Math.max(1, s.telegraphMs)));
  }

  public get trainActive(): boolean {
    return this.trainLaunched && !this.done;
  }

  /** Fige la zone (le temps ne s'écoule plus pour elle) pendant `ms`. */
  public freeze(ms: number): void {
    this.frozenMs = Math.max(this.frozenMs, ms);
  }

  /** Le point (pieds) est-il dans la zone, à la géométrie courante ? */
  public contains(px: number, py: number, pr = 6): boolean {
    const c = { x: px, y: py - 6, r: pr };
    const s = this.spec;
    switch (s.kind) {
      case 'circle':
        return circlesOverlap({ x: this.x, y: this.y, r: s.radius }, c);
      case 'square':
        return Math.abs(c.x - s.x) <= s.half + c.r && Math.abs(c.y - s.y) <= s.half + c.r;
      case 'ring': {
        const d = Math.hypot(c.x - s.x, c.y - s.y);
        if (Math.abs(d - this.ringRadius) > s.thickness / 2 + c.r) return false;
        if (!s.gapDeg) return true;
        const a = Math.atan2(c.y - s.y, c.x - s.x);
        return Math.abs(wrapAngle(a - this.angle)) > (s.gapDeg * Math.PI) / 360;
      }
      case 'band':
        return c.y >= s.y - c.r && c.y <= s.y + s.height + c.r;
      case 'line': {
        const len = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
        if (distanceToSegment(c, { x: s.x0, y: s.y0 }, { x: s.x1, y: s.y1 }) > s.width / 2 + c.r)
          return false;
        if (s.gapFrom === undefined || s.gapTo === undefined || len <= 0) return true;
        const t = ((c.x - s.x0) * (s.x1 - s.x0) + (c.y - s.y0) * (s.y1 - s.y0)) / (len * len);
        return t < s.gapFrom || t > s.gapTo;
      }
      case 'beams': {
        for (let i = 0; i < s.count; i += 1) {
          const a = this.angle + (i * Math.PI * 2) / s.count;
          const end = { x: this.x + Math.cos(a) * s.length, y: this.y + Math.sin(a) * s.length };
          if (distanceToSegment(c, { x: this.x, y: this.y }, end) <= s.width / 2 + c.r) return true;
        }
        return false;
      }
      case 'cloud':
        return Math.hypot(c.x - this.x, c.y - this.y) <= this.cloudRadius;
    }
  }

  private heroInside(host: HazardHost): boolean {
    return this.contains(host.heroFeet.x, host.heroFeet.y);
  }

  /** Position sur l'orbite (cercle) au temps `t` (ms). */
  private place(t: number): void {
    const s = this.spec;
    if (s.kind !== 'circle' || !s.orbit) return;
    const o = s.orbit;
    const a = o.angle0 + (((o.degPerS * Math.min(t, o.ms)) / 1000) * Math.PI) / 180;
    this.x = o.cx + Math.cos(a) * o.radius;
    this.y = o.cy + Math.sin(a) * o.radius;
  }

  /** Frappe du héros sur une zone qui se crève (promesse) : vraie si elle disparaît. */
  public pop(): boolean {
    const s = this.spec;
    if (this.done || s.kind !== 'circle' || !s.poppable || !this.telegraphing) return false;
    this.popped = true;
    this.done = true;
    s.onPop?.();
    return true;
  }

  public update(dtMs: number, host: HazardHost): void {
    if (this.done) return;
    if (this.frozenMs > 0) {
      this.frozenMs = Math.max(0, this.frozenMs - dtMs);
      return;
    }
    this.elapsed += dtMs;
    const s = this.spec;
    if (s.kind === 'circle' && s.orbit) this.place(this.elapsed);
    if (s.kind === 'ring' && s.gapTurnDegPerS)
      this.angle += (((s.gapTurnDegPerS * dtMs) / 1000) * Math.PI) / 180;
    if (s.kind === 'cloud') {
      this.x += (Math.cos(s.driftAngle) * s.drift * dtMs) / 1000;
      this.y += (Math.sin(s.driftAngle) * s.drift * dtMs) / 1000;
    }
    if (this.elapsed < s.telegraphMs) return;

    switch (s.kind) {
      case 'circle': {
        if (!this.struck) {
          this.struck = true;
          s.onImpact?.();
          host.emit({
            type: 'hazardImpact',
            kind: 'circle',
            x: this.x,
            y: this.y,
            radius: s.radius,
          });
          if (s.damage > 0 && this.heroInside(host))
            host.damageHero(s.damage, { x: this.x, y: this.y, name: s.owner });
        }
        const linger = s.lingerMs ?? 0;
        if (this.after < linger) {
          if (this.heroInside(host)) {
            if (s.voidFall) host.fallHero();
            if (s.slow) host.slowHero(s.slow, 100);
            this.tickAcc += dtMs;
            if (s.tickMs && s.tickDamage && this.tickAcc >= s.tickMs) {
              this.tickAcc = 0;
              host.damageHero(s.tickDamage, { x: this.x, y: this.y, name: s.owner });
            }
          }
        } else if (this.after > linger + CIRCLE_FADE_MS) this.finish();
        return;
      }
      case 'square': {
        if (!this.struck) {
          this.struck = true;
          host.emit({ type: 'hazardImpact', kind: 'square', x: s.x, y: s.y, radius: s.half });
          if (s.damage > 0 && this.heroInside(host))
            host.damageHero(s.damage, { x: s.x, y: s.y, name: s.owner });
        }
        if (this.after < s.lingerMs) {
          if (s.voidFall && this.heroInside(host)) host.fallHero();
        } else if (this.after > s.lingerMs + CIRCLE_FADE_MS) this.finish();
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
            name: s.owner,
            knockbackPx: 48,
          });
        }
        s.onPass?.(front);
        if (this.trainX > s.x1 + 20) this.finish();
        return;
      }
      case 'line': {
        if (s.once) {
          if (!this.struck) {
            this.struck = true;
            host.emit({
              type: 'hazardImpact',
              kind: 'line',
              x: (s.x0 + s.x1) / 2,
              y: (s.y0 + s.y1) / 2,
              radius: s.width,
            });
            if (this.heroInside(host))
              host.damageHero(s.damage, { x: s.x0, y: s.y0, name: s.owner });
          }
          if (this.after >= s.lingerMs) this.finish();
          return;
        }
        this.tickAcc += dtMs;
        if (this.tickAcc >= s.tickMs && this.heroInside(host)) {
          this.tickAcc = 0;
          host.damageHero(s.damage, { x: s.x0, y: s.y0, name: s.owner });
        }
        if (this.after >= s.lingerMs) this.finish();
        return;
      }
      case 'beams': {
        this.angle += (((s.degPerS * dtMs) / 1000) * Math.PI) / 180;
        this.tickAcc += dtMs;
        if (this.tickAcc >= s.tickMs && this.heroInside(host)) {
          this.tickAcc = 0;
          host.damageHero(s.damage, { x: this.x, y: this.y, name: s.owner });
        }
        if (this.after >= s.durationMs) this.finish();
        return;
      }
      case 'cloud': {
        if (this.heroInside(host)) host.addBurnout((s.burnoutPerS * dtMs) / 1000);
        if (this.after >= s.lifeMs) this.finish();
        return;
      }
    }
  }

  public finish(): void {
    this.done = true;
  }
}

function wrapAngle(a: number): number {
  let x = a;
  while (x > Math.PI) x -= Math.PI * 2;
  while (x < -Math.PI) x += Math.PI * 2;
  return x;
}
