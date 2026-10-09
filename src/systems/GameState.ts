import { Shift } from '@/config/constants';

/**
 * État global du jeu, stocké dans le registry Phaser et sérialisé dans localStorage.
 * Logique pure : aucune dépendance à Phaser, donc testable avec Vitest.
 */
export interface PlayerState {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  /** 0 (frais) à 100 (épuisé). */
  fatigue: number;
}

export interface GameState {
  /** Version du schéma de sauvegarde, à incrémenter à chaque changement incompatible. */
  version: 1;
  /** Minutes écoulées depuis 00:00 du jour en cours (0-1439). */
  clockMinutes: number;
  player: PlayerState;
}

export const MINUTES_PER_DAY = 24 * 60;

export function createInitialGameState(): GameState {
  return {
    version: 1,
    clockMinutes: 6 * 60, // Prise de service : pause du matin.
    player: {
      name: 'Léon',
      level: 1,
      hp: 30,
      maxHp: 30,
      energy: 10,
      maxEnergy: 10,
      fatigue: 0,
    },
  };
}

/** Retourne la pause 3x8 correspondant à l'heure donnée. */
export function shiftAt(clockMinutes: number): Shift {
  const hour = Math.floor(((clockMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY / 60);
  if (hour >= 6 && hour < 14) return Shift.Morning;
  if (hour >= 14 && hour < 22) return Shift.Afternoon;
  return Shift.Night;
}

export function shiftLabel(clockMinutes: number): string {
  switch (shiftAt(clockMinutes)) {
    case Shift.Morning:
      return 'Matin (M)';
    case Shift.Afternoon:
      return 'Après-midi (S)';
    case Shift.Night:
      return 'Nuit (N)';
  }
}

/** Formate l'horloge en "HH:MM". */
export function formatClock(clockMinutes: number): string {
  const m = ((clockMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hh = String(Math.floor(m / 60)).padStart(2, '0');
  const mm = String(m % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}
