import { describe, expect, it } from 'vitest';
import { RegistryKeys } from '@/config/constants';
import { createInitialGameState } from '@/systems/GameState';
import { getGameState, updateGameState } from '@/utils/registry';
import type { DataStore } from '@/utils/registry';

function memoryStore(initial: Record<string, unknown> = {}): DataStore & { writes: number } {
  const data = new Map<string, unknown>(Object.entries(initial));
  return {
    writes: 0,
    get: (key) => data.get(key),
    set(key, value) {
      this.writes += 1;
      data.set(key, value);
      return this;
    },
  };
}

describe('registry typé', () => {
  it('refuse de lire un GameState absent', () => {
    expect(() => getGameState(memoryStore())).toThrow();
  });

  it('remplace le GameState par un nouvel objet', () => {
    const initial = createInitialGameState();
    const store = memoryStore({ [RegistryKeys.GameState]: initial });
    const next = updateGameState(store, (s) => ({ ...s, time: { ...s.time, fatigue: 42 } }));
    expect(next).not.toBe(initial);
    expect(getGameState(store).time.fatigue).toBe(42);
    expect(initial.time.fatigue).toBe(20);
    expect(store.writes).toBe(1);
  });
});
