import type { EnemyKind } from '@/config/balance';
import type { AttackTokens } from '@/systems/combat/AttackTokens';
import type { RunState } from '@/systems/meta/RunState';
import type { Rng } from '@/utils/rng';
import type { Arena } from '@/sim/Arena';
import type { TimeControl } from '@/sim/clock/TimeControl';
import type { EnemySim } from '@/sim/enemies/EnemySim';
import type { SimEvent } from '@/sim/events';
import type { HazardSim, HazardSpec } from '@/sim/Hazards';
import type { HeroSim } from '@/sim/hero/HeroSim';
import type { LootSim } from '@/sim/loot/LootSim';
import type { ProjectileSim, ProjectileSpec } from '@/sim/Projectiles';

/** Corps d'un acteur : cercle aux pieds, vitesse, état précédent (interpolation), contact du pas. */
export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  readonly r: number;
  prevX: number;
  prevY: number;
  /** Le dernier déplacement a été bloqué par le décor (ruée, plaquage contre un mur). */
  blocked: boolean;
  /** Corps actif (collisions, déplacement). Inactif pendant l'apparition et après la mort. */
  enabled: boolean;
}

export function makeBody(x: number, y: number, r: number): Body {
  return { x, y, vx: 0, vy: 0, r, prevX: x, prevY: y, blocked: false, enabled: true };
}

/** Source d'un coup porté au héros. */
export interface HitSource {
  readonly x: number;
  readonly y: number;
  /** Nom affiché sur l'écran des départs en cas de mort. */
  readonly name: string;
  readonly knockbackPx?: number;
}

/**
 * Contrat entre les acteurs de la simulation et le monde qui les héberge (équivalent pur de
 * `entities/CombatWorld.ts`). Le temps est celui de la simulation, figé pendant le hitstop.
 */
export interface SimWorld {
  readonly rng: Rng;
  readonly run: RunState;
  readonly hero: HeroSim;
  readonly tokens: AttackTokens;
  readonly arena: Arena;
  readonly time: TimeControl;
  /** Équipement porté (modificateurs du héros, pouvoirs Patrimoine). */
  readonly loot: LootSim;
  now(): number;
  livingEnemies(): readonly EnemySim[];
  damageHero(amount: number, source: HitSource): boolean;
  onEnemyDamaged(enemy: EnemySim, amount: number, crit: boolean): void;
  onEnemyKilled(enemy: EnemySim): void;
  spawnEnemy(kind: EnemyKind, x: number, y: number, immediate?: boolean): EnemySim | null;
  spawnProjectile(spec: ProjectileSpec): void;
  spawnHazard(spec: HazardSpec): HazardSim;
  /** Projectiles ennemis actifs (cassés par le coup 3 et le sifflet). */
  activeProjectiles(): readonly ProjectileSim[];
  /** Un projectile est cassé par une arme du héros. */
  breakProjectile(p: ProjectileSim): void;
  emit(event: SimEvent): void;
}

/** Bande de voie (rails + ballast) d'une salle, où passent les rames du boss (u). */
export interface RailBand {
  readonly x0: number;
  readonly x1: number;
  readonly y: number;
  readonly height: number;
}
