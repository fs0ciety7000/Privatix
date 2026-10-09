import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '@/systems/GameState';
import type { KeyValueStorage } from '@/systems/save/SaveManager';
import { SaveManager } from '@/systems/save/SaveManager';

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
  };
}

const throwing: KeyValueStorage = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => undefined,
};

describe('SaveManager', () => {
  const fixedNow = (): Date => new Date('2026-10-09T08:00:00Z');

  it('fait un aller-retour complet du GameState', () => {
    const storage = memoryStorage();
    const saves = new SaveManager(storage, 'test', fixedNow);
    const state = { ...createInitialGameState('Léa'), moral: 42, flags: { 'intro-vue': true } };
    expect(saves.save('slot-1', state)).toBe(true);
    const loaded = saves.load('slot-1');
    expect(loaded).toEqual({ ok: true, data: { savedAt: '2026-10-09T08:00:00.000Z', state } });
    expect(storage.data.has('test.slot-1')).toBe(true);
  });

  it('signale un emplacement vide, un JSON cassé, un état invalide et une version future', () => {
    const storage = memoryStorage();
    const saves = new SaveManager(storage, 'p');
    expect(saves.load('slot-1')).toEqual({ ok: false, reason: 'empty' });

    storage.setItem('p.slot-1', '{oups');
    expect(saves.load('slot-1')).toEqual({ ok: false, reason: 'corrupted' });

    storage.setItem(
      'p.slot-1',
      JSON.stringify({ savedAt: 'x', state: { version: 1, moral: 'beaucoup' } }),
    );
    expect(saves.load('slot-1')).toEqual({ ok: false, reason: 'corrupted' });

    storage.setItem(
      'p.slot-1',
      JSON.stringify({ savedAt: 'x', state: { ...createInitialGameState(), version: 99 } }),
    );
    expect(saves.load('slot-1')).toEqual({ ok: false, reason: 'too-new' });

    storage.setItem(
      'p.slot-1',
      JSON.stringify({ savedAt: 'x', state: { ...createInitialGameState(), version: 0 } }),
    );
    expect(saves.load('slot-1')).toEqual({ ok: false, reason: 'corrupted' });
  });

  it('ne lève jamais quand le stockage est absent ou bloqué', () => {
    expect(new SaveManager(null).save('auto', createInitialGameState())).toBe(false);
    expect(new SaveManager(null).load('auto')).toEqual({
      ok: false,
      reason: 'storage-unavailable',
    });
    expect(new SaveManager(throwing).save('auto', createInitialGameState())).toBe(false);
    expect(new SaveManager(throwing).load('auto')).toEqual({
      ok: false,
      reason: 'storage-unavailable',
    });
    expect(new SaveManager(throwing).latest()).toBeNull();
  });

  it('trouve la sauvegarde la plus récente', () => {
    const storage = memoryStorage();
    new SaveManager(storage, 'p', () => new Date('2026-10-09T08:00:00Z')).save(
      'slot-1',
      createInitialGameState('Léon'),
    );
    new SaveManager(storage, 'p', () => new Date('2026-10-09T09:00:00Z')).save(
      'auto',
      createInitialGameState('Léa'),
    );
    const saves = new SaveManager(storage, 'p');
    expect(saves.latest()?.state.player.name).toBe('Léa');
    expect(saves.has('slot-1')).toBe(true);
  });
});
