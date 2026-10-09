import type { ShiftId } from '@/config/balance';
import type { AffixDef, DropSource, ItemDef, ItemRarity, SlotId } from '@/config/loot';
import {
  AFFIXES,
  FAMILY_TAGS,
  ITEM_RARITIES,
  ITEMS,
  ITEMS_BY_ID,
  LEGENDARIES,
  LEGENDARIES_BY_ID,
  LOOT_RULES,
  SETS,
  SLOTS,
} from '@/config/loot';
import type { FamilyId } from '@/systems/meta/Avantages';
import { FAMILIES } from '@/systems/meta/Avantages';
import { itemLevel } from '@/systems/loot/ilvl';
import { atLeast, pickRarity, rarityWeights } from '@/systems/loot/rarity';
import type { AffixRoll, ItemInstance, LootPity, LootRunState } from '@/systems/loot/types';
import { quantizeQ } from '@/systems/loot/values';
import type { Rng } from '@/utils/rng';

/** Contexte d'un tirage : où, quand, et ce que le joueur possède déjà. */
export interface RollContext {
  readonly source: DropSource;
  /** Indice de salle `r` (ilvl, décalages de rareté). */
  readonly r: number;
  /** Numéro de la salle (origine de l'objet). Par défaut : `r`. */
  readonly room?: number;
  readonly shift: ShiftId;
  /** Numéro du Shift (méta `stats.shifts`), pour l'origine de l'objet. */
  readonly shiftNumber?: number;
  /** Outils débloqués à la DPD (ids de bases d'Outil). */
  readonly unlockedTools: readonly string[];
  /** Plans de Patrimoine archivés (ids de légendaires). */
  readonly codex?: readonly string[];
  /** Objets équipés et au sac : aimant d'attelage, pas de doublon de légendaire. */
  readonly worn?: readonly ItemInstance[];
  /** Familles d'Avantages possédées dans la run (loot ciblé, × 1,5). */
  readonly ownedFamilies?: readonly FamilyId[];
  readonly planPoints?: number;
  /** Lot Loot 1 : n'utiliser que les 20 affixes du MVP. */
  readonly mvpAffixesOnly?: boolean;
}

export interface RollOptions {
  /** Emplacement imposé (porte Dotation annoncée). */
  readonly slot?: SlotId;
  /** Emplacements interdits (seconde option d'une Dotation). */
  readonly excludeSlots?: readonly SlotId[];
  readonly minRarity?: ItemRarity;
  /** Rareté imposée (garanties : Hors-série du 1er kill, Prime de bienvenue). */
  readonly rarity?: ItemRarity;
}

export interface LootCursor {
  readonly run: LootRunState;
  readonly pity: LootPity;
}

export interface RollResult extends LootCursor {
  readonly item: ItemInstance;
}

/** État de tirage d'une nouvelle run. */
export function newLootRun(nextUid: number): LootRunState {
  return {
    slotBag: [],
    toolBag: [],
    sinceHomologue: 0,
    dropIndexByRoom: {},
    nextUid: Math.max(1, Math.trunc(nextUid)),
    newPlans: [],
  };
}

export function formatUid(n: number): string {
  return `it-${String(n).padStart(6, '0')}`;
}

function weightedPick<T>(rng: Rng, entries: readonly (readonly [T, number])[]): T | undefined {
  const total = entries.reduce((s, [, w]) => s + Math.max(0, w), 0);
  if (total <= 0) return entries[0]?.[0];
  let roll = rng() * total;
  for (const [v, w] of entries) {
    if (w <= 0) continue;
    roll -= w;
    if (roll < 0) return v;
  }
  return entries[entries.length - 1]?.[0];
}

function removeOne<T>(list: readonly T[], value: T): T[] {
  const i = list.indexOf(value);
  return i < 0 ? [...list] : [...list.slice(0, i), ...list.slice(i + 1)];
}

/**
 * Sac mélangé d'emplacements : tirage sans remise dans un sac de 6, rempli quand il est vide.
 * Un emplacement imposé est retiré du sac s'il y est encore.
 */
export function drawSlot(
  rng: Rng,
  bag: readonly SlotId[],
  opts: { readonly slot?: SlotId; readonly excludeSlots?: readonly SlotId[] } = {},
): { slot: SlotId; bag: SlotId[] } {
  if (opts.slot) return { slot: opts.slot, bag: removeOne(bag, opts.slot) };
  const excluded = opts.excludeSlots ?? [];
  const full: readonly SlotId[] = bag.length > 0 ? bag : SLOTS;
  const allowed = full.filter((s) => !excluded.includes(s));
  if (allowed.length === 0) {
    // Tous les emplacements restants sont exclus : on tire hors du sac, sans le consommer.
    const fallback = SLOTS.filter((s) => !excluded.includes(s));
    const slot = fallback[Math.floor(rng() * fallback.length)] ?? 'outil';
    return { slot, bag: [...full] };
  }
  const slot = allowed[Math.min(allowed.length - 1, Math.floor(rng() * allowed.length))] ?? 'outil';
  return { slot, bag: removeOne(full, slot) };
}

/** Outils tirables : bases d'Outil débloquées (repli : la Clé à tire-fond). */
function toolPool(unlocked: readonly string[]): string[] {
  const pool = ITEMS.filter((i) => i.slot === 'outil' && unlocked.includes(i.id)).map((i) => i.id);
  return pool.length > 0 ? pool : ['cle-tire-fond'];
}

/**
 * Base d'un objet. Outil : sac des Outils débloqués, sans remise. Autres emplacements : poids de
 * la base, ×3 pour les pièces d'un Attelage déjà porté (aimant d'attelage).
 */
export function pickBase(
  rng: Rng,
  slot: SlotId,
  ilvl: number,
  ctx: Pick<RollContext, 'unlockedTools' | 'worn'>,
  toolBag: readonly string[],
): { def: ItemDef; toolBag: string[] } {
  if (slot === 'outil') {
    const pool = toolPool(ctx.unlockedTools);
    const bag = toolBag.filter((id) => pool.includes(id));
    const full = bag.length > 0 ? bag : pool;
    const id = full[Math.min(full.length - 1, Math.floor(rng() * full.length))] ?? 'cle-tire-fond';
    const def = ITEMS_BY_ID.get(id) ?? ITEMS[0];
    if (!def) throw new Error('Catalogue d’objets vide');
    return { def, toolBag: removeOne(full, id) };
  }
  const wornSets = new Set((ctx.worn ?? []).map((i) => i.setId).filter((s) => s !== undefined));
  const magnet = new Set(SETS.filter((s) => wornSets.has(s.id)).flatMap((s) => s.pieces));
  const entries = ITEMS.filter((i) => i.slot === slot && i.minIlvl <= ilvl).map(
    (i) => [i, i.dropWeight * (magnet.has(i.id) ? LOOT_RULES.SET_MAGNET : 1)] as const,
  );
  const def = weightedPick(rng, entries) ?? ITEMS.find((i) => i.slot === slot);
  if (!def) throw new Error(`Aucune base pour l'emplacement ${slot}`);
  return { def, toolBag: [...toolBag] };
}

export interface AffixRollOptions {
  readonly excludes?: readonly string[];
  readonly ownedFamilies?: readonly FamilyId[];
  readonly mvpOnly?: boolean;
  /** Affixes déjà présents (réaffûtage) : leurs groupes restent exclus. */
  readonly existing?: readonly AffixRoll[];
  readonly kind?: AffixDef['kind'];
}

/** Affixes légaux pour un emplacement (et un type, pour le réaffûtage). */
export function affixPool(slot: SlotId, opts: AffixRollOptions = {}): AffixDef[] {
  return AFFIXES.filter(
    (a) =>
      a.slots.includes(slot) &&
      !(opts.excludes ?? []).includes(a.id) &&
      (!opts.mvpOnly || a.mvp) &&
      (!opts.kind || a.kind === opts.kind),
  );
}

/** Tire une qualité `q` et, pour S15, la famille. */
export function rollAffix(rng: Rng, def: AffixDef): AffixRoll {
  const q = quantizeQ(rng());
  if (def.stat !== 'familyMult') return { affixId: def.id, q };
  const families = Object.keys(FAMILIES) as FamilyId[];
  const family = families[Math.min(families.length - 1, Math.floor(rng() * families.length))];
  return family ? { affixId: def.id, q, family } : { affixId: def.id, q };
}

/**
 * Tire `count` affixes sans doublon de groupe, au plus 2 préfixes et 2 suffixes (limite relâchée
 * quand l'emplacement n'a plus d'affixe légal de l'autre type, cas des Outils et des Gants).
 * Les affixes dont un tag correspond à une famille possédée pèsent ×1,5.
 */
export function rollAffixes(
  rng: Rng,
  slot: SlotId,
  count: number,
  opts: AffixRollOptions = {},
): AffixRoll[] {
  const pool = affixPool(slot, opts);
  const favored = new Set((opts.ownedFamilies ?? []).flatMap((f) => FAMILY_TAGS[f]));
  const rolls: AffixRoll[] = [...(opts.existing ?? [])];
  const out: AffixRoll[] = [];
  for (let i = 0; i < count; i += 1) {
    const defs = rolls
      .map((r) => AFFIXES.find((a) => a.id === r.affixId))
      .filter((d): d is AffixDef => d !== undefined);
    const groups = new Set(defs.map((d) => d.group));
    const kinds = { prefix: 0, suffix: 0 };
    for (const d of defs) kinds[d.kind] += 1;
    const free = pool.filter((a) => !groups.has(a.group));
    const capped = free.filter((a) => kinds[a.kind] < LOOT_RULES.MAX_PER_KIND);
    const candidates = capped.length > 0 ? capped : free;
    if (candidates.length === 0) break;
    const def = weightedPick(
      rng,
      candidates.map(
        (a) =>
          [
            a,
            a.weight * (a.tags.some((tag) => favored.has(tag)) ? LOOT_RULES.TAG_BIAS : 1),
          ] as const,
      ),
    );
    if (!def) break;
    const roll = rollAffix(rng, def);
    rolls.push(roll);
    out.push(roll);
  }
  return out;
}

/** Patrimoines tirables : ni de quête, ni sans Plan s'il en faut un, ni déjà portés, Outil débloqué. */
export function legendaryCandidates(
  ctx: Pick<RollContext, 'codex' | 'worn' | 'unlockedTools'>,
  slot?: SlotId,
  excludeSlots: readonly SlotId[] = [],
): string[] {
  const worn = new Set((ctx.worn ?? []).map((i) => i.legendaryId).filter((id) => id !== undefined));
  const codex = ctx.codex ?? [];
  return LEGENDARIES.filter((l) => {
    const base = ITEMS_BY_ID.get(l.baseId);
    if (!base || l.questOnly || worn.has(l.id)) return false;
    if (l.requiresPlan && !codex.includes(l.id)) return false;
    if ((slot && base.slot !== slot) || excludeSlots.includes(base.slot)) return false;
    return base.slot !== 'outil' || toolPool(ctx.unlockedTools).includes(base.id);
  }).map((l) => l.id);
}

/**
 * Pipeline complet d'un objet (seedé) : rareté (décalages, pitié, Réclamation), emplacement (sac
 * mélangé) ou légendaire, base (sac d'Outils, aimant d'attelage), Attelage, implicite, affixes.
 * Ne mute rien : renvoie l'objet et les nouveaux compteurs (run et pitié).
 */
export function rollItem(
  rng: Rng,
  ctx: RollContext,
  cursor: LootCursor,
  opts: RollOptions = {},
): RollResult {
  const { run, pity } = cursor;
  const ilvl = itemLevel(ctx.r, ctx.source, ctx.shift);
  const rarityCtx = {
    r: ctx.r,
    shift: ctx.shift,
    planPoints: ctx.planPoints ?? 0,
    pityPatrimoine: pity.frozen ? 0 : pity.patrimoine,
    sinceHomologue: run.sinceHomologue,
    ...(opts.minRarity ? { minRarity: opts.minRarity } : {}),
  };
  let rarity: ItemRarity = opts.rarity ?? pickRarity(rng, rarityWeights(ctx.source, rarityCtx));

  // Patrimoine : le légendaire impose sa base (et donc l'emplacement).
  let legendaryId: string | undefined;
  if (rarity === 'patrimoine') {
    const candidates = legendaryCandidates(ctx, opts.slot, opts.excludeSlots);
    legendaryId =
      candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))];
    if (!legendaryId) rarity = 'hors-serie';
  }
  const legendary = legendaryId ? LEGENDARIES_BY_ID.get(legendaryId) : undefined;
  const legendaryBase = legendary ? ITEMS_BY_ID.get(legendary.baseId) : undefined;

  let slotBag: SlotId[];
  let toolBag: string[] = [...run.toolBag];
  let def: ItemDef;
  if (legendaryBase) {
    def = legendaryBase;
    slotBag = removeOne(run.slotBag, def.slot);
  } else {
    const drawn = drawSlot(rng, run.slotBag, opts);
    slotBag = drawn.bag;
    const base = pickBase(rng, drawn.slot, ilvl, ctx, run.toolBag);
    def = base.def;
    toolBag = base.toolBag;
  }

  // Attelage : seulement en Hors-série, sur une base d'Attelage.
  const set = SETS.find((s) => s.pieces.includes(def.id));
  const setId =
    rarity === 'hors-serie' && set && rng() < LOOT_RULES.SET_PIECE_CHANCE ? set.id : undefined;
  const count = setId ? LOOT_RULES.SET_PIECE_AFFIXES : ITEM_RARITIES[rarity].affixes;

  const implicitQ = quantizeQ(rng());
  const affixes = rollAffixes(rng, def.slot, count, {
    ...(legendary?.excludes ? { excludes: legendary.excludes } : {}),
    ...(ctx.ownedFamilies ? { ownedFamilies: ctx.ownedFamilies } : {}),
    ...(ctx.mvpAffixesOnly ? { mvpOnly: true } : {}),
  });

  const item: ItemInstance = {
    uid: formatUid(run.nextUid),
    defId: def.id,
    rarity,
    ilvl,
    implicitQ,
    affixes,
    ...(legendaryId && legendaryBase ? { legendaryId } : {}),
    ...(setId ? { setId } : {}),
    origin: { source: ctx.source, shift: ctx.shiftNumber ?? 0, room: ctx.room ?? ctx.r },
    rerolls: 0,
    locked: false,
  };

  const isPatrimoine = item.rarity === 'patrimoine';
  const newPlans =
    item.legendaryId && !run.newPlans.includes(item.legendaryId)
      ? [...run.newPlans, item.legendaryId]
      : run.newPlans;
  return {
    item,
    run: {
      ...run,
      slotBag,
      toolBag,
      sinceHomologue: atLeast(item.rarity, 'homologue') ? 0 : run.sinceHomologue + 1,
      nextUid: run.nextUid + 1,
      newPlans,
    },
    pity: pity.frozen
      ? pity
      : {
          ...pity,
          patrimoine: isPatrimoine
            ? 0
            : Math.min(
                LOOT_RULES.PITY_CAP,
                Number((pity.patrimoine + LOOT_RULES.PITY_STEP).toFixed(4)),
              ),
          welcomeDone: pity.welcomeDone || isPatrimoine,
        },
  };
}
