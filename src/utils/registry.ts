import { RegistryKeys } from '@/config/constants';
import { isGameState } from '@/systems/GameState';
import type { GameState } from '@/systems/GameState';

/** Sous-ensemble du DataManager Phaser utilisé ici (le registry s'y conforme ; permet de tester sans Phaser). */
export interface DataStore {
  get(key: string): unknown;
  set(key: string, value: unknown): unknown;
}

/** Lit le GameState du registry. Lève une erreur si Boot n'a pas été exécuté. */
export function getGameState(registry: DataStore): GameState {
  const value = registry.get(RegistryKeys.GameState);
  if (!isGameState(value)) {
    throw new Error('GameState absent du registry (BootScene non exécutée ?)');
  }
  return value;
}

/** Remplace le GameState par le résultat de `update` (immutabilité : déclenche `changedata`). */
export function updateGameState(
  registry: DataStore,
  update: (state: GameState) => GameState,
): GameState {
  const next = update(getGameState(registry));
  registry.set(RegistryKeys.GameState, next);
  return next;
}
