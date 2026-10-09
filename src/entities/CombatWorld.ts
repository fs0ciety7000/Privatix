import type Phaser from 'phaser';
import type { EnemyKind } from '@/config/balance';
import type { GameFeel } from '@/fx/GameFeel';
import type { AttackTokens } from '@/systems/combat/AttackTokens';
import type { RunState } from '@/systems/meta/RunState';
import type { Rng } from '@/utils/rng';
import type { Enemy } from '@/entities/Enemy';
import type { Hazard, HazardSpec } from '@/entities/Hazard';
import type { Player } from '@/entities/Player';
import type { Projectile, ProjectileSpec } from '@/entities/Projectile';
import type { Room } from '@/entities/Room';

/** Source d'un coup porté au héros. */
export interface HitSource {
  readonly x: number;
  readonly y: number;
  /** Nom affiché sur l'écran des départs en cas de mort. */
  readonly name: string;
  readonly knockbackPx?: number;
}

/**
 * Contrat entre les entités et la scène qui les héberge (RunScene, HubScene).
 * Les entités ne connaissent jamais la scène concrète : elles passent par cette interface.
 */
export interface CombatWorld {
  readonly stage: Phaser.Scene;
  readonly feel: GameFeel;
  readonly rng: Rng;
  readonly run: RunState;
  readonly player: Player;
  readonly tokens: AttackTokens;
  readonly room: Room;
  /** Temps de jeu écoulé (ms), figé pendant le hitstop. */
  now(): number;
  /** Ennemis vivants (hors apparition). */
  livingEnemies(): readonly Enemy[];
  /** Projectiles ennemis actifs. */
  activeProjectiles(): readonly Projectile[];
  /** Inflige des dégâts au héros (gère i-frames, dash parfait, bouclier). Renvoie vrai si le coup a porté. */
  damagePlayer(amount: number, source: HitSource): boolean;
  /** Un ennemi a été touché par le héros (Mobilisation, nombres). */
  onEnemyDamaged(enemy: Enemy, amount: number, crit: boolean): void;
  onEnemyKilled(enemy: Enemy): void;
  spawnEnemy(kind: EnemyKind, x: number, y: number, immediate?: boolean): Enemy | null;
  spawnProjectile(spec: ProjectileSpec): void;
  spawnHazard(spec: HazardSpec): Hazard;
  /** Joue un effet animé (clé d'animation) à une position. */
  vfx(
    animKey: string,
    x: number,
    y: number,
    opts?: { rotation?: number; flipX?: boolean; flipY?: boolean; scale?: number; depth?: number },
  ): void;
}
