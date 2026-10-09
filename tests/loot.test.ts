import { describe, expect, it } from 'vitest';
import { BURNOUT, REWARD_WEIGHTS_LOOT, SHOP } from '@/config/balance';
import type { DropSource, ItemRarity, SlotId } from '@/config/loot';
import {
  AFFIXES,
  AFFIXES_BY_ID,
  ITEM_RARITIES,
  ITEMS,
  ITEMS_BY_ID,
  LEGENDARIES,
  LEGENDARIES_BY_ID,
  RARITY_ORDER,
  RARITY_WEIGHTS,
  SETS,
  SLOTS,
  TOOLS,
} from '@/config/loot';
import type { DropContext, ItemInstance, LootCursor, LootPity } from '@/systems/loot';
import {
  activeSets,
  affixValue,
  announceDotation,
  atLeast,
  clampBurnoutForGear,
  compareInLoadout,
  compareItems,
  describeItem,
  dotationOffer,
  dropsForKill,
  dropsForSource,
  effectiveIlvl,
  emptyLoadout,
  equip,
  equipFromBag,
  equipmentModifiers,
  gearStats,
  itemLevel,
  itemName,
  legendaryHooks,
  meltdownBlocked,
  newLootRun,
  pickRarity,
  rarityWeights,
  rollAffixes,
  rollItem,
  scrapValue,
  stash,
  tierOf,
  tierValue,
  toolBaseDps,
} from '@/systems/loot';
import { doorsFor } from '@/systems/procedural/ShiftPlan';
import { createRng } from '@/utils/rng';

const PITY: LootPity = { patrimoine: 0, welcomeDone: false, frozen: false };
const cursor0 = (pity: LootPity = PITY): LootCursor => ({ run: newLootRun(1), pity });
const ALL_TOOLS = ITEMS.filter((i) => i.slot === 'outil').map((i) => i.id);

function ctx(seed: number, room = 4, extra: Partial<DropContext> = {}): DropContext {
  return {
    seed,
    room,
    shift: 'matin',
    unlockedTools: ALL_TOOLS,
    codex: LEGENDARIES.map((l) => l.id),
    ...extra,
  };
}

/** Objet construit à la main (q = 1 par défaut). */
function make(
  defId: string,
  affixIds: readonly string[],
  over: Partial<ItemInstance> = {},
  q = 1,
): ItemInstance {
  return {
    uid: `t-${defId}-${affixIds.join('-')}`,
    defId,
    rarity: 'hors-serie',
    ilvl: 30,
    implicitQ: 1,
    affixes: affixIds.map((affixId) =>
      AFFIXES_BY_ID.get(affixId)?.stat === 'familyMult'
        ? { affixId, q, family: 'rudy' as const }
        : { affixId, q },
    ),
    origin: { source: 'boss', shift: 1, room: 27 },
    rerolls: 0,
    locked: false,
    ...over,
  };
}

/** Beaucoup d'objets variés (sources, salles, roulements). */
function sampleItems(n: number): ItemInstance[] {
  const sources: DropSource[] = ['ennemi', 'caisse', 'casier', 'elite', 'boss', 'boss-premier'];
  const out: ItemInstance[] = [];
  let cur = cursor0();
  for (let i = 0; i < n; i += 1) {
    const rng = createRng(1000 + i);
    const res = rollItem(
      rng,
      {
        source: sources[i % sources.length] ?? 'ennemi',
        r: 1 + (i % 28),
        shift: i % 3 === 0 ? 'nuit' : 'matin',
        unlockedTools: ALL_TOOLS,
        codex: LEGENDARIES.map((l) => l.id),
      },
      cur,
    );
    cur = { run: res.run, pity: res.pity };
    out.push(res.item);
  }
  return out;
}

describe('données du loot', () => {
  it('6 emplacements, 3 bases au moins par emplacement, 34 affixes, 13 Patrimoines, 4 Attelages', () => {
    expect(SLOTS).toHaveLength(6);
    for (const slot of SLOTS) {
      expect(ITEMS.filter((i) => i.slot === slot).length).toBeGreaterThanOrEqual(3);
    }
    expect(AFFIXES).toHaveLength(34);
    expect(AFFIXES.filter((a) => a.kind === 'prefix')).toHaveLength(16);
    expect(AFFIXES.filter((a) => a.mvp)).toHaveLength(20);
    expect(LEGENDARIES).toHaveLength(13);
    expect(LEGENDARIES_BY_ID.get('ruban-inaugural')?.name).toBe('Ruban inaugural');
    expect(SETS).toHaveLength(4);
    for (const l of LEGENDARIES) expect(ITEMS_BY_ID.has(l.baseId)).toBe(true);
    for (const s of SETS) for (const p of s.pieces) expect(ITEMS_BY_ID.has(p)).toBe(true);
    for (const a of AFFIXES) {
      for (const t of a.tiers) expect(t.min).toBeLessThanOrEqual(t.max);
    }
  });

  it('raretés retenues, jamais magenta, turquoise ni jaune danger', () => {
    expect(RARITY_ORDER.map((r) => ITEM_RARITIES[r].label)).toEqual([
      'Réforme',
      'Réglementaire',
      'Homologué',
      'Hors-série',
      'Patrimoine',
    ]);
    for (const r of RARITY_ORDER) {
      expect(['#FF3EA5', '#19C3B1', '#FFD23F']).not.toContain(ITEM_RARITIES[r].color.toUpperCase());
    }
  });
});

describe('1. déterminisme', () => {
  it('même graine, même salle, même source → mêmes objets (1 000 graines)', () => {
    for (let seed = 1; seed <= 1000; seed += 1) {
      const source: DropSource = seed % 2 === 0 ? 'casier' : 'elite';
      const a = dropsForSource(source, ctx(seed), cursor0());
      const b = dropsForSource(source, ctx(seed), cursor0());
      expect(a).toEqual(b);
    }
  });

  it('deux graines différentes donnent des tirages différents', () => {
    const a = dropsForSource('boss', ctx(1), cursor0(), { bossNumber: 2 });
    const b = dropsForSource('boss', ctx(2), cursor0(), { bossNumber: 2 });
    expect(a.items).not.toEqual(b.items);
  });

  it('chaque drop d’une salle consomme son propre flux (compteur par salle)', () => {
    const first = dropsForSource('casier', ctx(7), cursor0());
    expect(first.run.dropIndexByRoom[4]).toBe(1);
    const second = dropsForSource('casier', ctx(7), first);
    expect(second.run.dropIndexByRoom[4]).toBe(2);
    expect(second.items[0]?.uid).not.toBe(first.items[0]?.uid);
  });
});

describe('2. indépendance des flux', () => {
  it('le loot ne change ni les portes ni les gabarits d’une graine', () => {
    const history = { shopSeen: false, elites: 0, tresorSeen: false, previousType: null };
    const before = [2, 3, 4, 5].map((room) => doorsFor(42, room, history));
    let cur = cursor0();
    for (let room = 2; room <= 5; room += 1) {
      for (let k = 0; k < 20; k += 1) cur = dropsForKill('borne', ctx(42, room), cur);
    }
    const after = [2, 3, 4, 5].map((room) => doorsFor(42, room, history));
    expect(after).toEqual(before);
  });
});

describe('3. distribution des raretés (10 000 tirages)', () => {
  const sources: DropSource[] = ['ennemi', 'caisse', 'dotation', 'casier', 'elite', 'boss'];
  it.each(sources)('%s : conforme à la table à ±1,5 pt (r = 1, Matin)', (source) => {
    const rng = createRng(2026);
    const counts: Record<ItemRarity, number> = {
      reforme: 0,
      reglementaire: 0,
      homologue: 0,
      'hors-serie': 0,
      patrimoine: 0,
    };
    const w = rarityWeights(source, { r: 1, shift: 'matin' });
    const n = 10_000;
    for (let i = 0; i < n; i += 1) counts[pickRarity(rng, w)] += 1;
    const table = RARITY_WEIGHTS[source];
    const total = RARITY_ORDER.reduce((s, k) => s + table[k], 0);
    for (const k of RARITY_ORDER) {
      expect(Math.abs((counts[k] / n) * 100 - (table[k] / total) * 100)).toBeLessThan(1.5);
    }
  });

  it('pipeline complet (ennemi) : distribution proche de la table, Réclamation comprise', () => {
    let homologuePlus = 0;
    for (let i = 0; i < 10_000; i += 1) {
      const res = rollItem(
        createRng(i),
        { source: 'ennemi', r: 1, shift: 'matin', unlockedTools: ALL_TOOLS },
        cursor0(),
      );
      if (atLeast(res.item.rarity, 'homologue')) homologuePlus += 1;
    }
    expect(Math.abs(homologuePlus / 100 - 10)).toBeLessThan(1.5);
  });

  it('décalages : avancement, Nuit, Plan ; Patrimoine plafonné à 6 % hors pitié', () => {
    const late = rarityWeights('ennemi', { r: 27, shift: 'matin' });
    expect(late.homologue).toBeCloseTo(8.5 + 5.2, 5);
    expect(late['hors-serie']).toBeCloseTo(1.3 + 2.08, 5);
    const night = rarityWeights('ennemi', { r: 1, shift: 'nuit' });
    expect(night.homologue).toBeCloseTo(10.5, 5);
    for (const source of Object.keys(RARITY_WEIGHTS) as DropSource[]) {
      if (source === 'boss-premier' || source === 'wagon-bar') continue;
      const w = rarityWeights(source, { r: 28, shift: 'nuit', planPoints: 28 });
      const total = RARITY_ORDER.reduce((s, k) => s + w[k], 0);
      expect(w.patrimoine / total).toBeLessThanOrEqual(0.06 + 1e-9);
    }
    const withPity = rarityWeights('boss', { r: 28, shift: 'nuit', pityPatrimoine: 8 });
    expect(withPity.patrimoine).toBeGreaterThan(6);
  });
});

describe('4. structure des objets', () => {
  const items = sampleItems(3000);

  it('nombre d’affixes conforme, au plus 2 préfixes et 2 suffixes, pas de doublon de groupe', () => {
    for (const item of items) {
      const def = ITEMS_BY_ID.get(item.defId);
      expect(def).toBeDefined();
      if (!def) continue;
      const expected = item.setId ? 3 : ITEM_RARITIES[item.rarity].affixes;
      expect(item.affixes).toHaveLength(expected);
      const defs = item.affixes.map((a) => AFFIXES_BY_ID.get(a.affixId));
      const groups = new Set(defs.map((d) => d?.group));
      expect(groups.size).toBe(defs.length);
      for (const d of defs) expect(d?.slots).toContain(def.slot);
      // Limite 2 + 2, relâchée seulement quand l'emplacement manque d'affixes de l'autre type.
      for (const kind of ['prefix', 'suffix'] as const) {
        const other = kind === 'prefix' ? 'suffix' : 'prefix';
        const otherPool = AFFIXES.filter((a) => a.kind === other && a.slots.includes(def.slot));
        const n = defs.filter((d) => d?.kind === kind).length;
        expect(n).toBeLessThanOrEqual(Math.max(2, expected - otherPool.length));
      }
    }
  });

  it('un Patrimoine a sa base imposée et respecte ses exclusions', () => {
    const legendaries = items.filter((i) => i.rarity === 'patrimoine');
    expect(legendaries.length).toBeGreaterThan(10);
    for (const item of legendaries) {
      const l = item.legendaryId ? LEGENDARIES_BY_ID.get(item.legendaryId) : undefined;
      expect(l?.baseId).toBe(item.defId);
      for (const a of item.affixes) expect(l?.excludes ?? []).not.toContain(a.affixId);
      expect(l?.questOnly).not.toBe(true);
    }
  });

  it('les pièces d’Attelage sont des Hors-série d’une base de l’Attelage', () => {
    const pieces = items.filter((i) => i.setId);
    expect(pieces.length).toBeGreaterThan(0);
    for (const p of pieces) {
      expect(p.rarity).toBe('hors-serie');
      expect(SETS.find((s) => s.id === p.setId)?.pieces).toContain(p.defId);
    }
  });

  it('exclusions : pas de Patrimoine déjà porté, ni de Plan non archivé', () => {
    const worn = make('casque-chantier', [], {
      rarity: 'patrimoine',
      legendaryId: 'casque-cocotte-minute',
    });
    for (let i = 0; i < 200; i += 1) {
      const res = rollItem(
        createRng(i),
        {
          source: 'wagon-bar',
          r: 9,
          shift: 'matin',
          unlockedTools: ['cle-tire-fond'],
          worn: [worn],
        },
        cursor0(),
      );
      expect(res.item.legendaryId).not.toBe('casque-cocotte-minute');
      expect(['boule-a-facettes', 'ruban-inaugural', 'cle-wagon-bar']).not.toContain(
        res.item.legendaryId,
      );
    }
  });

  it('nom affiché : base, préfixe, suffixe ; fiche lisible', () => {
    const item = make('gants-manutention', ['affute', 'du-coup-de-sang']);
    expect(itemName(item)).toBe('Gants de manutention affûté du Coup de sang');
    const lines = describeItem(item, 27);
    expect(lines[0]).toContain('Hors-série');
    expect(lines.some((l) => l.includes('Dégâts de Frappe +12 %'))).toBe(true);
  });
});

describe('5. valeurs des affixes', () => {
  it('toujours dans [min, max] du palier, arrondies au pas', () => {
    for (const item of sampleItems(500)) {
      for (const roll of item.affixes) {
        const def = AFFIXES_BY_ID.get(roll.affixId);
        if (!def) throw new Error('affixe inconnu');
        const v = affixValue(def, roll.q, item.ilvl);
        const tier = def.tiers[tierOf(item.ilvl)];
        expect(v).toBeGreaterThanOrEqual(tier.min - 1e-9);
        expect(v).toBeLessThanOrEqual(tier.max + 1e-9);
        expect(Math.abs(v / def.step - Math.round(v / def.step))).toBeLessThan(1e-6);
        expect(roll.q).toBe(Math.round(roll.q * 100) / 100);
      }
    }
  });

  it('bascules de palier exactes à 9/10 et 18/19', () => {
    expect([tierOf(9), tierOf(10), tierOf(18), tierOf(19), tierOf(30)]).toEqual([0, 1, 1, 2, 2]);
    const affute = AFFIXES_BY_ID.get('affute');
    if (!affute) throw new Error('affûté absent');
    expect(affixValue(affute, 1, 9)).toBe(0.05);
    expect(affixValue(affute, 0, 10)).toBe(0.06);
    expect(affixValue(affute, 1, 18)).toBe(0.08);
    expect(affixValue(affute, 0, 19)).toBe(0.09);
    expect(tierValue(affute.tiers, affute.step, 0.5, 30)).toBe(0.11);
  });
});

describe('6. item level', () => {
  it('correspond au tableau du § 5.1', () => {
    expect(itemLevel(1, 'ennemi', 'matin')).toBe(1);
    expect(itemLevel(1, 'dotation', 'matin')).toBe(2);
    expect(itemLevel(6, 'elite', 'matin')).toBe(8);
    expect(itemLevel(9, 'boss', 'matin')).toBe(12);
    expect(itemLevel(13, 'dotation', 'matin')).toBe(14);
    expect(itemLevel(18, 'boss', 'matin')).toBe(21);
    expect(itemLevel(28, 'boss', 'matin')).toBe(30);
    expect(itemLevel(28, 'boss', 'nuit')).toBe(30);
    expect(itemLevel(5, 'ennemi', 'apres-midi')).toBe(6);
  });

  it('ilvl effectif : un objet ilvl 25 vaut 4 en salle 1 et redevient 25 à r = 22', () => {
    expect(effectiveIlvl(25, 1)).toBe(4);
    expect(effectiveIlvl(25, 22)).toBe(25);
    const item = make('gilet-classe2', ['du-depot'], { ilvl: 25 });
    expect(gearStats([item], { r: 1 }).stats.maxEnergy).toBe(5 + 6);
    expect(gearStats([item], { r: 22 }).stats.maxEnergy).toBe(15 + 15);
  });
});

describe('7. protection contre la malchance', () => {
  const base = {
    source: 'ennemi' as const,
    r: 1,
    shift: 'matin' as const,
    unlockedTools: ALL_TOOLS,
  };

  it('Réclamation : après 5 objets sous Homologué, le 6e est au moins Homologué', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const run = { ...newLootRun(1), sinceHomologue: 5 };
      const res = rollItem(createRng(seed), base, { run, pity: PITY });
      expect(atLeast(res.item.rarity, 'homologue')).toBe(true);
      expect(res.run.sinceHomologue).toBe(0);
    }
  });

  it('Ancienneté du butin : +0,15 par objet, remise à 0 au Patrimoine, plafond 8', () => {
    let cur = cursor0();
    for (let i = 0; i < 4; i += 1) {
      cur = rollItem(createRng(i), base, cur, { rarity: 'reglementaire' });
    }
    expect(cur.pity.patrimoine).toBeCloseTo(0.6, 6);
    const reset = rollItem(createRng(9), { ...base, codex: [] }, cur, { rarity: 'patrimoine' });
    expect(reset.item.rarity).toBe('patrimoine');
    expect(reset.pity.patrimoine).toBe(0);
    expect(reset.pity.welcomeDone).toBe(true);
    const capped = rollItem(createRng(1), base, cursor0({ ...PITY, patrimoine: 7.95 }), {
      rarity: 'reforme',
    });
    expect(capped.pity.patrimoine).toBe(8);
  });

  it('Prime de bienvenue : Patrimoine garanti au 3e kill du Boss 1 si aucun n’est tombé', () => {
    const third = dropsForSource('boss', ctx(5, 10), cursor0(), {
      bossNumber: 1,
      boss1KillNumber: 3,
    });
    expect(third.items[0]?.rarity).toBe('patrimoine');
    expect(third.pity.welcomeDone).toBe(true);
    const done = dropsForSource('boss', ctx(5, 10), cursor0({ ...PITY, welcomeDone: true }), {
      bossNumber: 1,
      boss1KillNumber: 3,
    });
    expect(done.items).toHaveLength(2);
  });

  it('1er kill de boss : un Hors-série au moins ; boss 2 : 3 objets Homologués au moins', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const first = dropsForSource('boss', ctx(seed, 10), cursor0(), { firstKill: true });
      expect(atLeast(first.items[0]?.rarity ?? 'reforme', 'hors-serie')).toBe(true);
      const b2 = dropsForSource('boss', ctx(seed, 10), cursor0(), { bossNumber: 2 });
      expect(b2.items).toHaveLength(3);
      for (const it of b2.items) expect(atLeast(it.rarity, 'homologue')).toBe(true);
    }
  });

  it('Shift imposé : la pitié méta est gelée (ni lue ni écrite)', () => {
    const frozen: LootPity = { patrimoine: 8, welcomeDone: false, frozen: true };
    const w = rarityWeights('ennemi', { r: 1, shift: 'matin', pityPatrimoine: 0 });
    let cur: LootCursor = cursor0(frozen);
    for (let i = 0; i < 20; i += 1) cur = rollItem(createRng(i), base, cur);
    expect(cur.pity).toEqual(frozen);
    const third = dropsForSource('boss', ctx(5, 10), cursor0(frozen), { boss1KillNumber: 3 });
    expect(third.items[0]?.rarity).not.toBe('patrimoine');
    expect(w.patrimoine).toBeCloseTo(0.2, 6);
  });
});

describe('8. sac mélangé d’emplacements', () => {
  it('en 6 tirages consécutifs, les 6 emplacements sortent une fois chacun', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      let cur = cursor0();
      const slots: SlotId[] = [];
      for (let i = 0; i < 12; i += 1) {
        const res = rollItem(
          createRng(seed * 100 + i),
          { source: 'friterie', r: 5, shift: 'matin', unlockedTools: ALL_TOOLS },
          cur,
        );
        cur = res;
        const slot = ITEMS_BY_ID.get(res.item.defId)?.slot;
        if (slot) slots.push(slot);
      }
      expect(new Set(slots.slice(0, 6)).size).toBe(6);
      expect(new Set(slots.slice(6, 12)).size).toBe(6);
    }
  });

  it('sac des Outils : chaque Outil débloqué sort une fois avant toute répétition', () => {
    const tools = ['cle-tire-fond', 'masse-voie', 'pied-de-biche'];
    let cur = cursor0();
    const seen: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const res = rollItem(
        createRng(i),
        { source: 'friterie', r: 5, shift: 'matin', unlockedTools: tools },
        cur,
        { slot: 'outil' },
      );
      cur = res;
      seen.push(res.item.defId);
    }
    expect(new Set(seen)).toEqual(new Set(tools));
  });

  it('porte Dotation : 2 objets d’emplacements différents, le premier annoncé, rareté minimale', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const announce = announceDotation(seed, 3);
      const offer = dotationOffer(ctx(seed, 3), cursor0(), announce);
      expect(offer.items).toHaveLength(2);
      const slots = offer.items.map((i) => ITEMS_BY_ID.get(i.defId)?.slot);
      expect(slots[0]).toBe(announce.slot);
      expect(slots[1]).not.toBe(announce.slot);
      for (const i of offer.items) expect(atLeast(i.rarity, announce.minRarity)).toBe(true);
    }
  });

  it('ennemi tué : environ 3 % de drop pour un Junior, 5 % pour une Borne', () => {
    let junior = 0;
    let borne = 0;
    let cur = cursor0();
    for (let i = 0; i < 4000; i += 1) {
      const a = dropsForKill('consultant', ctx(i, 2), cur);
      junior += a.items.length;
      const b = dropsForKill('borne', ctx(i, 2), a);
      borne += b.items.length;
      cur = { run: newLootRun(1), pity: b.pity };
    }
    expect(junior / 4000).toBeGreaterThan(0.02);
    expect(junior / 4000).toBeLessThan(0.04);
    expect(borne / 4000).toBeGreaterThan(0.04);
    expect(borne / 4000).toBeLessThan(0.06);
  });
});

describe('9. plafonds par stat', () => {
  it('six objets « du Quai » de palier III au maximum restent à −30 %', () => {
    const six = SLOTS.map((slot) =>
      make(ITEMS.find((i) => i.slot === slot && i.id !== 'casque-chantier')?.id ?? '', ['du-quai']),
    );
    const g = gearStats(six);
    expect(g.raw.damageTakenReduction).toBeCloseTo(0.42, 6);
    expect(g.stats.damageTakenReduction).toBe(0.3);
    expect(equipmentModifiers(six).defense.damageTakenMult).toBeCloseTo(0.7, 6);
  });

  it('critique 50 %, vitesse d’attaque +25 %, recharge du dash −35 %, vitesse +20 %', () => {
    const crit = SLOTS.map(() => make('mitaines-quai', ['meticuleux']));
    expect(gearStats(crit).stats.critChance).toBeLessThanOrEqual(0.5);
    const speed = SLOTS.map(() => make('gants-manutention', ['equilibre', 'serre']));
    expect(gearStats(speed).stats.attackSpeed).toBe(0.25);
    const dash = SLOTS.map(() =>
      make('baskets-securite', ['de-correspondance', 'de-l-aiguilleur']),
    );
    const g = gearStats(dash);
    expect(g.stats.dashRechargeReduction).toBe(0.35);
    expect(g.stats.speed).toBe(0.2);
    const coffee = SLOTS.map(() => make('thermos-cabosse', ['decafeine']));
    const mods = equipmentModifiers(coffee);
    expect(BURNOUT.PER_COFFEE + mods.coffee.burnoutDelta).toBe(15);
  });
});

describe('11. Outils', () => {
  it('DPS mono-cible de chaque Outil dans [44, 52], formes arc / rect / cercle', () => {
    for (const [id, tool] of Object.entries(TOOLS)) {
      const dps = toolBaseDps(tool);
      expect(dps, id).toBeGreaterThanOrEqual(44);
      expect(dps, id).toBeLessThanOrEqual(52);
      expect(tool.combo.length).toBeGreaterThanOrEqual(2);
      expect(tool.combo.length).toBeLessThanOrEqual(4);
      expect(tool.finisherIndex).toBe(tool.combo.length - 1);
      for (const step of [...tool.combo, tool.dashAttack]) {
        expect(['arc', 'rect', 'circle']).toContain(step.shape.kind);
      }
    }
  });

  it('la Clé à tire-fond reprend le combo de balance.ts (51 DPS)', () => {
    expect(toolBaseDps(TOOLS['cle-tire-fond'] ?? (undefined as never))).toBeCloseTo(51.43, 1);
    expect(equipmentModifiers([]).toolId).toBe('cle-tire-fond');
  });
});

describe('12. équiper, sac, démonter', () => {
  it('l’échange conserve l’objet déplacé ; sac plein : il tombe au sol', () => {
    const a = make('gants-manutention', ['affute'], { uid: 'a' });
    const b = make('mitaines-quai', ['lourd'], { uid: 'b' });
    let loadout = equip(emptyLoadout(), a).loadout;
    const swapped = equip(loadout, b);
    expect(swapped.loadout.equipped.gants?.uid).toBe('b');
    expect(swapped.loadout.bag[0]?.uid).toBe('a');
    expect(swapped.dropped).toBeNull();
    loadout = swapped.loadout;
    for (let i = 0; i < 3; i += 1) {
      const next = stash(loadout, make('casque-lampe', [], { uid: `s${String(i)}` }));
      if (next) loadout = next;
    }
    expect(stash(loadout, make('casque-lampe', [], { uid: 'x' }))).toBeNull();
    const full = equip(loadout, make('gants-isolants', [], { uid: 'c' }));
    expect(full.dropped?.uid).toBe('b');
    const back = equipFromBag(full.loadout, 0);
    expect(back.equipped.gants?.uid).toBe('a');
    expect(back.bag[0]?.uid).toBe('c');
  });

  it('Ferraille conforme au § 5.5 (+floor(ilvl / 10), 50 % au sol)', () => {
    const values = RARITY_ORDER.map((rarity) => scrapValue({ rarity, ilvl: 1 }));
    expect(values).toEqual([1, 3, 6, 15, 40]);
    expect(scrapValue({ rarity: 'homologue', ilvl: 25 })).toBe(8);
    expect(scrapValue({ rarity: 'hors-serie', ilvl: 12 }, true)).toBe(8);
  });
});

describe('stats, Attelages et comparaison', () => {
  it('bonus d’Attelage par palier de pièces portées', () => {
    const nuit = ['casque-lampe', 'parka-nuit', 'bottes-voie', 'mitaines-quai'].map((id) =>
      make(id, [], { setId: 'tenue-de-nuit', uid: id }),
    );
    expect(activeSets(nuit.slice(0, 1))[0]?.bonuses).toHaveLength(0);
    const two = equipmentModifiers(nuit.slice(0, 2));
    expect(two.stats.nightDamage).toBeCloseTo(0.05, 6);
    expect(two.setSpecials).toHaveLength(0);
    const four = equipmentModifiers(nuit);
    expect(four.setSpecials.map((s) => s.special)).toEqual(['plancher-nuit', 'attaque-surprise']);
    expect(four.movement.ballastImmune).toBe(true);
    // Une base d'Attelage sans setId ne compte pas.
    expect(activeSets([make('casque-lampe', [])])).toHaveLength(0);
  });

  it('equipmentModifiers : modificateurs prêts à appliquer', () => {
    const outil = make('pied-de-biche', ['affute', 'bien-serre'], { ilvl: 10 }, 0);
    const insigne = make('badge-syndical', ['de-solidarite', 'strident'], { ilvl: 10 }, 0);
    const mods = equipmentModifiers([outil, insigne]);
    expect(mods.toolId).toBe('pied-de-biche');
    expect(mods.damage.critChanceBase).toBe(0.12);
    expect(mods.damage.baseMult).toBeCloseTo(1.108, 6);
    expect(mods.damage.bonus).toBe(0.06);
    expect(mods.damage.finisherMult).toBeCloseTo(1.13, 6);
    expect(mods.mobilisation.gainMult).toBeCloseTo(1.08, 6);
    expect(mods.whistle.radiusBonus).toBe(9);
    expect(mods.familyMult.rudy).toBeCloseTo(1.11, 6);
    expect(mods.damage.powerCapScale).toBe(1);
  });

  it('carte de comparaison : ▲ / ▼ / = et résumés Frappe et Tenue', () => {
    const current = make('gants-manutention', ['affute'], { ilvl: 5 }, 0);
    const candidate = make('gants-manutention', ['affute', 'lourd'], { ilvl: 5 }, 1);
    const deltas = compareItems(candidate, current);
    expect(deltas.find((d) => d.stat === 'damage')?.arrow).toBe('▲');
    expect(deltas.find((d) => d.stat === 'critMult')?.direction).toBe('up');
    expect(deltas.find((d) => d.stat === 'attackSpeed')?.arrow).toBe('=');
    const worse = compareItems(current, candidate);
    expect(worse.find((d) => d.stat === 'damage')?.arrow).toBe('▼');
    const equipped = equip(emptyLoadout(), current).loadout.equipped;
    const card = compareInLoadout(equipped, candidate);
    expect(card.frappe).toBeGreaterThan(0);
    expect(card.tenue).toBe(0);
    const vest = compareInLoadout(equipped, make('gilet-classe2', ['du-quai'], { ilvl: 5 }));
    expect(vest.tenue).toBeGreaterThan(0);
  });
});

describe('15. légendaires', () => {
  it('le switch sur les pouvoirs est exhaustif', () => {
    for (const l of LEGENDARIES) expect(legendaryHooks(l.power).length).toBeGreaterThan(0);
    expect(() => legendaryHooks('inconnu' as never)).toThrow();
  });

  it('Casque Cocotte-minute : Burnout bloqué à 99, sans Pétage de plombs', () => {
    const cocotte = make('casque-chantier', ['du-quai'], {
      rarity: 'patrimoine',
      legendaryId: 'casque-cocotte-minute',
    });
    const mods = equipmentModifiers([cocotte]);
    expect(meltdownBlocked(mods)).toBe(true);
    expect(clampBurnoutForGear(mods, 100)).toBe(99);
    expect(clampBurnoutForGear(mods, 60)).toBe(60);
    expect(clampBurnoutForGear(equipmentModifiers([]), 100)).toBe(100);
  });

  it('les contreparties chiffrées s’appliquent (Ruban inaugural : Énergie max −10)', () => {
    const ruban = make('badge-syndical', [], {
      rarity: 'patrimoine',
      legendaryId: 'ruban-inaugural',
    });
    expect(equipmentModifiers([ruban]).defense.maxEnergyBonus).toBe(-10);
    const visi = make('gilet-classe2', [], {
      rarity: 'patrimoine',
      legendaryId: 'gilet-haute-visibilite',
    });
    expect(equipmentModifiers([visi]).defense.damageTakenMult).toBeCloseTo(1.1, 6);
  });
});

describe('tirage des affixes', () => {
  it('sans doublon, avec exclusions et biais des familles possédées', () => {
    let sifflet = 0;
    let neutral = 0;
    for (let i = 0; i < 2000; i += 1) {
      const biased = rollAffixes(createRng(i), 'insigne', 1, { ownedFamilies: ['rudy'] });
      const plain = rollAffixes(createRng(i), 'insigne', 1);
      if (AFFIXES_BY_ID.get(biased[0]?.affixId ?? '')?.tags.includes('sifflet')) sifflet += 1;
      if (AFFIXES_BY_ID.get(plain[0]?.affixId ?? '')?.tags.includes('sifflet')) neutral += 1;
      const excluded = rollAffixes(createRng(i), 'chaussures', 4, {
        excludes: ['de-correspondance', 'du-ballast'],
      });
      expect(excluded.map((a) => a.affixId)).not.toContain('de-correspondance');
      expect(new Set(excluded.map((a) => a.affixId)).size).toBe(excluded.length);
    }
    expect(sifflet).toBeGreaterThan(neutral * 1.2);
  });
});

describe('balance.ts : poids des portes avec le loot', () => {
  it('total 100, la Dotation prend la place d’Avantages (40 → 34)', () => {
    const total = Object.values(REWARD_WEIGHTS_LOOT).reduce((s, w) => s + w, 0);
    expect(total).toBe(100);
    expect(REWARD_WEIGHTS_LOOT.avantage).toBe(34);
    expect(REWARD_WEIGHTS_LOOT.dotation).toBe(12);
    expect(SHOP.EQUIPEMENT).toBe(140);
  });
});
