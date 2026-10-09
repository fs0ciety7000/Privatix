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

/** Bandeau d'information (« Victoire contre … », nom de zone, objectif). `seq` distingue deux textes identiques. */
export interface Notice {
  readonly seq: number;
  readonly text: string;
}

export function isNotice(value: unknown): value is Notice {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Partial<Notice>).seq === 'number' &&
    typeof (value as Partial<Notice>).text === 'string'
  );
}

/** Publie un bandeau ; l'UIScene l'affiche quand le registry émet `changedata`. */
export function pushNotice(registry: DataStore, text: string): void {
  const previous = registry.get(RegistryKeys.Notice);
  registry.set(RegistryKeys.Notice, { seq: isNotice(previous) ? previous.seq + 1 : 1, text });
}
