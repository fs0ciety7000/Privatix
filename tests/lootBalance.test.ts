import { describe, expect, it } from 'vitest';
import type { SlotId } from '@/config/loot';
import { AFFIXES, GEAR_POWER_CAP, ITEMS, SLOTS } from '@/config/loot';
import type { ItemInstance } from '@/systems/loot';
import {
  affixPool,
  emptyLoadout,
  equipmentModifiers,
  newLootRun,
  powerRatio,
  rollItem,
} from '@/systems/loot';
import { createRng } from '@/utils/rng';

/**
 * Test 10 de la proposition (§ 7.4) : budget de puissance de l'équipement et garde-fou contre le
 * power creep. Mesure : DPS mono-cible estimé (Calibre, seau additif, coup final, vitesse,
 * critique) rapporté au héros sans équipement (Clé à tire-fond nue).
 */

const UNLOCKED = ITEMS.filter((i) => i.slot === 'outil').map((i) => i.id);

/** Une tenue tirée : un objet par emplacement, drop d'ennemi à la salle `r` (Matin). */
function drawnOutfit(seed: number, r: number): Record<SlotId, ItemInstance | null> {
  const rng = createRng(seed);
  let cursor = { run: newLootRun(1), pity: { patrimoine: 0, welcomeDone: true, frozen: true } };
  const outfit: Record<SlotId, ItemInstance | null> = { ...emptyLoadout().equipped };
  for (const slot of SLOTS) {
    const res = rollItem(
      rng,
      { source: 'ennemi', r, shift: 'matin', unlockedTools: UNLOCKED },
      cursor,
      {
        slot,
      },
    );
    cursor = res;
    outfit[slot] = res.item;
  }
  return outfit;
}

function ratios(r: number): number[] {
  const out: number[] = [];
  for (let seed = 1; seed <= 1000; seed += 1) {
    out.push(powerRatio(equipmentModifiers(drawnOutfit(seed, r), { r })));
  }
  return out.sort((a, b) => a - b);
}

function combos<T>(list: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  return list.flatMap((x, i) => combos(list.slice(i + 1), k - 1).map((c) => [x, ...c]));
}

/** Meilleure tenue possible : Hors-série ilvl 30, q = 1, recherche gloutonne par emplacement. */
function bestOutfit(): Record<SlotId, ItemInstance | null> {
  let uid = 0;
  const candidates = new Map<SlotId, ItemInstance[]>();
  for (const slot of SLOTS) {
    const pool = affixPool(slot);
    const list: ItemInstance[] = [];
    for (const base of ITEMS.filter((b) => b.slot === slot)) {
      for (const c of combos(pool, Math.min(4, pool.length))) {
        if (new Set(c.map((a) => a.group)).size !== c.length) continue;
        uid += 1;
        list.push({
          uid: `best-${String(uid)}`,
          defId: base.id,
          rarity: 'hors-serie',
          ilvl: 30,
          implicitQ: 1,
          affixes: c.map((a) =>
            a.stat === 'familyMult'
              ? { affixId: a.id, q: 1, family: 'marcel' }
              : { affixId: a.id, q: 1 },
          ),
          origin: { source: 'boss', shift: 0, room: 27 },
          rerolls: 0,
          locked: false,
        });
      }
    }
    candidates.set(slot, list);
  }
  let outfit: Record<SlotId, ItemInstance | null> = { ...emptyLoadout().equipped };
  const score = (o: Record<SlotId, ItemInstance | null>): number =>
    powerRatio(equipmentModifiers(o, { r: 27 }));
  for (let pass = 0; pass < 3; pass += 1) {
    for (const slot of SLOTS) {
      let best = score(outfit);
      for (const c of candidates.get(slot) ?? []) {
        const next = { ...outfit, [slot]: c };
        const v = score(next);
        if (v > best) {
          best = v;
          outfit = next;
        }
      }
    }
  }
  return outfit;
}

describe('10. budget de puissance de l’équipement (1 000 tenues tirées)', () => {
  it('médiane ×1,15–1,25 à r = 9 et ×1,35–1,50 à r = 27 (tolérance ±0,02)', () => {
    const r9 = ratios(9);
    const r27 = ratios(27);
    const median9 = r9[500] ?? 0;
    const median27 = r27[500] ?? 0;
    expect(median9).toBeGreaterThanOrEqual(1.15 - 0.02);
    expect(median9).toBeLessThanOrEqual(1.25 + 0.02);
    expect(median27).toBeGreaterThanOrEqual(1.35 - 0.02);
    expect(median27).toBeLessThanOrEqual(1.5 + 0.02);
    // Garde-fou : aucune tenue tirée ne dépasse le plafond.
    expect(r27[r27.length - 1]).toBeLessThanOrEqual(GEAR_POWER_CAP + 1e-9);
  });

  it('garde-fou : la meilleure tenue possible reste ≤ ×1,65', () => {
    const best = bestOutfit();
    const mods = equipmentModifiers(best, { r: 27 });
    expect(powerRatio(mods)).toBeLessThanOrEqual(GEAR_POWER_CAP + 1e-9);
    // Le plafond agit bien : sans lui, les tables permettraient beaucoup plus.
    expect(mods.damage.powerCapScale).toBeLessThan(1);
    // Avec les Avantages dans le même seau additif, la part de l'équipement baisse encore.
    expect(powerRatio(mods, { damageBucket: 1 })).toBeLessThanOrEqual(GEAR_POWER_CAP);
  });

  it('le Paquetage en salle 1 est ramené au niveau de la salle (ilvl effectif)', () => {
    const best = bestOutfit();
    const atRoom1 = powerRatio(equipmentModifiers(best, { r: 1 }));
    const atRoom27 = powerRatio(equipmentModifiers(best, { r: 27 }));
    expect(atRoom1).toBeLessThan(atRoom27);
    expect(AFFIXES.length).toBe(34);
  });
});
