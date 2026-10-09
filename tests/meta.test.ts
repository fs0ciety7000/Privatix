import { describe, expect, it } from 'vitest';
import { COFFEE, REWARDS } from '@/config/balance';
import {
  AVANTAGES,
  baseMods,
  computeMods,
  FAMILIES,
  offerAvantages,
} from '@/systems/meta/Avantages';
import {
  buyUpgrade,
  isMetaState,
  loadoutOf,
  META_SAVE_SCHEMA,
  newMeta,
  nextCost,
} from '@/systems/meta/MetaState';
import type { MetaState } from '@/systems/meta/MetaState';
import {
  applyResult,
  createRun,
  enterRoom,
  finishRun,
  maxEnergy,
  refreshMods,
} from '@/systems/meta/RunState';
import { BOSS_ROOM, REST_ROOM } from '@/systems/procedural/ShiftPlan';
import type { KeyValueStorage } from '@/systems/save/SaveManager';
import { SaveManager } from '@/systems/save/SaveManager';
import { createRng } from '@/utils/rng';

function withPs(ps: number): MetaState {
  return { ...newMeta(), ps };
}

describe('Tableau des revendications', () => {
  it('achète un rang, débite les PS et refuse au-delà', () => {
    let meta = withPs(100);
    const r1 = buyUpgrade(meta, 'anciennete');
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    meta = r1.meta;
    expect(meta.ps).toBe(70);
    expect(nextCost(meta, 'anciennete')).toBe(60);
    const r2 = buyUpgrade(meta, 'anciennete');
    expect(r2.ok && r2.meta.ps).toBe(10);
    expect(buyUpgrade(withPs(10), 'chaussures')).toEqual({ ok: false, reason: 'ps' });
  });

  it('traduit les rangs en bonus de départ', () => {
    const meta: MetaState = {
      ...newMeta(),
      upgrades: { anciennete: 2, thermos: 1, mutuelle: 1, chaussures: 1, tableau: 1 },
    };
    const l = loadoutOf(meta);
    expect(l.maxEnergyBonus).toBe(20);
    expect(l.gobeletsBonus).toBe(1);
    expect(l.reviveFraction).toBe(0.4);
    expect(l.dashCharges).toBe(1);
    expect(l.shiftsUnlocked).toBe(2);
  });

  it('valide une sauvegarde et rejette une revendication inconnue', () => {
    expect(isMetaState(newMeta())).toBe(true);
    expect(isMetaState({ ...newMeta(), upgrades: { inconnue: 1 } })).toBe(false);
    expect(isMetaState({ ...newMeta(), version: 1 })).toBe(false);
    expect(isMetaState({ ...newMeta(), version: 3 })).toBe(false);
  });
});

describe('Shift en cours', () => {
  it('démarre avec la méta : Énergie, Gobelets, charges de dash', () => {
    const meta: MetaState = {
      ...newMeta(),
      upgrades: { anciennete: 1, thermos: 2, chaussures: 1, caisse: 1 },
    };
    const run = createRun(meta, 'matin', 1);
    expect(maxEnergy(run)).toBe(110);
    expect(run.energy).toBe(110);
    expect(run.gobelets).toBe(Math.min(COFFEE.MAX, COFFEE.START + 2));
    expect(run.dash.max).toBe(3);
    expect(run.tickets).toBe(40);
  });

  it('avance l’horloge de 30 min par salle et remonte le plancher de Burnout', () => {
    const run = createRun(newMeta(), 'nuit', 1);
    enterRoom(run, 5, 'combat');
    expect(run.minutes).toBe(120);
    expect(run.burnout.floor).toBeCloseTo(2 * 3 * 1.5);
    enterRoom(run, REST_ROOM, 'repos');
    const restMinutes = run.minutes;
    enterRoom(run, BOSS_ROOM, 'boss');
    expect(run.minutes - restMinutes).toBe(30);
  });

  it('à la mort : PS gardés + prime d’ancienneté ; en victoire : +50 PS et Grains ×2', () => {
    const dead = createRun(newMeta(), 'matin', 1);
    enterRoom(dead, 4, 'combat');
    dead.psEarned = 10;
    expect(finishRun(dead, 'mort').psEarned).toBe(10 + REWARDS.PS_PER_ROOM_REACHED_ON_DEATH * 4);

    const won = createRun(newMeta(), 'apres-midi', 1);
    won.grainsEarned = 5;
    const result = finishRun(won, 'victoire');
    expect(result.psEarned).toBe(Math.round(REWARDS.PS_SHIFT_COMPLETE * 1.15));
    expect(result.grainsEarned).toBe(10);
    const meta = applyResult(newMeta(), result);
    expect(meta.ps).toBe(result.psEarned);
    expect(meta.stats.shifts).toBe(1);
    expect(meta.stats.deaths).toBe(0);
  });

  it('les Avantages modifient les stats (rareté ×1,5 / ×2)', () => {
    const run = createRun(newMeta(), 'matin', 1);
    run.avantages.push(
      { id: 'carte-de-service', rarity: 'statutaire' },
      { id: 'rattrapage-horaire', rarity: 'standard' },
    );
    refreshMods(run);
    expect(maxEnergy(run)).toBe(130);
    expect(run.dash.max).toBe(3);
  });
});

describe('Avantages acquis', () => {
  it('chaque Avantage appartient à une famille de collègue connue', () => {
    for (const a of AVANTAGES) expect(FAMILIES[a.family]).toBeDefined();
    expect(new Set(AVANTAGES.map((a) => a.id)).size).toBe(AVANTAGES.length);
  });

  it('cumule les effets', () => {
    const mods = computeMods(baseMods(), [
      { id: 'verification-approfondie', rarity: 'standard' },
      { id: 'verification-approfondie', rarity: 'anciennete' },
    ]);
    expect(mods.damageBonus).toBeCloseTo(0.12 + 0.18);
  });

  it('propose 3 Avantages d’une même famille quand elle en a assez, sans ceux déjà acquis', () => {
    for (let seed = 1; seed < 200; seed += 1) {
      const owned = [{ id: 'heures-sup', rarity: 'standard' as const }];
      const offer = offerAvantages(createRng(seed), owned, 3);
      expect(offer.options).toHaveLength(3);
      expect(offer.options.map((o) => o.id)).not.toContain('heures-sup');
      expect(new Set(offer.options.map((o) => o.id)).size).toBe(3);
    }
  });
});

class MemoryStorage implements KeyValueStorage {
  public readonly data = new Map<string, string>();
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

describe('SaveManager générique', () => {
  const schema = META_SAVE_SCHEMA;

  it('fait l’aller-retour d’une méta', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage, schema, 'k', () => new Date('2026-10-09T06:00:00Z'));
    expect(saves.save(withPs(42))).toBe(true);
    const loaded = saves.load();
    expect(loaded.ok && loaded.data.state.ps).toBe(42);
  });

  it('signale vide, corrompu, trop récent et stockage absent', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage, schema, 'k');
    expect(saves.load()).toEqual({ ok: false, reason: 'empty' });
    storage.setItem('k', '{pas du json');
    expect(saves.load()).toEqual({ ok: false, reason: 'corrupted' });
    storage.setItem('k', JSON.stringify({ savedAt: 'x', state: { ...newMeta(), version: 9 } }));
    expect(saves.load()).toEqual({ ok: false, reason: 'too-new' });
    expect(new SaveManager(null, schema).load()).toEqual({
      ok: false,
      reason: 'storage-unavailable',
    });
  });

  it('applique les migrations dans l’ordre', () => {
    const storage = new MemoryStorage();
    storage.setItem('k', JSON.stringify({ savedAt: 'x', state: { version: 0, points: 7 } }));
    const migrating = new SaveManager(
      storage,
      {
        version: 1,
        migrations: { 0: (s: Record<string, unknown>) => ({ ...newMeta(), ps: s.points }) },
        validate: isMetaState,
      },
      'k',
    );
    const loaded = migrating.load();
    expect(loaded.ok && loaded.data.state.ps).toBe(7);
  });
});
