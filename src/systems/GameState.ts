import { BALANCE } from '@/config/balance';
import { createFatigueClock } from '@/systems/time/FatigueClock';
import type { FatigueClockState } from '@/systems/time/FatigueClock';

/**
 * État global du jeu, stocké dans le registry Phaser et sérialisé dans localStorage.
 * Logique pure : aucune dépendance à Phaser, donc testable avec Vitest.
 * Toujours remplacer l'objet (jamais le muter) pour que le registry émette `changedata`.
 */
export interface PlayerState {
  readonly name: string;
  readonly level: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly energy: number;
  readonly maxEnergy: number;
}

export interface GameState {
  /** Version du schéma de sauvegarde, à incrémenter à chaque changement incompatible. */
  readonly version: 1;
  /** Horloge 3x8 et Fatigue d'équipe (partagée par tous les personnages). */
  readonly time: FatigueClockState;
  readonly player: PlayerState;
}

export function createInitialGameState(): GameState {
  return {
    version: 1,
    time: createFatigueClock(1),
    player: {
      name: 'Léon',
      level: 1,
      hp: BALANCE.progression.HERO.hp[0],
      maxHp: BALANCE.progression.HERO.hp[0],
      energy: BALANCE.progression.HERO.pe[0],
      maxEnergy: BALANCE.progression.HERO.pe[0],
    },
  };
}

/** Garde de type minimale pour lire le registry sans cast aveugle. */
export function isGameState(value: unknown): value is GameState {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<GameState>;
  return (
    candidate.version === 1 &&
    typeof candidate.time?.totalMinutes === 'number' &&
    typeof candidate.player?.hp === 'number'
  );
}
