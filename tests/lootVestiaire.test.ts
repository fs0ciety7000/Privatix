import { describe, expect, it } from 'vitest';
import type { ItemInstance } from '@/systems/loot';
import {
  consignLimit,
  convertToPieces,
  emptyLoadout,
  equip,
  paquetageSize,
  polish,
  raiseCap,
  reforge,
  reforgeCost,
  reforgeOptions,
  scrapFromVestiaire,
  scrapValue,
  setPaquetage,
  settleLootRun,
  startLootRun,
  stash,
  toggleLock,
  unlockTool,
  vestiaireCapacity,
} from '@/systems/loot';
import type { MetaState } from '@/systems/meta/MetaState';
import { newMeta } from '@/systems/meta/MetaState';
import { AFFIXES_BY_ID } from '@/config/loot';
import { createRng } from '@/utils/rng';

function item(uid: string, defId: string, over: Partial<ItemInstance> = {}): ItemInstance {
  return {
    uid,
    defId,
    rarity: 'homologue',
    ilvl: 12,
    implicitQ: 0.5,
    affixes: [
      { affixId: 'affute', q: 0.5 },
      { affixId: 'equilibre', q: 0.95 },
    ],
    origin: { source: 'elite', shift: 1, room: 6 },
    rerolls: 0,
    locked: false,
    ...over,
  };
}

function withVestiaire(items: ItemInstance[], extra: Partial<MetaState['loot']> = {}): MetaState {
  const meta = newMeta();
  return { ...meta, loot: { ...meta.loot, vestiaire: items, ferraille: 100, ...extra } };
}

describe('13. consigne de fin de Shift', () => {
  const found = [
    item('it-000010', 'gants-manutention'),
    item('it-000011', 'casque-lampe', { rarity: 'hors-serie' }),
    item('it-000012', 'gilet-classe2', { rarity: 'reforme', ilvl: 3 }),
  ];
  function runWith(meta: MetaState): ReturnType<typeof startLootRun> {
    const start = startLootRun(meta);
    let loadout = start.loadout;
    for (const i of found) loadout = equip(loadout, i).loadout;
    return { ...start, loadout, run: { ...start.run, nextUid: 13, newPlans: ['feu-rouge'] } };
  }

  it('1 objet à la mort, 2 en victoire, +1 avec « Consigne élargie »', () => {
    const meta = newMeta();
    expect(consignLimit(meta, 'mort')).toBe(1);
    expect(consignLimit(meta, 'victoire')).toBe(2);
    expect(consignLimit({ ...meta, upgrades: { consigne: 1 } }, 'mort')).toBe(2);
    const run = runWith(meta);
    const tooMany = settleLootRun(meta, {
      outcome: 'mort',
      ...run,
      keep: ['it-000010', 'it-000011'],
    });
    expect(tooMany).toEqual({ ok: false, reason: 'too-many' });
    const win = settleLootRun(meta, {
      outcome: 'victoire',
      ...run,
      keep: ['it-000010', 'it-000011'],
    });
    expect(win.ok && win.kept.length).toBe(2);
  });

  it('le reste part en Ferraille à 100 % ; Plans archivés, uid rendu à la méta', () => {
    const meta = newMeta();
    const run = runWith(meta);
    const res = settleLootRun(meta, {
      outcome: 'mort',
      ...run,
      keep: ['it-000011'],
      ferrailleEarned: 4,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    // Outil de départ (Réforme ilvl 1) + gants Homologué ilvl 12 + gilet Réforme ilvl 3.
    const expected = scrapValue({ rarity: 'reforme', ilvl: 1 }) + 7 + 1 + 4;
    expect(res.ferraille).toBe(expected);
    expect(res.meta.loot.ferraille).toBe(expected);
    expect(res.meta.loot.vestiaire.map((i) => i.uid)).toEqual(['it-000011']);
    expect(res.meta.loot.codex).toEqual(['feu-rouge']);
    expect(res.meta.loot.nextUid).toBe(13);
  });

  it('les objets du Paquetage reviennent intacts, hors quota', () => {
    const pack = item('it-000001', 'mitaines-quai', { locked: true });
    const meta = withVestiaire([pack], { paquetage: ['it-000001'], ferraille: 0 });
    const start = startLootRun(meta);
    expect(start.loadout.equipped.gants?.uid).toBe('it-000001');
    expect(start.loadout.equipped.outil?.defId).toBe('cle-tire-fond');
    const res = settleLootRun(meta, { outcome: 'mort', ...start, keep: [] });
    expect(res.ok && res.meta.loot.vestiaire).toEqual([pack]);
    expect(res.ok && res.meta.loot.ferraille).toBe(1);
  });

  it('refuse un uid inconnu et un Vestiaire plein', () => {
    const meta = newMeta();
    const run = runWith(meta);
    expect(settleLootRun(meta, { outcome: 'mort', ...run, keep: ['it-999999'] })).toEqual({
      ok: false,
      reason: 'unknown-item',
    });
    const full = withVestiaire(
      Array.from({ length: 24 }, (_, i) => item(`v-${String(i)}`, 'casque-lampe')),
    );
    expect(settleLootRun(full, { outcome: 'mort', ...runWith(full), keep: ['it-000010'] })).toEqual(
      {
        ok: false,
        reason: 'full',
      },
    );
  });

  it('pitié rendue à la méta, sauf en Shift imposé', () => {
    const meta = newMeta();
    const run = runWith(meta);
    const normal = settleLootRun(meta, {
      outcome: 'mort',
      ...run,
      pity: { patrimoine: 2.4, welcomeDone: false, frozen: false },
      keep: [],
    });
    expect(normal.ok && normal.meta.loot.pityPatrimoine).toBe(2.4);
    const fixed = settleLootRun(meta, {
      outcome: 'mort',
      ...run,
      pity: { patrimoine: 2.4, welcomeDone: true, frozen: true },
      keep: [],
    });
    expect(fixed.ok && fixed.meta.loot.pityPatrimoine).toBe(0);
    expect(fixed.ok && fixed.meta.loot.welcomePatrimoineDone).toBe(false);
  });
});

describe('Vestiaire de la DPD et relances de PACO', () => {
  it('capacité, Paquetage (un objet par emplacement), Outil de départ', () => {
    const meta = withVestiaire([
      item('a', 'gants-manutention'),
      item('b', 'mitaines-quai'),
      item('c', 'casque-lampe'),
    ]);
    expect(vestiaireCapacity(meta)).toBe(24);
    expect(vestiaireCapacity({ ...meta, upgrades: { casier: 2 } })).toBe(48);
    expect(paquetageSize(meta)).toBe(1);
    expect(setPaquetage(meta, ['a', 'c'])).toEqual({ ok: false, reason: 'too-many' });
    const big = { ...meta, upgrades: { paquetage: 2 } };
    expect(setPaquetage(big, ['a', 'b'])).toEqual({ ok: false, reason: 'slot-taken' });
    expect(setPaquetage(big, ['a', 'c']).ok).toBe(true);
  });

  it('démontage : cadenas respecté, Ferraille créditée, retiré du Paquetage', () => {
    const meta = withVestiaire([item('a', 'gants-manutention')], {
      paquetage: ['a'],
      ferraille: 0,
    });
    const locked = toggleLock(meta, 'a');
    expect(locked.ok).toBe(true);
    if (!locked.ok) return;
    expect(scrapFromVestiaire(locked.meta, 'a')).toEqual({ ok: false, reason: 'locked' });
    const res = scrapFromVestiaire(meta, 'a');
    expect(res.ok && res.meta.loot.ferraille).toBe(7);
    expect(res.ok && res.meta.loot.paquetage).toEqual([]);
  });

  it('polissage (+0,10, 8 Ferraille) et remise à niveau (+3 ilvl, 15 + niveau visé)', () => {
    const meta = withVestiaire([item('a', 'gants-manutention')]);
    const p = polish(meta, 'a', 1);
    expect(p.ok && p.meta.loot.vestiaire[0]?.affixes[1]?.q).toBe(1);
    expect(p.ok && p.meta.loot.ferraille).toBe(92);
    if (!p.ok) return;
    expect(polish(p.meta, 'a', 1)).toEqual({ ok: false, reason: 'max' });
    const r = raiseCap(meta, 'a');
    expect(r.ok && r.meta.loot.vestiaire[0]?.ilvl).toBe(15);
    expect(r.ok && r.meta.loot.ferraille).toBe(100 - 30);
    const poor = withVestiaire([item('a', 'gants-manutention')], { ferraille: 5 });
    expect(raiseCap(poor, 'a')).toEqual({ ok: false, reason: 'ferraille' });
  });

  it('réaffûtage chez Béné : 3 options du même type, coût croissant', () => {
    const it0 = item('a', 'gants-manutention');
    const options = reforgeOptions(it0, 0, createRng(3));
    expect(options).toHaveLength(3);
    for (const o of options) {
      const def = AFFIXES_BY_ID.get(o.affixId);
      expect(def?.kind).toBe('prefix');
      expect(def?.slots).toContain('gants');
      expect(['affute', 'equilibre']).not.toContain(o.affixId);
    }
    const meta = withVestiaire([it0]);
    const first = options[0];
    if (!first) throw new Error('aucune option');
    const res = reforge(meta, 'a', 0, first);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const after = res.meta.loot.vestiaire[0];
    expect(after?.affixes[0]?.affixId).toBe(first.affixId);
    expect(after?.rerolls).toBe(1);
    expect(res.meta.loot.ferraille).toBe(88);
    if (after) expect(reforgeCost(after)).toBe(18);
    expect(reforge(meta, 'a', 0, { affixId: 'equilibre', q: 1 })).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('conversion Ferraille → Pièce : 25 pour 1, une fois par Shift', () => {
    const meta = withVestiaire([]);
    const once = convertToPieces(meta);
    expect(once.ok && once.meta.pieces).toBe(1);
    if (!once.ok) return;
    expect(convertToPieces(once.meta)).toEqual({ ok: false, reason: 'already-done' });
    const nextShift = { ...once.meta, stats: { ...once.meta.stats, shifts: 1 } };
    expect(convertToPieces(nextShift).ok).toBe(true);
  });

  it('Dotations d’outil : Pièces et prérequis', () => {
    const meta = { ...newMeta(), pieces: 5 };
    expect(unlockTool(meta, 'masse-voie')).toEqual({ ok: false, reason: 'requirement' });
    const killed = { ...meta, stats: { ...meta.stats, bossKills: 1 } };
    const res = unlockTool(killed, 'masse-voie');
    expect(res.ok && res.meta.pieces).toBe(3);
    expect(res.ok && res.meta.loot.unlockedTools).toContain('masse-voie');
    expect(unlockTool(meta, 'pied-de-biche').ok).toBe(true);
  });

  it('sac de service : 4 cases', () => {
    let loadout = emptyLoadout();
    for (let i = 0; i < 4; i += 1) {
      const next = stash(loadout, item(`s${String(i)}`, 'casque-lampe'));
      expect(next).not.toBeNull();
      if (next) loadout = next;
    }
    expect(stash(loadout, item('s5', 'casque-lampe'))).toBeNull();
  });
});
