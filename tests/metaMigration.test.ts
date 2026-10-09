import { describe, expect, it } from 'vitest';
import type { ItemInstance } from '@/systems/loot';
import {
  ackScrappedNotice,
  deserializeItem,
  dropsForSource,
  isItemInstance,
  newLootRun,
  sanitizeItem,
  sanitizeLoot,
  serializeItem,
} from '@/systems/loot';
import type { MetaState } from '@/systems/meta/MetaState';
import {
  isMetaState,
  META_SAVE_SCHEMA,
  migrateMetaV1toV2,
  newMeta,
} from '@/systems/meta/MetaState';
import { applyResult, createRun } from '@/systems/meta/RunState';
import type { KeyValueStorage } from '@/systems/save/SaveManager';
import { SaveManager } from '@/systems/save/SaveManager';
import { LEGENDARIES } from '@/config/loot';

class MemoryStorage implements KeyValueStorage {
  private readonly data = new Map<string, string>();
  public getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }
  public setItem(k: string, v: string): void {
    this.data.set(k, v);
  }
  public removeItem(k: string): void {
    this.data.delete(k);
  }
}

/** Sauvegarde v1 telle qu'écrite par la version en production (SaveManager + MetaState v1). */
const REAL_V1_SAVE = JSON.stringify({
  savedAt: '2026-09-30T21:14:03.512Z',
  state: {
    version: 1,
    ps: 137,
    grains: 12,
    upgrades: { anciennete: 2, 'cle-chromee': 1, thermos: 1, tableau: 1 },
    stats: { shifts: 7, deaths: 6, bossKills: 1, bestRoom: 10, totalKills: 312 },
  },
});

function load(raw: string): ReturnType<SaveManager<MetaState>['load']> {
  const storage = new MemoryStorage();
  storage.setItem('privatix.meta', raw);
  return new SaveManager<MetaState>(storage, META_SAVE_SCHEMA).load();
}

function sampleItems(): ItemInstance[] {
  const res = dropsForSource(
    'boss',
    {
      seed: 99,
      room: 10,
      shift: 'nuit',
      unlockedTools: ['cle-tire-fond'],
      codex: LEGENDARIES.map((l) => l.id),
    },
    { run: newLootRun(1), pity: { patrimoine: 0, welcomeDone: false, frozen: false } },
    { bossNumber: 2, firstKill: true },
  );
  return [...res.items];
}

describe('14. MetaState v2 : migration et sérialisation', () => {
  it('une sauvegarde v1 réelle se charge et garde PS, Grains, rangs et statistiques', () => {
    const loaded = load(REAL_V1_SAVE);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const meta = loaded.data.state;
    expect(meta.version).toBe(2);
    expect(meta.ps).toBe(137);
    expect(meta.grains).toBe(12);
    expect(meta.upgrades).toEqual({ anciennete: 2, 'cle-chromee': 1, thermos: 1, tableau: 1 });
    expect(meta.stats.totalKills).toBe(312);
    expect(meta.loot.vestiaire).toEqual([]);
    // Rattrapage : Boss 1 déjà battu → Masse débloquée et 3 Pièces.
    expect(meta.pieces).toBe(3);
    expect(meta.loot.unlockedTools).toEqual(['cle-tire-fond', 'masse-voie']);
    // La méta migrée fonctionne avec le reste du jeu.
    expect(createRun(meta, 'matin', 1).energy).toBe(120);
    expect(isMetaState(applyResult(meta, createRunResult()))).toBe(true);
  });

  it('migration v1 sans boss : Pièces à 0, seule la Clé est débloquée', () => {
    const v2 = migrateMetaV1toV2({
      version: 1,
      ps: 3,
      grains: 0,
      upgrades: {},
      stats: { shifts: 1, deaths: 1, bossKills: 0, bestRoom: 3, totalKills: 9 },
    });
    expect(v2.pieces).toBe(0);
    expect(isMetaState(META_SAVE_SCHEMA.sanitize?.(v2) ?? v2)).toBe(true);
  });

  it('aller-retour JSON identique (objets et méta)', () => {
    const items = sampleItems();
    for (const item of items) {
      expect(isItemInstance(item)).toBe(true);
      expect(deserializeItem(serializeItem(item))).toEqual(item);
    }
    const meta: MetaState = {
      ...newMeta(),
      loot: { ...newMeta().loot, vestiaire: items, nextUid: 9 },
    };
    const storage = new MemoryStorage();
    const saves = new SaveManager<MetaState>(storage, META_SAVE_SCHEMA, 'k');
    expect(saves.save(meta)).toBe(true);
    const loaded = saves.load();
    expect(loaded.ok && loaded.data.state).toEqual(meta);
  });

  it('un objet inconnu devient de la Ferraille sans rejeter la sauvegarde', () => {
    const [good, other] = sampleItems();
    if (!good || !other) throw new Error('tirage vide');
    const ghost = {
      ...other,
      uid: 'it-000077',
      affixes: [{ affixId: 'retire-par-patch', q: 0.4 }],
    };
    const unknownBase = { ...other, uid: 'it-000078', defId: 'casquette-supprimee' };
    const state = {
      ...newMeta(),
      loot: {
        ...newMeta().loot,
        ferraille: 10,
        vestiaire: [good, ghost, unknownBase],
        paquetage: ['it-000077'],
      },
    };
    const loaded = load(JSON.stringify({ savedAt: 'x', state }));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const loot = loaded.data.state.loot;
    expect(loot.vestiaire).toEqual([good]);
    expect(loot.scrappedOnLoad).toBe(2);
    expect(loot.ferraille).toBeGreaterThan(10);
    expect(loot.paquetage).toEqual([]);
    expect(loot.nextUid).toBeGreaterThan(Number(good.uid.slice(3)));
    expect(ackScrappedNotice(loaded.data.state).loot.scrappedOnLoad).toBe(0);
  });

  it('qualités et ilvl hors bornes sont ramenés dans [0, 1] et [1, 30]', () => {
    const [good] = sampleItems();
    if (!good) throw new Error('tirage vide');
    const res = sanitizeItem({
      ...good,
      ilvl: 99,
      implicitQ: -3,
      affixes: good.affixes.map((a) => ({ ...a, q: 4 })),
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.item.ilvl).toBe(30);
    expect(res.item.implicitQ).toBe(0);
    for (const a of res.item.affixes) expect(a.q).toBe(1);
    expect(sanitizeLoot('n’importe quoi').loot).toEqual(newMeta().loot);
  });

  it('une sauvegarde version 3 donne « too-new »', () => {
    const raw = JSON.stringify({ savedAt: 'x', state: { ...newMeta(), version: 3 } });
    expect(load(raw)).toEqual({ ok: false, reason: 'too-new' });
  });
});

function createRunResult(): Parameters<typeof applyResult>[1] {
  return {
    end: 'mort',
    shift: 'matin',
    room: 4,
    clock: 90,
    psEarned: 12,
    grainsEarned: 1,
    kills: 20,
    avantages: 2,
    cause: null,
  };
}
